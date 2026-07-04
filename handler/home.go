package handler

import (
	"encoding/json"
	"net/http"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/service"
)

func HomeSlides(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListHomeSlides(false)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func HomeWorks(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListHomeWorks(parseQuery(r), false, "")
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func HomeWork(w http.ResponseWriter, r *http.Request, id string) {
	result, err := service.GetHomeWork(id, false)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminHomeSlides(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListHomeSlides(true)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSaveHomeSlide(w http.ResponseWriter, r *http.Request) {
	var item model.HomeSlide
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.SaveHomeSlide(item)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminDeleteHomeSlide(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteHomeSlide(id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func AdminHomeWorks(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListHomeWorks(parseQuery(r), true, r.URL.Query().Get("status"))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSaveHomeWork(w http.ResponseWriter, r *http.Request) {
	var item model.HomeWork
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.SaveHomeWork(item)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

type adminImportHomeWorkRequest struct {
	URL   string `json:"url"`
	Model string `json:"model"`
}

func AdminImportHomeWork(w http.ResponseWriter, r *http.Request) {
	var request adminImportHomeWorkRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.ImportHomeWorkFromURL(request.URL, request.Model)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminDeleteHomeWork(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteHomeWork(id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func AdminHomeCategories(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListHomeCategories(true)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSaveHomeCategory(w http.ResponseWriter, r *http.Request) {
	var item model.HomeCategory
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.SaveHomeCategory(item)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminDeleteHomeCategory(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteHomeCategory(id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}

func AdminHomeTags(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListHomeTags(true)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSaveHomeTag(w http.ResponseWriter, r *http.Request) {
	var item model.HomeTag
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		Fail(w, "请求参数错误")
		return
	}
	result, err := service.SaveHomeTag(item)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminDeleteHomeTag(w http.ResponseWriter, r *http.Request, id string) {
	if err := service.DeleteHomeTag(id); err != nil {
		FailError(w, err)
		return
	}
	OK(w, true)
}
