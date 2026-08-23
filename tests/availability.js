/* Uji layar Room Availability yang tersambung ke API.
 *
 * Yang dijaga: papan ketersediaan memakai DUA endpoint yang sudah ada
 * (Repo.ruangan + Repo.booking dengan sejak/sampai/hanya_aktif) — bukan
 * endpoint baru — dan KPI "Booked/Pending/Reserved" purwarupa (status
 * ruangan yang dipecah jadi lima label) sudah tidak lagi tampil, diganti
 * metrik yang genuinely dihitung dari booking hari terpilih.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;

  const ROOMS = [
    { id: 1, kode: 'RM-001', nama: 'Ruang Rapat Garuda', jenis: 'Meeting Room', gedung: 'Gedung A', kapasitas: 20, status: { kode: 'tersedia', nama: 'Tersedia' } },
    { id: 2, kode: 'RM-002', nama: 'Auditorium Utama', jenis: 'Auditorium', gedung: 'Gedung B', kapasitas: 200, status: { kode: 'pemeliharaan', nama: 'Pemeliharaan' } }
  ];

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Rahmat Facility', email: 'r@x.id',
      peran: ['facility-manager'], izin: ['booking-ruangan.lihat'] } };

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

    if (u.pathname === '/api/rooms') {
      return kirim(200, { data: ROOMS, meta: { total: ROOMS.length } });
    }

    if (u.pathname === '/api/bookings') {
      ok(u.searchParams.get('hanya_aktif') === '1', 'Daftar booking diminta dengan hanya_aktif=1 — bukan menghitung sendiri di peramban');
      const hariIni = new Date().toISOString().slice(0, 10);
      // Tanpa akhiran zona waktu — diuraikan sebagai waktu LOKAL oleh mesin
      // yang sama (peramban headless & proses uji berjalan di host yang
      // sama), sehingga jamnya konsisten dengan HOURS (07–19) di kedua
      // sisi tanpa bergantung pada zona waktu produksi (WIB) yang berbeda
      // dari zona waktu kontainer uji ini.
      return kirim(200, { data: [
        { id: 501, keperluan: 'Rapat Koordinasi Tahunan', mulai: hariIni + 'T09:00:00', selesai: hariIni + 'T11:00:00',
          status: { kode: 'disetujui', nama: 'Disetujui', memblokir: true }, ruangan: { id: 1, kode: 'RM-001', nama: 'Ruang Rapat Garuda' },
          pemohon: { id: 5, nama: 'Rina Teknisi' }, catatan: null, persetujuan: {} },
        { id: 502, keperluan: 'Sosialisasi SOP Baru', mulai: hariIni + 'T13:00:00', selesai: hariIni + 'T15:00:00',
          status: { kode: 'menunggu', nama: 'Menunggu Persetujuan', memblokir: true }, ruangan: { id: 1, kode: 'RM-001', nama: 'Ruang Rapat Garuda' },
          pemohon: { id: 6, nama: 'Andi Teknisi' }, catatan: null, persetujuan: {} }
      ], meta: { total: 2 } });
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

  console.log('\n--- 1. Room Availability ---');
  await page.evaluate(() => { location.hash = '#/availability'; });
  await page.waitForTimeout(1000);

  const host = await page.textContent('#avlHost');
  ok(/Ruang Rapat Garuda/.test(host), 'Ruangan sungguhan tampil di timeline');
  ok(/Auditorium Utama/.test(host), 'Ruangan kedua tampil');
  ok(/Rapat Koordinasi Tahunan/.test(host), 'Booking sungguhan tampil sebagai blok timeline');
  ok(/Pemeliharaan/.test(host), 'Ruangan berstatus pemeliharaan ditandai di timeline');

  const kpi = await page.textContent('#avlKpi');
  ok(/Tersedia Sekarang/.test(kpi), 'KPI baru "Tersedia Sekarang" tampil');
  ok(/Menunggu Persetujuan/.test(kpi) && /\b1\b/.test(kpi), 'KPI "Menunggu Persetujuan" dihitung dari booking sungguhan — 1 booking berstatus menunggu');
  ok(!/\bBooked\b/.test(kpi) && !/\bPending\b/.test(kpi) && !/\bReserved\b/.test(kpi), 'KPI status ruangan purwarupa (Booked/Pending/Reserved) tidak lagi tampil');

  console.log('\n--- 2. Detail booking dari blok timeline ---');
  await page.click('.tl-block');
  await page.waitForTimeout(600);
  const drawer = await page.textContent('.drawer, body');
  ok(/Rapat Koordinasi Tahunan/.test(drawer) || /Sosialisasi SOP Baru/.test(drawer), 'Klik blok timeline membuka detail booking sungguhan (bukan purwarupa)');
  ok(!/Detail tidak tersedia pada purwarupa/.test(drawer), 'Bukan fallback purwarupa — showBooking menemukan barisnya');

  ok(errs.length === 0, 'Tanpa galat halaman pada Room Availability', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
