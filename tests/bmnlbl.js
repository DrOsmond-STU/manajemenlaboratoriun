const { launch } = require('./browser');
const { BASE, SHOT, lib } = require('./config');
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 980 } });
  await p.addInitScript(() => {});
  let fail = 0;
  const sizes = [[50,25],[60,30],[70,35],[100,50]];
  await p.goto(`${BASE}/app.html#/barcode`, { waitUntil: 'load' });
  await p.waitForTimeout(700);
  await p.addScriptTag({ path: lib.zxing });
  await p.evaluate(() => lblTab('bmn')); await p.waitForTimeout(500);
  for (const [w,h] of sizes) {
    await p.evaluate(([w,h]) => lblBmnPreset(w,h), [w,h]);
    await p.waitForTimeout(450);
    const r = await p.evaluate(() => {
      const el = document.querySelector('#lblPreview .lbl');
      const clipped = Array.from(el.querySelectorAll('.lbl-line, .lbl-hdr'))
        .filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.innerText.trim());
      return { over: el.scrollHeight > el.clientHeight + 1, clipped, svgs: el.querySelectorAll('svg').length };
    });
    const good = !r.over && !r.clipped.length && r.svgs === 2;
    if (!good) fail++;
    console.log(`${good?'✅':'❌'} Label BMN ${w}×${h} mm — ${r.svgs} simbol` +
      (r.over?' LUBER':'') + (r.clipped.length?' TERPOTONG: '+r.clipped.join(' | '):''));
  }
  // decode ulang barcode pada ukuran terkecil
  await p.evaluate(() => lblBmnPreset(50,25)); await p.waitForTimeout(400);
  const dec = await p.evaluate(async () => {
    const s = Array.from(document.querySelectorAll('#lblPreview svg'))
      .find(x => { const v = x.getAttribute('viewBox').split(' '); return v[2] !== v[3]; });
    const vb = s.getAttribute('viewBox').split(' ');
    const xml = new XMLSerializer().serializeToString(s);
    const img = new Image();
    await new Promise((r,j)=>{img.onload=r;img.onerror=j;
      img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(xml)));});
    const cv=document.createElement('canvas'); cv.width=Math.round(parseFloat(vb[2])*3); cv.height=150;
    const c=cv.getContext('2d'); c.fillStyle='#fff'; c.fillRect(0,0,cv.width,cv.height);
    c.imageSmoothingEnabled=false; c.drawImage(img,0,0,cv.width,cv.height);
    const rd=new ZXing.MultiFormatReader(); const hh=new Map();
    hh.set(ZXing.DecodeHintType.POSSIBLE_FORMATS,[ZXing.BarcodeFormat.CODE_128]);
    hh.set(ZXing.DecodeHintType.TRY_HARDER,true); rd.setHints(hh);
    try { return rd.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(
      new ZXing.HTMLCanvasElementLuminanceSource(cv)))).getText(); } catch(e){ return 'NO_DECODE'; }
  });
  const exp = await p.evaluate(() => DB.equipment[0].bmnId);
  const okDec = dec === exp;
  if (!okDec) fail++;
  console.log(`${okDec?'✅':'❌'} Barcode label BMN 50×25 mm terbaca: ${dec}`);
  await p.evaluate(() => lblBmnPreset(60,30)); await p.waitForTimeout(500);
  await p.screenshot({ path: 'p-label-bmn.png' });
  console.log(fail ? `\n${fail} masalah` : '\nLABEL BMN RAPI DI SEMUA UKURAN');
  await b.close(); process.exit(fail?1:0);
})();
