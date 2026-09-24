// Lives at the functions ROOT, like acaciaSign.test.ts: every directory under
// base44/functions/ is a deployed endpoint and a test file is not one.
//
// What this protects: Module 20's promise that a closed session stays closed.
// manageSession used to set any row it found back to 'active', so a device
// revoked from Mi cuenta -- or reaped after 48h -- was back in the next time
// it opened the app. These cases are the rows that must never be revived.
import { assert, assertEquals, assertFalse, assertNotEquals } from "jsr:@std/assert@1";
import { isDead, isStale, retiredDeviceId, STALE_AFTER_MS } from "./session/_sessionRules.ts";

const NOW = Date.parse("2026-09-23T19:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

Deno.test("a device silent past 48h is dead even if nothing ever revoked it", () => {
  // The reap job not running must not keep a dead device logged in.
  const row = { id: "a", status: "active", last_active_at: hoursAgo(49) };
  assert(isStale(row, NOW));
  assert(isDead(row, NOW));
});

Deno.test("a laptop asleep for a weekend day is not logged out early", () => {
  const row = { id: "a", status: "passive", last_active_at: hoursAgo(47) };
  assertFalse(isDead(row, NOW));
});

Deno.test("a revoked row is dead however recent it is", () => {
  // "Cerrar" in Mi cuenta revokes a session that heartbeated a minute ago.
  const row = { id: "a", status: "revoked", last_active_at: hoursAgo(0.01) };
  assert(isDead(row, NOW));
});

Deno.test("threshold matches the reap job's 48h", () => {
  assertEquals(STALE_AFTER_MS, 48 * 60 * 60 * 1000);
});

Deno.test("a retired device_id can never be matched by a real browser id", () => {
  // The browser keeps its UUID across logouts; if retiring kept it, the next
  // manageSession would find the dead row again and lock that browser out.
  const uuid = "50c2644f-78b1-40b1-a6e4-b91be53dd9a9";
  const retired = retiredDeviceId({ id: "row1", device_id: uuid });
  assertNotEquals(retired, uuid);
  assert(retired.startsWith("retired:"));
  assertNotEquals(retired, retiredDeviceId({ id: "row2", device_id: uuid }));
});
