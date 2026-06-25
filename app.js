// ---------------- Screen navigation ----------------
function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.toggle("active", s.dataset.screen === name);
  });
}

document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  showScreen("dashboard"); // stable session, lands on home
});

// Single-click straight into the PO screen (no sidebar)
document.getElementById("openPO").addEventListener("click", () => {
  showScreen("po");
});

document.querySelectorAll("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => showScreen(btn.dataset.back));
});

// ---------------- Ship-to (store access) ----------------
function initShipTo() {
  const sel = document.getElementById("shipTo");
  const note = document.getElementById("shipNote");
  sel.innerHTML = "";

  if (USER_PROFILE.multiStoreAccess && USER_PROFILE.accessibleStores.length > 1) {
    USER_PROFILE.accessibleStores.forEach((store) => {
      const opt = document.createElement("option");
      opt.textContent = store;
      sel.appendChild(opt);
    });
    sel.value = USER_PROFILE.homeStore;
    note.textContent = "Multi-store access · select destination store";
  } else {
    const opt = document.createElement("option");
    opt.textContent = USER_PROFILE.homeStore;
    sel.appendChild(opt);
    sel.value = USER_PROFILE.homeStore;
    sel.disabled = true;
    note.textContent = "Defaulted to your store";
  }
}

// Default delivery date = today + 3 days
function initDate() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  document.getElementById("deliveryDate").value = d.toISOString().slice(0, 10);
}

// ---------------- Product rows ----------------
let rowId = 0;
const productList = document.getElementById("productList");

function makeEmptyRow() {
  const row = document.createElement("div");
  row.className = "product-row";
  row.dataset.state = "empty";
  row.dataset.id = ++rowId;
  row.innerHTML = `
    <div class="prod-main prod-add">
      <span class="plus">＋</span>
      <span class="add-label">Add Product</span>
      <span class="add-sub">Scan barcode or search by name</span>
    </div>
    <div class="prod-controls">
      <div class="ctrl-box ctrl-qty" data-disabled="true">
        <span class="ctrl-label">Qty</span>
        <input type="number" min="0" placeholder="–" />
      </div>
      <div class="ctrl-box ctrl-unit" data-disabled="true">
        <span class="ctrl-label">Unit</span>
        <span class="unit-val">Case</span>
      </div>
      <div class="ctrl-box ctrl-step" data-disabled="true">
        <button class="step-minus">−</button>
        <span class="divider"></span>
        <button class="step-plus">＋</button>
      </div>
    </div>`;

  row.querySelector(".prod-add").addEventListener("click", () => openMethodPicker(row));
  productList.appendChild(row);
  return row;
}

// ---------------- Add-method picker (scan vs search) ----------------
function openMethodPicker(row) {
  const overlay = document.getElementById("methodOverlay");
  overlay.hidden = false;

  document.getElementById("methodScan").onclick = () => {
    overlay.hidden = true;
    startScan(row);
  };
  document.getElementById("methodSearch").onclick = () => {
    overlay.hidden = true;
    openSearch(row);
  };
  document.getElementById("methodCancel").onclick = () => {
    overlay.hidden = true;
  };
}

function startScan(row) {
  const overlay = document.getElementById("scanOverlay");
  overlay.hidden = false;
  // A scan only resolves to products that actually carry a barcode
  const scannable = PRODUCT_DB.filter((p) => p.barcode);
  const timer = setTimeout(() => {
    overlay.hidden = true;
    const product = scannable[Math.floor(Math.random() * scannable.length)];
    fillRow(row, product);
  }, 1800);

  document.getElementById("cancelScan").onclick = () => {
    clearTimeout(timer);
    overlay.hidden = true;
  };
}

// ---------------- Search by name (no / damaged barcode) ----------------
function openSearch(row) {
  const overlay = document.getElementById("searchOverlay");
  const input = document.getElementById("searchInput");
  overlay.hidden = false;
  input.value = "";
  renderSearchResults("", row);
  setTimeout(() => input.focus(), 50);

  input.oninput = () => renderSearchResults(input.value, row);
  document.getElementById("searchClose").onclick = () => {
    overlay.hidden = true;
  };
}

function renderSearchResults(query, row) {
  const box = document.getElementById("searchResults");
  const q = query.trim().toLowerCase();
  const matches = PRODUCT_DB.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
  );

  if (matches.length === 0) {
    box.innerHTML = `<p class="search-empty">No products match “${query}”.</p>`;
    return;
  }

  box.innerHTML = "";
  matches.forEach((p) => {
    const item = document.createElement("button");
    item.className = "search-result";
    item.innerHTML = `
      <span class="sr-emoji">${p.image}</span>
      <span class="sr-info">
        <span class="sr-name">${p.name}</span>
        <span class="sr-meta">${p.variant} · ${p.barcode ? "#" + p.barcode : "No barcode"}</span>
      </span>
      <span class="sr-add">Add</span>`;
    item.onclick = () => {
      document.getElementById("searchOverlay").hidden = true;
      fillRow(row, p);
    };
    box.appendChild(item);
  });
}

function fillRow(row, product) {
  row.dataset.state = "filled";
  row.dataset.barcode = product.barcode;
  row.product = product;

  const main = row.querySelector(".prod-main");
  main.className = "prod-main prod-filled";
  main.innerHTML = `
    <div class="prod-emoji">${product.image}</div>
    <div class="prod-info">
      <span class="prod-name">${product.name}</span>
      <span class="prod-variant">${product.variant}</span>
      <span class="prod-sku">SKU: ${product.sku} · ${product.barcode ? "#" + product.barcode : "No barcode"}</span>
      <span class="prod-badge" hidden>✓ Added</span>
    </div>`;

  // Enable controls
  row.querySelectorAll(".ctrl-box").forEach((b) => (b.dataset.disabled = "false"));

  const qtyInput = row.querySelector(".ctrl-qty input");
  const unitBox = row.querySelector(".ctrl-unit");
  const unitVal = row.querySelector(".unit-val");
  const minus = row.querySelector(".step-minus");
  const plus = row.querySelector(".step-plus");

  qtyInput.addEventListener("input", () => refreshRow(row));
  unitBox.addEventListener("click", () => {
    unitVal.textContent = unitVal.textContent === "Case" ? "Each" : "Case";
  });
  minus.addEventListener("click", () => {
    const v = Math.max(0, (parseInt(qtyInput.value || "0", 10)) - 1);
    qtyInput.value = v; refreshRow(row);
  });
  plus.addEventListener("click", () => {
    const v = (parseInt(qtyInput.value || "0", 10)) + 1;
    qtyInput.value = v; refreshRow(row);
  });

  // Ensure there is always a trailing empty Add Product row below
  ensureTrailingEmptyRow();
  updateCount();
}

function refreshRow(row) {
  const qty = parseInt(row.querySelector(".ctrl-qty input").value || "0", 10);
  const main = row.querySelector(".prod-main");
  const badge = row.querySelector(".prod-badge");
  const complete = qty >= 1;
  main.classList.toggle("complete", complete);
  if (badge) badge.hidden = !complete;
  updateCount();
}

function ensureTrailingEmptyRow() {
  const rows = [...productList.children];
  const last = rows[rows.length - 1];
  if (!last || last.dataset.state !== "empty") {
    makeEmptyRow();
  }
}

function getFilledRows() {
  return [...productList.children].filter((r) => r.dataset.state === "filled");
}

function updateCount() {
  const n = getFilledRows().length;
  document.getElementById("poCount").textContent = `${n} item${n === 1 ? "" : "s"}`;
}

// ---------------- Add to order → Review ----------------
document.getElementById("addToOrder").addEventListener("click", () => {
  const filled = getFilledRows();
  if (filled.length === 0) {
    alert("Scan at least one product before adding to order.");
    return;
  }
  buildReview(filled);
  showScreen("review");
});

function buildReview(rows) {
  const dist = document.getElementById("distributor").value || "—";
  const date = document.getElementById("deliveryDate").value || "—";
  const ship = document.getElementById("shipTo").value || "—";

  const head = document.getElementById("reviewHead");
  head.innerHTML = `
    <div class="rh-item"><span class="rh-label">Distributor</span><span class="rh-value">${dist}</span></div>
    <div class="rh-item"><span class="rh-label">Exp. Delivery</span><span class="rh-value">${date}</span></div>
    <div class="rh-item full"><span class="rh-label">Ship to</span><span class="rh-value">${ship}</span></div>`;

  const list = document.getElementById("reviewList");
  list.innerHTML = "";
  let total = 0;
  let issues = 0;

  rows.forEach((row) => {
    const p = row.product;
    const qty = parseInt(row.querySelector(".ctrl-qty input").value || "0", 10);
    const unit = row.querySelector(".unit-val").textContent;
    const incomplete = qty < 1;
    if (incomplete) issues++;
    if (!incomplete) total += qty * p.unitPrice;

    const item = document.createElement("div");
    item.className = "review-item" + (incomplete ? " incomplete" : "");
    item.innerHTML = `
      <div class="ri-emoji">${p.image}</div>
      <div class="ri-info">
        <div class="ri-name">${p.name}</div>
        <div class="ri-meta">${p.variant}</div>
        <div class="ri-flag ${incomplete ? "bad" : "ok"}">
          ${incomplete ? "Missing quantity — please add" : "Ready"}
        </div>
      </div>
      <div class="ri-qty">${incomplete ? "—" : `${qty} ${unit}`}<br/>
        ${incomplete ? "" : `$${(qty * p.unitPrice).toFixed(2)}`}</div>`;
    list.appendChild(item);
  });

  const headerMissing = [];
  if (!document.getElementById("distributor").value) headerMissing.push("distributor");
  if (!document.getElementById("deliveryDate").value) headerMissing.push("delivery date");

  const warn = document.getElementById("reviewWarn");
  const submitBtn = document.getElementById("submitOrder");
  const blocked = issues > 0 || headerMissing.length > 0;

  if (blocked) {
    warn.className = "review-warn";
    const parts = [];
    if (issues > 0) parts.push(`${issues} product(s) marked in red need a quantity`);
    if (headerMissing.length) parts.push(`add ${headerMissing.join(" & ")}`);
    warn.textContent = `Action needed: ${parts.join("; ")}.`;
    submitBtn.disabled = true;
  } else {
    warn.className = "review-warn ok";
    warn.textContent = "All items are complete. You're good to submit.";
    submitBtn.disabled = false;
  }

  document.getElementById("reviewTotal").textContent = `Total $${total.toFixed(2)}`;
}

// ---------------- Submit ----------------
document.getElementById("submitOrder").addEventListener("click", () => {
  const ref = "PO-" + Math.floor(100000 + Math.random() * 900000);
  document.getElementById("successMsg").textContent =
    `Purchase order ${ref} has been submitted successfully to ${document.getElementById("distributor").value}.`;
  showScreen("success");
});

document.getElementById("newOrder").addEventListener("click", () => {
  productList.innerHTML = "";
  makeEmptyRow();
  updateCount();
  showScreen("dashboard");
});

// ---------------- Init ----------------
initShipTo();
initDate();
makeEmptyRow();
updateCount();
