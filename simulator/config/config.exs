import Config

config :meterbox_sim,
  base_url: System.get_env("METERBOX_URL", "http://localhost:8888"),
  namespace: System.get_env("METERBOX_NAMESPACE", "ns_live_demo"),
  ingest_key:
    System.get_env("METERBOX_INGEST_KEY", "mb_ing_live_demo_default_collector_key_01"),
  entitlement_key:
    System.get_env("METERBOX_ENTITLEMENT_KEY", "mb_ent_live_demo_default_quota_key_01"),
  admin_key:
    System.get_env("METERBOX_ADMIN_KEY", "mb_sk_live_demo_default_admin_key_01"),
  customer_tick_ms: String.to_integer(System.get_env("METERBOX_TICK_MS", "2000")),
  chaos_tick_ms: String.to_integer(System.get_env("METERBOX_CHAOS_MS", "8000")),
  audit_tick_ms: String.to_integer(System.get_env("METERBOX_AUDIT_MS", "5000")),
  auto_start_workers: Mix.env() != :test

config :logger, :console,
  format: "$time [$level] $message\n",
  metadata: [:subject, :lane]
