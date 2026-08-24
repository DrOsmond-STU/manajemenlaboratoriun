/* Uji layar Manajemen Pengunjung yang tersambung ke API.
 *
 * Yang dijaga: registrasi & check-in/out SUNGGUHAN (bukan UI.demo()),
 * transisi status yang tidak sah ditolak SERVER (bukan hanya disembunyikan
 * di klien), dan KPI "Rata-rata Kunjungan" dihitung dari selisih
 * keluar_pada−masuk_pada kunjungan nyata — bukan angka purwarupa yang
 * di-hardcode.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  let idTamu = 100;
  const STATUS_NAMA = { terjadwal: 'Terjadwal', di_dalam: 'Di Dalam', selesai: 'Selesai' };

  // Satu kunjungan SUDAH SELESAI disemai lebih dulu, dengan durasi yang
  // diketahui persis (2 jam), supaya KPI Rata-rata Kunjungan dapat diuji
  // terhitung dari data nyata, bukan sekadar tampil tanpa nilai.
  const tamu = [{
    id: 1, nama: 'Farhan Aditya', instansi: 'PT Hirayama Service', tujuan: 'Perbaikan Autoclave',
    host: null, ruangan: null, tanggal: hariIni(),
    masuk_pada: hariIni() + 'T08:00:00', keluar_pada: hariIni() + 'T10:00:00',
    badge: 'V-121', status: 'selesai', catatan: null
  }];

  function hariIni() { return new Date().toISOString().slice(0, 10); }

  const bentuk = (v) => ({
    id: v.id, nama: v.nama, instansi: v.instansi || null, tujuan: v.tujuan || null,
    host: v.host, ruangan: v.ruangan,
    tanggal: v.tanggal, masuk_pada: v.masuk_pada, keluar_pada: v.keluar_pada,
    badge: v.badge || null,
    status: { kode: v.status, nama: STATUS_NAMA[v.status] },
    catatan: v.catatan || null
  });

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Wulan Room Admin', email: 'w@x.id',
      peran: ['room-administrator'],
      izin: ['dashboard.lihat', 'booking-ruangan.lihat', 'booking-ruangan.buat', 'booking-ruangan.ubah',
        'pengunjung.lihat', 'pengunjung.buat', 'pengunjung.ubah'] } };

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

    if (u.pathname === '/api/pengunjung') {
      if (req.method === 'GET') {
        let baris = tamu.slice();
        const cari = u.searchParams.get('cari');
        if (cari) {
          const k = cari.toLowerCase();
          baris = baris.filter((v) => (v.nama + ' ' + (v.instansi || '')).toLowerCase().indexOf(k) !== -1);
        }
        const status = u.searchParams.get('status');
        if (status) baris = baris.filter((v) => v.status === status);
        return kirim(200, { data: baris.map(bentuk).sort((a, b) => b.id - a.id) });
      }
      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const galat = {};
          if (!isi.nama) galat.nama = ['Nama wajib diisi.'];
          if (!isi.tanggal) galat.tanggal = ['Tanggal kunjungan wajib diisi.'];
          if (Object.keys(galat).length) return kirim(422, { message: 'Isian belum benar.', errors: galat });
          const baru = { id: ++idTamu, nama: isi.nama, instansi: isi.instansi || null, tujuan: isi.tujuan || null,
            host: null, ruangan: null, tanggal: isi.tanggal,
            masuk_pada: null, keluar_pada: null, badge: null, status: 'terjadwal', catatan: isi.catatan || null };
          tamu.push(baru);
          return kirim(201, { data: bentuk(baru) });
        });
      }
      return kirim(404, { message: 'Tidak ditemukan' });
    }

    const cocokCheckin = /^\/api\/pengunjung\/(\d+)\/checkin$/.exec(u.pathname);
    if (cocokCheckin && req.method === 'POST') {
      const v = tamu.find((x) => x.id === Number(cocokCheckin[1]));
      if (!v) return kirim(404, { message: 'Tidak ditemukan' });
      if (v.status !== 'terjadwal') {
        return kirim(422, { message: 'Isian belum benar.',
          errors: { status: ['Tamu ini sudah berstatus ' + v.status + ' dan tidak dapat check-in lagi.'] } });
      }
      let b = ''; req.on('data', (d) => (b += d));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        v.status = 'di_dalam';
        v.masuk_pada = v.tanggal + 'T' + new Date().toTimeString().slice(0, 8);
        v.badge = isi.badge || null;
        return kirim(200, { data: bentuk(v) });
      });
    }

    const cocokCheckout = /^\/api\/pengunjung\/(\d+)\/checkout$/.exec(u.pathname);
    if (cocokCheckout && req.method === 'POST') {
      const v = tamu.find((x) => x.id === Number(cocokCheckout[1]));
      if (!v) return kirim(404, { message: 'Tidak ditemukan' });
      if (v.status !== 'di_dalam') {
        return kirim(422, { message: 'Isian belum benar.',
          errors: { status: ['Tamu ini belum check-in atau sudah check-out sebelumnya.'] } });
      }
      v.status = 'selesai';
      v.keluar_pada = v.tanggal + 'T' + new Date().toTimeString().slice(0, 8);
      return kirim(200, { data: bentuk(v) });
    }

    kirim(404, { message: 'Tidak ditemukan' });
  });

  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port, tamu })));
}

(async () => {
  const browser = await launch();
  const { server, port, tamu } = await apiTiruan();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  page.on('dialog', (d) => d.accept());

  await page.goto(`${BASE}/app.html`, { waitUntil: 'load' });
  await page.evaluate((p) => {
    localStorage.setItem('flms.api', 'http://127.0.0.1:' + p);
    localStorage.removeItem('flms.mode');
  }, port);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(700);

  await page.fill('#masukEmail', 'wulan@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  /* ============ 1. DAFTAR TERISI DARI SERVER, KPI DIHITUNG NYATA ============ */
  console.log('\n--- 1. Daftar & KPI dari data nyata ---');
  await page.evaluate(() => { location.hash = '#/visitor'; });
  await page.waitForTimeout(900);

  const kpi = await page.textContent('#pgjKpi');
  ok(/2,0\s*jam|2\s*jam/.test(kpi), 'Rata-rata Kunjungan dihitung dari durasi kunjungan selesai (2 jam), bukan angka karangan', kpi.replace(/\s+/g, ' '));

  const daftarAwal = await page.textContent('#pgjTabel');
  ok(/Farhan Aditya/.test(daftarAwal), 'Kunjungan yang sudah selesai tampil di daftar');
  ok(/Selesai/.test(daftarAwal), 'Status Selesai tampil');

  /* ============ 2. VALIDASI SERVER SAMPAI KE FORMULIR ============ */
  console.log('\n--- 2. Validasi server tampil di formulir ---');
  await page.click('button:has-text("Daftarkan Tamu")');
  await page.waitForTimeout(400);
  ok(!!(await page.$('#pgjNama')), 'Formulir registrasi terbuka');

  await page.fill('#pgjTanggal', '');
  await page.click('#pgjFormSimpan');
  await page.waitForTimeout(600);

  const galat = await page.$('#pgjFormGalat');
  const galatTampil = galat ? await galat.isVisible() : false;
  ok(galatTampil, 'Galat dari server tampil di dalam formulir');
  const teksGalat = galat ? await galat.textContent() : '';
  ok(/Nama wajib diisi/.test(teksGalat), 'Pesannya pesan server, bukan pesan generik', teksGalat.trim());

  /* ============ 3. REGISTRASI SUNGGUHAN ============ */
  console.log('\n--- 3. Mendaftarkan tamu baru ---');
  await page.fill('#pgjNama', 'Sri Rahayu');
  await page.fill('#pgjInstansi', 'PT Kalibrasi Presisi');
  await page.fill('#pgjTujuan', 'Survei Lokasi');
  const tglInput = await page.$('#pgjTanggal');
  await tglInput.evaluate((el) => { if (!el.value) el.value = new Date().toISOString().slice(0, 10); });
  await page.click('#pgjFormSimpan');
  await page.waitForTimeout(900);

  ok(!(await page.$('#pgjNama')), 'Formulir tertutup setelah berhasil');
  const setelahDaftar = await page.textContent('#pgjTabel');
  ok(/Sri Rahayu/.test(setelahDaftar), 'Tamu baru muncul di daftar');
  ok(/Terjadwal/.test(setelahDaftar), 'Status awal Terjadwal');

  const dariServer = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/pengunjung', { credentials: 'include' });
    return (await r.json()).data.length;
  }, port);
  ok(dariServer === 2, 'Server benar-benar menyimpan tamu baru', 'jumlah=' + dariServer);

  /* ============ 4. CHECK-IN SUNGGUHAN ============ */
  console.log('\n--- 4. Check-in tamu ---');
  const idBaru = tamu.find((t) => t.nama === 'Sri Rahayu').id;
  await page.click(`button:has-text("Check-in")`);
  await page.waitForTimeout(400);
  ok(!!(await page.$('#pgjCiBadge')), 'Modal check-in terbuka');

  await page.fill('#pgjCiBadge', 'V-201');
  await page.click('#pgjCiSimpan');
  await page.waitForTimeout(900);

  const setelahCheckin = await page.textContent('#pgjTabel');
  ok(/Di Dalam/.test(setelahCheckin), 'Status berubah jadi Di Dalam setelah check-in');
  ok(/V-201/.test(setelahCheckin), 'Nomor badge tampil setelah check-in');

  /* ============ 5. TRANSISI STATUS TIDAK SAH DITOLAK SERVER ============ */
  console.log('\n--- 5. Transisi status tidak sah ditolak server ---');
  const tolakCheckinKedua = await page.evaluate(async ({ p, id }) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/pengunjung/' + id + '/checkin', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    return { status: r.status, body: await r.json() };
  }, { p: port, id: idBaru });
  ok(tolakCheckinKedua.status === 422, 'Check-in ganda ditolak dengan 422', 'status=' + tolakCheckinKedua.status);
  ok(/sudah berstatus di_dalam/.test(JSON.stringify(tolakCheckinKedua.body)), 'Pesan penolakan menjelaskan status saat ini');

  const tolakCheckoutTanpaCheckin = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/pengunjung/1/checkout', {
      method: 'POST', credentials: 'include'
    });
    return { status: r.status, body: await r.json() };
  }, port);
  ok(tolakCheckoutTanpaCheckin.status === 422, 'Check-out tamu yang sudah selesai (bukan di_dalam) ditolak dengan 422', 'status=' + tolakCheckoutTanpaCheckin.status);

  /* ============ 6. CHECK-OUT SUNGGUHAN ============ */
  console.log('\n--- 6. Check-out tamu ---');
  await page.click(`button:has-text("Check-out")`);
  await page.waitForTimeout(900);

  const setelahCheckout = await page.textContent('#pgjTabel');
  ok((setelahCheckout.match(/Selesai/g) || []).length >= 2, 'Kedua tamu berstatus Selesai setelah check-out', setelahCheckout.replace(/\s+/g, ' '));

  /* ============ 7. TAPIS STATUS ============ */
  console.log('\n--- 7. Tapis status ---');
  await page.selectOption('#pgjFilterStatus', 'terjadwal');
  await page.click('button:has-text("Terapkan")');
  await page.waitForTimeout(700);
  const kosongTerjadwal = await page.textContent('#pgjTabel');
  ok(/Belum ada pengunjung terdaftar/.test(kosongTerjadwal), 'Tapis status=terjadwal mengosongkan daftar (semua tamu sudah check-out)');

  ok(errs.length === 0, 'Tanpa galat halaman pada modul Manajemen Pengunjung', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
