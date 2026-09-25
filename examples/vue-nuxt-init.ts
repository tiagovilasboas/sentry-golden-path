/**
 * Copy-paste Sentry init for Vue 3 (and the Nuxt *client* equivalent).
 * Placeholders only — never commit a real DSN.
 *
 * Vue 3 SPA: call `initSentry({ app, router })` in `main.ts` before `app.mount`.
 * Nuxt: put the same `Sentry.init` options in `sentry.client.config.ts` via `@sentry/nuxt`.
 *
 * Staff dials (docs/sampling.md): sampleRate is errors (SDK default 1; kit starts
 * at 0.1). tracesSampleRate is uniform traces (blog production example 0.05).
 * Wizard 1.0 is a demo. Prefer tracesSampler + inheritOrSampleWith when the API
 * is instrumented. Replay: session 0, on-error 1.
 *
 * PII: beforeSend scrubs on-device. Do not log PII into breadcrumbs.
 * sendDefaultPii is deprecated; dataCollection must opt out explicitly.
 *
 * Official API: https://docs.sentry.io/platforms/javascript/guides/vue/
 */

import * as Sentry from "@sentry/vue";
import type { App } from "vue";
import type { ErrorEvent, EventHint } from "@sentry/vue";

/** Conservative production defaults. See docs/sampling.md. */
export const ERROR_SAMPLE_RATE = 0.1;
export const TRACES_SAMPLE_RATE = 0.05;
export const REPLAY_SESSION_SAMPLE_RATE = 0;
export const REPLAY_ON_ERROR_SAMPLE_RATE = 1;

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

/** Minimal vue-router surface expected by `@sentry/vue` (onError + beforeEach). */
export type VueRouterRouteLike = {
  path: string;
  query: Record<string, string | null | (string | null)[]>;
  name?: string | symbol | null;
  params: Record<string, string | string[]>;
  matched: { path: string }[];
};

export type VueRouterLike = {
  onError: (fn: (err: Error) => void) => void;
  beforeEach: (
    fn: (to: VueRouterRouteLike, from: VueRouterRouteLike, next?: () => void) => void,
  ) => void;
};

export type VueSentryInitOptions = {
  app: App;
  router?: VueRouterLike;
};

const DEDUP_WINDOW_MS = 10_000;
const recentErrors = new Map<string, number>();

const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;
const DOCUMENT_PATTERN = /(?<!\d)(?!\d{11})\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{2}(?!\d)/g;
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

function fingerprintEvent(event: ErrorEvent): string {
  const exception = event.exception?.values?.[0];
  const message = exception?.value ?? event.message ?? "unknown";
  const type = exception?.type ?? "Error";
  const domain = String(event.tags?.["domain"] ?? "");
  const flow = String(event.tags?.["flow"] ?? "");
  return `${domain}|${flow}|${type}|${message}`;
}

/** Scrub on-device so PII never leaves the browser. Do not also console.log the raw string. */
export function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (shouldDropDuplicate(fingerprintEvent(event))) {
    return null;
  }
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
  return event;
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

export function readPublicConfig(): { dsn: string; release: string; environment: string } | null {
  const dsn = import.meta.env.VITE_SENTRY_DSN ?? import.meta.env.NUXT_PUBLIC_SENTRY_DSN;
  if (!dsn || dsn.includes("oXXXX")) {
    return null;
  }

  return {
    dsn,
    release:
      import.meta.env.VITE_APP_RELEASE ??
      import.meta.env.NUXT_PUBLIC_SENTRY_RELEASE ??
      "your-app@unknown",
    environment: import.meta.env.MODE,
  };
}

/**
 * Production-only Vue 3 init. Pass the app instance (required by @sentry/vue).
 * For Nuxt, copy the `Sentry.init` options into `sentry.client.config.ts` instead of calling this.
 */
export function initSentry(options: VueSentryInitOptions): boolean {
  if (!import.meta.env.PROD) {
    return false;
  }

  const config = readPublicConfig();
  if (!config) {
    return false;
  }

  // Field RUM, not Lighthouse lab. Sentry's Web Vitals page is initial page-load only.
  const tracing = options.router
    ? Sentry.browserTracingIntegration({ router: options.router })
    : Sentry.browserTracingIntegration();

  Sentry.init({
    app: options.app,
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
      tracing,
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
