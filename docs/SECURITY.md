# SECURITY — Kebijakan & Kendali Keamanan
## FLMS · Facility, Laboratory & Meeting Management System

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Klasifikasi** | Internal |
| **Acuan** | OWASP ASVS 4.0 level 2 · OWASP Top 10 2021 · UU 27/2022 (PDP) |
| **Dokumen terkait** | [ARCHITECTURE.md](ARCHITECTURE.md) · [DEPLOYMENT.md](DEPLOYMENT.md) · [RUNBOOK.md](RUNBOOK.md) |

---

> ## ⚠ Pernyataan status — wajib dibaca lebih dulu
>
> Yang terpasang di `lab.semestateknologiutama.com` hari ini adalah **purwarupa
> antarmuka**. Purwarupa ini **tidak memiliki autentikasi, otorisasi, maupun
> penyimpanan sisi server**, dan **seluruh datanya fiktif**.
>
> **Purwarupa tidak boleh diisi data nyata** — tidak data pegawai, tidak nomor BMN
> sungguhan, tidak dokumen internal. Kendali pada §3–§7 adalah **kebutuhan untuk
> produksi**, bukan gambaran keadaan sekarang. Keadaan sekarang dijabarkan apa
> adanya pada **§8**.

---

## 1. Aset yang Dilindungi

| Aset | Kerahasiaan | Integritas | Ketersediaan | Catatan |
|---|:---:|:---:|:---:|---|
| Data pribadi pegawai (nama, NIP, kontak) | Tinggi | Sedang | Sedang | Objek UU 27/2022 |
| Data pengunjung (identitas, instansi, tujuan) | Tinggi | Sedang | Rendah | Data pihak ketiga |
| Register BMN (kode, NUP, nilai perolehan) | Sedang | **Tinggi** | Sedang | Bahan audit negara |
| Foto barang & bukti checklist | Sedang | Tinggi | Rendah | Dapat memuat wajah orang |
| Tarif, penawaran, tagihan, pembayaran | Tinggi | **Tinggi** | Sedang | Berdampak finansial |
| Jadwal & agenda | Sedang | Tinggi | **Tinggi** | Gangguan langsung terasa |
| Audit trail | Tinggi | **Tinggi** | Sedang | Hanya sisip, tidak boleh diubah |
| Kredensial & rahasia sistem | **Tinggi** | Tinggi | Tinggi | SMTP, basis data, SSO |

## 2. Model Ancaman

Metode STRIDE, disaring ke ancaman yang realistis untuk aplikasi internal.

| # | Ancaman | Skenario | Kendali |
|---|---|---|---|
| T1 | Pemalsuan identitas | Pegawai memakai akun rekan untuk menyetujui pengajuannya sendiri | SSO + MFA untuk peran istimewa; audit trail; larangan menyetujui pengajuan sendiri |
| T2 | Peningkatan hak akses | Pengguna biasa mengakses endpoint admin dengan menebak URL | Otorisasi diperiksa **di server** untuk setiap permintaan, bukan hanya menyembunyikan menu |
| T3 | Perusakan data BMN | Nilai perolehan atau NUP diubah tanpa jejak | Audit trail nilai sebelum/sesudah; NUP tidak dapat diubah setelah terbit |
| T4 | Kebocoran data pribadi | Ekspor daftar pegawai/pengunjung oleh peran yang tidak berhak | Batasan ekspor per peran; ekspor tercatat di audit |
| T5 | Berkas unggahan berbahaya | Skrip diunggah lewat foto barang lalu dieksekusi | Validasi tipe nyata, penyimpanan di luar docroot, tanpa hak eksekusi |
| T6 | XSS tersimpan | Nama barang berisi `<script>` lalu tampil di dashboard orang lain | Pelolosan keluaran wajib; CSP; sanitasi masukan |
| T7 | Penyalahgunaan email | Sistem dipakai mengirim email massal ke luar | Batas laju, penerima terbatas daftar internal, pemantauan antrean |
| T8 | Penyangkalan tindakan | Pengguna menyangkal telah menyetujui atau memblokir alat | Audit trail dengan IP, perangkat, waktu; tanda tangan pada checklist |
| T9 | Gangguan ketersediaan | Banjir permintaan atau kesalahan konfigurasi menumbangkan layanan | Batas laju, pemantauan, prosedur pemulihan di RUNBOOK |
| T10 | Kebocoran lewat repositori | `.git` atau berkas konfigurasi terbaca publik | `.htaccess` memblokir; rahasia tidak pernah masuk repositori |

## 3. Autentikasi

| Kendali | Ketentuan |
|---|---|
| Metode utama | SSO korporat (OIDC/SAML) terhadap direktori organisasi |
| Cadangan | Akun lokal hanya untuk pengguna eksternal (pemohon sewa) |
| MFA | **Wajib** untuk Super Admin, Facility Manager, Asset Manager, Finance |
| Kata sandi lokal | Minimal 12 karakter, dicek terhadap daftar kata sandi bocor, di-hash dengan Argon2id |
| Pembatasan percobaan | 5 gagal → jeda menaik; 10 gagal → kunci 15 menit; tercatat di audit |
| Sesi | Token httpOnly + Secure + SameSite=Lax; idle 30 menit; maksimal 12 jam |
| Keluar | Membatalkan sesi di server, bukan sekadar menghapus token di klien |
| Pemulihan akun | Lewat direktori korporat; untuk eksternal, tautan sekali pakai berumur 30 menit |

## 4. Otorisasi (RBAC)

Otorisasi bekerja pada **dua sumbu**: peran menentukan tindakan, cakupan data
menentukan objek yang boleh disentuh.

### 4.1 Matriks peran × modul

Tingkat: `PENUH` (baca+tulis+hapus+konfigurasi) · `UBAH` · `BUAT` · `LIHAT` · `—`

| Modul | Super Admin | Facility Mgr | Lab Mgr | Asset Mgr | Finance | Employee |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | PENUH | PENUH | LIHAT | LIHAT | LIHAT | LIHAT |
| Booking ruangan | PENUH | PENUH | UBAH | LIHAT | LIHAT | BUAT |
| Booking alat | PENUH | LIHAT | PENUH | UBAH | — | BUAT |
| Laboratorium | PENUH | LIHAT | PENUH | LIHAT | — | LIHAT |
| Aset & BMN | PENUH | UBAH | LIHAT | PENUH | LIHAT | — |
| Penyewaan & penagihan | PENUH | UBAH | — | — | PENUH | — |
| Pemeliharaan | PENUH | PENUH | UBAH | UBAH | LIHAT | — |
| Kalibrasi | PENUH | LIHAT | PENUH | UBAH | — | — |
| Checklist | PENUH | PENUH | UBAH | UBAH | — | BUAT¹ |
| Notifikasi email | PENUH | UBAH | LIHAT | LIHAT | LIHAT | — |
| Master data | PENUH | UBAH | UBAH | UBAH | — | — |
| Audit trail | PENUH | LIHAT | — | — | — | — |

¹ Hanya mengerjakan checklist yang ditugaskan kepadanya.

### 4.2 Cakupan data

| Cakupan | Aturan |
|---|---|
| Lokasi / gedung | Pengguna hanya melihat resource pada gedung yang ditugaskan |
| Unit kerja | Booking dan aset dibatasi unit kerja pengguna |
| Resource | PIC hanya mengelola resource yang eksplisit ditugaskan kepadanya |
| Kepemilikan | Pemohon selalu dapat melihat pengajuannya sendiri |

### 4.3 Aturan yang tidak boleh dilanggar

1. **Otorisasi diperiksa di server pada setiap permintaan.** Menyembunyikan tombol
   di antarmuka bukan kendali keamanan.
2. **Tidak boleh menyetujui pengajuan sendiri**, meskipun peran mengizinkan.
3. **NUP dan kode BMN tidak dapat diubah** setelah terbit; koreksi dilakukan lewat
   transaksi pembatalan yang tercatat.
4. **Perubahan tarif, nilai aset, dan hak akses** selalu menghasilkan entri audit
   berisi nilai sebelum dan sesudah.

## 5. Perlindungan Data

### 5.1 Klasifikasi & retensi

| Jenis data | Klasifikasi | Retensi | Pemusnahan |
|---|---|---|---|
| Data pegawai | Pribadi | Selama aktif + 2 tahun | Anonimisasi |
| Data pengunjung | Pribadi | 12 bulan | Hapus permanen |
| Foto barang | Internal | Selama aset tercatat | Ikut penghapusan aset |
| Bukti checklist | Internal | 3 tahun | Hapus terjadwal |
| Dokumen BMN & BAST | Internal | Sesuai ketentuan kearsipan negara | Sesuai jadwal retensi arsip |
| Audit trail | Rahasia | 24 bulan | Arsip dingin lalu hapus |
| Antrean email | Internal | 90 hari | Hapus terjadwal |

### 5.2 Enkripsi

- **Dalam perjalanan:** TLS 1.2 minimum, TLS 1.3 diutamakan; HSTS aktif; tanpa akses HTTP polos.
- **Dalam simpanan:** enkripsi tingkat penyimpanan untuk basis data dan object storage;
  kolom sensitif (nomor identitas pengunjung) dienkripsi tersendiri.
- **Cadangan:** terenkripsi, kunci disimpan terpisah dari data.

### 5.3 Kepatuhan UU 27/2022 (PDP)

| Kewajiban | Penerapan |
|---|---|
| Dasar pemrosesan | Hubungan kerja untuk pegawai; persetujuan untuk pengunjung |
| Pemberitahuan | Pemberitahuan privasi ditampilkan pada formulir tamu dan halaman masuk |
| Hak subjek data | Prosedur akses, koreksi, dan penghapusan; ditangani ≤ 30 hari |
| Minimalisasi | Hanya kumpulkan yang dipakai; nomor identitas tamu opsional |
| Pemberitahuan insiden | Notifikasi ≤ 72 jam ke pihak berwenang dan subjek terdampak |
| Prosesor pihak ketiga | Perjanjian pemrosesan data dengan penyedia SMTP, hosting, WhatsApp |

> Klasifikasi dan retensi di atas adalah **usulan teknis**. Kepastian hukum wajib
> dikonfirmasi ke fungsi hukum/kepatuhan klien sebelum go-live.

## 6. Keamanan Aplikasi

### 6.1 Pemetaan OWASP Top 10 2021

| Risiko | Kendali wajib |
|---|---|
| A01 Kendali akses rusak | Otorisasi sisi server per permintaan; uji akses lintas peran wajib ada |
| A02 Kegagalan kriptografi | TLS 1.2+; Argon2id untuk kata sandi; tanpa algoritma usang |
| A03 Injeksi | Kueri berparameter; tanpa perangkaian SQL; pelolosan keluaran |
| A04 Desain tidak aman | Model ancaman ini ditinjau tiap perubahan besar |
| A05 Salah konfigurasi | Header keamanan; direktori tidak dapat dijelajah; galat tanpa jejak tumpukan |
| A06 Komponen rentan | Pemindaian dependensi otomatis; tanpa dependensi tak terpakai |
| A07 Kegagalan autentikasi | MFA, pembatasan percobaan, pembatalan sesi |
| A08 Integritas data & perangkat lunak | Penguncian versi dependensi; artefak rilis ditandatangani |
| A09 Kegagalan pencatatan | Audit trail hanya sisip; log terpusat; peringatan pada pola mencurigakan |
| A10 SSRF | Tidak ada pengambilan URL dari masukan pengguna |

### 6.2 Header keamanan HTTP

Sudah aktif pada purwarupa lewat `.htaccess`:
```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: SAMEORIGIN
```
**Wajib ditambahkan untuk produksi:**
```
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:;
  style-src 'self'; script-src 'self'; frame-ancestors 'self'; base-uri 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: camera=(self), geolocation=(), microphone=()
```
> `camera=(self)` diperlukan karena unggah foto barang mendukung pengambilan langsung
> dari kamera perangkat.

### 6.3 Keamanan unggahan berkas

Fitur unggah foto (registrasi peralatan, bukti checklist) menuntut kendali khusus:

1. Validasi **tipe nyata** dari byte awal berkas, bukan dari ekstensi atau header `Content-Type`.
2. Batas ukuran ditegakkan di server (5 MB per berkas) — batas di klien hanya kenyamanan.
3. Nama berkas dibuat ulang; nama asli hanya disimpan sebagai metadata.
4. Disimpan **di luar docroot**, tanpa hak eksekusi.
5. Diakses lewat URL bertanda tangan berumur pendek, bukan tautan permanen.
6. Gambar diproses ulang (ubah ukuran) untuk membuang muatan tersembunyi dan EXIF —
   **termasuk koordinat GPS** yang dapat membocorkan lokasi.
7. Pemindaian antivirus bila kebijakan klien mengharuskan.

### 6.4 Keamanan khusus modul

| Modul | Risiko | Kendali |
|---|---|---|
| Label & barcode | Muatan barcode berisi data sensitif dan terbaca siapa pun yang memindai | Bawaan hanya memuat kode; larang menyertakan nilai aset di label yang tertempel publik |
| Notifikasi email | Kesalahan konfigurasi mengirim data ke luar organisasi | Daftar domain penerima yang diizinkan; batas laju; pratinjau wajib sebelum kirim massal |
| Dashboard | Widget menampilkan data di luar cakupan pengguna | Sumber data memfilter menurut cakupan pengguna, bukan menurut pilihan widget |
| Checklist | Foto bukti memuat wajah orang | Retensi terbatas; akses hanya PIC dan atasan |
| Register BMN | Nilai aset bocor ke pihak tak berhak | Kolom nilai hanya untuk peran Asset Manager, Finance, Management |

## 7. Rahasia & Konfigurasi

- Rahasia **tidak pernah** masuk repositori. `.gitignore` wajib memuat `.env`.
- Disimpan pada pengelola rahasia atau variabel lingkungan milik platform.
- Rotasi: kredensial SMTP dan basis data tiap 12 bulan atau segera setelah insiden.
- Pemisahan lingkungan: kredensial pengembangan, staging, dan produksi berbeda total.
- Riwayat Git dipindai untuk rahasia yang pernah ter-commit sebelum repositori dibuka lebih luas.

## 8. Kerentanan Purwarupa Saat Ini

Ditulis apa adanya agar tidak ada yang salah menduga purwarupa sudah aman.

| # | Temuan | Tingkat | Status |
|---|---|---|---|
| P1 | Tidak ada autentikasi — siapa pun yang membuka URL melihat seluruh layar | **Kritis untuk data nyata** | Diterima; purwarupa hanya berisi data fiktif |
| P2 | Tidak ada otorisasi — pemilih peran hanya mengubah tampilan | **Kritis untuk data nyata** | Sama seperti P1 |
| P3 | Data tersimpan di `localStorage`, dapat dibaca skrip mana pun di origin yang sama | Sedang | Hanya preferensi tampilan; tidak ada data pribadi |
| P4 | Render memakai `innerHTML` | Sedang | Diredam: seluruh nilai data melewati `UI.esc()`; masukan pengguna tidak persisten |
| P5 | Belum ada Content-Security-Policy | Sedang | **Harus ditambahkan sebelum data nyata masuk** |
| P6 | Foto unggahan hanya di memori peramban, tanpa validasi sisi server | Rendah pada purwarupa | Wajib ditangani saat backend dibangun |
| P7 | Tidak ada pembatasan laju | Rendah | Situs statis; relevan setelah ada API |
| P8 | Direktori `.git` ikut tersalin ke docroot oleh mekanisme deploy | **Sudah ditangani** | Diblokir `.htaccess`; verifikasi ulang tiap deploy |

### Yang sudah aktif pada purwarupa
- HTTPS dipaksa; sertifikat Let's Encrypt sah.
- Tiga header keamanan terpasang.
- Direktori tidak dapat dijelajah.
- `.git` dan `.htaccess` mengembalikan 404.
- Tanpa dependensi pihak ketiga di sisi klien — permukaan serangan rantai pasok nol.

## 9. Pencatatan & Pemantauan

| Peristiwa | Dicatat | Peringatan |
|---|---|---|
| Masuk berhasil / gagal | Ya | > 10 gagal per akun per 15 menit |
| Perubahan hak akses | Ya | Setiap perubahan → notifikasi ke Super Admin |
| Perubahan nilai aset / tarif | Ya | Perubahan > 20% |
| Ekspor data massal | Ya | Setiap ekspor > 500 baris |
| Kegagalan kirim email | Ya | Delivery rate < 95% dalam 1 jam |
| Galat server 5xx | Ya | > 10 dalam 5 menit |
| Akses ditolak (403) | Ya | > 20 per pengguna per jam — indikasi percobaan menembus |

Log tidak boleh memuat kata sandi, token, atau isi lampiran. Waktu memakai UTC di
penyimpanan dan ditampilkan sebagai WIB.

## 10. Pencadangan & Pemulihan

| Aspek | Ketentuan |
|---|---|
| Basis data | Cadangan penuh harian + WAL berkelanjutan |
| Object storage | Replikasi harian |
| RPO | ≤ 24 jam (target ≤ 1 jam dengan WAL) |
| RTO | ≤ 4 jam |
| Uji pemulihan | **Wajib tiap triwulan** — cadangan yang belum pernah diuji bukan cadangan |
| Penyimpanan | Lokasi terpisah dari server produksi |

## 11. Pelaporan Kerentanan

Temuan keamanan dilaporkan ke *(alamat email keamanan klien — diisi sebelum go-live)*.
Jangan melaporkan lewat isu publik.

| Tingkat | Target respons | Target perbaikan |
|---|---|---|
| Kritis | 4 jam | 24 jam |
| Tinggi | 1 hari kerja | 7 hari |
| Sedang | 3 hari kerja | 30 hari |
| Rendah | 5 hari kerja | Rilis berikutnya |

## 12. Daftar Periksa Keamanan Pra-Deployment

Seluruh butir wajib **terverifikasi**, bukan sekadar direncanakan, sebelum data nyata
dimasukkan.

**Autentikasi & akses**
- [ ] SSO tersambung dan diuji dengan akun nyata
- [ ] MFA aktif untuk seluruh peran istimewa
- [ ] Otorisasi diuji per peran, termasuk percobaan akses lintas peran
- [ ] Larangan menyetujui pengajuan sendiri terverifikasi
- [ ] Kedaluwarsa dan pembatalan sesi terverifikasi

**Data**
- [ ] TLS 1.2+ dengan HSTS aktif
- [ ] Enkripsi simpanan aktif untuk basis data dan object storage
- [ ] Pemberitahuan privasi tampil pada formulir yang mengumpulkan data pribadi
- [ ] Kebijakan retensi terkonfigurasi dan penghapusan terjadwal berjalan
- [ ] Perjanjian pemrosesan data dengan pihak ketiga ditandatangani

**Aplikasi**
- [ ] Content-Security-Policy aktif tanpa `unsafe-inline`
- [ ] Seluruh header keamanan §6.2 terpasang dan diverifikasi
- [ ] Validasi unggahan berkas §6.3 lengkap, termasuk pembuangan EXIF
- [ ] Halaman galat tidak menampilkan jejak tumpukan
- [ ] Pemindaian dependensi bersih dari kerentanan tinggi/kritis

**Operasi**
- [ ] Audit trail berjalan dan tidak dapat diubah
- [ ] Peringatan §9 terkonfigurasi dan pernah diuji memicu
- [ ] Cadangan berjalan dan **pemulihan pernah diuji**
- [ ] Rahasia tidak ada di repositori; riwayat Git sudah dipindai
- [ ] `.git` tidak dapat diakses dari web — diperiksa ulang setelah deploy
- [ ] Uji penetrasi oleh pihak independen selesai dan temuan tinggi tertutup
