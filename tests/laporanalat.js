/* Uji Laporan Alat yang tersambung ke API.
 *
 * Yang dijaga: KPI kepatuhan kalibrasi & kalibrasi kedaluwarsa berasal
 * dari GET /api/dashboard/widget (angka yang sama dengan Dashboard,
 * termasuk widget baru aset.kepatuhan-kalibrasi) — bukan angka tetap
 * purwarupa — dan "Alat Paling Sering Dipinjam" dihitung dari peminjaman
 * tahun berjalan sungguhan.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  const alat = { id: 1, nama: 'HPLC Nexera X3', kode_internal: 'STU/KIM-01/HPLC/2022/0009', bmn_id: '024.05.3.08.01.03.001.00009' };

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Rina Marlina', email: 'r@x.id', peran: ['asset-manager'], izin: ['dashboard.lihat', 'booking-alat.lihat', 'kalibrasi.lihat'] } };

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
      if (kunci === 'peminjaman.status') {
        return kirim(200, { data: { bagian: [{ kode: 'dipinjam', nama: 'Sedang dipinjam', jumlah: 5 }], nilai: 12 } });
      }
      if (kunci === 'peminjaman.aktif') return kirim(200, { data: { nilai: 5 } });
      if (kunci === 'aset.kepatuhan-kalibrasi') return kirim(200, { data: { nilai: 66.7 } });
      if (kunci === 'kalibrasi.kedaluwarsa') {
        return kirim(200, { data: { nilai: 1, baris: [{ id: 9, judul: 'AAS PerkinElmer', keterangan: 'kedaluwarsa 12 Jul 2026', status: 'kedaluwarsa' }], terpotong: false } });
      }
      return kirim(200, { data: { nilai: null, pesan: 'tidak dikenal dalam tiruan' } });
    }

    if (u.pathname === '/api/peminjaman') {
      return kirim(200, { data: [
        { id: 1, keperluan: 'Analisis', status: { kode: 'dikembalikan', nama: 'Dikembalikan' }, alat: alat, jadwal: { mulai: '2026-03-01T08:00:00+07:00', selesai: '2026-03-01T10:00:00+07:00' } },
        { id: 2, keperluan: 'Analisis 2', status: { kode: 'dipinjam', nama: 'Sedang dipinjam' }, alat: alat, jadwal: { mulai: '2026-04-01T08:00:00+07:00', selesai: '2026-04-01T10:00:00+07:00' } }
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

  await page.fill('#masukEmail', 'rina@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  console.log('\n--- 1. Laporan Alat ---');
  await page.evaluate(() => { location.hash = '#/reportequip'; });
  await page.waitForTimeout(1000);

  const isi = await page.textContent('#rltIsi');
  ok(/66,7|66.7/.test(isi), 'Kepatuhan kalibrasi dari widget aset.kepatuhan-kalibrasi tampil');
  ok(/12/.test(isi), 'Total reservasi dari server tampil');
  ok(/AAS PerkinElmer/.test(isi), 'Status Kalibrasi menampilkan alat sungguhan dari kalibrasi.kedaluwarsa');
  ok(/HPLC Nexera X3/.test(isi), 'Alat Paling Sering Dipinjam dihitung dari peminjaman tahun berjalan sungguhan');

  ok(errs.length === 0, 'Tanpa galat halaman pada laporan alat', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
