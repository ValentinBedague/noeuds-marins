// Dessine l'icône de l'application (un cordage en huit sur fond bleu nuit) et l'enregistre
// en PNG dans pwa/icons/. Aucune dépendance : le PNG est encodé ici même.
// Usage : node outils/creer-icones.js
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const out = path.join(__dirname, "..", "pwa", "icons");

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0); head.writeUInt32BE(size, 4); head[8] = 8; head[9] = 6;
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = v => Math.max(0, Math.min(1, v));

function icon(size) {
  const S = size, cx = S / 2, cy = S / 2, A = 0.2 * S, B = 0.3 * S, r = 0.056 * S, gap = 0.02 * S, aa = Math.max(1, S / 256);
  // Figure of eight: one pass goes under at the centre, the other over.
  const under = [], over = [], N = 260;
  for (let i = 0; i <= N; i++) {
    const t = -Math.PI / 2 + Math.PI * i / N;
    under.push([cx + A * Math.sin(2 * t), cy - B * Math.sin(t)]);
    over.push([cx + A * Math.sin(2 * (t + Math.PI)), cy - B * Math.sin(t + Math.PI)]);
  }
  const dist = (pts, x, y) => { let m = 1e9; for (const p of pts) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < m) m = d; } return Math.sqrt(m); };
  const rope = d => { const k = 0.74 + 0.26 * Math.sqrt(Math.max(0, 1 - (d / r) ** 2)); return [236 * k, 238 * k, 233 * k]; };
  const px = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const fromCentre = Math.hypot(x - cx, y - cy * 0.84) / (S * 0.75);
      const bg = mix([18, 40, 58], [7, 15, 23], clamp(fromCentre));
      const dU = dist(under, x + 0.5, y + 0.5), dO = dist(over, x + 0.5, y + 0.5);
      // Away from the centre the two passes are one continuous rope.
      const d = Math.min(dU, dO), plain = mix(bg, rope(d), clamp((r - d) / aa + 0.5));
      // At the crossing: the lower pass, a sliver of background, then the upper pass, to read as over and under.
      let cross = mix(bg, rope(dU), clamp((r - dU) / aa + 0.5));
      cross = mix(cross, bg, clamp((r + gap - dO) / aa + 0.5));
      cross = mix(cross, rope(dO), clamp((r - dO) / aa + 0.5));
      const nearCross = clamp(1 - Math.hypot(x - cx, y - cy) / (0.13 * S));
      const c = mix(plain, cross, clamp(nearCross * 4));
      const o = (y * S + x) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
  }
  return png(S, px);
}

fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [["icon-512.png", 512], ["icon-192.png", 192], ["apple-touch-icon.png", 180]]) {
  fs.writeFileSync(path.join(out, name), icon(size));
  console.log("icône écrite : pwa/icons/" + name);
}
