/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================== */

const ORDER_API_URL =
  "https://script.google.com/macros/s/AKfycbwgC0dTgyUgrkHaRN7EHJXvUJbuvMnu7JCtvQ04tIfberqVGv4Gvbj-NWqH9nLheht9yw/exec";

const ORDERS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFCc657qtZIxmSRTxeQ8ENzFWHwPV-Lo10D5fsWILsoxcLvrED4JVBv9GqdIZtsvnaHPgc7Bair4ny/pub?gid=0&single=true&output=csv";

const MOODS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "fresh", label: "Fresh" },
  { key: "sweet", label: "Sweet" },
  { key: "confident", label: "Confident" },
  { key: "romance", label: "Romance" },
];

/* ---------- Helpers ---------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("th-TH") + " บาท" : String(value);
}

function moodLabel(key) {
  const found = MOODS.find((m) => m.key === key);
  return found ? found.label : key;
}

/* ==========================================================
   1) หน้า product.html
   ========================================================== */
function initProductPage() {
  const filterBar = document.getElementById("filter-bar");
  const list = document.getElementById("product-list");
  if (!filterBar || !list) return;

  let products = [];
  const validMoods = MOODS.map((m) => m.key);

  // อ่าน ?mood=xxx (ถ้าไม่ถูกต้องให้ใช้ "all")
  const paramMood = (new URLSearchParams(window.location.search).get("mood") || "all").toLowerCase();
  let activeMood = validMoods.includes(paramMood) ? paramMood : "all";

  function renderFilters() {
    filterBar.innerHTML = "";
    filterBar.classList.add("filters");
    MOODS.forEach((m) => {
      const btn = el("button", "filter-btn", m.label);
      btn.type = "button";
      btn.dataset.mood = m.key;
      if (m.key === activeMood) btn.classList.add("is-active");
      btn.setAttribute("aria-pressed", String(m.key === activeMood));
      btn.addEventListener("click", () => setMood(m.key));
      filterBar.appendChild(btn);
    });
  }

  function setMood(mood) {
    activeMood = mood;
    renderFilters();
    renderProducts();

    // อัปเดต URL โดยไม่โหลดหน้าใหม่ เพื่อให้แชร์ลิงก์ได้
    const url = new URL(window.location.href);
    if (mood === "all") url.searchParams.delete("mood");
    else url.searchParams.set("mood", mood);
    window.history.replaceState(null, "", url);
  }

  function buildCard(p) {
    const itemName = p.size ? `${p.name} ${p.size}` : p.name;

    const card = el("article", `card mood-${p.mood}`);

    const media = el("div", "card__media");
    const img = document.createElement("img");
    img.src = p.image;
    img.alt = itemName;
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove()); // ถ้าไม่มีรูป ให้เหลือพื้นเบจ
    media.appendChild(img);

    const body = el("div", "card__body");

    const meta = el("div", "card__meta");
    meta.appendChild(el("span", "mood-dot"));
    meta.appendChild(el("span", null, moodLabel(p.mood)));

    const title = el("h3", "card__title", p.name);
    const size = el("p", "muted mb-0", p.size ? p.size : p.type === "rollon" ? "โรลออน" : "");

    body.append(meta, title, size);

    const foot = el("div", "card__foot");
    foot.appendChild(el("span", "price", formatPrice(p.price)));

    const buy = el("a", "btn btn--accent", "สั่งซื้อ");
    buy.href =
      "order.html?item=" + encodeURIComponent(itemName) +
      "&price=" + encodeURIComponent(p.price);
    foot.appendChild(buy);

    card.append(media, body, foot);
    return card;
  }

  function renderProducts() {
    list.innerHTML = "";
    const shown = activeMood === "all" ? products : products.filter((p) => p.mood === activeMood);

    if (!shown.length) {
      list.appendChild(el("p", "muted", "ยังไม่มีสินค้าในหมวดนี้"));
      return;
    }
    shown.forEach((p) => list.appendChild(buildCard(p)));
  }

  renderFilters();

  fetch("products.json")
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
      products = Array.isArray(data) ? data : [];
      renderProducts();
    })
    .catch((error) => {
      console.error(error);
      list.innerHTML = "";
      list.appendChild(
        el("p", "muted", "โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
      );
    });
}

/* ==========================================================
   2) หน้า order.html
   ========================================================== */
function initOrderPage() {
  const form = document.getElementById("orderForm");
  if (!form) return;

  const itemsInput = document.getElementById("items");
  const totalInput = document.getElementById("total");

  // เติม item และ price จาก URL ลงช่อง #items และ #total ทันที
  const params = new URLSearchParams(window.location.search);
  const item = params.get("item");
  const price = params.get("price");
  if (itemsInput && item !== null) itemsInput.value = item;
  if (totalInput && price !== null) totalInput.value = price;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const value = (id) => {
      const node = document.getElementById(id);
      return node ? node.value.trim() : "";
    };

    const payload = {
      customerName: value("customerName"),
      contact: value("contact"),
      items: value("items"),
      total: value("total"),
      note: value("note"),
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true; // กันกดซ้ำ

    fetch(ORDER_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ==========================================================
   3) หน้า admin.html
   ========================================================== */

// parse CSV เอง: รองรับ "..." ที่มีลูกน้ำ, ขึ้นบรรทัดใหม่ และ "" (เครื่องหมายคำพูดซ้อน)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }

  // ตัดแถวว่าง
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function initAdminPage() {
  const tbody = document.querySelector("#ordersTable tbody");
  if (!tbody) return;

  const COLS = 6;

  function message(text) {
    tbody.innerHTML = "";
    const tr = document.createElement("tr");
    const td = el("td", "muted", text);
    td.colSpan = COLS;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  message("กำลังโหลดข้อมูล...");

  fetch(ORDERS_CSV_URL, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then((text) => {
      let rows = parseCSV(text);

      // ข้ามแถวหัวตาราง (ถ้าคอลัมน์แรกไม่ได้ขึ้นต้นด้วยตัวเลขแบบวันที่)
      if (rows.length && !/^\s*\d/.test(rows[0][0] || "")) rows = rows.slice(1);

      if (!rows.length) {
        message("ยังไม่มีรายการสั่งซื้อ");
        return;
      }

      // Sheet เพิ่มแถวใหม่ต่อท้ายเสมอ จึงกลับลำดับให้ล่าสุดขึ้นก่อน
      rows.reverse();

      tbody.innerHTML = "";
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
        for (let i = 0; i < COLS; i++) {
          let cell = (r[i] || "").trim();
          if (i === 4 && cell !== "" && Number.isFinite(Number(cell))) {
            cell = formatPrice(cell);
          }
          const td = el("td", null, cell);
          td.style.whiteSpace = "pre-line";
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    })
    .catch((error) => {
      console.error(error);
      message("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง");
    });
}

/* ---------- เริ่มทำงานตามหน้าที่เปิดอยู่ ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
