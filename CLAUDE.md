# artiskids — Project Notes

Base44 app workflow specifics: see `AGENTS.md`. This file carries the
ACACIA-portfolio compliance notes — the rest of the portfolio's `CLAUDE.md`
files follow the same shape (see `jospabloh/acacia-app-standard` →
`STANDARD.md`/`CHECKLIST.md` for the 23-module standard itself, module 18
retired).

## What this app is

A family "art capsule": children's drawings get uploaded, and family members
comment/react to them. Base44 app, id `6aaeda94a9028c3f2e96b9e5` (branch
`main`). Live at `https://artiskids.acaciaco.com.mx` (confirmed 2026-09-23: 200
with this app's own `<title>`), marketing/plans page at
`https://www.acaciaco.com.mx/apps/artiskids` (`jospabloh/acaciaco-site` →
`apps/`), and registered in `jospabloh/acacia-mission-control` as `artiskids`
(0045 seed + 0046 URL, both applied to production).

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

- **Closed in code 2026-09-23 (PR #17)**: drawings were uploaded with
  `UploadPublicFile`, so every photo was a URL anyone could open with no
  login — confirmed against production (the one real drawing downloaded
  anonymously, 3.1 MB). Now private storage + server-minted signed links; see
  "Private photos" below. One legacy public upload remains until re-uploaded.
- **Closed 2026-09-23**: Google OAuth is live and in active use — the
  platform owner confirmed logging in with it directly, not inferred from
  the button being present. The Login/Register pages' Google button is a
  real, configured provider, not a dead-end click.
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
   2026-09-22, functions deployed and live 2026-09-22 (see "Backend
   functions deployed" below).** `SupportTicket`/`AppSession`/
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

   Secrets were confirmed present and matching via `base44 secrets list`
   before deploy; functions were then deployed via `base44 functions
   deploy` and confirmed live by curling each one directly (see "Backend
   functions deployed" below) — the one step that had no
   verify-after-the-fact (matching `INGEST_HMAC_SECRET` to Mission
   Control's own value) is resolved: the bridge is live.
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

   (OAuth: resolved 2026-09-23, Google is live and in use — see Known
   gaps.) Genuinely unverified from this sandbox: the whole flow in a
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

   **Migration run against production 2026-09-23.** `0045_seed_artiskids.sql`
   was applied directly to Mission Control's live Supabase project
   (`xrvjnadirzsjvzknfyjf`) via `apply_migration` and confirmed by reading
   the row back (`select … from apps where id = 'artiskids'`) — not assumed
   from the tool's success flag. Before this, `select id from apps` on
   production returned 33 rows with no `artiskids` among them, confirming
   the pause documented below had genuinely held since the PRs merged
   2026-09-22; it's 34 now. The data-path proof is in Phase 6 below.
6. **Deploy, prove, audit, cut over — proven 2026-09-23 except where noted.**
   - **Data path (Modules 5, 17 proof):** *Sincronizar ahora* first FAILED
     (`502 bad signature`, Vercel log 03:29 UTC) — see "The bridge's first
     sync" below. After the fix: `POST /api/control/run-sync 200`, a
     `control:run-sync` audit row, 1 family / 1 license / 4 usage metrics / 5
     sessions synced. The daily cron then wrote `app_health` `status: ok`,
     383 ms (08:29 UTC). Note: *Sincronizar ahora* on the app page never
     writes `app_health` — its kinds are licenses/usage/sessions; health only
     comes from the Salud page's probe or the daily cron.
   - **Cutover:** domain live; `0046_artiskids_url.sql` applied to production
     and read back (mission-control PR #109, merged).
   - **Smoke suite (Module 13):** added in PR #17; first real run is the
     GitHub Actions `workflow_dispatch` after merge.
   - **Module 14 audit:** written below, dated.
   - **Session-reap gate (Module 20):** see Module 14's "could not verify".

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

**The identical `setError(err.message)` pattern also existed in `Login.jsx`,
`Register.jsx`, `Account.jsx`, `Upload.jsx`, `Soporte.jsx`, and
`ResetPassword.jsx` — closed 2026-09-22, see below.**

### A human needs to find out too, not just the customer (2026-09-22)

The WhatsApp/correo escape hatch only helps if the customer actually taps
it. `FamilyOnboarding.jsx`'s fatal-error path now also fires
`notifyMissionControl()` — a fire-and-forget `POST` straight from the
browser to `https://control.acaciaco.com.mx/api/ingest/lead`
(`type: "soporte"`, `app_interest: "artiskids"`, the caller's own
email/name, a message naming which action failed). This is Mission
Control's existing **public** lead endpoint (`api/ingest/lead.js` there) —
CORS-open, secret optional, built for exactly this: "the acaciaco.com.mx
contact form (and any landing) can POST a lead here." No new secret, no env
var, nothing server-side to configure.

**Why not the `support` function's `createTicket` instead** (Module 8's
usual path): it goes through the same six backend functions that are
already down — using it here would be reporting a backend outage through
the backend that's out. `leads` (a sales/support inbox, not a ticket) is
the one channel in the whole portfolio a pre-auth, family-less, backend-less
customer can still reach, because it was built to be called directly from a
browser with nothing behind it.

Not verified live from this sandbox — its proxy can't reach
`control.acaciaco.com.mx` (same limitation the smoke-test docs already
name). Verified instead by reading `api/ingest/lead.js` and its
`.env.example` entry directly in `jospabloh/acacia-mission-control` and
matching its exact request contract. Once backend functions are registered
and `createFamily` actually works, this call stops firing on its own (the
`else` branch it lives in only runs for `!err.isRouterError`) — nothing to
clean up afterward.

### The other six files: closed (2026-09-22)

Two shared pieces landed so the pattern didn't get re-invented six times:
`src/components/SupportEscapeHatch.jsx` (the WhatsApp/correo button pair,
parametrized by a context message) and `src/lib/notifyMissionControl.js`
(the lead-ingest POST, factored out of `FamilyOnboarding.jsx` — that file
now imports both instead of carrying its own copies).

Three files go through `callFunction`, so they got the exact same
`isRouterError` treatment as `FamilyOnboarding.jsx`:

- **`Soporte.jsx`** already showed WhatsApp/correo unconditionally below the
  form (Module 8's own "a form is a convenience, never the only door" rule)
  — the only bug was the inline banner above it leaking raw text. A non-router
  failure now shows a generic line pointing at the channels already visible,
  instead of repeating them, plus a `notifyMissionControl` call (reporting a
  ticket failure through the ticket endpoint would be circular).
- **`Upload.jsx`** — the whole form swaps for the escape hatch on a fatal
  error, since neither a failed `UploadPublicFile` (not a `callFunction`
  call, so never router-tagged) nor a failed `createDrawing` is something a
  form field can fix. Client-side validation ("sube una foto") stays a plain
  inline message, untouched.
- **`Account.jsx`** splits two ways: `load()` failing (family/members/
  sessions) leaves nothing to render, so that gets a full-page escape hatch
  with a retry button; the seven `run()`-based actions (role changes,
  session revoke, export, both deletes) keep the page underneath and just
  swap the top banner for the escape hatch on a non-router failure.

**`Login.jsx`, `Register.jsx`, `ResetPassword.jsx` needed a different
treatment, not the same one copy-pasted.** They call `base44.auth.*`
directly, never `callFunction` — there is no `isRouterError` to branch on.
Traced the SDK itself (`node_modules/@base44/sdk/dist/utils/axios-client.js`)
to check whether that matters: it wraps failures in a `Base44Error` whose
`.message` comes from `error.response.data.message` or `.detail` when the
server provides one, falling back to axios's own generic text only when it
doesn't. That means a real auth rejection ("Invalid credentials") is
probably already a clean, human message — hiding it behind a support panel
the way `FamilyOnboarding.jsx` does would be a regression, not a fix.
But **empirically this doesn't always hold**: the `family` function's own
404 has a `.message` field by this same logic, and `FamilyOnboarding.jsx`
still received axios's raw text in production (the original bug report) —
so `base44.functions.invoke()` evidently doesn't take the exact path this
SDK file's interceptor describes, and there's no way to verify auth calls
do either without live-testing both. Given that uncertainty, these three
keep showing `err.message` as before (translated fallback strings to
Spanish — they were the one place in this pass still defaulting to
English) and gained a persistent, low-key "¿Sigue sin funcionar? Escríbenos"
WhatsApp link next to the error, rather than either fully trusting or fully
hiding a message this codebase can't currently tell the shape of.

**Not done, and out of scope for this pass**: `Login.jsx`/`Register.jsx`'s
*entire* UI — headings, labels, buttons, not just the error fallbacks — is
in English (`"Welcome back"`, `"Continue with Google"`, `"Forgot
password?"`, etc.), which is the live, routed page per `discovered_routes`
on the deployed app, not an unrouted scaffold. That's a real, separate
violation of the portfolio's "every user-facing string in Spanish" rule,
found while looking for the narrower dead-end fix. Worth its own pass —
translating a whole page's copy is a deliberate content task, not a
three-line branch.

Verified: `npm run lint` (clean) and `npm run build` (succeeds) after every
file; `npm run typecheck` still reports exactly 84 errors, matching a
`git stash -u` baseline of the same repo state — zero new errors, all
pre-existing shadcn/JS-in-TS prop-typing gaps unrelated to this change.

### Asked Base44's own builder AI to enable backend functions — hung, no answer (2026-09-22)

Tried the one remaining lever before accepting the dashboard is the only
path: `POST /api/apps/{id}/chat` (the builder AI turn, not the REST API)
asking it directly to register/enable the six functions. Precedent for
this working existed in this same conversation thread — earlier today the
user asked the same builder AI why Secrets wasn't in the panel, and it
investigated (checked Configuración, confirmed absence) and gave a real
answer: "genuinely not in your panel for this app... CLI is the only
way... I've already flagged the missing panel option to the platform
team." So a "this is a platform limitation, here's the workaround" answer
was plausible.

**It didn't get that far — the turn hung.** `status.state` stayed
`"processing"` / `"Applying edit prompt"` for **17 minutes with zero
change** (`last_updated_date` frozen at first read) and zero new messages
ever appeared in `GET /chat/full-conversation` — not even the outbound
prompt itself, let alone a reply or a tool call. Compare every other turn
in this same conversation: all resolved in single-digit seconds. Stopped
it with `POST /chat/stop`; the log now shows the sync-commits message
from 17:06 followed directly by `<The user has stopped current
generation>` — nothing in between. Not a "the answer wasn't what I
wanted" outcome; the turn produced literally nothing before being killed.

**Net: this route is exhausted, both directions.** The REST API has no
documented operation for backend-function registration (confirmed
2026-09-22 above), and the builder-AI chat path — sanctioned for exactly
this class of platform-boundary question — hung rather than answering.
Whoever picks this up next: don't re-try `edit_base44_app` expecting a
different result without a reason to think the hang was transient: 17
minutes of zero output is not a slow turn, it's a stuck one. The Base44
dashboard itself (a human, logged in) is the only remaining path to find
or confirm a Functions/Backend panel — this sandbox has no browser session
for it.

### Backend functions deployed via `base44` CLI (2026-09-22) — closes Phase 3's real blocker

Neither the REST API nor the builder-AI chat path (both above) could
register the six functions. The CLI, run by the user directly (this
session has no shell into the user's machine), had a third, narrower
subcommand neither of the first two attempts tried: `base44 functions
deploy`, scoped to functions only — not `base44 deploy`, which CLAUDE.md's
own rules forbid here because this app has active GitHub sync and a raw
CLI deploy of the whole project would bypass it. Before recommending it,
confirmed the one thing that made it safe: `git status` clean (bar an
unrelated `package-lock.json` diff) and `HEAD` == `origin/main`, so
whatever the command deployed from the local tree was byte-identical to
what GitHub sync had already placed in Base44's file tree — no divergence
risk, same discipline as the entity-schema pushes elsewhere in this file.

**First attempt failed on a real config bug, not a platform issue.**
`purgeStaleSessions/function.jsonc` — the only function needing a
`function.jsonc` at all, since it's `type: "scheduled"` and the other five
are plain HTTP functions Base44 defaults from the directory name +
`entry.ts` — had the cron fields (`schedule_mode`, `cron_expression`) but
was missing the two fields the CLI's schema requires on every
`function.jsonc` regardless of type: `name` and `entry`. Fixed
(`"name": "purgeStaleSessions"`, `"entry": "entry.ts"`), committed, pushed
through [PR #11](https://github.com/jospabloh/artiskids/pull/11) (already
open for the dead-end-fix work), merged to `main`. The user pulled and
re-ran.

**Second attempt hit a platform concurrency limit, not a config or code
issue.** `base44 functions deploy` with no names deploys all six in
sequence but apparently doesn't wait for each to fully release its
deployment lock before starting the next — `purgeStaleSessions` and
`acaciaControl` deployed, the remaining four all failed with `Another
deployment is in progress`. Retried them one name at a time
(`base44 functions deploy content`, then `family`, `session`, `support`),
each only after the previous one finished. The very first single-name
retry (`content`) still hit the same lock error once, then succeeded ~90
seconds later on a second try — consistent with the lock from the earlier
batch attempt still draining, not a new problem.

**Verified live by content, not by CLI exit code** (`base44 functions
list` alone would only prove the CLI's own bookkeeping, not that Base44's
router actually serves them) — curled all six function endpoints directly
from inside the app's own sandbox
(`https://base44.app/api/apps/{app_id}/functions/{name}`, unauthenticated
POST). Every one now returns its **own router's** rejection instead of the
platform's generic "Backend function not found or not deployed" 404:
`acaciaControl` → `400 {"error":"missing ts/action/sig"}` (its HMAC gate),
the other five → `401 {"error":"not authenticated"}` / `{"error":
"unauthorized"}` (their auth gate). A 404 at that layer never reaches a
function's own code; a 400/401 with the function's own error shape only
comes from code that is actually running.

**What this unblocked, confirmed live by the user in a real browser
(2026-09-22, same day):** created a family, added children, and invited a
spouse — `createFamily` (the exact `/bienvenida` 404 from the earlier
screenshot), the children/`Parent`/`Relative` catalog writes, and the
member-invite path (`join_code` flow) all work end-to-end against the
deployed functions. This is the first real confirmation that the whole
chain — RLS (Phase 2) → function router → permission registry (Phase 3) →
frontend (Phase 4) — works together for an actual user, not just each
layer in isolation.

Still not exercised: uploading a drawing through the Safe path, Account's
member/session lists and danger-zone actions, and a Soporte ticket
submission. Those are the next real-world checks — the "function not
found" class that blocked Phase 3 is closed either way.

## The bridge's first sync: `bad signature`, and it was the slug (2026-09-23)

The first *Sincronizar ahora* after the registry row went in failed:

```
03:29:25 POST /api/control/run-sync 502
callBridge failed: app=artiskids (ArtisKids) action=licenses.list error=bad signature
```

With `ACCEPT_LEGACY_MASTER = false` on both sides there is no fallback, so
`bad signature` means the derived key differs: either `ACACIA_APP_SLUG` is not
exactly `artiskids`, or `INGEST_HMAC_SECRET` differs between Vercel and this
app. Neither value can be read back (Base44's secrets API is set-only). The
slug was set to `artiskids` via `POST /api/apps/{id}/secrets` — the response
said `updated`, so it already existed with some other value — and the next
sync returned 200. **It was the slug**, the same fault radar/rumbo/puntos/liuma
had in August: Phase 3's "confirmed present and matching via `base44 secrets
list`" checked the secret's *name*, never its *value*. Presence is not
correctness; only a call that fails when the value is wrong proves it.

## Private photos (2026-09-23, PR #17)

Uploads used `UploadPublicFile`: the family's one real drawing downloaded with
no login at its stored URL (HTTP 200, 3.1 MB). Now:

- `Upload.jsx` → `UploadPrivateFile` → `Drawing.image_file_uri` (not a URL).
- `content` action `imageUrls` mints one-hour signed links **server-side**,
  per requested id, only after `Drawing.get(id)` shows the stored `family_id`
  equals the caller's. Another family's id gets nothing, same as a missing one.
  Signing in the browser would make a leaked `file_uri` enough to see a photo.
- `createDrawing` refuses `image_url`; `exportData` adds day-long
  `image_download_url`s.
- Legacy `image_url` rows still display, and **their public link cannot be
  revoked** — `@base44/sdk` 0.8.49 has no delete-file method. Re-upload them.

**Deploy order matters**: schema applied → `base44 functions deploy content`,
`family` → publish frontend. **GitHub sync does not apply an entity schema to
the live database** — it only copies the `.jsonc`. After PR #17 merged, the
live `Drawing`/`User` schemas were still the old ones; they went live only via
`update_entity_schema`, confirmed with `list_entity_schemas`.

**And `base44 functions deploy` ships the local working tree, not `main`.**
The first deploy of PR #17 ran right after a `git pull` that had aborted on a
local `package-lock.json` change, so `content`/`family` went out from the
stale `37e6d59` and uploads broke until a `git stash; git pull` and redeploy
from `8fce1eb`. Before any functions deploy: `git log --oneline -1` must show
`origin/main`'s head. Frontend-first breaks uploads until the functions
land (the old `createDrawing` still requires `image_url`).

## Session reap probe (Module 20, 2026-09-23)

To prove the hourly `purgeStaleSessions` job, a fake `AppSession` was written
with `last_active_at` 50 hours old (`device_id: reap-probe-2026-09-23`). It was
still `active` at 22:48 UTC, after four scheduled runs (19:00–22:00). The job's filter itself was
confirmed to match it (`status $ne revoked`, `last_active_at $lt cutoff` via
`query_entities`), so the job either isn't being invoked or its guard refuses
the scheduler: `requireCron` wants `Authorization: Bearer <CRON_SECRET>`, and
nothing shows that Base44's scheduler sends that header. The function logs
that would tell the two apart aren't reachable from the API; the Base44
dashboard's function logs are the place to look.

The probe row could not be deleted: `DELETE /api/apps/{id}/entities/AppSession/{row}`
answered "not found" for a row `query_entities` returned in the same minute. It
was set to `revoked` / `revoked_by: probe-cleanup` instead
(`reap-probe@invalid.test`, one row). Delete it from the dashboard if it bothers.

Reading the revocation path turned up a worse bug: **`manageSession` set any
row it found back to `active`, revoked included.** "Cerrar" in Mi cuenta, or a
reap, lasted only until that device next opened the app.

Fixed without depending on the scheduler (`session/_sessionRules.ts`, tested
in `base44/functions/sessionRules.test.ts`):

- `manageSession` and `sessionHeartbeat` refuse a row that is revoked **or**
  silent for more than 48h (403, marked `revoked_by: system`).
- The refusal also rewrites that row's `device_id` to `retired:<row id>:…`.
  The browser keeps its `device_id` in `localStorage` across logouts (shared
  `useSessionManager.js`), so without this a revoked row would lock that
  browser out forever; with it, the device is refused once and its next open
  gets a fresh row.
- `listSessions` shows a 48h-stale device as *Cerrada*; `trackActivity` never
  bumps a stale row.

The reap job stays, fail-closed, as housekeeping. **Still open, and
portfolio-wide rather than this app's:** the shared `SessionExpiredDialog`'s
"Volver a iniciar sesión" calls `redirectToLogin()` without `logout()`, so the
Base44 login survives and a reload walks straight back in with a new session
row. Real re-authentication on revocation needs that shared file changed in
`acacia-app-standard`, not here.

## Module 14 — multi-tenant isolation audit (2026-09-23)

Against the **deployed** app, not the repo. Tenant = `Family`; boundary field
`family_id`.

**Schema.** `list_entity_schemas` on the live app returned all 11 entities
byte-identical to `base44/entities/*.jsonc`. Every tenant-scoped entity
(`Drawing`, `Comment`, `Reaction`, `Child`, `Parent`, `Relative`,
`SupportTicket`, `AppSession`, `RolePermission`) has the four-op `$or`:
`data.family_id == {{user.data.family_id}}` or `user_condition.role == admin`.
`Family` reads/updates on `id == {{user.data.family_id}}`; create/delete admin
only. Write-locked to the service tier: `User.family_id`/`family_role`, all of
`Family`'s billing fields and `storage_used_bytes`, and `family_id` on
`SupportTicket`/`AppSession`/`RolePermission`.

**Functions** (read line by line). Every action in `family`, `content`,
`session`, `support` starts from `getFreshCaller` — a service-role re-read of
the caller's own `User`, never the JWT or the body (Module 22). Anything that
touches an existing record checks that record's **stored** `family_id`
(`deleteDrawing`, `createComment`/`createReaction` via the target drawing,
`deleteCatalogEntry`, `setMemberRole`/`delegateAdmin`/`removeMember` via the
target user, `sessionHeartbeat`/`revokeSession` via the session plus the
caller's email). `createCatalogEntry` spreads client `data` but writes
`family_id` last, so a smuggled `family_id` is overwritten. `exportData` reads
through the caller-scoped client, so RLS itself bounds it.

**Bridge.** `acaciaControl` fails closed (503) without its secrets, verifies
the per-app derived HMAC, and whitelists entity names per action. It reads
across families **by design** — Mission Control operates every tenant of this
app; the boundary it guards is *between apps*, which the derived key enforces.

**Files.** Private since PR #17; see above. One legacy public file remains.

**Outbound.** Tickets pushed to Mission Control carry the ticket's own
`family_id`, re-derived server-side. `notifyMissionControl` sends only the
caller's own name/email. No email is sent to a family from this app.

**Tenant switching.** None exists: `createFamily`/`redeemCode` answer 409 to a
caller who already has a `family_id` (Module 18-retired).

**Closed in code 2026-09-23 (PR #17) — joining needs the admin's approval
(Module 2).** `redeemCode` used to make the caller a `member` on the spot, so
anyone holding a forwarded code saw every drawing. Now it only sets
`User.pending_family_id` (write-locked like `family_id`, and compared by no RLS
rule, so it grants nothing). The family's admin sees the request in Mi cuenta;
`approveJoinRequest`/`rejectJoinRequest` check the requester's **stored**
`pending_family_id` against the admin's own family. `joinRequestStatus` and
`cancelJoinRequest` drive the requester's waiting screen; `createFamily` and
`deleteFamily` clear stale requests. Deploy order: schema synced first, or
`redeemCode` writes a field the live `User` schema doesn't have yet.

**Could not verify from here:**
- A signed-in session as a second family's member, to watch RLS refuse
  cross-family reads end to end. There is one family in production.
- The hourly reap job (`purgeStaleSessions`) actually passing its guard — see
  "Session reap probe" below.
- `removeMember`/`deleteFamily` clearing `User.family_id` to `null`: likely
  fine (Base44 itself stores unset optional strings as `null`, observed on
  `AppSession`), but never executed against a real `User`.

## Security scanner fixes (2026-09-24 → 2026-09-25, PRs #19 and #20)

- **`RolePermission` let a `member` promote themselves.** Its create/update/
  delete RLS was family-scoped, so a member could write
  `{role:'member', permission_key:'Familia:manage_members', allowed:true}`
  and then call `setMemberRole` on themselves (or `danger_zone` →
  `deleteFamily`). Fixed on both sides: `canManageFamily` no longer reads
  overrides (the `Familia` keys are registry-only), and the entity's writes
  are admin-only. Nothing in the client writes `RolePermission`. Production
  had 0 rows, so nothing suggests it was exploited.
- **The storage quota trusted `file_size_bytes` from the client.**
  `createDrawing` now signs the stored `file_uri`, downloads it and counts the
  bytes (`countBytesUpTo`, it stops as soon as it goes over). The client still
  sends the field so deploy order doesn't matter; the server ignores it.
- **`MISSION_CONTROL_INGEST_URL` / `ACACIA_MC_INGEST_URL`**, secrets nobody
  ever registered, only let someone redirect HMAC-signed payloads. The URLs
  are now constants.

- **`createDrawing` signed any private `file_uri` (cross-family leak) —
  closed 2026-09-25 (PRs #23 and #24).** The client sends the URI and
  `imageUrls` signs it for the calling family, so an ex-member who kept
  URIs from their old family could re-attach them. `createDrawing` now
  refuses (409) any URI a `Drawing` uses **or** that sits in `RetiredFile`, a
  service-only entity where `deleteDrawing` and `deleteFamily` record every
  URI before deleting the row (the SDK can't delete the file, so it stays
  signable). `exportData` no longer exports the raw URI. The only URIs left
  unrecorded are unattached uploads, and only their own uploader knows
  those. No format assumption involved: production had no private uploads
  yet, so there were no earlier deletions to backfill. **Deploy order:**
  `RetiredFile` must exist before the functions that use it, or
  `createDrawing` and the deletes answer 500.

- **"Cerrar sesión" didn't end any login.** It only marked the
  `AppSession`; the Base44 token kept working in `content`/`family`/`support`,
  and whoever held it simply registered as a new device. Base44 can't revoke
  one token, so the revocation is **per user**: `User.sessions_valid_after`
  (write-locked), and all four routers refuse a token whose JWT `iat` is
  older (`_tokenCutoff.ts`, **identical copy** in each directory;
  `tokenCutoff.test.ts` fails if they drift). `revokeSession` and the bridge's
  `sessions.revoke` set it, so closing *one* device closes *all* of that
  user's sessions, this one included — Mi cuenta warns before doing it, and
  the client logs out on seeing `session revoked`. **Unverified:** that
  Base44's JWT carries `iat` (production has never set a cutoff). If it
  doesn't, the routers log `cutoff not enforced` and let the token through
  (refusing would lock the user out, since a fresh login wouldn't carry it
  either): the first real revoke has to confirm it in the function logs.
- **The `acaciaControl` bridge accepted replays for 5 minutes.** For the
  actions that write (`license.set`, `tickets.update`, `sessions.revoke`) a
  signature is now accepted **once**: `BridgeNonce` (service-only) keeps the
  ones already used. Reads stay replayable. The check lives in `entry.ts`,
  not in `_acaciaSign.ts`, which is a byte-identical shared copy; the right
  portfolio-wide fix (a nonce in the protocol) belongs in
  `acacia-app-standard`. Nothing deletes old `BridgeNonce` rows yet — they
  are a few per day.

**Applying a schema when the Base44 MCP has no access.** On 2026-09-25
`list_entity_schemas`/`update_entity_schema` answered "Unable to access this
app" (while `query_entities` did work), and `execute_api` rejects the
`entity-schemas` endpoints for the MCP token. The route that worked:
`npx base44 entities push` from a checkout sitting at the head of
`origin/main`. It pushes **all** entities (13 since `BridgeNonce`) and replaces whatever is live
(deleting anything missing locally), so it is only safe when the repo already
matches production. It reports every entity as "Updated" even when nothing
changed, so that list proves nothing. The CLI can't read a schema back:
verification was a screenshot of Datos → RolePermission → Permisos in the
dashboard.

**What `base44 functions deploy` answers means (settled 2026-09-25).**
GitHub sync **does** deploy functions when a merge lands on `main`: across
PRs #19–#24, every `functions deploy` run seconds after a merge from an
up-to-date tree answered `unchanged`. The day it answered `deployed` was the
day the tree was stale — `git checkout main` left the local branch **2
commits behind** `origin/main` ("Tu rama está detrás…"), and `content` and
`family` went out with #23's code over #24's, which sync had already
deployed. Nothing crashed only because #23 didn't use `RetiredFile` yet; it
was fixed with `git pull` and a redeploy (`deployed` again, now forward).
So:

- `unchanged` right after a merge = sync already deployed it. Fine.
- `deployed` right after a merge = **your tree differs from `main`**. Stop
  and check `git status` before trusting it: you just reverted to whatever
  your checkout had.
- Never run `functions deploy` if `git status` says "detrás de
  'origin/main'". And don't put `# comments` on commands you paste into
  zsh: they break (`argumento ambiguo '#'`, `missing end of string`).
- **An entity the functions use must exist before the merge**, because sync
  deploys the functions on the merge itself. #24 was merged before
  `RetiredFile` was pushed and production spent a few minutes without that
  entity (`query_entities`: "Entity schema RetiredFile not found"). Push
  the schema from the PR branch first (`npx base44 entities push`), then
  merge.

The real proof of the quota fix is a real upload — **still pending as of
this note**. If it fails with "no se pudo verificar el archivo subido", the
runtime can't `fetch` its own signed link and uploads are blocked.

## Revisión pre-lanzamiento (2026-10-02)

Medido contra producción (Base44 MCP + GitHub Actions), no copiado de notas.

**Cerrado con evidencia**
- Smoke suite: 9 de 9 corridas programadas en verde (2026-09-24 → 2026-10-02).
- Cuota por bytes reales: `storage_used_bytes` de "Mochi Family" = 7 335 213 =
  4 272 415 + 3 062 798, la suma exacta de sus dos dibujos privados subidos
  después del arreglo (2026-09-26 y 09-27). La subida real funciona.
- Plan de pago: `recuerdos` existe en Mission Control y la página pública
  muestra $129 MXN/mes, 5 GB (las notas anteriores que decían `plans: []`
  están superadas).
- `Family.tenant_id` está fijado en las 3 familias creadas desde el arreglo.
- Hay 3 familias separadas con cuentas QA (admin + miembro en una), o sea que
  el flujo crear/unir ya se ejercitó con cuentas reales distintas.

**Probado en producción el 2026-10-02 con 3 cuentas QA nuevas** (registro por
API, código OTP leído del correo, 2 familias + 1 miembro; todo borrado al final
con `deleteFamily` y `deleteMyAccount`):
- **Aislamiento entre familias.** Con la sesión de B: `GET Drawing`/`Family` de A
  → 404; listar `Drawing` → `[]`; `imageUrls` con id de A → `{}`; `PUT`/`DELETE`
  de un dibujo de A → 403/404; `createComment`/`createReaction`/`deleteDrawing`
  sobre un dibujo de A → 403 "not in your family"; `createDrawing` con el
  `file_uri` de A → 409; `PUT User.family_id` propio → 403 (campo bloqueado);
  `PUT Family.billing_status` propio → 403.
- **Unirse con código.** `redeemCode` deja `pending`; antes de aprobar no ve
  dibujos ni `imageUrls`; `approveJoinRequest` con `role: owner` o `admin` → 400
  `invalid role` (el arreglo de #27 está vivo); con `member` → entra y ve los
  dibujos; un miembro no puede promoverse, aprobar ni borrar la familia (403).
- **Revocación por `iat`.** El JWT de Base44 **sí** lleva `iat`. Tras
  `revokeSession`, el token viejo da `401 session revoked` en `family`, `content`
  y `session`; otro usuario no se afecta; un login nuevo funciona.
- **Zona de peligro.** `deleteFamily` borra familia y dibujos, deja `family_id`
  en `null` en todos los usuarios (incluido el miembro) y registra el archivo en
  `RetiredFile`; `deleteMyAccount` elimina al usuario.
- Subida privada + `createDrawing` + `imageUrls` firmada: funcionan de punta a
  punta con una cuenta recién creada.
- Nota de método: desde el sandbox hay que enviar un `User-Agent` tipo curl; con
  el de `urllib` Cloudflare responde 403 HTML antes de llegar al router.

**Sigue abierto**
- **Job de reap (`purgeStaleSessions`).** Las sesiones `passive` del dueño con
  última actividad del 23 y 26 de septiembre siguen sin pasar a `revoked`: el job
  no está reapeando. El endpoint `functions-mgmt/{name}/logs` responde `[]` hasta
  para `session` (recién invocada), así que no distingue "no se invoca" de "el
  guard lo rechaza". Mitigado: la regla de 48 h dentro de `session` rechaza esas
  sesiones igual. Ver los logs en el panel de Base44.
- **Cobro por Mercado Pago de punta a punta** (pagar → `active`): no probado, por
  decisión del dueño de no hacer pagos de prueba.
- **Imagen legacy pública** ("Día del padre", familia Mochi): sigue abierta sin
  login; el SDK no puede borrar el archivo. Hay que resubirla desde la cuenta.

## ACACIA Portfolio Standard — status (revisado 2026-10-07)

`[x]` hecho y probado donde se puede probar · `[~]` hecho con una brecha
nombrada · `[ ]` abierto. Texto completo de cada módulo:
`acacia-app-standard/CHECKLIST.md`.

- [x] 1 License lifecycle — `billing_status` write-locked; prueba de 30 días
      fijada en servidor; el cron unificado de Mission Control cubre la app.
      Plan `recuerdos` ($129 MXN/mes, 5 GB) existe. Cobro MP de punta a punta
      sin probar, por decisión del dueño (sin pagos de prueba).
- [x] 2 Roles — dos roles, guardia de cero admins, código de unión es
      solicitud-y-aprobación; probado en producción con cuentas QA (2026-10-02).
- [x] 3 Permissions — registro único, re-chequeo en servidor en cada escritura,
      compuerta de billing, **y desde 2026-10-07 la matriz de Permisos es
      editable** (ver "Cierre de brechas" abajo). `can()` oculta en la UI lo
      que el rol no puede hacer.
- [x] 4 RLS — `$or` de cuatro operaciones en todo, desplegado = repo.
      `validate:rls` corre en CI (`.github/workflows/ci.yml`) desde 2026-10-07.
- [x] 5 Health — ping de `acaciaControl`; `app_health` `ok`.
- [x] 6 Changelog — `APP_VERSION`/changelog vía `scripts/release.mjs`.
- [x] 7 Account & danger zone — borrar cuenta y borrar familia piden
      **confirmación escrita** (nombre de la familia / `ELIMINAR`) desde
      2026-10-07; promover a admin tiene su propio paso de confirmación.
- [x] 8 Support — `SupportTicket` + push en tiempo real a Mission Control.
- [x] 9 acaciaco-site page — `apps/artiskids.html`.
- [x] 10 Login — pantalla dividida, español, Google, OTP por correo.
- [x] 11 Deploy discipline — adaptado al GitHub sync (ver Frozen decisions).
- [x] 12 Theme — selector compartido; tablet/móvil sin traslapes (PR #32).
- [x] 13 Smoke test — 13 de 13 corridas programadas en verde
      (2026-09-24 → 2026-10-06).
- [x] 14 Isolation audit — 2026-09-23, re-probado contra producción con
      cuentas QA el 2026-10-02.
- [x] 15 Bridge — llave derivada, `ACCEPT_LEGACY_MASTER = false`, probado.
- [~] 16 Secrets — `ACACIA_APP_SLUG` e `INGEST_HMAC_SECRET` probados por sync.
      `CRON_SECRET` ya no lo lee ninguna función (el job de reap quedó sin
      guard, decisión del dueño 2026-10-07); el secreto puede borrarse.
      `PLATFORM_OWNER_EMAIL` solo se usa en `deleteMyAccount`; sin probar.
- [x] 17 Mission Control side — fila, adaptador, configuración, sync probado.
- [x] 18 Retired — una cuenta, una familia; 409 a una segunda.
- [x] 19 Locks state their rationale in their own field descriptions.
- [~] 20 Session control — aviso de inactividad, lista de dispositivos,
      revocación por `iat`, y la regla de 48 h dentro de `session` **probada en
      producción** (3 filas `revoked_by: system` con `device_id` retirado).
      **Brecha: el job horario `purgeStaleSessions` nunca ha limpiado nada** —
      ver "Cierre de brechas".
- [x] 21 About screen.
- [x] 22 Server-authoritative diffing — `getFreshCaller` en cada router.
- [x] 23 Nav survives reload — derivada de la ruta.

## Cierre de brechas (2026-10-07)

**Módulo 3 — Permisos editable.** `family` gana `listPermissions` (cualquier
miembro lee los overrides de su familia) y `setPermission` (solo quien pasa
`canManageFamily(…, "manage_members")`). Escriben las mismas filas
`RolePermission` que `content/canWrite()` ya leía; no hay una segunda
fuente de configuración. La validación vive en
`family/_permissionOverride.ts` (sin imports, probada en
`base44/functions/permissionOverride.test.ts`):
- solo los roles `family_admin` y `member`, solo claves del registro;
- **la sección `Familia` se rechaza**: una fila que concediera
  `Familia:manage_members` reabriría la escalada cerrada el 2026-09-24;
- poner un valor igual al default (o `null`) **borra** la fila en vez de
  guardarla, así la tabla solo contiene desviaciones reales; filas duplicadas
  se eliminan (con dos filas, el "primera gana" de `canWrite` sería arbitrario).

`src/pages/Permisos.jsx` es la matriz (filas = acción, columnas = rol), con
interruptor explícito "Editar permisos", casilla tri-estado por sección,
"Restablecer" por sección y un punto ámbar en cada valor que es decisión de
la familia. `src/lib/usePermissions.js` expone `can()` con la misma
precedencia que el servidor; oculta subir (Home, `/subir`), comentar,
reaccionar, borrar dibujo y editar el catálogo cuando el rol no puede.

**Módulo 4 — CI.** `.github/workflows/ci.yml` en cada PR y push a `main`:
lint, `validate:rls`, `validate:functions`, manifiestos de permisos al día
(regenerar debe ser no-op), build y `deno test --allow-read`.

**Módulo 7 — confirmación escrita.** `src/components/TypedConfirmDialog.jsx`:
borrar la familia exige escribir su nombre; borrar la cuenta, `ELIMINAR`.
"Hacer admin" ahora confirma y dice que quien promueve sigue siendo admin.

**Módulo 20 — por qué el job horario nunca reapeó (causa medida; arreglo
abajo, "Opción 1").** Un `POST` sin cabeceras a la función desplegada
responde `401 {"error":"unauthorized"}` (2026-10-07). Es justo lo que recibe
el programador: según la documentación de Base44, una automatización
programada invoca la función sin usuario y sin cabeceras propias, y
`requireCron` exige `Authorization: Bearer <CRON_SECRET>`. Sesiones inactivas
desde el 22-23 de septiembre siguen `passive`. El arreglo del PR #31 (mover la
programación dentro de `automations`) era necesario pero no suficiente.

Quitar el guard quedó primero **bloqueado a propósito** como debilitamiento de
seguridad, a la espera de la decisión del dueño. **El dueño eligió la opción 1
el 2026-10-07**: `purgeStaleSessions` ya no tiene guard y `_internalGuard.ts`
se borró; el razonamiento quedó en el comentario de su `entry.ts`. Las
opciones eran:
1. Dejar el job sin guard: no recibe datos, no devuelve datos, y solo revoca
   lo que `session` ya rechaza (más de 48 h). Lo peor que logra un extraño es
   adelantar esa limpieza.
2. Mantener el guard y que lo llame Mission Control con el secreto (o por el
   puente firmado con una acción `sessions.reap`) en su cron diario. Requiere
   cambios en `acacia-mission-control`.
3. No hacer nada: la seguridad ya la da `session` (probado); el costo es que
   Mission Control y "Mi cuenta" cuentan sesiones muertas como vivas.

El ejemplo canónico `shared/session/purgeStaleSessions.example.ts` del
estándar tiene el mismo defecto: cualquier app Base44 que lo copió tiene el
job muerto.

**Desplegado y probado en producción (2026-10-07, PR #35, `d590d30`).**
`POST …/github/sync` trajo los 4 commits y el árbol de Base44 quedó con los
mismos SHA-256 que `main`, **pero la función `family` seguía vieja**
(`listPermissions` → `404 unknown action`). Lo que la desplegó fue **publicar**
(`POST …/deploy`): después, `listPermissions` → `403 not in a family` (código
nuevo) y el bundle servido trae "Editar permisos" y "Para confirmar, escribe".
Con una cuenta QA nueva (`+ak1007p`, borrada al final junto con su familia):
`Familia:manage_members`, `Dibujos:upload:junk` y `constructor:name` → 400;
`Dibujos:upload=false` para `family_admin` → `listPermissions` lo muestra y
`content/createDrawing` responde `403 not allowed to upload`; `allowed:null`
→ la fila desaparece y la subida vuelve a pasar el permiso. **No probado en
navegador:** la matriz y el diálogo de confirmación escrita (sin sesión
gráfica desde el sandbox).

**Herramienta nueva.** La API de Base44 tiene `GET …/backend-functions`,
`GET …/functions-mgmt/{name}/logs` (devuelve `[]` incluso para funciones que
sí corren — no sirve como evidencia) y
`POST …/coding/redeploy-function/{name}`.

## Verificación por código en Login y rol elegido al aprobar (2026-09-30)

**Qué cambió**
- `src/components/VerifyEmailStep.jsx` (nuevo): paso de código OTP compartido por
  Register y Login (`verifyOtp({email, otpCode})`, `resendOtp`, errores en español,
  enlace a WhatsApp). Tras verificar: si el SDK devuelve token lo guarda; si no,
  hace `loginViaEmailPassword`; si eso falla, manda a `/login`. "Usar otro
  correo" vuelve al formulario.
- `src/lib/emailVerification.js`: `needsEmailVerification(err)` (regex sobre el
  mensaje de Base44, como en stockflow). Login lo usa: si el login falla por
  correo sin verificar, reenvía un código y abre el paso de código en vez de
  mostrar el error crudo; los demás errores conservan su mensaje.
- Register ya tenía pantalla de código; ahora usa el componente compartido (sin
  duplicar).
- `family/approveJoinRequest` acepta `role` y lo valida contra la lista blanca
  `family/_assignableRoles.ts` (`family_admin`, `member`; nunca un rol de
  plataforma). Sin `role` = `member` (clientes viejos en caché); un rol fuera de la
  lista responde 400 antes de leer nada. Mi cuenta muestra un selector de rol por
  solicitud. Prueba: `base44/functions/assignableRoles.test.ts` (5/5 con deno).

**Ya cumplía (auditado, sin cambios)**
- Crear familia: `createFamily` deja `family_admin`, tenant escrito por servidor
  como servicio; `User.family_id/family_role` con `rls.write` solo admin.
- Unirse con código: `redeemCode` solo escribe `pending_family_id` (no otorga
  nada; ninguna RLS lo compara); la espera sobrevive a recargas
  (`joinRequestStatus`); solo `approveJoinRequest` escribe `family_id/family_role`,
  releyendo la fila almacenada del solicitante y comprobando que el que llama es
  admin de ese tenant; `rejectJoinRequest` igual. `setMemberRole`/`delegateAdmin`
  exigen que el objetivo ya esté en la familia. 409 si ya tiene familia se conserva.
- No se encontró ruta que salte la aprobación.

**Comprobaciones:** `npm run lint`, `build`, `validate:rls`, `validate:functions`
en verde; `deno test` del test nuevo 5/5; `deno lint base44/functions` mantiene los
15 avisos preexistentes (imports npm:/jsr: sin versión), ninguno nuevo;
`typecheck` solo con los errores shadcn preexistentes.

**NO verificado:** un registro/login real con correo sin verificar (el texto exacto
del error de Base44 no se pudo comprobar, por eso el regex es amplio; si no
coincide, el usuario ve el error crudo como antes); que `verifyOtp` devuelva o no
token; el selector de rol contra la función publicada; `deno test` de las suites
que importan de `jsr:` (bloqueado en el sandbox).

**Desplegar (orden):** sin cambios de esquema. (1) Mergear a `main` (Base44
sincroniza por GitHub; nunca `base44 deploy`). (2) Publicar. (3) Verificar por
contenido: llamar `family` `approveJoinRequest` con `role:"admin"` sin sesión
elevada da 401 en código nuevo o viejo, así que la prueba útil es un admin real
aprobando con `role:"owner"`: debe dar 400 `invalid role` (código viejo lo
aprobaría como member). Comprobar `git status` limpio y al día con `origin/main`
antes de cualquier `functions deploy` manual.

### Seguimiento de la revisión de Codex (2026-09-30)

`Register.jsx`: al verificar el código sin sesión resultante (`needsLogin`), el envío
a `/login` conserva ahora el `returnTo` ya validado por `safeReturnTo()` (mismo
patrón del enlace "Inicia sesión" de la página), para que un flujo de consentimiento
pueda retomarse. Sin cambios de función ni de esquema; esta app tiene sincronización
con GitHub, así que no se ejecutó ningún `base44 deploy`. Verificado: `lint`, `build`,
`validate:rls`, `validate:functions` y `deno test --allow-env --allow-read
base44/functions/`. No verificado en navegador.

## Mi cuenta no cargaba para el dueño: `Family.tenant_id` (2026-10-01)

**Causa:** la regla RLS de `Family` comparaba el `id` de la fila con
`{{user.data.family_id}}`. Esa forma devuelve vacío/404 al propio creador (una regla
`data.<campo>` contra la misma plantilla sí empareja). `/cuenta` hace
`Family.get(user.family_id)`, fallaba, y ningún admin veía el código de unión ni
podía aprobar/rechazar solicitudes ni cambiar roles desde la UI.

**Arreglo:** campo `Family.tenant_id` (copia en texto del id de la fila) con candado
`rls.write` solo `role: admin` (CRÍTICO: sin candado un miembro podría apuntarlo a
otra familia y leerla). Las reglas read y update añaden
`{"data.tenant_id": "{{user.data.family_id}}"}` dentro del mismo `$or`, conservando
las ramas `id` y admin. `family/createFamily` fija `tenant_id = id` (service role) y
si falla ese paso o el de `User` borra la familia recién creada. Relleno aditivo
hecho con `tenant_id = id` en las familias existentes.

**Regla:** cada cambio de RLS de un tenant se prueba leyéndolo como el dueño recién
creado (cuenta nueva -> crear familia -> `GET entities/Family` con su token) y
comprobando que otra familia NO puede leerlo.

**Defecto 2 (login sin verificar):** el código ya estaba en main (#27) pero el sitio
publicado seguía con el bundle anterior; se resolvió publicando (sync + deploy).

## `createFamily` ya no borra la familia si el `User.update` sí tomó (2026-10-02, PR #29)

Hallazgo P2 de Codex sobre el PR #28: el `catch` de `createFamily` cubría tanto
`Family.update(tenant_id)` como `User.update(family_id)`. Si el segundo se
confirmaba pero su respuesta HTTP se perdía, el `catch` borraba la familia y
dejaba `User.family_id` apuntando a una fila inexistente (reintento → 409, sin
salida desde `/cuenta`). Ahora el `catch` relee el `User` como servicio y solo
compensa si de verdad no quedó vinculado; si sí, responde éxito con el mismo
helper `respondFamilyCreated` del camino normal.

**Desplegado:** sync + `coding/redeploy-function/family`, verificado por
contenido en el sandbox. **Verificado en vivo** con una cuenta QA nueva:
crear familia → 200, reintento → 409. **No verificado:** la pérdida real de la
respuesta HTTP (no se puede provocar desde aquí); cubierto por lectura de código.
