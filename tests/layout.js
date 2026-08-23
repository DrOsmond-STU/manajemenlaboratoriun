/* Uji layar Room Layout Management yang tersambung ke API.
 *
 * Yang dijaga: matriks layout memakai Repo.ruangan (kolom `tata_letak`
 * yang SUDAH ADA) — bukan endpoint baru — dan kolom "Custom" purwarupa
 * (selalu bertanda centang untuk semua ruangan, tidak membawa informasi)
 * sudah tidak tampil lagi. "Ruangan Terkait" benar-benar menyaring dari
 * data ruangan sungguhan.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;

  const ROOMS = [
    { id: 1, kode: 'RM-001', nama: 'Ruang Rapat Garuda', kapasitas: 20, tata_letak: ['Theater', 'Boardroom'] },
    { id: 2, kode: 'RM-002', nama: 'Ruang Diskusi Elang', kapasitas: 12, tata_letak: ['U-Shape'] },
    { id: 3, kode: 'RM-003', nama: 'Auditorium Utama', kapasitas: 200, tata_letak: [] }
  ];

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Rahmat Facility', email: 'r@x.id',
      peran: ['facility-manager'], izin: ['master-data.lihat'] } };

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

    if (req.url.startsWith('/api/rooms')) {
      return kirim(200, { data: ROOMS, meta: { total: ROOMS.length } });
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

  await page.fill('#masukEmail', 'rahmat@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  console.log('\n--- 1. Room Layout Management ---');
  await page.evaluate(() => { location.hash = '#/layout'; });
  await page.waitForTimeout(1000);

  const matrix = await page.textContent('#lytMatrix');
  ok(/Ruang Rapat Garuda/.test(matrix), 'Ruangan sungguhan tampil di matriks');
  ok(/Ruang Diskusi Elang/.test(matrix), 'Ruangan kedua tampil');
  ok(!/Custom/.test(await page.textContent('#lytMatrix')), 'Kolom "Custom" purwarupa (selalu centang, tidak informatif) tidak lagi tampil');

  const matrixHTML = await page.innerHTML('#lytMatrix');
  const rows = matrixHTML.split('<tr>');
  const rowGaruda = rows.find((r) => /Ruang Rapat Garuda/.test(r)) || '';
  const cekTheater = (rowGaruda.match(/<td[^>]*class="center"[^>]*>([\s\S]*?)<\/td>/g) || [])[0] || '';
  ok(/color:var\(--green-500\)/.test(cekTheater), 'Ruang Rapat Garuda bertanda centang untuk Theater (tata_letak sungguhan)');

  console.log('\n--- 2. Ruangan Terkait — disaring dari data sungguhan ---');
  await page.click('button:has-text("Ruangan Terkait")');
  await page.waitForTimeout(500);
  const modal = await page.textContent('.modal, body');
  ok(/Ruang Rapat Garuda/.test(modal), 'Modal "Ruangan Terkait" untuk Theater menyebut ruangan yang benar-benar mencantumkannya');
  ok(!/Ruang Diskusi Elang/.test(modal.split('Ruangan Pendukung')[1] || modal), 'Ruangan yang TIDAK mencantumkan Theater tidak ikut disebut');

  ok(errs.length === 0, 'Tanpa galat halaman pada Room Layout Management', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
