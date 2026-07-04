package service

import (
	"errors"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
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
