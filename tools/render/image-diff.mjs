// Pixel comparison of two RGBA8 images (lot 00 / R1, RCPU-V3). Pure Node, no dependency.
//
// Acceptance rules of RCPU-V3:
//   identical           0 differing pixel (all four channels compared);
//   visually-identical  PSNR >= 60 dB, < 0.1 % of pixels with a channel delta > 10/255, alpha unchanged;
//   different           anything else, including a size mismatch.
// meanAbsDeltaRgb, the counts above 3/10/25 and the PSNR follow the audit's bench
// (bancs/rgpu/pre.js): RGB channels, 0..255 scale. psnrDb is null when the RGB
// channels are identical (the audit's page wrote 99 in that case).
//
// CLI: node tools/render/image-diff.mjs a.png b.png [--diff diff.png] [--out report.json]
//      [--thresholds 3,10,25] [--accept identical|visual]
// Exit code 0 when accepted (identical by default), 1 when not, 2 on error.
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';
import {checkImage, readPNG, writePNG} from './png.mjs';

export const DEFAULT_THRESHOLDS = Object.freeze([3, 10, 25]);
export const VISUAL_RULE = Object.freeze({minPsnrDb: 60, threshold: 10, maxRatio: 0.001});

export function diffImages(a, b, {thresholds = DEFAULT_THRESHOLDS} = {}) {
  checkImage(a, 'a');
  checkImage(b, 'b');
  if (!thresholds.every(t => Number.isInteger(t) && t >= 0 && t < 255)) throw new RangeError('thresholds must be integers in 0..254');
  if (a.width !== b.width || a.height !== b.height)
    return {comparable: false, identical: false, verdict: 'different', reason: 'size', sizeA: [a.width, a.height], sizeB: [b.width, b.height]};
  const {width, height} = a, pa = a.data, pb = b.data, pixels = width * height, over = thresholds.map(() => 0);
  let differentPixels = 0, alphaDifferentPixels = 0, maxChannelDelta = 0, sumAbs = 0, sumSq = 0;
  let x0 = width, y0 = height, x1 = -1, y1 = -1, first = null;
  for (let p = 0, i = 0; p < pixels; p++, i += 4) {
    const dr = Math.abs(pa[i] - pb[i]), dg = Math.abs(pa[i + 1] - pb[i + 1]), db = Math.abs(pa[i + 2] - pb[i + 2]), da = Math.abs(pa[i + 3] - pb[i + 3]);
    if (!(dr | dg | db | da)) continue;
    const x = p % width, y = (p - x) / width, rgb = Math.max(dr, dg, db), any = Math.max(rgb, da);
    differentPixels++;
    if (da) alphaDifferentPixels++;
    if (any > maxChannelDelta) maxChannelDelta = any;
    for (let k = 0; k < thresholds.length; k++) if (rgb > thresholds[k]) over[k]++;
    sumAbs += dr + dg + db;
    sumSq += dr * dr + dg * dg + db * db;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    y1 = y;
    if (!first) first = {x, y, a: [pa[i], pa[i + 1], pa[i + 2], pa[i + 3]], b: [pb[i], pb[i + 1], pb[i + 2], pb[i + 3]]};
  }
  const mse = sumSq / (pixels * 3);
  const report = {
    comparable: true, width, height, pixels,
    identical: differentPixels === 0,
    differentPixels, differentRatio: differentPixels / pixels, alphaDifferentPixels, maxChannelDelta,
    meanAbsDeltaRgb: sumAbs / (pixels * 3), mse,
    psnrDb: mse === 0 ? null : 10 * Math.log10(255 * 255 / mse),
    over: Object.fromEntries(thresholds.map((t, k) => [String(t), {pixels: over[k], ratio: over[k] / pixels}])),
    bbox: differentPixels ? {x0, y0, x1, y1} : null,
    first,
  };
  report.verdict = classify(report);
  return report;
}

// Re-applies the RCPU-V3 rule; needs the count above VISUAL_RULE.threshold.
export function classify(d) {
  if (!d.comparable) return 'different';
  if (d.identical) return 'identical';
  if (d.alphaDifferentPixels || d.psnrDb === null) return 'different';
  const above = d.over[String(VISUAL_RULE.threshold)];
  if (!above) throw new Error(`classify needs the threshold ${VISUAL_RULE.threshold} in the report`);
  return d.psnrDb >= VISUAL_RULE.minPsnrDb && above.ratio < VISUAL_RULE.maxRatio ? 'visually-identical' : 'different';
}

// Difference map, one output pixel per input pixel: unchanged pixels as a dim grey copy of a,
// changed pixels from pure red (delta 1) to yellow (delta >= 255/gain), so that a single
// differing pixel stands out.
export function diffImage(a, b, {gain = 16} = {}) {
  checkImage(a, 'a');
  checkImage(b, 'b');
  if (a.width !== b.width || a.height !== b.height) throw new RangeError('diffImage: images must have the same size');
  const out = Buffer.alloc(a.data.length), pa = a.data, pb = b.data;
  for (let i = 0; i < out.length; i += 4) {
    const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]), Math.abs(pa[i + 3] - pb[i + 3]));
    if (d) { out[i] = 255; out[i + 1] = Math.min(255, d * gain); out[i + 2] = 0; }
    else out[i] = out[i + 1] = out[i + 2] = Math.round((pa[i] * 0.299 + pa[i + 1] * 0.587 + pa[i + 2] * 0.114) * 0.3);
    out[i + 3] = 255;
  }
  return {width: a.width, height: a.height, data: out};
}

function main(argv) {
  const files = [], options = {accept: 'identical'};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith('--')) { files.push(item); continue; }
    const value = argv[++i];
    if (value === undefined) throw new Error(`Missing value for ${item}`);
    if (item === '--diff') options.diff = value;
    else if (item === '--out') options.out = value;
    else if (item === '--thresholds') options.thresholds = value.split(',').map(Number);
    else if (item === '--accept' && ['identical', 'visual'].includes(value)) options.accept = value;
    else throw new Error(`Unknown option ${item} ${value}`);
  }
  if (files.length !== 2) throw new Error('Usage: node tools/render/image-diff.mjs a.png b.png [--diff diff.png] [--out report.json] [--thresholds 3,10,25] [--accept identical|visual]');
  const [a, b] = files.map(file => readPNG(file));
  const thresholds = options.thresholds || DEFAULT_THRESHOLDS;
  const report = {schema: 'metal-image-diff-v1', a: resolve(files[0]), b: resolve(files[1]), ...diffImages(a, b, {thresholds: thresholds.includes(10) ? thresholds : [...thresholds, 10]})};
  if (options.diff && report.comparable) report.diffImage = writePNG(options.diff, diffImage(a, b));
  const text = JSON.stringify(report, null, 2) + '\n';
  if (options.out) { mkdirSync(dirname(resolve(options.out)), {recursive: true}); writeFileSync(options.out, text); }
  process.stdout.write(text);
  const accepted = report.verdict === 'identical' || (options.accept === 'visual' && report.verdict === 'visually-identical');
  return accepted ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
