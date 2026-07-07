package router

import (
	"net/http"

	"github.com/basketikun/infinite-canvas/handler"
	"github.com/basketikun/infinite-canvas/middleware"
	"github.com/gin-gonic/gin"
)

func New() *gin.Engine {
	router := gin.Default()
	router.Use(middleware.ErrorRecovery)
	router.Use(middleware.RequestMonitor)
	router.RedirectTrailingSlash = false
	_ = router.SetTrustedProxies(nil)
	api := router.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})
	api.POST("/auth/register", gin.WrapF(handler.Register))
	api.POST("/auth/email-code", gin.WrapF(handler.SendRegisterEmailCode))
	api.POST("/auth/login", gin.WrapF(handler.Login))
	api.GET("/auth/linux-do/authorize", gin.WrapF(handler.LinuxDoAuthorize))
	api.GET("/auth/linux-do/callback", gin.WrapF(handler.LinuxDoCallback))
	api.GET("/auth/google/authorize", gin.WrapF(handler.GoogleAuthorize))
	api.GET("/auth/google/callback", gin.WrapF(handler.GoogleCallback))
	api.GET("/auth/me", middleware.OptionalAuth, gin.WrapF(handler.CurrentUser))
	api.GET("/settings", gin.WrapF(handler.Settings))
	api.GET("/announcements", gin.WrapF(handler.Announcements))
	api.GET("/announcements/:id", func(c *gin.Context) {
		handler.Announcement(c.Writer, c.Request, c.Param("id"))
	})
	api.GET("/home/slides", gin.WrapF(handler.HomeSlides))
	api.GET("/home/works", gin.WrapF(handler.HomeWorks))
	api.GET("/home/works/:id", func(c *gin.Context) {
		handler.HomeWork(c.Writer, c.Request, c.Param("id"))
	})
	api.GET("/media/references/:id", func(c *gin.Context) {
		handler.ReferenceMedia(c.Writer, c.Request, c.Param("id"))
	})
	api.HEAD("/media/references/:id", func(c *gin.Context) {
		handler.ReferenceMedia(c.Writer, c.Request, c.Param("id"))
	})
	v1 := api.Group("/v1", middleware.UserAuth)
	v1.POST("/images/generations", gin.WrapF(handler.AIImagesGenerations))
	v1.POST("/images/edits", gin.WrapF(handler.AIImagesEdits))
	v1.POST("/ai-tasks/images/generations", gin.WrapF(handler.AIImageGenerationTask))
	v1.POST("/ai-tasks/images/edits", gin.WrapF(handler.AIImageEditTask))
	v1.POST("/ai-tasks/videos", gin.WrapF(handler.AIVideoTask))
	v1.GET("/ai-tasks/:id", func(c *gin.Context) {
		handler.AISystemTask(c.Writer, c.Request, c.Param("id"))
	})
	v1.POST("/chat/completions", gin.WrapF(handler.AIChatCompletions))
	v1.POST("/responses", func(c *gin.Context) {
		handler.AIProxyPost(c.Writer, c.Request, "/responses")
	})
	v1.POST("/audio/speech", gin.WrapF(handler.AIAudioSpeech))
	v1.POST("/videos", gin.WrapF(handler.AIVideos))
	v1.POST("/v1/videos", func(c *gin.Context) {
		handler.AIProxyPost(c.Writer, c.Request, "/v1/videos")
	})
	v1.POST("/video/generations", func(c *gin.Context) {
		handler.AIProxyPost(c.Writer, c.Request, "/video/generations")
	})
	v1.POST("/v1/video/create", func(c *gin.Context) {
		handler.AIProxyPost(c.Writer, c.Request, "/v1/video/create")
	})
	v1.POST("/video/create", func(c *gin.Context) {
		handler.AIProxyPost(c.Writer, c.Request, "/video/create")
	})
	v1.POST("/v1/async/generations", func(c *gin.Context) {
		handler.AIProxyPost(c.Writer, c.Request, "/v1/async/generations")
	})
	v1.POST("/async/generations", func(c *gin.Context) {
		handler.AIProxyPost(c.Writer, c.Request, "/async/generations")
	})
	v1.POST("/media/references", gin.WrapF(handler.UploadReferenceMedia))
	v1.GET("/videos/:id", func(c *gin.Context) {
		handler.AIVideo(c.Writer, c.Request, c.Param("id"))
	})
	v1.GET("/v1/videos/:id", func(c *gin.Context) {
		handler.AIProxyGet(c.Writer, c.Request, "/v1/videos/"+c.Param("id"))
	})
	v1.GET("/video/generations/:id", func(c *gin.Context) {
		handler.AIProxyGet(c.Writer, c.Request, "/video/generations/"+c.Param("id"))
	})
	v1.GET("/v1/video/generations/:id", func(c *gin.Context) {
		handler.AIProxyGet(c.Writer, c.Request, "/v1/video/generations/"+c.Param("id"))
	})
	v1.GET("/video/tasks/:id", func(c *gin.Context) {
		handler.AIProxyGet(c.Writer, c.Request, "/video/tasks/"+c.Param("id"))
	})
	v1.GET("/v1/video/tasks/:id", func(c *gin.Context) {
		handler.AIProxyGet(c.Writer, c.Request, "/v1/video/tasks/"+c.Param("id"))
	})
	v1.GET("/tasks/:id", func(c *gin.Context) {
		handler.AIProxyGet(c.Writer, c.Request, "/tasks/"+c.Param("id"))
	})
	v1.GET("/v1/tasks/:id", func(c *gin.Context) {
		handler.AIProxyGet(c.Writer, c.Request, "/v1/tasks/"+c.Param("id"))
	})
	v1.GET("/v1/async/generations/:id", func(c *gin.Context) {
		handler.AIProxyGet(c.Writer, c.Request, "/v1/async/generations/"+c.Param("id"))
	})
	v1.GET("/async/generations/:id", func(c *gin.Context) {
		handler.AIProxyGet(c.Writer, c.Request, "/async/generations/"+c.Param("id"))
	})
	v1.GET("/video/query", func(c *gin.Context) {
		handler.AIProxyGet(c.Writer, c.Request, "/video/query")
	})
	v1.GET("/v1/video/query", func(c *gin.Context) {
		handler.AIProxyGet(c.Writer, c.Request, "/v1/video/query")
	})
	v1.GET("/videos/:id/content", func(c *gin.Context) {
		handler.AIVideoContent(c.Writer, c.Request, c.Param("id"))
	})
	api.GET("/prompts", middleware.OptionalAuth, gin.WrapF(handler.Prompts))
	api.GET("/assets", middleware.OptionalAuth, gin.WrapF(handler.Assets))
	api.GET("/account/summary", middleware.UserAuth, gin.WrapF(handler.AccountSummary))
	api.GET("/account/styles", middleware.UserAuth, gin.WrapF(handler.AccountStyles))
	api.POST("/account/styles", middleware.UserAuth, gin.WrapF(handler.SaveAccountStyle))
	api.POST("/account/styles/images", middleware.UserAuth, gin.WrapF(handler.UploadAccountStyleImage))
	api.DELETE("/account/styles/:id", middleware.UserAuth, func(c *gin.Context) {
		handler.DeleteAccountStyle(c.Writer, c.Request, c.Param("id"))
	})
	api.GET("/account/tasks", middleware.UserAuth, gin.WrapF(handler.AccountTasks))
	api.GET("/account/tasks/:id", middleware.UserAuth, func(c *gin.Context) {
		handler.AccountTask(c.Writer, c.Request, c.Param("id"))
	})
	api.POST("/account/tasks/:id/retry", middleware.UserAuth, func(c *gin.Context) {
		handler.RetryAccountTask(c.Writer, c.Request, c.Param("id"))
	})
	api.POST("/account/tasks/:id/cancel", middleware.UserAuth, func(c *gin.Context) {
		handler.CancelAccountTask(c.Writer, c.Request, c.Param("id"))
	})
	api.POST("/payment/orders", middleware.UserAuth, gin.WrapF(handler.CreatePaymentOrder))
	api.GET("/payment/epay/notify", gin.WrapF(handler.EPayNotify))
	api.POST("/payment/epay/notify", gin.WrapF(handler.EPayNotify))
	api.GET("/payment/epay/return", gin.WrapF(handler.EPayReturn))
	api.GET("/subscription-plans", gin.WrapF(handler.SubscriptionPlans))
	api.GET("/credit-packages", gin.WrapF(handler.CreditPackages))
	api.POST("/admin/login", gin.WrapF(handler.AdminLogin))

	admin := api.Group("/admin", middleware.AdminAuth, middleware.AdminOperationLogger)
	admin.GET("/users", gin.WrapF(handler.AdminUsers))
	admin.POST("/users", gin.WrapF(handler.AdminSaveUser))
	admin.POST("/users/:id/credits", func(c *gin.Context) {
		handler.AdminAdjustUserCredits(c.Writer, c.Request, c.Param("id"))
	})
	admin.DELETE("/users/:id", func(c *gin.Context) {
		handler.AdminDeleteUser(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/credit-logs", gin.WrapF(handler.AdminCreditLogs))
	admin.POST("/credit-logs", gin.WrapF(handler.AdminSaveCreditLog))
	admin.DELETE("/credit-logs/:id", func(c *gin.Context) {
		handler.AdminDeleteCreditLog(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/announcements", gin.WrapF(handler.AdminAnnouncements))
	admin.POST("/announcements", gin.WrapF(handler.AdminSaveAnnouncement))
	admin.POST("/announcements/images", gin.WrapF(handler.AdminUploadAnnouncementImage))
	admin.DELETE("/announcements/:id", func(c *gin.Context) {
		handler.AdminDeleteAnnouncement(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/home/slides", gin.WrapF(handler.AdminHomeSlides))
	admin.POST("/home/slides", gin.WrapF(handler.AdminSaveHomeSlide))
	admin.DELETE("/home/slides/:id", func(c *gin.Context) {
		handler.AdminDeleteHomeSlide(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/home/works", gin.WrapF(handler.AdminHomeWorks))
	admin.POST("/home/works", gin.WrapF(handler.AdminSaveHomeWork))
	admin.POST("/home/works/import-url", gin.WrapF(handler.AdminImportHomeWork))
	admin.POST("/home/media", gin.WrapF(handler.AdminUploadHomeMedia))
	admin.DELETE("/home/works/:id", func(c *gin.Context) {
		handler.AdminDeleteHomeWork(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/home/categories", gin.WrapF(handler.AdminHomeCategories))
	admin.POST("/home/categories", gin.WrapF(handler.AdminSaveHomeCategory))
	admin.DELETE("/home/categories/:id", func(c *gin.Context) {
		handler.AdminDeleteHomeCategory(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/home/tags", gin.WrapF(handler.AdminHomeTags))
	admin.POST("/home/tags", gin.WrapF(handler.AdminSaveHomeTag))
	admin.DELETE("/home/tags/:id", func(c *gin.Context) {
		handler.AdminDeleteHomeTag(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/subscription-plans", gin.WrapF(handler.AdminSubscriptionPlans))
	admin.POST("/subscription-plans", gin.WrapF(handler.AdminSaveSubscriptionPlan))
	admin.DELETE("/subscription-plans/:id", func(c *gin.Context) {
		handler.AdminDeleteSubscriptionPlan(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/plans", gin.WrapF(handler.AdminSubscriptionPlans))
	admin.POST("/plans", gin.WrapF(handler.AdminSaveSubscriptionPlan))
	admin.DELETE("/plans/:id", func(c *gin.Context) {
		handler.AdminDeleteSubscriptionPlan(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/billing/subscription-plans", gin.WrapF(handler.AdminSubscriptionPlans))
	admin.POST("/billing/subscription-plans", gin.WrapF(handler.AdminSaveSubscriptionPlan))
	admin.DELETE("/billing/subscription-plans/:id", func(c *gin.Context) {
		handler.AdminDeleteSubscriptionPlan(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/credit-packages", gin.WrapF(handler.AdminCreditPackages))
	admin.POST("/credit-packages", gin.WrapF(handler.AdminSaveCreditPackage))
	admin.DELETE("/credit-packages/:id", func(c *gin.Context) {
		handler.AdminDeleteCreditPackage(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/billing/credit-packages", gin.WrapF(handler.AdminCreditPackages))
	admin.POST("/billing/credit-packages", gin.WrapF(handler.AdminSaveCreditPackage))
	admin.DELETE("/billing/credit-packages/:id", func(c *gin.Context) {
		handler.AdminDeleteCreditPackage(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/payment/settings", gin.WrapF(handler.AdminPaymentSettings))
	admin.POST("/payment/settings", gin.WrapF(handler.AdminSavePaymentSettings))
	admin.GET("/settings", gin.WrapF(handler.AdminSettings))
	admin.POST("/settings", gin.WrapF(handler.AdminSaveSettings))
	admin.POST("/settings/channel-models", gin.WrapF(handler.AdminChannelModels))
	admin.POST("/settings/channel-test", gin.WrapF(handler.AdminTestChannelModel))
	admin.POST("/settings/object-storage-test", gin.WrapF(handler.AdminTestObjectStorage))
	admin.GET("/operation-logs", gin.WrapF(handler.AdminOperationLogs))
	admin.GET("/error-logs", gin.WrapF(handler.AdminErrorLogs))
	admin.GET("/system-tasks", gin.WrapF(handler.AdminSystemTasks))
	admin.GET("/task-logs", gin.WrapF(handler.AdminTaskLogs))
	admin.GET("/task-logs/stats", gin.WrapF(handler.AdminTaskLogStats))
	admin.GET("/task-logs/:id", func(c *gin.Context) {
		handler.AdminTaskLogDetail(c.Writer, c.Request, c.Param("id"))
	})
	admin.POST("/task-logs/:id/retry", func(c *gin.Context) {
		handler.AdminRetryTaskLog(c.Writer, c.Request, c.Param("id"))
	})
	admin.POST("/task-logs/:id/cancel", func(c *gin.Context) {
		handler.AdminCancelTaskLog(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/server/status", gin.WrapF(handler.AdminServerStatus))
	admin.GET("/ops/dashboard", gin.WrapF(handler.AdminOpsDashboard))
	admin.GET("/database/status", gin.WrapF(handler.AdminDatabaseStatus))
	admin.GET("/database/backups", gin.WrapF(handler.AdminDatabaseBackups))
	admin.POST("/database/backups", gin.WrapF(handler.AdminCreateDatabaseBackup))
	admin.GET("/database/backups/:name/download", func(c *gin.Context) {
		handler.AdminDownloadDatabaseBackup(c.Writer, c.Request, c.Param("name"))
	})
	admin.GET("/prompt-categories", gin.WrapF(handler.AdminPromptCategories))
	admin.POST("/prompt-categories", gin.WrapF(handler.AdminSavePromptCategory))
	admin.POST("/prompt-categories/sync", gin.WrapF(handler.AdminSyncPromptCategories))
	admin.DELETE("/prompt-categories/:category", func(c *gin.Context) {
		handler.AdminDeletePromptCategory(c.Writer, c.Request, c.Param("category"))
	})
	admin.GET("/prompts", gin.WrapF(handler.AdminPrompts))
	admin.POST("/prompts", gin.WrapF(handler.AdminSavePrompt))
	admin.POST("/prompts/batch-delete", gin.WrapF(handler.AdminDeletePrompts))
	admin.DELETE("/prompts/:id", func(c *gin.Context) {
		handler.AdminDeletePrompt(c.Writer, c.Request, c.Param("id"))
	})
	admin.GET("/assets", gin.WrapF(handler.AdminAssets))
	admin.POST("/assets", gin.WrapF(handler.AdminSaveAsset))
	admin.DELETE("/assets/:id", func(c *gin.Context) {
		handler.AdminDeleteAsset(c.Writer, c.Request, c.Param("id"))
	})

	router.NoRoute(middleware.NotFoundJSON)

	return router
}
