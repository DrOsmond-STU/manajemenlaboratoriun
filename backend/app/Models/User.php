<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\Concerns\Diaudit;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'password', 'unit_kerja', 'aktif'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use Diaudit, HasApiTokens, HasFactory, HasRoles, Notifiable;

    /**
     * Kolom pengguna yang berdampak pada akses atau identitas.
     *
     * `unit_kerja` ikut diaudit meski terdengar administratif: ia menentukan
     * cakupan data yang terlihat pengguna (lihat CakupanData), sehingga
     * mengubahnya adalah perubahan hak akses dengan nama lain. `aktif` juga
     * ikut — menonaktifkan pengguna adalah pencabutan akses dengan nama lain.
     *
     * `password` sengaja ADA di daftar ini supaya peristiwanya tercatat,
     * tetapi nilainya disamarkan trait — pemeriksa perlu tahu kapan sandi
     * berganti, bukan apa isinya.
     *
     * @return list<string>
     */
    public function kolomDiaudit(): array
    {
        return ['name', 'email', 'unit_kerja', 'aktif', 'password', 'email_verified_at'];
    }

    public function labelAudit(): ?string
    {
        return $this->name;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'aktif' => 'boolean',
        ];
    }

    /** Penugasan gedung; kosong berarti tidak dibatasi — lihat CakupanData. */
    public function gedung(): HasMany
    {
        return $this->hasMany(UserGedung::class);
    }

    /**
     * Nama gedung yang diampu.
     *
     * @return Collection<int, string>
     */
    public function gedungDiampu(): Collection
    {
        return $this->relationLoaded('gedung')
            ? $this->gedung->pluck('gedung')
            : $this->gedung()->pluck('gedung');
    }
}
