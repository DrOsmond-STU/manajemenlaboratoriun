/* Uji layar Manajemen Alat Laboratorium yang tersambung ke API.
 *
 * Yang dijaga: layar ini memakai backend Aset & BMN yang SAMA dengan Asset
 * Register (Repo.aset, GET /api/assets?wajib_kalibrasi=1) — bukan domain
 * terpisah — dan benar-benar menyaring hanya aset wajib kalibrasi, bukan
 * menampilkan seluruh Register BMN. KPI "Status" purwarupa (Available/In
 * Use/dst.) tidak boleh muncul lagi karena kolom itu tidak pernah ada di
 * server.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;

  const LAB = { id: 1, kode: 'LAB-001', nama: 'Laboratorium Kimia Analitik' };

  const ASET = [
    { id: 1, kode_internal: 'STU/LAB/AA001', bmn: { id: '024.05.0100.652431.000.3.08.01.03.001.00001', kode_barang: '3.08.01.03.001', uraian_barang: 'Unit Alat Laboratorium' },
      nama: 'HPLC Shimadzu LC-2050', merk: 'Shimadzu', serial_number: 'SHZ-LC-88421',
      penyusutan: { nilai_perolehan: 890000000, nilai_buku: 700000000, akumulasi_penyusutan: 190000000 },
      kondisi: { kode: 'B', nama: 'Baik' }, wajib_kalibrasi: true,
      kalibrasi: { berlaku_sampai: null, kedaluwarsa: true },
      laboratorium: LAB, penanggung_jawab: { id: 9, nama: 'Andi Teknisi' } },
    { id: 2, kode_internal: 'STU/FAC/BB001', bmn: { id: '024.05.0100.652431.000.3.05.02.01.003.00001', kode_barang: '3.05.02.01.003', uraian_barang: 'Meja Kerja' },
      nama: 'Meja Kerja Laboratorium', merk: null, serial_number: null,
      penyusutan: { nilai_perolehan: 5000000, nilai_buku: 4000000, akumulasi_penyusutan: 1000000 },
      kondisi: { kode: 'B', nama: 'Baik' }, wajib_kalibrasi: false,
      laboratorium: null, penanggung_jawab: null }
  ];

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Andi Teknisi', email: 'a@x.id',
      peran: ['lab-technician'], izin: ['aset.lihat', 'pemeliharaan.lihat', 'booking-alat.lihat'] } };

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

    if (u.pathname === '/api/laboratories') {
      return kirim(200, { data: [LAB], meta: { total: 1 } });
    }

    if (u.pathname === '/api/dashboard/widget') {
      const kunci = u.searchParams.get('kunci');
      if (kunci === 'peminjaman.aktif') return kirim(200, { data: { nilai: 3 } });
      if (kunci === 'kalibrasi.kedaluwarsa') return kirim(200, { data: { nilai: 1, baris: [] } });
      return kirim(200, { data: { nilai: null } });
    }

    if (u.pathname === '/api/assets/ringkasan') {
      const wajib = u.searchParams.get('wajib_kalibrasi');
      const baris = wajib === '1' ? ASET.filter((a) => a.wajib_kalibrasi) : ASET;
      return kirim(200, { data: {
        jumlah: baris.length,
        nilai_perolehan: baris.reduce((s, a) => s + a.penyusutan.nilai_perolehan, 0),
        nilai_buku: baris.reduce((s, a) => s + a.penyusutan.nilai_buku, 0),
        akumulasi_penyusutan: 0, garansi_akan_berakhir: 0, disposal: { jumlah: 0, nilai_buku: 0 },
        per_kode_barang: [],
        kondisi: [{ kode: 'B', nama: 'Baik', jumlah: baris.length }, { kode: 'RR', nama: 'Rusak Ringan', jumlah: 0 }, { kode: 'RB', nama: 'Rusak Berat', jumlah: 0 }]
      } });
    }

    if (u.pathname === '/api/assets') {
      const wajib = u.searchParams.get('wajib_kalibrasi');
      const labId = u.searchParams.get('laboratory_id');
      let baris = ASET.slice();
      if (wajib === '1') baris = baris.filter((a) => a.wajib_kalibrasi);
      if (wajib === '0') baris = baris.filter((a) => !a.wajib_kalibrasi);
      if (labId) baris = baris.filter((a) => a.laboratorium && String(a.laboratorium.id) === labId);
      return kirim(200, { data: baris, meta: { total: baris.length } });
    }

    const mAsset = u.pathname.match(/^\/api\/assets\/(\d+)$/);
    if (mAsset) {
      const a = ASET.find((x) => x.id === Number(mAsset[1]));
      if (!a) return kirim(404, { message: 'x' });
      return kirim(200, { data: a });
    }

    if (u.pathname === '/api/pemeliharaan') {
      const assetId = Number(u.searchParams.get('asset_id'));
      if (assetId === 1) {
        return kirim(200, { data: [
          { id: 1, jenis: { kode: 'kalibrasi', nama: 'Kalibrasi' }, jadwal: '2026-01-10', dikerjakan_pada: '2026-01-10',
            status: { kode: 'selesai', nama: 'Selesai' }, biaya: 3500000, kalibrasi: { no_sertifikat: 'SERT-8821', lembaga: 'PT Kalibrasi Presisi' } },
          { id: 2, jenis: { kode: 'preventif', nama: 'Pemeliharaan preventif' }, jadwal: '2026-02-01', dikerjakan_pada: '2026-02-01',
            status: { kode: 'selesai', nama: 'Selesai' }, biaya: 500000 }
        ], meta: { total: 2 } });
      }
      return kirim(200, { data: [], meta: { total: 0 } });
    }

    if (u.pathname === '/api/peminjaman') {
      const assetId = Number(u.searchParams.get('asset_id'));
      if (assetId === 1) {
        return kirim(200, { data: [
          { id: 1, keperluan: 'Pengujian sampel air limbah', jadwal: { mulai: '2026-03-01T08:00:00Z', selesai: '2026-03-01T12:00:00Z' },
            status: { kode: 'dikembalikan', nama: 'Dikembalikan' }, peminjam: { id: 5, nama: 'Rina Teknisi' } }
        ], meta: { total: 1 } });
      }
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

  await page.fill('#masukEmail', 'andi@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  console.log('\n--- 1. Manajemen Alat Laboratorium ---');
  await page.evaluate(() => { location.hash = '#/equipment'; });
  await page.waitForTimeout(1000);

  const tabel = await page.textContent('#eqpTabel');
  ok(/HPLC Shimadzu LC-2050/.test(tabel), 'Alat wajib kalibrasi tampil di daftar');
  ok(!/Meja Kerja Laboratorium/.test(tabel), 'Aset yang BUKAN alat lab (wajib_kalibrasi=false) TIDAK ikut tampil — bukan Register BMN penuh');
  ok(/Laboratorium Kimia Analitik/.test(tabel), 'Laboratorium tampil');
  ok(/Belum pernah/.test(tabel), 'Alat yang belum pernah kalibrasi ditandai jelas, bukan tanggal kosong');

  const kpi = await page.textContent('#eqpKpi');
  ok(/\b1\b/.test(kpi), 'Total Alat = 1 (hanya yang wajib kalibrasi)');
  ok(/Sedang Dipinjam/.test(kpi) && /\b3\b/.test(kpi), 'KPI "Sedang Dipinjam" dari widget peminjaman.aktif — bukan status purwarupa');
  ok(!/Tersedia/.test(kpi) && !/Non-Operasional/.test(kpi), 'KPI status purwarupa (Tersedia/Non-Operasional) tidak lagi tampil — tidak dimodelkan');

  console.log('\n--- 2. Filter Laboratorium terisi dari server ---');
  const opsiLab = await page.$$eval('#eqpFilterLab option', (e) => e.map((x) => x.textContent.trim()));
  ok(opsiLab.some((t) => /Laboratorium Kimia Analitik/.test(t)), 'Pemilih laboratorium terisi dari basis data', opsiLab.join(' | '));

  console.log('\n--- 3. Detail alat: kalibrasi, maintenance, penggunaan ---');
  await page.click('#eqpTabel .lnk');
  await page.waitForTimeout(700);
  const drawer = await page.textContent('.drawer, body');
  ok(/melewati jatuh tempo/.test(drawer), 'Peringatan kalibrasi kedaluwarsa tampil');
  ok(/SERT-8821/.test(drawer), 'Riwayat kalibrasi sungguhan tampil (nomor sertifikat)');
  ok(/PT Kalibrasi Presisi/.test(drawer), 'Lembaga kalibrasi tampil');
  ok(/Pemeliharaan preventif/.test(drawer), 'Riwayat maintenance sungguhan tampil, terpisah dari kalibrasi');
  ok(/Rina Teknisi/.test(drawer), 'Riwayat penggunaan (peminjaman) sungguhan tampil');
  ok(/Pengujian sampel air limbah/.test(drawer), 'Keperluan peminjaman tampil');

  ok(errs.length === 0, 'Tanpa galat halaman pada Manajemen Alat Laboratorium', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
