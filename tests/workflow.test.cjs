const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { page, user, application, tick } = require("./application.test.cjs");
const read = file => fs.readFileSync(file, "utf8");

(async () => {
  const dom = page("dashboard.html"), w = dom.window;
  try {
    const KII = w.KII;
    KII.addUser(user); KII.login(user.email);
    const app = application("workflow");
    app.submitted = true; app.submittedAt = new Date().toISOString();
    KII.saveApplication(user.email, app); KII.selectApplication(user.email, app.id);
    new vm.Script(read("js/ams.js") + `;window.ams = {
      amsInit, amsSyncPortal, amsGetApplicants, amsSaveApplicants, amsGetApplicant,
      amsPostChat, amsGetChat, amsGetNotifs, amsGetSettings, amsSaveSettings
    };`).runInContext(dom.getInternalVMContext());
    const api = w.ams;
    api.amsInit();
    const id = KII.portalId(user.email, app);
    const records = api.amsGetApplicants(), record = records.find(r => r.id === id);
    record.stage = record.stageForced = "Expert Evaluation";
    record.tasks = [{ id: "follow-up", task: "Send a progress report", status: "Open",
      assignedTo: "Applicant", due: "2026-12-01", priority: "Medium" }];
    api.amsSaveApplicants(records); api.amsSyncPortal();
    assert.equal(api.amsGetApplicant(id).stage, "Committee Review");
    assert.equal(api.amsGetApplicant(id).workflow, "A");
    api.amsPostChat(id, { from: "staff", name: "Private staff name", text: "Please share an update." });
    w.eval(read("js/dashboard.js"));
    assert.match(w.document.getElementById("chatBox").textContent, /Please share an update/);
    assert.doesNotMatch(w.document.getElementById("chatBox").textContent, /Private staff name/);

    const chat = w.document.getElementById("chatForm");
    // jsdom does not expose named form fields as properties like browsers do.
    Object.defineProperty(chat, "text", { value: chat.elements.namedItem("text") });
    chat.text.value = "Here is our progress.";
    chat.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    assert.equal(api.amsGetChat(id).at(-1).from, "applicant");
    assert.equal(api.amsGetChat(id).at(-1).text, "Here is our progress.");

    const task = w.document.querySelector("input[data-task]");
    task.checked = true; task.dispatchEvent(new w.Event("change", { bubbles: true }));
    assert.equal(api.amsGetApplicant(id).tasks[0].status, "Completed");
    assert.equal(api.amsGetApplicant(id).activities[0].title, "Applicant completed a task");
    assert.ok(api.amsGetNotifs().some(n => n.text.includes("completed")));

    const revised = KII.getApplication(user.email, app.id);
    revised.submitted = false; revised.revisionNote = "Add market details";
    KII.saveApplication(user.email, revised); api.amsSyncPortal();
    assert.equal(api.amsGetApplicant(id).portalData.submitted, false);
    revised.submitted = true; revised.resubmittedAt = new Date().toISOString();
    revised.revisionHistory = [{ note: revised.revisionNote, resubmittedAt: revised.resubmittedAt }];
    revised.revisionNote = "";
    KII.saveApplication(user.email, revised); api.amsSyncPortal();
    assert.match(api.amsGetApplicant(id).activities[0].title, /resubmitted/);

    w.prompt = () => "Personal reasons";
    w.document.getElementById("cancelBtn").click();
    assert.equal(KII.getApplication(user.email, app.id).status, "Withdrawn");
    assert.equal(api.amsGetApplicant(id).outcome, "Withdrawn");
    assert.equal(api.amsGetApplicant(id).status, "Inactive");
    KII.deleteApplication(user.email, app.id);
    assert.ok(KII.getApplication(user.email, app.id), "Withdrawn application retained");

    const settings = { ...api.amsGetSettings(), deadline: "2027-12-31", blindReview: true, callName: "Test call" };
    api.amsSaveSettings(settings);
    assert.deepEqual(JSON.parse(JSON.stringify(api.amsGetSettings())), settings);

    // Regression: failures must accumulate before the five-minute lock starts.
    for (const identity of [user.email, "staff:admin@kii.org"]) {
      for (let i = 0; i < 4; i++) { KII.recordFail(identity); assert.equal(KII.isLocked(identity), 0); }
      KII.recordFail(identity);
      assert.equal(KII.isLocked(identity), 5);
      const locks = JSON.parse(w.localStorage.getItem(KII.LOCK_KEY));
      locks[identity].until = Date.now() - 1;
      w.localStorage.setItem(KII.LOCK_KEY, JSON.stringify(locks));
      assert.equal(KII.isLocked(identity), 0);
      KII.recordFail(identity);
      assert.equal(KII.isLocked(identity), 0);
      assert.equal(JSON.parse(w.localStorage.getItem(KII.LOCK_KEY))[identity].n, 1);
      KII.clearFails(identity);
      assert.equal(KII.isLocked(identity), 0);
    }
    assert.equal(KII.escapeHtml(`<a title="x">&'</a>`), "&lt;a title=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
    assert.equal(KII.validDate("2024-02-29"), true);
    assert.equal(KII.validDate("2023-02-29"), false);
    await tick();
    console.log("PASS: stage migration, chat privacy, task completion, revision/resubmission, withdrawal, settings, shared helpers, and applicant/staff lockout.");
  } finally { w.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
