/* ==========================================================================
   FLMS — UI kit: ikon, formatter, komponen, chart SVG, modal/drawer/toast
   ========================================================================== */
window.UI = (function () {

  /* ------------------------------------------------------------------ ikon */
  const PATHS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    booking: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M9 14l2 2 4-4"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7.5 14h9"/>',
    building: '<path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15M14 21V10h4a2 2 0 0 1 2 2v9M2 21h20"/><path d="M7 8h2M7 12h2M7 16h2"/>',
    box: '<path d="M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
    money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    star: '<path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9L12 3z"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.2A6.5 6.5 0 0 1 21.5 20"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l3.5-4 3 2.5L20 7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
    chevL: '<path d="M15 18l-6-6 6-6"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 19h2v2h-2zM14 19h2v2h-2zM19 14h2v2h-2z"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5l-8.2 8.2a2.8 2.8 0 0 1-4-4l7.2-9.2z"/><path d="M17.5 3.5l3 3"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7L12.5 19.5"/>',
    play: '<path d="M6 4l14 8-14 8V4z"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'
  };

  function icon(name, size, cls) {
    const p = PATHS[name] || PATHS.grid;
    const s = size || 16;
    return `<svg class="${cls || ''}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }

  /* ------------------------------------------------------------- formatter */
  const rp = (n) => "Rp " + (n || 0).toLocaleString("id-ID");
  const rpShort = (n) => {
    if (!n) return "Rp 0";
    if (n >= 1e9) return "Rp " + (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1).replace(".", ",") + " M";
    if (n >= 1e6) return "Rp " + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1).replace(".", ",") + " Jt";
    if (n >= 1e3) return "Rp " + Math.round(n / 1e3) + " Rb";
    return "Rp " + n;
  };
  const num = (n) => (n || 0).toLocaleString("id-ID");
  const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  function fdate(s, style) {
    if (!s || s === "-") return "—";
    const d = new Date(s + (s.length === 10 ? "T00:00:00" : ""));
    if (isNaN(d)) return s;
    if (style === "long") return DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
    if (style === "short") return d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getFullYear();
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  }
  const initials = (n) => (n || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ------------------------------------------------- pemetaan warna status */
  const TONE = {
    // umum
    "Available": "green", "Tersedia": "green", "Aktif": "green", "Approved": "green", "Disetujui": "green",
    "Completed": "green", "Selesai": "green", "Paid": "green", "Lulus": "green", "Terverifikasi": "green",
    "Berlaku": "green", "Final": "green", "Ditandatangani": "green", "Baik": "green", "Terkonfirmasi": "green",
    "In Use": "brand", "Digunakan": "brand", "Booked": "brand", "Dipinjam": "brand", "Borrowed": "brand",
    "Reserved": "brand", "Di Dalam": "brand", "In Progress": "brand", "Terkirim": "brand", "Persiapan": "brand",
    "Waiting Approval": "amber", "Menunggu Verifikasi": "amber", "Pending": "amber", "Scheduled": "amber",
    "Terjadwal": "amber", "Menunggu TTD": "amber", "Waiting Payment": "amber", "Menunggu Pembayaran": "amber",
    "Quotation": "amber", "Negosiasi": "amber", "Inspeksi": "amber", "Waiting Part": "amber",
    "Calibration": "violet", "Kalibrasi": "violet", "Maintenance": "violet", "Renovasi": "violet",
    "Perlu Perawatan": "amber", "Lulus Bersyarat": "amber", "Cuti": "amber",
    "Broken": "red", "Rusak": "red", "Overdue": "red", "Terlambat": "red", "Cancelled": "red",
    "Batal": "red", "Tidak Lulus": "red", "Kadaluarsa": "red", "Lost": "red", "Hilang": "red",
    "Perlu Perbaikan": "red", "Rusak Ringan": "amber", "Rusak Berat": "red",
    "Retired": "slate", "Disposal": "slate", "Draft": "slate", "Tidak Digunakan": "slate"
  };
  const tone = (s) => TONE[s] || "slate";
  const badge = (s, extra) => `<span class="badge ${tone(s)} ${extra || ""}"><i class="bdot"></i>${esc(s)}</span>`;
  const PRICING_LABEL = {
    FREE_INTERNAL: ["Gratis Internal", "teal"], PAID: ["Berbayar", "amber"],
    INTERNAL: ["Internal", "brand"], EXTERNAL: ["Eksternal", "violet"], RESTRICTED: ["Terbatas", "red"]
  };
  function pricingBadge(p) {
    const [l, t] = PRICING_LABEL[p] || [p, "slate"];
    return `<span class="badge ${t}">${l}</span>`;
  }

  /* ------------------------------------------------------------- komponen */
  function kpi(o) {
    return `<div class="card kpi">
      <div class="kpi-top">
        <div class="kpi-ico tint-${o.tint || "brand"}">${icon(o.icon || "grid", 17)}</div>
        <div class="kpi-label">${esc(o.label)}</div>
      </div>
      <div class="kpi-val">${o.value}${o.suffix ? `<small> ${o.suffix}</small>` : ""}</div>
      <div class="kpi-foot">
        ${o.delta != null ? `<span class="delta ${o.delta > 0 ? "up" : o.delta < 0 ? "down" : "flat"}">${o.delta > 0 ? "▲" : o.delta < 0 ? "▼" : "■"} ${Math.abs(o.delta)}%</span>` : ""}
        <span class="faint">${esc(o.note || "")}</span>
      </div>
    </div>`;
  }

  function card(title, body, opts) {
    const o = opts || {};
    return `<div class="card ${o.cls || ""}">
      ${title ? `<div class="card-head">
        <div><h3>${title}</h3>${o.sub ? `<div class="sub">${o.sub}</div>` : ""}</div>
        ${o.tools ? `<div class="card-tools">${o.tools}</div>` : ""}
      </div>` : ""}
      <div class="card-body ${o.bodyCls || ""}">${body}</div>
      ${o.foot ? `<div class="card-foot">${o.foot}</div>` : ""}
    </div>`;
  }

  function emptyState(title, desc, action) {
    return `<div class="empty"><div class="eico">${icon("box", 24)}</div>
      <b>${esc(title)}</b><div class="small">${esc(desc || "")}</div>
      ${action ? `<div class="mt-16">${action}</div>` : ""}</div>`;
  }

  /* Tabel generik: cols = [{k, t, w, cls, render(row)}] */
  function table(cols, rows, opts) {
    const o = opts || {};
    if (!rows.length) return emptyState("Belum ada data", "Data akan muncul setelah transaksi dibuat.");
    const head = cols.map((c) => `<th style="${c.w ? "width:" + c.w : ""}" class="${c.cls || ""}">${c.t}</th>`).join("");
    const body = rows.map((r, i) => {
      const tds = cols.map((c) => `<td class="${c.cls || ""}">${c.render ? c.render(r, i) : esc(r[c.k])}</td>`).join("");
      return `<tr ${o.rowAttr ? o.rowAttr(r) : ""}>${tds}</tr>`;
    }).join("");
    return `<div class="table-wrap"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function toolbar(o) {
    return `<div class="tbl-toolbar">
      <div class="tbl-search">${icon("search", 15, "faint")}<input placeholder="${o.ph || "Cari…"}" oninput="UI.filterTable(this)"></div>
      ${(o.filters || []).map((f) => `<select class="select" style="width:auto;min-width:132px">${f.map((x, i) => `<option${i === 0 ? "" : ""}>${x}</option>`).join("")}</select>`).join("")}
      <div class="spacer"></div>
      ${o.right || ""}
    </div>`;
  }

  /* Filter client-side sederhana untuk purwarupa */
  function filterTable(input) {
    const wrap = input.closest(".card") || document;
    const q = input.value.toLowerCase();
    wrap.querySelectorAll("table.tbl tbody tr").forEach((tr) => {
      tr.style.display = tr.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  }

  function pager(total, page, size) {
    const pages = Math.max(1, Math.ceil(total / size));
    const from = total ? (page - 1) * size + 1 : 0;
    const to = Math.min(total, page * size);
    let btns = "";
    for (let i = 1; i <= Math.min(pages, 5); i++) btns += `<span class="pbtn ${i === page ? "on" : ""}">${i}</span>`;
    return `<div class="pager"><span>Menampilkan <b>${from}–${to}</b> dari <b>${total}</b> data</span>
      <div class="spacer"></div><span class="pbtn">‹</span>${btns}<span class="pbtn">›</span></div>`;
  }

  function stepper(steps, current) {
    return `<div class="stepper">` + steps.map((s, i) => {
      const cls = i < current ? "done" : i === current ? "now" : "";
      const line = i < steps.length - 1 ? `<div class="step-line ${i < current ? "done" : ""}"></div>` : "";
      return `<div class="step ${cls}"><div class="sn">${i < current ? "✓" : i + 1}</div><div class="st">${esc(s)}</div></div>${line}`;
    }).join("") + `</div>`;
  }

  function meter(label, val, color, right) {
    return `<div class="meter-row"><div>
      <div class="mlabel">${label}</div>
      <div class="bar"><i style="width:${Math.min(100, val)}%;background:${color || "var(--brand-500)"}"></i></div>
    </div><div class="mval">${right != null ? right : val + "%"}</div></div>`;
  }

  /* --------------------------------------------------------------- charts */
  function areaChart(series, opts) {
    const o = Object.assign({ w: 640, h: 190, pad: 28, colors: ["var(--brand-500)", "var(--teal-500)", "var(--violet-500)"], max: 100 }, opts || {});
    const keys = Object.keys(series[0]).filter((k) => k !== "m");
    const n = series.length;
    const iw = o.w - o.pad * 2, ih = o.h - o.pad - 22;
    const x = (i) => o.pad + (iw * i) / (n - 1);
    const y = (v) => o.pad + ih - (ih * v) / o.max;
    let out = `<svg viewBox="0 0 ${o.w} ${o.h}" width="100%" height="${o.h}" preserveAspectRatio="none" style="overflow:visible">`;
    for (let g = 0; g <= 4; g++) {
      const gy = o.pad + (ih * g) / 4;
      out += `<line x1="${o.pad}" y1="${gy}" x2="${o.w - o.pad}" y2="${gy}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 4"/>`;
      out += `<text x="${o.pad - 8}" y="${gy + 3.5}" font-size="9.5" fill="var(--text-faint)" text-anchor="end">${Math.round(o.max - (o.max * g) / 4)}</text>`;
    }
    keys.forEach((k, ki) => {
      const c = o.colors[ki % o.colors.length];
      const pts = series.map((d, i) => `${x(i)},${y(d[k])}`).join(" ");
      out += `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
      out += `<polygon points="${pts} ${x(n - 1)},${o.pad + ih} ${x(0)},${o.pad + ih}" fill="${c}" opacity=".08"/>`;
      series.forEach((d, i) => { out += `<circle cx="${x(i)}" cy="${y(d[k])}" r="2.6" fill="var(--surface)" stroke="${c}" stroke-width="1.8"/>`; });
    });
    series.forEach((d, i) => {
      out += `<text x="${x(i)}" y="${o.h - 5}" font-size="10" fill="var(--text-faint)" text-anchor="middle">${d.m}</text>`;
    });
    return out + `</svg>`;
  }

  function barChart(data, opts) {
    const o = Object.assign({ w: 560, h: 180, pad: 30, color: "var(--brand-500)", fmt: (v) => v }, opts || {});
    const max = Math.max.apply(null, data.map((d) => d.val)) * 1.15 || 1;
    const iw = o.w - o.pad * 2, ih = o.h - o.pad - 22;
    const bw = (iw / data.length) * 0.56;
    let out = `<svg viewBox="0 0 ${o.w} ${o.h}" width="100%" height="${o.h}" style="overflow:visible">`;
    for (let g = 0; g <= 3; g++) {
      const gy = o.pad + (ih * g) / 3;
      out += `<line x1="${o.pad}" y1="${gy}" x2="${o.w - o.pad}" y2="${gy}" stroke="var(--border)" stroke-dasharray="3 4"/>`;
    }
    data.forEach((d, i) => {
      const cx = o.pad + (iw * (i + 0.5)) / data.length;
      const bh = (ih * d.val) / max;
      out += `<rect x="${cx - bw / 2}" y="${o.pad + ih - bh}" width="${bw}" height="${bh}" rx="4" fill="${o.color}" opacity=".92"/>`;
      out += `<text x="${cx}" y="${o.pad + ih - bh - 6}" font-size="9.5" font-weight="700" fill="var(--text-muted)" text-anchor="middle">${o.fmt(d.val)}</text>`;
      out += `<text x="${cx}" y="${o.h - 5}" font-size="10" fill="var(--text-faint)" text-anchor="middle">${d.m}</text>`;
    });
    return out + `</svg>`;
  }

  function donut(data, opts) {
    const o = Object.assign({ size: 172, thick: 26 }, opts || {});
    const total = data.reduce((a, b) => a + b.v, 0) || 1;
    const r = o.size / 2 - o.thick / 2 - 2;
    const c = o.size / 2;
    const circ = 2 * Math.PI * r;
    let off = 0;
    let out = `<svg viewBox="0 0 ${o.size} ${o.size}" width="${o.size}" height="${o.size}">`;
    out += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${o.thick}"/>`;
    data.forEach((d) => {
      const len = (d.v / total) * circ;
      out += `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${d.c}" stroke-width="${o.thick}"
        stroke-dasharray="${len - 2.5} ${circ - len + 2.5}" stroke-dashoffset="${-off}"
        transform="rotate(-90 ${c} ${c})" stroke-linecap="round"/>`;
      off += len;
    });
    out += `<text x="${c}" y="${c - 3}" text-anchor="middle" font-size="23" font-weight="700" fill="var(--text)">${num(total)}</text>`;
    out += `<text x="${c}" y="${c + 15}" text-anchor="middle" font-size="10.5" fill="var(--text-muted)">${o.label || "Total"}</text>`;
    return out + `</svg>`;
  }

  function hbars(items, opts) {
    const o = Object.assign({ color: "var(--brand-500)", suffix: "%" }, opts || {});
    const max = Math.max.apply(null, items.map((i) => i.v)) || 1;
    return items.map((i) => `<div class="meter-row"><div>
      <div class="mlabel"><span class="trunc" style="max-width:250px">${esc(i.n)}</span></div>
      <div class="bar"><i style="width:${(i.v / max) * 100}%;background:${o.color}"></i></div>
    </div><div class="mval">${i.v}${o.suffix}</div></div>`).join("");
  }

  function heatmap(grid, rowsLbl, colsLbl) {
    const max = Math.max.apply(null, grid.flat()) || 1;
    let out = `<div style="display:grid;grid-template-columns:44px repeat(${colsLbl.length},minmax(0,1fr));gap:3px;font-size:10px">`;
    out += `<div></div>` + colsLbl.map((c) => `<div class="center faint">${c}</div>`).join("");
    grid.forEach((row, ri) => {
      out += `<div class="faint" style="display:flex;align-items:center">${rowsLbl[ri]}</div>`;
      row.forEach((v) => {
        const a = 0.08 + (v / max) * 0.92;
        out += `<div title="${v}%" style="aspect-ratio:1.6;border-radius:4px;background:color-mix(in srgb, var(--brand-500) ${Math.round(a * 100)}%, transparent);display:grid;place-items:center;color:${a > .55 ? "#fff" : "var(--text-muted)"};font-size:9.5px;font-weight:600">${v}</div>`;
      });
    });
    return out + `</div>`;
  }

  function sparkline(vals, color) {
    const w = 108, h = 30;
    const max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    const rng = max - min || 1;
    const pts = vals.map((v, i) => `${(w * i) / (vals.length - 1)},${h - 3 - ((v - min) / rng) * (h - 8)}`).join(" ");
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none"
      stroke="${color || "var(--brand-500)"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  /** QR sungguhan (dapat dipindai) — didelegasikan ke encoder Barcode. */
  function qrBox(text, size) {
    const svg = window.Barcode && window.Barcode.qr(String(text), { size: size || 96 });
    return `<div class="qr" style="padding:4px">${svg ||
      `<div class="tiny faint center">muatan<br>terlalu panjang</div>`}</div>`;
  }

  function seatMap(rows, cols, vipRows) {
    let out = `<div class="seatmap" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">`;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const vip = r < (vipRows || 0);
      const sold = !vip && ((r * cols + c) % 7 === 0);
      out += `<div class="seat ${vip ? "vip" : ""} ${sold ? "sold" : ""}"></div>`;
    }
    return out + `</div>`;
  }

  /* Denah ruangan sederhana per layout */
  function layoutDiagram(kind, w, h) {
    const W = w || 200, H = h || 118;
    const g = (x, y, rw, rh, c) => `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="2" fill="${c || "var(--brand-400)"}"/>`;
    let inner = "";
    if (kind === "Theater") {
      for (let r = 0; r < 5; r++) for (let c = 0; c < 11; c++) inner += g(24 + c * 15, 40 + r * 13, 10, 7);
      inner += g(70, 16, 60, 12, "var(--violet-500)");
    } else if (kind === "Classroom") {
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { inner += g(28 + c * 42, 40 + r * 17, 30, 6, "var(--slate-500)"); inner += g(34 + c * 42, 48 + r * 17, 18, 5); }
      inner += g(70, 16, 60, 10, "var(--violet-500)");
    } else if (kind === "U-Shape") {
      inner += g(40, 30, 12, 62, "var(--slate-500)") + g(148, 30, 12, 62, "var(--slate-500)") + g(40, 30, 120, 12, "var(--slate-500)");
      for (let i = 0; i < 5; i++) { inner += g(24, 34 + i * 12, 10, 7); inner += g(166, 34 + i * 12, 10, 7); }
      for (let i = 0; i < 7; i++) inner += g(44 + i * 16, 18, 8, 8);
    } else if (kind === "Boardroom") {
      inner += g(45, 40, 110, 38, "var(--slate-500)");
      for (let i = 0; i < 6; i++) { inner += g(48 + i * 18, 28, 12, 8); inner += g(48 + i * 18, 82, 12, 8); }
      inner += g(28, 52, 8, 14) + g(164, 52, 8, 14);
    } else if (kind === "Banquet") {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const cx = 46 + c * 56, cy = 42 + r * 40;
        inner += `<circle cx="${cx}" cy="${cy}" r="14" fill="var(--slate-500)"/>`;
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; inner += `<circle cx="${cx + Math.cos(a) * 20}" cy="${cy + Math.sin(a) * 20}" r="3.4" fill="var(--brand-400)"/>`; }
      }
    } else { // Cluster
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const x = 30 + c * 54, y = 34 + r * 40;
        inner += g(x, y, 30, 20, "var(--slate-500)");
        inner += g(x - 8, y + 4, 6, 11) + g(x + 32, y + 4, 6, 11) + g(x + 10, y - 8, 11, 6) + g(x + 10, y + 22, 11, 6);
      }
    }
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="background:var(--surface-2);border-radius:8px">
      <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="6" fill="none" stroke="var(--border-strong)" stroke-width="1.4"/>${inner}</svg>`;
  }

  /* --------------------------------------------------- modal/drawer/toast */
  let modalEl = null, drawerEl = null;
  function modal(opts) {
    closeModal();
    const o = opts || {};
    modalEl = document.createElement("div");
    modalEl.className = "overlay";
    modalEl.innerHTML = `<div class="modal ${o.size || ""}" onclick="event.stopPropagation()">
      <div class="modal-head">
        <div style="flex:1"><h3>${o.title || ""}</h3>${o.sub ? `<div class="sub">${o.sub}</div>` : ""}</div>
        <button class="icon-btn" onclick="UI.closeModal()">${icon("x", 16)}</button>
      </div>
      <div class="modal-body">${o.body || ""}</div>
      ${o.foot !== null ? `<div class="modal-foot">${o.foot || `<button class="btn" onclick="UI.closeModal()">Tutup</button>`}</div>` : ""}
    </div>`;
    modalEl.addEventListener("click", closeModal);
    document.body.appendChild(modalEl);
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; document.body.style.overflow = ""; }
  }
  function drawer(opts) {
    closeDrawer();
    const o = opts || {};
    const scrim = document.createElement("div");
    scrim.className = "overlay";
    scrim.style.cssText = "background:rgba(11,17,32,.35);backdrop-filter:none;padding:0;justify-content:flex-end";
    scrim.innerHTML = `<div class="drawer ${o.size || ""}" onclick="event.stopPropagation()">
      <div class="drawer-head"><div style="flex:1"><h3>${o.title || ""}</h3>${o.sub ? `<div class="small muted">${o.sub}</div>` : ""}</div>
      <button class="icon-btn" onclick="UI.closeDrawer()">${icon("x", 16)}</button></div>
      <div class="drawer-body">${o.body || ""}</div>
      ${o.foot ? `<div class="drawer-foot">${o.foot}</div>` : ""}</div>`;
    scrim.addEventListener("click", closeDrawer);
    document.body.appendChild(scrim);
    drawerEl = scrim;
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    if (drawerEl) { drawerEl.remove(); drawerEl = null; document.body.style.overflow = ""; }
  }

  function toast(title, desc, kind) {
    let host = document.querySelector(".toasts");
    if (!host) { host = document.createElement("div"); host.className = "toasts"; document.body.appendChild(host); }
    const t = document.createElement("div");
    t.className = "toast " + (kind || "ok");
    const ic = { ok: "check", warn: "alert", err: "x", info: "bell" }[kind || "ok"];
    t.innerHTML = `<div class="tint-${kind === "err" ? "red" : kind === "warn" ? "amber" : "green"}"
      style="width:26px;height:26px;border-radius:8px;display:grid;place-items:center;flex:0 0 26px">${icon(ic, 14)}</div>
      <div><b>${esc(title)}</b><span>${esc(desc || "")}</span></div>`;
    host.appendChild(t);
    setTimeout(() => { t.style.transition = "opacity .3s, transform .3s"; t.style.opacity = "0"; t.style.transform = "translateX(20px)"; setTimeout(() => t.remove(), 320); }, 3600);
  }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); closeDrawer(); } });

  /* Placeholder aksi purwarupa */
  function demo(msg) { toast("Purwarupa", msg || "Aksi ini disimulasikan pada purwarupa.", "info"); }

  return {
    icon, rp, rpShort, num, fdate, initials, esc, MONTHS, DAYS,
    badge, tone, pricingBadge, kpi, card, table, toolbar, filterTable, pager, stepper,
    meter, emptyState, areaChart, barChart, donut, hbars, heatmap, sparkline, qrBox,
    seatMap, layoutDiagram, modal, closeModal, drawer, closeDrawer, toast, demo
  };
})();
