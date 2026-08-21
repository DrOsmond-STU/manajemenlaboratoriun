<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Surel pengingat satu jadwal.
 *
 * Isinya sengaja ringkas dan menyebut TINDAKAN yang diharapkan, bukan sekadar
 * memberitahukan keberadaan jadwal. Pengingat yang tidak menyebut apa yang
 * harus dilakukan akan dibaca sekilas lalu dilupakan.
 */
class PengingatJadwal extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  array<string,string>  $rincian
     */
    public function __construct(
        public string $namaPenerima,
        public string $kategori,
        public string $judul,
        public string $tanggal,
        public string $tindakan,
        public array $rincian = [],
        public ?string $sisaWaktu = null,
    ) {}

    public function envelope(): Envelope
    {
        $awalan = $this->sisaWaktu === 'terlambat' ? '[TERLAMBAT] ' : '';

        return new Envelope(subject: $awalan.$this->judul);
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.pengingat-jadwal');
    }
}
