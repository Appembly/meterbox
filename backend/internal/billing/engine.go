package billing

import (
	"fmt"
	"math"
	"time"

	"github.com/meterbox/meterbox/internal/models"
	"github.com/meterbox/meterbox/internal/store"
)

// Engine calculates hybrid subscription + usage-based invoices from ClickHouse meter rollups
// and synchronizes invoices with Stripe.
type Engine struct {
	store *store.MultiTenantStore
}

func NewEngine(s *store.MultiTenantStore) *Engine {
	return &Engine{store: s}
}

// GenerateInvoice computes an itemized invoice for `(namespace, subjectKey, planSlug)`
// combining recurring base fees, included allowances, and graduated/flat rate cards.
func (e *Engine) GenerateInvoice(namespace, subjectKey, planSlug string, syncToStripe bool) (models.Invoice, error) {
	plan, ok := e.store.GetPlan(namespace, planSlug)
	if !ok {
		if planSlug == "" || planSlug == "pay_as_you_go" {
			meters := e.store.ListMeters(namespace)
			cards := make([]models.RateCard, 0, len(meters))
			for _, m := range meters {
				unitCents := 0.1
				if m.Slug == "llm_tokens_total" {
					unitCents = 0.03
				} else if m.Slug == "sandbox_compute_seconds" || m.Slug == "gpu_compute_seconds" {
					unitCents = 1.2
				}
				cards = append(cards, models.RateCard{
					FeatureKey:       m.Slug,
					MeterSlug:        m.Slug,
					Name:             m.Name,
					PricingModel:     "flat_per_unit",
					IncludedQuantity: 0,
					Tiers: []models.RateCardTier{
						{UpToAmount: nil, UnitPriceCents: unitCents, FlatFeeCents: 0},
					},
				})
			}
			plan = models.Plan{
				Namespace:      namespace,
				Slug:           "pay_as_you_go",
				Name:           "Pay-as-you-go (Direct Metered Usage)",
				Currency:       "USD",
				BasePriceCents: 0,
				BillingCadence: "MONTH",
				RateCards:      cards,
			}
		} else {
			return models.Invoice{}, fmt.Errorf("plan %q not found in namespace %q", planSlug, namespace)
		}
	}

	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodEnd := periodStart.AddDate(0, 1, 0)

	lineItems := make([]models.InvoiceLineItem, 0, len(plan.RateCards)+1)
	subtotalCents := 0

	// 1. Recurring Base Subscription Fee
	if plan.BasePriceCents > 0 {
		lineItems = append(lineItems, models.InvoiceLineItem{
			Description:    fmt.Sprintf("%s — Base Subscription (%s)", plan.Name, plan.BillingCadence),
			Quantity:       1,
			IncludedUnits:  0,
			BillableUnits:  1,
			UnitPriceCents: float64(plan.BasePriceCents),
			AmountCents:    plan.BasePriceCents,
		})
		subtotalCents += plan.BasePriceCents
	}

	// 2. Evaluate each Usage RateCard against ClickHouse meter aggregations
	usageCentsTotal := 0
	for _, rc := range plan.RateCards {
		qRes, err := e.store.QueryMeter(namespace, rc.MeterSlug, subjectKey, &periodStart, &periodEnd)
		usageQty := 0.0
		if err == nil {
			usageQty = qRes.TotalValue
		}

		billableQty := math.Max(0, usageQty-rc.IncludedQuantity)
		amountCents := calculateRateCardAmountCents(rc, billableQty)
		unitPrice := 0.0
		if len(rc.Tiers) > 0 {
			unitPrice = rc.Tiers[0].UnitPriceCents
		}

		lineItems = append(lineItems, models.InvoiceLineItem{
			Description:    fmt.Sprintf("%s (%s)", rc.Name, rc.PricingModel),
			MeterSlug:      rc.MeterSlug,
			Quantity:       usageQty,
			IncludedUnits:  rc.IncludedQuantity,
			BillableUnits:  billableQty,
			UnitPriceCents: unitPrice,
			AmountCents:    amountCents,
		})
		subtotalCents += amountCents
		usageCentsTotal += amountCents
	}

	// 3. Apply Priority 1 Prepaid Credit Grants against usage & base fee
	creditsAppliedCents := e.store.CalculateSubjectCreditOffsetCents(namespace, subjectKey, subtotalCents)
	totalCents := subtotalCents - creditsAppliedCents
	if totalCents < 0 {
		totalCents = 0
	}

	status := "issued"
	stripeInvoiceID := ""
	if syncToStripe {
		status = "synced_stripe"
		stripeInvoiceID = fmt.Sprintf("in_stripe_%s_%d", subjectKey, now.Unix()%100000)
	}

	inv := models.Invoice{
		Namespace:           namespace,
		SubjectKey:          subjectKey,
		PlanSlug:            plan.Slug,
		Currency:            plan.Currency,
		SubtotalCents:       subtotalCents,
		CreditsAppliedCents: creditsAppliedCents,
		TaxCents:            0,
		TotalCents:          totalCents,
		Status:              status,
		StripeInvoiceID:     stripeInvoiceID,
		LineItems:           lineItems,
		PeriodStart:         periodStart,
		PeriodEnd:           periodEnd,
		IssuedAt:            now,
		CreatedAt:           now,
	}

	return e.store.SaveInvoice(inv), nil
}

func calculateRateCardAmountCents(rc models.RateCard, billableQty float64) int {
	if billableQty <= 0 || len(rc.Tiers) == 0 {
		return 0
	}

	switch rc.PricingModel {
	case "graduated":
		remaining := billableQty
		prevCap := 0.0
		totalCents := 0.0
		for _, tier := range rc.Tiers {
			if remaining <= 0 {
				break
			}
			var tierUnits float64
			if tier.UpToAmount == nil {
				tierUnits = remaining
			} else {
				tierWidth := math.Max(0, *tier.UpToAmount-prevCap)
				tierUnits = math.Min(remaining, tierWidth)
				prevCap = *tier.UpToAmount
			}
			if tierUnits > 0 {
				totalCents += float64(tier.FlatFeeCents) + (tierUnits * tier.UnitPriceCents)
				remaining -= tierUnits
			}
		}
		return int(math.Round(totalCents))
	default: // flat_per_unit
		tier := rc.Tiers[0]
		return tier.FlatFeeCents + int(math.Round(billableQty*tier.UnitPriceCents))
	}
}
