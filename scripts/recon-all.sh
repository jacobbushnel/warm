#!/usr/bin/env bash
# recon-all — run the one-shot opening recon against EVERY target URL in a list,
# each into its own loot/<host>/ folder. Thin wrapper over run-targets.sh +
# target-recon.sh. Sequential by default so flaky boxes don't drop requests.
#
# Usage:
#   ./recon-all.sh [urls-file] [wordlist]
#
#   urls-file : defaults to target_urls.txt (one URL per line; # comments ok).
#               Export it from WARM with the "Export targets" button.
#   wordlist  : optional content-discovery wordlist passed through to target-recon.
#
# Examples:
#   ./recon-all.sh                                  # recon every URL in target_urls.txt
#   ./recon-all.sh target_urls.txt raft-small.txt
#   PARALLEL=3 ./recon-all.sh                       # opt-in: 3 targets at once
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1          # run from the warm/ root so loot/ lands here
LIST="${1:-target_urls.txt}"
WL="${2:-}"
[ -f "$LIST" ] || { echo "[!] no $LIST — in WARM click 'Export targets', or make it: one URL per line"; exit 1; }

# label is derived inside target-recon.sh from the host; pass wordlist as 3rd arg if given
if [ -n "$WL" ]; then TMPL="./scripts/target-recon.sh {t} '' '$WL'"; else TMPL="./scripts/target-recon.sh {t}"; fi
PARALLEL="${PARALLEL:-1}" ./scripts/run-targets.sh "$LIST" "$TMPL"

echo
echo "[*] recon complete. Per-target output under loot/<host>/recon/. Quick triage:"
echo "    grep -riE 'admin|login|upload|api|dev|backup|config' loot/*/recon/ffuf-dirs.txt 2>/dev/null"
echo "    for d in loot/*/recon; do echo \"== \$d\"; sed -n '1,8p' \"\$d/fingerprint.txt\"; done"
