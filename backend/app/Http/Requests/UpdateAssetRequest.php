<?php

namespace App\Http\Requests;

use App\Models\Asset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Perubahan data aset.
 *
 * Yang TIDAK ada di sini, dan tidak akan pernah ada: `kode_barang`, `nup`, dan
 * `kode_lokasi`. Ketiganya membentuk identitas BMN yang sudah beredar pada
 * label dan dokumen, dan pemicu basis data menolak perubahannya. Menyediakan
 * aturan validasi untuknya hanya akan memberi kesan bahwa nilainya boleh
 * dikirim, lalu berujung galat basis data di ujung.
 */
class UpdateAssetRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $id = $this->route('asset')?->id;

        return [
            'kode_internal' => ['sometimes', 'string', 'max:64', Rule::unique('assets', 'kode_internal')->ignore($id)],

            'nama' => ['sometimes', 'string', 'max:200'],
            'merk' => ['nullable', 'string', 'max:100'],
            'tipe' => ['nullable', 'string', 'max:100'],
            'serial_number' => ['nullable', 'string', 'max:100'],
            'spesifikasi' => ['nullable', 'string', 'max:5000'],

            'cara_perolehan' => ['sometimes', 'string', 'max:100'],
            'tgl_perolehan' => ['sometimes', 'date', 'before_or_equal:today'],
            'sumber_dana' => ['nullable', 'string', 'max:100'],
            'no_bukti' => ['nullable', 'string', 'max:100'],
            'no_kontrak' => ['nullable', 'string', 'max:100'],
            'kuantitas' => ['sometimes', 'integer', 'min:1', 'max:1000000'],
            'satuan' => ['sometimes', 'string', 'max:32'],

            'nilai_perolehan' => ['sometimes', 'integer', 'min:0', 'max:999999999999999'],
            'masa_manfaat' => ['sometimes', 'integer', 'min:0', 'max:100'],

            'kondisi' => ['sometimes', Rule::in(array_keys(Asset::KONDISI))],
            'status_penggunaan' => ['sometimes', 'string', 'max:150'],
            'no_psp' => ['nullable', 'string', 'max:100'],
            'tgl_psp' => ['nullable', 'date'],

            'room_id' => ['nullable', 'integer', 'exists:rooms,id'],
            'penanggung_jawab_id' => ['nullable', 'integer', 'exists:users,id'],
            'keterangan' => ['nullable', 'string', 'max:2000'],

            // Alasan perubahan, ikut tercatat pada riwayat.
            'catatan_perubahan' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'kode_internal' => 'kode internal',
            'tgl_perolehan' => 'tanggal perolehan',
            'nilai_perolehan' => 'nilai perolehan',
            'masa_manfaat' => 'masa manfaat',
            'room_id' => 'ruangan',
            'penanggung_jawab_id' => 'penanggung jawab',
        ];
    }
}
