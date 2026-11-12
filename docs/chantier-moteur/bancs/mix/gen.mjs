// Banc MIX — copie de travail des sources (lecture seule du dépôt) vers src.js, chargé par mix.html en file://.
// usage : node gen.mjs <racine METAL> <bench/feel/doomish.mjs> <dossier de sortie>
import {readFileSync, writeFileSync} from 'node:fs';
const [root, doomish, out] = process.argv.slice(2);
const audio = readFileSync(root + '/src/audio.js', 'utf8'), music = readFileSync(root + '/src/music.js', 'utf8');
// Prototype FEEL-06 : RECIPES + synth() de bench/feel/doomish.mjs, repris tels quels (sans les imports Node ni l'export WAV).
const d = readFileSync(doomish, 'utf8'), a = d.indexOf('const RECIPES='), b = d.indexOf('function wav(');
if (a < 0 || b < 0) throw new Error('doomish.mjs a changé');
let proto = d.slice(a, b).replace('export function synth', 'function synth').replace('rate=RATE', 'rate=22050');
// Grenade : FEEL-06 ne donne que « 110→45 Hz, comme la roquette, 520 ms » ; hypothèse du banc MIX, à valider à l'écoute.
proto = proto.replace("rocket: {dur:.80,", "grenade:{dur:.52, crack:[.45,2.5], thump:{f0:110,f1:45,tp:.060,ta:.200,g:.95}, body:{cut:1100,tb:.120,g:.90,drive:2.6}, mech:[[.020,.20,1900]], room:{tr:.160,g:.22}},\n  rocket: {dur:.80,");
if (!proto.includes('grenade:{dur:.52')) throw new Error('recette grenade non insérée');
writeFileSync(out + '/src.js', 'window.SRC=' + JSON.stringify({audio, music}) + ';\nwindow.DOOMISH=(function(){' + proto + '\nreturn {RECIPES:RECIPES,synth:synth};})();\n');
console.log('src.js écrit : audio', audio.length, 'music', music.length, 'proto', proto.length);
