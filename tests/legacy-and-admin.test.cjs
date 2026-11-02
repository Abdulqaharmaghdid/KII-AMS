const { JSDOM } = require("jsdom");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const read = path => fs.readFileSync(path, "utf8");
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function page(html, path) {
  const dom = new JSDOM(read(html), { url: "http://localhost:8090/" + path, runScripts: "outside-only" });
  dom.window.scrollTo = () => {};
  dom.window.alert = message => { dom.window.lastAlert = message; };
  dom.window.confirm = () => true;
  dom.window.TextEncoder = TextEncoder;
  dom.window.eval(read("js/common.js") + "; window.KII = KII;");
  return dom;
}
const clone = object => JSON.parse(JSON.stringify(object));

(async () => {
  const dom = page("application.html", "application.html");
  const w = dom.window, doc = w.document;
  const user = { firstName: "Test", secondName: "Applicant", thirdName: "Example", email: "test@example.org", dob: "2000-01-01", phone: "+964 (IQ) 7501234567" };
  w.KII.addUser(user); w.KII.login(user.email);
  w.KII.saveApplication(user.email, { category: "Health", data: {}, completedSections: [], startedAt: "2026-10-10", status: "InProgress" });
  const files = new Map();
  w.KII.saveFile = async (id, file) => { files.set(id, file); return true; };
  w.KII.getFile = async id => files.get(id);
  w.eval(read("js/application-legacy.js") + ";window.test = { SECTIONS, app, renderSection, collectCurrent, missingRequired, renderReview, postalError, validDate };");
  const t = w.test, section = id => t.SECTIONS.find(s => s.id === id);
  const input = name => doc.querySelector(`[name="${name}"]`);
  const set = (name, value, event = "input") => {
    const el = input(name);
    if (el.type === "checkbox") el.checked = value; else el.value = value;
    el.dispatchEvent(new w.Event(event, { bubbles: true }));
  };
  const body = doc.getElementById("sectionBody");
  check(t.SECTIONS.length === 14, "14 application sections");
  await t.renderSection("personal");
  check(input("phone").value === "7501234567" && input("phoneCode").value === "+964 (IQ)", "Account phone prefill");
  const personal = { ...t.app.data.personal, country: "Iraq", city: "Erbil", street: "Street", gender: "Female", primaryCitizenship: "Iraq", postal: "44001" };
  check(section("personal").validate(personal) === null, "Valid personal details");
  check(!!section("personal").validate({ ...personal, birthDate: "2999-01-01" }), "Future birth rejected");
  check(!t.validDate("2026-02-30"), "Impossible date rejected");
  check(!!section("personal").validate({ ...personal, postal: "wrong!" }), "Invalid Iraqi postal code rejected");
  check(section("personal").validate({ ...personal, postal: "" }) === null, "Postal code optional");
  check(!t.postalError("Canada", "K1A 0B1") && !t.postalError("United Kingdom", "SW1A 1AA"), "International postal formats");
  check(!!section("personal").validate({ ...personal, email: "missing-at-and-domain" }), "Invalid personal email rejected");
  console.log("Personal validation passed");

  const education = { type: "higher", entries: [{ idx: 0, level: "Other", levelOther: "Professional qualification", institution: "Institute", fieldOfStudy: "Engineering", country: "Iraq", city: "Erbil", startDate: "2024-01-01", currentlyStudying: true, endDate: "", files: {} }] };
  t.app.data.education = clone(education);
  await t.renderSection("education");
  check(!doc.querySelector(".degree-other").classList.contains("hidden"), "Other-degree follow-up visible");
  check(input("endDate").disabled, "Current student end date disabled");
  check(section("education").validate(education) === null, "Current student accepted without end date");
  check(!!section("education").validate({ ...education, entries: [{ ...education.entries[0], levelOther: "" }] }), "Other degree specification required");
  check(!!section("education").validate({ ...education, entries: [{ ...education.entries[0], startDate: "2999-01-01" }] }), "Future education start rejected");
  check(!!section("education").validate({ ...education, entries: [{ ...education.entries[0], currentlyStudying: false, endDate: "2999-01-01" }] }), "Future end rejected");
  check(!!section("education").validate({ ...education, entries: [{ ...education.entries[0], currentlyStudying: false, endDate: "2020-01-01" }] }), "Reversed education dates rejected");
  const upload = doc.querySelector('input[data-store="transcript_0"]');
  const certificates = [new w.File(["a"], "certificate.pdf", { type: "application/pdf" }), new w.File(["b"], "transcript.png", { type: "image/png" })];
  Object.defineProperty(upload, "files", { configurable: true, value: certificates });
  doc.querySelector('[name="type"][value="highschool"]').click();
  doc.querySelector('[name="type"][value="higher"]').click();
  check(doc.querySelector('input[data-store="transcript_0"]') === upload, "Education toggle retains selected file input");
  const collectedEducation = await t.collectCurrent();
  check(collectedEducation.entries[0].files.transcript_0.length === 2 && files.size === 2, "Both certificates stored");
  t.app.data.education = collectedEducation;
  await t.renderSection("education");
  const reloadedEducation = await t.collectCurrent();
  check(reloadedEducation.entries[0].files.transcript_0.length === 2, "Multiple certificates survive revisit and save");
  check(body.textContent.includes("certificate.pdf") && body.textContent.includes("transcript.png"), "Saved files visible");
  const extra = doc.querySelector('input[data-store="transcript_0"]');
  Object.defineProperty(extra, "files", { configurable: true, value: Array(11).fill(certificates[0]) });
  await assert.rejects(t.collectCurrent(), /up to 10/); checks++;
  Object.defineProperty(extra, "files", { configurable: true, value: [certificates[0]] });
  w.KII.saveFile = async () => false;
  await assert.rejects(t.collectCurrent(), /Could not save/); checks++;
  w.KII.saveFile = async (id, file) => { files.set(id, file); return true; };

  const supporting = {
    category: "Health", title: "Medical prototype", explain: "Project", role: "Founder", workDuration: "Less than 6 months",
    estCompletion: "6 months", innovationField: "Technology", problem: "Problem", beneficiaries: "Patients", innovationPoint: "New approach",
    businessPotential: "Yes", legalFocus: "Intellectual Property", stage: "Prototype", implemented: "No",
    trl: "TRL 1 – Basic principles observed", ipStatus: "No IP protection yet", legalEntity: "Not registered yet (individual / team)",
    targetCustomers: "Patients", competitors: "Alternatives", milestonesPlan: "Month 3: prototype",
    requirements: [{ rqItem: "Developer", rqType: "Manpower", rqQty: 3, rqUnit: "Month", rqCost: 700 }],
    files: { cv: { name: "cv.pdf", fileId: "cv" }, photo: { name: "photo.jpg", fileId: "photo" } }
  };
  t.app.data.supporting = clone(supporting);
  console.log("Education upload and validation passed");
  await t.renderSection("supporting");
  check(input("completionValue").value === "6" && input("completionUnit").value === "Month", "Legacy completion text prefilled");
  check(doc.querySelector("#reqTotal").textContent === "$2,100", "Requirements total preserved");
  set("role", "Member", "change");
  check(!doc.getElementById("roleDetails").classList.contains("hidden"), "Member responsibilities shown");
  check(!!section("supporting").validate({ ...supporting, role: "Member" }), "Member details mandatory");
  doc.getElementById("addTeam").click();
  set("tmName", "Other Founder"); set("tmEmail", "invalid-email"); set("tmPhone", "+964 7501234567"); set("tmRole", "Founder"); set("tmResponsibilities", "Product design");
  set("roleOther", "Engineering");
  let project = await t.collectCurrent();
  check(!!section("supporting").validate(project), "Invalid participant email rejected");
  set("tmEmail", "founder@example.org");
  project = await t.collectCurrent();
  check(section("supporting").validate(project) === null, "Valid team and structured completion accepted");
  check(project.completionValue === "6" && project.estCompletion === "6 months" && project.team[0].tmResponsibilities === "Product design", "New fields collected");
  check(!!section("supporting").validate({ ...project, requirements: [...project.requirements, { rqItem: "Incomplete" }] }), "Every requirement validated");
  set("rqType", "Device", "change");
  check(input("rqUnit").value === "Piece", "Device units");
  set("rqType", "Manpower", "change"); doc.querySelector(".req-del").click();
  check(input("rqType").value === "Equipment" && input("rqUnit").value === "Piece", "Cleared last row resets units");

  t.app.data.personal = personal; t.app.data.education = collectedEducation; t.app.data.supporting = project;
  console.log("Project fields and requirements passed");
  t.app.completedSections = t.SECTIONS.map(s => s.id);
  t.app.data.personal.birthDate = "2999-01-01";
  check(t.missingRequired().some(s => s.id === "personal"), "Stale completion cannot bypass validation");
  t.app.data.personal.birthDate = personal.birthDate = "2000-01-01";
  t.app.data.instruction = { agreeApp: true, agreeFee: true };
  t.app.data.video = { files: { video: { name: "statement.mp4", fileId: "vid", duration: 20 } } };
  t.app.data.interest = { areas: ["Robotics"], motivation: "Build useful machines" };
  t.app.data.duration = { length: "6 months", startPref: "2027-01-01", availability: "Full-time" };
  t.app.data.examscore = { examType: "None" };
  t.app.data.travel = { passportNo: "Example123", passportCountry: "Iraq", passportExpiry: "2035-01-01", visaIssue: "No" };
  t.app.data.kii = { heardFrom: "KII website", appliedBefore: "No", why: "Develop the project" };
  t.app.data.recommendations = { entries: [{ rcName: "Referee", rcEmail: "referee@example.org" }] };
  check(!t.missingRequired().length, "Complete valid application passes final validation");
  check(!!section("video").validate({ files: { video: { name: "long.mp4", duration: 31 } } }), "Long video blocked");
  await t.renderSection("review");
  check(body.textContent.includes("Product design") && body.textContent.includes("certificate.pdf") && body.textContent.includes("Currently studying here"), "Review includes new fields and uploads");
  check(!doc.getElementById("continueBtn").disabled, "Valid review enabled");
  for (const id of ["decTruth", "decIp", "decEthics", "decPrivacy"]) doc.getElementById(id).checked = true;
  doc.getElementById("continueBtn").click();
  await new Promise(resolve => setTimeout(resolve, 20));
  check(w.KII.getApplication(user.email).submitted, "Application submits successfully");
  await t.renderSection("education");
  check([...body.querySelectorAll("input, select, button")].every(el => el.disabled), "Submitted education read-only");
  const saved = w.KII.getApplication(user.email);
  console.log("Review and submission passed");

  const adminDom = page("admin.html", "admin.html?v=dashboard&from=2026-10-01&to=2026-10-31");
  const a = adminDom.window;
  new vm.Script(read("js/ams.js") + ";window.ams = { amsInit, amsSyncPortal, amsGetApplicants, amsSaveApplicants, amsCollectUploads }; amsRequireStaff = () => ({ id: 'test-admin', name: 'Administrator', role: 'master_admin', active: true, perms: ALL_PERMS });").runInContext(adminDom.getInternalVMContext());
  a.KII.addUser(user); saved.submittedAt = "2026-10-31T12:00:00"; a.KII.saveApplication(user.email, saved);
  a.ams.amsInit();
  console.log("AMS initialized");
  let records = a.ams.amsGetApplicants();
  const record = records[0];
  check(record.application.supporting.team[0].tmPhone === "+964 7501234567", "New fields synchronized to AMS");
  check(record.uploads.filter(f => f._key === "transcript_0").length === 2, "AMS indexes all certificates");
  record.stage = "Pitch Deck"; record.stageForced = "Pitch Deck"; record.tasks = [{ id: "one", task: "Included task", status: "Open", due: "2026-10-31", assignedTo: "Applicant" }];
  a.ams.amsSaveApplicants([...records, { id: "old", name: "Excluded old project", appliedDate: "2025-01-01", stage: "Under Evaluation", status: "Active", tasks: [{ id: "old-task", task: "Excluded task", status: "Open", due: "2026-10-31" }] }]);
  a.eval(read("js/admin.js") + ";window.adminTest = { inApplicationRange, tabApplication, ROUTES, P };");
  check(a.adminTest.inApplicationRange({ appliedDate: "2026-10-31T23:59:59" }, "2026-10-01", "2026-10-31"), "Date filter includes full final day");
  check(!a.document.getElementById("amsContent").textContent.includes("Excluded task"), "Dashboard tasks scoped to selected applications");
  check(a.document.getElementById("amsContent").textContent.includes("Included task"), "Selected applicant task shown");
  const evaluationCard = [...a.document.querySelectorAll(".stat-card")].find(el => el.textContent.includes("Under Evaluation"));
  check(evaluationCard.querySelector(".num").textContent === "1", "Dashboard includes Pitch Deck in evaluation count");
  const content = a.document.getElementById("amsContent");
  a.adminTest.tabApplication(a.ams.amsGetApplicants().find(r => r.id === record.id), content);
  check(content.textContent.includes("Product design") && content.textContent.includes("certificate.pdf") && content.textContent.includes("transcript.png"), "Staff application displays all new fields and files");
  for (const [route, render] of Object.entries(a.adminTest.ROUTES)) {
    if (route === "applicant") continue;
    render(content);
    check(content.textContent.trim().length > 0, `${route} page renders`);
  }
  a.adminTest.P.set("from", "2030-01-01"); a.adminTest.P.set("to", "2030-01-02");
  a.adminTest.ROUTES.dashboard(content);
  check(content.querySelector(".stat-card .num").textContent === "0", "Empty date range yields zero applications");
  dom.window.close(); adminDom.window.close();
  console.log(`PASS: ${checks} checks covering form validation, DOM interactions, saved drafts, uploads, submission, AMS synchronization and all 10 management views.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
