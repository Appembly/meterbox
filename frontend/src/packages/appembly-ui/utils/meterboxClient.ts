export interface MeterboxClientOptions {
  /** Base URL of the Meterbox API or app-local metering proxy (e.g. "http://localhost:8888" or "http://localhost:6010") */
  baseUrl?: string;
  /** OpenMeter namespace (e.g. "ns_live_appembly") */
  namespace?: string;
  /** Product app identifier for app-scoped filtering (e.g. "valiscale", "cyclode", "adappty") */
  app?: string;
  /** Default subject key for this app/workspace (e.g. "ws_valiscale_studio") */
  defaultSubject?: string;
  /** Optional API key or Bearer token */
  apiKey?: string;
}

export interface MeterboxCloudEventInput {
  type: string;
  subject?: string;
  source?: string;
  data?: Record<string, unknown>;
}

/**
 * Shared app-scoped client for Meterbox OpenMeter v1 & Control Plane APIs.
 * Automatically injects `?app=<app_id>`, `X-Appembly-App: <app_id>`, and `X-OpenMeter-Namespace: <ns>`
 * so each Appembly product console sees only its own subjects, events, rollups, DLQ, and invoices,
 * while using the exact same OpenMeter-compatible APIs.
 */
export function createMeterboxClient(options: MeterboxClientOptions = {}) {
  const baseUrl = (options.baseUrl || 'http://localhost:8888').replace(/\/+$/, '');
  const namespace = options.namespace || 'ns_live_appembly';
  const app = (options.app || '').trim().toLowerCase();
  const defaultSubject = options.defaultSubject || (app ? `ws_${app}_default` : 'ws_appembly_default');

  const buildHeaders = (extra?: Record<string, string>): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-OpenMeter-Namespace': namespace,
      ...(extra || {}),
    };
    if (app) {
      headers['X-Appembly-App'] = app;
    }
    if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    }
    return headers;
  };

  const withAppParam = (path: string, params?: Record<string, string | number | undefined>): string => {
    const url = new URL(`${baseUrl}${path}`);
    if (app) {
      url.searchParams.set('app', app);
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') {
          url.searchParams.set(k, String(v));
        }
      }
    }
    return url.toString();
  };

  return {
    app,
    namespace,
    defaultSubject,

    async getSnapshot(limit = 35) {
      const res = await fetch(withAppParam('/api/control/v1/snapshot', { limit }), {
        headers: buildHeaders(),
      });
      if (!res.ok) throw new Error(`Meterbox snapshot failed (${res.status})`);
      return res.json();
    },

    async queryMeter(slug: string, opts?: { subject?: string; window?: string }) {
      const res = await fetch(
        withAppParam(`/api/v1/meters/${encodeURIComponent(slug)}/query`, {
          subject: opts?.subject,
          window: opts?.window,
        }),
        { headers: buildHeaders() }
      );
      if (!res.ok) throw new Error(`Meterbox queryMeter(${slug}) failed (${res.status})`);
      return res.json();
    },

    async evaluateEntitlement(subject: string, featureKey = 'ai_tokens') {
      const targetSubject = subject || defaultSubject;
      const res = await fetch(
        withAppParam(
          `/api/v1/subjects/${encodeURIComponent(targetSubject)}/entitlements/${encodeURIComponent(featureKey)}/value`
        ),
        { headers: buildHeaders() }
      );
      if (!res.ok) throw new Error(`Meterbox evaluateEntitlement failed (${res.status})`);
      return res.json();
    },

    async ingestEvent(event: MeterboxCloudEventInput) {
      const payload = {
        specversion: '1.0',
        id: `evt_${app || 'app'}_${Date.now()}`,
        source: event.source || `urn:appembly:${app || 'core'}:runtime`,
        type: event.type,
        subject: event.subject || defaultSubject,
        time: new Date().toISOString(),
        data: {
          ...(event.data || {}),
          ...(app ? { app } : {}),
        },
      };
      const res = await fetch(withAppParam('/api/v1/events'), {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Meterbox ingestEvent failed (${res.status})`);
      return res.json();
    },

    async generateInvoice(subject?: string, planSlug = 'plan_valiscale_pro', syncToStripe = true) {
      const res = await fetch(withAppParam('/api/v1/invoices/generate'), {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          subject_key: subject || defaultSubject,
          plan_slug: planSlug,
          sync_to_stripe: syncToStripe,
        }),
      });
      if (!res.ok) throw new Error(`Meterbox generateInvoice failed (${res.status})`);
      return res.json();
    },
  };
}
