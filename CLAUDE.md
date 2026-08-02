# Immich Journal — Claude Code entry point

Obsidian plugin: insert photos taken on a daily note's date from a self-hosted Immich
server — resized, captioned, linked back to Immich. Desktop + mobile, i18n (en/de), MIT.

## Canonical docs (machine-local, not in this repo)

- Concept (v1.1, German): `/Users/anditravel/DEV/wolfsbach-infra/docs/obsidian-immich-daily-konzept.md`
- Multi-agent implementation plan: `/Users/anditravel/DEV/wolfsbach-infra/docs/obsidian-immich-daily-konzept-Implementierungsplan.md`

Read both before building. The plan defines subtask IDs, dependencies, and per-subtask
model choices.

## Decided (2026-07-05) — do not re-litigate

- Plugin name "Immich Journal", `id: immich-journal`, `isDesktopOnly: false`.
- Insert position is a setting since 0.2.0 (revised 2026-07-12): cursor (default; no active
  editor → end of file), top of note (after frontmatter), or bottom of note. No heading logic.
- Embed UI revised 2026-07-12: one `embedPreset` dropdown (markdownLink / markdownPlain /
  wikilink / custom) replaced `embedStyle` + `linkToImmich` + `captionTemplate`; the template
  field only shows for "custom". Presets append the Immich description as caption; an empty
  rendered line is omitted. Legacy settings are migrated in `src/settings/migrate.ts`.
- Images only in v1 (`type: IMAGE`); no `showVideos` setting until v1.1.
- Resize: single **max edge length** setting (`maxEdgePx`, default 800) — longest side is
  scaled to this value, portrait and landscape treated alike; no upscaling; JPEG q=0.85.
- Source of pixels: Immich `thumbnail?size=preview` (always JPEG — HEIC handled server-side).
- Day query: generous UTC window (±1 day) via `takenAfter/takenBefore`, then client-side
  filter on `asset.localDateTime.startsWith(day)`.

## Hard rules

- Everything in this repo is **English**: code, comments, strings-in-code, README, commits.
  User-visible strings go through the i18n layer (`src/i18n/`, en + de).
- HTTP only via Obsidian `requestUrl()` (CORS-free, works on mobile). No `fetch`, no Node
  or Electron APIs anywhere (`fs`, `path`, `Buffer`) — mobile support must stay honest.
- Do **not** copy code from `obsidian-immich-picker` (GPL-3.0). Verified facts from it may
  be used: API key needs `asset.read` + `asset.view`; endpoints
  `POST /api/search/metadata`, `GET /api/assets/{id}/thumbnail?size=thumbnail|preview`,
  deep link `{server}/photos/{assetId}`.
- Pure logic (`src/util/`, template/caption/paths/date filtering) gets vitest unit tests
  in the same change.
- No secrets in the repo — server URL and API key are runtime settings only.

## Release lint discipline (lesson from Garmin plugin 0.10.0, 2026-08-02)

The community-directory review bot lints with the **latest** `eslint-plugin-obsidianmd`
plus type-aware `@typescript-eslint/no-unsafe-*` rules. A locally clean `npm run lint`
means nothing if the local plugin version or ruleset lags — the Garmin plugin shipped
0.10.0 with a clean local lint and got a "Caution" badge with ~90 warnings.

Before **every** release tag:

1. Check the lint plugin is current: `npm outdated eslint-plugin-obsidianmd` — if
   outdated, update it, rerun lint, and fix what the new version flags.
2. `npm run lint` must be completely clean **including** the mirrored type-aware rules
   in `eslint.config.mts` (do not remove or weaken that block).
3. Keep `tsconfig.json` `lib` at least as new as the newest JS API the code uses
   (currently `ES2018`). An outdated `lib` makes calls like `Object.entries`/`padStart`
   error-typed in the bot's environment and cascades into dozens of `no-unsafe-*`
   findings, even when the local toolchain resolves them fine.
4. The bot does **not install transitive type packages** — values typed through
   `moment` (obsidian's re-export) or `@types/node` are error-typed there even when
   local lint is clean. Never call those directly: go through a locally-typed
   module-level const (`const momentFn = moment as unknown as MomentFn` — module
   level, not at the argument position, or local lint flags the cast as
   unnecessary). To verify like the bot does, temporarily move
   `node_modules/moment` and `node_modules/@types/node` aside, run `npm run lint`
   (must stay clean), then move them back.

## Dev workflow (live testing without installing)

- `npm run dev` — esbuild watch, emits `main.js` into the repo root.
- One-time: symlink this repo into the test vault
  (`ln -s ~/DEV/obsidian-immich-journal "<vault>/.obsidian/plugins/immich-journal"`),
  enable the plugin, reload Obsidian after changes. Same pattern as the Garmin plugin.
- iPhone testing later via BRAT.
- Test server (Andi's setup, settings values only — never hardcode):
  `https://t16.bream-lake.ts.net:8453`, fresh API key with `asset.read` + `asset.view`.
