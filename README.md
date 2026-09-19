# Sentry Golden Path

This repository proves a Staff-grade, production-safe Sentry setup for front-end apps, and teaches the official distinctions behind it: `sampleRate` (errors) vs `tracesSampleRate` vs `tracesSampler` + `inheritOrSampleWith`; on-device `beforeSend*` before data leaves the machine; field Web Vitals (RUM) vs Lighthouse lab; Golden Signals Errors + sampled Latency here, Traffic / Saturation on a metrics backend. The proof is runnable. If an example drifts above the caps or drops `beforeSend`, the build fails.

```bash
npm ci
npm test
```

`npm test` typechecks the copy-paste inits and runs `scripts/check.mjs` plus Staff-premise fixtures. A broken premise fails, including:

- `sampleRate` above 0.1 or `tracesSampleRate` above 0.05 in the examples
- session replay sampled on the happy path
- missing `beforeSend`, `maskPii`, or `sendDefaultPii: false`
- missing `captureDomainError` / `domain` + `flow` helpers
- a real Sentry DSN, or links to other Tiago repos

What the docs actually teach (cited, not invented): wizard / SDK `sampleRate: 1` and `tracesSampleRate: 1.0` are a demo; the [sampling-strategy post](https://blog.sentry.io/sampling-strategy-sentry/) uses `0.05` traces in production and replay-on-error as a flight recorder; `sendDefaultPii` is deprecated in favor of explicit `dataCollection` opt-outs; Sentry's Web Vitals page is initial page-load only and drops samples missing a required vital.

Maintainer: [Tiago Montanha](https://github.com/tiagovilasboas) · Staff · Observability

## Start

Copy [examples/react-init.ts](examples/react-init.ts) or [examples/vue-nuxt-init.ts](examples/vue-nuxt-init.ts). LLM/agent spans: [examples/agent-span.example.ts](examples/agent-span.example.ts). Replace placeholders only (`YOUR_ORG`, `your-app`, `https://oXXXX.ingest.sentry.io/...`). New repo checklist: [docs/golden-path.md](docs/golden-path.md#new-repo-sentry-ready-in-15-minutes).

## Contents

| Doc | Use when |
| --- | --- |
| [docs/golden-path.md](docs/golden-path.md) | Why Sentry vs metrics backends; create project → SDK → env → **production-only init**; source maps; 15-minute checklist |
| [docs/observability-map.md](docs/observability-map.md) | Golden Signals, RED/USE, front-end SLIs (error-free sessions, LCP/INP, critical flow), error budget as release policy |
| [docs/sampling.md](docs/sampling.md) | `sampleRate` vs `tracesSampleRate` vs `tracesSampler` + `inheritOrSampleWith`; wizard 1.0 vs prod; field Web Vitals |
| [docs/pii-and-filters.md](docs/pii-and-filters.md) | `beforeSend*` on-device, no PII in breadcrumbs, `sendDefaultPii` deprecated → `dataCollection` opt-outs |
| [docs/domain-tags.md](docs/domain-tags.md) | `domain` + `flow` tags with context; short-window dedup against cascade spam |
| [docs/ai-llm-monitoring.md](docs/ai-llm-monitoring.md) | LLM/agent `gen_ai.*` spans, prompts as PII, token/cost breadcrumbs, failure modes, sampling |

## Layout

```text
docs/                 golden path, observability map, sampling, PII, domain tags, AI/LLM
examples/             typed init + agent span helpers (placeholders only)
scripts/              Staff-premise check (`npm test`)
llms.txt              RAG pointer for coding agents
adapters/cursor/      optional Cursor rule; AGENTS.md stays source of truth
.github/              PR / issue templates + CI
```

## Official references

Cited in the docs. Not dependencies. This kit stays copy-pasteable.

- [Sentry sampling (JavaScript)](https://docs.sentry.io/platforms/javascript/sampling/)
- [A sampling strategy for Sentry](https://blog.sentry.io/sampling-strategy-sentry/)
- [Scrubbing sensitive data](https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/)
- [SDK options (`sendDefaultPii` / `dataCollection`)](https://docs.sentry.io/platforms/javascript/configuration/options/)
- [Sentry Web Vitals dashboard](https://docs.sentry.io/product/dashboards/sentry-dashboards/frontend/web-vitals/)
- [Web Vitals (web.dev)](https://web.dev/articles/vitals)
- [Golden Signals](https://sre.google/sre-book/monitoring-distributed-systems/) · [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
- [Sentry for React](https://docs.sentry.io/platforms/javascript/guides/react/) · [Vue](https://docs.sentry.io/platforms/javascript/guides/vue/) · [Nuxt](https://docs.sentry.io/platforms/javascript/guides/nuxt/) · [AI / agent tracing](https://docs.sentry.io/product/insights/ai/)

Optional background: [Observabilidade no frontend (DEV)](https://dev.to/tiagovilasboas/observabilidade-no-frontend-o-http-200-esconde-900-catch-vazios-53jd).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Agent notes: [AGENTS.md](AGENTS.md).

## License

MIT. See [LICENSE](LICENSE).
