#!/usr/bin/env node
// Bumps package.json's version, appConfig.js's RELEASE_DATE/APP_VERSION,
// and prepends a changelog entry. This is the ONLY thing allowed to touch
// those — never generate them from a routine build (Module 6 of the
// ACACIA standard).
//
// Usage: npm run release -- <version> "<changelog note>" ["<another note>" ...]
// Example: npm run release -- 0.2.0 "Se pueden compartir álbumes por familia."

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [version, ...notes] = process.argv.slice(2);

if (!version || notes.length === 0) {
  console.error(
    'Usage: npm run release -- <version> "<changelog note>" ["<another note>" ...]'
  );
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`"${version}" is not a plain semver version (e.g. 0.2.0).`);
  process.exit(1);
}

const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
if (pkg.version === version) {
  console.error(`package.json is already at ${version}.`);
  process.exit(1);
}
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const releaseDate = new Date().toISOString().slice(0, 10);

const changelogPath = path.join(root, "src/lib/changelog.json");
const changelog = JSON.parse(readFileSync(changelogPath, "utf8"));
changelog.unshift({ version, date: releaseDate, notes });
writeFileSync(changelogPath, JSON.stringify(changelog, null, 2) + "\n");

const configPath = path.join(root, "src/lib/appConfig.js");
const configSource = readFileSync(configPath, "utf8").replace(
  /export const APP_VERSION = ".*";\nexport const RELEASE_DATE = ".*";/,
  `export const APP_VERSION = "${version}";\nexport const RELEASE_DATE = "${releaseDate}";`
);
writeFileSync(configPath, configSource);

console.log(
  `Released ${version} (${releaseDate}). Commit package.json, src/lib/appConfig.js, and src/lib/changelog.json.`
);
