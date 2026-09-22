# artiskids — Project Notes

Base44 app workflow specifics: see `AGENTS.md`. This file carries the
ACACIA-portfolio compliance notes — the rest of the portfolio's `CLAUDE.md`
files follow the same shape (see `jospabloh/acacia-app-standard` →
`STANDARD.md`/`CHECKLIST.md` for the 23-module standard itself, module 18
retired).

## What this app is

A family "art capsule": children's drawings get uploaded, and family members
comment/react to them. Base44 app, id `6aaeda94a9028c3f2e96b9e5` (branch
`main`). Not yet live at a domain; will be `artiskids.acaciaco.com.mx`, with
its marketing/plans page at `https://www.acaciaco.com.mx/apps/artiskids`
(`jospabloh/acaciaco-site` → `apps/`), and a row in
`jospabloh/acacia-mission-control`'s app registry.

## Frozen decisions — 2026-09-20 (Phase 0 of the compliance rollout)

These are the answers the rest of the rollout builds on. Changing any of them
after Phase 2 ships means an entity migration, not a config edit — that is
why they are frozen here before schema work starts.

- **Tenant = Family.** One `Family` row is one license: one `billing_status`,
  one `join_code`. Nothing crosses a family boundary — no shared albums, no
  member in two families. This is the Module 18-retired shape: a user's
  `family_id`/`family_role` fields ARE the membership, no separate
  `Membership` entity, no tenant switcher. `createFamily`/`redeemCode` answer
  409 if the caller already has a `family_id`.
- **Adults only log in.** `Child` has no account, ever — a parent/relative
  uploads and manages on the child's behalf. `Parent`/`Relative` stay as
  family-scoped catalog/label entities (used today as author-name pickers in
  `DrawingDetail.jsx`), not separate account holders. The account model lives
  entirely on Base44's built-in `User` entity: `family_id` + `family_role`.
- **Two roles:** `family_admin` (created the family, or promoted; manages
  members/billing/danger-zone) and `member` (uploads drawings, comments,
  reacts). No `viewer` role for now — add one later as a genuine schema
  change if a family asks for it, don't build it speculatively.
- **Joining:** invite `join_code` only for v1 (a family shares it over
  WhatsApp) — no emailed-invite flow yet. `redeemCode` still requires the
  caller to have no existing `family_id`.
- **Commercial model:** 30-day trial (`billing_status: trial`,
  `trial_end_at = now + 30d` in server time), then a paid plan via
  **Mercado Pago only** — never Stripe (`@stripe/react-stripe-js` /
  `@stripe/stripe-js` are dead scaffold deps from `create-base44-app` and get
  removed in Phase 1, they were never wired to anything).
  - `view_only`: can open the app and see existing drawings; cannot upload,
    comment, or react.
  - `suspended`: login itself is blocked, with an explanation screen and the
    portfolio support contact.
- **Danger zone:** deleting a family cascades its Drawings/Comments/Reactions
  and their files; deleting "my account" as the only `family_admin` is
  blocked until another member is delegated first; a departing `member`'s own
  comments/reactions are removed, but drawings they uploaded stay (a child's
  drawing doesn't disappear because the parent who scanned it left). Export
  is JSON metadata + the image URLs, not a bundled ZIP, for v1.
- **`PLATFORM_OWNER_EMAIL` = h.josepablo@gmail.com** — confirmed against the
  live `User` table: it is the only real account today (`role: admin`).
- **Support contact:** the same portfolio channels as every other app —
  WhatsApp 449 895 8291, `soporte@acaciaco.com.mx`.
- **Deploy discipline — corrected 2026-09-21, do not re-adopt Module 11's
  generic CLI path here.** Verified against the live Base44 API
  (`GET /api/apps/{id}/github/connection`): this app has an **active**
  GitHub connection to `jospabloh/artiskids` with `webhook_active: true` —
  every push auto-pulls into the Base44 builder tree. That's exactly what
  the repo's own generated `README.md` already said ("publish from the
  dashboard, never `base44 deploy`, since a CLI deploy ships your local tree
  directly and bypasses the sync"). Module 11's `npm run deploy` CLI pattern
  is written for portfolio apps that do NOT have GitHub sync and deploy
  straight from a local checkout — applying it here would cause the exact
  divergence incident the standard exists to prevent, just from the other
  direction. So for artiskids: git push is the only way code reaches Base44;
  publishing (making a synced commit live) still needs an explicit step
  (Base44 dashboard, or `POST /api/apps/{id}/deploy` against the checkpoint
  matching that commit) — never a raw CLI `base44 deploy`. Module 11's other
  intent (an endpoint-count guard, verify-by-content after publishing) still
  applies, just implemented against this app's actual mechanism: Phase 1
  adds `validate:functions` as a local dir-count check, not a deploy
  wrapper. Whether `base44 entities push`/function-specific pushes also
  bypass the GitHub sync (as `base44 deploy` does) is unverified — check
  before Phase 2/3 write any entities/functions push tooling; don't assume
  it behaves like `deploy` just because both are CLI commands.
- **Domain timing:** the Mission Control registry row (Phase 5) is seeded
  with `url: null` now, same as kitchops/ctrlhq were before their DNS went
  live; a follow-up migration fills it in at Phase 6's cutover.
- **New-tenant real-time ping (Module 1):** artiskids fires the call when a
  family is created; there's no receiver in Mission Control for it yet
  (nothing there reads an `alerts`-style row from this path). Building that
  receiver + a Dashboard widget is out of scope for this rollout — the call
  is fire-and-forget and harmless if it 404s.

## Verified against the live app (Base44 MCP, 2026-09-20) — not assumed

- **Zero real family data.** One `User` row total: the owner
  (h.josepablo@gmail.com, `role: admin`). `Child`, `Parent`, `Relative`: 0
  rows. `Drawing`: 4 seed rows (Sofía/Mateo sample drawings), all
  `created_by_id` = the owner, `is_sample: false`. This means Phase 2's
  migration can be additive with a trivial backfill (assign those 4 rows to
  the one family the owner's account gets on migration) — no real backfill
  script, no user communication needed.
- **Deployed schema is byte-identical to the repo's `base44/entities/*.jsonc`**
  — confirmed via `list_entity_schemas`. Zero RLS/permission blocks exist on
  any entity, live or in the repo. Nothing has drifted; Phase 2 starts from a
  clean baseline.

## Known gaps to carry into the Module 14 audit (not blocking, but don't forget)

- `Drawing.image_url` is written via `UploadPublicFile` — a world-readable
  URL for children's artwork. Acceptable to ship v1 with (the app itself
  still requires login), but it means anyone with a leaked URL sees the image
  without authenticating. Revisit private files + signed URLs when Module 14
  audits attachment URLs.
- Which OAuth providers are actually enabled on this Base44 app (Google?) is
  unverified from this session — check the Base44 auth panel before Phase 4
  ships the real login page, so it never shows a button for a provider that
  isn't configured (Module 10).
- **Closed 2026-09-22**: the real logo (origami-crane mark, 1024×1024, from
  `resources/artiskids_logo.png` on `main` — dropped in via the GitHub web UI,
  not part of the compliance rollout's own commits) now lives at
  `public/logo.jpg` and is wired into the favicon (`index.html`), the header
  mark (`Layout.jsx`), and the two other spots that carried the same
  gradient+`Palette`-icon placeholder (`About.jsx`, `FamilyOnboarding.jsx`).
  `resources/` itself is a drop folder, not a source directory — nothing
  there is referenced by path, so it isn't merged into this rollout's
  branches. Colour direction is still whatever the mark implies (amber/rose
  gradient elsewhere in the UI already reads compatibly); acaciaco-site's
  marketing page picked up the same file in the same pass — see its own
  CLAUDE.md.
- `npm run typecheck` already had pre-existing errors in `Login.jsx`,
  `Register.jsx`, `OAuthConsent.jsx`, `ResetPassword.jsx` (unrouted scaffold
  pages, shadcn prop-typing gaps) and `Upload.jsx` (`UploadPublicFile` not in
  the SDK's `CoreIntegrations` type) — confirmed present before this
  session's changes (`git stash` + rerun). Phase 4 reworks all of these
  pages anyway; fix the typing as part of that, not as a separate pass.

## Rollout phases

Tracked module-by-module against `acacia-app-standard/STANDARD.md`
(22 active modules, module 18 retired — see there for the full text).
Each phase is its own PR per repo; nothing gets deployed without a human
running the command and Sonnet verifying by re-reading served
content/schema, never by hash or by assuming a merge shipped.

0. **Frozen decisions + live-state verification** (this section). Done
   2026-09-20.
1. **Repo hygiene & deploy discipline** — dead Stripe deps out, branding,
   `validate:functions` (endpoint-count guard, GitHub-sync-safe), a
   `verify-published` helper that checks the live app against the latest
   pushed commit, `.env.example`, changelog scaffold. No CLI deploy wrapper
   scripts — see the corrected Deploy discipline decision above. Modules 6
   (scaffold), 11 (adapted), 16 (inventory).
2. **Family/roles/RLS schema — LIVE since 2026-09-22.** `Family` entity,
   `family_id`/`family_role` on `User`, `family_id` on the six existing
   tenant entities (`Child`/`Parent`/`Relative`/`Drawing`/`Comment`/
   `Reaction`), four-op RLS with the explicit service-role admin branch on
   every op, `validate-rls` script. **`SupportTicket`/`AppSession`/
   `RolePermission` moved to Phase 3** (corrected 2026-09-21) — nothing
   consumes them until Phase 3's functions exist, and bundling them into
   this push would widen its blast radius past what Phase 2 actually needs.
   Modules 1 (field), 2, 4, 18-retired, 19.

   Pushed via `update_entity_schema`/`create_entity_schema` (Base44 MCP),
   confirmed live by re-reading `list_entity_schemas` after each call — not
   assumed from the call succeeding. **Observed platform quirk, worth
   knowing before Phase 3's own entity pushes**: `update_entity_schema`
   applied the schema live correctly on every one of the six existing
   entities, but its write-back of `base44/entities/<Name>.jsonc` into the
   GitHub-synced repo failed every time, with a warning that "a later sync
   may revert" the live change. In this case it was harmless — the repo's
   `main` already carried the exact same content from this same phase's
   earlier commit, so there's nothing for a future sync to revert *to* that
   differs. Next time (Phase 3's new entities), verify the repo file still
   matches the live schema after any such error, and fix it directly if it
   doesn't — don't assume "applied to the live app" + "write-back failed"
   nets out safe by default; it only did here because the content already
   matched going in.

   No data backfill was needed or done: `Family.create` and the write locks
   are all admin-only, and the sole real account (the owner) has
   `role: admin`, which unconditionally satisfies every RLS rule's
   service-role branch regardless of `family_id` — so the app kept working
   with zero data migration. The 4 seed `Drawing` rows and the owner's own
   `User.family_id` stay unset until Phase 3's `createFamily` function
   creates a real family the sanctioned way, rather than being hand-created
   here through a side door.
3. **Backend functions, Mission Control bridge, secrets — code-complete
   2026-09-22, repo-only, not deployed.** `SupportTicket`/`AppSession`/
   `RolePermission` entities (moved here from Phase 2), the `acaciaControl`
   bridge (`_acaciaSign.ts` copied unchanged from `shared/bridge/`,
   `ACCEPT_LEGACY_MASTER = false`), the `family`/`content`/`session`/
   `support` function routers, `purgeStaleSessions` (the Module 20 reap job),
   the permission registry + generator. Modules 3 (server half), 5, 7
   (server half), 8 (server half), 15, 16, 20 (server half), 22. All six
   function directories `deno check` clean and `deno test` passes (10/10 on
   `_acaciaSign.ts`'s vector, checked identical across its three copies --
   `acaciaControl`, `family`, `support`); `validate:rls`/`validate:functions`
   both pass. Each router's `_permissions.generated.ts` is committed
   (`npm run generate:permissions`), not hand-written.

   Two corrections made against the design notes below, caught before
   anything deployed rather than after: `AppSession` was missing a stable
   `device_id` field (`manageSession`'s find-or-create key needs a
   per-browser UUID, not the human-readable `device` label, which isn't
   unique per physical device) -- added and made required. `family`/`content`
   route their role checks through `permissionRegistry.js`'s `Familia`/
   `Dibujos`/`Comentarios`/`Reacciones`/`Catalogo` sections (platform owner →
   `RolePermission` override → registry default), not hardcoded
   `family_role === "family_admin"` checks -- the registry existed
   specifically for this and a hardcoded check would have silently diverged
   from it the first time someone edited one but not the other.

   Two upstream gaps are written-for but not yet real, same shape as Module
   1's new-tenant ping (fire-and-forget, swallowed on failure, harmless
   until the other side exists): `family`'s `createFamily` pings Mission
   Control with no receiver there yet, and `support`'s `createTicket` pushes
   to `/api/ingest/ticket`, which 4xxs today because Mission Control's
   `ticketControl.js` has no `artiskids` entry (verified directly, not
   assumed) -- both close in Phase 5.

   **Still pauses before functions deploy and before secrets are set** in
   Base44 (`INGEST_HMAC_SECRET`, `ACACIA_APP_SLUG=artiskids`,
   `PLATFORM_OWNER_EMAIL`, `CRON_SECRET`) — those are the platform-owner
   identity and the bridge trust root, and `INGEST_HMAC_SECRET` specifically
   must match Mission Control's own value exactly; it can't be read back
   from either side once set, so getting it from the user is the one step
   here that has no verify-after-the-fact.
4. **Frontend compliance — code-complete 2026-09-22, in PR #7, not deployed
   (same as Phase 3, nothing here can go live before that pause clears).**
   Real routed login/register/forgot/reset (dropping the `redirectToLogin`
   fallback to Base44's hosted login), the shared `ThemeSwitcher` copied
   unchanged, direct entity writes replaced by function calls, Account/
   Permisos/Soporte/About pages, session idle warning + device list. Modules
   10, 12, 3 (client), 7 (UI), 8 (UI), 20 (client), 21, 23, 6 (surfacing).
   `npm run lint`/`typecheck`/`build`/`validate:rls`/`validate:functions` all
   pass; `typecheck`'s remaining errors are the pre-existing scaffold ones
   from Phase 0 (verified by diffing against a `git stash -u` baseline, not
   assumed) plus zero new ones.

   Two real bugs caught before they ever shipped, same discipline as
   Phase 3's device_id fix: the request-body shape all four function
   routers expected (`{action, params: {...}}`) didn't match what
   `shared/session/useSessionManager.js`/`useActivityTracker.js` -- copied
   unchanged, can't be edited here -- actually send (`{action, ...flat}`);
   and `Account.jsx`'s member list and device list had no read path at all
   (`User.read` is Base44's built-in "your own row only" default, no
   entity-level RLS override on it), so `listMembers`/`listSessions`/
   `revokeSession` were added to the family/session routers.

   **Module 23 (nav persistence)**: this app's nav is a flat top bar with no
   sidebar or expand/collapse state -- the active item is derived from the
   URL via `useLocation()`, which survives a reload for free. Nothing extra
   to build here unless the nav ever grows a collapsible section.

   **Still unverified, carried from Phase 0's "known gaps"**: which OAuth
   providers are actually enabled on the live Base44 app (Google shows a
   button in `Login.jsx`/`Register.jsx` regardless -- check the Base44 auth
   panel before Phase 6's cutover, or a configured-off provider 404s on
   click). Also genuinely unverified from this sandbox: the whole flow in a
   real browser (create/join family, upload, theme toggle, the 20-minute
   idle warning, an admin's danger-zone actions) -- this environment's proxy
   can't reach a live Base44 preview, so that's Phase 6's `npm run
   test:smoke`-equivalent manual pass, not something claimed done here.
5. **Mission Control + acaciaco-site — code-complete 2026-09-22, two PRs
   open, not deployed.** `licenseControl.js`/`ticketControl.js`/
   `messaging.js` entries + `licenseCatalog.js` mirror + the seed migration
   in `jospabloh/acacia-mission-control`
   ([PR #107](https://github.com/jospabloh/acacia-mission-control/pull/107));
   `apps/artiskids.html` + `soporte.html`/`KNOWN_APPS` entry (plus the
   homepage `#apps` grid/footer and every other page's shared footer app
   list) in `jospabloh/acaciaco-site`
   ([PR #245](https://github.com/jospabloh/acaciaco-site/pull/245)). Module
   9, 17.

   `licenseControl.js`'s `artiskids` entry set `plans: []` — no paid tier
   names exist yet (the frozen decision above only commits to "30-day trial,
   then a paid plan via Mercado Pago," no structure), and the marketing
   page's pricing section says exactly that instead of inventing numbers
   the way every other app page's three-tier grid does. No brand assets
   existed for the marketing page at the time — it used inline SVG for the
   mark, same pattern RADAR's homepage card already uses, and fell back to
   the portfolio-wide `acacia-og.png` rather than a link that would 404.
   **The real logo landed 2026-09-22** (see below) and replaced that inline
   SVG in both acaciaco-site's product mark and homepage card; the OG image
   still falls back, since there's no wide lockup, only the square mark.

   `ticketControl.js` needed a real code change, not just a config entry:
   `SupportTicket` has a single `message` field, no reply-thread entity —
   the existing two-mode model (`message`/`inline`) never anticipated an
   app with no thread at all. `thread: null` plus a guard in
   `buildTicketReply` that errors instead of assuming a shape that doesn't
   exist covers it; status changes work, replies from the panel don't yet.
   Two new tests in that repo cover both paths.

   **Pauses before the migration runs against production Supabase** — it's
   read by every cron from that point on. Both PRs are additionally
   downstream of Phase 3's own pause: the registry row can exist before
   artiskids' backend is deployed (the sync cron just gets "not reachable"
   until then, same as any newly-registered app before its first
   successful sync), but nothing here makes the bridge itself live.
6. **Deploy, prove, audit, cut over** — human-run deploys, *Sincronizar
   ahora* → `app_health` + `control:run-sync` proof, smoke suite wired to
   `.github/workflows/smoke.yml`, session-reap gate exercised, the dated
   Module 14 isolation audit (against the deployed schema, with an explicit
   "could not verify" list), then DNS + the Mission Control URL migration.
   Modules 13, 14, 5 (proof), 16 (proof), 17 (proof), 1 (proof). **Pauses at
   domain cutover.**

## RLS design notes (Phase 2, 2026-09-21)

Confirmed the actual schema shape from the Base44 MCP tools themselves
(`create_entity_schema`/`update_entity_schema`), not just STANDARD.md's
narrative: entity-level `rls: {create, read, update, delete}`, each a
Mongo-style condition combinable with `$and`/`$or`; `user_condition` does
**exact-equality on a built-in user attribute only** (`role`/`id`/`email` —
its own example never shows a custom field, unlike the entity-field-compare
rule type, which explicitly documents `data.`-prefixed custom fields). Two
decisions followed from that:

- **Role gating (family_admin vs member) is NOT done in RLS.** Whether
  `user_condition` accepts a custom field like `data.family_role` is
  undocumented, and guessing wrong here is exactly the silent-failure
  category Module 4 warns about — over- or under-matching with no error.
  RLS's job stays the tenant boundary only (`data.family_id` ==
  `{{user.data.family_id}}`, plus the admin branch); which role can do what
  within a family is a Phase 3 Safe-function check against the permission
  registry, which is what Module 2/3's split is for anyway.
- **`family_id` on the six existing tenant entities is NOT field-write-locked
  yet.** `User.family_id`/`User.family_role` and `Family`'s billing fields
  ARE locked to `{"rls":{"write":{"user_condition":{"role":"admin"}}}}` now
  — nothing writes to them today, so locking them is pure gain. But
  `Drawing`/`Comment`/`Reaction`/`Child`/`Parent`/`Relative` are still
  written directly from the client (`Upload.jsx`, `DrawingDetail.jsx`,
  `CatalogList.jsx`) — locking their `family_id` to admin-write now would
  break every one of those paths until Phase 4 replaces them with Safe
  function calls. Lock them then, not now — this is the additive-migration
  rule from Module 4 applied to a field lock, not just a whole rule.

Full schema for both new decisions lives in `base44/entities/*.jsonc` as of
this phase, deployed to the live app only after explicit sign-off.

## GitHub sync incident and resolution (2026-09-22)

Phase 2's live schema push (`update_entity_schema`) broke GitHub→Base44 sync
for real: it applied every entity change live correctly, but its write-back
of the corresponding `base44/entities/*.jsonc` file into the repo failed on
6 of 7 calls, leaving Base44's own internal git history for those 8 files
diverged from GitHub's — not a content difference (confirmed byte-identical
at the time), a **history** one, and `POST /github/sync` returned
`error: merge_conflict` naming exactly those files on every pull attempt
after that, through all of Phase 1's Stripe/branding/scripts changes sitting
merged-but-unsynced on GitHub.

First attempt — rewriting the 8 repo files to match Base44's canonical
(alphabetical) key order, on the theory that a byte-level mismatch was the
cause — did NOT resolve it; the same `merge_conflict` recurred with the same
8 files after that fix merged. That ruled out content mismatch as the actual
cause and confirmed it was git-history shape, not current bytes.

**What actually resolved it**: `POST /github/sync/resolve-conflicts` — hands
the conflict to Base44's own AI builder for a turn (can take minutes; the
tool call itself timed out client-side at 60s both times, but the work
continued server-side regardless — confirmed via `last_git_commit_hash`
changing and `builder_session_counter` incrementing between polls). A
follow-up `POST /github/sync` then reported `synced: true`, 9 commits
pulled cleanly. Verified by re-reading `package.json`/`index.html` from the
sandbox afterward — Phase 1's changes were finally present. The resolver's
only actual edit was cosmetic (em dashes → hyphens in entity field
descriptions, its own commit `3f48794`); RLS semantics were unchanged,
confirmed by re-running `validate:rls` (0 errors) and `list_entity_schemas`.

**Lesson for Phase 3's own entity/function pushes**: if `update_entity_schema`
or an equivalent push reports its GitHub write-back failed, don't assume a
byte-level fix will clear a resulting `merge_conflict` — it won't, if the
real cause is history divergence rather than content. Go straight to
`resolve-conflicts`, expect it to run past the tool's own timeout, and
verify completion by polling `GET /api/apps/{id}` for a changed
`last_git_commit_hash`/`builder_session_counter` rather than trusting the
timed-out call's (missing) response. Then confirm with a plain `sync` pull
and a content read-back — never assume clean from the resolver call alone.

Rules for whoever executes a later phase: never run `base44 deploy` on this
repo — it has active GitHub sync, so a raw CLI deploy bypasses it and
diverges from what's in git; publish only via the dashboard or a deploy
call against the checkpoint matching the pushed commit; never push an
entity-schema change without a typed confirmation and a content diff after;
migrate additively, never
narrow a live RLS rule even with zero real data — it's the habit that
matters, not this instance; never put a secret in the repo or under a
`VITE_` prefix; never edit a copied `ThemeSwitcher.jsx`/`smoke.spec.js`/
`_acaciaSign.ts`/`shared/session/` file in place — the portfolio-wide
mirror check depends on them staying byte-identical; never touch another
app's repo or Mission Control entry from here.

## Phase 3's real blocker: backend functions were never registered (2026-09-22)

Secrets (`INGEST_HMAC_SECRET`, `ACACIA_APP_SLUG`, `PLATFORM_OWNER_EMAIL`,
`CRON_SECRET`) confirmed present and matching via `base44 secrets list`
(exact names checked against every `secrets.get(...)` call in
`base44/functions/`) — the frozen "no verify-after-the-fact" concern from
Phase 3's own notes above is resolved. A deploy was then run (via the
dashboard, git commit `0b2a85f`, matching `main`) and confirmed live —
`GET /api/apps/{id}` shows `last_deployed_git_commit_hash` equal to that
commit, `status.state: ready`, GitHub connection `active`.

**None of that was the actual blocker.** The same `GET /api/apps/{id}` call
shows `has_backend_functions_enabled: false` and `functions: {}` —
zero backend functions registered on the app, despite all six directories
(`acaciaControl`, `family`, `content`, `support`, `session`,
`purgeStaleSessions`) being present and synced in the app's own file tree
(confirmed via `list_directory` against the live app, not just the repo).
Deploying the frontend and having the files present is not the same as
Base44 treating them as live function endpoints — `createFamily` (called
from `/bienvenida`) 404s, confirmed live in the browser: "Request failed
with status code 404".

Searched the full platform API catalog (24 areas, 218 operations via
`list_api_catalog`) for anything that flips `has_backend_functions_enabled`
or registers functions explicitly — nothing documented does. Rather than
guess at an undocumented mutation against a production app (exactly the
"guessing wrong is silent failure" trap Module 14 exists to avoid), this
needs a human to check the Base44 dashboard directly — likely a
"Backend"/"Functions" panel or a workspace-plan capability that needs
enabling before any of the six functions can ever go live, independent of
git sync or deploy state.

**Until that's resolved, every Phase 3/4 feature that calls a function 404s
the same way**: creating or joining a family, uploading through the Safe
path, sessions, support tickets. This is a hard stop on the whole backend,
not specific to `createFamily`.

### The frontend must not show that 404 as raw text, and mostly didn't get fixed yet

The onboarding screen (`FamilyOnboarding.jsx`) was showing axios's own
`"Request failed with status code 404"` verbatim via `setError(err.message)`
— a dead end with nothing the user could do, the same failure shape Module
10 calls out for the login page ("no dead ends... it throws the platform's
raw error"), just not written down for this screen specifically since
Module 10 is about login. Fixed: `callFunction` (`src/lib/functions.js`) now
tags a caught error `isRouterError` — `true` when the router itself
responded with a structured `{error: "..."}` (a real, actionable message
like "ya tienes una familia"), `false` for anything that never reached
router logic (function not registered, network failure, a 500).
`FamilyOnboarding.jsx` shows router errors inline as before; anything else
now renders a WhatsApp/correo escape hatch (WhatsApp works with zero backend
dependency, same reasoning as Roseta's `#rf-fallback` in `acaciaco-site`)
instead of the raw string.

**The identical `setError(err.message)` pattern exists in `Login.jsx`,
`Register.jsx`, `Account.jsx`, `Upload.jsx`, `Soporte.jsx`, and
`ResetPassword.jsx`** — found while looking for this, not yet fixed. Same
risk in all six: an unregistered/failed function call would show raw axios
text there too. Carry this into whichever phase touches those files next,
or do it as its own pass — it's the same three-line `isRouterError` branch
in each place, just not done yet because six files is a bigger unilateral
change than the one screen actually reported broken.
