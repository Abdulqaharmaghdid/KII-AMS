/* ===== Procurement: Purchase Request -> Review -> 3 Quotations (RFQ) -> PR approval or Purchase Order -> Delivery -> Reception & Control =====
   Loaded before admin.js; everything here runs at call time, so it can use admin.js helpers (staff, can, escA, nav, route …). */

const PRX = {
  TYPES: ["Product", "Services", "Equipment", "Technical Support", "Other"],
  UOM: ["pcs", "set", "box", "pack", "kg", "m", "L", "hour", "day", "month", "service", "lot"],
  INCOTERMS: ["N/A — local purchase", "EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FOB", "CIF"],
  /* a Purchase Order is required above these totals */
  LIMIT: { USD: 100, IQD: 150000 },
  MIN_QUOTES: 3,
  STATUS: {
    review: ["Procurement review", "chip-open"], returned: ["Returned to requester", "chip-overdue"],
    quotes: ["Collecting quotations", "chip-prog"], pr_sign: ["Awaiting PR signatures", "chip-pending"],
    po_prep: ["PO in preparation", "chip-prog"], po_sign: ["Awaiting PO signatures", "chip-pending"],
    purchase: ["Approved — purchasing", "chip-approved"], delivered: ["Delivered — awaiting reception", "chip-open"],
    completed: ["Completed", "chip-done"], rejected: ["Rejected", "chip-rejected"], cancelled: ["Cancelled", "chip-inactive"],
  },
  SIGNERS: { admin_manager: "Administration & Application Manager", finance_manager: "Finance Manager", ceo: "CEO", supplier: "Supplier" },
  CHAIN_PR: ["admin_manager", "finance_manager", "ceo"],
  CHAIN_PO: ["admin_manager", "finance_manager", "ceo", "supplier"],
  STEPS: ["Request", "Review", "Quotations", "Approval", "Purchase & Delivery", "Reception"],
  STEP_OF: { review: 1, returned: 1, quotes: 2, pr_sign: 3, po_prep: 3, po_sign: 3, purchase: 4, delivered: 5, completed: 6 },
  TERMS: "1. Goods/services must match the specification of the accepted quotation.\n2. Delivery to the ship-to address by the expected delivery date.\n3. Payment is made after delivery, inspection and acceptance by KII.\n4. KII may reject items that are damaged, incomplete or not as specified.",
};

/* ---------- helpers ---------- */
const prNum = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const prMoney = (n, cur) => `${(Math.round(prNum(n) * 100) / 100).toLocaleString()} ${cur || "USD"}`;
const prToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const prChip = pr => { const s = PRX.STATUS[pr.status] || [pr.status, "chip-stage"]; return `<span class="chip ${s[1]}">${escA(s[0])}</span>`; };
const prIsProc = () => can("manage_procurement");
const prIsRequester = pr => pr.requester?.id === staff.id;
const prEstTotal = pr => (pr.items || []).reduce((s, i) => s + prNum(i.qty) * prNum(i.unitCost), 0);
const prAccepted = pr => (pr.quotes || []).find(q => q.status === "Accepted") || null;
const prQuoteTotal = q => (q.lines || []).reduce((s, l) => s + prNum(l.qty) * prNum(l.unitPrice) + prNum(l.fee) - prNum(l.discount), 0);
const prNeedsPo = (total, cur) => total > (PRX.LIMIT[cur] ?? PRX.LIMIT.USD);
const prLimitText = cur => prMoney(PRX.LIMIT[cur] ?? PRX.LIMIT.USD, cur);
const prSummary = pr => (pr.items || []).map(i => i.desc).filter(Boolean).join(", ") || "—";
const prTypeLabel = pr => pr.type === "Other" && pr.typeOther ? `Other — ${pr.typeOther}` : pr.type;
const prProject = pr => pr.appId ? (pr.projectName || "Applicant project") : `Internal — ${pr.department || "KII"}`;

/* final purchase lines: the accepted quotation when there is one, otherwise the requester's estimate */
function prLines(pr) {
  const q = prAccepted(pr);
  if (q) return q.lines.map(l => ({ desc: l.desc, spec: l.spec || "", uom: l.uom, qty: prNum(l.qty), unitPrice: prNum(l.unitPrice), note: l.note || "" }));
  return (pr.items || []).map(i => ({ desc: i.desc, spec: "", uom: i.uom, qty: prNum(i.qty), unitPrice: prNum(i.unitCost), note: i.note || "" }));
}
function prPoTotals(pr) {
  const sub = prLines(pr).reduce((s, l) => s + l.qty * l.unitPrice, 0), po = pr.po || {};
  const tax = prNum(po.tax), fee = prNum(po.deliveryFee), disc = prNum(po.discount);
  return { sub, tax, fee, disc, total: sub + tax + fee - disc };
}
const prTotal = pr => pr.po ? prPoTotals(pr).total : prAccepted(pr) ? prQuoteTotal(prAccepted(pr)) : prEstTotal(pr);

function prCanSee(pr) {
  return prIsRequester(pr) || prIsProc() || can("view_financials") ||
    ["admin_manager", "finance_manager", "ceo", "master_admin"].includes(staff.role);
}
function prNextSigner(pr) {
  if (pr.status === "pr_sign") return PRX.CHAIN_PR.find(r => !pr.sigs?.[r]) || null;
  if (pr.status === "po_sign") return PRX.CHAIN_PO.find(r => !pr.po?.sigs?.[r]) || null;
  return null;
}
const prCanSignAs = role => role === "supplier" ? prIsProc() : staff.role === role || staff.role === "master_admin";
/* does this request wait for the signed-in person? */
function prMine(pr) {
  switch (pr.status) {
    case "review": case "quotes": case "po_prep": case "purchase": return prIsProc();
    case "returned": case "delivered": return prIsRequester(pr);
    case "pr_sign": case "po_sign": { const r = prNextSigner(pr); return !!r && prCanSignAs(r); }
    default: return false;
  }
}
function prWaiting(pr) {
  const r = prNextSigner(pr);
  return {
    review: "Procurement Coordinator — review the request",
    returned: `${pr.requester?.name} — revise and resubmit`,
    quotes: `Procurement Coordinator — collect ${PRX.MIN_QUOTES} quotations with evidence`,
    pr_sign: `${PRX.SIGNERS[r] || ""} — signature on the PR`,
    po_prep: "Procurement Coordinator — prepare the Purchase Order",
    po_sign: r === "supplier" ? "Procurement Coordinator — record the supplier's signature" : `${PRX.SIGNERS[r] || ""} — signature on the PO`,
    purchase: "Procurement Coordinator — purchase and hand over to the requester",
    delivered: `${pr.requester?.name} — Reception & Control form`,
  }[pr.status] || "";
}
function prNextNo(prefix, pick) {
  const y = new Date().getFullYear(), re = new RegExp(`^KII-${prefix}-${y}-(\\d+)`);
  const max = amsGetPrs().reduce((m, p) => { const x = String(pick(p) || "").match(re); return x ? Math.max(m, +x[1]) : m; }, 0);
  return `KII-${prefix}-${y}-${String(max + 1).padStart(4, "0")}`;
}
const prLink = pr => `admin.html?v=pr&id=${encodeURIComponent(pr.id)}`;
function prNotifyProc(text, pr) {
  amsGetStaff().filter(s => s.active && s.id !== staff.id && amsCan(s, "manage_procurement")).forEach(s => amsNotify(s.id, text, prLink(pr)));
}
function prNotifyRole(role, text, pr) {
  amsGetStaff().filter(s => s.active && s.id !== staff.id && s.role === role).forEach(s => amsNotify(s.id, text, prLink(pr)));
}
function prNotifyRequester(text, pr) { if (pr.requester?.id && pr.requester.id !== staff.id) amsNotify(pr.requester.id, text, prLink(pr)); }
function prSign(role) {
  return { name: staff.name, title: staff.title || ROLES[staff.role]?.label || staff.role, staffId: staff.id,
    at: new Date().toISOString(), onBehalf: role && staff.role !== role ? PRX.SIGNERS[role] : "" };
}
async function prUpload(input, folder) {
  const out = [];
  for (const fl of (input?.files || [])) {
    const fid = `${folder}/${amsUid("f")}_${fl.name}`;
    try { if (await KII.saveFile(fid, fl)) out.push({ fileId: fid, name: fl.name, size: fl.size }); } catch { }
  }
  return out;
}
const prFiles = files => (files || []).map(f => `<a href="#" class="view-upload md-file" data-fid="${escA(f.fileId)}" data-name="${escA(f.name)}">📎 ${escA(f.name)}</a>`).join(" ") || '<span class="sub2">—</span>';

/* project-linked requests are mirrored into the applicant record, so the financial page, reports and dossiers stay in step */
function prMirror(pr, activity) {
  if (!pr.appId) return;
  const apps = amsGetApplicants(), a = apps.find(x => x.id === pr.appId);
  if (!a) return;
  const status = { purchase: "Approved", delivered: "Approved", completed: "Paid", rejected: "Rejected", cancelled: "Rejected" }[pr.status] || "Pending";
  const ceo = pr.po?.sigs?.ceo || pr.sigs?.ceo;
  const row = { id: pr.no, v2: pr.id, poId: pr.po?.no || "", title: prSummary(pr), vendor: prAccepted(pr)?.supplier || "",
    category: prTypeLabel(pr), description: pr.note || "", amount: prTotal(pr), currency: pr.currency, status, date: pr.createdAt,
    requestedBy: pr.requester?.name || "", approvedBy: ceo?.name || "", approvedAt: ceo?.at || "",
    paidAt: pr.receipt?.at || "", paidBy: pr.receipt ? pr.delivery?.by || "" : "" };
  a.procurement = a.procurement || [];
  const i = a.procurement.findIndex(p => p.v2 === pr.id);
  if (i >= 0) a.procurement[i] = row; else a.procurement.push(row);
  if (activity) touch(a, { icon: "pr", ...activity });
  syncFin(a);
  amsSaveApplicants(apps);
}
function prSave(pr, logText, activity) {
  (pr.log = pr.log || []).unshift({ at: new Date().toISOString(), by: staff.name, text: logText });
  amsSavePr(pr);
  prMirror(pr, activity);
  amsAudit(staff.name, "Procurement", `${pr.no}: ${logText}`);
}

/* ============ VIEW: PROCUREMENT (register) ============ */
function viewProcurement(el) {
  if (P.get("new")) return prRenderForm(el, null);
  const all = amsGetPrs().filter(prCanSee).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const closed = p => ["completed", "rejected", "cancelled"].includes(p.status);
  const sets = {
    action: all.filter(prMine), mine: all.filter(prIsRequester), open: all.filter(p => !closed(p)),
    done: all.filter(closed), all,
  };
  const f = sets[P.get("f")] ? P.get("f") : sets.action.length ? "action" : "all";
  const labels = { action: "Needs my action", mine: "My requests", open: "In progress", done: "Closed", all: "All" };
  const committed = all.filter(p => ["purchase", "delivered"].includes(p.status));
  const sumBy = list => Object.entries(list.reduce((m, p) => (m[p.currency] = (m[p.currency] || 0) + prTotal(p), m), {}))
    .map(([c, n]) => prMoney(n, c)).join(" + ") || "0";
  const legacy = (prIsProc() || can("view_financials")) ? amsGetApplicants().flatMap(a => (a.procurement || []).filter(p => !p.v2)
    .map(p => ({ ...p, appId: a.id, appName: a.name, cur: supportCurrency(a) }))) : [];

  el.innerHTML = `<div class="prx">
    <div class="page-head-row">
      <div><div class="page-title">Procurement</div>
      <div class="page-sub">Purchase requests, quotations, purchase orders and reception — from request to delivery</div></div>
      <a class="abtn sm" href="?v=procurement&new=1">${IC.plus} New Purchase Request</a>
    </div>
    <div class="stat-grid" style="grid-template-columns:repeat(4,1fr)">
      ${statCard("#b45309", "#fef3c7", IC.alertc, sets.action.length, "Needs My Action")}
      ${statCard("#2563eb", "#dbeafe", IC.box, sets.open.length, "In Progress")}
      ${statCard("#15803d", "#d1fae5", IC.shield, all.filter(p => p.status === "completed").length, "Completed")}
      ${statCard("#0f766e", "#ccfbf1", IC.money, sumBy(committed), "Approved, Not Yet Received")}
    </div>
    <div class="ams-card">
      <div class="filter-chips">
        ${Object.keys(sets).map(k => `<button class="${k === f ? "on" : ""}" data-go="?v=procurement&f=${k}">${labels[k]} (${sets[k].length})</button>`).join("")}
      </div>
      <table class="tbl"><thead><tr>
        <th>PR #</th><th>Requester</th><th>Applicant / Project</th><th>Type</th><th>Items</th><th>Total</th><th>Stage</th><th>Waiting for</th><th>Date</th>
      </tr></thead><tbody>
      ${sets[f].map(p => `<tr class="clickable" data-go="?v=pr&id=${encodeURIComponent(p.id)}">
        <td><b>${escA(p.no)}</b>${p.po?.no ? `<div class="sub2">${escA(p.po.no)}</div>` : ""}</td>
        <td>${escA(p.requester?.name || "—")}<div class="sub2">${escA(p.department || "")}</div></td>
        <td>${escA(prProject(p))}</td><td>${escA(prTypeLabel(p))}</td>
        <td class="pr-ellip" title="${escA(prSummary(p))}">${escA(prSummary(p))}</td>
        <td style="white-space:nowrap"><b>${prMoney(prTotal(p), p.currency)}</b></td>
        <td>${prChip(p)}</td><td class="sub2">${prMine(p) ? '<b style="color:#b45309">You</b> — ' : ""}${escA(prWaiting(p).split(" — ")[prMine(p) ? 1 : 0] || "—")}</td>
        <td style="white-space:nowrap">${amsFmtDate(p.createdAt)}</td>
      </tr>`).join("") || `<tr><td colspan="9"><div class="empty-state">${f === "action" ? "Nothing is waiting for you." : "No purchase requests here yet."}</div></td></tr>`}
      </tbody></table>
    </div>
    <div class="ams-card pr-guide"><h3>How procurement works</h3>
      <ol>
        <li><b>Request</b> — any staff member submits a Purchase Request (PR) and signs it.</li>
        <li><b>Review</b> — the Procurement Coordinator checks it, and either proceeds or returns it with a comment.</li>
        <li><b>Quotations</b> — the coordinator records ${PRX.MIN_QUOTES} quotations (RFQ) with evidence and selects one.</li>
        <li><b>Approval</b> — up to ${prLimitText("USD")} / ${prLimitText("IQD")}: the PR is signed by the Administration &amp; Application Manager, Finance Manager and CEO.
          Above that: a Purchase Order (PO) is prepared and signed by the same three and the supplier.</li>
        <li><b>Purchase &amp; delivery</b> — the item is bought and handed to the requester.</li>
        <li><b>Reception</b> — the requester completes the Reception &amp; Control form, which closes the request.</li>
      </ol>
    </div>
    ${legacy.length ? `<div class="ams-card"><h3>Earlier applicant purchase requests <span class="sub2">(created before the new procedure)</span></h3>
      <table class="tbl"><thead><tr><th>PR #</th><th>Applicant</th><th>Title</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>
      ${legacy.map(p => `<tr class="clickable" data-go="?v=applicant&id=${encodeURIComponent(p.appId)}&tab=procurement">
        <td><b>${escA(p.id)}</b></td><td>${escA(p.appName)}</td><td>${escA(p.title)}</td>
        <td>${prMoney(p.amount, p.cur)}</td><td>${amsFmtDate(p.date)}</td><td>${chipStatus(p.status)}</td></tr>`).join("")}
      </tbody></table></div>` : ""}
  </div>`;
}

/* ============ PR form (new / revise a returned request) ============ */
function prRenderForm(el, pr) {
  const apps = amsGetApplicants();
  const preApp = pr ? pr.appId || "" : P.get("app") || "";
  const items = pr?.items?.length ? pr.items : [{ desc: "", qty: 1, uom: "pcs", unitCost: "", note: "" }];
  const row = it => `<tr class="pr-item">
    <td><input data-f="desc" required maxlength="200" value="${escA(it.desc || "")}" placeholder="Item or service description"></td>
    <td><input data-f="qty" type="number" min="0.01" step="any" required value="${escA(it.qty ?? 1)}"></td>
    <td><select data-f="uom">${PRX.UOM.map(u => `<option ${u === it.uom ? "selected" : ""}>${u}</option>`).join("")}</select></td>
    <td><input data-f="unitCost" type="number" min="0" step="any" required value="${escA(it.unitCost ?? "")}"></td>
    <td class="pr-lt">0</td>
    <td><input data-f="note" maxlength="200" value="${escA(it.note || "")}"></td>
    <td><button type="button" class="pr-x" data-rm title="Remove item">×</button></td></tr>`;
  const lastReturn = pr?.returns?.[0];

  el.innerHTML = `<div class="prx">
    <div class="page-head-row">
      <div><div class="page-title">${pr ? `Revise ${escA(pr.no)}` : "New Purchase Request"}</div>
      <div class="page-sub">${pr ? "Correct the request and resubmit it to procurement" : "The PR number and date are assigned when you submit"}</div></div>
      <a class="abtn ghost sm" href="${pr ? `?v=pr&id=${encodeURIComponent(pr.id)}` : "?v=procurement"}">← Back</a>
    </div>
    ${lastReturn ? `<div class="ams-card pr-alert"><b>Returned by ${escA(lastReturn.by)} on ${amsFmtDate(lastReturn.at)}:</b> ${escA(lastReturn.comment)}</div>` : ""}
    <form id="prReqForm">
      <div class="ams-card"><h3>1 · Request Information</h3>
        <div class="inline-form pr-plain"><div class="grid-2">
          <div><label>Request for *</label><select name="scope">
            <option value="internal" ${preApp ? "" : "selected"}>Internal — KII department</option>
            <option value="project" ${preApp ? "selected" : ""}>Applicant / project</option></select></div>
          <div id="prAppRow"><label>Applicant / project name *</label><select name="appId">
            ${apps.map(a => `<option value="${escA(a.id)}" ${a.id === preApp ? "selected" : ""}>${escA(a.name)} — ${escA(a.applicantName || "")}</option>`).join("") || '<option value="">No applicants yet</option>'}</select></div>
          <div><label>Requesting department *</label><input name="department" required maxlength="80" value="${escA(pr?.department || staff.department || "")}" placeholder="e.g. Technical, Business Development, Administration"></div>
          <div><label>Requester</label><input value="${escA(staff.name)} — ${escA(staff.title || ROLES[staff.role]?.label || "")}" disabled></div>
          <div><label>Contact person name *</label><input name="contactName" required maxlength="100" value="${escA(pr?.contact?.name || staff.name)}"></div>
          <div><label>Phone *</label><input name="contactPhone" required maxlength="40" value="${escA(pr?.contact?.phone || staff.phone || "")}" placeholder="+964 …"></div>
          <div><label>Email *</label><input name="contactEmail" type="email" required maxlength="120" value="${escA(pr?.contact?.email || staff.email || "")}"></div>
        </div></div>
      </div>
      <div class="ams-card"><h3>2 · Type of Request</h3>
        <div class="pr-types">
          ${PRX.TYPES.map((t, i) => `<label><input type="radio" name="type" value="${t}" ${(pr?.type || PRX.TYPES[0]) === t ? "checked" : ""} ${i ? "" : "required"}> ${t}</label>`).join("")}
          <input name="typeOther" maxlength="80" class="hidden" placeholder="Please specify" value="${escA(pr?.typeOther || "")}">
        </div>
      </div>
      <div class="ams-card"><h3>3 · Request Detail</h3>
        <div class="pr-cur"><label>Currency</label>
          <select name="currency"><option ${pr?.currency === "IQD" ? "" : "selected"}>USD</option><option ${pr?.currency === "IQD" ? "selected" : ""}>IQD</option></select>
          <span class="sub2" id="prCurNote"></span></div>
        <table class="tbl pr-edit"><thead><tr><th style="width:32%">Item / service description *</th><th style="width:9%">Quantity *</th><th style="width:10%">Unit</th>
          <th style="width:13%">Estimated unit cost *</th><th style="width:13%">Estimated total</th><th>Note</th><th style="width:34px"></th></tr></thead>
          <tbody id="prItems">${items.map(row).join("")}</tbody>
          <tfoot><tr><td colspan="4"><button type="button" class="abtn ghost sm" id="prAddItem">${IC.plus} Add item</button></td>
            <td colspan="3"><b id="prGrand">0</b><div class="sub2">Estimated total cost</div></td></tr></tfoot></table>
        <div class="pr-route" id="prRoute"></div>
        <div class="inline-form pr-plain"><label>Note / justification</label>
          <textarea name="note" rows="3" maxlength="1000" placeholder="Why is this needed? Any deadline or preferred specification?">${escA(pr?.note || "")}</textarea></div>
      </div>
      <div class="ams-card"><h3>4 · Requester E-Signature</h3>
        <label class="pr-consent"><input type="checkbox" name="agree" required>
          <span>I, <b>${escA(staff.name)}</b>, confirm this request is accurate and necessary, and I sign it electronically. My name, the date and the time are recorded on the PR.</span></label>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="abtn" type="submit">${pr ? "Sign &amp; Resubmit" : "Sign &amp; Submit Request"}</button>
          <a class="abtn ghost" href="${pr ? `?v=pr&id=${encodeURIComponent(pr.id)}` : "?v=procurement"}">Cancel</a>
        </div>
      </div>
    </form></div>`;

  const form = $ams("#prReqForm", el), body = $ams("#prItems", el);
  const cur = () => form.currency.value;
  const recalc = () => {
    let grand = 0;
    $$ams(".pr-item", body).forEach(r => {
      const t = prNum($ams('[data-f="qty"]', r).value) * prNum($ams('[data-f="unitCost"]', r).value);
      grand += t; $ams(".pr-lt", r).textContent = prMoney(t, cur());
    });
    $ams("#prGrand", el).textContent = prMoney(grand, cur());
    $ams("#prRoute", el).innerHTML = prNeedsPo(grand, cur())
      ? `Estimated total is above ${prLimitText(cur())} — a <b>Purchase Order</b> will be required, signed by the Administration &amp; Application Manager, Finance Manager, CEO and the supplier.`
      : `Estimated total is within ${prLimitText(cur())} — <b>no Purchase Order</b> is needed. The PR itself is signed by the Administration &amp; Application Manager, Finance Manager and CEO.`;
  };
  const syncScope = (fill) => {
    const proj = form.scope.value === "project", a = apps.find(x => x.id === form.appId.value);
    $ams("#prAppRow", el).classList.toggle("hidden", !proj);
    /* project purchases are booked against the applicant's support budget, so they use its currency */
    form.currency.disabled = proj && !!a;
    if (proj && a) form.currency.value = supportCurrency(a);
    $ams("#prCurNote", el).textContent = proj && a ? `Fixed to the project's support currency (${supportCurrency(a)}).` : "";
    if (fill && proj && a) {
      form.contactName.value = a.applicantName || form.contactName.value;
      if (a.phone) form.contactPhone.value = a.phone;
      if (a.email) form.contactEmail.value = a.email;
    }
    recalc();
  };
  const syncType = () => form.typeOther.classList.toggle("hidden", form.type.value !== "Other");
  form.scope.addEventListener("change", () => syncScope(true));
  form.appId.addEventListener("change", () => syncScope(true));
  form.currency.addEventListener("change", recalc);
  $$ams('input[name="type"]', form).forEach(r => r.addEventListener("change", syncType));
  body.addEventListener("input", recalc);
  body.addEventListener("click", (e) => {
    if (!e.target.closest("[data-rm]")) return;
    if ($$ams(".pr-item", body).length < 2) return alert("A request needs at least one item.");
    e.target.closest(".pr-item").remove(); recalc();
  });
  $ams("#prAddItem", el).addEventListener("click", () => {
    body.insertAdjacentHTML("beforeend", row({ qty: 1, uom: "pcs" })); recalc();
    $ams(".pr-item:last-child input", body).focus();
  });
  syncScope(false); syncType();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const proj = form.scope.value === "project", a = proj ? apps.find(x => x.id === form.appId.value) : null;
    if (proj && !a) return alert("Please choose the applicant / project.");
    if (form.type.value === "Other" && !form.typeOther.value.trim()) return alert("Please specify the type of request.");
    const list = $$ams(".pr-item", body).map(r => ({
      desc: $ams('[data-f="desc"]', r).value.trim(), qty: prNum($ams('[data-f="qty"]', r).value), uom: $ams('[data-f="uom"]', r).value,
      unitCost: prNum($ams('[data-f="unitCost"]', r).value), note: $ams('[data-f="note"]', r).value.trim(),
    })).filter(i => i.desc && i.qty > 0);
    if (!list.length) return alert("Please add at least one item.");
    const now = new Date().toISOString();
    const next = {
      ...(pr || { id: amsUid("pr"), no: prNextNo("PR", p => p.no), createdAt: now, quotes: [], returns: [], log: [] }),
      status: "review",
      requester: pr?.requester || { id: staff.id, name: staff.name, title: staff.title || ROLES[staff.role]?.label || staff.role },
      appId: a ? a.id : "", projectName: a ? `${a.name}${a.applicantName ? " — " + a.applicantName : ""}${a.code ? " (" + a.code + ")" : ""}` : "",
      department: form.department.value.trim(),
      contact: { name: form.contactName.value.trim(), phone: form.contactPhone.value.trim(), email: form.contactEmail.value.trim() },
      type: form.type.value, typeOther: form.type.value === "Other" ? form.typeOther.value.trim() : "",
      currency: form.currency.value, items: list, note: form.note.value.trim(),
      sigs: { requester: prSign() },
    };
    prSave(next, pr ? "Request revised and resubmitted" : "Purchase request submitted and signed by the requester",
      { title: pr ? "PR resubmitted" : "PR submitted", desc: `${next.no} · ${prSummary(next)}` });
    prNotifyProc(`${pr ? "Revised purchase request" : "New purchase request"} ${next.no} from ${staff.name} (${prMoney(prEstTotal(next), next.currency)}) — please review.`, next);
    nav(`?v=pr&id=${encodeURIComponent(next.id)}`);
  });
}

/* ============ VIEW: one purchase request ============ */
function prSigBoxes(list) {
  return `<div class="pr-sigs">${list.map(([label, sig, hint]) => `<div class="pr-sig ${sig ? "signed" : ""}">
    <div class="pr-sig-role">${escA(label)}</div>
    ${sig ? `<div class="pr-sig-name">${escA(sig.name)}</div>
      <div class="pr-sig-meta">${escA(sig.title || "")}${sig.onBehalf ? ` · on behalf of ${escA(sig.onBehalf)}` : ""}</div>
      <div class="pr-sig-date">${sig.recordedBy ? `✓ Signed ${amsFmtDate(sig.at)} · copy on file` : `✓ E-signed ${amsFmtDateTime(sig.at)}`}</div>`
      : `<div class="pr-sig-wait">${escA(hint || "Not signed yet")}</div>`}
  </div>`).join("")}</div>`;
}
const prPrSigList = pr => [["Requester", pr.sigs?.requester],
  ...PRX.CHAIN_PR.map(r => [PRX.SIGNERS[r], pr.sigs?.[r] || pr.po?.sigs?.[r], pr.needsPo ? "Signs the Purchase Order" : "Not signed yet"])];
const prPoSigList = pr => PRX.CHAIN_PO.map(r => [PRX.SIGNERS[r], pr.po?.sigs?.[r]]);

function viewPr(el) {
  const pr = amsGetPr(P.get("id"));
  if (!pr || !prCanSee(pr)) {
    el.innerHTML = `<div class="ams-card"><h3>Purchase request not found</h3><div class="empty-state">It may have been removed, or you do not have access to it.</div>
      <a class="abtn ghost sm" href="?v=procurement">← Back to Procurement</a></div>`;
    return;
  }
  if (P.get("edit") && pr.status === "returned" && prIsRequester(pr)) return prRenderForm(el, pr);

  const cur = pr.currency, isProc = prIsProc(), mine = prMine(pr), step = PRX.STEP_OF[pr.status];
  const dead = pr.status === "rejected" || pr.status === "cancelled";
  const quotes = pr.quotes || [], acc = prAccepted(pr), lines = prLines(pr), next = prNextSigner(pr);
  const stepLabel = (s, i) => i === 3 && pr.needsPo === true ? "Purchase Order" : i === 3 && pr.needsPo === false ? "PR Approval" : s;

  /* ----- the one thing that has to happen next ----- */
  let action = "";
  if (pr.status === "review" && isProc) action = `
    <p>Check the request. If something is wrong or missing, return it to the requester with a comment; otherwise proceed to quotations.</p>
    <div class="inline-form pr-plain"><label>Comment (required when returning or rejecting)</label><textarea id="prCmt" rows="2" maxlength="600"></textarea></div>
    <div class="pr-btns"><button class="abtn" data-act="accept">Request is correct — proceed</button>
      <button class="abtn ghost" data-act="return">Return to requester</button><button class="abtn danger" data-act="reject">Reject</button></div>`;
  else if (pr.status === "returned" && prIsRequester(pr)) action = `
    <p><b>${escA(pr.returns?.[0]?.by || "Procurement")} returned this request:</b> ${escA(pr.returns?.[0]?.comment || "")}</p>
    <div class="pr-btns"><a class="abtn" href="?v=pr&id=${encodeURIComponent(pr.id)}&edit=1">Edit &amp; resubmit</a>
      <button class="abtn danger" data-act="cancel">Cancel this request</button></div>`;
  else if (pr.status === "quotes" && isProc) action = quotes.length < PRX.MIN_QUOTES
    ? `<p>Record <b>${PRX.MIN_QUOTES} quotations</b> below, each with its evidence (the supplier's offer, a photo or a screenshot). ${quotes.length} of ${PRX.MIN_QUOTES} added.</p>`
    : `<p>All quotations are in. Compare them below and <b>select the winning quotation</b>.</p>`;
  else if ((pr.status === "pr_sign" || pr.status === "po_sign") && mine && next !== "supplier") action = `
    <p>Your signature is required as <b>${escA(PRX.SIGNERS[next])}</b> on ${pr.status === "po_sign" ? `Purchase Order <b>${escA(pr.po.no)}</b>` : `Purchase Request <b>${escA(pr.no)}</b>`}
      — ${escA(acc?.supplier || "")}, <b>${prMoney(prTotal(pr), cur)}</b>.${staff.role !== next ? " You are signing as Master Admin on behalf of this role." : ""}</p>
    <div class="inline-form pr-plain"><label>Comment (required when declining)</label><textarea id="prCmt" rows="2" maxlength="600"></textarea></div>
    <div class="pr-btns"><button class="abtn" data-act="sign">✍ Sign electronically</button><button class="abtn danger" data-act="decline">Decline</button></div>`;
  else if (pr.status === "po_sign" && next === "supplier" && isProc) action = `
    <p>KII has signed the PO. Send it to the supplier, then record the supplier's signature and attach the signed copy.</p>
    <form id="prSupForm" class="inline-form pr-plain"><div class="grid-2">
      <div><label>Supplier representative name *</label><input name="name" required maxlength="100" value="${escA(acc?.signName || "")}"></div>
      <div><label>Date signed *</label><input type="date" name="date" required value="${prToday()}" max="${prToday()}"></div>
      <div><label>Signed PO copy *</label><input type="file" name="files" required multiple></div></div>
      <button class="abtn" style="margin-top:10px">Record supplier signature</button></form>`;
  else if (pr.status === "purchase" && isProc) action = `
    <p>Fully approved. Buy the item(s), hand them to <b>${escA(pr.requester.name)}</b>, then record the hand-over. The requester is notified to complete the Reception &amp; Control form.</p>
    <form id="prDelForm" class="inline-form pr-plain"><div class="grid-2">
      <div><label>Delivery date *</label><input type="date" name="date" required value="${prToday()}" max="${prToday()}"></div>
      <div><label>Invoice / receipt</label><input type="file" name="files" multiple></div>
      <div style="grid-column:1/-1"><label>Hand-over note</label><input name="note" maxlength="300"></div></div>
      <button class="abtn" style="margin-top:10px">Purchased &amp; handed over to requester</button></form>`;
  else if (pr.status === "delivered" && prIsRequester(pr)) action = `
    <p>Your item(s) were handed over on <b>${amsFmtDate(pr.delivery.date)}</b> by ${escA(pr.delivery.by)}. Check them and complete the Reception &amp; Control form — this closes the request.</p>
    <form id="prRecForm">
      <table class="tbl pr-edit"><thead><tr><th>Item / service</th><th>Ordered</th><th style="width:120px">Quantity received *</th><th>Unit</th><th style="width:150px">Condition</th></tr></thead><tbody>
      ${lines.map((l, i) => `<tr><td><b>${escA(l.desc)}</b>${l.spec ? `<div class="sub2">${escA(l.spec)}</div>` : ""}</td><td>${l.qty}</td>
        <td><input type="number" data-rq="${i}" min="0" step="any" required value="${l.qty}"></td><td>${escA(l.uom)}</td>
        <td><select data-rc="${i}"><option>Good</option><option>Damaged</option><option>Incomplete</option><option>Not as specified</option></select></td></tr>`).join("")}
      </tbody></table>
      <div class="inline-form pr-plain"><div class="grid-2">
        <div><label>Delivery date *</label><input type="date" name="date" required value="${escA(pr.delivery.date)}" max="${prToday()}"></div>
        <div><label>Controller name *</label><input name="controller" required maxlength="100" value="${escA(pr.delivery.by)}"></div>
        <div><label>Receiver name *</label><input name="receiver" required maxlength="100" value="${escA(staff.name)}"></div>
        <div style="grid-column:1/-1"><label>Comment</label><textarea name="comment" rows="2" maxlength="600"></textarea></div></div></div>
      <label class="pr-consent"><input type="checkbox" required><span>I confirm I received and checked the items above, and I sign this form electronically.</span></label>
      <div><button class="abtn" style="margin-top:10px">✍ Sign &amp; close the request</button></div></form>`;
  const actionCard = dead ? `<div class="ams-card pr-alert"><b>${pr.status === "rejected" ? "Rejected" : "Cancelled"}</b>${pr.closed ? ` by ${escA(pr.closed.by)} on ${amsFmtDate(pr.closed.at)}${pr.closed.comment ? ": " + escA(pr.closed.comment) : ""}` : ""}</div>`
    : pr.status === "completed" ? `<div class="ams-card pr-ok"><b>Completed.</b> Received and signed by ${escA(pr.receipt?.sig?.name || "")} on ${amsFmtDate(pr.receipt?.at)}.</div>`
    : action ? `<div class="ams-card pr-action"><h3>Action required from you</h3>${action}</div>`
    : `<div class="ams-card pr-wait"><b>Waiting for:</b> ${escA(prWaiting(pr))}</div>`;

  /* ----- quotations ----- */
  const canQuote = pr.status === "quotes" && isProc;
  const lowest = quotes.length ? Math.min(...quotes.map(prQuoteTotal)) : 0;
  const quoteCard = step < 2 && !quotes.length ? "" : `<div class="ams-card"><h3>Quotations (RFQ) <span class="sub2">${quotes.length} of ${PRX.MIN_QUOTES} required</span></h3>
    <table class="tbl"><thead><tr><th>RFQ #</th><th>Supplier</th><th>Total</th><th>Delivery</th><th>Payment terms</th><th>Evidence</th><th>Selection</th><th></th></tr></thead><tbody>
    ${quotes.map(q => `<tr>
      <td><b>${escA(q.no)}</b><div class="sub2">${amsFmtDate(q.issueDate)}</div></td>
      <td><b>${escA(q.supplier)}</b><div class="sub2">${escA([q.supplierPhone, q.supplierEmail].filter(Boolean).join(" · "))}</div></td>
      <td style="white-space:nowrap"><b>${prMoney(prQuoteTotal(q), cur)}</b>${prQuoteTotal(q) === lowest && quotes.length > 1 ? '<div class="sub2" style="color:#15803d">Lowest</div>' : ""}</td>
      <td>${escA(q.deliveryDuration || "—")}</td><td>${escA(q.paymentTerms || "—")}</td><td>${prFiles(q.evidence)}</td>
      <td>${chipStatus(q.status)}</td>
      <td style="white-space:nowrap"><button class="abtn ghost sm" data-print="rfq" data-q="${q.id}">Print RFQ</button>
        ${canQuote && quotes.length >= PRX.MIN_QUOTES ? `<button class="abtn sm" data-qsel="${q.id}">Select</button>` : ""}
        ${canQuote ? `<button class="pr-x" data-qdel="${q.id}" title="Remove quotation">×</button>` : ""}</td>
    </tr>`).join("") || '<tr><td colspan="8"><div class="empty-state">No quotations recorded yet.</div></td></tr>'}
    </tbody></table>
    ${acc?.selectionNote ? `<div class="sub2" style="margin-top:8px"><b>Selection note:</b> ${escA(acc.selectionNote)}</div>` : ""}
    ${canQuote && quotes.length >= PRX.MIN_QUOTES ? `<div class="inline-form pr-plain" style="margin-top:12px"><label>Selection note (required if you do not select the lowest quotation)</label>
      <input id="prSelNote" maxlength="300" placeholder="e.g. better warranty, faster delivery, only supplier meeting the specification"></div>` : ""}
    ${canQuote && quotes.length < 5 ? `<button class="abtn ghost sm ${quotes.length < PRX.MIN_QUOTES ? "hidden" : ""}" id="prQToggle" style="margin-top:10px">${IC.plus} Add another quotation</button>
    <form id="prQForm" class="inline-form ${quotes.length < PRX.MIN_QUOTES ? "" : "hidden"}" style="margin-top:12px">
      <b>Quotation ${quotes.length + 1} of ${PRX.MIN_QUOTES}</b>
      <div class="grid-2">
        <div><label>Supplier name *</label><input name="supplier" required maxlength="120"></div>
        <div><label>Supplier address</label><input name="supplierAddress" maxlength="200"></div>
        <div><label>Supplier phone</label><input name="supplierPhone" maxlength="40"></div>
        <div><label>Supplier email</label><input name="supplierEmail" type="email" maxlength="120"></div>
        <div><label>Issue date *</label><input type="date" name="issueDate" required value="${prToday()}"></div>
        <div><label>Clarification deadline</label><input type="date" name="clarDeadline"></div>
        <div><label>Submission deadline</label><input type="date" name="subDeadline"></div>
        <div><label>Buyer name *</label><input name="buyerName" required value="${escA(staff.name)}"></div>
        <div><label>Buyer contact</label><input name="buyerContact" value="${escA(staff.phone || "")}"></div>
        <div><label>Buyer email</label><input name="buyerEmail" type="email" value="${escA(staff.email || "")}"></div>
        <div style="grid-column:1/-1"><label>Purpose of the RFQ *</label><input name="purpose" required maxlength="300" value="${escA(`Quotation for ${prSummary(pr)} — ${prProject(pr)}`.slice(0, 300))}"></div>
      </div>
      <label>Items &amp; price (${cur})</label>
      <table class="tbl pr-edit"><thead><tr><th>Item description</th><th>Specification offered</th><th>Qty</th><th>Unit</th><th>Unit price *</th><th>Delivery / installation fee</th><th>Potential discount</th><th>Total</th></tr></thead><tbody>
      ${pr.items.map((it, i) => `<tr class="pr-qline"><td><b>${escA(it.desc)}</b></td><td><input data-q="spec" maxlength="200"></td><td>${it.qty}</td><td>${escA(it.uom)}</td>
        <td><input data-q="unitPrice" type="number" min="0" step="any" required data-qty="${it.qty}"></td>
        <td><input data-q="fee" type="number" min="0" step="any" value="0"></td><td><input data-q="discount" type="number" min="0" step="any" value="0"></td>
        <td class="pr-lt">0</td></tr>`).join("")}
      </tbody><tfoot><tr><td colspan="7" style="text-align:right"><b>Quotation total</b></td><td><b id="prQTotal">0</b></td></tr></tfoot></table>
      <div class="grid-2">
        <div><label>Delivery &amp; payment terms</label><input name="paymentTerms" maxlength="200" placeholder="e.g. Cash on delivery, 30 days credit"></div>
        <div><label>Delivery duration</label><input name="deliveryDuration" maxlength="80" placeholder="e.g. 5 working days"></div>
        <div><label>Delivery location</label><input name="deliveryLocation" maxlength="200" value="KII Office, Erbil"></div>
        <div><label>Evidence — supplier's quotation *</label><input type="file" name="files" required multiple></div>
        <div><label>Supplier signatory name</label><input name="signName" maxlength="100"></div>
        <div><label>Supplier signature date</label><input type="date" name="signDate"></div>
        <div><label>KII received by *</label><input name="receivedBy" required value="${escA(staff.name)}"></div>
        <div><label>Date received *</label><input type="date" name="receivedDate" required value="${prToday()}"></div>
      </div>
      <button class="abtn sm" style="margin-top:10px">Save quotation</button>
    </form>` : ""}
  </div>`;

  /* ----- purchase order ----- */
  const po = pr.po, pt = prPoTotals(pr);
  const kv = rows => `<table class="tbl pr-kv"><tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v || "—"}</td></tr>`).join("")}</tbody></table>`;
  const lineTable = (ls, extra) => `<table class="tbl"><thead><tr><th>#</th><th>Item / service</th><th>Specification</th><th>Unit</th><th>Qty</th><th>Unit price</th><th>Total</th>${extra ? "<th>Note</th>" : ""}</tr></thead><tbody>
    ${ls.map((l, i) => `<tr><td>${i + 1}</td><td><b>${escA(l.desc)}</b></td><td>${escA(l.spec || "—")}</td><td>${escA(l.uom)}</td><td>${l.qty}</td>
      <td>${prMoney(l.unitPrice, cur)}</td><td><b>${prMoney(l.qty * l.unitPrice, cur)}</b></td>${extra ? `<td>${escA(l.note || "")}</td>` : ""}</tr>`).join("")}</tbody></table>`;
  let poCard = "";
  if (pr.status === "po_prep" && isProc) poCard = `<div class="ams-card pr-action"><h3>Prepare Purchase Order</h3>
    <p>The selected quotation (${prMoney(prQuoteTotal(acc), cur)}) is above ${prLimitText(cur)}, so a Purchase Order is required. The PO number is assigned when you issue it.</p>
    <form id="prPoForm" class="inline-form pr-plain">
      <b>Buyer information</b><div class="grid-2">
        <div><label>Buyer name *</label><input name="bName" required value="Kurdistan Innovation Institute (KII)"></div>
        <div><label>Buyer address *</label><input name="bAddress" required value="Erbil, Kurdistan Region, Iraq"></div>
        <div><label>Contact number</label><input name="bPhone" value="${escA(acc.buyerContact || staff.phone || "")}"></div>
        <div><label>Email address</label><input name="bEmail" type="email" value="${escA(acc.buyerEmail || staff.email || "")}"></div>
        <div><label>Date of request</label><input type="date" name="bDate" value="${escA(String(pr.createdAt).slice(0, 10))}"></div></div>
      <b>Supplier information</b><div class="grid-2">
        <div><label>Supplier name *</label><input name="sName" required value="${escA(acc.supplier)}"></div>
        <div><label>Supplier address</label><input name="sAddress" value="${escA(acc.supplierAddress || "")}"></div>
        <div><label>Contact number</label><input name="sPhone" value="${escA(acc.supplierPhone || "")}"></div>
        <div><label>Email address</label><input name="sEmail" type="email" value="${escA(acc.supplierEmail || "")}"></div>
        <div><label>Expected delivery date *</label><input type="date" name="sDelivery" required min="${prToday()}"></div></div>
      <b>Ship to</b><div class="grid-2">
        <div><label>Receiving area name *</label><input name="rArea" required value="${escA(pr.department)}"></div>
        <div><label>Receiver name *</label><input name="rName" required value="${escA(pr.requester.name)}"></div>
        <div><label>Receiver address *</label><input name="rAddress" required value="${escA(acc.deliveryLocation || "KII Office, Erbil")}"></div>
        <div><label>Contact number</label><input name="rPhone" value="${escA(pr.contact.phone)}"></div>
        <div><label>Email address</label><input name="rEmail" type="email" value="${escA(pr.contact.email)}"></div>
        <div><label>Incoterms</label><select name="incoterms">${PRX.INCOTERMS.map(x => `<option>${x}</option>`).join("")}</select></div></div>
      <b>Items / services</b>
      <table class="tbl pr-edit"><thead><tr><th>#</th><th>Item / service</th><th>Detail &amp; specification</th><th>Unit</th><th>Qty</th><th>Unit price</th><th>Total</th><th>Note</th></tr></thead><tbody>
      ${lines.map((l, i) => `<tr><td>${i + 1}</td><td><b>${escA(l.desc)}</b></td><td>${escA(l.spec || "—")}</td><td>${escA(l.uom)}</td><td>${l.qty}</td>
        <td>${prMoney(l.unitPrice, cur)}</td><td>${prMoney(l.qty * l.unitPrice, cur)}</td><td><input data-pon="${i}" maxlength="160"></td></tr>`).join("")}</tbody></table>
      <div class="grid-2">
        <div><label>Taxes (${cur})</label><input type="number" name="tax" min="0" step="any" value="0"></div>
        <div><label>Delivery fee (${cur})</label><input type="number" name="deliveryFee" min="0" step="any" value="${acc.lines.reduce((s, l) => s + prNum(l.fee), 0)}"></div>
        <div><label>Discount (${cur})</label><input type="number" name="discount" min="0" step="any" value="${acc.lines.reduce((s, l) => s + prNum(l.discount), 0)}"></div>
        <div><label>Total after discount</label><input id="prPoTotal" disabled></div>
        <div style="grid-column:1/-1"><label>Terms and conditions</label><textarea name="terms" rows="4">${escA(PRX.TERMS)}</textarea></div>
        <div style="grid-column:1/-1"><label>Additional note</label><textarea name="note" rows="2" maxlength="600"></textarea></div></div>
      <button class="abtn" style="margin-top:10px">Issue PO &amp; send for signatures</button></form></div>`;
  else if (po) poCard = `<div class="ams-card"><div class="page-head-row"><h3 style="margin:0">Purchase Order ${escA(po.no)}</h3>
      <button class="abtn ghost sm" data-print="po">Print PO</button></div>
    <div class="grid-3col pr-parties">
      <div><div class="md-k">Buyer</div><b>${escA(po.buyer.name)}</b><div class="sub2">${escA(po.buyer.address)}<br>${escA([po.buyer.phone, po.buyer.email].filter(Boolean).join(" · "))}</div></div>
      <div><div class="md-k">Supplier</div><b>${escA(po.supplier.name)}</b><div class="sub2">${escA(po.supplier.address || "")}<br>${escA([po.supplier.phone, po.supplier.email].filter(Boolean).join(" · "))}<br>Expected delivery: ${amsFmtDate(po.supplier.delivery)}</div></div>
      <div><div class="md-k">Ship to</div><b>${escA(po.shipTo.area)}</b><div class="sub2">${escA(po.shipTo.name)} · ${escA(po.shipTo.address)}<br>Incoterms: ${escA(po.shipTo.incoterms)}</div></div>
    </div>
    ${lineTable(lines.map((l, i) => ({ ...l, note: po.notes?.[i] || "" })), true)}
    <div class="pr-totals"><span>Subtotal <b>${prMoney(pt.sub, cur)}</b></span><span>Taxes <b>${prMoney(pt.tax, cur)}</b></span><span>Delivery fee <b>${prMoney(pt.fee, cur)}</b></span>
      <span>Discount <b>− ${prMoney(pt.disc, cur)}</b></span><span class="grand">Total after discount <b>${prMoney(pt.total, cur)}</b></span></div>
    <div class="md-k" style="margin-top:14px">Approval &amp; authentication</div>${prSigBoxes(prPoSigList(pr))}
    ${po.supplierFiles?.length ? `<div style="margin-top:8px"><span class="md-k">Signed PO copy</span> ${prFiles(po.supplierFiles)}</div>` : ""}
  </div>`;

  /* ----- delivery & reception ----- */
  const rc = pr.receipt;
  const deliveryCard = !pr.delivery ? "" : `<div class="ams-card"><div class="page-head-row"><h3 style="margin:0">Delivery, Reception &amp; Control</h3>
      <button class="abtn ghost sm" data-print="rc">Print Reception &amp; Control form</button></div>
    ${kv([["Handed over", `${amsFmtDate(pr.delivery.date)} by ${escA(pr.delivery.by)}`], ["Hand-over note", escA(pr.delivery.note)], ["Invoice / receipt", prFiles(pr.delivery.files)]])}
    ${rc ? `<table class="tbl" style="margin-top:10px"><thead><tr><th>Item / service</th><th>Ordered</th><th>Received</th><th>Unit</th><th>Condition</th></tr></thead><tbody>
      ${lines.map((l, i) => `<tr><td><b>${escA(l.desc)}</b></td><td>${l.qty}</td><td><b>${escA(rc.lines[i]?.received ?? "—")}</b></td><td>${escA(l.uom)}</td><td>${escA(rc.lines[i]?.condition || "—")}</td></tr>`).join("")}</tbody></table>
      ${rc.comment ? `<div class="sub2" style="margin:8px 0"><b>Comment:</b> ${escA(rc.comment)}</div>` : ""}
      ${prSigBoxes([["Controller — " + rc.controller, pr.delivery.sig], ["Receiver — " + rc.receiver, rc.sig]])}` : '<div class="empty-state">The requester has not completed the Reception &amp; Control form yet.</div>'}
  </div>`;

  el.innerHTML = `<div class="prx">
    <div class="page-head-row">
      <div><div class="page-title">${escA(pr.no)} ${prChip(pr)}</div>
      <div class="page-sub">${escA(prProject(pr))} · requested by ${escA(pr.requester.name)} on ${amsFmtDate(pr.createdAt)} · <b>${prMoney(prTotal(pr), cur)}</b>
        ${pr.needsPo === true ? " · Purchase Order required" : pr.needsPo === false ? " · No Purchase Order needed" : ""}</div></div>
      <div style="display:flex;gap:8px"><button class="abtn ghost sm" data-print="pr">Print PR</button><a class="abtn ghost sm" href="?v=procurement">← Procurement</a></div>
    </div>
    <div class="ams-card pr-steps ${dead ? "dead" : ""}">${PRX.STEPS.map((s, i) => `<div class="pr-step ${!dead && i < step ? "done" : !dead && i === step ? "now" : ""}">
      <span>${!dead && i < step ? "✓" : i + 1}</span>${stepLabel(s, i)}</div>`).join("")}</div>
    ${actionCard}
    <div class="ams-card"><h3>Purchase Request</h3>
      <div class="grid-2col">
        ${kv([["PR number", `<b>${escA(pr.no)}</b>`], ["Date", amsFmtDate(pr.createdAt)], ["Applicant / project", escA(prProject(pr))], ["Department", escA(pr.department)]])}
        ${kv([["Contact person", escA(pr.contact.name)], ["Phone", escA(pr.contact.phone)], ["Email", escA(pr.contact.email)], ["Type of request", `<b>${escA(prTypeLabel(pr))}</b>`]])}
      </div>
      <table class="tbl" style="margin-top:12px"><thead><tr><th>#</th><th>Item / service description</th><th>Quantity</th><th>Unit</th><th>Estimated cost</th><th>Estimated total</th><th>Note</th></tr></thead><tbody>
      ${pr.items.map((it, i) => `<tr><td>${i + 1}</td><td><b>${escA(it.desc)}</b></td><td>${it.qty}</td><td>${escA(it.uom)}</td><td>${prMoney(it.unitCost, cur)}</td>
        <td><b>${prMoney(it.qty * it.unitCost, cur)}</b></td><td class="sub2">${escA(it.note || "")}</td></tr>`).join("")}
      </tbody><tfoot><tr><td colspan="5" style="text-align:right"><b>Estimated total cost</b></td><td colspan="2"><b>${prMoney(prEstTotal(pr), cur)}</b></td></tr></tfoot></table>
      ${pr.note ? `<div class="sub2" style="margin:10px 0"><b>Note:</b> ${escA(pr.note)}</div>` : ""}
      <div class="md-k" style="margin-top:14px">E-signatures</div>${prSigBoxes(prPrSigList(pr))}
    </div>
    ${quoteCard}${poCard}${deliveryCard}
    <div class="ams-card"><h3>History</h3><table class="tbl"><tbody>
      ${(pr.log || []).map(x => `<tr><td class="sub2" style="width:170px">${amsFmtDateTime(x.at)}</td><td style="width:200px"><b>${escA(x.by)}</b></td><td>${escA(x.text)}</td></tr>`).join("")}
    </tbody></table></div>
  </div>`;

  /* ---------- handlers ---------- */
  const root = el.firstElementChild, here = `?v=pr&id=${encodeURIComponent(pr.id)}`;
  const cmt = () => ($ams("#prCmt", root)?.value || "").trim();
  const close = (status, comment, text) => {
    pr.status = status; pr.closed = { by: staff.name, at: new Date().toISOString(), comment };
    prSave(pr, text, { title: status === "rejected" ? "PR rejected" : "PR cancelled", desc: pr.no });
  };
  bindUploadViewers(root);
  $$ams("[data-print]", root).forEach(b => b.addEventListener("click", () => prPrint(b.dataset.print, pr, b.dataset.q)));

  $$ams("[data-act]", root).forEach(b => b.addEventListener("click", () => {
    const act = b.dataset.act, c = cmt();
    if (["return", "reject", "decline"].includes(act) && !c) return alert("Please write a comment explaining why.");
    if (act === "accept") {
      pr.status = "quotes"; pr.review = { by: staff.name, at: new Date().toISOString(), comment: c };
      prSave(pr, `Reviewed and accepted by procurement${c ? " — " + c : ""}`);
      prNotifyRequester(`Your purchase request ${pr.no} was accepted by procurement. Quotations are being collected.`, pr);
    } else if (act === "return") {
      pr.status = "returned"; (pr.returns = pr.returns || []).unshift({ by: staff.name, at: new Date().toISOString(), comment: c });
      prSave(pr, `Returned to the requester — ${c}`);
      prNotifyRequester(`Your purchase request ${pr.no} was returned by procurement: "${c}". Please revise and resubmit.`, pr);
    } else if (act === "reject") {
      if (!confirm(`Reject ${pr.no}? This closes the request.`)) return;
      close("rejected", c, `Rejected by procurement — ${c}`);
      prNotifyRequester(`Your purchase request ${pr.no} was rejected: "${c}".`, pr);
    } else if (act === "cancel") {
      if (!confirm(`Cancel ${pr.no}?`)) return;
      close("cancelled", "", "Cancelled by the requester");
      prNotifyProc(`Purchase request ${pr.no} was cancelled by ${staff.name}.`, pr);
    } else if (act === "decline") {
      if (!confirm(`Decline ${pr.no}? This closes the request.`)) return;
      close("rejected", c, `Declined by ${PRX.SIGNERS[next]} — ${c}`);
      prNotifyRequester(`Your purchase request ${pr.no} was declined by the ${PRX.SIGNERS[next]}: "${c}".`, pr);
      prNotifyProc(`${pr.no} was declined by the ${PRX.SIGNERS[next]}: "${c}".`, pr);
    } else if (act === "sign") {
      const doc = pr.status === "po_sign" ? `Purchase Order ${pr.po.no}` : `Purchase Request ${pr.no}`;
      if (!confirm(`Sign ${doc} electronically as ${PRX.SIGNERS[next]}?\n\n${staff.name}\n${prMoney(prTotal(pr), cur)}\n\nYour name, the date and the time will be recorded.`)) return;
      const sigs = pr.status === "po_sign" ? (pr.po.sigs = pr.po.sigs || {}) : pr.sigs;
      sigs[next] = prSign(next);
      const after = prNextSigner(pr);
      if (!after) {
        pr.status = "purchase";
        prSave(pr, `Signed by ${PRX.SIGNERS[next]} — fully approved`, { title: "PR approved", desc: `${pr.no} · ${prMoney(prTotal(pr), cur)}` });
        prNotifyProc(`${pr.no} is fully approved — please purchase and hand over to ${pr.requester.name}.`, pr);
        prNotifyRequester(`Your purchase request ${pr.no} is fully approved. Procurement will purchase the item(s).`, pr);
      } else {
        prSave(pr, `Signed by ${PRX.SIGNERS[next]}${c ? " — " + c : ""}`);
        if (after === "supplier") prNotifyProc(`${pr.po.no} is signed by KII — please obtain the supplier's signature.`, pr);
        else prNotifyRole(after, `${doc} (${prMoney(prTotal(pr), cur)}) is waiting for your signature.`, pr);
      }
    }
    nav(here);
  }));

  /* quotations */
  const qf = $ams("#prQForm", root);
  $ams("#prQToggle", root)?.addEventListener("click", () => qf.classList.toggle("hidden"));
  if (qf) {
    const qcalc = () => {
      let g = 0;
      $$ams(".pr-qline", qf).forEach(r => {
        const up = $ams('[data-q="unitPrice"]', r);
        const t = prNum(up.dataset.qty) * prNum(up.value) + prNum($ams('[data-q="fee"]', r).value) - prNum($ams('[data-q="discount"]', r).value);
        g += t; $ams(".pr-lt", r).textContent = prMoney(t, cur);
      });
      $ams("#prQTotal", qf).textContent = prMoney(g, cur);
    };
    qf.addEventListener("input", qcalc); qcalc();
    qf.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $ams("button", qf); btn.disabled = true;
      const evidence = await prUpload(qf.files, "proc/rfq");
      if (!evidence.length) { btn.disabled = false; return alert("The evidence file could not be saved. Please try again."); }
      const v = n => qf[n].value.trim();
      const q = { id: amsUid("q"), no: `${pr.no.replace("-PR-", "-RFQ-")}-${String.fromCharCode(65 + quotes.length)}`, status: "Pending",
        supplier: v("supplier"), supplierAddress: v("supplierAddress"), supplierPhone: v("supplierPhone"), supplierEmail: v("supplierEmail"),
        issueDate: v("issueDate"), clarDeadline: v("clarDeadline"), subDeadline: v("subDeadline"),
        buyerName: v("buyerName"), buyerContact: v("buyerContact"), buyerEmail: v("buyerEmail"), purpose: v("purpose"),
        lines: $$ams(".pr-qline", qf).map((r, i) => ({ desc: pr.items[i].desc, qty: pr.items[i].qty, uom: pr.items[i].uom, note: pr.items[i].note || "",
          spec: $ams('[data-q="spec"]', r).value.trim(), unitPrice: prNum($ams('[data-q="unitPrice"]', r).value),
          fee: prNum($ams('[data-q="fee"]', r).value), discount: prNum($ams('[data-q="discount"]', r).value) })),
        paymentTerms: v("paymentTerms"), deliveryDuration: v("deliveryDuration"), deliveryLocation: v("deliveryLocation"),
        signName: v("signName"), signDate: v("signDate"), receivedBy: v("receivedBy"), receivedDate: v("receivedDate"),
        evidence, addedBy: staff.name, addedAt: new Date().toISOString() };
      while (quotes.some(x => x.no === q.no)) q.no += "'";
      pr.quotes = [...quotes, q];
      prSave(pr, `Quotation ${q.no} recorded — ${q.supplier}, ${prMoney(prQuoteTotal(q), cur)}`);
      nav(here);
    });
  }
  $$ams("[data-qdel]", root).forEach(b => b.addEventListener("click", () => {
    const q = quotes.find(x => x.id === b.dataset.qdel);
    if (!q || !confirm(`Remove quotation ${q.no} from ${q.supplier}?`)) return;
    pr.quotes = quotes.filter(x => x !== q);
    prSave(pr, `Quotation ${q.no} removed`); nav(here);
  }));
  $$ams("[data-qsel]", root).forEach(b => b.addEventListener("click", () => {
    const q = quotes.find(x => x.id === b.dataset.qsel), note = ($ams("#prSelNote", root)?.value || "").trim();
    if (!q) return;
    const total = prQuoteTotal(q), needsPo = prNeedsPo(total, cur);
    if (total > lowest && !note) return alert("This is not the lowest quotation. Please write a selection note explaining the choice.");
    if (!confirm(`Select ${q.supplier} — ${prMoney(total, cur)}?\n\n${needsPo ? `Above ${prLimitText(cur)}: a Purchase Order will be required.` : `Within ${prLimitText(cur)}: no Purchase Order is needed — the PR goes for signatures.`}`)) return;
    quotes.forEach(x => { x.status = x === q ? "Accepted" : "Rejected"; });
    q.selectionNote = note; q.selectedBy = staff.name; q.selectedAt = new Date().toISOString();
    pr.needsPo = needsPo; pr.status = needsPo ? "po_prep" : "pr_sign";
    prSave(pr, `Quotation ${q.no} selected — ${q.supplier}, ${prMoney(total, cur)}. ${needsPo ? "Purchase Order required." : "No Purchase Order needed; PR sent for signatures."}`);
    if (!needsPo) prNotifyRole(PRX.CHAIN_PR[0], `Purchase Request ${pr.no} (${prMoney(total, cur)}) is waiting for your signature.`, pr);
    nav(here);
  }));

  /* purchase order */
  const pf = $ams("#prPoForm", root);
  if (pf) {
    const sub = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
    const pcalc = () => { $ams("#prPoTotal", pf).value = prMoney(sub + prNum(pf.tax.value) + prNum(pf.deliveryFee.value) - prNum(pf.discount.value), cur); };
    pf.addEventListener("input", pcalc); pcalc();
    pf.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = n => pf[n].value.trim();
      pr.po = { no: prNextNo("PO", p => p.po?.no), date: new Date().toISOString(), rfqNo: acc.no,
        buyer: { name: v("bName"), address: v("bAddress"), phone: v("bPhone"), email: v("bEmail"), requestDate: v("bDate") },
        supplier: { name: v("sName"), address: v("sAddress"), phone: v("sPhone"), email: v("sEmail"), delivery: v("sDelivery") },
        shipTo: { area: v("rArea"), name: v("rName"), address: v("rAddress"), phone: v("rPhone"), email: v("rEmail"), incoterms: v("incoterms") },
        notes: lines.map((_, i) => $ams(`[data-pon="${i}"]`, pf).value.trim()),
        tax: prNum(v("tax")), deliveryFee: prNum(v("deliveryFee")), discount: prNum(v("discount")),
        terms: v("terms"), note: v("note"), preparedBy: staff.name, sigs: {} };
      pr.status = "po_sign";
      prSave(pr, `Purchase Order ${pr.po.no} issued — ${pr.po.supplier.name}, ${prMoney(prPoTotals(pr).total, cur)}`, { title: "PO issued", desc: `${pr.no} → ${pr.po.no}` });
      prNotifyRole(PRX.CHAIN_PO[0], `Purchase Order ${pr.po.no} (${prMoney(prPoTotals(pr).total, cur)}) is waiting for your signature.`, pr);
      nav(here);
    });
  }
  $ams("#prSupForm", root)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; $ams("button", f).disabled = true;
    const files = await prUpload(f.files, "proc/po");
    if (!files.length) { $ams("button", f).disabled = false; return alert("The signed copy could not be saved. Please try again."); }
    pr.po.sigs.supplier = { name: f.name.value.trim(), title: pr.po.supplier.name, at: new Date(f.date.value + "T12:00:00").toISOString(), recordedBy: staff.name };
    pr.po.supplierFiles = files; pr.status = "purchase";
    prSave(pr, `Supplier signature recorded (${pr.po.sigs.supplier.name}) — PO fully signed`, { title: "PO approved", desc: `${pr.po.no} · ${prMoney(prTotal(pr), cur)}` });
    prNotifyRequester(`Purchase Order ${pr.po.no} for your request ${pr.no} is fully signed. Procurement will purchase the item(s).`, pr);
    nav(here);
  });

  /* delivery + reception */
  $ams("#prDelForm", root)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; $ams("button", f).disabled = true;
    pr.delivery = { date: f.date.value, note: f.note.value.trim(), files: await prUpload(f.files, "proc/delivery"), by: staff.name, sig: prSign() };
    pr.status = "delivered";
    prSave(pr, `Purchased and handed over to ${pr.requester.name}`);
    prNotifyRequester(`Your item(s) for ${pr.no} were handed over. Please complete the Reception & Control form to close the request.`, pr);
    nav(here);
  });
  $ams("#prRecForm", root)?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    pr.receipt = { date: f.date.value, controller: f.controller.value.trim(), receiver: f.receiver.value.trim(), comment: f.comment.value.trim(),
      lines: lines.map((_, i) => ({ received: prNum($ams(`[data-rq="${i}"]`, f).value), condition: $ams(`[data-rc="${i}"]`, f).value })),
      sig: prSign(), at: new Date().toISOString() };
    pr.status = "completed";
    prSave(pr, "Reception & Control form signed by the requester — request completed", { title: "PR completed — items received", desc: `${pr.no} · ${prMoney(prTotal(pr), cur)}` });
    prNotifyProc(`${pr.no} is completed — ${staff.name} signed the Reception & Control form.`, pr);
    prNotifyRole("finance_manager", `${pr.no} is completed (${prMoney(prTotal(pr), cur)}) — items received by ${staff.name}.`, pr);
    nav(here);
  });
}

/* ============ printable documents on KII letterhead: PR · RFQ · PO · Reception & Control ============ */
function prPrint(kind, pr, quoteId) {
  const cur = pr.currency, e = escA, d = v => v ? amsFmtDate(v) : "—", m = n => prMoney(n, cur);
  const lines = prLines(pr), acc = prAccepted(pr), po = pr.po, pt = prPoTotals(pr);
  const sig = (label, s, fallbackName) => `<div class="sg"><div class="sg-line">${s ? `<span class="sg-name">${e(s.name)}</span>` : ""}</div>
    <b>${e(label)}</b><div>${e(s?.name || fallbackName || "")}${s?.title && s.title !== label ? " · " + e(s.title) : ""}${s?.onBehalf ? " (on behalf)" : ""}</div>
    <div>Date: ${s ? (s.recordedBy ? amsFmtDate(s.at) : amsFmtDateTime(s.at)) : "______________"}</div>${s && !s.recordedBy ? '<div class="sg-e">Electronically signed</div>' : s?.recordedBy ? `<div class="sg-e">Signed copy on file · recorded by ${e(s.recordedBy)}</div>` : ""}</div>`;
  const box = (title, rows) => `<div class="bx"><h3>${title}</h3><table class="kv"><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v || "—"}</td></tr>`).join("")}</tbody></table></div>`;
  let title, no, body;

  if (kind === "pr") {
    title = "Purchase Request"; no = pr.no;
    body = `
      <h2>Request Information</h2>
      <table class="kv two"><tbody>
        <tr><th>PR Number</th><td><b>${e(pr.no)}</b></td><th>Date</th><td>${d(pr.createdAt)}</td></tr>
        <tr><th>Applicant / Project Name</th><td>${e(prProject(pr))}</td><th>Department</th><td>${e(pr.department)}</td></tr>
        <tr><th>Contact Person Name</th><td>${e(pr.contact.name)}</td><th>Phone</th><td>${e(pr.contact.phone)}</td></tr>
        <tr><th>Email</th><td colspan="3">${e(pr.contact.email)}</td></tr></tbody></table>
      <h2>Type of Request</h2>
      <div class="types">${PRX.TYPES.map(t => `<span><i>${pr.type === t ? "☑" : "☐"}</i> ${t}${t === "Other" ? `: ${pr.type === "Other" ? `<u>${e(pr.typeOther)}</u>` : "__________"}` : ""}</span>`).join("")}</div>
      <h2>Request Detail</h2>
      <table class="it"><thead><tr><th>#</th><th>Item / Service Description</th><th>Quantity</th><th>Unit</th><th>Estimate Cost</th><th>Estimate Total Cost</th><th>Note</th></tr></thead><tbody>
        ${pr.items.map((it, i) => `<tr><td>${i + 1}</td><td>${e(it.desc)}</td><td>${it.qty}</td><td>${e(it.uom)}</td><td>${m(it.unitCost)}</td><td>${m(it.qty * it.unitCost)}</td><td>${e(it.note || "")}</td></tr>`).join("")}
        </tbody><tfoot><tr><td colspan="5" class="r">Estimate Total Cost</td><td colspan="2"><b>${m(prEstTotal(pr))}</b></td></tr></tfoot></table>
      <div class="note"><b>Note:</b> ${e(pr.note || "—")}</div>
      ${acc ? `<div class="note"><b>Selected quotation:</b> ${e(acc.no)} — ${e(acc.supplier)}, ${m(prQuoteTotal(acc))}. ${pr.needsPo ? `Purchase Order ${e(po?.no || "to be issued")} required (above ${prLimitText(cur)}).` : `No Purchase Order required (within ${prLimitText(cur)}).`}</div>` : ""}
      <h2>E-Signatures</h2>
      <div class="sgs">${prPrSigList(pr).map(([l, s]) => sig(l, s)).join("")}</div>
      ${pr.needsPo ? `<div class="fine">For purchases above ${prLimitText(cur)} the management approvals are given on the Purchase Order and shown here for reference.</div>` : ""}`;
  } else if (kind === "rfq") {
    const q = (pr.quotes || []).find(x => x.id === quoteId);
    if (!q) return;
    title = "Request for Quotation"; no = q.no;
    body = `
      <table class="kv two"><tbody>
        <tr><th>RFQ No</th><td><b>${e(q.no)}</b></td><th>PR No</th><td>${e(pr.no)}</td></tr>
        <tr><th>Issue Date</th><td>${d(q.issueDate)}</td><th>Clarification Deadline</th><td>${d(q.clarDeadline)}</td></tr>
        <tr><th>Submission Deadline</th><td>${d(q.subDeadline)}</td><th>Selection Status</th><td><b>${q.status === "Pending" ? "☐ Accepted &nbsp; ☐ Rejected" : `${q.status === "Accepted" ? "☑" : "☐"} Accepted &nbsp; ${q.status === "Rejected" ? "☑" : "☐"} Rejected`}</b></td></tr></tbody></table>
      <div class="cols">${box("Buyer", [["Name", e(q.buyerName)], ["Contact", e(q.buyerContact)], ["Email", e(q.buyerEmail)]])}
        ${box("Supplier", [["Name", e(q.supplier)], ["Address", e(q.supplierAddress)], ["Contact", e([q.supplierPhone, q.supplierEmail].filter(Boolean).join(" · "))]])}</div>
      <h2>Purpose of RFQ</h2><div class="note">${e(q.purpose)}</div>
      <h2>Items &amp; Price</h2>
      <table class="it"><thead><tr><th>#</th><th>Item Description</th><th>Specification</th><th>QTY</th><th>Unit of Measure</th><th>Unit Price (${cur})</th><th>Delivery / Installation Fee</th><th>Potential Discount</th><th>Total Price (${cur})</th></tr></thead><tbody>
        ${q.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${e(l.desc)}</td><td>${e(l.spec || "")}</td><td>${l.qty}</td><td>${e(l.uom)}</td><td>${m(l.unitPrice)}</td><td>${m(l.fee)}</td><td>${m(l.discount)}</td><td>${m(l.qty * l.unitPrice + l.fee - l.discount)}</td></tr>`).join("")}
        </tbody><tfoot><tr><td colspan="8" class="r">Total</td><td><b>${m(prQuoteTotal(q))}</b></td></tr></tfoot></table>
      <h2>Delivery &amp; Payment Terms</h2>
      <table class="kv"><tbody><tr><th>Delivery &amp; Payment Terms</th><td>${e(q.paymentTerms) || "—"}</td></tr>
        <tr><th>Delivery Location</th><td>${e(q.deliveryLocation) || "—"}</td></tr><tr><th>Delivery Duration</th><td>${e(q.deliveryDuration) || "—"}</td></tr></tbody></table>
      <h2>Approval &amp; Authorization</h2>
      <div class="sgs two"><div class="sg"><div class="sg-line"></div><b>Supplier</b><div>Name: ${e(q.signName || "______________")}</div><div>Date: ${q.signDate ? d(q.signDate) : "______________"}</div></div>
        <div class="sg"><div class="sg-line"></div><b>KII — Received by</b><div>Name: ${e(q.receivedBy)}</div><div>Date: ${d(q.receivedDate)}</div></div></div>`;
  } else if (kind === "po") {
    if (!po) return;
    title = "Purchase Order"; no = po.no;
    body = `
      <table class="kv two"><tbody>
        <tr><th>PO Number</th><td><b>${e(po.no)}</b></td><th>Date</th><td>${d(po.date)}</td></tr>
        <tr><th>Reference RFQ</th><td>${e(po.rfqNo)}</td><th>Reference PR</th><td>${e(pr.no)}</td></tr></tbody></table>
      <div class="cols">
        ${box("Buyer Information", [["Buyer Name", e(po.buyer.name)], ["Buyer Address", e(po.buyer.address)], ["Contact Number", e(po.buyer.phone)], ["Email Address", e(po.buyer.email)], ["Date of Request", d(po.buyer.requestDate)]])}
        ${box("Supplier Information", [["Supplier Name", e(po.supplier.name)], ["Supplier Address", e(po.supplier.address)], ["Contact Number", e(po.supplier.phone)], ["Email Address", e(po.supplier.email)], ["Expected Delivery Date", d(po.supplier.delivery)]])}</div>
      ${box("Ship To", [["Receiving Area Name", e(po.shipTo.area)], ["Receiver Name", e(po.shipTo.name)], ["Receiver Address", e(po.shipTo.address)], ["Contact Number", e(po.shipTo.phone)], ["Email Address", e(po.shipTo.email)], ["Incoterms", e(po.shipTo.incoterms)]])}
      <h2>Item / Services Information</h2>
      <table class="it"><thead><tr><th>Item No</th><th>Item / Services Name</th><th>Detail &amp; Specification</th><th>Unit of Measure</th><th>Quantity</th><th>Unit Price (${cur})</th><th>Total (${cur})</th><th>Note</th></tr></thead><tbody>
        ${lines.map((l, i) => `<tr><td>${i + 1}</td><td>${e(l.desc)}</td><td>${e(l.spec || "")}</td><td>${e(l.uom)}</td><td>${l.qty}</td><td>${m(l.unitPrice)}</td><td>${m(l.qty * l.unitPrice)}</td><td>${e(po.notes?.[i] || "")}</td></tr>`).join("")}</tbody></table>
      <div class="cols">
        <div><h2>Terms and Conditions</h2><div class="note pre">${e(po.terms || "—")}</div><h2>Additional Note</h2><div class="note pre">${e(po.note || "—")}</div></div>
        <table class="kv tot"><tbody><tr><th>Total</th><td>${m(pt.sub)}</td></tr><tr><th>Taxes</th><td>${m(pt.tax)}</td></tr><tr><th>Delivery Fee</th><td>${m(pt.fee)}</td></tr>
          <tr><th>Discount</th><td>− ${m(pt.disc)}</td></tr><tr class="g"><th>Total After Discount</th><td>${m(pt.total)}</td></tr></tbody></table></div>
      <h2>Approval &amp; Authentication</h2>
      <div class="sgs">${prPoSigList(pr).map(([l, s]) => sig(l, s, l === "Supplier" ? po.supplier.name : "")).join("")}</div>`;
  } else {
    const rc = pr.receipt;
    title = "Reception & Control Form"; no = po?.no || pr.no;
    body = `
      <h2>General Detail</h2>
      <table class="kv two"><tbody>
        <tr><th>PO Number</th><td>${e(po?.no || "Not required")}</td><th>PR Number</th><td><b>${e(pr.no)}</b></td></tr>
        <tr><th>Delivery Date</th><td>${d(rc?.date || pr.delivery?.date)}</td><th>Total Fee</th><td><b>${m(prTotal(pr))}</b></td></tr>
        <tr><th>Supplier</th><td>${e(acc?.supplier || "—")}</td><th>Applicant / Project</th><td>${e(prProject(pr))}</td></tr></tbody></table>
      <h2>Purchase Detail</h2>
      <table class="it"><thead><tr><th>#</th><th>Item / Service Name</th><th>Description</th><th>QTY</th><th>QTY Received</th><th>Unit of Measure</th><th>Unit Price (${cur})</th><th>Total (${cur})</th><th>Condition</th></tr></thead><tbody>
        ${lines.map((l, i) => `<tr><td>${i + 1}</td><td>${e(l.desc)}</td><td>${e(l.spec || "")}</td><td>${l.qty}</td><td>${rc ? e(rc.lines[i]?.received ?? "") : ""}</td><td>${e(l.uom)}</td><td>${m(l.unitPrice)}</td><td>${m(l.qty * l.unitPrice)}</td><td>${rc ? e(rc.lines[i]?.condition || "") : ""}</td></tr>`).join("")}</tbody></table>
      <table class="kv two" style="margin-top:14px"><tbody><tr><th>Controller Name</th><td>${e(rc?.controller || pr.delivery?.by || "")}</td><th>Receiver Name</th><td>${e(rc?.receiver || pr.requester.name)}</td></tr></tbody></table>
      <div class="note"><b>Comment:</b> ${e(rc?.comment || "—")}</div>
      <h2>Signatures</h2>
      <div class="sgs two">${sig("Controller", pr.delivery?.sig, rc?.controller)}${sig("Receiver", rc?.sig, rc?.receiver)}</div>`;
  }

  const w = window.open("", "_blank");
  if (!w) return alert("Please allow pop-ups to print the document.");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${e(no)} — ${title} — KII</title><style>
    *{box-sizing:border-box}body{font:12.5px/1.5 'Segoe UI',Arial,sans-serif;color:#14202b;margin:0;padding:30px 38px;max-width:1000px;margin:auto}
    .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #166e4a;padding-bottom:12px}
    .hd img{height:58px}.hd .ti{text-align:right}.hd h1{font-size:1.45rem;margin:0;color:#0a2c1e;text-transform:uppercase;letter-spacing:1px}
    .hd .no{font-size:.95rem;color:#166e4a;font-weight:700}.hd .org{font-size:.72rem;color:#64748b}
    h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.8px;color:#fff;background:#166e4a;padding:5px 10px;margin:16px 0 0;border-radius:3px 3px 0 0}
    h3{font-size:.76rem;text-transform:uppercase;letter-spacing:.6px;color:#0a2c1e;background:#e3f1ea;padding:5px 10px;margin:0}
    table{width:100%;border-collapse:collapse}td,th{border:1px solid #cfd8e0;padding:6px 9px;text-align:left;vertical-align:top}
    .kv th{background:#f3f8f5;width:170px;color:#0a2c1e;font-weight:600}.kv.two th{width:17%}.kv.two td{width:33%}
    .kv{margin-top:${kind === "pr" || kind === "rc" ? "0" : "14px"}}h2+.kv,.bx .kv{margin-top:0}
    .it th{background:#f3f8f5;color:#0a2c1e;font-size:.72rem;text-transform:uppercase}.it tfoot td{background:#f3f8f5}.r{text-align:right;font-weight:600}
    .cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;align-items:start}.cols h2:first-child{margin-top:0}.bx{margin-top:14px}.cols .bx{margin-top:0}
    .tot{margin-top:0}.tot th{width:55%}.tot td{text-align:right}.tot .g th,.tot .g td{background:#166e4a;color:#fff;font-weight:800;font-size:.95rem}
    .types{border:1px solid #cfd8e0;border-top:0;padding:10px;display:flex;gap:22px;flex-wrap:wrap}.types i{font-style:normal;font-size:1.1rem}
    .note{border:1px solid #cfd8e0;border-top:0;padding:8px 10px;min-height:34px}.note+.note{border-top:0}.pre{white-space:pre-wrap}
    .sgs{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;border:1px solid #cfd8e0;border-top:0;padding:14px 12px}.sgs.two{grid-template-columns:1fr 1fr}
    .sg{font-size:.74rem;color:#475569}.sg b{display:block;color:#0a2c1e;font-size:.78rem}
    .sg-line{height:46px;border-bottom:1.5px solid #14202b;margin-bottom:5px;display:flex;align-items:flex-end;padding-bottom:2px}
    .sg-name{font:italic 1.35rem 'Segoe Script','Brush Script MT','Lucida Handwriting',cursive;color:#0b3d91;white-space:nowrap;overflow:hidden}
    .sg-e{color:#166e4a;font-weight:600}.fine{font-size:.7rem;color:#64748b;margin-top:6px}
    .foot{margin-top:26px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:.68rem;color:#94a3b8;text-align:center}
    .printbtn{margin:20px 0 0;padding:10px 26px;background:#166e4a;color:#fff;border:0;border-radius:8px;font-size:.9rem;cursor:pointer}
    @media print{body{padding:8mm}.printbtn{display:none}h2,h3,.kv th,.it th,.tot .g th,.tot .g td{-webkit-print-color-adjust:exact;print-color-adjust:exact}.sgs,.it tr{break-inside:avoid}}
  </style></head><body>
    <div class="hd"><img src="${location.origin}/asset/kii_logocl.png" alt="KII">
      <div class="ti"><h1>${title}</h1><div class="no">${e(no)}</div><div class="org">Kurdistan Innovation Institute · Procurement</div></div></div>
    ${body}
    <div class="foot">Kurdistan Innovation Institute · ${title} ${e(no)} · issued through the KII Application Management System · printed ${amsFmtDateTime(new Date().toISOString())}</div>
    <button class="printbtn" onclick="window.print()">Print / Save as PDF</button>
  </body></html>`);
  w.document.close();
}
