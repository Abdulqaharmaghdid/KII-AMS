/* ===== KII server sync =====
   Loaded first on every page. When the pages are served by server/server.cjs this:
   1) reads the data the signed-in user may see, delivered inside the page as window.__KII_STATE__,
      into this tab's storage — no blocking request is needed at startup,
   2) sends every change back to the server (record by record, so people never overwrite each other),
   3) exposes KIIServer.post() for sign-in, sign-up and application codes.
   Opened without the server (e.g. a plain static host or the automated tests) it does nothing. */
(function () {
  "use strict";
  const ITEM_KEYS = { kii_users: "email", kii_staff: "id", kii_ams_applicants: "id", kii_ams_notifs: "id", kii_ams_messages: "id" };
  const APPEND_KEYS = new Set(["kii_ams_audit"]), PROPS_KEYS = new Set(["kii_ams_chat"]);
  const CLIENT_ONLY = new Set(["kii_session", "kii_admin_session", "kii_admin_session_seen", "kii_login_locks", "kii_files_pending"]);
  const synced = k => typeof k === "string" && k.startsWith("kii_") && !CLIENT_ONLY.has(k);

  async function post(path, body, keepalive = false) {
    try {
      const r = await fetch(path, { method: "POST", keepalive,
        headers: { "X-KII": "1", "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
      let data = {}; try { data = await r.json(); } catch { }
      return { status: r.status, ok: r.ok, json: data };
    } catch { return null; }
  }
  const S = window.KIIServer = {
    enabled: false, session: {},
    /* always async: login/sign-up handlers await it; it never blocks the page */
    async post(path, body) {
      return await post(path, body) ||
        { ok: false, status: 0, json: { error: "The KII server is not reachable. Please check that it is running." } };
    },
  };
  if (location.protocol === "file:") return;
  const state = window.__KII_STATE__ || null;
  if (!state || !state.enabled) {
    /* The page was not served by server.cjs (plain static host or the test suite) — nothing to do.
       If some other server answers /api/state, load its data and reload once so the page scripts see it. */
    fetch("/api/state").then(r => r.json()).then(j => {
      if (!j || !j.enabled || sessionStorage.getItem("kii_booted")) return;
      sessionStorage.setItem("kii_booted", "1");
      for (const [k, v] of Object.entries(j.data || {})) if (synced(k)) localStorage.setItem(k, v);
      location.reload();
    }).catch(() => { });
    return;
  }
  sessionStorage.removeItem("kii_booted");

  const proto = Storage.prototype, origSet = proto.setItem, origRemove = proto.removeItem;
  const local = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (synced(k)) local[k] = localStorage.getItem(k); }

  /* first run on an empty server: offer to move this browser's existing data into it */
  if (state.canImport && Object.keys(local).some(k => k.startsWith("kii_app_") || k === "kii_users") &&
      confirm("This browser contains KII data saved before the local server was set up.\n\nUpload it to the server now so every device can use it?")) {
    post("/api/import", { data: local }).then(r => {
      if (r && r.ok) { origSet.call(localStorage, "kii_files_pending", "1"); location.reload(); }
    });
    return; // the reload brings the imported state back inside the page
  }

  S.enabled = true;
  S.session = state.session || {};
  const base = {};
  for (const k of Object.keys(local)) origRemove.call(localStorage, k);
  for (const [k, v] of Object.entries(state.data || {})) { origSet.call(localStorage, k, v); base[k] = v; }
  if (S.session.applicant) origSet.call(localStorage, "kii_session", S.session.applicant); else origRemove.call(localStorage, "kii_session");
  if (S.session.staff) {
    origSet.call(localStorage, "kii_admin_session", S.session.staff);
    origSet.call(localStorage, "kii_admin_session_seen", String(Date.now()));
  } else { origRemove.call(localStorage, "kii_admin_session"); origRemove.call(localStorage, "kii_admin_session_seen"); }

  /* ---------- change tracking ---------- */
  const dirty = new Set(); let scheduled = false, retry = null, flushing = false;
  const parse = v => { try { return v == null ? null : JSON.parse(v); } catch { return undefined; } };
  function diff(k, b, n) {
    if (n === b) return null;
    if (n === null) return { key: k, op: "del" };
    const nv = parse(n), bv = parse(b);
    const idKey = ITEM_KEYS[k];
    if (idKey && Array.isArray(nv)) {
      const id = x => String(x?.[idKey] ?? "").toLowerCase();
      const before = new Map((Array.isArray(bv) ? bv : []).map(x => [id(x), JSON.stringify(x)]));
      const upsert = nv.filter(x => before.get(id(x)) !== JSON.stringify(x));
      const ids = new Set(nv.map(id)), remove = [...before.keys()].filter(i => !ids.has(i));
      return upsert.length || remove.length ? { key: k, op: "items", upsert, remove } : null;
    }
    if (APPEND_KEYS.has(k) && Array.isArray(nv)) {
      const seen = new Set((Array.isArray(bv) ? bv : []).map(x => JSON.stringify(x)));
      const items = nv.filter(x => !seen.has(JSON.stringify(x)));
      return items.length ? { key: k, op: "append", items } : null;
    }
    if (PROPS_KEYS.has(k) && nv && typeof nv === "object") {
      const old = bv && typeof bv === "object" ? bv : {}, set = {};
      for (const [p, v] of Object.entries(nv)) if (JSON.stringify(v) !== JSON.stringify(old[p])) set[p] = v;
      const remove = Object.keys(old).filter(p => !(p in nv));
      return Object.keys(set).length || remove.length ? { key: k, op: "props", set, remove } : null;
    }
    return { key: k, op: "set", value: n };
  }
  function banner(text) {
    let el = document.getElementById("kiiSyncBanner");
    if (!text) { el?.remove(); return; }
    if (!el && document.body) {
      el = document.createElement("div"); el.id = "kiiSyncBanner";
      el.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;background:#7f1d1d;color:#fff;padding:10px 18px;border-radius:10px;font:600 13px system-ui;box-shadow:0 6px 20px rgba(0,0,0,.25)";
      document.body.appendChild(el);
    }
    if (el) el.textContent = text;
  }
  function flush() {
    scheduled = false;
    if (flushing) { scheduled = true; return; } // one request at a time; rerun after it lands
    const keys = [...dirty]; dirty.clear();
    const snap = new Map(), ops = [];
    for (const k of keys) { const v = localStorage.getItem(k); snap.set(k, v); const op = diff(k, base[k] ?? null, v); if (op) ops.push(op); }
    if (!ops.length) return;
    flushing = true;
    // keepalive lets a small save finish while the page is closing; the size cap switches big ones to a normal request
    post("/api/state", { ops }, JSON.stringify({ ops }).length < 60000).then(r => {
      if (r && r.ok) {
        for (const [k, v] of snap) { if (v == null) delete base[k]; else base[k] = v; }
        if ((r.json.rejected || []).length) console.warn("KII server did not accept:", r.json.rejected);
        banner("");
      } else {
        keys.forEach(k => dirty.add(k));
        banner(r && r.status === 401 ? "Your session has ended. Please sign in again." : "Not saved to the KII server yet. Retrying…");
        clearTimeout(retry); retry = setTimeout(schedule, 3000);
      }
      flushing = false;
      if (scheduled) flush();
    });
  }
  function schedule() { if (!scheduled) { scheduled = true; queueMicrotask(flush); } }
  S.flush = flush;
  proto.setItem = function (k, v) {
    origSet.call(this, k, v);
    if (this === localStorage && synced(k)) { dirty.add(k); schedule(); }
  };
  proto.removeItem = function (k) {
    origRemove.call(this, k);
    if (this !== localStorage) return;
    if (k === "kii_session") post("/api/logout", { kind: "applicant" }, true);
    else if (k === "kii_admin_session") post("/api/logout", { kind: "staff" }, true);
    else if (synced(k)) { dirty.add(k); schedule(); }
  };
  /* last chance to push pending changes while the tab is closing or navigating away */
  window.addEventListener("pagehide", () => { if (dirty.size) flush(); });

  /* move files saved in this browser (before the server existed) up to the server, once */
  if (localStorage.getItem("kii_files_pending") && window.indexedDB) {
    const open = indexedDB.open("kii_db", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("files");
    open.onsuccess = () => {
      const tx = open.result.transaction("files"), store = tx.objectStore("files"), cursor = store.openCursor(), items = [];
      cursor.onsuccess = () => { const c = cursor.result; if (c) { items.push([c.key, c.value]); c.continue(); } };
      tx.oncomplete = async () => {
        for (const [id, file] of items) {
          try {
            await fetch("/api/files?id=" + encodeURIComponent(id), { method: "PUT", body: file,
              headers: { "X-KII": "1", "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name || "file") } });
          } catch { }
        }
        origRemove.call(localStorage, "kii_files_pending");
      };
    };
  }
})();
