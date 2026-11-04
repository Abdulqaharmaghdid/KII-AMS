/* ===== Shared helpers: storage, session, countries ===== */

const KII = {
  USERS_KEY: "kii_users",
  SESSION_KEY: "kii_session",

  /* ----- presentation and calendar helpers shared by both portals ----- */
  escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },
  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },
  validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
      Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  },

  /* ----- users ----- */
  getUsers() {
    try { return JSON.parse(localStorage.getItem(this.USERS_KEY)) || []; }
    catch { return []; }
  },
  saveUsers(users) {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  },
  findUser(email) {
    return this.getUsers().find(u => u.email.toLowerCase() === String(email).toLowerCase());
  },
  addUser(user) {
    const users = this.getUsers();
    users.push(user);
    this.saveUsers(users);
  },
  updateUser(email, patch) {
    const users = this.getUsers();
    const u = users.find(x => x.email.toLowerCase() === String(email).toLowerCase());
    if (u) { Object.assign(u, patch); this.saveUsers(users); }
    return u;
  },

  /* ----- session ----- */
  login(email) { localStorage.setItem(this.SESSION_KEY, email); },
  logout() { localStorage.removeItem(this.SESSION_KEY); },
  currentEmail() { return localStorage.getItem(this.SESSION_KEY); },
  currentUser() {
    const e = this.currentEmail();
    return e ? this.findUser(e) : null;
  },
  requireAuth(redirect = "login.html") {
    const u = this.currentUser();
    if (!u) { window.location.href = redirect; return null; }
    return u;
  },

  /* ----- per-user application data ----- */
  selectedApplication(email) { return localStorage.getItem("kii_selected_" + email.toLowerCase()) || "legacy"; },
  formCustom() { try { return JSON.parse(localStorage.getItem("kii_form_custom")) || { custom: [], hidden: [] }; } catch { return { custom: [], hidden: [] }; } },
  saveFormCustom(cfg) { localStorage.setItem("kii_form_custom", JSON.stringify(cfg)); },
  formSchemaInfo() { try { return JSON.parse(localStorage.getItem("kii_form_schema")) || null; } catch { return null; } },
  areaPrefixes: { "Human Being": "HUM", "Smart Cities": "SMC", "House Ware": "HSW", "Sustainable Energy": "SER",
    "Health": "HLT", "Education": "EDU", "Transportation": "TRN", "IT": "ITC", "Fashion": "FSH", "Automation": "AUT",
    "Technology": "TEC", "Agriculture": "AGR", "Other": "OTH" },
  async nextApplicantCode(area) {
    if (window.KIIServer?.enabled) { // unique across all applicants
      const r = await KIIServer.post("/api/code", { area });
      if (r.ok && r.json.code) return r.json.code;
    }
    const prefix = this.areaPrefixes[area] || "APP";
    let max = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("kii_app_")) continue;
      try {
        const m = (JSON.parse(localStorage.getItem(k))?.applicantCode || "").match(new RegExp("^" + prefix + "(\\d+)$"));
        if (m) max = Math.max(max, +m[1]);
      } catch { }
    }
    return prefix + String(max + 1).padStart(3, "0");
  },
  selectApplication(email, id) { localStorage.setItem("kii_selected_" + email.toLowerCase(), id || "legacy"); },
  appKey(email, id = this.selectedApplication(email)) {
    return "kii_app_" + String(email).toLowerCase() + (id && id !== "legacy" ? "::" + id : "");
  },
  getApplications(email) {
    const prefix = "kii_app_" + email.toLowerCase();
    return Object.keys(localStorage).filter(k => k === prefix || k.startsWith(prefix + "::"))
      .map(k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } })
      .filter(Boolean);
  },
  portalId(email, app) { return "portal:" + email.toLowerCase() + (app?.id ? "::" + app.id : ""); },
  getApplication(email, id = this.selectedApplication(email)) {
    try { return JSON.parse(localStorage.getItem(this.appKey(email, id))) || null; }
    catch { return null; }
  },
  saveApplication(email, data) {
    try {
      localStorage.setItem(this.appKey(email, data.id || "legacy"), JSON.stringify({ ...data, ownerEmail: email.toLowerCase() }));
      return true;
    } catch (e) {
      console.error("Failed to save application:", e);
      alert("Could not save your application progress (storage full). Your last changes may be lost.");
      return false;
    }
  },
  deleteApplication(email, id = this.selectedApplication(email)) {
    const app = this.getApplication(email, id);
    if (app?.submitted || app?.status === "Withdrawn") return;
    localStorage.removeItem(this.appKey(email, id));
    // Delete only this application's referenced uploads, never another idea's files.
    const ids = new Set();
    (function walk(value) {
      if (!value || typeof value !== "object") return;
      if (value.fileId) ids.add(value.fileId);
      Object.values(value).forEach(walk);
    })(app?.data);
    ids.forEach(fid => this.deleteFile(fid).catch(error => console.error("Could not remove unused upload:", error)));
    const remaining = this.getApplications(email);
    this.selectApplication(email, remaining[0]?.id || "legacy");
  },
  async deleteFile(id) {
    if (window.KIIServer?.enabled) await fetch("/api/files?id=" + encodeURIComponent(id), { method: "DELETE", headers: { "X-KII": "1" } }).catch(() => {});
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  },

  /* ----- file store (IndexedDB — too big for localStorage) ----- */
  _dbPromise: null,
  openDb() {
    if (!this._dbPromise) {
      this._dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open("kii_db", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("files");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this._dbPromise;
  },
  async saveFile(id, file) {
    if (window.KIIServer?.enabled) {
      try {
        const r = await fetch("/api/files?id=" + encodeURIComponent(id), { method: "PUT", body: file,
          headers: { "X-KII": "1", "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name || "file") } });
        return r.ok;
      } catch (e) { console.error("Upload to server failed:", e); return false; }
    }
    try {
      const db = await this.openDb();
      await new Promise((res, rej) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(file, id);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      return true;
    } catch (e) {
      console.error("IndexedDB save failed:", e);
      return false;
    }
  },
  async getFile(id) {
    if (window.KIIServer?.enabled) {
      try {
        const r = await fetch("/api/files?id=" + encodeURIComponent(id), { headers: { "X-KII": "1" } });
        if (r.ok) {
          const blob = await r.blob();
          return new File([blob], decodeURIComponent(r.headers.get("X-File-Name") || "file"), { type: blob.type });
        }
      } catch { }
    }
    try {
      const db = await this.openDb();
      return await new Promise((res, rej) => {
        const req = db.transaction("files").objectStore("files").get(id);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => rej(req.error);
      });
    } catch { return null; }
  },
  /* ----- password hashing (salted SHA-256; never store plain passwords) ----- */
  sha256(str) {
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const bytes = new TextEncoder().encode(str);
    const len = bytes.length, bitLen = len * 8;
    const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
    padded.set(bytes); padded[len] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, bitLen >>> 0);
    dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
    const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const W = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i-15], 7) ^ rotr(W[i-15], 18) ^ (W[i-15] >>> 3);
        const s1 = rotr(W[i-2], 17) ^ rotr(W[i-2], 19) ^ (W[i-2] >>> 10);
        W[i] = (W[i-16] + s0 + W[i-7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, h].forEach((x, i) => H[i] = (H[i] + x) >>> 0);
    }
    return H.map(x => x.toString(16).padStart(8, "0")).join("");
  },
  makePassword(plain) {
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join("");
    let h = salt + ":" + plain;
    for (let i = 0; i < 1000; i++) h = this.sha256(h); // key stretching
    return { salt, hash: h };
  },
  checkPassword(record, plain) {
    if (!record) return false;
    if (record.passHash && record.passSalt) {
      let h = record.passSalt + ":" + plain;
      for (let i = 0; i < 1000; i++) h = this.sha256(h);
      return h === record.passHash;
    }
    return record.password === plain; // legacy plain-text record (migrated on next login)
  },

  /* ----- brute-force protection: lock after 5 failed attempts for 5 minutes ----- */
  LOCK_KEY: "kii_login_locks",
  isLocked(id) {
    const l = JSON.parse(localStorage.getItem(this.LOCK_KEY) || "{}")[String(id).toLowerCase()];
    return l && l.until > Date.now() ? Math.ceil((l.until - Date.now()) / 60000) : 0;
  },
  recordFail(id) {
    const all = JSON.parse(localStorage.getItem(this.LOCK_KEY) || "{}");
    const k = String(id).toLowerCase();
    const l = all[k] && (!all[k].until || all[k].until > Date.now()) ? all[k] : { n: 0, until: 0 };
    l.n = (l.n || 0) + 1;
    if (l.n >= 5) { l.until = Date.now() + 5 * 60000; l.n = 0; }
    all[k] = l;
    localStorage.setItem(this.LOCK_KEY, JSON.stringify(all));
  },
  clearFails(id) {
    const all = JSON.parse(localStorage.getItem(this.LOCK_KEY) || "{}");
    delete all[String(id).toLowerCase()];
    localStorage.setItem(this.LOCK_KEY, JSON.stringify(all));
  },

  /* program call settings are configured by staff in the AMS (Settings → Program Call) */
  programSettings() {
    try { return JSON.parse(localStorage.getItem("kii_ams_settings")) || {}; } catch { return {}; }
  },
  deadlinePassed() {
    const d = this.programSettings().deadline;
    return !!d && Date.now() > new Date(d + "T23:59:59").getTime();
  },

  /* Number of steps in the form that produced an application (legacy 14, version 2 nine, version 3 ten). */
  applicationSteps(app) { return !app?.schemaVersion ? 14 : app.schemaVersion === 2 ? 9 : 10; },

  /* Sector catalogue shown in the application form; the Master Admin edits it in Team & Roles.
     "Other" is always offered last so applicants are never blocked. */
  DEFAULT_SECTORS: [
    { name: "Health", subSectors: ["Medical devices", "Digital health", "Diagnostics", "Biotechnology", "Public health"] },
    { name: "Automation", subSectors: ["Robotics", "Industrial automation", "Smart manufacturing", "Control systems"] },
    { name: "Technology", subSectors: ["Software", "Artificial intelligence", "Cybersecurity", "Electronics", "Telecommunications"] },
    { name: "Agriculture", subSectors: ["Smart agriculture", "Irrigation", "Food technology", "Livestock", "Agricultural machinery"] },
    { name: "Sustainable Energy", subSectors: ["Solar energy", "Wind energy", "Energy storage", "Energy efficiency", "Clean fuels"] },
  ],
  sectorCatalogue() {
    const saved = this.programSettings().sectors;
    const list = Array.isArray(saved) && saved.length ? saved : this.DEFAULT_SECTORS;
    return list.filter(s => s && s.name && s.name !== "Other")
      .map(s => ({ name: String(s.name).trim(), subSectors: [...new Set((s.subSectors || []).map(x => String(x).trim()).filter(Boolean))] }));
  },
  sectorNames() { return [...this.sectorCatalogue().map(s => s.name), "Other"]; },
  subSectorNames(sector) {
    const found = this.sectorCatalogue().find(s => s.name === sector);
    return sector && sector !== "Other" && found ? [...found.subSectors, "Other"] : sector === "Other" ? ["Other"] : [];
  },

  reviewSeason() {
    // Seasons: Spring (Jan-Mar), Summer (Apr-Jun), Fall (Jul-Sep), Winter (Oct-Dec)
    const m = new Date().getMonth();
    const year = new Date().getFullYear();
    if (m <= 2) return "Spring " + year + " Review";
    if (m <= 5) return "Summer " + year + " Review";
    if (m <= 8) return "Fall " + year + " Review";
    return "Winter " + year + " Review";
  },

  fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  },
};

/* ----- Countries (for searchable datalists / selects) ----- */
const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia",
  "Austria","Azerbaijan","Bahrain","Bangladesh","Belarus","Belgium","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","Bulgaria","Burkina Faso","Burundi",
  "Cambodia","Cameroon","Canada","Chad","Chile","China","Colombia","Comoros","Congo",
  "Costa Rica","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti",
  "Dominican Republic","Ecuador","Egypt","El Salvador","Eritrea","Estonia","Eswatini",
  "Ethiopia","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece",
  "Guatemala","Guinea","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq",
  "Ireland","Israel","Italy","Ivory Coast","Jamaica","Japan","Jordan","Kazakhstan",
  "Kenya","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya",
  "Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta",
  "Mauritania","Mauritius","Mexico","Moldova","Mongolia","Montenegro","Morocco",
  "Mozambique","Myanmar","Namibia","Nepal","Netherlands","New Zealand","Nicaragua",
  "Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan",
  "Palestine","Panama","Peru","Philippines","Poland","Portugal","Qatar","Romania",
  "Russia","Rwanda","Saudi Arabia","Senegal","Serbia","Sierra Leone","Singapore",
  "Slovakia","Slovenia","Somalia","South Africa","South Korea","South Sudan","Spain",
  "Sri Lanka","Sudan","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania",
  "Thailand","Togo","Tunisia","Turkey","Turkmenistan","Uganda","Ukraine",
  "United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan",
  "Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

const COUNTRY_CODES = [
  "+93 (AF)","+355 (AL)","+213 (DZ)","+54 (AR)","+61 (AU)","+43 (AT)","+973 (BH)",
  "+880 (BD)","+32 (BE)","+55 (BR)","+359 (BG)","+237 (CM)","+1 (CA/US)","+86 (CN)",
  "+57 (CO)","+385 (HR)","+45 (DK)","+20 (EG)","+251 (ET)","+358 (FI)","+33 (FR)",
  "+49 (DE)","+233 (GH)","+30 (GR)","+36 (HU)","+91 (IN)","+62 (ID)","+98 (IR)",
  "+964 (IQ)","+353 (IE)","+972 (IL)","+39 (IT)","+81 (JP)","+962 (JO)","+7 (KZ/RU)",
  "+254 (KE)","+965 (KW)","+961 (LB)","+218 (LY)","+60 (MY)","+52 (MX)","+212 (MA)",
  "+31 (NL)","+64 (NZ)","+234 (NG)","+47 (NO)","+968 (OM)","+92 (PK)","+970 (PS)",
  "+51 (PE)","+63 (PH)","+48 (PL)","+351 (PT)","+974 (QA)","+40 (RO)","+250 (RW)",
  "+966 (SA)","+221 (SN)","+65 (SG)","+252 (SO)","+27 (ZA)","+82 (KR)","+34 (ES)",
  "+94 (LK)","+249 (SD)","+46 (SE)","+41 (CH)","+963 (SY)","+255 (TZ)","+66 (TH)",
  "+216 (TN)","+90 (TR)","+256 (UG)","+380 (UA)","+971 (AE)","+44 (UK)","+84 (VN)",
  "+967 (YE)","+260 (ZM)","+263 (ZW)","+ Other"
];

/* Populate a <datalist> or <select> with countries */
function fillCountries(el) {
  if (!el) return;
  if (el.tagName === "DATALIST") {
    el.innerHTML = COUNTRIES.map(c => `<option value="${c}">`).join("");
  } else {
    el.innerHTML = `<option value="">Select country…</option>` +
      COUNTRIES.map(c => `<option value="${c}">${c}</option>`).join("");
  }
}
function fillCountryCodes(el) {
  if (!el) return;
  el.innerHTML = `<option value="">Code</option>` +
    COUNTRY_CODES.map(c => `<option value="${c}">${c}</option>`).join("");
}

/* ===== soft page transitions =====
   Fades the page in when it is ready and out briefly before navigating to
   another page on this site. External links, new tabs, downloads, in-page
   anchors and modified clicks are left alone. */
(function () {
  if (typeof document === "undefined" || !document.documentElement) return;
  const root = document.documentElement;
  root.classList.add("kii-fade");
  const show = () => root.classList.add("kii-in");
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show);
  else show();
  window.addEventListener("pageshow", () => { root.classList.remove("kii-out"); show(); });
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = (a.getAttribute("href") || "").trim();
    if (a.target === "_blank" || a.hasAttribute("download") || !href || href.startsWith("#") ||
        /^(javascript|mailto|tel):/i.test(href)) return;
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return;
    /* pages with their own in-page router (the staff portal) handle same-page links themselves */
    if (document.body?.hasAttribute("data-spa") && url.pathname === location.pathname) return;
    e.preventDefault();
    root.classList.add("kii-out");
    setTimeout(() => { location.href = url.href; }, 130);
  });
})();

/* ===== password visibility toggle =====
   Adds an eye button to every password field so users can check what they typed. */
(function () {
  if (typeof document === "undefined" || !document.documentElement) return;
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const enhance = () => {
    document.querySelectorAll('input[type="password"]').forEach(inp => {
      if (inp.dataset.pwToggle) return;
      inp.dataset.pwToggle = "1";
      const wrap = document.createElement("span");
      wrap.className = "pw-wrap";
      inp.parentNode.insertBefore(wrap, inp);
      wrap.appendChild(inp);
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "pw-eye"; btn.tabIndex = -1;
      btn.setAttribute("aria-label", "Show or hide password"); btn.innerHTML = EYE;
      btn.addEventListener("click", () => {
        const show = inp.type === "password";
        inp.type = show ? "text" : "password";
        btn.classList.toggle("on", show);
        btn.innerHTML = show ? EYE_OFF : EYE;
        inp.focus();
      });
      wrap.appendChild(btn);
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhance);
  else enhance();
})();


/* ===== calendar date picker (dd-mm-yyyy) =====
   Professional calendar popup shared by the signup page, the application form and
   staff screens. The visible input shows dd-mm-yyyy; the ISO value (yyyy-mm-dd) is
   kept in input.dataset.iso — or in a hidden twin for native <input type="date">,
   so named fields keep posting ISO values. */
(function () {
  if (typeof document === "undefined" || typeof window === "undefined" || typeof document.addEventListener !== "function") return;
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var toDisplay = function (iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? m[3] + "-" + m[2] + "-" + m[1] : ""; };
  var parseText = function (text) {
    var m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text.trim());
    if (m) return m[3] + "-" + pad(+m[2]) + "-" + pad(+m[1]);
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text.trim());
    return m ? m[1] + "-" + pad(+m[2]) + "-" + pad(+m[3]) : "";
  };
  var validIso = function (iso) { var d = new Date(iso + "T00:00:00"); return !isNaN(d) && iso === d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var todayIso = function () { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var openDp = null;

  function attach(input, opts) {
    opts = opts || {};
    if (!input || input._dp) return input && input._dp;
    /* native <input type="date">: swap to text and keep a hidden ISO twin so
       form submissions and name/id lookups still read yyyy-mm-dd */
    var isoEl = input;
    if (input.type === "date") {
      var hidden = document.createElement("input");
      hidden.type = "hidden"; hidden.name = input.name || ""; hidden.id = input.id || ""; hidden.value = input.value;
      ["min", "max"].forEach(function (a) { if (input.getAttribute(a) && opts[a] == null) opts[a] = input.getAttribute(a); });
      input.removeAttribute("name"); input.removeAttribute("id");
      input.after(hidden); input.type = "text"; input.removeAttribute("min"); input.removeAttribute("max");
      isoEl = hidden;
    }
    var getIso = function () { return isoEl === input ? (input.dataset.iso || "") : isoEl.value; };
    var setIso = function (iso) { if (isoEl === input) input.dataset.iso = iso; else isoEl.value = iso; };
    var min = opts.min || "1900-01-01", max = opts.max || (new Date().getFullYear() + 10) + "-12-31";
    var yearA = +min.slice(0, 4), yearB = +max.slice(0, 4);
    input.placeholder = input.placeholder || "dd-mm-yyyy";
    input.autocomplete = "off"; input.inputMode = "numeric";
    input.classList.add("kii-date");

    var view = null, activeCol = null;
    var dp = document.createElement("div");
    dp.className = "kii-dp"; dp.hidden = true;
    /* clickable Day / Month / Year headers — each opens a scrollable list you can
       scroll through, click, or type in to jump to a match */
    dp.innerHTML = '<div class="kii-dp-head">' +
      '<button type="button" class="kii-dp-nav dp-prev" aria-label="Previous month">&#8249;</button>' +
      '<button type="button" class="kii-dp-col" data-col="day"><small>Day</small><b class="dp-day-label"></b></button>' +
      '<button type="button" class="kii-dp-col" data-col="month"><small>Month</small><b class="dp-month-label"></b></button>' +
      '<button type="button" class="kii-dp-col" data-col="year"><small>Year</small><b class="dp-year-label"></b></button>' +
      '<button type="button" class="kii-dp-nav dp-next" aria-label="Next month">&#8250;</button></div>' +
      '<div class="kii-dp-cal">' +
      '<div class="kii-dp-week">' + ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(function (d) { return '<span>' + d + '</span>'; }).join("") + '</div>' +
      '<div class="kii-dp-grid" role="grid"></div>' +
      '<div class="kii-dp-scroll" hidden><div class="kii-dp-scroll-list" tabindex="0"></div><div class="kii-dp-scroll-hint">Scroll or type to find</div></div></div>' +
      '<div class="kii-dp-foot"><button type="button" data-today>Today</button><button type="button" data-clear>Clear</button></div>';
    document.body.appendChild(dp);
    var grid = dp.querySelector(".kii-dp-grid"), scrollBox = dp.querySelector(".kii-dp-scroll"),
      scrollList = dp.querySelector(".kii-dp-scroll-list"),
      dayLbl = dp.querySelector(".dp-day-label"), monthLbl = dp.querySelector(".dp-month-label"), yearLbl = dp.querySelector(".dp-year-label");

    function render() {
      var sel = getIso();
      dayLbl.textContent = sel ? +sel.slice(8, 10) : "–";
      monthLbl.textContent = MONTHS[view.m].slice(0, 3);
      yearLbl.textContent = view.y;
      var first = new Date(view.y, view.m, 1), today = todayIso(), cells = [];
      for (var i = 0; i < first.getDay(); i++) cells.push('<button type="button" class="kii-dp-day empty" disabled></button>');
      var days = new Date(view.y, view.m + 1, 0).getDate();
      for (var d = 1; d <= days; d++) {
        var iso = view.y + "-" + pad(view.m + 1) + "-" + pad(d);
        var off = iso < min || iso > max;
        cells.push('<button type="button" class="kii-dp-day' + (iso === sel ? " sel" : "") + (iso === today ? " today" : "") + '" data-iso="' + iso + '"' + (off ? " disabled" : "") + '>' + d + '</button>');
      }
      grid.innerHTML = cells.join("");
    }
    /* scrollable column lists: year / month / day — click to pick, type to jump */
    function colItems(col) {
      if (col === "year") return Array.from({ length: yearB - yearA + 1 }, function (_, i) { return { v: yearA + i, label: String(yearA + i) }; });
      if (col === "month") return MONTHS.map(function (m, i) { return { v: i, label: m }; });
      var days = new Date(view.y, view.m + 1, 0).getDate();
      return Array.from({ length: days }, function (_, i) { return { v: i + 1, label: String(i + 1) }; });
    }
    function openCol(col) {
      if (activeCol === col && !scrollBox.hidden) { scrollBox.hidden = true; activeCol = null; dp.querySelectorAll(".kii-dp-col").forEach(function (b) { b.classList.remove("on"); }); return; }
      activeCol = col; scrollBox.hidden = false;
      dp.querySelectorAll(".kii-dp-col").forEach(function (b) { b.classList.toggle("on", b.dataset.col === col); });
      var sel = getIso();
      var current = col === "year" ? view.y : col === "month" ? view.m : (sel ? +sel.slice(8, 10) : null);
      scrollList.innerHTML = colItems(col).map(function (it) {
        var iso = col === "year" ? it.v + "-" + pad(view.m + 1) + "-01"
          : col === "month" ? view.y + "-" + pad(it.v + 1) + "-01"
          : view.y + "-" + pad(view.m + 1) + "-" + pad(it.v);
        var off = col === "day" && (iso < min || iso > max);
        return '<button type="button" class="kii-dp-item' + (it.v === current ? " sel" : "") + '" data-v="' + it.v + '"' + (off ? " disabled" : "") + '>' + it.label + '</button>';
      }).join("");
      var selItem = scrollList.querySelector(".sel");
      if (selItem) scrollList.scrollTop = selItem.offsetTop - scrollList.clientHeight / 2 + selItem.offsetHeight / 2;
      scrollList.focus();
    }
    var jumpBuf = "", jumpTimer = null;
    scrollList.addEventListener("keydown", function (e) {
      if (!/^[a-z0-9]$/i.test(e.key)) return;
      jumpBuf += e.key.toLowerCase();
      clearTimeout(jumpTimer); jumpTimer = setTimeout(function () { jumpBuf = ""; }, 700);
      var hit = Array.from(scrollList.children).find(function (b) { return b.textContent.toLowerCase().indexOf(jumpBuf) === 0; });
      if (hit) { scrollList.scrollTop = hit.offsetTop - scrollList.clientHeight / 2 + hit.offsetHeight / 2; hit.classList.add("jump"); setTimeout(function () { hit.classList.remove("jump"); }, 700); }
    });
    scrollList.addEventListener("click", function (e) {
      var it = e.target.closest(".kii-dp-item");
      if (!it || it.disabled) return;
      var v = +it.dataset.v;
      if (activeCol === "year") { view.y = v; render(); openCol("month"); return; }
      if (activeCol === "month") { view.m = v; render(); openCol("day"); return; }
      var iso = view.y + "-" + pad(view.m + 1) + "-" + pad(v);
      commit(iso); close();
    });
    dp.querySelectorAll(".kii-dp-col").forEach(function (b) {
      b.addEventListener("click", function () { openCol(b.dataset.col); });
    });
    function position() {
      var r = input.getBoundingClientRect();
      dp.style.top = Math.min(r.bottom + 6, innerHeight - 340) + "px";
      dp.style.left = Math.max(8, Math.min(r.left, innerWidth - 300)) + "px";
    }
    function open() {
      if (openDp && openDp !== close) openDp();
      var iso = getIso(), now = new Date();
      view = validIso(iso) ? { y: +iso.slice(0, 4), m: +iso.slice(5, 7) - 1 } : { y: now.getFullYear(), m: now.getMonth() };
      scrollBox.hidden = true; activeCol = null;
      render(); position(); dp.hidden = false; openDp = close;
      setTimeout(function () { document.addEventListener("pointerdown", outside, true); }, 0);
    }
    function close() { dp.hidden = true; scrollBox.hidden = true; activeCol = null;
      dp.querySelectorAll(".kii-dp-col").forEach(function (b) { b.classList.remove("on"); });
      openDp = null; document.removeEventListener("pointerdown", outside, true); }
    var outside = function (e) { if (!dp.contains(e.target) && e.target !== input) close(); };
    function commit(iso) {
      setIso(iso); input.value = toDisplay(iso);
      input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function refresh() { input.value = toDisplay(getIso()); }

    input.addEventListener("focus", open);
    input.addEventListener("click", function () { if (dp.hidden) open(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !dp.hidden) { close(); e.stopPropagation(); }
      if (e.key === "ArrowDown" && dp.hidden) open();
    });
    input.addEventListener("blur", function () {
      var text = input.value.trim();
      if (!text) return;
      var iso = parseText(text);
      if (iso && validIso(iso) && iso >= min && iso <= max) setIso(iso);
      refresh();
    });
    dp.addEventListener("pointerdown", function (e) { e.preventDefault(); });
    dp.addEventListener("click", function (e) {
      var day = e.target.closest(".kii-dp-day[data-iso]");
      if (day && !day.disabled) { commit(day.dataset.iso); close(); return; }
      if (e.target.closest("[data-today]")) { var t = todayIso(); if (t >= min && t <= max) { commit(t); } close(); return; }
      if (e.target.closest("[data-clear]")) {
        setIso(""); input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
        close();
      }
    });
    dp.querySelector(".dp-prev").addEventListener("click", function () { view.m--; if (view.m < 0) { view.m = 11; view.y--; } render(); });
    dp.querySelector(".dp-next").addEventListener("click", function () { view.m++; if (view.m > 11) { view.m = 0; view.y++; } render(); });
    window.addEventListener("resize", close);
    window.addEventListener("scroll", function (e) { if (!dp.contains(e.target)) close(); }, true);
    refresh();
    input._dp = { open: open, close: close, refresh: refresh, set: function (iso) { if (validIso(iso)) { setIso(iso); refresh(); } } };
    return input._dp;
  }

  window.KIIDatePicker = attach;
  if (window.KII && !KII.datePicker) KII.datePicker = attach;
  /* auto-attach: every native date input and every .kii-date field gets the calendar */
  document.addEventListener("focusin", function (e) {
    var t = e.target;
    if (t instanceof HTMLInputElement && (t.type === "date" || t.classList.contains("kii-date")) && !t._dp) attach(t);
  }, true);

  if (!document.getElementById("kii-dp-css")) {
    var css = document.createElement("style"); css.id = "kii-dp-css";
    css.textContent = ".kii-dp{position:fixed;z-index:4000;width:296px;background:#fff;border:1px solid #d7dde4;border-radius:10px;box-shadow:0 12px 32px rgba(15,40,70,.18);padding:12px;font:14px/1.4 'Segoe UI',Arial,sans-serif;color:#14202b;}"
      + ".kii-dp-head{display:flex;gap:5px;align-items:center;margin-bottom:6px}"
      + ".kii-dp-col{flex:1;min-width:0;height:38px;border:1px solid #d7dde4;border-radius:7px;background:#f8fafc;font:inherit;padding:2px 4px;cursor:pointer;text-align:center;line-height:1.25}"
      + ".kii-dp-col small{display:block;font-size:9.5px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;color:#8a94a0}"
      + ".kii-dp-col b{display:block;font-size:13px;font-weight:500;color:#33404d;margin-top:1px}"
      + ".kii-dp-col:hover,.kii-dp-col.on{background:#e6eef6;border-color:#2563eb}"
      + ".kii-dp-cal{position:relative}"
      + ".kii-dp-scroll{position:absolute;inset:0;z-index:2;border:1px solid #d7dde4;border-radius:8px;background:#fbfcfe;box-shadow:0 6px 18px rgba(15,40,70,.12);display:flex;flex-direction:column}"
      + ".kii-dp-scroll[hidden]{display:none}"
      + ".kii-dp-scroll-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;outline:none}"
      + ".kii-dp-item{border:0;background:transparent;font:inherit;padding:9px 12px;text-align:center;cursor:pointer;color:#14202b;flex:none}"
      + ".kii-dp-item:hover:not(:disabled){background:#dbeafe}"
      + ".kii-dp-item.sel{background:#2563eb;color:#fff;font-weight:700}"
      + ".kii-dp-item.jump{outline:2px solid #2563eb;outline-offset:-2px}"
      + ".kii-dp-item:disabled{color:#b9c2cc;cursor:default}"
      + ".kii-dp-scroll-hint{font-size:10px;color:#8a94a0;text-align:center;padding:3px;border-top:1px solid #e5eaf0;flex:none}"
      + ".kii-dp-nav{width:30px;height:38px;border:1px solid #d7dde4;border-radius:7px;background:#f8fafc;color:#4a5a6d;font-size:16px;line-height:1;cursor:pointer;flex:none}"
      + ".kii-dp-nav:hover{background:#e6eef6}"
      + ".kii-dp-week{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:11px;font-weight:700;color:#6a7684;margin-bottom:4px}"
      + ".kii-dp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}"
      + ".kii-dp-day{height:34px;border:0;border-radius:6px;background:transparent;font:inherit;cursor:pointer;color:#14202b}"
      + ".kii-dp-day:hover:not(:disabled):not(.empty){background:#dbeafe}"
      + ".kii-dp-day.empty{cursor:default}"
      + ".kii-dp-day:disabled:not(.empty){color:#b9c2cc;cursor:default}"
      + ".kii-dp-day.today{outline:1px solid #2563eb;outline-offset:-1px}"
      + ".kii-dp-day.sel{background:#2563eb;color:#fff;font-weight:700}"
      + ".kii-dp-foot{display:flex;justify-content:space-between;margin-top:8px}"
      + ".kii-dp-foot button{border:0;background:transparent;color:#2563eb;font:inherit;font-weight:600;cursor:pointer;padding:2px 4px}"
      + ".kii-dp-foot button:hover{text-decoration:underline}";
    document.head.appendChild(css);
  }
})();
