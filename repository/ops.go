package repository

import (
	"errors"
	"strings"
	"time"

	"github.com/basketikun/infinite-canvas/model"
	"gorm.io/gorm"
)

func SaveAdminOperationLog(item model.AdminOperationLog) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Create(&item).Error
}

func ListAdminOperationLogs(q model.Query) ([]model.AdminOperationLog, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := db.Model(&model.AdminOperationLog{})
	if q.Keyword != "" {
		like := "%" + q.Keyword + "%"
		tx = tx.Where("username LIKE ? OR method LIKE ? OR path LIKE ? OR ip LIKE ?", like, like, like, like)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.AdminOperationLog
	err = tx.Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return items, total, err
}

func SaveSystemTask(item model.SystemTask) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Save(&item).Error
}

func GetSystemTaskByID(id string) (model.SystemTask, bool, error) {
	db, err := DB()
	if err != nil {
		return model.SystemTask{}, false, err
	}
	var item model.SystemTask
	err = db.Where("id = ?", id).First(&item).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.SystemTask{}, false, nil
		}
		return model.SystemTask{}, false, err
	}
	return item, true, nil
}

func PendingSystemTasks(limit int) ([]model.SystemTask, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 20
	}
	var items []model.SystemTask
	err = db.Where("status = ?", model.SystemTaskStatusPending).Order("created_at asc").Limit(limit).Find(&items).Error
	return items, err
}

func CountRunningSystemTasksByUser(userID string) (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	var total int64
	err = db.Model(&model.SystemTask{}).Where("status = ? AND created_by = ?", model.SystemTaskStatusRunning, userID).Count(&total).Error
	return total, err
}

func SystemTaskStatusCounts() (map[model.SystemTaskStatus]int64, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	type row struct {
		Status model.SystemTaskStatus
		Total  int64
	}
	var rows []row
	if err := db.Model(&model.SystemTask{}).Select("status, COUNT(*) as total").Group("status").Scan(&rows).Error; err != nil {
		return nil, err
	}
	result := map[model.SystemTaskStatus]int64{}
	for _, item := range rows {
		result[item.Status] = item.Total
	}
	return result, nil
}

func SystemTaskTypeCounts() (map[string]int, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	type row struct {
		Type  string
		Total int
	}
	var rows []row
	if err := db.Model(&model.SystemTask{}).Select("type, COUNT(*) as total").Group("type").Scan(&rows).Error; err != nil {
		return nil, err
	}
	result := map[string]int{}
	for _, item := range rows {
		result[item.Type] = item.Total
	}
	return result, nil
}

func ResetRunningSystemTasks() error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Model(&model.SystemTask{}).
		Where("status = ?", model.SystemTaskStatusRunning).
		Updates(map[string]any{"status": model.SystemTaskStatusPending, "started_at": "", "updated_at": ""}).Error
}

func ListSystemTasks(q model.Query) ([]model.SystemTask, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := db.Model(&model.SystemTask{})
	if q.Keyword != "" {
		like := "%" + q.Keyword + "%"
		tx = tx.Where("id LIKE ? OR type LIKE ? OR status LIKE ? OR title LIKE ? OR error LIKE ?", like, like, like, like, like)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.SystemTask
	err = tx.Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return items, total, err
}

func ListTaskLogs(q model.TaskLogQuery) ([]model.SystemTask, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := applyTaskLogFilters(db.Model(&model.SystemTask{}), q)
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.SystemTask
	err = tx.Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return items, total, err
}

func ListUserTaskLogs(userID string, q model.TaskLogQuery) ([]model.SystemTask, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := applyTaskLogFilters(db.Model(&model.SystemTask{}).Where("created_by = ?", userID), q)
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.SystemTask
	err = tx.Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return items, total, err
}

func TaskLogStatusCounts(q model.TaskLogQuery) (map[model.SystemTaskStatus]int64, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	type row struct {
		Status model.SystemTaskStatus
		Total  int64
	}
	var rows []row
	tx := applyTaskLogFilters(db.Model(&model.SystemTask{}), q)
	if err := tx.Select("status, COUNT(*) as total").Group("status").Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	result := map[model.SystemTaskStatus]int64{}
	var total int64
	for _, item := range rows {
		result[item.Status] = item.Total
		total += item.Total
	}
	return result, total, nil
}

func TodaySystemTaskCount() (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	today := time.Now().Format("2006-01-02")
	var total int64
	err = db.Model(&model.SystemTask{}).Where("created_at >= ?", today).Count(&total).Error
	return total, err
}

func CompletedTaskDurations(q model.TaskLogQuery, limit int) ([]model.SystemTask, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = 200
	}
	var items []model.SystemTask
	err = applyTaskLogFilters(db.Model(&model.SystemTask{}), q).
		Where("started_at <> '' AND finished_at <> ''").
		Order("finished_at desc").
		Limit(limit).
		Find(&items).Error
	return items, err
}

func ListTaskCreditLogs(task model.SystemTask, modelName string, from string, to string) ([]model.CreditLog, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	tx := db.Model(&model.CreditLog{}).Where("user_id = ?", task.CreatedBy)
	if task.ID != "" {
		tx = tx.Where("related_id = ? OR related_id = ''", task.ID)
	}
	if from != "" {
		tx = tx.Where("created_at >= ?", from)
	}
	if to != "" {
		tx = tx.Where("created_at <= ?", to)
	}
	var logs []model.CreditLog
	if err := tx.Order("created_at asc").Limit(20).Find(&logs).Error; err != nil {
		return nil, err
	}
	if modelName == "" {
		return logs, nil
	}
	result := []model.CreditLog{}
	for _, item := range logs {
		if item.RelatedID == task.ID || strings.Contains(item.Extra, modelName) || strings.Contains(item.Remark, modelName) {
			result = append(result, item)
		}
	}
	return result, nil
}

func ListRetryTasks(sourceTaskID string) ([]model.SystemTask, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	var items []model.SystemTask
	err = db.Model(&model.SystemTask{}).
		Where("payload LIKE ?", "%"+sourceTaskID+"%").
		Order("created_at asc").
		Limit(20).
		Find(&items).Error
	return items, err
}

func applyTaskLogFilters(tx *gorm.DB, q model.TaskLogQuery) *gorm.DB {
	if q.Keyword != "" {
		like := "%" + q.Keyword + "%"
		tx = tx.Where("id LIKE ? OR type LIKE ? OR status LIKE ? OR title LIKE ? OR created_by LIKE ? OR error LIKE ?", like, like, like, like, like, like)
	}
	if q.Status != "" {
		tx = tx.Where("status = ?", q.Status)
	}
	if q.Type != "" {
		tx = tx.Where("type = ?", q.Type)
	}
	if q.CreatedFrom != "" {
		tx = tx.Where("created_at >= ?", q.CreatedFrom)
	}
	if q.CreatedTo != "" {
		tx = tx.Where("created_at <= ?", q.CreatedTo)
	}
	return tx
}

func SaveErrorLog(item model.ErrorLog) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Create(&item).Error
}

func ListErrorLogs(q model.Query) ([]model.ErrorLog, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := db.Model(&model.ErrorLog{})
	if q.Keyword != "" {
		like := "%" + q.Keyword + "%"
		tx = tx.Where("source LIKE ? OR message LIKE ? OR detail LIKE ? OR path LIKE ? OR ip LIKE ?", like, like, like, like, like)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.ErrorLog
	err = tx.Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return items, total, err
}

func CountAdminOperationsSince(since string) (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	tx := db.Model(&model.AdminOperationLog{})
	if since != "" {
		tx = tx.Where("created_at >= ?", since)
	}
	var total int64
	return total, tx.Count(&total).Error
}

func CountErrorLogsSince(since string) (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	tx := db.Model(&model.ErrorLog{})
	if since != "" {
		tx = tx.Where("created_at >= ?", since)
	}
	var total int64
	return total, tx.Count(&total).Error
}

func CountUsersSince(since string) (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	tx := db.Model(&model.User{})
	if since != "" {
		tx = tx.Where("created_at >= ?", since)
	}
	var total int64
	return total, tx.Count(&total).Error
}

func CountActiveUsersSince(since string) (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	tx := db.Model(&model.User{})
	if since != "" {
		tx = tx.Where("last_login_at >= ?", since)
	}
	var total int64
	return total, tx.Count(&total).Error
}

func CountHomeWorks(status model.HomeWorkStatus) (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	tx := db.Model(&model.HomeWork{})
	if status != "" {
		tx = tx.Where("status = ?", status)
	}
	var total int64
	return total, tx.Count(&total).Error
}

func CreditAmountSince(types []model.CreditLogType, since string) (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	tx := db.Model(&model.CreditLog{})
	if len(types) > 0 {
		tx = tx.Where("type IN ?", types)
	}
	if since != "" {
		tx = tx.Where("created_at >= ?", since)
	}
	type row struct {
		Total int64
	}
	var result row
	err = tx.Select("COALESCE(SUM(amount), 0) as total").Scan(&result).Error
	return result.Total, err
}

func PaymentStatsSince(since string) (map[model.PaymentOrderStatus]int64, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	tx := db.Model(&model.PaymentOrder{})
	if since != "" {
		tx = tx.Where("created_at >= ?", since)
	}
	type countRow struct {
		Status model.PaymentOrderStatus
		Total  int64
	}
	var rows []countRow
	if err := tx.Select("status, COUNT(*) as total").Group("status").Scan(&rows).Error; err != nil {
		return nil, 0, err
	}
	result := map[model.PaymentOrderStatus]int64{}
	for _, item := range rows {
		result[item.Status] = item.Total
	}
	amountTx := db.Model(&model.PaymentOrder{}).Where("status = ?", model.PaymentOrderStatusPaid)
	if since != "" {
		amountTx = amountTx.Where("created_at >= ?", since)
	}
	type amountRow struct {
		Total int64
	}
	var amount amountRow
	err = amountTx.Select("COALESCE(SUM(amount), 0) as total").Scan(&amount).Error
	return result, amount.Total, err
}
