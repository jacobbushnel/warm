#!/usr/bin/env bash
# logreq — a curl wrapper that saves every request + response with a timestamp,
# so your evidence is captured as you work (missing screenshots = zero on a target).
#
# It runs curl with -i (response headers+body), prints the response to your screen,
# AND writes the exact command, time, and full response to loot/<label>/NNN-*.txt.
# Review those files when writing the report, or screenshot the terminal live.
#
# Usage:
#   ./logreq.sh <label> <any curl args...>
#
# Examples:
#   ./logreq.sh app1 "http://target/page?id=1"
#   ./logreq.sh app1 http://target/api --data "name=taco' OR 1=1-- -"
#   ./logreq.sh app1 -X POST http://target/login -d 'user=admin&pass=x'
set -uo pipefail
LABEL="${1:?usage: logreq.sh <label> <curl args...>}"; shift
[ $# -gt 0 ] || { echo "need curl args"; exit 1; }
DIR="loot/$LABEL"; mkdir -p "$DIR"
N=$(printf '%03d' "$(( $(ls "$DIR"/[0-9]*.txt 2>/dev/null | wc -l) + 1 ))")
TS=$(date -u '+%Y-%m-%d %H:%M:%SZ')
OUT="$DIR/$N-$(date -u +%H%M%S).txt"

# build a readable record of the command
{
  echo "# logreq $LABEL  @ $TS"
  printf '## command\ncurl -sS -i --max-time 30'; printf ' %q' "$@"; echo
  echo "## response"
} > "$OUT"

resp=$(curl -sS -i --max-time 30 "$@" 2>&1)
printf '%s\n' "$resp" | tee -a "$OUT"
echo
echo "[*] saved -> $OUT"
