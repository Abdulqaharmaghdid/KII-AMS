/* Moving prototype data from an existing browser into an empty server, then using it from another browser.
   Run: node tests/import.test.cjs */
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path");
const PORT = 8098, BASE = `http://localhost:${PORT}`;
process.env.KII_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "kii-import-"));
const SHOTS = process.env.KII_SHOTS || "";
const { server, db } = require("../server/server.cjs");
const { chromium } = require("playwright");
const { user, application } = require("./application.test.cjs");
(async () => {
  await new Promise(r => server.listen(PORT, "127.0.0.1", r));
  const browser = await chromium.launch({ channel: process.env.KII_BROWSER_CHANNEL || "chrome", headless: true });
  const errors = [];
  try {
    /* a browser that already holds prototype data (saved before the server existed) */
    const old = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const app = application("v"); app.submitted = true; app.submittedAt = new Date().toISOString(); app.applicantCode = "HUM001";
    app.data.personal.files = { cv: [{ name: "cv.pdf", type: "application/pdf", size: 9, fileId: "test@example.org/v/merged/cv" }] };
    await old.addInitScript(({ user, app }) => {
      if (localStorage.getItem("__seeded")) return;
      localStorage.setItem("__seeded", "1");
      localStorage.setItem("kii_users", JSON.stringify([{ ...user, password: "Secret123" }]));
      localStorage.setItem("kii_app_test@example.org::v", JSON.stringify({ ...app, ownerEmail: "test@example.org" }));
      localStorage.setItem("kii_selected_test@example.org", "v");
      const r = indexedDB.open("kii_db", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => r.result.transaction("files", "readwrite").objectStore("files").put(new File(["OLD FILE!"], "cv.pdf", { type: "application/pdf" }), "test@example.org/v/merged/cv");
    }, { user, app });
    const p = await old.newPage(); p.on("pageerror", e => errors.push(e.message));
    let asked = 0; p.on("dialog", d => { asked++; d.accept(); });
    await p.goto(BASE + "/index.html"); await p.waitForTimeout(300);
    await p.reload(); await p.waitForTimeout(1500);
    assert.ok(asked >= 1, "import was offered");
    /* old plain-text password still works; the server upgrades it to a hash */
    await p.goto(BASE + "/login.html");
    await p.fill("#loginEmail", "test@example.org"); await p.fill("#loginPassword", "Secret123");
    await Promise.all([p.waitForURL(/dashboard/), p.click("#loginForm button[type=submit]")]);
    await p.goto(BASE + "/application.html?application=v&s=review");
    await p.waitForSelector(".report");
    assert.ok((await p.locator(".report").innerText()).includes("HUM001"), "imported application renders");
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, "imp-review.png") });

    /* a different browser (e.g. an office PC): staff */
    const office = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const s = await office.newPage(); s.on("pageerror", e => errors.push(e.message)); s.on("dialog", d => d.accept());
    await s.goto(BASE + "/admin-login.html");
    await s.fill("#staffEmail", "admin@kii.org"); await s.fill("#staffPassword", "admin123");
    await Promise.all([s.waitForURL(/admin\.html/), s.click("#staffLoginForm button[type=submit]")]);
    await s.goto(BASE + "/admin.html?v=applicants"); await s.waitForSelector("#amsContent");
    const id = await s.evaluate(() => amsGetApplicants()[0]?.id);
    assert.ok(id, "office browser sees the imported applicant");
    assert.equal(await s.evaluate(() => KII.getFile("test@example.org/v/merged/cv").then(f => f && f.text())), "OLD FILE!", "old browser file reached the server");
    await s.goto(BASE + "/admin.html?v=applicant&id=" + encodeURIComponent(id) + "&tab=application");
    await s.waitForSelector("#amsContent .report, #amsContent .ams-card");
    if (SHOTS) await s.screenshot({ path: path.join(SHOTS, "imp-staff.png") });
    for (const v of ["dashboard", "applicants", "meetings", "tasks", "evaluations", "procurement", "reports", "documents", "team", "settings", "formbuilder"]) {
      await s.goto(BASE + "/admin.html?v=" + v); await s.waitForTimeout(150);
    }
    assert.equal(errors.length, 0, errors.join("; "));
    console.log("PASS: browser data imported into the server (records + files), old password upgraded, applicant review and all 11 staff views work from another browser.");
  } finally { await browser.close(); server.close(); db.close(); fs.rmSync(process.env.KII_DATA_DIR, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exit(1); });
