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
559 uji lulus, 1.674 asersi, 0 gagal — dijalankan di PostgreSQL 16
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
| **Daftar dapat disaring rentang tanggal (`sejak`/`sampai`)** | dipakai Kalender Terpadu: satu bulan sekaligus, bukan halaman teratas yang belum tentu mencakup bulan yang sedang dilihat |

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
| Tarif/add-on/paket satu tabel, ditapis `jenis` | tiga layar purwarupa, satu sumber server — lihat migrasi 2026_08_22_100000 |
| Tarif nonaktif disembunyikan kecuali diminta | daftar tarif tidak dipenuhi baris usang secara diam-diam |
| **Penawaran (quotation) dihitung dari tarif yang sama dengan invoice langsung** | satu logika harga, dua pintu masuk |
| **Penawaran yang sudah disetujui tidak berubah walau tarif naik setelahnya** | barisnya disalin ke invoice, bukan dihitung ulang saat diterbitkan |
| Nomor penawaran berurut & unik per tahun | pola sama dengan nomor invoice/NUP BMN |
| **Kedaluwarsa dihitung dari tanggal, bukan disimpan sebagai status** | status tersimpannya tetap "terkirim" — sama dengan pola `terlambat()` pada pemeliharaan |
| Penawaran kedaluwarsa tidak dapat diputuskan | klien perlu penawaran baru, bukan keputusan atas yang basi |
| Penawaran final (disetujui/ditolak) tidak dapat diputuskan ulang | keputusan bukan draf — pola sama dengan Persetujuan |
| Penawaran belum disetujui tidak dapat diterbitkan invoice | mencegah tagihan resmi dari kesepakatan yang belum final |
| Penawaran tidak dapat diterbitkan invoice dua kali | satu penawaran → paling banyak satu invoice |
| **Pembayaran bawaan langsung terverifikasi, tetapi dapat ditandai menunggu** | satu-satunya jalur saat ini adalah staf mengetik langsung |
| **Pembayaran menunggu verifikasi belum dihitung lunas** | `Invoice::terbayar()` hanya menjumlah yang berstatus terverifikasi |
| Memverifikasi pembayaran menghitungnya sebagai lunas | status tagihan disegarkan ulang, bukan ditebak |
| Riwayat pembayaran dapat ditapis lintas tagihan | layar "Pembayaran" butuh daftar global, bukan per-tagihan satu-satu |

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

Manajemen Pengguna & Peran — modul paling sensitif dalam sistem:

| Uji | Yang dijaga |
|---|---|
| **Hanya super-admin dapat menyentuh modul ini sama sekali** | 11 peran lain diuji satu per satu — `403`, bukan sekadar dibatasi |
| Pengguna baru dapat langsung masuk dengan sandinya | sandi benar-benar tersimpan hash yang cocok, bukan sekadar "tersimpan" |
| Email kembar ditolak | `422`, bukan galat basis data mentah |
| **Pengguna nonaktif ditolak masuk dengan pesan yang SAMA PERSIS dengan sandi salah** | membedakannya membocorkan bahwa akunnya ada tetapi dikunci |
| **Admin tidak dapat menonaktifkan akun sendiri** | mencegah mengunci diri sendiri keluar dari sistemnya sendiri |
| **Admin tidak dapat mencabut peran Super Admin dari akun sendiri** | tanpa itu, admin terakhir dapat mencabut wewenangnya sendiri tanpa ada yang tersisa untuk memulihkan |
| Admin boleh menambah peran lain pada akun sendiri | selama peran Super Admin tetap ada, tidak ada risiko kunci diri |
| Tapis pencarian dan status bekerja | daftar besar tetap dapat disaring |
| Matriks peran menyebut jumlah pengguna sungguhan | dihitung dari basis data, bukan angka tetap purwarupa |

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
| **Butir templat ikut terkirim saat pelaksanaan dimulai** | tanpanya antarmuka harus menebak isi formulir lewat panggilan kedua ke templatnya sendiri — mudah terlupakan, membuat "mulai" terasa tidak lengkap |
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
| Pekerjaan dapat melekat pada ruangan atau laboratorium, bukan alat saja | purwarupa memang punya work order fasilitas, bukan alat semata |
| **Target wajib tepat satu** | `422` aplikasi, dan `CHECK` basis data menolak walau lapis aplikasi dilewati |
| **Kalibrasi ditolak untuk ruangan/laboratorium** | `422` aplikasi, dan `CHECK` basis data menolak walau lapis aplikasi dilewati |
| Menyelesaikan pekerjaan ruangan tidak menyentuh kondisi aset | tidak ada aset untuk diperbarui |
| Widget dashboard ikut menghitung target ruangan & laboratorium | bukan hanya yang menempel pada alat |
| **Daftar dapat disaring rentang tanggal (`sejak`/`sampai`) atas kolom `jadwal`** | dipakai Kalender Terpadu bersama filter serupa pada pemesanan & peminjaman |

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
| **Daftar dapat disaring rentang tanggal (`sejak`/`sampai`)** | dipakai Kalender Terpadu untuk mengambil satu bulan sekaligus |

Asset Register & Asset Movement — layar umum di atas tabel `assets` yang
sama dengan Register BMN:

| Uji | Yang dijaga |
|---|---|
| Pemasok dan tanggal garansi tersimpan | kolom baru, di luar cakupan penatausahaan BMN |
| Pemasok dan garansi boleh dikosongkan | tidak semua aset punya vendor tunggal atau garansi |
| Daftar dapat ditapis `status_penggunaan` persis | dipakai layar Asset Register, mis. menyaring yang sudah "Dihapuskan" |
| **Ringkasan menghitung "garansi akan berakhir" atas SELURUH aset dalam cakupan** | pola yang sama dengan `RingkasanAset` lain — bukan dari halaman yang tampil |
| **Garansi yang sudah lewat TIDAK terhitung "akan berakhir"** | tindakannya beda: yang sudah lewat butuh keputusan lain, bukan sekadar perpanjangan |
| **Feed mutasi menggabungkan riwayat lintas seluruh aset** | layar "Asset Movement & Mutasi" butuh satu feed, bukan riwayat per-aset satu-satu |
| Feed mutasi dapat dicari per nama/kode aset | daftar mutasi tanpa cara mencari aset tertentu tidak berguna untuk satuan kerja besar |
| Feed mutasi tamu ditolak | `401`, konsisten dengan seluruh endpoint aset lainnya |
| **Ringkasan menghitung jumlah & nilai buku aset "Dihapuskan"** | dipakai KPI "Aset Dihapuskan" pada Laporan Aset |
| **Komposisi per kode barang diurutkan terbanyak dahulu** | itulah yang pertama ingin dilihat pengelola aset, bukan urutan abjad |
| Bawaan tetap 25 per halaman tanpa parameter | layar lain tidak ikut terbebani permintaan yang lebih berat |
| `per_halaman` dapat diperbesar | dipakai Studio Label & Barcode untuk memuat barang yang dapat dipilih |
| **`per_halaman` diminta 500, dibatasi 200** | permintaan berlebihan dituruti sebagian dengan batas jelas, bukan ditolak atau dituruti mentah-mentah |
| **Daftar dapat ditapis `wajib_kalibrasi` dan `laboratory_id`** | dipakai layar Manajemen Alat Laboratorium — filter di atas tabel `assets` yang SAMA, bukan endpoint baru |
| **Kalibrasi terakhir hanya tampil untuk alat wajib kalibrasi** | alat lain (`wajib_kalibrasi=false`) tidak membawa medan `kalibrasi` sama sekali |
| Ringkasan dapat ditapis `wajib_kalibrasi` | KPI "Total Alat"/"Nilai Investasi" pada layar yang sama dihitung atas populasi yang sudah disaring, bukan seluruh Register BMN |

Widget lepas dari dashboard (`GET /api/dashboard/widget`) — dipakai layar Laporan:

| Uji | Yang dijaga |
|---|---|
| Tamu ditolak | `401`, sama seperti seluruh endpoint lain |
| Kunci tidak dikenal ditolak `404` | bukan diteruskan diam-diam ke `DataWidget` lalu gagal di tempat lain |
| **Mengembalikan bentuk yang sama dengan yang dashboard tampilkan** | `DashboardWidget` di sini SENGAJA tidak disimpan — sekadar bungkus in-memory memanggil `DataWidget::untuk()` apa adanya, tidak menduplikasi perhitungannya |
| Sebaran status booking dihitung benar | `booking.status` — dipakai KPI Total Booking & Cancellation Rate pada Laporan Ruangan |
| **Widget tanpa izin mengembalikan penanda, bukan angka** | otorisasi per widget SUDAH ditegakkan di dalam `DataWidget::untuk()` sendiri — rute ini hanya menuntut `dashboard.lihat` sebagai syarat masuk paling luar, persis seperti `widgetTersedia()` |
| **`aset.kepatuhan-kalibrasi` dihitung dari sisi aset, bukan dari sisi baris kalibrasi** | alat yang BELUM PERNAH dikalibrasi sama sekali tidak punya baris kalibrasi — bertolak dari tabel kalibrasi akan melewatkannya diam-diam sebagai "patuh" |

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

Vendor & Mitra — modul baru, plus tautan opsional dari `AssetMaintenance`:

| Uji | Yang dijaga |
|---|---|
| Tamu ditolak | `401` pada seluruh endpoint `vendors` |
| Facility manager dapat mendaftarkan vendor | tingkat UBAH pada matriks, dicerminkan dari `master-data` |
| Employee ditolak lihat maupun tulis | `403`, modul ini bukan `-` di matriks bagi employee, tapi employee memang `-` |
| Kode kembar ditolak | `422`, indeks unik `vendors.kode` |
| **Rating di luar 0–5 ditolak** | `422` dari validasi **dan** `CHECK` basis data — dua lapis, bukan cuma satu |
| Tanpa kontrak tetap boleh dikosongkan | `kontrak_berlaku_sampai` nullable dipakai langsung sebagai penanda "per proyek" |
| Daftar dapat dicari dan ditapis kategori | `cari` (ilike nama/kode/kategori) dan `kategori` persis |
| **Nonaktifkan bukan menghapus baris** | `destroy()` men-set `aktif=false`; baris dan riwayat pekerjaannya tetap ada |
| **`jumlah_pekerjaan`/`total_biaya` dihitung dari `AssetMaintenance.vendor_id`** | `withCount`/`withSum`, bukan N+1 per baris |
| Vendor dapat ditautkan saat menjadwalkan pemeliharaan | `POST /api/pemeliharaan` menerima `vendor_id` opsional, `MaintenanceResource` memuatnya |
| **Vendor dihapus tidak menghalangi riwayat pekerjaan lama** | `nullOnDelete` pada `asset_maintenances.vendor_id` — jaring pengaman seandainya baris vendor benar-benar hilang di masa depan, bukan jalur normal (jalur normal adalah nonaktifkan) |

Audit Aset — stock opname, modul baru:

| Uji | Yang dijaga |
|---|---|
| Tamu ditolak | `401` pada seluruh endpoint `audit-aset` |
| Asset manager dapat memulai sesi | tingkat PENUH, dicerminkan dari `aset` |
| Lab manager hanya boleh lihat, tidak boleh menulis | tingkat LIHAT — buat sesi dan memindai sama-sama `403` |
| Employee ditolak sepenuhnya | tingkat `-`, dicerminkan dari `aset` |
| Pemindaian ditemukan sesuai catatan | `temuan.kode === 'sesuai'`, lokasi/kondisi tercatat dan ditemukan sama |
| **Pemindaian dapat dicari lewat `bmn_id` ATAU `serial_number`, bukan cuma `kode_internal`** | auditor di lapangan tidak selalu tahu kode mana yang tercetak di label yang mereka pindai |
| Kode tidak dikenali ditolak | `422`, bukan diam-diam membuat baris pemindaian kosong |
| Lokasi berbeda terdeteksi | `lokasi_ditemukan` menyimpang dari snapshot `lokasi_tercatat` |
| Kondisi berbeda terdeteksi | `kondisi_ditemukan` menyimpang dari snapshot `kondisi_tercatat` |
| **Memindai ulang aset yang sama MEMPERBARUI baris, bukan menggandakan** | indeks unik sesi+aset — hitungan "sudah diverifikasi" tidak boleh mengembang karena kesalahan pindai berulang |
| Pemindaian pada sesi tertutup ditolak | `422`, sesi yang sudah selesai tidak menerima data baru |
| Menutup sesi yang sudah tertutup ditolak | `422`, bukan tanpa efek yang tampak berhasil |
| **`belum_diaudit` berubah jadi `tidak_ditemukan` — angka SAMA — begitu sesi ditutup** | inti dari cara "tidak ditemukan" dihitung: selisih populasi vs yang dipindai, bukan baris tersendiri (lihat catatan di bawah) |
| **Baris `temuan` hanya memuat yang menyimpang** | yang sesuai catatan sudah terhitung di `ringkasan.sesuai`, tidak perlu digandakan sebagai baris |
| **Populasi DAN pemindaian sama-sama dibatasi cakupan gedung** | memindai aset di luar gedung yang diampu ditolak `422` "kode tidak dikenali" — persis seperti asetnya tidak ada, bukan pesan otorisasi yang membocorkan keberadaannya |
| Daftar sesi memuat jumlah pindaian | `withCount('scans')` pada `index()` |

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

- **Alat punya syarat kelayakan yang tidak dimiliki ruangan: KALIBRASI.**
  Alat ukur berkalibrasi kedaluwarsa secara teknis "bebas", tetapi hasil
  pengujian yang memakainya tidak sah. Membiarkannya tampak tersedia berarti
  membiarkan orang menghasilkan data uji yang harus dibuang. Ia ditandai tidak
  tersedia, **alasannya disebutkan**, dan tetap tampil — alat yang hilang dari
  daftar membuat peminjam mengira daftarnya rusak. Ketika bentrok jadwal dan
  kalibrasi sama-sama berlaku, yang disebut adalah jadwalnya: itulah yang
  dapat ditindaklanjuti pengguna.
- **Ketersediaan ruangan ditanyakan ke server, bukan dihitung peramban.**
  Antarmuka dapat menghitungnya dari daftar pemesanan yang sudah dimuat,
  tetapi daftar itu berumur beberapa detik sampai menit. Yang terjadi bukan
  sekadar layar usang: pengguna melihat "tersedia", mengisi seluruh formulir,
  lalu ditolak pada langkah terakhir — dan **ia tidak punya cara tahu
  mengapa, karena layarnya baru saja mengatakan sebaliknya**. Jawabannya pun
  tetap perkiraan; jaminannya tetap pemicu basis data. Endpoint ini hanya
  membuat penolakan itu jarang, bukan mustahil.
- **Aturan rentangnya sama persis dengan pemicu.** Setengah terbuka
  `[mulai, selesai)`, dan status yang memblokir dibaca dari
  `STATUS_TIDAK_MEMBLOKIR` yang sama. Berbeda sedikit saja, pemeriksaan dan
  penyimpanan berselisih pendapat — dan yang kalah adalah pengguna.
- **Ruangan dalam pemeliharaan ditandai tidak tersedia tetapi tetap tampil.**
  Slotnya memang kosong, tetapi memesannya keliru; menyembunyikan ruangannya
  membuat pemesan bertanya-tanya ke mana perginya.
- **Ringkasan Register BMN dihitung server atas seluruh aset dalam cakupan.**
  Daftarnya berhalaman 25 baris; ringkasan yang dihitung antarmuka dari
  halaman pertama akan melaporkan nilai perolehan seperempat miliar untuk
  satuan kerja yang asetnya puluhan miliar. **Angka itu tidak tampak salah —
  ia hanya kecil** — dan justru karena itu tidak ada yang mempertanyakannya.
  Endpoint `GET /api/assets/ringkasan` didaftarkan sebelum `assets/{asset}`,
  kalau tidak "ringkasan" tertangkap sebagai id aset.
- **Penyusutan pada ringkasan dihitung kelas `Penyusutan`, bukan diulang
  sebagai rumus SQL.** Rumus yang ditulis dua kali akan menyimpang, dan yang
  menyimpang di sini adalah angka laporan keuangan. Konsekuensinya seluruh
  aset dalam cakupan ditarik ke memori — murah untuk ratusan sampai beberapa
  ribu aset dengan lima kolom; bila kelak puluhan ribu, penggantinya kolom
  penyusutan terjadwal, bukan rumus SQL kedua.
- **NUP tidak pernah dikirim peramban.** Wizard registrasi menampilkan
  pratinjau NUP, tetapi nomor yang tersimpan diterbitkan server: peramban
  menghitungnya dari data yang sudah dimuatnya sendiri, dan dua petugas yang
  mendaftarkan barang bersamaan akan memperoleh angka yang sama. Ketahuannya
  baru saat rekonsiliasi SIMAK-BMN — setelah labelnya telanjur tercetak dan
  tertempel. Pratinjaunya karena itu ditandai tegas sebagai **perkiraan**,
  dan uji peramban mengunci selisihnya: tebakan 00003 versus terbitan server
  00007, yang ditampilkan harus milik server.
- **Kegagalan unggah foto tidak membatalkan registrasi.** Barangnya sudah sah
  tercatat; memutar balik pendaftaran karena satu gambar gagal akan membuang
  NUP yang sudah terpakai, dan NUP tidak pernah dipakai ulang. Kegagalannya
  dilaporkan, fotonya dapat ditambahkan kemudian.
- **Foto aset disimpan di luar docroot dan dilayani lewat rute.** Foto alat
  laboratorium memperlihatkan nomor seri, label BMN, dan tata letak ruangan
  tempat alat mahal disimpan. Di direktori publik, seluruhnya dapat diambil
  siapa pun yang menebak nama berkasnya — dan nama berkas berpola membuat
  menebaknya sepele. Rutenya juga memeriksa bahwa foto itu memang milik aset
  pada jalurnya: tanpa itu, siapa pun yang boleh melihat satu aset dapat
  mengambil foto aset mana pun hanya dengan mengganti angka pada URL.
- **Jenis berkas ditentukan dari isinya, bukan dari ekstensi atau
  Content-Type.** Keduanya sepenuhnya dikendalikan pengirim; berkas PHP
  bernama `alat.jpg` dengan `Content-Type: image/jpeg` lolos pemeriksaan yang
  memercayainya. Diperiksa dua kali — `getMimeType()` lalu `getimagesize()` —
  karena berkas dengan header gambar sah di depan dan muatan lain di
  belakangnya tetap dikenali yang pertama sebagai gambar. Nama berkasnya
  dibangkitkan, tidak pernah memakai nama kiriman yang dapat memuat `../`.
- **`kapasitas_ukur` adalah teks, bukan angka.** Yang ditulis petugas
  berbentuk `0,1–500 mg/L`, `±0,0001 g`, `20–200 °C` — rentang bersatuan.
  Memaksanya menjadi angka membuang satuan dan batas bawahnya, yaitu justru
  bagian yang menentukan apakah alat itu cocok untuk sebuah pengujian.
- **Fasilitas disimpan sebagai jsonb, teknisi sebagai tabel penghubung.**
  Keduanya "daftar", tetapi pertanyaannya berbeda. Fasilitas tidak pernah
  dikueri sendirian — selalu dibaca bersama laboratoriumnya. Teknisi
  sebaliknya: "laboratorium mana saja yang ditangani orang ini" benar-benar
  diajukan saat menyusun jadwal, saat orang itu cuti, dan saat menentukan
  siapa yang menerima notifikasi perawatan. Menyimpannya sebagai daftar id di
  dalam jsonb membuat pertanyaan itu hanya terjawab dengan memindai seluruh
  tabel, dan tak ada yang menjaga id-nya tetap menunjuk pengguna yang ada.
- **Penugasan teknisi hanya disentuh bila memang dikirim.** Tanpa penjagaan
  itu, menyunting satu kolom lewat PATCH tanpa menyertakan daftar teknisi akan
  MENGHAPUS seluruh penugasan — kehilangan diam-diam yang baru ketahuan saat
  notifikasi jadwal perawatan tidak sampai ke siapa pun. Larik kosong tetap
  berarti "tidak ada teknisinya"; yang diabaikan hanya ketiadaan medannya.
- **Endpoint pemilih pengguna tidak pernah mengirim surel.** Formulir ruangan,
  laboratorium, dan aset perlu memilih penanggung jawab dan teknisi, sehingga
  `GET /api/pengguna` terbuka bagi hampir semua peran yang menyunting master
  data. Daftar surel seluruh pegawai adalah bahan baku paling berguna bagi
  siapa pun yang menyiapkan phishing; nama saja sudah cukup untuk memilih.
  Dibatasi keras 50 baris, dan pemotongannya diberitahukan supaya antarmuka
  meminta pencarian dipersempit alih-alih diam-diam menyembunyikan orangnya.
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
- **Perubahan RUTE juga memicu pembangunan ulang cache.** Penerapan yang
  hanya menambah endpoint — tanpa migrasi dan tanpa menyentuh `.env` —
  meninggalkan `route:cache` lama, dan rute barunya menjawab **404 di
  produksi meski kodenya sudah ada di server**. Ketahuan saat menambah
  endpoint ketersediaan ruangan. Sidik jarinya kini mencakup `routes/`,
  `config/`, `bootstrap/`, dan `.env` sekaligus — dan memakai **isi berkas,
  bukan mtime**, karena `git reset --hard` menyentuh mtime seluruh berkas pada
  setiap penerapan sehingga skripnya tidak akan pernah bisa beristirahat.
  Probe pasca-penerapan kini juga membedakan 401 dari 404: 404 berarti
  rutenya sendiri tidak ada, 401 berarti rutenya ada dan penjagaannya bekerja.
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

- **Checklist: penugasan dan pelaksanaan sengaja dua jalur terpisah, bukan
  satu mensyaratkan yang lain.** Penugasan menjawab "siapa yang seharusnya
  mengerjakan"; pelaksanaan mencatat "apa yang benar-benar terjadi". Tombol
  "Jalankan Checklist" pada detail ruangan/laboratorium/aset karenanya tidak
  menuntut penugasan formal lebih dulu — mensyaratkannya akan membuat
  pemeriksaan mendadak (audit dadakan, insiden) mustahil dicatat lewat jalur
  yang benar.
- **Jawaban checklist dikirim segera saat butirnya diisi**, bukan ditahan
  sampai "Selesaikan" ditekan. Menahannya berarti pengisian satu jam kerja
  lapangan hilang total bila peramban tertutup sebelum sempat menekan tombol
  terakhir. Kolom angka/teks baru mengirim saat kehilangan fokus — mengetik
  "12" tidak boleh jadi tiga permintaan berbeda untuk "1", "1", "12".
- **Bug tertangkap saat pengkabelan, bukan lolos ke produksi: mengubah tipe
  butir pada pembuat templat tidak menyingkap kolom satuan/pilihan.**
  `ckSetButir()` mengubah keadaan tapi tidak pernah menggambar ulang
  daftarnya — memilih "Angka" untuk sebuah butir tidak pernah membuka kolom
  satuannya. Diperbaiki dengan menggambar ulang khusus saat tipenya berubah
  (bukan pada tiap ketukan lain, atau fokus mengetik akan hilang), dan
  dikunci uji peramban yang sengaja mengubah tipe lalu memeriksa kolom
  satuannya benar-benar dapat diisi.
- **Bug kedua: halaman "Checklist Saya" tidak menyegarkan diri setelah
  pelaksanaan selesai bila hash-nya tidak berubah.** Router hanya menggambar
  ulang saat peristiwa `hashchange` menyala; menekan "Kembali ke Tugas Saya"
  dari layar yang memang sudah `#/mychecklist` tidak memicu apa pun, jadi
  riwayat yang baru selesai tidak tampak sampai pengguna pindah halaman lalu
  kembali. Diperbaiki dengan menyegarkan data itu langsung dari
  `ckSelesaikanRun()`, bukan digantungkan ke navigasi yang belum tentu
  terjadi.

- **BSC diberi lapis "sasaran strategis" yang sebelumnya tidak ada di basis
  data.** Kartu skor semula dua tingkat: perspektif → indikator langsung.
  Purwarupa yang sudah disetujui tiga tingkat — Kaplan & Norton memang
  begitu: setiap perspektif berisi beberapa sasaran strategis, dan setiap
  sasaran berisi indikatornya sendiri. Tabel `bsc_objectives` ditambahkan,
  bukan dipangkas dari purwarupa. Sasaran sengaja TIDAK berbobot sendiri —
  bobot tetap dijumlahkan per PERSPEKTIF seperti sebelumnya, ditegakkan
  pemicu tertunda yang sama; sasaran murni pengelompokan tampilan.
  `bsc_objective_id` pada indikator memakai `cascadeOnDelete`, supaya
  menulis ulang satu perspektif (hapus sasaran lama, buat baru) ikut
  membersihkan indikator lamanya lewat basis data, bukan lewat urutan
  panggilan aplikasi yang harus selalu benar.
- **Tren skor BSC mengikuti periode yang sungguhan tercatat, bukan bulan
  kalender.** Purwarupa mengasumsikan riwayat bulanan; periode BSC di sini
  tahunan atau triwulanan (lihat validasinya), dan tidak ada satu tempat pun
  yang menyimpan "skor bulan Maret" terpisah. Mengarang angka bulanan dari
  data yang sama sekali tidak berbutir bulan akan menjadi tren yang
  kelihatan meyakinkan tapi dikarang — endpoint `GET /api/bsc/tren`
  karenanya mengembalikan satu titik per periode yang pernah diisi.
- **Katalog widget dashboard diperluas dari 13 menjadi 41 kunci**, supaya
  cakupannya sedekat mungkin dengan Dashboard Operasional, Manajemen, dan
  Analitik pada purwarupa. Dua bentuk data baru ditambahkan: `deret` (tren
  bulanan) dan `matriks` (heatmap okupansi). Beberapa widget purwarupa
  DIJATUHKAN dengan sengaja, bukan dipangkas diam-diam:
  - **Utilisasi laboratorium** — laboratorium tidak punya mekanisme
    pemesanan sendiri di server (hanya ruangan yang punya `bookings`),
    sehingga tidak ada data sungguhan untuk dihitung.
  - **Widget pengunjung/kunjungan** — domainnya belum punya model di
    server sama sekali; menambahkannya berarti membangun modul baru, bukan
    menyambungkan yang sudah ada.
- **Utilisasi ruangan memakai asumsi jam operasional yang dinyatakan
  tegas: 08.00–18.00 (10 jam), Senin–Sabtu.** Tidak ada satu pun tempat di
  sistem ini yang menyimpan jam operasional fasilitas sesungguhnya. Angka
  ini karenanya PERKIRAAN, bukan fakta tercatat — dicatat di kode dan di
  sini supaya tidak diam-diam dianggap presisi. **Perlu dipastikan ke
  satuan kerja** sebelum dipakai sebagai dasar keputusan (lihat §8.1).
- **Dashboard bawaan pengguna baru tetap terkurasi walau katalognya
  membesar.** `RegistriWidget::BAWAAN` adalah subset terpilih (14 kunci),
  bukan "seluruh widget yang izinnya dipunyai peran ini" — tanpa kurasi itu,
  Super Admin yang izinnya luas akan mendapat dashboard pertama berisi
  puluhan widget sekaligus, sebaliknya dari maksud "berguna sejak login
  pertama".
- **Panel "Peringatan Operasional" (`sistem.peringatan`) tidak punya izin
  tunggal.** Ia menggabungkan kondisi mendesak dari domain berbeda —
  kalibrasi, pemeliharaan, checklist, penagihan — dan tiap butir di
  dalamnya diperiksa izinnya sendiri-sendiri. Orang yang tidak berwenang
  atas kalibrasi tetap dapat memasang panel ini tanpa pernah melihat butir
  kalibrasinya, alih-alih panel itu ditolak seluruhnya.
- **Widget "Catatan" (`catatan.bebas`) satu-satunya yang tidak menghitung
  apa pun di server** — isinya murni teks yang diketik pengguna, tersimpan
  di `opsi.catatan` milik widgetnya sendiri. Tidak butuh izin: menulis
  catatan sendiri bukan akses ke data siapa pun.
- **Dashboard & BSC di sisi antarmuka bercabang di TINGKAT HALAMAN, bukan
  di tingkat data seperti modul lain.** Setiap modul lain memetakan data
  purwarupa ke bentuk API yang sama persis, supaya satu tampilan melayani
  dua sumber. Mesin widget purwarupa (drag-and-drop, `SOURCES`/`METRICS`
  bebas komposisi) sudah berdiri sendiri sejak sebelum modul ini
  tersambung, dan katalog widget server sengaja TIDAK dimaksudkan mencakup
  seluruh sumber data purwarupa yang bebas — itu batas keamanan yang
  disengaja (lihat `RegistriWidget`), bukan kekurangan untuk ditambal
  dengan pemetaan. Karena itu rute yang sama memilih mesin purwarupa atau
  mesin tersambung berdasarkan `Repo.dapatMenulis()`, dan mesin purwarupa
  tidak disentuh sama sekali oleh pekerjaan ini.
- **Susun-ulang dan ubah ukuran pada dashboard tersambung memakai tombol
  naik/turun dan kolom angka, BUKAN seret-lepas seperti purwarupa.**
  Penyederhanaan yang disengaja: fisika seret-lepas purwarupa terikat erat
  pada penyimpanan `localStorage`-nya sendiri, dan menulis ulangnya untuk
  menyimpan ke server adalah pekerjaan terpisah dari menyambungkan data
  sungguhan. Yang dijaga adalah kebenarannya — tata letak benar-benar
  tersimpan ke server dan bertahan setelah muat ulang — bukan kehalusan
  interaksi seret-lepasnya.
- **Bug tertangkap saat pengkabelan: `Repo.dashboard.utama()` tidak
  dijaga try/catch pada jalur mount pertama kali.** Uji peramban yang
  memakai server tiruan tanpa endpoint dashboard langsung menangkapnya
  sebagai galat halaman tak tertangani begitu rute manapun dibuka setelah
  masuk — karena rute bawaan aplikasi memang `#/dashboard`. Diperbaiki
  dengan try/catch yang sama seperti jalur pemuatan dashboard lainnya.

- **`asset_maintenances` diperluas dari "hanya menempel pada alat" menjadi
  boleh menempel pada ruangan, laboratorium, atau alat** — pola yang sama
  dengan `MelekatPadaSumberDaya` yang sudah dipakai Checklist, karena
  purwarupa yang disetujui memang punya work order pemeliharaan pada
  ruangan dan laboratorium, bukan alat saja. `asset_id`, yang tadinya
  `NOT NULL`, dibuat nullable, dan `CHECK num_nonnulls(room_id,
  laboratory_id, asset_id) = 1` menegakkan "tepat satu target" di basis
  data, bukan hanya di lapis aplikasi.
- **Kalibrasi tetap dibatasi hanya untuk alat, walau target pemeliharaan
  diperluas.** Menyuntik alat kalibrasi tidak masuk akal untuk ruangan atau
  laboratorium — dijaga dua lapis: `StoreMaintenanceRequest` menolak dengan
  pesan berbahasa Indonesia, dan `CHECK jenis <> 'kalibrasi' OR asset_id IS
  NOT NULL` menegakkannya lagi di basis data seandainya lapis aplikasi
  terlewati.
- **Nama tabel dan model — `AssetMaintenance` / `asset_maintenances` —
  sengaja TIDAK diganti** walau cakupannya sudah melampaui aset. Mengubah
  nama berarti menyentuh setiap referensi (model, migrasi, factory,
  resource, controller, rute, dokumen) untuk nol manfaat fungsional, dan
  belum ada data produksi yang bergantung pada nama lama. Keputusan ini
  dicatat tegas di docblock migrasi `2026_08_22_090000_lengkapi_target_
  pemeliharaan.php` supaya tidak diam-diam ditafsirkan sebagai kealpaan
  saat modul ini dibaca ulang nanti.
- **Cakupan data (`dalamCakupan`) pada widget dashboard pemeliharaan
  harus diperiksa lewat KETIGA relasinya, bukan `asset` saja.** Widget
  `pemeliharaan.aktif`, `pemeliharaan.jenis`, `pemeliharaan.biaya-ytd`, dan
  panel peringatan operasional semula memfilter cakupan lewat
  `whereHas('asset', ...)` peninggalan sebelum perluasan ini — yang berarti
  pekerjaan pada ruangan atau laboratorium akan diam-diam TIDAK PERNAH
  ikut terhitung, bukan galat yang kelihatan, melainkan angka yang salah
  tanpa tanda apa pun. Ditangkap sebelum sempat jadi bug produksi dan
  diperbaiki dengan helper `pemeliharaanDalamCakupan()` yang memeriksa
  ketiga relasi sekaligus (`asset` ATAU `room` ATAU `laboratory`).
- **Layar Kalibrasi Alat dan Maintenance & Work Order di sisi antarmuka
  adalah SATU mesin dengan dua tapis, bukan dua sumber data terpisah** —
  mengikuti persis bagaimana server menyimpan keduanya di satu tabel.
  Purwarupa memakai dua koleksi berbeda (`D.maintenance` dan
  `D.calibration`, dengan nama medan yang berbeda pula); `Repo.pemeliharaan`
  memetakan keduanya ke satu bentuk yang sama dengan jawaban server sebelum
  digabungkan, supaya kedua layar tidak perlu tahu sedang berjalan di mode
  purwarupa atau tersambung.
- **Bug tertangkap saat pengkabelan: spanduk "alat kalibrasinya
  kedaluwarsa" hanya disegarkan saat halaman pertama kali dibuka, tidak
  setelah menjadwalkan atau menyelesaikan kalibrasi dari halaman yang
  sama.** Uji peramban yang menjadwalkan kalibrasi lampau lalu memeriksa
  spanduknya langsung menangkap ini — spanduk tetap kosong walau baris
  barunya sudah tampil di tabel. Diperbaiki dengan memanggil ulang
  `muatAlertKalibrasi()` di titik yang sama dengan penyegaran daftarnya,
  bukan hanya di `mount()`.

- **`tariffs` diperluas dengan kolom `jenis` (`tarif`/`addon`/`paket`),
  `deskripsi`, dan `kapasitas`, menyatukan tiga layar purwarupa (Daftar
  Tarif, Tarif Add-on, Paket Layanan) menjadi satu tabel dengan satu
  tapisan.** Ketiganya sama-sama "barang berharga yang dapat dijual" dengan
  medan yang identik — nama, harga, satuan, status aktif — dan kelak akan
  sama-sama dicari sebagai baris tagihan lewat mekanisme yang sama
  (`PenagihanService::barisDariTarif`). Membuat tiga tabel terpisah berarti
  menduplikasi logika itu tiga kali untuk nol manfaat struktural.
- **Purwarupa memberi tiap fasilitas EMPAT angka harga sekaligus (internal,
  eksternal, setengah-hari, lembur) dalam satu baris; server menyimpannya
  sebagai baris terpisah per (fasilitas, segmen, satuan waktu).** Ini
  PENYEDERHANAAN YANG DISENGAJA, bukan kealpaan: skema tarif per-baris
  lebih fleksibel untuk segmen apa pun (bukan hanya internal/eksternal),
  tetapi tidak mempunyai satuan "setengah-hari"/"lembur" tersendiri.
  Menambah dua satuan waktu itu demi mereplikasi tata letak empat-kolom
  purwarupa persis apa adanya tidak sepadan dengan manfaatnya — dicatat di
  sini dan di komentar `Repo.tarif` supaya jelas ini keputusan, bukan
  celah yang terlewat.
- **Diskon tidak dimodelkan sebagai kolom atau baris tersendiri**, baik
  pada `quotations` maupun `invoices`. Baik `invoice_lines` maupun
  `quotation_lines` menegakkan `harga_satuan >= 0` — TIDAK ADA ANGKA UANG
  NEGATIF, aturan yang sudah ditegakkan sejak migrasi penagihan pertama.
  Diskon yang dinegosiasikan karenanya dituliskan langsung sebagai
  penyesuaian harga satuan baris terkait sebelum penawaran dikirim, bukan
  baris "Diskon" bernilai minus.
- **Quotation adalah tabel sendiri, bukan status tambahan pada Invoice.**
  Purwarupa memisahkan tegas keduanya: quotation BOLEH berubah sebelum
  disetujui (harga baris dapat dinegosiasikan), invoice TIDAK BOLEH
  berubah setelah terbit (baris adalah cuplikan permanen). Menyatukan
  keduanya dalam satu tabel berarti kehilangan bedanya — status mana yang
  "masih boleh diedit" akan bergantung pada nilai kolom lain, alih-alih
  pada struktur tabelnya sendiri. `quotation_lines` bercermin persis pada
  `invoice_lines`; saat penawaran diterbitkan jadi invoice, barisnya
  disalin apa adanya (`PenagihanService::terbitkanDariPenawaran`), BUKAN
  dihitung ulang dari tarif yang berlaku saat itu — supaya kenaikan tarif
  setelah negosiasi tidak diam-diam mengubah angka yang sudah disepakati.
- **Kedaluwarsa penawaran dihitung dari tanggal, bukan disimpan sebagai
  status** — pola yang sama dengan `AssetMaintenance::terlambat()`.
  Status tersimpannya tetap `terkirim`/`negosiasi` sampai staf mengambil
  keputusan; "sudah lewat tanggal berlaku" adalah fakta tanggal yang
  berubah sendiri seiring waktu, bukan keputusan yang perlu dicatat.
  Penawaran yang sudah `disetujui` tidak pernah dianggap kedaluwarsa lagi,
  bahkan setelah tanggal berlakunya lewat — persetujuan mengunci
  kesepakatan terlepas dari jendela waktu keputusan klien.
- **Pembayaran mendapat kolom `status` (`menunggu_verifikasi`/
  `terverifikasi`), bawaan `terverifikasi`.** Purwarupa membedakan
  keduanya karena staf mencatat transfer yang dilaporkan klien sebelum
  benar-benar memastikan uangnya masuk. Baku mutu `terverifikasi` dipakai
  sebagai bawaan karena satu-satunya jalur pencatatan saat ini adalah staf
  mengetik langsung (bukan gerbang pembayaran daring yang melapor
  sendiri) — `menunggu_verifikasi` tersedia eksplisit untuk staf yang
  memang belum yakin. `Invoice::terbayar()` hanya menjumlah pembayaran
  terverifikasi, supaya pembayaran yang belum dipastikan tidak diam-diam
  membuat tagihan tampak lunas.
- **Endpoint `GET /api/pembayaran` (riwayat pembayaran lintas tagihan)
  ditambahkan khusus untuk layar "Pembayaran".** Purwarupa menampilkannya
  sebagai satu daftar global, bukan pembayaran per tagihan satu-satu —
  endpoint yang sudah ada (`GET /api/tagihan/{id}`) tidak dapat
  menjawabnya tanpa mengambil setiap tagihan satu per satu di sisi klien.
- **Alur sewa di sisi antarmuka TIDAK mereplikasi 9 tahap purwarupa**
  (Pilih Fasilitas → Cek Availability → Paket & Add-on → Quotation →
  Approval → Invoice → Pembayaran → Penggunaan → Berita Acara). Sembilan
  tahap itu adalah dekorasi funnel, bukan status yang benar-benar
  tersimpan — server hanya punya 5 status penyewaan
  (draf/dikonfirmasi/berjalan/selesai/dibatalkan). Halaman tersambung
  menampilkan status sungguhan itu apa adanya dan menautkan langsung ke
  aksi "Buat Penawaran"/"Tagih Langsung" per baris — pola penyederhanaan
  yang sama dengan Dashboard mengganti seret-lepas dengan tombol
  naik/turun: yang dijaga adalah kebenaran datanya, bukan kehalusan
  dekorasi alur yang tidak berpadanan dengan skema.

- **Audit Trail disambungkan tanpa satu pun perubahan backend** —
  `AuditController`/`AuditLogResource` sudah lengkap sejak modul BMN
  dibangun, hanya belum pernah dipakai layarnya sendiri. Kategori
  aktivitas purwarupa yang lebih kaya (`CREATE`/`UPDATE`/`DELETE`/
  `APPROVE`/`LOGIN`/`NOTIFY`/`CHECKIN`) dipetakan ke tiga peristiwa yang
  benar-benar tersimpan server (`dibuat`/`diubah`/`dihapus`) di
  `Repo.audit`, karena jejak audit sungguhan hanya mencatat perubahan
  kolom model — menyetujui pengajuan atau login pengguna tidak selalu
  mengubah kolom yang diaudit, sehingga tidak punya padanan peristiwa
  tersendiri di server.
- **KPI Audit Trail dihitung dari EMPAT permintaan paralel** (hari ini,
  dibuat, diubah, dihapus), masing-masing hanya membaca `meta.total` dari
  jawaban terpaginasi — bukan dihitung dari baris yang kebetulan tampil
  di satu halaman. Purwarupa menampilkan angka tetap (1.482 aktivitas,
  187 login berhasil) yang tidak berpadanan dengan data sungguhan sama
  sekali; KPI "Login Berhasil" dan "Retensi Log" dijatuhkan karena tidak
  ada data login atau kebijakan retensi yang tersimpan di mana pun.
- **Detail perubahan ditampilkan kolom per kolom (sebelum → sesudah),
  bukan dump JSON mentah**, karena `sebelum`/`sesudah` pada `audit_logs`
  hanya berisi kolom yang benar-benar berubah (lihat trait `Diaudit`) —
  menampilkannya sebagai tabel kolom/sebelum/sesudah sudah sepenuhnya
  menjawab pertanyaan "apa yang berubah, dari apa menjadi apa" tanpa
  perlu format tambahan.

- **Modul baru `pengguna` ditambahkan ke `MatriksAkses::MODUL`, dikunci
  PENUH hanya untuk super-admin dan `-` untuk seluruh 11 peran lain, TANPA
  kecuali — lebih ketat daripada pola `PERLU_DIKONFIRMASI` yang biasa
  dipakai menyimpulkan tingkat dari PRD.** Modul ini tidak ada di
  SECURITY.md §4.1, dan membuat/menonaktifkan akun serta melihat peran
  siapa punya akses apa adalah salah satu tindakan paling sensitif dalam
  sistem ini — melebar-lebarkan aksesnya tanpa persetujuan eksplisit
  pemilik produk berisiko jauh lebih besar daripada mempersempitnya.
  Keputusan ini dicatat tegas di docblock `MatriksAkses::MODUL` sendiri,
  bukan hanya di sini.
- **`users.aktif` MENGGANTIKAN TIGA STATUS PURWARUPA (Aktif/Cuti/Nonaktif)
  DENGAN DUA STATUS SUNGGUHAN.** Tidak ada sistem manajemen cuti di
  aplikasi ini, dan untuk kontrol akses, "sedang cuti" tidak berbeda dari
  "aktif" — pengguna cuti biasanya tetap boleh masuk. Nuansa kepegawaian
  itu bukan keputusan kontrol akses dan sengaja tidak dimodelkan.
- **Tidak ada hapus pengguna, hanya nonaktifkan** — pengguna terhubung ke
  `audit_logs`, `bookings`, pelaksanaan checklist, dan banyak tabel lain
  sebagai pencatat/pelaku. Menghapus barisnya akan meninggalkan referensi
  yatim atau memutus jejak "siapa melakukan apa". Pola yang sama dengan
  status pada Rental/Invoice/Quotation — nonaktifkan, jangan hapus.
- **`aktif => true` ikut sebagai SYARAT PENCOCOKAN BARIS pada
  `Auth::attempt()`, bukan diperiksa terpisah setelahnya.** Pengguna
  nonaktif harus gagal masuk dengan pesan yang SAMA PERSIS dengan sandi
  salah (lihat aturan #1 di `LoginRequest`) — memeriksanya terpisah akan
  membocorkan bahwa akunnya ada tetapi dikunci, sama persis dengan alasan
  pesan galat login diseragamkan sejak awal modul autentikasi dibangun.
- **Admin tidak dapat mengunci dirinya sendiri keluar dari sistemnya
  sendiri** — dua penjagaan eksplisit di `PenggunaAdminController`:
  tidak dapat menonaktifkan akun sendiri, dan tidak dapat mencabut peran
  Super Admin dari akun sendiri. Keduanya tidak menimbulkan galat teknis
  apa pun bila dibiarkan — hanya admin yang tiba-tiba tidak dapat masuk
  lagi, dan tidak ada admin lain yang tersisa untuk memulihkannya.
- **Matriks peran×modul (`GET /api/peran`) TIDAK PUNYA endpoint
  store/update — sengaja tidak dapat diedit lewat antarmuka.**
  `MatriksAkses::MATRIKS` adalah kode, bukan baris tabel: mengeditnya
  lewat antarmuka berarti mengubah otorisasi tanpa tinjauan kode, persis
  yang coba dicegah docblock `MatriksAkses` sejak awal ("izin yang
  ditulis tangan akan menyimpang dari dokumennya"). Halaman "Role & Hak
  Akses" pada purwarupa (yang menawarkan edit sel matriks dan sakelar
  cakupan data) karenanya menjadi murni tampilan hanya-baca; sakelar
  "Pembatasan Data" purwarupa dijatuhkan sama sekali — cakupan data
  (gedung, unit kerja) selalu aktif, bukan pengaturan yang bisa dimatikan.
- **Bug tertangkap saat pengkabelan: `Role::withCount('users')` melempar
  "Class name must be a valid object or a string" khusus di dalam
  permintaan HTTP asli (lulus sempurna di tinker/CLI).** Middleware
  Sanctum MENGUBAH `config('auth.defaults.guard')` menjadi `'sanctum'`
  selama permintaan berlangsung (lewat `Auth::shouldUse()`, yang menulis
  langsung ke config, bukan cuma resolusi guard sesaat) — dan `'sanctum'`
  tidak terdaftar di `config('auth.guards')`, sehingga relasi
  `morphedByMany` milik Spatie gagal me-resolve model User saat instance
  Role-nya masih kosong (belum punya `guard_name`). Diperbaiki dengan
  kueri langsung ke tabel `model_has_roles`, yang tidak bergantung pada
  resolusi guard sama sekali — lebih cepat sekaligus lebih tepercaya.
- **PIC, Teknisi & Operator, Pengunjung, dan Struktur Organisasi pada
  purwarupa SENGAJA TIDAK disambungkan pada modul ini.** Semuanya butuh
  domain server baru yang belum ada sama sekali — delegasi PIC dengan
  SLA eskalasi, workload teknisi dan jadwal, manajemen kunjungan tamu
  (QR invitation, check-in/out, badge), bagan struktur organisasi — bukan
  sekadar menyambungkan yang sudah ada, dan tidak proporsional untuk
  digabung dengan Manajemen Pengguna & Peran. Dijatuhkan dengan sengaja,
  bukan dipangkas diam-diam.

- **Kalender Terpadu menggabungkan TIGA domain yang sudah tersambung
  sendiri-sendiri** (`Repo.booking`, `Repo.peminjaman`, `Repo.pemeliharaan`)
  dalam satu tampilan bulan, bukan tabel/endpoint kalender tersendiri —
  kalender bukan sumber data baru, hanya cara menampilkan tiga sumber yang
  sudah ada sekaligus.
- **Filter rentang tanggal (`sejak`/`sampai`) ditambahkan pada ketiga
  endpoint** (`BookingController`, `EquipmentLoanController`,
  `MaintenanceController`) karena paginasi 25/50 baris tak dapat diandalkan
  menjawab "semua acara bulan ini" — bulan yang ramai bisa saja terpotong
  di halaman pertama. Batas halaman dinaikkan ke 200 KHUSUS ketika kedua
  batas tanggal diisi, agar permintaan tanpa rentang (dipakai layar lain)
  tetap terbatas seperti semula dan tidak disalahgunakan untuk menyedot
  seluruh tabel.
- **Ruangan/Laboratorium/Auditorium purwarupa DISATUKAN menjadi "Ruangan"
  saja** — laboratorium tidak punya mekanisme pemesanan di server (lihat
  §4.2 master data laboratorium), dan auditorium bukan entitas tersendiri,
  hanya salah satu ruangan. Legenda kalender diperbarui dari 5 entri
  purwarupa menjadi 4 entri sungguhan: Booking Ruangan, Peminjaman Alat,
  Pemeliharaan & Kalibrasi, Dibatalkan/Ditolak.
- **Tampilan Hari/Minggu (timeline per jam) dan bilah Filter di samping
  kalender TETAP purwarupa, sengaja tidak disentuh** — keduanya dipakai
  bersama oleh layar "Ketersediaan" (`V["availability"]`) di luar cakupan
  modul ini, dan menyambungkannya di sini berisiko mengubah perilaku layar
  lain tanpa diuji. Bukan potongan diam-diam — tampilan Bulan (yang jadi
  pintu masuk kalender) sudah sepenuhnya sungguhan.
- **Bug purwarupa asli tertangkap saat pengkabelan: `calNav()`/`calMode()`
  merujuk `#calHost`, elemen yang sebelumnya tidak pernah ada di mana pun**
  — berpindah bulan/tampilan diam-diam tidak melakukan apa-apa karena
  `document.getElementById("calHost")` selalu `null`. Diperbaiki dengan
  membungkus keluaran `render()` dalam `<div id="calHost">`.

- **Asset Register dan Register BMN (`V["bmn"]`) membaca/menulis TABEL
  YANG SAMA** — dua layar, satu Repo.aset, satu `AssetController`. Register
  BMN untuk penatausahaan formal (KIB B, studio label); Asset Register
  untuk pemakaian sehari-hari (cari, lihat detail, pindah ruangan). Aset
  yang didaftarkan lewat satu layar langsung terlihat di layar lain, karena
  tidak ada salinan data — hanya dua cara memandangnya.
- **`pemasok` dan `garansi_berakhir` DITAMBAHKAN ke tabel `assets`**
  (migrasi `tambah_pemasok_garansi_pada_assets`) — penatausahaan BMN (PMK
  181/PMK.06/2016) tidak mengenal vendor atau masa garansi, tetapi layar
  Asset Register purwarupa sungguh membutuhkannya untuk klaim garansi.
  "Tabel yang menyusul layar, bukan layar yang dipangkas".
- **Kolom "Kategori" purwarupa (teks bebas) DIGANTI uraian kode barang BMN**
  (`bmn.uraian_barang`) — klasifikasi baku yang sudah ada dan diaudit,
  bukan kategori ad hoc yang bisa menyimpang dari kode barangnya sendiri.
- **Kolom "Lokasi" (gedung) DIHILANGKAN, tersisa "Ruangan" saja** — pola
  yang sama dengan penyederhanaan Kalender Terpadu: ruangan sudah
  menyiratkan gedungnya, dan menampilkan keduanya hanya mengulang informasi.
- **"Status" BUKAN LAGI badge kode tertutup, melainkan `status_penggunaan`
  apa adanya** — kolom itu SUDAH teks bebas di server (dipakai untuk
  kalimat seperti "Digunakan untuk Operasional Satker", dan "Dihapuskan"
  sebagai penanda baku dari `AssetService::hapus()`); memaksanya menjadi
  enum lima nilai purwarupa (Tersedia/Digunakan/Dipinjam/Maintenance/
  Disposal) akan bertentangan dengan pemakaian yang sudah berjalan.
- **Tombol "Buat BAST" purwarupa DIJATUHKAN** — tidak ada dokumen serah
  terima bertanda tangan yang dimodelkan di server; riwayat mutasi adalah
  catatan sistem (`AssetMutation`, append-only), bukan dokumen legal.
- **Tombol "Pinjamkan" MENGARAH ke modul Peminjaman Alat yang sudah
  tersambung**, bukan membuka form sendiri — `EquipmentLoan` sudah
  `belongsTo Asset` persis seperti aset di layar ini, jadi satu alur
  peminjaman lewat satu Repo (`Repo.peminjaman`), bukan dua yang bisa
  menyimpang satu sama lain.
- **`AssetController::mutasiSemua()` ditambahkan untuk feed lintas aset**
  (layar "Asset Movement & Mutasi") — sebelumnya `riwayat()` hanya melayani
  satu aset sekaligus (`GET /api/assets/{asset}/riwayat`), tidak ada yang
  menggabungkan riwayat SELURUH aset dalam cakupan. Dibatasi cakupan lewat
  `whereHas('asset', fn ($q) => $q->dalamCakupan(...))`, karena `AssetMutation`
  sendiri tidak menyimpan gedung/unit kerja.
- **`assetloan` ("Peminjaman & Pengembalian") dan `assetaudit` ("Audit
  Aset") purwarupa TETAP TIDAK disambungkan pada iterasi ini.** `assetloan`
  menaungi domain yang SAMA dengan Peminjaman Alat yang sudah tersambung —
  menyambungkannya lagi berarti dua layar menulis ke tabel yang sama lewat
  dua alur berbeda; sudah diarahkan lewat tombol "Pinjamkan" di atas,
  bukan diduplikasi. `assetaudit` (stock opname berbasis scan QR/RFID
  dengan sesi audit dan rekonsiliasi temuan) BUKAN penyambungan ulang data
  yang sudah ada — domain baru sepenuhnya, tidak ada tabel sesi audit atau
  status temuan per aset per sesi di mana pun. Dijatuhkan dengan sengaja,
  bukan dipangkas diam-diam.

- **Laporan Aset TIDAK menampilkan tabel "Rincian Aset" per-baris seperti
  purwarupa** — layar Asset Register sudah menyediakan daftar lengkap yang
  sama persis (cari, tapis, detail). Menduplikasinya di sini hanya
  mengulang data yang sama tanpa nilai tambah; laporan ini murni ringkasan
  agregat dari `RingkasanAset`.
- **"Komposisi Aset per Kategori" (donut 5 kategori purwarupa yang dikarang
  bebas) DIGANTI komposisi per kode barang BMN** — `RingkasanAset`
  diperluas menghasilkan `per_kode_barang` (10 kode barang terbanyak,
  diurutkan jumlah, dari data yang SUDAH ditarik untuk menghitung nilai
  perolehan/buku — tidak ada kueri tambahan). Pola yang sama dengan
  penggantian "Kategori" pada Asset Register: klasifikasi baku BMN,
  bukan kategori ad hoc.
- **"Penyusutan YTD" DIGANTI "Akumulasi Penyusutan"** — `Penyusutan::hitung()`
  hanya menjumlah akumulasi total sejak tanggal perolehan, tidak memisahkan
  bagian yang jatuh pada tahun berjalan. Melabeli angka totalnya sebagai
  "YTD" akan SALAH, bukan sekadar kurang presisi — dikoreksi, bukan
  dipertahankan demi kemiripan dengan purwarupa.
- **Sakelar periode "Bulan Ini/YTD/Kustom" DIHILANGKAN dari Laporan Aset**
  — ringkasan aset adalah potret posisi SAAT INI (kondisi, nilai buku),
  bukan metrik deret waktu; sakelar periode purwarupa tidak berpadanan
  dengan apa pun di layar ini.
- **KPI "Aset Dihapuskan" dihitung dari `status_penggunaan === 'Dihapuskan'`**
  — satu-satunya nilai baku kolom itu dalam kode ini sendiri (ditulis
  `AssetService::hapus()`). Kolom ini bebas teks di luar itu, sehingga
  hanya nilai baku inilah yang dapat dihitung dengan pasti sebagai "sudah
  dihapuskan" tanpa menebak-nebak kalimat bebas lain yang mungkin dipakai.

- **Studio Label & Barcode kini mencetak label untuk ASET SUNGGUHAN, bukan
  lagi delapan barang contoh purwarupa yang tetap sama.** Bug yang
  ditemukan saat menyambungkan modul lain: `allItems()` di layar ini
  selalu membaca `D.equipment.concat(D.assets)` tanpa syarat — bahkan di
  mode sungguhan setelah ratusan aset didaftarkan lewat Register BMN,
  Studio Label tetap hanya menampilkan delapan barang contoh yang tertanam
  di kode, karena tidak pernah sekalipun membaca `Repo.aset`. Sebuah
  satuan kerja yang sudah mendaftarkan seluruh inventarisnya tidak akan
  pernah bisa mencetak labelnya lewat layar ini.
- **Diperbaiki dengan memetakan hasil `Repo.aset.daftar()` ke bentuk item
  label lama (`asetAsliKeItemLabel()`), bukan menulis ulang fungsi cetak
  label.** `fieldVal()`, `payloadFor()`, `labelInternalHTML()`,
  `labelBmnHTML()` — seluruh kode cetak label yang sudah teruji dan
  dipakai bersama mode purwarupa tidak disentuh sama sekali. `lab`/`room`/
  `pic` sengaja diisi NAMA yang sudah diselesaikan (bukan id) karena
  `D.resName()`/`D.personName()` sudah punya jalur mundur "kembalikan
  apa adanya bila tidak ditemukan di purwarupa" — nama aset sungguhan
  lolos utuh tanpa perlu mengubah kedua fungsi pembantu itu.
- **`AssetController::index` menerima `per_halaman` (dibatasi 200) untuk
  kebutuhan ini** — Studio Label perlu daftar barang yang dapat dipilih
  lewat centang, bukan satu halaman 25 baris. Bila daftar aset melebihi
  200, pengguna diberi tahu apa adanya ("Menampilkan 200 dari N aset")
  alih-alih diam-diam terlihat seolah itu seluruh inventaris — pencarian
  lewat Register BMN tetap tersedia untuk aset di luar 200 itu.

- **`GET /api/dashboard/widget` ditambahkan sebagai endpoint umum untuk
  mengambil angka SATU widget lepas dari tata letak dashboard mana pun** —
  bukan endpoint khusus Laporan Ruangan. Dipicu oleh pertanyaan sederhana:
  Dashboard sudah menghitung utilisasi ruangan dan sebaran status booking
  lewat `DataWidget`; menulis ulang perhitungan yang sama di
  `RingkasanAset`-gaya khusus untuk layar Laporan berarti dua rumus yang
  bisa menyimpang. `DashboardWidget` pada endpoint ini SENGAJA tidak
  disimpan — sekadar bungkus in-memory (`new DashboardWidget([...])` tanpa
  `save()`) supaya bisa memanggil `DataWidget::untuk()` apa adanya.
  Otorisasi per widget sudah tegak di dalam `DataWidget::untuk()` sendiri
  (Gate per `izin` terdaftar di `RegistriWidget`); rute hanya menuntut
  `dashboard.lihat` sebagai syarat masuk paling luar, persis seperti
  `widgetTersedia()` yang sudah ada. Endpoint ini dapat dipakai layar
  Laporan LAIN di masa depan (Alat, Penyewaan, Maintenance) tanpa
  perubahan backend lagi — itulah sebabnya dibuat umum, bukan sekali pakai.
- **Laporan Ruangan mengganti "Rata-rata Okupansi" (peserta/kapasitas)
  purwarupa dengan "Utilisasi Ruangan"** (`ruangan.utilisasi` — jam
  terpakai/jam tersedia, ANGKA YANG SAMA PERSIS dengan yang Dashboard
  tampilkan, dengan asumsi jam operasional yang dinyatakan tegas di
  `DataWidget`) — occupancy peserta tidak dihitung di mana pun sebagai
  metrik tersendiri, sementara utilisasi jam sudah ada dan teruji.
- **"No-Show Rate" DIJATUHKAN, diganti "Menunggu Persetujuan"**
  (`booking.menunggu`) — tidak ada pencatatan check-in booking ruangan di
  mana pun; menampilkannya berarti mengarang angka, sementara "menunggu
  persetujuan" adalah KPI operasional sungguhan yang sudah dihitung server.
- **Kolom "Pendapatan" pada rekap per ruangan DIJATUHKAN** — booking
  ruangan internal tidak melekat pada invoice/pembayaran; hanya penyewaan
  fasilitas (modul terpisah, dengan alur tersendiri) yang punya pendapatan
  tercatat.
- **Rekap per ruangan dihitung dari booking TAHUN BERJALAN (maks 200
  baris terbaru, mengikuti batas Kalender Terpadu), sementara KPI di
  atasnya dihitung server atas SELURUH cakupan** — keduanya diberi label
  yang membedakan cakupannya (bukan diam-diam disandingkan seolah
  mengukur hal yang sama), karena sebulan/setahun booking bisa jauh
  melebihi batas 200 baris yang wajar untuk satu permintaan.

- **Laporan Alat menjatuhkan "Equipment Availability" dan "Downtime"
  purwarupa — keduanya tidak punya definisi tunggal di server.**
  "Availability" mengandaikan pembeda "ini alat lab" vs "ini aset umum",
  padahal keduanya berbagi satu tabel `assets` yang sama tanpa penanda
  semacam itu. "Downtime" mengandaikan rentang jam tidak tersedia, padahal
  `AssetMaintenance` hanya mencatat TANGGAL (`jadwal`/`dikerjakan_pada`),
  bukan durasi. Memaksakan angka untuk keduanya berarti mengarang
  pembilang atau penyebutnya — diganti dua KPI yang sungguh dihitung
  server: "Sedang Dipinjam" (`peminjaman.aktif`) dan "Kalibrasi
  Kedaluwarsa" (`kalibrasi.kedaluwarsa`, angka yang sama dengan Dashboard).
- **Widget baru `aset.kepatuhan-kalibrasi` ditambahkan ke
  `DataWidget`/`RegistriWidget`** — dihitung dari QUERY YANG SAMA PERSIS
  dengan `kalibrasi.kedaluwarsa` (dari sisi aset, dibalik: total wajib
  kalibrasi dikurangi yang kedaluwarsa), supaya daftar yang kedaluwarsa
  dan persentase yang patuh tidak pernah berselisih karena dihitung
  dengan dua definisi berbeda yang bisa menyimpang seiring waktu.
- **"Rincian per Alat" (baris per-alat: reservasi, jam, kondisi, status,
  kalibrasi) DIJATUHKAN** — pola yang sama dengan Laporan Aset: modul
  Peminjaman Alat (`V["eqbooking"]`) dan Asset Register sudah menyediakan
  daftar per-item yang identik dengan cari dan tapis; Laporan Alat murni
  agregat, bukan pengulangan listing yang sudah ada.
- **"Alat Paling Sering Dipinjam" dan "Status Kalibrasi" TETAP ADA** —
  keduanya genuinely agregat (bukan baris mentah yang menduplikasi layar
  lain): yang pertama dihitung dari peminjaman tahun berjalan yang
  dikelompokkan per alat (pola sama dengan rekap per ruangan), yang kedua
  langsung dari `baris` widget `kalibrasi.kedaluwarsa` tanpa agregasi baru.

- **Laporan Penyewaan disambungkan TANPA SATU PUN perubahan backend** —
  seluruh angkanya (`penyewaan.jumlah-aktif`, `penyewaan.pendapatan-ytd`,
  `penyewaan.tren-pendapatan`, `tagihan.piutang`, `tagihan.jatuh-tempo`)
  sudah ada sebagai widget Dashboard sejak sebelumnya; endpoint
  `GET /api/dashboard/widget` (dibuat untuk Laporan Ruangan) langsung
  memenuhi seluruh kebutuhan layar ini. Bukti bahwa endpoint umum itu
  benar-benar umum, bukan sekali pakai.
- **"Transaksi Sewa" (jumlah seluruh transaksi sepanjang masa) purwarupa
  DIGANTI "Penyewaan Aktif"** (`penyewaan.jumlah-aktif`) — tidak ada
  widget yang menghitung total transaksi sepanjang masa, dan "aktif saat
  ini" adalah pertanyaan operasional yang lebih berguna sehari-hari.
- **"Nilai Rata-rata per Transaksi" DIJATUHKAN** — menghitungnya akan
  berarti membagi pendapatan tahun berjalan (uang yang MASUK, sebuah
  arus) dengan jumlah penyewaan aktif (yang SEDANG berjalan saat ini,
  sebuah cacah titik-waktu) — dua besaran yang tidak sepadan untuk
  dibagi. Hasilnya angka yang tampak masuk akal tetapi tidak berarti
  apa-apa; lebih baik tidak ditampilkan sama sekali daripada menyesatkan.
- **"Kontribusi per Fasilitas" (5 fasilitas dengan persentase karangan)
  DIJATUHKAN** — pendapatan tidak dipecah per fasilitas di mana pun;
  `Payment` melekat pada `Invoice`, bukan pada ruangan/laboratorium
  tertentu secara langsung, dan atribusi semacam itu butuh model baru.
- **"Rekap Invoice" (baris per-invoice) DIJATUHKAN, diganti tabel yang
  KHUSUS menyoroti tagihan lewat jatuh tempo** — layar Invoice & Tagihan
  (`V["invoice"]`) sudah menyediakan daftar lengkap yang sama persis
  dengan cari dan tapis (pola sama dengan Laporan Aset & Laporan Alat).
  Tabel di Laporan Penyewaan mengambil irisan yang BERBEDA — hanya yang
  sudah lewat tempo, langsung dari `baris` widget `tagihan.jatuh-tempo`
  tanpa agregasi baru — bukan pengulangan listing yang sama.

- **Laporan Maintenance juga disambungkan TANPA SATU PUN perubahan
  backend** — `pemeliharaan.biaya-ytd`, `pemeliharaan.aktif`,
  `pemeliharaan.jenis`, `pemeliharaan.tren-biaya`, `pemeliharaan.terjadwal`
  sudah ada sebagai widget Dashboard; endpoint umum `GET /api/dashboard/
  widget` sudah cukup untuk kali ketiga berturut-turut (setelah Laporan
  Ruangan dan Laporan Penyewaan).
- **"Total Downtime" dan "MTTR" purwarupa DIJATUHKAN — alasan yang SAMA
  PERSIS dengan Laporan Alat**: `AssetMaintenance` mencatat TANGGAL
  (`jadwal`/`dikerjakan_pada`), bukan rentang jam tidak tersedia atau
  waktu perbaikan. Tidak ada satu pun tempat menyimpan durasi.
- **"Performa Vendor" SEMPAT DIJATUHKAN SEPENUHNYA saat ditulis** — tidak
  ada entitas Vendor di server; `pelaksana` pada `AssetMaintenance` adalah
  teks bebas (nama orang/pihak yang mengerjakan), bukan referensi ke tabel
  vendor dengan riwayat rating/biaya yang dapat direkap. Memaksakan tabel
  "Performa Vendor" saat itu berarti mengarang rating dan riwayat yang
  tidak pernah tercatat. **Kini DISAMBUNGKAN KEMBALI** setelah modul
  Vendor & Mitra dibangun (lihat catatan di bawah) — panel ini memakai
  `jumlah_pekerjaan`/`total_biaya` yang sudah dihitung server per vendor,
  dimuat terpisah dari widget lain sehingga kegagalannya (mis. peran yang
  berhak melihat Laporan Maintenance tapi tidak berhak melihat Vendor &
  Mitra) hanya merusak panel itu sendiri, bukan seluruh laporan.
- **"Work Order" (84, purwarupa) DIGANTI "Total Pekerjaan" dari
  `pemeliharaan.jenis`** — SELURUH cakupan sepanjang waktu (tidak ada
  widget yang membatasi hitungan pekerjaan per tahun), diberi label yang
  jujur menyebut cakupannya ("Seluruh cakupan"), bukan disamakan diam-diam
  dengan "tahun ini".
- **"Rincian Work Order" (baris per-pekerjaan) DIJATUHKAN** — modul
  Pemeliharaan & Kalibrasi yang sudah tersambung penuh sejak awal sesi
  menyediakan daftar yang sama persis dengan cari dan tapis; pola yang
  sama dengan Laporan Aset & Laporan Alat.
- **"Pemeliharaan Terjadwal — 30 Hari ke Depan" ditambahkan sebagai
  pengganti** — bukan pengulangan, melainkan irisan "apa yang akan
  datang" (`pemeliharaan.terjadwal`, jendela bawaan 30 hari) yang
  berbeda dari daftar lengkap di modul Pemeliharaan & Kalibrasi.

- **Modul Vendor & Mitra dibangun** — mengisi kekosongan yang baru saja
  didokumentasikan di atas ("Performa Vendor" yang sempat dijatuhkan).
  Tabel `vendors` baru: `kode` (unik), `nama`, `kategori`, PIC
  (`pic_nama`/`pic_telepon`/`pic_email`, seluruhnya nullable), `rating`,
  `kontrak_berlaku_sampai`, `aktif`, `catatan`.
- **Tanpa cakupan gedung** — sama seperti Penyewaan/Invoice/Payment
  sebelumnya: vendor adalah mitra tingkat organisasi (kontrak dengan
  satuan kerja), bukan sumber daya yang melekat pada satu gedung/ruangan
  tertentu. Menambahkan kolom gedung di sini berarti mengarang batasan
  yang tidak pernah diminta.
- **`kontrak_berlaku_sampai` nullable dipakai LANGSUNG sebagai penanda
  status kontrak** — `null` berarti "Per Proyek" (tanpa kontrak tetap),
  pola yang sama dengan `AssetMaintenance.dikerjakan_pada` dipakai
  langsung sebagai penanda "selesai". Kolom status terpisah (mis.
  `status_kontrak` enum) akan bisa menyimpang dari tanggalnya sendiri —
  dua sumber kebenaran untuk satu fakta.
- **`rating` sengaja kolom manual, BUKAN metrik terhitung** — tidak ada
  alur penilaian vendor per pekerjaan di mana pun dalam sistem ini
  (tidak seperti, misalnya, skor checklist yang dihitung dari jawaban
  tersimpan). Diberi nama dan tipe yang jujur (`decimal(2,1)`, diisi
  staf), bukan dibuat tampak seperti hasil agregasi otomatis padahal
  bukan.
- **`AssetMaintenance` mendapat `vendor_id` nullable — BERDAMPINGAN
  dengan `pelaksana` yang tetap teks bebas, bukan menggantikannya** —
  pola yang sama dengan `kode_internal` (bebas) vs `bmn_id` (terstruktur)
  pada Asset. Tidak semua pekerjaan pemeliharaan dikerjakan vendor
  terdaftar (staf internal, teknisi lepas tanpa kontrak) — memaksa
  setiap pekerjaan menunjuk baris `vendors` berarti sebagian pekerjaan
  jujur tidak dapat dicatat sama sekali.
- **`vendor_id` memakai `nullOnDelete`, BUKAN `restrictOnDelete`** —
  konsisten dengan alasan `destroy()` menonaktifkan alih-alih menghapus
  baris (lihat tabel uji di atas): jalur normalnya tidak pernah benar-
  benar menghapus vendor, jadi `nullOnDelete` di sini murni jaring
  pengaman, bukan perilaku yang diandalkan sehari-hari.
- **Tingkat izin modul `vendor` DICERMINKAN persis dari `master-data`**
  di seluruh 12 peran pada `MatriksAkses` — bukan diberi tingkat baru
  yang dipikirkan dari nol. Vendor bukan data sesensitif akun/hak akses
  (`pengguna`, yang sengaja dibuat maksimal konservatif — hanya
  super-admin); ia data referensi/kontak sebagaimana master data
  lain, jadi peran yang berhak mengelola master data berhak pula
  mengelola vendor, dengan tingkat yang sama persis.

- **Modul Audit Aset (stock opname) dibangun** — mengisi kembali
  purwarupa "Audit Aset" yang sebelumnya sepenuhnya berupa angka
  karangan (1.284 aset tercatat, dsb., seluruhnya literal di JS).
  Dua tabel baru: `asset_audit_sessions` (sesi audit, status
  berjalan/selesai) dan `asset_audit_scans` (satu baris = satu aset yang
  BERHASIL dipindai/ditemukan dalam satu sesi).
- **"Tidak ditemukan" TIDAK disimpan sebagai baris tersendiri** — ia
  SELISIH populasi (seluruh aset dalam cakupan) dikurangi yang sudah
  dipindai, dihitung `AssetAuditService::ringkasan()` setiap kali
  diminta. Selama sesi masih `berjalan`, selisih itu diberi label
  "belum diaudit"; begitu sesi `ditutup`, ANGKA YANG SAMA berubah label
  jadi "tidak ditemukan" — bukan dua definisi terpisah yang bisa
  menyimpang, dan bukan pula sesuatu yang perlu dihitung ulang atau
  disinkronkan saat sesi ditutup.
- **`lokasi_tercatat`/`kondisi_tercatat` adalah SNAPSHOT saat dipindai,
  bukan dibaca ulang dari `assets` saat laporan dibuka** — tanpa
  snapshot, temuan "lokasi berbeda" bisa menghilang begitu saja bila
  asetnya lantas dipindahkan (lewat Asset Movement) setelah dipindai
  tapi sebelum sesi ditutup, padahal saat dipindai ia memang ditemukan
  berbeda dari yang tercatat ketika itu.
- **Kode dicocokkan ke `kode_internal`, `bmn_id`, ATAU `serial_number`
  sekaligus** — auditor di lapangan memindai label yang tercetak di
  badan alat, dan tidak selalu tahu format kode mana yang tersimpan di
  sistem untuk barang tertentu.
- **Memindai ulang aset yang sama pada sesi yang sama MEMPERBARUI baris
  yang sudah ada** (indeks unik sesi+aset, `updateOrCreate`) — auditor
  yang salah pindai dapat memindai ulang tanpa menggandakan hitungan
  "sudah diverifikasi", pola yang sama dengan alasan `destroy()` Vendor
  menonaktifkan alih-alih menghapus: mencegah angka mengembang secara
  keliru lebih penting daripada kemudahan implementasi baris ganda.
- **Temuan gabungan (lokasi DAN kondisi sama-sama berbeda) diberi SATU
  kode, bukan dua** — `lokasi_berbeda` menang atas `kondisi_berbeda`
  pada `AssetAuditScan::temuan()`: aset yang ditemukan di tempat yang
  salah adalah kegagalan proses yang lebih mendesak untuk ditindak
  lanjuti daripada catatan kondisi yang perlu diperbarui.
- **Populasi audit memakai `Asset::dalamCakupan()` yang SAMA dengan
  Register BMN** — PIC/facility manager gedung tertentu hanya
  mengaudit dan memindai aset dalam gedung yang diampu; memindai kode
  aset di luar cakupan ditolak sebagai "kode tidak dikenali", bukan
  pesan otorisasi yang membocorkan keberadaan aset di gedung lain.
- **Tingkat izin modul `audit-aset` DICERMINKAN persis dari `aset`** —
  pola yang sama dengan `vendor` mencerminkan `master-data`: stock
  opname adalah kegiatan yang MENGUJI kebenaran catatan aset itu
  sendiri, bukan modul referensi terpisah, jadi siapa pun yang berwenang
  mengubah data aset berwenang pula mengaudit keberadaannya secara
  fisik — dengan tingkat kepercayaan yang sama persis, bukan dipikirkan
  sebagai keputusan baru dari nol. Modul ini SENGAJA diberi kunci
  `audit-aset`, bukan `audit` — kunci itu sudah dipakai Jejak Audit
  (`AuditLog`, riwayat perubahan otomatis) sejak awal, dan keduanya
  adalah konsep yang sama sekali berbeda: satu jejak perubahan data
  otomatis oleh sistem, satu lagi sesi stock opname yang dijalankan
  manual oleh staf di lapangan.
- **Layar menampilkan SATU sesi terbaru, bukan pemilih di antara
  banyak sesi** — pola yang sama dengan Laporan Ruangan menampilkan
  periode berjalan, bukan pemilih periode; sebuah pemilih sesi dapat
  ditambahkan kembali kelak bila kebutuhan riwayat multi-sesi muncul.
- **"Mode scan QR/RFID" purwarupa DISEDERHANAKAN jadi isian kode
  manual** — tidak ada perangkat pemindai fisik yang tersambung ke
  aplikasi web ini; kode internal/BMN/nomor seri yang sudah tercetak di
  label (dari Studio Label & Barcode) dapat diketik langsung, dan
  itulah yang benar-benar dapat diimplementasikan.

- **Manajemen Alat Laboratorium disambungkan — memakai backend Aset &
  BMN yang SAMA dengan Asset Register/Register BMN, bukan domain baru.**
  Bedanya murni tapisan `wajib_kalibrasi=true` pada `GET /api/assets` —
  persis pola Kalibrasi Alat & Maintenance berbagi satu tabel
  `asset_maintenances` dibedakan tapisan `jenis`. Sebelum ini, layar
  purwarupanya masih sepenuhnya `D.equipment` statis meski infrastruktur
  penuhnya sudah ada sejak Asset Register — kesenjangan yang baru
  disadari lewat survei purwarupa-vs-tersambung, bukan sesuatu yang
  sengaja ditunda.
- **Dua filter BARU pada `GET /api/assets`**: `wajib_kalibrasi`
  (boolean) dan `laboratory_id` (sebelumnya hanya `room_id` yang ada).
  Bukan endpoint baru — kolom dan relasinya sudah ada di skema sejak
  awal, hanya belum ada jalan untuk menyaringnya lewat query string.
- **Medan `kalibrasi` (berlaku_sampai/kedaluwarsa) DITAMBAHKAN ke
  `AssetResource`, HANYA untuk alat wajib kalibrasi** — dihitung dari
  kalibrasi selesai TERAKHIR, rumus `kedaluwarsa` sengaja sama persis
  dengan `Asset::kalibrasiKedaluwarsa()` (alat tanpa riwayat kalibrasi
  sama sekali dianggap kedaluwarsa), tapi dihitung dari `$terakhir` yang
  SAMA dipakai untuk kedua medan — bukan memanggil dua method model yang
  masing-masing query sendiri.
- **Eager load kalibrasi terakhir dijaga dari N+1, dan HANYA dimuat saat
  `wajib_kalibrasi` diminta** — `AssetController::index()` memuat relasi
  `maintenances` (disaring kalibrasi selesai, diurutkan terbaru) lewat
  SATU kueri batch (`WHERE asset_id IN (...)`) hanya ketika parameter
  `wajib_kalibrasi` ada di permintaan. Asset Register (yang tidak pernah
  mengirim parameter ini) sama sekali tidak memuat relasi tambahan itu —
  tidak ikut menanggung biaya query yang tidak pernah ditampilkannya.
  `AssetResource` jatuh balik ke `Asset::kalibrasiTerakhir()` (satu
  kueri per baris) bila relasi tidak dimuat, sehingga endpoint lain yang
  memuat `AssetResource` satu-satu (mis. `show()`) tetap benar, hanya
  tanpa optimisasi batch yang memang tidak relevan untuk satu baris.
- **KPI "Tersedia"/"Non-Operasional" dan kolom "Status" purwarupa
  (Available/In Use/Borrowed/Maintenance/Broken/Calibration)
  DIJATUHKAN** — tidak ada kolom status operasional pada `assets`; nilai
  semacam itu HARUS diturunkan dari peminjaman/pemeliharaan yang sedang
  aktif, bukan field tunggal yang bisa menyimpang dari kenyataan (alat
  bisa saja "Available" di kolom padahal sedang benar-benar dipinjam).
  Diganti dua KPI yang genuinely dihitung server DAN SUDAH ADA sejak
  Laporan Alat — `peminjaman.aktif` ("Sedang Dipinjam") dan
  `kalibrasi.kedaluwarsa` ("Kalibrasi Kedaluwarsa") — reuse widget,
  bukan endpoint baru.

- **Room Availability disambungkan TANPA SATU PUN perubahan backend** —
  memakai `Repo.ruangan.daftar()` (daftar ruangan + `status_ruangan`)
  dan `Repo.booking.daftar({sejak, sampai, hanya_aktif})` (pola query
  yang sama dengan Kalender Terpadu) berdampingan, dihitung ulang di
  frontend menjadi timeline + KPI. Komentar lama di `views-core.js` yang
  bilang layar ini "sudah tidak dapat difungsikan" kini tidak berlaku
  lagi.
- **KPI "Booked"/"Pending"/"Reserved" purwarupa (status ruangan yang
  dipecah jadi lima label) DIJATUHKAN** — server hanya mengenal status
  ruangan `tersedia`/`pemeliharaan`/`tidak_aktif` (properti ruangan itu
  sendiri), terpisah sepenuhnya dari sedang-dipakai-atau-tidaknya saat
  ini. Diganti "Sedang Digunakan" (dihitung dari booking aktif yang
  mulai≤sekarang<selesai) dan "Menunggu Persetujuan" — dua hal yang
  genuinely berbeda maknanya dan dapat dihitung dari data yang ada,
  bukan sinonim satu status ruangan yang dipecah jadi lima label warna.
- **"Timeline Laboratorium" purwarupa DIJATUHKAN** — alasan yang SAMA
  PERSIS dengan Kalender Terpadu dan Dashboard: laboratorium tidak
  punya mekanisme pemesanan sendiri di server.
- **Blok timeline dijepit ke rentang tampilan (07:00–19:00)** — booking
  di luar jam itu (jarang, tapi mungkin) tetap tampil di tepi timeline,
  bukan lolos ke posisi negatif yang keluar dari kartunya sendiri dan
  menimpa elemen lain di halaman (ditemukan lewat pengujian otomatis,
  bukan laporan pengguna).
- **Klik blok timeline membuka drawer detail booking yang SUDAH ADA**
  (`showBooking()`, dipakai juga oleh layar Booking Ruangan) — bukan
  drawer baru yang menyalin ulang markupnya. Booking hari terpilih
  disimpan ke state modul Booking sebelum dirender, supaya `showBooking`
  dapat menemukan barisnya persis seperti dipanggil dari layarnya
  sendiri.

- **Room Layout Management disambungkan TANPA SATU PUN perubahan
  backend** — Matriks Layout per Ruangan memakai `tata_letak`, kolom
  bebas teks yang SUDAH ADA pada `rooms` sejak modul Ruangan pertama
  disambungkan (staf mengetiknya sebagai daftar dipisah koma di formulir
  ruangan). Layar ini hanya membaca `Repo.ruangan.daftar()` yang sama
  dan mencocokkan isinya terhadap enam nama layout baku.
- **Kartu jenis layout (Theater/Classroom/dst.) TETAP teks referensi
  statis** — itu glosarium konsep ("kapan memakai layout apa"), bukan
  data yang tersimpan sebagai baris di mana pun; tidak ada "jenis
  layout" untuk didaftarkan/dihapus. Tombol "Edit" purwarupa per kartu
  DIJATUHKAN karena itu berarti mengarang entitas yang tidak ada;
  "Ruangan Terkait" DISAMBUNGKAN sungguhan — menyaring dari daftar
  ruangan yang sama dengan matriks, tanpa permintaan tambahan.
- **Kolom "Custom" purwarupa DIJATUHKAN** — pada purwarupa kolom itu
  SELALU bertanda centang untuk setiap ruangan tanpa terkecuali; ia
  tidak pernah membawa informasi (ruangan apa pun secara trivial dapat
  diatur ulang jadi tata letak custom), jadi menampilkannya seolah-olah
  data sungguhan hanya akan menyesatkan.

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
- **Asumsi jam operasional untuk widget utilisasi ruangan.** 08.00–18.00
  Senin–Sabtu dipilih karena tidak ada satu pun tempat di sistem ini yang
  menyimpan jam operasional fasilitas sesungguhnya. Dikurung di satu
  konstanta (`DataWidget::JAM_OPERASIONAL_PER_HARI`) dan satu metode
  (`hariKerja()`) supaya penyesuaiannya cukup di satu tempat, sama seperti
  pola pada `Penyusutan`.
- **Rute "Dashboard Manajemen" belum punya jenis dashboard sendiri.**
  `Dashboard::JENIS` hanya `operasional`/`analitik`/`bsc` — tidak ada
  `manajemen` terpisah seperti pasangan `DEFAULTS.ops`/`DEFAULTS.mgmt` pada
  purwarupa. Rute `#/exec` untuk sekarang memilih dashboard `operasional`
  yang sama dengan `#/dashboard`; menambah jenis `manajemen` sendiri berarti
  migrasi baru dan perluasan `Dashboard::JENIS`, sengaja belum dilakukan
  sampai ada kebutuhan nyata membedakan keduanya.
