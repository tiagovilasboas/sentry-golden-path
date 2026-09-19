/**
 * Staff premises for this kit. Keep examples conservative and copy-pasteable.
 * The CLI (`scripts/check.mjs`) applies these to the repo; unit tests apply
 * them to fixtures so a broken premise fails even when the tree is green.
 */

export const ERROR_SAMPLE_CAP = 0.1;
export const TRACES_SAMPLE_CAP = 0.05;
export const REPLAY_SESSION_CAP = 0;

export const SIBLING_REPO_NAMES = [
  "awesome-agentic-ai",
  "agent-measurement",
  "agentic-code-review",
  "jarvis-architecture",
];

const FIRM_IP = [
  /\bCogna\b/i,
  /\bVoomp\b/i,
  /\bGreenn\b/i,
  /Variable Group/i,
  /confluence\.(atlassian|com)/i,
];

const LLMS_POINTERS = [
  "docs/golden-path.md",
  "docs/observability-map.md",
  "docs/ai-llm-monitoring.md",
  "examples/agent-span.example.ts",
];

/**
 * @param {string} source
 * @returns {string}
 */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * @param {string} text
 * @returns {number}
 */
export function lineCountWithoutTrailingNl(text) {
  const lines = text.split(/\r?\n/);
  return lines.length > 0 && lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
}

/**
 * @param {string} source
 * @param {string} name
 * @returns {{ value: number, raw: string }[]}
 */
export function findNumericAssignments(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![A-Za-z0-9_])${escaped}\\s*[:=]\\s*([0-9][0-9_]*\\.?[0-9]*)`, "g");
  const hits = [];
  for (const match of source.matchAll(re)) {
    const raw = match[1];
    const value = Number(raw.replace(/_/g, ""));
    if (Number.isFinite(value)) {
      hits.push({ value, raw });
    }
  }
  return hits;
}

/**
 * @param {string} rel
 * @param {string} source
 * @returns {string[]}
 */
export function collectFirmIpErrors(rel, source) {
  const errors = [];
  for (const pattern of FIRM_IP) {
    if (pattern.test(source)) {
      errors.push(`${rel}: forbidden firm-IP pattern ${pattern}`);
    }
  }
  return errors;
}

/**
 * @param {string} rel
 * @param {string} source
 * @returns {string[]}
 */
export function collectNumericIngestErrors(rel, source) {
  const hits = source.match(/o\d+\.ingest\.sentry\.io/g) ?? [];
  if (hits.length === 0) {
    return [];
  }
  return [`${rel}: numeric Sentry ingest host (use oXXXX placeholder): ${hits.join(", ")}`];
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function collectAgentsMdErrors(source) {
  const errors = [];
  const lines = lineCountWithoutTrailingNl(source);
  if (lines > 80) {
    errors.push(`AGENTS.md is ${lines} lines; source of truth must stay ≤ 80.`);
  }
  return errors;
}

/**
 * Shape rules that already existed: title, Start/Contents/Layout, no Purpose.
 * @param {string} source
 * @returns {string[]}
 */
export function collectReadmeShapeErrors(source) {
  const errors = [];
  if (/^##\s+Purpose\b/m.test(source) || /^##\s+Propósito\b/m.test(source)) {
    errors.push("README.md must not contain a Purpose / Propósito section.");
  }
  if (!/^# Sentry Golden Path/m.test(source)) {
    errors.push("README.md must start with the Staff title.");
  }
  if (!/## Start/.test(source) || !/## Contents/.test(source) || !/## Layout/.test(source)) {
    errors.push("README.md must include Start, Contents, and Layout.");
  }
  if (!/docs\/ai-llm-monitoring\.md/.test(source)) {
    errors.push("README.md must link docs/ai-llm-monitoring.md.");
  }
  if (/—/.test(source)) {
    errors.push("README.md must not use an em dash.");
  }
  return errors;
}

/**
 * Standalone contract: lead with proof + npm test, official refs, no sibling farm.
 * @param {string} source
 * @returns {string[]}
 */
export function collectReadmeStandaloneErrors(source) {
  const errors = [];
  const lead = source.split(/## Contents/)[0] ?? source;
  if (!/\bproves\b/i.test(lead)) {
    errors.push("README.md must lead with what this repo proves.");
  }
  if (!/npm ci/.test(lead) || !/npm test/.test(lead)) {
    errors.push("README.md must lead with npm ci and npm test before Contents.");
  }
  if (!/docs\.sentry\.io\/platforms\/javascript\/sampling/.test(source)) {
    errors.push("README.md must cite official Sentry JavaScript sampling docs.");
  }
  if (!/blog\.sentry\.io\/sampling-strategy-sentry/.test(source)) {
    errors.push("README.md must cite the Sentry sampling strategy article.");
  }
  if (!/web\.dev\/articles\/vitals/.test(source)) {
    errors.push("README.md must cite Web Vitals.");
  }
  if (!/data-management\/sensitive-data/.test(source)) {
    errors.push("README.md must cite official sensitive-data docs.");
  }
  if (!/sre\.google\/sre-book\/service-level-objectives/.test(source)) {
    errors.push("README.md must cite the SRE SLO chapter.");
  }
  if (!/inheritOrSampleWith/.test(source)) {
    errors.push("README.md must mention inheritOrSampleWith.");
  }
  errors.push(...collectSiblingFarmErrors("README.md", source));
  return errors;
}

/**
 * @param {string} rel
 * @param {string} source
 * @returns {string[]}
 */
export function collectSiblingFarmErrors(rel, source) {
  const errors = [];
  for (const name of SIBLING_REPO_NAMES) {
    if (source.includes(name)) {
      errors.push(`${rel}: sibling farm link ${name} (this kit stands alone).`);
    }
  }
  const repoLinks = source.match(/github\.com\/tiagovilasboas\/[A-Za-z0-9_.-]+/g) ?? [];
  for (const link of repoLinks) {
    errors.push(`${rel}: link to another tiagovilasboas repo (${link}).`);
  }
  return errors;
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function collectLlmsTxtErrors(source) {
  const errors = [];
  for (const needle of LLMS_POINTERS) {
    if (!source.includes(needle)) {
      errors.push(`llms.txt must point at ${needle}.`);
    }
  }
  return errors;
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function collectObservabilityMapErrors(source) {
  const errors = [];
  if (!/ai-llm-monitoring\.md/.test(source)) {
    errors.push("docs/observability-map.md must link ai-llm-monitoring.md.");
  }
  if (!/sre\.google\/sre-book\/monitoring-distributed-systems/.test(source)) {
    errors.push("docs/observability-map.md must cite Golden Signals.");
  }
  if (!/sre\.google\/sre-book\/service-level-objectives/.test(source)) {
    errors.push("docs/observability-map.md must cite the SRE SLO chapter.");
  }
  if (!/error-free sessions/i.test(source) || !/critical flow/i.test(source)) {
    errors.push("docs/observability-map.md must teach front-end SLI shapes.");
  }
  if (!/error budget/i.test(source) || !/release policy/.test(source)) {
    errors.push("docs/observability-map.md must teach error budget as release policy.");
  }
  return errors;
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function collectSamplingDocErrors(source) {
  const errors = [];
  if (!/\*\*0\.1\*\*/.test(source) || !/\*\*0\.05\*\*/.test(source)) {
    errors.push("docs/sampling.md must state conservative caps 0.1 and 0.05.");
  }
  if (!/replaysSessionSampleRate/.test(source) || !/\*\*0\*\*/.test(source)) {
    errors.push("docs/sampling.md must default session replay to 0.");
  }
  if (!/\bLCP\b/.test(source) || !/\bINP\b/.test(source) || !/\bCLS\b/.test(source)) {
    errors.push("docs/sampling.md must mention Web Vitals LCP / INP / CLS.");
  }
  if (!/tracesSampler/.test(source) || !/inheritOrSampleWith/.test(source)) {
    errors.push("docs/sampling.md must teach tracesSampler and inheritOrSampleWith.");
  }
  if (!/docs\.sentry\.io\/platforms\/javascript\/sampling/.test(source)) {
    errors.push("docs/sampling.md must cite official Sentry JavaScript sampling docs.");
  }
  if (!/blog\.sentry\.io\/sampling-strategy-sentry/.test(source)) {
    errors.push("docs/sampling.md must cite the Sentry sampling strategy article.");
  }
  if (!/web\.dev\/articles\/vitals/.test(source)) {
    errors.push("docs/sampling.md must cite Web Vitals (web.dev).");
  }
  if (!/product\/dashboards\/sentry-dashboards\/frontend\/web-vitals/.test(source)) {
    errors.push("docs/sampling.md must cite the Sentry Web Vitals dashboard.");
  }
  if (!/initial page-load/.test(source) || !/missing a required vital/.test(source)) {
    errors.push("docs/sampling.md must teach initial page-load scope and dropped samples.");
  }
  return errors;
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function collectPiiDocErrors(source) {
  const errors = [];
  if (!/beforeSend/.test(source)) {
    errors.push("docs/pii-and-filters.md must document beforeSend.");
  }
  if (!/sendDefaultPii/.test(source)) {
    errors.push("docs/pii-and-filters.md must document sendDefaultPii.");
  }
  if (!/dataCollection/.test(source) || !/deprecated/.test(source)) {
    errors.push("docs/pii-and-filters.md must teach sendDefaultPii deprecated → dataCollection.");
  }
  if (!/beforeSendSpan/.test(source)) {
    errors.push("docs/pii-and-filters.md must document beforeSend* hooks (beforeSendSpan).");
  }
  if (!/breadcrumb/i.test(source)) {
    errors.push("docs/pii-and-filters.md must warn against logging PII into breadcrumbs.");
  }
  if (!/sensitive-data/.test(source)) {
    errors.push("docs/pii-and-filters.md must cite official sensitive-data docs.");
  }
  if (!/ignoreErrors/.test(source) || !/denyUrls/.test(source)) {
    errors.push("docs/pii-and-filters.md must document ignoreErrors and denyUrls.");
  }
  return errors;
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function collectDomainDocErrors(source) {
  const errors = [];
  if (!/`domain`/.test(source) || !/`flow`/.test(source)) {
    errors.push("docs/domain-tags.md must document domain and flow tags.");
  }
  if (!/shouldDropDuplicate/.test(source)) {
    errors.push("docs/domain-tags.md must point at shouldDropDuplicate.");
  }
  if (!/withScope/.test(source)) {
    errors.push("docs/domain-tags.md must show withScope capture.");
  }
  return errors;
}

/**
 * @param {string} rel
 * @param {string} source
 * @param {{ max: number, label: string }} cap
 * @param {string[]} names
 * @returns {string[]}
 */
function collectRateCapErrors(rel, source, cap, names) {
  const errors = [];
  const scanned = stripComments(source);
  for (const name of names) {
    for (const hit of findNumericAssignments(scanned, name)) {
      if (hit.value > cap.max) {
        errors.push(
          `${rel}: ${name}=${hit.raw} exceeds conservative ${cap.label} cap ${cap.max}.`,
        );
      }
    }
  }
  return errors;
}

/**
 * Rate-cap scan used on copy-paste inits and on the sampling-over-cap anti-fixture.
 * @param {string} rel
 * @param {string} source
 * @returns {string[]}
 */
export function collectSamplingCapErrors(rel, source) {
  return [
    ...collectRateCapErrors(rel, source, { max: ERROR_SAMPLE_CAP, label: "sampleRate" }, [
      "ERROR_SAMPLE_RATE",
      "sampleRate",
    ]),
    ...collectRateCapErrors(rel, source, { max: TRACES_SAMPLE_CAP, label: "tracesSampleRate" }, [
      "TRACES_SAMPLE_RATE",
      "tracesSampleRate",
    ]),
    ...collectRateCapErrors(rel, source, { max: REPLAY_SESSION_CAP, label: "replaysSessionSampleRate" }, [
      "REPLAY_SESSION_SAMPLE_RATE",
      "replaysSessionSampleRate",
    ]),
  ];
}

/**
 * Copy-paste SPA inits must keep the Staff defaults the docs claim.
 * @param {string} rel
 * @param {string} source
 * @returns {string[]}
 */
export function collectInitExampleErrors(rel, source) {
  const errors = [];

  if (!/ERROR_SAMPLE_RATE = 0\.1/.test(source) || !/TRACES_SAMPLE_RATE = 0\.05/.test(source)) {
    errors.push(`${rel}: conservative sampleRate / tracesSampleRate constants missing.`);
  }
  if (!/REPLAY_SESSION_SAMPLE_RATE = 0/.test(source)) {
    errors.push(`${rel}: session replay must default to 0.`);
  }
  if (!/REPLAY_ON_ERROR_SAMPLE_RATE = 1/.test(source)) {
    errors.push(`${rel}: replay-on-error must default to 1.`);
  }

  errors.push(...collectSamplingCapErrors(rel, source));

  const required = [
    [/export function beforeSend\b/, "beforeSend helper missing"],
    [/export function maskPii\b/, "maskPii helper missing"],
    [/export function captureDomainError\b/, "domain tag helper captureDomainError missing"],
    [/export function shouldDropDuplicate\b/, "short-window dedup helper missing"],
    [/sendDefaultPii:\s*false/, "sendDefaultPii must be false"],
    [/Sentry\.init\([\s\S]*\bbeforeSend\b/, "Sentry.init must wire beforeSend"],
    [/import\.meta\.env\.PROD/, "production-only init gate missing"],
    [/browserTracingIntegration/, "browserTracingIntegration missing (Web Vitals)"],
    [/setTag\(\s*["']domain["']/, "domain tag helper missing"],
    [/setTag\(\s*["']flow["']/, "flow tag helper missing"],
    [/ignoreErrors\s*:/, "ignoreErrors missing"],
    [/denyUrls\s*:/, "denyUrls missing"],
    [/\[FILTERED_CARD\]/, "card PII mask missing"],
    [/\[FILTERED_EMAIL\]/, "email PII mask missing"],
    [/\[FILTERED_PHONE\]/, "phone PII mask missing"],
    [/\[FILTERED_DOCUMENT\]/, "document PII mask missing"],
    [/withScope/, "withScope capture missing"],
    [/dataCollection\s*:/, "dataCollection PII defaults missing"],
    [/userInfo:\s*false/, "dataCollection.userInfo must be false"],
  ];

  for (const [pattern, message] of required) {
    if (!pattern.test(source)) {
      errors.push(`${rel}: ${message}.`);
    }
  }

  if (/\bprofiles?(?:Session)?SampleRate\s*[:=]\s*[1-9]/.test(stripComments(source))) {
    errors.push(`${rel}: do not enable profiling by default.`);
  }

  const emailMask = source.indexOf(".replace(EMAIL_PATTERN");
  const phoneMask = source.indexOf(".replace(PHONE_PATTERN");
  const documentMask = source.indexOf(".replace(DOCUMENT_PATTERN");
  const cardMask = source.indexOf(".replace(CARD_PATTERN");
  if (emailMask >= 0 && phoneMask >= 0 && documentMask >= 0 && cardMask >= 0) {
    if (!(emailMask < phoneMask && phoneMask < documentMask && documentMask < cardMask)) {
      errors.push(
        `${rel}: maskPii must apply email, +phone, and separated documents before the generic card run.`,
      );
    }
  }

  return errors;
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function collectAgentExampleErrors(source) {
  const rel = "examples/agent-span.example.ts";
  const errors = [];
  if (!/AGENT_SPAN_OPS/.test(source)) {
    errors.push(`${rel}: AGENT_SPAN_OPS missing.`);
  }
  if (!/gen_ai\.invoke_agent/.test(source) || !/gen_ai\.chat/.test(source)) {
    errors.push(`${rel}: gen_ai.invoke_agent / gen_ai.chat ops missing.`);
  }
  if (!/CAPTURE_PROMPTS = false/.test(source)) {
    errors.push(`${rel}: prompts must default to not captured.`);
  }
  if (!/addBreadcrumb/.test(source) || !/recordTokenBreadcrumb/.test(source)) {
    errors.push(`${rel}: token/cost breadcrumb helper missing.`);
  }
  if (/tracesSampleRate:\s*1/.test(source)) {
    errors.push(`${rel}: do not ship tracesSampleRate 1.0 as a default.`);
  }
  if (/setAttribute\(\s*["']gen_ai\.(?:input|output)\.messages["']/.test(source)) {
    errors.push(`${rel}: do not attach prompt/completion message attributes.`);
  }
  if (!/setTag\(\s*["']domain["']/.test(source) || !/setTag\(\s*["']flow["']/.test(source)) {
    errors.push(`${rel}: LLM failure capture must tag domain and flow.`);
  }
  return errors;
}

/**
 * Strip the small TypeScript surface used in the copy-paste guard helpers.
 * @param {string} source
 * @returns {string}
 */
export function stripSimpleTs(source) {
  return source
    .replace(/\bexport\s+/g, "")
    .replace(/new Map<[^>]+>/g, "new Map")
    .replace(/\)\s*:\s*[A-Za-z][A-Za-z0-9_<>,\s|]*\s*\{/g, ") {")
    .replace(/\b([A-Za-z_]\w*)\s*:\s*[A-Za-z][A-Za-z0-9_]*(\[\])?(?=\s*[,)=])/g, "$1");
}

/**
 * @param {string} source
 * @param {number} openIndex
 * @returns {number}
 */
function matchingBraceEnd(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Load maskPii / shouldDropDuplicate from a copy-paste init so behavior is proven.
 * @param {string} source
 * @returns {{ maskPii: (value: string) => string, shouldDropDuplicate: (fingerprint: string, now?: number) => boolean, DEDUP_WINDOW_MS: number }}
 */
export function extractExampleGuards(source) {
  const start = source.indexOf("const DEDUP_WINDOW_MS");
  const fnAt = source.indexOf("export function shouldDropDuplicate");
  if (start < 0 || fnAt < 0) {
    throw new Error("example guards (DEDUP_WINDOW_MS / shouldDropDuplicate) missing");
  }
  const brace = source.indexOf("{", fnAt);
  const end = matchingBraceEnd(source, brace);
  if (end < 0) {
    throw new Error("shouldDropDuplicate body is unclosed");
  }
  const snippet = stripSimpleTs(source.slice(start, end + 1));
  const factory = new Function(`${snippet}\nreturn { maskPii, shouldDropDuplicate, DEDUP_WINDOW_MS };`);
  return factory();
}

/**
 * @param {string} rel
 * @param {string} source
 * @returns {string[]}
 */
export function collectGuardBehaviorErrors(rel, source) {
  const errors = [];
  let guards;
  try {
    guards = extractExampleGuards(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${rel}: cannot extract runnable guards (${message}).`];
  }

  const masked = guards.maskPii(
    "pay user@example.com card 4111111111111111 doc 123.456.789-09 phone +5511999998888",
  );
  if (!masked.includes("[FILTERED_EMAIL]")) {
    errors.push(`${rel}: maskPii must redact emails.`);
  }
  if (!masked.includes("[FILTERED_CARD]")) {
    errors.push(`${rel}: maskPii must redact payment cards.`);
  }
  if (!masked.includes("[FILTERED_DOCUMENT]")) {
    errors.push(`${rel}: maskPii must redact national documents.`);
  }
  if (!masked.includes("[FILTERED_PHONE]")) {
    errors.push(`${rel}: maskPii must redact phone numbers.`);
  }
  if (guards.maskPii("checkout failed") !== "checkout failed") {
    errors.push(`${rel}: maskPii must leave non-PII messages intact.`);
  }

  const first = guards.shouldDropDuplicate("checkout|pay|Error|boom", 1_000);
  const dup = guards.shouldDropDuplicate("checkout|pay|Error|boom", 1_000 + 1_000);
  const other = guards.shouldDropDuplicate("auth|login|Error|boom", 1_000 + 1_000);
  const later = guards.shouldDropDuplicate("checkout|pay|Error|boom", 1_000 + guards.DEDUP_WINDOW_MS + 1);
  if (first !== false) {
    errors.push(`${rel}: first error in a window must be kept.`);
  }
  if (dup !== true) {
    errors.push(`${rel}: duplicate inside the short window must be dropped.`);
  }
  if (other !== false) {
    errors.push(`${rel}: a different fingerprint must not be dropped as a duplicate.`);
  }
  if (later !== false) {
    errors.push(`${rel}: the same fingerprint after the TTL must be kept.`);
  }

  return errors;
}
