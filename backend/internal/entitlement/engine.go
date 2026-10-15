package entitlement

import (
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/meterbox/meterbox/internal/models"
	"github.com/meterbox/meterbox/internal/store"
)

// Engine evaluates OpenMeter entitlements (`metered`, `boolean`, `static`) with sub-5ms
// Redis edge caching and priority credit grant burn-down.
type Engine struct {
	store *store.MultiTenantStore
}

func NewEngine(s *store.MultiTenantStore) *Engine {
	return &Engine{store: s}
}

// Evaluate checks whether `subjectKey` has access to `featureKey` inside `namespace`.
func (e *Engine) Evaluate(namespace, subjectKey, featureKey string) (models.EntitlementValue, error) {
	start := time.Now()

	// 1. Check sub-5ms Edge Cache first
	if cached, hit := e.store.GetCachedEntitlement(namespace, subjectKey, featureKey); hit {
		cached.EvaluationUs = time.Since(start).Microseconds()
		return cached, nil
	}

	// 2. Cache Miss: load entitlement & priority grants from transactional store
	ent, grants, ok := e.store.GetEntitlementBySubjectFeature(namespace, subjectKey, featureKey)
	if !ok {
		return models.EntitlementValue{}, fmt.Errorf("entitlement for subject=%q feature=%q not found in namespace %q", subjectKey, featureKey, namespace)
	}

	now := time.Now().UTC()
	if ent.Type == "boolean" || ent.Type == "static" {
		val := models.EntitlementValue{
			Namespace:    namespace,
			SubjectKey:   subjectKey,
			FeatureKey:   featureKey,
			Type:         ent.Type,
			HasAccess:    true,
			StaticConfig: ent.StaticConfig,
			CacheStatus:  "MISS",
			EvaluationUs: time.Since(start).Microseconds(),
			EvaluatedAt:  now,
		}
		e.store.SetCachedEntitlement(namespace, subjectKey, featureKey, val)
		return val, nil
	}

	// 3. Metered Entitlement: query usage from ClickHouse since PeriodStart
	usageInPeriod := 0.0
	if ent.MeterSlug != "" {
		qRes, err := e.store.QueryMeter(namespace, ent.MeterSlug, subjectKey, &ent.PeriodStart, nil)
		if err == nil {
			usageInPeriod = qRes.TotalValue
		}
	}

	// 4. Sort active grants by Priority ascending (Priority 1 burns before Priority 2)
	activeGrants := make([]models.EntitlementGrant, 0, len(grants))
	for _, g := range grants {
		if g.ExpiresAt != nil && now.After(*g.ExpiresAt) {
			continue
		}
		activeGrants = append(activeGrants, g)
	}
	sort.Slice(activeGrants, func(i, j int) bool {
		if activeGrants[i].Priority == activeGrants[j].Priority {
			return activeGrants[i].EffectiveAt.Before(activeGrants[j].EffectiveAt)
		}
		return activeGrants[i].Priority < activeGrants[j].Priority
	})

	// If no explicit grant rows exist, use `IssueAfterReset` as a default grant
	if len(activeGrants) == 0 && ent.IssueAfterReset > 0 {
		activeGrants = append(activeGrants, models.EntitlementGrant{
			ID:        "grt_default_allowance",
			Name:      "Included Period Allowance",
			Amount:    ent.IssueAfterReset,
			Priority:  1,
			CreatedAt: ent.CreatedAt,
		})
	}

	remainingToBurn := usageInPeriod
	totalGranted := 0.0
	breakdown := make([]models.GrantBurnDown, 0, len(activeGrants))

	for _, g := range activeGrants {
		totalGranted += g.Amount
		usedFromGrant := 0.0
		if remainingToBurn > 0 {
			usedFromGrant = math.Min(g.Amount, remainingToBurn)
			remainingToBurn -= usedFromGrant
		}
		breakdown = append(breakdown, models.GrantBurnDown{
			GrantID:   g.ID,
			GrantName: g.Name,
			Priority:  g.Priority,
			Initial:   g.Amount,
			Used:      usedFromGrant,
			Remaining: g.Amount - usedFromGrant,
		})
	}

	balance := math.Max(0, totalGranted-usageInPeriod)
	overage := math.Max(0, usageInPeriod-totalGranted)
	hasAccess := balance > 0 || ent.IsSoftLimit

	result := models.EntitlementValue{
		Namespace:      namespace,
		SubjectKey:     subjectKey,
		FeatureKey:     featureKey,
		Type:           ent.Type,
		HasAccess:      hasAccess,
		Balance:        balance,
		UsageInPeriod:  usageInPeriod,
		TotalGranted:   totalGranted,
		Overage:        overage,
		IsSoftLimit:    ent.IsSoftLimit,
		GrantBreakdown: breakdown,
		CacheStatus:    "MISS",
		EvaluationUs:   time.Since(start).Microseconds(),
		EvaluatedAt:    now,
	}

	// Store in Edge Cache
	e.store.SetCachedEntitlement(namespace, subjectKey, featureKey, result)
	return result, nil
}
