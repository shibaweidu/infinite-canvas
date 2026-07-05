package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/service"
)

const announcementImageMaxBytes = 10 << 20
const adminHomeMediaMaxBytes = 120 << 20

type paymentOrderRequest struct {
	Type   model.PaymentOrderType `json:"type"`
	ItemID string                 `json:"itemId"`
}

func Announcements(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListAnnouncements(parseQuery(r), false)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func Announcement(w http.ResponseWriter, r *http.Request, id string) {
	result, err := service.GetAnnouncement(id, false)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AccountSummary(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	result, err := service.AccountSummary(user)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AccountTasks(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	result, err := service.AccountTasks(user, parseTaskLogQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AccountTask(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	result, err := service.AccountTask(user, id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func RetryAccountTask(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	result, err := service.RetryAccountTask(user, id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func CancelAccountTask(w http.ResponseWriter, r *http.Request, id string) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	result, err := service.CancelAccountTask(user, id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func SubscriptionPlans(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListSubscriptionPlans(false)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func CreditPackages(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListCreditPackages(false)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func CreatePaymentOrder(w http.ResponseWriter, r *http.Request) {
	user, ok := service.UserFromContext(r.Context())
	if !ok || user.ID == "" {
		Fail(w, "请先登录")
		return
	}
	var payload paymentOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.CreatePaymentOrder(user, payload.Type, payload.ItemID, r)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func EPayNotify(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("fail"))
		return
	}
	if err := service.HandleEPayNotify(r.Form); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte("fail"))
		return
	}
	_, _ = w.Write([]byte("success"))
}

func EPayReturn(w http.ResponseWriter, r *http.Request) {
	http.Redirect(w, r, service.PaymentReturnURL(r), http.StatusFound)
}

func AdminAnnouncements(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListAnnouncements(parseQuery(r), true)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSaveAnnouncement(w http.ResponseWriter, r *http.Request) {
	var item model.Announcement
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.SaveAnnouncement(item)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminDeleteAnnouncement(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteAnnouncement(id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func AdminUploadAnnouncementImage(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, announcementImageMaxBytes+1)
	if err := r.ParseMultipartForm(announcementImageMaxBytes); err != nil {
		Fail(w, "图片过大或上传格式不正确")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		Fail(w, "请上传图片")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil || len(data) == 0 {
		Fail(w, "图片读取失败")
		return
	}
	if len(data) > announcementImageMaxBytes {
		Fail(w, "图片不能超过 10MB")
		return
	}
	mimeType := strings.TrimSpace(strings.Split(header.Header.Get("Content-Type"), ";")[0])
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}
	result, err := service.UploadAnnouncementImage(header.Filename, mimeType, data)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminUploadHomeMedia(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, adminHomeMediaMaxBytes+1)
	if err := r.ParseMultipartForm(adminHomeMediaMaxBytes); err != nil {
		Fail(w, "媒体文件过大或上传格式不正确")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		Fail(w, "请上传图片、动图或视频")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil || len(data) == 0 {
		Fail(w, "媒体文件读取失败")
		return
	}
	if len(data) > adminHomeMediaMaxBytes {
		Fail(w, "媒体文件不能超过 120MB")
		return
	}
	mimeType := strings.TrimSpace(strings.Split(header.Header.Get("Content-Type"), ";")[0])
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}
	result, err := service.UploadHomeMedia(header.Filename, mimeType, data)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSubscriptionPlans(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListSubscriptionPlans(true)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSaveSubscriptionPlan(w http.ResponseWriter, r *http.Request) {
	var item model.SubscriptionPlan
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.SaveSubscriptionPlan(item)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminDeleteSubscriptionPlan(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteSubscriptionPlan(id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func AdminCreditPackages(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListCreditPackages(true)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminPaymentSettings(w http.ResponseWriter, r *http.Request) {
	result, err := service.GetPaymentSettings()
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSavePaymentSettings(w http.ResponseWriter, r *http.Request) {
	var item model.PaymentSettings
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.SavePaymentSettings(item)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSaveCreditPackage(w http.ResponseWriter, r *http.Request) {
	var item model.CreditPackage
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.SaveCreditPackage(item)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminDeleteCreditPackage(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteCreditPackage(id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}
