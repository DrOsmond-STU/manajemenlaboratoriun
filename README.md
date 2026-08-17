# FLMS — Purwarupa UI/UX
### Facility, Laboratory & Meeting Management System

Purwarupa antarmuka (UI/UX prototype) **Aplikasi Manajemen Laboratorium, Fasilitas, Ruang Rapat & Auditorium**,
disusun berdasarkan *Dokumen Detail Fitur* (39 bagian, 25 modul).

Purwarupa berjalan sepenuhnya di sisi klien — **HTML, CSS, dan JavaScript murni**, tanpa proses build,
tanpa framework, dan tanpa dependensi eksternal. Seluruh data bersifat fiktif dan hanya untuk peragaan alur.

**Live:** https://lab.semestateknologiutama.com

---

## Menjalankan secara lokal

```bash
# cukup layani direktori ini sebagai berkas statis
npx http-server -p 8080 .
# lalu buka http://localhost:8080
```

Dapat pula dibuka langsung lewat `file://`, namun disarankan melalui HTTP agar `localStorage` dan
navigasi hash berperilaku sama seperti di produksi.

---

## Struktur berkas

```
index.html                   Halaman masuk (login) + pemilih peran demo
app.html                     Shell aplikasi (SPA, hash router)
assets/css/app.css           Design system: token, komponen, mode gelap, responsif
assets/js/data.js            Dataset dummy + referensi BMN (kodefikasi, satker, template label)
assets/js/barcode.js         Encoder Code 128 & QR Code (SVG, tanpa dependensi)
assets/js/ui.js              UI kit: ikon SVG, formatter, tabel, chart, modal/drawer/toast
assets/js/views-core.js      Dashboard, kalender, ketersediaan, wizard booking, reservasi alat
assets/js/views-facility.js  Laboratorium, alat, kalibrasi, maintenance, ruangan, auditorium, layout
assets/js/views-business.js  Aset, rental & billing, event, people, dokumen, laporan
assets/js/views-admin.js     Approval, workflow, role & hak akses, master data, audit trail, AI Assistant
assets/js/views-bmn.js       Register BMN, registrasi peralatan + foto, studio label & barcode
assets/js/app.js             Navigasi, breadcrumb, router, notifikasi, tema, profil
.htaccess                    Konfigurasi Apache untuk hosting statis
```

---

## Cakupan layar (58 rute)

| Kelompok | Layar |
|---|---|
| **Dashboard** | Dashboard Operasional, Dashboard Manajemen (KPI eksekutif) |
| **Operations** | Kalender Terpadu, Daftar Booking, Booking Saya, Room Availability, Reservasi Alat, Approval |
| **Laboratory** | Laboratorium, Alat Laboratorium, **Registrasi Alat (BMN)**, Booking Alat, Kalibrasi, Maintenance, Jadwal Laboratorium |
| **Facility** | Ruangan, Ruang Rapat, Auditorium, Room Layout, Fasilitas & Add-on, Jadwal Fasilitas |
| **Asset** | Asset Register, **Register BMN (KIB B)**, **Label & Barcode**, Asset Movement, Peminjaman & Pengembalian, Asset Maintenance, Audit Aset |
| **Rental** | Permohonan Sewa, Daftar Tarif, Paket Layanan, Quotation, Invoice, Pembayaran |
| **Event** | Event, Agenda, Peserta, Vendor, Laporan Event |
| **People** | Pengguna, PIC, Teknisi & Operator, Pengunjung, Organisasi |
| **Document** | Dokumen & Berita Acara (BAST, sertifikat, perjanjian) |
| **Report** | Utilisasi, Ruangan, Alat, Aset, Penyewaan, Maintenance, Keuangan |
| **Administration** | Master Data, Workflow, Role & Hak Akses, Notifikasi, Audit Trail, Pengaturan Sistem |
| **AI** | AI Assistant (percakapan bersimulasi) |

## Modul BMN, foto, dan barcode

### Pendataan mengacu Barang Milik Negara
Isian peralatan dan fasilitas mengikuti kebutuhan pendataan BMN:

| Acuan | Penerapan di purwarupa |
|---|---|
| **PMK 29/PMK.06/2010** — Penggolongan & Kodefikasi BMN | Kode barang 10 digit `X.XX.XX.XX.XXX` (Golongan · Bidang · Kelompok · Sub Kelompok · Sub-sub Kelompok); **NUP** berurut per sub-sub kelompok menurut urutan perolehan |
| **PMK 181/PMK.06/2016** — Penatausahaan BMN | Register BMN / KIB B, Daftar Barang Ruangan (DBR), status penggunaan, penetapan status penggunaan (PSP) |
| **PMK 65/PMK.06/2017** — Penyusutan BMN | Masa manfaat per kelompok barang, penyusutan garis lurus, akumulasi penyusutan, nilai buku |

Kelompok isian: identitas & kodefikasi, identitas internal, spesifikasi teknis,
perolehan & nilai (cara perolehan, sumber dana, nomor SPM/SP2D/BAST, kontrak,
kuantitas, satuan), penempatan & penanggung jawab, kondisi (B/RR/RB) & status
penggunaan, serta foto barang.

> **Catatan.** Pohon kode barang yang disertakan adalah **cuplikan contoh** untuk
> memperagakan mekanisme pemilihan kode. Master kode barang yang sebenarnya wajib
> diimpor utuh dari referensi resmi Kementerian Keuangan/SAKTI milik satuan kerja,
> dan pemetaan kolom perlu diverifikasi ulang terhadap versi peraturan yang berlaku.

### Dua penomoran
- **Penomoran 1 — BMN (kunci utama):** `kode lokasi · kode barang · NUP`,
  contoh `024.05.0100.652431.000.3.08.01.03.001.00001`. NUP dihitung otomatis.
- **Penomoran 2 — internal:** pola dapat diatur sendiri, contoh
  `STU/{LAB}/{KATEGORI}/{TAHUN}/{URUT}` → `STU/KIM-01/HPLC-001`.

Keduanya tampil berdampingan pada daftar alat, detail alat, Register BMN, dan
pratinjau saat registrasi.

### Unggah foto
Pada bagian *Foto Barang*: seret-lepas atau pilih berkas, unggah banyak berkas
sekaligus, ambil dari kamera perangkat, tandai foto utama, dan hapus.
Batas 5 MB per berkas dengan validasi tipe. Pada purwarupa foto disimpan di
memori peramban (belum ada backend).

### Cetak barcode
Dua jenis label, keduanya menghasilkan simbol yang **benar-benar dapat dipindai**:

- **Label BMN (baku)** — kode lokasi/satker, tahun perolehan, kode barang, dan NUP,
  disertai Code 128 dan QR. Susunannya dikunci agar seragam antar satuan kerja;
  yang dapat diubah hanya ukuran label dan tampil/tidaknya QR.
- **Label internal (kustom)** — pengguna mengatur sendiri: ukuran label (mm) atau
  preset, padding, bingkai, teks kepala, **elemen isi yang ditampilkan beserta
  urutan, ukuran huruf, dan ketebalannya**, jenis kode (Code 128 / QR / keduanya /
  tanpa kode), posisi kode, tinggi barcode, ukuran QR, serta **pola muatan barcode**
  memakai token (`{KODE_INTERNAL}`, `{BMN_ID}`, `{NUP}`, `{URL}`, …).
  Template dapat disimpan dan dipakai ulang.

Pratinjau ditampilkan dalam skala 1:1 dan memberi peringatan bila isi melebihi
tinggi label atau terpotong mendatar. Lembar cetak disusun otomatis pada A4
dengan jumlah kolom/baris menyesuaikan ukuran label.

**Encoder ditulis sendiri, tanpa pustaka pihak ketiga** (`assets/js/barcode.js`):
Code 128 subset B, dan QR Code mode byte ECC level M versi 1–6. Keduanya diuji
dengan cara membalik prosesnya — SVG dirender ke kanvas lalu dibaca ulang
memakai decoder independen (ZXing untuk Code 128, jsQR untuk QR), termasuk
barcode yang sudah tercetak di dalam label.

## Alur interaktif yang dapat dicoba

- **Wizard booking ruangan** (5 langkah) — `#/booking/new`
  Waktu & kebutuhan → pencarian ruangan dengan validasi kapasitas dan deteksi bentrok →
  pemilihan layout & add-on berbiaya → agenda & peserta → ringkasan biaya dan alur persetujuan.
  Alur approval berubah otomatis: gratis → *PIC*; berbayar → *PIC → Finance*.
- **Timeline ketersediaan** — `#/availability` dan `#/calendar`, termasuk blokir otomatis oleh maintenance.
- **Drawer detail** — booking, ruangan, laboratorium, alat, aset, peminjaman, quotation.
- **Kotak persetujuan** — `#/approval`, setujui/tolak dengan catatan dan penanda pelanggaran SLA.
- **AI Assistant** — `#/ai`, tujuh skenario jawaban (cari ruangan, konflik jadwal, utilisasi,
  aset idle, maintenance, draf MoM, ringkasan laporan).
- **Ganti peran** — klik profil di kanan atas untuk berpindah peran demo.
- **Mode gelap**, **pencarian global** (`Ctrl/⌘ + K`), **scan QR**, dan **pusat notifikasi**.

---

## Catatan teknis

- **Tanpa dependensi eksternal.** Ikon berupa SVG inline; grafik (area, bar, donut, heatmap,
  sparkline) serta barcode Code 128 dan QR Code digambar sebagai SVG buatan sendiri;
  font memakai *system font stack*. Tidak ada permintaan jaringan ke pihak ketiga.
- **Tema.** Token warna terang/gelap pada `:root` dan `html[data-theme="dark"]`, dengan blok
  penyesuaian kontras khusus mode gelap. Pilihan tema disimpan di `localStorage`.
- **Responsif.** Diuji pada 1440 px hingga 390 px tanpa *horizontal overflow*; sidebar menjadi
  laci geser di bawah 900 px, tabel lebar bergulir dalam wadahnya sendiri.
- **Tanggal relatif.** Seluruh data contoh dihasilkan relatif terhadap tanggal hari ini,
  sehingga kalender dan daftar jatuh tempo selalu tampak hidup kapan pun purwarupa dibuka.
- **Batasan purwarupa.** Tidak ada backend, autentikasi, maupun penyimpanan data. Tombol yang
  belum memiliki layar tujuan menampilkan notifikasi bahwa aksi tersebut disimulasikan.
