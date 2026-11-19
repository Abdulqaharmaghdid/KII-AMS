/* ===== AMS data layer: staff, roles, permissions, applicants ===== */

const AMS = {
  STAFF_KEY: "kii_staff",
  SESSION_KEY: "kii_admin_session",
  APPS_KEY: "kii_ams_applicants",
  SEED_FLAG: "kii_ams_seeded_v1",
  CLEAN_FLAG: "kii_ams_clean_v1",
  NOTIF_KEY: "kii_ams_notifs",
  MSG_KEY: "kii_ams_messages",
  SET_KEY: "kii_ams_settings",
  ITASK_KEY: "kii_ams_itasks",
  IMEET_KEY: "kii_ams_imeets",
  STCHAT_KEY: "kii_ams_stchat",
  GROUPS_KEY: "kii_ams_groups",
  ROLES_KEY: "kii_ams_roles",
  PR_KEY: "kii_ams_prs",
};

/* ---------- roles & permissions ---------- */
const ALL_PERMS = [
  "view_applicants", "edit_applicants", "manage_tasks", "manage_meetings",
  "evaluate", "manage_documents", "view_financials", "manage_financials",
  "manage_procurement", "make_decisions", "view_reports", "manage_staff", "manage_form",
];

const PERM_LABELS = {
  view_applicants: "View applicants",
  edit_applicants: "Edit applicant stage/status",
  manage_tasks: "Manage tasks & follow-up",
  manage_meetings: "Schedule meetings",
  evaluate: "Submit expert evaluations",
  manage_documents: "Manage documents",
  view_financials: "View financials",
  manage_financials: "Manage financial support",
  manage_procurement: "Manage procurement (PRs)",
  make_decisions: "Make committee decisions",
  view_reports: "View reports",
  manage_staff: "Manage staff & permissions",
  manage_form: "Edit application form questions",
};

const ROLES = {
  master_admin: { label: "Master Admin", perms: ALL_PERMS },
  admin_manager: {
    label: "Application & Administration Manager",
    perms: ["view_applicants", "edit_applicants", "manage_tasks", "manage_meetings",
      "evaluate", "manage_documents", "view_financials", "manage_financials",
      "manage_procurement", "view_reports", "manage_staff"],
  },
  ceo: {
    label: "CEO",
    perms: ["view_applicants", "view_financials", "view_reports", "make_decisions",
      "manage_meetings", "manage_tasks"],
  },
  technical_manager: {
    label: "Technical Manager",
    perms: ["view_applicants", "edit_applicants", "evaluate", "manage_tasks",
      "manage_meetings", "manage_documents", "view_reports"],
  },
  technical_engineer: {
    label: "Technical Engineer",
    perms: ["view_applicants", "evaluate", "manage_tasks", "manage_meetings", "manage_documents"],
  },
  business_coordinator: {
    label: "Business Coordinator",
    perms: ["view_applicants", "manage_tasks", "manage_meetings", "manage_documents"],
  },
  business_developer: {
    label: "Business Developer",
    perms: ["view_applicants", "manage_meetings", "manage_tasks", "view_reports"],
  },
  procurement_officer: {
    label: "Procurement Coordinator",
    perms: ["view_applicants", "manage_procurement", "manage_documents", "view_financials"],
  },
  finance_manager: {
    label: "Finance Manager",
    perms: ["view_applicants", "view_financials", "manage_financials", "view_reports"],
  },
  evaluator: {
    label: "Evaluator / Expert",
    perms: ["view_applicants", "evaluate"],
  },
  focal_point: {
    label: "Workshop / Focal Point",
    perms: ["view_applicants"], // read-only access to full project history
  },
};

/* ---------- workflow stages (approval chain) ---------- */
/* ===== Two-workflow pipeline (ISO 56002-aligned) =====
   Workflow A — Application Evaluation: 5 gate stages from submission to decision.
   Workflow B — Project Development & Support: 5 delivery stages after approval.
   Stage = where the initiative is · State = what it is currently waiting on ·
   Outcome = its disposition · Milestone/Track = a concrete checkpoint. */
const WF_A_NAME = "Application Evaluation";
const WF_B_NAME = "Project Development & Support";
const WF_A_STAGES = ["Submission Form", "Screening", "Committee Review", "Pitch & Expert Evaluation", "Final Decision"];
const WF_B_STAGES = ["Support Planning", "Project Development", "Testing & Validation", "Market & Stakeholder Engagement", "Launch & Completion"];
const STAGES = [...WF_A_STAGES, ...WF_B_STAGES];
const WF_A_STATES = ["Active", "Awaiting Applicant", "Awaiting KII Review", "On Hold", "Evaluation Completed"];
const WF_B_STATES = ["Active", "Awaiting Applicant", "Awaiting KII Action", "Awaiting External Party", "On Hold", "Completed", "Closed"];
const WF_A_OUTCOMES = ["Pending Decision", "Approved for Support", "Conditionally Approved", "Rejected", "Out of Scope", "Withdrawn"];
const WF_B_OUTCOMES = ["Ongoing", "Successfully Completed", "Partially Completed", "Closed – Inactive", "Closed – Discontinued", "Withdrawn", "Transferred"];
const OUTCOMES = [...new Set([...WF_A_OUTCOMES, ...WF_B_OUTCOMES])];
/* outcomes that close a case (Approved/Conditionally Approved close Workflow A by moving it to B) */
const TERMINAL_OUTCOMES = ["Rejected", "Out of Scope", "Withdrawn", "Transferred",
  "Closed – Inactive", "Closed – Discontinued", "Successfully Completed", "Partially Completed"];
const APPROVED_OUTCOMES = ["Approved for Support", "Conditionally Approved"];
const OUTCOME_COLORS = {
  "Pending Decision": "#f59e0b", "Approved for Support": "#16a34a", "Conditionally Approved": "#65a30d",
  "Rejected": "#ef4444", "Out of Scope": "#64748b", "Withdrawn": "#94a3b8",
  "Ongoing": "#3b82f6", "Successfully Completed": "#16a34a", "Partially Completed": "#f59e0b",
  "Closed – Inactive": "#64748b", "Closed – Discontinued": "#b91c1c", "Transferred": "#8b5cf6",
  /* legacy labels still found in old records before migration runs */
  "Successful": "#16a34a", "Supported": "#3b82f6",
};

/* Workflow A milestones — the evaluation checkpoints with their responsible party */
const WF_A_MILESTONES = [
  { id: "submitted", label: "Application submitted", stage: "Submission Form", owner: "Applicant / system" },
  { id: "assessed", label: "Initial assessment completed", stage: "Screening", owner: "Business Developer" },
  { id: "committee", label: "Initial committee review completed", stage: "Committee Review", owner: "Evaluation Committee" },
  { id: "deck", label: "Pitch deck submitted", stage: "Pitch & Expert Evaluation", owner: "Applicant" },
  { id: "pitch", label: "Pitch presentation completed", stage: "Pitch & Expert Evaluation", owner: "Applicant & KII" },
  { id: "expert", label: "Expert assessment completed", stage: "Pitch & Expert Evaluation", owner: "Assigned Expert" },
  { id: "decision", label: "Final evaluation decision issued", stage: "Final Decision", owner: "CEO / authorized decision maker" },
  { id: "notified", label: "Applicant notified of decision", stage: "Final Decision", owner: "Application & Administration team" },
];
/* Workflow B support tracks — selected per project during Support Planning */
const WF_B_TRACKS = ["Support Planning", "Technical Development", "Business Development",
  "Testing & Validation", "Capacity Building", "Legal & Registration", "Market Access",
  "Procurement Support", "Project Completion"];
const TRACK_STATUSES = ["Not Started", "In Progress", "Done", "On Hold", "N/A"];
const WF_OF_STAGE = Object.fromEntries([...WF_A_STAGES.map(s => [s, "A"]), ...WF_B_STAGES.map(s => [s, "B"])]);

const STAGE_COLORS = {
  "Submission Form": "#3b82f6", "Screening": "#0ea5e9", "Committee Review": "#8b5cf6",
  "Pitch & Expert Evaluation": "#a855f7", "Final Decision": "#f59e0b",
  "Support Planning": "#0d9488", "Project Development": "#14b8a6", "Testing & Validation": "#2dd4bf",
  "Market & Stakeholder Engagement": "#22c55e", "Launch & Completion": "#15803d",
};
const STATE_COLORS = {
  "Active": "#22c55e", "Awaiting Applicant": "#3b82f6", "Awaiting KII Review": "#8b5cf6",
  "Awaiting KII Action": "#8b5cf6", "Awaiting External Party": "#f59e0b", "On Hold": "#f59e0b",
  "Evaluation Completed": "#16a34a", "Completed": "#16a34a", "Closed": "#64748b",
};
/* short explanation of each stage, shown to applicants on their dashboard */
const STAGE_INFO = {
  "Submission Form": "Your application has been received and is awaiting initial review.",
  "Screening": "KII is checking that your application is complete and within scope.",
  "Committee Review": "Your application is being reviewed by the KII evaluation committee.",
  "Pitch & Expert Evaluation": "You have been invited to pitch your project and experts are assessing it.",
  "Final Decision": "Your application is awaiting the final decision.",
  "Support Planning": "KII is preparing your support plan and onboarding.",
  "Project Development": "Your project is in development — build and deliver your solution.",
  "Testing & Validation": "Your solution is being tested and validated.",
  "Market & Stakeholder Engagement": "KII is helping you reach the market and connect with stakeholders.",
  "Launch & Completion": "Your project is being launched and closed out.",
};
/* migrate old stage names to the new workflows */
const STAGE_MIGRATE = {
  "Submitted": "Submission Form", "Submitted Form": "Submission Form",
  "Initial Review": "Committee Review", "Expert Evaluation": "Committee Review",
  "Evaluation": "Committee Review", "Under Evaluation": "Committee Review",
  "Interview / Pitch": "Pitch & Expert Evaluation", "Pitch Deck": "Pitch & Expert Evaluation",
  "CEO Approval": "Final Decision", "Approval": "Final Decision",
  "Team Action": "Market & Stakeholder Engagement", "Accepted": "Support Planning",
  "Market Validation": "Market & Stakeholder Engagement",
  "Implementation": "Project Development", "Development": "Project Development",
  "Prototype Development": "Project Development",
  "On Hold": "Support Planning", "Ongoing": "Market & Stakeholder Engagement",
  "Investor / Stakeholder": "Market & Stakeholder Engagement", "Closed": "Launch & Completion",
};
const OUTCOME_MIGRATE = { "Successful": "Successfully Completed", "Supported": "Ongoing" };
/* which role is responsible at each stage (gets notified on advance) */
const STAGE_OWNER = {
  "Submission Form": "admin_manager", "Screening": "business_developer",
  "Committee Review": "technical_manager", "Pitch & Expert Evaluation": "admin_manager",
  "Final Decision": "ceo",
  "Support Planning": "admin_manager", "Project Development": "technical_manager",
  "Testing & Validation": "technical_manager", "Market & Stakeholder Engagement": "business_developer",
  "Launch & Completion": "ceo",
};

/* gate checklists shown to staff per stage */
const STAGE_CHECKLISTS = {
  "Submission Form": ["Application received", "Documents complete", "Scope check done"],
  "Screening": ["Initial assessment completed", "Eligibility & scope confirmed", "Screening verdict recorded"],
  "Committee Review": ["Committee convened", "Committee review recorded", "Committee verdict issued"],
  "Pitch & Expert Evaluation": ["Pitch deck received", "Pitch presentation held", "Expert assessment completed"],
  "Final Decision": ["Decision issued by authorized person", "Applicant notified"],
  "Support Planning": ["Support plan agreed", "Applicant onboarded / agreement signed", "Support tracks selected & owners assigned"],
  "Project Development": ["Development plan active", "Progress reviewed", "Procurement needs identified"],
  "Testing & Validation": ["Tests performed", "Validation results recorded", "Issues resolved"],
  "Market & Stakeholder Engagement": ["Market validation done", "Stakeholder meetings held", "Partnerships recorded"],
  "Launch & Completion": ["Launch / handover done", "Final report archived", "Post-completion follow-up scheduled"],
};

/* support types an applicant can request */
const SUPPORT_TYPES = ["Financial support", "Technical support", "Workshop support",
  "Equipment", "Software / subscriptions", "Mentorship", "Other"];

/* sectors considered inside KII scope (auto-categorization) */
const KII_SECTORS = ["Agriculture", "Energy", "Renewable Energy", "Water", "Health",
  "Education", "Automation", "Fashion", "Technology", "Computer and AI", "Health Tech", "Education Tech"];

/* email/message templates per trigger */
const MSG_TEMPLATES = {
  received: { label: "Application received", subject: "Your KII application was received",
    body: "Dear {applicant},\n\nThank you for submitting your application to the KII Innovation Program. Our team will review it shortly.\n\nBest regards,\nKII Team" },
  info_required: { label: "Additional information required", subject: "Additional information required – {project}",
    body: "Dear {applicant},\n\nDuring the review of your application “{project}”, we found that additional information is required. Please update your application at your earliest convenience.\n\nBest regards,\nKII Team" },
  meeting: { label: "Meeting invitation", subject: "Meeting invitation – {project}",
    body: "Dear {applicant},\n\nWe would like to invite you to a meeting regarding your project “{project}”. Details will follow.\n\nBest regards,\nKII Team" },
  rejected: { label: "Rejected", subject: "Update on your application – {project}",
    body: "Dear {applicant},\n\nThank you for your interest in the KII Innovation Program. After careful review, we are unable to move forward with your application “{project}” at this time.\n\nBest regards,\nKII Team" },
  task_reminder: { label: "Task reminder", subject: "Task reminder – {project}",
    body: "Dear {applicant},\n\nThis is a reminder that you have pending tasks related to your project “{project}”.\n\nBest regards,\nKII Team" },
  followup: { label: "Follow-up reminder", subject: "Follow-up – {project}",
    body: "Dear {applicant},\n\nWe are following up on your project “{project}”. Please let us know if you need any support.\n\nBest regards,\nKII Team" },
  shortlisted: { label: "Shortlisted for interview", subject: "You have been shortlisted – {project}",
    body: "Dear {applicant},\n\nCongratulations — your application “{project}” has been shortlisted. You are invited to present your project to the KII selection panel (a short pitch followed by questions). We will send the date, time and format shortly.\n\nBest regards,\nKII Team" },
  approved: { label: "Accepted for support", subject: "Your application has been accepted – {project}",
    body: "Dear {applicant},\n\nWe are pleased to inform you that your project “{project}” has been accepted into the KII Innovation Program. The KII team will contact you about the next steps, your support plan and your project milestones.\n\nBest regards,\nKII Team" },
  revision: { label: "Revision requested", subject: "Please update your application – {project}",
    body: "Dear {applicant},\n\nThank you for your application “{project}”. Before we can continue the review, we need you to update some parts of your application. Your application has been reopened — please sign in, make the requested changes and resubmit.\n\nBest regards,\nKII Team" },
  closure: { label: "Project closure", subject: "Project closure – {project}",
    body: "Dear {applicant},\n\nYour project “{project}” has reached the closure stage. Thank you for your work with the KII Innovation Program.\n\nBest regards,\nKII Team" },
};

/* ---------- staff store ---------- */
function amsGetStaff() {
  try { return JSON.parse(localStorage.getItem(AMS.STAFF_KEY)) || []; } catch { return []; }
}
function amsSaveStaff(list) { localStorage.setItem(AMS.STAFF_KEY, JSON.stringify(list)); }
function amsFindStaff(email) {
  return amsGetStaff().find(s => s.email.toLowerCase() === String(email).toLowerCase());
}
function amsAddStaff(s) { const l = amsGetStaff(); l.push(s); amsSaveStaff(l); }
function amsUpdateStaff(id, patch) {
  const l = amsGetStaff();
  const s = l.find(x => x.id === id);
  if (s) { Object.assign(s, patch); amsSaveStaff(l); }
  return s;
}

function amsPwFields(plain) { const p = KII.makePassword(plain); return { passHash: p.hash, passSalt: p.salt }; }

/* staff session (auto sign-out after 60 minutes of inactivity) */
const AMS_IDLE_MS = 60 * 60000;
let amsSessionExpired = false;
function amsStaffLogin(id) {
  localStorage.setItem(AMS.SESSION_KEY, id);
  localStorage.setItem(AMS.SESSION_KEY + "_seen", String(Date.now()));
}
function amsStaffLogout() { localStorage.removeItem(AMS.SESSION_KEY); localStorage.removeItem(AMS.SESSION_KEY + "_seen"); }
function amsCurrentStaff() {
  const id = localStorage.getItem(AMS.SESSION_KEY);
  if (!id) return null;
  const seen = +localStorage.getItem(AMS.SESSION_KEY + "_seen") || 0;
  if (Date.now() - seen > AMS_IDLE_MS) { amsStaffLogout(); amsSessionExpired = true; return null; }
  localStorage.setItem(AMS.SESSION_KEY + "_seen", String(Date.now()));
  return amsGetStaff().find(s => s.id === id) || null;
}

/* ---------- system audit log (staff/permission/settings changes) ---------- */
const AUDIT_KEY = "kii_ams_audit";
function amsAudit(by, action, detail) {
  let l = [];
  try { l = JSON.parse(localStorage.getItem(AUDIT_KEY)) || []; } catch { }
  l.unshift({ date: new Date().toISOString(), by, action, detail: detail || "" });
  localStorage.setItem(AUDIT_KEY, JSON.stringify(l.slice(0, 2000)));
}
function amsGetAudit() { try { return JSON.parse(localStorage.getItem(AUDIT_KEY)) || []; } catch { return []; } }
function amsRequireStaff() {
  const s = amsCurrentStaff();
  if (!s || !s.active) {
    const expired = amsSessionExpired;
    window.location.href = "admin-login.html" + (expired ? "?expired=1" : "");
    throw new Error("Not signed in"); // stop the page script
  }
  return s;
}
function amsCan(staff, perm) {
  return !!(staff && staff.active && ((staff.perms || []).includes(perm) || (staff.role === "master_admin" && perm === "manage_form")));
}

/* ---------- applicants store ---------- */
function amsGetApplicants() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(AMS.APPS_KEY)) || []; } catch { }
  // migrate old stage names + fill new fields
  list.forEach(a => {
    if (STAGE_MIGRATE[a.stage]) a.stage = STAGE_MIGRATE[a.stage];
    if (a.stageForced && STAGE_MIGRATE[a.stageForced]) a.stageForced = STAGE_MIGRATE[a.stageForced];
    if (!STAGES.includes(a.stage)) a.stage = "Submission Form";
    if (!a.workflow) a.workflow = WF_OF_STAGE[a.stage] || "A";
    if (a.workflow !== "A" && a.workflow !== "B") a.workflow = "A";
    if (a.outcome && OUTCOME_MIGRATE[a.outcome]) a.outcome = OUTCOME_MIGRATE[a.outcome];
    if (!a.state) a.state = a.status === "Inactive" ? "On Hold" : "Active";
    if (!a.status) a.status = "Active";
    a.wfMilestones = a.wfMilestones || {};
    if (a.appliedDate || a.portalData?.submitted)
      a.wfMilestones.submitted = a.wfMilestones.submitted || { done: true, by: "System", date: a.appliedDate };
    a.tracks = a.tracks || null;
    a.gates = a.gates || [];
    a.conditions = a.conditions || [];
    if (!a.kpis) a.kpis = { technical: 0, business: 0, market: 0, team: 0 };
    if (!a.checklist) a.checklist = {};
    if (!a.supportRequested) a.supportRequested = [];
    if (!a.messages) a.messages = [];
    if (a.inScope === undefined) a.inScope = KII_SECTORS.includes(a.sector) || KII.sectorCatalogue().some(s => s.name === a.sector);
  });
  return list;
}
function amsSaveApplicants(list) { localStorage.setItem(AMS.APPS_KEY, JSON.stringify(list)); }
function amsGetApplicant(id) { return amsGetApplicants().find(a => a.id === id); }
/* flatten every uploaded file found in application data (any nesting depth) */
function amsCollectUploads(data) {
  const out = [];
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (o.files && typeof o.files === "object")
      for (const [key, value] of Object.entries(o.files))
        for (const meta of (Array.isArray(value) ? value : [value]))
          if (meta && meta.name) out.push({ _key: key, ...meta });
    Object.values(o).forEach(walk);
  })(data);
  return out;
}

/* pull real portal applicants into the AMS store */
function amsSyncPortal() {
  const previous = amsGetApplicants();
  const list = previous.filter(a => {
    if (!a.portal) return true;
    /* staff only ever see submitted, withdrawn or sent-back applications — drafts stay private to the applicant */
    if (a.portalData && !a.portalData.submitted && !a.portalData.withdrawn && !a.portalData.revisionNote) return false;
    const email = a.portalData?.email || a.applicantEmail;
    return !email || !!KII.getApplication(email, a.portalData?.applicationId || "legacy");
  });
  let changed = list.length !== previous.length;
  const users = KII.getUsers();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("kii_app_")) continue;
    let app;
    try { app = JSON.parse(localStorage.getItem(k)); } catch { continue; }
    const email = app?.ownerEmail || k.slice("kii_app_".length).split("::")[0];
    const user = users.find(u => String(u.email).toLowerCase() === email.toLowerCase());
    if (!user || !app) continue;
    /* a draft is private to its applicant until it is submitted (withdrawn and revision-requested
       applications keep their record so staff history is preserved) */
    if (!app.submitted && app.status !== "Withdrawn" && !app.revisionNote) continue;

    const id = KII.portalId(email, app);
    const data = app.activeData || app.data || {};
    const project = data.innovation || data.supporting || {};
    const fullName = [user.firstName, user.secondName, user.thirdName].filter(Boolean).join(" ");
    const projTitle = project.title || fullName + "'s Project";
    const stage = "Submission Form";
    const progress = app.submitted ? 5 : Math.round(((app.completedSections || []).length / KII.applicationSteps(app)) * 5);
    const location = app.data?.personal?.city && app.data?.personal?.country
      ? app.data.personal.city + ", " + app.data.personal.country : "—";

    const reqList = data.support?.requirements || data.supporting?.requirements || [];
    const reqCur = data.support?.reqCurrency === "IQD" ? "IQD" : "USD";
    const budgetTotals = reqList.reduce((s, r) => {
      const currency = r.rqCurrency === "IQD" ? "IQD" : reqCur;
      s[currency] += (+r.rqCost || 0) * (+r.rqQty || 1); return s;
    }, { USD: 0, IQD: 0 });
    const budgetTotal = budgetTotals.USD;
    // full application copy for staff viewing — strip any inline file bytes (they live in IndexedDB)
    const appCopy = JSON.parse(JSON.stringify(data, (k, v) => k === "dataUrl" ? undefined : v));
    const extras = {
      requirements: reqList,
      budgetTotal, budgetTotals,
      applicationReview: app.reviewSections || null,
      innovationPoint: project.innovationPoint || "",
      businessPotential: data.market?.businessPotential || project.businessPotential || "",
      businessDetail: data.market?.businessDetail || project.businessDetail || "",
      applicantEmail: email,
      code: app.applicantCode || "",
      applicantOrg: user.organization || "",
      /* identity details for staff review — hidden from evaluators when blind review is on */
      applicantInfo: {
        name: fullName, email, phone: user.phone || "", passport: user.passport || "",
        dob: user.dob || "", country: user.country || "", city: user.city || "",
        town: user.town || "", organization: user.organization || "", website: user.website || "",
        photoFileId: data.personal?.files?.photo?.[0]?.fileId || "",
      },
      applicantPhone: app.data?.personal ? (app.data.personal.phoneCode || "") + " " + (app.data.personal.phone || "") : user.phone,
      application: appCopy,
      uploads: amsCollectUploads(data),
    };

    const existing = list.find(a => a.id === id);
    const justSubmitted = app.submitted && !(existing && existing.portalData?.submitted);
    const pd = { email, applicationId: app.id || "legacy", schemaVersion: app.schemaVersion || 1, submitted: !!app.submitted, category: app.category,
      revisionNote: app.revisionNote || "", withdrawn: app.status === "Withdrawn",
      declarations: app.declarations || null, submittedAt: app.submittedAt || null,
      resubmittedAt: app.resubmittedAt || null };
    if (existing) {
      existing.name = projTitle;
      existing.applicantName = fullName;
      existing.sector = project.sector || project.category || app.category;
      existing.location = location;
      existing.stage = existing.stageForced || stage;
      // once staff take over the case, their progress/status values win
      if (!existing.stageForced) {
        existing.progress = Math.max(existing.progress || 0, progress);
        existing.status = app.status === "Inactive" ? "Inactive" : "Active";
      }
      existing.appliedDate = app.submittedAt || app.startedAt;
      Object.assign(existing, extras);
      if (app.status === "Withdrawn" && !existing.portalData?.withdrawn) {
        existing.outcome = "Withdrawn";
        existing.status = "Inactive";
        existing.lastActivity = new Date().toISOString();
        (existing.activities = existing.activities || []).unshift({ date: existing.lastActivity, icon: "status",
          title: "Application withdrawn by applicant", desc: app.withdrawReason ? "Reason: " + app.withdrawReason : "No reason given.", by: "Applicant" });
        ["master_admin", "admin_manager"].forEach(r => amsNotifyRole(r, `"${projTitle}" was withdrawn by ${fullName}.`,
          `admin.html?v=applicant&id=${encodeURIComponent(id)}`));
      }
      existing.portalData = { ...pd };
      changed = true;
    } else {
      list.push({
        id, portal: true,
        name: projTitle, applicantName: fullName,
        tagline: project.explain?.slice(0, 80) || "Applicant project",
        sector: project.sector || project.category || app.category || "Other",
        location,
        appliedDate: app.submittedAt || app.startedAt, lastActivity: app.startedAt,
        status: "Active", stage, progress,
        workflow: "A", state: "Active",
        supportApproved: 0, spent: 0, committed: 0,
        kpis: { technical: 0, business: 0, market: 0, team: 0 },
        activities: [{ date: app.startedAt, icon: "doc", title: "Application started",
          desc: "Applicant began their application (" + (app.category || "") + ").", by: "Portal" }],
        meetings: [], tasks: [], evaluations: [], documents: [], procurement: [], decisions: [],
        ...extras,
        portalData: { ...pd },
      });
      changed = true;
    }
    if (justSubmitted) {
      const rec = list.find(a => a.id === id);
      const re = !!(app.revisionHistory || []).length;
      rec.lastActivity = new Date().toISOString();
      (rec.activities = rec.activities || []).unshift({ date: rec.lastActivity, icon: "doc",
        title: re ? "Application resubmitted after revision" : "Application submitted",
        desc: `${fullName} ${re ? "resubmitted" : "submitted"} "${projTitle}".`, by: "Applicant" });
      const link = `admin.html?v=applicant&id=${encodeURIComponent(id)}&tab=application`;
      const owners = ["master_admin", "admin_manager"];
      owners.forEach(r => amsNotifyRole(r, `${re ? "Revised application resubmitted" : "New application submitted"}: "${projTitle}" by ${fullName}`, link));
      const assignee = rec.assignedToName && amsGetStaff().find(s => s.name === rec.assignedToName);
      if (re && assignee && !owners.includes(assignee.role)) amsNotify(assignee.id, `Revised application resubmitted: "${projTitle}"`, link);
    }
  }
  if (changed) amsSaveApplicants(list);
  return list;
}

/* ---------- seed data ---------- */
function seedStaff() {
  if (amsGetStaff().length) return;
  const mk = (name, email, pass, role, title) => ({
    id: "st_" + Math.random().toString(36).slice(2, 9),
    name, email, ...amsPwFields(pass), mustChangePassword: true, role, title,
    active: true, perms: [...ROLES[role].perms],
    createdAt: new Date().toISOString(),
  });
  amsSaveStaff([
    mk("Master Admin", "admin@kii.org", "admin123", "master_admin", "Master Administrator"),
  ]);
}


/* ---------- helpers ---------- */
function amsDaysSince(iso) {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function amsFmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function amsFmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    "  " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function amsMoney(n) {
  return "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function amsUid(p) { return (p || "x") + "_" + Math.random().toString(36).slice(2, 9); }

/* ---------- notifications ---------- */
function amsGetNotifs() {
  try { return JSON.parse(localStorage.getItem(AMS.NOTIF_KEY)) || []; } catch { return []; }
}
function amsSaveNotifs(l) { localStorage.setItem(AMS.NOTIF_KEY, JSON.stringify(l)); }
function amsNotify(staffId, text, link) {
  const l = amsGetNotifs();
  l.unshift({ id: amsUid("n"), staffId, text, link: link || "", date: new Date().toISOString(), read: false });
  amsSaveNotifs(l);
}
function amsNotifyRole(role, text, link) {
  amsGetStaff().filter(s => s.active && s.role === role)
    .forEach(s => amsNotify(s.id, text, link));
}
function amsNotifsFor(staffId) { return amsGetNotifs().filter(n => n.staffId === staffId); }
function amsUnreadCount(staffId) { return amsNotifsFor(staffId).filter(n => !n.read).length; }
function amsMarkRead(id) {
  const l = amsGetNotifs();
  const n = l.find(x => x.id === id);
  if (n) { n.read = true; amsSaveNotifs(l); }
}

/* ---------- chat (applicant <-> team) ---------- */
const CHAT_KEY = "kii_ams_chat";
function amsGetChat(appId) {
  try { return (JSON.parse(localStorage.getItem(CHAT_KEY)) || {})[appId] || []; }
  catch { return []; }
}
function amsPostChat(appId, msg) {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(CHAT_KEY)) || {}; } catch { }
  (all[appId] = all[appId] || []).push({ id: amsUid("c"), date: new Date().toISOString(), ...msg });
  localStorage.setItem(CHAT_KEY, JSON.stringify(all));
}

/* ---------- message log (simulated email) ---------- */
function amsGetMessages() {
  try { return JSON.parse(localStorage.getItem(AMS.MSG_KEY)) || []; } catch { return []; }
}
function amsLogMessage(m) {
  const l = amsGetMessages();
  l.unshift({ id: amsUid("msg"), date: new Date().toISOString(), ...m });
  localStorage.setItem(AMS.MSG_KEY, JSON.stringify(l));
}

/* ---------- AMS settings ---------- */
const AMS_DEFAULT_SETTINGS = { inactiveDays: 60, reminders: true, callName: "KII Innovation Program", deadline: "", blindReview: false };
function amsGetSettings() {
  try { return { ...AMS_DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(AMS.SET_KEY)) || {}) }; }
  catch { return { ...AMS_DEFAULT_SETTINGS }; }
}
function amsSaveSettings(s) { localStorage.setItem(AMS.SET_KEY, JSON.stringify(s)); }
function amsGetInvite() { try { return JSON.parse(localStorage.getItem("kii_invite")) || {}; } catch { return {}; } }
function amsSaveInvite(code) { localStorage.setItem("kii_invite", JSON.stringify({ code: String(code || "").trim() })); }

/* ---------- purchase requests (PR -> quotations -> PO -> reception), staff-only ---------- */
function amsGetPrs() { try { return JSON.parse(localStorage.getItem(AMS.PR_KEY)) || []; } catch { return []; } }
function amsGetPr(id) { return amsGetPrs().find(p => p.id === id) || null; }
function amsSavePr(pr) {
  const l = amsGetPrs(), i = l.findIndex(p => p.id === pr.id);
  pr.updatedAt = new Date().toISOString();
  if (i >= 0) l[i] = pr; else l.unshift(pr);
  localStorage.setItem(AMS.PR_KEY, JSON.stringify(l));
}

/* ---------- internal team tasks (not tied to an applicant) ---------- */
function amsGetInternalTasks() {
  try { return JSON.parse(localStorage.getItem(AMS.ITASK_KEY)) || []; } catch { return []; }
}
function amsSaveInternalTasks(l) { localStorage.setItem(AMS.ITASK_KEY, JSON.stringify(l)); }
function amsUpdateInternalTask(id, patch) {
  const l = amsGetInternalTasks();
  const i = l.findIndex(t => t.id === id);
  if (i >= 0) { l[i] = { ...l[i], ...patch }; amsSaveInternalTasks(l); }
  return l[i] || null;
}

/* ---------- internal team meetings (not tied to an applicant) ---------- */
function amsGetInternalMeetings() {
  try { return JSON.parse(localStorage.getItem(AMS.IMEET_KEY)) || []; } catch { return []; }
}
function amsSaveInternalMeetings(l) { localStorage.setItem(AMS.IMEET_KEY, JSON.stringify(l)); }
function amsUpdateInternalMeeting(id, patch) {
  const l = amsGetInternalMeetings();
  const i = l.findIndex(t => t.id === id);
  if (i >= 0) { l[i] = { ...l[i], ...patch }; amsSaveInternalMeetings(l); }
  return l[i] || null;
}

/* ---------- staff team chat: direct rooms "dm:idA:idB" and project groups "grp:appId" ---------- */
function amsGetStaffChat(room) {
  try { return (JSON.parse(localStorage.getItem(AMS.STCHAT_KEY)) || {})[room] || []; } catch { return []; }
}
function amsPostStaffChat(room, msg) {
  let all = {};
  try { all = JSON.parse(localStorage.getItem(AMS.STCHAT_KEY)) || {}; } catch {}
  (all[room] = all[room] || []).push({ id: amsUid("m"), date: new Date().toISOString(), ...msg });
  localStorage.setItem(AMS.STCHAT_KEY, JSON.stringify(all));
}

/* staff-created group chats: staff members + optionally ONE applicant (applicants never see each other) */
/* ---------- ACL: editable role templates (custom roles + per-role permission sets) ---------- */
function amsGetRoles() {
  let custom = {};
  try { custom = JSON.parse(localStorage.getItem(AMS.ROLES_KEY)) || {}; } catch {}
  return { ...ROLES, ...custom, master_admin: ROLES.master_admin }; // master admin is never editable
}
function amsSaveRole(id, def) {
  let c = {}; try { c = JSON.parse(localStorage.getItem(AMS.ROLES_KEY)) || {}; } catch {}
  if (id === "master_admin") return;
  c[id] = def; localStorage.setItem(AMS.ROLES_KEY, JSON.stringify(c));
}
function amsDeleteRole(id) {
  let c = {}; try { c = JSON.parse(localStorage.getItem(AMS.ROLES_KEY)) || {}; } catch {}
  delete c[id]; localStorage.setItem(AMS.ROLES_KEY, JSON.stringify(c));
}
function amsGetGroups() {
  try { return JSON.parse(localStorage.getItem(AMS.GROUPS_KEY)) || []; } catch { return []; }
}
function amsSaveGroups(l) { localStorage.setItem(AMS.GROUPS_KEY, JSON.stringify(l)); }

/* ---------- workflow helpers ---------- */
function amsWorkflow(app) { return app?.workflow === "B" ? "B" : "A"; }
function amsWfLabel(app) { return amsWorkflow(app) === "B" ? WF_B_NAME : WF_A_NAME; }
function amsWfStages(app) { return amsWorkflow(app) === "B" ? WF_B_STAGES : WF_A_STAGES; }
function amsWfStates(app) { return amsWorkflow(app) === "B" ? WF_B_STATES : WF_A_STATES; }
function amsWfOutcomes(app) { return amsWorkflow(app) === "B" ? WF_B_OUTCOMES : WF_A_OUTCOMES; }
function amsIsTerminal(app) { return TERMINAL_OUTCOMES.includes(app?.outcome); }
function amsNextStage(app) {
  const s = amsWfStages(app), i = s.indexOf(app.stage);
  return i >= 0 && i < s.length - 1 ? s[i + 1] : null;
}
function amsStageOwner(stage) { return STAGE_OWNER[stage] || null; }
/* keep the coarse status in step with the fine-grained state / outcome */
function amsSyncStatus(a) {
  a.status = (amsIsTerminal(a) || a.state === "On Hold" || a.state === "Closed") ? "Inactive" : "Active";
}
function amsSetState(a, state, byName) {
  a.state = state;
  amsSyncStatus(a);
  (a.activities = a.activities || []).unshift({
    date: new Date().toISOString(), icon: "status",
    title: "State changed", desc: `Case is now “${state}”`, by: byName,
  });
  a.lastActivity = new Date().toISOString();
}
/* record a gate verdict (staff-only history of pass / hold / return decisions) */
function amsGate(app, verdict, note, byName) {
  (app.gates = app.gates || []).unshift({
    date: new Date().toISOString(), stage: app.stage, workflow: amsWorkflow(app),
    verdict, note: note || "", by: byName,
  });
}
function amsAdvanceStage(app, byName) {
  const next = amsNextStage(app);
  if (!next) return null;
  const from = app.stage;
  app.stage = next;
  app.stageForced = next;
  if (app.state !== "Active") { app.state = "Active"; amsSyncStatus(app); }
  (app.activities = app.activities || []).unshift({
    date: new Date().toISOString(), icon: "status",
    title: "Stage advanced", desc: `Moved to “${next}”`, by: byName,
  });
  app.lastActivity = new Date().toISOString();
  amsGate(app, "Advanced", `${from} → ${next}`, byName);
  const owner = amsStageOwner(next);
  if (owner) amsNotifyRole(owner, `Case "${app.name}" moved to ${next} — action required.`, `admin.html?v=applicant&id=${encodeURIComponent(app.id)}`);
  return next;
}
/* loop back to an earlier stage (ISO 56002 non-linear iteration) */
function amsLoopBack(app, target, note, byName) {
  const stages = amsWfStages(app);
  if (!stages.includes(target) || stages.indexOf(target) >= stages.indexOf(app.stage)) return false;
  const from = app.stage;
  app.stage = target;
  app.stageForced = target;
  app.state = amsWorkflow(app) === "A" ? "Awaiting KII Review" : "Awaiting KII Action";
  amsSyncStatus(app);
  amsGate(app, "Returned", `${from} ← ${target}${note ? " — " + note : ""}`, byName);
  (app.activities = app.activities || []).unshift({
    date: new Date().toISOString(), icon: "status",
    title: "Returned to earlier stage", desc: `${from} → ${target}${note ? " — " + note : ""}`, by: byName,
  });
  app.lastActivity = new Date().toISOString();
  return true;
}
/* move an approved initiative into Workflow B */
function amsMoveToB(app, byName) {
  app.workflow = "B";
  app.stage = "Support Planning";
  app.stageForced = "Support Planning";
  app.state = "Active";
  app.outcome = "Ongoing";
  amsSyncStatus(app);
  app.tracks = app.tracks || {};
  app.tracks["Support Planning"] = app.tracks["Support Planning"] ||
    { sel: true, status: "In Progress", owner: "", due: "", note: "" };
  app.tracks["Project Completion"] = app.tracks["Project Completion"] ||
    { sel: true, status: "Not Started", owner: "", due: "", note: "" };
  (app.activities = app.activities || []).unshift({
    date: new Date().toISOString(), icon: "status",
    title: "Moved to Workflow B — Project Development & Support", desc: "Evaluation approved — support planning begins.", by: byName,
  });
  app.lastActivity = new Date().toISOString();
  amsGate(app, "Approved", "Application Evaluation completed — entered Project Development & Support", byName);
  const owner = amsStageOwner("Support Planning");
  if (owner) amsNotifyRole(owner, `"${app.name}" was approved — start Support Planning.`, `admin.html?v=applicant&id=${encodeURIComponent(app.id)}`);
}
/* Workflow A milestones: defs + saved state (separate from report milestones `a.milestones`) */
function amsMilestones(app) {
  const saved = app.wfMilestones || {};
  return WF_A_MILESTONES.map(m => ({ ...m, ...(saved[m.id] || {}) }));
}
function amsSetMilestone(app, id, done, byName, note) {
  app.wfMilestones = app.wfMilestones || {};
  app.wfMilestones[id] = done
    ? { done: true, by: byName, date: new Date().toISOString(), note: note || "" }
    : { done: false };
  if (id === "notified" && done) app.decisionNotified = new Date().toISOString();
}
/* issue the Workflow A outcome; approved outcomes hand the case to Workflow B */
function amsDecide(app, outcome, note, byName, extra) {
  app.outcome = outcome;
  if (extra?.transferTo) app.transferTo = extra.transferTo;
  if (extra?.conditions) app.conditions = extra.conditions;
  app.wfMilestones = app.wfMilestones || {};
  app.wfMilestones.decision = { done: true, by: byName, date: new Date().toISOString(), note: outcome };
  amsGate(app, outcome, note, byName);
  if (APPROVED_OUTCOMES.includes(outcome)) { app.wfAOutcome = outcome; amsMoveToB(app, byName); }
  else { app.state = "Evaluation Completed"; amsSyncStatus(app); }
}

/* checklist accessor */
function amsChecklist(app) {
  const def = STAGE_CHECKLISTS[app.stage] || [];
  const saved = app.checklist?.[app.stage] || [];
  return def.map((label, i) => ({ label, done: !!saved[i] }));
}

/* one-time cleanup: remove demo staff/applicants seeded by earlier versions */
function amsCleanupDemoData() {
  if (localStorage.getItem(AMS.CLEAN_FLAG)) return;
  const SEED_EMAILS = ["manager@kii.org", "ceo@kii.org", "huda@kii.org",
    "shary@kii.org", "workshop@kii.org", "expert@kii.org"];
  amsSaveStaff(amsGetStaff().filter(s => !SEED_EMAILS.includes(s.email)));
  if (!amsFindStaff("admin@kii.org"))
    amsAddStaff({ id: "st_" + Math.random().toString(36).slice(2, 9),
      name: "Master Admin", email: "admin@kii.org", ...amsPwFields("admin123"), mustChangePassword: true,
      role: "master_admin", title: "Master Administrator",
      active: true, perms: [...ROLES.master_admin.perms], createdAt: new Date().toISOString() });

  const kept = amsGetApplicants().filter(a => String(a.id).startsWith("portal:"));
  const removedIds = new Set(amsGetApplicants().filter(a => !String(a.id).startsWith("portal:")).map(a => a.id));
  amsSaveApplicants(kept);
  if (removedIds.size) {
    try {
      const chats = JSON.parse(localStorage.getItem(CHAT_KEY)) || {};
      removedIds.forEach(id => delete chats[id]);
      localStorage.setItem(CHAT_KEY, JSON.stringify(chats));
      const msgs = amsGetMessages().filter(m => !removedIds.has(m.appId));
      localStorage.setItem(AMS.MSG_KEY, JSON.stringify(msgs));
    } catch { }
  }
  localStorage.setItem(AMS.CLEAN_FLAG, "1");
}

function amsInit() {
  amsCleanupDemoData();
  seedStaff();
  amsSyncPortal();
}
