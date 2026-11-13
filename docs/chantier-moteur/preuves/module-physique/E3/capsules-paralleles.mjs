// Nearly parallel capsules, module step 3: a short capsule (height 0.6) dropped on the middle of a long one (height 1.2),
// both on X, radius 0.15, on the ground. The module puts the two points at the ends of the part of A's segment that faces
// B; the literal rule of the brief (§5.4: each end of A against its nearest point on B) is obtained by patching that
// line of src/physics.js in memory. Run from the root of the repository:
//   node docs/chantier-moteur/preuves/module-physique/E3/capsules-paralleles.mjs
import {source} from '../../../../../checks/fphysics-scenes.mjs';

const MODULE = 'if(den<1e-3){const g=Math.abs(k)*eb;s0=-c-g;s1=-c+g;s0=s0>ea?ea:s0<-ea?-ea:s0;s1=s1>ea?ea:s1<-ea?-ea:s1;}';
const LITERAL = 'if(den<1e-3){s0=-ea;s1=ea;}';
const text = source();
if (!text.includes(MODULE)) throw new Error('parallel branch not found in src/physics.js');
const build = src => { const w = {}; new Function('window', src)(w); return w.FPhysics; };
const B64 = {minX: -64, maxX: 64, minZ: -64, maxZ: 64};

for (const [name, F] of [['module', build(text)], ['littéral', build(text.replace(MODULE, LITERAL))]]) {
  for (const shortFirst of [false, true]) {
    const w = F.create({bounds: B64, capacity: 8, maxContacts: 256, maxStatics: 16, maxJoints: 4, ground: 0}), onX = [0, 0, Math.PI / 2];
    const make = (h, y) => w.addBody({shape: 'capsule', radius: 0.15, height: h, rot: onX, pos: [0, y, 0], mass: 10});
    let s, l;
    if (shortFirst) { s = make(0.6, 0.6); l = make(1.2, 0.15); } else { l = make(1.2, 0.15); s = make(0.6, 0.6); }
    for (let i = 0; i < 480; i++) w.step(1 / 120);
    console.log(`${name.padEnd(9)} ${shortFirst ? 'courte créée en premier (A = courte)' : 'longue créée en premier (A = longue)'} : courte à y = ${w.body(s).pos[1].toFixed(4)}, longue à y = ${w.body(l).pos[1].toFixed(4)} ; ${w.isAsleep(s) && w.isAsleep(l) ? 'endormies' : 'éveillées'}`);
  }
}
console.log('# posée sur la longue, la courte est attendue à y ≈ 0,145 + 0,3 - 0,005 ≈ 0,44 ; à y ≈ 0,145, elle a traversé la longue et repose au sol');
