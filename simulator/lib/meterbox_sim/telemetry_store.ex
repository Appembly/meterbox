defmodule MeterboxSim.TelemetryStore do
  @moduledoc """
  ETS-backed local counter and state store for tracking simulator throughput,
  cache hit ratios, deduplication verifications, and DLQ auto-replays.
  """
  use GenServer

  @table :meterbox_sim_stats

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def increment(metric, delta \\ 1) when is_atom(metric) and is_integer(delta) do
    :ets.update_counter(@table, metric, {2, delta}, {metric, 0})
  end

  def put_snapshot(key, value) do
    :ets.insert(@table, {key, value})
  end

  def get_snapshot(key, default \\ nil) do
    case :ets.lookup(@table, key) do
      [{^key, val}] -> val
      [] -> default
    end
  end

  def summary do
    %{
      events_accepted: get_snapshot(:events_accepted, 0),
      realtime_batches: get_snapshot(:realtime_batches, 0),
      bulk_batches: get_snapshot(:bulk_batches, 0),
      dedup_verified: get_snapshot(:dedup_verified, 0),
      dlq_injected: get_snapshot(:dlq_injected, 0),
      dlq_replayed: get_snapshot(:dlq_replayed, 0),
      quota_checks: get_snapshot(:quota_checks, 0),
      cache_hits: get_snapshot(:cache_hits, 0),
      cache_misses: get_snapshot(:cache_misses, 0),
      auto_grants_issued: get_snapshot(:auto_grants_issued, 0),
      invoices_generated: get_snapshot(:invoices_generated, 0)
    }
  end

  @impl true
  def init(state) do
    :ets.new(@table, [:named_table, :public, :set, read_concurrency: true, write_concurrency: true])
    {:ok, state}
  end
end
