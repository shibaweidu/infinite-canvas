package router

import "testing"

func TestAccountAndBillingRoutesExist(t *testing.T) {
	r := New()
	routes := []string{
		"GET /api/announcements",
		"GET /api/account/summary",
		"GET /api/subscription-plans",
		"GET /api/credit-packages",
		"GET /api/admin/announcements",
		"POST /api/admin/announcements",
		"GET /api/admin/billing/subscription-plans",
		"POST /api/admin/billing/subscription-plans",
		"GET /api/admin/billing/credit-packages",
		"POST /api/admin/billing/credit-packages",
		"GET /api/admin/subscription-plans",
		"POST /api/admin/subscription-plans",
		"GET /api/admin/credit-packages",
		"POST /api/admin/credit-packages",
	}
	seen := map[string]bool{}
	for _, route := range r.Routes() {
		seen[route.Method+" "+route.Path] = true
	}
	for _, label := range routes {
		if !seen[label] {
			t.Fatalf("%s route not registered", label)
		}
	}
}
