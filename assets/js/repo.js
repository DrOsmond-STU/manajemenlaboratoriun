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
      penyusutan: {
        nilai_perolehan: b.nilaiPerolehan || 0,
        masa_manfaat: b.masaManfaat || 0,
        akumulasi_penyusutan: b.akumPenyusutan || 0,
        nilai_buku: b.nilaiBuku || 0,
        habis_masa_manfaat: (b.nilaiBuku || 0) <= 0
      },
      kondisi: { kode: b.kondisi || "B", nama: KOND_NAMA[b.kondisi] || "Baik" },
      status_penggunaan: b.statusPenggunaan || null,
      psp: { nomor: b.noPsp || null, tanggal: b.tglPsp || null },
      wajib_kalibrasi: !!x.calDue,
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

        return {
          jumlah: baris.length,
          nilai_perolehan: total("nilai_perolehan"),
          akumulasi_penyusutan: total("akumulasi_penyusutan"),
          nilai_buku: total("nilai_buku"),
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

  window.Repo = {
    ruangan: ruangan,
    checklist: checklist,
    peminjaman: peminjaman,
    persetujuan: persetujuan,
    booking: booking,
    aset: aset,
    laboratorium: laboratorium,
    pengguna: pengguna,
    NAMA_SKEMA: NAMA_SKEMA,

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
