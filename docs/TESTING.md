# TESTING — Strategi & Prosedur Pengujian
## FLMS · Facility, Laboratory & Meeting Management System

| | |
|---|---|
| **Versi dokumen** | 1.0 |
| **Cakupan sekarang** | 7 suite otomatis · **91 asersi · 0 gagal** |
| **Dokumen terkait** | [DEPLOYMENT.md](DEPLOYMENT.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [TASK_INSTRUCTIONS.md](TASK_INSTRUCTIONS.md) |

---

## 1. Menjalankan Uji

```bash
npm install      # sekali saja
npm test         # menjalankan seluruh suite
```

Runner menyalakan server statisnya sendiri, menjalankan tujuh suite berurutan, lalu
mematikannya. Tidak perlu server yang sudah berjalan.

```bash
node tests/run-all.js feattest    # satu suite saja
FLMS_BASE=https://lab.semestateknologiutama.com npm test   # menguji lingkungan lain
FLMS_CHROMIUM=/path/ke/chromium npm test                   # peramban di lokasi khusus
```

Tangkapan layar hasil uji tersimpan di `tests/screenshots/` (tidak ikut ter-commit).

## 2. Filosofi Pengujian

Tiga prinsip yang membentuk suite ini:

**Uji hasil, bukan pemanggilan fungsi.** Seret-lepas widget diuji dengan gerakan
tetikus sungguhan (`page.mouse.down/move/up`), bukan dengan memanggil fungsi
penyusun ulang. Uji yang memanggil fungsi internal akan tetap hijau meski pegangan
seret tidak dapat diklik pengguna.

**Balik prosesnya untuk hal yang tidak bisa dilihat mata.** Barcode tidak dapat
diverifikasi dengan melihat gambar. Suite merender SVG ke kanvas lalu **membacanya
kembali dengan decoder independen** (ZXing untuk Code 128, jsQR untuk QR). Cara ini
menemukan satu cacat nyata: penempatan *format information* QR tertukar baris/kolom,
sehingga QR tampak normal tetapi tidak terbaca sama sekali oleh pemindai.

**Setiap galat konsol adalah kegagalan.** Suite memantau `pageerror` dan
`console.error`; satu galat saja menggagalkan suite. Inilah yang menangkap
`DB.fdate is not a function` — kesalahan yang membuat seluruh modul administrasi
gagal dimuat tanpa gejala yang terlihat di layar.

## 3. Suite yang Ada

| Suite | Asersi | Yang diverifikasi |
|---|---:|---|
| `bctest` | 8 | Code 128 & QR untuk 8 muatan, termasuk 1 karakter dan 100 karakter, dibaca ulang decoder independen |
| `smoke` | 63 rute | Seluruh rute merender, isi tidak kosong, tanpa galat; 14 drawer/modal terbuka; wizard 5 langkah; AI Assistant menjawab |
| `overflow` | 19 rute | Tidak ada gulir mendatar pada 390 px; elemen di luar wadah scroll dilaporkan |
| `bmntest` | 30 | Register BMN, format kunci utama, filter kode barang, unggah foto, studio label, decode barcode di dalam label, lembar cetak, template |
| `tplcheck` | 3 | Tiga template label bawaan muat tanpa terpotong vertikal maupun mendatar |
| `bmnlbl` | 5 | Label BMN rapi pada 4 ukuran; barcode pada ukuran terkecil tetap terbaca |
| `feattest` | 45 | Dashboard dapat disunting, dashboard kustom, Balanced Scorecard, checklist, notifikasi email |

### Yang diperiksa paling ketat

**Barcode terbaca.** Bukan hanya encoder yang diuji, tetapi juga barcode yang
**sudah tercetak di dalam label** — dirender pada ukuran milimeter, diambil dari DOM,
lalu didekode. Termasuk pada label 50 × 25 mm, ukuran terkecil yang didukung.

**Aturan BMN.** Format kunci utama diperiksa dengan ekspresi reguler terhadap pola
`kode lokasi · kode barang 10 digit · NUP 5 digit`. NUP terbukti berurut per sub-sub
kelompok, sesuai PMK 29/PMK.06/2010.

**Skor Balanced Scorecard.** Rumus rata-rata tertimbang dihitung ulang secara mandiri
di dalam uji lalu dibandingkan dengan hasil aplikasi; keduanya harus sama.

**Notifikasi email.** Diverifikasi bahwa delapan sumber jadwal tercakup dan
**setiap baris memuat alamat email penanggung jawab** (57 dari 57), bukan sekadar
tabel yang tampil.

**Validasi checklist.** Uji secara sengaja mencoba menyelesaikan checklist dengan
butir wajib kosong dan memastikan sistem menolaknya.

## 4. Cacat yang Ditemukan Suite Ini

Bukti bahwa uji ini bekerja, bukan sekadar formalitas:

| Cacat | Ditemukan oleh | Dampak bila lolos |
|---|---|---|
| Penempatan format info QR tertukar | `bctest` | Seluruh QR tidak terbaca pemindai |
| `DB.fdate` seharusnya `UI.fdate` | `smoke` | Modul administrasi + AI Assistant gagal dimuat |
| Gulir mendatar pada 8 rute di 390 px | `overflow` | Aplikasi tidak terpakai di ponsel |
| Barcode terdorong keluar saat isi label banyak | `tplcheck` | Label tercetak tanpa barcode |
| Teks label terpotong diam-diam | `tplcheck` | Label salah cetak, kertas terbuang |
| Pengguna bawaan tidak punya tugas checklist | `feattest` | Halaman "Checklist Saya" tampak rusak |
| `.kpi-ico` melebar penuh di luar kartu KPI | tinjauan visual | Ikon rusak di beberapa halaman |

## 5. Yang **Belum** Diuji

Ditulis terbuka agar tidak ada rasa aman yang keliru:

| Area | Alasan | Rencana |
|---|---|---|
| Autentikasi & otorisasi | Belum ada di purwarupa | Wajib sebelum R1 — termasuk uji akses lintas peran |
| Aturan bisnis sisi server | Seluruh logika masih di klien | Uji unit + integrasi saat API dibangun |
| Aksesibilitas | Belum diaudit | axe-core otomatis + uji papan ketik manual |
| Kinerja beban | Situs statis | k6/Artillery terhadap API |
| Peramban selain Chromium | Suite memakai Chromium | Tambah Firefox & WebKit pada CI |
| Pemindai barcode fisik | Hanya decoder perangkat lunak | **Uji lapangan dengan pemindai klien sebelum cetak massal** |
| Pengiriman email nyata | Tidak ada SMTP | Uji ke kotak surat uji + cek skor spam |
| Regresi visual | Belum ada baseline | Tambah perbandingan tangkapan layar |
| Pemulihan cadangan | Belum ada basis data | Latihan pemulihan triwulanan |

## 6. Piramida Uji Target (Produksi)

```
        ╱╲          Manual & UAT — alur bisnis lintas peran
       ╱  ╲         E2E otomatis — 7 suite yang ada + alur auth
      ╱    ╲        Integrasi — API + basis data + antrean
     ╱      ╲       Unit — aturan bisnis, perhitungan, validator
    ╱________╲
```

| Lapis | Target cakupan | Alat usulan |
|---|---|---|
| Unit | ≥ 80% pada modul aturan bisnis | Vitest / Jest |
| Integrasi | Seluruh endpoint API | Supertest + basis data uji |
| E2E | Seluruh alur kritis | Playwright (sudah dipakai) |
| Aksesibilitas | Seluruh rute | axe-core |
| Kinerja | Endpoint terpanas | k6 |
| Keamanan | Tiap rilis | Pemindai dependensi + uji penetrasi tahunan |

### Aturan bisnis yang wajib punya uji unit

Bagian yang paling mahal bila salah:

1. **Deteksi bentrok jadwal** — termasuk kasus batas: booking berakhir tepat saat
   yang lain mulai (tidak boleh dianggap bentrok).
2. **Penerbitan NUP** — harus berurut per sub-sub kelompok dan tahan terhadap
   registrasi bersamaan.
3. **Perhitungan penyusutan** — garis lurus, tidak boleh menghasilkan nilai buku negatif.
4. **Pemilihan alur persetujuan** — tarif nol vs berbiaya vs auditorium.
5. **Skor checklist** dan pemicu tindak lanjut.
6. **Skor BSC** — termasuk polaritas minimum dan pembagian dengan nol.
7. **Jendela pengiriman email** — idempotensi agar tidak mengirim ganda.

## 7. Kriteria Kinerja

| Metrik | Target | Cara ukur |
|---|---|---|
| LCP | ≤ 2,5 s pada 4G | Lighthouse |
| Interaksi ke cat berikutnya | ≤ 200 ms | Lighthouse |
| Ukuran JS terkirim | ≤ 200 KB gzip | Analisis bundel |
| Waktu render rute | ≤ 100 ms | Penanda kinerja |
| API baca p95 | ≤ 300 ms | APM |
| API tulis p95 | ≤ 800 ms | APM |

Purwarupa hari ini: ± 584 KB tanpa kompresi, ± 130 KB setelah gzip, tanpa permintaan
pihak ketiga. Produksi harus tetap di bawah ambang di atas setelah framework ditambahkan.

## 8. Data Uji

| Prinsip | Ketentuan |
|---|---|
| Tanpa data nyata | Lingkungan uji **tidak boleh** memuat data pegawai sungguhan |
| Deterministik | Tanggal dihasilkan relatif terhadap hari ini agar tidak kedaluwarsa |
| Mencakup kasus batas | Kalibrasi terlambat, alat rusak, tagihan jatuh tempo, checklist bertemuan |
| Dapat diulang | Uji mengembalikan keadaan (mis. `DASH.reset`) agar tidak saling memengaruhi |

## 9. Gerbang Rilis

Rilis **tidak boleh** dilanjutkan bila salah satu belum terpenuhi.

**Setiap perubahan (pull request)**
- [ ] `npm test` lolos seluruhnya — 0 gagal
- [ ] Tidak ada galat konsol pada rute yang tersentuh
- [ ] Tidak ada gulir mendatar pada 390 px
- [ ] Mode gelap diperiksa untuk komponen baru
- [ ] Uji ditambahkan untuk perilaku baru

**Sebelum deployment ke staging**
- [ ] Seluruh suite lolos pada lingkungan staging (`FLMS_BASE`)
- [ ] Uji lintas peramban: Chrome, Firefox, Safari, Edge
- [ ] Pemeriksaan aksesibilitas otomatis tanpa pelanggaran serius
- [ ] Anggaran kinerja terpenuhi

**Sebelum deployment ke produksi**
- [ ] Uji penerimaan pengguna disetujui pemilik produk
- [ ] Daftar periksa keamanan [SECURITY.md §12](SECURITY.md) tertutup
- [ ] Barcode diuji dengan **pemindai fisik** milik klien
- [ ] Email uji diterima di kotak surat nyata, tidak masuk spam
- [ ] Pemulihan cadangan pernah diuji
- [ ] Rencana rollback tertulis dan disepakati

## 10. Uji Manual yang Tetap Diperlukan

Otomasi tidak menggantikan hal berikut:

| Uji | Cara | Frekuensi |
|---|---|---|
| Pemindaian label fisik | Cetak pada stiker sungguhan, pindai dengan alat klien dari jarak 10–30 cm | Sebelum cetak massal |
| Keterbacaan di lapangan | Baca label di laboratorium dengan pencahayaan sebenarnya | Sekali per desain label |
| Alur di ponsel | Kerjakan checklist sambil berdiri di depan alat | Tiap rilis |
| Email di berbagai klien | Buka di Outlook, Gmail, Apple Mail | Tiap perubahan template |
| Cetak laporan | Cetak ke kertas A4 sungguhan | Tiap perubahan tata letak cetak |
| Pembaca layar | Telusuri alur booking dengan NVDA/VoiceOver | Sebelum go-live |

## 11. Menambah Uji Baru

```js
// tests/nama-suite.js
const { launch } = require('./browser');
const { BASE, SHOT } = require('./config');

let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 980 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.click('button[type=submit]');
  await page.waitForTimeout(700);

  // … asersi …

  ok(errs.length === 0, 'Tanpa galat konsol', errs.join(' | '));
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
```

Daftarkan suite baru pada larik `SUITES` di `tests/run-all.js`.

**Yang membuat uji bernilai:** menguji dari sudut pandang pengguna, memeriksa akibat
(data berubah, tampilan berubah) bukan hanya "tidak error", dan menyertakan nilai
sebenarnya pada pesan kegagalan agar penyebabnya langsung terlihat.
