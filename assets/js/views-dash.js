/* ==========================================================================
   FLMS — Views dashboard berbasis widget
   Dashboard Operasional, Dashboard Manajemen, Dashboard Analitik kustom,
   dan Balanced Scorecard. Seluruhnya memakai mesin widget pada dash.js.
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

  /** Bilah bantuan yang muncul saat mode sunting aktif. */
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

  /* =======================================================================
     DASHBOARD OPERASIONAL & MANAJEMEN
     ======================================================================= */
  V["dashboard"] = page("ops", "Dashboard Operasional",
    "Ringkasan fasilitas, laboratorium, alat, dan transaksi hari ini. Seluruh komponen dapat disunting.",
    `<button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Booking Baru</button>`);

  V["exec"] = page("mgmt", "Dashboard Manajemen",
    "KPI strategis: utilisasi, pendapatan, biaya, dan nilai aset. Susunan dapat diatur sesuai kebutuhan rapat.",
    `<div class="seg"><button>Bulan Ini</button><button class="active">YTD 2026</button><button>12 Bulan</button></div>`);

  /* =======================================================================
     BALANCED SCORECARD
     ======================================================================= */
  V["bsc"] = {
    title: "Balanced Scorecard",
    sub: "Empat perspektif Kaplan & Norton: Finansial, Pelanggan, Proses Bisnis Internal, serta Pembelajaran & Pertumbuhan.",
    actions: `<div class="seg"><button class="active">Semester I 2026</button><button onclick="UI.demo('Periode sebelumnya')">Semester II 2025</button></div>
      <button class="btn btn-sm" onclick="bscManage()">${U.icon("gear")} Kelola Sasaran & KPI</button>
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

  window.bscManage = function () {
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
     DASHBOARD ANALITIK — dapat dibuat dan dikelola sendiri
     ======================================================================= */
  const SELKEY = "flms.dashSel";
  const selId = () => localStorage.getItem(SELKEY) || "analitik";

  V["analytics"] = {
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
    document.getElementById("viewBody").innerHTML = V["analytics"].render();
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
    document.getElementById("viewBody").innerHTML = V["analytics"].render();
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
    document.getElementById("viewBody").innerHTML = V["analytics"].render();
    syncBar();
  };
  window.dashDup = function () {
    const id = W.dupDash(selId());
    localStorage.setItem(SELKEY, id);
    document.getElementById("viewBody").innerHTML = V["analytics"].render();
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
    document.getElementById("viewBody").innerHTML = V["analytics"].render();
    syncBar();
    U.toast("Dashboard dihapus", "", "warn");
  };

})();
