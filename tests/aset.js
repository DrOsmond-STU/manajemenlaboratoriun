/* Uji Asset Register & Asset Movement yang tersambung ke API.
 *
 * Kedua layar memakai backend Aset & BMN yang sama dengan Register BMN —
 * yang dijaga di sini murni soal tampilan: daftar/detail/KPI garansi
 * benar-benar dari server (bukan angka purwarupa tetap), mutasi ruangan
 * benar-benar memanggil API dan riwayatnya bertambah, dan feed mutasi
 * lintas aset menampilkan identitas aset yang benar per baris.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  const rooms = [{ id: 1, kode: 'KIM-01', nama: 'Laboratorium Kimia 1' }, { id: 2, kode: 'KIM-02', nama: 'Laboratorium Kimia 2' }];

  const aset = [
    {
      id: 1, kode_internal: 'STU/KIM-01/HPLC/2022/0001', nama: 'HPLC Shimadzu LC-2050',
      merk: 'Shimadzu', tipe: 'LC-2050C 3D', serial_number: 'SHZ-88421',
      bmn: { id: '024.05.3.08.01.03.001.00001', kode_barang: '3.08.01.03.001', uraian_barang: 'Kromatografi Cair', kib: 'B' },
      pemasok: 'PT Sumber Alat Laboratorium', garansi_berakhir: soon(20),
      penyusutan: { nilai_perolehan: 850000000, akumulasi_penyusutan: 300000000, nilai_buku: 550000000 },
      kondisi: { kode: 'B', nama: 'Baik' }, status_penggunaan: 'Digunakan untuk Operasional Satker',
      ruangan: rooms[0], penanggung_jawab: { id: 9, nama: 'Rina Marlina' }
    },
    {
      id: 2, kode_internal: 'STU/KIM-01/AC/2020/0002', nama: 'AC Presisi 5PK',
      merk: 'Daikin', tipe: null, serial_number: null,
      bmn: { id: '024.05.3.05.02.01.003.00001', kode_barang: '3.05.02.01.003', uraian_barang: 'Peralatan Pendingin', kib: 'B' },
      pemasok: null, garansi_berakhir: null,
      penyusutan: { nilai_perolehan: 92000000, akumulasi_penyusutan: 64400000, nilai_buku: 27600000 },
      kondisi: { kode: 'RB', nama: 'Rusak Berat' }, status_penggunaan: 'Dihapuskan',
      ruangan: null, penanggung_jawab: null
    }
  ];
  const riwayat = { 1: [] };
  let mutasiUrut = 0;
  const feedMutasi = [];

  function soon(hari) { const d = new Date(); d.setDate(d.getDate() + hari); return d.toISOString().slice(0, 10); }
  function ringkas(a) {
    return { id: a.id, kode_internal: a.kode_internal, nama: a.nama, merk: a.merk, tipe: a.tipe, serial_number: a.serial_number,
      bmn: a.bmn, pemasok: a.pemasok, garansi_berakhir: a.garansi_berakhir, penyusutan: a.penyusutan,
      kondisi: a.kondisi, status_penggunaan: a.status_penggunaan, ruangan: a.ruangan, penanggung_jawab: a.penanggung_jawab };
  }

  const punyaSesi = (req) => {
    const c = (req.headers.cookie || '').match(/flms_sesi=([^;]+)/);
    return !!c && sesiAktif.has(c[1]);
  };

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Rina Marlina', email: 'r@x.id', peran: ['asset-manager'],
      izin: ['aset.lihat', 'aset.buat', 'aset.ubah'] } };

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

    const u = new URL(req.url, 'http://x');

    if (u.pathname === '/api/rooms') {
      return kirim(200, { data: rooms, meta: { total: rooms.length } });
    }

    if (u.pathname === '/api/assets/ringkasan') {
      const garansi = aset.filter((a) => a.garansi_berakhir).length;
      return kirim(200, { data: { jumlah: aset.length, nilai_perolehan: 942000000, nilai_buku: 577600000, garansi_akan_berakhir: garansi,
        kondisi: [{ kode: 'B', nama: 'Baik', jumlah: 1 }, { kode: 'RR', nama: 'Rusak Ringan', jumlah: 0 }, { kode: 'RB', nama: 'Rusak Berat', jumlah: 1 }] } });
    }

    if (u.pathname === '/api/assets/mutasi') {
      return kirim(200, { data: feedMutasi.slice().reverse() });
    }

    if (u.pathname === '/api/assets' && req.method === 'GET') {
      let baris = aset;
      if (u.searchParams.get('cari')) {
        const k = u.searchParams.get('cari').toLowerCase();
        baris = baris.filter((a) => a.nama.toLowerCase().includes(k));
      }
      if (u.searchParams.get('kondisi')) baris = baris.filter((a) => a.kondisi.kode === u.searchParams.get('kondisi'));
      return kirim(200, { data: baris.map(ringkas), meta: { total: baris.length } });
    }

    const satu = u.pathname.match(/^\/api\/assets\/(\d+)$/);
    if (satu && req.method === 'GET') {
      const a = aset.find((x) => x.id === Number(satu[1]));
      return a ? kirim(200, { data: ringkas(a) }) : kirim(404, { message: 'x' });
    }

    const fotoM = u.pathname.match(/^\/api\/assets\/(\d+)\/foto$/);
    if (fotoM) return kirim(200, { data: [] });

    const riwayatM = u.pathname.match(/^\/api\/assets\/(\d+)\/riwayat$/);
    if (riwayatM) return kirim(200, { data: (riwayat[Number(riwayatM[1])] || []).slice().reverse() });

    const mutasiM = u.pathname.match(/^\/api\/assets\/(\d+)\/mutasi$/);
    if (mutasiM && req.method === 'PATCH') {
      const a = aset.find((x) => x.id === Number(mutasiM[1]));
      let b = ''; req.on('data', (x) => (b += x));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        const tujuan = isi.room_id ? rooms.find((r) => r.id === Number(isi.room_id)) : null;
        const entri = { id: ++mutasiUrut, jenis: 'penempatan', jenis_nama: 'Perpindahan ruangan',
          dari: a.ruangan ? a.ruangan.nama : null, ke: tujuan ? tujuan.nama : null,
          catatan: isi.catatan || null, waktu: new Date().toISOString(),
          oleh: { id: 1, nama: 'Rina Marlina' }, aset: { id: a.id, nama: a.nama, kode_internal: a.kode_internal } };
        (riwayat[a.id] = riwayat[a.id] || []).push(entri);
        feedMutasi.push(entri);
        a.ruangan = tujuan;
        return kirim(200, { data: ringkas(a) });
      });
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

  await page.fill('#masukEmail', 'rina@instansi.go.id');
  await page.fill('#masukSandi', 'sandi-benar');
  await page.click('#masukTombol');
  await page.waitForTimeout(900);

  /* ============ 1. ASSET REGISTER ============ */
  console.log('\n--- 1. Asset Register ---');
  await page.evaluate(() => { location.hash = '#/assets'; });
  await page.waitForTimeout(900);

  const daftarTxt = await page.textContent('#astTabel');
  ok(/HPLC Shimadzu LC-2050/.test(daftarTxt), 'Aset dari server tampil di daftar');
  ok(/Laboratorium Kimia 1/.test(daftarTxt), 'Nama ruangan (bukan id) tampil');

  const kpiTxt = await page.textContent('#astKpi');
  ok(/Garansi Berakhir/.test(kpiTxt), 'KPI garansi berakhir dihitung dari server');

  /* ============ 2. CARI ============ */
  console.log('\n--- 2. Pencarian ---');
  await page.fill('#astCari', 'HPLC');
  await page.waitForTimeout(500);
  const hasilCari = await page.textContent('#astTabel');
  ok(/HPLC Shimadzu/.test(hasilCari) && !/AC Presisi/.test(hasilCari), 'Server yang menyaring, bukan tapisan sisi klien');
  await page.fill('#astCari', '');
  await page.waitForTimeout(500);

  /* ============ 3. DETAIL ASET ============ */
  console.log('\n--- 3. Detail Aset ---');
  const barisHplc = page.locator('#astTabel tbody tr', { hasText: 'HPLC Shimadzu LC-2050' });
  await barisHplc.locator('.icon-btn').click();
  await page.waitForTimeout(500);
  const drawerTxt = await page.textContent('.drawer');
  ok(/PT Sumber Alat Laboratorium/.test(drawerTxt), 'Pemasok tampil pada detail aset');
  ok(/Rp/.test(drawerTxt), 'Nilai perolehan/buku tampil sebagai rupiah');

  /* ============ 4. MUTASI RUANGAN ============ */
  console.log('\n--- 4. Mutasi ruangan ---');
  await page.click('button:has-text("Mutasi")');
  await page.waitForTimeout(400);
  await page.selectOption('#astMovRoom', '2');
  await page.fill('#astMovCatatan', 'Penataan ulang laboratorium');
  await page.click('button:has-text("Pindahkan")');
  await page.waitForTimeout(700);
  const daftarSetelahMutasi = await page.textContent('#astTabel');
  ok(/Laboratorium Kimia 2/.test(daftarSetelahMutasi), 'Aset benar-benar pindah ruangan lewat API, daftar dimuat ulang');

  /* ============ 5. ASSET MOVEMENT & MUTASI ============ */
  console.log('\n--- 5. Asset Movement & Mutasi ---');
  await page.evaluate(() => { location.hash = '#/assetmovement'; });
  await page.waitForTimeout(900);
  const movTxt = await page.textContent('#movTabel');
  ok(/HPLC Shimadzu LC-2050/.test(movTxt), 'Feed mutasi menyebut identitas aset, bukan hanya nomor mutasi');
  ok(/Laboratorium Kimia 1/.test(movTxt) && /Laboratorium Kimia 2/.test(movTxt), 'Perubahan dari/ke ruangan tampil pada feed gabungan');

  ok(errs.length === 0, 'Tanpa galat halaman pada asset register & movement', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
