#!/usr/bin/env bash
# Serve the console on localhost only.
PORT="${1:-8777}"
cd "$(dirname "$0")"
echo "WARM (Web App Rapid Methodology) → http://127.0.0.1:${PORT}"
exec python3 -m http.server "${PORT}" --bind 127.0.0.1
