/* Legacy 14-section wizard: retained for viewing previously submitted/withdrawn applications. */

const user = KII.requireAuth();
let app = user ? KII.getApplication(user.email, new URLSearchParams(location.search).get("application") || undefined) : null;
if (user && !app) window.location.href = "dashboard.html";

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = KII.escapeHtml;
const v = (d, k) => esc(d?.[k] ?? "");
const today = KII.today;
const validDate = KII.validDate;
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
const validPhone = value => /^[+\d\s().-]+$/.test(value || "") &&
  String(value).replace(/\D/g, "").length >= 7 && String(value).replace(/\D/g, "").length <= 15;
function accountPhone() {
  const match = String(user.phone || "").match(/^(\+\d{1,3})(?:\s*\([^)]*\))?\s*(.*)$/);
  return { phoneCode: match?.[1] || "", phone: match?.[2] || "" };
}
function postalError(country, postal) {
  if (!postal) return null;
  const patterns = {
    iraq: /^\d{5}$/, "العراق": /^\d{5}$/, "عێراق": /^\d{5}$/,
    "united states": /^\d{5}(-\d{4})?$/, usa: /^\d{5}(-\d{4})?$/,
    canada: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i,
    "united kingdom": /^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|GIR ?0AA)$/i,
    turkey: /^\d{5}$/, "saudi arabia": /^\d{5}(-\d{4})?$/,
    iran: /^\d{10}$/
  };
  const pattern = patterns[String(country).trim().toLowerCase()] || /^[A-Z\d][A-Z\d -]{1,11}$/i;
  return pattern.test(postal.trim()) ? null : "Please enter a valid postal-code format for your country, or leave it empty if not applicable.";
}
function completionParts(d) {
  if (d.completionValue) return { value: d.completionValue, unit: d.completionUnit || "Month" };
  const match = String(d.estCompletion || "").trim().match(/^(\d+)\s*(day|week|month|year)s?$/i);
  return match ? { value: match[1], unit: match[2][0].toUpperCase() + match[2].slice(1).toLowerCase() } : { value: "", unit: "Month" };
}
const fileList = value => Array.isArray(value) ? value : value ? [value] : [];
function videoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video"), url = URL.createObjectURL(file);
    const finish = (error, duration) => {
      clearTimeout(timer); video.onloadedmetadata = null; video.onerror = null;
      video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url);
      error ? reject(new Error(error)) : resolve(duration);
    };
    const timer = setTimeout(() => finish("Could not read the video. Please upload an MP4 or WebM video."), 15000);
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? null : "Could not read the video duration.", video.duration);
    video.onerror = () => finish("Could not read the video. Please upload an MP4 or WebM video.");
    video.src = url;
  });
}

function collectForm(body) {
  const data = {};
  const els = $$("input,select,textarea", body).filter(e => e.name);
  const names = [...new Set(els.map(e => e.name))];
  names.forEach(n => {
    const group = els.filter(e => e.name === n);
    const first = group[0];
    if (first.type === "checkbox") {
      data[n] = group.length > 1
        ? group.filter(g => g.checked).map(g => g.value)
        : group[0].checked;
    } else if (first.type === "radio") {
      const c = group.find(g => g.checked);
      data[n] = c ? c.value : "";
    } else if (first.type !== "file") {
      data[n] = first.value.trim();
    }
  });
  return data;
}

async function collectFiles(body, prevData) {
  const data = {};
  for (const el of $$('input[type="file"][data-store]', body)) {
    const key = el.dataset.store;
    const selected = Array.from(el.files || []);
    if (selected.length) {
      if (el.multiple && selected.length > 10) throw new Error("Please select up to 10 files per upload field.");
      const metas = [];
      for (const input of selected) {
        if (el.multiple && input.size > 20 * 1024 * 1024) throw new Error("Each certificate or supporting document must be 20 MB or smaller.");
        // New file picked — store bytes in IndexedDB, keep only metadata in localStorage
        const fileId = `${user.email}/${currentId}/${key}/${crypto.randomUUID()}`;
        const meta = { name: input.name, size: input.size, type: input.type };
        if (currentId === "video" && key === "video") {
          meta.duration = await videoDuration(input);
          if (meta.duration > 30) throw new Error("Your self-promotion video must be 30 seconds or shorter.");
        }
        if (await KII.saveFile(fileId, input)) {
          meta.fileId = fileId;
        } else {
          throw new Error(`Could not save "${input.name}". Please free browser storage and try again.`);
        }
        metas.push(meta);
      }
      data[key] = el.multiple ? metas : metas[0];
    } else {
      const prev = prevData?.[key] || prevData?.files?.[key] || null;
      data[key] = prev;
    }
  }
  return data;
}

function fileInput(storeKey, label, accept, existing, multiple = false) {
  const saved = fileList(existing).map(f => f.name).filter(Boolean);
  return `
    <div class="field">
      <label>${label}</label>
      <label class="file-drop">
        <input type="file" data-store="${storeKey}" ${multiple ? "multiple" : ""} ${accept ? `accept="${accept}"` : ""}>
        ${multiple ? "Choose up to 10 files (20 MB each). Selecting files replaces this field’s previous uploads." : "Click to upload a file"}
        <span class="file-name">${saved.length ? "Saved: " + esc(saved.join(", ")) : ""}</span>
      </label>
    </div>`;
}

function opt(list, cur) {
  return `<option value="">Select…</option>` + list.map(o =>
    `<option value="${esc(o)}" ${o === cur ? "selected" : ""}>${esc(o)}</option>`).join("");
}

/* ---------- section definitions ---------- */

const EDU_LEVELS = ["Diploma", "Bachelor", "Master", "PhD", "Other"];
const PROJECT_CATS = ["Health", "Education", "Automation", "Renewable Energy", "Computer and AI", "Fashion"];
const ROLES = ["Founder", "Co-Founder", "Member", "Other"];
const WORK_DURATIONS = ["Less than 6 months", "6–12 months", "1–2 years", "More than 2 years"];
const INNOVATION_FIELDS = ["Humanitarian", "Agriculture", "Cyber Security", "Environment", "Technology", "Health Tech", "Education Tech", "Other"];
const LEGAL_AREAS = ["Intellectual Property", "Data Privacy", "Health Regulation", "Energy Regulation", "Business & Trade", "Not sure yet", "Other"];
const STAGES = ["Idea / Concept", "Prototype", "Testing / Pilot", "Launched", "Scaling"];
const INTERESTS = ["Artificial Intelligence", "Robotics", "Biotechnology", "Clean Energy", "Materials Science", "Data Science", "Sustainable Design", "Medical Innovation", "Smart Agriculture", "Other"];
const EXAM_TYPES = ["IELTS", "TOEFL", "Duolingo English Test", "SAT", "GRE", "Other", "None"];
const HEARD_FROM = ["Social media", "Friend or family", "University / School", "KII website", "Event or workshop", "Other"];
/* Technology Readiness Levels (international TRL 1–9 scale, used by OIST, EU EIC, NASA) */
const TRL_LEVELS = [
  "TRL 1 – Basic principles observed", "TRL 2 – Technology concept formulated",
  "TRL 3 – Experimental proof of concept", "TRL 4 – Validated in the lab",
  "TRL 5 – Validated in a relevant environment", "TRL 6 – Demonstrated in a relevant environment",
  "TRL 7 – Prototype demonstrated in real conditions", "TRL 8 – System complete and qualified",
  "TRL 9 – Proven in operation / on the market"];
const IP_STATUS = ["No IP protection yet", "Patent planned", "Patent filed / pending", "Patent granted",
  "Trade secret / know-how", "Copyright / design registration", "Open source", "Not applicable"];
const LEGAL_ENTITY = ["Not registered yet (individual / team)", "Registration in progress", "Registered company",
  "NGO / non-profit", "University or research spin-off"];
const BUSINESS_MODELS = ["B2B – selling to businesses", "B2C – selling to consumers", "B2G – selling to government",
  "Licensing the technology", "Subscription / SaaS", "Marketplace / platform", "Non-profit / grant-funded", "Other"];
const SDGS = ["1 No Poverty", "2 Zero Hunger", "3 Good Health", "4 Quality Education", "5 Gender Equality",
  "6 Clean Water", "7 Clean Energy", "8 Decent Work & Growth", "9 Industry & Innovation", "10 Reduced Inequalities",
  "11 Sustainable Cities", "12 Responsible Consumption", "13 Climate Action", "14 Life Below Water",
  "15 Life on Land", "16 Peace & Justice", "17 Partnerships"];

const SECTIONS = [

  /* ============ 1. INSTRUCTION ============ */
  {
    id: "instruction",
    title: "Instruction",
    head: "Application Instructions",
    sub: "Please read and accept both sections before continuing.",
    render(body, d) {
      body.innerHTML = `
        <div class="agree-box">
          <div class="agree-head">Application</div>
          <div class="agree-body">
            <p>By submitting an application to the KII Innovation Program, you confirm that all
            information provided is accurate and complete to the best of your knowledge.
            You agree that the program committee may verify any details, documents and
            credentials you submit. Providing false or misleading information may result in
            the rejection of your application or removal from the program.</p>
            <p class="mt-1">You may save your progress at any time and return later to complete
            the remaining sections before submitting.</p>
          </div>
          <label class="agree-check">
            <input type="checkbox" name="agreeApp" ${d.agreeApp ? "checked" : ""}>
            I have read and agree to the Application terms.
          </label>
        </div>

        <div class="agree-box">
          <div class="agree-head">Confirmation Fee</div>
          <div class="agree-body">
            <p>A non-refundable confirmation fee may be required to confirm your place in the
            program once your application is accepted. Fee details, payment methods and
            deadlines will be communicated to you by email after the review of your
            application is complete.</p>
            <p class="mt-1">The confirmation fee is separate from any tuition or program costs
            and cannot be refunded once paid.</p>
          </div>
          <label class="agree-check">
            <input type="checkbox" name="agreeFee" ${d.agreeFee ? "checked" : ""}>
            I have read and agree to the Confirmation Fee terms.
          </label>
        </div>`;
    },
    validate(d) {
      if (!d.agreeApp || !d.agreeFee)
        return "Please tick both agreement boxes to continue.";
      return null;
    },
  },

  /* ============ 2. PERSONAL BACKGROUND ============ */
  {
    id: "personal",
    title: "Personal Background",
    head: "Personal Background",
    sub: "Tell us who you are and how to reach you.",
    render(body, d) {
      d = { ...accountPhone(), ...d };
      d.phone = String(d.phone || "").replace(/^\([^)]*\)\s*/, "");
      body.innerHTML = `
        <h3>Name</h3>
        <div class="grid-3">
          <div class="field"><label>First Name <span class="req">*</span></label>
            <input type="text" name="firstName" value="${v(d, "firstName")}"></div>
          <div class="field"><label>Second Name <span class="req">*</span></label>
            <input type="text" name="secondName" value="${v(d, "secondName")}"></div>
          <div class="field"><label>Third Name <span class="req">*</span></label>
            <input type="text" name="thirdName" value="${v(d, "thirdName")}"></div>
        </div>
        <div class="hint mb-2">Please write your name exactly as it appears in your passport.</div>

        <h3>Address</h3>
        <div class="grid-2">
          <div class="field"><label>Country <span class="req">*</span></label>
            <input type="text" name="country" list="countryList" value="${v(d, "country")}" placeholder="Type to search…"></div>
          <div class="field"><label>Street <span class="req">*</span></label>
            <input type="text" name="street" value="${v(d, "street")}"></div>
          <div class="field"><label>City <span class="req">*</span></label>
            <input type="text" name="city" value="${v(d, "city")}"></div>
          <div class="field"><label>Region / State</label>
            <input type="text" name="region" value="${v(d, "region")}"></div>
          <div class="field"><label>Postal Code</label>
            <input type="text" name="postal" maxlength="12" value="${v(d, "postal")}">
            <div class="hint">Optional. Iraqi postal codes have 5 digits. Enter your country’s postal-code format; this does not verify the address.</div></div>
        </div>

        <h3>Email</h3>
        <div class="field"><label>Email Address <span class="req">*</span></label>
          <input type="email" name="email" value="${v(d, "email")}">
          <div class="hint">Please use an email address that will remain unchanged throughout the
          admissions process. Please avoid using academic or institution-provided email that may expire.</div>
        </div>

        <h3>Phone Number</h3>
        <div class="field"><label>Phone <span class="req">*</span></label>
          <div class="phone-row">
            <select name="phoneCode" class="code"></select>
            <input type="tel" name="phone" value="${v(d, "phone")}" placeholder="e.g. 555 123 456">
          </div>
          <div class="hint">Prefilled from your account — update only if it has changed. Please use a number with WhatsApp.</div>
        </div>

        <h3>Biographical Information</h3>
        <div class="grid-2">
          <div class="field"><label>Gender <span class="req">*</span></label>
            <select name="gender">${opt(["Male", "Female", "Prefer not to say"], d.gender)}</select></div>
          <div class="field"><label>Birth Date <span class="req">*</span></label>
            <input type="date" name="birthDate" max="${today()}" value="${v(d, "birthDate")}"></div>
        </div>

        <h3>Citizenship Information</h3>
        <div class="grid-2">
          <div class="field"><label>Primary Citizenship <span class="req">*</span></label>
            <input type="text" name="primaryCitizenship" list="countryList" value="${v(d, "primaryCitizenship")}" placeholder="Type to search…"></div>
          <div class="field"><label>Dual Citizenship <span class="muted">(optional)</span></label>
            <input type="text" name="dualCitizenship" list="countryList" value="${v(d, "dualCitizenship")}" placeholder="Type to search…"></div>
        </div>`;

      const codeSel = $('[name="phoneCode"]', body);
      fillCountryCodes(codeSel);
      if (d.phoneCode) codeSel.value = Array.from(codeSel.options).find(option =>
        option.value.split(" ")[0] === d.phoneCode.split(" ")[0])?.value || "";
    },
    validate(d) {
      const req = ["firstName", "secondName", "thirdName", "country", "street", "city",
        "email", "phoneCode", "phone", "gender", "birthDate", "primaryCitizenship"];
      if (req.some(k => !d[k])) return "Please complete all required fields.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return "Please enter a valid email address.";
      if (!validDate(d.birthDate) || d.birthDate >= today()) return "Birth date must be a valid date before today.";
      if (!validPhone(d.phoneCode.split(" ")[0] + " " + d.phone)) return "Please enter a valid phone number with country code (7–15 digits).";
      if (postalError(d.country, d.postal)) return postalError(d.country, d.postal);
      return null;
    },
  },

  /* ============ 3. EDUCATION HISTORY ============ */
  {
    id: "education",
    title: "Education History",
    head: "Education History",
    sub: "Select your highest level of education.",
    render(body, d) {
      const type = d.type || "";
      body.innerHTML = `
        <label class="radio-line">
          <input type="radio" name="type" value="highschool" ${type === "highschool" ? "checked" : ""}>
          <span><strong>High School or lower</strong><br>
          <span class="muted">You completed high school or an earlier level.</span></span>
        </label>
        <label class="radio-line">
          <input type="radio" name="type" value="higher" ${type === "higher" ? "checked" : ""}>
          <span><strong>Higher Education</strong><br>
          <span class="muted">Diploma, Bachelor, Master, PhD or other post-secondary education.</span></span>
        </label>
        <div id="eduDetails"></div>`;

      const details = $("#eduDetails", body);

      let eduSeq = 0; // unique index per block so file keys never collide after add/remove
      let higherFields = null;
      function renderDetails(t, entries) {
        if (t === "highschool") {
          details.innerHTML = `
            <div class="repeat-block mt-2">
              <div class="block-title">High School (optional)</div>
              <div class="field"><label>School Name</label>
                <input type="text" name="hsSchool" value="${v(d, "hsSchool")}"></div>
            </div>`;
        } else if (t === "higher") {
          if (higherFields) {
            details.replaceChildren(higherFields);
            higherFields = null;
            return;
          }
          details.innerHTML = `<div id="eduBlocks"></div>
            <button type="button" class="btn btn-secondary btn-sm" id="addEdu">+ Add another education</button>`;
          const blocks = $("#eduBlocks", details);
          const list = entries && entries.length ? entries : [{}];
          list.forEach((e) => blocks.appendChild(eduBlock(e, e.idx ?? eduSeq)));
          $("#addEdu", details).addEventListener("click", () => blocks.appendChild(eduBlock({}, eduSeq)));
        } else {
          details.innerHTML = "";
        }
      }

      function eduBlock(e, i) {
        eduSeq = Math.max(eduSeq, i + 1);
        const div = document.createElement("div");
        div.className = "repeat-block edu-block mt-2";
        div.dataset.idx = i;
        const n = $$(".edu-block", details).length;
        div.innerHTML = `
          <div class="block-title">Education ${n + 1}</div>
          ${n > 0 ? '<button type="button" class="remove-block">Remove</button>' : ""}
          <div class="grid-2">
            <div class="field"><label>Degree Level <span class="req">*</span></label>
              <select name="level">${opt(EDU_LEVELS, e.level)}</select></div>
            <div class="field degree-other"><label>Specify degree <span class="req">*</span></label>
              <input type="text" name="levelOther" value="${v(e, "levelOther")}"></div>
            <div class="field"><label>Institution <span class="req">*</span></label>
              <input type="text" name="institution" value="${v(e, "institution")}"></div>
            <div class="field"><label>Field of Study <span class="req">*</span></label>
              <input type="text" name="fieldOfStudy" value="${v(e, "fieldOfStudy")}"></div>
            <div class="field"><label>Country <span class="req">*</span></label>
              <input type="text" name="country" list="countryList" value="${v(e, "country")}" placeholder="Type to search…"></div>
            <div class="field"><label>City <span class="req">*</span></label>
              <input type="text" name="city" value="${v(e, "city")}"></div>
            <div class="field"><label>Start Date <span class="req">*</span></label>
              <input type="date" name="startDate" max="${today()}" value="${v(e, "startDate")}"></div>
            <div class="field education-end"><label>End Date <span class="req">*</span></label>
              <input type="date" name="endDate" max="${today()}" value="${v(e, "endDate")}"></div>
          </div>
          <label class="checkbox-line"><input type="checkbox" name="currentlyStudying" ${e.currentlyStudying ? "checked" : ""}> Currently studying here</label>
          ${fileInput("transcript_" + i, "Transcripts / Certificates (optional)", ".pdf,.jpg,.jpeg,.png", e.files && e.files["transcript_" + i], true)}`;
        const updateEducationFields = () => {
          const other = $('[name="level"]', div).value === "Other";
          $(".degree-other", div).classList.toggle("hidden", !other);
          $('[name="levelOther"]', div).required = other;
          const current = $('[name="currentlyStudying"]', div).checked;
          $(".education-end", div).classList.toggle("hidden", current);
          $('[name="endDate"]', div).disabled = current;
          $('[name="endDate"]', div).required = !current;
        };
        $('[name="level"]', div).addEventListener("change", updateEducationFields);
        $('[name="currentlyStudying"]', div).addEventListener("change", updateEducationFields);
        updateEducationFields();
        const rm = $(".remove-block", div);
        if (rm) rm.addEventListener("click", () => div.remove());
        return div;
      }

      $$('input[name="type"]', body).forEach(r =>
        r.addEventListener("change", () => {
          if ($("#eduBlocks", details)) {
            higherFields = document.createDocumentFragment();
            while (details.firstChild) higherFields.appendChild(details.firstChild);
          } else if ($('[name="hsSchool"]', details)) {
            d.hsSchool = $('[name="hsSchool"]', details).value;
          }
          renderDetails(r.value, d.entries);
        }));
      renderDetails(type, d.entries);
    },
    collect(body, prev) {
      const typeEl = $('input[name="type"]:checked', body);
      const base = { type: typeEl ? typeEl.value : "", hsSchool: $('[name="hsSchool"]', body)?.value.trim() || prev?.hsSchool || "" };
      const prevFiles = Object.assign({}, ...(prev?.entries || []).map(e => e.files || {}));
      return (async () => {
        const entries = [];
        for (const b of $$(".edu-block", body)) {
          const entry = collectForm(b);
          if (entry.currentlyStudying) entry.endDate = "";
          entries.push({ ...entry, idx: +b.dataset.idx, files: await collectFiles(b, prevFiles) });
        }
        return { ...base, entries: base.type === "higher" ? entries : (prev?.entries || []) };
      })();
    },
    validate(d) {
      if (!d.type) return "Please select your education level.";
      if (d.type === "higher") {
        const list = d.entries || [];
        if (!list.length) return "Please add at least one higher education entry.";
        for (const [i, e] of list.entries()) {
          if (!e.level || !e.institution || !e.fieldOfStudy || !e.country || !e.city || !e.startDate || (!e.currentlyStudying && !e.endDate))
            return `Please complete all required fields for Education ${i + 1}.`;
          if (e.level === "Other" && !e.levelOther?.trim()) return `Education ${i + 1}: please specify your degree.`;
          if (!validDate(e.startDate) || e.startDate > today()) return `Education ${i + 1}: start date must be a valid date on or before today.`;
          if (!e.currentlyStudying) {
            if (!validDate(e.endDate) || e.endDate > today()) return `Education ${i + 1}: end date cannot be in the future. Select “Currently studying here” if applicable.`;
            if (e.endDate < e.startDate) return `Education ${i + 1}: end date cannot be before the start date.`;
          }
        }
      }
      return null;
    },
  },

  /* ============ 4. SUPPORTING & PROJECT INFORMATION ============ */
  {
    id: "supporting",
    title: "Supporting Information",
    head: "Supporting and Project Information",
    sub: "Tell us about your innovation project.",
    render(body, d) {
      const completion = completionParts(d);
      body.innerHTML = `
        <div class="grid-2">
          <div class="field"><label>Project Category <span class="req">*</span></label>
            <select name="category">${opt(PROJECT_CATS, d.category || app.category)}</select></div>
          <div class="field"><label>Project Title <span class="req">*</span> <span class="muted">(max 30 characters)</span></label>
            <input type="text" name="title" maxlength="30" value="${v(d, "title")}">
            <div class="char-count"><span id="titleCount">${(d.title || "").length}</span>/30</div></div>
        </div>
        <div class="field"><label>Explain your project <span class="req">*</span></label>
          <textarea name="explain" placeholder="Describe your project, its goals and how it works.">${v(d, "explain")}</textarea></div>

        <div class="grid-2">
          <div class="field"><label>Your role in the innovation <span class="req">*</span></label>
            <select name="role">${opt(ROLES, d.role)}</select></div>
          <div class="field" id="roleDetails"><label>Specify your role / responsibilities <span class="req">*</span></label>
            <input type="text" name="roleOther" value="${v(d, "roleOther")}"></div>
        </div>
        <div class="hint mb-2">Member means a contributor who is not a founder or co-founder. Members and applicants selecting Other must describe their responsibilities.</div>

        <h3>Other Project Participants <span class="muted">(if any)</span></h3>
        <div class="hint mb-2">List other founders, co-founders or contributors; do not repeat yourself. Choose your own role above. A founder may be listed here when a co-founder or member submits the application.</div>
        <div id="teamBlocks"></div>
        <button type="button" class="btn btn-secondary btn-sm" id="addTeam">+ Add team member</button>

        <div class="grid-2 mt-2">
          <div class="field"><label>How long have you worked on this project? <span class="req">*</span></label>
            <select name="workDuration">${opt(WORK_DURATIONS, d.workDuration)}</select></div>
          <div class="field"><label>Estimated time to complete <span class="req">*</span></label>
            <div class="phone-row"><input type="number" name="completionValue" min="1" step="1" value="${esc(completion.value)}" aria-label="Completion duration">
              <select name="completionUnit" aria-label="Completion duration unit">${opt(["Day", "Week", "Month", "Year"], completion.unit)}</select></div>
            ${(d.estCompletion || d.previousEstCompletion) && !completion.value ? `<div class="hint">Previous answer: ${esc(d.estCompletion || d.previousEstCompletion)}. Please convert it to a number and unit.</div>` : ""}</div>
        </div>

        <div class="field"><label>Field of innovation <span class="req">*</span></label>
          <select name="innovationField">${opt(INNOVATION_FIELDS, d.innovationField)}</select></div>

        <div class="field"><label>What problem does your project solve? <span class="req">*</span></label>
          <textarea name="problem">${v(d, "problem")}</textarea></div>

        <div class="field"><label>Who benefits from this project? <span class="req">*</span></label>
          <input type="text" name="beneficiaries" value="${v(d, "beneficiaries")}" placeholder="e.g. rural farmers, students, hospitals…"></div>

        <div class="field"><label>What is the innovation point in your idea? <span class="req">*</span></label>
          <textarea name="innovationPoint" placeholder="What makes your idea new, different or better than existing solutions?">${v(d, "innovationPoint")}</textarea></div>

        <div class="field"><label>Could your idea become a business? <span class="req">*</span></label>
          <label class="radio-line"><input type="radio" name="businessPotential" value="Yes" ${d.businessPotential === "Yes" ? "checked" : ""}> Yes, it has clear business potential</label>
          <label class="radio-line"><input type="radio" name="businessPotential" value="Maybe" ${d.businessPotential === "Maybe" ? "checked" : ""}> Maybe / not sure yet</label>
          <label class="radio-line"><input type="radio" name="businessPotential" value="No" ${d.businessPotential === "No" ? "checked" : ""}> No, it is not a business idea</label>
          <input type="text" name="businessDetail" value="${v(d, "businessDetail")}" placeholder="Briefly explain how it could work as a business" class="mt-1">
        </div>

        <h3>Financial Support &amp; Requirements <span class="req">*</span></h3>
        <div class="hint mb-2">List every item you need support for — equipment, manpower, devices,
          software, materials… — with the estimated cost of each. Press <b>+</b> to add another request.</div>
        <div class="req-table-wrap"><table class="req-table">
          <thead><tr>
            <th style="width:32px">#</th><th>Item <span class="req">*</span></th><th style="width:140px">Type</th>
            <th style="width:64px">Qty</th><th style="width:105px">Unit</th>
            <th style="width:105px">Cost per unit ($) <span class="req">*</span></th>
            <th>Purpose / notes</th><th style="width:38px"></th>
          </tr></thead>
          <tbody id="reqBlocks"></tbody>
          <tfoot><tr>
            <td colspan="5" class="req-total-label">Estimated total cost</td>
            <td class="req-total-val" id="reqTotal">$0</td><td colspan="2"></td>
          </tr></tfoot>
        </table></div>
        <button type="button" class="req-add" id="addReq"><span class="req-add-plus">+</span> Add another request</button>

        <div class="grid-2">
          <div class="field"><label>Legal &amp; Regulatory focus area <span class="req">*</span></label>
            <select name="legalFocus">${opt(LEGAL_AREAS, d.legalFocus)}</select></div>
          <div class="field"><label>Current stage of your innovation <span class="req">*</span></label>
            <select name="stage">${opt(STAGES, d.stage)}</select></div>
        </div>

        <div class="field"><label>Has this innovation been implemented anywhere? <span class="req">*</span></label>
          <label class="radio-line"><input type="radio" name="implemented" value="Yes" ${d.implemented === "Yes" ? "checked" : ""}> Yes</label>
          <label class="radio-line"><input type="radio" name="implemented" value="No" ${d.implemented === "No" ? "checked" : ""}> No</label>
          <input type="text" name="implementedWhere" value="${v(d, "implementedWhere")}" placeholder="If yes, where?" class="mt-1">
        </div>

        <h3>Technology Readiness &amp; Intellectual Property</h3>
        <div class="field"><label>Technology Readiness Level (TRL) <span class="req">*</span></label>
          <select name="trl">${opt(TRL_LEVELS, d.trl)}</select>
          <div class="hint">Choose the level that best describes where your technology is today.</div></div>
        <div class="grid-2">
          <div class="field"><label>Intellectual property status <span class="req">*</span></label>
            <select name="ipStatus">${opt(IP_STATUS, d.ipStatus)}</select></div>
          <div class="field"><label>Who owns the IP?</label>
            <input type="text" name="ipOwner" value="${v(d, "ipOwner")}" placeholder="e.g. me, our team, my university, my employer"></div>
          <div class="field"><label>Legal entity status <span class="req">*</span></label>
            <select name="legalEntity">${opt(LEGAL_ENTITY, d.legalEntity)}</select></div>
          <div class="field"><label>Other funding or awards received</label>
            <input type="text" name="otherFunding" value="${v(d, "otherFunding")}" placeholder="Source, amount and year — or 'None'"></div>
        </div>

        <h3>Market &amp; Business</h3>
        <div class="field"><label>Who are your target customers or users? <span class="req">*</span></label>
          <textarea name="targetCustomers" placeholder="Describe the customers, their need, and how many there are (market size).">${v(d, "targetCustomers")}</textarea></div>
        <div class="field"><label>Existing alternatives / competitors, and your advantage <span class="req">*</span></label>
          <textarea name="competitors" placeholder="Who else solves this problem today? Why is your solution better?">${v(d, "competitors")}</textarea></div>
        <div class="grid-2">
          <div class="field"><label>Business model</label>
            <select name="businessModel">${opt(BUSINESS_MODELS, d.businessModel)}</select></div>
          <div class="field"><label>Traction so far</label>
            <input type="text" name="traction" value="${v(d, "traction")}" placeholder="Users, pilots, letters of intent, revenue…"></div>
        </div>
        <div class="field"><label>Key milestones for the next 12 months <span class="req">*</span></label>
          <textarea name="milestonesPlan" placeholder="One milestone per line, with target month — e.g. 'Month 3: working prototype'">${v(d, "milestonesPlan")}</textarea></div>
        <div class="field"><label>UN Sustainable Development Goals your project supports <span class="muted">(optional)</span></label>
          <div class="sdg-grid">${SDGS.map(g => `<label class="checkbox-line"><input type="checkbox" name="sdgs" value="${esc(g)}"
            ${(d.sdgs || []).includes(g) ? "checked" : ""}> ${esc(g)}</label>`).join("")}</div></div>

        <h3>Documents</h3>
        ${fileInput("pitchDeck", "Pitch deck or business plan <span class='muted'>(recommended, PDF)</span>", ".pdf,.ppt,.pptx", d.files?.pitchDeck)}
        ${fileInput("cv", "CV / Resume <span class='req'>*</span>", ".pdf,.doc,.docx", d.files?.cv)}
        ${fileInput("photo", "Photograph <span class='req'>*</span>", "image/*", d.files?.photo)}
        ${fileInput("studentId", "Valid Student ID or Certificate (if student)", ".pdf,image/*", d.files?.studentId)}`;

      $('[name="title"]', body).addEventListener("input", (e) => {
        $("#titleCount", body).textContent = e.target.value.length;
      });
      const updateRole = () => {
        const needsDetails = ["Member", "Other"].includes($('[name="role"]', body).value);
        $("#roleDetails", body).classList.toggle("hidden", !needsDetails);
        $('[name="roleOther"]', body).required = needsDetails;
      };
      $('[name="role"]', body).addEventListener("change", updateRole);
      updateRole();

      const teamWrap = $("#teamBlocks", body);
      function teamBlock(m, i) {
        const div = document.createElement("div");
        div.className = "repeat-block team-block";
        div.innerHTML = `
          <div class="block-title">Project Participant ${i + 1}</div>
          <button type="button" class="remove-block">Remove</button>
          <div class="grid-3">
            <div class="field"><label>Full Name <span class="req">*</span></label>
              <input type="text" name="tmName" value="${v(m, "tmName")}"></div>
            <div class="field"><label>Email</label>
              <input type="email" name="tmEmail" value="${v(m, "tmEmail")}"></div>
            <div class="field"><label>Phone (with country code)</label>
              <input type="tel" name="tmPhone" value="${v(m, "tmPhone")}" placeholder="+964 …"></div>
            <div class="field"><label>Role / position</label>
              <input type="text" name="tmRole" value="${v(m, "tmRole")}" placeholder="Founder, Co-Founder, Designer…"></div>
            <div class="field"><label>Responsibilities</label>
              <textarea name="tmResponsibilities" rows="2">${v(m, "tmResponsibilities")}</textarea></div>
          </div>`;
        $(".remove-block", div).addEventListener("click", () => div.remove());
        return div;
      }
      (d.team || []).forEach((m, i) => teamWrap.appendChild(teamBlock(m, i)));
      $("#addTeam", body).addEventListener("click", () =>
        teamWrap.appendChild(teamBlock({}, $$(".team-block", teamWrap).length)));

      /* ---- requirements / cost list ---- */
      const REQ_TYPES = ["Equipment", "Manpower", "Device", "Software / subscription",
        "Material", "Venue / space", "Training", "Other"];
      const UNIT_OPTIONS = {
        "Equipment": ["Piece", "Set", "Unit"],
        "Manpower": ["Hour", "Day", "Week", "Month"],
        "Device": ["Piece", "Set", "Unit"],
        "Software / subscription": ["License", "Month", "Year"],
        "Material": ["Piece", "Kg", "Liter", "Meter", "Pack"],
        "Venue / space": ["Hour", "Day", "Week", "Month"],
        "Training": ["Session", "Course", "Day"],
        "Other": ["Unit", "Item", "Service"],
      };
      const unitsFor = (type, sel) => {
        const opts = UNIT_OPTIONS[type] || UNIT_OPTIONS["Other"];
        return (sel && !opts.includes(sel) ? [sel, ...opts] : opts)
          .map(u => `<option ${u === sel ? "selected" : ""}>${esc(u)}</option>`).join("");
      };
      const reqWrap = $("#reqBlocks", body);
      function reqBlock(r) {
        const tr = document.createElement("tr");
        tr.className = "req-block";
        tr.innerHTML = `
          <td class="rq-num"></td>
          <td><input type="text" name="rqItem" value="${v(r, "rqItem")}" placeholder="e.g. 3D printer"></td>
          <td><select name="rqType">${REQ_TYPES.map(t => `<option ${t === r.rqType ? "selected" : ""}>${t}</option>`).join("")}</select></td>
          <td><input type="number" name="rqQty" min="0.01" step="any" value="${v(r, "rqQty") || 1}"></td>
          <td><select name="rqUnit">${unitsFor(r.rqType || "Equipment", r.rqUnit)}</select></td>
          <td><input type="number" name="rqCost" min="0.01" step="0.01" value="${v(r, "rqCost")}" placeholder="0"></td>
          <td><input type="text" name="rqNote" value="${v(r, "rqNote")}" placeholder="What is it for?"></td>
          <td><button type="button" class="req-del" title="Remove this request">✕</button></td>`;
        const labels = { rqItem: "Item", rqType: "Type", rqQty: "Quantity", rqUnit: "Unit", rqCost: "Cost per unit in USD", rqNote: "Purpose / notes" };
        $$("input, select", tr).forEach(input => input.setAttribute("aria-label", labels[input.name]));
        $('[name="rqType"]', tr).addEventListener("change", (e) => {
          $('[name="rqUnit"]', tr).innerHTML = unitsFor(e.target.value);
        });
        $(".req-del", tr).addEventListener("click", () => {
          if ($$(".req-block", reqWrap).length > 1) tr.remove();
          else { tr.querySelectorAll("input").forEach(i => i.value = i.name === "rqQty" ? 1 : "");
            $('[name="rqType"]', tr).selectedIndex = 0;
            $('[name="rqUnit"]', tr).innerHTML = unitsFor("Equipment"); }
          renumber(); updateTotal();
        });
        return tr;
      }
      function renumber() {
        $$(".req-block .rq-num", reqWrap).forEach((td, i) => td.textContent = i + 1);
      }
      function updateTotal() {
        let t = 0;
        $$(".req-block", reqWrap).forEach(b => {
          const cost = +$('[name="rqCost"]', b)?.value || 0;
          const qty = +$('[name="rqQty"]', b)?.value || 1;
          t += cost * (qty || 1);
        });
        $("#reqTotal", body).textContent = "$" + t.toLocaleString();
      }
      const reqs = (d.requirements && d.requirements.length ? d.requirements : [{}]);
      reqs.forEach(r => reqWrap.appendChild(reqBlock(r)));
      $("#addReq", body).addEventListener("click", () => {
        const tr = reqBlock({});
        reqWrap.appendChild(tr);
        renumber();
        $('[name="rqItem"]', tr).focus();
      });
      reqWrap.addEventListener("input", updateTotal);
      renumber(); updateTotal();
    },
    collect(body, prev) {
      const base = collectForm(body);
      Object.keys(base).forEach(k => { if (/^(tm|rq)[A-Z]/.test(k)) delete base[k]; }); // row fields live in team/requirements
      base.team = $$(".team-block", body).map(b => collectForm(b))
        .filter(m => m.tmName || m.tmEmail || m.tmRole || m.tmPhone || m.tmResponsibilities);
      base.requirements = $$(".req-block", body).map(b => collectForm(b))
        .filter(r => r.rqItem || r.rqCost || r.rqNote);
      base.estCompletion = base.completionValue && base.completionUnit
        ? `${base.completionValue} ${base.completionUnit.toLowerCase()}${Number(base.completionValue) === 1 ? "" : "s"}` : "";
      if (!base.estCompletion && prev?.estCompletion) base.previousEstCompletion = prev.estCompletion;
      else if (!base.estCompletion && prev?.previousEstCompletion) base.previousEstCompletion = prev.previousEstCompletion;
      return collectFiles(body, prev).then(files => ({ ...base, files }));
    },
    validate(d) {
      const req = ["category", "title", "explain", "role", "workDuration",
        "estCompletion", "innovationField", "problem", "beneficiaries",
        "innovationPoint", "businessPotential",
        "legalFocus", "stage", "implemented", "trl", "ipStatus", "legalEntity",
        "targetCustomers", "competitors", "milestonesPlan"];
      if (req.some(k => !d[k])) return "Please complete all required fields (marked *).";
      if (d.title.length > 30) return "Project title must be 30 characters or fewer.";
      if (["Other", "Member"].includes(d.role) && !d.roleOther?.trim()) return "Please specify your role and responsibilities in the innovation.";
      const completion = completionParts(d);
      if (!Number.isInteger(Number(completion.value)) || Number(completion.value) <= 0 ||
          !["Day", "Week", "Month", "Year"].includes(completion.unit))
        return "Please enter a positive whole number and a unit for estimated time to complete.";
      for (const [i, member] of (d.team || []).entries()) {
        if (!member.tmName?.trim()) return `Project participant ${i + 1}: please provide a name.`;
        if (member.tmEmail && !validEmail(member.tmEmail)) return `Project participant ${i + 1}: please enter a valid email, such as name@example.org.`;
        if (member.tmPhone && (!member.tmPhone.startsWith("+") || !validPhone(member.tmPhone))) return `Project participant ${i + 1}: please enter a valid phone number beginning with + and the country code.`;
      }
      if (d.implemented === "Yes" && !d.implementedWhere) return "Please tell us where the innovation has been implemented.";
      if (!(d.requirements || []).length) return "Please add at least one requirement with its estimated cost.";
      for (const [i, requirement] of d.requirements.entries()) {
        if (!requirement.rqItem?.trim() || !Number.isFinite(+requirement.rqCost) || +requirement.rqCost <= 0)
          return `Requirement ${i + 1}: provide an item and a cost per unit greater than zero.`;
        if (requirement.rqQty && (!Number.isFinite(+requirement.rqQty) || +requirement.rqQty <= 0))
          return `Requirement ${i + 1}: quantity must be greater than zero.`;
      }
      if (!d.files?.cv || d.files.cv.tooLarge) return "Please upload your CV / Resume.";
      if (!d.files?.photo || d.files.photo.tooLarge) return "Please upload your photograph.";
      return null;
    },
  },

  /* ============ 5. VIDEO STATEMENT ============ */
  {
    id: "video",
    title: "Video Statement",
    head: "Self Promotion Video",
    sub: "",
    render(body, d) {
      body.innerHTML = `
        <div class="alert alert-info">
          Please record a short statement (up to 30 seconds) explaining what you hope to gain
          from the KII Innovation Program and how it relates to your academic, innovation and
          career goals.
        </div>
        ${fileInput("video", "Upload your video <span class='req'>*</span>", "video/*", d.files?.video)}
        <div class="field"><label>Additional comments (optional)</label>
          <textarea name="note">${v(d, "note")}</textarea></div>`;
    },
    collect(body, prev) {
      return collectFiles(body, prev).then(files => ({ ...collectForm(body), files }));
    },
    validate(d) {
      if (!d.files?.video || d.files.video.tooLarge) return "Please upload your self-promotion video.";
      if (d.files.video.duration > 30) return "Your self-promotion video must be 30 seconds or shorter.";
      return null;
    },
  },

  /* ============ 6. NON-DEGREE STUDIES ============ */
  {
    id: "nondegree",
    title: "Non-degree Studies & Career",
    head: "Non-Degree Studies and Other Experiences",
    sub: "Courses, certificates, work and volunteer experience.",
    render(body, d) {
      body.innerHTML = `
        <div class="field"><label>Non-degree courses or certificates</label>
          <textarea name="courses" placeholder="e.g. online courses, bootcamps, professional certificates…">${v(d, "courses")}</textarea></div>
        <div class="field"><label>Work / volunteer experience</label>
          <textarea name="work" placeholder="Position, organization, dates and responsibilities…">${v(d, "work")}</textarea></div>
        <div class="field"><label>Skills relevant to your project</label>
          <input type="text" name="skills" value="${v(d, "skills")}" placeholder="e.g. programming, design, project management…"></div>
        ${fileInput("docs", "Supporting documents (certificates, letters…)", ".pdf,image/*", d.files?.docs, true)}
        ${fileInput("images", "Images (optional)", "image/*", d.files?.images, true)}`;
    },
    collect(body, prev) {
      return collectFiles(body, prev).then(files => ({ ...collectForm(body), files }));
    },
  },

  /* ============ 7. AREA OF SCIENTIFIC INTEREST ============ */
  {
    id: "interest",
    title: "Area of Scientific Interest",
    head: "Area of Scientific Interest",
    sub: "Select all areas that apply to you.",
    render(body, d) {
      const sel = d.areas || [];
      body.innerHTML = `
        ${INTERESTS.map(a => `
          <label class="checkbox-line">
            <input type="checkbox" name="areas" value="${esc(a)}" ${sel.includes(a) ? "checked" : ""}> ${esc(a)}
          </label>`).join("")}
        <div class="field mt-2"><label>Other interest (optional)</label>
          <input type="text" name="other" value="${v(d, "other")}"></div>
        <div class="field"><label>Why does this area interest you? <span class="req">*</span></label>
          <textarea name="motivation">${v(d, "motivation")}</textarea></div>`;
    },
    validate(d) {
      if (!d.areas || !d.areas.length) return "Please select at least one area of interest.";
      if (!d.motivation) return "Please explain why this area interests you.";
      return null;
    },
  },

  /* ============ 8. DURATION OF PROJECT ============ */
  {
    id: "duration",
    title: "Duration of Project",
    head: "Duration of Project",
    sub: "How long do you plan to spend on your project in the program?",
    render(body, d) {
      body.innerHTML = `
        <div class="grid-2">
          <div class="field"><label>Preferred project duration <span class="req">*</span></label>
            <select name="length">${opt(["3 months", "6 months", "12 months", "18 months", "24 months"], d.length)}</select></div>
          <div class="field"><label>Preferred start date <span class="req">*</span></label>
            <input type="date" name="startPref" value="${v(d, "startPref")}"></div>
        </div>
        <div class="field"><label>Availability <span class="req">*</span></label>
          <select name="availability">${opt(["Full-time", "Part-time", "Flexible"], d.availability)}</select></div>`;
    },
    validate(d) {
      if (!d.length || !d.startPref || !d.availability) return "Please complete all required fields.";
      if (!validDate(d.startPref)) return "Please enter a valid preferred start date.";
      return null;
    },
  },

  /* ============ 9. EXAM SCORE ============ */
  {
    id: "examscore",
    title: "Exam Score",
    head: "Exam Score",
    sub: "Provide any relevant exam or test scores (language, aptitude…).",
    render(body, d) {
      body.innerHTML = `
        <div class="grid-2">
          <div class="field"><label>Exam type <span class="req">*</span></label>
            <select name="examType">${opt(EXAM_TYPES, d.examType)}</select></div>
          <div class="field"><label>Score</label>
            <input type="text" name="score" value="${v(d, "score")}" placeholder="e.g. 7.5, 105…"></div>
          <div class="field"><label>Date taken</label>
            <input type="date" name="examDate" max="${today()}" value="${v(d, "examDate")}"></div>
          <div class="field"><label>Details (optional)</label>
            <input type="text" name="details" value="${v(d, "details")}"></div>
        </div>`;
    },
    validate(d) {
      if (!d.examType) return "Please select an exam type (or choose 'None').";
      if (d.examDate && (!validDate(d.examDate) || d.examDate > today())) return "Exam date must be a valid date on or before today.";
      return null;
    },
  },

  /* ============ 10. EXAM DOCUMENTS ============ */
  {
    id: "examdocs",
    title: "Exam Documents",
    head: "Exam Documents",
    sub: "Upload certificates or score reports for the exams listed above.",
    render(body, d) {
      body.innerHTML = `
        ${fileInput("certificate", "Exam certificate / score report", ".pdf,image/*", d.files?.certificate)}
        <div class="field"><label>Notes (optional)</label>
          <textarea name="notes">${v(d, "notes")}</textarea></div>`;
    },
    collect(body, prev) {
      return collectFiles(body, prev).then(files => ({ ...collectForm(body), files }));
    },
  },

  /* ============ 11. TRAVEL INFORMATION ============ */
  {
    id: "travel",
    title: "Travel Information",
    head: "Travel Information",
    sub: "Passport and travel details.",
    render(body, d) {
      body.innerHTML = `
        <div class="grid-2">
          <div class="field"><label>Passport Number <span class="req">*</span></label>
            <input type="text" name="passportNo" value="${v(d, "passportNo")}"></div>
          <div class="field"><label>Issuing Country <span class="req">*</span></label>
            <input type="text" name="passportCountry" list="countryList" value="${v(d, "passportCountry")}" placeholder="Type to search…"></div>
          <div class="field"><label>Passport Expiry Date <span class="req">*</span></label>
            <input type="date" name="passportExpiry" value="${v(d, "passportExpiry")}"></div>
        </div>
        <div class="field"><label>Countries you have visited (optional)</label>
          <textarea name="visited" placeholder="List countries and approximate dates…">${v(d, "visited")}</textarea></div>
        <div class="field"><label>Have you ever had a visa refusal or travel issue? <span class="req">*</span></label>
          <label class="radio-line"><input type="radio" name="visaIssue" value="Yes" ${d.visaIssue === "Yes" ? "checked" : ""}> Yes</label>
          <label class="radio-line"><input type="radio" name="visaIssue" value="No" ${d.visaIssue === "No" ? "checked" : ""}> No</label>
          <input type="text" name="visaIssueDetail" value="${v(d, "visaIssueDetail")}" placeholder="If yes, please explain" class="mt-1">
        </div>`;
    },
    validate(d) {
      if (!d.passportNo || !d.passportCountry || !d.passportExpiry || !d.visaIssue)
        return "Please complete all required fields.";
      if (new Date(d.passportExpiry) < new Date()) return "Your passport has expired. Please provide a valid passport.";
      if (d.visaIssue === "Yes" && !d.visaIssueDetail) return "Please explain the visa refusal or travel issue.";
      return null;
    },
  },

  /* ============ 12. RELATIONSHIP WITH KII ============ */
  {
    id: "kii",
    title: "Relationship with KII",
    head: "Relationship with KII",
    sub: "Tell us about your connection to the KII Innovation Program.",
    render(body, d) {
      body.innerHTML = `
        <div class="field"><label>How did you hear about KII? <span class="req">*</span></label>
          <select name="heardFrom">${opt(HEARD_FROM, d.heardFrom)}</select></div>
        <div class="field"><label>Have you applied to or participated in KII before? <span class="req">*</span></label>
          <label class="radio-line"><input type="radio" name="appliedBefore" value="Yes" ${d.appliedBefore === "Yes" ? "checked" : ""}> Yes</label>
          <label class="radio-line"><input type="radio" name="appliedBefore" value="No" ${d.appliedBefore === "No" ? "checked" : ""}> No</label>
          <input type="text" name="beforeDetail" value="${v(d, "beforeDetail")}" placeholder="If yes, when and which program?" class="mt-1">
        </div>
        <div class="field"><label>Do you know anyone at KII? (optional)</label>
          <input type="text" name="kiiContact" value="${v(d, "kiiContact")}" placeholder="Name and relationship"></div>
        <div class="field"><label>Why do you want to join the KII Innovation Program? <span class="req">*</span></label>
          <textarea name="why">${v(d, "why")}</textarea></div>`;
    },
    validate(d) {
      if (!d.heardFrom || !d.appliedBefore || !d.why) return "Please complete all required fields.";
      return null;
    },
  },

  /* ============ 13. RECOMMENDATIONS ============ */
  {
    id: "recommendations",
    title: "Recommendations",
    head: "Recommendations",
    sub: "Provide at least one person who can recommend you.",
    render(body, d) {
      body.innerHTML = `
        <div id="recBlocks"></div>
        <button type="button" class="btn btn-secondary btn-sm" id="addRec">+ Add another recommender</button>`;

      const wrap = $("#recBlocks", body);
      let recSeq = 0;
      function recBlock(r, i) {
        recSeq = Math.max(recSeq, i + 1);
        const div = document.createElement("div");
        div.className = "repeat-block rec-block";
        div.dataset.idx = i;
        const n = $$(".rec-block", wrap).length;
        div.innerHTML = `
          <div class="block-title">Recommender ${n + 1}</div>
          ${n > 0 ? '<button type="button" class="remove-block">Remove</button>' : ""}
          <div class="grid-2">
            <div class="field"><label>Full Name <span class="req">*</span></label>
              <input type="text" name="rcName" value="${v(r, "rcName")}"></div>
            <div class="field"><label>Email <span class="req">*</span></label>
              <input type="email" name="rcEmail" value="${v(r, "rcEmail")}"></div>
            <div class="field"><label>Relationship</label>
              <input type="text" name="rcRelation" value="${v(r, "rcRelation")}" placeholder="e.g. professor, employer"></div>
          </div>
          ${fileInput("letter_" + i, "Recommendation letter (optional)", ".pdf,image/*", r.files && r.files["letter_" + i])}`;
        const rm = $(".remove-block", div);
        if (rm) rm.addEventListener("click", () => div.remove());
        return div;
      }
      const list = (d.entries && d.entries.length ? d.entries : [{}]);
      list.forEach((r) => wrap.appendChild(recBlock(r, r.idx ?? recSeq)));
      $("#addRec", body).addEventListener("click", () => wrap.appendChild(recBlock({}, recSeq)));
    },
    collect(body, prev) {
      const prevFiles = Object.assign({}, ...(prev?.entries || []).map(e => e.files || {}));
      return (async () => {
        const entries = [];
        for (const b of $$(".rec-block", body)) {
          entries.push({ ...collectForm(b), idx: +b.dataset.idx, files: await collectFiles(b, prevFiles) });
        }
        return { entries };
      })();
    },
    validate(d) {
      const r = (d.entries || [])[0];
      if (!r || !r.rcName || !r.rcEmail)
        return "Please provide at least one recommender (name and email).";
      const bad = (d.entries || []).find(x => x.rcEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.rcEmail));
      if (bad) return `Please enter a valid email for recommender "${bad.rcName || ""}".`;
      if ((d.entries || []).some(x => !x.rcName?.trim() || !x.rcEmail?.trim())) return "Please provide a name and email for every recommender, or remove unused rows.";
      return null;
    },
  },

  /* ============ 14. REVIEW ============ */
  {
    id: "review",
    title: "Review",
    head: "Review & Submit",
    sub: "Check your answers before submitting.",
    isReview: true,
    render(body) { renderReview(body); },
  },
];

/* ---------- review rendering ---------- */
function row(k, val) {
  const display = Array.isArray(val) ? val.join(", ") : val;
  return `<div class="detail-row"><span class="k">${esc(k)}</span>
    <span class="v">${display ? esc(display) : "—"}</span></div>`;
}
function fileRow(k, f) {
  return `<div class="detail-row"><span class="k">${esc(k)}</span>
    <span class="v">${fileList(f).map(x => esc(x.name)).join(", ") || "—"}</span></div>`;
}
function yesNo(vv) { return vv || "—"; }

function renderReview(body) {
  const d = app.data || {};
  const p = d.personal || {}, e = d.education || {}, s = d.supporting || {},
    vid = d.video || {}, nd = d.nondegree || {}, ai = d.interest || {},
    dur = d.duration || {}, es = d.examscore || {}, ed = d.examdocs || {},
    tv = d.travel || {}, k = d.kii || {}, rec = d.recommendations || {};

  let html = "";
  html += `<div class="review-group"><h3>Application Instructions</h3>
    ${row("Application terms", d.instruction?.agreeApp ? "Accepted" : "Not accepted")}
    ${row("Confirmation Fee terms", d.instruction?.agreeFee ? "Accepted" : "Not accepted")}</div>`;

  html += `<div class="review-group"><h3>Personal Background</h3>
    ${row("Name", [p.firstName, p.secondName, p.thirdName].filter(Boolean).join(" "))}
    ${row("Email", p.email)}${row("Phone", (p.phoneCode || "") + " " + (p.phone || ""))}
    ${row("Gender", p.gender)}${row("Birth Date", p.birthDate)}
    ${row("Address", [p.street, p.city, p.region, p.postal, p.country].filter(Boolean).join(", "))}
    ${row("Primary Citizenship", p.primaryCitizenship)}${row("Dual Citizenship", p.dualCitizenship)}
  </div>`;

  html += `<div class="review-group"><h3>Education History</h3>
    ${row("Level", e.type === "higher" ? "Higher Education" : e.type === "highschool" ? "High School or lower" : "—")}
    ${e.type === "highschool" ? row("School", e.hsSchool || "—") : ""}
    ${(e.entries || []).map((en, i) => `
      <div class="detail-row"><span class="k">Education ${i + 1}</span>
      <span class="v">${esc([en.level === "Other" ? en.levelOther : en.level, en.fieldOfStudy, en.institution, en.city, en.country]
        .filter(Boolean).join(" — "))}<br>
      <span class="muted">${esc(en.startDate || "")} → ${esc(en.currentlyStudying ? "Currently studying here" : en.endDate || "")}</span></span></div>
      ${Object.values(en.files || {}).map(f => fileRow("Transcripts / Certificates", f)).join("")}`).join("")}
  </div>`;

  html += `<div class="review-group"><h3>Project Information</h3>
    ${row("Category", s.category)}${row("Title", s.title)}${row("Role", s.role)}
    ${row("Role / responsibilities", s.roleOther)}
    ${row("Explanation", s.explain)}${row("Work duration", s.workDuration)}
    ${row("Est. completion", s.estCompletion)}${row("Field", s.innovationField)}
    ${row("Problem", s.problem)}${row("Beneficiaries", s.beneficiaries)}
    ${row("Innovation point", s.innovationPoint)}
    ${row("Business potential", s.businessPotential)}${row("Business detail", s.businessDetail)}
    ${(s.requirements || []).map((r, i) => row("Requirement " + (i + 1),
      [r.rqItem, r.rqType, (r.rqQty || 1) + " " + (r.rqUnit || "unit") + " × $" + (r.rqCost || 0)].filter(Boolean).join(" — ") + (r.rqNote ? " (" + r.rqNote + ")" : ""))).join("")}
    ${row("Estimated total cost", "$" + (s.requirements || []).reduce((t, r) => t + (+r.rqCost || 0) * (+r.rqQty || 1), 0).toLocaleString())}
    ${row("Legal focus", s.legalFocus)}${row("Stage", s.stage)}
    ${row("Implemented", yesNo(s.implemented))}${row("Where", s.implementedWhere)}
    ${row("Technology readiness", s.trl)}${row("IP status", s.ipStatus)}${row("IP owner", s.ipOwner)}
    ${row("Legal entity", s.legalEntity)}${row("Other funding", s.otherFunding)}
    ${row("Target customers", s.targetCustomers)}${row("Competitors & advantage", s.competitors)}
    ${row("Business model", s.businessModel)}${row("Traction", s.traction)}
    ${row("Milestones (12 months)", s.milestonesPlan)}${row("SDGs", s.sdgs)}
    ${fileRow("Pitch deck", s.files?.pitchDeck)}
    ${(s.team || []).map((m, i) => row("Project participant " + (i + 1), [m.tmName, m.tmRole, m.tmEmail, m.tmPhone, m.tmResponsibilities].filter(Boolean).join(" — "))).join("")}
    ${fileRow("CV / Resume", s.files?.cv)}${fileRow("Photograph", s.files?.photo)}${fileRow("Student ID", s.files?.studentId)}
  </div>`;

  html += `<div class="review-group"><h3>Video Statement</h3>
    ${fileRow("Video", vid.files?.video)}${row("Comments", vid.note)}</div>`;

  html += `<div class="review-group"><h3>Non-Degree Studies</h3>
    ${row("Courses", nd.courses)}${row("Work experience", nd.work)}${row("Skills", nd.skills)}
    ${fileRow("Documents", nd.files?.docs)}${fileRow("Images", nd.files?.images)}</div>`;

  html += `<div class="review-group"><h3>Scientific Interest</h3>
    ${row("Areas", ai.areas)}${row("Other", ai.other)}${row("Motivation", ai.motivation)}</div>`;

  html += `<div class="review-group"><h3>Project Duration</h3>
    ${row("Duration", dur.length)}${row("Start date", dur.startPref)}${row("Availability", dur.availability)}</div>`;

  html += `<div class="review-group"><h3>Exam</h3>
    ${row("Type", es.examType)}${row("Score", es.score)}${row("Date", es.examDate)}${row("Details", es.details)}
    ${fileRow("Certificate", ed.files?.certificate)}${row("Exam document notes", ed.notes)}</div>`;

  html += `<div class="review-group"><h3>Travel</h3>
    ${row("Passport No.", tv.passportNo)}${row("Issuing country", tv.passportCountry)}
    ${row("Expiry", tv.passportExpiry)}${row("Visited", tv.visited)}
    ${row("Visa issue", yesNo(tv.visaIssue))}${row("Details", tv.visaIssueDetail)}</div>`;

  html += `<div class="review-group"><h3>Relationship with KII</h3>
    ${row("Heard from", k.heardFrom)}${row("Applied before", yesNo(k.appliedBefore))}
    ${row("Details", k.beforeDetail)}${row("KII contact", k.kiiContact)}${row("Why KII", k.why)}</div>`;

  html += `<div class="review-group"><h3>Recommendations</h3>
    ${(rec.entries || []).map((r, i) => row("Recommender " + (i + 1),
      [r.rcName, r.rcRelation, r.rcEmail].filter(Boolean).join(" — ")) +
      Object.values(r.files || {}).map(f => fileRow("Recommendation letter", f)).join("")).join("") || '<div class="empty">None provided</div>'}
  </div>`;

  const missing = missingRequired();
  if (missing.length) {
    html += `<div class="alert alert-error mt-3"><strong>Your application is not complete.</strong>
      Please complete these required sections before submitting:
      ${missing.map(m => `<a href="?s=${m.id}">${esc(m.title)}</a>`).join(", ")}.</div>`;
  }
  if (app.revisionNote && !app.submitted) {
    html += `<div class="alert alert-info mt-3"><strong>Revision requested by KII:</strong> ${esc(app.revisionNote)}</div>`;
  }
  if (KII.deadlinePassed() && !app.submitted) {
    html += `<div class="alert alert-error mt-3">The application deadline
      (${KII.fmtDate(KII.programSettings().deadline)}) has passed. Submissions are closed.</div>`;
  }

  if (app.submitted) {
    html += `<div class="alert alert-ok mt-3">Your application was submitted on
      ${KII.fmtDate(app.submittedAt)} — ${esc(app.season)}. It is now locked for review;
      you can follow its progress on your dashboard.</div>`;
  } else {
    const dc = app.declarations || {};
    html += `<div class="review-group mt-3"><h3>Declarations</h3>
      <label class="checkbox-line"><input type="checkbox" id="decTruth" ${dc.truth ? "checked" : ""}>
        <span>I declare that the information in this application is true, complete and my own work.</span></label>
      <label class="checkbox-line"><input type="checkbox" id="decIp" ${dc.ip ? "checked" : ""}>
        <span>I confirm that I own, or have the right to use, the intellectual property described in this application,
        and I will disclose any existing agreements with third parties.</span></label>
      <label class="checkbox-line"><input type="checkbox" id="decEthics" ${dc.ethics ? "checked" : ""}>
        <span>I will follow applicable laws, research ethics and KII program rules, and I understand that
        misleading information may lead to disqualification.</span></label>
      <label class="checkbox-line"><input type="checkbox" id="decPrivacy" ${dc.privacy ? "checked" : ""}>
        <span>I consent to KII sharing my application with its staff and appointed expert reviewers,
        who are bound by confidentiality, for evaluation purposes.</span></label>
    </div>`;
  }

  body.innerHTML = html;

  const continueBtn = $("#continueBtn");
  if (app.submitted) {
    continueBtn.disabled = true;
    continueBtn.textContent = "Submitted";
  } else {
    continueBtn.disabled = !!missing.length || KII.deadlinePassed();
    continueBtn.textContent = app.revisionNote ? "Resubmit Application" : "Submit Application";
  }
}

/* sections that must be completed before submission (all sections with validation rules) */
function missingRequired() {
  return SECTIONS.filter(sx => !sx.isReview && sx.validate && sx.validate(app.data?.[sx.id] || {}));
}
function isLocked() { return !!app.submitted || app.status === "Withdrawn"; }

/* ---------- navigation engine ---------- */
const params = new URLSearchParams(location.search);
let currentId = params.get("s") || (app && app.currentSection) || "instruction";
let navBusy = false;

const sideNav = $("#sideNav");
SECTIONS.forEach(s => {
  const li = document.createElement("li");
  li.innerHTML = `<a href="?s=${s.id}" data-id="${s.id}"><span class="dot"></span>${s.title}</a>`;
  sideNav.appendChild(li);
});

if (app) {
  $("#sideApplicant").textContent =
    [user.firstName, user.secondName, user.thirdName].filter(Boolean).join(" ") + " — " + app.category;
}

function updateSidebar() {
  if (!isLocked()) {
    app.completedSections = (app.completedSections || []).filter(id => {
      const section = SECTIONS.find(s => s.id === id);
      return section && !section.isReview && (!section.validate || !section.validate(app.data?.[id] || {}));
    });
  }
  $$("#sideNav a[data-id]").forEach(a => {
    const id = a.dataset.id;
    a.classList.toggle("active", id === currentId);
    a.classList.toggle("done", (app.completedSections || []).includes(id));
  });
  const done = (app.completedSections || []).length;
  $("#sideProgress").textContent = app.submitted
    ? "Application submitted"
    : `Progress: ${done} / ${SECTIONS.length} sections`;
}

function showErr(msg) {
  const a = $("#alert");
  if (!msg) { a.classList.add("hidden"); return; }
  a.textContent = msg;
  a.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function idx(id) { return SECTIONS.findIndex(s => s.id === id); }

async function collectCurrent() {
  const sec = SECTIONS[idx(currentId)];
  const body = $("#sectionBody");
  if (sec.isReview || isLocked()) return null; // submitted applications are read-only
  const prev = app.data[currentId];
  const data = sec.collect ? await sec.collect(body, prev) : {
    ...collectForm(body),
    ...(await collectFiles(body, prev)),
  };
  return data;
}

async function renderSection(id) {
  currentId = id;
  app.currentSection = id;
  KII.saveApplication(user.email, app);

  const sec = SECTIONS[idx(id)];
  const d = app.data[id] || {};
  $("#stepLabel").textContent = `Section ${idx(id) + 1} of ${SECTIONS.length}`;
  $("#sectionTitle").textContent = sec.head;
  $("#sectionSub").textContent = sec.sub || "";
  const cb = $("#continueBtn");
  cb.textContent = "Continue";
  cb.disabled = false;
  showErr(null);
  sec.render($("#sectionBody"), d);
  $$('#sectionBody input[type="file"]').forEach(input => input.addEventListener("change", () => {
    const label = input.closest(".file-drop")?.querySelector(".file-name");
    if (label && input.files.length) label.textContent = "Selected: " + Array.from(input.files).map(f => f.name).join(", ");
  }));

  const locked = isLocked();
  if (locked && !sec.isReview) {
    $$("#sectionBody input, #sectionBody select, #sectionBody textarea, #sectionBody button").forEach(el => el.disabled = true);
    $("#sectionBody").insertAdjacentHTML("afterbegin",
      `<div class="alert alert-info">This application has been submitted and is locked for review. You can view your answers but not change them.</div>`);
    cb.textContent = "Next";
  }
  $("#saveBtn").style.display = locked ? "none" : "";
  $("#backBtn").style.visibility = idx(id) === 0 ? "hidden" : "visible";
  updateSidebar();
  window.scrollTo(0, 0);
  try { history.replaceState(null, "", "?application=" + encodeURIComponent(app.id || "legacy") + "&s=" + id); } catch (e) { /* file:// may block this */ }
}

/* back / continue / save */
$("#backBtn").addEventListener("click", async () => {
  try {
    const data = await collectCurrent();
    if (data) app.data[currentId] = data;
    KII.saveApplication(user.email, app);
    const i = idx(currentId);
    if (i > 0) renderSection(SECTIONS[i - 1].id);
  } catch (error) { showErr(error.message); }
});

$("#saveBtn").addEventListener("click", async () => {
  try {
    const data = await collectCurrent();
    if (data) app.data[currentId] = data;
    KII.saveApplication(user.email, app);
    window.location.href = "dashboard.html";
  } catch (error) { showErr(error.message); }
});

$("#continueBtn").addEventListener("click", async () => {
  if (navBusy) return;
  navBusy = true;
  try {
    const sec = SECTIONS[idx(currentId)];

    if (isLocked() && !sec.isReview) { // read-only browsing after submission
      const nx = SECTIONS[idx(currentId) + 1];
      renderSection(nx ? nx.id : "review");
      return;
    }

    if (sec.isReview) {
      if (missingRequired().length) { showErr("Please complete all required sections before submitting."); return; }
      if (KII.deadlinePassed()) { showErr("The application deadline has passed. Submissions are closed."); return; }
      const dc = { truth: $("#decTruth")?.checked, ip: $("#decIp")?.checked,
        ethics: $("#decEthics")?.checked, privacy: $("#decPrivacy")?.checked };
      app.declarations = dc;
      if (!dc.truth || !dc.ip || !dc.ethics || !dc.privacy) {
        KII.saveApplication(user.email, app);
        showErr("Please confirm all four declarations before submitting.");
        return;
      }
      if (!confirm("Submit your application? It will be locked for review and you will not be able to edit it afterwards.")) return;
      app.declarations.at = new Date().toISOString();
      if (app.revisionNote) {
        app.resubmittedAt = new Date().toISOString();
        (app.revisionHistory = app.revisionHistory || []).push({ note: app.revisionNote, resubmittedAt: app.resubmittedAt });
        app.revisionNote = "";
      } else {
        app.submittedAt = new Date().toISOString();
      }
      app.submitted = true;
      app.status = "Done";
      app.season = KII.reviewSeason();
      if (!(app.completedSections || []).includes("review"))
        app.completedSections.push("review");
      KII.saveApplication(user.email, app);
      renderSection("review");
      return;
    }

    const data = await collectCurrent();
    app.data[currentId] = data;

    const err = sec.validate ? sec.validate(data) : null;
    if (err) {
      app.completedSections = (app.completedSections || []).filter(x => x !== currentId);
      showErr(err); KII.saveApplication(user.email, app); updateSidebar(); return;
    }

    if (!(app.completedSections || []).includes(currentId))
      app.completedSections.push(currentId);
    if (!app.submitted && app.status !== "Withdrawn") app.status = "InProgress";
    KII.saveApplication(user.email, app);

    const next = SECTIONS[idx(currentId) + 1];
    renderSection(next ? next.id : "review");
  } catch (error) {
    showErr(error.message);
  } finally {
    navBusy = false;
  }
});

/* sidebar click = save current + navigate */
sideNav.addEventListener("click", async (e) => {
  try {
    const a = e.target.closest("a[data-id]");
    if (!a) {
      // plain links (e.g. Home): save current section before leaving
      const link = e.target.closest("a[href]");
      if (link) {
        e.preventDefault();
        const data = await collectCurrent();
        if (data) app.data[currentId] = data;
        KII.saveApplication(user.email, app);
        window.location.href = link.href;
      }
      return;
    }
    e.preventDefault();
    const target = a.dataset.id;
    if (target === currentId) return;
    const data = await collectCurrent();
    if (data) app.data[currentId] = data;
    KII.saveApplication(user.email, app);
    renderSection(target);
  } catch (error) { showErr(error.message); }
});

/* ---------- init ---------- */
if (app) {
  fillCountries($("#countryList"));

  // strip legacy inline file data (localStorage quota fix — bytes now live in IndexedDB)
  (function stripDataUrls(obj) {
    if (!obj || typeof obj !== "object") return;
    for (const [k, val] of Object.entries(obj)) {
      if (k === "dataUrl") delete obj[k];
      else stripDataUrls(val);
    }
  })(app.data);

  /* prefill personal data from account on first visit */
  if (!app.data.personal) {
    app.data.personal = {
      firstName: user.firstName, secondName: user.secondName, thirdName: user.thirdName,
      email: user.email, birthDate: user.dob,
      ...accountPhone(),
    };
  }

  renderSection(currentId);
}
