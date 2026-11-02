/* Multi-user test of the local server: real HTTP, real database, three separate browsers
   (two applicants and one staff member). Run: node tests/server.test.cjs */
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path");
const PORT = 8099, BASE = `http://localhost:${PORT}`;
process.env.KII_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "kii-server-test-"));
const { server, db } = require("../server/server.cjs");
const { chromium } = require("playwright");
const { application } = require("./application.test.cjs");

let checks = 0;
const check = (ok, msg) => { assert.ok(ok, msg); checks++; };
const api = (p, opts = {}) => fetch(BASE + p, { ...opts, headers: { "X-KII": "1", "Content-Type": "application/json", ...(opts.headers || {}) } });

(async () => {
  await new Promise(r => server.listen(PORT, "127.0.0.1", r));
  const browser = await chromium.launch({ channel: process.env.KII_BROWSER_CHANNEL || "chrome", headless: true });
  const errors = [];
  const ctxA = await browser.newContext(), ctxB = await browser.newContext(), ctxS = await browser.newContext();
  const pageOf = async ctx => { const p = await ctx.newPage(); p.on("pageerror", e => errors.push(e.message)); p.on("dialog", d => d.accept()); return p; };
  try {
    /* ---- anonymous visitors see nothing private; static secrets are not served ---- */
    let st = await (await fetch(BASE + "/api/state")).json();
    check(st.enabled && !st.data.kii_staff && !st.data.kii_users, "anonymous state hides staff and users");
    check((await fetch(BASE + "/api/state", { method: "POST", body: "{}" })).status === 403, "writes without the request header are refused");
    for (const p of ["/data/kii.db", "/server/server.cjs", "/package.json", "/.git/config", "/tests/server.test.cjs"])
      check((await fetch(BASE + p)).status === 404, "not served: " + p);

    /* ---- applicant A signs up through the real form ---- */
    const A = await pageOf(ctxA);
    await A.goto(BASE + "/signup.html");
    await A.fill("#firstName", "Aram"); await A.fill("#secondName", "Karim"); await A.fill("#thirdName", "Ali");
    await A.fill("#passport", "A1234567");
    await A.selectOption("#dobYear", "1995"); await A.selectOption("#dobMonth", "4"); await A.selectOption("#dobDay", "12");
    await A.waitForFunction(() => document.querySelector("#country").value === "Iraq");
    await A.selectOption("#province", "Erbil");
    await A.fill("#phone", "7501112233"); await A.fill("#emailLocal", "aram.test");
    await A.fill("#password", "Secret123"); await A.fill("#password2", "Secret123"); await A.check("#privacyConsent");
    await Promise.all([A.waitForURL(/dashboard\.html/), A.click("#signupForm button[type=submit]")]);
    check(await A.evaluate(() => localStorage.getItem("kii_session")) === "aram.test@gmail.com", "applicant A signed in by the server");
    const emailA = "aram.test@gmail.com";

    /* applicant A saves an application with an upload */
    const app = application("idea1"); app.data.personal.email = emailA;
    await A.evaluate(async ({ app, emailA }) => {
      const fid = emailA + "/idea1/merged/cv";
      await KII.saveFile(fid, new File(["hello from A"], "cv.pdf", { type: "application/pdf" }));
      app.data.personal.files = { cv: [{ name: "cv.pdf", type: "application/pdf", size: 12, fileId: fid }] };
      KII.saveApplication(emailA, app); KII.selectApplication(emailA, "idea1");
    }, { app, emailA });
    const codeA = await A.evaluate(() => KII.nextApplicantCode("Education"));

    /* ---- applicant B (separate browser) ---- */
    const B = await pageOf(ctxB);
    const signupB = await ctxB.request.post(BASE + "/api/signup", { headers: { "X-KII": "1" }, data: { password: "Secret456",
      user: { firstName: "Bana", secondName: "Omar", thirdName: "Aziz", email: "bana@test.org", privacyConsentAt: new Date().toISOString() } } });
    check(signupB.ok(), "applicant B signed up via API");
    check((await ctxB.request.post(BASE + "/api/signup", { headers: { "X-KII": "1" }, data: { password: "Secret456",
      user: { firstName: "X", secondName: "Y", thirdName: "Z", email: "BANA@test.org", privacyConsentAt: "x" } } })).status() === 409, "duplicate email refused");
    await B.goto(BASE + "/dashboard.html");
    const viewB = await B.evaluate(() => Object.keys(localStorage));
    check(!viewB.some(k => k.includes("aram.test")), "B cannot see A's application");
    check(await B.evaluate(() => KII.getUsers().length) === 1, "B sees only their own account");
    check(await B.evaluate(() => KII.getUsers().every(u => !u.passHash)), "password hashes never reach the browser");
    const codeB = await B.evaluate(() => KII.nextApplicantCode("Education"));
    check(codeA === "EDU001" && codeB === "EDU002", `application codes unique across applicants (${codeA}, ${codeB})`);
    check((await B.evaluate(() => fetch("/api/files?id=" + encodeURIComponent("aram.test@gmail.com/idea1/merged/cv")).then(r => r.status))) === 404, "B cannot download A's file");
    const rej = await B.evaluate(() => fetch("/api/state", { method: "POST", headers: { "X-KII": "1", "Content-Type": "application/json" }, body: JSON.stringify({ ops: [
      { key: "kii_app_aram.test@gmail.com::idea1", op: "set", value: "{}" },
      { key: "kii_ams_settings", op: "set", value: "{\"deadline\":\"2000-01-01\"}" },
      { key: "kii_form_custom", op: "set", value: "{\"custom\":[]}" },
      { key: "kii_staff", op: "items", upsert: [{ id: "st_evil", email: "evil@x.org", role: "master_admin", active: true, perms: ["manage_staff"] }] }] }) }).then(r => r.json()));
    check(rej.rejected.length === 4, "B's attempts to change A's data, settings, form or staff are rejected");

    /* ---- staff signs in through the real staff page ---- */
    const S = await pageOf(ctxS);
    await S.goto(BASE + "/admin-login.html");
    await S.fill("#staffEmail", "admin@kii.org"); await S.fill("#staffPassword", "admin123");
    await Promise.all([S.waitForURL(/admin\.html/), S.click("#staffLoginForm button[type=submit]")]);
    await S.waitForSelector("#amsNav a");
    check(await S.evaluate(() => amsGetApplicants().some(a => a.applicantEmail === "aram.test@gmail.com")), "staff AMS sees A's application from another browser");
    check(await S.evaluate(() => KII.getFile("aram.test@gmail.com/idea1/merged/cv").then(f => f && f.text())) === "hello from A", "staff opens A's uploaded file");

    /* staff changes the form; applicants see it on their next page load */
    await S.evaluate(() => KII.saveFormCustom({ custom: [{ key: "cq_test", section: "innovation", label: "Expected launch year?", type: "text", required: false }], hidden: [], overrides: {} }));
    await B.reload();
    check(await B.evaluate(() => KII.formCustom().custom[0]?.label) === "Expected launch year?", "Form Builder change reaches applicants on other devices");

    /* staff moves A to a new stage; A's dashboard sync must not undo it, and A cannot see evaluations */
    await S.evaluate(() => { const l = amsGetApplicants(); const a = l.find(x => x.applicantEmail === "aram.test@gmail.com");
      a.stage = a.stageForced = "Approval"; a.evaluations = [{ id: "ev1", score: 4, by: "Expert" }]; amsSaveApplicants(l); });
    await A.goto(BASE + "/dashboard.html");
    await A.waitForTimeout(300);
    check(await A.evaluate(() => amsGetApplicants()[0]?.stage) === "Approval", "applicant sees the stage set by staff");
    check(await A.evaluate(() => !amsGetApplicants()[0]?.evaluations), "evaluations are hidden from the applicant");
    await S.reload(); await S.waitForSelector("#amsNav a");
    check(await S.evaluate(() => { const a = amsGetApplicants().find(x => x.applicantEmail === "aram.test@gmail.com"); return a.stage === "Approval" && a.evaluations.length === 1; }), "applicant sync never overwrites staff-only fields");

    /* chat in both directions */
    await A.evaluate(() => amsPostChat(amsGetApplicants()[0].id, { from: "applicant", name: "Aram", text: "Hello team" }));
    await S.evaluate(() => { const id = amsGetApplicants().find(x => x.applicantEmail === "aram.test@gmail.com").id; amsPostChat(id, { from: "staff", name: "Admin", text: "Hello Aram" }); });
    await A.reload();
    check(await A.evaluate(() => amsGetChat(amsGetApplicants()[0].id).map(m => m.text).join("|")) === "Hello team|Hello Aram", "chat messages from both sides are kept");

    /* sign-out and brute-force lockout */
    await A.evaluate(() => KII.logout());
    check((await A.evaluate(() => fetch("/api/state").then(r => r.json()))).session.applicant === null, "sign-out ends the server session");
    for (let i = 0; i < 5; i++) await api("/api/login", { method: "POST", body: JSON.stringify({ email: emailA, password: "wrong" }) });
    check((await api("/api/login", { method: "POST", body: JSON.stringify({ email: emailA, password: "Secret123" }) })).status === 429, "5 wrong passwords lock the account");

    check(errors.length === 0, "no browser errors: " + errors.join("; "));
    console.log(`PASS: ${checks} server checks (sign-up/sign-in, per-applicant privacy, shared staff view, files, Form Builder sync, staff-only fields, chat, codes, lockout).`);
  } finally {
    await browser.close(); server.close(); db.close();
    fs.rmSync(process.env.KII_DATA_DIR, { recursive: true, force: true });
  }
})().catch(e => { console.error(e); process.exit(1); });
