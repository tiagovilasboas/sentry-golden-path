# PII and filters

Sentry is an error product, not a CRM. GDPR and LGPD both expect **data minimisation**: if a field is not required to fix the bug, do not send it.

Official refs:

- [Scrubbing sensitive data (JavaScript)](https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/)
- [SDK options: `dataCollection`](https://docs.sentry.io/platforms/javascript/configuration/options/)
- [Migrate from 10.x to 11.x (Data Collection)](https://docs.sentry.io/platforms/javascript/migration/v10-to-v11/)

## Scrub on the device (`beforeSend*`)

Sentry’s sensitive-data guide: use the SDK hooks **so sensitive data never leaves the local environment**. UI inbound filters and server-side scrubbing run **after** the payload has already left the browser. That is too late for a card number.

Hooks (JS docs):

| Hook | Applies to |
| --- | --- |
| `beforeSend` | Error and message events |
| `beforeSendSpan` | Spans (and streamed span mode) |
| `beforeSendLog` | Logs |
| `beforeSendMetric` | Metrics |
| `beforeSendTransaction` | Transactions in transaction mode (no effect in span-stream mode) |

This kit’s copy-paste inits implement `beforeSend` for Issues. Add `beforeSendSpan` when you start putting URLs or query strings on spans (`url.query`, raw `/users/1234/details` in custom span names). Hash **server-side** and send the hash if you need a correlation id. Never send the raw document “for debugging.”

Sensitive data also appears in places the error hook does not see:

- **Breadcrumbs.** JS SDKs pick up `console` / previous log lines, and many SDKs attach the HTTP query string to the breadcrumb. **Do not log PII** if those statements become breadcrumbs. Use `beforeBreadcrumb` to drop leftovers, or disable the logging breadcrumb integration.
- **User context.** Automated IP / identity inference is controlled by `dataCollection.userInfo` (SDK v11 removed `sendDefaultPii`). Data you set with `Sentry.setUser()` is **always sent**, regardless of `dataCollection`.
- **HTTP context and spans.** Query strings (`access_token`, `code`, `email`) and raw route ids.
- **Span names.** v11 stream mode names pageload / navigation spans by route (or `Pageload`), not the raw URL. Custom names still need `/users/1234/details` → `/users/:id` (`beforeStartSpan` in the React example).

## `sendDefaultPii` was removed in v11; `dataCollection` is the control

[Official v10 → v11 migration guide](https://docs.sentry.io/platforms/javascript/migration/v10-to-v11/): `sendDefaultPii` was **removed in SDK v11**. Use `dataCollection`. This is a behavior change, not a rename.

Facts from that guide, not guesses:

- In v10 an unset `sendDefaultPii` was restrictive. **In v11 an unset `dataCollection` collects everything by default** (user info, cookies, request/response headers and bodies, gen AI inputs/outputs, database query data).
- To keep the v10 behavior you must **set the baseline for each category explicitly**: `userInfo: false`, `cookies: false`, `httpHeaders` and `urlQueryParams` with the `["forwarded", "-ip", "remote-", "via", "-user"]` denylist, `httpBodies: []`, `genAI: { inputs: false, outputs: false }`, `databaseQueryData: false`, `graphQL: { document: false, variables: false }`.
- Built-in scrubbing matches sensitive-looking **key names** (`auth`, `token`, `password`). Best effort only: not enough for checkout, identity, or support chat.
- `dataCollection` does **not** affect Session Replay. Use Replay privacy options (`maskAllText`, `blockAllMedia`) for that.

This kit pins that full baseline in both inits (`PII_KEY_DENYLIST` holds the denylist) and `npm test` fails if a category is dropped or `sendDefaultPii` comes back. Turning any category on (cookies, headers, gen AI prompts) needs a written review. Prompts are PII: [ai-llm-monitoring.md](ai-llm-monitoring.md).

Do not `Sentry.setUser({ email, ip_address })` unless you have a documented need. Prefer an opaque `id`.

## Mask in `beforeSend`

Generic patterns — **examples**, not a jurisdiction-complete detector:

| Class | Example pattern | Replace with |
| --- | --- | --- |
| Payment card | 13–19 digits, optional spaces/dashes | `[FILTERED_CARD]` |
| National / tax document | 3-3-3-2 digit groups with at least one separator (`.`, whitespace or `-`), e.g. CPF `000.000.000-00`, or a raw 11-digit CPF with valid check digits | `[FILTERED_DOCUMENT]` |
| Phone | `+` / separators + 10–15 digits | `[FILTERED_PHONE]` |
| Email | `user@host` | `[FILTERED_EMAIL]` |

Apply the specific shapes first (email, `+` phone, document with separators), then the generic 13–19 digit card run. Otherwise a Brazilian MSISDN is labeled `[FILTERED_CARD]`. Raw 11-digit CPF runs are checked last: a run not glued to other digits is masked as a document only when its CPF mod-11 check digits are valid (repeated-digit runs such as `11111111111` are kept), while a CPF with separators is masked even if the check digits are wrong. Copy-paste implementation: [examples/react-init.ts](../examples/react-init.ts) (`maskPii`, `beforeSend`).

Replay: `maskAllText: true`, `blockAllMedia: true`. Unmasking a checkout form is an AppSec decision, not a DX convenience.

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

SDK `beforeSend*` is the first gate (you never pay for dropped events, and PII never leaves). Project **Inbound Filters** and server-side scrubbing are a second gate for what already arrived. Use them for legacy browser junk; do not rely on the UI as the only PII control.

Relay (self-hosted, between SDK and Sentry) is the official option when policy says the payload must not reach Sentry SaaS at all.

## Fail closed

If `beforeSend` cannot decide whether a string is PII, **drop or mask**. Shipping a card number into a SaaS because the regex missed a separator is worse than losing that one event.
