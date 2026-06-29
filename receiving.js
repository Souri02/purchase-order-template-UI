// ============================================================
// Countera — PO Receiving (web-app style). Static demo.
// Role-restricted: a "receiving" user only sees the receiving
// interface (settings & other modules hidden). Includes the real
// PO Bar Code Scanning layout, manager approval (separate system),
// draft auto-save, and a phone preview.
// ============================================================

// Current signed-in role for this demo. Receiving staff are restricted.
const ROLE = "receiving";

// Each distributor (vendor) ships its own short PO. For this demo every vendor
// has exactly 2 products, and the product set varies per vendor.
const PO_BY_VENDOR = {
  "Sunrise Food Distribution": {
    ref: "PO-SUNRISE-FOOD-DIST-06222026-01",
    distributor: "Sunrise Food Distribution",
    tempRange: { min: 0, max: 5 }, // cold-chain °C (dairy)
    lines: [
      { product: "Crystal Butter Milk 946ml", sku: "AMCRYSTALCCLFBM946M04", upc: "070910002104", uom: "EACH", unitsPerUom: 1, ordered: 6, received: 0, unitCost: 2.45 },
      { product: "Crystal Milk 946ml", sku: "100000070611", upc: "070910002098", uom: "EACH", unitsPerUom: 1, ordered: 4, received: 0, unitCost: 2.10 },
    ],
  },
  "PepsiCo Distribution": {
    ref: "PO-PEPSICO-DIST-06222026-02",
    distributor: "PepsiCo Distribution",
    tempRange: { min: 2, max: 8 },
    lines: [
      { product: "Pepsi Cola 24 x 355ml Can", sku: "AMPEPSICOLA24X355C11", upc: "012000001291", uom: "CASE", unitsPerUom: 24, ordered: 5, received: 0, unitCost: 7.99 },
      { product: "Gatorade Cool Blue 1L", sku: "AMGATORADECB1L42", upc: "052000338218", uom: "EACH", unitsPerUom: 1, ordered: 8, received: 0, unitCost: 1.79 },
    ],
  },
  "Coca-Cola Bottling Co.": {
    ref: "PO-COCACOLA-BOTT-06222026-03",
    distributor: "Coca-Cola Bottling Co.",
    tempRange: { min: 2, max: 8 },
    lines: [
      { product: "Coca-Cola Classic 2L", sku: "AMCOCACOLACL2L77", upc: "049000050103", uom: "EACH", unitsPerUom: 1, ordered: 6, received: 0, unitCost: 2.25 },
      { product: "Sprite Lemon-Lime 24 x 355ml Can", sku: "AMSPRITELL24X355C30", upc: "049000028928", uom: "CASE", unitsPerUom: 24, ordered: 4, received: 0, unitCost: 8.49 },
    ],
  },
  "Sysco Foods": {
    ref: "PO-SYSCO-FOODS-06222026-04",
    distributor: "Sysco Foods",
    tempRange: { min: 0, max: 4 },
    lines: [
      { product: "Sysco Classic Heavy Cream 1.89L", sku: "AMSYSCOHC1.89L18", upc: "074865102113", uom: "EACH", unitsPerUom: 1, ordered: 5, received: 0, unitCost: 6.30 },
      { product: "Sysco Imperial Shredded Mozzarella 2.27kg", sku: "AMSYSCOSM2.27KG64", upc: "074865224099", uom: "BAG", unitsPerUom: 1, ordered: 3, received: 0, unitCost: 11.75 },
    ],
  },
};

const DISTRIBUTORS = Object.keys(PO_BY_VENDOR);

// Active PO — points at the selected vendor's PO (defaults to the first vendor).
let RECEIVING_PO = PO_BY_VENDOR[DISTRIBUTORS[0]];

const DRAFT_KEY = "countera_receiving_draft_v3";
const STEP_ORDER = ["distributor", "temperature", "pallets", "products"];

const state = {
  distributor: "",
  locked: false,
  tempPhoto: null,
  pallets: 1,
  scanned: [], // { id, product, sku, upc, uom, unitsPerUom, qty, expected, received, unitCost, lot, batch, expiry, scannedTime, scanBy }
  approval: { status: "none", temp: null, requestedAt: null },
  missing: [], // UPCs flagged as not delivered (awaiting / approved by Procurement)
  procApproval: { status: "none", requestedAt: null }, // none | pending | approved
};
let uid = 0;
let staged = null; // product line identified by a scan, awaiting Lot # + Expiry

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const IS_PHONE = params.get("phone") === "1";

// ---------------- Views / sections / steps ----------------
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
}
function showSection(name) {
  document.querySelectorAll(".section").forEach((s) => {
    const on = s.id === "section-" + name;
    s.classList.toggle("active", on);
    s.hidden = !on;
  });
  setActiveNav(name === "manager" ? "manager" : name === "procurement" ? "procurement" : "flow");
}
function setStep(name) {
  document.querySelectorAll("#section-flow .panel").forEach((p) => { p.hidden = p.dataset.panel !== name; });
  const idx = STEP_ORDER.indexOf(name);
  document.querySelectorAll("#stepper .step").forEach((st) => {
    const i = STEP_ORDER.indexOf(st.dataset.for);
    st.classList.remove("active", "done");
    if (name === "success") st.classList.add("done");
    else if (idx >= 0) { if (i < idx) st.classList.add("done"); else if (i === idx) st.classList.add("active"); }
  });
  if (name === "products") setSidebarActive("products");
  else if (STEP_ORDER.includes(name)) setSidebarActive("distributor");
}
function setActiveNav(kind) {
  document.querySelectorAll(".sidebar .nav-item").forEach((n) => n.classList.remove("active"));
  if (kind === "manager") { const m = document.querySelector('[data-nav="manager"]'); if (m) m.classList.add("active"); }
  else if (kind === "procurement") { const p = document.querySelector('[data-nav="procurement"]'); if (p) p.classList.add("active"); }
  else setSidebarActive("distributor");
}
function setSidebarActive(step) {
  document.querySelectorAll('.sidebar [data-nav="flow"]').forEach((n) => {
    n.classList.toggle("active", n.dataset.step === step);
  });
}

// ---------------- Toast ----------------
let toastT = null;
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 2400);
}

// ---------------- Access control ----------------
function applyRole() {
  if (ROLE !== "receiving") return;
  document.querySelectorAll("[data-restricted]").forEach((el) => { el.style.display = "none"; });
}

// ---------------- Login / dashboard ----------------
$("loginForm").addEventListener("submit", (e) => { e.preventDefault(); showView("dashboard"); });
$("dashLogout").addEventListener("click", () => showView("login"));
$("appSignout").addEventListener("click", () => showView("login"));

document.querySelectorAll(".tile").forEach((t) => {
  t.addEventListener("click", () => {
    if (t.dataset.app === "receiving") enterReceiving();
    else toast("This module isn't part of the receiving demo.");
  });
});

function enterReceiving() {
  showView("app");
  showSection("flow");
  if (state.scanned.length || state.pallets > 1) setStep("products");
  else if (state.approval.status === "pending" || state.tempPhoto) setStep("temperature");
  else setStep("distributor");
}

// sidebar open/close (mobile)
function setSidebar(open) {
  $("sidebar").classList.toggle("open", open);
  $("sidebarBackdrop").classList.toggle("show", open);
}
function closeSidebar() { setSidebar(false); }

// sidebar navigation
document.querySelectorAll(".sidebar .nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    closeSidebar(); // collapse the drawer after picking an item (mobile)
    const nav = item.dataset.nav;
    if (nav === "dashboard") return showView("dashboard");
    if (nav === "soon") return toast("This module isn't part of the receiving demo.");
    if (nav === "manager") { showSection("manager"); renderManagerConsole(); return; }
    if (nav === "procurement") { showSection("procurement"); renderProcurementConsole(); return; }
    if (nav === "flow") { showSection("flow"); setStep(item.dataset.step || "distributor"); }
  });
});
$("hamburger").addEventListener("click", () => setSidebar(!$("sidebar").classList.contains("open")));
$("sidebarBackdrop").addEventListener("click", closeSidebar);
document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => setStep(b.dataset.back)));

// ---------------- 1. Distributor + lock ----------------
function initDistributors() {
  const sel = $("recvDistributor");
  sel.innerHTML = '<option value="">Select distributor</option>';
  DISTRIBUTORS.forEach((d) => { const o = document.createElement("option"); o.textContent = d; sel.appendChild(o); });
  sel.value = RECEIVING_PO.distributor;
}
// Switch the active PO to the chosen vendor and refresh everything tied to it.
function setVendor(name, opts = {}) {
  const po = PO_BY_VENDOR[name];
  if (!po) return;
  const changed = RECEIVING_PO !== po;
  RECEIVING_PO = po;
  if (changed && opts.resetItems) { state.scanned = []; state.missing = []; state.procApproval = { status: "none", requestedAt: null }; uid = 0; staged = null; }
  $("rangeLabel").textContent = `${RECEIVING_PO.tempRange.min}–${RECEIVING_PO.tempRange.max} °C`;
  renderReceiving();
}

$("lockContinue").addEventListener("click", () => {
  const sel = $("recvDistributor");
  if (!sel.value) return toast("Select a distributor first.");
  state.distributor = sel.value;
  state.locked = true;
  setVendor(sel.value, { resetItems: true });
  $("lockCard").classList.add("locked");
  saveDraft();
  setStep("temperature");
});

// ---------------- 2. Temperature ----------------
$("rangeLabel").textContent = `${RECEIVING_PO.tempRange.min}–${RECEIVING_PO.tempRange.max} °C`;
$("captureBtn").addEventListener("click", () => { $("camOverlay").hidden = false; });
$("camCancel").addEventListener("click", () => { $("camOverlay").hidden = true; });
$("camTake").addEventListener("click", () => {
  $("camOverlay").hidden = true;
  const stamp = new Date().toLocaleString();
  state.tempPhoto = { stamp, value: null };
  $("camShot").innerHTML = `<div class="cam-photo"><span class="gauge">🌡️</span><span class="cam-stamp">📍 Auto-timestamped · ${stamp}</span></div>`;
  $("tempEntry").hidden = false;
  $("captureBtn").textContent = "📷 Retake photo";
  saveDraft();
});
$("tempCheckBtn").addEventListener("click", () => {
  const v = parseFloat($("tempValue").value);
  if (Number.isNaN(v)) return toast("Enter the measured temperature.");
  if (!state.tempPhoto) return toast("Capture a temperature photo first.");
  state.tempPhoto.value = v;
  const { min, max } = RECEIVING_PO.tempRange;
  const inRange = v >= min && v <= max;
  if (inRange) {
    state.approval = { status: "none", temp: null, requestedAt: null };
    $("approvalCard").hidden = true; $("pendingCard").hidden = true;
    goToPallets();
  } else {
    $("approvalCard").hidden = false; $("pendingCard").hidden = true;
  }
  renderManagerConsole();
  saveDraft();
});
$("notifyMgr").addEventListener("click", () => {
  state.approval = { status: "pending", temp: state.tempPhoto ? state.tempPhoto.value : null, requestedAt: new Date().toLocaleString() };
  $("approvalCard").hidden = true; $("pendingCard").hidden = false;
  $("pendingMsg").textContent = `Request sent to the store manager at ${state.approval.requestedAt}. Waiting for a decision…`;
  renderManagerConsole();
  saveDraft();
  toast("Request sent to manager");
});
$("returnRestart").addEventListener("click", () => resetAll(true));

// demo entry points to the manager system (separate login)
$("mgrOpenDemo").addEventListener("click", () => { showSection("manager"); renderManagerConsole(); });
$("mgrBackDemo").addEventListener("click", () => { showSection("flow"); setStep("temperature"); });
$("procOpenDemo").addEventListener("click", () => { showSection("procurement"); renderProcurementConsole(); });
$("procBackDemo").addEventListener("click", () => { showSection("flow"); setStep("products"); });

function goToPallets() {
  const t = state.tempPhoto;
  $("tempBadge").textContent = `✓ Temperature ${t.value}°C verified · photo timestamped ${t.stamp}`;
  setStep("pallets");
}

// ---------------- Manager system ----------------
function renderManagerConsole() {
  const empty = $("mcEmpty");
  const list = $("mcRequests");
  const badge = $("mgrBadge");
  list.innerHTML = "";
  const a = state.approval;
  const pending = a && a.status === "pending";
  if (badge) badge.hidden = !pending;
  if (!a || a.status === "none") { empty.hidden = false; return; }
  empty.hidden = true;

  const { min, max } = RECEIVING_PO.tempRange;
  const card = document.createElement("div");
  card.className = "mc-req";
  let inner = `
    <div class="mc-req-title">⚠️ Temperature exception · ${RECEIVING_PO.ref}</div>
    <div class="mc-req-line">${state.distributor || RECEIVING_PO.distributor}</div>
    <div class="mc-req-line warn">Measured ${a.temp}°C · allowed ${min}–${max}°C</div>
    <div class="mc-req-meta">Requested by Fremont dock · ${a.requestedAt || ""}</div>`;
  if (pending) {
    inner += `<div class="mc-actions"><button class="btn btn-ok" id="mcApprove">Approve</button><button class="btn btn-danger" id="mcReject">Reject</button></div>`;
    card.innerHTML = inner; list.appendChild(card);
    $("mcApprove").onclick = () => managerDecide("approved");
    $("mcReject").onclick = () => managerDecide("rejected");
  } else {
    const ok = a.status === "approved";
    inner += `<div class="mc-resolved ${ok ? "ok" : "bad"}">${ok ? "✓ Approved — delivery accepted" : "✕ Rejected — return to vendor"}</div>`;
    card.innerHTML = inner; list.appendChild(card);
  }
}
function managerDecide(decision) {
  state.approval.status = decision;
  renderManagerConsole();
  saveDraft();
  $("pendingCard").hidden = true;
  showSection("flow");
  if (decision === "approved") { toast("Manager approved — continue receiving"); goToPallets(); }
  else { toast("Manager rejected — return to vendor"); setStep("return"); }
}

// ---------------- 3. Pallets ----------------
function renderPallets() { $("palletCount").textContent = state.pallets; }
$("palMinus").addEventListener("click", () => { state.pallets = Math.max(1, state.pallets - 1); renderPallets(); saveDraft(); });
$("palPlus").addEventListener("click", () => { state.pallets += 1; renderPallets(); saveDraft(); });
$("palletContinue").addEventListener("click", () => { setStep("products"); renderReceiving(); });

// ---------------- 4. PO Bar Code Scanning ----------------
function scannedQtyForLine(upc) {
  return state.scanned.filter((s) => s.upc === upc).reduce((sum, s) => sum + (s.qty || 0), 0);
}
function distinctScannedCount() {
  return new Set(state.scanned.map((s) => s.upc)).size;
}
function updateCounters() {
  const total = RECEIVING_PO.lines.length;
  const scannedDistinct = distinctScannedCount();
  $("cntTotal").textContent = total;
  $("cntScanned").textContent = scannedDistinct;
  $("cntStill").textContent = Math.max(0, total - scannedDistinct);
}

// Units still outstanding for a line (ordered minus prior receipts minus this session's scans).
function remainingForLine(ln) {
  return Math.max(0, ln.ordered - (ln.received || 0) - scannedQtyForLine(ln.upc));
}
function isFlaggedMissing(upc) { return state.missing.includes(upc); }
// Lines with an unresolved shortfall (still missing AND not yet reported) — these block posting.
function unresolvedLines() {
  return RECEIVING_PO.lines.filter((ln) => remainingForLine(ln) > 0 && !isFlaggedMissing(ln.upc));
}
// Lines reported as not delivered (flagged by receiving staff).
function reportedLines() {
  return RECEIVING_PO.lines.filter((ln) => remainingForLine(ln) > 0 && isFlaggedMissing(ln.upc));
}
function deliveredStatus(ln) {
  return (ln.received || 0) + scannedQtyForLine(ln.upc) === 0 ? "Not delivered" : "Short delivery";
}
function procIsApproved() { return state.procApproval.status === "approved"; }
function procIsPending() { return state.procApproval.status === "pending"; }

// Submit the missing-product report to Procurement for approval.
function submitProcReport() {
  if (reportedLines().length === 0) {
    state.procApproval = { status: "none", requestedAt: null };
    renderProcurementConsole();
    return;
  }
  if (state.procApproval.status === "approved") return;
  if (state.procApproval.status !== "pending") {
    state.procApproval = { status: "pending", requestedAt: new Date().toLocaleString() };
  }
  renderProcurementConsole();
}

// Render the "Outstanding" + pending/approved missing sections and gate the Post button.
function renderMissing() {
  const outstanding = unresolvedLines();
  const reported = reportedLines();
  const card = $("missingCard");
  const list = $("missingList");
  const pendingCard = $("procPendingCard");
  const repCard = $("reportedCard");
  const repList = $("reportedList");
  const allOk = $("allReceived");
  const gate = $("postGate");
  const post = $("btnPost");
  const approved = procIsApproved();
  const pending = procIsPending();
  const hasActivity = state.scanned.length > 0 || reported.length > 0;

  // Outstanding (still need to scan or flag)
  $("missCount").textContent = outstanding.length;
  list.innerHTML = "";
  outstanding.forEach((ln) => {
    const need = remainingForLine(ln);
    const li = document.createElement("li");
    li.className = "miss-item";
    li.innerHTML = `
      <div class="miss-info">
        <b class="miss-name">${ln.product}</b>
        <span class="miss-meta">SKU ${ln.sku} · UPC ${ln.upc}</span>
      </div>
      <span class="miss-need">${need} of ${ln.ordered} ${deliveredStatus(ln) === "Not delivered" ? "not delivered" : "missing"}</span>
      <span class="miss-acts">
        <button type="button" class="btn btn-primary soft miss-pick" data-upc="${ln.upc}">Select to scan</button>
        <button type="button" class="btn btn-warn miss-flag" data-upc="${ln.upc}">Report not delivered</button>
      </span>`;
    list.appendChild(li);
  });
  list.querySelectorAll(".miss-pick").forEach((b) => { b.onclick = () => selectMissing(b.dataset.upc); });
  list.querySelectorAll(".miss-flag").forEach((b) => { b.onclick = () => flagMissing(b.dataset.upc); });
  card.hidden = outstanding.length === 0;

  // Pending procurement approval (hide product details until approved)
  if (reported.length > 0 && pending) {
    pendingCard.hidden = false;
    $("procPendingMsg").textContent =
      `Missing-product report for ${reported.length} product(s) sent to the procurement lead at ${state.procApproval.requestedAt || "just now"}. Waiting for approval…`;
    const pendList = $("procPendingList");
    pendList.innerHTML = "";
    reported.forEach((ln) => {
      const need = remainingForLine(ln);
      const li = document.createElement("li");
      li.className = "rep-item";
      li.innerHTML = `
        <div class="miss-info">
          <b class="miss-name">${ln.product}</b>
          <span class="miss-meta">${deliveredStatus(ln)} · ${need} of ${ln.ordered} short</span>
        </div>
        <button type="button" class="btn btn-ghost rep-undo" data-upc="${ln.upc}">Undo</button>`;
      pendList.appendChild(li);
    });
    pendList.querySelectorAll(".rep-undo").forEach((b) => { b.onclick = () => unflagMissing(b.dataset.upc); });
  } else {
    pendingCard.hidden = true;
  }

  // Confirmed missing — only visible after procurement approval
  repCard.hidden = !(reported.length > 0 && approved);
  if (!repCard.hidden) {
    const n = reported.length;
    $("repCount").textContent = n;
    $("repTitle").textContent = n === 1 ? "1 product missing from PO" : `${n} products missing from PO`;
    repList.innerHTML = "";
    reported.forEach((ln) => {
      const need = remainingForLine(ln);
      const li = document.createElement("li");
      li.className = "rep-item";
      li.innerHTML = `
        <div class="miss-info">
          <b class="miss-name">${ln.product}</b>
          <span class="miss-meta">${deliveredStatus(ln)} · ${need} of ${ln.ordered} short · → next PO for ${state.distributor || RECEIVING_PO.distributor}</span>
        </div>`;
      repList.appendChild(li);
    });
  }

  // Post gate: nothing unresolved; if missing reported, procurement must approve first.
  const procBlocked = reported.length > 0 && !approved;
  const blocked = outstanding.length > 0 || procBlocked;
  post.disabled = blocked || !hasActivity;
  if (outstanding.length > 0) {
    gate.hidden = false;
    gate.textContent = `${outstanding.length} product(s) still outstanding — receive or report each before posting.`;
  } else if (procBlocked) {
    gate.hidden = false;
    gate.textContent = "Missing-product report pending procurement approval — post once approved.";
  } else {
    gate.hidden = true;
  }
  allOk.hidden = blocked || !hasActivity;
  if (!allOk.hidden) {
    $("allReceivedMsg").textContent = reported.length
      ? `Ready to post — ${reported.length} missing product(s) approved by Procurement for the next PO.`
      : "All ordered products received — you can post the delivery.";
  }
}

// Pick a missing product → stage it in the scan form and jump to scanning.
function selectMissing(upc) {
  const ln = RECEIVING_PO.lines.find((l) => l.upc === upc);
  if (!ln) return;
  clearScanForm();
  stageLine(ln);
  $("scanQty").value = remainingForLine(ln) || 1;
  $("scanLot").focus();
  document.querySelector('#section-flow .scan-block')?.scrollIntoView({ behavior: "smooth", block: "start" });
  toast(`Selected ${ln.product} — enter Lot # & Expiry, then Scan.`);
}
// Flag a product as not delivered and send the report to Procurement for approval.
function flagMissing(upc) {
  if (!state.missing.includes(upc)) state.missing.push(upc);
  submitProcReport();
  const ln = RECEIVING_PO.lines.find((l) => l.upc === upc);
  renderScanned();
  saveDraft();
  toast(`${ln ? ln.product : "Product"} reported — sent to procurement lead for approval.`);
}
function unflagMissing(upc) {
  if (state.procApproval.status === "approved") return;
  state.missing = state.missing.filter((u) => u !== upc);
  if (state.missing.length === 0) state.procApproval = { status: "none", requestedAt: null };
  renderScanned();
  renderProcurementConsole();
  saveDraft();
}

// ---------------- Procurement lead system ----------------
function renderProcurementConsole() {
  const empty = $("pcEmpty");
  const list = $("pcRequests");
  if (!empty || !list) return;
  list.innerHTML = "";
  const reported = reportedLines();
  const pending = procIsPending() && reported.length > 0;
  if (!pending) { empty.hidden = false; return; }
  empty.hidden = true;

  const vendor = state.distributor || RECEIVING_PO.distributor;
  const card = document.createElement("div");
  card.className = "mc-req";
  let inner = `
    <div class="mc-req-title">📦 Missing products · ${RECEIVING_PO.ref}</div>
    <div class="mc-req-line">${vendor}</div>
    <div class="mc-req-line warn">${reported.length} product(s) not fully delivered</div>
    <div class="mc-req-meta">Reported by receiving staff · ${state.procApproval.requestedAt || ""}</div>
    <ul class="pc-lines">`;
  reported.forEach((ln) => {
    const need = remainingForLine(ln);
    inner += `<li><b>${ln.product}</b> — ${deliveredStatus(ln)} · ${need} of ${ln.ordered} short</li>`;
  });
  inner += `</ul><div class="mc-actions"><button class="btn btn-ok" id="pcApprove">Approve missing report</button></div>`;
  card.innerHTML = inner;
  list.appendChild(card);
  $("pcApprove").onclick = () => procurementDecide();
}
function procurementDecide() {
  state.procApproval.status = "approved";
  renderProcurementConsole();
  renderScanned();
  saveDraft();
  showSection("flow");
  setStep("products");
  toast("Procurement approved — missing products confirmed for next PO.");
}

// Build the Procurement report grouped by vendor for all undelivered products.
function buildProcurementReport() {
  if (!procIsApproved()) return [];
  const vendor = state.distributor || RECEIVING_PO.distributor;
  return reportedLines().map((ln) => ({
    vendor,
    product: ln.product, sku: ln.sku, upc: ln.upc,
    ordered: ln.ordered,
    received: (ln.received || 0) + scannedQtyForLine(ln.upc),
    missing: remainingForLine(ln),
    status: deliveredStatus(ln),
  }));
}
function renderProcurementReport() {
  const rows = buildProcurementReport();
  const card = $("procCard");
  if (rows.length === 0) { card.hidden = true; return; }
  card.hidden = false;
  const vendors = new Set(rows.map((r) => r.vendor));
  $("procSummary").textContent =
    `${rows.length} product(s) across ${vendors.size} vendor(s) were not fully delivered and have been queued for the next PO.`;
  const body = $("procBody");
  body.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.vendor}</td>
      <td class="pl-name">${r.product}</td>
      <td><span class="pl-sku">${r.sku}</span></td>
      <td>${r.upc}</td>
      <td class="ta-c">${r.ordered}</td>
      <td class="ta-c">${r.received}</td>
      <td class="ta-c"><b>${r.missing}</b></td>
      <td><span class="proc-status ${r.status === "Not delivered" ? "nd" : "sd"}">${r.status}</span></td>
      <td>↪ Next PO · ${r.vendor}</td>`;
    body.appendChild(tr);
  });
}

function renderPOLines(filter = "") {
  const body = $("poLines");
  const q = filter.trim().toLowerCase();
  body.innerHTML = "";
  RECEIVING_PO.lines.forEach((ln) => {
    if (q && !(ln.product.toLowerCase().includes(q) || ln.sku.toLowerCase().includes(q) || ln.upc.includes(q))) return;
    const scanned = scannedQtyForLine(ln.upc);
    const done = scanned >= ln.ordered && scanned > 0;
    const tr = document.createElement("tr");
    if (done) tr.className = "row-done";
    tr.innerHTML = `
      <td class="pl-name">${ln.product}</td>
      <td><span class="pl-sku">${ln.sku}</span></td>
      <td>${ln.upc}</td>
      <td>${ln.uom}</td>
      <td class="ta-c">${ln.unitsPerUom}</td>
      <td class="ta-c">${ln.ordered}</td>
      <td class="ta-c">${ln.received}</td>
      <td class="ta-c">${scanned}</td>
      <td class="ta-c">$${ln.unitCost.toFixed(2)}</td>`;
    body.appendChild(tr);
  });
}
$("poSearch").addEventListener("input", (e) => renderPOLines(e.target.value));

function matchLineByInput() {
  const upc = $("scanUPC").value.trim();
  const sku = $("scanSKU").value.trim().toLowerCase();
  if (upc) { const m = RECEIVING_PO.lines.find((l) => l.upc === upc); if (m) return m; }
  if (sku) { const m = RECEIVING_PO.lines.find((l) => l.sku.toLowerCase() === sku); if (m) return m; }
  return null;
}
function stageLine(line) {
  staged = line;
  $("scanUPC").value = line.upc;
  $("scanSKU").value = line.sku;
  const hint = $("scanHint");
  hint.textContent = `Identified: ${line.product} — enter Lot # & Expiry, then press Scan to record.`;
  hint.classList.add("ready");
  $("scanClear").hidden = false;
  $("scanBtn").textContent = "Record item";
}
function clearScanForm() {
  staged = null;
  $("scanUPC").value = ""; $("scanSKU").value = ""; $("scanLot").value = ""; $("scanExpiry").value = "";
  $("scanQty").value = "1";
  $("scanLot").classList.remove("miss"); $("scanExpiry").classList.remove("miss");
  $("scanHint").textContent = ""; $("scanHint").classList.remove("ready");
  $("scanClear").hidden = true;
  $("scanBtn").textContent = "Scan";
}

function openBarcodeScan() {
  const overlay = $("scanOverlay");
  overlay.hidden = false;
  const timer = setTimeout(() => {
    overlay.hidden = true;
    const typed = matchLineByInput();
    const line = typed || RECEIVING_PO.lines[Math.floor(Math.random() * RECEIVING_PO.lines.length)];
    stageLine(line);
  }, 1500);
  $("cancelScan").onclick = () => { clearTimeout(timer); overlay.hidden = true; };
}

$("scanCamBtn").addEventListener("click", () => { if (!staged) openBarcodeScan(); });

$("scanBtn").addEventListener("click", () => {
  if (!staged) {
    const m = matchLineByInput();
    if (m) stageLine(m);
    else openBarcodeScan();
    return;
  }
  // staged: Lot # + Expiry are mandatory before recording / before the next scan
  const lot = $("scanLot").value.trim();
  const expiry = $("scanExpiry").value;
  $("scanLot").classList.toggle("miss", !lot);
  $("scanExpiry").classList.toggle("miss", !expiry);
  if (!lot || !expiry) { toast("Lot Number and Expiration Date are required before recording."); return; }
  const qty = Math.max(1, parseInt($("scanQty").value || "1", 10));
  state.scanned.push({
    id: ++uid, product: staged.product, sku: staged.sku, upc: staged.upc, uom: staged.uom,
    unitsPerUom: staged.unitsPerUom, qty, expected: staged.ordered, received: qty,
    unitCost: staged.unitCost, lot, batch: "", expiry,
    scannedTime: new Date().toLocaleString(), scanBy: "saketh",
  });
  toast(`Recorded ${staged.product}`);
  clearScanForm();
  renderScanned();
  saveDraft();
});
$("scanClear").addEventListener("click", clearScanForm);

function renderScanned() {
  const body = $("scannedBody");
  body.innerHTML = "";
  $("scannedEmpty").classList.toggle("hide", state.scanned.length > 0);
  state.scanned.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="pl-name">${s.product}</td>
      <td><span class="pl-sku">${s.sku}</span></td>
      <td>${s.upc}</td>
      <td>${s.uom}</td>
      <td class="ta-c">${s.unitsPerUom}</td>
      <td class="ta-c">${s.qty}</td>
      <td class="ta-c">${s.expected}</td>
      <td class="ta-c">${s.received}</td>
      <td class="ta-c">$${s.unitCost.toFixed(2)}</td>
      <td>${s.lot}</td>
      <td>${s.batch || "-"}</td>
      <td>${s.expiry}</td>
      <td>${s.scannedTime}</td>
      <td>${s.scanBy}</td>
      <td class="ta-c"><span class="yes-pill">✓ Yes</span></td>
      <td class="ta-c"><button class="row-del" title="Delete &amp; re-scan" data-id="${s.id}">🗑</button></td>`;
    body.appendChild(tr);
  });
  body.querySelectorAll(".row-del").forEach((b) => {
    b.onclick = () => deleteScanned(parseInt(b.dataset.id, 10));
  });
  updateCounters();
  renderMissing();
  renderPOLines($("poSearch").value);
}
function deleteScanned(id) {
  state.scanned = state.scanned.filter((s) => s.id !== id);
  renderScanned();
  saveDraft();
}

$("btnNullQty").addEventListener("click", () => {
  if (state.scanned.length === 0) return toast("Nothing to clear.");
  state.scanned = [];
  clearScanForm();
  renderScanned();
  saveDraft();
  toast("Scanned quantities cleared.");
});
$("btnPost").addEventListener("click", () => {
  if (staged) return toast("Finish the staged item (enter Lot # + Expiry and press Record).");
  const unresolved = unresolvedLines();
  if (unresolved.length > 0) {
    renderMissing();
    document.querySelector("#missingCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return toast(`${unresolved.length} product(s) still outstanding — receive or report each before posting.`);
  }
  if (state.scanned.length === 0 && reportedLines().length === 0) {
    return toast("Scan at least one item, or report missing products, before posting.");
  }
  const reported = reportedLines();
  if (reported.length > 0 && !procIsApproved()) {
    renderMissing();
    document.querySelector("#procPendingCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return toast("Missing-product report pending procurement approval.");
  }
  const units = state.scanned.reduce((n, s) => n + s.qty, 0);
  let msg = `${RECEIVING_PO.ref}: posted ${state.scanned.length} line(s) / ${units} unit(s) across ${state.pallets} pallet(s) from ${state.distributor}.`;
  if (reported.length) msg += ` ${reported.length} product(s) reported to Procurement for the next PO.`;
  $("recvSuccessMsg").textContent = msg;
  renderProcurementReport();
  clearDraft();
  setStep("success");
});
$("recvNew").addEventListener("click", () => resetAll(true));

function renderReceiving() {
  $("poNumberLabel").textContent = RECEIVING_PO.ref;
  const bc = $("bcPO"); if (bc) bc.textContent = RECEIVING_PO.ref;
  renderPOLines("");
  renderScanned();
  updateCounters();
}

// ---------------- Draft mode ----------------
let saveTimer = null;
function saveDraft() {
  const pill = $("draftPill");
  if (pill) { pill.textContent = "Saving…"; pill.classList.add("saving"); }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const payload = {
      distributor: state.distributor, locked: state.locked, tempPhoto: state.tempPhoto,
      pallets: state.pallets, scanned: state.scanned, approval: state.approval,
      missing: state.missing, procApproval: state.procApproval,
      savedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(payload)); } catch (e) {}
    if (pill) { pill.textContent = "Draft saved"; pill.classList.remove("saving"); }
  }, 350);
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

function loadDraftIntoState(d) {
  state.distributor = d.distributor || "";
  state.locked = !!d.locked;
  state.tempPhoto = d.tempPhoto || null;
  state.pallets = d.pallets || 1;
  state.scanned = Array.isArray(d.scanned) ? d.scanned : [];
  state.approval = d.approval || { status: "none", temp: null, requestedAt: null };
  state.missing = Array.isArray(d.missing) ? d.missing : [];
  state.procApproval = d.procApproval || { status: "none", requestedAt: null };
  uid = state.scanned.reduce((m, s) => Math.max(m, s.id || 0), 0);
}
function applyLoadedUI() {
  if (state.distributor && PO_BY_VENDOR[state.distributor]) setVendor(state.distributor);
  $("recvDistributor").value = state.distributor || RECEIVING_PO.distributor;
  $("lockCard").classList.toggle("locked", state.locked);
  if (state.tempPhoto) {
    $("camShot").innerHTML = `<div class="cam-photo"><span class="gauge">🌡️</span><span class="cam-stamp">📍 Auto-timestamped · ${state.tempPhoto.stamp}</span></div>`;
    $("tempEntry").hidden = false;
    $("captureBtn").textContent = "📷 Retake photo";
    if (state.tempPhoto.value != null) {
      $("tempValue").value = state.tempPhoto.value;
      $("tempBadge").textContent = `✓ Temperature ${state.tempPhoto.value}°C verified · photo timestamped ${state.tempPhoto.stamp}`;
    }
  }
  const pending = state.approval && state.approval.status === "pending";
  $("pendingCard").hidden = !pending;
  if (pending) $("pendingMsg").textContent = `Request sent to the store manager at ${state.approval.requestedAt}. Waiting for a decision…`;
  renderPallets();
  renderReceiving();
  renderManagerConsole();
  renderProcurementConsole();
}
function offerResume() {
  let raw; try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) { return; }
  if (!raw) return;
  let d; try { d = JSON.parse(raw); } catch (e) { return; }
  if (!d || (!d.distributor && (!d.scanned || d.scanned.length === 0))) return;
  loadDraftIntoState(d);
  applyLoadedUI();
  const when = d.savedAt ? new Date(d.savedAt).toLocaleString() : "earlier";
  const slot = $("resumeSlot");
  slot.innerHTML = `<div class="resume-banner"><div><b>Saved draft found</b><small>Auto-saved ${when} · ${(d.scanned || []).length} scanned line(s). Sign in to resume.</small></div><button class="btn btn-primary" id="resumeBtn">Resume</button></div>`;
  $("resumeBtn").onclick = () => { showView("app"); showSection("flow"); enterReceiving(); slot.innerHTML = ""; };
}

// ---------------- Reset ----------------
function resetAll(toDash) {
  state.distributor = ""; state.locked = false; state.tempPhoto = null;
  state.pallets = 1; state.scanned = [];
  state.approval = { status: "none", temp: null, requestedAt: null };
  state.missing = [];
  state.procApproval = { status: "none", requestedAt: null };
  uid = 0; staged = null;
  clearDraft();
  $("recvDistributor").value = RECEIVING_PO.distributor;
  $("lockCard").classList.remove("locked");
  $("camShot").innerHTML = '<div class="cam-empty"><span class="cam-ico">📷</span><span>No photo captured yet</span></div>';
  $("tempEntry").hidden = true; $("approvalCard").hidden = true; $("pendingCard").hidden = true;
  $("tempValue").value = "";
  $("captureBtn").textContent = "📷 Capture temperature photo";
  $("poSearch").value = "";
  $("resumeSlot").innerHTML = "";
  $("procCard").hidden = true;
  $("procPendingCard").hidden = true;
  clearScanForm();
  renderPallets(); renderScanned(); renderManagerConsole(); renderProcurementConsole();
  setStep("distributor");
  if (toDash) { showView("dashboard"); showSection("flow"); }
}

// ---------------- Phone preview ----------------
function initPhonePreview() {
  if (IS_PHONE) { document.body.classList.add("is-phone"); return; }
  const toggle = $("phoneToggle");
  const overlay = $("phoneOverlay");
  const frame = $("phoneFrame");
  toggle.addEventListener("click", () => {
    frame.src = "receiving.html?phone=1"; // reload fresh each open
    overlay.hidden = false;
  });
  $("phoneClose").addEventListener("click", () => { overlay.hidden = true; });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.hidden = true; });
}

// ---------------- Init ----------------
applyRole();
initDistributors();
renderPallets();
renderManagerConsole();
renderProcurementConsole();
setStep("distributor");
renderReceiving();
offerResume();
initPhonePreview();

// Optional deep links: #dashboard, #app, #app-products, #manager
(function deepLink() {
  const h = (location.hash || "").replace("#", "");
  if (!h) return;
  if (h === "dashboard") showView("dashboard");
  else if (h === "app") { showView("app"); showSection("flow"); setStep("distributor"); }
  else if (h === "app-products") { showView("app"); showSection("flow"); renderReceiving(); setStep("products"); }
  else if (h === "manager") { showView("app"); showSection("manager"); renderManagerConsole(); }
  else if (h === "procurement") { showView("app"); showSection("procurement"); renderProcurementConsole(); }
})();
