# Golden path

Sentry is for **user-journey failures**: an unhandled exception on checkout, a white screen after navigation, a broken interaction that the browser actually threw. Metrics backends (Prometheus, CloudWatch, OpenTelemetry metrics) answer **server health**: saturation, error *rate* on a scrape, p99 of a handler. You need both. Sentry does not replace RED/USE dashboards; dashboards do not give you the release, the stack, the replay-on-error, or the `domain`/`flow` of the click that broke. Vocabulary (Golden Signals, SLI/SLO, error budget, correlation): [observability-map.md](observability-map.md).

This guide is conservative on purpose. The JS SDK **defaults `sampleRate` to `1`** (every error). First-run / wizard snippets often also set `tracesSampleRate: 1.0` and a non-zero session replay. The [sampling docs](https://docs.sentry.io/platforms/javascript/sampling/) and the [sampling-strategy post](https://blog.sentry.io/sampling-strategy-sentry/) treat that as “see everything while you learn,” then tighten: errors stay high-signal, traces go conservative (the blog’s production example is `0.05`), session replay stays low, replay-on-error stays high. **`1.0` is a demo, not a production default on a busy SPA.** Start low; raise with a budget. See [sampling.md](sampling.md).

## 1. Create a Sentry project

1. In [sentry.io](https://sentry.io) (or your self-hosted instance), create a project for the **front-end** app. Platform: React, Vue, or Nuxt — pick the SDK you will actually install.
2. Copy the DSN. Treat it as a **public ingest URL**, not a secret that authorizes reads, but still do not paste real values into this repo or into screenshots you publish.
3. Note the **project slug** shown in Settings → Projects. Source-map uploads fail silently when `SENTRY_PROJECT` is the git repo name instead of this slug.

Placeholders used everywhere below:

| Slot | Example |
| --- | --- |
| Org slug | `YOUR_ORG` |
| Project slug | `your-app` |
| DSN | `https://oXXXX.ingest.sentry.io/...` |
| Release | `your-app@1.2.3` or `your-app@git-<sha>` |

## 2. Install the SDK

React SPA:

```bash
npm install @sentry/react
```

Vue 3 SPA:

```bash
npm install @sentry/vue
```

Nuxt 3/4: prefer `@sentry/nuxt` and the official module. The client `init` options in [examples/vue-nuxt-init.ts](../examples/vue-nuxt-init.ts) still apply (sampling, PII, tags).

Init **before** the app mounts. In Vite, import the instrument file first in `main.ts`:

```ts
import "./instrument";
import { createRoot } from "react-dom/client";
```

## 3. Environment variables

Browser bundles only see variables your bundler exposes. Server-side upload tokens never go in `VITE_*` / `NUXT_PUBLIC_*`.

| Concern | Browser (public) | CI / build (private) |
| --- | --- | --- |
| DSN | `VITE_SENTRY_DSN` or `NUXT_PUBLIC_SENTRY_DSN` | — |
| Release name | `VITE_APP_RELEASE` (injected at build) | `SENTRY_RELEASE` (must match) |
| Org / project slug | — | `SENTRY_ORG`, `SENTRY_PROJECT` |
| Auth token (source maps) | — | `SENTRY_AUTH_TOKEN` |

Do not put the auth token in the client bundle. Do not commit `.env` files with real values.

## 4. Production-only init

Local and ephemeral preview deploys generate noise you will mute for a week and then ignore forever. Gate on the production build:

```ts
if (import.meta.env.PROD) {
  initSentry();
}
```

If you must test ingest, use a **separate** Sentry project (`your-app-dev`) and still keep sample rates low. Do not point production DSN at `localhost`.

Full init: [examples/react-init.ts](../examples/react-init.ts). Conservative rates, `sendDefaultPii: false` plus explicit `dataCollection` opt-outs (`sendDefaultPii` is [deprecated](https://docs.sentry.io/platforms/javascript/configuration/options/); passing `dataCollection` opts you into permissive defaults unless you opt out), replay on error only, `beforeSend` masking **before the event leaves the device**, `ignoreErrors` / `denyUrls`, and `withScope` tags live there so this page stays a map. When the API is also instrumented, replace the static `tracesSampleRate` with `tracesSampler` + `inheritOrSampleWith` ([sampling.md](sampling.md)).

## 5. Source maps and release naming

Readable production stacks need three strings to agree:

1. `Sentry.init({ release })` in the browser.
2. `sentryVitePlugin({ org, project, release: { name } })` (or webpack/cli equivalent) at **build** time.
3. The Sentry **project slug** (`SENTRY_PROJECT=your-app`), not `github.com/YOU/your-app`.

Pitfalls that produce `~minified~` frames or empty Releases:

| Mistake | What you see |
| --- | --- |
| `project: "Your App"` or the git repo name | Upload 404 / maps land on the wrong project |
| `release` omitted in `init` but set in the plugin | Events have no release; maps never attach |
| Plugin `release.name` ≠ SDK `release` | Maps uploaded, events unmapped |
| `sourcemap: false` | Nothing to upload |
| Auth token missing in CI | Build succeeds; Sentry has no artifacts |
| Uploading maps to org A, events to org B | Permanent mismatch |

Vite sketch (CI secrets only):

```ts
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default {
  build: { sourcemap: "hidden" },
  plugins: [
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,       // YOUR_ORG
      project: process.env.SENTRY_PROJECT, // your-app
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: process.env.SENTRY_RELEASE }, // your-app@1.2.3
      sourcemaps: { filesToDeleteAfterUpload: ["**/*.map"] },
    }),
  ],
};
```

`hidden` generates maps for upload without serving them to the browser. Delete `*.map` after upload so you do not publish sources.

## 6. Optional: AI / LLM monitoring

If the app calls a model **on the server**, attach `gen_ai.*` spans there (token usage, agent runs, tool calls). Browser SDKs do not patch OpenAI. Prompts are PII. Do not raise the SPA `tracesSampleRate` to `1.0` to “see AI.”

Full notes (span tree, prompt policy, token/cost breadcrumbs, failure modes, `tracesSampler`): [ai-llm-monitoring.md](ai-llm-monitoring.md). Copy [examples/agent-span.example.ts](../examples/agent-span.example.ts). Product surface: [Sentry AI / Insights](https://docs.sentry.io/product/insights/ai/).

## New repo Sentry ready in 15 minutes

1. Create the Sentry project. Copy DSN and **project slug**. Put DSN in the production env only.
2. `npm install @sentry/react` (or `@sentry/vue` / `@sentry/nuxt`).
3. Copy [examples/react-init.ts](../examples/react-init.ts) to `src/instrument.ts`. Replace placeholders. Import it first in the entry file.
4. Confirm **production-only** gate. Confirm rates: `sampleRate` ≤ 0.1, `tracesSampleRate` ≤ 0.05, `replaysSessionSampleRate` 0, `replaysOnErrorSampleRate` 1.
5. Set `sendDefaultPii: false` and explicit `dataCollection` opt-outs (`userInfo: false`, `httpBodies: []` at minimum). Keep `beforeSend` + `ignoreErrors` / `denyUrls` from the example. Do not log PII that will become a breadcrumb.
6. Wire `domain` / `flow` at the call site ([domain-tags.md](domain-tags.md)). Do not throw-and-forget.
7. Add the source-map plugin. Set `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `SENTRY_RELEASE` in CI. Same `release` in `init`.
8. Deploy production. Trigger one **intentional** test error on a staging project first if you can; then a guarded prod probe.
9. In Sentry: Issues (event landed), Replays (on-error only), Performance / Traces (sparse **field** Web Vitals; the [Web Vitals page](https://docs.sentry.io/product/dashboards/sentry-dashboards/frontend/web-vitals/) is initial page-load only and drops samples missing a required vital), Releases (maps attached).
10. Stop. Do not raise sample rates, enable session replay, or add profiling until quota and alert noise are boring.
