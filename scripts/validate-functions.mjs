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

if (entries.length > maxFunctions) {
  console.error(`\nOver budget: ${entries.length} > ${maxFunctions}. Consolidate before deploying.`);
  process.exit(1);
}
if (entries.length > 50) {
  console.error(`\nOver Base44's hard cap of 50 — the deploy will fail.`);
  process.exit(1);
}
