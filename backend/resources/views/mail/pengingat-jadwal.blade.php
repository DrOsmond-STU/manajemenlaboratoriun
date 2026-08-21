<x-mail::message>
# {{ $judul }}

Halo {{ $namaPenerima }},

@if ($sisaWaktu === 'terlambat')
Jadwal berikut **sudah lewat** dan belum diselesaikan.
@elseif ($sisaWaktu === 'hari-ini')
Jadwal berikut jatuh **hari ini**.
@else
Jadwal berikut akan jatuh tempo pada **{{ $tanggal }}**.
@endif

<x-mail::panel>
**{{ $kategori }}** — {{ $tanggal }}

@foreach ($rincian as $label => $nilai)
- **{{ $label }}:** {{ $nilai }}
@endforeach
</x-mail::panel>

**Yang perlu dilakukan:** {{ $tindakan }}

<x-mail::button :url="config('app.url')">
Buka FLMS
</x-mail::button>

Surel ini dikirim otomatis kepada penanggung jawab jadwal.
Bila Anda merasa bukan penanggung jawabnya, hubungi pengelola sistem.

Terima kasih,<br>
{{ config('app.name') }}
</x-mail::message>
