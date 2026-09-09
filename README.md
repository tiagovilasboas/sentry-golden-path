# Sentry Golden Path

Conservative, production-safe Sentry for front-end apps — user-journey errors, Web Vitals, low sample rates.

Maintainer: [Tiago Montanha](https://github.com/tiagovilasboas) · Staff · Agentic AI · AppSec · Observability

## Start

New repo Sentry-ready in 15 minutes: follow the checklist in [docs/golden-path.md](docs/golden-path.md#new-repo-sentry-ready-in-15-minutes). Copy [examples/react-init.ts](examples/react-init.ts) or [examples/vue-nuxt-init.ts](examples/vue-nuxt-init.ts). Replace placeholders only (`YOUR_ORG`, `your-app`, `https://oXXXX.ingest.sentry.io/...`).

```bash
npm ci
npm test
```

## Contents

| Doc | Use when |
| --- | --- |
| [docs/golden-path.md](docs/golden-path.md) | Why Sentry vs metrics backends; create project → SDK → env → **production-only init**; source maps; 15-minute checklist |
| [docs/sampling.md](docs/sampling.md) | Conservative defaults (`sampleRate` ≤ 0.1, `tracesSampleRate` ≤ 0.05, replay on error only); Web Vitals (LCP / INP / CLS); how to raise later |
| [docs/pii-and-filters.md](docs/pii-and-filters.md) | `beforeSend` masking, `ignoreErrors` / `denyUrls`, GDPR/LGPD-minded defaults |
| [docs/domain-tags.md](docs/domain-tags.md) | `domain` + `flow` tags with context; short-window dedup against cascade spam |

Official refs (not dependencies): [Sentry for React](https://docs.sentry.io/platforms/javascript/guides/react/) · [Sentry for Vue](https://docs.sentry.io/platforms/javascript/guides/vue/) · [Sentry for Nuxt](https://docs.sentry.io/platforms/javascript/guides/nuxt/) · [Web Vitals](https://web.dev/articles/vitals) · [Sentry AI / agent tracing](https://docs.sentry.io/product/insights/ai/)

## Layout

```text
docs/                 golden path, sampling, PII, domain tags
examples/             typed init patterns (placeholders only)
adapters/cursor/      optional Cursor rule; AGENTS.md stays source of truth
.github/              PR / issue templates + CI
```

## Related

This repo is a Sentry **golden path**. Siblings are scoped kits — not a hosted org, not proof these rates ran in production.

- [awesome-agentic-ai](https://github.com/tiagovilasboas/awesome-agentic-ai) — Curated short list: MCP · harness · agent security.
- [agent-measurement](https://github.com/tiagovilasboas/agent-measurement) — Eval harness: suites, named metrics, markdown reports.
- [agentic-code-review](https://github.com/tiagovilasboas/agentic-code-review) — AppSec PR review: `path:line` or silence.
- [jarvis-architecture](https://github.com/tiagovilasboas/jarvis-architecture) — Reference architecture: brain · workers · ops.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Agent notes: [AGENTS.md](AGENTS.md).

## License

MIT — see [LICENSE](LICENSE).
