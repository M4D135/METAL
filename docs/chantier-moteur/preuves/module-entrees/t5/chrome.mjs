// Module entrées, étape 5 : vérification dans un vrai Chrome sans interface, piloté par tube (bancs/tact/cdp.mjs :
// --remote-debugging-pipe, aucun port, aucun serveur, réseau coupé), sur une page file:// qui charge src/input.js tel quel
// avec la déclaration de METAL (celle du fixture, sans migrate). On relève :
//   1. guessDevice() sur le bureau, puis sous émulation mobile et tactile (page rechargée) ;
//   2. un vrai keydown (Input.dispatchKeyEvent : code KeyW, key « z », puis KeyM, key « , ») passé à keyDown par un
//      écouteur, puis keyLabel et label ;
//   3. navigator.keyboard.getLayoutMap() passé à setLayout sur une instance neuve, si Chrome le fournit ;
//   4. frame() et rumble() avec le vrai navigator.getGamepads() (aucune manette) : false, sans exception ;
//   5. les exceptions de la page (Runtime.exceptionThrown).
//   node docs/chantier-moteur/preuves/module-entrees/t5/chrome.mjs <dossier de travail, hors du dépôt> [racine]
import {mkdirSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const work = process.argv[2], root = process.argv[3] || new URL('../../../../../', import.meta.url).pathname;
if (!work) { console.error('usage : node chrome.mjs <dossier de travail, hors du dépôt> [racine]'); process.exit(2); }
const {launch} = await import('file://' + root + '/docs/chantier-moteur/bancs/tact/cdp.mjs');
const {METAL_INPUT: M} = await import('file://' + root + '/checks/finput-fixture.mjs');
mkdirSync(work, {recursive: true});
const page = work + '/page.html';
writeFileSync(page, `<!doctype html><meta charset="utf-8"><title>FInput</title>
<script src="file://${root}/src/input.js"></script>
<script>
window.decl = ${JSON.stringify({...M, migrate: undefined})};
window.inp = FInput.create(decl); window.seenKeys = [];
addEventListener('keydown', e => { seenKeys.push([e.code, e.key]); inp.keyDown(e.code, e.timeStamp, e.repeat, e.key); });
addEventListener('keyup', e => inp.keyUp(e.code));
</script>`);
const C = await launch(work + '/profil');
const out = {tool: 'chrome.mjs', chrome: (await C.send('Browser.getVersion', {}, false)).product, page: 'file:// (src/input.js tel quel)'};
try {
  await C.navigate('file://' + page);
  const env = 'JSON.stringify({coarse: matchMedia("(pointer: coarse)").matches, hoverNone: matchMedia("(hover: none)").matches, maxTouchPoints: navigator.maxTouchPoints, guess: FInput.guessDevice()})';
  out.bureau = JSON.parse(await C.evaluate(env));
  const key = async (code, k, vk) => {
    await C.send('Input.dispatchKeyEvent', {type: 'keyDown', code, key: k, text: k, unmodifiedText: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk});
    await C.send('Input.dispatchKeyEvent', {type: 'keyUp', code, key: k, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk});
  };
  await key('KeyW', 'z', 90); await key('KeyM', ',', 188);
  out.clavier = JSON.parse(await C.evaluate('JSON.stringify({vus: seenKeys, KeyW: inp.keyLabel("KeyW"), KeyM: inp.keyLabel("KeyM"), forward: inp.label("forward", "keyboard"), map: inp.label("map", "keyboard"), device: inp.device})'));
  out.tableDuClavier = JSON.parse(await C.evaluate(`(async () => {
    const r = {getLayoutMap: typeof navigator.keyboard?.getLayoutMap};
    if (r.getLayoutMap !== 'function') return JSON.stringify(r);
    try { const m = await navigator.keyboard.getLayoutMap(), i = FInput.create(decl); i.setLayout(m);
      Object.assign(r, {taille: m.size, KeyQ: m.get('KeyQ'), KeyW: m.get('KeyW'), KeyM: m.get('KeyM'), labelKeyQ: i.keyLabel('KeyQ'), labelKeyM: i.keyLabel('KeyM'), forward: i.label('forward', 'keyboard'), map: i.label('map', 'keyboard')});
    } catch (e) { r.erreur = String(e); }
    return JSON.stringify(r); })()`));
  out.vibration = JSON.parse(await C.evaluate('(() => { const r = {}; try { r.getGamepads = JSON.stringify(Array.from(navigator.getGamepads())); r.frame = inp.frame(1 / 60).pads.length; r.rumble = inp.rumble(.5, .5, 100, 1000); r.exception = null; } catch (e) { r.exception = String(e); } return JSON.stringify(r); })()'));
  await C.size(390, 844, 3, true);
  await C.navigate('file://' + page);
  out.mobileTactile = JSON.parse(await C.evaluate(env));
  out.exceptionsDeLaPage = C.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);
} finally { await C.close(); }
out.attendu = {bureau: 'keyboard', clavier: 'KeyW → Z, KeyM → ,', vibration: 'rumble false, aucune exception', mobileTactile: 'touch', exceptionsDeLaPage: 0};
out.ok = out.bureau.guess === 'keyboard' && out.clavier.KeyW === 'Z' && out.clavier.KeyM === ',' && out.vibration.rumble === false && out.vibration.exception === null && out.mobileTactile.guess === 'touch' && out.exceptionsDeLaPage.length === 0;
const git = (...a) => spawnSync('git', ['-C', root, ...a], {encoding: 'utf8'}).stdout.trim();
out.module = git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain', '--', 'src/input.js') ? ' + arbre de travail' : '');
console.log(JSON.stringify(out, null, 1));
process.exitCode = out.ok ? 0 : 1;
