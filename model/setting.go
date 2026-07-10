package model

import "encoding/json"

type SettingKey string

const (
	SettingKeyPublic  SettingKey = "public"
	SettingKeyPrivate SettingKey = "private"
)

// ModelChannel 模型渠道配置。
type ModelChannel struct {
	Protocol   string      `json:"protocol"`
	Name       string      `json:"name"`
	BaseURL    string      `json:"baseUrl"`
	APIKey     string      `json:"apiKey"`
	HasAPIKey  bool        `json:"hasApiKey"`
	Models     []string    `json:"models"`
	ModelItems []ModelItem `json:"modelItems"`
	Weight     int         `json:"weight"`
	Enabled    bool        `json:"enabled"`
	Remark     string      `json:"remark"`
}

// ModelCost 模型积分配置。
type ModelType string

const (
	ModelTypeText  ModelType = "text"
	ModelTypeImage ModelType = "image"
	ModelTypeVideo ModelType = "video"
	ModelTypeAudio ModelType = "audio"
)

type ResolutionCost struct {
	Resolution string `json:"resolution"`
	Credits    int    `json:"credits"`
	Enabled    *bool  `json:"enabled"`
}

type ModelAPIRoute struct {
	Path    string `json:"path"`
	Enabled bool   `json:"enabled"`
}

type ModelItem struct {
	Model               string           `json:"model"`
	Name                string           `json:"name"`
	Type                ModelType        `json:"type"`
	Selected            bool             `json:"selected"`
	Enabled             bool             `json:"enabled"`
	ThumbnailURL        string           `json:"thumbnailUrl"`
	ProviderDisplayName string           `json:"providerDisplayName"`
	Description         string           `json:"description"`
	Tags                []string         `json:"tags"`
	Credits             int              `json:"credits"`
	ResolutionCosts     []ResolutionCost `json:"resolutionCosts"`
	SecondCredits       int              `json:"secondCredits"`
	APIRoutes           []ModelAPIRoute  `json:"apiRoutes"`
}

type ModelCost struct {
	Model               string           `json:"model"`
	UpstreamModel       string           `json:"upstreamModel"`
	Name                string           `json:"name"`
	Type                ModelType        `json:"type"`
	ThumbnailURL        string           `json:"thumbnailUrl"`
	ProviderName        string           `json:"providerName"`
	ProviderEndpoint    string           `json:"providerEndpoint"`
	ProviderDisplayName string           `json:"providerDisplayName"`
	Description         string           `json:"description"`
	Tags                []string         `json:"tags"`
	Credits             int              `json:"credits"`
	ResolutionCosts     []ResolutionCost `json:"resolutionCosts"`
	SecondCredits       int              `json:"secondCredits"`
	APIRoutes           []ModelAPIRoute  `json:"apiRoutes"`
}

// PublicModelChannelSetting 公开模型渠道配置。
type PublicModelChannelSetting struct {
	AvailableModels    []string    `json:"availableModels"`
	ModelCosts         []ModelCost `json:"modelCosts"`
	DefaultModel       string      `json:"defaultModel"`
	DefaultImageModel  string      `json:"defaultImageModel"`
	DefaultVideoModel  string      `json:"defaultVideoModel"`
	DefaultTextModel   string      `json:"defaultTextModel"`
	SystemPrompt       string      `json:"systemPrompt"`
	ScriptAgentInstruction     string      `json:"scriptAgentInstruction"`
	CharacterAgentInstruction  string      `json:"characterAgentInstruction"`
	StoryboardAgentInstruction string      `json:"storyboardAgentInstruction"`
	AllowCustomChannel         *bool       `json:"allowCustomChannel"`
}

// ProjectBriefSetting 项目设定节点的公开选项配置。
type ProjectBriefSetting struct {
	Genres          []string             `json:"genres"`
	StyleCategories []string             `json:"styleCategories"`
	VisualStyles    []ProjectVisualStyle `json:"visualStyles"`
	StoryPresets    []ProjectStoryPreset `json:"storyPresets"`
}

type ProjectVisualStyle struct {
	Category    string   `json:"category"`
	Name        string   `json:"name"`
	Prompt      string   `json:"prompt"`
	CoverURL    string   `json:"coverUrl"`
	PreviewURLs []string `json:"previewUrls"`
}

type ProjectStoryPreset struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

type SiteNavigationItem struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Path    string `json:"path"`
	Enabled bool   `json:"enabled"`
	Sort    int    `json:"sort"`
}

type SiteSetting struct {
	LogoURL      string               `json:"logoUrl"`
	Name         string               `json:"name"`
	Title        string               `json:"title"`
	Description  string               `json:"description"`
	Slogan       string               `json:"slogan"`
	WorksEnabled *bool                `json:"worksEnabled"`
	Navigation   []SiteNavigationItem `json:"navigation"`
}

// PublicSetting 公开配置。
type PublicSetting struct {
	ModelChannel  PublicModelChannelSetting  `json:"modelChannel"`
	ProjectBrief  ProjectBriefSetting        `json:"projectBrief"`
	Auth          PublicAuthSetting          `json:"auth"`
	ObjectStorage PublicObjectStorageSetting `json:"objectStorage"`
	Site          SiteSetting                `json:"site"`
}

type PublicAuthSetting struct {
	AllowRegister *bool                    `json:"allowRegister"`
	EmailRegister PublicEmailAuthSetting   `json:"emailRegister"`
	LinuxDo       PublicLinuxDoAuthSetting `json:"linuxDo"`
	Google        PublicGoogleAuthSetting  `json:"google"`
}

type PublicEmailAuthSetting struct {
	Enabled       *bool `json:"enabled"`
	EmailRequired *bool `json:"emailRequired"`
	CodeEnabled   *bool `json:"codeEnabled"`
}

type PublicLinuxDoAuthSetting struct {
	Enabled bool `json:"enabled"`
}

type PublicGoogleAuthSetting struct {
	Enabled bool `json:"enabled"`
}

type PublicObjectStorageSetting struct {
	Enabled   bool   `json:"enabled"`
	Provider  string `json:"provider"`
	Bucket    string `json:"bucket"`
	Region    string `json:"region"`
	PublicURL string `json:"publicUrl"`
}

type ObjectStorageSetting struct {
	Enabled         bool   `json:"enabled"`
	Provider        string `json:"provider"`
	Endpoint        string `json:"endpoint"`
	Region          string `json:"region"`
	Bucket          string `json:"bucket"`
	AccessKeyID     string `json:"accessKeyId"`
	SecretAccessKey string `json:"secretAccessKey"`
	PublicURL       string `json:"publicUrl"`
	Prefix          string `json:"prefix"`
	ForcePathStyle  bool   `json:"forcePathStyle"`
}

// PrivateSetting 私有配置。
type PrivateSetting struct {
	Channels      []ModelChannel       `json:"channels"`
	PromptSync    PromptSyncSetting    `json:"promptSync"`
	TaskQueue     TaskQueueSetting     `json:"taskQueue"`
	Auth          PrivateAuthSetting   `json:"auth"`
	ObjectStorage ObjectStorageSetting `json:"objectStorage"`
}

type TaskQueueSetting struct {
	DefaultUserConcurrency   int `json:"defaultUserConcurrency"`
	ImageUserConcurrency     int `json:"imageUserConcurrency"`
	VideoUserConcurrency     int `json:"videoUserConcurrency"`
	GlobalDefaultConcurrency int `json:"globalDefaultConcurrency"`
	GlobalImageConcurrency   int `json:"globalImageConcurrency"`
	GlobalVideoConcurrency   int `json:"globalVideoConcurrency"`
	VideoPollIntervalSeconds int `json:"videoPollIntervalSeconds"`
	ImagePollIntervalSeconds int `json:"imagePollIntervalSeconds"`
}

// PromptSyncSetting 提示词定时同步配置。
type PromptSyncSetting struct {
	Enabled *bool  `json:"enabled"`
	Cron    string `json:"cron"`
}

type PrivateAuthSetting struct {
	Email   PrivateEmailAuthSetting   `json:"email"`
	LinuxDo PrivateLinuxDoAuthSetting `json:"linuxDo"`
	Google  PrivateGoogleAuthSetting  `json:"google"`
}

type PrivateEmailAuthSetting struct {
	SMTPHost     string `json:"smtpHost"`
	SMTPPort     int    `json:"smtpPort"`
	SMTPUsername string `json:"smtpUsername"`
	SMTPPassword string `json:"smtpPassword"`
	FromEmail    string `json:"fromEmail"`
	FromName     string `json:"fromName"`
	Subject      string `json:"subject"`
}

type PrivateLinuxDoAuthSetting struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

type PrivateGoogleAuthSetting struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

// Setting 系统配置。
type Setting struct {
	Key       SettingKey      `json:"key" gorm:"primaryKey"`
	Value     json.RawMessage `json:"value" gorm:"serializer:json"`
	CreatedAt string          `json:"createdAt"`
	UpdatedAt string          `json:"updatedAt"`
}

// Settings 系统公开和私有配置。
type Settings struct {
	Public  PublicSetting  `json:"public"`
	Private PrivateSetting `json:"private"`
}
