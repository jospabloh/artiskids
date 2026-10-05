#!/usr/bin/env node
// Every directory under base44/functions/ becomes a deployed Base44
// endpoint. Base44's hard cap is 50; the ACACIA portfolio budgets 40 so
// there's headroom before hitting it. Run before every functions deploy.

import { readdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const functionsDir = path.join(root, "base44/functions");
const appJsonPath = path.join(root, "base44.app.json");

const maxFunctions = existsSync(appJsonPath)
  ? JSON.parse(readFileSync(appJsonPath, "utf8")).maxFunctions
  : 40;

if (!existsSync(functionsDir)) {
  console.log("No base44/functions/ directory yet — 0 endpoints.");
  process.exit(0);
}

const entries = readdirSync(functionsDir, { withFileTypes: true }).filter((e) =>
  e.isDirectory()
);

console.log(`${entries.length} function director${entries.length === 1 ? "y" : "ies"} (budget: ${maxFunctions}, Base44 hard cap: 50):`);
for (const entry of entries) {
  console.log(`  - ${entry.name}`);
}

// Base44's function schema only knows name/entry/automations; any other
// top-level key is dropped silently, so a schedule written loose at the top
// level deploys a function that never runs (purgeStaleSessions, 2026-10).
const misplaced = ["type", "schedule_mode", "schedule_type", "cron_expression"];
let badConfig = false;
for (const entry of entries) {
  const cfgPath = path.join(functionsDir, entry.name, "function.jsonc");
  if (!existsSync(cfgPath)) continue;
  const text = readFileSync(cfgPath, "utf8").replace(/^\s*\/\/.*$/gm, "");
  let cfg;
  try {
    cfg = JSON.parse(text);
  } catch (err) {
    console.error(`${entry.name}/function.jsonc is not valid JSONC: ${err.message}`);
    badConfig = true;
    continue;
  }
  const loose = misplaced.filter((k) => k in cfg);
  if (loose.length > 0) {
    console.error(`${entry.name}/function.jsonc has ${loose.join(", ")} at the top level; Base44 ignores them. Move the schedule inside "automations": [...].`);
    badConfig = true;
  }
}
if (badConfig) process.exit(1);

if (entries.length > maxFunctions) {
  console.error(`\nOver budget: ${entries.length} > ${maxFunctions}. Consolidate before deploying.`);
  process.exit(1);
}
if (entries.length > 50) {
  console.error(`\nOver Base44's hard cap of 50 — the deploy will fail.`);
  process.exit(1);
}
