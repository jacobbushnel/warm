#!/usr/bin/env bash
# enc — one payload, every encoding. For WAF bypass, CHAR()-concat, and quick mangling.
# Pure local. Usage:  ./enc.sh '<payload>'
# Example: ./enc.sh "' OR 1=1-- -"
set -uo pipefail
P="${1:?usage: enc.sh '<payload>'}"
py(){ python3 - "$P" "$@"; }

echo "payload      : $P"
echo "url          : $(py <<'E'
import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))
E
)"
echo "url (double) : $(py <<'E'
import sys,urllib.parse;print(urllib.parse.quote(urllib.parse.quote(sys.argv[1])))
E
)"
echo "url (all)    : $(py <<'E'
import sys;print(''.join('%%%02X'%b for b in sys.argv[1].encode()))
E
)"
echo "base64       : $(printf '%s' "$P" | base64 -w0 2>/dev/null || printf '%s' "$P" | base64)"
echo "hex          : $(printf '%s' "$P" | xxd -p | tr -d '\n')"
echo "hex 0x       : 0x$(printf '%s' "$P" | xxd -p | tr -d '\n')"
echo "html entities: $(py <<'E'
import sys;print(''.join('&#%d;'%ord(c) for c in sys.argv[1]))
E
)"
echo "unicode \\u   : $(py <<'E'
import sys;print(''.join('\\u%04x'%ord(c) for c in sys.argv[1]))
E
)"
echo "mysql CHAR() : $(py <<'E'
import sys;print('CHAR('+','.join(str(b) for b in sys.argv[1].encode())+')')
E
)"
echo "mssql CHAR+  : $(py <<'E'
import sys;print('+'.join('CHAR(%d)'%b for b in sys.argv[1].encode()))
E
)"
echo "oracle CHR|| : $(py <<'E'
import sys;print('||'.join('CHR(%d)'%b for b in sys.argv[1].encode()))
E
)"
echo "case-flip    : $(py <<'E'
import sys;print(''.join(c.upper() if i%2 else c.lower() for i,c in enumerate(sys.argv[1])))
E
)"
