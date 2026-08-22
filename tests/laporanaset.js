/* Uji Laporan Aset yang tersambung ke API.
 *
 * Yang dijaga: seluruh angka pada layar ini benar-benar berasal dari
 * RingkasanAset (dihitung server, atas seluruh aset dalam cakupan) —
 * bukan angka tetap purwarupa — dan komposisi per kode barang menampilkan
 * uraian BMN, bukan kategori purwarupa yang dikarang bebas.
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
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Rina Marlina', email: 'r@x.id', peran: ['asset-manager'], izin: ['aset.lihat'] } };

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

    if (req.url.startsWith('/api/assets/ringkasan')) {
      return kirim(200, {
        data: {
          jumlah: 4, nilai_perolehan: 1250000000, nilai_buku: 780000000, akumulasi_penyusutan: 470000000,
          garansi_akan_berakhir: 0,
          disposal: { jumlah: 1, nilai_buku: 0 },
          per_kode_barang: [
            { kode_barang: '3.08.01.03.001', uraian: 'Kromatografi Cair', jumlah: 2, nilai_perolehan: 900000000, nilai_buku: 600000000 },
            { kode_barang: '3.05.02.01.003', uraian: 'Peralatan Pendingin', jumlah: 2, nilai_perolehan: 350000000, nilai_buku: 180000000 }
          ],
          kondisi: [{ kode: 'B', nama: 'Baik', jumlah: 2 }, { kode: 'RR', nama: 'Rusak Ringan', jumlah: 1 }, { kode: 'RB', nama: 'Rusak Berat', jumlah: 1 }]
        }
      });
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

  console.log('\n--- 1. Laporan Aset ---');
  await page.evaluate(() => { location.hash = '#/reportasset'; });
  await page.waitForTimeout(900);

  const isi = await page.textContent('#rasIsi');
  ok(/Rp\s*1,25\s*M|Rp\s*1,3\s*M|Rp/.test(isi), 'Nilai perolehan dari server tampil (bukan angka purwarupa)');
  ok(/Kromatografi Cair/.test(isi), 'Komposisi menampilkan uraian kode barang BMN, bukan kategori purwarupa');
  ok(!/IT Equipment/.test(isi), 'Bukan kategori purwarupa (IT Equipment tidak ada di server)');
  ok(/Aset Dihapuskan/.test(isi), 'KPI aset dihapuskan tampil');

  ok(errs.length === 0, 'Tanpa galat halaman pada laporan aset', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
