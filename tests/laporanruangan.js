/* Uji Laporan Ruangan yang tersambung ke API.
 *
 * Yang dijaga: KPI utilisasi/status booking berasal dari
 * GET /api/dashboard/widget (angka yang sama dengan yang Dashboard
 * tampilkan, dihitung DataWidget) — bukan angka tetap purwarupa — dan
 * rekap per ruangan benar-benar dihitung dari booking tahun berjalan.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  const room = { id: 1, kode: 'RM-003', nama: 'Conference Room Garuda', kapasitas: 20 };

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Siti Aminah', email: 's@x.id', peran: ['facility-manager'], izin: ['dashboard.lihat', 'booking-ruangan.lihat', 'master-data.lihat'] } };

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
      if (kunci === 'booking.status') {
        return kirim(200, { data: { bagian: [
          { kode: 'disetujui', nama: 'Disetujui', jumlah: 6 },
          { kode: 'dibatalkan', nama: 'Dibatalkan', jumlah: 2 }
        ], nilai: 8 } });
      }
      if (kunci === 'ruangan.utilisasi') return kirim(200, { data: { nilai: 61.5 } });
      if (kunci === 'ruangan.tren-utilisasi') {
        return kirim(200, { data: { titik: [{ label: 'Mar 2026', nilai: 50 }, { label: 'Apr 2026', nilai: 61.5 }], satuan: '%' } });
      }
      if (kunci === 'booking.menunggu') return kirim(200, { data: { nilai: 3 } });
      return kirim(200, { data: { nilai: null, pesan: 'tidak dikenal dalam tiruan' } });
    }

    if (u.pathname === '/api/rooms') return kirim(200, { data: [room], meta: { total: 1 } });

    if (u.pathname === '/api/bookings') {
      return kirim(200, { data: [
        { id: 1, keperluan: 'Rapat A', jumlah_peserta: 15, mulai: '2026-08-01T08:00:00+07:00', selesai: '2026-08-01T10:00:00+07:00', status: { kode: 'selesai', nama: 'Selesai', memblokir: true }, ruangan: room },
        { id: 2, keperluan: 'Rapat B', jumlah_peserta: 10, mulai: '2026-08-05T08:00:00+07:00', selesai: '2026-08-05T09:00:00+07:00', status: { kode: 'dibatalkan', nama: 'Dibatalkan', memblokir: false }, ruangan: room }
      ], meta: { total: 2 } });
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

  await page.fill('#masukEmail', 'siti@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  console.log('\n--- 1. Laporan Ruangan ---');
  await page.evaluate(() => { location.hash = '#/reportroom'; });
  await page.waitForTimeout(1000);

  const isi = await page.textContent('#rrmIsi');
  ok(/61,5|61.5/.test(isi), 'Utilisasi ruangan dari DataWidget tampil (angka yang sama dengan Dashboard)');
  ok(/^8$|\b8\b/.test(isi), 'Total booking dari server tampil');
  ok(/25/.test(isi), 'Cancellation rate dihitung (2 dari 8 = 25%)');
  ok(/Conference Room Garuda/.test(isi), 'Rekap per ruangan menyebut ruangan sungguhan');

  ok(errs.length === 0, 'Tanpa galat halaman pada laporan ruangan', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
