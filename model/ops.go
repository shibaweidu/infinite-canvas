package model

type AdminOperationLog struct {
	ID        string `json:"id" gorm:"primaryKey"`
	UserID    string `json:"userId" gorm:"index"`
	Username  string `json:"username"`
	Method    string `json:"method"`
	Path      string `json:"path" gorm:"index"`
	Query     string `json:"query"`
	IP        string `json:"ip"`
	UserAgent string `json:"userAgent"`
	Status    int    `json:"status"`
	Duration  int64  `json:"duration"`
	CreatedAt string `json:"createdAt" gorm:"index"`
}

type AdminOperationLogList struct {
	Items []AdminOperationLog `json:"items"`
	Total int                 `json:"total"`
}

type SystemTaskStatus string

const (
	SystemTaskStatusPending  SystemTaskStatus = "pending"
	SystemTaskStatusRunning  SystemTaskStatus = "running"
	SystemTaskStatusSuccess  SystemTaskStatus = "success"
	SystemTaskStatusFailed   SystemTaskStatus = "failed"
	SystemTaskStatusCanceled SystemTaskStatus = "canceled"
)

type SystemTask struct {
	ID         string           `json:"id" gorm:"primaryKey"`
	Type       string           `json:"type" gorm:"index"`
	Status     SystemTaskStatus `json:"status" gorm:"index"`
	Title      string           `json:"title"`
	Payload    string           `json:"payload"`
	Result     string           `json:"result"`
	Error      string           `json:"error"`
	CreatedBy  string           `json:"createdBy"`
	StartedAt  string           `json:"startedAt"`
	FinishedAt string           `json:"finishedAt"`
	CreatedAt  string           `json:"createdAt" gorm:"index"`
	UpdatedAt  string           `json:"updatedAt"`
}

type SystemTaskList struct {
	Items []SystemTask `json:"items"`
	Total int          `json:"total"`
}

type TaskLogQuery struct {
	Keyword     string
	Status      string
	Type        string
	CreatedFrom string
	CreatedTo   string
	Page        int
	PageSize    int
}

func (q *TaskLogQuery) Normalize() {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 {
		q.PageSize = 20
	}
	if q.PageSize > MaxPageSize {
		q.PageSize = MaxPageSize
	}
}

func (q TaskLogQuery) Offset() int {
	return (q.Page - 1) * q.PageSize
}

type TaskLogItem struct {
	ID              string           `json:"id"`
	SourceTaskID    string           `json:"sourceTaskId"`
	Type            string           `json:"type"`
	TypeLabel       string           `json:"typeLabel"`
	Status          SystemTaskStatus `json:"status"`
	StatusLabel     string           `json:"statusLabel"`
	Title           string           `json:"title"`
	CreatedBy       string           `json:"createdBy"`
	Platform        string           `json:"platform"`
	Model           string           `json:"model"`
	Credits         int              `json:"credits"`
	Progress        int              `json:"progress"`
	CreatedAt       string           `json:"createdAt"`
	StartedAt       string           `json:"startedAt"`
	FinishedAt      string           `json:"finishedAt"`
	DurationMs      int64            `json:"durationMs"`
	QueueDurationMs int64            `json:"queueDurationMs"`
	RunDurationMs   int64            `json:"runDurationMs"`
	Summary         string           `json:"summary"`
	Error           string           `json:"error"`
	UpstreamTaskID  string           `json:"upstreamTaskId"`
	Timeline        []TaskLogEvent   `json:"timeline,omitempty"`
	CreditLogs      []CreditLog      `json:"creditLogs,omitempty"`
	RelatedTasks    []TaskLogRelated `json:"relatedTasks,omitempty"`
	ResultLinks     []TaskLogLink    `json:"resultLinks,omitempty"`
	Payload         string           `json:"payload,omitempty"`
	Result          string           `json:"result,omitempty"`
}

type TaskLogEvent struct {
	Time        string `json:"time"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status"`
}

type TaskLogRelated struct {
	ID          string           `json:"id"`
	Relation    string           `json:"relation"`
	Status      SystemTaskStatus `json:"status"`
	StatusLabel string           `json:"statusLabel"`
	CreatedAt   string           `json:"createdAt"`
}

type TaskLogLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
	Type  string `json:"type"`
}

type TaskLogList struct {
	Items []TaskLogItem `json:"items"`
	Total int           `json:"total"`
}

type TaskLogStats struct {
	Total             int64 `json:"total"`
	Today             int64 `json:"today"`
	Pending           int64 `json:"pending"`
	Running           int64 `json:"running"`
	Success           int64 `json:"success"`
	Failed            int64 `json:"failed"`
	Canceled          int64 `json:"canceled"`
	AverageDurationMs int64 `json:"averageDurationMs"`
}

type ErrorLog struct {
	ID        string `json:"id" gorm:"primaryKey"`
	Source    string `json:"source" gorm:"index"`
	Message   string `json:"message"`
	Detail    string `json:"detail"`
	Method    string `json:"method"`
	Path      string `json:"path" gorm:"index"`
	UserID    string `json:"userId" gorm:"index"`
	IP        string `json:"ip"`
	UserAgent string `json:"userAgent"`
	CreatedAt string `json:"createdAt" gorm:"index"`
}

type ErrorLogList struct {
	Items []ErrorLog `json:"items"`
	Total int        `json:"total"`
}

type DatabaseStatus struct {
	Driver string   `json:"driver"`
	DSN    string   `json:"dsn"`
	Notes  []string `json:"notes"`
}

type ServerStatus struct {
	StartedAt     string              `json:"startedAt"`
	ServerTime    string              `json:"serverTime"`
	UptimeSeconds int64               `json:"uptimeSeconds"`
	OS            string              `json:"os"`
	Arch          string              `json:"arch"`
	CPUCores      int                 `json:"cpuCores"`
	GoVersion     string              `json:"goVersion"`
	Goroutines    int                 `json:"goroutines"`
	Memory        ServerMemoryStatus  `json:"memory"`
	Database      DatabasePoolStatus  `json:"database"`
	TaskQueue     TaskQueueStatus     `json:"taskQueue"`
	DataDir       ServerDataDirStatus `json:"dataDir"`
}

type ServerMemoryStatus struct {
	Alloc     uint64 `json:"alloc"`
	Sys       uint64 `json:"sys"`
	HeapAlloc uint64 `json:"heapAlloc"`
	HeapInuse uint64 `json:"heapInuse"`
	NumGC     uint32 `json:"numGc"`
}

type DatabasePoolStatus struct {
	OpenConnections int   `json:"openConnections"`
	InUse           int   `json:"inUse"`
	Idle            int   `json:"idle"`
	WaitCount       int64 `json:"waitCount"`
	WaitDurationMs  int64 `json:"waitDurationMs"`
}

type TaskQueueStatus struct {
	DefaultUserConcurrency int            `json:"defaultUserConcurrency"`
	Pending                int64          `json:"pending"`
	Running                int64          `json:"running"`
	Success                int64          `json:"success"`
	Failed                 int64          `json:"failed"`
	ByType                 map[string]int `json:"byType"`
}

type ServerDataDirStatus struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
}

type OpsDashboard struct {
	Health        []OpsHealthItem       `json:"health"`
	Server        ServerStatus          `json:"server"`
	Requests      OpsRequestStats       `json:"requests"`
	Business      OpsBusinessStats      `json:"business"`
	Payments      OpsPaymentStats       `json:"payments"`
	ModelChannels []OpsModelChannelStat `json:"modelChannels"`
	Errors        ErrorLogList          `json:"errors"`
	Operations    AdminOperationLogList `json:"operations"`
}

type OpsHealthItem struct {
	Key     string `json:"key"`
	Label   string `json:"label"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

type OpsMetricPoint struct {
	Time  string `json:"time"`
	Value int64  `json:"value"`
}

type OpsStatusSlice struct {
	Label string `json:"label"`
	Value int64  `json:"value"`
}

type OpsRequestStats struct {
	Total             int64              `json:"total"`
	Today             int64              `json:"today"`
	Failed            int64              `json:"failed"`
	AverageDurationMs int64              `json:"averageDurationMs"`
	MaxDurationMs     int64              `json:"maxDurationMs"`
	Recent            []OpsRecentRequest `json:"recent"`
	SlowEndpoints     []OpsSlowEndpoint  `json:"slowEndpoints"`
	Status            []OpsStatusSlice   `json:"status"`
	Timeline          []OpsMetricPoint   `json:"timeline"`
}

type OpsRecentRequest struct {
	Method     string `json:"method"`
	Path       string `json:"path"`
	Status     int    `json:"status"`
	DurationMs int64  `json:"durationMs"`
	CreatedAt  string `json:"createdAt"`
}

type OpsSlowEndpoint struct {
	Method            string `json:"method"`
	Path              string `json:"path"`
	Count             int64  `json:"count"`
	AverageDurationMs int64  `json:"averageDurationMs"`
	MaxDurationMs     int64  `json:"maxDurationMs"`
}

type OpsBusinessStats struct {
	Users                int64 `json:"users"`
	NewUsersToday        int64 `json:"newUsersToday"`
	ActiveUsersToday     int64 `json:"activeUsersToday"`
	Works                int64 `json:"works"`
	PublishedWorks       int64 `json:"publishedWorks"`
	CreditsConsumedToday int64 `json:"creditsConsumedToday"`
	OperationsToday      int64 `json:"operationsToday"`
	ErrorsToday          int64 `json:"errorsToday"`
}

type OpsPaymentStats struct {
	TodayOrders   int64 `json:"todayOrders"`
	PaidOrders    int64 `json:"paidOrders"`
	PendingOrders int64 `json:"pendingOrders"`
	ClosedOrders  int64 `json:"closedOrders"`
	PaidAmount    int64 `json:"paidAmount"`
	SuccessRate   int   `json:"successRate"`
}

type OpsModelChannelStat struct {
	Name       string `json:"name"`
	Enabled    bool   `json:"enabled"`
	Configured bool   `json:"configured"`
	ModelCount int    `json:"modelCount"`
	Status     string `json:"status"`
	Message    string `json:"message"`
}

type BackupFile struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"createdAt"`
}
