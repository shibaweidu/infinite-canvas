package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
	"golang.org/x/net/html"
)

const homeImportMaxPageBytes = 2 << 20
const homeImportMaxMediaBytes = 120 << 20

type HomeWorkImportResult struct {
	Title          string               `json:"title"`
	Description    string               `json:"description"`
	Type           model.HomeWorkType   `json:"type"`
	CoverURL       string               `json:"coverUrl"`
	MediaURL       string               `json:"mediaUrl"`
	Prompt         string               `json:"prompt"`
	Model          string               `json:"model"`
	Category       string               `json:"category"`
	Tags           []string             `json:"tags"`
	Status         model.HomeWorkStatus `json:"status"`
	ShowPrompt     bool                 `json:"showPrompt"`
	AllowSameStyle bool                 `json:"allowSameStyle"`
	SourceURL      string               `json:"sourceUrl"`
}

type importedPage struct {
	URL         string
	Title       string
	Description string
	Text        string
	ImageURL    string
	VideoURL    string
	MediaURL    string
	MediaType   model.HomeWorkType
}

type homeWorkAIResult struct {
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Prompt         string   `json:"prompt"`
	Model          string   `json:"model"`
	Category       string   `json:"category"`
	Tags           []string `json:"tags"`
	ShowPrompt     *bool    `json:"showPrompt"`
	AllowSameStyle *bool    `json:"allowSameStyle"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func ImportHomeWorkFromURL(rawURL string, modelName string) (HomeWorkImportResult, error) {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return HomeWorkImportResult{}, safeMessageError{message: "请填写作品链接"}
	}
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return HomeWorkImportResult{}, safeMessageError{message: "作品链接格式不正确"}
	}
	page, err := fetchImportedPage(parsed.String())
	if err != nil {
		return HomeWorkImportResult{}, err
	}
	mediaURL := page.MediaURL
	if mediaURL == "" {
		mediaURL = firstImportedNonEmpty(page.VideoURL, page.ImageURL)
	}
	if mediaURL == "" {
		return HomeWorkImportResult{}, safeMessageError{message: "未从链接中找到可下载的作品图片或视频"}
	}
	media, err := downloadImportedMedia(mediaURL)
	if err != nil {
		return HomeWorkImportResult{}, err
	}
	if detectedType := inferHomeWorkType("", media.mimeType); detectedType != "" {
		page.MediaType = detectedType
	}
	uploadedMedia, err := UploadHomeMedia(media.filename, media.mimeType, media.data)
	if err != nil {
		return HomeWorkImportResult{}, err
	}
	coverURL := uploadedMedia.URL
	if page.MediaType == model.HomeWorkTypeVideo && page.ImageURL != "" && page.ImageURL != mediaURL {
		if cover, err := downloadImportedMedia(page.ImageURL); err == nil {
			if uploadedCover, err := UploadHomeMedia(cover.filename, cover.mimeType, cover.data); err == nil {
				coverURL = uploadedCover.URL
			}
		}
	}
	ai, err := analyzeImportedHomeWork(page, modelName)
	if err != nil {
		return HomeWorkImportResult{}, err
	}
	result := HomeWorkImportResult{
		Title:          firstImportedNonEmpty(strings.TrimSpace(ai.Title), page.Title, "未命名作品"),
		Description:    firstImportedNonEmpty(strings.TrimSpace(ai.Description), page.Description),
		Type:           page.MediaType,
		CoverURL:       coverURL,
		MediaURL:       uploadedMedia.URL,
		Prompt:         strings.TrimSpace(ai.Prompt),
		Model:          strings.TrimSpace(ai.Model),
		Category:       normalizeImportedCategory(ai.Category),
		Tags:           normalizeImportedTags(ai.Tags),
		Status:         model.HomeWorkStatusPending,
		ShowPrompt:     true,
		AllowSameStyle: true,
		SourceURL:      page.URL,
	}
	if ai.ShowPrompt != nil {
		result.ShowPrompt = *ai.ShowPrompt
	}
	if ai.AllowSameStyle != nil {
		result.AllowSameStyle = *ai.AllowSameStyle
	}
	return result, nil
}

type importedMedia struct {
	filename string
	mimeType string
	data     []byte
}

func fetchImportedPage(rawURL string) (importedPage, error) {
	mediaType := inferHomeWorkType(rawURL, "")
	if mediaType != "" {
		return importedPage{URL: rawURL, MediaURL: rawURL, MediaType: mediaType}, nil
	}
	request, _ := http.NewRequest(http.MethodGet, rawURL, nil)
	request.Header.Set("User-Agent", "Mozilla/5.0")
	client := http.Client{Timeout: 30 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return importedPage{}, safeMessageError{message: "作品链接无法访问"}
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return importedPage{}, safeMessageError{message: fmt.Sprintf("作品链接访问失败：%d", response.StatusCode)}
	}
	contentType := strings.ToLower(response.Header.Get("Content-Type"))
	if strings.HasPrefix(contentType, "image/") || strings.HasPrefix(contentType, "video/") {
		return importedPage{URL: rawURL, MediaURL: rawURL, MediaType: inferHomeWorkType(rawURL, contentType)}, nil
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, homeImportMaxPageBytes+1))
	if err != nil || len(data) == 0 {
		return importedPage{}, safeMessageError{message: "作品页面读取失败"}
	}
	if len(data) > homeImportMaxPageBytes {
		return importedPage{}, safeMessageError{message: "作品页面过大，暂不支持自动解析"}
	}
	page := parseImportedHTML(rawURL, string(data))
	page.URL = rawURL
	page.MediaType = inferHomeWorkType(firstImportedNonEmpty(page.VideoURL, page.ImageURL), "")
	if page.MediaType == "" {
		page.MediaType = model.HomeWorkTypeImage
	}
	return page, nil
}

func parseImportedHTML(baseURL string, body string) importedPage {
	doc, err := html.Parse(strings.NewReader(body))
	if err != nil {
		return importedPage{}
	}
	page := importedPage{}
	var textParts []string
	var walk func(*html.Node)
	walk = func(node *html.Node) {
		if node.Type == html.ElementNode {
			switch strings.ToLower(node.Data) {
			case "title":
				page.Title = firstImportedNonEmpty(page.Title, strings.TrimSpace(nodeText(node)))
			case "meta":
				name := strings.ToLower(firstAttr(node, "name"))
				property := strings.ToLower(firstAttr(node, "property"))
				content := strings.TrimSpace(firstAttr(node, "content"))
				switch {
				case name == "description" || property == "og:description" || property == "twitter:description":
					page.Description = firstImportedNonEmpty(page.Description, content)
				case property == "og:title" || property == "twitter:title":
					page.Title = firstImportedNonEmpty(page.Title, content)
				case property == "og:image" || property == "og:image:secure_url" || property == "twitter:image":
					page.ImageURL = firstImportedNonEmpty(page.ImageURL, absoluteURL(baseURL, content))
				case property == "og:video" || property == "og:video:url" || property == "og:video:secure_url" || property == "twitter:player:stream":
					page.VideoURL = firstImportedNonEmpty(page.VideoURL, absoluteURL(baseURL, content))
				}
			case "img":
				page.ImageURL = firstImportedNonEmpty(page.ImageURL, absoluteURL(baseURL, firstImportedNonEmpty(firstAttr(node, "src"), firstAttr(node, "data-src"))))
			case "video":
				page.VideoURL = firstImportedNonEmpty(page.VideoURL, absoluteURL(baseURL, firstAttr(node, "src")))
			case "source":
				if page.VideoURL == "" && strings.HasPrefix(strings.ToLower(firstAttr(node, "type")), "video/") {
					page.VideoURL = absoluteURL(baseURL, firstAttr(node, "src"))
				}
			}
		}
		if node.Type == html.TextNode {
			text := strings.TrimSpace(node.Data)
			if text != "" {
				textParts = append(textParts, text)
			}
		}
		for child := node.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(doc)
	page.Text = compactText(strings.Join(textParts, " "))
	return page
}

func downloadImportedMedia(rawURL string) (importedMedia, error) {
	request, _ := http.NewRequest(http.MethodGet, rawURL, nil)
	request.Header.Set("User-Agent", "Mozilla/5.0")
	client := http.Client{Timeout: 60 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return importedMedia{}, safeMessageError{message: "作品媒体无法下载"}
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return importedMedia{}, safeMessageError{message: fmt.Sprintf("作品媒体下载失败：%d", response.StatusCode)}
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, homeImportMaxMediaBytes+1))
	if err != nil || len(data) == 0 {
		return importedMedia{}, safeMessageError{message: "作品媒体读取失败"}
	}
	if len(data) > homeImportMaxMediaBytes {
		return importedMedia{}, safeMessageError{message: "作品媒体不能超过 120MB"}
	}
	mimeType := strings.TrimSpace(strings.Split(response.Header.Get("Content-Type"), ";")[0])
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}
	return importedMedia{filename: importedMediaFilename(rawURL, mimeType), mimeType: mimeType, data: data}, nil
}

func analyzeImportedHomeWork(page importedPage, modelName string) (homeWorkAIResult, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return homeWorkAIResult{}, err
	}
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		modelName = strings.TrimSpace(settings.Public.ModelChannel.DefaultTextModel)
	}
	if modelName == "" {
		return homeWorkAIResult{}, safeMessageError{message: "请先在后台系统设置中配置默认文本模型"}
	}
	channel, upstreamModel, err := SelectModelChannelWithModel(modelName)
	if err != nil {
		return homeWorkAIResult{}, safeMessageError{message: "默认文本模型不可用，请检查模型渠道配置"}
	}
	categoryNames := homeCategoryNames()
	tagNames := homeTagNames()
	system := "你是作品发布助手。只输出 JSON，不要输出 Markdown。根据网页信息整理作品发布表单，分类和标签优先从给定候选中选择；如果无法确认提示词，可以根据作品信息推测一版并保持简洁。"
	user := fmt.Sprintf("作品链接：%s\n页面标题：%s\n页面描述：%s\n页面文本：%s\n媒体类型：%s\n分类候选：%s\n标签候选：%s\n请输出 JSON：{\"title\":\"\",\"description\":\"\",\"prompt\":\"\",\"model\":\"\",\"category\":\"\",\"tags\":[],\"showPrompt\":true,\"allowSameStyle\":true}",
		page.URL, page.Title, page.Description, truncateText(page.Text, 5000), page.MediaType, strings.Join(categoryNames, "、"), strings.Join(tagNames, "、"))
	body, _ := json.Marshal(map[string]any{
		"model": upstreamModel,
		"messages": []map[string]string{
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		},
		"temperature": 0.2,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, BuildModelChannelURL(channel, "/chat/completions"), bytes.NewReader(body))
	if err != nil {
		return homeWorkAIResult{}, err
	}
	request.Header.Set("Authorization", "Bearer "+SelectModelChannelAPIKey(channel))
	request.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return homeWorkAIResult{}, safeMessageError{message: "大模型解析失败，请稍后重试"}
	}
	defer response.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return homeWorkAIResult{}, safeMessageError{message: "大模型解析失败，请检查默认文本模型配置"}
	}
	var completion chatCompletionResponse
	if err := json.Unmarshal(data, &completion); err != nil || len(completion.Choices) == 0 {
		return homeWorkAIResult{}, safeMessageError{message: "大模型解析结果格式异常"}
	}
	var result homeWorkAIResult
	if err := json.Unmarshal([]byte(extractJSONObject(completion.Choices[0].Message.Content)), &result); err != nil {
		return homeWorkAIResult{}, safeMessageError{message: "大模型解析结果格式异常"}
	}
	return result, nil
}

func homeCategoryNames() []string {
	items, _ := repository.ListHomeCategories(true)
	names := []string{}
	for _, item := range items {
		if item.Enabled && strings.TrimSpace(item.Name) != "" {
			names = append(names, strings.TrimSpace(item.Name))
		}
	}
	return names
}

func homeTagNames() []string {
	items, _ := repository.ListHomeTags(true)
	names := []string{}
	for _, item := range items {
		if item.Enabled && strings.TrimSpace(item.Name) != "" {
			names = append(names, strings.TrimSpace(item.Name))
		}
	}
	return names
}

func normalizeImportedCategory(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	for _, name := range homeCategoryNames() {
		if strings.EqualFold(name, value) {
			return name
		}
	}
	return ""
}

func normalizeImportedTags(values []string) []string {
	allowed := map[string]string{}
	for _, name := range homeTagNames() {
		allowed[strings.ToLower(name)] = name
	}
	result := []string{}
	seen := map[string]bool{}
	for _, value := range values {
		key := strings.ToLower(strings.TrimSpace(value))
		name := allowed[key]
		if name != "" && !seen[name] {
			seen[name] = true
			result = append(result, name)
		}
	}
	return result
}

func inferHomeWorkType(rawURL string, mimeType string) model.HomeWorkType {
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	ext := strings.ToLower(path.Ext(strings.Split(rawURL, "?")[0]))
	if strings.HasPrefix(mimeType, "video/") || ext == ".mp4" || ext == ".webm" || ext == ".mov" || ext == ".m4v" {
		return model.HomeWorkTypeVideo
	}
	if strings.HasPrefix(mimeType, "image/") || ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" || ext == ".gif" {
		return model.HomeWorkTypeImage
	}
	return ""
}

func importedMediaFilename(rawURL string, mimeType string) string {
	parsed, _ := url.Parse(rawURL)
	name := path.Base(parsed.Path)
	if name == "." || name == "/" || !strings.Contains(name, ".") {
		extensions, _ := mime.ExtensionsByType(strings.TrimSpace(strings.Split(mimeType, ";")[0]))
		ext := ".png"
		if len(extensions) > 0 {
			ext = extensions[0]
		}
		name = "imported-work" + ext
	}
	return name
}

func absoluteURL(baseURL string, value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	parsed, err := url.Parse(value)
	if err == nil && parsed.Scheme != "" && parsed.Host != "" {
		return parsed.String()
	}
	base, err := url.Parse(baseURL)
	if err != nil {
		return value
	}
	child, err := url.Parse(value)
	if err != nil {
		return value
	}
	return base.ResolveReference(child).String()
}

func firstAttr(node *html.Node, key string) string {
	for _, attr := range node.Attr {
		if strings.EqualFold(attr.Key, key) {
			return attr.Val
		}
	}
	return ""
}

func nodeText(node *html.Node) string {
	var parts []string
	var walk func(*html.Node)
	walk = func(current *html.Node) {
		if current.Type == html.TextNode {
			parts = append(parts, current.Data)
		}
		for child := current.FirstChild; child != nil; child = child.NextSibling {
			walk(child)
		}
	}
	walk(node)
	return strings.Join(parts, " ")
}

func compactText(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func truncateText(value string, limit int) string {
	value = strings.TrimSpace(value)
	if len([]rune(value)) <= limit {
		return value
	}
	runes := []rune(value)
	return string(runes[:limit])
}

func extractJSONObject(value string) string {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "```") {
		value = regexp.MustCompile("(?s)^```(?:json)?\\s*(.*?)\\s*```$").ReplaceAllString(value, "$1")
	}
	start := strings.Index(value, "{")
	end := strings.LastIndex(value, "}")
	if start >= 0 && end > start {
		return value[start : end+1]
	}
	return value
}

func firstImportedNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
