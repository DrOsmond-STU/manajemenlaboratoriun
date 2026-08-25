/* Uji layar Teknisi & Operator yang tersambung ke API.
 *
 * Yang dijaga: TANPA satu pun perubahan backend — memakai
 * `Repo.pengguna` (tapisan ?peran= yang sudah ada) dan `Repo.pemeliharaan`
 * yang sudah tersambung. Kedua sumber dimuat terpisah: gagal pada satu
 * sumber (mis. tanpa izin pemeliharaan.lihat) tidak boleh menggagalkan
 * daftar teknisi yang sumbernya berhasil.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  let urut = 0;

  const pengguna = [
    { id: 3, nama: 'Bayu Prakoso', unit_kerja: 'Litbang' },
    { id: 10, nama: 'Rina Marlina', unit_kerja: 'QHSE' }
  ];
  const wo = [
    { id: 1, status: { kode: 'berjalan', nama: 'Sedang dikerjakan' } },
    { id: 2, status: { kode: 'berjalan', nama: 'Sedang dikerjakan' } },
    { id: 3, status: { kode: 'berjalan', nama: 'Sedang dikerjakan' } }
  ];

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const dataPengguna = { data: { id: 1, nama: 'Andi Kurniawan', email: 'a@x.id',
      peran: ['room-administrator'],
      izin: ['dashboard.lihat', 'master-data.lihat'] } };

    if (req.url.startsWith('/sanctum/csrf-cookie')) {
      res.setHeader('Set-Cookie', 'XSRF-TOKEN=t; Path=/; SameSite=Lax');
      res.writeHead(204); return res.end();
    }
    if (req.url.startsWith('/api/saya')) {
      return (req.headers.cookie || '').includes('flms_sesi=') ? kirim(200, dataPengguna) : kirim(401, { message: 'x' });
    }
    if (req.url.startsWith('/api/masuk')) {
      let b = ''; req.on('data', (d) => (b += d));
      return req.on('end', () => {
        if (JSON.parse(b || '{}').password === 'sandi-benar') {
          const id = 'sesi' + (++urut);
          res.setHeader('Set-Cookie', 'flms_sesi=' + id + '; Path=/; SameSite=Lax');
          return kirim(200, dataPengguna);
        }
        return kirim(422, { message: 'x', errors: { email: ['x'] } });
      });
    }
    if (!(req.headers.cookie || '').includes('flms_sesi=')) return kirim(401, { message: 'x' });

    const u = new URL(req.url, 'http://x');

    if (u.pathname === '/api/pengguna') {
      ok(u.searchParams.get('peran') === 'lab-technician', 'Diminta dengan ?peran=lab-technician — memakai tapisan yang sudah ada pada endpoint pemilih pengguna');
      return kirim(200, { data: pengguna, terpotong: false });
    }

    if (u.pathname === '/api/pemeliharaan') {
      // Peran ini SENGAJA tidak diberi izin pemeliharaan.lihat pada
      // fixture ini — menguji bahwa kegagalan sumber ini tidak
      // mengosongkan daftar teknisi yang sumbernya berhasil.
      return kirim(403, { message: 'Tidak berwenang.' });
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

  await page.fill('#masukEmail', 'andi@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  console.log('\n--- 1. Teknisi & Operator ---');
  await page.evaluate(() => { location.hash = '#/technician'; });
  await page.waitForTimeout(900);

  const tabel = await page.textContent('#tekTabel');
  ok(/Bayu Prakoso/.test(tabel), 'Pengguna berperan lab-technician tampil dari data sungguhan');
  ok(/Rina Marlina/.test(tabel), 'Teknisi kedua tampil');
  ok(/Litbang/.test(tabel), 'Unit kerja sungguhan tampil');

  const kpi = await page.textContent('#tekKpi');
  ok(/Teknisi Aktif/.test(kpi) && /2/.test(kpi), 'KPI Teknisi Aktif dihitung dari data sungguhan (2 orang)');
  ok(/Work Order Berjalan/.test(kpi), 'KPI Work Order Berjalan tetap tampil');
  ok(/Work Order Berjalan\s*—/.test(kpi.replace(/\s+/g, ' ')), 'KPI Work Order Berjalan menampilkan "—" (bukan 0 yang menyesatkan) saat sumbernya gagal 403', kpi.replace(/\s+/g, ' '));
  ok(!/Kompetensi/.test(tabel + kpi), 'Kolom "Kompetensi/Sertifikasi" purwarupa (tidak ada datanya) tidak lagi tampil');
  ok(!/Rata-rata Response/.test(kpi), 'KPI "Rata-rata Response" purwarupa (tidak pernah dicatat) tidak lagi tampil');

  ok(errs.length === 0, 'Tanpa galat halaman pada Teknisi & Operator — kegagalan sumber pemeliharaan tidak mengosongkan daftar teknisi', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
