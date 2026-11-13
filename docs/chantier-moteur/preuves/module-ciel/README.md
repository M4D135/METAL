# Module ciel (FSky) — preuves : 18 captures, planche, contrôle et mesures

Preuves des étapes 6 et 7 du lot « Module ciel » (constats CIEL-10, CIEL-05 et CIEL-V3 ; décision de David du MASTER-PROMPT, §6 bis, point 6 : 18 ciels distincts, un par monde).

- **Code mesuré** : commit `587f30e` de la branche `chantier/module-ciel` : `src/skies.js` (23 094 octets), `tools/ciel/apercu.html` et `tools/ciel/rendu.mjs`.
- **Classe de preuve : état identique pour le jeu.** Ce dossier ne contient que des fichiers neufs. Aucun fichier existant n'est modifié, et le module n'est pas branché : `src/skies.js` ne figure pas dans `tools/build.py`. `dist/index.html` et `SIZE.json` ne changent pas.
- **Mesures** : sur Apple M5, moteur principal de `rendu.json`, et sur NVIDIA GB10, rangé sous `autres`. Le contrôle miroir a aussi tourné en rendu logiciel (SwiftShader).

## Fichiers

| fichier | contenu | octets |
|---|---|---:|
| `README.md` | ce document | — |
| `rendu.json` | sortie de `tools/ciel/rendu.mjs` : moteur principal (M5) avec `verif`, `captures` et `banc` ; les autres moteurs sous `autres` (GB10 : `verif` et `banc` ; SwiftShader : `verif`) | 15 166 |
| `planche.png` | 1920×540 : 18 vignettes de 320×180 ; colonne = chapitre (`floor(i/3)`), ligne = biome (`i % 3`), étiquette « NN id » | 854 372 |
| `monde-00-lisiere-aube.png` | monde 0, 800×450 | 261 447 |
| `monde-01-carriere-aube-poussiere.png` | monde 1 | 254 044 |
| `monde-02-jardins-matin.png` | monde 2 | 269 294 |
| `monde-03-lisiere-plein-jour.png` | monde 3 | 275 715 |
| `monde-04-carriere-midi-voile.png` | monde 4 | 251 871 |
| `monde-05-jardins-ciel-pur.png` | monde 5 | 247 093 |
| `monde-06-lisiere-orage-sec.png` | monde 6 | 268 965 |
| `monde-07-carriere-vent-de-sable.png` | monde 7 | 252 877 |
| `monde-08-jardins-apres-midi.png` | monde 8 | 255 654 |
| `monde-09-lisiere-couvert.png` | monde 9 | 260 828 |
| `monde-10-carriere-cendres.png` | monde 10 | 256 661 |
| `monde-11-jardins-brume.png` | monde 11 | 252 880 |
| `monde-12-lisiere-couchant.png` | monde 12 | 260 957 |
| `monde-13-carriere-fournaise.png` | monde 13 | 262 101 |
| `monde-14-jardins-crepuscule-mauve.png` | monde 14 | 252 979 |
| `monde-15-lisiere-nuit-de-lune.png` | monde 15 | 252 921 |
| `monde-16-carriere-nuit-de-braises.png` | monde 16 | 251 471 |
| `monde-17-jardins-dernier-signal.png` | monde 17 | 252 944 |

Les 19 images totalisent 5 495 074 octets, sous la limite de 15 Mo. Chacune dépasse 50 000 octets. Les PNG ne sont pas compressés en `.gz`, puisqu'ils le sont déjà ; `rendu.json` reste sous 200 ko.

## Matériel, logiciels, drapeaux et moteurs de rendu

| machine | système | Chrome | drapeaux GPU | moteur de rendu (`UNMASKED_RENDERER_WEBGL`) | usage |
|---|---|---|---|---|---|
| MacBook Air, Apple M5 (Mac17,4 ; 10 cœurs, dont 4 de performance et 6 d'efficacité ; sans ventilateur) | macOS 27.2.1, Node 24.18.0 | 157.0.8103.39 | `--use-angle=metal` | `ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)` ; WebGL 2.0 (OpenGL ES 3.0 Chromium) ; `MAX_FRAGMENT_UNIFORM_VECTORS` 1024 | moteur principal : contrôle, captures, bancs |
| Spark, NVIDIA GB10 (pilote 580.173.02) | Ubuntu 24.04, Linux 6.17 aarch64, 20 cœurs, Node 24.18.0 | 151.0.7922.137 | `--enable-gpu --ignore-gpu-blocklist --use-angle=vulkan --enable-features=Vulkan` | `ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA NVIDIA GB10 (0x00002E12)), NVIDIA)` ; `MAX_FRAGMENT_UNIFORM_VECTORS` 4096 | contrôle et bancs (`autres`) |
| Spark, rendu logiciel | idem | 151.0.7922.137 | `--use-angle=swiftshader --enable-unsafe-swiftshader` | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)` | contrôle seulement |

**Sondes.** Sur le Mac, le premier jeu de drapeaux essayé (ANGLE Metal) donne WebGL2 sur le GPU. Sur le Spark, c'est le premier jeu de l'annexe F, Vulkan.

**Drapeaux communs** (annexe F de la fiche) :

```
--headless=new --no-first-run --no-default-browser-check --disable-background-networking
--disable-component-update --disable-sync --disable-extensions --disable-breakpad
--disable-crash-reporter --hide-scrollbars --force-device-scale-factor=1
```

- Sur le Mac s'y ajoute `--use-mock-keychain` : le trousseau factice évite une attente d'environ 11 s à chaque lancement.
- `--window-size` prend la taille du canvas.
- Chaque lancement a un profil neuf, supprimé ensuite : `--user-data-dir`, `HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` et `TMPDIR` pointent sous le dossier de travail, hors du dépôt.
- Sorties : `--dump-dom` pour le JSON de la page ; `--screenshot` en plus pour les captures.
- Le bac à sable reste actif : `sansBacASable` vaut `false` partout.
- Pages ouvertes en `file://`, sans serveur ni port.

## Commandes exactes

Depuis la racine du dépôt. `<travail>` est un dossier temporaire hors du dépôt.

**Mac :**

```
node tools/ciel/rendu.mjs --travail <travail> --sonde
node tools/ciel/rendu.mjs --travail <travail> --banc --res 2560x1440
node tools/ciel/rendu.mjs --travail <travail> --banc --res 1792x1008
node tools/ciel/rendu.mjs --travail <travail> --banc --res 2560x1440 --leviers
node tools/ciel/rendu.mjs --table
node tools/ciel/rendu.mjs --travail <travail> --verif
node tools/ciel/rendu.mjs --travail <travail> --captures --taille 800x450
wc -c src/skies.js docs/chantier-moteur/preuves/module-ciel/*.png
```

**Spark**, dans une copie du dépôt (sans `.git`) qui contient le `rendu.json` du Mac. Le GPU est à 0 % avant chaque lancement (`nvidia-smi`), avec un seul Chrome à la fois :

```
node tools/ciel/rendu.mjs --travail <travail> --sonde
node tools/ciel/rendu.mjs --travail <travail> --banc --res 2560x1440 --passes 30
node tools/ciel/rendu.mjs --travail <travail> --banc --res 1792x1008 --passes 30
node tools/ciel/rendu.mjs --travail <travail> --banc --res 2560x1440 --passes 30 --leviers
node tools/ciel/rendu.mjs --travail <travail> --verif
node tools/ciel/rendu.mjs --travail <travail> --gpu swiftshader --verif
```

**Pourquoi 30 passes sur le GB10.** L'horloge de la page avance par pas de 0,1 ms. Avec 6 passes, un échantillon de l'ancien ciel durerait environ 1 ms sur le GB10, ce qui est trop grossier. Avec 30, il dure environ 5 ms.

**Fusion des résultats.**

1. Le `rendu.json` du Spark a été rapporté sur le Mac. Le texte est identique à celui du Mac jusqu'à la clé `autres`, la seule ajoutée (vérifié avec `diff`).
2. Les trois bancs du Mac ont ensuite été refaits au repos (voir « Charge des machines »). Ils remplacent les sections `banc` du moteur principal.
3. `autres`, `verif` et `captures` restent identiques à la version rapportée du Spark (vérifié).

## Paramètres des captures

- **Mode** : `vue` d'`apercu.html`, canvas de 800×450, rendu par le M5.
- **Réglages** : fov 75°, vignette 0,76, tramage actif, t = 0, graine 0, couches `1111`, masque 0.
- **Caméra par défaut** : yaw = azimut de la source principale ; pitch = min(34°, max(6°, élévation de la source − 12°)).
- **Planche** : 1920×540, mêmes réglages en vignettes de 320×180.
- **Taille** : 800×450 au lieu des 960×540 de la fiche. Le chantier limite les preuves à quelques Mo par lot ; à 800×450, les 19 images font 5,5 Mo.
- **Reproductibilité** : une seconde série de captures, prise dans un dossier temporaire, est identique à l'octet près pour les 19 PNG.
- **Pas de captures sur le GB10.** Chrome sans tête n'y compose pas la surface WebGL dans `--screenshot`, et l'image sort unie (constaté à l'étape 5), alors que le contrôle `verif` y est juste.

## Contrôle miroir (`--verif`)

Pixels GPU (couches `0000`, sans tramage, vignette 1) comparés à `FSky.encode(FSky.radianceAt(…))`, tous les 16 pixels. Cela fait 8 640 points : 18 mondes × 2 caméras (pitch par défaut, puis −20°) × 240 points.

| moteur | maxDiff (limite 2) | écart moyen | tramage : écart max, part des niveaux modifiés | `FOG_GLSL` seul | masque du disque solaire | uniformes actifs | `gl.getError` |
|---|---:|---:|---|---|---|---|---:|
| Apple M5 (Metal) | **0** | 0 | 1 ; 0,3339 | maxDiff 0, 5 uniformes | `jardins-ciel-pur` : alpha de 0 à 255, 8 pixels, écart au disque de 0,03 px | 27, aucun inconnu | 0 |
| NVIDIA GB10 (Vulkan) | **1** | 0,0278 | 1 ; 0,3344 | maxDiff 0 | idem | 27, aucun inconnu | 0 |
| SwiftShader | **0** | 0 | 1 ; 0,3339 | maxDiff 0 | idem | 27, aucun inconnu | 0 |

Le contrôle réussit sur les trois moteurs. Sur le GB10, un niveau d'écart apparaît dans les 18 mondes et sous les 2 caméras, sur environ 3 % des valeurs (moyenne 0,028) : c'est sous la limite de 2. Le tramage (CIEL-05) change environ un tiers des niveaux, d'au plus 1.

## Préréglages et temps de `resolve` (`--table`, Node, Mac)

- **Distances minimales de signature** : 90 au total (`lisiere-aube`/`carriere-aube-poussiere`) et 78 en couleur. Les seuils sont 60 et 30.
- **`resolve`** (domaine principal de Node ; 3 appels de chauffe, puis médiane de 21) : 0,42 ms au plus (`lisiere-aube`) et 0,33 ms en moyenne.
  - Conditions : processeur inactif à 80 % ; même résultat sur quatre passages, à 0,004 ms près.
  - Sous une charge de 6,3 (processeur inactif à 50 %) : 0,88 et 0,72 ms.
  - Objectif 5 ms, limite 15 ms : tenus. Le §1.4 de la fiche annonçait 0,67 ms.

## Coût GPU (`--banc`, §6.1 de la fiche)

**Protocole.**

- Plein écran de ciel : fov 75°, pitch 40°. Le yaw suit la source principale ; il vaut 0 pour l'ancien ciel.
- Deux cibles RGBA8 utilisées en alternance. Un échantillon = `passes` tracés, puis `readPixels` 1×1.
- 3 tours de chauffe, puis 40 tours ; l'ordre des variantes tourne à chaque tour.
- Écart = échantillon de la variante − échantillon du remplissage uni du même tour, en ms par passe. On en donne la médiane et p10–p90.
- Rapport = médiane de la variante / médiane de l'ancien ciel.

**Variantes.**

- `ancien` : `SKY_FRAG` du jeu, environnement « woodland ».
- `fsky-jour` : préréglage 3.
- `fsky-couvert` : préréglage 9.
- `fsky-nuit` : préréglage 17.
- `fsky-atmo` : préréglage 3, couches `0000`.

### Apple M5 (valeurs de `rendu.json`)

2560×1440, 40 tours, 6 passes :

| variante | médiane (ms) | p10–p90 (ms) | rapport |
|---|---:|---:|---:|
| ancien | 0,950 | 0,933–1,067 | 1 |
| fsky-jour | 1,000 | 0,950–1,150 | 1,053 |
| fsky-couvert | 1,150 | 1,133–1,283 | 1,211 |
| fsky-nuit | 1,300 | 1,267–1,433 | 1,368 |
| fsky-atmo | 0,283 | 0,250–0,317 | 0,298 |

1792×1008 (environ 1,8 MPix, plafond de la qualité « auto » du moteur), 40 tours, 6 passes :

| variante | médiane (ms) | p10–p90 (ms) | rapport |
|---|---:|---:|---:|
| ancien | 0,500 | 0,450–0,617 | 1 |
| fsky-jour | 0,500 | 0,483–0,667 | 1,000 |
| fsky-couvert | 0,583 | 0,567–0,783 | 1,166 |
| fsky-nuit | 0,667 | 0,633–0,933 | 1,334 |
| fsky-atmo | 0,167 | 0,133–0,200 | 0,334 |

### NVIDIA GB10 (valeurs de `rendu.json`, `autres`)

2560×1440, 40 tours, 30 passes :

| variante | médiane (ms) | p10–p90 (ms) | rapport |
|---|---:|---:|---:|
| ancien | 0,177 | 0,157–0,197 | 1 |
| fsky-jour | 0,227 | 0,210–0,243 | 1,282 |
| fsky-couvert | 0,253 | 0,243–0,277 | 1,429 |
| fsky-nuit | 0,283 | 0,270–0,300 | 1,599 |
| fsky-atmo | 0,073 | 0,057–0,090 | 0,412 |

1792×1008, 40 tours, 30 passes :

| variante | médiane (ms) | p10–p90 (ms) | rapport |
|---|---:|---:|---:|
| ancien | 0,093 | 0,077–0,113 | 1 |
| fsky-jour | 0,117 | 0,100–0,127 | 1,258 |
| fsky-couvert | 0,137 | 0,117–0,153 | 1,473 |
| fsky-nuit | 0,147 | 0,137–0,167 | 1,581 |
| fsky-atmo | 0,037 | 0,027–0,053 | 0,398 |

### Les deux séries : annonce du §1.4 et mesure

Le tableau du §1.4 de la fiche ne se reproduit pas : il ne faut pas le prendre pour un acquis. Il rapportait le nouveau ciel à l'ancien ciel à 1,58 ms, le chiffre de l'audit (CIEL), mesuré dans une autre session. Mesuré ici dans le même processus et en alternance, l'ancien ciel vaut 0,95 ms. Le nouveau ciel coûte donc plus que l'ancien, pas moins ; la nuit annoncée à 0,82 ms en coûte 1,30.

| cas, 2560×1440 | annoncé au §1.4 (M5) | mesuré, M5 | mesuré, GB10 |
|---|---|---|---|
| ancien ciel | 1,58 ms (1) | 0,950 ms (1) | 0,177 ms (1) |
| jour nuageux | 0,95 ms (0,60) | 1,000 ms (1,053) | 0,227 ms (1,282) |
| couvert | 1,22 ms (0,77) | 1,150 ms (1,211) | 0,253 ms (1,429) |
| nuit étoilée | 0,82 ms (0,52) | 1,300 ms (1,368) | 0,283 ms (1,599) |
| atmosphère seule | 0,28 ms | 0,283 ms | 0,073 ms |

### Objectifs du §6.1 (GPU seulement)

| variante | objectif | limite | M5 2560 | M5 1792 | GB10 2560 | GB10 1792 |
|---|---|---|---|---|---|---|
| fsky-jour | ≤ 1,0 | ≤ 1,15 | 1,053 : objectif manqué, limite tenue | 1,000 : tenus | 1,282 : limite dépassée | 1,258 : limite dépassée |
| fsky-couvert | — | ≤ 1,15 | 1,211 : dépassée | 1,166 : dépassée | 1,429 : dépassée | 1,473 : dépassée |
| fsky-nuit | ≤ 1,0 | — | 1,368 : manqué | 1,334 : manqué | 1,599 : manqué | 1,581 : manqué |

En valeur absolue, sur un écran entièrement couvert de ciel en 2560×1440, le surcoût par rapport à l'ancien ciel va :

- sur le M5, de +0,05 ms (jour) à +0,35 ms (nuit) ;
- sur le GB10, de +0,05 à +0,11 ms.

En jeu, le ciel n'occupe qu'une partie de l'écran.

### Leviers de coût : mesurés, non appliqués (option désactivée par défaut)

Les limites étant dépassées, les deux leviers du §6.1 ont été mesurés. La page `apercu.html` construit des variantes de `FRAG` pour le banc, sans toucher à `FSky.FRAG` :

- **L1** : nuages, `fskyFbm(p,4)` devient `fskyFbm(p,3)` ;
- **L2** : ombrage des nuages, `fskyFbm(p+sd*.35,2)` devient `fskyFbm(p+sd*.35,1)`.

| variante, 2560×1440 | M5 (6 passes) | GB10 (30 passes) |
|---|---:|---:|
| ancien | 0,950 ms (1) | 0,170 ms (1) |
| fsky-jour | 1,053 | 1,335 |
| jour avec L1 | 0,913 | 1,176 |
| jour avec L1+L2 | 0,860 | 1,118 |
| fsky-couvert | 1,228 | 1,453 |
| couvert avec L1 | 1,087 | 1,335 |
| couvert avec L1+L2 | 0,965 | 1,194 |
| fsky-nuit | 1,368 | 1,647 |
| nuit avec L1+L2 | 1,245 | 1,547 |
| fsky-atmo | 0,300 ms (0,316) | 0,070 ms (0,412) |

**Décision C6 : `FSky.FRAG` reste celui de la référence (annexe A), sans levier.**

- Les leviers retirent du détail aux nuages : une octave de bruit sur la forme, une sur l'ombrage. C'est une perte de qualité, donc au mieux une option désactivée par défaut.
- Avec L1+L2, le M5 tient les limites (jour 0,86, couvert 0,965). Sur le GB10, le jour passe sous 1,15 (1,118), mais le couvert reste au-dessus (1,194).
- Les signatures de l'annexe D ne dépendent pas des nuages : une option de ce type ne toucherait ni T12 ni le contrôle miroir.

### Coût par couche, de nuit (mesure complémentaire)

**Méthode.** C'est le même banc, lancé depuis une copie d'`apercu.html` hors du dépôt, non livrée. Une seule ligne y est ajoutée après la variante `fsky-nuit` :

```
V.push(['nuit-0111',fsky(17,[0,1,1,1],prog)],['nuit-1011',fsky(17,[1,0,1,1],prog)],['nuit-1110',fsky(17,[1,1,1,0],prog)],['nuit-0000',fsky(17,T0,prog)]);
```

Le coût d'une couche vaut la nuit complète moins la nuit sans cette couche. Résultats en 2560×1440 :

| préréglage 17 (`jardins-dernier-signal`) | M5 (6 passes) | GB10 (30 passes) |
|---|---:|---:|
| nuit complète (`1111`) | 1,300 ms | 0,280 ms |
| sans nuages (`0111`) : coût des nuages | 0,783 ms : **0,52 ms** | 0,173 ms : **0,11 ms** |
| sans astres, soit étoiles, voie lactée et lune (`1011`) : coût des astres | 0,850 ms : **0,45 ms** | 0,190 ms : **0,09 ms** |
| sans crêtes (`1110`) : coût des crêtes | 1,283 ms : **0,02 ms** | 0,280 ms : **0** |
| atmosphère seule (`0000`) | 0,283 ms | 0,073 ms |
| ancien ciel, même passage | 0,967 ms | 0,173 ms |

**Lecture.**

- **Crêtes (CIEL-V3).** Bornées par `d.y < uFskyHorizon.x`, les crêtes ne coûtent presque rien. Dans l'ancien ciel, calculées à chaque pixel, elles représentaient 27 % du coût.
- **Nuit.** Le surcoût vient des nuages et des astres, qui coûtent chacun plus que l'atmosphère. Les leviers ne touchent que les nuages. Pour les astres, la piste reste celle de CIEL-04 : dessiner les étoiles en points.

**Conditions.** Mac à 10 h 25 : charge 1,5, processeur inactif à 93 %, état thermique « nominal ». Spark : GPU à 0 %, charge 0,5.

## Charge des machines pendant les bancs

**Mac** : partagé par environ 8 agents. C'est un MacBook Air sans ventilateur, dont l'état thermique (`ProcessInfo.thermalState`) a oscillé entre « fair » et « nominal » pendant la session.

- **Conditions de lancement.** Chaque banc retenu n'a été lancé qu'après trois relevés successifs au repos :
  - aucun Chrome sans tête d'un autre agent ;
  - utilisation GPU (`IOAccelerator`, « Device Utilization ») sous 25 % ; elle est de 12 à 13 % au repos (fond d'écran animé et WindowServer) ;
  - processeur inactif à 70 % ou plus sur une seconde ;
  - état thermique « nominal ».
- **Pendant les bancs**, un relevé toutes les 0,5 s n'a vu apparaître aucun Chrome étranger.
- **Bancs retenus**, le 13/11/2026, tous en état thermique « nominal » :

  | banc | heure | charge | processeur inactif |
  |---|---|---:|---:|
  | 2560×1440 | 10 h 19 min 17 | 2,88 | 80 % |
  | 1792×1008 | 10 h 19 min 31 | 2,69 | 78 % |
  | leviers | 10 h 19 min 42 | 2,73 | 76 % |

- **Tous les passages, retenus ou non.**
  - **2560×1440 :** 23 passages de 6 passes entre 10 h 05 et 10 h 19.
    - L'ancien ciel va de 0,95 à 1,92 ms. Le coût absolu gonfle jusqu'à ×2 avec un Chrome d'un autre agent sur le GPU, ou en état thermique « fair ».
    - Les rapports restent dans la même bande : jour de 0,96 à 1,08 (médiane 1,05), couvert de 1,14 à 1,27 (1,22), nuit de 1,30 à 1,45 (1,39).
    - Les 4 passages au repos donnent un ancien ciel entre 0,95 et 0,97 ms.
  - **1792×1008 :** 3 passages. Ancien ciel de 0,50 à 0,72 ms ; jour de 1,00 à 1,05, couvert de 1,17 à 1,21, nuit de 1,33 à 1,42.
- **Règle de relance** (p90/p10 de l'ancien ciel ≤ 1,25).
  - En 2560×1440, les passages retenus sont à 1,144.
  - En 1792×1008, les deux passages au repos sont à 1,33 et 1,37 : l'étalement absolu est comparable (0,15 à 0,17 ms, contre 0,13 ms en 2560×1440) sur des temps deux fois plus courts. Ils donnent la même médiane (0,500 ms) ; le second est conservé.
- **`--table`** a tourné avec le processeur inactif à 80 %.

**Spark** : GPU à 0 % (`nvidia-smi`) avant chaque lancement. Charge sur une minute de 1,1 à 1,4, aucun autre Chrome sans tête, un seul Chrome à la fois.

## Relecture visuelle

**Ce qui a été regardé.** L'agent exécutant (Claude, avec vision) a regardé la planche et trois captures (mondes 03, 12 et 15). Il n'a retouché aucun préréglage d'après elles : les valeurs de l'annexe C sont figées (R6). **Le jugement final revient à David.**

**Ce que l'agent y voit.**

- **18 ciels distincts** :
  - aubes : 00, 01 ;
  - matin, plein jour et après-midi, bleus : 02, 03, 05, 08 ;
  - voiles, sable, cendres et brume : 04, 07, 10, 11 ;
  - orage sec et couvert, gris : 06, 09 ;
  - couchants orangés : 12, 13 ;
  - crépuscule mauve : 14 ;
  - trois nuits :
    - 15 : lune, étoiles et voiles de nuages ;
    - 16 : braises, brun sombre ;
    - 17 : dernier signal, bleu-vert avec étoiles faibles.
- **Tramage** : à l'œil, à cette échelle, on ne voit pas le tramage (±1 niveau), ni de bande dans les dégradés. Le contrôle mesure le tramage.

**Points à trancher, déjà listés pour la documentation du module :**

- Face à un soleil bas (00, 01, 12, 13), une colonne lumineuse apparaît sous l'horizon : c'est le halo de Mie dans le brouillard, avec un risque de bloom.
- Le brouillard sous l'horizon du crépuscule mauve (14) est d'un orange très saturé.
- Parmi les images regardées, les crêtes d'horizon, teintées par le brouillard, ne se distinguent nettement que sur le couchant (12).

**Pour comparer**, l'ancien ciel (3 ciels pour 18 mondes) est capturé dans `docs/chantier-moteur/ciel/existant-monde0-woodland-soleil.jpg`, `existant-monde1-quarry-soleil.jpg` et `existant-monde2-garden-soleil.jpg`.

## Tailles (§6.3)

- **`src/skies.js`** : 23 094 octets. L'objectif de 20 000 octets est manqué, la limite de 24 000 tenue.
- **Images** : de 247 093 à 275 715 octets par capture, 854 372 octets pour la planche, 5 495 074 octets au total.
- **Effet estimé sur `dist/index.html`**, sans lancer `build.py`, qui concatène les modules sans les réduire. Aujourd'hui, `dist` fait 812 696 octets (version 0.8.1), pour un budget de 1 400 000.
  - **Ajouter `skies.js`** : +23 097 octets, séparateur compris.
  - **Retirer un jour `SKY_FRAG`** : −2 021 octets pour sa déclaration seule. Le §6.3 de la fiche estime environ 2,3 ko avec le code qui la sert.

## Constats couverts par ces preuves

| constat | preuve |
|---|---|
| **CIEL-10** : 18 mondes, 3 ciels | 18 préréglages distincts, un par monde de campagne : captures 00 à 17 et planche. Distances minimales de signature de 90 et 78, pour des seuils de 60 et 30. |
| **CIEL-05** : bandes de couleur | Tramage à la dernière écriture 8 bits : au plus ±1 niveau, sur environ un tiers des niveaux (`verif`, trois moteurs). |
| **CIEL-V3** : crêtes d'horizon | Crêtes bornées à l'horizon : 0,02 ms sur M5 et 0 sur GB10, plein écran de nuit (mesure complémentaire ci-dessus). |

Le masque alpha du disque solaire (CIEL-V1) et les 27 uniformes de l'API (CIEL-11) sont vérifiés par le même contrôle.

## Reproduire

- Les commandes ci-dessus.
- `node --test checks/fsky.test.mjs` : 17 tests sur 17 réussis.
- Le contrôle et les captures ne dépendent pas de la charge. Les valeurs absolues des bancs, si.
