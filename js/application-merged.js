/* KII merged application, version 2. Legacy submitted forms remain readable. */
(async function () {
  "use strict";
  const user = KII.requireAuth();
  if (!user) return;
  const params = new URLSearchParams(location.search);
  const applicationId = params.get("application") || KII.selectedApplication(user.email);
  let app = KII.getApplication(user.email, applicationId);
  if (!app) { location.href = "dashboard.html"; return; }
  if (!app.schemaVersion && (app.submitted || app.status === "Withdrawn")) {
    const script = document.createElement("script");
    script.src = "js/application-legacy.js?v=form-13";
    document.body.appendChild(script);
    return;
  }
  await KIILocations.ready;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = KII.escapeHtml;
  const asFiles = value => Array.isArray(value) ? value : value ? [value] : [];
  const today = KII.today;
  const validDate = KII.validDate;
  const digits = value => String(value || "").replace(/\D/g, "");
  const fullName = [user.firstName, user.secondName, user.thirdName].filter(Boolean).join(" ");
  const accountPhone = String(user.phone || "").match(/^(\+\d{1,3})(?:\s*\([^)]*\))?\s*(.*)$/);
  const phoneCodes = [...new Set(COUNTRY_CODES.map(c => c.split(" ")[0]))].filter(code => /^\+\d+$/.test(code));
  const years = () => Array.from({ length: new Date().getFullYear() - 1899 }, (_, i) => String(new Date().getFullYear() - i));
  const listedUniversity = d => d.country === "Iraq" && !!KIILocations.institutions(d.city);
  const sdgs = [
    ["1 No Poverty", "\u{1F3E0}"], ["2 Zero Hunger", "\u{1F33E}"], ["3 Good Health and Well-being", "\u2695\uFE0F"],
    ["4 Quality Education", "\u{1F4DA}"], ["5 Gender Equality", "\u2696\uFE0F"], ["6 Clean Water and Sanitation", "\u{1F4A7}"],
    ["7 Affordable and Clean Energy", "\u{1F506}"], ["8 Decent Work and Economic Growth", "\u{1F4C8}"],
    ["9 Industry, Innovation and Infrastructure", "\u{1F3D7}\uFE0F"], ["10 Reduced Inequalities", "\u{1F91D}"],
    ["11 Sustainable Cities and Communities", "\u{1F3D9}\uFE0F"], ["12 Responsible Consumption and Production", "\u267B\uFE0F"],
    ["13 Climate Action", "\u{1F30D}"], ["14 Life Below Water", "\u{1F41F}"], ["15 Life on Land", "\u{1F333}"],
    ["16 Peace, Justice and Strong Institutions", "\u{1F54A}\uFE0F"], ["17 Partnerships for the Goals", "\u{1F30F}"]
  ];
  const sdgNames = sdgs.map(([name]) => name);
  const sdgIcons = Object.fromEntries(sdgs);
  const units = {
    Equipment: ["Piece", "Set", "Unit"], Manpower: ["Hour", "Day", "Week", "Month"],
    Device: ["Piece", "Set", "Unit"], "Software / subscription": ["License", "Month", "Year"],
    Material: ["Piece", "Kg", "Liter", "Meter", "Pack"], "Venue / space": ["Hour", "Day", "Week", "Month"],
    Training: ["Session", "Course", "Day"], Other: ["Unit", "Item", "Service"]
  };
  const levels = ["Diploma", "Bachelor", "Master", "PhD", "Other"];
  const prototypeStages = ["No, not yet", "Concept drawings or design only", "Proof of concept", "Working prototype", "Tested with real users", "Pre-production or MVP"];
  const hasPrototype = d => prototypeStages.indexOf(d.prototypeStage) >= 2;
  const needsPhotos = d => prototypeStages.indexOf(d.prototypeStage) >= 3;
  const higher = d => d.educationType === "Higher Education";
  const financial = d => (d.supportTypes || []).includes("Financial support");
  const workshop = d => (d.supportTypes || []).includes("Engineering Workshop Access");
  const field = (key, label, type = "text", required = true, extra = {}) => ({ key, label, type, required, ...extra });
  const text = (key, label, required = true, max = 1000, extra = {}) => field(key, label, "textarea", required, { max, ...extra });
  const select = (key, label, options, required = true, extra = {}) => field(key, label, "select", required, { options, ...extra });
  const search = (key, label, options, extra = {}) => field(key, label, "search", true, { options, ...extra });
  const checks = (key, label, options, required = true, extra = {}) => field(key, label, "checks", required, { options, ...extra });
  const upload = (key, label, extensions, required = false, extra = {}) => field(key, label, "file", required, { extensions, maxCount: 1, maxMB: 20, ...extra });
  const repeat = (key, label, fields, required = true, extra = {}) => field(key, label, "repeat", required, { fields, maxRows: 20, ...extra });
  const schema = [
    { id: "instruction", title: "Instructions", sub: "Before you begin, accept our terms and tell us how you're applying.", fields: [
      field("agreeApp", "I agree to the Application terms", "checkbox", true, {
        hint: "Provide truthful information and materials you have permission to share. KII will use your application to assess eligibility and support needs. Submission does not guarantee acceptance or funding. You may submit more than one idea using the same account."
      }),
      select("devArea", "KII development area for your application",
        ["Human Being", "Smart Cities", "House Ware", "Sustainable Energy", "Health", "Education", "Transportation", "IT", "Fashion", "Automation", "Other"],
        true, { when: d => !!d.agreeApp, hint: "Choose the area your idea belongs to. This assigns your application ID code." }),
      field("devAreaOther", "Specify the development area", "multitext", true, { when: d => !!d.agreeApp && d.devArea === "Other" })
    ] },
    { id: "personal", title: "Personal Background", sub: "Tell us who you are, how to reach you, and your background.", fields: [
      field("firstName", "First name (exactly as in passport)"), field("secondName", "Second name (exactly as in passport)"), field("thirdName", "Third name (exactly as in passport)"), field("passportNo", "Passport number", "text", true, { max: 20 }),
      field("birthDate", "Date of birth", "dob", true, { hint: "Type or select your year, month and day." }),
      select("gender", "Gender", ["Male", "Female", "Prefer not to say"]),
      search("country", "Address – Country", () => KIILocations.countries(), { default: "Iraq" }),
            search("city", d => d.country === "Iraq" ? "Province / Main city" : "Address – City",
        d => d.country === "Iraq" ? KIILocations.mainCities() : KIILocations.cities(d.country), { depends: d => !!d.country }),
      field("cityOther", "Specify your governorate or city", "multitext", true, { max: 80, when: d => d.country === "Iraq" && d.city === "Other" }),
      search("town", "Town / district", d => KIILocations.towns(d.city), { required: false,
        when: d => d.country === "Iraq" && KIILocations.townRegions.includes(d.city), depends: d => !!d.city,
        hint: "Optional – select the town or district inside your province." }),
      field("street", "Street address"),
      field("postal", "Postal code", "text", false, { max: 12, hint: "A central postal code is suggested where available. Replace it with your neighbourhood’s code if different." }),
      field("email", "Email", "email", true, { hint: "Use an active email, preferably a personal address that won't expire. Academic and other email types are accepted. Your account can be used for multiple ideas." }),
      select("phoneCode", "Phone country code", phoneCodes),
      field("phone", "Phone number (WhatsApp)", "digits", true, { hint: "Prefilled from your account. Enter digits only, without the country code." }),
      field("linkedIn", "Online profile or website", "multitext", false, { urlEach: true, max: 300, addLabel: "Add another link",
        hint: "Optional: social media profiles, LinkedIn pages, portfolios or personal websites. Include https://. Use + to add more." }),
      select("educationType", "Highest level of education", ["High School or lower", "Higher Education"]),
      field("hsSchool", "School / institution", "text", false, { when: d => d.educationType === "High School or lower" }),
      upload("schoolCertificate", "Transcript or certificate", ["pdf"], false, { when: d => d.educationType === "High School or lower" }),
      repeat("education", "Higher education", [
        select("level", "Degree Level", levels, true, { th: "Degree" }),
        field("levelOther", "Specify degree", "multitext", true, { when: d => d.level === "Other", th: "Degree (other)" }),
        search("country", "Country of education", () => KIILocations.countries(), { default: "Iraq", th: "Country" }),
        search("city", "City of education", d => d.country === "Iraq" ? KIILocations.mainCities() : KIILocations.cities(d.country), { depends: d => !!d.country, th: "City" }),
        search("institution", "University / institution", d => KIILocations.institutions(d.city) || [], {
          freeWhen: d => !listedUniversity(d), depends: d => !!d.country && !!d.city, th: "University",
          hint: "For the Kurdistan Region of Iraq, search and select your university or institute from the list. For other cities, type the institution’s name."
        }),
        select("fieldOfStudy", "Field of Education", ["Engineering", "Education", "Health & Medicine", "Science",
          "Business & Management", "Agriculture", "Computer Science & IT", "Arts & Humanities", "Law", "Social Sciences", "Other"], true, { th: "Field" }),
        field("fieldOfStudyOther", "Specify field of education", "multitext", true, { when: d => d.fieldOfStudy === "Other", th: "Field (other)" }),
        search("startYear", "Study start year", years, { th: "Start" }),
        field("currentlyStudying", "Until present (currently studying)", "checkbox", false, { th: "Ongoing" }),
        search("endYear", "Study end year", years, { when: d => !d.currentlyStudying, th: "End" }),
        upload("transcripts", "Transcripts / certificates", ["pdf"], false, { maxCount: 10, th: "Certificates" })
      ], true, { when: higher, rowMap: row => {
        const ongoing = row.find(a => a.label === "Ongoing")?.value === "Yes";
        const rest = row.filter(a => a.label !== "Ongoing");
        if (ongoing) rest.push({ label: "End", value: "Present" });
        return rest;
      } }),
      upload("photo", "Photograph", ["jpg", "jpeg", "png"]),
      upload("cv", "CV / Resume", ["pdf"]),
      repeat("courses", "Non-degree courses and certifications (optional)", [
        field("courseName", "Course name", "text", true, { max: 150, th: "Course" }),
        field("provider", "Organisation, institute or company that provided the course", "text", true, { max: 150, th: "Provider" }),
        upload("certificate", "Certificate (PDF, JPG or PNG)", ["pdf", "jpg", "jpeg", "png"], false, { maxCount: 3, th: "Certificate" })
      ], false, { addLabel: "Add another course", hint: "Online courses, bootcamps, professional certificates or training. Add one row per course." })
    ] },
    { id: "innovation", title: "Project Information", sub: "Tell us what your idea is, what problem it solves and who it helps.", fields: [
      field("title", "Innovation title", "text", true, { max: 100 }),
      select("sector", "Sector", () => KII.sectorNames()),
      field("sectorOther", "Specify sector", "multitext", true, { when: d => d.sector === "Other" }),
      select("subSector", "Sub-sector", d => KII.subSectorNames(d.sector), true, { when: d => !!d.sector && d.sector !== "Other" }),
      field("subSectorOther", "Specify sub-sector", "multitext", true, { when: d => d.sector && d.sector !== "Other" && d.subSector === "Other" }),
      text("explain", "Short description of your innovation", true, 1000, { min: 300 }),
      text("problem", "What specific problem or challenge does your innovation solve, and how does it solve it?", true, 2000, { min: 300 }),
      text("innovationPoint", "What makes your idea innovative or better than what already exists in the market?", true, 1000, { min: 300 }),
      text("beneficiaries", "Who benefits from your innovation?", true, 1000),
      select("workDuration", "How long have you worked on your project?", ["0–6 months", "7–12 months", "1–2 years", "2–4 years", "More than 4 years"]),
      select("implemented", "Have similar innovations been successfully implemented elsewhere?", ["Yes", "No"]),
      text("implementedWhere", "Where were they implemented, and with what results? Please give examples.", true, 1000, { when: d => d.implemented === "Yes" }),
      checks("sdgs", "UN Sustainable Development Goals supported by your innovation", sdgNames, false, { maxSelect: 5, dropdown: true, icons: sdgIcons })
    ] },
    { id: "team", title: "Your Team", sub: "Tell us who is building this and what skills you have. The evaluation team uses this step to judge whether the idea can actually be built.", fields: [
      checks("roles", "Your role in the innovation", ["Founder", "Co-Founder", "CEO", "COO", "CTO", "Other"], true, { hint: "Select all that apply." }),
      field("roleOther", "Specify your role", "multitext", true, { when: d => (d.roles || []).includes("Other") }),
      repeat("members", "Team members", [
        field("name", "Full name"), field("email", "Email", "email"),
        field("phone", "Phone number with country code", "phone", true, { th: "Phone" }),
        select("role", "Role", ["Founder", "Co-Founder", "CEO", "COO", "CTO", "Other"]),
        field("roleOther", "Specify role", "multitext", true, { when: d => d.role === "Other", th: "Role (other)" }),
        upload("cv", "CV (PDF)", ["pdf"])
      ], true, { addLabel: "Add another team member", hint: "Include yourself and anyone else building the innovation. If you work alone, your own row is sufficient." }),
      checks("skills", "What technical capabilities and relevant experience does your team have?", [
        "Software development", "Electronics and instrumentation", "Product design and fabrication", "CAD and mechanical design",
        "Data science and artificial intelligence", "Laboratory or scientific research", "Civil engineering and construction",
        "Business, finance and marketing", "Other"
      ], true, { hint: "Select all that apply." }),
      field("skillsOther", "Specify other capabilities", "multitext", true, { when: d => (d.skills || []).includes("Other") })
    ] },
    { id: "technical", title: "Technical Background", sub: "Show us how your idea works and how far you have built it.", fields: [
      text("technical", "How does your solution work technically? Describe the key components, technologies and materials involved.", true, 2000, { min: 300 }),
      select("prototypeStage", "Do you have a prototype?", prototypeStages),
      text("testResults", "Have you tested your prototype? Describe how it was tested and the results. If not yet tested, explain what testing is planned.", true, 1500, { when: hasPrototype }),
      select("builtBy", "Who developed the prototype?", ["Our team", "Partly outsourced", "Fully outsourced"], true, { when: hasPrototype }),
      upload("prototypePhotos", "Prototype photos", ["jpg", "jpeg", "png"], needsPhotos, { maxCount: 5, when: hasPrototype, hint: "Required for a working prototype or later stage." }),
      upload("prototypeDemo", "Prototype demo video", ["mp4"], false, { seconds: 180, maxMB: 200, when: hasPrototype }),
      upload("drawings", "Drawings, sketches, schematics or CAD files", ["pdf", "png", "jpg", "jpeg"], false, { maxCount: 10 }),
      checks("prototypeNeeds", "What do you need to build your first or next prototype?", ["Materials & components", "Tools & equipment", "Workshop space", "Engineering expertise", "Software development", "Testing facilities", "Funding", "Other"]),
      field("needsOther", "Specify other prototype needs", "multitext", true, { when: d => (d.prototypeNeeds || []).includes("Other") }),
      text("needsDetail", "Describe what you need for the prototype", true, 500)
    ] },
    { id: "protection", title: "Protection & Rules", sub: "Tell us how your idea is protected and which rules apply to it.", fields: [
      select("ipStatus", "Intellectual property status", ["No protection yet", "Planning to file", "Patent pending", "Patent granted", "Other protection (copyright, trademark, trade secret)"]),
      select("ipOwner", "Who owns the IP?", ["Me", "Our team", "My university", "My employer", "Other"], false),
      field("ipOwnerOther", "Specify IP owner", "multitext", true, { when: d => d.ipOwner === "Other" }),
      select("regulatory", "Does it need a regulatory approval, certification or safety standard (e.g. medical, food, electrical)?", ["Yes", "No", "Not sure"]),
      text("regulatoryDetail", "Which approvals, certifications or standards?", true, 500, { when: d => d.regulatory === "Yes" }),
      select("legalEntity", "Legal entity status", ["Not registered yet (individual / team)", "Registration in progress", "Registered company", "NGO / non-profit", "University or research spin-off"])
    ] },
    { id: "market", title: "Market & Business", sub: "Who will use or buy this, and how could it become a business?", fields: [
      text("targetCustomers", "Who are your target customers or users, and who benefits from it?", true, 1500, { min: 300 }),
      text("competitors", "Who are your competitors or alternatives?", true, 1000),
      select("businessPotential", "Could your idea become a business?", ["Yes", "Maybe", "No"], true, { hint: "Yes — clear potential; Maybe — not sure yet; No." }),
      text("businessDetail", "How would it make money?", true, 1000, { when: d => ["Yes", "Maybe"].includes(d.businessPotential) }),
      select("businessModel", "Business model", ["B2B – selling to businesses", "B2C – selling to consumers", "B2G – selling to government", "Licensing the technology", "Subscription / SaaS", "Marketplace / platform", "Non-profit / grant-funded", "Other"], false),
      field("businessModelOther", "Specify business model", "multitext", true, { when: d => d.businessModel === "Other" }),
      field("traction", "Traction so far", "text", false, { max: 500, hint: "Users, pilots, letters of intent, revenue…" }),
      upload("pitchDeck", "Pitch deck or business plan (optional)", ["pdf"])
    ] },
    { id: "support", title: "Support from KII", sub: "What do you need from KII, and what will you achieve with it?", fields: [
      checks("supportTypes", "What support do you need from KII?", ["Consulting", "Mentorship", "Engineering Workshop Access", "Financial support"], true, {
        descriptions: ["Specialist advice on a specific project challenge.", "Ongoing guidance to develop your project and skills.", "Access to facilities, tools and prototyping equipment.", "Funding for specific project requirements."]
      }),
      checks("facilities", "Which facilities do you need from KII?", ["3D printing", "CNC or laser cutting", "Electronics lab", "Metal or wood workshop", "Computing or software support", "Testing & measurement equipment", "Other"], true, { when: workshop }),
      field("facilitiesOther", "Specify other facilities", "multitext", true, { when: d => workshop(d) && (d.facilities || []).includes("Other") }),
      select("reqCurrency", "Currency for the whole request", ["USD", "IQD"], true, { when: financial, default: "USD", hint: "One currency applies to every item below." }),
      repeat("requirements", "Financial support request", [
        field("rqItem", "Item", "text", true, { max: 150 }),
        select("rqType", "Type", Object.keys(units), false),
        field("rqQty", "Qty", "number", true, { minValue: 0.01, default: 1 }),
        select("rqUnit", "Unit", d => units[d.rqType] || units.Other, false),
        field("rqCost", "Cost per unit", "number", true, { minValue: 0.01, th: "Unit cost" }),
        field("rqNote", "Purpose / notes", "text", false, { max: 500, th: "Notes" })
      ], true, { when: financial, table: true, addLabel: "Add another request", hint: "Costs are in the currency selected above." }),
      repeat("milestones", "Key milestones for the next 12 months", [
        field("milestone", "Milestone", "text", true, { max: 150 }),
        select("month", "Target month", Array.from({ length: 12 }, (_, i) => String(i + 1)), true, { th: "Month" })
      ], true, { table: true, maxRows: 5 }),
      select("otherSupport", "Have you received or applied for support from another organisation?", ["Yes", "No"]),
      repeat("organisations", "Other support", [
        field("organisation", "Organisation"), field("month", "Month / year", "month"),
        select("type", "Type", ["Financial", "Mentorship", "Consulting", "Other"]),
        field("typeOther", "Specify type", "multitext", true, { when: d => d.type === "Other" }),
        field("amount", "Amount (optional)", "number", false, { minValue: 0 }),
        select("currency", "Currency, if amount entered", ["USD", "IQD"], false, { default: "USD" })
      ], true, { when: d => d.otherSupport === "Yes" })
    ] },
    { id: "statement", title: "Applicant Statement & References", sub: "In your own words: why you, why now, and why KII.", fields: [
      upload("video", "Video statement", ["mp4"], true, { seconds: 60, maxMB: 200, hint: "Introduce yourself, your idea, and what you hope to gain from KII. Required MP4, up to 60 seconds." }),
      select("appliedBefore", "Have you applied to or joined KII before?", ["Yes", "No"]),
      field("beforeDetail", "When and which program?", "text", true, { max: 1000, when: d => d.appliedBefore === "Yes" }),
      select("heardFrom", "How did you hear about KII?", ["Social media", "Website or online search", "Word of mouth", "KII event or workshop", "Local media (TV, radio, newspaper)", "Educational institution", "Other"]),
      field("heardOther", "Specify how you heard about KII", "multitext", true, { when: d => d.heardFrom === "Other" }),
      repeat("references", "Recommenders (optional)", [
        field("name", "Full name"), field("email", "Email", "email"),
        text("description", "Relationship / recommendation description", false),
        upload("letter", "Recommendation letter (optional)", ["pdf"])
      ], false, { hint: "You may add a referee and describe your relationship, or leave this section empty." }),
      text("anythingElse", "Anything else you'd like us to know?", false),
      upload("additional", "Additional document (optional)", ["pdf", "doc", "docx", "ppt", "pptx"])
    ] },
    { id: "review", title: "Review & Submit", sub: "Check everything before you send it.", fields: [] }
  ];
  /* Master-Admin Form Builder: publish the built-in questions, then apply label/required edits,
     hidden questions and custom questions saved in the staff portal. */
  try {
    localStorage.setItem("kii_form_schema", JSON.stringify(schema.filter(s => s.id !== "review").map(s => ({
      id: s.id, title: s.title, fields: s.fields.map(f => ({ key: f.key, type: f.type, required: f.required === true,
        label: typeof f.label === "string" ? f.label : f.key, hint: f.hint || "", conditional: !!f.when })) }))));
  } catch { }
  (function applyFormCustom() {
    const cfg = KII.formCustom(), hidden = new Set(cfg.hidden || []), overrides = cfg.overrides || {};
    const make = c => {
      const opts = (c.options || []).filter(Boolean), extra = { hint: c.hint || undefined, custom: true };
      if (c.type === "textarea") return text(c.key, c.label, !!c.required, c.max || 2000, extra);
      if (c.type === "select") return select(c.key, c.label, opts, !!c.required, extra);
      if (c.type === "yesno") return select(c.key, c.label, ["Yes", "No"], !!c.required, extra);
      if (c.type === "checks") return checks(c.key, c.label, opts, !!c.required, extra);
      if (c.type === "file") return upload(c.key, c.label, (c.extensions || ["pdf"]), !!c.required, { ...extra, maxCount: c.maxCount || 3 });
      if (c.type === "number") return field(c.key, c.label, "number", !!c.required, extra);
      if (c.type === "date") return field(c.key, c.label, "date", !!c.required, extra);
      if (c.type === "url") return field(c.key, c.label, "url", !!c.required, extra);
      return field(c.key, c.label, "text", !!c.required, { ...extra, max: c.max || 300 });
    };
    for (const s of schema) {
      s.fields = s.fields.filter(f => !hidden.has(`${s.id}.${f.key}`)).map(f => {
        const o = overrides[`${s.id}.${f.key}`];
        if (!o) return f;
        return { ...f, ...(o.label ? { label: o.label } : {}), ...(o.hint != null && o.hint !== "" ? { hint: o.hint } : {}),
          ...(typeof o.required === "boolean" && typeof f.required !== "function" ? { required: o.required } : {}) };
      });
      for (const c of (cfg.custom || []).filter(c => c.section === s.id && c.active !== false)) {
        const at = c.after ? s.fields.findIndex(f => f.key === c.after) : -1;
        s.fields.splice(at >= 0 ? at + 1 : s.fields.length, 0, make(c));
      }
    }
  })();

  const SCHEMA_VERSION = 3;
  function migrate(old) {
    if (old.schemaVersion >= SCHEMA_VERSION) return old;
    if (old.schemaVersion === 2) return upgradeV2(old);
    const d = old.data || {}, p = d.personal || {}, s = d.supporting || {}, e = d.education || {}, k = d.kii || {};
    const sectorMap = { "Renewable Energy": "Sustainable Energy", "Computer and AI": "Technology", Fashion: "Fashion & Design" };
    const heardMap = { "KII website": "Website or online search", "Friend or family": "Word of mouth", "University / School": "Educational institution", "Event or workshop": "KII event or workshop", "Social media": "Social media" };
    const roleMap = { "Co-Founder": "Co-founder", Member: "Other" };
    const ipMap = { "No IP protection yet": "No protection yet", "Patent planned": "Planning to file", "Patent filed / pending": "Patent pending", "Patent granted": "Patent granted", "Trade secret / know-how": "Other protection (copyright, trademark, trade secret)", "Copyright / design registration": "Other protection (copyright, trademark, trade secret)" };
    const mapped = {
      ...old, schemaVersion: 2, legacyData: JSON.parse(JSON.stringify(d)),
      currentSection: "instruction", completedSections: [],
      data: {
        instruction: { agreeApp: !!d.instruction?.agreeApp },
        personal: { ...p, ...(p.phone ? { phone: digits(String(p.phone).replace(/^\([^)]*\)\s*/, "")) } : {}), educationType: e.type === "higher" ? "Higher Education" : e.type === "highschool" ? "High School or lower" : "",
          hsSchool: e.hsSchool, education: (e.entries || []).map(en => ({ ...en, files: { transcripts: Object.values(en.files || {}).flatMap(asFiles) } })),
          work: d.nondegree?.work || "", courses: d.nondegree?.courses || "",
          files: { cv: s.files?.cv, photo: s.files?.photo, courseCertificates: d.nondegree?.files?.docs } },
        innovation: { title: s.title, sector: sectorMap[s.category] || s.category || sectorMap[old.category] || old.category,
          explain: s.explain, problem: s.problem, innovationPoint: s.innovationPoint, beneficiaries: s.beneficiaries,
          workDuration: { "Less than 6 months": "0–6 months", "6–12 months": "7–12 months" }[s.workDuration] || (s.workDuration === "1–2 years" ? s.workDuration : ""),
          implemented: s.implemented, implementedWhere: s.implementedWhere, sdgs: s.sdgs || [] },
        team: { roles: s.role ? [roleMap[s.role] || s.role] : [], roleOther: s.roleOther || (s.role === "Member" ? "Member" : ""),
          members: [{ name: fullName, email: user.email, role: s.role || "", phone: (accountPhone?.[1] || "+964") + digits(accountPhone?.[2]) },
            ...(s.team || []).map(m => ({ name: m.tmName, email: m.tmEmail, role: m.tmRole, phone: m.tmPhone || "" }))] },
        prototype: { ipStatus: ipMap[s.ipStatus] || "", legalEntity: s.legalEntity,
          files: { drawings: d.nondegree?.files?.images } },
        market: { targetCustomers: s.targetCustomers, competitors: s.competitors, businessPotential: s.businessPotential,
          businessDetail: s.businessDetail, businessModel: s.businessModel, traction: s.traction, files: { pitchDeck: s.files?.pitchDeck } },
        support: { supportTypes: (s.requirements || []).length ? ["Financial support"] : [],
          reqCurrency: "USD", requirements: s.requirements || [], previousMilestones: s.milestonesPlan || "", previousFunding: s.otherFunding || "" },
        statement: { appliedBefore: k.appliedBefore, beforeDetail: k.beforeDetail, heardFrom: heardMap[k.heardFrom] || "",
          anythingElse: d.video?.note || "", files: { video: d.video?.files?.video },
          references: (d.recommendations?.entries || []).map(r => ({ name: r.rcName, email: r.rcEmail, description: r.rcRelation, files: { letter: Object.values(r.files || {}).flatMap(asFiles) } })) }
      }
    };
    return upgradeV2(mapped);
  }
  /* Version 3: Technical Background and Protection & Rules are separate steps, courses are rows,
     citizenship and work history were removed. Removed answers stay in retiredData for the record. */
  function upgradeV2(v2) {
    const data = v2.data || {}, p = data.personal || {}, proto = data.prototype || {}, inn = data.innovation || {};
    const retired = {};
    const take = (obj, keys, label) => { for (const key of keys) if (obj?.[key]) (retired[label] ||= {})[key] = obj[key]; };
    take(p, ["primaryCitizenship", "dualCitizenship", "work"], "personal");
    take(inn, ["innovationType", "innovationTypeOther", "workDurationOther"], "innovation");
    take(proto, ["risks", "capabilities", "testMethods"], "prototype");
    const courses = Array.isArray(p.courses) ? p.courses : p.courses ? [{ courseName: String(p.courses).slice(0, 150), provider: "", files: { certificate: asFiles(p.files?.courseCertificates) } }] : [];
    const personal = { ...p, courses };
    ["primaryCitizenship", "dualCitizenship", "work"].forEach(key => delete personal[key]);
    if (personal.files) delete personal.files.courseCertificates;
    const innovation = { ...inn, workDuration: inn.workDuration === "Other" ? "" : inn.workDuration };
    ["innovationType", "innovationTypeOther", "workDurationOther"].forEach(key => delete innovation[key]);
    if (!KII.sectorNames().includes(innovation.sector) && innovation.sector) { innovation.sectorOther = innovation.sectorOther || innovation.sector; innovation.sector = "Other"; }
    const technical = { technical: proto.technical, prototypeStage: proto.prototypeStage, testResults: [proto.capabilities, proto.testResults].filter(Boolean).join("\n\n"),
      builtBy: proto.builtBy, prototypeNeeds: proto.prototypeNeeds, needsDetail: proto.needsDetail, files: proto.files || {} };
    const protection = { ipStatus: proto.ipStatus, ipOwner: proto.ipOwner, regulatory: proto.regulatory, regulatoryDetail: proto.regulatoryDetail, legalEntity: proto.legalEntity };
    const { prototype: _old, ...rest } = data;
    const members = (data.team?.members || []).map(m => ({ ...m, files: m.files || {} }));
    return { ...v2, schemaVersion: SCHEMA_VERSION, retiredData: { ...(v2.retiredData || {}), ...retired },
      currentSection: v2.currentSection === "prototype" ? "technical" : v2.currentSection, completedSections: [],
      data: { ...rest, personal, innovation, team: { ...(data.team || {}), members }, technical, protection } };
  }
  app = migrate(app);
  document.body.classList.add("merged-application");
  const personal = app.data.personal = app.data.personal || {};
  const defaults = { firstName: user.firstName, secondName: user.secondName, thirdName: user.thirdName,
    birthDate: user.dob, email: user.email, passportNo: user.passport, country: user.country || "Iraq", city: user.city, town: user.town,
    linkedIn: user.website ? [user.website] : undefined,
    phoneCode: accountPhone?.[1] || "+964", phone: digits(accountPhone?.[2]) };
  for (const [key, value] of Object.entries(defaults)) if (personal[key] == null) personal[key] = value || (Array.isArray(value) ? [] : "");
  personal.phoneCode = String(personal.phoneCode || "+964").split(" ")[0];
  personal.phone = String(personal.phone || "").replace(/^\([^)]*\)\s*/, "");
  // Keep original date fields on older drafts; use their year in the new controls.
  personal.city = KIILocations.canonicalCity(personal.country, personal.city || "");
  // Two-level Iraqi address: move a saved town into its governorate + town fields.
  if (personal.country === "Iraq" && personal.city && !KIILocations.mainCities().includes(personal.city)) {
    const gov = KIILocations.governorateOf(personal.city);
    if (gov) { personal.town = personal.town || personal.city; personal.city = gov; }
    else { personal.cityOther = personal.cityOther || personal.city; personal.city = "Other"; }
  }
  for (const row of personal.education || []) {
    if (row.country === "Iraq" && row.city && !KIILocations.mainCities().includes(row.city))
      row.city = KIILocations.governorateOf(row.city) || "Other";
    if (row.startYear == null && row.startDate) row.startYear = row.startDate.slice(0, 4);
    if (row.endYear == null && row.endDate) row.endYear = row.endDate.slice(0, 4);
    row.city = KIILocations.canonicalCity(row.country, row.city || "");
  }
  if (!app.data.team) app.data.team = { members: [{ name: fullName, email: user.email, role: "", phone: personal.phoneCode + digits(personal.phone) }] };
  const toList = v => Array.isArray(v) ? v : (v ? [String(v)] : []);
  const multiKeys = { personal: ["cityOther", "linkedIn"], instruction: ["devAreaOther"], innovation: ["sectorOther", "subSectorOther"],
    team: ["roleOther", "skillsOther"], technical: ["needsOther"], protection: ["ipOwnerOther"],
    market: ["businessModelOther"], support: ["facilitiesOther"], statement: ["heardOther"] };
  for (const [section, keys] of Object.entries(multiKeys))
    for (const k of keys) { const sec = app.data[section] || {}; if (sec[k] != null && !Array.isArray(sec[k])) sec[k] = toList(sec[k]); }
  const roleOpts = ["Founder", "Co-Founder", "CEO", "COO", "CTO", "Other"];
  for (const m of (app.data.team || {}).members || [])
    if (m.role && !roleOpts.includes(m.role)) { m.roleOther = [...new Set(toList(m.roleOther).concat(m.role))]; m.role = "Other"; }
  const fieldOpts = ["Engineering", "Education", "Health & Medicine", "Science", "Business & Management", "Agriculture", "Computer Science & IT", "Arts & Humanities", "Law", "Social Sciences", "Other"];
  for (const row of personal.education || [])
    if (row.fieldOfStudy && !fieldOpts.includes(row.fieldOfStudy)) { row.fieldOfStudyOther = [...new Set(toList(row.fieldOfStudyOther).concat(row.fieldOfStudy))]; row.fieldOfStudy = "Other"; }
  { const sup = app.data.support || {};
    if (!sup.reqCurrency && (sup.requirements || []).length) sup.reqCurrency = sup.requirements.find(r => r.rqCurrency)?.rqCurrency === "IQD" ? "IQD" : "USD";
    for (const r of sup.requirements || []) delete r.rqCurrency; }
  for (const row of (app.data.support || {}).organisations || [])
    if (row.typeOther != null && !Array.isArray(row.typeOther)) row.typeOther = toList(row.typeOther);
  for (const row of personal.education || [])
    if (row.levelOther != null && !Array.isArray(row.levelOther)) row.levelOther = toList(row.levelOther);

  const visible = (f, d) => !f.when || f.when(d);
  const fLabel = (f, d) => typeof f.label === "function" ? f.label(d) : f.label;
  const required = (f, d) => typeof f.required === "function" ? f.required(d) : f.required;
  const options = (f, d) => typeof f.options === "function" ? f.options(d) : f.options || [];
  function validate(fields, d = {}, prefix = "") {
    const errors = [];
    for (const f of fields) {
      if (!visible(f, d)) continue;
      const value = f.type === "file" ? asFiles(d.files?.[f.key]) : d[f.key];
      const label = prefix + fLabel(f, d);
      const empty = value == null || (typeof value === "string" && !value.trim()) || value === false || (Array.isArray(value) && !value.length);
      if (required(f, d) && empty) { errors.push(label + " is required."); continue; }
      if (empty) continue;
      if (f.type === "repeat") {
        if (!Array.isArray(value)) { errors.push(label + ": invalid rows."); continue; }
        if (value.length > f.maxRows) errors.push(`${label}: maximum ${f.maxRows} rows.`);
        value.forEach((row, i) => errors.push(...validate(f.fields, row, `${label}, row ${i + 1} — `)));
        continue;
      }
      if (f.type === "file") {
        if (value.length > f.maxCount) errors.push(`${label}: maximum ${f.maxCount} file(s).`);
        for (const file of value) {
          if (!f.extensions.includes(String(file.name || "").split(".").pop().toLowerCase())) errors.push(`${label}: accepted formats are ${f.extensions.join(", ")}.`);
          if (!file.fileId || file.tooLarge) errors.push(`${label}: upload is unavailable; please upload the file again.`);
          if (file.size > f.maxMB * 1024 * 1024) errors.push(`${label}: each file must be ${f.maxMB} MB or smaller.`);
          if (f.seconds && (!Number.isFinite(file.duration) || file.duration > f.seconds || file.duration <= 0)) errors.push(`${label}: upload a playable video of ${f.seconds} seconds or less. Open this step to verify an existing video.`);
        }
        continue;
      }
      if ((f.type === "select" || (f.type === "search" && !f.freeWhen?.(d))) && !options(f, d).includes(value)) errors.push(label + ": choose a listed option.");
      if (f.type === "checks") {
        if (!Array.isArray(value) || value.some(v => !options(f, d).includes(v))) errors.push(label + ": choose listed options.");
        else if (f.maxSelect && value.length > f.maxSelect) errors.push(`${label}: choose up to ${f.maxSelect}.`);
        continue;
      }
      if (f.type === "multitext") {
        const items = Array.isArray(value) ? value : (value ? [String(value)] : []);
        for (const item of items) {
          if (f.max && item.length > f.max) errors.push(`${label}: maximum ${f.max} characters per entry.`);
          if (f.urlEach) { try { const u = new URL(item); if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) throw Error(); } catch { errors.push(label + ": enter full http:// or https:// links."); break; } }
        }
        continue;
      }
      const length = String(value).trim().length;
      if (f.min && length < f.min) errors.push(`${label}: enter at least ${f.min} characters (${length} entered).`);
      if (f.max && length > f.max) errors.push(`${label}: maximum ${f.max} characters.`);
      if (f.type === "email" && !validEmail(value)) errors.push(label + ": enter a valid email address.");
      if (f.key === "postal" && (d.country === "Iraq" ? !/^\d{5}$/.test(value) : !/^[A-Za-z0-9][A-Za-z0-9 -]{0,11}$/.test(value))) errors.push(label + (d.country === "Iraq" ? ": enter five digits for Iraq." : ": use letters, digits, spaces or hyphens."));
      if (f.type === "url") {
        try { const url = new URL(value); if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) throw Error(); }
        catch { errors.push(label + ": enter a full http:// or https:// URL."); }
      }
      if (f.type === "digits" && !/^\d+$/.test(value)) errors.push(label + ": use digits only.");
      if (f.key === "phone" && f.type === "digits" && (digits(d.phoneCode + value).length < 7 || digits(d.phoneCode + value).length > 15)) errors.push(label + ": use a valid number (7–15 digits including country code).");
      if (f.type === "phone" && !/^\+\d{7,15}$/.test(value)) errors.push(label + ": use + followed by 7–15 digits, including country code.");
      if (["date", "dob"].includes(f.type) && (!validDate(value) || (f.past && value > today()) || (f.type === "dob" && value >= today()))) errors.push(label + ": enter a valid date" + (f.past || f.type === "dob" ? " in the past." : "."));
      if (f.type === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) errors.push(label + ": enter a valid month and year.");
      if (f.type === "number" && (!Number.isFinite(Number(value)) || Number(value) < (f.minValue ?? 0))) errors.push(`${label}: enter a number of at least ${f.minValue ?? 0}.`);
    }
    if (d.startYear && d.endYear && !d.currentlyStudying && Number(d.endYear) < Number(d.startYear)) errors.push(prefix + "Study end year cannot be before start year.");
    if ((d.testMethods || []).includes("Not tested yet") && d.testMethods.length > 1) errors.push("Choose “Not tested yet” alone, or select the tests you performed.");
    return errors;
  }
  function validEmail(value) {
    const email = String(value);
    if (email.length > 254 || email.split("@").length !== 2) return false;
    const [local, domain] = email.split("@");
    return local.length <= 64 && /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local) &&
      domain.length <= 253 && domain.split(".").length >= 2 &&
      domain.split(".").every(label => label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)) &&
      /^[A-Za-z]{2,63}$/.test(domain.split(".").pop());
  }
  function active(fields, data = {}) {
    const out = {};
    for (const f of fields.filter(f => visible(f, data))) {
      if (f.type === "file") { (out.files ||= {})[f.key] = data.files?.[f.key] || []; }
      else if (f.type === "repeat") out[f.key] = (data[f.key] || []).map(row => active(f.fields, row));
      else out[f.key] = data[f.key] ?? (["checks", "multitext"].includes(f.type) ? [] : "");
    }
    return out;
  }
  function summary(fields, d = {}) {
    const answers = fields.filter(f => visible(f, d)).map(f => {
      const value = d[f.key];
      if (f.type === "file") return { label: f.th || fLabel(f, d), files: asFiles(d.files?.[f.key]) };
      if (f.type === "repeat") return { label: fLabel(f, d), rows: (value || []).map(row => f.rowMap ? f.rowMap(summary(f.fields, row)) : summary(f.fields, row)) };
      return { label: f.th || fLabel(f, d), value: f.type === "checkbox" ? (value ? "Yes" : "No") : Array.isArray(value) ? value.join(", ") : String(value ?? "") };
    });
    if (fields.some(f => f.key === "requirements") && financial(d)) {
      const cur = d.reqCurrency === "IQD" ? "IQD" : "USD";
      const total = (d.requirements || []).reduce((sum, row) => sum + (Number(row.rqQty) || 0) * (Number(row.rqCost) || 0), 0);
      answers.push({ label: "Requested totals", value: `${total.toLocaleString()} ${cur}` });
    }
    return answers;
  }
  async function persist() {
    app.activeData = Object.fromEntries(schema.filter(s => s.id !== "review").map(s => [s.id, active(s.fields, app.data[s.id] || {})]));
    app.reviewSections = schema.filter(s => s.id !== "review").map(s => ({ id: s.id, title: s.title, answers: summary(s.fields, app.data[s.id] || {}) }));
    app.completedSections = schema.filter(s => s.id !== "review" && !validate(s.fields, app.data[s.id] || {}).length).map(s => s.id);
    if (app.submitted) app.completedSections.push("review");
    app.category = app.data.innovation?.sector || app.category || "";
    if (!app.applicantCode && app.data.instruction?.devArea) app.applicantCode = await KII.nextApplicantCode(app.data.instruction.devArea);
    if (!KII.saveApplication(user.email, app)) throw new Error("Your changes could not be saved. Please free browser storage and try again.");
  }
  function videoSeconds(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video"), url = URL.createObjectURL(file);
      const finish = (error, duration) => {
        clearTimeout(timer); video.onloadedmetadata = video.onerror = null;
        video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url);
        error ? reject(new Error(error)) : resolve(duration);
      };
      const timer = setTimeout(() => finish("Could not read this video. Please upload a playable MP4."), 15000);
      video.preload = "metadata";
      video.onloadedmetadata = () => finish(!Number.isFinite(video.duration) || video.duration <= 0 ? "Could not read video duration." : null, video.duration);
      video.onerror = () => finish("Could not read this video. Please upload a playable MP4.");
      video.src = url;
    });
  }
  let current = schema.some(s => s.id === params.get("s")) ? params.get("s") : (app.currentSection || "instruction");
  if (!schema.some(s => s.id === current)) current = "instruction";
  let busy = false;
  const body = $("#sectionBody");
  const locked = () => !!app.submitted || app.status === "Withdrawn";
  const errorBox = $("#alert");
  function showError(message) { errorBox.textContent = message || ""; errorBox.classList.toggle("hidden", !message); if (message) window.scrollTo({ top: 0, behavior: "smooth" }); }
  function searchControl(id, value, attributes = "") {
    return `<div class="search-choice">
      <div class="search-entry"><input id="${esc(id)}" ${attributes} type="text" value="${esc(value)}"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${esc(id)}-options" autocomplete="off">
        <button type="button" class="search-toggle" aria-label="Show choices" tabindex="-1">&#9662;</button></div>
      <div class="search-options" id="${esc(id)}-options" role="listbox" hidden></div>
      <div class="hint search-status" role="status" aria-live="polite"></div>
    </div>`;
  }
  function bindSearch(widget, getOptions, free = () => false) {
    const input = $("input", widget), toggle = $(".search-toggle", widget), list = $(".search-options", widget);
    const status = $(".search-status", widget);
    let index = -1, shown = [], filtering = false;
    function close() {
      list.hidden = true; input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant"); status.textContent = ""; index = -1;
    }
    function choose(value) {
      input.value = value; close();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      close(); input.focus();
    }
    function show(filter = false) {
      if (input.disabled || free()) return close();
      filtering = filter;
      const matches = getOptions().filter(value => !filter || KIILocations.matches(value, input.value));
      shown = matches.slice(0, 100); index = -1;
      list.replaceChildren();
      shown.forEach((value, i) => {
        const option = document.createElement("div");
        option.id = list.id + "-" + i; option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false"); option.textContent = value;
        option.addEventListener("mousedown", e => e.preventDefault());
        option.addEventListener("click", () => choose(value));
        list.appendChild(option);
      });
      list.hidden = false; input.setAttribute("aria-expanded", "true");
      input.removeAttribute("aria-activedescendant");
      status.textContent = matches.length > 100 ? "Showing the first 100 matches. Type more to narrow the choices."
        : !matches.length ? "No matching choices. Check the spelling or select a different location." : "";
    }
    input.addEventListener("focus", () => show());
    input.addEventListener("click", () => { if (list.hidden) show(); });
    input.addEventListener("input", () => show(true));
    input.addEventListener("blur", close);
    toggle.addEventListener("mousedown", e => e.preventDefault());
    toggle.addEventListener("click", () => {
      if (!list.hidden) close(); else { input.focus(); show(); }
    });
    input.addEventListener("keydown", e => {
      if (free()) return;
      if (e.key === "Escape") { close(); e.preventDefault(); }
      if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault(); if (list.hidden) show();
        if (!shown.length) return;
        index = (index + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
        [...list.children].forEach((option, i) => option.setAttribute("aria-selected", String(i === index)));
        const option = list.children[index];
        input.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView?.({ block: "nearest" });
      }
      if (e.key === "Enter" && !list.hidden) {
        e.preventDefault(); if (index >= 0 || shown.length === 1) choose(shown[Math.max(index, 0)]);
      }
      if (e.key === "Tab") close();
    });
    widget.refreshChoices = () => {
      toggle.hidden = free();
      input.setAttribute("role", free() ? "textbox" : "combobox");
      input.placeholder = free() ? "Enter institution name" : "Type to search or select";
      if (free() || input.disabled) close();
      else if (!list.hidden) show(filtering);
    };
    widget.refreshChoices();
  }
  const chipSummary = (f, chosen) => (chosen.length
    ? chosen.map(o => `<span class="choice-chip">${f.icons?.[o] ? `<span aria-hidden="true">${f.icons[o]}</span> ` : ""}${esc(o)}</span>`).join("")
    : '<span class="hint">Select goals…</span>') + '<span class="search-toggle" aria-hidden="true">&#9662;</span>';
  function controls(f, d, path) {
    const value = d[f.key] ?? f.default ?? "";
    const id = "f-" + path.replaceAll(".", "-");
    const common = `id="${esc(id)}" data-key="${f.key}" ${f.max ? `maxlength="${f.max}"` : ""}`;
    if (f.type === "search") return searchControl(id, value, `data-key="${f.key}"`);
    if (f.type === "textarea") return `<textarea ${common} rows="4">${esc(value)}</textarea><div class="hint char-meter">${String(value).length}${f.max ? " / " + f.max : ""} characters${f.min ? " · minimum " + f.min : ""}</div>`;
    if (f.type === "select") return `<select ${common}><option value="">Select…</option>${options(f, d).map(o => `<option value="${esc(o)}" ${value === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    if (f.type === "checkbox") return `<label class="checkbox-line"><input ${common} type="checkbox" ${value ? "checked" : ""}> ${esc(fLabel(f, d))}${required(f, d) ? ' <span class="req">*</span>' : ""}</label>`;
    if (f.type === "checks") {
      const chosen = Array.isArray(value) ? value : [];
      const list = `<div id="${id}" class="merged-choices${f.dropdown ? " merged-dropdown-list" : ""}">${options(f, d).map((o, i) => `<label class="checkbox-line"><input data-key="${f.key}" type="checkbox" value="${esc(o)}" ${chosen.includes(o) ? "checked" : ""}><span>${f.icons?.[o] ? `<span class="choice-icon" aria-hidden="true">${f.icons[o]}</span> ` : ""}${esc(o)}${f.descriptions ? `<small class="hint">${esc(f.descriptions[i])}</small>` : ""}</span></label>`).join("")}</div>`;
      const cap = f.maxSelect ? `<div class="hint choice-count">Choose up to ${f.maxSelect}. Selected: ${chosen.length} of ${f.maxSelect}.</div>` : "";
      if (!f.dropdown) return list + cap;
      return `<details class="merged-dropdown"><summary class="merged-dropdown-summary">${chipSummary(f, chosen)}</summary>${list}</details>${cap}`;
    }
    if (f.type === "dob") {
      const [year, month, day] = String(value).split("-");
      return `<div class="birth-date">${[["Year", year], ["Month", month], ["Day", day]].map(([label, selected], i) => {
        const partId = i === 0 ? id : id + "-" + label;
        return `<div><label for="${partId}">${label}</label>${searchControl(partId, selected || "",
          `data-date="${label}" aria-label="Birth ${label.toLowerCase()}" inputmode="numeric" maxlength="${i === 0 ? 4 : 2}"`)}</div>`;
      }).join("")}</div>`;
    }
    if (f.type === "multitext") {
      const items = Array.isArray(value) ? value : (value ? [String(value)] : []);
      return `<div class="multitext">${(items.length ? items : [""]).map(v =>
        `<div class="multitext-row"><input type="text" data-key="${f.key}" value="${esc(v)}" ${f.max ? `maxlength="${f.max}"` : ""} placeholder="Specify" ${f.urlEach ? 'inputmode="url"' : ""}><button type="button" class="req-del mt-del" aria-label="Remove">\u00d7</button></div>`).join("")}
        <button type="button" class="req-add mt-add"><span class="req-add-plus" aria-hidden="true">+</span> ${esc(f.addLabel || "Add another")}</button></div>`;
    }
    if (f.type === "file") {
      const files = asFiles(d.files?.[f.key]);
      return `<input ${common} type="file" accept="${f.extensions.map(e => "." + e).join(",")}" ${f.maxCount > 1 ? "multiple" : ""}>
        <div class="hint">${f.extensions.join(", ").toUpperCase()} · up to ${f.maxCount} file(s), ${f.maxMB} MB each${f.seconds ? " · maximum " + f.seconds + " seconds" : ""}. New files replace this field’s previous files.</div>
        <div class="saved-files">${files.map(file => `<div>${file.fileId ? `<button type="button" class="merged-file" data-file="${esc(file.fileId)}" data-name="${esc(file.name)}">${esc(file.name)}</button>` : esc(file.name)}</div>`).join("")}</div>
        ${files.length ? '<button type="button" class="btn btn-secondary btn-sm clear-upload">Remove saved files</button>' : ""}`;
    }
    return `<input ${common} type="${["date", "month", "email", "url", "number"].includes(f.type) ? f.type : "text"}" value="${esc(value)}"
      ${f.type === "digits" ? 'inputmode="numeric" pattern="[0-9]*"' : ""}
      ${f.type === "number" ? `step="any" min="${f.minValue ?? 0}"` : ""} ${f.past ? `max="${today()}"` : ""}>`;
  }
  function renderFields(fields, d, root, prefix) {
    for (const f of fields) if (d[f.key] == null && f.default != null && !locked()) d[f.key] = f.default;
    for (const f of fields) {
      const wrap = document.createElement(root.tagName === "TR" ? "td" : "div");
      wrap.className = "field merged-field";
      wrap.dataset.field = f.key;
      wrap._schema = f; wrap._data = d;
      const path = prefix + "." + f.key;
      if (f.type === "repeat") {
        wrap.innerHTML = `<h3>${esc(fLabel(f, d))}${required(f, d) ? ' <span class="req">*</span>' : ""}</h3>${f.hint ? `<p class="hint">${esc(f.hint)}</p>` : ""}
          ${f.table ? `<div class="merged-table"><table class="merged-table-grid"><thead><tr>${f.fields.map(column => `<th scope="col">${esc(column.label)}</th>`).join("")}<th scope="col">Remove</th></tr></thead><tbody class="repeat-rows"></tbody></table></div>` : '<div class="repeat-rows"></div>'}
          <button type="button" class="req-add add-row"><span class="req-add-plus" aria-hidden="true">+</span> ${esc(f.addLabel || "Add another row")}</button>
          ${f.key === "requirements" ? '<div class="detail-row"><b>Requested totals</b><output class="budget-totals"></output></div>' : ""}`;
        const rows = $(".repeat-rows", wrap);
        if (!d[f.key]) d[f.key] = [];
        if (!d[f.key].length && required(f, d)) d[f.key].push({});
        function addRow(row) {
          const element = document.createElement(f.table ? "tr" : "div");
          element.className = "merged-row" + (f.table ? " merged-table-row" : " repeat-block");
          element._data = row;
          renderFields(f.fields, row, element, path + "." + crypto.randomUUID());
          const remove = document.createElement("button");
          remove.type = "button"; remove.className = "req-del";
          remove.textContent = "×"; remove.setAttribute("aria-label", "Remove row");
          remove.addEventListener("click", () => { element.remove(); app.declarations = { truth: false }; syncRows(); });
          if (f.table) { const cell = document.createElement("td"); cell.appendChild(remove); element.appendChild(cell); }
          else element.appendChild(remove);
          rows.appendChild(element);
        }
        function syncRows() {
          d[f.key] = Array.from(rows.children).map(row => { syncFields(f.fields, row._data, row); return row._data; });
          $(".add-row", wrap).disabled = locked() || d[f.key].length >= f.maxRows;
          refreshConditions(fields, d, root);
        }
        d[f.key].forEach(addRow);
        $(".add-row", wrap).addEventListener("click", () => {
          if (rows.children.length >= f.maxRows) return;
          app.declarations = { truth: false };
          addRow({}); syncRows();
          rows.lastElementChild?.querySelector("input,select,textarea")?.focus();
        });
        rows.addEventListener("input", syncRows);
        rows.addEventListener("change", syncRows);
      } else {
        wrap.innerHTML = `${f.type !== "checkbox" ? `<label for="f-${esc(path.replaceAll(".", "-"))}">${esc(fLabel(f, d))}${f.required ? ` <span class="req" ${required(f, d) ? "" : "hidden"}>*</span>` : ""}</label>` : ""}
          ${f.hint ? `<p class="hint">${esc(f.hint)}</p>` : ""}${controls(f, d, path)}`;
        if (f.type === "multitext") {
          const list = $(".multitext", wrap);
          list.addEventListener("click", e => {
            if (e.target.closest(".mt-add")) {
              const row = document.createElement("div"); row.className = "multitext-row";
              row.innerHTML = `<input type="text" data-key="${f.key}" ${f.max ? `maxlength="${f.max}"` : ""} placeholder="Specify"><button type="button" class="req-del mt-del" aria-label="Remove">\u00d7</button>`;
              list.insertBefore(row, e.target.closest(".mt-add"));
              row.querySelector("input").focus();
              row.querySelector("input").dispatchEvent(new Event("input", { bubbles: true }));
            } else if (e.target.closest(".mt-del")) {
              const row = e.target.closest(".multitext-row"); row.remove();
              list.dispatchEvent(new Event("input", { bubbles: true }));
            }
          });
        }
        if (f.type === "search") bindSearch($(".search-choice", wrap), () => options(f, d), () => !!f.freeWhen?.(d));
        if (f.type === "dob") $$(".search-choice", wrap).forEach((widget, i) => bindSearch(widget, () => {
          if (i === 0) return years();
          const parts = $$("input[data-date]", wrap).map(el => el.value);
          const days = /^\d{4}$/.test(parts[0]) && +parts[1] >= 1 && +parts[1] <= 12 ? new Date(+parts[0], +parts[1], 0).getDate() : 31;
          return Array.from({ length: i === 1 ? 12 : days }, (_, n) => String(n + 1).padStart(2, "0"));
        }));
        if (f.type === "file") {
          $(".clear-upload", wrap)?.addEventListener("click", () => {
            (d.files ||= {})[f.key] = []; $("input", wrap).value = ""; $(".saved-files", wrap).textContent = "Saved files removed.";
            app.declarations = { truth: false };
          });
          $("input", wrap).addEventListener("change", e => { $(".saved-files", wrap).textContent = Array.from(e.target.files).map(file => file.name).join(", "); });
        }
      }
      root.appendChild(wrap);
    }
    refreshConditions(fields, d, root);
  }
  function direct(root, key) { return Array.from(root.children).find(el => el.dataset.field === key); }
  function syncFields(fields, d, root) {
    const previousCountry = d.country, previousCity = d.city, previousTown = d.town;
    for (const f of fields) {
      const wrap = direct(root, f.key);
      if (!wrap) continue;
      if (f.type === "repeat") {
        d[f.key] = Array.from($(".repeat-rows", wrap).children).map(row => { syncFields(f.fields, row._data, row); return row._data; });
      } else if (f.type === "file") continue;
      else if (f.type === "dob") {
        const parts = $$("input[data-date]", wrap).map((el, i) => i ? el.value.trim().padStart(2, "0") : el.value.trim());
        d[f.key] = parts[0] && parts[1] !== "00" && parts[2] !== "00" ? parts.join("-") : "";
      } else if (f.type === "checks") d[f.key] = $$("input:checked", wrap).map(el => el.value);
      else if (f.type === "checkbox") d[f.key] = $("input", wrap).checked;
      else if (f.type === "multitext") d[f.key] = $$(".multitext-row input", wrap).map(i => i.value.trim()).filter(Boolean);
      else {
        const input = $("input,select,textarea", wrap);
        let value = input.value.trim();
        if (f.type === "search" && !f.freeWhen?.(d)) {
          if (f.key === "city") value = KIILocations.canonicalCity(d.country, value);
          const match = options(f, d).find(option => KIILocations.normalize(option) === KIILocations.normalize(value));
          if (match) { value = match; input.value = match; }
        }
        d[f.key] = value;
      }
    }
    function replace(key, value) {
      const wrap = direct(root, key);
      if (!wrap) return;
      d[key] = value; $("input", wrap).value = value;
    }
    if (fields.some(f => f.key === "city")) {
      if (previousCountry !== d.country) {
        replace("city", ""); replace("institution", ""); replace("postal", "");
      } else if (previousCity !== d.city) {
        replace("institution", ""); if (d.town) replace("town", "");
        replace("postal", KIILocations.postal(d.country, d.town) || KIILocations.postal(d.country, d.city));
      } else if (previousTown !== d.town) {
        replace("postal", KIILocations.postal(d.country, d.town) || KIILocations.postal(d.country, d.city));
      }
    }
  }
  function refreshConditions(fields, d, root) {
    for (const f of fields) {
      const wrap = direct(root, f.key);
      if (!wrap) continue;
      const shown = visible(f, d);
      wrap.hidden = !shown;
      $$("input,select,textarea,button", wrap).forEach(el => el.disabled = !shown || (locked() && !el.hasAttribute("data-file")));
      if (f.depends && !f.depends(d)) $$("input,button", wrap).forEach(el => el.disabled = true);
      $$(".search-choice", wrap).forEach(widget => widget.refreshChoices?.());
      if (f.type === "repeat") {
        for (const row of $(".repeat-rows", wrap).children) {
          if (shown) refreshConditions(f.fields, row._data, row);
        }
        $(".add-row", wrap).disabled = locked() || !shown || (d[f.key] || []).length >= f.maxRows;
      }
      if (f.type === "select" && typeof f.options === "function") {
        const sel = $("select", wrap), list = options(f, d);
        if (JSON.stringify(Array.from(sel.options).slice(1).map(o => o.value)) !== JSON.stringify(list)) {
          const previous = d[f.key]; sel.innerHTML = '<option value="">Select…</option>' + list.map(o => `<option>${esc(o)}</option>`).join("");
          sel.value = list.includes(previous) ? previous : "";
          d[f.key] = sel.value;
        }
      }
      const star = $("label .req", wrap);
      if (star) star.hidden = !required(f, d);
      if (f.type === "file" || f.type === "repeat") continue;
      const meter = $(".char-meter", wrap);
      if (meter) meter.textContent = `${String(d[f.key] || "").length} / ${f.max} characters${f.min ? " · minimum " + f.min : ""}`;
      if (f.type === "checks" && f.maxSelect && shown && !locked()) {
        const chosen = d[f.key] || [], full = chosen.length >= f.maxSelect;
        $$("input[type=checkbox]", wrap).forEach(box => { box.disabled = full && !box.checked; });
        const count = $(".choice-count", wrap);
        if (count) count.textContent = `Choose up to ${f.maxSelect}. Selected: ${chosen.length} of ${f.maxSelect}.`;
        const summary = $(".merged-dropdown-summary", wrap);
        if (summary) summary.innerHTML = chipSummary(f, chosen);
      }
    }
    const totals = $(".budget-totals", root);
    if (totals) {
      const cur = d.reqCurrency === "IQD" ? "IQD" : "USD";
      const sum = (d.requirements || []).reduce((t, row) => t + (Number(row.rqQty) || 0) * (Number(row.rqCost) || 0), 0);
      totals.textContent = `${sum.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${cur}`;
    }
  }
  async function collectUploads(fields, d, root) {
    for (const f of fields) {
      if (!visible(f, d)) continue;
      const wrap = direct(root, f.key);
      if (f.type === "repeat") {
        for (const row of $(".repeat-rows", wrap).children) await collectUploads(f.fields, row._data, row);
      }
      if (f.type !== "file") continue;
      const input = $("input[type=file]", wrap), selected = Array.from(input.files);
      if (selected.length) {
        if (selected.length > f.maxCount) throw Error(`${f.label}: select up to ${f.maxCount} files.`);
        const uploaded = [];
        try {
          for (const file of selected) {
            if (!f.extensions.includes(file.name.split(".").pop().toLowerCase())) throw Error(`${f.label}: accepted formats are ${f.extensions.join(", ")}.`);
            if (file.size > f.maxMB * 1024 * 1024) throw Error(`${f.label}: maximum ${f.maxMB} MB per file.`);
            const meta = { name: file.name, type: file.type, size: file.size };
            if (f.seconds) {
              meta.duration = await videoSeconds(file);
              if (meta.duration > f.seconds) throw Error(`${f.label}: maximum ${f.seconds} seconds.`);
            }
            meta.fileId = `${user.email}/${app.id || "legacy"}/merged/${crypto.randomUUID()}`;
            if (!await KII.saveFile(meta.fileId, file)) throw Error(`Could not save ${file.name}. Please free browser storage and try again.`);
            uploaded.push(meta);
          }
        } catch (error) {
          await Promise.all(uploaded.map(file => KII.deleteFile(file.fileId).catch(() => {})));
          throw error;
        }
        (d.files ||= {})[f.key] = uploaded; input.value = "";
      } else if (f.seconds) {
        for (const meta of asFiles(d.files?.[f.key])) {
          if (!Number.isFinite(meta.duration) && meta.fileId) {
            const file = await KII.getFile(meta.fileId);
            if (file) meta.duration = await videoSeconds(file);
          }
        }
      }
    }
  }
  async function collect() {
    if (locked() || current === "review") return;
    const step = schema.find(s => s.id === current), d = app.data[current] ||= {};
    syncFields(step.fields, d, body);
    await collectUploads(step.fields, d, body);
  }
  const fileLink = file => `<button type="button" class="merged-file" data-file="${esc(file.fileId || "")}" data-name="${esc(file.name)}">${esc(file.name)}</button>`;
  const isEmptyAnswer = a => a.rows ? !a.rows.length : a.files ? !a.files.length : !String(a.value ?? "").trim();
  function answerRows(answers) {
    return answers.map(answer => {
      const empty = isEmptyAnswer(answer);
      if (answer.rows) {
        if (empty) return `<tr class="is-empty"><th scope="row">${esc(answer.label)}</th><td><span class="report-empty">Not provided</span></td></tr>`;
        const labels = [...new Set(answer.rows.flatMap(row => row.filter(a => !a.files).map(a => a.label)))];
        const width = (100 / (labels.length + 0.4)).toFixed(1);
        const attachments = answer.rows.flatMap((row, i) => row.filter(a => a.files && a.files.length).map(a =>
          `<div class="report-file"><span class="report-file-tag">Row ${i + 1} · ${esc(a.label)}</span>${a.files.map(f => `${fileLink(f)}<small>${f.size ? (f.size / 1048576).toFixed(2) + " MB" : ""}</small>`).join(" ")}</div>`));
        /* repeating answers get the full table width so long column lists stay readable; files are listed under the table */
        return `<tr class="report-sub"><td colspan="2"><div class="report-sub-head"><span>${esc(answer.label)}</span><span class="report-sub-count">${answer.rows.length} row${answer.rows.length > 1 ? "s" : ""}</span></div>
          <div class="report-subtable-wrap${labels.length > 4 ? " wide" : ""}"><table class="report-subtable"><thead><tr><th style="width:30px">#</th>${labels.map(l => `<th style="width:${width}%">${esc(l)}</th>`).join("")}</tr></thead><tbody>
          ${answer.rows.map((row, i) => `<tr><td>${i + 1}</td>${labels.map(l => { const a = row.find(x => x.label === l);
            return `<td>${!a || isEmptyAnswer(a) ? '<span class="report-empty">—</span>' : esc(a.value)}</td>`; }).join("")}</tr>`).join("")}
        </tbody></table></div>${attachments.length ? `<div class="report-attachments">${attachments.join("")}</div>` : ""}</td></tr>`;
      }
      const cell = answer.files
        ? answer.files.map(f => `<div class="report-file"><span class="report-file-tag">Attachment</span>${fileLink(f)}<small>${f.size ? (f.size / 1048576).toFixed(2) + " MB" : ""}${Number.isFinite(f.duration) ? ` · ${Math.round(f.duration)} s` : ""}</small></div>`).join("")
        : esc(answer.value);
      return `<tr class="${empty ? "is-empty" : ""}"><th scope="row">${esc(answer.label)}</th><td>${empty ? '<span class="report-empty">Not provided</span>' : cell}</td></tr>`;
    }).join("");
  }
  function renderReview() {
    const steps = schema.filter(s => s.id !== "review");
    const results = steps.map((s, i) => { const d = app.data[s.id] || {}; return { s, i, d, errors: validate(s.fields, d) }; });
    const incomplete = results.filter(r => r.errors.length);
    const title = app.data.innovation?.title || "Untitled idea";
    const submittedAt = app.resubmittedAt || app.submittedAt;
    body.innerHTML = `
      <div class="report">
        <header class="report-head">
          <div class="report-head-top">
            <img src="asset/kii_logocl.png" alt="Kurdistan Innovation Institute" class="report-logo">
            <img id="reportPhoto" class="report-photo hidden" alt="Applicant photograph">
            <div class="report-head-side">
              <div class="report-status ${locked() ? "ok" : incomplete.length ? "warn" : "ok"}">
                ${locked() ? (app.submitted ? "Submitted" : "Withdrawn") : incomplete.length ? `${incomplete.length} section(s) need attention` : "Ready to submit"}
              </div>
              ${locked() ? `<button type="button" class="report-pdf" id="printReportBtn">Download PDF</button>` : ""}
            </div>
          </div>
          <div class="report-head-main">
            <div class="report-kicker">Kurdistan Innovation Institute · Innovation Program</div>
            <h2 class="report-title">${esc(title)}</h2>
            <div class="report-doc-id">Application Summary Report ${app.applicantCode ? `· <b>${esc(app.applicantCode)}</b>` : ""}</div>
          </div>
          <dl class="report-meta">
            <div><dt>Applicant</dt><dd>${esc(fullName)}</dd></div>
            <div><dt>Sector</dt><dd>${esc(app.data.innovation?.sector === "Other" ? (app.data.innovation?.sectorOther || []).join ? app.data.innovation.sectorOther.join(", ") : app.data.innovation?.sectorOther || "Other" : app.data.innovation?.sector || "—")}</dd></div>
            <div><dt>Development area</dt><dd>${esc(app.data.instruction?.devArea === "Other" ? (app.data.instruction?.devAreaOther || []).join(", ") : app.data.instruction?.devArea || "—")}</dd></div>
            <div><dt>Application ID</dt><dd>${esc(app.applicantCode || "Pending")}</dd></div>
            <div><dt>Started</dt><dd>${esc(KII.fmtDate(app.startedAt))}</dd></div>
            <div><dt>${app.resubmittedAt ? "Resubmitted" : "Submitted"}</dt><dd>${submittedAt ? esc(KII.fmtDate(submittedAt)) : "Not submitted yet"}</dd></div>
          </dl>
        </header>
        <div class="report-foot-mark" aria-hidden="true">Kurdistan Innovation Institute · Innovation Program · ${esc(app.applicantCode || title)} · ${esc(fullName)}</div>
        ${!locked() ? `<nav class="report-toc" aria-label="Sections">${results.map(r => `<a href="#review-${r.s.id}" class="${r.errors.length ? "warn" : "ok"}"><span>${r.i + 1}</span>${esc(r.s.title)}</a>`).join("")}</nav>` : ""}
        ${results.map(r => `
          <section class="report-section" id="review-${r.s.id}">
            <div class="report-section-head">
              <h3><span class="report-part">Part ${r.i + 1}</span><span class="report-part-title">${esc(r.s.title)}</span></h3>
              <div class="report-section-tools">
                <span class="report-chip ${r.errors.length ? "warn" : "ok"}">${r.errors.length ? `${r.errors.length} missing` : "Complete"}</span>
                ${!locked() ? `<button type="button" class="btn btn-secondary btn-sm" data-edit="${r.s.id}">Edit</button>` : ""}
              </div>
            </div>
            ${r.errors.length ? `<ul class="report-issues">${r.errors.map(e => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
            <table class="report-table"><tbody>${answerRows(summary(r.s.fields, r.d))}</tbody></table>
          </section>`).join("")}
      </div>`;
    if (locked()) body.insertAdjacentHTML("beforeend", `<div class="alert alert-info">${app.submitted ? "Application submitted. Your answers are locked for review." : "Application withdrawn."}</div>`);
    else {
      body.insertAdjacentHTML("beforeend", `<div class="report-declare"><label class="checkbox-line"><input type="checkbox" id="confirmAccurate" ${app.declarations?.truth ? "checked" : ""}> I confirm the information is accurate and complete <span class="req">*</span></label>
        <p class="hint">By submitting, you agree that KII may use this application to assess eligibility and support needs. Your answers will be locked after submission.</p></div>`);
      $("#confirmAccurate").addEventListener("change", () => {
        app.declarations = { truth: $("#confirmAccurate").checked };
        updateSubmit();
      });
    }
    $("#printReportBtn")?.addEventListener("click", () => window.print());
    updateSubmit();
    /* show the applicant's photograph in the report when one was uploaded */
    const photoMeta = (app.data.personal?.files?.photo || [])[0];
    const photoReady = photoMeta?.fileId
      ? KII.getFile(photoMeta.fileId).then(f => {
          if (!f) return;
          const img = document.getElementById("reportPhoto");
          if (img) { img.src = URL.createObjectURL(f); img.classList.remove("hidden"); }
        }).catch(() => { })
      : Promise.resolve();
    /* wait for the photo (if any) before auto-printing so it appears in the PDF */
    if (locked() && params.get("print") === "1" && !renderReview._printed) {
      renderReview._printed = true;
      photoReady.then(() => setTimeout(() => window.print(), 200));
    }
  }
  function updateSubmit() {
    $("#continueBtn").disabled = locked() || !app.declarations?.truth || KII.deadlinePassed() ||
      schema.some(s => s.id !== "review" && validate(s.fields, app.data[s.id] || {}).length);
  }
  function render(id) {
    current = id; app.currentSection = id;
    const step = schema.find(s => s.id === id), index = schema.indexOf(step);
    $("#stepLabel").textContent = `Step ${index + 1} of ${schema.length}`;
    $("#sectionTitle").textContent = step.title; $("#sectionSub").textContent = step.sub;
    $("#sideApplicant").textContent = fullName + (app.applicantCode ? " \u00b7 " + app.applicantCode : "");
    $("#sideNav").innerHTML = `<li><a href="dashboard.html">My ideas</a></li>` + schema.map(s => `<li><a href="?application=${encodeURIComponent(applicationId)}&s=${s.id}" data-step="${s.id}" class="${s.id === current ? "active" : ""} ${app.completedSections.includes(s.id) ? "done" : ""}"><span class="dot"></span>${esc(s.title)}</a></li>`).join("");
    const doneCount = app.completedSections.length;
    $("#sideProgress").innerHTML = `<div class="side-progress-track"><div class="side-progress-fill" style="width:${Math.round(doneCount / schema.length * 100)}%"></div></div>${doneCount} / ${schema.length} steps complete`;
    body.innerHTML = ""; showError("");
    if (app.revisionNote) body.insertAdjacentHTML("beforeend", `<div class="alert alert-info">KII requested changes: ${esc(app.revisionNote)}</div>`);
    if (current === "review") renderReview();
    else {
      const d = app.data[current] ||= {};
      renderFields(step.fields, d, body, current);
      if (current === "support" && (d.previousMilestones || d.previousFunding)) {
        body.insertAdjacentHTML("afterbegin", `<div class="alert alert-info">Your previous draft included the following. Please transfer it into the tables below.<br>${esc(d.previousMilestones || "")}<br>${esc(d.previousFunding || "")}</div>`);
      }
      $("#continueBtn").disabled = false;
    }
    if (KII.deadlinePassed() && !locked()) showError("The application deadline has passed. You can save a draft, but submissions are closed.");
    $("#continueBtn").textContent = current === "review" ? app.submitted ? "Submitted" : app.revisionNote ? "Resubmit application" : "Submit application" : "Continue";
    $("#saveBtn").hidden = locked(); $("#backBtn").hidden = index === 0;
    history.replaceState(null, "", `?application=${encodeURIComponent(applicationId)}&s=${id}`);
    window.scrollTo(0, 0);
  }
  async function action(fn) {
    if (busy) return;
    busy = true;
    $("#continueBtn").disabled = $("#saveBtn").disabled = $("#backBtn").disabled = true;
    $$("input, select, textarea, button", body).forEach(el => el.disabled = true);
    try { await fn(); } catch (error) { showError(error.message); }
    finally {
      busy = false;
      $("#saveBtn").disabled = $("#backBtn").disabled = false;
      if (current === "review") updateSubmit(); else $("#continueBtn").disabled = false;
      if (current !== "review") refreshConditions(schema.find(s => s.id === current).fields, app.data[current] || {}, body);
      else $$("button[data-edit], input#confirmAccurate, button[data-file]", body).forEach(el => el.disabled = locked() && !el.dataset.file);
    }
  }
  body.addEventListener("input", () => {
    if (current === "review" || locked() || busy) return;
    const step = schema.find(s => s.id === current), d = app.data[current];
    syncFields(step.fields, d, body); refreshConditions(step.fields, d, body);
    app.declarations = { truth: false };
  });
  body.addEventListener("change", () => {
    if (current === "review" || locked() || busy) return;
    const step = schema.find(s => s.id === current), d = app.data[current];
    syncFields(step.fields, d, body); refreshConditions(step.fields, d, body);
    app.declarations = { truth: false };
  });
  document.addEventListener("click", async e => {
    const fileLink = e.target.closest("[data-file]");
    if (fileLink) {
      e.preventDefault();
      const file = fileLink.dataset.file && await KII.getFile(fileLink.dataset.file);
      if (!file) { showError("This file is not available in this browser. Please upload it again."); return; }
      const url = URL.createObjectURL(file);
      const link = document.createElement("a"); link.href = url; link.download = fileLink.dataset.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    const nav = e.target.closest("[data-step], [data-edit]");
    if (!nav) return;
    e.preventDefault();
    await action(async () => { await collect(); if (!locked()) await persist(); render(nav.dataset.step || nav.dataset.edit); });
  });
  $("#continueBtn").addEventListener("click", () => action(async () => {
    if (current === "review") {
      if (locked()) return;
      if (!app.declarations?.truth) throw Error("Please confirm the information is accurate and complete.");
      if (KII.deadlinePassed()) throw Error("The application deadline has passed.");
      if (schema.some(s => s.id !== "review" && validate(s.fields, app.data[s.id] || {}).length)) throw Error("Please resolve the highlighted fields before submitting.");
      if (!confirm("Submit this idea? Its answers will be locked for review.")) return;
      const previous = JSON.parse(JSON.stringify(app));
      if (app.revisionNote) {
        app.resubmittedAt = new Date().toISOString();
        (app.revisionHistory ||= []).push({ note: app.revisionNote, resubmittedAt: app.resubmittedAt }); app.revisionNote = "";
      } else app.submittedAt = new Date().toISOString();
      app.declarations.at = new Date().toISOString(); app.submitted = true; app.status = "Done";
      try { await persist(); } catch (error) { app = previous; throw error; }
      render("review"); return;
    }
    await collect();
    if (!locked()) {
      await persist();
      const errors = validate(schema.find(s => s.id === current).fields, app.data[current]);
      if (errors.length) { showError(errors.join("\n")); return; }
    }
    render(schema[schema.findIndex(s => s.id === current) + 1].id);
  }));
  $("#backBtn").addEventListener("click", () => action(async () => {
    await collect(); if (!locked()) await persist(); render(schema[Math.max(0, schema.findIndex(s => s.id === current) - 1)].id);
  }));
  $("#saveBtn").addEventListener("click", () => action(async () => {
    let uploadError = null;
    try { await collect(); } catch (error) { uploadError = error.message; }
    await persist(); KII.selectApplication(user.email, app.id || "legacy");
    await window.KIIServer?.flush?.(); // draft must reach the server before the dashboard page loads
    if (uploadError) {
      showError(uploadError + " Your other answers were saved. Fix the upload and click Save & Exit again.");
      return;
    }
    location.href = "dashboard.html";
  }));
  await persist(); render(current);
  // Exposes the form definition for focused local regression tests without a server.
  window.KIIMergedForm = { schema, validate, migrate, active, summary, render, collect, persist, get application() { return app; } };
})().catch(error => {
  const alert = document.getElementById("alert");
  alert.textContent = error.message; alert.classList.remove("hidden");
});
