# DESIGN — Sistem Desain & Panduan Antarmuka
## FLMS · Facility, Laboratory & Meeting Management System

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Sumber kebenaran** | `assets/css/app.css` (920 baris) — dokumen ini menjelaskan, kode yang menentukan |
| **Dokumen terkait** | [PRD.md](PRD.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [TASK_INSTRUCTIONS.md](TASK_INSTRUCTIONS.md) |

---

## 1. Prinsip Desain

1. **Kepadatan informasi yang terkendali.** Pengelola fasilitas bekerja dengan tabel
   panjang dan jadwal padat. Antarmuka mengutamakan keterbacaan data, bukan ruang
   kosong yang lapang.
2. **Status harus terbaca sekilas.** Setiap objek — booking, alat, aset, checklist —
   selalu menampilkan status dengan warna dan label yang konsisten di seluruh aplikasi.
3. **Aksi merusak tidak boleh mudah tersentuh.** Menghapus, membatalkan, dan
   memblokir selalu melewati konfirmasi yang menyebutkan akibatnya.
4. **Beri tahu sebelum gagal, bukan sesudah.** Kapasitas kurang, jadwal bentrok, dan
   label yang tidak muat diberitahukan saat pengguna masih bisa memperbaikinya.
5. **Satu bahasa untuk satu hal.** "Booking" tetap "booking" di menu, tombol, pesan,
   dan email — tidak berganti menjadi "reservasi" atau "pemesanan" di tempat lain.
6. **Bekerja di ponsel, bukan sekadar tidak rusak.** Petugas mengisi checklist sambil
   berdiri di depan alat.

## 2. Token Warna

Seluruh warna adalah variabel CSS pada `:root`. **Jangan pernah menuliskan nilai
heksadesimal langsung di kode view.**

### 2.1 Warna merek & aksen

| Token | Terang | Peran |
|---|---|---|
| `--brand-500` | `#3563e9` | Garis grafik, isian bar |
| `--brand-600` | `#1b4bd6` | Tombol utama, tautan, menu aktif |
| `--brand-50` | `#eef4ff` | Latar tint, sorotan lembut |
| `--teal-500` | `#0fa3a3` | Aksen laboratorium |
| `--violet-500` | `#7c3aed` | Aksen event/auditorium & AI |
| `--amber-500` | `#d97706` | Peringatan, menunggu tindakan |
| `--green-500` | `#16a34a` | Berhasil, tersedia, tercapai |
| `--red-500` | `#dc2626` | Galat, terlambat, rusak berat |
| `--slate-500` | `#64748b` | Netral, nonaktif |

### 2.2 Warna permukaan & teks

| Token | Terang | Gelap | Peran |
|---|---|---|---|
| `--bg` | `#f5f7fb` | `#0b1120` | Latar halaman |
| `--surface` | `#ffffff` | `#121b2d` | Kartu, panel |
| `--surface-2` | `#f8fafc` | `#172236` | Kepala tabel, area sekunder |
| `--surface-3` | `#f1f5f9` | `#1d2942` | Latar kontrol |
| `--border` | `#e3e8f0` | `#24314c` | Garis pemisah |
| `--border-strong` | `#cfd7e4` | `#33425f` | Tepi kontrol |
| `--text` | `#101a2e` | `#e8edf7` | Teks utama |
| `--text-muted` | `#5b6b85` | `#9aa8c0` | Teks sekunder |
| `--text-faint` | `#8a99b0` | `#6f7f99` | Label, keterangan |

### 2.3 Semantik status

Pemetaan status → warna terpusat di `UI.TONE` (`assets/js/ui.js`). Menambah status
baru berarti menambah entri di sana, **bukan** menulis kelas warna di view.

| Kelompok | Contoh status | Warna |
|---|---|---|
| Positif | Available, Aktif, Approved, Selesai, Paid, Lulus, Baik | hijau |
| Berjalan | In Use, Digunakan, Booked, Dipinjam, Reserved, In Progress | biru |
| Menunggu | Waiting Approval, Scheduled, Terjadwal, Waiting Payment | kuning |
| Khusus | Calibration, Maintenance, Renovasi | ungu |
| Negatif | Broken, Rusak, Overdue, Terlambat, Cancelled, Tidak Lulus | merah |
| Netral | Retired, Disposal, Draft, Tidak Digunakan | abu |

## 3. Mode Gelap

Mode gelap **bukan pembalikan warna**. Token permukaan dan teks ditukar pada
`html[data-theme="dark"]`, lalu ada blok penyesuaian kontras tersendiri.

**Aturan yang harus dipatuhi:** token `*-600` dan `*-700` dirancang sebagai teks di
atas latar terang. Di mode gelap, teks di atas permukaan tint memakai varian yang
lebih terang — bukan token yang sama.

```css
/* Salah: teks biru tua di atas tint biru tua */
.badge.brand { color: var(--brand-600); }

/* Benar: penyesuaian eksplisit untuk mode gelap */
html[data-theme="dark"] .badge.brand { color: #a3c0ff; }
```

Ini bukan kehati-hatian teoretis — ketentuan ini lahir dari cacat nyata: pada versi
awal, peringatan "peminjaman terlambat" praktis tidak terbaca di mode gelap.

## 4. Tipografi

| Peran | Ukuran | Tebal | Catatan |
|---|---|---|---|
| Judul halaman `h1` | 22 px | 650 | 19 px pada layar < 460 px |
| Judul bagian `h2` | 18 px | 650 | |
| Judul kartu `h3` | 15 px | 650 | |
| Label bagian `h4` | 13 px | 650 | Huruf besar + `.muted` untuk label kelompok |
| Teks isi | 14 px | 400 | Ukuran dasar `body` |
| Teks kecil `.small` | 12 px | 400 | Metadata baris tabel |
| Teks halus `.tiny` | 11 px | 400 | Keterangan, jangan untuk informasi penting |
| Angka KPI | 26 px | 700 | 23 px pada layar sempit |

Rangkaian huruf memakai *system font stack* — tanpa unduhan font eksternal, sehingga
tidak ada permintaan jaringan pihak ketiga dan tidak ada teks tak tampil saat font
gagal dimuat. Nomor identitas (kode BMN, serial number, ID transaksi) memakai kelas
`.mono` agar mudah dibandingkan karakter demi karakter.

## 5. Tata Letak & Spasi

- **Kisi:** 12 kolom, jarak 14 px pada dashboard; utilitas `.g2`–`.g6` untuk kisi biasa.
- **Skala spasi:** 4 · 6 · 8 · 10 · 12 · 16 · 20 · 24 px.
- **Radius:** 6 (kecil) · 8 · 12 (kartu) · 16 (modal) · 20 px (lencana).
- **Bayangan:** empat tingkat, dari `--shadow-xs` (kartu diam) sampai `--shadow-lg`
  (modal, drawer).

**Aturan kisi yang wajib diikuti:** setiap kolom kisi memakai `minmax(0, 1fr)`,
bukan `1fr`, dan `.grid > *` diberi `min-width: 0`. Tanpa keduanya, isi lebar seperti
tabel dan timeline akan memaksa kolom melebar dan merusak tata letak pada layar sempit.

## 6. Komponen

| Komponen | Kelas | Kapan dipakai |
|---|---|---|
| Kartu | `.card` + `.card-head`/`.card-body`/`.card-foot` | Wadah dasar seluruh isi |
| Kartu KPI | `.kpi` | Satu angka penting dengan konteks |
| Lencana | `.badge` + warna | Status; selalu lewat `UI.badge()` |
| Chip | `.chip` / `.chip.on` | Pilihan yang dapat diaktifkan, filter |
| Tombol | `.btn`, `.btn-primary`, `.btn-danger`, `.btn-ghost` | Satu tombol utama per layar |
| Tabel | `table.tbl` | Data baris; selalu lewat `UI.table()` |
| Bilah alat tabel | `.tbl-toolbar` | Pencarian + filter di atas tabel |
| Stepper | `.stepper` | Menunjukkan posisi dalam alur bertahap |
| Garis waktu | `.tline` | Riwayat kronologis |
| Kalender | `.cal` | Tampilan bulanan |
| Timeline ketersediaan | `.tl` | Jadwal per resource per jam |
| Modal | `.modal` | Keputusan atau formulir pendek yang memblokir |
| Drawer | `.drawer` | Detail objek yang panjang, konteks tetap terlihat |
| Toast | `.toast` | Umpan balik singkat, tidak memblokir |
| Alert | `.alert` + `info`/`warn`/`err`/`ok`/`ai` | Penjelasan menetap dalam halaman |
| Keadaan kosong | `.empty` | Selalu jelaskan langkah berikutnya |
| Widget dashboard | `.wdg` | Dikelola mesin `DASH` |
| Label cetak | `.lbl` | Berukuran milimeter, bukan piksel |

### Modal atau drawer?

| Pakai **modal** bila | Pakai **drawer** bila |
|---|---|
| Butuh keputusan sekarang (konfirmasi hapus) | Menampilkan detail objek |
| Formulir pendek, ≤ 8 isian | Isi panjang dan perlu digulir |
| Konteks di belakang tidak penting | Pengguna perlu ingat sedang di daftar mana |

## 7. Pola Antarmuka

**Wizard.** Untuk alur yang punya urutan wajib dan biaya kesalahan tinggi
(booking ruangan, 5 langkah). Setiap langkah menampilkan ringkasan berjalan di sisi
kanan sehingga pengguna tidak kehilangan konteks.

**Validasi.** Ditampilkan saat pengguna masih bisa memperbaiki. Contoh nyata:
ruangan berkapasitas kurang ditandai **beserta alasannya** ("Kapasitas kurang
(10 < 20)"), bukan sekadar dihilangkan dari daftar.

**Aksi merusak.** Modal konfirmasi yang menyebut nama objek dan akibatnya.
Tombol memakai `.btn-danger`, dan tidak pernah menjadi tombol yang paling menonjol.

**Daftar panjang.** Bilah alat berisi pencarian dan filter, penomoran halaman di
bawah, dan kolom aksi selalu di paling kanan.

**Peringatan sebelum cetak.** Studio label memeriksa apakah isi melebihi tinggi
label atau terpotong mendatar, lalu memberi tahu **sebelum** kertas terbuang.

## 8. Visualisasi Data

Seluruh grafik digambar sebagai SVG buatan sendiri di `assets/js/ui.js` — tanpa
pustaka grafik.

| Bentuk | Fungsi | Kapan |
|---|---|---|
| Area/garis | Tren waktu | Perbandingan beberapa deret sepanjang waktu |
| Batang | Perbandingan periode | Nilai per bulan |
| Donat | Komposisi | Maksimal 6 kategori |
| Batang mendatar | Peringkat | Label panjang, nilai dibandingkan |
| Heatmap | Pola dua dimensi | Hari × jam |
| Sparkline | Tren dalam ruang sempit | Di dalam baris tabel |
| Gauge | Capaian terhadap 100 | Skor Balanced Scorecard |

**Aturan:** warna deret mengikuti urutan tetap (biru → tosca → ungu → kuning) agar
"Ruangan" selalu biru di semua grafik. Legenda memakai label berbahasa Indonesia,
bukan nama kunci data.

## 9. Aksesibilitas

**Target: WCAG 2.2 level AA.**

| Aspek | Ketentuan | Status |
|---|---|---|
| Kontras teks | ≥ 4,5:1 teks biasa; ≥ 3:1 teks besar | Token dirancang untuk ini; **belum diaudit menyeluruh** |
| Kontras mode gelap | Blok penyesuaian khusus | Sudah diperbaiki untuk lencana, alert, tautan |
| Warna bukan satu-satunya penanda | Status memakai warna **dan** teks | Terpenuhi — lencana selalu berlabel |
| Navigasi papan ketik | Seluruh aksi dapat dijangkau tanpa tetikus | **Belum lengkap** — seret-lepas belum punya alternatif papan ketik |
| Indikator fokus | Terlihat jelas pada seluruh kontrol | Sebagian; perlu penyeragaman |
| Label formulir | Setiap isian punya `<label>` | Terpenuhi |
| Teks alternatif | Gambar bermakna punya `alt` | Sebagian |
| Peran ARIA | Modal, drawer, toast diumumkan pembaca layar | **Belum dikerjakan** |
| Ukuran sasaran sentuh | ≥ 24 × 24 px | Sebagian; beberapa ikon 22 px |

> **Ditulis apa adanya:** purwarupa belum melewati audit aksesibilitas. Empat butir
> di atas berstatus belum selesai dan **wajib diselesaikan sebelum produksi**, karena
> aplikasi instansi pemerintah umumnya terikat kewajiban aksesibilitas. Prioritas
> tertinggi: alternatif papan ketik untuk penyusunan widget, dan peran ARIA untuk
> modal/drawer.

## 10. Responsif

| Titik henti | Perubahan |
|---|---|
| > 1400 px | Kisi penuh 12 kolom; KPI 6 per baris |
| ≤ 1400 px | KPI menjadi 3 per baris |
| ≤ 1200 px | Widget dashboard menjadi 6 kolom; tata letak dua kolom menyatu |
| ≤ 1100 px | Halaman kalender dan studio label menjadi satu kolom |
| ≤ 900 px | Sidebar menjadi laci geser; seluruh kisi satu kolom |
| ≤ 760 px | Breadcrumb dan nama pengguna disembunyikan; tombol memenuhi lebar |
| ≤ 460 px | Judul dan angka KPI diperkecil; toast memenuhi lebar |

**Aturan mutlak:** halaman **tidak boleh** menggulir mendatar pada 390 px. Isi lebar
(tabel, timeline, lembar label) menggulir di dalam wadahnya sendiri. Aturan ini diuji
otomatis pada 19 rute — lihat [TESTING.md](TESTING.md).

## 11. Bahasa & Penulisan

- **Bahasa Indonesia** untuk seluruh antarmuka. Istilah teknis yang sudah lazim
  (booking, dashboard, checklist, barcode) dipertahankan.
- **Kalimat biasa**, bukan Huruf Kapital Di Setiap Kata.
- **Tombol memakai kata kerja**: "Ajukan Booking", bukan "Kirim".
- **Pesan galat menyebut jalan keluar**: "Kapasitas kurang (10 < 20). Pilih ruangan
  lain atau kurangi peserta."
- **Angka**: pemisah ribuan titik, desimal koma, mata uang `Rp 1.250.000`.
- **Tanggal**: `15 Agustus 2026` untuk tampilan panjang, `15 Agu 2026` untuk tabel.
- **Waktu**: 24 jam, sertakan `WIB` bila konteks lintas zona.
- **Istilah baku**: gunakan *penanggung jawab* (bukan *PJ*), *peralatan* untuk alat
  laboratorium, *fasilitas* untuk ruangan dan sarana pendukung.

## 12. Cetak

Dua kebutuhan cetak yang berbeda:

**Cetak halaman** (laporan, KIB) — aturan `@media print` menyembunyikan sidebar,
bilah atas, dan tombol aksi, lalu melebarkan isi.

**Cetak label** — memakai satuan **milimeter**, bukan piksel, sehingga ukuran hasil
cetak sesuai ukuran fisik stiker. Saat mencetak, hanya `.print-root` yang tampil.
Ukuran pratinjau di layar 1:1 terhadap ukuran cetak sebenarnya.

## 13. Menambah Komponen Baru

Sebelum membuat komponen baru, periksa berurutan:

1. Apakah komponen yang ada bisa dipakai dengan pengubah kecil?
2. Apakah pola ini muncul di lebih dari satu layar? Bila tidak, cukup gaya lokal.
3. Apakah sudah ada token untuk warna, jarak, dan radiusnya?

Bila memang perlu komponen baru: tambahkan di `app.css` pada bagian yang sesuai,
gunakan token yang ada, sediakan penanganan mode gelap, dan periksa pada 390 px.
Panduan langkah teknisnya ada di [TASK_INSTRUCTIONS.md](TASK_INSTRUCTIONS.md).
