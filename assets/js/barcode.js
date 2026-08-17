/* ==========================================================================
   FLMS — Encoder barcode
   Code 128 (subset B) dan QR Code (mode byte, ECC level M, versi 1–6).
   Keduanya menghasilkan SVG dan menghasilkan simbol yang benar-benar dapat
   dipindai — bukan pola hiasan.
   ========================================================================== */
window.Barcode = (function () {

  /* =======================================================================
     CODE 128 — subset B
     ======================================================================= */

  // Lebar bar/spasi untuk nilai 0–106 (106 = stop, 7 elemen).
  const C128 = [
    "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
    "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
    "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
    "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
    "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
    "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
    "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
    "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
    "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
    "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
    "114131","311141","411131","211412","211214","211232","2331112"
  ];
  const START_B = 104, STOP = 106;

  /** Ubah teks menjadi deretan lebar modul (bar, spasi, bar, …). */
  function code128Widths(text) {
    const s = String(text);
    const values = [START_B];
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      // Subset B mencakup ASCII 32–126. Karakter di luar itu diganti '?'.
      values.push(c >= 32 && c <= 126 ? c - 32 : 31);
    }
    let sum = START_B;
    for (let i = 1; i < values.length; i++) sum += values[i] * i;
    values.push(sum % 103);   // check digit
    values.push(STOP);

    const widths = [];
    values.forEach((v) => {
      const p = C128[v];
      for (let i = 0; i < p.length; i++) widths.push(+p[i]);
    });
    return widths;
  }

  /**
   * SVG Code 128.
   * opts: { height, module, quiet, showText, fontSize, color }
   */
  function code128(text, opts) {
    const o = Object.assign(
      { height: 46, module: 1.6, quiet: 10, showText: true, fontSize: 9, color: "#000" },
      opts || {}
    );
    const widths = code128Widths(text);
    const total = widths.reduce((a, b) => a + b, 0) * o.module + o.quiet * 2;
    const textH = o.showText ? o.fontSize + 3 : 0;
    const h = o.height + textH;

    let x = o.quiet, bars = "", isBar = true;
    widths.forEach((w) => {
      const wpx = w * o.module;
      if (isBar) bars += `<rect x="${+x.toFixed(2)}" y="0" width="${+wpx.toFixed(2)}" height="${o.height}"/>`;
      x += wpx;
      isBar = !isBar;
    });

    const label = o.showText
      ? `<text x="${(total / 2).toFixed(2)}" y="${h - 1}" font-size="${o.fontSize}" text-anchor="middle"
           font-family="ui-monospace,Menlo,Consolas,monospace" letter-spacing="0.5">${escapeXml(text)}</text>`
      : "";

    // `fit` membuat simbol mengisi penuh kotak induk (dipakai pada label ber-ukuran mm).
    // Peregangan pada sumbu X bersifat seragam sehingga rasio lebar bar tetap terjaga.
    const box = o.fit
      ? `width="100%" height="100%" preserveAspectRatio="none"`
      : `width="100%" preserveAspectRatio="xMidYMid meet"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total.toFixed(2)} ${h}"
      ${box} shape-rendering="crispEdges" fill="${o.color}">
      <rect width="${total.toFixed(2)}" height="${h}" fill="#fff"/>${bars}${label}</svg>`;
  }

  /* =======================================================================
     QR CODE — mode byte, ECC level M, versi 1–6
     ======================================================================= */

  // --- aritmetika GF(256), polinomial pembangkit 0x11D ---------------------
  const EXP = new Array(512), LOG = new Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  function genPoly(n) {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const ng = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        ng[j] ^= gmul(g[j], 1);
        ng[j + 1] ^= gmul(g[j], EXP[i]);
      }
      g = ng;
    }
    return g;
  }

  function ecCodewords(data, n) {
    const g = genPoly(n);
    const res = data.concat(new Array(n).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef !== 0) for (let j = 0; j < g.length; j++) res[i + j] ^= gmul(g[j], coef);
    }
    return res.slice(data.length);
  }

  // --- tabel versi untuk ECC level M --------------------------------------
  // { dataCW: total data codeword, ec: EC codeword per blok, blocks: [[jumlah blok, data CW per blok], …] }
  const VER = {
    1: { dataCW: 16,  ec: 10, blocks: [[1, 16]] },
    2: { dataCW: 28,  ec: 16, blocks: [[1, 28]] },
    3: { dataCW: 44,  ec: 26, blocks: [[1, 44]] },
    4: { dataCW: 64,  ec: 18, blocks: [[2, 32]] },
    5: { dataCW: 86,  ec: 24, blocks: [[2, 43]] },
    6: { dataCW: 108, ec: 16, blocks: [[4, 27]] }
  };
  // Titik tengah pola alignment (versi 1 tidak punya).
  const ALIGN = { 1: null, 2: 18, 3: 22, 4: 26, 5: 30, 6: 34 };

  function pickVersion(len) {
    for (let v = 1; v <= 6; v++) if (len + 2 <= VER[v].dataCW) return v;
    return null;
  }

  function utf8Bytes(str) {
    const out = [];
    for (const ch of String(str)) {
      let c = ch.codePointAt(0);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  /** Susun codeword data: header mode + panjang + isi + padding. */
  function buildData(bytes, ver) {
    const spec = VER[ver];
    const bits = [];
    const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(0b0100, 4);          // mode byte
    push(bytes.length, 8);    // penghitung panjang (versi 1–9: 8 bit)
    bytes.forEach((b) => push(b, 8));

    const cap = spec.dataCW * 8;
    for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);   // terminator
    while (bits.length % 8) bits.push(0);                            // rapatkan ke byte

    const cw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    const PAD = [0xec, 0x11];
    let k = 0;
    while (cw.length < spec.dataCW) cw.push(PAD[k++ % 2]);

    // Pecah menjadi blok, hitung EC, lalu interleave.
    const dataBlocks = [], ecBlocks = [];
    let pos = 0;
    spec.blocks.forEach(([count, size]) => {
      for (let i = 0; i < count; i++) {
        const blk = cw.slice(pos, pos + size); pos += size;
        dataBlocks.push(blk);
        ecBlocks.push(ecCodewords(blk, spec.ec));
      }
    });

    const out = [];
    const maxData = Math.max.apply(null, dataBlocks.map((b) => b.length));
    for (let i = 0; i < maxData; i++) dataBlocks.forEach((b) => { if (i < b.length) out.push(b[i]); });
    for (let i = 0; i < spec.ec; i++) ecBlocks.forEach((b) => out.push(b[i]));
    return out;
  }

  const MASKS = [
    (i, j) => (i + j) % 2 === 0,
    (i) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => ((((i * j) % 2) + ((i * j) % 3)) % 2) === 0,
    (i, j) => ((((i + j) % 2) + ((i * j) % 3)) % 2) === 0
  ];

  function buildMatrix(ver, codewords, mask) {
    const size = 17 + 4 * ver;
    const m = Array.from({ length: size }, () => new Array(size).fill(null)); // null = data
    const fn = Array.from({ length: size }, () => new Array(size).fill(false)); // true = pola fungsi

    const set = (r, c, v) => { m[r][c] = v ? 1 : 0; fn[r][c] = true; };

    // Finder + separator
    const finder = (r0, c0) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                   (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                   (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        set(rr, cc, on);
      }
    };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    // Timing
    for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }

    // Alignment (versi 2–6: satu pola di tengah)
    const a = ALIGN[ver];
    if (a != null) {
      for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
        const on = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        set(a + r, a + c, on);
      }
    }

    // Modul gelap wajib
    set(size - 8, 8, true);

    // Cadangkan area format information
    for (let i = 0; i <= 8; i++) {
      if (!fn[8][i]) { m[8][i] = 0; fn[8][i] = true; }
      if (!fn[i][8]) { m[i][8] = 0; fn[i][8] = true; }
    }
    for (let i = 0; i < 8; i++) {
      if (!fn[8][size - 1 - i]) { m[8][size - 1 - i] = 0; fn[8][size - 1 - i] = true; }
      if (!fn[size - 1 - i][8]) { m[size - 1 - i][8] = 0; fn[size - 1 - i][8] = true; }
    }

    // Tempatkan data secara zigzag dari kanan bawah, lewati kolom timing (6)
    const bitsArr = [];
    codewords.forEach((b) => { for (let i = 7; i >= 0; i--) bitsArr.push((b >> i) & 1); });
    let idx = 0, up = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;                      // lewati kolom timing vertikal
      for (let n = 0; n < size; n++) {
        const row = up ? size - 1 - n : n;
        for (let k = 0; k < 2; k++) {
          const c = col - k;
          if (fn[row][c]) continue;
          let bit = idx < bitsArr.length ? bitsArr[idx] : 0;
          idx++;
          if (MASKS[mask](row, c)) bit ^= 1;
          m[row][c] = bit;
        }
      }
      up = !up;
    }

    // Format information: level M = 00, digabung nomor mask, BCH(15,5)
    const fmtData = (0b00 << 3) | mask;
    let bch = fmtData << 10;
    for (let i = 4; i >= 0; i--) if ((bch >> (i + 10)) & 1) bch ^= 0b10100110111 << i;
    const fmt = ((fmtData << 10) | bch) ^ 0b101010000010010;
    const fbit = (i) => (fmt >> i) & 1;

    // Salinan pertama: vertikal kiri-atas (bit 0–5), lalu mendatar kiri-atas (bit 9–14).
    for (let i = 0; i <= 5; i++) m[i][8] = fbit(i);
    m[7][8] = fbit(6); m[8][8] = fbit(7); m[8][7] = fbit(8);
    for (let i = 9; i <= 14; i++) m[8][14 - i] = fbit(i);

    // Salinan kedua: mendatar kanan-atas (bit 0–7), lalu vertikal kiri-bawah (bit 8–14).
    for (let i = 0; i <= 7; i++) m[8][size - 1 - i] = fbit(i);
    for (let i = 8; i <= 14; i++) m[size - 15 + i][8] = fbit(i);
    m[size - 8][8] = 1;   // modul gelap tetap gelap

    return { m, fn, size };
  }

  /** Penalti standar (rule 1–4) untuk memilih mask terbaik. */
  function penalty(m, size) {
    let p = 0;
    // Rule 1 — deretan sewarna ≥5
    for (let i = 0; i < size; i++) {
      for (const dir of [0, 1]) {
        let run = 1, prev = -1;
        for (let j = 0; j < size; j++) {
          const v = dir ? m[j][i] : m[i][j];
          if (v === prev) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; }
          else { run = 1; prev = v; }
        }
      }
    }
    // Rule 2 — blok 2×2 sewarna
    for (let i = 0; i < size - 1; i++) for (let j = 0; j < size - 1; j++) {
      const v = m[i][j];
      if (v === m[i][j + 1] && v === m[i + 1][j] && v === m[i + 1][j + 1]) p += 3;
    }
    // Rule 3 — pola 1:1:3:1:1 menyerupai finder
    const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    const match = (arr, pat) => pat.every((v, k) => arr[k] === v);
    for (let i = 0; i < size; i++) for (let j = 0; j <= size - 11; j++) {
      const row = [], col = [];
      for (let k = 0; k < 11; k++) { row.push(m[i][j + k]); col.push(m[j + k][i]); }
      if (match(row, P1) || match(row, P2)) p += 40;
      if (match(col, P1) || match(col, P2)) p += 40;
    }
    // Rule 4 — keseimbangan gelap/terang
    let dark = 0;
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) if (m[i][j]) dark++;
    const pct = (dark * 100) / (size * size);
    p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  /**
   * SVG QR Code. Mengembalikan null bila muatan melebihi kapasitas versi 6
   * (106 byte pada ECC level M).
   * opts: { size, quiet, color }
   */
  function qr(text, opts) {
    const o = Object.assign({ size: 96, quiet: 4, color: "#000" }, opts || {});
    const bytes = utf8Bytes(text);
    const ver = pickVersion(bytes.length);
    if (!ver) return null;

    const cw = buildData(bytes, ver);
    let best = null;
    for (let mask = 0; mask < 8; mask++) {
      const cand = buildMatrix(ver, cw, mask);
      const p = penalty(cand.m, cand.size);
      if (!best || p < best.p) best = { p, ...cand };
    }

    const size = best.size, span = size + o.quiet * 2;
    let cells = "";
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (best.m[r][c]) cells += `<rect x="${c + o.quiet}" y="${r + o.quiet}" width="1" height="1"/>`;
    }
    const box = o.fit ? `width="100%" height="100%"` : `width="${o.size}" height="${o.size}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}"
      ${box} shape-rendering="crispEdges" fill="${o.color}">
      <rect width="${span}" height="${span}" fill="#fff"/>${cells}</svg>`;
  }

  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
  }

  /** Kapasitas muatan QR pada ECC level M (byte). */
  const QR_MAX = 106;

  return { code128, code128Widths, qr, QR_MAX };
})();
