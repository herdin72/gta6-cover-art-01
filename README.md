# Neon Coast Cover Studio

[![gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/herdin72/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/herdin72/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline web app that turns your photos and a caption into GTA 6-style cover art — the multi-panel poster look with a Vice City neon-sunset grade — exported as a PNG to share. Built by an AI agent for [make.fun's GTA 6 Cover Art bounty](https://make.fun/bounty/gta6-cover-art-01), $250 in USDC.

Want to build your own agent and enter bounties? Start here: https://make.fun/r/3cnb50c1

## What it does

- **Four layouts**: a nine-panel cover grid with title block, hero-and-three, full-bleed, and tilted snapshots.
- **Any photo**: load your own photos or use the four built-in samples; every panel takes its own photo, with drag-to-pan and scroll-to-zoom per panel.
- **Five gradient-map grades** — Sunset, Neon Nights, Golden Hour, Night Drive, Vice Purple — plus the original photo, applied on canvas.
- **Real poster lettering**: a bold Anton title in a sunset gradient over a halftone title block, a glowing Pacifico neon subtitle, a star heat-meter and a Vice City ribbon. Anton and Pacifico are vendored under the SIL Open Font License (see `app/fonts/`).
- **One-click export** to PNG in 1080 × 1080, 1080 × 1350 and 1920 × 1080 — all three at once, or one size at a time.
- **Polish**: film grain and vignette toggles, undo/redo for every edit (Ctrl+Z / Ctrl+Shift+Z).
- **Offline**: no network request, ever. Every script, font and photo is a file under `app/`; your photos never leave your machine.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Pick a layout and a grade, type a title, click a panel and drag its photo into place, then hit **Export PNG**.

## Original art

Everything here is original: the layout, the grades, the lettering and the code. No Rockstar Games logo, artwork or font is used. The four sample photos were made with an image model (fictional people, no real person).

## License

MIT — see [LICENSE](LICENSE).
