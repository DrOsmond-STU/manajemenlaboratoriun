const { launch } = require('./browser');
const { BASE, SHOT, lib } = require('./config');

const ROUTES = ["dashboard","exec","calendar","booking","mybooking","availability","eqbooking","approval",
"lab","equipment","calibration","maintenance","labschedule","rooms","meetingrooms","auditorium","layout",
"facility","facilityschedule","assets","assetmovement","assetloan","assetaudit","rental","pricelist",
"packages","quotation","invoice","payment","events","agenda","participant","vendor","eventreport","users",
"pic","technician","visitor","organization","documents","reportutil","reportroom","reportequip","reportasset",
"reportrental","reportmaint","reportfinance","masterdata","workflow","roles","notification","audit","settings",
"ai","booking/new","bmn","equipment/new","barcode","analytics","bsc","checklist","mychecklist","emailsched"];

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.click('button[type=submit]');
  await page.waitForTimeout(600);

  for (const r of ROUTES) {
    errs.length = 0;
    await page.evaluate(h => { location.hash = h; }, '#/' + r);
    await page.waitForTimeout(220);
    const h1 = await page.$eval('.page-head h1', e => e.textContent).catch(() => 'NO-H1');
    const bodyLen = await page.$eval('#viewBody', e => e.innerHTML.length).catch(() => 0);
    const flag = errs.length ? ' ❌ ' + errs.join(' | ') : (bodyLen < 300 ? ' ⚠ thin(' + bodyLen + ')' : '');
    console.log(String(r).padEnd(20), String(h1).padEnd(34), String(bodyLen).padStart(7), flag);
  }

  // interaksi: wizard booking
  errs.length = 0;
  await page.evaluate(() => { location.hash = '#/booking/new'; });
  await page.waitForTimeout(250);
  for (let s = 1; s <= 4; s++) {
    if (s === 2) await page.evaluate(() => wzPick('RM-003'));
    await page.evaluate(n => wzGo(n), s);
    await page.waitForTimeout(200);
    const len = await page.$eval('#wzHost', e => e.innerHTML.length);
    console.log('wizard step', s, len, errs.length ? '❌ ' + errs.join('|') : '');
  }

  // drawer / modal
  const checks = [
    ['showBooking', () => showBooking('BK-2026-000432')],
    ['showRoom', () => showRoom('RM-005')],
    ['showLab', () => showLab('LAB-001')],
    ['showEq', () => showEq('EQ-0003')],
    ['showAsset', () => showAsset('AST-000131')],
    ['showLoan', () => showLoan('LN-2026-00089')],
    ['quoLihat', () => quoLihat('QT-2026-0088')],
    ['qrScan', () => qrScan()],
    ['openNotif', () => openNotif()],
    ['openSearch', () => openSearch()],
    ['openProfile', () => openProfile()],
    ['aiSuggestRoom', () => aiSuggestRoom()],
    ['apprPutuskan', () => apprPutuskan('1','setuju')],
    ['pjmFormKembali', () => pjmFormKembali('1')]
  ];
  for (const [name, fn] of checks) {
    errs.length = 0;
    await page.evaluate(fn);
    await page.waitForTimeout(150);
    const open = await page.$('.overlay');
    console.log('ui:' + name, open ? 'opened' : '❌ not opened', errs.length ? '❌ ' + errs.join('|') : '');
    await page.evaluate(() => { UI.closeModal(); UI.closeDrawer(); });
  }

  // AI chat
  errs.length = 0;
  await page.evaluate(() => { location.hash = '#/ai'; });
  await page.waitForTimeout(250);
  await page.evaluate(() => aiSend('analisis utilisasi ruangan'));
  await page.waitForTimeout(900);
  const msgs = await page.$$eval('.chat-log .msg', els => els.length);
  console.log('ai messages', msgs, errs.length ? '❌ ' + errs.join('|') : '');

  await page.screenshot({ path: SHOT + 'shot-ai.png' });
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT + 'shot-dash.png', fullPage: true });
  await page.evaluate(() => { location.hash = '#/calendar'; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT + 'shot-cal.png' });

  // mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2
    ? document.documentElement.scrollWidth : 0);
  console.log('mobile h-overflow:', overflow || 'none');
  await page.screenshot({ path: SHOT + 'shot-mobile.png' });

  await browser.close();
})();
