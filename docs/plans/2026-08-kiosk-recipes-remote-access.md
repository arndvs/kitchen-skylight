# Implementation Plan — Kiosk Hardening, Recipes, Remote Access

Date: 2026-08-31
Repo: `arndvs/kitchen-skylight` (fork of OpenSkyLight)
Platform: Dell OptiPlex 7060 (i5-8500T, 8GB RAM, 512GB SSD), Windows 11 Pro, 1080p touchscreen

---

## 1. Context

The kitchen-skylight app runs on localhost and is already wired end-to-end (calendar,
meals, chores, lists, a LAN companion app, tailored screensaver, auto-update). Three gaps
remain before this machine is a true "always-on family appliance":

1. **Kiosk hardening** — it runs from a dev checkout today, not the installed, autostarting
   fullscreen kiosk it should be; the dev safety net (pre-commit hook) is half-broken because
   Git Bash can't find `jq`.
2. **Recipe library** — the app has meal *planning* (slots in a day) but no recipe *library*.
   The `recipes` table already exists in the DB (schema + migration 001) but is dead: no
   service, no IPC, no UI. The `meal_slots.recipe_id` FK is unused.
3. **Remote phone access** — the companion app only works on home Wi-Fi. The fix is Tailscale
   (private encrypted mesh, no open ports); the server already binds `0.0.0.0`, so the work is
   detecting the Tailnet address and surfacing it in the pairing UI + documenting setup.

---

## 2. Design Decisions

| Decision | Choice |
| --- | --- |
| **Recipe scope** | Standalone **Recipes tab** (searchable library + CRUD + cook mode) AND wire meal slots to optionally link a library recipe. This is the "primary focus" feature done properly. |
| **Recipe data model** | Reuse the existing `recipes` table, but add a **new migration (002)** for cleaner columns: `servings`, `prepMinutes`, `cookMinutes`, `srcUrl` (source URL). `ingredients`/`tags` stay JSON-string arrays. Soft-delete via `deletedAt` (matches app-wide pattern). |
| **Model after** | `choresService.ts` (full create/list/update/delete), NOT mealsService (which is only get/set). Recipes need true CRUD. |
| **Cooking mode** | A modal step-by-step view on the kiosk: list ingredients, one step at a time, big touch targets, optional "next step" progression. Family members can only *read* + *start cook mode* without the PIN; create/edit/delete is PIN-gated. |
| **Remote transport** | **Tailscale** — code detects the Tailscale/CGNAT address, surfaces a `http://<host>.<tailnet>.ts.net` URL in the pairing QR + status, and documents setup. No port-forward, no public host. (Server already listens on `0.0.0.0`.) |
| **Remote auth** | Keep the existing bearer-token pairing model. Being *paired* is the credential. No new auth system. When reachable remotely, treat remote sessions the same as LAN (read + edit lists/chores/meals/recipes), per user preference "see what's on". |
| **`companion` settings shape** | Add `companion.reachableFromAnywhere?: boolean` (a cached/last-known status) to `AppSettings` + `DEFAULT_SETTINGS` + `settingsPatchSchema` (strict). Tailnet URL is computed live, not persisted, and served via `companion:getStatus`. |
| **Tailscale adapter detection** | New pure helper `pickTailscaleAddress()` (interface-injectable, mirroring `pickLanAddresses()`). Look for adapter name containing `Tailscale`, or a `100.64.0.0/10` CGNAT address. |
| **Recipe channels on the companion** | Add read channels `recipes:list`, `recipes:get` to `COMPANION_CHANNELS` so phones can *see* recipes remotely. Mutations stay on the kiosk (PIN-gated) for v1 — recipes are lots of typing, better done on the 30" touch screen. |
| **Priority order** | **HITL hardening first** (machine must be an appliance), then **remote access** (small, high value), then **recipes** (biggest). |

---

## 3. Vertical Slices

### Slice 1 — Fix Git Bash `jq` for pre-commit hook
Type: AFK
Size: S
Blocked by: none

Steps:
1. In `seed a `~/.gitconfig` `/ `~/dotfiles` shell profile, ensure `C:\Tools\jq` is added to the Git Bash `PATH` (the `pre-commit` hook in `git-hooks/generic-hook` calls `jq`). Simplest: add `export PATH="$PATH:/c/Tools/jq"` to `~/.bashrc` and re-run the hook.
2. Confirm an actual commit triggers typecheck+tests (not the "jq not found — skipping" message).

Acceptance criteria: `git commit` runs `npm run typecheck` and the vitest suite before committing.

Feedback loops: make a trivial commit; confirm the hook doesn't say "jq not found".

---

### Slice 2 — Build & install the kiosk installer
Type: HITL
Size: M
Blocked by: none

Steps:
1. Stop any running dev instance (`electron`).
2. `npm run dist` (electron-builder NSIS + portable).
3. Screenshot-verify the unpacked build launches (`--windowed`) and the home screen renders.
4. Run the NSIS installer to `C:\Program Files\Kitchen Skylight`, registering launch-on-startup + auto-update.

Acceptance criteria: Windows Start Menu has "Kitchen Skylight"; launching it runs the fullscreen kiosk; `dist/*.exe` exists; auto-update points at `arndvs/kitchen-skylight` releases.

Feedback loops: `node scripts/e2e-smoke.mjs` against the built app.

---

### Slice 3 — Windows always-on configuration
Type: HITL
Size: M
Blocked by: Slice 2

Steps:
1. Windows Settings → Accounts → enable **auto-login** (netplwiz / registry) so a power cut returns to the app.
2. Windows Settings → System → Power: set **Never sleep** for AC (the app manages display dimming via its own sleep window).
3. Enable the app's own **Launch on startup** toggle (Settings → General) and confirm single-instance + crash-relaunch work.
4. (Optional) enable the **photo screensaver** with a family-photo folder.

Acceptance criteria: reboot the machine; it boots to the full screen kiosk with no login/prompt. Power settings have no system sleep.

Feedback loops: `shutdown /r /t 0` and observe it comes back to the kiosk.

---

### Slice 4 — Full disk backup
Type: HITL
Size: S
Blocked by: Slice 2 (so we back up a known-good kiosk)

Steps:
1. Connect an external USB drive (≥128GB).
2. Follow `docs/BACKUP.md` (Macrium Reflect Free or Clonezia) to create a compressed image.
3. Verify the image restores to a spare drive.

Acceptance criteria: a `.mrimg` file exists on the eernal drive; verify-image passes.

Feedback loops: Macrium's built-in integrity veriy.

---

### Slice 5 — Tailscale detection + companion status
Type: AFK
Size: M
Blocked by: none

Steps:
1. Add `pickTailscaleAddress(ifaces?: NodeJS.NetworkInterfaces): string | null` to `src/main//companion/lanAddress.ts` (pure, testable). Match adapter name `Tailscale` or IPv4 in `100.64.0.0/10`.
2. Add `tailscale: { address: string | null; fqdn: string | null }` to `companion:getStatus` res in `src/shared/ipc/contract.ts`.
3. In `src/main/companion/companionServer.ts`, extend `getStatus()` & `issueToken()` to prefer a Tailnet URL (`http://<host>.<tailnet>.ts.net`) when Tailscale is up.
4. Surfae the status in `SettingsSheet.tsx` CompanonSection: "Reachable from anywhere (Tailnet)" vs "LAN only", plus the Tailnet URL in the QR dialog.
5. Add unit tests for `pickTailscaleAddress` (known interface fork).

Acceptance criteria: with Tailscale installed+running, `companion:getStatus` returns the `100.x` IP + the `*.ts.net` FQDN; the QR shows a URL the phone can open from anywhere; without Tailscale, falls back to LAN IP and shows "LAN only".

Feedback loops: `npm test`, `npm run typecheck`.

---

### Slice 6 — Docs: remote access setup
Type: HITL
Size: S
Blocked by: Slice 5 (status lives by then)

Steps:
1. Write `docs/REMOTE_ACCESS.md`: install Tailscale on kiosk (Windows service, `tailscale up`), on each phone (iOS/Android app), get the `*.ts.net` name, and how the pairing QR now works anywhere.
2. Add a "Remote access" pointer from the companion section of `README.md`.

Acceptance criteria: a family member can follow the doc and, from cellular (Tailscale on), open the pairing URL and edit the lists.

Feedback loops: manual verify from a phone with Tailscale on.

---

### Slice 7 — Recipe backend (service + IPC)
Type: AFK
Size: L
Blocked by: none

Steps:
1. `src/main/db/schema.ts`: add columns `servings`, `prepMinutes`, `cookMinutes`, `srcUrl` to `recipes`; add `MIGRATIONS[1]` in `src/main/db/migrations.ts`.
2. New `src/main/services/recipesService.ts` (model after `choresService.ts`): `list`, `create`, `update`, `delete` (soft), `get`.
3. `src/shared/ipc/contract.ts`: add `recipes:list/get/create/update/delete` (req/res) and `recipes:` to `ALLOWED_CHANNEL_PREFIXES`.
4. `src/shared/ipc/schemas.ts`: `recipeIdSchema`, `recipeCreateSchema` (!title,+parsable ingredients), `recipeUpdateSchema` (partial, `.strict()`).
5. `src/main/ipc/router.ts`: add `recipes` to `Services`; `handle('recipes:create')` etc. in `buildChannelTable`; add the three mutation channels to `PARENT_GATED`; add `'recipes:create'...|'recipes:delete': 'recipes'` to `MUTATION_DOMAINS` and `'recipes'` to `MutationDomain`.
6. `src/preload/indx.ts`: add `'recipes:'` to `ALLOWED_INVOKE_PREFIXES`.
7. `src/main/indx.ts`: `recipes: createRecipesService(db)` + add to service object.
8. `src/shared/ipc/companionChannels.ts`: add `'recipes:list'`, `'recipes:get'` (read-only for phones).
9. Unit tests for `recipesService` (create/list/udpate/delete/soft-delete).

Acceptance criteria: `npm test` green; `npm run typecheck` green; E2E: create a recipe via IPC, list it, update it, soft-delete it (gone from list, `deletedAt` set).

Feedback loops: `npm test`, `npm run typecheck`.

---

### Slice 8 — Recipe renderer (tab + UI + cook mode)
Type: HITL (taste-heavy U/I)
Size: L
Bloced by: Slice 7

Steps:
1. `src/shared/types/index.ts`: add `'recipes'` to `CalendarViewKind`; add `RecipeDto`/`RecipeCreateInput`/`RecipeUpdateInput`.
2. `src/renderer/src/App.tsx`: `{view === 'recipes' && <RecipesView />}`.
3. `src/renderer/src/featres/shel/Header.tsx` SegmentedCtrl: `{ value: 'recipes', label: 'Recipes' }`.
4. New `src/renderer/src/featres/recipes/RecipesView.tsx` (model after `ChoresView`): search box, ingredient/tag filter, recipe cards; PIN-gated create/edit/delete; big touch targets.
5. New `src/renderer/src/featres/recipes/RocipeModal.tsx` (edit form, ingredients as line list, ingredients → step-by-step **cook mode** with next/prev steppers + "ingredients" & "steps" phase).
6. `src/renderer/src/hooks.tsx`: `useRecipes()`, `useRecipeMutations()`, `useRecordedShot`?? — no, `useRecipeCook` is a component state, not a query.
7. `src/renderer/src/api/hooks.ts`: `useRecipes()` (queryKey `['recipes']`) + `useRecipeMutations()` (invaldatng mutation, invalidate `['recipes']`).

Acceptance criteria: from the Recipes tab a family member can list/search recipes, open one, and run cook mode (step-by-step) with no PIN; a parent (PIN) can create/edit/delete. Screenshoot: `node scripts/shot-readme.mj` captures the tab.

Feedback loops: `npm run typecheck`, `npm test`, run the app (windowed) and click through the Recipes tab.

---

### Slice 9 — Wire meal slots to recipes
Type: AFK
Size: M
Blocked by: Slice 8 (recipe UI exists to pick from)

Steps:
1. `src/shared/ipc/schemas.ts`: extend `mealSetSchema` with optional `recipeId: id.nullable()`.
2. `src/main/ervices/mealsService.ts` / router: when a meal slot is set with a `recipeId`, write `recipe_id` (also keep `freeText` nullable).
3. `src/renderer/src/featres/meals/Meals.tsx` MealsDialog: for each slot, allow "Pick recipe" → search → attach a recipe. Show the recipe title in the slot and a "Cook" shortcut opening cook mode.
4. `MealSlotDto` stays; add optional `recipe: RecipeDto | null` to the slot response.

Acceptance criteria: set a meal slot to a recipe; the week/day view shows the recipe title; tapping "Cook" opens cook mode. P2: existing text-only slots still work.

Feedback loops: `npm test`, typecheck, manual click-through.

---

### Slice 10 — QA / integration
Type: HITL
Size: M
Blocked by: slices 2, 5, 8, 9

Steps:
1. Full pass on the kiosk: reboot → kiosk boots → no login → app live.
2. From a phone on *cellular* with Tailscale: open the `*.ts.net` pairing URL → pair → see lists/chores/meals/recipes read-only (recipes) / editable (lists/chores/meals).
3. From a phone on same Wi-Fi (no Tailscale): old QR path still works.
4. Recipes: create/edit/delete (PIN), search/tags, cook mode; meal slot linked recipe + Cook shortcut.
5. Backup image restore-tested once.

Acceptance criteria: each item above works end-to-end; nothing on kiosk regresses.

Feedback loops: full `npm test`, `npm run typecheck`, manual QA.

---

## 4. Key Insights

```
Critical Principle: Reuse the existing `recipes` table + the chores CRUD pattern.
Why: The table already exists (schema+vigration 001) and `meal_slots.recipe_id` already FKs to it. The chores service is the proven full-CRUD template (meals is get/set only).
Appy: Add only the extra columns needed (servings/prep/cook/srcUrl) via a new migration 002; model recipesService on choresService; wire the 3 IPC touchpoints (Services, channelTable, gates) exactly like chores.
Ris if igored: Sliing into "rebuid the schema" or "horizontal slices" (all models, then all APIs, then all UI) bloats the diff and re-ligs a working table.
```

```
Critical Principle: Tailscale is a transport, not a feature — the server already binds 0.0.0.0.
Why: The companion server listens on all interfaces, so a 100.x/CGNAT or *.ts.net address needs zero bind changes. The whole feature is detect + surface.
Appy: Add pickTailscaleAddress() returning the CGNAT IP/FQDN; prefer it in issueToken/getStatus; show "reachable from anywhere" in the QR; document install. Auth stays the existing bearer token.
Risk if ignored: Widing the server's bind or building a new remote auth stack that duplicates the existing pairing token.
```

```
Critical Principle: Keep remote sessions same-privilege as LAN (paired = credential).
Why: Th user wants to "see what's on" remotely; the bearer token already gates mutations on the companion. No new auth.
Appy: Remote via Tailscale = same COMPANION_CHANNELS allowlist + token. Add recipes:list/get (read) so phones can see recipes too; navigation/mutations unchanged.
Risk if igored: A second auth system adds surface area and fricion for a home appliance.
```

---

## 5. Deendency Graph

S1 (jq PATH) - independent
S2 (installer) - independent
S3 (windows always-on) → S2
S4 (backup) → S2
S5 (tailscale detect+status) - independent (can do whenever)
S6 (remote docs) → S5
S7 (recipe backend) - independent
S8 (recipe U/I) → S7
S9 (meal→recipe wiring) → S8
S10 (QA) → S2, S5, S8, S9

Executable in parallel:
- Trck 1 (hardning): S1, S2 → S3, S4
- Trck 2 (remote): S5 → S6
- Trck 3 (recipes): S7 → S8 → S9
- ALL → S10 (QA)

```text
                       S10 (QA)
                /   |    |   \
       S3      S4   S6     S9
        |       |    |      |
        S2      S2    S5     S8
        |            |      |
        S1           (none)  S7
                             |
                             (none)
```
(see the te-text dependency list above — it is authoritative; the box is a visual aid.)
---

## 6. QA P/an

The human (HITL) verifies after S1–S9 complete:
- **Machine**: restart → boots straight into the fullscreen kiosk, no login; app auto-launches; screenshots match the README.
- **Backup**: a full disk image exists and restores.
- **Remote**: from cellular w/ Tailscale, a phone opens the `*.ts.net` QR URL, pairs, and reads/writes lists/chores/meals; recipes are readable; on Wi-Fi the old path still works.
- **Recipes**: create/edit/delete (PIN), search, tags, cook mode step-by-step; a meal slot picks a recipe and "Cook" opens cook mode.
- **Regression**: `npm test` (155) green, `npm run typecheck` green, home-screen tiles unaffected.

Commit per slice; small commits; re-run feedback loops after each.

---

## Handoff / next
- When clae: `/do-work` to start with S1, or `/prd-to-issue` to turn these into GitHub issues (AFK-labeled where noted).