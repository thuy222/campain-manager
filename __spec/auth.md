# Auth

**Status:** ready · **Owner:** TH · **Date:** 2026-04-22
**Depends on:** none

## What

Users need a way to create an account, identify themselves on return visits, and end their session when they're done. Every other feature in this app acts on behalf of a specific user — auth is the foundation all ownership rules sit on.

The feature covers signing up, signing in, staying signed in across sessions, silently extending an active session so users aren't kicked out mid-task, and signing out.

## Who

Anyone can register — there's no invite gate. Once registered, a user becomes the single owner of the campaigns they create and the only person who can read, modify, or send them.

## Behavior

A new user provides an email, a name, and a password. The system creates their account and considers them signed in immediately, without requiring a separate sign-in step afterward.

A returning user provides the email and password they registered with. If both match, they are signed in. If either one is wrong, the attempt is rejected with a single generic message — the system does not reveal which part was wrong, so an attacker can't use the system to probe whether a given email is registered.

A signed-in user stays signed in as long as their session is still fresh. Sessions are good for 24 hours. If the user is still actively using the app, the session is quietly renewed in the background so they don't need to stop and sign in again. If they set the app down and don't come back within a day, they'll need to sign in fresh on their next visit — there is no long-lived "remember me" second track.

Signing out ends the session immediately; any action taken after that, including by another tab on the same device, requires a fresh sign-in.

A signed-in user can ask who they are signed in as. The answer includes their email, name, and when their account was created. The password is never part of any response — not on sign-up, not on sign-in, not when retrieving account info, and not in any error message or log.

Under the hood the password is stored only as a one-way transformation, so even with full database access no one can recover the original text.

## Acceptance criteria

1. A user can register by providing a valid email, a name, and a password of at least 8 characters; after registering they are considered signed in.
2. Two accounts cannot share an email. Different capitalizations of the same address are treated as the same email.
3. A registered user can sign in with the email and password they registered with.
4. Signing in with a wrong password, or with an email that isn't registered, produces the same generic failure — the system does not reveal which was wrong.
5. A signed-in user can retrieve their own account information (email, name, creation date); the password is never included.
6. A signed-in user can extend their session without re-entering credentials, as long as the session has not already expired. Extending resets the 24-hour clock.
7. Once a session has expired, extension attempts fail — the user must sign in again.
8. Signing out ends the session; any protected action taken afterward is rejected.
9. If a user's account record is removed while they are signed in, their session stops working on the next request.
10. The password is never returned in any response, shown in any error, or written to any log.
11. Attempting any protected action without a valid session is rejected uniformly — without revealing whether the caller is nearly-authenticated, expired, or was never signed in.

## Edge cases

- A user tries to register with `Alice@Example.com` when `alice@example.com` already exists — the system treats them as the same email and rejects the registration.
- Two people attempt to register with the same never-before-used email at the same moment — exactly one of them succeeds; the other sees "email already registered."
- A user's session cookie is tampered with, truncated, or otherwise invalid — the system treats them as signed out without acknowledging what was wrong with the cookie.
- A user closes the app for 23 hours and returns — they are still signed in, and on their next action the session is silently extended for another 24 hours.
- A user closes the app for 25 hours and returns — their session has expired and they are required to sign in again. There is no grace period.
- A user signs in on two devices, then signs out on one — only that device's session ends; the other stays valid until it independently expires or signs out.
- A user submits a password shorter than 8 characters — the registration is rejected with a field-level explanation.
- A user's password is correct but the email has extra whitespace or different capitalization from registration — the system still signs them in (email is normalized before comparison).

## Out of scope

- Signing in via Google, GitHub, or any other third-party identity provider.
- Verifying an email address by sending a confirmation link.
- "Forgot password" / password-reset flow.
- Multi-factor authentication.
- Rate limiting or lockout after repeated failed sign-in attempts.
- Any notion of roles, permissions, or admin users — everyone is a regular user who owns their own campaigns.
- A long-lived "remember me" option that survives past 24 hours of inactivity.

## Open questions (resolved)

- [x] How long should a session last? **→ 24 hours, silently extended while the user is active.**
- [x] Should there be a way to extend a session without re-signing-in? **→ Yes, as long as the session has not already expired. Once expired, the user must sign in again.**
- [x] Is a "forgot password" flow in scope? **→ No.**
- [x] Should the system rate-limit sign-in attempts? **→ No.**
- [x] How strict should the session's cross-site behavior be? **→ Permissive enough to survive normal link navigation from another site, but not permissive enough to ride on a top-level cross-site request.**
