/* Uji layar Vendor & Mitra yang tersambung ke API.
 *
 * Yang dijaga: CRUD sungguhan (bukan UI.demo()), nonaktifkan bukan
 * menghapus baris, dan panel "Performa Vendor" pada Laporan Maintenance
 * benar-benar terisi dari GET /api/vendors ketika penggunanya PUNYA izin
 * vendor.lihat (kasus sebaliknya — tanpa izin — ada di
 * tests/laporanmaintenance.js).
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  let idVendor = 0;
  const vendor = [];

  const bentuk = (v) => ({
    id: v.id, kode: v.kode, nama: v.nama, kategori: v.kategori,
    pic: { nama: v.pic_nama || null, telepon: v.pic_telepon || null, email: v.pic_email || null },
    rating: v.rating === undefined ? null : v.rating,
    kontrak_berlaku_sampai: v.kontrak_berlaku_sampai || null,
    aktif: v.aktif !== false, catatan: v.catatan || null,
    jumlah_pekerjaan: v.jumlah_pekerjaan || 0,
    total_biaya: v.total_biaya || 0
  });

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Rahmat Facility', email: 'r@x.id',
      peran: ['facility-manager'],
      izin: ['dashboard.lihat', 'pemeliharaan.lihat', 'vendor.lihat', 'vendor.buat', 'vendor.ubah'] } };

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
      if (kunci === 'pemeliharaan.biaya-ytd') return kirim(200, { data: { nilai: 237000000 } });
      if (kunci === 'pemeliharaan.aktif') return kirim(200, { data: { nilai: 6 } });
      if (kunci === 'pemeliharaan.jenis') {
        return kirim(200, { data: { bagian: [
          { kode: 'preventif', nama: 'Pemeliharaan preventif', jumlah: 52 },
          { kode: 'korektif', nama: 'Pemeliharaan korektif', jumlah: 20 },
          { kode: 'darurat', nama: 'Penanganan darurat', jumlah: 4 },
          { kode: 'kalibrasi', nama: 'Kalibrasi', jumlah: 8 }
        ], nilai: 84 } });
      }
      if (kunci === 'pemeliharaan.tren-biaya') return kirim(200, { data: { titik: [], satuan: 'rupiah' } });
      if (kunci === 'pemeliharaan.terjadwal') return kirim(200, { data: { nilai: 0, baris: [], terpotong: false } });
      return kirim(200, { data: { nilai: null, pesan: 'tidak dikenal dalam tiruan' } });
    }

    if (u.pathname === '/api/vendors') {
      if (req.method === 'GET') {
        let baris = vendor.slice();
        const cari = u.searchParams.get('cari');
        if (cari) {
          const k = cari.toLowerCase();
          baris = baris.filter((v) => (v.nama + ' ' + v.kategori).toLowerCase().indexOf(k) !== -1);
        }
        const kategori = u.searchParams.get('kategori');
        if (kategori) baris = baris.filter((v) => v.kategori === kategori);
        const aktifParam = u.searchParams.get('aktif');
        if (aktifParam !== null) {
          const inginAktif = aktifParam === '1' || aktifParam === 'true';
          baris = baris.filter((v) => (v.aktif !== false) === inginAktif);
        }
        return kirim(200, { data: baris.map(bentuk), meta: { total: baris.length } });
      }
      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const galat = {};
          if (!isi.kode) galat.kode = ['Kode vendor wajib diisi.'];
          if (vendor.some((v) => v.kode === isi.kode)) galat.kode = ['Kode vendor sudah dipakai.'];
          if (!isi.nama) galat.nama = ['Nama vendor wajib diisi.'];
          if (Object.keys(galat).length) return kirim(422, { message: 'Isian belum benar.', errors: galat });
          isi.id = ++idVendor;
          isi.aktif = true;
          vendor.push(isi);
          return kirim(201, { data: bentuk(isi) });
        });
      }
      return kirim(404, { message: 'Tidak ditemukan' });
    }

    if (/^\/api\/vendors\/\d+$/.test(u.pathname)) {
      const id = Number(u.pathname.split('/').pop());
      const v = vendor.find((x) => x.id === id);
      if (!v) return kirim(404, { message: 'Tidak ditemukan' });

      if (req.method === 'PUT') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          Object.assign(v, JSON.parse(b || '{}'));
          return kirim(200, { data: bentuk(v) });
        });
      }
      if (req.method === 'DELETE') {
        v.aktif = false;
        return kirim(200, { pesan: 'Vendor dinonaktifkan. Riwayat pekerjaan tetap tersimpan.' });
      }
    }

    kirim(404, { message: 'Tidak ditemukan' });
  });

  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port, vendor })));
}

(async () => {
  const browser = await launch();
  const { server, port, vendor } = await apiTiruan();
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

  /* ============ 1. DAFTAR KOSONG ============ */
  console.log('\n--- 1. Basis data kosong ---');
  await page.evaluate(() => { location.hash = '#/vendor'; });
  await page.waitForTimeout(900);

  const kosong = await page.textContent('#vdrDaftar');
  ok(/Tidak ada vendor/.test(kosong), 'Basis data kosong ditampilkan apa adanya, bukan diisi data purwarupa');

  /* ============ 2. VALIDASI SERVER SAMPAI KE FORMULIR ============ */
  console.log('\n--- 2. Validasi server tampil di formulir ---');
  await page.click('button:has-text("Tambah Vendor")');
  await page.waitForTimeout(400);
  ok(!!(await page.$('#vdrKode')), 'Formulir tambah vendor terbuka');

  await page.fill('#vdrNama', 'Tanpa Kode');
  await page.click('#vdrFormSimpan');
  await page.waitForTimeout(600);

  const galat = await page.$('#vdrFormGalat');
  const galatTampil = galat ? await galat.isVisible() : false;
  ok(galatTampil, 'Galat dari server tampil di dalam formulir');
  const teksGalat = galat ? await galat.textContent() : '';
  ok(/Kode vendor wajib diisi/.test(teksGalat), 'Pesannya pesan server, bukan pesan generik', teksGalat.trim());

  /* ============ 3. SIMPAN SUNGGUHAN ============ */
  console.log('\n--- 3. Menyimpan ke basis data ---');
  await page.fill('#vdrKode', 'VN-101');
  await page.fill('#vdrKategori', 'Kalibrasi');
  await page.fill('#vdrNama', 'PT Kalibrasi Presisi');
  await page.fill('#vdrPicNama', 'Sri Wahyuni');
  await page.fill('#vdrPicTelepon', '0815-6644-331');
  await page.fill('#vdrRating', '4.9');
  await page.click('#vdrFormSimpan');
  await page.waitForTimeout(900);

  ok(!(await page.$('#vdrKode')), 'Formulir tertutup setelah berhasil');

  const daftar = await page.textContent('#vdrDaftar');
  ok(/PT Kalibrasi Presisi/.test(daftar), 'Vendor muncul di daftar');
  ok(/Sri Wahyuni/.test(daftar), 'PIC tampil');
  ok(/Per Proyek/.test(daftar), 'Tanpa kontrak tetap tampil sebagai "Per Proyek", bukan kosong membingungkan');

  const dariServer = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/vendors', { credentials: 'include' });
    return (await r.json()).data.length;
  }, port);
  ok(dariServer === 1, 'Server benar-benar menyimpan satu vendor', 'jumlah=' + dariServer);

  /* ============ 4. NONAKTIFKAN — BUKAN HAPUS ============ */
  console.log('\n--- 4. Nonaktifkan bukan menghapus ---');
  page.once('dialog', (d) => d.accept());
  await page.click('#vdrDaftar .icon-btn:nth-of-type(2)');
  await page.waitForTimeout(900);

  const setelahNonaktif = await page.textContent('#vdrDaftar');
  ok(/Nonaktif/.test(setelahNonaktif), 'Status nonaktif tampil di daftar');

  const tetapAda = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/vendors?aktif=0', { credentials: 'include' });
    return (await r.json()).data.length;
  }, port);
  ok(tetapAda === 1, 'Baris vendor TETAP ADA di server setelah dinonaktifkan, bukan dihapus', 'jumlah=' + tetapAda);

  ok(errs.length === 0, 'Tanpa galat halaman pada modul Vendor & Mitra', errs.join(' | '));

  /* ============ 5. PERFORMA VENDOR PADA LAPORAN MAINTENANCE ============ */
  console.log('\n--- 5. Performa Vendor tersambung di Laporan Maintenance ---');
  vendor[0].aktif = true;
  vendor[0].jumlah_pekerjaan = 5;
  vendor[0].total_biaya = 12500000;

  await page.evaluate(() => { location.hash = '#/reportmaint'; });
  await page.waitForTimeout(1000);

  const laporan = await page.textContent('#rmtIsi');
  ok(/Performa Vendor/.test(laporan), 'Panel Performa Vendor ada di Laporan Maintenance');
  ok(/PT Kalibrasi Presisi/.test(laporan), 'Vendor dengan riwayat pekerjaan tampil di panel Performa Vendor');
  ok(/★ 4\.9/.test(laporan), 'Rating vendor tampil di panel Performa Vendor');

  ok(errs.length === 0, 'Tanpa galat halaman pada Laporan Maintenance', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
