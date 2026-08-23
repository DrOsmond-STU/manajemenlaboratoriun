/* Uji Studio Label & Barcode yang tersambung ke API.
 *
 * Yang dijaga: begitu mode sungguhan aktif, panel "Pilih Barang"
 * menampilkan ASET SUNGGUHAN yang terdaftar lewat Register BMN — bukan
 * lagi delapan barang contoh purwarupa yang selalu sama. Sebelumnya
 * Studio Label memakai D.equipment/D.assets tanpa syarat, sehingga aset
 * yang baru didaftarkan tidak pernah bisa dicetak labelnya.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;

  const aset = [
    {
      id: 501, kode_internal: 'STU/KIM-01/HPLC/2022/0009', nama: 'HPLC Nexera X3',
      merk: 'Shimadzu', tipe: 'X3', serial_number: 'SHZ-X3-9001',
      bmn: { id: '024.05.3.08.01.03.001.00009', kode_lokasi: '024.05', kode_barang: '3.08.01.03.001', uraian_barang: 'Kromatografi Cair', nup: 9, nup_fmt: '00009', kib: 'B' },
      perolehan: { tanggal: '2022-05-01' },
      penyusutan: { nilai_perolehan: 900000000 },
      kondisi: { kode: 'B', nama: 'Baik' }, status_penggunaan: 'Digunakan untuk Operasional Satker',
      ruangan: { id: 1, kode: 'KIM-01', nama: 'Laboratorium Kimia 1' }, laboratorium: null,
      penanggung_jawab: { id: 9, nama: 'Rina Marlina' }
    }
  ];

  const punyaSesi = (req) => {
    const c = (req.headers.cookie || '').match(/flms_sesi=([^;]+)/);
    return !!c && sesiAktif.has(c[1]);
  };

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Rina Marlina', email: 'r@x.id', peran: ['asset-manager'], izin: ['aset.lihat', 'aset.buat', 'aset.ubah'] } };

    if (req.url.startsWith('/sanctum/csrf-cookie')) {
      res.setHeader('Set-Cookie', 'XSRF-TOKEN=t; Path=/; SameSite=Lax');
      res.writeHead(204); return res.end();
    }
    if (req.url.startsWith('/api/saya')) {
      return punyaSesi(req) ? kirim(200, pengguna) : kirim(401, { message: 'x' });
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
    if (!punyaSesi(req)) return kirim(401, { message: 'x' });

    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/assets') {
      return kirim(200, { data: aset, meta: { total: aset.length, per_page: Number(u.searchParams.get('per_halaman') || 25) } });
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

  console.log('\n--- 1. Studio Label & Barcode ---');
  await page.evaluate(() => { location.hash = '#/barcode'; });
  await page.waitForTimeout(1000);

  const isi = await page.textContent('#lblItems');
  ok(/HPLC Nexera X3/.test(isi), 'Aset sungguhan yang terdaftar tampil di panel pemilihan');
  ok(!/Laptop Dell Latitude/.test(isi), 'Bukan lagi barang contoh purwarupa (Laptop Dell tidak ada di server)');

  console.log('\n--- 2. Cetak label memakai data sungguhan ---');
  await page.click('#lblItems label');
  await page.waitForTimeout(300);
  const preview = await page.textContent('#lblPreview');
  ok(/STU\/KIM-01\/HPLC\/2022\/0009/.test(preview) || /HPLC Nexera X3/.test(preview), 'Pratinjau label memakai kode internal/nama aset sungguhan');

  ok(errs.length === 0, 'Tanpa galat halaman pada studio label', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
