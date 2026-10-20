import { API_BASE } from "../../types/meterbox";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** GET a JSON resource, scoped to an OpenMeter namespace when provided. */
export async function apiGet<T = unknown>(path: string, namespace?: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: namespace ? { "X-OpenMeter-Namespace": namespace } : undefined,
    signal,
    cache: "no-store",
  });
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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(namespace ? { "X-OpenMeter-Namespace": namespace } : {}),
    ...(extraHeaders ?? {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
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

