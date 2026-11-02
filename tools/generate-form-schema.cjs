const { chromium } = require("playwright"); const fs = require("fs"), path = require("path");
const { user, application } = require("../tests/application.test.cjs");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext();
  await ctx.route("http://localhost:8090/**", r => { const p = new URL(r.request().url()).pathname.slice(1) || "index.html"; const f = path.resolve(p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ contentType: p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html", body: fs.readFileSync(f) }); });
  const app = application("v");
  await ctx.addInitScript(({ user, app }) => { if (localStorage.getItem("kii_session")) return;
    localStorage.setItem("kii_users", JSON.stringify([user])); localStorage.setItem("kii_session", user.email);
    localStorage.setItem("kii_app_" + user.email + "::v", JSON.stringify(app)); localStorage.setItem("kii_selected_" + user.email, "v"); }, { user, app });
  const page = await ctx.newPage();
  await page.goto("http://localhost:8090/application.html?application=v&s=personal");
  await page.waitForFunction(() => !!window.KIIMergedForm);
  const schema = await page.evaluate(() => localStorage.getItem("kii_form_schema"));
  fs.writeFileSync("js/form-schema.js", "/* Built-in application questions (generated from js/application-merged.js; the form refreshes this list at runtime). */\nwindow.KII_FORM_SCHEMA = " + JSON.stringify(JSON.parse(schema), null, 1) + ";\n");
  console.log("sections", JSON.parse(schema).length, "fields", JSON.parse(schema).reduce((n, s) => n + s.fields.length, 0));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

