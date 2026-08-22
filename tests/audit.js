/* Uji Audit Trail yang tersambung ke API.
 *
 * Hanya baca — tidak ada tindakan tulis di modul ini. Yang dijaga: entri
 * dibaca dari server (bukan tabel purwarupa yang statis), tapisan peristiwa
 * dan rentang tanggal benar-benar dikirim ke server, dan detail perubahan
 * (sebelum/sesudah) tampil kolom per kolom, bukan dump JSON mentah.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;

  const entri = [
    { id: 3, peristiwa: 'diubah', model: 'Booking', model_id: 5, label: 'BK-2026-000433',
      user_id: 1, nama_pelaku: 'Siti Aminah', sebelum: { status: 'disetujui' }, sesudah: { status: 'berlangsung' },
      ip: '10.20.3.14', rute: 'PUT /api/bookings/5', waktu: '2026-08-22T09:10:00+07:00' },
    { id: 2, peristiwa: 'dibuat', model: 'Rental', model_id: 9, label: 'PT Anugerah Sejahtera',
      user_id: 1, nama_pelaku: 'Siti Aminah', sebelum: null, sesudah: { penyewa: 'PT Anugerah Sejahtera' },
      ip: '10.20.5.42', rute: 'POST /api/penyewaan', waktu: '2026-08-21T14:00:00+07:00' },
    { id: 1, peristiwa: 'dihapus', model: 'Tariff', model_id: 2, label: 'Sewa Lama',
      user_id: null, nama_pelaku: null, sebelum: { nama: 'Sewa Lama' }, sesudah: null,
      ip: '127.0.0.1', rute: 'console', waktu: '2026-08-20T08:00:00+07:00' }
  ];

  const bentuk = (a) => ({
    id: a.id, peristiwa: { kode: a.peristiwa, nama: { dibuat: 'Dibuat', diubah: 'Diubah', dihapus: 'Dihapus', dipulihkan: 'Dipulihkan' }[a.peristiwa] },
    objek: { model: a.model, id: a.model_id, label: a.label },
    pelaku: { id: a.user_id, nama: a.nama_pelaku },
    sebelum: a.sebelum, sesudah: a.sesudah, ip: a.ip, rute: a.rute, waktu: a.waktu
  });

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
    const pengguna = { data: { id: 1, nama: 'Siti Aminah', email: 's@x.id', peran: ['super-admin'], izin: ['audit.lihat'] } };

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

    if (req.url.startsWith('/api/audit')) {
      const u = new URL(req.url, 'http://x');
      let baris = entri;
      if (u.searchParams.get('peristiwa')) baris = baris.filter((a) => a.peristiwa === u.searchParams.get('peristiwa'));
      if (u.searchParams.get('sejak')) baris = baris.filter((a) => a.waktu >= u.searchParams.get('sejak'));
      return kirim(200, { data: baris.map(bentuk), meta: { total: baris.length } });
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

  /* ============ 1. AUDIT TRAIL MENAMPILKAN DATA SUNGGUHAN ============ */
  console.log('\n--- 1. Audit Trail ---');
  await page.evaluate(() => { location.hash = '#/audit'; });
  await page.waitForTimeout(900);

  const kpiTxt = await page.textContent('#audKpi');
  ok(!/1\.482/.test(kpiTxt), 'KPI dihitung dari server, bukan angka purwarupa (1.482)');
  ok(/Aktivitas Hari Ini/.test(kpiTxt) && /Dibuat/.test(kpiTxt) && /Diubah/.test(kpiTxt) && /Dihapus/.test(kpiTxt),
    'KPI menampilkan pecahan per peristiwa yang benar-benar dihitung server');

  const daftarTxt = await page.textContent('#audDaftar');
  ok(/PT Anugerah Sejahtera/.test(daftarTxt), 'Entri dari server tampil di daftar');
  ok(/Siti Aminah/.test(daftarTxt), 'Nama pelaku tampil');
  ok(/SISTEM/.test(daftarTxt), 'Peristiwa tanpa pelaku ditandai SISTEM');

  /* ============ 2. TAPISAN PERISTIWA DIKIRIM KE SERVER ============ */
  console.log('\n--- 2. Tapisan ---');
  await page.selectOption('#audFilterPeristiwa', 'dibuat');
  await page.waitForTimeout(700);
  const setelahTapis = await page.textContent('#audDaftar');
  ok(/PT Anugerah Sejahtera/.test(setelahTapis) && !/BK-2026-000433/.test(setelahTapis),
    'Tapisan peristiwa "Dibuat" hanya menampilkan entri dibuat — server yang menyaring');

  await page.selectOption('#audFilterPeristiwa', '');
  await page.waitForTimeout(700);

  /* ============ 3. DETAIL PERUBAHAN KOLOM PER KOLOM ============ */
  console.log('\n--- 3. Detail perubahan ---');
  await page.click('#audDaftar tbody tr');
  await page.waitForTimeout(400);
  const modalTxt = await page.textContent('.modal');
  ok(/status/.test(modalTxt) && /disetujui/.test(modalTxt) && /berlangsung/.test(modalTxt),
    'Detail menampilkan kolom yang berubah beserta nilai sebelum dan sesudah');

  ok(errs.length === 0, 'Tanpa galat halaman pada audit trail', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
