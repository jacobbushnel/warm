#!/usr/bin/env bash
# report-skel — stamp out a per-target report section you fill as you go.
# Keeps your write-up structured and replayable (the grading bar: a competent
# reader can reproduce every step). Writes loot/<label>/report-<label>.md.
#
# Usage:  ./report-skel.sh <label> [target-url-or-ip]
set -uo pipefail
LABEL="${1:?usage: report-skel.sh <label> [target]}"
TARGET="${2:-<target>}"
DIR="loot/$LABEL"; mkdir -p "$DIR"
F="$DIR/report-$LABEL.md"
[ -f "$F" ] && { echo "[!] $F exists — not overwriting"; exit 0; }
cat > "$F" <<EOF
# Target: $LABEL ($TARGET)

## Summary
<one paragraph: the vulnerability class, where, and the impact (admin session / RCE / file read)>

## Service / stack
- Server / framework:
- Notable endpoints:
- Auth model:

## Vulnerability & steps to reproduce
> A competent reader must be able to repeat every step from this section alone.

1. <step> — request:
   \`\`\`
   <exact request / curl / payload>
   \`\`\`
   response (evidence):
   \`\`\`
   <relevant response>
   \`\`\`
2. ...

## Exploit / payloads (full text)
\`\`\`
<every payload in full; paste PoC scripts here as text>
\`\`\`

## Proof
- local.txt: \`<value>\`  (screenshot: web UI with Burp + browser, OR cat from shell)
- proof.txt: \`<value>\`  (screenshot: cat/type from original path + hostname/ip a / whoami)

## Screenshot checklist
- [ ] vulnerable request + response proving the bug
- [ ] the exploit payload in action
- [ ] local.txt value (per proof rules)
- [ ] proof.txt value (per proof rules)
EOF
echo "[*] created -> $F"
echo "    raw request/response logs for this target go in $DIR/ (use logreq.sh $LABEL ...)"
