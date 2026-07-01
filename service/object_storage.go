package service

import (
	"bytes"
	"context"
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
	settings, err := repository.GetSettings()
	if err != nil {
		return UploadedObject{}, err
	}
	storage := normalizeObjectStorageSetting(settings.Private.ObjectStorage)
	if err := validateObjectStorage(storage); err != nil {
		return UploadedObject{}, err
	}
	key := objectStorageKey(storage.Prefix, filename)
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
		return UploadedObject{}, safeMessageError{message: "图片上传到对象存储失败"}
	}
	return UploadedObject{URL: objectPublicURL(storage.PublicURL, key), Key: key, MimeType: mimeType, Bytes: int64(len(data))}, nil
}

func validateObjectStorage(setting model.ObjectStorageSetting) error {
	if !setting.Enabled {
		return safeMessageError{message: "对象存储未开启，请先在后台系统设置中配置对象存储"}
	}
	if setting.Bucket == "" || setting.Endpoint == "" || setting.AccessKeyID == "" || setting.SecretAccessKey == "" || setting.PublicURL == "" {
		return safeMessageError{message: "对象存储配置不完整，请检查 Endpoint、Bucket、Access Key、Secret Key 和公开访问地址"}
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

func objectStorageKey(prefix string, filename string) string {
	ext := strings.ToLower(path.Ext(filename))
	if ext == "" {
		ext = ".png"
	}
	name := time.Now().Format("20060102") + "/" + uuid.NewString() + ext
	if prefix == "" {
		return "announcements/" + name
	}
	return strings.Trim(prefix, "/") + "/announcements/" + name
}

func objectPublicURL(publicURL string, key string) string {
	return strings.TrimRight(publicURL, "/") + "/" + strings.TrimLeft(key, "/")
}
