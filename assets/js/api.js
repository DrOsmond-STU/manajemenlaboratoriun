/* ==========================================================================
   FLMS — Penghubung ke API

   TIGA SIFAT YANG MENENTUKAN BERKAS INI

   1. Tidak pernah diam-diam kembali ke data contoh.
      Purwarupa ini berisi data contoh yang tampak meyakinkan: nama alat yang
      masuk akal, angka rupiah yang wajar, jadwal yang rapi. Bila API tidak
      terjangkau lalu antarmuka diam-diam menampilkan data itu, yang terjadi
      bukan "aplikasi tetap jalan" melainkan seseorang mengambil keputusan di
      atas angka karangan tanpa pernah tahu. Karena itu mode data contoh
      SELALU disertai spanduk yang tidak bisa ditutup.

   2. Kewenangan datang dari server, bukan dari sini.
      Menu yang disaring menurut izin hanyalah kesopanan antarmuka —
      menyembunyikan tombol tidak menghalangi siapa pun memanggil endpoint-nya
      langsung. Penjaganya tetap Policy dan middleware di sisi server.

   3. Cookie, bukan token di localStorage.
      Sanctum memakai cookie HttpOnly, yang tidak dapat dibaca skrip apa pun —
      termasuk skrip yang berhasil disusupkan ke halaman ini. Token yang
      disimpan di localStorage dapat dibaca dan dibawa kabur seketika oleh XSS.
      Konsekuensinya: setiap permintaan harus membawa kredensial dan token
      CSRF, dan itulah yang diurus berkas ini.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------- alamat */

  /**
   * Alamat API ditentukan dari alamat halaman, bukan ditulis mati.
   *
   * Salah satu cara paling mudah membuat purwarupa produksi menunjuk basis
   * data pengembangan adalah menuliskan alamatnya di kode lalu lupa
   * menggantinya saat menerapkan.
   */
  function tentukanBasis() {
    const paksa = localStorage.getItem("flms.api");
    if (paksa) return paksa.replace(/\/+$/, "");

    const h = location.hostname;

    if (h === "lab.semestateknologiutama.com") {
      return "https://api.lab.semestateknologiutama.com";
    }

    // Dijalankan dari berkas lokal atau http-server: purwarupa dibuka sebagai
    // peragaan statis jauh lebih sering daripada dijalankan melawan API
    // sungguhan. Menebak "http://localhost:8000" di sini berarti setiap
    // pembukaan halaman mengirim permintaan yang hampir pasti ditolak,
    // meninggalkan galat merah di konsol untuk keadaan yang justru normal.
    //
    // Menjalankannya melawan API lokal cukup sekali di konsol peramban:
    //   localStorage.setItem('flms.api', 'http://localhost:8000')
    if (h === "localhost" || h === "127.0.0.1" || h === "" ) {
      return null;
    }

    // Host lain: coba subdomain api. di depan. Bila salah, pemeriksaan
    // ketersambungan di bawah akan menemukannya dan berpindah ke mode data
    // contoh — dengan spanduk, bukan diam-diam.
    return location.protocol + "//api." + h;
  }

  const BASIS = tentukanBasis();

  /* --------------------------------------------------------------- galat */

  class GalatApi extends Error {
    constructor(status, pesan, galatValidasi) {
      super(pesan);
      this.name = "GalatApi";
      this.status = status;
      this.validasi = galatValidasi || null;
    }

    /** Galat validasi 422, dipetakan per nama medan. */
    get perMedan() {
      return this.validasi || {};
    }
  }

  /* ---------------------------------------------------------------- csrf */

  function bacaKuki(nama) {
    const cocok = document.cookie.match(
      new RegExp("(^|;\\s*)" + nama + "=([^;]*)")
    );
    return cocok ? decodeURIComponent(cocok[2]) : null;
  }

  let csrfSedangDiambil = null;

  /**
   * Mengambil kuki XSRF-TOKEN bila belum ada.
   *
   * Dikunci pada satu janji bersama: memuat dashboard menembakkan belasan
   * permintaan sekaligus, dan tanpa penguncian ini semuanya akan berlomba
   * mengambil token yang sama, saling menimpa, lalu sebagian gagal 419 —
   * kegagalan yang tampak acak dan sangat sulit ditelusuri.
   */
  function pastikanCsrf() {
    if (bacaKuki("XSRF-TOKEN")) return Promise.resolve();

    if (!csrfSedangDiambil) {
      csrfSedangDiambil = fetch(BASIS + "/sanctum/csrf-cookie", {
        credentials: "include",
        headers: { Accept: "application/json" }
      }).finally(() => {
        csrfSedangDiambil = null;
      });
    }

    return csrfSedangDiambil;
  }

  /* ------------------------------------------------------------ pemanggil */

  async function panggil(metode, jalur, isi, opsi) {
    opsi = opsi || {};

    const perluCsrf = metode !== "GET" && metode !== "HEAD";
    if (perluCsrf) await pastikanCsrf();

    const tajuk = {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest"
    };

    if (perluCsrf) {
      const token = bacaKuki("XSRF-TOKEN");
      if (token) tajuk["X-XSRF-TOKEN"] = token;
      if (isi !== undefined) tajuk["Content-Type"] = "application/json";
    }

    let jawaban;
    try {
      jawaban = await fetch(BASIS + jalur, {
        method: metode,
        // Tanpa ini cookie sesi tidak ikut terkirim antar subdomain, dan
        // setiap permintaan setelah masuk mengembalikan 401 seolah sandinya
        // salah.
        credentials: "include",
        headers: tajuk,
        body: isi === undefined ? undefined : JSON.stringify(isi)
      });
    } catch (e) {
      // Jaringan putus, DNS gagal, CORS ditolak — semuanya sampai di sini
      // sebagai TypeError tanpa keterangan, karena peramban sengaja tidak
      // membocorkan sebabnya kepada skrip.
      throw new GalatApi(0, "Server tidak terjangkau. Periksa sambungan jaringan.");
    }

    if (jawaban.status === 204) return null;

    let data = null;
    const jenis = jawaban.headers.get("Content-Type") || "";
    if (jenis.indexOf("application/json") !== -1) {
      data = await jawaban.json().catch(() => null);
    }

    if (jawaban.ok) return data;

    if (jawaban.status === 401) {
      // Bukan sekadar galat: sesinya memang sudah tidak ada. Ditandai supaya
      // shell aplikasi dapat mengembalikan pengguna ke halaman masuk alih-alih
      // menampilkan tabel kosong yang membingungkan.
      if (!opsi.diamkan401) API.saatSesiHabis();
      throw new GalatApi(401, (data && data.message) || "Sesi Anda telah berakhir.");
    }

    if (jawaban.status === 419) {
      throw new GalatApi(419, "Halaman kedaluwarsa. Muat ulang lalu coba lagi.");
    }

    if (jawaban.status === 403) {
      throw new GalatApi(403, (data && data.message) || "Anda tidak berwenang melakukan ini.");
    }

    if (jawaban.status === 422) {
      throw new GalatApi(
        422,
        (data && data.message) || "Ada isian yang perlu diperbaiki.",
        (data && data.errors) || null
      );
    }

    throw new GalatApi(
      jawaban.status,
      (data && data.message) || "Terjadi galat pada server (HTTP " + jawaban.status + ")."
    );
  }

  /* ------------------------------------------------------------------ api */

  const API = {
    BASIS: BASIS,
    GalatApi: GalatApi,

    /** 'api' bila tersambung, 'contoh' bila memakai data purwarupa. */
    mode: "belum-diperiksa",

    /** Pengguna yang sedang masuk, atau null. Diisi periksaSesi(). */
    pengguna: null,

    /** Diganti app.js; dipanggil saat server menyatakan sesinya habis. */
    saatSesiHabis: function () {},

    get: (jalur, opsi) => panggil("GET", jalur, undefined, opsi),
    post: (jalur, isi, opsi) => panggil("POST", jalur, isi, opsi),
    put: (jalur, isi, opsi) => panggil("PUT", jalur, isi, opsi),
    patch: (jalur, isi, opsi) => panggil("PATCH", jalur, isi, opsi),
    hapus: (jalur, opsi) => panggil("DELETE", jalur, undefined, opsi),

    /* ------------------------------------------------------------- sesi */

    async masuk(email, sandi, ingat) {
      const data = await API.post(
        "/api/masuk",
        { email: email, password: sandi, ingat: !!ingat },
        { diamkan401: true }
      );

      API.pengguna = (data && data.data) || null;
      API.mode = "api";
      return API.pengguna;
    },

    async keluar() {
      try {
        await API.post("/api/keluar", undefined, { diamkan401: true });
      } finally {
        // Keadaan lokal dibersihkan APA PUN hasil panggilannya. Bila server
        // tidak terjangkau, membiarkan antarmuka tampak "masih masuk" jauh
        // lebih buruk daripada memutusnya: pengguna yang menekan Keluar di
        // komputer bersama berhak menganggap dirinya sudah keluar.
        API.pengguna = null;
      }
    },

    /**
     * Memeriksa apakah sudah ada sesi, sekaligus apakah API terjangkau.
     *
     * Mengembalikan salah satu dari 'masuk', 'tamu', atau 'tidak-terjangkau'.
     * Ketiganya dibedakan dengan sengaja: "tamu" berarti server menjawab
     * dengan tegas bahwa Anda belum masuk, sedangkan "tidak-terjangkau"
     * berarti kita tidak tahu apa-apa — dan keduanya menuntut perlakuan yang
     * sama sekali berbeda dari antarmuka.
     */
    async periksaSesi() {
      if (!BASIS) {
        API.mode = "contoh";
        API.alasanTidakTerjangkau =
          "Alamat API belum diatur untuk host ini (localStorage 'flms.api').";
        return "tidak-terjangkau";
      }

      try {
        const data = await API.get("/api/saya", { diamkan401: true });
        API.pengguna = (data && data.data) || null;
        API.mode = "api";
        return "masuk";
      } catch (e) {
        if (e.status === 401) {
          API.mode = "api";
          return "tamu";
        }
        API.mode = "contoh";
        API.alasanTidakTerjangkau = e.message;
        return "tidak-terjangkau";
      }
    },

    /* ------------------------------------------------------------- izin */

    /**
     * Apakah pengguna memegang sebuah izin.
     *
     * Dipakai untuk menyaring menu dan tombol — kesopanan antarmuka, BUKAN
     * penjagaan. Penjaganya Policy dan middleware di server, yang tetap
     * menolak walau tombolnya dipanggil langsung dari konsol peramban.
     */
    boleh(izin) {
      if (!API.pengguna) return false;
      const daftar = API.pengguna.izin || [];
      return daftar.indexOf(izin) !== -1;
    },

    berperan(peran) {
      if (!API.pengguna) return false;
      return (API.pengguna.peran || []).indexOf(peran) !== -1;
    }
  };

  window.API = API;
})();
