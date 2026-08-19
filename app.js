// ===== The Sultan Laundry — Customer Web App =====
// Tersambung ke backend API (lihat CONFIG.API_BASE_URL di bawah).

const CONFIG = {
  // GANTI dengan URL backend Railway Anda setelah deploy, contoh:
  // "https://sultan-laundry-backend-production.up.railway.app"
  API_BASE_URL: "https://YOUR-BACKEND-URL.up.railway.app",
};

const DURATIONS = [
  { id: "reguler", name: "Reguler", time: "48–72 jam", mult: 1 },
  { id: "ekspress", name: "Ekspress", time: "24–48 jam", mult: 1.3 },
  { id: "kilat", name: "Kilat", time: "12–24 jam", mult: 1.6 },
  { id: "prioritas", name: "Prioritas", time: "6–12 jam", mult: 2 },
  { id: "darurat", name: "Darurat", time: "3–6 jam", mult: 2.5 },
];

const STAGES = [
  "Menunggu Konfirmasi",
  "Dijemput Kurir",
  "Tiba di Outlet",
  "Verifikasi & Penimbangan",
  "Proses Cuci",
  "QC",
  "Siap Diantar",
  "Selesai",
];

const fmt = (n) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

const icons = {
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>',
  package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>',
  shirt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.4 14.4 16 10V4a4 4 0 0 0-8 0v6l-4.4 4.4a2 2 0 0 0 0 2.83L6 19.6V22h12v-2.4l2.4-2.37a2 2 0 0 0 0-2.83Z"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>',
};

// ===== State =====
const state = {
  screen: "login",
  token: load("sl_token", null),
  user: load("sl_user", null),
  masterData: null,
  paymentMethods: [],
  cart: [],
  satuanSelections: {},
  satuanDuration: null,
  kiloanDraft: { service: null, duration: null, perfume: null },
  address: "",
  schedule: "",
  currentOrderId: load("sl_current_order", null),
  currentOrder: null,
  paymentProofs: [],
  loading: false,
  errorMsg: "",
};

let trackingInterval = null;

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function persist(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ===== API helper =====
async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Terjadi kesalahan, coba lagi.");
  return data;
}

// ===== Navigation ===== (async-aware: some screens need data fetched first)
async function go(screen) {
  state.errorMsg = "";
  if (screen === "tracking") {
    if (!state.currentOrderId) { screen = "home"; }
    else {
      await refreshOrder();
      if (trackingInterval) clearInterval(trackingInterval);
      trackingInterval = setInterval(refreshOrder, 6000);
    }
  } else if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  if (screen === "payment") {
    await loadPaymentScreenData();
  }
  state.screen = screen;
  render();
  window.scrollTo(0, 0);
}

function cartTotal() {
  return state.cart.reduce((sum, l) => {
    if (l.type === "satuan") {
      const mult = DURATIONS.find((d) => d.id === l.duration)?.mult ?? 1;
      return sum + l.price * l.qty * mult;
    }
    return sum;
  }, 0);
}
function hasKiloan() {
  return state.cart.some((l) => l.type === "kiloan");
}

// ===== Render root =====
function render() {
  const app = document.getElementById("app");
  app.innerHTML = renderScreen();
  bindEvents();
}

function topbar(title, opts = {}) {
  return `
  <div class="topbar">
    <button class="icon-btn" data-action="${opts.back ? `go:${opts.back}` : ""}" ${!opts.back ? "style='visibility:hidden'" : ""}>${icons.back}</button>
    <h1 class="serif">${title}</h1>
    <button class="icon-btn" data-action="${opts.cart === false ? "" : "go:cart"}">
      ${opts.cart === false ? "" : icons.bag}
      ${opts.cart !== false && state.cart.length > 0 ? `<span class="badge">${state.cart.length}</span>` : ""}
    </button>
  </div>`;
}

function errorBanner() {
  return state.errorMsg
    ? `<div class="notice" style="border-color:#a33;color:#f3a;margin-bottom:16px">${state.errorMsg}</div>`
    : "";
}

function renderScreen() {
  switch (state.screen) {
    case "login": return screenLogin();
    case "register": return screenRegister();
    case "home": return screenHome();
    case "order-type": return screenOrderType();
    case "satuan-items": return screenSatuanItems();
    case "satuan-duration": return screenSatuanDuration();
    case "kiloan-service": return screenKiloanService();
    case "kiloan-duration": return screenKiloanDuration();
    case "kiloan-perfume": return screenKiloanPerfume();
    case "cart": return screenCart();
    case "pickup": return screenPickup();
    case "confirm": return screenConfirm();
    case "tracking": return screenTracking();
    case "payment": return screenPayment();
    default: return screenHome();
  }
}

// ===== AUTH SCREENS =====
function screenLogin() {
  return `
  <div class="screen" style="padding-top:60px">
    <p class="eyebrow serif" style="text-align:center;color:var(--text-faint)">Assalamu'alaikum</p>
    <h1 class="serif" style="text-align:center;font-size:26px;margin:6px 0 32px">The Sultan Laundry</h1>
    ${errorBanner()}
    <label class="field-label">Nomor WA atau Email</label>
    <input type="text" id="login-identifier" placeholder="0812xxxxxxx atau email@contoh.com" />
    <div style="height:14px"></div>
    <label class="field-label">Password</label>
    <input type="text" id="login-password" placeholder="Password" />
    <div style="height:22px"></div>
    <button class="btn-primary" data-action="do-login">${state.loading ? "Memproses..." : "Masuk"}</button>
    <button class="muted-link" style="width:100%;text-align:center;margin-top:16px" data-action="go:register">
      Belum punya akun? Daftar
    </button>
  </div>`;
}

function screenRegister() {
  return `
  ${topbar("Daftar Akun", { back: "login", cart: false })}
  <div class="screen">
    ${errorBanner()}
    <label class="field-label">Nama Lengkap</label>
    <input type="text" id="reg-name" placeholder="Nama Anda" />
    <div style="height:14px"></div>
    <label class="field-label">Nomor WhatsApp</label>
    <input type="text" id="reg-phone" placeholder="0812xxxxxxx" />
    <div style="height:14px"></div>
    <label class="field-label">Password</label>
    <input type="text" id="reg-password" placeholder="Buat password" />
    <div style="height:22px"></div>
    <button class="btn-primary" data-action="do-register">${state.loading ? "Memproses..." : "Daftar"}</button>
  </div>`;
}

// ===== HOME =====
function screenHome() {
  return `
  ${topbar("The Sultan Laundry")}
  <div class="screen">
    <div class="hero">
      <p class="eyebrow serif">Assalamu'alaikum, ${state.user?.name?.split(" ")[0] || ""}</p>
      <p class="headline serif">Mau laundry apa hari ini?</p>
      <button class="btn-primary" data-action="go:order-type">${icons.bag} Order Baru</button>
    </div>
    ${state.cart.length > 0 ? `
      <button class="card" data-action="go:cart">
        <div class="row"><span style="font-size:14px;color:#e8c96b">Keranjang aktif — ${state.cart.length} item</span><span style="color:var(--gold)">${icons.next}</span></div>
      </button>` : ""}
    ${state.currentOrderId ? `
      <button class="card" data-action="go:tracking">
        <div class="row"><span style="font-size:14px;color:#e8c96b">Lacak Order #${state.currentOrderId}</span><span style="color:var(--gold)">${icons.next}</span></div>
      </button>` : ""}
    <div class="stat-grid">
      <div class="stat-box"><p class="label">Poin Loyalitas</p><p class="value serif">${state.user?.loyalty_points ?? 0} pts</p></div>
      <div class="stat-box"><p class="label">Membership</p><p class="value serif">${state.user?.membership_tier || "Reguler"}</p></div>
    </div>
    <button class="muted-link" style="margin-top:24px" data-action="do-logout">Keluar akun</button>
  </div>`;
}

// ===== ORDER TYPE =====
function screenOrderType() {
  return `
  ${topbar("Tambah Pesanan", { back: "home" })}
  <div class="screen">
    <p style="color:var(--text-faint);font-size:14px;margin-bottom:16px">Pilih jenis layanan untuk ditambahkan ke keranjang.</p>
    <button class="card" data-action="go:satuan-items">
      <div class="row" style="gap:14px;justify-content:flex-start">
        <div class="type-icon">${icons.package}</div>
        <div style="flex:1"><p class="serif" style="margin:0;font-size:17px">Satuan</p>
        <p style="margin:2px 0 0;font-size:12px;color:var(--text-faint)">Selimut, boneka, sepatu, bed cover, dll.</p></div>
        <span style="color:var(--gold)">${icons.next}</span>
      </div>
    </button>
    <button class="card" data-action="go:kiloan-service">
      <div class="row" style="gap:14px;justify-content:flex-start">
        <div class="type-icon">${icons.shirt}</div>
        <div style="flex:1"><p class="serif" style="margin:0;font-size:17px">Kiloan</p>
        <p style="margin:2px 0 0;font-size:12px;color:var(--text-faint)">Cuci lipat, cuci setrika, setrika saja.</p></div>
        <span style="color:var(--gold)">${icons.next}</span>
      </div>
    </button>
  </div>`;
}

function satuanItemsData() { return state.masterData?.items || []; }
function kiloanServicesData() { return state.masterData?.kiloanServices || []; }
function perfumesData() { return (state.masterData?.perfumes || []).map((p) => p.name); }

function screenSatuanItems() {
  const items = satuanItemsData();
  const anySelected = Object.values(state.satuanSelections).some((q) => q > 0);
  return `
  ${topbar("Pilih Item Satuan", { back: "order-type" })}
  <div class="screen">
    ${items.map((item) => {
      const qty = state.satuanSelections[item.code] || 0;
      return `
      <div class="row-item">
        <div><p style="margin:0;font-size:14px">${item.name}</p>
        <p style="margin:2px 0 0;font-size:12px;color:var(--text-faint)">${fmt(item.base_price)} / pcs</p></div>
        <div class="qty-control">
          <button class="qty-btn" data-action="qty-dec" data-id="${item.code}">−</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn" data-action="qty-inc" data-id="${item.code}">+</button>
        </div>
      </div>`;
    }).join("")}
  </div>
  ${anySelected ? `<div class="sticky-footer"><button class="btn-primary" data-action="go:satuan-duration">Lanjut Pilih Durasi</button></div>` : ""}`;
}

function screenSatuanDuration() {
  return `
  ${topbar("Durasi Pengerjaan", { back: "satuan-items" })}
  <div class="screen">
    ${DURATIONS.map((d) => `
      <button class="card ${state.satuanDuration === d.id ? "selected" : ""}" data-action="pick-satuan-duration" data-id="${d.id}">
        <div class="row">
          <div class="row" style="gap:10px;justify-content:flex-start">
            <span style="color:var(--gold)">${icons.clock}</span>
            <div><p style="margin:0;font-size:14px">${d.name}</p><p style="margin:2px 0 0;font-size:12px;color:var(--text-faint)">${d.time}</p></div>
          </div>
          ${state.satuanDuration === d.id ? `<span style="color:var(--gold)">${icons.check}</span>` : ""}
        </div>
      </button>`).join("")}
    ${state.satuanDuration ? `<button class="btn-primary" style="margin-top:8px" data-action="add-satuan-cart">Tambah ke Keranjang</button>` : ""}
  </div>`;
}

function screenKiloanService() {
  const services = kiloanServicesData();
  return `
  ${topbar("Pilih Layanan Kiloan", { back: "order-type" })}
  <div class="screen">
    ${services.map((s) => `
      <button class="card" data-action="pick-kiloan-service" data-id="${s.code}">
        <div class="row">
          <div><p style="margin:0;font-size:14px">${s.name}</p><p style="margin:2px 0 0;font-size:12px;color:var(--text-faint)">${fmt(s.price_per_kg)} / kg (estimasi)</p></div>
          <span style="color:var(--gold)">${icons.next}</span>
        </div>
      </button>`).join("")}
    <p style="font-size:12px;color:var(--text-faint);padding-top:8px">*Harga final ditentukan setelah penimbangan riil di outlet.</p>
  </div>`;
}

function screenKiloanDuration() {
  return `
  ${topbar("Durasi Pengerjaan", { back: "kiloan-service" })}
  <div class="screen">
    ${DURATIONS.map((d) => `
      <button class="card" data-action="pick-kiloan-duration" data-id="${d.id}">
        <div class="row">
          <div class="row" style="gap:10px;justify-content:flex-start">
            <span style="color:var(--gold)">${icons.clock}</span>
            <div><p style="margin:0;font-size:14px">${d.name}</p><p style="margin:2px 0 0;font-size:12px;color:var(--text-faint)">${d.time}</p></div>
          </div>
          <span style="color:var(--gold)">${icons.next}</span>
        </div>
      </button>`).join("")}
  </div>`;
}

function screenKiloanPerfume() {
  const perfumes = perfumesData();
  return `
  ${topbar("Pilih Parfum", { back: "kiloan-duration" })}
  <div class="screen">
    ${perfumes.map((p) => `
      <button class="card ${state.kiloanDraft.perfume === p ? "selected" : ""}" data-action="pick-perfume" data-id="${p}">
        <div class="row"><span style="font-size:14px">${p}</span>${state.kiloanDraft.perfume === p ? `<span style="color:var(--gold)">${icons.check}</span>` : ""}</div>
      </button>`).join("")}
    ${state.kiloanDraft.perfume ? `<button class="btn-primary" style="margin-top:8px" data-action="add-kiloan-cart">Tambah ke Keranjang</button>` : ""}
  </div>`;
}

function screenCart() {
  return `
  ${topbar("Keranjang", { back: "home" })}
  <div class="screen">
    ${state.cart.length === 0 ? `<p class="empty-state">Keranjang masih kosong.</p>` : `
      ${state.cart.map((l) => `
        <div class="card" style="cursor:default">
          <div class="row" style="align-items:flex-start">
            <div>
              <span class="seal">${icons.sparkle} ${l.type === "satuan" ? "Satuan" : "Kiloan"}</span>
              <p style="margin:8px 0 0;font-size:14px;font-weight:500">${l.name}</p>
              ${l.type === "satuan"
                ? `<p style="margin:4px 0 0;font-size:12px;color:var(--text-faint)">${l.qty} pcs · ${DURATIONS.find((d) => d.id === l.duration)?.name}</p>`
                : `<p style="margin:4px 0 0;font-size:12px;color:var(--text-faint)">${DURATIONS.find((d) => d.id === l.duration)?.name} · ${l.perfume}</p>`}
            </div>
            <button class="icon-btn" data-action="remove-line" data-key="${l.key}">${icons.x}</button>
          </div>
          <div style="text-align:right;margin-top:8px;font-size:14px;color:#e8c96b">
            ${l.type === "satuan" ? fmt(l.price * l.qty * (DURATIONS.find((d) => d.id === l.duration)?.mult ?? 1)) : "Menunggu penimbangan"}
          </div>
        </div>`).join("")}
      <button class="btn-dashed" data-action="go:order-type">+ Tambah item lain</button>
    `}
  </div>
  ${state.cart.length > 0 ? `
  <div class="sticky-footer">
    <div class="row" style="font-size:13px;margin-bottom:10px">
      <span style="color:var(--text-faint)">Estimasi total</span>
      <span>${fmt(cartTotal())}${hasKiloan() ? " + kiloan" : ""}</span>
    </div>
    <button class="btn-primary" data-action="go:pickup">Lanjut ke Pickup</button>
  </div>` : ""}`;
}

function screenPickup() {
  return `
  ${topbar("Jadwal Pickup", { back: "cart" })}
  <div class="screen">
    <label class="field-label">${icons.pin} Alamat Pickup</label>
    <textarea id="input-address" rows="3" placeholder="Contoh: Jl. Wonocatur No. 12, Banguntapan, Bantul">${state.address}</textarea>
    <div style="height:16px"></div>
    <label class="field-label">${icons.clock} Jadwal Pickup</label>
    <input type="text" id="input-schedule" placeholder="Contoh: Hari ini, 16.00 – 18.00" value="${state.schedule}" />
    <div style="height:20px"></div>
    <button class="btn-primary" id="btn-continue-pickup" ${!state.address || !state.schedule ? "disabled" : ""} data-action="go:confirm">Lanjut ke Konfirmasi</button>
  </div>`;
}

function screenConfirm() {
  return `
  ${topbar("Konfirmasi Pesanan", { back: "pickup" })}
  <div class="screen">
    ${errorBanner()}
    <div class="card" style="cursor:default">
      ${state.cart.map((l) => `
        <div class="row" style="font-size:14px;margin-bottom:6px">
          <span>${l.name} ${l.type === "satuan" ? `× ${l.qty}` : ""}</span>
          <span style="color:var(--text-faint)">${l.type === "satuan" ? fmt(l.price * l.qty * (DURATIONS.find((d) => d.id === l.duration)?.mult ?? 1)) : "Estimasi menyusul"}</span>
        </div>`).join("")}
      <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px" class="row">
        <span style="font-weight:600">Estimasi Total</span><span style="font-weight:600">${fmt(cartTotal())}${hasKiloan() ? " + kiloan" : ""}</span>
      </div>
    </div>
    <div class="card" style="cursor:default">
      <p style="margin:0 0 4px;font-size:12px;color:var(--text-faint)">Alamat & Jadwal</p>
      <p style="margin:0;font-size:14px">${state.address}</p><p style="margin:0;font-size:14px">${state.schedule}</p>
    </div>
    <div class="notice">
      Pembayaran dilakukan <strong style="color:#fdf6e3">setelah verifikasi &amp; penimbangan</strong> di outlet, via transfer
      manual atau QRIS. Harga di atas adalah estimasi.
    </div>
  </div>
  <div class="sticky-footer">
    <button class="btn-primary" data-action="submit-order">${state.loading ? "Mengirim..." : "Kirim Pesanan"}</button>
  </div>`;
}

function screenTracking() {
  const order = state.currentOrder;
  const status = order?.order?.status ?? 1;
  const canPay = order?.order?.final_total_price !== null && order?.order?.final_total_price !== undefined;
  const paid = order?.order?.payment_status === "paid";

  return `
  ${topbar("Lacak Pesanan", { back: "home" })}
  <div class="screen">
    <div class="center-banner">
      <p class="small serif">Order #${state.currentOrderId}</p>
      <p class="big serif">${STAGES[status - 1] || "Menunggu Konfirmasi"}</p>
      ${canPay ? `<p style="margin:8px 0 0;font-size:13px;color:${paid ? "#7fd88f" : "#e8c96b"}">
        ${paid ? "Sudah dibayar" : `Tagihan: ${fmt(order.order.final_total_price)} — ${status === 4 ? "menunggu konfirmasi Anda" : "belum dibayar"}`}
      </p>` : ""}
    </div>
    ${STAGES.map((s, i) => `
      <div class="timeline-row">
        <div class="timeline-dot-col">
          <div class="timeline-dot ${i < status ? "done" : ""}">${i < status ? icons.check : i + 1}</div>
          ${i < STAGES.length - 1 ? `<div class="timeline-line"></div>` : ""}
        </div>
        <div><p class="timeline-label ${i < status ? "active" : ""}">${s}</p>
        ${i === 3 ? `<p class="timeline-sub">Harga final ditentukan di sini</p>` : ""}</div>
      </div>`).join("")}

    ${status === 4 ? `<button class="btn-primary" style="margin-bottom:10px" data-action="confirm-deviation">Konfirmasi & Lanjutkan</button>` : ""}
    ${canPay && !paid ? `<button class="btn-primary" style="margin-bottom:10px" data-action="go:payment">${icons.wallet} Bayar Sekarang</button>` : ""}
    <button class="btn-secondary" data-action="go:home">Kembali ke Beranda</button>
  </div>`;
}

function screenPayment() {
  const order = state.currentOrder?.order;
  const methods = state.paymentMethods;
  const bank = methods.find((m) => m.method === "bank_transfer");
  const qris = methods.find((m) => m.method === "qris");
  const latestProof = state.paymentProofs[0];

  return `
  ${topbar("Pembayaran", { back: "tracking" })}
  <div class="screen">
    ${errorBanner()}
    <div class="center-banner">
      <p class="small serif">Total Tagihan</p>
      <p class="big serif">${fmt(order?.final_total_price)}</p>
    </div>

    ${latestProof ? `
      <div class="notice" style="margin-bottom:20px">
        Status bukti pembayaran: <strong style="color:#fdf6e3">${
          latestProof.status === "pending" ? "Menunggu review Admin" : latestProof.status === "approved" ? "Disetujui ✓" : "Ditolak — silakan unggah ulang"
        }</strong>
        ${latestProof.notes ? `<br/>Catatan: ${latestProof.notes}` : ""}
      </div>` : ""}

    ${(!latestProof || latestProof.status === "rejected") ? `
      ${bank ? `
      <div class="card" style="cursor:default">
        <p class="serif" style="margin:0 0 8px;font-size:15px">Transfer Bank</p>
        <p style="margin:0;font-size:14px">${bank.bank_name}</p>
        <p style="margin:2px 0;font-size:18px;font-weight:600;color:var(--gold)">${bank.account_number}</p>
        <p style="margin:0;font-size:13px;color:var(--text-faint)">a.n. ${bank.account_holder}</p>
      </div>` : ""}

      ${qris?.qris_image_base64 ? `
      <div class="card" style="cursor:default;text-align:center">
        <p class="serif" style="margin:0 0 10px;font-size:15px">Scan QRIS</p>
        <img src="${qris.qris_image_base64}" alt="QRIS" style="width:100%;max-width:260px;border-radius:12px" />
      </div>` : ""}

      <label class="field-label" style="margin-top:8px">${icons.camera} Unggah Bukti Pembayaran</label>
      <input type="file" id="proof-file" accept="image/*" capture="environment" style="color:var(--text-dim);font-size:13px" />
      <div style="height:10px"></div>
      <select id="proof-method" style="width:100%;background:transparent;border:1px solid rgba(120,70,10,0.5);border-radius:12px;padding:12px;color:var(--text);font-size:14px">
        <option value="bank_transfer">Transfer Bank</option>
        <option value="qris">QRIS</option>
      </select>
      <div style="height:16px"></div>
      <button class="btn-primary" data-action="upload-proof">${state.loading ? "Mengunggah..." : "Kirim Bukti Pembayaran"}</button>
    ` : ""}
  </div>`;
}

// ===== Event binding =====
function bindEvents() {
  document.querySelectorAll("[data-action]").forEach((el) => el.addEventListener("click", handleAction));
  const addrInput = document.getElementById("input-address");
  const schedInput = document.getElementById("input-schedule");
  if (addrInput) addrInput.addEventListener("input", (e) => { state.address = e.target.value; toggleContinueBtn(); });
  if (schedInput) schedInput.addEventListener("input", (e) => { state.schedule = e.target.value; toggleContinueBtn(); });
}

function toggleContinueBtn() {
  const btn = document.getElementById("btn-continue-pickup");
  if (btn) btn.disabled = !state.address || !state.schedule;
}

async function handleAction(e) {
  const el = e.currentTarget;
  const action = el.dataset.action;
  if (!action) return;

  if (action.startsWith("go:")) { await go(action.split(":")[1]); return; }

  if (action === "do-login") return doLogin();
  if (action === "do-register") return doRegister();
  if (action === "do-logout") return doLogout();

  if (action === "qty-inc" || action === "qty-dec") {
    const id = el.dataset.id;
    const cur = state.satuanSelections[id] || 0;
    state.satuanSelections[id] = action === "qty-inc" ? cur + 1 : Math.max(0, cur - 1);
    render();
    return;
  }

  if (action === "pick-satuan-duration") { state.satuanDuration = el.dataset.id; render(); return; }

  if (action === "add-satuan-cart") {
    const items = satuanItemsData();
    const lines = Object.entries(state.satuanSelections)
      .filter(([, qty]) => qty > 0)
      .map(([code, qty]) => {
        const item = items.find((i) => i.code === code);
        return {
          key: `satuan-${code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: "satuan", code, name: item.name, qty, price: Number(item.base_price), duration: state.satuanDuration,
        };
      });
    state.cart.push(...lines);
    state.satuanSelections = {};
    state.satuanDuration = null;
    await go("cart");
    return;
  }

  if (action === "pick-kiloan-service") { state.kiloanDraft.service = el.dataset.id; await go("kiloan-duration"); return; }
  if (action === "pick-kiloan-duration") { state.kiloanDraft.duration = el.dataset.id; await go("kiloan-perfume"); return; }
  if (action === "pick-perfume") { state.kiloanDraft.perfume = el.dataset.id; render(); return; }

  if (action === "add-kiloan-cart") {
    const services = kiloanServicesData();
    const service = services.find((s) => s.code === state.kiloanDraft.service);
    state.cart.push({
      key: `kiloan-${Date.now()}`, type: "kiloan", code: service.code, name: service.name,
      duration: state.kiloanDraft.duration, perfume: state.kiloanDraft.perfume,
    });
    state.kiloanDraft = { service: null, duration: null, perfume: null };
    await go("cart");
    return;
  }

  if (action === "remove-line") { state.cart = state.cart.filter((l) => l.key !== el.dataset.key); render(); return; }

  if (action === "submit-order") return submitOrder();
  if (action === "confirm-deviation") return confirmDeviation();
  if (action === "upload-proof") return uploadProof();
}

// ===== Auth actions =====
async function doLogin() {
  const identifier = document.getElementById("login-identifier").value.trim();
  const password = document.getElementById("login-password").value;
  if (!identifier || !password) { state.errorMsg = "Isi nomor WA/email dan password."; render(); return; }
  state.loading = true; render();
  try {
    const data = await api("/api/auth/login", { method: "POST", auth: false, body: { identifier, password } });
    state.token = data.token; state.user = data.user;
    persist("sl_token", data.token); persist("sl_user", data.user);
    await loadMasterData();
    await go("home");
  } catch (err) {
    state.errorMsg = err.message;
  } finally {
    state.loading = false; render();
  }
}

async function doRegister() {
  const name = document.getElementById("reg-name").value.trim();
  const phone = document.getElementById("reg-phone").value.trim();
  const password = document.getElementById("reg-password").value;
  if (!name || !phone || !password) { state.errorMsg = "Semua kolom wajib diisi."; render(); return; }
  state.loading = true; render();
  try {
    const data = await api("/api/auth/register", { method: "POST", auth: false, body: { name, phone, password } });
    state.token = data.token; state.user = data.user;
    persist("sl_token", data.token); persist("sl_user", data.user);
    await loadMasterData();
    await go("home");
  } catch (err) {
    state.errorMsg = err.message;
  } finally {
    state.loading = false; render();
  }
}

async function doLogout() {
  localStorage.removeItem("sl_token");
  localStorage.removeItem("sl_user");
  localStorage.removeItem("sl_current_order");
  state.token = null; state.user = null; state.currentOrderId = null; state.cart = [];
  await go("login");
}

async function loadMasterData() {
  try {
    state.masterData = await api("/api/master-data", { auth: false });
  } catch (err) {
    console.error("Gagal load master data", err);
  }
}

// ===== Order actions =====
async function submitOrder() {
  state.loading = true; state.errorMsg = ""; render();
  try {
    const items = state.cart.map((l) =>
      l.type === "satuan"
        ? { type: "satuan", code: l.code, name: l.name, qty: l.qty, durationCode: l.duration }
        : { type: "kiloan", code: l.code, name: l.name, durationCode: l.duration, perfume: l.perfume }
    );
    const data = await api("/api/orders", {
      method: "POST",
      body: { pickupAddress: state.address, scheduledPickupTime: state.schedule, items },
    });
    state.currentOrderId = data.order.id;
    persist("sl_current_order", data.order.id);
    state.cart = []; state.address = ""; state.schedule = "";
    state.loading = false;
    await go("tracking");
  } catch (err) {
    state.errorMsg = err.message;
    state.loading = false;
    render();
  }
}

async function refreshOrder() {
  try {
    state.currentOrder = await api(`/api/orders/${state.currentOrderId}`);
    if (state.screen === "tracking") render();
  } catch (err) {
    console.error("Gagal refresh order", err);
  }
}

async function confirmDeviation() {
  try {
    await api(`/api/orders/${state.currentOrderId}/confirm-deviation`, { method: "POST" });
    await refreshOrder();
  } catch (err) {
    state.errorMsg = err.message; render();
  }
}

// ===== Payment actions =====
async function loadPaymentScreenData() {
  try {
    const settings = await api("/api/payment-settings", { auth: false });
    state.paymentMethods = settings.paymentMethods;
    const proofs = await api(`/api/orders/${state.currentOrderId}/payment-proof`);
    state.paymentProofs = proofs.proofs;
  } catch (err) {
    console.error(err);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadProof() {
  const fileInput = document.getElementById("proof-file");
  const methodSelect = document.getElementById("proof-method");
  if (!fileInput.files[0]) { state.errorMsg = "Pilih foto bukti pembayaran dulu."; render(); return; }
  state.loading = true; render();
  try {
    const imageBase64 = await fileToBase64(fileInput.files[0]);
    await api(`/api/orders/${state.currentOrderId}/payment-proof`, {
      method: "POST",
      body: { method: methodSelect.value, imageBase64 },
    });
    await loadPaymentScreenData();
    state.errorMsg = "";
  } catch (err) {
    state.errorMsg = err.message;
  } finally {
    state.loading = false; render();
  }
}

// ===== Push Notification (Firebase Cloud Messaging - Web Push) =====
// Isi FIREBASE_CONFIG & VAPID_KEY dari Firebase Console setelah backend FIREBASE_ENABLED=true.
// Lihat README.md bagian "Push Notification" untuk langkah lengkap.
async function setupPushNotification() {
  if (!("serviceWorker" in navigator) || !window.firebase) return;
  try {
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: "YOUR_VAPID_KEY" });
    if (token) {
      await api("/api/notifications/register-token", { method: "POST", body: { token, platform: "web" } });
    }
  } catch (err) {
    console.log("Push notification belum aktif:", err.message);
  }
}

// ===== Init =====
(async function init() {
  if (state.token && state.user) {
    await loadMasterData();
    await go("home");
  } else {
    await go("login");
  }
})();
