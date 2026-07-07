package service

import (
	"bytes"
	"crypto/sha1"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"mime"
	"mime/multipart"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
)

var adminModelHTTPClient = &http.Client{Timeout: 30 * time.Second}

func PublicSettings() (model.PublicSetting, error) {
	settings, err := repository.GetSettings()
	return normalizeSettings(settings).Public, err
}

func AdminSettings() (model.Settings, error) {
	settings, err := repository.GetSettings()
	return hidePrivateAPIKeys(normalizeSettings(settings)), err
}

func SaveSettings(settings model.Settings) (model.Settings, error) {
	saved, err := repository.GetSettings()
	if err != nil {
		return model.Settings{}, err
	}
	settings = normalizeSettings(settings)
	keepPrivateAPIKeys(&settings, normalizeSettings(saved))
	keepPrivateAuthSecrets(&settings, normalizeSettings(saved))
	result, err := repository.SaveSettings(settings, now())
	if err == nil {
		RefreshPromptSyncScheduler()
	}
	return hidePrivateAPIKeys(result), err
}

func AdminChannelModels(index *int, channel model.ModelChannel) ([]string, error) {
	resolved, err := resolveAdminChannel(index, channel)
	if err != nil {
		return nil, err
	}
	return fetchAdminChannelModels(resolved)
}

func AdminTestChannelModel(index *int, channel model.ModelChannel, modelName string) (string, error) {
	resolved, err := resolveAdminChannel(index, channel)
	if err != nil {
		return "", err
	}
	if isArkAgentPlanChannel(resolved) || isSeedanceModelName(modelName) {
		return testArkSeedanceChannelModel(resolved, modelName)
	}
	return testAdminChannelModel(resolved, modelName)
}

func normalizeSettings(settings model.Settings) model.Settings {
	settings.Public = normalizePublicSetting(settings.Public)
	settings.Private = normalizePrivateSetting(settings.Private)
	return syncPublicModelChannel(settings)
}

func normalizePublicSetting(setting model.PublicSetting) model.PublicSetting {
	if setting.ModelChannel.AvailableModels == nil {
		setting.ModelChannel.AvailableModels = []string{}
	}
	if setting.ModelChannel.ModelCosts == nil {
		setting.ModelChannel.ModelCosts = []model.ModelCost{}
	}
	for i := range setting.ModelChannel.ModelCosts {
		setting.ModelChannel.ModelCosts[i] = normalizeModelCost(setting.ModelChannel.ModelCosts[i])
	}
	if setting.ModelChannel.AllowCustomChannel == nil {
		enabled := true
		setting.ModelChannel.AllowCustomChannel = &enabled
	}
	if setting.Auth.AllowRegister == nil {
		enabled := true
		setting.Auth.AllowRegister = &enabled
	}
	if setting.Auth.EmailRegister.Enabled == nil {
		enabled := true
		setting.Auth.EmailRegister.Enabled = &enabled
	}
	if setting.Auth.EmailRegister.EmailRequired == nil {
		enabled := false
		setting.Auth.EmailRegister.EmailRequired = &enabled
	}
	if setting.Auth.EmailRegister.CodeEnabled == nil {
		enabled := false
		setting.Auth.EmailRegister.CodeEnabled = &enabled
	}
	setting.ProjectBrief = normalizeProjectBriefSetting(setting.ProjectBrief)
	setting.Site = normalizeSiteSetting(setting.Site)
	return setting
}

func normalizeSiteSetting(setting model.SiteSetting) model.SiteSetting {
	defaults := defaultSiteSetting()
	setting.LogoURL = strings.TrimSpace(setting.LogoURL)
	if setting.LogoURL == "" {
		setting.LogoURL = defaults.LogoURL
	}
	setting.Name = strings.TrimSpace(setting.Name)
	if setting.Name == "" {
		setting.Name = defaults.Name
	}
	setting.Title = strings.TrimSpace(setting.Title)
	if setting.Title == "" {
		setting.Title = setting.Name
	}
	setting.Description = strings.TrimSpace(setting.Description)
	if setting.Description == "" {
		setting.Description = defaults.Description
	}
	setting.Slogan = strings.TrimSpace(setting.Slogan)
	if setting.WorksEnabled == nil {
		setting.WorksEnabled = defaults.WorksEnabled
	}
	if setting.Navigation == nil {
		setting.Navigation = defaults.Navigation
		return setting
	}
	items := make([]model.SiteNavigationItem, 0, len(setting.Navigation))
	hasWorkbench := false
	for index, item := range setting.Navigation {
		item.ID = strings.TrimSpace(item.ID)
		item.Label = strings.TrimSpace(item.Label)
		item.Path = strings.TrimSpace(item.Path)
		if item.ID == "workbench" || item.Path == "/workbench" {
			hasWorkbench = true
		}
		if item.ID == "image" || item.ID == "video" || item.Path == "/image" || item.Path == "/video" {
			continue
		}
		if item.ID == "" {
			item.ID = fmt.Sprintf("nav-%d", index+1)
		}
		if item.Path != "" && !strings.HasPrefix(item.Path, "/") && !strings.HasPrefix(item.Path, "http://") && !strings.HasPrefix(item.Path, "https://") {
			item.Path = "/" + item.Path
		}
		if item.Label != "" && item.Path != "" {
			items = append(items, item)
		}
	}
	existing := map[string]bool{}
	for _, item := range items {
		existing[item.ID] = true
	}
	for _, item := range defaults.Navigation {
		if item.ID == "workbench" && hasWorkbench {
			continue
		}
		if !existing[item.ID] {
			items = append(items, item)
		}
	}
	sort.SliceStable(items, func(i, j int) bool {
		return items[i].Sort < items[j].Sort
	})
	setting.Navigation = items
	return setting
}

func defaultSiteSetting() model.SiteSetting {
	return model.SiteSetting{
		LogoURL:      "/logo.svg",
		Name:         "无限画布",
		Title:        "无限画布",
		Description:  "一个无限画布创作工具",
		Slogan:       "AI 创意工作台",
		WorksEnabled: boolPtr(true),
		Navigation: []model.SiteNavigationItem{
			{ID: "canvas", Label: "我的画布", Path: "/canvas", Enabled: true, Sort: 10},
			{ID: "workbench", Label: "创作工作台", Path: "/workbench", Enabled: true, Sort: 20},
			{ID: "prompts", Label: "提示词库", Path: "/prompts", Enabled: true, Sort: 30},
			{ID: "assets", Label: "我的素材", Path: "/assets", Enabled: true, Sort: 40},
			{ID: "announcements", Label: "公告", Path: "/announcements", Enabled: true, Sort: 50},
		},
	}
}

func boolPtr(value bool) *bool {
	return &value
}

func normalizeProjectBriefSetting(setting model.ProjectBriefSetting) model.ProjectBriefSetting {
	defaults := defaultProjectBriefSetting()
	if setting.Genres == nil {
		setting.Genres = defaults.Genres
	} else {
		setting.Genres = cleanStrings(setting.Genres)
	}
	if setting.StyleCategories == nil {
		setting.StyleCategories = defaults.StyleCategories
	} else {
		setting.StyleCategories = cleanStrings(setting.StyleCategories)
	}
	styles := make([]model.ProjectVisualStyle, 0, len(setting.VisualStyles))
	if setting.VisualStyles == nil {
		styles = defaults.VisualStyles
	} else {
		for _, item := range setting.VisualStyles {
			item.Category = strings.TrimSpace(item.Category)
			item.Name = strings.TrimSpace(item.Name)
			item.Prompt = strings.TrimSpace(item.Prompt)
			item.CoverURL = strings.TrimSpace(item.CoverURL)
			item.PreviewURLs = cleanStrings(item.PreviewURLs)
			if item.Name != "" {
				styles = append(styles, item)
			}
		}
	}
	setting.VisualStyles = styles
	presets := make([]model.ProjectStoryPreset, 0, len(setting.StoryPresets))
	if setting.StoryPresets == nil {
		presets = defaults.StoryPresets
	} else {
		for _, item := range setting.StoryPresets {
			item.Title = strings.TrimSpace(item.Title)
			item.Text = strings.TrimSpace(item.Text)
			if item.Title != "" && item.Text != "" {
				presets = append(presets, item)
			}
		}
	}
	setting.StoryPresets = presets
	return setting
}

func defaultProjectBriefSetting() model.ProjectBriefSetting {
	return model.ProjectBriefSetting{
		Genres:          []string{"科幻", "悬疑", "爱情", "冒险", "奇幻", "都市", "广告", "儿童动画", "纪录片"},
		StyleCategories: []string{"我的风格", "最近使用", "立体风格", "国风", "IP风格", "欧美风格", "日系风格", "插画风格", "韩系", "可爱Q版"},
		VisualStyles: []model.ProjectVisualStyle{
			{
				Name:     "KpopCG",
				Category: "韩系",
				Prompt:   "韩系偶像写真质感，精致妆造，高饱和舞台光，商业 CG 渲染。",
				CoverURL: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnpo9im1_39c786142b2473e8.webp",
				PreviewURLs: []string{
					"/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnojtb8n_3114dbe29e4fedbc.webp",
					"/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnpo9im1_39c786142b2473e8.webp",
					"/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnojr8e9_5d62e6aa1dc41c5e.webp",
				},
			},
			{
				Name:     "游戏CG",
				Category: "立体风格",
				Prompt:   "高品质游戏 CG，电影级布光，细节丰富，空间层次清晰。",
				CoverURL: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2FNhe9bnBOkoh8LSxYaG7cMct7nDg.webp",
				PreviewURLs: []string{
					"/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmn2tgtajad1a164ac3985264.webp",
					"/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2FEW0XbyTnUoZX44xcI1vcRtMcnjd.webp",
					"/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2FSnaobGxSHoLVIXxFlOUc5QgEnBc.webp",
				},
			},
			{
				Name:     "像素农场",
				Category: "可爱Q版",
				Prompt:   "可爱像素农场风，Q 版角色，明亮色彩，轻松治愈的游戏画面。",
				CoverURL: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnps4e2n_f772bf318499f660.webp",
				PreviewURLs: []string{
					"/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnpsa9ba_121507cc8417d426.webp",
					"/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnps84h8_04377ac124a68cc7.webp",
					"/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmnps8fah_869571d3fa0df2a2.webp",
				},
			},
			{Name: "国风水墨", Category: "国风", Prompt: "国风水墨，美术留白，柔和宣纸肌理，东方诗意构图。", CoverURL: "/api-proxy/asset?url=https%3A%2F%2Fstatic-oiioii-sg.hogiai.cn%2Fstyle_recommends%2Fmmybot0eaa74e8f640da0bf4.webp"},
			{Name: "电影感", Category: "欧美风格", Prompt: "电影级摄影，真实光影，浅景深，情绪化色彩分级。"},
			{Name: "皮克斯3D", Category: "IP风格", Prompt: "皮克斯式 3D 动画质感，圆润造型，表情夸张，温暖光线。"},
			{Name: "赛博朋克", Category: "插画风格", Prompt: "赛博朋克霓虹城市，高对比光影，未来科技元素，雨夜反射。"},
			{Name: "日系动画", Category: "日系风格", Prompt: "日系动画分镜，清爽线条，柔和天空光，细腻青春氛围。"},
		},
		StoryPresets: []model.ProjectStoryPreset{
			{Title: "科幻追逐", Text: "一个年轻程序员深夜发现自己开发的 AI 正在现实世界中追捕他，他必须在黎明前关闭系统。"},
			{Title: "温情治愈", Text: "一个长期独处的人在一次意外相遇后，重新学会与他人建立连接，并找回生活的温度。"},
			{Title: "悬疑反转", Text: "主角接到一条来自未来的警告信息，循着线索调查后发现真正的危险来自自己最信任的人。"},
			{Title: "产品广告", Text: "通过一个高压工作日中的小困境，展示产品如何自然地解决问题，并让生活变得更轻松。"},
			{Title: "儿童冒险", Text: "几个孩子在普通街区发现一扇通往奇妙世界的小门，必须合作帮助一位迷路的朋友回家。"},
			{Title: "灾难逃生", Text: "城市突然陷入危机，主角带着重要线索穿越混乱街区，寻找唯一能阻止灾难扩大的方法。"},
		},
	}
}

func syncPublicModelChannel(settings model.Settings) model.Settings {
	costs := map[string]model.ModelCost{}
	availableModels := []string{}
	for _, channel := range settings.Private.Channels {
		if !channel.Enabled {
			continue
		}
		for _, item := range channel.ModelItems {
			if !item.Selected || !item.Enabled || strings.TrimSpace(item.Model) == "" {
				continue
			}
			modelID := publicModelID(channel, item)
			availableModels = append(availableModels, modelID)
			cost := modelItemCost(item, channel)
			if existing, ok := costs[modelID]; ok {
				costs[modelID] = mergeModelCost(existing, cost)
			} else {
				costs[modelID] = cost
			}
		}
	}
	models := uniqueStrings(availableModels)
	modelCosts := make([]model.ModelCost, 0, len(models))
	textModels := []string{}
	imageModels := []string{}
	videoModels := []string{}
	for _, modelName := range models {
		cost := costs[modelName]
		modelCosts = append(modelCosts, cost)
		switch cost.Type {
		case model.ModelTypeImage:
			imageModels = append(imageModels, modelName)
		case model.ModelTypeVideo:
			videoModels = append(videoModels, modelName)
		default:
			textModels = append(textModels, modelName)
		}
	}
	settings.Public.ModelChannel.AvailableModels = models
	settings.Public.ModelChannel.ModelCosts = modelCosts
	settings.Public.ModelChannel.DefaultModel = pickDefaultModel(settings.Public.ModelChannel.DefaultModel, models)
	settings.Public.ModelChannel.DefaultTextModel = pickDefaultModel(settings.Public.ModelChannel.DefaultTextModel, fallbackModels(textModels, models))
	settings.Public.ModelChannel.DefaultImageModel = pickDefaultModel(settings.Public.ModelChannel.DefaultImageModel, fallbackModels(imageModels, models))
	settings.Public.ModelChannel.DefaultVideoModel = pickDefaultModel(settings.Public.ModelChannel.DefaultVideoModel, fallbackModels(videoModels, models))
	settings.Public.ObjectStorage = publicObjectStorageSetting(settings.Private.ObjectStorage)
	return settings
}

func publicObjectStorageSetting(setting model.ObjectStorageSetting) model.PublicObjectStorageSetting {
	setting = normalizeObjectStorageSetting(setting)
	return model.PublicObjectStorageSetting{
		Enabled:   setting.Enabled,
		Provider:  setting.Provider,
		Bucket:    setting.Bucket,
		Region:    setting.Region,
		PublicURL: setting.PublicURL,
	}
}

func modelItemCost(item model.ModelItem, channel model.ModelChannel) model.ModelCost {
	providerName := publicModelProviderName(channel)
	return normalizeModelCost(model.ModelCost{
		Model:               publicModelID(channel, item),
		UpstreamModel:       item.Model,
		Name:                item.Name,
		Type:                item.Type,
		ThumbnailURL:        item.ThumbnailURL,
		ProviderName:        providerName,
		ProviderEndpoint:    "",
		ProviderDisplayName: publicModelProviderDisplayName(item.ProviderDisplayName, providerName),
		Description:         item.Description,
		Tags:                item.Tags,
		Credits:             item.Credits,
		ResolutionCosts:     item.ResolutionCosts,
		SecondCredits:       item.SecondCredits,
		APIRoutes:           item.APIRoutes,
	})
}

func mergeModelCost(base model.ModelCost, next model.ModelCost) model.ModelCost {
	base = normalizeModelCost(base)
	next = normalizeModelCost(next)
	if base.Name == "" || base.Name == base.Model {
		base.Name = firstNonEmpty(next.Name, base.Name)
	}
	if base.Type == "" {
		base.Type = next.Type
	}
	if base.ThumbnailURL == "" {
		base.ThumbnailURL = next.ThumbnailURL
	}
	base.ProviderDisplayName = joinUniqueLabels(base.ProviderDisplayName, next.ProviderDisplayName)
	if base.Description == "" {
		base.Description = next.Description
	} else if next.Description != "" && !strings.Contains(base.Description, next.Description) {
		base.Description += "\n" + next.Description
	}
	base.Tags = uniqueStrings(append(base.Tags, next.Tags...))
	if base.Credits <= 0 {
		base.Credits = next.Credits
	}
	if len(base.ResolutionCosts) == 0 {
		base.ResolutionCosts = next.ResolutionCosts
	}
	if base.SecondCredits <= 0 {
		base.SecondCredits = next.SecondCredits
	}
	return normalizeModelCost(base)
}

func joinUniqueLabels(values ...string) string {
	labels := []string{}
	for _, value := range values {
		for _, item := range strings.Split(value, " / ") {
			item = strings.TrimSpace(item)
			if item != "" {
				labels = append(labels, item)
			}
		}
	}
	return strings.Join(uniqueStrings(labels), " / ")
}

func publicModelID(channel model.ModelChannel, item model.ModelItem) string {
	prefix := publicModelChannelLabel(channel)
	modelName := strings.TrimSpace(item.Model)
	if prefix == "" {
		return modelName
	}
	return strings.Join([]string{prefix, modelName}, "||")
}

func publicModelProviderName(channel model.ModelChannel) string {
	name := strings.TrimSpace(channel.Name)
	if isSensitiveEndpointLabel(name) {
		return ""
	}
	return name
}

func publicModelProviderDisplayName(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if isSensitiveEndpointLabel(value) {
		value = ""
	}
	return firstNonEmpty(value, fallback)
}

func publicModelChannelLabel(channel model.ModelChannel) string {
	name := strings.TrimSpace(channel.Name)
	if name != "" && !isSensitiveEndpointLabel(name) {
		return name
	}
	seed := normalizeModelChannelBaseURL(channel.BaseURL)
	if seed == "" {
		seed = name
	}
	if seed == "" {
		return ""
	}
	sum := sha1.Sum([]byte(seed))
	return fmt.Sprintf("channel-%x", sum[:4])
}

func isSensitiveEndpointLabel(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	lower := strings.ToLower(value)
	if strings.Contains(lower, "://") || strings.Contains(lower, "/") {
		return true
	}
	if parsed, err := url.Parse("https://" + value); err == nil && parsed.Host != "" && strings.Contains(parsed.Host, ".") {
		return true
	}
	return false
}

func publicModelUpstreamName(item model.ModelCost, fallback string) string {
	if strings.TrimSpace(item.UpstreamModel) != "" {
		return strings.TrimSpace(item.UpstreamModel)
	}
	return strings.TrimSpace(fallback)
}

func fallbackModels(primary []string, fallback []string) []string {
	if len(primary) > 0 {
		return primary
	}
	return fallback
}

func pickDefaultModel(current string, models []string) string {
	for _, item := range models {
		if item == current {
			return current
		}
	}
	if len(models) > 0 {
		return models[0]
	}
	return ""
}

func ModelCost(modelName string) (int, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return 0, err
	}
	if item, ok := findModelCost(normalizeSettings(settings).Public.ModelChannel.ModelCosts, modelName); ok {
		return item.Credits, nil
	}
	return 0, nil
}

func ModelRequestCost(modelName string, path string, body []byte, contentType string) (int, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return 0, err
	}
	item, ok := findModelCost(normalizeSettings(settings).Public.ModelChannel.ModelCosts, modelName)
	if !ok {
		return 0, nil
	}
	modelType := item.Type
	if modelType == "" {
		modelType = inferModelType(publicModelUpstreamName(item, modelName))
	}
	switch modelType {
	case model.ModelTypeImage:
		count := maxPositiveInt(readAIRequestInt(body, contentType, "n"), 1)
		resolution := strings.TrimSpace(readAIRequestString(body, contentType, "size"))
		if resolution == "" {
			resolution = "auto"
		}
		return modelResolutionCredits(item, resolution) * count, nil
	case model.ModelTypeVideo:
		seconds := maxPositiveInt(readAIRequestInt(body, contentType, "seconds"), readAIRequestInt(body, contentType, "duration"), readAIRequestInt(body, contentType, "duration_seconds"), 1)
		unit := item.SecondCredits
		if unit <= 0 {
			unit = item.Credits
		}
		return unit * seconds, nil
	default:
		return item.Credits, nil
	}
}

func normalizePrivateSetting(setting model.PrivateSetting) model.PrivateSetting {
	if setting.Channels == nil {
		setting.Channels = []model.ModelChannel{}
	}
	setting.PromptSync = normalizePromptSyncSetting(setting.PromptSync)
	setting.TaskQueue = normalizeTaskQueueSetting(setting.TaskQueue)
	setting.Auth.Email = normalizePrivateEmailAuthSetting(setting.Auth.Email)
	setting.ObjectStorage = normalizeObjectStorageSetting(setting.ObjectStorage)
	for i := range setting.Channels {
		setting.Channels[i] = normalizeModelChannel(setting.Channels[i])
	}
	return setting
}

func normalizeTaskQueueSetting(setting model.TaskQueueSetting) model.TaskQueueSetting {
	setting.DefaultUserConcurrency = clampInt(setting.DefaultUserConcurrency, 2, 1, 50)
	setting.ImageUserConcurrency = clampInt(setting.ImageUserConcurrency, setting.DefaultUserConcurrency, 1, 50)
	setting.VideoUserConcurrency = clampInt(setting.VideoUserConcurrency, 1, 1, 50)
	setting.GlobalDefaultConcurrency = clampInt(setting.GlobalDefaultConcurrency, 20, 1, 1000)
	setting.GlobalImageConcurrency = clampInt(setting.GlobalImageConcurrency, 30, 1, 1000)
	setting.GlobalVideoConcurrency = clampInt(setting.GlobalVideoConcurrency, 5, 1, 1000)
	setting.VideoPollIntervalSeconds = clampInt(setting.VideoPollIntervalSeconds, 5, 1, 60)
	setting.ImagePollIntervalSeconds = clampInt(setting.ImagePollIntervalSeconds, 3, 1, 60)
	return setting
}

func clampInt(value int, fallback int, min int, max int) int {
	if value <= 0 {
		value = fallback
	}
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func normalizePrivateEmailAuthSetting(setting model.PrivateEmailAuthSetting) model.PrivateEmailAuthSetting {
	setting.SMTPHost = strings.TrimSpace(setting.SMTPHost)
	setting.SMTPUsername = strings.TrimSpace(setting.SMTPUsername)
	setting.SMTPPassword = strings.TrimSpace(setting.SMTPPassword)
	setting.FromEmail = strings.TrimSpace(setting.FromEmail)
	setting.FromName = strings.TrimSpace(setting.FromName)
	setting.Subject = strings.TrimSpace(setting.Subject)
	if setting.SMTPPort <= 0 {
		setting.SMTPPort = 587
	}
	if setting.Subject == "" {
		setting.Subject = "邮箱验证码"
	}
	return setting
}

func normalizeObjectStorageSetting(setting model.ObjectStorageSetting) model.ObjectStorageSetting {
	setting.Provider = strings.TrimSpace(setting.Provider)
	if setting.Provider == "" {
		setting.Provider = "s3"
	}
	setting.Endpoint = strings.TrimRight(strings.TrimSpace(setting.Endpoint), "/")
	setting.Region = strings.TrimSpace(setting.Region)
	setting.Bucket = strings.TrimSpace(setting.Bucket)
	setting.AccessKeyID = strings.TrimSpace(setting.AccessKeyID)
	setting.SecretAccessKey = strings.TrimSpace(setting.SecretAccessKey)
	setting.PublicURL = strings.TrimRight(strings.TrimSpace(setting.PublicURL), "/")
	setting.Prefix = strings.Trim(strings.TrimSpace(setting.Prefix), "/")
	return setting
}

func hidePrivateAPIKeys(settings model.Settings) model.Settings {
	for i := range settings.Private.Channels {
		settings.Private.Channels[i].HasAPIKey = strings.TrimSpace(settings.Private.Channels[i].APIKey) != ""
		settings.Private.Channels[i].APIKey = ""
	}
	settings.Private.Auth.Email.SMTPPassword = ""
	settings.Private.Auth.LinuxDo.ClientSecret = ""
	settings.Private.Auth.Google.ClientSecret = ""
	settings.Private.ObjectStorage.SecretAccessKey = ""
	return settings
}

func keepPrivateAPIKeys(settings *model.Settings, saved model.Settings) {
	for i := range settings.Private.Channels {
		if strings.TrimSpace(settings.Private.Channels[i].APIKey) != "" {
			continue
		}
		if channel, ok := findSavedChannel(settings.Private.Channels[i], saved.Private.Channels, i); ok {
			settings.Private.Channels[i].APIKey = channel.APIKey
		}
	}
}

func keepPrivateAuthSecrets(settings *model.Settings, saved model.Settings) {
	if strings.TrimSpace(settings.Private.Auth.Email.SMTPPassword) == "" {
		settings.Private.Auth.Email.SMTPPassword = saved.Private.Auth.Email.SMTPPassword
	}
	if strings.TrimSpace(settings.Private.Auth.LinuxDo.ClientSecret) == "" {
		settings.Private.Auth.LinuxDo.ClientSecret = saved.Private.Auth.LinuxDo.ClientSecret
	}
	if strings.TrimSpace(settings.Private.Auth.Google.ClientSecret) == "" {
		settings.Private.Auth.Google.ClientSecret = saved.Private.Auth.Google.ClientSecret
	}
	if strings.TrimSpace(settings.Private.ObjectStorage.SecretAccessKey) == "" {
		settings.Private.ObjectStorage.SecretAccessKey = saved.Private.ObjectStorage.SecretAccessKey
	}
}

func findSavedChannel(channel model.ModelChannel, saved []model.ModelChannel, index int) (model.ModelChannel, bool) {
	for _, item := range saved {
		if item.Name == channel.Name && item.BaseURL == channel.BaseURL {
			return item, true
		}
	}
	if index < len(saved) {
		return saved[index], true
	}
	return model.ModelChannel{}, false
}

func SelectModelChannel(modelName string) (model.ModelChannel, error) {
	channel, _, err := SelectModelChannelWithModel(modelName)
	return channel, err
}

func SelectModelChannelWithModel(modelName string) (model.ModelChannel, string, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return model.ModelChannel{}, "", err
	}
	channels := modelChannelsForModel(normalizePrivateSetting(settings.Private).Channels, modelName)
	if len(channels) == 0 {
		return model.ModelChannel{}, "", errors.New("没有可用模型渠道")
	}
	total := 0
	for _, channel := range channels {
		total += channel.Weight
	}
	hit := rand.Intn(total)
	for _, channel := range channels {
		hit -= channel.Weight
		if hit < 0 {
			return channel, upstreamModelForSelection(channel, modelName), nil
		}
	}
	return channels[0], upstreamModelForSelection(channels[0], modelName), nil
}

func ModelAllowsAPIRoute(modelName string, path string) bool {
	settings, err := repository.GetSettings()
	if err != nil {
		return false
	}
	channels := modelChannelsForModel(normalizePrivateSetting(settings.Private).Channels, modelName)
	for _, channel := range channels {
		for _, item := range channel.ModelItems {
			if !modelItemMatchesSelection(channel, item, modelName) {
				continue
			}
			for _, route := range item.APIRoutes {
				if normalizeModelAPIRoutePath(route.Path) == normalizeModelAPIRoutePath(path) {
					return route.Enabled
				}
			}
		}
	}
	return false
}

func BuildModelChannelURL(channel model.ModelChannel, path string) string {
	baseURL := normalizeModelChannelBaseURL(channel.BaseURL)
	lowerBaseURL := strings.ToLower(baseURL)
	if !strings.HasSuffix(lowerBaseURL, "/v1") && !strings.HasSuffix(lowerBaseURL, "/api/v3") && !strings.HasSuffix(lowerBaseURL, "/api/plan/v3") {
		baseURL += "/v1"
	}
	return baseURL + path
}

func normalizeModelChannelBaseURL(baseURL string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	parsed, err := url.Parse(baseURL)
	if err == nil && parsed.Scheme != "" && parsed.Host != "" {
		path := strings.TrimRight(parsed.Path, "/")
		lowerPath := strings.ToLower(path)
		if index := strings.Index(lowerPath, "/api/plan/v3"); index >= 0 {
			end := index + len("/api/plan/v3")
			if len(lowerPath) == end || lowerPath[end] == '/' {
				parsed.Path = path[:end]
				parsed.RawPath = ""
				parsed.RawQuery = ""
				parsed.Fragment = ""
				return strings.TrimRight(parsed.String(), "/")
			}
		}
	}
	return baseURL
}

func isArkAgentPlanChannel(channel model.ModelChannel) bool {
	baseURL := strings.ToLower(normalizeModelChannelBaseURL(channel.BaseURL))
	return strings.HasSuffix(baseURL, "/api/plan/v3")
}

func isSeedanceModelName(modelName string) bool {
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	return strings.Contains(modelName, "seedance") || strings.Contains(modelName, "doubao-seedance")
}

func SelectModelChannelAPIKey(channel model.ModelChannel) string {
	keys := modelChannelAPIKeys(channel.APIKey)
	if len(keys) == 0 {
		return ""
	}
	if len(keys) == 1 {
		return keys[0]
	}
	return keys[rand.Intn(len(keys))]
}

func modelChannelAPIKeys(value string) []string {
	keys := []string{}
	for _, key := range strings.Split(strings.ReplaceAll(value, "\r\n", "\n"), "\n") {
		key = strings.TrimSpace(key)
		if key != "" {
			keys = append(keys, key)
		}
	}
	return keys
}

func normalizeModelChannel(channel model.ModelChannel) model.ModelChannel {
	if channel.Protocol == "" {
		channel.Protocol = "openai"
	}
	if channel.Models == nil {
		channel.Models = []string{}
	}
	if len(channel.ModelItems) == 0 {
		for _, modelName := range channel.Models {
			modelName = strings.TrimSpace(modelName)
			if modelName == "" {
				continue
			}
			channel.ModelItems = append(channel.ModelItems, model.ModelItem{Model: modelName, Type: inferModelType(modelName), Selected: true, Enabled: true})
		}
	} else {
		items := make([]model.ModelItem, 0, len(channel.ModelItems))
		for _, item := range channel.ModelItems {
			item = normalizeModelItem(item)
			if item.Model != "" {
				items = append(items, item)
			}
		}
		channel.ModelItems = items
	}
	channel.Models = enabledModelNames(channel.ModelItems)
	channel.HasAPIKey = strings.TrimSpace(channel.APIKey) != "" || channel.HasAPIKey
	if channel.Weight <= 0 {
		channel.Weight = 1
	}
	return channel
}

func normalizeModelItem(item model.ModelItem) model.ModelItem {
	item.Model = strings.TrimSpace(item.Model)
	item.Name = strings.TrimSpace(item.Name)
	item.ThumbnailURL = strings.TrimSpace(item.ThumbnailURL)
	item.ProviderDisplayName = strings.TrimSpace(item.ProviderDisplayName)
	item.Description = strings.TrimSpace(item.Description)
	if item.Type == "" {
		item.Type = inferModelType(item.Model)
	}
	if item.Enabled {
		item.Selected = true
	}
	if !item.Selected {
		item.Enabled = false
	}
	item.Tags = cleanStrings(item.Tags)
	if item.Credits < 0 {
		item.Credits = 0
	}
	if item.SecondCredits < 0 {
		item.SecondCredits = 0
	}
	for i := range item.ResolutionCosts {
		item.ResolutionCosts[i].Resolution = strings.TrimSpace(item.ResolutionCosts[i].Resolution)
		if item.ResolutionCosts[i].Credits < 0 {
			item.ResolutionCosts[i].Credits = 0
		}
		if item.ResolutionCosts[i].Enabled == nil {
			enabled := true
			item.ResolutionCosts[i].Enabled = &enabled
		}
	}
	routes := make([]model.ModelAPIRoute, 0, len(defaultModelAPIRoutes(item.Type)))
	enabledByPath := map[string]bool{}
	for _, route := range item.APIRoutes {
		path := normalizeModelAPIRoutePath(route.Path)
		if path != "" {
			enabledByPath[path] = route.Enabled
		}
	}
	for _, route := range defaultModelAPIRoutes(item.Type) {
		route.Path = strings.TrimSpace(route.Path)
		if enabled, ok := enabledByPath[route.Path]; ok {
			route.Enabled = enabled
		}
		if route.Path != "" {
			routes = append(routes, route)
		}
	}
	item.APIRoutes = routes
	return item
}

func normalizeModelCost(item model.ModelCost) model.ModelCost {
	item.Model = strings.TrimSpace(item.Model)
	item.UpstreamModel = strings.TrimSpace(item.UpstreamModel)
	if item.UpstreamModel == "" {
		item.UpstreamModel = item.Model
	}
	item.Name = strings.TrimSpace(item.Name)
	item.ThumbnailURL = strings.TrimSpace(item.ThumbnailURL)
	item.ProviderName = strings.TrimSpace(item.ProviderName)
	item.ProviderEndpoint = ""
	item.ProviderDisplayName = strings.TrimSpace(item.ProviderDisplayName)
	item.Description = strings.TrimSpace(item.Description)
	if item.Type == "" {
		item.Type = inferModelType(item.UpstreamModel)
	}
	item.Tags = cleanStrings(item.Tags)
	if item.Credits < 0 {
		item.Credits = 0
	}
	if item.SecondCredits < 0 {
		item.SecondCredits = 0
	}
	for i := range item.ResolutionCosts {
		item.ResolutionCosts[i].Resolution = strings.TrimSpace(item.ResolutionCosts[i].Resolution)
		if item.ResolutionCosts[i].Credits < 0 {
			item.ResolutionCosts[i].Credits = 0
		}
		if item.ResolutionCosts[i].Enabled == nil {
			enabled := true
			item.ResolutionCosts[i].Enabled = &enabled
		}
	}
	return item
}

func defaultModelAPIRoutes(modelType model.ModelType) []model.ModelAPIRoute {
	switch modelType {
	case model.ModelTypeImage:
		return []model.ModelAPIRoute{
			{Path: "/images/generations", Enabled: true},
			{Path: "/images/edits"},
			{Path: "/chat/completions"},
			{Path: "/responses"},
			{Path: "/v1/async/generations"},
			{Path: "/v1/videos"},
		}
	case model.ModelTypeVideo:
		return []model.ModelAPIRoute{
			{Path: "/chat/completions"},
			{Path: "/video/generations", Enabled: true},
			{Path: "/v1/video/create"},
			{Path: "/videos"},
			{Path: "/v1/async/generations"},
			{Path: "/async/generations"},
			{Path: "/video/create"},
		}
	case model.ModelTypeAudio:
		return []model.ModelAPIRoute{{Path: "/audio/speech", Enabled: true}}
	default:
		return []model.ModelAPIRoute{{Path: "/chat/completions", Enabled: true}}
	}
}

func normalizeModelAPIRoutePath(path string) string {
	path = strings.TrimSpace(path)
	switch path {
	case "/v1/chat/completions":
		return "/chat/completions"
	case "/v1/images/generations":
		return "/images/generations"
	case "/v1/images/edits":
		return "/images/edits"
	case "/v1/responses":
		return "/responses"
	case "/v1/audio/speech":
		return "/audio/speech"
	case "/v1/videos/generations", "/v1/video/generations":
		return "/video/generations"
	default:
		return path
	}
}

func enabledModelNames(items []model.ModelItem) []string {
	result := []string{}
	for _, item := range items {
		if item.Selected && item.Enabled && strings.TrimSpace(item.Model) != "" {
			result = append(result, strings.TrimSpace(item.Model))
		}
	}
	return uniqueStrings(result)
}

func uniqueStrings(items []string) []string {
	seen := map[string]bool{}
	result := []string{}
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" || seen[item] {
			continue
		}
		seen[item] = true
		result = append(result, item)
	}
	return result
}

func cleanStrings(items []string) []string {
	result := []string{}
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item != "" {
			result = append(result, item)
		}
	}
	return uniqueStrings(result)
}

func inferModelType(modelName string) model.ModelType {
	value := strings.ToLower(modelName)
	if strings.Contains(value, "audio") || strings.Contains(value, "tts") || strings.Contains(value, "speech") || strings.Contains(value, "voice") || strings.Contains(value, "music") || strings.Contains(value, "sound") {
		return model.ModelTypeAudio
	}
	if strings.Contains(value, "seedance") || strings.Contains(value, "video") || strings.Contains(value, "sora") || strings.Contains(value, "veo") || strings.Contains(value, "kling") || strings.Contains(value, "runway") || strings.Contains(value, "grok-imagine-video") || strings.Contains(value, "wan") || strings.Contains(value, "hailuo") {
		return model.ModelTypeVideo
	}
	if strings.Contains(value, "seedream") || strings.Contains(value, "image") || strings.Contains(value, "dall") || strings.Contains(value, "imagen") || strings.Contains(value, "flux") || strings.Contains(value, "sdxl") || strings.Contains(value, "stable") || strings.Contains(value, "midjourney") || strings.Contains(value, "gpt-image") {
		return model.ModelTypeImage
	}
	return model.ModelTypeText
}

func findModelCost(items []model.ModelCost, modelName string) (model.ModelCost, bool) {
	modelName = strings.TrimSpace(modelName)
	for _, item := range items {
		item = normalizeModelCost(item)
		if strings.TrimSpace(item.Model) == modelName || strings.TrimSpace(item.UpstreamModel) == modelName {
			return normalizeModelCost(item), true
		}
	}
	return model.ModelCost{}, false
}

func modelResolutionCredits(item model.ModelCost, resolution string) int {
	bucket := imageResolutionBucket(resolution)
	for _, cost := range item.ResolutionCosts {
		if cost.Enabled != nil && !*cost.Enabled {
			continue
		}
		value := strings.TrimSpace(cost.Resolution)
		if strings.EqualFold(value, resolution) || strings.EqualFold(value, bucket) {
			return cost.Credits
		}
	}
	return item.Credits
}

func imageResolutionBucket(resolution string) string {
	value := strings.ToLower(strings.TrimSpace(resolution))
	if value == "1k" || value == "2k" || value == "4k" {
		return value
	}
	if value == "low" || value == "standard" || value == "auto" {
		return "1k"
	}
	if value == "medium" || value == "hd" {
		return "2k"
	}
	if value == "high" {
		return "4k"
	}
	parts := strings.Split(value, "x")
	if len(parts) != 2 {
		return "1k"
	}
	width, _ := strconv.Atoi(parts[0])
	height, _ := strconv.Atoi(parts[1])
	shortSide := width
	if height < shortSide {
		shortSide = height
	}
	if shortSide > 1600 {
		return "4k"
	}
	if shortSide > 1100 {
		return "2k"
	}
	return "1k"
}

func maxPositiveInt(values ...int) int {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 1
}

func readAIRequestString(body []byte, contentType string, key string) string {
	if strings.HasPrefix(contentType, "multipart/form-data") {
		_, params, err := mime.ParseMediaType(contentType)
		if err != nil {
			return ""
		}
		form, err := multipart.NewReader(bytes.NewReader(body), params["boundary"]).ReadForm(32 << 20)
		if err != nil {
			return ""
		}
		defer form.RemoveAll()
		if values := form.Value[key]; len(values) > 0 {
			return values[0]
		}
		return ""
	}
	var payload map[string]any
	if json.Unmarshal(body, &payload) != nil {
		return ""
	}
	if value, ok := payload[key]; ok {
		return fmt.Sprint(value)
	}
	return ""
}

func readAIRequestInt(body []byte, contentType string, key string) int {
	value := strings.TrimSpace(readAIRequestString(body, contentType, key))
	if value == "" {
		return 0
	}
	result, _ := strconv.Atoi(value)
	return result
}

func resolveAdminChannel(index *int, channel model.ModelChannel) (model.ModelChannel, error) {
	resolved := normalizeModelChannel(channel)
	if strings.TrimSpace(resolved.APIKey) == "" {
		settings, err := repository.GetSettings()
		if err != nil {
			return model.ModelChannel{}, err
		}
		saved := normalizePrivateSetting(settings.Private).Channels
		if index != nil && *index >= 0 && *index < len(saved) {
			if resolved.APIKey == "" {
				resolved.APIKey = saved[*index].APIKey
			}
			if resolved.BaseURL == "" {
				resolved.BaseURL = saved[*index].BaseURL
			}
			if resolved.Name == "" {
				resolved.Name = saved[*index].Name
			}
		}
		if resolved.APIKey == "" {
			if savedChannel, ok := findSavedChannel(resolved, saved, -1); ok {
				resolved.APIKey = savedChannel.APIKey
			}
		}
	}
	if strings.TrimSpace(resolved.BaseURL) == "" {
		return model.ModelChannel{}, safeMessageError{message: "缺少接口地址"}
	}
	if strings.TrimSpace(resolved.APIKey) == "" {
		return model.ModelChannel{}, safeMessageError{message: "缺少 API Key"}
	}
	return resolved, nil
}

func fetchAdminChannelModels(channel model.ModelChannel) ([]string, error) {
	var lastErr error
	for _, url := range adminModelListURLs(channel) {
		request, err := http.NewRequest(http.MethodGet, url, nil)
		if err != nil {
			lastErr = err
			continue
		}
		request.Header.Set("Authorization", "Bearer "+SelectModelChannelAPIKey(channel))
		response, err := adminModelHTTPClient.Do(request)
		if err != nil {
			lastErr = safeMessageError{message: "读取模型失败：上游接口无响应或网络不可达"}
			continue
		}
		body, _ := io.ReadAll(response.Body)
		_ = response.Body.Close()
		if response.StatusCode >= http.StatusBadRequest {
			if response.StatusCode == http.StatusNotFound && isArkAgentPlanChannel(channel) {
				lastErr = safeMessageError{message: "火山方舟 Agent Plan 未提供 OpenAI /models 模型列表接口，请手动填写模型名称，例如 doubao-seedance-2.0。"}
				continue
			}
			lastErr = readAdminChannelError(body, response.StatusCode, "读取模型失败")
			continue
		}
		result := parseAdminChannelModels(body)
		if len(result) > 0 {
			return result, nil
		}
		lastErr = safeMessageError{message: "模型列表为空或响应格式无法识别"}
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, safeMessageError{message: "读取模型失败"}
}

func testAdminChannelModel(channel model.ModelChannel, modelName string) (string, error) {
	if strings.TrimSpace(modelName) == "" {
		return "", errors.New("缺少模型名称")
	}
	body, _ := json.Marshal(map[string]any{
		"model": modelName,
		"messages": []map[string]string{{
			"role":    "user",
			"content": "hi",
		}},
	})
	request, err := http.NewRequest(http.MethodPost, BuildModelChannelURL(channel, "/chat/completions"), strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	request.Header.Set("Authorization", "Bearer "+SelectModelChannelAPIKey(channel))
	request.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	responseBody, _ := io.ReadAll(response.Body)
	if response.StatusCode >= http.StatusBadRequest {
		return "", readAdminChannelError(responseBody, response.StatusCode, "测试失败")
	}
	var payload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	_ = json.Unmarshal(responseBody, &payload)
	if len(payload.Choices) > 0 && strings.TrimSpace(payload.Choices[0].Message.Content) != "" {
		return payload.Choices[0].Message.Content, nil
	}
	return "ok", nil
}

func testArkSeedanceChannelModel(channel model.ModelChannel, modelName string) (string, error) {
	if strings.TrimSpace(modelName) == "" {
		return "", errors.New("缺少模型名称")
	}
	if strings.TrimSpace(channel.BaseURL) == "" {
		return "", safeMessageError{message: "缺少接口地址"}
	}
	if strings.TrimSpace(channel.APIKey) == "" {
		return "", safeMessageError{message: "缺少 API Key"}
	}
	if !isArkAgentPlanChannel(channel) {
		return "", safeMessageError{message: "Seedance 2.0 请使用火山方舟 Agent Plan Base URL：https://ark.cn-beijing.volces.com/api/plan/v3"}
	}
	return "Agent Plan / Seedance 视频模型配置格式已通过。后台测试不会调用视频生成接口，请在画布中使用视频生成验证模型权限。", nil
}

func readAdminChannelError(body []byte, statusCode int, fallback string) error {
	var payload struct {
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
		Msg string `json:"msg"`
	}
	if len(body) > 0 && json.Unmarshal(body, &payload) == nil {
		if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
			return safeMessageError{message: payload.Error.Message}
		}
		if strings.TrimSpace(payload.Msg) != "" {
			return safeMessageError{message: payload.Msg}
		}
	}
	if statusCode == http.StatusUnauthorized {
		return safeMessageError{message: "上游接口认证失败（401），请检查 API Key"}
	}
	if statusCode > 0 {
		return safeMessageError{message: fmt.Sprintf("%s：%d", fallback, statusCode)}
	}
	return safeMessageError{message: fallback}
}

func adminModelListURLs(channel model.ModelChannel) []string {
	baseURL := strings.TrimRight(channel.BaseURL, "/")
	candidates := []string{
		BuildModelChannelURL(channel, "/models"),
		baseURL + "/models",
		baseURL + "/v1/models",
		baseURL + "/v1beta/models",
	}
	return uniqueStrings(candidates)
}

func parseAdminChannelModels(body []byte) []string {
	var payload any
	if len(body) == 0 || json.Unmarshal(body, &payload) != nil {
		return []string{}
	}
	seen := map[string]bool{}
	collectAdminChannelModels(payload, seen)
	result := make([]string, 0, len(seen))
	for item := range seen {
		result = append(result, item)
	}
	sort.Strings(result)
	return result
}

func collectAdminChannelModels(value any, result map[string]bool) {
	switch current := value.(type) {
	case []any:
		for _, item := range current {
			collectAdminChannelModels(item, result)
		}
	case map[string]any:
		if modelName := readAdminChannelModelName(current); modelName != "" {
			result[modelName] = true
		}
		for _, key := range []string{"data", "models", "items", "result", "list", "model_prices", "modelPrices"} {
			if child, ok := current[key]; ok {
				collectAdminChannelModels(child, result)
			}
		}
	}
}

func readAdminChannelModelName(item map[string]any) string {
	for _, key := range []string{"id", "model", "model_name", "modelName", "name"} {
		if value, ok := item[key].(string); ok {
			value = strings.TrimSpace(strings.TrimPrefix(value, "models/"))
			if value != "" {
				return value
			}
		}
	}
	return ""
}

type safeMessageError struct {
	message string
}

func (err safeMessageError) Error() string {
	return err.message
}

func (err safeMessageError) SafeMessage() string {
	return err.message
}

func modelChannelsForModel(channels []model.ModelChannel, modelName string) []model.ModelChannel {
	result := []model.ModelChannel{}
	modelName = strings.TrimSpace(modelName)
	for _, channel := range channels {
		if !channel.Enabled || channel.BaseURL == "" || channel.APIKey == "" {
			continue
		}
		for _, item := range channel.ModelItems {
			if modelItemMatchesSelection(channel, item, modelName) {
				result = append(result, channel)
				break
			}
		}
	}
	return result
}

func modelItemMatchesSelection(channel model.ModelChannel, item model.ModelItem, modelName string) bool {
	modelName = strings.TrimSpace(modelName)
	legacyParts := []string{
		strings.TrimSpace(channel.Name),
		normalizeModelChannelBaseURL(channel.BaseURL),
		strings.TrimSpace(item.Model),
	}
	return publicModelID(channel, item) == modelName || strings.Join(legacyParts, "||") == modelName || strings.TrimSpace(item.Model) == modelName
}

func upstreamModelForSelection(channel model.ModelChannel, modelName string) string {
	modelName = strings.TrimSpace(modelName)
	for _, item := range channel.ModelItems {
		if modelItemMatchesSelection(channel, item, modelName) {
			return strings.TrimSpace(item.Model)
		}
	}
	return modelName
}
