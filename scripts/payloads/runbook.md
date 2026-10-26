# Engagement runbook — multi-target, time-boxed

A game plan for a fixed-time assessment of several web targets where each needs a
low-value file (admin-readable) and a high-value file (process/user-readable). Pace
for a long window with sleep built in; partial credit is real, so bank points early.

## Target loop (repeat per target, ~3–4h box before moving on)
1. **Set focus** — add the URL/IP to the Scope panel, click ◉ to focus it.
2. **Open** — `scripts/target-recon.sh <url> <label>` (background it; it runs long).
   While it runs: browse the app through Burp, read every JS file, note every param/form.
3. **Pick the class** from the stack (see table below), hit the loudest bug.
4. **Get a primitive**: admin session · file-read · command-exec.
5. **Convert to proof** (matrix below), screenshot immediately, next target.
6. Stuck ~30 min on a class → switch class, not target. Revert a box you polluted.

## First 15 minutes (do these every time)
- [ ] `target-recon.sh` running (fingerprint, **dir sweep**, NSE, JS/file harvest)
- [ ] Hidden dirs checked (`/dev /admin /backup /api /old /test`) — the box is often won here
- [ ] Every form + param noted; `/robots.txt`, `/sitemap.xml`, HTML comments, source maps
- [ ] Logged-in AND logged-out JS diffed for admin-only endpoints
- [ ] Is there an emulated user (a bot that browses)? → stored-XSS / CSRF objective
- [ ] Self-signed TLS? → proxy via Burp or curl `-k`

## Bug class by stack
| Signal | Lead with |
|---|---|
| PHP / PHPSESSID | LFI+wrappers, type juggling, SQLi, upload, `INTO OUTFILE` webshell |
| Java / JSESSIONID | XXE, deserialization (ysoserial), EL/SSTI, traversal |
| Node / connect.sid, JSON | NoSQL, mass assignment, proto pollution, SSTI (EJS/Pug), deserialization |
| Python / Werkzeug | SSTI (Jinja2), SSRF, pickle deser |
| .NET / ViewState | deserialization (ViewState / ysoserial.net), traversal, SQLi (MSSQL) |
| WordPress/CMS | `scripts/cms-scan.sh` → user enum, weak creds, plugin/theme RCE |
| A bot that reviews content | stored/blind XSS → steal admin session (ride-session.sh) |
| A URL/fetch/import field | SSRF |

## Primitive → proof matrix
| You have… | Get the low-value file | Get the high-value file |
|---|---|---|
| admin session | it's shown in the admin UI | often needs a shell/file-read too |
| arbitrary file read (LFI/XXE/SQLi OUTFILE-read) | read it from the admin dir / webroot | read it from `/`, `C:\`, or the user's home |
| RCE / shell | `cat`/`type` it | `cat`/`type` it (no OS priv-esc needed) |

## Evidence rules (miss these = zero for the target, no retake)
- Screenshot the **proving request + response** the instant a bug works (use the per-phase
  screenshot store; it embeds into the HTML report export).
- Value via the web UI → screenshot **proxy (Burp) AND browser** against the real target.
- Value via shell → `cat`/`type` from the **original path** + `hostname`/`ip a` (or `whoami`/`ipconfig`).
- Submit both values in the control panel **before time ends** AND include the screenshots.

## Report & submission checklist
- [ ] One section per target: summary, steps to reproduce, each request/response, **every payload in full**, exploit scripts pasted as text
- [ ] Both file values + their screenshots per target (per the rules above)
- [ ] Export: `scripts/report-skel.sh <label> <url>` for the skeleton; the app's **Export report + shots** gives an HTML report with screenshots inline → print to PDF / paste into your doc
- [ ] Final document reviewed for formatting, archived per the submission spec, hash verified on upload

## Pace / self-care
Timebox each class (~30 min) and each target (~3–4h). Eat, hydrate, sleep — the window assumes it.
Grab partials across all targets before perfecting one.
