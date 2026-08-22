/* Uji Penyewaan & Tagihan yang tersambung ke API.
 *
 * Yang dijaga: tarif/add-on/paket dibaca dari satu sumber lewat tapisan
 * jenis, penawaran dihitung dari tarif lalu diputuskan sebelum dapat
 * diterbitkan menjadi invoice, dan pembayaran yang belum diverifikasi
 * belum dihitung sebagai uang masuk sampai staf memverifikasinya.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;

  const rooms = [{ id: 1, nama: 'Auditorium Wijaya Kusuma', kode: 'RM-005' }];
  const labs = [];
  let idTarif = 0;
  const tarif = [];
  let idSewa = 0;
  const sewa = [];
  let idPenawaran = 0;
  const penawaran = [];
  let idTagihan = 0;
  const tagihan = [];
  let idBayar = 0;
  const pembayaran = [];

  const bentukTarif = (t) => ({
    id: t.id, nama: t.nama, jenis: { kode: t.jenis, nama: { tarif: 'Tarif fasilitas', addon: 'Add-on', paket: 'Paket layanan' }[t.jenis] },
    sumber_daya: t.room_id ? { jenis: 'ruangan', id: t.room_id, nama: rooms.find((r) => r.id === t.room_id).nama } : null,
    satuan_waktu: { kode: t.satuan_waktu, nama: { jam: 'Per jam', hari: 'Per hari', paket: 'Per paket' }[t.satuan_waktu] },
    harga: t.harga, segmen: { kode: t.segmen, nama: 'Umum' },
    deskripsi: t.deskripsi || null, kapasitas: t.kapasitas || null, aktif: true
  });

  const bentukSewa = (s) => ({
    id: s.id, penyewa: s.penyewa, instansi: s.instansi || null,
    mulai: s.mulai, selesai: s.selesai,
    status: { kode: 'dikonfirmasi', nama: 'Dikonfirmasi' },
    ruangan: s.room_id ? { id: s.room_id, nama: rooms.find((r) => r.id === s.room_id).nama } : null,
    laboratorium: null
  });

  const bentukPenawaran = (q) => ({
    id: q.id, nomor: q.nomor,
    tanggal: q.tanggal, berlaku_sampai: q.berlaku_sampai,
    kedaluwarsa: false,
    status: { kode: q.status, nama: { terkirim: 'Terkirim', negosiasi: 'Negosiasi', disetujui: 'Disetujui', ditolak: 'Ditolak' }[q.status] },
    nilai: { subtotal: q.subtotal, ppn_persen: q.ppn_persen, ppn: Math.round(q.subtotal * q.ppn_persen / 100), total: q.subtotal + Math.round(q.subtotal * q.ppn_persen / 100) },
    dapat_diterbitkan_invoice: q.status === 'disetujui' && !q.diterbitkan,
    invoice_nomor: q.diterbitkan ? tagihan.find((t) => t.quotation_id === q.id).nomor : null,
    baris: [{ deskripsi: 'Sewa ' + rooms[0].nama, kuantitas: 1, satuan: 'hari', harga_satuan: q.subtotal, subtotal: q.subtotal }],
    penyewaan: { id: q.rental_id, penyewa: sewa.find((s) => s.id === q.rental_id).penyewa },
    catatan: null
  });

  const bentukTagihan = (t) => {
    const bayarnya = pembayaran.filter((p) => p.invoice_id === t.id);
    const terbayar = bayarnya.filter((p) => p.status === 'terverifikasi').reduce((a, p) => a + p.jumlah, 0);
    const ppn = Math.round(t.subtotal * t.ppn_persen / 100);
    const total = t.subtotal + ppn;
    return {
      id: t.id, nomor: t.nomor, tanggal: t.tanggal, jatuh_tempo: t.jatuh_tempo,
      terlewat_jatuh_tempo: false,
      status: { kode: terbayar >= total ? 'lunas' : terbayar > 0 ? 'sebagian' : 'terbit', nama: terbayar >= total ? 'Lunas' : terbayar > 0 ? 'Dibayar sebagian' : 'Terbit' },
      nilai: { subtotal: t.subtotal, ppn_persen: t.ppn_persen, ppn, total, terbayar, sisa: total - terbayar },
      baris: [{ deskripsi: 'Sewa ' + rooms[0].nama, kuantitas: 1, satuan: 'hari', harga_satuan: t.subtotal, subtotal: t.subtotal }],
      pembayaran: bayarnya.map((p) => ({ id: p.id, tanggal: p.tanggal, jumlah: p.jumlah, metode: p.metode, status: { kode: p.status, nama: p.status === 'terverifikasi' ? 'Terverifikasi' : 'Menunggu verifikasi' } })),
      penyewaan: { id: t.rental_id, penyewa: sewa.find((s) => s.id === t.rental_id).penyewa },
      quotation_nomor: t.quotation_id ? penawaran.find((q) => q.id === t.quotation_id).nomor : null,
      catatan: null
    };
  };

  const bentukPembayaran = (p) => ({
    id: p.id, tanggal: p.tanggal, jumlah: p.jumlah, metode: p.metode,
    status: { kode: p.status, nama: p.status === 'terverifikasi' ? 'Terverifikasi' : 'Menunggu verifikasi' },
    referensi: p.referensi || null, catatan: null,
    invoice: { id: p.invoice_id, nomor: tagihan.find((t) => t.id === p.invoice_id).nomor, penyewa: sewa.find((s) => s.id === tagihan.find((t) => t.id === p.invoice_id).rental_id).penyewa }
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
      peran: ['finance'], izin: ['penyewaan.lihat', 'penyewaan.buat', 'penyewaan.ubah', 'master-data.lihat'] } };

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

    if (req.url.startsWith('/api/tarif') && req.method === 'GET') {
      const u = new URL(req.url, 'http://x');
      const jenis = u.searchParams.get('jenis');
      let baris = tarif;
      if (jenis) baris = baris.filter((t) => t.jenis === jenis);
      return kirim(200, { data: baris.map(bentukTarif) });
    }
    if (req.url.startsWith('/api/tarif') && req.method === 'POST') {
      let b = ''; req.on('data', (x) => (b += x));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        const t = { id: ++idTarif, ...isi };
        tarif.push(t);
        return kirim(201, { data: bentukTarif(t) });
      });
    }

    if (req.url.startsWith('/api/penyewaan') && req.method === 'GET') {
      return kirim(200, { data: { data: sewa.map(bentukSewa), current_page: 1 } });
    }
    if (req.url.startsWith('/api/penyewaan') && req.method === 'POST') {
      let b = ''; req.on('data', (x) => (b += x));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        const s = { id: ++idSewa, ...isi };
        sewa.push(s);
        return kirim(201, { data: bentukSewa(s) });
      });
    }

    if (req.url === '/api/penawaran' && req.method === 'GET') {
      return kirim(200, { data: penawaran.map(bentukPenawaran) });
    }
    if (req.url.startsWith('/api/penawaran') && req.method === 'POST' && !req.url.includes('/putuskan') && !req.url.includes('/tagihan')) {
      let b = ''; req.on('data', (x) => (b += x));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        const q = {
          id: ++idPenawaran, nomor: 'QUO/2026/' + String(idPenawaran).padStart(5, '0'),
          rental_id: isi.rental_id, tanggal: '2026-08-22',
          berlaku_sampai: '2026-09-05', ppn_persen: isi.ppn_persen || 0,
          subtotal: 5_000_000, status: 'terkirim', diterbitkan: false
        };
        penawaran.push(q);
        return kirim(201, { data: bentukPenawaran(q) });
      });
    }
    const cocokPutuskan = req.url.match(/^\/api\/penawaran\/(\d+)\/putuskan/);
    if (cocokPutuskan && req.method === 'POST') {
      const q = penawaran.find((x) => x.id === Number(cocokPutuskan[1]));
      let b = ''; req.on('data', (x) => (b += x));
      return req.on('end', () => {
        q.status = JSON.parse(b || '{}').keputusan;
        return kirim(200, { data: bentukPenawaran(q) });
      });
    }
    const cocokTerbitkan = req.url.match(/^\/api\/penawaran\/(\d+)\/tagihan/);
    if (cocokTerbitkan && req.method === 'POST') {
      const q = penawaran.find((x) => x.id === Number(cocokTerbitkan[1]));
      if (q.status !== 'disetujui' || q.diterbitkan) return kirim(422, { message: 'x', errors: { quotation_id: ['Tidak dapat diterbitkan.'] } });
      const t = { id: ++idTagihan, nomor: 'INV/2026/' + String(idTagihan).padStart(5, '0'),
        rental_id: q.rental_id, quotation_id: q.id, tanggal: '2026-08-22', jatuh_tempo: '2026-09-05',
        ppn_persen: q.ppn_persen, subtotal: q.subtotal };
      tagihan.push(t);
      q.diterbitkan = true;
      return kirim(201, { data: bentukTagihan(t) });
    }
    const cocokPenawaranSatu = req.url.match(/^\/api\/penawaran\/(\d+)/);
    if (cocokPenawaranSatu && req.method === 'GET') {
      const q = penawaran.find((x) => x.id === Number(cocokPenawaranSatu[1]));
      return q ? kirim(200, { data: bentukPenawaran(q) }) : kirim(404, { message: 'Tidak ditemukan' });
    }

    if (req.url === '/api/tagihan' && req.method === 'GET') {
      return kirim(200, { data: tagihan.map(bentukTagihan) });
    }
    const cocokBayar = req.url.match(/^\/api\/tagihan\/(\d+)\/pembayaran/);
    if (cocokBayar && req.method === 'POST') {
      let b = ''; req.on('data', (x) => (b += x));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        const p = { id: ++idBayar, invoice_id: Number(cocokBayar[1]), tanggal: isi.tanggal, jumlah: isi.jumlah,
          metode: isi.metode || 'transfer', status: isi.status || 'terverifikasi', referensi: isi.referensi || null };
        pembayaran.push(p);
        return kirim(200, { data: bentukTagihan(tagihan.find((x) => x.id === p.invoice_id)) });
      });
    }
    const cocokTagihanSatu = req.url.match(/^\/api\/tagihan\/(\d+)/);
    if (cocokTagihanSatu && req.method === 'GET') {
      const t = tagihan.find((x) => x.id === Number(cocokTagihanSatu[1]));
      return t ? kirim(200, { data: bentukTagihan(t) }) : kirim(404, { message: 'Tidak ditemukan' });
    }

    if (req.url.startsWith('/api/pembayaran') && req.method === 'GET') {
      return kirim(200, { data: pembayaran.map(bentukPembayaran) });
    }
    const cocokVerifikasi = req.url.match(/^\/api\/pembayaran\/(\d+)\/verifikasi/);
    if (cocokVerifikasi && req.method === 'POST') {
      const p = pembayaran.find((x) => x.id === Number(cocokVerifikasi[1]));
      p.status = 'terverifikasi';
      return kirim(200, { data: bentukTagihan(tagihan.find((x) => x.id === p.invoice_id)) });
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

  /* ============ 1. TARIF ============ */
  console.log('\n--- 1. Daftar Tarif ---');
  await page.evaluate(() => { location.hash = '#/pricelist'; });
  await page.waitForTimeout(700);
  ok(/Belum ada tarif/.test(await page.textContent('#trfTabelTarif')), 'Belum ada tarif ditampilkan apa adanya');

  await page.click('button:has-text("Tambah Tarif")');
  await page.waitForTimeout(400);
  await page.fill('#trfNama', 'Sewa Auditorium');
  await page.fill('#trfTargetId', '1');
  await page.selectOption('#trfSatuan', 'hari');
  await page.fill('#trfHarga', '12500000');
  await page.click('#trfFormSimpan');
  await page.waitForTimeout(600);
  ok(/Sewa Auditorium/.test(await page.textContent('#trfTabelTarif')), 'Tarif baru muncul di daftar');

  /* ============ 2. PERMOHONAN SEWA ============ */
  console.log('\n--- 2. Permohonan Sewa ---');
  await page.evaluate(() => { location.hash = '#/rental'; });
  await page.waitForTimeout(700);
  await page.click('button:has-text("Permohonan Baru")');
  await page.waitForTimeout(400);
  await page.fill('#rtlPenyewa', 'PT Anugerah Sejahtera');
  await page.fill('#rtlInstansi', 'PT Anugerah Sejahtera');
  await page.selectOption('#rtlTarget', '1');
  await page.fill('#rtlMulai', '2026-09-01T08:00');
  await page.fill('#rtlSelesai', '2026-09-01T17:00');
  await page.click('#rtlFormSimpan');
  await page.waitForTimeout(600);
  ok(/PT Anugerah Sejahtera/.test(await page.textContent('#rtlDaftar')), 'Permohonan sewa baru muncul di daftar');

  /* ============ 3. QUOTATION: BUAT, PUTUSKAN, TERBITKAN INVOICE ============ */
  console.log('\n--- 3. Quotation ---');
  await page.evaluate(() => { location.hash = '#/quotation'; });
  await page.waitForTimeout(700);
  await page.click('button:has-text("Buat Quotation")');
  await page.waitForTimeout(400);
  await page.selectOption('#quoRental', '1');
  await page.fill('#quoPpn', '11');
  await page.click('#quoFormSimpan');
  await page.waitForTimeout(600);
  ok(/PT Anugerah Sejahtera/.test(await page.textContent('#quoDaftar')), 'Penawaran baru muncul di daftar');

  await page.click('#quoDaftar tbody tr');
  await page.waitForTimeout(400);
  ok(!!(await page.$('.overlay')), 'Detail penawaran terbuka');
  await page.click('button:has-text("Setujui")');
  await page.waitForTimeout(500);
  ok(/Disetujui/.test(await page.textContent('#quoDaftar')), 'Status berubah menjadi Disetujui');

  await page.click('#quoDaftar tbody tr');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Terbitkan Invoice")');
  await page.waitForTimeout(600);

  /* ============ 4. INVOICE: CATAT PEMBAYARAN ============ */
  console.log('\n--- 4. Invoice & Pembayaran ---');
  await page.evaluate(() => { location.hash = '#/invoice'; });
  await page.waitForTimeout(700);
  const invTxt = await page.textContent('#invDaftar');
  ok(/INV\/2026\//.test(invTxt), 'Invoice hasil penerbitan dari penawaran muncul di daftar');

  await page.click('#invDaftar tbody tr');
  await page.waitForTimeout(400);
  ok(/Dari QUO/.test(await page.textContent('.drawer')), 'Invoice menyebut nomor penawaran asalnya');

  await page.click('button:has-text("Catat Pembayaran")');
  await page.waitForTimeout(300);
  await page.fill('#invBayarJumlah', '3_000_000'.replace(/_/g, ''));
  await page.selectOption('#invBayarMetode', 'transfer');
  await page.click('button:has-text("Simpan Pembayaran")');
  await page.waitForTimeout(600);
  ok(/Dibayar sebagian/.test(await page.textContent('#invDaftar')), 'Pembayaran sebagian tercatat dan status berubah');

  /* ============ 5. PEMBAYARAN: VERIFIKASI ============ */
  console.log('\n--- 5. Verifikasi Pembayaran ---');
  await page.evaluate(() => { location.hash = '#/payment'; });
  await page.waitForTimeout(700);
  ok(/PT Anugerah Sejahtera/.test(await page.textContent('#payDaftar')), 'Pembayaran tampil di riwayat lintas tagihan');

  ok(errs.length === 0, 'Tanpa galat halaman pada penyewaan & tagihan', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
