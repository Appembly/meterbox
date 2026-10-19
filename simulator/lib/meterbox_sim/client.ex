defmodule MeterboxSim.Client do
  @moduledoc """
  Scoped HTTP client for the Meterbox Control Plane & OpenMeter Edge Gateway.
  Exercises all four API key tiers enforced by `backend/internal/auth/apikey.go`:
    1. `mb_ing_live_*` (`ingest`)      -> `POST /api/v1/events`
    2. `mb_ent_live_*` (`entitlement`) -> `GET /api/v1/subjects/{sub}/entitlements/{feat}/value`, `POST /api/v1/portal/tokens`
    3. `mb_sk_live_*`  (`admin`)       -> Meters, Subjects, Entitlements, Grants, DLQ Replay, Plans, Invoices, Telemetry
    4. `mb_portal_*`   (`portal`)      -> `GET /api/portal/v1/summary`
  """

  alias MeterboxSim.JSON

  # ---------------------------------------------------------------------------
  # 1. Ingest Tier (`mb_ing_live_*`)
  # ---------------------------------------------------------------------------
  def ingest_events(payload, lane \\ "realtime") do
    headers = [
      {"Authorization", "Bearer #{MeterboxSim.config(:ingest_key)}"},
      {"X-OpenMeter-Namespace", MeterboxSim.config(:namespace)},
      {"X-Meterbox-Lane", lane}
    ]

    request(:post, "/api/v1/events", payload, headers)
  end

  # ---------------------------------------------------------------------------
  # 2. Entitlement Tier (`mb_ent_live_*`)
  # ---------------------------------------------------------------------------
  def evaluate_entitlement(subject_key, feature_key) do
    headers = [
      {"Authorization", "Bearer #{MeterboxSim.config(:entitlement_key)}"},
      {"X-OpenMeter-Namespace", MeterboxSim.config(:namespace)}
    ]

    path =
      "/api/v1/subjects/#{URI.encode(subject_key)}/entitlements/#{URI.encode(feature_key)}/value"

    request(:get, path, nil, headers)
  end

  def mint_portal_token(subject_key) do
    headers = [
      {"Authorization", "Bearer #{MeterboxSim.config(:entitlement_key)}"},
      {"X-OpenMeter-Namespace", MeterboxSim.config(:namespace)}
    ]

    request(:post, "/api/v1/portal/tokens", %{subject_key: subject_key}, headers)
  end

  # ---------------------------------------------------------------------------
  # 3. Customer Portal Tier (`mb_portal_*`)
  # ---------------------------------------------------------------------------
  def fetch_portal_summary(portal_raw_key, subject_key) do
    headers = [
      {"Authorization", "Bearer #{portal_raw_key}"},
      {"X-OpenMeter-Namespace", MeterboxSim.config(:namespace)}
    ]

    request(:get, "/api/portal/v1/summary?subject=#{URI.encode(subject_key)}", nil, headers)
  end

  # ---------------------------------------------------------------------------
  # 4. Control Plane & Admin Tier (`mb_sk_live_*`)
  # ---------------------------------------------------------------------------
  def upsert_subject(key, display_name, email, stripe_id \\ "") do
    request(
      :post,
      "/api/v1/subjects",
      %{
        key: key,
        display_name: display_name,
        email: email,
        stripe_customer_id: stripe_id,
        metadata: %{"provisioned_by" => "elixir_otp_simulator"}
      },
      admin_headers()
    )
  end

  def list_entitlements(subject_key \\ nil) do
    query = if subject_key, do: "?subject=#{URI.encode(subject_key)}", else: ""
    request(:get, "/api/v1/entitlements#{query}", nil, admin_headers())
  end

  def create_entitlement(attrs) do
    request(:post, "/api/v1/entitlements", attrs, admin_headers())
  end

  def issue_credit_grant(entitlement_id, name, amount, priority \\ 1) do
    request(
      :post,
      "/api/v1/entitlements/#{URI.encode(entitlement_id)}/grants",
      %{name: name, amount: amount, priority: priority, rollover_enabled: true},
      admin_headers()
    )
  end

  def query_meter(meter_slug, subject_key \\ nil) do
    query = if subject_key, do: "?subject=#{URI.encode(subject_key)}", else: ""
    request(:get, "/api/v1/meters/#{URI.encode(meter_slug)}/query#{query}", nil, admin_headers())
  end

  def get_telemetry do
    request(:get, "/api/control/v1/telemetry", nil, admin_headers())
  end

  def get_dogfood_usage do
    request(:get, "/api/control/v1/dogfood", nil, admin_headers())
  end

  def list_dlq do
    request(:get, "/api/control/v1/dlq", nil, admin_headers())
  end

  def replay_dlq(dlq_id, repaired_payload) do
    request(
      :post,
      "/api/control/v1/dlq/#{URI.encode(dlq_id)}/replay",
      %{payload: repaired_payload},
      admin_headers()
    )
  end

  def generate_invoice(subject_key, plan_slug \\ "ai_scale_hybrid") do
    request(
      :post,
      "/api/v1/invoices/generate",
      %{subject_key: subject_key, plan_slug: plan_slug, sync_to_stripe: true},
      admin_headers()
    )
  end

  defp admin_headers do
    [
      {"Authorization", "Bearer #{MeterboxSim.config(:admin_key)}"},
      {"X-OpenMeter-Namespace", MeterboxSim.config(:namespace)}
    ]
  end

  # ---------------------------------------------------------------------------
  # Low-Level `:httpc` Request Wrapper
  # ---------------------------------------------------------------------------
  def request(method, path, body \\ nil, headers \\ []) do
    url = String.to_charlist(MeterboxSim.config(:base_url) <> path)

    erl_headers =
      Enum.map(headers, fn {k, v} ->
        {String.to_charlist(k), String.to_charlist(v)}
      end)

    http_opts = [timeout: 5_000, connect_timeout: 3_000]

    result =
      case method do
        :get ->
          :httpc.request(:get, {url, erl_headers}, http_opts, body_format: :binary)

        :post ->
          encoded = if is_binary(body), do: body, else: JSON.encode!(body || %{})
          content_type = ~c"application/json"

          :httpc.request(
            :post,
            {url, erl_headers, content_type, encoded},
            http_opts,
            body_format: :binary
          )
      end

    case result do
      {:ok, {{_http_ver, status, _reason}, resp_headers, resp_body}} ->
        parsed_headers =
          Map.new(resp_headers, fn {k, v} ->
            {k |> List.to_string() |> String.downcase(), List.to_string(v)}
          end)

        decoded_body =
          case JSON.decode(resp_body) do
            {:ok, data} -> data
            {:error, _} -> resp_body
          end

        {:ok, %{status: status, headers: parsed_headers, body: decoded_body}}

      {:error, reason} ->
        {:error, reason}
    end
  end
end
