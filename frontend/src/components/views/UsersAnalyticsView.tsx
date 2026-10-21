"use client";

import React, { useState } from "react";
import {
  Subject,
  ProductAnalyticsReport,
  CloudEventRecord,
  DrawerKind,
} from "../../types/meterbox";
import { Sparkline } from "../Sparkline";

interface UsersAnalyticsViewProps {
  apiBase: string;
  activeNamespace: string;
  subjects: Subject[];
  analytics: ProductAnalyticsReport | null;
  recentEvents: CloudEventRecord[];
  selectedSubjectKey: string;
  setSelectedSubjectKey: (key: string) => void;
  setActiveDrawer: (d: DrawerKind) => void;
  onRefresh: () => Promise<void>;
  pushToast: (title: string, detail?: string, kind?: "ok" | "warn" | "err") => void;
  copyToClipboard: (text: string, label: string) => void;
}

export function countryFlag(code?: string): string {
  const c = (code || "US").trim().toUpperCase();
  if (c.length !== 2) return "🌐";
  const cp1 = 0x1f1e6 + (c.charCodeAt(0) - 65);
  const cp2 = 0x1f1e6 + (c.charCodeAt(1) - 65);
  if (cp1 < 0x1f1e6 || cp1 > 0x1f1ff || cp2 < 0x1f1e6 || cp2 > 0x1f1ff) {
    return "🌐";
  }
  return String.fromCodePoint(cp1, cp2);
}

const SAMPLE_GEO_PROFILES = [
  {
    distinct_id: "usr_mei_singapore",
    display_name: "Mei Lin (AI Product Lead)",
    email: "mei@appembly.dev",
    country_code: "SG",
    country_name: "Singapore",
    city: "Singapore",
    region: "Central Singapore",
    timezone: "Asia/Singapore",
    browser: "Chrome 134",
    os: "macOS Sequoia",
    device_type: "Desktop",
    pathname: "/finops/cost-intelligence",
  },
  {
    distinct_id: "usr_lucas_paris",
    display_name: "Lucas Moreau (Staff ML Engineer)",
    email: "lucas@appembly.dev",
    country_code: "FR",
    country_name: "France",
    city: "Paris",
    region: "Île-de-France",
    timezone: "Europe/Paris",
    browser: "Arc 1.85",
    os: "macOS Sequoia",
    device_type: "Desktop",
    pathname: "/workspaces/cyclode/canvas",
  },
  {
    distinct_id: "usr_priya_toronto",
    display_name: "Priya Patel (VP Engineering)",
    email: "priya@appembly.dev",
    country_code: "CA",
    country_name: "Canada",
    city: "Toronto",
    region: "Ontario",
    timezone: "America/Toronto",
    browser: "Safari 18.3",
    os: "iOS 18.3",
    device_type: "Mobile",
    pathname: "/billing/hybrid-plans",
  },
];

export function UsersAnalyticsView({
  apiBase,
  activeNamespace,
  subjects,
  analytics,
  recentEvents,
  selectedSubjectKey,
  setSelectedSubjectKey,
  setActiveDrawer,
  onRefresh,
  pushToast,
  copyToClipboard,
}: UsersAnalyticsViewProps) {
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [simStep, setSimStep] = useState<number>(0);

  const totalUsers = analytics?.total_users ?? subjects.length;
  const activeUsers24h = analytics?.active_users_24h ?? subjects.length;
  const totalPageviews =
    analytics?.total_pageviews ??
    subjects.reduce((acc, s) => acc + (s.pageview_count ?? 0), 0);
  const totalEvents =
    analytics?.total_product_events ??
    subjects.reduce((acc, s) => acc + (s.event_count ?? 0), 0);
  const totalSessions =
    analytics?.total_sessions ??
    subjects.reduce((acc, s) => acc + (s.session_count ?? 1), 0);
  const uniqueCountries =
    analytics?.unique_countries ??
    new Set(subjects.map((s) => s.country_code || "US")).size;

  const locations = analytics?.locations ?? [];
  const topPages = analytics?.top_pages ?? [];
  const eventBreakdown = analytics?.event_breakdown ?? [];
  const devices = analytics?.devices ?? [];

  const availableCountries = Array.from(
    new Set(subjects.map((s) => s.country_code || "US"))
  );

  const filteredSubjects =
    countryFilter === "all"
      ? subjects
      : subjects.filter((s) => (s.country_code || "US") === countryFilter);

  const activeProfile =
    subjects.find((s) => s.key === selectedSubjectKey) ||
    filteredSubjects[0] ||
    subjects[0];

  const profileEvents = recentEvents
    .filter((ev) => !activeProfile || ev.subject === activeProfile.key)
    .slice(0, 6);

  const handleSimulatePostHogPageview = async () => {
    const sample = SAMPLE_GEO_PROFILES[simStep % SAMPLE_GEO_PROFILES.length];
    setSimStep((n) => n + 1);

    const payload = {
      event: "$pageview",
      distinct_id: sample.distinct_id,
      properties: {
        display_name: sample.display_name,
        email: sample.email,
        $pathname: sample.pathname,
        $geoip_country_code: sample.country_code,
        $geoip_country_name: sample.country_name,
        $geoip_city_name: sample.city,
        $geoip_subdivision_1_name: sample.region,
        $timezone: sample.timezone,
        $browser: sample.browser,
        $os: sample.os,
        $device_type: sample.device_type,
        $session_id: `sess_${sample.country_code.toLowerCase()}_${Date.now()
          .toString(36)
          .slice(-4)}`,
      },
    };

    const res = await fetch(`${apiBase}/api/v1/posthog/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setSelectedSubjectKey(sample.distinct_id);
      await onRefresh();
      pushToast(
        `PostHog $pageview Captured (${countryFlag(sample.country_code)} ${sample.city})`,
        `Hydrated profile ${sample.distinct_id} → ${sample.pathname}`,
        "ok"
      );
    }
  };

  const handleSimulateProductAction = async () => {
    const targetSub = activeProfile?.key || subjects[0]?.key || "ws_cyclode_default";
    const actions = [
      "agent.task_created",
      "chart.rendered",
      "quota.evaluated",
      "invoice.previewed",
    ];
    const actionName = actions[simStep % actions.length];
    setSimStep((n) => n + 1);

    const payload = {
      event: actionName,
      distinct_id: targetSub,
      properties: {
        $pathname: activeProfile?.last_pathname || "/workspaces/cyclode/canvas",
        $geoip_country_code: activeProfile?.country_code || "US",
        $geoip_country_name: activeProfile?.country_name || "United States",
        $geoip_city_name: activeProfile?.city || "San Francisco",
        $browser: activeProfile?.browser || "Chrome 134",
        $os: activeProfile?.os || "macOS Sequoia",
        $device_type: activeProfile?.device_type || "Desktop",
        $session_id: `sess_${targetSub}_live`,
      },
    };

    const res = await fetch(`${apiBase}/api/v1/posthog/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenMeter-Namespace": activeNamespace,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await onRefresh();
      pushToast(
        `PostHog Event "${actionName}" Ingested`,
        `Subject: ${targetSub} · Routed to posthog_events_total`,
        "ok"
      );
    }
  };

  const curlPostHogCmd = `curl -X POST ${apiBase}/api/v1/posthog/capture \\
  -H "Content-Type: application/json" \\
  -H "X-OpenMeter-Namespace: ${activeNamespace}" \\
  -d '{
    "event": "$pageview",
    "distinct_id": "${activeProfile?.key || "usr_principal_01"}",
    "properties": {
      "$pathname": "/finops/cost-intelligence",
      "$geoip_country_code": "${activeProfile?.country_code || "US"}",
      "$geoip_city_name": "${activeProfile?.city || "San Francisco"}",
      "$browser": "${activeProfile?.browser || "Chrome 134"}",
      "$os": "${activeProfile?.os || "macOS Sequoia"}"
    }
  }'`;

  return (
    <>
      <div className="ws-head">
        <div>
          <div className="eyebrow">
            <span className="eb-dot" />
            <span>PostHog Product Telemetry &amp; 360° Identity</span>
            <span className="sep" />
            <span className="mono">{activeNamespace}</span>
          </div>
          <h1>Users, GeoIP Locations &amp; PostHog Events</h1>
          <p className="lede">
            Unified 360° user and workstation profiles combining PostHog product events (
            <code>$pageview</code>, <code>$identify</code>, custom actions), GeoIP cities &amp;
            countries, device fingerprints, and attributed AI token spend.
          </p>
        </div>
        <div className="ws-actions">
          <button
            type="button"
            className="btn"
            onClick={() => setActiveDrawer("customer")}
          >
            + Register Profile
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleSimulateProductAction}
          >
            + Capture Product Event
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleSimulatePostHogPageview}
          >
            + Simulate PostHog $pageview
          </button>
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="cards">
        <div className="card">
          <div className="card-head">
            <div className="eyebrow">360° User Profiles</div>
            <span className="chip ok mono">{activeUsers24h} active 24h</span>
          </div>
          <div className="card-stat-row">
            <div className="stat">{totalUsers}</div>
            <Sparkline
              values={subjects.map((s, i) => (s.event_count ?? 1) + i)}
              stroke="var(--primary)"
            />
          </div>
          <p>Identified users &amp; autonomous workstations</p>
          <div className="meta">
            <span className="mono">{totalSessions} sessions</span>
            <span className="mono">{uniqueCountries} countries</span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="eyebrow">Web Pageviews ($pageview)</div>
            <span className="chip mono">{topPages.length} routes</span>
          </div>
          <div className="card-stat-row">
            <div className="stat">{totalPageviews.toLocaleString()}</div>
            <Sparkline
              values={
                topPages.length > 0
                  ? topPages.map((p) => p.views).reverse()
                  : [2, 4, 5, 7, 9]
              }
              stroke="var(--ok)"
            />
          </div>
          <p>Captured via /api/v1/posthog/capture bridge</p>
          <div className="meta">
            <span className="mono">
              Top: {topPages[0]?.pathname || "/workspaces/cyclode"}
            </span>
            <span>Meter: pageviews_total</span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="eyebrow">Global GeoIP Reach</div>
            <span className="chip ok mono">{uniqueCountries} countries</span>
          </div>
          <div className="card-stat-row">
            <div className="stat">
              {countryFlag(locations[0]?.country_code || "US")}{" "}
              {locations[0]?.city || "San Francisco"}
            </div>
          </div>
          <p>
            Primary hub ({locations[0]?.users ?? 1} profiles ·{" "}
            {locations[0]?.share_pct ?? 40}% share)
          </p>
          <div className="meta">
            <span className="mono">{locations.length} active cities</span>
            <span>GeoIP enriched</span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="eyebrow">Total Product &amp; AI Events</div>
            <span className="chip mono">{eventBreakdown.length} event types</span>
          </div>
          <div className="card-stat-row">
            <div className="stat">{totalEvents.toLocaleString()}</div>
            <Sparkline
              values={
                eventBreakdown.length > 0
                  ? eventBreakdown.map((e) => e.count).reverse()
                  : [5, 8, 12, 15]
              }
              stroke="var(--primary)"
            />
          </div>
          <p>Correlated across PostHog &amp; OpenMeter</p>
          <div className="meta">
            <span className="mono">SETNX Dedup active</span>
            <span>Zero-drop DLQ</span>
          </div>
        </div>
      </div>

      {/* Main 360° User Profile Directory + Inspector */}
      <div className="grid2">
        <div className="panel">
          <h3>
            <span className="title-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              User &amp; Workstation Profiles ({filteredSubjects.length})
            </span>
            <div className="pill-tabs">
              <button
                type="button"
                className={`pill-tab ${countryFilter === "all" ? "active" : ""}`}
                onClick={() => setCountryFilter("all")}
              >
                All ({subjects.length})
              </button>
              {availableCountries.map((cc) => (
                <button
                  key={cc}
                  type="button"
                  className={`pill-tab mono ${countryFilter === cc ? "active" : ""}`}
                  onClick={() => setCountryFilter(cc)}
                >
                  {countryFlag(cc)} {cc}
                </button>
              ))}
            </div>
          </h3>

          <div className="table-wrap">
            <table className="cmp">
              <thead>
                <tr>
                  <th>Profile / Distinct ID</th>
                  <th>Location (GeoIP)</th>
                  <th>Client Device</th>
                  <th className="num">Views / Ev</th>
                  <th className="num">AI Spend</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((sub) => {
                  const isSel = activeProfile?.key === sub.key;
                  return (
                    <tr
                      key={sub.id || sub.key}
                      className={isSel ? "selected-row" : ""}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedSubjectKey(sub.key)}
                    >
                      <td>
                        <div style={{ fontWeight: 700 }}>{sub.display_name}</div>
                        <div
                          className="mono"
                          style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}
                        >
                          {sub.key}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 15 }}>
                            {countryFlag(sub.country_code)}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 12.5 }}>
                              {sub.city || "San Francisco"},{" "}
                              {sub.country_code || "US"}
                            </div>
                            <div
                              className="mono"
                              style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                            >
                              {sub.timezone || "America/Los_Angeles"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5 }}>
                          {sub.browser || "Chrome 134"}
                        </div>
                        <div
                          className="mono"
                          style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                        >
                          {sub.os || "macOS"} · {sub.device_type || "Desktop"}
                        </div>
                      </td>
                      <td className="num mono">
                        <span className="chip ok mono">
                          {sub.pageview_count ?? 0} pv
                        </span>{" "}
                        <span className="chip mono">{sub.event_count ?? 0} ev</span>
                      </td>
                      <td className="num mono" style={{ fontWeight: 700 }}>
                        <div>${(sub.total_cost_usd ?? 0).toFixed(4)}</div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: "var(--muted-foreground)",
                          }}
                        >
                          {(sub.total_tokens ?? 0).toLocaleString()} tok
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Selected 360° User Profile Inspector */}
        <div className="panel">
          <h3>
            <span className="title-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              360° Profile Inspector
            </span>
            {activeProfile && (
              <span className="chip ok mono">
                {countryFlag(activeProfile.country_code)}{" "}
                {activeProfile.city || "San Francisco"},{" "}
                {activeProfile.country_code || "US"}
              </span>
            )}
          </h3>

          {activeProfile ? (
            <>
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: "var(--surface-subtle)",
                  border: "1px solid var(--border)",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                      {activeProfile.display_name}
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 12, color: "var(--muted-foreground)" }}
                    >
                      distinct_id: <code>{activeProfile.key}</code>
                      {activeProfile.email ? ` · ${activeProfile.email}` : ""}
                    </div>
                  </div>
                  <span className="chip info mono">
                    {activeProfile.plan_name || "Enterprise Plan"}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                    >
                      Pageviews
                    </div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>
                      {activeProfile.pageview_count ?? 0}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                    >
                      Total Events
                    </div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>
                      {activeProfile.event_count ?? 0}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                    >
                      Sessions
                    </div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>
                      {activeProfile.session_count ?? 1}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                    >
                      AI Token Spend
                    </div>
                    <div
                      className="mono"
                      style={{ fontSize: 15, fontWeight: 700, color: "var(--primary)" }}
                    >
                      ${(activeProfile.total_cost_usd ?? 0).toFixed(4)}
                    </div>
                  </div>
                </div>

                <div
                  className="chips"
                  style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}
                >
                  <span className="chip mono">
                    Geo: {activeProfile.city || "San Francisco"},{" "}
                    {activeProfile.country_name || "United States"}
                  </span>
                  <span className="chip mono">
                    TZ: {activeProfile.timezone || "America/Los_Angeles"}
                  </span>
                  <span className="chip mono">
                    Client: {activeProfile.browser || "Chrome 134"} /{" "}
                    {activeProfile.os || "macOS"}
                  </span>
                  <span className="chip mono">
                    Last Route: {activeProfile.last_pathname || "/"}
                  </span>
                </div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--muted-foreground)",
                  marginBottom: 8,
                }}
              >
                Recent Activity Stream for {activeProfile.key}
              </div>
              <div className="table-wrap">
                <table className="cmp">
                  <thead>
                    <tr>
                      <th>Event / Type</th>
                      <th>Route / Model</th>
                      <th className="num">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profileEvents.map((ev) => (
                      <tr key={ev.id}>
                        <td>
                          <code>
                            {String(ev.data?.event || ev.type)}
                          </code>
                        </td>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {String(
                            ev.data?.$pathname ||
                              ev.data?.model ||
                              ev.data?.gpu_class ||
                              "—"
                          )}
                        </td>
                        <td
                          className="num mono"
                          style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}
                        >
                          {new Date(ev.time).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                    {profileEvents.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          style={{
                            textAlign: "center",
                            color: "var(--muted-foreground)",
                            padding: 16,
                          }}
                        >
                          Click &ldquo;+ Capture Product Event&rdquo; to stream events for{" "}
                          {activeProfile.key}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Geographic Distribution & Top Routes / Event Funnel */}
      <div className="grid2">
        <div className="panel">
          <h3>
            <span className="title-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Geographic Breakdown (Countries &amp; Cities)
            </span>
            <span className="chip mono">{locations.length} regions</span>
          </h3>

          <div className="table-wrap">
            <table className="cmp">
              <thead>
                <tr>
                  <th>City &amp; Country</th>
                  <th className="num">Users</th>
                  <th className="num">Pageviews</th>
                  <th className="num">Events</th>
                  <th className="num">AI Tokens</th>
                  <th className="num">Share</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={`${loc.country_code}-${loc.city}`}>
                    <td>
                      <span style={{ marginRight: 7 }}>
                        {countryFlag(loc.country_code)}
                      </span>
                      <strong>{loc.city}</strong>, {loc.country_name}
                    </td>
                    <td className="num mono" style={{ fontWeight: 700 }}>
                      {loc.users}
                    </td>
                    <td className="num mono">{loc.pageviews}</td>
                    <td className="num mono">{loc.events}</td>
                    <td className="num mono">{loc.tokens.toLocaleString()}</td>
                    <td className="num mono">
                      <span className="chip ok mono">{loc.share_pct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h3>
            <span className="title-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Top Pageview Routes &amp; Event Funnel
            </span>
            <span className="chip mono">{devices.length} device cohorts</span>
          </h3>

          <div className="table-wrap" style={{ marginBottom: 14 }}>
            <table className="cmp">
              <thead>
                <tr>
                  <th>Pathname ($pathname)</th>
                  <th className="num">Pageviews</th>
                  <th className="num">Unique Profiles</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((pg) => (
                  <tr key={pg.pathname}>
                    <td>
                      <code>{pg.pathname}</code>
                    </td>
                    <td className="num mono" style={{ fontWeight: 700 }}>
                      {pg.views}
                    </td>
                    <td className="num mono">{pg.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="chips">
            {eventBreakdown.map((eb) => (
              <span key={eb.event_type} className="chip mono">
                {eb.event_type}: <strong>{eb.count}</strong> ({eb.share_pct}%)
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* PostHog Bridge Quick-Start Snippet */}
      <div className="panel">
        <h3>
          <span className="title-left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            PostHog Ingestion Bridge (<code>POST /api/v1/posthog/capture</code>)
          </span>
          <button
            type="button"
            className="btn"
            style={{ padding: "4px 10px", fontSize: 11.5 }}
            onClick={() => copyToClipboard(curlPostHogCmd, "PostHog cURL command")}
          >
            Copy cURL
          </button>
        </h3>
        <div className="codeblock">
          <pre>{curlPostHogCmd}</pre>
        </div>
      </div>
    </>
  );
}
