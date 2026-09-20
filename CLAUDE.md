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
- **Deploy discipline:** adopt Module 11's CLI path (`npm run deploy`,
  `deploy:site`, `deploy:entities` with typed confirmation,
  `validate:functions` capped at 40). The current `README.md`'s "publish via
  GitHub sync + dashboard" instruction is being replaced in Phase 1 — Base44
  functions don't auto-deploy from GitHub sync (see
  `acacia-app-standard/docs/incidents.md`), so that path silently ships a
  backend that never updates.
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

## Rollout phases

Tracked module-by-module against `acacia-app-standard/STANDARD.md`
(22 active modules, module 18 retired — see there for the full text).
Each phase is its own PR per repo; nothing gets deployed without a human
running the command and Sonnet verifying by re-reading served
content/schema, never by hash or by assuming a merge shipped.

0. **Frozen decisions + live-state verification** (this section). Done
   2026-09-20.
1. **Repo hygiene & deploy discipline** — dead Stripe deps out, branding,
   `base44.app.json` + deploy/validate scripts, `.env.example`, changelog
   scaffold. Modules 6 (scaffold), 11, 16 (inventory).
2. **Family/roles/RLS schema** — `Family` entity, `family_id`/`family_role`
   on `User` and all tenant entities, four-op RLS with the explicit
   service-role admin branch on every op, `SupportTicket`/`AppSession`/
   `RolePermission` entities, `validate-rls` script. Modules 1 (field), 2, 4,
   18-retired, 19. **Pauses before `deploy:entities`** — that push can delete
   remote entities, so it's human-run only, confirmed by content diff after.
3. **Backend functions, Mission Control bridge, secrets** — the
   `acaciaControl` bridge (`_acaciaSign.ts` copied unchanged from
   `shared/bridge/`, `ACCEPT_LEGACY_MASTER = false`), family/content/session/
   support function routers, the permission registry + generator. Modules 3
   (server half), 5, 7 (server half), 8 (server half), 15, 16, 20 (server
   half), 22. **Pauses before functions deploy and before secrets are set**
   in Base44 (`INGEST_HMAC_SECRET`, `ACACIA_APP_SLUG=artiskids`,
   `PLATFORM_OWNER_EMAIL`, `CRON_SECRET`) — those are the platform-owner
   identity and the bridge trust root.
4. **Frontend compliance** — real routed login/register/forgot/reset
   (dropping the `redirectToLogin` fallback to Base44's hosted login), the
   shared `ThemeSwitcher` copied unchanged, direct entity writes replaced by
   function calls, Account/Permisos/Soporte/About pages, session idle
   warning + device list. Modules 10, 12, 3 (client), 7 (UI), 8 (UI), 20
   (client), 21, 23, 6 (surfacing).
5. **Mission Control + acaciaco-site** — registry migration (`url: null`),
   `licenseControl.js`/`ticketControl.js`/`messaging.js` entries +
   `licenseCatalog.js` mirror, `apps/artiskids.html` +
   `soporte.html`/`KNOWN_APPS` entry. Module 9, 17. **Pauses before the
   migration runs against production Supabase** — it's read by every cron
   from that point on.
6. **Deploy, prove, audit, cut over** — human-run deploys, *Sincronizar
   ahora* → `app_health` + `control:run-sync` proof, smoke suite wired to
   `.github/workflows/smoke.yml`, session-reap gate exercised, the dated
   Module 14 isolation audit (against the deployed schema, with an explicit
   "could not verify" list), then DNS + the Mission Control URL migration.
   Modules 13, 14, 5 (proof), 16 (proof), 17 (proof), 1 (proof). **Pauses at
   domain cutover.**

Rules for whoever executes a later phase: never pass `--app-id`; never run
`entities push` without the typed confirmation; migrate additively, never
narrow a live RLS rule even with zero real data — it's the habit that
matters, not this instance; never put a secret in the repo or under a
`VITE_` prefix; never edit a copied `ThemeSwitcher.jsx`/`smoke.spec.js`/
`_acaciaSign.ts`/`shared/session/` file in place — the portfolio-wide
mirror check depends on them staying byte-identical; never touch another
app's repo or Mission Control entry from here.
