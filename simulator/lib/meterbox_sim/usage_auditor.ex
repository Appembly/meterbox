defmodule MeterboxSim.UsageAuditor do
  @moduledoc """
  Continuous ClickHouse Rollup, Self-Billing Dogfood, Portal Token, and Hybrid
  Billing Auditor (`GenServer`).
  Periodically queries Meterbox's control plane and prints a structured ANSI
  terminal report summarizing end-to-end telemetry and financial state.
  """
  use GenServer

  alias MeterboxSim.{Client, TelemetryStore}

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{cycle: 0}, name: __MODULE__)
  end

  @doc """
  Executes a single audit pass synchronously and returns the collected snapshot.
  """
  def run_audit_once(cycle \\ 1) do
    perform_audit(cycle)
  end

  @impl true
  def init(state) do
    if MeterboxSim.config(:auto_start_workers, true) do
      tick = MeterboxSim.config(:audit_tick_ms, 5_000)
      Process.send_after(self(), :audit_tick, 3_200)
      {:ok, Map.put(state, :tick_ms, tick)}
    else
      {:ok, Map.put(state, :tick_ms, 5_000)}
    end
  end

  @impl true
  def handle_info(:audit_tick, state) do
    next_cycle = state.cycle + 1
    snapshot = perform_audit(next_cycle)
    render_report(next_cycle, snapshot)

    Process.send_after(self(), :audit_tick, state.tick_ms)
    {:noreply, %{state | cycle: next_cycle}}
  end

  defp perform_audit(cycle) do
    # 1. Query ClickHouse materialized rollups across all 3 registered meters
    llm_query = fetch_body(Client.query_meter("llm_tokens_total"))
    api_query = fetch_body(Client.query_meter("api_requests_total"))
    gpu_query = fetch_body(Client.query_meter("gpu_compute_seconds"))

    # 2. Query Pipeline Telemetry & Dogfood Self-Billing (`ns_meterbox_internal`)
    telemetry = fetch_body(Client.get_telemetry())
    dogfood = fetch_body(Client.get_dogfood_usage())

    # 3. Verify Subject-Scoped Customer Portal Token (`mb_portal_*`)
    portal_check =
      with {:ok, %{status: 201, body: %{"raw_key" => raw_key}}} <-
             Client.mint_portal_token("cust_hyperion_labs"),
           {:ok, %{status: 200, body: summary}} when is_map(summary) <-
             Client.fetch_portal_summary(raw_key, "cust_hyperion_labs") do
        %{
          status: "OK",
          entitlements: length(Map.get(summary, "entitlements", [])),
          invoices: length(Map.get(summary, "invoices", []))
        }
      else
        _ -> %{status: "UNAVAILABLE", entitlements: 0, invoices: 0}
      end

    # 4. Every 3rd audit cycle, trigger a Hybrid Invoice generation run
    if rem(cycle, 3) == 0 do
      subject =
        Enum.at(
          ["cust_hyperion_labs", "cust_nova_studio", "cust_aether_robotics"],
          rem(div(cycle, 3), 3)
        )

      case Client.generate_invoice(subject, "ai_scale_hybrid") do
        {:ok, %{status: 201, body: inv}} when is_map(inv) ->
          TelemetryStore.increment(:invoices_generated, 1)
          TelemetryStore.put_snapshot(:latest_invoice, inv)

        _ ->
          :ok
      end
    end

    snapshot = %{
      llm_total: Map.get(llm_query, "total_value", Map.get(llm_query, "total", 0)),
      llm_rows: Map.get(llm_query, "data", []),
      api_total: Map.get(api_query, "total_value", Map.get(api_query, "total", 0)),
      gpu_total: Map.get(gpu_query, "total_value", Map.get(gpu_query, "total", 0)),
      telemetry: telemetry,
      dogfood: dogfood,
      portal: portal_check,
      local: TelemetryStore.summary(),
      latest_invoice: TelemetryStore.get_snapshot(:latest_invoice)
    }

    TelemetryStore.put_snapshot(:last_audit, snapshot)
    snapshot
  end

  defp fetch_body({:ok, %{status: status, body: body}}) when status in 200..299 and is_map(body),
    do: body

  defp fetch_body(_), do: %{}

  defp render_report(cycle, snap) do
    local = snap.local
    tel = snap.telemetry
    dog = snap.dogfood

    cache_total = max(local.cache_hits + local.cache_misses, 1)
    hit_rate = Float.round(local.cache_hits * 100.0 / cache_total, 1)

    subject_breakdown =
      snap.llm_rows
      |> Enum.reduce(%{}, fn row, acc ->
        subj = Map.get(row, "subject", "unknown")
        val = Map.get(row, "value", 0)
        Map.update(acc, subj, val, &(&1 + val))
      end)
      |> Enum.map(fn {subj, val} -> "#{subj}=#{format_num(val)}" end)
      |> Enum.join(" | ")

    dogfood_billed =
      get_in(dog, ["meter_result", "total_value"]) ||
        get_in(dog, ["meter_result", "total"]) ||
        Map.get(dog, "ingested_events_billed", 0)

    invoice_banner =
      case snap.latest_invoice do
        %{"id" => id, "subject_key" => sub, "total_cents" => cents, "stripe_payment_intent" => pi} ->
          "$#{Float.round(cents / 100.0, 2)} (#{sub}, #{id}, #{pi})"

        _ ->
          "Pending cycle #3"
      end

    IO.puts("""
    \e[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\e[0m
    \e[1;32m⚡ METERBOX OTP TELEMETRY & CLICKHOUSE AUDITOR\e[0m  \e[90m[Cycle ##{cycle} • #{DateTime.utc_now() |> Calendar.strftime("%H:%M:%S UTC")}]\e[0m
    \e[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\e[0m
      \e[1mIngest Pipeline :\e[0m Accepted=\e[32m#{local.events_accepted}\e[0m | RealtimeBatches=#{local.realtime_batches} | BulkBatches=#{local.bulk_batches} | ServerAccepted=#{Map.get(tel, "ingested_total", 0)}
      \e[1mEdge Quota Gate :\e[0m Checks=#{local.quota_checks} | CacheHitRate=\e[33m#{hit_rate}%\e[0m | ServerHits=#{Map.get(tel, "cache_hits", 0)} | AutoTopUpGrants=\e[35m#{local.auto_grants_issued}\e[0m
      \e[1mChaos & Shield  :\e[0m SETNX_DedupVerified=\e[32m#{local.dedup_verified}\e[0m (ServerDedup=#{Map.get(tel, "deduplicated_total", 0)}) | DLQ_Injected=#{local.dlq_injected} | DLQ_Replayed=\e[32m#{local.dlq_replayed}\e[0m
      \e[1mClickHouse Roll :\e[0m llm_tokens_total=\e[1;36m#{format_num(snap.llm_total)}\e[0m | api_requests_total=\e[1;36m#{format_num(snap.api_total)}\e[0m | gpu_compute_seconds=\e[1;36m#{format_num(snap.gpu_total)}\e[0m
      \e[1mPer-Subject LLM :\e[0m #{if subject_breakdown == "", do: "warming up...", else: subject_breakdown}
      \e[1mDogfood Billing :\e[0m Namespace=\e[90m#{Map.get(dog, "internal_namespace", "ns_meterbox_internal")}\e[0m | Org=#{Map.get(dog, "organization_id", "org_demo_ai")} | BillableIngest=\e[32m#{format_num(dogfood_billed)}\e[0m
      \e[1mPortal & Stripe :\e[0m PortalToken=#{snap.portal.status} (ents=#{snap.portal.entitlements}) | InvoicesGenerated=#{local.invoices_generated} | Latest=#{invoice_banner}
    """)
  end

  defp format_num(n) when is_float(n), do: :erlang.float_to_binary(n, decimals: 0)
  defp format_num(n), do: to_string(n)
end
