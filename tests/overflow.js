const { launch } = require('./browser');
const { BASE, SHOT, lib } = require('./config');
const ROUTES = ["dashboard","exec","calendar","booking","availability","equipment","rooms","layout",
  "assets","roles","masterdata","ai","booking/new","bmn","equipment/new","barcode","auditorium","documents","reportequip","analytics","bsc","checklist","mychecklist","emailsched","exec"];
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(`${BASE}/app.html#/dashboard`, { waitUntil: 'load' });
  await p.waitForTimeout(500);
  for (const r of ROUTES) {
    await p.evaluate(h => { location.hash = h; }, '#/' + r);
    await p.waitForTimeout(250);
    const res = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const bad = [];
      document.querySelectorAll('body *').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > vw + 1 || rect.width > vw + 1) {
          // hanya laporkan yang tidak berada dalam wadah scroll
          let par = el.parentElement, scrollable = false;
          while (par && par !== document.body) {
            const cs = getComputedStyle(par);
            if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') { scrollable = true; break; }
            par = par.parentElement;
          }
          if (!scrollable) bad.push(el.tagName + '.' + (el.className || '').toString().slice(0,50) + ' w=' + Math.round(rect.width) + ' r=' + Math.round(rect.right));
        }
      });
      return { vw, doc: document.documentElement.scrollWidth, bad: bad.slice(0, 6) };
    });
    console.log(r.padEnd(14), 'doc=' + res.doc, res.bad.length ? '\n   ' + res.bad.join('\n   ') : '');
  }
  await b.close();
})();
