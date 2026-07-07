package service

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
)

const (
	aiImageGenerationTaskType = "ai_image_generation"
	aiImageEditTaskType       = "ai_image_edit"
	aiVideoTaskType           = "ai_video_generation"
)

type AITaskPayload struct {
	Path        string `json:"path"`
	ContentType string `json:"contentType"`
	BodyBase64  string `json:"bodyBase64"`
	Model       string `json:"model"`
	Credits     int    `json:"credits"`
	Charged     bool   `json:"charged"`
	RetryOf     string `json:"retryOf,omitempty"`
}

type AITaskResult struct {
	ContentType    string `json:"contentType,omitempty"`
	Body           string `json:"body,omitempty"`
	Base64         string `json:"base64,omitempty"`
	URL            string `json:"url,omitempty"`
	MimeType       string `json:"mimeType,omitempty"`
	UpstreamTaskID string `json:"upstreamTaskId,omitempty"`
}

func EnqueueAIProxyTask(user model.AuthUser, path string, body []byte, contentType string, modelName string) (model.SystemTask, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return model.SystemTask{}, safeMessageError{message: "missing model"}
	}
	if !ModelAllowsAPIRoute(modelName, path) {
		return model.SystemTask{}, safeMessageError{message: "model route is disabled"}
	}
	if _, _, err := SelectModelChannelWithModel(modelName); err != nil {
		return model.SystemTask{}, err
	}
	credits, err := ModelRequestCost(modelName, path, body, contentType)
	if err != nil {
		return model.SystemTask{}, err
	}
	now := time.Now().Format(time.RFC3339)
	payload, _ := json.Marshal(AITaskPayload{
		Path:        path,
		ContentType: contentType,
		BodyBase64:  base64.StdEncoding.EncodeToString(body),
		Model:       modelName,
		Credits:     credits,
	})
	task := model.SystemTask{
		ID:        newID("task"),
		Type:      aiTaskTypeForPath(path),
		Status:    model.SystemTaskStatusPending,
		Title:     aiTaskTitleForPath(path),
		Payload:   string(payload),
		CreatedBy: user.ID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	return task, repository.SaveSystemTask(task)
}

func GetUserSystemTask(user model.AuthUser, id string) (model.SystemTask, error) {
	task, ok, err := repository.GetSystemTaskByID(id)
	if err != nil {
		return model.SystemTask{}, err
	}
	if !ok || task.CreatedBy != user.ID {
		return model.SystemTask{}, safeMessageError{message: "task not found"}
	}
	task.Payload = ""
	return task, nil
}

func aiTaskTypeForPath(path string) string {
	switch path {
	case "/images/edits":
		return aiImageEditTaskType
	case "/videos":
		return aiVideoTaskType
	default:
		return aiImageGenerationTaskType
	}
}

func aiTaskTitleForPath(path string) string {
	switch path {
	case "/images/edits":
		return "image edit"
	case "/videos":
		return "video generation"
	default:
		return "image generation"
	}
}

func runAIProxyTask(task model.SystemTask) (string, error) {
	var payload AITaskPayload
	if err := json.Unmarshal([]byte(task.Payload), &payload); err != nil {
		return "", err
	}
	body, err := base64.StdEncoding.DecodeString(payload.BodyBase64)
	if err != nil {
		return "", err
	}
	if payload.Credits > 0 && !payload.Charged {
		if err := ConsumeUserCredits(task.CreatedBy, payload.Model, payload.Credits, payload.Path, task.ID); err != nil {
			return "", err
		}
		payload.Charged = true
		if nextPayload, marshalErr := json.Marshal(payload); marshalErr == nil {
			task.Payload = string(nextPayload)
			task.UpdatedAt = time.Now().Format(time.RFC3339)
			_ = repository.SaveSystemTask(task)
		}
	}
	result, err := executeAIProxyPayload(payload, body)
	if err != nil && payload.Credits > 0 && payload.Charged {
		if refundErr := RefundUserCredits(task.CreatedBy, payload.Model, payload.Credits, payload.Path, task.ID); refundErr != nil {
			log.Printf("AI task refund credits failed: task=%s user=%s model=%s credits=%d err=%v", task.ID, task.CreatedBy, payload.Model, payload.Credits, refundErr)
		}
	}
	return result, err
}

func executeAIProxyPayload(payload AITaskPayload, body []byte) (string, error) {
	channel, upstreamModel, err := SelectModelChannelWithModel(payload.Model)
	if err != nil {
		return "", err
	}
	body, contentType, err := rewriteAITaskRequestModel(body, payload.ContentType, upstreamModel)
	if err != nil {
		return "", err
	}
	path := resolveAITaskProxyPath(channel.BaseURL, upstreamModel, payload.Path)
	if payload.Path == "/videos" {
		return executeVideoAITask(channel, upstreamModel, path, body, contentType)
	}
	responseBody, responseType, err := doAIProxyRequest(http.MethodPost, channel, path, bytes.NewReader(body), contentType)
	if err != nil {
		return "", err
	}
	result, _ := json.Marshal(AITaskResult{ContentType: responseType, Body: string(responseBody)})
	return string(result), nil
}

func executeVideoAITask(channel model.ModelChannel, upstreamModel string, path string, body []byte, contentType string) (string, error) {
	createdBody, _, err := doAIProxyRequest(http.MethodPost, channel, path, bytes.NewReader(body), contentType)
	if err != nil {
		return "", err
	}
	taskID := extractAITaskID(createdBody)
	if taskID == "" {
		return "", errors.New("video api did not return task id")
	}
	pollInterval := time.Duration(currentTaskQueueSetting().VideoPollIntervalSeconds) * time.Second
	for attempt := 0; attempt < 240; attempt++ {
		statusPath := resolveAITaskProxyPath(channel.BaseURL, upstreamModel, "/videos/"+taskID)
		statusBody, _, err := doAIProxyRequest(http.MethodGet, channel, statusPath, nil, "")
		if err != nil {
			return "", err
		}
		status := strings.ToLower(extractJSONText(statusBody, "status"))
		if status == "completed" || status == "succeeded" || status == "success" {
			if url := extractJSONText(statusBody, "video_url"); url != "" {
				result, _ := json.Marshal(AITaskResult{URL: url, MimeType: "video/mp4", UpstreamTaskID: taskID})
				return string(result), nil
			}
			contentPath := resolveAITaskProxyPath(channel.BaseURL, upstreamModel, "/videos/"+taskID+"/content")
			contentBody, contentType, err := doAIProxyRequest(http.MethodGet, channel, contentPath, nil, "")
			if err != nil {
				return "", err
			}
			result, _ := json.Marshal(AITaskResult{Base64: base64.StdEncoding.EncodeToString(contentBody), MimeType: normalizeAIVideoMimeType(contentType), UpstreamTaskID: taskID})
			return string(result), nil
		}
		if status == "failed" || status == "cancelled" || status == "canceled" || status == "expired" {
			message := extractJSONText(statusBody, "message")
			if message == "" {
				message = "video generation failed"
			}
			return "", errors.New(message)
		}
		time.Sleep(pollInterval)
	}
	return "", errors.New("video generation timed out")
}

func doAIProxyRequest(method string, channel model.ModelChannel, path string, body io.Reader, contentType string) ([]byte, string, error) {
	request, err := http.NewRequest(method, BuildModelChannelURL(channel, path), body)
	if err != nil {
		return nil, "", err
	}
	request.Header.Set("Authorization", "Bearer "+SelectModelChannelAPIKey(channel))
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return nil, "", err
	}
	defer response.Body.Close()
	responseBody, _ := io.ReadAll(response.Body)
	if response.StatusCode >= http.StatusBadRequest {
		return nil, "", errors.New(aiTaskUpstreamStatusMessage(response.StatusCode, responseBody))
	}
	return responseBody, response.Header.Get("Content-Type"), nil
}

func extractAITaskID(body []byte) string {
	for _, key := range []string{"id", "task_id", "taskId"} {
		if value := extractJSONText(body, key); value != "" {
			return value
		}
	}
	return ""
}

func extractJSONText(body []byte, key string) string {
	var value any
	if err := json.Unmarshal(body, &value); err != nil {
		return ""
	}
	return findJSONText(value, key)
}

func findJSONText(value any, key string) string {
	switch item := value.(type) {
	case map[string]any:
		for k, v := range item {
			if strings.EqualFold(k, key) {
				if text, ok := v.(string); ok {
					return text
				}
			}
			if text := findJSONText(v, key); text != "" {
				return text
			}
		}
	case []any:
		for _, child := range item {
			if text := findJSONText(child, key); text != "" {
				return text
			}
		}
	}
	return ""
}

func normalizeAIVideoMimeType(contentType string) string {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	if contentType == "" || strings.Contains(contentType, "json") {
		return "video/mp4"
	}
	return contentType
}

func rewriteAITaskRequestModel(body []byte, contentType string, modelName string) ([]byte, string, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return body, contentType, nil
	}
	if strings.HasPrefix(contentType, "multipart/form-data") {
		return rewriteAITaskMultipartModel(body, contentType, modelName)
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, "", err
	}
	payload["model"] = modelName
	nextBody, err := json.Marshal(payload)
	return nextBody, contentType, err
}

func rewriteAITaskMultipartModel(body []byte, contentType string, modelName string) ([]byte, string, error) {
	_, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		return nil, "", err
	}
	form, err := multipart.NewReader(bytes.NewReader(body), params["boundary"]).ReadForm(64 << 20)
	if err != nil {
		return nil, "", err
	}
	defer form.RemoveAll()
	var buffer bytes.Buffer
	writer := multipart.NewWriter(&buffer)
	for key, values := range form.Value {
		if key == "model" {
			continue
		}
		for _, value := range values {
			if err := writer.WriteField(key, value); err != nil {
				return nil, "", err
			}
		}
	}
	if err := writer.WriteField("model", modelName); err != nil {
		return nil, "", err
	}
	for key, files := range form.File {
		for _, fileHeader := range files {
			file, err := fileHeader.Open()
			if err != nil {
				return nil, "", err
			}
			part, err := writer.CreateFormFile(key, fileHeader.Filename)
			if err == nil {
				_, err = io.Copy(part, file)
			}
			_ = file.Close()
			if err != nil {
				return nil, "", err
			}
		}
	}
	if err := writer.Close(); err != nil {
		return nil, "", err
	}
	return buffer.Bytes(), writer.FormDataContentType(), nil
}

func resolveAITaskProxyPath(baseURL string, modelName string, path string) string {
	if !isAITaskArkSeedanceVideo(baseURL, modelName) {
		return path
	}
	if path == "/videos" {
		return "/contents/generations/tasks"
	}
	if strings.HasPrefix(path, "/videos/") && !strings.HasSuffix(path, "/content") {
		return "/contents/generations/tasks/" + strings.TrimPrefix(path, "/videos/")
	}
	return path
}

func isAITaskArkSeedanceVideo(baseURL string, modelName string) bool {
	base := strings.ToLower(baseURL)
	modelName = strings.ToLower(modelName)
	return strings.Contains(modelName, "seedance") || strings.Contains(modelName, "doubao-seedance") || strings.Contains(base, "/api/plan/v3")
}

func aiTaskUpstreamStatusMessage(statusCode int, body []byte) string {
	detail := extractJSONText(body, "message")
	if detail == "" {
		detail = strings.TrimSpace(string(body))
	}
	detail = strings.Join(strings.Fields(detail), " ")
	if len([]rune(detail)) > 300 {
		detail = string([]rune(detail)[:300]) + "..."
	}
	switch statusCode {
	case http.StatusUnauthorized, http.StatusForbidden:
		if detail != "" {
			return "AI auth failed: " + detail
		}
		return "AI auth failed"
	case http.StatusTooManyRequests:
		if detail != "" {
			return "AI rate limited: " + detail
		}
		return "AI rate limited"
	default:
		if detail != "" {
			return "AI request failed: " + detail
		}
		return "AI request failed"
	}
}
