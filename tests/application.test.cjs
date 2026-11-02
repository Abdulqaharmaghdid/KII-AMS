const { JSDOM } = require("jsdom");
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const read = path => fs.readFileSync(path, "utf8");
const copy = data => JSON.parse(JSON.stringify(data));
const windows = [];
let count = 0;
function check(ok, label) { assert.ok(ok, label); count++; }
function page(html, query = "") {
  const dom = new JSDOM(read(html), { url: "http://localhost:8090/" + html + query, runScripts: "outside-only" });
  windows.push(dom.window);
  dom.window.scrollTo = () => {};
  dom.window.alert = text => { dom.window.lastAlert = text; };
  dom.window.confirm = () => true;
  dom.window.TextEncoder = TextEncoder;
  new vm.Script(read("js/common.js") + ";window.KII = KII;").runInContext(dom.getInternalVMContext());
  dom.window.fetch = async () => ({ ok: true, text: async () => read("js/world-cities.csv") });
  dom.window.eval(read("js/application-locations.js"));
  return dom;
}
const user = { firstName: "Test", secondName: "Middle", thirdName: "Applicant", passportNo: "A12345678", email: "test@example.org", dob: "2000-02-15", phone: "+964 (IQ) 7501234567" };
const meta = (name, duration) => ({ name, fileId: "files/" + name, type: name.endsWith(".mp4") ? "video/mp4" : "application/pdf", size: 10, ...(duration ? { duration } : {}) });
const data = {
  instruction: { agreeApp: true, devArea: "Health" },
  personal: { firstName: "Test", secondName: "Middle", thirdName: "Applicant", passportNo: "A12345678", birthDate: "2000-02-15", gender: "Female",
    country: "Iraq", city: "Erbil", street: "Street", postal: "", email: user.email, phoneCode: "+964", phone: "7501234567",
    educationType: "High School or lower", courses: [], files: {} },
  innovation: { title: "Prototype for a better future", sector: "Technology", subSector: "Software",
    explain: "An accessible innovation that helps people. ".repeat(9), problem: "People need a practical way to solve this issue. ".repeat(8),
    innovationPoint: "A new and affordable approach that costs less than existing tools. ".repeat(5), beneficiaries: "Local communities", workDuration: "0–6 months", implemented: "No", sdgs: [] },
  team: { roles: ["Founder", "CTO"], members: [{ name: "Test Middle Applicant", email: user.email, role: "Founder", phone: "+9647501234567" }], skills: ["Software development"] },
  technical: { technical: "The system combines software, sensors and local components. ".repeat(7),
    prototypeStage: "No, not yet", prototypeNeeds: ["Engineering expertise"], needsDetail: "Help with sensor design.", files: {} },
  protection: { ipStatus: "No protection yet", regulatory: "Not sure", legalEntity: "Not registered yet (individual / team)" },
  market: { targetCustomers: "Local communities and institutions would use this product. ".repeat(7), competitors: "Manual processes.",
    businessPotential: "No", files: {} },
  support: { supportTypes: ["Mentorship"], milestones: [{ milestone: "Complete first prototype", month: "3" }], otherSupport: "No" },
  statement: { appliedBefore: "No", heardFrom: "Social media", files: { video: [meta("statement.mp4", 60)] }, references: [] }
};
const application = id => ({ id, schemaVersion: 3, category: "Technology", data: copy(data), completedSections: [], currentSection: "instruction", startedAt: "2026-10-01T12:00:00", status: "InProgress", submitted: false });
const tick = () => new Promise(resolve => setTimeout(resolve, 15));
if (require.main === module && !process.argv.includes("--browser")) (async () => {
  const dom = page("application.html", "?application=idea-a"), w = dom.window, doc = w.document;
  w.KII.addUser(user); w.KII.login(user.email);
  w.KII.saveApplication(user.email, application("idea-a")); w.KII.saveApplication(user.email, application("idea-b"));
  w.KII.selectApplication(user.email, "idea-b");
  const storedFiles = new Map();
  w.KII.saveFile = async (id, file) => { storedFiles.set(id, file); return true; };
  w.KII.getFile = async id => storedFiles.get(id);
  w.KII.deleteFile = async id => storedFiles.delete(id);
  w.eval(read("js/application-merged.js")); await tick();
  const form = w.KIIMergedForm, body = doc.getElementById("sectionBody");
  check(!!form, doc.getElementById("alert").textContent || "Form booted");
  check(form.schema.length === 10, "Exactly ten steps");
  check(form.schema.map(s => s.id).join() === "instruction,personal,innovation,team,technical,protection,market,support,statement,review", "Step order matches the specification");
  check(form.application.id === "idea-a", "URL selects exact idea, independent of account selection");
  check(w.KII.getApplications(user.email).length === 2, "Same email holds two ideas");
  const section = id => form.schema.find(s => s.id === id);
  const errors = (id, value) => form.validate(section(id).fields, value);
  for (const [id, value] of Object.entries(data)) check(!errors(id, value).length, `${id}: ${errors(id, value).join("; ")}`);
  check(section("instruction").fields.length === 3, "Instruction step has terms, dev area and other-specify");
  check(w.KIILocations.countries().every(country => w.KIILocations.cities(country).length), "Every selectable country has city options");
  check(w.KIILocations.cities("Iran").includes("Tehran"), "Common country names map to the city catalogue");
  check(!errors("personal", { ...data.personal, email: "student@university.edu" }).length, "Academic emails accepted");
  check(errors("personal", { ...data.personal, email: "invalid" }).length, "Bad email rejected");
  check(errors("personal", { ...data.personal, birthDate: "2999-01-01" }).length, "Future birth date rejected");
  check(errors("personal", { ...data.personal, birthDate: "2001-02-29" }).length, "Impossible birth date rejected");
  check(errors("personal", { ...data.personal, postal: "AB12" }).length, "Postal digits only");
  check(errors("personal", { ...data.personal, phone: "750 1234567" }).length, "Phone digits only");
  check(errors("personal", { ...data.personal, linkedIn: "not-a-url" }).length, "Invalid optional LinkedIn rejected");
  check(!errors("personal", { ...data.personal, linkedIn: "https://linkedin.com/in/test" }).length, "Valid LinkedIn");
  check(!section("personal").fields.some(f => ["primaryCitizenship", "dualCitizenship", "work"].includes(f.key)), "Citizenship and work history removed");
  check(errors("personal", { ...data.personal, courses: [{ courseName: "Python" }] }).length, "Course provider required when a course is added");
  check(!errors("personal", { ...data.personal, courses: [{ courseName: "Python", provider: "Coursera", files: { certificate: [meta("cert.pdf")] } }] }).length, "Course with provider and certificate accepted");
  const education = { level: "Other", levelOther: "Qualification", institution: "Hawler Medical University", fieldOfStudy: "Computer Science & IT", country: "Iraq", city: "Erbil", startYear: "2022", currentlyStudying: true, files: {} };
  check(!errors("personal", { ...data.personal, educationType: "Higher Education", education: [education] }).length, "Current student supported");
  check(errors("personal", { ...data.personal, educationType: "Higher Education", education: [{ ...education, levelOther: "" }] }).length, "Other degree details required");
  check(errors("personal", { ...data.personal, educationType: "Higher Education", education: [{ ...education, currentlyStudying: false, endYear: "2021" }] }).length, "Education year order");
  check(errors("personal", { ...data.personal, educationType: "Higher Education", education: [{ ...education, startYear: "2999" }] }).length, "Education future start rejected");
  check(errors("personal", { ...data.personal, educationType: "Higher Education", education: [{ ...education, institution: "University of Duhok" }] }).length, "University must belong to selected city");
  check(!errors("personal", { ...data.personal, educationType: "Higher Education", education: [{ ...education, city: "Baghdad", institution: "My institution" }] }).length, "Other-city institution accepts free text");
  check(errors("personal", { ...data.personal, country: "Not a country" }).length, "Country must be selected");
  check(errors("personal", { ...data.personal, city: "London" }).length, "Iraq cannot contain an overseas city");
  check(!errors("personal", { ...data.personal, country: "United Kingdom", city: "London", postal: "SW1A 1AA" }).length, "International postal codes allowed");
  for (const email of ["a..b@example.com", ".a@example.com", "a@-example.com", "a@example..org", "a@example.c", "a@exam_ple.com"]) {
    check(errors("personal", { ...data.personal, email }).length, `Malformed email rejected: ${email}`);
  }
  check(!errors("personal", { ...data.personal, email: "first.last+idea@example.org" }).length, "Valid personal email with plus tag accepted");
  check(!errors("personal", { ...data.personal, linkedIn: "https://instagram.com/test" }).length, "Social media link accepted");
  check(!errors("personal", { ...data.personal, education: [{ level: "Other" }] }).length, "Hidden education ignored");
  check(!errors("innovation", { ...data.innovation, title: "x".repeat(100) }).length, "100-character title accepted");
  check(errors("innovation", { ...data.innovation, title: "x".repeat(101) }).length, "101-character title rejected");
  check(errors("innovation", { ...data.innovation, explain: "short" }).length, "Description minimum enforced");
  check(errors("innovation", { ...data.innovation, problem: "x".repeat(2001) }).length, "Problem maximum enforced");
  check(errors("innovation", { ...data.innovation, sector: "Health", subSector: "Software" }).length, "Sub-sector belongs to sector");
  check(errors("innovation", { ...data.innovation, subSector: "Other" }).length, "Other sub-sector requires specification");
  const sdgs = section("innovation").fields.find(f => f.key === "sdgs").options;
  check(!errors("innovation", { ...data.innovation, sdgs: sdgs.slice(0, 5) }).length, "Five SDGs allowed");
  check(errors("innovation", { ...data.innovation, sdgs: sdgs.slice(0, 6) }).length, "Sixth SDG blocked");
  check(errors("innovation", { ...data.innovation, implemented: "Yes" }).length, "Implementation result required");
  check(errors("team", { ...data.team, roles: ["Other"] }).length, "Other role details required");
  check(errors("team", { ...data.team, members: [] }).length, "Team table required");
  check(!errors("team", data.team).length, "Solo applicant is sufficient");
  check(errors("team", { ...data.team, members: [{ ...data.team.members[0], phone: "bad" }] }).length, "Team phone validated");
  const proof = { ...data.technical, prototypeStage: "Proof of concept", testResults: "Bench-tested; measures temperature within 0.5 degrees.", builtBy: "Our team" };
  check(!errors("technical", proof).length, "Proof of concept does not require photos");
  check(errors("technical", { ...proof, prototypeStage: "Working prototype" }).length, "Working prototype requires photos");
  const working = { ...proof, prototypeStage: "Working prototype", files: { prototypePhotos: [meta("photo.jpg")] } };
  check(!errors("technical", working).length, "Working prototype with photo accepted");
  check(errors("technical", { ...working, files: { prototypePhotos: Array(6).fill(meta("photo.jpg")) } }).length, "Six prototype photos rejected");
  check(errors("protection", { ...data.protection, regulatory: "Yes" }).length, "Regulatory details conditional");
  check(!errors("technical", { ...proof, files: { prototypeDemo: [meta("demo.mp4", 180)] } }).length, "Three-minute optional demo accepted");
  check(errors("technical", { ...proof, files: { prototypeDemo: [meta("demo.mp4", 181)] } }).length, "Long demo rejected");
  check(errors("innovation", { ...data.innovation, innovationPoint: "short" }).length, "Innovation point minimum enforced");
  check(errors("innovation", { ...data.innovation, sector: "Fashion & Design" }).length, "Only configured sectors accepted");
  check(!errors("innovation", { ...data.innovation, sector: "Other", sectorOther: "Tourism", subSector: "" }).length, "Other sector needs no sub-sector");
  check(errors("team", { ...data.team, members: [{ ...data.team.members[0], files: { cv: [meta("cv.jpg")] } }] }).length, "Team member CV must be PDF");
  check(!errors("market", data.market).length, "No business does not require revenue explanation");
  check(errors("market", { ...data.market, businessPotential: "Maybe" }).length, "Maybe requires revenue explanation");
  check(!errors("market", { ...data.market, businessPotential: "Yes", businessDetail: "Subscriptions" }).length, "Revenue explanation accepted");
  check(errors("support", { ...data.support, supportTypes: ["Engineering Workshop Access"] }).length, "Workshop facilities required");
  check(errors("support", { ...data.support, supportTypes: ["Financial support"], reqCurrency: "USD" }).length, "Financial rows conditional");
  const finance = { ...data.support, supportTypes: ["Financial support"], reqCurrency: "USD", requirements: [
    { rqItem: "Developer", rqType: "Manpower", rqQty: "3", rqUnit: "Month", rqCost: "700" },
    { rqItem: "Material", rqType: "Material", rqQty: "2", rqUnit: "Kg", rqCost: "15000" }
  ] };
  check(!errors("support", finance).length, "Mixed-currency requirements valid");
  check(errors("support", { ...finance, requirements: [...finance.requirements, { rqItem: "Incomplete" }] }).length, "Every financial row checked");
  check(errors("support", { ...data.support, milestones: Array(6).fill(data.support.milestones[0]) }).length, "Five-milestone cap enforced");
  check(errors("support", { ...data.support, milestones: [{ milestone: "x", month: "13" }] }).length, "Milestone month within twelve");
  check(errors("support", { ...data.support, otherSupport: "Yes" }).length, "Other organisation required when yes");
  check(!errors("statement", data.statement).length, "60-second statement and optional references accepted");
  check(errors("statement", { ...data.statement, files: { video: [meta("statement.mp4", 61)] } }).length, "61-second statement rejected");
  check(errors("statement", { ...data.statement, files: { video: [meta("statement.webm", 30)] } }).length, "MP4 format required");
  check(errors("statement", { ...data.statement, references: [{ name: "Name", email: "bad" }] }).length, "Provided reference email validated");
  check(errors("statement", { ...data.statement, appliedBefore: "Yes" }).length, "Previous program details required");
  console.log("Schema and conditional validation passed");

  function set(key, value, root = body) {
    const control = root.querySelector(`[data-key="${key}"]`);
    if (control.type === "checkbox") control.checked = value; else control.value = value;
    control.dispatchEvent(new w.Event("input", { bubbles: true }));
    control.dispatchEvent(new w.Event("change", { bubbles: true }));
  }
  form.render("personal");
  body.querySelector('[data-date="Year"]').focus();
  check(body.querySelectorAll('[data-field="birthDate"] [role="option"]').length === 100, "Birth-year searchable dropdown");
  for (const [part, value] of [["Year", "2004"], ["Month", "2"], ["Day", "29"]]) {
    const input = body.querySelector(`[data-date="${part}"]`);
    input.value = value; input.dispatchEvent(new w.Event("input", { bubbles: true }));
  }
  check(form.application.data.personal.birthDate === "2004-02-29", "Typed birth date stored as valid ISO date");
  check(body.querySelector('[data-key="phoneCode"]').value === "+964", "Iraq default");
  set("educationType", "Higher Education");
  check(!body.querySelector('[data-field="education"]').hidden, "Education opens conditionally");
  const educationRow = body.querySelector('[data-field="education"] .merged-row');
  check(educationRow.querySelector('[data-key="country"]').value === "Iraq", "New education row defaults to Iraq");
  set("city", "Erbil", educationRow);
  const universityInput = educationRow.querySelector('[data-key="institution"]');
  universityInput.focus();
  check(educationRow.querySelector('[data-field="institution"]').textContent.includes("Hawler Medical University"), "Erbil university list shown");
  check(!educationRow.querySelector('[data-field="institution"]').textContent.includes("University of Duhok"), "Other-city university excluded");
  set("institution", "Hawler Medical University", educationRow);
  set("city", "Sulaymaniyah", educationRow);
  check(educationRow.querySelector('[data-key="city"]').value === "Sulaimani", "City alias normalized");
  check(universityInput.value === "", "Changing education city clears incompatible institution");
  set("city", "Baghdad", educationRow);
  check(universityInput.getAttribute("role") === "textbox", "Other cities use institution text entry");
  set("institution", "University of Baghdad", educationRow);
  set("country", "United Kingdom", educationRow);
  check(!universityInput.value && !educationRow.querySelector('[data-key="city"]').value, "Country change clears city and university together");
  set("city", "Duhok");
  check(body.querySelector('[data-key="postal"]').value === "42001", "City selection fills central postal suggestion");
  set("postal", "42002"); await form.collect(); form.persist(); form.render("personal");
  check(body.querySelector('[data-key="postal"]').value === "42002", "Manual postal override survives saving and reopening");
  set("city", "Halabja");
  check(body.querySelector('[data-key="postal"]').value === "46006", "New city replaces old postal suggestion");
  set("country", "United Kingdom");
  check(!body.querySelector('[data-key="city"]').value && !body.querySelector('[data-key="postal"]').value, "Address country clears old city and postal code");
  check(body.querySelector('[data-key="phoneCode"]').value === "+964", "Address change does not change WhatsApp code");
  set("educationType", "High School or lower");
  check(body.querySelector('[data-field="education"]').hidden, "Education hides conditionally");
  form.application.data.personal = copy(data.personal);
  form.render("innovation");
  set("sector", "Health");
  check(![...body.querySelector('[data-key="subSector"]').options].some(o => o.value === "Software"), "Sub-sector options update");
  check(body.querySelector('[data-key="subSector"]').value === "", "Incompatible sub-sector reset");
  check([...body.querySelector('[data-key="sector"]').options].map(o => o.value).filter(Boolean).join() === "Health,Automation,Technology,Agriculture,Sustainable Energy,Other", "Only the five KII sectors plus Other are offered");
  set("sector", "Other");
  check(body.querySelector('[data-field="subSector"]').hidden && !body.querySelector('[data-field="sectorOther"]').hidden, "Other sector asks to specify and hides sub-sector");
  const sdgField = body.querySelector('[data-field="sdgs"]');
  check(sdgField.querySelector("details.merged-dropdown") && sdgField.textContent.includes("3 Good Health and Well-being"), "SDG picker is a dropdown with full goal names");
  check(sdgField.querySelectorAll(".choice-icon").length === 17, "Every SDG shows an icon");
  sdgField.querySelectorAll('input[type=checkbox]').forEach((box, i) => { if (i < 5) { box.checked = true; box.dispatchEvent(new w.Event("change", { bubbles: true })); } });
  check(form.application.data.innovation.sdgs.length === 5 && [...sdgField.querySelectorAll('input[type=checkbox]')].slice(5).every(box => box.disabled), "Fifth SDG selection disables the rest");
  check(sdgField.querySelectorAll(".choice-chip").length === 5, "Selected goals shown as chips");
  // Master Admin sector configuration is read live by the form.
  w.localStorage.setItem("kii_ams_settings", JSON.stringify({ sectors: [{ name: "Health", subSectors: ["Telemedicine"] }, { name: "Tourism", subSectors: [] }] }));
  form.render("innovation");
  check([...body.querySelector('[data-key="sector"]').options].map(o => o.value).filter(Boolean).join() === "Health,Tourism,Other", "Configured sectors replace defaults");
  set("sector", "Health");
  check([...body.querySelector('[data-key="subSector"]').options].map(o => o.value).filter(Boolean).join() === "Telemedicine,Other", "Configured sub-sectors used");
  w.localStorage.removeItem("kii_ams_settings");
  form.application.data.innovation = copy(data.innovation);
  form.application.data.support = copy(finance); form.render("support");
  check(body.querySelectorAll("table").length === 2, "Requirements and milestones are real tables");
  check(body.querySelector(".budget-totals").textContent.includes("32,100 USD"), "Single-currency total shown");
  const request = body.querySelector('[data-field="requirements"]');
  request.querySelector(".add-row").click();
  check(request.querySelectorAll("tbody > tr").length === 3, "Plus button adds request row");
  request.querySelector("tbody > tr:last-child .req-del").click();
  check(request.querySelectorAll("tbody > tr").length === 2, "Remove request row");
  set("rqType", "Device", request);
  check([...request.querySelector('[data-key="rqUnit"]').options].some(o => o.value === "Piece"), "Requirement units follow type");
  const selectedFinance = body.querySelector('[data-key="supportTypes"][value="Financial support"]');
  selectedFinance.checked = false; selectedFinance.dispatchEvent(new w.Event("change", { bubbles: true }));
  check(request.hidden, "Financial table hides when not selected");
  form.persist();
  check(!form.application.activeData.support.requirements, "Hidden financial requests excluded from staff data");
  check(form.application.data.support.requirements.length === 2, "Hidden answers retained when toggling");
  form.application.data.support = copy(finance);
  form.application.data.personal = copy(data.personal);
  form.render("technical");
  set("prototypeStage", "Working prototype");
  check(!body.querySelector('[data-field="prototypePhotos"]').hidden, "Prototype photo field visible");
  check(!body.querySelector('[data-field="prototypePhotos"] .req').hidden, "Photos marked required");
  set("prototypeStage", "No, not yet");
  check(body.querySelector('[data-field="prototypePhotos"]').hidden, "No-prototype hides photo questions");
  form.application.data.technical = copy(data.technical);

  form.render("personal");
  const cvInput = body.querySelector('[data-key="cv"]');
  Object.defineProperty(cvInput, "files", { configurable: true, value: [new w.File(["pdf"], "resume.pdf", { type: "application/pdf" })] });
  await form.collect(); form.persist();
  check(form.application.data.personal.files.cv.length === 1 && storedFiles.size === 1, "PDF stored and metadata saved");
  const originalCvId = form.application.data.personal.files.cv[0].fileId;
  form.render("personal");
  check(body.textContent.includes("resume.pdf"), "Saved file visible on return");
  const badFile = body.querySelector('[data-key="cv"]');
  Object.defineProperty(badFile, "files", { configurable: true, value: [new w.File(["jpg"], "bad.jpg")] });
  await assert.rejects(form.collect(), /accepted formats/); count++;
  check(form.application.data.personal.files.cv[0].fileId === originalCvId, "Failed replacement preserves previous upload");
  form.render("personal");
  const failedSave = body.querySelector('[data-key="cv"]');
  Object.defineProperty(failedSave, "files", { configurable: true, value: [new w.File(["pdf"], "new.pdf")] });
  const saveFile = w.KII.saveFile; w.KII.saveFile = async () => false;
  await assert.rejects(form.collect(), /Could not save/); count++; w.KII.saveFile = saveFile;
  check(form.application.data.personal.files.cv[0].fileId === originalCvId, "Storage failure preserves previous upload");
  form.render("review");
  check(doc.querySelectorAll("[data-edit]").length === 9, "Every answer step has Edit link");
  check(doc.getElementById("continueBtn").disabled, "Submit disabled before accuracy confirmation");
  doc.getElementById("confirmAccurate").checked = true;
  doc.getElementById("confirmAccurate").dispatchEvent(new w.Event("change", { bubbles: true }));
  check(!doc.getElementById("continueBtn").disabled, "Submit enabled for complete confirmed application");
  doc.getElementById("continueBtn").click(); await tick();
  check(w.KII.getApplication(user.email, "idea-a").submitted, "Correct idea submitted");
  check(!w.KII.getApplication(user.email, "idea-b").submitted, "Second idea remains draft");
  check(form.application.completedSections.length === 10, "Ten-step progress on submission");
  console.log("DOM, uploads, review and submission passed");

  const legacyDom = page("application.html", "?application=legacy"), l = legacyDom.window;
  l.KII.addUser(user); l.KII.login(user.email);
  const old = { category: "Health", submitted: false, currentSection: "supporting", completedSections: ["supporting"], data: {
    instruction: { agreeApp: true, agreeFee: true }, personal: copy(data.personal),
    education: { type: "higher", entries: [{ ...education, startYear: undefined, startDate: "2022-09-01", endDate: "2025-06-01", files: { transcript_0: meta("transcript.pdf") } }] },
    supporting: { title: "Existing idea", category: "Health", role: "Founder", requirements: [{ rqItem: "Device", rqQty: 2, rqCost: 100 }], files: { cv: meta("legacy-cv.pdf") }, milestonesPlan: "Month 3: prototype" },
    video: { files: { video: meta("old.mp4", 25) } }, travel: { passportNo: "Private old value" }
  } };
  l.KII.saveApplication(user.email, old);
  l.eval(read("js/application-merged.js")); await tick();
  const migrated = l.KII.getApplication(user.email, "legacy");
  check(migrated.schemaVersion === 3 && migrated.data.innovation.title === "Existing idea", "Legacy draft migrated to the current version");
  check(migrated.data.personal.files.cv.name === "legacy-cv.pdf", "CV moved without reupload");
  check(migrated.data.personal.education[0].files.transcripts[0].name === "transcript.pdf", "Education files migrated");
  check(migrated.data.personal.education[0].startYear === "2022" && migrated.data.personal.education[0].endYear === "2025", "Existing education dates populate year controls");
  check(migrated.data.personal.education[0].startDate === "2022-09-01", "Original education date preserved in saved draft");
  check(migrated.legacyData.travel.passportNo === "Private old value", "Unmapped old answers retained in archive");
  check(!migrated.activeData.travel, "Removed questions excluded from new submission");
  check(migrated.data.support.previousMilestones.includes("Month 3"), "Old milestone text retained for conversion");

  // Nine-step (version 2) drafts move into the ten-step layout without losing answers or uploads.
  const v2Dom = page("application.html", "?application=v2"), v2 = v2Dom.window;
  v2.KII.addUser(user); v2.KII.login(user.email);
  v2.KII.saveApplication(user.email, { id: "v2", schemaVersion: 2, currentSection: "prototype", completedSections: [], status: "InProgress", startedAt: "2026-10-01T12:00:00", data: {
    instruction: { agreeApp: true, devArea: "Health" },
    personal: { ...data.personal, primaryCitizenship: "Iraq", work: "Volunteer", courses: "Python course", files: { courseCertificates: [meta("python.pdf")] } },
    innovation: { ...data.innovation, sector: "Fashion & Design", innovationType: "Software or digital" },
    team: copy(data.team),
    prototype: { technical: data.technical.technical, risks: "Sensor drift", prototypeStage: "Proof of concept", capabilities: "Measures temperature", testMethods: ["Lab or bench"], testResults: "Accurate to 0.5 degrees", builtBy: "Our team",
      prototypeNeeds: ["Funding"], needsDetail: "Parts", ipStatus: "Patent pending", ipOwner: "Me", regulatory: "No", legalEntity: "Registered company", files: { drawings: [meta("sketch.pdf")] } },
    market: copy(data.market), support: copy(data.support), statement: copy(data.statement)
  } });
  v2.eval(read("js/application-merged.js")); await tick();
  const upgraded = v2.KII.getApplication(user.email, "v2");
  check(upgraded.schemaVersion === 3 && v2.KIIMergedForm, "Version 2 draft upgraded without errors");
  check(upgraded.data.technical.prototypeStage === "Proof of concept" && upgraded.data.technical.files.drawings[0].name === "sketch.pdf", "Prototype answers and files moved to Technical Background");
  check(upgraded.data.technical.testResults.includes("Measures temperature") && upgraded.data.technical.testResults.includes("0.5 degrees"), "Earlier testing answers merged into the testing question");
  check(upgraded.data.protection.ipStatus === "Patent pending" && upgraded.data.protection.legalEntity === "Registered company", "IP and legal answers moved to Protection & Rules");
  check(upgraded.data.personal.courses[0].courseName === "Python course" && upgraded.data.personal.courses[0].files.certificate[0].name === "python.pdf", "Course text and certificates became a course row");
  check(!("primaryCitizenship" in upgraded.data.personal) && upgraded.retiredData.personal.primaryCitizenship === "Iraq", "Removed answers kept in retiredData only");
  check(upgraded.data.innovation.sector === "Other" && [].concat(upgraded.data.innovation.sectorOther).join("") === "Fashion & Design", "Discontinued sector preserved as Other (specify)");
  check(v2.location.search.includes("s=technical") || upgraded.currentSection === "technical", "Old prototype step resumes at Technical Background");
  const archived = page("application.html", "?application=legacy"), ar = archived.window;
  ar.KII.addUser(user); ar.KII.login(user.email); ar.KII.saveApplication(user.email, { ...old, submitted: true });
  ar.eval(read("js/application-merged.js")); await tick();
  check(ar.document.querySelector('script[src*="application-legacy.js"]'), "Previously submitted legacy forms remain read-only legacy records");
  check(ar.KII.getApplication(user.email, "legacy").schemaVersion === undefined, "Legacy submission not silently migrated");

  const adminDom = page("admin.html"), a = adminDom.window;
  a.KII.addUser(user); a.KII.selectApplication(user.email, "idea-b");
  for (const idea of w.KII.getApplications(user.email)) a.KII.saveApplication(user.email, idea);
  new vm.Script(read("js/ams.js") + "; window.AMSApi = { amsInit, amsSyncPortal, amsGetApplicants, amsSaveApplicants }; amsRequireStaff = () => ({id:'admin-test', name:'Admin', active:true, role:'master_admin', perms:ALL_PERMS});").runInContext(adminDom.getInternalVMContext());
  a.AMSApi.amsInit();
  let records = a.AMSApi.amsGetApplicants();
  check(records.length === 2 && records[0].id !== records[1].id, "Two AMS records for one account");
  const recordA = records.find(r => r.portalData.applicationId === "idea-a");
  check(recordA.budgetTotals.USD === 32100, "AMS totals in selected currency");
  check(recordA.uploads.some(f => f.name === "resume.pdf"), "Moved personal CV synchronized");
  check(recordA.applicationReview.length === 9, "Complete review snapshot synchronized");
  a.eval(read("js/admin.js") + ";window.AdminApi = {tabApplication, tabFinancial: tabFin, reopenPortalApplication, tabMilestones, viewTeam};");
  // Master Admin manages the sector catalogue from Team & Roles.
  const teamBody = a.document.getElementById("amsContent");
  a.AdminApi.viewTeam(teamBody);
  check(teamBody.querySelector("#sectorEditor") && teamBody.textContent.includes("Sustainable Energy"), "Sector editor shown to Master Admin with defaults");
  const addSector = teamBody.querySelector("#addSectorForm");
  Object.defineProperty(addSector, "name", { value: addSector.elements.namedItem("name") });
  addSector.name.value = "Tourism"; addSector.dispatchEvent(new a.Event("submit", { bubbles: true, cancelable: true }));
  check(a.KII.sectorNames().join() === "Health,Automation,Technology,Agriculture,Sustainable Energy,Tourism,Other", "Master Admin adds a sector");
  a.AdminApi.viewTeam(teamBody);
  const addSub = teamBody.querySelector('[data-sub-add="5"]');
  Object.defineProperty(addSub, "sub", { value: addSub.elements.namedItem("sub") });
  addSub.sub.value = "Eco-tourism"; addSub.dispatchEvent(new a.Event("submit", { bubbles: true, cancelable: true }));
  check(a.KII.subSectorNames("Tourism").join() === "Eco-tourism,Other", "Master Admin adds a sub-sector");
  a.AdminApi.viewTeam(teamBody);
  teamBody.querySelector('[data-sector-remove="0"]').click();
  check(!a.KII.sectorNames().includes("Health") && a.KII.sectorNames().includes("Tourism"), "Master Admin removes a sector");
  check(a.AMSApi.amsGetApplicants && JSON.parse(a.localStorage.getItem("kii_ams_audit") || "[]").some(e => /Sector/.test(e.action)), "Sector changes are audited");
  a.AdminApi.viewTeam(teamBody);
  teamBody.querySelector("#resetSectors").click();
  check(a.KII.sectorNames().join() === "Health,Automation,Technology,Agriculture,Sustainable Energy,Other", "Defaults can be restored");
  a.AdminApi.viewTeam(teamBody);
  a.AMSApi.amsSyncPortal();
  const staffBody = a.document.getElementById("amsContent");
  a.AdminApi.tabApplication(recordA, staffBody);
  check(staffBody.textContent.includes("Technical Background") && staffBody.textContent.includes("Protection & Rules") && staffBody.textContent.includes("resume.pdf"), "Staff sees new form and files");
  a.AdminApi.tabFinancial(recordA, staffBody);
  check(staffBody.textContent.includes("32,100 USD"), "Staff financial table shows selected currency");
  a.AdminApi.tabMilestones(recordA, staffBody);
  check(staffBody.textContent.includes("Month 3: Complete first prototype"), "Structured milestones visible to staff");
  check(a.AdminApi.reopenPortalApplication(recordA, "Revise technical details"), "Staff requests revision");
  check(!a.KII.getApplication(user.email, "idea-a").submitted && a.KII.getApplication(user.email, "idea-a").revisionNote, "Revision targets selected AMS case");
  check(!a.KII.getApplication(user.email, "idea-b").revisionNote, "Other idea unaffected by revision");
  a.AMSApi.amsSyncPortal();
  check(a.AMSApi.amsGetApplicants().find(r => r.id === recordA.id).portalData.revisionNote === "Revise technical details", "Revision resynchronized");

  const dashDom = page("dashboard.html"), dw = dashDom.window;
  dw.KII.addUser(user); dw.KII.login(user.email);
  for (const idea of w.KII.getApplications(user.email)) dw.KII.saveApplication(user.email, idea);
  dw.KII.selectApplication(user.email, "idea-a");
  new vm.Script(read("js/ams.js")).runInContext(dashDom.getInternalVMContext());
  dw.eval(read("js/dashboard.js"));
  check(dw.document.getElementById("ideaSelect").options.length === 2, "Applicant can select multiple ideas");
  check(dw.document.getElementById("progressLabel").textContent.includes("submitted"), "Selected submitted idea status");
  const selectIdea = dw.document.getElementById("ideaSelect");
  selectIdea.value = "idea-b"; selectIdea.dispatchEvent(new dw.Event("change"));
  check(dw.KII.selectedApplication(user.email) === "idea-b", "Selector changes current idea");
  check(dw.document.getElementById("progressLabel").textContent.includes("of 10"), "New drafts use ten-step progress");
  dw.KII.deleteFile = async () => {};
  dw.KII.deleteApplication(user.email, "idea-b");
  check(dw.KII.getApplications(user.email).length === 1 && dw.KII.getApplication(user.email, "idea-a").submitted, "Deleting one draft preserves other idea");
  for (const window of windows) window.close();
  console.log(`PASS: ${count} checks for merged schema, conditional UI, uploads, migration, multiple ideas, AMS synchronization, currency separation and revision routing.`);
})().catch(error => { console.error(error); windows.forEach(w => w.close()); process.exitCode = 1; });
module.exports = { user, data, application, page, tick };

if (require.main === module && process.argv.includes("--browser")) (async () => {
  const { chromium } = require("playwright"), path = require("node:path");
  const os = require("node:os");
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), "kii-browser-"));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.KII_BROWSER_CHANNEL || "chrome", headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    // Serve through request interception: no local server or user's browser storage is used.
    await context.route("http://localhost:8090/**", route => {
      const p = new URL(route.request().url()).pathname.slice(1) || "index.html", file = path.resolve(p);
      if (!file.startsWith(process.cwd() + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ contentType: p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html", body: fs.readFileSync(file) });
    });
    const app = application("browser");
    app.data.support.supportTypes = ["Financial support", "Engineering Workshop Access"];
    app.data.support.facilities = ["3D printing"];
    app.data.support.reqCurrency = "USD";
    app.data.support.requirements = [
      { rqItem: "Developer", rqType: "Manpower", rqQty: 3, rqUnit: "Month", rqCost: 700 },
      { rqItem: "Sensor", rqType: "Device", rqQty: 2, rqUnit: "Piece", rqCost: 15000 }
    ];
    await context.addInitScript(({ user, app }) => {
      if (localStorage.getItem("kii_session")) return;
      localStorage.setItem("kii_users", JSON.stringify([user]));
      localStorage.setItem("kii_session", user.email);
      localStorage.setItem("kii_app_" + user.email + "::browser", JSON.stringify(app));
      localStorage.setItem("kii_selected_" + user.email, "browser");
    }, { user, app });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://localhost:8090/application.html?application=browser&s=personal");
    await page.waitForFunction(() => !!window.KIIMergedForm);
    const personal = page.locator("#sectionBody");
    async function choose(root, key, query, option) {
      const field = root.locator(`:scope > [data-field="${key}"]`);
      await field.locator("input").fill(query);
      await field.getByRole("option", { name: option, exact: true }).click();
    }
    await choose(personal, "city", "sulay", "Sulaimani");
    assert.equal(await page.locator('[data-key="postal"]').inputValue(), "46001");
    await page.locator('[data-key="postal"]').fill("46002");
    await page.locator('[data-date="Year"]').fill("2004");
    await page.locator('[data-date="Month"]').fill("02");
    await page.locator('[data-date="Day"]').fill("29");
    await page.locator('[data-key="educationType"]').selectOption("Higher Education");
    const row = page.locator('[data-field="education"] .merged-row').first();
    await choose(row, "city", "erb", "Erbil");
    await choose(row, "institution", "hawler", "Hawler Medical University");
    await row.locator('[data-key="level"]').selectOption("Bachelor");
    await row.locator('[data-key="fieldOfStudy"]').selectOption("Health & Medicine");
    await row.locator('[data-key="startYear"]').fill("2022");
    await row.locator('[data-key="startYear"]').press("ArrowDown");
    await row.locator('[data-key="startYear"]').press("Enter");
    await row.locator('[data-key="currentlyStudying"]').check();
    assert.equal(await row.locator('[data-field="endYear"]').isVisible(), false);
    await page.locator('[data-key="linkedIn"]').fill("https://www.instagram.com/example");
    await page.locator('[data-key="email"]').fill("bad..email@example.org");
    await page.click("#continueBtn");
    assert.match(await page.locator("#alert").innerText(), /valid email/);
    await page.locator('[data-key="email"]').fill(user.email);
    await page.click("#continueBtn");
    await page.waitForFunction(() => location.search.includes("s=innovation"));
    await page.goto("http://localhost:8090/application.html?application=browser&s=personal");
    await page.waitForFunction(() => !!window.KIIMergedForm);
    assert.equal(await page.locator('[data-key="postal"]').inputValue(), "46002");
    assert.equal(await row.locator('[data-key="institution"]').inputValue(), "Hawler Medical University");
    const saved = await page.evaluate(() => window.KIIMergedForm.application);
    assert.equal(saved.data.personal.birthDate, "2004-02-29");
    assert.equal(saved.activeData.personal.education[0].startYear, "2022");
    assert.equal("endYear" in saved.activeData.personal.education[0], false);
    assert.match(JSON.stringify(saved.reviewSections), /Online profile or website/);
    await page.locator('[data-date="Year"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(artifacts, "personal-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-date="Year"]').scrollIntoViewIfNeeded();
    await page.locator('[data-date="Year"]').click();
    await page.screenshot({ path: path.join(artifacts, "personal-mobile.png") });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Personal Background fits mobile viewport");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://localhost:8090/application.html?application=browser&s=support");
    await page.waitForFunction(() => !!window.KIIMergedForm);
    assert.equal(await page.locator("#stepLabel").textContent(), "Step 8 of 10");
    assert.match(await page.locator(".budget-totals").innerText(), /32,100 USD/);
    await page.screenshot({ path: path.join(artifacts, "support-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, "support-mobile.png"), fullPage: true });
    const widthCheck = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll("body *")].filter(el => el.getBoundingClientRect().right > innerWidth && !el.closest("table")).slice(0, 8).map(el => [el.tagName, el.className, el.getBoundingClientRect().right]) }));
    assert.ok(widthCheck.scroll <= widthCheck.width, "Mobile page fits viewport: " + JSON.stringify(widthCheck));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("http://localhost:8090/application.html?application=browser&s=statement");
    // CC0 sample: https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4
    const sample = "tests/fixtures/statement.mp4";
    const media = { size: fs.statSync(sample).size };
    await page.locator('[data-key="video"]').setInputFiles(sample);
    await page.click("#saveBtn");
    await page.waitForFunction(() => location.pathname.endsWith("dashboard.html") || !document.getElementById("alert")?.classList.contains("hidden"));
    if (!page.url().endsWith("dashboard.html")) throw Error("Video save: " + await page.locator("#alert").textContent());
    const file = await page.evaluate(() => JSON.parse(localStorage.getItem("kii_app_test@example.org::browser")).data.statement.files.video[0]);
    assert.ok(file.duration > 0 && file.duration <= 60);
    const stored = await page.evaluate(async id => {
      const request = indexedDB.open("kii_db", 1);
      const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      return await new Promise(resolve => {
        const req = db.transaction("files").objectStore("files").get(id);
        req.onsuccess = () => resolve({ size: req.result.size, type: req.result.type });
      });
    }, file.fileId);
    assert.equal(stored.size, media.size); assert.equal(stored.type, "video/mp4");
    assert.deepEqual(errors, []);
    console.log(`PASS: searchable personal/education fields, keyboard selection, typed birth date, postal override, email validation, saved drafts, Chromium desktop/mobile, real MP4 (${file.duration.toFixed(2)} sec); no browser errors.`);
  } finally {
    await browser?.close();
    fs.rmSync(artifacts, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
