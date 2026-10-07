#!/usr/bin/env bash
# install-tools.sh — web-app pentest tooling not always preinstalled on Kali.
# Grouped by installer (apt / pipx / go / git+binary). Safe to re-run: apt skips
# already-installed; go install / pipx upgrade in place. Review before running.
set -u

say(){ printf '\n\033[36m[*] %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
say "apt packages (kali repo)"
sudo apt update
sudo apt install -y \
  jq seclists wordlists \
  ffuf feroxbuster gobuster dirsearch \
  nuclei subfinder amass \
  dalfox arjun sqlmap wfuzz nikto whatweb commix \
  testssl.sh dotdotpwn sslscan \
  rlwrap socat pwncat \
  pipx python3-pip golang-go git

# Make Go + pipx bins available now and in future shells
export PATH="$PATH:$HOME/go/bin:$HOME/.local/bin"
grep -q 'go/bin' ~/.zshrc 2>/dev/null || echo 'export PATH="$PATH:$HOME/go/bin:$HOME/.local/bin"' >> ~/.zshrc
pipx ensurepath >/dev/null 2>&1

# ---------------------------------------------------------------------------
say "Go tools (ProjectDiscovery + tomnomnom + crawlers)"
go_install(){ echo "  go: $1"; go install "$1" >/dev/null 2>&1 || echo "    [!] failed: $1"; }
go_install github.com/lc/gau/v2/cmd/gau@latest
go_install github.com/hakluke/hakrawler@latest
go_install github.com/projectdiscovery/katana/cmd/katana@latest
go_install github.com/projectdiscovery/httpx/cmd/httpx@latest          # PD httpx (Kali ships it as httpx-toolkit)
go_install github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest
go_install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest     # newer than apt
go_install github.com/tomnomnom/waybackurls@latest
go_install github.com/tomnomnom/gf@latest
go_install github.com/tomnomnom/qsreplace@latest
go_install github.com/tomnomnom/anew@latest
go_install github.com/Emoe/kxss@latest
go_install github.com/jaeles-project/gospider@latest

# ---------------------------------------------------------------------------
say "pipx tools (isolated Python CLIs)"
pipx_install(){ echo "  pipx: $1"; pipx install "$1" >/dev/null 2>&1 || pipx upgrade "$1" >/dev/null 2>&1 || echo "    [!] failed: $1"; }
pipx_install git-dumper
pipx_install uro
pipx_install clairvoyance
pipx_install xsser
pipx_install name-that-hash

# ---------------------------------------------------------------------------
say "git / binary tools -> /opt"
sudo mkdir -p /opt && sudo chown "$USER" /opt
clone(){ [ -d "/opt/$2" ] || git clone -q "$1" "/opt/$2" && echo "  /opt/$2"; }
clone https://github.com/s0md3v/XSStrike        XSStrike
clone https://github.com/ticarpi/jwt_tool        jwt_tool
clone https://github.com/dolevf/graphw00f         graphw00f
clone https://github.com/chenjj/CORScanner        CORScanner
clone https://github.com/tarunkant/Gopherus       Gopherus      # gopher payload builder
# trufflehog + gitleaks: official install scripts (static binaries)
command -v trufflehog >/dev/null || curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sudo sh -s -- -b /usr/local/bin
command -v gitleaks  >/dev/null || { curl -sSL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_8.18.4_linux_x64.tar.gz | tar xz -C /tmp gitleaks && sudo mv /tmp/gitleaks /usr/local/bin/; }

say "done. Open a new shell (or: source ~/.zshrc) so PATH picks up ~/go/bin and ~/.local/bin."
echo "    git tools live in /opt (run e.g.: python3 /opt/XSStrike/xsstrike.py)."
echo "    PD httpx is 'httpx' from go, or 'httpx-toolkit' from apt — the python 'httpx' client is a different tool."
