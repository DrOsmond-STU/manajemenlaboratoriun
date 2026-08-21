<?php

namespace App\Http\Resources;

use App\Models\Dashboard;
use App\Models\DashboardWidget;
use App\Services\DataWidget;
use App\Support\RegistriWidget;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Dashboard */
class DashboardResource extends JsonResource
{
    /**
     * @param  bool  $denganData  ikut menghitung isi tiap widget.
     *                            Sengaja mati secara bawaan: daftar dashboard
     *                            memuat puluhan widget, dan menghitung semuanya
     *                            hanya untuk menampilkan namanya berarti
     *                            puluhan kueri agregat yang hasilnya dibuang.
     */
    public function __construct($resource, private readonly bool $denganData = false)
    {
        parent::__construct($resource);
    }

    /**
     * @return array<string,mixed>
     */
    public function toArray(Request $request): array
    {
        $pengguna = $request->user();
        $data = $this->denganData ? app(DataWidget::class) : null;

        return [
            'id' => $this->id,
            'nama' => $this->nama,
            'jenis' => [
                'kode' => $this->jenis,
                'nama' => Dashboard::JENIS[$this->jenis] ?? $this->jenis,
            ],
            'utama' => $this->utama,
            'bersama' => $this->bersama(),
            // Dashboard bersama tidak boleh disunting pemakai biasa; antarmuka
            // perlu tahu itu supaya tombolnya tidak muncul lalu ditolak.
            'dapat_disunting' => $this->user_id !== null && $this->user_id === $pengguna?->id,
            'widgets' => $this->widgets->map(fn (DashboardWidget $w) => [
                'id' => $w->id,
                'widget' => $w->widget,
                'judul' => $w->judulTampil(),
                'bentuk' => $w->bentukTampil(),
                'satuan' => RegistriWidget::keterangan($w->widget)['satuan'] ?? null,
                'opsi' => $w->opsi,
                'kisi' => [
                    'kolom' => $w->kolom, 'baris' => $w->baris,
                    'lebar' => $w->lebar, 'tinggi' => $w->tinggi,
                ],
                'data' => $data && $pengguna ? $data->untuk($w, $pengguna) : null,
            ])->all(),
        ];
    }
}
