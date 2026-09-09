# Contributing

This repository is a **Staff-grade golden path** for Sentry on the front end: copy-pasteable patterns with conservative, production-safe defaults. It is not a consultancy pitch and not a dump of vendor wizard defaults (`tracesSampleRate: 1.0`).

Read [AGENTS.md](AGENTS.md) before editing. Open a pull request against `main` — do not commit to `main`.

## What belongs here

- Generic best practice: SDK init, sampling, Web Vitals, source maps, tags, PII filters, short-window dedup, Staff observability vocabulary mapped to Sentry, manual `gen_ai.*` agent/LLM spans (no prompt capture by default).
- Placeholders only: `YOUR_ORG`, `your-app`, `https://oXXXX.ingest.sentry.io/...`.
- English for README, docs, templates, PR bodies, and commands in fences.

## What does not belong

- Firm IP: org names, real Sentry org/project IDs or DSNs, internal CI secret names, real product hostnames, wiki copy, seller IDs.
- A `Purpose` / `Propósito` section in the README.
- Session replay > 0 or trace sampling > 0.05 as a **default** without documenting the budget trade-off.
- Expanding AGENTS.md past **80 lines**. AGENTS.md is the source of truth for agents; Cursor files under `adapters/cursor/` stay thin pointers.

## Edit the guide

1. Change the relevant `docs/*.md` and/or `examples/*.ts`.
2. Keep examples typed. Public functions annotate return types. No `any`.
3. If you change conservative rates, update **both** the docs table and the example constants.
4. Run:

```bash
npm ci
npm test
```

`npm test` typechecks `examples/` (including `agent-span.example.ts`) and runs `scripts/check.mjs` (AGENTS.md length, forbidden strings, placeholder DSN shape, `llms.txt` pointers, agent-span invariants).

## Pull requests

Use [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md). One concern per PR (docs vs example vs CI). Title format: `Add …` / `Fix: …` / `Docs: …`.

To discuss first, open an issue with [.github/ISSUE_TEMPLATE/improve-guide.yml](.github/ISSUE_TEMPLATE/improve-guide.yml).
