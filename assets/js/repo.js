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

  window.Repo = {
    ruangan: ruangan,
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
