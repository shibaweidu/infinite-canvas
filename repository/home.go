package repository

import (
	"errors"
	"strings"

	"github.com/basketikun/infinite-canvas/model"
	"gorm.io/gorm"
)

func ListHomeSlides(admin bool) ([]model.HomeSlide, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	tx := db.Model(&model.HomeSlide{})
	if !admin {
		tx = tx.Where("enabled = ?", true)
	}
	var items []model.HomeSlide
	err = tx.Order("sort asc").Order("published_at desc").Order("created_at desc").Find(&items).Error
	return items, err
}

func SaveHomeSlide(item model.HomeSlide) (model.HomeSlide, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func DeleteHomeSlide(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.HomeSlide{}, "id = ?", id).Error
}

func ListHomeWorks(q model.Query, admin bool, status string) ([]model.HomeWork, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := db.Model(&model.HomeWork{})
	if admin {
		if status != "" && status != "all" {
			tx = tx.Where("status = ?", status)
		}
	} else {
		tx = tx.Where("status = ?", model.HomeWorkStatusPublished)
	}
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where("title LIKE ? OR description LIKE ? OR prompt LIKE ?", like, like, like)
	}
	if q.Category != "" && q.Category != "all" {
		tx = tx.Where("category = ?", q.Category)
	}
	if q.Type != "" && q.Type != "all" {
		tx = tx.Where("type = ?", q.Type)
	}
	tx = applyHomeWorkTagsFilter(tx, q.Tags)
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []model.HomeWork
	err = tx.Order("sort asc").Order("published_at desc").Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&items).Error
	return items, total, err
}

func GetHomeWork(id string, admin bool) (model.HomeWork, bool, error) {
	db, err := DB()
	if err != nil {
		return model.HomeWork{}, false, err
	}
	tx := db.Where("id = ?", id)
	if !admin {
		tx = tx.Where("status = ?", model.HomeWorkStatusPublished)
	}
	var item model.HomeWork
	err = tx.First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return item, false, nil
	}
	return item, err == nil, err
}

func SaveHomeWork(item model.HomeWork) (model.HomeWork, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func DeleteHomeWork(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.HomeWork{}, "id = ?", id).Error
}

func ListHomeCategories(admin bool) ([]model.HomeCategory, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	tx := db.Model(&model.HomeCategory{})
	if !admin {
		tx = tx.Where("enabled = ?", true)
	}
	var items []model.HomeCategory
	err = tx.Order("sort asc").Order("created_at desc").Find(&items).Error
	return items, err
}

func SaveHomeCategory(item model.HomeCategory) (model.HomeCategory, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func DeleteHomeCategory(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.HomeCategory{}, "id = ?", id).Error
}

func ListHomeTags(admin bool) ([]model.HomeTag, error) {
	db, err := DB()
	if err != nil {
		return nil, err
	}
	tx := db.Model(&model.HomeTag{})
	if !admin {
		tx = tx.Where("enabled = ?", true)
	}
	var items []model.HomeTag
	err = tx.Order("sort asc").Order("created_at desc").Find(&items).Error
	return items, err
}

func SaveHomeTag(item model.HomeTag) (model.HomeTag, error) {
	db, err := DB()
	if err != nil {
		return item, err
	}
	return item, db.Save(&item).Error
}

func DeleteHomeTag(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.HomeTag{}, "id = ?", id).Error
}

func applyHomeWorkTagsFilter(tx *gorm.DB, tags []string) *gorm.DB {
	if len(tags) == 0 {
		return tx
	}
	condition := tx.Session(&gorm.Session{NewDB: true})
	for _, tag := range tags {
		condition = condition.Or(homeWorkJSONTagsContains(tx), tag)
	}
	return tx.Where(condition)
}

func homeWorkJSONTagsContains(tx *gorm.DB) string {
	switch tx.Dialector.Name() {
	case "mysql":
		return "JSON_CONTAINS(tags, JSON_QUOTE(?))"
	case "postgres":
		return "jsonb_exists(tags::jsonb, ?)"
	default:
		return "EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)"
	}
}

