/* Uji layar Audit Aset (stock opname) yang tersambung ke API.
 *
 * Yang dijaga: sesi disimpan sungguhan (bukan UI.demo()), "Belum Diaudit"
 * berubah label jadi "Tidak Ditemukan" begitu sesi ditutup — TANPA
 * mengubah angkanya — dan drawer pemindaian tetap terbuka setelah berhasil
 * agar auditor dapat memindai berturut-turut.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  let idSesi = 0;
  const sesiList = [];
  const scans = [];

  // Katalog aset tetap — dua aset, dua gedung berbeda.
  const ASET = [
    { id: 1, kode_internal: 'STU/LAB/AA001', bmn_id: null, nama: 'HPLC Shimadzu LC-2050', gedung: 'Gedung A', lokasi: 'Gedung A / LAB-001', kondisi: 'B' },
    { id: 2, kode_internal: 'STU/LAB/BB001', bmn_id: null, nama: 'Mikroskop Olympus', gedung: 'Gedung B', lokasi: 'Gedung B / LAB-002', kondisi: 'B' }
  ];
  const cariAset = (kode) => ASET.find((a) => a.kode_internal === kode || a.bmn_id === kode);

  const temuanScan = (s) => {
    const lokasiBerbeda = s.lokasi_ditemukan != null && s.lokasi_ditemukan !== s.lokasi_tercatat;
    const kondisiBerbeda = s.kondisi_ditemukan != null && s.kondisi_ditemukan !== s.kondisi_tercatat;
    if (lokasiBerbeda) return { kode: 'lokasi_berbeda', nama: 'Lokasi berbeda' };
    if (kondisiBerbeda) return { kode: 'kondisi_berbeda', nama: 'Kondisi berbeda' };
    return { kode: 'sesuai', nama: 'Sesuai catatan' };
  };

  const bentukScan = (s) => ({
    id: s.id,
    aset: { id: s.aset.id, nama: s.aset.nama, kode_internal: s.aset.kode_internal, bmn_id: s.aset.bmn_id },
    lokasi: { tercatat: s.lokasi_tercatat, ditemukan: s.lokasi_ditemukan },
    kondisi: { tercatat: { kode: s.kondisi_tercatat }, ditemukan: { kode: s.kondisi_ditemukan } },
    temuan: temuanScan(s),
    auditor: { id: 1, nama: 'Rahmat Facility' },
    dipindai_pada: new Date().toISOString(), catatan: s.catatan || null
  });

  const ringkasan = (sesi) => {
    const scanSesi = scans.filter((s) => s.session_id === sesi.id);
    const scannedId = new Set(scanSesi.map((s) => s.aset.id));
    let sesuai = 0, lokasiBerbeda = 0, kondisiBerbeda = 0;
    scanSesi.forEach((s) => {
      const t = temuanScan(s).kode;
      if (t === 'lokasi_berbeda') lokasiBerbeda++;
      else if (t === 'kondisi_berbeda') kondisiBerbeda++;
      else sesuai++;
    });
    const belumDipindai = ASET.filter((a) => !scannedId.has(a.id)).length;
    const gedung = {};
    ASET.forEach((a) => {
      gedung[a.gedung] = gedung[a.gedung] || { gedung: a.gedung, total: 0, terpindai: 0 };
      gedung[a.gedung].total++;
      if (scannedId.has(a.id)) gedung[a.gedung].terpindai++;
    });
    return {
      total_aset: ASET.length, sudah_diverifikasi: scanSesi.length,
      sesuai, lokasi_berbeda: lokasiBerbeda, kondisi_berbeda: kondisiBerbeda,
      belum_diaudit: sesi.status === 'berjalan' ? belumDipindai : 0,
      tidak_ditemukan: sesi.status === 'selesai' ? belumDipindai : 0,
      per_gedung: Object.values(gedung).map((g) => ({ ...g, persentase: Math.round((g.terpindai / g.total) * 100) }))
    };
  };

  const bentukSesiRingkas = (s) => ({
    id: s.id, nama: s.nama, mulai: s.mulai, target_selesai: s.target_selesai || null,
    status: { kode: s.status, nama: s.status === 'berjalan' ? 'Berjalan' : 'Selesai' },
    selesai_pada: s.selesai_pada || null, pembuat: { id: 1, nama: 'Rahmat Facility' }, catatan: s.catatan || null
  });

  const bentukSesiDetail = (s) => ({
    ...bentukSesiRingkas(s),
    ringkasan: ringkasan(s),
    temuan: scans.filter((sc) => sc.session_id === s.id).map(bentukScan).filter((sc) => sc.temuan.kode !== 'sesuai')
  });

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Rahmat Facility', email: 'r@x.id',
      peran: ['facility-manager'], izin: ['audit-aset.lihat', 'audit-aset.buat', 'audit-aset.ubah'] } };

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

    if (u.pathname === '/api/audit-aset') {
      if (req.method === 'GET') {
        return kirim(200, { data: sesiList.slice().sort((a, b) => b.mulai.localeCompare(a.mulai)).map(bentukSesiRingkas) });
      }
      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          if (!isi.nama) return kirim(422, { message: 'x', errors: { nama: ['Nama sesi wajib diisi.'] } });
          const s = { id: ++idSesi, nama: isi.nama, mulai: isi.mulai, target_selesai: isi.target_selesai || null,
            status: 'berjalan', selesai_pada: null, catatan: isi.catatan || null };
          sesiList.push(s);
          return kirim(201, { data: bentukSesiRingkas(s) });
        });
      }
    }

    const mScan = u.pathname.match(/^\/api\/audit-aset\/(\d+)\/scan$/);
    if (mScan && req.method === 'POST') {
      const sesi = sesiList.find((s) => s.id === Number(mScan[1]));
      if (!sesi) return kirim(404, { message: 'x' });
      let b = ''; req.on('data', (d) => (b += d));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        if (sesi.status !== 'berjalan') return kirim(422, { message: 'x', errors: { sesi: ['Sesi audit ini sudah ditutup.'] } });
        const aset = cariAset(isi.kode);
        if (!aset) return kirim(422, { message: 'x', errors: { kode: ['Kode tidak dikenali.'] } });

        let s = scans.find((x) => x.session_id === sesi.id && x.aset.id === aset.id);
        if (!s) { s = { id: scans.length + 1, session_id: sesi.id, aset }; scans.push(s); }
        s.lokasi_tercatat = aset.lokasi;
        s.lokasi_ditemukan = isi.lokasi_ditemukan || aset.lokasi;
        s.kondisi_tercatat = aset.kondisi;
        s.kondisi_ditemukan = isi.kondisi_ditemukan || aset.kondisi;
        s.catatan = isi.catatan || null;
        return kirim(201, { data: bentukScan(s) });
      });
    }

    const mTutup = u.pathname.match(/^\/api\/audit-aset\/(\d+)\/tutup$/);
    if (mTutup && req.method === 'POST') {
      const sesi = sesiList.find((s) => s.id === Number(mTutup[1]));
      if (!sesi) return kirim(404, { message: 'x' });
      if (sesi.status !== 'berjalan') return kirim(422, { message: 'x', errors: { sesi: ['Sesi audit ini sudah ditutup sebelumnya.'] } });
      sesi.status = 'selesai'; sesi.selesai_pada = new Date().toISOString();
      return kirim(200, { data: bentukSesiDetail(sesi) });
    }

    const mShow = u.pathname.match(/^\/api\/audit-aset\/(\d+)$/);
    if (mShow && req.method === 'GET') {
      const sesi = sesiList.find((s) => s.id === Number(mShow[1]));
      if (!sesi) return kirim(404, { message: 'x' });
      return kirim(200, { data: bentukSesiDetail(sesi) });
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

  /* ============ 1. BELUM ADA SESI ============ */
  console.log('\n--- 1. Belum ada sesi audit ---');
  await page.evaluate(() => { location.hash = '#/assetaudit'; });
  await page.waitForTimeout(900);

  const kosong = await page.textContent('#audIsi');
  ok(/Belum ada sesi audit/.test(kosong), 'Kosong ditampilkan apa adanya, bukan diisi angka purwarupa 1284/1147');
  ok(!/1284/.test(kosong) && !/1147/.test(kosong), 'Angka purwarupa lama tidak lagi muncul');

  /* ============ 2. VALIDASI SERVER SAMPAI KE FORMULIR ============ */
  console.log('\n--- 2. Validasi server pada formulir sesi baru ---');
  await page.click('button:has-text("Sesi Audit Baru")');
  await page.waitForTimeout(400);
  await page.click('#audSesiSimpanBtn');
  await page.waitForTimeout(600);

  const galatSesi = await page.$('#audSesiGalat');
  ok(galatSesi && await galatSesi.isVisible(), 'Galat dari server tampil di formulir sesi');
  ok(/Nama sesi wajib diisi/.test(await galatSesi.textContent()), 'Pesannya pesan server, bukan pesan generik');

  /* ============ 3. MEMULAI SESI SUNGGUHAN ============ */
  console.log('\n--- 3. Memulai sesi sungguhan ---');
  await page.fill('#audSesiNama', 'Audit Semester I 2026');
  await page.click('#audSesiSimpanBtn');
  await page.waitForTimeout(900);

  const dashboard = await page.textContent('#audIsi');
  ok(/Audit Semester I 2026/.test(dashboard), 'Nama sesi tampil');
  ok(/\b2\b/.test(dashboard), 'Aset Tercatat = 2 (dari katalog aset tiruan)');
  ok(/Belum Diaudit/.test(dashboard), 'Label "Belum Diaudit" tampil selagi sesi berjalan');
  ok(!/Tidak Ditemukan/.test(dashboard), 'Label "Tidak Ditemukan" BELUM tampil selagi sesi masih berjalan');

  /* ============ 4. PEMINDAIAN — SESUAI CATATAN ============ */
  console.log('\n--- 4. Pemindaian sesuai catatan ---');
  await page.click('button:has-text("Mulai Scan")');
  await page.waitForTimeout(400);
  await page.fill('#audKode', 'STU/LAB/AA001');
  await page.click('#audScanSimpanBtn');
  await page.waitForTimeout(900);

  ok(!!(await page.$('#audKode')), 'Drawer TETAP TERBUKA setelah berhasil — auditor dapat langsung memindai lagi');
  const kodeKosong = await page.inputValue('#audKode');
  ok(kodeKosong === '', 'Medan kode dikosongkan setelah berhasil, siap untuk pemindaian berikutnya');

  /* ============ 5. PEMINDAIAN — LOKASI BERBEDA ============ */
  console.log('\n--- 5. Pemindaian dengan lokasi berbeda ---');
  await page.fill('#audKode', 'STU/LAB/BB001');
  await page.fill('#audLokasi', 'Gudang Pusat');
  await page.click('#audScanSimpanBtn');
  await page.waitForTimeout(900);

  /* ============ 6. KODE TIDAK DIKENALI ============ */
  console.log('\n--- 6. Kode tidak dikenali ditolak ---');
  await page.fill('#audKode', 'TIDAK-ADA-INI');
  await page.click('#audScanSimpanBtn');
  await page.waitForTimeout(600);
  const galatScan = await page.$('#audScanGalat');
  ok(galatScan && await galatScan.isVisible(), 'Galat kode tak dikenal tampil di drawer');
  ok(/[Kk]ode tidak dikenali/.test(await galatScan.textContent()), 'Pesan pesan server, bukan generik');

  await page.evaluate(() => UI.closeDrawer());
  await page.waitForTimeout(500);

  const setelahScan = await page.textContent('#audIsi');
  ok(/Lokasi berbeda/.test(setelahScan), 'Temuan "Lokasi berbeda" tampil di tabel Temuan Audit');
  ok(!/Mikroskop Olympus[\s\S]{0,60}Sesuai/.test(setelahScan), 'Baris yang sesuai catatan TIDAK ikut tampil di tabel Temuan (hanya yang menyimpang)');

  ok(errs.length === 0, 'Tanpa galat halaman setelah pemindaian', errs.join(' | '));

  /* ============ 7. MENUTUP SESI ============ */
  console.log('\n--- 7. Menutup sesi — label berubah, angka tidak ---');
  page.once('dialog', (d) => d.accept());
  await page.click('button:has-text("Tutup Sesi")');
  await page.waitForTimeout(900);

  const setelahTutup = await page.textContent('#audIsi');
  ok(/Selesai/.test(setelahTutup), 'Status sesi menjadi Selesai');
  ok(/Tidak Ditemukan/.test(setelahTutup), 'Label berubah jadi "Tidak Ditemukan" setelah sesi ditutup');
  ok(!/Belum Diaudit/.test(setelahTutup), '"Belum Diaudit" tidak lagi tampil — sesinya sudah tertutup');
  ok(!(await page.$('button:has-text("Mulai Scan")')), 'Tombol "Mulai Scan" hilang — sesi sudah tertutup');

  ok(errs.length === 0, 'Tanpa galat halaman pada Audit Aset', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
