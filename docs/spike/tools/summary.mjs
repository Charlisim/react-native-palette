import { readFileSync } from 'node:fs';
const lines = readFileSync(process.argv[2], 'utf8').split('\n');
const f = (v) => (Array.isArray(v) ? v.join(',') : v ?? '-');
for (const line of lines) {
  const m = /(SPIKE_[A-Z_]+) (\{.*\})\s*$/.exec(line.replace(/\x1b\[[0-9;]*m/g, ''));
  if (!m) { if (/ERROR|Error:/.test(line)) console.log(line.slice(0, 300)); continue; }
  const [, tag, json] = m; let d;
  // `fx-compare.mjs` reports the `SPIKE_FX` records.
  if (tag === 'SPIKE_FX') continue; try { d = JSON.parse(json); } catch { console.log(tag, 'UNPARSEABLE', json.slice(0, 200)); continue; }
  if (tag === 'SPIKE_CASE' || tag === 'SPIKE_BASELINE_CASE') {
    const e = d.expected;
    const exp = e.kind === 'color' ? `${f(e.rgba8)} ${e.foreground} @${e.capture.x},${e.capture.y}` : e.kind === 'error' ? `${e.code}${e.sampled ? ' sampled ' + f(e.sampled) : ''}` : 'observe';
    console.log(`${tag === 'SPIKE_CASE' ? '' : 'BASE '}${d.pass === null ? 'OBS ' : d.pass ? 'PASS' : 'FAIL'} | ${d.id} | exp ${exp} | sampled ${f(d.sampled)} | resolved ${f(d.resolved)} | fg ${f(d.foreground)} ${f(d.ratio)} | at ${d.capturePoint ? d.capturePoint.x + ',' + d.capturePoint.y : '-'} px ${d.pixel ? d.pixel.x + ',' + d.pixel.y : '-'} | d ${f(d.channelDelta)}/${f(d.pointDelta)} | excl ${f(d.exclusion)} hidden ${f(d.hiddenDuringCapture)} restored ${f(d.stateRestored)} mut ${f(d.rootMutations)} | ${d.ms} ms | ${f(d.error)} ${String(f(d.note)).replace(/\s+/g, ' ')}`);
  } else console.log(tag, JSON.stringify(d).slice(0, 1200));
}
