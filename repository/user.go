package repository

import (
	"errors"
	"strings"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ListUsers 分页查询用户。
func ListUsers(q model.Query) ([]model.User, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := db.Model(&model.User{})
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where("username LIKE ? OR display_name LIKE ? OR email LIKE ? OR linux_do_id LIKE ? OR google_id LIKE ?", like, like, like, like, like)
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []model.User
	err = tx.Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&users).Error
	return users, total, err
}

// CountUsers 返回用户总数。
func CountUsers() (int64, error) {
	db, err := DB()
	if err != nil {
		return 0, err
	}
	var total int64
	return total, db.Model(&model.User{}).Count(&total).Error
}

// HasAdmin 判断系统中是否存在管理员。
func HasAdmin() (bool, error) {
	db, err := DB()
	if err != nil {
		return false, err
	}
	var total int64
	err = db.Model(&model.User{}).Where("role = ?", model.UserRoleAdmin).Count(&total).Error
	return total > 0, err
}

// GetUserByID 根据 ID 查询用户。
func GetUserByID(id string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "id = ?", id)
}

// GetUserByUsername 根据用户名查询用户。
func GetUserByUsername(username string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "username = ?", username)
}

func GetUserByUsernameOrEmail(value string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	value = strings.TrimSpace(value)
	return findUser(db, "username = ? OR email = ?", value, value)
}

func GetUserByEmail(email string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "email = ?", strings.TrimSpace(email))
}

// SaveUser 保存用户信息。
func SaveUser(user model.User) (model.User, error) {
	db, err := DB()
	if err != nil {
		return user, err
	}
	return user, db.Save(&user).Error
}

func GrantUserCreditBatch(id string, sourceType model.CreditBatchSource, sourceID string, credits int, expiresAt string, now string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	if credits <= 0 {
		user, ok, err := GetUserByID(id)
		return user, ok, err
	}
	var user model.User
	err = db.Transaction(func(tx *gorm.DB) error {
		ok, err := txUserByID(tx, id, &user)
		if err != nil || !ok {
			return err
		}
		if err := ensureUserCreditBatches(tx, user, now); err != nil {
			return err
		}
		if err := expireUserCreditBatches(tx, id, now); err != nil {
			return err
		}
		batch := model.CreditBatch{
			ID:               newRepositoryID("batch"),
			UserID:           id,
			SourceType:       sourceType,
			SourceID:         strings.TrimSpace(sourceID),
			TotalCredits:     credits,
			RemainingCredits: credits,
			ExpiresAt:        strings.TrimSpace(expiresAt),
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		if err := tx.Create(&batch).Error; err != nil {
			return err
		}
		return syncUserCredits(tx, id, now)
	})
	if err != nil {
		return model.User{}, false, err
	}
	user, ok, err := GetUserByID(id)
	return user, ok, err
}

func ConsumeUserCredits(id string, credits int, now string) (model.User, []model.CreditBatchDeduction, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, nil, false, err
	}
	if credits <= 0 {
		user, ok, err := GetUserByID(id)
		return user, nil, ok, err
	}
	var deductions []model.CreditBatchDeduction
	var user model.User
	var ok bool
	err = db.Transaction(func(tx *gorm.DB) error {
		ok, err = txUserByID(tx, id, &user)
		if err != nil || !ok {
			return err
		}
		if err := ensureUserCreditBatches(tx, user, now); err != nil {
			return err
		}
		if err := expireUserCreditBatches(tx, id, now); err != nil {
			return err
		}
		total, err := sumUserRemainingCredits(tx, id)
		if err != nil {
			return err
		}
		if total < credits {
			ok = false
			return nil
		}
		var batches []model.CreditBatch
		err = tx.
			Where("user_id = ? AND remaining_credits > 0", id).
			Order("case when expires_at = '' then 1 else 0 end asc").
			Order("expires_at asc").
			Order("created_at asc").
			Find(&batches).Error
		if err != nil {
			return err
		}
		remain := credits
		for _, batch := range batches {
			if remain <= 0 {
				break
			}
			amount := batch.RemainingCredits
			if amount > remain {
				amount = remain
			}
			nextRemaining := batch.RemainingCredits - amount
			if err := tx.Model(&model.CreditBatch{}).Where("id = ?", batch.ID).Updates(map[string]any{
				"remaining_credits": nextRemaining,
				"updated_at":        now,
			}).Error; err != nil {
				return err
			}
			deductions = append(deductions, model.CreditBatchDeduction{BatchID: batch.ID, SourceType: batch.SourceType, Amount: amount, ExpiresAt: batch.ExpiresAt})
			remain -= amount
		}
		return syncUserCredits(tx, id, now)
	})
	if err != nil {
		return model.User{}, nil, false, err
	}
	if !ok {
		return model.User{}, nil, false, nil
	}
	user, ok, err = GetUserByID(id)
	return user, deductions, ok, err
}

func RefundUserCredits(id string, credits int, now string) (model.User, bool, error) {
	return GrantUserCreditBatch(id, model.CreditBatchSourceRefund, "", credits, "", now)
}

func RefreshUserCredits(id string, now string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	var user model.User
	var ok bool
	err = db.Transaction(func(tx *gorm.DB) error {
		ok, err = txUserByID(tx, id, &user)
		if err != nil || !ok {
			return err
		}
		if err := ensureUserCreditBatches(tx, user, now); err != nil {
			return err
		}
		if err := expireUserCreditBatches(tx, id, now); err != nil {
			return err
		}
		return syncUserCredits(tx, id, now)
	})
	if err != nil || !ok {
		return user, ok, err
	}
	user, ok, err = GetUserByID(id)
	return user, ok, err
}

func txUserByID(tx *gorm.DB, id string, user *model.User) (bool, error) {
	err := tx.Where("id = ?", id).First(user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	return err == nil, err
}

func newRepositoryID(prefix string) string {
	return prefix + "-" + uuid.NewString()
}

func ensureUserCreditBatches(tx *gorm.DB, user model.User, now string) error {
	if user.Credits <= 0 {
		return nil
	}
	total, err := sumUserRemainingCredits(tx, user.ID)
	if err != nil || total >= user.Credits {
		return err
	}
	diff := user.Credits - total
	return tx.Create(&model.CreditBatch{
		ID:               newRepositoryID("batch"),
		UserID:           user.ID,
		SourceType:       model.CreditBatchSourceAdmin,
		SourceID:         "legacy",
		TotalCredits:     diff,
		RemainingCredits: diff,
		CreatedAt:        now,
		UpdatedAt:        now,
	}).Error
}

func expireUserCreditBatches(tx *gorm.DB, userID string, now string) error {
	return tx.Model(&model.CreditBatch{}).
		Where("user_id = ? AND remaining_credits > 0 AND expires_at <> '' AND expires_at <= ?", userID, now).
		Updates(map[string]any{"remaining_credits": 0, "updated_at": now}).Error
}

func sumUserRemainingCredits(tx *gorm.DB, userID string) (int, error) {
	var total int
	err := tx.Model(&model.CreditBatch{}).Where("user_id = ? AND remaining_credits > 0", userID).Select("coalesce(sum(remaining_credits), 0)").Scan(&total).Error
	return total, err
}

func syncUserCredits(tx *gorm.DB, userID string, now string) error {
	total, err := sumUserRemainingCredits(tx, userID)
	if err != nil {
		return err
	}
	return tx.Model(&model.User{}).Where("id = ?", userID).Updates(map[string]any{"credits": total, "updated_at": now}).Error
}

// SaveCreditLog 保存积分变更流水。
func SaveCreditLog(log model.CreditLog) (model.CreditLog, error) {
	db, err := DB()
	if err != nil {
		return log, err
	}
	return log, db.Save(&log).Error
}

func ListCreditLogs(q model.Query) ([]model.CreditLog, int64, error) {
	db, err := DB()
	if err != nil {
		return nil, 0, err
	}
	q.Normalize()
	tx := db.Model(&model.CreditLog{})
	if keyword := strings.TrimSpace(q.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where("user_id LIKE ? OR type LIKE ? OR remark LIKE ? OR related_id LIKE ?", like, like, like, like)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []model.CreditLog
	err = tx.Order("created_at desc").Offset(q.Offset()).Limit(q.PageSize).Find(&logs).Error
	return logs, total, err
}

func DeleteCreditLog(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.CreditLog{}, "id = ?", id).Error
}

// DeleteUser 删除指定用户。
func DeleteUser(id string) error {
	db, err := DB()
	if err != nil {
		return err
	}
	return db.Delete(&model.User{}, "id = ?", id).Error
}

// GetUserByLinuxDoID 根据 Linux.do ID 查询用户。
func GetUserByLinuxDoID(id string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "linux_do_id = ?", id)
}

func GetUserByGoogleID(id string) (model.User, bool, error) {
	db, err := DB()
	if err != nil {
		return model.User{}, false, err
	}
	return findUser(db, "google_id = ?", id)
}

// findUser 查询单个用户，并将未命中转换为 ok=false。
func findUser(db *gorm.DB, query string, args ...any) (model.User, bool, error) {
	user := model.User{}
	err := db.Where(query, args...).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.User{}, false, nil
	}
	return user, err == nil, err
}
