/* ===== KII server sync =====
   Loaded first on every page. When the pages are served by server/server.cjs this:
   1) loads the data the signed-in user may see from the server into this tab's storage,
   2) sends every change back to the server (record by record, so people never overwrite each other),
   3) exposes KIIServer.post() for sign-in, sign-up and application codes.
   Opened without the server (e.g. a plain static host or the automated tests) it does nothing. */
(function () {
  "use strict";
  const ITEM_KEYS = { kii_users: "email", kii_staff: "id", kii_ams_applicants: "id", kii_ams_notifs: "id", kii_ams_messages: "id" };
  const APPEND_KEYS = new Set(["kii_ams_audit"]), PROPS_KEYS = new Set(["kii_ams_chat"]);
  const CLIENT_ONLY = new Set(["kii_session", "kii_admin_session", "kii_admin_session_seen", "kii_login_locks", "kii_files_pending"]);
  const synced = k => typeof k === "string" && k.startsWith("kii_") && !CLIENT_ONLY.has(k);

  function request(method, url, body) {
    const x = new XMLHttpRequest();
    try {
      x.open(method, url, false); // synchronous on purpose: a save must finish before the page navigates away
      x.setRequestHeader("X-KII", "1");
      if (body !== undefined) x.setRequestHeader("Content-Type", "application/json");
      x.send(body === undefined ? null : JSON.stringify(body));
    } catch { return null; }
    let data = null; try { data = JSON.parse(x.responseText); } catch { }
    return { status: x.status, ok: x.status >= 200 && x.status < 300, json: data || {} };
  }
  const S = window.KIIServer = {
    enabled: false, session: {},
    post(path, body) { return request("POST", path, body || {}) || { ok: false, status: 0, json: { error: "The KII server is not reachable. Please check that it is running." } }; },
  };
  if (location.protocol === "file:") return;
  let state = request("GET", "/api/state");
  if (!state || !state.ok || !state.json.enabled) return; // static mode: everything stays in this browser

  const proto = Storage.prototype, origSet = proto.setItem, origRemove = proto.removeItem;
  const local = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (synced(k)) local[k] = localStorage.getItem(k); }

  /* first run on an empty server: offer to move this browser's existing data into it */
  if (state.json.canImport && Object.keys(local).some(k => k.startsWith("kii_app_") || k === "kii_users") &&
      confirm("This browser contains KII data saved before the local server was set up.\n\nUpload it to the server now so every device can use it?")) {
    const r = request("POST", "/api/import", { data: local });
    if (r && r.ok) { origSet.call(localStorage, "kii_files_pending", "1"); state = request("GET", "/api/state") || state; }
  }

  S.enabled = true;
  S.session = state.json.session || {};
  const base = {};
  for (const k of Object.keys(local)) origRemove.call(localStorage, k);
  for (const [k, v] of Object.entries(state.json.data || {})) { origSet.call(localStorage, k, v); base[k] = v; }
  if (S.session.applicant) origSet.call(localStorage, "kii_session", S.session.applicant); else origRemove.call(localStorage, "kii_session");
  if (S.session.staff) {
    origSet.call(localStorage, "kii_admin_session", S.session.staff);
    origSet.call(localStorage, "kii_admin_session_seen", String(Date.now()));
  } else { origRemove.call(localStorage, "kii_admin_session"); origRemove.call(localStorage, "kii_admin_session_seen"); }

  /* ---------- change tracking ---------- */
  const dirty = new Set(); let scheduled = false, retry = null;
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
    const keys = [...dirty]; dirty.clear();
    const ops = keys.map(k => diff(k, base[k] ?? null, localStorage.getItem(k))).filter(Boolean);
    if (!ops.length) return;
    const r = request("POST", "/api/state", { ops });
    if (r && r.ok) {
      for (const k of keys) { const v = localStorage.getItem(k); if (v == null) delete base[k]; else base[k] = v; }
      if ((r.json.rejected || []).length) console.warn("KII server did not accept:", r.json.rejected);
      banner("");
    } else {
      keys.forEach(k => dirty.add(k));
      banner(r && r.status === 401 ? "Your session has ended. Please sign in again." : "Not saved to the KII server yet. Retrying…");
      clearTimeout(retry); retry = setTimeout(schedule, 3000);
    }
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
    if (k === "kii_session") request("POST", "/api/logout", { kind: "applicant" });
    else if (k === "kii_admin_session") request("POST", "/api/logout", { kind: "staff" });
    else if (synced(k)) { dirty.add(k); schedule(); }
  };

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
