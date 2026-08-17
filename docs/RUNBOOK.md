# RUNBOOK — Panduan Operasional
## FLMS · Facility, Laboratory & Meeting Management System

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Untuk** | Tim operasional dan piket |
| **Dokumen terkait** | [DEPLOYMENT.md](DEPLOYMENT.md) · [SECURITY.md](SECURITY.md) · [ARCHITECTURE.md](ARCHITECTURE.md) |

---

> **Isi kontak sebelum go-live.** Seluruh sel bertanda *(diisi)* wajib berisi nama,
> nomor, dan alamat sebenarnya. Runbook tanpa kontak tidak berguna saat insiden.

## 1. Informasi Layanan

| Butir | Nilai |
|---|---|
| Nama layanan | FLMS — Facility, Laboratory & Meeting Management System |
| URL purwarupa | `https://lab.semestateknologiutama.com` |
| URL produksi | *(diisi)* |
| Hosting purwarupa | cPanel Domainesia, akun `semestat` |
| Docroot | `/home/semestat/lab.semestateknologiutama.com` |
| Jam layanan | Senin–Jumat 07.00–18.00 WIB |
| Target ketersediaan | 99,5% pada jam layanan |
| RPO / RTO | ≤ 24 jam / ≤ 4 jam |

### Kontak

| Peran | Nama | Kontak | Jam |
|---|---|---|---|
| Pemilik produk | *(diisi)* | *(diisi)* | Jam kerja |
| Piket teknis utama | *(diisi)* | *(diisi)* | Jam kerja |
| Piket teknis cadangan | *(diisi)* | *(diisi)* | Jam kerja |
| Admin hosting | Domainesia | Tiket panel + hotline | 24/7 |
| Admin email/SMTP | *(diisi)* | *(diisi)* | Jam kerja |
| Kontak keamanan | *(diisi)* | *(diisi)* | Jam kerja |

## 2. Arsitektur Ringkas

**Purwarupa (sekarang):** Apache melayani berkas statis. Tidak ada basis data, tidak
ada worker. Kegagalan yang mungkin terjadi hanya: hosting mati, sertifikat kedaluwarsa,
deploy rusak, atau `.htaccess` salah.

**Produksi (rencana):** proxy → web + API → PostgreSQL, Redis, object storage;
worker + penjadwal → SMTP. Rincian di [ARCHITECTURE.md](ARCHITECTURE.md).

### Ketergantungan luar

| Ketergantungan | Dampak bila mati | Penanganan sementara |
|---|---|---|
| Hosting/Apache | Layanan mati total | Tiket ke penyedia |
| DNS | Domain tak dapat diakses | Periksa rekaman A, hubungi pengelola DNS |
| Let's Encrypt | Sertifikat gagal diperpanjang | Picu AutoSSL manual |
| SMTP relay | Notifikasi tidak terkirim | Antrean menahan; kirim ulang setelah pulih |
| SSO korporat | Pengguna tak bisa masuk | Jalur masuk darurat untuk admin |
| Payment gateway | Pembayaran tak tercatat otomatis | Catat manual, rekonsiliasi kemudian |

## 3. Pemantauan

| Yang dipantau | Ambang | Tindakan |
|---|---|---|
| Ketersediaan HTTP | Gagal 2× berturut (5 mnt) | Sev-1, lihat §6.1 |
| Kedaluwarsa TLS | < 21 hari | Sev-3, lihat §6.3 |
| Galat 5xx | > 10 / 5 menit | Sev-2, lihat §6.2 |
| Waktu tanggap p95 | > 1 s selama 10 menit | Sev-3 |
| Antrean email | > 100 tertahan 15 menit | Sev-2, lihat §6.4 |
| Delivery rate email | < 95% dalam 1 jam | Sev-2 |
| Disk | > 80% | Sev-3, lihat §6.7 |
| Cadangan basis data | Gagal atau tidak ada 24 jam | Sev-2 |
| Koneksi basis data | > 80% dari batas | Sev-3 |
| Gagal masuk | > 10 / akun / 15 menit | Sev-3, lihat §6.8 |

## 4. Tugas Berkala

**Harian (10 menit)**
- [ ] Situs terbuka dan dashboard tampil
- [ ] Antrean email kosong atau bergerak; tidak ada tumpukan gagal
- [ ] Tidak ada peringatan semalam yang belum ditangani
- [ ] Cadangan tadi malam berhasil

**Mingguan (30 menit)**
- [ ] Tinjau tren galat sepekan
- [ ] Tinjau pengguna baru dan perubahan hak akses
- [ ] Periksa penggunaan disk dan pertumbuhan basis data
- [ ] Tinjau kegagalan kirim email dan penyebabnya

**Bulanan (2 jam)**
- [ ] Perbarui dependensi keamanan
- [ ] Tinjau audit trail untuk pola janggal
- [ ] Periksa masa berlaku sertifikat
- [ ] Tinjau kapasitas terhadap pertumbuhan
- [ ] Verifikasi kontak pada runbook masih benar

**Triwulanan (1 hari)**
- [ ] **Latihan pemulihan cadangan** — pulihkan ke lingkungan terpisah dan verifikasi
- [ ] Tinjau dan uji prosedur rollback
- [ ] Tinjau hak akses seluruh pengguna
- [ ] Perbarui runbook sesuai temuan

## 5. Tingkat Insiden

| Tingkat | Arti | Contoh | Respons | Eskalasi |
|---|---|---|---|---|
| **Sev-1** | Layanan mati atau data terancam | Situs tidak dapat diakses, data hilang | Segera | Piket → pemilik produk dalam 15 mnt |
| **Sev-2** | Fungsi utama rusak | Booking gagal, email tidak terkirim | ≤ 1 jam (jam kerja) | Piket → pemilik produk dalam 2 jam |
| **Sev-3** | Terganggu, ada jalan lain | Laporan lambat, satu layar bermasalah | ≤ 1 hari kerja | Piket |
| **Sev-4** | Kosmetik | Salah eja, ikon meleset | Rilis berikutnya | — |

**Komunikasi saat Sev-1/Sev-2:** kabari pengguna dalam 30 menit lewat kanal internal,
perbarui tiap jam, dan kirim ringkasan setelah pulih.

## 6. Playbook per Gejala

### 6.1 Situs tidak dapat diakses

1. Konfirmasi dari jaringan lain (jangan simpulkan dari satu perangkat).
2. Periksa DNS: `dig lab.semestateknologiutama.com` — apakah menunjuk IP benar?
3. Periksa TLS: `curl -vI https://lab.semestateknologiutama.com` — sertifikat sah?
4. Periksa panel hosting: akun aktif? kuota terlampaui?
5. Periksa docroot masih berisi `index.html`.
6. Bila 500: hampir selalu `.htaccess`. Lihat §6.2.
7. Bila hosting bermasalah: buka tiket, kabari pengguna, tunggu.

### 6.2 Galat 500 setelah deploy

**Penyebab paling sering pada shared hosting: direktif `.htaccess` yang tidak
diizinkan `AllowOverride`.**

1. Ganti nama `.htaccess` menjadi `.htaccess.off` melalui pengelola berkas.
2. Muat ulang situs. Bila pulih → penyebabnya `.htaccess`.
3. Kembalikan direktif sedikit demi sedikit untuk menemukan yang bermasalah.
4. Ganti direktif itu dengan alternatif berkebutuhan `AllowOverride` lebih rendah —
   contoh: `IndexIgnore *` sebagai pengganti `Options -Indexes`.
5. Bila bukan `.htaccess`: periksa log galat, lalu rollback (§6.9).

### 6.3 Sertifikat TLS kedaluwarsa atau akan habis

1. Periksa masa berlaku pada panel SSL.
2. Picu AutoSSL secara manual.
3. Tunggu ± 15 menit, verifikasi `curl -vI https://…`.
4. Bila gagal: pastikan domain mengarah ke server ini dan `.well-known/acme-challenge`
   dapat diakses — aturan `RedirectMatch` yang terlalu luas dapat memblokirnya.
5. Bila tetap gagal: tiket ke penyedia hosting. **Sev-1** bila sudah kedaluwarsa.

### 6.4 Email tidak terkirim / antrean menumpuk

1. Periksa status antrean dan pesan galat pada layar Notifikasi Email Jadwal.
2. Uji koneksi SMTP dari halaman pengaturan.
3. Periksa apakah relay memblokir karena batas laju.
4. Periksa SPF, DKIM, DMARC masih benar — perubahan DNS dapat merusaknya.
5. Bila kredensial ditolak: rotasi dan perbarui rahasia.
6. Setelah pulih: kirim ulang yang gagal. **Periksa idempotensi** agar penerima tidak
   menerima pengingat ganda.
7. Bila penyebabnya di penyedia: kabari pengguna bahwa pengingat tertunda, dan
   sarankan memakai kalender aplikasi sementara.

### 6.5 Email masuk folder spam

1. Periksa skor dengan alat uji spam.
2. Verifikasi SPF, DKIM, DMARC.
3. Periksa reputasi IP pengirim.
4. Kurangi tautan dan lampiran pada template.
5. Minta penerima menandai "bukan spam" dan menambahkan pengirim ke kontak.

### 6.6 Basis data lambat *(produksi)*

1. Periksa kueri paling lambat.
2. Periksa jumlah koneksi terhadap batas.
3. Periksa apakah ada migrasi atau pekerjaan latar yang berjalan.
4. Periksa indeks pada kolom yang sering dipakai menyaring.
5. Tindakan cepat: naikkan TTL cache untuk agregat dashboard.

### 6.7 Disk penuh

1. Cari direktori terbesar.
2. Kandidat pembersihan: log lama, cadangan lama, berkas sementara.
3. **Jangan hapus** berkas unggahan pengguna tanpa persetujuan pemilik produk.
4. Hapus dari yang paling aman; ruang langsung dapat dipakai kembali.
5. Bila berulang: tambah kuota atau pindahkan berkas ke object storage.

### 6.8 Dugaan penyusupan akun

1. Kunci akun terkait segera.
2. Batalkan seluruh sesi aktif akun tersebut.
3. Periksa audit trail: apa yang diakses dan diubah?
4. Bila data pribadi terdampak: aktifkan prosedur insiden PDP
   ([SECURITY.md §5.3](SECURITY.md)) — pemberitahuan ≤ 72 jam.
5. Paksa ganti kredensial, aktifkan MFA bila belum.
6. Dokumentasikan lini masa untuk laporan.

### 6.9 Rollback rilis

**Purwarupa:**
```bash
git revert <sha-bermasalah>
git push origin claude/lab-management-ui-design-rc2lfn
```
lalu jalankan deploy ulang (`git_deploy_deploy` dengan id `ec87827a`).
Waktu pemulihan ± 2 menit; tidak ada data yang hilang.

**Produksi:** kembalikan artefak ke versi sebelumnya. **Jika rilis memuat migrasi
basis data yang merusak, rollback kode saja tidak cukup** — jalankan prosedur
pemulihan sesuai §7 dan libatkan pemilik produk sebelum bertindak.

### 6.10 Data terlihat salah

1. **Jangan perbaiki langsung di basis data.** Tentukan dulu penyebabnya.
2. Periksa audit trail: siapa mengubah, kapan, dari nilai berapa.
3. Bila kesalahan pengguna: perbaiki lewat aplikasi agar ikut tercatat.
4. Bila cacat perangkat lunak: catat sebagai insiden, perbaiki cacatnya, baru
   perbaiki datanya.
5. Bila data BMN terdampak: libatkan Asset Manager — angka ini dipakai audit negara.

## 7. Pencadangan & Pemulihan

| Aspek | Purwarupa | Produksi |
|---|---|---|
| Yang dicadangkan | Repositori Git saja | Basis data, object storage, konfigurasi |
| Frekuensi | Tiap commit | Harian penuh + WAL berkelanjutan |
| Retensi | Tak terbatas | 30 hari harian, 12 bulan bulanan |
| Lokasi | GitHub | Terpisah dari server produksi |
| Uji pemulihan | Tidak berlaku | **Triwulanan, wajib** |

### Prosedur pemulihan *(produksi)*

1. Nyatakan insiden dan kabari pengguna.
2. Aktifkan mode pemeliharaan agar tidak ada tulisan baru.
3. Tentukan titik pemulihan yang diinginkan.
4. Pulihkan ke lingkungan **terpisah** lebih dulu — jangan langsung menimpa produksi.
5. Verifikasi keutuhan: jumlah baris, transaksi terakhir, konsistensi rujukan.
6. Setelah terverifikasi, alihkan ke data hasil pemulihan.
7. Nonaktifkan mode pemeliharaan.
8. Susun laporan: penyebab, dampak, data yang hilang, pencegahan.

> Cadangan yang belum pernah diuji pemulihannya **bukan cadangan**. Latihan
> triwulanan bukan formalitas.

## 8. Perubahan Terencana

| Jenis | Pemberitahuan | Jendela |
|---|---|---|
| Perbaikan cacat kecil | Tidak perlu | Jam kerja |
| Fitur baru | 2 hari kerja | Jam kerja |
| Migrasi basis data | 5 hari kerja | Di luar jam kerja |
| Perubahan infrastruktur | 5 hari kerja | Akhir pekan |
| Darurat keamanan | Secepatnya | Segera |

Setiap perubahan wajib punya: alasan, langkah, cara verifikasi, dan rencana rollback.

## 9. Rotasi Rahasia

| Rahasia | Frekuensi | Prosedur |
|---|---|---|
| Kata sandi basis data | 12 bulan | Buat baru → perbarui konfigurasi → mulai ulang → verifikasi → cabut lama |
| Kredensial SMTP | 12 bulan | Sama, verifikasi dengan email uji |
| Kunci klien SSO | 24 bulan | Koordinasi dengan TI klien |
| Deploy key | 12 bulan | Buat baru di GitHub, ganti di server, hapus lama |
| Sertifikat TLS | Otomatis | AutoSSL; pantau agar tidak terlewat |

**Segera setelah insiden**, rotasi seluruh rahasia yang mungkin terpapar tanpa
menunggu jadwal.

## 10. Pertanyaan Umum Pengguna

| Pertanyaan | Jawaban singkat |
|---|---|
| "Susunan dashboard saya hilang" | Tersimpan per peramban. Ganti perangkat atau bersihkan data situs akan mengembalikannya ke bawaan. Pada produksi hal ini akan tersimpan di server. |
| "Saya tidak menerima email pengingat" | Periksa folder spam, lalu periksa preferensi pada Notifikasi Email Jadwal, lalu periksa antrean pengiriman. |
| "Alat tidak bisa dipesan" | Kemungkinan diblokir karena kalibrasi lewat jatuh tempo, sedang dipelihara, atau checklist kelayakan gagal. Cek layar detail alat. |
| "Barcode tidak terbaca" | Periksa ukuran cetak dan kualitas printer. Label 50 × 25 mm adalah ukuran terkecil yang didukung. |
| "Booking saya tidak muncul di kalender" | Booking baru tampil setelah disetujui, kecuali penyaring status "Waiting Approval" diaktifkan. |
| "Isi label terpotong saat dicetak" | Studio label memberi peringatan sebelum cetak; kurangi elemen, perkecil huruf, atau perbesar label. |

## 11. Setelah Insiden

Untuk setiap Sev-1 dan Sev-2, susun laporan dalam 5 hari kerja berisi:

1. **Lini masa** — kapan mulai, kapan terdeteksi, kapan pulih.
2. **Dampak** — berapa pengguna, fungsi apa, data apa.
3. **Akar masalah** — sebab teknis sebenarnya, bukan sekadar gejala.
4. **Yang membantu / menghambat** pemulihan.
5. **Tindakan perbaikan** dengan pemilik dan tenggat.

Laporan bersifat **tanpa mencari kesalahan orang**. Tujuannya memperbaiki sistem dan
prosedur, bukan menyalahkan individu.
