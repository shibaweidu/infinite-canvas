package service

import (
	"strings"
	"time"

	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
)

func ListPrompts(q model.Query) (model.PromptList, error) {
	items, total, err := repository.ListPrompts(q)
	if err != nil {
		return model.PromptList{}, err
	}
	tags, err := repository.ListPromptTags(q)
	if err != nil {
		return model.PromptList{}, err
	}
	categories := promptCategoryCodes(ListPromptCategories())
	return model.PromptList{Items: items, Tags: tags, Categories: categories, Total: int(total)}, nil
}

func ListPromptCategories() []model.PromptCategory {
	categories, _ := repository.ListPromptCategories()
	return categories
}

func SavePromptCategory(item model.PromptCategory) (model.PromptCategory, error) {
	item.Category = strings.TrimSpace(item.Category)
	item.Name = strings.TrimSpace(item.Name)
	item.Description = strings.TrimSpace(item.Description)
	item.GithubURL = strings.TrimSpace(item.GithubURL)
	if item.Name == "" {
		return item, safeMessageError{message: "分组名称不能为空"}
	}
	if item.Category == "" {
		item.Category = newID("promptcat")
	}
	if promptCategoryBuiltin(item.Category) {
		return item, safeMessageError{message: "内置分组不能作为自定义分组保存"}
	}
	if category, ok := repository.PromptCategoryByCode(item.Category); ok && category.Remote {
		return item, safeMessageError{message: "远程分组不能作为自定义分组保存"}
	}
	item.Remote = false
	item.UpdatedAt = time.Now().Format(time.RFC3339)
	return repository.SavePromptCategory(item)
}

func DeletePromptCategory(category string) error {
	category = strings.TrimSpace(category)
	if category == "" {
		return nil
	}
	if promptCategoryBuiltin(category) {
		return safeMessageError{message: "内置分组不能删除"}
	}
	if item, ok := repository.PromptCategoryByCode(category); ok && item.Remote {
		return safeMessageError{message: "远程分组不能删除"}
	}
	hasPrompts, err := repository.PromptCategoryHasPrompts(category)
	if err != nil {
		return err
	}
	if hasPrompts {
		return safeMessageError{message: "该分组下仍有提示词，不能删除"}
	}
	return repository.DeletePromptCategory(category)
}

func SavePrompt(item model.Prompt) (model.Prompt, error) {
	now := time.Now().Format(time.RFC3339)
	item.Title = strings.TrimSpace(item.Title)
	item.CoverURL = strings.TrimSpace(item.CoverURL)
	item.Prompt = strings.TrimSpace(item.Prompt)
	item.Category = strings.TrimSpace(item.Category)
	item.Preview = strings.TrimSpace(item.Preview)
	item.Tags = cleanStringList(item.Tags)
	if item.Category == "" {
		item.Category = repository.PromptCategories()[0].Category
	}
	if item.ID == "" {
		item.ID = newID(item.Category)
		item.CreatedAt = now
	}
	item.UpdatedAt = now
	category, ok := repository.PromptCategoryByCode(item.Category)
	if !ok {
		category = repository.PromptCategories()[0]
		item.Category = category.Category
	}
	item.GithubURL = ""
	return repository.SavePrompt(item)
}

func DeletePrompt(id string) error {
	return repository.DeletePrompt(id)
}

func DeletePrompts(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	return repository.DeletePrompts(ids)
}

func promptCategoryCodes(items []model.PromptCategory) []string {
	codes := []string{}
	for _, item := range items {
		if item.Category != "" {
			codes = append(codes, item.Category)
		}
	}
	return codes
}

func promptCategoryBuiltin(category string) bool {
	for _, item := range repository.PromptCategories() {
		if item.Category == category {
			return true
		}
	}
	return false
}
