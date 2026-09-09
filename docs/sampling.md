# Sampling and Web Vitals

Start **below** what the wizard suggests. Quota is a product cost; alert fatigue is an engineering cost. Raise rates only after Issues are actionable for a week.

## Conservative defaults

Use these numbers in production until you have a written reason to change them.

| Signal | Option | Golden-path default | Do not start with |
| --- | --- | --- | --- |
| Errors | `sampleRate` | **0.1** (10%) | `1.0` on a busy SPA |
| Traces / Web Vitals | `tracesSampleRate` | **0.05** (5%) | `1.0` or even `0.2` “to see more” |
| Session replay | `replaysSessionSampleRate` | **0** | `0.1` (every 10th session, expensive) |
| Replay on error | `replaysOnErrorSampleRate` | **1.0** | `0` (you lose the only cheap replay) |
| Profiling | `profileSessionSampleRate` / `profilesSampleRate` | **omit** | on by default |

`sampleRate` is **error events**. `tracesSampleRate` is **transactions/spans** (pageload, navigation, fetch, INP). They are independent. Cutting traces does not hide 100% of exceptions unless you also cut `sampleRate`.

Replay: session replay at 0 means you do not record happy-path sessions. `replaysOnErrorSampleRate: 1.0` still records a buffer around errors when `replayIntegration()` is present. That is the budget-friendly way to get “what did the user click?” without filming everyone.

## Budget, then raise

Volume ≈ `sessions × sampleRate` (errors) + `pageloads × tracesSampleRate` (spans) + `errors × replay-on-error` (replay minutes).

1. Ship the table above.
2. After a few days, open Stats / Usage. If error quota is idle **and** you are missing rare bugs, raise `sampleRate` toward `0.2`, then `0.5`. Stop before `1.0` unless traffic is tiny.
3. If Performance is empty, raise `tracesSampleRate` toward `0.1`. Web Vitals are statistical; 5% of a large site is enough to see LCP/INP/CLS shape. 100% is almost never worth it on the client.
4. Turn on session replay (`replaysSessionSampleRate` 0.01–0.05) only for a named funnel (checkout, signup) via `tracesSampler` / sampling context — not globally.

Document the change in the PR that bumps the constant. Do not “temporarily” set `1.0` and forget it.

## Web Vitals (browser performance tracing)

Add `Sentry.browserTracingIntegration()` (React Router / Vue Router variants if you have a router). With tracing enabled, pageload and navigation spans carry Core Web Vitals:

| Vital | What it means (high level) | Why Sentry |
| --- | --- | --- |
| **LCP** | Largest Contentful Paint — when the main content appears | Slow LCP on a route correlates with “blank checkout” reports |
| **INP** | Interaction to Next Paint — how long the UI takes to react | Frozen click handlers, main-thread long tasks |
| **CLS** | Cumulative Layout Shift — visual instability | Late fonts, ads, images without size |

You are **not** replacing a RUM warehouse. You are attaching sparse vitals to the same release and route as the errors — Golden Signals **Latency** / RED **Duration**, not Traffic/Rate. Keep `tracesSampleRate` ≤ 0.05 so Insights stay cheap. Map: [observability-map.md](observability-map.md).

Optional on the integration (defaults are already on in current SDKs): `enableInp: true`, `enableLongTask: true`. Do not also set `interactionsSampleRate: 1` on top of a high `tracesSampleRate`.

Name transactions. Dynamic ids in the path (`/orders/12345`) explode cardinality. Normalize in `beforeStartSpan` (see the React example) or use the router integration so spans are `/orders/:id`.

`tracePropagationTargets` should list **your API origin**, not the open web. Over-broad targets attach `sentry-trace` headers to third parties.

## Sampler later (not day one)

When one flow is more important than the rest:

```ts
tracesSampler(samplingContext) {
  const name = samplingContext.name ?? "";
  if (name.includes("/checkout")) {
    return 0.2;
  }
  return 0.05;
}
```

Still cap the default at 0.05. A sampler that returns `1` on every navigation is `tracesSampleRate: 1.0` with extra steps.

LLM / agent spans inherit the **root** decision. Keep the SPA at 0.05; raise only the server route or `gen_ai.*` root that calls the model. Token breadcrumbs stay at 100%. Details: [ai-llm-monitoring.md](ai-llm-monitoring.md).
