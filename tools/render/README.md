# Outils de rendu — lot 00, R1

Chrome sans tête piloté par le protocole DevTools sur un tube
(`--remote-debugging-pipe`, descripteurs 3 et 4, messages JSON séparés par un
octet nul), lecture des pixels par `readPixels`, PNG et comparaison d'images.
Constats : RCPU-V3, RGPU-11, PARA-13 (point 5), étape 0 de `ARBITRAGES.md`.

Ces outils sont hors de `npm test` et hors du budget de 1 400 000 octets du
jeu. Ils n'ont aucune dépendance, n'ouvrent aucun port, ne lancent aucun
serveur et ne chargent que des pages `file://`. Ils remplacent, pour ce Mac,
les outils Linux perdus du point de reprise (`render-egl.mjs`,
`render-proof.mjs`, `tools/render/harness.mjs`).

| Fichier | Rôle |
|---|---|
| `chrome.mjs` | Lanceur : profil jetable, pages `file://`, évaluation, transfert binaire, nettoyage garanti. |
| `png.mjs` | Encodeur et décodeur PNG 8 bits, outils d'image RGBA8. |
| `image-diff.mjs` | Différence de pixels, verdict RCPU-V3, carte de différence ; utilisable en ligne de commande. |
| `pages/probe.html` | Page sonde autonome : environnement, scènes WebGL2 et Canvas 2D déterministes. |
| `self-check.mjs` | Auto-contrôle de tout ce qui précède (`npm run render-check`). |

## Commandes

Depuis la racine du dépôt :

```sh
npm run render-check
node tools/render/self-check.mjs --out /tmp/rendu-a.json --png-dir /tmp/rendu-png
node tools/render/self-check.mjs --out /tmp/rendu-b.json --compare /tmp/rendu-a.json
node tools/render/self-check.mjs --no-chrome
node tools/render/image-diff.mjs avant.png apres.png --diff difference.png --out difference.json
```

L'auto-contrôle dure de 6 à 15 s sur le Mac M5 selon la charge de la machine
(huit lancements de Chrome). Le rapport JSON complet sort
sur la sortie standard (et dans `--out`) ; un résumé en français sort sur la
sortie d'erreur : version de Chrome, chaîne GPU, extensions WebGL2, pas de
`performance.now`, empreintes SHA-256 des scènes, nombre de contrôles réussis.
Code de sortie 0 si tous les contrôles passent, 1 sinon. `--compare` exige
que chaque empreinte soit identique à celle d'un rapport précédent : c'est la
preuve de reproductibilité entre deux processus. `--chrome-path` et `--angle`
choisissent le navigateur et le moteur ANGLE (`none` omet le drapeau).

`image-diff.mjs` rend 0 si les images sont identiques, 1 sinon, 2 en cas
d'erreur ; `--accept visual` accepte aussi le verdict « visuellement identique ».

## API

### `chrome.mjs`

```js
import {launch, withChrome} from './tools/render/chrome.mjs';
import {writePNG} from './tools/render/png.mjs';

const browser = await launch({window: [1440, 932], dpr: 1});
try {
  const page = await browser.openPage('tools/render/pages/probe.html');
  const env = await page.evaluate('probe.environment()');
  const image = await page.image('probe.render("scene3d", {seed: 7})');
  writePNG('/tmp/scene.png', image);
  console.log(env.webgl2.unmaskedRenderer, image.sha256);
} finally {
  await browser.close();
}
```

`launch(options)` démarre Chrome et rend un objet `browser`. Options, toutes
facultatives :

| Option | Défaut | Effet |
|---|---|---|
| `chromePath` | `CHROME_PATH`, sinon le Chrome de la plateforme | Exécutable. Sur macOS : `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. |
| `angle` | `metal` sur macOS, `d3d11` sur Windows, rien ailleurs | `--use-angle=…` ; `null` ou `'none'` omet le drapeau. |
| `window` | `[800, 600]` | Fenêtre et fenêtre d'affichage en pixels CSS (`[l, h]`, `'lxh'` ou `{width, height}`). |
| `dpr` | `1` | `devicePixelRatio` (`--force-device-scale-factor` et émulation par page). |
| `timeoutMs` | `60000` | Délai par commande ; s'il est dépassé, Chrome est tué et le profil supprimé avant le rejet. |
| `launchTimeoutMs`, `closeTimeoutMs` | `30000`, `5000` | Démarrage ; fermeture propre avant destruction forcée. |
| `extraArgs` | `[]` | Drapeaux en plus. Refusés : port ou adresse de débogage, accès aux fichiers, sécurité web, proxy, et les drapeaux que le lanceur gère lui-même. |
| `tmpRoot` | `os.tmpdir()` | Dossier des profils jetables `metal-render-<pid>-XXXXXX`. |
| `onConsole` | aucun | Rappel `({type, text, url})` pour chaque `console.*` des pages. |

`browser` :

- `openPage(fichier, {query, window, dpr, timeoutMs})` ouvre une page
  `file://` (chemin, URL `file:` ou `about:blank` ; toute autre URL est
  refusée) dans un nouvel onglet, règle la fenêtre d'affichage par
  `Emulation.setDeviceMetricsOverride` (en mode sans tête, `--window-size`
  seul donne une hauteur utile plus petite), attend l'événement `load` et
  rend une `page`.
- `evaluate(expression, options)` évalue dans la dernière page ouverte.
- `send(méthode, paramètres, {sessionId, timeoutMs})` envoie une commande
  DevTools brute.
- `systemInfo()` : GPU vu par le processus navigateur (pilote, état des
  fonctions graphiques).
- `processIds()` : processus du groupe de Chrome ; `pid`, `profileDir`,
  `version`, `args`, `closed`, `stderr`, `sweptProfiles`.
- `close()` : `Browser.close`, attente de la sortie, destruction du groupe de
  processus, suppression du profil. Sans effet si déjà fermé. Toujours
  l'appeler (ou passer par `withChrome`) : tant que Chrome tourne, ses tubes
  gardent le processus Node en vie.

`page` :

- `evaluate(expression, {timeoutMs, awaitPromise})` : les promesses sont
  attendues ; la valeur revient en JSON. Une exception de la page rejette
  avec `code: 'PAGE_EXCEPTION'` et son message.
- `call(fonction, ...arguments)` : appelle une fonction dans la page avec des
  arguments JSON. C'est ainsi que l'on passe des données à une page : jamais
  par `fetch()` en `file://`.
- `bytes(expression)` : l'expression rend un `ArrayBuffer` ou un tableau typé ;
  le résultat est un `Buffer`. Transfert par blocs base64 d'un Mio, contrôlé
  par un SHA-256 calculé dans la page (`crypto.subtle`, disponible car
  `file://` est un contexte sécurisé).
- `image(expression, {origin})` : l'expression rend
  `{width, height, data | pixels, ...}` en RGBA8. `origin: 'bottom-left'`
  (défaut, sortie de `readPixels`) retourne l'axe Y ; `'top-left'` (sortie de
  `getImageData`) le garde. Rend `{width, height, data, sha256,
  sourceSha256, transferVerified, extra}` : `sha256` porte sur les pixels de
  haut en bas, `sourceSha256` sur les octets reçus, `extra` sur les autres
  champs de l'objet.
- `close()`, `console` et `errors` (journaux de la page, 500 entrées au plus).

`withChrome(options, async browser => …)` lance, exécute et ferme dans tous
les cas. `dumpDom(fichier, {query, virtualTimeBudgetMs, …})` sert les pages
héritées qui écrivent leur résultat dans le DOM : `chrome --dump-dom`, mêmes
drapeaux, même profil jetable, même nettoyage. `processTree(pid)`,
`internetSockets(pids)` (`lsof -n -P -a -p … -i`) et `commandLine(pid)`
servent aux contrôles. `sweepStaleProfiles()` supprime les profils laissés par
un processus Node disparu ; `launch()` l'appelle.

### `png.mjs`

Une image est `{width, height, data}` : `width × height × 4` octets RGBA8,
lignes de haut en bas.

- `encodePNG(image, {filter, level})` : PNG RGBA 8 bits sans entrelacement ni
  bloc de couleur (pas de gAMA, iCCP ou sRGB : les lecteurs gardent les
  octets). Filtre `adaptive` par défaut (plus petite somme absolue par ligne),
  ou `none`, `sub`, `up`, `average`, `paeth`. Sortie déterministe pour une
  version de zlib donnée : comparer des pixels, jamais des fichiers PNG.
- `decodePNG(octets)` : PNG 8 bits sans entrelacement, en niveaux de gris,
  gris et alpha, RVB, RVBA ou palette, avec `tRNS`. Chaque CRC est vérifié ;
  tout le reste échoue avec un message explicite.
- `writePNG(chemin, image)`, `readPNG(chemin)`, `flipRows(data, l, h)`,
  `imageSha256(image)`, `checkImage`, `createImage`, `cloneImage`, `crc32`.

### `image-diff.mjs`

`diffImages(a, b, {thresholds = [3, 10, 25]})` rend :

| Champ | Sens |
|---|---|
| `identical`, `differentPixels`, `differentRatio` | Pixels dont au moins un canal RVBA diffère. |
| `alphaDifferentPixels`, `maxChannelDelta` | Écarts sur l'alpha ; plus grand écart d'un canal. |
| `meanAbsDeltaRgb`, `mse`, `psnrDb` | Sur les canaux RVB, échelle 0-255, comme le banc `bancs/rgpu/pre.js`. `psnrDb` vaut `null` si les canaux RVB sont identiques (la page de l'audit écrivait 99). |
| `over["3"\|"10"\|"25"]` | Nombre et part des pixels dont le plus grand écart RVB dépasse le seuil. |
| `bbox`, `first` | Rectangle des pixels différents ; premier pixel différent avec ses deux valeurs. |
| `verdict` | `identical` (aucun pixel différent), `visually-identical` (PSNR ≥ 60 dB, moins de 0,1 % de pixels à plus de 10/255, alpha inchangé), `different` (y compris des tailles différentes, `comparable: false`). |

`diffImage(a, b)` rend une carte : pixels inchangés en gris sombre, pixels
modifiés du rouge vif (écart 1) au jaune, si bien qu'un seul pixel reste
visible.

### `pages/probe.html`

La page expose `window.probe` :

- `environment()` : agent, fenêtre, `isSecureContext`, `crossOriginIsolated`,
  `OfflineAudioContext`, WebGPU, chaînes `VENDOR`/`RENDERER` et non masquées,
  extensions triées, fonctions clés, limites, pas de `performance.now`.
- `render(scène, paramètres)` : `legacy` (shaders du prototype vérifié,
  320×200, `seed`), `scene3d` (81 boîtes instanciées, profondeur, mélange,
  brouillard, caméra fixe ; `seed`, `width`, `height`, `eye`, `target`, `fov`,
  dessinée dans un tampon RGBA8 + profondeur 24 bits) et `canvas2d` (chemins
  et dégradés Canvas 2D, rastérisation logicielle par `willReadFrequently`).
- `timeBlocks(paramètres, {warmup, blocks, frames})` : temps par image de
  `scene3d` mesuré par blocs, une seule synchronisation `readPixels` 1×1 par
  bloc, après une chauffe.
- `decodePng(base64)` et `encodePngWithChrome()` : le décodeur et l'encodeur
  PNG de Chrome, pour contrôler `png.mjs` contre une autre implémentation.

`?dump=1` écrit le résultat de deux rendus dans `<pre id="out">` pour
`dumpDom`.

## Règles pour les bancs des lots suivants (05, 06, 15, 16)

- **Aucun port, aucun serveur.** `--remote-debugging-pipe`, ou `dumpDom` pour
  une page héritée. `--remote-debugging-port` et
  `--allow-file-access-from-files` (que les `run.sh` de l'audit utilisaient)
  sont refusés. `--host-resolver-rules="MAP * ~NOTFOUND"` reste en place.
- **Données d'entrée** : les inclure dans la page générée, ou les passer par
  `page.call()`. Jamais de `fetch()` en `file://`.
- **Pixels** : `readPixels` dans la tâche qui dessine (ou depuis un tampon
  d'image hors écran), jamais `Page.captureScreenshot`, qui passe par la
  composition et la gestion des couleurs. Retourner l'axe Y :
  `page.image()` le fait.
- **Chauffe** : chaque profil jetable démarre avec un cache de shaders froid.
  Chauffer dans le même lancement, avant toute mesure.
- **Temps** : `performance.now()` avance par pas de 0,1 ms sans isolation
  d'origine (`crossOriginIsolated` est faux en `file://`). Mesurer des blocs
  d'images avec une seule synchronisation par bloc (débit pipeliné, RGPU-11),
  jamais une image isolée.
- **Comparaisons** : variantes dans un même lancement, ordre alterné à chaque
  image, plusieurs répétitions, médianes (RCPU-V3). Critère « identique » :
  `verdict === 'identical'` sur toutes les images.
- **Matériel** : les empreintes de pixels dépendent du GPU, du pilote et de la
  version de Chrome. Comparer des rendus faits sur la même machine.

## Nettoyage

Le profil `metal-render-<pid>-XXXXXX` est supprimé, et tout le groupe de
processus de Chrome tué (Chrome est lancé comme chef de son propre groupe), à
la fermeture, après une erreur dans `withChrome`, après un délai dépassé,
sur SIGINT (Ctrl-C), SIGTERM ou SIGHUP, sur une exception non rattrapée et sur
`process.exit()`. Après un signal, le signal est relancé si le programme hôte
n'a pas son propre gestionnaire. Si Node est tué par SIGKILL, Chrome se ferme
de lui-même à la fermeture du tube, mais le profil reste : le lancement
suivant le supprime (son processus propriétaire n'existe plus).
L'auto-contrôle vérifie chacun de ces cas, sauf SIGKILL.

## Vérifié et à vérifier

Vérifié sur le Mac M5 (Chrome 157.0.8103.39, Node 24.18) : rendu WebGL2 par
ANGLE Metal sur le vrai GPU (« ANGLE (Apple, ANGLE Metal Renderer: Apple M5,
Unspecified Version) »), mêmes pixels entre deux rendus, deux lancements et
deux processus, mêmes pixels par le tube et par `--dump-dom`, octets bruts de
la scène `legacy` identiques à ceux du prototype (`1eb2798a…`), aucun socket
Internet dans les processus de Chrome, pas de `performance.now` de 0,1 ms,
`EXT_disjoint_timer_query_webgl2`, `KHR_parallel_shader_compile` et
`OfflineAudioContext` présents.

À vérifier sur david-pc (Windows, carte NVIDIA) : le tube sur les descripteurs
3 et 4 (pris en charge par Chrome sous Windows, non essayé ici), `--use-angle=d3d11`,
le chemin de Chrome, la destruction des processus (pas de groupe de processus
sous Windows : seul le processus navigateur est tué, les autres se ferment
avec le tube) et l'absence de `lsof` (le contrôle de sockets y est sans objet).
Sous ANGLE Metal, `EXT_disjoint_timer_query_webgl2` est présent mais rend des
valeurs cumulées (RGPU-11) : ne pas s'en servir sur ce Mac.
