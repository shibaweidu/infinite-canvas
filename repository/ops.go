package repository

import (
	"errors"

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
