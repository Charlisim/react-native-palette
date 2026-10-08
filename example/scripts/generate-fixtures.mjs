// Writes the deterministic PNG fixtures. No dependency other than Node.js.
// Run: node scripts/generate-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const SIZE = 400;
const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body) >>> 0, body.length + 4);
  return out;
}

// 8-bit RGB, no alpha, sRGB chunk with perceptual intent.
function png(colorAt) {
  const raw = Buffer.alloc((SIZE * 3 + 1) * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    const row = y * (SIZE * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < SIZE; x += 1) {
      const [r, g, b] = colorAt(x, y);
      raw.set([r, g, b], row + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('sRGB', Buffer.from([0])),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));

// Four flat quadrants: TL white, TR black, BL orange, BR blue.
const QUADRANTS = [hex('#ffffff'), hex('#000000'), hex('#ff9500'), hex('#0000ff')];
writeFileSync(
  join(assets, 'fixture.png'),
  png((x, y) => QUADRANTS[(y < SIZE / 2 ? 0 : 2) + (x < SIZE / 2 ? 0 : 1)]),
);

// Four flat horizontal bands: red, yellow, purple, cyan.
const BANDS = [hex('#ff0000'), hex('#ffff00'), hex('#800080'), hex('#00ffff')];
writeFileSync(join(assets, 'bands.png'), png((_x, y) => BANDS[Math.floor(y / (SIZE / 4))]));

console.log('Wrote fixture.png and bands.png (400x400, 8-bit RGB, sRGB).');
