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
assets/js/data.js            Dataset dummy (ruangan, lab, alat, aset, booking, billing, dst.)
assets/js/ui.js              UI kit: ikon SVG, formatter, tabel, chart, modal/drawer/toast
assets/js/views-core.js      Dashboard, kalender, ketersediaan, wizard booking, reservasi alat
assets/js/views-facility.js  Laboratorium, alat, kalibrasi, maintenance, ruangan, auditorium, layout
assets/js/views-business.js  Aset, rental & billing, event, people, dokumen, laporan
assets/js/views-admin.js     Approval, workflow, role & hak akses, master data, audit trail, AI Assistant
assets/js/app.js             Navigasi, breadcrumb, router, notifikasi, tema, profil
```

---

## Cakupan layar (55 rute)

| Kelompok | Layar |
|---|---|
| **Dashboard** | Dashboard Operasional, Dashboard Manajemen (KPI eksekutif) |
| **Operations** | Kalender Terpadu, Daftar Booking, Booking Saya, Room Availability, Reservasi Alat, Approval |
| **Laboratory** | Laboratorium, Alat Laboratorium, Booking Alat, Kalibrasi, Maintenance, Jadwal Laboratorium |
| **Facility** | Ruangan, Ruang Rapat, Auditorium, Room Layout, Fasilitas & Add-on, Jadwal Fasilitas |
| **Asset** | Asset Register, Asset Movement, Peminjaman & Pengembalian, Asset Maintenance, Audit Aset |
| **Rental** | Permohonan Sewa, Daftar Tarif, Paket Layanan, Quotation, Invoice, Pembayaran |
| **Event** | Event, Agenda, Peserta, Vendor, Laporan Event |
| **People** | Pengguna, PIC, Teknisi & Operator, Pengunjung, Organisasi |
| **Document** | Dokumen & Berita Acara (BAST, sertifikat, perjanjian) |
| **Report** | Utilisasi, Ruangan, Alat, Aset, Penyewaan, Maintenance, Keuangan |
| **Administration** | Master Data, Workflow, Role & Hak Akses, Notifikasi, Audit Trail, Pengaturan Sistem |
| **AI** | AI Assistant (percakapan bersimulasi) |

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

- **Tanpa dependensi eksternal.** Ikon berupa SVG inline, grafik (area, bar, donut, heatmap,
  sparkline) digambar sebagai SVG buatan sendiri, font memakai *system font stack*.
  Tidak ada permintaan jaringan ke pihak ketiga.
- **Tema.** Token warna terang/gelap pada `:root` dan `html[data-theme="dark"]`, dengan blok
  penyesuaian kontras khusus mode gelap. Pilihan tema disimpan di `localStorage`.
- **Responsif.** Diuji pada 1440 px hingga 390 px tanpa *horizontal overflow*; sidebar menjadi
  laci geser di bawah 900 px, tabel lebar bergulir dalam wadahnya sendiri.
- **Tanggal relatif.** Seluruh data contoh dihasilkan relatif terhadap tanggal hari ini,
  sehingga kalender dan daftar jatuh tempo selalu tampak hidup kapan pun purwarupa dibuka.
- **Batasan purwarupa.** Tidak ada backend, autentikasi, maupun penyimpanan data. Tombol yang
  belum memiliki layar tujuan menampilkan notifikasi bahwa aksi tersebut disimulasikan.
