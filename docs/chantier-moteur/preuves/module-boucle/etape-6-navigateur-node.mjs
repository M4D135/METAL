// Rejoue sous Node le script de vérification de navigateur.html (le texte même, extrait de la page), avec les deux
// modules, puis compare son JSON à celui de Chrome rangé dans navigateur-resultat.txt (champ engine excepté).
// Contexte node:vm : on compare des valeurs, on ne mesure aucun temps. N'écrit rien.
// Usage, depuis la racine : node docs/chantier-moteur/preuves/module-boucle/etape-6-navigateur-node.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const here = new URL('./', import.meta.url), root = new URL('../../../../', here);
const html = fs.readFileSync(new URL('navigateur.html', here), 'utf8');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);   // les scripts sans src
if (inline.length !== 1) throw new Error('un seul script en ligne attendu dans navigateur.html, trouvé ' + inline.length);
const out = {textContent: ''}, body = {dataset: {}};
const context = vm.createContext({
  document: {getElementById: id => id === 'out' ? out : null, body},
  navigator: {userAgent: 'Node.js ' + process.version + ' (' + process.platform + ' ' + process.arch + ')'},
});
vm.runInContext('globalThis.window = globalThis;', context);                         // comme dans une page : window est le global
for (const name of ['loop.js', 'schedule.js']) vm.runInContext(fs.readFileSync(new URL('src/' + name, root), 'utf8'), context, {filename: name});
vm.runInContext(inline[0], context, {filename: 'navigateur.html'});
const node = JSON.parse(out.textContent);
console.log('Node ' + process.version + ' : data-result="' + body.dataset.result + '"');
console.log(out.textContent);

const resultFile = new URL('navigateur-resultat.txt', here);
if (fs.existsSync(resultFile)) {
  const pre = fs.readFileSync(resultFile, 'utf8').match(/<pre id="out">([\s\S]*?)<\/pre>/);
  if (!pre) throw new Error('pas de <pre id="out"> dans navigateur-resultat.txt');
  const chrome = JSON.parse(pre[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  const strip = r => JSON.stringify({...r, engine: undefined});
  console.log('même JSON que Chrome (' + chrome.engine + '), engine excepté : ' + (strip(node) === strip(chrome) ? 'oui' : 'NON'));
  if (strip(node) !== strip(chrome)) process.exitCode = 1;
}
if (body.dataset.result !== 'ok') process.exitCode = 1;
