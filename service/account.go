package service

import (
	"strings"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
)

func ListAnnouncements(q model.Query, admin bool) (model.AnnouncementList, error) {
	items, total, err := repository.ListAnnouncements(q, admin)
	if err != nil {
		return model.AnnouncementList{}, err
	}
	return model.AnnouncementList{Items: items, Total: int(total)}, nil
}

func GetAnnouncement(id string, admin bool) (model.Announcement, error) {
	item, ok, err := repository.GetAnnouncement(strings.TrimSpace(id), admin)
	if err != nil {
		return item, err
	}
	if !ok {
		return item, safeMessageError{message: "公告不存在"}
	}
	return item, nil
}

func SaveAnnouncement(item model.Announcement) (model.Announcement, error) {
	item.ID = strings.TrimSpace(item.ID)
	item.Title = strings.TrimSpace(item.Title)
	item.Summary = strings.TrimSpace(item.Summary)
	item.Content = strings.TrimSpace(item.Content)
	item.PublishedAt = strings.TrimSpace(item.PublishedAt)
	if item.Title == "" {
		return item, safeMessageError{message: "公告标题不能为空"}
	}
	current := now()
	if item.ID == "" {
		item.ID = newID("notice")
		item.CreatedAt = current
	}
	if item.PublishedAt == "" {
		item.PublishedAt = current
	}
	item.UpdatedAt = current
	return repository.SaveAnnouncement(item)
}

func DeleteAnnouncement(id string) error {
	return repository.DeleteAnnouncement(strings.TrimSpace(id))
}

func ListSubscriptionPlans(admin bool) ([]model.SubscriptionPlan, error) {
	return repository.ListSubscriptionPlans(admin)
}

func SaveSubscriptionPlan(item model.SubscriptionPlan) (model.SubscriptionPlan, error) {
	item.ID = strings.TrimSpace(item.ID)
	if item.ID != "" {
		currentItem, ok, err := repository.GetSubscriptionPlan(item.ID)
		if err != nil {
			return item, err
		}
		if ok {
			item.CreatedAt = currentItem.CreatedAt
			if item.Benefits == nil {
				item.Benefits = currentItem.Benefits
			}
		}
	}
	item.Name = strings.TrimSpace(item.Name)
	item.Description = strings.TrimSpace(item.Description)
	item.PriceCycle = strings.TrimSpace(item.PriceCycle)
	item.ButtonText = strings.TrimSpace(item.ButtonText)
	item.CreditLabel = strings.TrimSpace(item.CreditLabel)
	item.CreditRateText = strings.TrimSpace(item.CreditRateText)
	item.Benefits = cleanBillingBenefits(item.Benefits)
	if item.Name == "" {
		return item, safeMessageError{message: "套餐名称不能为空"}
	}
	if item.Price < 0 {
		item.Price = 0
	}
	if item.OriginalPrice < 0 {
		item.OriginalPrice = 0
	}
	if item.Credits < 0 {
		item.Credits = 0
	}
	if item.DurationDays < 0 {
		item.DurationDays = 0
	}
	current := now()
	if item.ID == "" {
		item.ID = newID("plan")
		item.CreatedAt = current
	}
	item.UpdatedAt = current
	return repository.SaveSubscriptionPlan(item)
}

func DeleteSubscriptionPlan(id string) error {
	return repository.DeleteSubscriptionPlan(strings.TrimSpace(id))
}

func ListCreditPackages(admin bool) ([]model.CreditPackage, error) {
	return repository.ListCreditPackages(admin)
}

func SaveCreditPackage(item model.CreditPackage) (model.CreditPackage, error) {
	item.ID = strings.TrimSpace(item.ID)
	if item.ID != "" {
		currentItem, ok, err := repository.GetCreditPackage(item.ID)
		if err != nil {
			return item, err
		}
		if ok {
			item.CreatedAt = currentItem.CreatedAt
			if item.Benefits == nil {
				item.Benefits = currentItem.Benefits
			}
		}
	}
	item.Name = strings.TrimSpace(item.Name)
	item.Description = strings.TrimSpace(item.Description)
	item.PriceCycle = strings.TrimSpace(item.PriceCycle)
	item.ButtonText = strings.TrimSpace(item.ButtonText)
	item.CreditLabel = strings.TrimSpace(item.CreditLabel)
	item.CreditRateText = strings.TrimSpace(item.CreditRateText)
	item.Benefits = cleanBillingBenefits(item.Benefits)
	if item.Name == "" {
		return item, safeMessageError{message: "充值包名称不能为空"}
	}
	if item.Price < 0 {
		item.Price = 0
	}
	if item.OriginalPrice < 0 {
		item.OriginalPrice = 0
	}
	if item.Credits < 0 {
		item.Credits = 0
	}
	if item.BonusCredits < 0 {
		item.BonusCredits = 0
	}
	current := now()
	if item.ID == "" {
		item.ID = newID("pkg")
		item.CreatedAt = current
	}
	item.UpdatedAt = current
	return repository.SaveCreditPackage(item)
}

func cleanBillingBenefits(items []model.BillingBenefit) []model.BillingBenefit {
	result := make([]model.BillingBenefit, 0, len(items))
	for _, item := range items {
		item.Text = strings.TrimSpace(item.Text)
		item.Tag = strings.TrimSpace(item.Tag)
		if item.Text != "" {
			result = append(result, item)
		}
	}
	return result
}

func DeleteCreditPackage(id string) error {
	return repository.DeleteCreditPackage(strings.TrimSpace(id))
}

func AccountSummary(user model.AuthUser) (model.AccountSummary, error) {
	currentUser, ok, err := repository.RefreshUserCredits(user.ID, now())
	if err != nil {
		return model.AccountSummary{}, err
	}
	if ok {
		user = model.PublicUser(currentUser)
	}
	plans, err := repository.ListSubscriptionPlans(false)
	if err != nil {
		return model.AccountSummary{}, err
	}
	packages, err := repository.ListCreditPackages(false)
	if err != nil {
		return model.AccountSummary{}, err
	}
	recharge, err := repository.ListUserCreditLogs(user.ID, []model.CreditLogType{model.CreditLogTypeRecharge, model.CreditLogTypeSubscribe, model.CreditLogTypeAdminAdjust, model.CreditLogTypeAIRefund}, 50)
	if err != nil {
		return model.AccountSummary{}, err
	}
	consume, err := repository.ListUserCreditLogs(user.ID, []model.CreditLogType{model.CreditLogTypeAIConsume}, 50)
	if err != nil {
		return model.AccountSummary{}, err
	}
	sanitizeCreditLogs(recharge)
	sanitizeCreditLogs(consume)
	return model.AccountSummary{User: user, Plans: plans, CreditPackages: packages, RechargeRecords: recharge, ConsumeRecords: consume}, nil
}
