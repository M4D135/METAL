// Lot 11 / T4 — confirmations de touche et de kill mesurées (FEEL-07), en domaine
// principal. Compare la confirmation METAL au cue v0.2 qu'elle remplace : forme,
// spectre (mêmes bandes que bancs/feel/audio-analyze.mjs) et décroissance.
// usage : node docs/chantier-moteur/preuves/lot-11/t4/confirm.mjs [racine] [--out f.json]
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {loadRealm} from '../../../../../tools/realm-loader.mjs';

const args = process.argv.slice(2), root = resolve(args[0] || '.');
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const RATE = 22050;
const sha = a => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
const v = loadRealm({root, modules: ['music', 'audio', 'audio-recipes'], globals: {}});
const FAudio = v.window.FAudio, extras = v.window.MetalAudio.extras;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) for (let k = 0, cr = 1, ci = 0; k < len / 2; k++) {
      const p = i + k, q = p + len / 2, vr = re[q] * cr - im[q] * ci, vi = re[q] * ci + im[q] * cr;
      re[q] = re[p] - vr; im[q] = im[p] - vi; re[p] += vr; im[p] += vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
    } }
}
function analyze(pcm, sr) {
  let peak = 0, energy = 0, sum = 0, tail = 0;
  for (let i = 0; i < pcm.length; i++) { const x = pcm[i]; peak = Math.max(peak, Math.abs(x)); energy += x * x; sum += x; if (i > pcm.length * .85) tail += x * x; }
  const rms = Math.sqrt(energy / pcm.length);
  const w = Math.max(1, Math.round(sr * .002)), env = [];
  for (let i = 0; i < pcm.length; i += w) { let e = 0; for (let k = i; k < Math.min(pcm.length, i + w); k++) e += pcm[k] * pcm[k]; env.push(Math.sqrt(e / w)); }
  const top = Math.max(...env), topAt = env.indexOf(top), fall = db => { const lim = top * 10 ** (db / 20); let last = topAt; for (let i = topAt; i < env.length; i++) if (env[i] >= lim) last = i; return +((last + 1) * w / sr * 1000).toFixed(1); };
  let n = 1; while (n < pcm.length * 2) n <<= 1; n = Math.max(n, 8192);
  const re = new Float64Array(n), im = new Float64Array(n); for (let i = 0; i < pcm.length; i++) re[i] = pcm[i]; fft(re, im);
  const bands = [[0, 120], [120, 500], [500, 4000], [4000, sr / 2]], be = bands.map(() => 0); let tot = 0, cent = 0;
  for (let k = 1; k < n / 2; k++) { const f = k * sr / n, p = re[k] * re[k] + im[k] * im[k]; tot += p; cent += f * p; for (let b = 0; b < 4; b++) if (f >= bands[b][0] && f < bands[b][1]) be[b] += p; }
  return {ms: +(pcm.length / sr * 1000).toFixed(1), peak: +peak.toFixed(4), rms: +rms.toFixed(4), dc: +(sum / pcm.length).toFixed(5),
    tail: +(tail / energy).toFixed(4), t20dB: fall(-20), t40dB: fall(-40), crestDb: +(20 * Math.log10(peak / rms)).toFixed(1),
    bandsPct: be.map(x => +(x / tot * 100).toFixed(1)), centroidHz: Math.round(cent / tot), sha256: sha(pcm).slice(0, 16)};
}
const rows = {
  'hit v0.2 (click)': analyze(FAudio.synthesize('click', 0, RATE), RATE),
  'kill v0.2 (body)': analyze(FAudio.synthesize('body', 0, RATE), RATE),
  'kill v0.2 (impact:dirt)': analyze(FAudio.synthesize('impact:dirt', 0, RATE), RATE),
  'touche METAL (touchConfirm) variante 0': analyze(extras.touchConfirm.synth(0, RATE), RATE),
  'touche METAL (touchConfirm) variante 1': analyze(extras.touchConfirm.synth(1, RATE), RATE),
  'kill METAL (killConfirm) variante 0': analyze(extras.killConfirm.synth(0, RATE), RATE),
  'kill METAL (killConfirm) variante 1': analyze(extras.killConfirm.synth(1, RATE), RATE)
};
const report = {schema: 'metal-feel07-confirm-v1', node: process.version, root, rate: RATE,
  note: 'bandes = % de l\'énergie [<120, 120-500, 500-4000, >4000] Hz, comme bancs/feel/audio-analyze.mjs. Crête normalisée .84 par le générateur ; le niveau de jeu (.30 et .45) est appliqué par pcm().',
  sounds: rows};
const text = JSON.stringify(report, null, 1);
if (out) writeFileSync(out, text + '\n'); else console.log(text);
