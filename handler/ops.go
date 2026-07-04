package handler

import (
	"net/http"

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
