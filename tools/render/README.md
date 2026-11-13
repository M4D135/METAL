# Outils de rendu — lot 00, R1 et R1b

Chrome sans tête piloté par le protocole DevTools sur un tube
(`--remote-debugging-pipe`, descripteurs 3 et 4, messages JSON séparés par un
octet nul), lecture des pixels par `readPixels`, PNG et comparaison d'images ;
lanceur générique des pages de banc. Constats : RCPU-V3, RGPU-11, PARA-13
(point 5), étape 0 de `ARBITRAGES.md`. R1 : lanceur et images ; R1b :
portabilité Linux (Spark), `METAL_RENDER_ANGLE`, `run-page.mjs`.

Ces outils sont hors de `npm test` et hors du budget de 1 400 000 octets du
jeu. Ils n'ont aucune dépendance, n'ouvrent aucun port, ne lancent aucun
serveur et ne chargent que des pages `file://`. Ils tournent sous macOS (ce
Mac) et sous Linux (le Spark), et remplacent les outils Linux perdus du point
de reprise (`render-egl.mjs`, `render-proof.mjs`, `tools/render/harness.mjs`).

| Fichier | Rôle |
|---|---|
| `chrome.mjs` | Lanceur : profil jetable, pages `file://`, évaluation, transfert binaire, nettoyage garanti. |
| `run-page.mjs` | Ligne de commande : une page de banc (héritée de l'audit ou nouvelle), son résultat, ses captures. |
| `png.mjs` | Encodeur et décodeur PNG 8 bits, outils d'image RGBA8. |
| `image-diff.mjs` | Différence de pixels, verdict RCPU-V3, carte de différence ; utilisable en ligne de commande. |
| `pages/probe.html` | Page sonde autonome : environnement, scènes WebGL2 et Canvas 2D déterministes. |
| `pages/dump-fixture.html` | Page d'essai de `run-page.mjs` : modes par fragment, marqueurs, enveloppe, captures. |
| `self-check.mjs` | Auto-contrôle du lanceur, des PNG et des comparaisons (`npm run render-check`). |
| `check-run-page.mjs` | Auto-contrôle de `run-page.mjs` et des ajouts de R1b à `chrome.mjs`. |

## Commandes

Depuis la racine du dépôt :

```sh
npm run render-check
node tools/render/self-check.mjs --out /tmp/rendu-a.json --png-dir /tmp/rendu-png
node tools/render/self-check.mjs --out /tmp/rendu-b.json --compare /tmp/rendu-a.json
node tools/render/self-check.mjs --no-chrome
node tools/render/check-run-page.mjs --self-check /tmp/rendu-a.json
node tools/render/image-diff.mjs avant.png apres.png --diff difference.png --out difference.json
node tools/render/run-page.mjs 'page.html#mode,arguments' --window 1600,900 --png-dir captures --out resultat.json
```

L'auto-contrôle dure de 5 à 15 s sur le Mac M5 selon la charge (huit
lancements de Chrome). Le rapport JSON complet sort sur la sortie standard (et
dans `--out`) ; un résumé en français sort sur la sortie d'erreur : version de
Chrome, drapeaux GPU et leur origine, chaîne GPU, extensions WebGL2, pas de
`performance.now`, empreintes SHA-256 des scènes, nombre de contrôles réussis.
Code de sortie 0 si tous les contrôles passent, 1 sinon. `--compare` exige
que chaque empreinte soit identique à celle d'un rapport précédent : c'est la
preuve de reproductibilité entre deux processus, sur une même chaîne GPU.
`--chrome-path` et `--angle` choisissent le navigateur et le moteur ANGLE
(`none` omet le drapeau). Nombre de contrôles : 56 sur le Mac (57 avec
`--compare`) ; 55 ailleurs (56), car `prototype.legacyIdentical` compare les
octets bruts de la scène `legacy` à ceux du prototype, mesurés sur la seule
chaîne du Mac (ANGLE Metal, Apple M5, Chrome 157.0.8103.39).

`check-run-page.mjs` (une quinzaine de secondes sur le Mac, 64 contrôles avec
`--self-check`, 22 avec `--no-chrome`) vérifie sans navigateur les drapeaux GPU par plateforme,
`METAL_RENDER_ANGLE`, les URL de page, les refus, l'analyse des arguments, des
marqueurs, de l'enveloppe et des captures ; puis lance `run-page.mjs` comme
commande, une vingtaine de fois, sur `pages/dump-fixture.html` et
`pages/probe.html` : résultat, codes de sortie, captures, attente, appel de
la page, délai dépassé (Chrome tué), nettoyage. Avec `--self-check FICHIER`
(rapport de `self-check.mjs` sur la même machine), les images de la sonde lues
par `run-page.mjs` doivent porter les mêmes empreintes ; ce fichier est lu
avant tout lancement (illisible ou sans empreintes : code 2). Code de sortie
0 si tous les contrôles passent, 1 sinon, 2 pour une option inconnue.

`image-diff.mjs` rend 0 si les images sont identiques, 1 sinon, 2 en cas
d'erreur ; `--accept visual` accepte aussi le verdict « visuellement identique ».

## Variables d'environnement et chaînes GPU

| Variable | Effet |
|---|---|
| `CHROME_PATH` | Exécutable de Chrome. Défaut : `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (macOS), le premier présent de `/usr/bin/google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser` (Linux), `chrome.exe` sous `Program Files` ou `LOCALAPPDATA` (Windows). |
| `METAL_RENDER_ANGLE` | Moteur ANGLE quand l'option `angle` (ou `--angle`) n'est pas donnée : `metal`, `vulkan`, `d3d11`, `swiftshader`, `gl`… ; `none` omet les drapeaux GPU. Vide ou absente : le défaut de la plateforme. |

| Plateforme | Moteur par défaut | Drapeaux donnés à Chrome |
|---|---|---|
| macOS | `metal` | `--use-angle=metal` |
| Linux | aucun : SwiftShader, rendu logiciel et déterministe | aucun ; avec un moteur : `--use-gl=angle --use-angle=<moteur>` |
| Windows | `d3d11` | `--use-angle=d3d11` |

Sous Linux, `--use-angle=vulkan` seul suffit (mesuré au lot 00) ;
`--use-gl=angle` l'accompagne, comme le demande la consigne du lot, et ne
change rien. Les drapeaux `--use-gl` et `--use-angle` ne passent jamais par
`extraArgs` ou `--chrome-arg` : le lanceur les fixe. Le résumé de l'auto-contrôle
dit d'où vient le moteur (`--angle`, `METAL_RENDER_ANGLE` ou défaut de la
plateforme) et l'architecture du navigateur lue par `navigator.userAgentData` :
l'agent utilisateur réduit de Chrome annonce `x86_64` sous tout Linux, y
compris l'arm64 du Spark.

Chaînes vérifiées (preuves : `docs/chantier-moteur/preuves/lot-00/r1b/`) :

| Machine | Chrome | Moteur | `UNMASKED_RENDERER_WEBGL` | Extensions WebGL2 | Requête de temps GPU |
|---|---|---|---|---|---|
| Mac M5 | 157.0.8103.39 | `metal` (défaut) | ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version) | 36 | présente, valeurs cumulées (RGPU-11) |
| Spark (arm64) | 151.0.7922.137 | aucun (défaut) | ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver) | 29 | absente |
| Spark (arm64) | 151.0.7922.137 | `vulkan` | ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA NVIDIA GB10 (0x00002E12)), NVIDIA) | 32 | présente |

Les empreintes de pixels dépendent de la chaîne (GPU, pilote, version de
Chrome) : `--compare` ne compare que deux rendus d'une même chaîne. La scène
`canvas2d` (rastérisation logicielle de Skia) donne la même empreinte sur les
trois.

## Recette pour le Spark

Copier les outils sous `~/metal-tests/<nom>/` (seul endroit où écrire), Node
par nvm, un seul Chrome à la fois par agent, aucun service ni port :

```sh
ssh spark 'mkdir -p ~/metal-tests/<nom>/tools/render'
rsync -a --delete tools/render/ spark:metal-tests/<nom>/tools/render/
ssh spark 'cd ~/metal-tests/<nom> && export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh >/dev/null && nvm use 24 >/dev/null \
  && node tools/render/self-check.mjs --out $HOME/metal-tests/<nom>/sc-swiftshader.json \
  && METAL_RENDER_ANGLE=vulkan node tools/render/self-check.mjs --out $HOME/metal-tests/<nom>/sc-nvidia.json'
```

Sans moteur, le rendu passe par SwiftShader (logiciel, déterministe, sans
requête de temps GPU) : la bonne chaîne pour des empreintes d'image. Avec
`METAL_RENDER_ANGLE=vulkan` (ou `--angle vulkan`), il passe par la carte
NVIDIA GB10 : la chaîne pour mesurer un GPU immédiat (RGPU-V1). Une page de
banc se copie à côté, et `run-page.mjs` s'y lance de la même façon. Sous
Linux, `TMPDIR` reçoit les profils jetables et le dossier d'instance de Chrome
(`com.google.Chrome.XXXXXX`) : un `TMPDIR` à soi sous `~/metal-tests/<nom>/`
permet de vérifier qu'il ne reste rien. Sous macOS, ce dossier va toujours
dans le dossier temporaire du système.

Ce `TMPDIR` doit rester court : le chemin
`TMPDIR/com.google.Chrome.XXXXXX/SingletonSocket` est celui d'un socket Unix,
107 caractères au plus. Au-delà, Chrome s'arrête dès le lancement (« Socket path
too long », SIGABRT). `chrome.mjs` le vérifie avant de lancer Chrome
(`singletonSocketProblem`) et refuse avec le code `TMPDIR_TOO_LONG` ;
`run-page.mjs` sort alors avec le code 2. `check-run-page.mjs` donne à ses
lancements un `TMPDIR` court (`rp-XXXXXX`) à côté du sien.

## `run-page.mjs` : une page de banc

```sh
node tools/render/run-page.mjs <page>[?requête][#fragment] [options]     # --help : toutes les options
```

La page est un chemin (suivi au besoin de `?requête` et de `#fragment`, comme
`cielv.html#shots,aube`) ou une URL `file://` ; toute autre URL est refusée.
Profil jetable, nettoyage garanti, drapeaux et chaîne GPU de `chrome.mjs`.

- **Mode `dump`** (défaut), pour les pages de l'audit qui écrivent leur
  résultat dans un `<pre>` avant la fin du chargement : `chrome --dump-dom` ;
  `--budget MS` donne un temps virtuel (`--virtual-time-budget`) aux pages
  qui finissent par des minuteries.
- **Mode `cdp`**, pour attendre, appeler la page ou lire des images : `--wait
  EXPR` (sondée toutes les 100 ms dans le délai ; une exception compte comme
  « pas encore »), `--result EXPR` (valeur JSON de l'expression), `--call
  EXPR` avec `--arg JSON` ou `--arg-file FICHIER` (c'est ainsi qu'une page
  reçoit ses données, jamais par `fetch()` en `file://`), `--image
  ID=EXPR` (pixels RGBA par `readPixels` ou `getImageData`, SHA-256 de haut
  en bas comme `self-check.mjs`, PNG dans `--png-dir`), `--console`.
- **Résultat** : `--marker ID` (défaut : le premier présent de `rgpu-out`,
  `vout`, `out` ; le dernier `<pre>` de cet identifiant, comme `extract.py`),
  enveloppe `@@JSON@@…@@END@@` retirée, JSON exigé sauf `--text`. `--png-dir
  DIR` écrit les captures `data:image/…;base64` de la clé `shots` (comme
  `bancs/ciel/extract.py`) et les retire du JSON ; `--out FICHIER` (sinon la
  sortie standard) ; `--meta FICHIER` : compte rendu (Chrome, drapeaux, durée,
  marqueur, SHA-256 du résultat et des captures, nettoyage).
- **Page et Chrome** : `--query CLÉ=VALEUR`, `--hash FRAGMENT`, `--window
  LxH`, `--dpr N`, `--timeout MS` (défaut 270 000, celui des `run.sh`),
  `--chrome-path`, `--angle`, `--chrome-arg FLAG`.
- **Codes de sortie** : 0, la page a rendu son résultat ; 1, rien de rendu
  (marqueur absent ou vide, JSON invalide, `--wait` non satisfait, délai,
  échec de Chrome) ; 2, erreur d'usage, drapeau refusé
  (`--allow-file-access-from-files`, `--remote-debugging-port`…) ou page
  autre que `file://`. Un tableau `errors` non vide dans le résultat est
  signalé sur la sortie d'erreur sans changer le code.

### Remplacement des lanceurs de l'audit

Les `run.sh` de `bancs/` lançaient Chrome avec `--allow-file-access-from-files`
et un profil dans le dossier du banc, et le chemin de Chrome du Mac en dur.
Aucune de leurs pages n'a besoin de l'accès aux fichiers : toutes ont tourné
sans lui au lot 00. Équivalents (même fenêtre, même délai) :

| Lanceur de l'audit | Commande |
|---|---|
| `rgpu/run.sh page [L,H] [dpr] [budget]` + `extract.py` | `run-page.mjs page --window L,H --dpr N [--budget MS]` |
| `rcpu-verif/run.sh page [L,H]`, `draw/run.sh`, `draw-verif/run.sh` | `run-page.mjs page --window L,H [--dpr N]` |
| `draw/runfresh.sh page profil` (cache de shaders froid) | `run-page.mjs page --window 1280,800 --dpr 2 --timeout 120000` : chaque lancement a un profil neuf |
| `rgpu-verif/run.sh`, `rgpu-verif2/run.sh`, `natif/run.sh` (`vout`) | `run-page.mjs page --window 1440,1000 --dpr 2 --marker vout` (`natif` : `--window 1440,932 --dpr 1`) |
| `stab/run-chrome.sh page profil` | `run-page.mjs page --window 1440,932 --dpr 2 --marker out --timeout 120000` |
| `tact/gpu/run.sh page LxH` | `run-page.mjs page --window 390,844` |
| `ciel/run.sh page dossier [json] [L,H] [dpr]` (`BUDGET`, 20 s) + `extract.py` | `run-page.mjs page --window 1600,900 --budget 20000 --png-dir dossier --out json` |
| `ciel/run2.sh`, `ciel-verif/run2.sh 'page#mode,args' dossier [json]` | `run-page.mjs 'page#mode,args' --window 1600,900 --png-dir dossier --out json` |
| `para/chrome/run.sh page [attente]` (tube nommé `gate.js`) | `run-page.mjs page --mode cdp --wait "document.getElementById('out').textContent.startsWith('{')" --timeout 150000` : la page écrit `pending` puis son JSON ; sans le tube, `gate.js` manque et le chargement se termine aussitôt |

Mesuré au lot 00 (preuves `r1b/pages-heritees*.json`) sur `t6-run1.html`
(banc RCPU-V3), `runJ.html` (banc RGPU) et `cielv.html#shots` :
`run-page.mjs` lance Chrome avec la ligne de commande du prototype `dump-run`
(identique à l'octet, profil jetable mis à part) et lit le même texte dans le
même DOM. `cielv.html#shots` rend les mêmes champs et les 18 mêmes captures
(SHA-256). Les deux pages RGPU, elles, ne sont pas reproductibles d'un
lancement à l'autre, quel que soit le lanceur : le jeu date une pression de tir
à l'horloge réelle (`firePressAt = performance.now()`) et l'expire contre
l'horloge synthétique à 60 Hz du pilote RGPU POST (`expireFireIntents(now)`),
si bien que la partie suit la vitesse réelle des images (instances,
triangles, PSNR des variantes approchées, score). D'un lancement à l'autre
restent égaux le nombre d'images (350 et 190), les images à éclair (77 et 49),
les erreurs et le PSNR 99 des variantes exactes. Sur une copie dont
`performance.now()` avance d'1 µs par appel (option `--horloge-fixe` du banc),
tous les champs sont égaux, entre lancements et entre lanceurs (286 sur 286,
2 538 sur 2 538). Comparer deux versions du moteur sur ces pages demande donc
cette horloge ou plusieurs lancements ; T6 prévoit une trace enregistrée.

Deux pages citées par les fiches n'existent pas encore : le mode `#gate` de
`cielv.html` (le miroir n'a que `#shots` et `#bench`), à écrire au lot 16 ; la
page de `natif/gen.mjs`, qui lit `rgpu/out/scene-w0.json`, absent du miroir.

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
| `chromePath` | `CHROME_PATH`, sinon le Chrome de la plateforme | Exécutable. |
| `angle` | `METAL_RENDER_ANGLE`, sinon `metal` sur macOS, `d3d11` sur Windows, rien ailleurs | `--use-angle=…` (sous Linux précédé de `--use-gl=angle`) ; `null` ou `'none'` omet les drapeaux. |
| `window` | `[800, 600]` | Fenêtre et fenêtre d'affichage en pixels CSS (`[l, h]`, `'lxh'` ou `{width, height}`). |
| `dpr` | `1` | `devicePixelRatio` (`--force-device-scale-factor` et émulation par page). |
| `timeoutMs` | `60000` | Délai par commande ; s'il est dépassé, Chrome est tué et le profil supprimé avant le rejet. |
| `launchTimeoutMs`, `closeTimeoutMs` | `30000`, `5000` | Démarrage ; fermeture propre avant destruction forcée. |
| `extraArgs` | `[]` | Drapeaux en plus. Refusés : port ou adresse de débogage, accès aux fichiers, sécurité web, proxy, et les drapeaux que le lanceur gère lui-même (dont `--use-gl` et `--use-angle`). |
| `tmpRoot` | `os.tmpdir()` | Dossier des profils jetables `metal-render-<pid>-XXXXXX`. |
| `onConsole` | aucun | Rappel `({type, text, url})` pour chaque `console.*` des pages. |

`browser` :

- `openPage(fichier, {query, hash, window, dpr, timeoutMs})` ouvre une page
  `file://` (chemin, au besoin suivi de `?requête` et `#fragment`, URL
  `file:` ou `about:blank` ; toute autre URL est refusée) dans un nouvel
  onglet, règle la fenêtre d'affichage par
  `Emulation.setDeviceMetricsOverride` (en mode sans tête, `--window-size`
  seul donne une hauteur utile plus petite), attend l'événement `load` et
  rend une `page`. `query` s'ajoute à la requête, `hash` remplace le fragment.
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
les cas. `dumpDom(fichier, {query, hash, virtualTimeBudgetMs, …})` sert les
pages héritées qui écrivent leur résultat dans le DOM : `chrome --dump-dom`,
mêmes drapeaux, même profil jetable, même nettoyage ; `dumpDomDetails()` rend
en plus l'URL, les drapeaux, la durée et le compte rendu de fermeture.
`pageUrl(cible, query, hash)` construit l'URL d'une page ; `gpuFlags(moteur,
plateforme)`, `defaultAngle(plateforme, env)`, `chromeArgRefusal(drapeau)`
(`{code, reason}` ou `null`) et `chromeVersion(chemin)` exposent les choix du
lanceur. `processTree(pid)`, `internetSockets(pids)` (`lsof -n -P -a -p … -i`)
et `commandLine(pid)` servent aux contrôles. `sweepStaleProfiles()` supprime
les profils laissés par un processus Node disparu ; `launch()` l'appelle.

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
  L'objet rendu porte son `origin`, que `run-page.mjs --image` lit.
- `timeBlocks(paramètres, {warmup, blocks, frames})` : temps par image de
  `scene3d` mesuré par blocs, une seule synchronisation `readPixels` 1×1 par
  bloc, après une chauffe.
- `decodePng(base64)` et `encodePngWithChrome()` : le décodeur et l'encodeur
  PNG de Chrome, pour contrôler `png.mjs` contre une autre implémentation.

`?dump=1` écrit le résultat de deux rendus dans `<pre id="out">` pour
`dumpDom`.

## Règles pour les bancs des lots suivants (05, 06, 15, 16, 18)

- **Aucun port, aucun serveur.** `--remote-debugging-pipe`, ou `dumpDom` pour
  une page héritée. `--remote-debugging-port` et
  `--allow-file-access-from-files` (que les `run.sh` de l'audit utilisaient)
  sont refusés. `--host-resolver-rules="MAP * ~NOTFOUND"` reste en place.
- **Données d'entrée** : les inclure dans la page générée, ou les passer par
  `page.call()` (`run-page.mjs --call … --arg …`). Jamais de `fetch()` en
  `file://`.
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
  version de Chrome. Comparer des rendus faits sur la même chaîne. Pour des
  empreintes portables entre machines Linux, SwiftShader ; pour un GPU
  immédiat, le Spark avec `METAL_RENDER_ANGLE=vulkan`.

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

Un Chrome qui se ferme normalement supprime son dossier d'instance
(`com.google.Chrome.XXXXXX`, où vit sa prise `SingletonSocket`, hors du
profil) ; un Chrome tué (délai, signal, plantage) le laisse : quatre par
auto-contrôle avant R1b. Le lanceur le retrouve par le lien `SingletonSocket`
du profil et le supprime avec lui, seulement s'il ne contient que des entrées
`Singleton*`.

## Vérifié et à vérifier

Vérifié sur le Mac M5 (Chrome 157.0.8103.39, Node 24.18) : rendu WebGL2 par
ANGLE Metal sur le vrai GPU, mêmes pixels entre deux rendus, deux lancements
et deux processus, mêmes pixels par le tube et par `--dump-dom`, octets bruts
de la scène `legacy` identiques à ceux du prototype (`1eb2798a…`), aucun
socket Internet dans les processus de Chrome, pas de `performance.now` de
0,1 ms, `EXT_disjoint_timer_query_webgl2`, `KHR_parallel_shader_compile` et
`OfflineAudioContext` présents ; `check-run-page.mjs` 64 sur 64, et
`run-page.mjs` équivalent au prototype `dump-run` sur les trois pages de
l'audit ci-dessus.

Vérifié sur le Spark (Linux arm64, Chrome 151.0.7922.137, Node 24 par nvm) :
les mêmes contrôles, sauf la comparaison aux octets du prototype du Mac, en
SwiftShader et sur la carte NVIDIA GB10 par Vulkan ; mêmes empreintes entre
deux processus sur chaque chaîne, `METAL_RENDER_ANGLE=vulkan` et `--angle
vulkan` équivalents ; aucun socket Internet ; ni profil ni dossier d'instance
restant ; `check-run-page.mjs` 64 sur 64 sur les deux chaînes. Limite du
`TMPDIR` mesurée : 66 caractères passent, 67 font avorter Chrome (« Socket path
too long »).

À vérifier sur david-pc (Windows, carte NVIDIA), rien n'y a tourné : le tube
sur les descripteurs 3 et 4 (pris en charge par Chrome sous Windows, non
essayé), `--use-angle=d3d11`, le chemin de Chrome, la destruction des
processus (pas de groupe de processus sous Windows : seul le processus
navigateur est tué, les autres se ferment avec le tube), l'absence de `lsof`
(le contrôle de sockets y est sans objet) et `run-page.mjs`.
Sous ANGLE Metal, `EXT_disjoint_timer_query_webgl2` est présent mais rend des
valeurs cumulées (RGPU-11) : ne pas s'en servir sur ce Mac.
