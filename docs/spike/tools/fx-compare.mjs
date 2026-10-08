// Usage: node fx-compare.mjs <log> <screenshot prefix> [--brief]
// `--brief` omits the line of each observation. The table contains the same values.
// Compares each `SPIKE_FX` sample with the screenshot pixel at the same position.
// The screenshot of page N is `<prefix>-fx-N.png`. It is the ground truth for the screen.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const [log, prefix, option] = process.argv.slice(2);
const brief = option === '--brief';
const detected = {};
const ff = '/opt/homebrew/bin/';
const parse = (line) => {
  const m = /(SPIKE_[A-Z_]+) (\{.*\})\s*$/.exec(line.replace(/\x1b\[[0-9;]*m/g, ''));
  if (!m) return undefined;
  try { return [m[1], JSON.parse(m[2])]; } catch { return undefined; }
};
const pageOf = {}, roots = {}, recs = [], shots = {};
for (const line of readFileSync(log, 'utf8').split('\n')) {
  const entry = parse(line);
  if (!entry) continue;
  const [tag, d] = entry;
  if (tag === 'SPIKE_FX_PAGE') { for (const root of d.roots) pageOf[root] = d.page; console.log(tag, JSON.stringify(d)); }
  else if (tag === 'SPIKE_FX_ROOT') { roots[d.root] = d; console.log(tag, JSON.stringify(d)); }
  else if (tag === 'SPIKE_FX') recs.push(d);
  else if (tag === 'SPIKE_FX_LATENCY') console.log(tag, JSON.stringify(d));
}
function shot(page) {
  if (shots[page] !== undefined) return shots[page];
  const file = `${prefix}-fx-${page}.png`;
  if (!existsSync(file)) return (shots[page] = null);
  const size = JSON.parse(execFileSync(ff + 'ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file]).toString()).streams[0];
  const data = execFileSync(ff + 'ffmpeg', ['-v', 'fatal', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  console.log(`SCREENSHOT page ${page}: ${file.split('/').pop()} ${size.width}x${size.height}`);
  return (shots[page] = { ...size, data });
}
// Mean of a 3x3 area and the channel range of a 7x7 area. A large range means that the area is not flat.
function screenAt(image, x, y) {
  const at = (px, py) => { const i = (py * image.width + px) * 3; return [image.data[i], image.data[i + 1], image.data[i + 2]]; };
  const mean = [0, 0, 0];
  let range = 0;
  const center = at(x, y);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const p = at(x + dx, y + dy);
    p.forEach((v, c) => { range = Math.max(range, Math.abs(v - center[c])); if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) mean[c] += v / 9; });
  }
  return { rgb: mean.map((v) => Math.round(v * 10) / 10), range };
}
const f = (v) => (Array.isArray(v) ? v.join(',') : v ?? '-');
let judged = 0, passed = 0;
const table = new Map();
for (const r of recs) {
  const root = roots[r.root];
  const image = shot(pageOf[r.root]);
  let screen = '-', range = '-', delta = '-';
  if (image && root && typeof root.rect === 'object') {
    const s = root.rect.scale;
    const x = Math.round(root.rect.x * s) + r.pixel.x, y = Math.round(root.rect.y * s) + r.pixel.y;
    const px = screenAt(image, x, y);
    screen = `${f(px.rgb)} @${x},${y}`;
    range = px.range;
    if (r.sampled) delta = Math.round(Math.max(...px.rgb.map((v, c) => Math.abs(v - r.sampled[c]))) * 10) / 10;
  }
  if (r.pass !== null) { judged++; if (r.pass) passed++; }
  const key = `${r.root} | ${r.point}`;
  if (!table.has(key)) table.set(key, { screen: screen.split(' @')[0], range, cells: {} });
  table.get(key).cells[r.variant] = r.sampled ? `${f(r.sampled)} (${delta})` : r.error;
  const e = r.expected;
  const exp = e.kind === 'color' ? f(e.rgba8) : e.kind === 'error' ? e.code : 'observe';
  const fx = (r.effects ?? []).map((h) => `${h.name}${h.containsPoint ? ' [covers point]' : ''}`).join('; ');
  for (const h of r.effects ?? []) (detected[r.root] ??= new Set()).add(h.name);
  if (!brief || r.pass !== null) console.log(`${r.pass === null ? 'OBS ' : r.pass ? 'PASS' : 'FAIL'} | ${r.id} | active ${r.effectActive} | exp ${exp} | sampled ${r.sampled ? f(r.sampled) : r.error} | screen ${screen} | range7x7 ${range} | sampled-screen ${delta} | ${r.ms} ms | ${fx || '-'}${r.message ? ' | ' + r.message : ''}`);
}
for (const root in detected) console.log(`DETECTED | ${root} | ${[...detected[root]].join('; ')}`);
// One row for each root and point. Each cell: sampled RGBA and, in parentheses, the maximum RGB difference to the screen.
const variants = [...new Set(recs.map((r) => r.variant))];
console.log(`TABLE | root | point | screen RGB | range7x7 | ${variants.join(' | ')}`);
for (const [key, row] of table) {
  console.log(`TABLE | ${key} | ${row.screen} | ${row.range} | ${variants.map((v) => row.cells[v] ?? '-').join(' | ')}`);
}
console.log(`FX_SUMMARY judged ${judged} passed ${passed} observations ${recs.length - judged}`);
