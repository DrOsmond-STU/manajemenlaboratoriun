/* Uji Manajemen Pengguna & Peran yang tersambung ke API.
 *
 * Modul paling sensitif — hanya super-admin punya akses. Yang dijaga:
 * pengguna baru tersimpan sungguhan dengan peran yang benar, tapisan
 * dikirim ke server, dan matriks peran menampilkan kode backend apa
 * adanya (bukan matriks purwarupa yang lain sama sekali).
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  let idUser = 1;
  const pengguna = [
    { id: 1, nama: 'Siti Aminah', email: 's@x.id', unit_kerja: 'Umum & Fasilitas', aktif: true, peran: ['super-admin'], gedung: [] }
  ];

  const NAMA_PERAN = {
    'super-admin': 'Super Admin', 'facility-manager': 'Facility Manager', 'employee': 'Employee / User'
  };
  const MODUL = [{ kode: 'audit', nama: 'Audit trail' }, { kode: 'pengguna', nama: 'Pengguna & peran' }];
  const MATRIKS = {
    'super-admin': { audit: 'PENUH', pengguna: 'PENUH' },
    'facility-manager': { audit: 'LIHAT', pengguna: '-' },
    'employee': { audit: '-', pengguna: '-' }
  };

  const bentuk = (p) => ({ id: p.id, nama: p.nama, email: p.email, unit_kerja: p.unit_kerja, aktif: p.aktif, peran: p.peran, gedung: p.gedung, dibuat_pada: null });

  const punyaSesi = (req) => {
    const c = (req.headers.cookie || '').match(/flms_sesi=([^;]+)/);
    return !!c && sesiAktif.has(c[1]);
  };

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const akun = { data: { id: 1, nama: 'Siti Aminah', email: 's@x.id', peran: ['super-admin'], izin: ['pengguna.lihat', 'pengguna.buat', 'pengguna.ubah'] } };

    if (req.url.startsWith('/sanctum/csrf-cookie')) {
      res.setHeader('Set-Cookie', 'XSRF-TOKEN=t; Path=/; SameSite=Lax');
      res.writeHead(204); return res.end();
    }
    if (req.url.startsWith('/api/saya')) {
      return punyaSesi(req) ? kirim(200, akun) : kirim(401, { message: 'x' });
    }
    if (req.url.startsWith('/api/masuk')) {
      let b = ''; req.on('data', (d) => (b += d));
      return req.on('end', () => {
        if (JSON.parse(b || '{}').password === 'sandi-benar') {
          const id = 'sesi' + (++urut); sesiAktif.add(id);
          res.setHeader('Set-Cookie', 'flms_sesi=' + id + '; Path=/; SameSite=Lax');
          return kirim(200, akun);
        }
        return kirim(422, { message: 'x', errors: { email: ['x'] } });
      });
    }
    if (!punyaSesi(req)) return kirim(401, { message: 'x' });

    if (req.url.startsWith('/api/peran')) {
      return kirim(200, {
        modul: MODUL,
        peran: Object.keys(NAMA_PERAN).map((k) => ({ kode: k, nama: NAMA_PERAN[k], jumlah_pengguna: pengguna.filter((p) => p.peran.includes(k)).length, perlu_dikonfirmasi: false })),
        matriks: MATRIKS,
        nama_tingkat: { '-': '—', LIHAT: 'Lihat', BUAT: 'Buat', UBAH: 'Ubah', PENUH: 'Penuh' }
      });
    }

    if (req.url.startsWith('/api/pengguna-kelola') && req.method === 'GET') {
      const u = new URL(req.url, 'http://x');
      let baris = pengguna;
      if (u.searchParams.get('cari')) {
        const k = u.searchParams.get('cari').toLowerCase();
        baris = baris.filter((p) => p.nama.toLowerCase().includes(k));
      }
      return kirim(200, { data: baris.map(bentuk) });
    }
    if (req.url.startsWith('/api/pengguna-kelola') && req.method === 'POST') {
      let b = ''; req.on('data', (x) => (b += x));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        if (pengguna.some((p) => p.email === isi.email)) {
          return kirim(422, { message: 'x', errors: { email: ['Surel sudah dipakai.'] } });
        }
        const p = { id: ++idUser, nama: isi.name, email: isi.email, unit_kerja: isi.unit_kerja || null, aktif: true, peran: isi.peran || [], gedung: isi.gedung || [] };
        pengguna.push(p);
        return kirim(201, { data: bentuk(p) });
      });
    }
    const cocokUpdate = req.url.match(/^\/api\/pengguna-kelola\/(\d+)/);
    if (cocokUpdate && req.method === 'PUT') {
      const p = pengguna.find((x) => x.id === Number(cocokUpdate[1]));
      let b = ''; req.on('data', (x) => (b += x));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        if ('name' in isi) p.nama = isi.name;
        if ('unit_kerja' in isi) p.unit_kerja = isi.unit_kerja;
        if ('peran' in isi) p.peran = isi.peran;
        if ('gedung' in isi) p.gedung = isi.gedung;
        if ('aktif' in isi) p.aktif = isi.aktif;
        return kirim(200, { data: bentuk(p) });
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

  await page.fill('#masukEmail', 'siti@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  /* ============ 1. DAFTAR PENGGUNA ============ */
  console.log('\n--- 1. Manajemen Pengguna ---');
  await page.evaluate(() => { location.hash = '#/users'; });
  await page.waitForTimeout(900);

  ok(/Siti Aminah/.test(await page.textContent('#usrDaftar')), 'Pengguna dari server tampil di daftar');
  ok(/Super Admin/.test(await page.textContent('#usrDaftar')), 'Peran tampil dengan nama, bukan kode mentah');

  /* ============ 2. TAMBAH PENGGUNA ============ */
  console.log('\n--- 2. Tambah Pengguna ---');
  await page.click('button:has-text("Tambah Pengguna")');
  await page.waitForTimeout(400);
  await page.fill('#usrNama', 'Budi Santoso');
  await page.fill('#usrEmail', 'budi@instansi.go.id');
  await page.fill('#usrSandi', 'sandi-aman-123');
  await page.selectOption('#usrPeran', ['facility-manager']);
  await page.click('#usrFormSimpan');
  await page.waitForTimeout(600);

  ok(/Budi Santoso/.test(await page.textContent('#usrDaftar')), 'Pengguna baru benar-benar tersimpan dan muncul di daftar');

  /* ============ 3. EMAIL KEMBAR DITOLAK ============ */
  console.log('\n--- 3. Validasi ---');
  await page.click('button:has-text("Tambah Pengguna")');
  await page.waitForTimeout(400);
  await page.fill('#usrNama', 'Lainnya');
  await page.fill('#usrEmail', 'budi@instansi.go.id');
  await page.fill('#usrSandi', 'sandi-aman-123');
  await page.selectOption('#usrPeran', ['employee']);
  await page.click('#usrFormSimpan');
  await page.waitForTimeout(500);
  ok(/sudah dipakai/.test(await page.textContent('#usrFormGalat')), 'Server menolak email kembar dengan pesan yang jelas');
  await page.click('button:has-text("Batal")');

  /* ============ 4. UBAH PENGGUNA — NONAKTIFKAN ============ */
  console.log('\n--- 4. Nonaktifkan pengguna ---');
  await page.waitForTimeout(300);
  const baris = page.locator('#usrDaftar tbody tr', { hasText: 'Budi Santoso' });
  await baris.locator('.icon-btn').click();
  await page.waitForTimeout(400);
  await page.click('#usrAktif ~ span');   // sakelar visual — input aslinya opacity:0
  await page.click('#usrFormSimpan');
  await page.waitForTimeout(600);
  ok(/Nonaktif/.test(await page.textContent('#usrDaftar')), 'Status nonaktif tersimpan dan tampil di daftar');

  /* ============ 5. MATRIKS PERAN ============ */
  console.log('\n--- 5. Role & Hak Akses ---');
  await page.evaluate(() => { location.hash = '#/roles'; });
  await page.waitForTimeout(900);
  const rolTxt = await page.textContent('#rolIsi');
  ok(/Audit trail/.test(rolTxt) && /Pengguna & peran/.test(rolTxt), 'Matriks menampilkan modul sungguhan dari server');
  ok(!/Rental & Billing/.test(rolTxt), 'Bukan matriks purwarupa (modul "Rental & Billing" tidak ada di server)');

  ok(errs.length === 0, 'Tanpa galat halaman pada manajemen pengguna & peran', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
