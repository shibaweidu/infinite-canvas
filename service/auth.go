package service

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
	"mime"
	"net/http"
	"net/mail"
	"net/smtp"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/basketikun/infinite-canvas/config"
	"github.com/basketikun/infinite-canvas/model"
	"github.com/basketikun/infinite-canvas/repository"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type TokenClaims struct {
	UserID   string         `json:"userId"`
	Username string         `json:"username"`
	Role     model.UserRole `json:"role"`
	jwt.RegisteredClaims
}

type userExtra struct {
	LinuxDo any `json:"linuxDo,omitempty"`
	Google  any `json:"google,omitempty"`
}

type registerEmailCode struct {
	Code      string
	Email     string
	ExpiresAt time.Time
	SentAt    time.Time
}

var registerEmailCodes = struct {
	sync.Mutex
	items map[string]registerEmailCode
}{items: map[string]registerEmailCode{}}

func EnsureDefaultAdmin() error {
	if strings.TrimSpace(config.Cfg.AdminUsername) == "" || strings.TrimSpace(config.Cfg.AdminPassword) == "" {
		return nil
	}
	WarnDefaultSecurityConfig()
	hasAdmin, err := repository.HasAdmin()
	if err != nil || hasAdmin {
		return err
	}
	hash, err := hashPassword(config.Cfg.AdminPassword)
	if err != nil {
		return err
	}
	_, err = repository.SaveUser(model.User{
		ID:        newID("user"),
		Username:  strings.TrimSpace(config.Cfg.AdminUsername),
		Password:  hash,
		Role:      model.UserRoleAdmin,
		AffCode:   newAffCode(),
		Status:    model.UserStatusActive,
		CreatedAt: now(),
		UpdatedAt: now(),
	})
	return err
}

func SendRegisterEmailCode(email string) error {
	settings, err := repository.GetSettings()
	if err != nil {
		return err
	}
	normalizedSettings := normalizeSettings(settings)
	if normalizedSettings.Public.Auth.AllowRegister != nil && !*normalizedSettings.Public.Auth.AllowRegister {
		return safeMessageError{message: "当前未开放注册"}
	}
	if normalizedSettings.Public.Auth.EmailRegister.Enabled != nil && !*normalizedSettings.Public.Auth.EmailRegister.Enabled {
		return safeMessageError{message: "邮箱注册未开启"}
	}
	if normalizedSettings.Public.Auth.EmailRegister.CodeEnabled == nil || !*normalizedSettings.Public.Auth.EmailRegister.CodeEnabled {
		return safeMessageError{message: "邮箱验证码未开启"}
	}
	email, err = normalizeEmailAddress(email)
	if err != nil {
		return err
	}
	if _, ok, err := repository.GetUserByEmail(email); err != nil || ok {
		if err != nil {
			return err
		}
		return safeMessageError{message: "邮箱已存在"}
	}
	registerEmailCodes.Lock()
	if item, ok := registerEmailCodes.items[email]; ok && time.Since(item.SentAt) < time.Minute {
		registerEmailCodes.Unlock()
		return safeMessageError{message: "验证码发送过于频繁"}
	}
	registerEmailCodes.Unlock()
	code, err := randomDigitCode(6)
	if err != nil {
		return err
	}
	if err := sendRegisterCodeEmail(normalizedSettings.Private.Auth.Email, email, code); err != nil {
		return err
	}
	registerEmailCodes.Lock()
	registerEmailCodes.items[email] = registerEmailCode{Code: code, Email: email, SentAt: time.Now(), ExpiresAt: time.Now().Add(10 * time.Minute)}
	registerEmailCodes.Unlock()
	return nil
}

func Register(username string, email string, password string, emailCode string) (model.AuthSession, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return model.AuthSession{}, err
	}
	normalizedSettings := normalizeSettings(settings)
	if normalizedSettings.Public.Auth.AllowRegister != nil && !*normalizedSettings.Public.Auth.AllowRegister {
		return model.AuthSession{}, safeMessageError{message: "当前未开放注册"}
	}
	if normalizedSettings.Public.Auth.EmailRegister.Enabled != nil && !*normalizedSettings.Public.Auth.EmailRegister.Enabled {
		return model.AuthSession{}, safeMessageError{message: "邮箱注册未开启"}
	}
	username = strings.TrimSpace(username)
	email = strings.TrimSpace(email)
	if strings.ContainsAny(username, " \t\r\n") {
		return model.AuthSession{}, safeMessageError{message: "用户名不能包含空格"}
	}
	codeEnabled := normalizedSettings.Public.Auth.EmailRegister.CodeEnabled != nil && *normalizedSettings.Public.Auth.EmailRegister.CodeEnabled
	if codeEnabled && email == "" {
		return model.AuthSession{}, safeMessageError{message: "邮箱不能为空"}
	}
	if normalizedSettings.Public.Auth.EmailRegister.EmailRequired != nil && *normalizedSettings.Public.Auth.EmailRegister.EmailRequired && email == "" {
		return model.AuthSession{}, safeMessageError{message: "邮箱不能为空"}
	}
	if email != "" {
		normalizedEmail, err := normalizeEmailAddress(email)
		if err != nil {
			return model.AuthSession{}, err
		}
		email = normalizedEmail
	}
	if username == "" || password == "" {
		return model.AuthSession{}, safeMessageError{message: "用户名和密码不能为空"}
	}
	if codeEnabled {
		if err := verifyRegisterEmailCode(email, emailCode); err != nil {
			return model.AuthSession{}, err
		}
	}
	if _, ok, err := repository.GetUserByUsername(username); err != nil || ok {
		if err != nil {
			return model.AuthSession{}, err
		}
		return model.AuthSession{}, safeMessageError{message: "用户名已存在"}
	}
	if email != "" {
		if _, ok, err := repository.GetUserByEmail(email); err != nil || ok {
			if err != nil {
				return model.AuthSession{}, err
			}
			return model.AuthSession{}, safeMessageError{message: "邮箱已存在"}
		}
	}
	hash, err := hashPassword(password)
	if err != nil {
		return model.AuthSession{}, err
	}
	user, err := repository.SaveUser(model.User{
		ID:        newID("user"),
		Username:  username,
		Email:     email,
		Password:  hash,
		Role:      model.UserRoleUser,
		AffCode:   newAffCode(),
		Status:    model.UserStatusActive,
		CreatedAt: now(),
		UpdatedAt: now(),
	})
	if err != nil {
		return model.AuthSession{}, err
	}
	if codeEnabled {
		clearRegisterEmailCode(email)
	}
	return newSession(user)
}

func Login(username string, password string) (model.AuthSession, error) {
	user, ok, err := repository.GetUserByUsernameOrEmail(strings.TrimSpace(username))
	if err != nil {
		return model.AuthSession{}, err
	}
	if !ok || bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)) != nil {
		return model.AuthSession{}, safeMessageError{message: "用户名或密码错误"}
	}
	if user.Status == model.UserStatusBan {
		return model.AuthSession{}, safeMessageError{message: "账号已被禁用"}
	}
	normalizeUserDefaults(&user)
	user.LastLoginAt = now()
	user.UpdatedAt = now()
	user, err = repository.SaveUser(user)
	if err != nil {
		return model.AuthSession{}, err
	}
	return newSession(user)
}

func GoogleAuthorizeURL(r *http.Request, redirect string) (string, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return "", err
	}
	settings = normalizeSettings(settings)
	google := settings.Private.Auth.Google
	if !settings.Public.Auth.Google.Enabled {
		return "", safeMessageError{message: "Google 登录未开启"}
	}
	if strings.TrimSpace(google.ClientID) == "" || strings.TrimSpace(google.ClientSecret) == "" {
		return "", safeMessageError{message: "Google 登录未配置"}
	}
	values := url.Values{}
	values.Set("client_id", google.ClientID)
	values.Set("redirect_uri", googleRedirectURI(r))
	values.Set("response_type", "code")
	values.Set("scope", "openid email profile")
	values.Set("state", base64.RawURLEncoding.EncodeToString([]byte(redirect)))
	return "https://accounts.google.com/o/oauth2/v2/auth?" + values.Encode(), nil
}

func LoginWithGoogle(r *http.Request, code string, state string) (model.AuthSession, string, error) {
	redirect := decodeState(state)
	settings, err := repository.GetSettings()
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	settings = normalizeSettings(settings)
	google := settings.Private.Auth.Google
	if !settings.Public.Auth.Google.Enabled {
		return model.AuthSession{}, redirect, safeMessageError{message: "Google 登录未开启"}
	}
	token, err := googleAccessToken(r, code, google)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	profile, err := googleProfile(token)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	googleID := strings.TrimSpace(profile.Sub)
	if googleID == "" {
		return model.AuthSession{}, redirect, safeMessageError{message: "Google 用户信息无效"}
	}
	user, ok, err := repository.GetUserByGoogleID(googleID)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	if !ok && strings.TrimSpace(profile.Email) != "" {
		user, ok, err = repository.GetUserByEmail(profile.Email)
		if err != nil {
			return model.AuthSession{}, redirect, err
		}
	}
	if !ok {
		if settings.Public.Auth.AllowRegister != nil && !*settings.Public.Auth.AllowRegister {
			return model.AuthSession{}, redirect, safeMessageError{message: "当前未开放注册"}
		}
		user = model.User{
			ID:          newID("user"),
			Username:    googleUsername(profile.Email, googleID),
			Email:       strings.TrimSpace(profile.Email),
			DisplayName: strings.TrimSpace(profile.Name),
			AvatarURL:   strings.TrimSpace(profile.Picture),
			Role:        model.UserRoleUser,
			AffCode:     newAffCode(),
			GoogleID:    googleID,
			Status:      model.UserStatusActive,
			CreatedAt:   now(),
		}
	} else if user.Status == model.UserStatusBan {
		return model.AuthSession{}, redirect, safeMessageError{message: "账号已被禁用"}
	}
	user.GoogleID = googleID
	user.Email = firstNonEmpty(profile.Email, user.Email)
	user.DisplayName = firstNonEmpty(profile.Name, user.DisplayName)
	user.AvatarURL = firstNonEmpty(profile.Picture, user.AvatarURL)
	user.LastLoginAt = now()
	user.UpdatedAt = now()
	extra, _ := json.Marshal(userExtra{Google: profile})
	user.Extra = string(extra)
	user, err = repository.SaveUser(user)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	session, err := newSession(user)
	return session, redirect, err
}

func LinuxDoAuthorizeURL(r *http.Request, redirect string) (string, error) {
	settings, err := repository.GetSettings()
	if err != nil {
		return "", err
	}
	settings = normalizeSettings(settings)
	linuxDo := settings.Private.Auth.LinuxDo
	if !settings.Public.Auth.LinuxDo.Enabled {
		return "", safeMessageError{message: "Linux.do 登录未开启"}
	}
	if strings.TrimSpace(linuxDo.ClientID) == "" || strings.TrimSpace(linuxDo.ClientSecret) == "" {
		return "", safeMessageError{message: "Linux.do 登录未配置"}
	}
	values := url.Values{}
	values.Set("client_id", linuxDo.ClientID)
	values.Set("redirect_uri", linuxDoRedirectURI(r))
	values.Set("response_type", "code")
	values.Set("scope", "read")
	values.Set("state", base64.RawURLEncoding.EncodeToString([]byte(redirect)))
	return config.Cfg.LinuxDoAuthorizeURL + "?" + values.Encode(), nil
}

func LoginWithLinuxDo(r *http.Request, code string, state string) (model.AuthSession, string, error) {
	redirect := decodeState(state)
	settings, err := repository.GetSettings()
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	settings = normalizeSettings(settings)
	linuxDo := settings.Private.Auth.LinuxDo
	if !settings.Public.Auth.LinuxDo.Enabled {
		return model.AuthSession{}, redirect, safeMessageError{message: "Linux.do 登录未开启"}
	}
	token, err := linuxDoAccessToken(r, code, linuxDo)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	profile, err := linuxDoProfile(token)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	linuxDoID := fmt.Sprint(profile.ID)
	if strings.TrimSpace(linuxDoID) == "" || linuxDoID == "0" {
		return model.AuthSession{}, redirect, safeMessageError{message: "Linux.do 用户信息无效"}
	}
	user, ok, err := repository.GetUserByLinuxDoID(linuxDoID)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	if !ok {
		if settings.Public.Auth.AllowRegister != nil && !*settings.Public.Auth.AllowRegister {
			return model.AuthSession{}, redirect, safeMessageError{message: "当前未开放注册"}
		}
		user = model.User{
			ID:          newID("user"),
			Username:    linuxDoUsername(profile.Username, linuxDoID),
			DisplayName: strings.TrimSpace(profile.Name),
			AvatarURL:   linuxDoAvatar(profile.AvatarTemplate),
			Role:        model.UserRoleUser,
			AffCode:     newAffCode(),
			LinuxDoID:   linuxDoID,
			Status:      model.UserStatusActive,
			CreatedAt:   now(),
		}
	} else if user.Status == model.UserStatusBan {
		return model.AuthSession{}, redirect, safeMessageError{message: "账号已被禁用"}
	}
	user.DisplayName = firstNonEmpty(profile.Name, user.DisplayName)
	user.AvatarURL = firstNonEmpty(linuxDoAvatar(profile.AvatarTemplate), user.AvatarURL)
	user.LastLoginAt = now()
	user.UpdatedAt = now()
	extra, _ := json.Marshal(userExtra{LinuxDo: profile})
	user.Extra = string(extra)
	user, err = repository.SaveUser(user)
	if err != nil {
		return model.AuthSession{}, redirect, err
	}
	session, err := newSession(user)
	return session, redirect, err
}

func ParseToken(tokenText string) (TokenClaims, error) {
	claims := TokenClaims{}
	token, err := jwt.ParseWithClaims(tokenText, &claims, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("登录状态无效")
		}
		return []byte(config.Cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return TokenClaims{}, errors.New("登录状态无效")
	}
	return claims, nil
}

func CurrentAuthUser(tokenText string) (model.AuthUser, bool) {
	claims, err := ParseToken(tokenText)
	if err != nil {
		return model.AuthUser{}, false
	}
	user, ok, err := repository.RefreshUserCredits(claims.UserID, now())
	if err != nil || !ok {
		return model.AuthUser{}, false
	}
	if user.Status == model.UserStatusBan {
		return model.AuthUser{}, false
	}
	return model.PublicUser(user), true
}

func ListUsers(q model.Query) (model.UserList, error) {
	users, total, err := repository.ListUsers(q)
	if err != nil {
		return model.UserList{}, err
	}
	for i := range users {
		users[i].Password = ""
		normalizeUserDefaults(&users[i])
	}
	return model.UserList{Items: users, Total: int(total)}, nil
}

func SaveUser(user model.User, password string) (model.User, error) {
	user.Username = strings.TrimSpace(user.Username)
	if strings.ContainsAny(user.Username, " \t\r\n") {
		return user, safeMessageError{message: "用户名不能包含空格"}
	}
	if user.Username == "" {
		return user, safeMessageError{message: "用户名不能为空"}
	}
	if user.Role == "" || user.Role == model.UserRoleGuest {
		user.Role = model.UserRoleUser
	}
	if user.Status == "" {
		user.Status = model.UserStatusActive
	}
	if user.TaskConcurrency < 0 {
		user.TaskConcurrency = 0
	}
	if user.TaskConcurrency > 50 {
		user.TaskConcurrency = 50
	}
	if saved, ok, err := repository.GetUserByUsername(user.Username); err != nil {
		return user, err
	} else if ok && saved.ID != user.ID {
		return user, safeMessageError{message: "用户名已存在"}
	}
	user.Email = strings.TrimSpace(user.Email)
	if user.Email != "" {
		normalizedEmail, err := normalizeEmailAddress(user.Email)
		if err != nil {
			return user, err
		}
		user.Email = normalizedEmail
		if saved, ok, err := repository.GetUserByEmail(user.Email); err != nil {
			return user, err
		} else if ok && saved.ID != user.ID {
			return user, safeMessageError{message: "邮箱已存在"}
		}
	}
	isCreate := user.ID == ""
	if isCreate {
		user.ID = newID("user")
		user.AffCode = newAffCode()
		user.CreatedAt = now()
	} else if saved, ok, err := repository.GetUserByID(user.ID); err != nil {
		return user, err
	} else if ok {
		user.CreatedAt = saved.CreatedAt
		user.Password = saved.Password
		user.AvatarURL = saved.AvatarURL
		user.Credits = saved.Credits
		user.Extra = saved.Extra
		if user.TaskConcurrency < 0 {
			user.TaskConcurrency = saved.TaskConcurrency
		}
		if user.AffCode == "" {
			user.AffCode = saved.AffCode
		}
		if user.AffCode == "" {
			user.AffCode = newAffCode()
		}
		if user.LinuxDoID == "" {
			user.LinuxDoID = saved.LinuxDoID
		}
		if user.GoogleID == "" {
			user.GoogleID = saved.GoogleID
		}
		user.LastLoginAt = saved.LastLoginAt
	}
	if password != "" {
		hash, err := hashPassword(password)
		if err != nil {
			return user, err
		}
		user.Password = hash
	}
	if isCreate && user.Password == "" {
		return user, safeMessageError{message: "密码不能为空"}
	}
	user.UpdatedAt = now()
	user, err := repository.SaveUser(user)
	user.Password = ""
	return user, err
}

func AdjustUserCredits(id string, credits int) (model.User, error) {
	user, ok, err := repository.GetUserByID(id)
	if err != nil || !ok {
		if err != nil {
			return user, err
		}
		return user, safeMessageError{message: "用户不存在"}
	}
	oldCredits := user.Credits
	current := now()
	diff := credits - oldCredits
	if diff > 0 {
		user, _, err = repository.GrantUserCreditBatch(id, model.CreditBatchSourceAdmin, "admin_adjust", diff, "", current)
	} else if diff < 0 {
		user, _, _, err = repository.ConsumeUserCredits(id, -diff, current)
	} else {
		user.Password = ""
		return user, nil
	}
	if err == nil && oldCredits != credits {
		_, err = repository.SaveCreditLog(model.CreditLog{
			ID:        newID("credit"),
			UserID:    user.ID,
			Type:      model.CreditLogTypeAdminAdjust,
			Amount:    diff,
			Balance:   user.Credits,
			Remark:    "后台手动调整",
			CreatedAt: current,
		})
	}
	user.Password = ""
	return user, err
}

func ConsumeUserCredits(userID string, modelName string, credits int, path string) error {
	if credits <= 0 {
		return nil
	}
	current := now()
	user, deductions, ok, err := repository.ConsumeUserCredits(userID, credits, current)
	if err != nil {
		return err
	}
	if !ok {
		return safeMessageError{message: "积分不足"}
	}
	extra, _ := json.Marshal(map[string]any{"model": modelName, "deductions": deductions})
	_, err = repository.SaveCreditLog(model.CreditLog{
		ID:        newID("credit"),
		UserID:    userID,
		Type:      model.CreditLogTypeAIConsume,
		Amount:    -credits,
		Balance:   user.Credits,
		Remark:    "调用模型 " + modelName,
		Extra:     string(extra),
		CreatedAt: current,
	})
	return err
}

func RefundUserCredits(userID string, modelName string, credits int, path string) error {
	if credits <= 0 {
		return nil
	}
	current := now()
	user, ok, err := repository.RefundUserCredits(userID, credits, current)
	if err != nil {
		return err
	}
	if !ok {
		return safeMessageError{message: "用户不存在"}
	}
	extra, _ := json.Marshal(map[string]string{"model": modelName})
	_, err = repository.SaveCreditLog(model.CreditLog{
		ID:        newID("credit"),
		UserID:    userID,
		Type:      model.CreditLogTypeAIRefund,
		Amount:    credits,
		Balance:   user.Credits,
		Remark:    "模型调用失败返还 " + modelName,
		Extra:     string(extra),
		CreatedAt: current,
	})
	return err
}

func GrantSubscriptionCredits(userID string, planID string, credits int, expiresAt string) (model.User, error) {
	user, ok, err := repository.GrantUserCreditBatch(userID, model.CreditBatchSourceSubscribe, planID, credits, expiresAt, now())
	if err != nil {
		return user, err
	}
	if !ok {
		return user, safeMessageError{message: "用户不存在"}
	}
	return user, nil
}

func GrantRechargeCredits(userID string, packageID string, credits int, bonusCredits int) (model.User, error) {
	current := now()
	user, ok, err := repository.GrantUserCreditBatch(userID, model.CreditBatchSourceRecharge, packageID, credits, "", current)
	if err != nil || !ok || bonusCredits <= 0 {
		if !ok && err == nil {
			err = safeMessageError{message: "用户不存在"}
		}
		return user, err
	}
	user, ok, err = repository.GrantUserCreditBatch(userID, model.CreditBatchSourceBonus, packageID, bonusCredits, "", current)
	if !ok && err == nil {
		err = safeMessageError{message: "用户不存在"}
	}
	return user, err
}

func ListCreditLogs(q model.Query) (model.CreditLogList, error) {
	logs, total, err := repository.ListCreditLogs(q)
	if err != nil {
		return model.CreditLogList{}, err
	}
	sanitizeCreditLogs(logs)
	return model.CreditLogList{Items: logs, Total: int(total)}, nil
}

func SaveCreditLog(log model.CreditLog) (model.CreditLog, error) {
	if log.ID == "" {
		log.ID = newID("credit")
		log.CreatedAt = now()
	}
	return repository.SaveCreditLog(log)
}

func DeleteCreditLog(id string) error {
	return repository.DeleteCreditLog(id)
}

func sanitizeCreditLogs(logs []model.CreditLog) {
	for i := range logs {
		logs[i].Remark = sanitizeModelEndpointText(logs[i].Remark)
		logs[i].Extra = sanitizeModelEndpointText(logs[i].Extra)
	}
}

func sanitizeModelEndpointText(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return value
	}
	if strings.HasPrefix(value, "{") {
		var extra map[string]any
		if json.Unmarshal([]byte(value), &extra) == nil {
			delete(extra, "path")
			if modelName, ok := extra["model"].(string); ok {
				extra["model"] = sanitizeModelName(modelName)
			}
			if data, err := json.Marshal(extra); err == nil {
				return string(data)
			}
		}
	}
	fields := strings.Fields(value)
	for i, field := range fields {
		if strings.HasPrefix(field, "http://") || strings.HasPrefix(field, "https://") || strings.Contains(field, "||http://") || strings.Contains(field, "||https://") {
			fields[i] = sanitizeModelName(field)
		}
	}
	return strings.TrimSpace(strings.Join(fields, " "))
}

func sanitizeModelName(value string) string {
	value = strings.TrimSpace(value)
	if strings.Contains(value, "||") {
		parts := strings.Split(value, "||")
		return strings.TrimSpace(parts[len(parts)-1])
	}
	return strings.TrimSpace(strings.TrimRight(strings.Split(value, "http://")[0], "|"))
}

func DeleteUser(id string) error {
	return repository.DeleteUser(id)
}

func GuestUser() model.AuthUser {
	return model.AuthUser{ID: "", Username: "guest", Role: model.UserRoleGuest}
}

func newSession(user model.User) (model.AuthSession, error) {
	token, err := newToken(user)
	if err != nil {
		return model.AuthSession{}, err
	}
	return model.AuthSession{Token: token, User: model.PublicUser(user)}, nil
}

func newToken(user model.User) (string, error) {
	expireHours := config.Cfg.JWTExpireHours
	if expireHours <= 0 {
		expireHours = 168
	}
	claims := TokenClaims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expireHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID,
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(config.Cfg.JWTSecret))
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}

func now() string {
	return time.Now().Format(time.RFC3339)
}

func newID(prefix string) string {
	return prefix + "-" + uuid.NewString()
}

func newAffCode() string {
	return strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
}

func normalizeUserDefaults(user *model.User) {
	if user.Status == "" {
		user.Status = model.UserStatusActive
	}
	if user.TaskConcurrency < 0 {
		user.TaskConcurrency = 0
	}
	if user.AffCode == "" {
		user.AffCode = newAffCode()
	}
}

type linuxDoTokenResponse struct {
	AccessToken string `json:"access_token"`
}

type linuxDoUserResponse struct {
	ID             int64  `json:"id"`
	Username       string `json:"username"`
	Name           string `json:"name"`
	AvatarTemplate string `json:"avatar_template"`
}

type googleTokenResponse struct {
	AccessToken string `json:"access_token"`
}

type googleUserResponse struct {
	Sub     string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func linuxDoAccessToken(r *http.Request, code string, setting model.PrivateLinuxDoAuthSetting) (string, error) {
	values := url.Values{}
	values.Set("client_id", setting.ClientID)
	values.Set("client_secret", setting.ClientSecret)
	values.Set("grant_type", "authorization_code")
	values.Set("code", code)
	values.Set("redirect_uri", linuxDoRedirectURI(r))
	req, _ := http.NewRequest(http.MethodPost, config.Cfg.LinuxDoTokenURL, strings.NewReader(values.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var payload linuxDoTokenResponse
	if err := doLinuxDoJSON(req, &payload); err != nil {
		return "", err
	}
	if strings.TrimSpace(payload.AccessToken) == "" {
		return "", safeMessageError{message: "Linux.do 登录失败"}
	}
	return payload.AccessToken, nil
}

func linuxDoRedirectURI(r *http.Request) string {
	return RequestOrigin(r) + "/api/auth/linux-do/callback"
}

func linuxDoProfile(token string) (linuxDoUserResponse, error) {
	req, _ := http.NewRequest(http.MethodGet, config.Cfg.LinuxDoUserInfoURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	var payload linuxDoUserResponse
	err := doLinuxDoJSON(req, &payload)
	return payload, err
}

func doLinuxDoJSON(req *http.Request, payload any) error {
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return safeMessageError{message: "Linux.do 登录失败"}
	}
	return json.NewDecoder(bytes.NewReader(body)).Decode(payload)
}

func linuxDoUsername(username string, id string) string {
	base := strings.TrimSpace(username)
	if base == "" {
		base = "linuxdo-" + id
	}
	if _, ok, err := repository.GetUserByUsername(base); err != nil || !ok {
		return base
	}
	return base + "-" + id
}

func linuxDoAvatar(template string) string {
	if strings.TrimSpace(template) == "" {
		return ""
	}
	if strings.HasPrefix(template, "//") {
		template = "https:" + template
	}
	if strings.HasPrefix(template, "/") {
		template = "https://linux.do" + template
	}
	return strings.ReplaceAll(template, "{size}", "120")
}

func googleAccessToken(r *http.Request, code string, setting model.PrivateGoogleAuthSetting) (string, error) {
	values := url.Values{}
	values.Set("client_id", setting.ClientID)
	values.Set("client_secret", setting.ClientSecret)
	values.Set("grant_type", "authorization_code")
	values.Set("code", code)
	values.Set("redirect_uri", googleRedirectURI(r))
	req, _ := http.NewRequest(http.MethodPost, "https://oauth2.googleapis.com/token", strings.NewReader(values.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var payload googleTokenResponse
	if err := doGoogleJSON(req, &payload); err != nil {
		return "", err
	}
	if strings.TrimSpace(payload.AccessToken) == "" {
		return "", safeMessageError{message: "Google 登录失败"}
	}
	return payload.AccessToken, nil
}

func googleRedirectURI(r *http.Request) string {
	return RequestOrigin(r) + "/api/auth/google/callback"
}

func googleProfile(token string) (googleUserResponse, error) {
	req, _ := http.NewRequest(http.MethodGet, "https://openidconnect.googleapis.com/v1/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	var payload googleUserResponse
	err := doGoogleJSON(req, &payload)
	return payload, err
}

func doGoogleJSON(req *http.Request, payload any) error {
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return safeMessageError{message: "Google 登录失败"}
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return safeMessageError{message: "Google 登录失败"}
	}
	return json.NewDecoder(bytes.NewReader(body)).Decode(payload)
}

func googleUsername(email string, id string) string {
	base := strings.TrimSpace(strings.Split(email, "@")[0])
	if base == "" {
		base = "google-" + id
	}
	if _, ok, err := repository.GetUserByUsername(base); err != nil || !ok {
		return base
	}
	return base + "-" + id
}

func normalizeEmailAddress(email string) (string, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return "", safeMessageError{message: "邮箱不能为空"}
	}
	address, err := mail.ParseAddress(email)
	if err != nil || !strings.EqualFold(address.Address, email) {
		return "", safeMessageError{message: "邮箱格式不正确"}
	}
	return strings.ToLower(address.Address), nil
}

func verifyRegisterEmailCode(email string, code string) error {
	email, err := normalizeEmailAddress(email)
	if err != nil {
		return err
	}
	code = strings.TrimSpace(code)
	if code == "" {
		return safeMessageError{message: "请输入邮箱验证码"}
	}
	registerEmailCodes.Lock()
	defer registerEmailCodes.Unlock()
	item, ok := registerEmailCodes.items[email]
	if !ok || item.Code != code {
		return safeMessageError{message: "邮箱验证码不正确"}
	}
	if time.Now().After(item.ExpiresAt) {
		delete(registerEmailCodes.items, email)
		return safeMessageError{message: "邮箱验证码已过期"}
	}
	return nil
}

func clearRegisterEmailCode(email string) {
	email = strings.ToLower(strings.TrimSpace(email))
	registerEmailCodes.Lock()
	delete(registerEmailCodes.items, email)
	registerEmailCodes.Unlock()
}

func randomDigitCode(length int) (string, error) {
	var builder strings.Builder
	for builder.Len() < length {
		value, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		builder.WriteByte(byte('0' + value.Int64()))
	}
	return builder.String(), nil
}

func sendRegisterCodeEmail(setting model.PrivateEmailAuthSetting, to string, code string) error {
	setting = normalizePrivateEmailAuthSetting(setting)
	if setting.FromEmail == "" {
		setting.FromEmail = setting.SMTPUsername
	}
	if setting.SMTPHost == "" || setting.FromEmail == "" {
		return safeMessageError{message: "邮箱服务未配置"}
	}
	from := setting.FromEmail
	if setting.FromName != "" {
		from = (&mail.Address{Name: setting.FromName, Address: setting.FromEmail}).String()
	}
	header := map[string]string{
		"From":         from,
		"To":           to,
		"Subject":      mime.QEncoding.Encode("utf-8", setting.Subject),
		"MIME-Version": "1.0",
		"Content-Type": "text/plain; charset=utf-8",
	}
	lines := make([]string, 0, len(header)+2)
	for key, value := range header {
		lines = append(lines, key+": "+value)
	}
	body := fmt.Sprintf("你的注册验证码是：%s\n\n验证码 10 分钟内有效。如果不是你本人操作，请忽略这封邮件。", code)
	message := strings.Join(lines, "\r\n") + "\r\n\r\n" + body
	addr := fmt.Sprintf("%s:%d", setting.SMTPHost, setting.SMTPPort)
	var auth smtp.Auth
	if setting.SMTPUsername != "" {
		auth = smtp.PlainAuth("", setting.SMTPUsername, setting.SMTPPassword, setting.SMTPHost)
	}
	if err := smtp.SendMail(addr, auth, setting.FromEmail, []string{to}, []byte(message)); err != nil {
		return safeMessageError{message: "验证码发送失败"}
	}
	return nil
}

func decodeState(state string) string {
	data, err := base64.RawURLEncoding.DecodeString(state)
	if err != nil {
		return "/"
	}
	return safeRedirectPath(string(data))
}

// safeRedirectPath 仅放行站内相对路径，拦截开放重定向。浏览器会忽略 URL 中的
// Tab/换行/回车，并把 //host 或 /\host 解析为协议相对的跨站地址，因此先剥离这些
// 控制字符，再拒绝 // 与 /\ 前缀。
func safeRedirectPath(redirect string) string {
	cleaned := strings.Map(func(r rune) rune {
		if r == '\t' || r == '\n' || r == '\r' {
			return -1
		}
		return r
	}, redirect)
	if !strings.HasPrefix(cleaned, "/") || strings.HasPrefix(cleaned, "//") || strings.HasPrefix(cleaned, "/\\") {
		return "/"
	}
	return cleaned
}

func RequestOrigin(r *http.Request) string {
	host := strings.TrimSpace(r.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = r.Host
	}
	proto := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto"))
	if proto == "" {
		proto = "http"
	}
	return proto + "://" + host
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func WarnDefaultSecurityConfig() {
	if config.Cfg.AdminUsername == "admin" && config.Cfg.AdminPassword == "infinite-canvas" {
		log.Println("WARNING: using default admin credentials, please set ADMIN_USERNAME and ADMIN_PASSWORD to safer values before deployment")
	}
}
