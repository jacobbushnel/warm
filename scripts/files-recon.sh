#!/usr/bin/env bash
# files-recon — harvest the files an app serves/leaks, strip library noise, and
# surface the interesting ones (admin/API JS, exposed source, secrets, endpoints).
#
# It does the mechanical parts of the "Find Info in Files" phase so you can spend
# your time reading the 3 files that matter instead of finding them.
#
# Usage:
#   ./files-recon.sh <target_url> [cookie] [outdir]
#
# Examples:
#   ./files-recon.sh http://mentor
#   ./files-recon.sh http://mentor 'session=abc123' loot-mentor
#
# Needs: curl, wget, grep, sed, sort (always).  Uses if present: gau, hakrawler,
#   feroxbuster, jsluice, linkfinder (/opt/LinkFinder), js-beautify, trufflehog, gitleaks.
set -uo pipefail

URL="${1:?usage: files-recon.sh <target_url> [cookie] [outdir]}"
URL="${URL%/}"
COOKIE="${2:-}"
HOST="$(printf '%s' "$URL" | sed -E 's#^[a-z]+://##; s#[/:?].*$##')"
OUT="${3:-files-recon-$HOST}"
CK=(); [ -n "$COOKIE" ] && CK=(-H "Cookie: $COOKIE")
PAGES=(/ /index.php /login /home /dashboard /account /profile /admin)
mkdir -p "$OUT"/{mirror,out}
echo "[*] target=$URL host=$HOST out=$OUT  cookie=${COOKIE:+set}"

# ---- 1. collect candidate URLs -------------------------------------------------
URLS="$OUT/out/files-urls.txt"; : > "$URLS"
echo "[*] 1/5 collecting URLs"
# 1a. scrape <script src> + href/action from known pages (catches hashed bundles)
for p in "${PAGES[@]}"; do
  curl -sk "${CK[@]}" "$URL$p" 2>/dev/null
done | grep -oiE '(src|href|action)="[^"]+"' | sed -E 's/.*="([^"]+)".*/\1/' \
     | sed -E "s#^/#$URL/#; s#^(?!https?://)#$URL/#" 2>/dev/null \
     | grep -iE '^https?://' | sort -u >> "$URLS" || true
# normalize relative ones the sed above missed
for p in "${PAGES[@]}"; do curl -sk "${CK[@]}" "$URL$p" 2>/dev/null; done \
  | grep -oiE '(src|href)="[^"]+\.(js|php|txt|bak|old|zip|map|inc|env|json|xml|pdf|docx?|xlsx?|csv|log|conf|ini|sql)[^"]*"' \
  | sed -E 's/.*="([^"]+)".*/\1/' | while read -r u; do
      case "$u" in http*) echo "$u";; /*) echo "$URL$u";; *) echo "$URL/$u";; esac
    done | sort -u >> "$URLS" || true
# 1b. passive sources if installed
command -v gau       >/dev/null && gau "$HOST" 2>/dev/null >> "$URLS" || true
command -v hakrawler >/dev/null && echo "$URL" | hakrawler -d 2 2>/dev/null >> "$URLS" || true
# 1c. active discovery if installed
if command -v feroxbuster >/dev/null; then
  WL="${WORDLIST:-/usr/share/seclists/Discovery/Web-Content/raft-medium-files.txt}"
  feroxbuster -u "$URL" -w "$WL" -x js,php,txt,bak,old,zip,map,inc,env,json,xml \
    --extract-links -q -o "$OUT/out/ferox.txt" 2>/dev/null || true
  grep -oiE 'https?://\S+' "$OUT/out/ferox.txt" 2>/dev/null >> "$URLS" || true
fi
# keep only interesting extensions, dedupe
grep -oiE 'https?://\S+\.(js|php|txt|bak|old|zip|map|inc|env|json|xml|pdf|docx?|xlsx?|csv|log|conf|ini|sql)\b' "$URLS" \
  | sort -u > "$URLS.tmp" && mv "$URLS.tmp" "$URLS"
echo "    $(wc -l < "$URLS") candidate file URLs"

# ---- 2. mirror to disk ---------------------------------------------------------
echo "[*] 2/5 mirroring"
( cd "$OUT/mirror" && wget -q -x -nc ${COOKIE:+--header="Cookie: $COOKIE"} -i "../out/files-urls.txt" 2>/dev/null ) || true
JS=$(find "$OUT/mirror" -iname '*.js' | wc -l)
echo "    mirrored $(find "$OUT/mirror" -type f | wc -l) files ($JS JS)"

# ---- 3. JS: strip libs + rank by signal ---------------------------------------
echo "[*] 3/5 JS triage -> out/js-candidates.txt, out/js-signal.txt"
LIB='jquery|bootstrap|angular|react|vue|lodash|moment|popper|polyfill|runtime|vendor|chunk-vendors'
grep -rLiE "$LIB" "$OUT/mirror" --include=*.js 2>/dev/null | sort > "$OUT/out/js-candidates.txt" || true
SIG='admin|manage|role|is_?admin|privile|superuser|/api/|endpoint|route|fetch\(|axios|XMLHttpRequest|token|secret|debug|internal|hidden|disabled|TODO'
grep -rniE "$SIG" "$OUT/mirror" --include=*.js 2>/dev/null | grep -viE "$LIB|\.min\.js" > "$OUT/out/js-signal.txt" || true
echo "    $(wc -l < "$OUT/out/js-candidates.txt") first-party JS, $(wc -l < "$OUT/out/js-signal.txt") signal lines"

# ---- 4. endpoints --------------------------------------------------------------
echo "[*] 4/5 endpoints -> out/endpoints.txt"
: > "$OUT/out/endpoints.txt"
if command -v jsluice >/dev/null; then
  find "$OUT/mirror" -iname '*.js' -print0 | xargs -0 jsluice urls 2>/dev/null >> "$OUT/out/endpoints.txt" || true
elif [ -f /opt/LinkFinder/linkfinder.py ]; then
  find "$OUT/mirror" -iname '*.js' -exec python3 /opt/LinkFinder/linkfinder.py -i {} -o cli \; 2>/dev/null >> "$OUT/out/endpoints.txt" || true
else
  grep -rohiE '"(/[a-zA-Z0-9_./-]+)"' "$OUT/mirror" --include=*.js 2>/dev/null | tr -d '"' >> "$OUT/out/endpoints.txt" || true
fi
sort -u "$OUT/out/endpoints.txt" -o "$OUT/out/endpoints.txt"
echo "    $(wc -l < "$OUT/out/endpoints.txt") unique endpoints/paths (diff these against your Burp history)"

# ---- 5. secrets sweep ----------------------------------------------------------
echo "[*] 5/5 secrets -> out/secrets.txt"
grep -rniE 'password|passwd|secret|api[_-]?key|authorization|bearer |BEGIN (RSA|OPENSSH|PRIVATE)|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{10,}' "$OUT/mirror" 2>/dev/null \
  | grep -viE 'node_modules|\.min\.js|jquery' > "$OUT/out/secrets.txt" || true
command -v trufflehog >/dev/null && trufflehog filesystem "$OUT/mirror" --only-verified 2>/dev/null >> "$OUT/out/secrets.txt" || true
command -v gitleaks   >/dev/null && gitleaks detect --source "$OUT/mirror" --no-git -v 2>/dev/null >> "$OUT/out/secrets.txt" || true
echo "    $(wc -l < "$OUT/out/secrets.txt") secret-ish lines"

echo
echo "[*] done. Start here:"
echo "    $OUT/out/js-signal.txt     <- the admin/API JS usually jumps out here"
echo "    $OUT/out/endpoints.txt     <- hit the ones you never saw in the UI"
echo "    $OUT/out/secrets.txt       <- creds / keys / tokens"
echo "    $OUT/out/js-candidates.txt <- first-party JS to read, noise removed"
