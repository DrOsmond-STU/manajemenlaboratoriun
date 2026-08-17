/* ==========================================================================
   FLMS — Shell aplikasi, navigasi, dan router
   ========================================================================== */
(function () {
  const U = UI, D = DB;

  /* ------------------------------------------------------------------ nav */
  const NAV = [
    { type: "item", id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { type: "item", id: "exec", label: "Dashboard Manajemen", icon: "chart" },
    {
      type: "group", label: "Operations", icon: "calendar", children: [
        { id: "calendar", label: "Kalender" },
        { id: "booking", label: "Booking" },
        { id: "mybooking", label: "Booking Saya" },
        { id: "availability", label: "Room Availability" },
        { id: "eqbooking", label: "Reservasi Alat" },
        { id: "approval", label: "Approval", badge: 6 }
      ]
    },
    {
      type: "group", label: "Laboratory", icon: "flask", children: [
        { id: "lab", label: "Laboratorium" },
        { id: "equipment", label: "Alat Laboratorium" },
        { id: "equipment/new", label: "Registrasi Alat (BMN)" },
        { id: "eqbooking", label: "Booking Alat" },
        { id: "calibration", label: "Kalibrasi" },
        { id: "maintenance", label: "Maintenance" },
        { id: "labschedule", label: "Jadwal Laboratorium" }
      ]
    },
    {
      type: "group", label: "Facility", icon: "building", children: [
        { id: "rooms", label: "Ruangan" },
        { id: "meetingrooms", label: "Ruang Rapat" },
        { id: "auditorium", label: "Auditorium" },
        { id: "layout", label: "Room Layout" },
        { id: "facility", label: "Fasilitas & Add-on" },
        { id: "facilityschedule", label: "Jadwal Fasilitas" }
      ]
    },
    {
      type: "group", label: "Asset", icon: "box", children: [
        { id: "assets", label: "Asset Register" },
        { id: "bmn", label: "Register BMN (KIB B)" },
        { id: "barcode", label: "Label & Barcode" },
        { id: "assetmovement", label: "Asset Movement" },
        { id: "assetloan", label: "Peminjaman & Pengembalian" },
        { id: "maintenance", label: "Asset Maintenance" },
        { id: "assetaudit", label: "Audit Aset" }
      ]
    },
    {
      type: "group", label: "Rental", icon: "money", children: [
        { id: "rental", label: "Permohonan Sewa" },
        { id: "pricelist", label: "Daftar Tarif" },
        { id: "packages", label: "Paket Layanan" },
        { id: "quotation", label: "Quotation" },
        { id: "invoice", label: "Invoice" },
        { id: "payment", label: "Pembayaran" }
      ]
    },
    {
      type: "group", label: "Event", icon: "star", children: [
        { id: "events", label: "Event" },
        { id: "agenda", label: "Agenda" },
        { id: "participant", label: "Peserta" },
        { id: "vendor", label: "Vendor" },
        { id: "eventreport", label: "Laporan Event" }
      ]
    },
    {
      type: "group", label: "People", icon: "users", children: [
        { id: "users", label: "Pengguna" },
        { id: "pic", label: "PIC / Penanggung Jawab" },
        { id: "technician", label: "Teknisi & Operator" },
        { id: "visitor", label: "Pengunjung" },
        { id: "organization", label: "Organisasi" }
      ]
    },
    { type: "item", id: "documents", label: "Dokumen & BAST", icon: "doc" },
    {
      type: "group", label: "Report", icon: "chart", children: [
        { id: "reportutil", label: "Utilisasi" },
        { id: "reportroom", label: "Ruangan" },
        { id: "reportequip", label: "Alat" },
        { id: "reportasset", label: "Aset" },
        { id: "reportrental", label: "Penyewaan" },
        { id: "reportmaint", label: "Maintenance" },
        { id: "reportfinance", label: "Keuangan" }
      ]
    },
    {
      type: "group", label: "Administration", icon: "gear", children: [
        { id: "masterdata", label: "Master Data" },
        { id: "workflow", label: "Workflow" },
        { id: "roles", label: "Role & Hak Akses" },
        { id: "notification", label: "Notifikasi" },
        { id: "audit", label: "Audit Trail" },
        { id: "settings", label: "Pengaturan Sistem" }
      ]
    },
    { type: "item", id: "ai", label: "AI Assistant", icon: "sparkle" }
  ];

  /* Peta rute → label induk untuk breadcrumb */
  const PARENT = {};
  NAV.forEach((n) => {
    if (n.type === "group") n.children.forEach((c) => { if (!PARENT[c.id]) PARENT[c.id] = n.label; });
    else PARENT[n.id] = "Utama";
  });
  PARENT["booking/new"] = "Operations";

  /* ------------------------------------------------------------- sidebar */
  function navHTML(active) {
    return NAV.map((n) => {
      if (n.type === "item") {
        return `<a class="nav-item ${active === n.id ? "active" : ""}" href="#/${n.id}">
          ${U.icon(n.icon, 17, "ico")}<span>${n.label}</span></a>`;
      }
      const open = n.children.some((c) => c.id === active);
      return `<div class="nav-group">
        <div class="nav-item ${open ? "open" : ""}" onclick="toggleGroup(this)">
          ${U.icon(n.icon, 17, "ico")}<span>${n.label}</span>${U.icon("chev", 14, "chev")}</div>
        <div class="nav-sub ${open ? "open" : ""}">
          ${n.children.map((c) => `<a class="nav-item ${active === c.id ? "active" : ""}" href="#/${c.id}"
            style="position:relative"><span>${c.label}</span>${c.badge ? `<span class="pill">${c.badge}</span>` : ""}</a>`).join("")}
        </div></div>`;
    }).join("");
  }

  window.toggleGroup = function (el) {
    el.classList.toggle("open");
    el.nextElementSibling.classList.toggle("open");
  };

  /* ----------------------------------------------------------- pengguna */
  const SESSION = {
    name: localStorage.getItem("flms.user") || "Rahmat Hidayat",
    role: localStorage.getItem("flms.role") || "Facility Manager",
    unit: "Umum & Fasilitas"
  };

  /* -------------------------------------------------------------- router */
  function route() {
    const hash = (location.hash || "#/dashboard").replace(/^#\//, "");
    const id = hash || "dashboard";
    const view = window.VIEWS[id] || window.VIEWS["dashboard"];

    document.getElementById("sidebarNav").innerHTML = navHTML(id.split("/")[0] === "booking" && id !== "booking" ? "booking" : id);
    document.getElementById("crumbs").innerHTML =
      `<span>${PARENT[id] || "Utama"}</span>${U.icon("chev", 12)}<b>${view.title}</b>`;

    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="page-head">
        <div class="ttl"><h1>${view.title}</h1>${view.sub ? `<p>${view.sub}</p>` : ""}</div>
        ${view.actions ? `<div class="page-actions">${view.actions}</div>` : ""}
      </div>
      <div id="viewBody"></div>`;
    document.getElementById("viewBody").innerHTML = view.render();
    if (view.mount) view.mount();
    document.title = view.title + " · FLMS";
    window.scrollTo({ top: 0 });
    closeSidebar();
  }

  /* ------------------------------------------------------------ notifikasi */
  window.openNotif = function () {
    const ICON = { alert: "alert", check: "check", cal: "calendar", money: "money", wrench: "wrench", user: "users" };
    U.drawer({
      title: "Notifikasi", sub: D.notifications.filter((n) => n.unread).length + " belum dibaca",
      body: `<div class="col gap-4">
        ${D.notifications.map((n) => `
          <div class="row-t" style="padding:12px;border-radius:10px;background:${n.unread ? "var(--brand-50)" : "transparent"};cursor:pointer"
               onclick="UI.demo('Membuka detail notifikasi')">
            <div class="kpi-ico tint-${n.tone}" style="width:32px;height:32px;flex:0 0 32px">${U.icon(ICON[n.icon] || "bell", 15)}</div>
            <div style="flex:1;min-width:0">
              <div class="bold small">${U.esc(n.title)}</div>
              <div class="tiny muted">${U.esc(n.desc)}</div>
              <div class="tiny faint mt-4">${U.esc(n.time)}</div>
            </div>
            ${n.unread ? `<i style="width:7px;height:7px;border-radius:50%;background:var(--brand-500);margin-top:6px"></i>` : ""}
          </div>`).join("")}
      </div>`,
      foot: `<button class="btn btn-block" onclick="UI.demo('Semua notifikasi ditandai terbaca')">Tandai Semua Terbaca</button>
             <button class="btn btn-block" onclick="UI.closeDrawer();location.hash='#/notification'">Pengaturan</button>`
    });
  };

  window.openSearch = function () {
    const items = []
      .concat(D.rooms.map((r) => ({ t: r.name, s: r.code + " · Ruangan", h: "#/rooms" })))
      .concat(D.labs.map((l) => ({ t: l.name, s: l.code + " · Laboratorium", h: "#/lab" })))
      .concat(D.equipment.slice(0, 8).map((e) => ({ t: e.name, s: e.code + " · Alat", h: "#/equipment" })))
      .concat(D.bookings.slice(0, 6).map((b) => ({ t: b.agenda, s: b.id + " · Booking", h: "#/booking" })));
    U.modal({
      title: "Pencarian Global", sub: "Ruangan, laboratorium, alat, aset, booking, dokumen, dan pengguna",
      body: `<div class="tbl-search mb-16" style="padding:9px 12px">${U.icon("search", 16, "faint")}
          <input autofocus placeholder="Ketik untuk mencari…" oninput="searchFilter(this.value)"></div>
        <div id="searchRes" class="col gap-2">
          ${items.map((i) => `<a class="row" href="${i.h}" onclick="UI.closeModal()" style="padding:9px 11px;border-radius:9px;color:inherit;text-decoration:none">
            <span class="kpi-ico tint-slate" style="width:28px;height:28px;flex:0 0 28px">${U.icon("grid", 13)}</span>
            <div style="flex:1;min-width:0"><div class="small bold trunc">${U.esc(i.t)}</div><div class="tiny faint">${U.esc(i.s)}</div></div>
            ${U.icon("chev", 14, "faint")}</a>`).join("")}
        </div>`,
      foot: null
    });
    setTimeout(() => {
      document.querySelectorAll("#searchRes a").forEach((a) => {
        a.onmouseenter = () => a.style.background = "var(--surface-3)";
        a.onmouseleave = () => a.style.background = "";
      });
    }, 10);
  };
  window.searchFilter = function (q) {
    const s = q.toLowerCase();
    document.querySelectorAll("#searchRes a").forEach((a) => {
      a.style.display = a.innerText.toLowerCase().includes(s) ? "" : "none";
    });
  };

  window.openProfile = function () {
    U.drawer({
      title: "Profil Pengguna", sub: SESSION.role,
      body: `<div class="center mb-16">
          <div class="avatar lg" style="margin:0 auto 12px">${U.initials(SESSION.name)}</div>
          <h3>${U.esc(SESSION.name)}</h3><div class="small muted">${U.esc(SESSION.role)} · ${U.esc(SESSION.unit)}</div></div>
        <div class="dl small mb-16" style="grid-template-columns:110px 1fr">
          <dt>NIP</dt><dd class="mono">198703112010011002</dd>
          <dt>Email</dt><dd>rahmat.h@semestateknologi.co.id</dd>
          <dt>Telepon</dt><dd>0811-2200-101</dd>
          <dt>Lokasi</dt><dd>Kampus Utama Cikarang</dd>
        </div>
        <h4 class="muted mb-8">GANTI PERAN (DEMO)</h4>
        <div class="col gap-6">
          ${["Super Admin", "Facility Manager", "Laboratory Manager", "Asset Manager", "Finance", "Employee / User", "Management"]
            .map((r) => `<div class="role-opt ${SESSION.role === r ? "on" : ""}" onclick="switchRole('${r}')">${r}</div>`).join("")}
        </div>
        <div class="alert info small mt-16">${U.icon("shield", 15)}<div>Mengganti peran akan menyesuaikan menu, data, dan tindakan yang tersedia sesuai matriks hak akses.</div></div>`,
      foot: `<button class="btn btn-block" onclick="UI.demo('Halaman pengaturan akun')">Pengaturan Akun</button>
             <button class="btn btn-danger btn-block" onclick="location.href='index.html'">${U.icon("logout")} Keluar</button>`
    });
  };

  window.switchRole = function (r) {
    SESSION.role = r;
    localStorage.setItem("flms.role", r);
    U.closeDrawer();
    document.getElementById("userRole").textContent = r;
    U.toast("Peran diganti", "Anda kini masuk sebagai " + r + ".");
  };

  /* ---------------------------------------------------------------- tema */
  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", cur);
    localStorage.setItem("flms.theme", cur);
    document.getElementById("themeIco").innerHTML = U.icon(cur === "dark" ? "sun" : "moon", 17);
  };

  window.toggleSidebar = function () {
    document.querySelector(".sidebar").classList.toggle("open");
    let scrim = document.querySelector(".scrim");
    if (document.querySelector(".sidebar").classList.contains("open")) {
      if (!scrim) { scrim = document.createElement("div"); scrim.className = "scrim"; scrim.onclick = closeSidebar; document.body.appendChild(scrim); }
    } else closeSidebar();
  };
  function closeSidebar() {
    document.querySelector(".sidebar").classList.remove("open");
    const s = document.querySelector(".scrim"); if (s) s.remove();
  }

  /* --------------------------------------------------------------- init */
  function init() {
    const saved = localStorage.getItem("flms.theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);

    document.getElementById("app").innerHTML = `
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-mark">FL</div>
          <div class="brand-text"><b>FLMS</b><span>Facility &amp; Lab</span></div>
        </div>
        <div class="sidebar-scroll" id="sidebarNav"></div>
        <div class="sidebar-foot">
          <div class="ai-cta" onclick="location.hash='#/ai'">
            <div class="row"><div style="color:#fff">${U.icon("sparkle", 17)}</div>
              <div><b>AI Assistant</b><span>Tanya jadwal, aset, laporan</span></div></div>
          </div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn hamburger" onclick="toggleSidebar()">${U.icon("menu", 19)}</button>
          <div class="crumbs" id="crumbs"></div>
          <div class="spacer"></div>
          <div class="searchbox" onclick="openSearch()">${U.icon("search", 15)}
            <input placeholder="Cari ruangan, alat, aset, booking…" readonly><kbd>Ctrl K</kbd></div>
          <button class="icon-btn" onclick="qrScan()" title="Scan QR">${U.icon("qr", 18)}</button>
          <button class="icon-btn" onclick="toggleTheme()" title="Ganti tema"><span id="themeIco">${U.icon(saved === "dark" ? "sun" : "moon", 17)}</span></button>
          <button class="icon-btn" onclick="openNotif()" title="Notifikasi">${U.icon("bell", 18)}<i class="dot"></i></button>
          <div class="userchip" onclick="openProfile()">
            <span class="avatar">${U.initials(SESSION.name)}</span>
            <div class="nm"><b>${U.esc(SESSION.name)}</b><span id="userRole">${U.esc(SESSION.role)}</span></div>
            ${U.icon("chevD", 14, "faint")}
          </div>
        </header>
        <main class="content" id="content"></main>
      </div>`;

    window.addEventListener("hashchange", route);
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
    });
    if (!location.hash) location.hash = "#/dashboard";
    route();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
