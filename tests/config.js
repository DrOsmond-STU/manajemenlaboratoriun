/* Konfigurasi bersama seluruh suite uji. */
const path = require('path');
const fs = require('fs');

const SHOT = path.join(__dirname, 'screenshots') + path.sep;
if (!fs.existsSync(SHOT)) fs.mkdirSync(SHOT, { recursive: true });

module.exports = {
  BASE: process.env.FLMS_BASE || 'http://127.0.0.1:8899',
  SHOT,
  lib: {
    jsqr: require.resolve('jsqr/dist/jsQR.js'),
    zxing: require.resolve('@zxing/library/umd/index.min.js'),
    barcode: path.join(__dirname, '..', 'assets', 'js', 'barcode.js')
  }
};
