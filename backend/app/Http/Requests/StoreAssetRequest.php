<?php

namespace App\Http\Requests;

use App\Models\Asset;
use App\Models\BmnKodeBarang;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Pendataan aset mengacu kebutuhan data BMN (PMK 181/PMK.06/2016).
 *
 * Perhatikan yang TIDAK ada di sini: `nup`, `kode_lokasi`, dan `bmn_id`.
 * Ketiganya dibentuk sistem, bukan diterima dari permintaan — bila boleh
 * dikirim pemanggil, identitas BMN dapat dikarang dari luar.
 */
class StoreAssetRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'kode_barang' => ['required', 'string', 'regex:'.BmnKodeBarang::POLA_KODE, 'exists:bmn_kode_barang,kode'],

            // Boleh dikosongkan; sistem akan membentuknya dari pola satuan kerja.
            'kode_internal' => ['nullable', 'string', 'max:64', 'unique:assets,kode_internal'],

            'nama' => ['required', 'string', 'max:200'],
            'merk' => ['nullable', 'string', 'max:100'],
            'tipe' => ['nullable', 'string', 'max:100'],
            'serial_number' => ['nullable', 'string', 'max:100'],
            'spesifikasi' => ['nullable', 'string', 'max:5000'],

            // Teks, bukan angka: yang ditulis petugas berbentuk rentang
            // bersatuan — "0,1–500 mg/L", "±0,0001 g". Memaksanya menjadi
            // angka membuang satuan dan batas bawahnya, yaitu justru bagian
            // yang menentukan apakah alat itu cocok untuk sebuah pengujian.
            'kapasitas_ukur' => ['nullable', 'string', 'max:120'],

            'kelengkapan' => ['nullable', 'array', 'max:30'],
            'kelengkapan.*' => ['string', 'max:100'],

            'cara_perolehan' => ['nullable', 'string', 'max:100'],
            'tgl_perolehan' => ['required', 'date', 'before_or_equal:today'],
            'sumber_dana' => ['nullable', 'string', 'max:100'],
            'no_bukti' => ['nullable', 'string', 'max:100'],
            'no_kontrak' => ['nullable', 'string', 'max:100'],
            'pemasok' => ['nullable', 'string', 'max:150'],
            'garansi_berakhir' => ['nullable', 'date'],
            'kuantitas' => ['nullable', 'integer', 'min:1', 'max:1000000'],
            'satuan' => ['nullable', 'string', 'max:32'],

            // Rupiah penuh tanpa desimal. Batas atas menahan salah ketik nol
            // beruntun, bukan membatasi nilai barang yang wajar.
            'nilai_perolehan' => ['required', 'integer', 'min:0', 'max:999999999999999'],
            'masa_manfaat' => ['nullable', 'integer', 'min:0', 'max:100'],

            'kondisi' => ['nullable', Rule::in(array_keys(Asset::KONDISI))],
            'status_penggunaan' => ['nullable', 'string', 'max:150'],
            'no_psp' => ['nullable', 'string', 'max:100'],
            'tgl_psp' => ['nullable', 'date'],

            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'penanggung_jawab_id' => ['nullable', 'integer', 'exists:users,id'],
            'keterangan' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'kode_barang.regex' => 'Kode barang harus berpola X.XX.XX.XX.XXX, contoh 3.08.01.03.001.',
            'kode_barang.exists' => 'Kode barang tidak ada pada master BMN. Periksa kembali atau impor master terlebih dahulu.',
            'tgl_perolehan.before_or_equal' => 'Tanggal perolehan tidak boleh di masa depan.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'kode_barang' => 'kode barang BMN',
            'kode_internal' => 'kode internal',
            'tgl_perolehan' => 'tanggal perolehan',
            'nilai_perolehan' => 'nilai perolehan',
            'masa_manfaat' => 'masa manfaat',
            'room_id' => 'ruangan',
            'penanggung_jawab_id' => 'penanggung jawab',
        ];
    }
}
