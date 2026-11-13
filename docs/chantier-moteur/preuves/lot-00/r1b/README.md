# Preuves du lot 00 / R1b — Linux (Spark), `METAL_RENDER_ANGLE`, `run-page.mjs`

Constats : RCPU-V3 (banc Chrome à variantes), RGPU-11 (temps GPU : chaîne
NVIDIA du Spark), PARA-13 point 5 (essais asynchrones dans Chrome sans
interface). Suite de R1 : les outils de [`tools/render`](../../../../../tools/render/README.md)
tournent aussi sous Linux sur le Spark, choisissent leur moteur ANGLE par
`METAL_RENDER_ANGLE`, et `run-page.mjs` remplace les `run.sh`, `run2.sh` et
`chrome/run.sh` de l'audit, liés au Mac et à `--allow-file-access-from-files`.

Classe de preuve : état identique (outillage). `src/`, `dist/index.html` et
`SIZE.json` sont inchangés (812 696 octets, SHA-256 `4587dc49…`).

Machines :

- Mac M5, Darwin 27.2.0, Node 24.18.0, Chrome 157.0.8103.39, « ANGLE (Apple,
  ANGLE Metal Renderer: Apple M5, Unspecified Version) ». Machine partagée
  avec d'autres agents (charge 3 à 5).
- Spark (GB10), Linux 6.17.0-1026-nvidia aarch64, Node 24.18.0 par nvm,
  Chrome 151.0.7922.137. Tout sous `~/metal-tests/lot00-r1b/`, un `TMPDIR`
  par exécution, un seul Chrome à la fois, aucun service ni port.

« Avant » : `tools/render` de 3ca8016 (R1), dans un worktree détaché. « Après »
: l'arbre de travail de `chantier/lot-00-outils`.

## Fichiers

| Fichier | Contenu |
|---|---|
| `empreintes-mac-metal.json`, `empreintes-spark-swiftshader.json`, `empreintes-spark-nvidia.json` | Par chaîne GPU : Chrome, drapeaux et leur origine, ligne de commande réelle, renderer, extensions, empreintes des cinq scènes, rapports qui les donnent, comparaison au plan et aux rapports du chef de lot, empreintes de la sonde lues par `run-page.mjs`. |
| `avant-apres.json` | Avant/après : chemin nu suivi d'un fragment, `METAL_RENDER_ANGLE`, `--angle vulkan`, dossiers d'instance restants (Spark et Mac). |
| `pages-heritees.mjs` | Banc : pages de l'audit par le prototype `dump-run` du chef (R1 `dumpDom`) et par `run-page.mjs`, alternés A B B A A B. |
| `pages-heritees.json` | Ce banc, horloge réelle : `t6-run1.html`, `runJ.html`, `cielv.html#shots`. |
| `pages-heritees-horloge-fixe.json` | Ce banc sur des copies des deux pages RGPU à horloge déterministe (`--horloge-fixe`). |
| `refus.json` | Drapeaux et URL refusés par `run-page.mjs` : code 2 et message. |
| `reseau-spark.json` | Sockets Internet des processus de Chrome échantillonnés toutes les 0,1 s sur le Spark. |
| `spark-r1b.sh`, `spark-lsof.sh` | Les scripts lancés sur le Spark. |
| `resumes-spark.txt` | Résumés (sortie d'erreur) de chaque exécution du Spark. |
| `rapports/*.json.gz` | Rapports complets de `self-check.mjs` et `check-run-page.mjs` (chemins du Spark abrégés en `~`). |

## Avant / après

| | Avant (R1) | Après (R1b) |
|---|---|---|
| `cielv.html#shots` (chemin nu, fragment) | « Page not found » | `file:///…/cielv.html#shots` |
| `METAL_RENDER_ANGLE=vulkan` (Spark) | ignorée : aucun drapeau, SwiftShader | `--use-gl=angle --use-angle=vulkan`, NVIDIA GB10, origine affichée |
| `--angle vulkan` (Spark) | `--use-angle=vulkan` | `--use-gl=angle --use-angle=vulkan`, mêmes empreintes |
| Dossiers `com.google.Chrome.*` laissés par un auto-contrôle | 4 (Spark, trois fois ; Mac, une fois) | 0 (Spark, six fois ; Mac, une fois) |
| Lanceur de page de banc | `run.sh` de l'audit (chemin de Chrome du Mac, `--allow-file-access-from-files`) | `run-page.mjs`, modes `dump` et `cdp` |
| Résumé de l'auto-contrôle | « ANGLE par défaut » | moteur, origine, drapeaux GPU, architecture du navigateur |
| Auto-contrôle sur le Mac | 56 contrôles, 57 avec `--compare` | 56 et 57, mêmes empreintes que R1 |

Les dossiers d'instance sont ceux que Chrome tué (délai, signal) laisse hors
du profil : sous Linux dans `TMPDIR`, sous macOS dans le dossier temporaire du
système (293 y sont, d'autres agents ; seuls les nouveaux sont comptés).

## Empreintes par chaîne GPU

SHA-256 des pixels RGBA, de haut en bas (`--compare` ne compare qu'une même
chaîne) :

| Scène | Mac, ANGLE Metal | Spark, SwiftShader | Spark, NVIDIA GB10 (Vulkan) |
|---|---|---|---|
| `legacy-1.5` | `2cbf4fa0…` | `20fdd26c…` | `4b96d86d…` |
| `legacy-2.5` | `7c0df53b…` | `e0177203…` | `b1dafbda…` |
| `scene3d` | `0e200bdb…` | `b4113c2b…` | `00084653750566bf…` |
| `scene3d-wide` | `c5209079…` | `c7afc56b…` | `905e9ef3…` |
| `canvas2d` | `251dcba2…` | `251dcba2…` | `251dcba2…` |
| Drapeaux GPU | `--use-angle=metal` | aucun | `--use-gl=angle --use-angle=vulkan` |
| Extensions WebGL2, requête de temps GPU | 36, présente (cumulée, RGPU-11) | 29, absente | 32, présente |
| Contrôles | 57/57 (`--compare` R1, 0 différence) | 55/55, 56/56, 55/55 | 55/55, 56/56 ×4 |

Sur le Spark, chaque chaîne a tourné deux fois de suite (la seconde avec
`--compare` sur la première), puis une troisième sous échantillonnage des
sockets ; `METAL_RENDER_ANGLE=vulkan` et `--angle vulkan` donnent les mêmes
empreintes. Toutes égalent celles attendues par le plan et celles des
rapports du chef de lot (`~/metal-tests/lot00-chef/sc-swiftshader.json`,
`sc-vulkan-a.json`). Le Chrome 151 du Spark choisissait déjà la carte NVIDIA
avec `--use-angle=vulkan` seul : `--use-gl=angle`, ajouté comme le demande la
fiche, ne change aucune empreinte. Un auto-contrôle dure 6 s en SwiftShader,
9 s sur la carte NVIDIA, 5 s sur le Mac.

## `run-page.mjs`

**Contrôles.** `check-run-page.mjs --self-check <rapport de la même chaîne>` :
64/64 sur le Mac (14 s), sur le Spark en SwiftShader (14 s) et sur la carte
NVIDIA (21 s) ; 22/22 sans navigateur (`--no-chrome`). Ils lancent
`run-page.mjs` comme commande une vingtaine de fois : modes `dump` et `cdp`,
marqueurs `out`, `vout`, `rgpu-out`, enveloppe `@@JSON@@…@@END@@`, captures
`shots` écrites en PNG (mêmes pixels par `dump` et par `cdp`), `--call` et
`--arg`, `--wait`, `--result`, `--image`, codes de sortie, délai dépassé
(Chrome tué, dossier d'instance supprimé), nettoyage de chaque lancement. Les
images de `pages/probe.html` lues par `run-page.mjs --mode cdp --wait …
--result …` portent les empreintes de `self-check.mjs` sur les trois chaînes.

**Refus** (`refus.json`) : `--allow-file-access-from-files` (option directe ou
`--chrome-arg`), `--remote-debugging-port`, `--remote-debugging-address`,
`--use-gl`, `--user-data-dir`, toute URL `http(s)://` et une page absente
sortent avec le code 2 et un message en français, sans lancer Chrome.

**Pages de l'audit** (`pages-heritees.json`, `pages-heritees-horloge-fixe.json`).
`t6-run1.html` (banc RCPU-V3), `runJ.html` (banc RGPU) et `cielv.html#shots`,
chacune six fois, A B B A A B, par le prototype `dump-run` du chef (le
`dumpDom` de R1 sur une URL `file://`, puis le dernier `<pre id="rgpu-out">`,
sinon `<pre id="out">`) et par `run-page.mjs` en mode `dump`, la page donnée
en chemin nu suivi de son fragment (ce que R1 refusait) :

- la ligne de commande de Chrome est identique (celle de R1, reconstruite par
  le module de R1, contre celle que `run-page.mjs` a donnée), l'URL aussi ; le
  lecteur de `run-page.mjs` tire du DOM lu par le prototype le même texte, à
  l'octet ;
- `cielv.html#shots` : 42 champs sur 42 égaux dans les six exécutions, et les
  18 captures aux mêmes SHA-256 (fichier et pixels) ;
- `t6-run1.html` et `runJ.html` ne sont pas reproductibles d'un lancement à
  l'autre, même par le prototype seul : 71 champs sur 286 et 1 474 sur 2 538
  varient entre ses trois lancements (instances de `base` de 4 567 à 4 582
  pour t6, PSNR de `cache` de 65,1 à 68,6 dB, score final 0 ou 100 pour runJ).
  Cause : le jeu date la pression de tir à l'horloge réelle (`firePressAt =
  performance.now()`) et l'expire contre l'horloge synthétique à 60 Hz du
  pilote RGPU POST (`expireFireIntents(now)`) ; la partie suit la vitesse
  réelle des images. Les 120 champs de runJ constants sous le prototype mais
  pas sous `run-page.mjs` (valeurs par image `dyn` et `u`) appartiennent tous
  à des familles qui varient sous le prototype seul. Égaux dans les six
  exécutions : 350 et 190 images mesurées, 77 et 49 images à éclair, aucune
  erreur, santé finale 93, 58 appels de dessin par variante de t6, PSNR 99 et
  MAD 0 des quatre variantes exactes de t6 ;
- sur des copies des deux pages dont `performance.now()` avance d'1 µs par
  appel (script inséré avant tout autre, `--horloge-fixe`), la partie ne
  dépend plus du temps : 286 champs sur 286 et 2 538 sur 2 538 égaux dans les
  quatre exécutions (A B B A), entre les deux lancements du prototype comme
  entre les deux lanceurs. PSNR de `cache` à horloge fixe : 65,04 dB (fiche
  T6 : « ≈ 64,5 dB »).

Les durées (44 à 47 s par page RGPU, 10 à 35 s pour `cielv.html`, Mac partagé
avec un autre agent qui lançait Chrome) ne sont pas comparées. Pour T6 : le
banc d'origine ne compare deux versions qu'à horloge fixe ou sur plusieurs
lancements ; la trace enregistrée que prévoit la fiche lève le problème.

**Réseau.** Sur le Spark, `spark-lsof.sh` a relevé toutes les 0,1 s les
processus de Chrome (navigateur à profil `metal-render-` et membres de son
groupe de processus) et leurs sockets Internet (`lsof -nP -a -i`) pendant
quatre exécutions (deux auto-contrôles, deux `check-run-page.mjs` ; 115
échantillons, de 114 à 312 processus distincts par exécution) : aucune
ligne. Le contrôle de sockets
de l'auto-contrôle (fin de chaque lancement) ne trouve rien non plus.

**Limite du `TMPDIR` sous Linux.** Chrome place sa prise d'instance unique
dans `TMPDIR/com.google.Chrome.XXXXXX/SingletonSocket`, 107 caractères au plus
(socket Unix). Mesuré sur le Spark : un `TMPDIR` de 66 caractères passe, un de
67 fait avorter Chrome au lancement (« Socket path too long », code 134). Les
premiers `check-run-page.mjs` du Spark (47/61 et 46/61) en étaient là, leurs
lancements emboîtant les dossiers temporaires. `chrome.mjs` refuse désormais
un tel `TMPDIR` avant de lancer Chrome (`TMPDIR_TOO_LONG`, code 2 de
`run-page.mjs`), et `check-run-page.mjs` prend un `TMPDIR` court.

## Rejouer

```sh
# Mac
node tools/render/self-check.mjs --compare docs/chantier-moteur/preuves/lot-00/r1/self-check-a.json --out /tmp/sc.json
node tools/render/check-run-page.mjs --self-check /tmp/sc.json
# Spark : outils copiés sous ~/metal-tests/lot00-r1b/apres/tools/render, R1 sous avant/
bash spark-r1b.sh all
bash spark-lsof.sh lsof-ss -- tools/render/self-check.mjs
# Pages de l'audit (copies dans un dossier ; avant = worktree de 3ca8016)
node docs/chantier-moteur/preuves/lot-00/r1b/pages-heritees.mjs <avant> <pages> pages-heritees.json --rounds 3
node docs/chantier-moteur/preuves/lot-00/r1b/pages-heritees.mjs <avant> <pages> pages-heritees-horloge-fixe.json --rounds 2 --horloge-fixe
```

Les pages : `t6-run1.html` (`bancs/rcpu-verif/chrome-gen.mjs`, configuration
`rcpu-verif2/cfg1.json`, SHA-256 `f147962f…`), `runJ.html` (`bancs/rgpu/gen.mjs`,
`rgpu/cfg/runJ.json`, `fab74d6b…`), `cielv.html` (copie de
`bancs/ciel-verif/cielv.html`, `bc9d7e52…`) ; les captures de `cielv.html`
(1,8 Mo chacune) ne sont gardées que par leur SHA-256.

## Limites et vrai matériel

- david-pc (Windows, NVIDIA, `--use-angle=d3d11`) : rien n'y a tourné. Tube
  sur les descripteurs 3 et 4, chemin de Chrome, processus sans groupe,
  absence de `lsof`, et `run-page.mjs` restent à vérifier.
- Le Mac n'a qu'une chaîne (ANGLE Metal) ; `prototype.legacyIdentical` reste
  propre au Mac (octets bruts mesurés sur cette seule chaîne).
- Pages de l'audit encore absentes : le mode `#gate` de `cielv.html` (lot 16)
  et la page de `natif/gen.mjs` (`rgpu/out/scene-w0.json` manque au miroir).
- Les pages `para/` écrivent `pending` puis leur JSON : `--mode cdp --wait`,
  pas `dump`.
