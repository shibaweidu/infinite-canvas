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
