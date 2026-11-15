// Comparaison de pixels Chrome/SwiftShader entre deux racines du dépôt (lot 05).
// usage: node tools/render/lot05-pixels.mjs --base <racineA> --head <racineB> [--out rapport.json] [--png-dir captures]
import {withChrome} from './chrome.mjs';
import {diffImages, diffImage} from './image-diff.mjs';
import {writePNG} from './png.mjs';
import {writeFileSync, mkdirSync, existsSync, copyFileSync} from 'node:fs';
import {dirname} from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def; };
const base = opt('base', '.'), head = opt('head', '.');
const outFile = opt('out', null), pngDir = opt('png-dir', null);
const page = 'tools/render/pages/lot05-scene.html';
const tmpRoot = opt('tmp', '/tmp/opencode');
process.env.TMPDIR = tmpRoot;
if (pngDir) mkdirSync(pngDir, {recursive: true});

const SCENARIOS = [
  {id: 'camp17-a', seed: 96, world: 17, campaign: true, camera: 0, width: 1280, height: 720},
  {id: 'camp17-b', seed: 96, world: 17, campaign: true, camera: 2, width: 1280, height: 720, dx: 18, dz: -12},
  {id: 'camp17-c', seed: 96, world: 17, campaign: true, camera: 4, width: 1280, height: 720, dx: -30, dz: 24},
  {id: 'camp6-a', seed: 96, world: 6, campaign: true, camera: 1, width: 1024, height: 640},
  {id: 'camp6-b', seed: 96, world: 6, campaign: true, camera: 3, width: 1024, height: 640, dx: 12, dz: 9},
  {id: 'legacy0-a', seed: 96, world: 0, campaign: false, camera: 0, width: 1024, height: 640},
  {id: 'legacy0-b', seed: 96, world: 0, campaign: false, camera: 5, width: 1024, height: 640, dx: -14, dz: 7},
  {id: 'camp17-low', seed: 96, world: 17, campaign: true, camera: 1, width: 800, height: 480, quality: 'low'},
  {id: 'camp17-high', seed: 96, world: 17, campaign: true, camera: 3, width: 800, height: 480, quality: 'high'},
  {id: 'camp17-noshadow', seed: 96, world: 17, campaign: true, camera: 2, width: 800, height: 480, shadows: false, bloom: false},
  {id: 'telephone', seed: 96, world: 17, campaign: true, camera: 1, width: 390, height: 844, dx: 6, dz: 6},
  {id: 'telephone-grand', seed: 96, world: 6, campaign: true, camera: 4, width: 390, height: 844},
  {id: 'canvas2d', seed: 96, world: 17, campaign: true, camera: 0, width: 640, height: 400, backend: 'canvas2d'},
  {id: 'canvas2d-telephone', seed: 96, world: 6, campaign: true, camera: 2, width: 390, height: 844, backend: 'canvas2d'},
];

const pageSource = new URL('./pages/lot05-scene.html', import.meta.url).pathname;
for (const root of [base, head]) {
  const target = root + '/' + page;
  mkdirSync(dirname(target), {recursive: true});
  copyFileSync(pageSource, target);
}

const report = {base, head, chrome: null, scenarios: [], identical: true, worst: 0};
await withChrome({window: [1280, 720], dpr: 1, tmpRoot}, async browser => {
  report.chrome = browser.version;
  const pages = {};
  for (const root of [base, head]) pages[root] = await browser.openPage(root + '/' + page);
  report.environment = await pages[head].evaluate('proof.environment()');
  for (let pass = 0; pass < 2; pass++) {
    for (const scenario of SCENARIOS) {
      const json = JSON.stringify(scenario);
      const order = pass === 0 ? [base, head] : [head, base];
      const images = {};
      for (const root of order) images[root] = await pages[root].image('proof.render(' + json + ')');
      if (pass > 0) continue;
      const a = images[base], b = images[head];
      const diff = diffImages(a, b);
      const entry = {id: scenario.id, scenario, shaBase: a.sha256, shaHead: b.sha256,
        identical: diff.identical, differentPixels: diff.differentPixels, differentRatio: diff.differentRatio,
        maxChannelDelta: diff.maxChannelDelta, meanAbsDeltaRgb: diff.meanAbsDeltaRgb, psnrDb: diff.psnrDb, verdict: diff.verdict,
        statsBase: a.extra && a.extra.stats, statsHead: b.extra && b.extra.stats};
      report.scenarios.push(entry);
      if (!diff.identical) {
        report.identical = false;
        report.worst = Math.max(report.worst, diff.maxChannelDelta || 0);
        if (pngDir) {
          writePNG(pngDir + '/' + scenario.id + '-base.png', a);
          writePNG(pngDir + '/' + scenario.id + '-head.png', b);
          writePNG(pngDir + '/' + scenario.id + '-diff.png', {width: a.width, height: a.height, data: diffImage(a, b)});
        }
      }
    }
  }
});
const text = JSON.stringify(report, null, 1) + '\n';
if (outFile) writeFileSync(outFile, text);
console.log(text);
