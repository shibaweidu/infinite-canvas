package service

import (
	"errors"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
)

const (
	awesomeGptImageRawBase      = "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main"
	youMindGptImage2RawBase     = "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main"
	youMindNanoBananaProRawBase = "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/main"
)

func SyncPromptCategory(category string) ([]model.PromptCategory, error) {
	for _, item := range repository.PromptCategories() {
		if item.Category != category {
			continue
		}
		items, err := buildPromptCategory(item.Category)
		if err != nil {
			return nil, err
		}
		if len(items) == 0 {
			return nil, errors.New("远程提示词解析结果为空，已保留本地旧数据")
		}
		if err := repository.ReplacePromptCategory(item, items); err != nil {
			return nil, err
		}
		return repository.ListPromptCategories()
	}
	return nil, errors.New("未知提示词分类")
}

func buildPromptCategory(category string) ([]model.Prompt, error) {
	switch category {
	case "awesome-gpt-image":
		return buildAwesomeGptImagePrompts()
	case "youmind-gpt-image-2":
		return buildYouMindGptImage2Prompts()
	case "youmind-nano-banana-pro":
		return buildYouMindNanoBananaProPrompts()
	}
	return nil, errors.New("未知提示词分类")
}

func fetchText(baseURL, file string) (string, error) {
	request, _ := http.NewRequest(http.MethodGet, baseURL+"/"+file, nil)
	client := http.Client{Timeout: 30 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", errors.New(file + " 拉取失败")
	}
	data, err := io.ReadAll(response.Body)
	return string(data), err
}

func buildAwesomeGptImagePrompts() ([]model.Prompt, error) {
	markdown, err := fetchText(awesomeGptImageRawBase, "README.zh-CN.md")
	if err != nil {
		return nil, err
	}
	items := []model.Prompt{}
	for _, section := range splitBeforeHeading(markdown, "## ") {
		tags := tagsFromHeading(firstMatch(section, `(?m)^##\s+(.+)$`))
		for _, block := range splitBeforeHeading(section, "### ") {
			title := strings.TrimSpace(regexp.MustCompile(`\[([^\]]+)]\([^)]+\)`).ReplaceAllString(firstMatch(block, `(?m)^###\s+(.+)$`), "$1"))
			prompt := strings.TrimSpace(firstMatch(block, "(?s)\\*\\*提示词:\\*\\*\\s*\\r?\\n\\s*```[\\w-]*\\r?\\n(.*?)\\r?\\n```"))
			if title == "" || prompt == "" {
				continue
			}
			images := extractMarkdownImages(awesomeGptImageRawBase, block)
			cover := ""
			if len(images) > 0 {
				cover = images[0]
			}
			items = append(items, model.Prompt{ID: "awesome-gpt-image-" + leftPad(len(items)+1), Title: title, CoverURL: cover, Prompt: prompt, Tags: tags, Preview: markdownPreview(images)})
		}
	}
	return items, nil
}

func buildYouMindGptImage2Prompts() ([]model.Prompt, error) {
	return buildYouMindPrompts(youMindGptImage2RawBase, "youmind-gpt-image-2", "gpt-image-2")
}

func buildYouMindNanoBananaProPrompts() ([]model.Prompt, error) {
	return buildYouMindPrompts(youMindNanoBananaProRawBase, "youmind-nano-banana-pro", "nano-banana-pro")
}

func buildYouMindPrompts(baseURL, idPrefix, modelTag string) ([]model.Prompt, error) {
	markdown, err := fetchText(baseURL, "README_zh.md")
	if err != nil {
		return nil, err
	}
	items := []model.Prompt{}
	for _, block := range splitBeforeHeading(markdown, "### ") {
		title := strings.TrimSpace(firstMatch(block, `(?m)^###\s+No\.\s*\d+:\s*(.+)$`))
		prompt := strings.TrimSpace(firstMatch(block, "(?s)#### .*?提示词\\s*\\r?\\n\\s*```[\\w-]*\\r?\\n(.*?)\\r?\\n```"))
		if title == "" || prompt == "" {
			continue
		}
		images := extractMarkdownImages(baseURL, block)
		cover := ""
		if len(images) > 0 {
			cover = images[0]
		}
		items = append(items, model.Prompt{ID: idPrefix + "-" + leftPad(len(items)+1), Title: title, CoverURL: cover, Prompt: prompt, Tags: youMindTags(title, modelTag), Preview: markdownPreview(images)})
	}
	return items, nil
}

func splitBeforeHeading(markdown string, prefix string) []string {
	blocks := []string{}
	lines := strings.Split(markdown, "\n")
	current := []string{}
	for _, line := range lines {
		if strings.HasPrefix(line, prefix) && len(current) > 0 {
			blocks = append(blocks, strings.Join(current, "\n"))
			current = []string{}
		}
		current = append(current, line)
	}
	return append(blocks, strings.Join(current, "\n"))
}

func firstMatch(value string, pattern string) string {
	match := regexp.MustCompile(pattern).FindStringSubmatch(value)
	if len(match) > 1 {
		return match[1]
	}
	return ""
}

func tagsFromCategory(category string) []string {
	return splitTags(regexp.MustCompile(`(?i)\s+Cases$`).ReplaceAllString(category, ""), `\s*(&|and)\s*`)
}

func tagsFromHeading(heading string) []string {
	return splitTags(regexp.MustCompile(`[^\p{L}\p{N}/&、与 ]`).ReplaceAllString(heading, ""), `\s*(/|&|、|与)\s*`)
}

func youMindTags(title, modelTag string) []string {
	tags := []string{modelTag}
	parts := strings.SplitN(title, " - ", 2)
	if len(parts) > 1 {
		tags = append(tags, tagsFromHeading(parts[0])...)
	}
	return tags
}

func splitTags(value string, pattern string) []string {
	tags := []string{}
	for _, tag := range regexp.MustCompile(pattern).Split(value, -1) {
		if tag = strings.ToLower(strings.TrimSpace(tag)); tag != "" {
			tags = append(tags, tag)
		}
	}
	return tags
}

func markdownPreview(images []string) string {
	lines := []string{}
	for _, image := range images {
		if image != "" {
			lines = append(lines, "![]("+image+")")
		}
	}
	return strings.Join(lines, "\n\n")
}

func extractMarkdownImages(baseURL string, block string) []string {
	seen := map[string]bool{}
	images := []string{}
	for _, pattern := range []string{`<img[^>]+src="([^"]+)"`, `!\[[^\]]*]\(([^)]+)\)`} {
		for _, match := range regexp.MustCompile(pattern).FindAllStringSubmatch(block, -1) {
			image := absoluteImage(baseURL, match[1])
			if image != "" && !seen[image] {
				seen[image] = true
				images = append(images, image)
			}
		}
	}
	return images
}

func absoluteImage(baseURL, image string) string {
	if image == "" || strings.HasPrefix(image, "http://") || strings.HasPrefix(image, "https://") {
		return image
	}
	return baseURL + "/" + strings.TrimLeft(strings.TrimPrefix(image, "."), "/")
}

func leftPad(value int) string {
	if value >= 1000 {
		return strconv.Itoa(value)
	}
	text := "000" + strconv.Itoa(value)
	return text[len(text)-3:]
}
