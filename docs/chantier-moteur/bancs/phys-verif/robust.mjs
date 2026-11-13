// Contre-vérification PHYS : cas non couverts par le banc d'origine (lecture seule de ../phys/fphys.mjs).
import { create } from '../phys/fphys.mjs';
const HZ = 120;
const run = (w, s, sub = 1, hz = HZ) => { for (let i = 0; i < s * hz; i++) w.step(1 / hz, sub); };
const pose = (w, ids, ideal) => { let h = 0, v = 0, t = 0, sp = 0; ids.forEach((b, k) => { const id = ideal[k]; h = Math.max(h, Math.hypot(w.P[b * 3] - id[0], w.P[b * 3 + 2] - id[2])); v = Math.max(v, Math.abs(w.P[b * 3 + 1] - id[1])); t = Math.max(t, 1 - Math.abs(w.R[b * 9 + 4])); sp = Math.max(sp, Math.hypot(w.V[b * 6], w.V[b * 6 + 1], w.V[b * 6 + 2])); }); return `horiz ${(h * 1000).toFixed(1)} mm vert ${(v * 1000).toFixed(1)} mm tilt ${(Math.acos(Math.min(1, 1 - t)) * 180 / Math.PI).toFixed(2)} deg speed ${(sp * 1000).toFixed(1)} mm/s`; };
function stack(w, n, y0, masses, x = 0, z = 0, h = 0.4) { const ids = [], ideal = []; for (let i = 0; i < n; i++) { const y = y0 + h + i * 2 * h; ids.push(w.addBox(x, y, z, h, h, h, masses[i % masses.length], 0.6, 0.1)); ideal.push([x, y, z]); } return { ids, ideal }; }

// T1 : pile de 10 posée sur le dessus d'une boîte statique (chemin boxBox+IDENT) au lieu du plan de sol (boxGround)
for (const [label, opts] of [['sol plan', {}], ['dessus de boite statique', { static: 1 }], ['joint entre 2 boites statiques', { static: 2 }]]) {
  const w = create({ capacity: 64, sleepTime: 1e9 }); let y0 = 0;
  if (opts.static === 1) { w.addStatic(-3, 0, -3, 3, 1, 3); y0 = 1; } else if (opts.static === 2) { w.addStatic(-3, 0, -3, 0, 1, 3); w.addStatic(0, 0, -3, 3, 1, 3); y0 = 1; }
  w.buildStatics(); const s = stack(w, 10, y0, [30]); const out = []; for (const t of [1, 4, 5]) { run(w, t); out.push(pose(w, s.ids, s.ideal)); }
  console.log(`T1 pile10 sur ${label}: t=1s ${out[0]} | t=5s ${out[1]} | t=10s ${out[2]}`);
}
// T1b : 60 Hz x 2 sur 60 s (la vitesse résiduelle mesurée à 5 s dépasse le seuil de sommeil)
{ const w = create({ capacity: 64, sleepTime: 1e9 }); w.buildStatics(); const s = stack(w, 10, 0, [30]); const out = []; let mx = 0; for (let t = 0; t < 60; t++) { for (let i = 0; i < 60; i++) { w.step(1 / 60, 2); for (const b of s.ids) mx = Math.max(mx, Math.hypot(w.V[b * 6], w.V[b * 6 + 1], w.V[b * 6 + 2])); } if (t === 9 || t === 29 || t === 59) { out.push(`t=${t + 1}s ${pose(w, s.ids, s.ideal)} vmax-cumul ${(mx * 1000).toFixed(0)} mm/s`); } } console.log('T1b pile10 60Hz x2, 60 s: ' + out.join(' | ')); }
{ const w = create({ capacity: 64, sleepTime: 1e9 }); w.buildStatics(); const s = stack(w, 10, 0, [30]); const out = []; for (let t = 0; t < 60; t++) { run(w, 1); if (t === 9 || t === 29 || t === 59) out.push(`t=${t + 1}s ${pose(w, s.ids, s.ideal)}`); } console.log('T1c pile10 120Hz x1, 60 s: ' + out.join(' | ')); }

// T2 : rapports de masses (lourd sur léger)
for (const [label, masses, n] of [['150 sur 8 (2 caisses)', [8, 150], 2], ['alternance 8/60 x6', [8, 60], 6], ['8,8,8,8,150 (5)', [8, 8, 8, 8, 150], 5], ['45 sur 15 sur 30 sur 12 (4)', [12, 30, 15, 45], 4]]) {
  const w = create({ capacity: 64, sleepTime: 1e9 }); w.buildStatics(); const s = stack(w, n, 0, masses); const out = []; for (const t of [1, 4, 5]) { run(w, t); out.push(pose(w, s.ids, s.ideal)); }
  console.log(`T2 masses ${label}: t=1s ${out[0]} | t=10s ${out[2]}`);
}

// T3 : réveil d'une pile endormie (le cache d'impulsions est vide au réveil : pn = nc à chaque pas)
for (const [label, build] of [['pile10', w => stack(w, 10, 0, [30])], ['pile3', w => stack(w, 3, 0, [30])]]) {
  for (const j of [0.001, 6, 30]) {
    const w = create({ capacity: 64 }); w.buildStatics(); const s = build(w); run(w, 3); const asleep = s.ids.every(b => w.FL[b] & 2); const before = s.ids.map(b => [w.P[b * 3], w.P[b * 3 + 1], w.P[b * 3 + 2]]);
    const top = s.ids[s.ids.length - 1]; w.impulseAt(top, w.P[top * 3] - 0.4, w.P[top * 3 + 1], w.P[top * 3 + 2], j, 0, 0);
    let vmax = 0, vy = 0; for (let i = 0; i < 6 * HZ; i++) { w.step(1 / HZ, 1); if (i < 30) for (const b of s.ids.slice(0, -1)) { vmax = Math.max(vmax, Math.hypot(w.V[b * 6], w.V[b * 6 + 2])); vy = Math.max(vy, Math.abs(w.V[b * 6 + 1])); } }
    let dmax = 0, dtop = Math.hypot(w.P[top * 3] - before[before.length - 1][0], w.P[top * 3 + 2] - before[before.length - 1][2]); s.ids.slice(0, -1).forEach((b, k) => { dmax = Math.max(dmax, Math.hypot(w.P[b * 3] - before[k][0], w.P[b * 3 + 1] - before[k][1], w.P[b * 3 + 2] - before[k][2])); });
    console.log(`T3 reveil ${label} (endormie avant: ${asleep}) impulsion ${j} sur la caisse du haut: deplacement du haut ${(dtop * 1000).toFixed(1)} mm ; autres caisses: deplacement max ${(dmax * 1000).toFixed(1)} mm, vitesse horiz. max ${(vmax * 1000).toFixed(1)} mm/s, vert. max ${(vy * 1000).toFixed(1)} mm/s dans les 30 premiers pas ; rendormie: ${s.ids.every(b => w.FL[b] & 2)}`);
  }
}

// T4 : tôle de 2 cm (demi-épaisseur 1 cm < marge 2 cm), caisse de 30 kg lâchée de 3 m dessus ; pile de 5 tôles
{
  const w = create({ capacity: 64, sleepTime: 1e9 }); w.buildStatics(); const sheet = w.addBox(0, 0.01, 0, 0.6, 0.01, 0.4, 8, 0.45, 0.24); const crate = w.addBox(0.1, 3.4, 0, 0.4, 0.4, 0.4, 30, 0.6, 0.1); w.V[crate * 6 + 1] = -8;
  let minSheet = 1, minCrate = 9, maxSheetV = 0; for (let i = 0; i < 4 * HZ; i++) { w.step(1 / HZ, 1); minSheet = Math.min(minSheet, w.P[sheet * 3 + 1]); minCrate = Math.min(minCrate, w.P[crate * 3 + 1] - 0.4); if (i > 2 * HZ) maxSheetV = Math.max(maxSheetV, Math.hypot(w.V[sheet * 6], w.V[sheet * 6 + 1], w.V[sheet * 6 + 2])); }
  console.log(`T4 tole 2 cm + caisse lachee a 8 m/s: centre tole min y ${(minSheet * 1000).toFixed(1)} mm (ideal 10), dessous de caisse min y ${(minCrate * 1000).toFixed(1)} mm (ideal 20), fin: tole y ${(w.P[sheet * 3 + 1] * 1000).toFixed(1)} caisse dessous ${((w.P[crate * 3 + 1] - 0.4) * 1000).toFixed(1)} mm, vitesse tole max apres 2 s ${(maxSheetV * 1000).toFixed(1)} mm/s`);
  const w2 = create({ capacity: 64, sleepTime: 1e9 }); w2.buildStatics(); const ids = []; for (let k = 0; k < 5; k++) ids.push(w2.addBox(0, 0.01 + k * 0.021, 0, 0.6, 0.01, 0.4, 8, 0.45, 0.24)); run(w2, 5); let sp = 0; for (const b of ids) sp = Math.max(sp, Math.hypot(w2.V[b * 6], w2.V[b * 6 + 1], w2.V[b * 6 + 2]));
  console.log(`T4b pile de 5 toles, 5 s: y = ${ids.map(b => (w2.P[b * 3 + 1] * 1000).toFixed(1)).join(', ')} mm (ideal 10, 30, 50, 70, 90), vitesse max ${(sp * 1000).toFixed(1)} mm/s`);
}

// T5 : arêtes internes — caisse qui glisse à 6 m/s sur une rangée de boîtes statiques jointives (dessus à y=1)
for (const [label, tiles] of [['une seule boite de 24 m', 1], ['24 boites jointives de 1 m', 24], ['sol plan', 0]]) {
  const w = create({ capacity: 8, sleepTime: 1e9 }); const y0 = tiles ? 1 : 0;
  if (tiles === 1) w.addStatic(-12, 0, -2, 12, 1, 2); else for (let k = 0; k < tiles; k++) w.addStatic(-12 + k, 0, -2, -11 + k, 1, 2);
  w.buildStatics(); const b = w.addBox(-11, y0 + 0.4 - 0.005, 0.137, 0.4, 0.4, 0.4, 30, 0.6, 0.1); run(w, 0.5); w.V[b * 6] = 9;
  let hop = 0, vyMax = 0, tilt = 0, t = 0; for (let i = 0; i < 4 * HZ; i++) { w.step(1 / HZ, 1); hop = Math.max(hop, w.P[b * 3 + 1] - (y0 + 0.4)); vyMax = Math.max(vyMax, Math.abs(w.V[b * 6 + 1])); tilt = Math.max(tilt, 1 - Math.abs(w.R[b * 9 + 4])); }
  console.log(`T5 glissade 9 m/s sur ${label}: distance ${(w.P[b * 3] + 11).toFixed(3)} m, saut max ${(hop * 1000).toFixed(1)} mm, |vy| max ${(vyMax * 1000).toFixed(0)} mm/s, inclinaison max ${(Math.acos(1 - tilt) * 180 / Math.PI).toFixed(2)} deg, derive z ${((w.P[b * 3 + 2] - 0.137) * 1000).toFixed(1)} mm`);
}

// T6 : impulsion d'une balle (PHYS-07 propose pistolet 6, mitraillette 4, plomb 3) sur une caisse de 30 en haut d'une pile de 3
for (const j of [6, 4, 3, 30, 60, 120]) {
  const w = create({ capacity: 8 }); w.buildStatics(); const s = stack(w, 3, 0, [30]); run(w, 2); const top = s.ids[2], x0 = w.P[top * 3];
  w.impulseAt(top, w.P[top * 3] - 0.4, w.P[top * 3 + 1] + 0.2, w.P[top * 3 + 2], j, 0, 0); run(w, 4);
  const fell = w.P[top * 3 + 1] < 1.5; console.log(`T6 balle impulsion ${j} sur caisse 30 kg (dv ${(j / 30).toFixed(2)} m/s): deplacement ${((w.P[top * 3] - x0) * 1000).toFixed(1)} mm, tombee de la pile: ${fell}`);
}
for (const [j, m, name] of [[6, 8, 'tole 8'], [6, 12, 'tuyau 12'], [6, 15, 'palette 15'], [6, 25, 'baril 25']]) {
  const w = create({ capacity: 8 }); w.buildStatics(); const b = w.addBox(0, 0.4, 0, 0.3, 0.4, 0.3, m, 0.5, 0.2); run(w, 2); const x0 = w.P[b * 3]; w.impulseAt(b, -0.3, 0.6, 0, j, 0, 0); run(w, 4);
  console.log(`T6b pistolet (6) sur ${name} au sol: deplacement ${((w.P[b * 3] - x0) * 1000).toFixed(1)} mm`);
}

// T7 : dynamique contre dynamique — objet lancé à 12 m/s (PHYS-10) puis 24 et 40 m/s contre une tôle debout (2 cm) et contre une pile endormie
for (const speed of [12, 24, 40]) {
  let through = 0, total = 0;
  for (let k = 0; k < 40; k++) {
    const w = create({ capacity: 8, maxLinear: 60 }); w.buildStatics(); const plate = w.addBox(5, 1, 0, 0.01, 1, 1.5, 400, 0.5, 0.1); run(w, 0.2);
    const h = 0.08 + 0.02 * (k % 5), i = w.addBox(5 - 1.5 - 0.013 * k, 1 + 0.05 * (k % 7), -0.6 + 0.03 * k, h, h, h, 5, 0.5, 0.2); w.V[i * 6] = speed; w.V[i * 6 + 3] = 3 * (k % 5); w.V[i * 6 + 4] = 7;
    let passed = false; for (let s = 0; s < 60; s++) { w.step(1 / HZ, 1); if (w.P[i * 3] > w.P[plate * 3] + 0.05) passed = true; } total++; if (passed) through++;
  }
  console.log(`T7 objet de 5 kg a ${speed} m/s contre une tole dynamique debout de 2 cm (400 kg): ${through}/${total} traversees`);
}
