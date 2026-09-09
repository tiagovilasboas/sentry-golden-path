# Agent notes

Thin map for coding agents. Humans: [CONTRIBUTING.md](CONTRIBUTING.md). This repo is a **copy-paste guide**, not a Sentry product or a hosted DSN.

## Layout

```text
docs/golden-path.md      setup spine (project → SDK → prod-only init)
docs/sampling.md         conservative rates + Web Vitals
docs/pii-and-filters.md  beforeSend, ignoreErrors, denyUrls
docs/domain-tags.md      domain/flow tags + short-window dedup
examples/react-init.ts   React SPA (placeholders only)
examples/vue-nuxt-init.ts Vue 3 / Nuxt client (placeholders only)
adapters/cursor/         optional Cursor rule; AGENTS.md stays SoT
```

## Do

- Initialize Sentry in **production only**. Keep `sampleRate` ≤ 0.1 and `tracesSampleRate` ≤ 0.05 until quota is proven.
- Default session replay to **0**; replay **on error only**. Raise rates later with a budget, not a guess.
- Enable `browserTracingIntegration` for LCP / INP / CLS. Keep tracing sampled low.
- Tag `domain` and `flow` via `withScope` (or equivalent). Do not `captureException` bare.
- Mask PII in `beforeSend`. Set `sendDefaultPii: false`. Treat GDPR/LGPD as default, not an add-on.
- Match `release` in `Sentry.init` to the source-map upload `release.name`. Match `SENTRY_PROJECT` to the **Sentry project slug**, not the git repo name.
- Use placeholders: `YOUR_ORG`, `your-app`, `https://oXXXX.ingest.sentry.io/...`.

## Don't

- Do not commit real DSNs, org/project IDs, auth tokens, or product hostnames.
- Do not enable Sentry in local/dev by default (noise + quota).
- Do not ship `tracesSampleRate: 1.0` or session replay > 0 without a written budget.
- Do not paste firm-internal runbooks, Confluence, or Azure variable-group names here.
- Do not commit to `main`; open a PR.
