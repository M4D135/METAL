// STAB-verif — endurance simulation seule : pas fixe 1/60, 10 minutes simulées, un monde ; coût CPU par pas, tailles des tableaux d'état, tas après collecte.
// node --expose-gc endure.mjs <racine METAL> [monde=c0] [secondes=600]
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const [root, wname = 'c0', secArg = '600'] = process.argv.slice(2), SECS = +secArg;
globalThis.window = globalThis;
for (const n of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation']) vm.runInThisContext(readFileSync(root + '/src/' + n + '.js', 'utf8'), {filename: n + '.js'});
const cpu = () => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; };
const index = +wname.slice(1), world = FWorld.create(96, index, {campaign: true, campaignVersion: 2});
const sim = FSimulation.create(world, {armorSystem: true, brain: FBrain.create({mode: 'cpu'})}); sim.setDifficulty?.(0);
const s = sim.state, p = s.player, input = {moveX: 0, moveY: 0, lookX: 0, lookY: 0, fire: false, fireLeft: false, dash: false, pulse: false, melee: false, interact: false, weapon: 0, sprint: false, assist: false};
const H = 1 / 60, W0 = performance.now(); let t = 0, step = 0, target = null;
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
const q = (a, f) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * f))]; };
let ms = [], peakDebris = 0, revs0 = s.destructionRevision || 0;
const sizes = () => Object.fromEntries(Object.entries(s).filter(([, v]) => Array.isArray(v) && v.length).map(([k, v]) => [k, v.length]));
while (t < SECS && performance.now() - W0 < 270000) {
  if (step % 30 === 0) { let bd = Infinity; target = null; for (const e of s.enemies) if (e.hp > 0 && e.deployed !== false) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; target = e; } } if (!target) for (const e of s.enemies) if (e.hp > 0) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < bd) { bd = d; target = e; } } }
  if (target) { const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz); if (d > 6) { const k = Math.min(1, 7 * H / d); p.x += dx * k; p.z += dz * k; const y = sim.ground(p.x, p.z); if (Number.isFinite(y)) p.y = y; } p.yaw = Math.atan2(dx, -dz) + Math.sin(step / 45) * .15; p.pitch = 0; }
  else { p.yaw += .01; }
  if (p.hp < 100) p.hp = 100;
  if (step % 600 === 0) { const inv = s.inventory; if (inv?.weapons) { inv.weapons.fill(true); const caps = sim.ammoCaps || []; inv.ammo = inv.ammo.map((v, i) => caps[i] ?? v); } }
  input.fire = (step % 30) < 14; input.weapon = [4, 0, 2, 1, 3][Math.floor(step / 120) % 5];
  const c = cpu(); sim.step(H, input); ms.push(cpu() - c); s.events.length = 0; t += H; step++;
  peakDebris = Math.max(peakDebris, s.debris?.length || 0);
  if (step % 1800 === 0) {
    global.gc?.(); const heap = process.memoryUsage().heapUsed / 1e6;
    console.log(JSON.stringify({t: Math.round(t), stepMed: +med(ms).toFixed(3), p99: +q(ms, .99).toFixed(2), max: +Math.max(...ms).toFixed(1), heapMo: +heap.toFixed(1), alive: s.enemies.filter(e => e.hp > 0).length, kills: s.kills, rev: (s.destructionRevision || 0) - revs0, dead: !!s.dead, won: !!s.won, sizes: sizes()}));
    ms = [];
  }
}
