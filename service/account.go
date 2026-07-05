package service

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

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

func GetPaymentSettings() (model.PaymentSettings, error) {
	settings, ok, err := repository.GetPaymentSettings(model.PaymentProviderEPay)
	if err != nil {
		return settings, err
	}
	if !ok {
		settings.Provider = model.PaymentProviderEPay
		settings.PayType = "alipay"
	}
	return hidePaymentKey(settings), nil
}

func SavePaymentSettings(item model.PaymentSettings) (model.PaymentSettings, error) {
	current, ok, err := repository.GetPaymentSettings(model.PaymentProviderEPay)
	if err != nil {
		return item, err
	}
	item.Provider = model.PaymentProviderEPay
	item.GatewayURL = strings.TrimRight(strings.TrimSpace(item.GatewayURL), "/")
	item.PID = strings.TrimSpace(item.PID)
	item.Key = strings.TrimSpace(item.Key)
	item.SiteName = strings.TrimSpace(item.SiteName)
	item.PayType = strings.TrimSpace(item.PayType)
	item.NotifyURL = strings.TrimSpace(item.NotifyURL)
	item.ReturnURL = strings.TrimSpace(item.ReturnURL)
	if item.PayType == "" {
		item.PayType = "alipay"
	}
	if item.Key == "" && ok {
		item.Key = current.Key
	}
	if item.Enabled && (item.GatewayURL == "" || item.PID == "" || item.Key == "") {
		return item, safeMessageError{message: "请先完整填写易支付网关、商户 ID 和商户密钥"}
	}
	currentTime := now()
	if ok {
		item.CreatedAt = current.CreatedAt
	} else {
		item.CreatedAt = currentTime
	}
	item.UpdatedAt = currentTime
	saved, err := repository.SavePaymentSettings(item)
	return hidePaymentKey(saved), err
}

func CreatePaymentOrder(user model.AuthUser, orderType model.PaymentOrderType, itemID string, r *http.Request) (model.PaymentCreateResult, error) {
	settings, ok, err := repository.GetPaymentSettings(model.PaymentProviderEPay)
	if err != nil {
		return model.PaymentCreateResult{}, err
	}
	if !ok || !settings.Enabled {
		return model.PaymentCreateResult{}, safeMessageError{message: "支付暂未开启"}
	}
	if settings.GatewayURL == "" || settings.PID == "" || settings.Key == "" {
		return model.PaymentCreateResult{}, safeMessageError{message: "支付配置未完成"}
	}
	order, err := buildPaymentOrder(user.ID, orderType, strings.TrimSpace(itemID))
	if err != nil {
		return model.PaymentCreateResult{}, err
	}
	current := now()
	order.ID = newID("pay")
	order.Provider = model.PaymentProviderEPay
	order.Status = model.PaymentOrderStatusPending
	order.CreatedAt = current
	order.UpdatedAt = current
	order, err = repository.SavePaymentOrder(order)
	if err != nil {
		return model.PaymentCreateResult{}, err
	}
	return model.PaymentCreateResult{Order: order, PayURL: buildEPayURL(settings, order, r)}, nil
}

func HandleEPayNotify(values url.Values) error {
	settings, ok, err := repository.GetPaymentSettings(model.PaymentProviderEPay)
	if err != nil {
		return err
	}
	if !ok || settings.Key == "" {
		return safeMessageError{message: "支付配置不存在"}
	}
	params := valuesToMap(values)
	if !verifyEPaySign(params, settings.Key) {
		return safeMessageError{message: "支付签名校验失败"}
	}
	if !isEPaySuccess(params) {
		return safeMessageError{message: "支付未成功"}
	}
	orderID := strings.TrimSpace(params["out_trade_no"])
	order, ok, err := repository.GetPaymentOrder(orderID)
	if err != nil {
		return err
	}
	if !ok {
		return safeMessageError{message: "支付订单不存在"}
	}
	if order.Status == model.PaymentOrderStatusPaid {
		return nil
	}
	if amount, ok := parseEPayMoney(params["money"]); ok && amount != order.Amount {
		return safeMessageError{message: "支付金额不匹配"}
	}
	paidAt := now()
	changed, err := repository.MarkPaymentOrderPaid(order.ID, firstNonEmpty(params["trade_no"], params["api_trade_no"]), paidAt)
	if err != nil || !changed {
		return err
	}
	return grantPaymentOrderCredits(order, paidAt)
}

func PaymentReturnURL(r *http.Request) string {
	return RequestOrigin(r) + "/account?payment=success"
}

func hidePaymentKey(item model.PaymentSettings) model.PaymentSettings {
	item.HasKey = strings.TrimSpace(item.Key) != ""
	item.Key = ""
	return item
}

func buildPaymentOrder(userID string, orderType model.PaymentOrderType, itemID string) (model.PaymentOrder, error) {
	if userID == "" {
		return model.PaymentOrder{}, safeMessageError{message: "请先登录"}
	}
	if itemID == "" {
		return model.PaymentOrder{}, safeMessageError{message: "请选择支付项目"}
	}
	switch orderType {
	case model.PaymentOrderTypeSubscription:
		item, ok, err := repository.GetSubscriptionPlan(itemID)
		if err != nil || !ok {
			if err != nil {
				return model.PaymentOrder{}, err
			}
			return model.PaymentOrder{}, safeMessageError{message: "订阅套餐不存在"}
		}
		if !item.Enabled {
			return model.PaymentOrder{}, safeMessageError{message: "订阅套餐已关闭"}
		}
		return model.PaymentOrder{UserID: userID, Type: orderType, ItemID: item.ID, ItemName: item.Name, Amount: item.Price, Credits: item.Credits, DurationDays: item.DurationDays}, nil
	case model.PaymentOrderTypeCredit:
		item, ok, err := repository.GetCreditPackage(itemID)
		if err != nil || !ok {
			if err != nil {
				return model.PaymentOrder{}, err
			}
			return model.PaymentOrder{}, safeMessageError{message: "积分充值项不存在"}
		}
		if !item.Enabled {
			return model.PaymentOrder{}, safeMessageError{message: "积分充值项已关闭"}
		}
		return model.PaymentOrder{UserID: userID, Type: orderType, ItemID: item.ID, ItemName: item.Name, Amount: item.Price, Credits: item.Credits, BonusCredits: item.BonusCredits}, nil
	default:
		return model.PaymentOrder{}, safeMessageError{message: "支付类型不正确"}
	}
}

func buildEPayURL(settings model.PaymentSettings, order model.PaymentOrder, r *http.Request) string {
	params := map[string]string{
		"pid":          settings.PID,
		"type":         settings.PayType,
		"out_trade_no": order.ID,
		"notify_url":   firstNonEmpty(settings.NotifyURL, RequestOrigin(r)+"/api/payment/epay/notify"),
		"return_url":   firstNonEmpty(settings.ReturnURL, PaymentReturnURL(r)),
		"name":         order.ItemName,
		"money":        formatMoney(order.Amount),
		"sitename":     settings.SiteName,
	}
	params["sign"] = epaySign(params, settings.Key)
	params["sign_type"] = "MD5"
	values := url.Values{}
	for key, value := range params {
		if strings.TrimSpace(value) != "" {
			values.Set(key, value)
		}
	}
	return strings.TrimRight(settings.GatewayURL, "/") + "/submit.php?" + values.Encode()
}

func grantPaymentOrderCredits(order model.PaymentOrder, paidAt string) error {
	var user model.User
	var err error
	amount := order.Credits
	switch order.Type {
	case model.PaymentOrderTypeSubscription:
		expiresAt := ""
		if order.DurationDays > 0 {
			expiresAt = time.Now().AddDate(0, 0, order.DurationDays).Format(time.RFC3339)
		}
		user, err = GrantSubscriptionCredits(order.UserID, order.ItemID, order.Credits, expiresAt)
	case model.PaymentOrderTypeCredit:
		amount += order.BonusCredits
		user, err = GrantRechargeCredits(order.UserID, order.ItemID, order.Credits, order.BonusCredits)
	default:
		return safeMessageError{message: "支付订单类型不正确"}
	}
	if err != nil {
		return err
	}
	extra, _ := json.Marshal(map[string]any{"orderId": order.ID, "itemId": order.ItemID, "itemName": order.ItemName})
	_, err = repository.SaveCreditLog(model.CreditLog{
		ID:        newID("credit"),
		UserID:    order.UserID,
		Type:      paymentCreditLogType(order.Type),
		Amount:    amount,
		Balance:   user.Credits,
		RelatedID: order.ID,
		Remark:    order.ItemName,
		Extra:     string(extra),
		CreatedAt: paidAt,
	})
	return err
}

func paymentCreditLogType(orderType model.PaymentOrderType) model.CreditLogType {
	if orderType == model.PaymentOrderTypeSubscription {
		return model.CreditLogTypeSubscribe
	}
	return model.CreditLogTypeRecharge
}

func valuesToMap(values url.Values) map[string]string {
	result := map[string]string{}
	for key, value := range values {
		if len(value) > 0 {
			result[key] = strings.TrimSpace(value[0])
		}
	}
	return result
}

func verifyEPaySign(params map[string]string, key string) bool {
	return strings.EqualFold(strings.TrimSpace(params["sign"]), epaySign(params, key))
}

func epaySign(params map[string]string, key string) string {
	keys := make([]string, 0, len(params))
	for name, value := range params {
		if name == "sign" || name == "sign_type" || strings.TrimSpace(value) == "" {
			continue
		}
		keys = append(keys, name)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, name := range keys {
		parts = append(parts, name+"="+params[name])
	}
	sum := md5.Sum([]byte(strings.Join(parts, "&") + key))
	return hex.EncodeToString(sum[:])
}

func isEPaySuccess(params map[string]string) bool {
	status := strings.ToUpper(strings.TrimSpace(firstNonEmpty(params["trade_status"], params["status"])))
	return status == "TRADE_SUCCESS" || status == "SUCCESS" || status == "1"
}

func parseEPayMoney(value string) (int, bool) {
	amount, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return 0, false
	}
	return int(amount*100 + 0.5), true
}

func formatMoney(value int) string {
	return fmt.Sprintf("%.2f", float64(value)/100)
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

func AccountTasks(user model.AuthUser, q model.TaskLogQuery) (model.AccountTaskList, error) {
	if strings.TrimSpace(user.ID) == "" {
		return model.AccountTaskList{}, safeMessageError{message: "请先登录"}
	}
	items, total, err := repository.ListUserTaskLogs(user.ID, q)
	if err != nil {
		return model.AccountTaskList{}, err
	}
	result := make([]model.AccountTaskItem, 0, len(items))
	for _, item := range items {
		result = append(result, accountTaskItem(item, false))
	}
	return model.AccountTaskList{Items: result, Total: int(total)}, nil
}

func AccountTask(user model.AuthUser, id string) (model.AccountTaskItem, error) {
	task, err := accountTaskByID(user, id)
	if err != nil {
		return model.AccountTaskItem{}, err
	}
	return accountTaskItem(task, true), nil
}

func RetryAccountTask(user model.AuthUser, id string) (model.AccountTaskItem, error) {
	task, err := accountTaskByID(user, id)
	if err != nil {
		return model.AccountTaskItem{}, err
	}
	if task.Status != model.SystemTaskStatusFailed && task.Status != model.SystemTaskStatusCanceled {
		return model.AccountTaskItem{}, safeMessageError{message: "只有失败或已取消的任务可以重试"}
	}
	now := time.Now().Format(time.RFC3339)
	next := model.SystemTask{
		ID:        newID("task"),
		Type:      task.Type,
		Status:    model.SystemTaskStatusPending,
		Title:     task.Title,
		Payload:   resetTaskPayloadForRetry(task.Payload, task.ID),
		CreatedBy: user.ID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := repository.SaveSystemTask(next); err != nil {
		return model.AccountTaskItem{}, err
	}
	return accountTaskItem(next, true), nil
}

func CancelAccountTask(user model.AuthUser, id string) (model.AccountTaskItem, error) {
	task, err := accountTaskByID(user, id)
	if err != nil {
		return model.AccountTaskItem{}, err
	}
	if task.Status != model.SystemTaskStatusPending {
		return model.AccountTaskItem{}, safeMessageError{message: "只有排队中的任务可以取消"}
	}
	now := time.Now().Format(time.RFC3339)
	task.Status = model.SystemTaskStatusCanceled
	task.FinishedAt = now
	task.UpdatedAt = now
	task.Error = "用户取消任务"
	if err := repository.SaveSystemTask(task); err != nil {
		return model.AccountTaskItem{}, err
	}
	return accountTaskItem(task, true), nil
}

func accountTaskByID(user model.AuthUser, id string) (model.SystemTask, error) {
	if strings.TrimSpace(user.ID) == "" {
		return model.SystemTask{}, safeMessageError{message: "请先登录"}
	}
	task, ok, err := repository.GetSystemTaskByID(strings.TrimSpace(id))
	if err != nil {
		return model.SystemTask{}, err
	}
	if !ok || task.CreatedBy != user.ID {
		return model.SystemTask{}, safeMessageError{message: "任务不存在"}
	}
	return task, nil
}

func accountTaskItem(task model.SystemTask, includeDetail bool) model.AccountTaskItem {
	item := buildTaskLogItem(task, false)
	result := parseTaskResult(task.Result)
	next := model.AccountTaskItem{
		ID:              item.ID,
		Type:            item.Type,
		TypeLabel:       item.TypeLabel,
		Status:          item.Status,
		StatusLabel:     item.StatusLabel,
		Title:           item.Title,
		Model:           sanitizeModelName(item.Model),
		Credits:         item.Credits,
		Progress:        item.Progress,
		CreatedAt:       item.CreatedAt,
		StartedAt:       item.StartedAt,
		FinishedAt:      item.FinishedAt,
		DurationMs:      item.DurationMs,
		QueueDurationMs: item.QueueDurationMs,
		RunDurationMs:   item.RunDurationMs,
		Summary:         sanitizeModelEndpointText(item.Summary),
		Error:           sanitizeModelEndpointText(item.Error),
		ResultLinks:     accountTaskResultLinks(result),
	}
	if includeDetail {
		payload := parseTaskPayload(task.Payload)
		next.Timeline = taskTimeline(task, payload, result)
		for i := range next.Timeline {
			next.Timeline[i].Description = sanitizeModelEndpointText(next.Timeline[i].Description)
		}
	}
	return next
}

func accountTaskResultLinks(result AITaskResult) []model.TaskLogLink {
	links := taskResultLinks(result)
	if len(links) == 0 {
		return links
	}
	settings, err := repository.GetSettings()
	if err != nil {
		return links
	}
	blocked := []string{}
	for _, channel := range normalizePrivateSetting(settings.Private).Channels {
		if baseURL := normalizeModelChannelBaseURL(channel.BaseURL); baseURL != "" {
			blocked = append(blocked, strings.ToLower(strings.TrimRight(baseURL, "/")))
		}
	}
	resultLinks := make([]model.TaskLogLink, 0, len(links))
	for _, link := range links {
		lowerURL := strings.ToLower(strings.TrimSpace(link.URL))
		hidden := false
		for _, baseURL := range blocked {
			if baseURL != "" && strings.HasPrefix(lowerURL, baseURL) {
				hidden = true
				break
			}
		}
		if !hidden {
			resultLinks = append(resultLinks, link)
		}
	}
	return resultLinks
}
