defmodule MeterboxSimTest do
  use ExUnit.Case, async: false

  alias MeterboxSim.{ChaosWorker, Client, EntitlementGuard, JSON, TelemetryStore, UsageAuditor}

  test "JSON encoder and decoder round-trip nested maps, lists, numbers, and booleans" do
    payload = %{
      "specversion" => "1.0",
      "id" => "evt_test_101",
      "subject" => "cust_hyperion_labs",
      "data" => %{
        "tokens" => 1450,
        "cached" => true,
        "tags" => ["realtime", "claude-4-sonnet"]
      }
    }

    encoded = JSON.encode!(payload)
    assert is_binary(encoded)
    assert {:ok, decoded} = JSON.decode(encoded)
    assert decoded["id"] == "evt_test_101"
    assert decoded["data"]["tokens"] == 1450
    assert decoded["data"]["cached"] == true
    assert decoded["data"]["tags"] == ["realtime", "claude-4-sonnet"]
  end

  test "TelemetryStore increments atomic counters and stores snapshots" do
    before_val = TelemetryStore.get_snapshot(:events_accepted, 0)
    TelemetryStore.increment(:events_accepted, 5)
    after_val = TelemetryStore.get_snapshot(:events_accepted, 0)
    assert after_val == before_val + 5

    TelemetryStore.put_snapshot(:custom_probe, %{ok: true})
    assert TelemetryStore.get_snapshot(:custom_probe) == %{ok: true}
  end

  test "End-to-end live gateway integration if Meterbox backend (:8888) is reachable" do
    case Client.get_telemetry() do
      {:ok, %{status: 200}} ->
        # 1. Pre-flight entitlement check
        assert {:ok, eval} = EntitlementGuard.check_access("cust_hyperion_labs", "ai_token_allowance")
        assert Map.has_key?(eval, "balance")

        # 2. Chaos scenarios: Redis SETNX dedup, bulk lane, and DLQ auto-replay
        assert {:ok, :dedup_verified} = ChaosWorker.run_scenario(:dedup)
        assert {:ok, 15} = ChaosWorker.run_scenario(:bulk)
        assert {:ok, _dlq_id} = ChaosWorker.run_scenario(:dlq_repair)

        # 3. Auditor cycle (ClickHouse meter query + Portal token + Hybrid invoice on cycle 3)
        snap = UsageAuditor.run_audit_once(3)
        assert snap.llm_total > 0
        assert snap.portal.status == "OK"

      _ ->
        # Backend is offline in isolated test environment; skip live HTTP assertions
        :ok
    end
  end
end
