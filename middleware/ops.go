package middleware

import (
	"fmt"
	"runtime/debug"
	"time"

	"github.com/basketikun/infinite-canvas/handler"
	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/service"
	"github.com/gin-gonic/gin"
)

func AdminOperationLogger(c *gin.Context) {
	start := time.Now()
	c.Next()
	if c.Request.Method == "GET" {
		return
	}
	user, _ := service.UserFromContext(c.Request.Context())
	service.RecordAdminOperation(model.AdminOperationLog{
		UserID:    user.ID,
		Username:  user.Username,
		Method:    c.Request.Method,
		Path:      c.FullPath(),
		Query:     c.Request.URL.RawQuery,
		IP:        c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
		Status:    c.Writer.Status(),
		Duration:  time.Since(start).Milliseconds(),
	})
}

func RequestMonitor(c *gin.Context) {
	start := time.Now()
	c.Next()
	path := c.FullPath()
	if path == "" {
		path = c.Request.URL.Path
	}
	if path == "/api/admin/ops/dashboard" {
		return
	}
	service.RecordHTTPRequest(c.Request.Method, path, c.Writer.Status(), time.Since(start).Milliseconds())
}

func ErrorRecovery(c *gin.Context) {
	defer func() {
		if recovered := recover(); recovered != nil {
			user, _ := service.UserFromContext(c.Request.Context())
			service.RecordErrorLog(model.ErrorLog{
				Source:    "panic",
				Message:   fmt.Sprint(recovered),
				Detail:    string(debug.Stack()),
				Method:    c.Request.Method,
				Path:      c.FullPath(),
				UserID:    user.ID,
				IP:        c.ClientIP(),
				UserAgent: c.Request.UserAgent(),
			})
			handler.Fail(c.Writer, "操作失败")
			c.Abort()
		}
	}()
	c.Next()
}
