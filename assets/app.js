/* Web Assessment Console — client-side app (copy-only, no execution). */
(function () {
  "use strict";
  var M = window.METHODOLOGY;
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var K = { vars: "wac-vars", active: "wac-active", checks: "wac-checks", notes: "wac-notes", theme: "wac-theme" };

  var vars = LS.get(K.vars, {});
  var active = LS.get(K.active, "");
  var checks = LS.get(K.checks, {});
  var notes = LS.get(K.notes, {});

  M.variables.forEach(function (v) { if (vars[v.key] == null) vars[v.key] = v.def || ""; });

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  // ---- variable resolution ----
  function targetList() {
    return (vars.target || "").split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function resolved() {
    var r = {};
    M.variables.forEach(function (v) { r[v.key] = (vars[v.key] || "").trim(); });
    r.target = (active || targetList()[0] || "").trim(); // {target} = active host
    return r;
  }
  function inScope(host) {
    if (!host) return false;
    var list = targetList();
    if (!list.length) return false;
    return list.some(function (s) { return s === host || s.indexOf(host) !== -1 || host.indexOf(s) !== -1; });
  }
  // returns {html, plain} — html highlights unresolved {vars}
  function fill(tmpl) {
    var r = resolved();
    var plain = tmpl.replace(/\{(\w+)\}/g, function (m, k) { return r[k] != null && r[k] !== "" ? r[k] : m; });
    var html = esc(tmpl).replace(/\{(\w+)\}/g, function (m, k) {
      var val = r[k];
      if (val != null && val !== "") return esc(val);
      return '<span class="ph-var">' + esc(m) + "</span>";
    });
    return { html: html, plain: plain, hasUnresolved: /\{\w+\}/.test(plain) };
  }

  // ---- scope panel ----
  function buildScope() {
    var box = $("#scope-fields");
    box.innerHTML = "";
    M.variables.forEach(function (v) {
      var f = el("div", "field");
      var lab = el("label", null, v.label); lab.setAttribute("for", "v-" + v.key); f.appendChild(lab);
      var input;
      if (v.multi) {
        input = el("textarea"); input.placeholder = v.placeholder || "";
      } else {
        input = el("input"); input.type = "text"; input.placeholder = v.placeholder || "";
      }
      input.id = "v-" + v.key; input.value = vars[v.key] || "";
      input.addEventListener("input", function () {
        vars[v.key] = input.value; LS.set(K.vars, vars);
        if (v.key === "target") refreshActiveOptions();
        rerender();
      });
      f.appendChild(input);
      box.appendChild(f);
      if (v.key === "target") box.appendChild(activeField());
    });
  }
  function activeField() {
    var f = el("div", "field");
    var lab = el("label", null, "Active target → {target}"); lab.setAttribute("for", "v-active"); f.appendChild(lab);
    var inp = el("input"); inp.type = "text"; inp.id = "v-active"; inp.placeholder = "pick / type one host";
    inp.setAttribute("list", "active-list"); inp.value = active;
    inp.addEventListener("input", function () { active = inp.value; LS.set(K.active, active); rerender(); });
    f.appendChild(inp);
    var dl = el("datalist"); dl.id = "active-list"; f.appendChild(dl);
    f.appendChild(scopeWarnEl());
    return f;
  }
  function scopeWarnEl() { var w = el("div", "scope-warn"); w.id = "scope-warn"; return w; }
  function refreshActiveOptions() {
    var dl = $("#active-list"); if (!dl) return;
    dl.innerHTML = "";
    targetList().forEach(function (t) { var o = el("option"); o.value = t; dl.appendChild(o); });
    if (!active && targetList().length) { active = targetList()[0]; LS.set(K.active, active); var ai = $("#v-active"); if (ai) ai.value = active; }
  }
  function updateScopeWarn() {
    var w = $("#scope-warn"); if (!w) return;
    var host = resolved().target;
    if (!host) { w.className = "scope-warn show"; w.innerHTML = "<b>No active target.</b> Commands show unfilled {target}."; }
    else if (!inScope(host)) { w.className = "scope-warn show"; w.innerHTML = "<b>Out of scope:</b> " + esc(host) + " is not in your Target list. Commands still render (warn-but-allow)."; }
    else { w.className = "scope-warn"; w.innerHTML = ""; }
  }

  // ---- phases ----
  var idOf = function (pi, ii) { return "c-" + pi + "-" + ii; };
  function buildPhases() {
    var main = $("#phases"); main.innerHTML = "";
    M.phases.forEach(function (ph, pi) {
      var d = el("details", "phase"); if (pi === 0) d.open = true; d.dataset.pi = pi;
      var s = el("summary");
      s.appendChild(el("span", "num", ph.num));
      var t = el("span", "ph-title"); t.appendChild(document.createTextNode(ph.title));
      var g = el("span", "ph-goal", ph.goal); t.appendChild(g); s.appendChild(t);
      s.appendChild(el("span", "ph-done", "")); // filled by rerender
      var ch = el("span", "chev", "›"); s.appendChild(ch);
      d.appendChild(s);

      var items = el("div", "items");
      ph.items.forEach(function (it, ii) {
        var item = el("div", "item");
        var head = el("div", "item-head");
        var cb = el("input"); cb.type = "checkbox"; cb.id = idOf(pi, ii); cb.checked = !!checks[idOf(pi, ii)];
        cb.addEventListener("change", function () { checks[cb.id] = cb.checked; LS.set(K.checks, checks); updateProgress(); });
        head.appendChild(cb);
        var meta = el("div", "item-meta");
        var lbl = el("div", "lbl"); lbl.appendChild(document.createTextNode(it.label));
        if (it.sev) { var tg = el("span", "tag " + it.sev, it.sev); lbl.appendChild(tg); }
        meta.appendChild(lbl);
        if (it.tell) meta.appendChild(el("div", "tell", it.tell));
        head.appendChild(meta);
        item.appendChild(head);

        var cmds = el("div", "cmds");
        (it.cmds || []).forEach(function (c) {
          var row = el("div", "cmd" + (c.note ? " isnote" : ""));
          row.appendChild(el("div", "tool", c.tool || ""));
          var pre = el("pre"); pre.dataset.tmpl = c.cmd; row.appendChild(pre);
          if (!c.note) {
            var btn = el("button", "copy", "Copy"); btn.type = "button";
            btn.addEventListener("click", function () { doCopy(c.cmd, btn); });
            row.appendChild(btn);
          }
          cmds.appendChild(row);
        });
        item.appendChild(cmds);
        items.appendChild(item);
      });
      d.appendChild(items);

      var nb = el("div", "notes");
      var nl = el("label", null, "Findings / notes — " + ph.title); nl.setAttribute("for", "n-" + ph.id); nb.appendChild(nl);
      var na = el("textarea"); na.id = "n-" + ph.id; na.value = notes[ph.id] || "";
      na.placeholder = "what you tried, what you found, evidence…";
      na.addEventListener("input", function () { notes[ph.id] = na.value; LS.set(K.notes, notes); });
      nb.appendChild(na); d.appendChild(nb);

      main.appendChild(d);
    });
  }

  function doCopy(tmpl, btn) {
    var out = fill(tmpl);
    var write = function () {
      btn.textContent = out.hasUnresolved ? "Copied ⚠" : "Copied ✓";
      btn.className = "copy " + (out.hasUnresolved ? "warn-copy" : "ok");
      setTimeout(function () { btn.textContent = "Copy"; btn.className = "copy"; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(out.plain).then(write, function () { legacyCopy(out.plain); write(); });
    } else { legacyCopy(out.plain); write(); }
  }
  function legacyCopy(text) {
    var ta = el("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ---- live render of command text + progress ----
  function rerender() {
    refreshActiveOptions();
    updateScopeWarn();
    document.querySelectorAll(".cmd pre").forEach(function (pre) {
      pre.innerHTML = fill(pre.dataset.tmpl).html;
    });
  }
  function updateProgress() {
    var total = 0, done = 0;
    M.phases.forEach(function (ph, pi) {
      var pt = 0, pd = 0;
      ph.items.forEach(function (it, ii) { pt++; total++; if (checks[idOf(pi, ii)]) { pd++; done++; } });
      var d = document.querySelector('details.phase[data-pi="' + pi + '"] .ph-done');
      if (d) d.textContent = pd + "/" + pt;
    });
    $("#count").textContent = done + " / " + total;
    $("#barfill").style.width = (total ? Math.round(done / total * 100) : 0) + "%";
  }

  // ---- report export ----
  function buildReport() {
    var r = resolved(), now = new Date();
    var L = [];
    L.push("# Web Assessment — Methodology Report", "");
    L.push("- Date: " + now.toISOString());
    L.push("- Scope (targets):");
    (targetList().length ? targetList() : ["(none set)"]).forEach(function (t) { L.push("  - " + t); });
    L.push("- Active target: " + (r.target || "(none)"));
    L.push("- Tester IP(s): " + (r.tester_ip || "(none)") + "  ·  listener port: " + (r.tester_port || "(none)"));
    L.push("");
    M.phases.forEach(function (ph, pi) {
      L.push("## " + ph.num + " · " + ph.title);
      ph.items.forEach(function (it, ii) {
        L.push("- [" + (checks[idOf(pi, ii)] ? "x" : " ") + "] " + it.label + (it.sev ? " (" + it.sev + ")" : ""));
      });
      if ((notes[ph.id] || "").trim()) { L.push("", "**Notes:**", "", notes[ph.id].trim()); }
      L.push("");
    });
    return L.join("\n");
  }
  function download(name, text) {
    var blob = new Blob([text], { type: "text/markdown" });
    var url = URL.createObjectURL(blob);
    var a = el("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---- theme toggle ----
  function applyTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  var theme = LS.get(K.theme, "system"); applyTheme(theme);

  // ---- wire up ----
  document.addEventListener("DOMContentLoaded", function () {
    buildScope(); buildPhases(); refreshActiveOptions(); rerender(); updateProgress();
    $("#reset").addEventListener("click", function () {
      if (!window.confirm("Clear all checkboxes and notes? (scope inputs are kept)")) return;
      checks = {}; notes = {}; LS.set(K.checks, checks); LS.set(K.notes, notes);
      buildPhases(); rerender(); updateProgress();
    });
    $("#export").addEventListener("click", function () {
      var host = (resolved().target || "target").replace(/[^\w.-]/g, "_");
      download("assessment-" + host + "-" + Date.now() + ".md", buildReport());
    });
    $("#theme").addEventListener("click", function () {
      theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
      LS.set(K.theme, theme); applyTheme(theme); $("#theme").textContent = "Theme: " + theme;
    });
    $("#theme").textContent = "Theme: " + theme;
  });
})();
