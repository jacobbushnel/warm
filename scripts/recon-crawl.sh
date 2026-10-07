#!/usr/bin/env bash
# recon-crawl.sh — BFS param-discovery + crawl over ffuf/feroxbuster output.
# For each discovered URL: run hakrawler (find more endpoints) + arjun (find params),
# feed newly discovered in-scope URLs back in, up to --depth rounds.
#
# Usage:
#   recon-crawl.sh -u http://target/                 # seed from one URL
#   recon-crawl.sh -i urls.txt                        # seed from a URL list
#   recon-crawl.sh --ffuf ffuf.json                   # seed from ffuf -o json
#   recon-crawl.sh --ferox ferox.txt                  # seed from feroxbuster output
# Options:
#   -d, --depth N     recursion rounds (default 2)
#   -t, --threads N   arjun threads (default 10)
#   -m, --methods M   arjun methods (default GET,POST)
#   -o, --out DIR     output dir (default ./recon-crawl-<host>)
#   --subs            let hakrawler include subdomains (default: same host only)
#   -h, --help
set -uo pipefail

DEPTH=2; THREADS=10; METHODS="GET,POST"; OUT=""; SUBS=0
SEED_FILE="$(mktemp)"; trap 'rm -f "$SEED_FILE"' EXIT

die(){ echo "[!] $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || die "missing dependency: $1"; }

# --- collect URLs from a file (json via jq, else grep) ---
extract_urls(){ # $1=file
  local f="$1"
  if head -c1 "$f" 2>/dev/null | grep -q '{' && command -v jq >/dev/null 2>&1; then
    jq -r '.. | .url? // empty' "$f" 2>/dev/null
  fi
  grep -aoE 'https?://[^ "'"'"'<>]+' "$f" 2>/dev/null
}

# --- args ---
[ $# -eq 0 ] && { grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'; exit 0; }
while [ $# -gt 0 ]; do
  case "$1" in
    -u) echo "$2" >>"$SEED_FILE"; shift 2;;
    -i) extract_urls "$2" >>"$SEED_FILE"; shift 2;;
    --ffuf|--ferox) extract_urls "$2" >>"$SEED_FILE"; shift 2;;
    -d|--depth) DEPTH="$2"; shift 2;;
    -t|--threads) THREADS="$2"; shift 2;;
    -m|--methods) METHODS="$2"; shift 2;;
    -o|--out) OUT="$2"; shift 2;;
    --subs) SUBS=1; shift;;
    -h|--help) grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) die "unknown arg: $1";;
  esac
done

need arjun; need hakrawler
sort -u -o "$SEED_FILE" "$SEED_FILE"
[ -s "$SEED_FILE" ] || die "no seed URLs found"

HOST="$(sed -nE 's#^https?://([^/:]+).*#\1#p' "$SEED_FILE" | head -1)"
[ -n "$HOST" ] || die "could not parse host from seeds"
[ -n "$OUT" ] || OUT="./recon-crawl-$HOST"
mkdir -p "$OUT"
SEEN="$OUT/all-urls.txt"; : >"$SEEN"
PARAMS="$OUT/params.txt"; : >"$PARAMS"
CRAWL="$OUT/crawled.txt"; : >"$CRAWL"

in_scope(){ if [ "$SUBS" -eq 1 ]; then grep -E "https?://([^/]*\.)?$HOST(/|:|$)"; else grep -E "https?://$HOST(/|:|$)"; fi; }

frontier="$(mktemp)"; next="$(mktemp)"; trap 'rm -f "$SEED_FILE" "$frontier" "$next"' EXIT
cp "$SEED_FILE" "$frontier"

echo "[*] host=$HOST depth=$DEPTH out=$OUT  seeds=$(wc -l <"$frontier")"
for round in $(seq 1 "$DEPTH"); do
  [ -s "$frontier" ] || { echo "[*] frontier empty, stopping"; break; }
  # only URLs not seen yet
  comm -23 <(sort -u "$frontier") <(sort -u "$SEEN") >"$next.todo"
  mv "$next.todo" "$frontier"
  [ -s "$frontier" ] || { echo "[*] nothing new, stopping"; break; }
  echo "=== round $round : $(wc -l <"$frontier") url(s) ==="
  cat "$frontier" >>"$SEEN"; sort -u -o "$SEEN" "$SEEN"

  # 1) arjun param discovery on this frontier (batched via -i)
  echo "  [arjun] param discovery..."
  arjun -i "$frontier" -m "$METHODS" -T "$THREADS" -oT "$OUT/arjun-round$round.txt" -q 2>/dev/null
  [ -f "$OUT/arjun-round$round.txt" ] && cat "$OUT/arjun-round$round.txt" >>"$PARAMS"

  # 2) hakrawler to discover new endpoints, keep in-scope + unseen
  echo "  [hakrawler] crawling..."
  HAKFLAGS="-d 2 -u -insecure"; [ "$SUBS" -eq 1 ] && HAKFLAGS="$HAKFLAGS -subs"
  # shellcheck disable=SC2086
  hakrawler $HAKFLAGS <"$frontier" 2>/dev/null | in_scope | sort -u >"$next"
  cat "$next" >>"$CRAWL"; sort -u -o "$CRAWL" "$CRAWL"
  comm -23 <(sort -u "$next") <(sort -u "$SEEN") >"$frontier"
  echo "  -> $(wc -l <"$frontier") new in-scope url(s) for next round"
done

sort -u -o "$PARAMS" "$PARAMS"; sort -u -o "$SEEN" "$SEEN"
echo
echo "[+] done."
echo "    URLs seen : $(wc -l <"$SEEN")  -> $SEEN"
echo "    crawled   : $(wc -l <"$CRAWL") -> $CRAWL"
echo "    params    : $(grep -c . "$PARAMS" 2>/dev/null) -> $PARAMS"
