package model

type Announcement struct {
	ID          string `json:"id" gorm:"primaryKey"`
	Title       string `json:"title"`
	Summary     string `json:"summary" gorm:"type:text"`
	Content     string `json:"content" gorm:"type:text"`
	Pinned      bool   `json:"pinned"`
	Enabled     bool   `json:"enabled"`
	Sort        int    `json:"sort"`
	PublishedAt string `json:"publishedAt" gorm:"index"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

type AnnouncementList struct {
	Items []Announcement `json:"items"`
	Total int            `json:"total"`
}

type SubscriptionPlan struct {
	ID             string           `json:"id" gorm:"primaryKey"`
	Name           string           `json:"name"`
	Description    string           `json:"description" gorm:"type:text"`
	Price          int              `json:"price"`
	OriginalPrice  int              `json:"originalPrice"`
	Credits        int              `json:"credits"`
	DurationDays   int              `json:"durationDays"`
	PriceCycle     string           `json:"priceCycle"`
	ButtonText     string           `json:"buttonText"`
	CreditLabel    string           `json:"creditLabel"`
	CreditRateText string           `json:"creditRateText"`
	Benefits       []BillingBenefit `json:"benefits" gorm:"serializer:json"`
	Enabled        bool             `json:"enabled"`
	Sort           int              `json:"sort"`
	CreatedAt      string           `json:"createdAt"`
	UpdatedAt      string           `json:"updatedAt"`
}

type CreditPackage struct {
	ID             string           `json:"id" gorm:"primaryKey"`
	Name           string           `json:"name"`
	Description    string           `json:"description" gorm:"type:text"`
	Price          int              `json:"price"`
	OriginalPrice  int              `json:"originalPrice"`
	Credits        int              `json:"credits"`
	BonusCredits   int              `json:"bonusCredits"`
	PriceCycle     string           `json:"priceCycle"`
	ButtonText     string           `json:"buttonText"`
	CreditLabel    string           `json:"creditLabel"`
	CreditRateText string           `json:"creditRateText"`
	Benefits       []BillingBenefit `json:"benefits" gorm:"serializer:json"`
	Enabled        bool             `json:"enabled"`
	Sort           int              `json:"sort"`
	CreatedAt      string           `json:"createdAt"`
	UpdatedAt      string           `json:"updatedAt"`
}

type BillingBenefit struct {
	Text string `json:"text"`
	Tag  string `json:"tag"`
}

type AccountSummary struct {
	User            AuthUser           `json:"user"`
	Plans           []SubscriptionPlan `json:"plans"`
	CreditPackages  []CreditPackage    `json:"creditPackages"`
	RechargeRecords []CreditLog        `json:"rechargeRecords"`
	ConsumeRecords  []CreditLog        `json:"consumeRecords"`
}
