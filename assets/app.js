/* WARM — client-side app (copy-only, no execution). */
(function () {
  "use strict";
  var M = window.METHODOLOGY, SITES = window.DORK_SITES || [], ENGINES = window.DORK_ENGINES || [],
      REV = window.REVSHELLS || [], LISTENERS = window.LISTENERS || [], TTY = window.TTY_UPGRADE || [],
      SETUP = window.SETUP || [];
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var K = { vars: "warm-vars", checks: "warm-checks", notes: "warm-notes", favs: "warm-favs", theme: "warm-theme", tab: "warm-tab", engine: "warm-engine", lists: "warm-lists" };

  var vars = LS.get(K.vars, {});
  var checks = LS.get(K.checks, {});
  var notes = LS.get(K.notes, {});
  var favs = LS.get(K.favs, []);
  M.variables.forEach(function (v) { if (vars[v.key] == null) vars[v.key] = v.def || ""; });

  // ---- multi-target lists (e.g. Target URLs / IPs): keep a list per field + a focused index.
  // vars[key] always mirrors the FOCUSED entry, so all {var} templating / report / scope guard are unchanged.
  var lists = LS.get(K.lists, {});
  M.variables.forEach(function (v) {
    if (!v.list) return;
    if (!lists[v.key] || !Array.isArray(lists[v.key].items)) {
      var seed = (vars[v.key] || "").split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
      lists[v.key] = { items: seed, focus: 0 };
    }
    if (lists[v.key].focus >= lists[v.key].items.length) lists[v.key].focus = Math.max(0, lists[v.key].items.length - 1);
    syncFocus(v.key);
  });
  LS.set(K.lists, lists); LS.set(K.vars, vars);

  function syncFocus(key) { var L = lists[key]; if (L) vars[key] = L.items[L.focus] || ""; }
  function persistList(key) { syncFocus(key); LS.set(K.lists, lists); LS.set(K.vars, vars); }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---- variable resolution ----
  function hostOf(url) {
    if (!url) return "";
    try { return new URL(url).hostname; } catch (e) {}
    return url.replace(/^[a-z]+:\/\//i, "").split(/[\/:?#]/)[0] || "";
  }
  function resolved() {
    var r = {};
    M.variables.forEach(function (v) { r[v.key] = (vars[v.key] || "").trim(); });
    r.target_url = r.target_url.replace(/\/+$/, "");
    r.target_host = hostOf(r.target_url);
    return r;
  }
  function fill(tmpl) {
    var r = resolved();
    var plain = tmpl.replace(/\{(\w+)\}/g, function (m, k) { return r[k] != null && r[k] !== "" ? r[k] : m; });
    var html = esc(tmpl).replace(/\{(\w+)\}/g, function (m, k) {
      var val = r[k];
      return (val != null && val !== "") ? esc(val) : '<span class="ph-var">' + esc(m) + "</span>";
    });
    return { html: html, plain: plain, hasUnresolved: /\{\w+\}/.test(plain) };
  }

  // ---- scope guard (IPv4 + CIDR aware) ----
  function scopeList() { return (vars.scope || "").split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function isCidr(s) { return /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(s); }
  function isIp(s) { return /^\d{1,3}(\.\d{1,3}){3}$/.test(s); }
  function ip2int(ip) { var p = ip.split("."), n = 0; if (p.length !== 4) return null; for (var i = 0; i < 4; i++) { var o = +p[i]; if (isNaN(o) || o < 0 || o > 255) return null; n = n * 256 + o; } return n >>> 0; }
  function cidrHas(cidr, ip) { var pr = cidr.split("/"), base = ip2int(pr[0]), ii = ip2int(ip), bits = +pr[1]; if (base == null || ii == null || isNaN(bits)) return false; if (bits <= 0) return true; var mask = bits >= 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0; return ((base & mask) >>> 0) === ((ii & mask) >>> 0); }
  function hostOk(host) { if (!host) return true; return scopeList().some(function (s) { if (isCidr(s)) return false; return s === host || host.indexOf(s) !== -1 || s.indexOf(host) !== -1; }); }
  function ipOk(ip) { if (!ip) return true; return scopeList().some(function (s) { if (isCidr(s)) return cidrHas(s, ip); if (isIp(s)) return s === ip; return ip.indexOf(s) !== -1; }); }
  function updateScopeWarn() {
    var w = $("#scope-warn"); if (!w) return;
    if (!scopeList().length) { w.className = "scope-warn"; w.innerHTML = ""; return; }
    var r = resolved(), host = r.target_host || r.target_url, ip = r.target_ip, bad = [];
    if (host && !hostOk(host)) bad.push(host);
    if (ip && !ipOk(ip)) bad.push(ip);
    if (bad.length) { w.className = "scope-warn show"; w.innerHTML = "<b>Out of scope:</b> " + esc(bad.join(" / ")) + " not in your authorized scope. Commands still render (warn-but-allow)."; }
    else { w.className = "scope-warn"; w.innerHTML = ""; }
  }

  // ---- scope panel ----
  function buildScope() {
    var box = $("#scope-fields"); box.innerHTML = "";
    M.variables.forEach(function (v) {
      if (v.list) { box.appendChild(buildListField(v)); if (v.guard) box.appendChild(scopeWarnEl()); return; }
      var f = el("div", "field");
      var lab = el("label", null, v.label); lab.setAttribute("for", "v-" + v.key); f.appendChild(lab);
      var input = v.multi ? el("textarea") : el("input");
      if (!v.multi) input.type = "text";
      input.id = "v-" + v.key; input.placeholder = v.placeholder || ""; input.value = vars[v.key] || "";
      input.addEventListener("input", function () { vars[v.key] = input.value; LS.set(K.vars, vars); rerender(); });
      f.appendChild(input); box.appendChild(f);
      if (v.guard) box.appendChild(scopeWarnEl());
    });
  }
  function scopeWarnEl() { var w = el("div", "scope-warn"); w.id = "scope-warn"; return w; }

  // ---- list field: multiple targets + a focused one (◉) ----
  function buildListField(v) {
    var L = lists[v.key], f = el("div", "field listfield");
    f.appendChild(el("label", null, v.label));
    var wrap = el("div", "scope-list");
    L.items.forEach(function (item, i) {
      var row = el("div", "scope-item");
      var rb = el("input"); rb.type = "radio"; rb.name = "focus-" + v.key; rb.className = "focus-radio";
      rb.checked = (i === L.focus); rb.title = "Focus this one";
      rb.addEventListener("change", function () { L.focus = i; persistList(v.key); rerender(); buildScope(); });
      row.appendChild(rb);
      var inp = el("input"); inp.type = "text"; inp.value = item; inp.placeholder = v.placeholder || "";
      inp.addEventListener("input", function () { L.items[i] = inp.value; persistList(v.key); rerender(); });
      row.appendChild(inp);
      var rm = el("button", "cbtn rm", "×"); rm.type = "button"; rm.title = "Remove";
      rm.addEventListener("click", function () {
        L.items.splice(i, 1);
        if (i < L.focus) L.focus--;                                  // keep the same entry focused
        if (L.focus >= L.items.length) L.focus = Math.max(0, L.items.length - 1);
        persistList(v.key); rerender(); buildScope();
      });
      row.appendChild(rm); wrap.appendChild(row);
    });
    var addRow = el("div", "scope-item add");
    var ai = el("input"); ai.type = "text"; ai.placeholder = "+ add " + (v.label || v.key).replace(/ \(.*\)$/, "");
    var add = function () { var val = ai.value.trim(); if (!val) return; L.items.push(val); if (L.items.length === 1) L.focus = 0; persistList(v.key); rerender(); buildScope(); };
    ai.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } });
    var ab = el("button", "cbtn", "Add"); ab.type = "button"; ab.addEventListener("click", add);
    addRow.appendChild(ai); addRow.appendChild(ab); wrap.appendChild(addRow);
    f.appendChild(wrap);
    f.appendChild(el("div", "focus-current", "◉ focused: " + (L.items[L.focus] || "(none — add a target)")));
    return f;
  }

  // ---- shared command row ----
  function cmdRow(tool, tmpl, opts) {
    opts = opts || {};
    var row = el("div", "cmd" + (opts.note ? " isnote" : ""));
    row.appendChild(el("div", "tool", tool || ""));
    var pre = el("pre"); pre.dataset.tmpl = tmpl; row.appendChild(pre);
    if (!opts.note) {
      var copy = el("button", "cbtn", "Copy"); copy.type = "button";
      copy.addEventListener("click", function () { doCopy(tmpl, copy); });
      row.appendChild(copy);
      if (opts.mode === "fav") {
        var rm = el("button", "cbtn rm", "Remove"); rm.type = "button";
        rm.addEventListener("click", function () { removeFav(opts.favId); });
        row.appendChild(rm);
      } else {
        var star = el("button", "cbtn star", "☆"); star.type = "button"; star.title = "Save to Favorites";
        star.addEventListener("click", function () { addFav(tool, tmpl); star.textContent = "★"; star.classList.add("on"); setTimeout(function () { star.textContent = "☆"; star.classList.remove("on"); }, 1100); });
        row.appendChild(star);
      }
    }
    pre.innerHTML = fill(tmpl).html;
    return row;
  }

  // ---- methodology ----
  var cid = function (pi, ii) { return "c-" + pi + "-" + ii; };
  function buildPhases() {
    var main = $("#phases"); main.innerHTML = "";
    M.phases.forEach(function (ph, pi) {
      var d = el("details", "phase"); if (pi === 0) d.open = true; d.dataset.pi = pi;
      var s = el("summary");
      s.appendChild(el("span", "num", ph.num));
      var t = el("span", "ph-title"); t.appendChild(document.createTextNode(ph.title));
      t.appendChild(el("span", "ph-goal", ph.goal)); s.appendChild(t);
      s.appendChild(el("span", "ph-done", "")); s.appendChild(el("span", "chev", "›"));
      d.appendChild(s);
      var items = el("div", "items");
      ph.items.forEach(function (it, ii) {
        var item = el("div", "item"), head = el("div", "item-head");
        var cb = el("input"); cb.type = "checkbox"; cb.id = cid(pi, ii); cb.checked = !!checks[cid(pi, ii)];
        cb.addEventListener("change", function () { checks[cb.id] = cb.checked; LS.set(K.checks, checks); updateProgress(); });
        head.appendChild(cb);
        var meta = el("div", "item-meta"), lbl = el("div", "lbl");
        lbl.appendChild(document.createTextNode(it.label));
        if (it.sev) lbl.appendChild(el("span", "tag " + it.sev, it.sev));
        meta.appendChild(lbl);
        if (it.tell) meta.appendChild(el("div", "tell", it.tell));
        head.appendChild(meta); item.appendChild(head);
        var cmds = el("div", "cmds");
        (it.cmds || []).forEach(function (c) { cmds.appendChild(cmdRow(c.tool, c.cmd, { note: c.note })); });
        item.appendChild(cmds); items.appendChild(item);
      });
      d.appendChild(items);
      var nb = el("div", "notes");
      var nl = el("label", null, "Findings / notes — " + ph.title); nl.setAttribute("for", "n-" + ph.id); nb.appendChild(nl);
      var na = el("textarea"); na.id = "n-" + ph.id; na.value = notes[ph.id] || ""; na.placeholder = "what you tried, what you found, evidence…";
      na.addEventListener("input", function () { notes[ph.id] = na.value; LS.set(K.notes, notes); });
      nb.appendChild(na); d.appendChild(nb);
      main.appendChild(d);
    });
  }

  // ---- reverse shells ----
  function buildRevshells() {
    var L = $("#listeners"); L.innerHTML = "";
    LISTENERS.forEach(function (c) { L.appendChild(cmdRow(c.name, c.cmd, {})); });
    var tty = $("#tty"); tty.textContent = TTY.join("\n");
    // language filter
    var langs = []; REV.forEach(function (r) { if (langs.indexOf(r.lang) < 0) langs.push(r.lang); });
    var sel = $("#rev-filter"); sel.innerHTML = "";
    var all = el("option"); all.value = ""; all.textContent = "all languages"; sel.appendChild(all);
    langs.forEach(function (l) { var o = el("option"); o.value = l; o.textContent = l; sel.appendChild(o); });
    sel.onchange = renderRevList;
    renderRevList();
  }
  function renderRevList() {
    var wrap = $("#revshells"); wrap.innerHTML = "";
    var f = $("#rev-filter").value;
    REV.filter(function (r) { return !f || r.lang === f; }).forEach(function (r) {
      wrap.appendChild(cmdRow(r.name, r.cmd, {}));
    });
  }

  // ---- dork search ----
  function buildDorks() {
    var es = $("#dork-engine"); es.innerHTML = "";
    ENGINES.forEach(function (e, i) { var o = el("option"); o.value = i; o.textContent = e.name; es.appendChild(o); });
    es.value = LS.get(K.engine, 0);
    es.onchange = function () { LS.set(K.engine, es.value); };
    var list = $("#dork-sites"); list.innerHTML = "";
    SITES.forEach(function (s, i) {
      var row = el("div", "site");
      var cb = el("input"); cb.type = "checkbox"; cb.checked = true; cb.id = "site-" + i; cb.dataset.dork = s.dork;
      row.appendChild(cb);
      var nm = el("label", "site-name", s.name); nm.setAttribute("for", "site-" + i); row.appendChild(nm);
      var only = el("button", "cbtn", "Only"); only.type = "button"; only.title = "Search just this site";
      only.addEventListener("click", function () { openDork([s.dork]); });
      row.appendChild(only);
      var ext = el("a", "cbtn ext", "↗"); ext.href = s.url; ext.target = "_blank"; ext.rel = "noopener"; ext.title = s.url;
      row.appendChild(ext);
      list.appendChild(row);
    });
    $("#dork-all").onclick = function () { toggleSites(true); };
    $("#dork-none").onclick = function () { toggleSites(false); };
    $("#dork-go").onclick = function () {
      var picked = [].filter.call(document.querySelectorAll("#dork-sites input:checked"), function () { return true; })
        .map(function (c) { return c.dataset.dork; });
      if (!picked.length) { flashHint("Select at least one site."); return; }
      openDork(picked);
    };
    $("#dork-q").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#dork-go").click(); });
  }
  function toggleSites(on) { document.querySelectorAll("#dork-sites input[type=checkbox]").forEach(function (c) { c.checked = on; }); }
  function openDork(dorks) {
    var e = ENGINES[$("#dork-engine").value || 0] || ENGINES[0];
    var q = ($("#dork-q").value || "").trim();
    var sitePart = dorks.length ? "(" + dorks.join(" OR ") + ") " : "";
    var full = (sitePart + q).trim();
    window.open(e.base + encodeURIComponent(full), "_blank", "noopener");
  }
  function flashHint(msg) { var h = $("#dork-hint"); h.textContent = msg; h.classList.add("show"); setTimeout(function () { h.classList.remove("show"); }, 2200); }

  // ---- setup ----
  function buildSetup() {
    var wrap = $("#setup-list"); if (!wrap) return; wrap.innerHTML = "";
    SETUP.forEach(function (g) {
      var panel = el("div", "panel");
      panel.appendChild(el("h3", null, g.group));
      if (g.note) { var n = el("p", "setup-note", g.note); panel.appendChild(n); }
      var cmds = el("div", "cmds inset");
      (g.cmds || []).forEach(function (c) { cmds.appendChild(cmdRow(c.tool, c.cmd, {})); });
      panel.appendChild(cmds); wrap.appendChild(panel);
    });
  }

  // ---- favorites ----
  function addFav(tool, tmpl) {
    if (favs.some(function (f) { return f.tmpl === tmpl; })) return;
    favs.push({ id: uid(), tool: tool || "cmd", tmpl: tmpl }); LS.set(K.favs, favs);
    if ($("#tab-favorites") && !$("#tab-favorites").hidden) buildFavorites();
    updateFavCount();
  }
  function removeFav(id) { favs = favs.filter(function (f) { return f.id !== id; }); LS.set(K.favs, favs); buildFavorites(); updateFavCount(); }
  function updateFavCount() { var b = $("#fav-count"); if (b) b.textContent = favs.length ? "(" + favs.length + ")" : ""; }
  function buildFavorites() {
    var wrap = $("#fav-list"); wrap.innerHTML = "";
    if (!favs.length) { wrap.appendChild(el("p", "empty", "No favorites yet. Hit ☆ on any command, or add one below.")); }
    else favs.forEach(function (f) { wrap.appendChild(cmdRow(f.tool, f.tmpl, { mode: "fav", favId: f.id })); });
    updateFavCount();
  }

  // ---- copy ----
  function doCopy(tmpl, btn) {
    var out = fill(tmpl), old = btn.textContent;
    var done = function () {
      btn.textContent = out.hasUnresolved ? "Copied ⚠" : "Copied ✓";
      btn.classList.add(out.hasUnresolved ? "warn-copy" : "ok");
      setTimeout(function () { btn.textContent = old; btn.classList.remove("ok", "warn-copy"); }, 1300);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.plain).then(done, function () { legacy(out.plain); done(); });
    else { legacy(out.plain); done(); }
  }
  function legacy(text) { var ta = el("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); }

  // ---- live re-render + progress ----
  function rerender() {
    updateScopeWarn();
    document.querySelectorAll(".cmd pre").forEach(function (pre) { pre.innerHTML = fill(pre.dataset.tmpl).html; });
  }
  function updateProgress() {
    var total = 0, done = 0;
    M.phases.forEach(function (ph, pi) {
      var pt = 0, pd = 0;
      ph.items.forEach(function (it, ii) { pt++; total++; if (checks[cid(pi, ii)]) { pd++; done++; } });
      var d = document.querySelector('details.phase[data-pi="' + pi + '"] .ph-done'); if (d) d.textContent = pd + "/" + pt;
    });
    $("#count").textContent = done + " / " + total;
    $("#barfill").style.width = (total ? Math.round(done / total * 100) : 0) + "%";
  }

  // ---- report ----
  function buildReport() {
    var r = resolved(), L = [];
    L.push("# WARM — Assessment Report", "");
    L.push("- Date: " + new Date().toISOString());
    L.push("- Focused URL: " + (r.target_url || "(none)"));
    L.push("- Focused IP: " + (r.target_ip || "(none)"));
    var uL = lists.target_url, iL = lists.target_ip;
    if (uL && uL.items.length > 1) L.push("- All target URLs: " + uL.items.map(function (u, i) { return u + (i === uL.focus ? " (focused)" : ""); }).join(", "));
    if (iL && iL.items.length > 1) L.push("- All target IPs: " + iL.items.map(function (p, i) { return p + (i === iL.focus ? " (focused)" : ""); }).join(", "));
    L.push("- Authorized scope: " + (scopeList().join(", ") || "(none set)"));
    L.push("- Tester IP(s): " + (r.tester_ip || "(none)") + " · listener port: " + (r.tester_port || "(none)"));
    L.push("");
    M.phases.forEach(function (ph, pi) {
      L.push("## " + ph.num + " · " + ph.title);
      ph.items.forEach(function (it, ii) { L.push("- [" + (checks[cid(pi, ii)] ? "x" : " ") + "] " + it.label + (it.sev ? " (" + it.sev + ")" : "")); });
      if ((notes[ph.id] || "").trim()) L.push("", "**Notes:**", "", notes[ph.id].trim());
      L.push("");
    });
    return L.join("\n");
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain" }), url = URL.createObjectURL(blob);
    var a = el("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---- tabs ----
  function showTab(name) {
    ["methodology", "revshells", "dorks", "setup", "favorites"].forEach(function (t) {
      var sec = $("#tab-" + t); if (sec) sec.hidden = (t !== name);
      var btn = document.querySelector('.tab[data-tab="' + t + '"]'); if (btn) btn.classList.toggle("active", t === name);
    });
    LS.set(K.tab, name);
    if (name === "favorites") buildFavorites();
  }

  // ---- theme ----
  function applyTheme(t) { if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }
  var theme = LS.get(K.theme, "system"); applyTheme(theme);

  // ---- init ----
  document.addEventListener("DOMContentLoaded", function () {
    buildScope(); buildPhases(); buildRevshells(); buildDorks(); buildSetup(); buildFavorites();
    rerender(); updateProgress(); updateFavCount();
    document.querySelectorAll(".tab").forEach(function (b) { b.addEventListener("click", function () { showTab(b.dataset.tab); }); });
    showTab(LS.get(K.tab, "methodology"));
    $("#reset").addEventListener("click", function () {
      if (!window.confirm("Clear all checkboxes and notes? (scope + favorites are kept)")) return;
      checks = {}; notes = {}; LS.set(K.checks, checks); LS.set(K.notes, notes);
      buildPhases(); rerender(); updateProgress();
    });
    $("#export").addEventListener("click", function () {
      var host = (resolved().target_host || "target").replace(/[^\w.-]/g, "_");
      download("warm-report-" + host + "-" + Date.now() + ".md", buildReport(), "text/markdown");
    });
    $("#theme").addEventListener("click", function () {
      theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
      LS.set(K.theme, theme); applyTheme(theme); $("#theme").textContent = "Theme: " + theme;
    });
    $("#theme").textContent = "Theme: " + theme;
    // favorites: custom add + export/import
    $("#fav-add").addEventListener("click", function () {
      var t = $("#fav-tool").value.trim() || "cmd", c = $("#fav-cmd").value.trim();
      if (!c) return;
      favs.push({ id: uid(), tool: t, tmpl: c }); LS.set(K.favs, favs);
      $("#fav-tool").value = ""; $("#fav-cmd").value = ""; buildFavorites();
    });
    $("#fav-export").addEventListener("click", function () { download("warm-favorites.json", JSON.stringify(favs, null, 2), "application/json"); });
    $("#fav-import").addEventListener("change", function (e) {
      var file = e.target.files[0]; if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var arr = JSON.parse(rd.result);
          if (Array.isArray(arr)) {
            arr.forEach(function (f) { if (f && f.tmpl && !favs.some(function (x) { return x.tmpl === f.tmpl; })) favs.push({ id: uid(), tool: f.tool || "cmd", tmpl: f.tmpl }); });
            LS.set(K.favs, favs); buildFavorites();
          }
        } catch (err) { window.alert("Could not parse that file as WARM favorites JSON."); }
        e.target.value = "";
      };
      rd.readAsText(file);
    });
  });
})();
