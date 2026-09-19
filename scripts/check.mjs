#!/usr/bin/env node
/**
 * Repo hygiene + Staff premises: AGENTS.md length, README shape, no firm IP,
 * placeholder DSNs only, conservative sampling/PII/domain helpers in examples,
 * and runnable maskPii / short-window dedup behavior.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  collectAgentExampleErrors,
  collectAgentsMdErrors,
  collectDomainDocErrors,
  collectFirmIpErrors,
  collectGuardBehaviorErrors,
  collectInitExampleErrors,
  collectLlmsTxtErrors,
  collectNumericIngestErrors,
  collectObservabilityMapErrors,
  collectPiiDocErrors,
  collectReadmeShapeErrors,
  collectReadmeStandaloneErrors,
  collectSamplingDocErrors,
  collectSiblingFarmErrors,
  lineCountWithoutTrailingNl,
} from "./lib/staff-premises.mjs";

const root = process.cwd();
const errors = [];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") {
      continue;
    }
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function read(path) {
  return readFileSync(path, "utf8");
}

const agents = read(join(root, "AGENTS.md"));
errors.push(...collectAgentsMdErrors(agents));

const readme = read(join(root, "README.md"));
errors.push(...collectReadmeShapeErrors(readme));
errors.push(...collectReadmeStandaloneErrors(readme));

const textFiles = walk(root).filter((path) =>
  /\.(md|ts|mjs|yml|yaml|json|mdc|txt)$/.test(path) && !path.endsWith("package-lock.json"),
);

for (const file of textFiles) {
  const rel = relative(root, file);
  const skipPolicy = rel === "scripts/check.mjs" || rel.startsWith("scripts/lib/") || rel.endsWith(".test.mjs");
  const body = read(file);
  if (!skipPolicy) {
    errors.push(...collectFirmIpErrors(rel, body));
  }
  if (!rel.endsWith(".test.mjs")) {
    errors.push(...collectNumericIngestErrors(rel, body));
  }
  if ((rel.endsWith(".md") || rel === "llms.txt") && rel !== "README.md") {
    errors.push(...collectSiblingFarmErrors(rel, body));
  }
}

errors.push(...collectObservabilityMapErrors(read(join(root, "docs/observability-map.md"))));
errors.push(...collectSamplingDocErrors(read(join(root, "docs/sampling.md"))));
errors.push(...collectPiiDocErrors(read(join(root, "docs/pii-and-filters.md"))));
errors.push(...collectDomainDocErrors(read(join(root, "docs/domain-tags.md"))));
errors.push(...collectLlmsTxtErrors(read(join(root, "llms.txt"))));
errors.push(...collectAgentExampleErrors(read(join(root, "examples/agent-span.example.ts"))));

const initFiles = ["examples/react-init.ts", "examples/vue-nuxt-init.ts"];
for (const rel of initFiles) {
  const body = read(join(root, rel));
  errors.push(...collectInitExampleErrors(rel, body));
  errors.push(...collectGuardBehaviorErrors(rel, body));
}

if (errors.length > 0) {
  for (const line of errors) {
    console.error(`check: ${line}`);
  }
  process.exit(1);
}

const agentsLines = lineCountWithoutTrailingNl(agents);
console.log(`check: ok (AGENTS.md ${agentsLines} lines)`);
