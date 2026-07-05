# Community Plugin Submission — Preparation Notes

This document collects everything needed for the manual, approval-gated submission of
"Immich Journal" to the Obsidian community plugin directory
(`obsidianmd/obsidian-releases`). It does not perform the submission itself — a human
must open the PR.

## 1. JSON entry for `community-plugins.json`

Append this object to the end of the array in
`obsidianmd/obsidian-releases/community-plugins.json`. Values are taken verbatim from
`manifest.json` in this repo.

```json
{
  "id": "immich-journal",
  "name": "Immich Journal",
  "author": "fcandi",
  "description": "Insert photos taken on a daily note's date from a self-hosted Immich server — resized, captioned, linked back to Immich",
  "repo": "fcandi/obsidian-immich-journal"
}
```

## 2. PR body draft

```markdown
# I am submitting a new Community Plugin

## Repo URL

Link to my plugin: https://github.com/fcandi/obsidian-immich-journal

## Release Checklist

- [x] I have tested the plugin on
  - [x]  Windows
  - [x]  macOS
  - [x]  Linux
  - [x]  Android (via BRAT)
  - [ ]  iOS
- [x] My GitHub release contains all required files (as individual files, not just in the source zip/tar)
  - [x] `main.js`
  - [x] `manifest.json`
  - [x] `styles.css`
- [x] GitHub release name matches the exact version number specified in my manifest.json (**Note:** Don't include a prefix `v`)
- [x] The `id` in my manifest.json matches the `id` in the `community-plugins.json` file.
- [x] My README.md describes the plugin's purpose and provides clear usage instructions.
- [x] I have read the developer policies at https://docs.obsidian.md/Developer+policies, and have assessed my plugins's adherence to these policies.
- [x] I have read the tips in https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines and confirmed that my plugin follows these guidelines.
- [x] I have added a license in the LICENSE file (MIT).
- [x] My plugin does not collect any telemetry or analytics without explicit user opt-in.
- [x] My plugin does not require any secrets baked into the code; server URL and API key are entered by the user as runtime settings and stored only in the vault's plugin data.

## Plugin Summary

Immich Journal inserts photos taken on the date of the current daily note from a
self-hosted Immich server. Photos are fetched via Immich's REST API, resized
client-side (longest edge capped, no upscaling), captioned from the asset description,
and linked back to the corresponding asset in Immich. Works fully on mobile — all
network access goes through Obsidian's `requestUrl()`, no Node/Electron APIs are used.
```

## 3. Pre-submission checklist (mapped to Obsidian review guidelines)

- [ ] **No secrets in the repo.** `git grep` for API keys, tokens, and the test server
  hostname (the private tailnet hostname) turns up nothing outside local `.env`/settings
  that are gitignored. Server URL and API key are runtime settings only, entered by the
  user in the plugin's settings tab.
- [ ] **No telemetry by default.** The plugin makes no network calls other than to the
  user-configured Immich server. No analytics, crash reporting, or third-party
  telemetry SDK is present.
- [ ] **`isDesktopOnly` is honest.** `manifest.json` sets `isDesktopOnly: false`; verify
  this is actually true by testing on a mobile device (iPhone via BRAT — see manual
  steps below) before submitting, not just by reading the code.
- [ ] **All HTTP goes through `requestUrl()`.** `grep -rn "fetch(" src/` and
  `grep -rn "XMLHttpRequest" src/` return nothing; no Node APIs (`fs`, `path`, `Buffer`,
  `process`) are imported anywhere in `src/`.
- [ ] **A GitHub release exists** for the version in `manifest.json`, with `main.js`,
  `manifest.json`, and `styles.css` attached as individual binary assets (not only
  inside the source archive), and the release tag/name matches the manifest version
  exactly (no leading `v`).
- [ ] **README is complete.** Explains what the plugin does, how to configure the
  Immich server URL and API key, required Immich API key scopes (`asset.read`,
  `asset.view`), settings (caption template, `maxEdgePx`), and known limitations
  (images only in v1, no video support).
- [ ] **LICENSE file is MIT** and present at the repo root.
- [ ] **`manifest.json` `id`** (`immich-journal`) matches the `id` used in the
  `community-plugins.json` entry above.
- [ ] **No use of deprecated/unsafe APIs** flagged by `obsidian` lint rules (if the
  `eslint-plugin-obsidian` or equivalent check is run as part of CI).

## 4. Manual steps that remain (not automatable, not done by this doc)

1. Create a **fresh Immich API key** scoped to `asset.read` + `asset.view` only, for
   final acceptance testing (do not reuse a key from earlier development).
2. **Vault symlink live test on the Mac**: `ln -s ~/DEV/obsidian-immich-journal
   "<vault>/.obsidian/plugins/immich-journal"`, enable the plugin, run through the full
   flow with `npm run dev` esbuild output.
3. **BRAT install on iPhone**: add the repo via BRAT, confirm the plugin loads and works
   end-to-end on mobile before claiming `isDesktopOnly: false`.
4. **Acceptance test matrix** — run all of the following against a real Immich server
   before submitting:
   - Daily note with **0 photos** for that day (no-op, no error).
   - Daily note with **3 photos**.
   - Daily note with **100+ photos** (performance / rate-limit sanity check).
   - A **travel day** (device timezone differs from local date — verifies the
     `localDateTime` client-side filtering logic).
   - **Wrong/revoked API key** (expect a clear, user-facing error, not a silent
     failure or crash).
   - **Tailscale off** / server unreachable (expect a clear, user-facing error).
5. Only after all of the above pass: open the PR against
   `obsidianmd/obsidian-releases` using the JSON entry and PR body drafted above.
