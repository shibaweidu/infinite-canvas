package service

import (
	"strings"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
)

func ListHomeSlides(admin bool) ([]model.HomeSlide, error) {
	return repository.ListHomeSlides(admin)
}

func SaveHomeSlide(item model.HomeSlide) (model.HomeSlide, error) {
	item.ID = strings.TrimSpace(item.ID)
	item.Title = strings.TrimSpace(item.Title)
	item.Subtitle = strings.TrimSpace(item.Subtitle)
	item.CoverURL = strings.TrimSpace(item.CoverURL)
	item.LinkURL = strings.TrimSpace(item.LinkURL)
	item.WorkID = strings.TrimSpace(item.WorkID)
	item.PublishedAt = strings.TrimSpace(item.PublishedAt)
	if item.Title == "" {
		return item, safeMessageError{message: "幻灯片标题不能为空"}
	}
	if item.CoverURL == "" {
		return item, safeMessageError{message: "幻灯片封面不能为空"}
	}
	current := now()
	if item.ID == "" {
		item.ID = newID("slide")
		item.CreatedAt = current
	}
	if item.PublishedAt == "" {
		item.PublishedAt = current
	}
	item.UpdatedAt = current
	return repository.SaveHomeSlide(item)
}

func DeleteHomeSlide(id string) error {
	return repository.DeleteHomeSlide(strings.TrimSpace(id))
}

func ListHomeWorks(q model.Query, admin bool, status string) (model.HomeWorkList, error) {
	items, total, err := repository.ListHomeWorks(q, admin, strings.TrimSpace(status))
	if err != nil {
		return model.HomeWorkList{}, err
	}
	categories, err := repository.ListHomeCategories(admin)
	if err != nil {
		return model.HomeWorkList{}, err
	}
	tags, err := repository.ListHomeTags(admin)
	if err != nil {
		return model.HomeWorkList{}, err
	}
	return model.HomeWorkList{Items: items, Categories: categories, Tags: tags, Total: int(total)}, nil
}

func GetHomeWork(id string, admin bool) (model.HomeWork, error) {
	item, ok, err := repository.GetHomeWork(strings.TrimSpace(id), admin)
	if err != nil {
		return item, err
	}
	if !ok {
		return item, safeMessageError{message: "作品不存在"}
	}
	return item, nil
}

func SaveHomeWork(item model.HomeWork) (model.HomeWork, error) {
	item.ID = strings.TrimSpace(item.ID)
	item.Title = strings.TrimSpace(item.Title)
	item.Description = strings.TrimSpace(item.Description)
	item.CoverURL = strings.TrimSpace(item.CoverURL)
	item.MediaURL = strings.TrimSpace(item.MediaURL)
	item.Prompt = strings.TrimSpace(item.Prompt)
	item.Model = strings.TrimSpace(item.Model)
	item.Category = strings.TrimSpace(item.Category)
	item.PublishedAt = strings.TrimSpace(item.PublishedAt)
	item.Tags = cleanStringList(item.Tags)
	if item.Type == "" {
		item.Type = model.HomeWorkTypeImage
	}
	if item.Status == "" {
		item.Status = model.HomeWorkStatusPending
	}
	if item.Title == "" {
		return item, safeMessageError{message: "作品标题不能为空"}
	}
	if item.MediaURL == "" {
		return item, safeMessageError{message: "作品媒体地址不能为空"}
	}
	if item.CoverURL == "" {
		item.CoverURL = item.MediaURL
	}
	if item.Status == model.HomeWorkStatusPublished && item.PublishedAt == "" {
		item.PublishedAt = now()
	}
	current := now()
	if item.ID == "" {
		item.ID = newID("work")
		item.CreatedAt = current
	}
	item.UpdatedAt = current
	return repository.SaveHomeWork(item)
}

func DeleteHomeWork(id string) error {
	return repository.DeleteHomeWork(strings.TrimSpace(id))
}

func ListHomeCategories(admin bool) ([]model.HomeCategory, error) {
	return repository.ListHomeCategories(admin)
}

func SaveHomeCategory(item model.HomeCategory) (model.HomeCategory, error) {
	item.ID = strings.TrimSpace(item.ID)
	item.Name = strings.TrimSpace(item.Name)
	if item.Name == "" {
		return item, safeMessageError{message: "分类名称不能为空"}
	}
	current := now()
	if item.ID == "" {
		item.ID = newID("homecat")
		item.CreatedAt = current
	}
	item.UpdatedAt = current
	return repository.SaveHomeCategory(item)
}

func DeleteHomeCategory(id string) error {
	return repository.DeleteHomeCategory(strings.TrimSpace(id))
}

func ListHomeTags(admin bool) ([]model.HomeTag, error) {
	return repository.ListHomeTags(admin)
}

func SaveHomeTag(item model.HomeTag) (model.HomeTag, error) {
	item.ID = strings.TrimSpace(item.ID)
	item.Name = strings.TrimSpace(item.Name)
	if item.Name == "" {
		return item, safeMessageError{message: "标签名称不能为空"}
	}
	current := now()
	if item.ID == "" {
		item.ID = newID("hometag")
		item.CreatedAt = current
	}
	item.UpdatedAt = current
	return repository.SaveHomeTag(item)
}

func DeleteHomeTag(id string) error {
	return repository.DeleteHomeTag(strings.TrimSpace(id))
}

func cleanStringList(items []string) []string {
	result := make([]string, 0, len(items))
	seen := map[string]bool{}
	for _, item := range items {
		value := strings.TrimSpace(item)
		if value != "" && !seen[value] {
			seen[value] = true
			result = append(result, value)
		}
	}
	return result
}

