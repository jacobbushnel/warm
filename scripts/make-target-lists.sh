#!/usr/bin/env bash
# make-target-lists — split a mixed pile of targets into target_urls.txt + target_ips.txt.
# The quick way to seed the recon list from a scope sheet without the browser.
# URLs (http[s]://...) -> target_urls.txt ; bare IPv4[/CIDR] -> target_ips.txt.
# A bare host/IP that isn't a URL is ALSO written as http://<it> to target_urls.txt
# so web recon has something to hit. Deduped, order preserved.
#
# Usage:
#   ./make-target-lists.sh scope.txt            # read a file
#   pbpaste | ./make-target-lists.sh            # or pipe a pasted list on stdin
#   ./make-target-lists.sh <<'EOF'
#   http://app1/            10.1.1.5
#   https://app2:8443       10.1.1.6/32
#   EOF
set -uo pipefail
SRC="${1:-/dev/stdin}"
URLS="target_urls.txt"; IPS="target_ips.txt"
: > "$URLS"; : > "$IPS"

# strip whole-line comments first, THEN tokenize on whitespace/commas
sed -E 's/#.*$//' "$SRC" | tr ', \t' '\n\n\n\n' | sed -E 's#\r$##; s#/+$##' | awk 'NF' | while read -r tok; do
  case "$tok" in
    http://*|https://*) echo "$tok" >> "$URLS" ;;
    *)
      # IPv4 or IPv4/CIDR -> ips.txt (and give web recon a URL form too)
      if echo "$tok" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}(/[0-9]{1,2})?$'; then
        echo "$tok" >> "$IPS"
        echo "$tok" | grep -qv '/' && echo "http://$tok" >> "$URLS"
      else
        # a bare hostname: treat as a web target
        echo "http://$tok" >> "$URLS"
      fi ;;
  esac
done

# dedupe in place, keep first-seen order
for f in "$URLS" "$IPS"; do
  awk '!seen[$0]++' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
done
echo "[*] target_urls.txt : $(wc -l < "$URLS") line(s)"
echo "[*] target_ips.txt  : $(wc -l < "$IPS") line(s)"
echo "[*] next: ./scripts/recon-all.sh"
