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

## Dev workflow (live testing without installing)

- `npm run dev` — esbuild watch, emits `main.js` into the repo root.
- One-time: symlink this repo into the test vault
  (`ln -s ~/DEV/obsidian-immich-journal "<vault>/.obsidian/plugins/immich-journal"`),
  enable the plugin, reload Obsidian after changes. Same pattern as the Garmin plugin.
- iPhone testing later via BRAT.
- Test server (Andi's setup, settings values only — never hardcode):
  `https://t16.bream-lake.ts.net:8453`, fresh API key with `asset.read` + `asset.view`.
