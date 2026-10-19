defmodule MeterboxSim.ChaosWorker do
  @moduledoc """
  Resilience & Chaos Engine (`GenServer`).
  Periodically injects three architectural resilience scenarios into Meterbox:
    1. `:dedup` — Sends identical `(source, id)` CloudEvents twice to verify the
       24-hour Redis `SETNX` idempotency shield (`deduplicated: 1`).
    2. `:bulk` — Sends a 15-event batch with `X-Meterbox-Lane: bulk` to exercise
       multi-lane Redpanda topic isolation (`om.events.bulk.v1`) so backfills
       never delay real-time quota evaluations.
    3. `:dlq_repair` — Injects a malformed event (`tokens` as a string instead of
       numeric) to trigger Dead-Letter Queue (`om.events.dlq.v1`) isolation, then
       queries `/api/control/v1/dlq` and replays the repaired JSON payload map via
       `POST /api/control/v1/dlq/{id}/replay`.
  """
  use GenServer

  alias MeterboxSim.{Client, TelemetryStore}

  @phases [:dedup, :bulk, :dlq_repair]

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{phase_idx: 0}, name: __MODULE__)
  end

  @doc """
  Triggers a chaos scenario on demand (`:dedup`, `:bulk`, or `:dlq_repair`).
  """
  def run_scenario(phase) when phase in @phases do
    execute_phase(phase)
  end

  @impl true
  def init(state) do
    if MeterboxSim.config(:auto_start_workers, true) do
      tick = MeterboxSim.config(:chaos_tick_ms, 8_000)
      Process.send_after(self(), :chaos_tick, 2_500)
      {:ok, Map.put(state, :tick_ms, tick)}
    else
      {:ok, Map.put(state, :tick_ms, 8_000)}
    end
  end

  @impl true
  def handle_info(:chaos_tick, state) do
    phase = Enum.at(@phases, rem(state.phase_idx, length(@phases)))
    _ = execute_phase(phase)

    Process.send_after(self(), :chaos_tick, state.tick_ms)
    {:noreply, %{state | phase_idx: state.phase_idx + 1}}
  end

  defp execute_phase(:dedup) do
    uniq = "#{System.unique_integer([:positive])}_#{System.system_time(:millisecond)}"
    now_iso = DateTime.utc_now() |> DateTime.to_iso8601()

    event = %{
      specversion: "1.0",
      id: "evt_ex_dedup_#{uniq}",
      source: "elixir://chaos-dedup-probe",
      type: "ai.llm.tokens",
      subject: "cust_hyperion_labs",
      time: now_iso,
      data: %{tokens: 512, model: "claude-4-sonnet", token_type: "input"}
    }

    with {:ok, %{status: 202, body: %{"accepted" => 1}}} <- Client.ingest_events([event], "realtime"),
         {:ok, %{status: 202, body: %{"deduplicated" => dupes}}} when dupes >= 1 <-
           Client.ingest_events([event], "realtime") do
      TelemetryStore.increment(:events_accepted, 1)
      TelemetryStore.increment(:dedup_verified, 1)
      {:ok, :dedup_verified}
    else
      err -> {:error, err}
    end
  end

  defp execute_phase(:bulk) do
    now_iso = DateTime.utc_now() |> DateTime.to_iso8601()
    batch_id = System.unique_integer([:positive])

    events =
      Enum.map(1..15, fn idx ->
        %{
          specversion: "1.0",
          id: "evt_ex_bulk_#{batch_id}_#{idx}_#{System.system_time(:millisecond)}",
          source: "elixir://warehouse-backfill",
          type: "api.request",
          subject: "cust_nova_studio",
          time: now_iso,
          data: %{
            route: "/v1/embeddings/backfill",
            region: "us-east-1",
            status: 200
          }
        }
      end)

    case Client.ingest_events(events, "bulk") do
      {:ok, %{status: 202, body: %{"accepted" => accepted, "routed_lane" => "bulk"}}} ->
        TelemetryStore.increment(:events_accepted, accepted)
        TelemetryStore.increment(:bulk_batches, 1)
        {:ok, accepted}

      err ->
        {:error, err}
    end
  end

  defp execute_phase(:dlq_repair) do
    uniq = "#{System.unique_integer([:positive])}_#{System.system_time(:millisecond)}"
    now_iso = DateTime.utc_now() |> DateTime.to_iso8601()
    bad_event_id = "evt_ex_dlq_#{uniq}"

    malformed = %{
      specversion: "1.0",
      id: bad_event_id,
      source: "elixir://chaos-dlq-injector",
      type: "ai.llm.tokens",
      subject: "cust_hyperion_labs",
      time: now_iso,
      data: %{
        tokens: "CORRUPTED_NON_NUMERIC_VALUE",
        model: "claude-4-sonnet",
        token_type: "output"
      }
    }

    # 1. Inject malformed event -> backend isolates it into DLQ (`dlq_count: 1`)
    case Client.ingest_events([malformed], "realtime") do
      {:ok, %{status: 202, body: %{"dlq_count" => dlq_count} = body}} when dlq_count >= 1 ->
        TelemetryStore.increment(:dlq_injected, dlq_count)
        dlq_ids = Map.get(body, "dlq_event_ids", [])
        repair_latest_dlq_entry(List.first(dlq_ids), bad_event_id, now_iso)

      err ->
        {:error, err}
    end
  end

  defp repair_latest_dlq_entry(direct_dlq_id, bad_event_id, now_iso) do
    resolved_id =
      if is_binary(direct_dlq_id) and direct_dlq_id != "" do
        direct_dlq_id
      else
        case Client.list_dlq() do
          {:ok, %{status: 200, body: entries}} when is_list(entries) ->
            found =
              Enum.find(entries, fn item ->
                Map.get(item, "status") == "pending" and
                  Map.get(item, "event_id") == bad_event_id
              end) || Enum.find(entries, fn item -> Map.get(item, "status") == "pending" end)

            if found, do: Map.get(found, "id"), else: nil

          _ ->
            nil
        end
      end

    if resolved_id do
      repaired_payload = %{
        specversion: "1.0",
        id: "#{bad_event_id}_repaired",
        source: "elixir://chaos-dlq-repaired",
        type: "ai.llm.tokens",
        subject: "cust_hyperion_labs",
        time: now_iso,
        data: %{
          tokens: 1_250,
          model: "claude-4-sonnet",
          token_type: "output"
        }
      }

      case Client.replay_dlq(resolved_id, repaired_payload) do
        {:ok, %{status: 200}} ->
          TelemetryStore.increment(:dlq_replayed, 1)
          TelemetryStore.increment(:events_accepted, 1)
          {:ok, resolved_id}

        err ->
          {:error, err}
      end
    else
      {:error, :dlq_entry_not_found}
    end
  end
end
