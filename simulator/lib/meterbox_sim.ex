defmodule MeterboxSim do
  @moduledoc """
  MeterboxSim is an OTP-supervised continuous telemetry producer, pre-flight
  entitlement gatekeeper, resilience/chaos injector, and ClickHouse/billing
  auditor for the Meterbox Managed OpenMeter platform.
  """

  def config(key, default \\ nil) do
    Application.get_env(:meterbox_sim, key, default)
  end
end
