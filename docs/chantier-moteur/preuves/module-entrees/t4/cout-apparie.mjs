// Module entrées, étape 4 : coût par image avant et après, apparié et alterné dans un même processus, domaine principal
// de Node (pas de node:vm). Image du §7.2 de la mission, sans le tactile (étape 7) : une manette dont les valeurs changent
// à chaque image (axes sin(i·.013), cos(i·.017), sin(i·.011), .5·cos(i·.019) ; RT = (i % 90) / 89 ; A appuyé une image
// sur 37), W appuyée toutes les 7 images et relâchée 3 images plus tard, un mouvement de souris, frame(1/60), puis 1 pas,
// ou 2 une image sur trois. Variante « sans manette » : getGamepads rend une liste vide (coût de la lecture seule).
// Chauffe de 20 000 images par cas, puis 10 tours de 100 000 images par cas, dans un ordre alterné.
//   node docs/chantier-moteur/preuves/module-entrees/t4/cout-apparie.mjs <racine avant> <racine après>
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const roots = process.argv.slice(2, 4).map(r => resolve(r));
if (roots.length !== 2) { console.error('usage : node cout-apparie.mjs <racine avant> <racine après>'); process.exit(2); }
const label = root => { const git = (...a) => spawnSync('git', ['-C', root, ...a], {encoding: 'utf8'}).stdout.trim(); return git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain', '--', 'src/input.js') ? ' + arbre de travail' : ''); };
const {METAL_INPUT: M, fakePad} = await import('file://' + roots[1] + '/checks/finput-fixture.mjs');
let sink = 0;
const bench = (root, withPad) => {
  const pad = fakePad(), list = withPad ? [pad] : [], w = {navigator: {getGamepads: () => list}};
  new Function('window', readFileSync(root + '/src/input.js', 'utf8'))(w);
  const inp = w.FInput.create(M);
  const frames = (n, i0) => {
    for (let i = i0; i < i0 + n; i++) {
      pad.axes[0] = Math.sin(i * .013); pad.axes[1] = Math.cos(i * .017); pad.axes[2] = Math.sin(i * .011); pad.axes[3] = .5 * Math.cos(i * .019);
      const rt = pad.buttons[7], a = pad.buttons[0]; rt.value = (i % 90) / 89; rt.pressed = rt.value > .5; a.pressed = i % 37 === 0; a.value = +a.pressed;
      if (i % 7 === 0) inp.keyDown('KeyW', i, false); if (i % 7 === 3) inp.keyUp('KeyW', i);
      inp.mouseMove(3, -2, i);
      const f = inp.frame(1 / 60), s = inp.step(); if (i % 3 === 0) inp.step();
      sink += f.pressed.length + s.moveY + s.lookX;
    }
  };
  return {frames, i: 0};
};
const cases = [['avant, manette', roots[0], true], ['après, manette', roots[1], true], ['avant, sans manette', roots[0], false], ['après, sans manette', roots[1], false]].map(([name, root, pad]) => ({name, b: bench(root, pad), ns: []}));
const time = f => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t); };
for (const c of cases) { c.b.frames(20000, 0); c.b.i = 20000; }
for (let k = 0; k < 10; k++) for (const c of k % 2 ? [...cases].reverse() : cases) { c.ns.push(time(() => c.b.frames(100000, c.b.i)) / 100000); c.b.i += 100000; }
const med = a => { const s = [...a].sort((x, y) => x - y); return (s[4] + s[5]) / 2; }, r1 = v => +v.toFixed(1);
const out = {tool: 'cout-apparie.mjs', node: process.version, arch: process.arch, platform: process.platform, avant: label(roots[0]), apres: label(roots[1]), nsParImage: {}};
for (const c of cases) out.nsParImage[c.name] = {series: c.ns.map(r1), mediane: r1(med(c.ns)), min: r1(Math.min(...c.ns)), max: r1(Math.max(...c.ns))};
const m = name => out.nsParImage[name].mediane;
out.surcoutManetteNs = r1(m('après, manette') - m('avant, manette'));
out.surcoutLectureSansManetteNs = r1(m('après, sans manette') - m('avant, sans manette'));
out.attendu = 'médiane < 20 000 ns par image (mission, §7.2)';
out.sink = sink > 0;
console.log(JSON.stringify(out, null, 1));
