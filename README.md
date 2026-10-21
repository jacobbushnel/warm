# WARM — Web App Rapid Methodology

Web-app penetration-testing methodology, as a small localhost web app.
9-phase workflow (recon → logic), tick items as you go, keep per-phase findings, and
export a Markdown report. Every command templates from a central **Scope panel** so it comes out
correctly scoped to your target, tester IP, and listener port.

> **Copy-only by design.** WARM does **not** execute anything. It renders the exact, scoped
> commands for you to copy into your own terminal. Nothing is run from the page.

## Features

Four tabs:

- **Two-tier items (discover → exploit)** — a method item first shows the **Discover / confirm**
  tests, then a nested **"Exploit → gain access / escalate"** dropdown with the advanced payloads
  for *doing something* with the bug once found (not just `alert(1)` / `{{7*7}}`). XSS is built out
  first — including the "a bot visits but won't click" case: your injected JS acts in the bot's
  session via `fetch` (read a page, submit with a scraped CSRF token, take over the account). The
  JavaScript-for-XSS primer is in [`scripts/payloads/xss-exploitation.md`](scripts/payloads/xss-exploitation.md).
- **Screenshots per phase** — attach evidence to each phase's findings (click **+ Add** or
  paste an image straight into the notes box). Thumbnails get captions, persist in the browser
  (IndexedDB, so large images are fine), and are **embedded inline in the HTML report export**
  (`Export report + shots`) — open it and print to PDF, or paste into your Word/LibreOffice doc.
  The `Export .md` button still writes the Markdown skeleton (with screenshot captions listed).
- **Methodology** — a manual-first workflow (phases `00`–`16`): a per-target game plan, recon, a
  **Find Info in Files** pass (harvest + triage JS, source, config, docs, secrets), auth/session,
  access control, then a class-by-class attack path — SQLi, XSS, command injection, file inclusion,
  XXE, SSTI, SSRF, file upload, other injection/logic, and config disclosure — closing with a
  **Stuck? Try Harder** unsticking playbook and a **Tips & Tricks** section (Burp workflow,
  enumeration, encodings, evidence habits). Each item leads with copy-paste, scoped payloads;
  automated tools sit at the bottom as a *confirm-by-hand* line. Per-item *tells*, a checklist +
  progress bar, per-phase findings notes, and the SSRF decision tree. Phase `00` covers the
  objective, where the proof files live, emulated-user (bot) attacks, and exact screenshot/evidence
  rules so nothing goes undocumented.
- **Reverse Shells** — listeners (nc / rlwrap / socat / pwncat) + a TTY-upgrade reminder, and
  ~19 one-liners (bash, sh, netcat, python, php, perl, ruby, node.js, powershell, socat, lua,
  telnet) with your tester IP/port filled in. Filter by language.
- **Dork Search** — build a `site:` query across curated pentest references (HackTricks,
  PayloadsAllTheThings, PentestMonkey, GTFOBins, LOLBAS, WADComs, OWASP, PortSwigger, ired.team,
  revshells, Exploit-DB, …). Toggle which sites to include; Google / DuckDuckGo / Bing / Startpage.
- **Favorites** — save any command with `☆`, add custom ones, and export/import as JSON so your
  set follows you between browsers/machines. Saved commands re-template live, so they stay scoped.

**Scope → variables** (fill every command live; unfilled `{variables}` are highlighted):
`target_url`, `target_ip` (both are **multi-target lists** — add every URL/IP in the engagement
and click ◉ to pick the **focused** one; `{target_url}`/`{target_ip}`/derived `{target_host}` all
resolve to the focused target, so switching targets is one click and needs no external scope notes),
derived `{target_host}`, `tester_ip`, `tester_port` (listener),
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
├─ scripts/
│  ├─ xss-filter-probe.sh # report which chars a field strips (step 0 of a filtered XSS)
│  ├─ cms-scan.sh        # detect CMS (WordPress/Joomla/Drupal) + run the right enumerator + attack path
│  ├─ login-enum.sh      # user-enum oracle -> valid users -> fast ffuf password brute
│  ├─ csrf-gen.sh        # build a CSRF PoC (form + fetch) for an emulated/admin user to visit
│  ├─ ride-session.sh    # use a stolen cookie: probe admin pages, grep the flag, authed loop
│  ├─ target-recon.sh    # one-shot per-target opening: fingerprint+discovery+NSE+JS harvest
│  ├─ inject-probe.sh    # auto SQLi break-out boundary + DBMS finder (local, no-AI)
│  ├─ ssti-probe.sh      # detect SSTI + identify engine, print the RCE one-liner
│  ├─ cmdi-probe.sh      # find command-injection separator (time-based + OAST)
│  ├─ enc.sh             # one payload -> every encoding (url/base64/hex/CHAR()/entities/…)
│  ├─ dbms-id.sh         # which backend a selector param routes to (engine-only probes)
│  ├─ webshell.sh        # interactive prompt for a dropped cmd webshell (!proof, !rev)
│  ├─ getproof.sh        # run id/hostname/local.txt/proof.txt via a webshell, save evidence
│  ├─ logreq.sh          # curl wrapper: save every request+response+timestamp to loot/
│  ├─ report-skel.sh     # per-target report section skeleton
│  ├─ files-recon.sh     # harvest + triage served/leaked files (JS, source, config, docs, secrets)
│  ├─ catch-server.py    # log any inbound HTTP (blind XSS / OAST / SSRF / exfil)
│  ├─ ssrf-redirect.py   # 302 redirector to bypass SSRF allowlists / reach internal URLs
│  ├─ xxe-oob.sh         # host evil.dtd + catch out-of-band XXE exfil
│  ├─ sqli-union.sh      # find UNION column count + the reflected column
│  ├─ lfi-probe.sh       # fire traversal / PHP-wrapper / log-poison vectors at one param
│  ├─ users.txt          # generic username starter list
│  └─ payloads/          # copy-paste cheat sheets: sqli, xss, ssti, lfi, cmdi, xxe, ssrf,
│                        #   upload, auth, idor, revshells, magic-hashes, deserialization, + tips.md & runbook.md (war-room ref + engagement runbook)
├─ serve.sh              # ./serve.sh [port]  (binds 127.0.0.1)
├─ loot/                 # suggested output dir for your tool runs (gitignored)
└─ README.md
```

## Exploit helpers

Small, generic scripts in [`scripts/`](scripts/) to speed up the slow parts. All take your
tester IP/port and target as arguments — nothing is hard-coded.

```bash
# find the admin/API JS (and leaked source/docs/secrets) in a pile of files
./scripts/files-recon.sh http://target 'session=COOKIE'

# catch any out-of-band callback (cookies, OAST pings, SSRF fetches, exfil)
python3 scripts/catch-server.py 9001

# SSRF: redirect a filtered fetch to an internal URL / cloud metadata
./scripts/ssrf-redirect.py 8000 http://127.0.0.1/admin

# blind/OOB XXE: hosts evil.dtd, serves it, prints the payload, catches the leak
./scripts/xxe-oob.sh <your_ip> 9001 /etc/passwd

# UNION SQLi: column count + which column prints (put INJECT where the value goes)
./scripts/sqli-union.sh "http://app/page.php?id=INJECT"

# LFI: sweep traversal / php://filter / data:// / log-poison targets
./scripts/lfi-probe.sh "http://app/index.php?page=INJECT" -f /root/proof.txt
```

The `payloads/` cheat sheets mirror the methodology phases for quick copy-paste when you want the
full set rather than the few shown in the app.

## Scope & authorization

Only test systems you are explicitly authorized to assess. The scope field and warn-but-allow
guard are conveniences, not a safety control — the responsibility for staying in scope is yours.
