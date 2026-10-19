defmodule MeterboxSim.CustomerWorker do
  @moduledoc """
  Per-customer `GenServer` that continuously executes the production AI/SaaS
  usage loop:
    1. Evaluates pre-flight entitlement access via `MeterboxSim.EntitlementGuard`.
    2. Emits CloudEvents v1.0 (`ai.llm.tokens`, `api.request`, `infra.gpu.seconds`)
       authenticated with the write-only `mb_ing_live_*` key.
  """
  use GenServer
  require Logger

  alias MeterboxSim.{Client, EntitlementGuard, TelemetryStore}

  @models ["claude-4-sonnet", "gpt-5-turbo", "deepseek-r1"]
  @routes ["/v1/chat/completions", "/v1/embeddings", "/v1/agents/execute"]
  @regions ["us-east-1", "eu-west-1", "ap-northeast-1"]
  @gpu_classes ["nvidia-h100-80gb", "nvidia-b200-192gb"]

  def start_link(profile) do
    GenServer.start_link(__MODULE__, profile)
  end

  @impl true
  def init(profile) do
    base_tick = MeterboxSim.config(:customer_tick_ms, 2_000)
    jitter = :rand.uniform(700)
    Process.send_after(self(), :emit_tick, 400 + jitter)
    {:ok, Map.put(profile, :tick_ms, base_tick + jitter)}
  end

  @impl true
  def handle_info(:emit_tick, state) do
    subject = state.subject_key

    # 1. Pre-flight sub-5ms Edge Quota Check
    _ = EntitlementGuard.check_access(subject, "ai_token_allowance")

    # 2. Construct realistic CloudEvents v1.0 batch across registered meters
    now_iso = DateTime.utc_now() |> DateTime.to_iso8601()
    uniq = "#{System.unique_integer([:positive])}_#{System.system_time(:millisecond)}"
    model = Enum.random(@models)
    tokens = Enum.random(350..2_800)

    events = [
      %{
        specversion: "1.0",
        id: "evt_ex_llm_#{subject}_#{uniq}",
        source: "elixir://meterbox-sim/#{subject}",
        type: "ai.llm.tokens",
        subject: subject,
        time: now_iso,
        data: %{
          tokens: tokens,
          model: model,
          token_type: Enum.random(["input", "output"])
        }
      },
      %{
        specversion: "1.0",
        id: "evt_ex_api_#{subject}_#{uniq}",
        source: "elixir://meterbox-sim/#{subject}",
        type: "api.request",
        subject: subject,
        time: now_iso,
        data: %{
          route: Enum.random(@routes),
          region: Enum.random(@regions),
          status: 200
        }
      }
    ]

    # Include GPU compute telemetry for enterprise/robotics workloads
    events =
      if state[:include_gpu] do
        gpu_event = %{
          specversion: "1.0",
          id: "evt_ex_gpu_#{subject}_#{uniq}",
          source: "elixir://k8s-gpu-pool/#{subject}",
          type: "infra.gpu.seconds",
          subject: subject,
          time: now_iso,
          data: %{
            duration_sec: Enum.random(8..45),
            gpu_class: Enum.random(@gpu_classes)
          }
        }

        events ++ [gpu_event]
      else
        events
      end

    case Client.ingest_events(events, "realtime") do
      {:ok, %{status: 202, body: %{"accepted" => accepted}}} ->
        TelemetryStore.increment(:events_accepted, accepted)
        TelemetryStore.increment(:realtime_batches, 1)

      {:error, reason} ->
        Logger.debug("[CustomerWorker:#{subject}] Gateway unreachable: #{inspect(reason)}")

      _ ->
        :ok
    end

    Process.send_after(self(), :emit_tick, state.tick_ms)
    {:noreply, state}
  end
end
