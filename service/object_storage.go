package service

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
	"github.com/google/uuid"
)

type UploadedObject struct {
	URL      string `json:"url"`
	Key      string `json:"key"`
	MimeType string `json:"mimeType"`
	Bytes    int64  `json:"bytes"`
}

func UploadAnnouncementImage(filename string, mimeType string, data []byte) (UploadedObject, error) {
	if len(data) == 0 {
		return UploadedObject{}, safeMessageError{message: "图片文件为空"}
	}
	if !strings.HasPrefix(mimeType, "image/") {
		return UploadedObject{}, safeMessageError{message: "请上传图片文件"}
	}
	return uploadObjectStorageFile("announcements", filename, mimeType, data)
}

func UploadHomeMedia(filename string, mimeType string, data []byte) (UploadedObject, error) {
	if len(data) == 0 {
		return UploadedObject{}, safeMessageError{message: "媒体文件为空"}
	}
	mimeType = normalizeHomeMediaMimeType(filename, mimeType)
	if !strings.HasPrefix(mimeType, "image/") && !strings.HasPrefix(mimeType, "video/") {
		return UploadedObject{}, safeMessageError{message: "请上传图片、动图或视频文件"}
	}
	if strings.HasPrefix(mimeType, "image/") && len(data) > 20<<20 {
		return UploadedObject{}, safeMessageError{message: "图片或动图不能超过 20MB"}
	}
	if strings.HasPrefix(mimeType, "video/") && len(data) > 120<<20 {
		return UploadedObject{}, safeMessageError{message: "视频不能超过 120MB"}
	}
	return uploadObjectStorageFile("home", filename, mimeType, data)
}

func UploadUserStyleImage(filename string, mimeType string, data []byte) (UploadedObject, error) {
	if len(data) == 0 {
		return UploadedObject{}, safeMessageError{message: "风格图片为空"}
	}
	mimeType = normalizeHomeMediaMimeType(filename, mimeType)
	if !strings.HasPrefix(mimeType, "image/") {
		return UploadedObject{}, safeMessageError{message: "请上传图片文件"}
	}
	if len(data) > 20<<20 {
		return UploadedObject{}, safeMessageError{message: "风格图片不能超过 20MB"}
	}
	return uploadObjectStorageFile("user-styles", filename, mimeType, data)
}

func TestObjectStorage(setting model.ObjectStorageSetting) (string, error) {
	saved, err := repository.GetSettings()
	if err != nil {
		return "", err
	}
	setting = normalizeObjectStorageSetting(setting)
	if setting.SecretAccessKey == "" {
		setting.SecretAccessKey = normalizeObjectStorageSetting(saved.Private.ObjectStorage).SecretAccessKey
	}
	if err := validateObjectStorage(setting); err != nil {
		return "", err
	}
	key := objectStorageKey(setting.Prefix, "tests", "object-storage-test.txt")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := objectStorageClient(ctx, setting)
	if err != nil {
		return "", err
	}
	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(setting.Bucket),
		Key:         aws.String(key),
		Body:        strings.NewReader("object storage test"),
		ContentType: aws.String("text/plain; charset=utf-8"),
	})
	if err != nil {
		return "", safeMessageError{message: "测试文件上传失败，请检查 Endpoint、Bucket、Access Key、Secret Key 和 Path Style 设置"}
	}
	publicURL := objectPublicURL(setting.PublicURL, key)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, publicURL, nil)
	if err != nil {
		return "", safeMessageError{message: "公开访问地址格式不正确"}
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", safeMessageError{message: "测试文件已上传，但公开访问地址无法访问，请检查公开访问地址或 Bucket 公共读权限"}
	}
	_ = response.Body.Close()
	if response.StatusCode >= http.StatusBadRequest {
		return "", safeMessageError{message: fmt.Sprintf("测试文件已上传，但公开访问返回 %d，请检查公开访问地址或 Bucket 公共读权限", response.StatusCode)}
	}
	_, _ = client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(setting.Bucket),
		Key:    aws.String(key),
	})
	return "对象存储测试通过：上传和公开访问均正常", nil
}

func normalizeHomeMediaMimeType(filename string, mimeType string) string {
	mimeType = strings.ToLower(strings.TrimSpace(strings.Split(mimeType, ";")[0]))
	if mimeType != "" && mimeType != "application/octet-stream" {
		return mimeType
	}
	switch strings.ToLower(path.Ext(filename)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mov":
		return "video/quicktime"
	case ".m4v":
		return "video/x-m4v"
	default:
		return mimeType
	}
}

func uploadObjectStorageFile(folder string, filename string, mimeType string, data []byte) (UploadedObject, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return UploadedObject{}, err
	}
	storage := normalizeObjectStorageSetting(settings.Private.ObjectStorage)
	if err := validateObjectStorage(storage); err != nil {
		return UploadedObject{}, err
	}
	key := objectStorageKey(storage.Prefix, folder, filename)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client, err := objectStorageClient(ctx, storage)
	if err != nil {
		return UploadedObject{}, err
	}
	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(storage.Bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(mimeType),
	})
	if err != nil {
		return UploadedObject{}, safeMessageError{message: "文件上传到对象存储失败"}
	}
	return UploadedObject{URL: objectPublicURL(storage.PublicURL, key), Key: key, MimeType: mimeType, Bytes: int64(len(data))}, nil
}

func validateObjectStorage(setting model.ObjectStorageSetting) error {
	if !setting.Enabled {
		return safeMessageError{message: "对象存储未开启，请先在后台系统设置中配置对象存储"}
	}
	missing := []string{}
	if setting.Endpoint == "" {
		missing = append(missing, "Endpoint")
	}
	if setting.Bucket == "" {
		missing = append(missing, "Bucket")
	}
	if setting.AccessKeyID == "" {
		missing = append(missing, "Access Key ID")
	}
	if setting.SecretAccessKey == "" {
		missing = append(missing, "Secret Access Key")
	}
	if setting.PublicURL == "" {
		missing = append(missing, "公开访问地址")
	}
	if len(missing) > 0 {
		return safeMessageError{message: "对象存储配置不完整，缺少：" + strings.Join(missing, "、")}
	}
	return nil
}

func objectStorageClient(ctx context.Context, setting model.ObjectStorageSetting) (*s3.Client, error) {
	cfg, err := config.LoadDefaultConfig(
		ctx,
		config.WithRegion(firstNonEmpty(setting.Region, "auto")),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(setting.AccessKeyID, setting.SecretAccessKey, "")),
	)
	if err != nil {
		return nil, err
	}
	return s3.NewFromConfig(cfg, func(options *s3.Options) {
		options.BaseEndpoint = aws.String(setting.Endpoint)
		options.UsePathStyle = setting.ForcePathStyle
	}), nil
}

func objectStorageKey(prefix string, folder string, filename string) string {
	ext := strings.ToLower(path.Ext(filename))
	if ext == "" {
		ext = ".png"
	}
	name := time.Now().Format("20060102") + "/" + uuid.NewString() + ext
	folder = strings.Trim(strings.TrimSpace(folder), "/")
	if folder == "" {
		folder = "files"
	}
	if prefix == "" {
		return folder + "/" + name
	}
	return strings.Trim(prefix, "/") + "/" + folder + "/" + name
}

func objectPublicURL(publicURL string, key string) string {
	return strings.TrimRight(publicURL, "/") + "/" + strings.TrimLeft(key, "/")
}
