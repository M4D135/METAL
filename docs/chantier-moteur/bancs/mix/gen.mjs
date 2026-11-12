// Banc MIX — copie de travail des sources (lecture seule du dépôt) vers src.js, chargé par mix.html en file://.
// usage : node gen.mjs <racine METAL> <bench/feel/doomish.mjs> <dossier de sortie> [racine METAL B]
// La racine B, facultative, est embarquée en SRC_B pour job=ab (A = SRC, B = SRC_B, sources telles quelles).
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const [root, doomish, out, rootB] = process.argv.slice(2);
if (!root || !doomish || !out) throw new Error('usage : node gen.mjs <racine METAL> <doomish.mjs> <dossier de sortie> [racine METAL B]');
const read = r => ({audio: readFileSync(r + '/src/audio.js', 'utf8'), music: readFileSync(r + '/src/music.js', 'utf8')});
const sha = t => createHash('sha256').update(t).digest('hex'), info = (r, s) => ({root: resolve(r), audioSha256: sha(s.audio), musicSha256: sha(s.music)});
const A = read(root), B = rootB ? read(rootB) : null;
// Prototype FEEL-06 : RECIPES + synth() de bench/feel/doomish.mjs, repris tels quels (sans les imports Node ni l'export WAV).
const d = readFileSync(doomish, 'utf8'), a = d.indexOf('const RECIPES='), b = d.indexOf('function wav(');
if (a < 0 || b < 0) throw new Error('doomish.mjs a changé');
let proto = d.slice(a, b).replace('export function synth', 'function synth').replace('rate=RATE', 'rate=22050');
// Grenade : FEEL-06 ne donne que « 110→45 Hz, comme la roquette, 520 ms » ; hypothèse du banc MIX, à valider à l'écoute.
proto = proto.replace("rocket: {dur:.80,", "grenade:{dur:.52, crack:[.45,2.5], thump:{f0:110,f1:45,tp:.060,ta:.200,g:.95}, body:{cut:1100,tb:.120,g:.90,drive:2.6}, mech:[[.020,.20,1900]], room:{tr:.160,g:.22}},\n  rocket: {dur:.80,");
if (!proto.includes('grenade:{dur:.52')) throw new Error('recette grenade non insérée');
writeFileSync(out + '/src.js', 'window.SRC=' + JSON.stringify(A) + ';\nwindow.SRC_B=' + JSON.stringify(B) + ';\nwindow.SRC_INFO=' + JSON.stringify({A: info(root, A), B: B && info(rootB, B)}) + ';\nwindow.DOOMISH=(function(){' + proto + '\nreturn {RECIPES:RECIPES,synth:synth};})();\n');
console.log('src.js écrit : audio', A.audio.length, 'music', A.music.length, 'proto', proto.length, B ? '| B : audio ' + B.audio.length + ' music ' + B.music.length : '| sans B');
