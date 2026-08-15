/* ==========================================================================
   FLMS — Views: Dashboard, Kalender, Booking, Ketersediaan, Reservasi Alat
   ========================================================================== */
window.VIEWS = window.VIEWS || {};
(function () {
  const U = UI, D = DB;
  const V = window.VIEWS;

  /* =======================================================================
     DASHBOARD OPERASIONAL
     ======================================================================= */
  V["dashboard"] = {
    title: "Dashboard Operasional",
    sub: "Ringkasan seluruh fasilitas, laboratorium, alat, dan transaksi hari ini.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Ekspor dashboard ke PDF')">${U.icon("download")} Ekspor</button>
              <button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Booking Baru</button>`,
    render() {
      const todays = D.bookings.filter((b) => b.date === D.shift(0));
      const overdueCal = D.calibration.filter((c) => c.status === "Overdue").length;
      const pendingAppr = D.approvals.length;

      const kpis = [
        U.kpi({ label: "Laboratorium Aktif", value: D.labs.filter((l) => l.status === "Aktif").length, suffix: "/ " + D.labs.length, icon: "flask", tint: "teal", delta: 0, note: "1 dalam renovasi" }),
        U.kpi({ label: "Ruangan Terkelola", value: D.rooms.length, icon: "building", tint: "brand", delta: 8, note: "4 gedung, 3 lokasi" }),
        U.kpi({ label: "Alat Laboratorium", value: D.equipment.length, icon: "grid", tint: "violet", delta: 5, note: D.equipment.filter((e) => e.status === "Available").length + " tersedia" }),
        U.kpi({ label: "Aset Terdaftar", value: U.num(1284), icon: "box", tint: "slate", delta: 3, note: "Nilai buku " + U.rpShort(18400000000) }),
        U.kpi({ label: "Booking Hari Ini", value: todays.length, icon: "calendar", tint: "amber", delta: 12, note: todays.filter((b) => b.status === "In Use").length + " sedang berlangsung" }),
        U.kpi({ label: "Menunggu Approval", value: pendingAppr, icon: "check", tint: "red", delta: 20, note: "2 melewati SLA" })
      ].join("");

      const alerts = `
        <div class="col gap-8">
          <div class="alert err">${U.icon("alert", 17)}<div><b>${overdueCal} alat melewati jatuh tempo kalibrasi</b>
            Alat otomatis diblokir dari reservasi sampai kalibrasi ulang selesai.</div></div>
          <div class="alert warn">${U.icon("wrench", 17)}<div><b>3 resource diblokir maintenance</b>
            Meeting Room Delta, Autoclave 100L, dan Climatic Chamber 250L.</div></div>
          <div class="alert info">${U.icon("clock", 17)}<div><b>1 peminjaman terlambat</b>
            LN-2026-00089 — Laptop Dell Latitude, terlambat 2 hari dari jadwal kembali.</div></div>
          <div class="alert ai">${U.icon("sparkle", 17)}<div><b>Rekomendasi AI</b>
            Utilisasi Meeting Room Delta hanya 41%. Pertimbangkan realokasi ke unit Produksi yang sering kekurangan ruang.</div></div>
        </div>`;

      const todayList = todays.length ? todays.sort((a, b) => a.start.localeCompare(b.start)).map((b) => `
        <div class="row" style="padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="width:74px" class="small bold">${b.start}<div class="tiny faint">${b.end}</div></div>
          <div style="flex:1;min-width:0">
            <div class="bold small trunc">${U.esc(b.agenda)}</div>
            <div class="tiny muted trunc">${U.esc(b.resName)} • ${U.esc(D.personName(b.requester))} • ${b.people} peserta</div>
          </div>
          ${U.badge(b.status)}
        </div>`).join("") : U.emptyState("Tidak ada booking hari ini", "");

      const util = [
        U.meter(`Ruangan Rapat <span class="faint tiny">(10 ruang)</span>`, 74, "var(--brand-500)"),
        U.meter(`Laboratorium <span class="faint tiny">(6 lab)</span>`, 81, "var(--teal-500)"),
        U.meter(`Alat Laboratorium <span class="faint tiny">(18 alat)</span>`, 68, "var(--violet-500)"),
        U.meter(`Auditorium & Serbaguna <span class="faint tiny">(2 ruang)</span>`, 52, "var(--amber-500)")
      ].join("");

      return `
        <div class="grid g6 mb-16">${kpis}</div>

        <div class="grid g-2-1 mb-16">
          ${U.card("Tren Utilisasi 8 Bulan Terakhir",
            `<div class="legend mb-12">
              <span><i style="background:var(--brand-500)"></i>Ruangan</span>
              <span><i style="background:var(--teal-500)"></i>Laboratorium</span>
              <span><i style="background:var(--violet-500)"></i>Alat</span>
            </div>` + U.areaChart(D.analytics.utilTrend, { max: 100, h: 250 }),
            { sub: "Persentase jam terpakai terhadap jam operasional", tools: `<div class="seg"><button>Mingguan</button><button class="active">Bulanan</button><button>Tahunan</button></div>` })}
          ${U.card("Alert Operasional", alerts, { sub: "Perlu tindakan segera" })}
        </div>

        <div class="grid g-2-1 mb-16">
          ${U.card("Agenda Hari Ini — " + U.fdate(D.shift(0), "long"), todayList,
            { tools: `<a href="#/calendar" class="btn btn-sm">${U.icon("calendar")} Kalender</a>` })}
          ${U.card("Tingkat Utilisasi", util, { sub: "Rata-rata 30 hari terakhir" })}
        </div>

        <div class="grid g3">
          ${U.card("Komposisi Booking", `<div class="row" style="gap:20px">
              <div>${U.donut(D.analytics.bookingByType, { label: "Booking YTD" })}</div>
              <div style="flex:1">${D.analytics.bookingByType.map((d) => `
                <div class="row small" style="padding:4px 0"><i style="width:9px;height:9px;border-radius:3px;background:${d.c};display:inline-block"></i>
                <span style="flex:1">${d.k}</span><b>${U.num(d.v)}</b></div>`).join("")}</div>
            </div>`, { sub: "Berdasarkan jenis kegiatan" })}
          ${U.card("Top Ruangan Terpakai", U.hbars(D.analytics.topRooms), { sub: "Utilisasi 30 hari" })}
          ${U.card("Status Alat Laboratorium", (() => {
            const g = {};
            D.equipment.forEach((e) => g[e.status] = (g[e.status] || 0) + 1);
            return Object.keys(g).map((k) => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--border)">
              ${U.badge(k)}<div class="spacer"></div><b>${g[k]}</b><span class="faint small">alat</span></div>`).join("");
          })(), { sub: "Distribusi status terkini" })}
        </div>`;
    }
  };

  /* =======================================================================
     DASHBOARD EKSEKUTIF
     ======================================================================= */
  V["exec"] = {
    title: "Dashboard Manajemen",
    sub: "KPI strategis: utilisasi, pendapatan, biaya maintenance, dan availability.",
    actions: `<div class="seg"><button>Bulan Ini</button><button class="active">YTD 2026</button><button>12 Bulan</button></div>
              <button class="btn btn-sm" onclick="window.print()">${U.icon("print")} Cetak</button>`,
    render() {
      const kpis = [
        U.kpi({ label: "Utilisasi Rata-rata", value: "74", suffix: "%", icon: "chart", tint: "brand", delta: 6, note: "Target 70%" }),
        U.kpi({ label: "Pendapatan Sewa YTD", value: U.rpShort(490000000), icon: "money", tint: "green", delta: 24, note: "Target Rp 600 Jt" }),
        U.kpi({ label: "Biaya Maintenance YTD", value: U.rpShort(237000000), icon: "wrench", tint: "amber", delta: 11, note: "Anggaran Rp 300 Jt" }),
        U.kpi({ label: "Equipment Availability", value: "88,9", suffix: "%", icon: "check", tint: "teal", delta: -2, note: "2 alat non-operasional" }),
        U.kpi({ label: "Cancellation Rate", value: "4,2", suffix: "%", icon: "x", tint: "red", delta: -1, note: "31 dari 931 booking" }),
        U.kpi({ label: "Occupancy Auditorium", value: "52", suffix: "%", icon: "building", tint: "violet", delta: 9, note: "18 event YTD" })
      ].join("");

      const hours = ["07", "09", "10", "11", "13", "14", "15", "16", "17"];
      return `
        <div class="grid g6 mb-16">${kpis}</div>

        <div class="grid g-3-2 mb-16">
          ${U.card("Pendapatan Sewa Fasilitas", U.barChart(D.analytics.revenue, { color: "var(--green-500)", fmt: (v) => v + " Jt" }),
            { sub: "Dalam juta rupiah, 8 bulan terakhir", tools: `<span class="badge green">+24% YoY</span>` })}
          ${U.card("Biaya Maintenance", U.barChart(D.analytics.maintCost, { color: "var(--amber-500)", fmt: (v) => v + " Jt" }),
            { sub: "Dalam juta rupiah, 6 bulan terakhir" })}
        </div>

        <div class="grid g-2-1 mb-16">
          ${U.card("Heatmap Penggunaan Ruangan", U.heatmap(D.analytics.heat, U.DAYS.slice(1).concat(["Minggu"]).map((d) => d.slice(0, 3)), hours),
            { sub: "Rata-rata okupansi (%) per hari dan jam operasional" })}
          ${U.card("Free vs Paid Utilization", `
            <div class="row mb-16" style="gap:20px">
              <div>${U.donut([{ k: "Gratis Internal", v: 682, c: "var(--teal-500)" }, { k: "Berbayar", v: 249, c: "var(--amber-500)" }], { label: "Booking YTD", size: 150 })}</div>
              <div style="flex:1">
                <div class="row small" style="padding:5px 0"><i style="width:9px;height:9px;border-radius:3px;background:var(--teal-500);display:inline-block"></i><span style="flex:1">Gratis Internal</span><b>73%</b></div>
                <div class="row small" style="padding:5px 0"><i style="width:9px;height:9px;border-radius:3px;background:var(--amber-500);display:inline-block"></i><span style="flex:1">Berbayar</span><b>27%</b></div>
              </div>
            </div>
            <div class="alert info small">${U.icon("chart", 15)}<div>Kontribusi pendapatan terbesar berasal dari Auditorium (54%) dan Ruang Serbaguna (23%).</div></div>`,
            { sub: "Proporsi pemanfaatan fasilitas" })}
        </div>

        <div class="grid g2">
          ${U.card("Aset dengan Biaya Maintenance Tertinggi", U.table(
            [{ t: "Aset / Alat", render: (r) => `<b>${U.esc(r.n)}</b>` },
             { t: "Frekuensi", cls: "center", render: (r) => r.f + "×" },
             { t: "Total Biaya", cls: "right", render: (r) => U.rp(r.c) },
             { t: "Nilai Aset", cls: "right", render: (r) => `<span class="muted">${U.rpShort(r.a)}</span>` },
             { t: "Rasio", cls: "right", render: (r) => `<span class="badge ${r.c / r.a > .1 ? "red" : "green"}">${((r.c / r.a) * 100).toFixed(1)}%</span>` }],
            [{ n: "Climatic Chamber 250L", f: 4, c: 52000000, a: 320000000 },
             { n: "AC Presisi 5PK Precision", f: 6, c: 24800000, a: 92000000 },
             { n: "Autoclave Vertikal 100L", f: 3, c: 21300000, a: 185000000 },
             { n: "Sound System Line Array", f: 2, c: 11200000, a: 265000000 },
             { n: "Kendaraan Operasional Hilux", f: 5, c: 18600000, a: 420000000 }]),
            { bodyCls: "flush", sub: "Kandidat evaluasi replace vs repair" })}
          ${U.card("Aset Idle (>90 hari tanpa penggunaan)", U.table(
            [{ t: "Aset", render: (r) => `<b>${U.esc(r.n)}</b><div class="tiny faint">${r.loc}</div>` },
             { t: "Idle", cls: "center", render: (r) => `<span class="badge amber">${r.d} hari</span>` },
             { t: "Nilai Buku", cls: "right", render: (r) => U.rpShort(r.v) },
             { t: "Rekomendasi", render: (r) => `<span class="small muted">${r.rec}</span>` }],
            [{ n: "Laptop Lenovo ThinkPad T14", loc: "GB-2 / MR-001", d: 128, v: 9750000, rec: "Perbaiki lalu realokasi" },
             { n: "Meja Rapat Modular 16 Seat", loc: "GB-2 / MR-001", d: 96, v: 23200000, rec: "Pindahkan ke Gedung D" },
             { n: "Proyektor Epson EB-L520U", loc: "GB-4 / CR-001", d: 103, v: 28800000, rec: "Masukkan pool add-on sewa" },
             { n: "FTIR Nicolet iS20", loc: "GA-2 / LAB-001", d: 94, v: 470000000, rec: "Promosikan jasa uji eksternal" }]),
            { bodyCls: "flush", sub: "Potensi optimalisasi pemanfaatan" })}
        </div>`;
    }
  };

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
  window.showBooking = function (id) {
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
  const WZ = { step: 0, date: D.shift(1), start: "09:00", end: "11:00", people: 20, room: null, layout: null, addons: {}, agenda: "", kind: "Rapat Internal" };

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
  };
  window.wzPick = function (id) { WZ.room = id; WZ.layout = null; document.getElementById("wzHost").innerHTML = wizardHTML(); };
  window.wzSet = function (k, v) { WZ[k] = v; if (k === "people" || k === "date") document.getElementById("wzHost").innerHTML = wizardHTML(); };
  window.wzLayout = function (l) { WZ.layout = l; document.getElementById("wzHost").innerHTML = wizardHTML(); };
  window.wzAddon = function (id, qty) { WZ.addons[id] = Math.max(0, qty); document.getElementById("wzHost").innerHTML = wizardHTML(); };
  window.wzSubmit = function () {
    U.modal({
      title: "Booking berhasil diajukan",
      sub: "ID Booking: BK-2026-000445",
      body: `<div class="center">
        <div class="tint-green" style="width:62px;height:62px;border-radius:50%;display:grid;place-items:center;margin:0 auto 16px">${U.icon("check", 30)}</div>
        <h3 class="mb-8">Pengajuan terkirim ke alur persetujuan</h3>
        <p class="muted small">Alur: <b>Pemohon → PIC Ruangan${wzTotal() > 0 ? " → Finance" : ""}</b>. Notifikasi telah dikirim melalui in-app, email, dan WhatsApp.</p>
        <div class="mt-16">${U.stepper(["Diajukan", "PIC Ruangan", wzTotal() > 0 ? "Finance" : "Konfirmasi", "Selesai"], 1)}</div>
        <div class="mt-16 row gap-16" style="justify-content:center">${U.qrBox("BK-2026-000445")}
          <div class="small muted left" style="text-align:left">QR check-in akan aktif setelah<br>booking disetujui.</div></div>
      </div>`,
      foot: `<button class="btn" onclick="UI.closeModal();location.hash='#/mybooking'">Lihat Booking Saya</button>
             <button class="btn btn-primary" onclick="UI.closeModal();location.hash='#/calendar'">Buka Kalender</button>`
    });
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
    const r = D.byId(D.rooms, WZ.room);
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
    const room = D.byId(D.rooms, WZ.room);
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
      const fit = D.rooms.map((r) => {
        let reason = "", ok = true;
        if (r.status === "Maintenance") { ok = false; reason = "Sedang maintenance"; }
        else if (r.cap < WZ.people) { ok = false; reason = `Kapasitas kurang (${r.cap} < ${WZ.people})`; }
        else if (D.bookings.some((b) => b.res === r.id && b.date === WZ.date && b.status !== "Cancelled" && !(b.end <= WZ.start || b.start >= WZ.end))) { ok = false; reason = "Bentrok jadwal"; }
        return { r, ok, reason };
      }).sort((a, b) => (b.ok - a.ok) || (a.r.cap - b.r.cap));

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
          <button class="btn btn-primary btn-lg btn-block" onclick="wzSubmit()">${U.icon("check")} Ajukan Booking</button>
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

  V["booking"] = {
    title: "Daftar Booking",
    sub: "Seluruh pengajuan booking ruangan, laboratorium, dan auditorium.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Ekspor ke Excel')">${U.icon("download")} Ekspor</button>
              <button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Booking Baru</button>`,
    render() {
      const s = {};
      D.bookings.forEach((b) => s[b.status] = (s[b.status] || 0) + 1);
      return `
        <div class="grid g5 mb-16">
          ${U.kpi({ label: "Total Booking", value: D.bookings.length, icon: "calendar", tint: "brand", note: "Periode berjalan" })}
          ${U.kpi({ label: "Menunggu Approval", value: s["Waiting Approval"] || 0, icon: "clock", tint: "amber", note: "Perlu tindakan PIC" })}
          ${U.kpi({ label: "Disetujui", value: s["Approved"] || 0, icon: "check", tint: "green", note: "Siap digunakan" })}
          ${U.kpi({ label: "Sedang Berlangsung", value: s["In Use"] || 0, icon: "play", tint: "teal", note: "Check-in tercatat" })}
          ${U.kpi({ label: "Dibatalkan", value: s["Cancelled"] || 0, icon: "x", tint: "red", note: "Cancellation rate 4,2%" })}
        </div>
        ${U.card("", U.toolbar({
          ph: "Cari ID booking, agenda, atau pemohon…",
          filters: [["Semua Jenis", "Ruangan", "Laboratorium", "Auditorium"], ["Semua Status", "Waiting Approval", "Approved", "In Use", "Completed", "Cancelled"], ["Semua Unit"].concat(D.org.units)],
          right: `<button class="btn btn-sm">${U.icon("filter")} Filter Lanjutan</button>`
        }) + bookingTable(D.bookings) + U.pager(D.bookings.length, 1, 14), { bodyCls: "flush" })}`;
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
  V["eqbooking"] = {
    title: "Reservasi Alat Laboratorium",
    sub: "Alur: Request → Approval → Reservation → Usage → Return → Inspection → Closing.",
    actions: `<button class="btn btn-primary btn-sm" onclick="eqNew()">${U.icon("plus")} Ajukan Reservasi</button>`,
    render() {
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Reservasi Aktif", value: D.eqBookings.filter((e) => ["Approved", "In Use", "Borrowed"].includes(e.status)).length, icon: "grid", tint: "brand", note: "Sedang berjalan" })}
          ${U.kpi({ label: "Menunggu Approval", value: D.eqBookings.filter((e) => e.status === "Waiting Approval").length, icon: "clock", tint: "amber", note: "SLA 4 jam" })}
          ${U.kpi({ label: "Alat Tersedia", value: D.equipment.filter((e) => e.status === "Available").length, icon: "check", tint: "green", note: "dari " + D.equipment.length + " alat" })}
          ${U.kpi({ label: "Alat Terblokir", value: D.equipment.filter((e) => ["Maintenance", "Calibration", "Broken"].includes(e.status)).length, icon: "alert", tint: "red", note: "Maintenance / kalibrasi / rusak" })}
        </div>
        ${U.card("Daftar Reservasi", U.toolbar({ ph: "Cari reservasi / alat…", filters: [["Semua Lab"].concat(D.labs.map((l) => l.name)), ["Semua Status", "Waiting Approval", "Approved", "In Use", "Borrowed"]] }) +
          U.table([
            { t: "ID", w: "140px", render: (e) => `<span class="lnk mono" onclick="showBooking('${e.id}')">${e.id}</span>` },
            { t: "Alat", render: (e) => `<b>${U.esc(e.eqName)}</b><div class="tiny faint">${U.esc(D.resName(e.lab))}</div>` },
            { t: "Tujuan Penggunaan", render: (e) => `<span class="small">${U.esc(e.purpose)}</span>` },
            { t: "Pemohon", render: (e) => `${U.esc(D.personName(e.requester))}<div class="tiny faint">${U.esc(e.unit)}</div>` },
            { t: "Jadwal", render: (e) => `${U.fdate(e.date, "short")}<div class="tiny faint">${e.start} – ${e.end}</div>` },
            { t: "Operator", render: (e) => U.esc(D.personName(e.operator)) },
            { t: "Status", render: (e) => U.badge(e.status) },
            { t: "", cls: "actions", render: (e) => `<button class="icon-btn" onclick="showBooking('${e.id}')">${U.icon("eye", 15)}</button>` }
          ], D.eqBookings), { bodyCls: "flush" })}`;
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
