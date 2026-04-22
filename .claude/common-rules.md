# Common Rules

Project-agnostic behavioral and coding conventions. `CLAUDE.md` references this file and adds project-specific rules on top. Everything here applies regardless of language or framework unless a project rule explicitly overrides it.

**Tradeoff:** these rules bias toward caution, simplicity, and traceability over speed. For truly trivial tasks use judgment, but the default is to follow them.

---

## Part A — Behavioral

### 1. Think before coding

> Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity first

> Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" / "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Self-test: "Would a senior engineer call this overcomplicated?" If yes, simplify.

### 3. Surgical changes

> Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style even if you'd do it differently.
- If you notice unrelated dead code, **mention it** — don't delete it.

When your changes create orphans:

- Remove imports / variables / functions that **your** changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-driven execution

> Define success criteria. Loop until verified.

Turn tasks into verifiable goals:

- "Add validation" → "write tests for invalid inputs, then make them pass."
- "Fix the bug" → "write a test that reproduces it, then make it pass."
- "Refactor X" → "ensure tests pass before and after."

For multi-step tasks, state a brief plan:

```
1. <step>  → verify: <check>
2. <step>  → verify: <check>
3. <step>  → verify: <check>
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Part B — Coding conventions

### Naming

- Files: `kebab-case.ts` (or language-idiomatic equivalent).
- Classes / types: `PascalCase`.
- Functions / variables: `camelCase`.
- Constants that are truly constant: `SCREAMING_SNAKE_CASE`.
- DB columns: `snake_case`.
- Boolean names read as predicates: `isDraft`, `hasRecipients`, `canEdit` — not `status` or `flag`.

### Types

- No `any` in TypeScript. If a type is genuinely unknown use `unknown` and narrow.
- Prefer inferred types from a single source of truth (e.g., `z.infer<typeof Dto>`) over hand-duplicated interfaces.
- Don't export types that nothing outside the module uses.

### Comments

Default: no comments. Add one only when the **why** is non-obvious: a hidden constraint, a subtle invariant, a workaround for a specific bug, behavior that would surprise a reader. If removing the comment wouldn't confuse a future reader, don't write it.

Don't explain what the code does — well-named identifiers already do that. Don't reference the current task, fix, or callers ("used by X", "added for the Y flow", "handles the case from issue #123") — that belongs in the PR description and rots.

### Error handling

- Fail loud at boundaries (user input, external APIs). Trust internal code and framework guarantees.
- Never catch-and-log-and-continue. Throw, or let it bubble.
- Don't add error handling for scenarios that can't happen.
- Don't leak stack traces, secrets, or internal details into user-facing errors.

### Tests

- Every behavior-changing PR should add or update a test.
- Tests hit the real thing where practical (real DB via migrations, real HTTP via supertest/equivalent). Mock at system boundaries only.
- A test without a meaningful assertion is worse than no test — it gives false confidence.
- Name tests by behavior (`rejects past scheduled_at`), not by method (`test_schedule_1`).

### Anti-patterns (universal)

- ❌ Speculative abstractions / "this might be useful later" code.
- ❌ Feature flags or backwards-compat shims when you can just change the code.
- ❌ Backwards-compatibility hacks like renamed `_vars`, re-exports for removed symbols, or `// removed: foo` comments.
- ❌ Half-finished implementations with `// TODO` that the next reader has to decode.
- ❌ `any`-typed escape hatches.
- ❌ Catch-all `try { ... } catch { /* ignore */ }`.
- ❌ Swallowed promise rejections.

---

## Part C — Working with Claude Code (workflow defaults)

- **Read the project's `CLAUDE.md` and any `__spec/` file before coding.** If a spec is missing for non-trivial work, draft one first and stop for confirmation.
- **Short user-facing updates, not monologues.** State what you're about to do before the first tool call; flag finds, direction changes, and blockers. Silent is worse than brief.
- **Don't narrate deliberation.** Write results, not running commentary.
- **Match response size to the question.** A one-line question gets a one-line answer; no headers, no sections.
- **Ask before destructive or shared-state actions** (force push, DB drops, deletes, sending messages, publishing to third-party tools). Authorization for one action does not extend to others.
- **Match the existing code style.** If the project uses tabs, use tabs. If it uses single quotes, use single quotes. Consistency > preference.

---

**These rules are working if:** diffs are small and traceable, questions come before implementation instead of after mistakes, and rewrites from overcomplication become rare.
