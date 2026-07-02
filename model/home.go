package model

type HomeWorkStatus string
type HomeWorkType string

const (
	HomeWorkStatusDraft     HomeWorkStatus = "draft"
	HomeWorkStatusPending   HomeWorkStatus = "pending"
	HomeWorkStatusPublished HomeWorkStatus = "published"
	HomeWorkStatusHidden    HomeWorkStatus = "hidden"

	HomeWorkTypeImage HomeWorkType = "image"
	HomeWorkTypeVideo HomeWorkType = "video"
)

type HomeSlide struct {
	ID          string `json:"id" gorm:"primaryKey"`
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle" gorm:"type:text"`
	CoverURL    string `json:"coverUrl"`
	LinkURL     string `json:"linkUrl"`
	WorkID      string `json:"workId" gorm:"index"`
	Enabled     bool   `json:"enabled"`
	Sort        int    `json:"sort"`
	PublishedAt string `json:"publishedAt" gorm:"index"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

type HomeWork struct {
	ID             string         `json:"id" gorm:"primaryKey"`
	Title          string         `json:"title"`
	Description    string         `json:"description" gorm:"type:text"`
	Type           HomeWorkType   `json:"type" gorm:"index"`
	CoverURL       string         `json:"coverUrl"`
	MediaURL       string         `json:"mediaUrl"`
	Prompt         string         `json:"prompt" gorm:"type:text"`
	Model          string         `json:"model"`
	Category       string         `json:"category" gorm:"index"`
	Tags           []string       `json:"tags" gorm:"serializer:json"`
	Status         HomeWorkStatus `json:"status" gorm:"index"`
	AllowSameStyle bool           `json:"allowSameStyle"`
	ShowPrompt     bool           `json:"showPrompt"`
	Sort           int            `json:"sort"`
	PublishedAt    string         `json:"publishedAt" gorm:"index"`
	CreatedAt      string         `json:"createdAt"`
	UpdatedAt      string         `json:"updatedAt"`
}

type HomeCategory struct {
	ID        string `json:"id" gorm:"primaryKey"`
	Name      string `json:"name"`
	Enabled   bool   `json:"enabled"`
	Sort      int    `json:"sort"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type HomeTag struct {
	ID        string `json:"id" gorm:"primaryKey"`
	Name      string `json:"name"`
	Enabled   bool   `json:"enabled"`
	Sort      int    `json:"sort"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type HomeWorkList struct {
	Items      []HomeWork     `json:"items"`
	Categories []HomeCategory `json:"categories"`
	Tags       []HomeTag      `json:"tags"`
	Total      int            `json:"total"`
}

