# BACKEND.md
## FLMS · Pemilihan dan Fondasi Backend

Dokumen keputusan: tumpukan teknologi backend, alasannya, bukti yang mendasarinya,
dan fondasi yang sudah berjalan.

> **Status.** Berjalan di server pada
> `https://api.lab.semestateknologiutama.com` — lihat §6.
>
> **Modul yang berjalan (14):** autentikasi · peran & izin · cakupan data ·
> master data ruangan · master data laboratorium · pemesanan ruangan ·
> peminjaman alat · pemeliharaan & kalibrasi · checklist · persetujuan ·
> penyewaan & penagihan · notifikasi jadwal · aset BMN · impor master kode
> barang.
>
> **Belum boleh diisi data nyata**, dan alasannya bukan kekurangan modul:
> belum ada satu pun akun, master kode barang masih cuplikan contoh, dan
> SMTP belum disetel sehingga surel hanya masuk log. Lihat §8.

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

Bentuk paling ringkas adalah satu batasan eksklusi:

```sql
ALTER TABLE bookings
ADD CONSTRAINT bookings_no_overlap
EXCLUDE USING gist (room_id WITH =, periode WITH &&)
WHERE (status NOT IN ('dibatalkan', 'ditolak'));
```

**Tetapi bentuk itu tidak dapat dipakai di server Anda,** dan itu baru
ketahuan saat menyiapkan basis datanya:

```
SELECT name FROM pg_available_extensions;
→ plpgsql        ← hanya itu
```

PostgreSQL 16.14 di hosting ini tidak memasang satu pun ekstensi *contrib*.
`btree_gist` tidak tersedia, sehingga `room_id WITH =` tidak dapat digabung
dengan `periode WITH &&` di dalam satu indeks GiST.

**Penggantinya: pemicu plpgsql** yang mengambil kunci penasihat per ruangan
lebih dulu, lalu memeriksa tumpang tindih:

```sql
PERFORM pg_advisory_xact_lock(hashtext('flms:booking_room'), NEW.room_id::int);

IF EXISTS (SELECT 1 FROM bookings b WHERE b.room_id = NEW.room_id
             AND b.status NOT IN ('dibatalkan','ditolak')
             AND b.mulai < NEW.selesai AND b.selesai > NEW.mulai)
THEN RAISE EXCEPTION 'bookings_no_overlap: …' USING ERRCODE = '23P01';
END IF;
```

Yang dipertahankan dari bentuk aslinya adalah sifat yang paling penting:
aturannya hidup **di dalam basis data**, sehingga berlaku untuk semua jalur
tulis — impor massal, perintah artisan, maupun perbaikan manual lewat `psql`.
Kode galat dan penyebutan namanya disamakan, sehingga lapisan aplikasi tidak
perlu tahu mekanisme mana yang sedang dipakai.

Mekanisme ini dipakai di **semua** lingkungan, termasuk lingkungan
pengembangan yang sebenarnya punya `btree_gist`. Memakai dua mekanisme
berbeda antara tempat menguji dan tempat menjalankan berarti yang diuji
bukan yang dijalankan.

**Dibuktikan, bukan diasumsikan.** Pertanyaan yang menentukan: apakah
pemeriksaan di dalam pemicu melihat baris yang di-commit transaksi lain
*selagi* pemicu menunggu kunci? Bila tidak, celahnya tetap terbuka. Diuji
dengan dua sesi `psql` sungguhan — A menulis lalu menahan tiga detik, B
menulis yang tumpang tindih selagi A memegang kunci, A commit di tengah
penantian B:

```
ERROR:  bookings_no_overlap: ruangan sudah dipakai pada rentang waktu tersebut
CONTEXT:  PL/pgSQL function bookings_tolak_bentrok() line 20 at RAISE
baris tersimpan: 1
```

B menunggu, lalu setelah mendapat kunci benar-benar melihat baris A yang baru
commit, dan menolak. Snapshot per-pernyataan pada READ COMMITTED bekerja
seperti yang dibutuhkan.

**MariaDB tidak memiliki batasan eksklusi.** Padanan yang harus ditulis sendiri
adalah mengunci baris ruangan (`SELECT … FOR UPDATE`) di setiap jalur yang
menulis jadwal, lalu memeriksa di dalam kunci itu. Cara itu bisa benar, tetapi
kebenarannya bergantung pada disiplin: satu jalur tulis yang lupa mengunci sudah
cukup untuk mengembalikan celahnya, dan celah balapan tidak muncul saat diuji
manual — hanya saat aplikasi ramai.

### 3.4 Keuntungan lain yang relevan untuk aplikasi ini

| Kebutuhan aplikasi | PostgreSQL | MariaDB 11.4 |
|---|---|---|
| Anti-bentrok jadwal di basis data | pemicu + kunci penasihat (`EXCLUDE` bila ada contrib) | pemicu juga mungkin, tanpa kunci penasihat setara |
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
- **Tidak ada ekstensi contrib di hosting ini.** Selain `btree_gist`, ini juga
  menutup `pg_trgm` (pencarian mirip) dan `unaccent`. Bila kelak diperlukan,
  mintalah Domainesia memasang paket `postgresql16-contrib`; setelah itu
  batasan eksklusi dapat menggantikan pemicu tanpa mengubah kode aplikasi.

Bila di kemudian hari Anda tetap memilih MariaDB, yang perlu diganti hanya
migrasi anti-bentrok dan kode yang mengurus penguncian. Sisa aplikasinya tidak
terpengaruh.

---

## 4. Yang Sudah Dibangun

Fondasi berjalan, bukan rancangan di atas kertas. Dua irisan tegak lurus
dikerjakan penuh — dari migrasi sampai HTTP — justru pada bagian tersulitnya,
supaya jaminan intinya terbukti lebih dulu.

```
backend/
├── app/
│   ├── Models/{Room,Laboratory,Booking,User,Asset,BmnKodeBarang,AssetMutation}.php
│   ├── Policies/{Room,Laboratory}Policy.php  izin per sumber daya
│   ├── Support/MatriksAkses.php              matriks peran × modul, sumber kebenaran
│   ├── Support/CakupanData.php               sumbu kedua: objek mana yang terlihat
│   ├── Models/Concerns/DapatDibatasiCakupan.php  scope ->dalamCakupan()
│   ├── Models/Concerns/Diaudit.php          jejak audit otomatis lewat peristiwa model
│   ├── Listeners/CatatPerubahanHakAkses.php pemberian & pencabutan peran/izin
│   ├── Support/RegistriWidget.php           daftar putih widget — batas keamanan
│   ├── Support/AsalPeristiwa.php            asal jejak audit: rute HTTP atau konsol
│   ├── Services/
│   │   ├── AuditService.php                 pencatatan di luar penyuntingan kolom
│   │   ├── SusunanDashboard.php             simpan susunan + dashboard bawaan per peran
│   │   ├── DataWidget.php                   perhitungan tiap widget, tunduk cakupan
│   │   ├── Scorecard.php                    kartu skor BSC + penyusunan perspektif
│   │   ├── BookingService.php               menerjemahkan galat basis data → pesan pengguna
│   │   ├── AssetService.php                 pendaftaran aset dalam satu transaksi
│   │   ├── NupAllocator.php                 pemberian NUP yang aman balapan
│   │   ├── KodeInternalGenerator.php        penomoran kedua, berbasis pola
│   │   ├── EkstraksiKodeBarangPdf.php       pembaca lampiran PMK berbentuk PDF
│   │   ├── AssetMutationRecorder.php        riwayat dari selisih keadaan
│   │   └── Penyusutan.php                   garis lurus PMK 65/2017
│   ├── Support/Satker.php                   perakit kode lokasi 15 digit
│   ├── Http/Requests/{StoreBookingRequest,StoreAssetRequest}.php
│   ├── Http/Resources/{BookingResource,AssetResource}.php
│   └── Http/Controllers/Api/{Booking,Asset,BmnKodeBarang}Controller.php
├── app/Console/Commands/                     impor master + penyelarasan NUP
├── config/bmn.php                            identitas satker & pola penomoran
├── database/migrations/                      btree_gist, rooms, bookings,
│                                             bmn_kode_barang, bmn_nup_counters, assets,
│                                             asset_mutations, pemicu identitas BMN,
│                                             audit_logs + pemicu hanya-tambah,
│                                             dashboards & dashboard_widgets + CHECK kisi,
│                                             bsc_indikator + pemicu bobot tertunda,
│                                             peran & izin, indeks kode ruangan parsial
├── database/factories/{Room,Booking,Asset,BmnKodeBarang}Factory.php
├── database/seeders/BmnKodeBarangSeeder.php  ⚠ cuplikan contoh, bukan master resmi
├── routes/api.php
└── tests/
    ├── Feature/{BookingConflict,BookingApi,BookingRaceCondition}Test.php
    ├── Feature/{AssetApi,NupRaceCondition}Test.php
    ├── Feature/AuditTrailTest.php
    ├── Feature/DashboardTest.php
    ├── Feature/BalancedScorecardTest.php
    └── Unit/PenyusutanTest.php
```

### 4.1 Hasil uji

```
371 uji lulus, 1.104 asersi, 0 gagal — dijalankan di PostgreSQL 16
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

Modul aset BMN — irisan kedua:

| Uji | Yang dijaga |
|---|---|
| Identitas BMN dirangkai basis data | `bmn_id` = kode lokasi + kode barang + NUP, kolom `GENERATED` |
| **NUP berjalan per kode barang** | dua kode barang berbeda sama-sama mulai dari NUP 1 |
| **Dua pendaftaran bersamaan** | tidak mendapat NUP kembar (pernyataan atomik) |
| Identitas BMN kembar | ditolak indeks unik, walau kode internalnya berbeda |
| Penyelarasan setelah impor | pencatat menyusul NUP tertinggi data lama |
| NUP tidak dapat dikarang | `nup` dan `kode_lokasi` dari permintaan diabaikan |
| Kode barang berpola salah | `422`, pola `X.XX.XX.XX.XXX` dijaga aplikasi **dan** `CHECK` |
| Kode internal kembar | `422`, bukan galat basis data mentah |
| Kode internal otomatis | terbentuk dari pola satker bila dikosongkan |
| Masa manfaat ikut master | penyusutan tidak bergantung ketelitian pengisian |
| Tapis berjenjang | `?kode_barang=3.08` menjaring seluruh alat laboratorium |
| Penyusutan (8 uji) | garis lurus, nilai buku berhenti di nol, masa manfaat nol aman |

Perubahan, mutasi, riwayat, dan penghapusan aset:

| Uji | Yang dijaga |
|---|---|
| **Identitas BMN terkunci** | pemicu basis data menolak ubah `kode_barang`/`nup`/`kode_lokasi`, bahkan lewat `psql` |
| Riwayat dari selisih keadaan | bukan dari niat pemanggil, sehingga tidak ada perubahan yang lolos tanpa jejak |
| Riwayat menyimpan nama, bukan id | tetap terbaca setelah ruangannya dihapus |
| Perubahan semu tidak dicatat | `'B'` → `'B'` bukan perubahan |
| Mutasi ke ruangan yang sama | ditolak `422`, riwayat tidak terkotori |
| Mutasi tanpa `room_id` | ditolak — tidak diartikan "keluarkan dari ruangan" |
| Penghapusan bersifat lunak | **NUP tidak dipakai ulang** walau asetnya sudah dihapus |
| Alasan penghapusan | ikut tercatat pada riwayat |

Master data ruangan:

| Uji | Yang dijaga |
|---|---|
| **Ruangan berjadwal tidak dapat dihapus** | hapus lunak tidak memicu kunci asing `restrict`, jadi penjaganya harus di aplikasi |
| Jadwal lampau & dibatalkan | tidak menahan penghapusan — master data tetap bisa dirapikan |
| Employee boleh melihat ruangan | lewat izin booking, walau tanpa izin master-data sama sekali |
| Employee tidak boleh menulis | buat/ubah/hapus ditolak 403 |
| Facility manager ubah ≠ hapus | menghapus menuntut tingkat PENUH |
| Kode ruangan boleh dipakai ulang | indeks unik parsial `WHERE deleted_at IS NULL` |

Penyewaan & penagihan — modul uang:

| Uji | Yang dijaga |
|---|---|
| **Kenaikan tarif tidak mengubah tagihan terbit** | baris tagihan adalah cuplikan, bukan acuan ke tarif |
| **Pembayaran melebihi tagihan ditolak** | kelebihan bayar = kewajiban kembalikan uang yang tak tercatat di mana pun |
| Akumulasi pembayaran juga dijaga | 600rb + 300rb + 200rb pada tagihan 1jt ditolak |
| **Dijaga pemicu basis data + kunci penasihat** | dua pembayaran bersamaan tak dapat sama-sama lolos |
| Pembayaran negatif ditolak | koreksi lewat baris pembatalan, bukan angka minus |
| Subtotal baris kolom `GENERATED` | mustahil menyimpang dari kuantitas × harga |
| **Status dihitung ulang, tidak ditebak** | pembayaran dihapus → status mundur, bukan tetap "lunas" |
| Nomor tagihan berurut & unik per tahun | memakai pencatat aman-balapan yang sama dengan NUP BMN |
| Tagihan tanpa baris ditolak | tagihan bernilai nol hanya membingungkan saat ditagihkan |
| Jatuh tempo tidak boleh mendahului tanggal terbit | dijaga `CHECK` |

Persetujuan:

| Uji | Yang dijaga |
|---|---|
| **Tidak dapat menyetujui pengajuan sendiri** | SECURITY.md §4.3: berlaku "meskipun peran mengizinkan" |
| **Larangan itu dijaga batasan basis data** | `disetujui_oleh <> user_id` — berlaku walau lewat `psql` |
| Pengajuan sendiri tidak muncul di antrean | menampilkannya hanya untuk ditolak saat diklik membuat orang mengira sistemnya rusak |
| **Penolakan wajib beralasan** | dijaga `CHECK`; tanpa alasan, pemohon mengajukan ulang hal yang sama persis |
| Sudah diputus tidak dapat diputus lagi | keputusan bukan draf |
| Pengajuan `menunggu` sudah menahan slot | sebab itulah bentrok tak mungkin muncul saat menyetujui |
| Penolakan membebaskan slot | antrean tidak tersandera pengajuan yang gugur |

**Kode mati yang dibuang.** Versi pertama menyertakan penerjemah galat bentrok
pada jalur persetujuan. Ujinya justru membuktikan keadaan itu **tidak dapat
terjadi**: pengajuan `menunggu` sudah menahan slot, sehingga dua pengajuan
tumpang tindih tak pernah lahir. Penanganan galat untuk keadaan yang mustahil
lebih buruk daripada tidak ada — tidak pernah teruji, memberi kesan keliru
bahwa keadaannya mungkin, dan menyamarkan galat sungguhan yang kebetulan
mirip. Dibuang, dan perilaku sebenarnya dipatok dua uji.

Notifikasi jadwal:

| Uji | Yang dijaga |
|---|---|
| **Menjalankan dua kali tidak mengirim dua surel** | orang yang menerima belasan surel identik berhenti membaca semuanya |
| **Keunikan dijaga indeks basis data** | dua proses penjadwal bersamaan tetap tidak dapat menembusnya |
| Jadwal yang diundur menghasilkan pengingat baru | tanggal acuan ikut menjadi kunci keunikan |
| Lima sumber jadwal tercakup | booking, peminjaman, pemeliharaan, kalibrasi, checklist |
| Peminjaman terlambat diberi penanda `[TERLAMBAT]` | yang mendesak harus terlihat berbeda di kotak masuk |
| Pemeliharaan jatuh ke PJ alat bila petugas kosong | pekerjaan tanpa penanggung jawab tidak mengirim apa pun |
| Tanpa preferensi memakai bawaan aktif | mewajibkan setel dulu berarti tak seorang pun menerima pengingat |
| Kegagalan tercatat, tidak dicoba ulang membabi buta | catatan gagal sengaja tidak dihapus |

**Cacat yang ditangkap uji.** Pencatatan semula menangkap galat keunikan.
Pada PostgreSQL, pernyataan yang gagal **meracuni seluruh transaksi** —
setiap perintah sesudahnya ditolak sampai rollback. Cara itu hanya bekerja
bila kebetulan tidak ada transaksi yang membungkus, dan ketergantungan
sehalus itu akan patah pada pemanggil pertama yang membungkusnya. Diganti
`insertOrIgnore`, yang tidak melempar sama sekali.

Checklist:

| Uji | Yang dijaga |
|---|---|
| Enam jenis tersedia | pengecekan, perawatan, penyewaan, kebersihan, kerapian, kelayakan |
| Templat dibuat pengguna, bukan tertanam kode | butir disertakan sekaligus agar tak ada templat setengah jadi |
| Melekat pada ruangan, laboratorium, ATAU aset | tiga kunci asing + `num_nonnulls(...) = 1` |
| **Batasan tepat satu dijaga basis data** | berlaku walau lapisan aplikasi ditembus |
| Melekat pada user — "tugas saya" | daftar yang menjawab "apa yang harus saya kerjakan" |
| **Butir wajib kosong menahan penyelesaian** | checklist setengah terisi yang tercatat "sudah diperiksa" lebih menyesatkan daripada tidak diperiksa |
| **Templat tanpa butir tidak dapat dilaksanakan** | checklist kosong selalu selesai dengan skor sempurna tanpa memeriksa apa pun |
| Skor hanya dari butir ya/tidak | butir angka dan teks mencatat, bukan menilai |
| Pelaksanaan selesai tidak dapat diubah | riwayat pemeriksaan bukan draf |
| Employee melaksanakan ≠ menugaskan | matriks memberinya BUAT, bukan UBAH |

Pemeliharaan & kalibrasi:

| Uji | Yang dijaga |
|---|---|
| **Kalibrasi selesai menuntut sertifikat & masa berlaku** | tanpa masa berlaku, alat dianggap sah selamanya dan tak pernah muncul kedaluwarsa |
| **Alat kedaluwarsa kalibrasi tidak dapat dipinjam** | hasil ujinya tak dapat dipertanggungjawabkan; temuan audit ISO/IEC 17025 |
| **Kalibrasi yang habis setelah pengajuan menahan serah terima** | masa berlaku dapat habis di antara keduanya |
| Alat tidak wajib kalibrasi tidak pernah kedaluwarsa | meja dan lemari asam tidak dikalibrasi |
| Kondisi setelah perbaikan memperbarui master + riwayat | pola yang sama dengan pengembalian peminjaman |
| Izin kalibrasi dan pemeliharaan terpisah | facility manager: pemeliharaan PENUH, kalibrasi hanya LIHAT |
| Keterlambatan dapat ditapis | daftar kerja harian teknisi |

Peminjaman alat:

| Uji | Yang dijaga |
|---|---|
| Tumpang tindih ditolak, berurutan diizinkan | pemicu yang sepadan dengan pemesanan ruangan, berkunci aset |
| Bentrok ditolak pemicu basis data | berlaku walau lapisan aplikasi ditembus |
| **Peminjaman dikembalikan membebaskan slot** | alat yang kembali lebih awal tidak menganggur sampai jadwal aslinya habis |
| **Alat rusak berat tidak dapat dipinjam** | dijaga aplikasi; basis data tidak dapat menilai keadaan saat pengambilan |
| **Kondisi diperiksa ULANG saat serah terima** | alat dapat rusak antara pengajuan dan pengambilan |
| Kondisi saat kembali memperbarui master + riwayat | tanpa itu, alat rusak tetap tercatat "Baik" |
| Pengembalian tanpa kondisi tidak mengubah master | kondisi yang dikarang lebih berbahaya daripada yang belum diisi |
| Peminjam tidak boleh menyerahkan ke dirinya sendiri | serah terima menuntut izin UBAH, bukan BUAT |
| Keterlambatan dapat ditapis | pertanyaan pertama pengelola alat tiap pagi |

Master data laboratorium:

| Uji | Yang dijaga |
|---|---|
| **Laboratorium bertahan saat ruangannya dihapus** | identitasnya berdiri sendiri; ia kehilangan tempat, bukan ikut terhapus |
| **Dapat pindah ruangan tanpa berganti identitas** | inilah alasan ia tidak digabung dengan tabel ruangan |
| Laboratorium beraset tidak dapat dihapus | `nullOnDelete` hanya bekerja pada hapus permanen |
| Lab yang belum punya ruangan tetap terlihat | unit baru tidak boleh hilang dari daftar |
| Asset manager lihat ≠ ubah | matriks memberinya LIHAT pada modul laboratorium |

Cakupan data (sumbu kedua otorisasi):

| Uji | Yang dijaga |
|---|---|
| Ruangan dibatasi gedung yang diampu | PIC gedung A tidak melihat gedung B |
| Boleh mengampu beberapa gedung | tabel `user_gedung`, bukan daftar bertanda koma |
| Aset dibatasi lewat gedung ruangannya | penelusuran relasi, bukan kolom yang digandakan |
| **Aset belum ditempatkan tetap terlihat** | barang baru atau sedang di bengkel tidak hilang dari daftar |
| Aset dibatasi unit kerja | aset tanpa unit kerja adalah milik bersama |
| **Pengajuan sendiri selalu terlihat** | pemohon harus dapat memantau pengajuannya |
| Unit kerja pemesanan dari pemohon | tidak diterima dari permintaan, agar cakupan tidak dapat dilewati |
| Peran lintas gedung tetap melihat semua | Asset Manager perlu itu untuk audit BMN satker |
| **Cakupan tidak menggantikan izin** | employee bergedung A tetap ditolak pada modul aset |

Uji-uji ini diperiksa benar-benar menangkap ketiadaan cakupan: dengan
penapisannya dilumpuhkan sementara, 6 dari 11 gagal — `ukuran 2` padahal
seharusnya `1`, dan aset unit lain ikut terlihat.

**Cacat yang ditangkap uji ini.** `bmn_id` sempat terbaca `null` pada tanggapan
API: kolomnya dibentuk basis data, sehingga instance hasil `create()` belum
memuatnya. Tanpa uji yang memeriksa nilai identitasnya — bukan sekadar status
`201` — cacat ini akan lolos sampai ada yang mencetak barcode kosong.

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

- **Tabel yang menyusul layar, bukan layar yang dipangkas.** Tabel `rooms`
  semula dibuat untuk melayani pemesanan saja — kode, nama, gedung, lantai,
  kapasitas. Purwarupa yang sudah ditinjau menampilkan lebih banyak: jenis
  ruangan, luas, skema tarif, penanggung jawab, tata letak, fasilitas.
  Menyambungkan layar ke tabel yang lebih tipis akan menghilangkan kolom-kolom
  itu dari antarmuka tanpa ada yang meminta — bentuk kemunduran yang paling
  mudah lolos, karena tidak menimbulkan galat apa pun, hanya isian yang
  diam-diam berkurang.
- **Skema tarif dipisahkan dari nilainya.** Ruangan internal bertarif nol
  berbeda maknanya dari ruangan berbayar yang tarifnya belum ditetapkan; satu
  kolom angka tidak dapat membedakannya, dan yang kedua adalah kesalahan yang
  harus ketahuan sebelum tagihan pertama terbit. Ditegakkan CHECK:
  `skema_tarif <> 'berbayar' OR tarif IS NOT NULL`.
- **Jawaban `store` memantulkan baris tersimpan, bukan objek di memori.**
  Sebagian kolom punya nilai bawaan di basis data, dan objek hasil `create()`
  tidak mengetahuinya — tanpa `refresh()` antarmuka menampilkan ruangan tanpa
  status sampai halamannya dimuat ulang. Ketahuan dari uji, bukan dari
  laporan pengguna.
- **CORS lintas subdomain dengan kredensial, dan asalnya tegas.** Antarmuka
  di `lab.` dan API di `api.lab.` adalah **asal yang berbeda** bagi peramban.
  Tanpa `config/cors.php` berlaku bawaan Laravel `supports_credentials =>
  false`, dan cookie sesi tidak pernah menyeberang — gejalanya bukan galat
  CORS yang jelas, melainkan **401 pada setiap permintaan setelah login,
  seolah sandinya salah**. Asalnya disebut satu per satu, bukan `*`:
  spesifikasi CORS melarang `*` bersama kredensial, dan gejalanya justru
  membingungkan karena permintaan tanpa kredensial tetap berhasil.
- **Perubahan `.env` ikut memicu pembangunan ulang cache.** Skrip pasca-deploy
  semula hanya membangun ulang cache ketika ada migrasi tertunda, sehingga
  menyunting `.env` tanpa menambah migrasi tidak berpengaruh apa pun — dan itu
  sama sekali tidak terlihat: aplikasinya berjalan normal, hanya dengan nilai
  lama. Sidik jari `.env` kini disimpan dan dibandingkan, dan disimpan **hanya
  setelah** penerapannya selesai, supaya skrip yang mati di tengah jalan
  mengulang, bukan menganggapnya beres.
- **Bobot Balanced Scorecard dijaga pemicu batasan TERTUNDA.** Kesalahan yang
  menghancurkan hampir setiap BSC di lembar sebar: seseorang menambah satu
  indikator, bobot perspektifnya menjadi 115, skor gabungannya menggelembung,
  dan tidak ada tanda apa pun — angkanya hanya menjadi salah, lalu keputusan
  diambil di atasnya sepanjang tahun. `CONSTRAINT TRIGGER … DEFERRABLE
  INITIALLY DEFERRED` memeriksanya pada COMMIT, bukan per baris, sehingga satu
  perspektif dapat disusun ulang utuh dalam satu transaksi — indikator dihapus,
  ditambah, bobot diatur ulang — dan yang dituntut hanya keadaan akhirnya.
  Batasan per baris biasa mustahil: menghapus satu indikator saja sudah
  langsung melanggar. **Ini kemampuan PostgreSQL yang tidak dimiliki
  MariaDB**, dan alasan ketiga pemilihannya setelah `tstzrange` dan kolom
  `GENERATED`.
- **Arah indikator BSC wajib dinyatakan.** "Jumlah keluhan" membaik ketika
  turun. Rumus capaian yang selalu `realisasi/target` menilai penurunan keluhan
  sebagai kegagalan dan kenaikan keluhan sebagai prestasi, lalu memberi
  penghargaan kepada orang yang keliru. `polaritas` karena itu tidak punya
  nilai bawaan — bawaan apa pun benar untuk sebagian indikator dan diam-diam
  salah untuk sisanya.
- **Capaian dibatasi 120% saat menghitung skor,** dilaporkan apa adanya saat
  ditampilkan. Satu indikator tercapai 900% — hampir selalu karena targetnya
  salah tulis, bukan kinerja sembilan kali lipat — akan menutupi seluruh
  perspektif yang gagal.
- **Indikator yang belum diisi realisasinya dikeluarkan dari pembagi, bukan
  dihitung nol.** Menghitungnya nol membuat kartu skor Januari selalu merah
  padahal datanya memang belum masuk, dan orang berhenti mempercayai angkanya
  sebelum tahunnya berjalan.
- **Penyusunan ulang perspektif menghasilkan SATU entri audit,** bukan satu per
  indikator. Penulisan ulang membuat baris baru; mencatatnya per baris akan
  tampak seolah indikator baru ditambahkan padahal hanya bobotnya yang
  bergeser — sementara yang dihapus tidak tercatat sama sekali, karena
  penghapusan massal tidak melepas peristiwa model.
- **Seeder peran hanya menyinkronkan bila memang berbeda.** `syncPermissions`
  selalu melepas lalu memasang ulang seluruh izin; sejak perubahan hak akses
  diaudit, itu berarti 24 entri jejak audit pada **setiap** penerapan tanpa satu
  izin pun berubah. Ketahuan dari basis data produksi — 48 baris audit sudah
  menumpuk sebelum ada satu pengguna pun. Jejak audit yang penuh derau sama
  tidak bergunanya dengan yang kosong: pemeriksa berhenti membacanya.
- **Asal peristiwa dicatat apa adanya, termasuk dari konsol.** Sebagian besar
  perubahan paling berdampak tidak datang lewat HTTP — seeder peran, impor
  master, pembuatan pengguna, pekerjaan terjadwal. `Request::path()` menyebut
  semuanya `/`, yang membuat jejaknya berbunyi seolah seseorang membuka halaman
  depan lalu mengubah hak akses dari sana.
- **Widget dashboard adalah daftar putih, dan itu batas keamanan.**
  Permintaannya adalah dashboard yang widgetnya dapat dikelola sendiri
  pengguna. Cara paling langsung memenuhinya — menyimpan sumber data widget
  sebagai teks bebas (nama tabel atau potongan kueri) — membongkar dua hal
  sekaligus: injeksi SQL lewat jalur yang tidak terlihat seperti jalur data,
  dan penembusan cakupan data, karena widget berkueri bebas melewati
  `->dalamCakupan()` yang dipatuhi seluruh modul lain. Yang dapat disusun
  pengguna karena itu adalah **penyajiannya** — widget mana, di posisi mana,
  selebar apa, berjudul apa, dengan tapis apa — sementara **cara angkanya
  dihitung** tetap kode yang ditinjau di `App\Support\RegistriWidget`.
- **Izin widget diperiksa saat data diambil, bukan saat dipasang.** Peran
  berubah seiring waktu; orang yang kehilangan peran Finance tidak boleh terus
  melihat angka piutang hanya karena widgetnya sudah tersimpan di tata
  letaknya sejak sebelum perannya dicabut. Widget tak berizin mengembalikan
  penanda, bukan angka — dan bukan pula galat.
- **Angka ringkasan tunduk pada cakupan data yang sama dengan daftar
  rincinya.** "42 aset" bagi orang yang seharusnya hanya melihat gedungnya
  sendiri sudah memberi tahu ada sesuatu di luar sana.
- **Geometri kisi dijaga batasan CHECK, bukan JavaScript penyusunnya.**
  Seret-lepas di peramban mengirim angka apa pun, dan satu widget berlebar 0
  atau menjorok keluar kisi 12 kolom merusak tata letak bagi semua orang yang
  membukanya — termasuk pemiliknya, yang lalu tidak punya cara memperbaikinya
  lewat antarmuka yang sudah rusak.
- **Satu widget rusak tidak menjatuhkan seluruh halaman.** Perhitungan tiap
  widget dibungkus, galatnya tetap diteruskan `report()` ke log seperti biasa,
  tetapi yang muncul di layar adalah satu kotak bertanda — bukan galat 500 pada
  tampilan pertama setiap kali orang masuk. Ditambahkan setelah satu nama
  scope yang keliru benar-benar menjatuhkan seluruh dashboard saat pengujian.
- **Jejak audit hanya bisa ditambah, dan itu ditegakkan basis data.**
  Pemicu pada `audit_logs` menolak setiap UPDATE dan DELETE. Jejak audit yang
  dapat disunting bukan jejak audit: yang dirugikan ketiadaannya hanya
  pemeriksa, sementara pihak yang ingin menutupi sesuatu justru terbantu,
  karena catatan yang tampak lengkap lebih meyakinkan daripada catatan yang
  jelas-jelas tidak ada. Konsekuensinya diterima: baris yang salah tidak dapat
  diperbaiki, hanya diikuti baris koreksi.
- **`audit_logs` sengaja tanpa kunci asing.** Tabel yang hanya bisa ditambah
  tidak dapat memiliki kunci asing ke tabel yang barisnya bisa hilang —
  `ON DELETE SET NULL` adalah UPDATE dan `ON DELETE CASCADE` adalah DELETE,
  dan pemicu menolak keduanya. Yang gagal bukan jejaknya, melainkan
  penghapusan penggunanya, di tempat yang sama sekali tidak diduga. Terbukti
  saat pengembangan: uji penghapusan pengguna langsung tumbang. Arti barisnya
  dipikul `nama_pelaku`, yang disalin saat peristiwa terjadi — sehingga
  jejaknya tetap terbaca setelah penggunanya tidak ada.
- **Nilai sensitif tidak pernah masuk jejak audit.** Pergantian kata sandi
  tercatat sebagai peristiwa, nilainya — bahkan yang sudah di-hash — diganti
  `[disamarkan]`. Jejak audit adalah tempat yang paling banyak dibaca saat
  pemeriksaan, dan menaruh rahasia di sana sama saja menyebarkannya.
- **Perubahan hak akses dicatat lewat peristiwa paket izin,** bukan dari
  endpoint tertentu. Memberi peran tidak mengubah satu kolom pun pada tabel
  `users`, sehingga peristiwa model biasa tidak pernah menyala — perubahan
  paling sensitif dalam sistem justru yang paling mudah luput. Karena itu
  `permission.events_enabled` dinyalakan dan `CatatPerubahanHakAkses`
  mendengarkannya, sehingga jalur apa pun tercakup, termasuk perintah artisan
  dan seeder.

---

## 5. Kerangka Kerja Ini Menjawab Kebutuhan yang Sudah Ada

| Kebutuhan dari dokumen fitur | Cara Laravel menjawabnya |
|---|---|
| Notifikasi surel seluruh jadwal | `Mailable` berantre + `schedule:run` lewat cron |
| Persetujuan berjenjang | mesin status + `spatie/laravel-permission` |
| Jejak audit | tabel `audit_logs` sendiri, hanya-tambah di tingkat basis data |
| Unggah foto peralatan | `Storage` + disk privat di luar docroot |
| 12 peran, matriks izin | peran & izin basis data, `Policy` per modul |
| Ekspor PDF/Excel | pekerjaan berantre, hasil disimpan ke disk privat |
| Dashboard dapat disusun sendiri | `dashboards`/`dashboard_widgets` + daftar putih widget |
| Dashboard Balanced Scorecard | `bsc_indikator` + pemicu bobot tertunda PostgreSQL |

---

## 6. Topologi Penerapan — Sudah Berjalan

Bagian ini **wajib** benar sejak awal, karena satu kesalahan di sini
membocorkan seluruh konfigurasi. Docroot diisi `git reset --hard` dari akar
repositori; bila aplikasi Laravel diletakkan di dalam docroot, `.env` — berisi
kunci aplikasi dan sandi basis data — akan berada di wilayah yang dilayani web.

Yang terpasang sekarang:

```
/home/semestat/lab.semestateknologiutama.com/   docroot → SPA statis purwarupa
/home/semestat/api.lab/                         repositori, DI LUAR docroot
   └── backend/
       ├── .env                                 tidak pernah terlayani web
       ├── storage/                             berkas privat
       └── public/   ← docroot api.lab.semestateknologiutama.com
```

| Butir | Nilai terpasang |
|---|---|
| Subdomain API | `api.lab.semestateknologiutama.com` |
| Docroot | `/home/semestat/api.lab/backend/public` |
| Basis data | `semestat_flms` (PostgreSQL 16.14) |
| Pengguna basis data | `semestat_flmsapp` |
| PHP | 8.3.32, penangan `lsapi` |
| TLS | Let's Encrypt, HTTP/2, `ssl_verify: 0` |
| Deploy Git | id `165f52f7`, cabang `claude/lab-management-ui-design-rc2lfn` |

Dua baris cron, meniru `koperasi-app`:

```
*/6 * * * * cd /home/semestat/api.lab/backend && php83 artisan schedule:run
*/7 * * * * cd /home/semestat/api.lab/backend && php83 artisan queue:work --stop-when-empty --tries=3 --max-time=280
```

Sanctum memakai cookie sesi, sehingga `SESSION_DOMAIN` disetel
`.semestateknologiutama.com` agar SPA dan API dianggap satu situs.

Sebagai lapis kedua, `.htaccess` docroot purwarupa menutup `^/backend/`.

### 6.1 Yang perlu diketahui saat merawat

- **Tidak ada akses shell.** Hosting ini hanya menyediakan cron sebagai jalur
  eksekusi. Pemasangan awal karena itu dijalankan lewat cron berpenanda; lihat
  `/home/semestat/flms-setup.sh` dan lognya di `flms-setup.log`.
- **Penerapan perubahan basis data berjalan sendiri.** Karena tidak ada akses
  shell, migrasi hanya dapat dijalankan lewat cron. `/home/semestat/flms-cek.sh`
  dipanggil tiap 9 menit dan **memeriksa sendiri** apakah ada migrasi tertunda;
  bila tidak ada, ia keluar tanpa melakukan apa pun. Bila ada, ia menjalankan
  `migrate --force`, menyegarkan peran dan cache, memanggil beberapa rute
  sebagai pemeriksaan, lalu mencatat hasilnya ke `flms-cek.log`.

  Artinya **setelah `git deploy` tidak ada langkah manual** — skema menyusul
  sendiri dalam hitungan menit. Versi sebelumnya memakai berkas penanda yang
  harus dihapus manual, dan itu berarti skema baru hanya menyusul bila ada
  orang yang ingat menghapusnya.

  Catatan: entri cron per-menit dinormalkan hosting menjadi `*/9`, jadi jangan
  heran bila penerapannya tertunda sampai sembilan menit.

- **`composer install` bisa terbunuh di tengah.** Proses cron dibatasi lamanya,
  dan 504 dari `api.github.com` memaksa composer beralih ke `git clone` per
  paket yang jauh lebih lambat. Skrip pemasangannya dibuat agar dapat
  **diulang**: setiap pemanggilan melanjutkan, bukan mengulang dari nol.
- **Setelah mengubah `.env`, wajib** `php artisan config:cache` ulang —
  konfigurasi di-cache, sehingga perubahan `.env` saja tidak berpengaruh.
- **Sandi basis data hanya ada di `.env` pada server.** Tidak pernah masuk
  repositori. Bila perlu diputar, ubah di cPanel lalu perbarui `.env` dan
  jalankan `config:cache`.

### 6.2 Membuat akun pertama

Tanpa satu pun akun, seluruh API menolak semua orang dan sistem terkunci dari
dirinya sendiri. Akun pertama dibuat lewat cron (hosting ini tanpa akses
shell) atau lewat SSH bila Anda memilikinya:

```bash
cd /home/semestat/api.lab/backend
php83 artisan flms:buat-pengguna anda@instansi.go.id \
    --nama="Nama Anda" --peran=super-admin --sandi-acak
```

Sandi acak ditampilkan **sekali** pada keluaran perintah. Salin, lalu segera
ganti lewat `POST /api/ubah-sandi`.

Sandi sengaja tidak dapat diberikan sebagai argumen: argumen tercatat di
riwayat shell dan terlihat pada daftar proses. Bila ingin mengetiknya sendiri,
hilangkan `--sandi-acak` dan perintahnya akan menanyakannya secara
tersembunyi.

Peran yang tersedia: `super-admin`, `facility-manager`, `lab-manager`,
`asset-manager`, `finance`, `employee`, `lab-technician`,
`room-administrator`, `event-manager`, `pic`, `external-user`, `management`.

### 6.3 Alur masuk dari antarmuka

Sanctum memakai sesi cookie, sehingga SPA harus mengambil cookie CSRF lebih
dahulu:

```
1. GET  /sanctum/csrf-cookie          → 204, menanam cookie XSRF-TOKEN
2. POST /api/masuk                     → sertakan header X-XSRF-TOKEN
     {"email": "...", "password": "..."}
3. Permintaan berikutnya cukup membawa cookie sesi.
4. POST /api/keluar                    → mengakhiri sesi
```

Melewatkan langkah 1 menghasilkan **419 CSRF token mismatch** — itu perilaku
yang benar, bukan gangguan.

Seluruh langkah itu diurus `assets/js/api.js` di sisi antarmuka. Tiga hal yang
perlu diketahui saat merawatnya:

- **`credentials: "include"` wajib pada setiap permintaan.** Tanpa itu cookie
  sesi tidak menyeberang dari `lab.` ke `api.lab.`, dan gejalanya bukan galat
  CORS melainkan 401 di mana-mana — seolah sandinya salah.
- **Pengambilan cookie CSRF dikunci pada satu janji bersama.** Memuat
  dashboard menembakkan belasan permintaan sekaligus; tanpa penguncian
  semuanya berlomba mengambil token yang sama lalu sebagian gagal 419 —
  kegagalan yang tampak acak dan sangat sulit ditelusuri.
- **Alamat API diturunkan dari alamat halaman,** bukan ditulis mati. Untuk
  menjalankan antarmuka lokal melawan API lokal, setel sekali di konsol
  peramban: `localStorage.setItem('flms.api', 'http://localhost:8000')`.

### 6.3.1 Mode data contoh

Antarmuka dapat berjalan tanpa API sama sekali, memakai data purwarupa di
`assets/js/data.js`. Mode itu **selalu** disertai spanduk merah yang tidak
dapat ditutup.

Itu bukan hiasan. Purwarupa ini berisi angka yang meyakinkan — nama alat yang
masuk akal, rupiah yang wajar, jadwal yang rapi. Bila API tak terjangkau lalu
antarmuka menampilkannya tanpa keterangan, yang terjadi bukan "aplikasi tetap
jalan" melainkan seseorang mengambil keputusan di atas angka karangan tanpa
pernah tahu. Tombol tutup sengaja tidak disediakan: spanduk yang bisa ditutup
akan ditutup pada menit pertama lalu tidak pernah terlihat lagi selama sisa
sesi — persis ketika ia paling dibutuhkan. Satu-satunya jalan keluar adalah
benar-benar masuk memakai akun.

Mode ini menyala bila salah satu berikut terjadi: API tidak terjangkau,
alamat API belum diatur untuk host tersebut, atau pengguna memilihnya sendiri
lewat tombol "Telusuri purwarupa" / pemilih peran di halaman depan.

### 6.4 Verifikasi pasca-penerapan

Lingkungan kerja pengembang tidak dapat menjangkau domain ini (diblokir proksi
egress), sehingga verifikasinya dijalankan **dari dalam server**. Hasil
terakhir:

```
LULUS  /api/user            → HTTP 401 {"message":"Unauthenticated."}
LULUS  /api/assets          → HTTP 401 application/json
LULUS  /api/bookings        → HTTP 401 application/json
LULUS  /api/bmn/kode-barang → HTTP 401 application/json
LULUS  /api/tidak-ada       → HTTP 404 application/json
LULUS  /up                  → HTTP 200
       ssl_verify: 0 | http_version: 2
```

Anti-bentrok juga diuji langsung pada basis data server: pemesanan yang
tumpang tindih ditolak pemicu, sedangkan pemakaian berurutan tetap diterima.

Peran dan izin diperiksa langsung di basis data server, dan cocok dengan
matriks:

| Peran | Izin `aset.*` di server |
|---|---|
| `asset-manager` | buat, hapus, kelola, lihat, ubah — sesuai PENUH |
| `facility-manager` | buat, lihat, ubah — sesuai UBAH, tanpa hapus |
| `employee` | tidak ada — sesuai `—` |

Total 12 peran, 60 izin, 245 pemetaan peran-izin.

**Yang belum diverifikasi di server:** satu kali masuk yang BERHASIL dengan
kredensial benar. Lapisannya sudah terbukti masing-masing — cookie CSRF terbit
(204), token CSRF diterima (permintaan tidak lagi 419 melainkan 422 pada
kredensial salah), rute terlindung menolak tamu (401) — tetapi rangkaian
utuhnya belum pernah dijalankan di sana karena membutuhkan akun sungguhan.
Alur lengkapnya tercakup 14 uji otomatis di `AuthTest`. Buat akun pertama
seperti pada §6.2, lalu masuk sekali untuk menutup celah verifikasi ini.

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

1. **Melengkapi autentikasi** — lupa sandi lewat surel, verifikasi surel,
   dan audit percobaan masuk
2. **Impor master kode barang BMN resmi** — menggantikan cuplikan contoh pada
   `BmnKodeBarangSeeder`; perintah impor + penyelarasan NUP data lama
3. **Melengkapi modul aset** — ubah/hapus, mutasi antarruangan, unggah foto,
   riwayat kondisi, cetak barcode dari sisi server
4. **Cakupan data** — SECURITY.md §4.2 (per gedung, per unit kerja, per
   resource yang diampu) belum diterapkan sama sekali; otorisasi yang ada
   baru sumbu peran, belum sumbu cakupan data
5. **Master data sisanya** — ruangan, laboratorium, pengguna, satuan kerja
6. **Modul jadwal sisanya** — peminjaman alat, maintenance, kalibrasi, agenda;
   semuanya memakai pola anti-bentrok yang sama
7. **Notifikasi surel** — antrean, templat, ringkasan harian, preferensi per pengguna
8. **Checklist** — templat, penugasan, pelaksanaan, riwayat
9. **Dashboard & BSC** — penyimpanan tata letak, snapshot KPI
10. **SPA disambungkan** — `data.js` fiktif diganti panggilan API sesungguhnya
11. **Penerapan** — subdomain API, cron, pencadangan `pg_dump`, pemantauan

Penghalang rilis di [README dokumentasi](README.md) tetap berlaku. Yang sudah
teratasi oleh pekerjaan ini baru tiga fondasi — anti-bentrok jadwal,
identitas BMN yang tidak bisa kembar, dan autentikasi berbasis peran;
langkah-langkah di atas belum.

### 8.1 Yang perlu dipastikan ke satuan kerja

Empat hal sengaja tidak diputuskan sendiri karena bergantung kebijakan
satuan kerja Anda:

- **Tingkat akses enam peran.** SECURITY.md §4.1 hanya memuat matriks untuk
  enam peran. Enam sisanya — Lab Technician, Room Administrator, Event
  Manager, PIC, External User, Management — tingkatnya disimpulkan dari
  uraian PRD §4 dan ditandai `PERLU_DIKONFIRMASI` di
  `App\Support\MatriksAkses`. Perlu ditinjau pemilik produk sebelum dipakai.

- **Periode penyusutan.** `Penyusutan` menghitung per tahun penuh, mengikuti
  purwarupa. PMK 65/2017 melaporkan per **semester**. Seluruh perhitungan
  dikurung di satu kelas agar penyesuaiannya cukup di satu tempat.
- **Nilai bawaan identitas satker.** `config/bmn.php` masih berisi contoh
  (BA 024, satker 652431). Wajib diganti lewat `.env` sebelum data nyata
  masuk — bila dibiarkan, seluruh identitas BMN yang terbentuk akan salah.
- **Siapa pemilik Balanced Scorecard.** Menurut matriks §4.1, peran
  **Management** hanya berhak `dashboard` = LIHAT, sehingga tidak dapat
  menyusun kerangka kartu skor — padahal justru merekalah yang paling wajar
  memilikinya. Kewenangan menyusun kini dipegang Super Admin dan Facility
  Manager (`dashboard.kelola`); pengisian realisasi bulanan menuntut
  `dashboard.ubah`. Matriksnya tidak diubah sepihak; bila Management memang
  harus dapat menyusun, tingkatnya perlu dinaikkan di `MatriksAkses` —
  perubahan satu baris.
