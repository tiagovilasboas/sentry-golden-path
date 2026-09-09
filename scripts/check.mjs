#!/usr/bin/env node
/**
 * Repo hygiene: AGENTS.md length, README shape, no firm IP, placeholder DSNs only.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

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

const agents = read(join(root, "AGENTS.md")).split(/\r?\n/);
const agentsLines = agents.length > 0 && agents[agents.length - 1] === "" ? agents.length - 1 : agents.length;
if (agentsLines > 80) {
  errors.push(`AGENTS.md is ${agentsLines} lines; source of truth must stay ≤ 80.`);
}

const readme = read(join(root, "README.md"));
if (/^##\s+Purpose\b/m.test(readme) || /^##\s+Propósito\b/m.test(readme)) {
  errors.push("README.md must not contain a Purpose / Propósito section.");
}
if (!/^# Sentry Golden Path/m.test(readme)) {
  errors.push("README.md must start with the Staff title.");
}
if (!/## Start/.test(readme) || !/## Contents/.test(readme) || !/## Layout/.test(readme)) {
  errors.push("README.md must include Start, Contents, and Layout.");
}

const forbidden = [
  /\bCogna\b/i,
  /\bVoomp\b/i,
  /\bGreenn\b/i,
  /Variable Group/i,
  /confluence\.(atlassian|com)/i,
];

const textFiles = walk(root).filter((path) =>
  /\.(md|ts|mjs|yml|yaml|json|mdc)$/.test(path) && !path.endsWith("package-lock.json"),
);

for (const file of textFiles) {
  const rel = relative(root, file);
  if (rel === "scripts/check.mjs") {
    continue;
  }
  const body = read(file);
  for (const pattern of forbidden) {
    if (pattern.test(body)) {
      errors.push(`${rel}: forbidden firm-IP pattern ${pattern}`);
    }
  }
  const dsnHits = body.match(/o\d+\.ingest\.sentry\.io/g) ?? [];
  if (dsnHits.length > 0) {
    errors.push(`${rel}: numeric Sentry ingest host (use oXXXX placeholder): ${dsnHits.join(", ")}`);
  }
}

const rates = {
  "examples/react-init.ts": read(join(root, "examples/react-init.ts")),
  "examples/vue-nuxt-init.ts": read(join(root, "examples/vue-nuxt-init.ts")),
};
for (const [file, body] of Object.entries(rates)) {
  if (!/ERROR_SAMPLE_RATE = 0\.1/.test(body) || !/TRACES_SAMPLE_RATE = 0\.05/.test(body)) {
    errors.push(`${file}: conservative sampleRate / tracesSampleRate constants missing.`);
  }
  if (!/REPLAY_SESSION_SAMPLE_RATE = 0/.test(body)) {
    errors.push(`${file}: session replay must default to 0.`);
  }
}

if (errors.length > 0) {
  for (const line of errors) {
    console.error(`check: ${line}`);
  }
  process.exit(1);
}

console.log(`check: ok (AGENTS.md ${agentsLines} lines)`);
