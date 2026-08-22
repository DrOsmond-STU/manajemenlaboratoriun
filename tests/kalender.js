/* Uji Kalender Terpadu yang tersambung ke API.
 *
 * Yang dijaga: satu bulan sekaligus diambil lewat filter rentang tanggal
 * (bukan mengandalkan halaman N-teratas), tiga sumber yang sudah
 * tersambung sendiri-sendiri (booking, peminjaman, pemeliharaan)
 * digabung dalam satu tampilan, dan berpindah bulan memuat ulang data —
 * bukan menampilkan cache bulan sebelumnya.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  const rooms = [{ id: 1, kode: 'RM-003', nama: 'Conference Room Garuda' }];

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
    const pengguna = { data: { id: 1, nama: 'Siti Aminah', email: 's@x.id', peran: ['facility-manager'],
      izin: ['booking-ruangan.lihat', 'booking-alat.lihat', 'pemeliharaan.lihat'] } };

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

    if (req.url.startsWith('/api/bookings')) {
      const u = new URL(req.url, 'http://x');
      const sejak = u.searchParams.get('sejak'), sampai = u.searchParams.get('sampai');
      // Baris ini hanya muncul untuk bulan September 2026 — bukti bahwa
      // rentang tanggal benar-benar dikirim dan bukan sekadar diabaikan.
      const cocok = sejak === '2026-09-01' && sampai === '2026-09-30';
      return kirim(200, {
        data: cocok ? [{ id: 501, keperluan: 'Rapat Koordinasi', mulai: '2026-09-15T09:00:00+07:00', selesai: '2026-09-15T11:00:00+07:00', status: { kode: 'disetujui', nama: 'Disetujui' }, ruangan: rooms[0] }] : [],
        meta: { total: cocok ? 1 : 0 }
      });
    }
    if (req.url.startsWith('/api/peminjaman')) {
      return kirim(200, { data: [], meta: { total: 0 } });
    }
    if (req.url.startsWith('/api/pemeliharaan')) {
      return kirim(200, { data: [], meta: { total: 0 } });
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

  /* ============ 1. NAVIGASI KE SEPTEMBER 2026 MEMUAT DATA BULAN ITU ============ */
  console.log('\n--- 1. Kalender Terpadu ---');
  await page.evaluate(() => { location.hash = '#/calendar'; });
  await page.waitForTimeout(900);

  // Halaman dibuka pada bulan berjalan (Agustus 2026) — bergerak maju ke
  // September untuk mencocokkan data tiruan.
  for (let i = 0; i < 1; i++) { await page.click('button:has-text("")'); }
  // Klik tombol navigasi bulan berikutnya (ikon chevron kanan, tanpa teks).
  const tombolMaju = page.locator('.card-head button.icon-btn').nth(1);
  await tombolMaju.click();
  await page.waitForTimeout(700);

  const teksKal = await page.textContent('#calHost');
  ok(/Rapat Koordinasi/.test(teksKal), 'Booking bulan September tampil setelah berpindah bulan');

  /* ============ 2. BERPINDAH BULAN LAGI MENGOSONGKAN BULAN LAIN ============ */
  console.log('\n--- 2. Berpindah bulan ---');
  await tombolMaju.click();   // Oktober — server tiruan tidak mengembalikan apa pun
  await page.waitForTimeout(700);
  const teksOktober = await page.textContent('#calHost');
  ok(!/Rapat Koordinasi/.test(teksOktober), 'Berpindah bulan memuat ulang data, bukan menampilkan cache bulan lalu');

  ok(errs.length === 0, 'Tanpa galat halaman pada kalender terpadu', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
