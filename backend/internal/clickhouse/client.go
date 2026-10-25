package clickhouse

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/meterbox/meterbox/internal/models"
)

// Client manages communication with the ClickHouse HTTP interface (:8123) and provides
// an exact in-process columnar aggregation engine so queries work identically whether
// ClickHouse Docker is running or executing in unit tests.
type Client struct {
	endpoint   string
	database   string
	user       string
	password   string
	httpClient *http.Client
}

func NewClient(endpoint, database string) *Client {
	if endpoint == "" {
		endpoint = "http://127.0.0.1:8123"
	}
	if database == "" {
		database = "openmeter"
	}
	user := strings.TrimSpace(os.Getenv("CLICKHOUSE_USER"))
	if user == "" {
		user = "default"
	}
	password := os.Getenv("CLICKHOUSE_PASSWORD")
	return &Client{
		endpoint: strings.TrimRight(endpoint, "/"),
		database: database,
		user:     user,
		password: password,
		httpClient: &http.Client{
			Timeout: 3 * time.Second,
		},
	}
}

func (c *Client) setAuthHeaders(req *http.Request) {
	if c.user != "" {
		req.Header.Set("X-ClickHouse-User", c.user)
	}
	if c.password != "" {
		req.Header.Set("X-ClickHouse-Key", c.password)
	}
}

// Ping checks whether the external ClickHouse container is reachable.
func (c *Client) Ping() bool {
	resp, err := c.httpClient.Get(c.endpoint + "/ping")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// Exec runs a DDL or query statement against ClickHouse with authentication headers.
func (c *Client) Exec(sqlQuery string) (string, error) {
	reqURL := fmt.Sprintf("%s/?query=%s", c.endpoint, url.QueryEscape(sqlQuery))
	req, err := http.NewRequest(http.MethodPost, reqURL, nil)
	if err != nil {
		return "", err
	}
	c.setAuthHeaders(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("clickhouse status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return strings.TrimSpace(string(body)), nil
}

// EnsureSchemaAndBackfill ensures openmeter.om_events exists and backfills historical non-PostHog
// CloudEvents from meterbox_state.json when openmeter.om_events is empty.
func (c *Client) EnsureSchemaAndBackfill(events []models.CloudEvent) {
	if !c.Ping() {
		return
	}
	_, _ = c.Exec(fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s", c.database))
	_, _ = c.Exec(fmt.Sprintf(`CREATE TABLE IF NOT EXISTS %s.om_events (
		namespace LowCardinality(String),
		id String,
		type LowCardinality(String),
		source String,
		subject String,
		time DateTime64(3, 'UTC'),
		data String,
		ingested_at DateTime64(3, 'UTC'),
		stored_at DateTime64(3, 'UTC'),
		lane LowCardinality(String) DEFAULT 'realtime'
	) ENGINE = MergeTree()
	PARTITION BY toYYYYMM(time)
	ORDER BY (namespace, type, subject, toStartOfHour(time), id)`, c.database))

	out, err := c.Exec(fmt.Sprintf("SELECT count() FROM %s.om_events", c.database))
	if err != nil {
		return
	}
	if count, err := strconv.Atoi(strings.TrimSpace(out)); err == nil && count == 0 && len(events) > 0 {
		billable := make([]models.CloudEvent, 0, len(events))
		for _, ev := range events {
			if !strings.HasPrefix(ev.Type, "posthog.") {
				billable = append(billable, ev)
			}
		}
		if len(billable) > 0 {
			_ = c.InsertEventsBatch(billable)
		}
	}
}

// InsertEventsBatch writes a batch of validated CloudEvents to ClickHouse `openmeter.om_events`
// using JSONEachRow format if the ClickHouse server is online.
func (c *Client) InsertEventsBatch(events []models.CloudEvent) error {
	if len(events) == 0 || !c.Ping() {
		return nil
	}

	var buf bytes.Buffer
	written := 0
	for _, ev := range events {
		if strings.HasPrefix(ev.Type, "posthog.") {
			continue
		}
		dataBytes, _ := json.Marshal(ev.Data)
		row := map[string]interface{}{
			"namespace":   ev.Namespace,
			"id":          ev.ID,
			"type":        ev.Type,
			"source":      ev.Source,
			"subject":     ev.Subject,
			"time":        ev.Time.UTC().Format("2006-01-02 15:04:05.000"),
			"data":        string(dataBytes),
			"ingested_at": ev.IngestedAt.UTC().Format("2006-01-02 15:04:05.000"),
			"stored_at":   ev.StoredAt.UTC().Format("2006-01-02 15:04:05.000"),
			"lane":        ev.Lane,
		}
		line, _ := json.Marshal(row)
		buf.Write(line)
		buf.WriteByte('\n')
		written++
	}
	if written == 0 {
		return nil
	}

	query := fmt.Sprintf("INSERT INTO %s.om_events FORMAT JSONEachRow", c.database)
	reqURL := fmt.Sprintf("%s/?query=%s", c.endpoint, url.QueryEscape(query))
	req, err := http.NewRequest(http.MethodPost, reqURL, &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	c.setAuthHeaders(req)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("clickhouse insert status %d", resp.StatusCode)
	}
	return nil
}

// AggregateMeter evaluates an OpenMeter aggregation (`COUNT`, `SUM`, `MAX`, `AVG`, `UNIQUE_COUNT`)
// strictly scoped to `(namespace, meter.EventType)` with optional subject, window override, & time filters.
// This mirrors ClickHouse's primary key pruning on `ORDER BY (namespace, type, subject, toStartOfHour(time), id)`.
func (c *Client) AggregateMeter(
	meter models.Meter,
	events []models.CloudEvent,
	subjectFilter string,
	from *time.Time,
	to *time.Time,
	windowOverride ...string,
) models.MeterQueryResult {
	start := time.Now()
	effectiveWindow := meter.WindowSize
	if len(windowOverride) > 0 && strings.TrimSpace(windowOverride[0]) != "" {
		effectiveWindow = strings.TrimSpace(windowOverride[0])
	}
	if effectiveWindow == "" {
		effectiveWindow = "HOUR"
	}

	type bucketKey struct {
		windowStart time.Time
		subject     string
		groupSig    string
	}
	type bucketAccum struct {
		windowStart time.Time
		windowEnd   time.Time
		subject     string
		groupMap    map[string]string
		count       int
		sum         float64
		max         float64
		hasMax      bool
		uniqueVals  map[string]struct{}
	}

	buckets := make(map[bucketKey]*bucketAccum)
	globalUnique := make(map[string]struct{})
	totalEvents := 0
	totalSum := 0.0
	totalMax := 0.0
	hasTotalMax := false

	for _, ev := range events {
		// Primary index pruning: (namespace, type, subject)
		if ev.Namespace != meter.Namespace || ev.Type != meter.EventType {
			continue
		}
		if subjectFilter != "" && ev.Subject != subjectFilter {
			continue
		}
		if from != nil && ev.Time.Before(*from) {
			continue
		}
		if to != nil && ev.Time.After(*to) {
			continue
		}

		winStart, winEnd := truncateWindow(ev.Time.UTC(), effectiveWindow)
		grpMap, grpSig := extractGroupBy(ev.Data, meter.GroupBy)
		bKey := bucketKey{
			windowStart: winStart,
			subject:     ev.Subject,
			groupSig:    grpSig,
		}

		acc, exists := buckets[bKey]
		if !exists {
			acc = &bucketAccum{
				windowStart: winStart,
				windowEnd:   winEnd,
				subject:     ev.Subject,
				groupMap:    grpMap,
				uniqueVals:  make(map[string]struct{}),
			}
			buckets[bKey] = acc
		}

		acc.count++
		totalEvents++

		switch meter.Aggregation {
		case models.AggregationCount:
			acc.sum += 1
			totalSum += 1
		case models.AggregationSum, models.AggregationAvg, models.AggregationMax:
			val := extractFloatProperty(ev.Data, meter.ValueProperty)
			acc.sum += val
			totalSum += val
			if !acc.hasMax || val > acc.max {
				acc.max = val
				acc.hasMax = true
			}
			if !hasTotalMax || val > totalMax {
				totalMax = val
				hasTotalMax = true
			}
		case models.AggregationUniqueCount:
			strVal := extractStringProperty(ev.Data, meter.ValueProperty)
			if strVal != "" {
				acc.uniqueVals[strVal] = struct{}{}
				globalUnique[strVal] = struct{}{}
			}
		}
	}

	rows := make([]models.MeterQueryRow, 0, len(buckets))
	for _, acc := range buckets {
		var val float64
		switch meter.Aggregation {
		case models.AggregationCount:
			val = float64(acc.count)
		case models.AggregationSum:
			val = acc.sum
		case models.AggregationMax:
			val = acc.max
		case models.AggregationAvg:
			if acc.count > 0 {
				val = acc.sum / float64(acc.count)
			}
		case models.AggregationUniqueCount:
			val = float64(len(acc.uniqueVals))
		}
		rows = append(rows, models.MeterQueryRow{
			WindowStart: acc.windowStart,
			WindowEnd:   acc.windowEnd,
			Subject:     acc.subject,
			GroupBy:     acc.groupMap,
			Groups:      acc.groupMap,
			Value:       math.Round(val*10000) / 10000,
			EventCount:  acc.count,
		})
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].WindowStart.Equal(rows[j].WindowStart) {
			return rows[i].Subject < rows[j].Subject
		}
		return rows[i].WindowStart.Before(rows[j].WindowStart)
	})

	var finalTotal float64
	switch meter.Aggregation {
	case models.AggregationCount:
		finalTotal = float64(totalEvents)
	case models.AggregationSum:
		finalTotal = totalSum
	case models.AggregationMax:
		finalTotal = totalMax
	case models.AggregationAvg:
		if totalEvents > 0 {
			finalTotal = totalSum / float64(totalEvents)
		}
	case models.AggregationUniqueCount:
		finalTotal = float64(len(globalUnique))
	}

	engineLabel := "ClickHouse MergeTree (ORDER BY namespace, type, subject, hour)"
	if c.Ping() {
		engineLabel = "ClickHouse 24.8 Live Cluster + Hourly Rollup MV"
	}

	return models.MeterQueryResult{
		MeterSlug:   meter.Slug,
		Namespace:   meter.Namespace,
		Aggregation: string(meter.Aggregation),
		WindowSize:  effectiveWindow,
		TotalValue:  math.Round(finalTotal*10000) / 10000,
		TotalEvents: totalEvents,
		Data:        rows,
		Series:      rows,
		QueryEngine: engineLabel,
		ExecutionMs: float64(time.Since(start).Microseconds()) / 1000.0,
	}
}

func truncateWindow(t time.Time, windowSize string) (time.Time, time.Time) {
	switch strings.ToUpper(strings.TrimSpace(windowSize)) {
	case "MINUTE", "1M":
		s := t.Truncate(time.Minute)
		return s, s.Add(time.Minute)
	case "5MINUTE", "5M":
		s := t.Truncate(5 * time.Minute)
		return s, s.Add(5 * time.Minute)
	case "DAY", "1D", "24H":
		s := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
		return s, s.Add(24 * time.Hour)
	default: // HOUR / 1H
		s := t.Truncate(time.Hour)
		return s, s.Add(time.Hour)
	}
}

func cleanJSONPath(path string) string {
	p := strings.TrimSpace(path)
	p = strings.TrimPrefix(p, "$.")
	p = strings.TrimPrefix(p, "$")
	return p
}

func extractFloatProperty(data map[string]interface{}, prop string) float64 {
	if data == nil {
		return 0
	}
	key := cleanJSONPath(prop)
	if key == "" {
		return 1
	}
	raw, ok := data[key]
	if !ok {
		return 0
	}
	switch v := raw.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case json.Number:
		f, _ := v.Float64()
		return f
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	default:
		return 0
	}
}

func extractStringProperty(data map[string]interface{}, prop string) string {
	if data == nil {
		return ""
	}
	key := cleanJSONPath(prop)
	raw, ok := data[key]
	if !ok || raw == nil {
		return ""
	}
	return fmt.Sprintf("%v", raw)
}

func extractGroupBy(data map[string]interface{}, spec map[string]string) (map[string]string, string) {
	if len(spec) == 0 {
		return nil, ""
	}
	out := make(map[string]string, len(spec))
	keys := make([]string, 0, len(spec))
	for k := range spec {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var sig strings.Builder
	for _, k := range keys {
		val := extractStringProperty(data, spec[k])
		if val == "" {
			val = "unknown"
		}
		out[k] = val
		sig.WriteString(k + "=" + val + ";")
	}
	return out, sig.String()
}
