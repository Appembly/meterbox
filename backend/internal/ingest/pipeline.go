package ingest

import (
	"fmt"
	"strings"
	"time"

	"github.com/meterbox/meterbox/internal/models"
	"github.com/meterbox/meterbox/internal/store"
)

// Pipeline orchestrates CloudEvents schema validation, synchronous Redis deduplication,
// token-bucket noisy-neighbor lane selection (`realtime` vs `bulk`), DLQ capture,
// and dogfood self-metering (`ns_meterbox_internal`).
type Pipeline struct {
	store *store.MultiTenantStore
}

func NewPipeline(s *store.MultiTenantStore) *Pipeline {
	return &Pipeline{store: s}
}

// IngestBatch processes one or more raw CloudEvent JSON objects for a resolved TenantContext.
func (p *Pipeline) IngestBatch(tc *models.TenantContext, rawEvents []map[string]interface{}, requestedLane string) models.IngestResult {
	now := time.Now().UTC()
	accepted := make([]models.CloudEvent, 0, len(rawEvents))
	deduplicated := 0
	dlqIDs := make([]string, 0)
	selectedLane := "realtime"

	for idx, raw := range rawEvents {
		evID := extractStr(raw, "id")
		if evID == "" {
			evID = fmt.Sprintf("missing_id_%d_%d", now.UnixNano(), idx)
		}
		evSource := extractStr(raw, "source")
		evType := extractStr(raw, "type")
		evSubject := extractStr(raw, "subject")

		// 1. Validate mandatory CloudEvents 1.0 attributes
		if evSource == "" || evType == "" || evSubject == "" {
			dlq := p.store.RecordDLQEvent(
				tc.Namespace,
				evID,
				raw,
				"missing_cloudevents_attributes",
				"CloudEvent requires non-empty 'source', 'type', and 'subject' fields",
			)
			dlqIDs = append(dlqIDs, dlq.ID)
			continue
		}

		dataMap, ok := raw["data"].(map[string]interface{})
		if !ok || dataMap == nil {
			dataMap = make(map[string]interface{})
		}

		evTime := now
		if timeStr := extractStr(raw, "time"); timeStr != "" {
			if parsed, err := time.Parse(time.RFC3339, timeStr); err == nil {
				evTime = parsed.UTC()
			}
		}

		candidate := models.CloudEvent{
			SpecVersion: "1.0",
			ID:          evID,
			Source:      evSource,
			Type:        evType,
			Subject:     evSubject,
			Time:        evTime,
			Data:        dataMap,
			Namespace:   tc.Namespace,
			IngestedAt:  now,
			StoredAt:    now,
		}

		// 2. Validate against active meter schemas in this namespace
		if errCode, errReason, valid := p.store.ValidateAgainstMeters(tc.Namespace, candidate); !valid {
			dlq := p.store.RecordDLQEvent(tc.Namespace, evID, raw, errCode, errReason)
			dlqIDs = append(dlqIDs, dlq.ID)
			continue
		}

		// 3. Synchronous Redis Deduplication (`SETNX dedup:{namespace}:{source}:{id}`)
		if p.store.CheckAndMarkDedup(tc.Namespace, evSource, evID) {
			deduplicated++
			continue
		}

		// 4. Token-Bucket Rate Limit & Lane Selection (`realtime` vs `bulk`)
		lane := p.store.SelectIngestionLane(tc.Namespace, tc.RateLimitRPS, requestedLane)
		candidate.Lane = lane
		selectedLane = lane

		accepted = append(accepted, candidate)
	}

	if len(accepted) > 0 {
		p.store.AppendEvents(accepted)

		// 5. Auto-provision any newly seen subjects so they appear in OpenMeter Subjects list
		for _, ev := range accepted {
			p.store.UpsertSubject(models.Subject{
				Namespace:   tc.Namespace,
				Key:         ev.Subject,
				DisplayName: ev.Subject,
			})
		}

		// 6. Dogfood Self-Metering: Emit `meterbox.events.ingested` into `ns_meterbox_internal`
		if tc.Namespace != models.InternalDogfoodNamespace && tc.OrgID != "" {
			dogfoodEvent := models.CloudEvent{
				SpecVersion: "1.0",
				ID:          fmt.Sprintf("dogfood_%s_%d", tc.Namespace, now.UnixNano()),
				Source:      "meterbox://sink-worker",
				Type:        "meterbox.events.ingested",
				Subject:     tc.OrgID,
				Time:        now,
				Data: map[string]interface{}{
					"count":            float64(len(accepted)),
					"tenant_namespace": tc.Namespace,
					"lane":             selectedLane,
				},
				Namespace:  models.InternalDogfoodNamespace,
				IngestedAt: now,
				StoredAt:   now,
				Lane:       "realtime",
			}
			p.store.AppendEvents([]models.CloudEvent{dogfoodEvent})
		}
	}

	return models.IngestResult{
		Accepted:     len(accepted),
		Deduplicated: deduplicated,
		RoutedLane:   selectedLane,
		DLQCount:     len(dlqIDs),
		DLQEventIDs:  dlqIDs,
		Namespace:    tc.Namespace,
	}
}

// ReplayDLQEvent re-submits a dead-letter event (optionally with a fixed payload) back through the pipeline.
func (p *Pipeline) ReplayDLQEvent(tc *models.TenantContext, dlqID string, updatedPayload map[string]interface{}) (models.IngestResult, error) {
	dlqEv, ok := p.store.GetDLQEvent(tc.Namespace, dlqID)
	if !ok {
		return models.IngestResult{}, fmt.Errorf("DLQ event %q not found in namespace %q", dlqID, tc.Namespace)
	}
	payloadToUse := dlqEv.RawPayload
	if len(updatedPayload) > 0 {
		payloadToUse = updatedPayload
	}

	res := p.IngestBatch(tc, []map[string]interface{}{payloadToUse}, "realtime")
	if res.Accepted > 0 {
		p.store.MarkDLQReplayed(tc.Namespace, dlqID, payloadToUse)
	}
	return res, nil
}

func extractStr(m map[string]interface{}, key string) string {
	raw, ok := m[key]
	if !ok || raw == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprintf("%v", raw))
}
