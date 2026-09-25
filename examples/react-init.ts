/**
 * Copy-paste Sentry init for a React SPA (Vite or similar).
 * Placeholders only — never commit a real DSN.
 *
 * Import this module first in `main.tsx`, then call `initSentry()` once.
 *
 * Staff dials (docs/sampling.md, official JS sampling docs + sampling-strategy post):
 * - sampleRate = errors. SDK default is 1 (every error). This kit starts at 0.1.
 * - tracesSampleRate = uniform traces. Blog production example is 0.05. Wizard 1.0 is a demo.
 * - Prefer tracesSampler + inheritOrSampleWith once the API is also instrumented.
 * - replaysSessionSampleRate stays 0; replaysOnErrorSampleRate stays 1 (flight recorder).
 *
 * PII (docs/pii-and-filters.md): beforeSend scrubs on-device. Do not console.log PII
 * (it becomes a breadcrumb). sendDefaultPii is deprecated; dataCollection opt-outs
 * are the real control, and passing dataCollection opts you into permissive defaults.
 *
 * Official API: https://docs.sentry.io/platforms/javascript/guides/react/
 */

import * as Sentry from "@sentry/react";
import type { ErrorEvent, EventHint } from "@sentry/react";

/** Conservative production defaults. See docs/sampling.md. */
export const ERROR_SAMPLE_RATE = 0.1;
export const TRACES_SAMPLE_RATE = 0.05;
export const REPLAY_SESSION_SAMPLE_RATE = 0;
export const REPLAY_ON_ERROR_SAMPLE_RATE = 1;

/** Replace in your app. Do not use a real ingest host in this repo. */
export const PLACEHOLDER_DSN = "https://oXXXX.ingest.sentry.io/...";

export type DomainTag =
  | "checkout"
  | "auth"
  | "billing"
  | "search"
  | "account"
  | "other";

export type CaptureTags = {
  domain: DomainTag;
  flow: string;
};

const DEDUP_WINDOW_MS = 10_000;
const recentErrors = new Map<string, number>();

const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;
const DOCUMENT_PATTERN = /\b\d{3}[.\s-]\d{3}[.\s-]?\d{3}[.\s-]?\d{2}\b/g;
const RAW_CPF_PATTERN = /(?<!\d)\d{11}(?!\d)/g;
const PHONE_PATTERN = /\+\d[\d\s().-]{8,16}\d/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/** Raw 11-digit runs are masked only when the CPF mod-11 check digits hold. */
function maskRawCpf(digits: string): string {
  if (/^(\d)\1{10}$/.test(digits)) {
    return digits;
  }
  for (let length = 9; length < 11; length += 1) {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    if (((sum * 10) % 11) % 10 !== Number(digits[length])) {
      return digits;
    }
  }
  return "[FILTERED_DOCUMENT]";
}

export function maskPii(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[FILTERED_EMAIL]")
    .replace(PHONE_PATTERN, "[FILTERED_PHONE]")
    .replace(DOCUMENT_PATTERN, "[FILTERED_DOCUMENT]")
    .replace(CARD_PATTERN, "[FILTERED_CARD]")
    .replace(RAW_CPF_PATTERN, maskRawCpf);
}

export function shouldDropDuplicate(fingerprint: string, now = Date.now()): boolean {
  const last = recentErrors.get(fingerprint);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) {
    return true;
  }
  recentErrors.set(fingerprint, now);
  return false;
}

function fingerprintEvent(event: ErrorEvent, tags: CaptureTags | undefined): string {
  const exception = event.exception?.values?.[0];
  const message = exception?.value ?? event.message ?? "unknown";
  const type = exception?.type ?? "Error";
  const domain = tags?.domain ?? String(event.tags?.["domain"] ?? "");
  const flow = tags?.flow ?? String(event.tags?.["flow"] ?? "");
  return `${domain}|${flow}|${type}|${message}`;
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.message) {
    event.message = maskPii(event.message);
  }
  const values = event.exception?.values;
  if (values) {
    for (const item of values) {
      if (item.value) {
        item.value = maskPii(item.value);
      }
    }
  }
  if (event.request?.url) {
    event.request.url = maskPii(event.request.url);
  }
  if (event.request?.query_string && typeof event.request.query_string === "string") {
    event.request.query_string = maskPii(event.request.query_string);
  }
  return event;
}

/** Scrub on-device so PII never leaves the browser. Do not also console.log the raw string. */
export function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  const tagged: CaptureTags | undefined =
    typeof event.tags?.["domain"] === "string" && typeof event.tags?.["flow"] === "string"
      ? { domain: event.tags["domain"] as DomainTag, flow: event.tags["flow"] }
      : undefined;

  if (shouldDropDuplicate(fingerprintEvent(event, tagged))) {
    return null;
  }

  return scrubEvent(event);
}

export function captureDomainError(
  error: unknown,
  tags: CaptureTags,
  context?: Record<string, unknown>,
): void {
  Sentry.withScope((scope: Sentry.Scope) => {
    scope.setTag("domain", tags.domain);
    scope.setTag("flow", tags.flow);
    if (context) {
      scope.setContext(tags.domain, context);
    }
    Sentry.captureException(error);
  });
}

export type SentryPublicConfig = {
  dsn: string;
  release: string;
  environment: string;
};

export function readPublicConfig(): SentryPublicConfig | null {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || dsn.includes("oXXXX")) {
    return null;
  }

  return {
    dsn,
    release: import.meta.env.VITE_APP_RELEASE ?? "your-app@unknown",
    environment: import.meta.env.MODE,
  };
}

/**
 * Production-only init. No-op in local/dev and when the DSN is missing or a placeholder.
 */
export function initSentry(): boolean {
  if (!import.meta.env.PROD) {
    return false;
  }

  const config = readPublicConfig();
  if (!config) {
    return false;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    // sendDefaultPii is deprecated (removed in SDK v11). Keep false until then.
    // Passing dataCollection opts you into permissive defaults: opt out explicitly.
    sendDefaultPii: false,
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
    sampleRate: ERROR_SAMPLE_RATE,
    // Static 0.05 for day one. When the API samples too, switch to tracesSampler
    // and return inheritOrSampleWith(TRACES_SAMPLE_RATE) so traces stay joined.
    tracesSampleRate: TRACES_SAMPLE_RATE,
    replaysSessionSampleRate: REPLAY_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: REPLAY_ON_ERROR_SAMPLE_RATE,
    tracePropagationTargets: ["localhost", /^https:\/\/api\.your-app\.example\//],
    integrations: [
      // Field RUM (real users), not Lighthouse lab. Sentry's Web Vitals page is
      // initial page-load oriented; a load missing a required vital drops from samples.
      Sentry.browserTracingIntegration({
        enableInp: true,
        enableLongTask: true,
        beforeStartSpan: (spanContext) => {
          const raw = spanContext.name ?? "";
          return {
            ...spanContext,
            name: raw.replace(/\/\d+/g, "/:id"),
          };
        },
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    ignoreErrors: [
      "top.GLOBALS",
      "chrome-extension://",
      "ResizeObserver loop",
      /^Network Error$/i,
    ],
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
    ],
    beforeSend,
  });

  return true;
}
