/* Uji layar Laporan Event yang tersambung ke API.
 *
 * Yang dijaga: rekap dihitung dari GET /api/acara?status=selesai&
 * dengan_peserta=1 sungguhan (jumlah_peserta_terdaftar/jumlah_peserta_hadir
 * dari EventController::index dengan withCount), KPI dihitung dari baris
 * itu (bukan angka purwarupa 87%/94%/4,6 yang sama untuk setiap event),
 * dan "Realisasi Anggaran"/"Skor Kepuasan" purwarupa tidak lagi tampil.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  let urut = 0;

  const acaraSelesai = [
    { id: 1, nama: 'Sosialisasi SOP Fasilitas 2026', jenis: 'Sosialisasi', organizer: 'Umum & Fasilitas', pic: null, ruangan: { id: 1, kode: 'RM-003', nama: 'Meeting Room Charlie' }, tanggal: '2026-08-10', jumlah_peserta: 40, anggaran: 8500000, status: { kode: 'selesai', nama: 'Selesai' }, catatan: null, jumlah_peserta_terdaftar: 40, jumlah_peserta_hadir: 35 }
  ];

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Wulan Room Admin', email: 'w@x.id',
      peran: ['facility-manager'],
      izin: ['dashboard.lihat', 'booking-ruangan.lihat', 'acara.lihat'] } };

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
          const id = 'sesi' + (++urut);
          res.setHeader('Set-Cookie', 'flms_sesi=' + id + '; Path=/; SameSite=Lax');
          return kirim(200, pengguna);
        }
        return kirim(422, { message: 'x', errors: { email: ['x'] } });
      });
    }
    if (!(req.headers.cookie || '').includes('flms_sesi=')) return kirim(401, { message: 'x' });

    const u = new URL(req.url, 'http://x');

    if (u.pathname === '/api/acara') {
      ok(u.searchParams.get('status') === 'selesai', 'Diminta dengan status=selesai — hanya event terlaksana yang direkap');
      ok(u.searchParams.get('dengan_peserta') === '1', 'Diminta dengan dengan_peserta=1 — jumlah peserta ikut diminta, bukan query terpisah per baris');
      return kirim(200, { data: acaraSelesai });
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

  await page.fill('#masukEmail', 'wulan@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  console.log('\n--- 1. Laporan Event dari data nyata ---');
  await page.evaluate(() => { location.hash = '#/eventreport'; });
  await page.waitForTimeout(900);

  const isi = await page.textContent('#evrIsi');
  ok(/Sosialisasi SOP Fasilitas 2026/.test(isi), 'Event terlaksana tampil di rekap');

  ok(!/Realisasi/.test(isi), 'KPI/kolom "Realisasi Anggaran" purwarupa (selalu 94%) tidak lagi tampil');
  ok(!/Skor Kepuasan/.test(isi), 'KPI "Skor Kepuasan" purwarupa (survei yang tidak pernah ada) tidak lagi tampil');
  ok(!/Efisiensi/.test(isi), 'Kolom "Efisiensi" purwarupa tidak lagi tampil');

  // Tingkat kehadiran baris: 35/40 = 87,5% dibulatkan 88% — dihitung dari
  // jumlah_peserta_hadir/jumlah_peserta_terdaftar SUNGGUHAN, bukan rasio
  // 87% yang di-hardcode untuk setiap event di purwarupa lama.
  ok(/88%/.test(isi), 'Tingkat Kehadiran per baris dihitung dari data nyata (35/40=88%)', isi.replace(/\s+/g, ' '));

  ok(errs.length === 0, 'Tanpa galat halaman pada Laporan Event', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
