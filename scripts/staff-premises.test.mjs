import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  collectAgentExampleErrors,
  collectGuardBehaviorErrors,
  collectInitExampleErrors,
  collectReadmeShapeErrors,
  collectReadmeStandaloneErrors,
  collectSiblingFarmErrors,
  extractExampleGuards,
  findNumericAssignments,
} from "./lib/staff-premises.mjs";

const reactInit = readFileSync(new URL("../examples/react-init.ts", import.meta.url), "utf8");
const vueInit = readFileSync(new URL("../examples/vue-nuxt-init.ts", import.meta.url), "utf8");
const agentExample = readFileSync(new URL("../examples/agent-span.example.ts", import.meta.url), "utf8");

describe("findNumericAssignments", () => {
  it("does not treat tracesSampleRate as sampleRate", () => {
    const source = "tracesSampleRate: 0.05\nsampleRate: 0.1\n";
    assert.deepEqual(
      findNumericAssignments(source, "sampleRate").map((hit) => hit.value),
      [0.1],
    );
    assert.deepEqual(
      findNumericAssignments(source, "tracesSampleRate").map((hit) => hit.value),
      [0.05],
    );
  });
});

describe("copy-paste inits keep Staff premises", () => {
  for (const [rel, source] of [
    ["examples/react-init.ts", reactInit],
    ["examples/vue-nuxt-init.ts", vueInit],
  ]) {
    it(`${rel} passes the Staff init contract`, () => {
      assert.deepEqual(collectInitExampleErrors(rel, source), []);
      assert.deepEqual(collectGuardBehaviorErrors(rel, source), []);
    });
  }

  it("examples/agent-span.example.ts keeps prompts off the span", () => {
    assert.deepEqual(collectAgentExampleErrors(agentExample), []);
  });
});

describe("a broken Staff premise fails", () => {
  it("fails when error sampling exceeds 0.1", () => {
    const broken = reactInit.replace("ERROR_SAMPLE_RATE = 0.1", "ERROR_SAMPLE_RATE = 0.5");
    const errors = collectInitExampleErrors("examples/react-init.ts", broken);
    assert.ok(errors.some((line) => /ERROR_SAMPLE_RATE=0\.5/.test(line)));
  });

  it("fails when tracesSampleRate is shipped at 1.0", () => {
    const broken = reactInit.replace("tracesSampleRate: TRACES_SAMPLE_RATE", "tracesSampleRate: 1.0");
    const errors = collectInitExampleErrors("examples/react-init.ts", broken);
    assert.ok(errors.some((line) => /tracesSampleRate=1/.test(line)));
  });

  it("fails when session replay is sampled on the happy path", () => {
    const broken = reactInit.replace("REPLAY_SESSION_SAMPLE_RATE = 0", "REPLAY_SESSION_SAMPLE_RATE = 0.1");
    const errors = collectInitExampleErrors("examples/react-init.ts", broken);
    assert.ok(errors.some((line) => /REPLAY_SESSION_SAMPLE_RATE=0\.1/.test(line)));
  });

  it("fails when beforeSend is missing", () => {
    const broken = reactInit.replace("export function beforeSend", "export function afterSend");
    const errors = collectInitExampleErrors("examples/react-init.ts", broken);
    assert.ok(errors.some((line) => /beforeSend helper missing/.test(line)));
  });

  it("fails when sendDefaultPii is left on", () => {
    const broken = reactInit.replace("sendDefaultPii: false", "sendDefaultPii: true");
    const errors = collectInitExampleErrors("examples/react-init.ts", broken);
    assert.ok(errors.some((line) => /sendDefaultPii must be false/.test(line)));
  });

  it("fails when domain tag helpers are removed", () => {
    const broken = reactInit.replace("export function captureDomainError", "export function captureBareError");
    const errors = collectInitExampleErrors("examples/react-init.ts", broken);
    assert.ok(errors.some((line) => /captureDomainError/.test(line)));
  });

  it("fails when production-only init is dropped", () => {
    const broken = reactInit.replace("import.meta.env.PROD", "import.meta.env.DEV");
    const errors = collectInitExampleErrors("examples/react-init.ts", broken);
    assert.ok(errors.some((line) => /production-only/.test(line)));
  });

  it("fails when Web Vitals tracing is omitted", () => {
    const broken = reactInit.replaceAll("browserTracingIntegration", "httpClientIntegration");
    const errors = collectInitExampleErrors("examples/react-init.ts", broken);
    assert.ok(errors.some((line) => /browserTracingIntegration/.test(line)));
  });

  it("fails when the generic card run steals +phone matches", () => {
    const broken = reactInit.replace(
      `.replace(EMAIL_PATTERN, "[FILTERED_EMAIL]")
    .replace(PHONE_PATTERN, "[FILTERED_PHONE]")
    .replace(DOCUMENT_PATTERN, "[FILTERED_DOCUMENT]")
    .replace(CARD_PATTERN, "[FILTERED_CARD]")`,
      `.replace(CARD_PATTERN, "[FILTERED_CARD]")
    .replace(DOCUMENT_PATTERN, "[FILTERED_DOCUMENT]")
    .replace(PHONE_PATTERN, "[FILTERED_PHONE]")
    .replace(EMAIL_PATTERN, "[FILTERED_EMAIL]")`,
    );
    const errors = collectInitExampleErrors("examples/react-init.ts", broken);
    assert.ok(errors.some((line) => /before the generic card run/.test(line)));
  });
});

describe("extracted guards are runnable", () => {
  it("masks PII classes claimed by the docs", () => {
    const guards = extractExampleGuards(reactInit);
    const masked = guards.maskPii("mail user@host.com card 4111111111111111");
    assert.match(masked, /\[FILTERED_EMAIL\]/);
    assert.match(masked, /\[FILTERED_CARD\]/);
  });

  it("drops the same fingerprint inside the short window", () => {
    const guards = extractExampleGuards(vueInit);
    assert.equal(guards.shouldDropDuplicate("k", 0), false);
    assert.equal(guards.shouldDropDuplicate("k", 10), true);
    assert.equal(guards.shouldDropDuplicate("k", guards.DEDUP_WINDOW_MS + 1), false);
  });
});

describe("README standalone contract", () => {
  it("the real README leads with proof and has no sibling farm", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    assert.deepEqual(collectReadmeShapeErrors(readme), []);
    assert.deepEqual(collectReadmeStandaloneErrors(readme), []);
  });

  it("fails a sibling-farm README", () => {
    const farm = [
      "# Sentry Golden Path",
      "",
      "## Start",
      "## Contents",
      "## Layout",
      "docs/ai-llm-monitoring.md",
      "https://github.com/tiagovilasboas/awesome-agentic-ai",
    ].join("\n");
    const errors = [
      ...collectReadmeShapeErrors(farm),
      ...collectReadmeStandaloneErrors(farm),
      ...collectSiblingFarmErrors("README.md", farm),
    ];
    assert.ok(errors.some((line) => /sibling farm|another tiagovilasboas repo/.test(line)));
  });

  it("fails a README that does not lead with proof and npm test", () => {
    const thin = [
      "# Sentry Golden Path",
      "",
      "## Start",
      "## Contents",
      "## Layout",
      "docs/ai-llm-monitoring.md",
    ].join("\n");
    const errors = collectReadmeStandaloneErrors(thin);
    assert.ok(errors.some((line) => /proves/.test(line)));
    assert.ok(errors.some((line) => /npm ci/.test(line)));
  });
});
