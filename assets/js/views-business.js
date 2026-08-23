/* ==========================================================================
   FLMS — Views: Aset, Rental & Billing, Event, People, Dokumen, Laporan
   ========================================================================== */
(function () {
  const U = UI, D = DB, V = window.VIEWS;

  /* =======================================================================
     ASET — Asset Register & Asset Movement tersambung ke basis data

     Dua layar ini memakai backend Aset & BMN yang SAMA dengan Register BMN
     (lihat views-bmn.js) — Repo.aset dan AssetController. Perbedaannya cuma
     tampilan: Register BMN untuk penatausahaan formal (KIB B + studio
     label), Asset Register untuk pemakaian sehari-hari (cari, lihat, pindah
     ruangan). Keduanya membaca/menulis baris yang sama, sehingga aset yang
     didaftarkan lewat satu layar langsung terlihat di layar lain.

     PELEBARAN TABEL: `pemasok` dan `garansi_berakhir` ditambahkan pada aset
     (migrasi `tambah_pemasok_garansi_pada_assets`) — penatausahaan BMN tidak
     mengenal keduanya, tetapi layar ini sungguh membutuhkannya untuk klaim
     garansi. "Tabel yang menyusul layar, bukan layar yang dipangkas".

     PENYEDERHANAAN YANG DISENGAJA:
     - Kolom "Kategori" purwarupa (bebas teks) → uraian kode barang BMN
       (`bmn.uraian_barang`) — klasifikasi baku yang sudah ada, bukan
       kategori ad hoc yang bisa menyimpang dari kode barangnya sendiri.
     - Kolom "Lokasi" (gedung) purwarupa DIHILANGKAN, tersisa "Ruangan" saja
       — pola yang sama dengan penyederhanaan Kalender Terpadu: ruangan
       sudah menyiratkan gedungnya.
     - "Status" bukan lagi badge kode tertutup, melainkan teks bebas
       `status_penggunaan` apa adanya — kolom itu SUDAH freeform di server
       (dipakai untuk kalimat seperti "Digunakan untuk Operasional Satker",
       dan "Dihapuskan" sebagai penanda baku dari `AssetService::hapus()`),
       memaksanya jadi enum lima nilai akan bertentangan dengan pemakaian
       yang sudah ada.
     - Tombol "Buat BAST" purwarupa DIJATUHKAN — tidak ada dokumen serah
       terima bertanda tangan yang dimodelkan di server; riwayat mutasi
       adalah catatan sistem, bukan dokumen legal.
     - Tombol "Pinjamkan" mengarahkan ke modul Peminjaman Alat (layar
       terpisah, sudah tersambung penuh) alih-alih membuka form sendiri —
       satu alur peminjaman, bukan dua yang bisa menyimpang.
     ======================================================================= */

  const AST = { baris: [], ringkasan: null, memuat: true, galat: null, tapis: { cari: "", kondisi: "", status_penggunaan: "" } };
  const MOV = { baris: [], memuat: true, galat: null, tapis: { cari: "" } };

  async function muatAset() {
    AST.memuat = true; AST.galat = null; isiAset(); isiRingkasanAset();
    try {
      const [daftar, ringkasan] = await Promise.all([
        Repo.aset.daftar(AST.tapis),
        Repo.aset.ringkasan(AST.tapis)
      ]);
      AST.baris = daftar.data || [];
      AST.ringkasan = ringkasan;
    } catch (e) { AST.baris = []; AST.galat = e.message; }
    finally { AST.memuat = false; isiAset(); isiRingkasanAset(); }
  }

  function isiRingkasanAset() {
    const w = document.getElementById("astKpi");
    if (!w) return;
    const r = AST.ringkasan;
    const bermasalah = r ? (r.kondisi.find((k) => k.kode === "RB") || { jumlah: 0 }).jumlah : 0;
    w.innerHTML = `
      ${U.kpi({ label: "Total Aset", value: r ? U.num(r.jumlah) : "—", icon: "box", tint: "brand", note: "Sesuai tapisan aktif" })}
      ${U.kpi({ label: "Nilai Perolehan", value: r ? U.rpShort(r.nilai_perolehan) : "—", icon: "money", tint: "teal", note: "Harga pembelian" })}
      ${U.kpi({ label: "Nilai Buku", value: r ? U.rpShort(r.nilai_buku) : "—", icon: "chart", tint: "violet", note: "Setelah penyusutan" })}
      ${U.kpi({ label: "Rusak Berat", value: r ? U.num(bermasalah) : "—", icon: "alert", tint: "red", note: "Kondisi RB" })}
      ${U.kpi({ label: "Garansi Berakhir ≤90 Hari", value: r ? U.num(r.garansi_akan_berakhir) : "—", icon: "shield", tint: "amber", note: "Perlu perpanjangan" })}`;
  }

  function isiAset() {
    const w = document.getElementById("astTabel");
    if (!w) return;
    if (AST.memuat) { w.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (AST.galat) { w.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div><b>Gagal memuat.</b><br><span class="small">${U.esc(AST.galat)}</span></div></div>`; return; }
    if (!AST.baris.length) { w.innerHTML = U.emptyState("Belum ada aset terdaftar", "Daftarkan lewat Register BMN."); return; }
    w.innerHTML = U.table([
      { t: "Kode Internal", w: "150px", render: (a) => `<span class="lnk mono" onclick="showAsset(${JSON.stringify(a.id)})">${U.esc(a.kode_internal || "—")}</span>` },
      { t: "Nama Aset", render: (a) => `<b>${U.esc(a.nama)}</b><div class="tiny faint">${U.esc(a.merk || "—")}${a.serial_number ? " • SN " + U.esc(a.serial_number) : ""}</div>` },
      { t: "Kategori", render: (a) => `<span class="badge outline">${U.esc(a.bmn.uraian_barang || a.bmn.kode_barang)}</span>` },
      { t: "Ruangan", render: (a) => a.ruangan ? U.esc(a.ruangan.nama) : `<span class="faint">—</span>` },
      { t: "Penanggung Jawab", render: (a) => a.penanggung_jawab ? `<span class="small">${U.esc(a.penanggung_jawab.nama)}</span>` : `<span class="faint">—</span>` },
      { t: "Nilai Buku", cls: "right", render: (a) => U.rp(a.penyusutan.nilai_buku) },
      { t: "Kondisi", render: (a) => U.badge(a.kondisi.nama) },
      { t: "Status", render: (a) => `<span class="small">${U.esc(a.status_penggunaan || "—")}</span>` },
      { t: "", cls: "actions", render: (a) => `<button class="icon-btn" onclick="showAsset(${JSON.stringify(a.id)})">${U.icon("eye", 15)}</button>` }
    ], AST.baris);
  }

  window.astTapis = function (field, value) {
    AST.tapis[field] = value;
    muatAset();
  };

  V["assets"] = {
    title: "Asset Register",
    sub: "Registrasi lengkap aset: identitas, nilai, lokasi, PIC, kondisi, dan dokumen.",
    actions: `<button class="btn btn-sm" onclick="location.hash='#/bmn'">${U.icon("plus")} Registrasi Aset</button>`,
    render() {
      return `
        <div class="grid g5 mb-16" id="astKpi"></div>
        ${U.card("", `<div class="tbl-toolbar">
          <div class="tbl-search">${U.icon("search", 15, "faint")}
            <input id="astCari" placeholder="Cari nama, kode internal, atau serial number…"></div>
          <select class="select" style="width:auto" onchange="astTapis('kondisi', this.value)">
            <option value="">Semua Kondisi</option>
            <option value="B">Baik</option><option value="RR">Rusak Ringan</option><option value="RB">Rusak Berat</option></select>
          <select class="select" style="width:auto" onchange="astTapis('status_penggunaan', this.value)">
            <option value="">Semua Status</option>
            <option value="Digunakan untuk Operasional Satker">Digunakan</option>
            <option value="Dihapuskan">Dihapuskan</option></select>
          <div class="spacer"></div>
        </div><div id="astTabel"></div>`, { bodyCls: "flush" })}`;
    },
    mount() {
      const cari = document.getElementById("astCari");
      if (cari) {
        cari.value = AST.tapis.cari || "";
        let jeda;
        cari.addEventListener("input", function () {
          clearTimeout(jeda);
          jeda = setTimeout(() => astTapis("cari", cari.value.trim()), 300);
        });
      }
      muatAset();
    }
  };

  window.showAsset = async function (id) {
    U.drawer({ size: "wide", title: "Memuat…", body: `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`, foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>` });

    let a, foto, riwayat;
    try {
      [a, foto, riwayat] = await Promise.all([
        Repo.aset.ambil(id),
        Repo.aset.foto(id).then((j) => j.data).catch(() => []),
        Repo.aset.riwayat(id).then((j) => j.data).catch(() => [])
      ]);
    } catch (e) { Repo.tampilkanGalat(e, "Gagal memuat aset"); UI.closeDrawer(); return; }
    if (!a) { UI.closeDrawer(); return; }

    U.drawer({
      size: "wide", title: a.nama, sub: (a.kode_internal || a.bmn.id) + " • " + (a.bmn.uraian_barang || a.bmn.kode_barang),
      body: `
        <div class="row gap-16 mb-16">
          <div class="thumb" style="width:170px;flex:0 0 170px;aspect-ratio:4/3">${foto.length ? `<img src="${U.esc(foto[0].url || "")}" style="width:100%;height:100%;object-fit:cover">` : `<div class="lbl">${U.esc(a.bmn.uraian_barang || "Aset")}</div>`}</div>
          <div style="flex:1">
            <div class="row wrap gap-6 mb-12">${U.badge(a.status_penggunaan || "—")}${U.badge(a.kondisi.nama)}</div>
            <div class="dl small" style="grid-template-columns:130px 1fr">
              <dt>Serial Number</dt><dd class="mono">${U.esc(a.serial_number || "—")}</dd>
              <dt>Merk / Tipe</dt><dd>${U.esc([a.merk, a.tipe].filter(Boolean).join(" — ") || "—")}</dd>
              <dt>Pemasok</dt><dd>${U.esc(a.pemasok || "—")}</dd>
              <dt>Garansi s/d</dt><dd>${a.garansi_berakhir
                ? (new Date(a.garansi_berakhir) > new Date()
                    ? `<span class="badge green">${U.fdate(a.garansi_berakhir, "short")}</span>`
                    : `<span class="badge red">Berakhir ${U.fdate(a.garansi_berakhir, "short")}</span>`)
                : `<span class="faint">—</span>`}</dd>
            </div>
          </div>
        </div>
        <div class="grid g3 mb-16" style="gap:10px">
          ${[["Harga Perolehan", U.rp(a.penyusutan.nilai_perolehan)], ["Nilai Buku", U.rp(a.penyusutan.nilai_buku)], ["Akumulasi Penyusutan", U.rp(a.penyusutan.akumulasi_penyusutan)]]
            .map(([k, v]) => `<div class="card"><div class="card-body tight center"><div class="tiny faint">${k}</div><b>${v}</b></div></div>`).join("")}
        </div>
        <div class="dl mb-16">
          <dt>Ruangan</dt><dd>${a.ruangan ? U.esc(a.ruangan.nama) : "—"}</dd>
          <dt>Penanggung Jawab</dt><dd>${a.penanggung_jawab ? U.esc(a.penanggung_jawab.nama) : "—"}</dd>
        </div>
        <h4 class="mb-8 muted">RIWAYAT PERGERAKAN ASET</h4>
        ${riwayat.length ? `<div class="tline">
          ${riwayat.map((r) => `<div class="tline-item ok"><div class="tt">${U.esc(r.jenis_nama)}${r.dari || r.ke ? ": " + U.esc(r.dari || "—") + " → " + U.esc(r.ke || "—") : ""}</div>
            <div class="tm">${U.fdate(r.waktu, "long")}${r.oleh ? " • " + U.esc(r.oleh.nama) : ""}${r.catatan ? " • " + U.esc(r.catatan) : ""}</div></div>`).join("")}
        </div>` : `<div class="empty" style="padding:20px"><span class="small muted">Belum ada riwayat perubahan.</span></div>`}`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             ${Repo.dapatMenulis() ? `<button class="btn" onclick="astMutasiForm(${JSON.stringify(a.id)})">${U.icon("send")} Mutasi</button>` : ""}
             <div class="spacer"></div>
             <button class="btn btn-primary" onclick="UI.closeDrawer();location.hash='#/eqbooking'">Pinjamkan</button>`
    });
  };

  window.astMutasiForm = async function (id) {
    let ruangan = [];
    try { ruangan = (await Repo.ruangan.daftar()).data || []; } catch (e) { /* pemilih tetap dibuka kosong */ }
    U.modal({
      title: "Pindahkan Aset", sub: "Perpindahan ruangan tercatat pada riwayat aset",
      body: `
        <div id="astMovGalat" class="alert err mb-16" hidden></div>
        <label class="fld"><span>Ruangan Tujuan</span>
          <select class="select" id="astMovRoom">
            <option value="">— keluarkan dari ruangan —</option>
            ${ruangan.map((r) => `<option value="${r.id}">${U.esc(r.nama)}</option>`).join("")}
          </select></label>
        <label class="fld mt-8"><span>Catatan</span><textarea class="textarea" id="astMovCatatan" placeholder="Alasan perpindahan…"></textarea></label>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-primary" onclick="astMutasiSimpan(${JSON.stringify(id)})">Pindahkan</button>`
    });
  };

  window.astMutasiSimpan = async function (id) {
    const roomVal = document.getElementById("astMovRoom").value;
    const catatan = document.getElementById("astMovCatatan").value.trim();
    try {
      await Repo.aset.mutasi(id, { room_id: roomVal ? Number(roomVal) : null, catatan: catatan || undefined });
      UI.closeModal(); UI.closeDrawer();
      UI.toast("Aset dipindahkan", "Riwayat perubahan tercatat.");
      muatAset();
    } catch (e) {
      const el = document.getElementById("astMovGalat");
      if (el) { el.hidden = false; el.innerHTML = `${U.icon("alert", 15)}<div>${U.esc(e.message || "Gagal memindahkan aset")}</div>`; }
    }
  };

  async function muatMutasiAset() {
    MOV.memuat = true; MOV.galat = null; isiMutasiAset();
    try {
      const j = await Repo.aset.mutasiSemua(MOV.tapis);
      MOV.baris = j.data || [];
    } catch (e) { MOV.baris = []; MOV.galat = e.message; }
    finally { MOV.memuat = false; isiMutasiAset(); }
  }

  function isiMutasiAset() {
    const w = document.getElementById("movTabel");
    if (!w) return;
    if (MOV.memuat) { w.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (MOV.galat) { w.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div><b>Gagal memuat.</b><br><span class="small">${U.esc(MOV.galat)}</span></div></div>`; return; }
    if (!MOV.baris.length) { w.innerHTML = U.emptyState("Belum ada riwayat mutasi", Repo.dapatMenulis() ? "" : "Masuk dengan akun untuk melihat riwayat."); return; }
    w.innerHTML = U.table([
      { t: "Aset", render: (r) => r.aset ? `<b>${U.esc(r.aset.nama)}</b><div class="tiny faint mono">${U.esc(r.aset.kode_internal || "—")}</div>` : `<span class="faint">—</span>` },
      { t: "Perubahan", render: (r) => `<span class="badge outline">${U.esc(r.jenis_nama)}</span>` },
      { t: "Dari", render: (r) => U.esc(r.dari || "—") },
      { t: "", w: "30px", cls: "center", render: () => `<span class="faint">${U.icon("chev", 14)}</span>` },
      { t: "Ke", render: (r) => U.esc(r.ke || "—") },
      { t: "Waktu", render: (r) => U.fdate(r.waktu, "short") },
      { t: "Oleh", render: (r) => r.oleh ? U.esc(r.oleh.nama) : `<span class="faint">Sistem</span>` },
      { t: "Catatan", render: (r) => r.catatan ? `<span class="small">${U.esc(r.catatan)}</span>` : `<span class="faint">—</span>` }
    ], MOV.baris);
  }

  V["assetmovement"] = {
    title: "Asset Movement & Mutasi",
    sub: "Riwayat perpindahan ruangan, kondisi, penanggung jawab, dan status penggunaan aset.",
    render() {
      return `${U.card("", `<div class="tbl-toolbar">
        <div class="tbl-search">${U.icon("search", 15, "faint")}
          <input id="movCari" placeholder="Cari nama atau kode internal aset…"></div>
        <div class="spacer"></div>
      </div><div id="movTabel"></div>`, { bodyCls: "flush" })}`;
    },
    mount() {
      const cari = document.getElementById("movCari");
      if (cari) {
        cari.value = MOV.tapis.cari || "";
        let jeda;
        cari.addEventListener("input", function () {
          clearTimeout(jeda);
          jeda = setTimeout(() => { MOV.tapis.cari = cari.value.trim(); muatMutasiAset(); }, 300);
        });
      }
      muatMutasiAset();
    }
  };

  /* =======================================================================
     assetloan & assetaudit TETAP PURWARUPA — sengaja tidak disambungkan
     pada iterasi ini.

     assetloan ("Peminjaman & Pengembalian") menaungi domain yang SAMA
     dengan modul Peminjaman Alat yang sudah tersambung penuh (V["eqbooking"]
     di views-core.js, Repo.peminjaman, EquipmentLoan yang belongsTo Asset
     persis seperti aset di layar ini) — menyambungkannya lagi di sini
     berarti dua layar menulis ke tabel yang sama lewat dua alur berbeda,
     yang berisiko menyimpang. Peminjaman aset diarahkan ke sana lewat
     tombol "Pinjamkan" pada showAsset(), bukan diduplikasi.

     assetaudit ("Audit Aset" — stock opname berbasis scan QR/RFID dengan
     sesi audit, progres per lokasi, dan rekonsiliasi temuan) BUKAN
     penyambungan ulang data yang sudah ada — ini domain baru sepenuhnya:
     tidak ada tabel sesi audit, tidak ada status "terverifikasi/selisih/
     tidak ditemukan" per aset per sesi. Dijatuhkan dengan sengaja untuk
     iterasi ini, bukan dipangkas diam-diam.
     ======================================================================= */

  V["assetloan"] = {
    title: "Peminjaman & Pengembalian",
    sub: "Alur Request → Approval → Handover → Usage → Return → Inspection → Close.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Scan QR untuk serah terima')">${U.icon("qr")} Scan Serah Terima</button>
              <button class="btn btn-primary btn-sm" onclick="UI.demo('Form peminjaman baru')">${U.icon("plus")} Ajukan Peminjaman</button>`,
    render() {
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Sedang Dipinjam", value: D.loans.filter((l) => l.status === "Dipinjam").length, icon: "box", tint: "brand", note: "Aset & alat" })}
          ${U.kpi({ label: "Terlambat", value: D.loans.filter((l) => l.status === "Terlambat").length, icon: "alert", tint: "red", note: "Melewati jatuh tempo" })}
          ${U.kpi({ label: "Menunggu Inspeksi", value: D.loans.filter((l) => l.status === "Inspeksi").length, icon: "eye", tint: "amber", note: "Cek kondisi pengembalian" })}
          ${U.kpi({ label: "Selesai Bulan Ini", value: D.loans.filter((l) => l.status === "Selesai").length, icon: "check", tint: "green", note: "Tercatat BAST" })}
        </div>
        <div class="card mb-16"><div class="card-body">
          ${U.stepper(["Request", "Approval", "Handover", "Usage", "Return", "Inspection", "Close"], 3)}
          <div class="small muted mt-12">Setiap tahap wajib disertai bukti: form peminjaman, berita acara, checklist kondisi, bukti serah terima, serta foto sebelum dan sesudah penggunaan.</div>
        </div></div>
        ${U.card("Daftar Peminjaman", U.toolbar({ ph: "Cari peminjaman…", filters: [["Semua Jenis", "Alat", "Aset"], ["Semua Status", "Dipinjam", "Terlambat", "Inspeksi", "Selesai"]] }) +
          U.table([
            { t: "No. Peminjaman", w: "150px", render: (l) => `<span class="lnk mono" onclick="showLoan('${l.id}')">${l.id}</span>` },
            { t: "Item", render: (l) => `<b>${U.esc(l.itemName)}</b><div class="tiny faint">${U.esc(l.type)} • ${l.item}</div>` },
            { t: "Peminjam", render: (l) => `<div class="row"><span class="avatar sm">${U.initials(D.personName(l.borrower))}</span><div><div class="small">${U.esc(D.personName(l.borrower))}</div><div class="tiny faint">${U.esc(l.unit)}</div></div></div>` },
            { t: "Keluar", render: (l) => U.fdate(l.out, "short") },
            { t: "Jatuh Tempo", render: (l) => { const late = l.back === "-" && l.due < D.shift(0);
                return `<span class="${late ? "bold" : ""}" style="${late ? "color:var(--red-500)" : ""}">${U.fdate(l.due, "short")}</span>`; } },
            { t: "Kembali", render: (l) => l.back === "-" ? `<span class="faint">—</span>` : U.fdate(l.back, "short") },
            { t: "Status", render: (l) => U.badge(l.status) },
            { t: "", cls: "actions", render: (l) => `<button class="btn btn-sm" onclick="showLoan('${l.id}')">Proses</button>` }
          ], D.loans), { bodyCls: "flush" })}`;
    }
  };

  window.showLoan = function (id) {
    const l = D.loans.find((x) => x.id === id);
    const step = { "Dipinjam": 3, "Terlambat": 3, "Inspeksi": 5, "Selesai": 6 }[l.status] || 2;
    U.drawer({
      size: "wide", title: "Peminjaman " + l.itemName, sub: l.id + " • " + l.type,
      body: `
        <div class="mb-16">${U.stepper(["Request", "Approval", "Handover", "Usage", "Return", "Inspection", "Close"], step)}</div>
        ${l.status === "Terlambat" ? `<div class="alert err mb-16">${U.icon("alert", 17)}<div><b>Pengembalian terlambat</b>
          Jatuh tempo ${U.fdate(l.due, "long")}. Pengingat otomatis telah dikirim ke peminjam dan atasan.</div></div>` : ""}
        <div class="dl mb-16">
          <dt>Item</dt><dd>${U.esc(l.itemName)} <span class="mono muted">(${l.item})</span></dd>
          <dt>Peminjam</dt><dd>${U.esc(D.personName(l.borrower))} — ${U.esc(l.unit)}</dd>
          <dt>Diserahkan oleh</dt><dd>${U.esc(D.personName(l.handover))}</dd>
          <dt>Tanggal Keluar</dt><dd>${U.fdate(l.out, "long")}</dd>
          <dt>Jatuh Tempo</dt><dd>${U.fdate(l.due, "long")}</dd>
          <dt>Tanggal Kembali</dt><dd>${l.back === "-" ? "—" : U.fdate(l.back, "long")}</dd>
          <dt>Status</dt><dd>${U.badge(l.status)}</dd>
        </div>
        <div class="grid g2 mb-16">
          ${U.card("Kondisi Saat Diserahkan", `<div class="thumb mb-12" style="aspect-ratio:16/10"><div class="lbl">Foto Sebelum</div></div>
            <div class="row">${U.badge(l.cond0)}<div class="spacer"></div><span class="small muted">Checklist 12/12 poin</span></div>`)}
          ${U.card("Kondisi Saat Dikembalikan", l.cond1 !== "-" ? `<div class="thumb mb-12" style="aspect-ratio:16/10"><div class="lbl">Foto Sesudah</div></div>
            <div class="row">${U.badge(l.cond1)}<div class="spacer"></div><span class="small muted">Checklist 12/12 poin</span></div>`
            : `<div class="empty" style="padding:26px"><div class="eico">${U.icon("clock", 22)}</div><b>Belum dikembalikan</b>
               <div class="small">Foto dan checklist diisi saat proses pengembalian.</div></div>`)}
        </div>
        ${U.card("Dokumen Terkait", U.table([
          { t: "Dokumen", render: (d) => `<b>${U.esc(d.n)}</b>` },
          { t: "Status", render: (d) => U.badge(d.s) },
          { t: "", cls: "actions", render: () => `<button class="btn btn-sm" onclick="UI.demo('Unduh dokumen PDF')">${U.icon("download", 12)} Unduh</button>` }
        ], [{ n: "Form Peminjaman", s: "Ditandatangani" }, { n: "Checklist Kondisi Awal", s: "Ditandatangani" },
            { n: "Bukti Serah Terima (BAST)", s: "Ditandatangani" },
            { n: "Berita Acara Pengembalian", s: l.back === "-" ? "Draft" : "Ditandatangani" }]), { bodyCls: "flush" })}`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <div class="spacer"></div>
             <button class="btn" onclick="UI.demo('Kirim pengingat ke peminjam')">${U.icon("bell")} Ingatkan</button>
             <button class="btn btn-primary" onclick="UI.demo('Proses pengembalian & inspeksi')">Proses Pengembalian</button>`
    });
  };

  V["assetaudit"] = {
    title: "Audit Aset",
    sub: "Stock opname berbasis scan QR/RFID dengan rekonsiliasi otomatis.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Mode scan QR/RFID')">${U.icon("qr")} Mulai Scan</button>
              <button class="btn btn-primary btn-sm" onclick="UI.demo('Buat sesi audit baru')">${U.icon("plus")} Sesi Audit Baru</button>`,
    render() {
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Aset Tercatat", value: U.num(1284), icon: "box", tint: "brand", note: "Populasi audit" })}
          ${U.kpi({ label: "Sudah Diverifikasi", value: U.num(1147), icon: "check", tint: "green", note: "89,3% dari total" })}
          ${U.kpi({ label: "Selisih Ditemukan", value: 23, icon: "alert", tint: "amber", note: "Lokasi tidak sesuai" })}
          ${U.kpi({ label: "Tidak Ditemukan", value: 6, icon: "x", tint: "red", note: "Perlu investigasi" })}
        </div>
        <div class="grid g-2-1 mb-16">
          ${U.card("Progres Audit per Lokasi", `<div class="col gap-12">
            ${[["Gedung A — Riset", 94], ["Gedung B — Perkantoran", 91], ["Gedung C — Auditorium", 88], ["Gedung D — Workshop", 76], ["Gudang Pusat", 82]]
              .map(([n, v]) => U.meter(`<span class="small">${n}</span>`, v, v > 90 ? "var(--green-500)" : v > 80 ? "var(--brand-500)" : "var(--amber-500)")).join("")}
          </div>`, { sub: "Audit Semester I 2026 — berakhir " + U.fdate(D.shift(14), "long") })}
          ${U.card("Ringkasan Temuan", `<div class="col gap-10">
            ${[["Sesuai catatan", 1118, "green"], ["Lokasi berbeda", 17, "amber"], ["Kondisi berbeda", 6, "amber"], ["Tidak ditemukan", 6, "red"], ["Belum diaudit", 137, "slate"]]
              .map(([k, v, c]) => `<div class="row"><span class="badge ${c}">${k}</span><div class="spacer"></div><b>${U.num(v)}</b></div>`).join("")}
          </div>`)}
        </div>
        ${U.card("Temuan Audit", U.table([
          { t: "Kode Aset", render: (r) => `<span class="mono small">${r.c}</span>` },
          { t: "Nama Aset", render: (r) => `<b>${U.esc(r.n)}</b>` },
          { t: "Lokasi Tercatat", render: (r) => U.esc(r.l0) },
          { t: "Lokasi Aktual", render: (r) => r.l1 ? U.esc(r.l1) : `<span style="color:var(--red-500)">Tidak ditemukan</span>` },
          { t: "Temuan", render: (r) => U.badge(r.t) },
          { t: "Auditor", render: (r) => `<span class="small">${U.esc(r.a)}</span>` },
          { t: "", cls: "actions", render: () => `<button class="btn btn-sm" onclick="UI.demo('Tindak lanjut temuan')">Tindak Lanjut</button>` }
        ], [
          { c: "AST-IT-0139", n: "Laptop Lenovo ThinkPad T14", l0: "GB-2 / MR-001", l1: "Workshop Servis", t: "Lokasi berbeda", a: "Siti Nurhaliza" },
          { c: "AST-FR-0142", n: "Meja Rapat Modular 16 Seat", l0: "GB-2 / MR-001", l1: "GD-1 / WS-001", t: "Lokasi berbeda", a: "Siti Nurhaliza" },
          { c: "AST-AV-0118", n: "Microphone Wireless Shure (4 unit)", l0: "GC-1 / AU-001", l1: "", t: "Tidak ditemukan", a: "Fajar Ramadhan" },
          { c: "AST-IT-0094", n: "Monitor Dell 24\" (2 unit)", l0: "GA-3 / LAB-006", l1: "GA-3 / LAB-003", t: "Lokasi berbeda", a: "Bayu Prakoso" },
          { c: "AST-HV-0135", n: "AC Presisi 5PK Precision", l0: "GA-3 / LAB-003", l1: "GA-3 / LAB-003", t: "Kondisi berbeda", a: "Tommy Saputra" }
        ]), { bodyCls: "flush" })}`;
    }
  };

  /* =======================================================================
     RENTAL & BILLING — tersambung ke basis data

     Enam layar purwarupa dipetakan ke lima sumber server lewat Repo.tarif /
     Repo.penyewaan / Repo.penawaran / Repo.tagihan / Repo.pembayaran — lihat
     catatan desain di repo.js tepat sebelum kelima modul itu.

     PENYEDERHANAAN YANG DISENGAJA: alur 9 tahap purwarupa (Pilih Fasilitas →
     … → Berita Acara) adalah dekorasi funnel, bukan status yang benar-benar
     tersimpan — server hanya punya 5 status penyewaan (draf/dikonfirmasi/
     berjalan/selesai/dibatalkan). Halaman tersambung menampilkan status
     sungguhan itu apa adanya, tanpa memaksakan 9 tahap yang tidak berpadanan
     dengan skema — pola yang sama dengan Dashboard mengganti seret-lepas
     dengan tombol naik/turun.
     ======================================================================= */

  const RTL = { baris: [], memuat: true, galat: null };
  const TRF = { tarif: [], addon: [], memuat: true, galat: null };
  const PKG = { baris: [], memuat: true, galat: null };
  const QUO = { baris: [], memuat: true, galat: null };
  const INV = { baris: [], memuat: true, galat: null };
  const PAY = { baris: [], memuat: true, galat: null };

  const STATUS_RTL_TINT = { draf: "slate", dikonfirmasi: "brand", berjalan: "amber", selesai: "green", dibatalkan: "red" };
  const STATUS_QUO_TINT = { terkirim: "brand", negosiasi: "amber", disetujui: "green", ditolak: "red" };
  const STATUS_INV_TINT = { terbit: "amber", sebagian: "brand", lunas: "green", dibatalkan: "slate" };
  const STATUS_PAY_TINT = { menunggu_verifikasi: "amber", terverifikasi: "green" };

  /* --------------------------------------------------------------- rental */

  async function muatPenyewaan() {
    RTL.memuat = true; RTL.galat = null; isiPenyewaan();
    try {
      const j = await Repo.penyewaan.daftar();
      RTL.baris = (j.data && j.data.data) || [];
    } catch (e) { RTL.baris = []; RTL.galat = e.message; }
    finally { RTL.memuat = false; isiPenyewaan(); isiRingkasanPenyewaan(); }
  }

  function isiPenyewaan() {
    const wadah = document.getElementById("rtlDaftar");
    if (!wadah) return;
    if (RTL.memuat) { wadah.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (RTL.galat) { wadah.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div><b>Gagal memuat.</b><br><span class="small">${U.esc(RTL.galat)}</span></div></div>`; return; }
    if (!RTL.baris.length) { wadah.innerHTML = U.emptyState("Belum ada permohonan sewa", Repo.dapatMenulis() ? "" : "Masuk dengan akun untuk mengajukan."); return; }
    wadah.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Penyewa</th><th>Fasilitas</th><th>Jadwal</th><th>Status</th><th></th></tr></thead>
      <tbody>${RTL.baris.map((r) => `<tr>
        <td><b class="small">${U.esc(r.penyewa)}</b>${r.instansi ? `<div class="tiny faint">${U.esc(r.instansi)}</div>` : ""}</td>
        <td>${r.ruangan ? U.esc(r.ruangan.nama) : r.laboratorium ? U.esc(r.laboratorium.nama) : "—"}</td>
        <td>${U.fdate(r.mulai, "short")}<div class="tiny faint">s/d ${U.fdate(r.selesai, "short")}</div></td>
        <td><span class="badge ${STATUS_RTL_TINT[r.status.kode] || "slate"}">${U.esc(r.status.nama)}</span></td>
        <td class="actions">${Repo.dapatMenulis() ? `
          <button class="btn btn-sm" onclick="rtlBuatPenawaran(${r.id})">Penawaran</button>
          <button class="btn btn-sm" onclick="rtlTagihLangsung(${r.id})">Tagih</button>` : ""}</td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function isiRingkasanPenyewaan() {
    const wadah = document.getElementById("rtlKpi");
    if (!wadah) return;
    const b = RTL.baris;
    const aktif = b.filter((r) => r.status.kode === "dikonfirmasi" || r.status.kode === "berjalan").length;
    wadah.innerHTML = `
      ${U.kpi({ label: "Permohonan", value: b.length, icon: "doc", tint: "brand", note: "Seluruh status" })}
      ${U.kpi({ label: "Aktif", value: aktif, icon: "clock", tint: "amber", note: "Dikonfirmasi/berjalan" })}
      ${U.kpi({ label: "Selesai", value: b.filter((r) => r.status.kode === "selesai").length, icon: "check", tint: "green", note: "Penyewaan tuntas" })}
      ${U.kpi({ label: "Dibatalkan", value: b.filter((r) => r.status.kode === "dibatalkan").length, icon: "x", tint: "red", note: "Tidak jadi berlangsung" })}`;
  }

  V["rental"] = {
    title: "Permohonan Sewa Fasilitas",
    sub: "Penyewaan ruangan/laboratorium oleh klien internal maupun eksternal.",
    get actions() {
      return Repo.dapatMenulis() ? `<button class="btn btn-primary btn-sm" onclick="rtlForm()">${U.icon("plus")} Permohonan Baru</button>` : "";
    },
    render() {
      return `<div class="grid g4 mb-16" id="rtlKpi"></div>
        ${U.card("Daftar Permohonan Sewa", `<div id="rtlDaftar"></div>`, { bodyCls: "flush" })}`;
    },
    mount() { muatPenyewaan(); }
  };

  window.rtlForm = async function () {
    if (!Repo.dapatMenulis()) { U.toast("Tidak tersedia", "Mengajukan permohonan hanya bisa setelah masuk dengan akun."); return; }
    let ruangan = [], lab = [];
    try {
      [ruangan, lab] = await Promise.all([
        Repo.ruangan.daftar().then((j) => j.data).catch(() => []),
        Repo.laboratorium.daftar().then((j) => j.data).catch(() => [])
      ]);
    } catch (e) { /* pemilih tetap dibuka kosong */ }

    U.drawer({
      title: "Permohonan Sewa Baru", sub: "Data penyewa dan fasilitas yang diminta",
      body: `
        <div id="rtlFormGalat" class="alert err mb-16" hidden></div>
        <label class="fld"><span>Nama Penyewa *</span><input class="input" id="rtlPenyewa"></label>
        <div class="grid g2 gap-12 mt-8">
          <label class="fld"><span>Instansi</span><input class="input" id="rtlInstansi"></label>
          <label class="fld"><span>Kontak</span><input class="input" id="rtlKontak"></label>
        </div>
        <div class="grid g2 gap-12 mt-8">
          <label class="fld"><span>Email</span><input type="email" class="input" id="rtlEmail"></label>
          <label class="fld"><span>Segmen</span>
            <select class="select" id="rtlSegmen">
              <option value="umum">Umum</option><option value="internal">Internal</option><option value="pemerintah">Pemerintah</option>
            </select></label>
        </div>
        <label class="fld mt-8"><span>Jenis Target *</span>
          <select class="select" id="rtlJenisTarget" onchange="rtlGantiTarget()">
            <option value="room_id">Ruangan</option><option value="laboratory_id">Laboratorium</option>
          </select></label>
        <label class="fld mt-8" id="rtlTargetWadah">
          <select class="select" id="rtlTarget">
            <option value="">— pilih ruangan —</option>
            ${ruangan.map((r) => `<option value="${U.esc(String(r.id))}">${U.esc(r.nama)}</option>`).join("")}
          </select></label>
        <div class="grid g2 gap-12 mt-8">
          <label class="fld"><span>Mulai *</span><input type="datetime-local" class="input" id="rtlMulai"></label>
          <label class="fld"><span>Selesai *</span><input type="datetime-local" class="input" id="rtlSelesai"></label>
        </div>
        <label class="fld mt-8"><span>Keperluan</span><textarea class="input" id="rtlKeperluan" rows="2"></textarea></label>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" id="rtlFormSimpan" onclick="rtlFormSimpan()">Simpan</button>`
    });
    window.__rtlPilihan = { room_id: ruangan, laboratory_id: lab };
  };

  window.rtlGantiTarget = function () {
    const jenis = document.getElementById("rtlJenisTarget").value;
    const daftar = (window.__rtlPilihan || {})[jenis] || [];
    document.getElementById("rtlTargetWadah").innerHTML = `<span>${jenis === "room_id" ? "Ruangan" : "Laboratorium"} *</span>
      <select class="select" id="rtlTarget"><option value="">— pilih —</option>
        ${daftar.map((d) => `<option value="${U.esc(String(d.id))}">${U.esc(d.nama)}</option>`).join("")}</select>`;
  };

  window.rtlFormSimpan = async function () {
    const kotak = document.getElementById("rtlFormGalat");
    const tombol = document.getElementById("rtlFormSimpan");
    kotak.hidden = true;

    const isi = {
      penyewa: document.getElementById("rtlPenyewa").value,
      instansi: document.getElementById("rtlInstansi").value || null,
      kontak: document.getElementById("rtlKontak").value || null,
      email: document.getElementById("rtlEmail").value || null,
      segmen: document.getElementById("rtlSegmen").value,
      mulai: document.getElementById("rtlMulai").value,
      selesai: document.getElementById("rtlSelesai").value,
      keperluan: document.getElementById("rtlKeperluan").value || null
    };
    isi[document.getElementById("rtlJenisTarget").value] = Number(document.getElementById("rtlTarget").value) || null;

    tombol.disabled = true; tombol.textContent = "Menyimpan…";
    try {
      await Repo.penyewaan.buat(isi);
      U.closeDrawer();
      U.toast("Tersimpan", "Permohonan sewa berhasil diajukan.");
      muatPenyewaan();
    } catch (e) {
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan).map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else { kotak.textContent = e.message || "Gagal menyimpan."; }
      kotak.hidden = false;
    } finally { tombol.disabled = false; tombol.textContent = "Simpan"; }
  };

  window.rtlBuatPenawaran = function (rentalId) { quoForm(rentalId); };

  window.rtlTagihLangsung = async function (rentalId) {
    if (!confirm("Terbitkan tagihan langsung dari tarif aktif untuk penyewaan ini?")) return;
    try {
      await Repo.penyewaan.terbitkanTagihan(rentalId);
      U.toast("Tagihan diterbitkan", "Lihat pada halaman Invoice & Tagihan.");
    } catch (e) { Repo.tampilkanGalat(e, "Gagal menerbitkan tagihan"); }
  };

  /* ------------------------------------------------------- tarif & add-on */

  async function muatTarif() {
    TRF.memuat = true; TRF.galat = null; isiTarif();
    try {
      const [t, a] = await Promise.all([
        Repo.tarif.daftar({ jenis: "tarif" }).then((j) => j.data),
        Repo.tarif.daftar({ jenis: "addon" }).then((j) => j.data)
      ]);
      TRF.tarif = t; TRF.addon = a;
    } catch (e) { TRF.tarif = []; TRF.addon = []; TRF.galat = e.message; }
    finally { TRF.memuat = false; isiTarif(); }
  }

  function tabelTarif(baris, kosong) {
    if (!baris.length) return U.emptyState(kosong);
    return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Nama</th><th>Fasilitas</th><th>Satuan</th><th>Segmen</th><th class="right">Harga</th><th>Status</th></tr></thead>
      <tbody>${baris.map((t) => `<tr>
        <td><b class="small">${U.esc(t.nama)}</b></td>
        <td>${t.sumber_daya ? U.esc(t.sumber_daya.nama) : `<span class="faint">—</span>`}</td>
        <td>${U.esc(t.satuan_waktu.nama)}</td>
        <td><span class="badge outline">${U.esc(t.segmen.nama)}</span></td>
        <td class="right">${t.harga ? U.rp(t.harga) : `<span class="badge teal">Gratis</span>`}</td>
        <td>${t.aktif ? U.badge("Aktif") : U.badge("Nonaktif")}</td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function isiTarif() {
    const wt = document.getElementById("trfTabelTarif"), wa = document.getElementById("trfTabelAddon");
    if (!wt) return;
    if (TRF.memuat) { const s = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`; wt.innerHTML = s; wa.innerHTML = s; return; }
    if (TRF.galat) { const s = `<div class="alert err">${U.icon("alert", 15)}<div>${U.esc(TRF.galat)}</div></div>`; wt.innerHTML = s; wa.innerHTML = s; return; }
    wt.innerHTML = tabelTarif(TRF.tarif, "Belum ada tarif fasilitas.");
    wa.innerHTML = tabelTarif(TRF.addon, "Belum ada tarif add-on.");
  }

  V["pricelist"] = {
    title: "Daftar Tarif",
    sub: "Konfigurasi tarif per fasilitas dan add-on, per segmen (internal/umum/pemerintah).",
    get actions() {
      return Repo.dapatMenulis() ? `<button class="btn btn-primary btn-sm" onclick="trfForm('tarif')">${U.icon("plus")} Tambah Tarif</button>` : "";
    },
    render() {
      return `${U.card("Daftar Tarif Fasilitas", `<div id="trfTabelTarif"></div>`, { bodyCls: "flush" })}
        <div class="mt-16">${U.card("Tarif Add-on",
          (Repo.dapatMenulis() ? `<div class="row" style="padding:12px 16px"><div class="spacer"></div>
            <button class="btn btn-sm" onclick="trfForm('addon')">${U.icon("plus", 12)} Tambah Add-on</button></div>` : "") +
          `<div id="trfTabelAddon"></div>`, { bodyCls: "flush" })}</div>`;
    },
    mount() { muatTarif(); }
  };

  window.trfForm = function (jenisAwal) {
    if (!Repo.dapatMenulis()) { U.toast("Tidak tersedia", "Mengelola tarif hanya bisa setelah masuk dengan akun."); return; }
    U.drawer({
      title: jenisAwal === "paket" ? "Tambah Paket Layanan" : jenisAwal === "addon" ? "Tambah Tarif Add-on" : "Tambah Tarif Fasilitas",
      body: `
        <div id="trfFormGalat" class="alert err mb-16" hidden></div>
        <input type="hidden" id="trfJenis" value="${jenisAwal}">
        <label class="fld"><span>Nama *</span><input class="input" id="trfNama"></label>
        ${jenisAwal === "tarif" ? `
          <label class="fld mt-8"><span>Jenis Target *</span>
            <select class="select" id="trfJenisTarget">
              <option value="room_id">Ruangan</option><option value="laboratory_id">Laboratorium</option>
            </select></label>
          <label class="fld mt-8"><span>ID Fasilitas *</span><input type="number" class="input" id="trfTargetId" placeholder="ID ruangan/laboratorium"></label>` : ""}
        <div class="grid g2 gap-12 mt-8">
          <label class="fld"><span>Satuan Waktu *</span>
            <select class="select" id="trfSatuan">
              <option value="jam">Per jam</option><option value="hari">Per hari</option><option value="paket" ${jenisAwal !== "tarif" ? "selected" : ""}>Per paket</option>
            </select></label>
          <label class="fld"><span>Harga (Rp) *</span><input type="number" class="input" id="trfHarga" value="0"></label>
        </div>
        <label class="fld mt-8"><span>Segmen *</span>
          <select class="select" id="trfSegmen">
            <option value="umum">Umum</option><option value="internal">Internal</option><option value="pemerintah">Pemerintah</option>
          </select></label>
        ${jenisAwal === "paket" ? `
          <label class="fld mt-8"><span>Deskripsi (apa saja yang termasuk)</span><textarea class="input" id="trfDeskripsi" rows="2"></textarea></label>
          <label class="fld mt-8"><span>Kapasitas Peserta</span><input type="number" class="input" id="trfKapasitas"></label>` : ""}`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" id="trfFormSimpan" onclick="trfFormSimpan()">Simpan</button>`
    });
  };

  window.trfFormSimpan = async function () {
    const kotak = document.getElementById("trfFormGalat");
    const tombol = document.getElementById("trfFormSimpan");
    kotak.hidden = true;
    const jenis = document.getElementById("trfJenis").value;

    const isi = {
      nama: document.getElementById("trfNama").value,
      jenis: jenis,
      satuan_waktu: document.getElementById("trfSatuan").value,
      harga: Number(document.getElementById("trfHarga").value) || 0,
      segmen: document.getElementById("trfSegmen").value
    };
    if (jenis === "tarif") {
      const targetId = Number(document.getElementById("trfTargetId").value) || null;
      isi[document.getElementById("trfJenisTarget").value] = targetId;
    }
    if (jenis === "paket") {
      isi.deskripsi = document.getElementById("trfDeskripsi").value || null;
      isi.kapasitas = Number(document.getElementById("trfKapasitas").value) || null;
    }

    tombol.disabled = true; tombol.textContent = "Menyimpan…";
    try {
      await Repo.tarif.simpan(isi);
      U.closeDrawer();
      U.toast("Tersimpan", "Tarif berhasil disimpan.");
      muatTarif(); muatPaket();
    } catch (e) {
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan).map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else { kotak.textContent = e.message || "Gagal menyimpan."; }
      kotak.hidden = false;
    } finally { tombol.disabled = false; tombol.textContent = "Simpan"; }
  };

  /* --------------------------------------------------------------- paket */

  async function muatPaket() {
    PKG.memuat = true; PKG.galat = null; isiPaket();
    try { PKG.baris = (await Repo.tarif.daftar({ jenis: "paket" })).data; }
    catch (e) { PKG.baris = []; PKG.galat = e.message; }
    finally { PKG.memuat = false; isiPaket(); }
  }

  function isiPaket() {
    const wadah = document.getElementById("pkgGrid");
    if (!wadah) return;
    if (PKG.memuat) { wadah.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (PKG.galat) { wadah.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div>${U.esc(PKG.galat)}</div></div>`; return; }
    if (!PKG.baris.length) { wadah.innerHTML = U.emptyState("Belum ada paket layanan"); return; }
    wadah.innerHTML = `<div class="grid g3">
      ${PKG.baris.map((p, i) => `<div class="card"><div class="card-body">
        <div class="row mb-12"><div class="kpi-ico tint-${["brand", "teal", "violet", "amber", "green"][i % 5]}">${U.icon("box", 17)}</div>
          <div class="spacer"></div>${p.aktif ? U.badge("Aktif") : U.badge("Nonaktif")}</div>
        <h3 class="mb-4">${U.esc(p.nama)}</h3>
        <div class="small muted mb-16" style="min-height:56px">${U.esc(p.deskripsi || "—")}</div>
        ${p.kapasitas ? `<div class="row small muted mb-12">${U.icon("users", 13)} Hingga ${p.kapasitas} peserta</div>` : ""}
        <div class="row" style="padding-top:12px;border-top:1px solid var(--border)">
          <div><div class="tiny faint">Harga Paket</div><h2>${U.rpShort(p.harga)}</h2></div>
        </div>
      </div></div>`).join("")}
    </div>`;
  }

  V["packages"] = {
    title: "Paket Layanan",
    sub: "Kombinasi fasilitas, peralatan, dan layanan dalam satu harga paket.",
    get actions() {
      return Repo.dapatMenulis() ? `<button class="btn btn-primary btn-sm" onclick="trfForm('paket')">${U.icon("plus")} Buat Paket</button>` : "";
    },
    render() { return `<div id="pkgGrid"></div>`; },
    mount() { muatPaket(); }
  };

  /* ------------------------------------------------------------ penawaran */

  async function muatPenawaran() {
    QUO.memuat = true; QUO.galat = null; isiPenawaran();
    try { QUO.baris = (await Repo.penawaran.daftar()).data; }
    catch (e) { QUO.baris = []; QUO.galat = e.message; }
    finally { QUO.memuat = false; isiPenawaran(); isiRingkasanPenawaran(); }
  }

  function isiPenawaran() {
    const wadah = document.getElementById("quoDaftar");
    if (!wadah) return;
    if (QUO.memuat) { wadah.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (QUO.galat) { wadah.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div>${U.esc(QUO.galat)}</div></div>`; return; }
    if (!QUO.baris.length) { wadah.innerHTML = U.emptyState("Belum ada penawaran"); return; }
    wadah.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>No. Penawaran</th><th>Klien</th><th>Tanggal</th><th>Berlaku s/d</th><th class="right">Nilai</th><th>Status</th><th></th></tr></thead>
      <tbody>${QUO.baris.map((q) => `<tr onclick="quoLihat(${q.id})" style="cursor:pointer">
        <td><span class="mono small">${U.esc(q.nomor)}</span></td>
        <td><b class="small">${q.penyewaan ? U.esc(q.penyewaan.penyewa) : "—"}</b></td>
        <td>${U.fdate(q.tanggal, "short")}</td>
        <td style="${q.kedaluwarsa ? "color:var(--red-500);font-weight:600" : ""}">${U.fdate(q.berlaku_sampai, "short")}${q.kedaluwarsa ? ` <span class="tiny">kedaluwarsa</span>` : ""}</td>
        <td class="right"><b>${U.rp(q.nilai.total)}</b></td>
        <td><span class="badge ${STATUS_QUO_TINT[q.status.kode] || "slate"}">${U.esc(q.status.nama)}</span></td>
        <td class="actions"><button class="icon-btn" onclick="event.stopPropagation();quoLihat(${q.id})">${U.icon("eye", 15)}</button></td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function isiRingkasanPenawaran() {
    const wadah = document.getElementById("quoKpi");
    if (!wadah) return;
    const b = QUO.baris;
    wadah.innerHTML = `
      ${U.kpi({ label: "Aktif", value: b.filter((q) => (q.status.kode === "terkirim" || q.status.kode === "negosiasi") && !q.kedaluwarsa).length, icon: "doc", tint: "brand", note: "Menunggu keputusan" })}
      ${U.kpi({ label: "Nilai Penawaran", value: U.rpShort(b.reduce((a, q) => a + q.nilai.total, 0)), icon: "money", tint: "amber", note: "Total pipeline" })}
      ${U.kpi({ label: "Disetujui", value: b.filter((q) => q.status.kode === "disetujui").length, icon: "check", tint: "green", note: "Siap diterbitkan invoice" })}
      ${U.kpi({ label: "Kedaluwarsa", value: b.filter((q) => q.kedaluwarsa).length, icon: "x", tint: "red", note: "Perlu penawaran ulang" })}`;
  }

  V["quotation"] = {
    title: "Quotation / Penawaran",
    sub: "Penawaran harga sewa fasilitas kepada klien, sebelum diterbitkan menjadi invoice.",
    get actions() {
      return Repo.dapatMenulis() ? `<button class="btn btn-primary btn-sm" onclick="quoForm()">${U.icon("plus")} Buat Quotation</button>` : "";
    },
    render() {
      return `<div class="grid g4 mb-16" id="quoKpi"></div>
        ${U.card("Daftar Quotation", `<div id="quoDaftar"></div>`, { bodyCls: "flush" })}`;
    },
    mount() { muatPenawaran(); }
  };

  window.quoLihat = async function (id) {
    U.modal({ title: "Memuat…", body: `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>` });
    let q;
    try { q = await Repo.penawaran.lihat(id); }
    catch (e) { UI.closeModal(); Repo.tampilkanGalat(e, "Gagal memuat"); return; }
    if (!q) { UI.closeModal(); return; }

    U.modal({
      size: "wide", title: "Penawaran " + q.nomor, sub: (q.penyewaan ? q.penyewaan.penyewa : "") + " • " + U.fdate(q.tanggal, "long"),
      body: `
        <div class="row mb-16" style="align-items:flex-start">
          <div><div class="brand-mark" style="background:linear-gradient(140deg,var(--brand-500),var(--teal-500))">FL</div></div>
          <div class="spacer"></div>
          <div class="right"><div class="tiny faint">NOMOR</div><div class="mono bold">${U.esc(q.nomor)}</div>
            <div class="tiny faint mt-8">BERLAKU S/D</div><div class="bold">${U.fdate(q.berlaku_sampai, "long")}</div></div>
        </div>
        <div class="row wrap gap-6 mb-16">
          <span class="badge ${STATUS_QUO_TINT[q.status.kode] || "slate"}">${U.esc(q.status.nama)}</span>
          ${q.kedaluwarsa ? `<span class="badge red">Kedaluwarsa</span>` : ""}
        </div>
        ${U.table([
          { t: "Deskripsi", render: (r) => U.esc(r.deskripsi) },
          { t: "Qty", cls: "center", render: (r) => r.kuantitas + " " + r.satuan },
          { t: "Harga", cls: "right", render: (r) => U.rp(r.harga_satuan) },
          { t: "Jumlah", cls: "right", render: (r) => `<b>${U.rp(r.subtotal)}</b>` }
        ], q.baris || [])}
        <div class="row mt-16"><div class="spacer"></div><div style="width:260px">
          <div class="row small"><span class="muted" style="flex:1">Subtotal</span><b>${U.rp(q.nilai.subtotal)}</b></div>
          <div class="row small mt-4"><span class="muted" style="flex:1">PPN ${q.nilai.ppn_persen}%</span><b>${U.rp(q.nilai.ppn)}</b></div>
          <div class="row mt-8" style="padding-top:8px;border-top:1px solid var(--border)"><span style="flex:1">Total</span><h3>${U.rp(q.nilai.total)}</h3></div>
        </div></div>
        ${q.invoice_nomor ? `<div class="alert info mt-16 small">${U.icon("doc", 15)}<div>Sudah diterbitkan sebagai invoice ${U.esc(q.invoice_nomor)}.</div></div>` : ""}
        ${q.catatan ? `<div class="small muted mt-12">${U.esc(q.catatan)}</div>` : ""}`,
      foot: `<button class="btn" onclick="UI.closeModal()">Tutup</button>
        ${Repo.dapatMenulis() && !q.kedaluwarsa && (q.status.kode === "terkirim" || q.status.kode === "negosiasi") ? `
          <button class="btn" onclick="quoPutuskan(${q.id},'ditolak')">Tolak</button>
          <button class="btn" onclick="quoPutuskan(${q.id},'negosiasi')">Negosiasi</button>
          <button class="btn btn-primary" onclick="quoPutuskan(${q.id},'disetujui')">Setujui</button>` : ""}
        ${Repo.dapatMenulis() && q.dapat_diterbitkan_invoice ? `
          <button class="btn btn-primary" onclick="quoTerbitkanInvoice(${q.id})">${U.icon("check")} Terbitkan Invoice</button>` : ""}`
    });
  };

  window.quoPutuskan = async function (id, keputusan) {
    try {
      await Repo.penawaran.putuskan(id, keputusan);
      UI.closeModal();
      U.toast("Tersimpan", "Keputusan penawaran diperbarui.");
      muatPenawaran();
    } catch (e) { Repo.tampilkanGalat(e, "Gagal memutuskan penawaran"); }
  };

  window.quoTerbitkanInvoice = async function (id) {
    try {
      await Repo.penawaran.terbitkanInvoice(id);
      UI.closeModal();
      U.toast("Invoice diterbitkan", "Lihat pada halaman Invoice & Tagihan.");
      muatPenawaran();
    } catch (e) { Repo.tampilkanGalat(e, "Gagal menerbitkan invoice"); }
  };

  window.quoForm = async function (rentalIdAwal) {
    if (!Repo.dapatMenulis()) { U.toast("Tidak tersedia", "Membuat penawaran hanya bisa setelah masuk dengan akun."); return; }
    let sewa = [];
    try { sewa = ((await Repo.penyewaan.daftar()).data || {}).data || []; } catch (e) { /* pemilih kosong */ }

    U.drawer({
      title: "Buat Quotation", sub: "Penawaran dihitung otomatis dari tarif aktif fasilitas yang dipilih",
      body: `
        <div id="quoFormGalat" class="alert err mb-16" hidden></div>
        <label class="fld"><span>Penyewaan *</span>
          <select class="select" id="quoRental">
            <option value="">— pilih penyewaan —</option>
            ${sewa.map((r) => `<option value="${U.esc(String(r.id))}" ${rentalIdAwal && Number(rentalIdAwal) === r.id ? "selected" : ""}>${U.esc(r.penyewa)} — ${U.fdate(r.mulai, "short")}</option>`).join("")}
          </select></label>
        <div class="grid g2 gap-12 mt-8">
          <label class="fld"><span>PPN (%)</span><input type="number" class="input" id="quoPpn" value="11"></label>
          <label class="fld"><span>Berlaku (hari)</span><input type="number" class="input" id="quoBerlaku" value="14"></label>
        </div>
        <div class="small muted mt-8">Baris tambahan (add-on/paket) dapat ditambahkan setelah penawaran dibuat, melalui menyunting langsung dari Invoice bila disetujui.</div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" id="quoFormSimpan" onclick="quoFormSimpan()">Simpan</button>`
    });
  };

  window.quoFormSimpan = async function () {
    const kotak = document.getElementById("quoFormGalat");
    const tombol = document.getElementById("quoFormSimpan");
    kotak.hidden = true;

    const rentalId = Number(document.getElementById("quoRental").value);
    if (!rentalId) { kotak.textContent = "Pilih penyewaan terlebih dahulu."; kotak.hidden = false; return; }

    tombol.disabled = true; tombol.textContent = "Menyimpan…";
    try {
      await Repo.penawaran.buat({
        rental_id: rentalId,
        ppn_persen: Number(document.getElementById("quoPpn").value) || 0,
        berlaku_hari: Number(document.getElementById("quoBerlaku").value) || 14
      });
      U.closeDrawer();
      U.toast("Tersimpan", "Penawaran berhasil dibuat.");
      muatPenawaran();
    } catch (e) {
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan).map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else { kotak.textContent = e.message || "Gagal menyimpan."; }
      kotak.hidden = false;
    } finally { tombol.disabled = false; tombol.textContent = "Simpan"; }
  };

  /* --------------------------------------------------------------- invoice */

  async function muatTagihan() {
    INV.memuat = true; INV.galat = null; isiTagihan();
    try { INV.baris = (await Repo.tagihan.daftar()).data; }
    catch (e) { INV.baris = []; INV.galat = e.message; }
    finally { INV.memuat = false; isiTagihan(); isiRingkasanTagihan(); }
  }

  function isiTagihan() {
    const wadah = document.getElementById("invDaftar");
    if (!wadah) return;
    if (INV.memuat) { wadah.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (INV.galat) { wadah.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div>${U.esc(INV.galat)}</div></div>`; return; }
    if (!INV.baris.length) { wadah.innerHTML = U.emptyState("Belum ada invoice"); return; }
    wadah.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>No. Invoice</th><th>Klien</th><th>Jatuh Tempo</th><th class="right">Total</th><th class="right">Sisa</th><th>Status</th><th></th></tr></thead>
      <tbody>${INV.baris.map((i) => `<tr onclick="invLihat(${i.id})" style="cursor:pointer">
        <td><span class="mono small">${U.esc(i.nomor)}</span></td>
        <td><b class="small">${i.penyewaan ? U.esc(i.penyewaan.penyewa) : "—"}</b></td>
        <td style="${i.terlewat_jatuh_tempo ? "color:var(--red-500);font-weight:600" : ""}">${U.fdate(i.jatuh_tempo, "short")}</td>
        <td class="right"><b>${U.rp(i.nilai.total)}</b></td>
        <td class="right">${U.rp(i.nilai.sisa)}</td>
        <td><span class="badge ${STATUS_INV_TINT[i.status.kode] || "slate"}">${U.esc(i.status.nama)}</span>${i.terlewat_jatuh_tempo ? ` <span class="badge red">Terlambat</span>` : ""}</td>
        <td class="actions"><button class="icon-btn" onclick="event.stopPropagation();invLihat(${i.id})">${U.icon("eye", 15)}</button></td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function isiRingkasanTagihan() {
    const wadah = document.getElementById("invKpi");
    if (!wadah) return;
    const b = INV.baris;
    const total = b.reduce((a, i) => a + i.nilai.total, 0);
    const terbayar = b.reduce((a, i) => a + i.nilai.terbayar, 0);
    wadah.innerHTML = `
      ${U.kpi({ label: "Total Tagihan", value: U.rpShort(total), icon: "doc", tint: "brand", note: b.length + " invoice" })}
      ${U.kpi({ label: "Sudah Dibayar", value: U.rpShort(terbayar), icon: "check", tint: "green", note: total ? Math.round((terbayar / total) * 100) + "% terbayar" : "—" })}
      ${U.kpi({ label: "Outstanding", value: U.rpShort(total - terbayar), icon: "clock", tint: "amber", note: "Belum diterima" })}
      ${U.kpi({ label: "Terlambat", value: U.rpShort(b.filter((i) => i.terlewat_jatuh_tempo).reduce((a, i) => a + i.nilai.sisa, 0)), icon: "alert", tint: "red", note: "Melewati jatuh tempo" })}`;
  }

  V["invoice"] = {
    title: "Invoice & Tagihan",
    sub: "Tagihan resmi hasil penerbitan langsung atau dari penawaran yang disetujui.",
    render() {
      return `<div class="grid g4 mb-16" id="invKpi"></div>
        ${U.card("Daftar Invoice", `<div id="invDaftar"></div>`, { bodyCls: "flush" })}`;
    },
    mount() { muatTagihan(); }
  };

  window.invLihat = async function (id) {
    U.drawer({ title: "Memuat…", body: `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>` });
    let i;
    try { i = await Repo.tagihan.lihat(id); }
    catch (e) { U.closeDrawer(); Repo.tampilkanGalat(e, "Gagal memuat"); return; }
    if (!i) { U.closeDrawer(); return; }

    U.drawer({
      size: "wide", title: "Invoice " + i.nomor, sub: i.penyewaan ? i.penyewaan.penyewa : "",
      body: `
        <div class="row wrap gap-6 mb-16">
          <span class="badge ${STATUS_INV_TINT[i.status.kode] || "slate"}">${U.esc(i.status.nama)}</span>
          ${i.terlewat_jatuh_tempo ? `<span class="badge red">Terlambat</span>` : ""}
          ${i.quotation_nomor ? `<span class="badge outline">Dari ${U.esc(i.quotation_nomor)}</span>` : ""}
        </div>
        ${U.table([
          { t: "Deskripsi", render: (r) => U.esc(r.deskripsi) },
          { t: "Qty", cls: "center", render: (r) => r.kuantitas + " " + r.satuan },
          { t: "Harga", cls: "right", render: (r) => U.rp(r.harga_satuan) },
          { t: "Jumlah", cls: "right", render: (r) => `<b>${U.rp(r.subtotal)}</b>` }
        ], i.baris || [])}
        <div class="row mt-16"><div class="spacer"></div><div style="width:260px">
          <div class="row small"><span class="muted" style="flex:1">Subtotal</span><b>${U.rp(i.nilai.subtotal)}</b></div>
          <div class="row small mt-4"><span class="muted" style="flex:1">PPN ${i.nilai.ppn_persen}%</span><b>${U.rp(i.nilai.ppn)}</b></div>
          <div class="row mt-8" style="padding-top:8px;border-top:1px solid var(--border)"><span style="flex:1">Total</span><h3>${U.rp(i.nilai.total)}</h3></div>
          <div class="row small mt-8"><span class="muted" style="flex:1">Sisa</span><b>${U.rp(i.nilai.sisa)}</b></div>
        </div></div>
        ${(i.pembayaran && i.pembayaran.length) ? `
          <h4 class="mb-8 mt-16 muted">RIWAYAT PEMBAYARAN</h4>
          ${U.table([
            { t: "Tanggal", render: (p) => U.fdate(p.tanggal, "short") },
            { t: "Metode", render: (p) => U.esc(p.metode) },
            { t: "Jumlah", cls: "right", render: (p) => U.rp(p.jumlah) },
            { t: "Status", render: (p) => `<span class="badge ${STATUS_PAY_TINT[p.status.kode] || "slate"}">${U.esc(p.status.nama)}</span>` }
          ], i.pembayaran)}` : ""}
        ${i.nilai.sisa > 0 && Repo.dapatMenulis() && i.status.kode !== "dibatalkan" ? `<div id="invBayarForm" class="mt-16"></div>` : ""}`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
        ${i.nilai.sisa > 0 && Repo.dapatMenulis() && i.status.kode !== "dibatalkan" ? `<button class="btn btn-primary" onclick="invBukaBayar(${i.id},${i.nilai.sisa})">Catat Pembayaran</button>` : ""}`
    });
    window.__invAktif = i;
  };

  window.invBukaBayar = function (id, sisa) {
    document.getElementById("invBayarForm").innerHTML = `
      <div style="padding-top:16px;border-top:1px solid var(--border)">
        <h4 class="mb-8 muted">CATAT PEMBAYARAN</h4>
        <div id="invBayarGalat" class="alert err mb-12" hidden></div>
        <div class="grid g2 gap-12">
          <label class="fld"><span>Tanggal *</span><input type="date" class="input" id="invBayarTanggal" value="${new Date().toISOString().slice(0, 10)}"></label>
          <label class="fld"><span>Jumlah (Rp) *</span><input type="number" class="input" id="invBayarJumlah" value="${sisa}"></label>
        </div>
        <label class="fld mt-8"><span>Metode</span>
          <select class="select" id="invBayarMetode">
            <option value="transfer">Transfer bank</option><option value="tunai">Tunai</option><option value="kartu">Kartu</option><option value="lainnya">Lainnya</option>
          </select></label>
        <label class="fld mt-8"><span>Referensi</span><input class="input" id="invBayarReferensi" placeholder="No. transaksi/kuitansi"></label>
        <button class="btn btn-primary btn-block mt-12" onclick="invSimpanBayar(${id})">Simpan Pembayaran</button>
      </div>`;
  };

  window.invSimpanBayar = async function (id) {
    const kotak = document.getElementById("invBayarGalat");
    kotak.hidden = true;
    try {
      await Repo.tagihan.catatPembayaran(id, {
        tanggal: document.getElementById("invBayarTanggal").value,
        jumlah: Number(document.getElementById("invBayarJumlah").value),
        metode: document.getElementById("invBayarMetode").value,
        referensi: document.getElementById("invBayarReferensi").value || null
      });
      U.closeDrawer();
      U.toast("Tersimpan", "Pembayaran berhasil dicatat.");
      muatTagihan();
    } catch (e) {
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan).map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else { kotak.textContent = e.message || "Gagal menyimpan."; }
      kotak.hidden = false;
    }
  };

  /* ------------------------------------------------------------ pembayaran */

  async function muatPembayaran() {
    PAY.memuat = true; PAY.galat = null; isiPembayaran();
    try { PAY.baris = (await Repo.pembayaran.daftar()).data; }
    catch (e) { PAY.baris = []; PAY.galat = e.message; }
    finally { PAY.memuat = false; isiPembayaran(); isiRingkasanPembayaran(); }
  }

  function isiPembayaran() {
    const wadah = document.getElementById("payDaftar");
    if (!wadah) return;
    if (PAY.memuat) { wadah.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (PAY.galat) { wadah.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div>${U.esc(PAY.galat)}</div></div>`; return; }
    if (!PAY.baris.length) { wadah.innerHTML = U.emptyState("Belum ada pembayaran tercatat"); return; }
    wadah.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Invoice</th><th>Klien</th><th>Tanggal</th><th>Metode</th><th class="right">Jumlah</th><th>Status</th><th></th></tr></thead>
      <tbody>${PAY.baris.map((p) => `<tr>
        <td><span class="mono small">${p.invoice ? U.esc(p.invoice.nomor) : "—"}</span></td>
        <td><b class="small">${p.invoice ? U.esc(p.invoice.penyewa || "—") : "—"}</b></td>
        <td>${U.fdate(p.tanggal, "short")}</td>
        <td><span class="badge outline">${U.esc(p.metode)}</span></td>
        <td class="right"><b>${U.rp(p.jumlah)}</b></td>
        <td><span class="badge ${STATUS_PAY_TINT[p.status.kode] || "slate"}">${U.esc(p.status.nama)}</span></td>
        <td class="actions">${p.status.kode !== "terverifikasi" && Repo.dapatMenulis()
          ? `<button class="btn btn-sm btn-primary" onclick="payVerifikasi(${p.id})">Verifikasi</button>`
          : `<span class="faint small">—</span>`}</td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function isiRingkasanPembayaran() {
    const wadah = document.getElementById("payKpi");
    if (!wadah) return;
    const b = PAY.baris;
    const terverifikasi = b.filter((p) => p.status.kode === "terverifikasi");
    wadah.innerHTML = `
      ${U.kpi({ label: "Diterima (Terverifikasi)", value: U.rpShort(terverifikasi.reduce((a, p) => a + p.jumlah, 0)), icon: "money", tint: "green", note: terverifikasi.length + " transaksi" })}
      ${U.kpi({ label: "Menunggu Verifikasi", value: b.filter((p) => p.status.kode !== "terverifikasi").length, icon: "clock", tint: "amber", note: "Perlu konfirmasi Finance" })}
      ${U.kpi({ label: "Total Transaksi", value: b.length, icon: "doc", tint: "brand", note: "Seluruh riwayat" })}`;
  }

  V["payment"] = {
    title: "Pembayaran",
    sub: "Riwayat dan verifikasi pembayaran lintas tagihan.",
    render() {
      return `<div class="grid g3 mb-16" id="payKpi"></div>
        ${U.card("Riwayat Pembayaran", `<div id="payDaftar"></div>`, { bodyCls: "flush" })}`;
    },
    mount() { muatPembayaran(); }
  };

  window.payVerifikasi = async function (id) {
    try {
      await Repo.pembayaran.verifikasi(id);
      U.toast("Terverifikasi", "Pembayaran dikonfirmasi dan dihitung sebagai uang masuk.");
      muatPembayaran();
    } catch (e) { Repo.tampilkanGalat(e, "Gagal memverifikasi"); }
  };

  /* =======================================================================
     EVENT
     ======================================================================= */
  V["events"] = {
    title: "Manajemen Event",
    sub: "Perencanaan event: organizer, PIC, peserta, anggaran, vendor, dan dokumentasi.",
    actions: `<button class="btn btn-primary btn-sm" onclick="UI.demo('Form event baru')">${U.icon("plus")} Buat Event</button>`,
    render() {
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Event Aktif", value: D.events.filter((e) => e.status !== "Selesai").length, icon: "star", tint: "violet", note: "Dalam persiapan" })}
          ${U.kpi({ label: "Total Peserta", value: U.num(D.events.reduce((a, e) => a + e.people, 0)), icon: "users", tint: "brand", note: "Seluruh event terjadwal" })}
          ${U.kpi({ label: "Total Anggaran", value: U.rpShort(D.events.reduce((a, e) => a + e.budget, 0)), icon: "money", tint: "amber", note: "Termasuk vendor" })}
          ${U.kpi({ label: "Vendor Terlibat", value: D.vendors.length, icon: "box", tint: "teal", note: "Kontrak aktif" })}
        </div>
        <div class="grid g2 mb-16">
          ${D.events.filter((e) => e.status !== "Selesai").slice(0, 2).map((e) => `
            <div class="card"><div class="card-body">
              <div class="row mb-12"><span class="badge violet">${U.esc(e.type)}</span>${U.badge(e.status)}
                <div class="spacer"></div><span class="tiny faint mono">${e.id}</span></div>
              <h3 class="mb-4">${U.esc(e.name)}</h3>
              <div class="small muted mb-16">${U.esc(e.organizer)} • PIC ${U.esc(D.personName(e.pic))}</div>
              <div class="grid g4" style="gap:10px">
                ${[["Tanggal", U.fdate(e.date, "short")], ["Venue", D.resName(e.venue).split(" ").slice(0, 2).join(" ")], ["Peserta", U.num(e.people)], ["Vendor", e.vendors]]
                  .map(([k, v]) => `<div><div class="tiny faint">${k}</div><b class="small">${v}</b></div>`).join("")}
              </div>
              <div class="mt-16">${U.meter(`<span class="small">Progres persiapan</span>`, e.status === "Persiapan" ? 68 : e.status === "Terkonfirmasi" ? 85 : 32, "var(--violet-500)")}</div>
              <div class="row mt-12" style="padding-top:12px;border-top:1px solid var(--border)">
                <div><div class="tiny faint">Anggaran</div><b>${U.rp(e.budget)}</b></div>
                <div class="spacer"></div>
                <button class="btn btn-sm" onclick="UI.demo('Rundown event')">Rundown</button>
                <button class="btn btn-sm btn-primary" onclick="UI.demo('Detail event')">Kelola</button></div>
            </div></div>`).join("")}
        </div>
        ${U.card("Daftar Event", U.toolbar({ ph: "Cari event…", filters: [["Semua Jenis", "Konferensi", "Pelatihan", "Gathering", "Seremonial", "Sosialisasi"], ["Semua Status"]] }) +
          U.table([
            { t: "ID", w: "130px", render: (e) => `<span class="mono small">${e.id}</span>` },
            { t: "Nama Event", render: (e) => `<b>${U.esc(e.name)}</b><div class="tiny faint">${U.esc(e.type)}</div>` },
            { t: "Organizer", render: (e) => U.esc(e.organizer) },
            { t: "PIC", render: (e) => `<span class="small">${U.esc(D.personName(e.pic))}</span>` },
            { t: "Tanggal", render: (e) => U.fdate(e.date, "short") },
            { t: "Venue", render: (e) => `<span class="small">${U.esc(D.resName(e.venue))}</span>` },
            { t: "Peserta", cls: "center", render: (e) => U.num(e.people) },
            { t: "Anggaran", cls: "right", render: (e) => U.rp(e.budget) },
            { t: "Status", render: (e) => U.badge(e.status) }
          ], D.events), { bodyCls: "flush" })}`;
    }
  };

  V["agenda"] = {
    title: "Agenda & Kegiatan",
    sub: "Seluruh agenda: rapat, training, seminar, riset, audit, maintenance, dan inspeksi.",
    actions: `<button class="btn btn-primary btn-sm" onclick="UI.demo('Form agenda baru')">${U.icon("plus")} Tambah Agenda</button>`,
    render() {
      return U.card("Daftar Agenda", U.toolbar({ ph: "Cari agenda…", filters: [["Semua Jenis", "Rapat", "Pelatihan", "Audit", "Inspeksi", "Maintenance", "Penggunaan Lab"]] }) +
        U.table([
          { t: "Kode", w: "110px", render: (a) => `<span class="mono small">${a.id}</span>` },
          { t: "Agenda", render: (a) => `<b>${U.esc(a.title)}</b>` },
          { t: "Jenis", render: (a) => `<span class="badge outline">${U.esc(a.type)}</span>` },
          { t: "Resource", render: (a) => U.esc(D.resName(a.res)) },
          { t: "Tanggal", render: (a) => U.fdate(a.date, "short") },
          { t: "Waktu", render: (a) => a.time },
          { t: "Penanggung Jawab", render: (a) => U.esc(D.personName(a.owner)) },
          { t: "Pengulangan", render: (a) => a.recurring === "-" ? `<span class="faint">Sekali</span>` : `<span class="badge brand">${U.esc(a.recurring)}</span>` }
        ], D.agendas), { bodyCls: "flush" });
    }
  };

  V["participant"] = {
    title: "Peserta Event",
    sub: "Registrasi, konfirmasi kehadiran, distribusi QR, dan absensi peserta.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Kirim undangan QR massal')">${U.icon("send")} Kirim Undangan</button>
              <button class="btn btn-primary btn-sm" onclick="UI.demo('Impor daftar peserta')">${U.icon("upload")} Impor Peserta</button>`,
    render() {
      const rows = D.people.concat(D.visitors.map((v) => ({ id: v.id, name: v.name, unit: v.org, role: "Peserta Eksternal", email: "-", phone: "-" })));
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Peserta Terdaftar", value: 380, icon: "users", tint: "brand", note: "National Tech Summit 2026" })}
          ${U.kpi({ label: "Konfirmasi Hadir", value: 341, icon: "check", tint: "green", note: "89,7% dari terdaftar" })}
          ${U.kpi({ label: "Check-in QR", value: 0, icon: "qr", tint: "amber", note: "Dibuka H-1 event" })}
          ${U.kpi({ label: "Undangan Terkirim", value: 380, icon: "send", tint: "teal", note: "Email & WhatsApp" })}
        </div>
        ${U.card("Daftar Peserta", U.toolbar({ ph: "Cari peserta…", filters: [["Semua Event"].concat(D.events.map((e) => e.name)), ["Semua Status", "Terdaftar", "Konfirmasi", "Hadir"]] }) +
          U.table([
            { t: "Nama", render: (p) => `<div class="row"><span class="avatar sm">${U.initials(p.name)}</span><div><b class="small">${U.esc(p.name)}</b><div class="tiny faint">${U.esc(p.email || "-")}</div></div></div>` },
            { t: "Instansi / Unit", render: (p) => U.esc(p.unit) },
            { t: "Kategori", render: (p) => `<span class="badge outline">${p.role.includes("Eksternal") ? "Eksternal" : "Internal"}</span>` },
            { t: "QR Undangan", cls: "center", render: () => `<span class="badge green">Terkirim</span>` },
            { t: "Konfirmasi", cls: "center", render: (p, i) => i % 5 === 0 ? U.badge("Terjadwal") : U.badge("Disetujui") },
            { t: "", cls: "actions", render: () => `<button class="btn btn-sm" onclick="UI.demo('Kirim ulang QR')">${U.icon("qr", 12)} QR</button>` }
          ], rows.slice(0, 12)), { bodyCls: "flush" })}`;
    }
  };

  V["vendor"] = {
    title: "Vendor & Mitra",
    sub: "Daftar vendor pendukung fasilitas, event, maintenance, dan kalibrasi.",
    actions: `<button class="btn btn-primary btn-sm" onclick="UI.demo('Form vendor baru')">${U.icon("plus")} Tambah Vendor</button>`,
    render() {
      return U.card("Daftar Vendor", U.toolbar({ ph: "Cari vendor…", filters: [["Semua Kategori"].concat([...new Set(D.vendors.map((v) => v.cat))])] }) +
        U.table([
          { t: "Kode", w: "90px", render: (v) => `<span class="mono small">${v.id}</span>` },
          { t: "Nama Vendor", render: (v) => `<b>${U.esc(v.name)}</b>` },
          { t: "Kategori", render: (v) => `<span class="badge outline">${U.esc(v.cat)}</span>` },
          { t: "PIC", render: (v) => `${U.esc(v.pic)}<div class="tiny faint">${U.esc(v.phone)}</div>` },
          { t: "Rating", render: (v) => `<span class="badge ${v.rating >= 4.5 ? "green" : "amber"}">★ ${v.rating}</span>` },
          { t: "Kontrak", render: (v) => `<span class="small">${U.esc(v.contract)}</span>` },
          { t: "", cls: "actions", render: () => `<button class="icon-btn" onclick="UI.demo('Detail vendor')">${U.icon("eye", 15)}</button>` }
        ], D.vendors), { bodyCls: "flush" });
    }
  };

  V["eventreport"] = {
    title: "Laporan Event",
    sub: "Realisasi anggaran, kehadiran, evaluasi, dan dokumentasi pasca-event.",
    render() {
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Event Terlaksana YTD", value: 18, icon: "star", tint: "violet", delta: 20, note: "12 eksternal" })}
          ${U.kpi({ label: "Rata-rata Kehadiran", value: "87", suffix: "%", icon: "users", tint: "green", delta: 4, note: "Dari peserta terdaftar" })}
          ${U.kpi({ label: "Realisasi Anggaran", value: "94", suffix: "%", icon: "money", tint: "brand", note: "Efisiensi 6%" })}
          ${U.kpi({ label: "Skor Kepuasan", value: "4,6", suffix: "/5", icon: "chart", tint: "amber", delta: 3, note: "Survei pasca-event" })}
        </div>
        ${U.card("Rekap Event Terlaksana", U.table([
          { t: "Event", render: (e) => `<b>${U.esc(e.name)}</b><div class="tiny faint">${U.fdate(e.date, "short")} • ${U.esc(D.resName(e.venue))}</div>` },
          { t: "Peserta Target", cls: "center", render: (e) => U.num(e.people) },
          { t: "Hadir", cls: "center", render: (e) => U.num(Math.round(e.people * 0.87)) },
          { t: "Anggaran", cls: "right", render: (e) => U.rp(e.budget) },
          { t: "Realisasi", cls: "right", render: (e) => U.rp(Math.round(e.budget * 0.94)) },
          { t: "Efisiensi", cls: "right", render: () => `<span class="badge green">6%</span>` },
          { t: "", cls: "actions", render: () => `<button class="btn btn-sm" onclick="UI.demo('Unduh laporan event PDF')">${U.icon("download", 12)} Laporan</button>` }
        ], D.events), { bodyCls: "flush" })}`;
    }
  };

  /* =======================================================================
     MANAJEMEN PENGGUNA — tersambung ke basis data

     Hanya super-admin yang punya akses sama sekali (lihat docblock
     MatriksAkses::MODUL) — halaman ini karenanya harus tetap dapat
     ditampilkan dengan baik bagi pengguna lain yang entah bagaimana
     membuka rutenya: pesan 403 yang jelas, bukan layar rusak.

     PIC, Teknisi & Operator, Pengunjung, dan Struktur Organisasi TIDAK
     disambungkan pada modul ini — lihat catatan desain di repo.js tepat
     sebelum Repo.penggunaKelola untuk alasannya.
     ======================================================================= */

  const USR = { baris: [], memuat: true, galat: null, tapis: {} };

  async function muatPengguna() {
    USR.memuat = true; USR.galat = null; isiPengguna();
    try { USR.baris = (await Repo.penggunaKelola.daftar(USR.tapis)).data; }
    catch (e) { USR.baris = []; USR.galat = e; }
    finally { USR.memuat = false; isiPengguna(); isiRingkasanPengguna(); }
  }

  function isiPengguna() {
    const wadah = document.getElementById("usrDaftar");
    if (!wadah) return;
    if (USR.memuat) { wadah.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (USR.galat) {
      const pesan = USR.galat.status === 403
        ? "Hanya Super Admin yang dapat mengelola pengguna & peran."
        : (USR.galat.message || "Gagal memuat.");
      wadah.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div><b>${USR.galat.status === 403 ? "Tidak berwenang" : "Gagal memuat"}.</b><br><span class="small">${U.esc(pesan)}</span></div></div>`;
      return;
    }
    if (!USR.baris.length) { wadah.innerHTML = U.emptyState("Tidak ada pengguna yang cocok dengan tapisan"); return; }

    wadah.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Nama</th><th>Peran</th><th>Unit Kerja</th><th>Gedung</th><th>Status</th><th></th></tr></thead>
      <tbody>${USR.baris.map((p) => `<tr>
        <td><div class="row"><span class="avatar sm">${U.initials(p.nama)}</span>
          <div><b class="small">${U.esc(p.nama)}</b><div class="tiny faint">${U.esc(p.email)}</div></div></div></td>
        <td>${(p.peran || []).map((k) => `<span class="badge brand">${U.esc(Repo.NAMA_PERAN[k] || k)}</span>`).join(" ") || `<span class="faint small">—</span>`}</td>
        <td>${U.esc(p.unit_kerja || "—")}</td>
        <td><span class="small muted">${(p.gedung || []).join(", ") || "—"}</span></td>
        <td>${p.aktif ? U.badge("Aktif") : U.badge("Nonaktif")}</td>
        <td class="actions"><button class="icon-btn" onclick="usrForm(${p.id})">${U.icon("edit", 15)}</button></td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function isiRingkasanPengguna() {
    const wadah = document.getElementById("usrKpi");
    if (!wadah) return;
    if (USR.galat) { wadah.innerHTML = ""; return; }
    const b = USR.baris;
    wadah.innerHTML = `
      ${U.kpi({ label: "Total Pengguna", value: b.length, icon: "users", tint: "brand", note: "Sesuai tapisan" })}
      ${U.kpi({ label: "Aktif", value: b.filter((p) => p.aktif).length, icon: "check", tint: "green", note: "Dapat masuk" })}
      ${U.kpi({ label: "Nonaktif", value: b.filter((p) => !p.aktif).length, icon: "x", tint: "red", note: "Ditolak saat masuk" })}
      ${U.kpi({ label: "Tanpa Peran", value: b.filter((p) => !p.peran || !p.peran.length).length, icon: "alert", tint: "amber", note: "Belum dapat mengakses apa pun" })}`;
  }

  V["users"] = {
    title: "Manajemen Pengguna",
    sub: "Akun, peran, unit kerja, dan gedung yang diampu setiap pengguna.",
    get actions() {
      return Repo.dapatMenulis() ? `<button class="btn btn-primary btn-sm" onclick="usrForm()">${U.icon("plus")} Tambah Pengguna</button>` : "";
    },
    render() {
      return `<div class="grid g4 mb-16" id="usrKpi"></div>
        <div id="usrToolbar" class="row wrap gap-8" style="padding:12px 16px;border:1px solid var(--border);border-bottom:none;border-radius:12px 12px 0 0;background:var(--surface)">
          <input class="input" id="usrCari" placeholder="Cari nama atau email…" style="max-width:260px" onkeydown="if(event.key==='Enter')usrTerapkanTapis()">
          <select class="select" id="usrFilterPeran" onchange="usrTerapkanTapis()" style="max-width:200px">
            <option value="">Semua peran</option>
            ${Object.keys(Repo.NAMA_PERAN).map((k) => `<option value="${k}">${U.esc(Repo.NAMA_PERAN[k])}</option>`).join("")}
          </select>
          <select class="select" id="usrFilterAktif" onchange="usrTerapkanTapis()" style="max-width:160px">
            <option value="">Semua status</option><option value="1">Aktif</option><option value="0">Nonaktif</option>
          </select>
          <button class="btn btn-sm" onclick="usrTerapkanTapis()">Terapkan</button>
        </div>
        ${U.card("", `<div id="usrDaftar"></div>`, { bodyCls: "flush" })}`;
    },
    mount() { USR.tapis = {}; muatPengguna(); }
  };

  window.usrTerapkanTapis = function () {
    USR.tapis = {
      cari: document.getElementById("usrCari").value || undefined,
      peran: document.getElementById("usrFilterPeran").value || undefined,
      aktif: document.getElementById("usrFilterAktif").value || undefined
    };
    muatPengguna();
  };

  window.usrForm = async function (id) {
    if (!Repo.dapatMenulis()) { U.toast("Tidak tersedia", "Mengelola pengguna hanya bisa setelah masuk dengan akun."); return; }
    const existing = id ? USR.baris.find((p) => p.id === id) : null;

    U.drawer({
      title: existing ? "Ubah Pengguna" : "Tambah Pengguna",
      sub: existing ? existing.email : "Akun baru untuk sistem",
      body: `
        <div id="usrFormGalat" class="alert err mb-16" hidden></div>
        <label class="fld"><span>Nama *</span><input class="input" id="usrNama" value="${existing ? U.esc(existing.nama) : ""}"></label>
        <div class="grid g2 gap-12 mt-8">
          <label class="fld"><span>Email *</span><input type="email" class="input" id="usrEmail" value="${existing ? U.esc(existing.email) : ""}" ${existing ? "disabled" : ""}></label>
          <label class="fld"><span>Unit Kerja</span><input class="input" id="usrUnitKerja" value="${existing ? U.esc(existing.unit_kerja || "") : ""}"></label>
        </div>
        <label class="fld mt-8"><span>${existing ? "Sandi Baru (kosongkan bila tidak diubah)" : "Sandi *"}</span>
          <input type="password" class="input" id="usrSandi" placeholder="Minimal 8 karakter"></label>
        <label class="fld mt-8"><span>Peran *</span>
          <select class="select" id="usrPeran" multiple size="6">
            ${Object.keys(Repo.NAMA_PERAN).map((k) => `<option value="${k}" ${existing && existing.peran.indexOf(k) !== -1 ? "selected" : ""}>${U.esc(Repo.NAMA_PERAN[k])}</option>`).join("")}
          </select>
          <span class="tiny faint">Ctrl/Cmd+klik untuk memilih lebih dari satu.</span></label>
        <label class="fld mt-8"><span>Gedung yang Diampu (pisahkan dengan koma)</span>
          <input class="input" id="usrGedung" value="${existing ? U.esc((existing.gedung || []).join(", ")) : ""}" placeholder="mis. Gedung A, Gedung B — kosong berarti tidak dibatasi"></label>
        ${existing ? `<label class="row mt-12"><span class="small" style="flex:1">Akun aktif (dapat masuk)</span>
          <label class="switch"><input type="checkbox" id="usrAktif" ${existing.aktif ? "checked" : ""}><span></span></label></label>` : ""}`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" id="usrFormSimpan" onclick="usrFormSimpan(${id || "null"})">Simpan</button>`
    });
  };

  window.usrFormSimpan = async function (id) {
    const kotak = document.getElementById("usrFormGalat");
    const tombol = document.getElementById("usrFormSimpan");
    kotak.hidden = true;

    const peranTerpilih = Array.from(document.getElementById("usrPeran").selectedOptions).map((o) => o.value);
    const gedung = document.getElementById("usrGedung").value.split(",").map((g) => g.trim()).filter(Boolean);
    const sandi = document.getElementById("usrSandi").value;

    const isi = {
      name: document.getElementById("usrNama").value,
      unit_kerja: document.getElementById("usrUnitKerja").value || null,
      peran: peranTerpilih,
      gedung: gedung
    };
    if (!id) isi.email = document.getElementById("usrEmail").value;
    if (sandi) isi.password = sandi;
    if (id) {
      const aktifKotak = document.getElementById("usrAktif");
      if (aktifKotak) isi.aktif = aktifKotak.checked;
    }

    tombol.disabled = true; tombol.textContent = "Menyimpan…";
    try {
      await Repo.penggunaKelola.simpan(isi, id);
      U.closeDrawer();
      U.toast("Tersimpan", "Pengguna berhasil disimpan.");
      muatPengguna();
    } catch (e) {
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan).map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else { kotak.textContent = e.message || "Gagal menyimpan."; }
      kotak.hidden = false;
    } finally { tombol.disabled = false; tombol.textContent = "Simpan"; }
  };

  V["pic"] = {
    title: "Penanggung Jawab (PIC)",
    sub: "Assignment PIC untuk laboratorium, ruangan, auditorium, aset, dan alat.",
    actions: `<button class="btn btn-primary btn-sm" onclick="UI.demo('Form assignment PIC')">${U.icon("plus")} Assign PIC</button>`,
    render() {
      const picRows = D.people.slice(0, 8).map((p, i) => ({
        p, rooms: [2, 6, 1, 0, 5, 0, 2, 0][i], labs: [0, 3, 2, 0, 0, 0, 0, 0][i],
        assets: [4, 1, 2, 6, 3, 0, 2, 3][i], eq: [0, 5, 8, 2, 0, 0, 0, 0][i],
        load: [62, 88, 74, 55, 71, 22, 48, 35][i]
      }));
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "PIC Aktif", value: 24, icon: "users", tint: "brand", note: "Seluruh jenis resource" })}
          ${U.kpi({ label: "Resource Ber-PIC", value: "96", suffix: "%", icon: "check", tint: "green", note: "4% belum ditugaskan" })}
          ${U.kpi({ label: "Beban Tertinggi", value: "Dewi A.", icon: "alert", tint: "amber", note: "88% workload — perlu delegasi" })}
          ${U.kpi({ label: "Delegasi Aktif", value: 3, icon: "send", tint: "violet", note: "PIC sedang cuti/dinas" })}
        </div>
        <div class="alert warn mb-16">${U.icon("alert", 17)}<div><b>Eskalasi otomatis aktif</b>
          Bila PIC tidak merespons pengajuan dalam SLA, sistem meneruskan ke supervisor atau PIC pengganti.</div></div>
        ${U.card("Matriks Penugasan PIC", U.table([
          { t: "PIC", render: (r) => `<div class="row"><span class="avatar sm">${U.initials(r.p.name)}</span>
            <div><b class="small">${U.esc(r.p.name)}</b><div class="tiny faint">${U.esc(r.p.role)}</div></div></div>` },
          { t: "Unit", render: (r) => U.esc(r.p.unit) },
          { t: "Ruangan", cls: "center", render: (r) => r.rooms || `<span class="faint">—</span>` },
          { t: "Laboratorium", cls: "center", render: (r) => r.labs || `<span class="faint">—</span>` },
          { t: "Alat", cls: "center", render: (r) => r.eq || `<span class="faint">—</span>` },
          { t: "Aset", cls: "center", render: (r) => r.assets || `<span class="faint">—</span>` },
          { t: "Workload", w: "170px", render: (r) => `<div class="bar thin"><i style="width:${r.load}%;background:${r.load > 80 ? "var(--red-500)" : r.load > 60 ? "var(--amber-500)" : "var(--green-500)"}"></i></div>
            <div class="tiny faint mt-4">${r.load}% kapasitas approval</div>` },
          { t: "Ketersediaan", render: (r) => U.badge(r.p.status === "Cuti" ? "Cuti" : "Aktif") },
          { t: "", cls: "actions", render: () => `<button class="btn btn-sm" onclick="UI.demo('Atur delegasi PIC')">Delegasi</button>` }
        ], picRows), { bodyCls: "flush" })}`;
    }
  };

  V["technician"] = {
    title: "Teknisi & Operator",
    sub: "Jadwal, kompetensi, sertifikasi, dan beban kerja teknisi serta operator alat.",
    render() {
      const tech = D.people.filter((p) => /Technician|PIC/.test(p.role));
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Teknisi Aktif", value: tech.length, icon: "wrench", tint: "brand", note: "Lab & fasilitas" })}
          ${U.kpi({ label: "Work Order Berjalan", value: D.maintenance.filter((m) => m.status === "In Progress").length, icon: "grid", tint: "amber", note: "Ditangani teknisi" })}
          ${U.kpi({ label: "Sertifikasi Aktif", value: 11, icon: "shield", tint: "green", note: "2 akan kedaluwarsa" })}
          ${U.kpi({ label: "Rata-rata Response", value: "3,2", suffix: "jam", icon: "clock", tint: "teal", delta: -12, note: "Target ≤ 4 jam" })}
        </div>
        ${U.card("Daftar Teknisi & Operator", U.table([
          { t: "Nama", render: (p) => `<div class="row"><span class="avatar sm">${U.initials(p.name)}</span><div><b class="small">${U.esc(p.name)}</b><div class="tiny faint">${U.esc(p.unit)}</div></div></div>` },
          { t: "Peran", render: (p) => `<span class="badge brand">${U.esc(p.role)}</span>` },
          { t: "Kompetensi / Sertifikasi", render: (p) => `<span class="small">${U.esc(p.comp)}</span>` },
          { t: "Kontak", render: (p) => `<div class="tiny">${U.esc(p.phone)}</div>` },
          { t: "Work Order Aktif", cls: "center", render: (p, i) => [2, 1, 3][i % 3] },
          { t: "Status", render: (p) => U.badge(p.status) },
          { t: "", cls: "actions", render: () => `<button class="btn btn-sm" onclick="UI.demo('Lihat jadwal teknisi')">Jadwal</button>` }
        ], tech), { bodyCls: "flush" })}`;
    }
  };

  V["visitor"] = {
    title: "Manajemen Pengunjung",
    sub: "Registrasi tamu, QR invitation, check-in/out, visitor badge, dan riwayat kunjungan.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Mode kiosk check-in lobby')">${U.icon("qr")} Mode Kiosk</button>
              <button class="btn btn-primary btn-sm" onclick="UI.demo('Form pra-registrasi tamu')">${U.icon("plus")} Pra-Registrasi</button>`,
    render() {
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Tamu Hari Ini", value: D.visitors.filter((v) => v.date === D.shift(0)).length, icon: "users", tint: "brand", note: "Termasuk terjadwal" })}
          ${U.kpi({ label: "Sedang di Dalam", value: D.visitors.filter((v) => v.status === "Di Dalam").length, icon: "pin", tint: "green", note: "Belum check-out" })}
          ${U.kpi({ label: "Pra-Registrasi", value: D.visitors.filter((v) => v.status === "Terjadwal").length, icon: "calendar", tint: "amber", note: "QR sudah dikirim" })}
          ${U.kpi({ label: "Rata-rata Kunjungan", value: "1,8", suffix: "jam", icon: "clock", tint: "violet", note: "Durasi di area" })}
        </div>
        ${U.card("Daftar Pengunjung", U.toolbar({ ph: "Cari nama tamu / instansi…", filters: [["Semua Status", "Di Dalam", "Selesai", "Terjadwal"]] }) +
          U.table([
            { t: "ID Tamu", w: "140px", render: (v) => `<span class="mono small">${v.id}</span>` },
            { t: "Nama", render: (v) => `<div class="row"><span class="avatar sm">${U.initials(v.name)}</span><div><b class="small">${U.esc(v.name)}</b><div class="tiny faint">${U.esc(v.org)}</div></div></div>` },
            { t: "Tujuan", render: (v) => `<span class="small">${U.esc(v.purpose)}</span>` },
            { t: "Host / PIC", render: (v) => U.esc(D.personName(v.host)) },
            { t: "Ruangan", render: (v) => `<span class="small">${U.esc(D.resName(v.room))}</span>` },
            { t: "Masuk", cls: "center", render: (v) => v.in === "-" ? `<span class="faint">—</span>` : `<b>${v.in}</b>` },
            { t: "Keluar", cls: "center", render: (v) => v.out === "-" ? `<span class="faint">—</span>` : v.out },
            { t: "Badge", cls: "center", render: (v) => v.badge === "-" ? `<span class="faint">—</span>` : `<span class="badge outline">${v.badge}</span>` },
            { t: "Status", render: (v) => U.badge(v.status) },
            { t: "", cls: "actions", render: (v) => v.status === "Di Dalam"
                ? `<button class="btn btn-sm" onclick="UI.demo('Check-out tamu')">Check-out</button>`
                : `<button class="icon-btn" onclick="UI.demo('Detail kunjungan')">${U.icon("eye", 15)}</button>` }
          ], D.visitors), { bodyCls: "flush" })}`;
    }
  };

  V["organization"] = {
    title: "Struktur Organisasi",
    sub: "Perusahaan, unit kerja, divisi, lokasi, gedung, dan lantai.",
    actions: `<button class="btn btn-primary btn-sm" onclick="UI.demo('Form unit organisasi')">${U.icon("plus")} Tambah Unit</button>`,
    render() {
      return `
        <div class="grid g3 mb-16">
          ${U.card("Perusahaan / Instansi", `<div class="row-t"><div class="kpi-ico tint-brand">${U.icon("building", 17)}</div>
            <div><b>${U.esc(D.org.company)}</b><div class="small muted">1 entitas • 3 lokasi • 4 gedung • 15 lantai</div></div></div>`)}
          ${U.card("Unit Kerja", `<div class="row wrap gap-6">${D.org.units.map((u) => `<span class="fac">${U.esc(u)}</span>`).join("")}</div>
            <div class="small muted mt-12">${D.org.units.length} unit kerja terdaftar</div>`)}
          ${U.card("Lokasi", `<div class="col gap-8">${D.org.locations.map((l) => `<div class="row small">${U.icon("pin", 14, "faint")}<span>${U.esc(l)}</span></div>`).join("")}</div>`)}
        </div>
        ${U.card("Gedung & Lantai", U.table([
          { t: "Kode", w: "80px", render: (b) => `<span class="mono small">${b.code}</span>` },
          { t: "Nama Gedung", render: (b) => `<b>${U.esc(b.name)}</b>` },
          { t: "Jumlah Lantai", cls: "center", render: (b) => b.floors },
          { t: "Ruangan", cls: "center", render: (b) => D.rooms.filter((r) => r.building === b.code).length },
          { t: "Laboratorium", cls: "center", render: (b) => D.labs.filter((l) => l.building === b.code).length },
          { t: "Facility Manager", render: () => `<span class="small">${U.esc(D.personName("EMP-0001"))}</span>` },
          { t: "", cls: "actions", render: () => `<button class="icon-btn" onclick="UI.demo('Edit gedung')">${U.icon("edit", 15)}</button>` }
        ], D.org.buildings), { bodyCls: "flush" })}`;
    }
  };

  /* =======================================================================
     DOKUMEN
     ======================================================================= */
  V["documents"] = {
    title: "Dokumen & Berita Acara",
    sub: "BAST, berita acara, perjanjian, sertifikat, invoice, dan laporan — otomatis dalam format PDF.",
    actions: `<button class="btn btn-sm" onclick="UI.demo('Kelola template dokumen')">${U.icon("layout")} Template</button>
              <button class="btn btn-primary btn-sm" onclick="UI.demo('Generate dokumen baru')">${U.icon("plus")} Buat Dokumen</button>`,
    render() {
      const types = [...new Set(D.documents.map((d) => d.type))];
      return `
        <div class="grid g4 mb-16">
          ${U.kpi({ label: "Total Dokumen", value: U.num(1842), icon: "doc", tint: "brand", delta: 9, note: "Seluruh jenis" })}
          ${U.kpi({ label: "Menunggu TTD", value: D.documents.filter((d) => d.status === "Menunggu TTD").length, icon: "edit", tint: "amber", note: "Tanda tangan digital" })}
          ${U.kpi({ label: "Sertifikat Berlaku", value: 24, icon: "shield", tint: "green", note: "3 kedaluwarsa ≤60 hari" })}
          ${U.kpi({ label: "Template Aktif", value: 12, icon: "layout", tint: "violet", note: "Auto-generate PDF" })}
        </div>
        <div class="row wrap gap-6 mb-16">
          <span class="chip on">Semua</span>${types.map((t) => `<span class="chip" onclick="this.classList.toggle('on')">${U.esc(t)}</span>`).join("")}
        </div>
        ${U.card("Repositori Dokumen", U.toolbar({ ph: "Cari dokumen / nomor referensi…" }) + U.table([
          { t: "No. Dokumen", w: "150px", render: (d) => `<span class="mono small">${d.id}</span>` },
          { t: "Nama Dokumen", render: (d) => `<div class="row"><span class="kpi-ico tint-slate" style="width:28px;height:28px;flex:0 0 28px">${U.icon("doc", 13)}</span>
            <div><b class="small">${U.esc(d.name)}</b><div class="tiny faint">${d.size}</div></div></div>` },
          { t: "Jenis", render: (d) => `<span class="badge outline">${U.esc(d.type)}</span>` },
          { t: "Referensi", render: (d) => d.ref === "-" ? `<span class="faint">—</span>` : `<span class="mono small">${d.ref}</span>` },
          { t: "Tanggal", render: (d) => U.fdate(d.date, "short") },
          { t: "Dibuat oleh", render: (d) => `<span class="small">${U.esc(D.personName(d.by))}</span>` },
          { t: "Status", render: (d) => U.badge(d.status) },
          { t: "", cls: "actions", render: () => `<button class="icon-btn" onclick="UI.demo('Pratinjau dokumen')">${U.icon("eye", 15)}</button>
            <button class="icon-btn" onclick="UI.demo('Unduh PDF')">${U.icon("download", 15)}</button>` }
        ], D.documents), { bodyCls: "flush" })}`;
    }
  };

  /* =======================================================================
     LAPORAN
     ======================================================================= */
  function reportPage(title, sub, cards) {
    return { title, sub, actions: `<div class="seg"><button>Bulan Ini</button><button class="active">YTD</button><button>Kustom</button></div>
      <button class="btn btn-sm" onclick="UI.demo('Ekspor laporan ke Excel')">${U.icon("download")} Excel</button>
      <button class="btn btn-sm" onclick="window.print()">${U.icon("print")} Cetak</button>`, render: cards };
  }

  V["reportutil"] = reportPage("Laporan Utilisasi", "Tingkat pemanfaatan ruangan, laboratorium, dan alat.", () => `
    <div class="grid g4 mb-16">
      ${U.kpi({ label: "Utilisasi Ruangan", value: "74", suffix: "%", icon: "building", tint: "brand", delta: 6, note: "Target 70%" })}
      ${U.kpi({ label: "Utilisasi Laboratorium", value: "81", suffix: "%", icon: "flask", tint: "teal", delta: 8, note: "Target 75%" })}
      ${U.kpi({ label: "Utilisasi Alat", value: "68", suffix: "%", icon: "grid", tint: "violet", delta: 5, note: "Target 65%" })}
      ${U.kpi({ label: "Jam Terpakai", value: U.num(18420), suffix: "jam", icon: "clock", tint: "amber", delta: 12, note: "Seluruh resource" })}
    </div>
    <div class="grid g-2-1 mb-16">
      ${U.card("Tren Utilisasi", `<div class="legend mb-12">
        <span><i style="background:var(--brand-500)"></i>Ruangan</span>
        <span><i style="background:var(--teal-500)"></i>Laboratorium</span>
        <span><i style="background:var(--violet-500)"></i>Alat</span></div>` + U.areaChart(D.analytics.utilTrend))}
      ${U.card("Top Ruangan", U.hbars(D.analytics.topRooms))}
    </div>
    ${U.card("Rincian Utilisasi per Resource", U.table([
      { t: "Resource", render: (r) => `<b>${U.esc(r.name)}</b><div class="tiny faint">${r.code}</div>` },
      { t: "Jenis", render: (r) => `<span class="badge outline">${U.esc(r.type)}</span>` },
      { t: "Kapasitas", cls: "center", render: (r) => r.cap },
      { t: "Jam Tersedia", cls: "right", render: () => U.num(2640) },
      { t: "Jam Terpakai", cls: "right", render: (r) => U.num(Math.round(2640 * r.util / 100)) },
      { t: "Utilisasi", w: "170px", render: (r) => `<div class="bar thin"><i style="width:${r.util}%;background:${r.util > 75 ? "var(--amber-500)" : "var(--brand-500)"}"></i></div>
        <div class="tiny faint mt-4">${r.util}%</div>` }
    ], D.rooms), { bodyCls: "flush" })}`);

  /* Laporan Ruangan — ringkasan dari DataWidget + rekap tahun berjalan.
   *
   * PENYEDERHANAAN & PENGGANTIAN YANG DISENGAJA:
   * - "Rata-rata Okupansi" (peserta/kapasitas) purwarupa DIGANTI
   *   "Utilisasi Ruangan" (jam terpakai/jam tersedia, widget
   *   `ruangan.utilisasi` yang SAMA PERSIS dipakai Dashboard) — occupancy
   *   peserta tidak dihitung di mana pun sebagai metrik tersendiri,
   *   sementara utilisasi jam sudah dihitung server dengan asumsi jam
   *   operasional yang DINYATAKAN TEGAS (lihat DataWidget). Angka yang
   *   sama dengan yang dashboard tampilkan, bukan dihitung ulang di sini.
   * - "No-Show Rate" DIJATUHKAN — tidak ada pencatatan check-in booking
   *   ruangan di mana pun; menampilkannya berarti mengarang angka.
   *   Diganti "Menunggu Persetujuan" (`booking.menunggu`), KPI operasional
   *   yang sungguh dihitung server.
   * - Kolom "Pendapatan" pada rekap per ruangan DIJATUHKAN — booking
   *   ruangan internal tidak melekat pada invoice/pembayaran; hanya
   *   penyewaan fasilitas (modul terpisah) yang punya pendapatan tercatat.
   * - Rekap per ruangan dihitung dari booking TAHUN BERJALAN (maks 200
   *   baris terbaru, mengikuti batas Kalender Terpadu) — bukan seluruh
   *   riwayat. KPI di atasnya tetap dihitung server atas SELURUH cakupan
   *   (tidak dibatasi tahun), sehingga sengaja dapat berbeda dari jumlah
   *   baris rekap; keduanya diberi label yang membedakan cakupannya.
   */
  const RRM = { ringkasan: null, baris: [], memuat: true, galat: null };

  async function muatLaporanRuangan() {
    RRM.memuat = true; RRM.galat = null; isiLaporanRuangan();
    try {
      const awalTahun = new Date(); awalTahun.setMonth(0, 1);
      const iso = (d) => d.toISOString().slice(0, 10);
      const [status, utilisasi, tren, menunggu, ruangan, booking] = await Promise.all([
        Repo.dashboard.widget("booking.status"),
        Repo.dashboard.widget("ruangan.utilisasi"),
        Repo.dashboard.widget("ruangan.tren-utilisasi"),
        Repo.dashboard.widget("booking.menunggu"),
        Repo.ruangan.daftar().then((j) => j.data),
        Repo.booking.daftar({ sejak: iso(awalTahun), sampai: iso(new Date()) }).then((j) => j.data)
      ]);
      RRM.ringkasan = { status: status, utilisasi: utilisasi, tren: tren, menunggu: menunggu };
      RRM.baris = ruangan.map((r) => {
        const punya = booking.filter((b) => b.ruangan && b.ruangan.id === r.id);
        const aktif = punya.filter((b) => b.status.memblokir);
        const jam = aktif.reduce((a, b) => a + (new Date(b.selesai) - new Date(b.mulai)) / 3600000, 0);
        const dgnPeserta = aktif.filter((b) => b.jumlah_peserta != null);
        const rataPeserta = dgnPeserta.length ? dgnPeserta.reduce((a, b) => a + b.jumlah_peserta, 0) / dgnPeserta.length : null;
        return {
          ruangan: r, jumlah: punya.length, jam: jam,
          rataPeserta: rataPeserta, okupansi: rataPeserta != null && r.kapasitas ? (rataPeserta / r.kapasitas) * 100 : null,
          batal: punya.filter((b) => b.status.kode === "dibatalkan").length
        };
      });
    } catch (e) { RRM.ringkasan = null; RRM.baris = []; RRM.galat = e.message; }
    finally { RRM.memuat = false; isiLaporanRuangan(); }
  }

  function isiLaporanRuangan() {
    const w = document.getElementById("rrmIsi");
    if (!w) return;
    if (RRM.memuat) { w.innerHTML = `<div style="padding:60px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (RRM.galat) { w.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div><b>Gagal memuat.</b><br><span class="small">${U.esc(RRM.galat)}</span></div></div>`; return; }
    const r = RRM.ringkasan;
    const totalBooking = r.status.nilai || 0;
    const batal = (r.status.bagian || []).find((b) => b.kode === "dibatalkan");
    const cancelRate = totalBooking ? ((batal ? batal.jumlah : 0) / totalBooking) * 100 : 0;
    w.innerHTML = `
      <div class="grid g4 mb-16">
        ${U.kpi({ label: "Total Booking", value: U.num(totalBooking), icon: "calendar", tint: "brand", note: "Seluruh status, seluruh cakupan" })}
        ${U.kpi({ label: "Utilisasi Ruangan", value: r.utilisasi.nilai != null ? r.utilisasi.nilai : "—", suffix: r.utilisasi.nilai != null ? "%" : "", icon: "building", tint: "green", note: "Bulan berjalan" })}
        ${U.kpi({ label: "Cancellation Rate", value: cancelRate.toFixed(1).replace(".", ","), suffix: "%", icon: "x", tint: "red", note: (batal ? batal.jumlah : 0) + " dibatalkan" })}
        ${U.kpi({ label: "Menunggu Persetujuan", value: U.num(r.menunggu.nilai || 0), icon: "clock", tint: "amber", note: "Butuh tindak lanjut" })}
      </div>
      ${U.card("Tren Utilisasi 6 Bulan", (r.tren.titik || []).length
        ? U.barChart(r.tren.titik.map((t) => ({ m: t.label, val: t.nilai || 0 })), { color: "var(--brand-500)", fmt: (v) => v + "%" })
        : `<div class="empty" style="padding:20px"><span class="small muted">Belum ada data.</span></div>`, { sub: "Persen jam terpakai terhadap jam operasional" })}
      ${U.card("Rekap per Ruangan — Tahun Berjalan", RRM.baris.length ? U.table([
        { t: "Ruangan", render: (x) => `<b>${U.esc(x.ruangan.nama)}</b><div class="tiny faint">${U.esc(x.ruangan.kode)}</div>` },
        { t: "Jumlah Booking", cls: "center", render: (x) => x.jumlah },
        { t: "Jam Terpakai", cls: "right", render: (x) => U.num(Math.round(x.jam)) },
        { t: "Rata-rata Peserta", cls: "center", render: (x) => x.rataPeserta != null ? Math.round(x.rataPeserta) : "—" },
        { t: "Okupansi", cls: "center", render: (x) => x.okupansi != null ? Math.round(x.okupansi) + "%" : "—" },
        { t: "Pembatalan", cls: "center", render: (x) => x.batal }
      ], RRM.baris) : `<div class="empty" style="padding:20px"><span class="small muted">Belum ada ruangan terdaftar.</span></div>`, { bodyCls: "flush" })}`;
  }

  V["reportroom"] = {
    title: "Laporan Ruangan",
    sub: "Utilisasi, sebaran status booking, dan rekap per ruangan.",
    actions: `<button class="btn btn-sm" onclick="window.print()">${U.icon("print")} Cetak</button>`,
    render() { return `<div id="rrmIsi"></div>`; },
    mount() { muatLaporanRuangan(); }
  };

  /* Laporan Alat — ringkasan dari DataWidget, tanpa duplikasi listing.
   *
   * PENYEDERHANAAN & PENGGANTIAN YANG DISENGAJA:
   * - "Equipment Availability" purwarupa DIJATUHKAN — tidak ada definisi
   *   "tersedia" yang tunggal di server (aset umum dan alat lab berbagi
   *   satu tabel yang sama, tanpa penanda "ini alat lab"); memaksakan
   *   angka berarti mengarang pembilang/penyebutnya.
   * - "Downtime" (jam) purwarupa DIJATUHKAN — `AssetMaintenance` mencatat
   *   TANGGAL (`jadwal`/`dikerjakan_pada`), bukan rentang jam tidak
   *   tersedia; tidak ada satu pun tempat menyimpan durasi tidak aktif.
   * - Keduanya diganti dua KPI yang SUNGGUH dihitung server: "Sedang
   *   Dipinjam" (`peminjaman.aktif`) dan "Kalibrasi Kedaluwarsa"
   *   (`kalibrasi.kedaluwarsa`, angka yang sama dengan Dashboard).
   * - **Widget baru `aset.kepatuhan-kalibrasi`** ditambahkan ke
   *   `DataWidget`/`RegistriWidget` — dihitung dari query YANG SAMA PERSIS
   *   dengan `kalibrasi.kedaluwarsa` (dari sisi aset, dibalik), supaya
   *   daftar yang kedaluwarsa dan persentase yang patuh tidak pernah
   *   berselisih karena dua definisi berbeda.
   * - "Rincian per Alat" (baris per-alat: reservasi, jam, kondisi, status,
   *   kalibrasi) DIJATUHKAN — Peminjaman Alat (`V["eqbooking"]`) dan Asset
   *   Register sudah menyediakan daftar per-item yang identik; layar
   *   Laporan ini murni agregat, pola yang sama dengan Laporan Aset.
   * - "Status Kalibrasi" dan "Alat Paling Sering Digunakan" TETAP ADA —
   *   keduanya genuinely agregat (bukan baris mentah), dan sudah tersedia
   *   langsung dari widget/Repo yang ada tanpa aggregasi baru di server.
   */
  const RLT = { ringkasan: null, teratas: [], memuat: true, galat: null };

  async function muatLaporanAlat() {
    RLT.memuat = true; RLT.galat = null; isiLaporanAlat();
    try {
      const awalTahun = new Date(); awalTahun.setMonth(0, 1);
      const iso = (d) => d.toISOString().slice(0, 10);
      const [status, aktif, kepatuhan, kedaluwarsa, peminjaman] = await Promise.all([
        Repo.dashboard.widget("peminjaman.status"),
        Repo.dashboard.widget("peminjaman.aktif"),
        Repo.dashboard.widget("aset.kepatuhan-kalibrasi"),
        Repo.dashboard.widget("kalibrasi.kedaluwarsa"),
        Repo.peminjaman.daftar({ sejak: iso(awalTahun), sampai: iso(new Date()) }).then((j) => j.data)
      ]);
      RLT.ringkasan = { status: status, aktif: aktif, kepatuhan: kepatuhan, kedaluwarsa: kedaluwarsa };

      const perAlat = {};
      peminjaman
        .filter((p) => p.status.kode !== "ditolak" && p.status.kode !== "dibatalkan")
        .forEach((p) => {
          if (!p.alat) return;
          perAlat[p.alat.id] = perAlat[p.alat.id] || { nama: p.alat.nama, jumlah: 0 };
          perAlat[p.alat.id].jumlah++;
        });
      RLT.teratas = Object.values(perAlat).sort((a, b) => b.jumlah - a.jumlah).slice(0, 8);
    } catch (e) { RLT.ringkasan = null; RLT.teratas = []; RLT.galat = e.message; }
    finally { RLT.memuat = false; isiLaporanAlat(); }
  }

  function isiLaporanAlat() {
    const w = document.getElementById("rltIsi");
    if (!w) return;
    if (RLT.memuat) { w.innerHTML = `<div style="padding:60px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (RLT.galat) { w.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div><b>Gagal memuat.</b><br><span class="small">${U.esc(RLT.galat)}</span></div></div>`; return; }
    const r = RLT.ringkasan;
    w.innerHTML = `
      <div class="grid g4 mb-16">
        ${U.kpi({ label: "Total Reservasi", value: U.num(r.status.nilai || 0), icon: "grid", tint: "brand", note: "Seluruh status, seluruh cakupan" })}
        ${U.kpi({ label: "Sedang Dipinjam", value: U.num(r.aktif.nilai || 0), icon: "box", tint: "teal", note: "Saat ini" })}
        ${U.kpi({ label: "Kepatuhan Kalibrasi", value: r.kepatuhan.nilai != null ? r.kepatuhan.nilai : "—", suffix: r.kepatuhan.nilai != null ? "%" : "", icon: "shield", tint: "green", note: "Alat wajib kalibrasi" })}
        ${U.kpi({ label: "Kalibrasi Kedaluwarsa", value: U.num(r.kedaluwarsa.nilai || 0), icon: "alert", tint: "red", note: "Perlu tindak lanjut" })}
      </div>
      <div class="grid g2 mb-16">
        ${U.card("Alat Paling Sering Dipinjam", RLT.teratas.length
          ? U.hbars(RLT.teratas.map((t) => ({ n: t.nama, v: t.jumlah })), { suffix: "×", color: "var(--violet-500)" })
          : `<div class="empty" style="padding:20px"><span class="small muted">Belum ada peminjaman tahun ini.</span></div>`, { sub: "Tahun berjalan" })}
        ${U.card("Status Kalibrasi", (r.kedaluwarsa.baris || []).length ? U.table([
          { t: "Alat", render: (c) => `<b class="small">${U.esc(c.judul)}</b>` },
          { t: "Keterangan", render: (c) => `<span class="small">${U.esc(c.keterangan)}</span>` },
          { t: "Status", render: () => U.badge("Kedaluwarsa") }
        ], r.kedaluwarsa.baris) : `<div class="empty" style="padding:20px"><span class="small muted">Tidak ada kalibrasi kedaluwarsa.</span></div>`, { bodyCls: "flush",
          sub: r.kedaluwarsa.terpotong ? `Menampilkan 8 dari ${U.num(r.kedaluwarsa.nilai)}` : undefined })}
      </div>`;
  }

  V["reportequip"] = {
    title: "Laporan Alat",
    sub: "Frekuensi penggunaan dan kepatuhan kalibrasi alat.",
    actions: `<button class="btn btn-sm" onclick="window.print()">${U.icon("print")} Cetak</button>`,
    render() { return `<div id="rltIsi"></div>`; },
    mount() { muatLaporanAlat(); }
  };

  /* Laporan Aset — ringkasan agregat, bukan daftar per-baris.
   *
   * Purwarupa punya tabel "Rincian Aset" berisi baris per-aset — DIJATUHKAN
   * di sini karena layar Asset Register (V["assets"]) sudah menyediakan
   * daftar lengkap yang sama persis, lengkap dengan cari dan tapis.
   * Menduplikasinya di layar laporan hanya mengulang data yang sama tanpa
   * nilai tambah; laporan ini murni angka agregat.
   *
   * "Komposisi Aset per Kategori" (donut 5 kategori purwarupa yang dikarang
   * bebas — IT Equipment/Lab Equipment/Furniture/Audio Visual/Lainnya)
   * DIGANTI komposisi per kode barang BMN (`per_kode_barang` dari
   * RingkasanAset — 10 kode barang terbanyak) — pola yang sama dengan
   * penggantian "Kategori" pada Asset Register.
   *
   * "Penyusutan YTD" DIGANTI "Akumulasi Penyusutan" — Penyusutan::hitung()
   * hanya menjumlah akumulasi total sejak perolehan, tidak memisahkan
   * bagian yang jatuh pada tahun berjalan. Melabeli angka totalnya sebagai
   * "YTD" akan salah, bukan sekadar kurang presisi.
   *
   * Sakelar periode "Bulan Ini/YTD/Kustom" DIHILANGKAN — ringkasan aset
   * adalah potret posisi SAAT INI (kondisi, nilai buku), bukan metrik
   * deret waktu; sakelar periode purwarupa tidak berpadanan dengan apa pun
   * di sini.
   */
  const RAS = { ringkasan: null, memuat: true, galat: null };

  async function muatLaporanAset() {
    RAS.memuat = true; RAS.galat = null; isiLaporanAset();
    try { RAS.ringkasan = await Repo.aset.ringkasan(); }
    catch (e) { RAS.ringkasan = null; RAS.galat = e.message; }
    finally { RAS.memuat = false; isiLaporanAset(); }
  }

  function isiLaporanAset() {
    const w = document.getElementById("rasIsi");
    if (!w) return;
    if (RAS.memuat) { w.innerHTML = `<div style="padding:60px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (RAS.galat) { w.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div><b>Gagal memuat.</b><br><span class="small">${U.esc(RAS.galat)}</span></div></div>`; return; }
    const r = RAS.ringkasan;
    const jml = (k) => (r.kondisi.find((x) => x.kode === k) || { jumlah: 0 }).jumlah;
    w.innerHTML = `
      <div class="grid g4 mb-16">
        ${U.kpi({ label: "Nilai Perolehan", value: U.rpShort(r.nilai_perolehan), icon: "money", tint: "brand", note: U.num(r.jumlah) + " aset" })}
        ${U.kpi({ label: "Nilai Buku", value: U.rpShort(r.nilai_buku), icon: "chart", tint: "teal", note: "Setelah penyusutan" })}
        ${U.kpi({ label: "Akumulasi Penyusutan", value: U.rpShort(r.akumulasi_penyusutan), icon: "refresh", tint: "amber", note: "Metode garis lurus" })}
        ${U.kpi({ label: "Aset Dihapuskan", value: U.num(r.disposal.jumlah), icon: "trash", tint: "red", note: r.disposal.jumlah ? "Nilai buku " + U.rpShort(r.disposal.nilai_buku) : "Belum ada" })}
      </div>
      <div class="grid g2 mb-16">
        ${U.card("Komposisi per Kode Barang", r.per_kode_barang.length
          ? U.hbars(r.per_kode_barang.map((k) => ({ n: k.uraian, v: k.jumlah })), { color: "var(--brand-500)", suffix: " unit" })
          : `<div class="empty" style="padding:20px"><span class="small muted">Belum ada aset terdaftar.</span></div>`,
          { sub: "10 kode barang BMN terbanyak" })}
        ${U.card("Kondisi Aset", `<div class="col gap-12">
          ${[["B", "Baik", "var(--green-500)"], ["RR", "Rusak Ringan", "var(--amber-500)"], ["RB", "Rusak Berat", "var(--red-500)"]]
            .map(([kode, nama, c]) => U.meter(`<span class="small">${nama}</span>`, r.jumlah ? (jml(kode) / r.jumlah) * 100 : 0, c, U.num(jml(kode)))).join("")}</div>`)}
      </div>`;
  }

  V["reportasset"] = {
    title: "Laporan Aset",
    sub: "Nilai, penyusutan, kondisi, dan komposisi aset.",
    actions: `<button class="btn btn-sm" onclick="window.print()">${U.icon("print")} Cetak</button>`,
    render() { return `<div id="rasIsi"></div>`; },
    mount() { muatLaporanAset(); }
  };

  /* Laporan Penyewaan — ringkasan dari widget yang sudah ada, tanpa
   * pengulangan listing yang sudah ada.
   *
   * PENYEDERHANAAN & PENGGANTIAN YANG DISENGAJA:
   * - "Transaksi Sewa" (jumlah SELURUH transaksi sepanjang masa) purwarupa
   *   DIGANTI "Penyewaan Aktif" (`penyewaan.jumlah-aktif` — dikonfirmasi/
   *   berjalan saat ini) — tidak ada widget yang menghitung total
   *   transaksi sepanjang masa, dan "aktif saat ini" adalah pertanyaan
   *   operasional yang lebih berguna sehari-hari.
   * - "Nilai Rata-rata per Transaksi" DIJATUHKAN — akan berarti membagi
   *   pendapatan tahun berjalan (uang yang MASUK) dengan jumlah penyewaan
   *   aktif (yang SEDANG berjalan, bukan seluruh transaksi tahun ini) —
   *   dua hal yang tidak sepadan untuk dibagi, hasilnya angka yang
   *   tampak masuk akal tetapi sebenarnya tidak berarti apa-apa.
   * - "Kontribusi per Fasilitas" (5 fasilitas dengan persentase karangan)
   *   DIJATUHKAN — pendapatan tidak dipecah per fasilitas di mana pun;
   *   Payment melekat pada Invoice, bukan pada ruangan/laboratorium
   *   tertentu secara langsung.
   * - "Rekap Invoice" (baris per-invoice) DIJATUHKAN — layar Invoice &
   *   Tagihan (`V["invoice"]`) sudah menyediakan daftar lengkap yang
   *   sama persis dengan cari dan tapis; pola yang sama dengan Laporan
   *   Aset & Laporan Alat. Sebagai gantinya, tabel di sini KHUSUS
   *   menyoroti tagihan yang SUDAH lewat jatuh tempo — irisan yang
   *   berbeda, bukan pengulangan.
   */
  const RPY = { ringkasan: null, memuat: true, galat: null };

  async function muatLaporanPenyewaan() {
    RPY.memuat = true; RPY.galat = null; isiLaporanPenyewaan();
    try {
      const [aktif, pendapatan, tren, piutang, jatuhTempo] = await Promise.all([
        Repo.dashboard.widget("penyewaan.jumlah-aktif"),
        Repo.dashboard.widget("penyewaan.pendapatan-ytd"),
        Repo.dashboard.widget("penyewaan.tren-pendapatan"),
        Repo.dashboard.widget("tagihan.piutang"),
        Repo.dashboard.widget("tagihan.jatuh-tempo")
      ]);
      RPY.ringkasan = { aktif: aktif, pendapatan: pendapatan, tren: tren, piutang: piutang, jatuhTempo: jatuhTempo };
    } catch (e) { RPY.ringkasan = null; RPY.galat = e.message; }
    finally { RPY.memuat = false; isiLaporanPenyewaan(); }
  }

  function isiLaporanPenyewaan() {
    const w = document.getElementById("rpyIsi");
    if (!w) return;
    if (RPY.memuat) { w.innerHTML = `<div style="padding:60px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (RPY.galat) { w.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div><b>Gagal memuat.</b><br><span class="small">${U.esc(RPY.galat)}</span></div></div>`; return; }
    const r = RPY.ringkasan;
    w.innerHTML = `
      <div class="grid g4 mb-16">
        ${U.kpi({ label: "Pendapatan Tahun Berjalan", value: U.rpShort(r.pendapatan.nilai || 0), icon: "money", tint: "green", note: "Pembayaran terverifikasi" })}
        ${U.kpi({ label: "Penyewaan Aktif", value: U.num(r.aktif.nilai || 0), icon: "doc", tint: "brand", note: "Dikonfirmasi / berjalan" })}
        ${U.kpi({ label: "Piutang Belum Tertagih", value: U.rpShort(r.piutang.nilai || 0), icon: "clock", tint: "amber", note: "Seluruh invoice belum lunas" })}
        ${U.kpi({ label: "Lewat Jatuh Tempo", value: U.num(r.jatuhTempo.nilai || 0), icon: "alert", tint: "red", note: "invoice" })}
      </div>
      ${U.card("Tren Pendapatan 6 Bulan", (r.tren.titik || []).length
        ? U.barChart(r.tren.titik.map((t) => ({ m: t.label, val: t.nilai || 0 })), { color: "var(--green-500)", fmt: (v) => U.rpShort(v) })
        : `<div class="empty" style="padding:20px"><span class="small muted">Belum ada data.</span></div>`, { sub: "Dari pembayaran yang tercatat" })}
      ${U.card("Tagihan Lewat Jatuh Tempo", (r.jatuhTempo.baris || []).length ? U.table([
        { t: "Invoice", render: (c) => `<span class="mono small">${U.esc(c.judul)}</span>` },
        { t: "Keterangan", render: (c) => `<span class="small">${U.esc(c.keterangan)}</span>` },
        { t: "Status", render: () => U.badge("Lewat Jatuh Tempo") }
      ], r.jatuhTempo.baris) : `<div class="empty" style="padding:20px"><span class="small muted">Tidak ada tagihan yang lewat jatuh tempo.</span></div>`, { bodyCls: "flush",
        sub: r.jatuhTempo.terpotong ? `Menampilkan 8 dari ${U.num(r.jatuhTempo.nilai)}` : undefined })}`;
  }

  V["reportrental"] = {
    title: "Laporan Penyewaan",
    sub: "Pendapatan, penyewaan aktif, dan piutang.",
    actions: `<button class="btn btn-sm" onclick="window.print()">${U.icon("print")} Cetak</button>`,
    render() { return `<div id="rpyIsi"></div>`; },
    mount() { muatLaporanPenyewaan(); }
  };

  /* Laporan Maintenance — ringkasan dari widget yang sudah ada.
   *
   * PENYEDERHANAAN & PENGGANTIAN YANG DISENGAJA:
   * - "Total Downtime" dan "MTTR" purwarupa DIJATUHKAN — alasan yang
   *   SAMA PERSIS dengan Laporan Alat: `AssetMaintenance` mencatat
   *   TANGGAL (`jadwal`/`dikerjakan_pada`), bukan rentang jam tidak
   *   tersedia atau waktu perbaikan. Tidak ada satu pun tempat
   *   menyimpan durasi.
   * - "Performa Vendor" DIJATUHKAN SEPENUHNYA — tidak ada entitas Vendor
   *   di server; `pelaksana` pada `AssetMaintenance` adalah teks bebas
   *   (nama orang/pihak yang mengerjakan), bukan referensi ke tabel
   *   vendor dengan riwayat rating/biaya yang dapat direkap.
   * - "Rincian Work Order" (baris per-pekerjaan) DIJATUHKAN — modul
   *   Pemeliharaan & Kalibrasi yang sudah tersambung penuh menyediakan
   *   daftar yang sama persis dengan cari dan tapis; pola yang sama
   *   dengan Laporan Aset & Laporan Alat.
   * - "Work Order" (84, purwarupa) DIGANTI "Total Pekerjaan" dari
   *   `pemeliharaan.jenis` — SELURUH cakupan sepanjang waktu (tidak ada
   *   widget yang membatasi hitungan pekerjaan per tahun), diberi label
   *   yang jujur menyebut cakupannya, bukan disamakan dengan "tahun ini".
   * - "Pemeliharaan Terjadwal" (30 hari ke depan) ditambahkan sebagai
   *   tabel — bukan pengulangan, melainkan irisan "apa yang akan datang"
   *   yang berbeda dari daftar lengkap di modul Pemeliharaan & Kalibrasi.
   */
  const RMT = { ringkasan: null, memuat: true, galat: null };

  async function muatLaporanMaintenance() {
    RMT.memuat = true; RMT.galat = null; isiLaporanMaintenance();
    try {
      const [biaya, aktif, jenis, tren, terjadwal] = await Promise.all([
        Repo.dashboard.widget("pemeliharaan.biaya-ytd"),
        Repo.dashboard.widget("pemeliharaan.aktif"),
        Repo.dashboard.widget("pemeliharaan.jenis"),
        Repo.dashboard.widget("pemeliharaan.tren-biaya"),
        Repo.dashboard.widget("pemeliharaan.terjadwal")
      ]);
      RMT.ringkasan = { biaya: biaya, aktif: aktif, jenis: jenis, tren: tren, terjadwal: terjadwal };
    } catch (e) { RMT.ringkasan = null; RMT.galat = e.message; }
    finally { RMT.memuat = false; isiLaporanMaintenance(); }
  }

  function isiLaporanMaintenance() {
    const w = document.getElementById("rmtIsi");
    if (!w) return;
    if (RMT.memuat) { w.innerHTML = `<div style="padding:60px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (RMT.galat) { w.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div><b>Gagal memuat.</b><br><span class="small">${U.esc(RMT.galat)}</span></div></div>`; return; }
    const r = RMT.ringkasan;
    const jml = (kode) => (r.jenis.bagian || []).find((x) => x.kode === kode) || { jumlah: 0 };
    const warna = { preventif: "var(--green-500)", korektif: "var(--brand-500)", darurat: "var(--red-500)", kalibrasi: "var(--violet-500)" };
    w.innerHTML = `
      <div class="grid g4 mb-16">
        ${U.kpi({ label: "Biaya Tahun Berjalan", value: U.rpShort(r.biaya.nilai || 0), icon: "money", tint: "amber", note: "Pekerjaan selesai" })}
        ${U.kpi({ label: "Pekerjaan Aktif", value: U.num(r.aktif.nilai || 0), icon: "wrench", tint: "brand", note: "Dijadwalkan / berjalan" })}
        ${U.kpi({ label: "Total Pekerjaan", value: U.num(r.jenis.nilai || 0), icon: "grid", tint: "teal", note: "Seluruh cakupan" })}
        ${U.kpi({ label: "Terjadwal ≤30 Hari", value: U.num(r.terjadwal.nilai || 0), icon: "clock", tint: "red", note: "Perlu disiapkan" })}
      </div>
      <div class="grid g2 mb-16">
        ${U.card("Biaya Pemeliharaan 6 Bulan", (r.tren.titik || []).length
          ? U.barChart(r.tren.titik.map((t) => ({ m: t.label, val: t.nilai || 0 })), { color: "var(--amber-500)", fmt: (v) => U.rpShort(v) })
          : `<div class="empty" style="padding:20px"><span class="small muted">Belum ada data.</span></div>`, { sub: "Pekerjaan selesai per bulan" })}
        ${U.card("Pemeliharaan per Jenis", `<div class="col gap-12">
          ${Object.keys(warna).map((k) => U.meter(`<span class="small">${U.esc((r.jenis.bagian || []).find((x) => x.kode === k)?.nama || k)}</span>`,
            r.jenis.nilai ? (jml(k).jumlah / r.jenis.nilai) * 100 : 0, warna[k], U.num(jml(k).jumlah))).join("")}</div>`)}
      </div>
      ${U.card("Pemeliharaan Terjadwal — 30 Hari ke Depan", (r.terjadwal.baris || []).length ? U.table([
        { t: "Target", render: (c) => `<b class="small">${U.esc(c.judul)}</b>` },
        { t: "Keterangan", render: (c) => `<span class="small">${U.esc(c.keterangan)}</span>` },
        { t: "Status", render: (c) => U.badge(c.status === "berjalan" ? "In Progress" : "Scheduled") }
      ], r.terjadwal.baris) : `<div class="empty" style="padding:20px"><span class="small muted">Tidak ada pekerjaan terjadwal dalam 30 hari ke depan.</span></div>`, { bodyCls: "flush",
        sub: r.terjadwal.terpotong ? `Menampilkan 8 dari ${U.num(r.terjadwal.nilai)}` : undefined })}`;
  }

  V["reportmaint"] = {
    title: "Laporan Maintenance",
    sub: "Biaya, frekuensi, dan jadwal pemeliharaan & kalibrasi.",
    actions: `<button class="btn btn-sm" onclick="window.print()">${U.icon("print")} Cetak</button>`,
    render() { return `<div id="rmtIsi"></div>`; },
    mount() { muatLaporanMaintenance(); }
  };

  V["reportfinance"] = reportPage("Laporan Keuangan Fasilitas", "Pendapatan, biaya, margin, dan proyeksi pemanfaatan fasilitas.", () => `
    <div class="grid g4 mb-16">
      ${U.kpi({ label: "Pendapatan", value: U.rpShort(490000000), icon: "money", tint: "green", delta: 24, note: "Sewa & jasa uji" })}
      ${U.kpi({ label: "Biaya Operasional", value: U.rpShort(312000000), icon: "wrench", tint: "amber", delta: 9, note: "Maintenance, utilitas, vendor" })}
      ${U.kpi({ label: "Margin Kotor", value: U.rpShort(178000000), icon: "chart", tint: "brand", delta: 41, note: "36,3% dari pendapatan" })}
      ${U.kpi({ label: "Piutang Jatuh Tempo", value: U.rpShort(4500000), icon: "alert", tint: "red", note: "1 invoice overdue" })}
    </div>
    ${U.card("Ikhtisar Keuangan per Bulan", U.table([
      { t: "Bulan", render: (r) => `<b>${r.m}</b>` },
      { t: "Pendapatan", cls: "right", render: (r) => U.rp(r.val * 1000000) },
      { t: "Biaya Maintenance", cls: "right", render: (r, i) => U.rp(([28, 41, 19, 54, 33, 62, 40, 35][i] || 30) * 1000000) },
      { t: "Biaya Operasional Lain", cls: "right", render: () => U.rp(12000000) },
      { t: "Margin", cls: "right", render: (r, i) => { const m = r.val - ([28, 41, 19, 54, 33, 62, 40, 35][i] || 30) - 12;
          return `<b style="color:${m > 0 ? "var(--green-500)" : "var(--red-500)"}">${U.rp(m * 1000000)}</b>`; } },
      { t: "Margin %", cls: "right", render: (r, i) => { const m = r.val - ([28, 41, 19, 54, 33, 62, 40, 35][i] || 30) - 12;
          return `<span class="badge ${m > 0 ? "green" : "red"}">${Math.round((m / r.val) * 100)}%</span>`; } }
    ], D.analytics.revenue), { bodyCls: "flush" })}`);

})();
