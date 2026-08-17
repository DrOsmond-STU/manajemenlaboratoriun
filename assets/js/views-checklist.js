/* ==========================================================================
   FLMS — Checklist
   Template dibuat & dikelola pengguna, melekat pada ruangan / peralatan,
   dan ditugaskan kepada pengguna tertentu.
   ========================================================================== */
(function () {
  const U = UI, D = DB, V = window.VIEWS;

  const tplOf = (id) => D.checklistTemplates.find((t) => t.id === id) || { name: id, type: "verifikasi", items: [] };
  const typeOf = (k) => D.checklistTypes.find((t) => t.k === k) || D.checklistTypes[0];

  /** Pengguna yang sedang masuk (untuk halaman "Checklist Saya"). */
  function me() {
    const nm = localStorage.getItem("flms.user") || "Rahmat Hidayat";
    return (D.people.find((p) => p.name === nm) || D.people[2]).id;
  }

  const statusTone = { "Selesai": "green", "Temuan": "amber", "Ditolak": "red",
    "Terlambat": "red", "Jatuh Tempo Hari Ini": "amber", "Terjadwal": "brand" };

  /* =======================================================================
     DAFTAR & PENGELOLAAN TEMPLATE
     ======================================================================= */
  V["checklist"] = {
    title: "Checklist Pengecekan & Perawatan",
    sub: "Template checklist dibuat dan dikelola sendiri oleh pengguna, melekat pada ruangan atau peralatan, serta ditugaskan kepada penanggung jawab.",
    actions: `<button class="btn btn-sm" onclick="location.hash='#/mychecklist'">${U.icon("users")} Checklist Saya</button>
      <button class="btn btn-sm" onclick="UI.demo('Ekspor seluruh template checklist')">${U.icon("download")} Ekspor</button>
      <button class="btn btn-primary btn-sm" onclick="ckBuilder(null)">${U.icon("plus")} Buat Checklist</button>`,
    render() {
      const T = D.checklistTemplates;
      const rec = D.checklistRecords;
      const temuan = rec.filter((r) => r.status !== "Selesai").length;
      const rata = Math.round(rec.reduce((a, r) => a + r.score, 0) / rec.length);

      return `
        <div class="grid g5 mb-16">
          ${U.kpi({ label: "Template Checklist", value: T.length, icon: "check", tint: "brand", note: D.checklistTypes.length + " jenis" })}
          ${U.kpi({ label: "Resource Terhubung", value: [...new Set(T.flatMap((t) => t.scope))].length, icon: "building", tint: "teal", note: "Ruangan & peralatan" })}
          ${U.kpi({ label: "Tugas Aktif", value: D.checklistTasks.length, icon: "clock", tint: "amber", note: D.checklistTasks.filter((t) => t.status === "Terlambat").length + " terlambat" })}
          ${U.kpi({ label: "Rata-rata Skor", value: rata, suffix: "%", icon: "chart", tint: "green", delta: 3, note: "30 hari terakhir" })}
          ${U.kpi({ label: "Pelaksanaan Bertemuan", value: temuan, icon: "alert", tint: "red", note: "Perlu tindak lanjut" })}
        </div>

        <div class="grid g6 mb-16" style="gap:12px">
          ${D.checklistTypes.map((t) => {
            const n = T.filter((x) => x.type === t.k).length;
            return `<div class="card res-card" onclick="ckFilterType('${t.k}')"><div class="card-body tight center">
              <div class="kpi-ico tint-${t.tint}" style="margin:0 auto 8px">${U.icon(t.icon, 17)}</div>
              <div class="small bold">${U.esc(t.n)}</div>
              <div class="tiny faint mt-4">${n} template</div></div></div>`;
          }).join("")}
        </div>

        ${U.card("Daftar Template", U.toolbar({
          ph: "Cari nama template…",
          filters: [["Semua Jenis"].concat(D.checklistTypes.map((t) => t.n)),
                    ["Semua Sasaran", "Ruangan", "Peralatan", "Keduanya"],
                    ["Semua Frekuensi"].concat(D.checklistFreq)],
          right: `<button class="btn btn-sm btn-primary" onclick="ckBuilder(null)">${U.icon("plus")} Buat</button>`
        }) + U.table([
          { t: "Nama Checklist", render: (t) => `<div class="row">
              <span class="kpi-ico tint-${typeOf(t.type).tint}" style="width:28px;height:28px;flex:0 0 28px">${U.icon(typeOf(t.type).icon, 13)}</span>
              <div style="min-width:0"><b class="small trunc">${U.esc(t.name)}</b>
                <div class="tiny faint">${t.id} • ${t.items.length} butir • ± ${t.estMin} menit</div></div></div>` },
          { t: "Jenis", render: (t) => `<span class="badge ${typeOf(t.type).tint}">${U.esc(typeOf(t.type).n)}</span>` },
          { t: "Sasaran", render: (t) => `<span class="badge outline">${t.target === "keduanya" ? "Ruangan & Peralatan" : t.target === "ruangan" ? "Ruangan" : "Peralatan"}</span>` },
          { t: "Frekuensi", render: (t) => `<span class="small">${U.esc(t.freq)}</span>` },
          { t: "Melekat pada", render: (t) => `<span class="small">${t.scope.length} resource</span>
              <div class="tiny faint trunc" style="max-width:180px">${t.scope.slice(0, 2).map((s) => U.esc(D.resName(s))).join(", ")}${t.scope.length > 2 ? " +" + (t.scope.length - 2) : ""}</div>` },
          { t: "Penanggung Jawab", render: (t) => `<div class="row gap-4">${t.assignees.slice(0, 3).map((a) =>
              `<span class="avatar sm" title="${U.esc(D.personName(a))}">${U.initials(D.personName(a))}</span>`).join("")}
              ${t.assignees.length > 3 ? `<span class="tiny faint">+${t.assignees.length - 3}</span>` : ""}</div>` },
          { t: "Bila Tidak Sesuai", render: (t) => `<span class="badge ${t.failAction === "blokir" ? "red" : t.failAction === "workorder" ? "amber" : "slate"}">
              ${t.failAction === "blokir" ? "Blokir resource" : t.failAction === "workorder" ? "Buat work order" : "Kirim notifikasi"}</span>` },
          { t: "Status", cls: "center", render: (t) => t.active ? U.badge("Aktif") : `<span class="badge slate">Nonaktif</span>` },
          { t: "", cls: "actions", render: (t) => `
              <button class="icon-btn" title="Sunting" onclick="ckBuilder('${t.id}')">${U.icon("edit", 15)}</button>
              <button class="icon-btn" title="Jalankan" onclick="ckRunTpl('${t.id}')">${U.icon("play", 15)}</button>` }
        ], D.checklistTemplates), { bodyCls: "flush" })}

        <div class="mt-16">${U.card("Riwayat Pelaksanaan", U.table([
          { t: "No.", w: "140px", render: (r) => `<span class="mono small">${r.id}</span>` },
          { t: "Checklist", render: (r) => `<b class="small">${U.esc(tplOf(r.tpl).name)}</b>
              <div class="tiny faint">${U.esc(typeOf(tplOf(r.tpl).type).n)}</div>` },
          { t: "Resource", render: (r) => `<span class="small">${U.esc(D.resName(r.res))}</span>` },
          { t: "Pelaksana", render: (r) => `<div class="row"><span class="avatar sm">${U.initials(D.personName(r.by))}</span>
              <span class="small">${U.esc(D.personName(r.by))}</span></div>` },
          { t: "Waktu", render: (r) => `${U.fdate(r.date, "short")}<div class="tiny faint">${r.time}</div>` },
          { t: "Sesuai / Tidak", cls: "center", render: (r) => `<span class="badge green">${r.ok}</span> <span class="badge ${r.fail ? "red" : "slate"}">${r.fail}</span>` },
          { t: "Skor", cls: "right", render: (r) => `<b>${r.score}%</b>` },
          { t: "Status", render: (r) => `<span class="badge ${statusTone[r.status] || "slate"}">${r.status}</span>` },
          { t: "Catatan", render: (r) => `<span class="tiny muted trunc" style="max-width:200px">${U.esc(r.note || "—")}</span>` }
        ], D.checklistRecords), { bodyCls: "flush" })}</div>`;
    }
  };

  window.ckFilterType = function (k) {
    U.toast("Filter jenis", typeOf(k).n + " — pada purwarupa filter tabel disimulasikan.", "info");
  };

  /* =======================================================================
     PEMBUAT TEMPLATE (BUILDER)
     ======================================================================= */
  let B = null;

  window.ckBuilder = function (id) {
    const src = id ? tplOf(id) : {
      id: "", name: "", type: "verifikasi", target: "ruangan", freq: "Harian",
      estMin: 15, active: true, owner: me(), assignees: [me()], scope: [],
      failAction: "notifikasi", items: [{ t: "", kind: "ok", req: true, hint: "" }]
    };
    B = JSON.parse(JSON.stringify(src));
    U.drawer({
      size: "wide",
      title: id ? "Sunting Checklist" : "Buat Checklist Baru",
      sub: id ? src.id : "Template menjadi milik Anda dan dapat ditugaskan ke pengguna lain",
      body: `<div id="ckB">${builderHTML()}</div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <div class="spacer"></div>
             ${id ? `<button class="btn btn-danger" onclick="ckDelete('${id}')">${U.icon("trash")} Hapus</button>` : ""}
             <button class="btn btn-primary" onclick="ckSave('${id || ""}')">${U.icon("check")} Simpan</button>`
    });
  };

  function builderHTML() {
    const res = D.rooms.concat(D.labs).concat(D.equipment);
    return `
      <div class="grid g2 gap-12 mb-16">
        <div class="field" style="grid-column:1/-1"><label>Nama Checklist <span class="req">*</span></label>
          <input class="input" value="${U.esc(B.name)}" oninput="ckSet('name',this.value)"
            placeholder="Contoh: Pengecekan Harian Laboratorium"></div>

        <div class="field" style="grid-column:1/-1"><label>Jenis Checklist <span class="req">*</span></label>
          <div class="row wrap gap-6">${D.checklistTypes.map((t) =>
            `<span class="chip ${B.type === t.k ? "on" : ""}" onclick="ckSet('type','${t.k}')">${U.icon(t.icon, 12)} ${t.n}</span>`).join("")}</div></div>

        <div class="field"><label>Melekat pada</label>
          <div class="row wrap gap-6">${[["ruangan", "Ruangan"], ["peralatan", "Peralatan"], ["keduanya", "Keduanya"]].map(([k, n]) =>
            `<span class="chip ${B.target === k ? "on" : ""}" onclick="ckSet('target','${k}')">${n}</span>`).join("")}</div></div>

        <div class="field"><label>Frekuensi</label>
          <select class="select" onchange="ckSet('freq',this.value)">
            ${D.checklistFreq.map((f) => `<option ${B.freq === f ? "selected" : ""}>${f}</option>`).join("")}</select></div>

        <div class="field"><label>Estimasi waktu (menit)</label>
          <input type="number" class="input" value="${B.estMin}" onchange="ckSet('estMin',+this.value)"></div>

        <div class="field"><label>Bila ada butir tidak sesuai</label>
          <select class="select" onchange="ckSet('failAction',this.value)">
            <option value="notifikasi" ${B.failAction === "notifikasi" ? "selected" : ""}>Kirim notifikasi ke PIC</option>
            <option value="workorder" ${B.failAction === "workorder" ? "selected" : ""}>Buat work order maintenance</option>
            <option value="blokir" ${B.failAction === "blokir" ? "selected" : ""}>Blokir resource dari pemakaian</option>
          </select></div>
      </div>

      <h4 class="muted mb-8">DITUGASKAN KEPADA (CHECKLIST MELEKAT PADA PENGGUNA)</h4>
      <div class="row wrap gap-6 mb-16">${D.people.map((p) =>
        `<span class="chip ${B.assignees.includes(p.id) ? "on" : ""}" onclick="ckToggle('assignees','${p.id}')">
          ${U.initials(p.name)} · ${U.esc(p.name.split(" ")[0])}</span>`).join("")}</div>

      <h4 class="muted mb-8">RESOURCE YANG DICEK (${B.scope.length} dipilih)</h4>
      <div class="tbl-search mb-8">${U.icon("search", 15, "faint")}
        <input placeholder="Cari ruangan / laboratorium / alat…" oninput="ckResFilter(this.value)"></div>
      <div id="ckRes" style="max-height:190px;overflow-y:auto;border:1px solid var(--border);border-radius:9px" class="mb-16">
        ${res.map((r) => `<label class="row" data-nm="${U.esc(r.name.toLowerCase())}"
            style="padding:6px 10px;border-bottom:1px solid var(--border);cursor:pointer">
            <input type="checkbox" ${B.scope.includes(r.id) ? "checked" : ""} onchange="ckToggle('scope','${r.id}')"
              style="accent-color:var(--brand-600)">
            <span class="small trunc" style="flex:1">${U.esc(r.name)}</span>
            <span class="tiny faint mono">${r.code || r.id}</span></label>`).join("")}
      </div>

      <h4 class="muted mb-8">BUTIR PEMERIKSAAN (${B.items.length})</h4>
      <div class="card mb-12"><div class="card-body tight">
        <div class="tiny faint mb-6" style="display:grid;grid-template-columns:26px 1fr 150px 90px 40px;gap:10px">
          <span>NO</span><span>URAIAN BUTIR</span><span>JENIS ISIAN</span><span>WAJIB</span><span>URUT</span></div>
        <div id="ckItems">${B.items.map(itemRow).join("")}</div>
        <button class="btn btn-sm mt-12" onclick="ckAddItem()">${U.icon("plus", 12)} Tambah Butir</button>
      </div></div>

      <div class="alert info small">${U.icon("bell", 15)}<div>Checklist yang jatuh tempo otomatis dikirim
        melalui email ke penanggung jawab sesuai pengaturan pada <b>Notifikasi Email Jadwal</b>.</div></div>`;
  }

  function itemRow(it, i) {
    return `<div class="ck-item">
      <span class="tiny faint">${i + 1}</span>
      <input class="input" style="padding:5px 9px;font-size:12.5px" value="${U.esc(it.t)}"
        placeholder="Uraian butir pemeriksaan" oninput="ckItem(${i},'t',this.value)">
      <select class="select" style="padding:5px 9px;font-size:12px" onchange="ckItem(${i},'kind',this.value)">
        ${D.checklistItemKinds.map((k) => `<option value="${k.k}" ${it.kind === k.k ? "selected" : ""}>${k.n}</option>`).join("")}</select>
      <label class="check" style="font-size:12px"><input type="checkbox" ${it.req ? "checked" : ""}
        onchange="ckItem(${i},'req',this.checked)"><span>Wajib</span></label>
      <div class="mv">
        <button onclick="ckMove(${i},-1)" ${i === 0 ? "disabled" : ""}>▲</button>
        <button onclick="ckMove(${i},1)" ${i === B.items.length - 1 ? "disabled" : ""}>▼</button>
      </div></div>`;
  }

  function ckRefresh() { document.getElementById("ckB").innerHTML = builderHTML(); }
  function ckItemsRefresh() { document.getElementById("ckItems").innerHTML = B.items.map(itemRow).join(""); }

  window.ckSet = function (k, v) { B[k] = v; ckRefresh(); };
  window.ckToggle = function (field, id) {
    const a = B[field];
    const i = a.indexOf(id);
    if (i < 0) a.push(id); else a.splice(i, 1);
    if (field === "assignees") ckRefresh();
  };
  window.ckResFilter = function (q) {
    const s = (q || "").toLowerCase();
    document.querySelectorAll("#ckRes label").forEach((el) => {
      el.style.display = (el.dataset.nm || "").includes(s) ? "" : "none";
    });
  };
  window.ckItem = function (i, k, v) { B.items[i][k] = v; if (k !== "t") ckItemsRefresh(); };
  window.ckAddItem = function () { B.items.push({ t: "", kind: "ok", req: true, hint: "" }); ckRefresh(); };
  window.ckMove = function (i, d) {
    const j = i + d;
    if (j < 0 || j >= B.items.length) return;
    const t = B.items[i]; B.items[i] = B.items[j]; B.items[j] = t;
    ckItemsRefresh();
  };

  window.ckSave = function (id) {
    if (!B.name || !B.items.filter((x) => x.t).length) {
      U.toast("Belum lengkap", "Nama checklist dan minimal satu butir pemeriksaan wajib diisi.", "warn");
      return;
    }
    B.items = B.items.filter((x) => x.t);
    if (id) {
      const i = D.checklistTemplates.findIndex((t) => t.id === id);
      B.id = id;
      D.checklistTemplates[i] = B;
    } else {
      B.id = "CL-TPL-" + String(D.checklistTemplates.length + 1).padStart(3, "0");
      B.owner = me();
      D.checklistTemplates.push(B);
    }
    U.closeDrawer();
    document.getElementById("viewBody").innerHTML = V["checklist"].render();
    U.toast(id ? "Checklist diperbarui" : "Checklist dibuat",
      `${B.name} — ${B.items.length} butir, ${B.assignees.length} penanggung jawab.`);
  };

  window.ckDelete = function (id) {
    const i = D.checklistTemplates.findIndex((t) => t.id === id);
    if (i >= 0) D.checklistTemplates.splice(i, 1);
    U.closeDrawer();
    document.getElementById("viewBody").innerHTML = V["checklist"].render();
    U.toast("Checklist dihapus", "", "warn");
  };

  /* =======================================================================
     CHECKLIST SAYA
     ======================================================================= */
  V["mychecklist"] = {
    title: "Checklist Saya",
    sub: "Tugas pemeriksaan yang melekat pada Anda beserta riwayat pelaksanaannya.",
    actions: `<button class="btn btn-sm" onclick="location.hash='#/checklist'">${U.icon("list")} Kelola Template</button>
      <button class="btn btn-sm" onclick="UI.demo('Sinkronkan ke kalender pribadi')">${U.icon("calendar")} Ke Kalender</button>`,
    render() {
      const uid = me();
      const mine = D.checklistTasks.filter((t) => t.assignee === uid);
      const others = D.checklistTasks.filter((t) => t.assignee !== uid);
      const hist = D.checklistRecords.filter((r) => r.by === uid);
      const tplMine = D.checklistTemplates.filter((t) => t.assignees.includes(uid) || t.owner === uid);

      const card = (t) => {
        const tpl = tplOf(t.tpl), ty = typeOf(tpl.type);
        const late = t.status === "Terlambat";
        return `<div class="card" style="border-left:3px solid ${late ? "var(--red-500)" : t.status === "Jatuh Tempo Hari Ini" ? "var(--amber-500)" : "var(--brand-500)"}">
          <div class="card-body">
            <div class="row mb-8">
              <span class="badge ${ty.tint}">${U.icon(ty.icon, 11)} ${U.esc(ty.n)}</span>
              <span class="badge ${statusTone[t.status] || "slate"}">${t.status}</span>
              <div class="spacer"></div><span class="tiny faint mono">${t.id}</span></div>
            <div class="bold mb-4">${U.esc(tpl.name)}</div>
            <div class="small muted">${U.esc(D.resName(t.res))}</div>
            <div class="row mt-12 small gap-16 wrap">
              <span>${U.icon("calendar", 13)} ${U.fdate(t.due, "short")} ${t.time}</span>
              <span>${U.icon("clock", 13)} ± ${tpl.estMin} menit</span>
              <span>${U.icon("list", 13)} ${tpl.items.length} butir</span></div>
            <div class="row mt-12 gap-6">
              <button class="btn btn-sm btn-primary" onclick="ckRun('${t.id}')">${U.icon("play", 12)} Kerjakan</button>
              <button class="btn btn-sm" onclick="ckBuilder('${t.tpl}')">Lihat Template</button>
              <div class="spacer"></div>
              <button class="btn btn-sm btn-ghost" onclick="UI.demo('Delegasikan tugas ke rekan')">Delegasikan</button></div>
          </div></div>`;
      };

      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Tugas Saya", value: mine.length, icon: "check", tint: "brand", note: "Melekat pada akun Anda" })}
          ${U.kpi({ label: "Terlambat", value: mine.filter((t) => t.status === "Terlambat").length, icon: "alert", tint: "red", note: "Segera dikerjakan" })}
          ${U.kpi({ label: "Template Diampu", value: tplMine.length, icon: "list", tint: "teal", note: "Sebagai pemilik / pelaksana" })}
          ${U.kpi({ label: "Riwayat Saya", value: hist.length, icon: "doc", tint: "violet", note: "Pelaksanaan tercatat" })}
        </div>

        <h3 class="mb-12">Tugas Anda</h3>
        <div class="grid g3 mb-24">${mine.length ? mine.map(card).join("")
          : U.emptyState("Tidak ada tugas checklist", "Seluruh pemeriksaan yang melekat pada Anda sudah selesai.")}</div>

        <div class="grid g2 gap-16">
          ${U.card("Riwayat Pelaksanaan Saya", hist.length ? U.table([
            { t: "Checklist", render: (r) => `<b class="small">${U.esc(tplOf(r.tpl).name)}</b>
                <div class="tiny faint">${U.esc(D.resName(r.res))}</div>` },
            { t: "Waktu", render: (r) => `${U.fdate(r.date, "short")}<div class="tiny faint">${r.time}</div>` },
            { t: "Skor", cls: "right", render: (r) => `<b>${r.score}%</b>` },
            { t: "Status", render: (r) => `<span class="badge ${statusTone[r.status] || "slate"}">${r.status}</span>` }
          ], hist) : U.emptyState("Belum ada riwayat", ""), { bodyCls: "flush" })}

          ${U.card("Tugas Rekan Satu Tim", U.table([
            { t: "Pelaksana", render: (t) => `<div class="row"><span class="avatar sm">${U.initials(D.personName(t.assignee))}</span>
                <span class="small">${U.esc(D.personName(t.assignee))}</span></div>` },
            { t: "Checklist", render: (t) => `<span class="small">${U.esc(tplOf(t.tpl).name)}</span>` },
            { t: "Jatuh Tempo", render: (t) => U.fdate(t.due, "short") },
            { t: "Status", render: (t) => `<span class="badge ${statusTone[t.status] || "slate"}">${t.status}</span>` }
          ], others), { bodyCls: "flush" })}
        </div>`;
    }
  };

  /* =======================================================================
     PELAKSANAAN CHECKLIST
     ======================================================================= */
  let RUN = null;

  window.ckRun = function (taskId) {
    const t = D.checklistTasks.find((x) => x.id === taskId);
    if (!t) return;
    startRun(tplOf(t.tpl), t.res, taskId);
  };
  window.ckRunTpl = function (tplId) {
    const tpl = tplOf(tplId);
    startRun(tpl, tpl.scope[0] || "LAB-001", null);
  };

  function startRun(tpl, res, taskId) {
    RUN = { tpl, res, taskId, vals: tpl.items.map(() => ({ v: null, note: "" })), signed: false };
    U.drawer({
      size: "wide", title: tpl.name,
      sub: U.esc(typeOf(tpl.type).n) + " · " + U.esc(D.resName(res)),
      body: `<div id="ckRun">${runHTML()}</div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <button class="btn" onclick="UI.demo('Disimpan sebagai draf')">Simpan Draf</button>
             <div class="spacer"></div>
             <button class="btn btn-primary" onclick="ckFinish()">${U.icon("check")} Selesaikan</button>`
    });
  }

  function runHTML() {
    const { tpl, vals } = RUN;
    const done = vals.filter((v) => v.v !== null && v.v !== "").length;
    const bad = vals.filter((v) => v.v === "bad").length;
    const pct = Math.round((done / tpl.items.length) * 100);

    return `
      <div class="card mb-16"><div class="card-body tight">
        <div class="row mb-8"><span class="small bold" style="flex:1">Kemajuan pengisian</span>
          <b class="small">${done}/${tpl.items.length}</b></div>
        <div class="bar"><i style="width:${pct}%;background:${pct === 100 ? "var(--green-500)" : "var(--brand-500)"}"></i></div>
        <div class="row mt-10 small gap-16 wrap">
          <span>${U.icon("pin", 13)} ${U.esc(D.resName(RUN.res))}</span>
          <span>${U.icon("users", 13)} ${U.esc(D.personName(me()))}</span>
          <span>${U.icon("clock", 13)} ± ${tpl.estMin} menit</span>
          ${bad ? `<span class="badge red">${bad} butir tidak sesuai</span>` : ""}
        </div>
      </div></div>

      ${bad && tpl.failAction !== "notifikasi" ? `<div class="alert warn mb-16">${U.icon("alert", 16)}<div>
        <b>${tpl.failAction === "blokir" ? "Resource akan diblokir" : "Work order akan dibuat otomatis"}</b>
        Terdapat butir yang tidak sesuai; sistem akan menjalankan tindak lanjut saat checklist diselesaikan
        dan mengirim email ke penanggung jawab.</div></div>` : ""}

      ${tpl.items.map((it, i) => runItem(it, i)).join("")}`;
  }

  function runItem(it, i) {
    const v = RUN.vals[i];
    let input = "";
    if (it.kind === "ok") {
      input = `<div class="ck-opt">
        <button class="${v.v === "ok" ? "on-ok" : ""}" onclick="ckVal(${i},'ok')">✓ Sesuai</button>
        <button class="${v.v === "bad" ? "on-bad" : ""}" onclick="ckVal(${i},'bad')">✕ Tidak Sesuai</button>
        <button class="${v.v === "na" ? "on-na" : ""}" onclick="ckVal(${i},'na')">— N/A</button></div>`;
    } else if (it.kind === "rating") {
      input = `<div class="ck-stars">${[1, 2, 3, 4, 5].map((s) =>
        `<button class="${v.v >= s ? "on" : ""}" onclick="ckVal(${i},${s})">★</button>`).join("")}
        <span class="small muted" style="margin-left:6px">${v.v ? v.v + " / 5" : "belum dinilai"}</span></div>`;
    } else if (it.kind === "angka") {
      input = `<input type="number" step="0.01" class="input" style="max-width:180px" value="${v.v == null ? "" : v.v}"
        placeholder="Masukkan nilai" oninput="ckVal(${i}, this.value===''?null:+this.value, true)">`;
    } else if (it.kind === "teks") {
      input = `<textarea class="textarea" style="min-height:56px" placeholder="Catatan…"
        oninput="ckVal(${i}, this.value, true)">${U.esc(v.v || "")}</textarea>`;
    } else if (it.kind === "foto") {
      input = v.v
        ? `<div class="row gap-8"><img src="${v.v}" style="width:96px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
             <button class="btn btn-sm" onclick="ckVal(${i},null)">Hapus</button></div>`
        : `<button class="btn btn-sm" onclick="ckFoto(${i})">${U.icon("upload", 12)} Ambil / Unggah Foto</button>
           <input type="file" accept="image/*" class="hide" id="ckF${i}" onchange="ckFotoAdd(${i},this.files)">`;
    } else if (it.kind === "ttd") {
      input = `<div class="ck-sign ${v.v ? "signed" : ""}" onclick="ckVal(${i}, '${U.esc(D.personName(me()))}')">
        ${v.v ? U.esc(v.v) : "Ketuk untuk menandatangani"}</div>`;
    }

    return `<div class="ck-run-item">
      <div class="row-t mb-8">
        <span class="tiny faint" style="width:20px;padding-top:2px">${i + 1}</span>
        <div style="flex:1;min-width:0">
          <div class="small bold">${U.esc(it.t)} ${it.req ? `<span class="req" style="color:var(--red-500)">*</span>` : ""}</div>
          ${it.hint ? `<div class="tiny faint">${U.esc(it.hint)}</div>` : ""}</div>
        ${v.v !== null && v.v !== "" ? `<span class="badge ${v.v === "bad" ? "red" : "green"}">terisi</span>` : `<span class="badge outline">kosong</span>`}
      </div>
      <div style="padding-left:20px">${input}
        ${v.v === "bad" ? `<input class="input mt-8" placeholder="Uraikan temuan (wajib)…" value="${U.esc(v.note)}"
          oninput="ckNote(${i},this.value)">` : ""}</div>
    </div>`;
  }

  function runRefresh() { document.getElementById("ckRun").innerHTML = runHTML(); }

  window.ckVal = function (i, v, keepFocus) {
    RUN.vals[i].v = v;
    if (keepFocus) {
      // jangan render ulang saat mengetik agar fokus tidak hilang
      return;
    }
    runRefresh();
  };
  window.ckNote = function (i, v) { RUN.vals[i].note = v; };
  window.ckFoto = function (i) { document.getElementById("ckF" + i).click(); };
  window.ckFotoAdd = function (i, files) {
    const f = files && files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { RUN.vals[i].v = r.result; runRefresh(); };
    r.readAsDataURL(f);
  };

  window.ckFinish = function () {
    if (!RUN) { U.toast("Tidak ada checklist berjalan", "Buka sebuah tugas terlebih dahulu.", "warn"); return; }
    const { tpl, vals } = RUN;
    const miss = tpl.items.map((it, i) => ({ it, i })).filter(({ it, i }) =>
      it.req && (vals[i].v === null || vals[i].v === ""));
    if (miss.length) {
      U.toast("Masih ada butir wajib kosong", `${miss.length} butir belum diisi (nomor ${miss.map((m) => m.i + 1).join(", ")}).`, "warn");
      return;
    }
    const bad = vals.filter((v) => v.v === "bad").length;
    const ok = vals.length - bad;
    const score = Math.round((ok / vals.length) * 100);
    const status = bad === 0 ? "Selesai" : (tpl.failAction === "blokir" ? "Ditolak" : "Temuan");

    const rec = {
      id: "CLR-2026-" + String(1209 + D.checklistRecords.length).padStart(5, "0"),
      tpl: tpl.id, res: RUN.res, by: me(), date: D.shift(0),
      time: new Date().toTimeString().slice(0, 5), status, score, ok, fail: bad,
      note: vals.filter((v) => v.v === "bad").map((v) => v.note).filter(Boolean).join("; ")
    };
    D.checklistRecords.unshift(rec);
    if (RUN.taskId) {
      const ti = D.checklistTasks.findIndex((t) => t.id === RUN.taskId);
      if (ti >= 0) D.checklistTasks.splice(ti, 1);
    }

    const followUp = bad === 0 ? [] : [
      tpl.failAction === "workorder" ? "Work order maintenance dibuat otomatis" :
      tpl.failAction === "blokir" ? "Resource diblokir dari pemakaian sampai perbaikan selesai" :
      "Notifikasi dikirim ke penanggung jawab resource",
      "Email temuan dikirim ke PIC resource dan Facility Manager"
    ];

    U.closeDrawer();
    U.modal({
      title: bad === 0 ? "Checklist selesai" : "Checklist selesai dengan temuan",
      sub: rec.id + " · " + tpl.name,
      body: `<div class="center mb-16">
          <div class="tint-${bad === 0 ? "green" : "amber"}" style="width:58px;height:58px;border-radius:50%;display:grid;place-items:center;margin:0 auto 14px">
            ${U.icon(bad === 0 ? "check" : "alert", 28)}</div>
          <h2>${score}%</h2>
          <div class="small muted">${ok} butir sesuai · ${bad} butir tidak sesuai</div></div>
        <div class="dl small mb-16" style="grid-template-columns:120px 1fr">
          <dt>Resource</dt><dd>${U.esc(D.resName(RUN.res))}</dd>
          <dt>Pelaksana</dt><dd>${U.esc(D.personName(me()))}</dd>
          <dt>Waktu</dt><dd>${U.fdate(rec.date, "long")} ${rec.time}</dd>
          <dt>Status</dt><dd><span class="badge ${statusTone[status]}">${status}</span></dd>
        </div>
        ${followUp.length ? `<h4 class="muted mb-8">TINDAK LANJUT OTOMATIS</h4>
          <div class="col gap-6">${followUp.map((f) => `<div class="row small">${U.icon("check", 14, "faint")}<span>${f}</span></div>`).join("")}</div>` : ""}`,
      foot: `<button class="btn" onclick="UI.closeModal();location.hash='#/checklist'">Lihat Riwayat</button>
             <button class="btn btn-primary" onclick="UI.closeModal();location.hash='#/mychecklist'">Kembali ke Tugas Saya</button>`
    });
  };

  /* =======================================================================
     CHECKLIST YANG MELEKAT PADA SEBUAH RESOURCE
     dipanggil dari drawer detail ruangan / laboratorium / alat
     ======================================================================= */
  window.ckForResource = function (resId) {
    const tpls = D.checklistTemplates.filter((t) => t.scope.includes(resId));
    const recs = D.checklistRecords.filter((r) => r.res === resId);
    if (!tpls.length && !recs.length) return "";
    return `<h4 class="mb-8 muted">CHECKLIST YANG MELEKAT (${tpls.length})</h4>
      ${tpls.length ? `<div class="col gap-8 mb-12">${tpls.map((t) => {
        const ty = typeOf(t.type);
        return `<div class="row-t" style="padding:9px 11px;border:1px solid var(--border);border-radius:9px">
          <span class="kpi-ico tint-${ty.tint}" style="width:28px;height:28px;flex:0 0 28px">${U.icon(ty.icon, 13)}</span>
          <div style="flex:1;min-width:0"><div class="small bold trunc">${U.esc(t.name)}</div>
            <div class="tiny faint">${U.esc(ty.n)} · ${U.esc(t.freq)} · ${t.items.length} butir</div></div>
          <button class="btn btn-sm" onclick="UI.closeDrawer();ckRunTpl('${t.id}')">Kerjakan</button></div>`;
      }).join("")}</div>` : `<div class="small muted mb-12">Belum ada checklist yang melekat pada resource ini.</div>`}
      ${recs.length ? U.table([
        { t: "Tanggal", render: (r) => U.fdate(r.date, "short") + " " + r.time },
        { t: "Checklist", render: (r) => `<span class="small">${U.esc(tplOf(r.tpl).name)}</span>` },
        { t: "Pelaksana", render: (r) => `<span class="small">${U.esc(D.personName(r.by))}</span>` },
        { t: "Skor", cls: "right", render: (r) => `<b>${r.score}%</b>` },
        { t: "Status", render: (r) => `<span class="badge ${statusTone[r.status] || "slate"}">${r.status}</span>` }
      ], recs.slice(0, 5)) : ""}`;
  };

})();
