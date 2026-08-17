# Berkas Contoh — Bukan Data Resmi

⚠ **Isi berkas di folder ini bukan master kode barang BMN.** Ini hanya
contoh bentuk berkas, supaya Anda tahu persis apa yang perlu disiapkan.

## `template-kode-barang.csv`

Kerangka kosong untuk diisi. Uraiannya sengaja ditulis
`GANTI DENGAN URAIAN RESMI` agar tidak ada yang salah kira bahwa berkas ini
sudah siap pakai — bila terlanjur diimpor apa adanya, kesalahannya langsung
terlihat di layar, bukan tersembunyi di dalam basis data.

| Kolom | Wajib | Keterangan |
|---|---|---|
| `kode` | ya | 10 digit, boleh ditulis `3.08.01.03.001` atau `3080103001` |
| `uraian` | ya | nama barang menurut dokumen resmi |
| `masa_manfaat` | tidak | dalam tahun; kosongkan bila belum tahu |

Urutan kolom bebas, dan nama kolom boleh memakai judul dari berkas aslinya
(`Kode Barang`, `Uraian Barang`, `kd_brg`) — perintah impor mengenalinya
sendiri. Pemisah boleh koma atau titik koma.

## Anda Tidak Perlu Memakai Template Ini

Template ini hanya untuk keadaan darurat, ketika Anda harus mengetik ulang
daftarnya secara manual. Dua jalur berikut jauh lebih baik karena datanya
tidak melewati tangan manusia sama sekali:

1. **Ekspor SAKTI** dari Operator BMN satuan kerja Anda — hasilnya langsung
   dapat diimpor apa adanya, dan masa manfaatnya ikut.
2. **Lampiran PMK berbentuk PDF** — dapat diimpor langsung tanpa diubah ke CSV.

Keduanya dijelaskan di [IMPOR-BMN.md](../IMPOR-BMN.md).

## Cara Memakainya

Selalu uji coba dulu; tidak ada yang ditulis ke basis data:

```bash
php artisan bmn:impor-kode-barang berkas-anda.csv --uji-coba
```

Periksa angka pada tabel ringkasannya. Bila kolom "Dilewati" banyak, berkasnya
yang perlu diperbaiki — jangan dipaksa masuk.
