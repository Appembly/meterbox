import { API_BASE } from "../../types/meterbox";

export { API_BASE };

const SAUTHEN_API_BASE =
  process.env.NEXT_PUBLIC_SAUTHEN_URL ||
  (typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
    ? "https://auth.appembly.com"
    : "http://localhost:6021");
const SESSION_STORAGE_KEY = "sth.auth.session.v2";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function isTokenExpiredOrInvalid(rawToken?: string): boolean {
  if (!rawToken || typeof rawToken !== "string") return true;
  const clean = rawToken.trim().replace(/^st_(sess|agt)_/, "");
  const parts = clean.split(".");
  if (parts.length !== 3) return true;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof payload.exp === "number" && payload.exp > 0) {
      return Math.floor(Date.now() / 1000) >= payload.exp - 5;
    }
    return false;
  } catch {
    return true;
  }
}

let ssoHydrationPromise: Promise<string | null> | null = null;

function notifyUnauthorized(): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent("sauthen-auth-change", { detail: null }));
    }
  } catch {
    /* ignore */
  }
}

async function hydrateSsoToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!ssoHydrationPromise) {
    ssoHydrationPromise = fetch(`${SAUTHEN_API_BASE}/api/v1/auth/sso?app_client=meterbox`, {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) return null;
        const d = await r.json();
        if (d?.access_token && !isTokenExpiredOrInvalid(d.access_token)) {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(d));
          return d.access_token as string;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        ssoHydrationPromise = null;
      });
  }
  return ssoHydrationPromise;
}

async function getStoredBearerHeader(forceRefresh = false): Promise<Record<string, string>> {
  try {
    if (typeof window === "undefined") return {};
    if (forceRefresh) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { access_token?: string };
        if (parsed?.access_token && !isTokenExpiredOrInvalid(parsed.access_token)) {
          return { Authorization: `Bearer ${parsed.access_token}` };
        }
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
    const ssoToken = await hydrateSsoToken();
    return ssoToken ? { Authorization: `Bearer ${ssoToken}` } : {};
  } catch {
    return {};
  }
}

/** GET a JSON resource, scoped to an OpenMeter namespace when provided. */
export async function apiGet<T = unknown>(path: string, namespace?: string, signal?: AbortSignal): Promise<T> {
  const bearer = await getStoredBearerHeader(false);
  const headers: Record<string, string> = {
    ...bearer,
    ...(namespace ? { "X-OpenMeter-Namespace": namespace } : {}),
  };
  let res = await fetch(`${API_BASE}${path}`, {
    headers,
    signal,
    cache: "no-store",
  });
  if (res.status === 401 && bearer.Authorization) {
    const retryBearer = await getStoredBearerHeader(true);
    if (retryBearer.Authorization) {
      const retryHeaders: Record<string, string> = {
        ...retryBearer,
        ...(namespace ? { "X-OpenMeter-Namespace": namespace } : {}),
      };
      res = await fetch(`${API_BASE}${path}`, {
        headers: retryHeaders,
        signal,
        cache: "no-store",
      });
    }
  }
  if (res.status === 401) {
    notifyUnauthorized();
  }
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/** POST a JSON resource, scoped to an OpenMeter namespace when provided. */
export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  namespace?: string,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const bearer = await getStoredBearerHeader(false);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...bearer,
    ...(namespace ? { "X-OpenMeter-Namespace": namespace } : {}),
    ...(extraHeaders ?? {}),
  };
  let res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && bearer.Authorization) {
    const retryBearer = await getStoredBearerHeader(true);
    if (retryBearer.Authorization) {
      const retryHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...retryBearer,
        ...(namespace ? { "X-OpenMeter-Namespace": namespace } : {}),
        ...(extraHeaders ?? {}),
      };
      res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: retryHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    }
  }
  if (res.status === 401) {
    notifyUnauthorized();
  }
  const text = await res.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: text };
  }
  if (!res.ok) {
    const errMsg =
      typeof parsed === "object" && parsed && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `${res.status} ${res.statusText}`;
    throw new ApiError(res.status, errMsg);
  }
  return parsed as T;
}

