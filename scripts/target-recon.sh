#!/usr/bin/env bash
# target-recon — one consistent opening pass per target, into loot/<label>/recon/.
# Fingerprint, headers, content discovery, HTTP methods, nmap http NSE, and the
# JS/file harvest. Degrades gracefully when a tool isn't installed. Local only.
#
# Usage:  ./target-recon.sh <url> [label] [wordlist]
# Example: ./target-recon.sh http://target/ app1
set -uo pipefail
URL="${1:?usage: target-recon.sh <url> [label] [wordlist]}"; URL="${URL%/}"
HOST="$(printf '%s' "$URL" | sed -E 's#^[a-z]+://##; s#[/:?].*$##')"
LABEL="${2:-$HOST}"
WL="${3:-/usr/share/seclists/Discovery/Web-Content/raft-medium-files.txt}"
D="loot/$LABEL/recon"; mkdir -p "$D"
have(){ command -v "$1" >/dev/null 2>&1; }
log(){ echo "[*] $*"; }

log "target=$URL label=$LABEL -> $D"
log "1. fingerprint"
{ have whatweb && whatweb -a3 "$URL"; have httpx-toolkit && echo "$URL" | httpx-toolkit -silent -title -tech-detect -status-code -web-server -ip; curl -skI "$URL/"; } > "$D/fingerprint.txt" 2>&1 || true
grep -iE 'whatweb|title|server:|x-powered|set-cookie|HTTP/' "$D/fingerprint.txt" | head -20

log "2. robots / sitemap / methods"
{ echo "## robots"; curl -sk "$URL/robots.txt"; echo "## sitemap"; curl -sk "$URL/sitemap.xml"; echo "## OPTIONS"; curl -ski -X OPTIONS "$URL/" | grep -i '^allow:'; } > "$D/meta.txt" 2>&1 || true

log "3a. directory discovery (hidden dirs like /dev /admin /backup — often where the box is won)"
DIRWL="/usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt"
[ -f "$DIRWL" ] || DIRWL="/usr/share/seclists/Discovery/Web-Content/common.txt"
if have ffuf; then
  ffuf -u "$URL/FUZZ" -w "$DIRWL" -mc 200,204,301,302,307,401,403 -t 60 -c -of csv -o "$D/ffuf-dirs.csv" -s 2>/dev/null | tee "$D/ffuf-dirs.txt"
  echo "    [dirs found]:"; awk -F, 'NR>1{print "      "$5"  "$2}' "$D/ffuf-dirs.csv" 2>/dev/null | grep -viE '\.ht' | sort -u | head -40
fi

log "3b. file discovery (stack extensions, recurse into found dirs)"
if have ffuf; then
  ffuf -u "$URL/FUZZ" -w "$WL" -e .php,.txt,.bak,.old,.zip,.inc,.json,.config -mc 200,204,301,302,307,401,403 \
       -recursion -recursion-depth 2 -t 50 -c -of csv -o "$D/ffuf.csv" -s 2>/dev/null | tee "$D/ffuf.txt"
elif have feroxbuster; then
  feroxbuster -u "$URL" -w "$WL" -x php,txt,bak,old,zip,inc -q -o "$D/ferox.txt" 2>/dev/null
else echo "no ffuf/feroxbuster" > "$D/ffuf.txt"; fi
echo "    [!] re-run file discovery inside any interesting dir above, e.g.: scripts/target-recon.sh $URL/dev ${LABEL}-dev"

log "4. nmap http NSE"
if have nmap; then
  nmap -Pn -p 80,443,8080,8443 -sV --script="http-methods,http-title,http-headers,http-robots.txt,http-enum" \
       -oN "$D/nmap-http.txt" "$HOST" >/dev/null 2>&1 && grep -iE '\|' "$D/nmap-http.txt" | head -30 || true
else echo "no nmap" > "$D/nmap-http.txt"; fi

log "5. JS / file harvest"
if [ -x scripts/files-recon.sh ]; then
  scripts/files-recon.sh "$URL" "" "loot/$LABEL/files" >/dev/null 2>&1 \
    && echo "    -> loot/$LABEL/files/out/{js-signal,endpoints,secrets}.txt" \
    || echo "    files-recon run had issues (check manually)"
else echo "files-recon.sh not found"; fi

log "done. Start report:  scripts/report-skel.sh $LABEL $URL"
log "review: $D/  and loot/$LABEL/files/out/"
