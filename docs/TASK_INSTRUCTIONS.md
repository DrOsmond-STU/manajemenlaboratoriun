# TASK_INSTRUCTIONS — Panduan Kerja Tim Pengembang
## FLMS · Facility, Laboratory & Meeting Management System

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Untuk** | Pengembang yang melanjutkan purwarupa ini menjadi produk |
| **Dokumen terkait** | [ARCHITECTURE.md](ARCHITECTURE.md) · [DESIGN.md](DESIGN.md) · [TESTING.md](TESTING.md) |

---

## 1. Mulai Bekerja

```bash
git clone https://github.com/DrOsmond-STU/manajemenlaboratoriun.git
cd manajemenlaboratoriun
npm install          # hanya untuk uji; aplikasi tidak butuh build
npm run serve        # http://127.0.0.1:8899
npm test             # pastikan hijau sebelum mulai mengubah
```

Tidak ada langkah build. Ubah berkas, muat ulang peramban.

## 2. Aturan Dasar

1. **Baca [DESIGN.md](DESIGN.md) sebelum menulis CSS.** Token sudah ada untuk hampir
   semua kebutuhan.
2. **Jangan tulis nilai warna langsung.** Selalu `var(--token)`.
3. **Setiap nilai data yang masuk HTML wajib melewati `UI.esc()`.** Tanpa kecuali.
4. **Setiap perubahan wajib punya uji**, atau alasan tertulis mengapa tidak.
5. **`npm test` harus hijau sebelum dorong.**
6. **Komentar dan teks antarmuka berbahasa Indonesia.** Nama variabel boleh Inggris
   mengikuti kode yang ada.
7. **Periksa mode gelap dan lebar 390 px** untuk setiap tampilan baru.

## 3. Struktur & Di Mana Menaruh Kode

| Kebutuhan | Berkas |
|---|---|
| Data contoh baru | `assets/js/data.js` atau `data-ext.js` |
| Komponen UI umum | `assets/js/ui.js` |
| Layar operasional (kalender, booking) | `assets/js/views-core.js` |
| Layar fasilitas & laboratorium | `assets/js/views-facility.js` |
| Layar aset, sewa, event, laporan | `assets/js/views-business.js` |
| Layar administrasi | `assets/js/views-admin.js` |
| Layar BMN, label, barcode | `assets/js/views-bmn.js` |
| Layar dashboard & BSC | `assets/js/views-dash.js` |
| Layar checklist | `assets/js/views-checklist.js` |
| Layar notifikasi email | `assets/js/views-notif.js` |
| Mesin widget | `assets/js/dash.js` |
| Encoder barcode | `assets/js/barcode.js` |
| Navigasi & router | `assets/js/app.js` |
| Seluruh gaya | `assets/css/app.css` |

Berkas view dimuat berurutan; berkas yang dimuat belakangan dapat menimpa `VIEWS`
dari berkas sebelumnya.

## 4. Resep — Menambah Sesuatu

### 4.1 Menambah layar baru

```js
// assets/js/views-<kelompok>.js
V["namarute"] = {
  title: "Judul Halaman",
  sub: "Satu kalimat menjelaskan isi halaman ini.",
  actions: `<button class="btn btn-primary btn-sm" onclick="aksiSaya()">
              ${U.icon("plus")} Aksi Utama</button>`,
  render() {
    return `
      <div class="grid g4 mb-16">
        ${U.kpi({ label: "Contoh", value: 12, icon: "box", tint: "brand" })}
      </div>
      ${U.card("Judul Kartu", U.table([
        { t: "Kolom", render: (r) => U.esc(r.nama) }
      ], D.dataSaya), { bodyCls: "flush" })}`;
  },
  mount() { /* opsional: dijalankan setelah HTML dipasang */ }
};
```

Lalu daftarkan pada `NAV` di `assets/js/app.js`, dan tambahkan nama rute ke daftar
`ROUTES` pada `tests/smoke.js`.

### 4.2 Menambah sumber data dashboard

```js
// assets/js/dash.js — objek SOURCES
namaSumber: {
  n: "Nama yang dilihat pengguna",
  kind: "kategori",          // series | series1 | kategori | baris | matriks
  get: () => D.sesuatu.map((x) => ({ n: x.nama, v: x.nilai, c: "var(--brand-500)" }))
}
```

Bentuk keluaran per `kind`:

| `kind` | Bentuk | Dipakai tipe |
|---|---|---|
| `series` | `[{ m: "Jan", a: 1, b: 2 }]` | line |
| `series1` | `[{ m: "Jan", val: 42 }]` | bar |
| `kategori` | `[{ n, v, c }]` | donut, hbars, ranking |
| `baris` | `[{ a, b, c, d }]` | table, list |
| `matriks` | `[[…], […]]` | heatmap |

Sumber otomatis muncul di penyunting widget untuk tipe yang cocok. Tidak perlu
menyentuh kode lain.

### 4.3 Menambah metrik KPI

```js
// assets/js/dash.js — objek METRICS
namaMetrik: {
  n: "Nama metrik",
  get: () => D.sesuatu.length,
  suffix: "%"            // opsional
}
```

### 4.4 Menambah jenis checklist

```js
// assets/js/data-ext.js — D.checklistTypes
{ k: "kunci", n: "Nama Jenis", icon: "shield", tint: "brand" }
```
Jenis baru langsung muncul di pembuat checklist, kartu ringkasan, dan penyaring.

### 4.5 Menambah aturan notifikasi email

```js
// assets/js/data-ext.js — D.emailEvents
{ k: "kunci", n: "Nama peristiwa", src: "Sumber",
  to: ["PIC Resource"], sched: ["H-1 07:00"], on: true }
```
Bila peristiwa berasal dari sumber jadwal baru, tambahkan juga blok pengumpulannya
pada fungsi `schedule()` di `views-notif.js`.

### 4.6 Menambah kode barang BMN

```js
// assets/js/data.js — bmnRef.kodeBarang
{ k: "3.08.01.03.001", n: "Uraian resmi", kel: "3.08.01", mm: 8 }
```
`mm` adalah masa manfaat dalam tahun. **Untuk produksi, tabel ini diganti impor
master resmi**, bukan ditambah satu per satu.

### 4.7 Menambah komponen CSS

1. Periksa apakah komponen yang ada bisa dipakai dengan pengubah kecil.
2. Tambahkan di bagian yang sesuai pada `app.css`.
3. Gunakan token; jangan nilai heksadesimal.
4. Sediakan penyesuaian mode gelap bila memakai warna teks di atas tint.
5. Periksa pada 390 px.

**Perhatian:** jangan membuat kelas komponen yang hanya bekerja sebagai keturunan
kelas lain kecuali memang disengaja. Cacat nyata pernah terjadi: `.kpi-ico` ditulis
sebagai `.kpi .kpi-ico`, sehingga ikon melebar penuh ketika dipakai di luar kartu KPI.

## 5. Konvensi Kode

**Penamaan**
- Fungsi dan variabel: `camelCase`
- Konstanta modul: `SCREAMING_SNAKE`
- Kunci rute: huruf kecil, tanpa spasi (`emailsched`, `booking/new`)
- Kelas CSS: `kebab-case`, awalan sesuai komponen (`lbl-`, `wdg-`, `ck-`)

**Gaya**
- Indentasi 2 spasi
- Tanda kutip ganda untuk string, backtick untuk template
- Titik koma dipakai
- Satu modul = satu IIFE

**Komentar**
- Berbahasa Indonesia
- Jelaskan **mengapa**, bukan apa. `// tambah 1` tidak berguna;
  `// NUP berurut per sub-sub kelompok sesuai PMK 29/2010` berguna.
- Setiap berkas diawali blok penjelas tanggung jawabnya

## 6. Alur Git

**Branch**
```
feat/<ringkas>      fitur baru
fix/<ringkas>       perbaikan cacat
docs/<ringkas>      dokumentasi
refactor/<ringkas>  penataan tanpa ubah perilaku
```

**Commit** — baris pertama ≤ 72 karakter, kalimat perintah, bahasa Indonesia:
```
Tambah validasi kapasitas pada wizard booking

Ruangan berkapasitas kurang dari jumlah peserta kini ditandai
beserta alasannya, tidak lagi disembunyikan diam-diam, agar
pemohon tahu mengapa pilihan tersebut tidak tersedia.
```

**Pull request** harus memuat: apa yang berubah, mengapa, cara mengujinya, tangkapan
layar untuk perubahan visual, dan catatan risiko bila ada.

## 7. Definition of Ready / Done

**Siap dikerjakan**
- [ ] Kriteria penerimaan tertulis dan dapat diuji
- [ ] Rancangan atau acuan layar tersedia
- [ ] Ketergantungan pada pihak lain teridentifikasi
- [ ] Aturan bisnis jelas, termasuk kasus batas

**Selesai**
- [ ] Kriteria penerimaan terpenuhi seluruhnya
- [ ] Uji ditambahkan dan `npm test` hijau
- [ ] Tanpa galat konsol
- [ ] Mode gelap dan 390 px diperiksa
- [ ] Aksesibilitas dasar: dapat dijangkau papan ketik, label formulir ada
- [ ] Dokumen terkait diperbarui
- [ ] Ditinjau dan disetujui satu pengembang lain

## 8. Backlog Menuju Produksi

Diurutkan menurut ketergantungan. Estimasi dalam hari-orang, **kasar** dan wajib
disesuaikan setelah tim terbentuk.

### Tahap 1 — Fondasi (penghalang seluruh pekerjaan lain)

| # | Tugas | Est. | Catatan |
|---|---|---:|---|
| 1.1 | Siapkan repositori backend, CI, lingkungan | 3 | Lint, uji, build |
| 1.2 | Skema basis data + migrasi awal | 5 | Ikuti [ARCHITECTURE.md §8](ARCHITECTURE.md) |
| 1.3 | Autentikasi SSO + sesi | 5 | **Penghalang rilis** |
| 1.4 | Otorisasi RBAC + cakupan data | 8 | Termasuk uji akses lintas peran |
| 1.5 | Audit trail | 3 | Hanya sisip, nilai sebelum/sesudah |
| 1.6 | Modularisasi frontend + klien API | 8 | Pertahankan bentuk data agar view minim ubah |

### Tahap 2 — Modul inti

| # | Tugas | Est. | Catatan |
|---|---|---:|---|
| 2.1 | Master data (organisasi, ruangan, lab) | 5 | |
| 2.2 | Aset & BMN + impor master kode barang | 8 | **Butuh data dari klien** |
| 2.3 | Penerbitan NUP tahan balapan | 3 | Kunci baris, bukan `MAX+1` |
| 2.4 | Booking + batasan eksklusi bentrok | 8 | Jaminan di basis data |
| 2.5 | Mesin persetujuan | 5 | Alur bersyarat, SLA, delegasi |
| 2.6 | Unggah berkas + object storage | 5 | Validasi [SECURITY.md §6.3](SECURITY.md) |
| 2.7 | Cetak label & barcode | 2 | `barcode.js` dipakai apa adanya |

### Tahap 3 — Operasional

| # | Tugas | Est. | Catatan |
|---|---|---:|---|
| 3.1 | Pemeliharaan & work order | 5 | Termasuk blokir resource |
| 3.2 | Kalibrasi + pengingat | 3 | |
| 3.3 | Checklist: template, tugas, pelaksanaan | 8 | |
| 3.4 | Antrean + penjadwal notifikasi | 8 | Idempotensi wajib |
| 3.5 | Template email + ringkasan harian | 5 | Uji di beberapa klien email |
| 3.6 | Peminjaman & pengembalian + BAST | 5 | |

### Tahap 4 — Komersial & analitik

| # | Tugas | Est. | Catatan |
|---|---|---:|---|
| 4.1 | Tarif, paket, penawaran | 5 | |
| 4.2 | Tagihan & pembayaran | 8 | Integrasi payment gateway |
| 4.3 | Preferensi dashboard di server | 3 | Pindahkan dari `localStorage` |
| 4.4 | Snapshot KPI + Balanced Scorecard | 5 | |
| 4.5 | Laporan & ekspor | 5 | Termasuk format untuk SAKTI |

### Tahap 5 — Pengerasan

| # | Tugas | Est. | Catatan |
|---|---|---:|---|
| 5.1 | Perbaikan aksesibilitas | 5 | Papan ketik, ARIA, kontras |
| 5.2 | Uji kinerja & optimasi | 3 | |
| 5.3 | Uji penetrasi + perbaikan | 5 | Pihak independen |
| 5.4 | Migrasi data + verifikasi | 5 | |
| 5.5 | Pelatihan & dokumentasi pengguna | 5 | |

**Total kasar: ± 145 hari-orang** di luar manajemen proyek dan masa uji coba.

## 9. Utang Teknis Purwarupa

Diketahui dan disengaja. Tangani saat memindahkan ke produksi.

| # | Utang | Dampak | Penanganan |
|---|---|---|---|
| U1 | Render dengan `innerHTML` | Risiko XSS bila data pengguna persisten | Pindah ke render berbasis komponen |
| U2 | Data global `DB` | Sulit diuji terpisah | Ganti dengan lapisan klien API |
| U3 | Fungsi global `window.*` untuk handler | Berpotensi tabrakan nama | Pengikat peristiwa berlingkup komponen |
| U4 | `views-business.js` 931 baris | Sulit dirawat | Pecah per modul |
| U5 | Preferensi di `localStorage` | Hilang saat ganti perangkat | Simpan di server |
| U6 | Filter tabel hanya di klien | Tidak sesuai pada data besar | Pindah ke kueri sisi server |
| U7 | AI Assistant memakai jawaban tetap | Bukan AI sungguhan | Sambungkan ke layanan model bila diputuskan |
| U8 | Aksesibilitas belum lengkap | Kewajiban regulasi | Tugas 5.1 |

## 10. Meninjau Kode

Yang wajib diperiksa peninjau:

1. **Keamanan** — apakah seluruh nilai data melewati `UI.esc()`? Apakah otorisasi
   diperiksa di server, bukan hanya menyembunyikan tombol?
2. **Kebenaran** — apakah kasus batas tertangani? Kapasitas tepat sama, rentang waktu
   bersentuhan, pembagian dengan nol?
3. **Konsistensi** — apakah memakai komponen dan token yang ada?
4. **Kejujuran uji** — apakah uji benar-benar bisa gagal? Uji yang memanggil fungsi
   internal sering hijau padahal antarmukanya rusak.
5. **Bahasa** — apakah teks antarmuka konsisten dengan istilah yang dipakai di
   tempat lain?
