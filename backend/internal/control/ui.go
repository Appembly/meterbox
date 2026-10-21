package control

import "net/http"

// RegisterUI attaches the self-contained interactive Control Plane Dashboard UI on `GET /`
// so developers can also explore the full Meterbox console directly on `:8080`.
func (s *Server) serveDashboardHTML(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(dashboardHTML))
}

const dashboardHTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Meterbox Cloud — Managed OpenMeter Control Plane</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#090d16] text-slate-100 min-h-screen font-sans antialiased">
  <header class="border-b border-slate-800 bg-[#0d1322] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg">M</div>
      <div>
        <div class="flex items-center gap-2">
          <span class="font-semibold text-lg">Meterbox Cloud</span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Managed OpenMeter Control Plane</span>
        </div>
        <p class="text-xs text-slate-400">Multi-Tenant Namespace Router • Redpanda Lanes • ClickHouse Rollups • Sub-5ms Redis Quota Cache</p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <label class="text-xs text-slate-400">Namespace:</label>
      <select id="nsSelect" onchange="refreshAll()" class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-emerald-400">
        <option value="ns_live_demo">Production (ns_live_demo)</option>
        <option value="ns_test_demo">Sandbox (ns_test_demo)</option>
      </select>
      <button onclick="resetSandbox()" class="text-xs px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30">Reset Sandbox</button>
    </div>
  </header>

  <main class="max-w-7xl mx-auto p-6 space-y-6">
    <div id="banner" class="hidden px-4 py-2.5 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 text-sm"></div>

    <!-- Telemetry Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4" id="telemetryCards"></div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- CloudEvents Ingestion & Deduplication Tester -->
      <div class="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div class="flex justify-between items-center">
          <h2 class="font-semibold text-base">1. CloudEvents Ingestion & Redis Deduplication</h2>
          <span class="text-xs font-mono text-slate-400">POST /api/v1/events</span>
        </div>
        <textarea id="eventInput" rows="8" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-300">{
  "specversion": "1.0",
  "id": "evt_live_9001",
  "source": "https://gateway.demo-ai.dev/v1/chat",
  "type": "ai.llm.tokens",
  "subject": "cust_hyperion_labs",
  "data": { "tokens": 5000, "model": "claude-4-sonnet", "token_type": "output" }
}</textarea>
        <div class="flex flex-wrap gap-2">
          <button onclick="ingestEvent('realtime')" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium">Emit Realtime Event</button>
          <button onclick="ingestEvent('bulk')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium">Emit Bulk Backfill Lane</button>
          <button onclick="emitMalformed()" class="px-3 py-1.5 rounded-lg bg-amber-600/30 border border-amber-500/40 text-amber-200 text-xs font-medium">Emit Malformed Event -> DLQ</button>
        </div>
      </div>

      <!-- Sub-5ms Entitlement Edge Cache & Priority Grants -->
      <div class="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div class="flex justify-between items-center">
          <h2 class="font-semibold text-base">2. Sub-5ms Edge Quota Check & Grant Burn-Down</h2>
          <button onclick="checkEntitlement()" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium">Evaluate Quota (cust_hyperion_labs)</button>
        </div>
        <div id="entitlementBox" class="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 min-h-[180px] whitespace-pre-wrap"></div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- ClickHouse Meter Aggregations -->
      <div class="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div class="flex justify-between items-center">
          <h2 class="font-semibold text-base">3. ClickHouse Meter Rollup (llm_tokens_total)</h2>
          <span class="text-xs font-mono text-indigo-400">ORDER BY (namespace, type, subject, hour)</span>
        </div>
        <div id="meterRollupBox" class="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 min-h-[160px] whitespace-pre-wrap"></div>
      </div>

      <!-- DLQ Replay & Hybrid Stripe Invoicing -->
      <div class="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div class="flex justify-between items-center">
          <h2 class="font-semibold text-base">4. DLQ Replay & Hybrid Stripe Billing</h2>
          <button onclick="generateInvoice()" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium">Generate Hybrid Invoice</button>
        </div>
        <div id="dlqBox" class="space-y-2 text-xs"></div>
        <div id="invoiceBox" class="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 whitespace-pre-wrap"></div>
      </div>
    </div>
  </main>

  <script>
    function ns() { return document.getElementById('nsSelect').value; }
    function showBanner(msg) {
      const el = document.getElementById('banner');
      el.textContent = msg;
      el.classList.remove('hidden');
    }
    async function refreshAll() {
      const headers = { 'X-OpenMeter-Namespace': ns() };
      const [tel, mtr, dlq, inv] = await Promise.all([
        fetch('/api/control/v1/telemetry', { headers }).then(r => r.json()),
        fetch('/api/v1/meters/llm_tokens_total/query', { headers }).then(r => r.json()),
        fetch('/api/control/v1/dlq', { headers }).then(r => r.json()),
        fetch('/api/v1/invoices', { headers }).then(r => r.json())
      ]);
      document.getElementById('telemetryCards').innerHTML = [
        ['Ingested Events (' + tel.active_namespace + ')', tel.total_events_ingested, 'Realtime: ' + tel.realtime_lane_events + ' | Bulk: ' + tel.bulk_lane_events],
        ['Edge Cache Hit Ratio', tel.edge_cache_hit_ratio_pct.toFixed(1) + '%', 'Hits: ' + tel.edge_cache_hits + ' | Misses: ' + tel.edge_cache_misses],
        ['Redis Dedup & Pending DLQ', tel.deduplicated_dropped + ' dedup / ' + tel.pending_dlq_events + ' DLQ', 'Exact-once SETNX idempotency'],
        ['Dogfood Billing (ns_meterbox_internal)', '$' + (tel.dogfood_estimated_cents / 100).toFixed(2), tel.dogfood_org_events_billed + ' tenant events metered']
      ].map(([title, val, sub]) => '<div class="p-4 rounded-xl bg-slate-900/90 border border-slate-800"><div class="text-xs text-slate-400">' + title + '</div><div class="text-2xl font-bold mt-1 text-white">' + val + '</div><div class="text-xs text-indigo-300 mt-1">' + sub + '</div></div>').join('');

      document.getElementById('meterRollupBox').textContent = JSON.stringify(mtr, null, 2);
      document.getElementById('dlqBox').innerHTML = dlq.map(d =>
        '<div class="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between items-center"><div><span class="font-mono text-rose-400">' + d.error_code + '</span>: ' + d.error_reason + ' (' + d.status + ')</div>' +
        (d.status === 'pending' ? '<button onclick="replayDLQ(\'' + d.id + '\')" class="px-2.5 py-1 rounded bg-emerald-600 text-white">Fix & Replay</button>' : '') + '</div>'
      ).join('');
      document.getElementById('invoiceBox').textContent = inv.length ? JSON.stringify(inv[0], null, 2) : 'Click "Generate Hybrid Invoice" to rate ClickHouse usage against Plan tiers.';
    }
    async function ingestEvent(lane) {
      const payload = JSON.parse(document.getElementById('eventInput').value);
      const res = await fetch('/api/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-OpenMeter-Namespace': ns(), 'X-Meterbox-Lane': lane },
        body: JSON.stringify(payload)
      }).then(r => r.json());
      showBanner('Ingested: accepted=' + res.accepted + ', deduplicated=' + res.deduplicated + ', dlq=' + res.dlq_count + ', lane=' + res.routed_lane);
      refreshAll();
    }
    async function emitMalformed() {
      const bad = { specversion: '1.0', id: 'evt_bad_' + Date.now(), source: 'https://agent.demo-ai.dev', type: 'ai.llm.tokens', subject: 'cust_hyperion_labs', data: { tokens: 'BAD_STRING' } };
      await fetch('/api/v1/events', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OpenMeter-Namespace': ns() }, body: JSON.stringify(bad) });
      showBanner('Emitted malformed event -> captured in DLQ for inspection.');
      refreshAll();
    }
    async function replayDLQ(id) {
      const fixed = { payload: { specversion: '1.0', id: 'evt_replayed_' + id, source: 'https://agent.demo-ai.dev', type: 'ai.llm.tokens', subject: 'cust_hyperion_labs', data: { tokens: 4000, model: 'claude-4-sonnet' } } };
      await fetch('/api/control/v1/dlq/' + id + '/replay', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OpenMeter-Namespace': ns() }, body: JSON.stringify(fixed) });
      showBanner('Replayed DLQ event ' + id + ' into ClickHouse!');
      refreshAll();
    }
    async function checkEntitlement() {
      const res = await fetch('/api/v1/subjects/cust_hyperion_labs/entitlements/ai_token_allowance/value', { headers: { 'X-OpenMeter-Namespace': ns() } }).then(r => r.json());
      document.getElementById('entitlementBox').textContent = JSON.stringify(res, null, 2);
      refreshAll();
    }
    async function generateInvoice() {
      await fetch('/api/v1/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-OpenMeter-Namespace': ns() },
        body: JSON.stringify({ subject_key: 'cust_hyperion_labs', plan_slug: 'ai_scale_hybrid', sync_to_stripe: true })
      });
      showBanner('Generated hybrid invoice & synced to Stripe!');
      refreshAll();
    }
    async function resetSandbox() {
      const res = await fetch('/api/control/v1/environments/reset', { method: 'POST', headers: { 'X-OpenMeter-Namespace': ns() } });
      showBanner(res.ok ? 'Sandbox namespace wiped and re-seeded!' : 'Switch to Sandbox (ns_test_demo) first to reset.');
      refreshAll();
    }
    refreshAll();
    checkEntitlement();
  </script>
</body>
</html>`
