/* Uji Laporan Maintenance yang tersambung ke API.
 *
 * Yang dijaga: seluruh angka berasal dari widget yang SUDAH ADA (dipakai
 * bersama Dashboard) lewat GET /api/dashboard/widget — tanpa satu pun
 * perubahan backend baru — dan tabel "Pemeliharaan Terjadwal" bukan
 * pengulangan modul Pemeliharaan & Kalibrasi (irisan berbeda: hanya
 * 30 hari ke depan).
 *
 * Panel "Performa Vendor" dimuat TERPISAH lewat GET /api/vendors — pengguna
 * pada uji ini sengaja TIDAK diberi izin vendor.lihat, supaya kegagalannya
 * (403) terbukti tidak merusak seluruh laporan, hanya panel itu sendiri
 * yang menampilkan pesan tidak berwenang. Kasus sebaliknya (izin lengkap,
 * vendor sungguhan tampil) ada di tests/vendor.js.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Tommy Saputra', email: 't@x.id', peran: ['facility-manager'], izin: ['dashboard.lihat', 'pemeliharaan.lihat'] } };

    if (req.url.startsWith('/sanctum/csrf-cookie')) {
      res.setHeader('Set-Cookie', 'XSRF-TOKEN=t; Path=/; SameSite=Lax');
      res.writeHead(204); return res.end();
    }
    if (req.url.startsWith('/api/saya')) {
      return (req.headers.cookie || '').includes('flms_sesi=') ? kirim(200, pengguna) : kirim(401, { message: 'x' });
    }
    if (req.url.startsWith('/api/masuk')) {
      let b = ''; req.on('data', (d) => (b += d));
      return req.on('end', () => {
        if (JSON.parse(b || '{}').password === 'sandi-benar') {
          const id = 'sesi' + (++urut); sesiAktif.add(id);
          res.setHeader('Set-Cookie', 'flms_sesi=' + id + '; Path=/; SameSite=Lax');
          return kirim(200, pengguna);
        }
        return kirim(422, { message: 'x', errors: { email: ['x'] } });
      });
    }
    if (!(req.headers.cookie || '').includes('flms_sesi=')) return kirim(401, { message: 'x' });

    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/dashboard/widget') {
      const kunci = u.searchParams.get('kunci');
      if (kunci === 'pemeliharaan.biaya-ytd') return kirim(200, { data: { nilai: 237000000 } });
      if (kunci === 'pemeliharaan.aktif') return kirim(200, { data: { nilai: 6 } });
      if (kunci === 'pemeliharaan.jenis') {
        return kirim(200, { data: { bagian: [
          { kode: 'preventif', nama: 'Pemeliharaan preventif', jumlah: 52 },
          { kode: 'korektif', nama: 'Pemeliharaan korektif', jumlah: 20 },
          { kode: 'darurat', nama: 'Penanganan darurat', jumlah: 4 },
          { kode: 'kalibrasi', nama: 'Kalibrasi', jumlah: 8 }
        ], nilai: 84 } });
      }
      if (kunci === 'pemeliharaan.tren-biaya') {
        return kirim(200, { data: { titik: [{ label: 'Mar 2026', nilai: 19000000 }, { label: 'Apr 2026', nilai: 54000000 }], satuan: 'rupiah' } });
      }
      if (kunci === 'pemeliharaan.terjadwal') {
        return kirim(200, { data: { nilai: 1, baris: [{ id: 3, judul: 'Autoklaf Vertikal 100L', keterangan: '2 Sep 2026 · Pemeliharaan preventif', status: 'dijadwalkan' }], terpotong: false } });
      }
      return kirim(200, { data: { nilai: null, pesan: 'tidak dikenal dalam tiruan' } });
    }

    if (u.pathname === '/api/vendors') {
      return kirim(403, { message: 'Anda tidak memiliki izin vendor.lihat.' });
    }

    kirim(404, { message: 'Tidak ditemukan' });
  });

  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

(async () => {
  const browser = await launch();
  const { server, port } = await apiTiruan();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

  await page.goto(`${BASE}/app.html`, { waitUntil: 'load' });
  await page.evaluate((p) => {
    localStorage.setItem('flms.api', 'http://127.0.0.1:' + p);
    localStorage.removeItem('flms.mode');
  }, port);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.fill('#masukEmail', 'tommy@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  console.log('\n--- 1. Laporan Maintenance ---');
  await page.evaluate(() => { location.hash = '#/reportmaint'; });
  await page.waitForTimeout(1000);

  const isi = await page.textContent('#rmtIsi');
  ok(/84/.test(isi), 'Total Pekerjaan dari widget pemeliharaan.jenis tampil');
  ok(/Pemeliharaan preventif/.test(isi) && /52/.test(isi), 'Sebaran per jenis pemeliharaan tampil');
  ok(/Autoklaf Vertikal 100L/.test(isi), 'Tabel terjadwal 30 hari menyebut target sungguhan dari server');
  ok(!/MTTR/.test(isi), 'MTTR purwarupa dijatuhkan (tidak dimodelkan)');
  ok(/Performa Vendor/.test(isi), 'Panel Performa Vendor sudah disambungkan kembali');
  ok(/Tidak berwenang melihat data Vendor/.test(isi),
    'Kegagalan 403 pada panel Vendor tampil sebagai pesan tidak berwenang, bukan merusak seluruh laporan');
  ok(/84/.test(isi), 'KPI lain (Total Pekerjaan) tetap tampil normal walau panel Vendor gagal dimuat');

  ok(errs.length === 0, 'Tanpa galat halaman pada laporan maintenance', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
