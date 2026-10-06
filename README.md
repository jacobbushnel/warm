# WARM — Web App Rapid Methodology

A scoped, **copy-first** web-app penetration-testing methodology, as a small localhost web app.
Walk a 9-phase workflow (recon → logic), tick items as you go, keep per-phase findings, and
export a Markdown report. Every command templates from a central **Scope panel** so it comes out
correctly scoped to your target, tester IP, and listener port.

> **Copy-only by design.** WARM does **not** execute anything. It renders the exact, scoped
> commands for you to copy into your own terminal. Nothing is run from the page.

## Features

- **Scope → variables**: `target`, `tester_ip`, `tester_port` (listener), plus `wordlist`, `ports`,
  `cookie`, `scheme`. They fill every command live; unfilled `{variables}` are highlighted.
- **Warn-but-allow scope guard**: set your authorized targets; an *active target* outside that list
  is flagged (not blocked).
- **Per-command Copy** with an `⚠` if the copied command still has an unfilled variable.
- **Checklist + progress** per phase, saved in your browser.
- **Findings notes** per phase → **Export report** as Markdown.
- **SSRF escalation decision tree** baked in (the CV-upload / create-admin lab path).
- Theme follows your system; toggle light/dark in the header.

## Run

No dependencies. Serve the folder over localhost:

```bash
cd warm
./serve.sh            # defaults to port 8777
# or: python3 -m http.server 8777 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8777>. (Opening `index.html` directly works too, but serving over
`http://` keeps clipboard + report download reliable.)

## Extend it

All methodology content lives in [`assets/commands.js`](assets/commands.js) — a plain JS object.
Add phases, items, or commands there; the UI regenerates from it. Command strings use
`{variable}` placeholders drawn from the Scope panel. Mark a line `note: true` for guidance that
isn't a shell command (it renders without a Copy button).

## Layout

```
warm/
├─ index.html            # app shell + SSRF decision tree
├─ assets/
│  ├─ commands.js        # the methodology (edit this to extend)
│  ├─ app.js             # rendering, scoping, copy, report export
│  └─ styles.css         # theme tokens + layout
├─ serve.sh              # ./serve.sh [port]  (binds 127.0.0.1)
├─ loot/                 # suggested output dir for your tool runs (gitignored)
└─ README.md
```

## Scope & authorization

Only test systems you are explicitly authorized to assess. The scope field and warn-but-allow
guard are conveniences, not a safety control — the responsibility for staying in scope is yours.
