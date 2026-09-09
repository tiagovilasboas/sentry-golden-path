/**
 * Manual gen_ai span helpers for the process that calls the model.
 * Copy next to a Node / worker instrument file. Browser SDKs do not patch OpenAI.
 *
 * Prompts stay off the span (`CAPTURE_PROMPTS = false`). Token counts go on the
 * span and on a breadcrumb so cost survives when the root trace is not sampled.
 *
 * Typed against @sentry/react already in this kit (same startSpan / breadcrumb API).
 * Official ops: https://docs.sentry.io/platforms/javascript/agent-tracing/
 */

import * as Sentry from "@sentry/react";

/** Golden-path default: never attach prompt or completion text to spans. */
export const CAPTURE_PROMPTS = false;

export const AGENT_SPAN_OPS = {
  invokeAgent: "gen_ai.invoke_agent",
  chat: "gen_ai.chat",
  executeTool: "gen_ai.execute_tool",
} as const;

export type AgentSpanOp = (typeof AGENT_SPAN_OPS)[keyof typeof AGENT_SPAN_OPS];

export type LlmProvider = "openai" | "anthropic" | "google" | "other";

export type DomainTag =
  | "checkout"
  | "auth"
  | "billing"
  | "search"
  | "account"
  | "other";

export type LlmFailureMode =
  | "timeout"
  | "rate_limit"
  | "context_overflow"
  | "tool_error"
  | "empty_completion"
  | "provider_error";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningOutputTokens?: number;
};

export type AgentRunTags = {
  domain: DomainTag;
  flow: string;
  agentName: string;
  model: string;
  provider: LlmProvider;
  conversationId?: string;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type ChatResult = {
  text: string;
  model: string;
  finishReason: string;
  usage: TokenUsage;
};

/** Repository / adapter contract. UI must not call the provider directly. */
export type LlmChatClient = {
  chat(input: { model: string; messages: ChatMessage[] }): Promise<ChatResult>;
};

export type AgentSpanAttributes = {
  "gen_ai.operation.name": string;
  "gen_ai.provider.name": LlmProvider;
  "gen_ai.request.model": string;
  "gen_ai.agent.name"?: string;
  "gen_ai.tool.name"?: string;
  "gen_ai.conversation.id"?: string;
};

const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function assertConversationId(id: string): string {
  if (!CONVERSATION_ID_PATTERN.test(id)) {
    throw new Error("conversation id must be opaque (alphanumeric, dash, underscore)");
  }
  return id;
}

export function validateTokenUsage(usage: TokenUsage): TokenUsage {
  if (
    usage.cachedInputTokens !== undefined &&
    usage.cachedInputTokens > usage.inputTokens
  ) {
    throw new Error("cached input tokens are a subset of input_tokens");
  }
  if (
    usage.reasoningOutputTokens !== undefined &&
    usage.reasoningOutputTokens > usage.outputTokens
  ) {
    throw new Error("reasoning tokens are a subset of output_tokens");
  }
  return usage;
}

export function applyTokenUsage(
  span: { setAttribute(key: string, value: number): void },
  usage: TokenUsage,
): void {
  const safe = validateTokenUsage(usage);
  span.setAttribute("gen_ai.usage.input_tokens", safe.inputTokens);
  span.setAttribute("gen_ai.usage.output_tokens", safe.outputTokens);
  span.setAttribute("gen_ai.usage.total_tokens", safe.inputTokens + safe.outputTokens);
  if (safe.cachedInputTokens !== undefined) {
    span.setAttribute("gen_ai.usage.cache_read.input_tokens", safe.cachedInputTokens);
  }
  if (safe.reasoningOutputTokens !== undefined) {
    span.setAttribute("gen_ai.usage.reasoning.output_tokens", safe.reasoningOutputTokens);
  }
}

export function recordTokenBreadcrumb(tags: AgentRunTags, usage: TokenUsage): void {
  const safe = validateTokenUsage(usage);
  Sentry.addBreadcrumb({
    category: "gen_ai.usage",
    level: "info",
    message: `${tags.provider} ${tags.model}`,
    data: {
      domain: tags.domain,
      flow: tags.flow,
      agent: tags.agentName,
      provider: tags.provider,
      model: tags.model,
      input_tokens: safe.inputTokens,
      output_tokens: safe.outputTokens,
      cached_input_tokens: safe.cachedInputTokens,
      reasoning_output_tokens: safe.reasoningOutputTokens,
    },
  });
}

function startAttributes(tags: AgentRunTags, operation: string): AgentSpanAttributes {
  const attributes: AgentSpanAttributes = {
    "gen_ai.operation.name": operation,
    "gen_ai.provider.name": tags.provider,
    "gen_ai.request.model": tags.model,
    "gen_ai.agent.name": tags.agentName,
  };
  if (tags.conversationId) {
    attributes["gen_ai.conversation.id"] = assertConversationId(tags.conversationId);
  }
  return attributes;
}

export async function withInvokeAgent<T>(
  tags: AgentRunTags,
  run: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    {
      op: AGENT_SPAN_OPS.invokeAgent,
      name: `invoke_agent ${tags.agentName}`,
      attributes: startAttributes(tags, "invoke_agent"),
    },
    async () => run(),
  );
}

export async function withChatSpan(
  tags: AgentRunTags,
  client: LlmChatClient,
  messages: ChatMessage[],
): Promise<ChatResult> {
  return Sentry.startSpan(
    {
      op: AGENT_SPAN_OPS.chat,
      name: `chat ${tags.model}`,
      attributes: startAttributes(tags, "chat"),
    },
    async (span) => {
      const result = await client.chat({ model: tags.model, messages });
      span.setAttribute("gen_ai.response.model", result.model);
      span.setAttribute("gen_ai.response.finish_reasons", JSON.stringify([result.finishReason]));
      applyTokenUsage(span, result.usage);
      recordTokenBreadcrumb(tags, result.usage);
      // CAPTURE_PROMPTS stays false: do not set gen_ai.input.messages or output.messages.
      return result;
    },
  );
}

export async function withToolSpan<T>(
  tags: AgentRunTags,
  toolName: string,
  run: () => Promise<T>,
): Promise<T> {
  const attributes: AgentSpanAttributes = {
    ...startAttributes(tags, "execute_tool"),
    "gen_ai.tool.name": toolName,
  };
  return Sentry.startSpan(
    {
      op: AGENT_SPAN_OPS.executeTool,
      name: `execute_tool ${toolName}`,
      attributes,
    },
    async () => run(),
  );
}

export function captureLlmFailure(
  error: unknown,
  tags: AgentRunTags,
  mode: LlmFailureMode,
): void {
  Sentry.withScope((scope: Sentry.Scope) => {
    scope.setTag("domain", tags.domain);
    scope.setTag("flow", tags.flow);
    scope.setTag("gen_ai.failure", mode);
    scope.setTag("gen_ai.provider", tags.provider);
    scope.setTag("gen_ai.agent", tags.agentName);
    Sentry.captureException(error);
  });
}
