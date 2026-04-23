export type ApiErrorShape = {
  code: string;
  message: string;
  details?: Record<string, string>;
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, string>;

  constructor(status: number, body: ApiErrorShape) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

type ApiInit = Omit<RequestInit, "body"> & { body?: unknown };

async function request(path: string, init: ApiInit) {
  const { body, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return { res, json: undefined };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }

  if (!res.ok) {
    const errorBody =
      (json as { error?: ApiErrorShape } | undefined)?.error ?? {
        code: "UNKNOWN",
        message: `HTTP ${res.status}`,
      };
    throw new ApiError(res.status, errorBody);
  }

  return { res, json };
}

/**
 * Unwraps the standard `{ data }` envelope.
 */
export async function api<T = unknown>(
  path: string,
  init: ApiInit = {},
): Promise<T> {
  const { json, res } = await request(path, init);
  if (res.status === 204) return undefined as T;
  return (json as { data: T }).data;
}

/**
 * Returns the full response body, so callers can read `{ data, meta }` for
 * paginated endpoints.
 */
export async function apiWithMeta<T, M = Record<string, unknown>>(
  path: string,
  init: ApiInit = {},
): Promise<{ data: T; meta: M }> {
  const { json } = await request(path, init);
  return json as { data: T; meta: M };
}
