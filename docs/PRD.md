# PRD — Product Requirements Document
## FLMS · Facility, Laboratory & Meeting Management System

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Status produk** | Purwarupa UI/UX selesai · produksi belum dibangun |
| **Pemilik produk** | *(diisi klien)* |
| **Terakhir diperbarui** | Agustus 2026 |
| **Dokumen terkait** | [ARCHITECTURE.md](ARCHITECTURE.md) · [DESIGN.md](DESIGN.md) · [SECURITY.md](SECURITY.md) · [TESTING.md](TESTING.md) |

> **Batas dokumen ini.** PRD menjelaskan produk yang akan dibangun. Yang sudah ada
> hari ini adalah **purwarupa antarmuka tanpa backend** — seluruh data fiktif,
> autentikasi tidak diproses, dan perubahan hanya tersimpan di peramban. Setiap
> bagian menandai status: **[P]** sudah diperagakan di purwarupa, **[B]** perlu
> dibangun untuk produksi.

---

## 1. Ringkasan Eksekutif

FLMS adalah platform terpusat untuk mengelola laboratorium, peralatan, aset, ruangan,
ruang rapat, dan auditorium — mulai dari pemesanan, persetujuan, pemeliharaan,
kalibrasi, penyewaan, hingga pelaporan manajemen. Sistem diposisikan sebagai
*Facility, Laboratory & Meeting Management System*, bukan sekadar aplikasi booking
ruangan, karena tiga hal yang jarang tersedia dalam satu produk:

1. **Penatausahaan aset mengikuti kaidah Barang Milik Negara (BMN)** — kodefikasi,
   NUP, penyusutan, dan label baku, sehingga satuan kerja pemerintah tidak perlu
   membuat pencatatan ganda.
2. **Pencegahan benturan sumber daya lintas jenis** — ruangan, laboratorium, alat,
   penanggung jawab, dan fasilitas pendukung diperiksa dalam satu mesin jadwal.
3. **Kepatuhan operasional yang melekat pada orang** — checklist pemeriksaan,
   perawatan, kebersihan, kerapian, dan kelayakan ditugaskan ke pengguna dan
   dipantau kepatuhannya.

## 2. Masalah yang Diselesaikan

| # | Masalah saat ini | Dampak | Ditangani oleh |
|---|---|---|---|
| M1 | Jadwal ruangan dan alat tersebar di grup pesan dan berkas spreadsheet | Bentrok jadwal, ruangan kosong tak termanfaatkan | Kalender terpadu + deteksi konflik |
| M2 | Data aset laboratorium terpisah dari catatan BMN satuan kerja | Pencatatan ganda, selisih saat audit | Register BMN (KIB B) sebagai kunci utama |
| M3 | Kalibrasi dan pemeliharaan terlewat karena pengingat manual | Hasil uji diragukan, temuan audit, alat rusak | Jadwal + notifikasi email berjenjang |
| M4 | Penyewaan fasilitas dikelola manual dari penawaran sampai kuitansi | Pendapatan bocor, piutang tak tertagih | Modul penyewaan & penagihan |
| M5 | Pemeriksaan rutin tidak terekam dan tidak dapat ditelusuri | Tidak ada bukti kepatuhan, temuan berulang | Checklist bertanda tangan + riwayat berskor |
| M6 | Laporan manajemen disusun manual tiap rapat | Lambat, tidak konsisten, sulit dibandingkan | Dashboard yang dapat disunting + Balanced Scorecard |
| M7 | Penanggung jawab tidak tahu jadwal yang menjadi tanggungannya | Persiapan telat, alat tidak siap | Ringkasan harian per PIC melalui email |

## 3. Sasaran Produk & Ukuran Keberhasilan

| Sasaran | Indikator | Baseline | Target 12 bulan |
|---|---|---|---|
| Memusatkan pengelolaan fasilitas | Persentase booking melalui sistem | 0% | ≥ 90% |
| Menaikkan pemanfaatan ruangan | Utilisasi ruangan rata-rata | ~58% | ≥ 70% |
| Menekan bentrok jadwal | Insiden bentrok per bulan | tidak terukur | ≤ 2 |
| Menjaga kepatuhan kalibrasi | Alat kalibrasi tepat waktu | ~70% | 100% |
| Menertibkan BMN | Aset terekonsiliasi saat audit | ~89% | ≥ 99% |
| Menaikkan pendapatan sewa | Pendapatan sewa per tahun | Rp 490 jt | ≥ Rp 600 jt |
| Kepatuhan pemeriksaan rutin | Checklist selesai tepat waktu | tidak terukur | ≥ 95% |
| Adopsi pengguna | Pengguna aktif bulanan / total | 0% | ≥ 85% |

> Angka baseline berasal dari data contoh purwarupa. **Sebelum pengembangan
> dimulai, baseline wajib diganti dengan angka riil satuan kerja** agar target
> tidak menyesatkan.

## 4. Pengguna & Peran

12 peran dengan cakupan data berbeda (lihat matriks lengkap di
[SECURITY.md §4](SECURITY.md#4-otorisasi-rbac)):

| Peran | Kebutuhan utama |
|---|---|
| Super Admin | Konfigurasi sistem, master data, hak akses |
| Facility Manager | Persetujuan fasilitas, tarif, utilisasi, laporan |
| Laboratory Manager | Laboratorium, alat, kalibrasi, persetujuan lab |
| Lab Technician | Operasional alat, kalibrasi, serah terima, checklist |
| Asset Manager | Register BMN, mutasi, audit aset, peminjaman |
| Room Administrator | Booking ruangan, layout, fasilitas tambahan |
| Event Manager | Event, vendor, peserta, dokumentasi |
| Finance | Penawaran, tagihan, pembayaran, laporan keuangan |
| PIC / Penanggung Jawab | Persetujuan tingkat pertama, checklist resource yang diampu |
| Employee / User | Mengajukan booking dan peminjaman, melihat jadwal |
| External User | Pengajuan sewa dari luar organisasi |
| Management | Dashboard eksekutif, Balanced Scorecard, persetujuan akhir |

### Persona utama

**Bayu — Lab Technician.** Menjaga 18 alat, mengerjakan checklist harian, dan
paling sering menjadi korban jadwal bentrok. Ukuran sukses baginya: tahu apa yang
harus dikerjakan hari ini tanpa membuka lima aplikasi.

**Rahmat — Facility Manager.** Menyetujui puluhan pengajuan per minggu dan harus
melaporkan utilisasi tiap bulan. Ukuran sukses: persetujuan selesai dari ponsel,
laporan tersusun sendiri.

**Siti — Asset Manager.** Bertanggung jawab saat audit BMN. Ukuran sukses: nomor
BMN, foto, dan riwayat mutasi tersedia dalam satu layar.

## 5. Ruang Lingkup

### 5.1 Dalam lingkup — MVP 1 (Core Facility)

| Modul | Cakupan | Status |
|---|---|---|
| Autentikasi & sesi | SSO korporat, peran demo | [B] |
| Master data | Organisasi, unit, gedung, lantai, kategori, status | [P] |
| Laboratorium | Profil, kapasitas, fasilitas, PIC, jam operasional | [P] |
| Ruangan | Profil, jenis, layout, tarif, PIC | [P] |
| Alat laboratorium | Identitas, status, kondisi, spesifikasi, dokumen | [P] |
| Aset & BMN | Register KIB B, kodefikasi, NUP, penyusutan, foto | [P] |
| Kalender terpadu | Bulanan/mingguan/harian, filter, papan ketersediaan | [P] |
| Booking ruangan | Wizard 5 langkah, validasi kapasitas, deteksi bentrok | [P] |
| Reservasi alat | Request → approval → pakai → kembali → inspeksi | [P] |
| Persetujuan | Alur bersyarat, SLA, delegasi, eskalasi | [P] |
| Label & barcode | Label BMN baku + label internal yang dapat diatur | [P] |
| Notifikasi | In-app, email; kanal WhatsApp menyusul | [P] |
| Dashboard | Operasional & manajemen, dapat disunting | [P] |
| Laporan dasar | Utilisasi, ruangan, alat, aset | [P] |

### 5.2 Dalam lingkup — Fase berikutnya

- **Fase 2 — Komersial:** penyewaan, tarif, paket, penawaran, tagihan, pembayaran, event. [P]
- **Fase 3 — Keunggulan operasional:** pemeliharaan, kalibrasi, audit aset, pengunjung,
  BAST digital, checklist, analitik lanjutan, aplikasi seluler. [P] kecuali aplikasi seluler [B]
- **Fase 4 — Enterprise & AI:** AI Assistant sungguhan, prediksi pemeliharaan dan
  utilisasi, generator laporan, integrasi/API, dasbor BI, IoT/RFID. [B]

### 5.3 Di luar lingkup rilis pertama

- Aplikasi seluler native (web responsif dipakai lebih dulu)
- Integrasi langsung ke SAKTI/SIMAK-BMN (ekspor berkas dulu, integrasi menyusul)
- Kunci pintu pintar dan sensor IoT
- Multi-satuan-kerja dalam satu tenant
- Bahasa selain Indonesia

## 6. Kebutuhan Fungsional Kunci

Ditulis sebagai cerita pengguna dengan kriteria penerimaan yang dapat diuji.

### FR-01 · Booking ruangan tanpa bentrok
> *Sebagai* pegawai, *saya ingin* memesan ruangan yang benar-benar tersedia,
> *supaya* kegiatan saya tidak batal karena bentrok.

**Kriteria penerimaan**
1. Sistem menolak ruangan yang jadwalnya beririsan pada rentang waktu yang diminta.
2. Ruangan berkapasitas kurang dari jumlah peserta ditandai tidak memenuhi disertai alasan.
3. Resource yang sedang dalam pemeliharaan tidak dapat dipesan.
4. Alur persetujuan dipilih otomatis: tarif nol → PIC; berbiaya → PIC lalu Keuangan.
5. Pemohon menerima notifikasi in-app dan email setelah pengajuan dan setelah keputusan.

### FR-02 · Identitas barang dengan dua penomoran
> *Sebagai* Asset Manager, *saya ingin* satu barang punya nomor BMN sekaligus
> nomor internal, *supaya* tidak ada pencatatan ganda saat audit.

**Kriteria penerimaan**
1. Kunci utama berupa `kode lokasi · kode barang · NUP` sesuai PMK 29/PMK.06/2010.
2. NUP terbit otomatis, berurut per sub-sub kelompok menurut urutan perolehan.
3. Kode internal mengikuti pola yang dapat diatur pengelola dan wajib unik.
4. Kedua nomor tampil berdampingan di daftar, detail, dan label.
5. Kode barang dipilih dari master resmi, bukan diketik bebas.

### FR-03 · Label dan barcode yang dapat dipindai
> *Sebagai* petugas inventaris, *saya ingin* mencetak label yang benar-benar
> terbaca pemindai, *supaya* stock opname berjalan cepat.

**Kriteria penerimaan**
1. Label BMN memuat kode lokasi, tahun perolehan, kode barang, dan NUP.
2. Barcode Code 128 dan QR terbaca oleh pemindai umum pada ukuran cetak terkecil (50 × 25 mm).
3. Susunan label internal dapat diatur: ukuran, bingkai, kepala, elemen isi, urutan,
   ukuran huruf, jenis dan posisi kode, serta pola muatan barcode.
4. Sistem memperingatkan bila isi label tidak muat, sebelum dicetak.
5. Lembar cetak A4 tersusun otomatis sesuai ukuran label.

### FR-04 · Checklist yang melekat pada orang
> *Sebagai* PIC, *saya ingin* melihat pemeriksaan yang menjadi tugas saya hari ini,
> *supaya* tidak ada yang terlewat.

**Kriteria penerimaan**
1. Enam jenis tersedia: pengecekan & verifikasi, perawatan, persiapan penyewaan,
   kebersihan, kerapian, kelayakan.
2. Template dibuat dan diubah pengguna tanpa bantuan pengembang.
3. Checklist melekat pada resource sekaligus ditugaskan ke pengguna.
4. Butir wajib tidak boleh kosong; butir tidak sesuai menuntut uraian temuan.
5. Temuan memicu tindakan sesuai konfigurasi: notifikasi, work order, atau blokir resource.
6. Hasil tersimpan sebagai riwayat berskor yang dapat ditelusuri.

### FR-05 · Notifikasi email seluruh jadwal
> *Sebagai* penanggung jawab, *saya ingin* menerima email untuk setiap jadwal
> yang menjadi tanggung jawab saya, *supaya* saya siap sebelum hari-H.

**Kriteria penerimaan**
1. Delapan sumber jadwal terpetakan: booking, reservasi alat, pemeliharaan,
   kalibrasi, peminjaman, checklist, event, agenda.
2. Setiap jadwal memiliki penerima utama, tembusan, dan waktu kirim yang dapat diatur.
3. Satu ringkasan harian per penanggung jawab dikirim pada jam yang dapat diatur.
4. Kegagalan pengiriman tercatat dan dicoba ulang; status dapat dilihat pengelola.
5. Penerima dapat mengatur preferensi kanal dan jam ringkasan.

### FR-06 · Dashboard yang dapat disunting pengguna
> *Sebagai* manajer, *saya ingin* menyusun sendiri isi dashboard, *supaya* rapat
> bulanan memakai tampilan yang saya butuhkan.

**Kriteria penerimaan**
1. Isi widget (judul, sumber data, metrik, batas baris) dapat diubah.
2. Bentuk tampilan dapat diganti tanpa kehilangan konteks data.
3. Lebar dan tinggi dapat diatur, termasuk dengan menyeret sudut widget.
4. Urutan widget dapat diubah dengan seret-lepas.
5. Susunan tersimpan per pengguna dan dapat dikembalikan ke bawaan.

### FR-07 · Balanced Scorecard
> *Sebagai* manajemen, *saya ingin* melihat capaian strategis dalam empat perspektif,
> *supaya* keputusan tidak hanya berdasar angka keuangan.

**Kriteria penerimaan**
1. Empat perspektif dengan bobot yang jumlahnya 100%.
2. KPI memiliki satuan, bobot, target, realisasi, dan polaritas (maksimum/minimum).
3. Skor berjenjang: KPI → perspektif → total, seluruhnya rata-rata tertimbang.
4. Perubahan target atau realisasi langsung memperbarui seluruh tampilan.
5. Peta strategi menampilkan hubungan sebab-akibat antar perspektif.

## 7. Kebutuhan Non-Fungsional

| Aspek | Target | Rujukan |
|---|---|---|
| Waktu muat halaman | ≤ 2,5 s (LCP) pada 4G | [TESTING.md §7](TESTING.md) |
| Waktu tanggap API | ≤ 300 ms p95 untuk baca, ≤ 800 ms p95 untuk tulis | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Ketersediaan | 99,5% pada jam kerja (07.00–18.00 WIB) | [RUNBOOK.md](RUNBOOK.md) |
| Pengguna serentak | 200 aktif, puncak 500 | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Volume data | 10.000 aset, 50.000 booking/tahun, 5 tahun retensi | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Aksesibilitas | WCAG 2.2 level AA | [DESIGN.md §9](DESIGN.md) |
| Peramban | Dua versi terakhir Chrome, Edge, Firefox, Safari | [DESIGN.md](DESIGN.md) |
| Keamanan | OWASP ASVS L2; UU 27/2022 PDP | [SECURITY.md](SECURITY.md) |
| Pemulihan | RPO ≤ 24 jam, RTO ≤ 4 jam | [RUNBOOK.md](RUNBOOK.md) |
| Bahasa | Indonesia; istilah teknis boleh Inggris bila lazim | [DESIGN.md §11](DESIGN.md) |

## 8. Kepatuhan Regulasi

| Regulasi | Penerapan | Status verifikasi |
|---|---|---|
| PMK 29/PMK.06/2010 — Penggolongan & Kodefikasi BMN | Kode barang 10 digit `X.XX.XX.XX.XXX`; NUP per sub-sub kelompok | Terverifikasi dari sumber publik |
| PMK 181/PMK.06/2016 — Penatausahaan BMN | Register/KIB B, DBR, status penggunaan, PSP | Terverifikasi keberadaannya |
| PMK 65/PMK.06/2017 — Penyusutan BMN | Masa manfaat, garis lurus, akumulasi, nilai buku | Perlu konfirmasi versi berlaku |
| UU 27/2022 — Pelindungan Data Pribadi | Data pegawai, tamu, klien | Perlu kajian hukum klien |
| Perpres 95/2018 — SPBE | Bila satuan kerja instansi pemerintah | Perlu konfirmasi keberlakuan |

> **Peringatan penting.** Master kode barang di purwarupa hanya **cuplikan contoh**.
> Sebelum produksi, master resmi wajib diimpor utuh dari referensi Kementerian
> Keuangan/SAKTI milik satuan kerja, dan pemetaan kolom diverifikasi ulang terhadap
> versi peraturan yang berlaku. Angka masa manfaat juga wajib dikonfirmasi.

## 9. Asumsi & Ketergantungan

**Asumsi**
- Satu satuan kerja per instalasi pada rilis pertama.
- Seluruh pengguna internal memiliki alamat email organisasi.
- Identitas dikelola direktori korporat yang mendukung SSO.
- Jam operasional fasilitas seragam; pengecualian ditangani sebagai konfigurasi.

**Ketergantungan pihak lain**
| Ketergantungan | Pemilik | Risiko bila terlambat |
|---|---|---|
| Master kode barang BMN | Bagian BMN klien | Modul aset tidak dapat dipakai produksi |
| Akses SSO / direktori | TI klien | Mundur ke autentikasi lokal |
| Kredensial SMTP + SPF/DKIM/DMARC | TI klien | Email masuk spam atau tidak terkirim |
| Data master pegawai (HRIS) | SDM klien | Pengguna diinput manual |
| Payment gateway | Keuangan klien | Pembayaran dicatat manual |

## 10. Risiko Produk

| Risiko | Dampak | Peluang | Mitigasi |
|---|---|---|---|
| Kode barang BMN tidak sesuai versi berlaku | Tinggi | Sedang | Impor master resmi + validasi bersama bagian BMN sebelum go-live |
| Email masuk folder spam | Tinggi | Sedang | Domain pengirim khusus, SPF/DKIM/DMARC, pemantauan delivery rate |
| Pengguna kembali ke grup pesan | Tinggi | Sedang | Ringkasan harian, tampilan ponsel, pendampingan 4 minggu pertama |
| Checklist dianggap beban administratif | Sedang | Tinggi | Butir ringkas, target ≤ 15 menit, dapat dikerjakan dari ponsel |
| Susunan dashboard hilang saat ganti perangkat | Sedang | Tinggi | Simpan preferensi di server, bukan hanya peramban |
| Barcode label tidak terbaca pemindai lapangan | Tinggi | Rendah | Sudah diuji dengan decoder independen; uji ulang dengan pemindai fisik klien |

## 11. Rencana Rilis

| Tahap | Isi | Kriteria keluar |
|---|---|---|
| **R0 — Purwarupa** *(selesai)* | 63 layar, alur utama, tanpa backend | Disetujui pemangku kepentingan sebagai acuan visual & alur |
| **R1 — MVP** | Autentikasi, master data, booking, aset/BMN, persetujuan, notifikasi, dashboard | Uji penerimaan pengguna lolos; 2 minggu paralel dengan cara lama |
| **R2 — Komersial** | Penyewaan, tarif, penawaran, tagihan, pembayaran, event | Transaksi sewa penuh tanpa proses manual |
| **R3 — Operasional** | Pemeliharaan, kalibrasi, checklist, pengunjung, BAST digital | Kepatuhan kalibrasi 100% selama satu siklus |
| **R4 — Enterprise & AI** | AI Assistant, prediksi, integrasi, BI, IoT/RFID | Ditentukan setelah R3 |

## 12. Pertanyaan Terbuka

Perlu jawaban klien sebelum pengembangan R1 dimulai:

1. Satu satuan kerja atau perlu multi-satker sejak awal?
2. Penyedia SSO yang dipakai dan apakah MFA diwajibkan?
3. Apakah data tamu (pengunjung) termasuk data pribadi yang diatur kebijakan internal?
4. Berapa lama retensi foto barang dan bukti checklist?
5. Apakah tanda tangan pada checklist harus tanda tangan elektronik tersertifikasi?
6. Apakah ekspor ke SAKTI harus format berkas tertentu?
7. Siapa pemilik keputusan bila bentrok jadwal antar unit terjadi?
