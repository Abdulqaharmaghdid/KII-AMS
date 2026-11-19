/* ===== KII local server: static files + shared database + server-side sign-in and access control =====
   Run:  node server/server.cjs   (or start.bat)        Data:  data/kii.db, data/files/
   One shared store for every browser/device on this computer or local network.
   Pages keep their existing storage API; js/server-sync.js mirrors each user's permitted data. */
"use strict";
process.removeAllListeners("warning"); // node:sqlite prints an "experimental" notice on Node 22
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto"), os = require("os"), vm = require("vm");
const { DatabaseSync } = require("node:sqlite");

const PORT = +process.env.PORT || 8090, HOST = process.env.HOST || "0.0.0.0";
const ROOT = path.resolve(__dirname, ".."), DATA = process.env.KII_DATA_DIR || path.join(ROOT, "data"), FILES = path.join(DATA, "files");
fs.mkdirSync(FILES, { recursive: true });

/* reuse the role and development-area definitions of the front end so both sides always agree */
const shared = (() => {
  const ctx = { window: {}, document: {}, localStorage: {}, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/common.js"), "utf8") + ";this.__areas = KII.areaPrefixes;", ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/ams.js"), "utf8") + ";this.__roles = ROLES;", ctx);
  return { areas: ctx.__areas, roles: ctx.__roles };
})();

/* ---------- database ---------- */
const db = new DatabaseSync(path.join(DATA, "kii.db"));
db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, kind TEXT NOT NULL, subject TEXT NOT NULL, created_at INTEGER NOT NULL, seen_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, owner TEXT, name TEXT, type TEXT, size INTEGER, disk TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS locks (id TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL);`);
const q = {
  get: db.prepare("SELECT value FROM kv WHERE key = ?"),
  all: db.prepare("SELECT key, value FROM kv"),
  put: db.prepare("INSERT INTO kv (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by"),
  del: db.prepare("DELETE FROM kv WHERE key = ?"),
  count: db.prepare("SELECT COUNT(*) AS n FROM kv WHERE key LIKE 'kii_app_%' OR key = 'kii_users'"),
  sessGet: db.prepare("SELECT * FROM sessions WHERE token = ?"),
  sessPut: db.prepare("INSERT INTO sessions (token, kind, subject, created_at, seen_at) VALUES (?, ?, ?, ?, ?)"),
  sessSeen: db.prepare("UPDATE sessions SET seen_at = ? WHERE token = ?"),
  sessDel: db.prepare("DELETE FROM sessions WHERE token = ?"),
  sessPurge: db.prepare("DELETE FROM sessions WHERE (kind = 'staff' AND seen_at < ?) OR (kind = 'applicant' AND seen_at < ?)"),
  fileGet: db.prepare("SELECT * FROM files WHERE id = ?"),
  filePut: db.prepare("INSERT INTO files (id, owner, name, type, size, disk, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET owner = excluded.owner, name = excluded.name, type = excluded.type, size = excluded.size, disk = excluded.disk"),
  fileDel: db.prepare("DELETE FROM files WHERE id = ?"),
  lockGet: db.prepare("SELECT * FROM locks WHERE id = ?"),
  lockPut: db.prepare("INSERT INTO locks (id, n, until) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET n = excluded.n, until = excluded.until"),
  lockDel: db.prepare("DELETE FROM locks WHERE id = ?"),
};
const now = () => new Date().toISOString();
const raw = key => q.get.get(key)?.value ?? null;
const json = (key, fallback) => { try { const v = raw(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
const store = (key, value, by) => q.put.run(key, typeof value === "string" ? value : JSON.stringify(value), now(), by || null);
const lc = s => String(s ?? "").trim().toLowerCase();

/* ---------- passwords (same salted, stretched SHA-256 format as the existing records) ---------- */
const sha = s => crypto.createHash("sha256").update(s, "utf8").digest("hex");
function makePassword(plain) {
  const salt = crypto.randomBytes(12).toString("hex");
  let h = salt + ":" + plain; for (let i = 0; i < 1000; i++) h = sha(h);
  return { passHash: h, passSalt: salt };
}
function checkPassword(rec, plain) {
  if (!rec) return false;
  if (rec.passHash && rec.passSalt) {
    let h = rec.passSalt + ":" + plain; for (let i = 0; i < 1000; i++) h = sha(h);
    return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(String(rec.passHash).padEnd(h.length).slice(0, h.length)));
  }
  return rec.password != null && rec.password === plain;
}
/* 5 failed attempts lock the account for 5 minutes */
function lockedMinutes(id) { const l = q.lockGet.get(id); return l && l.until > Date.now() ? Math.ceil((l.until - Date.now()) / 60000) : 0; }
function recordFail(id) {
  const l = q.lockGet.get(id), n = (l && l.until <= Date.now() && l.until ? 0 : l?.n || 0) + 1;
  q.lockPut.run(id, n >= 5 ? 0 : n, n >= 5 ? Date.now() + 5 * 60000 : 0);
}

/* ---------- first start: default Master Admin (must change password at first sign-in) ---------- */
if (!json("kii_staff", []).length) {
  store("kii_staff", [{ id: "st_" + crypto.randomBytes(4).toString("hex"), name: "Master Admin", email: "admin@kii.org",
    ...makePassword("admin123"), mustChangePassword: true, role: "master_admin", title: "Master Administrator",
    active: true, perms: [...shared.roles.master_admin.perms], createdAt: now() }], "server");
  console.log("  Created default Master Admin: admin@kii.org / admin123 (you must change it at first sign-in)");
}
for (const flag of ["kii_ams_seeded_v1", "kii_ams_clean_v1"]) if (raw(flag) == null) store(flag, "1", "server");
if (!json("kii_invite", {}).code) store("kii_invite", { code: "KII-2026" }, "server");

/* ---------- sessions ---------- */
const IDLE = { staff: 60 * 60000, applicant: 12 * 3600000 };
const COOKIE = { applicant: "kii_a", staff: "kii_s" };
function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map(c => c.trim().split("=")).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]));
}
function context(req) {
  q.sessPurge.run(Date.now() - IDLE.staff, Date.now() - IDLE.applicant);
  const c = cookies(req), ctx = { applicant: null, staff: null, tokens: {} };
  for (const kind of ["applicant", "staff"]) {
    const s = c[COOKIE[kind]] && q.sessGet.get(c[COOKIE[kind]]);
    if (!s || s.kind !== kind) continue;
    if (kind === "applicant") { if (json("kii_users", []).some(u => lc(u.email) === s.subject)) ctx.applicant = s.subject; }
    else { const st = json("kii_staff", []).find(x => x.id === s.subject && x.active); if (st) ctx.staff = st; }
    if (ctx[kind]) { q.sessSeen.run(Date.now(), s.token); ctx.tokens[kind] = s.token; }
  }
  return ctx;
}
function startSession(res, kind, subject) {
  const token = crypto.randomBytes(32).toString("hex");
  q.sessPut.run(token, kind, subject, Date.now(), Date.now());
  addCookie(res, `${COOKIE[kind]}=${token}; HttpOnly; SameSite=Lax; Path=/`);
}
function endSession(req, res, kind) {
  const t = cookies(req)[COOKIE[kind]]; if (t) q.sessDel.run(t);
  addCookie(res, `${COOKIE[kind]}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}
function addCookie(res, c) { const prev = res.getHeader("Set-Cookie") || []; res.setHeader("Set-Cookie", [...prev, c]); }
const can = (staff, perm) => !!staff && (staff.perms || []).includes(perm) || (staff?.role === "master_admin" && perm === "manage_form");
const who = ctx => ctx.staff ? "staff:" + ctx.staff.id : ctx.applicant ? "applicant:" + ctx.applicant : "anonymous";

/* ---------- access rules ---------- */
const CLIENT_ONLY = new Set(["kii_session", "kii_admin_session", "kii_admin_session_seen", "kii_login_locks", "kii_files_pending"]);
const SERVER_ONLY = new Set(["kii_code_counters"]);
const PUBLIC = new Set(["kii_ams_settings", "kii_form_custom", "kii_form_schema", "kii_ams_seeded_v1", "kii_ams_clean_v1"]);
const SECRET = ["passHash", "passSalt", "password"];
const ITEM_KEYS = { kii_users: "email", kii_staff: "id", kii_ams_applicants: "id", kii_ams_notifs: "id", kii_ams_messages: "id", kii_ams_prs: "id" };
const NEWEST_FIRST = new Set(["kii_ams_notifs", "kii_ams_messages", "kii_ams_audit"]);
const CAPS = { kii_ams_notifs: 5000, kii_ams_messages: 5000, kii_ams_audit: 5000 };
/* staff-only parts of a case record: hidden from the applicant and never writable by them */
const APPLICANT_HIDDEN = ["evaluations", "decisions", "kpis", "kpiSheets", "checklist", "procurement", "documents", "meetings",
  "messages", "spent", "committed", "supportApproved", "inScope", "internalNotes", "notes", "assignedTo", "gates", "conditions", "transferTo"];
const APPLICANT_LOCKED = [...APPLICANT_HIDDEN, "stage", "stageForced", "outcome", "assignedToName",
  "workflow", "state", "wfMilestones", "tracks", "decisionNotified", "wfAOutcome"];
const STAFF_SELF_FIELDS = ["passHash", "passSalt", "mustChangePassword", "lastLogin"];
const strip = o => { const c = { ...o }; SECRET.forEach(f => delete c[f]); return c; };
const omit = (o, fields) => { const c = { ...o }; fields.forEach(f => delete c[f]); return c; };
const ownsPortal = (id, e) => { const p = "portal:" + e; id = lc(id); return id === p || id.startsWith(p + "::"); };
const ownsAppKey = (key, e) => { const p = "kii_app_" + e; key = lc(key); return key === p || key.startsWith(p + "::"); };

function readable(ctx, key, value) {
  if (CLIENT_ONLY.has(key) || SERVER_ONLY.has(key)) return undefined;
  if (PUBLIC.has(key)) return value;
  const parse = () => { try { return JSON.parse(value); } catch { return null; } };
  if (ctx.staff) {
    if (key === "kii_users" || key === "kii_staff") return JSON.stringify((parse() || []).map(strip));
    return value;
  }
  const e = ctx.applicant;
  if (!e) return undefined;
  if (ownsAppKey(key, e) || lc(key) === "kii_selected_" + e) return value;
  if (key === "kii_users") return JSON.stringify((parse() || []).filter(u => lc(u.email) === e).map(strip));
  if (key === "kii_staff") return JSON.stringify((parse() || []).filter(s => s.active)
    .map(s => ({ id: s.id, name: s.name, role: s.role, title: s.title, active: s.active, perms: s.perms })));
  if (key === "kii_ams_applicants") return JSON.stringify((parse() || []).filter(a => ownsPortal(a.id, e)).map(a => {
    const c = omit(a, APPLICANT_HIDDEN);
    /* the evaluation outcome is only visible after staff record the notification milestone */
    if (a.workflow !== "B" && !a.decisionNotified) delete c.outcome;
    return c;
  }));
  if (key === "kii_ams_messages") return JSON.stringify((parse() || []).filter(m => m.appId && ownsPortal(m.appId, e)));
  if (key === "kii_ams_chat") return JSON.stringify(Object.fromEntries(Object.entries(parse() || {}).filter(([id]) => ownsPortal(id, e))));
  return undefined;
}
function stateFor(ctx) {
  const data = {};
  for (const { key, value } of q.all.all()) { const v = readable(ctx, key, value); if (v !== undefined) data[key] = v; }
  return data;
}
function statePayload(ctx, req) {
  const empty = q.count.get().n === 0;
  return { enabled: true, empty, canImport: empty && isLocal(req),
    session: { applicant: ctx.applicant, staff: ctx.staff?.id || null }, data: stateFor(ctx) };
}
function canSet(ctx, key) {
  if (!ctx.staff && !ctx.applicant) return false;
  if (CLIENT_ONLY.has(key)) return true;
  if (SERVER_ONLY.has(key) || ITEM_KEYS[key] || key === "kii_ams_audit" || key === "kii_ams_chat") return false;
  if (key === "kii_form_schema" || key === "kii_ams_seeded_v1" || key === "kii_ams_clean_v1") return true;
  if (key === "kii_ams_settings" || key === "kii_invite") return can(ctx.staff, "manage_staff");
  if (key === "kii_form_custom") return can(ctx.staff, "manage_form");
  if (ctx.staff) return key.startsWith("kii_");
  return ownsAppKey(key, ctx.applicant) || lc(key) === "kii_selected_" + ctx.applicant;
}

/* item-level merge so two people editing different records never overwrite each other */
function applyItems(ctx, op, rejected) {
  const key = op.key, idKey = ITEM_KEYS[key], e = ctx.applicant, st = ctx.staff;
  const list = json(key, []), idOf = x => lc(x?.[idKey]);
  for (const item of op.upsert || []) {
    if (!item || typeof item !== "object" || !idOf(item)) continue;
    const i = list.findIndex(x => idOf(x) === idOf(item)), cur = i >= 0 ? list[i] : null;
    let next = { ...item };
    if (key === "kii_users" || key === "kii_staff") for (const f of SECRET) if (!(f in item) && cur && f in cur) next[f] = cur[f];
    if (st) {
      if (key === "kii_staff" && !can(st, "manage_staff")) {
        if (!cur || cur.id !== st.id) { rejected.push(key + ":" + idOf(item)); continue; }
        next = { ...cur }; for (const f of STAFF_SELF_FIELDS) if (f in item) next[f] = item[f];
        if (!("password" in item)) delete next.password;
      }
    } else {
      let ok = false;
      if (key === "kii_users") ok = idOf(item) === e && !!cur;
      else if (key === "kii_ams_applicants") ok = ownsPortal(item.id, e);
      else if (key === "kii_ams_notifs" || key === "kii_ams_messages") ok = !cur;
      if (!ok) { rejected.push(key + ":" + idOf(item)); continue; }
      if (key === "kii_users") { next = { ...cur, ...omit(item, SECRET) }; }
      if (key === "kii_ams_applicants") {
        for (const f of APPLICANT_LOCKED) { if (cur && f in cur) next[f] = cur[f]; else delete next[f]; }
        if (!cur) { next.stage = "Submitted Form"; next.status = next.status === "Inactive" ? "Inactive" : "Active"; }
      }
    }
    if (i >= 0) list[i] = next; else if (NEWEST_FIRST.has(key)) list.unshift(next); else list.push(next);
  }
  for (const id of op.remove || []) {
    const i = list.findIndex(x => idOf(x) === lc(id)); if (i < 0) continue;
    const cur = list[i];
    const ok = st ? !(key === "kii_staff" && !can(st, "manage_staff"))
      : key === "kii_ams_applicants" && ownsPortal(cur.id, e) && !cur.portalData?.submitted && !cur.portalData?.withdrawn;
    if (ok) list.splice(i, 1); else rejected.push(key + ":-" + id);
  }
  store(key, CAPS[key] ? list.slice(0, CAPS[key]) : list, who(ctx));
}
function applyOps(ctx, ops) {
  const rejected = [];
  for (const op of Array.isArray(ops) ? ops : []) {
    const key = String(op?.key || "");
    if (!key.startsWith("kii_") || key.length > 300) { rejected.push(key); continue; }
    if (!ctx.staff && !ctx.applicant) { rejected.push(key); continue; }
    if (CLIENT_ONLY.has(key)) continue;
    if (op.op === "items" && ITEM_KEYS[key]) { applyItems(ctx, op, rejected); continue; }
    if (op.op === "append" && key === "kii_ams_audit") {
      const items = (op.items || []).filter(x => x && typeof x === "object").map(x => ({ ...x, by: x.by || who(ctx) }));
      store(key, [...items, ...json(key, [])].slice(0, CAPS[key]), who(ctx)); continue;
    }
    if (op.op === "props" && key === "kii_ams_chat") {
      const all = json(key, {});
      for (const [id, thread] of Object.entries(op.set || {})) {
        if (!ctx.staff && !ownsPortal(id, ctx.applicant)) { rejected.push(key + ":" + id); continue; }
        const byId = new Map((all[id] || []).map(m => [m.id, m]));
        for (const m of Array.isArray(thread) ? thread : []) if (m && m.id && (ctx.staff || !byId.has(m.id))) byId.set(m.id, m);
        all[id] = [...byId.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      }
      if (ctx.staff) for (const id of op.remove || []) delete all[id];
      store(key, all, who(ctx)); continue;
    }
    if (!canSet(ctx, key)) { rejected.push(key); continue; }
    if (op.op === "del") {
      if (!ctx.staff && ownsAppKey(key, ctx.applicant)) {
        const cur = json(key, null); if (cur?.submitted || cur?.status === "Withdrawn") { rejected.push(key); continue; }
      }
      q.del.run(key); continue;
    }
    if (op.op === "set" && typeof op.value === "string") {
      if (!ctx.staff && ownsAppKey(key, ctx.applicant)) {
        /* a submitted application can only change through the revision flow, withdrawal or resubmission */
        const cur = json(key, null); let next = null; try { next = JSON.parse(op.value); } catch { }
        if (!next || typeof next !== "object") { rejected.push(key); continue; }
        if (cur?.applicantCode && next.applicantCode !== cur.applicantCode) next.applicantCode = cur.applicantCode;
        if (cur?.submitted && !cur.revisionNote && next.status !== "Withdrawn" && JSON.stringify(cur.data) !== JSON.stringify(next.data)) { rejected.push(key); continue; }
        store(key, next, who(ctx)); continue;
      }
      store(key, op.value, who(ctx)); continue;
    }
    rejected.push(key);
  }
  return rejected;
}

/* atomic application codes (EDU013 …), unique across every applicant */
function nextCode(area) {
  const prefix = shared.areas[area] || "APP", re = new RegExp("^" + prefix + "(\\d+)$");
  let max = json("kii_code_counters", {})[prefix] || 0;
  for (const { key, value } of q.all.all()) {
    if (!key.startsWith("kii_app_")) continue;
    try { const m = (JSON.parse(value)?.applicantCode || "").match(re); if (m) max = Math.max(max, +m[1]); } catch { }
  }
  const counters = json("kii_code_counters", {}); counters[prefix] = max + 1; store("kii_code_counters", counters, "server");
  return prefix + String(max + 1).padStart(3, "0");
}

/* files */
const diskName = id => crypto.createHash("sha256").update(id).digest("hex");
function referencedBy(state, id) { return Object.values(state).some(v => typeof v === "string" && v.includes(JSON.stringify(id).slice(1, -1))); }
function canReadFile(ctx, rec) {
  if (ctx.staff) return true;
  if (!ctx.applicant) return false;
  return rec.owner === ctx.applicant || referencedBy(stateFor(ctx), rec.id);
}
const isLocal = req => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);

/* ---------- HTTP ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".csv": "text/csv; charset=utf-8", ".json": "application/json", ".mp4": "video/mp4", ".md": "text/markdown; charset=utf-8", ".woff2": "font/woff2" };
const BLOCKED = /^(data|server|node_modules|tests|tools|docs|\.git|\.audit-tmp)(\/|$)|(^|\/)\.|\.(cjs|db|bat|md)$|^package(-lock)?\.json$/i;
function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", c => { size += c.length; if (size > limit) { reject(Object.assign(new Error("Upload too large"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks))); req.on("error", reject);
  });
}
const readJson = async req => { try { return JSON.parse((await readBody(req, 64 * 1024 * 1024)).toString("utf8") || "{}"); } catch (e) { throw e.status ? e : Object.assign(new Error("Invalid request"), { status: 400 }); } };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function api(req, res, url) {
  const route = req.method + " " + url.pathname;
  if (req.method !== "GET" && req.headers["x-kii"] !== "1") return send(res, 403, { error: "Missing request header." }); // CSRF guard
  const ctx = context(req);

  if (route === "GET /api/state") return send(res, 200, statePayload(ctx, req));
  if (route === "POST /api/state") {
    const body = await readJson(req);
    return send(res, 200, { ok: true, rejected: applyOps(ctx, body.ops) });
  }
  if (route === "POST /api/signup") {
    const { user = {}, password = "", invite = "" } = await readJson(req);
    const invCfg = json("kii_invite", {});
    if (invCfg.code && String(invite).trim() !== String(invCfg.code).trim())
      return send(res, 403, { error: "Invalid invite code. Please ask KII staff for the correct code." });
    const email = lc(user.email);
    if (!EMAIL_RE.test(email)) return send(res, 400, { error: "Please enter a valid email address." });
    if (String(password).length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return send(res, 400, { error: "Password must be at least 8 characters and include letters and numbers." });
    if (!user.firstName || !user.secondName || !user.thirdName || !user.privacyConsentAt) return send(res, 400, { error: "Please complete all required fields." });
    const users = json("kii_users", []);
    if (users.some(u => lc(u.email) === email)) return send(res, 409, { error: "An account with this email already exists. Please sign in." });
    const allowed = ["firstName", "secondName", "thirdName", "dob", "passport", "country", "city", "town", "phone", "organization", "website", "privacyConsentAt"];
    const rec = Object.fromEntries(allowed.map(k => [k, String(user[k] ?? "").slice(0, 300)]));
    users.push({ ...rec, email, ...makePassword(password), createdAt: now() });
    store("kii_users", users, "applicant:" + email);
    startSession(res, "applicant", email);
    return send(res, 200, { ok: true });
  }
  if (route === "POST /api/login") {
    const { email = "", password = "" } = await readJson(req), id = "a:" + lc(email);
    const mins = lockedMinutes(id);
    if (mins) return send(res, 429, { error: `Too many failed attempts. Please try again in ${mins} minute(s).` });
    const users = json("kii_users", []), u = users.find(x => lc(x.email) === lc(email));
    if (!u || !checkPassword(u, password)) { recordFail(id); return send(res, 401, { error: "Invalid email or password." }); }
    q.lockDel.run(id);
    if (!u.passHash) { Object.assign(u, makePassword(password)); delete u.password; store("kii_users", users, "server"); }
    startSession(res, "applicant", lc(u.email));
    return send(res, 200, { ok: true });
  }
  if (route === "POST /api/staff-login") {
    const { email = "", password = "" } = await readJson(req), id = "s:" + lc(email);
    const mins = lockedMinutes(id);
    if (mins) return send(res, 429, { error: `Too many failed attempts. Please try again in ${mins} minute(s).` });
    const staff = json("kii_staff", []), s = staff.find(x => lc(x.email) === lc(email));
    if (!s || !checkPassword(s, password)) { recordFail(id); return send(res, 401, { error: "Invalid staff email or password." }); }
    if (!s.active) return send(res, 403, { error: "Your account has been restricted. Please contact the Administration Manager." });
    q.lockDel.run(id);
    if (!s.passHash) { Object.assign(s, makePassword(password)); delete s.password; }
    s.lastLogin = now(); store("kii_staff", staff, "server");
    store("kii_ams_audit", [{ date: now(), by: s.name, action: "Signed in", detail: s.email + (isLocal(req) ? "" : " from " + req.socket.remoteAddress) }, ...json("kii_ams_audit", [])].slice(0, CAPS.kii_ams_audit), "server");
    startSession(res, "staff", s.id);
    return send(res, 200, { ok: true, mustChangePassword: !!s.mustChangePassword });
  }
  if (route === "POST /api/logout") {
    const { kind } = await readJson(req);
    for (const k of kind === "staff" || kind === "applicant" ? [kind] : ["applicant", "staff"]) endSession(req, res, k);
    return send(res, 200, { ok: true });
  }
  if (route === "POST /api/code") {
    if (!ctx.applicant && !ctx.staff) return send(res, 401, { error: "Please sign in." });
    const { area } = await readJson(req);
    return send(res, 200, { ok: true, code: nextCode(area) });
  }
  if (route === "POST /api/import") {
    if (!isLocal(req) || q.count.get().n !== 0) return send(res, 403, { error: "Import is only allowed into an empty server from this computer." });
    const { data = {} } = await readJson(req);
    let n = 0;
    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith("kii_") || CLIENT_ONLY.has(key) || SERVER_ONLY.has(key) || typeof value !== "string") continue;
      if (key === "kii_staff") { // keep the server's admin, add the browser's other staff
        const cur = json("kii_staff", []), incoming = (() => { try { return JSON.parse(value); } catch { return []; } })();
        for (const s of incoming) { const i = cur.findIndex(x => lc(x.email) === lc(s.email)); if (i >= 0) cur[i] = s; else cur.push(s); }
        store(key, cur, "import"); n++; continue;
      }
      store(key, value, "import"); n++;
    }
    console.log(`  Imported ${n} records from a browser on this computer.`);
    return send(res, 200, { ok: true, imported: n });
  }
  if (url.pathname === "/api/files") {
    const id = url.searchParams.get("id") || "";
    if (!id || id.length > 500) return send(res, 400, { error: "Missing file id." });
    const rec = q.fileGet.get(id);
    if (req.method === "GET") {
      if (!rec || !canReadFile(ctx, rec)) return send(res, 404, { error: "File not found." });
      const file = path.join(FILES, rec.disk);
      if (!fs.existsSync(file)) return send(res, 404, { error: "File not found." });
      res.writeHead(200, { "Content-Type": rec.type || "application/octet-stream", "Content-Length": fs.statSync(file).size,
        "X-File-Name": encodeURIComponent(rec.name || "file"), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        "Content-Disposition": "inline; filename*=UTF-8''" + encodeURIComponent(rec.name || "file") });
      return fs.createReadStream(file).pipe(res);
    }
    if (req.method === "PUT") {
      const importing = !ctx.staff && !ctx.applicant && isLocal(req) && !rec && referencedBy(Object.fromEntries(q.all.all().map(r => [r.key, r.value])), id);
      if (!ctx.staff && !ctx.applicant && !importing) return send(res, 401, { error: "Please sign in." });
      if (rec && !ctx.staff && rec.owner !== ctx.applicant) return send(res, 403, { error: "Not allowed." });
      const body = await readBody(req, 250 * 1024 * 1024), disk = diskName(id);
      fs.writeFileSync(path.join(FILES, disk), body);
      const owner = ctx.applicant || (ctx.staff ? "staff:" + ctx.staff.id : (id.includes("@") ? lc(id.split("/")[0]) : "import"));
      q.filePut.run(id, owner, decodeURIComponent(String(req.headers["x-file-name"] || "file")).slice(0, 255),
        String(req.headers["content-type"] || "application/octet-stream").slice(0, 120), body.length, disk, now());
      return send(res, 200, { ok: true });
    }
    if (req.method === "DELETE") {
      if (!rec) return send(res, 200, { ok: true });
      if (!ctx.staff && rec.owner !== ctx.applicant) return send(res, 403, { error: "Not allowed." });
      q.fileDel.run(id); fs.rmSync(path.join(FILES, rec.disk), { force: true });
      return send(res, 200, { ok: true });
    }
  }
  return send(res, 404, { error: "Unknown endpoint." });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || BLOCKED.test(rel.replace(/\\/g, "/")) || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  const ext = path.extname(file).toLowerCase();
  /* HTML pages carry the viewer's state inside <head> so the page never needs a blocking request at startup */
  if (ext === ".html") {
    const injected = JSON.stringify(statePayload(context(req), req)).replace(/</g, "\\u003c");
    const html = fs.readFileSync(file, "utf8")
      .replace(/<head([^>]*)>/i, `<head$1>\n<script>window.__KII_STATE__=${injected};</script>`);
    res.writeHead(200, { "Content-Type": MIME[".html"], "Content-Length": Buffer.byteLength(html), "Cache-Control": "no-cache" });
    return res.end(html);
  }
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Content-Length": fs.statSync(file).size,
    "Cache-Control": [".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff2"].includes(ext) ? "public, max-age=3600" : "no-cache" });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  try {
    const url = new URL(req.url, "http://local");
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "Method not allowed." });
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : "Server error." });
  }
});
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    const lan = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).map(i => i.address);
    console.log(`\n  KII server running. Data folder: ${DATA}`);
    console.log(`  On this computer:  http://localhost:${PORT}/index.html   (staff: http://localhost:${PORT}/admin-login.html)`);
    lan.forEach(ip => console.log(`  On your network:   http://${ip}:${PORT}/index.html`));
    console.log("  Press Ctrl+C to stop.\n");
  });
}
module.exports = { server, db };
