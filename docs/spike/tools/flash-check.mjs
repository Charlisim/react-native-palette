// Usage: node flash-check.mjs <video> <downscale>
// Counts magenta foreground pixels in each recorded frame, grouped by the on-screen phase marker.
import { spawn, execFileSync } from 'node:child_process';
const [video, downArg] = process.argv.slice(2);
const down = Number(downArg || 1);
const probe = JSON.parse(execFileSync('/opt/homebrew/bin/ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,avg_frame_rate,duration', '-of', 'json', video]).toString()).streams[0];
const w = Math.floor(probe.width / down), h = Math.floor(probe.height / down);
const ff = spawn('/opt/homebrew/bin/ffmpeg', ['-v', 'fatal', '-i', video, '-vf', `scale=${w}:${h}:flags=area`, '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
const size = w * h * 3;
let buf = Buffer.alloc(0);
const frames = [];
const pts = execFileSync('/opt/homebrew/bin/ffprobe', ['-v', 'fatal', '-select_streams', 'v:0', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', video], { maxBuffer: 1 << 26 }).toString().trim().split('\n').map(Number);
const near = (r, g, b, R, G, B, t) => Math.abs(r - R) < t && Math.abs(g - G) < t && Math.abs(b - B) < t;
// Marker colors of the fixture (`MARKER_COLORS` in example/App.tsx). The `dh*` phases are experimental modes.
const MARKERS = { primary: [0, 255, 200], baseline: [255, 200, 0], dhRootFalse: [0, 100, 255], dhRootTrue: [120, 255, 0], dhWindowFalse: [0, 200, 100], dhWindowTrue: [150, 100, 255] };
function analyse(f) {
  let magenta = 0;
  const marks = Object.fromEntries(Object.keys(MARKERS).map((name) => [name, 0]));
  for (let i = 0; i < size; i += 3) {
    const r = f[i], g = f[i + 1], b = f[i + 2];
    if (r > 190 && g < 90 && b > 190) magenta++;
    else {
      // The phase marker is in the top-right corner of the screen.
      const px = (i / 3) % w, py = Math.floor(i / 3 / w);
      if (px < w * 0.78 || py > h * 0.2) continue;
      for (const name in MARKERS) {
        const [R, G, B] = MARKERS[name];
        if (near(r, g, b, R, G, B, 25)) { marks[name]++; break; }
      }
    }
  }
  frames.push({ magenta, phase: Object.keys(marks).find((name) => marks[name] > 300) ?? 'none' });
}
ff.stdout.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  while (buf.length >= size) { analyse(buf.subarray(0, size)); buf = buf.subarray(size); }
});
ff.on('close', () => {
  const out = { video, probe, scaled: [w, h], totalFrames: frames.length, phases: {} };
  for (const phase of [...Object.keys(MARKERS), 'none']) {
    const idx = frames.map((f, i) => [f, i]).filter(([f]) => f.phase === phase);
    if (!idx.length) continue;
    const counts = idx.map(([f]) => f.magenta).sort((a, b) => a - b);
    const median = counts[Math.floor(counts.length / 2)];
    const hist = {};
    for (const c of counts) hist[c] = (hist[c] || 0) + 1;
    const low = idx.filter(([f]) => f.magenta < median * 0.9).map(([f, i]) => ({ frame: i, magenta: f.magenta }));
    const gaps = idx.slice(1).map(([, i], k) => pts[i] - pts[idx[k][1]]);
    out.phases[phase] = { seconds: +(pts[idx.at(-1)[1]] - pts[idx[0][1]]).toFixed(2), maxGapSeconds: +Math.max(0, ...gaps).toFixed(3), frames: idx.length, firstFrame: idx[0][1], lastFrame: idx.at(-1)[1], min: counts[0], median, max: counts.at(-1), distinctCounts: Object.keys(hist).length, histogram: Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => `${c}px x${n}`), framesBelow90pctOfMedian: low.length, lowExamples: low.slice(0, 8) };
  }
  delete out.phases.none; console.log(JSON.stringify(out));
});
