<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\MatriksAkses;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * Membuat pengguna beserta perannya.
 *
 * Diperlukan karena tidak ada jalur lain: tanpa satu pun pengguna, seluruh
 * API menolak semua orang dan sistem terkunci dari dirinya sendiri.
 *
 * Sandi TIDAK diterima sebagai argumen baris perintah. Argumen tercatat di
 * riwayat shell dan terlihat pada daftar proses, sehingga sandi yang diketik
 * di sana bocor ke tempat yang tidak diduga. Bila tidak diketik interaktif,
 * perintah ini membangkitkan sandi acak dan menampilkannya sekali.
 */
class BuatPengguna extends Command
{
    protected $signature = 'flms:buat-pengguna
        {email : Alamat surel}
        {--nama= : Nama lengkap}
        {--peran=* : Peran yang diberikan (boleh lebih dari satu)}
        {--sandi-acak : Bangkitkan sandi acak alih-alih menanyakannya}';

    protected $description = 'Membuat pengguna baru beserta perannya';

    public function handle(): int
    {
        $email = (string) $this->argument('email');
        $nama = (string) ($this->option('nama') ?: Str::before($email, '@'));
        $peran = (array) $this->option('peran');

        if ($peran === []) {
            $this->error('Peran wajib diisi. Contoh: --peran=super-admin');
            $this->line('Peran tersedia: '.implode(', ', array_keys(MatriksAkses::NAMA_PERAN)));

            return self::FAILURE;
        }

        $tidakDikenal = array_diff($peran, array_keys(MatriksAkses::NAMA_PERAN));

        if ($tidakDikenal !== []) {
            $this->error('Peran tidak dikenal: '.implode(', ', $tidakDikenal));
            $this->line('Peran tersedia: '.implode(', ', array_keys(MatriksAkses::NAMA_PERAN)));

            return self::FAILURE;
        }

        if (User::where('email', $email)->exists()) {
            $this->error("Pengguna dengan surel {$email} sudah ada.");

            return self::FAILURE;
        }

        $acak = (bool) $this->option('sandi-acak');
        $sandi = $acak ? Str::password(20) : (string) $this->secret('Kata sandi');

        if (! $acak) {
            $konfirmasi = (string) $this->secret('Ulangi kata sandi');

            if ($sandi !== $konfirmasi) {
                $this->error('Konfirmasi kata sandi tidak cocok.');

                return self::FAILURE;
            }
        }

        $validator = Validator::make(
            ['email' => $email, 'password' => $sandi],
            ['email' => ['required', 'email', 'max:255'], 'password' => ['required', Password::defaults()]],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $pesan) {
                $this->error($pesan);
            }

            return self::FAILURE;
        }

        $pengguna = User::create([
            'name' => $nama,
            'email' => $email,
            'password' => Hash::make($sandi),
        ]);

        $pengguna->syncRoles($peran);

        $this->info("Pengguna dibuat: {$pengguna->email}");
        $this->table(
            ['Nama', 'Surel', 'Peran'],
            [[$pengguna->name, $pengguna->email, implode(', ', $peran)]],
        );

        if ($acak) {
            $this->newLine();
            $this->warn('Sandi acak — hanya ditampilkan sekali ini:');
            $this->line("    {$sandi}");
            $this->newLine();
            $this->line('Salin sekarang, lalu minta penggunanya segera menggantinya.');
        }

        return self::SUCCESS;
    }
}
