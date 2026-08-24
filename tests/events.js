/* Uji layar Manajemen Event yang tersambung ke API.
 *
 * Yang dijaga: CRUD sungguhan (bukan UI.demo()), status selalu mulai dari
 * 'direncanakan' terlepas apa yang dikirim klien saat pendaftaran, KPI
 * dihitung dari baris sungguhan (bukan "Vendor Terlibat" yang menghitung
 * seluruh katalog vendor tanpa kaitan ke event), dan event batal ditandai
 * status — bukan dihapus.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  let idAcara = 0;
  const acara = [];
  const orang = [{ id: 1, nama: 'Wulan Room Admin', unit_kerja: 'Umum & Fasilitas' }];
  const ruang = [{ id: 1, kode: 'RM-005', nama: 'Auditorium Wijaya Kusuma' }];
  const STATUS_NAMA = { direncanakan: 'Direncanakan', terkonfirmasi: 'Terkonfirmasi', berlangsung: 'Sedang berlangsung', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };

  const bentuk = (e) => ({
    id: e.id, nama: e.nama, jenis: e.jenis || null, organizer: e.organizer || null,
    pic: e.pic_id ? { id: Number(e.pic_id), nama: (orang.find((o) => o.id === Number(e.pic_id)) || {}).nama || null } : null,
    ruangan: e.room_id ? { id: Number(e.room_id), kode: (ruang.find((r) => r.id === Number(e.room_id)) || {}).kode, nama: (ruang.find((r) => r.id === Number(e.room_id)) || {}).nama } : null,
    tanggal: e.tanggal, jumlah_peserta: e.jumlah_peserta === undefined ? null : e.jumlah_peserta,
    anggaran: e.anggaran === undefined ? null : e.anggaran,
    status: { kode: e.status, nama: STATUS_NAMA[e.status] },
    catatan: e.catatan || null
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
      izin: ['dashboard.lihat', 'booking-ruangan.lihat', 'booking-ruangan.buat', 'booking-ruangan.ubah',
        'acara.lihat', 'acara.buat', 'acara.ubah', 'master-data.lihat'] } };

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

    if (u.pathname === '/api/pengguna') return kirim(200, { data: orang });
    if (u.pathname === '/api/rooms') return kirim(200, { data: ruang, meta: { total: ruang.length } });

    if (u.pathname === '/api/acara') {
      if (req.method === 'GET') {
        let baris = acara.slice();
        const cari = u.searchParams.get('cari');
        if (cari) {
          const k = cari.toLowerCase();
          baris = baris.filter((e) => (e.nama + ' ' + (e.organizer || '')).toLowerCase().indexOf(k) !== -1);
        }
        const status = u.searchParams.get('status');
        if (status) baris = baris.filter((e) => e.status === status);
        const jenis = u.searchParams.get('jenis');
        if (jenis) baris = baris.filter((e) => e.jenis === jenis);
        return kirim(200, { data: baris.map(bentuk).sort((a, b) => b.id - a.id) });
      }
      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const galat = {};
          if (!isi.nama) galat.nama = ['Nama wajib diisi.'];
          if (!isi.tanggal) galat.tanggal = ['Tanggal wajib diisi.'];
          if (isi.anggaran !== undefined && isi.anggaran !== null && isi.anggaran < 0) galat.anggaran = ['Anggaran tidak boleh negatif.'];
          if (Object.keys(galat).length) return kirim(422, { message: 'Isian belum benar.', errors: galat });
          isi.id = ++idAcara;
          isi.status = 'direncanakan'; // status klien SENGAJA diabaikan, sama seperti server sungguhan
          acara.push(isi);
          return kirim(201, { data: bentuk(isi) });
        });
      }
      return kirim(404, { message: 'Tidak ditemukan' });
    }

    const cocok = /^\/api\/acara\/(\d+)$/.exec(u.pathname);
    if (cocok && req.method === 'PUT') {
      const e = acara.find((x) => x.id === Number(cocok[1]));
      if (!e) return kirim(404, { message: 'Tidak ditemukan' });
      let b = ''; req.on('data', (d) => (b += d));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        if (isi.status && !STATUS_NAMA[isi.status]) {
          return kirim(422, { message: 'Isian belum benar.', errors: { status: ['Status tidak dikenali.'] } });
        }
        Object.assign(e, isi);
        return kirim(200, { data: bentuk(e) });
      });
    }

    kirim(404, { message: 'Tidak ditemukan' });
  });

  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port, acara })));
}

(async () => {
  const browser = await launch();
  const { server, port, acara } = await apiTiruan();
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

  /* ============ 1. DAFTAR KOSONG ============ */
  console.log('\n--- 1. Basis data kosong ---');
  await page.evaluate(() => { location.hash = '#/events'; });
  await page.waitForTimeout(900);

  const kosong = await page.textContent('#acrTabel');
  ok(/Belum ada event terdaftar/.test(kosong), 'Basis data kosong ditampilkan apa adanya, bukan diisi data purwarupa');

  /* ============ 2. VALIDASI SERVER SAMPAI KE FORMULIR ============ */
  console.log('\n--- 2. Validasi server tampil di formulir ---');
  await page.click('button:has-text("Buat Event")');
  await page.waitForTimeout(500);
  ok(!!(await page.$('#acrNama')), 'Formulir buat event terbuka');
  ok(!!(await page.$('#acrPic')), 'Pemilih PIC terisi dari Repo.pengguna');
  ok(!!(await page.$('#acrRuangan')), 'Pemilih ruangan terisi dari Repo.ruangan');
  ok(!(await page.$('#acrStatus')), 'Status TIDAK ditampilkan saat membuat baru — selalu mulai dari Direncanakan');

  await page.fill('#acrTanggal', '');
  await page.click('#acrFormSimpan');
  await page.waitForTimeout(600);

  const galat = await page.$('#acrFormGalat');
  const galatTampil = galat ? await galat.isVisible() : false;
  ok(galatTampil, 'Galat dari server tampil di dalam formulir');
  const teksGalat = galat ? await galat.textContent() : '';
  ok(/Nama wajib diisi/.test(teksGalat), 'Pesannya pesan server, bukan pesan generik', teksGalat.trim());

  /* ============ 3. MEMBUAT EVENT SUNGGUHAN ============ */
  console.log('\n--- 3. Membuat event ---');
  await page.fill('#acrNama', 'National Tech Summit 2026');
  await page.fill('#acrJenis', 'Konferensi');
  await page.fill('#acrOrganizer', 'Divisi Pemasaran');
  await page.selectOption('#acrPic', '1');
  await page.selectOption('#acrRuangan', '1');
  const tglInput = await page.$('#acrTanggal');
  await tglInput.evaluate((el) => { if (!el.value) el.value = new Date().toISOString().slice(0, 10); });
  await page.fill('#acrPeserta', '380');
  await page.fill('#acrAnggaran', '285000000');
  await page.click('#acrFormSimpan');
  await page.waitForTimeout(900);

  ok(!(await page.$('#acrNama')), 'Formulir tertutup setelah berhasil');
  const setelahBuat = await page.textContent('#acrTabel');
  ok(/National Tech Summit 2026/.test(setelahBuat), 'Event baru muncul di daftar');
  ok(/Wulan Room Admin/.test(setelahBuat), 'PIC tampil');
  ok(/Auditorium Wijaya Kusuma/.test(setelahBuat), 'Venue tampil');
  ok(/Direncanakan/.test(setelahBuat), 'Status awal selalu Direncanakan, terlepas input klien');

  const dariServer = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/acara', { credentials: 'include' });
    return (await r.json()).data.length;
  }, port);
  ok(dariServer === 1, 'Server benar-benar menyimpan satu event', 'jumlah=' + dariServer);

  const kpi = await page.textContent('#acrKpi');
  ok(/380/.test(kpi), 'KPI Total Peserta dihitung dari baris sungguhan');
  ok(!/Vendor Terlibat/.test(kpi), 'KPI "Vendor Terlibat" purwarupa (non-sequitur) tidak lagi tampil');

  /* ============ 4. UBAH STATUS — BUKAN HAPUS ============ */
  console.log('\n--- 4. Ubah status event ---');
  const idBaru = acara[0].id;
  await page.click('#acrTabel .icon-btn');
  await page.waitForTimeout(500);
  ok(!!(await page.$('#acrStatus')), 'Pemilih status tampil saat mengubah event yang sudah ada');

  await page.selectOption('#acrStatus', 'dibatalkan');
  await page.click('#acrFormSimpan');
  await page.waitForTimeout(900);

  const setelahBatal = await page.textContent('#acrTabel');
  ok(/Dibatalkan/.test(setelahBatal), 'Status berubah jadi Dibatalkan setelah diedit');

  const tetapAda = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/acara', { credentials: 'include' });
    return (await r.json()).data.length;
  }, port);
  ok(tetapAda === 1, 'Baris event TETAP ADA setelah dibatalkan, bukan dihapus', 'jumlah=' + tetapAda);

  /* ============ 5. STATUS TIDAK DIKENAL DITOLAK SERVER ============ */
  console.log('\n--- 5. Status tidak sah ditolak server ---');
  const tolak = await page.evaluate(async ({ p, id }) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/acara/' + id, {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'bukan-status-sah' })
    });
    return { status: r.status };
  }, { p: port, id: idBaru });
  ok(tolak.status === 422, 'Status di luar daftar ditolak 422', 'status=' + tolak.status);

  ok(errs.length === 0, 'Tanpa galat halaman pada modul Manajemen Event', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
