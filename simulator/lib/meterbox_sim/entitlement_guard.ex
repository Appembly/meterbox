defmodule MeterboxSim.EntitlementGuard do
  @moduledoc """
  Pre-flight Entitlement Gatekeeper (`GenServer`).
  Uses the read-only `mb_ent_live_*` key to evaluate customer quota balances
  before workload workers emit LLM token usage. If a hard-capped customer
  exhausts their balance, `EntitlementGuard` automatically issues a top-up
  credit grant so the continuous stream recovers gracefully.
  """
  use GenServer
  require Logger

  alias MeterboxSim.{Client, TelemetryStore}

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  @doc """
  Evaluates `(subject_key, feature_key)` on the critical path.
  Returns `{:ok, evaluation_map}` or `{:replenished, evaluation_map}`.
  """
  def check_access(subject_key, feature_key \\ "ai_token_allowance") do
    GenServer.call(__MODULE__, {:check_access, subject_key, feature_key}, 8_000)
  end

  @impl true
  def init(state) do
    {:ok, state}
  end

  @impl true
  def handle_call({:check_access, subject_key, feature_key}, _from, state) do
    TelemetryStore.increment(:quota_checks, 1)

    case Client.evaluate_entitlement(subject_key, feature_key) do
      {:ok, %{status: 200, headers: headers, body: body}} when is_map(body) ->
        cache_status = Map.get(headers, "x-meterbox-cache", Map.get(body, "cache_status", "MISS"))

        if cache_status == "HIT" do
          TelemetryStore.increment(:cache_hits, 1)
        else
          TelemetryStore.increment(:cache_misses, 1)
        end

        has_access = Map.get(body, "has_access", true)
        balance = Map.get(body, "balance", 0)

        if has_access do
          {:reply, {:ok, body}, state}
        else
          Logger.warning(
            "[EntitlementGuard] Quota exhausted for #{subject_key} (#{feature_key}, balance=#{balance}) -> issuing auto top-up credit grant"
          )

          replenish_subject_grant(subject_key, feature_key)
          {:reply, {:replenished, body}, state}
        end

      {:ok, %{status: 404}} ->
        # Provision entitlement if missing for this subject
        _ =
          Client.create_entitlement(%{
            subject_key: subject_key,
            feature_key: feature_key,
            feature_name: "Monthly AI Token Quota",
            type: "metered",
            meter_slug: "llm_tokens_total",
            issue_after_reset: 75_000,
            initial_grant_amount: 75_000,
            is_soft_limit: false
          })

        {:reply, {:ok, %{"has_access" => true, "balance" => 75_000}}, state}

      other ->
        {:reply, {:error, other}, state}
    end
  end

  defp replenish_subject_grant(subject_key, feature_key) do
    with {:ok, %{status: 200, body: ents}} when is_list(ents) <-
           Client.list_entitlements(subject_key),
         %{"id" => ent_id} <-
           Enum.find(ents, fn e -> Map.get(e, "feature_key") == feature_key end),
         {:ok, %{status: 201}} <-
           Client.issue_credit_grant(
             ent_id,
             "Elixir Auto-Replenish Grant (#{System.system_time(:second)})",
             50_000,
             1
           ) do
      TelemetryStore.increment(:auto_grants_issued, 1)
      :ok
    else
      _ -> :error
    end
  end
end
