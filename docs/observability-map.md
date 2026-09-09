# Observability map

Staff vocabulary, mapped to this golden path. Sentry is the **user-journey** slice: errors plus **sampled** browser traces (Web Vitals). It is not a metrics warehouse, a log drain, or an SRE textbook. Placeholders: `YOUR_ORG`, `your-app`.

Rates already in the kit — [sampling.md](sampling.md) — are how **errors** and **latency** stay cheap: `sampleRate` ≤ 0.1, `tracesSampleRate` ≤ 0.05. That is Golden Signals / RED on the client, not 100% RUM.

## Three pillars — logs, metrics, traces

**Logs** are discrete events (a line, ideally JSON). **Metrics** are aggregations over time (counters, histograms). **Traces** are a tree of spans for one request or page load.

**Sentry helps:** errors (a specialized log of failures with stack + release) and traces/performance (pageload, navigation, fetch, INP). **Sentry does not:** replace Prometheus/CloudWatch/OTel metrics or your log store. Use those for fleet-wide traffic and saturation; use Sentry when a *user* broke.

## Golden Signals (Google SRE)

[Four signals](https://sre.google/sre-book/monitoring-distributed-systems/) for a user-facing system: **Latency**, **Traffic**, **Errors**, **Saturation**.

**Sentry helps:** **Errors** (Issues) and **Latency** (sampled Web Vitals: LCP / INP / CLS, plus span duration). Conservative `tracesSampleRate` is enough to see latency *shape*; it is not a traffic counter. **Sentry does not:** **Traffic** (RPS, sessions as a capacity number) or **Saturation** (CPU, RAM, queue depth, thread pool). Those belong on a metrics backend.

## RED method

[RED](https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/) — **Rate**, **Errors**, **Duration** — is Golden Signals for request-driven APIs.

**Sentry helps:** **Errors** on the client (and server SDK if you add it) and **Duration** of sampled `pageload` / `navigation` / HTTP spans. **Sentry does not:** **Rate** as “requests per second for `your-app`.” A 5% trace sample is a latency histogram, not a billing-grade RPS.

## USE method

[USE](https://www.brendangregg.com/usemethod.html) — **Utilization**, **Saturation**, **Errors** — is for **resources** (CPU, disk, nic).

**Sentry helps:** almost nothing here, except application **Errors** that *result from* saturation (timeouts, 503 pages). **Sentry does not:** tell you a node is 90% busy. Keep USE on infra metrics.

## SLI / SLO / SLA

An **SLI** is a measured ratio (e.g. share of checkouts that finish without a JS exception, or LCP p75 under 2.5s). An **SLO** is the target you commit to internally. An **SLA** is the contractual wrapper (credits, legal) — usually a subset of SLOs.

**Sentry helps:** evidence for *user-visible* SLIs (issue rate by `release` / `domain` / `flow`, sampled vital percentiles). **Sentry does not:** replace SLO math or SLA legal text. Do not treat `sampleRate` 0.1 as “90% of users are fine.”

## Error budget

**Error budget** is the SLO remainder: `1 − SLO` over a window. Spend it on change; freeze when it is gone.

**Sentry helps:** *consume* budget when Issues spike after `your-app@1.2.3`. **Sentry does not:** compute the budget. Wire burn alerts in the same place you version SLOs (see Observability as code). Sampling means you **under-count** rare errors — do not burn the budget off raw Sentry volume without correcting for `sampleRate`.

## Distributed tracing

A **trace** is one directed graph of **spans** (parent/child) across services or from browser to API. Sentry’s `browserTracingIntegration` starts a trace on pageload/navigation and can propagate `sentry-trace` / `baggage` to APIs in `tracePropagationTargets`.

**Sentry helps:** the front-end root and, if the API SDK is configured for the same `YOUR_ORG` / related projects, the join to server spans. **Sentry does not:** magically trace vendors you did not instrument. Keep targets narrow (`api.your-app.example`), not the open web.

## Correlation / context propagation

**Correlation** means the same incident is findable in two systems. Propagate **traceId** + **spanId** (W3C `traceparent` / Sentry `sentry-trace`). **requestId** / **correlationId** are extra opaque ids you own — useful in logs when a trace was not sampled.

**Sentry helps:** every event carries `release` and, when tracing is on, a trace context. Log `trace_id` (and `release`) next to the JSON line so a pager can jump Issues → logs. **Sentry does not:** ship your application logs. If `tracesSampleRate` is 0.05, **95% of requests have no Sentry trace** — still log `requestId`.

```json
{"level":"error","release":"your-app@1.2.3","trace_id":"<from sentry-trace>","domain":"checkout","flow":"pay","msg":"pay failed"}
```

## Structured logging (JSON) vs free text

**Structured logs** are fields (`level`, `release`, `trace_id`, `msg`). Free text is a sentence you grep until it breaks.

**Sentry helps:** error events are already structured (tags, extra, exception). Optional SDK logs are a Sentry product feature, not a substitute for the drain. **Sentry does not:** replace stdout JSON to Loki/ELK. Put PII rules in both places ([pii-and-filters.md](pii-and-filters.md)).

## Observability as code

Dashboards, alerts, SLOs, and this SDK init should live in **git** (`YOUR_ORG` / `your-app` as placeholders in Terraform/JSON, not click-ops only). Review sampling the same way you review alert thresholds.

**Sentry helps:** the golden-path files in this repo (init, rates, filters) *are* observability as code for the client. Sentry also has Terraform/API for projects and alerts. **Sentry does not:** version Grafana/Prometheus for you. Keep RED/USE boards next to the Sentry alert that pages on `domain:checkout`.

## Map to this golden path

| Vocabulary | In this kit |
| --- | --- |
| Golden Signals **Errors** / RED **Errors** | `sampleRate` ≤ 0.1, Issues, `domain` / `flow` tags |
| Golden Signals **Latency** / RED **Duration** | `tracesSampleRate` ≤ 0.05, `browserTracingIntegration`, LCP / INP / CLS |
| Golden Signals **Traffic** / RED **Rate** | Not Sentry — metrics backend |
| USE / Saturation | Not Sentry — infra metrics |
| Error budget | Product of your SLO, not a Sentry toggle; correct for sampling |
| Correlation | Same `release` in `Sentry.init` and logs; `trace_id` when the request was sampled |

Init: [examples/react-init.ts](../examples/react-init.ts). Checklist: [golden-path.md](golden-path.md#new-repo-sentry-ready-in-15-minutes).
