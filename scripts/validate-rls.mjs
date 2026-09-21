#!/usr/bin/env node
// Static checks over base44/entities/*.jsonc, catching the specific ways
// Base44's RLS syntax fails SILENTLY (no error, the rule just stops
// matching real rows) — see acacia-app-standard/STANDARD.md Module 4.
//
// This only catches malformed-but-parseable rules, not over-restrictive-
// but-valid ones beyond the one shape below. It is not a substitute for
// reading a genuinely new rule shape by eye.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const entitiesDir = path.join(root, "base44/entities");
const BUILTIN_ROOT_FIELDS = new Set(["id", "created_by_id", "created_date", "updated_date"]);
const BUILTIN_USER_ATTRS = new Set(["id", "email", "role"]);
const OPS = ["read", "create", "update", "delete"];

function stripJsonComments(source) {
  // Our files don't use comments today, but the extension allows them —
  // strip // and /* */ outside of strings so a future comment doesn't
  // break JSON.parse here.
  return source.replace(/"(?:\\.|[^"\\])*"|\/\/.*$|\/\*[\s\S]*?\*\//gm, (m) =>
    m.startsWith('"') ? m : ""
  );
}

function collectFieldRefs(condition, refs) {
  if (Array.isArray(condition)) {
    for (const item of condition) collectFieldRefs(item, refs);
    return;
  }
  if (typeof condition !== "object" || condition === null) return;
  for (const [key, value] of Object.entries(condition)) {
    if (key === "$or" || key === "$and" || key === "$in" || key === "$nin") {
      collectFieldRefs(value, refs);
    } else if (key === "user_condition") {
      refs.push({ kind: "user_condition", condition: value });
    } else {
      refs.push({ kind: "field", field: key, value });
    }
  }
}

function hasAdminBranch(condition) {
  const refs = [];
  collectFieldRefs(condition, refs);
  return refs.some(
    (r) => r.kind === "user_condition" && r.condition && r.condition.role === "admin"
  );
}

function checkEntity(fileName, schema, errors, warnings) {
  const entityName = schema.name || fileName;
  const isTenantScoped = Boolean(schema.properties && schema.properties.family_id);

  // Field-level rls.write checks (User.family_id-style locks).
  for (const [fieldName, fieldSchema] of Object.entries(schema.properties || {})) {
    const write = fieldSchema?.rls?.write;
    if (!write) continue;
    const refs = [];
    collectFieldRefs(write, refs);
    for (const ref of refs) {
      if (ref.kind === "user_condition") {
        for (const attr of Object.keys(ref.condition || {})) {
          if (!BUILTIN_USER_ATTRS.has(attr)) {
            warnings.push(
              `${entityName}.${fieldName}.rls.write: user_condition on "${attr}" is a custom user field — Base44's docs only confirm exact-equality on built-in attributes (role/id/email). Verify this actually works before relying on it.`
            );
          }
        }
      }
    }
  }

  if (!schema.rls) return;

  for (const op of OPS) {
    const condition = schema.rls[op];
    if (condition === undefined) continue;

    const refs = [];
    collectFieldRefs(condition, refs);

    for (const ref of refs) {
      if (ref.kind !== "field") continue;
      const { field, value } = ref;

      // Entity-side: custom fields must be data.-prefixed.
      if (!field.startsWith("data.") && !BUILTIN_ROOT_FIELDS.has(field)) {
        errors.push(
          `${entityName}.rls.${op}: field "${field}" is not a built-in root field and is missing the "data." prefix — this makes the rule match EVERY row (RLS effectively off).`
        );
      }

      // User-side: a template value must resolve through user.data.* for
      // custom fields, or bare user.<builtin> for id/email/role.
      if (typeof value === "string" && value.startsWith("{{user.") && value.endsWith("}}")) {
        const inner = value.slice(7, -2); // strip "{{user." and "}}"
        const isBuiltin = BUILTIN_USER_ATTRS.has(inner);
        const isDataPath = inner.startsWith("data.");
        if (!isBuiltin && !isDataPath) {
          errors.push(
            `${entityName}.rls.${op}: "${value}" resolves to nothing for a custom user field — this makes the rule match ZERO rows (every tenant sees an empty app). Use {{user.data.${inner}}}.`
          );
        }
      }
    }

    if (isTenantScoped) {
      if (!hasAdminBranch(condition)) {
        warnings.push(
          `${entityName}.rls.${op}: no {"user_condition":{"role":"admin"}} branch — service-role calls (Phase 3's backend functions) will get zero rows on read, or a rejected write.`
        );
      }
      // Narrowed-to-admin-only-with-no-fallback: the whole condition IS
      // just the admin check, no tenant branch at all, on a read.
      if (
        op === "read" &&
        condition &&
        typeof condition === "object" &&
        condition.user_condition &&
        condition.user_condition.role === "admin" &&
        !("$or" in condition) &&
        !("data.family_id" in condition)
      ) {
        errors.push(
          `${entityName}.rls.read: narrowed to admin-only with no member fallback — every family member would see zero rows of their own data.`
        );
      }
    }
  }
}

const errors = [];
const warnings = [];

for (const fileName of readdirSync(entitiesDir)) {
  if (!fileName.endsWith(".jsonc") && !fileName.endsWith(".json")) continue;
  const filePath = path.join(entitiesDir, fileName);
  let schema;
  try {
    schema = JSON.parse(stripJsonComments(readFileSync(filePath, "utf8")));
  } catch (e) {
    errors.push(`${fileName}: could not parse as JSON (${e.message})`);
    continue;
  }
  checkEntity(fileName, schema, errors, warnings);
}

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} RLS error(s).`);
  process.exit(1);
}
console.log(`RLS check passed (${warnings.length} warning(s)).`);
