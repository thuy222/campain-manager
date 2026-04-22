# Recipients

**Status:** ready · **Owner:** TH · **Date:** 2026-04-22
**Depends on:** auth, campaign

## What

Recipients are the people a campaign is sent to. The `campaign` spec already covers creating a campaign with an initial recipient list; this spec picks up from there and covers three things:

1. Reading the per-recipient delivery status of a campaign — who got what, when, and who opened it.
2. Replacing the recipient list on a draft campaign — for when the user put the wrong emails on create and wants to start over without recreating the whole campaign.
3. A demo-only way to simulate that a recipient "opened" their email, so the stats page can show an interesting non-zero open rate without wiring up a real tracking pixel.

## Who

A campaign's owner. The underlying recipient records (keyed by email) are shared across all users of the app, but per-campaign delivery state — status, time sent, time opened — belongs to the campaign owner and only the campaign owner can read or modify it.

## Behavior

### Viewing a campaign's recipients

The user opens one of their campaigns and asks for its recipient list. They see a paged view of who is on the campaign; each entry shows the email, any name on file for that recipient, the delivery status (pending, sent, or failed), the moment the recipient was processed (if any), and the moment they were recorded as opened (if any).

The list can be narrowed by delivery status — for example, "show me only the failed recipients" — which is useful when a large campaign has a handful of problems buried in a long successful list.

Recipient records are shared: if the same email is used on three campaigns, there is one recipient record and three per-campaign delivery entries. Editing a recipient's shared metadata (e.g., their name) is not covered by this spec; this feature touches only the per-campaign delivery side.

Attempting to view the recipients of a campaign owned by someone else is indistinguishable from attempting to view the recipients of a non-existent campaign.

### Replacing the recipient list on a draft

If the user realizes they entered the wrong emails at create time, they can replace the whole recipient list on the campaign — as long as it is still a draft. Replacement is whole-list: the user submits the new list and the old list is gone. There is no partial "add one, remove one" flow in this spec, because the intended UX is a textarea the user re-submits.

Normalization follows the same rules as campaign create: duplicates collapse, whitespace and capitalization don't matter, and shared recipients across campaigns are reused rather than duplicated.

Replacement is rejected on any non-draft campaign with "no longer editable". Replacement with an empty list is rejected — a campaign with no recipients can't be scheduled or sent, so it would be non-functional.

### Simulating an open (demo only)

For demonstration and manual testing, the owner can mark one of their sent recipients as "opened", stamping the current moment. This is how the stats page can show a realistic non-zero open rate without real tracking infrastructure.

This action is gated by an explicit system configuration flag that is off by default. In a normal / production configuration, the endpoint is disabled entirely — attempts to reach it are rejected uniformly, without any ownership check or state reveal, so the endpoint's existence is not leaked.

When the flag is on, the action is still restricted: the caller must own the campaign, and the targeted recipient's current delivery status must be "sent". Attempting to mark a pending or failed recipient as opened is rejected with a clear state message. Attempting to mark an already-opened recipient as opened again is safe — the action is idempotent and the originally-recorded open time is preserved.

## Acceptance criteria

1. A campaign's owner can browse a paged list of that campaign's recipients; each entry shows email, name (if known), delivery status, time processed, and time opened.
2. The list can be filtered by delivery status.
3. Attempting to view the recipients of another user's campaign is indistinguishable from attempting to view a non-existent campaign.
4. A campaign's owner can replace the entire recipient list of a draft campaign with a new list of emails, within the same size bounds that apply at campaign-create time.
5. Replacement is rejected on any non-draft campaign with a "no longer editable" message.
6. Replacement with an empty list is rejected.
7. Replacement normalizes and dedupes emails the same way as campaign create.
8. Replacement reuses existing recipient records across campaigns rather than duplicating them.
9. When the demo-open feature is disabled (the default), any attempt to mark a recipient as opened is rejected uniformly, without revealing whether the targeted campaign or recipient exists.
10. When the demo-open feature is enabled, the owner can mark one of their own "sent" recipients as opened; the current moment is recorded as the open time.
11. Attempting to mark a pending or failed recipient as opened is rejected with a clear state message.
12. Marking an already-opened recipient as opened again succeeds; the originally-recorded open time is preserved.
13. Every action in this feature is restricted to campaigns owned by the caller; cross-user access is indistinguishable from non-existence.

## Edge cases

- The user replaces the recipient list on a draft with a list that partly overlaps the old one — the overlapping recipients are reused (one recipient record); the old per-campaign delivery entries are cleared because the whole list is being replaced.
- The user replaces the recipient list with a list identical to the existing one — accepted; old delivery rows are cleared and replaced with fresh pending rows. There is no no-op optimization for "same list".
- The user tries to replace the recipient list on a campaign that was scheduled from another tab an instant earlier — rejected as "no longer editable"; the list is untouched.
- The user tries to mark a recipient as opened on a campaign that has not yet been sent — rejected as "wrong state".
- The user tries to mark an opened recipient as opened a second time — accepted; the original open time is preserved (idempotent).
- The demo-open endpoint is called in a production configuration — rejected uniformly; the response reveals nothing about the targeted campaign or recipient.
- Two requests to replace the same draft's recipient list arrive at the same moment — exactly one wins; the other is rejected.
- A replacement would leave the campaign with zero recipients — rejected; a campaign must always have at least one recipient.

## Out of scope

- Standalone recipient CRUD — listing all recipients a user has ever messaged, or editing a recipient's shared name or other shared metadata.
- Cross-campaign recipient views / search.
- Real open tracking via pixels, tracking links, or webhooks.
- Bounce and complaint handling.
- Unsubscribe or preference management.
- Per-recipient retry of a failed delivery.
- CSV import / export of recipient lists.
- Incremental list edits — "add one recipient", "remove one recipient" — rather than whole-list replacement.

## Open questions (resolved)

- [x] Is whole-list replacement the right UX, or should this spec include incremental add / remove operations? **→ Whole-list replacement only. Matches the textarea UX in the frontend and keeps the state machine simple.**
- [x] Should the demo-open action be an HTTP endpoint gated by a system flag, or something that only exists in test / seed scripts and never in HTTP at all? **→ HTTP endpoint gated by a system flag (off by default). Keeps the production surface clean while still enabling the frontend's one-click demo button when the flag is on.**
- [x] If a replacement brings in an email whose shared record already has a different name on file, should we update the shared name? **→ No. Names are set elsewhere; this feature only manages per-campaign delivery state. Avoids accidentally overwriting a recipient's name through a side-effect of another campaign's edit.**
