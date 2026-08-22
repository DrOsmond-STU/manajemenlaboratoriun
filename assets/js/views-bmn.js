/* ==========================================================================
   FLMS — Views BMN
   • Register BMN (KIB B) — penatausahaan mengacu PMK 181/PMK.06/2016
   • Registrasi peralatan dengan kolom data BMN + unggah foto
   • Studio label & barcode: label baku BMN dan label internal yang
     susunannya dapat diatur mandiri oleh pengguna
   ========================================================================== */
(function () {
  const U = UI, D = DB, V = window.VIEWS, B = window.Barcode;

  const KOND = { B: "Baik", RR: "Rusak Ringan", RB: "Rusak Berat" };
  const kondTone = { B: "green", RR: "amber", RB: "red" };

  /** Seluruh objek ber-BMN: alat laboratorium + aset penunjang. */
  const allItems = () => D.equipment.concat(D.assets);
  const findItem = (id) => allItems().find((x) => x.id === id);

  /* =======================================================================
     NILAI ELEMEN LABEL
     ======================================================================= */
  function fieldVal(it, k) {
    const b = it.bmn || {};
    switch (k) {
      case "kodeInternal": return it.kodeInternal || it.code || "";
      case "name":         return it.name || "";
      case "merk":         return [it.brand, it.model].filter(Boolean).join(" ");
      case "sn":           return "SN " + (it.sn || "-");
      case "ruangan":      return D.resName(it.lab || it.room || "-");
      case "pic":          return D.personName(it.pic);
      case "bmnId":        return it.bmnId || "";
      case "nup":          return b.kodeBarang + " / " + b.nupFmt;
      case "thn":          return "Th. " + b.thnPerolehan;
      case "kondisi":      return "Kondisi: " + (KOND[b.kondisi] || "-");
      case "nilai":        return U.rp(b.nilaiPerolehan);
      default:             return "";
    }
  }

  /** Ganti token pada pola muatan barcode. */
  function payloadFor(it, pattern) {
    const b = it.bmn || {};
    const map = {
      "{KODE_INTERNAL}": it.kodeInternal || it.code || "",
      "{BMN_ID}": it.bmnId || "",
      "{KODE_BARANG}": b.kodeBarang || "",
      "{NUP}": b.nupFmt || "",
      "{KODE_LOKASI}": b.kodeLokasi || "",
      "{NAMA}": it.name || "",
      "{SN}": it.sn || "",
      "{TAHUN}": String(b.thnPerolehan || ""),
      "{URL}": "https://lab.semestateknologiutama.com/q/" + (it.kodeInternal || it.id)
    };
    let out = String(pattern || "{KODE_INTERNAL}");
    Object.keys(map).forEach((t) => { out = out.split(t).join(map[t]); });
    return out;
  }

  const PAYLOAD_TOKENS = [
    ["{KODE_INTERNAL}", "Kode internal barang"],
    ["{BMN_ID}", "Kode BMN lengkap (lokasi + kode barang + NUP)"],
    ["{KODE_BARANG}", "Kode barang BMN 10 digit"],
    ["{NUP}", "Nomor Urut Pendaftaran"],
    ["{KODE_LOKASI}", "Kode lokasi / satker"],
    ["{NAMA}", "Nama barang"],
    ["{SN}", "Nomor seri"],
    ["{TAHUN}", "Tahun perolehan"],
    ["{URL}", "Tautan halaman detail barang"]
  ];

  /* =======================================================================
     REGISTER BMN (KIB B) — tersambung ke basis data
     ======================================================================= */

  const BMN = { baris: [], ringkas: null, memuat: true, galat: null, tapis: {} };

  const KOND_TINT = { B: "green", RR: "amber", RB: "red" };

  function bmnBarisHTML(x) {
    const b = x.bmn || {};
    const lokasi = x.laboratorium ? x.laboratorium.nama
      : (x.ruangan ? x.ruangan.nama : null);
    const p = x.penyusutan || {};

    return `
      <tr>
        <td><span class="lnk mono" style="font-size:11.5px"
              onclick="showBmnDetail('${U.esc(String(x.id))}')">${U.esc(b.id || "—")}</span>
          <div class="tiny faint">NUP ${U.esc(b.nup_fmt || "—")} • ${U.esc(b.kode_barang || "—")}</div></td>
        <td><span class="mono small">${U.esc(x.kode_internal || "—")}</span></td>
        <td><b class="small">${U.esc(b.uraian_barang || "—")}</b>
          <div class="tiny faint">${U.esc(x.nama)}</div></td>
        <td><span class="small">${U.esc([x.merk, x.tipe].filter(Boolean).join(" ") || "—")}</span>
          <div class="tiny faint mono">${U.esc(x.serial_number || "-")}</div></td>
        <td class="center">${x.perolehan && x.perolehan.tanggal ? x.perolehan.tanggal.slice(0, 4) : "—"}</td>
        <td class="right">${U.rp(p.nilai_perolehan || 0)}</td>
        <td class="right">${U.rp(p.nilai_buku || 0)}</td>
        <td class="center"><span class="badge ${KOND_TINT[x.kondisi.kode] || "slate"}">${U.esc(x.kondisi.kode)}</span></td>
        <td><span class="small">${U.esc(lokasi || "—")}</span></td>
        <td class="actions"><button class="icon-btn" onclick="showBmnDetail('${U.esc(String(x.id))}')">${U.icon("eye", 15)}</button></td>
      </tr>`;
  }

  function isiTabelBmn() {
    const wadah = document.getElementById("bmnTabel");
    if (!wadah) return;

    if (BMN.memuat) {
      wadah.innerHTML = `<div style="padding:32px;text-align:center"><span class="muted">Memuat register…</span></div>`;
      return;
    }

    if (BMN.galat) {
      wadah.innerHTML = `<div style="padding:20px"><div class="alert err">${U.icon("alert", 15)}<div>
        <b>Gagal memuat register BMN.</b><br><span class="small">${U.esc(BMN.galat)}</span></div></div></div>`;
      return;
    }

    if (!BMN.baris.length) {
      const adaTapis = Object.keys(BMN.tapis).some((k) => BMN.tapis[k]);
      wadah.innerHTML = `<div style="padding:40px;text-align:center">
        <div class="muted mb-12">${adaTapis
          ? "Tidak ada barang yang cocok dengan penyaringan ini."
          : "Belum ada barang yang terdaftar pada Register BMN."}</div>
        ${adaTapis
          ? `<button class="btn btn-sm" onclick="bmnHapusTapis()">Hapus penyaringan</button>`
          : (Repo.dapatMenulis()
            ? `<button class="btn btn-primary btn-sm" onclick="location.hash='#/equipment/new'">${U.icon("plus")} Registrasi Barang Pertama</button>`
            : `<span class="small muted">Masuk dengan akun untuk mendaftarkan barang.</span>`)}
      </div>`;
      return;
    }

    wadah.innerHTML = `<div class="tbl-wrap"><table class="tbl">
      <thead><tr>
        <th style="width:230px">Kode BMN (kunci utama)</th>
        <th>Kode Internal</th><th>Uraian Barang (BMN)</th><th>Merk / Tipe</th>
        <th class="center">Th.</th><th class="right">Nilai Perolehan</th>
        <th class="right">Nilai Buku</th><th class="center">Kondisi</th>
        <th>Lokasi</th><th></th>
      </tr></thead>
      <tbody>${BMN.baris.map(bmnBarisHTML).join("")}</tbody>
    </table></div>`;
  }

  function isiRingkasanBmn() {
    const wadah = document.getElementById("bmnKpi");
    if (!wadah) return;

    const r = BMN.ringkas;

    if (!r) {
      wadah.innerHTML = `<div class="card" style="grid-column:1/-1;padding:20px;text-align:center">
        <span class="muted">Memuat ringkasan…</span></div>`;
      return;
    }

    const rb = (r.kondisi || []).find((k) => k.kode === "RB");

    // Seluruh angka di bawah datang dari server, dihitung atas SELURUH aset
    // dalam cakupan. Menghitungnya di sini dari baris yang tampil akan
    // melaporkan nilai perolehan satu halaman sebagai nilai perolehan
    // satuan kerja — angka yang tidak tampak salah, hanya kecil.
    wadah.innerHTML = `
      ${U.kpi({ label: "Jumlah BMN", value: U.num(r.jumlah), icon: "box", tint: "brand", note: "Seluruh yang tercatat" })}
      ${U.kpi({ label: "Nilai Perolehan", value: U.rpShort(r.nilai_perolehan), icon: "money", tint: "teal", note: "Harga perolehan" })}
      ${U.kpi({ label: "Akumulasi Penyusutan", value: U.rpShort(r.akumulasi_penyusutan), icon: "refresh", tint: "amber", note: "PMK 65/PMK.06/2017" })}
      ${U.kpi({ label: "Nilai Buku", value: U.rpShort(r.nilai_buku), icon: "chart", tint: "violet", note: "Perolehan − penyusutan" })}
      ${U.kpi({ label: "Kondisi Rusak Berat", value: rb ? rb.jumlah : 0, icon: "alert",
                tint: rb && rb.jumlah ? "red" : "slate", note: "Kandidat penghapusan" })}`;
  }

  async function muatBmn() {
    BMN.memuat = true;
    BMN.galat = null;
    isiTabelBmn();
    isiRingkasanBmn();

    // Daftar dan ringkasan diminta BERSAMAAN. Berurutan berarti pengguna
    // menunggu dua kali waktu jaringan untuk halaman yang sama.
    const [daftar, ringkas] = await Promise.all([
      Repo.aset.daftar(BMN.tapis).catch((e) => ({ galat: e })),
      Repo.aset.ringkasan(BMN.tapis).catch(() => null)
    ]);

    if (daftar.galat) {
      BMN.baris = [];
      BMN.galat = daftar.galat.message;
    } else {
      BMN.baris = daftar.data;
      BMN.purwarupa = !!daftar.purwarupa;
    }

    BMN.ringkas = ringkas;
    BMN.memuat = false;
    isiTabelBmn();
    isiRingkasanBmn();
  }

  window.bmnTapis = function (kunci, nilai) {
    if (nilai) BMN.tapis[kunci] = nilai; else delete BMN.tapis[kunci];
    muatBmn();
  };

  window.bmnHapusTapis = function () {
    BMN.tapis = {};
    const c = document.getElementById("bmnCari");
    if (c) c.value = "";
    muatBmn();
  };

  /* --------------------------------------------------------------- detail */

  window.showBmnDetail = async function (id) {
    const x = BMN.baris.find((r) => String(r.id) === String(id));
    if (!x) return;

    const b = x.bmn || {};
    const p = x.penyusutan || {};
    const baris = (k, v) => v === null || v === undefined || v === "" ? "" : `<dt>${k}</dt><dd>${v}</dd>`;

    U.drawer({
      size: "wide",
      title: x.nama,
      sub: [b.id, x.kode_internal].filter(Boolean).join(" • "),
      body: `
        <div id="bmnFoto" class="mb-16"></div>

        <div class="row wrap gap-6 mb-16">
          <span class="badge ${KOND_TINT[x.kondisi.kode] || "slate"}">${U.esc(x.kondisi.nama)}</span>
          ${x.wajib_kalibrasi ? `<span class="badge brand">Wajib kalibrasi</span>` : ""}
          ${x.status_penggunaan ? `<span class="badge outline">${U.esc(x.status_penggunaan)}</span>` : ""}
        </div>

        <h4 class="mb-8 muted">IDENTITAS BMN</h4>
        <div class="dl mb-16">
          ${baris("Kode BMN", `<span class="mono">${U.esc(b.id || "—")}</span>`)}
          ${baris("Kode Lokasi", `<span class="mono">${U.esc(b.kode_lokasi || "—")}</span>`)}
          ${baris("Kode Barang", `<span class="mono">${U.esc(b.kode_barang || "—")}</span>`)}
          ${baris("Uraian Barang", U.esc(b.uraian_barang || "—"))}
          ${baris("NUP", `<span class="mono">${U.esc(b.nup_fmt || "—")}</span>`)}
          ${baris("Kode Internal", `<span class="mono">${U.esc(x.kode_internal || "—")}</span>`)}
        </div>

        <h4 class="mb-8 muted">DATA TEKNIS</h4>
        <div class="dl mb-16">
          ${baris("Merk", U.esc(x.merk || ""))}
          ${baris("Tipe", U.esc(x.tipe || ""))}
          ${baris("Nomor Seri", x.serial_number ? `<span class="mono">${U.esc(x.serial_number)}</span>` : "")}
          ${baris("Kapasitas / Rentang", U.esc(x.kapasitas_ukur || ""))}
          ${baris("Spesifikasi", U.esc(x.spesifikasi || ""))}
          ${baris("Kelengkapan", (x.kelengkapan || []).length
            ? x.kelengkapan.map((k) => `<span class="fac">${U.esc(k)}</span>`).join(" ") : "")}
        </div>

        <h4 class="mb-8 muted">PEROLEHAN &amp; PENYUSUTAN</h4>
        <div class="dl mb-16">
          ${baris("Cara Perolehan", U.esc((x.perolehan || {}).cara || ""))}
          ${baris("Tanggal Perolehan", U.esc((x.perolehan || {}).tanggal || ""))}
          ${baris("Sumber Dana", U.esc((x.perolehan || {}).sumber_dana || ""))}
          ${baris("Nilai Perolehan", U.rp(p.nilai_perolehan || 0))}
          ${baris("Masa Manfaat", p.masa_manfaat ? p.masa_manfaat + " tahun" : "")}
          ${baris("Akumulasi Penyusutan", U.rp(p.akumulasi_penyusutan || 0))}
          ${baris("Nilai Buku", `<b>${U.rp(p.nilai_buku || 0)}</b>`)}
          ${p.habis_masa_manfaat ? `<dt>Catatan</dt><dd><span class="badge amber">Masa manfaat telah habis</span></dd>` : ""}
        </div>

        <h4 class="mb-8 muted">PENEMPATAN</h4>
        <div class="dl mb-16">
          ${baris("Laboratorium", x.laboratorium ? U.esc(x.laboratorium.nama) : "")}
          ${baris("Ruangan", x.ruangan ? U.esc(x.ruangan.nama) + " (" + U.esc(x.ruangan.kode) + ")" : "")}
          ${baris("Penanggung Jawab", x.penanggung_jawab ? U.esc(x.penanggung_jawab.nama) : "")}
          ${baris("Keterangan", U.esc(x.keterangan || ""))}
        </div>

        <div class="mt-16" style="padding-top:16px;border-top:1px solid var(--border)">
          ${ckForResource(x.id)}</div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <div class="spacer"></div>
             <button class="btn btn-primary" onclick="UI.closeDrawer();location.hash='#/barcode'">${U.icon("qr")} Cetak Label</button>`
    });

    // Foto dimuat setelah panel terbuka: panelnya muncul seketika, gambarnya
    // menyusul. Menunggunya lebih dulu membuat klik terasa tidak merespons.
    muatFotoAset(x.id);
  };

  async function muatFotoAset(asetId) {
    const wadah = document.getElementById("bmnFoto");
    if (!wadah) return;

    if (!Repo.dapatMenulis()) { wadah.innerHTML = ""; return; }

    let foto = [];
    try {
      foto = (await Repo.aset.foto(asetId)).data || [];
    } catch (e) {
      wadah.innerHTML = `<div class="alert warn small">${U.icon("alert", 15)}<div>
        Foto tidak dapat dimuat: ${U.esc(e.message || "")}</div></div>`;
      return;
    }

    if (!foto.length) {
      wadah.innerHTML = `<div class="thumb" style="aspect-ratio:21/9;display:grid;place-items:center">
        <span class="small muted">Belum ada foto</span></div>`;
      return;
    }

    const utama = foto.find((f) => f.utama) || foto[0];

    wadah.innerHTML = `
      <div class="thumb mb-8" style="aspect-ratio:16/9;overflow:hidden">
        <img src="${U.esc(utama.url)}" alt="${U.esc(utama.keterangan || "Foto aset")}"
             style="width:100%;height:100%;object-fit:cover">
      </div>
      ${foto.length > 1 ? `<div class="row wrap gap-6">
        ${foto.map((f) => `<img src="${U.esc(f.url)}" alt=""
            style="width:56px;height:56px;object-fit:cover;border-radius:6px;cursor:pointer;
                   border:2px solid ${f.utama ? "var(--brand-600)" : "transparent"}"
            onclick="bmnFotoUtama('${U.esc(String(asetId))}', '${U.esc(String(f.id))}')">`).join("")}
      </div>` : ""}`;
  }

  window.bmnFotoUtama = async function (asetId, fotoId) {
    try {
      await Repo.aset.jadikanFotoUtama(asetId, fotoId);
      await muatFotoAset(asetId);
      U.toast("Foto utama diperbarui", "Foto ini kini dipakai pada daftar aset.");
      muatBmn();
    } catch (e) {
      Repo.tampilkanGalat(e, "Gagal mengubah foto utama");
    }
  };

  V["bmn"] = {
    title: "Register BMN — KIB B",
    sub: "Penatausahaan Barang Milik Negara: kodefikasi PMK 29/PMK.06/2010, pembukuan PMK 181/PMK.06/2016.",
    get actions() {
      return `<button class="btn btn-sm" onclick="bmnRefModal()">${U.icon("list")} Referensi Kode Barang</button>
              <button class="btn btn-sm" onclick="location.hash='#/barcode'">${U.icon("qr")} Cetak Label</button>
              ${Repo.dapatMenulis()
                ? `<button class="btn btn-primary btn-sm" onclick="location.hash='#/equipment/new'">${U.icon("plus")} Registrasi Barang</button>`
                : ""}`;
    },
    render() {
      return `
        <div class="alert info mb-16">${U.icon("shield", 17)}<div><b>Identitas barang mengikuti dua penomoran</b>
          Kunci utama adalah identitas BMN <span class="mono">kode lokasi · kode barang · NUP</span> sesuai PMK 29/PMK.06/2010;
          penomoran kedua adalah kode internal satuan kerja yang polanya dapat diatur sendiri pada Pengaturan Sistem.</div></div>

        <div class="grid g5 mb-16" id="bmnKpi"></div>

        <div class="card mb-16"><div class="card-body">
          <div class="grid g4" style="gap:12px">
            <div><div class="tiny faint">Kode Lokasi / UAKPB</div><b class="mono">${D.satker.kodeLokasi}</b></div>
            <div><div class="tiny faint">Satuan Kerja</div><b class="small">${U.esc(D.satker.namaSatker)}</b></div>
            <div><div class="tiny faint">Bagian Anggaran</div><b class="small">${D.satker.kodeBA} — ${U.esc(D.satker.namaBA)}</b></div>
            <div><div class="tiny faint">Jenis Kewenangan</div><b class="small">${D.satker.kodeKewenangan} — Kantor Daerah</b></div>
          </div>
        </div></div>

        <div class="card"><div class="tbl-toolbar">
          <div class="tbl-search">${U.icon("search", 15, "faint")}
            <input id="bmnCari" placeholder="Cari kode BMN, kode internal, nama barang, atau nomor seri…"></div>
          <select class="select" style="width:auto" onchange="bmnTapis('kondisi', this.value)">
            <option value="">Semua Kondisi</option>
            <option value="B">Baik</option>
            <option value="RR">Rusak Ringan</option>
            <option value="RB">Rusak Berat</option></select>
          <select class="select" style="width:auto" onchange="bmnTapis('kode_barang', this.value)">
            <option value="">Semua Bidang</option>
            ${D.bmnRef.bidang.map((b) => `<option value="${b.k}">${b.k} — ${U.esc(b.n)}</option>`).join("")}</select>
          <div class="spacer"></div>
        </div>
        <div id="bmnTabel"></div></div>`;
    },
    mount() {
      const cari = document.getElementById("bmnCari");
      if (cari) {
        cari.value = BMN.tapis.cari || "";
        let jeda;
        cari.addEventListener("input", function () {
          clearTimeout(jeda);
          jeda = setTimeout(() => bmnTapis("cari", cari.value.trim()), 300);
        });
      }
      muatBmn();
    }
  };

  /* --- Modal referensi kode barang --------------------------------------- */
  window.bmnRefModal = function (pickCb) {
    const rows = D.bmnRef.kodeBarang;
    U.modal({
      size: "wide", title: "Referensi Kode Barang BMN",
      sub: "Golongan · Bidang · Kelompok · Sub Kelompok · Sub-sub Kelompok — PMK 29/PMK.06/2010",
      body: `
        <div class="alert warn mb-16 small">${U.icon("alert", 15)}<div><b>Cuplikan contoh</b>
          Purwarupa ini memuat sebagian kode untuk memperagakan mekanisme pemilihan. Master kode barang
          wajib diimpor utuh dari referensi resmi Kementerian Keuangan / SAKTI milik satuan kerja.</div></div>
        <div class="grid g3 mb-16" style="gap:10px">
          <div class="field"><label>Golongan</label><select class="select" id="refGol" onchange="bmnRefFilter()">
            ${D.bmnRef.golongan.map((g) => `<option value="${g.k}" ${g.k === "3" ? "selected" : ""}>${g.k} — ${g.n}</option>`).join("")}</select></div>
          <div class="field"><label>Bidang</label><select class="select" id="refBid" onchange="bmnRefFilter()">
            <option value="">Semua Bidang</option>
            ${D.bmnRef.bidang.map((b) => `<option value="${b.k}">${b.k} — ${b.n}</option>`).join("")}</select></div>
          <div class="field"><label>Kelompok</label><select class="select" id="refKel" onchange="bmnRefFilter()">
            <option value="">Semua Kelompok</option>
            ${D.bmnRef.kelompok.map((k) => `<option value="${k.k}">${k.k} — ${k.n}</option>`).join("")}</select></div>
        </div>
        <div class="tbl-search mb-12">${U.icon("search", 15, "faint")}<input id="refQ" placeholder="Cari kode atau uraian barang…" oninput="bmnRefFilter()"></div>
        <div id="refList">${refRows(rows, !!pickCb)}</div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Tutup</button>`
    });
    window.__refPick = pickCb || null;
  };

  function refRows(rows, pick) {
    if (!rows.length) return U.emptyState("Tidak ada kode yang cocok", "Ubah filter atau kata kunci pencarian.");
    return U.table([
      { t: "Kode Barang", w: "150px", render: (r) => `<span class="mono small bold">${r.k}</span>` },
      { t: "Uraian Barang", render: (r) => U.esc(r.n) },
      { t: "Kelompok", render: (r) => { const kel = D.bmnRef.kelompok.find((x) => x.k === r.kel);
          return `<span class="small muted">${kel ? U.esc(kel.n) : r.kel}</span>`; } },
      { t: "Masa Manfaat", cls: "center", render: (r) => `<span class="badge outline">${r.mm} th</span>` },
      { t: "", cls: "actions", render: (r) => pick
          ? `<button class="btn btn-sm btn-primary" onclick="bmnRefChoose('${r.k}')">Pilih</button>`
          : `<span class="tiny faint">KIB B</span>` }
    ], rows);
  }

  window.bmnRefFilter = function () {
    const gol = (document.getElementById("refGol") || {}).value || "";
    const bid = (document.getElementById("refBid") || {}).value || "";
    const kel = (document.getElementById("refKel") || {}).value || "";
    const q = ((document.getElementById("refQ") || {}).value || "").toLowerCase();
    const rows = D.bmnRef.kodeBarang.filter((r) =>
      (!gol || r.k.startsWith(gol + ".")) &&
      (!bid || r.k.startsWith(bid + ".")) &&
      (!kel || r.kel === kel) &&
      (!q || (r.k + " " + r.n).toLowerCase().includes(q)));
    document.getElementById("refList").innerHTML = refRows(rows, !!window.__refPick);
  };

  window.bmnRefChoose = function (kode) {
    const cb = window.__refPick;
    U.closeModal();
    if (cb) cb(kode);
  };

  /* --- Detail BMN versi PURWARUPA -----------------------------------------
     Masih membaca data.js. Dipakai layar Alat Laboratorium yang belum
     dikonversi; namanya menyebut "purwarupa" supaya sisa pekerjaan terlihat
     dari kodenya sendiri. Detail yang tersambung ada di atas.
     ----------------------------------------------------------------------- */
  window.showBmnDetailPurwarupa = function (id) {
    const x = findItem(id);
    if (!x) return U.demo("Data tidak ditemukan.");
    const b = x.bmn;
    const c128 = B.code128(x.bmnId, { height: 44, module: 1.15, showText: true, fontSize: 8 });
    const qr = B.qr(x.bmnId, { size: 108 });

    U.drawer({
      size: "wide", title: x.name, sub: "Kode BMN " + x.bmnId,
      body: `
        <div class="grid g2 mb-16" style="gap:12px">
          <div class="card" style="border-color:var(--brand-300)"><div class="card-body tight">
            <div class="tiny faint">PENOMORAN 1 — BMN (KUNCI UTAMA)</div>
            <div class="mono bold" style="font-size:13px;word-break:break-all">${x.bmnId}</div>
            <div class="tiny muted mt-4">Kode Lokasi · Kode Barang · NUP</div></div></div>
          <div class="card"><div class="card-body tight">
            <div class="tiny faint">PENOMORAN 2 — INTERNAL</div>
            <div class="mono bold" style="font-size:13px">${U.esc(x.kodeInternal)}</div>
            <div class="tiny muted mt-4">Pola: ${U.esc(D.internalPattern.pattern)}</div></div></div>
        </div>

        ${photoStrip(x)}

        <div class="tabs mb-16"><button class="active">Data BMN</button>
          <button onclick="UI.demo('Tab riwayat mutasi & penyusutan')">Riwayat</button>
          <button onclick="UI.demo('Tab dokumen perolehan')">Dokumen</button></div>

        <h4 class="muted mb-8">IDENTITAS &amp; KODEFIKASI</h4>
        <div class="dl mb-16" style="grid-template-columns:190px 1fr">
          <dt>Kode Lokasi / UAKPB</dt><dd class="mono">${b.kodeLokasi}</dd>
          <dt>Satuan Kerja</dt><dd>${U.esc(b.namaSatker)}</dd>
          <dt>Kode Barang</dt><dd class="mono">${b.kodeBarang}</dd>
          <dt>Uraian Barang</dt><dd>${U.esc(b.uraianBarang)}</dd>
          <dt>NUP</dt><dd class="mono">${b.nupFmt}</dd>
          <dt>Kartu Identitas Barang</dt><dd>${b.kib} — Peralatan dan Mesin</dd>
        </div>

        <h4 class="muted mb-8">PEROLEHAN &amp; NILAI</h4>
        <div class="dl mb-16" style="grid-template-columns:190px 1fr">
          <dt>Cara Perolehan</dt><dd>${U.esc(b.caraPerolehan)}</dd>
          <dt>Tanggal Perolehan</dt><dd>${U.fdate(b.tglPerolehan, "long")}</dd>
          <dt>Sumber Dana</dt><dd>${U.esc(b.sumberDana)}</dd>
          <dt>Nomor Bukti</dt><dd class="mono">${b.noBukti}</dd>
          <dt>Nomor Kontrak</dt><dd class="mono">${b.noKontrak}</dd>
          <dt>Kuantitas</dt><dd>${b.kuantitas} ${b.satuan}</dd>
          <dt>Nilai Perolehan</dt><dd><b>${U.rp(b.nilaiPerolehan)}</b></dd>
          <dt>Masa Manfaat</dt><dd>${b.masaManfaat} tahun</dd>
          <dt>Penyusutan / Tahun</dt><dd>${U.rp(b.susutTahunan)}</dd>
          <dt>Akumulasi Penyusutan</dt><dd>${U.rp(b.akumPenyusutan)}</dd>
          <dt>Nilai Buku</dt><dd><b>${U.rp(b.nilaiBuku)}</b></dd>
        </div>

        <h4 class="muted mb-8">KONDISI, STATUS &amp; PENEMPATAN</h4>
        <div class="dl mb-16" style="grid-template-columns:190px 1fr">
          <dt>Kondisi</dt><dd><span class="badge ${kondTone[b.kondisi]}">${b.kondisi} — ${KOND[b.kondisi]}</span></dd>
          <dt>Status Penggunaan</dt><dd>${U.esc(b.statusPenggunaan)}</dd>
          <dt>Penetapan Status (PSP)</dt><dd class="mono">${b.noPsp}</dd>
          <dt>Tanggal PSP</dt><dd>${U.fdate(b.tglPsp, "long")}</dd>
          <dt>Ruangan (DBR)</dt><dd>${U.esc(D.resName(x.lab || x.room || "-"))}</dd>
          <dt>Penanggung Jawab</dt><dd>${U.esc(D.personName(x.pic))}</dd>
        </div>

        <h4 class="muted mb-8">LABEL &amp; BARCODE</h4>
        <div class="row gap-16 wrap" style="align-items:flex-start">
          <div style="flex:1;min-width:230px;background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px">${c128}</div>
          <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:6px">${qr || ""}</div>
        </div>`,
      foot: `<button class="btn" onclick="UI.closeDrawer()">Tutup</button>
             <button class="btn" onclick="UI.demo('Form ubah data BMN')">${U.icon("edit")} Ubah</button>
             <div class="spacer"></div>
             <button class="btn btn-primary" onclick="UI.closeDrawer();lblOpenFor('${x.id}')">${U.icon("qr")} Cetak Label</button>`
    });
  };

  /* Foto: gambar contoh dibuat sebagai SVG agar purwarupa tidak butuh berkas biner. */
  function samplePhoto(seed, label) {
    let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const hue = h % 360;
    return `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="hsl(${hue},46%,88%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},44%,72%)"/>
        </linearGradient></defs>
        <rect width="400" height="300" fill="url(#g)"/>
        <rect x="112" y="78" width="176" height="150" rx="10" fill="hsl(${hue},30%,99%)" stroke="hsl(${hue},30%,55%)" stroke-width="3"/>
        <rect x="132" y="100" width="136" height="52" rx="5" fill="hsl(${hue},34%,90%)"/>
        <circle cx="164" cy="186" r="15" fill="hsl(${hue},40%,66%)"/><circle cx="208" cy="186" r="15" fill="hsl(${hue},40%,76%)"/>
        <rect x="236" y="172" width="32" height="28" rx="4" fill="hsl(${hue},40%,70%)"/>
        <text x="200" y="266" font-family="Arial" font-size="17" font-weight="bold" fill="hsl(${hue},42%,34%)" text-anchor="middle">${label}</text>
      </svg>`)}`;
  }

  function photoStrip(x) {
    const fotos = (x.foto && x.foto.length) ? x.foto
      : [{ src: samplePhoto(x.id, x.code || x.id), main: true }];
    return `<div class="ph-grid mb-16">${fotos.map((f, i) => `
      <div class="ph"><img src="${f.src}" alt="Foto ${U.esc(x.name)}">
        ${f.main || i === 0 ? `<span class="ph-main">Utama</span>` : ""}</div>`).join("")}</div>`;
  }

  /* =======================================================================
     REGISTRASI PERALATAN — form data BMN + unggah foto
     ======================================================================= */
  const REG = {
    kodeBarang: "3.08.01.03.001", nama: "", merk: "", tipe: "", sn: "",
    spesifikasi: "", kapasitas: "", kelengkapan: "",
    cara: "Pembelian", tgl: D.shift(0), dana: "APBN — Rupiah Murni",
    noBukti: "", noKontrak: "", kuantitas: 1, satuan: "Unit", nilai: 0,
    lab: "LAB-001", gedung: "GA", lantai: 2, pic: "EMP-0003",
    kondisi: "B", status: "Digunakan untuk Operasional Satker",
    noPsp: "", tglPsp: D.shift(0), ket: "",
    kodeInternal: "", foto: [],

    // Id sungguhan dari server, diisi saat tersambung. Dipisahkan dari
    // `lab`/`pic` yang berisi id purwarupa ("LAB-001", "EMP-0003"): mengirim
    // id purwarupa ke server akan ditolak, dan menimpanya membuat mode data
    // contoh berhenti bekerja.
    roomId: null, labId: null, picId: null
  };

  const kbInfo = (k) => D.bmnRef.kodeBarang.find((x) => x.k === k) || { n: "—", mm: 5 };
  const nextNup = (kode) => allItems().filter((x) => x.bmn.kodeBarang === kode).length + 1;

  function regBmnId() {
    return `${D.satker.kodeLokasi}.${REG.kodeBarang}.${String(nextNup(REG.kodeBarang)).padStart(5, "0")}`;
  }
  function regKodeInternal() {
    if (REG.kodeInternal) return REG.kodeInternal;
    const lab = (D.byId(D.labs, REG.lab) || { code: "LAB-XXX" }).code.replace("LAB-", "");
    const kat = (kbInfo(REG.kodeBarang).n.split(" ")[0] || "ALT").toUpperCase().slice(0, 4);
    const thn = String(REG.tgl).slice(0, 4);
    return `STU/${lab}/${kat}/${thn}/${String(nextNup(REG.kodeBarang)).padStart(4, "0")}`;
  }

  V["equipment/new"] = {
    title: "Registrasi Peralatan Laboratorium",
    sub: "Isian data mengacu pada kebutuhan pendataan Barang Milik Negara (PMK 29/PMK.06/2010 dan PMK 181/PMK.06/2016).",
    actions: `<button class="btn btn-sm" onclick="bmnRefModal(regPickKode)">${U.icon("list")} Cari Kode Barang</button>
              <button class="btn btn-sm" onclick="UI.demo('Disimpan sebagai draf')">Simpan Draf</button>
              <button class="btn btn-primary btn-sm" id="regSimpanBtn" onclick="regSave()">${U.icon("check")} Simpan &amp; Registrasi</button>`,
    render() { return regHTML(); },
    mount() { regIsiPilihan(); }
  };

  /**
   * Mengisi pemilih laboratorium, ruangan, dan penanggung jawab.
   *
   * Dijalankan pada mount(), sesudah kerangkanya terpasang. Di mode data
   * contoh diisi dari data.js supaya purwarupa tetap dapat ditelusuri; saat
   * tersambung, diisi dari server sehingga id yang tersimpan adalah id
   * sungguhan.
   */
  window.regIsiPilihan = async function () {
    const selLab = document.getElementById("regLab");
    const selRuang = document.getElementById("regRuang");
    const selPic = document.getElementById("regPic");
    if (!selLab || !selRuang || !selPic) return;

    const isi = (sel, daftar, terpilih, kosong) => {
      sel.innerHTML = `<option value="">${kosong}</option>` +
        daftar.map((o) => `<option value="${U.esc(String(o.id))}"${
          terpilih && String(terpilih) === String(o.id) ? " selected" : ""
        }>${U.esc(o.nama)}</option>`).join("");
    };

    if (!window.Repo || !Repo.dapatMenulis()) {
      isi(selLab, (D.labs || []).map((l) => ({ id: l.id, nama: l.name })), REG.lab, "— pilih laboratorium —");
      isi(selRuang, (D.rooms || []).map((r) => ({ id: r.id, nama: r.name })), null, "— pilih ruangan —");
      isi(selPic, (D.people || []).map((p) => ({ id: p.id, nama: p.name + " — " + p.role })), REG.pic, "— pilih penanggung jawab —");
      return;
    }

    // Ketiganya diambil bersamaan, bukan berurutan: tiga permintaan yang
    // tidak saling bergantung dijalankan serentak menghemat dua kali waktu
    // tunggu jaringan pada formulir yang baru dibuka.
    const [lab, ruang, orang] = await Promise.all([
      Repo.laboratorium.daftar().catch(() => ({ data: [] })),
      Repo.ruangan.daftar().catch(() => ({ data: [] })),
      Repo.pengguna.daftar().catch(() => ({ data: [] }))
    ]);

    isi(selLab, lab.data.map((l) => ({ id: l.id, nama: l.nama })), REG.labId, "— tanpa laboratorium —");
    isi(selRuang, ruang.data.map((r) => ({ id: r.id, nama: r.nama + " (" + r.kode + ")" })), REG.roomId, "— tanpa ruangan —");
    isi(selPic, orang.data.map((o) => ({
      id: o.id, nama: o.nama + (o.unit_kerja ? " — " + o.unit_kerja : "")
    })), REG.picId, "— belum ditetapkan —");

    if (!lab.data.length && !ruang.data.length) {
      U.toast("Belum ada penempatan",
        "Daftarkan ruangan atau laboratorium lebih dulu agar barang dapat ditempatkan.");
    }
  };

  window.regPilihLab = function (v) {
    if (window.Repo && Repo.dapatMenulis()) REG.labId = v ? Number(v) : null;
    else REG.lab = v;
  };
  window.regPilihRuang = function (v) {
    if (window.Repo && Repo.dapatMenulis()) REG.roomId = v ? Number(v) : null;
  };
  window.regPilihPic = function (v) {
    if (window.Repo && Repo.dapatMenulis()) REG.picId = v ? Number(v) : null;
    else REG.pic = v;
  };

  function sec(title, note, body) {
    return U.card(title, body, { sub: note });
  }

  function regHTML() {
    const info = kbInfo(REG.kodeBarang);
    return `<div class="grid g-2-1 gap-16" style="align-items:start">
      <div class="col gap-16">

        ${sec("1 · Identitas BMN", "Penomoran utama — kode lokasi, kode barang, dan NUP", `
          <div class="grid g2" style="gap:12px">
            <div class="field"><label>Kode Lokasi / UAKPB</label>
              <input class="input mono" value="${D.satker.kodeLokasi}" readonly>
              <div class="hint">${U.esc(D.satker.namaSatker)}</div></div>
            <div class="field"><label>Kode Barang <span class="req">*</span></label>
              <div class="row"><input class="input mono" id="regKode" value="${REG.kodeBarang}" readonly>
                <button class="btn" onclick="bmnRefModal(regPickKode)">${U.icon("search", 13)}</button></div>
              <div class="hint">${U.esc(info.n)}</div></div>
            <div class="field"><label>NUP (otomatis)</label>
              <input class="input mono" value="${String(nextNup(REG.kodeBarang)).padStart(5, "0")}" readonly>
              <div class="hint">Urut per sub-sub kelompok menurut urutan perolehan</div></div>
            <div class="field"><label>Kartu Identitas Barang</label>
              <select class="select">${D.bmnRef.kib.map((k) => `<option ${k.k === "B" ? "selected" : ""}>${k.n}</option>`).join("")}</select></div>
            <div class="field" style="grid-column:1/-1"><label>Uraian Barang sesuai Kodefikasi</label>
              <input class="input" value="${U.esc(info.n)}" readonly></div>
          </div>`)}

        ${sec("2 · Identitas Internal", "Penomoran kedua — pola dapat diatur pada Pengaturan Sistem", `
          <div class="grid g2" style="gap:12px">
            <div class="field"><label>Kode Internal</label>
              <input class="input mono" id="regInternal" value="${U.esc(regKodeInternal())}"
                oninput="regSet('kodeInternal',this.value)">
              <div class="hint">Pola aktif: <span class="mono">${U.esc(D.internalPattern.pattern)}</span></div></div>
            <div class="field"><label>Nama Barang (internal) <span class="req">*</span></label>
              <input class="input" placeholder="Contoh: HPLC Shimadzu LC-2050" value="${U.esc(REG.nama)}"
                oninput="regSet('nama',this.value)"></div>
          </div>`)}

        ${sec("3 · Spesifikasi Teknis", "Data teknis yang melekat pada barang", `
          <div class="grid g2" style="gap:12px">
            <div class="field"><label>Merk <span class="req">*</span></label>
              <input class="input" value="${U.esc(REG.merk)}" oninput="regSet('merk',this.value)" placeholder="Shimadzu"></div>
            <div class="field"><label>Tipe / Model <span class="req">*</span></label>
              <input class="input" value="${U.esc(REG.tipe)}" oninput="regSet('tipe',this.value)" placeholder="LC-2050C 3D"></div>
            <div class="field"><label>Nomor Seri (Serial Number) <span class="req">*</span></label>
              <input class="input mono" value="${U.esc(REG.sn)}" oninput="regSet('sn',this.value)" placeholder="SHZ-LC-88421"></div>
            <div class="field"><label>Kapasitas / Rentang Ukur</label>
              <input class="input" value="${U.esc(REG.kapasitas)}" oninput="regSet('kapasitas',this.value)" placeholder="0,1–500 mg/L"></div>
            <div class="field" style="grid-column:1/-1"><label>Spesifikasi</label>
              <textarea class="textarea" oninput="regSet('spesifikasi',this.value)" placeholder="Uraian spesifikasi teknis, daya listrik, dimensi, persyaratan ruang…">${U.esc(REG.spesifikasi)}</textarea></div>
            <div class="field" style="grid-column:1/-1"><label>Kelengkapan / Aksesori</label>
              <input class="input" value="${U.esc(REG.kelengkapan)}" oninput="regSet('kelengkapan',this.value)"
                placeholder="Kolom, detektor, software, manual, sertifikat…"></div>
          </div>`)}

        ${sec("4 · Perolehan &amp; Nilai", "Dasar pencatatan dan perhitungan penyusutan", `
          <div class="grid g2" style="gap:12px">
            <div class="field"><label>Cara Perolehan <span class="req">*</span></label>
              <select class="select" onchange="regSet('cara',this.value)">
                ${D.bmnRef.caraPerolehan.map((c) => `<option ${c === REG.cara ? "selected" : ""}>${c}</option>`).join("")}</select></div>
            <div class="field"><label>Tanggal Perolehan <span class="req">*</span></label>
              <input type="date" class="input" value="${REG.tgl}" onchange="regSet('tgl',this.value)"></div>
            <div class="field"><label>Sumber Dana <span class="req">*</span></label>
              <select class="select" onchange="regSet('dana',this.value)">
                ${D.bmnRef.sumberDana.map((c) => `<option ${c === REG.dana ? "selected" : ""}>${c}</option>`).join("")}</select></div>
            <div class="field"><label>Nomor Bukti (SPM / SP2D / BAST)</label>
              <input class="input mono" value="${U.esc(REG.noBukti)}" oninput="regSet('noBukti',this.value)" placeholder="SP2D-2026-001234"></div>
            <div class="field"><label>Nomor Kontrak / SPK</label>
              <input class="input mono" value="${U.esc(REG.noKontrak)}" oninput="regSet('noKontrak',this.value)" placeholder="421/KONTRAK/652431/2026"></div>
            <div class="field"><label>Nilai Perolehan (Rp) <span class="req">*</span></label>
              <input type="number" class="input" value="${REG.nilai}" oninput="regSet('nilai',+this.value)"></div>
            <div class="field"><label>Kuantitas <span class="req">*</span></label>
              <input type="number" class="input" value="${REG.kuantitas}" oninput="regSet('kuantitas',+this.value)"></div>
            <div class="field"><label>Satuan <span class="req">*</span></label>
              <select class="select" onchange="regSet('satuan',this.value)">
                ${D.bmnRef.satuan.map((s) => `<option ${s === REG.satuan ? "selected" : ""}>${s}</option>`).join("")}</select></div>
          </div>
          <div class="alert info mt-16 small">${U.icon("chart", 15)}<div>
            <b>Penyusutan otomatis</b> Masa manfaat <b>${info.mm} tahun</b> sesuai kelompok barang;
            beban penyusutan <b>${U.rp(Math.round((REG.nilai || 0) / info.mm))}</b> per tahun (garis lurus, PMK 65/PMK.06/2017).</div></div>`)}

        ${sec("5 · Penempatan &amp; Penanggung Jawab", "Dasar penyusunan Daftar Barang Ruangan (DBR)", `
          <div class="grid g2" style="gap:12px">
            <div class="field"><label>Gedung</label><select class="select" onchange="regSet('gedung',this.value)">
              ${D.org.buildings.map((b) => `<option value="${b.code}" ${b.code === REG.gedung ? "selected" : ""}>${b.name}</option>`).join("")}</select></div>
            <div class="field"><label>Lantai</label><input type="number" class="input" value="${REG.lantai}" onchange="regSet('lantai',+this.value)"></div>
            <div class="field"><label>Laboratorium</label>
              <select class="select" id="regLab" onchange="regPilihLab(this.value)">
                <option value="">— memuat… —</option></select></div>
            <div class="field"><label>Ruangan</label>
              <select class="select" id="regRuang" onchange="regPilihRuang(this.value)">
                <option value="">— memuat… —</option></select></div>
            <div class="field"><label>Penanggung Jawab</label>
              <select class="select" id="regPic" onchange="regPilihPic(this.value)">
                <option value="">— memuat… —</option></select></div>
          </div>`)}

        ${sec("6 · Kondisi &amp; Status Penggunaan", "Wajib diperbarui saat inventarisasi", `
          <div class="grid g2" style="gap:12px">
            <div class="field"><label>Kondisi Barang <span class="req">*</span></label>
              <div class="row wrap gap-6">${D.bmnRef.kondisi.map((k) => `
                <span class="chip ${REG.kondisi === k.k ? "on" : ""}" onclick="regSet('kondisi','${k.k}')">${k.k} — ${k.n}</span>`).join("")}</div></div>
            <div class="field"><label>Status Penggunaan <span class="req">*</span></label>
              <select class="select" onchange="regSet('status',this.value)">
                ${D.bmnRef.statusPenggunaan.map((s) => `<option ${s === REG.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
            <div class="field"><label>Nomor Keputusan PSP</label>
              <input class="input mono" value="${U.esc(REG.noPsp)}" oninput="regSet('noPsp',this.value)" placeholder="KEP-000/MK.6/2026"></div>
            <div class="field"><label>Tanggal PSP</label>
              <input type="date" class="input" value="${REG.tglPsp}" onchange="regSet('tglPsp',this.value)"></div>
            <div class="field" style="grid-column:1/-1"><label>Keterangan</label>
              <textarea class="textarea" style="min-height:60px" oninput="regSet('ket',this.value)">${U.esc(REG.ket)}</textarea></div>
          </div>`)}

        ${sec("7 · Foto Barang", "Foto kondisi terkini — dilampirkan pada KIB dan berita acara inventarisasi", `
          <div id="regFotoWrap">${regFotoHTML()}</div>`)}

      </div>

      <div class="col gap-16" style="position:sticky;top:78px">
        <div id="regPreview">${regPreviewHTML()}</div>
      </div>
    </div>`;
  }

  function regFotoHTML() {
    return `
      ${REG.foto.length ? `<div class="ph-grid mb-12">${REG.foto.map((f, i) => `
        <div class="ph"><img src="${f.src}" alt="Foto ${i + 1}">
          ${f.main ? `<span class="ph-main">Utama</span>` : ""}
          <div class="ph-tools">
            ${f.main ? "" : `<button onclick="regFotoMain(${i})">Jadikan utama</button>`}
            <button onclick="regFotoDel(${i})">Hapus</button>
          </div></div>`).join("")}</div>` : ""}
      <div class="ph-drop" id="regDrop"
           onclick="document.getElementById('regFile').click()"
           ondragover="event.preventDefault();this.classList.add('over')"
           ondragleave="this.classList.remove('over')"
           ondrop="regDrop(event,this)">
        ${U.icon("upload", 22)}
        <div class="mt-8 small"><b>Seret foto ke sini</b> atau klik untuk memilih berkas</div>
        <div class="tiny faint mt-4">JPG / PNG / WEBP • maksimal 5 MB per berkas • beberapa berkas sekaligus</div>
      </div>
      <input type="file" id="regFile" accept="image/*" multiple class="hide" onchange="regFotoAdd(this.files)">
      <div class="row wrap gap-8 mt-12">
        <button class="btn btn-sm" onclick="document.getElementById('regFile').click()">${U.icon("upload", 12)} Pilih Berkas</button>
        <button class="btn btn-sm" onclick="document.getElementById('regCam').click()">${U.icon("eye", 12)} Ambil dari Kamera</button>
        <button class="btn btn-sm" onclick="regFotoSample()">Gunakan Foto Contoh</button>
        <input type="file" id="regCam" accept="image/*" capture="environment" class="hide" onchange="regFotoAdd(this.files)">
      </div>`;
  }

  function regPreviewHTML() {
    const bmnId = regBmnId();
    const internal = regKodeInternal();
    const info = kbInfo(REG.kodeBarang);
    const c128 = B.code128(bmnId, { height: 40, module: 1.05, showText: true, fontSize: 7.5 });
    const qr = B.qr(internal, { size: 96 });
    return U.card("Pratinjau Identitas", `
      <div class="tiny faint">PENOMORAN 1 — BMN (KUNCI UTAMA)</div>
      <div class="mono bold mb-4" style="word-break:break-all;font-size:12.5px">${bmnId}</div>
      <div class="tiny muted mb-12">${D.satker.kodeLokasi} · ${REG.kodeBarang} · NUP ${String(nextNup(REG.kodeBarang)).padStart(5, "0")}</div>
      ${window.Repo && Repo.dapatMenulis() ? `<div class="alert warn small mb-12">${U.icon("alert", 14)}<div>
        NUP di atas masih <b>perkiraan</b>. Nomor yang sebenarnya diterbitkan server saat disimpan,
        supaya dua petugas yang mendaftarkan barang bersamaan tidak memperoleh nomor yang sama.
        Cetak label hanya setelah barangnya tersimpan.</div></div>` : ""}

      <div class="tiny faint">PENOMORAN 2 — INTERNAL</div>
      <div class="mono bold mb-12" style="font-size:12.5px">${U.esc(internal)}</div>

      <div class="dl small mb-12" style="grid-template-columns:96px 1fr">
        <dt>Uraian</dt><dd>${U.esc(info.n)}</dd>
        <dt>Masa Manfaat</dt><dd>${info.mm} tahun</dd>
        <dt>Kondisi</dt><dd><span class="badge ${kondTone[REG.kondisi]}">${REG.kondisi}</span></dd>
        <dt>Nilai</dt><dd>${U.rp(REG.nilai)}</dd>
        <dt>Foto</dt><dd>${REG.foto.length} berkas</dd>
      </div>

      <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:7px" class="mb-8">${c128}</div>
      <div class="center" style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:7px">${qr || ""}</div>
      <div class="tiny faint center mt-4">Code 128 · kode BMN &nbsp;|&nbsp; QR · kode internal</div>
    `, { tools: `<button class="btn btn-sm" onclick="location.hash='#/barcode'">Studio Label</button>` });
  }

  function regRefresh() {
    const p = document.getElementById("regPreview");
    if (p) p.innerHTML = regPreviewHTML();
  }
  function regFotoRefresh() {
    const w = document.getElementById("regFotoWrap");
    if (w) w.innerHTML = regFotoHTML();
    regRefresh();
  }

  window.regSet = function (k, v) {
    REG[k] = v;
    if (k === "kondisi") {
      // Render ulang seluruh formulir menghapus isi pemilih yang dimuat dari
      // server, jadi harus diisi ulang. Tanpa ini, mengubah kondisi barang
      // diam-diam mengosongkan penempatan dan penanggung jawab yang sudah
      // dipilih.
      document.getElementById("viewBody").innerHTML = regHTML();
      regIsiPilihan();
      return;
    }
    regRefresh();
  };
  window.regPickKode = function (kode) {
    REG.kodeBarang = kode;
    document.getElementById("viewBody").innerHTML = regHTML();
    regIsiPilihan();
    U.toast("Kode barang dipilih", kode + " — " + kbInfo(kode).n);
  };

  window.regFotoAdd = function (files) {
    const list = Array.prototype.slice.call(files || []);
    if (!list.length) return;
    let pending = list.length;
    list.forEach((f) => {
      if (!/^image\//.test(f.type)) { pending--; return; }
      if (f.size > 5 * 1024 * 1024) {
        U.toast("Berkas terlalu besar", f.name + " melebihi 5 MB.", "warn");
        pending--; return;
      }
      const r = new FileReader();
      r.onload = () => {
        // Berkas aslinya ikut disimpan. `src` hanya untuk pratinjau; yang
        // diunggah ke server harus objek File-nya sendiri — data URL berarti
        // mengirim ulang gambar dalam bentuk base64 yang 33% lebih besar,
        // lewat jalur JSON yang tidak dirancang untuk itu.
        REG.foto.push({ src: r.result, berkas: f, name: f.name, size: f.size, main: REG.foto.length === 0 });
        if (--pending <= 0) { regFotoRefresh(); U.toast("Foto ditambahkan", list.length + " berkas diunggah."); }
      };
      r.onerror = () => { if (--pending <= 0) regFotoRefresh(); };
      r.readAsDataURL(f);
    });
    if (pending <= 0) regFotoRefresh();
  };
  window.regDrop = function (e, el) {
    e.preventDefault(); el.classList.remove("over");
    regFotoAdd(e.dataTransfer.files);
  };
  window.regFotoMain = function (i) {
    REG.foto.forEach((f, k) => f.main = (k === i));
    regFotoRefresh();
  };
  window.regFotoDel = function (i) {
    const wasMain = REG.foto[i].main;
    REG.foto.splice(i, 1);
    if (wasMain && REG.foto.length) REG.foto[0].main = true;
    regFotoRefresh();
  };
  window.regFotoSample = function () {
    REG.foto.push({
      src: samplePhoto(REG.sn || REG.nama || String(REG.foto.length), REG.merk || "FOTO ALAT"),
      name: "contoh-" + (REG.foto.length + 1) + ".svg", size: 0, main: REG.foto.length === 0
    });
    regFotoRefresh();
  };

  /**
   * Menyusun muatan aset dari keadaan wizard.
   *
   * `nup`, `kode_lokasi`, dan `bmn_id` SENGAJA TIDAK DIKIRIM. Ketiganya
   * ditentukan server: NUP dialokasikan secara aman-balapan, kode lokasi
   * dirakit dari identitas satker di konfigurasi, dan bmn_id adalah kolom
   * hitungan basis data. Mengirimnya dari peramban berarti dua petugas yang
   * mendaftarkan barang bersamaan dapat memperoleh nomor yang sama — dan
   * ketahuannya baru saat rekonsiliasi SIMAK-BMN, setelah labelnya telanjur
   * tercetak dan tertempel.
   */
  function regMuatan() {
    const daftar = (t) => {
      const b = (t || "").split(",").map((x) => x.trim()).filter(Boolean);
      return b.length ? b : null;
    };
    const kosongJadiNull = (v) => (v === "" || v === undefined ? null : v);

    return {
      kode_barang: REG.kodeBarang,
      nama: REG.nama,
      merk: kosongJadiNull(REG.merk),
      tipe: kosongJadiNull(REG.tipe),
      serial_number: kosongJadiNull(REG.sn),
      spesifikasi: kosongJadiNull(REG.spesifikasi),
      kapasitas_ukur: kosongJadiNull(REG.kapasitas),
      kelengkapan: daftar(REG.kelengkapan),

      cara_perolehan: kosongJadiNull(REG.cara),
      tgl_perolehan: REG.tgl,
      sumber_dana: kosongJadiNull(REG.dana),
      no_bukti: kosongJadiNull(REG.noBukti),
      no_kontrak: kosongJadiNull(REG.noKontrak),

      kuantitas: Number(REG.kuantitas) || 1,
      satuan: kosongJadiNull(REG.satuan),
      nilai_perolehan: Number(REG.nilai) || 0,

      kondisi: REG.kondisi,
      status_penggunaan: kosongJadiNull(REG.status),
      no_psp: kosongJadiNull(REG.noPsp),
      tgl_psp: REG.noPsp ? REG.tglPsp : null,

      // Kode internal hanya dikirim bila petugas mengisinya sendiri.
      // Dikosongkan berarti server yang membentuknya dari polanya — dan pola
      // itu memuat kode ruangan serta tahun perolehan yang hanya diketahui
      // server setelah relasinya terpasang.
      kode_internal: kosongJadiNull(REG.kodeInternal),

      room_id: REG.roomId || null,
      laboratory_id: REG.labId || null,
      penanggung_jawab_id: REG.picId || null,

      keterangan: kosongJadiNull(REG.ket)
    };
  }

  window.regSave = async function () {
    if (!REG.nama || !REG.merk || !REG.sn) {
      U.toast("Data belum lengkap", "Nama barang, merk, dan nomor seri wajib diisi.", "warn");
      return;
    }

    /* ---- Mode data contoh: jangan berpura-pura menyimpan ---- */
    if (!window.Repo || !Repo.dapatMenulis()) {
      U.modal({
        title: "Simulasi registrasi",
        sub: "Mode data contoh — tidak ada yang tersimpan",
        body: `<div class="alert warn mb-16">${U.icon("alert", 15)}<div>
            <b>Barang ini TIDAK tersimpan ke mana pun.</b> Anda sedang menelusuri purwarupa,
            jadi nomor BMN di bawah hanyalah contoh bentuknya — bukan nomor yang diterbitkan.
            Masuk dengan akun untuk mendaftarkan barang sungguhan.</div></div>
          <div class="grid g2" style="gap:10px">
            <div class="card"><div class="card-body tight"><div class="tiny faint">CONTOH KODE BMN</div>
              <div class="mono bold" style="font-size:12px;word-break:break-all">${regBmnId()}</div></div></div>
            <div class="card"><div class="card-body tight"><div class="tiny faint">CONTOH KODE INTERNAL</div>
              <div class="mono bold" style="font-size:12px">${U.esc(regKodeInternal())}</div></div></div>
          </div>`,
        foot: `<button class="btn btn-primary" onclick="UI.closeModal()">Mengerti</button>`
      });
      return;
    }

    /* ---- Tersambung: simpan sungguhan ---- */
    const tombol = document.getElementById("regSimpanBtn");
    if (tombol) { tombol.disabled = true; tombol.textContent = "Menyimpan…"; }

    let aset;
    try {
      aset = await Repo.aset.simpan(regMuatan());
    } catch (e) {
      if (tombol) { tombol.disabled = false; tombol.textContent = "Simpan & Terbitkan Label"; }

      if (e.status === 422 && e.perMedan) {
        U.modal({
          title: "Registrasi belum dapat disimpan",
          body: `<div class="alert err">${U.icon("alert", 15)}<div>${Object.keys(e.perMedan)
            .map((k) => "<div>" + U.esc(e.perMedan[k].join(" ")) + "</div>").join("")}</div></div>`,
          foot: `<button class="btn btn-primary" onclick="UI.closeModal()">Perbaiki</button>`
        });
      } else {
        Repo.tampilkanGalat(e, "Gagal menyimpan");
      }
      return;
    }

    // Foto diunggah SETELAH asetnya ada, karena tiap foto perlu id asetnya.
    // Kegagalan unggah TIDAK membatalkan registrasi: barangnya sudah sah
    // tercatat, dan memutar balik pendaftaran hanya karena satu gambar gagal
    // akan membuang nomor NUP yang sudah terpakai — NUP tidak pernah dipakai
    // ulang.
    const gagalFoto = [];
    for (const f of REG.foto) {
      if (!f.berkas) continue;               // foto contoh, bukan berkas nyata
      try {
        await Repo.aset.unggahFoto(aset.id, f.berkas);
      } catch (e) {
        gagalFoto.push(f.name + ": " + (e.message || "gagal"));
      }
    }

    if (tombol) { tombol.disabled = false; tombol.textContent = "Simpan & Terbitkan Label"; }

    const bmn = aset.bmn || {};

    U.modal({
      title: "Barang berhasil diregistrasi",
      sub: "Tersimpan pada Register BMN — KIB B",
      body: `<div class="center mb-16">
          <div class="tint-green" style="width:58px;height:58px;border-radius:50%;display:grid;place-items:center;margin:0 auto 14px">${U.icon("check", 28)}</div>
          <h3 class="mb-4">${U.esc(aset.nama)}</h3>
          <div class="small muted">${U.esc(kbInfo(REG.kodeBarang).n)}</div>
        </div>
        <div class="grid g2 mb-16" style="gap:10px">
          <div class="card"><div class="card-body tight"><div class="tiny faint">KODE BMN</div>
            <div class="mono bold" style="font-size:12px;word-break:break-all">${U.esc(bmn.id || "—")}</div></div></div>
          <div class="card"><div class="card-body tight"><div class="tiny faint">KODE INTERNAL</div>
            <div class="mono bold" style="font-size:12px">${U.esc(aset.kode_internal || "—")}</div></div></div>
        </div>
        ${gagalFoto.length ? `<div class="alert warn small mb-12">${U.icon("alert", 15)}<div>
          <b>Barang tersimpan, tetapi ${gagalFoto.length} foto gagal diunggah.</b>
          Fotonya dapat ditambahkan kemudian dari halaman detail aset.
          <div class="tiny mt-4">${gagalFoto.map(U.esc).join("<br>")}</div></div></div>` : ""}
        <div class="alert info small">${U.icon("bell", 15)}<div>Nomor di atas diterbitkan server dan
          sudah tercatat pada jejak audit. Label aman dicetak sekarang.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeModal();location.hash='#/bmn'">Buka Register BMN</button>
             <button class="btn btn-primary" onclick="UI.closeModal();location.hash='#/barcode'">${U.icon("qr")} Cetak Label</button>`
    });

    // Keadaan wizard dibersihkan agar barang berikutnya tidak mewarisi nomor
    // seri dan foto barang sebelumnya — kesalahan yang menghasilkan dua aset
    // dengan nomor seri sama.
    REG.nama = ""; REG.merk = ""; REG.tipe = ""; REG.sn = "";
    REG.spesifikasi = ""; REG.kapasitas = ""; REG.kelengkapan = "";
    REG.noBukti = ""; REG.noKontrak = ""; REG.kodeInternal = "";
    REG.ket = ""; REG.foto = [];
  };

  /* =======================================================================
     STUDIO LABEL & BARCODE
     ======================================================================= */
  const LBL = {
    tab: "internal",
    tplIndex: 0,
    tpl: JSON.parse(JSON.stringify(D.labelTemplates[0])),
    sel: {},                       // id item terpilih
    bmn: { w: 60, h: 30, showQr: true }
  };
  D.equipment.slice(0, 8).forEach((e) => { LBL.sel[e.id] = true; });

  const PRESETS = [
    [33, 15], [38, 21], [50, 25], [60, 30], [70, 35], [100, 50]
  ];

  V["barcode"] = {
    title: "Studio Label & Barcode",
    sub: "Cetak label BMN sesuai format baku, dan label internal yang isi serta ukurannya diatur sendiri.",
    actions: `<button class="btn btn-sm" onclick="lblLoadTpl()">${U.icon("box")} Template</button>
              <button class="btn btn-sm" onclick="lblSaveTpl()">${U.icon("check")} Simpan Template</button>
              <button class="btn btn-primary btn-sm" onclick="lblPrint()">${U.icon("print")} Cetak</button>`,
    render() { return lblHTML(); }
  };

  window.lblOpenFor = function (id) {
    Object.keys(LBL.sel).forEach((k) => delete LBL.sel[k]);
    LBL.sel[id] = true;
    location.hash = "#/barcode";
  };

  function selItems() { return allItems().filter((x) => LBL.sel[x.id]); }

  function lblHTML() {
    const items = allItems();
    const n = selItems().length;
    return `
      <div class="tabs mb-16">
        <button class="${LBL.tab === "bmn" ? "active" : ""}" onclick="lblTab('bmn')">Label BMN (Baku)</button>
        <button class="${LBL.tab === "internal" ? "active" : ""}" onclick="lblTab('internal')">Label Internal (Kustom)</button>
      </div>

      <div class="lbl-page">
        <div class="col gap-16">
          ${U.card("Pilih Barang", `
            <div class="tbl-search mb-10">${U.icon("search", 15, "faint")}
              <input placeholder="Cari barang…" oninput="lblFilter(this.value)"></div>
            <div class="row gap-6 mb-10">
              <button class="btn btn-sm" onclick="lblAll(true)">Pilih Semua</button>
              <button class="btn btn-sm" onclick="lblAll(false)">Kosongkan</button>
              <div class="spacer"></div><span class="badge brand">${n} terpilih</span></div>
            <div id="lblItems" style="max-height:290px;overflow-y:auto;border:1px solid var(--border);border-radius:9px">
              ${items.map((x) => `
                <label class="row" data-nm="${U.esc((x.name + " " + x.kodeInternal + " " + x.bmnId).toLowerCase())}"
                       style="padding:7px 10px;border-bottom:1px solid var(--border);cursor:pointer">
                  <input type="checkbox" ${LBL.sel[x.id] ? "checked" : ""} onchange="lblPick('${x.id}',this.checked)"
                         style="accent-color:var(--brand-600)">
                  <div style="flex:1;min-width:0"><div class="small trunc">${U.esc(x.name)}</div>
                    <div class="tiny faint mono trunc">${U.esc(x.kodeInternal)}</div></div>
                </label>`).join("")}
            </div>`)}
          ${LBL.tab === "internal" ? lblDesigner() : lblBmnOptions()}
        </div>

        <div class="col gap-16">
          ${U.card("Pratinjau Label", `<div class="lbl-stage" id="lblPreview">${lblPreviewHTML()}</div>
            <div id="lblWarn" class="mt-12"></div>
            <div class="row mt-12 small muted"><span>${U.icon("layout", 13)} Ukuran sebenarnya
              <b>${LBL.tab === "internal" ? LBL.tpl.w + " × " + LBL.tpl.h : LBL.bmn.w + " × " + LBL.bmn.h} mm</b></span>
              <div class="spacer"></div><span class="tiny faint">Ditampilkan dalam skala 1:1</span></div>`,
            { sub: LBL.tab === "internal" ? "Label internal — susunan diatur sendiri" : "Label BMN — format baku, tidak diubah" })}

          ${U.card("Lembar Cetak A4", `<div class="sheet-wrap" id="lblSheetWrap">${lblSheetHTML(0.62)}</div>`, {
            sub: (() => { const t = LBL.tab === "internal" ? LBL.tpl : LBL.bmn;
              const cols = Math.max(1, Math.floor(194 / (t.w + 2)));
              const rows = Math.max(1, Math.floor(281 / (t.h + 2)));
              return `${cols} kolom × ${rows} baris = ${cols * rows} label per lembar • ${n} label akan dicetak`; })(),
            tools: `<button class="btn btn-sm btn-primary" onclick="lblPrint()">${U.icon("print")} Cetak</button>` })}
        </div>
      </div>`;
  }

  function lblBmnOptions() {
    return U.card("Format Label BMN", `
      <div class="alert info small mb-12">${U.icon("shield", 15)}<div><b>Format baku</b>
        Isi label BMN mengikuti ketentuan penatausahaan: kode lokasi/satker, tahun perolehan,
        kode barang, dan NUP. Susunannya sengaja dikunci agar seragam antar satuan kerja.</div></div>
      <div class="grid g2" style="gap:12px">
        <div class="field"><label>Lebar (mm)</label>
          <input type="number" class="input" value="${LBL.bmn.w}" min="30" max="150" onchange="lblBmnSet('w',+this.value)"></div>
        <div class="field"><label>Tinggi (mm)</label>
          <input type="number" class="input" value="${LBL.bmn.h}" min="15" max="100" onchange="lblBmnSet('h',+this.value)"></div>
      </div>
      <div class="row mt-12"><span class="small" style="flex:1">Sertakan QR kode BMN</span>
        <label class="switch"><input type="checkbox" ${LBL.bmn.showQr ? "checked" : ""}
          onchange="lblBmnSet('showQr',this.checked)"><span></span></label></div>
      <div class="row wrap gap-6 mt-12">${PRESETS.map(([w, h]) =>
        `<span class="chip ${LBL.bmn.w === w && LBL.bmn.h === h ? "on" : ""}" onclick="lblBmnPreset(${w},${h})">${w}×${h}</span>`).join("")}</div>`);
  }

  function lblDesigner() {
    const t = LBL.tpl;
    return `
      ${U.card("Ukuran & Bingkai", `
        <div class="row wrap gap-6 mb-12">${PRESETS.map(([w, h]) =>
          `<span class="chip ${t.w === w && t.h === h ? "on" : ""}" onclick="lblPreset(${w},${h})">${w}×${h} mm</span>`).join("")}</div>
        <div class="grid g2" style="gap:12px">
          <div class="field"><label>Lebar (mm)</label>
            <input type="number" class="input" value="${t.w}" min="20" max="200" step="1" onchange="lblSet('w',+this.value)"></div>
          <div class="field"><label>Tinggi (mm)</label>
            <input type="number" class="input" value="${t.h}" min="10" max="150" step="1" onchange="lblSet('h',+this.value)"></div>
          <div class="field"><label>Padding dalam (mm)</label>
            <input type="number" class="input" value="${t.pad}" min="0" max="10" step="0.5" onchange="lblSet('pad',+this.value)"></div>
          <div class="field"><label>Bingkai</label>
            <div class="row" style="height:36px"><label class="switch"><input type="checkbox" ${t.border ? "checked" : ""}
              onchange="lblSet('border',this.checked)"><span></span></label>
              <span class="small muted">Garis tepi label</span></div></div>
        </div>`)}

      ${U.card("Kepala Label", `
        <div class="field mb-12"><label>Teks kepala (kosongkan bila tidak dipakai)</label>
          <input class="input" value="${U.esc(t.header)}" oninput="lblSet('header',this.value)"
            placeholder="Nama instansi / satuan kerja"></div>
        <div class="field"><label>Ukuran huruf kepala (mm): <b>${t.headerSize}</b></label>
          <input type="range" min="2" max="8" step="0.25" value="${t.headerSize}" style="width:100%"
            oninput="lblSet('headerSize',+this.value)"></div>`)}

      ${U.card("Isi Label", `
        <div class="tiny faint mb-8" style="display:grid;grid-template-columns:26px 1fr 74px 34px 46px;gap:8px">
          <span></span><span>ELEMEN</span><span>UKURAN</span><span>TEBAL</span><span>URUTAN</span></div>
        ${t.fields.map((f, i) => `
          <div class="fld-row">
            <input type="checkbox" ${f.on ? "checked" : ""} onchange="lblField(${i},'on',this.checked)" style="accent-color:var(--brand-600)">
            <div class="small trunc">${U.esc(D.FIELD_LABEL[f.k] || f.k)}</div>
            <input type="number" class="input" style="padding:3px 6px;font-size:11.5px" value="${f.size}" min="1.5" max="12" step="0.2"
              onchange="lblField(${i},'size',+this.value)">
            <input type="checkbox" ${f.bold ? "checked" : ""} onchange="lblField(${i},'bold',this.checked)" style="accent-color:var(--brand-600)">
            <div class="mv">
              <button onclick="lblMove(${i},-1)" ${i === 0 ? "disabled" : ""}>▲</button>
              <button onclick="lblMove(${i},1)" ${i === t.fields.length - 1 ? "disabled" : ""}>▼</button>
            </div>
          </div>`).join("")}
        <div class="hint mt-8">Ukuran huruf dalam milimeter agar hasil cetak konsisten di semua printer.</div>`)}

      ${U.card("Kode / Barcode", `
        <div class="field mb-12"><label>Jenis kode</label>
          <div class="row wrap gap-6">${[["code128", "Code 128"], ["qr", "QR Code"], ["both", "Keduanya"], ["none", "Tanpa kode"]]
            .map(([k, n]) => `<span class="chip ${t.code === k ? "on" : ""}" onclick="lblSet('code','${k}')">${n}</span>`).join("")}</div></div>
        <div class="field mb-12"><label>Posisi kode</label>
          <div class="row wrap gap-6">${["atas", "bawah", "kanan"].map((p) =>
            `<span class="chip ${t.codePos === p ? "on" : ""}" onclick="lblSet('codePos','${p}')">${p[0].toUpperCase() + p.slice(1)}</span>`).join("")}</div></div>
        <div class="grid g2" style="gap:12px">
          <div class="field"><label>Tinggi barcode (mm)</label>
            <input type="number" class="input" value="${t.codeH}" min="3" max="30" step="0.5" onchange="lblSet('codeH',+this.value)"></div>
          <div class="field"><label>Ukuran QR (mm)</label>
            <input type="number" class="input" value="${t.qrSize}" min="6" max="40" step="0.5" onchange="lblSet('qrSize',+this.value)"></div>
        </div>
        <div class="row mt-12"><span class="small" style="flex:1">Tampilkan teks di bawah barcode</span>
          <label class="switch"><input type="checkbox" ${t.codeText ? "checked" : ""} onchange="lblSet('codeText',this.checked)"><span></span></label></div>
        <div class="field mt-12"><label>Isi kode (muatan)</label>
          <input class="input mono" value="${U.esc(t.payload)}" oninput="lblSet('payload',this.value)">
          <div class="hint">Gunakan token berikut — klik untuk menyisipkan:</div>
          <div class="row wrap gap-4 mt-4">${PAYLOAD_TOKENS.map(([tk, d]) =>
            `<span class="chip" title="${U.esc(d)}" onclick="lblToken('${tk}')" style="font-size:10.5px;padding:2px 7px">${tk}</span>`).join("")}</div>
        </div>
        ${(() => {
          const it = selItems()[0] || allItems()[0];
          const pl = payloadFor(it, t.payload);
          const over = pl.length > B.QR_MAX;
          return `<div class="alert ${over ? "warn" : "info"} small mt-12">${U.icon(over ? "alert" : "check", 15)}<div>
            <b>Contoh muatan (${pl.length} karakter)</b><span class="mono" style="word-break:break-all">${U.esc(pl)}</span>
            ${over ? `<br>Melebihi kapasitas QR ${B.QR_MAX} karakter — perpendek muatan atau gunakan Code 128.` : ""}</div></div>`;
        })()}`)}`;
  }

  /* --- Render satu label -------------------------------------------------- */
  function labelInternalHTML(t, it) {
    const payload = payloadFor(it, t.payload);
    const lines = t.fields.filter((f) => f.on).map((f) =>
      `<div class="lbl-line" style="font-size:${f.size}mm;font-weight:${f.bold ? 700 : 400}">${U.esc(fieldVal(it, f.k))}</div>`).join("");

    let code = "";
    if (t.code === "code128" || t.code === "both") {
      code += `<div style="width:100%;height:${t.codeH}mm">${B.code128(payload, {
        height: 40, module: 1, quiet: 6, showText: false, fit: true })}</div>`;
      if (t.codeText) code += `<div style="font-size:2.6mm;font-family:monospace;text-align:center;line-height:1.1">${U.esc(payload)}</div>`;
    }
    if (t.code === "qr" || t.code === "both") {
      const q = B.qr(payload, { fit: true });
      code += `<div style="width:${t.qrSize}mm;height:${t.qrSize}mm;flex:0 0 auto">${q ||
        `<div style="font-size:2.4mm;color:#c00">muatan terlalu panjang</div>`}</div>`;
    }

    const codeBox = code
      ? `<div class="lbl-code" style="${t.codePos === "kanan"
          ? `flex:0 0 ${Math.max(t.qrSize, 14)}mm;` : "width:100%;"}">${code}</div>`
      : "";

    const inner = t.codePos === "kanan"
      ? `<div class="lbl-body" style="flex-direction:row"><div class="lbl-txt">${lines}</div>${codeBox}</div>`
      : `<div class="lbl-body" style="flex-direction:column">${t.codePos === "atas" ? codeBox : ""}
           <div class="lbl-txt">${lines}</div>${t.codePos === "bawah" ? codeBox : ""}</div>`;

    return `<div class="lbl ${t.border ? "lbl-bordered" : ""}"
      style="width:${t.w}mm;height:${t.h}mm;padding:${t.pad}mm;flex-direction:column">
      ${t.header ? `<div class="lbl-hdr" style="font-size:${t.headerSize}mm">${U.esc(t.header)}</div>` : ""}
      ${inner}</div>`;
  }

  function labelBmnHTML(o, it) {
    const b = it.bmn;
    const qr = o.showQr ? B.qr(it.bmnId, { fit: true }) : null;
    // Ukuran huruf diskalakan terhadap lebar label agar tidak pernah terpotong.
    const k = Math.min(1.35, o.w / 60);
    const cap = (t) => `<div class="lbl-line" style="font-size:${(1.8 * k).toFixed(2)}mm;letter-spacing:.03em">${t}</div>`;
    const val = (t, sz) => `<div class="lbl-line" style="font-size:${(sz * k).toFixed(2)}mm;font-weight:700;font-family:monospace">${U.esc(t)}</div>`;
    const qrMm = Math.min(o.h - 12, o.w * 0.22);

    return `<div class="lbl lbl-bordered" style="width:${o.w}mm;height:${o.h}mm;padding:1.8mm;flex-direction:column">
      <div class="lbl-hdr" style="font-size:${(2.0 * k).toFixed(2)}mm;line-height:1.2">
        ${U.esc(D.satker.namaBA.toUpperCase())}</div>
      <div class="lbl-line" style="font-size:${(1.9 * k).toFixed(2)}mm;font-weight:700;text-align:center;margin-bottom:.6mm">
        ${U.esc(D.satker.namaSatker.toUpperCase())}</div>
      <div class="lbl-body" style="flex-direction:row">
        <div class="lbl-txt" style="justify-content:flex-start;gap:.2mm">
          ${cap("KODE LOKASI / SATKER")}
          ${val(b.kodeLokasi, 2.6)}
          ${cap("KODE BARANG · NUP · TAHUN")}
          ${val(b.kodeBarang + " · " + b.nupFmt + " · " + b.thnPerolehan, 2.2)}
        </div>
        ${qr ? `<div class="lbl-code" style="flex:0 0 ${qrMm.toFixed(1)}mm">
          <div style="width:100%;aspect-ratio:1">${qr}</div></div>` : ""}
      </div>
      <div style="width:100%;height:${Math.max(4, o.h * 0.2).toFixed(1)}mm;flex:0 0 auto;margin-top:.4mm">
        ${B.code128(it.bmnId, { height: 40, module: 1, quiet: 6, showText: false, fit: true })}</div>
    </div>`;
  }

  function renderLabel(it) {
    return LBL.tab === "internal" ? labelInternalHTML(LBL.tpl, it) : labelBmnHTML(LBL.bmn, it);
  }

  function lblPreviewHTML() {
    const it = selItems()[0] || allItems()[0];
    return `<div class="lbl-shadow">${renderLabel(it)}</div>`;
  }

  function lblSheetHTML(scale) {
    const items = selItems();
    if (!items.length) return U.emptyState("Belum ada barang dipilih", "Centang minimal satu barang di panel kiri.");
    const t = LBL.tab === "internal" ? LBL.tpl : LBL.bmn;
    const cols = Math.max(1, Math.floor(194 / (t.w + 2)));
    const inner = items.map((it) => `<div style="margin:1mm">${renderLabel(it)}</div>`).join("");
    const sheet = `<div class="sheet" style="align-content:flex-start">${inner}</div>`;
    if (!scale) return sheet;
    return `<div style="width:${(210 * scale).toFixed(1)}mm;height:${(297 * scale).toFixed(1)}mm;overflow:hidden">
      <div class="sheet-scale" style="transform:scale(${scale})">${sheet}</div></div>
      <div class="tiny faint mt-8">Pratinjau diperkecil ${Math.round(scale * 100)}% • ${cols} kolom per baris</div>`;
  }

  /** Peringatkan bila isi label melebihi tinggi label. */
  function lblCheckOverflow() {
    const el = document.querySelector("#lblPreview .lbl");
    const warn = document.getElementById("lblWarn");
    if (!el || !warn) return;
    if (LBL.tab !== "internal") { warn.innerHTML = ""; return; }
    const over = el.scrollHeight > el.clientHeight + 1;
    const clipped = Array.prototype.slice
      .call(el.querySelectorAll(".lbl-line, .lbl-hdr"))
      .filter((x) => x.scrollWidth > x.clientWidth + 1)
      .map((x) => x.innerText.trim());
    const msgs = [];
    if (over) msgs.push("Isi melebihi <b>tinggi</b> label — kurangi elemen, perkecil ukuran huruf, atau tambah tinggi label.");
    if (clipped.length) msgs.push(`Teks terpotong secara <b>mendatar</b>: ${clipped.map(U.esc).join(", ")}
      — perkecil ukuran huruf, lebarkan label, atau perkecil QR.`);
    warn.innerHTML = msgs.length
      ? `<div class="alert warn small">${U.icon("alert", 15)}<div><b>Label belum pas</b>${msgs.join("<br>")}</div></div>`
      : `<div class="alert ok small">${U.icon("check", 15)}<div>Seluruh isi label muat pada ukuran ${LBL.tpl.w} × ${LBL.tpl.h} mm.</div></div>`;
  }

  function lblRefresh() {
    const p = document.getElementById("lblPreview");
    if (p) p.innerHTML = lblPreviewHTML();
    setTimeout(lblCheckOverflow, 0);
    const s = document.getElementById("lblSheetWrap");
    if (s) s.innerHTML = lblSheetHTML(0.62);
  }
  function lblRerender() {
    document.getElementById("viewBody").innerHTML = lblHTML();
    setTimeout(lblCheckOverflow, 0);
  }

  window.lblTab = function (t) { LBL.tab = t; lblRerender(); };
  window.lblSet = function (k, v) {
    LBL.tpl[k] = v;
    if (["code", "codePos", "payload", "border"].includes(k)) lblRerender(); else lblRefresh();
  };
  window.lblField = function (i, k, v) { LBL.tpl.fields[i][k] = v; lblRefresh(); };
  window.lblMove = function (i, d) {
    const f = LBL.tpl.fields, j = i + d;
    if (j < 0 || j >= f.length) return;
    const tmp = f[i]; f[i] = f[j]; f[j] = tmp;
    lblRerender();
  };
  window.lblPreset = function (w, h) { LBL.tpl.w = w; LBL.tpl.h = h; lblRerender(); };
  window.lblBmnSet = function (k, v) { LBL.bmn[k] = v; lblRerender(); };
  window.lblBmnPreset = function (w, h) { LBL.bmn.w = w; LBL.bmn.h = h; lblRerender(); };
  window.lblToken = function (tk) { LBL.tpl.payload += tk; lblRerender(); };
  window.lblPick = function (id, on) { if (on) LBL.sel[id] = true; else delete LBL.sel[id]; lblRefresh(); };
  window.lblAll = function (on) {
    Object.keys(LBL.sel).forEach((k) => delete LBL.sel[k]);
    if (on) allItems().forEach((x) => { LBL.sel[x.id] = true; });
    lblRerender();
  };
  window.lblFilter = function (q) {
    const s = (q || "").toLowerCase();
    document.querySelectorAll("#lblItems label").forEach((el) => {
      el.style.display = (el.dataset.nm || "").includes(s) ? "" : "none";
    });
  };

  window.lblSaveTpl = function () {
    U.modal({
      title: "Simpan Template Label", sub: "Template tersimpan di perangkat ini",
      body: `<div class="field"><label>Nama template</label>
          <input class="input" id="tplName" value="${U.esc(LBL.tpl.name)}"></div>
        <div class="alert info small mt-16">${U.icon("box", 15)}<div>Template menyimpan ukuran, bingkai, kepala label,
          susunan &amp; ukuran elemen, jenis kode, serta pola muatan barcode.</div></div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Batal</button>
             <button class="btn btn-primary" onclick="lblSaveTplGo()">Simpan</button>`
    });
  };
  window.lblSaveTplGo = function () {
    const nm = (document.getElementById("tplName") || {}).value || LBL.tpl.name;
    LBL.tpl.name = nm;
    const saved = JSON.parse(localStorage.getItem("flms.labelTpl") || "[]");
    const copy = JSON.parse(JSON.stringify(LBL.tpl));
    copy.id = "USR-" + Date.now();
    saved.push(copy);
    localStorage.setItem("flms.labelTpl", JSON.stringify(saved));
    U.closeModal();
    U.toast("Template disimpan", `"${nm}" dapat dipakai ulang kapan saja.`);
  };
  window.lblLoadTpl = function () {
    const saved = JSON.parse(localStorage.getItem("flms.labelTpl") || "[]");
    const all = D.labelTemplates.concat(saved);
    U.modal({
      size: "wide", title: "Template Label", sub: "Bawaan sistem dan template milik Anda",
      body: `<div class="grid g3">${all.map((t, i) => `
        <div class="card res-card" onclick="lblUseTpl(${i})"><div class="card-body">
          <div class="row mb-8"><b class="small" style="flex:1">${U.esc(t.name)}</b>
            ${t.id.startsWith("USR") ? `<span class="badge violet">Milik Anda</span>` : `<span class="badge outline">Bawaan</span>`}</div>
          <div class="lbl-stage" style="padding:10px;min-height:0"><div style="transform:scale(.8);transform-origin:center">
            ${labelInternalHTML(t, selItems()[0] || allItems()[0])}</div></div>
          <div class="tiny muted mt-8">${t.w} × ${t.h} mm • ${t.fields.filter((f) => f.on).length} elemen •
            ${{ code128: "Code 128", qr: "QR", both: "Code 128 + QR", none: "tanpa kode" }[t.code]}</div>
        </div></div>`).join("")}</div>`,
      foot: `<button class="btn" onclick="UI.closeModal()">Tutup</button>`
    });
    window.__tplAll = all;
  };
  window.lblUseTpl = function (i) {
    LBL.tpl = JSON.parse(JSON.stringify(window.__tplAll[i]));
    LBL.tab = "internal";
    U.closeModal();
    lblRerender();
    U.toast("Template dimuat", LBL.tpl.name);
  };

  window.lblPrint = function () {
    if (!selItems().length) { U.toast("Belum ada barang dipilih", "Centang minimal satu barang.", "warn"); return; }
    let root = document.querySelector(".print-root");
    if (!root) { root = document.createElement("div"); root.className = "print-root"; document.body.appendChild(root); }
    root.innerHTML = lblSheetHTML(0);
    window.print();
  };

})();
