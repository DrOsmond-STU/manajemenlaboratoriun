/* ==========================================================================
   FLMS — Gerbang masuk dan penanda mode data

   Layar ini menggantikan seluruh isi halaman selama pengguna belum masuk.
   Bukan modal di atas aplikasi: modal menyisakan seluruh kerangka aplikasi —
   menu, judul, angka ringkasan — tetap terpasang di DOM di belakangnya, dan
   apa pun yang sudah sempat dimuat ke sana dapat dibaca siapa saja yang
   menutup modalnya lewat konsol peramban.
   ========================================================================== */
(function () {
  "use strict";

  const U = window.UI;

  /* ------------------------------------------------------- spanduk mode */

  /**
   * Spanduk data contoh — sengaja tidak dapat ditutup.
   *
   * Purwarupa ini berisi data yang tampak meyakinkan: nama alat yang masuk
   * akal, angka rupiah yang wajar, jadwal yang rapi. Bila API tidak
   * terjangkau lalu antarmuka menampilkan data itu tanpa keterangan, yang
   * terjadi bukan "aplikasi tetap jalan" melainkan seseorang mengambil
   * keputusan di atas angka karangan tanpa pernah tahu.
   *
   * Tombol tutup sengaja tidak disediakan. Spanduk yang bisa ditutup akan
   * ditutup pada menit pertama, lalu tidak pernah terlihat lagi selama sisa
   * sesi — persis ketika ia paling dibutuhkan.
   */
  function spandukContoh(alasan) {
    const bar = document.createElement("div");
    bar.className = "mode-banner";
    bar.setAttribute("role", "status");
    bar.innerHTML =
      '<b>MODE DATA CONTOH</b>' +
      '<span>Server tidak terjangkau, jadi yang ditampilkan adalah data purwarupa — ' +
      'bukan data laboratorium Anda. Jangan dipakai untuk mengambil keputusan.</span>' +
      (alasan ? '<code>' + U.esc(alasan) + '</code>' : "");
    document.body.prepend(bar);
    document.body.classList.add("ada-spanduk");
  }

  /* ------------------------------------------------------- layar masuk */

  function layarMasukHTML() {
    return (
      '<div class="masuk-wrap">' +
      '  <form class="masuk-kartu" id="formMasuk" autocomplete="on">' +
      '    <div class="masuk-merek"><div class="brand-mark">FL</div>' +
      '      <div><b>FLMS</b><span>Manajemen Laboratorium &amp; Fasilitas</span></div></div>' +
      '    <h1>Masuk</h1>' +
      '    <div id="masukGalat" class="alert danger" hidden></div>' +
      '    <label class="fld"><span>Surel</span>' +
      '      <input type="email" name="email" id="masukEmail" required autocomplete="username" ' +
      '             autofocus placeholder="nama@instansi.go.id"></label>' +
      '    <label class="fld"><span>Kata sandi</span>' +
      '      <input type="password" name="password" id="masukSandi" required ' +
      '             autocomplete="current-password" placeholder="••••••••••••"></label>' +
      '    <label class="fld-cek"><input type="checkbox" id="masukIngat"> Ingat saya di perangkat ini</label>' +
      '    <button class="btn btn-primary btn-block" type="submit" id="masukTombol">Masuk</button>' +
      '    <p class="masuk-kaki">Belum punya akun? Akun dibuat oleh administrator sistem, ' +
      '       bukan lewat pendaftaran mandiri.</p>' +
      '  </form>' +
      "</div>"
    );
  }

  function tampilkanGalat(pesan) {
    const kotak = document.getElementById("masukGalat");
    kotak.textContent = pesan;
    kotak.hidden = false;
  }

  function pasangLayarMasuk(saatBerhasil) {
    document.getElementById("app").innerHTML = layarMasukHTML();
    document.title = "Masuk · FLMS";

    const form = document.getElementById("formMasuk");
    const tombol = document.getElementById("masukTombol");

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      document.getElementById("masukGalat").hidden = true;

      tombol.disabled = true;
      tombol.textContent = "Memeriksa…";

      try {
        await window.API.masuk(
          document.getElementById("masukEmail").value,
          document.getElementById("masukSandi").value,
          document.getElementById("masukIngat").checked
        );
        saatBerhasil();
      } catch (err) {
        // Pesannya diteruskan apa adanya dari server, yang sengaja seragam
        // untuk surel salah maupun sandi salah. Membedakan keduanya
        // memberitahu penyerang surel mana yang terdaftar.
        tampilkanGalat(err.message || "Gagal masuk.");
        document.getElementById("masukSandi").value = "";
        document.getElementById("masukSandi").focus();
      } finally {
        tombol.disabled = false;
        tombol.textContent = "Masuk";
      }
    });
  }

  window.Masuk = {
    pasang: pasangLayarMasuk,
    spandukContoh: spandukContoh
  };
})();
