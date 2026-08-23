/* Uji Laporan Penyewaan yang tersambung ke API.
 *
 * Yang dijaga: seluruh angka berasal dari widget yang SUDAH ADA
 * (dipakai bersama Dashboard) lewat GET /api/dashboard/widget — tanpa
 * satu pun perubahan backend baru — dan tabel "Tagihan Lewat Jatuh
 * Tempo" bukan pengulangan layar Invoice & Tagihan (irisan berbeda:
 * hanya yang sudah lewat tempo).
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
    const pengguna = { data: { id: 1, nama: 'Budi Hartono', email: 'b@x.id', peran: ['finance'], izin: ['dashboard.lihat', 'penyewaan.lihat'] } };

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
      if (kunci === 'penyewaan.jumlah-aktif') return kirim(200, { data: { nilai: 4 } });
      if (kunci === 'penyewaan.pendapatan-ytd') return kirim(200, { data: { nilai: 490000000 } });
      if (kunci === 'penyewaan.tren-pendapatan') {
        return kirim(200, { data: { titik: [{ label: 'Mar 2026', nilai: 42000000 }, { label: 'Apr 2026', nilai: 51000000 }], satuan: 'rupiah' } });
      }
      if (kunci === 'tagihan.piutang') return kirim(200, { data: { nilai: 13750000 } });
      if (kunci === 'tagihan.jatuh-tempo') {
        return kirim(200, { data: { nilai: 1, baris: [{ id: 7, judul: 'INV-2026-0077', keterangan: 'sisa Rp13.750.000 · tempo 1 Jul 2026', status: 'terbit' }], terpotong: false } });
      }
      return kirim(200, { data: { nilai: null, pesan: 'tidak dikenal dalam tiruan' } });
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

  await page.fill('#masukEmail', 'budi@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  console.log('\n--- 1. Laporan Penyewaan ---');
  await page.evaluate(() => { location.hash = '#/reportrental'; });
  await page.waitForTimeout(1000);

  const isi = await page.textContent('#rpyIsi');
  ok(/490/.test(isi), 'Pendapatan tahun berjalan dari widget tampil');
  ok(/Penyewaan Aktif/.test(isi) && /\b4\b/.test(isi), 'KPI Penyewaan Aktif menggantikan "Transaksi Sewa" purwarupa');
  ok(/INV-2026-0077/.test(isi), 'Tabel tagihan lewat jatuh tempo menyebut invoice sungguhan dari server');
  ok(!/Nilai Rata-rata/.test(isi), 'KPI "Nilai Rata-rata" purwarupa dijatuhkan (tidak sepadan untuk dihitung)');

  ok(errs.length === 0, 'Tanpa galat halaman pada laporan penyewaan', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
