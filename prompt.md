# PROMPT: Build the KII Innovation Application & Management System (A to Z)

> Copy this entire file into your AI assistant, or give it to your engineering team as the official brief.
> Everything below is an instruction.

---

## 1. Your role

You are a world-class product engineering team: principal architect, security engineer, backend and frontend leads, UX/UI designer, QA lead, DevOps/SRE and data-protection specialist. You have built many competitive **application, evaluation and research-funding platforms** of the kind used by research institutes, innovation agencies, universities and accelerators. You know these platforms in depth:

- multi-stage calls;
- expert and peer review, blind review and conflict-of-interest management;
- rubric scoring and committee decisions;
- post-award milestones and reporting.

You write secure, clean, tested, documented, maintainable code. You never cut corners on security, privacy or data integrity.

## 2. Your mission

Design, build, test, secure, document and deploy the **KII Innovation Application & Management System** for the **Kurdistan Innovation Institute (KII)**, Erbil, Kurdistan Region of Iraq. It is a production-grade, multi-user, multilingual web platform with two parts:

1. **Applicant Portal:** innovators register, submit innovation programme applications, upload documents, communicate with KII, track progress, complete tasks and submit milestone reports.
2. **Application Management System (AMS):** KII staff screen, evaluate, decide, manage workflow, tasks, meetings, finances, procurement and KPIs, and report on the programme.

A working browser-only prototype exists. It defines the expected **features, user experience, rules and questions**. Keep **every** capability it has, and make the system **much better, stronger, more secure and fully professional**:

- a real backend and database;
- server-side security;
- real email;
- server-rendered official PDFs;
- multilingual support;
- a versioned Form Builder;
- monitoring and backups.

## 3. Non-negotiable outcomes

1. **Default form = current questions.** The system ships with the exact current application form (Appendix A: 10 steps, every question, choice, condition and validation rule) loaded as *Form version 1*.
2. **Master Admin Form Builder.** The Master Admin (and staff granted `manage_form`) can **edit, add, remove, hide, reorder and duplicate** questions and steps. Changes are drafted, previewed, published as immutable versions and fully audited. Submitted applications never change.
3. **Smooth operation.** Fast, reliable and autosaving. A failed upload never loses typed answers. It works well on mid-range Android phones over 4G.
4. **Professional overview, report and PDF.** One shared report design for the applicant's Review & Submit page, the staff application view and an official server-generated PDF (spec in §7).
5. **Secure and private by design.** OWASP ASVS Level 2, staff MFA, encryption, server-enforced permissions, blind review enforced by the API, and a tamper-evident audit log.
6. **Three languages:** English, Kurdish (Sorani) and Arabic, with full right-to-left support.

## 4. Users, roles and permissions

All authorisation is enforced **on the server** (deny by default). Use RBAC with fine-grained permissions plus attribute rules.

| Role | Responsibilities | Default permissions |
|---|---|---|
| Applicant | Registers, applies, answers tasks, reports milestones | Own records only |
| Master Admin | Owns the system | Everything, including Form Builder, system settings and roles. A break-glass recovery procedure exists. |
| Application & Administration Manager | Runs calls and operations; gives and restricts other staff's permissions | Everything except system ownership. Form Builder only if granted. |
| CEO | Approvals and oversight | View applicants, financials and reports; decisions; meetings; tasks |
| Technical Manager | Leads technical evaluation and the prototype stage | View/edit applicants, evaluate, tasks, meetings, documents, reports |
| Technical Engineer | Technical assessment | View, evaluate, tasks, meetings, documents |
| Business Coordinator | Coordination | View, tasks, meetings, documents |
| Business Developer | Market validation | View, meetings, tasks, reports |
| Evaluator / Expert (internal/external) | Scores assigned applications | Assigned applications only, after a conflict-of-interest declaration; blind view when enabled |
| Workshop / Focal Point | Facility access, follow-up | Read-only project history |
| Auditor | Compliance | Read-only, including the audit log; no PII export |

Permissions: `view_applicants`, `edit_applicants`, `manage_tasks`, `manage_meetings`, `evaluate`, `manage_documents`, `view_financials`, `manage_financials`, `manage_procurement`, `make_decisions`, `view_reports`, `manage_staff`, `manage_form`, `manage_calls`, `manage_templates`, `export_data`, `view_pii`, `view_audit`.

Additional roles can be created in the UI. Every permission change is audited.

## 5. Applicant Portal requirements

### 5.1 Sign-up and account

- **Names:** first, second and third name, exactly as in the passport.
- **Date of birth:** soft, easy-to-scroll **Year / Month / Day** pickers. Do not use a hard native date input.
- **Phone:** country code, default **+964 (Iraq)**.
- **Email:** username plus a domain picker, **gmail.com** by default, with "other domain" allowed. The email is the sign-in ID.
- **Profile details:** organisation; **multiple website/social links** (a "+" button adds another); **country → province/main city → town/district** (rules in Appendix C); passport number.
- **Password:** strong (NIST 800-63B, checked against breached-password lists).
- **Consent:** versioned data-processing consent, stored with a timestamp.
- **Account security:** email verification (optional phone OTP), password reset by email, rate-limited login and progressive lockout.
- **Prefill:** profile data **auto-fills Personal Background** in every new application. The applicant edits per application without silently changing the profile.

### 5.2 Ideas and applications

- An account can hold multiple ideas, with **at most 3 active** (draft or in review). A slot is released when an application is finished/closed, delayed or closed by evaluators, rejected, or withdrawn by the applicant.
- Drafts can be **deleted**. Submitted applications can only be **withdrawn**, with a reason, and remain on record.
- **Application ID:** after accepting the terms, the applicant selects a **KII development area**: Human Being, Smart Cities, House Ware, Sustainable Energy, Health, Education, Transportation, IT, Fashion, Automation, or Other → specify. The **server atomically** assigns an immutable ID made of the area prefix plus a sequence (e.g. `EDU013` for the 13th Education applicant). It is visible to the applicant and to evaluators everywhere.
- Calls (cohorts) have open and close dates. After the deadline submission is blocked, unless staff grant an individual extension.

### 5.3 Filling the form

- Render the published form version: 10 steps (Appendix A), a sidebar with step status, a progress bar and "N missing" per step.
- Autosave plus **Save & Exit**. Errors are shown inline per field. Upload errors never discard typed answers.
- **Conditional questions.**
- **"Other" handling:** every "Other" choice opens a specify box, and the applicant can add **more than one** entry (+ add).
- Searchable lists, and **selection-based team roles** (Founder, Co-Founder, CEO, COO, CTO, Other → specify, with multiple entries).
- **Repeating tables:** education, team members, courses, financial requests, milestones, other support and recommenders.
- **Financial request:**
  - **one currency for the whole request (USD or IQD)**, chosen above the table;
  - rows: Item, Type, Qty, Unit (depends on type), Cost per unit, Purpose/notes;
  - live total in that currency;
  - no currency column per row.
- **Uploads:** resumable, with a progress bar, file-type sniffing, size/count limits and video-duration limits (statement video ≤ 60 s, prototype demo ≤ 180 s). Antivirus scanning runs before staff can open a file.

### 5.4 Review & Submit

- Show the full professional report (§7) with completeness chips per section, Edit links, and a declaration of accuracy. Submit is enabled only when everything is valid and the declaration is ticked.
- **On submit:**
  - freeze the answers against the form version;
  - generate and store the official PDF immutably, with a SHA-256 hash;
  - send a confirmation email;
  - lock the application (read-only).

### 5.5 After submission

- **Status and history:** a status timeline with plain-language stage explanations, plus a **Download PDF** button for every submitted version.
- **Communication:** tasks (responses can be text, files, images or video), messaging with staff, milestone reports, and notifications (in-app and email).
- **Revisions:** a staff revision request reopens only the sections staff unlock. Resubmission creates version n+1. Staff can compare versions.

## 6. Staff AMS requirements

### 6.1 Operations

- **Dashboard:** KPIs by stage, sector, development area, governorate, gender and age; SLA breaches; inactive applicants; an action queue; alerts.
- **Applicants list:** typo-tolerant search (e.g. "abdlqhar" finds "Abdulqahar"), filters, saved views, bulk actions, and permission-gated exports with PII masked unless the user has `view_pii`.
- **Applicant record tabs:** Overview, Application (report view), Documents, Evaluations, Decisions, Tasks, Meetings, Messages, Milestones & Tranches, KPIs, Financials, Procurement, and Activity/Audit.
- **Workflow:** stages, owners and checklists are configurable per call (defaults in Appendix B). Stage owners are notified. SLA timers run per stage. Outcomes: Successful, Supported, Rejected, Withdrawn.
- **Finance and procurement:** meetings, tasks, procurement requests, approved support, tranches, spend vs approved, single-currency requests, and an optional exchange-rate snapshot for reports.
- **Message templates:** editable, multilingual, with variables (Appendix D).

### 6.2 Evaluation

1. Screening and eligibility checklist.
2. Expert assignment, manual or load-balanced.
3. **Conflict-of-interest declaration** required before an expert can open an application.
4. **Blind review** per call: the API strips identity fields and files flagged `pii`, including name, CV, photo, video and references.
5. Rubric scoring: weighted criteria, mandatory comments below a threshold, and scores hidden from other evaluators until each has submitted.
6. Aggregation (mean, trimmed mean) with alerts when evaluators disagree widely, for calibration.
7. Committee decision with minutes and vote record.
8. Full audit of who viewed or changed what, and when.

### 6.3 Form Builder (core module)

1. **Default content:** ships with Appendix A as Form v1. Every question and step is editable.
2. **What can be changed:**
   - wording, help text, placeholder;
   - required/optional;
   - validation (length, number range, pattern, file types/size/count, video duration);
   - choices (add, remove, rename, reorder, with stable value IDs);
   - conditional logic (show/require when question X meets a condition, with AND/OR);
   - position (drag and drop within and across steps).
3. **Actions:** add, duplicate, hide or show, and delete questions and steps.
4. **Question types:**
   - text: short text, paragraph, list of entries (+ add);
   - numbers and money: number, currency amount;
   - dates: date, date of birth (Y/M/D pickers);
   - contact: email, phone with country code, URL;
   - choices: dropdown, searchable list (including the location and university datasets), checkboxes with an optional maximum, yes/no, tick box;
   - files: file upload, video upload;
   - structure: repeating table with its own sub-questions, section heading/info text, declaration.
5. **Flags per question:** `pii` (hidden in blind review), `scored` (linked to rubric criteria), `reportable` (used in analytics), `translatable`.
6. **Versioning:**
   - Edits happen in a **draft**, with **Preview** (exact applicant view on desktop and mobile).
   - **Publish** creates an immutable version.
   - Each application records its form version.
   - Drafts migrate to new versions safely. Answers to removed questions are kept but no longer required.
   - **Submitted applications never change.**
7. **Safety:**
   - **Core questions** that system logic depends on can be reworded but **not deleted**. These are the identity names, email, phone, country/city, terms, development area, title, sector/sub-sector, support types, currency and the financial request.
   - Deleting a question that already has answers archives it instead of destroying data, after a typed confirmation.
   - Every change is audited with before/after values.
8. **Translations:** EN/KU/AR text per question. Publishing warns when translations are missing.
9. **Import/export:** form definitions as JSON, for copying between calls and for backup.

Store form definitions like this:

```json
{
  "formId": "kii-innovation", "version": 7, "status": "published",
  "steps": [{ "id": "innovation", "title": { "en": "Project Information", "ku": "…", "ar": "…" },
    "questions": [
      { "id": "title", "type": "text", "core": true, "required": true,
        "label": { "en": "Innovation title" }, "validation": { "maxLength": 100 } },
      { "id": "cq_launch_year", "type": "select", "required": true,
        "label": { "en": "What is your expected launch year?" },
        "choices": [{ "value": "y2026", "label": { "en": "2026" } }, { "value": "y2027", "label": { "en": "2027" } }],
        "visibleWhen": { "all": [{ "q": "implemented", "op": "eq", "value": "No" }] },
        "flags": { "pii": false, "scored": false, "reportable": true } }
    ] }]
}
```

## 7. Overview, report and PDF: professional specification

Use **one template** for three outputs: the applicant Review & Submit page, the staff application view, and the **server-rendered official PDF**.

### Structure

1. **Cover band:** KII colour logo, programme and call name, title "Application Summary Report", application ID, status pill, QR verification code.
2. **Meta grid:** Applicant (hidden in blind mode), Sector, Development area, Application ID, Started, Submitted (with version).
3. **Contents:** numbered PART list, with completeness markers on screen and page numbers in the PDF.
4. **PART sections:** a numbered heading with a rule under it, then a two-column answer table. The question sits in a shaded ~25–30% column and the answer fills the rest. Unanswered questions show "Not provided" in muted italics.
5. **Repeating answers** become **full-width sub-tables** with a caption and row count:
   - Use **short column headers** (e.g. Degree · Country · City · University · Field · Start · End).
   - **Merge related fields.** "Until present" and "End year" become **one End column** showing the year or "Present".
   - **File fields are never table columns.** List them **under the table**, e.g. "Row 1 · Certificates: degree.pdf (0.11 MB)".
   - Use proportional column widths. Long unbroken text wraps.
   - Header rows repeat on each PDF page, and rows never split across pages.
   - Money is right-aligned, with the currency and a total row.
6. **Attachments:** badge, file name, size, and duration for video. The PDF includes an attachments index with file hashes.
7. **Declaration box:** the declaration text and timestamp. The staff view also shows device and IP.
8. **Footer on every page:** "Kurdistan Innovation Institute · Innovation Program · {ID} · {title} · Page x of y · generated {date}". An optional CONFIDENTIAL watermark.

### PDF engineering

- Generate on the server (headless Chromium or an equivalent typesetting engine). Never rely on the user's print dialog.
- A4 size. Portrait for question-and-answer pages; pages with wide tables switch to **landscape** automatically.
- Embed fonts covering Latin, Kurdish (Sorani) and Arabic, with correct RTL shaping. Produce PDF/A-2b.
- Name files `KII_{ID}_v{n}_{yyyy-mm-dd}.pdf`. Store them on WORM/object-lock storage with the SHA-256 recorded. A public verification page confirms the ID, version and hash.
- Produce separate blind-review PDFs (no PII) for experts. Bulk "committee pack" export runs as a background job.
- Generation p95 below 5 seconds.
- **Programme reports:**
  - pipeline by stage, sector and governorate; gender and age; evaluation score distributions and evaluator agreement;
  - time in stage and SLA; requested vs approved vs spent; KPI progress;
  - export to PDF, XLSX and CSV, with charts that have accessible data tables.

## 8. Architecture (recommended; justify any alternative)

- **Frontend:** TypeScript, React + Next.js (or SvelteKit), an auto-escaping component library, ICU i18n with RTL, and a PWA with offline draft caching.
- **Backend:** TypeScript NestJS or Python Django, as a modular monolith: Identity, Calls & Forms, Applications, Files, Evaluation, Workflow, Post-award, Messaging, Reporting, Audit. Publish an OpenAPI contract.
- **Database:** PostgreSQL 16+. Relational core, with JSONB for form definitions and answers. Row-level security as defence in depth.
- **Files:** S3-compatible object storage, signed URLs, ClamAV scanning, object lock for submitted PDFs.
- **Identity:** OpenID Connect (e.g. Keycloak). **Staff MFA is mandatory** (TOTP/WebAuthn).
- **Background jobs:** a queue (BullMQ or Celery) for PDFs, emails, scans, exports and reminders.
- **Email:** a transactional provider with SPF/DKIM/DMARC. Optional SMS/WhatsApp.
- **Operations:** OpenTelemetry, structured logs, metrics, alerts, uptime checks and error tracking. Docker, Terraform, CI/CD and blue/green deploys, with a staging environment that mirrors production.
- **Core entities:** User, ApplicantProfile, StaffProfile, Role, Permission, RoleAssignment, Call, FormDefinition (versioned), Application, ApplicationVersion (frozen answers + form version + PDF + hash), Answer, FileObject, Stage, StageTransition, Checklist, Assignment, ConflictDeclaration, Rubric, Evaluation, Decision, Task, TaskResponse, Meeting, Message, Notification, Milestone, Tranche, KPI, FinancialRequest, ProcurementRequest, Template, AuditEvent (append-only, hash-chained), ConsentRecord, DataRequest.

## 9. Security, privacy and quality targets

### Security

- OWASP ASVS L2, with an independent penetration test before go-live.
- TLS 1.2+, HSTS, strict CSP, secure HttpOnly/SameSite cookies, CSRF protection, rate limiting, bot protection.
- Argon2id password hashing. Idle timeout 30–60 min, and a 12 h absolute timeout for staff.
- Encryption at rest. **Field-level encryption** for passport number and date of birth, with KMS-managed keys.
- Authorisation tests for every role and action (who can and who cannot).
- No seeded or default passwords in production.

### Privacy

- Versioned consent, data minimisation, a retention schedule, data export/deletion on request, a privacy notice in EN/KU/AR, and a DPIA before launch.
- Data residency acceptable to KII/KRG.

### Resilience and performance

- Backups: RPO ≤ 15 min, RTO ≤ 4 h, restore tested quarterly.
- Performance: API p95 < 300 ms; first load < 2.5 s on 4G; scale to 20,000 applicants per call and 500 concurrent users at the deadline; 99.5% availability.

### Accessibility and code quality

- WCAG 2.2 AA. Support the last 2 versions of Chrome, Edge, Firefox and Safari, Android 9+ and iOS 15+.
- Strict typing, linting, ≥ 80% unit coverage on domain logic, and ADRs for key decisions.

## 10. Migration from the prototype

1. Build an export of the prototype's browser data as one JSON bundle: users, applications (all versions), staff, AMS records, Form Builder configuration, and files.
2. Import it into the new system using the stable question keys in Appendix A. Users reset their passwords.
3. Verify counts and checksums.
4. Convert legacy (v1) submissions once, then retire the old renderer.

## 11. How you must work and what you must deliver

1. **First, reply with a Discovery pack:**
   - open questions for KII;
   - assumptions;
   - an architecture diagram and ADRs;
   - the data model;
   - the API outline;
   - UX wireframes for the applicant form, Review & Submit, PDF, AMS dashboard, evaluation screen and Form Builder;
   - a risk register;
   - a phased plan with estimates.
2. **Then deliver in phases**, each ending in a working, tested, deployed increment on staging:
   1. Foundation: identity, roles, audit, files, CI/CD.
   2. Applicant portal, form engine with Appendix A as Form v1, Form Builder, server PDF.
   3. AMS operations and evaluation: workflow, assignments, conflict of interest, blind review, rubrics, decisions, templates, notifications.
   4. Post-award and reporting.
   5. Hardening and launch: penetration test, load test at 2× peak, accessibility audit, restore drill, training.
3. **Definition of done for every feature:**
   - code reviewed and typed;
   - unit, integration and end-to-end tests, including authorisation tests;
   - accessible, with translated strings and audit events;
   - documentation updated;
   - accepted by the KII product owner.
4. **Testing:**
   - a contract test suite generated from Appendix A (every question, condition and validation);
   - Playwright journeys for every role;
   - visual regression for the report and PDF (portrait and landscape, long text, RTL);
   - k6 load tests; SAST, DAST and dependency scanning.
5. **Final deliverables:**
   - source code in KII's Git organisation, infrastructure as code, OpenAPI docs;
   - admin and user manuals in EN/KU/AR;
   - runbooks (deploy, backup/restore, incidents, key rotation);
   - data-protection documentation, role-based training, and 3 months of hypercare.
6. **Ask, don't guess.** When a requirement is ambiguous, state your assumption explicitly, choose the safer and more privacy-preserving option, and list it for KII confirmation.

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
*End of prompt.*
