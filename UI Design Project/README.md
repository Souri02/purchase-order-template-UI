# Countera — Basic Template for Purchase Orders

A static, single-page prototype of a mobile **Purchase Order (PO)** flow for basic users
(employees whose only job is placing purchase orders). Built from the whiteboard sketch and
the `user_PO_UI_Fixes` requirements.

## Run it

It's fully static — no build step. Either:

- **Just open** `index.html` in any browser, **or**
- Serve the folder (recommended, avoids browser file restrictions):

```bash
# from this folder
python -m http.server 8000
# then open http://localhost:8000
```

## The flow

1. **Sign in** — stable session, no forced logout. Lands on Home.
2. **Home** — a basic user only sees the **Purchase Order** tile (access-controlled). No
   sidebar, no extra dashboard data.
3. **Purchase Order screen** (single click, direct — no sidebar in between):
   - **Distributor Name** (top-left) and **Expected Delivery** date (top-right).
   - **Ship to** — defaults to the user's own store. If the user has multi-store access,
     it becomes a multi-option selector. (Configurable in `data.js`.)
   - **Add Product** — grey box taking the left 2/3. Tap it and choose how to add the item:
     - **Scan barcode** → camera opens, scans, and the product is looked up from the **database**.
     - **Search by name** → for items whose **barcode is damaged or missing** (e.g. fresh
       produce like bananas, tomatoes) type the name and pick from the matching results.
   - Right 1/3 has three boxes: **Qty** (type in / select), **Case / Each** (default **Case**),
     and a **+ / −** stepper (manual entry supported for large quantities).
   - When a product has a valid quantity it turns **green** (successfully added) and a new
     **Add Product** box appears below for the next item.
   - **Add to order** (bottom-left) → Review.
4. **Review** — shows the header details (distributor, delivery date, ship-to) and every
   item. Items missing a quantity are flagged **red**; complete ones are **green**.
5. **Submit** (bottom-right) — enabled once everything is in order; places the order.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup for all screens + phone frame |
| `styles.css` | All styling (grey add-box, green/red states, scan overlay) |
| `data.js` | Sample product **database** + user store-access profile |
| `app.js` | Screen navigation + scan/populate/qty/review logic |

## Notes / simulated parts

- The **barcode scan** and **product lookup** are simulated against the sample database in
  `data.js` (a static page can't access a real camera DB). On a real device the scan would
  call the backend and return the matching product + variants.
- To demo single-store vs multi-store, toggle `USER_PROFILE.multiStoreAccess` in `data.js`.
