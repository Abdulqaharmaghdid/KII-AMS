# Kurdistan Innovation Institute (KII)
# Innovation Application & Management System: System Review and Engineering Brief

| | |
|---|---|
| **Document** | System review (Part A) and rebuild brief for an engineering team (Part B) |
| **Subject system** | KII Applicant Portal + Application Management System (AMS), browser prototype |
| **Prepared for** | KII leadership, Application & Administration Management, the engineering team that will deliver the production system |
| **Status** | v1.0. Use as the baseline requirement for tender, estimation and delivery. |

---

## How to use this document

- **Part A** reviews the current prototype: what it does, what it does well, what blocks it from production, and what to do now.
- **Part B** is a complete brief (prompt) for an engineering team to build the production system from scratch, better, more secure and more robust. It keeps every capability of the prototype.
- **Appendix A** lists every default application question exactly as it exists today. The production system must ship with this catalogue as its default form, and the Master Admin must be able to edit, add, hide, reorder and remove questions.
- **Appendices B–D** list reference data: roles, workflow stages, location rules and message templates.

---

# PART A: SYSTEM REVIEW

## A1. Executive summary

The prototype is a **functionally rich, well-thought-out simulation** of an innovation programme platform. It is comparable in scope to the application and evaluation portals of research institutes and accelerators. It covers the full lifecycle:

**Registration → multi-idea applications → 10-step form → review & submit → staff screening → expert evaluation (with blind review and conflict-of-interest handling) → committee decision → milestones, tranches, KPIs, procurement → reporting.**

Its domain model, user journeys and form content are **valuable and largely correct**. They are the main asset to carry forward.

However, the prototype is **architecturally not deployable for real applicants**. Every piece of data, including staff accounts, passwords, applications, passport numbers and uploaded files, lives **inside each user's own web browser** (`localStorage` and IndexedDB). Four things follow from that:

1. An applicant on a phone and a staff member on an office PC **never see the same data**.
2. Clearing the browser **destroys data permanently**.
3. Security is **advisory only**. Anyone with browser developer tools can read or change any record, or make themselves Master Admin.
4. There is **no backup and no version control**. On 2 Nov 2026 a scripted edit truncated `js/application-merged.js`, and the file had to be rebuilt from Chrome's cache. That incident is direct evidence of this risk.

**Verdict:** keep the prototype as the *executable specification* (UX, rules, questions and workflow). Build the production system with a real server, database, identity provider, file storage and server-side PDF generation, as specified in Part B.

## A2. What was reviewed

| Area | Files | Size |
|---|---|---|
| Applicant form engine (10 steps, schema, validation, migration, report, Form Builder hook) | `js/application-merged.js` | ~1,060 lines |
| Legacy (v1) form renderer for old submissions | `js/application-legacy.js` | 1,266 lines |
| Staff AMS UI (dashboard, applicants, evaluations, meetings, tasks, procurement, reports, documents, team, settings, Form Builder) | `js/admin.js` | ~2,800 lines |
| AMS domain (roles, permissions, stages, checklists, templates, staff store, sync) | `js/ams.js` | ~490 lines |
| Shared storage, auth, hashing, IDs, file store | `js/common.js` | ~330 lines |
| Applicant dashboard | `js/dashboard.js` | 320 lines |
| Sign-up and sign-in | `js/auth.js`, `signup.html`, `login.html` | ~290 lines |
| Location data (countries, Iraqi governorates, towns, universities, 34k world cities) | `js/application-locations.js`, `js/world-cities.csv` | 234 lines + CSV |
| Built-in question metadata for the Form Builder | `js/form-schema.js` (generated) | 84 top-level questions |
| Styles (portal, report, print, AMS) | `css/style.css`, `css/admin.css` | ~1,100 lines |
| Tests (jsdom + Playwright Chromium) | `tests/*.cjs` | 175 + 58 checks + workflow suite + browser suite. All pass. |

## A3. Strengths to keep

1. **Excellent domain coverage:** multi-idea accounts, a cap of 3 active applications, development-area application IDs (`EDU013`), revision requests and resubmission, withdrawal, deadline enforcement, read-only submitted applications.
2. **Strong form UX:** conditional questions, multi-entry "Other → specify" everywhere, searchable lists, Iraq governorate → town hierarchy (Kurdistan first), and a university list per governorate (e.g. Erbil → Koya, Soran). The form also prefills from sign-up data, autosaves drafts, and checks upload type, size and video duration.
3. **Evaluation integrity features:** blind review (identity sections and files hidden from experts), conflict-of-interest handling, multiple evaluations per application, committee decisions, audit log.
4. **Role model fits KII's organisation:** Master Admin, Application & Administration Manager, CEO, Technical Manager/Engineer, Business Coordinator/Developer, Evaluator, Focal Point, plus a per-user permission matrix.
5. **Professional report:** numbered PART sections, full-width sub-tables, files listed under their tables, a single currency per financial request, landscape print/PDF.
6. **Form Builder (new):** the Master Admin can edit wording, help text and required status, hide or show built-in questions, and add, reorder, hide or delete custom questions (9 answer types). Every change is written to the audit log. Core questions that other logic depends on are protected.
7. **Real automated tests**, including a browser end-to-end check at desktop and mobile widths.

## A4. Findings (ranked by severity)

### Critical: blocks production use

| # | Finding | Impact | Required fix |
|---|---|---|---|
| C1 | **No server or database.** All records live in the browser (`localStorage`/IndexedDB). | Staff never see applicants' real submissions. Data is lost when the cache is cleared. There is no multi-device use. | Central API + PostgreSQL + object storage (Part B §B6). |
| C2 | **Client-side security only.** Permissions are checked in JavaScript. Sessions are a localStorage key. Password hashes are computed and stored in the browser (salted SHA-256 ×1000). | Anyone can impersonate any user, including Master Admin, and read every passport number and file. | Server-side authentication (OIDC), RBAC/ABAC enforced by the API, Argon2id hashing, MFA for staff. |
| C3 | **Known default credentials.** Seeded staff accounts use known passwords (e.g. `admin@kii.org / admin123`). | Trivial takeover. | No seeded passwords in production. Invite-only staff onboarding with MFA. |
| C4 | **No version control, no backups.** | Code loss already happened once. Applicant data cannot be recovered. | Git, protected main branch, CI. Database point-in-time recovery, daily off-site backups, restore drills. |
| C5 | **Form Builder settings are stored per browser.** | The Master Admin's edits reach only applicants using that same browser. | Store form definitions server-side, versioned and published (Part B §B4.3). |

### High

| # | Finding | Required fix |
|---|---|---|
| H1 | Personal data (passport, date of birth, phone, address, CV, photo, video) is unencrypted and has no retention policy. | Field-level encryption for passport/ID, encryption at rest, retention schedule, data-subject requests, consent log. |
| H2 | Email notifications are simulated. | Transactional email (and optionally SMS/WhatsApp) with templates, delivery tracking and bounce handling. |
| H3 | PDF depends on the browser's print dialog, so output differs per browser. There is no immutable copy of what was submitted. | Server-side PDF rendering at submission time. Store it immutably with a SHA-256 hash, version, QR verification code, page numbers and watermark. |
| H4 | Uploaded files are not malware-scanned. Browser storage quota is ~hundreds of MB. | Object storage with signed URLs, antivirus scanning, resumable uploads, type sniffing (not extension only). |
| H5 | Applicant ID sequence (`EDU013`) is generated in the browser, so duplicates are possible. | Atomic server-side sequence per development area and call. |
| H6 | No Kurdish (Sorani) or Arabic interface; no right-to-left support. | Full i18n: EN / KU / AR with RTL layouts and translated form definitions. |

### Medium

| # | Finding | Required fix |
|---|---|---|
| M1 | Very large single files (`admin.js` ~2,800 lines), no modules, no type checking, no build step. | Modular TypeScript codebase, strict types, linting, code owners. |
| M2 | HTML built from template strings with manual escaping. XSS-safe today only through discipline. | A component framework with auto-escaping, plus a strict Content-Security-Policy. |
| M3 | Legacy v1 renderer (1,266 lines) is kept only for old submissions. | Migrate legacy records into the new answer model once, then retire the renderer. |
| M4 | 34k-line world-cities CSV downloaded by every applicant. | Server-side search API with typeahead. |
| M5 | Accessibility not audited. | WCAG 2.2 AA conformance, screen-reader and keyboard testing. |
| M6 | Manual cache-busting (`?v=`). | Hashed build assets. |
| M7 | No monitoring or error reporting. | Central logging, metrics, alerting, uptime monitoring. |

### Low

- Staff "Question" column in the Form Builder wraps tightly on narrow screens. A wider layout or detail drawer is preferable.
- Some review sections compute "missing" against the *current* form for already-submitted applications. Production must validate against the form version the application was submitted with.

## A5. Scorecard of the current prototype

| Dimension | Score (0–10) | Comment |
|---|---|---|
| Domain and workflow completeness | **8.5** | Covers the whole lifecycle. |
| Applicant UX | **8** | Professional, guided, conditional. |
| Reporting / PDF | **7** | Good on screen. PDF depends on the browser. |
| Staff tooling | **7.5** | Broad. Some screens are dense. |
| Security | **1** | Client-side only. Not acceptable for personal data. |
| Data durability | **1** | Per-browser storage, no backups. |
| Scalability / multi-user | **1** | Single browser. |
| Maintainability | **4** | Tests exist, but monolithic files and no version control. |
| Accessibility / i18n | **3** | English only, not audited. |

## A6. Immediate actions for the prototype (this week)

1. **Put the project under Git** and push it to a private remote. Commit after every working change.
2. Change the Master Admin password. Do not put real applicant data into the prototype.
3. Keep a dated zip backup of the project folder until Git is in place.
4. Treat the prototype as the **reference specification**: its tests, screens and Appendix A are the acceptance baseline for Part B.

---

# PART B: ENGINEERING BRIEF (PROMPT FOR THE ENGINEERING TEAM)

> **Copy everything in Part B and Appendices A–D into your engineering team's kickoff, RFP or AI-assisted build.**

## B0. Role and mission

You are a senior product engineering team with deep experience building **competitive application, evaluation and grant-management platforms** for research institutes, innovation agencies and accelerators: multi-stage calls, expert peer review, blind review, conflict-of-interest management, committee decisions and post-award monitoring.

Your mission is to design, build, secure, test, document, deploy and hand over the **KII Innovation Application & Management System**, a production-grade, multi-user, multilingual web platform for the Kurdistan Innovation Institute (Erbil, Kurdistan Region of Iraq). It replaces a browser-only prototype.

You must:

- preserve **every** capability of the prototype (Part A §A3 and Appendices);
- remove every weakness listed in Part A §A4;
- ship with the **current application questions as the default form** (Appendix A);
- give the **Master Admin a full, safe, versioned Form Builder**;
- produce **professional on-screen overviews, reports and PDFs**.

Quality bar: secure by design, private by default, accessible, fast on mid-range Android phones over 3G/4G, auditable end-to-end, and maintainable by a small local team for 10+ years.

## B1. Goals and non-goals

**Goals**

1. A single source of truth: every applicant, staff member and evaluator sees the same live data from any device.
2. Trustworthy evaluation: fair, blind where configured, conflict-free, traceable, reproducible.
3. Configurability without developers: calls, forms, stages, rubrics, templates and roles are managed in the admin UI.
4. Official-quality documents: immutable submission PDFs and programme reports.
5. Compliance with Iraqi/KRG requirements and international good practice for personal data (GDPR-aligned).

**Non-goals (phase 1)**

- Public marketplace or investor portal (only "Investor / Stakeholder" stage tracking).
- Payment processing. Tranches are recorded, not paid, through the system.
- Native mobile apps. A responsive PWA is required instead.

## B2. Users and roles

Implement **RBAC with fine-grained permissions plus attribute rules** (ABAC), always enforced **on the server**.

| Role | Purpose | Default permissions |
|---|---|---|
| Applicant | Registers, applies, responds to tasks, reports milestones | Own records only |
| Master Admin | Owns the system | All permissions, Form Builder, system settings, role management. Cannot be locked out (break-glass procedure). |
| Application & Administration Manager | Runs calls and operations | Everything except system ownership. Can grant and restrict other staff's permissions. Form Builder only if granted. |
| CEO | Approvals, oversight | View applicants, financials, reports; make decisions; meetings; tasks |
| Technical Manager | Leads technical evaluation and prototype stage | View/edit applicants, evaluate, tasks, meetings, documents, reports |
| Technical Engineer | Technical assessment and support | View, evaluate, tasks, meetings, documents |
| Business Coordinator | Coordination, documents | View, tasks, meetings, documents |
| Business Developer | Market validation | View, meetings, tasks, reports |
| Evaluator / Expert (internal or external) | Scores assigned applications | Only assigned applications. Blind view when enabled. Must declare conflicts of interest first. |
| Workshop / Focal Point | Facility access, read-only follow-up | Read-only project history |
| Auditor (new) | Compliance review | Read-only on everything including the audit log. No PII export. |

Permission catalogue (minimum): `view_applicants`, `edit_applicants`, `manage_tasks`, `manage_meetings`, `evaluate`, `manage_documents`, `view_financials`, `manage_financials`, `manage_procurement`, `make_decisions`, `view_reports`, `manage_staff`, `manage_form`, `manage_calls`, `manage_templates`, `export_data`, `view_pii`, `view_audit`.

**Rules:**

- An evaluator can access an application only if assigned to it **and** having declared no conflict of interest.
- `view_pii` is separate from `view_applicants`, and blind review removes PII at the API level, not only in the UI.
- Every privilege change is audited.

## B3. Applicant journey: functional requirements

### B3.1 Account and identity

- Sign-up fields: first, second and third name as in passport; date of birth (soft Year/Month/Day pickers); phone with country code (default **+964**); email (username + domain picker, `gmail.com` default, "other domain" allowed); organisation; multiple website or social profiles (+ add); country → province/main city → town/district (Appendix C); passport number; password; consent to data processing (versioned consent text, stored with timestamp).
- Email verification required. Optional phone OTP. Password rules follow NIST 800-63B, checked against breached-password lists. Rate-limited login with progressive lockout. Password reset by email link.
- Every new application is **prefilled** from the profile. The applicant edits the prefilled values per application, and edits never overwrite the profile silently.

### B3.2 Ideas / applications

- An applicant may hold multiple ideas, with **at most 3 active (draft or under review)**. A slot is released when an application is closed or finished, rejected, delayed or closed by evaluators, or withdrawn.
- **Delete** is allowed for drafts only. Submitted applications can only be **withdrawn** (with a reason) and stay on record.
- **Application ID:** when the applicant accepts the terms and selects a KII development area (Human Being, Smart Cities, House Ware, Sustainable Energy, Health, Education, Transportation, IT, Fashion, Automation, Other → specify), the server atomically assigns `<AREA-PREFIX><sequence>` (e.g. `EDU013`). The ID is immutable and shown to the applicant and to staff everywhere.
- Each call (cohort) has open/close dates. After the deadline, submission is blocked unless staff grant an individual extension.

### B3.3 Form filling

- The 10 steps of Appendix A, rendered from the **published form version** of the call.
- Autosave every few seconds plus explicit **Save & Exit**. A failed upload never discards typed answers. Errors are shown inline per field.
- Conditional logic, multi-entry "Other → specify", searchable lists, and repeating tables (education, team, courses, financial requests, milestones, other support, recommenders).
- Financial request: **one currency per request (USD or IQD)**, item rows (Item, Type, Qty, Unit, Cost per unit, Notes), live total in the selected currency.
- Uploads: resumable (tus or S3 multipart), progress bar, type sniffing, size and duration limits (e.g. 60-second statement video, 180-second demo), antivirus scan before staff can open the file.
- Sidebar with step status, progress bar, and "N missing" per step.

### B3.4 Review & Submit

- Full **report preview** (spec in §B5) with section completeness chips, Edit links per section, and a declaration of accuracy.
- Submit is enabled only when every required answer is valid and the declaration is ticked.
- On submit, the server freezes the answers against the form version, generates the **official PDF**, stores both immutably, records a hash, and sends the confirmation email.

### B3.5 After submission

- Read-only view, status timeline with plain-language stage explanations, tasks with responses (text, files, images, video), messages with staff, milestone reports, notifications (in-app + email).
- Revision request from staff reopens **only the sections staff unlock**. Resubmission creates version n+1. All versions stay viewable and diffable by staff.
- Download PDF of any submitted version.

## B4. Staff AMS: functional requirements

### B4.1 Operations

- **Dashboard:** KPIs (applications by stage, sector, development area, governorate, gender; SLA breaches; inactive applicants), date filters, action queue, alerts.
- **Applicants:** list with typo-tolerant search (e.g. "abdlqhar" finds "Abdulqahar"), filters, saved views, bulk actions, CSV/XLSX export (permission-gated, PII-masked unless `view_pii`).
- **Applicant record (tabs):** Overview, Application (report view), Documents, Evaluations, Decisions, Tasks, Meetings, Messages, Milestones & Tranches, KPIs, Financials, Procurement, Activity/Audit.
- **Workflow:** stages, checklists and stage owners (Appendix B) are configurable per call. Stage changes notify the owner role and, through templates, the applicant. SLA timers per stage. Outcome labels: Successful, Supported, Rejected, Withdrawn.
- **Meetings, tasks, procurement (PRs), financials:** approved support, tranches, spend vs approved, single-currency requests with an optional exchange-rate snapshot for reporting.
- **Message templates** (Appendix D) with variables and per-language versions.

### B4.2 Evaluation

- Screening/eligibility checklist → expert assignment (manual or load-balanced) → **conflict-of-interest declaration** required before access → **blind mode** per call (the server strips identity fields and files flagged `pii`) → rubric scoring (criteria, weights, 1–5 or 0–10 scales, mandatory comments below a threshold) → aggregation (mean, trimmed mean, spread alerts for calibration) → committee decision with minutes and vote record.
- Evaluators see only their assignments. Scores are hidden from other evaluators until each has submitted (configurable).
- Full audit of who saw what and when.

### B4.3 Form Builder (Master Admin; `manage_form` can be delegated)

This is a **core module**. Requirements:

1. **Defaults:** the system ships with Appendix A loaded as *Form v1* for the first call. Every question is editable.
2. **Operations:** edit wording, help text, placeholder, required/optional, validation rules (min/max length, number range, regex, file types/size/count, video duration), choices (add, remove, reorder, rename with stable value IDs), conditional logic (show/require when *question X* meets a condition, with AND/OR), position (drag-and-drop within and across steps), add, duplicate, hide or show, delete. Steps can also be added, renamed, reordered and hidden.
3. **Question types:** short text, paragraph, number, currency amount, date, date of birth, email, phone (+code), URL, list of entries (+ add), dropdown, searchable list (including the location and university datasets), checkboxes (with max selections), yes/no, tick box, file upload, video upload, repeating table (with its own sub-questions), section heading/info text, and declaration.
4. **Field flags:** `pii` (hidden in blind review), `scored` (maps to rubric criteria), `reportable` (appears in analytics), `translatable`.
5. **Versioning and publishing:** edits happen in a **draft** version. The Preview opens an exact applicant view on desktop and mobile. **Publish** creates an immutable version. Applications record the version they started with. Drafts migrate to the new version with a clear mapping (removed questions keep their stored answers but stop being required). Submitted applications **never** change.
6. **Safety:**
   - Questions used by system logic (identity names, email, phone, country/city, terms, development area, title, sector/sub-sector, support types, currency, financial request) are **core**: they can be reworded but not deleted.
   - Deleting a question that has answers requires typing a confirmation and archives the question instead of destroying data.
   - Every change is audited with before/after.
7. **Translations:** each question has EN/KU/AR text. Publishing warns when translations are missing.
8. **Import/export:** form definitions as JSON, for copying between calls and for backup.

Reference shape of a stored form definition:

```json
{
  "formId": "kii-innovation", "version": 7, "status": "published", "publishedAt": "2026-11-02T09:00:00Z",
  "steps": [
    { "id": "innovation", "title": { "en": "Project Information", "ku": "…", "ar": "…" },
      "questions": [
        { "id": "title", "type": "text", "core": true, "required": true,
          "label": { "en": "Innovation title" }, "validation": { "maxLength": 100 } },
        { "id": "cq_launch_year", "type": "select", "required": true,
          "label": { "en": "What is your expected launch year?" },
          "choices": [ { "value": "y2026", "label": { "en": "2026" } }, { "value": "y2027", "label": { "en": "2027" } } ],
          "visibleWhen": { "all": [ { "q": "implemented", "op": "eq", "value": "No" } ] },
          "flags": { "pii": false, "scored": false, "reportable": true } }
      ] }
  ]
}
```

## B5. Overview, report and PDF specification

The same rendering model is used for (a) the applicant's Review & Submit preview, (b) the staff application view, and (c) the **server-rendered PDF**. One template, three outputs.

**Document structure**

1. **Cover band:** KII colour logo (`kii_logocl.png`), programme and call name, document title "Application Summary Report", application ID, status pill, QR code linking to a verification page.
2. **Meta grid (2×3 or 3×2):** Applicant (hidden in blind mode), Sector, Development area, Application ID, Started, Submitted (with version number).
3. **Contents:** numbered PART list with completeness indicators (on screen) or page numbers (PDF).
4. **PART n sections:** a heading with a rule under it, then a **two-column answer table** (question in a shaded ~25–30% column, answer in the rest). "Not provided" appears in muted italics.
5. **Repeating answers** render as **full-width sub-tables** under a caption with a row count. Rules:
   - Use short column headers (e.g. Degree · Country · City · University · Field · Start · End).
   - **Derived columns merge related fields.** "Until present" and "End year" become one **End** column showing the year or "Present".
   - **File fields never become columns.** They are listed **under the table** as "Row n · Certificates: file.pdf (0.11 MB)".
   - Columns get proportional widths; long unbroken text wraps; header rows repeat on every PDF page; a row never splits across pages.
   - Money columns are right-aligned with a currency suffix, and there is a total row.
6. **Attachments:** a badge, file name, size, and duration for video. In the PDF, an attachments index with file hashes (files themselves are not embedded).
7. **Declaration box** with the applicant's declaration text, timestamp and IP/device fingerprint (staff view only).
8. **Footer on every page:** "Kurdistan Innovation Institute · Innovation Program · {ID} · {title}" + "Page x of y" + generated timestamp. Optional "CONFIDENTIAL" watermark.

**PDF engineering**

- Generate server-side with headless Chromium (Playwright/Puppeteer) or an equivalent typesetting engine. Never rely on the user's print dialog.
- A4. Portrait by default for Q&A pages; pages that contain wide tables switch to **landscape** automatically through named CSS pages. Fonts are embedded and cover Latin, Kurdish (Sorani) and Arabic script, with correct RTL shaping.
- PDF/A-2b for archival. File name: `KII_{ID}_{v}_{yyyy-mm-dd}.pdf`.
- Stored immutably (object-lock/WORM bucket), with SHA-256 kept in the database. The verification page shows ID, version and hash match.
- Blind-review PDFs are produced separately, without PII, for experts.
- Generation p95 below 5 s. Done in a background job for bulk export (e.g. a "committee pack" zip of all shortlisted PDFs).

**Programme reports** (staff): pipeline by stage, sector and governorate; gender and age distribution; evaluation score distributions and evaluator agreement; time-in-stage and SLA; financial support requested vs approved vs spent (per currency); KPI progress; exports to PDF, XLSX and CSV. Charts must be accessible (data tables available).

## B6. Architecture (recommended; the team may propose equivalents with justification)

| Layer | Recommendation |
|---|---|
| Frontend | TypeScript, React + Next.js (or SvelteKit), component library with auto-escaping, i18n (ICU messages), RTL support, PWA (offline draft caching with conflict-safe sync) |
| Backend | TypeScript (NestJS) or Python (Django + DRF): modular monolith first (Identity, Calls & Forms, Applications, Files, Evaluation, Workflow, Post-award, Messaging, Reporting, Audit) |
| Database | PostgreSQL 16+. Relational core plus JSONB for form definitions and answers. Row-level security as defence in depth. |
| Files | S3-compatible object storage (e.g. MinIO on-premise or a cloud bucket in-region), signed URLs, ClamAV scanning, object lock for submitted PDFs |
| Identity | OpenID Connect provider (Keycloak or equivalent). Applicants use email/password plus optional OTP. **Staff MFA is mandatory** (TOTP/WebAuthn). |
| Async | Job queue (Redis/BullMQ, or Celery) for PDFs, emails, scans, exports and reminders |
| Email/SMS | Transactional provider with SPF/DKIM/DMARC. Optional WhatsApp Business. |
| Observability | OpenTelemetry traces, structured logs, metrics, alerting, uptime checks, error tracking |
| Delivery | Docker, IaC (Terraform), CI/CD (lint, type-check, unit, integration, e2e, SAST/DAST, dependency and container scanning), staging that mirrors production, blue/green deploys |
| Hosting | Data residency acceptable to KII/KRG (in-country or approved region). Encrypted backups to a second location. |

**Core data model (minimum):** User, ApplicantProfile, StaffProfile, Role, Permission, RoleAssignment, Call, FormDefinition (versioned), Application, ApplicationVersion (frozen answers + form version + PDF ref + hash), Answer (JSONB per step), FileObject (scan status, hash), Stage, StageTransition, Checklist, Assignment, ConflictDeclaration, Rubric, Evaluation, Decision, Task, TaskResponse, Meeting, Message, Notification, Milestone, Tranche, KPI, FinancialRequest, ProcurementRequest, Template, AuditEvent (append-only, hash-chained), ConsentRecord, DataRequest.

## B7. Security and privacy (non-negotiable)

- OWASP ASVS **Level 2** as acceptance criteria. OWASP Top 10 mitigations verified by an independent penetration test before go-live.
- TLS 1.2+ everywhere, HSTS, strict CSP, secure cookies (HttpOnly, SameSite), CSRF protection, rate limiting, bot protection on sign-up.
- Passwords hashed with **Argon2id**. Sessions are server-side or short-lived tokens with rotation. Idle timeout 30–60 min; staff absolute timeout 12 h.
- Encryption at rest (database and storage). **Field-level encryption** for passport number and date of birth, with KMS-managed keys.
- Authorisation checks in the API on every request (deny by default), with tests per role covering who can and cannot do each action.
- Blind review enforced in the API serializers.
- Audit log: append-only, tamper-evident, covering logins, permission changes, form changes, views of PII, exports, stage changes and decisions.
- Privacy: versioned consent, data minimisation, retention schedule (e.g. unsuccessful applications deleted or anonymised after N years), export and deletion on request, privacy notice in EN/KU/AR, DPIA before launch.
- Backups: RPO ≤ 15 min, RTO ≤ 4 h, restore tested quarterly.

## B8. Non-functional requirements

| Area | Target |
|---|---|
| Performance | p95 page interaction < 300 ms (API), first load < 2.5 s on 4G mid-range Android, form step switch < 150 ms |
| Scale | 20,000 applicants per call, 500 concurrent users at deadline peak, 1 TB files/year |
| Availability | 99.5% monthly, with a maintenance window outside call deadlines |
| Accessibility | WCAG 2.2 AA (keyboard, screen readers, contrast, focus, error identification) |
| Languages | English, Kurdish (Sorani), Arabic. Full RTL. Locale-aware dates and numbers. |
| Browsers | Last 2 versions of Chrome, Edge, Firefox, Safari. Android 9+, iOS 15+. |
| Maintainability | Strict TypeScript/type hints, ≥ 80% unit coverage on domain logic, documented APIs (OpenAPI), ADRs for key decisions |

## B9. Migration from the prototype

1. Build an **export tool** in the prototype that writes a JSON bundle of users, applications (all versions), staff, AMS records, Form Builder configuration, and files from IndexedDB.
2. Write an importer that maps prototype keys (Appendix A keys are stable) to the production model, re-hashes nothing (users must reset passwords), and verifies counts and checksums.
3. Import legacy v1 submissions through the existing `upgradeV2`/v3 migration rules, then retire the legacy renderer.

## B10. Delivery plan and acceptance

| Phase | Scope | Exit criteria |
|---|---|---|
| 0. Discovery (2–3 wks) | Confirm requirements, data protection assessment, UX prototypes in EN/KU/AR | Signed-off backlog, architecture ADRs |
| 1. Foundation | Identity, roles, audit, file service, CI/CD, environments | Pen-test-ready skeleton; RBAC tests green |
| 2. Applicant portal + Form engine + Form Builder | Appendix A as Form v1, drafts, uploads, review, submit, server PDF | All Appendix A questions behave exactly as specified; PDF golden-file tests pass |
| 3. AMS operations + evaluation | Workflow, assignments, COI, blind review, rubrics, decisions, templates, notifications | End-to-end call simulation with 3 evaluators per application |
| 4. Post-award + reporting | Milestones, tranches, KPIs, financials, procurement, analytics, exports | Reports reconcile with database totals |
| 5. Hardening + launch | Pen test, load test at 2× peak, accessibility audit, backup/restore drill, training, runbooks | Go-live checklist signed by KII |

**Definition of done (every feature):** code reviewed; typed; unit, integration and e2e tests; authorisation tests; accessible; translated strings; audit events; documentation updated; deployed to staging; product owner acceptance.

**Testing:** a contract test suite generated from Appendix A (every question, condition and validation rule); Playwright e2e for each role's journey; visual regression for the report and PDF (portrait and landscape pages, long text, RTL); load tests (k6); security scans (SAST, DAST, dependencies).

## B11. Deliverables

Source code in KII's own Git organisation; infrastructure as code; OpenAPI docs; admin and user manuals (EN/KU/AR); runbooks (deploy, backup/restore, incident, key rotation); data-protection documentation; training sessions for each role; 3-month hypercare.

---

# APPENDIX A: Default application form (current questions, must ship as Form v1)

Conventions: *required* = must be answered when visible; *conditional* = shown only when an earlier answer requires it; ↳ marks a column of a repeating table. Keys are stable identifiers for migration. The Master Admin may later change any of these through the Form Builder (core questions can be reworded but not deleted).

### Step 1 — Instructions
_Before you begin, accept our terms and tell us how you're applying._

| # | Key | Question | Type | Rules | Choices |
|---|---|---|---|---|---|
| 1 | `agreeApp` | I agree to the Application terms | Tick box | required |  |
| 2 | `devArea` | KII development area for your application | Dropdown | required, conditional | Human Being · Smart Cities · House Ware · Sustainable Energy · Health · Education · Transportation · IT · Fashion · Automation · Other |
| 3 | `devAreaOther` | Specify the development area | List of entries (+ add) | required, conditional |  |

### Step 2 — Personal Background
_Tell us who you are, how to reach you, and your background._

| # | Key | Question | Type | Rules | Choices |
|---|---|---|---|---|---|
| 1 | `firstName` | First name (exactly as in passport) | Short text | required |  |
| 2 | `secondName` | Second name (exactly as in passport) | Short text | required |  |
| 3 | `thirdName` | Third name (exactly as in passport) | Short text | required |  |
| 4 | `passportNo` | Passport number | Short text | required, max 20 chars |  |
| 5 | `birthDate` | Date of birth | Date of birth (Y/M/D pickers) | required |  |
| 6 | `gender` | Gender | Dropdown | required | Male · Female · Prefer not to say |
| 7 | `country` | Address – Country | Searchable list | required | _dynamic list_ |
| 8 | `city` | (dynamic label) | Searchable list | required | _dynamic list_ |
| 9 | `cityOther` | Specify your governorate or city | List of entries (+ add) | required, conditional, max 80 chars |  |
| 10 | `town` | Town / district | Searchable list | optional, conditional | _dynamic list_ |
| 11 | `street` | Street address | Short text | required |  |
| 12 | `postal` | Postal code | Short text | optional, max 12 chars |  |
| 13 | `email` | Email | Email | required |  |
| 14 | `phoneCode` | Phone country code | Dropdown | required | ~80 international dialing codes; default **+964** (Iraq) |
| 15 | `phone` | Phone number (WhatsApp) | Digits | required |  |
| 16 | `linkedIn` | Online profile or website | List of entries (+ add) | optional, max 300 chars |  |
| 17 | `educationType` | Highest level of education | Dropdown | required | High School or lower · Higher Education |
| 18 | `hsSchool` | School / institution | Short text | optional, conditional |  |
| 19 | `schoolCertificate` | Transcript or certificate | File upload | optional, conditional, pdf, ≤20 MB, up to 1 file(s) |  |
| 20 | `education` | Higher education | Repeating table | required, conditional, up to 20 rows |  |
| 20.1 | `education.level` | ↳ Degree Level | Dropdown | required | Diploma · Bachelor · Master · PhD · Other |
| 20.2 | `education.levelOther` | ↳ Specify degree | List of entries (+ add) | required, conditional |  |
| 20.3 | `education.country` | ↳ Country of education | Searchable list | required | _dynamic list_ |
| 20.4 | `education.city` | ↳ City of education | Searchable list | required | _dynamic list_ |
| 20.5 | `education.institution` | ↳ University / institution | Searchable list | required | _dynamic list_ |
| 20.6 | `education.fieldOfStudy` | ↳ Field of Education | Dropdown | required | Engineering · Education · Health & Medicine · Science · Business & Management · Agriculture · Computer Science & IT · Arts & Humanities · Law · Social Sciences · Other |
| 20.7 | `education.fieldOfStudyOther` | ↳ Specify field of education | List of entries (+ add) | required, conditional |  |
| 20.8 | `education.startYear` | ↳ Study start year | Searchable list | required | _dynamic list_ |
| 20.9 | `education.currentlyStudying` | ↳ Until present (currently studying) | Tick box | optional |  |
| 20.10 | `education.endYear` | ↳ Study end year | Searchable list | required, conditional | _dynamic list_ |
| 20.11 | `education.transcripts` | ↳ Transcripts / certificates | File upload | optional, pdf, ≤20 MB, up to 10 file(s) |  |
| 21 | `photo` | Photograph | File upload | optional, jpg/jpeg/png, ≤20 MB, up to 1 file(s) |  |
| 22 | `cv` | CV / Resume | File upload | optional, pdf, ≤20 MB, up to 1 file(s) |  |
| 23 | `courses` | Non-degree courses and certifications (optional) | Repeating table | optional, up to 20 rows |  |
| 23.1 | `courses.courseName` | ↳ Course name | Short text | required, max 150 chars |  |
| 23.2 | `courses.provider` | ↳ Organisation, institute or company that provided the course | Short text | required, max 150 chars |  |
| 23.3 | `courses.certificate` | ↳ Certificate (PDF, JPG or PNG) | File upload | optional, pdf/jpg/jpeg/png, ≤20 MB, up to 3 file(s) |  |

### Step 3 — Project Information
_Tell us what your idea is, what problem it solves and who it helps._

| # | Key | Question | Type | Rules | Choices |
|---|---|---|---|---|---|
| 1 | `title` | Innovation title | Short text | required, max 100 chars |  |
| 2 | `sector` | Sector | Dropdown | required | _dynamic list_ |
| 3 | `sectorOther` | Specify sector | List of entries (+ add) | required, conditional |  |
| 4 | `subSector` | Sub-sector | Dropdown | required, conditional | _dynamic list_ |
| 5 | `subSectorOther` | Specify sub-sector | List of entries (+ add) | required, conditional |  |
| 6 | `explain` | Short description of your innovation | Paragraph | required, max 1000 chars, min 300 chars |  |
| 7 | `problem` | What specific problem or challenge does your innovation solve, and how does it solve it? | Paragraph | required, max 2000 chars, min 300 chars |  |
| 8 | `innovationPoint` | What makes your idea innovative or better than what already exists in the market? | Paragraph | required, max 1000 chars, min 300 chars |  |
| 9 | `beneficiaries` | Who benefits from your innovation? | Paragraph | required, max 1000 chars |  |
| 10 | `workDuration` | How long have you worked on your project? | Dropdown | required | 0–6 months · 7–12 months · 1–2 years · 2–4 years · More than 4 years |
| 11 | `implemented` | Have similar innovations been successfully implemented elsewhere? | Dropdown | required | Yes · No |
| 12 | `implementedWhere` | Where were they implemented, and with what results? Please give examples. | Paragraph | required, conditional, max 1000 chars |  |
| 13 | `sdgs` | UN Sustainable Development Goals supported by your innovation | Multi-select | optional, max 5 choices | 1 No Poverty · 2 Zero Hunger · 3 Good Health and Well-being · 4 Quality Education · 5 Gender Equality · 6 Clean Water and Sanitation · 7 Affordable and Clean Energy · 8 Decent Work and Economic Growth · 9 Industry, Innovation and Infrastructure · 10 Reduced Inequalities · 11 Sustainable Cities and Communities · 12 Responsible Consumption and Production · 13 Climate Action · 14 Life Below Water · 15 Life on Land · 16 Peace, Justice and Strong Institutions · 17 Partnerships for the Goals |

### Step 4 — Your Team
_Tell us who is building this and what skills you have. The evaluation team uses this step to judge whether the idea can actually be built._

| # | Key | Question | Type | Rules | Choices |
|---|---|---|---|---|---|
| 1 | `roles` | Your role in the innovation | Multi-select | required | Founder · Co-Founder · CEO · COO · CTO · Other |
| 2 | `roleOther` | Specify your role | List of entries (+ add) | required, conditional |  |
| 3 | `members` | Team members | Repeating table | required, up to 20 rows |  |
| 3.1 | `members.name` | ↳ Full name | Short text | required |  |
| 3.2 | `members.email` | ↳ Email | Email | required |  |
| 3.3 | `members.phone` | ↳ Phone number with country code | Phone (+code) | required |  |
| 3.4 | `members.role` | ↳ Role | Dropdown | required | Founder · Co-Founder · CEO · COO · CTO · Other |
| 3.5 | `members.roleOther` | ↳ Specify role | List of entries (+ add) | required, conditional |  |
| 3.6 | `members.cv` | ↳ CV (PDF) | File upload | optional, pdf, ≤20 MB, up to 1 file(s) |  |
| 4 | `skills` | What technical capabilities and relevant experience does your team have? | Multi-select | required | Software development · Electronics and instrumentation · Product design and fabrication · CAD and mechanical design · Data science and artificial intelligence · Laboratory or scientific research · Civil engineering and construction · Business, finance and marketing · Other |
| 5 | `skillsOther` | Specify other capabilities | List of entries (+ add) | required, conditional |  |

### Step 5 — Technical Background
_Show us how your idea works and how far you have built it._

| # | Key | Question | Type | Rules | Choices |
|---|---|---|---|---|---|
| 1 | `technical` | How does your solution work technically? Describe the key components, technologies and materials involved. | Paragraph | required, max 2000 chars, min 300 chars |  |
| 2 | `prototypeStage` | Do you have a prototype? | Dropdown | required | No, not yet · Concept drawings or design only · Proof of concept · Working prototype · Tested with real users · Pre-production or MVP |
| 3 | `testResults` | Have you tested your prototype? Describe how it was tested and the results. If not yet tested, explain what testing is planned. | Paragraph | required, conditional, max 1500 chars |  |
| 4 | `builtBy` | Who developed the prototype? | Dropdown | required, conditional | Our team · Partly outsourced · Fully outsourced |
| 5 | `prototypePhotos` | Prototype photos | File upload | conditionally required, conditional, jpg/jpeg/png, ≤20 MB, up to 5 file(s) |  |
| 6 | `prototypeDemo` | Prototype demo video | File upload | optional, conditional, mp4, ≤200 MB, up to 1 file(s), ≤180 s video |  |
| 7 | `drawings` | Drawings, sketches, schematics or CAD files | File upload | optional, pdf/png/jpg/jpeg, ≤20 MB, up to 10 file(s) |  |
| 8 | `prototypeNeeds` | What do you need to build your first or next prototype? | Multi-select | required | Materials & components · Tools & equipment · Workshop space · Engineering expertise · Software development · Testing facilities · Funding · Other |
| 9 | `needsOther` | Specify other prototype needs | List of entries (+ add) | required, conditional |  |
| 10 | `needsDetail` | Describe what you need for the prototype | Paragraph | required, max 500 chars |  |

### Step 6 — Protection & Rules
_Tell us how your idea is protected and which rules apply to it._

| # | Key | Question | Type | Rules | Choices |
|---|---|---|---|---|---|
| 1 | `ipStatus` | Intellectual property status | Dropdown | required | No protection yet · Planning to file · Patent pending · Patent granted · Other protection (copyright, trademark, trade secret) |
| 2 | `ipOwner` | Who owns the IP? | Dropdown | optional | Me · Our team · My university · My employer · Other |
| 3 | `ipOwnerOther` | Specify IP owner | List of entries (+ add) | required, conditional |  |
| 4 | `regulatory` | Does it need a regulatory approval, certification or safety standard (e.g. medical, food, electrical)? | Dropdown | required | Yes · No · Not sure |
| 5 | `regulatoryDetail` | Which approvals, certifications or standards? | Paragraph | required, conditional, max 500 chars |  |
| 6 | `legalEntity` | Legal entity status | Dropdown | required | Not registered yet (individual / team) · Registration in progress · Registered company · NGO / non-profit · University or research spin-off |

### Step 7 — Market & Business
_Who will use or buy this, and how could it become a business?_

| # | Key | Question | Type | Rules | Choices |
|---|---|---|---|---|---|
| 1 | `targetCustomers` | Who are your target customers or users, and who benefits from it? | Paragraph | required, max 1500 chars, min 300 chars |  |
| 2 | `competitors` | Who are your competitors or alternatives? | Paragraph | required, max 1000 chars |  |
| 3 | `businessPotential` | Could your idea become a business? | Dropdown | required | Yes · Maybe · No |
| 4 | `businessDetail` | How would it make money? | Paragraph | required, conditional, max 1000 chars |  |
| 5 | `businessModel` | Business model | Dropdown | optional | B2B – selling to businesses · B2C – selling to consumers · B2G – selling to government · Licensing the technology · Subscription / SaaS · Marketplace / platform · Non-profit / grant-funded · Other |
| 6 | `businessModelOther` | Specify business model | List of entries (+ add) | required, conditional |  |
| 7 | `traction` | Traction so far | Short text | optional, max 500 chars |  |
| 8 | `pitchDeck` | Pitch deck or business plan (optional) | File upload | optional, pdf, ≤20 MB, up to 1 file(s) |  |

### Step 8 — Support from KII
_What do you need from KII, and what will you achieve with it?_

| # | Key | Question | Type | Rules | Choices |
|---|---|---|---|---|---|
| 1 | `supportTypes` | What support do you need from KII? | Multi-select | required | Consulting · Mentorship · Engineering Workshop Access · Financial support |
| 2 | `facilities` | Which facilities do you need from KII? | Multi-select | required, conditional | 3D printing · CNC or laser cutting · Electronics lab · Metal or wood workshop · Computing or software support · Testing & measurement equipment · Other |
| 3 | `facilitiesOther` | Specify other facilities | List of entries (+ add) | required, conditional |  |
| 4 | `reqCurrency` | Currency for the whole request | Dropdown | required, conditional | USD · IQD |
| 5 | `requirements` | Financial support request | Repeating table | required, conditional, up to 20 rows |  |
| 5.1 | `requirements.rqItem` | ↳ Item | Short text | required, max 150 chars |  |
| 5.2 | `requirements.rqType` | ↳ Type | Dropdown | optional | Equipment · Manpower · Device · Software / subscription · Material · Venue / space · Training · Other |
| 5.3 | `requirements.rqQty` | ↳ Qty | Number | required |  |
| 5.4 | `requirements.rqUnit` | ↳ Unit | Dropdown | optional | _dynamic list_ |
| 5.5 | `requirements.rqCost` | ↳ Cost per unit | Number | required |  |
| 5.6 | `requirements.rqNote` | ↳ Purpose / notes | Short text | optional, max 500 chars |  |
| 6 | `milestones` | Key milestones for the next 12 months | Repeating table | required, up to 5 rows |  |
| 6.1 | `milestones.milestone` | ↳ Milestone | Short text | required, max 150 chars |  |
| 6.2 | `milestones.month` | ↳ Target month | Dropdown | required | 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 11 · 12 |
| 7 | `otherSupport` | Have you received or applied for support from another organisation? | Dropdown | required | Yes · No |
| 8 | `organisations` | Other support | Repeating table | required, conditional, up to 20 rows |  |
| 8.1 | `organisations.organisation` | ↳ Organisation | Short text | required |  |
| 8.2 | `organisations.month` | ↳ Month / year | Month/year | required |  |
| 8.3 | `organisations.type` | ↳ Type | Dropdown | required | Financial · Mentorship · Consulting · Other |
| 8.4 | `organisations.typeOther` | ↳ Specify type | List of entries (+ add) | required, conditional |  |
| 8.5 | `organisations.amount` | ↳ Amount (optional) | Number | optional |  |
| 8.6 | `organisations.currency` | ↳ Currency, if amount entered | Dropdown | optional | USD · IQD |

### Step 9 — Applicant Statement & References
_In your own words: why you, why now, and why KII._

| # | Key | Question | Type | Rules | Choices |
|---|---|---|---|---|---|
| 1 | `video` | Video statement | File upload | required, mp4, ≤200 MB, up to 1 file(s), ≤60 s video |  |
| 2 | `appliedBefore` | Have you applied to or joined KII before? | Dropdown | required | Yes · No |
| 3 | `beforeDetail` | When and which program? | Short text | required, conditional, max 1000 chars |  |
| 4 | `heardFrom` | How did you hear about KII? | Dropdown | required | Social media · Website or online search · Word of mouth · KII event or workshop · Local media (TV, radio, newspaper) · Educational institution · Other |
| 5 | `heardOther` | Specify how you heard about KII | List of entries (+ add) | required, conditional |  |
| 6 | `references` | Recommenders (optional) | Repeating table | optional, up to 20 rows |  |
| 6.1 | `references.name` | ↳ Full name | Short text | required |  |
| 6.2 | `references.email` | ↳ Email | Email | required |  |
| 6.3 | `references.description` | ↳ Relationship / recommendation description | Paragraph | optional, max 1000 chars |  |
| 6.4 | `references.letter` | ↳ Recommendation letter (optional) | File upload | optional, pdf, ≤20 MB, up to 1 file(s) |  |
| 7 | `anythingElse` | Anything else you'd like us to know? | Paragraph | optional, max 1000 chars |  |
| 8 | `additional` | Additional document (optional) | File upload | optional, pdf/doc/docx/ppt/pptx, ≤20 MB, up to 1 file(s) |  |

### Step 10 — Review & Submit
Full report preview of steps 1–9, completeness per section, declaration of accuracy (required), submit, PDF export after submission.

**Conditional logic summary (key rules)**

- `devArea` appears after `agreeApp` is ticked; `*Other` specify lists appear whenever the matching choice is "Other" (multiple entries allowed).
- `city` label/options: Iraq → "Province / Main city" with all governorate capitals (Kurdistan first); `town` appears only for Erbil, Sulaimani, Kirkuk, Halabja, Duhok and includes the city centre.
- `education` (table) when `educationType` = Higher Education; `hsSchool`/`schoolCertificate` when High School or lower. Education city = governorate list; institution list = all institutions in that governorate's towns; End year hidden when "Until present" is ticked.
- `subSector` depends on `sector`; `implementedWhere` when `implemented` = Yes.
- Prototype fields (`testResults`, `builtBy`, photos, demo) appear when a prototype exists; photos required at working-prototype stage or later.
- `regulatoryDetail` when `regulatory` = Yes; `businessDetail` when business potential is Yes/Maybe.
- `facilities` when "Engineering Workshop Access" is selected; `reqCurrency` + `requirements` when "Financial support" is selected; `organisations` when `otherSupport` = Yes.
- `beforeDetail` when `appliedBefore` = Yes.

# APPENDIX B: Workflow stages, owners and checklists (defaults)

| Stage | Owner role | Applicant-facing explanation | Default checklist |
|---|---|---|---|
| Submitted Form | Application & Administration Manager | Your application has been received and is awaiting review. | Application received · Documents complete · Scope check done |
| Under Evaluation | Technical Manager | Your application is being reviewed and scored. | Experts assigned (no conflict of interest) · At least 2 evaluations submitted · Scores reviewed |
| Approval | CEO | Your application is awaiting the final approval decision. | Decision made · Applicant notified |
| Pitch Deck | Application & Administration Manager | You have been invited to pitch your project. | Pitch scheduled · Pitch held · Panel feedback recorded |
| Market Validation | Business Developer | KII is helping validate your market and business potential. | Market analysis completed · Customer validation done · Business model confirmed |
| Prototype Development | Technical Manager | Build and test your prototype. | Prototype plan agreed · Milestones set · Prototype delivered & tested |
| Investor / Stakeholder | CEO | You are being connected with investors and stakeholders. | Investment readiness assessed · Investor introductions made · Final report archived |

Outcomes: **Successful · Supported · Rejected · Withdrawn**. In-scope sectors for auto-categorisation: Agriculture, Energy, Renewable Energy, Water, Health, Education, Automation, Fashion, Technology, Computer and AI, Health Tech, Education Tech.

# APPENDIX C: Location rules

- Country list: all countries; default **Iraq**.
- Iraq → **Province / Main city**: Erbil, Duhok, Sulaimani, Halabja, Kirkuk (Kurdistan Region first), then Baghdad, Mosul, Basra, Najaf, Karbala, Hillah, Nasiriyah, Amarah, Kut, Diwaniyah, Samawah, Baqubah, Ramadi, Fallujah, Tikrit, Other → specify.
- **Town / district** only for the five Kurdistan provinces, and always including the city centre:
  - Erbil: Koya, Soran, Shaqlawa, Rawanduz, Choman, Ainkawa, Makhmur, Qushtapa, Harir, Khalifan, Kalak, Diana, Pirmam, Bahirka, Mergasur
  - Sulaimani: Ranya, Darbandikhan, Kalar, Chamchamal, Dukan, Kifri, Penjwen, Qaladiza, Chwarta, Sharbazher, Qaradagh, Said Sadiq, Bazyan, Sharazur
  - Duhok: Zakho, Akre, Amedi, Semel, Shekhan, Bardarash, Batifa, Zawita, Kani Masi, Mangesh, Darkar, Sarsang
  - Kirkuk: Hawija, Daquq, Tuz Khurmatu, Dibis, Laylan, Altun Kupri, Taza, Shwan
  - Halabja: Byara, Khurmal, Tawella, Sirwan, Anab, Bemo
- Education: city = governorate; institutions = all universities and institutes in that governorate (e.g. Erbil includes Salahaddin, Koya, Soran, Cihan, Hawler Medical …), with Other → typed name.
- Postal code auto-fills from town, then province; remains editable.
- Old records with a town saved as city migrate to province + town.

# APPENDIX D: Message templates (defaults; editable, per language)

Application received · Additional information required · Meeting invitation · Rejected · Task reminder · Follow-up reminder · Shortlisted for interview · Accepted for support · Revision requested · Project closure. Variables: `{applicant}`, `{project}`, plus `{id}`, `{call}`, `{deadline}`, `{link}` in production.

---
*End of document.*
