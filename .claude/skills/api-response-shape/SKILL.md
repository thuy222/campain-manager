---
name: api-response-shape
description: Use when writing or reviewing any HTTP handler, error middleware, or Zod validation in the Express backend. Enforces the project's success/error envelope, HTTP status mapping, error code vocabulary, AppError + asyncHandler usage, and never-leak rules.
---

# API Response Shape — Campaign Manager

Every response from `packages/backend` is either a success envelope or an error envelope. No exceptions — not even for health checks.

## 1. Success envelope

```ts
type Success<T> = { data: T; meta?: Record<string, unknown> };
```

```json
{ "data": { "id": "…", "name": "Welcome campaign", "status": "draft" } }
```

With pagination / counts / cursors:

```json
{
  "data": [{ "id": "…" }, { "id": "…" }],
  "meta": { "page": 1, "per_page": 20, "total": 47 }
}
```

Rules:

- **Single envelope key: `data`.** Don't mix top-level `{ campaigns: [...] }` or `{ id, name }` — always nest under `data`.
- `meta` is optional and only for pagination, totals, or cursors. Don't use it as a dumping ground.
- Arrays go straight into `data` (`data: [...]`) — don't wrap in a named key.

## 2. Error envelope

```ts
type ErrorEnvelope = {
  error: {
    code: string; // SCREAMING_SNAKE_CASE, from the vocabulary below
    message: string; // human, safe to show users
    details?: unknown; // optional — Zod field errors, etc. Never a stack.
  };
};
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": {
      "fieldErrors": { "scheduled_at": ["Must be in the future"] }
    }
  }
}
```

## 3. HTTP status mapping

| Status  | When to use                                                                                          | Typical error `code` |
| ------- | ---------------------------------------------------------------------------------------------------- | -------------------- |
| **200** | Successful GET / PATCH / POST that returns the resource                                              | —                    |
| **201** | Resource created (`POST /campaigns`, `POST /auth/register`)                                          | —                    |
| **202** | Async send accepted (`POST /campaigns/:id/send`)                                                     | —                    |
| **204** | Delete success — **no body**, so no envelope                                                         | —                    |
| **400** | Malformed request (bad JSON, wrong Content-Type, missing body entirely)                              | `BAD_REQUEST`        |
| **401** | No auth cookie, expired/invalid JWT                                                                  | `AUTH_REQUIRED`      |
| **403** | Authenticated but the action is forbidden (rare in this app — prefer 404 to avoid leaking existence) | `FORBIDDEN`          |
| **404** | Not found. **Also used when the resource exists but belongs to another user.**                       | `NOT_FOUND`          |
| **409** | State machine conflict — e.g. editing a non-draft campaign, sending a sent campaign                  | `STATE_CONFLICT`     |
| **422** | Zod validation failed on body/params/query                                                           | `VALIDATION_ERROR`   |
| **500** | Unexpected / unhandled                                                                               | `INTERNAL_ERROR`     |

Decision rules:

- "Does this resource exist for _this_ user?" No → 404, always. Never reveal ownership with 403.
- "Request well-formed, business rule broken?" → 409 (`STATE_CONFLICT`).
- "Request malformed according to Zod?" → 422 (`VALIDATION_ERROR`).
- "Request malformed in a way Zod can't even parse (bad JSON, missing body)?" → 400 (`BAD_REQUEST`).

## 4. Error code vocabulary

Single source of truth — add to this list, don't invent ad-hoc codes inline.

```ts
// src/http/error-codes.ts
export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  STATE_CONFLICT: "STATE_CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
```

## 5. `AppError` — the one throwable

```ts
// src/http/app-error.ts
import type { ErrorCode } from "./error-codes";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}
```

Usage — services throw it, the error middleware translates it:

```ts
if (affected === 0) {
  throw new AppError("STATE_CONFLICT", "Campaign is not editable", 409);
}
```

Never throw raw `Error` for known flows. Never `res.status(...).json(...)` in a service — only the controller (or, preferably, the error middleware) talks HTTP.

## 6. `asyncHandler` — the only wrapper around route handlers

```ts
// src/http/async-handler.ts
import type { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler =
  <P, ResBody, ReqBody, ReqQuery>(
    fn: (
      req: Request<P, ResBody, ReqBody, ReqQuery>,
      res: Response<ResBody>,
      next: NextFunction,
    ) => Promise<unknown>,
  ): RequestHandler<P, ResBody, ReqBody, ReqQuery> =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
```

```ts
router.post(
  "/campaigns",
  asyncHandler(async (req, res) => {
    const dto = CreateCampaignDto.parse(req.body);
    const campaign = await campaignService.create(req.user.id, dto);
    res.status(201).json({ data: campaign });
  }),
);
```

## 7. Error middleware — centralize response shaping

```ts
// src/http/error-middleware.ts
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "./app-error";

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: { fieldErrors: err.flatten().fieldErrors },
      },
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  // Unknown — log server-side, respond generically.
  req_logger_or_console_error(err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
};
```

Mount it **last**, after all routes.

## 8. Never-leak rules

Absolutely never put into a response:

- ❌ **Stack traces.** Even in dev — use server logs for that.
- ❌ **Passwords / password hashes.** Even in error messages. Especially in error messages.
- ❌ **JWT contents, session IDs, cookie values.** They're in the cookie for a reason.
- ❌ **SQL text, Sequelize error types, DB column names.** Translate to domain language.
- ❌ **Internal env var values**, file paths, hostnames.
- ❌ **Whether a user exists** for login failures. Always `AUTH_REQUIRED` with a generic "Invalid credentials" — never "User not found" vs "Wrong password".
- ❌ **Whether a campaign exists** for another user. 404, always.

When logging server-side, mask tokens and never log request bodies that might contain passwords.

## 9. Quick mental model

> **Controller = envelope.** It owns `res.status(...).json({ data | error })`. Services throw, controllers (or the error middleware) convert.

If you're tempted to return `{ ok: true }` or `{ message: "deleted" }` — stop. It's `204` with no body, or `{ data: ... }`.
