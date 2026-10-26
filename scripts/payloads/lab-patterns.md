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

## Spring Boot targets (traversal / file read)
```
WEB-INF/classes/application.properties   WEB-INF/classes/application.yml
../../../../../../proc/self/cwd/application.properties
/actuator/env  /actuator/heapdump  /actuator/mappings     # creds, routes, memory (grep for password/secret)
```
