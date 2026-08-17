# BACKEND.md
## FLMS · Pemilihan dan Fondasi Backend

Dokumen keputusan: tumpukan teknologi backend, alasannya, bukti yang mendasarinya,
dan fondasi yang sudah berjalan.

> **Status.** Fondasi sudah dibangun dan lulus uji di lingkungan pengembangan.
> Belum diterapkan ke server produksi — lihat §6 dan §8.

---

## 1. Keputusan

| Lapisan | Pilihan | Versi |
|---|---|---|
| Bahasa & runtime | **PHP** di bawah LiteSpeed `lsapi` | 8.3 |
| Framework | **Laravel** | 13.25 |
| Basis data | **PostgreSQL** | 16 |
| Autentikasi | Laravel Sanctum (sesi cookie untuk SPA) | 4.3 |
| Otorisasi | `spatie/laravel-permission` | 8.3 |
| Antrean & penjadwal | Antrean basis data + cron cPanel | — |
| Antarmuka | SPA yang sudah ada, dipertahankan | — |

Alasannya diringkas dalam satu kalimat: **pilihan ini yang paling sedikit
bagian bergeraknya di hosting yang Anda pakai sekarang**, dan itulah yang
menentukan mudah-tidaknya dirawat.

---

## 2. Bukti dari Hosting Anda Sendiri

Rekomendasi ini tidak diambil dari selera umum, melainkan dari survei langsung
akun cPanel Anda.

| Yang diperiksa | Hasil |
|---|---|
| Penangan PHP untuk subdomain | `lsapi` (LiteSpeed) — PHP kelas satu, tanpa proses terpisah |
| Runtime lain yang diizinkan | `node`, `bun`, `deno` (Python dan Go **tidak** aktif) |
| Versi Node tersedia | 26.7.0, 25.9.0, 24.19.0 |
| MySQL | MariaDB 11.4.12 |
| PostgreSQL | **16.14, tersedia**, sudah dipakai 2 basis data |
| Cron | Aktif, sudah dipakai belasan tugas |

Karena Python dan Go tidak diaktifkan, pilihan nyatanya hanya **PHP** atau
**Node/Bun/Deno**.

### 2.1 Perbandingan yang sudah terjadi di akun Anda

Akun Anda sudah menjalankan kedua pola itu, dan selisih perawatannya terlihat
langsung di daftar cron:

**Pola Laravel** — `koperasi-app`, dua baris cron, selesai:

```
*/6 * * * * cd ~/koperasi-app && php83 artisan schedule:run
*/7 * * * * cd ~/koperasi-app && php83 artisan queue:work --stop-when-empty --tries=3 --max-time=280
```

**Pola Node** — `vantik-app` dan `qhse`, butuh perkakas tambahan:

```
*/9 * * * * /bin/bash ~/vantik-runner.sh          # menjaga proses tetap hidup
*/9 * * * * /bin/bash ~/vantik-verify.sh          # memeriksa proses masih hidup
*/7 * * * * [ -f ~/vantik-restart.request ] && kill $(cat ~/vantik.pid) …
*/10 * * * * curl -X POST 127.0.0.1:3200/…/scheduler/run -H "X-Scheduler-Token: …"
```

Node di hosting bersama menuntut manajemen proses yang diurus sendiri: berkas
PID, skrip penjaga, skrip pemeriksa, permintaan restart, nomor porta, dan token
penjadwal. Laravel di bawah `lsapi` tidak punya proses yang perlu dijaga hidup —
permintaan web dilayani PHP-FPM/LiteSpeed, sedangkan pekerjaan latar dijalankan
cron lalu berhenti sendiri.

Itu bukan soal bahasa mana yang lebih baik. Di server dengan systemd atau
kontainer, Node setara. Di **hosting cPanel bersama**, PHP menang jelas pada
kriteria yang Anda minta: mudah dirawat.

### 2.2 Pertimbangan lain

- **Ketersediaan orang.** Laravel adalah kerangka kerja web dengan komunitas
  terbesar di Indonesia. Mencari pengembang penerus jauh lebih mudah.
- **Kelengkapan bawaan.** Migrasi, antrean, penjadwal, surel, otorisasi, dan
  validasi sudah satu paket. Tidak perlu memilih dan merawat sepuluh pustaka
  lepas yang harus dicocokkan versinya sendiri.
- **Preseden internal.** Sudah ada satu aplikasi Laravel berjalan di akun ini,
  sehingga pola penerapannya terbukti, bukan percobaan baru.

---

## 3. Mengapa PostgreSQL, Bukan MariaDB

Anda menawarkan keduanya. Rekomendasinya **PostgreSQL**, dengan satu alasan
teknis yang menentukan dan sudah dibuktikan, bukan diasumsikan.

### 3.1 Masalahnya: bentrok jadwal

Aplikasi ini intinya penjadwalan. Kegagalan yang paling terasa oleh pengguna
adalah dua orang mendapat ruangan yang sama di waktu yang sama.

Cara biasa menanganinya adalah memeriksa dulu lalu menyimpan:

```
1. SELECT … apakah ada yang bentrok?   → tidak ada
2. INSERT booking
```

Dua langkah itu **terpisah**. Bila dua permintaan datang bersamaan, keduanya
menjalankan langkah 1 sebelum salah satu menjalankan langkah 2, sehingga
keduanya melihat slot kosong dan keduanya menyimpan.

### 3.2 Bukti bahwa celah itu nyata

Diuji pada PostgreSQL 16 dengan dua sesi bersamaan, tanpa batasan basis data
keduanya akan tersimpan:

```
SESI A                          SESI B
BEGIN                           BEGIN
A_melihat_bentrok = 0           B_melihat_bentrok = 0     ← keduanya melihat kosong
INSERT 09:00–11:00              INSERT 10:00–12:00
COMMIT                          ERROR: conflicting key value violates
                                       exclusion constraint "bookings_no_overlap"
                                ROLLBACK

Isi akhir tabel: 1 baris.
```

Perhatikan kedua sesi memang sama-sama melihat `0` bentrok — validasi aplikasi
memang tertembus. Yang menyelamatkan adalah batasan di basis data.

### 3.3 Bagaimana PostgreSQL menutupnya

```sql
ALTER TABLE bookings
ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (room_id WITH =, periode WITH &&)
WHERE (status NOT IN ('dibatalkan', 'ditolak'));
```

Satu baris, dijaga di titik penulisan, tidak bisa dilewati oleh kode aplikasi
mana pun — termasuk impor data, skrip perbaikan manual, dan pengembang baru yang
belum tahu aturannya.

**MariaDB tidak memiliki batasan eksklusi.** Padanan yang harus ditulis sendiri
adalah mengunci baris ruangan (`SELECT … FOR UPDATE`) di setiap jalur yang
menulis jadwal, lalu memeriksa di dalam kunci itu. Cara itu bisa benar, tetapi
kebenarannya bergantung pada disiplin: satu jalur tulis yang lupa mengunci sudah
cukup untuk mengembalikan celahnya, dan celah balapan tidak muncul saat diuji
manual — hanya saat aplikasi ramai.

### 3.4 Keuntungan lain yang relevan untuk aplikasi ini

| Kebutuhan aplikasi | PostgreSQL | MariaDB 11.4 |
|---|---|---|
| Anti-bentrok jadwal di basis data | `EXCLUDE USING gist` | tidak ada padanannya |
| Tata letak dashboard & template label (JSON) | `jsonb`, dapat diindeks GIN | JSON = alias LONGTEXT |
| Pencarian global | pencarian teks penuh bawaan | lebih terbatas |
| Kolom turunan yang mustahil menyimpang | `GENERATED … STORED` | ada, lebih terbatas |

### 3.5 Konsekuensi yang harus diterima

Supaya jujur, ini biayanya:

- Perkakas cPanel untuk PostgreSQL lebih tipis daripada MySQL — tidak ada
  phpMyAdmin. Administrasi lewat `psql`, atau pgAdmin dari komputer sendiri.
- Lebih banyak pengembang lokal terbiasa MySQL. Namun Laravel menyembunyikan
  hampir seluruh perbedaannya; yang khas PostgreSQL hanya tiga migrasi.
- Prosedur pencadangan berbeda (`pg_dump`, bukan `mysqldump`) — sudah dicatat
  untuk dimasukkan ke RUNBOOK saat penerapan.

Bila di kemudian hari Anda tetap memilih MariaDB, yang perlu diganti hanya
migrasi anti-bentrok dan kode yang mengurus penguncian. Sisa aplikasinya tidak
terpengaruh.

---

## 4. Yang Sudah Dibangun

Fondasi berjalan, bukan rancangan di atas kertas. Satu irisan tegak lurus
dikerjakan penuh — dari migrasi sampai HTTP — justru pada bagian tersulitnya,
supaya jaminan intinya terbukti lebih dulu.

```
backend/
├── app/
│   ├── Models/{Room,Booking,User}.php
│   ├── Services/BookingService.php          menerjemahkan galat basis data → pesan pengguna
│   ├── Http/Requests/StoreBookingRequest.php
│   ├── Http/Resources/BookingResource.php
│   └── Http/Controllers/Api/BookingController.php
├── database/migrations/                      btree_gist, rooms, bookings + batasan
├── database/factories/{RoomFactory,BookingFactory}.php
├── routes/api.php
└── tests/Feature/{BookingConflictTest,BookingApiTest,BookingRaceConditionTest}.php
```

### 4.1 Hasil uji

```
16 uji lulus, 37 asersi, 0 gagal — dijalankan di PostgreSQL 16
```

`phpunit.xml` sengaja diarahkan ke PostgreSQL, **bukan** SQLite in-memory bawaan
Laravel. Bila uji berjalan di SQLite, batasan eksklusi dan kolom `GENERATED`
tidak ada di sana, sehingga seluruh uji akan lulus tanpa menguji satu pun hal
yang jadi alasan pemilihan basis datanya.

Yang dijamin oleh uji tersebut:

| Uji | Yang dijaga |
|---|---|
| Tumpang tindih sebagian ditolak | pesan menyebut pemesanan yang bentrok, bukan galat teknis |
| Pemakaian berurutan diizinkan | 08–12 dan 12–14 bukan bentrok (rentang `[)`) |
| Ruangan berbeda, waktu sama | tidak salah menolak |
| Pemesanan dibatalkan | tidak lagi memblokir slot |
| `selesai > mulai` | dijaga `CHECK`, bukan hanya validasi borang |
| `periode` tetap `GENERATED` | menjaga kolom tidak diubah jadi kolom biasa di masa depan |
| **Dua penulisan bersamaan** | hanya satu bertahan, walau keduanya lolos pemeriksaan |
| API: tamu ditolak | `401`, tidak ada baris tersimpan |
| API: bentrok | `422` dengan pesan berbahasa Indonesia |

### 4.2 Catatan rancangan

- **`periode` dihitung basis data.** Kolom `tstzrange` dibuat
  `GENERATED ALWAYS AS (tstzrange(mulai, selesai, '[)')) STORED`, sehingga kode
  aplikasi tetap memakai `mulai`/`selesai` biasa dan tidak perlu tahu tipe
  rentang PostgreSQL — sekaligus mustahil menyimpan `periode` yang tidak cocok.
- **Galat basis data diterjemahkan, bukan dibocorkan.** `BookingService`
  menangkap SQLSTATE `23P01` lalu mengubahnya menjadi galat validasi biasa;
  galat basis data lain **diteruskan apa adanya** supaya masalah sungguhan tidak
  tersamarkan menjadi "jadwal bentrok".
- **Validasi aplikasi tetap ada,** tapi perannya hanya mempercepat pesan.
  Komentar di kodenya menyatakan tegas bahwa jaminannya ada di basis data,
  agar tidak ada yang menghapus batasannya karena merasa validasi sudah cukup.

---

## 5. Kerangka Kerja Ini Menjawab Kebutuhan yang Sudah Ada

| Kebutuhan dari dokumen fitur | Cara Laravel menjawabnya |
|---|---|
| Notifikasi surel seluruh jadwal | `Mailable` berantre + `schedule:run` lewat cron |
| Persetujuan berjenjang | mesin status + `spatie/laravel-permission` |
| Jejak audit | `spatie/laravel-activitylog` (belum dipasang) |
| Unggah foto peralatan | `Storage` + disk privat di luar docroot |
| 12 peran, matriks izin | peran & izin basis data, `Policy` per modul |
| Ekspor PDF/Excel | pekerjaan berantre, hasil disimpan ke disk privat |

---

## 6. Topologi Penerapan yang Direncanakan

Ini bagian yang **wajib** benar sejak awal, karena satu kesalahan di sini
membocorkan seluruh konfigurasi.

Docroot subdomain sekarang diisi `git reset --hard` dari akar repositori.
Bila aplikasi Laravel diletakkan di dalam docroot, maka `.env` — berisi kunci
aplikasi, sandi basis data, dan kredensial SMTP — akan berada di dalam wilayah
yang dilayani web.

Rencananya mengikuti pola `koperasi-app` yang sudah terbukti di akun ini:

```
/home/semestat/lab.semestateknologiutama.com/    docroot  → SPA statis (seperti sekarang)
/home/semestat/lab-api/                          DI LUAR docroot → aplikasi Laravel
   ├── .env                                      tidak pernah terlayani web
   ├── storage/                                  unggahan privat
   └── public/                                   ← docroot api.lab.semestateknologiutama.com
```

- API memakai subdomain sendiri `api.lab.semestateknologiutama.com` yang
  docroot-nya diarahkan ke `lab-api/public`.
- Sanctum memakai cookie sesi, jadi `SESSION_DOMAIN` disetel
  `.lab.semestateknologiutama.com` agar SPA dan API dianggap satu situs dan
  tidak terkena pembatasan cookie pihak ketiga.
- Antrean dan penjadwal memakai dua baris cron, meniru `koperasi-app`.

Sebagai lapis kedua, `.htaccess` di docroot sudah menutup `^/backend/`,
sehingga andaikan direktori itu suatu saat ikut tersalin ke docroot, isinya
tetap tidak terlayani.

---

## 7. Cara Menjalankan di Komputer Sendiri

```bash
cd backend
composer install
cp .env.example .env && php artisan key:generate

# PostgreSQL
createdb labdev
php artisan migrate

# Uji — perlu basis data terpisah
createdb labtest_phpunit
php artisan test
```

`composer config platform.php 8.3.0` sudah disetel di `composer.json`, sehingga
`vendor/` yang terbentuk selalu cocok dengan PHP 8.3 di server walau komputer
pengembang memakai versi lebih baru. Ini bukan detail sepele: bawaan Laravel 13
menarik Symfony 8 yang menuntut PHP ≥ 8.4.1 dan **tidak akan jalan** di server
Anda.

---

## 8. Langkah Berikutnya

Berurutan, masing-masing menghasilkan sesuatu yang dapat diuji:

1. **Autentikasi lengkap** — masuk, keluar, ganti sandi, batas percobaan gagal
2. **Peran & izin** — 12 peran diisi, `Policy` per modul, uji per peran
3. **Master data** — ruangan, laboratorium, peralatan, aset BMN (impor kode barang resmi)
4. **Modul jadwal sisanya** — peminjaman alat, maintenance, kalibrasi, agenda; semuanya memakai pola anti-bentrok yang sama
5. **Notifikasi surel** — antrean, templat, ringkasan harian, preferensi per pengguna
6. **Checklist** — templat, penugasan, pelaksanaan, riwayat
7. **Dashboard & BSC** — penyimpanan tata letak, snapshot KPI
8. **SPA disambungkan** — `data.js` fiktif diganti panggilan API sesungguhnya
9. **Penerapan** — subdomain API, cron, pencadangan `pg_dump`, pemantauan

Penghalang rilis di [README dokumentasi](README.md) tetap berlaku. Yang sudah
teratasi oleh pekerjaan ini hanyalah fondasi anti-bentrok jadwal; sembilan
langkah di atas belum.
