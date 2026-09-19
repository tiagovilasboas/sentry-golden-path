# Sampling and Web Vitals

Start **below** what the wizard suggests. Quota is a product cost; alert fatigue is an engineering cost. The first-run SDK default for errors is `sampleRate: 1` (every error). First-time setup posts often leave traces at `1.0` too. That is a **demo**, not a production default on a busy SPA. Raise only after Issues are actionable and Stats / Usage is boring.

Official refs (do not invent rates beyond these pages and the table below):

- [Sentry sampling (JavaScript)](https://docs.sentry.io/platforms/javascript/sampling/)
- [Watching everything is watching nothing](https://blog.sentry.io/sampling-strategy-sentry/)
- [Sentry Web Vitals dashboard](https://docs.sentry.io/product/dashboards/sentry-dashboards/frontend/web-vitals/)
- [Web Vitals (web.dev)](https://web.dev/articles/vitals)

## Three dials: errors, uniform traces, sampler

These are **independent**. Cutting traces does not hide exceptions unless you also cut `sampleRate`.

| Dial | What it samples | Official behavior | This kit |
| --- | --- | --- | --- |
| `sampleRate` | **Error** events only | JS docs: number `0`–`1`. **Default `1`** (all errors). Changing it requires a redeploy. | **0.1** until quota is proven. Errors stay the high-signal channel; we just do not open at 100% on a busy SPA. |
| `tracesSampleRate` | **Transactions / spans** (pageload, navigation, fetch, INP) | Uniform cross-section. If neither this nor `tracesSampler` is set, **no transactions** are sent. | **0.05**, matching the [blog production example](https://blog.sentry.io/sampling-strategy-sentry/) (`NODE_ENV === "development" ? 1.0 : 0.05`). |
| `tracesSampler` | Same traces, **per request** | Function on `samplingContext`. Can return `0`–`1` or a boolean. **Wins** over parent inheritance and over `tracesSampleRate` if both exist. | Day-two control. Prefer this plus `inheritOrSampleWith` once you have distributed traces. |

The sampling-strategy post treats production like this: **errors high-signal** (they usually leave `sampleRate` at `1.0`), **traces conservative** (`0.05` in the production snippet), **session replay low**, **replay-on-error high** (`replaysOnErrorSampleRate: 1.0`, described as a flight recorder for the ~60s before the crash). This kit follows that shape and is stricter on errors (`0.1`) and happy-path replay (`0`) until you write a budget.

## Conservative defaults

Use these numbers in the copy-paste inits until you have a written reason to change them.

| Signal | Option | Golden-path default | Do not start with |
| --- | --- | --- | --- |
| Errors | `sampleRate` | **0.1** (10%) | Wizard / SDK default `1.0` on a busy SPA |
| Traces / Web Vitals | `tracesSampleRate` | **0.05** (5%) | `1.0` or even `0.2` “to see more” |
| Session replay | `replaysSessionSampleRate` | **0** | A blanket `0.1` (every 10th session; replay minutes are expensive) |
| Replay on error | `replaysOnErrorSampleRate` | **1.0** | `0` (you lose the only cheap replay) |
| Profiling | `profileSessionSampleRate` / `profilesSampleRate` | **omit** | on by default |

Replay at `0` means you do not film happy-path sessions. `replaysOnErrorSampleRate: 1.0` still sends a buffer around errors when `replayIntegration()` is present. That is the budget-friendly way to get “what did the user click?” There is no `replaysSampler` yet; the blog shows `replay.start()` when you later need a named funnel.

## Prefer `tracesSampler` + `inheritOrSampleWith`

A uniform `tracesSampleRate` is a blunt cross-section. Official docs: if the span has a parent, **inherit** that decision or you break the distributed trace (orphaned spans). SDK v9+ exposes `inheritOrSampleWith(fallback)` on the sampling context. Prefer it over reading `parentSampled` by hand. It keeps sampling deterministic for downstream services.

Day-one copy-paste still uses the static `0.05` so the init stays small. When the browser talks to an instrumented API, switch the SPA to a sampler and **fall back to the same 0.05**:

```ts
tracesSampler({ name, inheritOrSampleWith }) {
  if (name.includes("healthcheck")) {
    return 0;
  }
  if (name.includes("/checkout") || name.includes("/auth")) {
    return 0.2;
  }
  // Inherit the upstream decision, or the blog's production fallback.
  return inheritOrSampleWith(0.05);
}
```

Precedence (JS sampling docs), first match wins:

1. `tracesSampler` if defined (it may ignore the parent; **do not**, or you break the trace).
2. Else the parent sampling decision.
3. Else `tracesSampleRate`.

A sampler that always returns `1` is `tracesSampleRate: 1.0` with extra steps. The `name` passed in may still be `/users/123` (not yet parameterized). Do not key off raw ids.

LLM / agent spans inherit the **root** decision. Keep the SPA at 0.05; raise only the server route or `gen_ai.*` root that calls the model. Token breadcrumbs stay at 100%. Details: [ai-llm-monitoring.md](ai-llm-monitoring.md).

## Budget, then raise

Volume ≈ `sessions × sampleRate` (errors) + `pageloads × tracesSampleRate` (spans) + `errors × replay-on-error` (replay minutes).

1. Ship the table above.
2. After a few days, open Stats / Usage. If error quota is idle **and** you are missing rare bugs, raise `sampleRate` toward `0.2`, then `0.5`. The official default (`1.0`) is the ceiling, not the starting point on a busy SPA.
3. If Performance is empty, raise the **fallback** inside `inheritOrSampleWith` toward `0.1`. Web Vitals are statistical; 5% of a large site is enough to see LCP/INP/CLS *shape*. 100% is almost never worth it on the client.
4. Turn on session replay only for a named funnel, or start replay manually. The blog’s first production snippet uses `replaysSessionSampleRate: 0.01` for full-session recording. Do not turn it on globally.

Document the change in the PR that bumps the constant. Do not “temporarily” set `1.0` and forget it.

## Web Vitals: field RUM, not Lighthouse lab

Add `Sentry.browserTracingIntegration()` (React Router / Vue Router variants if you have a router). With tracing enabled, pageload spans carry Core Web Vitals. That is **RUM** (real users, real devices, real networks). [web.dev](https://web.dev/articles/vitals) is explicit: lab tools (Lighthouse, a simulated load with no user) are for catching regressions in CI. They are **not** a substitute for field measurement. Lighthouse cannot measure INP (no user); it uses Total Blocking Time as a proxy. Sentry’s own score tables say they try to match Lighthouse weights, “but there may be some differences because Sentry operates on real user data, whereas Google Lighthouse operates on lab data.”

Core Web Vitals (web.dev; measure at **p75**, mobile and desktop separately):

| Vital | User question | “Good” threshold (web.dev) |
| --- | --- | --- |
| **LCP** | When did the main content appear? | ≤ 2.5s |
| **INP** | How long until the UI reacted? | ≤ 200ms |
| **CLS** | Did the page jump? | ≤ 0.1 |

You are **not** replacing a RUM warehouse. You are attaching a **sampled** field vital to the same `release` and route as the error. That is Golden Signals **Latency**, not Traffic. Keep `tracesSampleRate` ≤ 0.05 so Insights stay cheap. Map: [observability-map.md](observability-map.md).

### What the Sentry Web Vitals page actually shows

From the [Sentry Web Vitals dashboard](https://docs.sentry.io/product/dashboards/sentry-dashboards/frontend/web-vitals/):

- The page is **initial page-load** oriented (plus interactions for INP). **Navigations are not included.**
- The **samples list** only shows page loads that have the required Web Vitals and a Performance Score. **A load missing a required vital is dropped from that list** (browser support / page behavior). Do not treat an empty samples table as “performance is fine.”
- Opportunity is weighted by traffic: a mediocre high-traffic route outranks a terrible page nobody opens.
- Auto-capture needs `BrowserTracing`. Chrome, Firefox, Safari, Opera, and Edge only for Performance Score.

Optional on the integration (defaults are already on in current SDKs): `enableInp: true`, `enableLongTask: true`. Do not also set `interactionsSampleRate: 1` on top of a high `tracesSampleRate`.

Name transactions. Dynamic ids in the path (`/orders/12345`) explode cardinality **and** can be PII. Normalize in `beforeStartSpan` (see the React example) or use the router integration so spans are `/orders/:id`.

`tracePropagationTargets` should list **your API origin**, not the open web. Over-broad targets attach `sentry-trace` headers to third parties.
