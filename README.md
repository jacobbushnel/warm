# WARM — Web App Rapid Methodology

A scoped, **copy-first** web-app penetration-testing methodology, as a small localhost web app.
Walk a 9-phase workflow (recon → logic), tick items as you go, keep per-phase findings, and
export a Markdown report. Every command templates from a central **Scope panel** so it comes out
correctly scoped to your target, tester IP, and listener port.

> **Copy-only by design.** WARM does **not** execute anything. It renders the exact, scoped
> commands for you to copy into your own terminal. Nothing is run from the page.

## Features

Four tabs, all copy-only:

- **Methodology** — the 9-phase workflow with per-item *tells*, discovery/confirmation tools,
  a checklist + progress bar, per-phase findings notes, and the SSRF escalation decision tree.
- **Reverse Shells** — listeners (nc / rlwrap / socat / pwncat) + a TTY-upgrade reminder, and
  ~19 one-liners (bash, sh, netcat, python, php, perl, ruby, node.js, powershell, socat, lua,
  telnet) with your tester IP/port filled in. Filter by language.
- **Dork Search** — build a `site:` query across curated pentest references (HackTricks,
  PayloadsAllTheThings, PentestMonkey, GTFOBins, LOLBAS, WADComs, OWASP, PortSwigger, ired.team,
  revshells, Exploit-DB, …). Toggle which sites to include; Google / DuckDuckGo / Bing / Startpage.
- **Favorites** — save any command with `☆`, add custom ones, and export/import as JSON so your
  set follows you between browsers/machines. Saved commands re-template live, so they stay scoped.

**Scope → variables** (fill every command live; unfilled `{variables}` are highlighted):
`target_url`, `target_ip`, derived `{target_host}`, `tester_ip`, `tester_port` (listener),
`wordlist`, `ports`, `cookie`.

- **Warn-but-allow scope guard**: set an authorized hosts/CIDRs list; a Target URL host or IP
  outside it is flagged (IPv4 + CIDR aware), never blocked.
- **Per-command Copy** with a `⚠` if the copied command still has an unfilled variable.
- **Export report** as Markdown; checklist, notes, scope, and favorites persist in your browser.
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
├─ index.html            # app shell: tabs + SSRF decision tree
├─ assets/
│  ├─ commands.js        # the methodology (edit this to extend)
│  ├─ data.js            # reverse shells, dork sites, listeners
│  ├─ app.js             # rendering, scoping, copy, favorites, report export
│  └─ styles.css         # theme tokens + layout
├─ serve.sh              # ./serve.sh [port]  (binds 127.0.0.1)
├─ loot/                 # suggested output dir for your tool runs (gitignored)
└─ README.md
```

## Scope & authorization

Only test systems you are explicitly authorized to assess. The scope field and warn-but-allow
guard are conveniences, not a safety control — the responsibility for staying in scope is yours.
