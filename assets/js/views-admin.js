/* ==========================================================================
   FLMS — Views: Approval, Administrasi, Audit Trail, Integrasi, AI Assistant
   ========================================================================== */
(function () {
  const U = UI, D = DB, V = window.VIEWS;

  /* =======================================================================
     APPROVAL
     ======================================================================= */
  V["approval"] = {
    title: "Kotak Persetujuan",
    sub: "Pengajuan yang menunggu tindakan Anda beserta riwayat approval.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Setujui seluruh pengajuan terpilih')">${U.icon("check")} Setujui Massal</button>
              <button class="btn btn-primary btn-sm" onclick="location.hash='#/workflow'">${U.icon("gear")} Konfigurasi Workflow</button>`,
    render() {
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Menunggu Tindakan", value: D.approvals.length, icon: "clock", tint: "amber", note: "Atas nama Anda" })}
          ${U.kpi({ label: "Melewati SLA", value: 2, icon: "alert", tint: "red", note: "Perlu segera diproses" })}
          ${U.kpi({ label: "Disetujui Bulan Ini", value: 87, icon: "check", tint: "green", delta: 12, note: "Rata-rata 3,4 jam" })}
          ${U.kpi({ label: "Nilai Menunggu", value: U.rpShort(D.approvals.reduce((a, x) => a + x.amount, 0)), icon: "money", tint: "brand", note: "Total transaksi berbayar" })}
        </div>

        <div class="tabs mb-16">
          <button class="active">Menunggu Saya (${D.approvals.length})</button>
          <button onclick="UI.demo('Tab diajukan oleh saya')">Diajukan Saya</button>
          <button onclick="UI.demo('Tab riwayat')">Riwayat</button>
          <button onclick="UI.demo('Tab didelegasikan')">Didelegasikan</button>
        </div>

        <div class="col gap-12">
          ${D.approvals.map((a) => {
            const late = ["AP-2026-01191", "AP-2026-01192"].includes(a.id);
            return `<div class="card" style="border-left:3px solid ${late ? "var(--red-500)" : a.priority === "Tinggi" ? "var(--amber-500)" : "var(--brand-500)"}">
              <div class="card-body">
                <div class="row-t">
                  <div style="flex:1;min-width:0">
                    <div class="row wrap gap-6 mb-8">
                      <span class="badge outline">${U.esc(a.type)}</span>
                      <span class="badge ${a.priority === "Tinggi" ? "red" : "amber"}">Prioritas ${a.priority}</span>
                      ${late ? `<span class="badge red">${U.icon("alert", 11)} Melewati SLA</span>` : `<span class="badge outline">SLA ${a.sla}</span>`}
                      <span class="tiny faint mono">${a.id}</span>
                    </div>
                    <div class="bold mb-4">${U.esc(a.subject)}</div>
                    <div class="small muted">Diajukan oleh <b>${U.esc(D.personName(a.requester))}</b> pada ${U.fdate(a.submitted, "long")} •
                      Referensi <span class="mono">${a.ref}</span></div>
                    <div class="row mt-12 small gap-16 wrap">
                      <span>${U.icon("check", 13)} Tahap: <b>${U.esc(a.stage)}</b></span>
                      <span>${U.icon("chev", 13)} Berikutnya: ${U.esc(a.nextStage)}</span>
                      ${a.amount ? `<span>${U.icon("money", 13)} Nilai: <b>${U.rp(a.amount)}</b></span>` : ""}
                    </div>
                  </div>
                  <div class="col gap-6" style="width:158px">
                    <button class="btn btn-sm btn-primary btn-block" onclick="apprDo('${a.id}','setuju')">${U.icon("check", 13)} Setujui</button>
                    <button class="btn btn-sm btn-block" onclick="apprDo('${a.id}','tolak')">${U.icon("x", 13)} Tolak</button>
                    <button class="btn btn-sm btn-ghost btn-block" onclick="showBooking('${a.ref}')">Lihat Detail</button>
                  </div>
                </div>
              </div></div>`;
          }).join("")}
        </div>`;
    }
  };

  window.apprDo = function (id, act) {
    U.modal({
      title: act === "setuju" ? "Setujui Pengajuan" : "Tolak Pengajuan", sub: id,
      body: `<div class="field mb-16"><label>Catatan ${act === "tolak" ? '<span class="req">*</span>' : "(opsional)"}</label>
        <textarea class="textarea" placeholder="${act === "setuju" ? "Catatan persetujuan, syarat, atau instruksi tambahan…" : "Alasan penolakan wajib diisi agar pemohon dapat memperbaiki pengajuan."}"></textarea></div>
        ${act === "setuju" ? `<label class="check"><input type="checkbox"><span class="small">Teruskan langsung ke tahap berikutnya tanpa menunggu batch approval.</span></label>` : ""}
        <div class="alert info mt-16 small">${U.icon("bell", 15)}<div>Pemohon akan menerima notifikasi in-app, email, dan WhatsApp setelah keputusan disimpan.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn ${act === "setuju" ? "btn-primary" : "btn-danger"}"
               onclick="UI.closeModal();UI.toast('${act === "setuju" ? "Pengajuan disetujui" : "Pengajuan ditolak"}','${id} telah diperbarui dan notifikasi terkirim.','${act === "setuju" ? "ok" : "warn"}')">
               ${act === "setuju" ? "Setujui" : "Tolak"}</button>`
    });
  };

  /* =======================================================================
     WORKFLOW
     ======================================================================= */
  V["workflow"] = {
    title: "Konfigurasi Workflow",
    sub: "Alur persetujuan yang dapat dikonfigurasi per jenis transaksi dan struktur organisasi.",
    actions: `<button class="btn btn-primary btn-sm" onclick="UI.demo('Workflow builder')">${U.icon("plus")} Buat Workflow</button>`,
    render() {
      return `
        <div class="alert info mb-16">${U.icon("shield", 17)}<div><b>Workflow berbasis kondisi</b>
          Alur persetujuan otomatis dipilih sistem berdasarkan pemicu: nilai transaksi, jenis resource, tipe pemohon, atau unit kerja.</div></div>
        <div class="col gap-12">
          ${D.workflows.map((w) => `
            <div class="card"><div class="card-body">
              <div class="row-t mb-12">
                <div style="flex:1">
                  <div class="row gap-8 mb-4"><b>${U.esc(w.name)}</b>
                    ${w.active ? U.badge("Aktif") : `<span class="badge slate">Nonaktif</span>`}
                    <span class="tiny faint mono">${w.id}</span></div>
                  <div class="small muted">Pemicu: ${U.esc(w.trigger)} • SLA total ${U.esc(w.sla)}</div>
                </div>
                <label class="switch"><input type="checkbox" ${w.active ? "checked" : ""}><span></span></label>
                <button class="btn btn-sm" onclick="UI.demo('Editor workflow ${w.id}')">${U.icon("edit", 12)} Edit</button>
              </div>
              <div style="background:var(--surface-2);border-radius:10px;padding:14px">
                ${U.stepper(w.steps.concat(["Selesai"]), w.steps.length)}
              </div>
            </div></div>`).join("")}
        </div>`;
    }
  };

  /* =======================================================================
     ROLE & PERMISSION
     ======================================================================= */
  V["roles"] = {
    title: "Role & Hak Akses",
    sub: "Permission per modul, lokasi, unit kerja, data, dan tindakan.",
    actions: `<button class="btn btn-primary btn-sm" onclick="UI.demo('Form role baru')">${U.icon("plus")} Tambah Role</button>`,
    render() {
      const LV = { FULL: ["green", "Penuh"], EDIT: ["brand", "Ubah"], CREATE: ["teal", "Buat"], VIEW: ["amber", "Lihat"], NONE: ["slate", "—"] };
      return `
        <div class="perm-page mb-16">
          ${U.card("Daftar Role", U.table([
            { t: "Role", render: (r) => `<b>${U.esc(r.name)}</b><div class="tiny faint">${U.esc(r.desc)}</div>` },
            { t: "Pengguna", cls: "center", render: (r) => `<span class="badge brand">${r.users}</span>` },
            { t: "Cakupan Data", render: (r) => `<span class="small muted">${U.esc(r.scope)}</span>` },
            { t: "", cls: "actions", render: () => `<button class="icon-btn" onclick="UI.demo('Edit permission role')">${U.icon("edit", 15)}</button>` }
          ], D.roles), { bodyCls: "flush" })}
          ${U.card("Matriks Permission", `<div class="table-wrap"><table class="tbl">
            <thead><tr><th>Modul</th>${D.permMatrix.roles.map((r) => `<th class="center">${r}</th>`).join("")}</tr></thead>
            <tbody>${D.permMatrix.modules.map((m, i) => `<tr><td><b class="small">${m}</b></td>
              ${D.permMatrix.grid[i].map((lv) => `<td class="center"><span class="badge ${LV[lv][0]}">${LV[lv][1]}</span></td>`).join("")}
            </tr>`).join("")}</tbody></table></div>`,
            { bodyCls: "flush", sub: "Klik sel untuk mengubah level akses", tools: `<button class="btn btn-sm" onclick="UI.demo('Simpan matriks permission')">Simpan</button>` })}
        </div>
        ${U.card("Pembatasan Data (Data Scope)", `<div class="grid g3">
          ${[["Berdasarkan Lokasi", "Pengguna hanya melihat resource pada lokasi/gedung yang ditugaskan.", "pin"],
             ["Berdasarkan Unit Kerja", "Data booking dan aset dibatasi pada unit kerja pengguna.", "users"],
             ["Berdasarkan Resource", "PIC hanya mengelola resource yang secara eksplisit ditugaskan kepadanya.", "box"]]
            .map(([t, d, ic]) => `<div class="card"><div class="card-body">
              <div class="kpi-ico tint-brand mb-8">${U.icon(ic, 17)}</div>
              <b class="small">${t}</b><div class="small muted mt-4">${d}</div>
              <div class="row mt-12"><span class="small muted" style="flex:1">Aktif</span>
                <label class="switch"><input type="checkbox" checked><span></span></label></div>
            </div></div>`).join("")}
        </div>`)}`;
    }
  };

  /* =======================================================================
     MASTER DATA
     ======================================================================= */
  V["masterdata"] = {
    title: "Master Data",
    sub: "Referensi organisasi, SDM, fasilitas, kategori, dan status yang dipakai seluruh modul.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Impor master data')">${U.icon("upload")} Impor</button>
              <button class="btn btn-primary btn-sm" onclick="UI.demo('Tambah data referensi')">${U.icon("plus")} Tambah Data</button>`,
    render() {
      const groups = [
        { t: "Organisasi", ic: "building", tint: "brand", items: [["Perusahaan / Instansi", 1], ["Unit Kerja", D.org.units.length], ["Lokasi", D.org.locations.length], ["Gedung", D.org.buildings.length], ["Lantai", 15]] },
        { t: "SDM", ic: "users", tint: "teal", items: [["Pengguna", 329], ["Jabatan", 24], ["Kompetensi", 38], ["Sertifikasi", 17], ["Role", D.roles.length]] },
        { t: "Fasilitas", ic: "grid", tint: "violet", items: [["Ruangan", D.rooms.length], ["Laboratorium", D.labs.length], ["Jenis Ruangan", 10], ["Layout Ruangan", 7], ["Fasilitas / Add-on", D.addons.length]] },
        { t: "Kategori", ic: "box", tint: "amber", items: [["Kategori Aset", 12], ["Kategori Alat", 11], ["Jenis Kegiatan", 8], ["Kategori Biaya", 9], ["Kategori Maintenance", 3]] },
        { t: "Status & Kondisi", ic: "check", tint: "green", items: [["Status Aset", 9], ["Status Alat", 9], ["Status Booking", 8], ["Kondisi", 5], ["Status Pembayaran", 6]] },
        { t: "Komersial", ic: "money", tint: "slate", items: [["Daftar Tarif", D.priceList.length], ["Paket Layanan", D.packages.length], ["Vendor", D.vendors.length], ["Pajak", 2], ["Metode Pembayaran", 5]] }
      ];
      return `<div class="grid g3">
        ${groups.map((g) => `<div class="card"><div class="card-head">
          <div class="kpi-ico tint-${g.tint}" style="width:30px;height:30px;flex:0 0 30px">${U.icon(g.ic, 15)}</div>
          <h3>${g.t}</h3></div>
          <div class="card-body flush">${g.items.map((it) => `
            <div class="row" style="padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer" onclick="UI.demo('Kelola ${it[0]}')">
              <span class="small" style="flex:1">${it[0]}</span>
              <span class="badge outline">${U.num(it[1])}</span>
              <span class="faint">${U.icon("chev", 14)}</span></div>`).join("")}</div>
        </div>`).join("")}
      </div>`;
    }
  };

  /* =======================================================================
     NOTIFIKASI
     ======================================================================= */
  V["notification"] = {
    title: "Pusat Notifikasi",
    sub: "Kanal in-app, email, WhatsApp, dan push notification beserta aturan pengiriman.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Kirim notifikasi uji coba')">${U.icon("send")} Uji Kirim</button>`,
    render() {
      const rules = [
        { ev: "Pengajuan booking baru", to: "PIC Ruangan", ch: ["In-app", "Email", "WA"], when: "Segera" },
        { ev: "Approval menunggu tindakan", to: "Approver aktif", ch: ["In-app", "Email"], when: "Segera + ulang 4 jam" },
        { ev: "Booking disetujui / ditolak", to: "Pemohon", ch: ["In-app", "Email", "WA"], when: "Segera" },
        { ev: "Pengingat booking", to: "Pemohon & peserta", ch: ["In-app", "WA", "Push"], when: "H-1 dan 1 jam sebelum" },
        { ev: "Kalibrasi mendekati jatuh tempo", to: "PIC alat & Kepala Lab", ch: ["In-app", "Email"], when: "H-90, H-30, H-7, H-0" },
        { ev: "Alat/aset terlambat dikembalikan", to: "Peminjam & atasan", ch: ["In-app", "Email", "WA"], when: "H+1 lalu harian" },
        { ev: "Jadwal maintenance", to: "Teknisi & PIC resource", ch: ["In-app", "Email"], when: "H-3 dan hari-H" },
        { ev: "Invoice terbit & jatuh tempo", to: "Klien & Finance", ch: ["Email", "WA"], when: "Saat terbit, H-3, H-0, H+1" },
        { ev: "Undangan rapat / event", to: "Peserta terdaftar", ch: ["Email", "WA", "Push"], when: "Saat konfirmasi booking" }
      ];
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Terkirim Hari Ini", value: 248, icon: "send", tint: "brand", note: "Seluruh kanal" })}
          ${U.kpi({ label: "Delivery Rate", value: "98,4", suffix: "%", icon: "check", tint: "green", note: "4 gagal kirim" })}
          ${U.kpi({ label: "Aturan Aktif", value: rules.length, icon: "gear", tint: "violet", note: "Terkonfigurasi" })}
          ${U.kpi({ label: "Kanal Aktif", value: 4, icon: "bell", tint: "amber", note: "In-app, email, WA, push" })}
        </div>
        <div class="grid g4 mb-16">
          ${[["In-App", "bell", "brand", true], ["Email (SMTP)", "send", "teal", true], ["WhatsApp Business API", "mic", "green", true], ["Push Notification", "grid", "violet", true]]
            .map(([n, ic, t, on]) => `<div class="card"><div class="card-body">
              <div class="row"><div class="kpi-ico tint-${t}">${U.icon(ic, 17)}</div>
                <div class="spacer"></div><label class="switch"><input type="checkbox" ${on ? "checked" : ""}><span></span></label></div>
              <b class="small mt-8" style="display:block">${n}</b>
              <div class="tiny muted mt-4">${U.badge("Aktif")} terhubung</div>
            </div></div>`).join("")}
        </div>
        ${U.card("Aturan Notifikasi", U.table([
          { t: "Peristiwa", render: (r) => `<b>${U.esc(r.ev)}</b>` },
          { t: "Penerima", render: (r) => U.esc(r.to) },
          { t: "Kanal", render: (r) => r.ch.map((c) => `<span class="fac">${c}</span>`).join(" ") },
          { t: "Waktu Kirim", render: (r) => `<span class="small muted">${U.esc(r.when)}</span>` },
          { t: "Aktif", cls: "center", render: () => `<label class="switch"><input type="checkbox" checked><span></span></label>` },
          { t: "", cls: "actions", render: () => `<button class="icon-btn" onclick="UI.demo('Edit aturan notifikasi')">${U.icon("edit", 15)}</button>` }
        ], rules), { bodyCls: "flush" })}`;
    }
  };

  /* =======================================================================
     AUDIT TRAIL
     ======================================================================= */
  V["audit"] = {
    title: "Audit Trail",
    sub: "Rekam jejak seluruh aktivitas: user, waktu, IP, perangkat, nilai sebelum, dan nilai sesudah.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Ekspor audit log')">${U.icon("download")} Ekspor Log</button>`,
    render() {
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Aktivitas Hari Ini", value: U.num(1482), icon: "list", tint: "brand", note: "Seluruh pengguna" })}
          ${U.kpi({ label: "Perubahan Data", value: 214, icon: "edit", tint: "amber", note: "Create / update / delete" })}
          ${U.kpi({ label: "Login Berhasil", value: 187, icon: "shield", tint: "green", note: "3 gagal login" })}
          ${U.kpi({ label: "Retensi Log", value: "24", suffix: "bulan", icon: "clock", tint: "violet", note: "Sesuai kebijakan" })}
        </div>
        ${U.card("Log Aktivitas — " + U.fdate(D.shift(0), "long"), U.toolbar({
          ph: "Cari user, objek, atau aktivitas…",
          filters: [["Semua Aktivitas", "CREATE", "UPDATE", "DELETE", "APPROVE", "LOGIN", "NOTIFY"], ["Semua Pengguna"].concat(D.people.map((p) => p.name)), ["Semua Modul"]]
        }) + U.table([
          { t: "Waktu", w: "95px", render: (a) => `<span class="mono small">${a.time}</span>` },
          { t: "Pengguna", render: (a) => a.user === "SYSTEM" ? `<span class="badge slate">SISTEM</span>` :
            `<div class="row"><span class="avatar sm">${U.initials(D.personName(a.user))}</span><span class="small">${U.esc(D.personName(a.user))}</span></div>` },
          { t: "Aktivitas", render: (a) => `<span class="badge ${{ CREATE: "green", UPDATE: "brand", DELETE: "red", APPROVE: "teal", LOGIN: "slate", NOTIFY: "violet", CHECKIN: "amber" }[a.act] || "slate"}">${a.act}</span>` },
          { t: "Objek", render: (a) => `<b class="small">${U.esc(a.obj)}</b>` },
          { t: "Nilai Sebelum", render: (a) => `<span class="small muted">${U.esc(a.before)}</span>` },
          { t: "Nilai Sesudah", render: (a) => `<span class="small">${U.esc(a.after)}</span>` },
          { t: "IP", render: (a) => `<span class="mono tiny">${a.ip}</span>` },
          { t: "Perangkat", render: (a) => `<span class="tiny muted">${U.esc(a.dev)}</span>` }
        ], D.audit) + U.pager(1482, 1, 10), { bodyCls: "flush" })}`;
    }
  };

  /* =======================================================================
     PENGATURAN SISTEM
     ======================================================================= */
  V["settings"] = {
    title: "Pengaturan Sistem",
    sub: "Konfigurasi umum, penomoran dokumen, jam operasional, integrasi, dan keamanan.",
    actions: `<button class="btn btn-primary btn-sm" onclick="UI.demo('Pengaturan disimpan')">${U.icon("check")} Simpan</button>`,
    render() {
      return `<div class="grid g2 gap-16">
        ${U.card("Identitas Organisasi", `<div class="col gap-12">
          <div class="field"><label>Nama Organisasi</label><input class="input" value="${U.esc(D.org.company)}"></div>
          <div class="field"><label>Alamat</label><textarea class="textarea" style="min-height:60px">Jl. Teknologi Raya No. 88, Cikarang, Bekasi 17530</textarea></div>
          <div class="grid g2"><div class="field"><label>Zona Waktu</label><select class="select"><option>WIB (UTC+7)</option><option>WITA (UTC+8)</option><option>WIT (UTC+9)</option></select></div>
            <div class="field"><label>Mata Uang</label><select class="select"><option>IDR — Rupiah</option><option>USD</option></select></div></div>
        </div>`)}

        ${U.card("Jam Operasional & Booking", `<div class="col gap-12">
          <div class="grid g2"><div class="field"><label>Jam Buka</label><input type="time" class="input" value="07:00"></div>
            <div class="field"><label>Jam Tutup</label><input type="time" class="input" value="18:00"></div></div>
          <div class="field"><label>Hari Operasional</label><div class="row wrap gap-6">
            ${["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d, i) => `<span class="chip ${i < 5 ? "on" : ""}" onclick="this.classList.toggle('on')">${d}</span>`).join("")}</div></div>
          <div class="grid g2"><div class="field"><label>Durasi Booking Minimum</label><select class="select"><option>30 menit</option><option selected>1 jam</option><option>2 jam</option></select></div>
            <div class="field"><label>Maksimal H- Booking</label><select class="select"><option>30 hari</option><option selected>90 hari</option><option>180 hari</option></select></div></div>
          <div class="row"><span class="small" style="flex:1">Izinkan booking di luar jam operasional (dengan approval)</span>
            <label class="switch"><input type="checkbox" checked><span></span></label></div>
        </div>`)}

        ${U.card("Penomoran Dokumen", `<div class="col gap-12">
          ${[["Booking", "BK-{YYYY}-{000000}", "BK-2026-000445"], ["Reservasi Alat", "ER-{YYYY}-{00000}", "ER-2026-00225"],
             ["Peminjaman", "LN-{YYYY}-{00000}", "LN-2026-00093"], ["Quotation", "QT-{YYYY}-{0000}", "QT-2026-0089"],
             ["Invoice", "INV-{YYYY}-{0000}", "INV-2026-0232"], ["Work Order", "MT-{YYYY}-{00000}", "MT-2026-00149"]]
            .map(([n, f, ex]) => `<div class="row"><span class="small" style="width:130px">${n}</span>
              <input class="input mono" style="flex:1" value="${f}"><span class="tiny faint mono" style="width:150px;text-align:right">→ ${ex}</span></div>`).join("")}
        </div>`)}

        ${U.card("Kebijakan Booking & Pembatalan", `<div class="col gap-12">
          ${[["Wajib check-in QR sebelum penggunaan", true], ["Auto-release bila tidak check-in dalam 15 menit", true],
             ["Tolak otomatis bila peserta melebihi kapasitas", true], ["Blokir booking pada resource maintenance", true],
             ["Izinkan pembatalan mandiri H-1", true], ["Kenakan biaya pembatalan < H-3 untuk sewa berbayar", false],
             ["Aktifkan deteksi benturan PIC", true]]
            .map(([n, on]) => `<div class="row"><span class="small" style="flex:1">${n}</span>
              <label class="switch"><input type="checkbox" ${on ? "checked" : ""}><span></span></label></div>`).join("")}
        </div>`)}

        ${U.card("Keamanan", `<div class="col gap-12">
          ${[["Single Sign-On (SSO) via Azure AD", true], ["Two-Factor Authentication untuk role admin", true],
             ["Paksa ganti kata sandi tiap 90 hari", false], ["Batasi akses berdasarkan IP jaringan kantor", false],
             ["Catat seluruh aktivitas ke audit trail", true]]
            .map(([n, on]) => `<div class="row"><span class="small" style="flex:1">${n}</span>
              <label class="switch"><input type="checkbox" ${on ? "checked" : ""}><span></span></label></div>`).join("")}
          <div class="field mt-8"><label>Durasi Sesi Idle</label><select class="select"><option>15 menit</option><option selected>30 menit</option><option>1 jam</option></select></div>
        </div>`)}

        ${U.card("Integrasi & API", `<div class="col gap-10">
          ${[["HRIS — Sinkronisasi Pegawai", "Terhubung", "green"], ["Google Calendar / Outlook", "Terhubung", "green"],
             ["WhatsApp Business API", "Terhubung", "green"], ["Payment Gateway (VA & QRIS)", "Terhubung", "green"],
             ["ERP / Akuntansi", "Belum dikonfigurasi", "amber"], ["IoT Sensor & Smart Lock", "Belum dikonfigurasi", "amber"],
             ["RFID Gate Reader", "Belum dikonfigurasi", "amber"]]
            .map(([n, s, t]) => `<div class="row"><span class="small" style="flex:1">${n}</span>
              <span class="badge ${t}">${s}</span>
              <button class="btn btn-sm" onclick="UI.demo('Konfigurasi integrasi')">Atur</button></div>`).join("")}
          <div class="alert info small mt-8">${U.icon("link", 15)}<div>REST API tersedia di <span class="mono">/api/v1</span> dengan autentikasi OAuth 2.0. Webhook dapat dikirim untuk peristiwa booking, approval, dan pembayaran.</div></div>
        </div>`)}
      </div>`;
    }
  };

  /* =======================================================================
     AI ASSISTANT
     ======================================================================= */
  const CHAT = [
    { who: "bot", text: "Selamat datang. Saya asisten AI untuk pengelolaan fasilitas dan laboratorium. Saya dapat mencari ruangan, mendeteksi konflik jadwal, menganalisis utilisasi, hingga menyusun ringkasan laporan. Apa yang bisa saya bantu?" }
  ];

  const AI_REPLIES = {
    ruangan: `Saya menemukan <b>3 ruangan</b> yang sesuai untuk 25 peserta pada ${UI.fdate(DB.shift(2), "long")} pukul 09.00–12.00:
      <br><br>1. <b>Training Room Nusantara</b> — 60 kursi, proyektor + sound system, gratis internal. Paling sesuai: seluruh fasilitas tersedia dan tanpa benturan jadwal.
      <br>2. <b>Conference Room Garuda</b> — 45 kursi, video conference, gratis internal. Kapasitas berlebih ±44%.
      <br>3. <b>Ruang Serbaguna Merapi</b> — 150 kursi, berbayar Rp 4.500.000/hari. Tidak disarankan untuk 25 peserta.
      <br><br>Rekomendasi saya: <b>Training Room Nusantara</b> dengan layout <b>Cluster</b> agar mendukung diskusi kelompok.`,
    konflik: `Saya mendeteksi <b>2 potensi benturan</b> pada minggu ini:
      <br><br>• <b>Meeting Room Alpha</b> — BK-2026-000433 (13.00–15.00) berpotensi berhimpit dengan permintaan baru pukul 14.30. Alternatif: Meeting Room Epsilon (12 kursi, tersedia penuh).
      <br>• <b>Bayu Prakoso</b> ditugaskan sebagai operator pada 2 reservasi alat bersamaan (SEM dan XRD) pada ${UI.fdate(DB.shift(2), "short")}. Saran: delegasikan XRD ke teknisi lain atau geser ke pukul 14.00.`,
    utilisasi: `Ringkasan utilisasi 30 hari terakhir:
      <br><br>• Ruangan <b>74%</b> (naik 6 poin), Laboratorium <b>81%</b> (naik 8 poin), Alat <b>68%</b> (naik 5 poin).
      <br>• Tertinggi: Training Room Nusantara 83%; terendah: Meeting Room Delta 41% (sebagian karena maintenance).
      <br>• Puncak pemakaian: Selasa–Kamis pukul 09.00–11.00 dengan okupansi rata-rata 88%.
      <br><br><b>Rekomendasi:</b> geser rapat rutin internal ke sesi siang (13.00–15.00) untuk meredakan kepadatan pagi, dan pertimbangkan realokasi Meeting Room Delta ke unit Produksi yang sering kekurangan ruang.`,
    aset: `Saya menemukan <b>4 aset idle</b> lebih dari 90 hari dengan total nilai buku Rp 532 juta:
      <br><br>• FTIR Nicolet iS20 — 94 hari, Rp 470 Jt → tawarkan sebagai jasa uji eksternal.
      <br>• Proyektor Epson EB-L520U — 103 hari, Rp 28,8 Jt → masukkan ke pool add-on sewa.
      <br>• Meja Rapat Modular — 96 hari, Rp 23,2 Jt → pindahkan ke Gedung D.
      <br>• Laptop Lenovo ThinkPad T14 — 128 hari, Rp 9,75 Jt → perbaiki lalu realokasi.
      <br><br>Potensi tambahan pendapatan bila FTIR dikomersialkan: sekitar <b>Rp 8–12 juta per bulan</b>.`,
    maintenance: `Status maintenance dan kalibrasi saat ini:
      <br><br>• <b>3 alat overdue kalibrasi</b>: HVS TE-5170, Autoclave 100L, Climatic Chamber 250L — ketiganya otomatis diblokir dari reservasi.
      <br>• <b>3 resource diblokir maintenance</b>, salah satunya Meeting Room Delta hingga ${UI.fdate(DB.shift(2), "short")}.
      <br>• Biaya maintenance Agustus <b>Rp 62 juta</b>, tertinggi dalam 6 bulan, didorong perbaikan Climatic Chamber (Rp 38 Jt).
      <br><br><b>Peringatan:</b> Climatic Chamber telah 4× diperbaiki dengan total biaya Rp 52 juta terhadap nilai aset Rp 320 juta (16%). Saya sarankan evaluasi <i>replace vs repair</i>.`,
    mom: `Berikut draf Minutes of Meeting untuk <b>Rapat Koordinasi Mingguan Fasilitas</b>:
      <br><br><b>Keputusan</b><br>1. Meeting Room Delta ditargetkan selesai renovasi ${UI.fdate(DB.shift(2), "short")}.<br>2. Tarif auditorium dinaikkan menjadi Rp 12,5 juta/hari efektif bulan depan.<br>3. Audit aset Semester I diperpanjang 14 hari.
      <br><br><b>Action Item</b><br>• Tommy Saputra — tuntaskan perbaikan plafon MR Delta (${UI.fdate(DB.shift(2), "short")}).<br>• Maya Lestari — perbarui daftar tarif di sistem (${UI.fdate(DB.shift(3), "short")}).<br>• Siti Nurhaliza — tindak lanjuti 6 aset tidak ditemukan (${UI.fdate(DB.shift(7), "short")}).`,
    laporan: `Ringkasan manajemen YTD 2026:
      <br><br>• Pendapatan sewa <b>Rp 490 juta</b> (81,7% dari target Rp 600 juta), tumbuh 24% YoY.
      <br>• Biaya maintenance <b>Rp 237 juta</b> (79% anggaran) — perlu pengendalian pada kuartal berjalan.
      <br>• Margin kotor <b>Rp 178 juta</b> (36,3%).
      <br>• Utilisasi rata-rata <b>74%</b>, melampaui target 70%.
      <br>• Cancellation rate <b>4,2%</b>, membaik 1 poin.
      <br><br>Kontributor pendapatan terbesar: Auditorium (54%) dan Ruang Serbaguna (23%). Laporan lengkap dapat saya susun dalam format PDF.`
  };

  function aiAnswer(q) {
    const s = q.toLowerCase();
    if (/ruang|room|cari|kapasitas|pesan|booking/.test(s)) return AI_REPLIES.ruangan;
    if (/konflik|bentrok|tabrak|conflict/.test(s)) return AI_REPLIES.konflik;
    if (/utilisasi|pemakaian|okupansi|utilization/.test(s)) return AI_REPLIES.utilisasi;
    if (/aset|idle|asset|menganggur/.test(s)) return AI_REPLIES.aset;
    if (/maintenance|kalibrasi|rusak|perawatan/.test(s)) return AI_REPLIES.maintenance;
    if (/mom|notulen|minutes|ringkas rapat/.test(s)) return AI_REPLIES.mom;
    if (/laporan|report|kinerja|kpi|pendapatan/.test(s)) return AI_REPLIES.laporan;
    return `Pertanyaan Anda saya catat. Pada purwarupa ini saya menyiapkan jawaban untuk topik:
      <b>pencarian ruangan</b>, <b>deteksi konflik jadwal</b>, <b>analisis utilisasi</b>, <b>aset idle</b>,
      <b>maintenance &amp; kalibrasi</b>, <b>draf Minutes of Meeting</b>, dan <b>ringkasan laporan manajemen</b>.
      Silakan pilih salah satu contoh perintah di panel kanan.`;
  }

  V["ai"] = {
    title: "AI Assistant",
    sub: "Pencarian, rekomendasi, deteksi konflik, analisis utilisasi, dan penyusunan laporan.",
    actions: `<button class="btn btn-sm" onclick="aiReset()">${U.icon("refresh")} Percakapan Baru</button>`,
    render() {
      const suggestions = [
        "Carikan ruangan untuk 25 orang lusa pukul 09.00–12.00 dengan proyektor",
        "Apakah ada konflik jadwal minggu ini?",
        "Analisis utilisasi ruangan 30 hari terakhir",
        "Aset mana yang idle lebih dari 90 hari?",
        "Ringkas status maintenance dan kalibrasi",
        "Buatkan draf Minutes of Meeting rapat koordinasi",
        "Susun ringkasan laporan manajemen YTD"
      ];
      return `<div class="ai-wrap">
        <div class="card chat">
          <div class="card-head">
            <div class="msg"><div class="aiav">${U.icon("sparkle", 16)}</div></div>
            <div><h3>Asisten Fasilitas &amp; Laboratorium</h3><div class="sub">Terhubung ke data booking, aset, alat, dan keuangan</div></div>
            <div class="card-tools"><span class="badge green"><i class="bdot"></i>Online</span></div>
          </div>
          <div class="chat-log" id="chatLog">${CHAT.map(msgHTML).join("")}</div>
          <div class="chat-input">
            <textarea id="chatBox" placeholder="Tanyakan sesuatu — misalnya “carikan ruangan untuk 30 orang besok pagi”…"
              onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();aiSend()}"></textarea>
            <button class="btn btn-ai" onclick="aiSend()">${U.icon("send")} Kirim</button>
          </div>
        </div>
        <div class="col gap-16">
          ${U.card("Contoh Perintah", `<div class="col gap-8">
            ${suggestions.map((s) => `<div class="suggest" onclick="aiSend(this.innerText)">${s}</div>`).join("")}</div>`)}
          ${U.card("Kemampuan AI", `<div class="col gap-10 small">
            ${[["Pencarian ruangan berdasarkan tanggal, kapasitas, fasilitas, dan anggaran", "search"],
               ["Rekomendasi ruangan dan alat yang paling sesuai", "star"],
               ["Deteksi konflik jadwal beserta alternatif penyelesaian", "shield"],
               ["Analisis utilisasi, aset idle, biaya, dan kebutuhan resource", "chart"],
               ["Ringkasan event, Minutes of Meeting, dan laporan manajemen", "doc"],
               ["Rekomendasi optimalisasi pemanfaatan fasilitas", "sparkle"]]
              .map(([t, ic]) => `<div class="row-t">${U.icon(ic, 15, "faint")}<span>${t}</span></div>`).join("")}
          </div>`)}
          <div class="alert info small">${U.icon("shield", 15)}<div>AI hanya mengakses data sesuai hak akses pengguna yang sedang login. Seluruh percakapan tercatat pada audit trail.</div></div>
        </div>
      </div>`;
    }
  };

  function msgHTML(m) {
    return m.who === "bot"
      ? `<div class="msg bot"><div class="aiav">${U.icon("sparkle", 15)}</div><div class="bub">${m.text}</div></div>`
      : `<div class="msg me"><div class="bub">${U.esc(m.text)}</div></div>`;
  }

  window.aiSend = function (preset) {
    const box = document.getElementById("chatBox");
    const q = (preset || (box && box.value) || "").trim();
    if (!q) return;
    if (box) box.value = "";
    CHAT.push({ who: "me", text: q });
    const log = document.getElementById("chatLog");
    log.innerHTML = CHAT.map(msgHTML).join("") +
      `<div class="msg bot" id="typing"><div class="aiav">${U.icon("sparkle", 15)}</div>
       <div class="bub muted">Menganalisis data…</div></div>`;
    log.scrollTop = log.scrollHeight;
    setTimeout(() => {
      CHAT.push({ who: "bot", text: aiAnswer(q) });
      log.innerHTML = CHAT.map(msgHTML).join("");
      log.scrollTop = log.scrollHeight;
    }, 700);
  };

  window.aiReset = function () {
    CHAT.length = 1;
    const log = document.getElementById("chatLog");
    if (log) log.innerHTML = CHAT.map(msgHTML).join("");
  };

  /* =======================================================================
     QR SCAN (modal global)
     ======================================================================= */
  window.qrScan = function () {
    U.modal({
      title: "Scan QR Code", sub: "Ruangan, laboratorium, alat, aset, atau booking",
      body: `<div class="center mb-16">
          <div style="width:190px;height:190px;margin:0 auto;border-radius:16px;border:2px dashed var(--border-strong);display:grid;place-items:center;background:var(--surface-2)">
            ${U.icon("qr", 52, "faint")}</div>
          <div class="small muted mt-12">Arahkan kamera ke QR code, atau masukkan kode secara manual.</div>
        </div>
        <div class="field mb-16"><label>Kode Manual</label>
          <div class="row"><input class="input mono" placeholder="Contoh: LAB-KIM-01 / BK-2026-000431">
            <button class="btn btn-primary" onclick="UI.demo('Kode dicari')">Cari</button></div></div>
        <div class="alert info small">${U.icon("eye", 15)}<div>Hasil scan menampilkan status, lokasi, PIC, kondisi, jadwal maintenance, kalibrasi, dan riwayat penggunaan resource.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Tutup</button>
             <button class="btn btn-primary" onclick="UI.closeModal();showLab('LAB-001')">Contoh Hasil Scan</button>`
    });
  };

})();
