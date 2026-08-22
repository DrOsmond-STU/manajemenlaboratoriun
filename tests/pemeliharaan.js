/* Uji Pemeliharaan & Kalibrasi yang tersambung ke API.
 *
 * Yang dijaga: satu tabel pemeliharaan sungguhan melayani dua layar
 * (Kalibrasi Alat, Maintenance & Work Order) — bukan dua sumber data
 * terpisah seperti purwarupa. Target boleh ruangan, laboratorium, atau
 * alat, tetapi kalibrasi hanya untuk alat (ditegakkan server, bukan hanya
 * disembunyikan di formulir). Alat yang kalibrasinya kedaluwarsa muncul
 * pada spanduk peringatan di layar Kalibrasi.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;

  const rooms = [{ id: 1, nama: 'Ruang Rapat Garuda', kode: 'RM-003' }];
  const labs = [{ id: 1, nama: 'Laboratorium Kimia Analitik', kode: 'LAB-001' }];
  const assets = [
    { id: 1, nama: 'Neraca Analitik', kode_internal: 'AST-000131' },
    { id: 2, nama: 'pH Meter', kode_internal: 'AST-000132' }
  ];
  const orang = [{ id: 1, nama: 'Budi Santoso', unit_kerja: 'Fasilitas' }];

  let idPml = 0;
  const pekerjaan = [];

  const JENIS_NAMA = { preventif: 'Pemeliharaan preventif', korektif: 'Pemeliharaan korektif', darurat: 'Penanganan darurat', kalibrasi: 'Kalibrasi' };
  const STATUS_NAMA = { dijadwalkan: 'Dijadwalkan', berjalan: 'Sedang dikerjakan', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };

  const sumberDaya = (p) => {
    if (p.room_id) return { jenis: 'ruangan', id: p.room_id, nama: rooms.find((r) => r.id === p.room_id).nama };
    if (p.laboratory_id) return { jenis: 'laboratorium', id: p.laboratory_id, nama: labs.find((l) => l.id === p.laboratory_id).nama };
    return { jenis: 'aset', id: p.asset_id, nama: assets.find((a) => a.id === p.asset_id).nama };
  };

  const bentukPml = (p) => ({
    id: p.id,
    jenis: { kode: p.jenis, nama: JENIS_NAMA[p.jenis] },
    status: { kode: p.status, nama: STATUS_NAMA[p.status] },
    jadwal: p.jadwal,
    dikerjakan_pada: p.dikerjakan_pada || null,
    terlambat: p.status !== 'selesai' && p.status !== 'dibatalkan' && p.jadwal < '2026-08-22',
    pelaksana: p.pelaksana || null,
    hasil: p.hasil || null,
    biaya: p.biaya || 0,
    kalibrasi: p.jenis === 'kalibrasi' ? {
      no_sertifikat: p.no_sertifikat || null,
      lembaga: p.lembaga_kalibrasi || null,
      berlaku_sampai: p.berlaku_sampai || null,
      kedaluwarsa: p.berlaku_sampai ? p.berlaku_sampai < '2026-08-22' : null
    } : undefined,
    sumber_daya: sumberDaya(p),
    petugas: p.petugas_id ? { id: p.petugas_id, nama: orang.find((o) => o.id === p.petugas_id).nama } : undefined,
    catatan: p.catatan || null
  });

  const punyaSesi = (req) => {
    const c = (req.headers.cookie || '').match(/flms_sesi=([^;]+)/);
    return !!c && sesiAktif.has(c[1]);
  };

  const server = http.createServer((req, res) => {
    const asal = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', asal);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Siti Aminah', email: 's@x.id',
      peran: ['facility-manager'], izin: ['pemeliharaan.lihat', 'pemeliharaan.ubah', 'kalibrasi.lihat', 'kalibrasi.ubah'] } };

    if (req.url.startsWith('/sanctum/csrf-cookie')) {
      res.setHeader('Set-Cookie', 'XSRF-TOKEN=t; Path=/; SameSite=Lax');
      res.writeHead(204); return res.end();
    }
    if (req.url.startsWith('/api/saya')) {
      return punyaSesi(req) ? kirim(200, pengguna) : kirim(401, { message: 'Unauthenticated.' });
    }
    if (req.url.startsWith('/api/masuk')) {
      let b = ''; req.on('data', (d) => (b += d));
      return req.on('end', () => {
        if (JSON.parse(b || '{}').password === 'sandi-benar') {
          const id = 'sesi' + (++urut); sesiAktif.add(id);
          res.setHeader('Set-Cookie', 'flms_sesi=' + id + '; Path=/; SameSite=Lax');
          return kirim(200, pengguna);
        }
        return kirim(422, { message: 'Tidak cocok.', errors: { email: ['Tidak cocok.'] } });
      });
    }
    if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });

    if (req.url.startsWith('/api/rooms')) return kirim(200, { data: rooms });
    if (req.url.startsWith('/api/laboratories')) return kirim(200, { data: labs });
    if (req.url.startsWith('/api/assets')) return kirim(200, { data: assets });
    if (req.url.startsWith('/api/pengguna')) return kirim(200, { data: orang });

    if (req.url.startsWith('/api/pemeliharaan/kalibrasi-kedaluwarsa')) {
      const lewat = pekerjaan.filter((p) => p.jenis === 'kalibrasi' && p.status !== 'selesai'
        && p.jadwal < '2026-08-22').map((p) => assets.find((a) => a.id === p.asset_id));
      return kirim(200, { data: lewat });
    }

    const cocokSelesai = req.url.match(/^\/api\/pemeliharaan\/(\d+)\/selesaikan/);
    if (cocokSelesai && req.method === 'POST') {
      const p = pekerjaan.find((x) => x.id === Number(cocokSelesai[1]));
      if (!p) return kirim(404, { message: 'Tidak ditemukan' });
      let b = ''; req.on('data', (x) => (b += x));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        if (p.jenis === 'kalibrasi' && (!isi.no_sertifikat || !isi.berlaku_sampai)) {
          return kirim(422, { message: 'x', errors: { no_sertifikat: ['Wajib diisi untuk kalibrasi.'] } });
        }
        Object.assign(p, isi, { status: 'selesai' });
        return kirim(200, { data: bentukPml(p) });
      });
    }

    const cocokSatu = req.url.match(/^\/api\/pemeliharaan\/(\d+)/);
    if (cocokSatu && req.method === 'GET') {
      const p = pekerjaan.find((x) => x.id === Number(cocokSatu[1]));
      return p ? kirim(200, { data: bentukPml(p) }) : kirim(404, { message: 'Tidak ditemukan' });
    }

    if (req.url.startsWith('/api/pemeliharaan')) {
      if (req.method === 'GET') {
        const u = new URL(req.url, 'http://x');
        let baris = pekerjaan;
        if (u.searchParams.get('jenis')) baris = baris.filter((p) => p.jenis === u.searchParams.get('jenis'));
        return kirim(200, { data: baris.map(bentukPml), meta: { total: baris.length } });
      }
      if (req.method === 'POST') {
        let b = ''; req.on('data', (x) => (b += x));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const terisi = ['room_id', 'laboratory_id', 'asset_id'].filter((k) => isi[k]);
          if (terisi.length !== 1) {
            return kirim(422, { message: 'x', errors: { asset_id: ['Pilih tepat satu: ruangan, laboratorium, atau alat.'] } });
          }
          if (isi.jenis === 'kalibrasi' && !isi.asset_id) {
            return kirim(422, { message: 'x', errors: { asset_id: ['Kalibrasi hanya berlaku untuk alat, bukan ruangan atau laboratorium.'] } });
          }
          const p = { id: ++idPml, status: 'dijadwalkan', ...isi };
          pekerjaan.push(p);
          return kirim(201, { data: bentukPml(p) });
        });
      }
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

  /* ============ 1. MAINTENANCE KOSONG ============ */
  console.log('\n--- 1. Maintenance & Work Order ---');
  await page.evaluate(() => { location.hash = '#/maintenance'; });
  await page.waitForTimeout(700);
  ok(/Belum ada pekerjaan/.test(await page.textContent('#pmlDaftar')), 'Basis data kosong ditampilkan apa adanya');

  await page.click('button:has-text("Work Order Baru")');
  await page.waitForTimeout(400);
  ok(!!(await page.$('#pmlSumberDaya')), 'Formulir work order terbuka');

  await page.selectOption('#pmlJenisTarget', 'room_id');
  await page.waitForTimeout(200);
  await page.selectOption('#pmlSumberDaya', '1');
  await page.fill('#pmlJadwal', '2026-09-01');
  await page.selectOption('#pmlJenis', 'preventif');
  await page.click('#pmlFormSimpan');
  await page.waitForTimeout(600);

  ok(!(await page.$('.drawer')), 'Formulir tertutup setelah tersimpan');
  const daftarTxt = await page.textContent('#pmlDaftar');
  ok(/Ruang Rapat Garuda/.test(daftarTxt), 'Work order pada ruangan muncul di daftar');
  ok(/Pemeliharaan preventif/.test(daftarTxt), 'Jenis pekerjaan tampil dengan benar');

  /* ============ 2. MENYELESAIKAN PEKERJAAN MENGUBAH KONDISI ============ */
  console.log('\n--- 2. Menyelesaikan pekerjaan ---');
  await page.click('#pmlDaftar tbody tr');
  await page.waitForTimeout(400);
  ok(!!(await page.$('.drawer')), 'Detail pekerjaan terbuka');

  await page.click('button:has-text("Selesaikan")');
  await page.waitForTimeout(300);
  await page.fill('#pmlHasil', 'Sudah dibersihkan dan diperiksa.');
  await page.click('button:has-text("Simpan Penyelesaian")');
  await page.waitForTimeout(600);

  ok(!(await page.$('.drawer')), 'Drawer tertutup setelah pekerjaan diselesaikan');
  ok(/Selesai/.test(await page.textContent('#pmlDaftar')), 'Status berubah menjadi Selesai di daftar');

  /* ============ 3. KALIBRASI HANYA UNTUK ALAT ============ */
  console.log('\n--- 3. Kalibrasi Alat ---');
  await page.evaluate(() => { location.hash = '#/calibration'; });
  await page.waitForTimeout(700);
  ok(/Belum ada pekerjaan/.test(await page.textContent('#pmlDaftar')), 'Belum ada kalibrasi tercatat');

  await page.click('button:has-text("Jadwalkan Kalibrasi")');
  await page.waitForTimeout(400);
  ok(!(await page.$('#pmlJenisTarget')), 'Formulir kalibrasi tidak menawarkan target ruangan/laboratorium');

  await page.selectOption('#pmlSumberDaya', '1');
  await page.fill('#pmlJadwal', '2026-08-01');   // sudah lewat — akan menjadi terlambat
  await page.fill('#pmlLembagaForm', 'PT Kalibrasi Presisi');
  await page.click('#pmlFormSimpan');
  await page.waitForTimeout(600);

  const kalTxt = await page.textContent('#pmlDaftar');
  ok(/Neraca Analitik/.test(kalTxt), 'Jadwal kalibrasi alat muncul di daftar');
  ok(/terlambat/.test(kalTxt), 'Kalibrasi yang jadwalnya sudah lewat ditandai terlambat');

  await page.waitForTimeout(400);
  ok(/Neraca Analitik/.test(await page.textContent('#pmlAlert')),
    'Alat yang kalibrasinya kedaluwarsa muncul pada spanduk peringatan');

  /* ============ 4. MENYELESAIKAN KALIBRASI MEWAJIBKAN SERTIFIKAT ============ */
  console.log('\n--- 4. Menyelesaikan kalibrasi ---');
  await page.click('#pmlDaftar tbody tr');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Selesaikan")');
  await page.waitForTimeout(300);

  await page.click('button:has-text("Simpan Penyelesaian")');   // sertifikat kosong
  await page.waitForTimeout(500);
  ok(/Wajib diisi/.test(await page.textContent('#pmlSelesaiGalat')),
    'Server menolak penyelesaian kalibrasi tanpa nomor sertifikat');

  await page.fill('#pmlSertifikat', 'SERT-0099');
  await page.fill('#pmlBerlakuSampai', '2027-08-01');
  await page.click('button:has-text("Simpan Penyelesaian")');
  await page.waitForTimeout(600);

  ok(!(await page.$('.drawer')), 'Drawer tertutup setelah kalibrasi selesai dengan sertifikat lengkap');
  ok(/Selesai/.test(await page.textContent('#pmlDaftar')), 'Status kalibrasi menjadi Selesai');

  ok(errs.length === 0, 'Tanpa galat halaman pada pemeliharaan & kalibrasi', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
