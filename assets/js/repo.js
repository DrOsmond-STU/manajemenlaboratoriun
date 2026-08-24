/* ==========================================================================
   FLMS — Sumber data

   SATU BENTUK DATA UNTUK DUA SUMBER.

   Setiap layar mengambil datanya dari sini, bukan langsung dari API maupun
   langsung dari data purwarupa. Alasannya bukan kerapian:

   Tanpa lapisan ini, setiap layar harus bercabang sendiri —
   `if (API.mode === "api") … else …` — dan percabangan itu akan tersebar ke
   puluhan tempat. Yang terjadi berikutnya selalu sama: satu cabang diperbaiki,
   cabang lainnya tertinggal, lalu keduanya perlahan menampilkan hal berbeda.
   Cabang purwarupa yang tertinggal itu justru yang paling berbahaya, karena ia
   tetap tampak bekerja.

   BENTUK YANG DIPAKAI ADALAH BENTUK SERVER, bukan bentuk purwarupa. Data
   purwarupa yang dipetakan ke bentuk server, bukan sebaliknya. Dengan begitu,
   ketika mode purwarupa kelak dilepas, tidak ada satu layar pun yang berubah.
   ========================================================================== */
(function () {
  "use strict";

  const langsungKeApi = () => window.API && API.mode === "api";

  /* ------------------------------------------------------- peta purwarupa */

  const SKEMA_DARI_PURWARUPA = {
    FREE_INTERNAL: "internal_gratis",
    PAID: "berbayar",
    INTERNAL: "internal",
    EXTERNAL: "berbayar",
    RESTRICTED: "terbatas"
  };

  const NAMA_SKEMA = {
    internal: "Internal (tanpa tarif)",
    internal_gratis: "Internal gratis, eksternal berbayar",
    berbayar: "Berbayar",
    terbatas: "Terbatas / khusus"
  };

  const STATUS_DARI_PURWARUPA = {
    Available: ["tersedia", "Tersedia"],
    Booked: ["tersedia", "Tersedia"],
    Reserved: ["tersedia", "Tersedia"],
    Maintenance: ["pemeliharaan", "Pemeliharaan"]
  };

  /** Satu ruangan purwarupa → bentuk server. */
  function ruanganDariPurwarupa(r) {
    const st = STATUS_DARI_PURWARUPA[r.status] || ["tersedia", "Tersedia"];
    const skema = SKEMA_DARI_PURWARUPA[r.pricing] || "internal";

    return {
      id: r.id,
      kode: r.code,
      nama: r.name,
      jenis: r.type,
      gedung: r.building,
      lantai: String(r.floor),
      luas_m2: r.area,
      kapasitas: r.cap,
      tarif: { skema: skema, skema_nama: NAMA_SKEMA[skema] || skema, nilai: r.rate || null },
      status: { kode: st[0], nama: st[1] },
      perlu_persetujuan: false,
      penanggung_jawab: r.pic ? { id: r.pic, nama: window.DB ? DB.personName(r.pic) : r.pic } : null,
      tata_letak: r.layout || [],
      fasilitas: r.facs || [],
      keterangan: null,
      jumlah_booking_aktif: null
    };
  }

  /* ------------------------------------------------------------ pembantu */

  /**
   * Menandai bahwa sebuah tindakan tulis tidak tersedia di mode purwarupa.
   *
   * Sengaja MENOLAK, bukan berpura-pura berhasil lalu menyimpan ke memori.
   * Purwarupa yang menerima simpanan lalu menghilangkannya saat halaman
   * dimuat ulang jauh lebih merugikan daripada yang menolak sejak awal:
   * orang mengetik data sungguhan ke dalamnya, mengira sudah tersimpan.
   */
  function tolakDiModeContoh(apa) {
    const e = new Error(
      apa + " hanya tersedia setelah masuk dengan akun. " +
      "Mode data contoh tidak menyimpan apa pun."
    );
    e.modeContoh = true;
    return Promise.reject(e);
  }

  function qs(params) {
    const bagian = [];
    Object.keys(params || {}).forEach(function (k) {
      const v = params[k];
      if (v === undefined || v === null || v === "") return;
      bagian.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
    });
    return bagian.length ? "?" + bagian.join("&") : "";
  }

  /* ------------------------------------------------------------- ruangan */

  const ruangan = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.rooms : []).map(ruanganDariPurwarupa);

        // Penapisan ditiru di sisi purwarupa supaya perilaku layarnya sama
        // di kedua mode — kalau tidak, kotak pencarian yang bekerja saat
        // demo akan diam saat sungguhan, atau sebaliknya.
        if (tapis && tapis.cari) {
          const k = tapis.cari.toLowerCase();
          baris = baris.filter((r) =>
            (r.nama + " " + r.kode + " " + (r.gedung || "")).toLowerCase().indexOf(k) !== -1);
        }
        if (tapis && tapis.gedung) baris = baris.filter((r) => r.gedung === tapis.gedung);
        if (tapis && tapis.jenis) baris = baris.filter((r) => r.jenis === tapis.jenis);

        return { data: baris, total: baris.length };
      }

      const jawaban = await API.get("/api/rooms" + qs(tapis));
      return { data: jawaban.data, total: (jawaban.meta && jawaban.meta.total) || jawaban.data.length };
    },

    async ambil(id) {
      if (!langsungKeApi()) {
        const r = (window.DB ? DB.rooms : []).find((x) => x.id === id);
        return r ? ruanganDariPurwarupa(r) : null;
      }
      return (await API.get("/api/rooms/" + encodeURIComponent(id))).data;
    },

    simpan(isi, id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menyimpan ruangan");

      return id
        ? API.patch("/api/rooms/" + encodeURIComponent(id), isi).then((j) => j.data)
        : API.post("/api/rooms", isi).then((j) => j.data);
    },

    hapus(id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menghapus ruangan");
      return API.hapus("/api/rooms/" + encodeURIComponent(id));
    }
  };


  /* --------------------------------------------------------- laboratorium */

  const STATUS_LAB_PURWARUPA = {
    "Aktif": ["aktif", "Aktif"],
    "Renovasi": ["pemeliharaan", "Pemeliharaan"],
    "Nonaktif": ["tidak_aktif", "Tidak Aktif"]
  };

  function labDariPurwarupa(l) {
    const st = STATUS_LAB_PURWARUPA[l.status] || ["aktif", "Aktif"];
    const nama = (id) => (window.DB ? DB.personName(id) : id);

    return {
      id: l.id,
      kode: l.code,
      nama: l.name,
      jenis: l.type,
      unit_kerja: null,
      luas_m2: l.area,
      kapasitas: l.cap,
      jam_layanan: l.hours,
      akreditasi: l.accred === "\u2014" ? null : l.accred,
      fasilitas: l.facs || [],
      status: { kode: st[0], nama: st[1] },
      ruangan: null,
      penanggung_jawab: l.pic ? { id: l.pic, nama: nama(l.pic) } : null,
      supervisor: l.supervisor ? { id: l.supervisor, nama: nama(l.supervisor) } : null,
      teknisi: (l.tech || []).map((t) => ({ id: t, nama: nama(t) })),
      jumlah_aset: l.assets,
      keterangan: null
    };
  }

  const laboratorium = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.labs : []).map(labDariPurwarupa);

        if (tapis && tapis.cari) {
          const k = tapis.cari.toLowerCase();
          baris = baris.filter((l) =>
            (l.nama + " " + l.kode + " " + (l.jenis || "")).toLowerCase().indexOf(k) !== -1);
        }
        if (tapis && tapis.jenis) baris = baris.filter((l) => l.jenis === tapis.jenis);
        if (tapis && tapis.status) baris = baris.filter((l) => l.status.kode === tapis.status);

        return { data: baris, total: baris.length };
      }

      const jawaban = await API.get("/api/laboratories" + qs(tapis));
      return { data: jawaban.data, total: (jawaban.meta && jawaban.meta.total) || jawaban.data.length };
    },

    async ambil(id) {
      if (!langsungKeApi()) {
        const l = (window.DB ? DB.labs : []).find((x) => x.id === id);
        return l ? labDariPurwarupa(l) : null;
      }
      return (await API.get("/api/laboratories/" + encodeURIComponent(id))).data;
    },

    simpan(isi, id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menyimpan laboratorium");

      return id
        ? API.patch("/api/laboratories/" + encodeURIComponent(id), isi).then((j) => j.data)
        : API.post("/api/laboratories", isi).then((j) => j.data);
    },

    hapus(id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menghapus laboratorium");
      return API.hapus("/api/laboratories/" + encodeURIComponent(id));
    }
  };

  /* ------------------------------------------------------------- pengguna */

  const pengguna = {
    /**
     * Daftar pengguna untuk pemilihan.
     *
     * Di mode purwarupa memakai daftar orang di data.js. Bentuknya sama
     * persis dengan yang dikirim server — id, nama, unit_kerja — sehingga
     * pemilihnya tidak perlu tahu sedang berjalan di mode mana.
     */
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.people : []).map((p) => ({
          id: p.id, nama: p.name, unit_kerja: p.unit || null
        }));
        if (tapis && tapis.cari) {
          const k = tapis.cari.toLowerCase();
          baris = baris.filter((p) => p.nama.toLowerCase().indexOf(k) !== -1);
        }
        return { data: baris.slice(0, 50), terpotong: baris.length > 50 };
      }

      const j = await API.get("/api/pengguna" + qs(tapis));
      return { data: j.data, terpotong: !!j.terpotong };
    }
  };



  const KOND_NAMA = { B: "Baik", RR: "Rusak Ringan", RB: "Rusak Berat" };

  /**
   * D.assets (aset fasilitas) tidak punya `bmn.kondisi` — kondisinya hanya
   * ada sebagai teks bebas `cond`. Dipetakan ke kode B/RR/RB server supaya
   * Asset Register di mode purwarupa tidak selalu menampilkan "Baik".
   */
  const KOND_KODE_DARI_TEKS = {
    "Baik": "B",
    "Perlu Perawatan": "RR",
    "Perlu Perbaikan": "RR",
    "Rusak Ringan": "RR",
    "Rusak": "RR",
    "Rusak Berat": "RB"
  };

  /**
   * Satu aset purwarupa → bentuk server.
   *
   * Purwarupa memakai dua koleksi terpisah (peralatan lab dan aset fasilitas)
   * dengan nama medan yang berbeda dari server. Dipetakan di sini supaya
   * layarnya tidak perlu tahu sedang berjalan di mode mana — dan supaya saat
   * mode purwarupa kelak dilepas, tidak ada layar yang berubah.
   */
  function asetDariPurwarupa(x) {
    const b = x.bmn || {};
    const nama = (id) => (window.DB ? DB.personName(id) : id);
    const lab = window.DB && x.lab ? DB.byId(DB.labs, x.lab) : null;
    const ruang = window.DB && x.room ? DB.byId(DB.rooms, x.room) : null;

    return {
      id: x.id,
      bmn: {
        id: x.bmnId,
        kode_lokasi: b.kodeLokasi,
        kode_barang: b.kodeBarang,
        uraian_barang: b.uraianBarang,
        nup: b.nup,
        nup_fmt: b.nupFmt,
        kib: b.kib || "B"
      },
      kode_internal: x.kodeInternal || x.code,
      nama: x.name,
      merk: x.brand || null,
      tipe: x.model || null,
      serial_number: x.sn || null,
      spesifikasi: b.spesifikasi || null,
      kapasitas_ukur: null,
      kelengkapan: [],
      foto: { utama: null, jumlah: (x.foto || []).length },
      perolehan: {
        cara: b.caraPerolehan || null,
        tanggal: b.thnPerolehan ? b.thnPerolehan + "-01-01" : null,
        sumber_dana: b.sumberDana || null,
        no_bukti: b.noBukti || null,
        no_kontrak: b.noKontrak || null,
        kuantitas: b.kuantitas || 1,
        satuan: b.satuan || "Unit"
      },
      // Di luar unsur BMN — hanya ada pada koleksi D.assets (aset fasilitas),
      // bukan pada D.equipment (alat lab tidak punya kolom ini di purwarupa).
      pemasok: x.supplier || null,
      garansi_berakhir: x.warranty || null,
      penyusutan: {
        nilai_perolehan: b.nilaiPerolehan || 0,
        masa_manfaat: b.masaManfaat || 0,
        akumulasi_penyusutan: b.akumPenyusutan || 0,
        nilai_buku: b.nilaiBuku || 0,
        habis_masa_manfaat: (b.nilaiBuku || 0) <= 0
      },
      kondisi: (() => {
        const kode = b.kondisi || KOND_KODE_DARI_TEKS[x.cond] || "B";
        return { kode: kode, nama: KOND_NAMA[kode] || "Baik" };
      })(),
      status_penggunaan: b.statusPenggunaan || x.status || null,
      psp: { nomor: b.noPsp || null, tanggal: b.tglPsp || null },
      wajib_kalibrasi: !!x.calDue,
      kalibrasi: x.calDue ? { berlaku_sampai: x.calDue, kedaluwarsa: x.calDue < DB.shift(0) } : undefined,
      unit_kerja: null,
      laboratorium: lab ? { id: lab.id, kode: lab.code, nama: lab.name } : null,
      ruangan: ruang ? { id: ruang.id, kode: ruang.code, nama: ruang.name } : null,
      penanggung_jawab: x.pic ? { id: x.pic, nama: nama(x.pic) } : null,
      keterangan: b.keterangan || null
    };
  }

  function asetPurwarupaSemua() {
    if (!window.DB) return [];
    return (DB.equipment || []).concat(DB.assets || []).map(asetDariPurwarupa);
  }

  /* ------------------------------------------------------------------ aset */

  const aset = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = asetPurwarupaSemua();

        if (tapis && tapis.cari) {
          const k = tapis.cari.toLowerCase();
          baris = baris.filter((a) =>
            ((a.nama || "") + " " + (a.kode_internal || "") + " " +
             (a.bmn.id || "") + " " + (a.serial_number || "")).toLowerCase().indexOf(k) !== -1);
        }
        if (tapis && tapis.kondisi) baris = baris.filter((a) => a.kondisi.kode === tapis.kondisi);
        if (tapis && tapis.kode_barang) {
          baris = baris.filter((a) => (a.bmn.kode_barang || "").indexOf(tapis.kode_barang) === 0);
        }
        if (tapis && tapis.wajib_kalibrasi !== undefined && tapis.wajib_kalibrasi !== "") {
          const ingin = tapis.wajib_kalibrasi === "1" || tapis.wajib_kalibrasi === 1 || tapis.wajib_kalibrasi === true;
          baris = baris.filter((a) => a.wajib_kalibrasi === ingin);
        }
        if (tapis && tapis.laboratory_id) {
          baris = baris.filter((a) => a.laboratorium && String(a.laboratorium.id) === String(tapis.laboratory_id));
        }

        return { data: baris, total: baris.length, purwarupa: true };
      }
      const j = await API.get("/api/assets" + qs(tapis));
      return { data: j.data, total: (j.meta && j.meta.total) || j.data.length };
    },

    simpan(isi, id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Mendaftarkan aset");

      return id
        ? API.patch("/api/assets/" + encodeURIComponent(id), isi).then((j) => j.data)
        : API.post("/api/assets", isi).then((j) => j.data);
    },

    /**
     * Mengunggah satu foto.
     *
     * Memakai FormData, jadi TIDAK lewat API.post() yang selalu mengirim JSON.
     * Content-Type sengaja tidak diisi: peramban harus menentukannya sendiri
     * supaya batas multipart-nya ikut tertulis — mengisinya manual
     * menghasilkan permintaan yang tidak dapat diurai server.
     */
    async unggahFoto(asetId, berkas, keterangan) {
      if (!langsungKeApi()) return tolakDiModeContoh("Mengunggah foto");

      const form = new FormData();
      form.append("foto", berkas);
      if (keterangan) form.append("keterangan", keterangan);

      return API.kirimForm("/api/assets/" + encodeURIComponent(asetId) + "/foto", form);
    },

    async ringkasan(tapis) {
      if (!langsungKeApi()) {
        const baris = (await aset.daftar(tapis)).data;
        const jml = (k) => baris.filter((a) => a.kondisi.kode === k).length;
        const total = (f) => baris.reduce((a, x) => a + (x.penyusutan[f] || 0), 0);
        const sekarang = new Date(), batas = new Date(); batas.setDate(batas.getDate() + 90);
        const garansiAkanBerakhir = baris.filter((a) => {
          if (!a.garansi_berakhir) return false;
          const g = new Date(a.garansi_berakhir);
          return g >= sekarang && g <= batas;
        }).length;

        const dihapuskan = baris.filter((a) => a.status_penggunaan === "Dihapuskan");
        const perKode = {};
        baris.forEach((a) => {
          const kode = a.bmn.kode_barang || "-";
          if (!perKode[kode]) perKode[kode] = { kode_barang: kode, uraian: a.bmn.uraian_barang || kode, jumlah: 0, nilai_perolehan: 0, nilai_buku: 0 };
          perKode[kode].jumlah++;
          perKode[kode].nilai_perolehan += a.penyusutan.nilai_perolehan || 0;
          perKode[kode].nilai_buku += a.penyusutan.nilai_buku || 0;
        });
        const komposisi = Object.values(perKode).sort((a, b) => b.jumlah - a.jumlah).slice(0, 10);

        return {
          jumlah: baris.length,
          nilai_perolehan: total("nilai_perolehan"),
          akumulasi_penyusutan: total("akumulasi_penyusutan"),
          nilai_buku: total("nilai_buku"),
          garansi_akan_berakhir: garansiAkanBerakhir,
          disposal: { jumlah: dihapuskan.length, nilai_buku: dihapuskan.reduce((a, x) => a + (x.penyusutan.nilai_buku || 0), 0) },
          per_kode_barang: komposisi,
          kondisi: Object.keys(KOND_NAMA).map((k) => ({ kode: k, nama: KOND_NAMA[k], jumlah: jml(k) })),
          purwarupa: true
        };
      }
      return (await API.get("/api/assets/ringkasan" + qs(tapis))).data;
    },

    async ambil(id) {
      if (!langsungKeApi()) {
        return asetPurwarupaSemua().find((a) => String(a.id) === String(id)) || null;
      }
      return (await API.get("/api/assets/" + encodeURIComponent(id))).data;
    },

    async foto(asetId) {
      if (!langsungKeApi()) return { data: [] };
      return API.get("/api/assets/" + encodeURIComponent(asetId) + "/foto");
    },

    hapusFoto(asetId, fotoId) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menghapus foto");
      return API.hapus("/api/assets/" + encodeURIComponent(asetId) + "/foto/" + encodeURIComponent(fotoId));
    },

    jadikanFotoUtama(asetId, fotoId) {
      if (!langsungKeApi()) return tolakDiModeContoh("Mengubah foto utama");
      return API.post("/api/assets/" + encodeURIComponent(asetId) + "/foto/" + encodeURIComponent(fotoId) + "/utama");
    },

    kodeBarang(awalan) {
      if (!langsungKeApi()) return Promise.resolve({ data: [] });
      return API.get("/api/bmn/kode-barang" + qs({ awalan: awalan }));
    },

    /**
     * Riwayat perubahan SATU aset — dipakai panel "Riwayat Pergerakan Aset"
     * pada layar detail. Tidak dimodelkan di purwarupa (data.js tidak
     * menyimpan riwayat per barang, hanya baris tampilan yang dikarang
     * langsung di layar) sehingga mode contoh jujur mengembalikan kosong.
     */
    async riwayat(asetId) {
      if (!langsungKeApi()) return { data: [], purwarupa: true };
      return API.get("/api/assets/" + encodeURIComponent(asetId) + "/riwayat");
    },

    mutasi(asetId, isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Memindahkan aset");
      return API.patch("/api/assets/" + encodeURIComponent(asetId) + "/mutasi", isi).then((j) => j.data);
    },

    /**
     * Feed mutasi LINTAS SELURUH aset — dipakai layar "Asset Movement &
     * Mutasi". Sama seperti riwayat(), tidak ada padanan purwarupa (baris
     * di layar itu dikarang langsung, bukan berasal dari data.js), sehingga
     * mode contoh jujur mengembalikan kosong alih-alih data karangan yang
     * tidak dapat ditelusuri ke aset sungguhan mana pun.
     */
    async mutasiSemua(tapis) {
      if (!langsungKeApi()) return { data: [], total: 0, purwarupa: true };
      const j = await API.get("/api/assets/mutasi" + qs(tapis));
      return { data: j.data, total: (j.meta && j.meta.total) || j.data.length };
    }
  };


  /* --------------------------------------------------------------- booking */

  const STATUS_BOOKING_PURWARUPA = {
    "Waiting Approval": ["menunggu", "Menunggu persetujuan", true],
    "Approved": ["disetujui", "Disetujui", true],
    "In Use": ["berlangsung", "Sedang berlangsung", true],
    "Completed": ["selesai", "Selesai", true],
    "Cancelled": ["dibatalkan", "Dibatalkan", false],
    "Rejected": ["ditolak", "Ditolak", false]
  };

  function bookingDariPurwarupa(b) {
    const st = STATUS_BOOKING_PURWARUPA[b.status] || ["menunggu", "Menunggu persetujuan", true];
    const nama = (id) => (window.DB ? DB.personName(id) : id);

    return {
      id: b.id,
      keperluan: b.agenda,
      jumlah_peserta: b.people || null,
      mulai: b.date + "T" + b.start + ":00",
      selesai: b.date + "T" + b.end + ":00",
      status: { kode: st[0], nama: st[1], memblokir: st[2] },
      catatan: null,
      persetujuan: { disetujui_pada: null, alasan_penolakan: null, oleh: null },
      ruangan: { id: b.res, kode: b.res, nama: b.resName },
      pemohon: b.requester ? { id: b.requester, nama: nama(b.requester) } : null
    };
  }

  /* ------------------------------------------------------------ pemeliharaan */
  /*
     SATU DAFTAR UNTUK KEDUANYA — pemeliharaan dan kalibrasi — persis seperti
     server (lihat migrasi asset_maintenances): teknisi yang melihat "apa
     yang jatuh tempo hari ini" tidak ingin membuka dua layar berbeda.
     Purwarupa memakai D.maintenance (preventif/korektif/darurat) dan
     D.calibration (kalibrasi) sebagai dua koleksi terpisah — digabungkan di
     sini menjadi satu bentuk, sama seperti server menggabungkannya di satu
     tabel.
  */

  const JENIS_PML_DARI_PURWARUPA = { Preventive: "preventif", Corrective: "korektif", Emergency: "darurat" };
  const NAMA_JENIS_PML = {
    preventif: "Pemeliharaan preventif", korektif: "Pemeliharaan korektif",
    darurat: "Penanganan darurat", kalibrasi: "Kalibrasi"
  };
  const STATUS_PML_DARI_PURWARUPA = {
    Scheduled: "dijadwalkan", "In Progress": "berjalan", "Waiting Part": "berjalan",
    Completed: "selesai", Overdue: "dijadwalkan"
  };
  const NAMA_STATUS_PML = {
    dijadwalkan: "Dijadwalkan", berjalan: "Sedang dikerjakan", selesai: "Selesai", dibatalkan: "Dibatalkan"
  };

  /** Kode target purwarupa ("RM-006", "LAB-006", "EQ-0005", "AST-…") → sumber daya ringkas. */
  function sumberDayaPmlDariPurwarupa(kode, nama) {
    const jenis = /^RM/.test(kode) ? "ruangan" : /^LAB/.test(kode) ? "laboratorium" : "aset";
    return { jenis: jenis, id: kode, nama: nama };
  }

  function workOrderDariPurwarupa(m) {
    const jenis = JENIS_PML_DARI_PURWARUPA[m.kind] || "preventif";
    const status = STATUS_PML_DARI_PURWARUPA[m.status] || "dijadwalkan";
    const hariIni = window.DB ? DB.shift(0) : m.sched;

    return {
      id: m.id,
      jenis: { kode: jenis, nama: NAMA_JENIS_PML[jenis] },
      status: { kode: status, nama: NAMA_STATUS_PML[status] },
      jadwal: m.sched,
      dikerjakan_pada: status === "selesai" ? m.sched : null,
      terlambat: status !== "selesai" && status !== "dibatalkan" && m.sched < hariIni,
      pelaksana: m.vendor || null,
      hasil: status === "selesai" ? (m.note || null) : null,
      biaya: m.cost || 0,
      kalibrasi: null,
      sumber_daya: sumberDayaPmlDariPurwarupa(m.target, m.targetName),
      petugas: m.tech ? { id: m.tech, nama: window.DB ? DB.personName(m.tech) : m.tech } : null,
      catatan: m.note || null
    };
  }

  function kalibrasiDariPurwarupa(c) {
    const status = STATUS_PML_DARI_PURWARUPA[c.status] || "dijadwalkan";
    const hariIni = window.DB ? DB.shift(0) : c.due;
    const kedaluwarsa = c.due < hariIni;

    return {
      id: c.id,
      jenis: { kode: "kalibrasi", nama: "Kalibrasi" },
      status: { kode: status, nama: NAMA_STATUS_PML[status] },
      jadwal: c.due,
      dikerjakan_pada: null,
      terlambat: status !== "selesai" && status !== "dibatalkan" && kedaluwarsa,
      pelaksana: c.lab || null,
      hasil: c.result || null,
      biaya: c.cost || 0,
      kalibrasi: {
        no_sertifikat: c.cert || null, lembaga: c.lab || null,
        berlaku_sampai: c.due, kedaluwarsa: kedaluwarsa
      },
      sumber_daya: sumberDayaPmlDariPurwarupa(c.eq, c.eqName),
      petugas: null,
      catatan: null
    };
  }

  function pemeliharaanPurwarupaSemua() {
    if (!window.DB) return [];
    return (DB.maintenance || []).map(workOrderDariPurwarupa)
      .concat((DB.calibration || []).map(kalibrasiDariPurwarupa));
  }

  const pemeliharaan = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = pemeliharaanPurwarupaSemua();
        if (tapis) {
          if (tapis.jenis) baris = baris.filter((m) => m.jenis.kode === tapis.jenis);
          if (tapis.status) baris = baris.filter((m) => m.status.kode === tapis.status);
          if (tapis.terlambat) baris = baris.filter((m) => m.terlambat);
        }
        return { data: baris, meta: { total: baris.length } };
      }
      return API.get("/api/pemeliharaan" + qs(tapis));
    },

    async lihat(id) {
      if (!langsungKeApi()) {
        return pemeliharaanPurwarupaSemua().find((m) => String(m.id) === String(id)) || null;
      }
      return API.get("/api/pemeliharaan/" + encodeURIComponent(id)).then((j) => j.data);
    },

    jadwalkan(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menjadwalkan pemeliharaan");
      return API.post("/api/pemeliharaan", isi).then((j) => j.data);
    },

    selesaikan(id, isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menyelesaikan pemeliharaan");
      return API.post("/api/pemeliharaan/" + encodeURIComponent(id) + "/selesaikan", isi).then((j) => j.data);
    },

    async kalibrasiKedaluwarsa() {
      if (!langsungKeApi()) {
        return { data: asetPurwarupaSemua().filter((a) => a.wajib_kalibrasi) };
      }
      return API.get("/api/pemeliharaan/kalibrasi-kedaluwarsa");
    }
  };

  const booking = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.bookings : []).map(bookingDariPurwarupa);

        if (tapis && tapis.status) baris = baris.filter((b) => b.status.kode === tapis.status);
        if (tapis && tapis.cari) {
          const k = tapis.cari.toLowerCase();
          baris = baris.filter((b) =>
            ((b.keperluan || "") + " " + (b.ruangan ? b.ruangan.nama : "") + " " +
             (b.pemohon ? b.pemohon.nama : "")).toLowerCase().indexOf(k) !== -1);
        }

        return { data: baris, total: baris.length, purwarupa: true };
      }

      const j = await API.get("/api/bookings" + qs(tapis));
      return { data: j.data, total: (j.meta && j.meta.total) || j.data.length };
    },

    async ambil(id) {
      if (!langsungKeApi()) {
        return (window.DB ? DB.bookings : []).map(bookingDariPurwarupa)
          .find((b) => String(b.id) === String(id)) || null;
      }
      return (await API.get("/api/bookings/" + encodeURIComponent(id))).data;
    },

    /**
     * Mengajukan pemesanan.
     *
     * Bentrok jadwal datang sebagai galat validasi 422 biasa dengan pesan yang
     * sudah menyebut pemesanan yang menabraknya — diterjemahkan server dari
     * pelanggaran batasan basis data. Antarmuka TIDAK memeriksa bentrok
     * sendiri lebih dulu: pemeriksaan di peramban selalu memakai data yang
     * sudah usang beberapa detik, dan dua orang yang memesan bersamaan akan
     * sama-sama lolos.
     */
    simpan(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Mengajukan pemesanan");
      return API.post("/api/bookings", isi).then((j) => j.data);
    },

    /**
     * Ruangan mana yang bebas pada rentang waktu tertentu.
     *
     * Selalu ditanyakan ke server, tidak pernah dihitung di sini: daftar
     * pemesanan yang sudah dimuat peramban berumur beberapa detik sampai
     * menit, dan dalam rentang itu orang lain sudah dapat memesan.
     */
    async ketersediaan(mulai, selesai, kapasitasMin) {
      if (!langsungKeApi()) return { data: [], purwarupa: true };

      const j = await API.get("/api/bookings/ketersediaan" + qs({
        mulai: mulai, selesai: selesai, kapasitas_min: kapasitasMin || null
      }));
      return { data: j.data };
    }
  };


  /* ------------------------------------------------------------ peminjaman */

  const STATUS_PINJAM_PURWARUPA = {
    "Requested": ["menunggu", "Menunggu persetujuan"],
    "Approved": ["disetujui", "Disetujui"],
    "In Use": ["dipinjam", "Sedang dipinjam"],
    "Returned": ["dikembalikan", "Dikembalikan"],
    "Rejected": ["ditolak", "Ditolak"],
    "Cancelled": ["dibatalkan", "Dibatalkan"]
  };

  function pinjamDariPurwarupa(p) {
    const st = STATUS_PINJAM_PURWARUPA[p.status] || ["menunggu", "Menunggu persetujuan"];
    const nama = (id) => (window.DB ? DB.personName(id) : id);
    const alat = window.DB ? DB.byId(DB.equipment, p.eq) : null;

    return {
      id: p.id,
      keperluan: p.purpose || p.agenda || "—",
      lokasi_pemakaian: p.place || null,
      unit_kerja: p.unit || null,
      jadwal: { mulai: p.date + "T" + (p.start || "08:00") + ":00",
                selesai: (p.until || p.date) + "T" + (p.end || "16:00") + ":00" },
      serah_terima: { diambil_pada: null, dikembalikan_pada: null },
      status: { kode: st[0], nama: st[1] },
      terlambat: false,
      kondisi_saat_kembali: null,
      alat: alat ? { id: alat.id, nama: alat.name, kode_internal: alat.kodeInternal, bmn_id: alat.bmnId } : null,
      peminjam: p.by ? { id: p.by, nama: nama(p.by) } : null,
      catatan: null,
      persetujuan: { disetujui_pada: null, alasan_penolakan: null }
    };
  }

  const peminjaman = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.eqBookings : []).map(pinjamDariPurwarupa);
        if (tapis && tapis.status) baris = baris.filter((p) => p.status.kode === tapis.status);
        if (tapis && tapis.cari) {
          const k = tapis.cari.toLowerCase();
          baris = baris.filter((p) =>
            ((p.keperluan || "") + " " + (p.alat ? p.alat.nama : "") + " " +
             (p.peminjam ? p.peminjam.nama : "")).toLowerCase().indexOf(k) !== -1);
        }
        return { data: baris, total: baris.length, purwarupa: true };
      }

      const j = await API.get("/api/peminjaman" + qs(tapis));
      return { data: j.data, total: (j.meta && j.meta.total) || j.data.length };
    },

    simpan(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Mengajukan peminjaman");
      return API.post("/api/peminjaman", isi).then((j) => j.data);
    },

    async ketersediaan(mulai, selesai, cari) {
      if (!langsungKeApi()) return { data: [], purwarupa: true };
      const j = await API.get("/api/peminjaman/ketersediaan" + qs({
        mulai: mulai, selesai: selesai, cari: cari || null
      }));
      return { data: j.data };
    },

    serahkan(id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Serah terima alat");
      return API.post("/api/peminjaman/" + encodeURIComponent(id) + "/serahkan").then((j) => j.data);
    },

    kembalikan(id, kondisi, catatan) {
      if (!langsungKeApi()) return tolakDiModeContoh("Pengembalian alat");
      return API.post("/api/peminjaman/" + encodeURIComponent(id) + "/kembalikan", {
        kondisi: kondisi, catatan: catatan || null
      }).then((j) => j.data);
    }
  };

  /* ----------------------------------------------------------- persetujuan */

  const persetujuan = {
    /**
     * Antrean yang menunggu keputusan pengguna ini.
     *
     * Server sudah mengeluarkan pengajuan milik pengguna sendiri dari antrean —
     * tidak ada yang boleh menyetujui pengajuannya sendiri, dan itu ditegakkan
     * batasan basis data, bukan hanya disaring di sini.
     */
    async antrean(jenis) {
      if (!langsungKeApi()) {
        if (jenis === "peminjaman") {
          return { data: (await peminjaman.daftar({ status: "menunggu" })).data, purwarupa: true };
        }
        return { data: (await booking.daftar({ status: "menunggu" })).data, purwarupa: true };
      }
      const j = await API.get("/api/persetujuan/antrean" + qs({ jenis: jenis }));
      return { data: j.data };
    },

    setujui(jenis, id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menyetujui pengajuan");
      return API.post("/api/persetujuan/" + jenis + "/" + encodeURIComponent(id) + "/setujui")
        .then((j) => j.data);
    },

    tolak(jenis, id, alasan) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menolak pengajuan");
      return API.post("/api/persetujuan/" + jenis + "/" + encodeURIComponent(id) + "/tolak",
        { alasan: alasan }).then((j) => j.data);
    }
  };


  /* ------------------------------------------------------------ checklist */


  /* ------------------------------------------------------------ checklist */

  const JENIS_CK_PURWARUPA = {
    verifikasi: ["pengecekan", "Pengecekan & Verifikasi"],
    perawatan: ["perawatan", "Perawatan"],
    sewa: ["penyewaan", "Persiapan Penyewaan"],
    kebersihan: ["kebersihan", "Kebersihan"],
    kerapian: ["kerapian", "Kerapian"],
    kelayakan: ["kelayakan", "Kelayakan"]
  };

  const TIPE_BUTIR_PURWARUPA = {
    ok: ["ya_tidak", "Ya / Tidak"],
    rating: ["pilihan", "Pilihan"],
    angka: ["angka", "Angka"],
    teks: ["teks", "Teks bebas"],
    // Foto dan tanda tangan tidak punya padanan di server — dipetakan ke
    // teks bebas supaya template purwarupa tetap tampil, bukan hilang.
    foto: ["teks", "Teks bebas"],
    ttd: ["teks", "Teks bebas"]
  };

  function templatCkDariPurwarupa(t) {
    const jenis = JENIS_CK_PURWARUPA[t.type] || ["pengecekan", t.type];

    return {
      id: t.id,
      nama: t.name,
      jenis: { kode: jenis[0], nama: jenis[1] },
      deskripsi: null,
      aktif: !!t.active,
      jumlah_butir: t.items.length,
      jumlah_penugasan: t.assignees.length,
      butir: t.items.map((it, i) => {
        const tp = TIPE_BUTIR_PURWARUPA[it.kind] || ["teks", "Teks bebas"];
        return {
          id: t.id + "-" + i, urutan: i + 1, teks: it.t,
          tipe: { kode: tp[0], nama: tp[1] },
          wajib: !!it.req,
          pilihan: it.kind === "rating" ? ["1", "2", "3", "4", "5"] : null,
          satuan: null, petunjuk: it.hint || null
        };
      }),
      dibuat_oleh: t.owner
        ? { id: t.owner, nama: window.DB ? DB.personName(t.owner) : t.owner } : null
    };
  }

  /** Menebak jenis dan nama sebuah sumber daya purwarupa dari id-nya. */
  function sumberDayaDariIdPurwarupa(resId) {
    if (!window.DB) return null;
    const lab = DB.byId(DB.labs, resId);
    if (lab) return { jenis: "laboratorium", id: lab.id, nama: lab.name };
    const ruang = DB.byId(DB.rooms, resId);
    if (ruang) return { jenis: "ruangan", id: ruang.id, nama: ruang.name };
    const eq = DB.byId(DB.equipment, resId) || DB.byId(DB.assets, resId);
    if (eq) return { jenis: "aset", id: eq.id, nama: eq.name };
    return null;
  }

  /** Pengguna yang sedang "masuk" pada mode data contoh, dari localStorage. */
  function penggunaContohSaatIni() {
    if (!window.DB) return null;
    const nm = localStorage.getItem("flms.user") || "Rahmat Hidayat";
    return DB.people.find((p) => p.name === nm) || DB.people[2] || null;
  }

  const checklist = {
    async templat(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.checklistTemplates : []).map(templatCkDariPurwarupa);
        if (tapis && tapis.jenis) baris = baris.filter((t) => t.jenis.kode === tapis.jenis);
        if (tapis && tapis.hanya_aktif) baris = baris.filter((t) => t.aktif);
        return { data: baris, total: baris.length, purwarupa: true };
      }
      const j = await API.get("/api/checklist/templat" + qs(tapis));
      return { data: j.data, total: (j.meta && j.meta.total) || j.data.length };
    },

    async lihatTemplat(id) {
      if (!langsungKeApi()) {
        const t = (window.DB ? DB.checklistTemplates : []).find((x) => String(x.id) === String(id));
        return t ? templatCkDariPurwarupa(t) : null;
      }
      return (await API.get("/api/checklist/templat/" + encodeURIComponent(id))).data;
    },

    buatTemplat(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Membuat templat checklist");
      return API.post("/api/checklist/templat", isi).then((j) => j.data);
    },

    tugaskan(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menugaskan checklist");
      return API.post("/api/checklist/penugasan", isi).then((j) => j.data);
    },

    async tugasSaya(tapis) {
      if (!langsungKeApi()) {
        const saya = penggunaContohSaatIni();
        const baris = (window.DB && saya ? DB.checklistTasks : [])
          .filter((t) => t.assignee === (saya ? saya.id : null))
          .map((t) => {
            const tpl = window.DB ? DB.checklistTemplates.find((x) => x.id === t.tpl) : null;
            return {
              id: t.id,
              periode: { kode: "bulanan", nama: "Bulanan" },
              aktif: true,
              templat: tpl ? { id: tpl.id, nama: tpl.name, jenis: (JENIS_CK_PURWARUPA[tpl.type] || [, tpl.type])[1] } : null,
              sumber_daya: sumberDayaDariIdPurwarupa(t.res),
              penanggung_jawab: saya ? { id: saya.id, nama: saya.name } : null
            };
          });
        return { data: baris, total: baris.length, purwarupa: true };
      }
      const j = await API.get("/api/checklist/tugas-saya" + qs(tapis));
      return { data: j.data, total: (j.meta && j.meta.total) || j.data.length };
    },

    async pelaksanaan(tapis) {
      if (!langsungKeApi()) {
        const saya = penggunaContohSaatIni();
        let baris = (window.DB ? DB.checklistRecords : []).map((r) => {
          const tpl = window.DB ? DB.checklistTemplates.find((x) => x.id === r.tpl) : null;
          const pelaksana = window.DB ? DB.people.find((p) => p.id === r.by) : null;
          const waktu = r.date + "T" + (r.time || "00:00") + ":00";
          return {
            id: r.id,
            status: { kode: "selesai", nama: "Selesai" },
            dimulai_pada: waktu, selesai_pada: waktu,
            hasil: { butir_total: (r.ok || 0) + (r.fail || 0), butir_lulus: r.ok || 0, skor: r.score },
            templat: tpl ? { id: tpl.id, nama: tpl.name, jenis: (JENIS_CK_PURWARUPA[tpl.type] || [, tpl.type])[1], butir: [] } : null,
            sumber_daya: sumberDayaDariIdPurwarupa(r.res),
            pelaksana: pelaksana ? { id: pelaksana.id, nama: pelaksana.name } : null,
            jawaban: [], catatan: r.note || null
          };
        });
        if (tapis && tapis.milik_saya && saya) baris = baris.filter((r) => r.pelaksana && r.pelaksana.id === saya.id);
        if (tapis && tapis.jenis_sumber_daya && tapis.sumber_daya_id) {
          baris = baris.filter((r) => r.sumber_daya
            && r.sumber_daya.jenis === tapis.jenis_sumber_daya
            && String(r.sumber_daya.id) === String(tapis.sumber_daya_id));
        }
        return { data: baris, total: baris.length, purwarupa: true };
      }
      const j = await API.get("/api/checklist/pelaksanaan" + qs(tapis));
      return { data: j.data, total: (j.meta && j.meta.total) || j.data.length };
    },

    async lihatPelaksanaan(id) {
      if (!langsungKeApi()) {
        return (await checklist.pelaksanaan()).data.find((r) => String(r.id) === String(id)) || null;
      }
      return (await API.get("/api/checklist/pelaksanaan/" + encodeURIComponent(id))).data;
    },

    mulai(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Memulai checklist");
      return API.post("/api/checklist/pelaksanaan", isi).then((j) => j.data);
    },

    jawab(runId, itemId, nilai, catatan) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menjawab checklist");
      return API.post("/api/checklist/pelaksanaan/" + encodeURIComponent(runId) + "/jawab", {
        checklist_item_id: itemId, nilai: nilai, catatan: catatan || null
      });
    },

    selesaikan(runId, catatan) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menyelesaikan checklist");
      return API.post("/api/checklist/pelaksanaan/" + encodeURIComponent(runId) + "/selesaikan",
        { catatan: catatan || null }).then((j) => j.data);
    }
  };

  /* ------------------------------------------------------------ dashboard */
  /*
     TIDAK ADA PEMETAAN PURWARUPA DI SINI — sengaja.

     Setiap modul lain di berkas ini memetakan data purwarupa ke bentuk
     server yang sama persis, supaya satu kode tampilan melayani dua sumber.
     Dashboard adalah pengecualian: mesin widget purwarupa (dash.js — SOURCES,
     METRICS, WTYPES, tata letak seret-lepas) sudah berdiri sendiri sejak
     sebelum modul ini tersambung, dan katalog widget server (RegistriWidget,
     13 lalu 41 kunci) tidak pernah dimaksudkan mencakup seluruh puluhan
     sumber data purwarupa yang bebas dikomposisi — itu justru batas keamanan
     yang disengaja (lihat RegistriWidget). Memetakan satu ke bentuk yang lain
     akan memalsukan salah satunya.

     Karena itu Dashboard & BSC bercabang di TINGKAT HALAMAN, bukan di
     tingkat data: `V["dashboard"]`/`V["exec"]`/`V["bsc"]` memilih mesin
     purwarupa (dash.js, tidak berubah) atau mesin tersambung (di bawah ini)
     berdasarkan Repo.dapatMenulis() — bukan menampilkan satu tampilan yang
     diam-diam mengambil data dari dua bentuk berbeda.
  */
  const dashboard = {
    utama() {
      if (!langsungKeApi()) return tolakDiModeContoh("Memuat dashboard");
      return API.get("/api/dashboard/utama").then((j) => j.data);
    },

    daftar() {
      if (!langsungKeApi()) return tolakDiModeContoh("Memuat daftar dashboard");
      return API.get("/api/dashboard");
    },

    lihat(id, denganData) {
      if (!langsungKeApi()) return tolakDiModeContoh("Memuat dashboard");
      return API.get("/api/dashboard/" + encodeURIComponent(id)).then((j) => j.data);
    },

    widgetTersedia() {
      if (!langsungKeApi()) return tolakDiModeContoh("Memuat daftar widget");
      return API.get("/api/dashboard/widget-tersedia").then((j) => j.data);
    },

    buat(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Membuat dashboard");
      return API.post("/api/dashboard", isi).then((j) => j.data);
    },

    simpan(id, isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menyimpan dashboard");
      return API.put("/api/dashboard/" + encodeURIComponent(id), isi).then((j) => j.data);
    },

    hapus(id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menghapus dashboard");
      return API.hapus("/api/dashboard/" + encodeURIComponent(id));
    },

    /**
     * Angka SATU widget lepas dari tata letak dashboard mana pun — dipakai
     * layar Laporan yang butuh angka yang sama persis dengan yang
     * dashboard tampilkan (lihat DashboardController::widgetData()).
     *
     * BEDA dengan fungsi Repo.dashboard lain: fungsi ini PUNYA jalur mode
     * contoh (bukan tolakDiModeContoh()), sengaja tidak mengikuti pola
     * "Dashboard & BSC bercabang di tingkat halaman" pada catatan di atas
     * — pola itu ada karena purwarupa dashboard punya susun-tata-letak
     * seret-lepas yang tidak berpadanan dengan apa pun di server. Layar
     * Laporan yang memanggil fungsi ini tidak punya fitur semacam itu;
     * hanya perlu satu angka, dan mode contoh yang jujur mengembalikan
     * hasil kosong untuk kunci yang belum dipetakan lebih baik daripada
     * melempar.
     */
    async widget(kunci, opsi) {
      if (!langsungKeApi()) return widgetDariPurwarupa(kunci);
      return (await API.get("/api/dashboard/widget" + qs(Object.assign({ kunci: kunci }, opsi || {})))).data;
    }
  };

  /**
   * Padanan purwarupa untuk kunci widget yang DIPAKAI layar Laporan —
   * bukan seluruh katalog RegistriWidget (puluhan kunci), yang purwarupa
   * memang tidak punya cukup data untuk memadaninya semua. Kunci lain
   * mengembalikan penanda kosong yang sama seperti server saat tidak
   * berwenang — jujur bahwa mode contoh tidak memodelkannya, bukan
   * angka karangan.
   */
  function widgetDariPurwarupa(kunci) {
    const D = window.DB;
    if (!D) return { nilai: null, pesan: "Data purwarupa tidak tersedia." };

    if (kunci === "ruangan.utilisasi") {
      const rerata = D.rooms.length ? D.rooms.reduce((a, r) => a + (r.util || 0), 0) / D.rooms.length : null;
      return { nilai: rerata != null ? Math.round(rerata * 10) / 10 : null };
    }
    if (kunci === "ruangan.tren-utilisasi") {
      return { titik: D.analytics.utilTrend.slice(-6).map((t) => ({ label: t.m, nilai: t.room })), satuan: "%" };
    }
    if (kunci === "booking.menunggu") {
      return { nilai: D.bookings.filter((b) => b.status === "Waiting Approval").length };
    }
    if (kunci === "booking.status") {
      const bagian = Object.values(STATUS_BOOKING_PURWARUPA).reduce((acc, [kode, nama]) => {
        acc[kode] = { kode: kode, nama: nama, jumlah: 0 };
        return acc;
      }, {});
      D.bookings.forEach((b) => {
        const st = STATUS_BOOKING_PURWARUPA[b.status];
        if (st && bagian[st[0]]) bagian[st[0]].jumlah++;
      });
      const daftar = Object.values(bagian);
      return { bagian: daftar, nilai: daftar.reduce((a, x) => a + x.jumlah, 0) };
    }
    if (kunci === "peminjaman.aktif") {
      return { nilai: D.eqBookings.filter((p) => p.status === "In Use").length };
    }
    if (kunci === "peminjaman.status") {
      const bagian = Object.values(STATUS_PINJAM_PURWARUPA).reduce((acc, [kode, nama]) => {
        acc[kode] = { kode: kode, nama: nama, jumlah: 0 };
        return acc;
      }, {});
      D.eqBookings.forEach((p) => {
        const st = STATUS_PINJAM_PURWARUPA[p.status];
        if (st && bagian[st[0]]) bagian[st[0]].jumlah++;
      });
      const daftar = Object.values(bagian);
      return { bagian: daftar, nilai: daftar.reduce((a, x) => a + x.jumlah, 0) };
    }
    // calDue hanya ada pada D.equipment (alat lab) — D.assets (aset
    // fasilitas) purwarupa tidak punya kolom kalibrasi sama sekali, sama
    // seperti tidak semua aset sungguhan wajib_kalibrasi di server.
    if (kunci === "kalibrasi.kedaluwarsa") {
      const lewat = D.equipment.filter((e) => e.calDue < D.shift(0));
      return {
        nilai: lewat.length,
        baris: lewat.slice(0, 8).map((e) => ({
          id: e.id, judul: e.name,
          keterangan: "kedaluwarsa " + e.calDue, status: "kedaluwarsa"
        })),
        terpotong: lewat.length > 8
      };
    }
    if (kunci === "aset.kepatuhan-kalibrasi") {
      if (!D.equipment.length) return { nilai: null };
      const patuh = D.equipment.filter((e) => e.calDue >= D.shift(0)).length;
      return { nilai: Math.round((patuh / D.equipment.length) * 1000) / 10 };
    }
    if (kunci === "penyewaan.jumlah-aktif") {
      return { nilai: D.bookings.filter((b) => b.billing === "PAID").length };
    }
    if (kunci === "penyewaan.pendapatan-ytd") {
      return { nilai: D.invoices.reduce((a, i) => a + (i.paid || 0), 0) };
    }
    if (kunci === "penyewaan.tren-pendapatan") {
      return { titik: D.analytics.revenue.slice(-6).map((r) => ({ label: r.m, nilai: r.val * 1000000 })), satuan: "rupiah" };
    }
    if (kunci === "tagihan.piutang") {
      return { nilai: D.invoices.filter((i) => i.status !== "Paid").reduce((a, i) => a + (i.total - i.paid), 0) };
    }
    if (kunci === "tagihan.jatuh-tempo") {
      const lewat = D.invoices.filter((i) => i.status === "Overdue");
      return {
        nilai: lewat.length,
        baris: lewat.slice(0, 8).map((i) => ({
          id: i.id, judul: i.id,
          keterangan: "sisa " + (window.UI ? UI.rp(i.total - i.paid) : i.total - i.paid) + " · tempo " + i.due,
          status: "terbit"
        })),
        terpotong: lewat.length > 8
      };
    }
    if (kunci === "pemeliharaan.biaya-ytd" || kunci === "pemeliharaan.aktif"
        || kunci === "pemeliharaan.jenis" || kunci === "pemeliharaan.terjadwal") {
      const semua = pemeliharaanPurwarupaSemua();
      const tahunIni = new Date(D.shift(0)).getFullYear();

      if (kunci === "pemeliharaan.biaya-ytd") {
        return { nilai: semua.filter((m) => m.status.kode === "selesai" && new Date(m.jadwal).getFullYear() === tahunIni)
          .reduce((a, m) => a + (m.biaya || 0), 0) };
      }
      if (kunci === "pemeliharaan.aktif") {
        return { nilai: semua.filter((m) => m.status.kode === "dijadwalkan" || m.status.kode === "berjalan").length };
      }
      if (kunci === "pemeliharaan.jenis") {
        const bagian = Object.keys(NAMA_JENIS_PML).map((k) => ({ kode: k, nama: NAMA_JENIS_PML[k], jumlah: 0 }));
        semua.forEach((m) => { const b = bagian.find((x) => x.kode === m.jenis.kode); if (b) b.jumlah++; });
        return { bagian: bagian, nilai: bagian.reduce((a, x) => a + x.jumlah, 0) };
      }
      // pemeliharaan.terjadwal — 30 hari ke depan, status masih aktif.
      const batas30 = D.shift(30);
      const akan = semua.filter((m) => (m.status.kode === "dijadwalkan" || m.status.kode === "berjalan")
        && m.jadwal >= D.shift(0) && m.jadwal <= batas30);
      return {
        nilai: akan.length,
        baris: akan.slice(0, 8).map((m) => ({
          id: m.id, judul: m.sumber_daya ? m.sumber_daya.nama : "—",
          keterangan: m.jadwal + " · " + m.jenis.nama, status: m.status.kode
        })),
        terpotong: akan.length > 8
      };
    }
    if (kunci === "pemeliharaan.tren-biaya") {
      return { titik: D.analytics.maintCost.slice(-6).map((r) => ({ label: r.m, nilai: r.val * 1000000 })), satuan: "rupiah" };
    }

    return { nilai: null, pesan: "Belum dipetakan di mode contoh." };
  }

  /* ------------------------------------------------------------------ bsc */
  const bsc = {
    kartu(periode) {
      if (!langsungKeApi()) return tolakDiModeContoh("Memuat kartu skor");
      return API.get("/api/bsc" + qs({ periode: periode })).then((j) => j.data);
    },

    kerangka() {
      if (!langsungKeApi()) return tolakDiModeContoh("Memuat kerangka BSC");
      return API.get("/api/bsc/kerangka").then((j) => j.data);
    },

    tren() {
      if (!langsungKeApi()) return tolakDiModeContoh("Memuat tren BSC");
      return API.get("/api/bsc/tren").then((j) => j.data);
    },

    simpanPerspektif(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menyimpan perspektif BSC");
      return API.put("/api/bsc/perspektif", isi).then((j) => j.data);
    },

    hapusPeriode(periode) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menghapus periode BSC");
      return API.hapus("/api/bsc/periode" + qs({ periode: periode }));
    },

    isiRealisasi(indikatorId, realisasi, catatan) {
      if (!langsungKeApi()) return tolakDiModeContoh("Mengisi realisasi");
      return API.patch("/api/bsc/indikator/" + encodeURIComponent(indikatorId) + "/realisasi",
        { realisasi: realisasi, catatan: catatan || null }).then((j) => j.data);
    }
  };

  /* ------------------------------------------------------- penyewaan & tagihan */
  /*
     Enam layar purwarupa (Permohonan Sewa, Daftar Tarif, Paket Layanan,
     Quotation, Invoice, Pembayaran) dipetakan ke lima sumber server: tarif
     (satu tabel untuk tarif/add-on/paket — lihat migrasi 2026_08_22_100000),
     penyewaan, penawaran (quotation), tagihan (invoice), dan pembayaran.

     PENYEDERHANAAN YANG DISENGAJA: purwarupa memberi tiap fasilitas EMPAT
     angka harga sekaligus (internal, eksternal, setengah-hari, lembur) dalam
     satu baris. Server menyimpan tarif sebagai baris terpisah per kombinasi
     (fasilitas, segmen, satuan waktu) — lebih fleksibel untuk segmen apa pun,
     tetapi tidak punya satuan "setengah-hari"/"lembur" tersendiri. Halaman
     tersambung karenanya menampilkan tarif apa adanya dari server (nama,
     jenis, fasilitas, satuan, segmen, harga), bukan mereka-reka ulang empat
     kolom purwarupa yang tidak berpadanan.
  */

  const JENIS_TARIF_NAMA = { tarif: "Tarif fasilitas", addon: "Add-on", paket: "Paket layanan" };
  const STATUS_PENAWARAN_DARI_PURWARUPA = {
    Terkirim: "terkirim", Negosiasi: "negosiasi", Disetujui: "disetujui", Kadaluarsa: "terkirim", Ditolak: "ditolak"
  };
  const NAMA_STATUS_PENAWARAN = { terkirim: "Terkirim", negosiasi: "Negosiasi", disetujui: "Disetujui", ditolak: "Ditolak" };
  const STATUS_RENTAL_NAMA = {
    draf: "Draf", dikonfirmasi: "Dikonfirmasi", berjalan: "Berjalan", selesai: "Selesai", dibatalkan: "Dibatalkan"
  };
  const STATUS_INVOICE_DARI_PURWARUPA = {
    "Waiting Payment": "terbit", Paid: "lunas", Overdue: "terbit", Draft: "terbit"
  };
  const NAMA_STATUS_INVOICE = { terbit: "Terbit", sebagian: "Dibayar sebagian", lunas: "Lunas", dibatalkan: "Dibatalkan" };
  const STATUS_PEMBAYARAN_DARI_PURWARUPA = { Terverifikasi: "terverifikasi", "Menunggu Verifikasi": "menunggu_verifikasi" };
  const NAMA_STATUS_PEMBAYARAN = { terverifikasi: "Terverifikasi", menunggu_verifikasi: "Menunggu verifikasi" };

  function tarifDariPurwarupa(p, jenis) {
    if (jenis === "paket") {
      return {
        id: p.id, nama: p.name, jenis: { kode: "paket", nama: JENIS_TARIF_NAMA.paket },
        sumber_daya: null, satuan_waktu: { kode: "paket", nama: "Per paket" },
        harga: p.price, segmen: { kode: "umum", nama: "Umum" },
        deskripsi: p.incl, kapasitas: p.cap || null, aktif: p.active
      };
    }
    if (jenis === "addon") {
      return {
        id: p.id, nama: p.name, jenis: { kode: "addon", nama: JENIS_TARIF_NAMA.addon },
        sumber_daya: null, satuan_waktu: { kode: "paket", nama: p.unit },
        harga: p.price, segmen: { kode: "umum", nama: "Umum" },
        deskripsi: null, kapasitas: null, aktif: true
      };
    }
    return {
      id: p.id, nama: p.resName, jenis: { kode: "tarif", nama: JENIS_TARIF_NAMA.tarif },
      sumber_daya: { jenis: /^RM|^LAB/.test(p.res) ? (/^LAB/.test(p.res) ? "laboratorium" : "ruangan") : "ruangan", id: p.res, nama: p.resName },
      satuan_waktu: { kode: /jam/i.test(p.unitType) ? "jam" : "hari", nama: p.unitType },
      harga: p.external, segmen: { kode: "umum", nama: "Umum" },
      deskripsi: null, kapasitas: null, aktif: p.active
    };
  }

  function penawaranDariPurwarupa(q) {
    const status = STATUS_PENAWARAN_DARI_PURWARUPA[q.status] || "terkirim";
    const hariIni = window.DB ? DB.shift(0) : q.valid;
    return {
      id: q.id, nomor: q.id,
      tanggal: q.date, berlaku_sampai: q.valid,
      kedaluwarsa: (status === "terkirim" || status === "negosiasi") && q.valid < hariIni,
      status: { kode: status, nama: NAMA_STATUS_PENAWARAN[status] },
      nilai: { subtotal: q.amount, ppn_persen: 0, ppn: 0, total: q.amount },
      dapat_diterbitkan_invoice: status === "disetujui",
      invoice_nomor: null,
      baris: [{ deskripsi: "Sewa fasilitas", kuantitas: 1, satuan: "paket", harga_satuan: q.amount, subtotal: q.amount }],
      penyewaan: { id: q.ref, penyewa: q.client, instansi: q.client },
      catatan: null
    };
  }

  function invoiceDariPurwarupa(i) {
    const status = STATUS_INVOICE_DARI_PURWARUPA[i.status] || "terbit";
    return {
      id: i.id, nomor: i.id,
      tanggal: i.date, jatuh_tempo: i.due,
      terlewat_jatuh_tempo: i.status === "Overdue",
      status: { kode: status, nama: NAMA_STATUS_INVOICE[status] },
      nilai: { subtotal: i.sub, ppn_persen: 11, ppn: i.tax, total: i.total, terbayar: i.paid, sisa: i.total - i.paid },
      baris: [{ deskripsi: "Sewa fasilitas", kuantitas: 1, satuan: "paket", harga_satuan: i.sub, subtotal: i.sub }],
      pembayaran: [],
      penyewaan: { id: i.ref, penyewa: i.client, instansi: i.client },
      quotation_nomor: null,
      catatan: null
    };
  }

  function pembayaranDariPurwarupa(p) {
    const status = STATUS_PEMBAYARAN_DARI_PURWARUPA[p.status] || "terverifikasi";
    return {
      id: p.id, tanggal: p.date, jumlah: p.amount,
      metode: /transfer/i.test(p.method) ? "transfer" : /virtual/i.test(p.method) ? "transfer" : "tunai",
      status: { kode: status, nama: NAMA_STATUS_PEMBAYARAN[status] },
      referensi: p.method, catatan: null,
      invoice: { id: p.inv, nomor: p.inv, penyewa: p.client }
    };
  }

  const tarif = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        const jenis = (tapis && tapis.jenis) || "tarif";
        const sumber = jenis === "paket" ? (window.DB ? DB.packages : [])
          : jenis === "addon" ? (window.DB ? DB.addons : [])
          : (window.DB ? DB.priceList : []);
        return { data: sumber.map((p) => tarifDariPurwarupa(p, jenis)) };
      }
      return API.get("/api/tarif" + qs(tapis));
    },

    simpan(isi, id) {
      if (!langsungKeApi()) return tolakDiModeContoh(id ? "Mengubah tarif" : "Menambah tarif");
      return id
        ? API.put("/api/tarif/" + encodeURIComponent(id), isi).then((j) => j.data)
        : API.post("/api/tarif", isi).then((j) => j.data);
    }
  };

  const penyewaan = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.bookings : []).filter((b) => b.billing === "PAID").map((b) => ({
          id: b.id, penyewa: b.agenda, instansi: b.unit,
          mulai: b.date + "T" + b.start + ":00", selesai: b.date + "T" + b.end + ":00",
          status: { kode: "dikonfirmasi", nama: STATUS_RENTAL_NAMA.dikonfirmasi },
          ruangan: { id: b.res, nama: b.resName }, laboratorium: null
        }));
        return { data: { data: baris } };
      }
      return API.get("/api/penyewaan" + qs(tapis));
    },

    buat(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Mengajukan permohonan sewa");
      return API.post("/api/penyewaan", isi).then((j) => j.data);
    },

    terbitkanTagihan(id, isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menerbitkan tagihan");
      return API.post("/api/penyewaan/" + encodeURIComponent(id) + "/tagihan", isi || {}).then((j) => j.data);
    }
  };

  const penawaran = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.quotations : []).map(penawaranDariPurwarupa);
        if (tapis && tapis.status) baris = baris.filter((q) => q.status.kode === tapis.status);
        return { data: baris };
      }
      return API.get("/api/penawaran" + qs(tapis));
    },

    async lihat(id) {
      if (!langsungKeApi()) {
        return (window.DB ? DB.quotations : []).map(penawaranDariPurwarupa).find((q) => String(q.id) === String(id)) || null;
      }
      return API.get("/api/penawaran/" + encodeURIComponent(id)).then((j) => j.data);
    },

    buat(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Membuat penawaran");
      return API.post("/api/penawaran", isi).then((j) => j.data);
    },

    putuskan(id, keputusan) {
      if (!langsungKeApi()) return tolakDiModeContoh("Memutuskan penawaran");
      return API.post("/api/penawaran/" + encodeURIComponent(id) + "/putuskan", { keputusan: keputusan }).then((j) => j.data);
    },

    terbitkanInvoice(id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menerbitkan invoice");
      return API.post("/api/penawaran/" + encodeURIComponent(id) + "/tagihan").then((j) => j.data);
    }
  };

  const tagihan = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.invoices : []).map(invoiceDariPurwarupa);
        if (tapis && tapis.status) baris = baris.filter((i) => i.status.kode === tapis.status);
        return { data: baris };
      }
      return API.get("/api/tagihan" + qs(tapis));
    },

    async lihat(id) {
      if (!langsungKeApi()) {
        return (window.DB ? DB.invoices : []).map(invoiceDariPurwarupa).find((i) => String(i.id) === String(id)) || null;
      }
      return API.get("/api/tagihan/" + encodeURIComponent(id)).then((j) => j.data);
    },

    catatPembayaran(id, isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Mencatat pembayaran");
      return API.post("/api/tagihan/" + encodeURIComponent(id) + "/pembayaran", isi).then((j) => j.data);
    }
  };

  const pembayaran = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.payments : []).map(pembayaranDariPurwarupa);
        if (tapis && tapis.status) baris = baris.filter((p) => p.status.kode === tapis.status);
        return { data: baris };
      }
      return API.get("/api/pembayaran" + qs(tapis));
    },

    verifikasi(id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Memverifikasi pembayaran");
      return API.post("/api/pembayaran/" + encodeURIComponent(id) + "/verifikasi").then((j) => j.data);
    }
  };

  /* ------------------------------------------------------------------ audit */
  /*
     Hanya baca — tidak ada tindakan tulis di modul ini, dan sengaja begitu:
     basis data sendiri menolak UPDATE/DELETE pada audit_logs lewat pemicu.

     Jejak audit sungguhan HANYA mencatat perubahan kolom model (dibuat/
     diubah/dihapus/dipulihkan) — tidak ada peristiwa LOGIN, APPROVE
     tersendiri, atau NOTIFY seperti pada purwarupa, karena menyetujui
     pengajuan atau login pengguna tidak selalu mengubah kolom model yang
     diaudit. Purwarupa punya kategori aktivitas yang lebih kaya (act:
     CREATE/UPDATE/DELETE/APPROVE/LOGIN/NOTIFY/CHECKIN) — dipetakan ke tiga
     peristiwa yang server benar-benar simpan, bukan dipangkas: APPROVE/
     LOGIN/NOTIFY/CHECKIN dipetakan sebagai "diubah" dengan satu baris nilai
     ringkas, karena itulah makna aslinya (suatu keadaan berubah).
  */

  const PERISTIWA_AUDIT_DARI_PURWARUPA = {
    CREATE: "dibuat", UPDATE: "diubah", DELETE: "dihapus",
    APPROVE: "diubah", LOGIN: "diubah", NOTIFY: "diubah", CHECKIN: "diubah"
  };
  const NAMA_PERISTIWA_AUDIT = { dibuat: "Dibuat", diubah: "Diubah", dihapus: "Dihapus", dipulihkan: "Dipulihkan" };

  function auditDariPurwarupa(a, i) {
    const peristiwa = PERISTIWA_AUDIT_DARI_PURWARUPA[a.act] || "diubah";
    const nama = window.DB ? DB.personName(a.user) : a.user;
    const hariIni = window.DB ? DB.shift(0) : "2026-01-01";

    return {
      id: i + 1,
      peristiwa: { kode: peristiwa, nama: NAMA_PERISTIWA_AUDIT[peristiwa] },
      objek: { model: a.obj.split(" ")[0], id: null, label: a.obj },
      pelaku: { id: a.user === "SYSTEM" ? null : a.user, nama: a.user === "SYSTEM" ? "Sistem" : nama },
      sebelum: peristiwa === "dibuat" ? null : { nilai: a.before },
      sesudah: peristiwa === "dihapus" ? null : { nilai: a.after },
      ip: a.ip,
      rute: a.dev,
      waktu: hariIni + "T" + a.time
    };
  }

  const audit = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.audit : []).map(auditDariPurwarupa);
        if (tapis && tapis.peristiwa) baris = baris.filter((a) => a.peristiwa.kode === tapis.peristiwa);
        return { data: baris, meta: { total: baris.length } };
      }
      const j = await API.get("/api/audit" + qs(tapis));
      return { data: j.data, meta: j.meta };
    }
  };

  /* ---------------------------------------------------- manajemen pengguna */
  /*
     Beda dari Repo.pengguna (pemilih untuk formulir lain — nama & unit kerja
     saja): modul ini adalah CRUD penuh + matriks peran, dan pada server
     dijaga izin `pengguna.*` yang saat ini HANYA dimiliki super-admin. Lihat
     docblock MatriksAkses::MODUL untuk alasannya.

     PIC, Teknisi & Operator, Pengunjung, dan Struktur Organisasi pada
     purwarupa SENGAJA TIDAK disambungkan pada modul ini. Semuanya butuh
     domain server baru yang belum ada sama sekali (delegasi PIC dengan SLA,
     workload teknisi, manajemen kunjungan tamu, bagan organisasi) — bukan
     sekadar menyambungkan yang sudah ada, dan tidak proporsional untuk
     digabung dengan Manajemen Pengguna & Peran. Dijatuhkan dengan sengaja,
     dicatat di sini dan di docs/BACKEND.md, bukan dipangkas diam-diam.
  */

  const PERAN_DARI_NAMA_PURWARUPA = {
    "Super Admin": "super-admin", "Facility Manager": "facility-manager",
    "Laboratory Manager": "lab-manager", "Lab Technician": "lab-technician", "Technician": "lab-technician",
    "Asset Manager": "asset-manager", "Room Administrator": "room-administrator",
    "Event Manager": "event-manager", "Finance": "finance", "PIC": "pic",
    "Employee": "employee", "External User": "external-user", "Management": "management"
  };
  const NAMA_PERAN_SERVER = {
    "super-admin": "Super Admin", "facility-manager": "Facility Manager", "lab-manager": "Laboratory Manager",
    "asset-manager": "Asset Manager", "finance": "Finance", "employee": "Employee / User",
    "lab-technician": "Lab Technician", "room-administrator": "Room Administrator",
    "event-manager": "Event Manager", "pic": "PIC / Penanggung Jawab",
    "external-user": "External User", "management": "Management"
  };

  function penggunaAdminDariPurwarupa(p) {
    return {
      id: p.id, nama: p.name, email: p.email, unit_kerja: p.unit,
      aktif: p.status !== "Nonaktif",
      peran: [PERAN_DARI_NAMA_PURWARUPA[p.role] || "employee"],
      gedung: [], dibuat_pada: null
    };
  }

  const penggunaKelola = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.people : []).map(penggunaAdminDariPurwarupa);
        if (tapis && tapis.cari) {
          const k = tapis.cari.toLowerCase();
          baris = baris.filter((p) => p.nama.toLowerCase().indexOf(k) !== -1 || p.email.toLowerCase().indexOf(k) !== -1);
        }
        if (tapis && tapis.peran) baris = baris.filter((p) => p.peran.indexOf(tapis.peran) !== -1);
        if (tapis && tapis.aktif !== undefined && tapis.aktif !== "") {
          const inginAktif = tapis.aktif === "1" || tapis.aktif === true;
          baris = baris.filter((p) => p.aktif === inginAktif);
        }
        return { data: baris };
      }
      return API.get("/api/pengguna-kelola" + qs(tapis));
    },

    simpan(isi, id) {
      if (!langsungKeApi()) return tolakDiModeContoh(id ? "Mengubah pengguna" : "Menambah pengguna");
      return id
        ? API.put("/api/pengguna-kelola/" + encodeURIComponent(id), isi).then((j) => j.data)
        : API.post("/api/pengguna-kelola", isi).then((j) => j.data);
    }
  };

  const peran = {
    async daftar() {
      if (!langsungKeApi()) {
        const jumlah = {};
        (window.DB ? DB.roles : []).forEach((r) => {
          const kode = PERAN_DARI_NAMA_PURWARUPA[r.name] || null;
          if (kode) jumlah[kode] = r.users;
        });
        return {
          modul: [
            { kode: "dashboard", nama: "Dashboard" }, { kode: "booking-ruangan", nama: "Booking ruangan" },
            { kode: "booking-alat", nama: "Booking alat" }, { kode: "laboratorium", nama: "Laboratorium" },
            { kode: "aset", nama: "Aset & BMN" }, { kode: "penyewaan", nama: "Penyewaan & penagihan" },
            { kode: "pemeliharaan", nama: "Pemeliharaan" }, { kode: "kalibrasi", nama: "Kalibrasi" },
            { kode: "checklist", nama: "Checklist" }, { kode: "notifikasi", nama: "Notifikasi email" },
            { kode: "master-data", nama: "Master data" }, { kode: "audit", nama: "Audit trail" },
            { kode: "pengguna", nama: "Pengguna & peran" }
          ],
          peran: Object.keys(NAMA_PERAN_SERVER).map((kode) => ({
            kode: kode, nama: NAMA_PERAN_SERVER[kode], jumlah_pengguna: jumlah[kode] || 0,
            perlu_dikonfirmasi: ["lab-technician", "room-administrator", "event-manager", "pic", "external-user", "management"].indexOf(kode) !== -1
          })),
          matriks: null, nama_tingkat: { "-": "—", LIHAT: "Lihat", BUAT: "Buat", UBAH: "Ubah", PENUH: "Penuh" }
        };
      }
      return API.get("/api/peran");
    }
  };

  /* ------------------------------------------------------------- vendor */
  /*
     Sebelumnya "Performa Vendor" pada Laporan Maintenance dijatuhkan
     sepenuhnya karena tidak ada entitas Vendor di server. Modul ini
     mengisinya: CRUD vendor + tautan opsional AssetMaintenance.vendor_id
     (medan bebas `pelaksana` tetap ada untuk pekerjaan tanpa vendor
     terdaftar — lihat docs/BACKEND.md).

     hapus() TIDAK menghapus baris — server menonaktifkan (aktif=false)
     supaya riwayat pekerjaan lama tetap tertaut ke vendor yang benar.
  */

  function vendorDariPurwarupa(v) {
    const m = /Aktif s\/d (\d{4}-\d{2}-\d{2})/.exec(v.contract || "");
    return {
      id: v.id, kode: v.id, nama: v.name, kategori: v.cat,
      pic: { nama: v.pic, telepon: v.phone, email: null },
      rating: v.rating,
      kontrak_berlaku_sampai: m ? m[1] : null,
      aktif: true, catatan: null,
      jumlah_pekerjaan: 0, total_biaya: 0
    };
  }

  const vendor = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.vendors : []).map(vendorDariPurwarupa);
        if (tapis && tapis.cari) {
          const k = tapis.cari.toLowerCase();
          baris = baris.filter((v) => v.nama.toLowerCase().indexOf(k) !== -1 || v.kategori.toLowerCase().indexOf(k) !== -1);
        }
        if (tapis && tapis.kategori) baris = baris.filter((v) => v.kategori === tapis.kategori);
        return { data: baris };
      }
      return API.get("/api/vendors" + qs(tapis));
    },

    simpan(isi, id) {
      if (!langsungKeApi()) return tolakDiModeContoh(id ? "Mengubah vendor" : "Menambah vendor");
      return id
        ? API.put("/api/vendors/" + encodeURIComponent(id), isi).then((j) => j.data)
        : API.post("/api/vendors", isi).then((j) => j.data);
    },

    hapus(id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menonaktifkan vendor");
      return API.hapus("/api/vendors/" + encodeURIComponent(id));
    }
  };

  /* --------------------------------------------------------- audit aset */
  /*
     Stock opname: keberadaan fisik aset dibandingkan catatan Register BMN.
     "Tidak ditemukan" TIDAK disimpan sebagai baris — ia selisih populasi
     dikurangi yang sudah dipindai (lihat AssetAuditService di server).
     Selama sesi masih berjalan, selisih itu ditampilkan sebagai "belum
     diaudit"; begitu sesi ditutup, angka yang SAMA berubah label jadi
     "tidak ditemukan".

     Layar ini menampilkan SATU sesi "berjalan" saat ini (yang terbaru),
     bukan pemilih di antara banyak sesi — pola yang sama dengan Laporan
     Ruangan menampilkan periode berjalan, bukan pemilih periode.
  */

  function auditAsetDariPurwarupa() {
    return {
      id: "demo", nama: "Audit Semester I 2026",
      mulai: D.shift(-30), target_selesai: D.shift(14),
      status: { kode: "berjalan", nama: "Berjalan" },
      selesai_pada: null, pembuat: null, catatan: null,
      ringkasan: {
        total_aset: 1284, sudah_diverifikasi: 1147,
        sesuai: 1118, lokasi_berbeda: 17, kondisi_berbeda: 6,
        belum_diaudit: 137, tidak_ditemukan: 6,
        per_gedung: [
          { gedung: "Gedung A — Riset", persentase: 94 },
          { gedung: "Gedung B — Perkantoran", persentase: 91 },
          { gedung: "Gedung C — Auditorium", persentase: 88 },
          { gedung: "Gedung D — Workshop", persentase: 76 },
          { gedung: "Gudang Pusat", persentase: 82 }
        ]
      },
      temuan: [
        { id: 1, aset: { nama: "Laptop Lenovo ThinkPad T14", kode_internal: "AST-IT-0139" },
          lokasi: { tercatat: "GB-2 / MR-001", ditemukan: "Workshop Servis" },
          temuan: { kode: "lokasi_berbeda", nama: "Lokasi berbeda" }, auditor: { nama: "Siti Nurhaliza" } },
        { id: 2, aset: { nama: "Meja Rapat Modular 16 Seat", kode_internal: "AST-FR-0142" },
          lokasi: { tercatat: "GB-2 / MR-001", ditemukan: "GD-1 / WS-001" },
          temuan: { kode: "lokasi_berbeda", nama: "Lokasi berbeda" }, auditor: { nama: "Siti Nurhaliza" } },
        { id: 3, aset: { nama: "Monitor Dell 24\" (2 unit)", kode_internal: "AST-IT-0094" },
          lokasi: { tercatat: "GA-3 / LAB-006", ditemukan: "GA-3 / LAB-003" },
          temuan: { kode: "lokasi_berbeda", nama: "Lokasi berbeda" }, auditor: { nama: "Bayu Prakoso" } },
        { id: 4, aset: { nama: "AC Presisi 5PK Precision", kode_internal: "AST-HV-0135" },
          lokasi: { tercatat: "GA-3 / LAB-003", ditemukan: "GA-3 / LAB-003" },
          temuan: { kode: "kondisi_berbeda", nama: "Kondisi berbeda" }, auditor: { nama: "Tommy Saputra" } }
      ]
    };
  }

  const auditAset = {
    async daftar() {
      if (!langsungKeApi()) return { data: [auditAsetDariPurwarupa()] };
      return API.get("/api/audit-aset");
    },

    async lihat(id) {
      if (!langsungKeApi()) return auditAsetDariPurwarupa();
      return API.get("/api/audit-aset/" + encodeURIComponent(id)).then((j) => j.data);
    },

    mulai(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Memulai sesi audit");
      return API.post("/api/audit-aset", isi).then((j) => j.data);
    },

    scan(id, isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Mencatat pemindaian");
      return API.post("/api/audit-aset/" + encodeURIComponent(id) + "/scan", isi).then((j) => j.data);
    },

    tutup(id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Menutup sesi audit");
      return API.post("/api/audit-aset/" + encodeURIComponent(id) + "/tutup").then((j) => j.data);
    }
  };

  /* ---------------------------------------------------------- pengunjung */
  /*
     Registrasi tamu + check-in/out oleh staf (bukan kios swalayan/QR
     invitation — lihat docs/BACKEND.md untuk alasan pemangkasan itu).
     Server menyimpan `status` sebagai kolom (bukan murni turunan) supaya
     dapat difilter langsung dengan WHERE, dijaga konsisten oleh CHECK
     constraint + VisitorService — pola yang sama dengan AssetMaintenance
     dan AssetAuditSession.
  */

  const STATUS_PENGUNJUNG_NAMA = { terjadwal: "Terjadwal", di_dalam: "Di Dalam", selesai: "Selesai" };
  const STATUS_PENGUNJUNG_DARI_PURWARUPA = { Terjadwal: "terjadwal", "Di Dalam": "di_dalam", Selesai: "selesai" };

  function pengunjungDariPurwarupa(v) {
    const kode = STATUS_PENGUNJUNG_DARI_PURWARUPA[v.status] || "terjadwal";
    return {
      id: v.id, nama: v.name, instansi: v.org, tujuan: v.purpose,
      host: v.host ? { id: v.host, nama: DB.personName(v.host) } : null,
      ruangan: v.room ? { id: v.room, kode: v.room, nama: DB.resName(v.room) } : null,
      tanggal: v.date,
      masuk_pada: v.in && v.in !== "-" ? v.date + "T" + v.in + ":00" : null,
      keluar_pada: v.out && v.out !== "-" ? v.date + "T" + v.out + ":00" : null,
      badge: v.badge && v.badge !== "-" ? v.badge : null,
      status: { kode: kode, nama: STATUS_PENGUNJUNG_NAMA[kode] },
      catatan: null
    };
  }

  const pengunjung = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.visitors : []).map(pengunjungDariPurwarupa);
        if (tapis && tapis.cari) {
          const k = tapis.cari.toLowerCase();
          baris = baris.filter((v) => v.nama.toLowerCase().indexOf(k) !== -1 || (v.instansi || "").toLowerCase().indexOf(k) !== -1);
        }
        if (tapis && tapis.status) baris = baris.filter((v) => v.status.kode === tapis.status);
        if (tapis && tapis.tanggal) baris = baris.filter((v) => v.tanggal === tapis.tanggal);
        return { data: baris };
      }
      return API.get("/api/pengunjung" + qs(tapis));
    },

    daftarkan(isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Mendaftarkan tamu");
      return API.post("/api/pengunjung", isi).then((j) => j.data);
    },

    checkIn(id, isi) {
      if (!langsungKeApi()) return tolakDiModeContoh("Check-in tamu");
      return API.post("/api/pengunjung/" + encodeURIComponent(id) + "/checkin", isi || {}).then((j) => j.data);
    },

    checkOut(id) {
      if (!langsungKeApi()) return tolakDiModeContoh("Check-out tamu");
      return API.post("/api/pengunjung/" + encodeURIComponent(id) + "/checkout").then((j) => j.data);
    }
  };

  /* -------------------------------------------------------------- acara */
  /*
     "Manajemen Event": sebuah event adalah booking ruangan yang lebih
     kaya (organizer, PIC, jumlah peserta, anggaran perencanaan) — bukan
     ditagihkan lewat Tariff/Invoice (lihat docblock migrasi `events`).
     Rundown, distribusi QR undangan, dan progres persiapan purwarupa
     sengaja tidak ada di sini — lihat docs/BACKEND.md.
  */

  const STATUS_ACARA_NAMA = { direncanakan: "Direncanakan", terkonfirmasi: "Terkonfirmasi", berlangsung: "Sedang berlangsung", selesai: "Selesai", dibatalkan: "Dibatalkan" };
  // Purwarupa punya status finansial ("Quotation", "Menunggu Pembayaran")
  // yang tidak dimodelkan di sini — keduanya dipetakan ke "direncanakan"
  // (belum dikonfirmasi), bukan diberi status baru yang tidak ditegakkan
  // di mana pun di server.
  const STATUS_ACARA_DARI_PURWARUPA = {
    Persiapan: "direncanakan", Quotation: "direncanakan", "Menunggu Pembayaran": "direncanakan",
    Terkonfirmasi: "terkonfirmasi", Selesai: "selesai"
  };

  function acaraDariPurwarupa(e) {
    const kode = STATUS_ACARA_DARI_PURWARUPA[e.status] || "direncanakan";
    return {
      id: e.id, nama: e.name, jenis: e.type, organizer: e.organizer,
      pic: e.pic ? { id: e.pic, nama: DB.personName(e.pic) } : null,
      ruangan: e.venue ? { id: e.venue, kode: e.venue, nama: DB.resName(e.venue) } : null,
      tanggal: e.date, jumlah_peserta: e.people, anggaran: e.budget,
      status: { kode: kode, nama: STATUS_ACARA_NAMA[kode] },
      catatan: null
    };
  }

  const acara = {
    async daftar(tapis) {
      if (!langsungKeApi()) {
        let baris = (window.DB ? DB.events : []).map(acaraDariPurwarupa);
        if (tapis && tapis.cari) {
          const k = tapis.cari.toLowerCase();
          baris = baris.filter((e) => e.nama.toLowerCase().indexOf(k) !== -1 || (e.organizer || "").toLowerCase().indexOf(k) !== -1);
        }
        if (tapis && tapis.status) baris = baris.filter((e) => e.status.kode === tapis.status);
        if (tapis && tapis.jenis) baris = baris.filter((e) => e.jenis === tapis.jenis);
        return { data: baris };
      }
      return API.get("/api/acara" + qs(tapis));
    },

    simpan(isi, id) {
      if (!langsungKeApi()) return tolakDiModeContoh(id ? "Mengubah event" : "Membuat event");
      return id
        ? API.put("/api/acara/" + encodeURIComponent(id), isi).then((j) => j.data)
        : API.post("/api/acara", isi).then((j) => j.data);
    },

    /*
       Peserta Event: sub-resource `acara` — bukan modul terpisah. Tidak
       ada `D.participants` di purwarupa sama sekali (V["participant"]
       lama mengarang barisnya dari D.people+D.visitors dan KPI-nya
       hardcode, sama sekali tidak saling berkaitan) — jadi mode contoh
       di sini adalah data demo tulisan tangan, pola yang sama dengan
       auditAsetDariPurwarupa(), bukan pemetaan dari purwarupa yang ada.
    */
    peserta: {
      async daftar(acaraId, tapis) {
        if (!langsungKeApi()) {
          let baris = [
            { id: "demo-1", nama: "Siti Nurhaliza", instansi: "Divisi Pemasaran", email: "siti@internal.co.id", telepon: "0812-1122-330", status: { kode: "hadir", nama: "Hadir" }, hadir_pada: DB.shift(0) + "T08:12:00", catatan: null },
            { id: "demo-2", nama: "Bayu Prakoso", instansi: "PT Anugerah Sejahtera", email: "bayu@anugerah.co.id", telepon: "0813-2233-441", status: { kode: "terdaftar", nama: "Terdaftar" }, hadir_pada: null, catatan: null },
            { id: "demo-3", nama: "Tommy Saputra", instansi: "Universitas Teknologi Bangsa", email: "tommy@utb.ac.id", telepon: "0814-3344-552", status: { kode: "tidak_hadir", nama: "Tidak hadir" }, hadir_pada: null, catatan: null }
          ];
          if (tapis && tapis.cari) {
            const k = tapis.cari.toLowerCase();
            baris = baris.filter((p) => p.nama.toLowerCase().indexOf(k) !== -1 || (p.instansi || "").toLowerCase().indexOf(k) !== -1);
          }
          if (tapis && tapis.status) baris = baris.filter((p) => p.status.kode === tapis.status);
          return { data: baris };
        }
        return API.get("/api/acara/" + encodeURIComponent(acaraId) + "/peserta" + qs(tapis));
      },

      daftarkan(acaraId, isi) {
        if (!langsungKeApi()) return tolakDiModeContoh("Mendaftarkan peserta");
        return API.post("/api/acara/" + encodeURIComponent(acaraId) + "/peserta", isi).then((j) => j.data);
      },

      tandaiHadir(id) {
        if (!langsungKeApi()) return tolakDiModeContoh("Menandai hadir");
        return API.post("/api/peserta-event/" + encodeURIComponent(id) + "/hadir").then((j) => j.data);
      },

      tandaiTidakHadir(id) {
        if (!langsungKeApi()) return tolakDiModeContoh("Menandai tidak hadir");
        return API.post("/api/peserta-event/" + encodeURIComponent(id) + "/tidak-hadir").then((j) => j.data);
      }
    }
  };

  window.Repo = {
    ruangan: ruangan,
    vendor: vendor,
    auditAset: auditAset,
    pengunjung: pengunjung,
    acara: acara,
    checklist: checklist,
    dashboard: dashboard,
    bsc: bsc,
    pemeliharaan: pemeliharaan,
    peminjaman: peminjaman,
    persetujuan: persetujuan,
    booking: booking,
    aset: aset,
    laboratorium: laboratorium,
    pengguna: pengguna,
    tarif: tarif,
    penyewaan: penyewaan,
    penawaran: penawaran,
    tagihan: tagihan,
    pembayaran: pembayaran,
    audit: audit,
    penggunaKelola: penggunaKelola,
    peran: peran,
    NAMA_SKEMA: NAMA_SKEMA,
    NAMA_PERAN: NAMA_PERAN_SERVER,

    /** Apakah tindakan tulis tersedia saat ini. */
    dapatMenulis: langsungKeApi,

    /**
     * Menampilkan galat kepada pengguna dengan cara yang seragam.
     *
     * Galat validasi 422 dibedakan: pesannya menyebut medan mana yang salah,
     * dan itulah satu-satunya galat yang benar-benar dapat ditindaklanjuti
     * pengguna sendiri.
     */
    tampilkanGalat(e, judul) {
      const U = window.UI;
      if (!U) return;

      if (e && e.status === 422 && e.perMedan) {
        const rincian = Object.keys(e.perMedan)
          .map((k) => e.perMedan[k].join(" "))
          .join(" ");
        U.toast(judul || "Isian belum benar", rincian || e.message);
        return;
      }

      U.toast(judul || "Gagal", (e && e.message) || "Terjadi galat.");
    }
  };
})();
