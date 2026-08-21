/* Uji layar Ruangan yang tersambung ke API.
 *
 * Yang dijaga: layar ini benar-benar MEMBACA dan MENULIS ke server, bukan
 * hanya tampak begitu. Karena itu server tiruannya menyimpan sungguhan —
 * ruangan yang dibuat lewat formulir harus muncul kembali dari daftar yang
 * ditarik ulang, bukan dari keadaan yang disimpan di peramban.
 */
const { launch } = require('./browser');
const { BASE } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

function apiTiruan() {
  const http = require('http');
  const sesiAktif = new Set();
  let urut = 0;
  let idRuang = 0;
  let idLab = 0;
  const ruangan = [];
  const lab = [];
  const orang = [
    { id: 91, nama: 'Dr. Sri Wahyuni', unit_kerja: 'Litbang' },
    { id: 92, nama: 'Andi Teknisi', unit_kerja: 'Pengujian' },
    { id: 93, nama: 'Rina Teknisi', unit_kerja: 'Pengujian' }
  ];

  const punyaSesi = (req) => {
    const c = (req.headers.cookie || '').match(/flms_sesi=([^;]+)/);
    return !!c && sesiAktif.has(c[1]);
  };

  const bentuk = (r) => ({
    id: r.id, kode: r.kode, nama: r.nama, jenis: r.jenis || null,
    gedung: r.gedung || null, lantai: r.lantai || null,
    luas_m2: r.luas_m2 || null, kapasitas: r.kapasitas || 0,
    tarif: {
      skema: r.skema_tarif || 'internal',
      skema_nama: { internal: 'Internal (tanpa tarif)', berbayar: 'Berbayar',
        internal_gratis: 'Internal gratis, eksternal berbayar',
        terbatas: 'Terbatas / khusus' }[r.skema_tarif || 'internal'],
      nilai: r.tarif === undefined ? null : r.tarif
    },
    status: { kode: r.status || 'tersedia',
      nama: { tersedia: 'Tersedia', pemeliharaan: 'Pemeliharaan', tidak_aktif: 'Tidak aktif' }[r.status || 'tersedia'] },
    perlu_persetujuan: !!r.perlu_persetujuan,
    penanggung_jawab: null,
    tata_letak: r.tata_letak || [],
    fasilitas: r.fasilitas || [],
    keterangan: r.keterangan || null,
    jumlah_booking_aktif: 0
  });

  const bentukLab = (l) => ({
    id: l.id, kode: l.kode, nama: l.nama, jenis: l.jenis || null,
    unit_kerja: l.unit_kerja || null, luas_m2: l.luas_m2 || null,
    kapasitas: l.kapasitas || 0, jam_layanan: l.jam_layanan || null,
    akreditasi: l.akreditasi || null,
    fasilitas: l.fasilitas || [],
    status: { kode: l.status || 'aktif',
      nama: { aktif: 'Aktif', pemeliharaan: 'Pemeliharaan', tidak_aktif: 'Tidak Aktif' }[l.status || 'aktif'] },
    ruangan: null,
    penanggung_jawab: l.penanggung_jawab_id
      ? orang.find((o) => o.id === l.penanggung_jawab_id) || null : null,
    supervisor: l.supervisor_id ? orang.find((o) => o.id === l.supervisor_id) || null : null,
    teknisi: (l.teknisi_ids || []).map((i) => orang.find((o) => o.id === i)).filter(Boolean),
    jumlah_aset: 0,
    keterangan: l.keterangan || null
  });

  const server = http.createServer((req, res) => {
    const asal = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', asal);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept,X-XSRF-TOKEN,X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const kirim = (k, i) => { res.writeHead(k, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(i)); };
    const pengguna = { data: { id: 1, nama: 'Siti Aminah', email: 's@x.id',
      peran: ['facility-manager'], izin: ['master-data.lihat', 'master-data.buat', 'master-data.ubah'] } };

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

    if (req.url.startsWith('/api/rooms')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });

      if (req.method === 'GET') {
        const u = new URL(req.url, 'http://x');
        let baris = ruangan.slice();
        const cari = u.searchParams.get('cari');
        if (cari) {
          const k = cari.toLowerCase();
          baris = baris.filter((r) =>
            (r.nama + ' ' + r.kode + ' ' + (r.gedung || '')).toLowerCase().indexOf(k) !== -1);
        }
        const jenis = u.searchParams.get('jenis');
        if (jenis) baris = baris.filter((r) => r.jenis === jenis);
        return kirim(200, { data: baris.map(bentuk), meta: { total: baris.length } });
      }

      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const galat = {};
          if (!isi.kode) galat.kode = ['Kode ruangan wajib diisi.'];
          if (ruangan.some((r) => r.kode === isi.kode)) galat.kode = ['Kode ruangan sudah dipakai.'];
          if (!isi.nama) galat.nama = ['Nama ruangan wajib diisi.'];
          if (isi.skema_tarif === 'berbayar' && (isi.tarif === null || isi.tarif === undefined)) {
            galat.tarif = ['Tarif wajib diisi bila skemanya berbayar.'];
          }
          if (Object.keys(galat).length) {
            return kirim(422, { message: 'Isian belum benar.', errors: galat });
          }
          isi.id = ++idRuang;
          ruangan.push(isi);
          return kirim(201, { data: bentuk(isi) });
        });
      }
    }

    if (req.url.startsWith('/api/pengguna')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });
      return kirim(200, { data: orang, terpotong: false });
    }

    if (req.url.startsWith('/api/laboratories')) {
      if (!punyaSesi(req)) return kirim(401, { message: 'Unauthenticated.' });

      if (req.method === 'GET') {
        return kirim(200, { data: lab.map(bentukLab), meta: { total: lab.length } });
      }

      if (req.method === 'POST') {
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          if (!isi.kode) return kirim(422, { message: 'x', errors: { kode: ['Kode laboratorium wajib diisi.'] } });
          isi.id = ++idLab;
          lab.push(isi);
          return kirim(201, { data: bentukLab(isi) });
        });
      }

      if (req.method === 'PATCH') {
        const id = Number(req.url.split('/').pop());
        let b = ''; req.on('data', (d) => (b += d));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const l = lab.find((x) => x.id === id);
          if (!l) return kirim(404, { message: 'Tidak ditemukan' });
          Object.assign(l, isi);
          return kirim(200, { data: bentukLab(l) });
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

  /* ============ 1. DAFTAR KOSONG ============ */
  console.log('\n--- 1. Basis data kosong ---');
  await page.evaluate(() => { location.hash = '#/rooms'; });
  await page.waitForTimeout(800);

  const kosong = await page.textContent('#ruangDaftar');
  ok(/Belum ada ruangan/.test(kosong),
    'Basis data kosong ditampilkan apa adanya, bukan diisi data purwarupa');
  ok(!(await page.$('.mode-banner')), 'Tidak ada spanduk data contoh — ini data sungguhan');

  const kpiAwal = await page.textContent('#ruangKpi');
  ok(/\b0\b/.test(kpiAwal), 'Ringkasan menunjukkan nol, bukan angka purwarupa');

  /* ============ 2. VALIDASI SERVER SAMPAI KE FORMULIR ============ */
  console.log('\n--- 2. Validasi server tampil di formulir ---');
  await page.click('#ruangDaftar button');   // "Tambah Ruangan Pertama"
  await page.waitForTimeout(400);
  ok(!!(await page.$('#fKode')), 'Formulir tambah ruangan terbuka');

  await page.fill('#fNama', 'Tanpa Kode');
  await page.click('#ruangSimpan');
  await page.waitForTimeout(600);

  const galat = await page.$('#ruangFormGalat');
  const galatTampil = galat ? await galat.isVisible() : false;
  ok(galatTampil, 'Galat dari server tampil di dalam formulir');
  const teksGalat = galat ? await galat.textContent() : '';
  ok(/Kode ruangan wajib diisi/.test(teksGalat),
    'Pesannya pesan server, bukan pesan generik', teksGalat.trim());
  ok(!!(await page.$('#fKode')), 'Formulir tetap terbuka agar isian dapat diperbaiki');

  /* ============ 3. SIMPAN SUNGGUHAN ============ */
  console.log('\n--- 3. Menyimpan ke basis data ---');
  await page.fill('#fKode', 'CR-B-401');
  await page.fill('#fNama', 'Conference Room Garuda');
  await page.fill('#fJenis', 'Conference Room');
  await page.fill('#fGedung', 'Gedung B');
  await page.fill('#fLantai', '4');
  await page.fill('#fLuas', '96');
  await page.fill('#fKapasitas', '45');
  await page.selectOption('#fSkema', 'berbayar');
  await page.fill('#fTarif', '1250000');
  await page.fill('#fTataLetak', 'Theater, Classroom, U-Shape');
  await page.fill('#fFasilitas', 'Proyektor 2x, Sound System, Video Conf, AC');
  await page.click('#ruangSimpan');
  await page.waitForTimeout(900);

  ok(!(await page.$('#fKode')), 'Formulir tertutup setelah berhasil');

  const daftar = await page.textContent('#ruangDaftar');
  ok(/Conference Room Garuda/.test(daftar), 'Ruangan muncul di daftar');
  ok(/CR-B-401/.test(daftar), 'Kodenya tampil');
  ok(/Berbayar/.test(daftar), 'Skema tarif tampil terbaca, bukan kode mentah');

  // Bukti bahwa yang tampil datang dari server, bukan dari keadaan peramban.
  const dariServer = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/rooms', { credentials: 'include' });
    return (await r.json()).data.length;
  }, port);
  ok(dariServer === 1, 'Server benar-benar menyimpan satu ruangan', 'jumlah=' + dariServer);

  /* ============ 4. MUAT ULANG — DATA BERTAHAN ============ */
  console.log('\n--- 4. Data bertahan setelah muat ulang ---');
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.evaluate(() => { location.hash = '#/rooms'; });
  await page.waitForTimeout(900);

  const setelahMuat = await page.textContent('#ruangDaftar');
  ok(/Conference Room Garuda/.test(setelahMuat),
    'Ruangan masih ada setelah halaman dimuat ulang — inilah bedanya dengan purwarupa');

  const kpi = await page.textContent('#ruangKpi');
  ok(/45/.test(kpi), 'Ringkasan ikut menghitung dari data sungguhan');

  /* ============ 5. PENYARINGAN LEWAT SERVER ============ */
  console.log('\n--- 5. Penyaringan dijalankan server ---');
  await page.fill('#ruangCari', 'garuda');
  await page.waitForTimeout(800);
  ok(/Conference Room Garuda/.test(await page.textContent('#ruangDaftar')),
    'Pencarian menemukan ruangan');

  await page.fill('#ruangCari', 'tidakadaini');
  await page.waitForTimeout(800);
  const nihil = await page.textContent('#ruangDaftar');
  ok(/tidak ada ruangan yang cocok/i.test(nihil),
    'Kosong karena penyaringan dibedakan dari kosong karena belum ada data');
  ok(/Hapus penyaringan/.test(nihil), 'Menawarkan menghapus penyaringan, bukan menambah data');

  /* ============ 6. DETAIL ============ */
  console.log('\n--- 6. Detail ruangan ---');
  await page.click('#ruangDaftar button');   // hapus penyaringan
  await page.waitForTimeout(800);
  await page.click('.res-card');
  await page.waitForTimeout(500);

  const drawer = await page.textContent('.drawer, .drw, body');
  ok(/Conference Room Garuda/.test(drawer), 'Detail terbuka');
  ok(/Proyektor 2x/.test(drawer), 'Fasilitas yang diisi ikut tersimpan dan tampil');
  ok(/Theater/.test(drawer), 'Tata letak ikut tersimpan dan tampil');

  // Bagian checklist sempat HILANG saat layar ini ditulis ulang, dan tidak
  // ada yang menandainya — persis kemunduran senyap yang paling sulit
  // ketahuan. Dikunci di sini.
  ok(/[Cc]hecklist/.test(drawer), 'Bagian checklist tetap ada pada detail ruangan');

  ok(errs.length === 0, 'Tanpa galat halaman', errs.join(' | '));

  /* ============ 7. LABORATORIUM ============ */
  console.log('\n--- 7. Laboratorium tersambung ---');
  await page.evaluate(() => { UI.closeDrawer(); location.hash = '#/lab'; });
  await page.waitForTimeout(900);

  ok(/Belum ada laboratorium/.test(await page.textContent('#labDaftar')),
    'Basis data kosong ditampilkan apa adanya');

  await page.click('#labDaftar button');
  await page.waitForTimeout(600);
  ok(!!(await page.$('#lKode')), 'Formulir tambah laboratorium terbuka');

  // Pemilih orang terisi dari endpoint /api/pengguna.
  const jumlahOpsiPj = await page.$$eval('#lPj option', (e) => e.length);
  ok(jumlahOpsiPj === 4, 'Pemilih penanggung jawab terisi dari server', 'opsi=' + jumlahOpsiPj);

  await page.fill('#lKode', 'LAB-KIM-01');
  await page.fill('#lNama', 'Laboratorium Kimia Analitik');
  await page.fill('#lJenis', 'Pengujian');
  await page.fill('#lKapasitas', '24');
  await page.fill('#lLuas', '145');
  await page.fill('#lJam', '07:30 - 17:00');
  await page.fill('#lAkreditasi', 'ISO/IEC 17025:2017');
  await page.selectOption('#lPj', '91');
  await page.selectOption('#lTeknisi', ['92', '93']);
  await page.fill('#lFasilitas', 'Fume Hood 4, Emergency Shower, APAR CO2');
  await page.click('#labSimpan');
  await page.waitForTimeout(900);

  ok(!(await page.$('#lKode')), 'Formulir tertutup setelah berhasil');

  const daftarLab = await page.textContent('#labDaftar');
  ok(/Laboratorium Kimia Analitik/.test(daftarLab), 'Laboratorium muncul di daftar');
  ok(/Dr. Sri Wahyuni/.test(daftarLab), 'Penanggung jawab tampil sebagai nama');
  ok(/ISO\/IEC 17025/.test(daftarLab), 'Akreditasi tampil');

  const kpiLab = await page.textContent('#labKpi');
  ok(/Tanpa Penanggung Jawab/.test(kpiLab), 'Ringkasan menyoroti lab tanpa penanggung jawab');

  await page.click('#labDaftar .res-card');
  await page.waitForTimeout(500);
  const drawerLab = await page.textContent('body');
  ok(/Andi Teknisi/.test(drawerLab) && /Rina Teknisi/.test(drawerLab),
    'Kedua teknisi tersimpan dan tampil di detail');
  ok(/Fume Hood 4/.test(drawerLab), 'Fasilitas tersimpan dan tampil');
  ok(/[Cc]hecklist/.test(drawerLab), 'Bagian checklist tetap ada pada detail laboratorium');

  /* --- penyuntingan tidak menghapus teknisi --- */
  await page.click('button:has-text("Ubah")');
  await page.waitForTimeout(700);
  const teknisiTerpilih = await page.$$eval('#lTeknisi option:checked', (e) => e.length);
  ok(teknisiTerpilih === 2, 'Formulir ubah memuat teknisi yang sudah ditugaskan',
    'terpilih=' + teknisiTerpilih);

  await page.fill('#lKapasitas', '30');
  await page.click('#labSimpan');
  await page.waitForTimeout(900);

  await page.click('#labDaftar .res-card');
  await page.waitForTimeout(500);
  const setelahUbah = await page.textContent('body');
  ok(/Andi Teknisi/.test(setelahUbah),
    'Menyunting kapasitas tidak menghapus penugasan teknisi');

  ok(errs.length === 0, 'Tanpa galat halaman pada modul laboratorium', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
