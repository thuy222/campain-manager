# Campaign

**Status:** ready · **Owner:** TH · **Date:** 2026-04-23
**Depends on:** auth

## What

A campaign is the core object in this app: an email message (name, subject, body) targeted at a list of recipients, with a lifecycle that takes it from an editable draft, optionally through a "scheduled for later" state, to a frozen "sent" state where only stats can be read.

This spec covers the full lifecycle in one place: creating a campaign, listing / viewing / editing / deleting drafts, scheduling a draft for a future moment, sending a campaign (synchronous, one request), and reading delivery stats.

The per-recipient delivery side — who specifically received, failed, or opened each email (per-recipient `sent_at`, `opened_at`, `status`), plus a recipient-focused entry point for list changes — is a separate feature (`recipients`). This spec covers recipient _counts_, _aggregate_ stats, full recipient-list replacement on drafts, and returning the flat list of recipient emails on the detail endpoint; it does not cover per-recipient delivery records.

## Who

A signed-in user. Every campaign is owned by exactly one user — the one who created it. A user can only see, modify, send, or read stats for campaigns they own. Cross-user access is not allowed and never leaks existence.

## Lifecycle at a glance

A campaign sits in exactly one of three states:

- **draft** — freshly created, fully editable, deletable.
- **scheduled** — pinned to a future moment; read-only within this spec (no edit, no delete, no re-schedule).
- **sent** — frozen; cannot be edited, re-sent, or moved back. Stats remain readable forever.

The only allowed transitions are: `draft → scheduled`, `draft → sent`, and `scheduled → sent`. Every other transition is rejected — no back-edges.

## Behavior

### Creating, listing, viewing

Creating a campaign takes a name, a subject, a body, and at least one recipient email (up to a reasonable batch cap). All of it lands in one step — no "create empty, add recipients later" flow. The new campaign starts as a draft.

Recipient emails are normalized: whitespace and capitalization don't make two entries different. `alice@example.com` and `Alice@Example.com` on the same list become a single recipient. The same recipient email used across two different campaigns points at the same shared recipient record — recipients are a shared resource, not duplicated per campaign.

Listing campaigns returns only the caller's campaigns, newest first, in pages the caller controls. The list can be narrowed by status. Each entry shows the campaign's basic details plus its recipient count.

Opening a single campaign returns the full campaign plus recipient count. If the campaign doesn't exist, or belongs to someone else, the user sees the same "not found" response in both cases — the system never lets one user discover that another user's campaigns exist.

### Editing and deleting (drafts only)

Editing changes the name, subject, body, or recipient list of a campaign — never the status, never the scheduled time. Recipient edits follow the same normalization rules as campaign create (whitespace- and case-insensitive dedupe, shared-record reuse across campaigns) and replace the whole list rather than patching individual entries. Editing is allowed only while the campaign is a draft. An empty patch that would change nothing is rejected rather than silently accepted. Attempting to edit a scheduled, sending, or sent campaign is rejected with "this campaign is no longer editable". The recipients feature offers a dedicated entry point for the same recipient-list change, for flows that focus solely on recipients.

Deleting works only on drafts. Deletion is immediate and permanent: the campaign and its recipient links disappear. The shared recipient records themselves remain, because they may be referenced by other campaigns. Attempting to delete a non-draft campaign is rejected with the same "no longer editable" signal.

### Scheduling

The owner picks a future moment and asks the system to schedule a draft campaign for that time. The system accepts only when three things are true: the campaign is still a draft at the moment the request arrives, the chosen moment is strictly after the current server time, and the campaign has at least one recipient. If any check fails, the campaign is left untouched and the user gets a specific message about which precondition failed.

Server time is authoritative. A moment the client picked that looked "future" but is "past" by the time the request reaches the server is rejected.

Scheduling only marks the campaign — it does not actually deliver. Sending is a separate, explicit action. Re-scheduling or un-scheduling an already-scheduled campaign is not supported within this spec; the user deletes and creates a new one.

### Sending

The owner presses send. The system checks that the campaign is a draft or scheduled, belongs to the caller, and has at least one recipient. If any check fails, the attempt is rejected with a specific message; the campaign is left untouched.

If the checks pass, the system walks through each recipient within the same request: it records whether the simulated delivery succeeded or failed and the moment it happened, then flips the campaign's status to `sent` before responding. A configurable proportion of recipients can be simulated as failures, and a configurable proportion of successfully-delivered recipients can be marked as having opened the email. With both knobs at zero (the default), every recipient is marked sent and none are opened.

Once the send completes the response carries the updated campaign; the campaign is now frozen.

Pressing send on an already-sent campaign is rejected with a clear state message.

### Stats

At any point in a campaign's life — even for a brand-new draft that has never been sent — the owner can read a consistent set of six numbers:

- **total** — recipients on the campaign;
- **sent** — how many have been successfully sent;
- **failed** — how many failed;
- **opened** — how many have been recorded as opened;
- **send rate** — the fraction of total that has been successfully sent;
- **open rate** — the fraction of successfully-sent that were opened.

Rates are fractions in the closed interval from zero to one, rounded to four decimal places. When the base of a rate would be zero (open rate when nothing has been sent, or send rate when total is zero), the rate is zero — not missing, not an error. The shape is stable across all campaign states; the UI never has to branch for "stats-not-ready".

Stats on another user's campaign look exactly like stats on a non-existent one — ownership is always hidden.

Reading stats never modifies anything.

## Acceptance criteria

### Create / list / view

1. An owner can create a campaign by providing a name, subject, body, and between one and a reasonable cap of recipient emails; the new campaign starts as a draft.
2. Recipient emails on create are normalized — differences only in whitespace or capitalization are collapsed into one recipient.
3. The same recipient email used across two campaigns shares one recipient record rather than being duplicated.
4. An owner can list their own campaigns, newest first, in pages they control, optionally filtered by status.
5. Each list entry includes a recipient count.
6. An owner can open any one of their own campaigns and see its full details, recipient count, and the flat list of recipient emails.
7. Attempts to open a non-existent campaign and attempts to open another user's campaign produce the identical "not found" response.

### Edit / delete (draft only)

8. An owner can edit the name, subject, body, or recipient list of their own campaign only while it is a draft. Recipient-list edits follow the same normalization and dedupe rules as campaign create.
9. A patch that would change nothing (empty body, unknown fields) is rejected with a field-level explanation.
10. Attempting to edit a scheduled, sending, or sent campaign is rejected with "no longer editable".
11. An owner can delete their own draft campaign; the campaign and its recipient links disappear.
12. Attempting to delete a non-draft campaign is rejected with the same "no longer editable" signal.

### Schedule

13. An owner can schedule their own draft campaign for a strictly-future moment.
14. Scheduling succeeds only when all three preconditions hold: still-draft, strictly-future (server time), and at least one recipient.
15. If any scheduling precondition fails, the campaign's state is left exactly as it was, and the failure message names the precondition.
16. Scheduling a non-draft, or re-scheduling an already-scheduled campaign, is rejected.

### Send

17. An owner can send their own draft or scheduled campaign.
18. Pressing send returns the updated campaign in the `sent` state in one response — per-recipient processing completes before the response is sent.
19. A sent campaign cannot be edited, deleted, scheduled, or re-sent.
20. Sending a campaign that is already sent is rejected.
21. Sending a campaign with zero recipients is rejected.
22. Two simultaneous send attempts on the same campaign cannot both succeed.
23. Simulated failure rate and simulated open rate are system-level configurable; both default to zero.

### Stats

24. An owner can read stats on any of their own campaigns in any state; the response always contains the same six fields.
25. Rates are fractions in the closed interval from zero to one, rounded to four decimals.
26. When the base of a rate is zero, the rate is reported as zero rather than missing or as an error.
27. Reading stats never modifies state.

### Ownership (applies to every action above)

28. All reads and writes act only on campaigns owned by the caller. Cross-user access is indistinguishable from access to a non-existent campaign — the system never reveals the existence of someone else's campaign.

## Edge cases

- The user submits an empty recipient list on create — rejected with "at least one recipient required".
- The user pastes the same email in different capitalizations into the recipient list — deduped to one recipient.
- The user submits more recipients than the batch cap — rejected with a size-limit message.
- The user opens the list while having zero campaigns — they see an empty list, not an error.
- Two tabs delete the same draft at the same moment — one succeeds; the other gets "not found".
- The user tries to edit their own campaign an instant after it was scheduled in another tab — the edit is rejected as "no longer editable".
- The user picks a scheduled moment of exactly "now" — rejected; "strictly future" is the rule.
- The user picks a scheduled moment seconds ahead, but network delay makes it "past" by the time the request lands — rejected on server time.
- The user picks a time without an unambiguous timezone — rejected as ambiguous.
- The user presses send and immediately presses send again — the second is rejected as already-sent.
- Simulated failure rate is set to 100% — every recipient is marked failed; the campaign still reaches sent (done, not necessarily successful).
- Every recipient of a sent campaign failed — sent is zero, failed equals total, both rates are zero (no divide-by-zero).
- The user attempts any action on a campaign by guessing someone else's id — the response is identical to attempting the action on a campaign that never existed.

## Out of scope

- Reading per-recipient delivery state as a detail list — who received, failed, or opened each email — and the recipient-focused entry point for list changes (see the `recipients` spec).
- Campaign duplication, templates, bulk operations, free-text search, alternate sort orders, soft delete / undo.
- Un-scheduling, re-scheduling, recurring schedules.
- Automatic dispatch at the scheduled moment — the scheduled state is informational; a human still presses send.
- Real email delivery (no SMTP, no third-party provider).
- Per-recipient retry after failure, resending to a subset.
- Real open tracking via pixels or tracking links — opens are simulated.
- Aggregated / cross-campaign dashboards, time-series breakdowns.
- Stats caching / materialization.

## Open questions (resolved)

- [x] Hard cap on recipient list length at create time. **→ 100. Large enough for demo, small enough to reject accidental paste of huge lists.**
- [x] Should edit be able to touch the recipient list, or does that belong entirely to the recipients spec? **→ Both. The campaign edit accepts an optional new recipient list (same normalization rules as create); the recipients feature also exposes a dedicated entry point for recipient-focused UX. Both act on drafts only.**
- [x] Default simulated failure and open rates — both zero (cleanest) versus small non-zero values that give the stats page something interesting out-of-the-box. **→ Both zero by default. The seed script sets demo-friendly values so the UI looks alive after seeding; production and test runs start clean.**
- [x] Synchronous vs. async send. **→ Synchronous, per requirements.md: one request marks every recipient and flips the campaign to `sent`. No intermediate `sending` state, no background worker, no boot-resume. Per-recipient detail is the `recipients` feature's concern.**
- [x] Should a scheduled campaign reaching its moment auto-dispatch, or always wait for the user? **→ Always wait. The scheduled state is informational; the owner presses send. Auto-dispatch is not required by the challenge and adds a worker we don't otherwise need.**
- [x] Rate rounding — four decimals here is ample for any UI, but should the system round later rather than here to preserve precision for downstream consumers? **→ Round here to four decimals. No downstream consumers planned at this scope.**
