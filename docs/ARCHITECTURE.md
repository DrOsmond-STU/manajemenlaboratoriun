# ARCHITECTURE — Arsitektur Sistem
## FLMS · Facility, Laboratory & Meeting Management System

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Status** | Purwarupa: klien-saja · Produksi: rancangan target |
| **Dokumen terkait** | [PRD.md](PRD.md) · [SECURITY.md](SECURITY.md) · [DEPLOYMENT.md](DEPLOYMENT.md) · [TESTING.md](TESTING.md) |

---

## 1. Dua Arsitektur

Dokumen ini menjelaskan **dua hal yang berbeda** dan tidak boleh tertukar:

- **§2–§5 — Arsitektur purwarupa saat ini.** Nyata, berjalan, dan sudah dipasang di
  `lab.semestateknologiutama.com`. Sepenuhnya di sisi klien.
- **§6–§13 — Arsitektur produksi yang diusulkan.** Belum dibangun. Ini adalah
  rancangan yang harus disetujui sebelum pengembangan dimulai.

---

# BAGIAN A — ARSITEKTUR PURWARUPA (BERJALAN)

## 2. Gambaran

```
┌──────────────────────────────────────────────────────────────┐
│  Peramban pengguna                                           │
│                                                              │
│  index.html ──(localStorage: peran & nama)──> app.html       │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ app.js — shell, navigasi, hash router                  │  │
│  │   ├── VIEWS{}  63 rute, tiap rute { title, render() }  │  │
│  │   ├── UI       ikon, format, tabel, chart, modal       │  │
│  │   ├── DASH     mesin widget dashboard                  │  │
│  │   ├── Barcode  encoder Code 128 & QR                   │  │
│  │   └── DB       dataset statis dalam memori             │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                   │
│                   localStorage                               │
│        tema · peran · susunan dashboard · template label     │
└──────────────────────────────────────────────────────────────┘
                           │
                    HTTPS (statis)
                           │
┌──────────────────────────────────────────────────────────────┐
│  Apache di cPanel — hanya melayani berkas statis              │
│  docroot: /home/semestat/lab.semestateknologiutama.com        │
│  .htaccess: HTTPS, gzip, cache, header keamanan, blokir .git  │
└──────────────────────────────────────────────────────────────┘
```

**Tidak ada** server aplikasi, basis data, sesi server, maupun API.

## 3. Struktur Berkas

| Berkas | Baris | Tanggung jawab |
|---|---:|---|
| `index.html` | — | Halaman masuk + pemilih peran demo |
| `app.html` | — | Kerangka SPA, memuat seluruh skrip |
| `assets/css/app.css` | 920 | Design system: token, komponen, mode gelap, responsif, cetak |
| `assets/js/data.js` | 722 | Dataset dummy + referensi BMN (kodefikasi, satker, template label) |
| `assets/js/data-ext.js` | 368 | Balanced Scorecard, checklist, aturan notifikasi email |
| `assets/js/barcode.js` | 366 | Encoder Code 128 (subset B) dan QR (byte, ECC M, versi 1–6) |
| `assets/js/ui.js` | 422 | Ikon SVG, formatter, tabel, chart, modal/drawer/toast |
| `assets/js/dash.js` | 849 | Mesin widget: sumber data, tipe visual, seret-lepas, ubah ukuran |
| `assets/js/views-core.js` | 643 | Kalender, ketersediaan, wizard booking, reservasi alat |
| `assets/js/views-facility.js` | 579 | Laboratorium, alat, kalibrasi, pemeliharaan, ruangan, auditorium |
| `assets/js/views-business.js` | 931 | Aset, penyewaan, penagihan, event, SDM, dokumen, laporan |
| `assets/js/views-admin.js` | 480 | Persetujuan, workflow, hak akses, master data, audit, AI Assistant |
| `assets/js/views-bmn.js` | 977 | Register BMN, registrasi peralatan + foto, studio label |
| `assets/js/views-dash.js` | 280 | Rute dashboard: operasional, manajemen, analitik, BSC |
| `assets/js/views-checklist.js` | 524 | Template, pembuat checklist, Checklist Saya, pelaksanaan |
| `assets/js/views-notif.js` | 434 | Notifikasi email seluruh jadwal, ringkasan harian |
| `assets/js/app.js` | 327 | Navigasi, breadcrumb, router, notifikasi, tema, profil |

Total ± 8.800 baris; ± 584 KB tanpa kompresi, ± 130 KB setelah gzip.

## 4. Pola Utama

**Router berbasis hash.** `location.hash` → `VIEWS[id].render()` → `innerHTML`.
Dipilih agar berjalan pada hosting statis tanpa aturan rewrite.

**View sebagai objek.**
```js
VIEWS["equipment"] = {
  title: "Manajemen Alat Laboratorium",
  sub:   "Registrasi, status, kondisi, kalibrasi…",
  actions: `<button …>`,
  render() { return html; },
  mount() { /* opsional, dijalankan setelah render */ }
};
```

**Render berbasis string.** Seluruh tampilan disusun sebagai template literal lalu
dipasang dengan `innerHTML`. Semua nilai dari data dilewatkan `UI.esc()`.
Konsekuensi keamanannya dibahas di [SECURITY.md §8](SECURITY.md#8-kerentanan-purwarupa-saat-ini).

**Mesin widget.** `DASH` memisahkan tiga hal: **sumber data** (25 dataset),
**metrik** (21 angka KPI), dan **tipe visual** (15 bentuk). Widget hanyalah
konfigurasi `{ id, type, source|metric, w, h, title, … }`, sehingga mengganti bentuk
tampilan tidak menyentuh data dan sebaliknya.

**Encoder barcode mandiri.** Code 128 dan QR digambar sendiri sebagai SVG tanpa
pustaka pihak ketiga, dan diverifikasi dengan cara dibaca ulang oleh decoder
independen — lihat [TESTING.md §5](TESTING.md).

## 5. Batasan yang Disengaja

| Batasan | Alasan | Konsekuensi produksi |
|---|---|---|
| Tanpa proses build | Purwarupa dapat dibuka langsung, mudah ditinjau | Produksi perlu bundling & minifikasi |
| Tanpa framework | Bebas dari pembaruan dependensi selama masa tinjau | Produksi sebaiknya memakai framework berkomponen |
| Data dalam memori | Tidak perlu backend untuk peragaan | Seluruh data harus dipindah ke basis data |
| `localStorage` untuk preferensi | Cukup untuk satu perangkat | Preferensi harus pindah ke server |
| Tanpa autentikasi | Fokus pada alur, bukan keamanan | Wajib dibangun sebelum data nyata masuk |

---

# BAGIAN B — ARSITEKTUR PRODUKSI (USULAN)

## 6. Gambaran Target

```
                        ┌───────────────┐
   Pengguna ───HTTPS──► │ Reverse proxy │  TLS, WAF, rate limit
                        │  (nginx)      │
                        └───────┬───────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
      ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
      │  Web (SPA)   │  │  API server  │  │  Berkas      │
      │  statis/CDN  │  │  REST + auth │  │  object store│
      └──────────────┘  └──────┬───────┘  └──────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │ PostgreSQL   │ │ Redis        │ │ Antrean +    │
      │ data utama   │ │ cache, sesi  │ │ penjadwal    │
      └──────────────┘ └──────────────┘ └──────┬───────┘
                                               │
                                        ┌──────▼───────┐
                                        │ Worker       │
                                        │ email, PDF,  │
                                        │ pengingat    │
                                        └──────┬───────┘
                                               │
                              ┌────────────────┼──────────────┐
                              ▼                ▼              ▼
                          SMTP relay     WhatsApp API    SSO / HRIS
```

## 7. Komponen

| Komponen | Tanggung jawab | Catatan pemilihan |
|---|---|---|
| **Reverse proxy** | TLS, kompresi, batas laju, header keamanan | nginx atau Caddy |
| **Web SPA** | Antarmuka; hasil build dari kode purwarupa yang dimodularkan | Framework ditentukan tim; lihat ADR-02 |
| **API server** | Aturan bisnis, otorisasi, validasi, audit | Satu layanan monolit modular — lihat ADR-01 |
| **PostgreSQL** | Sumber kebenaran seluruh data transaksional | Perlu transaksi & kunci untuk cegah bentrok |
| **Redis** | Cache baca, sesi, kunci antrean | Opsional pada skala awal |
| **Antrean + penjadwal** | Pengingat, ringkasan harian, pembuatan PDF | Wajib; notifikasi tidak boleh membebani permintaan pengguna |
| **Object storage** | Foto barang, bukti checklist, dokumen PDF | Di luar docroot; akses lewat URL bertanda tangan |
| **SMTP relay** | Pengiriman email | Domain pengirim khusus + SPF/DKIM/DMARC |

## 8. Model Data

Enam kelompok, mengikuti rekomendasi dokumen kebutuhan:

**Master** — `users`, `roles`, `organizations`, `locations`, `buildings`, `floors`,
`rooms`, `laboratories`, `equipment`, `assets`, `vendors`, `people`,
`bmn_code_master`, `price_lists`, `packages`, `addons`

**Transaksi** — `bookings`, `booking_items`, `booking_addons`,
`equipment_reservations`, `loans`, `loan_inspections`, `events`, `agendas`, `visitors`

**Komersial** — `quotations`, `invoices`, `invoice_lines`, `payments`, `refunds`

**Operasi** — `maintenance_orders`, `calibrations`, `checklist_templates`,
`checklist_items`, `checklist_tasks`, `checklist_records`, `checklist_answers`,
`handovers`

**Tata kelola** — `approvals`, `approval_steps`, `workflows`, `notifications`,
`email_queue`, `email_events`, `documents`, `audit_logs`

**Analitik** — `dashboards`, `dashboard_widgets`, `bsc_perspectives`,
`bsc_objectives`, `bsc_kpis`, `kpi_snapshots`, `label_templates`

### Entitas kunci

**`assets` / `equipment` — identitas ganda**
```
id                 uuid    PK internal
kode_lokasi        text    NOT NULL   -- kode satker/UAKPB
kode_barang        text    NOT NULL   -- 10 digit, FK ke bmn_code_master
nup                integer NOT NULL   -- urut per (kode_lokasi, kode_barang)
kode_internal      text    NOT NULL UNIQUE
…
UNIQUE (kode_lokasi, kode_barang, nup)   -- kunci utama BMN
```
NUP diterbitkan lewat transaksi dengan `SELECT … FOR UPDATE` pada baris penghitung
per `(kode_lokasi, kode_barang)`, bukan `MAX(nup)+1` biasa, agar tidak bentrok saat
registrasi bersamaan.

**`bookings` — pencegahan bentrok**
```
resource_type   text        -- room | laboratory | equipment
resource_id     uuid
periode         tstzrange   -- rentang waktu
status          text
EXCLUDE USING gist (
  resource_id WITH =,
  periode     WITH &&
) WHERE (status IN ('approved','in_use'))
```
Batasan eksklusi PostgreSQL menjamin tidak ada dua booking aktif yang beririsan pada
resource yang sama — dijamin basis data, bukan hanya validasi aplikasi.

**`audit_logs`** — hanya sisip, memuat `actor`, `action`, `entity`, `entity_id`,
`before`, `after`, `ip`, `user_agent`, `at`.

## 9. Modul & Batas Konteks

| Modul | Milik data | Antarmuka ke modul lain |
|---|---|---|
| Identitas & Akses | users, roles, permissions | menyediakan konteks pengguna |
| Master Fasilitas | rooms, laboratories, buildings | menyediakan resource |
| Aset & BMN | assets, equipment, bmn_code_master | menyediakan resource + nilai |
| Penjadwalan | bookings, reservations, agendas | memanggil Persetujuan & Notifikasi |
| Persetujuan | approvals, workflows | menerbitkan peristiwa keputusan |
| Operasi | maintenance, calibrations, checklists | memblokir resource, memicu work order |
| Komersial | quotations, invoices, payments | membaca tarif, menulis tagihan |
| Notifikasi | email_queue, notifications | berlangganan peristiwa modul lain |
| Analitik | dashboards, bsc, snapshots | hanya membaca |

Komunikasi antar modul lewat **peristiwa domain** (`booking.approved`,
`checklist.finding_raised`, `calibration.due_soon`), bukan pemanggilan langsung.
Notifikasi menjadi pelanggan peristiwa, sehingga menambah kanal baru tidak menyentuh
modul penjadwalan.

## 10. Alur Kritis

### 10.1 Booking ruangan
```
Pemohon → API: POST /bookings
  ├─ validasi kapasitas terhadap jumlah peserta
  ├─ cek pemeliharaan yang memblokir resource
  ├─ mulai transaksi
  │    └─ sisip booking (batasan eksklusi menolak bila bentrok)
  ├─ pilih workflow: tarif 0 → PIC; > 0 → PIC → Keuangan
  ├─ terbitkan peristiwa booking.submitted
  └─ commit
Worker ← peristiwa → kirim email ke PIC + in-app ke pemohon
```
Deteksi bentrok wajib berada **di dalam transaksi**. Memeriksa lebih dulu lalu
menyisipkan setelahnya membuka celah balapan saat dua orang memesan bersamaan.

### 10.2 Pelaksanaan checklist
```
Petugas menyelesaikan checklist
  ├─ validasi butir wajib
  ├─ simpan record + jawaban + lampiran
  ├─ hitung skor
  └─ bila ada butir tidak sesuai → sesuai konfigurasi template:
       notifikasi  → peristiwa checklist.finding_raised
       work order  → buat maintenance_order otomatis
       blokir      → set resource.blocked_until + tolak booking baru
```

### 10.3 Notifikasi email berjadwal
```
Penjadwal (tiap 5 menit)
  └─ kumpulkan jadwal yang jatuh pada jendela pengiriman
       (H-90, H-30, H-7, H-3, H-1, hari-H, T-1 jam, H+1)
  └─ untuk tiap jadwal → tentukan penerima (PIC, tembusan)
  └─ masukkan ke email_queue dengan kunci idempoten
       (event_key + recipient + send_slot)
Worker email
  └─ ambil batch, render template, kirim via SMTP
  └─ catat status; gagal → coba ulang dengan jeda menaik (maks 3×)

Penjadwal (setiap hari 06.30)
  └─ untuk tiap PIC → susun ringkasan harian → satu email
```
Kunci idempoten mencegah pengingat ganda ketika penjadwal berjalan dua kali —
kasus yang pasti terjadi saat penerapan ulang atau mulai ulang layanan.

## 11. Keputusan Arsitektur (ADR Ringkas)

**ADR-01 · Monolit modular, bukan microservice**
*Konteks:* satu satuan kerja, ± 300 pengguna, tim kecil.
*Keputusan:* satu layanan API dengan batas modul yang tegas.
*Alasan:* biaya operasi microservice tidak sebanding pada skala ini; batas modul
tetap dijaga agar pemecahan di kemudian hari tetap mungkin.
*Konsekuensi:* penerapan sederhana; disiplin batas modul harus dijaga lewat tinjauan kode.

**ADR-02 · SPA hasil build, bukan render sisi server**
*Konteks:* aplikasi internal di balik autentikasi; SEO tidak relevan.
*Keputusan:* SPA yang dibangun dari kode purwarupa yang dimodularkan.
*Alasan:* antarmuka sudah terbukti sebagai SPA; interaksi berat (seret-lepas, studio
label) lebih cocok di sisi klien.
*Konsekuensi:* butuh proses build; waktu muat pertama harus dipantau.

**ADR-03 · Batasan eksklusi basis data untuk bentrok jadwal**
*Konteks:* bentrok jadwal adalah kegagalan yang paling terasa oleh pengguna.
*Keputusan:* jaminan di lapisan basis data, bukan hanya validasi aplikasi.
*Alasan:* validasi aplikasi selalu punya celah balapan.
*Konsekuensi:* terikat pada PostgreSQL; pesan kesalahan perlu diterjemahkan ke bahasa pengguna.

**ADR-04 · Encoder barcode dipertahankan sendiri**
*Konteks:* purwarupa sudah memiliki encoder Code 128 & QR yang lolos uji decoder.
*Keputusan:* dipakai apa adanya, tidak diganti pustaka pihak ketiga.
*Alasan:* nol dependensi, ukuran kecil, sudah terverifikasi.
*Konsekuensi:* QR terbatas versi 1–6 (maks 106 byte); bila muatan lebih panjang
dibutuhkan, encoder perlu diperluas ke versi 7+.

**ADR-05 · Foto dan lampiran di object storage**
*Keputusan:* berkas tidak disimpan di basis data maupun di dalam docroot.
*Alasan:* ukuran basis data terkendali; mencegah eksekusi berkas yang diunggah.
*Konsekuensi:* butuh URL bertanda tangan berumur pendek.

## 12. Skalabilitas, Ketersediaan, Kinerja

| Aspek | Rancangan |
|---|---|
| Beban baca | Cache Redis untuk master data & agregat dashboard (TTL 60 detik) |
| Beban tulis | Puncak saat pagi (booking) dan 06.00–08.00 (checklist); antrean menyerap notifikasi |
| Dashboard | Agregat dihitung terjadwal ke `kpi_snapshots`, tidak dihitung tiap muat |
| Basis data | Indeks pada `(resource_id, periode)`, `(assignee, due)`, `(kode_lokasi, kode_barang)` |
| Berkas | Object storage terpisah; gambar diubah ukurannya saat unggah |
| Ketersediaan | Satu simpul cukup pada tahap awal; basis data dicadangkan harian |
| Peningkatan | API dan worker dapat digandakan secara mendatar bila perlu |

## 13. Migrasi Purwarupa → Produksi

| Langkah | Isi | Catatan |
|---|---|---|
| 1 | Bekukan purwarupa sebagai acuan visual & alur | Sudah dipasang, dapat diakses pemangku kepentingan |
| 2 | Modularkan berkas view menjadi komponen | Struktur `VIEWS` sudah mendekati komponen |
| 3 | Ganti `DB` statis dengan klien API | Bentuk data dipertahankan agar view minim perubahan |
| 4 | Pindahkan aturan bisnis ke server | Validasi kapasitas, bentrok, alur persetujuan, skor checklist |
| 5 | Pindahkan preferensi ke server | Susunan dashboard, template label, tema |
| 6 | Impor master kode barang BMN resmi | **Penghalang rilis** untuk modul aset |
| 7 | Bangun penjadwal + worker email | **Penghalang rilis** untuk notifikasi jadwal |
| 8 | Terapkan autentikasi & otorisasi | **Penghalang rilis** sebelum data nyata masuk |
| 9 | Migrasi data awal | Aset, pegawai, ruangan dari berkas klien |

Komponen purwarupa yang **dipakai langsung tanpa ditulis ulang**: `barcode.js`
(terverifikasi decoder), token & komponen CSS, mesin widget `dash.js`, dan seluruh
tata letak layar.

## 14. Sudut Pandang Penerapan

Lihat [DEPLOYMENT.md](DEPLOYMENT.md) untuk prosedur nyata purwarupa saat ini
(cPanel git deploy) dan rancangan pipeline produksi.
