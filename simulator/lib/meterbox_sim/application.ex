defmodule MeterboxSim.Application do
  @moduledoc """
  OTP Application supervisor for `MeterboxSim`.
  Boots the `:inets`/`:ssl` HTTP runtime, the ETS `TelemetryStore`, the
  `EntitlementGuard`, the `CustomerSupervisor` with three simulated tenant
  customer profiles, the `ChaosWorker`, and the `UsageAuditor`.
  """
  use Application
  require Logger

  alias MeterboxSim.{Client, CustomerSupervisor}

  @customer_profiles [
    %{
      subject_key: "cust_hyperion_labs",
      display_name: "Hyperion AI Labs",
      email: "billing@hyperion.ai",
      stripe_id: "cus_stripe_hyperion_9921",
      include_gpu: true
    },
    %{
      subject_key: "cust_nova_studio",
      display_name: "Nova Generative Studio",
      email: "finance@novastudio.io",
      stripe_id: "cus_stripe_nova_4410",
      include_gpu: false
    },
    %{
      subject_key: "cust_aether_robotics",
      display_name: "Aether Autonomous Robotics",
      email: "ops@aether-robotics.dev",
      stripe_id: "cus_stripe_aether_7742",
      include_gpu: true
    }
  ]

  @impl true
  def start(_type, _args) do
    _ = Application.ensure_all_started(:inets)
    _ = Application.ensure_all_started(:ssl)

    children = [
      MeterboxSim.TelemetryStore,
      MeterboxSim.EntitlementGuard,
      MeterboxSim.CustomerSupervisor,
      MeterboxSim.ChaosWorker,
      MeterboxSim.UsageAuditor
    ]

    opts = [strategy: :one_for_one, name: MeterboxSim.Supervisor]
    {:ok, sup} = Supervisor.start_link(children, opts)

    if MeterboxSim.config(:auto_start_workers, true) do
      bootstrap_customers()
    end

    {:ok, sup}
  end

  def bootstrap_customers do
    Logger.info(
      "[MeterboxSim] Bootstrapping #{length(@customer_profiles)} customer workload workers against #{MeterboxSim.config(:base_url)} (#{MeterboxSim.config(:namespace)})"
    )

    Enum.each(@customer_profiles, fn profile ->
      # Upsert subject & ensure entitlement exists for newly provisioned customers
      _ =
        Client.upsert_subject(
          profile.subject_key,
          profile.display_name,
          profile.email,
          profile.stripe_id
        )

      {:ok, _pid} = CustomerSupervisor.start_customer_worker(profile)
    end)
  end
end
