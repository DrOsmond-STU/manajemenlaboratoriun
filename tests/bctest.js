/* Verifikasi encoder: render SVG -> canvas -> decode dengan jsQR & ZXing */
const { launch } = require('./browser');
const { BASE, SHOT, lib } = require('./config');
const fs = require('fs');

const PAYLOADS = [
  'STU-LAB-0001',
  '3.08.01.01.001-000123',
  '024.05.0100.652431.000/3.08.01.01.001/000123',
  'HPLC-001',
  'https://lab.semestateknologiutama.com/q/EQ-0001',
  'BMN|024.05.0100.652431.000|3.08.01.01.001|123|2022|Baik',
  'A', // minimal
  'X'.repeat(100) // mendekati kapasitas versi 6
];

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ path: lib.barcode });
  await page.addScriptTag({ path: lib.jsqr });
  await page.addScriptTag({ path: lib.zxing });

  const results = await page.evaluate(async (payloads) => {
    const out = [];

    function svgToCanvas(svg, w, h) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(cv);
        };
        img.onerror = reject;
        img.src = url;
      });
    }

    for (const p of payloads) {
      const row = { payload: p, qr: null, c128: null };

      // ---- QR ----
      const qsvg = Barcode.qr(p, { size: 400, quiet: 4 });
      if (!qsvg) row.qr = 'TOO_LONG';
      else {
        try {
          const cv = await svgToCanvas(qsvg, 400, 400);
          const d = cv.getContext('2d').getImageData(0, 0, 400, 400);
          const res = jsQR(d.data, 400, 400);
          row.qr = res ? (res.data === p ? 'OK' : 'MISMATCH:' + res.data) : 'NO_DECODE';
        } catch (e) { row.qr = 'ERR:' + e.message; }
      }

      // ---- Code128 ----
      try {
        const bsvg = Barcode.code128(p, { height: 120, module: 3, quiet: 20, showText: false });
        // lebar asli dari viewBox
        const vb = bsvg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
        const w = Math.round(parseFloat(vb[1])), h = Math.round(parseFloat(vb[2]));
        const cv = await svgToCanvas(bsvg, w, h);
        const reader = new ZXing.MultiFormatReader();
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.CODE_128]);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        reader.setHints(hints);
        const lum = new ZXing.HTMLCanvasElementLuminanceSource(cv);
        const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
        const res = reader.decode(bmp);
        const txt = res.getText();
        row.c128 = txt === p ? 'OK' : 'MISMATCH:' + txt;
      } catch (e) { row.c128 = 'ERR:' + (e.message || e.name); }

      out.push(row);
    }
    return out;
  }, PAYLOADS);

  let fail = 0;
  for (const r of results) {
    const bad = r.qr !== 'OK' || r.c128 !== 'OK';
    if (bad) fail++;
    console.log(
      (bad ? '❌ ' : '✅ ') +
      `qr=${String(r.qr).padEnd(12)} code128=${String(r.c128).padEnd(12)} :: ${r.payload.slice(0, 50)}`
    );
  }
  console.log(fail === 0 ? '\nSEMUA LULUS' : `\n${fail} GAGAL`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
