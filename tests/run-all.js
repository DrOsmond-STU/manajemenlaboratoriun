#!/usr/bin/env node
/* Menjalankan seluruh suite uji secara berurutan dan meringkas hasilnya. */
const { spawnSync, spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { BASE } = require('./config');

const SUITES = [
  ['bctest',   'Encoder barcode — Code 128 & QR diverifikasi dengan decoder independen'],
  ['smoke',    'Asap seluruh rute — render, drawer/modal, wizard, AI'],
  ['overflow', 'Responsif 390 px — bebas horizontal overflow'],
  ['bmntest',  'Fitur BMN — register, kode barang, foto, studio label'],
  ['tplcheck', 'Template label internal muat tanpa terpotong'],
  ['bmnlbl',   'Label BMN rapi dan terbaca di semua ukuran'],
  ['feattest', 'Dashboard, BSC, checklist, notifikasi email'],
  ['masuk',    'Gerbang masuk, mode data contoh, penghubung API'],
  ['ruangan',  'Ruangan & Laboratorium tersambung: baca, simpan, tapis, bertahan'],
  ['dashboard', 'Dashboard & Balanced Scorecard tersambung: widget sungguhan, bobot ditegakkan server'],
  ['pemeliharaan', 'Pemeliharaan & Kalibrasi tersambung: satu tabel dua layar, kalibrasi hanya untuk alat'],
  ['penyewaan', 'Penyewaan & Tagihan tersambung: tarif, penawaran, invoice, verifikasi pembayaran'],
  ['audit', 'Audit Trail tersambung: entri, tapisan peristiwa, detail perubahan kolom'],
  ['pengguna', 'Manajemen Pengguna & Peran tersambung: hanya super-admin, matriks sungguhan'],
  ['kalender', 'Kalender Terpadu tersambung: rentang tanggal per bulan, tiga sumber digabung'],
  ['aset', 'Asset Register & Asset Movement tersambung: pemasok/garansi, mutasi ruangan, feed lintas aset'],
  ['laporanaset', 'Laporan Aset tersambung: ringkasan agregat server, komposisi per kode barang BMN'],
  ['labelstudio', 'Studio Label & Barcode tersambung: mencetak label aset sungguhan, bukan contoh purwarupa'],
  ['laporanruangan', 'Laporan Ruangan tersambung: angka DataWidget yang sama dengan Dashboard, rekap per ruangan'],
  ['laporanalat', 'Laporan Alat tersambung: kepatuhan kalibrasi (widget baru), alat paling sering dipinjam']
];

/** Menunggu server statis siap menerima permintaan. */
function tungguServer(url, batasMs) {
  const habis = Date.now() + batasMs;
  return new Promise((resolve, reject) => {
    const coba = () => {
      http.get(url, (r) => { r.resume(); resolve(); })
        .on('error', () => {
          if (Date.now() > habis) reject(new Error('Server tidak kunjung siap: ' + url));
          else setTimeout(coba, 250);
        });
    };
    coba();
  });
}

(async () => {
  const only = process.argv[2];
  let server = null;

  // Jalankan server statis sendiri bila belum ada yang melayani BASE.
  try {
    await tungguServer(BASE + '/app.html', 800);
    console.log(`Memakai server yang sudah berjalan di ${BASE}`);
  } catch (e) {
    const port = new URL(BASE).port || 80;
    const bin = path.join(__dirname, '..', 'node_modules', '.bin', 'http-server');
    server = spawn(bin, ['-p', String(port), '-c-1', '--silent', path.join(__dirname, '..')],
      { stdio: 'ignore' });
    try {
      await tungguServer(BASE + '/app.html', 15000);
      console.log(`Server statis dijalankan pada ${BASE}`);
    } catch (err) {
      console.error('Gagal menjalankan server statis:', err.message);
      if (server) server.kill();
      process.exit(1);
    }
  }

  let gagal = 0;
  for (const [name, desc] of SUITES) {
    if (only && only !== name) continue;
    process.stdout.write(`\n\x1b[1m▶ ${name}\x1b[0m — ${desc}\n`);
    const r = spawnSync(process.execPath, [path.join(__dirname, name + '.js')], { stdio: 'inherit' });
    if (r.status !== 0) { gagal++; process.stdout.write(`\x1b[31m✗ ${name} GAGAL\x1b[0m\n`); }
  }

  if (server) server.kill();
  process.stdout.write(gagal ? `\n\x1b[31m${gagal} suite gagal\x1b[0m\n` : `\n\x1b[32mSeluruh suite lulus\x1b[0m\n`);
  process.exit(gagal ? 1 : 0);
})();
