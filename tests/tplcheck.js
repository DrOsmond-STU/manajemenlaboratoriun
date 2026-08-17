const { launch } = require('./browser');
const { BASE, SHOT, lib } = require('./config');
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 980 } });
  let fail = 0;
  for (let i = 0; i < 3; i++) {
    await p.goto(`${BASE}/app.html#/barcode`, { waitUntil: 'load' });
    await p.waitForTimeout(700);
    await p.evaluate(() => lblLoadTpl()); await p.waitForTimeout(300);
    await p.evaluate((idx) => lblUseTpl(idx), i); await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const el = document.querySelector('#lblPreview .lbl');
      const clipped = Array.from(el.querySelectorAll('.lbl-line, .lbl-hdr'))
        .filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.innerText);
      return { over: el.scrollHeight > el.clientHeight + 1, clipped,
               lines: el.querySelectorAll('.lbl-line').length, svgs: el.querySelectorAll('svg').length };
    });
    const good = !r.over && !r.clipped.length && r.lines > 0 && r.svgs > 0;
    if (!good) fail++;
    console.log(`${good ? '✅' : '❌'} Template ${i + 1}: ${r.lines} baris, ${r.svgs} simbol` +
      (r.over ? ' — LUBER VERTIKAL' : '') + (r.clipped.length ? ' — TERPOTONG: ' + r.clipped.join(' | ') : ''));
  }
  await p.goto(`${BASE}/app.html#/barcode`, { waitUntil: 'load' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'p-label.png' });
  await p.evaluate(() => lblTab('bmn')); await p.waitForTimeout(600);
  await p.screenshot({ path: 'p-label-bmn.png' });
  console.log(fail ? `\n${fail} template bermasalah` : '\nSEMUA TEMPLATE BAWAAN RAPI');
  await b.close(); process.exit(fail ? 1 : 0);
})();
