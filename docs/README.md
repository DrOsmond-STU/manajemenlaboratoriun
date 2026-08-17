# Dokumentasi FLMS

Dokumen teknis dan produk untuk **Facility, Laboratory & Meeting Management System**,
disusun sebagai kelengkapan sebelum pengembangan dan penerapan ke server produksi.

## Daftar Dokumen

| Dokumen | Isi | Baca bila Anda… |
|---|---|---|
| **[PRD.md](PRD.md)** | Kebutuhan produk, pengguna, lingkup, kriteria penerimaan, rencana rilis | Menentukan apa yang dibangun dan mengapa |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Arsitektur purwarupa dan rancangan produksi, model data, alur kritis, ADR | Membangun atau menilai sistemnya |
| **[DESIGN.md](DESIGN.md)** | Token, komponen, pola antarmuka, aksesibilitas, bahasa | Menyentuh tampilan atau menambah layar |
| **[SECURITY.md](SECURITY.md)** | Model ancaman, autentikasi, RBAC, perlindungan data, daftar periksa | Menangani keamanan atau meninjau kode |
| **[TESTING.md](TESTING.md)** | Strategi uji, suite yang ada, gerbang rilis | Menulis atau menjalankan uji |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Prosedur rilis purwarupa dan rancangan pipeline produksi | Menerapkan perubahan ke server |
| **[TASK_INSTRUCTIONS.md](TASK_INSTRUCTIONS.md)** | Konvensi kerja, resep menambah fitur, backlog menuju produksi | Mulai menulis kode |
| **[RUNBOOK.md](RUNBOOK.md)** | Pemantauan, playbook insiden, pencadangan, rotasi rahasia | Bertugas piket atau menangani gangguan |

## Urutan Baca yang Disarankan

**Pemangku kepentingan / pemilik produk**
PRD → DESIGN → DEPLOYMENT §13 (rencana go-live)

**Pengembang baru**
TASK_INSTRUCTIONS → ARCHITECTURE → DESIGN → TESTING

**Peninjau keamanan**
SECURITY → ARCHITECTURE → TESTING §5 (yang belum diuji)

**Tim operasional**
RUNBOOK → DEPLOYMENT → ARCHITECTURE §2

## Yang Harus Dipahami Lebih Dulu

Tiga hal yang memengaruhi cara membaca seluruh dokumen ini:

1. **Yang ada hari ini adalah purwarupa antarmuka, bukan sistem produksi.**
   Tidak ada backend, autentikasi, maupun basis data. Seluruh data fiktif.
   Purwarupa **tidak boleh diisi data nyata**.

2. **Setiap dokumen menandai mana yang sudah ada dan mana yang masih rancangan.**
   ARCHITECTURE dan DEPLOYMENT dipisah tegas menjadi Bagian A (berjalan) dan
   Bagian B (usulan). SECURITY §8 mendaftar kelemahan purwarupa apa adanya.

3. **Master kode barang BMN dalam purwarupa hanyalah cuplikan contoh.**
   Master resmi wajib diimpor dari referensi Kementerian Keuangan/SAKTI milik
   satuan kerja sebelum modul aset dipakai sungguhan.

## Penghalang Rilis

Tugas yang **harus** selesai sebelum data nyata masuk sistem:

- [ ] Autentikasi dan otorisasi sisi server — [SECURITY.md §3–§4](SECURITY.md)
- [ ] Impor master kode barang BMN resmi — [PRD.md §8](PRD.md)
- [ ] Penjadwal dan worker notifikasi email — [ARCHITECTURE.md §10.3](ARCHITECTURE.md)
- [ ] Content-Security-Policy dan header keamanan lengkap — [SECURITY.md §6.2](SECURITY.md)
- [ ] Cadangan berjalan dan pemulihannya pernah diuji — [RUNBOOK.md §7](RUNBOOK.md)
- [ ] Perbaikan aksesibilitas — [DESIGN.md §9](DESIGN.md)

Daftar periksa lengkap ada di [DEPLOYMENT.md §12](DEPLOYMENT.md).
