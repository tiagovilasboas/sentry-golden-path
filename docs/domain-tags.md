# Domain tags and dedup

An exception without product context is a stack with a shrug. Tag the **business slice** at the call site so Issues, alerts, and searches match how the team actually works.

Official refs (tag keys and values, not a brand taxonomy):

- [Sentry tags (JavaScript)](https://docs.sentry.io/platforms/javascript/enriching-events/tags/)
- [Sentry context (JavaScript)](https://docs.sentry.io/platforms/javascript/enriching-events/context/)

## Tags: `domain` and `flow`

| Tag | Meaning | Examples |
| --- | --- | --- |
| `domain` | Bounded context / area of the product | `checkout`, `auth`, `billing`, `search`, `account` |
| `flow` | Concrete user journey inside that domain | `pay`, `login`, `reset-password`, `add-to-cart` |

Keep values **short, stable, enum-like**. Do not put order ids, emails, or route params in tags (cardinality + PII). Put ids in `extra` only if they are opaque and already public to that user.

Capture **with context**, not bare:

```ts
Sentry.withScope((scope) => {
  scope.setTag("domain", "checkout");
  scope.setTag("flow", "pay");
  scope.setContext("checkout", { step: "review" });
  Sentry.captureException(error);
});
```

`Sentry.captureException(error)` at a global `window.onerror` is a backstop. The golden path is: the module that knows the flow sets tags, then captures.

Set a default domain in `init` only if the whole bundle is one context (a dedicated checkout SPA). Multi-area apps should set tags per feature module.

Search in Sentry: `domain:checkout flow:pay`. Alert on that pair, not on “any error in production”. That pair is also the **critical-flow** SLI shape in [observability-map.md](observability-map.md): share of a named journey that finishes without a captured exception. Set the target from your product; this kit does not publish a brand nines figure.

## Short-window dedup

A render loop, a retrying fetch, or a toast that re-throws can emit **hundreds of identical events in seconds**. Sentry groups by fingerprint, but you still burn quota and wake people.

Pattern: in-memory map, **short TTL** (5–15s), key = `domain + flow + error name + message`. Drop duplicates inside the window in `beforeSend`. This is **client-side quota protection**, not a substitute for Sentry grouping.

| Do | Don't |
| --- | --- |
| TTL 10s, process-local `Map` | Redis, cookies, or a long TTL that hides a real incident |
| Key on type + message + tags | Key on full stack (too unique) or only `domain` (too coarse) |
| Count and attach `extra.dedup_dropped` if you need visibility | Infinite retry that captures on every tick |

See `shouldDropDuplicate` in [examples/react-init.ts](../examples/react-init.ts). Reset on hard navigation is fine — a new page load is a new process.

If the same error is **legitimately** happening for thousands of users, that is not a dedup problem: fix the release or raise the alert threshold.
