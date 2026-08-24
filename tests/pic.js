/* Uji layar Penanggung Jawab (PIC) yang tersambung ke API.
 *
 * Yang dijaga: matriks murni agregasi dari `penanggung_jawab` yang SUDAH
 * ADA pada Repo.ruangan/Repo.laboratorium/Repo.aset — bukan entitas baru
 * — dan KPI/kolom fiktif purwarupa (Workload, Ketersediaan, Delegasi
 * Aktif, spanduk eskalasi) sudah tidak tampil. Kegagalan SATU sumber
 * (mis. tidak berwenang atas Aset) tidak boleh mengosongkan agregat dari
 * sumber lain.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;

  const PJ = { id: 9, nama: 'Andi Teknisi' };

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Rahmat Facility', email: 'r@x.id',
      peran: ['facility-manager'], izin: ['booking-ruangan.lihat', 'laboratorium.lihat'] } };

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
      return kirim(200, { data: [
        { id: 1, kode: 'RM-001', nama: 'Ruang Rapat Garuda', penanggung_jawab: PJ },
        { id: 2, kode: 'RM-002', nama: 'Auditorium Utama', penanggung_jawab: null }
      ], meta: { total: 2 } });
    }
    if (req.url.startsWith('/api/laboratories')) {
      return kirim(200, { data: [
        { id: 1, kode: 'LAB-001', nama: 'Laboratorium Kimia Analitik', penanggung_jawab: PJ }
      ], meta: { total: 1 } });
    }
    // Peran ini SENGAJA tidak diberi izin aset.lihat — mensimulasikan
    // kegagalan satu sumber tanpa mengosongkan agregat dari sumber lain.
    if (req.url.startsWith('/api/assets')) {
      return kirim(403, { message: 'Anda tidak memiliki izin aset.lihat.' });
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

  console.log('\n--- 1. Penanggung Jawab (PIC) ---');
  await page.evaluate(() => { location.hash = '#/pic'; });
  await page.waitForTimeout(1000);

  const tabel = await page.textContent('#picTabel');
  ok(/Andi Teknisi/.test(tabel), 'PIC sungguhan muncul di matriks — diagregasi dari ruangan & laboratorium');

  const kpi = await page.textContent('#picKpi');
  ok(/PIC Aktif/.test(kpi) && /\b1\b/.test(kpi), 'KPI "PIC Aktif" dihitung sungguhan (1 orang)');
  ok(!/Beban Tertinggi/.test(kpi) && !/Delegasi Aktif/.test(kpi), 'KPI fiktif purwarupa (Beban Tertinggi/Delegasi Aktif) tidak lagi tampil');

  const isi = await page.textContent('#viewBody');
  ok(!/[Ee]skalasi otomatis/.test(isi), 'Spanduk "Eskalasi otomatis aktif" purwarupa tidak lagi tampil');
  ok(!/Workload/.test(isi) && !/kapasitas approval/.test(isi), 'Kolom Workload/kapasitas approval fiktif tidak lagi tampil');

  // Kegagalan sumber Aset (403) tidak boleh mengosongkan agregat dari
  // Ruangan & Laboratorium yang berhasil dimuat.
  ok(/Andi Teknisi/.test(tabel), 'Agregat tetap tampil walau sumber Aset gagal (403) — kegagalan satu sumber tidak mengosongkan yang lain');

  ok(errs.length === 0, 'Tanpa galat halaman pada Penanggung Jawab (PIC)', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
