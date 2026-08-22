/* Uji Dashboard & Balanced Scorecard yang tersambung ke API.
 *
 * Yang dijaga: dashboard yang disusun sungguhan tersimpan di server (bukan
 * localStorage seperti purwarupa), widget menampilkan angka yang benar-benar
 * dihitung server, dan BSC menegakkan aturan bobot-berjumlah-100 walau
 * lapisan antarmuka mengizinkan penyimpanan sementara sebelum disetujui
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
  let idDash = 0;
  const dashboards = [];
  const bscObjectives = [];
  let idBscObj = 0;
  const bscIndikator = [];
  let idBscInd = 0;

  const WIDGET = {
    'aset.jumlah': { judul: 'Jumlah aset', izin: 'aset.lihat', bentuk: 'angka', satuan: 'unit' },
    'booking.menunggu': { judul: 'Pemesanan menunggu persetujuan', izin: 'booking-ruangan.lihat', bentuk: 'angka', satuan: 'pengajuan' },
    'kalibrasi.kedaluwarsa': { judul: 'Kalibrasi kedaluwarsa', izin: 'kalibrasi.lihat', bentuk: 'daftar' },
    'ruangan.status': { judul: 'Status ruangan', izin: 'master-data.lihat', bentuk: 'sebaran' },
    'catatan.bebas': { judul: 'Catatan', izin: null, bentuk: 'teks' }
  };

  const punyaSesi = (req) => {
    const c = (req.headers.cookie || '').match(/flms_sesi=([^;]+)/);
    return !!c && sesiAktif.has(c[1]);
  };

  const dataWidget = (kunci) => {
    if (kunci === 'aset.jumlah') return { nilai: 7 };
    if (kunci === 'booking.menunggu') return { nilai: 2 };
    if (kunci === 'kalibrasi.kedaluwarsa') return { nilai: 1, baris: [{ id: 1, judul: 'Neraca Analitik', keterangan: 'kedaluwarsa 1 Jan 2026', status: 'kedaluwarsa' }], terpotong: false };
    if (kunci === 'ruangan.status') return { bagian: [{ kode: 'tersedia', nama: 'Tersedia', jumlah: 3 }, { kode: 'pemeliharaan', nama: 'Pemeliharaan', jumlah: 1 }], nilai: 4 };
    if (kunci === 'catatan.bebas') return { nilai: null };
    return { nilai: null, pesan: 'Perhitungan widget belum tersedia.' };
  };

  const bentukDashboard = (d) => ({
    id: d.id, nama: d.nama,
    jenis: { kode: d.jenis, nama: { operasional: 'Operasional', analitik: 'Analitik', bsc: 'Balanced Scorecard' }[d.jenis] },
    utama: !!d.utama, bersama: false, dapat_disunting: true,
    widgets: d.widgets.map((w) => ({
      id: w.id, widget: w.widget, judul: w.judul || WIDGET[w.widget].judul,
      bentuk: w.bentuk || WIDGET[w.widget].bentuk, satuan: WIDGET[w.widget].satuan || null,
      opsi: w.opsi || null,
      kisi: { kolom: w.kolom, baris: w.baris, lebar: w.lebar, tinggi: w.tinggi },
      data: dataWidget(w.widget)
    }))
  });

  const JENIS_PERSPEKTIF = {
    keuangan: 'Keuangan', pelanggan: 'Pelanggan',
    'proses-internal': 'Proses Bisnis Internal', pembelajaran: 'Pembelajaran & Pertumbuhan'
  };
  const POLARITAS = { 'naik-baik': 'Semakin tinggi semakin baik', 'turun-baik': 'Semakin rendah semakin baik' };

  const capaian = (i) => {
    if (i.realisasi === null || i.realisasi === undefined) return null;
    const rasio = i.polaritas === 'turun-baik'
      ? (i.realisasi === 0 ? 1 : i.target / i.realisasi)
      : i.realisasi / i.target;
    return Math.round(rasio * 10000) / 100;
  };

  const kartuBsc = (periode) => {
    const perspektif = Object.keys(JENIS_PERSPEKTIF).map((kode) => {
      const sasaran = bscObjectives.filter((o) => o.periode === periode && o.perspektif === kode);
      const indikator = sasaran.flatMap((o) => bscIndikator.filter((i) => i.bsc_objective_id === o.id));
      const terisi = indikator.filter((i) => i.realisasi !== null && i.realisasi !== undefined);
      const bobotTerisi = terisi.reduce((a, i) => a + i.bobot, 0);
      const skor = bobotTerisi > 0
        ? Math.round((terisi.reduce((a, i) => a + Math.min(120, capaian(i)) * i.bobot, 0) / bobotTerisi) * 100) / 100
        : null;
      return {
        kode, nama: JENIS_PERSPEKTIF[kode],
        bobot_total: Math.round(indikator.reduce((a, i) => a + i.bobot, 0) * 100) / 100,
        skor,
        sasaran: sasaran.map((o) => ({
          id: o.id, nama: o.nama,
          indikator: bscIndikator.filter((i) => i.bsc_objective_id === o.id).map((i) => ({
            id: i.id, nama: i.nama, satuan: i.satuan,
            polaritas: { kode: i.polaritas, nama: POLARITAS[i.polaritas] },
            target: i.target, realisasi: i.realisasi, bobot: i.bobot, capaian: capaian(i), catatan: i.catatan
          }))
        }))
      };
    });
    const skorTerisi = perspektif.map((p) => p.skor).filter((s) => s !== null);
    const skor = skorTerisi.length ? Math.round((skorTerisi.reduce((a, b) => a + b, 0) / skorTerisi.length) * 100) / 100 : null;
    return { periode, perspektif, skor };
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
      peran: ['facility-manager'], izin: ['dashboard.lihat', 'dashboard.kelola', 'dashboard.ubah',
        'aset.lihat', 'booking-ruangan.lihat', 'kalibrasi.lihat', 'master-data.lihat'] } };

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

    if (req.url.startsWith('/api/dashboard/widget-tersedia')) {
      return kirim(200, { data: Object.keys(WIDGET).map((k) => ({ kunci: k, ...WIDGET[k] })) });
    }
    if (req.url.startsWith('/api/dashboard/utama')) {
      let d = dashboards.find((x) => x.utama);
      if (!d) {
        d = { id: ++idDash, nama: 'Dashboard Saya', jenis: 'operasional', utama: true,
          widgets: [{ id: 1, widget: 'aset.jumlah', kolom: 0, baris: 0, lebar: 3, tinggi: 2 }] };
        dashboards.push(d);
      }
      return kirim(200, { data: bentukDashboard(d) });
    }
    if (req.url.startsWith('/api/dashboard/')) {
      const id = Number(req.url.split('/').pop().split('?')[0]);
      const d = dashboards.find((x) => x.id === id);

      if (req.method === 'GET') {
        if (!d) return kirim(404, { message: 'Tidak ditemukan' });
        return kirim(200, { data: bentukDashboard(d) });
      }
      if (req.method === 'PUT') {
        let b = ''; req.on('data', (x) => (b += x));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          if (!d) return kirim(404, { message: 'Tidak ditemukan' });
          d.nama = isi.nama; d.jenis = isi.jenis || d.jenis;
          d.widgets = isi.widgets.map((w, i) => ({ id: i + 1, ...w }));
          return kirim(200, { data: bentukDashboard(d) });
        });
      }
      if (req.method === 'DELETE') {
        const i = dashboards.findIndex((x) => x.id === id);
        if (i >= 0) dashboards.splice(i, 1);
        return kirim(200, { pesan: 'Dashboard dihapus.' });
      }
    }
    if (req.url.startsWith('/api/dashboard')) {
      if (req.method === 'GET') {
        return kirim(200, { data: dashboards.map(bentukDashboard) });
      }
      if (req.method === 'POST') {
        let b = ''; req.on('data', (x) => (b += x));
        return req.on('end', () => {
          const isi = JSON.parse(b || '{}');
          const d = { id: ++idDash, nama: isi.nama, jenis: isi.jenis || 'operasional', utama: false,
            widgets: (isi.widgets || []).map((w, i) => ({ id: i + 1, ...w })) };
          dashboards.push(d);
          return kirim(201, { data: bentukDashboard(d) });
        });
      }
    }

    if (req.url.startsWith('/api/bsc/perspektif') && req.method === 'PUT') {
      let b = ''; req.on('data', (x) => (b += x));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        const totalBobot = (isi.objectives || []).reduce(
          (a, o) => a + (o.indikator || []).reduce((bb, i) => bb + Number(i.bobot || 0), 0), 0);

        if (isi.objectives.length && Math.round(totalBobot * 100) / 100 !== 100) {
          return kirim(422, { message: 'x', errors: {
            objectives: ['Bobot indikator dalam satu perspektif harus berjumlah 100, saat ini ' + totalBobot + '.'] } });
        }

        // tulis ulang: hapus sasaran+indikator lama pada perspektif/periode ini
        const lamaId = bscObjectives.filter((o) => o.periode === isi.periode && o.perspektif === isi.perspektif).map((o) => o.id);
        const lamaByNama = {};
        bscIndikator.filter((i) => lamaId.includes(i.bsc_objective_id)).forEach((i) => { lamaByNama[i.nama.toLowerCase()] = i; });
        for (let k = bscObjectives.length - 1; k >= 0; k--) {
          if (bscObjectives[k].periode === isi.periode && bscObjectives[k].perspektif === isi.perspektif) bscObjectives.splice(k, 1);
        }
        for (let k = bscIndikator.length - 1; k >= 0; k--) {
          if (lamaId.includes(bscIndikator[k].bsc_objective_id)) bscIndikator.splice(k, 1);
        }

        (isi.objectives || []).forEach((o) => {
          const obj = { id: ++idBscObj, periode: isi.periode, perspektif: isi.perspektif, nama: o.nama };
          bscObjectives.push(obj);
          (o.indikator || []).forEach((i) => {
            const lama = lamaByNama[i.nama.toLowerCase()];
            bscIndikator.push({
              id: ++idBscInd, bsc_objective_id: obj.id, nama: i.nama, satuan: i.satuan || null,
              polaritas: i.polaritas, target: Number(i.target), bobot: Number(i.bobot),
              catatan: i.catatan || null,
              realisasi: 'realisasi' in i ? i.realisasi : (lama ? lama.realisasi : null)
            });
          });
        });

        return kirim(200, { data: kartuBsc(isi.periode) });
      });
    }
    if (req.url.match(/^\/api\/bsc\/indikator\/\d+\/realisasi/) && req.method === 'PATCH') {
      const id = Number(req.url.split('/')[4]);
      let b = ''; req.on('data', (x) => (b += x));
      return req.on('end', () => {
        const isi = JSON.parse(b || '{}');
        const ind = bscIndikator.find((i) => i.id === id);
        if (!ind) return kirim(404, { message: 'Tidak ditemukan' });
        ind.realisasi = isi.realisasi;
        return kirim(200, { data: { id: ind.id, nama: ind.nama, realisasi: ind.realisasi, capaian: capaian(ind) } });
      });
    }
    if (req.url.startsWith('/api/bsc')) {
      const u = new URL(req.url, 'http://x');
      const periode = u.searchParams.get('periode') || String(new Date().getFullYear());
      return kirim(200, { data: kartuBsc(periode) });
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

  /* ============ 1. DASHBOARD MENAMPILKAN DATA SUNGGUHAN ============ */
  console.log('\n--- 1. Dashboard menampilkan data sungguhan ---');
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(900);

  ok(!(await page.$('.mode-banner')), 'Tidak ada spanduk data contoh — dashboard ini sungguhan');
  const hostTxt = await page.textContent('#dashHostLive');
  ok(/7/.test(hostTxt), 'Widget "Jumlah aset" menampilkan angka dari server (7), bukan angka purwarupa');

  /* ============ 2. MENAMBAH WIDGET & MENYIMPAN ============ */
  console.log('\n--- 2. Menambah widget tersimpan ke server ---');
  await page.click('#btnEditLive');
  await page.waitForTimeout(400);
  await page.click('.wdg-add');
  await page.waitForTimeout(400);
  ok(!!(await page.$('#dashFormBody')), 'Formulir tambah widget terbuka');

  await page.selectOption('#dashFormBody select', 'ruangan.status');
  await page.waitForTimeout(200);
  await page.click('button:has-text("Tambahkan")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Selesai")');
  await page.waitForTimeout(700);

  const dariServer = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/dashboard/1', { credentials: 'include' });
    return (await r.json()).data.widgets.length;
  }, port);
  ok(dariServer === 2, 'Server benar-benar menyimpan widget baru', 'jumlah widget=' + dariServer);

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(700);
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(900);
  ok(/Status ruangan/.test(await page.textContent('#dashHostLive')),
    'Widget yang ditambahkan masih ada setelah halaman dimuat ulang — bukan localStorage purwarupa');

  /* ============ 3. BALANCED SCORECARD: BOBOT DITEGAKKAN SERVER ============ */
  console.log('\n--- 3. Balanced Scorecard tersambung ---');
  await page.evaluate(() => { location.hash = '#/bsc'; });
  await page.waitForTimeout(900);

  ok(/belum terisi|—/.test(await page.textContent('#bscHostLive')), 'Skor kosong ditampilkan apa adanya');

  await page.click('button:has-text("Kelola")');
  await page.waitForTimeout(500);
  ok(!!(await page.$('#bscFormBody')), 'Formulir kelola sasaran & indikator terbuka');

  await page.fill('#bscFormBody input[placeholder="Nama sasaran strategis *"]', 'Meningkatkan mutu layanan');
  await page.fill('#bscFormBody input[placeholder="Nama indikator *"]', 'Indeks kepuasan');
  await page.fill('#bscFormBody input[placeholder="Target *"]', '90');
  await page.fill('#bscFormBody input[placeholder="Bobot % *"]', '60');   // sengaja bukan 100
  await page.click('#bscFormSimpan');
  await page.waitForTimeout(600);

  const galat = await page.textContent('#bscFormGalat').catch(() => '');
  ok(/berjumlah 100/.test(galat), 'Server menolak bobot yang tidak berjumlah 100', galat.trim());

  await page.fill('#bscFormBody input[placeholder="Bobot % *"]', '100');
  await page.click('#bscFormSimpan');
  await page.waitForTimeout(700);

  ok(!(await page.$('#bscFormBody')), 'Formulir tertutup setelah tersimpan dengan bobot benar');
  const kartuTxt = await page.textContent('#bscHostLive');
  ok(/Indeks kepuasan/.test(kartuTxt), 'Indikator baru tampil pada tabel KPI');

  /* ============ 4. REALISASI MENGUBAH SKOR ============ */
  console.log('\n--- 4. Mengisi realisasi mengubah skor ---');
  const idIndikator = await page.evaluate(async (p) => {
    const r = await fetch('http://127.0.0.1:' + p + '/api/bsc?periode=' + new Date().getFullYear(), { credentials: 'include' });
    const j = await r.json();
    return j.data.perspektif.find((x) => x.sasaran.length)?.sasaran[0].indikator[0].id;
  }, port);

  await page.evaluate((id) => bscIsiRealisasiLive(id, null), idIndikator);
  await page.waitForTimeout(400);
  await page.fill('#bscRealisasi', '81');
  await page.click('button:has-text("Simpan")');
  await page.waitForTimeout(700);

  ok(/81/.test(await page.textContent('#bscHostLive')), 'Realisasi yang baru diisi tampil pada kartu skor');

  ok(errs.length === 0, 'Tanpa galat halaman pada dashboard & BSC', errs.join(' | '));

  server.close();
  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
