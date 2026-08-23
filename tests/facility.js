/* Uji layar Fasilitas & Add-on yang tersambung ke API.
 *
 * Yang dijaga: layar ini memakai Tariff (jenis=addon) yang SAMA dengan
 * "Tarif Add-on" pada Daftar Tarif — bukan tabel baru — dan KPI karangan
 * purwarupa (Add-on Terlaris/Pendapatan Add-on/Vendor Terhubung) sudah
 * tidak tampil lagi.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  let idAddon = 0;
  const addons = [];

  const bentuk = (a) => ({
    id: a.id, nama: a.nama,
    jenis: { kode: 'addon', nama: 'Add-on' },
    sumber_daya: null,
    satuan_waktu: { kode: a.satuan_waktu, nama: { jam: 'Per jam', hari: 'Per hari', paket: 'Per paket' }[a.satuan_waktu] },
    harga: a.harga,
    segmen: { kode: a.segmen, nama: { umum: 'Umum', internal: 'Internal', pemerintah: 'Pemerintah' }[a.segmen] },
    deskripsi: null, kapasitas: null, aktif: a.aktif !== false
  });

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Rahmat Facility', email: 'r@x.id',
      peran: ['facility-manager'], izin: ['penyewaan.lihat', 'penyewaan.buat', 'penyewaan.ubah'] } };

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

    if (u.pathname === '/api/tarif') {
      if (req.method === 'GET') {
        ok(u.searchParams.get('jenis') === 'addon', 'Diminta dengan jenis=addon — tabel Tariff yang sama dengan Daftar Tarif');
        return kirim(200, { data: addons.map(bentuk) });
      }
      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const galat = {};
          if (!isi.nama) galat.nama = ['Nama wajib diisi.'];
          if (Object.keys(galat).length) return kirim(422, { message: 'x', errors: galat });
          isi.id = ++idAddon;
          isi.aktif = true;
          addons.push(isi);
          return kirim(201, { data: bentuk(isi) });
        });
      }
    }

    const mUpdate = u.pathname.match(/^\/api\/tarif\/(\d+)$/);
    if (mUpdate && req.method === 'PUT') {
      const a = addons.find((x) => x.id === Number(mUpdate[1]));
      if (!a) return kirim(404, { message: 'x' });
      let b = ''; req.on('data', (d) => (b += d));
      return req.on('end', () => {
        Object.assign(a, JSON.parse(b || '{}'));
        return kirim(200, { data: bentuk(a) });
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

  await page.fill('#masukEmail', 'rahmat@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  /* ============ 1. KOSONG ============ */
  console.log('\n--- 1. Basis data kosong ---');
  await page.evaluate(() => { location.hash = '#/facility'; });
  await page.waitForTimeout(900);

  ok(/Belum ada add-on terdaftar/.test(await page.textContent('#facTabel')), 'Kosong ditampilkan apa adanya');
  const kpiAwal = await page.textContent('#facKpi');
  ok(!/Add-on Terlaris/.test(kpiAwal) && !/Pendapatan Add-on/.test(kpiAwal) && !/Vendor Terhubung/.test(kpiAwal),
    'KPI karangan purwarupa (Terlaris/Pendapatan/Vendor Terhubung) tidak lagi tampil');

  /* ============ 2. VALIDASI SERVER ============ */
  console.log('\n--- 2. Validasi server ---');
  await page.click('button:has-text("Tambah Add-on")');
  await page.waitForTimeout(400);
  await page.click('#facFormSimpan');
  await page.waitForTimeout(600);
  const galat = await page.$('#facFormGalat');
  ok(galat && await galat.isVisible(), 'Galat dari server tampil di formulir');
  ok(/Nama wajib diisi/.test(await galat.textContent()), 'Pesan server, bukan generik');

  /* ============ 3. SIMPAN SUNGGUHAN ============ */
  console.log('\n--- 3. Menyimpan add-on sungguhan ---');
  await page.fill('#facNama', 'Coffee Break');
  await page.selectOption('#facSatuan', 'paket');
  await page.fill('#facHarga', '45000');
  await page.click('#facFormSimpan');
  await page.waitForTimeout(900);

  ok(!(await page.$('#facNama')), 'Formulir tertutup setelah berhasil');
  const daftar = await page.textContent('#facTabel');
  ok(/Coffee Break/.test(daftar), 'Add-on muncul di daftar');
  ok(/Per paket/.test(daftar), 'Satuan baku tampil terbaca');

  const kpiSetelah = await page.textContent('#facKpi');
  ok(/Katalog Add-on/.test(kpiSetelah) && /Aktif Dijual/.test(kpiSetelah), 'KPI genuinely dihitung dari katalog sungguhan tampil');

  /* ============ 4. UBAH — NONAKTIFKAN ============ */
  console.log('\n--- 4. Ubah add-on — nonaktifkan ---');
  await page.click('#facTabel .icon-btn');
  await page.waitForTimeout(500);
  await page.click('#facAktif ~ span');   // sakelar visual — input aslinya opacity:0
  await page.click('#facFormSimpan');
  await page.waitForTimeout(900);

  ok(/Nonaktif/.test(await page.textContent('#facTabel')), 'Status nonaktif tersimpan dan tampil setelah diedit');

  ok(errs.length === 0, 'Tanpa galat halaman pada Fasilitas & Add-on', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
