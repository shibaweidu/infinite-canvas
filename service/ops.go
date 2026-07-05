package service

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/basketikun/infinite-canvas/config"
	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
)

const databaseBackupTaskType = "database_backup"

var (
	systemTaskWorkerOnce sync.Once
	systemTaskWorkerMu   sync.Mutex
	serverStartedAt      = time.Now()
)

func StartSystemTaskWorker() {
	systemTaskWorkerOnce.Do(func() {
		if err := repository.ResetRunningSystemTasks(); err != nil {
			log.Printf("reset running system tasks failed err=%v", err)
		}
		go func() {
			ticker := time.NewTicker(3 * time.Second)
			defer ticker.Stop()
			for {
				ProcessRunnableSystemTasks()
				<-ticker.C
			}
		}()
	})
}

func RecordAdminOperation(item model.AdminOperationLog) {
	if item.ID == "" {
		item.ID = newID("op")
	}
	if item.CreatedAt == "" {
		item.CreatedAt = time.Now().Format(time.RFC3339)
	}
	_ = repository.SaveAdminOperationLog(item)
}

func ListAdminOperationLogs(q model.Query) (model.AdminOperationLogList, error) {
	items, total, err := repository.ListAdminOperationLogs(q)
	if err != nil {
		return model.AdminOperationLogList{}, err
	}
	return model.AdminOperationLogList{Items: items, Total: int(total)}, nil
}

func RecordErrorLog(item model.ErrorLog) {
	if item.ID == "" {
		item.ID = newID("err")
	}
	if item.CreatedAt == "" {
		item.CreatedAt = time.Now().Format(time.RFC3339)
	}
	item.Message = trimForLog(item.Message, 500)
	item.Detail = trimForLog(item.Detail, 4000)
	_ = repository.SaveErrorLog(item)
}

func ListErrorLogs(q model.Query) (model.ErrorLogList, error) {
	items, total, err := repository.ListErrorLogs(q)
	if err != nil {
		return model.ErrorLogList{}, err
	}
	return model.ErrorLogList{Items: items, Total: int(total)}, nil
}

func ListSystemTasks(q model.Query) (model.SystemTaskList, error) {
	items, total, err := repository.ListSystemTasks(q)
	if err != nil {
		return model.SystemTaskList{}, err
	}
	return model.SystemTaskList{Items: items, Total: int(total)}, nil
}

func ListTaskLogs(q model.TaskLogQuery) (model.TaskLogList, error) {
	items, total, err := repository.ListTaskLogs(q)
	if err != nil {
		return model.TaskLogList{}, err
	}
	result := make([]model.TaskLogItem, 0, len(items))
	for _, item := range items {
		result = append(result, buildTaskLogItem(item, false))
	}
	return model.TaskLogList{Items: result, Total: int(total)}, nil
}

func TaskLogDetail(id string) (model.TaskLogItem, error) {
	task, ok, err := repository.GetSystemTaskByID(id)
	if err != nil {
		return model.TaskLogItem{}, err
	}
	if !ok {
		return model.TaskLogItem{}, errors.New("任务不存在")
	}
	item := buildTaskLogItem(task, true)
	enrichTaskLogDetail(task, &item)
	return item, nil
}

func TaskLogStats(q model.TaskLogQuery) (model.TaskLogStats, error) {
	counts, total, err := repository.TaskLogStatusCounts(q)
	if err != nil {
		return model.TaskLogStats{}, err
	}
	today, _ := repository.TodaySystemTaskCount()
	durations, _ := repository.CompletedTaskDurations(q, 200)
	var durationTotal int64
	var durationCount int64
	for _, item := range durations {
		if ms := taskRunDurationMs(item); ms > 0 {
			durationTotal += ms
			durationCount++
		}
	}
	var average int64
	if durationCount > 0 {
		average = durationTotal / durationCount
	}
	return model.TaskLogStats{
		Total:             total,
		Today:             today,
		Pending:           counts[model.SystemTaskStatusPending],
		Running:           counts[model.SystemTaskStatusRunning],
		Success:           counts[model.SystemTaskStatusSuccess],
		Failed:            counts[model.SystemTaskStatusFailed],
		Canceled:          counts[model.SystemTaskStatusCanceled],
		AverageDurationMs: average,
	}, nil
}

func RetryTaskLog(id string) (model.TaskLogItem, error) {
	task, ok, err := repository.GetSystemTaskByID(id)
	if err != nil {
		return model.TaskLogItem{}, err
	}
	if !ok {
		return model.TaskLogItem{}, safeMessageError{message: "任务不存在"}
	}
	if task.Status != model.SystemTaskStatusFailed && task.Status != model.SystemTaskStatusCanceled {
		return model.TaskLogItem{}, safeMessageError{message: "只有失败或已取消的任务可以重试"}
	}
	now := time.Now().Format(time.RFC3339)
	next := model.SystemTask{
		ID:        newID("task"),
		Type:      task.Type,
		Status:    model.SystemTaskStatusPending,
		Title:     task.Title,
		Payload:   resetTaskPayloadForRetry(task.Payload, task.ID),
		CreatedBy: task.CreatedBy,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := repository.SaveSystemTask(next); err != nil {
		return model.TaskLogItem{}, err
	}
	return buildTaskLogItem(next, true), nil
}

func CancelTaskLog(id string) (model.TaskLogItem, error) {
	task, ok, err := repository.GetSystemTaskByID(id)
	if err != nil {
		return model.TaskLogItem{}, err
	}
	if !ok {
		return model.TaskLogItem{}, safeMessageError{message: "任务不存在"}
	}
	if task.Status != model.SystemTaskStatusPending {
		return model.TaskLogItem{}, safeMessageError{message: "只有排队中的任务可以取消"}
	}
	now := time.Now().Format(time.RFC3339)
	task.Status = model.SystemTaskStatusCanceled
	task.FinishedAt = now
	task.UpdatedAt = now
	task.Error = "管理员取消任务"
	if err := repository.SaveSystemTask(task); err != nil {
		return model.TaskLogItem{}, err
	}
	return buildTaskLogItem(task, true), nil
}

func resetTaskPayloadForRetry(value string, sourceTaskID string) string {
	var payload map[string]any
	if err := json.Unmarshal([]byte(value), &payload); err != nil {
		payload = map[string]any{}
	}
	if _, ok := payload["charged"]; ok {
		payload["charged"] = false
	}
	payload["retryOf"] = strings.TrimSpace(sourceTaskID)
	data, err := json.Marshal(payload)
	if err != nil {
		return value
	}
	return string(data)
}

func ProcessRunnableSystemTasks() {
	for i := 0; i < 10; i++ {
		if !processOneRunnableSystemTask() {
			return
		}
	}
}

func processOneRunnableSystemTask() bool {
	systemTaskWorkerMu.Lock()
	task, ok, err := nextRunnableSystemTask()
	if err != nil {
		log.Printf("load pending system task failed err=%v", err)
		systemTaskWorkerMu.Unlock()
		return false
	}
	if !ok {
		systemTaskWorkerMu.Unlock()
		return false
	}
	task = markSystemTaskRunning(task)
	systemTaskWorkerMu.Unlock()
	go runSystemTask(task)
	return true
}

func markSystemTaskRunning(task model.SystemTask) model.SystemTask {
	now := time.Now().Format(time.RFC3339)
	task.Status = model.SystemTaskStatusRunning
	task.StartedAt = now
	task.UpdatedAt = now
	task.Error = ""
	if err := repository.SaveSystemTask(task); err != nil {
		log.Printf("mark system task running failed id=%s err=%v", task.ID, err)
	}
	return task
}

func runSystemTask(task model.SystemTask) {
	var result string
	var err error
	switch task.Type {
	case databaseBackupTaskType:
		backup, backupErr := createSQLiteBackup()
		err = backupErr
		result = backup.Path
	case aiImageGenerationTaskType, aiImageEditTaskType, aiVideoTaskType:
		result, err = runAIProxyTask(task)
	default:
		err = errors.New("未知系统任务类型")
	}

	finishSystemTask(task, result, err)
}

func nextRunnableSystemTask() (model.SystemTask, bool, error) {
	tasks, err := repository.PendingSystemTasks(50)
	if err != nil || len(tasks) == 0 {
		return model.SystemTask{}, false, err
	}
	defaultConcurrency := defaultUserTaskConcurrency()
	for _, task := range tasks {
		limit := taskUserConcurrency(task.CreatedBy, defaultConcurrency)
		if limit <= 0 {
			limit = defaultConcurrency
		}
		running, err := repository.CountRunningSystemTasksByUser(task.CreatedBy)
		if err != nil {
			return model.SystemTask{}, false, err
		}
		if running < int64(limit) {
			return task, true, nil
		}
	}
	return model.SystemTask{}, false, nil
}

func defaultUserTaskConcurrency() int {
	settings, err := repository.GetSettings()
	if err != nil {
		return 2
	}
	return normalizePrivateSetting(settings.Private).TaskQueue.DefaultUserConcurrency
}

func taskUserConcurrency(userID string, fallback int) int {
	if strings.TrimSpace(userID) == "" {
		return fallback
	}
	user, ok, err := repository.GetUserByID(userID)
	if err != nil || !ok || user.TaskConcurrency <= 0 {
		return fallback
	}
	if user.TaskConcurrency > 50 {
		return 50
	}
	return user.TaskConcurrency
}

func DatabaseStatus() model.DatabaseStatus {
	driver := strings.ToLower(strings.TrimSpace(config.Cfg.StorageDriver))
	if driver == "" {
		driver = "sqlite"
	}
	notes := []string{}
	if driver == "sqlite" {
		notes = append(notes, "SQLite 适合内测和低并发场景，正式生产建议切换 MySQL 或 PostgreSQL。")
		notes = append(notes, "SQLite 生产使用时必须确认 data 目录持久化，并定期下载备份文件。")
	} else {
		notes = append(notes, "生产数据库请使用数据库自身备份、云快照或主从方案；应用内备份仅支持 SQLite 文件。")
	}
	return model.DatabaseStatus{Driver: driver, DSN: maskDSN(config.Cfg.DatabaseDSN), Notes: notes}
}

func ServerStatus() model.ServerStatus {
	now := time.Now()
	mem := runtime.MemStats{}
	runtime.ReadMemStats(&mem)
	taskCounts, _ := repository.SystemTaskStatusCounts()
	typeCounts, _ := repository.SystemTaskTypeCounts()
	return model.ServerStatus{
		StartedAt:     serverStartedAt.Format(time.RFC3339),
		ServerTime:    now.Format(time.RFC3339),
		UptimeSeconds: int64(now.Sub(serverStartedAt).Seconds()),
		OS:            runtime.GOOS,
		Arch:          runtime.GOARCH,
		CPUCores:      runtime.NumCPU(),
		GoVersion:     runtime.Version(),
		Goroutines:    runtime.NumGoroutine(),
		Memory: model.ServerMemoryStatus{
			Alloc:     mem.Alloc,
			Sys:       mem.Sys,
			HeapAlloc: mem.HeapAlloc,
			HeapInuse: mem.HeapInuse,
			NumGC:     mem.NumGC,
		},
		Database:  databasePoolStatus(),
		TaskQueue: taskQueueStatus(taskCounts, typeCounts),
		DataDir:   dataDirStatus(),
	}
}

func databasePoolStatus() model.DatabasePoolStatus {
	db, err := repository.DB()
	if err != nil {
		return model.DatabasePoolStatus{}
	}
	sqlDB, err := db.DB()
	if err != nil {
		return model.DatabasePoolStatus{}
	}
	stats := sqlDB.Stats()
	return model.DatabasePoolStatus{
		OpenConnections: stats.OpenConnections,
		InUse:           stats.InUse,
		Idle:            stats.Idle,
		WaitCount:       stats.WaitCount,
		WaitDurationMs:  stats.WaitDuration.Milliseconds(),
	}
}

func taskQueueStatus(counts map[model.SystemTaskStatus]int64, byType map[string]int) model.TaskQueueStatus {
	return model.TaskQueueStatus{
		DefaultUserConcurrency: defaultUserTaskConcurrency(),
		Pending:                counts[model.SystemTaskStatusPending],
		Running:                counts[model.SystemTaskStatusRunning],
		Success:                counts[model.SystemTaskStatusSuccess],
		Failed:                 counts[model.SystemTaskStatusFailed],
		ByType:                 byType,
	}
}

func buildTaskLogItem(task model.SystemTask, includeDetail bool) model.TaskLogItem {
	payload := parseTaskPayload(task.Payload)
	result := parseTaskResult(task.Result)
	item := model.TaskLogItem{
		ID:              task.ID,
		SourceTaskID:    payload.RetryOf,
		Type:            task.Type,
		TypeLabel:       taskTypeLabel(task.Type),
		Status:          task.Status,
		StatusLabel:     taskStatusLabel(task.Status),
		Title:           task.Title,
		CreatedBy:       task.CreatedBy,
		Platform:        taskPlatform(task.Type),
		Model:           payload.Model,
		Credits:         payload.Credits,
		Progress:        taskProgress(task.Status),
		CreatedAt:       task.CreatedAt,
		StartedAt:       task.StartedAt,
		FinishedAt:      task.FinishedAt,
		DurationMs:      taskDurationMs(task),
		QueueDurationMs: taskQueueDurationMs(task),
		RunDurationMs:   taskRunDurationMs(task),
		Summary:         taskSummary(task, payload, result),
		Error:           task.Error,
		UpstreamTaskID:  result.UpstreamTaskID,
	}
	if includeDetail {
		item.Payload = sanitizedTaskPayload(task.Payload)
		item.Result = sanitizedTaskResult(task.Result)
	}
	return item
}

func enrichTaskLogDetail(task model.SystemTask, item *model.TaskLogItem) {
	payload := parseTaskPayload(task.Payload)
	result := parseTaskResult(task.Result)
	item.Timeline = taskTimeline(task, payload, result)
	item.ResultLinks = taskResultLinks(result)
	item.RelatedTasks = taskRelatedTasks(task, payload)
	from := task.CreatedAt
	to := task.FinishedAt
	if to == "" {
		to = time.Now().Format(time.RFC3339)
	}
	logs, err := repository.ListTaskCreditLogs(task, payload.Model, from, to)
	if err == nil {
		sanitizeCreditLogs(logs)
		item.CreditLogs = logs
	}
}

func taskTimeline(task model.SystemTask, payload AITaskPayload, result AITaskResult) []model.TaskLogEvent {
	items := []model.TaskLogEvent{}
	if task.CreatedAt != "" {
		items = append(items, model.TaskLogEvent{Time: task.CreatedAt, Title: "提交任务", Description: task.Title, Status: "finish"})
	}
	if task.StartedAt != "" {
		items = append(items, model.TaskLogEvent{Time: task.StartedAt, Title: "开始执行", Description: "worker 已领取任务", Status: "finish"})
	} else if task.Status == model.SystemTaskStatusPending {
		items = append(items, model.TaskLogEvent{Time: task.CreatedAt, Title: "等待执行", Description: "任务仍在队列中", Status: "process"})
	}
	if payload.Credits > 0 && payload.Charged {
		items = append(items, model.TaskLogEvent{Time: firstNonEmpty(task.StartedAt, task.CreatedAt), Title: "扣除积分", Description: strconv.Itoa(payload.Credits) + " 积分", Status: "finish"})
	}
	if result.UpstreamTaskID != "" {
		items = append(items, model.TaskLogEvent{Time: firstNonEmpty(task.StartedAt, task.CreatedAt), Title: "上游任务", Description: result.UpstreamTaskID, Status: "finish"})
	}
	if task.FinishedAt != "" {
		title := "任务完成"
		status := "finish"
		if task.Status == model.SystemTaskStatusFailed {
			title = "任务失败"
			status = "error"
		}
		if task.Status == model.SystemTaskStatusCanceled {
			title = "任务取消"
			status = "error"
		}
		items = append(items, model.TaskLogEvent{Time: task.FinishedAt, Title: title, Description: taskSummary(task, payload, result), Status: status})
	}
	return items
}

func taskResultLinks(result AITaskResult) []model.TaskLogLink {
	links := []model.TaskLogLink{}
	if result.URL != "" {
		links = append(links, model.TaskLogLink{Label: "结果地址", URL: result.URL, Type: result.MimeType})
	}
	for _, url := range extractURLsFromJSON(result.Body) {
		links = append(links, model.TaskLogLink{Label: "结果资源", URL: url, Type: ""})
	}
	return links
}

func taskRelatedTasks(task model.SystemTask, payload AITaskPayload) []model.TaskLogRelated {
	items := []model.TaskLogRelated{}
	if payload.RetryOf != "" {
		source, ok, err := repository.GetSystemTaskByID(payload.RetryOf)
		if err == nil && ok {
			items = append(items, model.TaskLogRelated{ID: source.ID, Relation: "重试来源", Status: source.Status, StatusLabel: taskStatusLabel(source.Status), CreatedAt: source.CreatedAt})
		}
	}
	retries, err := repository.ListRetryTasks(task.ID)
	if err == nil {
		for _, retry := range retries {
			if retry.ID == task.ID {
				continue
			}
			retryPayload := parseTaskPayload(retry.Payload)
			if retryPayload.RetryOf != task.ID {
				continue
			}
			items = append(items, model.TaskLogRelated{ID: retry.ID, Relation: "重试任务", Status: retry.Status, StatusLabel: taskStatusLabel(retry.Status), CreatedAt: retry.CreatedAt})
		}
	}
	return items
}

func extractURLsFromJSON(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	var data any
	if err := json.Unmarshal([]byte(value), &data); err != nil {
		return nil
	}
	result := []string{}
	collectURLs(data, &result)
	return result
}

func collectURLs(value any, result *[]string) {
	switch item := value.(type) {
	case string:
		if strings.HasPrefix(item, "http://") || strings.HasPrefix(item, "https://") {
			*result = append(*result, item)
		}
	case []any:
		for _, child := range item {
			collectURLs(child, result)
		}
	case map[string]any:
		for _, child := range item {
			collectURLs(child, result)
		}
	}
}

func parseTaskPayload(value string) AITaskPayload {
	var payload AITaskPayload
	_ = json.Unmarshal([]byte(value), &payload)
	return payload
}

func parseTaskResult(value string) AITaskResult {
	var result AITaskResult
	_ = json.Unmarshal([]byte(value), &result)
	return result
}

func taskTypeLabel(value string) string {
	switch value {
	case aiImageGenerationTaskType:
		return "图片生成"
	case aiImageEditTaskType:
		return "图片编辑"
	case aiVideoTaskType:
		return "视频生成"
	case databaseBackupTaskType:
		return "数据库备份"
	default:
		if strings.TrimSpace(value) == "" {
			return "-"
		}
		return value
	}
}

func taskStatusLabel(value model.SystemTaskStatus) string {
	switch value {
	case model.SystemTaskStatusPending:
		return "排队中"
	case model.SystemTaskStatusRunning:
		return "运行中"
	case model.SystemTaskStatusSuccess:
		return "成功"
	case model.SystemTaskStatusFailed:
		return "失败"
	case model.SystemTaskStatusCanceled:
		return "已取消"
	default:
		return string(value)
	}
}

func taskPlatform(value string) string {
	switch value {
	case databaseBackupTaskType:
		return "后台"
	case aiImageGenerationTaskType, aiImageEditTaskType, aiVideoTaskType:
		return "前台生成"
	default:
		return "系统"
	}
}

func taskProgress(value model.SystemTaskStatus) int {
	switch value {
	case model.SystemTaskStatusPending:
		return 0
	case model.SystemTaskStatusRunning:
		return 50
	case model.SystemTaskStatusSuccess, model.SystemTaskStatusFailed, model.SystemTaskStatusCanceled:
		return 100
	default:
		return 0
	}
}

func taskSummary(task model.SystemTask, payload AITaskPayload, result AITaskResult) string {
	if task.Error != "" {
		return trimForLog(task.Error, 160)
	}
	if result.URL != "" {
		return result.URL
	}
	if result.MimeType != "" {
		return result.MimeType
	}
	if payload.Path != "" {
		return payload.Path
	}
	if task.Result != "" {
		return trimForLog(task.Result, 160)
	}
	return task.Title
}

func taskDurationMs(task model.SystemTask) int64 {
	start := parseRFC3339(task.CreatedAt)
	end := parseRFC3339(task.FinishedAt)
	if start.IsZero() || end.IsZero() {
		return 0
	}
	return end.Sub(start).Milliseconds()
}

func taskQueueDurationMs(task model.SystemTask) int64 {
	created := parseRFC3339(task.CreatedAt)
	started := parseRFC3339(task.StartedAt)
	if created.IsZero() || started.IsZero() {
		return 0
	}
	return started.Sub(created).Milliseconds()
}

func taskRunDurationMs(task model.SystemTask) int64 {
	start := parseRFC3339(task.StartedAt)
	end := parseRFC3339(task.FinishedAt)
	if start.IsZero() || end.IsZero() {
		return 0
	}
	return end.Sub(start).Milliseconds()
}

func parseRFC3339(value string) time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}
	}
	t, err := time.Parse(time.RFC3339, value)
	if err == nil {
		return t
	}
	t, _ = time.Parse("2006-01-02 15:04:05", value)
	return t
}

func sanitizedTaskPayload(value string) string {
	var payload map[string]any
	if err := json.Unmarshal([]byte(value), &payload); err != nil {
		return trimForLog(value, 4000)
	}
	if body, ok := payload["bodyBase64"].(string); ok {
		payload["bodyBase64"] = "[已隐藏，原始大小 " + humanBytes(int64(base64.StdEncoding.DecodedLen(len(body)))) + "]"
	}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return trimForLog(value, 4000)
	}
	return string(data)
}

func sanitizedTaskResult(value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}
	var result map[string]any
	if err := json.Unmarshal([]byte(value), &result); err != nil {
		return trimForLog(value, 4000)
	}
	if body, ok := result["body"].(string); ok && len(body) > 1200 {
		result["body"] = body[:1200] + "...[已截断]"
	}
	if body, ok := result["base64"].(string); ok {
		result["base64"] = "[已隐藏，原始大小 " + humanBytes(int64(base64.StdEncoding.DecodedLen(len(body)))) + "]"
	}
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return trimForLog(value, 4000)
	}
	return string(data)
}

func humanBytes(value int64) string {
	if value > 1024*1024 {
		return strings.TrimRight(strings.TrimRight(strconv.FormatFloat(float64(value)/1024/1024, 'f', 2, 64), "0"), ".") + " MB"
	}
	if value > 1024 {
		return strings.TrimRight(strings.TrimRight(strconv.FormatFloat(float64(value)/1024, 'f', 2, 64), "0"), ".") + " KB"
	}
	return strconv.FormatInt(value, 10) + " B"
}

func dataDirStatus() model.ServerDataDirStatus {
	path := "data"
	if source := sqliteFilePath(config.Cfg.DatabaseDSN); source != "" {
		path = filepath.Dir(source)
	}
	return model.ServerDataDirStatus{Path: path, Size: directorySize(path)}
}

func directorySize(root string) int64 {
	var size int64
	_ = filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return nil
		}
		info, err := entry.Info()
		if err == nil {
			size += info.Size()
		}
		return nil
	})
	return size
}

func ListDatabaseBackups() ([]model.BackupFile, error) {
	dir := backupDir()
	files, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []model.BackupFile{}, nil
		}
		return nil, err
	}
	items := []model.BackupFile{}
	for _, file := range files {
		if file.IsDir() {
			continue
		}
		info, err := file.Info()
		if err != nil {
			continue
		}
		items = append(items, model.BackupFile{Name: file.Name(), Path: filepath.Join(dir, file.Name()), Size: info.Size(), CreatedAt: info.ModTime().Format(time.RFC3339)})
	}
	return items, nil
}

func EnqueueDatabaseBackup(user model.AuthUser) (model.SystemTask, error) {
	now := time.Now().Format(time.RFC3339)
	task := model.SystemTask{ID: newID("task"), Type: databaseBackupTaskType, Status: model.SystemTaskStatusPending, Title: "数据库备份", CreatedBy: user.ID, CreatedAt: now, UpdatedAt: now}
	return task, repository.SaveSystemTask(task)
}

func finishSystemTask(task model.SystemTask, result string, err error) {
	finished := time.Now().Format(time.RFC3339)
	task.FinishedAt = finished
	task.UpdatedAt = finished
	if err != nil {
		task.Status = model.SystemTaskStatusFailed
		task.Error = err.Error()
		_ = repository.SaveSystemTask(task)
		RecordErrorLog(model.ErrorLog{Source: "system_task", Message: err.Error(), Detail: task.Type, Path: task.ID})
		return
	}
	task.Status = model.SystemTaskStatusSuccess
	task.Result = result
	_ = repository.SaveSystemTask(task)
}

func createSQLiteBackup() (model.BackupFile, error) {
	driver := strings.ToLower(strings.TrimSpace(config.Cfg.StorageDriver))
	if driver != "" && driver != "sqlite" {
		return model.BackupFile{}, errors.New("当前应用内备份仅支持 SQLite，MySQL/PostgreSQL 请使用数据库自身备份方案")
	}
	source := sqliteFilePath(config.Cfg.DatabaseDSN)
	if source == "" {
		return model.BackupFile{}, errors.New("当前 SQLite DSN 无法直接文件备份")
	}
	if _, err := os.Stat(source); err != nil {
		return model.BackupFile{}, err
	}
	dir := backupDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return model.BackupFile{}, err
	}
	name := "infinite-canvas-" + time.Now().Format("20060102-150405") + ".db"
	target := filepath.Join(dir, name)
	if err := copyFile(source, target); err != nil {
		return model.BackupFile{}, err
	}
	info, err := os.Stat(target)
	if err != nil {
		return model.BackupFile{}, err
	}
	return model.BackupFile{Name: name, Path: target, Size: info.Size(), CreatedAt: info.ModTime().Format(time.RFC3339)}, nil
}

func backupDir() string {
	source := sqliteFilePath(config.Cfg.DatabaseDSN)
	if source == "" {
		return filepath.Join("data", "backups")
	}
	return filepath.Join(filepath.Dir(source), "backups")
}

func sqliteFilePath(dsn string) string {
	value := strings.TrimSpace(dsn)
	if value == "" || value == ":memory:" {
		return ""
	}
	value = strings.TrimPrefix(value, "file:")
	if index := strings.Index(value, "?"); index >= 0 {
		value = value[:index]
	}
	return value
}

func copyFile(source, target string) error {
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(target)
	if err != nil {
		return err
	}
	defer out.Close()
	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

func maskDSN(value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}
	if strings.Contains(value, "://") {
		return regexpDSNPassword(value)
	}
	if at := strings.LastIndex(value, "@"); at > 0 {
		prefix := value[:at]
		if colon := strings.LastIndex(prefix, ":"); colon >= 0 {
			return prefix[:colon+1] + "****" + value[at:]
		}
	}
	return value
}

func regexpDSNPassword(value string) string {
	if scheme := strings.Index(value, "://"); scheme >= 0 {
		rest := value[scheme+3:]
		if at := strings.Index(rest, "@"); at >= 0 {
			auth := rest[:at]
			if colon := strings.LastIndex(auth, ":"); colon >= 0 {
				return value[:scheme+3] + auth[:colon+1] + "****" + rest[at:]
			}
		}
	}
	return value
}

func trimForLog(value string, max int) string {
	value = strings.TrimSpace(value)
	if len(value) <= max {
		return value
	}
	return value[:max]
}
