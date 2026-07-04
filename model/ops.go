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
	SystemTaskStatusPending SystemTaskStatus = "pending"
	SystemTaskStatusRunning SystemTaskStatus = "running"
	SystemTaskStatusSuccess SystemTaskStatus = "success"
	SystemTaskStatusFailed  SystemTaskStatus = "failed"
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

type BackupFile struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"createdAt"`
}
