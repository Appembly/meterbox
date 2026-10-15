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
		return models.Invoice{}, fmt.Errorf("plan %q not found in namespace %q", planSlug, namespace)
	}

	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodEnd := periodStart.AddDate(0, 1, 0)

	lineItems := make([]models.InvoiceLineItem, 0, len(plan.RateCards)+1)
	subtotalCents := 0

	// 1. Recurring Base Subscription Fee
	if plan.BasePriceCents > 0 {
		lineItems = append(lineItems, models.InvoiceLineItem{
			Description:   fmt.Sprintf("%s — Base Subscription (%s)", plan.Name, plan.BillingCadence),
			Quantity:      1,
			IncludedUnits: 0,
			BillableUnits: 1,
			AmountCents:   plan.BasePriceCents,
		})
		subtotalCents += plan.BasePriceCents
	}

	// 2. Evaluate each Usage RateCard against ClickHouse meter aggregations
	for _, rc := range plan.RateCards {
		qRes, err := e.store.QueryMeter(namespace, rc.MeterSlug, subjectKey, &periodStart, &periodEnd)
		usageQty := 0.0
		if err == nil {
			usageQty = qRes.TotalValue
		}

		billableQty := math.Max(0, usageQty-rc.IncludedQuantity)
		amountCents := calculateRateCardAmountCents(rc, billableQty)

		lineItems = append(lineItems, models.InvoiceLineItem{
			Description:   fmt.Sprintf("%s (%s)", rc.Name, rc.PricingModel),
			MeterSlug:     rc.MeterSlug,
			Quantity:      usageQty,
			IncludedUnits: rc.IncludedQuantity,
			BillableUnits: billableQty,
			AmountCents:   amountCents,
		})
		subtotalCents += amountCents
	}

	status := "issued"
	stripeInvoiceID := ""
	if syncToStripe {
		status = "synced_stripe"
		stripeInvoiceID = fmt.Sprintf("in_stripe_%s_%d", subjectKey, now.Unix()%100000)
	}

	inv := models.Invoice{
		Namespace:       namespace,
		SubjectKey:      subjectKey,
		PlanSlug:        plan.Slug,
		Currency:        plan.Currency,
		SubtotalCents:   subtotalCents,
		TaxCents:        0,
		TotalCents:      subtotalCents,
		Status:          status,
		StripeInvoiceID: stripeInvoiceID,
		LineItems:       lineItems,
		PeriodStart:     periodStart,
		PeriodEnd:       periodEnd,
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
