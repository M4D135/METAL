// STAB — détail des premières images de jeu (sondes audio par méthode) et de la première image de menu.
// node first-frames.mjs <racine METAL> [monde=c0]
import {createHarness, cpuNow, PROBE_NAMES, EXC, CNT, resetProbes} from './harness.mjs';
const [root, w = 'c0'] = process.argv.slice(2), index = +w.slice(1);
const H = await createHarness(root, {audioDetail: true});
const show = (label, ms) => console.log(label, ms.toFixed(2) + ' ms |', PROBE_NAMES.map((n, i) => [n, EXC[i], CNT[i]]).filter(x => x[1] > .25).sort((a, b) => b[1] - a[1]).slice(0, 9).map(x => x[0] + '=' + x[1].toFixed(2) + (x[2] > 1 ? '(' + x[2] + ')' : '')).join(' '));
let t = 0; for (let i = 0; i < 4; i++) { t += 16.667; resetProbes(); const a = cpuNow(); H.frame(t); show('menu ' + i, cpuNow() - a); }
for (let i = 0; i < 120; i++) { t += 16.667; H.frame(t); }
resetProbes(); const c = cpuNow(); await H.startGame(); show('chargement (bouton start → playing)', cpuNow() - c);
if (index) { resetProbes(); const a = cpuNow(); H.G.load(index, 96, undefined, true, 2); H.G.saveCheckpoint(); H.G.start('bench'); show('load(' + index + ')', cpuNow() - a); }
t = H.now; H.G.fire = true;
for (let i = 0; i < 8; i++) { t += 16.667; resetProbes(); const a = cpuNow(); H.frame(t); show('jeu ' + i, cpuNow() - a); }
// pause puis reprise, boutique : transitions
H.G.fire = false; for (let i = 0; i < 240; i++) { t += 16.667; H.frame(t); }
const med = []; for (let i = 0; i < 60; i++) { t += 16.667; const a = cpuNow(); H.frame(t); med.push(cpuNow() - a); } med.sort((a, b) => a - b); console.log('médiane jeu établi', med[30].toFixed(2));
resetProbes(); let a = cpuNow(); H.G.togglePause(); show('togglePause → paused', cpuNow() - a);
const pm = []; for (let i = 0; i < 60; i++) { t += 16.667; resetProbes(); const a = cpuNow(); H.frame(t); pm.push(cpuNow() - a); if (i === 0) show('pause image 0', pm[0]); } pm.sort((a, b) => a - b); console.log('médiane image en pause', pm[30].toFixed(2), '(draw complet derrière le menu)');
resetProbes(); a = cpuNow(); H.G.togglePause(); show('togglePause → playing', cpuNow() - a);
for (let i = 0; i < 3; i++) { t += 16.667; resetProbes(); const a = cpuNow(); H.frame(t); show('reprise ' + i, cpuNow() - a); }
process.exit(0);
