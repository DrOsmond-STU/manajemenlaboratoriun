# Memperoleh dan Mengimpor Master Kode Barang BMN

## FLMS · Facility, Laboratory & Meeting Management System

Modul aset bertumpu sepenuhnya pada master kode barang. Selama master resmi
belum masuk, sistem hanya berisi **18 kode contoh** yang **belum diverifikasi**
terhadap dokumen resmi mana pun — cukup untuk pengembangan, tidak boleh untuk
data nyata.

Dokumen ini menjelaskan dari mana master resminya diperoleh dan bagaimana
memasukkannya.

---

## 1. Mengapa Tidak Boleh Dikarang

Kode barang menentukan tiga hal sekaligus:

1. **Identitas BMN** setiap barang — `<kode lokasi>.<kode barang>.<NUP>`
2. **Masa manfaat**, yang menentukan seluruh perhitungan penyusutan
3. **Pengelompokan pada laporan** yang direkonsiliasi dengan SIMAK-BMN

Kode yang salah tidak menimbulkan galat apa pun. Sistem tetap berjalan, barcode
tetap tercetak, laporan tetap terbit — dan baru ketahuan saat rekonsiliasi
dengan SIMAK-BMN, ketika ribuan barang telanjur memakai identitas yang keliru.
Itulah sebabnya perintah impor menolak kode yang tidak berpola 10 digit alih-alih
menambalnya.

---

## 2. Dari Mana Memperoleh Masternya

Urut dari yang paling praktis:

### 2.1 Ekspor dari SAKTI / SIMAK-BMN satuan kerja Anda — **cara yang disarankan**

Ini jalur terbaik, karena yang Anda dapatkan adalah master yang **sedang
dipakai** satuan kerja Anda, bukan salinan yang mungkin sudah tertinggal versi.

Mintalah kepada **Operator BMN / Petugas SIMAK-BMN** satuan kerja Anda:

> "Tolong ekspor tabel referensi kode barang dari SAKTI ke Excel/CSV — kolom
> kode barang, uraian barang, dan masa manfaat."

Umumnya tersedia lewat menu referensi/tabel barang pada aplikasi SAKTI, atau
melalui admin SIMAN di tingkat eselon I. Bila hanya perlu lingkup laboratorium,
cukup minta **golongan 3 (Peralatan dan Mesin)** — atau bahkan hanya **bidang
3.08 (Alat Laboratorium)** ditambah bidang penunjang yang Anda pakai.

### 2.2 Lampiran peraturan resmi

Dasar hukumnya **PMK 29/PMK.06/2010** tentang Penggolongan dan Kodefikasi Barang
Milik Negara, yang menggantikan PMK 97/PMK.06/2007. Lampirannya memuat daftar
kode lengkap. Tersedia di:

| Sumber | Alamat |
|---|---|
| JDIH Kementerian Keuangan | <https://jdih.kemenkeu.go.id/dok/29-pmk-06-2010> |
| Peraturan BPK RI | <https://peraturan.bpk.go.id/Details/117498/pmk-no-29pmk062010> |
| Peraturan.go.id | <https://www.peraturan.go.id/id/permenkeu-no-29-pmk-06-2010-tahun-2010> |

> **Periksa lebih dulu apakah masih berlaku.** PMK 29/2010 sudah beberapa kali
> mengalami perubahan lampiran. Halaman JDIH mencantumkan status peraturan
> (berlaku / diubah / dicabut) beserta peraturan penggantinya. Pastikan Anda
> memakai lampiran versi terakhir — jangan langsung memakai PDF pertama yang
> ditemukan mesin pencari.

Lampiran berbentuk PDF, sehingga perlu diubah ke CSV lebih dulu. Bila ditabelkan
rapi, `tabula`, `camelot`, atau fitur "Get Data from PDF" di Excel biasanya cukup.
**Periksa hasil konversinya** — pemisah ribuan dan kolom yang bergeser adalah
sumber kesalahan paling umum di tahap ini.

### 2.3 Yang sebaiknya dihindari

Salinan tidak resmi di situs berbagi dokumen. Umumnya berupa lampiran lama, tidak
bertanggal, dan tidak dapat ditelusuri versinya.

---

## 3. Bentuk Berkas yang Diterima

CSV dengan minimal dua kolom: **kode barang** dan **uraian barang**. Kolom masa
manfaat bersifat opsional tetapi sangat dianjurkan — tanpa itu, penyusutan
harus diisi per barang.

```csv
kode,uraian,masa_manfaat
3.08.01.03.001,Chromatography Set,8
3.08.01.08.003,Autoclave,8
```

Perintah impor sengaja dibuat permisif terhadap bentuk berkas, karena berkas
referensi datang dari banyak sumber. Yang ditangani sendiri tanpa perlu Anda
sunting:

| Kenyataan di lapangan | Perlakuan |
|---|---|
| Judul kolom `Kode Barang`, `Uraian Barang`, `Nama Barang`, `kd_brg` | dikenali otomatis |
| Pemisah `;` (lazim pada Excel berbahasa Indonesia), tab, atau `\|` | dideteksi sendiri |
| BOM UTF-8 dari Excel | dibuang |
| Kode ditulis `3080103001` atau `3 08 01 03 001` | dirapikan ke `3.08.01.03.001` |
| Kode muncul dua kali | yang terakhir dipakai, dilaporkan |

Yang **tidak** ditangani otomatis, dan memang disengaja:

| Keadaan | Perlakuan |
|---|---|
| Kode kurang/lebih dari 10 digit | **dilewati** dan dilaporkan nomor barisnya |
| Uraian kosong | **dilewati** dan dilaporkan |

Menebak digit yang hilang sama saja dengan mengarang kode barang, jadi barisnya
dilewati agar Anda memperbaikinya di sumber.

---

## 4. Cara Mengimpor

Selalu jalankan uji coba lebih dulu — tidak ada yang ditulis, tetapi seluruh
laporan tetap keluar:

```bash
php artisan bmn:impor-kode-barang referensi.csv --uji-coba
```

Keluarannya:

```
Pemisah kolom: ;

Baris yang dilewati:
  · baris 47: kode tidak berpola 10 digit — "3.08.01"
  · baris 112: uraian barang kosong untuk kode 3.08.01.03.009

+--------+------+------------+---------------+----------+
| Dibaca | Baru | Diperbarui | Tidak berubah | Dilewati |
+--------+------+------------+---------------+----------+
| 1.284  | 1266 | 16         | 0             | 2        |
+--------+------+------------+---------------+----------+
```

Periksa angkanya. Bila "Dilewati" banyak, berkasnya yang perlu diperbaiki,
bukan perintahnya yang perlu dipaksa. Setelah puas:

```bash
php artisan bmn:impor-kode-barang referensi.csv
```

Impor bersifat **memperbarui, bukan menggandakan** — aman dijalankan berulang
saat master diperbarui.

### Bila judul kolom tidak dikenali

Perintah akan menampilkan judul kolom yang terbaca beserta cara menentukannya
sendiri:

```bash
php artisan bmn:impor-kode-barang referensi.csv \
  --kolom-kode="Kode Barang" --kolom-uraian="Uraian Barang"

# atau dengan nomor kolom, mulai dari 1
php artisan bmn:impor-kode-barang referensi.csv --kolom-kode=2 --kolom-uraian=3
```

---

## 5. Setelah Mengimpor Data Aset Lama

Impor massal aset menulis baris `assets` langsung tanpa melewati pemberi nomor,
sehingga pencatat NUP tertinggal di nol sementara NUP 1–41 sudah terpakai. Bila
dibiarkan, pendaftaran barang berikutnya akan mengklaim NUP 1 dan ditolak indeks
unik — dengan galat yang tidak jelas asal-usulnya bagi pengguna.

```bash
php artisan bmn:selaraskan-nup --uji-coba   # lihat dulu apa yang akan berubah
php artisan bmn:selaraskan-nup
```

Aman dijalankan berulang; bila sudah selaras, perintahnya tidak mengubah apa pun.

---

## 6. Daftar Periksa Sebelum Data Nyata Masuk

- [ ] Master kode barang resmi terimpor, jumlahnya wajar (ribuan, bukan belasan)
- [ ] Status peraturan sumber sudah diperiksa — memakai lampiran versi terakhir
- [ ] Baris yang dilewati saat impor sudah ditelusuri, bukan diabaikan
- [ ] Masa manfaat terisi untuk kode yang akan dipakai — cek: `BmnKodeBarang::where('masa_manfaat', 0)->count()`
- [ ] Identitas satuan kerja di `.env` sudah diganti dari nilai contoh
      (`BMN_BAGIAN_ANGGARAN`, `BMN_ESELON1`, `BMN_WILAYAH`, `BMN_SATKER`)
- [ ] Kode lokasi yang terbentuk sudah dicocokkan dengan dokumen BMN satuan kerja
- [ ] `php artisan bmn:selaraskan-nup` sudah dijalankan bila ada impor aset lama
- [ ] Periode penyusutan sudah dipastikan ke bagian akuntansi — lihat
      [BACKEND.md §8.1](BACKEND.md)

---

## 7. Kode Contoh yang Sekarang Terpasang

`database/seeders/BmnKodeBarangSeeder.php` memuat 18 kode dengan penanda tegas
bahwa isinya contoh. Dari seluruh isinya, yang sempat terkonfirmasi lewat sumber
publik hanyalah bahwa **`3.08.01` bernama "Unit Alat Laboratorium"**; uraian dan
masa manfaat pada tingkat sub-sub kelompok **belum diverifikasi**.

Setelah master resmi diimpor, kode contoh yang kodenya sama akan **ditimpa**
oleh data resmi. Kode contoh yang tidak ada di master resmi akan tetap tinggal —
bersihkan bila mengganggu:

```php
// hanya bila yakin belum ada aset yang memakainya
BmnKodeBarang::doesntHave('assets')->whereNotIn('kode', $kodeResmi)->delete();
```

---

*Dokumen ini bagian dari [dokumentasi FLMS](README.md).*
