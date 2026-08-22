/* Uji fungsional: dashboard dapat disunting, analitik kustom, BSC, checklist, email jadwal */
const { launch } = require('./browser');
const { BASE, SHOT, lib } = require('./config');
let fail = 0;
const ok = (c, m, x) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (x ? ' — ' + x : '')); };

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 980 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  const clean = (label) => { ok(errs.length === 0, label, errs.join(' | ')); errs.length = 0; };

  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.click('button[type=submit]');
  await page.waitForTimeout(700);

  /* ============ 1. DASHBOARD DAPAT DISUNTING ============ */
  console.log('\n--- 1. Dashboard dapat disunting ---');
  await page.evaluate(() => { location.hash = '#/dashboard'; }); await page.waitForTimeout(500);
  const n0 = await page.$$eval('.wdg', e => e.length);
  ok(n0 >= 12, `Dashboard operasional memuat ${n0} widget`);

  await page.evaluate(() => DASH.toggleEdit()); await page.waitForTimeout(400);
  const editing = await page.$eval('.dash-grid', e => e.classList.contains('editing'));
  const tools = await page.$$eval('.wdg-tools', e => e.length);
  const handles = await page.$$eval('.wdg-resize', e => e.length);
  ok(editing && tools === n0 && handles === n0, `Mode sunting: ${tools} panel alat, ${handles} pegangan ubah ukuran`);

  // --- ubah isi & bentuk tampilan lewat formulir
  const firstChart = await page.evaluate(() => {
    const d = DASH.get('ops');
    return d.widgets.find(w => w.type === 'line').id;
  });
  await page.evaluate(id => DASH.editWidget(id), firstChart); await page.waitForTimeout(350);
  await page.evaluate(() => DASH.draft('title', 'Tren Utilisasi (diubah)')); await page.waitForTimeout(200);
  await page.evaluate(() => DASH.draft('type', 'bar')); await page.waitForTimeout(250);
  await page.evaluate(() => DASH.draft('w', 6)); await page.waitForTimeout(150);
  await page.evaluate(() => DASH.draft('h', 260)); await page.waitForTimeout(150);
  await page.evaluate(id => DASH.saveWidget(id), firstChart); await page.waitForTimeout(400);
  const changed = await page.evaluate(id => {
    const w = DASH.get('ops').widgets.find(x => x.id === id);
    const el = document.querySelector(`.wdg[data-id="${id}"]`);
    return { t: w.title, type: w.type, w: w.w, h: w.h, css: el.style.gridColumn, hpx: el.style.height };
  }, firstChart);
  ok(changed.t === 'Tren Utilisasi (diubah)', 'Isi konten (judul) berubah', changed.t);
  ok(changed.type === 'bar', 'Bentuk penampilan data berubah (garis → batang)');
  ok(changed.w === 6 && changed.css === 'span 6', 'Lebar berubah menjadi 6 kolom', changed.css);
  ok(changed.h === 260 && changed.hpx === '260px', 'Tinggi berubah menjadi 260 px', changed.hpx);

  // --- ubah ukuran dengan menyeret pegangan
  const before = await page.evaluate(() => {
    const w = DASH.get('ops').widgets[0];
    return { id: w.id, w: w.w, h: w.h };
  });
  const hbox = await page.evaluate(id => {
    const el = document.querySelector(`.wdg[data-id="${id}"] .wdg-resize`);
    const r = el.getBoundingClientRect();
    const p = el.closest('.wdg').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: p.left, top: p.top };
  }, before.id);
  await page.mouse.move(hbox.x, hbox.y);
  await page.mouse.down();
  await page.mouse.move(hbox.x + 260, hbox.y + 90, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after = await page.evaluate(id => {
    const w = DASH.get('ops').widgets.find(x => x.id === id); return { w: w.w, h: w.h };
  }, before.id);
  ok(after.w > before.w && after.h > before.h,
    `Seret pegangan mengubah ukuran: ${before.w}kol/${before.h}px → ${after.w}kol/${after.h}px`);

  // --- susun ulang dengan seret-lepas
  const order0 = await page.evaluate(() => DASH.get('ops').widgets.map(w => w.id));
  const dragBox = await page.evaluate(id => {
    const el = document.querySelector(`.wdg[data-id="${id}"] .wdg-drag`);
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, order0[0]);
  const targetBox = await page.evaluate(id => {
    const r = document.querySelector(`.wdg[data-id="${id}"]`).getBoundingClientRect();
    return { x: r.left + r.width * 0.75, y: r.top + r.height / 2 };
  }, order0[3]);
  await page.mouse.move(dragBox.x, dragBox.y);
  await page.mouse.down();
  await page.mouse.move((dragBox.x + targetBox.x) / 2, (dragBox.y + targetBox.y) / 2, { steps: 8 });
  await page.mouse.move(targetBox.x, targetBox.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const order1 = await page.evaluate(() => DASH.get('ops').widgets.map(w => w.id));
  ok(order1.join() !== order0.join(), 'Seret-lepas menyusun ulang widget',
    `${order0.indexOf(order0[0])} → ${order1.indexOf(order0[0])}`);

  // --- tambah & hapus widget
  await page.evaluate(() => DASH.addWidget()); await page.waitForTimeout(300);
  await page.evaluate(() => { DASH.draft('title', 'Widget Uji'); DASH.draft('type', 'donut'); });
  await page.waitForTimeout(250);
  await page.evaluate(() => DASH.saveWidget('')); await page.waitForTimeout(400);
  const nAdd = await page.$$eval('.wdg', e => e.length);
  ok(nAdd === n0 + 1, `Tambah widget: ${n0} → ${nAdd}`);
  const newId = await page.evaluate(() => DASH.get('ops').widgets.slice(-1)[0].id);
  await page.evaluate(id => DASH.delWidget(id), newId); await page.waitForTimeout(400);
  ok(await page.$$eval('.wdg', e => e.length) === n0, 'Hapus widget kembali ke jumlah semula');

  // --- persistensi setelah muat ulang
  await page.evaluate(() => DASH.toggleEdit()); await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(800);
  const persisted = await page.evaluate(id => {
    const w = DASH.get('ops').widgets.find(x => x.id === id); return w ? w.title : null;
  }, firstChart);
  ok(persisted === 'Tren Utilisasi (diubah)', 'Perubahan bertahan setelah muat ulang halaman');
  clean('Dashboard tanpa error');

  // kembalikan bawaan agar uji berikutnya bersih
  await page.evaluate(() => { DASH.reset('ops'); });

  /* ============ 2. DASHBOARD ANALITIK KUSTOM ============ */
  console.log('\n--- 2. Dashboard analitik yang dikelola sendiri ---');
  await page.evaluate(() => { location.hash = '#/analytics'; }); await page.waitForTimeout(500);
  const dashN0 = await page.evaluate(() => DASH.list().length);
  await page.evaluate(() => dashNew()); await page.waitForTimeout(300);
  await page.evaluate(() => { document.getElementById('dnName').value = 'Analitik Uji Otomatis'; dashNewGo(); });
  await page.waitForTimeout(600);
  const dashN1 = await page.evaluate(() => DASH.list().length);
  ok(dashN1 === dashN0 + 1, `Buat dashboard baru: ${dashN0} → ${dashN1}`);
  const emptyN = await page.$$eval('.wdg', e => e.length);
  ok(emptyN === 0, 'Dashboard baru dimulai kosong');

  await page.evaluate(() => DASH.addWidget()); await page.waitForTimeout(300);
  await page.evaluate(() => { DASH.draft('type', 'hbars'); DASH.draft('source', 'labUtil'); DASH.draft('title', 'Utilisasi Lab'); });
  await page.waitForTimeout(300);
  await page.evaluate(() => DASH.saveWidget('')); await page.waitForTimeout(500);
  ok(await page.$$eval('.wdg', e => e.length) === 1, 'Widget dapat ditambahkan ke dashboard kustom');

  const tabsN = await page.$$eval('#dashTabs .chip', e => e.length);
  ok(tabsN >= dashN1, `Pemilih dashboard menampilkan ${tabsN} pilihan`);
  await page.evaluate(() => dashDelGo()); await page.waitForTimeout(500);
  ok(await page.evaluate(() => DASH.list().length) === dashN0, 'Dashboard kustom dapat dihapus');
  clean('Dashboard analitik tanpa error');

  /* ============ 3. BALANCED SCORECARD ============ */
  console.log('\n--- 3. Balanced Scorecard ---');
  await page.evaluate(() => { location.hash = '#/bsc'; }); await page.waitForTimeout(600);
  const bsc = await page.evaluate(() => ({
    total: DB.bscTotal(),
    persp: DB.bsc.perspectives.map(p => ({ n: p.name, w: p.weight, s: DB.bscPerspectiveScore(p) })),
    bobot: DB.bsc.perspectives.reduce((a, p) => a + p.weight, 0),
    kpi: DASH.bscRows().length,
    widgets: document.querySelectorAll('.wdg').length,
    mapSvg: !!document.querySelector('.wdg svg')
  }));
  ok(bsc.persp.length === 4, 'Empat perspektif tersedia', bsc.persp.map(p => p.n).join(', '));
  ok(bsc.bobot === 100, 'Total bobot perspektif = 100%', bsc.bobot + '%');
  ok(bsc.kpi >= 15, `${bsc.kpi} indikator kinerja terdaftar`);
  ok(bsc.total > 0 && bsc.total <= 120, `Skor keseluruhan terhitung: ${bsc.total}`);
  ok(bsc.mapSvg, 'Peta strategi dirender');

  // verifikasi rumus tertimbang secara mandiri
  const manual = await page.evaluate(() => {
    let sum = 0, w = 0;
    DB.bsc.perspectives.forEach(p => { sum += DB.bscPerspectiveScore(p) * p.weight; w += p.weight; });
    return Math.round((sum / w) * 10) / 10;
  });
  ok(Math.abs(manual - bsc.total) < 0.05, 'Skor total = rata-rata tertimbang perspektif', `${manual} vs ${bsc.total}`);

  // ubah realisasi → skor harus berubah
  const before3 = bsc.total;
  await page.evaluate(() => { DB.bsc.perspectives[0].objectives[0].kpis[0].actual = 600; DASH.repaint(); });
  await page.waitForTimeout(400);
  const after3 = await page.evaluate(() => DB.bscTotal());
  ok(after3 > before3, `Mengubah realisasi memperbarui skor: ${before3} → ${after3}`);
  await page.evaluate(() => { DB.bsc.perspectives[0].objectives[0].kpis[0].actual = 490; DASH.repaint(); });

  await page.evaluate(() => bscManagePurwarupa()); await page.waitForTimeout(350);
  ok(await page.$('.modal') !== null, 'Panel kelola sasaran & KPI terbuka');
  await page.evaluate(() => UI.closeModal());
  clean('BSC tanpa error');

  /* ============ 4. CHECKLIST ============ */
  // Modul ini kini tersambung ke API sungguhan (lihat Repo.checklist). Di
  // mode data contoh (purwarupa), setiap aksi tulis — buat template,
  // tugaskan, mulai/isi/selesaikan pelaksanaan — ditolak secara sengaja
  // (bukan disimulasikan), persis seperti modul-modul lain yang sudah
  // tersambung. Uji ini karenanya memverifikasi: (a) daftar & detail
  // templat terbaca dari data contoh yang dipetakan ke bentuk API asli,
  // (b) "Checklist Saya" menampilkan tugas milik pengguna yang masuk, dan
  // (c) upaya menjalankan checklist di mode contoh ditolak dengan pesan
  // yang jelas, bukan diam-diam "berhasil". Alur tulis sungguhan (buat
  // templat → tugaskan → mulai → jawab → selesaikan) diuji end-to-end
  // lewat server tiruan di tests/ruangan.js.
  console.log('\n--- 4. Checklist ---');
  await page.evaluate(() => { location.hash = '#/checklist'; }); await page.waitForTimeout(500);
  const ck = await page.evaluate(() => ({
    tpl: DB.checklistTemplates.length,
    jenis: DB.checklistTypes.length,
    kartu: document.querySelectorAll('#ckTplDaftar .card').length,
    tombolBuat: !!document.querySelector('[onclick^="ckTemplatForm"]')
  }));
  ok(ck.jenis === 6, `Enam jenis checklist: ${await page.evaluate(() => DB.checklistTypes.map(t => t.n).join(', '))}`);
  ok(ck.tpl >= 6, `${ck.tpl} template checklist tersedia`);
  ok(ck.kartu === ck.tpl, `Seluruh template dirender sebagai kartu: ${ck.kartu}/${ck.tpl}`);
  ok(!ck.tombolBuat, 'Tombol "Buat Template" tersembunyi di mode data contoh (aksi tulis)');

  // buka detail satu template -> harus memuat lewat Repo.checklist.lihatTemplat
  // (dipetakan dari data contoh) dan menampilkan seluruh butirnya
  const tplId = await page.evaluate(() => DB.checklistTemplates[0].id);
  const tplButirAsli = await page.evaluate(() => DB.checklistTemplates[0].items.length);
  await page.evaluate(id => ckLihatTemplat(id), tplId); await page.waitForTimeout(400);
  const drawerTpl = await page.$eval('.drawer', e => e.innerText);
  ok(new RegExp(tplButirAsli + ' butir').test(drawerTpl),
    `Detail template menampilkan ${tplButirAsli} butir sesuai data`);
  await page.evaluate(() => UI.closeDrawer());
  clean('Detail template checklist tanpa error');

  // "Checklist Saya" -> tugas milik pengguna yang sedang masuk
  await page.evaluate(() => { location.hash = '#/mychecklist'; }); await page.waitForTimeout(500);
  const mineN = await page.$$eval('#ckmTugas .card', e => e.length);
  ok(mineN >= 1, `Checklist Saya menampilkan ${mineN} tugas milik pengguna yang masuk`);

  // upaya menjalankan checklist di mode contoh -> ditolak, bukan disimulasikan
  await page.evaluate(() => document.querySelector('#ckmTugas .card [onclick^="ckMulaiDariPenugasan"]').click());
  await page.waitForTimeout(400);
  const tolakTxt = await page.$eval('.toasts', e => e.innerText).catch(() => '');
  ok(/hanya bisa setelah masuk dengan akun/.test(tolakTxt),
    'Menjalankan checklist di mode contoh ditolak dengan pesan yang jelas');
  ok(await page.$('.drawer') === null, 'Tidak ada formulir pelaksanaan yang terbuka setelah ditolak');
  clean('Checklist Saya tanpa error');

  // checklist melekat pada resource muncul di drawer
  await page.evaluate(() => { location.hash = '#/lab'; }); await page.waitForTimeout(400);
  await page.evaluate(() => showLab('LAB-001')); await page.waitForTimeout(400);
  const drawerTxt = await page.$eval('.drawer', e => e.innerText);
  ok(/CHECKLIST YANG MELEKAT/.test(drawerTxt), 'Checklist tampil pada detail laboratorium');
  await page.evaluate(() => UI.closeDrawer());

  /* ============ 5. NOTIFIKASI EMAIL JADWAL ============ */
  console.log('\n--- 5. Notifikasi email seluruh jadwal ---');
  await page.evaluate(() => { location.hash = '#/emailsched'; }); await page.waitForTimeout(600);
  const em = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#viewBody table.tbl'))[0]
      .querySelectorAll('tbody tr');
    const srcs = new Set();
    rows.forEach(r => srcs.add(r.querySelector('td .badge') ? r.querySelector('td .badge').textContent.trim() : ''));
    const emails = Array.from(rows).map(r => r.innerText).filter(t => /@/.test(t)).length;
    return { rows: rows.length, srcs: Array.from(srcs).filter(Boolean), emails };
  });
  ok(em.rows >= 30, `${em.rows} jadwal terpetakan ke email`);
  const wajib = ['Booking', 'Reservasi Alat', 'Maintenance', 'Kalibrasi', 'Peminjaman', 'Checklist', 'Event', 'Agenda'];
  const kurang = wajib.filter(s => !em.srcs.includes(s));
  ok(kurang.length === 0, `Seluruh sumber jadwal tercakup: ${em.srcs.join(', ')}`,
    kurang.length ? 'kurang: ' + kurang.join(', ') : '');
  ok(em.emails === em.rows, `Setiap baris memuat alamat email penanggung jawab (${em.emails}/${em.rows})`);

  await page.evaluate(() => mailPreview('kalibrasi', 'Uji', 'Alat Uji', 'EMP-0003', DB.shift(1), '09:00'));
  await page.waitForTimeout(350);
  const prev = await page.$eval('.modal', e => e.innerText);
  ok(/Bayu Prakoso/.test(prev) && /@/.test(prev), 'Pratinjau email menampilkan penerima dan isinya');
  await page.evaluate(() => UI.closeModal());

  await page.evaluate(() => mailDigest('EMP-0003')); await page.waitForTimeout(400);
  const dig = await page.$eval('.modal', e => e.innerText);
  ok(/Ringkasan/i.test(dig) && /jadwal/i.test(dig), 'Ringkasan harian per penanggung jawab tersedia');
  await page.evaluate(() => UI.closeModal());
  clean('Notifikasi email tanpa error');

  /* ---- tangkapan layar ---- */
  for (const [r, f] of [['dashboard', 'f-dash.png'], ['analytics', 'f-analytics.png'], ['bsc', 'f-bsc.png'],
                        ['checklist', 'f-checklist.png'], ['mychecklist', 'f-mychecklist.png'],
                        ['emailsched', 'f-email.png']]) {
    await page.evaluate(h => { location.hash = h; }, '#/' + r);
    await page.waitForTimeout(600);
    await page.screenshot({ path: SHOT + '' + f });
  }
  await page.evaluate(() => { location.hash = '#/dashboard'; }); await page.waitForTimeout(400);
  await page.evaluate(() => DASH.toggleEdit()); await page.waitForTimeout(500);
  await page.screenshot({ path: SHOT + 'f-dash-edit.png' });

  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
