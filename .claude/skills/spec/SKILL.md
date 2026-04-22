---
name: spec
description: Generate or review a feature spec under __spec/<name>.md before any implementation work. Invoke as /spec <feature-name>. Produces a plain-language description of what the feature does for the user plus a numbered acceptance-criteria checklist — no endpoints, status codes, SQL, or code. Then stops and asks to proceed.
argument-hint: <feature-name>
---

# /spec — feature spec generator

**This skill is a gate.** Running `/spec <name>` produces a spec file. It does **not** write implementation code. Implementation starts only after the user says "proceed".

## Specs describe behavior, not implementation

A good spec answers "what should this feature do for the user?" — in prose. It does **not** contain:

- ❌ Endpoint tables, URL paths, or HTTP methods.
- ❌ HTTP status codes or error codes.
- ❌ Code blocks (no TypeScript, Zod, SQL, JSON).
- ❌ Column lists, index definitions, migration filenames.
- ❌ Flow steps that reference middleware, controllers, services, repositories, or other implementation layers.
- ❌ Library names (React Query, Sequelize, bcrypt, etc.) in the acceptance criteria.

The technical translation lives elsewhere:

- **`CLAUDE.md`** — status-code vocabulary, response envelope, state machine, conventions.
- **`api-response-shape` skill** — full HTTP matrix, error codes, envelopes.
- **`sequelize-patterns` skill** — model/repository/migration/aggregation rules.
- **The code itself** — the only place where endpoint paths live.

A spec that names an endpoint or a status code is doing someone else's job. Strip it.

## Workflow

When invoked with `/spec <feature-name>`:

1. **Check `__spec/<feature-name>.md`.**
   - If it exists: read it, summarize what's there, ask the user if they want to **(a)** extend it, **(b)** regenerate it, or **(c)** proceed to implement using the existing spec. Stop and wait.
   - If it doesn't exist: continue.
2. **Read `CLAUDE.md`** for domain rules — so the spec's behavior is consistent with rules like "campaigns editable only in draft", "ownership hides behind not-found", "send is one-way". Do not re-state those rules in the spec; **apply** them.
3. **Ask AT MOST ONE clarifying question** and only if something is genuinely ambiguous about the user-visible behavior or the data it operates on. Examples of legitimate ambiguity:
   - "Should recipients be pre-created contacts or free-form emails entered at campaign-create time?"
   - "Is 'scheduled' visually different from 'draft with a future time', or the same thing under the hood?"

   Do **not** ask how to implement, what library to use, or what status code to return. Those aren't spec-level questions.

4. **Generate `__spec/<feature-name>.md`** using the template below.
5. **Show the generated spec** and ask verbatim:

   > **Proceed to implement? (yes / no / edits)**

   Do **not** write any code, migration, or test until the user answers "yes" (or gives edits which you apply, re-show, and re-ask).

## Suggested order of specs

Each depends on what came before:

1. `auth` — account sign-up, sign-in, sign-out, staying signed in.
2. `campaign` — full campaign lifecycle: create / list / view / edit / delete drafts, schedule for a future moment, send as a background job, and read aggregate stats. One file covers the whole lifecycle.
3. `recipients` — per-campaign delivery detail (who got what, when opened), replacing a draft's recipient list, and a demo-only simulated open.

If the user asks for a later spec before earlier ones exist, warn them and ask whether to proceed anyway.

## Template

```markdown
# <Feature name>

**Status:** draft-spec · **Owner:** <initials> · **Date:** <YYYY-MM-DD>
**Depends on:** <other specs by name, or "none">

## What

<One or two short paragraphs. Plain user-language. What can the user do that they couldn't before? Why does this feature exist? Who benefits? No mechanics.>

## Who

<Who performs this. Usually "a signed-in user", "a campaign owner", etc. One or two sentences.>

## Behavior

<Prose description of how the system behaves, from the user's point of view and from the system's point of view, under both the happy path and the common failure paths. Paragraphs, not bullets. No endpoints, no status codes, no code, no SQL. Cover the story — what the user does, what the system does in response, what the user ends up seeing, what changes persist.>

## Acceptance criteria

<Numbered list of verifiable, testable statements about observable behavior. Each item is either "The system <does X>" or "Attempting <Y> is rejected with a clear message." Avoid "the API returns 404" — say "the user sees the same response as if the item did not exist" or "the attempt fails as not-found."

Good example: "A user cannot see or modify a campaign created by another user; attempts to do so appear identical to attempting to access a campaign that does not exist."

Bad example: "GET /campaigns/:id returns 404 when created_by != req.user.id."

Aim for 5–12 criteria. If you need more, the feature is probably too large — split it.>

## Edge cases

<Prose bullets covering tricky or high-risk scenarios and their expected user-observable outcomes. No tables. No status codes.

Good example: "A user schedules a campaign for 'one minute from now', but the request takes 90 seconds to arrive at the server — the request is rejected because the chosen time is no longer in the future."

Bad example: "scheduled_at <= now() → 422 VALIDATION_ERROR"

Cover concurrency, race conditions, empty states, invalid inputs, and reversibility where relevant.>

## Out of scope

<Plain-language bullets. What this feature deliberately doesn't cover, so reviewers and implementers don't argue about it later.>

## Open questions

<Unresolved decisions the user must weigh in on. Phrase as a question.

When the user resolves one, mark it `[x]` and append `**→ <decision>.**` so the reasoning is preserved.>
```

## Final rule

After writing the spec, show its path and ask **"Proceed to implement? (yes / no / edits)"** — and then **stop**. Do not create migrations, routes, handlers, or tests until the user answers.

## Git — specs ship with the code

`__spec/<feature>.md` is tracked in git and pushed to GitHub. When the user says "yes" and you move to implementation, include the spec file in the same commit / PR as the feature (or a preceding spec-only PR). If the spec changes during implementation, update it before the PR merges. The `__spec/` directory must never be gitignored.
