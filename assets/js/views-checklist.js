/* ==========================================================================
   FLMS — Checklist

   Template dibuat & dikelola pengguna sendiri; enam jenis (pengecekan &
   verifikasi, perawatan, persiapan penyewaan, kebersihan, kerapian,
   kelayakan); melekat pada ruangan, laboratorium, atau aset; ditugaskan
   kepada penanggung jawab.

   DUA HAL YANG BERBENTUK "DAFTAR" DI SINI, DUA CARA BERBEDA:

   Butir checklist adalah bagian dari templatnya — selalu dibaca bersama,
   tidak pernah berdiri sendiri. Penugasan sebaliknya: "checklist apa saja
   yang harus saya kerjakan hari ini" adalah pertanyaan yang benar-benar
   diajukan setiap pagi oleh petugas lapangan, dan itulah alasan penugasan
   disimpan sebagai baris tersendiri di server (checklist_assignments),
   bukan sebagai daftar id di dalam templatnya.

   PELAKSANAAN (run) TERPISAH DARI PENUGASAN. Siapa pun yang berwenang dapat
   menjalankan templat aktif terhadap sebuah sumber daya — dengan atau tanpa
   penugasan formal sebelumnya. Penugasan menjawab "siapa yang seharusnya
   mengerjakan", pelaksanaan mencatat "apa yang benar-benar terjadi". Karena
   itu tombol "Jalankan Checklist" pada detail ruangan/lab/aset TIDAK
   menuntut penugasan lebih dulu — memaksanya akan membuat pemeriksaan
   mendadak (audit dadakan, insiden) mustahil dicatat lewat jalur yang benar.
   ========================================================================== */
(function () {
  "use strict";

  const U = UI, D = DB, V = window.VIEWS;

  const JENIS_CK = {
    pengecekan: ["Pengecekan & Verifikasi", "brand", "check"],
    perawatan: ["Perawatan", "teal", "wrench"],
    penyewaan: ["Persiapan Penyewaan", "amber", "money"],
    kebersihan: ["Kebersihan", "green", "sparkle"],
    kerapian: ["Kerapian", "violet", "grid"],
    kelayakan: ["Kelayakan", "red", "shield"]
  };

  const PERIODE_CK = {
    harian: "Harian", mingguan: "Mingguan", bulanan: "Bulanan",
    triwulanan: "Triwulanan", tahunan: "Tahunan", insidental: "Insidental"
  };

  const TIPE_BUTIR = {
    ya_tidak: "Ya / Tidak", angka: "Angka", teks: "Teks bebas", pilihan: "Pilihan"
  };

  function ckWaktu(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) +
      " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function ckTint(jenis) { return (JENIS_CK[jenis] || ["", "slate"])[1]; }
  function ckIkon(jenis) { return (JENIS_CK[jenis] || ["", "", "check"])[2]; }
  const STATUS_RUN_TINT = { berjalan: "brand", selesai: "green", dibatalkan: "slate" };

  /* =======================================================================
     DAFTAR & PENGELOLAAN TEMPLATE
     ======================================================================= */

  const CK = { tpl: [], run: [], memuat: true, galat: null, tapis: {} };

  function ckKartuTemplat(t) {
    return `
      <div class="card res-card" onclick="ckLihatTemplat('${U.esc(String(t.id))}')">
        <div class="card-body">
          <div class="row mb-8">
            <span class="kpi-ico tint-${ckTint(t.jenis.kode)}" style="width:30px;height:30px;flex:0 0 30px">
              ${U.icon(ckIkon(t.jenis.kode), 14)}</span>
            <div style="flex:1;min-width:0"><div class="bold small trunc">${U.esc(t.nama)}</div>
              <div class="tiny faint">${U.esc(t.jenis.nama)}</div></div>
            ${t.aktif ? U.badge("Aktif") : `<span class="badge slate">Nonaktif</span>`}
          </div>
          ${t.deskripsi ? `<div class="small muted trunc-2 mb-8">${U.esc(t.deskripsi)}</div>` : ""}
          <div class="row small muted gap-16">
            <span>${U.icon("list", 13)} ${t.jumlah_butir || 0} butir</span>
            <span>${U.icon("users", 13)} ${t.jumlah_penugasan || 0} penugasan</span>
          </div>
        </div>
      </div>`;
  }

  function isiDaftarTemplat() {
    const wadah = document.getElementById("ckTplDaftar");
    if (!wadah) return;

    if (CK.memuat) {
      wadah.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat template…</span></div>`;
      return;
    }
    if (CK.galat) {
      wadah.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div>
        <b>Gagal memuat template.</b><br><span class="small">${U.esc(CK.galat)}</span></div></div>`;
      return;
    }
    if (!CK.tpl.length) {
      const adaTapis = Object.keys(CK.tapis).some((k) => CK.tapis[k]);
      wadah.innerHTML = `<div class="card" style="padding:40px;text-align:center">
        <div class="muted mb-12">${adaTapis
          ? "Tidak ada template yang cocok dengan penyaringan ini."
          : "Belum ada template checklist."}</div>
        ${adaTapis
          ? `<button class="btn btn-sm" onclick="ckHapusTapis()">Hapus penyaringan</button>`
          : (Repo.dapatMenulis()
            ? `<button class="btn btn-primary btn-sm" onclick="ckTemplatForm()">${U.icon("plus")} Buat Template Pertama</button>`
            : `<span class="small muted">Masuk dengan akun untuk membuat template.</span>`)}
      </div>`;
      return;
    }
    wadah.innerHTML = `<div class="grid g3">${CK.tpl.map(ckKartuTemplat).join("")}</div>`;
  }

  function isiRingkasanCk() {
    const wadah = document.getElementById("ckKpi");
    if (!wadah) return;

    const t = CK.tpl;
    const jenisTerpakai = new Set(t.map((x) => x.jenis.kode)).size;
    const aktif = t.filter((x) => x.aktif).length;
    const totalButir = t.reduce((a, x) => a + (x.jumlah_butir || 0), 0);
    const totalPenugasan = t.reduce((a, x) => a + (x.jumlah_penugasan || 0), 0);

    wadah.innerHTML = `
      ${U.kpi({ label: "Template Checklist", value: t.length, icon: "check", tint: "brand", note: jenisTerpakai + " dari 6 jenis dipakai" })}
      ${U.kpi({ label: "Template Aktif", value: aktif, icon: "play", tint: "green", note: "Dapat dijalankan" })}
      ${U.kpi({ label: "Total Butir", value: totalButir, icon: "list", tint: "teal", note: "Seluruh template" })}
      ${U.kpi({ label: "Total Penugasan", value: totalPenugasan, icon: "users", tint: "violet", note: "Melekat pada penanggung jawab" })}`;
  }

  async function muatTemplat() {
    CK.memuat = true;
    CK.galat = null;
    isiDaftarTemplat();

    try {
      const hasil = await Repo.checklist.templat(CK.tapis);
      CK.tpl = hasil.data;
    } catch (e) {
      CK.tpl = [];
      CK.galat = e.message;
    } finally {
      CK.memuat = false;
      isiDaftarTemplat();
      isiRingkasanCk();
    }
  }

  window.ckTapis = function (k, v) {
    if (v) CK.tapis[k] = v; else delete CK.tapis[k];
    muatTemplat();
  };
  window.ckHapusTapis = function () {
    CK.tapis = {};
    const c = document.getElementById("ckCari");
    if (c) c.value = "";
    muatTemplat();
  };
  window.ckFilterType = function (jenis) { ckTapis("jenis", jenis); };

  /* -------------------------------------------------------- builder templat */

  const CK_BUTIR_BARU = () => ({ teks: "", tipe: "ya_tidak", wajib: true, satuan: "", petunjuk: "", pilihan: "" });

  window.ckTemplatForm = function () {
    if (!Repo.dapatMenulis()) {
      U.toast("Tidak tersedia", "Membuat template hanya bisa setelah masuk dengan akun.");
      return;
    }

    const butir = [CK_BUTIR_BARU()];

    U.drawer({
      size: "wide",
      title: "Buat Template Checklist",
      sub: "Butir dapat ditambah atau dihapus sebelum disimpan",
      body: `
        <div id="ckTplGalat" class="alert err mb-16" hidden></div>
        <label class="fld"><span>Nama template *</span>
          <input class="input" id="tNama" placeholder="Pengecekan Harian Ruang Rapat"></label>
        <div class="grid g2 gap-12 mt-12">
          <label class="fld"><span>Jenis *</span>
            <select class="select" id="tJenis">${Object.keys(JENIS_CK)
              .map((k) => `<option value="${k}">${JENIS_CK[k][0]}</option>`).join("")}</select></label>
          <label class="fld"><span>Status</span>
            <select class="select" id="tAktif">
              <option value="1" selected>Aktif</option>
              <option value="0">Nonaktif</option></select></label>
        </div>
        <label class="fld mt-12"><span>Deskripsi</span>
          <textarea class="input" id="tDeskripsi" rows="2"
            placeholder="Kapan dan oleh siapa checklist ini biasanya dikerjakan"></textarea></label>

        <h4 class="mt-16 mb-8 muted">BUTIR PEMERIKSAAN</h4>
        <div id="ckButirList"></div>
        <button class="btn btn-sm mt-8" onclick="ckTambahButir()">${U.icon("plus")} Tambah Butir</button>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" id="ckTplSimpan" onclick="ckTplSimpan()">Simpan Template</button>`
    });

    window.__ckButir = butir;
    ckRenderButirList();
  };

  function ckRenderButirList() {
    const wadah = document.getElementById("ckButirList");
    if (!wadah) return;
    const butir = window.__ckButir || [];

    wadah.innerHTML = butir.map((b, i) => `
      <div class="card mb-8"><div class="card-body tight">
        <div class="row-t gap-8">
          <span class="tiny faint mono" style="padding-top:8px">${i + 1}</span>
          <div style="flex:1;min-width:0">
            <input class="input mb-6" placeholder="Teks butir pemeriksaan *"
              value="${U.esc(b.teks)}" oninput="ckSetButir(${i},'teks',this.value)">
            <div class="grid g3 gap-6">
              <select class="select" onchange="ckSetButir(${i},'tipe',this.value)">
                ${Object.keys(TIPE_BUTIR).map((k) =>
                  `<option value="${k}"${b.tipe === k ? " selected" : ""}>${TIPE_BUTIR[k]}</option>`).join("")}</select>
              <input class="input" placeholder="Satuan (opsional)"
                value="${U.esc(b.satuan)}" oninput="ckSetButir(${i},'satuan',this.value)"
                ${b.tipe !== "angka" ? "disabled" : ""}>
              <label class="fld-cek" style="align-self:center">
                <input type="checkbox" ${b.wajib ? "checked" : ""}
                  onchange="ckSetButir(${i},'wajib',this.checked)"> Wajib</label>
            </div>
            ${b.tipe === "pilihan" ? `
              <input class="input mt-6" placeholder="Pilihan, dipisah koma — Baik, Rusak Ringan, Rusak Berat"
                value="${U.esc(b.pilihan)}" oninput="ckSetButir(${i},'pilihan',this.value)">` : ""}
            <input class="input mt-6" placeholder="Petunjuk pengisian (opsional)"
              value="${U.esc(b.petunjuk)}" oninput="ckSetButir(${i},'petunjuk',this.value)">
          </div>
          <button class="icon-btn" title="Hapus butir" onclick="ckHapusButir(${i})">${U.icon("x", 14)}</button>
        </div>
      </div></div>`).join("");
  }

  window.ckSetButir = function (i, k, v) {
    window.__ckButir[i][k] = v;
    // Mengubah tipe butir bisa menyingkap atau menyembunyikan kolom satuan
    // dan pilihan — itu perlu digambar ulang. Kolom lain (yang terpicu tiap
    // ketukan lewat "oninput") sengaja TIDAK memicu ini, atau fokus mengetik
    // akan hilang di tengah kalimat.
    if (k === "tipe") ckRenderButirList();
  };
  window.ckTambahButir = function () {
    window.__ckButir.push(CK_BUTIR_BARU());
    ckRenderButirList();
  };
  window.ckHapusButir = function (i) {
    if (window.__ckButir.length <= 1) {
      U.toast("Tidak dapat dihapus", "Template harus memiliki minimal satu butir.", "warn");
      return;
    }
    window.__ckButir.splice(i, 1);
    ckRenderButirList();
  };

  window.ckTplSimpan = async function () {
    const teks = (id) => {
      const el = document.getElementById(id);
      const t = el ? el.value.trim() : "";
      return t === "" ? null : t;
    };

    const items = (window.__ckButir || [])
      .filter((b) => b.teks.trim() !== "")
      .map((b) => ({
        teks: b.teks.trim(),
        tipe: b.tipe,
        wajib: !!b.wajib,
        satuan: b.tipe === "angka" ? (b.satuan.trim() || null) : null,
        petunjuk: b.petunjuk.trim() || null,
        pilihan: b.tipe === "pilihan"
          ? b.pilihan.split(",").map((s) => s.trim()).filter(Boolean)
          : null
      }));

    const kotak = document.getElementById("ckTplGalat");
    const tombol = document.getElementById("ckTplSimpan");
    kotak.hidden = true;

    if (!items.length) {
      kotak.textContent = "Isi minimal satu butir dengan teksnya.";
      kotak.hidden = false;
      return;
    }

    tombol.disabled = true;
    tombol.textContent = "Menyimpan…";

    try {
      const tpl = await Repo.checklist.buatTemplat({
        nama: teks("tNama"),
        jenis: document.getElementById("tJenis").value,
        deskripsi: teks("tDeskripsi"),
        aktif: document.getElementById("tAktif").value === "1",
        items: items
      });
      U.closeDrawer();
      U.toast("Template tersimpan", tpl.nama + " siap ditugaskan atau dijalankan.");
      await muatTemplat();
    } catch (e) {
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan)
          .map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else {
        kotak.textContent = e.message || "Gagal menyimpan template.";
      }
      kotak.hidden = false;
    } finally {
      tombol.disabled = false;
      tombol.textContent = "Simpan Template";
    }
  };

  /* ------------------------------------------------------------- penugasan */

  window.ckTugaskanForm = async function (templatId) {
    if (!Repo.dapatMenulis()) {
      U.toast("Tidak tersedia", "Menugaskan checklist hanya bisa setelah masuk dengan akun.");
      return;
    }

    let orang = [], ruangan = [], lab = [];
    try {
      [orang, ruangan, lab] = await Promise.all([
        Repo.pengguna.daftar().then((j) => j.data).catch(() => []),
        Repo.ruangan.daftar().then((j) => j.data).catch(() => []),
        Repo.laboratorium.daftar().then((j) => j.data).catch(() => [])
      ]);
    } catch (e) { /* pemilih tetap dibuka dengan opsi kosong */ }

    U.drawer({
      title: "Tugaskan Checklist",
      sub: "Templat, sumber daya, penanggung jawab, dan periode",
      body: `
        <div id="ckTgsGalat" class="alert err mb-16" hidden></div>
        <label class="fld"><span>Sumber daya *</span>
          <select class="select" id="gJenis" onchange="ckGantiJenisSumberDaya()">
            <option value="room_id">Ruangan</option>
            <option value="laboratory_id">Laboratorium</option>
            <option value="asset_id">Aset (masukkan id)</option>
          </select></label>
        <label class="fld mt-8" id="gSumberDayaWadah">
          <select class="select" id="gSumberDaya">
            <option value="">— pilih ruangan —</option>
            ${ruangan.map((r) => `<option value="${U.esc(String(r.id))}">${U.esc(r.nama)} (${U.esc(r.kode)})</option>`).join("")}
          </select></label>
        <label class="fld mt-12"><span>Penanggung jawab *</span>
          <select class="select" id="gUser">
            <option value="">— pilih penanggung jawab —</option>
            ${orang.map((o) => `<option value="${U.esc(String(o.id))}">${U.esc(o.nama)}${o.unit_kerja ? " · " + U.esc(o.unit_kerja) : ""}</option>`).join("")}
          </select></label>
        <label class="fld mt-12"><span>Periode</span>
          <select class="select" id="gPeriode">
            ${Object.keys(PERIODE_CK).map((k) => `<option value="${k}"${k === "bulanan" ? " selected" : ""}>${PERIODE_CK[k]}</option>`).join("")}
          </select></label>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Batal</button>
             <button class="btn btn-primary" id="ckTgsSimpan"
               onclick="ckTugaskanSimpan('${U.esc(String(templatId))}')">Tugaskan</button>`
    });

    window.__ckPilihanSumberDaya = { room_id: ruangan, laboratory_id: lab };
  };

  window.ckGantiJenisSumberDaya = function () {
    const jenis = document.getElementById("gJenis").value;
    const wadah = document.getElementById("gSumberDayaWadah");

    if (jenis === "asset_id") {
      wadah.innerHTML = `<span>Id aset *</span>
        <input class="input" id="gSumberDaya" type="number" min="1"
          placeholder="Lihat kode BMN pada Register BMN">`;
      return;
    }

    const daftar = (window.__ckPilihanSumberDaya || {})[jenis] || [];
    wadah.innerHTML = `<span>${jenis === "room_id" ? "Ruangan" : "Laboratorium"} *</span>
      <select class="select" id="gSumberDaya">
        <option value="">— pilih —</option>
        ${daftar.map((d) => `<option value="${U.esc(String(d.id))}">${U.esc(d.nama)}</option>`).join("")}
      </select>`;
  };

  window.ckTugaskanSimpan = async function (templatId) {
    const jenis = document.getElementById("gJenis").value;
    const sumberDaya = document.getElementById("gSumberDaya").value;
    const userId = document.getElementById("gUser").value;
    const kotak = document.getElementById("ckTgsGalat");
    const tombol = document.getElementById("ckTgsSimpan");

    kotak.hidden = true;

    if (!sumberDaya || !userId) {
      kotak.textContent = "Sumber daya dan penanggung jawab wajib dipilih.";
      kotak.hidden = false;
      return;
    }

    const isi = {
      checklist_template_id: Number(templatId),
      user_id: Number(userId),
      periode: document.getElementById("gPeriode").value
    };
    isi[jenis] = Number(sumberDaya);

    tombol.disabled = true;
    tombol.textContent = "Menugaskan…";

    try {
      await Repo.checklist.tugaskan(isi);
      U.closeDrawer();
      U.toast("Checklist ditugaskan", "Muncul pada Checklist Saya milik penanggung jawab.");
      await muatTemplat();
    } catch (e) {
      if (e.status === 422 && e.perMedan) {
        kotak.innerHTML = Object.keys(e.perMedan)
          .map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("");
      } else {
        kotak.textContent = e.message || "Gagal menugaskan checklist.";
      }
      kotak.hidden = false;
    } finally {
      tombol.disabled = false;
      tombol.textContent = "Tugaskan";
    }
  };

  /* --------------------------------------------------------- detail templat */

  window.ckLihatTemplat = async function (id) {
    U.drawer({
      title: "Memuat…", body: `<div style="padding:32px;text-align:center"><span class="muted">Memuat template…</span></div>`
    });

    let tpl;
    try {
      tpl = await Repo.checklist.lihatTemplat(id);
    } catch (e) {
      U.closeDrawer();
      Repo.tampilkanGalat(e, "Gagal memuat template");
      return;
    }
    if (!tpl) { U.closeDrawer(); return; }

    const butirHTML = (tpl.butir || []).map((b, i) => `
      <div class="row-t" style="padding:8px 0;${i ? "border-top:1px solid var(--border)" : ""}">
        <span class="tiny faint mono" style="width:20px;padding-top:2px">${i + 1}</span>
        <div style="flex:1;min-width:0">
          <div class="small">${U.esc(b.teks)}${b.wajib ? ` <span style="color:var(--red-500)">*</span>` : ""}</div>
          <div class="tiny faint">${U.esc(b.tipe.nama)}${b.satuan ? " · " + U.esc(b.satuan) : ""}
            ${(b.pilihan || []).length ? " · " + b.pilihan.map(U.esc).join(", ") : ""}</div>
          ${b.petunjuk ? `<div class="tiny faint" style="font-style:italic">${U.esc(b.petunjuk)}</div>` : ""}
        </div>
      </div>`).join("");

    U.drawer({
      size: "wide",
      title: tpl.nama,
      sub: tpl.jenis.nama + (tpl.dibuat_oleh ? " · dibuat oleh " + tpl.dibuat_oleh.nama : ""),
      body: `
        <div class="row wrap gap-6 mb-16">
          ${tpl.aktif ? U.badge("Aktif") : `<span class="badge slate">Nonaktif</span>`}
          <span class="badge outline">${(tpl.butir || []).length} butir</span>
          <span class="badge outline">${tpl.jumlah_penugasan || 0} penugasan</span>
        </div>
        ${tpl.deskripsi ? `<p class="small muted mb-16">${U.esc(tpl.deskripsi)}</p>` : ""}
        <h4 class="mb-8 muted">BUTIR PEMERIKSAAN</h4>
        <div class="mb-16">${butirHTML}</div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <div class="spacer"></div>
             ${Repo.dapatMenulis() ? `
               <button class="btn" onclick="ckTugaskanForm('${U.esc(String(tpl.id))}')">
                 ${U.icon("users")} Tugaskan</button>` : ""}`
    });
  };

  V["checklist"] = {
    title: "Checklist Pengecekan & Perawatan",
    sub: "Template dibuat dan dikelola sendiri oleh pengguna, melekat pada ruangan, laboratorium, atau aset, serta ditugaskan kepada penanggung jawab.",
    get actions() {
      return `<button class="btn btn-sm" onclick="location.hash='#/mychecklist'">${U.icon("users")} Checklist Saya</button>
        ${Repo.dapatMenulis()
          ? `<button class="btn btn-primary btn-sm" onclick="ckTemplatForm()">${U.icon("plus")} Buat Template</button>`
          : ""}`;
    },
    render() {
      return `
        <div class="grid g4 mb-16" id="ckKpi"></div>
        <div class="grid g6 mb-16" style="gap:12px">
          ${Object.keys(JENIS_CK).map((k) => `
            <div class="card res-card" onclick="ckFilterType('${k}')"><div class="card-body tight center">
              <div class="kpi-ico tint-${JENIS_CK[k][1]}" style="margin:0 auto 8px">${U.icon(JENIS_CK[k][2], 17)}</div>
              <div class="small bold">${JENIS_CK[k][0]}</div></div></div>`).join("")}
        </div>
        <div class="card mb-16"><div class="tbl-toolbar">
          <div class="tbl-search">${U.icon("search", 15, "faint")}
            <input id="ckCari" placeholder="Fitur pencarian nama tersedia setelah daftar dimuat…" disabled></div>
          <select class="select" style="width:auto" onchange="ckTapis('jenis', this.value)">
            <option value="">Semua Jenis</option>
            ${Object.keys(JENIS_CK).map((k) => `<option value="${k}">${JENIS_CK[k][0]}</option>`).join("")}</select>
          <label class="fld-cek" style="align-self:center">
            <input type="checkbox" onchange="ckTapis('hanya_aktif', this.checked ? 1 : '')"> Hanya aktif</label>
          <div class="spacer"></div>
        </div></div>
        <div id="ckTplDaftar"></div>`;
    },
    mount() { muatTemplat(); }
  };

  /* =======================================================================
     CHECKLIST SAYA
     ======================================================================= */

  const CKM = { tugas: [], riwayat: [], memuat: true, galat: null };

  function ckmKartuTugas(a) {
    const sd = a.sumber_daya;
    // a.templat.jenis dari server berupa NAMA jenis yang sudah terbaca
    // (mis. "Pengecekan & verifikasi"), bukan {kode, nama} — resource
    // penugasan sengaja lebih ringkas daripada resource templat lengkap.
    return `
      <div class="card" style="border-left:3px solid var(--brand-500)"><div class="card-body">
        <div class="row mb-8">
          <span class="badge outline">${U.icon("check", 11)} ${U.esc((a.templat && a.templat.jenis) || "")}</span>
          <div class="spacer"></div><span class="badge outline">${U.esc(PERIODE_CK[a.periode.kode] || a.periode.nama)}</span>
        </div>
        <div class="bold mb-4">${U.esc(a.templat ? a.templat.nama : "—")}</div>
        <div class="small muted">${sd ? U.esc(sd.nama) + " (" + U.esc(sd.jenis) + ")" : "—"}</div>
        <div class="row mt-12 gap-6">
          <button class="btn btn-sm btn-primary" onclick="ckMulaiDariPenugasan('${U.esc(String(a.id))}')">
            ${U.icon("play", 12)} Kerjakan</button>
        </div>
      </div></div>`;
  }

  function isiTugasSaya() {
    const wadah = document.getElementById("ckmTugas");
    if (!wadah) return;

    if (CKM.memuat) {
      wadah.innerHTML = `<div style="padding:24px;text-align:center"><span class="muted">Memuat tugas…</span></div>`;
      return;
    }
    if (CKM.galat) {
      wadah.innerHTML = `<div class="alert err">${U.icon("alert", 15)}<div>${U.esc(CKM.galat)}</div></div>`;
      return;
    }
    if (!CKM.tugas.length) {
      wadah.innerHTML = U.emptyState("Tidak ada tugas checklist",
        "Seluruh pemeriksaan yang melekat pada Anda sudah selesai, atau belum ada yang ditugaskan.");
      return;
    }
    wadah.innerHTML = `<div class="grid g3">${CKM.tugas.map(ckmKartuTugas).join("")}</div>`;
  }

  function isiRiwayatSaya() {
    const wadah = document.getElementById("ckmRiwayat");
    if (!wadah) return;

    if (!CKM.riwayat.length) {
      wadah.innerHTML = U.emptyState("Belum ada riwayat", "");
      return;
    }
    wadah.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Checklist</th><th>Sumber Daya</th><th>Waktu</th><th class="right">Skor</th><th>Status</th><th></th></tr></thead>
      <tbody>${CKM.riwayat.map((r) => `<tr>
        <td><span class="small">${U.esc(r.templat ? r.templat.nama : "—")}</span></td>
        <td><span class="small">${r.sumber_daya ? U.esc(r.sumber_daya.nama) : "—"}</span></td>
        <td><span class="small">${ckWaktu(r.dimulai_pada)}</span></td>
        <td class="right">${r.hasil.skor === null ? "—" : "<b>" + r.hasil.skor + "%</b>"}</td>
        <td><span class="badge ${STATUS_RUN_TINT[r.status.kode] || "slate"}">${U.esc(r.status.nama)}</span></td>
        <td class="actions"><button class="icon-btn" onclick="ckLihatRun('${U.esc(String(r.id))}')">${U.icon("eye", 15)}</button></td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  async function muatChecklistSaya() {
    CKM.memuat = true;
    CKM.galat = null;
    isiTugasSaya();

    try {
      const [tugas, riwayat] = await Promise.all([
        Repo.checklist.tugasSaya(),
        Repo.checklist.pelaksanaan({ milik_saya: 1 })
      ]);
      CKM.tugas = tugas.data;
      CKM.riwayat = riwayat.data;
    } catch (e) {
      CKM.tugas = [];
      CKM.riwayat = [];
      CKM.galat = e.message;
    } finally {
      CKM.memuat = false;
      isiTugasSaya();
      isiRiwayatSaya();

      const kpi = document.getElementById("ckmKpi");
      if (kpi) {
        const berjalan = CKM.riwayat.filter((r) => r.status.kode === "berjalan").length;
        const selesai = CKM.riwayat.filter((r) => r.status.kode === "selesai");
        const rata = selesai.length
          ? Math.round(selesai.reduce((a, r) => a + (r.hasil.skor || 0), 0) / selesai.length) : null;

        kpi.innerHTML = `
          ${U.kpi({ label: "Tugas Saya", value: CKM.tugas.length, icon: "check", tint: "brand", note: "Melekat pada akun Anda" })}
          ${U.kpi({ label: "Sedang Dikerjakan", value: berjalan, icon: "clock", tint: "amber", note: "Belum diselesaikan" })}
          ${U.kpi({ label: "Rata-rata Skor", value: rata === null ? "—" : rata, suffix: rata === null ? "" : "%", icon: "chart", tint: "green", note: "Dari yang selesai" })}
          ${U.kpi({ label: "Riwayat Saya", value: CKM.riwayat.length, icon: "doc", tint: "violet", note: "Seluruh pelaksanaan" })}`;
      }
    }
  }

  window.ckMulaiDariPenugasan = async function (assignmentId) {
    const a = CKM.tugas.find((x) => String(x.id) === String(assignmentId));
    if (!a || !a.sumber_daya) return;

    const kunci = { ruangan: "room_id", laboratorium: "laboratory_id", aset: "asset_id" }[a.sumber_daya.jenis];
    const isi = { checklist_template_id: a.templat.id };
    isi[kunci] = a.sumber_daya.id;

    await ckMulaiRun(isi);
  };

  V["mychecklist"] = {
    title: "Checklist Saya",
    sub: "Tugas pemeriksaan yang melekat pada Anda beserta riwayat pelaksanaannya.",
    actions: `<button class="btn btn-sm" onclick="location.hash='#/checklist'">${U.icon("list")} Kelola Template</button>`,
    render() {
      return `
        <div class="grid g4 mb-16" id="ckmKpi"></div>
        <h3 class="mb-12">Tugas Anda</h3>
        <div id="ckmTugas" class="mb-24"></div>
        ${U.card("Riwayat Pelaksanaan Saya", `<div id="ckmRiwayat"></div>`, { bodyCls: "flush" })}`;
    },
    mount() { muatChecklistSaya(); }
  };

  /* =======================================================================
     PELAKSANAAN (RUN)
     ======================================================================= */

  let RUN = null;

  /**
   * Memulai pelaksanaan lewat server dan membuka formulir pengisian.
   *
   * @param {object} isi  {checklist_template_id, room_id|laboratory_id|asset_id}
   */
  async function ckMulaiRun(isi) {
    if (!Repo.dapatMenulis()) {
      U.toast("Tidak tersedia", "Menjalankan checklist hanya bisa setelah masuk dengan akun.");
      return;
    }

    let run;
    try {
      run = await Repo.checklist.mulai(isi);
    } catch (e) {
      Repo.tampilkanGalat(e, "Tidak dapat memulai checklist");
      return;
    }

    RUN = { id: run.id, templat: run.templat, sumberDaya: run.sumber_daya, jawaban: {} };
    ckBukaFormRun(run.templat.nama, run.sumber_daya ? run.sumber_daya.nama : "");
  }

  function ckBukaFormRun(judul, sub) {
    U.drawer({
      size: "wide", title: judul, sub: sub,
      body: `<div id="ckRunBody">${ckRunHTML()}</div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <div class="spacer"></div>
             <button class="btn btn-primary" id="ckRunSelesai" onclick="ckSelesaikanRun()">
               ${U.icon("check")} Selesaikan</button>`
    });
  }

  function ckRunHTML() {
    const butir = (RUN.templat.butir || []);
    const terjawab = Object.keys(RUN.jawaban).length;
    const pct = butir.length ? Math.round((terjawab / butir.length) * 100) : 0;

    return `
      <div class="card mb-16"><div class="card-body tight">
        <div class="row mb-8"><span class="small bold" style="flex:1">Kemajuan pengisian</span>
          <b class="small">${terjawab}/${butir.length}</b></div>
        <div class="bar"><i style="width:${pct}%;background:${pct === 100 ? "var(--green-500)" : "var(--brand-500)"}"></i></div>
      </div></div>
      ${butir.map((b, i) => ckButirRunHTML(b, i)).join("")}`;
  }

  function ckButirRunHTML(b, i) {
    const j = RUN.jawaban[b.id] || { nilai: null, catatan: "" };
    let input = "";

    if (b.tipe.kode === "ya_tidak") {
      input = `<div class="ck-opt">
        <button class="${j.nilai === "ya" ? "on-ok" : ""}" onclick="ckJawabTampil(${b.id},'ya')">✓ Ya</button>
        <button class="${j.nilai === "tidak" ? "on-bad" : ""}" onclick="ckJawabTampil(${b.id},'tidak')">✕ Tidak</button>
      </div>`;
    } else if (b.tipe.kode === "angka") {
      input = `<input type="number" step="0.01" class="input" style="max-width:200px"
        value="${j.nilai === null ? "" : U.esc(j.nilai)}"
        placeholder="${b.satuan ? "Nilai dalam " + U.esc(b.satuan) : "Masukkan nilai"}"
        oninput="ckJawabSimpan(${b.id}, this.value, true)">`;
    } else if (b.tipe.kode === "pilihan") {
      input = `<select class="select" style="max-width:280px" onchange="ckJawabTampil(${b.id}, this.value)">
        <option value="">— pilih —</option>
        ${(b.pilihan || []).map((p) => `<option value="${U.esc(p)}"${j.nilai === p ? " selected" : ""}>${U.esc(p)}</option>`).join("")}
      </select>`;
    } else {
      input = `<textarea class="textarea" style="min-height:56px" placeholder="Catatan…"
        oninput="ckJawabSimpan(${b.id}, this.value, true)">${U.esc(j.nilai || "")}</textarea>`;
    }

    const terisi = j.nilai !== null && j.nilai !== "";
    const perluCatatan = b.tipe.kode === "ya_tidak" && j.nilai === "tidak";

    return `<div class="ck-run-item">
      <div class="row-t mb-8">
        <span class="tiny faint" style="width:20px;padding-top:2px">${i + 1}</span>
        <div style="flex:1;min-width:0">
          <div class="small bold">${U.esc(b.teks)} ${b.wajib ? `<span style="color:var(--red-500)">*</span>` : ""}</div>
          ${b.petunjuk ? `<div class="tiny faint">${U.esc(b.petunjuk)}</div>` : ""}</div>
        ${terisi ? `<span class="badge ${j.nilai === "tidak" ? "red" : "green"}">terisi</span>` : `<span class="badge outline">kosong</span>`}
      </div>
      <div style="padding-left:20px">${input}
        ${perluCatatan ? `<input class="input mt-8" placeholder="Uraikan temuan…"
          value="${U.esc(j.catatan)}" onblur="ckJawabCatatan(${b.id}, this.value)">` : ""}</div>
    </div>`;
  }

  /**
   * Jawaban dikirim SEGERA saat butirnya diisi, bukan ditahan sampai
   * "Selesaikan" ditekan. Menahannya berarti pengisian satu jam kerja hilang
   * total bila peramban tertutup sebelum sempat menekan tombol terakhir.
   */
  async function ckKirimJawaban(itemId) {
    const j = RUN.jawaban[itemId] || { nilai: null, catatan: "" };
    try {
      await Repo.checklist.jawab(RUN.id, itemId, j.nilai, j.catatan || null);
    } catch (e) {
      U.toast("Gagal menyimpan jawaban", e.message || "", "warn");
    }
  }

  window.ckJawabTampil = function (itemId, nilai) {
    RUN.jawaban[itemId] = RUN.jawaban[itemId] || { nilai: null, catatan: "" };
    RUN.jawaban[itemId].nilai = nilai;
    document.getElementById("ckRunBody").innerHTML = ckRunHTML();
    ckKirimJawaban(itemId);
  };
  window.ckJawabSimpan = function (itemId, nilai, keepFocus) {
    RUN.jawaban[itemId] = RUN.jawaban[itemId] || { nilai: null, catatan: "" };
    RUN.jawaban[itemId].nilai = nilai;
    if (keepFocus) return;  // jangan render ulang saat mengetik agar fokus tidak hilang
    document.getElementById("ckRunBody").innerHTML = ckRunHTML();
    ckKirimJawaban(itemId);
  };
  window.ckJawabCatatan = function (itemId, catatan) {
    RUN.jawaban[itemId] = RUN.jawaban[itemId] || { nilai: null, catatan: "" };
    RUN.jawaban[itemId].catatan = catatan;
    ckKirimJawaban(itemId);
  };

  // Kolom angka/teks dikirim saat kehilangan fokus — mengetik "12" tidak
  // boleh mengirim tiga permintaan berbeda untuk "1", "12" tiap ketukan.
  document.addEventListener("blur", function (e) {
    if (!RUN) return;
    if (e.target && (e.target.matches("#ckRunBody input[type=number]") || e.target.matches("#ckRunBody textarea"))) {
      const m = (e.target.getAttribute("oninput") || "").match(/ckJawabSimpan\((\d+),/);
      if (m) ckKirimJawaban(Number(m[1]));
    }
  }, true);

  window.ckSelesaikanRun = async function () {
    const tombol = document.getElementById("ckRunSelesai");
    tombol.disabled = true;
    tombol.textContent = "Menyelesaikan…";

    let hasil;
    try {
      hasil = await Repo.checklist.selesaikan(RUN.id);
    } catch (e) {
      tombol.disabled = false;
      tombol.textContent = "Selesaikan";

      // Butir wajib yang belum terisi ditolak SERVER, dengan pesan yang
      // menyebut butirnya — bukan hanya "gagal", karena pengguna perlu tahu
      // persis apa yang harus dilengkapi.
      U.modal({
        title: "Belum dapat diselesaikan",
        body: `<div class="alert warn">${U.icon("alert", 15)}<div>${U.esc(
          e.status === 422 && e.perMedan
            ? Object.values(e.perMedan).map((m) => m.join(" ")).join(" ")
            : (e.message || "Gagal menyelesaikan checklist.")
        )}</div></div>`,
        foot: `<button class="btn btn-primary" onclick="UI.closeModal()">Mengerti</button>`
      });
      return;
    }

    U.closeDrawer();

    // Halaman "Checklist Saya" di baliknya boleh saja masih terbuka (kita
    // bisa memulai pelaksanaan ini dari kartunya). Router hanya menggambar
    // ulang saat #hash BERUBAH — menekan "Kembali ke Tugas Saya" nanti
    // tidak memicu apa pun bila hash-nya sudah #/mychecklist, jadi
    // riwayatnya harus disegarkan di sini, bukan digantungkan ke navigasi.
    if (document.getElementById("ckmTugas") || document.getElementById("ckmRiwayat")) {
      muatChecklistSaya();
    }

    const skor = hasil.hasil.skor;
    const adaTemuan = skor !== null && skor < 100;

    U.modal({
      title: adaTemuan ? "Checklist selesai dengan temuan" : "Checklist selesai",
      sub: hasil.templat ? hasil.templat.nama : "",
      body: `<div class="center mb-16">
          <div class="tint-${adaTemuan ? "amber" : "green"}" style="width:58px;height:58px;border-radius:50%;display:grid;place-items:center;margin:0 auto 14px">
            ${U.icon(adaTemuan ? "alert" : "check", 28)}</div>
          <h2>${skor === null ? "—" : skor + "%"}</h2>
          <div class="small muted">${hasil.hasil.butir_lulus} dari ${hasil.hasil.butir_total} butir tercatat lulus</div></div>
        <div class="dl small mb-16" style="grid-template-columns:120px 1fr">
          <dt>Sumber Daya</dt><dd>${hasil.sumber_daya ? U.esc(hasil.sumber_daya.nama) : "—"}</dd>
          <dt>Waktu</dt><dd>${ckWaktu(hasil.dimulai_pada)} – ${ckWaktu(hasil.selesai_pada)}</dd>
          <dt>Status</dt><dd><span class="badge ${STATUS_RUN_TINT[hasil.status.kode]}">${U.esc(hasil.status.nama)}</span></dd>
        </div>
        <p class="small muted">Hasil ini tercatat pada jejak audit dan dapat ditelusuri kembali dari
          detail ruangan, laboratorium, atau aset yang diperiksa.</p>`,
      foot: `<button class="btn" onclick="UI.closeModal();location.hash='#/checklist'">Lihat Template</button>
             <button class="btn btn-primary" onclick="UI.closeModal();location.hash='#/mychecklist'">Kembali ke Tugas Saya</button>`
    });

    RUN = null;
  };

  window.ckLihatRun = async function (id) {
    let run;
    try {
      run = await Repo.checklist.lihatPelaksanaan(id);
    } catch (e) {
      Repo.tampilkanGalat(e, "Gagal memuat pelaksanaan");
      return;
    }
    if (!run) return;

    const jawabanById = {};
    (run.jawaban || []).forEach((j) => { jawabanById[j.butir_id] = j; });

    const butirHTML = (run.templat && run.templat.butir || []).map((b, i) => {
      const j = jawabanById[b.id];
      return `<div class="row-t" style="padding:8px 0;${i ? "border-top:1px solid var(--border)" : ""}">
        <span class="tiny faint mono" style="width:20px;padding-top:2px">${i + 1}</span>
        <div style="flex:1;min-width:0">
          <div class="small">${U.esc(b.teks)}</div>
          <div class="small ${j && j.lulus === false ? "" : ""}" style="margin-top:2px">
            ${j ? `<b>${U.esc(String(j.nilai))}</b>${j.catatan ? " — " + U.esc(j.catatan) : ""}` : `<span class="muted">belum diisi</span>`}
          </div>
        </div>
        ${j && j.lulus !== null ? `<span class="badge ${j.lulus ? "green" : "red"}">${j.lulus ? "Lulus" : "Tidak lulus"}</span>` : ""}
      </div>`;
    }).join("");

    U.drawer({
      size: "wide",
      title: run.templat ? run.templat.nama : "Pelaksanaan Checklist",
      sub: run.sumber_daya ? run.sumber_daya.nama : "",
      body: `
        <div class="row wrap gap-6 mb-16">
          <span class="badge ${STATUS_RUN_TINT[run.status.kode] || "slate"}">${U.esc(run.status.nama)}</span>
          ${run.hasil.skor !== null ? `<span class="badge outline">Skor ${run.hasil.skor}%</span>` : ""}
          ${run.pelaksana ? `<span class="badge outline">${U.esc(run.pelaksana.nama)}</span>` : ""}
        </div>
        <div class="dl small mb-16" style="grid-template-columns:120px 1fr">
          <dt>Dimulai</dt><dd>${ckWaktu(run.dimulai_pada)}</dd>
          <dt>Selesai</dt><dd>${run.selesai_pada ? ckWaktu(run.selesai_pada) : "—"}</dd>
          ${run.catatan ? `<dt>Catatan</dt><dd>${U.esc(run.catatan)}</dd>` : ""}
        </div>
        <h4 class="mb-8 muted">JAWABAN</h4>
        <div>${butirHTML}</div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>`
    });
  };

  /* =======================================================================
     CHECKLIST YANG MELEKAT PADA SEBUAH RESOURCE
     dipanggil dari drawer detail ruangan / laboratorium / aset tersambung
     ======================================================================= */

  /**
   * @param {"ruangan"|"laboratorium"|"aset"|null} jenis  null berarti masih
   *   mode purwarupa: id-nya adalah id purwarupa, bukan id server.
   * @param {string|number} id
   */
  window.ckForResource = function (jenis, id) {
    if (!jenis || !Repo.dapatMenulis()) {
      return ckForResourcePurwarupa(id);
    }

    const kotak = "ck-res-" + jenis + "-" + id;
    setTimeout(() => ckMuatUntukResource(jenis, id, kotak), 0);

    return `<h4 class="mb-8 muted">CHECKLIST</h4>
      <div id="${kotak}"><div class="small muted">Memuat riwayat checklist…</div></div>`;
  };

  async function ckMuatUntukResource(jenis, id, kotakId) {
    const wadah = document.getElementById(kotakId);
    if (!wadah) return;

    let riwayat = [];
    try {
      riwayat = (await Repo.checklist.pelaksanaan({ jenis_sumber_daya: jenis, sumber_daya_id: id })).data;
    } catch (e) {
      wadah.innerHTML = `<div class="small muted">Riwayat checklist tidak dapat dimuat.</div>`;
      return;
    }

    const tabel = riwayat.length ? `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Checklist</th><th>Pelaksana</th><th>Waktu</th><th class="right">Skor</th><th>Status</th></tr></thead>
      <tbody>${riwayat.slice(0, 5).map((r) => `<tr>
        <td><span class="small">${U.esc(r.templat ? r.templat.nama : "—")}</span></td>
        <td><span class="small">${r.pelaksana ? U.esc(r.pelaksana.nama) : "—"}</span></td>
        <td><span class="small">${ckWaktu(r.dimulai_pada)}</span></td>
        <td class="right">${r.hasil.skor === null ? "—" : "<b>" + r.hasil.skor + "%</b>"}</td>
        <td><span class="badge ${STATUS_RUN_TINT[r.status.kode] || "slate"}">${U.esc(r.status.nama)}</span></td>
      </tr>`).join("")}</tbody></table></div>`
      : `<div class="small muted mb-8">Belum ada checklist yang dilaksanakan pada sumber daya ini.</div>`;

    wadah.innerHTML = `
      <button class="btn btn-sm mb-8" onclick="ckPilihTemplatUntukResource('${jenis}','${id}')">
        ${U.icon("play", 12)} Jalankan Checklist</button>
      ${tabel}`;
  }

  window.ckPilihTemplatUntukResource = async function (jenis, id) {
    let daftar = [];
    try {
      daftar = (await Repo.checklist.templat({ hanya_aktif: 1 })).data;
    } catch (e) {
      Repo.tampilkanGalat(e, "Gagal memuat daftar template");
      return;
    }

    if (!daftar.length) {
      U.toast("Belum ada template", "Buat template checklist aktif lebih dulu pada menu Checklist.");
      return;
    }

    U.modal({
      title: "Pilih Checklist yang Dijalankan",
      body: `<div class="col gap-6">${daftar.map((t) => `
        <div class="row-t" style="cursor:pointer;border:1px solid var(--border);border-radius:8px;padding:10px"
             onclick="UI.closeModal();ckMulaiUntukResource('${jenis}','${id}','${U.esc(String(t.id))}')">
          <span class="kpi-ico tint-${ckTint(t.jenis.kode)}" style="width:30px;height:30px;flex:0 0 30px">
            ${U.icon(ckIkon(t.jenis.kode), 14)}</span>
          <div style="flex:1;min-width:0"><div class="small bold trunc">${U.esc(t.nama)}</div>
            <div class="tiny faint">${U.esc(t.jenis.nama)} · ${t.jumlah_butir || 0} butir</div></div>
        </div>`).join("")}</div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>`
    });
  };

  window.ckMulaiUntukResource = function (jenis, id, templatId) {
    const kunci = { ruangan: "room_id", laboratorium: "laboratory_id", aset: "asset_id" }[jenis];
    const isi = { checklist_template_id: Number(templatId) };
    isi[kunci] = Number(id);
    ckMulaiRun(isi);
  };

  /* ---------------------------------------------------- versi PURWARUPA */

  const tplOf = (id) => D.checklistTemplates.find((t) => t.id === id) || { name: id, type: "verifikasi", items: [] };
  const typeOf = (k) => D.checklistTypes.find((t) => t.k === k) || D.checklistTypes[0];

  function ckForResourcePurwarupa(resId) {
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
          <button class="btn btn-sm" onclick="UI.demo('Menjalankan checklist purwarupa')">Kerjakan</button></div>`;
      }).join("")}</div>` : `<div class="small muted mb-12">Belum ada checklist yang melekat pada resource ini.</div>`}
      ${recs.length ? U.table([
        { t: "Tanggal", render: (r) => U.fdate(r.date, "short") + " " + r.time },
        { t: "Checklist", render: (r) => `<span class="small">${U.esc(tplOf(r.tpl).name)}</span>` },
        { t: "Pelaksana", render: (r) => `<span class="small">${U.esc(D.personName(r.by))}</span>` },
        { t: "Skor", cls: "right", render: (r) => `<b>${r.score}%</b>` },
        { t: "Status", render: (r) => `<span class="badge ${statusTone[r.status] || "slate"}">${r.status}</span>` }
      ], recs.slice(0, 5)) : ""}`;
  }

  const statusTone = { "Selesai": "green", "Temuan": "amber", "Ditolak": "red",
    "Terlambat": "red", "Jatuh Tempo Hari Ini": "amber", "Terjadwal": "brand" };

})();
