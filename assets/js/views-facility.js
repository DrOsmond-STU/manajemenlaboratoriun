/* ==========================================================================
   FLMS — Views: Laboratorium, Alat, Kalibrasi, Maintenance, Ruangan, Auditorium
   ========================================================================== */
(function () {
  const U = UI, D = DB, V = window.VIEWS;

  /* =======================================================================
     LABORATORIUM
     ======================================================================= */
  /* =======================================================================
     LABORATORIUM — tersambung ke basis data

     Mengikuti pola yang sama dengan Ruangan: render() memasang kerangka,
     mount() mengambil datanya.
     ======================================================================= */

  const LAB = { baris: [], memuat: true, galat: null, tapis: {} };

  const STATUS_LAB_TINT = { aktif: "green", pemeliharaan: "amber", tidak_aktif: "slate" };

  function kartuLab(l) {
    const pj = l.penanggung_jawab;

    return `
      <div class="card res-card" onclick="showLab('${U.esc(String(l.id))}')">
        <div class="card-body">
          <div class="row mb-12">
            <div class="kpi-ico tint-teal">${U.icon("flask", 17)}</div>
            <div style="flex:1;min-width:0"><div class="rc-title trunc">${U.esc(l.nama)}</div>
              <div class="rc-meta">${U.esc(l.kode)}${l.jenis ? " • " + U.esc(l.jenis) : ""}</div></div>
            <span class="badge ${STATUS_LAB_TINT[l.status.kode] || "slate"}">${U.esc(l.status.nama)}</span>
          </div>
          <div class="grid g3 mb-12" style="gap:8px">
            <div><div class="tiny faint">Kapasitas</div><b>${l.kapasitas || 0} org</b></div>
            <div><div class="tiny faint">Luas</div><b>${l.luas_m2 ? l.luas_m2 + " m²" : "—"}</b></div>
            <div><div class="tiny faint">Aset</div><b>${l.jumlah_aset === null || l.jumlah_aset === undefined ? "—" : l.jumlah_aset}</b></div>
          </div>
          ${l.akreditasi
            ? `<div class="row small mb-8">${U.icon("shield", 13)}<span class="trunc">${U.esc(l.akreditasi)}</span></div>`
            : `<div class="row small muted mb-8">${U.icon("shield", 13)}<span>Belum terakreditasi</span></div>`}
          <div class="row small muted mt-12" style="padding-top:10px;border-top:1px solid var(--border)">
            ${pj ? `<span class="avatar sm">${U.initials(pj.nama)}</span>
              <div style="flex:1;min-width:0"><div class="trunc" style="font-size:12px">${U.esc(pj.nama)}</div>
              <div class="tiny faint">Penanggung jawab</div></div>`
              : `<div style="flex:1"><span class="tiny faint">Penanggung jawab belum ditetapkan</span></div>`}
            ${l.jam_layanan ? `<span class="badge outline tiny">${U.esc(l.jam_layanan)}</span>` : ""}
          </div>
        </div>
      </div>`;
  }

  function isiDaftarLab() {
    const wadah = document.getElementById("labDaftar");
    if (!wadah) return;

    if (LAB.memuat) {
      wadah.innerHTML = `<div class="card" style="padding:32px;text-align:center">
        <span class="muted">Memuat laboratorium…</span></div>`;
      return;
    }

    if (LAB.galat) {
      wadah.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div>
        <b>Gagal memuat laboratorium.</b><br><span class="small">${U.esc(LAB.galat)}</span></div></div>`;
      return;
    }

    if (!LAB.baris.length) {
      const adaTapis = Object.keys(LAB.tapis).some((k) => LAB.tapis[k]);
      wadah.innerHTML = `<div class="card" style="padding:40px;text-align:center">
        <div class="muted mb-12">${adaTapis
          ? "Tidak ada laboratorium yang cocok dengan penyaringan ini."
          : "Belum ada laboratorium yang terdaftar."}</div>
        ${adaTapis
          ? `<button class="btn btn-sm" onclick="labHapusTapis()">Hapus penyaringan</button>`
          : (Repo.dapatMenulis()
            ? `<button class="btn btn-primary btn-sm" onclick="labForm()">${U.icon("plus")} Tambah Laboratorium Pertama</button>`
            : `<span class="small muted">Masuk dengan akun untuk menambahkan laboratorium.</span>`)}
      </div>`;
      return;
    }

    wadah.innerHTML = `<div class="grid g3">${LAB.baris.map(kartuLab).join("")}</div>`;
  }

  function isiRingkasanLab() {
    const wadah = document.getElementById("labKpi");
    if (!wadah) return;

    const b = LAB.baris;
    const aktif = b.filter((l) => l.status.kode === "aktif").length;
    const kapasitas = b.reduce((a, l) => a + (l.kapasitas || 0), 0);
    const terakreditasi = b.filter((l) => l.akreditasi).length;
    const tanpaPj = b.filter((l) => !l.penanggung_jawab).length;

    wadah.innerHTML = `
      ${U.kpi({ label: "Total Laboratorium", value: b.length, icon: "flask", tint: "teal",
                note: aktif + " aktif" })}
      ${U.kpi({ label: "Total Kapasitas", value: U.num(kapasitas), suffix: "orang", icon: "users", tint: "brand", note: "Seluruh laboratorium" })}
      ${U.kpi({ label: "Terakreditasi", value: terakreditasi, suffix: "lab", icon: "shield", tint: "green", note: "ISO 17025 / KAN" })}
      ${U.kpi({ label: "Tanpa Penanggung Jawab", value: tanpaPj, icon: "alert",
                tint: tanpaPj ? "red" : "slate",
                note: tanpaPj ? "Perlu ditetapkan" : "Semua sudah ada" })}`;
  }

  async function muatLab() {
    LAB.memuat = true;
    LAB.galat = null;
    isiDaftarLab();

    try {
      const hasil = await Repo.laboratorium.daftar(LAB.tapis);
      LAB.baris = hasil.data;
    } catch (e) {
      LAB.baris = [];
      LAB.galat = e.message;
    } finally {
      LAB.memuat = false;
      isiDaftarLab();
      isiRingkasanLab();

      const sel = document.getElementById("labJenis");
      if (sel) {
        const terpilih = sel.value;
        sel.innerHTML = `<option value="">Semua Jenis</option>` +
          [...new Set(LAB.baris.map((l) => l.jenis).filter(Boolean))].sort()
            .map((v) => `<option${v === terpilih ? " selected" : ""}>${U.esc(v)}</option>`).join("");
      }
    }
  }

  window.labTapis = function (kunci, nilai) {
    if (nilai) LAB.tapis[kunci] = nilai; else delete LAB.tapis[kunci];
    muatLab();
  };

  window.labHapusTapis = function () {
    LAB.tapis = {};
    const c = document.getElementById("labCari");
    if (c) c.value = "";
    muatLab();
  };

  /* ------------------------------------------------------------- formulir */

  const STATUS_LAB_PILIHAN = [
    ["aktif", "Aktif"],
    ["pemeliharaan", "Pemeliharaan"],
    ["tidak_aktif", "Tidak Aktif"]
  ];

  window.labForm = async function (id) {
    if (!Repo.dapatMenulis()) {
      U.toast("Tidak tersedia", "Menyimpan laboratorium hanya bisa setelah masuk dengan akun.");
      return;
    }

    const l = id ? LAB.baris.find((x) => String(x.id) === String(id)) : null;
    const v = (x) => (x === null || x === undefined ? "" : U.esc(String(x)));

    // Daftar pengguna diambil SEKALI di sini lalu dipakai ketiga pemilih.
    // Mengambilnya tiga kali menghasilkan tiga permintaan identik yang
    // jawabannya pasti sama.
    let orang = [];
    try {
      orang = (await Repo.pengguna.daftar()).data;
    } catch (e) {
      // Formulir tetap dibuka. Kehilangan pemilih orang jauh lebih ringan
      // daripada tidak bisa menyunting sama sekali — kolom lainnya masih
      // dapat diisi, dan penanggung jawab dapat ditetapkan kemudian.
      orang = [];
    }

    const pilihOrang = (idEl, terpilih) =>
      `<select class="select" id="${idEl}">
         <option value="">— belum ditetapkan —</option>
         ${orang.map((o) => `<option value="${U.esc(String(o.id))}"${
           terpilih && String(terpilih) === String(o.id) ? " selected" : ""
         }>${U.esc(o.nama)}${o.unit_kerja ? " · " + U.esc(o.unit_kerja) : ""}</option>`).join("")}
       </select>`;

    const terpilihTeknisi = (l && l.teknisi ? l.teknisi : []).map((t) => String(t.id));

    U.drawer({
      size: "wide",
      title: l ? "Ubah Laboratorium" : "Tambah Laboratorium",
      sub: l ? l.kode : "Isian bertanda * wajib diisi",
      body: `
        <div id="labFormGalat" class="alert err mb-16" hidden></div>
        ${orang.length === 0 ? `<div class="alert warn mb-16">${U.icon("alert", 15)}<div>
          Daftar pengguna tidak dapat dimuat, jadi penanggung jawab, supervisor, dan teknisi
          belum dapat dipilih di sini. Isian lainnya tetap dapat disimpan.</div></div>` : ""}
        <div class="grid g2 gap-12">
          <label class="fld"><span>Kode laboratorium *</span>
            <input class="input" id="lKode" value="${v(l && l.kode)}" placeholder="LAB-KIM-01"></label>
          <label class="fld"><span>Nama laboratorium *</span>
            <input class="input" id="lNama" value="${v(l && l.nama)}" placeholder="Laboratorium Kimia Analitik"></label>
          <label class="fld"><span>Jenis</span>
            <input class="input" id="lJenis" value="${v(l && l.jenis)}" placeholder="Pengujian / Riset / Kalibrasi"></label>
          <label class="fld"><span>Unit kerja</span>
            <input class="input" id="lUnit" value="${v(l && l.unit_kerja)}" placeholder="Pengujian Mutu"></label>
          <label class="fld"><span>Luas (m²)</span>
            <input class="input" id="lLuas" type="number" min="0" value="${v(l && l.luas_m2)}"></label>
          <label class="fld"><span>Kapasitas (orang)</span>
            <input class="input" id="lKapasitas" type="number" min="0" value="${v(l && l.kapasitas)}"></label>
          <label class="fld"><span>Jam layanan</span>
            <input class="input" id="lJam" value="${v(l && l.jam_layanan)}" placeholder="07:30 – 17:00"></label>
          <label class="fld"><span>Status</span>
            <select class="select" id="lStatus">${STATUS_LAB_PILIHAN
              .map(([k, t]) => `<option value="${k}"${l && l.status.kode === k ? " selected" : ""}>${t}</option>`)
              .join("")}</select></label>
        </div>
        <label class="fld mt-12"><span>Akreditasi</span>
          <input class="input" id="lAkreditasi" value="${v(l && l.akreditasi)}"
                 placeholder="ISO/IEC 17025:2017 atau KAN LP-1234-IDN"></label>
        <p class="small muted mt-6">Kosongkan bila belum terakreditasi.</p>

        <div class="grid g2 gap-12 mt-12">
          <label class="fld"><span>Penanggung jawab</span>
            ${pilihOrang("lPj", l && l.penanggung_jawab && l.penanggung_jawab.id)}</label>
          <label class="fld"><span>Supervisor</span>
            ${pilihOrang("lSv", l && l.supervisor && l.supervisor.id)}</label>
        </div>

        <div class="fld mt-12"><span>Teknisi</span>
          <select class="select" id="lTeknisi" multiple size="6">
            ${orang.map((o) => `<option value="${U.esc(String(o.id))}"${
              terpilihTeknisi.indexOf(String(o.id)) !== -1 ? " selected" : ""
            }>${U.esc(o.nama)}${o.unit_kerja ? " · " + U.esc(o.unit_kerja) : ""}</option>`).join("")}
          </select></div>
        <p class="small muted mt-6">Tahan Ctrl (atau Cmd) untuk memilih lebih dari satu.
          Teknisi yang terdaftar di sini menerima notifikasi jadwal perawatan laboratorium ini.</p>

        <label class="fld mt-12"><span>Fasilitas</span>
          <input class="input" id="lFasilitas" value="${v(l && (l.fasilitas || []).join(', '))}"
                 placeholder="Fume Hood 4, Emergency Shower, Eye Wash, APAR CO2"></label>
        <p class="small muted mt-6">Pisahkan dengan koma.</p>

        <label class="fld mt-12"><span>Keterangan</span>
          <textarea class="input" id="lKeterangan" rows="3">${v(l && l.keterangan)}</textarea></label>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" id="labSimpan" onclick="labSimpan(${l ? "'" + U.esc(String(l.id)) + "'" : "null"})">
               ${l ? "Simpan Perubahan" : "Simpan Laboratorium"}</button>`
    });
  };

  window.labSimpan = async function (id) {
    const teks = (x) => {
      const el = document.getElementById(x);
      const t = el ? el.value.trim() : "";
      return t === "" ? null : t;
    };
    const angka = (x) => {
      const el = document.getElementById(x);
      if (!el || el.value === "") return null;
      const n = Number(el.value);
      return Number.isFinite(n) ? n : null;
    };
    const daftar = (x) => {
      const bagian = (document.getElementById(x).value || "")
        .split(",").map((s) => s.trim()).filter(Boolean);
      return bagian.length ? bagian : null;
    };

    const selTeknisi = document.getElementById("lTeknisi");
    const teknisi = Array.from(selTeknisi.selectedOptions).map((o) => Number(o.value));

    const isi = {
      kode: teks("lKode"),
      nama: teks("lNama"),
      jenis: teks("lJenis"),
      unit_kerja: teks("lUnit"),
      luas_m2: angka("lLuas"),
      kapasitas: angka("lKapasitas"),
      jam_layanan: teks("lJam"),
      akreditasi: teks("lAkreditasi"),
      status: document.getElementById("lStatus").value,
      penanggung_jawab_id: teks("lPj") ? Number(document.getElementById("lPj").value) : null,
      supervisor_id: teks("lSv") ? Number(document.getElementById("lSv").value) : null,
      // Selalu dikirim, termasuk saat kosong: larik kosong berarti "tidak ada
      // teknisinya", dan itu berbeda dari tidak dikirim sama sekali yang
      // berarti "jangan diubah".
      teknisi_ids: teknisi,
      fasilitas: daftar("lFasilitas"),
      keterangan: teks("lKeterangan")
    };

    const tombol = document.getElementById("labSimpan");
    const kotak = document.getElementById("labFormGalat");
    kotak.hidden = true;
    tombol.disabled = true;
    tombol.textContent = "Menyimpan…";

    try {
      await Repo.laboratorium.simpan(isi, id);
      U.closeDrawer();
      U.toast(id ? "Laboratorium diperbarui" : "Laboratorium tersimpan",
        isi.nama + " tersimpan ke basis data.");
      await muatLab();
    } catch (e) {
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan)
          .map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else {
        kotak.textContent = e.message || "Gagal menyimpan.";
      }
      kotak.hidden = false;
    } finally {
      tombol.disabled = false;
      tombol.textContent = id ? "Simpan Perubahan" : "Simpan Laboratorium";
    }
  };

  window.labHapus = function (id) {
    const l = LAB.baris.find((x) => String(x.id) === String(id));
    if (!l) return;

    U.modal({
      title: "Hapus laboratorium?",
      body: `<p>Laboratorium <b>${U.esc(l.nama)}</b> (${U.esc(l.kode)}) akan dihapus.</p>
             <p class="small muted mt-8">Penghapusan bersifat lunak. Laboratorium yang masih
             memiliki aset terdaftar tidak dapat dihapus — pindahkan asetnya lebih dulu.</p>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-danger" onclick="labHapusPasti('${U.esc(String(id))}')">Hapus</button>`
    });
  };

  window.labHapusPasti = async function (id) {
    try {
      await Repo.laboratorium.hapus(id);
      U.closeModal();
      U.closeDrawer();
      U.toast("Laboratorium dihapus", "Laboratorium telah dihapus.");
      await muatLab();
    } catch (e) {
      U.closeModal();
      Repo.tampilkanGalat(e, "Tidak dapat menghapus");
    }
  };

  /* --------------------------------------------------------------- detail */

  window.showLab = function (id) {
    const l = LAB.baris.find((x) => String(x.id) === String(id));
    if (!l) return;

    const baris = (label, isi) => isi === null || isi === undefined || isi === ""
      ? "" : `<dt>${label}</dt><dd>${isi}</dd>`;

    U.drawer({
      size: "wide",
      title: l.nama,
      sub: [l.kode, l.jenis, l.akreditasi].filter(Boolean).join(" • "),
      body: `
        <div class="grid g4 mb-16" style="gap:10px">
          ${[["Kapasitas", (l.kapasitas || 0) + " org"],
             ["Luas", l.luas_m2 ? l.luas_m2 + " m²" : "—"],
             ["Aset", l.jumlah_aset === null || l.jumlah_aset === undefined ? "—" : l.jumlah_aset],
             ["Teknisi", (l.teknisi || []).length]]
            .map(([k, v]) => `<div class="card"><div class="card-body tight center">
              <div class="tiny faint">${k}</div><b>${v}</b></div></div>`).join("")}
        </div>
        <div class="row wrap gap-6 mb-16">
          <span class="badge ${STATUS_LAB_TINT[l.status.kode] || "slate"}">${U.esc(l.status.nama)}</span>
          ${l.akreditasi ? `<span class="badge green">${U.esc(l.akreditasi)}</span>`
            : `<span class="badge slate">Belum terakreditasi</span>`}
          ${l.jam_layanan ? `<span class="badge outline">${U.esc(l.jam_layanan)}</span>` : ""}
        </div>
        <div class="dl mb-16">
          ${baris("Jenis", l.jenis ? U.esc(l.jenis) : null)}
          ${baris("Unit Kerja", l.unit_kerja ? U.esc(l.unit_kerja) : null)}
          ${baris("Ruangan", l.ruangan ? U.esc(l.ruangan.nama) + " (" + U.esc(l.ruangan.kode) + ")" : null)}
          ${baris("Penanggung Jawab", l.penanggung_jawab ? U.esc(l.penanggung_jawab.nama) : null)}
          ${baris("Supervisor", l.supervisor ? U.esc(l.supervisor.nama) : null)}
          ${baris("Teknisi", (l.teknisi || []).length
            ? l.teknisi.map((t) => `<span class="fac">${U.esc(t.nama)}</span>`).join(" ") : null)}
          ${baris("Keterangan", l.keterangan ? U.esc(l.keterangan) : null)}
        </div>
        ${(l.fasilitas || []).length ? `
          <h4 class="mb-8 muted">FASILITAS LABORATORIUM</h4>
          <div class="row wrap gap-6 mb-16">
            ${l.fasilitas.map((f) => `<span class="fac">${U.esc(f)}</span>`).join("")}</div>` : ""}
        <div class="mt-16" style="padding-top:16px;border-top:1px solid var(--border)">
          ${ckForResource('laboratorium', l.id)}</div>
        <div class="row gap-16 mt-16" style="padding-top:16px;border-top:1px solid var(--border)">
          ${U.qrBox(l.kode)}<div class="small muted">QR di pintu laboratorium menampilkan
            penanggung jawab, jam layanan, status akreditasi, dan daftar alat.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             ${Repo.dapatMenulis() ? `
               <button class="btn" onclick="labForm('${U.esc(String(l.id))}')">${U.icon("edit")} Ubah</button>
               <button class="btn btn-danger" onclick="labHapus('${U.esc(String(l.id))}')">Hapus</button>` : ""}
             <div class="spacer"></div>
             <button class="btn btn-primary" onclick="UI.closeDrawer();location.hash='#/equipment'">Lihat Alat</button>`
    });
  };

  V["lab"] = {
    title: "Manajemen Laboratorium",
    sub: "Profil, kapasitas, penanggung jawab, teknisi, fasilitas, dan status seluruh laboratorium.",
    get actions() {
      return Repo.dapatMenulis()
        ? `<button class="btn btn-primary btn-sm" onclick="labForm()">${U.icon("plus")} Tambah Laboratorium</button>`
        : "";
    },
    render() {
      return `
        <div class="grid g4 mb-16" id="labKpi"></div>
        <div class="card mb-16"><div class="tbl-toolbar">
          <div class="tbl-search">${U.icon("search", 15, "faint")}
            <input id="labCari" placeholder="Cari nama, kode, atau jenis…"></div>
          <select class="select" style="width:auto" id="labJenis"
                  onchange="labTapis('jenis', this.value)"><option value="">Semua Jenis</option></select>
          <select class="select" style="width:auto" onchange="labTapis('status', this.value)">
            <option value="">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="pemeliharaan">Pemeliharaan</option>
            <option value="tidak_aktif">Tidak Aktif</option></select>
          <div class="spacer"></div>
        </div></div>
        <div id="labDaftar"></div>`;
    },
    mount() {
      const cari = document.getElementById("labCari");
      if (cari) {
        cari.value = LAB.tapis.cari || "";
        let jeda;
        cari.addEventListener("input", function () {
          clearTimeout(jeda);
          jeda = setTimeout(() => labTapis("cari", cari.value.trim()), 300);
        });
      }
      muatLab();
    }
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
     ALAT LABORATORIUM — tersambung ke basis data

     Memakai backend Aset & BMN yang SAMA dengan Asset Register/Register BMN
     (Repo.aset, AssetController) — bukan domain terpisah. Bedanya murni
     TAPISAN: layar ini hanya menampilkan aset dengan `wajib_kalibrasi=true`
     (persis definisi "alat lab" yang sudah ada di skema — meja dan lemari
     asam tidak wajib kalibrasi), sama seperti Kalibrasi Alat & Maintenance
     berbagi satu tabel `asset_maintenances` dibedakan tapisan `jenis`.

     PENYEDERHANAAN & PENGGANTIAN YANG DISENGAJA:
     - KPI "Tersedia"/"Non-Operasional" dan kolom "Status" (Available/In
       Use/Borrowed/Maintenance/Broken/Calibration) purwarupa DIJATUHKAN —
       tidak ada kolom status operasional tersimpan pada `assets`; status
       semacam itu HARUS diturunkan dari peminjaman/pemeliharaan yang
       sedang aktif, bukan field tunggal yang bisa menyimpang dari
       kenyataan. Diganti "Sedang Dipinjam" (widget `peminjaman.aktif`,
       ANGKA YANG SAMA dengan Dashboard/Laporan Alat) dan "Kalibrasi
       Kedaluwarsa" (widget `kalibrasi.kedaluwarsa`, sudah ada sejak
       Laporan Alat) — dua metrik yang genuinely dihitung server, bukan
       dikarang.
     - Filter "Semua Kategori" (kategori bebas purwarupa) DIJATUHKAN —
       kategori baku sudah ada lewat kode barang BMN, dan Asset Register
       tidak menyediakan filter kategori juga (konsisten).
     - "Butuh Operator" dan "Tahun" (badge purwarupa) DIJATUHKAN — tidak
       ada kolom `needs_operator` atau tahun berdiri sendiri (yang ada
       `tgl_perolehan`, tanggal lengkap, ditampilkan sebagai perolehan).
     - Tombol "Ekspor ke Excel" TETAP `UI.demo()` — bukan disparitas data
       sumber, murni belum ada endpoint ekspor di server mana pun.
     ======================================================================= */

  const EQP = { baris: [], ringkasan: null, labs: [], widget: {}, memuat: true, galat: null, tapis: { cari: "", laboratory_id: "", kondisi: "" } };

  async function muatEquipment() {
    EQP.memuat = true; EQP.galat = null; isiEquipment(); isiRingkasanEquipment();
    try {
      const [daftar, ringkasan, labs] = await Promise.all([
        Repo.aset.daftar({ ...EQP.tapis, wajib_kalibrasi: 1 }),
        Repo.aset.ringkasan({ ...EQP.tapis, wajib_kalibrasi: 1 }),
        EQP.labs.length ? Promise.resolve({ data: EQP.labs }) : Repo.laboratorium.daftar()
      ]);
      EQP.baris = daftar.data || [];
      EQP.ringkasan = ringkasan;
      EQP.labs = labs.data || [];
    } catch (e) { EQP.baris = []; EQP.galat = e.message; }
    finally { EQP.memuat = false; isiEquipment(); isiRingkasanEquipment(); isiFilterLabEquipment(); }

    // Dimuat terpisah — peran yang berhak melihat Manajemen Alat belum
    // tentu berhak melihat widget dashboard.lihat; kegagalannya tidak
    // boleh merusak tabel yang sudah berhasil dimuat.
    try {
      const [pinjam, kal] = await Promise.all([
        Repo.dashboard.widget("peminjaman.aktif"),
        Repo.dashboard.widget("kalibrasi.kedaluwarsa")
      ]);
      EQP.widget = { pinjam, kal };
    } catch (e) { EQP.widget = {}; }
    isiRingkasanEquipment();
  }

  function isiFilterLabEquipment() {
    const sel = document.getElementById("eqpFilterLab");
    if (!sel || sel.options.length > 1) return;
    EQP.labs.forEach((l) => { sel.innerHTML += `<option value="${l.id}">${U.esc(l.nama)}</option>`; });
  }

  function isiRingkasanEquipment() {
    const w = document.getElementById("eqpKpi");
    if (!w) return;
    const r = EQP.ringkasan;
    const bermasalah = r ? (r.kondisi.find((k) => k.kode === "RB") || { jumlah: 0 }).jumlah : 0;
    w.innerHTML = `
      ${U.kpi({ label: "Total Alat", value: r ? U.num(r.jumlah) : "—", icon: "grid", tint: "violet", note: "Wajib kalibrasi" })}
      ${U.kpi({ label: "Nilai Investasi", value: r ? U.rpShort(r.nilai_perolehan) : "—", icon: "money", tint: "brand", note: "Harga perolehan" })}
      ${U.kpi({ label: "Sedang Dipinjam", value: EQP.widget.pinjam ? U.num(EQP.widget.pinjam.nilai || 0) : "—", icon: "box", tint: "amber", note: "Seluruh alat" })}
      ${U.kpi({ label: "Rusak Berat", value: r ? U.num(bermasalah) : "—", icon: "wrench", tint: "red", note: "Kondisi RB" })}
      ${U.kpi({ label: "Kalibrasi Kedaluwarsa", value: EQP.widget.kal ? U.num(EQP.widget.kal.nilai || 0) : "—", icon: "alert", tint: "red", note: "Diblokir dari reservasi" })}`;
  }

  function isiEquipment() {
    const w = document.getElementById("eqpTabel");
    if (!w) return;
    if (EQP.memuat) { w.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (EQP.galat) { w.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div><b>Gagal memuat.</b><br><span class="small">${U.esc(EQP.galat)}</span></div></div>`; return; }
    if (!EQP.baris.length) { w.innerHTML = U.emptyState("Belum ada alat wajib kalibrasi terdaftar", "Daftarkan lewat Register BMN."); return; }
    w.innerHTML = U.table([
      { t: "Kode Internal", w: "150px", render: (a) => `<span class="lnk mono" onclick="showEq(${JSON.stringify(a.id)})">${U.esc(a.kode_internal || "—")}</span>` },
      { t: "Nama Alat", render: (a) => `<b>${U.esc(a.nama)}</b><div class="tiny faint">${U.esc(a.merk || "—")}${a.serial_number ? " • SN " + U.esc(a.serial_number) : ""}</div>` },
      { t: "Kategori", render: (a) => `<span class="badge outline">${U.esc(a.bmn.uraian_barang || a.bmn.kode_barang)}</span>` },
      { t: "Laboratorium", render: (a) => a.laboratorium ? U.esc(a.laboratorium.nama) : `<span class="faint">—</span>` },
      { t: "Penanggung Jawab", render: (a) => a.penanggung_jawab ? `<span class="small">${U.esc(a.penanggung_jawab.nama)}</span>` : `<span class="faint">—</span>` },
      { t: "Kondisi", render: (a) => U.badge(a.kondisi.nama) },
      { t: "Kalibrasi", cls: "right", render: (a) => {
          const k = a.kalibrasi;
          if (!k || !k.berlaku_sampai) return `<span class="badge red">Belum pernah</span>`;
          const soon = !k.kedaluwarsa && k.berlaku_sampai < D.shift(30);
          return `<span class="badge ${k.kedaluwarsa ? "red" : soon ? "amber" : "green"}">${U.fdate(k.berlaku_sampai, "short")}</span>`; } },
      { t: "", cls: "actions", render: (a) => `<button class="icon-btn" onclick="showEq(${JSON.stringify(a.id)})">${U.icon("eye", 15)}</button>` }
    ], EQP.baris);
  }

  window.eqpTapis = function (field, value) {
    EQP.tapis[field] = value;
    muatEquipment();
  };

  V["equipment"] = {
    title: "Manajemen Alat Laboratorium",
    sub: "Registrasi, kondisi, kalibrasi, dan riwayat penggunaan alat wajib kalibrasi.",
    actions: `<button class="btn btn-sm" onclick="location.hash='#/barcode'">${U.icon("qr")} Cetak Label</button>
              <button class="btn btn-sm" onclick="UI.demo('Ekspor ke Excel')">${U.icon("download")} Ekspor</button>
              <button class="btn btn-primary btn-sm" onclick="location.hash='#/equipment/new'">${U.icon("plus")} Registrasi Alat (BMN)</button>`,
    render() {
      return `
        <div class="grid g5 mb-16" id="eqpKpi"></div>
        ${U.card("", `<div class="tbl-toolbar">
          <div class="tbl-search">${U.icon("search", 15, "faint")}
            <input id="eqpCari" placeholder="Cari nama, kode internal, atau serial number…"></div>
          <select class="select" id="eqpFilterLab" style="width:auto" onchange="eqpTapis('laboratory_id', this.value)">
            <option value="">Semua Laboratorium</option></select>
          <select class="select" style="width:auto" onchange="eqpTapis('kondisi', this.value)">
            <option value="">Semua Kondisi</option>
            <option value="B">Baik</option><option value="RR">Rusak Ringan</option><option value="RB">Rusak Berat</option></select>
          <div class="spacer"></div>
        </div><div id="eqpTabel"></div>`, { bodyCls: "flush" })}`;
    },
    mount() {
      const cari = document.getElementById("eqpCari");
      if (cari) {
        cari.value = EQP.tapis.cari || "";
        let jeda;
        cari.addEventListener("input", function () {
          clearTimeout(jeda);
          jeda = setTimeout(() => eqpTapis("cari", cari.value.trim()), 300);
        });
      }
      muatEquipment();
    }
  };

  window.showEq = async function (id) {
    U.drawer({ size: "wide", title: "Memuat…", body: `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`, foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>` });

    let a, riwayatPemeliharaan, penggunaan;
    try {
      [a, riwayatPemeliharaan, penggunaan] = await Promise.all([
        Repo.aset.ambil(id),
        Repo.pemeliharaan.daftar({ asset_id: id }).then((j) => j.data).catch(() => []),
        Repo.peminjaman.daftar({ asset_id: id }).then((j) => j.data).catch(() => [])
      ]);
    } catch (e) { Repo.tampilkanGalat(e, "Gagal memuat alat"); UI.closeDrawer(); return; }
    if (!a) { UI.closeDrawer(); return; }

    const cal = riwayatPemeliharaan.filter((m) => m.jenis.kode === "kalibrasi");
    const mt = riwayatPemeliharaan.filter((m) => m.jenis.kode !== "kalibrasi");
    const k = a.kalibrasi;
    const overdue = !!(k && k.kedaluwarsa);

    U.drawer({
      size: "wide", title: a.nama, sub: (a.kode_internal || a.bmn.id) + " • " + (a.bmn.uraian_barang || a.bmn.kode_barang),
      body: `
        ${overdue ? `<div class="alert err mb-16">${U.icon("alert", 17)}<div><b>Kalibrasi melewati jatuh tempo (atau belum pernah)</b>
          Alat sebaiknya tidak direservasi sampai kalibrasi ulang selesai dan sertifikat diunggah.</div></div>` : ""}
        <div class="row gap-16 mb-16">
          <div class="thumb" style="width:180px;flex:0 0 180px;aspect-ratio:4/3">
            <div class="lbl">${U.esc(a.bmn.uraian_barang || "Alat")}</div></div>
          <div style="flex:1">
            <div class="row wrap gap-6 mb-12">${U.badge(a.kondisi.nama)}
              ${k ? `<span class="badge ${overdue ? "red" : "green"}">${k.berlaku_sampai ? "Kalibrasi s/d " + U.fdate(k.berlaku_sampai, "short") : "Belum pernah kalibrasi"}</span>` : ""}</div>
            <div class="dl small" style="grid-template-columns:130px 1fr">
              <dt>Serial Number</dt><dd class="mono">${U.esc(a.serial_number || "—")}</dd>
              <dt>Laboratorium</dt><dd>${a.laboratorium ? U.esc(a.laboratorium.nama) : "—"}</dd>
              <dt>Penanggung Jawab</dt><dd>${a.penanggung_jawab ? U.esc(a.penanggung_jawab.nama) : "—"}</dd>
              <dt>Nilai Perolehan</dt><dd>${U.rp(a.penyusutan.nilai_perolehan)}</dd>
            </div>
          </div>
          <div class="center">${(Barcode && a.kode_internal ? Barcode.qr(a.kode_internal, { size: 96 }) : "") || ""}
            <div class="tiny faint mt-4">QR kode internal</div></div>
        </div>

        <div class="grid g2 mb-16" style="gap:10px">
          <div class="card" style="border-color:var(--brand-300)"><div class="card-body tight">
            <div class="tiny faint">PENOMORAN 1 — BMN (KUNCI UTAMA)</div>
            <div class="mono bold" style="font-size:11.5px;word-break:break-all">${U.esc(a.bmn.id || "—")}</div></div></div>
          <div class="card"><div class="card-body tight">
            <div class="tiny faint">PENOMORAN 2 — INTERNAL</div>
            <div class="mono bold" style="font-size:11.5px">${U.esc(a.kode_internal || "—")}</div></div></div>
        </div>

        <div class="grid g2 mb-16">
          ${U.card("Riwayat Kalibrasi", cal.length ? U.table(
            [{ t: "Tanggal", render: (c) => U.fdate(c.dikerjakan_pada || c.jadwal, "short") },
             { t: "Lembaga", render: (c) => `<span class="small">${U.esc((c.kalibrasi && c.kalibrasi.lembaga) || "—")}</span>` },
             { t: "Sertifikat", render: (c) => `<span class="small mono">${U.esc((c.kalibrasi && c.kalibrasi.no_sertifikat) || "—")}</span>` },
             { t: "Status", cls: "right", render: (c) => U.badge(c.status.nama) }], cal)
            : U.emptyState("Belum ada riwayat", ""), { bodyCls: "flush" })}
          ${U.card("Riwayat Maintenance", mt.length ? U.table(
            [{ t: "Tanggal", render: (m) => U.fdate(m.dikerjakan_pada || m.jadwal, "short") },
             { t: "Jenis", render: (m) => `<span class="badge outline">${U.esc(m.jenis.nama)}</span>` },
             { t: "Biaya", cls: "right", render: (m) => U.rp(m.biaya || 0) },
             { t: "Status", render: (m) => U.badge(m.status.nama) }], mt)
            : U.emptyState("Belum ada riwayat", ""), { bodyCls: "flush" })}
        </div>

        <div class="mb-16">${ckForResource("aset", a.id)}</div>

        ${U.card("Riwayat Penggunaan", penggunaan.length ? U.table(
          [{ t: "Peminjam", render: (b) => U.esc(b.peminjam ? b.peminjam.nama : "—") },
           { t: "Jadwal", render: (b) => U.fdate(b.jadwal.mulai, "short") + " – " + U.fdate(b.jadwal.selesai, "short") },
           { t: "Keperluan", render: (b) => `<span class="small">${U.esc(b.keperluan || "—")}</span>` },
           { t: "Status", render: (b) => U.badge(b.status.nama) }], penggunaan)
          : U.emptyState("Belum ada penggunaan tercatat", ""), { bodyCls: "flush" })}`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <button class="btn" onclick="UI.closeDrawer();showAsset(${JSON.stringify(a.id)})">${U.icon("box")} Data BMN</button>
             <button class="btn" onclick="UI.closeDrawer();lblOpenFor(${JSON.stringify(a.id)})">${U.icon("qr")} Cetak Label</button>
             <div class="spacer"></div>
             <button class="btn btn-primary" onclick="UI.closeDrawer();location.hash='#/eqbooking'">Pinjamkan</button>`
    });
  };

  /* =======================================================================
     PEMELIHARAAN & KALIBRASI — tersambung ke basis data

     Satu mesin untuk dua layar (Kalibrasi Alat, Maintenance & Work Order),
     persis seperti server menyimpan keduanya di satu tabel — lihat
     dokumentasi migrasi asset_maintenances. Yang membedakan kedua layar
     hanyalah TAPISNYA: Kalibrasi menampilkan jenis=kalibrasi saja,
     Maintenance menampilkan sisanya (preventif/korektif/darurat).
     ======================================================================= */

  const PML = { baris: [], memuat: true, galat: null };

  const STATUS_PML_TINT = { dijadwalkan: "brand", berjalan: "amber", selesai: "green", dibatalkan: "slate" };
  const JENIS_PML_TINT = { preventif: "green", korektif: "brand", darurat: "red", kalibrasi: "violet" };
  const JENIS_PML_IKON = { preventif: "shield", korektif: "edit", darurat: "alert", kalibrasi: "check" };

  async function muatPemeliharaan(kalibrasiSaja) {
    PML.memuat = true;
    PML.galat = null;
    isiPemeliharaan();

    try {
      // Server tidak mengenal filter "selain kalibrasi" — kalibrasi=false
      // berarti ambil semuanya lalu saring di sisi klien, karena satu-
      // satunya nilai jenis yang server pahami adalah nilai tunggal.
      const j = await Repo.pemeliharaan.daftar(kalibrasiSaja ? { jenis: "kalibrasi" } : {});
      PML.baris = kalibrasiSaja ? j.data : j.data.filter((m) => m.jenis.kode !== "kalibrasi");
    } catch (e) {
      PML.baris = [];
      PML.galat = e.message;
    } finally {
      PML.memuat = false;
      isiPemeliharaan();
      isiRingkasanPemeliharaan();
    }
  }

  function baristPml(m) {
    const sd = m.sumber_daya;
    return `
      <tr onclick="pmlLihat('${U.esc(String(m.id))}')" style="cursor:pointer">
        <td><b class="small">${sd ? U.esc(sd.nama) : "—"}</b>
          <div class="tiny faint">${sd ? { ruangan: "Ruangan", laboratorium: "Laboratorium", aset: "Alat" }[sd.jenis] : ""}</div></td>
        <td><span class="badge ${JENIS_PML_TINT[m.jenis.kode] || "slate"}">${U.esc(m.jenis.nama)}</span></td>
        <td>${U.fdate(m.jadwal, "short")}
          ${m.terlambat ? `<div class="tiny" style="color:var(--red-500);font-weight:600">terlambat</div>` : ""}</td>
        <td>${U.esc(m.pelaksana || "—")}${m.petugas ? `<div class="tiny faint">${U.esc(m.petugas.nama)}</div>` : ""}</td>
        <td class="right">${U.rp(m.biaya || 0)}</td>
        <td><span class="badge ${STATUS_PML_TINT[m.status.kode] || "slate"}">${U.esc(m.status.nama)}</span></td>
        <td class="actions"><button class="icon-btn" onclick="event.stopPropagation();pmlLihat('${U.esc(String(m.id))}')">${U.icon("eye", 15)}</button></td>
      </tr>`;
  }

  function isiPemeliharaan() {
    const wadah = document.getElementById("pmlDaftar");
    if (!wadah) return;

    if (PML.memuat) {
      wadah.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`;
      return;
    }
    if (PML.galat) {
      wadah.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div>
        <b>Gagal memuat.</b><br><span class="small">${U.esc(PML.galat)}</span></div></div>`;
      return;
    }
    if (!PML.baris.length) {
      wadah.innerHTML = U.emptyState("Belum ada pekerjaan tercatat",
        Repo.dapatMenulis() ? "" : "Masuk dengan akun untuk menjadwalkan pekerjaan.");
      return;
    }
    wadah.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Target</th><th>Jenis</th><th>Jadwal</th><th>Pelaksana</th>
        <th class="right">Biaya</th><th>Status</th><th></th></tr></thead>
      <tbody>${PML.baris.map(baristPml).join("")}</tbody></table></div>`;
  }

  function isiRingkasanPemeliharaan() {
    const wadah = document.getElementById("pmlKpi");
    if (!wadah) return;

    const b = PML.baris;
    const aktif = b.filter((m) => m.status.kode === "dijadwalkan" || m.status.kode === "berjalan").length;
    const terlambat = b.filter((m) => m.terlambat).length;
    const biaya = b.reduce((a, m) => a + (m.biaya || 0), 0);

    if (wadah.dataset.halaman === "kalibrasi") {
      wadah.innerHTML = `
        ${U.kpi({ label: "Kedaluwarsa", value: terlambat, icon: "alert", tint: "red", note: "Alat diblokir otomatis" })}
        ${U.kpi({ label: "Terjadwal", value: aktif - terlambat, icon: "calendar", tint: "brand", note: "Belum jatuh tempo" })}
        ${U.kpi({ label: "Selesai", value: b.filter((m) => m.status.kode === "selesai").length, icon: "check", tint: "green", note: "Tercatat" })}
        ${U.kpi({ label: "Biaya Kalibrasi", value: U.rpShort(biaya), icon: "money", tint: "teal", note: b.length + " pekerjaan" })}`;
    } else {
      const jumlahJenis = (k) => b.filter((m) => m.jenis.kode === k).length;
      wadah.innerHTML = `
        ${U.kpi({ label: "Aktif", value: aktif, icon: "wrench", tint: "amber", note: "Dijadwalkan/berjalan" })}
        ${U.kpi({ label: "Preventif", value: jumlahJenis("preventif"), icon: "shield", tint: "green", note: "Rutin" })}
        ${U.kpi({ label: "Korektif", value: jumlahJenis("korektif"), icon: "edit", tint: "brand", note: "Perbaikan" })}
        ${U.kpi({ label: "Darurat", value: jumlahJenis("darurat"), icon: "alert", tint: "red", note: "Penanganan segera" })}
        ${U.kpi({ label: "Total Biaya", value: U.rpShort(biaya), icon: "money", tint: "violet", note: "Periode berjalan" })}`;
    }
  }

  function halamanPemeliharaan(halaman) {
    const kalibrasi = halaman === "kalibrasi";
    return {
      title: kalibrasi ? "Kalibrasi Alat" : "Maintenance & Work Order",
      sub: kalibrasi
        ? "Jadwal, sertifikat, hasil, dan jatuh tempo kalibrasi alat laboratorium."
        : "Pemeliharaan preventif, korektif, dan penanganan darurat untuk ruangan, laboratorium, dan alat.",
      get actions() {
        return Repo.dapatMenulis()
          ? `<button class="btn btn-primary btn-sm" onclick="pmlForm('${halaman}')">${U.icon("plus")}
              ${kalibrasi ? "Jadwalkan Kalibrasi" : "Work Order Baru"}</button>`
          : "";
      },
      render() {
        return `<div class="grid g4 mb-16" id="pmlKpi" data-halaman="${halaman}"></div>
          <div id="pmlAlert" class="mb-16"></div>
          ${U.card(kalibrasi ? "Jadwal Kalibrasi" : "Daftar Work Order", `<div id="pmlDaftar"></div>`, { bodyCls: "flush" })}`;
      },
      mount() {
        muatPemeliharaan(kalibrasi);
        if (kalibrasi) muatAlertKalibrasi();
      }
    };
  }

  async function muatAlertKalibrasi() {
    const wadah = document.getElementById("pmlAlert");
    if (!wadah) return;
    try {
      const j = await Repo.pemeliharaan.kalibrasiKedaluwarsa();
      if (!j.data.length) { wadah.innerHTML = ""; return; }
      wadah.innerHTML = `<div class="alert err">${U.icon("alert", 18)}<div><b>${j.data.length} alat kalibrasinya kedaluwarsa</b>
        ${j.data.slice(0, 6).map((a) => U.esc(a.nama)).join(", ")}${j.data.length > 6 ? ", …" : ""}.
        Alat-alat ini tidak dapat direservasi sampai kalibrasi ulang selesai.</div></div>`;
    } catch (e) {
      wadah.innerHTML = "";
    }
  }

  V["calibration"] = halamanPemeliharaan("kalibrasi");
  V["maintenance"] = halamanPemeliharaan("maintenance");

  /* --------------------------------------------------------- detail & aksi */

  window.pmlLihat = async function (id) {
    U.drawer({ title: "Memuat…", body: `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>` });

    let m;
    try {
      m = await Repo.pemeliharaan.lihat(id);
    } catch (e) {
      U.closeDrawer();
      Repo.tampilkanGalat(e, "Gagal memuat");
      return;
    }
    if (!m) { U.closeDrawer(); return; }

    const sd = m.sumber_daya;
    const selesai = m.status.kode === "selesai" || m.status.kode === "dibatalkan";

    U.drawer({
      size: "wide",
      title: sd ? sd.nama : "Pekerjaan Pemeliharaan",
      sub: m.jenis.nama,
      body: `
        <div class="row wrap gap-6 mb-16">
          <span class="badge ${STATUS_PML_TINT[m.status.kode] || "slate"}">${U.esc(m.status.nama)}</span>
          ${m.terlambat ? `<span class="badge red">Terlambat</span>` : ""}
        </div>
        <div class="dl small mb-16" style="grid-template-columns:140px 1fr">
          <dt>Jadwal</dt><dd>${U.fdate(m.jadwal, "long")}</dd>
          ${m.dikerjakan_pada ? `<dt>Dikerjakan</dt><dd>${U.fdate(m.dikerjakan_pada, "long")}</dd>` : ""}
          <dt>Pelaksana</dt><dd>${U.esc(m.pelaksana || "—")}</dd>
          ${m.petugas ? `<dt>Petugas</dt><dd>${U.esc(m.petugas.nama)}</dd>` : ""}
          <dt>Biaya</dt><dd>${U.rp(m.biaya || 0)}</dd>
          ${m.hasil ? `<dt>Hasil</dt><dd>${U.esc(m.hasil)}</dd>` : ""}
          ${m.catatan ? `<dt>Catatan</dt><dd>${U.esc(m.catatan)}</dd>` : ""}
        </div>
        ${m.kalibrasi ? `
          <h4 class="mb-8 muted">SERTIFIKAT KALIBRASI</h4>
          <div class="dl small mb-16" style="grid-template-columns:140px 1fr">
            <dt>No. Sertifikat</dt><dd>${U.esc(m.kalibrasi.no_sertifikat || "—")}</dd>
            <dt>Lembaga</dt><dd>${U.esc(m.kalibrasi.lembaga || "—")}</dd>
            <dt>Berlaku Sampai</dt><dd>${m.kalibrasi.berlaku_sampai ? U.fdate(m.kalibrasi.berlaku_sampai, "long") : "—"}
              ${m.kalibrasi.kedaluwarsa ? `<span class="badge red ml-6">Kedaluwarsa</span>` : ""}</dd>
          </div>` : ""}
        ${!selesai && Repo.dapatMenulis() ? `<div id="pmlSelesaiForm"></div>` : ""}`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             ${!selesai && Repo.dapatMenulis()
               ? `<button class="btn btn-primary" onclick="pmlBukaSelesaikan('${U.esc(String(m.id))}')">${U.icon("check")} Selesaikan</button>` : ""}`
    });

    window.__pmlAktif = m;
  };

  window.pmlBukaSelesaikan = function (id) {
    const m = window.__pmlAktif;
    const kalibrasi = m.jenis.kode === "kalibrasi";
    const targetAlat = m.sumber_daya && m.sumber_daya.jenis === "aset";

    document.getElementById("pmlSelesaiForm").innerHTML = `
      <div style="padding-top:16px;margin-top:16px;border-top:1px solid var(--border)">
        <h4 class="mb-8 muted">SELESAIKAN PEKERJAAN</h4>
        <div id="pmlSelesaiGalat" class="alert err mb-12" hidden></div>
        <label class="fld"><span>Hasil</span>
          <textarea class="input" id="pmlHasil" rows="2" placeholder="Uraikan hasil pekerjaan"></textarea></label>
        <div class="grid g2 gap-12 mt-8">
          <label class="fld"><span>Dikerjakan pada</span>
            <input type="date" class="input" id="pmlDikerjakan" value="${new Date().toISOString().slice(0, 10)}"></label>
          <label class="fld"><span>Biaya (Rp)</span>
            <input type="number" class="input" id="pmlBiayaSelesai" value="${m.biaya || 0}"></label>
        </div>
        ${targetAlat ? `<label class="fld mt-8"><span>Kondisi alat setelah dikerjakan</span>
          <select class="select" id="pmlKondisi">
            <option value="">— tidak berubah —</option>
            <option value="B">Baik</option><option value="RR">Rusak Ringan</option><option value="RB">Rusak Berat</option>
          </select></label>` : ""}
        ${kalibrasi ? `
          <div class="grid g2 gap-12 mt-8">
            <label class="fld"><span>No. Sertifikat *</span><input class="input" id="pmlSertifikat"></label>
            <label class="fld"><span>Lembaga</span><input class="input" id="pmlLembaga" value="${U.esc(m.pelaksana || "")}"></label>
          </div>
          <label class="fld mt-8"><span>Berlaku Sampai *</span><input type="date" class="input" id="pmlBerlakuSampai"></label>` : ""}
        <button class="btn btn-primary btn-block mt-12" onclick="pmlSimpanSelesai('${U.esc(String(m.id))}')">Simpan Penyelesaian</button>
      </div>`;
  };

  window.pmlSimpanSelesai = async function (id) {
    const m = window.__pmlAktif;
    const isi = {
      hasil: document.getElementById("pmlHasil").value || null,
      dikerjakan_pada: document.getElementById("pmlDikerjakan").value || null,
      biaya: Number(document.getElementById("pmlBiayaSelesai").value) || 0
    };
    const kondisi = document.getElementById("pmlKondisi");
    if (kondisi && kondisi.value) isi.kondisi_setelah = kondisi.value;

    if (m.jenis.kode === "kalibrasi") {
      isi.no_sertifikat = document.getElementById("pmlSertifikat").value;
      isi.lembaga_kalibrasi = document.getElementById("pmlLembaga").value;
      isi.berlaku_sampai = document.getElementById("pmlBerlakuSampai").value;
    }

    const kotak = document.getElementById("pmlSelesaiGalat");
    kotak.hidden = true;

    try {
      await Repo.pemeliharaan.selesaikan(id, isi);
      U.closeDrawer();
      U.toast("Pekerjaan selesai", "Status dan riwayat diperbarui.");
      const kalibrasi = m.jenis.kode === "kalibrasi";
      muatPemeliharaan(kalibrasi);
      if (kalibrasi) muatAlertKalibrasi();
    } catch (e) {
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan).map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else {
        kotak.textContent = e.message || "Gagal menyelesaikan.";
      }
      kotak.hidden = false;
    }
  };

  /* --------------------------------------------------------------- formulir */

  window.pmlForm = async function (halaman) {
    if (!Repo.dapatMenulis()) {
      U.toast("Tidak tersedia", "Menjadwalkan pekerjaan hanya bisa setelah masuk dengan akun.");
      return;
    }
    const kalibrasi = halaman === "kalibrasi";

    let ruangan = [], lab = [], aset = [], orang = [];
    try {
      [ruangan, lab, aset, orang] = await Promise.all([
        kalibrasi ? [] : Repo.ruangan.daftar().then((j) => j.data).catch(() => []),
        kalibrasi ? [] : Repo.laboratorium.daftar().then((j) => j.data).catch(() => []),
        Repo.aset.daftar().then((j) => j.data).catch(() => []),
        Repo.pengguna.daftar().then((j) => j.data).catch(() => [])
      ]);
    } catch (e) { /* pemilih tetap dibuka dengan opsi kosong */ }

    window.__pmlPilihan = { room_id: ruangan, laboratory_id: lab, asset_id: aset, orang: orang };

    U.drawer({
      title: kalibrasi ? "Jadwalkan Kalibrasi" : "Work Order Baru",
      sub: "Target, jenis, dan jadwal pekerjaan",
      body: `
        <div id="pmlFormGalat" class="alert err mb-16" hidden></div>
        ${kalibrasi ? `
          <label class="fld"><span>Alat *</span>
            <select class="select" id="pmlSumberDaya">
              <option value="">— pilih alat —</option>
              ${aset.map((a) => `<option value="${U.esc(String(a.id))}">${U.esc(a.nama)} (${U.esc(a.kode_internal || "")})</option>`).join("")}
            </select></label>
          <label class="fld mt-8"><span>Lembaga Kalibrasi</span>
            <input class="input" id="pmlLembagaForm" placeholder="mis. BSN, PT Kalibrasi Presisi"></label>` : `
          <label class="fld"><span>Jenis Target *</span>
            <select class="select" id="pmlJenisTarget" onchange="pmlGantiJenisTarget()">
              <option value="room_id">Ruangan</option>
              <option value="laboratory_id">Laboratorium</option>
              <option value="asset_id">Alat</option>
            </select></label>
          <label class="fld mt-8" id="pmlSumberDayaWadah">
            <select class="select" id="pmlSumberDaya">
              <option value="">— pilih ruangan —</option>
              ${ruangan.map((r) => `<option value="${U.esc(String(r.id))}">${U.esc(r.nama)} (${U.esc(r.kode)})</option>`).join("")}
            </select></label>
          <label class="fld mt-8"><span>Jenis Pekerjaan *</span>
            <select class="select" id="pmlJenis">
              <option value="preventif">Pemeliharaan preventif</option>
              <option value="korektif">Pemeliharaan korektif</option>
              <option value="darurat">Penanganan darurat</option>
            </select></label>`}
        <div class="grid g2 gap-12 mt-8">
          <label class="fld"><span>Jadwal *</span><input type="date" class="input" id="pmlJadwal"></label>
          <label class="fld"><span>Petugas</span>
            <select class="select" id="pmlPetugas">
              <option value="">— pilih petugas —</option>
              ${orang.map((o) => `<option value="${U.esc(String(o.id))}">${U.esc(o.nama)}</option>`).join("")}
            </select></label>
        </div>
        <label class="fld mt-8"><span>Pelaksana (vendor/tim internal)</span>
          <input class="input" id="pmlPelaksana" placeholder="mis. Internal, PT Cool Tech"></label>
        <label class="fld mt-8"><span>Catatan</span>
          <textarea class="input" id="pmlCatatan" rows="2"></textarea></label>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" id="pmlFormSimpan" onclick="pmlFormSimpan('${halaman}')">Simpan</button>`
    });
  };

  window.pmlGantiJenisTarget = function () {
    const jenis = document.getElementById("pmlJenisTarget").value;
    const wadah = document.getElementById("pmlSumberDayaWadah");
    const daftar = (window.__pmlPilihan || {})[jenis] || [];

    if (jenis === "asset_id") {
      wadah.innerHTML = `<span>Alat *</span>
        <select class="select" id="pmlSumberDaya">
          <option value="">— pilih alat —</option>
          ${daftar.map((a) => `<option value="${U.esc(String(a.id))}">${U.esc(a.nama)}</option>`).join("")}
        </select>`;
      return;
    }
    wadah.innerHTML = `<span>${jenis === "room_id" ? "Ruangan" : "Laboratorium"} *</span>
      <select class="select" id="pmlSumberDaya">
        <option value="">— pilih —</option>
        ${daftar.map((d) => `<option value="${U.esc(String(d.id))}">${U.esc(d.nama)}</option>`).join("")}
      </select>`;
  };

  window.pmlFormSimpan = async function (halaman) {
    const kalibrasi = halaman === "kalibrasi";
    const jadwal = document.getElementById("pmlJadwal").value;
    const sumberDaya = document.getElementById("pmlSumberDaya").value;
    const kotak = document.getElementById("pmlFormGalat");
    const tombol = document.getElementById("pmlFormSimpan");
    kotak.hidden = true;

    if (!jadwal || !sumberDaya) {
      kotak.textContent = "Target dan jadwal wajib diisi.";
      kotak.hidden = false;
      return;
    }

    const isi = {
      jenis: kalibrasi ? "kalibrasi" : document.getElementById("pmlJenis").value,
      jadwal: jadwal,
      pelaksana: document.getElementById("pmlPelaksana").value || null,
      petugas_id: document.getElementById("pmlPetugas").value || null,
      catatan: document.getElementById("pmlCatatan").value || null
    };
    if (kalibrasi) {
      isi.asset_id = Number(sumberDaya);
      isi.lembaga_kalibrasi = document.getElementById("pmlLembagaForm").value || null;
    } else {
      isi[document.getElementById("pmlJenisTarget").value] = Number(sumberDaya);
    }

    tombol.disabled = true;
    tombol.textContent = "Menyimpan…";

    try {
      await Repo.pemeliharaan.jadwalkan(isi);
      U.closeDrawer();
      U.toast("Tersimpan", "Pekerjaan berhasil dijadwalkan.");
      muatPemeliharaan(kalibrasi);
      if (kalibrasi) muatAlertKalibrasi();
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

  /* =======================================================================
     RUANGAN — tersambung ke basis data

     Layar pertama yang benar-benar membaca dan menulis ke server. Pola di
     sini yang diikuti modul-modul berikutnya:

       render()  hanya memasang kerangka + penanda memuat, tanpa data
       mount()   mengambil data lewat Repo lalu mengisi kerangkanya

     Router memanggil render() secara sinkron, jadi data tidak mungkin sudah
     ada saat itu. Menunggu di render() akan membekukan seluruh aplikasi
     selama jaringan lambat; mengisi di mount() membuat kerangkanya muncul
     seketika dan datanya menyusul.
     ======================================================================= */

  /**
   * Grid ruangan versi PURWARUPA — masih membaca data.js.
   *
   * Dipakai view yang belum dikonversi ke API (Ruang Rapat, Auditorium).
   * Namanya sengaja menyebut "purwarupa" supaya sisa pekerjaan terlihat dari
   * kodenya sendiri, bukan hanya dari daftar tugas yang bisa tertinggal.
   */
  function roomGridPurwarupa(filter) {
    const rows = filter ? D.rooms.filter(filter) : D.rooms;
    return `<div class="grid g3">
      ${rows.map((r) => `
        <div class="card res-card" onclick="showRoomPurwarupa('${r.id}')">
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

  /** Keadaan layar ruangan. Di luar view supaya bertahan antar-render. */
  const RUANG = { baris: [], memuat: true, galat: null, tapis: {} };

  const STATUS_TINT = { tersedia: "green", pemeliharaan: "amber", tidak_aktif: "slate" };
  const SKEMA_TINT = {
    internal: "brand", internal_gratis: "teal", berbayar: "amber", terbatas: "red"
  };

  function kartuRuangan(r) {
    const fas = r.fasilitas || [];
    const tl = r.tata_letak || [];

    return `
      <div class="card res-card" onclick="showRoom('${U.esc(String(r.id))}')">
        <div class="thumb">${U.layoutDiagram(tl[0] || "Boardroom", 200, 112)}</div>
        <div class="rc-body">
          <div class="row"><div style="flex:1;min-width:0">
            <div class="rc-title trunc">${U.esc(r.nama)}</div>
            <div class="rc-meta">${U.esc(r.kode)}${r.jenis ? " • " + U.esc(r.jenis) : ""}</div></div>
            <span class="badge ${STATUS_TINT[r.status.kode] || "slate"}">${U.esc(r.status.nama)}</span></div>
          <div class="row mt-8 small muted gap-16">
            <span>${U.icon("users", 13)} ${r.kapasitas || 0} pax</span>
            ${r.gedung ? `<span>${U.icon("pin", 13)} ${U.esc(r.gedung)}${r.lantai ? "-" + U.esc(r.lantai) : ""}</span>` : ""}
            ${r.luas_m2 ? `<span>${r.luas_m2} m²</span>` : ""}</div>
          <div class="rc-facs">${fas.slice(0, 4).map((f) => `<span class="fac">${U.esc(f)}</span>`).join("")}
            ${fas.length > 4 ? `<span class="fac">+${fas.length - 4}</span>` : ""}</div>
          <div class="row mt-12" style="padding-top:10px;border-top:1px solid var(--border)">
            <span class="badge ${SKEMA_TINT[r.tarif.skema] || "slate"}">${U.esc(r.tarif.skema_nama)}</span>
            <div class="spacer"></div>
            <b class="small">${r.tarif.skema === "berbayar" && r.tarif.nilai ? U.rpShort(r.tarif.nilai) : "Tanpa tarif"}</b></div>
        </div>
      </div>`;
  }

  function isiDaftarRuangan() {
    const wadah = document.getElementById("ruangDaftar");
    if (!wadah) return;

    if (RUANG.memuat) {
      wadah.innerHTML = `<div class="card" style="padding:32px;text-align:center" class="muted">
        <span class="muted">Memuat ruangan…</span></div>`;
      return;
    }

    if (RUANG.galat) {
      wadah.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div>
        <b>Gagal memuat ruangan.</b><br><span class="small">${U.esc(RUANG.galat)}</span></div></div>`;
      return;
    }

    if (!RUANG.baris.length) {
      // Kosong karena penapisan berbeda maknanya dari kosong karena memang
      // belum ada data — yang pertama butuh tombol hapus tapis, yang kedua
      // butuh tombol tambah.
      const adaTapis = Object.keys(RUANG.tapis).some((k) => RUANG.tapis[k]);
      wadah.innerHTML = `<div class="card" style="padding:40px;text-align:center">
        <div class="muted mb-12">${adaTapis
          ? "Tidak ada ruangan yang cocok dengan penyaringan ini."
          : "Belum ada ruangan yang terdaftar."}</div>
        ${adaTapis
          ? `<button class="btn btn-sm" onclick="ruangHapusTapis()">Hapus penyaringan</button>`
          : (Repo.dapatMenulis()
            ? `<button class="btn btn-primary btn-sm" onclick="ruangForm()">${U.icon("plus")} Tambah Ruangan Pertama</button>`
            : `<span class="small muted">Masuk dengan akun untuk menambahkan ruangan.</span>`)}
      </div>`;
      return;
    }

    wadah.innerHTML = `<div class="grid g3">${RUANG.baris.map(kartuRuangan).join("")}</div>`;
  }

  function isiRingkasanRuangan() {
    const wadah = document.getElementById("ruangKpi");
    if (!wadah) return;

    const b = RUANG.baris;
    const kapasitas = b.reduce((a, r) => a + (r.kapasitas || 0), 0);
    const berbayar = b.filter((r) => r.tarif.skema === "berbayar").length;
    const luas = b.reduce((a, r) => a + (r.luas_m2 || 0), 0);
    const takTersedia = b.filter((r) => r.status.kode !== "tersedia").length;
    const gedung = new Set(b.map((r) => r.gedung).filter(Boolean)).size;

    // Angka dihitung dari baris yang benar-benar ada, bukan dari nilai tetap.
    // Ringkasan yang tidak ikut berubah saat datanya berubah adalah cara
    // paling halus membuat orang salah membaca keadaan.
    wadah.innerHTML = `
      ${U.kpi({ label: "Total Ruangan", value: b.length, icon: "building", tint: "brand",
                note: gedung ? gedung + " gedung" : "—" })}
      ${U.kpi({ label: "Total Kapasitas", value: U.num(kapasitas), suffix: "kursi", icon: "users", tint: "teal", note: "Seluruh ruangan" })}
      ${U.kpi({ label: "Ruangan Berbayar", value: berbayar, icon: "money", tint: "amber", note: "Dapat disewakan" })}
      ${U.kpi({ label: "Total Luas", value: U.num(luas), suffix: "m²", icon: "grid", tint: "violet", note: "Seluruh ruangan" })}
      ${U.kpi({ label: "Tidak Tersedia", value: takTersedia, icon: "wrench", tint: "red", note: "Pemeliharaan / tidak aktif" })}`;
  }

  async function muatRuangan() {
    RUANG.memuat = true;
    RUANG.galat = null;
    isiDaftarRuangan();

    try {
      const hasil = await Repo.ruangan.daftar(RUANG.tapis);
      RUANG.baris = hasil.data;
    } catch (e) {
      RUANG.baris = [];
      RUANG.galat = e.message;
    } finally {
      RUANG.memuat = false;
      isiDaftarRuangan();
      isiRingkasanRuangan();
      isiPilihanTapis();
    }
  }

  function isiPilihanTapis() {
    const selG = document.getElementById("ruangGedung");
    const selJ = document.getElementById("ruangJenis");
    if (!selG || !selJ) return;

    // Pilihan penyaringan dibangun dari data yang ada, bukan dari daftar
    // tetap: daftar tetap akan menawarkan gedung yang tidak punya satu pun
    // ruangan, dan menyembunyikan gedung yang baru ditambahkan.
    const isi = (sel, nilai, label) => {
      const terpilih = sel.value;
      sel.innerHTML = `<option value="">${label}</option>` +
        nilai.map((v) => `<option${v === terpilih ? " selected" : ""}>${U.esc(v)}</option>`).join("");
    };

    isi(selG, [...new Set(RUANG.baris.map((r) => r.gedung).filter(Boolean))].sort(), "Semua Gedung");
    isi(selJ, [...new Set(RUANG.baris.map((r) => r.jenis).filter(Boolean))].sort(), "Semua Jenis");
  }

  window.ruangTapis = function (kunci, nilai) {
    if (nilai) RUANG.tapis[kunci] = nilai; else delete RUANG.tapis[kunci];
    muatRuangan();
  };

  window.ruangHapusTapis = function () {
    RUANG.tapis = {};
    const c = document.getElementById("ruangCari");
    if (c) c.value = "";
    muatRuangan();
  };

  /* ------------------------------------------------------------- formulir */

  const SKEMA_PILIHAN = [
    ["internal", "Internal (tanpa tarif)"],
    ["internal_gratis", "Internal gratis, eksternal berbayar"],
    ["berbayar", "Berbayar"],
    ["terbatas", "Terbatas / khusus"]
  ];

  const STATUS_PILIHAN = [
    ["tersedia", "Tersedia"],
    ["pemeliharaan", "Pemeliharaan"],
    ["tidak_aktif", "Tidak aktif"]
  ];

  window.ruangForm = function (id) {
    if (!Repo.dapatMenulis()) {
      U.toast("Tidak tersedia", "Menyimpan ruangan hanya bisa setelah masuk dengan akun. Mode data contoh tidak menyimpan apa pun.");
      return;
    }

    const r = id ? RUANG.baris.find((x) => String(x.id) === String(id)) : null;
    const v = (x) => (x === null || x === undefined ? "" : U.esc(String(x)));

    const pilih = (nama, daftar, terpilih) =>
      `<select class="select" id="${nama}">${daftar
        .map(([k, l]) => `<option value="${k}"${k === terpilih ? " selected" : ""}>${l}</option>`)
        .join("")}</select>`;

    U.drawer({
      size: "wide",
      title: r ? "Ubah Ruangan" : "Tambah Ruangan",
      sub: r ? r.kode : "Isian bertanda * wajib diisi",
      body: `
        <div id="ruangFormGalat" class="alert err mb-16" hidden></div>
        <div class="grid g2 gap-12">
          <label class="fld"><span>Kode ruangan *</span>
            <input class="input" id="fKode" value="${v(r && r.kode)}" placeholder="CR-B-401"></label>
          <label class="fld"><span>Nama ruangan *</span>
            <input class="input" id="fNama" value="${v(r && r.nama)}" placeholder="Conference Room Garuda"></label>
          <label class="fld"><span>Jenis</span>
            <input class="input" id="fJenis" value="${v(r && r.jenis)}" placeholder="Conference Room"></label>
          <label class="fld"><span>Gedung</span>
            <input class="input" id="fGedung" value="${v(r && r.gedung)}" placeholder="Gedung B"></label>
          <label class="fld"><span>Lantai</span>
            <input class="input" id="fLantai" value="${v(r && r.lantai)}" placeholder="4"></label>
          <label class="fld"><span>Luas (m²)</span>
            <input class="input" id="fLuas" type="number" min="0" value="${v(r && r.luas_m2)}"></label>
          <label class="fld"><span>Kapasitas (kursi)</span>
            <input class="input" id="fKapasitas" type="number" min="0" value="${v(r && r.kapasitas)}"></label>
          <label class="fld"><span>Status</span>
            ${pilih("fStatus", STATUS_PILIHAN, r ? r.status.kode : "tersedia")}</label>
          <label class="fld"><span>Skema tarif</span>
            ${pilih("fSkema", SKEMA_PILIHAN, r ? r.tarif.skema : "internal")}</label>
          <label class="fld"><span>Tarif (Rp)</span>
            <input class="input" id="fTarif" type="number" min="0" value="${v(r && r.tarif.nilai)}"
                   placeholder="Wajib bila skemanya Berbayar"></label>
        </div>
        <label class="fld mt-12"><span>Tata letak yang didukung</span>
          <input class="input" id="fTataLetak" value="${v(r && (r.tata_letak || []).join(', '))}"
                 placeholder="Theater, Classroom, U-Shape"></label>
        <label class="fld mt-12"><span>Fasilitas</span>
          <input class="input" id="fFasilitas" value="${v(r && (r.fasilitas || []).join(', '))}"
                 placeholder="Proyektor, Sound System, Video Conf, AC"></label>
        <p class="small muted mt-6">Pisahkan dengan koma.</p>
        <label class="fld mt-12"><span>Keterangan</span>
          <textarea class="input" id="fKeterangan" rows="3">${v(r && r.keterangan)}</textarea></label>
        <label class="fld-cek mt-12">
          <input type="checkbox" id="fPersetujuan"${r && r.perlu_persetujuan ? " checked" : ""}>
          Pemesanan ruangan ini perlu persetujuan</label>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" id="ruangSimpan" onclick="ruangSimpan(${r ? "'" + U.esc(String(r.id)) + "'" : "null"})">
               ${r ? "Simpan Perubahan" : "Simpan Ruangan"}</button>`
    });
  };

  /** "a, b,, c" → ["a","b","c"]; kosong → null, bukan [""]. */
  function daftarDariTeks(teks) {
    const bagian = (teks || "").split(",").map((s) => s.trim()).filter(Boolean);
    return bagian.length ? bagian : null;
  }

  function nilaiAngka(id) {
    const el = document.getElementById(id);
    if (!el || el.value === "") return null;
    const n = Number(el.value);
    return Number.isFinite(n) ? n : null;
  }

  window.ruangSimpan = async function (id) {
    const teks = (x) => {
      const el = document.getElementById(x);
      const t = el ? el.value.trim() : "";
      return t === "" ? null : t;
    };

    const isi = {
      kode: teks("fKode"),
      nama: teks("fNama"),
      jenis: teks("fJenis"),
      gedung: teks("fGedung"),
      lantai: teks("fLantai"),
      luas_m2: nilaiAngka("fLuas"),
      kapasitas: nilaiAngka("fKapasitas"),
      status: document.getElementById("fStatus").value,
      skema_tarif: document.getElementById("fSkema").value,
      tarif: nilaiAngka("fTarif"),
      tata_letak: daftarDariTeks(document.getElementById("fTataLetak").value),
      fasilitas: daftarDariTeks(document.getElementById("fFasilitas").value),
      keterangan: teks("fKeterangan"),
      perlu_persetujuan: document.getElementById("fPersetujuan").checked
    };

    const tombol = document.getElementById("ruangSimpan");
    const kotak = document.getElementById("ruangFormGalat");
    kotak.hidden = true;
    tombol.disabled = true;
    tombol.textContent = "Menyimpan…";

    try {
      await Repo.ruangan.simpan(isi, id);
      U.closeDrawer();
      U.toast(id ? "Ruangan diperbarui" : "Ruangan tersimpan", isi.nama + " tersimpan ke basis data.");
      await muatRuangan();
    } catch (e) {
      // Galat validasi ditampilkan DI DALAM formulir, bukan sebagai toast
      // yang lewat: pengguna perlu membacanya sambil memperbaiki isiannya,
      // dan toast sudah hilang sebelum sempat dibaca ulang.
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan)
          .map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else {
        kotak.textContent = e.message || "Gagal menyimpan.";
      }
      kotak.hidden = false;
    } finally {
      tombol.disabled = false;
      tombol.textContent = id ? "Simpan Perubahan" : "Simpan Ruangan";
    }
  };

  window.ruangHapus = async function (id) {
    const r = RUANG.baris.find((x) => String(x.id) === String(id));
    if (!r) return;

    U.modal({
      title: "Hapus ruangan?",
      body: `<p>Ruangan <b>${U.esc(r.nama)}</b> (${U.esc(r.kode)}) akan dihapus.</p>
             <p class="small muted mt-8">Penghapusan bersifat lunak — datanya tetap tersimpan dan
             pemesanan lama tetap dapat ditelusuri. Ruangan yang masih punya pemesanan terjadwal
             tidak dapat dihapus.</p>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-danger" onclick="ruangHapusPasti('${U.esc(String(id))}')">Hapus</button>`
    });
  };

  window.ruangHapusPasti = async function (id) {
    try {
      await Repo.ruangan.hapus(id);
      U.closeModal();
      U.closeDrawer();
      U.toast("Ruangan dihapus", "Ruangan telah dihapus.");
      await muatRuangan();
    } catch (e) {
      U.closeModal();
      Repo.tampilkanGalat(e, "Tidak dapat menghapus");
    }
  };


  /* --------------------------------------------------------------- detail */

  window.showRoom = function (id) {
    const r = RUANG.baris.find((x) => String(x.id) === String(id));
    if (!r) return;

    const baris = (label, isi) => isi === null || isi === undefined || isi === ""
      ? "" : `<dt>${label}</dt><dd>${isi}</dd>`;

    U.drawer({
      size: "wide",
      title: r.nama,
      sub: [r.kode, r.jenis, r.gedung].filter(Boolean).join(" • "),
      body: `
        <div class="thumb mb-16" style="aspect-ratio:21/9">
          ${U.layoutDiagram((r.tata_letak || [])[0] || "Boardroom", 220, 100)}</div>
        <div class="row wrap gap-6 mb-16">
          <span class="badge ${STATUS_TINT[r.status.kode] || "slate"}">${U.esc(r.status.nama)}</span>
          <span class="badge ${SKEMA_TINT[r.tarif.skema] || "slate"}">${U.esc(r.tarif.skema_nama)}</span>
          ${r.kapasitas ? `<span class="badge outline">${r.kapasitas} kursi</span>` : ""}
          ${r.luas_m2 ? `<span class="badge outline">${r.luas_m2} m²</span>` : ""}
          ${r.perlu_persetujuan ? `<span class="badge amber">Perlu persetujuan</span>` : ""}</div>
        <div class="dl mb-16">
          ${baris("Lokasi", [r.gedung, r.lantai ? "lantai " + U.esc(r.lantai) : null].filter(Boolean).join(", ") || null)}
          ${baris("Jenis Ruangan", r.jenis ? U.esc(r.jenis) : null)}
          ${baris("Kapasitas", r.kapasitas ? r.kapasitas + " orang" : null)}
          ${baris("Luas", r.luas_m2 ? r.luas_m2 + " m²" : null)}
          ${baris("Tata Letak", (r.tata_letak || []).length
            ? r.tata_letak.map((l) => `<span class="fac">${U.esc(l)}</span>`).join(" ") : null)}
          ${baris("Penanggung Jawab", r.penanggung_jawab ? U.esc(r.penanggung_jawab.nama) : null)}
          ${baris("Tarif", r.tarif.skema === "berbayar" && r.tarif.nilai
            ? U.rp(r.tarif.nilai) : r.tarif.skema_nama)}
          ${baris("Pemesanan Terjadwal", r.jumlah_booking_aktif === null || r.jumlah_booking_aktif === undefined
            ? null : r.jumlah_booking_aktif)}
          ${baris("Keterangan", r.keterangan ? U.esc(r.keterangan) : null)}
        </div>
        ${(r.fasilitas || []).length ? `
          <h4 class="mb-8 muted">FASILITAS RUANGAN</h4>
          <div class="row wrap gap-6 mb-16">
            ${r.fasilitas.map((f) => `<span class="fac">${U.esc(f)}</span>`).join("")}</div>` : ""}
        <div class="mt-16" style="padding-top:16px;border-top:1px solid var(--border)">
          ${ckForResource('ruangan', r.id)}</div>
        <div class="row gap-16 mt-16" style="padding-top:16px;border-top:1px solid var(--border)">
          ${U.qrBox(r.kode)}<div class="small muted">QR di pintu ruangan menampilkan jadwal hari ini,
            penanggung jawab, status, dan tombol check-in cepat.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             ${Repo.dapatMenulis() ? `
               <button class="btn" onclick="ruangForm('${U.esc(String(r.id))}')">${U.icon("edit")} Ubah</button>
               <button class="btn btn-danger" onclick="ruangHapus('${U.esc(String(r.id))}')">Hapus</button>` : ""}
             <div class="spacer"></div>
             <button class="btn btn-primary" onclick="UI.closeDrawer();location.hash='#/booking/new'">Booking Ruangan</button>`
    });
  };

  V["rooms"] = {
    title: "Manajemen Ruangan",
    sub: "Seluruh ruangan: rapat, konferensi, training, workshop, VIP, dan serbaguna.",
    get actions() {
      // Tombol tambah hanya muncul bila memang dapat menyimpan. Menampilkannya
      // lalu menolak saat ditekan hanya membuang waktu orang.
      return `<button class="btn btn-sm" onclick="location.hash='#/availability'">${U.icon("calendar")} Ketersediaan</button>
              ${Repo.dapatMenulis()
                ? `<button class="btn btn-primary btn-sm" onclick="ruangForm()">${U.icon("plus")} Tambah Ruangan</button>`
                : ""}`;
    },
    render() {
      return `
        <div class="grid g5 mb-16" id="ruangKpi"></div>
        <div class="card mb-16"><div class="tbl-toolbar">
          <div class="tbl-search">${U.icon("search", 15, "faint")}
            <input id="ruangCari" placeholder="Cari nama, kode, atau gedung…"></div>
          <select class="select" style="width:auto" id="ruangGedung"
                  onchange="ruangTapis('gedung', this.value)"><option value="">Semua Gedung</option></select>
          <select class="select" style="width:auto" id="ruangJenis"
                  onchange="ruangTapis('jenis', this.value)"><option value="">Semua Jenis</option></select>
          <div class="spacer"></div>
        </div></div>
        <div id="ruangDaftar"></div>`;
    },
    mount() {
      const cari = document.getElementById("ruangCari");
      if (cari) {
        cari.value = RUANG.tapis.cari || "";

        // Ditunda 300 ms. Tanpa penundaan, mengetik "auditorium" mengirim
        // sepuluh permintaan yang jawabannya dapat tiba tidak berurutan —
        // dan yang tampil akhirnya jawaban untuk kata yang sudah usang.
        let jeda;
        cari.addEventListener("input", function () {
          clearTimeout(jeda);
          jeda = setTimeout(() => ruangTapis("cari", cari.value.trim()), 300);
        });
      }
      muatRuangan();
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
        ${roomGridPurwarupa((r) => ["Meeting Room", "Conference Room", "VIP"].includes(r.type))}`;
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

  window.showRoomPurwarupa = function (id) {
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
        <div class="mt-16" style="padding-top:16px;border-top:1px solid var(--border)">${ckForResource(null, r.id)}</div>
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
  /* =======================================================================
     ROOM LAYOUT MANAGEMENT — tersambung ke basis data

     Kartu jenis layout (Theater/Classroom/dst.) TETAP teks referensi statis
     — itu glosarium konsep, bukan data yang tersimpan di mana pun; tidak
     ada baris "jenis layout" untuk diedit atau dihapus, jadi tombol "Edit"
     purwarupa DIJATUHKAN (mengarang entitas yang tidak ada). "Ruangan
     Terkait" DISAMBUNGKAN sungguhan — memakai daftar ruangan yang sama
     dengan matriks di bawahnya, tanpa permintaan tambahan.

     Matriks Layout per Ruangan memakai `tata_letak` yang SUDAH ADA pada
     `assets/rooms` (Repo.ruangan, kolom bebas teks yang sama dipakai
     modul Ruangan) — tanpa satu pun perubahan backend. Kolom "Custom"
     purwarupa (selalu bertanda centang untuk SEMUA ruangan) DIJATUHKAN —
     bukan fakta yang tersimpan, hanya dekorasi yang secara literal selalu
     benar untuk ruangan apa pun sehingga tidak membawa informasi.
     ======================================================================= */

  const LYT_TIPE = [
    { n: "Theater", d: "Kursi berbaris menghadap panggung tanpa meja. Kapasitas maksimal.", cap: "100%", use: "Seminar, sosialisasi, wisuda" },
    { n: "Classroom", d: "Meja panjang menghadap depan. Nyaman untuk mencatat.", cap: "55%", use: "Pelatihan, workshop teknis" },
    { n: "U-Shape", d: "Meja membentuk huruf U, fasilitator di tengah.", cap: "35%", use: "Diskusi interaktif, FGD" },
    { n: "Boardroom", d: "Satu meja besar, peserta saling berhadapan.", cap: "30%", use: "Rapat direksi, negosiasi" },
    { n: "Banquet", d: "Meja bundar untuk 8–10 orang per meja.", cap: "50%", use: "Gathering, jamuan makan" },
    { n: "Cluster", d: "Kelompok meja kecil untuk kerja tim.", cap: "45%", use: "Workshop kreatif, hackathon" }
  ];

  const LYT = { rooms: null, memuat: true, galat: null };

  async function muatLayout() {
    LYT.memuat = true; LYT.galat = null; isiMatriksLayout();
    try { LYT.rooms = (await Repo.ruangan.daftar()).data || []; }
    catch (e) { LYT.rooms = null; LYT.galat = e.message; }
    finally { LYT.memuat = false; isiMatriksLayout(); }
  }

  function isiMatriksLayout() {
    const host = document.getElementById("lytMatrix");
    if (!host) return;
    if (LYT.memuat) { host.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat…</span></div>`; return; }
    if (LYT.galat) { host.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div><b>Gagal memuat.</b><br><span class="small">${U.esc(LYT.galat)}</span></div></div>`; return; }
    if (!LYT.rooms.length) { host.innerHTML = U.emptyState("Belum ada ruangan terdaftar", ""); return; }
    host.innerHTML = U.table(
      [{ t: "Ruangan", render: (r) => `<b>${U.esc(r.nama)}</b><div class="tiny faint">${U.esc(r.kode)} • ${r.kapasitas || 0} pax</div>` }]
        .concat(LYT_TIPE.map((l) => ({
          t: l.n, cls: "center",
          render: (r) => (r.tata_letak || []).includes(l.n) ? `<span style="color:var(--green-500)">${U.icon("check", 15)}</span>` : `<span class="faint">—</span>`
        }))),
      LYT.rooms);
  }

  window.lytRuanganTerkait = function (nama) {
    if (!LYT.rooms) { U.toast("Belum siap", "Daftar ruangan masih dimuat, coba lagi sesaat lagi."); return; }
    const cocok = LYT.rooms.filter((r) => (r.tata_letak || []).includes(nama));
    U.modal({
      title: "Ruangan Pendukung Layout " + nama,
      sub: cocok.length + " ruangan",
      body: cocok.length ? `<div class="col gap-8">${cocok.map((r) => `<div class="row">
        <div style="flex:1"><b class="small">${U.esc(r.nama)}</b><div class="tiny faint">${U.esc(r.kode)} • ${r.kapasitas || 0} pax</div></div>
      </div>`).join("")}</div>` : `<span class="small muted">Belum ada ruangan yang mencantumkan tata letak ini.</span>`
    });
  };

  V["layout"] = {
    title: "Room Layout Management",
    sub: "Konfigurasi layout ruangan: Classroom, U-Shape, Theater, Boardroom, Banquet, Cluster, dan custom.",
    actions: `<button class="btn btn-primary btn-sm" onclick="UI.demo('Editor layout custom')">${U.icon("plus")} Layout Custom</button>`,
    render() {
      return `
        <div class="grid g3 mb-16">
          ${LYT_TIPE.map((l) => `<div class="card"><div class="card-body">
            ${U.layoutDiagram(l.n, 200, 118)}
            <div class="row mt-12"><b style="flex:1">${l.n}</b><span class="badge brand">${l.cap} kapasitas</span></div>
            <div class="small muted mt-4">${l.d}</div>
            <div class="tiny faint mt-8">${U.icon("check", 11)} Cocok untuk: ${l.use}</div>
            <div class="row mt-12 gap-6">
              <button class="btn btn-sm" onclick="lytRuanganTerkait('${l.n}')">Ruangan Terkait</button></div>
          </div></div>`).join("")}
        </div>
        ${U.card("Matriks Layout per Ruangan", `<div id="lytMatrix"></div>`, { bodyCls: "flush", sub: "Layout yang dicantumkan setiap ruangan" })}`;
    },
    mount() { muatLayout(); }
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
