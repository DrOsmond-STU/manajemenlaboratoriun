# DEPLOYMENT — Prosedur Penerapan
## FLMS · Facility, Laboratory & Meeting Management System

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Berlaku untuk** | Purwarupa (§2–§7) dan rancangan produksi (§8–§11) |
| **Dokumen terkait** | [RUNBOOK.md](RUNBOOK.md) · [SECURITY.md](SECURITY.md) · [TESTING.md](TESTING.md) |

---

## 1. Ringkasan Lingkungan

| Lingkungan | URL | Isi | Status |
|---|---|---|---|
| Lokal | `http://127.0.0.1:8899` | Berkas kerja pengembang | Aktif |
| **Purwarupa** | `https://lab.semestateknologiutama.com` | Peragaan tanpa backend | **Aktif** |
| Staging | *(belum ada)* | Salinan produksi untuk uji | Perlu dibangun |
| Produksi | *(belum ada)* | Sistem sebenarnya dengan data nyata | Perlu dibangun |

> Purwarupa **tidak boleh** dipromosikan menjadi produksi. Ia tidak memiliki
> autentikasi maupun penyimpanan sisi server. Lihat [SECURITY.md §8](SECURITY.md).

---

# BAGIAN A — PENERAPAN PURWARUPA (BERJALAN)

## 2. Konfigurasi Sekarang

| Butir | Nilai |
|---|---|
| Domain | `lab.semestateknologiutama.com` (+ `www.`) |
| Hosting | cPanel · Domainesia |
| Akun | `semestat` |
| Docroot | `/home/semestat/lab.semestateknologiutama.com` |
| Server web | Apache |
| Metode deploy | cPanel Git Version Control (clone + pull) |
| ID deployment | `ec87827a` |
| Repositori | `https://github.com/DrOsmond-STU/manajemenlaboratoriun.git` |
| Branch | `claude/lab-management-ui-design-rc2lfn` |
| Sertifikat | Let's Encrypt, DV, berlaku sampai **13 November 2026** |
| Perpanjangan | AutoSSL cPanel |

## 3. Prasyarat

- Akses cPanel akun `semestat`, atau alat MCP Domainesia yang setara.
- Hak dorong ke branch pada repositori GitHub.
- Repositori **publik** — cPanel melakukan clone tanpa kredensial. Bila repositori
  dijadikan privat, metode deploy harus diubah (lihat §7).

## 4. Prosedur Rilis

### 4.1 Sebelum mendorong perubahan

```bash
npm test                          # seluruh suite harus lolos
git status                        # pastikan tidak ada berkas tak sengaja
git log --oneline -3
```

Daftar periksa:
- [ ] `npm test` lolos — 0 gagal
- [ ] Tidak ada rahasia, `node_modules`, atau berkas sementara yang ter-stage
- [ ] Pesan commit menjelaskan perubahan dan alasannya

### 4.2 Dorong ke repositori

```bash
git push -u origin claude/lab-management-ui-design-rc2lfn
```

Bila gagal karena jaringan, ulangi maksimal 4 kali dengan jeda menaik (2 s, 4 s, 8 s, 16 s).

### 4.3 Terapkan ke server

Melalui alat MCP Domainesia:

```
git_deploy_deploy(id="ec87827a", confirm=true)
```

Atau melalui antarmuka cPanel: **Git Version Control → Manage → Pull or Deploy**.

Deploy melakukan `git pull` pada docroot. Tidak ada langkah build karena aplikasi
dilayani sebagai berkas statis.

### 4.4 Verifikasi setelah deploy

```
git_deploy_list()      →  last_deploy_status harus "success"
```

Periksa ukuran berkas di server cocok dengan lokal:

```
get_file_info("/home/semestat/lab.semestateknologiutama.com/assets/js/app.js")
```

Lalu daftar periksa berikut — **seluruhnya wajib**:

- [ ] `https://lab.semestateknologiutama.com/` memuat halaman masuk
- [ ] Klik **Masuk** → dashboard tampil dengan widget terisi
- [ ] Beberapa rute dibuka acak (kalender, register BMN, studio label) tanpa halaman kosong
- [ ] Tidak ada galat di konsol peramban
- [ ] `https://lab.semestateknologiutama.com/.git/config` mengembalikan **404**
- [ ] `http://` dialihkan ke `https://`
- [ ] Sertifikat sah dan belum kedaluwarsa
- [ ] Tampilan diperiksa pada satu perangkat ponsel

Uji otomatis dapat diarahkan ke server langsung:

```bash
FLMS_BASE=https://lab.semestateknologiutama.com npm test
```

> **Catatan dari lingkungan pengembangan.** Sesi pengembangan berjalan di balik proxy
> egress organisasi yang memblokir domain ini, sehingga verifikasi HTTP tidak dapat
> dilakukan dari sana. Verifikasi dilakukan dari sisi server (status deploy + ukuran
> berkas) dan **wajib dilengkapi pemeriksaan peramban oleh pihak klien**. Bila Anda
> tidak menghadapi pembatasan proxy, jalankan perintah `FLMS_BASE=…` di atas.

## 5. Konfigurasi Server

Berkas `.htaccess` berada di repositori, sehingga ikut ter-deploy dan terversi.

| Bagian | Fungsi |
|---|---|
| `DirectoryIndex index.html` | Halaman awal |
| `IndexIgnore *` | Mencegah daftar isi direktori |
| `RedirectMatch 404 /\.git` | Menutup direktori repositori |
| `RewriteRule` HTTPS | Memaksa koneksi terenkripsi |
| `AddType` | Tipe konten CSS, JS, SVG |
| `mod_deflate` | Kompresi teks |
| `mod_expires` | Cache aset 1 jam, HTML tanpa cache |
| `mod_headers` | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` |

**Alasan penting.** Setiap direktif dibungkus `<IfModule>` dan sengaja dipilih yang
kebutuhan `AllowOverride`-nya paling rendah — `IndexIgnore *` dipakai, bukan
`Options -Indexes`. Pada shared hosting, `Options` yang tidak diizinkan menghasilkan
**Internal Server Error pada seluruh situs**. Bila menambah direktif baru, pertahankan
prinsip ini.

## 6. Rollback

Karena aplikasi statis dan seluruh riwayat ada di Git, rollback berarti mengembalikan
branch lalu deploy ulang.

```bash
git revert <sha-commit-bermasalah>      # cara aman, riwayat tetap utuh
git push origin claude/lab-management-ui-design-rc2lfn
```
lalu jalankan kembali `git_deploy_deploy`.

Bila perlu kembali beberapa commit sekaligus:
```bash
git revert --no-commit <sha-lama>..HEAD
git commit -m "Kembalikan ke keadaan <sha-lama>"
git push
```

**Waktu pemulihan:** ± 2 menit. **Kehilangan data:** tidak ada — purwarupa tidak
menyimpan data di server. Preferensi pengguna di `localStorage` tidak terpengaruh.

## 7. Bila Repositori Dijadikan Privat

Metode clone tanpa kredensial akan berhenti bekerja. Dua pilihan:

1. **Deploy key**: buat kunci SSH pada cPanel, daftarkan sebagai deploy key baca-saja
   di GitHub, ubah URL remote menjadi SSH.
2. **Unggah artefak**: bangun arsip pada CI lalu unggah dan ekstrak di server.
   Menghilangkan `.git` dari docroot — lebih aman, tetapi rollback jadi manual.

---

# BAGIAN B — PENERAPAN PRODUKSI (RANCANGAN)

## 8. Topologi Target

```
GitHub ──push──► CI/CD ──┬──► Registry artefak
                         │
                         ├──► Staging  (otomatis dari branch develop)
                         │
                         └──► Produksi (manual, setelah persetujuan)

Produksi:
  reverse proxy (TLS, WAF) → web statis (CDN) + API server
  API → PostgreSQL + Redis + object storage
  Worker + penjadwal → SMTP relay
```

## 9. Alur CI/CD

| Tahap | Isi | Gagal berarti |
|---|---|---|
| Lint | Gaya kode dan analisis statis | Blokir |
| Uji unit | Aturan bisnis | Blokir |
| Uji integrasi | API + basis data uji | Blokir |
| Build | Bundel, minifikasi, hash aset | Blokir |
| Pindai keamanan | Dependensi + rahasia di riwayat | Blokir bila tinggi/kritis |
| Deploy staging | Otomatis | Blokir |
| Uji E2E | 7 suite terhadap staging | Blokir |
| Aksesibilitas | axe-core | Peringatan, blokir bila serius |
| **Persetujuan manual** | Pemilik produk | — |
| Deploy produksi | Bertahap dengan pemeriksaan kesehatan | Rollback otomatis |
| Uji asap produksi | Alur kritis | Rollback otomatis |

## 10. Migrasi Basis Data

**Aturan yang tidak boleh dilanggar:**

1. Migrasi **maju saja**; tidak ada `down` di produksi. Perbaikan dilakukan dengan
   migrasi baru.
2. Perubahan yang merusak dipecah tiga rilis: tambah kolom baru → tulis ke keduanya
   → hapus kolom lama.
3. Setiap migrasi diuji pada **salinan data produksi** sebelum dijalankan.
4. Migrasi besar dijalankan di luar jam kerja dengan jendela pemeliharaan.
5. Cadangan diambil **tepat sebelum** migrasi, dan pemulihannya sudah pernah diuji.

## 11. Konfigurasi & Rahasia

| Jenis | Contoh | Tempat |
|---|---|---|
| Konfigurasi tak rahasia | URL dasar, zona waktu, jam operasional | Berkas konfigurasi terversi |
| Rahasia | Kata sandi basis data, kredensial SMTP, kunci SSO | Pengelola rahasia / variabel platform |
| Per lingkungan | Semua di atas | Terpisah total antar lingkungan |

Rahasia **tidak pernah** masuk repositori. `.gitignore` wajib memuat `.env`.

## 12. Daftar Periksa Pra-Deployment Produksi

Gabungan seluruh dokumen. Wajib tertutup sebelum data nyata masuk.

**Fungsional**
- [ ] Seluruh kriteria penerimaan [PRD.md §6](PRD.md) terpenuhi
- [ ] Master kode barang BMN resmi sudah diimpor dan diverifikasi bagian BMN klien
- [ ] Data awal (pegawai, ruangan, aset) termigrasi dan dicocokkan
- [ ] Alur persetujuan sesuai struktur organisasi sebenarnya

**Teknis**
- [ ] `npm test` lolos pada staging
- [ ] Anggaran kinerja terpenuhi
- [ ] Migrasi basis data diuji pada salinan data produksi
- [ ] Penjadwal dan worker berjalan serta terpantau
- [ ] Cadangan berjalan dan **pemulihan pernah diuji**

**Keamanan**
- [ ] Seluruh butir [SECURITY.md §12](SECURITY.md) tertutup
- [ ] Uji penetrasi selesai, temuan tinggi tertutup
- [ ] TLS, HSTS, dan CSP aktif serta diverifikasi

**Operasional**
- [ ] [RUNBOOK.md](RUNBOOK.md) lengkap dengan kontak sebenarnya
- [ ] Pemantauan dan peringatan aktif serta pernah diuji memicu
- [ ] Prosedur rollback tertulis dan pernah dilatih
- [ ] Pelatihan pengguna selesai untuk setiap peran
- [ ] Dukungan pasca-go-live disepakati (siapa, jam berapa, lewat apa)

**Kepatuhan**
- [ ] Pemberitahuan privasi tayang
- [ ] Perjanjian pemrosesan data ditandatangani
- [ ] Kebijakan retensi terkonfigurasi
- [ ] Persetujuan hukum/kepatuhan klien atas pemetaan regulasi

## 13. Rencana Go-Live

| Tahap | Durasi | Isi |
|---|---|---|
| Uji coba terbatas | 2 minggu | Satu laboratorium, satu gedung, cara lama tetap jalan |
| Paralel | 2 minggu | Seluruh unit memakai sistem, cara lama sebagai cadangan |
| Pemotongan | 1 hari | Cara lama dihentikan, jendela pemeliharaan diumumkan |
| Pemantauan intensif | 2 minggu | Pemantauan harian, perbaikan cepat |

**Kriteria batal pindah:** bila pada masa paralel ditemukan kehilangan data,
kegagalan pengiriman notifikasi > 5%, atau bentrok jadwal yang lolos, pemotongan
ditunda sampai penyebabnya tertutup.
