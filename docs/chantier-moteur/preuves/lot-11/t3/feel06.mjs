// Lot 11 / T3 — FEEL-06 mesuré sur la recette INTÉGRÉE (src/audio-recipes.js), en domaine
// principal (tools/realm-loader.mjs, realm 'main'), jamais node:vm pour des temps.
// Comparaison : banque v0.2 (FAudio sans table) contre table METAL, à crête égale.
// Énergie absolue des bandes comme bancs/feel-verif2/t4.mjs ; formes comme checks/audio.test.mjs ;
// empreintes croisées avec le prototype d'audit bancs/feel/doomish.mjs.
// usage : node docs/chantier-moteur/preuves/lot-11/t3/feel06.mjs [racine] [--out fichier.json]
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import vm from 'node:vm';
import {loadRealm} from '../../../../../tools/realm-loader.mjs';

const args = process.argv.slice(2), root = resolve(args[0] || '.');
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const RATE = 22050, WEAPONS = ['pistol', 'smg', 'shotgun', 'rocket', 'grenade'];
const sha = a => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');

const v = loadRealm({root, modules: ['music', 'audio', 'audio-recipes'], globals: {}});
const FAudio = v.window.FAudio, table = v.window.MetalAudio.recipes;

// prototype d'audit (piste à reproduire, pas du code à fusionner)
const protoPath = join(root, '.relais/audit/bancs/feel/doomish.mjs');
let proto = null;
if (existsSync(protoPath)) {
  // on ne garde que RECIPES + synth() du prototype d'audit, hors de son harnais d'import
  const raw = readFileSync(protoPath, 'utf8');
  const src = raw.slice(raw.indexOf('const RECIPES={'), raw.indexOf('if(import.meta.url'))
    .replace(/^export /gm, '') + '\nexportedSynth=synth;exportedNames=Object.keys(RECIPES);';
  const c = {Math, Float32Array, RATE};
  vm.createContext(c);
  vm.runInContext(src, c, {filename: 'doomish.mjs'});
  proto = {synth: c.exportedSynth, names: c.exportedNames};
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) for (let k = 0, cr = 1, ci = 0; k < len / 2; k++) {
      const p = i + k, q = p + len / 2, vr = re[q] * cr - im[q] * ci, vi = re[q] * ci + im[q] * cr;
      re[q] = re[p] - vr; im[q] = im[p] - vi; re[p] += vr; im[p] += vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
    } }
}
// énergie absolue de [lo,hi) en dB, comme bandDb() du test et t4.mjs
function bandDb(pcm, lo, hi) {
  let n = 1; while (n < pcm.length) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n); re.set(pcm); fft(re, im);
  let e = 0; for (let k = 1; k < n / 2; k++) { const f = k * RATE / n; if (f >= lo && f < hi) e += re[k] ** 2 + im[k] ** 2; }
  return 10 * Math.log10(2 * e / n);
}
function shape(pcm) {
  let peak = 0, sum = 0, energy = 0, tail = 0, diff = 0;
  for (let i = 0; i < pcm.length; i++) { const x = pcm[i]; peak = Math.max(peak, Math.abs(x)); sum += x; energy += x * x; if (i) diff += (x - pcm[i - 1]) ** 2; if (i > pcm.length * .85) tail += x * x; }
  let end = 0; for (let i = pcm.length - Math.round(.02 * RATE); i < pcm.length; i++) end = Math.max(end, Math.abs(pcm[i]));
  return {seconds: +(pcm.length / RATE).toFixed(3), peak: +peak.toFixed(4), rms: +Math.sqrt(energy / pcm.length).toFixed(5),
    dc: +(sum / pcm.length).toFixed(5), tail: +(tail / energy).toFixed(4), tailEnd: +end.toFixed(4), brightness: +(diff / energy).toFixed(4)};
}
const rows = {};
for (const name of WEAPONS) {
  const before = FAudio.synthesize(name, 0, RATE), after = table[name].synth(0, RATE);
  const before1 = FAudio.synthesize(name, 1, RATE), after1 = table[name].synth(1, RATE);
  const under = pcm => { const total = bandDb(pcm, 0, RATE / 2), low = bandDb(pcm, 0, 120); return +(10 ** ((low - total) / 10) * 100).toFixed(2); };
  rows[name] = {
    seconds: shape(after).seconds, cap: {pistol: .36, smg: .26, shotgun: .95, rocket: .82, grenade: .55}[name],
    shape: [shape(after), shape(after1)], variantsDiffer: sha(after) !== sha(after1), reproducible: sha(after) === sha(table[name].synth(0, RATE)),
    band120_500_dB: {v02: +bandDb(before, 120, 500).toFixed(2), metal: +bandDb(after, 120, 500).toFixed(2), gain: +(bandDb(after, 120, 500) - bandDb(before, 120, 500)).toFixed(2)},
    rmsAtEqualPeak_dB: +(20 * Math.log10(shape(after).rms / shape(before).rms)).toFixed(2),
    under120Pct: {v02: under(before), metal: under(after), ratio: +(under(after) / Math.max(1e-9, under(before))).toFixed(2)},
    sha256: {v02: sha(before).slice(0, 16), metal: sha(after).slice(0, 16)},
    matchesAuditPrototype: proto && proto.names.includes(name)
      ? {v0: sha(after) === sha(proto.synth(name, 0)), v1: sha(after1) === sha(proto.synth(name, 1))}
      : 'nom absent du prototype d\'audit'
  };
}
const report = {schema: 'metal-feel06-v1', node: process.version, root, rate: RATE, weapons: rows,
  note: 'crête normalisée à .84 par les deux moteurs : rms comparés à crête égale. Énergie de bande absolue, pas en pourcentage.'};
const text = JSON.stringify(report, null, 1);
if (out) writeFileSync(out, text + '\n'); else console.log(text);
