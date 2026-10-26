#!/usr/bin/env bash
# run-targets — run any command/script once per target in a list file.
# Sequential and gentle by default (fragile lab boxes drop requests when hammered
# in parallel). Put {t} where the target goes; it's substituted per line.
#
# Usage:
#   ./run-targets.sh <list-file> '<command with {t}>'
#
# Examples:
#   ./run-targets.sh target_urls.txt './scripts/target-recon.sh {t}'
#   ./run-targets.sh target_ips.txt  'nmap -sV -T4 {t}'
#   ./run-targets.sh target_urls.txt 'curl -skI {t}/'
#   PARALLEL=4 ./run-targets.sh target_ips.txt 'nmap -sn {t}'   # opt-in parallelism
#
# Lines that are blank or start with # are skipped. Set PARALLEL=N (default 1).
set -uo pipefail
LIST="${1:?usage: run-targets.sh <list-file> '<command with {t}>'}"
TMPL="${2:?need a command template with the target placeholder}"
[ -f "$LIST" ] || { echo "[!] no such list file: $LIST"; exit 1; }
case "$TMPL" in *'{t}'*) : ;; *) echo "[!] command has no {t} placeholder: $TMPL"; exit 1;; esac
PAR="${PARALLEL:-1}"

run_one() {
  local t="$1" cmd PH='{t}'
  cmd=${TMPL//"$PH"/$t}
  echo "======================================================================"
  echo "[>] $t"
  echo "    $cmd"
  echo "======================================================================"
  bash -c "$cmd" || echo "[!] non-zero exit for $t (continuing)"
  echo
}
export TMPL
export -f run_one

# clean the list: strip comments/blanks/whitespace, dedupe (keep order)
mapfile -t TARGETS < <(sed -E 's/#.*$//; s/^[[:space:]]+//; s/[[:space:]]+$//' "$LIST" | awk 'NF && !seen[$0]++')
[ "${#TARGETS[@]}" -gt 0 ] || { echo "[!] $LIST has no targets"; exit 1; }
echo "[*] ${#TARGETS[@]} target(s) from $LIST  (PARALLEL=$PAR)"

if [ "$PAR" -gt 1 ] && command -v xargs >/dev/null 2>&1; then
  printf '%s\n' "${TARGETS[@]}" | xargs -P "$PAR" -I{} bash -c 'run_one "$@"' _ {}
else
  for t in "${TARGETS[@]}"; do run_one "$t"; done
fi
echo "[*] done — all targets processed."
