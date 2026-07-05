# Immich Journal

An [Obsidian](https://obsidian.md) plugin that inserts photos from your self-hosted
[Immich](https://immich.app) server into your daily notes — resized, captioned, and
linked back to Immich.

> **Status: early development.** Not yet released. Concept and implementation plan
> are being worked on; nothing here is functional yet.

## Planned features (v1)

- One button in a daily note opens a picker with all photos taken on that note's date
- Date is detected from the note title (configurable format) or frontmatter
- Multi-select, then insert photos below each other at the cursor position
- Photos are saved as **resized local copies** (default max 800×600) so your vault
  stays small — the original never leaves Immich
- Optional caption line rendered from a template (`{{description}}`, `{{time}}`,
  `{{city}}`, …)
- Each photo links back to the original in your Immich web UI
- Works on **desktop and mobile** — including setups where Immich is only reachable
  through a VPN such as Tailscale
- English and German UI, prepared for further translations

## License

[MIT](LICENSE)
