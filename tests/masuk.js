/* Uji gerbang masuk, mode data, dan penghubung API.
 *
 * Yang dijaga di sini bukan tampilannya, melainkan dua janji yang bila
 * dilanggar merugikan orang tanpa mereka sadari:
 *
 *   1. Data contoh TIDAK PERNAH tampil tanpa spanduk. Purwarupa ini berisi
 *      angka yang meyakinkan; menampilkannya diam-diam berarti seseorang
 *      mengambil keputusan di atas angka karangan.
 *   2. Layar masuk MENGGANTIKAN aplikasi, bukan menutupinya. Menu yang masih
 *      terpasang di DOM di belakang modal sudah memberi tahu orang yang belum
 *      masuk apa saja yang ada di dalam.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

/** Server API tiruan, supaya jalur "tersambung" benar-benar diuji. */
function apiTiruan(keadaan) {
  const http = require('http');
  let sesi = keadaan === 'masuk';

  const server = http.createServer((req, res) => {
    const asal = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', asal);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (kode, isi) => {
      res.writeHead(kode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(isi));
    };

    const pengguna = {
      data: {
        id: 1, nama: 'Siti Aminah', email: 'siti@instansi.go.id',
        peran: ['facility-manager'],
        izin: ['dashboard.lihat', 'aset.lihat', 'booking-ruangan.lihat']
      }
    };

    if (req.url.startsWith('/sanctum/csrf-cookie')) {
      res.setHeader('Set-Cookie', 'XSRF-TOKEN=token-uji; Path=/; SameSite=Lax');
      res.writeHead(204); return res.end();
    }
    if (req.url.startsWith('/api/saya')) {
      return sesi ? kirim(200, pengguna) : kirim(401, { message: 'Unauthenticated.' });
    }
    if (req.url.startsWith('/api/masuk')) {
      let body = '';
      req.on('data', (d) => (body += d));
      return req.on('end', () => {
        const isi = JSON.parse(body || '{}');
        if (isi.password === 'sandi-benar') { sesi = true; return kirim(200, pengguna); }
        return kirim(422, {
          message: 'Surel atau kata sandi tidak cocok.',
          errors: { email: ['Surel atau kata sandi tidak cocok.'] }
        });
      });
    }
    if (req.url.startsWith('/api/keluar')) { sesi = false; return kirim(200, { pesan: 'ok' }); }

    kirim(404, { message: 'Tidak ditemukan' });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

(async () => {
  const browser = await launch();

  /* ============ 1. TANPA API — MODE DATA CONTOH ============ */
  console.log('\n--- 1. Tanpa API: mode data contoh ---');
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

    await page.goto(`${BASE}/app.html`, { waitUntil: 'load' });
    await page.waitForTimeout(600);

    const spanduk = await page.$('.mode-banner');
    ok(!!spanduk, 'Spanduk mode data contoh tampil');

    const teks = spanduk ? await spanduk.innerText() : '';
    ok(/DATA CONTOH/i.test(teks), 'Spanduk menyebut tegas bahwa datanya contoh');
    ok(/keputusan/i.test(teks), 'Spanduk memperingatkan agar tidak dipakai mengambil keputusan');

    // Spanduk yang bisa ditutup akan ditutup pada menit pertama lalu tidak
    // pernah terlihat lagi — persis ketika ia paling dibutuhkan.
    const adaTombolTutup = spanduk
      ? await spanduk.$$eval('button,[onclick],.close,.x', (e) => e.length)
      : 0;
    ok(adaTombolTutup === 0, 'Spanduk tidak dapat ditutup');

    const adaSidebar = await page.$('.sidebar');
    ok(!!adaSidebar, 'Purwarupa tetap dapat ditelusuri dalam mode data contoh');

    ok(errs.length === 0, 'Tanpa galat konsol', errs.join(' | '));
    await page.close();
  }

  /* ============ 2. API HIDUP, BELUM MASUK ============ */
  console.log('\n--- 2. API hidup, belum masuk ---');
  const { server, port } = await apiTiruan('tamu');
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));

    await page.goto(`${BASE}/app.html`, { waitUntil: 'load' });
    await page.evaluate((p) => localStorage.setItem('flms.api', 'http://127.0.0.1:' + p), port);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(700);

    ok(!!(await page.$('#formMasuk')), 'Layar masuk tampil');
    ok(!(await page.$('.mode-banner')), 'Tidak ada spanduk data contoh saat API terjangkau');

    // Inti butir 2 di kepala berkas: kerangka aplikasi tidak boleh ada sama
    // sekali di DOM sebelum masuk.
    ok(!(await page.$('.sidebar')), 'Menu aplikasi tidak ada di DOM sebelum masuk');
    ok(!(await page.$('#content')), 'Isi halaman tidak ada di DOM sebelum masuk');

    const html = await page.content();
    ok(html.indexOf('Balanced Scorecard') === -1,
      'Nama modul tidak bocor ke halaman masuk');

    /* --- sandi salah --- */
    await page.fill('#masukEmail', 'siti@instansi.go.id');
    await page.fill('#masukSandi', 'sandi-salah');
    await page.click('#masukTombol');
    await page.waitForTimeout(500);

    const galat = await page.$('#masukGalat');
    const galatTampil = galat ? await galat.isVisible() : false;
    ok(galatTampil, 'Sandi salah menampilkan pesan galat');
    ok(!!(await page.$('#formMasuk')), 'Tetap di layar masuk setelah gagal');

    const sandiTersisa = await page.$eval('#masukSandi', (e) => e.value);
    ok(sandiTersisa === '', 'Medan sandi dikosongkan setelah gagal');

    /* --- sandi benar --- */
    await page.fill('#masukSandi', 'sandi-benar');
    await page.click('#masukTombol');
    await page.waitForTimeout(900);

    ok(!(await page.$('#formMasuk')), 'Layar masuk hilang setelah berhasil');
    ok(!!(await page.$('.sidebar')), 'Aplikasi terpasang setelah masuk');

    const nama = await page.$eval('.userchip .nm b', (e) => e.textContent.trim());
    ok(nama === 'Siti Aminah', 'Nama dari server dipakai, bukan nama purwarupa', nama);

    const peran = await page.$eval('#userRole', (e) => e.textContent.trim());
    ok(peran === 'Facility Manager', 'Peran dari server diterjemahkan terbaca', peran);

    ok(!(await page.$('.mode-banner')), 'Tidak ada spanduk data contoh setelah masuk');

    /* --- izin --- */
    const izin = await page.evaluate(() => [
      API.boleh('dashboard.lihat'),
      API.boleh('penyewaan.hapus')
    ]);
    ok(izin[0] === true && izin[1] === false, 'Izin dibaca dari server, bukan diasumsikan');

    ok(errs.length === 0, 'Tanpa galat halaman', errs.join(' | '));

    /* --- sesi bertahan saat dimuat ulang --- */
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(800);
    ok(!(await page.$('#formMasuk')), 'Sesi bertahan setelah halaman dimuat ulang');

    await page.close();
  }

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
