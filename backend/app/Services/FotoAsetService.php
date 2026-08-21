<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetPhoto;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FotoAsetService
{
    public const MAKS_PER_ASET = 8;

    /** @var list<string> */
    public const MIME_DIIZINKAN = ['image/jpeg', 'image/png', 'image/webp'];

    private const EKSTENSI = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public function simpan(Asset $aset, UploadedFile $berkas, ?User $pengunggah, ?string $keterangan = null): AssetPhoto
    {
        // Jenis berkas ditentukan dari ISINYA, bukan dari ekstensi maupun
        // header Content-Type kiriman. Keduanya sepenuhnya dikendalikan
        // pengirim: berkas PHP bernama "alat.jpg" dengan Content-Type
        // "image/jpeg" akan lolos pemeriksaan yang percaya keduanya.
        $mime = $berkas->getMimeType();

        if (! in_array($mime, self::MIME_DIIZINKAN, true)) {
            throw ValidationException::withMessages([
                'foto' => 'Berkas harus berupa gambar JPEG, PNG, atau WebP.',
            ]);
        }

        // Dan dibaca sekali lagi sebagai gambar sungguhan. Berkas yang
        // memiliki header gambar sah di depan tetapi berisi muatan lain di
        // belakangnya tetap dikenali `getMimeType()` sebagai gambar.
        if (@getimagesize($berkas->getRealPath()) === false) {
            throw ValidationException::withMessages([
                'foto' => 'Berkas tidak dapat dibaca sebagai gambar.',
            ]);
        }

        if ($aset->photos()->count() >= self::MAKS_PER_ASET) {
            throw ValidationException::withMessages([
                'foto' => 'Satu aset paling banyak memuat '.self::MAKS_PER_ASET.' foto. '
                    .'Hapus salah satu lebih dulu.',
            ]);
        }

        // Nama berkas dibangkitkan, TIDAK PERNAH memakai nama kiriman.
        // Nama kiriman dapat memuat "../" untuk keluar dari direktori, dapat
        // memuat titik ganda yang membuat server salah menebak jenisnya, dan
        // dapat sengaja dibuat sama dengan berkas milik orang lain.
        $nama = Str::uuid()->toString().'.'.(self::EKSTENSI[$mime] ?? 'bin');
        $jalur = 'aset/'.$aset->id.'/'.$nama;

        Storage::disk('local')->putFileAs('aset/'.$aset->id, $berkas, $nama);

        return DB::transaction(function () use ($aset, $jalur, $berkas, $mime, $pengunggah, $keterangan) {
            // Foto pertama otomatis menjadi utama. Aset tanpa foto utama akan
            // tampil tanpa gambar di daftar meski fotonya ada — dan tidak ada
            // yang menyangka penyebabnya adalah penanda yang belum diisi.
            $pertama = $aset->photos()->count() === 0;

            return $aset->photos()->create([
                'jalur' => $jalur,
                'nama_asli' => mb_substr($berkas->getClientOriginalName() ?? '', 0, 255) ?: null,
                'mime' => $mime,
                'ukuran' => $berkas->getSize(),
                'utama' => $pertama,
                'urutan' => (int) $aset->photos()->max('urutan') + 1,
                'keterangan' => $keterangan,
                'diunggah_oleh' => $pengunggah?->id,
            ]);
        });
    }

    /** Menjadikan satu foto sebagai foto utama, menurunkan yang lama. */
    public function jadikanUtama(AssetPhoto $foto): void
    {
        DB::transaction(function () use ($foto) {
            // Yang lama diturunkan LEBIH DAHULU: indeks unik parsial menolak
            // dua foto utama, sehingga urutan terbalik akan gagal.
            AssetPhoto::query()
                ->where('asset_id', $foto->asset_id)
                ->whereKeyNot($foto->id)
                ->update(['utama' => false]);

            $foto->update(['utama' => true]);
        });
    }

    public function hapus(AssetPhoto $foto): void
    {
        DB::transaction(function () use ($foto) {
            $adalahUtama = $foto->utama;
            $asetId = $foto->asset_id;

            $foto->delete();

            // Bila yang dihapus adalah foto utama, penggantinya ditetapkan
            // segera. Membiarkan aset punya foto tetapi tanpa foto utama
            // membuatnya tampil tanpa gambar tanpa sebab yang terlihat.
            if ($adalahUtama) {
                $pengganti = AssetPhoto::query()
                    ->where('asset_id', $asetId)->orderBy('urutan')->first();

                $pengganti?->update(['utama' => true]);
            }
        });

        // Berkas dihapus SETELAH transaksi berhasil. Menghapusnya lebih dahulu
        // berarti transaksi yang gagal meninggalkan baris yang menunjuk berkas
        // yang sudah tidak ada — dan itu tidak dapat diperbaiki.
        Storage::disk('local')->delete($foto->jalur);
    }
}
