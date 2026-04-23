import { vi } from "vitest";

type FetchHandler = (init: RequestInit | undefined) => Response | Promise<Response>;

export function buildFetchMock(handlers: Record<string, FetchHandler>) {
  return vi.fn(async (input: unknown, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    const method = init?.method ?? "GET";
    const key = `${method} ${url}`;
    const handler = handlers[key];
    if (!handler) {
      throw new Error(`Unmocked request: ${key}`);
    }
    return handler(init);
  });
}

export function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
