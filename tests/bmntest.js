/* Uji fungsional fitur BMN: registrasi, unggah foto, studio label, decode barcode label */
const { launch } = require('./browser');
const { BASE, SHOT, lib } = require('./config');

let fail = 0;
const ok = (c, m, extra) => { if (!c) fail++; console.log((c ? '✅ ' : '❌ ') + m + (extra ? ' — ' + extra : '')); };

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });

  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.click('button[type=submit]');
  await page.waitForTimeout(700);
  await page.addScriptTag({ path: lib.jsqr });
  await page.addScriptTag({ path: lib.zxing });

  /* ---------- 1. Register BMN ---------- */
  await page.evaluate(() => { location.hash = '#/bmn'; }); await page.waitForTimeout(400);
  const bmnRows = await page.$$eval('#viewBody table.tbl tbody tr', r => r.length);
  ok(bmnRows >= 30, `Register BMN memuat ${bmnRows} baris`);
  const firstKey = await page.$eval('#viewBody table.tbl tbody tr td .mono', e => e.textContent.trim());
  ok(/^\d{3}\.\d{2}\.\d{4}\.\d{6}\.000\.\d\.\d{2}\.\d{2}\.\d{2}\.\d{3}\.\d{5}$/.test(firstKey),
    'Format kunci utama BMN benar', firstKey);

  /* ---------- 2. Referensi kode barang ---------- */
  await page.evaluate(() => bmnRefModal()); await page.waitForTimeout(250);
  const refN = await page.$$eval('#refList table.tbl tbody tr', r => r.length);
  ok(refN > 10, `Referensi kode barang menampilkan ${refN} kode`);
  await page.evaluate(() => { document.getElementById('refBid').value = '3.10'; bmnRefFilter(); });
  await page.waitForTimeout(200);
  const refFiltered = await page.$$eval('#refList table.tbl tbody tr td .mono', e => e.map(x => x.textContent.trim()));
  ok(refFiltered.length > 0 && refFiltered.every(k => k.startsWith('3.10.')),
    'Filter bidang 3.10 (Komputer) bekerja', refFiltered.join(', '));
  await page.evaluate(() => UI.closeModal());

  /* ---------- 3. Detail BMN ---------- */
  errs.length = 0;
  await page.evaluate(() => showBmnDetailPurwarupa('EQ-0001')); await page.waitForTimeout(300);
  const drawerTxt = await page.$eval('.drawer', e => e.innerText);
  ok(/Kode Lokasi/.test(drawerTxt) && /NUP/.test(drawerTxt) && /Masa Manfaat/.test(drawerTxt)
     && /Akumulasi Penyusutan/.test(drawerTxt) && /Status Penggunaan/.test(drawerTxt),
    'Detail BMN memuat kolom wajib penatausahaan');
  ok(errs.length === 0, 'Detail BMN tanpa error', errs.join('|'));
  await page.evaluate(() => UI.closeDrawer());

  /* ---------- 4. Form registrasi + unggah foto ---------- */
  errs.length = 0;
  await page.evaluate(() => { location.hash = '#/equipment/new'; }); await page.waitForTimeout(400);
  const secN = await page.$$eval('#viewBody .card-head h3', e => e.length);
  ok(secN >= 7, `Form registrasi punya ${secN} kartu bagian`);

  await page.evaluate(() => { regSet('nama', 'HPLC Uji Otomatis'); regSet('merk', 'Shimadzu'); regSet('sn', 'AUTO-123'); });
  await page.waitForTimeout(150);
  await page.evaluate(() => regPickKode('3.08.01.24.006')); await page.waitForTimeout(300);
  const prev = await page.$eval('#regPreview', e => e.innerText);
  ok(/3\.08\.01\.24\.006/.test(prev), 'Pemilihan kode barang memperbarui pratinjau');
  ok(/X-Ray|Difraksi/i.test(prev), 'Uraian barang ikut terisi otomatis');

  // unggah gambar sungguhan lewat input file
  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  await page.setInputFiles('#regFile', [
    { name: 'alat-depan.png', mimeType: 'image/png', buffer: png1x1 },
    { name: 'alat-belakang.png', mimeType: 'image/png', buffer: png1x1 }
  ]);
  await page.waitForTimeout(500);
  const phN = await page.$$eval('#regFotoWrap .ph', e => e.length);
  ok(phN === 2, `Unggah 2 foto berhasil (terbaca ${phN})`);
  const mainN = await page.$$eval('#regFotoWrap .ph-main', e => e.length);
  ok(mainN === 1, 'Tepat satu foto ditandai utama');
  await page.evaluate(() => regFotoMain(1)); await page.waitForTimeout(200);
  const mainIdx = await page.$$eval('#regFotoWrap .ph', els => els.findIndex(e => e.querySelector('.ph-main')));
  ok(mainIdx === 1, 'Ganti foto utama bekerja');
  await page.evaluate(() => regFotoDel(0)); await page.waitForTimeout(200);
  const phN2 = await page.$$eval('#regFotoWrap .ph', e => e.length);
  ok(phN2 === 1, 'Hapus foto bekerja');
  ok(errs.length === 0, 'Form registrasi tanpa error', errs.join('|'));

  /* ---------- 5. Studio label — desainer internal ---------- */
  errs.length = 0;
  await page.evaluate(() => { location.hash = '#/barcode'; }); await page.waitForTimeout(500);
  const previewBox = await page.$eval('#lblPreview .lbl', e => {
    const r = e.getBoundingClientRect(); return { w: r.width, h: r.height };
  });
  // 50 × 25 mm pada 96dpi = 188.98 × 94.49 px
  ok(Math.abs(previewBox.w - 50 * 96 / 25.4) < 2 && Math.abs(previewBox.h - 25 * 96 / 25.4) < 2,
    'Ukuran label 50×25 mm dirender sesuai skala', `${previewBox.w.toFixed(1)}×${previewBox.h.toFixed(1)} px`);

  await page.evaluate(() => lblPreset(70, 35)); await page.waitForTimeout(300);
  const box2 = await page.$eval('#lblPreview .lbl', e => e.getBoundingClientRect().width);
  ok(Math.abs(box2 - 70 * 96 / 25.4) < 2, 'Ganti ukuran label ke 70×35 mm bekerja');

  const lines0 = await page.$$eval('#lblPreview .lbl-line', e => e.map(x => x.innerText));
  await page.evaluate(() => lblField(3, 'on', true)); await page.waitForTimeout(250);
  const lines1 = await page.$$eval('#lblPreview .lbl-line', e => e.map(x => x.innerText));
  ok(lines1.length === lines0.length + 1, 'Menambah elemen isi label bekerja');

  await page.evaluate(() => lblMove(0, 1)); await page.waitForTimeout(300);
  const lines2 = await page.$$eval('#lblPreview .lbl-line', e => e.map(x => x.innerText));
  ok(lines2[0] !== lines1[0], 'Mengubah urutan elemen bekerja', `${lines1[0]} → ${lines2[0]}`);

  await page.evaluate(() => lblSet('code', 'both')); await page.waitForTimeout(350);
  const svgN = await page.$$eval('#lblPreview svg', e => e.length);
  ok(svgN >= 2, `Mode "keduanya" merender ${svgN} simbol (Code128 + QR)`);
  ok(errs.length === 0, 'Studio label tanpa error', errs.join('|'));

  /* ---------- 6. DECODE barcode yang benar-benar dirender di label ---------- */
  const decoded = await page.evaluate(async () => {
    function svgToCanvas(svg, w, h) {
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
          const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
          c.imageSmoothingEnabled = false; c.drawImage(img, 0, 0, w, h); res(cv);
        };
        img.onerror = rej;
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      });
    }
    const svgs = Array.from(document.querySelectorAll('#lblPreview svg'));
    const out = {};
    for (const s of svgs) {
      const isQr = s.getAttribute('viewBox').split(' ')[2] === s.getAttribute('viewBox').split(' ')[3];
      const xml = new XMLSerializer().serializeToString(s);
      if (isQr) {
        const cv = await svgToCanvas(xml, 420, 420);
        const d = cv.getContext('2d').getImageData(0, 0, 420, 420);
        const r = jsQR(d.data, 420, 420);
        out.qr = r ? r.data : 'NO_DECODE';
      } else {
        const vb = s.getAttribute('viewBox').split(' ');
        const cv = await svgToCanvas(xml, Math.round(parseFloat(vb[2]) * 3), 150);
        const reader = new ZXing.MultiFormatReader();
        const h = new Map();
        h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.CODE_128]);
        h.set(ZXing.DecodeHintType.TRY_HARDER, true);
        reader.setHints(h);
        try {
          const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(
            new ZXing.HTMLCanvasElementLuminanceSource(cv)));
          out.c128 = reader.decode(bmp).getText();
        } catch (e) { out.c128 = 'NO_DECODE'; }
      }
    }
    // muatan yang seharusnya
    out.expected = document.querySelector('#lblPreview .lbl-line').innerText;
    return out;
  });
  ok(decoded.c128 && decoded.c128 !== 'NO_DECODE', 'Code128 pada label dapat dipindai', decoded.c128);
  ok(decoded.qr && decoded.qr !== 'NO_DECODE', 'QR pada label dapat dipindai', decoded.qr);
  ok(decoded.c128 === decoded.qr, 'Kedua simbol memuat data yang sama');

  /* ---------- 7. Label BMN baku ---------- */
  errs.length = 0;
  await page.evaluate(() => lblTab('bmn')); await page.waitForTimeout(400);
  const bmnLbl = await page.$eval('#lblPreview .lbl', e => e.innerText);
  ok(/KODE LOKASI/.test(bmnLbl) && /KODE BARANG/.test(bmnLbl) && /NUP/.test(bmnLbl) && /TAHUN/.test(bmnLbl),
    'Label BMN memuat kode lokasi, tahun, kode barang, dan NUP');
  const bmnDecoded = await page.evaluate(async () => {
    const s = Array.from(document.querySelectorAll('#lblPreview svg'))
      .find(x => { const v = x.getAttribute('viewBox').split(' '); return v[2] !== v[3]; });
    if (!s) return 'NO_SVG';
    const xml = new XMLSerializer().serializeToString(s);
    const vb = s.getAttribute('viewBox').split(' ');
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = j;
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml))); });
    const cv = document.createElement('canvas');
    cv.width = Math.round(parseFloat(vb[2]) * 3); cv.height = 150;
    const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
    c.imageSmoothingEnabled = false; c.drawImage(img, 0, 0, cv.width, cv.height);
    const reader = new ZXing.MultiFormatReader();
    const h = new Map();
    h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.CODE_128]);
    h.set(ZXing.DecodeHintType.TRY_HARDER, true);
    reader.setHints(h);
    try {
      return reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(
        new ZXing.HTMLCanvasElementLuminanceSource(cv)))).getText();
    } catch (e) { return 'NO_DECODE'; }
  });
  const expectBmn = await page.evaluate(() => DB.equipment[0].bmnId);
  ok(bmnDecoded === expectBmn, 'Barcode label BMN berisi kode BMN yang benar', bmnDecoded);

  /* ---------- 8. Lembar cetak ---------- */
  await page.evaluate(() => lblTab('internal')); await page.waitForTimeout(300);
  await page.evaluate(() => lblAll(true)); await page.waitForTimeout(800);
  const sheetLabels = await page.$$eval('#lblSheetWrap .sheet .lbl', e => e.length);
  const totalItems = await page.evaluate(() => DB.equipment.length + DB.assets.length);
  ok(sheetLabels === totalItems, `Lembar cetak memuat ${sheetLabels} label untuk ${totalItems} barang`);

  await page.evaluate(() => {
    let root = document.querySelector('.print-root');
    if (!root) { root = document.createElement('div'); root.className = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = document.getElementById('lblSheetWrap').innerHTML;
  });
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);
  const printVis = await page.evaluate(() => {
    const r = document.querySelector('.print-root'), a = document.querySelector('.app');
    return { root: getComputedStyle(r).display, app: getComputedStyle(a).display };
  });
  ok(printVis.root !== 'none' && printVis.app === 'none',
    'Mode cetak hanya menampilkan lembar label', JSON.stringify(printVis));
  await page.emulateMedia({ media: 'screen' });

  /* ---------- 9. Simpan template ---------- */
  errs.length = 0;
  await page.evaluate(() => { lblSaveTpl(); }); await page.waitForTimeout(250);
  await page.evaluate(() => { document.getElementById('tplName').value = 'Template Uji'; lblSaveTplGo(); });
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('flms.labelTpl') || '[]'));
  ok(saved.length >= 1 && saved[saved.length - 1].name === 'Template Uji',
    'Template internal tersimpan ke perangkat');
  await page.evaluate(() => lblLoadTpl()); await page.waitForTimeout(400);
  const tplCards = await page.$$eval('.modal .card.res-card', e => e.length);
  ok(tplCards >= 4, `Galeri template menampilkan ${tplCards} template`);
  await page.evaluate(() => UI.closeModal());
  ok(errs.length === 0, 'Template tanpa error', errs.join('|'));

  await page.evaluate(() => { location.hash = '#/barcode'; }); await page.waitForTimeout(500);
  await page.screenshot({ path: SHOT + 'p-label.png' });
  await page.evaluate(() => { location.hash = '#/equipment/new'; }); await page.waitForTimeout(500);
  await page.screenshot({ path: SHOT + 'p-reg.png' });
  await page.evaluate(() => { location.hash = '#/bmn'; }); await page.waitForTimeout(500);
  await page.screenshot({ path: SHOT + 'p-bmn.png' });

  console.log(fail === 0 ? '\n=== SEMUA UJI LULUS ===' : `\n=== ${fail} UJI GAGAL ===`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
