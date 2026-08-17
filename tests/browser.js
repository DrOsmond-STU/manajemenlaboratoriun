/* Pembungkus peluncuran Chromium.
   FLMS_CHROMIUM dapat diisi bila peramban berada di lokasi tidak baku
   (misalnya lingkungan CI yang sudah menyediakan Chromium sendiri). */
const { chromium } = require('playwright');

async function launch(opts) {
  const o = Object.assign({}, opts);
  if (process.env.FLMS_CHROMIUM) o.executablePath = process.env.FLMS_CHROMIUM;
  return chromium.launch(o);
}
module.exports = { chromium, launch };
