/* Uji layar Peserta Event yang tersambung ke API.
 *
 * Yang dijaga: layar memilih SATU event sungguhan (dari Repo.acara yang
 * sudah tersambung) lebih dulu, lalu registrasi & absensi peserta event
 * itu benar-benar lewat API — bukan daftar peserta lintas-event yang
 * dikarang seperti purwarupa lama (KPI "380 peserta" untuk setiap event).
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  let idPeserta = 0;
  const STATUS_NAMA = { terdaftar: 'Terdaftar', hadir: 'Hadir', tidak_hadir: 'Tidak hadir' };

  const acara = [
    { id: 1, nama: 'National Tech Summit 2026', jenis: 'Konferensi', organizer: 'Divisi Pemasaran', pic: null, ruangan: null, tanggal: hariIni(), jumlah_peserta: 380, anggaran: 285000000, status: { kode: 'terkonfirmasi', nama: 'Terkonfirmasi' }, catatan: null }
  ];
  const peserta = [
    { id: 1, event_id: 1, nama: 'Siti Nurhaliza', instansi: 'Divisi Pemasaran', email: 'siti@internal.co.id', telepon: '0812-1122-330', status: 'hadir', hadir_pada: hariIni() + 'T08:12:00', catatan: null }
  ];

  function hariIni() { return new Date().toISOString().slice(0, 10); }

  const bentuk = (p) => ({
    id: p.id, event_id: p.event_id, nama: p.nama, instansi: p.instansi || null,
    email: p.email || null, telepon: p.telepon || null,
    status: { kode: p.status, nama: STATUS_NAMA[p.status] },
    hadir_pada: p.hadir_pada || null, catatan: p.catatan || null
  });

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Wulan Room Admin', email: 'w@x.id',
      peran: ['facility-manager'],
      izin: ['dashboard.lihat', 'booking-ruangan.lihat', 'booking-ruangan.buat', 'booking-ruangan.ubah', 'acara.lihat'] } };

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

    if (u.pathname === '/api/acara') return kirim(200, { data: acara });

    const cocokList = /^\/api\/acara\/(\d+)\/peserta$/.exec(u.pathname);
    if (cocokList) {
      const eventId = Number(cocokList[1]);
      if (req.method === 'GET') {
        let baris = peserta.filter((p) => p.event_id === eventId);
        const cari = u.searchParams.get('cari');
        if (cari) {
          const k = cari.toLowerCase();
          baris = baris.filter((p) => (p.nama + ' ' + (p.instansi || '')).toLowerCase().indexOf(k) !== -1);
        }
        const status = u.searchParams.get('status');
        if (status) baris = baris.filter((p) => p.status === status);
        return kirim(200, { data: baris.map(bentuk) });
      }
      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          if (!isi.nama) return kirim(422, { message: 'Isian belum benar.', errors: { nama: ['Nama wajib diisi.'] } });
          const baru = { id: ++idPeserta, event_id: eventId, nama: isi.nama, instansi: isi.instansi || null, email: isi.email || null, telepon: isi.telepon || null, status: 'terdaftar', hadir_pada: null, catatan: null };
          peserta.push(baru);
          return kirim(201, { data: bentuk(baru) });
        });
      }
    }

    const cocokHadir = /^\/api\/peserta-event\/(\d+)\/hadir$/.exec(u.pathname);
    if (cocokHadir && req.method === 'POST') {
      const p = peserta.find((x) => x.id === Number(cocokHadir[1]));
      if (!p) return kirim(404, { message: 'Tidak ditemukan' });
      if (p.status !== 'terdaftar') {
        return kirim(422, { message: 'Isian belum benar.', errors: { status: ['Peserta ini sudah berstatus ' + p.status + '.'] } });
      }
      p.status = 'hadir'; p.hadir_pada = new Date().toISOString();
      return kirim(200, { data: bentuk(p) });
    }

    const cocokTidakHadir = /^\/api\/peserta-event\/(\d+)\/tidak-hadir$/.exec(u.pathname);
    if (cocokTidakHadir && req.method === 'POST') {
      const p = peserta.find((x) => x.id === Number(cocokTidakHadir[1]));
      if (!p) return kirim(404, { message: 'Tidak ditemukan' });
      if (p.status !== 'terdaftar') {
        return kirim(422, { message: 'Isian belum benar.', errors: { status: ['Peserta ini sudah berstatus ' + p.status + '.'] } });
      }
      p.status = 'tidak_hadir';
      return kirim(200, { data: bentuk(p) });
    }

    kirim(404, { message: 'Tidak ditemukan' });
  });

  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port, peserta })));
}

(async () => {
  const browser = await launch();
  const { server, port, peserta } = await apiTiruan();
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

  await page.fill('#masukEmail', 'wulan@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  /* ============ 1. EVENT SUNGGUHAN OTOMATIS TERPILIH ============ */
  console.log('\n--- 1. Event sungguhan otomatis terpilih ---');
  await page.evaluate(() => { location.hash = '#/participant'; });
  await page.waitForTimeout(900);

  const pemilih = await page.textContent('#pstPemilihAcara');
  ok(/National Tech Summit 2026/.test(pemilih), 'Pemilih event terisi dari Repo.acara sungguhan');

  const tabel = await page.textContent('#pstTabel');
  ok(/Siti Nurhaliza/.test(tabel), 'Peserta event yang dipilih tampil');
  ok(/Hadir/.test(tabel), 'Status Hadir tampil');

  const kpi = await page.textContent('#pstKpi');
  ok(/100/.test(kpi), 'Tingkat Kehadiran dihitung sungguhan (1 dari 1 yang diputuskan = 100%), bukan angka karangan purwarupa');

  /* ============ 2. VALIDASI SERVER SAMPAI KE FORMULIR ============ */
  console.log('\n--- 2. Validasi server tampil di formulir ---');
  await page.click('button:has-text("Daftarkan Peserta")');
  await page.waitForTimeout(400);
  ok(!!(await page.$('#pstNama')), 'Formulir registrasi terbuka');

  await page.click('#pstFormSimpan');
  await page.waitForTimeout(600);
  const galat = await page.$('#pstFormGalat');
  const galatTampil = galat ? await galat.isVisible() : false;
  ok(galatTampil, 'Galat dari server tampil di dalam formulir');

  /* ============ 3. REGISTRASI SUNGGUHAN ============ */
  console.log('\n--- 3. Mendaftarkan peserta baru ---');
  await page.fill('#pstNama', 'Bayu Prakoso');
  await page.fill('#pstInstansi', 'PT Anugerah Sejahtera');
  await page.click('#pstFormSimpan');
  await page.waitForTimeout(900);

  ok(!(await page.$('#pstNama')), 'Formulir tertutup setelah berhasil');
  const setelahDaftar = await page.textContent('#pstTabel');
  ok(/Bayu Prakoso/.test(setelahDaftar), 'Peserta baru muncul di daftar');
  ok(/Terdaftar/.test(setelahDaftar), 'Status awal Terdaftar');

  /* ============ 4. TANDAI HADIR ============ */
  console.log('\n--- 4. Tandai hadir ---');
  const idBaru = peserta.find((p) => p.nama === 'Bayu Prakoso').id;
  await page.click('button:has-text("Hadir")');
  await page.waitForTimeout(900);

  const setelahHadir = await page.textContent('#pstTabel');
  ok((setelahHadir.match(/Hadir/g) || []).length >= 2, 'Kedua peserta berstatus Hadir setelah ditandai');

  /* ============ 5. TRANSISI TIDAK SAH DITOLAK SERVER ============ */
  console.log('\n--- 5. Transisi tidak sah ditolak server ---');
  const tolak = await page.evaluate(async ({ p, id }) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/peserta-event/' + id + '/hadir', { method: 'POST', credentials: 'include' });
    return { status: r.status };
  }, { p: port, id: idBaru });
  ok(tolak.status === 422, 'Menandai hadir ganda ditolak 422', 'status=' + tolak.status);

  ok(errs.length === 0, 'Tanpa galat halaman pada modul Peserta Event', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
