/* ==========================================================================
   FLMS — Views: Laboratorium, Alat, Kalibrasi, Maintenance, Ruangan, Auditorium
   ========================================================================== */
(function () {
  const U = UI, D = DB, V = window.VIEWS;

  /* =======================================================================
     LABORATORIUM
     ======================================================================= */
  V["lab"] = {
    title: "Manajemen Laboratorium",
    sub: "Profil, kapasitas, penanggung jawab, alat, dan status seluruh laboratorium.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Ekspor daftar laboratorium')">${U.icon("download")} Ekspor</button>
              <button class="btn btn-primary btn-sm" onclick="UI.demo('Form tambah laboratorium')">${U.icon("plus")} Tambah Laboratorium</button>`,
    render() {
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Total Laboratorium", value: D.labs.length, icon: "flask", tint: "teal", note: D.labs.filter((l) => l.status === "Aktif").length + " aktif, 1 renovasi" })}
          ${U.kpi({ label: "Total Kapasitas", value: D.labs.reduce((a, l) => a + l.cap, 0), suffix: "orang", icon: "users", tint: "brand", note: "Seluruh laboratorium" })}
          ${U.kpi({ label: "Utilisasi Rata-rata", value: Math.round(D.labs.reduce((a, l) => a + l.util, 0) / D.labs.length), suffix: "%", icon: "chart", tint: "violet", delta: 7, note: "30 hari terakhir" })}
          ${U.kpi({ label: "Terakreditasi", value: D.labs.filter((l) => l.accred !== "—").length, suffix: "lab", icon: "shield", tint: "green", note: "ISO 17025 / KAN" })}
        </div>
        <div class="grid g3">
          ${D.labs.map((l) => `
            <div class="card res-card" onclick="showLab('${l.id}')">
              <div class="card-body">
                <div class="row mb-12">
                  <div class="kpi-ico tint-teal">${U.icon("flask", 17)}</div>
                  <div style="flex:1;min-width:0"><div class="rc-title trunc">${U.esc(l.name)}</div>
                    <div class="rc-meta">${l.code} • ${l.type}</div></div>
                  ${U.badge(l.status)}
                </div>
                <div class="grid g3 mb-12" style="gap:8px">
                  <div><div class="tiny faint">Kapasitas</div><b>${l.cap} org</b></div>
                  <div><div class="tiny faint">Luas</div><b>${l.area} m²</b></div>
                  <div><div class="tiny faint">Alat</div><b>${l.equip} unit</b></div>
                </div>
                <div class="mb-8">${U.meter(`<span class="small">Utilisasi</span>`, l.util, l.util > 75 ? "var(--amber-500)" : "var(--teal-500)")}</div>
                <div class="row small muted mt-12" style="padding-top:10px;border-top:1px solid var(--border)">
                  <span class="avatar sm">${U.initials(D.personName(l.pic))}</span>
                  <div style="flex:1;min-width:0"><div class="trunc" style="font-size:12px">${U.esc(D.personName(l.pic))}</div>
                  <div class="tiny faint">PIC Laboratorium</div></div>
                  <span class="badge outline tiny">${l.hours}</span>
                </div>
              </div>
            </div>`).join("")}
        </div>`;
    }
  };

  window.showLab = function (id) {
    const l = D.byId(D.labs, id);
    const eqs = D.equipment.filter((e) => e.lab === id);
    U.drawer({
      size: "wide", title: l.name, sub: l.code + " • " + l.type + " • " + U.esc(l.accred),
      body: `
        <div class="thumb mb-16" style="aspect-ratio:21/9">${U.layoutDiagram("Cluster", 220, 100)}</div>
        <div class="grid g4 mb-16" style="gap:10px">
          ${[["Kapasitas", l.cap + " org"], ["Luas", l.area + " m²"], ["Alat", l.equip + " unit"], ["Aset", l.assets + " item"]]
            .map(([k, v]) => `<div class="card"><div class="card-body tight center"><div class="tiny faint">${k}</div><b>${v}</b></div></div>`).join("")}
        </div>
        <div class="tabs mb-16">
          <button class="active">Profil</button><button onclick="UI.demo('Tab jadwal')">Jadwal</button>
          <button onclick="UI.demo('Tab alat')">Alat</button><button onclick="UI.demo('Tab dokumen')">Dokumen</button>
        </div>
        <div class="dl mb-16">
          <dt>Lokasi</dt><dd>${U.esc((D.org.buildings.find((b) => b.code === l.building) || {}).name)} — Lantai ${l.floor}</dd>
          <dt>Jam Operasional</dt><dd>${l.hours} WIB</dd>
          <dt>Status</dt><dd>${U.badge(l.status)}</dd>
          <dt>Akreditasi</dt><dd>${U.esc(l.accred)}</dd>
          <dt>PIC / Kepala Lab</dt><dd>${U.esc(D.personName(l.pic))}</dd>
          <dt>Supervisor</dt><dd>${U.esc(D.personName(l.supervisor))}</dd>
          <dt>Teknisi</dt><dd>${l.tech.length ? l.tech.map((t) => U.esc(D.personName(t))).join(", ") : "—"}</dd>
          <dt>Utilisasi 30 Hari</dt><dd><b>${l.util}%</b></dd>
        </div>
        <h4 class="mb-8 muted">FASILITAS &amp; SAFETY EQUIPMENT</h4>
        <div class="row wrap gap-6 mb-16">${l.facs.map((f) => `<span class="fac">${U.esc(f)}</span>`).join("")}</div>
        <h4 class="mb-8 muted">ALAT DI LABORATORIUM INI (${eqs.length})</h4>
        ${U.table([{ t: "Alat", render: (e) => `<b>${U.esc(e.name)}</b><div class="tiny faint">${e.code} • ${e.brand}</div>` },
                   { t: "Status", render: (e) => U.badge(e.status) },
                   { t: "Kalibrasi", cls: "right", render: (e) => { const od = e.calDue < D.shift(0); return `<span class="badge ${od ? "red" : "green"}">${U.fdate(e.calDue, "short")}</span>`; } }], eqs)}
        <div class="row gap-16 mt-16" style="padding-top:16px;border-top:1px solid var(--border)">
          ${U.qrBox(l.code)}
          <div class="small muted">Scan QR di pintu laboratorium untuk melihat status, PIC, jadwal penggunaan, dan riwayat maintenance.</div>
        </div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <button class="btn" onclick="UI.demo('Form edit laboratorium')">${U.icon("edit")} Edit</button>
             <div class="spacer"></div>
             <button class="btn btn-primary" onclick="UI.closeDrawer();location.hash='#/booking/new'">Booking Lab</button>`
    });
  };

  V["labschedule"] = {
    title: "Jadwal Laboratorium",
    sub: "Rencana penggunaan laboratorium, praktikum, pengujian, dan audit.",
    actions: `<button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Jadwalkan</button>`,
    render() {
      return U.card("Agenda Laboratorium", U.toolbar({ ph: "Cari agenda…", filters: [["Semua Lab"].concat(D.labs.map((l) => l.name))] }) +
        U.table([
          { t: "Kode", w: "110px", render: (a) => `<span class="mono small">${a.id}</span>` },
          { t: "Agenda", render: (a) => `<b>${U.esc(a.title)}</b><div class="tiny faint">${U.esc(a.type)}</div>` },
          { t: "Resource", render: (a) => U.esc(D.resName(a.res)) },
          { t: "Tanggal", render: (a) => U.fdate(a.date, "short") },
          { t: "Waktu", render: (a) => a.time },
          { t: "Penanggung Jawab", render: (a) => U.esc(D.personName(a.owner)) },
          { t: "Pengulangan", render: (a) => a.recurring === "-" ? `<span class="faint">Sekali</span>` : `<span class="badge brand">${U.esc(a.recurring)}</span>` }
        ], D.agendas), { bodyCls: "flush" });
    }
  };

  /* =======================================================================
     ALAT LABORATORIUM
     ======================================================================= */
  V["equipment"] = {
    title: "Manajemen Alat Laboratorium",
    sub: "Registrasi, status, kondisi, kalibrasi, dan riwayat penggunaan seluruh alat.",
    actions: `<button class="btn btn-sm" onclick="location.hash='#/barcode'">${U.icon("qr")} Cetak Label</button>
              <button class="btn btn-sm" onclick="UI.demo('Ekspor ke Excel')">${U.icon("download")} Ekspor</button>
              <button class="btn btn-primary btn-sm" onclick="location.hash='#/equipment/new'">${U.icon("plus")} Registrasi Alat (BMN)</button>`,
    render() {
      const totalVal = D.equipment.reduce((a, e) => a + e.price, 0);
      return `
        <div class="grid g5 mb-16">
          ${U.kpi({ label: "Total Alat", value: D.equipment.length, icon: "grid", tint: "violet", note: "6 laboratorium" })}
          ${U.kpi({ label: "Nilai Investasi", value: U.rpShort(totalVal), icon: "money", tint: "brand", note: "Harga perolehan" })}
          ${U.kpi({ label: "Tersedia", value: D.equipment.filter((e) => e.status === "Available").length, icon: "check", tint: "green", note: "Siap direservasi" })}
          ${U.kpi({ label: "Non-Operasional", value: D.equipment.filter((e) => ["Maintenance", "Broken", "Calibration"].includes(e.status)).length, icon: "wrench", tint: "amber", note: "Maintenance / kalibrasi" })}
          ${U.kpi({ label: "Kalibrasi Overdue", value: D.equipment.filter((e) => e.calDue < D.shift(0)).length, icon: "alert", tint: "red", note: "Diblokir otomatis" })}
        </div>
        ${U.card("", U.toolbar({
          ph: "Cari nama, kode, merk, atau serial number…",
          filters: [["Semua Lab"].concat(D.labs.map((l) => l.name)), ["Semua Kategori"].concat([...new Set(D.equipment.map((e) => e.cat))]), ["Semua Status", "Available", "In Use", "Borrowed", "Maintenance", "Calibration", "Broken"]],
          right: `<div class="seg"><button class="active">${U.icon("list", 13)}</button><button onclick="UI.demo('Tampilan kartu')">${U.icon("grid", 13)}</button></div>`
        }) + U.table([
          { t: "Kode BMN / Internal", w: "215px", render: (e) => `<span class="lnk mono" style="font-size:11px" onclick="showBmnDetail('${e.id}')">${e.bmnId}</span>
              <div class="tiny faint mono">${U.esc(e.kodeInternal)}</div>` },
          { t: "Nama Alat", render: (e) => `<b>${U.esc(e.name)}</b><div class="tiny faint">${U.esc(e.brand)} ${U.esc(e.model)} • SN ${U.esc(e.sn)}</div>` },
          { t: "Kategori", render: (e) => `<span class="badge outline">${U.esc(e.cat)}</span>` },
          { t: "Laboratorium", render: (e) => `<span class="small">${U.esc(D.resName(e.lab))}</span>` },
          { t: "PIC", render: (e) => `<span class="small">${U.esc(D.personName(e.pic))}</span>` },
          { t: "Kondisi", render: (e) => U.badge(e.cond) },
          { t: "Status", render: (e) => U.badge(e.status) },
          { t: "Kalibrasi", cls: "right", render: (e) => {
              const od = e.calDue < D.shift(0);
              const soon = !od && e.calDue < D.shift(30);
              return `<span class="badge ${od ? "red" : soon ? "amber" : "green"}">${U.fdate(e.calDue, "short")}</span>`; } },
          { t: "", cls: "actions", render: (e) => `<button class="icon-btn" onclick="showEq('${e.id}')">${U.icon("eye", 15)}</button>` }
        ], D.equipment) + U.pager(D.equipment.length, 1, 18), { bodyCls: "flush" })}`;
    }
  };

  window.showEq = function (id) {
    const e = D.byId(D.equipment, id);
    const cal = D.calibration.filter((c) => c.eq === id);
    const mt = D.maintenance.filter((m) => m.target === id);
    const use = D.eqBookings.filter((b) => b.eq === id);
    const overdue = e.calDue < D.shift(0);
    U.drawer({
      size: "wide", title: e.name, sub: e.code + " • " + e.brand + " " + e.model,
      body: `
        ${overdue ? `<div class="alert err mb-16">${U.icon("alert", 17)}<div><b>Kalibrasi melewati jatuh tempo</b>
          Alat otomatis diblokir dari reservasi sampai kalibrasi ulang selesai dan sertifikat diunggah.</div></div>` : ""}
        <div class="row gap-16 mb-16">
          <div class="thumb" style="width:180px;flex:0 0 180px;aspect-ratio:4/3">
            <div class="lbl">${U.esc(e.cat)}</div></div>
          <div style="flex:1">
            <div class="row wrap gap-6 mb-12">${U.badge(e.status)}${U.badge(e.cond)}
              <span class="badge outline">Tahun ${e.year}</span>
              ${e.needsOperator ? `<span class="badge violet">Butuh Operator</span>` : ""}</div>
            <div class="dl small" style="grid-template-columns:120px 1fr">
              <dt>Serial Number</dt><dd class="mono">${U.esc(e.sn)}</dd>
              <dt>Laboratorium</dt><dd>${U.esc(D.resName(e.lab))}</dd>
              <dt>PIC</dt><dd>${U.esc(D.personName(e.pic))}</dd>
              <dt>Nilai Perolehan</dt><dd>${U.rp(e.price)}</dd>
              <dt>Jatuh Tempo Kal.</dt><dd><span class="badge ${overdue ? "red" : "green"}">${U.fdate(e.calDue, "long")}</span></dd>
            </div>
          </div>
          <div class="center">${Barcode.qr(e.kodeInternal, { size: 96 }) || ""}
            <div class="tiny faint mt-4">QR kode internal</div></div>
        </div>

        <div class="grid g2 mb-16" style="gap:10px">
          <div class="card" style="border-color:var(--brand-300)"><div class="card-body tight">
            <div class="tiny faint">PENOMORAN 1 — BMN (KUNCI UTAMA)</div>
            <div class="mono bold" style="font-size:11.5px;word-break:break-all">${e.bmnId}</div></div></div>
          <div class="card"><div class="card-body tight">
            <div class="tiny faint">PENOMORAN 2 — INTERNAL</div>
            <div class="mono bold" style="font-size:11.5px">${U.esc(e.kodeInternal)}</div></div></div>
        </div>

        <div class="grid g2 mb-16">
          ${U.card("Riwayat Kalibrasi", cal.length ? U.table(
            [{ t: "Tanggal", render: (c) => U.fdate(c.last, "short") },
             { t: "Lab Kalibrasi", render: (c) => `<span class="small">${U.esc(c.lab)}</span>` },
             { t: "Hasil", render: (c) => U.badge(c.result) },
             { t: "Sertifikat", cls: "right", render: (c) => `<span class="lnk small" onclick="UI.demo('Buka sertifikat PDF')">${U.esc(c.cert)}</span>` }], cal)
            : U.emptyState("Belum ada riwayat", ""), { bodyCls: "flush" })}
          ${U.card("Riwayat Maintenance", mt.length ? U.table(
            [{ t: "Tanggal", render: (m) => U.fdate(m.sched, "short") },
             { t: "Jenis", render: (m) => `<span class="badge outline">${m.kind}</span>` },
             { t: "Biaya", cls: "right", render: (m) => U.rp(m.cost) },
             { t: "Status", render: (m) => U.badge(m.status) }], mt)
            : U.emptyState("Belum ada riwayat", ""), { bodyCls: "flush" })}
        </div>

        ${U.card("Riwayat Penggunaan", use.length ? U.table(
          [{ t: "ID", render: (b) => `<span class="mono small">${b.id}</span>` },
           { t: "Pemohon", render: (b) => U.esc(D.personName(b.requester)) },
           { t: "Tanggal", render: (b) => U.fdate(b.date, "short") + " " + b.start + "–" + b.end },
           { t: "Tujuan", render: (b) => `<span class="small">${U.esc(b.purpose)}</span>` },
           { t: "Status", render: (b) => U.badge(b.status) }], use)
          : U.emptyState("Belum ada penggunaan tercatat", ""), { bodyCls: "flush" })}`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <button class="btn" onclick="UI.closeDrawer();showBmnDetail('${e.id}')">${U.icon("box")} Data BMN</button>
             <button class="btn" onclick="UI.closeDrawer();lblOpenFor('${e.id}')">${U.icon("qr")} Cetak Label</button>
             <div class="spacer"></div>
             <button class="btn btn-primary" ${overdue ? "disabled" : ""} onclick="UI.closeDrawer();eqNew()">Reservasi Alat</button>`
    });
  };

  /* =======================================================================
     KALIBRASI
     ======================================================================= */
  V["calibration"] = {
    title: "Kalibrasi Alat",
    sub: "Jadwal, sertifikat, hasil, jatuh tempo, dan pengingat kalibrasi.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Kirim pengingat ke seluruh PIC')">${U.icon("bell")} Kirim Reminder</button>
              <button class="btn btn-primary btn-sm" onclick="UI.demo('Form jadwal kalibrasi')">${U.icon("plus")} Jadwalkan Kalibrasi</button>`,
    render() {
      const od = D.calibration.filter((c) => c.status === "Overdue");
      const soon = D.calibration.filter((c) => c.status !== "Overdue" && c.due < D.shift(30));
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Overdue", value: od.length, icon: "alert", tint: "red", note: "Alat diblokir otomatis" })}
          ${U.kpi({ label: "Jatuh Tempo ≤ 30 Hari", value: soon.length, icon: "clock", tint: "amber", note: "Perlu penjadwalan" })}
          ${U.kpi({ label: "Terjadwal", value: D.calibration.filter((c) => c.status === "Scheduled").length, icon: "calendar", tint: "brand", note: "Sudah ada tanggal" })}
          ${U.kpi({ label: "Biaya Kalibrasi YTD", value: U.rpShort(D.calibration.reduce((a, c) => a + c.cost, 0)), icon: "money", tint: "teal", note: "10 alat" })}
        </div>

        ${od.length ? `<div class="alert err mb-16">${U.icon("alert", 18)}<div><b>${od.length} alat melewati jatuh tempo kalibrasi</b>
          ${od.map((c) => U.esc(c.eqName)).join(", ")}. Alat-alat ini tidak dapat direservasi sampai kalibrasi ulang selesai.</div></div>` : ""}

        <div class="grid g-2-1 mb-16">
          ${U.card("Jadwal Kalibrasi", U.toolbar({ ph: "Cari alat / sertifikat…", filters: [["Semua Status", "Overdue", "Scheduled", "In Progress"]] }) +
            U.table([
              { t: "ID", w: "130px", render: (c) => `<span class="mono small">${c.id}</span>` },
              { t: "Alat", render: (c) => `<b>${U.esc(c.eqName)}</b><div class="tiny faint">${U.esc(c.lab)}</div>` },
              { t: "Kalibrasi Terakhir", render: (c) => U.fdate(c.last, "short") },
              { t: "Jatuh Tempo", render: (c) => { const d = Math.round((new Date(c.due) - new Date(D.shift(0))) / 86400000);
                  return `${U.fdate(c.due, "short")}<div class="tiny ${d < 0 ? "" : "faint"}" style="${d < 0 ? "color:var(--red-500);font-weight:600" : ""}">${d < 0 ? Math.abs(d) + " hari terlambat" : d + " hari lagi"}</div>`; } },
              { t: "Hasil Terakhir", render: (c) => U.badge(c.result) },
              { t: "Biaya", cls: "right", render: (c) => U.rp(c.cost) },
              { t: "Status", render: (c) => U.badge(c.status) },
              { t: "", cls: "actions", render: (c) => `<button class="btn btn-sm" onclick="UI.demo('Unggah sertifikat kalibrasi')">${U.icon("upload", 12)}</button>` }
            ], D.calibration), { bodyCls: "flush" })}

          <div class="col gap-16">
            ${U.card("Distribusi Jatuh Tempo", `
              <div class="col gap-12">
                ${[["Terlambat", od.length, "var(--red-500)"], ["≤ 7 hari", 2, "var(--amber-500)"], ["8–30 hari", 3, "var(--brand-500)"], ["> 30 hari", 2, "var(--green-500)"]]
                  .map(([k, v, c]) => U.meter(`<span class="small">${k}</span>`, (v / D.calibration.length) * 100, c, v + " alat")).join("")}
              </div>`)}
            ${U.card("Pengaturan Reminder", `
              <div class="col gap-12">
                ${[["90 hari sebelum jatuh tempo", true], ["30 hari sebelum jatuh tempo", true], ["7 hari sebelum jatuh tempo", true], ["Pada hari jatuh tempo", true], ["Harian setelah terlambat", true]]
                  .map(([k, on]) => `<div class="row"><span class="small" style="flex:1">${k}</span>
                    <label class="switch"><input type="checkbox" ${on ? "checked" : ""}><span></span></label></div>`).join("")}
                <div class="small muted mt-8">Kanal: in-app, email, dan WhatsApp ke PIC alat serta Kepala Laboratorium.</div>
              </div>`)}
          </div>
        </div>`;
    }
  };

  /* =======================================================================
     MAINTENANCE
     ======================================================================= */
  V["maintenance"] = {
    title: "Maintenance & Work Order",
    sub: "Preventive, corrective, dan emergency maintenance untuk aset, alat, dan ruangan.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Kalender maintenance')">${U.icon("calendar")} Kalender</button>
              <button class="btn btn-primary btn-sm" onclick="UI.demo('Form work order baru')">${U.icon("plus")} Work Order Baru</button>`,
    render() {
      const total = D.maintenance.reduce((a, m) => a + m.cost, 0);
      return `
        <div class="grid g5 mb-16">
          ${U.kpi({ label: "Work Order Aktif", value: D.maintenance.filter((m) => m.status !== "Completed").length, icon: "wrench", tint: "amber", note: "Sedang berjalan" })}
          ${U.kpi({ label: "Preventive", value: D.maintenance.filter((m) => m.kind === "Preventive").length, icon: "shield", tint: "green", note: "Terjadwal rutin" })}
          ${U.kpi({ label: "Corrective", value: D.maintenance.filter((m) => m.kind === "Corrective").length, icon: "edit", tint: "brand", note: "Perbaikan" })}
          ${U.kpi({ label: "Emergency", value: D.maintenance.filter((m) => m.kind === "Emergency").length, icon: "alert", tint: "red", note: "Penanganan darurat" })}
          ${U.kpi({ label: "Total Biaya", value: U.rpShort(total), icon: "money", tint: "violet", delta: 11, note: "Periode berjalan" })}
        </div>
        <div class="alert warn mb-16">${U.icon("alert", 17)}<div><b>${D.maintenance.filter((m) => m.block).length} resource sedang diblokir dari booking</b>
          Sistem otomatis menolak pengajuan booking pada resource yang berstatus maintenance.</div></div>
        ${U.card("Daftar Work Order", U.toolbar({ ph: "Cari work order / target…", filters: [["Semua Jenis", "Preventive", "Corrective", "Emergency"], ["Semua Status", "Scheduled", "In Progress", "Waiting Part", "Completed"]] }) +
          U.table([
            { t: "ID", w: "140px", render: (m) => `<span class="lnk mono" onclick="showBooking('${m.id}')">${m.id}</span>` },
            { t: "Target", render: (m) => `<b>${U.esc(m.targetName)}</b><div class="tiny faint">${U.esc(m.note)}</div>` },
            { t: "Jenis", render: (m) => `<span class="badge ${m.kind === "Emergency" ? "red" : m.kind === "Corrective" ? "brand" : "green"}">${m.kind}</span>` },
            { t: "Jadwal", render: (m) => U.fdate(m.sched, "short") },
            { t: "Vendor / Teknisi", render: (m) => `${U.esc(m.vendor)}<div class="tiny faint">${U.esc(D.personName(m.tech))}</div>` },
            { t: "Biaya", cls: "right", render: (m) => U.rp(m.cost) },
            { t: "Blokir", cls: "center", render: (m) => m.block ? `<span class="badge red">Ya</span>` : `<span class="faint small">—</span>` },
            { t: "Status", render: (m) => U.badge(m.status) },
            { t: "", cls: "actions", render: (m) => `<button class="icon-btn" onclick="showBooking('${m.id}')">${U.icon("eye", 15)}</button>` }
          ], D.maintenance), { bodyCls: "flush" })}`;
    }
  };

  /* =======================================================================
     RUANGAN
     ======================================================================= */
  function roomGrid(filter) {
    const rows = filter ? D.rooms.filter(filter) : D.rooms;
    return `<div class="grid g3">
      ${rows.map((r) => `
        <div class="card res-card" onclick="showRoom('${r.id}')">
          <div class="thumb">${U.layoutDiagram(r.layout[0], 200, 112)}</div>
          <div class="rc-body">
            <div class="row"><div style="flex:1;min-width:0">
              <div class="rc-title trunc">${U.esc(r.name)}</div>
              <div class="rc-meta">${r.code} • ${r.type}</div></div>${U.badge(r.status)}</div>
            <div class="row mt-8 small muted gap-16">
              <span>${U.icon("users", 13)} ${r.cap} pax</span>
              <span>${U.icon("pin", 13)} ${r.building}-${r.floor}</span>
              <span>${r.area} m²</span></div>
            <div class="rc-facs">${r.facs.slice(0, 4).map((f) => `<span class="fac">${U.esc(f)}</span>`).join("")}
              ${r.facs.length > 4 ? `<span class="fac">+${r.facs.length - 4}</span>` : ""}</div>
            <div class="row mt-12" style="padding-top:10px;border-top:1px solid var(--border)">
              ${U.pricingBadge(r.pricing)}<div class="spacer"></div>
              <b class="small">${r.pricing === "PAID" ? U.rpShort(r.rate) : "Gratis"}</b></div>
          </div>
        </div>`).join("")}
    </div>`;
  }

  V["rooms"] = {
    title: "Manajemen Ruangan",
    sub: "Seluruh ruangan: rapat, konferensi, training, workshop, VIP, dan serbaguna.",
    actions: `<button class="btn btn-sm" onclick="location.hash='#/availability'">${U.icon("calendar")} Ketersediaan</button>
              <button class="btn btn-primary btn-sm" onclick="UI.demo('Form tambah ruangan')">${U.icon("plus")} Tambah Ruangan</button>`,
    render() {
      return `
        <div class="grid g5 mb-16">
          ${U.kpi({ label: "Total Ruangan", value: D.rooms.length, icon: "building", tint: "brand", note: "4 gedung" })}
          ${U.kpi({ label: "Total Kapasitas", value: U.num(D.rooms.reduce((a, r) => a + r.cap, 0)), suffix: "kursi", icon: "users", tint: "teal", note: "Seluruh ruangan" })}
          ${U.kpi({ label: "Ruangan Berbayar", value: D.rooms.filter((r) => r.pricing === "PAID").length, icon: "money", tint: "amber", note: "Dapat disewakan" })}
          ${U.kpi({ label: "Utilisasi Rata-rata", value: Math.round(D.rooms.reduce((a, r) => a + r.util, 0) / D.rooms.length), suffix: "%", icon: "chart", tint: "violet", delta: 6, note: "30 hari terakhir" })}
          ${U.kpi({ label: "Tidak Tersedia", value: D.rooms.filter((r) => r.status === "Maintenance").length, icon: "wrench", tint: "red", note: "Sedang maintenance" })}
        </div>
        <div class="card mb-16"><div class="tbl-toolbar">
          <div class="tbl-search">${U.icon("search", 15, "faint")}<input placeholder="Cari ruangan…"></div>
          <select class="select" style="width:auto"><option>Semua Gedung</option>${D.org.buildings.map((b) => `<option>${b.name}</option>`).join("")}</select>
          <select class="select" style="width:auto"><option>Semua Jenis</option>${[...new Set(D.rooms.map((r) => r.type))].map((t) => `<option>${t}</option>`).join("")}</select>
          <select class="select" style="width:auto"><option>Semua Skema Tarif</option><option>Gratis Internal</option><option>Berbayar</option><option>Terbatas</option></select>
          <div class="spacer"></div>
          <div class="seg"><button class="active">${U.icon("grid", 13)}</button><button onclick="UI.demo('Tampilan tabel')">${U.icon("list", 13)}</button></div>
        </div></div>
        ${roomGrid()}`;
    }
  };

  V["meetingrooms"] = {
    title: "Manajemen Ruang Rapat",
    sub: "Booking, recurring meeting, agenda, peserta, Minutes of Meeting, dan absensi.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Form recurring meeting')">${U.icon("refresh")} Recurring Meeting</button>
              <button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Booking Ruang Rapat</button>`,
    render() {
      const mr = D.rooms.filter((r) => ["Meeting Room", "Conference Room", "VIP"].includes(r.type));
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Ruang Rapat", value: mr.length, icon: "building", tint: "brand", note: "Termasuk VIP & konferensi" })}
          ${U.kpi({ label: "Rapat Minggu Ini", value: 34, icon: "calendar", tint: "teal", delta: 9, note: "12 recurring" })}
          ${U.kpi({ label: "Rata-rata Durasi", value: "1,6", suffix: "jam", icon: "clock", tint: "violet", note: "Per sesi rapat" })}
          ${U.kpi({ label: "MoM Terdokumentasi", value: "82", suffix: "%", icon: "doc", tint: "amber", delta: 14, note: "Target 90%" })}
        </div>
        <div class="grid g-2-1 mb-16">
          ${U.card("Recurring Meeting Terjadwal", U.table([
            { t: "Agenda", render: (a) => `<b>${U.esc(a.title)}</b><div class="tiny faint">${U.esc(D.resName(a.res))}</div>` },
            { t: "Pola", render: (a) => `<span class="badge brand">${U.esc(a.recurring)}</span>` },
            { t: "Waktu", render: (a) => a.time },
            { t: "Organizer", render: (a) => U.esc(D.personName(a.owner)) },
            { t: "", cls: "actions", render: () => `<button class="btn btn-sm" onclick="UI.demo('Kelola seri rapat')">Kelola</button>` }
          ], D.agendas.filter((a) => a.recurring !== "-")), { bodyCls: "flush", sub: "Seri rapat berulang mingguan / bulanan" })}
          ${U.card("Minutes of Meeting Terbaru", `<div class="col gap-12">
            ${[["Rapat Koordinasi Mingguan Fasilitas", "8 poin keputusan • 5 action item", "brand"],
               ["Review Anggaran Q3", "6 poin keputusan • 3 action item", "green"],
               ["Rapat Audit Aset Semester I", "4 poin keputusan • 7 action item", "amber"]].map(([t, m, c]) => `
              <div class="row-t"><div class="kpi-ico tint-${c}" style="width:30px;height:30px;flex:0 0 30px">${U.icon("doc", 14)}</div>
                <div style="flex:1"><div class="bold small">${t}</div><div class="tiny muted">${m}</div></div>
                <button class="btn btn-sm" onclick="UI.demo('Buka MoM')">Buka</button></div>`).join("")}
            <div class="alert ai small mt-8">${U.icon("sparkle", 15)}<div>AI dapat menyusun draf MoM otomatis dari rekaman rapat dan agenda yang terdaftar.</div></div>
          </div>`)}
        </div>
        ${roomGrid((r) => ["Meeting Room", "Conference Room", "VIP"].includes(r.type))}`;
    }
  };

  V["auditorium"] = {
    title: "Manajemen Auditorium",
    sub: "Profil, seating layout, peralatan panggung, operator, dan paket event.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Kelola paket event')">${U.icon("box")} Paket Event</button>
              <button class="btn btn-primary btn-sm" onclick="location.hash='#/booking/new'">${U.icon("plus")} Booking Auditorium</button>`,
    render() {
      const a = D.byId(D.rooms, "RM-005");
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Kapasitas", value: U.num(a.cap), suffix: "kursi", icon: "users", tint: "violet", note: "Layout theater" })}
          ${U.kpi({ label: "Event YTD", value: 18, icon: "star", tint: "amber", delta: 20, note: "12 eksternal, 6 internal" })}
          ${U.kpi({ label: "Occupancy", value: "52", suffix: "%", icon: "chart", tint: "brand", delta: 9, note: "Hari terpakai / hari kerja" })}
          ${U.kpi({ label: "Pendapatan YTD", value: U.rpShort(264000000), icon: "money", tint: "green", delta: 31, note: "54% dari total sewa" })}
        </div>

        <div class="grid g-2-1 mb-16">
          ${U.card("Seating Layout — " + a.name, `
            <div class="row mb-12 wrap gap-8">
              <span class="chip on">Theater — 450 kursi</span><span class="chip">Banquet — 220 kursi</span>
              <span class="chip">Half Hall — 220 kursi</span><span class="chip">Custom</span></div>
            <div style="background:var(--surface-2);border-radius:10px;padding:16px">
              <div style="background:var(--violet-500);color:#fff;border-radius:6px;padding:7px;text-align:center;font-size:11px;font-weight:700;letter-spacing:.08em;margin-bottom:14px">PANGGUNG · 12 × 6 M</div>
              ${U.seatMap(14, 28, 2)}
              <div class="legend mt-12">
                <span><i style="background:var(--violet-500)"></i>VIP (56 kursi)</span>
                <span><i style="background:var(--brand-200)"></i>Reguler (394 kursi)</span>
                <span><i style="background:var(--border-strong)"></i>Tidak tersedia</span></div>
            </div>`, { sub: "Denah kursi dan zona VIP" })}
          <div class="col gap-16">
            ${U.card("Peralatan & Layanan", `<div class="row wrap gap-6">${a.facs.map((f) => `<span class="fac">${U.esc(f)}</span>`).join("")}</div>
              <div class="dl small mt-16" style="grid-template-columns:120px 1fr">
                <dt>Operator</dt><dd>2 orang (AV & lighting)</dd>
                <dt>Technician</dt><dd>1 orang standby</dd>
                <dt>Security</dt><dd>4 orang (event besar)</dd>
                <dt>Parkir</dt><dd>180 slot mobil, 300 motor</dd>
                <dt>Registrasi</dt><dd>Lobby 120 m² + 6 counter</dd>
                <dt>Catering</dt><dd>Pantry & area prasmanan</dd></div>`)}
            ${U.card("Paket Auditorium", `<div class="col gap-10">
              ${D.packages.filter((p) => p.cap >= 150).map((p) => `
                <div class="card"><div class="card-body tight">
                  <div class="row"><b class="small" style="flex:1">${U.esc(p.name)}</b><b>${U.rpShort(p.price)}</b></div>
                  <div class="tiny muted mt-4">${U.esc(p.incl)}</div></div></div>`).join("")}
            </div>`)}
          </div>
        </div>

        ${U.card("Event Mendatang di Auditorium", U.table([
          { t: "Event", render: (e) => `<b>${U.esc(e.name)}</b><div class="tiny faint">${U.esc(e.type)}</div>` },
          { t: "Organizer", render: (e) => U.esc(e.organizer) },
          { t: "Tanggal", render: (e) => U.fdate(e.date, "long") },
          { t: "Peserta", cls: "center", render: (e) => U.num(e.people) },
          { t: "Anggaran", cls: "right", render: (e) => U.rp(e.budget) },
          { t: "Status", render: (e) => U.badge(e.status) },
          { t: "", cls: "actions", render: () => `<button class="btn btn-sm" onclick="UI.demo('Detail event')">Detail</button>` }
        ], D.events.filter((e) => e.venue === "RM-005")), { bodyCls: "flush" })}`;
    }
  };

  window.showRoom = function (id) {
    const r = D.byId(D.rooms, id);
    const bk = D.bookings.filter((b) => b.res === id);
    U.drawer({
      size: "wide", title: r.name, sub: r.code + " • " + r.type + " • " + (D.org.buildings.find((b) => b.code === r.building) || {}).name,
      body: `
        <div class="thumb mb-16" style="aspect-ratio:21/9">${U.layoutDiagram(r.layout[0], 220, 100)}</div>
        <div class="row wrap gap-6 mb-16">${U.badge(r.status)}${U.pricingBadge(r.pricing)}
          <span class="badge outline">${r.cap} kursi</span><span class="badge outline">${r.area} m²</span></div>
        <div class="tabs mb-16"><button class="active">Profil</button>
          <button onclick="UI.demo('Tab jadwal')">Jadwal</button><button onclick="UI.demo('Tab layout')">Layout</button>
          <button onclick="UI.demo('Tab tarif')">Tarif</button><button onclick="UI.demo('Tab riwayat')">Riwayat</button></div>
        <div class="dl mb-16">
          <dt>Lokasi</dt><dd>Lantai ${r.floor}, ${U.esc((D.org.buildings.find((b) => b.code === r.building) || {}).name)}</dd>
          <dt>Jenis Ruangan</dt><dd>${U.esc(r.type)}</dd>
          <dt>Kapasitas</dt><dd>${r.cap} orang</dd>
          <dt>Luas</dt><dd>${r.area} m²</dd>
          <dt>Layout Tersedia</dt><dd>${r.layout.map((l) => `<span class="fac">${l}</span>`).join(" ")}</dd>
          <dt>PIC Ruangan</dt><dd>${U.esc(D.personName(r.pic))}</dd>
          <dt>Jam Operasional</dt><dd>07:00 – 18:00 WIB</dd>
          <dt>Utilisasi</dt><dd><b>${r.util}%</b> <span class="muted small">(30 hari terakhir)</span></dd>
          <dt>Tarif Eksternal</dt><dd>${r.pricing === "PAID" ? U.rp(r.rate) + " / hari" : "Tidak disewakan"}</dd>
        </div>
        <h4 class="mb-8 muted">FASILITAS RUANGAN</h4>
        <div class="row wrap gap-6 mb-16">${r.facs.map((f) => `<span class="fac">${U.esc(f)}</span>`).join("")}</div>
        <h4 class="mb-8 muted">RIWAYAT BOOKING (${bk.length})</h4>
        ${bk.length ? U.table([
          { t: "ID", render: (b) => `<span class="mono small">${b.id}</span>` },
          { t: "Agenda", render: (b) => U.esc(b.agenda) },
          { t: "Tanggal", render: (b) => U.fdate(b.date, "short") },
          { t: "Status", render: (b) => U.badge(b.status) }], bk) : U.emptyState("Belum ada booking", "")}
        <div class="row gap-16 mt-16" style="padding-top:16px;border-top:1px solid var(--border)">
          ${U.qrBox(r.code)}<div class="small muted">QR di pintu ruangan menampilkan jadwal hari ini, PIC, status, dan tombol check-in cepat.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <button class="btn" onclick="UI.demo('Form edit ruangan')">${U.icon("edit")} Edit</button>
             <div class="spacer"></div>
             <button class="btn btn-primary" onclick="UI.closeDrawer();location.hash='#/booking/new'">Booking Ruangan</button>`
    });
  };

  /* =======================================================================
     ROOM LAYOUT
     ======================================================================= */
  V["layout"] = {
    title: "Room Layout Management",
    sub: "Konfigurasi layout ruangan: Classroom, U-Shape, Theater, Boardroom, Banquet, Cluster, dan custom.",
    actions: `<button class="btn btn-primary btn-sm" onclick="UI.demo('Editor layout custom')">${U.icon("plus")} Layout Custom</button>`,
    render() {
      const layouts = [
        { n: "Theater", d: "Kursi berbaris menghadap panggung tanpa meja. Kapasitas maksimal.", cap: "100%", use: "Seminar, sosialisasi, wisuda" },
        { n: "Classroom", d: "Meja panjang menghadap depan. Nyaman untuk mencatat.", cap: "55%", use: "Pelatihan, workshop teknis" },
        { n: "U-Shape", d: "Meja membentuk huruf U, fasilitator di tengah.", cap: "35%", use: "Diskusi interaktif, FGD" },
        { n: "Boardroom", d: "Satu meja besar, peserta saling berhadapan.", cap: "30%", use: "Rapat direksi, negosiasi" },
        { n: "Banquet", d: "Meja bundar untuk 8–10 orang per meja.", cap: "50%", use: "Gathering, jamuan makan" },
        { n: "Cluster", d: "Kelompok meja kecil untuk kerja tim.", cap: "45%", use: "Workshop kreatif, hackathon" }
      ];
      return `
        <div class="grid g3 mb-16">
          ${layouts.map((l) => `<div class="card"><div class="card-body">
            ${U.layoutDiagram(l.n, 200, 118)}
            <div class="row mt-12"><b style="flex:1">${l.n}</b><span class="badge brand">${l.cap} kapasitas</span></div>
            <div class="small muted mt-4">${l.d}</div>
            <div class="tiny faint mt-8">${U.icon("check", 11)} Cocok untuk: ${l.use}</div>
            <div class="row mt-12 gap-6">
              <button class="btn btn-sm" onclick="UI.demo('Editor layout ${l.n}')">${U.icon("edit", 12)} Edit</button>
              <button class="btn btn-sm" onclick="UI.demo('Ruangan yang mendukung layout ${l.n}')">Ruangan Terkait</button></div>
          </div></div>`).join("")}
        </div>
        ${U.card("Matriks Layout per Ruangan", U.table(
          [{ t: "Ruangan", render: (r) => `<b>${U.esc(r.name)}</b><div class="tiny faint">${r.code} • ${r.cap} pax</div>` }]
            .concat(layouts.map((l) => ({
              t: l.n, cls: "center",
              render: (r) => r.layout.includes(l.n) ? `<span style="color:var(--green-500)">${U.icon("check", 15)}</span>` : `<span class="faint">—</span>`
            })))
            .concat([{ t: "Custom", cls: "center", render: () => `<span style="color:var(--green-500)">${U.icon("check", 15)}</span>` }]),
          D.rooms), { bodyCls: "flush", sub: "Layout yang didukung setiap ruangan" })}`;
    }
  };

  V["facility"] = {
    title: "Fasilitas & Add-on",
    sub: "Katalog fasilitas pendukung beserta tarif yang otomatis masuk perhitungan booking.",
    actions: `<button class="btn btn-primary btn-sm" onclick="UI.demo('Form tambah add-on')">${U.icon("plus")} Tambah Add-on</button>`,
    render() {
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Katalog Add-on", value: D.addons.length, icon: "box", tint: "brand", note: "Aktif dijual" })}
          ${U.kpi({ label: "Add-on Terlaris", value: "Coffee Break", icon: "star", tint: "amber", note: "148× dipesan YTD" })}
          ${U.kpi({ label: "Pendapatan Add-on", value: U.rpShort(78500000), icon: "money", tint: "green", delta: 18, note: "16% dari total sewa" })}
          ${U.kpi({ label: "Vendor Terhubung", value: D.vendors.length, icon: "users", tint: "teal", note: "Kontrak aktif" })}
        </div>
        ${U.card("Katalog Fasilitas Tambahan", U.toolbar({ ph: "Cari add-on…", right: `<button class="btn btn-sm" onclick="UI.demo('Ekspor katalog')">${U.icon("download")} Ekspor</button>` }) +
          U.table([
            { t: "Kode", w: "90px", render: (a) => `<span class="mono small">${a.id}</span>` },
            { t: "Nama Add-on", render: (a) => `<b>${U.esc(a.name)}</b>` },
            { t: "Satuan", render: (a) => `<span class="badge outline">${U.esc(a.unit)}</span>` },
            { t: "Tarif", cls: "right", render: (a) => `<b>${U.rp(a.price)}</b>` },
            { t: "Ketersediaan", cls: "center", render: () => U.badge("Tersedia") },
            { t: "", cls: "actions", render: () => `<button class="icon-btn" onclick="UI.demo('Edit add-on')">${U.icon("edit", 15)}</button>` }
          ], D.addons), { bodyCls: "flush" })}`;
    }
  };

  V["facilityschedule"] = {
    title: "Jadwal Fasilitas",
    sub: "Rekapitulasi seluruh pemakaian fasilitas beserta add-on yang dipesan.",
    render() {
      return `${U.card("Jadwal Fasilitas Hari Ini", U.table([
        { t: "Waktu", w: "120px", render: (b) => `<b>${b.start}</b><div class="tiny faint">s/d ${b.end}</div>` },
        { t: "Fasilitas", render: (b) => `<b>${U.esc(b.resName)}</b><div class="tiny faint">${U.esc(b.type)}</div>` },
        { t: "Kegiatan", render: (b) => U.esc(b.agenda) },
        { t: "Add-on", render: (b) => b.addons.length ? b.addons.map((a) => `<span class="fac">${U.esc(a)}</span>`).join(" ") : `<span class="faint small">—</span>` },
        { t: "PIC Setup", render: (b) => U.esc(D.personName(b.pic)) },
        { t: "Status", render: (b) => U.badge(b.status) }
      ], D.bookings.filter((b) => b.date >= D.shift(0)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))), { bodyCls: "flush" })}`;
    }
  };

})();
