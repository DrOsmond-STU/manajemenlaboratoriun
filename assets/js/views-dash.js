/* ==========================================================================
   FLMS — Views dashboard berbasis widget
   Dashboard Operasional, Dashboard Manajemen, Dashboard Analitik kustom,
   dan Balanced Scorecard.

   DUA MESIN BERDAMPINGAN, DIPILIH DI TINGKAT HALAMAN — bukan di tingkat
   data seperti modul lain. Mesin purwarupa (dash.js — SOURCES, METRICS,
   WTYPES, tata letak seret-lepas) tetap berdiri sendiri, tidak diubah sedikit
   pun oleh berkas ini. Katalog widget server (RegistriWidget, 41 kunci) tidak
   pernah dimaksudkan mencakup seluruh puluhan sumber data purwarupa yang
   bebas dikomposisi — itu batas keamanan yang disengaja, bukan kekurangan
   yang perlu ditutupi dengan pemetaan. Memetakan satu ke bentuk yang lain
   akan memalsukan salah satunya. Lihat catatan panjang di repo.js.

   Susun-ulang & ubah ukuran pada mesin tersambung memakai tombol naik/turun
   dan kolom angka — BUKAN seret-lepas seperti purwarupa. Ini penyederhanaan
   yang disengaja, dicatat di docs/BACKEND.md: fisika seret-lepas purwarupa
   terikat erat pada penyimpanan localStorage-nya sendiri, dan menulis
   ulangnya untuk menyimpan ke server adalah pekerjaan terpisah dari
   menyambungkan data. Yang dijaga adalah kebenarannya — tata letak benar-
   benar tersimpan ke server — bukan kehalusan seret-lepasnya.
   ========================================================================== */
(function () {
  const U = UI, D = DB, V = window.VIEWS, W = window.DASH;

  function page(dashId, title, sub, extraActions) {
    return {
      title, sub,
      actions: `${extraActions || ""}
        <button class="btn btn-sm" onclick="UI.demo('Ekspor dashboard ke PDF')">${U.icon("download")} Ekspor</button>
        <button class="btn btn-sm" id="btnEdit" onclick="DASH.toggleEdit()">${U.icon("edit")} Sunting Dashboard</button>`,
      render() {
        W.setEdit(false);
        return `<div id="dashBar" class="mb-12"></div><div id="dashHost">${W.render(dashId, "dashHost")}</div>`;
      },
      mount() { syncBar(); }
    };
  }

  /** Bilah bantuan yang muncul saat mode sunting aktif (mesin purwarupa). */
  function syncBar() {
    const bar = document.getElementById("dashBar");
    if (!bar) return;
    bar.innerHTML = W.edit ? `
      <div class="alert info" style="align-items:center">
        ${U.icon("edit", 17)}
        <div style="flex:1"><b>Mode sunting aktif</b>
          Seret ikon kisi untuk menyusun ulang, tarik sudut kanan bawah untuk mengubah lebar dan tinggi,
          atau klik ikon pensil untuk mengganti isi dan bentuk tampilan widget.</div>
        <button class="btn btn-sm" onclick="DASH.resetDash()">${U.icon("refresh", 13)} Kembalikan Bawaan</button>
        <button class="btn btn-sm btn-primary" onclick="DASH.toggleEdit()">${U.icon("check", 13)} Selesai</button>
      </div>` : "";
    const b = document.getElementById("btnEdit");
    if (b) b.innerHTML = `${U.icon(W.edit ? "check" : "edit")} ${W.edit ? "Selesai Menyunting" : "Sunting Dashboard"}`;
  }

  /* Bungkus toggleEdit agar bilah bantuan ikut diperbarui. */
  const _toggle = W.toggleEdit;
  W.toggleEdit = function () { _toggle(); syncBar(); };

  const purwarupaDashboard = page("ops", "Dashboard Operasional",
    "Ringkasan fasilitas, laboratorium, alat, dan transaksi hari ini. Seluruh komponen dapat disunting.",
    `<button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Booking Baru</button>`);

  const purwarupaExec = page("mgmt", "Dashboard Manajemen",
    "KPI strategis: utilisasi, pendapatan, biaya, dan nilai aset. Susunan dapat diatur sesuai kebutuhan rapat.",
    `<div class="seg"><button>Bulan Ini</button><button class="active">YTD 2026</button><button>12 Bulan</button></div>`);

  /* =======================================================================
     BALANCED SCORECARD — versi purwarupa (tidak diubah)
     ======================================================================= */
  const purwarupaBsc = {
    title: "Balanced Scorecard",
    sub: "Empat perspektif Kaplan & Norton: Finansial, Pelanggan, Proses Bisnis Internal, serta Pembelajaran & Pertumbuhan.",
    actions: `<div class="seg"><button class="active">Semester I 2026</button><button onclick="UI.demo('Periode sebelumnya')">Semester II 2025</button></div>
      <button class="btn btn-sm" onclick="bscManagePurwarupa()">${U.icon("gear")} Kelola Sasaran & KPI</button>
      <button class="btn btn-sm" onclick="window.print()">${U.icon("print")} Cetak</button>
      <button class="btn btn-sm" id="btnEdit" onclick="DASH.toggleEdit()">${U.icon("edit")} Sunting Dashboard</button>`,
    render() {
      W.setEdit(false);
      const t = D.bscTotal(), st = D.bscStatus(t);
      return `
        <div class="alert ${st.c === "green" ? "ok" : st.c === "amber" ? "warn" : "err"} mb-16">
          ${U.icon("star", 17)}<div><b>Skor keseluruhan ${t} dari 100 — ${st.t}</b>
          Periode ${U.esc(D.bsc.period)} · ${U.esc(D.bsc.unit)}. Skor dihitung sebagai rata-rata tertimbang
          empat perspektif; setiap perspektif merupakan rata-rata tertimbang indikator kinerja di dalamnya.</div></div>
        <div id="dashBar" class="mb-12"></div><div id="dashHost">${W.render("bsc", "dashHost")}</div>`;
    },
    mount() { syncBar(); }
  };

  window.bscManagePurwarupa = function () {
    U.modal({
      size: "xwide", title: "Kelola Sasaran Strategis & Indikator Kinerja",
      sub: D.bsc.period + " · bobot perspektif harus berjumlah 100%",
      body: `
        <div class="grid g4 mb-16" style="gap:10px">
          ${D.bsc.perspectives.map((p) => `
            <div class="card" style="border-left:3px solid ${p.color}"><div class="card-body tight">
              <div class="small bold trunc mb-4">${U.esc(p.name)}</div>
              <div class="field"><label class="tiny">Bobot perspektif (%)</label>
                <input type="number" class="input" value="${p.weight}" min="0" max="100"
                  onchange="bscSetWeight('${p.k}',+this.value)"></div>
            </div></div>`).join("")}
        </div>
        <div class="row mb-12"><span class="small muted" style="flex:1">Total bobot perspektif</span>
          <span class="badge ${D.bsc.perspectives.reduce((a, p) => a + p.weight, 0) === 100 ? "green" : "red"}">
            ${D.bsc.perspectives.reduce((a, p) => a + p.weight, 0)}%</span></div>
        ${U.table([
          { t: "Perspektif", render: (r) => `<span class="badge ${r.p.tint}">${r.p.k}</span>` },
          { t: "Sasaran Strategis", render: (r) => `<span class="small">${U.esc(r.o.name)}</span>` },
          { t: "Indikator Kinerja", render: (r) => `<b class="small">${U.esc(r.k.name)}</b>` },
          { t: "Satuan", render: (r) => `<span class="small muted">${U.esc(r.k.unit)}</span>` },
          { t: "Bobot", cls: "center", render: (r) => `<input type="number" class="input" style="width:64px;padding:3px 6px;font-size:12px"
              value="${r.k.weight}" onchange="bscSetKpi('${U.esc(r.k.name)}','weight',+this.value)">` },
          { t: "Target", cls: "center", render: (r) => `<input type="number" step="0.1" class="input" style="width:76px;padding:3px 6px;font-size:12px"
              value="${r.k.target}" onchange="bscSetKpi('${U.esc(r.k.name)}','target',+this.value)">` },
          { t: "Realisasi", cls: "center", render: (r) => `<input type="number" step="0.1" class="input" style="width:76px;padding:3px 6px;font-size:12px"
              value="${r.k.actual}" onchange="bscSetKpi('${U.esc(r.k.name)}','actual',+this.value)">` },
          { t: "Polaritas", render: (r) => `<span class="badge outline">${r.k.pol === "min" ? "Minimum" : "Maksimum"}</span>` },
          { t: "Skor", cls: "right", render: (r) => { const s = D.bscScore(r.k), st = D.bscStatus(s);
              return `<span class="badge ${st.c}">${s}%</span>`; } }
        ], DASH.bscRows())}
        <div class="alert info small mt-16">${U.icon("chart", 15)}<div>Perubahan target dan realisasi langsung
          memperbarui skor perspektif, skor keseluruhan, serta seluruh widget pada dashboard.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Tutup</button>
             <button class="btn" onclick="UI.demo('Tambah sasaran strategis baru')">${U.icon("plus")} Tambah Sasaran</button>
             <button class="btn btn-primary" onclick="UI.closeModal();DASH.repaint();UI.toast('Tersimpan','Sasaran dan KPI diperbarui.')">Simpan</button>`
    });
  };

  window.bscSetWeight = function (k, v) {
    const p = D.bsc.perspectives.find((x) => x.k === k);
    if (p) p.weight = v;
  };
  window.bscSetKpi = function (name, field, v) {
    DASH.bscRows().forEach((r) => { if (r.k.name === name) r.k[field] = v; });
  };
  window.bscEditKpi = function (name) {
    const row = DASH.bscRows().find((r) => r.k.name === name);
    if (!row) return;
    const k = row.k;
    U.modal({
      title: "Sunting Indikator Kinerja", sub: row.p.name + " · " + row.o.name,
      body: `<div class="grid g2 gap-12">
          <div class="field" style="grid-column:1/-1"><label>Nama indikator</label>
            <input class="input" id="kName" value="${U.esc(k.name)}"></div>
          <div class="field"><label>Satuan</label><input class="input" id="kUnit" value="${U.esc(k.unit)}"></div>
          <div class="field"><label>Bobot dalam perspektif (%)</label><input type="number" class="input" id="kW" value="${k.weight}"></div>
          <div class="field"><label>Target</label><input type="number" step="0.1" class="input" id="kT" value="${k.target}"></div>
          <div class="field"><label>Realisasi</label><input type="number" step="0.1" class="input" id="kA" value="${k.actual}"></div>
          <div class="field" style="grid-column:1/-1"><label>Polaritas</label>
            <div class="row wrap gap-6">
              <span class="chip ${k.pol !== "min" ? "on" : ""}" onclick="bscPol('max',this)">Semakin besar semakin baik</span>
              <span class="chip ${k.pol === "min" ? "on" : ""}" onclick="bscPol('min',this)">Semakin kecil semakin baik</span></div></div>
        </div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-primary" onclick="bscSaveKpi('${U.esc(name)}')">Simpan</button>`
    });
    window.__pol = k.pol || "max";
  };
  window.bscPol = function (p, el) {
    window.__pol = p;
    el.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
    el.classList.add("on");
  };
  window.bscSaveKpi = function (name) {
    const row = DASH.bscRows().find((r) => r.k.name === name);
    if (row) {
      const k = row.k;
      k.name = document.getElementById("kName").value || k.name;
      k.unit = document.getElementById("kUnit").value;
      k.weight = +document.getElementById("kW").value;
      k.target = +document.getElementById("kT").value;
      k.actual = +document.getElementById("kA").value;
      k.pol = window.__pol;
    }
    U.closeModal(); DASH.repaint();
    U.toast("Indikator diperbarui", "Skor perspektif dihitung ulang.");
  };

  /* =======================================================================
     DASHBOARD ANALITIK — versi purwarupa (tidak diubah)
     ======================================================================= */
  const SELKEY = "flms.dashSel";
  const selId = () => localStorage.getItem(SELKEY) || "analitik";

  const purwarupaAnalytics = {
    title: "Dashboard Analitik",
    sub: "Susun dashboard Anda sendiri: tambah dashboard, pilih widget, atur isi, ukuran, dan urutannya.",
    actions: `<button class="btn btn-sm" onclick="dashNew()">${U.icon("plus")} Dashboard Baru</button>
      <button class="btn btn-sm" onclick="DASH.addWidget()">${U.icon("plus")} Tambah Widget</button>
      <button class="btn btn-sm" id="btnEdit" onclick="DASH.toggleEdit()">${U.icon("edit")} Sunting Dashboard</button>`,
    render() {
      let id = selId();
      if (!W.get(id)) { id = "analitik"; localStorage.setItem(SELKEY, id); }
      W.setEdit(false);
      return `<div id="dashTabs">${tabsHTML(id)}</div>
        <div id="dashBar" class="mb-12"></div>
        <div id="dashHost">${W.render(id, "dashHost")}</div>`;
    },
    mount() { syncBar(); }
  };

  function tabsHTML(id) {
    const all = W.list();
    const cur = W.get(id);
    return `<div class="card mb-16"><div class="card-body tight">
      <div class="row wrap gap-8">
        ${all.map((d) => `<span class="chip ${d.id === id ? "on" : ""}" onclick="dashSel('${d.id}')">
          ${U.icon(d.icon || "grid", 12)} ${U.esc(d.name)}
          ${d.builtin ? `<span class="tiny faint">bawaan</span>` : ""}</span>`).join("")}
        <span class="chip" onclick="dashNew()">${U.icon("plus", 12)} Dashboard Baru</span>
        <div class="spacer"></div>
        <span class="small muted">${cur.widgets.length} widget</span>
        <button class="btn btn-sm" onclick="dashRename()">${U.icon("edit", 12)} Ganti Nama</button>
        <button class="btn btn-sm" onclick="dashDup()">${U.icon("box", 12)} Duplikat</button>
        ${cur.builtin ? "" : `<button class="btn btn-sm btn-danger" onclick="dashDel()">${U.icon("trash", 12)} Hapus</button>`}
      </div></div></div>`;
  }

  window.dashSel = function (id) {
    localStorage.setItem(SELKEY, id);
    document.getElementById("viewBody").innerHTML = purwarupaAnalytics.render();
    syncBar();
  };
  window.dashNew = function () {
    U.modal({
      title: "Dashboard Baru", sub: "Buat dashboard analitik sesuai kebutuhan Anda",
      body: `<div class="field mb-12"><label>Nama dashboard</label>
          <input class="input" id="dnName" placeholder="Contoh: Analitik Laboratorium Kimia"></div>
        <div class="field"><label>Ikon</label>
          <div class="row wrap gap-6" id="dnIcon">
            ${["grid", "chart", "flask", "building", "box", "money", "star", "users", "shield"].map((k, i) =>
              `<span class="chip ${i === 0 ? "on" : ""}" data-i="${k}"
                 onclick="this.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));this.classList.add('on')">
                 ${U.icon(k, 14)}</span>`).join("")}</div></div>
        <div class="alert info small mt-16">${U.icon("box", 15)}<div>Dashboard baru dimulai dari halaman kosong —
          tambahkan widget lalu atur isi, ukuran, dan urutannya.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-primary" onclick="dashNewGo()">Buat</button>`
    });
  };
  window.dashNewGo = function () {
    const nm = (document.getElementById("dnName") || {}).value || "Dashboard Baru";
    const ic = (document.querySelector("#dnIcon .chip.on") || {}).dataset;
    const id = W.createDash(nm, ic ? ic.i : "grid");
    localStorage.setItem(SELKEY, id);
    U.closeModal();
    document.getElementById("viewBody").innerHTML = purwarupaAnalytics.render();
    W.setEdit(true); W.repaint(); syncBar();
    U.toast("Dashboard dibuat", nm + " — mode sunting aktif.");
  };
  window.dashRename = function () {
    const d = W.get(selId());
    U.modal({
      title: "Ganti Nama Dashboard", sub: d.name,
      body: `<div class="field"><label>Nama baru</label><input class="input" id="drName" value="${U.esc(d.name)}"></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-primary" onclick="dashRenameGo()">Simpan</button>`
    });
  };
  window.dashRenameGo = function () {
    W.renameDash(selId(), document.getElementById("drName").value);
    U.closeModal();
    document.getElementById("viewBody").innerHTML = purwarupaAnalytics.render();
    syncBar();
  };
  window.dashDup = function () {
    const id = W.dupDash(selId());
    localStorage.setItem(SELKEY, id);
    document.getElementById("viewBody").innerHTML = purwarupaAnalytics.render();
    syncBar();
    U.toast("Dashboard diduplikasi", W.get(id).name);
  };
  window.dashDel = function () {
    const d = W.get(selId());
    U.modal({
      title: "Hapus Dashboard", sub: d.name,
      body: `<p class="small">Dashboard <b>${U.esc(d.name)}</b> beserta seluruh widget di dalamnya akan dihapus.</p>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-danger" onclick="dashDelGo()">Hapus</button>`
    });
  };
  window.dashDelGo = function () {
    W.deleteDash(selId());
    localStorage.setItem(SELKEY, "analitik");
    U.closeModal();
    document.getElementById("viewBody").innerHTML = purwarupaAnalytics.render();
    syncBar();
    U.toast("Dashboard dihapus", "", "warn");
  };

  /* =======================================================================
     ================  MESIN TERSAMBUNG (di bawah baris ini)  ==============
     =======================================================================

     Bentuk data yang datang dari server (lihat DataWidget di backend):
       angka    { nilai, pesan? }
       daftar   { nilai, baris:[{id,judul,keterangan,status}], terpotong }
       sebaran  { bagian:[{kode,nama,jumlah}], nilai }
       deret    { titik:[{label,nilai}], satuan }
       matriks  { baris:[...], kolom:[...], sel:[[...]] }
       teks     null — isinya di widget.opsi.catatan, murni sisi klien
       bsc-*    kartu skor BSC utuh: { periode, perspektif:[...], skor }
     ======================================================================= */

  const JENIS_DASH = { operasional: "Operasional", analitik: "Analitik", bsc: "Balanced Scorecard" };
  const STATUS_TINT = {
    kedaluwarsa: "red", terlambat: "red", "jatuh tempo": "amber",
    aktif: "brand", dijadwalkan: "brand", berjalan: "amber", selesai: "green",
    menunggu: "amber", disetujui: "green", ditolak: "red", dibatalkan: "slate",
    dipinjam: "brand", dikembalikan: "green"
  };
  const tintStatus = (s) => STATUS_TINT[s] || "slate";

  /* ------------------------------------------------------ isi tiap widget */

  function liveKpiHTML(w, d) {
    const nilai = d.nilai;
    const tampil = nilai === null || nilai === undefined ? "—"
      : w.satuan === "rupiah" ? U.rp(nilai)
      : U.num(nilai);
    return `<div class="kpi" style="padding:0;width:100%">
      <div class="kpi-top"><div class="kpi-ico tint-brand">${U.icon("grid", 17)}</div>
        <div class="kpi-label" style="line-height:1.25">${U.esc(w.judul)}</div></div>
      <div class="kpi-val">${tampil}${w.satuan && w.satuan !== "rupiah" ? `<small> ${U.esc(w.satuan)}</small>` : ""}</div>
    </div>`;
  }

  function liveDaftarHTML(d) {
    if (!d.baris.length) return U.emptyState("Tidak ada data", "");
    return `<div class="col gap-2">${d.baris.map((r) => `
      <div class="row" style="padding:7px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:0"><div class="small bold trunc">${U.esc(r.judul)}</div>
          <div class="tiny faint trunc">${U.esc(r.keterangan || "")}</div></div>
        <span class="badge ${tintStatus(r.status)}">${U.esc(r.status)}</span></div>`).join("")}
      ${d.terpotong ? `<div class="tiny faint mt-6">Menampilkan ${d.baris.length} dari ${d.nilai} — buka menu terkait untuk selengkapnya.</div>` : ""}
    </div>`;
  }

  function liveSebaranHTML(d) {
    const PAL = ["var(--brand-500)", "var(--teal-500)", "var(--violet-500)", "var(--amber-500)", "var(--green-500)", "var(--red-500)"];
    const items = d.bagian.map((b, i) => ({ n: b.nama, v: b.jumlah, c: PAL[i % PAL.length] }));
    if (!items.some((i) => i.v)) return U.emptyState("Belum ada data", "");
    return `<div class="row wrap" style="gap:18px">
      <div>${U.donut(items, { label: "Total", size: 148 })}</div>
      <div style="flex:1;min-width:150px">${items.map((i) => `
        <div class="row small" style="padding:3px 0"><i style="width:9px;height:9px;border-radius:3px;background:${i.c};display:inline-block"></i>
        <span style="flex:1;min-width:0" class="trunc">${U.esc(i.n)}</span><b>${U.num(i.v)}</b></div>`).join("")}</div>
    </div>`;
  }

  function liveDeretHTML(d, bentuk) {
    if (!d.titik.length) return U.emptyState("Belum ada data", "");
    const fmt = (v) => d.satuan === "rupiah" ? U.rpShort(v) : (v === null ? "—" : v + (d.satuan === "%" ? "%" : ""));
    if (bentuk === "batang") {
      return U.barChart(d.titik.map((t) => ({ m: t.label, val: t.nilai || 0 })), { fmt });
    }
    const series = d.titik.map((t) => ({ m: t.label, nilai: t.nilai === null ? 0 : t.nilai }));
    const max = d.satuan === "%" ? 100 : Math.max(10, Math.ceil(Math.max.apply(null, series.map((s) => s.nilai)) * 1.2));
    return U.areaChart(series, { max, colors: ["var(--brand-500)"] });
  }

  function liveMatriksHTML(d) {
    return U.heatmap(d.sel, d.baris.map((b) => b.slice(0, 3)), d.kolom);
  }

  function liveCatatanHTML(w) {
    const teks = (w.opsi && w.opsi.catatan) || "";
    if (!teks) return `<div class="small muted" style="padding:8px 0">Belum ada catatan. Klik ikon pensil untuk menulisnya.</div>`;
    return `<div class="small" style="white-space:pre-wrap;line-height:1.6">${U.esc(teks)}</div>`;
  }

  function liveBscHTML(bentuk, kartu) {
    if (bentuk === "bsc-skor") {
      const s = kartu.skor, st = D.bscStatus(s || 0);
      const R = 52, C = 2 * Math.PI * R, off = C * (1 - Math.min(1, (s || 0) / 100));
      return `<div class="center">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--surface-3)" stroke-width="14"/>
          ${s !== null ? `<circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--${st.c}-500)"
            stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"
            transform="rotate(-90 70 70)"/>` : ""}
          <text x="70" y="68" text-anchor="middle" font-size="27" font-weight="700" fill="var(--text)">${s === null ? "—" : s}</text>
          <text x="70" y="86" text-anchor="middle" font-size="10" fill="var(--text-muted)">dari 100</text>
        </svg>
        <div class="mt-8"><span class="badge ${st.c}">${s === null ? "Belum terisi" : st.t}</span></div>
        <div class="tiny faint mt-4">Periode ${U.esc(kartu.periode)}</div></div>`;
    }
    if (bentuk === "bsc-perspektif") {
      return `<div class="grid g2" style="gap:10px">${kartu.perspektif.map((p) => {
        const s = p.skor, st = D.bscStatus(s || 0);
        return `<div class="card" style="border-left:3px solid var(--brand-500)"><div class="card-body tight">
          <div class="small bold trunc mb-4">${U.esc(p.nama)}</div>
          <div class="row"><h3 style="flex:1">${s === null ? "—" : s}<small class="muted" style="font-size:11px">/100</small></h3>
            <span class="badge outline tiny">bobot ${p.bobot_total}%</span></div>
          <div class="bar thin mt-6"><i style="width:${Math.min(100, s || 0)}%;background:var(--brand-500)"></i></div>
          ${s !== null ? `<div class="tiny mt-4" style="color:var(--${st.c}-500)">${st.t}</div>` : `<div class="tiny mt-4 muted">Belum ada realisasi</div>`}
        </div></div>`;
      }).join("")}</div>`;
    }
    if (bentuk === "bsc-peta") {
      return liveBscPeta(kartu);
    }
    // bsc-tabel
    const baris = [];
    kartu.perspektif.forEach((p) => {
      let firstP = true;
      (p.sasaran || []).forEach((sasaran) => {
        let firstO = true;
        sasaran.indikator.forEach((k) => {
          baris.push({ p, sasaran, k, firstP, firstO });
          firstP = false; firstO = false;
        });
      });
    });
    if (!baris.length) return U.emptyState("Belum ada indikator", "Kelola sasaran & KPI pada halaman Balanced Scorecard.");
    return U.table([
      { t: "Perspektif", render: (r) => r.firstP ? `<span class="badge outline">${U.esc(r.p.nama)}</span>` : "" },
      { t: "Sasaran", render: (r) => r.firstO ? `<span class="small">${U.esc(r.sasaran.nama)}</span>` : "" },
      { t: "Indikator", render: (r) => `<b class="small">${U.esc(r.k.nama)}</b>` },
      { t: "Bobot", cls: "center", render: (r) => r.k.bobot + "%" },
      { t: "Target", cls: "right", render: (r) => U.esc(String(r.k.target)) },
      { t: "Realisasi", cls: "right", render: (r) => r.k.realisasi === null ? "—" : `<b>${U.esc(String(r.k.realisasi))}</b>` },
      { t: "Skor", cls: "right", render: (r) => r.k.capaian === null ? "—" : `<span class="badge ${D.bscStatus(Math.min(120, r.k.capaian)).c}">${Math.min(120, r.k.capaian)}%</span>` }
    ], baris);
  }

  function liveBscPeta(kartu) {
    const H = 320, WW = 560, boxH = 58, gap = (H - kartu.perspektif.length * boxH) / (kartu.perspektif.length + 1);
    let out = `<svg viewBox="0 0 ${WW} ${H}" width="100%" height="100%" style="max-height:100%">`;
    // urutan bawah→atas: Pembelajaran → Proses → Pelanggan → Keuangan
    const urutan = ["pembelajaran", "proses-internal", "pelanggan", "keuangan"];
    urutan.forEach((kode, i) => {
      const p = kartu.perspektif.find((x) => x.kode === kode);
      if (!p) return;
      const y = H - gap - (i + 1) * boxH - i * gap;
      const s = p.skor === null ? 0 : p.skor;
      out += `<rect x="10" y="${y}" width="${WW - 20}" height="${boxH}" rx="10" fill="var(--brand-500)" opacity=".1"/>`;
      out += `<rect x="10" y="${y}" width="4" height="${boxH}" rx="2" fill="var(--brand-500)"/>`;
      out += `<text x="26" y="${y + 21}" font-size="12.5" font-weight="700" fill="var(--text)">${U.esc(p.nama)}</text>`;
      out += `<text x="26" y="${y + 38}" font-size="10.5" fill="var(--text-muted)">${(p.sasaran || []).map((o) => o.nama).join(" · ").slice(0, 74)}</text>`;
      out += `<text x="${WW - 22}" y="${y + 27}" font-size="15" font-weight="700" text-anchor="end" fill="var(--brand-500)">${p.skor === null ? "—" : p.skor}</text>`;
      out += `<text x="${WW - 22}" y="${y + 41}" font-size="9" text-anchor="end" fill="var(--text-faint)">bobot ${p.bobot_total}%</text>`;
    });
    for (let i = 0; i < urutan.length - 1; i++) {
      const y1 = H - gap - (i + 1) * boxH - i * gap;
      const y2 = H - gap - (i + 2) * boxH - (i + 1) * gap + boxH;
      out += `<path d="M ${WW / 2} ${y1} L ${WW / 2} ${y2 + 6}" stroke="var(--border-strong)" stroke-width="2" fill="none"/>`;
      out += `<path d="M ${WW / 2 - 5} ${y2 + 11} L ${WW / 2} ${y2 + 2} L ${WW / 2 + 5} ${y2 + 11} Z" fill="var(--border-strong)"/>`;
    }
    return out + `</svg>`;
  }

  function liveWidgetBody(w) {
    if (w.data && w.data.pesan) {
      return `<div class="small muted center" style="padding:20px">${U.icon("shield", 14)} ${U.esc(w.data.pesan)}</div>`;
    }
    switch (w.bentuk) {
      case "angka": return liveKpiHTML(w, w.data);
      case "daftar": return liveDaftarHTML(w.data);
      case "sebaran": return liveSebaranHTML(w.data);
      case "deret": case "garis": case "batang": return liveDeretHTML(w.data, w.bentuk);
      case "matriks": return liveMatriksHTML(w.data);
      case "teks": return liveCatatanHTML(w);
      case "bsc-skor": case "bsc-perspektif": case "bsc-peta": case "bsc-tabel":
        return liveBscHTML(w.bentuk, w.data);
      default: return U.emptyState("Bentuk tidak dikenal", w.bentuk);
    }
  }

  /* --------------------------------------------------------- kartu widget */

  function liveWidgetHTML(w, editing, i, total) {
    const tools = editing ? `
      <div class="wdg-tools">
        <button class="wdg-btn" title="Naik" ${i === 0 ? "disabled" : ""} onclick="dashGeser(${i},-1)">▲</button>
        <button class="wdg-btn" title="Turun" ${i === total - 1 ? "disabled" : ""} onclick="dashGeser(${i},1)">▼</button>
        <button class="wdg-btn" title="Sunting" onclick="dashSuntingWidget(${i})">${U.icon("edit", 13)}</button>
        <button class="wdg-btn" title="Hapus" onclick="dashHapusWidget(${i})">${U.icon("trash", 13)}</button>
      </div>` : "";
    const head = w.bentuk === "angka" ? "" : `
      <div class="card-head" style="padding:11px 14px">
        <div style="min-width:0"><h3 class="trunc">${U.esc(w.judul)}</h3></div>
      </div>`;
    return `<div class="wdg card" style="grid-column:span ${w.kisi.lebar};height:${w.kisi.tinggi * 130}px">
      ${tools}${head}
      <div class="wdg-body ${w.bentuk === "angka" ? "kpi-body" : ""}" style="overflow:auto">${liveWidgetBody(w)}</div>
    </div>`;
  }

  /* ------------------------------------------------------------ keadaan */

  const LIVE = { daftar: [], id: null, dash: null, edit: false, memuat: true };

  async function liveMuatDaftar() {
    try {
      const j = await Repo.dashboard.daftar();
      LIVE.daftar = j.data;
    } catch (e) {
      LIVE.daftar = [];
    }
  }

  async function liveMuatDash(id) {
    LIVE.memuat = true;
    liveRepaint();
    try {
      LIVE.dash = await Repo.dashboard.lihat(id);
      LIVE.id = id;
    } catch (e) {
      Repo.tampilkanGalat(e, "Gagal memuat dashboard");
      LIVE.dash = null;
    } finally {
      LIVE.memuat = false;
      liveRepaint();
    }
  }

  function liveRepaint() {
    const host = document.getElementById("dashHostLive");
    if (host) host.innerHTML = liveHostHTML();
    const bar = document.getElementById("dashBarLive");
    if (bar) bar.innerHTML = liveBarHTML();
    const tabs = document.getElementById("dashTabsLive");
    if (tabs) tabs.innerHTML = liveTabsHTML();
  }

  function liveBarHTML() {
    if (!LIVE.edit) return "";
    return `<div class="alert info" style="align-items:center">
      ${U.icon("edit", 17)}
      <div style="flex:1"><b>Mode sunting aktif</b>
        Gunakan tombol naik/turun untuk menyusun ulang, ikon pensil untuk mengubah isi dan ukuran widget.</div>
      <button class="btn btn-sm btn-primary" onclick="dashSelesaiSunting()">${U.icon("check", 13)} Selesai</button>
    </div>`;
  }

  function liveTabsHTML() {
    if (!LIVE.dash) return "";
    return `<div class="card mb-16"><div class="card-body tight">
      <div class="row wrap gap-8">
        ${LIVE.daftar.map((d) => `<span class="chip ${d.id === LIVE.id ? "on" : ""}" onclick="dashPilihLive('${d.id}')">
          ${U.icon(JENIS_DASH[d.jenis.kode] ? "grid" : "grid", 12)} ${U.esc(d.nama)}
          ${d.utama ? `<span class="tiny faint">utama</span>` : ""}
          ${d.bersama ? `<span class="tiny faint">bersama</span>` : ""}</span>`).join("")}
        <span class="chip" onclick="dashBaruLive()">${U.icon("plus", 12)} Dashboard Baru</span>
        <div class="spacer"></div>
        <span class="small muted">${LIVE.dash.widgets.length} widget</span>
        ${LIVE.dash.dapat_disunting ? `
          <button class="btn btn-sm" onclick="dashGantiNamaLive()">${U.icon("edit", 12)} Ganti Nama</button>
          <button class="btn btn-sm btn-danger" onclick="dashHapusLive()">${U.icon("trash", 12)} Hapus</button>` : ""}
      </div></div></div>`;
  }

  function liveHostHTML() {
    if (LIVE.memuat) return `<div style="padding:40px;text-align:center"><span class="muted">Memuat dashboard…</span></div>`;
    if (!LIVE.dash) return U.emptyState("Dashboard tidak dapat dimuat", "");

    const w = LIVE.dash.widgets;
    return `<div class="dash-grid ${LIVE.edit ? "editing" : ""}" style="display:grid;grid-template-columns:repeat(12,1fr);gap:16px">
      ${w.map((x, i) => liveWidgetHTML(x, LIVE.edit && LIVE.dash.dapat_disunting, i, w.length)).join("")}
      ${LIVE.edit && LIVE.dash.dapat_disunting ? `<div class="wdg-add" style="grid-column:span 3" onclick="dashTambahWidget()">
        ${U.icon("plus", 20)}<div class="small bold mt-4">Tambah Widget</div>
        <div class="tiny faint">Pilih dari katalog widget tersedia</div></div>` : ""}
    </div>`;
  }

  window.dashPilihLive = function (id) { liveMuatDash(id); };

  window.dashSelesaiSunting = async function () {
    LIVE.edit = false;
    try {
      await Repo.dashboard.simpan(LIVE.id, {
        nama: LIVE.dash.nama, jenis: LIVE.dash.jenis.kode, utama: LIVE.dash.utama,
        widgets: LIVE.dash.widgets.map((w) => ({
          widget: w.widget, judul: w.judul, bentuk: w.bentuk, opsi: w.opsi || undefined,
          kolom: w.kisi.kolom, baris: w.kisi.baris, lebar: w.kisi.lebar, tinggi: w.kisi.tinggi
        }))
      });
      U.toast("Tersimpan", "Susunan dashboard tersimpan ke server.");
      await liveMuatDaftar();
      await liveMuatDash(LIVE.id);
    } catch (e) {
      Repo.tampilkanGalat(e, "Gagal menyimpan dashboard");
      liveRepaint();
    }
  };

  window.dashGeser = function (i, arah) {
    const w = LIVE.dash.widgets;
    const j = i + arah;
    if (j < 0 || j >= w.length) return;
    [w[i], w[j]] = [w[j], w[i]];
    // Baris mengikuti urutan tampil; kolomnya tetap 0 dan lebar aslinya —
    // penyusunan ulang di sini berarti "urutan baris", bukan tata letak
    // kisi bebas seperti seret-lepas purwarupa.
    w.forEach((x, idx) => { x.kisi.baris = idx; x.kisi.kolom = 0; });
    liveRepaint();
  };

  window.dashHapusWidget = function (i) {
    LIVE.dash.widgets.splice(i, 1);
    liveRepaint();
  };

  window.dashSuntingWidget = function (i) {
    dashFormWidget(LIVE.dash.widgets[i], i);
  };

  window.dashTambahWidget = async function () {
    dashFormWidget(null, -1);
  };

  async function dashFormWidget(w, index) {
    let tersedia = [];
    try { tersedia = await Repo.dashboard.widgetTersedia(); } catch (e) { tersedia = []; }
    if (!tersedia.length) {
      U.toast("Tidak ada widget tersedia", "Tidak ada widget yang izinnya Anda punyai.");
      return;
    }

    const awal = w ? tersedia.find((t) => t.kunci === w.widget) : tersedia[0];
    window.__dashDraft = {
      widget: awal.kunci, judul: (w && w.judul) || awal.judul, bentuk: (w && w.bentuk) || awal.bentuk,
      lebar: (w && w.kisi.lebar) || 4, tinggi: (w && w.kisi.tinggi) || 2,
      hari: (w && w.opsi && w.opsi.hari) || "", batas: (w && w.opsi && w.opsi.batas) || "",
      catatan: (w && w.opsi && w.opsi.catatan) || ""
    };
    window.__dashKatalog = tersedia;
    window.__dashIndex = index;

    U.drawer({
      title: index < 0 ? "Tambah Widget" : "Sunting Widget",
      sub: "Pilih widget dari katalog yang tersedia untuk peran Anda",
      body: `<div id="dashFormBody">${dashFormHTML()}</div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" onclick="dashSimpanWidgetForm()">${U.icon("check")} ${index < 0 ? "Tambahkan" : "Simpan"}</button>`
    });
  }

  function dashFormHTML() {
    const dr = window.__dashDraft;
    const tersedia = window.__dashKatalog;
    const ket = tersedia.find((t) => t.kunci === dr.widget) || tersedia[0];
    const bentukPilihan = dashBentukUntuk(ket.bentuk);

    return `<label class="fld"><span>Widget</span>
        <select class="select" onchange="dashGantiWidget(this.value)">
          ${tersedia.map((t) => `<option value="${t.kunci}" ${dr.widget === t.kunci ? "selected" : ""}>${U.esc(t.judul)}</option>`).join("")}
        </select></label>
      <label class="fld mt-8"><span>Judul tampil</span>
        <input class="input" value="${U.esc(dr.judul)}" oninput="window.__dashDraft.judul=this.value"></label>
      <div class="grid g2 gap-12 mt-8">
        <label class="fld"><span>Bentuk tampilan</span>
          <select class="select" onchange="window.__dashDraft.bentuk=this.value">
            ${bentukPilihan.map((b) => `<option value="${b}" ${dr.bentuk === b ? "selected" : ""}>${dashNamaBentuk(b)}</option>`).join("")}
          </select></label>
        <label class="fld"><span>Lebar (1–12 kolom)</span>
          <input type="number" class="input" min="1" max="12" value="${dr.lebar}"
            oninput="window.__dashDraft.lebar=+this.value"></label>
      </div>
      <label class="fld mt-8"><span>Tinggi (satuan baris)</span>
        <input type="number" class="input" min="1" max="6" value="${dr.tinggi}"
          oninput="window.__dashDraft.tinggi=+this.value"></label>
      ${ket.bentuk === "daftar" ? `
        <label class="fld mt-8"><span>Jumlah baris ditampilkan</span>
          <input type="number" class="input" min="1" max="50" value="${dr.batas}" placeholder="8 (bawaan)"
            oninput="window.__dashDraft.batas=this.value"></label>` : ""}
      ${ket.kunci === "pemeliharaan.terjadwal" ? `
        <label class="fld mt-8"><span>Rentang hari ke depan</span>
          <input type="number" class="input" min="1" max="365" value="${dr.hari}" placeholder="30 (bawaan)"
            oninput="window.__dashDraft.hari=this.value"></label>` : ""}
      ${ket.kunci === "catatan.bebas" ? `
        <label class="fld mt-8"><span>Isi catatan</span>
          <textarea class="input" rows="4" oninput="window.__dashDraft.catatan=this.value">${U.esc(dr.catatan)}</textarea></label>` : ""}`;
  }

  /** Bentuk yang masuk akal untuk sebuah widget, berdasarkan bentuk bawaannya di registri. */
  function dashBentukUntuk(bentukBawaan) {
    if (bentukBawaan === "deret") return ["deret", "garis", "batang"];
    if (bentukBawaan.startsWith("bsc-")) return ["bsc-skor", "bsc-perspektif", "bsc-peta", "bsc-tabel"];
    return [bentukBawaan];
  }
  function dashNamaBentuk(b) {
    return {
      angka: "Kartu angka", daftar: "Daftar", sebaran: "Diagram donat",
      deret: "Grafik area", garis: "Grafik garis", batang: "Grafik batang", matriks: "Heatmap", teks: "Catatan",
      "bsc-skor": "Skor keseluruhan", "bsc-perspektif": "Kartu per perspektif",
      "bsc-peta": "Peta strategi", "bsc-tabel": "Tabel KPI lengkap"
    }[b] || b;
  }

  window.dashGantiWidget = function (kunci) {
    const ket = window.__dashKatalog.find((t) => t.kunci === kunci);
    window.__dashDraft.widget = kunci;
    window.__dashDraft.judul = ket.judul;
    window.__dashDraft.bentuk = ket.bentuk;
    document.getElementById("dashFormBody").innerHTML = dashFormHTML();
  };

  window.dashSimpanWidgetForm = function () {
    const dr = window.__dashDraft;
    const opsi = {};
    if (dr.hari) opsi.hari = Number(dr.hari);
    if (dr.batas) opsi.batas = Number(dr.batas);
    if (dr.catatan) opsi.catatan = dr.catatan;

    const baru = {
      id: "sementara-" + Math.random().toString(36).slice(2, 8),
      widget: dr.widget, judul: dr.judul, bentuk: dr.bentuk,
      opsi: Object.keys(opsi).length ? opsi : null,
      kisi: { kolom: 0, baris: 0, lebar: dr.lebar, tinggi: dr.tinggi },
      data: { nilai: null, pesan: "Akan dihitung setelah disimpan." }
    };

    if (window.__dashIndex < 0) {
      baru.kisi.baris = LIVE.dash.widgets.length;
      LIVE.dash.widgets.push(baru);
    } else {
      baru.kisi.baris = LIVE.dash.widgets[window.__dashIndex].kisi.baris;
      LIVE.dash.widgets[window.__dashIndex] = baru;
    }

    U.closeDrawer();
    liveRepaint();
  };

  /* ----------------------------------------------------- dashboard baru */

  window.dashBaruLive = function () {
    U.modal({
      title: "Dashboard Baru", sub: "Buat dashboard sesuai kebutuhan Anda",
      body: `<div class="field"><label>Nama dashboard</label>
          <input class="input" id="dnlNama" placeholder="Contoh: Analitik Laboratorium Kimia"></div>
        <div class="field mt-8"><label>Jenis</label>
          <select class="select" id="dnlJenis">
            ${Object.keys(JENIS_DASH).map((k) => `<option value="${k}">${JENIS_DASH[k]}</option>`).join("")}
          </select></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-primary" onclick="dashBaruLiveGo()">Buat</button>`
    });
  };

  window.dashBaruLiveGo = async function () {
    const nama = document.getElementById("dnlNama").value || "Dashboard Baru";
    const jenis = document.getElementById("dnlJenis").value;
    try {
      const d = await Repo.dashboard.buat({ nama, jenis, widgets: [] });
      U.closeModal();
      await liveMuatDaftar();
      await liveMuatDash(d.id);
      LIVE.edit = true;
      liveRepaint();
      U.toast("Dashboard dibuat", nama + " — mode sunting aktif.");
    } catch (e) {
      Repo.tampilkanGalat(e, "Gagal membuat dashboard");
    }
  };

  window.dashGantiNamaLive = function () {
    U.modal({
      title: "Ganti Nama Dashboard", sub: LIVE.dash.nama,
      body: `<div class="field"><label>Nama baru</label><input class="input" id="drlNama" value="${U.esc(LIVE.dash.nama)}"></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-primary" onclick="dashGantiNamaLiveGo()">Simpan</button>`
    });
  };
  window.dashGantiNamaLiveGo = async function () {
    const nama = document.getElementById("drlNama").value;
    try {
      await Repo.dashboard.simpan(LIVE.id, {
        nama, jenis: LIVE.dash.jenis.kode, utama: LIVE.dash.utama,
        widgets: LIVE.dash.widgets.map((w) => ({
          widget: w.widget, judul: w.judul, bentuk: w.bentuk, opsi: w.opsi || undefined,
          kolom: w.kisi.kolom, baris: w.kisi.baris, lebar: w.kisi.lebar, tinggi: w.kisi.tinggi
        }))
      });
      U.closeModal();
      await liveMuatDaftar();
      await liveMuatDash(LIVE.id);
    } catch (e) {
      Repo.tampilkanGalat(e, "Gagal mengganti nama");
    }
  };

  window.dashHapusLive = function () {
    U.modal({
      title: "Hapus Dashboard", sub: LIVE.dash.nama,
      body: `<p class="small">Dashboard <b>${U.esc(LIVE.dash.nama)}</b> beserta seluruh widget di dalamnya akan dihapus dari server.</p>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-danger" onclick="dashHapusLiveGo()">Hapus</button>`
    });
  };
  window.dashHapusLiveGo = async function () {
    try {
      await Repo.dashboard.hapus(LIVE.id);
      U.closeModal();
      await liveMuatDaftar();
      const sisanya = LIVE.daftar[0];
      if (sisanya) await liveMuatDash(sisanya.id);
      else { LIVE.dash = null; liveRepaint(); }
      U.toast("Dashboard dihapus", "", "warn");
    } catch (e) {
      Repo.tampilkanGalat(e, "Gagal menghapus dashboard");
    }
  };

  /* -------------------------------------------------------- rute halaman */

  /**
   * Ketiga rute (Operasional, Manajemen, Analitik) berbagi SATU mesin dan
   * satu daftar dashboard — backend tidak punya konsep "dashboard rute
   * operasional" terpisah dari "dashboard rute manajemen" seperti purwarupa
   * (dash.js.DEFAULTS.ops/mgmt); yang ada hanyalah dashboard bertanda jenis,
   * dan siapa pun boleh membuat serta melihat sebanyak apa pun. Supaya
   * ketiga rute tidak tampak seperti satu halaman yang sama persis, tiap
   * rute mencoba memilih dashboard berjenis sesuai saat pertama dibuka —
   * tetap boleh berpindah bebas lewat tab begitu di sana, karena itu memang
   * bagaimana datanya sungguhan berbentuk.
   */
  function halamanTersambung(judul, sub, jenisAwal) {
    return {
      title: judul, sub,
      get actions() {
        return `<button class="btn btn-sm" onclick="dashBaruLive()">${U.icon("plus")} Dashboard Baru</button>
          <button class="btn btn-sm ${LIVE.edit ? "btn-primary" : ""}" id="btnEditLive" onclick="dashToggleEditLive()">
            ${U.icon(LIVE.edit ? "check" : "edit")} ${LIVE.edit ? "Selesai" : "Sunting Dashboard"}</button>`;
      },
      render() {
        return `<div id="dashTabsLive"></div><div id="dashBarLive" class="mb-12"></div>
          <div id="dashHostLive">${liveHostHTML()}</div>`;
      },
      async mount() {
        if (!LIVE.daftar.length) await liveMuatDaftar();

        const cocok = LIVE.daftar.find((d) => d.jenis.kode === jenisAwal && d.utama)
          || LIVE.daftar.find((d) => d.jenis.kode === jenisAwal);

        if (cocok && cocok.id !== LIVE.id) {
          await liveMuatDash(cocok.id);
        } else if (!LIVE.id) {
          try {
            const utama = await Repo.dashboard.utama();
            LIVE.dash = utama; LIVE.id = utama.id;
            if (!LIVE.daftar.length) LIVE.daftar = [utama];
          } catch (e) {
            Repo.tampilkanGalat(e, "Gagal memuat dashboard");
            LIVE.dash = null;
          }
        } else {
          await liveMuatDash(LIVE.id);
        }
        LIVE.memuat = false;
        liveRepaint();
      }
    };
  }

  window.dashToggleEditLive = function () {
    if (LIVE.edit) { dashSelesaiSunting(); return; }
    LIVE.edit = true;
    const b = document.getElementById("btnEditLive");
    if (b) { b.classList.add("btn-primary"); b.innerHTML = `${U.icon("check")} Selesai`; }
    liveRepaint();
  };

  Object.defineProperty(V, "dashboard", {
    configurable: true, enumerable: true,
    get: () => Repo.dapatMenulis() ? halamanTersambung("Dashboard Operasional",
      "Ringkasan fasilitas, laboratorium, alat, dan transaksi hari ini — data sungguhan dari server.",
      "operasional") : purwarupaDashboard
  });
  Object.defineProperty(V, "exec", {
    configurable: true, enumerable: true,
    get: () => Repo.dapatMenulis() ? halamanTersambung("Dashboard Manajemen",
      "KPI strategis. Susunan dapat diatur sesuai kebutuhan rapat.",
      "operasional") : purwarupaExec
  });
  Object.defineProperty(V, "analytics", {
    configurable: true, enumerable: true,
    get: () => Repo.dapatMenulis() ? halamanTersambung("Dashboard Analitik",
      "Susun dashboard Anda sendiri dari widget yang tersedia untuk peran Anda.",
      "analitik") : purwarupaAnalytics
  });

  /* =======================================================================
     BALANCED SCORECARD TERSAMBUNG
     ======================================================================= */

  const BSC_LIVE = { periode: String(new Date().getFullYear()), kartu: null, memuat: true };

  async function bscLiveMuat() {
    BSC_LIVE.memuat = true;
    bscLiveRepaint();
    try {
      BSC_LIVE.kartu = await Repo.bsc.kartu(BSC_LIVE.periode);
    } catch (e) {
      Repo.tampilkanGalat(e, "Gagal memuat kartu skor");
      BSC_LIVE.kartu = null;
    } finally {
      BSC_LIVE.memuat = false;
      bscLiveRepaint();
    }
  }

  function bscLiveRepaint() {
    const host = document.getElementById("bscHostLive");
    if (host) host.innerHTML = bscLiveHostHTML();
  }

  function bscLiveHostHTML() {
    if (BSC_LIVE.memuat) return `<div style="padding:40px;text-align:center"><span class="muted">Memuat kartu skor…</span></div>`;
    if (!BSC_LIVE.kartu) return U.emptyState("Kartu skor tidak dapat dimuat", "");

    const k = BSC_LIVE.kartu;
    const st = D.bscStatus(k.skor || 0);
    return `
      <div class="alert ${k.skor === null ? "info" : (st.c === "green" ? "ok" : st.c === "amber" ? "warn" : "err")} mb-16">
        ${U.icon("star", 17)}<div><b>Skor keseluruhan ${k.skor === null ? "belum terisi" : k.skor + " dari 100 — " + st.t}</b>
        Periode ${U.esc(k.periode)}. Skor dihitung sebagai rata-rata tertimbang perspektif yang sudah punya realisasi;
        perspektif kosong dikeluarkan dari rata-rata, bukan dihitung nol.</div></div>
      <div class="grid g4 mb-16" style="gap:12px">
        ${k.perspektif.map((p) => `
          <div class="card"><div class="card-body tight">
            <div class="row mb-6"><span class="small bold trunc" style="flex:1">${U.esc(p.nama)}</span>
              <span class="badge outline tiny">bobot ${p.bobot_total}%</span></div>
            <h2>${p.skor === null ? "—" : p.skor}<small class="muted" style="font-size:12px">/100</small></h2>
            <div class="bar thin mt-6"><i style="width:${Math.min(100, p.skor || 0)}%;background:var(--brand-500)"></i></div>
            <button class="btn btn-sm mt-10" onclick="bscKelolaPerspektif('${p.kode}')">${U.icon("gear", 12)} Kelola</button>
          </div></div>`).join("")}
      </div>
      ${liveBscHTML("bsc-tabel", k)}`;
  }

  V["bsc"] = {
    title: "Balanced Scorecard",
    sub: "Empat perspektif Kaplan & Norton: Keuangan, Pelanggan, Proses Bisnis Internal, serta Pembelajaran & Pertumbuhan.",
    get actions() {
      if (!Repo.dapatMenulis()) return purwarupaBsc.actions;
      return `<button class="btn btn-sm" onclick="window.print()">${U.icon("print")} Cetak</button>`;
    },
    render() {
      if (!Repo.dapatMenulis()) return purwarupaBsc.render();
      return `<div id="bscHostLive">${bscLiveHostHTML()}</div>`;
    },
    async mount() {
      if (!Repo.dapatMenulis()) { purwarupaBsc.mount(); return; }
      await bscLiveMuat();
    }
  };

  /* ----------------------------------------------- kelola sasaran & KPI */

  const POLARITAS_BSC = { "naik-baik": "Semakin besar semakin baik", "turun-baik": "Semakin kecil semakin baik" };

  window.bscKelolaPerspektif = function (kode) {
    const p = BSC_LIVE.kartu.perspektif.find((x) => x.kode === kode);

    window.__bscDraft = {
      kode: kode,
      objectives: (p.sasaran || []).map((s) => ({
        nama: s.nama,
        indikator: s.indikator.map((i) => ({
          nama: i.nama, satuan: i.satuan || "", polaritas: i.polaritas.kode,
          target: i.target, bobot: i.bobot, catatan: i.catatan || ""
        }))
      }))
    };
    if (!window.__bscDraft.objectives.length) {
      window.__bscDraft.objectives.push({ nama: "", indikator: [bscIndikatorBaru()] });
    }

    U.drawer({
      size: "xwide", title: "Kelola " + p.nama,
      sub: "Periode " + BSC_LIVE.periode + " · bobot seluruh indikator dalam perspektif ini harus berjumlah 100",
      body: `<div id="bscFormGalat" class="alert err mb-16" hidden></div><div id="bscFormBody">${bscFormHTML()}</div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" id="bscFormSimpan" onclick="bscSimpanPerspektifLive()">Simpan</button>`
    });
  };

  function bscIndikatorBaru() {
    return { nama: "", satuan: "", polaritas: "naik-baik", target: "", bobot: "", catatan: "" };
  }

  function bscFormHTML() {
    const dr = window.__bscDraft;
    const totalBobot = dr.objectives.reduce((a, o) => a + o.indikator.reduce((b, i) => b + (Number(i.bobot) || 0), 0), 0);

    return `${dr.objectives.map((o, oi) => `
        <div class="card mb-12"><div class="card-body tight">
          <div class="row-t gap-8 mb-8">
            <input class="input" placeholder="Nama sasaran strategis *" value="${U.esc(o.nama)}"
              oninput="bscSetSasaran(${oi},'nama',this.value)">
            <button class="icon-btn" title="Hapus sasaran" onclick="bscHapusSasaran(${oi})">${U.icon("x", 14)}</button>
          </div>
          ${o.indikator.map((k, ki) => `
            <div class="row-t gap-6 mb-6" style="padding-left:12px;border-left:2px solid var(--border)">
              <div style="flex:1;min-width:0" class="grid g2 gap-6">
                <input class="input" placeholder="Nama indikator *" value="${U.esc(k.nama)}"
                  oninput="bscSetIndikator(${oi},${ki},'nama',this.value)">
                <input class="input" placeholder="Satuan" value="${U.esc(k.satuan)}"
                  oninput="bscSetIndikator(${oi},${ki},'satuan',this.value)">
                <select class="select" onchange="bscSetIndikator(${oi},${ki},'polaritas',this.value)">
                  ${Object.keys(POLARITAS_BSC).map((p) => `<option value="${p}" ${k.polaritas === p ? "selected" : ""}>${POLARITAS_BSC[p]}</option>`).join("")}
                </select>
                <input type="number" step="0.01" class="input" placeholder="Target *" value="${U.esc(k.target)}"
                  oninput="bscSetIndikator(${oi},${ki},'target',this.value)">
                <input type="number" step="0.01" class="input" placeholder="Bobot % *" value="${U.esc(k.bobot)}"
                  oninput="bscSetIndikator(${oi},${ki},'bobot',this.value)">
              </div>
              <button class="icon-btn" title="Hapus indikator" onclick="bscHapusIndikator(${oi},${ki})">${U.icon("x", 14)}</button>
            </div>`).join("")}
          <button class="btn btn-sm mt-4" onclick="bscTambahIndikator(${oi})">${U.icon("plus", 12)} Tambah Indikator</button>
        </div></div>`).join("")}
      <button class="btn btn-sm mb-12" onclick="bscTambahSasaran()">${U.icon("plus")} Tambah Sasaran Strategis</button>
      <div class="row"><span class="small muted" style="flex:1">Total bobot indikator perspektif ini</span>
        <span class="badge ${totalBobot === 100 ? "green" : "red"}">${totalBobot}%</span></div>`;
  }

  function bscRerender() { document.getElementById("bscFormBody").innerHTML = bscFormHTML(); }

  window.bscSetSasaran = function (oi, k, v) { window.__bscDraft.objectives[oi][k] = v; };
  window.bscSetIndikator = function (oi, ki, k, v) { window.__bscDraft.objectives[oi].indikator[ki][k] = v; };
  window.bscTambahSasaran = function () {
    window.__bscDraft.objectives.push({ nama: "", indikator: [bscIndikatorBaru()] });
    bscRerender();
  };
  window.bscHapusSasaran = function (oi) {
    window.__bscDraft.objectives.splice(oi, 1);
    bscRerender();
  };
  window.bscTambahIndikator = function (oi) {
    window.__bscDraft.objectives[oi].indikator.push(bscIndikatorBaru());
    bscRerender();
  };
  window.bscHapusIndikator = function (oi, ki) {
    if (window.__bscDraft.objectives[oi].indikator.length <= 1) {
      U.toast("Tidak dapat dihapus", "Sasaran harus memiliki minimal satu indikator.", "warn");
      return;
    }
    window.__bscDraft.objectives[oi].indikator.splice(ki, 1);
    bscRerender();
  };

  window.bscSimpanPerspektifLive = async function () {
    const dr = window.__bscDraft;
    const objectives = dr.objectives
      .filter((o) => o.nama.trim() !== "")
      .map((o) => ({
        nama: o.nama.trim(),
        indikator: o.indikator
          .filter((k) => k.nama.trim() !== "")
          .map((k) => ({
            nama: k.nama.trim(), satuan: k.satuan.trim() || null, polaritas: k.polaritas,
            target: Number(k.target), bobot: Number(k.bobot), catatan: k.catatan || null
          }))
      }));

    const kotak = document.getElementById("bscFormGalat");
    const tombol = document.getElementById("bscFormSimpan");
    kotak.hidden = true;
    tombol.disabled = true;
    tombol.textContent = "Menyimpan…";

    try {
      await Repo.bsc.simpanPerspektif({ periode: BSC_LIVE.periode, perspektif: dr.kode, objectives: objectives });
      U.closeDrawer();
      U.toast("Tersimpan", "Sasaran dan indikator perspektif diperbarui.");
      await bscLiveMuat();
    } catch (e) {
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan).map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else {
        kotak.textContent = e.message || "Gagal menyimpan.";
      }
      kotak.hidden = false;
    } finally {
      tombol.disabled = false;
      tombol.textContent = "Simpan";
    }
  };

  /** Mengisi realisasi satu indikator langsung dari tabel KPI. */
  window.bscIsiRealisasiLive = function (indikatorId, nilaiSaatIni) {
    U.modal({
      title: "Isi Realisasi", sub: "Pekerjaan rutin — tidak mengubah target atau bobot",
      body: `<div class="field"><label>Realisasi</label>
        <input type="number" step="0.01" class="input" id="bscRealisasi" value="${nilaiSaatIni === null ? "" : nilaiSaatIni}"></div>
        <div class="field mt-8"><label>Catatan (opsional)</label><input class="input" id="bscCatatanRealisasi"></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-primary" onclick="bscIsiRealisasiLiveGo('${indikatorId}')">Simpan</button>`
    });
  };
  window.bscIsiRealisasiLiveGo = async function (indikatorId) {
    const nilai = document.getElementById("bscRealisasi").value;
    const catatan = document.getElementById("bscCatatanRealisasi").value;
    try {
      await Repo.bsc.isiRealisasi(indikatorId, nilai === "" ? null : Number(nilai), catatan || null);
      U.closeModal();
      U.toast("Realisasi tersimpan", "Skor perspektif dan skor keseluruhan dihitung ulang.");
      await bscLiveMuat();
    } catch (e) {
      Repo.tampilkanGalat(e, "Gagal mengisi realisasi");
    }
  };

})();
