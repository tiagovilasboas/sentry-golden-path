# AI / LLM monitoring

Sentry AI / agent tracing is **spans on top of tracing**, not a second product you bolt onto the SPA. The model call lives on a **server** (Node, worker, queue). Browser SDKs do not patch OpenAI, Anthropic, or Vercel AI for you. Prompts and completions are user content: treat them as **PII** (GDPR/LGPD default), same as checkout fields in [pii-and-filters.md](pii-and-filters.md).

This kit stays conservative for the front end (`tracesSampleRate` ≤ 0.05). Do not raise the SPA rate to `1.0` “so AI shows up.” Instrument the process that calls the model. Copy [examples/agent-span.example.ts](../examples/agent-span.example.ts). Placeholders: `YOUR_ORG`, `your-app`.

Official surface: [Sentry AI / Insights](https://docs.sentry.io/product/insights/ai/) · [Agent tracing (JS)](https://docs.sentry.io/platforms/javascript/agent-tracing/) · [gen_ai attributes](https://getsentry.github.io/sentry-conventions/attributes/gen_ai/).

## Where it fits

| Layer | What to send | What not to send |
| --- | --- | --- |
| Front-end kit (this repo) | User-journey errors, sampled Web Vitals, `domain` / `flow` | Model calls, raw prompts, `tracesSampleRate: 1.0` |
| LLM / agent process | `gen_ai.*` spans, token breadcrumbs, failures with tags | Prompt/completion text unless a written PII review says yes |
| Metrics / logs | Token counts and cost on **every** call | Relying on sampled traces as the billing ledger |

An agent run is one span tree. Sampling is decided at the **root**; children inherit. Drop the root and you lose the whole run, not “5% of the tokens.”

## Span tree

```text
invoke_agent search-assistant     (gen_ai.invoke_agent)
├── chat gpt-4o-mini              (gen_ai.chat)
├── execute_tool retrieve_docs    (gen_ai.execute_tool)
└── chat gpt-4o-mini              (gen_ai.chat)
```

`gen_ai.invoke_agent` is the container. `gen_ai.chat` and `gen_ai.execute_tool` are children (siblings of each other). A standalone LLM call can be a `gen_ai.chat` with no agent parent. Other ops you may see: `gen_ai.embeddings`, `gen_ai.handoff`, `gen_ai.generate_content`.

Name spans so dashboards group: `{operation} {subject}` (`chat gpt-4o-mini`, `invoke_agent search-assistant`, `execute_tool retrieve_docs`). Set `gen_ai.operation.name` to the same operation (`chat`, `invoke_agent`, `execute_tool`). Pass the **raw provider model string** in `gen_ai.request.model` so cost lookup can resolve.

Attributes accept primitives only. Arrays and objects must be JSON strings.

## Prompts are sensitive

Default in this kit: **do not** set `gen_ai.input.messages`, `gen_ai.output.messages`, or `gen_ai.system_instructions`. The example exports `CAPTURE_PROMPTS = false`. Integration helpers that default `recordInputs` / `recordOutputs` to true are an AppSec decision, not a DX convenience.

If a later review turns capture on:

- Gate it (`dataCollection.genAI` or `recordInputs` / `recordOutputs`). Keep `sendDefaultPii: false`.
- Run the same `beforeSend` masks as the SPA ([pii-and-filters.md](pii-and-filters.md)).
- Keep system instructions out of the message array (`gen_ai.system_instructions` only).
- Extended thinking belongs in a `reasoning` part, never folded into `text`.
- Conversation titles are derived from the first user message. Empty input attributes mean Conversations stays empty. That is acceptable.

`gen_ai.conversation.id` must be a short opaque id (UUID or `conv_…`). Alphanumeric plus `-` / `_` only. Sentry uses it as a URL path segment; a slash or email breaks Conversations. Do not put order ids, emails, or prompt text in that field.

## Token and cost breadcrumbs

Sentry estimates cost from **model name + token counts** (pricing tables, not `gen_ai.cost.*` that you invent). You do not set dollar attributes. You set:

| Attribute | Meaning |
| --- | --- |
| `gen_ai.usage.input_tokens` | Total input, **including** cached |
| `gen_ai.usage.cache_read.input_tokens` | Cached subset of input (not an extra bucket) |
| `gen_ai.usage.cache_creation.input_tokens` | Cache-write subset of input |
| `gen_ai.usage.output_tokens` | Total output, **including** reasoning |
| `gen_ai.usage.reasoning.output_tokens` | Reasoning subset of output |
| `gen_ai.usage.total_tokens` | `input + output` |

Cached and reasoning counts are **subsets**. If `cache_read` > `input_tokens`, Sentry subtracts past zero and shows a **negative cost**. Same for reasoning vs output. Summing parent `invoke_agent` totals with child `chat` totals double-counts; filter to the client spans when you aggregate.

Traces drop. Breadcrumbs and structured logs do not follow `tracesSampleRate`. On **every** model call, emit a breadcrumb (see `recordTokenBreadcrumb` in the example) with model, provider, token integers, and no prompt text. Log the same fields next to `release` and `trace_id` when a trace exists ([observability-map.md](observability-map.md)). That is how you keep a cost ledger when the agent root was not sampled.

## Failure modes

Tag `domain` + `flow` at the call site ([domain-tags.md](domain-tags.md)). Add `gen_ai.failure` so Issues search matches how the model actually died. Capture with `withScope`, not a bare `captureException`.

| Mode | Typical signal | What to record |
| --- | --- | --- |
| `timeout` | Abort / gateway deadline | Duration, model, no body |
| `rate_limit` | HTTP 429, `retry-after` | Status, provider; not the prompt |
| `context_overflow` | Token / context-length error | Token counts if known |
| `tool_error` | Tool threw or schema mismatch | `gen_ai.tool.name`, not tool args if they hold PII |
| `empty_completion` | No text, `finish_reason=length` | Finish reason, token counts |
| `provider_error` | 5xx, auth, unknown SDK throw | Status / error type |

Do not put the rejected prompt on the event “for replay.” If you need correlation, hash **server-side** and send the hash.

Streaming: set token attributes **after** the stream completes. OpenAI needs usage on the stream (`stream_options.include_usage` or equivalent). Vercel AI SDK needs `experimental_telemetry: { isEnabled: true }` per call. Missing usage is a silent zero cost, not a thrown error.

## Sampling notes

The front-end golden path does **not** change: `sampleRate` ≤ 0.1, `tracesSampleRate` ≤ 0.05, session replay 0, replay on error only ([sampling.md](sampling.md)).

AI spans inherit the root decision:

1. **Agent is the root** (cron, queue consumer, CLI). `tracesSampler` sees `gen_ai.*` and can return `1.0` for that op only.
2. **Agent hangs off an HTTP transaction** (typical API). The sampler already ran for the request. Keep the **LLM-serving route** at `1.0` in the sampler; leave `/health` and the SPA at 0.05.
3. **AI is the whole product** and you can afford it. Then `tracesSampleRate: 1.0` on that **server** project, with a written budget. Still not on the browser project.

```ts
tracesSampler(samplingContext) {
  const op = samplingContext.attributes?.["sentry.op"] ?? "";
  const name = samplingContext.name ?? "";
  if (String(op).startsWith("gen_ai.") || name.includes("/agent/")) {
    return 1;
  }
  return 0.05;
}
```

A sampler that returns `1` for every request is `tracesSampleRate: 1.0` with extra steps. Document the budget in the PR that raises the constant.

When 100% agent traces are not affordable, keep token breadcrumbs and JSON logs at 100%. You will under-count latency shape; you should not under-count spend.

## Auto vs manual

Node / Python / Laravel can auto-patch supported clients (OpenAI, Anthropic, Vercel AI, LangChain, Google GenAI, …) when the SDK is new enough and the runtime is patchable. **Browser and workerd are not patchable** at import time. Manual `startSpan` (this example) is the portable pattern and the only one this front-end kit typechecks.

Do not call the model from the SPA to “get spans.” Put the LLM client behind a small repository / adapter (`LlmChatClient` in the example). The UI captures user-journey errors; the adapter records `gen_ai.*`.

## Map to this golden path

| Topic | In this kit |
| --- | --- |
| Span ops and token subsets | [examples/agent-span.example.ts](../examples/agent-span.example.ts) |
| PII / fail closed | [pii-and-filters.md](pii-and-filters.md), `CAPTURE_PROMPTS = false` |
| `domain` / `flow` + capture | [domain-tags.md](domain-tags.md) |
| SPA sample rates | [sampling.md](sampling.md) |
| Correlation (`release`, `trace_id`) | [observability-map.md](observability-map.md) |
| Production-only init | [golden-path.md](golden-path.md) |
