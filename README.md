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

## Dokumentasi

Dokumen produk, teknis, dan operasional ada di **[`docs/`](docs/README.md)**:

| Dokumen | Isi |
|---|---|
| [PRD.md](docs/PRD.md) | Kebutuhan produk, pengguna, lingkup, kriteria penerimaan, rencana rilis |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arsitektur purwarupa & rancangan produksi, model data, alur kritis, ADR |
| [DESIGN.md](docs/DESIGN.md) | Token, komponen, pola antarmuka, aksesibilitas, bahasa |
| [SECURITY.md](docs/SECURITY.md) | Model ancaman, autentikasi, RBAC, perlindungan data, daftar periksa |
| [TESTING.md](docs/TESTING.md) | Strategi uji, suite yang ada, gerbang rilis |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Prosedur rilis purwarupa & rancangan pipeline produksi |
| [TASK_INSTRUCTIONS.md](docs/TASK_INSTRUCTIONS.md) | Konvensi kerja, resep menambah fitur, backlog menuju produksi |
| [RUNBOOK.md](docs/RUNBOOK.md) | Pemantauan, playbook insiden, pencadangan, rotasi rahasia |

> **Penting.** Yang berjalan hari ini adalah purwarupa antarmuka, bukan sistem produksi:
> tanpa backend, autentikasi, maupun basis data. Purwarupa **tidak boleh diisi data nyata**.
> Kelemahan yang diketahui didaftar apa adanya pada [SECURITY.md §8](docs/SECURITY.md).

---

## Pengujian

Uji otomatis memakai Playwright (Chromium headless). Detail pada [docs/TESTING.md](docs/TESTING.md).

```bash
npm install
npm test
```

`npm test` menjalankan server statis sendiri bila belum ada, lalu menjalankan tujuh suite:
asap (63 rute), overflow responsif, BMN, template label, label BMN, fitur dashboard/BSC/checklist/email,
serta uji barcode yang **memindai ulang** SVG Code 128 dan QR hasil render dan membandingkan
hasil dekode dengan data masukan.

---

## Struktur berkas

```
index.html                   Halaman masuk (login) + pemilih peran demo
app.html                     Shell aplikasi (SPA, hash router)
assets/css/app.css           Design system: token, komponen, mode gelap, responsif
assets/js/data.js            Dataset dummy + referensi BMN (kodefikasi, satker, template label)
assets/js/data-ext.js        Balanced Scorecard, checklist, dan aturan notifikasi email
assets/js/dash.js            Mesin dashboard widget (sumber data, tipe visual, drag & resize)
assets/js/barcode.js         Encoder Code 128 & QR Code (SVG, tanpa dependensi)
assets/js/ui.js              UI kit: ikon SVG, formatter, tabel, chart, modal/drawer/toast
assets/js/views-core.js      Dashboard, kalender, ketersediaan, wizard booking, reservasi alat
assets/js/views-facility.js  Laboratorium, alat, kalibrasi, maintenance, ruangan, auditorium, layout
assets/js/views-business.js  Aset, rental & billing, event, people, dokumen, laporan
assets/js/views-admin.js     Approval, workflow, role & hak akses, master data, audit trail, AI Assistant
assets/js/views-bmn.js       Register BMN, registrasi peralatan + foto, studio label & barcode
assets/js/views-dash.js      Dashboard operasional, manajemen, analitik kustom, Balanced Scorecard
assets/js/views-checklist.js Template checklist, pembuat checklist, Checklist Saya, pelaksanaan
assets/js/views-notif.js     Notifikasi email untuk seluruh jadwal + ringkasan harian per PIC
assets/js/app.js             Navigasi, breadcrumb, router, notifikasi, tema, profil
.htaccess                    Konfigurasi Apache untuk hosting statis
```

---

## Cakupan layar (63 rute)

| Kelompok | Layar |
|---|---|
| **Dashboard** | Dashboard Operasional, Dashboard Manajemen, **Dashboard Analitik** (dikelola sendiri), **Balanced Scorecard** |
| **Operations** | Kalender Terpadu, Daftar Booking, Booking Saya, Room Availability, Reservasi Alat, **Checklist Saya**, Approval |
| **Laboratory** | Laboratorium, Alat Laboratorium, **Registrasi Alat (BMN)**, Booking Alat, Kalibrasi, Maintenance, Jadwal Laboratorium |
| **Facility** | Ruangan, Ruang Rapat, Auditorium, Room Layout, Fasilitas & Add-on, Jadwal Fasilitas |
| **Asset** | Asset Register, **Register BMN (KIB B)**, **Label & Barcode**, Asset Movement, Peminjaman & Pengembalian, Asset Maintenance, Audit Aset |
| **Rental** | Permohonan Sewa, Daftar Tarif, Paket Layanan, Quotation, Invoice, Pembayaran |
| **Event** | Event, Agenda, Peserta, Vendor, Laporan Event |
| **People** | Pengguna, PIC, Teknisi & Operator, Pengunjung, Organisasi |
| **Document** | Dokumen & Berita Acara (BAST, sertifikat, perjanjian) |
| **Report** | Utilisasi, Ruangan, Alat, Aset, Penyewaan, Maintenance, Keuangan |
| **Administration** | Master Data, Workflow, Role & Hak Akses, **Checklist**, Notifikasi, **Notifikasi Email Jadwal**, Audit Trail, Pengaturan Sistem |
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

## Dashboard yang dapat disunting, BSC, checklist, dan notifikasi email

### Dashboard dapat disunting sepenuhnya
Klik **Sunting Dashboard** pada Dashboard Operasional, Dashboard Manajemen,
Dashboard Analitik, maupun Balanced Scorecard, lalu:

- **Ubah isi konten** — judul, keterangan, metrik atau sumber data, ikon, warna,
  jumlah baris yang ditampilkan, akhiran nilai, dan catatan kaki.
- **Ubah penampilan data** — 15 bentuk tampilan: kartu KPI, grafik garis/area,
  grafik batang, donat + legenda, batang mendatar, daftar peringkat, tabel,
  daftar ringkas, heatmap, panel peringatan, teks, dan empat widget khusus BSC.
  Sumber data yang cocok menyesuaikan otomatis saat tipe diganti.
- **Ubah ukuran** — lebar 2–12 kolom (dengan preset seperempat/sepertiga/setengah)
  dan tinggi 110–620 px, lewat penggeser di formulir **atau** dengan menyeret
  sudut kanan bawah widget langsung di dashboard.
- **Ubah susunan** — seret ikon kisi untuk memindahkan widget ke posisi mana pun.
- Tambah, duplikat, dan hapus widget; kembalikan susunan bawaan kapan saja.

Susunan disimpan di `localStorage` sehingga bertahan setelah halaman dimuat ulang.

Sumber data yang tersedia mencakup 25 dataset (utilisasi, pendapatan, biaya
maintenance, status alat, kondisi BMN, agenda, approval, kalibrasi, work order,
tugas checklist, antrean email, dan lainnya) serta 21 metrik untuk kartu KPI.

### Dashboard analitik yang dikelola sendiri
`#/analytics` — buat dashboard baru dari halaman kosong, beri nama dan ikon,
isi dengan widget pilihan sendiri, ganti nama, duplikat, atau hapus. Berpindah
antar dashboard lewat pemilih di bagian atas.

### Balanced Scorecard
`#/bsc` — empat perspektif Kaplan & Norton (Finansial; Pelanggan & Pengguna
Layanan; Proses Bisnis Internal; Pembelajaran & Pertumbuhan) dengan bobot,
sasaran strategis, dan 18 indikator kinerja. Skor KPI memperhatikan polaritas
(semakin besar/kecil semakin baik); skor perspektif adalah rata-rata tertimbang
KPI, dan skor keseluruhan rata-rata tertimbang perspektif. Dilengkapi peta
strategi sebab-akibat, tren enam bulan, serta panel **Kelola Sasaran & KPI**
untuk mengubah bobot, target, dan realisasi — seluruh widget langsung ikut
diperbarui.

### Checklist
`#/checklist` — enam jenis: **Pengecekan & Verifikasi, Perawatan, Persiapan
Penyewaan, Kebersihan, Kerapian, dan Kelayakan**. Seluruh template dibuat dan
dikelola pengguna melalui pembuat checklist: nama, jenis, sasaran (ruangan /
peralatan / keduanya), frekuensi, estimasi waktu, tindakan bila ada butir tidak
sesuai (kirim notifikasi, buat work order, atau blokir resource), daftar
resource yang dicek, penanggung jawab, serta butir pemeriksaan dengan enam
jenis isian (OK/Tidak/NA, skala 1–5, angka, teks, foto, tanda tangan), lengkap
dengan pengaturan wajib/opsional dan pengurutan.

Checklist **melekat pada pengguna**: `#/mychecklist` menampilkan tugas milik
pengguna yang sedang masuk. Saat dikerjakan, butir wajib divalidasi, temuan
menuntut uraian, dan hasilnya tersimpan sebagai riwayat berskor dengan tindak
lanjut otomatis. Checklist yang melekat pada sebuah resource juga tampil pada
drawer detail ruangan, laboratorium, dan alat.

### Notifikasi email seluruh jadwal
`#/emailsched` — setiap jadwal dari **delapan sumber** (booking ruangan,
reservasi alat, work order maintenance, jatuh tempo kalibrasi, pengembalian
pinjaman, tugas checklist, event, dan agenda) dipetakan ke email penanggung
jawabnya, lengkap dengan tembusan dan waktu pengiriman (H-90 hingga H+1).
Tersedia pengaturan aturan per peristiwa, pratinjau email HTML yang sebenarnya,
**ringkasan harian per penanggung jawab** pukul 06.30, antrean & riwayat kirim
dengan status buka, preferensi email tiap PIC, editor template bertoken, dan
pengaturan SMTP.

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
