/* ==========================================================================
   FLMS — Views: Dashboard, Kalender, Booking, Ketersediaan, Reservasi Alat
   ========================================================================== */
window.VIEWS = window.VIEWS || {};
(function () {
  const U = UI, D = DB;
  const V = window.VIEWS;

  /* Dashboard Operasional dan Dashboard Manajemen kini dibangun dengan mesin
     widget yang dapat disunting — lihat assets/js/dash.js dan views-dash.js. */

  /* =======================================================================
     KALENDER
     ======================================================================= */
  const CAL = { month: new Date().getMonth(), year: new Date().getFullYear(), mode: "Bulan" };

  V["calendar"] = {
    title: "Kalender Terpadu",
    sub: "Jadwal seluruh ruangan, laboratorium, alat, dan event dalam satu tampilan.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Sinkronisasi ke Google Calendar / Outlook')">${U.icon("link")} Sinkron Kalender</button>
              <button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Booking Baru</button>`,
    render() { return calendarHTML(); }
  };

  window.calNav = function (delta) {
    CAL.month += delta;
    if (CAL.month < 0) { CAL.month = 11; CAL.year--; }
    if (CAL.month > 11) { CAL.month = 0; CAL.year++; }
    document.getElementById("calHost").innerHTML = calendarHTML();
  };
  window.calMode = function (m) { CAL.mode = m; document.getElementById("calHost").innerHTML = calendarHTML(); };

  function evTone(b) {
    return { "Laboratorium": "ev-teal", "Auditorium": "ev-violet", "Ruangan": "ev-blue" }[b.type] ||
      (b.status === "Cancelled" ? "ev-red" : "ev-slate");
  }

  function calendarHTML() {
    const first = new Date(CAL.year, CAL.month, 1);
    const startDay = (first.getDay() + 6) % 7; // Senin = 0
    const daysInMonth = new Date(CAL.year, CAL.month + 1, 0).getDate();
    const prevDays = new Date(CAL.year, CAL.month, 0).getDate();
    const todayISO = D.shift(0);

    const evByDate = {};
    D.bookings.forEach((b) => { (evByDate[b.date] = evByDate[b.date] || []).push(b); });
    D.eqBookings.forEach((b) => {
      (evByDate[b.date] = evByDate[b.date] || []).push({ id: b.id, date: b.date, start: b.start, end: b.end, agenda: b.eqName, resName: b.eqName, type: "Alat", status: b.status, requester: b.requester, people: 1, unit: b.unit, pic: b.operator, addons: [], cost: 0, layout: "-", kind: "Reservasi Alat", billing: "INTERNAL" });
    });
    D.maintenance.filter((m) => m.block).forEach((m) => {
      (evByDate[m.sched] = evByDate[m.sched] || []).push({ id: m.id, date: m.sched, start: "00:00", end: "23:59", agenda: "Maintenance: " + m.targetName, resName: m.targetName, type: "Maintenance", status: m.status, requester: m.tech, people: 0, unit: "Fasilitas", pic: m.tech, addons: [], cost: m.cost, layout: "-", kind: "Maintenance", billing: "INTERNAL" });
    });

    let cells = "";
    for (let i = 0; i < 42; i++) {
      const dnum = i - startDay + 1;
      const out = dnum < 1 || dnum > daysInMonth;
      const show = out ? (dnum < 1 ? prevDays + dnum : dnum - daysInMonth) : dnum;
      const dISO = out ? "" : `${CAL.year}-${String(CAL.month + 1).padStart(2, "0")}-${String(dnum).padStart(2, "0")}`;
      const evs = (evByDate[dISO] || []).sort((a, b) => a.start.localeCompare(b.start));
      const shown = evs.slice(0, 3).map((e) => {
        const cls = e.type === "Maintenance" ? "ev-amber" : evTone(e);
        return `<div class="cal-ev ${cls}" onclick="showBooking('${e.id}')">${e.start !== "00:00" ? e.start + " " : ""}${U.esc(e.agenda)}</div>`;
      }).join("");
      const more = evs.length > 3 ? `<div class="cal-more">+${evs.length - 3} lainnya</div>` : "";
      cells += `<div class="cal-cell ${out ? "out" : ""} ${dISO === todayISO ? "today" : ""}">
        <div class="cal-date">${show}</div>${shown}${more}</div>`;
    }

    const stats = ["Ruangan", "Laboratorium", "Alat", "Auditorium", "Maintenance"];
    return `
      <div class="cal-page mb-16">
        <div class="card">
          <div class="card-head">
            <button class="icon-btn" onclick="calNav(-1)">${U.icon("chevL", 17)}</button>
            <h3 style="min-width:170px;text-align:center">${U.MONTHS[CAL.month]} ${CAL.year}</h3>
            <button class="icon-btn" onclick="calNav(1)">${U.icon("chev", 17)}</button>
            <button class="btn btn-sm" onclick="calNav(0)">Hari Ini</button>
            <div class="card-tools">
              <div class="seg">${["Hari", "Minggu", "Bulan", "Tahun"].map((m) => `<button class="${CAL.mode === m ? "active" : ""}" onclick="calMode('${m}')">${m}</button>`).join("")}</div>
            </div>
          </div>
          <div class="card-body flush">
            ${CAL.mode === "Bulan" ? `
              <div class="cal" style="border:0;border-radius:0">
                <div class="cal-head">${["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => `<div>${d}</div>`).join("")}</div>
                <div class="cal-grid">${cells}</div>
              </div>` : dayWeekView()}
          </div>
        </div>

        <div class="col gap-16">
          ${U.card("Filter", `
            <div class="col gap-12">
              <div class="field"><label>Jenis Resource</label>
                <div class="row wrap gap-6">${stats.map((s, i) => `<span class="chip ${i < 3 ? "on" : ""}" onclick="this.classList.toggle('on')">${s}</span>`).join("")}</div></div>
              <div class="field"><label>Gedung</label><select class="select"><option>Semua Gedung</option>${D.org.buildings.map((b) => `<option>${b.name}</option>`).join("")}</select></div>
              <div class="field"><label>Unit Kerja</label><select class="select"><option>Semua Unit</option>${D.org.units.map((u) => `<option>${u}</option>`).join("")}</select></div>
              <div class="field"><label>PIC</label><select class="select"><option>Semua PIC</option>${D.people.slice(0, 6).map((p) => `<option>${p.name}</option>`).join("")}</select></div>
              <div class="field"><label>Status Booking</label>
                <div class="row wrap gap-6">${["Approved", "Waiting Approval", "In Use", "Completed", "Cancelled"].map((s, i) => `<span class="chip ${i < 3 ? "on" : ""}" onclick="this.classList.toggle('on')">${s}</span>`).join("")}</div></div>
            </div>`, { tools: `<button class="btn btn-sm btn-ghost" onclick="UI.demo('Filter direset')">Reset</button>` })}

          ${U.card("Legenda", `<div class="col gap-8 small">
            <div class="row"><i style="width:11px;height:11px;border-radius:3px;background:var(--brand-400)"></i>Booking Ruangan</div>
            <div class="row"><i style="width:11px;height:11px;border-radius:3px;background:var(--teal-500)"></i>Penggunaan Laboratorium</div>
            <div class="row"><i style="width:11px;height:11px;border-radius:3px;background:var(--violet-500)"></i>Event / Auditorium</div>
            <div class="row"><i style="width:11px;height:11px;border-radius:3px;background:var(--amber-500)"></i>Maintenance / Kalibrasi</div>
            <div class="row"><i style="width:11px;height:11px;border-radius:3px;background:var(--red-500)"></i>Dibatalkan</div>
          </div>`)}
        </div>
      </div>`;
  }

  function dayWeekView() {
    const rows = D.rooms.slice(0, 6);
    return `<div class="p-16" style="padding:16px">${timelineHTML(rows, D.shift(0))}</div>`;
  }

  /* =======================================================================
     TIMELINE KETERSEDIAAN
     ======================================================================= */
  const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

  function timelineHTML(rows, date) {
    const H0 = HOURS[0], H1 = HOURS[HOURS.length - 1] + 1, span = H1 - H0;
    const pos = (t) => { const [h, m] = t.split(":").map(Number); return ((h + m / 60 - H0) / span) * 100; };

    const head = `<div class="tl-row tl-head">
      <div class="tl-label"><b class="small">Ruangan / Resource</b></div>
      <div class="tl-slots" style="grid-template-columns:repeat(${span},1fr)">
        ${HOURS.map((h) => `<div class="tl-hour">${String(h).padStart(2, "0")}:00</div>`).join("")}
      </div></div>`;

    const body = rows.map((r) => {
      const evs = D.bookings.filter((b) => b.res === r.id && b.date === date && b.status !== "Cancelled");
      const isMaint = D.maintenance.some((m) => m.target === r.id && m.block);
      const blocks = evs.map((b) => {
        const l = pos(b.start), w = pos(b.end) - l;
        return `<div class="tl-block ${evTone(b)}" style="left:${l}%;width:${w}%" onclick="showBooking('${b.id}')"
          title="${U.esc(b.agenda)}">${b.start}–${b.end} · ${U.esc(b.agenda)}</div>`;
      }).join("") + (isMaint ? `<div class="tl-block ev-amber" style="left:0;width:100%" onclick="UI.demo('Resource diblokir maintenance')">${U.icon("wrench", 12)} Diblokir — Maintenance</div>` : "");
      return `<div class="tl-row">
        <div class="tl-label">
          <div class="kpi-ico tint-${r.type === "Auditorium" ? "violet" : "brand"}" style="width:26px;height:26px;flex:0 0 26px">${U.icon(r.type === "Auditorium" ? "star" : "building", 13)}</div>
          <div style="min-width:0"><div class="rname trunc">${U.esc(r.name)}</div><div class="rmeta">${r.code} • ${r.cap} pax</div></div>
        </div>
        <div class="tl-slots" style="grid-template-columns:repeat(${span},1fr)">
          <div class="tl-track" style="grid-column:1/-1;position:relative">
            ${HOURS.map((h, i) => `<div class="gridline" style="left:${((i + 1) / span) * 100}%"></div>`).join("")}
            ${blocks}
          </div>
        </div></div>`;
    }).join("");

    return `<div class="tl"><div class="tl-inner">${head}${body}</div></div>`;
  }

  V["availability"] = {
    title: "Room Availability",
    sub: "Papan ketersediaan real-time seluruh ruangan dengan deteksi benturan jadwal.",
    actions: `<input type="date" class="input" style="width:auto" value="${D.shift(0)}" onchange="UI.demo('Tanggal diubah ke '+this.value)">
              <button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Booking</button>`,
    render() {
      const stat = ["Available", "Booked", "Pending", "Maintenance", "Reserved"];
      const counts = {}; stat.forEach((s) => counts[s] = D.rooms.filter((r) => r.status === s).length);
      return `
        <div class="grid g5 mb-16">
          ${stat.map((s, i) => U.kpi({ label: s, value: counts[s], icon: ["check", "calendar", "clock", "wrench", "shield"][i], tint: ["green", "brand", "amber", "violet", "slate"][i], note: "dari " + D.rooms.length + " ruangan" })).join("")}
        </div>
        ${U.card("Timeline Ketersediaan — " + U.fdate(D.shift(0), "long"), timelineHTML(D.rooms, D.shift(0)), {
          sub: "Klik blok untuk melihat detail booking",
          tools: `<div class="legend">
            <span><i style="background:var(--brand-400)"></i>Ruangan</span>
            <span><i style="background:var(--teal-500)"></i>Lab</span>
            <span><i style="background:var(--violet-500)"></i>Event</span>
            <span><i style="background:var(--amber-500)"></i>Maintenance</span></div>`
        })}
        <div class="mt-16">
        ${U.card("Timeline Laboratorium", timelineHTML(D.labs, D.shift(0)), { sub: "Jadwal penggunaan laboratorium hari ini" })}
        </div>`;
    }
  };

  /* =======================================================================
     DETAIL BOOKING (drawer)
     ======================================================================= */
  /* Detail versi PURWARUPA — masih membaca data.js. Dipakai kalender, agenda,
     dan reservasi alat yang belum dikonversi. */
  window.showBookingPurwarupa = function (id) {
    const b = D.bookings.find((x) => x.id === id) || D.eqBookings.find((x) => x.id === id) ||
      D.maintenance.find((x) => x.id === id);
    if (!b) { U.demo("Detail tidak tersedia pada purwarupa."); return; }
    if (b.sched) { // maintenance
      U.drawer({
        title: "Work Order Maintenance", sub: b.id,
        body: `<div class="dl">
          <dt>Target</dt><dd>${U.esc(b.targetName)}</dd>
          <dt>Jenis</dt><dd>${b.kind}</dd>
          <dt>Jadwal</dt><dd>${U.fdate(b.sched, "long")}</dd>
          <dt>Vendor</dt><dd>${U.esc(b.vendor)}</dd>
          <dt>Teknisi</dt><dd>${U.esc(D.personName(b.tech))}</dd>
          <dt>Estimasi Biaya</dt><dd>${U.rp(b.cost)}</dd>
          <dt>Status</dt><dd>${U.badge(b.status)}</dd>
          <dt>Blokir Booking</dt><dd>${b.block ? `<span class="badge red">Ya — resource tidak dapat dibooking</span>` : `<span class="badge green">Tidak</span>`}</dd>
          <dt>Catatan</dt><dd>${U.esc(b.note)}</dd></div>`,
        foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button><button class="btn btn-primary" onclick="UI.demo('Work order diperbarui')">Perbarui Status</button>`
      });
      return;
    }
    const isEq = !!b.eq;
    const wf = ["Request", "Approval", "Reservation", "Usage", "Return", "Inspection", "Closing"];
    const cur = { "Waiting Approval": 1, "Approved": 2, "In Use": 3, "Borrowed": 3, "Completed": 6, "Quotation": 1, "Waiting Payment": 1, "Cancelled": 1 }[b.status] || 2;

    U.drawer({
      size: "wide",
      title: isEq ? "Detail Reservasi Alat" : "Detail Booking",
      sub: b.id + " • " + U.fdate(b.date, "long"),
      body: `
        <div class="mb-16">${U.stepper(wf, cur)}</div>
        <div class="dl mb-16">
          <dt>Agenda / Tujuan</dt><dd>${U.esc(b.agenda || b.purpose)}</dd>
          <dt>Resource</dt><dd>${U.esc(b.resName || b.eqName)}</dd>
          <dt>Pemohon</dt><dd>${U.esc(D.personName(b.requester))} <span class="muted">— ${U.esc(b.unit)}</span></dd>
          <dt>Waktu</dt><dd>${b.start} – ${b.end} WIB</dd>
          ${!isEq ? `<dt>Jumlah Peserta</dt><dd>${b.people} orang</dd>
          <dt>Layout Ruangan</dt><dd>${U.esc(b.layout)}</dd>
          <dt>Jenis Kegiatan</dt><dd>${U.esc(b.kind)}</dd>` : `<dt>Laboratorium</dt><dd>${U.esc(D.resName(b.lab))}</dd>
          <dt>Operator</dt><dd>${U.esc(D.personName(b.operator))}</dd>`}
          <dt>PIC</dt><dd>${U.esc(D.personName(b.pic || b.operator))}</dd>
          <dt>Status</dt><dd>${U.badge(b.status)}</dd>
          ${b.addons && b.addons.length ? `<dt>Add-on</dt><dd>${b.addons.map((a) => `<span class="fac">${U.esc(a)}</span>`).join(" ")}</dd>` : ""}
          ${b.cost ? `<dt>Total Biaya</dt><dd><b>${U.rp(b.cost)}</b> ${U.pricingBadge(b.billing)}</dd>` : ""}
        </div>
        <div class="grid g2">
          ${U.card("Riwayat Approval", `<div class="tline">
            <div class="tline-item ok"><div class="tt">Diajukan pemohon</div><div class="tm">${U.fdate(b.date)} 08:14 — ${U.esc(D.personName(b.requester))}</div></div>
            <div class="tline-item ${cur >= 2 ? "ok" : "now"}"><div class="tt">Persetujuan PIC Ruangan</div><div class="tm">${cur >= 2 ? U.fdate(b.date) + " 09:02 — " + U.esc(D.personName(b.pic || "EMP-0005")) : "Menunggu tindakan"}</div></div>
            ${b.cost ? `<div class="tline-item ${cur >= 3 ? "ok" : "warn"}"><div class="tt">Verifikasi Finance</div><div class="tm">${cur >= 3 ? "Selesai" : "Menunggu — SLA 2 hari"}</div></div>` : ""}
            <div class="tline-item ${cur >= 3 ? "ok" : ""}"><div class="tt">Konfirmasi & notifikasi</div><div class="tm">${cur >= 3 ? "Terkirim ke pemohon" : "Belum"}</div></div>
          </div>`, { cls: "" })}
          ${U.card("QR Check-in", `<div class="row gap-16">
            ${U.qrBox(b.id)}
            <div class="small muted">Tunjukkan QR ini di perangkat check-in ruangan.<div class="mt-8 mono">${b.id}</div>
            <div class="mt-8"><button class="btn btn-sm" onclick="UI.demo('QR diunduh')">${U.icon("download")} Unduh</button></div></div>
          </div>`)}
        </div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <button class="btn" onclick="UI.demo('Dokumen konfirmasi PDF dibuat')">${U.icon("doc")} Konfirmasi PDF</button>
             <div class="spacer"></div>
             <button class="btn btn-danger" onclick="UI.demo('Booking dibatalkan')">Batalkan</button>
             <button class="btn btn-primary" onclick="UI.demo('Check-in tercatat')">Check-in</button>`
    });
  };

  /* =======================================================================
     WIZARD BOOKING RUANGAN
     ======================================================================= */
  const WZ = { step: 0, date: D.shift(1), start: "09:00", end: "11:00", people: 20, room: null, layout: null, addons: {}, agenda: "", kind: "Rapat Internal",

    // Ruangan beserta ketersediaannya, diambil dari server. Kosong berarti
    // belum dimuat — dibedakan dari "tidak ada ruangan yang cocok", karena
    // keduanya menuntut pesan yang berbeda.
    ruanganServer: null, memuatRuangan: false, galatRuangan: null };

  function wzMulaiIso() { return WZ.date + "T" + WZ.start + ":00"; }
  function wzSelesaiIso() { return WZ.date + "T" + WZ.end + ":00"; }

  /**
   * Memuat ketersediaan ruangan dari server.
   *
   * Dipanggil setiap kali tanggal atau jam berubah. Hasilnya TIDAK di-cache
   * antar-perubahan: ketersediaan adalah keadaan yang berubah tanpa
   * sepengetahuan halaman ini, dan menyimpannya berarti menampilkan jawaban
   * untuk rentang waktu yang sudah tidak ditanyakan lagi.
   */
  window.wzMuatRuangan = async function () {
    if (!window.Repo || !Repo.dapatMenulis()) return;

    WZ.memuatRuangan = true;
    WZ.galatRuangan = null;

    const host = document.getElementById("wzHost");
    if (host && WZ.step === 1) host.innerHTML = wizardHTML();

    try {
      const hasil = await Repo.booking.ketersediaan(wzMulaiIso(), wzSelesaiIso(), WZ.people);
      WZ.ruanganServer = hasil.data;
    } catch (e) {
      WZ.ruanganServer = [];
      WZ.galatRuangan = e.message;
    } finally {
      WZ.memuatRuangan = false;
      const h = document.getElementById("wzHost");
      if (h && WZ.step === 1) h.innerHTML = wizardHTML();
    }
  };

  V["booking/new"] = {
    title: "Buat Booking Ruangan",
    sub: "Alur: tanggal & kebutuhan → pilih ruangan → layout & add-on → agenda → ringkasan.",
    actions: `<button class="btn btn-ai btn-sm" onclick="aiSuggestRoom()">${U.icon("sparkle")} Cari dengan AI</button>`,
    render() { WZ.step = 0; return `<div id="wzHost">${wizardHTML()}</div>`; }
  };

  window.wzGo = function (s) {
    if (s === 2 && !WZ.room) { U.toast("Pilih ruangan", "Silakan pilih salah satu ruangan tersedia.", "warn"); return; }
    WZ.step = Math.max(0, Math.min(4, s));
    document.getElementById("wzHost").innerHTML = wizardHTML();
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (s === 1 && WZ.ruanganServer === null) wzMuatRuangan();
  };
  window.wzPick = function (id) { WZ.room = id; WZ.layout = null; document.getElementById("wzHost").innerHTML = wizardHTML(); };
  window.wzSet = function (k, v) {
    WZ[k] = v;

    // Mengubah waktu atau kapasitas membuat pilihan ruangan sebelumnya
    // mungkin tidak lagi sah. Membiarkannya terpilih akan mengirimkan
    // pengajuan untuk ruangan yang barusan berubah statusnya.
    if (k === "date" || k === "start" || k === "end" || k === "people") {
      WZ.room = null;
      WZ.ruanganServer = null;
      document.getElementById("wzHost").innerHTML = wizardHTML();
      wzMuatRuangan();
    }
  };
  /**
   * Menetapkan agenda dari luar wizard.
   *
   * Ada karena kolom agenda berada di langkah 4, sementara pemilihan ruangan
   * di langkah 2 — dan berpindah langkah merender ulang seluruh formulir.
   * Dipakai juga oleh uji peramban untuk mengisi agenda tanpa perlu menembus
   * keadaan internal wizard, yang memang tidak diekspos.
   */
  window.wzSetAgenda = function (teks) { WZ.agenda = teks; };

  /**
   * Ruangan yang sedang dipilih, dari sumber mana pun.
   *
   * Saat tersambung, id-nya angka dari server dan TIDAK ada di D.rooms —
   * mencarinya di sana mengembalikan null, dan seluruh langkah ringkasan
   * gagal dirender tanpa satu pun pesan. Bentuk keluarannya disamakan dengan
   * bentuk purwarupa supaya kartu ringkasan yang sudah ada tidak perlu
   * ditulis ulang.
   */
  function wzRuangan() {
    if (WZ.room === null || WZ.room === undefined) return null;

    if (window.Repo && Repo.dapatMenulis()) {
      const r = (WZ.ruanganServer || []).find((x) => String(x.id) === String(WZ.room));
      if (!r) return null;

      return {
        id: r.id, code: r.kode, name: r.nama, type: r.jenis || "—",
        building: r.gedung || "", floor: r.lantai || "",
        cap: r.kapasitas, area: null,
        layout: r.tata_letak && r.tata_letak.length ? r.tata_letak : ["Boardroom"],
        facs: r.fasilitas || [],
        pricing: r.tarif.skema === "berbayar" ? "PAID" : "INTERNAL",
        rate: r.tarif.nilai || 0
      };
    }

    return D.byId(D.rooms, WZ.room);
  }

  window.wzLayout = function (l) { WZ.layout = l; document.getElementById("wzHost").innerHTML = wizardHTML(); };
  window.wzAddon = function (id, qty) { WZ.addons[id] = Math.max(0, qty); document.getElementById("wzHost").innerHTML = wizardHTML(); };
  window.wzSubmit = async function () {
    if (!WZ.room) {
      U.toast("Pilih ruangan", "Silakan pilih ruangan lebih dulu.", "warn");
      return;
    }
    if (!WZ.agenda) {
      U.toast("Agenda belum diisi", "Isi agenda kegiatan supaya penyetuju tahu keperluannya.", "warn");
      return;
    }

    /* ---- Mode data contoh: jangan berpura-pura mengajukan ---- */
    if (!window.Repo || !Repo.dapatMenulis()) {
      U.modal({
        title: "Simulasi pengajuan",
        sub: "Mode data contoh — tidak ada yang tersimpan",
        body: `<div class="alert warn">${U.icon("alert", 15)}<div>
          <b>Pengajuan ini TIDAK tersimpan ke mana pun.</b> Anda sedang menelusuri purwarupa.
          Masuk dengan akun untuk mengajukan pemesanan sungguhan.</div></div>`,
        foot: `<button class="btn btn-primary" onclick="UI.closeModal()">Mengerti</button>`
      });
      return;
    }

    /* ---- Tersambung ---- */
    const tombol = document.getElementById("wzKirim");
    if (tombol) { tombol.disabled = true; tombol.textContent = "Mengirim…"; }

    let hasil;
    try {
      hasil = await Repo.booking.simpan({
        // Diubah menjadi angka: WZ.room berasal dari atribut DOM, jadi
        // isinya string. Laravel memang menerima "1" untuk aturan integer,
        // tetapi mengirim tipe yang benar membuat perbandingan di sisi mana
        // pun tidak bergantung pada pemaksaan tipe yang diam-diam.
        room_id: Number(WZ.room),
        keperluan: WZ.agenda,
        jumlah_peserta: Number(WZ.people) || null,
        mulai: wzMulaiIso(),
        selesai: wzSelesaiIso(),
        catatan: WZ.kind ? "Jenis kegiatan: " + WZ.kind : null
      });
    } catch (e) {
      if (tombol) { tombol.disabled = false; tombol.textContent = "Ajukan Booking"; }

      // Bentrok jadwal datang sebagai 422 dengan pesan yang sudah menyebut
      // pemesanan penabraknya — diterjemahkan server dari pelanggaran batasan
      // basis data. Ditampilkan apa adanya, bukan diganti pesan sendiri:
      // pesan server memuat nama kegiatan dan jamnya, dan itulah yang membuat
      // pengguna tahu harus menggeser ke jam berapa.
      const pesan = (e.status === 422 && e.perMedan)
        ? Object.keys(e.perMedan).map((k) => e.perMedan[k].join(" ")).join(" ")
        : (e.message || "Gagal mengajukan pemesanan.");

      U.modal({
        title: e.status === 422 ? "Slot tidak dapat dipesan" : "Pengajuan gagal",
        body: `<div class="alert err">${U.icon("alert", 15)}<div>${U.esc(pesan)}</div></div>
          ${e.status === 422 ? `<p class="small muted mt-12">Ubah tanggal atau jamnya, lalu pilih
            ulang ruangan — daftar ketersediaan akan diperiksa ulang ke server.</p>` : ""}`,
        foot: `<button class="btn btn-primary" onclick="UI.closeModal();wzGo(0)">Ubah Jadwal</button>`
      });

      // Ketersediaan yang tersimpan sudah jelas usang — orang lain baru saja
      // memesan slot ini.
      WZ.ruanganServer = null;
      return;
    }

    if (tombol) { tombol.disabled = false; tombol.textContent = "Ajukan Booking"; }

    const st = hasil.status || {};

    U.modal({
      title: "Booking berhasil diajukan",
      sub: "ID Booking: #" + hasil.id,
      body: `<div class="center">
        <div class="tint-green" style="width:62px;height:62px;border-radius:50%;display:grid;place-items:center;margin:0 auto 16px">${U.icon("check", 30)}</div>
        <h3 class="mb-8">${U.esc(hasil.keperluan)}</h3>
        <p class="muted small">${U.esc(hasil.ruangan ? hasil.ruangan.nama : "")} ·
          ${U.fdate(WZ.date, "long")} · ${WZ.start}–${WZ.end}</p>
        <div class="row gap-6 mt-12" style="justify-content:center">
          <span class="badge ${STATUS_BOOK_TINT[st.kode] || "slate"}">${U.esc(st.nama || "")}</span>
          ${st.memblokir ? `<span class="badge outline">Slot sudah tertahan atas nama Anda</span>` : ""}
        </div>
        <div class="alert info small mt-16" style="text-align:left">${U.icon("shield", 15)}<div>
          Sejak detik ini ruangan tersebut tidak dapat dipesan orang lain pada rentang waktu yang sama —
          bahkan sebelum pengajuan Anda disetujui.</div></div>
      </div>`,
      foot: `<button class="btn" onclick="UI.closeModal();location.hash='#/mybooking'">Lihat Booking Saya</button>
             <button class="btn btn-primary" onclick="UI.closeModal();location.hash='#/booking'">Buka Daftar Booking</button>`
    });

    // Agenda dibersihkan supaya pengajuan berikutnya tidak mewarisi keperluan
    // yang sudah terkirim.
    WZ.agenda = "";
    WZ.room = null;
    WZ.ruanganServer = null;
    WZ.step = 0;
  };

  window.aiSuggestRoom = function () {
    U.modal({
      title: "Rekomendasi Ruangan oleh AI", sub: "Berdasarkan tanggal, kapasitas, fasilitas, dan anggaran",
      size: "wide",
      body: `<div class="alert ai mb-16">${U.icon("sparkle", 17)}<div><b>Permintaan Anda</b>
        “Cari ruangan untuk 20 orang, ${U.fdate(WZ.date, "long")} pukul ${WZ.start}–${WZ.end}, butuh proyektor dan video conference, gratis untuk internal.”</div></div>
        ${D.rooms.filter((r) => r.cap >= 16 && r.status === "Available").slice(0, 3).map((r, i) => `
          <div class="card mb-8"><div class="card-body row gap-16">
            <div class="kpi-ico tint-${i === 0 ? "green" : "slate"}" style="width:36px;height:36px;flex:0 0 36px">${i === 0 ? "★" : i + 1}</div>
            <div style="flex:1"><b>${U.esc(r.name)}</b> ${i === 0 ? `<span class="badge green">Paling sesuai</span>` : ""}
              <div class="small muted">${r.code} • ${r.cap} pax • ${r.area} m² • ${U.esc(r.facs.slice(0, 4).join(", "))}</div>
              <div class="tiny mt-4 muted">${i === 0 ? "Kapasitas pas (utilisasi kursi 83%), seluruh fasilitas yang diminta tersedia, dan tidak ada benturan jadwal." : i === 1 ? "Kapasitas lebih besar dari kebutuhan — biaya listrik & pendingin lebih tinggi." : "Tersedia namun tanpa video conference bawaan, perlu add-on."}</div></div>
            <div class="right"><div class="bold">${r.rate ? U.rpShort(r.rate) : "Gratis"}</div>
              <button class="btn btn-sm btn-primary mt-8" onclick="UI.closeModal();wzPick('${r.id}');wzGo(1)">Pilih</button></div>
          </div></div>`).join("")}`,
      foot: `<button class="btn" onclick="UI.closeModal()">Tutup</button>`
    });
  };

  function wzTotal() {
    const r = wzRuangan();
    let t = 0;
    if (r && r.pricing === "PAID") {
      const h = (parseInt(WZ.end) - parseInt(WZ.start)) || 2;
      t += r.rate * (r.unitPerHour === false ? 1 : Math.max(1, Math.round(h / 8 * 10) / 10));
    }
    Object.keys(WZ.addons).forEach((k) => {
      const a = D.addons.find((x) => x.id === k);
      if (a) t += a.price * (WZ.addons[k] || 0);
    });
    return Math.round(t);
  }

  function wizardHTML() {
    const steps = ["Waktu & Kebutuhan", "Pilih Ruangan", "Layout & Add-on", "Agenda & Peserta", "Ringkasan"];
    const room = wzRuangan();
    let body = "";

    if (WZ.step === 0) {
      body = `<div class="grid g2 gap-24">
        <div class="col gap-16">
          <div class="field"><label>Tanggal Penggunaan <span class="req">*</span></label>
            <input type="date" class="input" value="${WZ.date}" onchange="wzSet('date',this.value)"></div>
          <div class="grid g2">
            <div class="field"><label>Jam Mulai <span class="req">*</span></label>
              <select class="select" onchange="wzSet('start',this.value)">${HOURS.map((h) => `<option ${WZ.start === String(h).padStart(2, "0") + ":00" ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`).join("")}</select></div>
            <div class="field"><label>Jam Selesai <span class="req">*</span></label>
              <select class="select" onchange="wzSet('end',this.value)">${HOURS.map((h) => `<option ${WZ.end === String(h).padStart(2, "0") + ":00" ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`).join("")}</select></div>
          </div>
          <div class="field"><label>Jumlah Peserta <span class="req">*</span></label>
            <input type="number" class="input" value="${WZ.people}" onchange="wzSet('people',+this.value)">
            <div class="hint">Sistem memvalidasi kapasitas ruangan terhadap jumlah peserta.</div></div>
          <div class="field"><label>Jenis Kegiatan</label>
            <select class="select" onchange="wzSet('kind',this.value)">
              ${["Rapat Internal", "Rapat Rutin", "Rapat Manajemen", "Pelatihan", "Sosialisasi", "Seminar", "Workshop", "Event Eksternal"].map((k) => `<option ${WZ.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
          <div class="field"><label>Fasilitas yang Dibutuhkan</label>
            <div class="row wrap gap-6">${["Proyektor", "Video Conf", "Sound System", "Whiteboard", "Flipchart", "Mic Wireless", "Catering"].map((f, i) => `<span class="chip ${i < 2 ? "on" : ""}" onclick="this.classList.toggle('on')">${f}</span>`).join("")}</div></div>
          <label class="check"><input type="checkbox"> <span>Jadwalkan sebagai <b>recurring meeting</b> (berulang mingguan/bulanan)</span></label>
        </div>
        <div class="col gap-16">
          ${U.card("Ketersediaan pada tanggal terpilih", timelineHTML(D.rooms, WZ.date), { bodyCls: "tight", sub: U.fdate(WZ.date, "long") })}
          <div class="alert info">${U.icon("shield", 17)}<div><b>Resource Conflict Detection aktif</b>
            Sistem otomatis menolak booking yang bertabrakan dengan jadwal ruangan, PIC, maupun resource pendukung.</div></div>
        </div>
      </div>`;
    }

    if (WZ.step === 1) {
      // Ketersediaan datang dari SERVER saat tersambung. Menghitungnya di
      // sini dari daftar pemesanan yang sudah dimuat berarti memakai data
      // berumur beberapa detik sampai menit — dan pengguna yang melihat
      // "tersedia" lalu ditolak pada langkah terakhir tidak punya cara tahu
      // mengapa, karena layarnya baru saja mengatakan sebaliknya.
      const tersambung = window.Repo && Repo.dapatMenulis();

      const fit = tersambung
        ? (WZ.ruanganServer || []).map((r) => ({
            r: {
              id: r.id, code: r.kode, name: r.nama, type: r.jenis || "—",
              building: r.gedung || "", floor: r.lantai || "",
              cap: r.kapasitas, area: null,
              layout: r.tata_letak && r.tata_letak.length ? r.tata_letak : ["Boardroom"],
              facs: r.fasilitas || [],
              pricing: r.tarif.skema === "berbayar" ? "PAID" : "INTERNAL",
              rate: r.tarif.nilai || 0
            },
            ok: r.tersedia,
            reason: r.alasan || ""
          })).sort((a, b) => (b.ok - a.ok) || (a.r.cap - b.r.cap))
        : D.rooms.map((r) => {
            let reason = "", ok = true;
            if (r.status === "Maintenance") { ok = false; reason = "Sedang maintenance"; }
            else if (r.cap < WZ.people) { ok = false; reason = `Kapasitas kurang (${r.cap} < ${WZ.people})`; }
            else if (D.bookings.some((b) => b.res === r.id && b.date === WZ.date && b.status !== "Cancelled" && !(b.end <= WZ.start || b.start >= WZ.end))) { ok = false; reason = "Bentrok jadwal"; }
            return { r, ok, reason };
          }).sort((a, b) => (b.ok - a.ok) || (a.r.cap - b.r.cap));

      if (tersambung && WZ.memuatRuangan) {
        return U.card("Pilih Ruangan", `<div style="padding:32px;text-align:center">
          <span class="muted">Memeriksa ketersediaan pada ${U.fdate(WZ.date, "long")} pukul ${WZ.start}–${WZ.end}…</span>
        </div>`);
      }

      if (tersambung && WZ.galatRuangan) {
        return U.card("Pilih Ruangan", `<div style="padding:20px"><div class="alert err">${U.icon("alert", 15)}<div>
          <b>Ketersediaan tidak dapat diperiksa.</b><br><span class="small">${U.esc(WZ.galatRuangan)}</span>
          <div class="tiny mt-6">Pengajuan tetap dapat dikirim, dan server akan menolaknya bila slotnya sudah terisi.</div>
        </div></div></div>`);
      }

      if (tersambung && !fit.length) {
        return U.card("Pilih Ruangan", `<div style="padding:40px;text-align:center">
          <div class="muted mb-8">Tidak ada ruangan berkapasitas minimal ${WZ.people} orang.</div>
          <div class="small muted">Kurangi jumlah peserta, atau daftarkan ruangan lebih dulu pada menu Ruangan.</div>
        </div>`);
      }

      body = `
        <div class="row mb-16 wrap gap-8">
          <span class="badge green">${fit.filter((f) => f.ok).length} ruangan tersedia</span>
          <span class="badge red">${fit.filter((f) => !f.ok).length} tidak memenuhi</span>
          <div class="spacer"></div>
          <span class="small muted">${U.fdate(WZ.date, "long")} • ${WZ.start}–${WZ.end} • ${WZ.people} peserta</span>
        </div>
        <div class="grid g3">
          ${fit.map(({ r, ok, reason }) => `
            <div class="card res-card ${WZ.room === r.id ? "" : ""}" style="${WZ.room === r.id ? "border-color:var(--brand-500);box-shadow:0 0 0 3px var(--brand-50)" : ""};${ok ? "" : "opacity:.55"}"
                 onclick="${ok ? `wzPick('${r.id}')` : `UI.toast('Tidak tersedia','${reason}','warn')`}">
              <div class="thumb">${U.layoutDiagram(r.layout[0], 200, 112)}</div>
              <div class="rc-body">
                <div class="row"><div style="flex:1;min-width:0"><div class="rc-title trunc">${U.esc(r.name)}</div>
                  <div class="rc-meta">${r.code} • ${r.type}</div></div>
                  ${ok ? U.badge("Available") : `<span class="badge red">${U.esc(reason)}</span>`}</div>
                <div class="row mt-8 small muted gap-16">
                  <span>${U.icon("users", 13)} ${r.cap} pax</span>
                  <span>${U.icon("pin", 13)} ${r.building}-${r.floor}</span>
                  <span>${r.area} m²</span>
                </div>
                <div class="rc-facs">${r.facs.slice(0, 4).map((f) => `<span class="fac">${U.esc(f)}</span>`).join("")}
                  ${r.facs.length > 4 ? `<span class="fac">+${r.facs.length - 4}</span>` : ""}</div>
                <div class="row mt-12"><div>${U.pricingBadge(r.pricing)}</div><div class="spacer"></div>
                  <b class="small">${r.pricing === "PAID" ? U.rpShort(r.rate) + " /hari" : "Gratis internal"}</b></div>
              </div>
            </div>`).join("")}
        </div>`;
    }

    if (WZ.step === 2 && room) {
      body = `<div class="grid g-2-1 gap-24">
        <div class="col gap-16">
          ${U.card("Pilih Layout Ruangan", `<div class="grid g3">
            ${room.layout.concat(["Custom"]).map((l) => `
              <div class="layout-opt ${WZ.layout === l ? "on" : ""}" onclick="wzLayout('${l}')">
                ${U.layoutDiagram(l, 200, 104)}
                <div class="ln">${l}</div>
                <div class="lc">${l === "Theater" ? "Kapasitas maks" : l === "Classroom" ? "Ideal pelatihan" : l === "Boardroom" ? "Rapat formal" : l === "U-Shape" ? "Diskusi interaktif" : l === "Banquet" ? "Jamuan / gathering" : l === "Cluster" ? "Kerja kelompok" : "Atur sendiri"}</div>
              </div>`).join("")}
          </div>`, { sub: "Layout memengaruhi kapasitas efektif dan kebutuhan set-up" })}

          ${U.card("Fasilitas Tambahan (Add-on)", U.table(
            [{ t: "Add-on", render: (a) => `<b>${U.esc(a.name)}</b><div class="tiny faint">${a.unit}</div>` },
             { t: "Harga", cls: "right", render: (a) => U.rp(a.price) },
             { t: "Qty", cls: "right", w: "140px", render: (a) => `<div class="row" style="justify-content:flex-end">
                <button class="pbtn" onclick="wzAddon('${a.id}',${(WZ.addons[a.id] || 0) - 1})">−</button>
                <b style="width:26px;text-align:center">${WZ.addons[a.id] || 0}</b>
                <button class="pbtn" onclick="wzAddon('${a.id}',${(WZ.addons[a.id] || 0) + 1})">+</button></div>` },
             { t: "Subtotal", cls: "right", render: (a) => `<b>${U.rp((WZ.addons[a.id] || 0) * a.price)}</b>` }],
            D.addons), { bodyCls: "flush", sub: "Biaya add-on otomatis masuk ke perhitungan booking" })}
        </div>
        <div class="col gap-16">
          ${wzSummaryCard(room)}
          <div class="alert ${room.cap >= WZ.people ? "ok" : "warn"}">${U.icon(room.cap >= WZ.people ? "check" : "alert", 17)}
            <div><b>Validasi Kapasitas</b>${room.cap} kursi tersedia untuk ${WZ.people} peserta
            ${room.cap >= WZ.people ? ` — okupansi ${Math.round((WZ.people / room.cap) * 100)}%.` : " — melebihi kapasitas!"}</div></div>
        </div>
      </div>`;
    }

    if (WZ.step === 3 && room) {
      body = `<div class="grid g-2-1 gap-24">
        <div class="col gap-16">
          <div class="field"><label>Judul Agenda <span class="req">*</span></label>
            <input class="input" placeholder="Contoh: Rapat Evaluasi Kinerja Triwulan II" value="${U.esc(WZ.agenda)}" oninput="WZ_agenda(this.value)"></div>
          <div class="field"><label>Deskripsi / Rundown</label>
            <textarea class="textarea" placeholder="Uraian singkat agenda, rundown acara, atau kebutuhan khusus…"></textarea></div>
          <div class="grid g2">
            <div class="field"><label>Unit Kerja Pemohon</label><select class="select">${D.org.units.map((u) => `<option>${u}</option>`).join("")}</select></div>
            <div class="field"><label>PIC Kegiatan</label><select class="select">${D.people.map((p) => `<option>${p.name}</option>`).join("")}</select></div>
          </div>
          ${U.card("Daftar Peserta", `
            <div class="row mb-12"><button class="btn btn-sm" onclick="UI.demo('Dialog tambah peserta')">${U.icon("plus")} Tambah Peserta</button>
              <button class="btn btn-sm" onclick="UI.demo('Impor dari file CSV/Excel')">${U.icon("upload")} Impor Daftar</button>
              <div class="spacer"></div><span class="small muted">${WZ.people} peserta terdaftar</span></div>
            ${U.table([{ t: "Nama", render: (p) => `<div class="row"><span class="avatar sm">${U.initials(p.name)}</span><b>${U.esc(p.name)}</b></div>` },
                       { t: "Unit", k: "unit" }, { t: "Peran", render: () => `<span class="badge outline">Peserta</span>` },
                       { t: "", cls: "actions", render: () => `<button class="icon-btn" onclick="UI.demo('Peserta dihapus')">${U.icon("trash", 14)}</button>` }],
              D.people.slice(0, 5))}`, { bodyCls: "tight" })}
          <div class="field"><label>Dokumen Pendukung</label>
            <div class="card" style="border-style:dashed;cursor:pointer" onclick="UI.demo('Dialog unggah dokumen')">
              <div class="card-body center muted small">${U.icon("upload", 22)}<div class="mt-8">Seret berkas ke sini atau klik untuk mengunggah<br>
              <span class="tiny faint">Undangan, TOR, surat permohonan (PDF/DOCX, maks 10 MB)</span></div></div></div></div>
        </div>
        <div class="col gap-16">${wzSummaryCard(room)}</div>
      </div>`;
    }

    if (WZ.step === 4 && room) {
      const total = wzTotal();
      body = `<div class="grid g-2-1 gap-24">
        <div class="col gap-16">
          ${U.card("Ringkasan Booking", `<div class="dl">
            <dt>Ruangan</dt><dd>${U.esc(room.name)} <span class="muted">(${room.code})</span></dd>
            <dt>Lokasi</dt><dd>${U.esc((D.org.buildings.find((b) => b.code === room.building) || {}).name)} — Lantai ${room.floor}</dd>
            <dt>Tanggal</dt><dd>${U.fdate(WZ.date, "long")}</dd>
            <dt>Waktu</dt><dd>${WZ.start} – ${WZ.end} WIB</dd>
            <dt>Peserta</dt><dd>${WZ.people} orang <span class="muted">(kapasitas ${room.cap})</span></dd>
            <dt>Layout</dt><dd>${U.esc(WZ.layout || room.layout[0])}</dd>
            <dt>Jenis Kegiatan</dt><dd>${U.esc(WZ.kind)}</dd>
            <dt>Agenda</dt><dd>${U.esc(WZ.agenda || "—")}</dd>
            <dt>PIC Ruangan</dt><dd>${U.esc(D.personName(room.pic))}</dd>
            <dt>Skema Tarif</dt><dd>${U.pricingBadge(room.pricing)}</dd>
          </div>`)}
          ${U.card("Rincian Biaya", U.table(
            [{ t: "Komponen", render: (r) => r.n }, { t: "Qty", cls: "center", render: (r) => r.q },
             { t: "Harga Satuan", cls: "right", render: (r) => U.rp(r.p) }, { t: "Subtotal", cls: "right", render: (r) => `<b>${U.rp(r.s)}</b>` }],
            [{ n: `Sewa ${room.name}`, q: "1", p: room.pricing === "PAID" ? room.rate : 0, s: room.pricing === "PAID" ? room.rate : 0 }]
              .concat(Object.keys(WZ.addons).filter((k) => WZ.addons[k] > 0).map((k) => {
                const a = D.addons.find((x) => x.id === k);
                return { n: a.name, q: WZ.addons[k] + " " + a.unit, p: a.price, s: a.price * WZ.addons[k] };
              }))),
            { bodyCls: "flush", foot: `<div class="row"><span class="muted">Total sebelum pajak</span><div class="spacer"></div>
              <h2>${U.rp(total)}</h2></div>${total > 0 ? `<div class="tiny faint right mt-4">PPN 11% dihitung saat penerbitan invoice</div>` : ""}` })}
          ${U.card("Alur Persetujuan yang Berlaku", `<div class="mb-12">${U.stepper(
            total > 0 ? ["Pemohon", "PIC Ruangan", "Finance", "Konfirmasi"] : ["Pemohon", "PIC Ruangan", "Konfirmasi"], 0)}</div>
            <div class="small muted">Workflow <b>${total > 0 ? "WF-02 Booking Ruangan Berbayar" : "WF-01 Booking Ruangan Gratis (Internal)"}</b> — SLA ${total > 0 ? "1 hari kerja" : "4 jam kerja"}.</div>`)}
        </div>
        <div class="col gap-16">
          ${wzSummaryCard(room)}
          <div class="alert ok">${U.icon("check", 17)}<div><b>Tidak ada benturan jadwal</b>
            Ruangan, PIC, dan seluruh add-on tersedia pada slot waktu yang dipilih.</div></div>
          <label class="check"><input type="checkbox" checked> <span class="small">Saya menyetujui <a href="#" onclick="return UI.demo('Syarat penggunaan fasilitas')">syarat &amp; ketentuan penggunaan fasilitas</a> dan bersedia menanggung biaya kerusakan bila terjadi.</span></label>
          <button class="btn btn-primary btn-lg btn-block" id="wzKirim" onclick="wzSubmit()">${U.icon("check")} Ajukan Booking</button>
        </div>
      </div>`;
    }

    return `
      <div class="card mb-16"><div class="card-body">${U.stepper(steps, WZ.step)}</div></div>
      ${body}
      <div class="row wrap gap-8 mt-24">
        <button class="btn" ${WZ.step === 0 ? "disabled" : ""} onclick="wzGo(${WZ.step - 1})">${U.icon("chevL")} Sebelumnya</button>
        <div class="spacer"></div>
        <button class="btn btn-ghost" onclick="UI.demo('Disimpan sebagai draf')">Simpan Draf</button>
        ${WZ.step < 4 ? `<button class="btn btn-primary" onclick="wzGo(${WZ.step + 1})">Lanjut ${U.icon("chev")}</button>`
          : `<button class="btn btn-primary" onclick="wzSubmit()">${U.icon("check")} Ajukan Booking</button>`}
      </div>`;
  }

  window.WZ_agenda = (v) => { WZ.agenda = v; };

  function wzSummaryCard(room) {
    const total = wzTotal();
    return U.card("Ringkasan Pilihan", `
      ${room ? `<div class="thumb mb-12">${U.layoutDiagram(WZ.layout || room.layout[0], 200, 112)}</div>
      <div class="bold">${U.esc(room.name)}</div><div class="small muted mb-12">${room.code} • ${room.cap} pax • ${room.area} m²</div>` : `<div class="muted small mb-12">Belum ada ruangan dipilih.</div>`}
      <div class="dl small" style="grid-template-columns:96px 1fr">
        <dt>Tanggal</dt><dd>${U.fdate(WZ.date, "short")}</dd>
        <dt>Waktu</dt><dd>${WZ.start} – ${WZ.end}</dd>
        <dt>Peserta</dt><dd>${WZ.people} orang</dd>
        <dt>Layout</dt><dd>${U.esc(WZ.layout || (room ? room.layout[0] : "—"))}</dd>
        <dt>Add-on</dt><dd>${Object.keys(WZ.addons).filter((k) => WZ.addons[k] > 0).length || 0} item</dd>
      </div>
      <div class="row mt-16" style="padding-top:12px;border-top:1px solid var(--border)">
        <span class="muted small">Estimasi Biaya</span><div class="spacer"></div><h3>${U.rp(total)}</h3></div>`);
  }

  /* =======================================================================
     BOOKING SAYA & DAFTAR BOOKING
     ======================================================================= */
  function bookingTable(rows) {
    return U.table([
      { t: "ID Booking", w: "150px", render: (b) => `<span class="lnk mono" onclick="showBooking('${b.id}')">${b.id}</span>` },
      { t: "Agenda", render: (b) => `<b>${U.esc(b.agenda)}</b><div class="tiny faint">${U.esc(b.kind)}</div>` },
      { t: "Resource", render: (b) => `${U.esc(b.resName)}<div class="tiny faint">${U.esc(b.type)}</div>` },
      { t: "Jadwal", render: (b) => `${U.fdate(b.date, "short")}<div class="tiny faint">${b.start} – ${b.end}</div>` },
      { t: "Pemohon", render: (b) => `<div class="row"><span class="avatar sm">${U.initials(D.personName(b.requester))}</span><div><div class="small">${U.esc(D.personName(b.requester))}</div><div class="tiny faint">${U.esc(b.unit)}</div></div></div>` },
      { t: "Pax", cls: "center", render: (b) => b.people },
      { t: "Biaya", cls: "right", render: (b) => b.cost ? U.rp(b.cost) : `<span class="faint">Gratis</span>` },
      { t: "Status", render: (b) => U.badge(b.status) },
      { t: "", cls: "actions", render: (b) => `<button class="icon-btn" onclick="showBooking('${b.id}')">${U.icon("eye", 15)}</button>` }
    ], rows);
  }

  /* =======================================================================
     BOOKING RUANGAN — tersambung ke basis data
     ======================================================================= */

  const BOOK = { baris: [], memuat: true, galat: null, tapis: {} };

  const STATUS_BOOK_TINT = {
    menunggu: "amber", disetujui: "green", berlangsung: "teal",
    selesai: "slate", ditolak: "red", dibatalkan: "red"
  };

  function jamDari(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function tanggalDari(iso) {
    return iso ? iso.slice(0, 10) : "";
  }

  function bookingBarisHTML(b) {
    const st = b.status;
    return `
      <tr>
        <td><span class="lnk mono" onclick="showBooking('${U.esc(String(b.id))}')">#${U.esc(String(b.id))}</span></td>
        <td><b>${U.esc(b.keperluan)}</b></td>
        <td>${U.esc(b.ruangan ? b.ruangan.nama : "—")}
          <div class="tiny faint">${U.esc(b.ruangan ? b.ruangan.kode : "")}</div></td>
        <td>${U.fdate(tanggalDari(b.mulai), "short")}
          <div class="tiny faint">${jamDari(b.mulai)} – ${jamDari(b.selesai)}</div></td>
        <td>${b.pemohon ? `<div class="row"><span class="avatar sm">${U.initials(b.pemohon.nama)}</span>
          <div class="small">${U.esc(b.pemohon.nama)}</div></div>` : "—"}</td>
        <td class="center">${b.jumlah_peserta || "—"}</td>
        <td><span class="badge ${STATUS_BOOK_TINT[st.kode] || "slate"}">${U.esc(st.nama)}</span></td>
        <td class="actions"><button class="icon-btn" onclick="showBooking('${U.esc(String(b.id))}')">${U.icon("eye", 15)}</button></td>
      </tr>`;
  }

  function isiTabelBooking() {
    const wadah = document.getElementById("bookTabel");
    if (!wadah) return;

    if (BOOK.memuat) {
      wadah.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat pemesanan…</span></div>`;
      return;
    }
    if (BOOK.galat) {
      wadah.innerHTML = `<div style="padding:20px"><div class="alert err">${U.icon("alert", 15)}<div>
        <b>Gagal memuat pemesanan.</b><br><span class="small">${U.esc(BOOK.galat)}</span></div></div></div>`;
      return;
    }
    if (!BOOK.baris.length) {
      const adaTapis = Object.keys(BOOK.tapis).some((k) => BOOK.tapis[k]);
      wadah.innerHTML = `<div style="padding:40px;text-align:center">
        <div class="muted mb-12">${adaTapis
          ? "Tidak ada pemesanan yang cocok dengan penyaringan ini."
          : "Belum ada pemesanan ruangan."}</div>
        ${adaTapis
          ? `<button class="btn btn-sm" onclick="bookHapusTapis()">Hapus penyaringan</button>`
          : (Repo.dapatMenulis()
            ? `<button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Ajukan Pemesanan</button>`
            : `<span class="small muted">Masuk dengan akun untuk mengajukan pemesanan.</span>`)}
      </div>`;
      return;
    }

    wadah.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th style="width:110px">ID</th><th>Keperluan</th><th>Ruangan</th>
        <th>Jadwal</th><th>Pemohon</th><th class="center">Pax</th><th>Status</th><th></th></tr></thead>
      <tbody>${BOOK.baris.map(bookingBarisHTML).join("")}</tbody></table></div>`;
  }

  function isiRingkasanBooking() {
    const wadah = document.getElementById("bookKpi");
    if (!wadah) return;

    const b = BOOK.baris;
    const hitung = (k) => b.filter((x) => x.status.kode === k).length;

    wadah.innerHTML = `
      ${U.kpi({ label: "Total Pemesanan", value: b.length, icon: "calendar", tint: "brand", note: "Yang terlihat oleh Anda" })}
      ${U.kpi({ label: "Menunggu Persetujuan", value: hitung("menunggu"), icon: "clock", tint: "amber", note: "Perlu tindakan" })}
      ${U.kpi({ label: "Disetujui", value: hitung("disetujui"), icon: "check", tint: "green", note: "Siap digunakan" })}
      ${U.kpi({ label: "Sedang Berlangsung", value: hitung("berlangsung"), icon: "play", tint: "teal", note: "Sedang dipakai" })}
      ${U.kpi({ label: "Ditolak / Dibatalkan", value: hitung("ditolak") + hitung("dibatalkan"), icon: "x", tint: "red", note: "Slot kembali bebas" })}`;
  }

  async function muatBooking() {
    BOOK.memuat = true;
    BOOK.galat = null;
    isiTabelBooking();

    try {
      const hasil = await Repo.booking.daftar(BOOK.tapis);
      BOOK.baris = hasil.data;
    } catch (e) {
      BOOK.baris = [];
      BOOK.galat = e.message;
    } finally {
      BOOK.memuat = false;
      isiTabelBooking();
      isiRingkasanBooking();
    }
  }

  window.bookTapis = function (kunci, nilai) {
    if (nilai) BOOK.tapis[kunci] = nilai; else delete BOOK.tapis[kunci];
    muatBooking();
  };
  window.bookHapusTapis = function () {
    BOOK.tapis = {};
    const c = document.getElementById("bookCari");
    if (c) c.value = "";
    muatBooking();
  };

  /* --------------------------------------------------------------- detail */

  /**
   * Detail pemesanan.
   *
   * Bila id-nya tidak ada di daftar tersambung, dialihkan ke detail purwarupa.
   * Kalender, agenda, dan reservasi alat masih memakai id purwarupa
   * ("BK-2026-000431"), dan tanpa pengalihan ini mengklik jadwal di sana akan
   * diam saja tanpa satu pun tanda — kegagalan yang paling membingungkan
   * karena tampak seperti antarmuka yang tidak merespons.
   */
  window.showBooking = function (id) {
    const b = BOOK.baris.find((x) => String(x.id) === String(id));
    if (!b) return window.showBookingPurwarupa(id);

    const baris = (k, v) => v === null || v === undefined || v === "" ? "" : `<dt>${k}</dt><dd>${v}</dd>`;
    const st = b.status;

    U.drawer({
      size: "wide",
      title: b.keperluan,
      sub: (b.ruangan ? b.ruangan.nama + " • " : "") + U.fdate(tanggalDari(b.mulai), "long"),
      body: `
        <div class="row wrap gap-6 mb-16">
          <span class="badge ${STATUS_BOOK_TINT[st.kode] || "slate"}">${U.esc(st.nama)}</span>
          ${st.memblokir
            ? `<span class="badge outline">Slot tertahan</span>`
            : `<span class="badge slate">Slot bebas</span>`}
        </div>

        <div class="dl mb-16">
          ${baris("Ruangan", b.ruangan ? U.esc(b.ruangan.nama) + " (" + U.esc(b.ruangan.kode) + ")" : "")}
          ${baris("Tanggal", U.fdate(tanggalDari(b.mulai), "long"))}
          ${baris("Waktu", jamDari(b.mulai) + " – " + jamDari(b.selesai))}
          ${baris("Jumlah Peserta", b.jumlah_peserta || "")}
          ${baris("Pemohon", b.pemohon ? U.esc(b.pemohon.nama) : "")}
          ${baris("Catatan", U.esc(b.catatan || ""))}
        </div>

        ${b.persetujuan && (b.persetujuan.oleh || b.persetujuan.alasan_penolakan) ? `
          <h4 class="mb-8 muted">PERSETUJUAN</h4>
          <div class="dl mb-16">
            ${baris("Oleh", b.persetujuan.oleh ? U.esc(b.persetujuan.oleh.nama) : "")}
            ${baris("Waktu", b.persetujuan.disetujui_pada
              ? U.fdate(b.persetujuan.disetujui_pada.slice(0, 10), "long") : "")}
            ${baris("Alasan Penolakan", U.esc(b.persetujuan.alasan_penolakan || ""))}
          </div>` : ""}

        <div class="alert info small">${U.icon("shield", 15)}<div>
          Selama status masih menahan slot, ruangan ini tidak dapat dipesan orang lain
          pada rentang waktu yang sama. Penolakan atau pembatalan langsung membebaskannya.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>`
    });
  };

  V["booking"] = {
    title: "Daftar Booking",
    sub: "Seluruh pengajuan pemesanan ruangan.",
    get actions() {
      return Repo.dapatMenulis()
        ? `<button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Booking Baru</button>`
        : "";
    },
    render() {
      return `
        <div class="grid g5 mb-16" id="bookKpi"></div>
        <div class="card"><div class="tbl-toolbar">
          <div class="tbl-search">${U.icon("search", 15, "faint")}
            <input id="bookCari" placeholder="Cari keperluan, ruangan, atau pemohon…"></div>
          <select class="select" style="width:auto" onchange="bookTapis('status', this.value)">
            <option value="">Semua Status</option>
            <option value="menunggu">Menunggu persetujuan</option>
            <option value="disetujui">Disetujui</option>
            <option value="berlangsung">Sedang berlangsung</option>
            <option value="selesai">Selesai</option>
            <option value="ditolak">Ditolak</option>
            <option value="dibatalkan">Dibatalkan</option></select>
          <div class="spacer"></div>
        </div>
        <div id="bookTabel"></div></div>`;
    },
    mount() {
      const cari = document.getElementById("bookCari");
      if (cari) {
        cari.value = BOOK.tapis.cari || "";
        let jeda;
        cari.addEventListener("input", function () {
          clearTimeout(jeda);
          jeda = setTimeout(() => bookTapis("cari", cari.value.trim()), 300);
        });
      }
      muatBooking();
    }
  };

  V["mybooking"] = {
    title: "Booking Saya",
    sub: "Riwayat dan status pengajuan booking atas nama Anda.",
    actions: `<button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Booking Baru</button>`,
    render() {
      const mine = D.bookings.filter((b) => ["EMP-0001", "EMP-0004", "EMP-0005"].includes(b.requester));
      const upcoming = D.bookings.filter((b) => b.date >= D.shift(0) && b.status !== "Cancelled").slice(0, 3);
      return `
        <div class="grid g3 mb-16">
          ${upcoming.map((b) => `<div class="card" style="border-left:3px solid var(--brand-500)"><div class="card-body">
            <div class="row mb-8">${U.badge(b.status)}<div class="spacer"></div><span class="tiny faint mono">${b.id}</span></div>
            <div class="bold mb-4">${U.esc(b.agenda)}</div>
            <div class="small muted">${U.esc(b.resName)}</div>
            <div class="row mt-12 small gap-16">
              <span>${U.icon("calendar", 13)} ${U.fdate(b.date, "short")}</span>
              <span>${U.icon("clock", 13)} ${b.start}–${b.end}</span></div>
            <div class="row mt-12 gap-6">
              <button class="btn btn-sm" onclick="showBooking('${b.id}')">Detail</button>
              <button class="btn btn-sm btn-primary" onclick="UI.demo('Check-in via QR')">${U.icon("qr")} Check-in</button></div>
          </div></div>`).join("")}
        </div>
        ${U.card("Riwayat Booking Saya", U.toolbar({ ph: "Cari booking saya…", filters: [["Semua Status", "Approved", "Completed", "Cancelled"]] }) +
          bookingTable(mine.length ? mine : D.bookings.slice(0, 8)), { bodyCls: "flush" })}`;
    }
  };

  /* =======================================================================
     RESERVASI ALAT
     ======================================================================= */
  /* =======================================================================
     PEMINJAMAN ALAT — tersambung ke basis data
     ======================================================================= */

  const PJM = { baris: [], memuat: true, galat: null, tapis: {} };

  const STATUS_PJM_TINT = {
    menunggu: "amber", disetujui: "brand", dipinjam: "teal",
    dikembalikan: "green", ditolak: "red", dibatalkan: "slate"
  };

  function pjmWaktu(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function pjmBarisHTML(p) {
    const st = p.status;
    return `
      <tr>
        <td><span class="lnk mono" onclick="showPinjam('${U.esc(String(p.id))}')">#${U.esc(String(p.id))}</span></td>
        <td><b>${U.esc(p.alat ? p.alat.nama : "—")}</b>
          <div class="tiny faint mono">${U.esc(p.alat ? (p.alat.kode_internal || "") : "")}</div></td>
        <td><span class="small">${U.esc(p.keperluan)}</span></td>
        <td>${p.peminjam ? U.esc(p.peminjam.nama) : "—"}
          ${p.unit_kerja ? `<div class="tiny faint">${U.esc(p.unit_kerja)}</div>` : ""}</td>
        <td>${U.fdate((p.jadwal.mulai || "").slice(0, 10), "short")}
          <div class="tiny faint">${pjmWaktu(p.jadwal.mulai)} – ${pjmWaktu(p.jadwal.selesai)}</div></td>
        <td><span class="badge ${STATUS_PJM_TINT[st.kode] || "slate"}">${U.esc(st.nama)}</span>
          ${p.terlambat ? `<div class="tiny" style="color:var(--red-500)">Terlambat kembali</div>` : ""}</td>
        <td class="actions"><button class="icon-btn" onclick="showPinjam('${U.esc(String(p.id))}')">${U.icon("eye", 15)}</button></td>
      </tr>`;
  }

  function isiTabelPinjam() {
    const wadah = document.getElementById("pjmTabel");
    if (!wadah) return;

    if (PJM.memuat) {
      wadah.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat peminjaman…</span></div>`;
      return;
    }
    if (PJM.galat) {
      wadah.innerHTML = `<div style="padding:20px"><div class="alert err">${U.icon("alert", 15)}<div>
        <b>Gagal memuat peminjaman.</b><br><span class="small">${U.esc(PJM.galat)}</span></div></div></div>`;
      return;
    }
    if (!PJM.baris.length) {
      const adaTapis = Object.keys(PJM.tapis).some((k) => PJM.tapis[k]);
      wadah.innerHTML = `<div style="padding:40px;text-align:center">
        <div class="muted mb-12">${adaTapis
          ? "Tidak ada peminjaman yang cocok dengan penyaringan ini."
          : "Belum ada peminjaman alat."}</div>
        ${adaTapis
          ? `<button class="btn btn-sm" onclick="pjmHapusTapis()">Hapus penyaringan</button>`
          : (Repo.dapatMenulis()
            ? `<button class="btn btn-primary btn-sm" onclick="pjmForm()">${U.icon("plus")} Ajukan Peminjaman</button>`
            : `<span class="small muted">Masuk dengan akun untuk mengajukan peminjaman.</span>`)}
      </div>`;
      return;
    }

    wadah.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th style="width:100px">ID</th><th>Alat</th><th>Keperluan</th>
        <th>Peminjam</th><th>Jadwal</th><th>Status</th><th></th></tr></thead>
      <tbody>${PJM.baris.map(pjmBarisHTML).join("")}</tbody></table></div>`;
  }

  function isiRingkasanPinjam() {
    const wadah = document.getElementById("pjmKpi");
    if (!wadah) return;

    const b = PJM.baris;
    const hitung = (k) => b.filter((x) => x.status.kode === k).length;
    const terlambat = b.filter((x) => x.terlambat).length;

    wadah.innerHTML = `
      ${U.kpi({ label: "Sedang Dipinjam", value: hitung("dipinjam"), icon: "grid", tint: "teal", note: "Alat berada di luar" })}
      ${U.kpi({ label: "Menunggu Persetujuan", value: hitung("menunggu"), icon: "clock", tint: "amber", note: "Perlu tindakan" })}
      ${U.kpi({ label: "Disetujui, Belum Diambil", value: hitung("disetujui"), icon: "check", tint: "brand", note: "Menunggu serah terima" })}
      ${U.kpi({ label: "Terlambat Kembali", value: terlambat, icon: "alert",
                tint: terlambat ? "red" : "slate", note: terlambat ? "Perlu ditagih" : "Tidak ada" })}`;
  }

  async function muatPinjam() {
    PJM.memuat = true;
    PJM.galat = null;
    isiTabelPinjam();

    try {
      PJM.baris = (await Repo.peminjaman.daftar(PJM.tapis)).data;
    } catch (e) {
      PJM.baris = [];
      PJM.galat = e.message;
    } finally {
      PJM.memuat = false;
      isiTabelPinjam();
      isiRingkasanPinjam();
    }
  }

  window.pjmTapis = function (k, v) {
    if (v) PJM.tapis[k] = v; else delete PJM.tapis[k];
    muatPinjam();
  };
  window.pjmHapusTapis = function () {
    PJM.tapis = {};
    const c = document.getElementById("pjmCari");
    if (c) c.value = "";
    muatPinjam();
  };

  /* ------------------------------------------------------------- formulir */

  const PJM_FORM = { alat: null, memuat: false, galat: null, terpilih: null };

  window.pjmForm = function () {
    if (!Repo.dapatMenulis()) {
      U.toast("Tidak tersedia", "Mengajukan peminjaman hanya bisa setelah masuk dengan akun.");
      return;
    }

    PJM_FORM.alat = null;
    PJM_FORM.terpilih = null;
    PJM_FORM.galat = null;

    const besok = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    U.drawer({
      size: "wide",
      title: "Ajukan Peminjaman Alat",
      sub: "Ketersediaan diperiksa ke server pada rentang waktu yang Anda pilih",
      body: `
        <div id="pjmFormGalat" class="alert err mb-16" hidden></div>
        <div class="grid g2 gap-12">
          <label class="fld"><span>Tanggal mulai *</span>
            <input class="input" type="date" id="pTglMulai" value="${besok}" onchange="pjmMuatAlat()"></label>
          <label class="fld"><span>Jam mulai *</span>
            <input class="input" type="time" id="pJamMulai" value="08:00" onchange="pjmMuatAlat()"></label>
          <label class="fld"><span>Tanggal selesai *</span>
            <input class="input" type="date" id="pTglSelesai" value="${besok}" onchange="pjmMuatAlat()"></label>
          <label class="fld"><span>Jam selesai *</span>
            <input class="input" type="time" id="pJamSelesai" value="16:00" onchange="pjmMuatAlat()"></label>
        </div>

        <label class="fld mt-12"><span>Keperluan *</span>
          <input class="input" id="pKeperluan" placeholder="Uji kadar air sampel tanah"></label>
        <label class="fld mt-12"><span>Lokasi pemakaian</span>
          <input class="input" id="pLokasi" placeholder="Lab Kimia Analitik / lapangan"></label>

        <h4 class="mt-16 mb-8 muted">PILIH ALAT</h4>
        <div class="tbl-search mb-12">${U.icon("search", 15, "faint")}
          <input id="pCariAlat" placeholder="Cari nama alat, kode internal, atau nomor seri…"></div>
        <div id="pjmDaftarAlat"></div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" id="pjmSimpan" onclick="pjmSimpan()">Ajukan Peminjaman</button>`
    });

    const cari = document.getElementById("pCariAlat");
    if (cari) {
      let jeda;
      cari.addEventListener("input", function () {
        clearTimeout(jeda);
        jeda = setTimeout(() => pjmMuatAlat(), 300);
      });
    }

    pjmMuatAlat();
  };

  function pjmRentang() {
    const v = (id) => (document.getElementById(id) || {}).value || "";
    return {
      mulai: v("pTglMulai") + "T" + v("pJamMulai") + ":00",
      selesai: v("pTglSelesai") + "T" + v("pJamSelesai") + ":00"
    };
  }

  window.pjmMuatAlat = async function () {
    const wadah = document.getElementById("pjmDaftarAlat");
    if (!wadah) return;

    const r = pjmRentang();
    if (!r.mulai || !r.selesai || r.selesai <= r.mulai) {
      wadah.innerHTML = `<div class="alert warn small">${U.icon("alert", 15)}<div>
        Waktu selesai harus setelah waktu mulai.</div></div>`;
      return;
    }

    // Pilihan alat sebelumnya dibatalkan: mengubah rentang waktu membuat
    // ketersediaannya berubah, dan membiarkan pilihan lama akan mengirim
    // pengajuan untuk alat yang barusan tidak lagi bebas.
    PJM_FORM.terpilih = null;
    PJM_FORM.memuat = true;
    wadah.innerHTML = `<div style="padding:24px;text-align:center"><span class="muted">Memeriksa ketersediaan alat…</span></div>`;

    const cari = (document.getElementById("pCariAlat") || {}).value || "";

    try {
      PJM_FORM.alat = (await Repo.peminjaman.ketersediaan(r.mulai, r.selesai, cari)).data;
      PJM_FORM.galat = null;
    } catch (e) {
      PJM_FORM.alat = [];
      PJM_FORM.galat = e.message;
    } finally {
      PJM_FORM.memuat = false;
      pjmRenderAlat();
    }
  };

  function pjmRenderAlat() {
    const wadah = document.getElementById("pjmDaftarAlat");
    if (!wadah) return;

    if (PJM_FORM.galat) {
      wadah.innerHTML = `<div class="alert err small">${U.icon("alert", 15)}<div>
        <b>Ketersediaan tidak dapat diperiksa.</b> ${U.esc(PJM_FORM.galat)}</div></div>`;
      return;
    }

    const alat = PJM_FORM.alat || [];

    if (!alat.length) {
      wadah.innerHTML = `<div style="padding:24px;text-align:center">
        <span class="muted">Tidak ada alat yang cocok. Daftarkan alat lebih dulu pada Registrasi Alat.</span></div>`;
      return;
    }

    const bebas = alat.filter((a) => a.tersedia).length;

    wadah.innerHTML = `
      <div class="row wrap gap-8 mb-12">
        <span class="badge green">${bebas} alat tersedia</span>
        <span class="badge red">${alat.length - bebas} tidak dapat dipinjam</span>
      </div>
      <div class="col gap-6">
        ${alat.map((a) => `
          <div class="row-t" style="${a.tersedia ? "cursor:pointer" : "opacity:.55"};
                 ${String(PJM_FORM.terpilih) === String(a.id) ? "outline:2px solid var(--brand-600);outline-offset:-2px;border-radius:8px" : ""}"
               ${a.tersedia ? `onclick="pjmPilihAlat('${U.esc(String(a.id))}')"` : ""}>
            <div style="flex:1;min-width:0">
              <div class="bold small trunc">${U.esc(a.nama)}</div>
              <div class="tiny faint mono">${U.esc(a.kode_internal || a.bmn_id || "")}</div>
              ${a.lokasi ? `<div class="tiny faint">${U.esc(a.lokasi)}</div>` : ""}
            </div>
            <div class="right">
              ${a.tersedia
                ? `<span class="badge green">Tersedia</span>`
                : `<span class="badge red">${U.esc(a.alasan || "Tidak tersedia")}</span>`}
              ${a.bentrok && a.bentrok.length
                ? `<div class="tiny faint mt-4">${U.esc(a.bentrok[0].peminjam || "")} ·
                    ${pjmWaktu(a.bentrok[0].mulai)}–${pjmWaktu(a.bentrok[0].selesai)}</div>` : ""}
            </div>
          </div>`).join("")}
      </div>`;
  }

  window.pjmPilihAlat = function (id) {
    PJM_FORM.terpilih = id;
    pjmRenderAlat();
  };

  window.pjmSimpan = async function () {
    const teks = (id) => {
      const el = document.getElementById(id);
      const t = el ? el.value.trim() : "";
      return t === "" ? null : t;
    };

    const kotak = document.getElementById("pjmFormGalat");
    const tombol = document.getElementById("pjmSimpan");

    if (!PJM_FORM.terpilih) {
      kotak.textContent = "Pilih salah satu alat yang tersedia lebih dulu.";
      kotak.hidden = false;
      return;
    }

    const r = pjmRentang();

    kotak.hidden = true;
    tombol.disabled = true;
    tombol.textContent = "Mengirim…";

    try {
      await Repo.peminjaman.simpan({
        asset_id: Number(PJM_FORM.terpilih),
        keperluan: teks("pKeperluan"),
        lokasi_pemakaian: teks("pLokasi"),
        mulai: r.mulai,
        selesai: r.selesai
      });

      U.closeDrawer();
      U.toast("Peminjaman diajukan", "Alat tertahan atas nama Anda sampai keputusan penyetuju.");
      await muatPinjam();
    } catch (e) {
      // Bentrok datang sebagai 422 dengan pesan dari server yang menyebut
      // peminjaman penabraknya. Ditampilkan apa adanya.
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan)
          .map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else {
        kotak.textContent = e.message || "Gagal mengajukan peminjaman.";
      }
      kotak.hidden = false;

      // Ketersediaan yang tersimpan sudah usang — orang lain baru saja
      // meminjam alat ini.
      pjmMuatAlat();
    } finally {
      tombol.disabled = false;
      tombol.textContent = "Ajukan Peminjaman";
    }
  };

  /* --------------------------------------------------------------- detail */

  window.showPinjam = function (id) {
    const p = PJM.baris.find((x) => String(x.id) === String(id));
    if (!p) return;

    const baris = (k, v) => v === null || v === undefined || v === "" ? "" : `<dt>${k}</dt><dd>${v}</dd>`;
    const st = p.status;
    const bolehKelola = Repo.dapatMenulis() && API.boleh("booking-alat.ubah");

    U.drawer({
      size: "wide",
      title: p.alat ? p.alat.nama : "Peminjaman",
      sub: "#" + p.id + " · " + p.keperluan,
      body: `
        <div class="row wrap gap-6 mb-16">
          <span class="badge ${STATUS_PJM_TINT[st.kode] || "slate"}">${U.esc(st.nama)}</span>
          ${p.terlambat ? `<span class="badge red">Terlambat kembali</span>` : ""}
          ${p.kondisi_saat_kembali
            ? `<span class="badge outline">Kembali: ${U.esc(p.kondisi_saat_kembali.nama)}</span>` : ""}
        </div>

        <div class="dl mb-16">
          ${baris("Alat", p.alat ? U.esc(p.alat.nama) : "")}
          ${baris("Kode Internal", p.alat && p.alat.kode_internal
            ? `<span class="mono">${U.esc(p.alat.kode_internal)}</span>` : "")}
          ${baris("Kode BMN", p.alat && p.alat.bmn_id
            ? `<span class="mono">${U.esc(p.alat.bmn_id)}</span>` : "")}
          ${baris("Peminjam", p.peminjam ? U.esc(p.peminjam.nama) : "")}
          ${baris("Unit Kerja", U.esc(p.unit_kerja || ""))}
          ${baris("Keperluan", U.esc(p.keperluan))}
          ${baris("Lokasi Pemakaian", U.esc(p.lokasi_pemakaian || ""))}
          ${baris("Jadwal", U.fdate((p.jadwal.mulai || "").slice(0, 10), "long") + " · " +
            pjmWaktu(p.jadwal.mulai) + " – " + pjmWaktu(p.jadwal.selesai))}
          ${baris("Diambil", p.serah_terima.diambil_pada
            ? U.fdate(p.serah_terima.diambil_pada.slice(0, 10), "long") : "")}
          ${baris("Dikembalikan", p.serah_terima.dikembalikan_pada
            ? U.fdate(p.serah_terima.dikembalikan_pada.slice(0, 10), "long") : "")}
          ${baris("Alasan Penolakan", U.esc(p.persetujuan.alasan_penolakan || ""))}
          ${baris("Catatan", U.esc(p.catatan || ""))}
        </div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <div class="spacer"></div>
             ${bolehKelola && st.kode === "disetujui"
               ? `<button class="btn btn-primary" onclick="pjmSerahkan('${U.esc(String(p.id))}')">
                    ${U.icon("check")} Serahkan Alat</button>` : ""}
             ${bolehKelola && st.kode === "dipinjam"
               ? `<button class="btn btn-primary" onclick="pjmFormKembali('${U.esc(String(p.id))}')">
                    ${U.icon("refresh")} Catat Pengembalian</button>` : ""}`
    });
  };

  window.pjmSerahkan = async function (id) {
    try {
      await Repo.peminjaman.serahkan(id);
      U.closeDrawer();
      U.toast("Alat diserahkan", "Status berubah menjadi sedang dipinjam.");
      await muatPinjam();
    } catch (e) {
      Repo.tampilkanGalat(e, "Gagal mencatat serah terima");
    }
  };

  window.pjmFormKembali = function (id) {
    U.modal({
      title: "Catat Pengembalian Alat",
      body: `
        <div id="pjmKembaliGalat" class="alert err mb-16" hidden></div>
        <label class="fld"><span>Kondisi saat kembali *</span>
          <select class="select" id="kKondisi">
            <option value="B">Baik</option>
            <option value="RR">Rusak Ringan</option>
            <option value="RB">Rusak Berat</option>
          </select></label>
        <label class="fld mt-12"><span>Catatan pemeriksaan</span>
          <textarea class="input" id="kCatatan" rows="3"
            placeholder="Kelengkapan, kerusakan yang ditemukan, tindak lanjut…"></textarea></label>
        <p class="small muted mt-12">Kondisi yang dicatat di sini memperbarui kondisi asetnya
          pada Register BMN — jadi isilah apa adanya, bukan apa yang paling mudah.</p>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-primary" onclick="pjmKembalikan('${U.esc(String(id))}')">Catat Pengembalian</button>`
    });
  };

  window.pjmKembalikan = async function (id) {
    const kondisi = document.getElementById("kKondisi").value;
    const catatan = document.getElementById("kCatatan").value.trim();

    try {
      await Repo.peminjaman.kembalikan(id, kondisi, catatan || null);
      U.closeModal();
      U.closeDrawer();
      U.toast("Pengembalian tercatat", "Alat kembali tersedia untuk dipinjam.");
      await muatPinjam();
    } catch (e) {
      const kotak = document.getElementById("pjmKembaliGalat");
      if (kotak) {
        kotak.textContent = e.message || "Gagal mencatat pengembalian.";
        kotak.hidden = false;
      } else {
        Repo.tampilkanGalat(e, "Gagal mencatat pengembalian");
      }
    }
  };

  V["eqbooking"] = {
    title: "Peminjaman Alat Laboratorium",
    sub: "Alur: pengajuan → persetujuan → serah terima → pemakaian → pengembalian → pemeriksaan.",
    get actions() {
      return Repo.dapatMenulis()
        ? `<button class="btn btn-primary btn-sm" onclick="pjmForm()">${U.icon("plus")} Ajukan Peminjaman</button>`
        : "";
    },
    render() {
      return `
        <div class="grid g4 mb-16" id="pjmKpi"></div>
        <div class="card"><div class="tbl-toolbar">
          <div class="tbl-search">${U.icon("search", 15, "faint")}
            <input id="pjmCari" placeholder="Cari alat, keperluan, atau peminjam…"></div>
          <select class="select" style="width:auto" onchange="pjmTapis('status', this.value)">
            <option value="">Semua Status</option>
            <option value="menunggu">Menunggu persetujuan</option>
            <option value="disetujui">Disetujui</option>
            <option value="dipinjam">Sedang dipinjam</option>
            <option value="dikembalikan">Dikembalikan</option>
            <option value="ditolak">Ditolak</option></select>
          <div class="spacer"></div>
        </div>
        <div id="pjmTabel"></div></div>`;
    },
    mount() {
      const cari = document.getElementById("pjmCari");
      if (cari) {
        cari.value = PJM.tapis.cari || "";
        let jeda;
        cari.addEventListener("input", function () {
          clearTimeout(jeda);
          jeda = setTimeout(() => pjmTapis("cari", cari.value.trim()), 300);
        });
      }
      muatPinjam();
    }
  };

  window.eqNew = function () {
    U.modal({
      size: "wide", title: "Ajukan Reservasi Alat", sub: "Alur persetujuan: Pemohon → Kepala Lab → Asset Manager",
      body: `<div class="grid g2 gap-16">
        <div class="field"><label>Laboratorium <span class="req">*</span></label><select class="select">${D.labs.map((l) => `<option>${l.name}</option>`).join("")}</select></div>
        <div class="field"><label>Alat <span class="req">*</span></label><select class="select">${D.equipment.filter((e) => e.status === "Available").map((e) => `<option>${e.name} (${e.code})</option>`).join("")}</select></div>
        <div class="field"><label>Tanggal <span class="req">*</span></label><input type="date" class="input" value="${D.shift(2)}"></div>
        <div class="field"><label>Jam <span class="req">*</span></label><div class="row"><input type="time" class="input" value="08:00"><span>–</span><input type="time" class="input" value="12:00"></div></div>
        <div class="field" style="grid-column:1/-1"><label>Tujuan Penggunaan <span class="req">*</span></label><textarea class="textarea" placeholder="Contoh: Analisis kadar logam berat pada sampel air limbah industri…"></textarea></div>
        <div class="field"><label>Jumlah Sampel</label><input class="input" type="number" value="12"></div>
        <div class="field"><label>Operator / Pendamping</label><select class="select">${D.people.filter((p) => p.role.includes("Technician")).map((p) => `<option>${p.name}</option>`).join("")}</select></div>
        <div class="field" style="grid-column:1/-1">
          <label class="check"><input type="checkbox" checked><span class="small">Saya menyatakan telah memahami SOP pengoperasian alat dan bersedia mengikuti inspeksi kondisi saat pengembalian.</span></label></div>
      </div>
      <div class="alert info mt-16">${U.icon("shield", 16)}<div><b>Validasi otomatis</b> Sistem mengecek status kalibrasi, jadwal maintenance, dan benturan reservasi sebelum pengajuan diterima.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-primary" onclick="UI.closeModal();UI.toast('Reservasi diajukan','ER-2026-00225 menunggu persetujuan Kepala Lab.')">Ajukan</button>`
    });
  };

})();
