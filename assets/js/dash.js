/* ==========================================================================
   FLMS — Mesin dashboard widget
   Setiap komponen dashboard dapat diubah isinya, diganti bentuk tampilannya,
   diatur lebar (kolom grid) dan tingginya, serta disusun ulang dengan
   seret-lepas. Susunan disimpan pada localStorage.
   ========================================================================== */
window.DASH = (function () {
  const U = window.UI, D = window.DB;

  /* =======================================================================
     SUMBER DATA
     kind: series (banyak deret) | series1 | kategori | baris | matriks | angka
     ======================================================================= */
  const SOURCES = {
    utilTrend: {
      n: "Tren utilisasi ruangan · lab · alat", kind: "series",
      get: () => D.analytics.utilTrend
    },
    revenue: {
      n: "Pendapatan sewa bulanan (Rp juta)", kind: "series1",
      get: () => D.analytics.revenue
    },
    maintCost: {
      n: "Biaya maintenance bulanan (Rp juta)", kind: "series1",
      get: () => D.analytics.maintCost
    },
    bscTrend: {
      n: "Tren skor Balanced Scorecard", kind: "series",
      get: () => D.bsc.trend
    },
    bookingByType: {
      n: "Komposisi booking per jenis kegiatan", kind: "kategori",
      get: () => D.analytics.bookingByType.map((x) => ({ n: x.k, v: x.v, c: x.c }))
    },
    topRooms: {
      n: "Utilisasi ruangan tertinggi", kind: "kategori",
      get: () => D.analytics.topRooms.map((x) => ({ n: x.n, v: x.v, c: "var(--brand-500)" }))
    },
    topEquip: {
      n: "Alat paling sering dipakai", kind: "kategori",
      get: () => D.analytics.topEquip.map((x) => ({ n: x.n, v: x.v, c: "var(--violet-500)" }))
    },
    eqStatus: {
      n: "Status alat laboratorium", kind: "kategori",
      get: () => countBy(D.equipment, "status")
    },
    eqCond: {
      n: "Kondisi alat laboratorium", kind: "kategori",
      get: () => countBy(D.equipment, "cond")
    },
    roomStatus: {
      n: "Status ketersediaan ruangan", kind: "kategori",
      get: () => countBy(D.rooms, "status")
    },
    bookingStatus: {
      n: "Status booking", kind: "kategori",
      get: () => countBy(D.bookings, "status")
    },
    labUtil: {
      n: "Utilisasi per laboratorium", kind: "kategori",
      get: () => D.labs.map((l) => ({ n: l.name, v: l.util, c: "var(--teal-500)" }))
    },
    roomUtil: {
      n: "Utilisasi per ruangan", kind: "kategori",
      get: () => D.rooms.map((r) => ({ n: r.name, v: r.util, c: "var(--brand-500)" }))
    },
    bmnKondisi: {
      n: "Kondisi BMN (B / RR / RB)", kind: "kategori",
      get: () => {
        const g = { B: 0, RR: 0, RB: 0 };
        D.equipment.concat(D.assets).forEach((x) => { g[x.bmn.kondisi] = (g[x.bmn.kondisi] || 0) + 1; });
        const c = { B: "var(--green-500)", RR: "var(--amber-500)", RB: "var(--red-500)" };
        return Object.keys(g).map((k) => ({ n: k, v: g[k], c: c[k] }));
      }
    },
    invoiceStatus: {
      n: "Status invoice", kind: "kategori",
      get: () => countBy(D.invoices, "status")
    },
    checklistType: {
      n: "Checklist per jenis", kind: "kategori",
      get: () => D.checklistTypes.map((t) => ({
        n: t.n, v: D.checklistRecords.filter((r) => tplOf(r.tpl).type === t.k).length,
        c: "var(--brand-500)"
      })).filter((x) => x.v)
    },
    bscPerspective: {
      n: "Skor per perspektif BSC", kind: "kategori",
      get: () => D.bsc.perspectives.map((p) => ({ n: p.name, v: D.bscPerspectiveScore(p), c: p.color }))
    },
    bookingsToday: {
      n: "Agenda hari ini", kind: "baris",
      get: () => D.bookings.filter((b) => b.date === D.shift(0))
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((b) => ({ a: b.start + "–" + b.end, b: b.agenda, c: b.resName, d: b.status }))
    },
    bookingsUpcoming: {
      n: "Booking mendatang", kind: "baris",
      get: () => D.bookings.filter((b) => b.date >= D.shift(0) && b.status !== "Cancelled")
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
        .map((b) => ({ a: U.fdate(b.date, "short"), b: b.agenda, c: b.resName, d: b.status }))
    },
    approvals: {
      n: "Approval menunggu", kind: "baris",
      get: () => D.approvals.map((a) => ({ a: a.id, b: a.subject, c: a.stage, d: a.priority }))
    },
    calDue: {
      n: "Kalibrasi jatuh tempo", kind: "baris",
      get: () => D.calibration.slice().sort((a, b) => a.due.localeCompare(b.due))
        .map((c) => ({ a: U.fdate(c.due, "short"), b: c.eqName, c: c.lab, d: c.status }))
    },
    workOrders: {
      n: "Work order maintenance", kind: "baris",
      get: () => D.maintenance.map((m) => ({ a: U.fdate(m.sched, "short"), b: m.targetName, c: m.kind, d: m.status }))
    },
    loansDue: {
      n: "Peminjaman berjalan", kind: "baris",
      get: () => D.loans.map((l) => ({ a: U.fdate(l.due, "short"), b: l.itemName, c: D.personName(l.borrower), d: l.status }))
    },
    checklistTasks: {
      n: "Tugas checklist", kind: "baris",
      get: () => D.checklistTasks.map((t) => ({
        a: U.fdate(t.due, "short") + " " + t.time, b: tplOf(t.tpl).name,
        c: D.resName(t.res), d: t.status
      }))
    },
    checklistRecords: {
      n: "Riwayat pelaksanaan checklist", kind: "baris",
      get: () => D.checklistRecords.map((r) => ({
        a: U.fdate(r.date, "short"), b: tplOf(r.tpl).name, c: D.resName(r.res), d: r.status
      }))
    },
    emailOutbox: {
      n: "Antrean email notifikasi", kind: "baris",
      get: () => D.emailOutbox.map((e) => ({ a: e.time.slice(-5), b: e.subj, c: e.name, d: e.status }))
    },
    visitors: {
      n: "Pengunjung", kind: "baris",
      get: () => D.visitors.map((v) => ({ a: v.in === "-" ? "—" : v.in, b: v.name, c: v.org, d: v.status }))
    },
    heat: { n: "Heatmap okupansi hari × jam", kind: "matriks", get: () => D.analytics.heat }
  };

  function countBy(arr, key) {
    const g = {};
    arr.forEach((x) => { g[x[key]] = (g[x[key]] || 0) + 1; });
    const pal = ["var(--brand-500)", "var(--teal-500)", "var(--violet-500)", "var(--amber-500)",
      "var(--green-500)", "var(--red-500)", "var(--slate-500)"];
    return Object.keys(g).map((k, i) => ({ n: k, v: g[k], c: pal[i % pal.length] }));
  }
  const tplOf = (id) => D.checklistTemplates.find((t) => t.id === id) || { name: id, type: "verifikasi" };

  /* =======================================================================
     METRIK untuk widget KPI
     ======================================================================= */
  const METRICS = {
    labAktif: { n: "Laboratorium aktif", get: () => D.labs.filter((l) => l.status === "Aktif").length, suffix: "" },
    ruangan: { n: "Jumlah ruangan", get: () => D.rooms.length },
    alat: { n: "Jumlah alat laboratorium", get: () => D.equipment.length },
    alatTersedia: { n: "Alat tersedia", get: () => D.equipment.filter((e) => e.status === "Available").length },
    alatBlokir: { n: "Alat non-operasional", get: () => D.equipment.filter((e) => ["Maintenance", "Calibration", "Broken"].includes(e.status)).length },
    bookingHariIni: { n: "Booking hari ini", get: () => D.bookings.filter((b) => b.date === D.shift(0)).length },
    bookingTotal: { n: "Total booking", get: () => D.bookings.length },
    approval: { n: "Approval menunggu", get: () => D.approvals.length },
    kalOverdue: { n: "Kalibrasi terlambat", get: () => D.calibration.filter((c) => c.status === "Overdue").length },
    woAktif: { n: "Work order aktif", get: () => D.maintenance.filter((m) => m.status !== "Completed").length },
    utilRuangan: { n: "Utilisasi ruangan", get: () => Math.round(D.rooms.reduce((a, r) => a + r.util, 0) / D.rooms.length), suffix: "%" },
    utilLab: { n: "Utilisasi laboratorium", get: () => Math.round(D.labs.reduce((a, l) => a + l.util, 0) / D.labs.length), suffix: "%" },
    pendapatan: { n: "Pendapatan sewa YTD", get: () => U.rpShort(490000000), raw: true },
    biayaMaint: { n: "Biaya maintenance YTD", get: () => U.rpShort(237000000), raw: true },
    nilaiBmn: { n: "Nilai buku BMN", get: () => U.rpShort(D.equipment.concat(D.assets).reduce((a, x) => a + x.bmn.nilaiBuku, 0)), raw: true },
    jumlahBmn: { n: "Jumlah BMN tercatat", get: () => D.equipment.length + D.assets.length },
    checklistDue: { n: "Checklist jatuh tempo", get: () => D.checklistTasks.filter((t) => t.status !== "Terjadwal").length },
    checklistTemuan: { n: "Checklist bertemuan", get: () => D.checklistRecords.filter((r) => r.status !== "Selesai").length },
    emailTerkirim: { n: "Email terkirim hari ini", get: () => D.emailOutbox.filter((e) => e.status === "Terkirim").length },
    bscTotal: { n: "Skor Balanced Scorecard", get: () => D.bscTotal(), suffix: "%" },
    pengunjung: { n: "Pengunjung di dalam", get: () => D.visitors.filter((v) => v.status === "Di Dalam").length },
    cancelRate: { n: "Cancellation rate", get: () => "4,2", suffix: "%", raw: true }
  };

  /* =======================================================================
     TIPE VISUAL
     ======================================================================= */
  const WTYPES = {
    kpi:     { n: "Kartu KPI", needs: "metrik" },
    line:    { n: "Grafik garis / area", needs: "series" },
    bar:     { n: "Grafik batang", needs: "series1" },
    donut:   { n: "Donat + legenda", needs: "kategori" },
    hbars:   { n: "Batang mendatar", needs: "kategori" },
    ranking: { n: "Daftar peringkat", needs: "kategori" },
    table:   { n: "Tabel", needs: "baris" },
    list:    { n: "Daftar ringkas", needs: "baris" },
    heatmap: { n: "Heatmap", needs: "matriks" },
    alerts:  { n: "Panel peringatan", needs: "-" },
    text:    { n: "Teks / catatan", needs: "-" },
    bscScore:{ n: "Ringkasan skor BSC", needs: "-" },
    bscPersp:{ n: "Kartu perspektif BSC", needs: "-" },
    bscMap:  { n: "Peta strategi BSC", needs: "-" },
    bscTable:{ n: "Tabel KPI BSC", needs: "-" }
  };

  /* Sumber yang cocok untuk sebuah tipe */
  function sourcesFor(type) {
    const need = (WTYPES[type] || {}).needs;
    if (need === "metrik" || need === "-") return [];
    return Object.keys(SOURCES).filter((k) => {
      const kind = SOURCES[k].kind;
      if (need === "series") return kind === "series" || kind === "series1";
      if (need === "series1") return kind === "series1" || kind === "series";
      return kind === need;
    });
  }

  /* =======================================================================
     DASHBOARD BAWAAN
     ======================================================================= */
  const w = (o) => Object.assign({ id: "W" + Math.random().toString(36).slice(2, 8), w: 3, h: 150 }, o);

  const DEFAULTS = {
    ops: {
      name: "Dashboard Operasional", icon: "dashboard", builtin: true,
      widgets: [
        w({ type: "kpi", w: 2, h: 118, title: "Laboratorium Aktif", metric: "labAktif", tint: "teal", icon: "flask", note: "1 dalam renovasi" }),
        w({ type: "kpi", w: 2, h: 118, title: "Ruangan Terkelola", metric: "ruangan", tint: "brand", icon: "building", delta: 8, note: "4 gedung" }),
        w({ type: "kpi", w: 2, h: 118, title: "Alat Laboratorium", metric: "alat", tint: "violet", icon: "grid", delta: 5, note: "16 tersedia" }),
        w({ type: "kpi", w: 2, h: 118, title: "Jumlah BMN", metric: "jumlahBmn", tint: "slate", icon: "box", note: "KIB B" }),
        w({ type: "kpi", w: 2, h: 118, title: "Booking Hari Ini", metric: "bookingHariIni", tint: "amber", icon: "calendar", delta: 12, note: "Termasuk berjalan" }),
        w({ type: "kpi", w: 2, h: 118, title: "Menunggu Approval", metric: "approval", tint: "red", icon: "check", delta: 20, note: "2 melewati SLA" }),
        w({ type: "line", w: 8, h: 340, title: "Tren Utilisasi 8 Bulan Terakhir", sub: "Persentase jam terpakai terhadap jam operasional", source: "utilTrend", legend: true }),
        w({ type: "alerts", w: 4, h: 340, title: "Alert Operasional", sub: "Perlu tindakan segera" }),
        w({ type: "list", w: 8, h: 300, title: "Agenda Hari Ini", source: "bookingsToday", limit: 6 }),
        w({ type: "hbars", w: 4, h: 300, title: "Tingkat Utilisasi Ruangan", source: "roomUtil", limit: 6, suffix: "%" }),
        w({ type: "donut", w: 4, h: 280, title: "Komposisi Booking", sub: "Berdasarkan jenis kegiatan", source: "bookingByType" }),
        w({ type: "ranking", w: 4, h: 280, title: "Top Ruangan Terpakai", source: "topRooms", limit: 6, suffix: "%" }),
        w({ type: "ranking", w: 4, h: 280, title: "Status Alat Laboratorium", source: "eqStatus", limit: 9, badge: true })
      ]
    },
    mgmt: {
      name: "Dashboard Manajemen", icon: "chart", builtin: true,
      widgets: [
        w({ type: "kpi", w: 2, h: 118, title: "Utilisasi Rata-rata", metric: "utilRuangan", tint: "brand", icon: "chart", delta: 6, note: "Target 70%" }),
        w({ type: "kpi", w: 2, h: 118, title: "Pendapatan Sewa YTD", metric: "pendapatan", tint: "green", icon: "money", delta: 24, note: "Target Rp 600 Jt" }),
        w({ type: "kpi", w: 2, h: 118, title: "Biaya Maintenance", metric: "biayaMaint", tint: "amber", icon: "wrench", delta: 11, note: "Pagu Rp 300 Jt" }),
        w({ type: "kpi", w: 2, h: 118, title: "Nilai Buku BMN", metric: "nilaiBmn", tint: "violet", icon: "box", note: "Setelah penyusutan" }),
        w({ type: "kpi", w: 2, h: 118, title: "Skor BSC", metric: "bscTotal", tint: "teal", icon: "star", note: "Semester berjalan" }),
        w({ type: "kpi", w: 2, h: 118, title: "Cancellation Rate", metric: "cancelRate", tint: "red", icon: "x", delta: -1, note: "31 dari 931" }),
        w({ type: "bar", w: 7, h: 300, title: "Pendapatan Sewa Fasilitas", sub: "Dalam juta rupiah", source: "revenue", color: "var(--green-500)" }),
        w({ type: "bar", w: 5, h: 300, title: "Biaya Maintenance", sub: "Dalam juta rupiah", source: "maintCost", color: "var(--amber-500)" }),
        w({ type: "heatmap", w: 7, h: 300, title: "Heatmap Penggunaan Ruangan", sub: "Okupansi rata-rata per hari dan jam", source: "heat" }),
        w({ type: "donut", w: 5, h: 300, title: "Kondisi BMN", sub: "Baik / Rusak Ringan / Rusak Berat", source: "bmnKondisi" }),
        w({ type: "ranking", w: 6, h: 280, title: "Alat Paling Sering Digunakan", source: "topEquip", limit: 6, suffix: "×" }),
        w({ type: "table", w: 6, h: 280, title: "Kalibrasi Jatuh Tempo", source: "calDue", limit: 6 })
      ]
    },
    bsc: {
      name: "Balanced Scorecard", icon: "star", builtin: true,
      widgets: [
        w({ type: "bscScore", w: 4, h: 300, title: "Skor Keseluruhan", sub: "Rata-rata tertimbang empat perspektif" }),
        w({ type: "bscPersp", w: 8, h: 300, title: "Skor per Perspektif", sub: "Bobot dan capaian" }),
        w({ type: "bscMap", w: 7, h: 360, title: "Peta Strategi", sub: "Hubungan sebab-akibat antar perspektif" }),
        w({ type: "line", w: 5, h: 360, title: "Tren Skor per Perspektif", sub: "Enam bulan terakhir", source: "bscTrend", legend: true }),
        w({ type: "bscTable", w: 12, h: 460, title: "Sasaran Strategis & Indikator Kinerja", sub: "Target, realisasi, bobot, dan skor" })
      ]
    },
    analitik: {
      name: "Analitik Fasilitas", icon: "grid", builtin: false,
      widgets: [
        w({ type: "kpi", w: 3, h: 118, title: "Utilisasi Laboratorium", metric: "utilLab", tint: "teal", icon: "flask", delta: 8 }),
        w({ type: "kpi", w: 3, h: 118, title: "Alat Non-Operasional", metric: "alatBlokir", tint: "red", icon: "alert" }),
        w({ type: "kpi", w: 3, h: 118, title: "Checklist Jatuh Tempo", metric: "checklistDue", tint: "amber", icon: "check" }),
        w({ type: "kpi", w: 3, h: 118, title: "Email Terkirim", metric: "emailTerkirim", tint: "brand", icon: "send" }),
        w({ type: "hbars", w: 6, h: 290, title: "Utilisasi per Laboratorium", source: "labUtil", limit: 6, suffix: "%" }),
        w({ type: "donut", w: 6, h: 290, title: "Status Alat", source: "eqStatus" }),
        w({ type: "table", w: 12, h: 320, title: "Tugas Checklist Terdekat", source: "checklistTasks", limit: 7 })
      ]
    }
  };

  /* =======================================================================
     PENYIMPANAN
     ======================================================================= */
  const KEY = "flms.dash";
  let store = null;

  function load() {
    if (store) return store;
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { saved = {}; }
    store = JSON.parse(JSON.stringify(DEFAULTS));
    Object.keys(saved).forEach((k) => { store[k] = saved[k]; });
    return store;
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(load())); }
  function get(id) { return load()[id]; }
  function list() { const s = load(); return Object.keys(s).map((k) => ({ id: k, ...s[k] })); }
  function reset(id) {
    if (DEFAULTS[id]) load()[id] = JSON.parse(JSON.stringify(DEFAULTS[id]));
    else delete load()[id];
    save();
  }

  let state = { id: null, edit: false, host: null };

  /* =======================================================================
     RENDER WIDGET
     ======================================================================= */
  function widgetBody(wd) {
    const src = wd.source ? SOURCES[wd.source] : null;
    const data = src ? src.get() : null;
    const lim = wd.limit || 8;

    switch (wd.type) {
      case "kpi": {
        const m = METRICS[wd.metric] || METRICS.ruangan;
        const val = m.get();
        return `<div class="kpi" style="padding:0;width:100%">
          <div class="kpi-top"><div class="kpi-ico tint-${wd.tint || "brand"}">${U.icon(wd.icon || "grid", 17)}</div>
            <div class="kpi-label" style="line-height:1.25">${U.esc(wd.title || m.n)}</div></div>
          <div class="kpi-val">${val}${m.suffix ? `<small> ${m.suffix}</small>` : ""}</div>
          <div class="kpi-foot">
            ${wd.delta != null ? `<span class="delta ${wd.delta > 0 ? "up" : wd.delta < 0 ? "down" : "flat"}">${wd.delta > 0 ? "▲" : wd.delta < 0 ? "▼" : "■"} ${Math.abs(wd.delta)}%</span>` : ""}
            <span class="faint trunc">${U.esc(wd.note || "")}</span></div>
        </div>`;
      }
      case "line": {
        const keys = Object.keys(data[0]).filter((k) => k !== "m");
        const KEYLBL = { room: "Ruangan", lab: "Laboratorium", equip: "Alat", val: "Nilai",
          F: "Finansial", C: "Pelanggan", P: "Proses Internal", L: "Pembelajaran" };
        const cols = ["var(--brand-500)", "var(--teal-500)", "var(--violet-500)", "var(--amber-500)"];
        const max = Math.max(100, Math.ceil(Math.max.apply(null, data.flatMap((d) => keys.map((k) => d[k]))) / 10) * 10);
        return (wd.legend !== false ? `<div class="legend mb-8">${keys.map((k, i) =>
          `<span><i style="background:${cols[i % cols.length]}"></i>${U.esc(KEYLBL[k] || k)}</span>`).join("")}</div>` : "") +
          U.areaChart(data, { max, h: Math.max(120, (wd.h || 300) - 96), colors: cols });
      }
      case "bar":
        return U.barChart(data.map((d) => ({ m: d.m, val: d.val != null ? d.val : d[Object.keys(d).filter((k) => k !== "m")[0]] })),
          { color: wd.color || "var(--brand-500)", h: Math.max(110, (wd.h || 300) - 86), fmt: (v) => v });
      case "donut":
        return `<div class="row wrap" style="gap:18px">
          <div>${U.donut(data.map((d) => ({ k: d.n, v: d.v, c: d.c })), { label: "Total", size: 148 })}</div>
          <div style="flex:1;min-width:130px">${data.slice(0, lim).map((d) => `
            <div class="row small" style="padding:3px 0"><i style="width:9px;height:9px;border-radius:3px;background:${d.c};display:inline-block"></i>
            <span style="flex:1;min-width:0" class="trunc">${U.esc(d.n)}</span><b>${U.num(d.v)}</b></div>`).join("")}</div>
        </div>`;
      case "hbars":
        return U.hbars(data.slice(0, lim).map((d) => ({ n: d.n, v: d.v })), { suffix: wd.suffix || "", color: data[0] ? data[0].c : "var(--brand-500)" });
      case "ranking":
        return data.slice(0, lim).map((d, i) => `
          <div class="row" style="padding:6px 0;border-bottom:1px solid var(--border)">
            <span class="faint tiny" style="width:16px">${i + 1}</span>
            ${wd.badge ? U.badge(d.n) : `<span class="small trunc" style="flex:1">${U.esc(d.n)}</span>`}
            ${wd.badge ? `<div class="spacer"></div>` : ""}
            <b class="small">${U.num(d.v)}${wd.suffix || ""}</b></div>`).join("");
      case "table":
        return U.table([
          { t: "Waktu", render: (r) => `<span class="small">${U.esc(r.a)}</span>` },
          { t: "Uraian", render: (r) => `<b class="small">${U.esc(r.b)}</b>` },
          { t: "Terkait", render: (r) => `<span class="small muted trunc">${U.esc(r.c)}</span>` },
          { t: "Status", render: (r) => U.badge(r.d) }
        ], data.slice(0, lim));
      case "list":
        return data.slice(0, lim).map((r) => `
          <div class="row" style="padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="width:86px" class="small bold">${U.esc(r.a)}</div>
            <div style="flex:1;min-width:0"><div class="small bold trunc">${U.esc(r.b)}</div>
              <div class="tiny faint trunc">${U.esc(r.c)}</div></div>
            ${U.badge(r.d)}</div>`).join("") || U.emptyState("Tidak ada data", "");
      case "heatmap":
        return U.heatmap(data, U.DAYS.slice(1).concat(["Minggu"]).map((d) => d.slice(0, 3)),
          ["07", "09", "10", "11", "13", "14", "15", "16", "17"]);
      case "alerts":
        return `<div class="col gap-8">
          <div class="alert err">${U.icon("alert", 16)}<div><b>${D.calibration.filter((c) => c.status === "Overdue").length} alat melewati jatuh tempo kalibrasi</b>Alat otomatis diblokir dari reservasi.</div></div>
          <div class="alert warn">${U.icon("wrench", 16)}<div><b>${D.maintenance.filter((m) => m.block).length} resource diblokir maintenance</b>Tidak dapat dibooking sementara.</div></div>
          <div class="alert info">${U.icon("check", 16)}<div><b>${D.checklistTasks.filter((t) => t.status === "Terlambat").length} checklist terlambat</b>Notifikasi email telah dikirim ke penanggung jawab.</div></div>
          <div class="alert ai">${U.icon("sparkle", 16)}<div><b>Rekomendasi AI</b>Meeting Room Delta hanya terpakai 41% — pertimbangkan realokasi.</div></div>
        </div>`;
      case "text":
        return `<div class="small" style="white-space:pre-wrap;line-height:1.6">${U.esc(wd.text ||
          "Klik ikon pensil untuk menyunting catatan ini. Widget teks berguna untuk menuliskan konteks, target periode, atau instruksi bagi pembaca dashboard.")}</div>`;
      case "bscScore": {
        const t = D.bscTotal(), st = D.bscStatus(t);
        const R = 52, C = 2 * Math.PI * R, off = C * (1 - Math.min(1, t / 100));
        return `<div class="center">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="14"/>
            <circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--${st.c === "green" ? "green" : st.c === "amber" ? "amber" : "red"}-500)"
              stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"
              transform="rotate(-90 70 70)"/>
            <text x="70" y="68" text-anchor="middle" font-size="27" font-weight="700" fill="var(--text)">${t}</text>
            <text x="70" y="86" text-anchor="middle" font-size="10" fill="var(--text-muted)">dari 100</text>
          </svg>
          <div class="mt-8"><span class="badge ${st.c}">${st.t}</span></div>
          <div class="tiny faint mt-4">${U.esc(D.bsc.period)}</div></div>`;
      }
      case "bscPersp":
        return `<div class="grid g2" style="gap:10px">${D.bsc.perspectives.map((p) => {
          const s = D.bscPerspectiveScore(p), st = D.bscStatus(s);
          return `<div class="card" style="border-left:3px solid ${p.color}"><div class="card-body tight">
            <div class="row mb-4"><span class="badge ${p.tint}">${p.k}</span>
              <span class="small bold trunc" style="flex:1">${U.esc(p.name)}</span></div>
            <div class="row"><h3 style="flex:1">${s}<small class="muted" style="font-size:11px">/100</small></h3>
              <span class="badge outline tiny">bobot ${p.weight}%</span></div>
            <div class="bar thin mt-6"><i style="width:${Math.min(100, s)}%;background:${p.color}"></i></div>
            <div class="tiny mt-4" style="color:var(--${st.c === "green" ? "green" : st.c === "amber" ? "amber" : "red"}-500)">${st.t}</div>
          </div></div>`;
        }).join("")}</div>`;
      case "bscMap":
        return bscMapSVG();
      case "bscTable":
        return U.table([
          { t: "Perspektif", render: (r) => r.first ? `<span class="badge ${r.p.tint}">${r.p.k} · ${U.esc(r.p.name)}</span>` : "" },
          { t: "Sasaran Strategis", render: (r) => r.firstObj ? `<span class="small">${U.esc(r.o.name)}</span>` : "" },
          { t: "Indikator Kinerja", render: (r) => `<b class="small">${U.esc(r.k.name)}</b><div class="tiny faint">${U.esc(r.k.unit)} · ${r.k.pol === "min" ? "semakin kecil semakin baik" : "semakin besar semakin baik"}</div>` },
          { t: "Bobot", cls: "center", render: (r) => r.k.weight + "%" },
          { t: "Target", cls: "right", render: (r) => U.esc(String(r.k.target)) },
          { t: "Realisasi", cls: "right", render: (r) => `<b>${U.esc(String(r.k.actual))}</b>` },
          { t: "Skor", cls: "right", render: (r) => { const s = D.bscScore(r.k), st = D.bscStatus(s);
              return `<span class="badge ${st.c}">${s}%</span>`; } },
          { t: "Capaian", w: "130px", render: (r) => { const s = D.bscScore(r.k);
              return `<div class="bar thin"><i style="width:${Math.min(100, s)}%;background:${s >= 100 ? "var(--green-500)" : s >= 90 ? "var(--amber-500)" : "var(--red-500)"}"></i></div>`; } },
          { t: "", cls: "actions", render: (r) => `<button class="icon-btn" onclick="bscEditKpi('${U.esc(r.k.name)}')">${U.icon("edit", 14)}</button>` }
        ], bscRows());
      default:
        return U.emptyState("Tipe widget belum dikenali", wd.type);
    }
  }

  function bscRows() {
    const rows = [];
    D.bsc.perspectives.forEach((p) => {
      let firstP = true;
      p.objectives.forEach((o) => {
        let firstO = true;
        o.kpis.forEach((k) => {
          rows.push({ p, o, k, first: firstP, firstObj: firstO });
          firstP = false; firstO = false;
        });
      });
    });
    return rows;
  }

  function bscMapSVG() {
    const P = D.bsc.perspectives;
    const H = 320, W = 560, boxH = 58, gap = (H - P.length * boxH) / (P.length + 1);
    let out = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="max-height:100%">`;
    // urutan bawah→atas: Pembelajaran → Proses → Pelanggan → Finansial
    const order = ["L", "P", "C", "F"];
    const pos = {};
    order.forEach((k, i) => {
      const p = P.find((x) => x.k === k);
      const y = H - gap - (i + 1) * boxH - i * gap;
      pos[k] = y + boxH / 2;
      const s = D.bscPerspectiveScore(p);
      out += `<rect x="10" y="${y}" width="${W - 20}" height="${boxH}" rx="10" fill="${p.color}" opacity=".1"/>`;
      out += `<rect x="10" y="${y}" width="4" height="${boxH}" rx="2" fill="${p.color}"/>`;
      out += `<text x="26" y="${y + 21}" font-size="12.5" font-weight="700" fill="var(--text)">${p.name}</text>`;
      out += `<text x="26" y="${y + 38}" font-size="10.5" fill="var(--text-muted)">${p.objectives.map((o) => o.name).join(" · ").slice(0, 74)}…</text>`;
      out += `<text x="${W - 22}" y="${y + 27}" font-size="15" font-weight="700" text-anchor="end" fill="${p.color}">${s}</text>`;
      out += `<text x="${W - 22}" y="${y + 41}" font-size="9" text-anchor="end" fill="var(--text-faint)">bobot ${p.weight}%</text>`;
    });
    // panah sebab-akibat
    for (let i = 0; i < order.length - 1; i++) {
      const y1 = pos[order[i]] - boxH / 2, y2 = pos[order[i + 1]] + boxH / 2;
      out += `<path d="M ${W / 2} ${y1} L ${W / 2} ${y2 + 6}" stroke="var(--border-strong)" stroke-width="2" fill="none"/>`;
      out += `<path d="M ${W / 2 - 5} ${y2 + 11} L ${W / 2} ${y2 + 2} L ${W / 2 + 5} ${y2 + 11} Z" fill="var(--border-strong)"/>`;
    }
    return out + `</svg>`;
  }

  /* =======================================================================
     RENDER GRID
     ======================================================================= */
  function widgetHTML(wd, i) {
    const tools = state.edit ? `
      <div class="wdg-tools">
        <button class="wdg-btn wdg-drag" title="Seret untuk menyusun ulang"
          onpointerdown="DASH.dragStart(event,'${wd.id}')">${U.icon("grid", 13)}</button>
        <button class="wdg-btn" title="Sunting" onclick="DASH.editWidget('${wd.id}')">${U.icon("edit", 13)}</button>
        <button class="wdg-btn" title="Duplikat" onclick="DASH.dupWidget('${wd.id}')">${U.icon("box", 13)}</button>
        <button class="wdg-btn" title="Hapus" onclick="DASH.delWidget('${wd.id}')">${U.icon("trash", 13)}</button>
      </div>` : "";
    const resize = state.edit
      ? `<div class="wdg-resize" title="Seret untuk mengubah lebar dan tinggi"
           onpointerdown="DASH.resizeStart(event,'${wd.id}')"></div>` : "";
    const head = wd.type === "kpi" ? "" : `
      <div class="card-head" style="padding:11px 14px">
        <div style="min-width:0"><h3 class="trunc">${U.esc(wd.title || "")}</h3>
          ${wd.sub ? `<div class="sub trunc">${U.esc(wd.sub)}</div>` : ""}</div>
      </div>`;
    return `<div class="wdg card" data-id="${wd.id}" data-i="${i}"
        style="grid-column:span ${wd.w};height:${wd.h}px">
      ${tools}${head}
      <div class="wdg-body ${wd.type === "kpi" ? "kpi-body" : ""}">${widgetBody(wd)}</div>
      ${resize}</div>`;
  }

  function render(id, hostId) {
    state.id = id; state.host = hostId;
    const d = get(id);
    if (!d) return U.emptyState("Dashboard tidak ditemukan", id);
    return `<div class="dash-grid ${state.edit ? "editing" : ""}" id="dashGrid">
      ${d.widgets.map(widgetHTML).join("")}
      ${state.edit ? `<div class="wdg-add" style="grid-column:span 3" onclick="DASH.addWidget()">
        ${U.icon("plus", 20)}<div class="small bold mt-4">Tambah Widget</div>
        <div class="tiny faint">Pilih tipe tampilan dan sumber data</div></div>` : ""}
    </div>`;
  }

  function repaint() {
    const host = document.getElementById(state.host);
    if (host) host.innerHTML = render(state.id, state.host);
  }

  function toolbar(id, opts) {
    const o = opts || {};
    const d = get(id);
    return `<div class="row wrap gap-8">
      ${o.left || ""}
      <div class="spacer"></div>
      ${state.edit ? `<span class="badge amber">${U.icon("edit", 11)} Mode Sunting</span>` : ""}
      ${state.edit ? `<button class="btn btn-sm" onclick="DASH.resetDash()">${U.icon("refresh")} Kembalikan Bawaan</button>` : ""}
      <button class="btn btn-sm ${state.edit ? "btn-primary" : ""}" onclick="DASH.toggleEdit()">
        ${U.icon(state.edit ? "check" : "edit")} ${state.edit ? "Selesai" : "Sunting Dashboard"}</button>
    </div>`;
  }

  /* =======================================================================
     AKSI SUNTING
     ======================================================================= */
  function toggleEdit() {
    state.edit = !state.edit;
    repaint();
    if (!state.edit) { save(); U.toast("Tersimpan", "Susunan dashboard disimpan pada peramban ini."); }
  }

  function findWidget(wid) {
    const d = get(state.id);
    const i = d.widgets.findIndex((x) => x.id === wid);
    return { d, i, wd: d.widgets[i] };
  }

  function delWidget(wid) {
    const { d, i } = findWidget(wid);
    if (i < 0) return;
    const removed = d.widgets.splice(i, 1)[0];
    save(); repaint();
    U.toast("Widget dihapus", removed.title || removed.type, "warn");
  }

  function dupWidget(wid) {
    const { d, i, wd } = findWidget(wid);
    if (i < 0) return;
    const copy = JSON.parse(JSON.stringify(wd));
    copy.id = "W" + Math.random().toString(36).slice(2, 8);
    copy.title = (wd.title || "Widget") + " (salinan)";
    d.widgets.splice(i + 1, 0, copy);
    save(); repaint();
  }

  function addWidget() {
    editForm(null);
  }

  function editWidget(wid) {
    const { wd } = findWidget(wid);
    editForm(wd);
  }

  /** Formulir sunting/tambah widget. */
  function editForm(wd) {
    const isNew = !wd;
    const cur = wd || { type: "kpi", metric: "ruangan", w: 3, h: 150, tint: "brand", icon: "grid", title: "Widget Baru" };
    window.__wdgDraft = JSON.parse(JSON.stringify(cur));
    U.modal({
      size: "wide",
      title: isNew ? "Tambah Widget" : "Sunting Widget",
      sub: isNew ? "Pilih tipe tampilan, sumber data, dan ukuran" : (cur.title || cur.type),
      body: `<div id="wdgForm">${editFormHTML(isNew)}</div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <div class="spacer"></div>
             <button class="btn btn-primary" onclick="DASH.saveWidget('${isNew ? "" : wd.id}')">
               ${U.icon("check")} ${isNew ? "Tambahkan" : "Simpan"}</button>`
    });
  }

  function editFormHTML(isNew) {
    const dr = window.__wdgDraft;
    const srcs = sourcesFor(dr.type);
    const needs = (WTYPES[dr.type] || {}).needs;
    if (srcs.length && !srcs.includes(dr.source)) dr.source = srcs[0];

    return `<div class="grid g2 gap-16" style="align-items:start">
      <div class="col gap-14">
        <div class="field"><label>Judul Widget</label>
          <input class="input" value="${U.esc(dr.title || "")}" oninput="DASH.draft('title',this.value)"></div>
        <div class="field"><label>Keterangan (opsional)</label>
          <input class="input" value="${U.esc(dr.sub || "")}" oninput="DASH.draft('sub',this.value)"></div>

        <div class="field"><label>Tipe Tampilan Data</label>
          <div class="row wrap gap-6">${Object.keys(WTYPES).map((k) =>
            `<span class="chip ${dr.type === k ? "on" : ""}" onclick="DASH.draft('type','${k}')">${WTYPES[k].n}</span>`).join("")}</div>
          <div class="hint">Mengganti tipe akan menyesuaikan pilihan sumber data yang cocok.</div></div>

        ${needs === "metrik" ? `
          <div class="field"><label>Metrik</label>
            <select class="select" onchange="DASH.draft('metric',this.value)">
              ${Object.keys(METRICS).map((k) => `<option value="${k}" ${dr.metric === k ? "selected" : ""}>${METRICS[k].n}</option>`).join("")}</select></div>
          <div class="grid g2" style="gap:10px">
            <div class="field"><label>Ikon</label>
              <select class="select" onchange="DASH.draft('icon',this.value)">
                ${["grid", "flask", "building", "box", "calendar", "check", "money", "wrench", "chart", "star", "users", "alert", "send", "clock", "x"]
                  .map((k) => `<option ${dr.icon === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
            <div class="field"><label>Warna</label>
              <select class="select" onchange="DASH.draft('tint',this.value)">
                ${["brand", "teal", "violet", "amber", "green", "red", "slate"].map((k) =>
                  `<option ${dr.tint === k ? "selected" : ""}>${k}</option>`).join("")}</select></div>
          </div>
          <div class="grid g2" style="gap:10px">
            <div class="field"><label>Perubahan (%)</label>
              <input type="number" class="input" value="${dr.delta != null ? dr.delta : ""}" placeholder="kosongkan bila tidak dipakai"
                oninput="DASH.draft('delta',this.value===''?null:+this.value)"></div>
            <div class="field"><label>Catatan kaki</label>
              <input class="input" value="${U.esc(dr.note || "")}" oninput="DASH.draft('note',this.value)"></div>
          </div>` : ""}

        ${srcs.length ? `
          <div class="field"><label>Sumber Data</label>
            <select class="select" onchange="DASH.draft('source',this.value)">
              ${srcs.map((k) => `<option value="${k}" ${dr.source === k ? "selected" : ""}>${SOURCES[k].n}</option>`).join("")}</select></div>` : ""}

        ${dr.type === "text" ? `
          <div class="field"><label>Isi Catatan</label>
            <textarea class="textarea" style="min-height:110px" oninput="DASH.draft('text',this.value)">${U.esc(dr.text || "")}</textarea></div>` : ""}

        ${["hbars", "ranking", "table", "list", "donut"].includes(dr.type) ? `
          <div class="grid g2" style="gap:10px">
            <div class="field"><label>Jumlah baris ditampilkan</label>
              <input type="number" class="input" min="1" max="20" value="${dr.limit || 6}" oninput="DASH.draft('limit',+this.value)"></div>
            <div class="field"><label>Akhiran nilai</label>
              <input class="input" value="${U.esc(dr.suffix || "")}" placeholder="% / × / unit" oninput="DASH.draft('suffix',this.value)"></div>
          </div>` : ""}

        ${dr.type === "bar" ? `
          <div class="field"><label>Warna batang</label>
            <div class="row wrap gap-6">${[["var(--brand-500)", "Biru"], ["var(--teal-500)", "Tosca"], ["var(--violet-500)", "Ungu"], ["var(--amber-500)", "Kuning"], ["var(--green-500)", "Hijau"]]
              .map(([v, n]) => `<span class="chip ${dr.color === v ? "on" : ""}" onclick="DASH.draft('color','${v}')">${n}</span>`).join("")}</div></div>` : ""}
      </div>

      <div class="col gap-14">
        <div class="field"><label>Lebar — ${dr.w} dari 12 kolom</label>
          <input type="range" min="2" max="12" step="1" value="${dr.w}" style="width:100%"
            oninput="DASH.draft('w',+this.value)">
          <div class="row wrap gap-4 mt-4">${[[3, "Seperempat"], [4, "Sepertiga"], [6, "Setengah"], [8, "Dua pertiga"], [12, "Penuh"]]
            .map(([v, n]) => `<span class="chip ${dr.w === v ? "on" : ""}" onclick="DASH.draft('w',${v})">${n}</span>`).join("")}</div></div>

        <div class="field"><label>Tinggi — ${dr.h} px</label>
          <input type="range" min="110" max="620" step="10" value="${dr.h}" style="width:100%"
            oninput="DASH.draft('h',+this.value)">
          <div class="row wrap gap-4 mt-4">${[[118, "Ringkas"], [180, "Sedang"], [300, "Tinggi"], [460, "Sangat tinggi"]]
            .map(([v, n]) => `<span class="chip ${dr.h === v ? "on" : ""}" onclick="DASH.draft('h',${v})">${n}</span>`).join("")}</div></div>

        <div class="field"><label>Pratinjau</label>
          <div class="dash-grid" style="grid-template-columns:repeat(12,minmax(0,1fr));pointer-events:none">
            <div class="wdg card" style="grid-column:span ${Math.min(12, dr.w)};height:${dr.h}px">
              ${dr.type === "kpi" ? "" : `<div class="card-head" style="padding:11px 14px"><div style="min-width:0">
                <h3 class="trunc">${U.esc(dr.title || "")}</h3>${dr.sub ? `<div class="sub trunc">${U.esc(dr.sub)}</div>` : ""}</div></div>`}
              <div class="wdg-body ${dr.type === "kpi" ? "kpi-body" : ""}">${safeBody(dr)}</div>
            </div>
          </div>
          <div class="hint mt-4">Lebar juga dapat diubah langsung di dashboard dengan menyeret sudut kanan bawah widget.</div>
        </div>
      </div>
    </div>`;
  }

  function safeBody(wd) {
    try { return widgetBody(wd); }
    catch (e) { return U.emptyState("Pratinjau belum tersedia", "Pilih sumber data yang sesuai."); }
  }

  function draft(k, v) {
    window.__wdgDraft[k] = v;
    const host = document.getElementById("wdgForm");
    if (host) host.innerHTML = editFormHTML(false);
  }

  function saveWidget(wid) {
    const d = get(state.id);
    const dr = window.__wdgDraft;
    if (wid) {
      const i = d.widgets.findIndex((x) => x.id === wid);
      dr.id = wid;
      d.widgets[i] = dr;
    } else {
      dr.id = "W" + Math.random().toString(36).slice(2, 8);
      d.widgets.push(dr);
    }
    save(); U.closeModal(); repaint();
    U.toast(wid ? "Widget diperbarui" : "Widget ditambahkan", dr.title || WTYPES[dr.type].n);
  }

  function resetDash() {
    U.modal({
      title: "Kembalikan Susunan Bawaan", sub: get(state.id).name,
      body: `<p class="small">Seluruh perubahan pada dashboard ini — widget yang ditambah, diubah, diatur ulang
        ukurannya, atau disusun ulang — akan dikembalikan ke susunan bawaan sistem.</p>
        <div class="alert warn small mt-12">${U.icon("alert", 15)}<div>Tindakan ini tidak dapat dibatalkan.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-danger" onclick="DASH.resetGo()">Kembalikan</button>`
    });
  }
  function resetGo() {
    reset(state.id); U.closeModal(); repaint();
    U.toast("Dikembalikan", "Susunan bawaan dipulihkan.");
  }

  /* =======================================================================
     SERET-LEPAS UNTUK MENYUSUN ULANG
     ======================================================================= */
  let drag = null;

  function dragStart(e, wid) {
    e.preventDefault();
    const grid = document.getElementById("dashGrid");
    const el = grid.querySelector(`.wdg[data-id="${wid}"]`);
    if (!el) return;
    drag = { wid, el, grid };
    el.classList.add("dragging");
    grid.classList.add("dragging-active");
    e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
    window.addEventListener("pointermove", dragMove);
    window.addEventListener("pointerup", dragEnd, { once: true });
  }

  function dragMove(e) {
    if (!drag) return;
    const sibs = Array.prototype.slice.call(drag.grid.querySelectorAll(".wdg")).filter((x) => x !== drag.el);
    let target = null, before = false;
    for (const s of sibs) {
      const r = s.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        target = s; before = e.clientX < r.left + r.width / 2; break;
      }
    }
    if (!target) {
      // tidak tepat di atas widget: pakai yang pusatnya terdekat
      let best = Infinity;
      for (const s of sibs) {
        const r = s.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const d2 = dx * dx + dy * dy;
        if (d2 < best) { best = d2; target = s; before = dx < 0; }
      }
    }
    if (!target) return;
    if (before) drag.grid.insertBefore(drag.el, target);
    else drag.grid.insertBefore(drag.el, target.nextSibling);
  }

  function dragEnd() {
    window.removeEventListener("pointermove", dragMove);
    if (!drag) return;
    drag.el.classList.remove("dragging");
    drag.grid.classList.remove("dragging-active");
    const order = Array.prototype.slice.call(drag.grid.querySelectorAll(".wdg")).map((x) => x.dataset.id);
    const d = get(state.id);
    d.widgets.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    save();
    drag = null;
    repaint();
  }

  /* =======================================================================
     UBAH UKURAN DENGAN MENYERET
     ======================================================================= */
  let rz = null;

  function resizeStart(e, wid) {
    e.preventDefault(); e.stopPropagation();
    const grid = document.getElementById("dashGrid");
    const el = grid.querySelector(`.wdg[data-id="${wid}"]`);
    const { wd } = findWidget(wid);
    const gr = grid.getBoundingClientRect();
    const col = (gr.width - 11 * 14) / 12;      // lebar satu kolom + jarak
    rz = { wid, el, wd, col, left: el.getBoundingClientRect().left, top: el.getBoundingClientRect().top };
    el.classList.add("resizing");
    window.addEventListener("pointermove", resizeMove);
    window.addEventListener("pointerup", resizeEnd, { once: true });
  }

  function resizeMove(e) {
    if (!rz) return;
    const wpx = e.clientX - rz.left;
    const cols = Math.max(2, Math.min(12, Math.round(wpx / (rz.col + 14))));
    const h = Math.max(110, Math.min(700, Math.round((e.clientY - rz.top) / 10) * 10));
    rz.wd.w = cols; rz.wd.h = h;
    rz.el.style.gridColumn = "span " + cols;
    rz.el.style.height = h + "px";
    let tip = rz.el.querySelector(".wdg-size");
    if (!tip) { tip = document.createElement("div"); tip.className = "wdg-size"; rz.el.appendChild(tip); }
    tip.textContent = cols + " kolom × " + h + " px";
  }

  function resizeEnd() {
    window.removeEventListener("pointermove", resizeMove);
    if (!rz) return;
    rz.el.classList.remove("resizing");
    const tip = rz.el.querySelector(".wdg-size"); if (tip) tip.remove();
    save();
    const wd = rz.wd; rz = null;
    repaint();
    U.toast("Ukuran diperbarui", wd.w + " kolom × " + wd.h + " px");
  }

  /* =======================================================================
     PENGELOLAAN DASHBOARD (untuk dashboard analitik kustom)
     ======================================================================= */
  function createDash(name, icon) {
    const id = "usr" + Date.now().toString(36);
    load()[id] = { name: name || "Dashboard Baru", icon: icon || "grid", builtin: false, widgets: [] };
    save();
    return id;
  }
  function renameDash(id, name) { const d = get(id); if (d) { d.name = name; save(); } }
  function dupDash(id, name) {
    const src = get(id);
    const nid = "usr" + Date.now().toString(36);
    const copy = JSON.parse(JSON.stringify(src));
    copy.name = name || src.name + " (salinan)";
    copy.builtin = false;
    copy.widgets.forEach((x) => { x.id = "W" + Math.random().toString(36).slice(2, 8); });
    load()[nid] = copy; save();
    return nid;
  }
  function deleteDash(id) { delete load()[id]; save(); }

  return {
    SOURCES, METRICS, WTYPES, DEFAULTS,
    render, repaint, toolbar, get, list, save, reset,
    get edit() { return state.edit; },
    setEdit(v) { state.edit = v; },
    toggleEdit, addWidget, editWidget, delWidget, dupWidget, draft, saveWidget,
    resetDash, resetGo, dragStart, resizeStart,
    createDash, renameDash, dupDash, deleteDash,
    bscRows
  };
})();
