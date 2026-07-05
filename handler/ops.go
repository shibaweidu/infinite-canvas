package handler

import (
	"net/http"
	"strconv"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/service"
)

func AdminOperationLogs(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListAdminOperationLogs(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminErrorLogs(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListErrorLogs(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminSystemTasks(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListSystemTasks(parseQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminTaskLogs(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListTaskLogs(parseTaskLogQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminTaskLogStats(w http.ResponseWriter, r *http.Request) {
	result, err := service.TaskLogStats(parseTaskLogQuery(r))
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminTaskLogDetail(w http.ResponseWriter, r *http.Request, id string) {
	result, err := service.TaskLogDetail(id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminRetryTaskLog(w http.ResponseWriter, r *http.Request, id string) {
	result, err := service.RetryTaskLog(id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminCancelTaskLog(w http.ResponseWriter, r *http.Request, id string) {
	result, err := service.CancelTaskLog(id)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminDatabaseStatus(w http.ResponseWriter, r *http.Request) {
	OK(w, service.DatabaseStatus())
}

func AdminServerStatus(w http.ResponseWriter, r *http.Request) {
	OK(w, service.ServerStatus())
}

func AdminDatabaseBackups(w http.ResponseWriter, r *http.Request) {
	result, err := service.ListDatabaseBackups()
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func AdminCreateDatabaseBackup(w http.ResponseWriter, r *http.Request) {
	user, _ := service.UserFromContext(r.Context())
	result, err := service.EnqueueDatabaseBackup(user)
	if err != nil {
		FailError(w, err)
		return
	}
	OK(w, result)
}

func parseTaskLogQuery(r *http.Request) model.TaskLogQuery {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("pageSize"))
	return model.TaskLogQuery{
		Keyword:     q.Get("keyword"),
		Status:      q.Get("status"),
		Type:        q.Get("type"),
		CreatedFrom: q.Get("createdFrom"),
		CreatedTo:   q.Get("createdTo"),
		Page:        page,
		PageSize:    pageSize,
	}
}
