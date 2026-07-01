package repository

import (
	"errors"
	"strings"

	"github.com/basketikun/infinite-canvas/model"
	"gorm.io/gorm"
)

func ListAnnouncements(q model.Query, admin bool) ([]model.Announcement, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := db.Model(&model.Announcement{})
	if !admin {
		tx = tx.Where("enabled = ?", true)
	}
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where("title LIKE ? OR summary LIKE ? OR content LIKE ?", like, like, like)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.Announcement
	err = tx.Order("pinned desc").Order("sort asc").Order("published_at desc").Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return items, total, err
}

func GetAnnouncement(id string, admin bool) (model.Announcement, bool, error) {
	db, err := DB()
	if err != nil {
		return model.Announcement{}, false, err
	}
	tx := db.Where("id = ?", id)
	if !admin {
		tx = tx.Where("enabled = ?", true)
	}
	var item model.Announcement
	err = tx.First(&item).Error
	if err != nil {
		return item, false, ignoreAccountNotFound(err)
	}
	return item, true, nil
}

func SaveAnnouncement(item model.Announcement) (model.Announcement, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func DeleteAnnouncement(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.Announcement{}, "id = ?", id).Error
}

func ListSubscriptionPlans(admin bool) ([]model.SubscriptionPlan, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	tx := db.Model(&model.SubscriptionPlan{})
	if !admin {
		tx = tx.Where("enabled = ?", true)
	}
	var items []model.SubscriptionPlan
	err = tx.Order("sort asc").Order("created_at desc").Find(&items).Error
	return items, err
}

func GetSubscriptionPlan(id string) (model.SubscriptionPlan, bool, error) {
	db, err := DB()
	if err != nil {
		return model.SubscriptionPlan{}, false, err
	}
	var item model.SubscriptionPlan
	err = db.Where("id = ?", id).First(&item).Error
	if err != nil {
		return item, false, ignoreAccountNotFound(err)
	}
	return item, true, nil
}

func SaveSubscriptionPlan(item model.SubscriptionPlan) (model.SubscriptionPlan, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func DeleteSubscriptionPlan(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.SubscriptionPlan{}, "id = ?", id).Error
}

func ListCreditPackages(admin bool) ([]model.CreditPackage, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	tx := db.Model(&model.CreditPackage{})
	if !admin {
		tx = tx.Where("enabled = ?", true)
	}
	var items []model.CreditPackage
	err = tx.Order("sort asc").Order("created_at desc").Find(&items).Error
	return items, err
}

func GetCreditPackage(id string) (model.CreditPackage, bool, error) {
	db, err := DB()
	if err != nil {
		return model.CreditPackage{}, false, err
	}
	var item model.CreditPackage
	err = db.Where("id = ?", id).First(&item).Error
	if err != nil {
		return item, false, ignoreAccountNotFound(err)
	}
	return item, true, nil
}

func SaveCreditPackage(item model.CreditPackage) (model.CreditPackage, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func DeleteCreditPackage(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.CreditPackage{}, "id = ?", id).Error
}

func ListUserCreditLogs(userID string, types []model.CreditLogType, limit int) ([]model.CreditLog, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	tx := db.Model(&model.CreditLog{}).Where("user_id = ?", userID)
	if len(types) > 0 {
		tx = tx.Where("type IN ?", types)
	}
	if limit <= 0 {
		limit = 20
	}
	var logs []model.CreditLog
	err = tx.Order("created_at desc").Limit(limit).Find(&logs).Error
	return logs, err
}

func ignoreAccountNotFound(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	return err
}
