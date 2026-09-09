# PII and filters

Sentry is an error product, not a CRM. GDPR and LGPD both expect **data minimisation**: if a field is not required to fix the bug, do not send it. `sendDefaultPii: false` is the default in this guide even when the SDK would allow more. On SDK v10+, also set `dataCollection: { userInfo: false, httpBodies: [] }` so IP/user inference and HTTP bodies stay off.

The SDK already redacts some obvious keys (`password`, `authorization`, …). That is not enough for checkout, identity, or support chat. Add `beforeSend` and treat request bodies, URLs, and breadcrumbs as hostile.

## Mask in `beforeSend`

Generic patterns — **examples**, not a jurisdiction-complete detector:

| Class | Example pattern | Replace with |
| --- | --- | --- |
| Payment card | 13–19 digits, optional spaces/dashes | `[FILTERED_CARD]` |
| National / tax document | long digit groups (8–14) | `[FILTERED_DOCUMENT]` |
| Phone | `+` / separators + 10–15 digits | `[FILTERED_PHONE]` |
| Email | `user@host` | `[FILTERED_EMAIL]` |

Do not log the original string “for debugging”. If you need a correlation id, hash **server-side** and send the hash as a tag — never the raw document.

Also:

- Strip query strings that carry tokens (`access_token`, `code`, `email`).
- Do not `Sentry.setUser({ email, ip_address })` unless you have a documented need. Prefer an opaque `id`.
- Replay: `maskAllText: true`, `blockAllMedia: true`. Unmasking a checkout form is an AppSec decision, not a DX convenience.

Copy-paste implementation: [examples/react-init.ts](../examples/react-init.ts) (`maskPii`, `beforeSend`).

## `ignoreErrors` and `denyUrls`

Third-party scripts (extensions, ads, tag managers) throw in the user’s browser. Those issues are not your release.

`ignoreErrors` — message matchers for known noise:

- `top.GLOBALS`, `canvas.contentDocument`, `MyApp_RemoveAllHighlights`
- `Network request failed` from a webview you do not own
- Browser extension frames you cannot patch

`denyUrls` — drop events whose stack is **only** on a host you do not ship:

- `/extensions\//i`, `/chrome-extension:/i`, `/moz-extension:/i`
- Known analytics / chat widgets if they wrap `window.onerror`

Do not ignore your own `TypeError` / `ChunkLoadError` blindly. `ChunkLoadError` after a deploy is often a **real** stale-tab problem — tag it and version the release instead of filtering it out.

Prefer **narrow** matchers. A global `.*facebook.*` deny can hide a first-party failure that merely *mentions* a pixel in the stack.

## Inbound filters in the UI

SDK filters are the first gate (you never pay for dropped events). Project **Inbound Filters** in Sentry are a second gate for what already arrived. Use them for legacy browser junk; do not rely on the UI as the only PII control — the payload already left the device.

## Fail closed

If `beforeSend` cannot decide whether a string is PII, **drop or mask**. Shipping a card number into a SaaS because the regex missed a separator is worse than losing that one event.
