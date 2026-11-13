// Étape 2 de la voie « boucle » : FLoop.aim et FLoop.track sur la vraie simulation, par une émulation du
// raccord (rien n'est branché dans le jeu). Domaine principal de Node, aucune horloge lue, rien d'écrit hors
// de ce dossier. Depuis la racine : node docs/chantier-moteur/preuves/module-boucle/etape-2-emulation.mjs
//
// Pour chaque scénario de tools/proof et chaque motif d'horodatage, 1 800 pas pilotés par FLoop :
// - le regard (souris émulée, semée) s'accumule d'image en image et n'est consommé qu'au premier pas ;
// - aim : à chaque pas qui consomme le regard, l'angle atteint par la simulation doit être, au bit près
//   (Object.is), celui que FLoop.aim calcule pour ce regard ; la vue affichée suit la souris sans retard ;
// - track : un traqueur par type (joueur, ennemis, projectiles, débris structurels), begin/save/prune comme
//   au §5 point 7 du document ; on compte les images où la caméra ne bouge pas, avec et sans interpolation ;
// - lecture seule : la même partie jouée sans aim ni track donne la même empreinte (chainHash, snapshot).
import {fileURLToPath} from 'node:url';
import {writeFileSync} from 'node:fs';
import os from 'node:os';
import {loadRealm} from '../../../../tools/realm-loader.mjs';
import {SCENARIOS, drive} from '../../../../tools/proof/scenarios.mjs';
import {createRun, observeRun, finishRun} from '../../../../tools/proof/run.mjs';
import {pattern} from '../../../../tools/boucle-motifs.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const loaded = loadRealm({root, realm: 'main'});
const FLoop = loadRealm({root, modules: ['loop'], realm: 'main'}).window.FLoop;
const STEPS = 1800, SEED = 96, PATTERNS = ['60', '120', '144', 'jit144'];

function emulate(scenario, name, display, weapon) {
  const run = createRun(loaded, scenario, {seed: SEED, weapon}), s = run.sim.state, L = FLoop.create(), next = pattern(name);
  const kinds = ['player', 'enemies', 'projectiles', 'rubble'], T = {}, shadow = {}, snapSeen = new Set();
  for (const kind of kinds) { T[kind] = FLoop.track(); shadow[kind] = new Map(); }
  const bodies = {
    player: f => f(0, s.player.x, s.player.y, s.player.z, 0),
    enemies: f => { for (const e of s.enemies) f(e.id, e.x, e.baseY || 0, e.z, Number.isFinite(e.yaw) ? e.yaw : 0); },
    projectiles: f => { for (const q of s.projectiles) f(q.id, q.x, q.y, q.z, 0); },
    rubble: f => { for (const d of s.debris) if (d.structural) f(d.id, d.x, d.y, d.z, d.rotation[1]); },
  };
  let k = 20261113, lookX = 0, lookY = 0, index = 0, last = 0, idealYaw = s.player.yaw;
  const u = () => (k = (Math.imul(k, 1103515245) + 12345) >>> 0) / 4294967296;
  const m = {frames: 0, zeroStepFrames: 0, consumingSteps: 0, aimMismatch: 0, notConsumed: 0, clampedPitchSteps: 0,
    aimMaxErrRad: 0, naiveLagFrames: 0, naiveMaxLagRad: 0, movingFrames: 0, camFrozenNaive: 0, camFrozenTrack: 0,
    snaps: Object.fromEntries(kinds.map(x => [x, 0])), maxStepMeters: Object.fromEntries(kinds.map(x => [x, 0])),
    unknownPoses: Object.fromEntries(kinds.map(x => [x, 0])), maxTracked: Object.fromEntries(kinds.map(x => [x, 0])),
    maxWithoutId: {bullets: 0, chips: 0}, snapSamples: []};
  const over = () => index >= STEPS || s.dead || s.won;
  const step = (h, i) => {
    if (display) {
      if (i === 0) for (const kind of kinds) T[kind].begin();
      for (const kind of kinds) bodies[kind]((id, x, y, z, a) => { T[kind].save(id, x, y, z, a); shadow[kind].set(id, [x, y, z]); });
    }
    // Le pilote de l'audit tourne la vue en écrivant le lacet : on l'annule, la souris émulée le remplace.
    const yaw0 = s.player.yaw;
    drive(index, run.input, s);
    s.player.yaw = yaw0;
    run.input.lookX = lookX;
    run.input.lookY = lookY;
    const before = [s.player.yaw, s.player.pitch], used = [lookX, lookY];
    run.sim.step(h, run.input);
    lookX = lookY = 0; // consommé au premier pas ; les pas suivants de l'image reçoivent 0
    if (display && (used[0] || used[1])) {
      m.consumingSteps++;
      const want = FLoop.aim(before[0], before[1], used[0], used[1], -1.2, 1.2);
      if (Math.abs(before[1] + used[1]) > 1.2) m.clampedPitchSteps++;
      if (!Object.is(want.yaw, s.player.yaw) || !Object.is(want.pitch, s.player.pitch)) {
        m.aimMismatch++;
        if (s.player.yaw === before[0] && s.player.pitch === before[1]) m.notConsumed++;
      }
    }
    observeRun(run, index);
    index++;
    if (over()) return false;
  };
  let lastCam = null, lastNaive = null;
  for (let i = 1; !over(); i++) {
    const stamp = next(i).stamp, dtFrame = i === 1 ? 1 / 60 : (stamp - last) / 1000;
    last = stamp;
    // Souris émulée : 0,6 rad/s de lacet (le rythme du pilote de l'audit) et une oscillation du tangage qui
    // touche les deux bornes, plus une gigue semée.
    const dX = .6 * dtFrame + (u() - .5) * .004, dY = .9 * Math.cos(stamp / 1000 * .7) * dtFrame + (u() - .5) * .002;
    lookX += dX;
    lookY += dY;
    idealYaw += dX;
    const f = L.advance(stamp, step);
    m.frames++;
    if (!f.steps) m.zeroStepFrames++;
    if (!display) continue;
    if (f.steps) for (const kind of kinds) T[kind].prune();
    const p = s.player, view = FLoop.aim(p.yaw, p.pitch, lookX, lookY, -1.2, 1.2);
    // Lacet affiché contre le lacet « idéal » (somme de toute la souris reçue) : aim, puis la caméra naïve.
    m.aimMaxErrRad = Math.max(m.aimMaxErrRad, Math.abs(view.yaw - idealYaw));
    const lag = Math.abs(p.yaw - idealYaw);
    if (lag > 1e-9) m.naiveLagFrames++;
    m.naiveMaxLagRad = Math.max(m.naiveMaxLagRad, lag);
    for (const kind of kinds) {
      m.maxTracked[kind] = Math.max(m.maxTracked[kind], T[kind].size);
      bodies[kind]((id, x, y, z, a) => {
        const old = shadow[kind].get(id);
        if (!old) { m.unknownPoses[kind]++; return; }
        const d = Math.hypot(x - old[0], y - old[1], z - old[2]);
        m.maxStepMeters[kind] = Math.max(m.maxStepMeters[kind], d);
        // Un saut se compte une fois (le pas qui l'a fait), même s'il reste affiché sur les images sans pas suivantes.
        if (d > 2 && !snapSeen.has(kind + ':' + id + '@' + index)) {
          snapSeen.add(kind + ':' + id + '@' + index);
          m.snaps[kind]++;
          if (m.snapSamples.length < 4) m.snapSamples.push({kind, id, step: index - 1, dx: x - old[0], dy: y - old[1], dz: z - old[2]});
        }
      });
    }
    m.maxWithoutId.bullets = Math.max(m.maxWithoutId.bullets, s.bullets.length);
    m.maxWithoutId.chips = Math.max(m.maxWithoutId.chips, s.debris.filter(d => !d.structural).length);
    // DEMO-V3 : images où la caméra répète la pose de l'image précédente alors que le joueur avance
    // (son dernier pas l'a déplacé), sans interpolation (pose de la simulation) et avec track.
    const cam = T.player.pose(0, p.x, p.y, p.z, 0, f.alpha), naive = [p.x, p.y, p.z], shown = [cam.x, cam.y, cam.z];
    const was = shadow.player.get(0), moving = !!was && Math.hypot(p.x - was[0], p.y - was[1], p.z - was[2]) > 1e-9;
    if (moving && lastNaive) {
      m.movingFrames++;
      if (naive.every((v, j) => Object.is(v, lastNaive[j]))) m.camFrozenNaive++;
      if (shown.every((v, j) => Object.is(v, lastCam[j]))) m.camFrozenTrack++;
    }
    lastNaive = naive;
    lastCam = shown;
  }
  const res = finishRun(run);
  return {scenario: scenario.id, pattern: name, weapon: weapon ?? null, display, steps: res.steps, chainHash: res.chainHash, snapshotSha256: res.snapshot.sha256,
    dead: res.dead, won: res.won, ...m};
}

// Les quatre scénarios sur chaque motif, plus legacy-s2 au lance-roquettes (arme 2) : seul cas où des projectiles
// existent en 1 800 pas (2 au plus), pour exercer leur traqueur.
const CASES = [...SCENARIOS.flatMap(scenario => PATTERNS.map(name => [scenario, name, undefined])),
  ...['144', 'jit144'].map(name => [SCENARIOS.find(x => x.id === 'legacy-s2'), name, 2])];
const rows = [], identity = [];
for (const [scenario, name, weapon] of CASES) {
  const a = emulate(scenario, name, true, weapon), b = emulate(scenario, name, false, weapon);
  rows.push(a);
  identity.push({scenario: scenario.id, pattern: name, weapon: weapon ?? null, sameChainHash: a.chainHash === b.chainHash, sameSnapshot: a.snapshotSha256 === b.snapshotSha256});
  console.log(`${(scenario.id + (weapon === undefined ? '' : '/arme ' + weapon)).padEnd(20)} ${name.padEnd(7)} pas ${a.steps} images ${a.frames} (0 pas : ${a.zeroStepFrames}) · aim : ${a.aimMismatch} écart sur ${a.consumingSteps} pas, ` +
    `vue naïve en retard ${a.naiveLagFrames} images · caméra figée en marche (${a.movingFrames}) : naïve ${a.camFrozenNaive}, track ${a.camFrozenTrack} · sauts > 2 m : ${Object.values(a.snaps).reduce((x, y) => x + y, 0)} · ` +
    `lecture seule : ${a.chainHash === b.chainHash && a.snapshotSha256 === b.snapshotSha256 ? 'oui' : 'NON'}`);
}
const checks = {
  aimExact: rows.every(r => r.aimMismatch === 0),
  aimConsumingSteps: rows.reduce((x, r) => x + r.consumingSteps, 0),
  aimClampedPitchSteps: rows.reduce((x, r) => x + r.clampedPitchSteps, 0),
  aimMaxErrRad: Math.max(...rows.map(r => r.aimMaxErrRad)),
  readOnly: identity.every(r => r.sameChainHash && r.sameSnapshot),
  allSteps: rows.every(r => r.steps === STEPS || r.dead || r.won),
  // Sauts de plus de 2 m en un pas (pose courante rendue, sans interpolation) : sans arme lourde, puis au lance-roquettes.
  snapsDefault: rows.filter(r => r.weapon === null).reduce((x, r) => x + Object.values(r.snaps).reduce((a, b) => a + b, 0), 0),
  snapsRockets: rows.filter(r => r.weapon !== null).reduce((x, r) => x + Object.values(r.snaps).reduce((a, b) => a + b, 0), 0),
  camFrozenTrack: rows.reduce((x, r) => x + r.camFrozenTrack, 0),
  maxStepMeters: Object.fromEntries(['player', 'enemies', 'projectiles', 'rubble'].map(kind => [kind, Math.max(...rows.map(r => r.maxStepMeters[kind]))])),
  maxTracked: Object.fromEntries(['player', 'enemies', 'projectiles', 'rubble'].map(kind => [kind, Math.max(...rows.map(r => r.maxTracked[kind]))])),
};
const out = {schema: 'boucle-etape-2-emulation-v1', node: process.version, arch: process.arch, platform: process.platform,
  cpu: os.cpus()[0]?.model, loadavg: os.loadavg(), steps: STEPS, seed: SEED, patterns: PATTERNS, checks, identity, rows};
writeFileSync(new URL('./etape-2-emulation.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(checks));
process.exitCode = checks.aimExact && checks.readOnly && checks.allSteps && checks.camFrozenTrack === 0 ? 0 : 1;
