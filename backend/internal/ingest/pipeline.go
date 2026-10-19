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

// IngestPostHogBatch translates native PostHog capture/batch events ($pageview, $identify, custom product events)
// into OpenMeter CloudEvents, hydrates 360° User Profiles (GeoIP location, browser/OS/device, session & pageview counts),
// and routes them through the standard deduplication & ClickHouse OLAP pipeline.
func (p *Pipeline) IngestPostHogBatch(tc *models.TenantContext, rawEvents []map[string]interface{}) models.IngestResult {
	now := time.Now().UTC()
	cloudEvents := make([]map[string]interface{}, 0, len(rawEvents))

	for idx, raw := range rawEvents {
		eventName := extractStr(raw, "event")
		if eventName == "" {
			eventName = "$pageview"
		}
		props, _ := raw["properties"].(map[string]interface{})
		if props == nil {
			props = make(map[string]interface{})
		}

		distinctID := extractStr(raw, "distinct_id")
		if distinctID == "" {
			distinctID = extractStr(props, "distinct_id")
		}
		if distinctID == "" {
			distinctID = extractStr(raw, "subject")
		}
		if distinctID == "" {
			distinctID = "anon_visitor"
		}

		evID := extractStr(raw, "uuid")
		if evID == "" {
			evID = extractStr(raw, "id")
		}
		if evID == "" {
			evID = fmt.Sprintf("ph_%d_%d", now.UnixNano(), idx)
		}

		timeStr := extractStr(raw, "timestamp")
		if timeStr == "" {
			timeStr = extractStr(raw, "time")
		}
		if timeStr == "" {
			timeStr = now.Format(time.RFC3339)
		}

		// Merge top-level convenience fields into properties if provided
		for _, k := range []string{
			"$pathname", "pathname", "$current_url", "$host",
			"$geoip_country_code", "country_code", "$geoip_country_name", "country_name",
			"$geoip_city_name", "city", "$geoip_subdivision_1_name", "region",
			"$timezone", "timezone", "$browser", "browser", "$os", "os",
			"$device_type", "device_type", "$session_id", "session_id",
			"email", "name", "display_name", "plan",
		} {
			if v, ok := raw[k]; ok && props[k] == nil {
				props[k] = v
			}
		}
		props["event"] = eventName

		// Map PostHog event name to canonical CloudEvent type
		ceType := "posthog.event"
		if eventName == "$pageview" || eventName == "pageview" {
			ceType = "posthog.pageview"
		} else if eventName == "$identify" || eventName == "identify" {
			ceType = "posthog.identify"
		}

		// Also merge $set / $set_once person properties if present
		if setMap, ok := raw["$set"].(map[string]interface{}); ok {
			for k, v := range setMap {
				props[k] = v
			}
		}
		if setMap, ok := props["$set"].(map[string]interface{}); ok {
			for k, v := range setMap {
				props[k] = v
			}
		}

		cloudEvents = append(cloudEvents, map[string]interface{}{
			"specversion": "1.0",
			"id":          evID,
			"source":      "posthog://sdk/capture",
			"type":        ceType,
			"subject":     distinctID,
			"time":        timeStr,
			"data":        props,
		})
	}

	return p.IngestBatch(tc, cloudEvents, "realtime")
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
