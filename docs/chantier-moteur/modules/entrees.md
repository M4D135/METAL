# Module d'entrées FInput (`src/input.js`)

État : **étape 5 sur 10**. `create` valide la déclaration du jeu (étape 1) et rend l'instance au clavier, à la souris et aux boutons virtuels : `frame()`, `step()`, `pendingLook()`, `clear()`, `configure()` (étape 2). Les réglages sont complets : `normalize` avec `migrate`, codes de repli et table de la manette, `assign` et `unbind` au clavier comme à la manette, capture clavier (étape 3). La manette est lue par `frame()` : fusion de plusieurs manettes, zones mortes radiales, courbe, surcroît de lacet, gâchettes à hystérésis, actions analogiques, course au bout du stick, branchement à chaud, appareil actif, capture manette et échange des sticks (étape 4, §2.8). Les invites et les vibrations sont livrées (étape 5, §2.9) : libellés des touches appris de `key` ou lus dans la table du clavier, invite de chaque action selon l'appareil, glyphes Xbox et PlayStation de la dernière manette active, appareil probable au démarrage (règle de BITUME), `rumble` avec son limiteur ; la table des vibrations de METAL est au §5. Menus et tactile arrivent aux étapes 6 et 7. Le module n'est pas branché dans le jeu : aucun fichier existant n'est modifié, et le raccord est seulement décrit au §4. Les sections encore à écrire donnent leur plan et l'étape qui les remplira.

## 1. Rôle et périmètre

FInput est la couche d'entrées générique du moteur FERRO. C'est un script classique qui expose le global `FInput` et ne sait rien du contenu de METAL. Le jeu déclare ses actions (identifiants, types, touches et boutons par défaut, libellés) ; FInput fusionne le clavier (par `event.code`, donc AZERTY comme QWERTY), la souris, les widgets tactiles, la manette au mapping standard et une source « pilote » (démo). Il rend **une structure d'entrées par pas de simulation**, plus les fronts, l'appareil actif et la commande de menu de l'image. Les autres jeux du moteur pourront le recopier tel quel.

Constats couverts :

| Constat | Ce que FInput en reprend |
|---|---|
| FEEL-10 (P0) | Manette : zone morte radiale .12/.97, courbe 1,7, lacet 300°/s, tangage 190°/s, surcroît de lacet +80 % après 0,18 s à fond, gâchettes à hystérésis .30/.18, vibrations, branchement à chaud. |
| LOOP-07 | Absorbé par FEEL-10 (arbitrage « BOSS-01, FEEL-01, FEEL-09, FEEL-10, LOOP-07 ») : ses valeurs sont remplacées par celles de FEEL-10. |
| FEEL-11 | Menus à la manette (modèle de focus), invites selon l'appareil actif, glyphes Xbox et PlayStation, branchement à chaud. |
| TACT-09 | Couche commune : déplacement = source la plus forte, visée = somme, boutons tenus = OU, impulsions verrouillées puis effacées après le premier pas. |
| TACT-08 | Appareil actif = dernier utilisé, détection tactile qui ne fige rien au démarrage. |
| TACT-01 à 04 | Bouton-visée, manche flottant, courbe d'accélération tactile, verrou des appuis courts. |
| LOOP-06 | Un appui plus court qu'une image n'est jamais perdu. |
| TACT-13 | Gyroscope en fonction pure, facultatif (étape 9). |

Lots : 08 (T1, T2) et 08b (T3, et la part « couche d'entrées » de T4, T5, T6, T10 et T15). Le module « FGamepad » de la fiche lot-08 T1 est **absorbé** dans FInput : un seul module d'entrées, comme le veut l'arbitrage.

Décisions qui s'imposent :
- David, 12/11 (`MASTER-PROMPT.md` §6 bis, point 4) : **Espace saute, R esquive, V frappe**, et tout reste reconfigurable au clavier comme à la manette. Les autres touches restent celles d'aujourd'hui.
- `MASTER-PROMPT.md` §6 : chaque brique générique est un script autonome qui expose un global `F…` ; la simulation passera à un pas fixe de 1/60 s (lot 07), avec les angles de vue appliqués à chaque image. D'où `step()` une fois par pas et `pendingLook()` pour le regard pas encore consommé.

Hors périmètre :
- l'enregistreur de flux (DEMO-08, futur module de démo) et l'automate de l'écran titre (DEMO-01) ;
- le CSS, le câblage dans `game.js`, toute modification de la simulation (saut FEEL-09, frappe FEEL-01, bonus d'aide à la visée) ;
- ce qui reste dans `game.js` : le tampon d'intention de tir de 150 ms (`FOptions.fireBufferMs`), les règles de verrouillage du pointeur (LOOP-10), la molette, la pause sur perte de focus, le déblocage du son, le `preventDefault` des événements tactiles et l'affichage.

## 2. API

### 2.1 Livraison par étape

| Partie | Étape | État |
|---|---|---|
| Forme du fichier, constantes, `keyName`, validation de la déclaration par `create` | 1 | livré |
| Instance : actions, clavier, souris, boutons, `frame()` sans manette, `step()`, `pendingLook()`, `clear()`, `configure()`, `settings`, `device` ; `defaults`, et `normalize` pour la table des touches et `tune` | 2 | livré |
| `normalize` complet (`migrate`, codes de repli `alt`, table `pad` stockée), `assign`, `unbind` (statiques et d'instance), capture clavier | 3 | livré |
| Manette : `radial`, lecture, fusion, zones mortes, courbe, surcroît, gâchettes, valeurs, course, branchement à chaud, appareil actif, capture, échange des sticks ; `padStyle`, avancé de l'étape 5 pour le `style` des manettes branchées | 4 | livré |
| Invites et vibrations : `keyLabel`, `setLayout`, `label`, `glyph`, `guessDevice`, `rumble`, et la dernière manette active (`lastPad`) qu'ils lisent | 5 | livré |
| Menus : `nav` et `focusMove` | 6 | à faire |
| Tactile et pilote : manche flottant, zone de visée, bouton-visée, accélération, `setPilot` | 7 | à faire |
| Outils, mesures, page d'essai dans Chrome | 8 | à faire |
| Gyroscope `FInput.gyro` (facultatif) | 9 | à faire |
| Document complet, `npm test` final | 10 | à faire |

### 2.2 Forme et API statique

Script classique, sans `import` ni `export`, de la forme `(function(G){'use strict';…G.FInput=…})(typeof window!=='undefined'?window:globalThis)`, comme `src/motion.js`. Il n'ajoute que `FInput` au global, ne lit ni horloge ni hasard (le temps arrive en paramètre) et n'appelle aucun réseau. Budget : 18 000 octets au plus.

| Nom | Signature | Rôle | Étape |
|---|---|---|---|
| `version` | `1` | Version de l'API. | 1 |
| `PAD_BUTTONS` | 17 noms, gelé | Boutons du mapping standard W3C, dans l'ordre des index 0 à 16 : A, B, X, Y, LB, RB, LT, RT, Back, Start, L3, R3, Up, Down, Left, Right, Home. | 1 |
| `TUNE` | `{nom: [défaut, min, max]}`, gelé | Réglages du joueur et leurs bornes (§2.4). | 1 |
| `create(config)` | → instance | Valide la déclaration (§2.5), puis rend l'instance (§2.7). | 1 à 7 |
| `keyName(code)` | → texte | Nom affichable d'un `event.code`, identique à `FOptions.keyName` pour tous les codes réels. | 1 |
| `defaults(config)`, `normalize(raw, config)` | → réglages | Réglages par défaut ; relecture tolérante et idempotente (§2.6). | 2 et 3 |
| `assign(config, settings, device, action, code)`, `unbind(config, settings, device, action)` | → `{ok, …}` | Réaffectation avec détection des conflits ; ne modifient jamais leurs arguments. | 3 |
| `radial(x, y, inner, outer)` | → `[x', y', n]` | Zone morte radiale avec remise à l'échelle : `m = hypot(x, y)` ; `m ≤ inner` → `[0, 0, 0]` ; sinon `n = min(1, (m − inner)/(outer − inner))` et `[x/m·n, y/m·n, n]`, sans `-0` ni `NaN` (E24). | 4 |
| `padStyle(id)` | → `'ps'`, `'xbox'` ou `'generic'` | Famille de manette d'après son `id`, sans tenir compte de la casse : `054c`, `playstation`, `dualshock`, `dualsense` ou `sony` → `'ps'` ; `045e`, `xbox` ou `xinput` → `'xbox'` ; sinon `'generic'` (E33). | 4 |
| `glyph(name, style)` | → texte | Glyphe d'un nom de `PAD_BUTTONS` au style `'xbox'`, `'ps'` ou `'generic'` (table du §2.9). Style inconnu → glyphes génériques ; nom inconnu → le nom lui-même (E40b). | 5 |
| `guessDevice(win = global)` | → `'touch'` ou `'keyboard'` | Appareil probable au démarrage, règle de BITUME (TACT-08) : `'touch'` si `(pointer: coarse)`, ou si `maxTouchPoints > 0` et `(hover: none)` ; toute erreur → `'keyboard'` (§2.9, E41). | 5 |
| `focusMove(root, cmd, doc)` | → élément ou `null` | Déplacement du focus dans un menu. | 6 |
| `gyro(rate, gravity, angle, dt, opts)` | → `{x, y}` | Facultatif. | 9 |

L'instance est décrite au §2.7, avec ce que chaque étape y ajoute.

### 2.3 Unités et repères

- Déplacement (`<stick move>X`, `<stick move>Y`) : sans unité, x positif à droite, y positif en avant. Une source analogique donne une norme ≤ 1 ; le clavier peut donner (1, 1), comme aujourd'hui, et la simulation normalise.
- Regard (`<stick look>X`, `<stick look>Y`) : radians **par pas de simulation**, un delta et non une vitesse. x positif = tourner à droite (`p.yaw += lookX`), y positif = regarder vers le haut (`p.pitch += lookY`).
- Manette : `axes[0..1]` stick gauche, `axes[2..3]` stick droit (x vers la droite et y vers le bas positifs), `buttons[0..16]` dans l'ordre de `PAD_BUTTONS`. Le y des sticks est inversé pour que « en avant » et « vers le haut » soient positifs. Une valeur absente ou non finie vaut 0.
- Temps : `dt` en secondes, borné à [0 ; 0,25] ; `t` en millisecondes (en pratique `event.timeStamp`). Vitesses de stick en °/s, converties en radians ; vitesse tactile en px/s.
- Tactile : positions en px CSS, y vers le bas.
- Aucune sortie numérique ne vaut `-0`. Les objets venus d'un autre domaine (contexte vm, autre fenêtre) sont reconnus par `Array.isArray`, jamais par `instanceof`.

### 2.4 Constantes

Réglages `TUNE` (réglages du joueur, rangés dans `settings.tune`) :

| Réglage | Défaut | Min | Max | Rôle |
|---|---|---|---|---|
| `sensitivity` | 1 | 0,25 | 3 | Souris et tactile ; le jeu y recopie son réglage. |
| `invertY` | non | | | Inversion du tangage, souris et tactile. |
| `padYaw` | 300 | 60 | 600 | Lacet du stick de visée à fond, en °/s. |
| `padPitch` | 190 | 40 | 400 | Tangage du stick de visée à fond, en °/s. |
| `padDead` | 0,12 | 0 | 0,4 | Zone morte radiale intérieure du stick de visée. |
| `moveDead` | 0,15 | 0 | 0,4 | Zone morte radiale intérieure du stick de déplacement. |
| `padCurve` | 1,7 | 1 | 3 | Exposant de la courbe de visée. |
| `padBoost` | 0,8 | 0 | 1,5 | Lacet en plus après un maintien à fond. |
| `padInvertY` | non | | | Inversion du tangage à la manette. |
| `padVibration` | 1 | 0 | 1 | Intensité des vibrations. |
| `swapSticks` | non | | | Échange les rôles des deux sticks. |
| `touchAccel` | 1 | 0 | 1 | Part de la courbe d'accélération tactile ; 0 = linéaire. |
| `touchPitch` | 1 | 0,5 | 1,5 | Facteur de tangage tactile. |
| `stickRadius` | 56 | 32 | 96 | Rayon du manche flottant, en px. |

Constantes internes `K` : zone morte extérieure des sticks .97 ; surcroît de lacet au-delà de .97, après 0,18 s, en rampe de 0,30 s ; gâchettes .30 à l'appui et .18 au relâchement ; zone morte des actions analogiques .05 ; course au bout du stick à .92 ; activité d'un axe à .3 ; menus : direction au stick au-delà de .5, répétition après 0,40 s puis toutes les 0,12 s ; manche flottant : zone morte .12, centre qui suit au-delà de 1,6 rayon, course à 1,25 rayon et relâchée sous 1,05 ; visée tactile .004 rad/px, accélération entre 400 et 2 200 px/s qui porte le gain de 1 à 3,2 au plus (1 + 2,2), `dt` de vitesse borné à [0,008 ; 0,05] s ; seuil du bouton-visée 4 px ; filtre de 800 ms des événements souris émulés après un toucher ; 40 ms au moins entre deux vibrations ; `dt` borné à 0,25 s.

### 2.5 Déclaration du jeu et validation (livré à l'étape 1)

```js
const inp = FInput.create({
  actions: [{id:'jump', label:'Sauter', type:'press', keys:['Space'], pad:['A'], touch:'SAUT', alt:['KeyJ']}, …],
  sticks: {move: {type:'move', x:['left','right'], y:['back','forward'], pad:'LS', run:'sprint'},
           look: {type:'look', x:['turnLeft','turnRight'], y:[], pad:'RS', rate:1.9}},
  version: 2, migrate: (raw, from) => raw, settings: undefined,
  device: 'keyboard', mouseScale: .0022, allowKey: undefined, getGamepads: undefined
});
```

`create` lève `Error('FInput : …')`, qui nomme le fautif, si la déclaration enfreint une de ces règles. Il ne modifie jamais la config : l'instance travaille sur une copie.

| Champ | Règle | Défaut |
|---|---|---|
| config | Un objet (pas un tableau). | |
| `actions` | Tableau non vide d'objets ; l'ordre donne l'ordre d'affichage et de sortie. | obligatoire |
| `id` | `/^[A-Za-z][A-Za-z0-9]*$/`, unique. | obligatoire |
| `type` | `hold` (tenu), `press` (impulsion) ou `value` (analogique 0..1). | obligatoire |
| `label`, `touch`, `mouse` | Chaînes ; `touch` et `mouse` facultatifs. | `label` = l'id |
| `keys` | Tableau de 0 à 3 codes acceptés par `allowKey`. | `[]` |
| `pad` | Tableau de 0 à 2 noms de `PAD_BUTTONS`, sauf `Home`. | `[]` |
| Unicité | Un code figure au plus une fois dans l'ensemble des `keys` : ni dans deux actions, ni deux fois dans la même. De même pour les boutons des `pad`. | |
| `alt` | Tableau de codes acceptés : touches de repli, qui peuvent appartenir à une autre action. | `[]` |
| `sticks` | Objet ; au plus un stick `move` et un `look`. | `{}` |
| nom de stick | `/^[a-z][A-Za-z0-9]*$/` ; ni `<nom>X` ni `<nom>Y` n'est l'id d'une action. | |
| `x`, `y` | Tableaux de 0 ou 2 ids d'actions `hold`, dans l'ordre [négatif, positif] ; une action au plus une fois par stick. | `[]` |
| `pad` (stick) | `'LS'` ou `'RS'` ; deux sticks n'ont pas le même. | aucun |
| `run` | Stick `move` seulement : id d'une action `hold`. | aucun |
| `rate` | Stick `look` seulement : nombre fini > 0, en rad/s (regard au clavier). | 2 |
| `version` | Entier ≥ 1 : version du format des réglages du jeu. | 1 |
| `migrate` | Appelée par `normalize` si c'est une fonction et que `raw.v < version` ; ignorée sinon. | aucune |
| `settings` | Réglages initiaux, passés à `normalize`. | aucun |
| `device` | `keyboard`, `mouse`, `touch` ou `gamepad`. | `keyboard` |
| `mouseScale` | Nombre fini : radians par unité de `movementX/Y`. | .0022 (valeur de `game.js`) |
| `allowKey` | Fonction `code => booléen`. | `Key[A-Z]`, `Digit[0-9]`, flèches, `ShiftLeft`/`ShiftRight`, `Space`, `Enter`, `Backspace`, `Tab` |
| `getGamepads` | Fonction `() => tableau`. | `navigator.getGamepads()`, relu à chaque `frame()` |

Au-delà de la mission, l'étape 1 refuse aussi : un code ou un bouton répété dans une même action, une action citée deux fois par un même stick, `run` sur un stick `look` et `rate` sur un stick `move`, et des champs `device`, `mouseScale`, `allowKey` et `getGamepads` du mauvais type. Ces déclarations n'ont pas de sens et casseraient l'unicité que `normalize` garantit.

`defaults`, `normalize` (étape 2), `assign` et `unbind` (étape 3) appliquent la même validation et lèvent la même erreur.

### 2.6 Réglages (livrés aux étapes 2 et 3)

Les réglages sont un objet JSON pur, `{v, keys, pad, tune}` : `v` = `version` de la déclaration ; `keys` et `pad` = une liste de codes par action, dans l'ordre de déclaration ; `tune` = les 14 réglages de `TUNE`, dans leur ordre. `JSON.parse(JSON.stringify(s))` redonne le même objet. Ce sont des préférences du joueur (dans METAL, rangées avec les autres sous la clé `ferro-settings`, §4.2), pas un point de reprise : aucun format de sauvegarde ne change, et le lot 12 n'est pas concerné.

- `defaults(config)` : les listes `keys` et `pad` de la déclaration (copies) et les valeurs par défaut de `TUNE`. Valide la déclaration comme `create` ; un objet neuf à chaque appel ; n'appelle pas `migrate`. Pour METAL : Espace saute, R esquive, V frappe, aucun code en double (E04).
- `normalize(raw, config)`, dans cet ordre (E04b, E19 à E22) :
  1. `raw` qui n'est pas un objet, ou qui est un tableau → `{}` ; sinon une copie JSON (copie impossible, objet cyclique, `toJSON` qui ne rend pas un objet → `{}`). L'argument n'est jamais modifié.
  2. `from` = le `v` de la copie s'il est entier, sinon 0. Si `from < version` et que la déclaration a une fonction `migrate` : `migrate(<copie de la copie>, from)`, dans un `try`. Un objet rendu (pas un tableau) remplace la copie, après une copie JSON qui retire les entrées `undefined` comme pour des réglages stockés. Exception, autre valeur rendue ou objet impossible à copier : la copie reste telle quelle, sans migration, même si `migrate` a modifié l'objet reçu avant d'échouer. Un profil à la version courante, ou plus récent, n'appelle jamais `migrate`.
  3. `keys` (au plus 3 codes acceptés par `allowKey`) et `pad` (au plus 2 noms de `PAD_BUTTONS`, `Home` exclu), lus par la même règle :
     - une table stockée qui n'est pas un objet → les défauts ;
     - chaque entrée stockée d'une action déclarée (propriété propre : un id nommé `toString` se lit bien) doit être un tableau de bonne longueur, de codes acceptés, sans code en double, ni dans l'entrée ni entre deux entrées. `null` est une entrée définie, donc invalide ; `[]` est valide (action non affectée). **Une seule entrée invalide → toute la table de ce type revient aux défauts** ; l'autre table n'en dépend pas ;
     - une action absente reçoit ses codes par défaut qu'aucune entrée stockée n'utilise, dans l'ordre. S'il n'en reste aucun, une action clavier prend le premier code libre de son `alt` (un seul), sinon `[]` ; la manette n'a pas de repli. Les actions sont traitées dans l'ordre de déclaration, et chaque code attribué devient utilisé pour les suivantes ;
     - les clés inconnues disparaissent ; la sortie suit l'ordre de déclaration et n'a jamais de code en double.
  4. `tune` : un réglage numérique garde un nombre fini, borné à [min ; max] ; un réglage booléen garde un booléen ; tout le reste prend la valeur par défaut ; les champs inconnus disparaissent ; aucune valeur ne vaut `-0` (E20).
  5. Sortie `{v: version, keys, pad, tune}`. `normalize(normalize(x))` est égal en JSON à `normalize(x)`, et `normalize(JSON.parse(JSON.stringify(n)))` à `n` (E19, sur 13 profils).
- `assign(config, settings, device, action, code)` ne modifie jamais ses arguments (E15 à E18b). Contrôles, dans cet ordre :

| Cas | Retour |
|---|---|
| `device` n'est ni `'keyboard'` ni `'gamepad'` | `{ok:false, reason:'Appareil inconnu.'}` |
| action non déclarée | `{ok:false, reason:'Action inconnue.'}` |
| clavier, code refusé par `allowKey` (Échap, Méta, Ctrl, Alt, F1 à F12…) | `{ok:false, reason:'Cette touche est réservée au navigateur.'}` |
| manette, `Home` | `{ok:false, reason:'Ce bouton est réservé au système.'}` |
| manette, nom hors de `PAD_BUTTONS` | `{ok:false, reason:'Bouton inconnu.'}` |
| code tenu par une autre action dans `normalize(settings)` | `{ok:false, conflict:<id>, reason:'Déjà utilisée : <label>.'}` au clavier (une touche), `'Déjà utilisé : <label>.'` à la manette (un bouton) |
| sinon | `{ok:true, settings}` : copie normalisée où `keys[action]` (ou `pad[action]`) vaut `[code]` |

- Le conflit se lit sur les réglages normalisés : des réglages invalides valent les défauts, et les codes que `normalize` donne à une action absente comptent. `[code]` remplace tous les codes de l'action ; une action peut reprendre l'un de ses propres codes ; les tables clavier et manette sont indépendantes.
- `unbind(config, settings, device, action)` → `{ok:true, settings}`, copie normalisée où la liste de l'action vaut `[]`. Mêmes erreurs pour l'appareil et l'action ; pas de code à contrôler.
- `assign` et `unbind` lèvent `Error('FInput : …')` pour une déclaration invalide, comme `create`. Chaque appel rend des objets neufs.

### 2.7 Instance

`const inp = FInput.create(config)`. État par action : touches tenues `k`, souris `m`, doigts `t` (jamais négatif), bouton de manette `g`, course au bout du stick ou du manche `gr` et `tr`, valeur analogique `gv`, verrou `latch`, front de l'image `edge`. Une action est **tenue** si `k > 0`, `m`, `t > 0`, `g`, `gr` ou `tr`. **Règle des fronts** : quand une action passe de relâchée à tenue, `latch` devient vrai (lu par `step()`) et son id rejoint une seule fois la liste des fronts de l'image (lue par `frame()`). Un code n'appartient qu'à une action : la table code → action est reconstruite à chaque `configure`.

| Membre | Effet | Étape |
|---|---|---|
| `keyDown(code, t, repeat, key)` → booléen | Appareil = `'keyboard'`, pour toute touche. Ajoute `code` aux touches tenues s'il n'y est pas ; s'il est affecté, met à jour l'action, avec la règle des fronts, sauf pour une répétition : une touche tenue pendant un `clear()` revient par son `repeat`, sans front. Une touche déjà tenue ne donne pas de second front. Rend `true` si `code` est affecté (le jeu fait alors `preventDefault`). **Capture clavier en cours** (étape 3) : le premier appui non répété d'un code (une chaîne) est mémorisé `{device:'keyboard', code}` pour `frame().captured`, la capture se termine, rien n'est appliqué au jeu (touche non tenue, aucun front) et `keyDown` rend `true` ; une répétition est avalée (`true`, rien de capturé), comme dans `game.js` aujourd'hui. **Libellé appris** (étape 5) : pour un code `Key…`, un `key` d'un seul caractère visible devient le libellé de la touche (§2.9), avant toute autre règle, donc aussi pendant une capture, sur une répétition et pour un code non affecté ; le retour n'en dépend pas. | 2, 3, 5 |
| `keyUp(code, t)` → booléen | Retire la touche, jamais de front ; `true` si `code` est affecté. | 2 |
| `mouseMove(dx, dy, t)` | `px += dx·mouseScale·sensitivity`, puis `py -= dy·mouseScale·sensitivity·(invertY ? -1 : 1)`, dans cet ordre de calcul : parité au bit près avec `game.js`. Appareil = `'mouse'`, sauf moins de 800 ms après le dernier événement tactile. Un delta non fini compte pour 0. | 2 |
| `button(action, down, t, device)` → booléen | Source virtuelle : `'mouse'` (booléen `m` ; l'appareil passe à `'mouse'` hors du filtre de 800 ms) ou `'touch'` (compteur `t`, jamais négatif ; appareil `'touch'`, horodatage retenu pour le filtre). Autre appareil ou action inconnue → `false`, sans effet. | 2 |
| `addLook(x, y, device)` | Ajoute des radians bruts à `px` et `py` (glisser sans verrouillage, gyroscope) ; une valeur non finie compte pour 0. Si `device` est l'un des quatre appareils, il devient l'appareil actif. | 2 |
| `clear()` | Relâche touches, souris, doigts et manche ; efface verrous, fronts, `px` et `py` ; termine la capture et efface son résultat pas encore rendu (étape 3). Étape 4 : relâche aussi les boutons et la course de la manette, efface son vecteur de déplacement et le maintien du surcroît, et rend l'image suivante **calme** (§2.8) : aucun front de manette, un bouton encore enfoncé y est tenu sans front (E36). L'hystérésis des gâchettes et les boutons de la dernière image restent, comme l'appareil actif et les réglages. Les étapes suivantes y ajoutent la commande de menu (6), les pointeurs et la vitesse tactiles (7). | 2, 3, 4 |
| `configure(settings)` → réglages | Normalise, applique, reconstruit la table code → action, recompte les touches tenues sans front (une touche tenue qui change d'action tient la nouvelle) et rend une copie des réglages appliqués. Étape 4 : les boutons de manette de chaque action viennent de la table `pad` des réglages, et un bouton enfoncé à la dernière image tient sa nouvelle action, sans front (E34b). | 2, 4 |
| `settings`, `device` | Accesseurs : copie des réglages courants ; appareil actif, au départ `config.device`. | 2 |
| `frame(dt, ctx)` → résultat | Une fois par image, avant les pas. `dt` fini borné à [0 ; 0,25], sinon 0. Regard au clavier du stick `look` : `px += (tenue(x[1]) − tenue(x[0]))·dt·rate`, et de même pour `py` si `y` a deux actions. Rend un objet neuf `{pressed, nav, device, deviceChanged, connected, disconnected, pads, captured}` : `pressed` = fronts depuis la dernière image, dans l'ordre d'arrivée, sans doublon ; `deviceChanged` = appareil différent de celui du résultat précédent. Puis vide la liste des fronts et les `edge`. `captured` (étape 3) = le résultat de la capture, rendu une seule fois, par l'image qui suit l'appui au clavier, ou par l'image même de l'appui à la manette ; sinon `null`. Étape 4 : lit et fusionne les manettes avant le regard au clavier (§2.8) ; `connected`, `disconnected` et `pads` décrivent les manettes ; `ctx.lookScale` (nombre fini, sinon 1) ne ralentit que la visée à la manette. `nav` vaut `null` jusqu'à l'étape 6. | 2, puis 3, 4, 6, 7 |
| `step()` → entrées du pas | Une fois par pas de simulation, un objet neuf aux clés dans un ordre fixe : `<stick>X` et `<stick>Y` pour chaque stick dans l'ordre de déclaration, puis chaque action. Stick `move` : le candidat de plus forte norme parmi le clavier `(tenue(x[1]) − tenue(x[0]), tenue(y[1]) − tenue(y[0]))`, la manette et le manche tactile, examinés dans cet ordre ; un suivant ne gagne qu'avec une norme strictement plus grande (la manette donne le vecteur de la dernière image, §2.8, et à norme égale le clavier le garde ; le manche vaut 0 jusqu'à l'étape 7). Stick `look` : `px` et `py`, consommés. Action `hold` : tenue ou `latch` ; `press` : `latch` ; `value` : `max(gv, k > 0 ou m ou t > 0 ? 1 : 0)`. Puis efface tous les verrous. Le regard est remis à 0 à chaque pas, même sans stick `look`, pour ne jamais s'accumuler. | 2, manette à l'étape 4, pilote à l'étape 7 |
| `pendingLook()` → `{x, y}` | Regard accumulé et pas encore consommé, sans le consommer (STAB-06 : le jeu l'ajoute aux angles de la caméra entre deux pas). | 2 |
| `assign(device, action, code)`, `unbind(device, action)` → `{ok, …}` | Comme les fonctions statiques (§2.6), avec la déclaration et les réglages courants de l'instance. N'appliquent rien : le jeu appelle ensuite `configure(r.settings)` et enregistre `r.settings` (E15, E16, E18). | 3 |
| `capture(device)` | `'keyboard'` ou `'gamepad'` : le prochain appui de cet appareil ira à `frame().captured` au lieu du jeu. Toute autre valeur, `null` compris, annule. Chaque appel efface aussi un résultat pas encore rendu : une nouvelle demande ne reçoit jamais l'appui de la précédente (E23). Capture manette (étape 4) : lue par `frame()`, au premier bouton nouveau (§2.8) ; le clavier (E36), la souris et les sticks continuent de jouer pendant qu'elle attend. | 3, 4 |
| `keyLabel(code)`, `setLayout(map)`, `label(action, device)`, `rumble(strong, weak, ms, t)` | Invites et vibrations (§2.9). | 5 |
| `setPilot`, `stickDown`, `stickMove`, `stickUp`, `stickState`, `aimDown`, `aimMove`, `aimUp`, `aiming` | Pilote et tactile. | 7 |

### 2.8 Manette (livrée à l'étape 4)

`frame(dt, ctx)` lit les manettes une fois par image, dans cet ordre (mission, §4.6, points 1 à 10 ; la visée tactile et `nav` viendront aux étapes 7 et 6) :

1. **Lecture.** `config.getGamepads()` si la déclaration en donne un, sinon `navigator.getGamepads()`, **appelé comme une méthode de `navigator`** : détaché, il lève « Illegal invocation » dans Chrome (E33b). L'appel est dans un `try` : erreur, `navigator` absent, `null` ou valeur qui n'est pas une liste → aucune manette. La liste est lue par index (`Array.from`), jamais par `instanceof` : une `GamepadList`, un tableau venu d'un autre domaine ou un objet `{length, 0: …}` conviennent. Les entrées `null`, celles qui ne sont pas des objets et les manettes `connected === false` sont ignorées.
2. **Branchement à chaud.** Clé d'une manette = `index + ':' + id`, avec `index` = `p.index`, sinon sa place dans la liste, et `id` lu comme une chaîne. Clé nouvelle → `connected` reçoit `{index, id, style, standard}`, à cette image seulement ; clé disparue → `disconnected` reçoit `{index, id}`, une seule fois. `pads` donne la fiche de chaque manette branchée. `style` = `padStyle(id)` ; `standard` = `mapping === 'standard'`, et une manette non standard est lue quand même, par index. Les fiches rendues sont des copies, qu'on peut modifier sans effet (E33).
3. **Fusion.** Bouton ordinaire tenu si `pressed` ou `value > .5` sur au moins une manette ; un bouton donné comme un nombre est lu comme sa valeur. LT et RT : valeur = maximum des `value`, puis hystérésis : un état vrai le reste tant que la valeur dépasse .18, un état faux devient vrai au-delà de .30, seuils stricts (E30). Sticks : `radial` sur chaque manette, et le vecteur de plus forte norme gagne, pour chaque rôle à part : le déplacement peut venir d'une manette et la visée d'une autre (E32). Rôles : `sticks.move.pad` et `sticks.look.pad`, échangés si `tune.swapSticks` (E37). Zones mortes intérieures `tune.moveDead` pour le déplacement et `tune.padDead` pour la visée, extérieure .97. Un axe ou une valeur non finis valent 0.
4. **Activité** (TACT-08). Un bouton `pressed` ou de valeur > .3, ou l'un des axes 0 à 3 au-delà de .3 en valeur absolue → appareil `'gamepad'`. Un bouton resté enfoncé reprend donc la main à chaque image ; un stick qui dérive sous .3 ne prend rien (E35).
5. **Capture manette**, si `capture('gamepad')` attend : le premier nom de `PAD_BUTTONS`, sauf `Home`, tenu à cette image et pas à la précédente (LT et RT selon leur hystérésis) → `captured = {device:'gamepad', code}`, rendu par cette image, et fin de la capture. Un bouton déjà enfoncé au moment de la demande n'est pas pris : il faut le relâcher (E36).
6. **Actions.** `g` = l'un des boutons de l'action (table `pad` des réglages) est tenu. Action `value` : `gv` = le plus grand de ses boutons, où LT et RT donnent `valeur ≤ .05 ? 0 : min(1, (valeur − .05)/.95)` et les autres 0 ou 1 (E31). Règle des fronts du §2.7 : un bouton tenu dix images ne donne qu'un front (E34).
7. **Déplacement.** `(x', −y')` du stick de déplacement : c'est le candidat manette de `step()` jusqu'à l'image suivante. `gr` de l'action `run` = `n ≥ .92`, avec la règle des fronts (E25) ; un stick à fond sur le côté fait donc courir aussi.
8. **Visée** (FEEL-10). Avec `[x', y', n]` du stick de visée : `s = n > 0 ? n^padCurve/n : 0` ; `hold = n > .97 ? hold + dt : 0`, puis `b = hold > .18 ? min(1, (hold − .18)/.30) : 0`, le maintien comptant **avant** `b`, dès la première image ; `px += x'·s·padYaw·(1 + padBoost·b)·lookScale·π/180·dt` ; `py += −y'·s·padPitch·lookScale·(padInvertY ? −1 : 1)·π/180·dt`. Le surcroît ne touche que le lacet ; `lookScale` ne touche ni la souris ni le clavier ; `invertY` (souris) et `padInvertY` sont indépendants (E26 à E29).
9. **Regard au clavier**, comme à l'étape 2.
10. **Fin de l'image.** Les boutons lus sont retenus pour l'image suivante (capture, `configure`), puis l'image cesse d'être calme.

**Images calmes.** L'image qui suit `clear()` et celle d'une capture manette ne donnent aucun front de manette, ni bouton, ni course au bout du stick : un bouton enfoncé y est tenu sans front, et les fronts reviennent à l'image suivante (E36). Les fronts du clavier, de la souris et des boutons virtuels n'en dépendent pas.

**Dernière manette active** (`lastPad`, mission §4.6, point 5 ; livrée à l'étape 5 avec `label` et `rumble`, qui seuls la lisent) : à chaque image, la manette active (point 4) de plus petit `index`, quelle que soit sa place dans la liste. Sans activité, la précédente reste tant qu'elle est branchée ; débranchée, ou si la lecture échoue, elle revient à `null`. Une manette rebranchée ne redevient la dernière qu'à son premier appui (E40b). Elle n'apparaît dans aucune sortie de `frame()`.

**Ce qui reste aux étapes suivantes.** `nav` à l'étape 6 ; le manche tactile à l'étape 7.

Chiffres de FEEL-10 sur le module (E26 à E28, `preuves/module-entrees/t4/manette.json`) : lacet de 0, 0, 5,4, 32,5, 76,3, 156,7, 231,6, 288,1 et 300 °/s pour une déflexion de .05, .12, .2, .35, .5, .7, .85, .95 et 1, et 0,55 fois ces valeurs sur cible ; demi-tour en 58 images de 1/120 s (483 ms) ou 29 images de 1/60 s, 600 ms sans surcroît ; visée fine de 0,09° par image à 20 % ; tangage de 190 °/s.

### 2.9 Invites, appareil, glyphes et vibrations (livrés à l'étape 5)

**Libellé d'une touche.** `keyLabel(code)`, dans cet ordre (mission §4.8 ; E39, E39b) :
1. pour un code `Key…`, le dernier libellé appris par `keyDown` : un `key` d'un seul caractère visible, mis en majuscules. Visible = un seul point de code, ni blanc, ni caractère de contrôle, de format, d'usage privé ou non attribué (`/^[^\s\p{C}]$/u`) : `' '`, `'Dead'`, `'Unidentified'`, `''`, l'espace sans chasse U+200B ou un nom de touche ne sont jamais appris, `'é'` donne `'É'` et `','` reste `','` ;
2. sinon, pour un code `Key…`, la table posée par `setLayout(map)` : `map.get(code)`, appelé comme une méthode, si `map.get` est une fonction (`KeyboardLayoutMap` de Chromium, `Map`), sinon `map[code]`. Seule une chaîne non vide compte : un seul caractère est mis en majuscules, plusieurs sont gardés tels quels ;
3. sinon `keyName(code)`. Les chiffres gardent donc leur nom : `Digit1` donne `1`, même si la touche envoie `&` en AZERTY.

`setLayout(map)` garde la référence d'un objet qui n'est pas un tableau ; toute autre valeur (`null`, chaîne, nombre, fonction, tableau) efface la table. Le libellé appris passe avant la table : la touche vue l'emporte. Les libellés appartiennent à l'instance, et `FInput.keyName` ne change pas.

**Invite d'une action.** `label(action, device = appareil actif)` (E39b, E40, E40b) :

| Appareil | Libellé |
|---|---|
| `keyboard` | `keyLabel` des touches de la table `keys` des réglages, jointes par `' / '` ; `'—'` si aucune. |
| `mouse` | `action.mouse` s'il existe, sinon le libellé clavier. |
| `touch` | `action.touch` s'il existe, sinon `action.label`. |
| `gamepad` | `glyph` des boutons de la table `pad` des réglages, au style de la dernière manette active (§2.8 ; `'generic'` sans elle), joints par `' / '` ; `'—'` si aucun. |
| autre valeur | Libellé clavier. |
| action inconnue | `'?'`, quel que soit l'appareil. |

**Glyphes.** `glyph(name, style)` (mission §4.8 ; E40b) :

| Style | A | B | X | Y | LB | RB | LT | RT | Back | Start | L3 | R3 | Up | Down | Left | Right | Home |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `xbox` | A | B | X | Y | LB | RB | LT | RT | Vue | Menu | LS | RS | ↑ | ↓ | ← | → | Xbox |
| `ps` | ✕ | ○ | □ | △ | L1 | R1 | L2 | R2 | Create | Options | L3 | R3 | ↑ | ↓ | ← | → | PS |
| `generic` | A | B | X | Y | LB | RB | LT | RT | Back | Start | L3 | R3 | ↑ | ↓ | ← | → | Home |

Un style inconnu donne les glyphes génériques, et un nom inconnu se rend lui-même. Seules les propriétés propres des tables comptent : `glyph('toString', '__proto__')` rend `'toString'`. Les flèches de la croix sont celles de `keyName`.

**Appareil au démarrage.** `guessDevice(win = global)` : `'touch'` si `win.matchMedia('(pointer: coarse)').matches`, ou si `win.navigator?.maxTouchPoints > 0` et `win.matchMedia('(hover: none)').matches` (règle de BITUME, TACT-08) ; sinon `'keyboard'`. `matchMedia` est appelé comme une méthode de la fenêtre (détaché, il lève « Illegal invocation » dans Chrome), avec ces deux requêtes dans cet ordre ; toute erreur → `'keyboard'` (E41). Un PC à écran tactile avec souris (pointeur fin, survol, 10 points de contact) donne `'keyboard'`, là où `game.js:5` passe en tactile. Ce n'est qu'une première estimation : l'appareil actif suit ensuite le dernier utilisé (§2.7, §2.8).

**Vibrations.** `rumble(strong, weak, ms, t)` → booléen (mission §4.9 ; E42, E42b) :
1. `false` si `tune.padVibration ≤ 0`, ou si `t − dernier < 40` (ms, `K.rumbleGap`). `dernier` vaut `−Infinity` au départ et n'avance qu'à un succès : un refus ou un échec ne retarde pas l'appel suivant.
2. Manette visée : la dernière manette active, sinon la première de la liste lue par la dernière image. C'est l'objet `Gamepad` de cette image, puisque Chrome en rend un neuf à chaque lecture. Avant le premier `frame()`, aucune manette.
3. `playEffect('dual-rumble', {startDelay: 0, duration, weakMagnitude, strongMagnitude})`, dans cet ordre de champs, appelé comme une méthode de l'actionneur, dans un `try`. `duration` = `ms` borné à [0 ; 5 000] ; `weakMagnitude` et `strongMagnitude` = `weak` et `strong` bornés à [0 ; 1], puis multipliés par `padVibration` ; une valeur `NaN` ou absente vaut 0, ±Infinity la borne, et aucune ne vaut `-0`. Pas de manette, pas d'actionneur, pas de `playEffect`, ou exception → `false`. Une valeur rendue qui a un `catch` (la promesse de Chrome) en reçoit un vide : un rejet n'est jamais « non traité ». Sinon `true`.

Le module ne lit aucune horloge : `t` est l'horloge du jeu, en ms. La table des vibrations de METAL est au §5 ; elle reste dans le document et dans le jeu.

### 2.10 Invariants

Établis aux étapes 2 à 5, et vérifiés par les tests (§6) :
- **Une sortie par pas.** Un deuxième pas dans la même image reçoit un regard nul et aucune impulsion ; les actions tenues restent vraies, comme dans `game.js` (E10).
- **Regard consommé par le premier pas qui suit.** Une image sans pas ne consomme rien : `pendingLook()` montre le regard en attente, et le pas suivant le rend en entier (E11).
- **Fronts verrouillés jusqu'au premier pas, puis effacés.** Un appui plus court qu'une image est vu par le premier pas (LOOP-06) : impulsion une seule fois (E07), action tenue vraie à ce pas seulement (E09).
- **Aucune sortie numérique ne vaut `-0`** (E13 ; à la manette, E24 et E32).
- **Déterminisme.** Mêmes appels avec les mêmes arguments → mêmes sorties, au bit près ; ni hasard ni horloge (E02, E06).
- **Rien n'est modifié de l'extérieur.** La config du jeu reste intacte (étape 1) ; `normalize`, `assign` et `unbind` ne modifient pas leurs arguments, et `migrate` reçoit sa propre copie ; `settings`, `configure`, les résultats d'`assign` et d'`unbind`, et ceux de `frame()` et `step()` sont des objets neufs, qu'on peut modifier sans effet (E04b, E14b, E14d, E15, E16, E18, E22). Les manettes ne sont que lues, et les fiches de `connected` et de `pads` sont des copies (E33).
- **Réglages toujours valides.** `normalize` rend des réglages complets, sans code en double, idempotents et stables après un aller-retour JSON, quoi qu'on lui donne, `migrate` qui échoue compris (E19, E22). Une réaffectation ne retire jamais en silence une touche à une autre action : elle est refusée avec le nom de l'action qui la tient (E15, E18).
- **Capture isolée du jeu.** L'appui capturé n'est ni tenu, ni un front, ni une impulsion ; il est rendu une seule fois par `frame()` (E23). À la manette, le bouton capturé reste tenu tant qu'il est enfoncé, mais ne donne ni front ni impulsion (E36, §7).
- **Lecture des manettes sans échec.** Une liste absente ou invalide, un `getGamepads` qui lève, des entrées nulles, déconnectées ou mal formées ne font jamais échouer `frame()` (E33, E33b).
- **Pas de front de manette dans une image calme** : après `clear()` et à l'image d'une capture (E36).
- **Invites toujours lisibles.** `label` rend toujours une chaîne : `'?'` pour une action inconnue, `'—'` pour une action sans touche ou sans bouton ; `keyLabel` n'apprend que des caractères visibles (E39b, E40, E40b).
- **Vibrations sans échec.** `rumble` ne lève jamais et ne laisse aucun rejet non traité ; son limiteur ne retient que les succès ; `guessDevice` non plus ne lève jamais (E41, E42, E42b).

## 3. Table METAL proposée

La table que METAL déclarera au raccord. Elle sert de fixture aux tests (`checks/finput-fixture.mjs`, `METAL_INPUT`) ; elle reste du contenu de jeu et n'entre pas dans le module. Glyphes de manette : Xbox / PlayStation.

| Action | Libellé | Type | Clavier | Manette | Tactile | Souris | Repli clavier |
|---|---|---|---|---|---|---|---|
| `forward` | Avancer | tenu | W, Z, ↑ | stick gauche | | | |
| `back` | Reculer | tenu | S, ↓ | stick gauche | | | |
| `left` | À gauche | tenu | A, Q | stick gauche | | | |
| `right` | À droite | tenu | D | stick gauche | | | |
| `turnLeft` | Tourner à gauche | tenu | ← | stick droit | | | |
| `turnRight` | Tourner à droite | tenu | → | stick droit | | | |
| `fire` | Tirer · main droite | tenu | Entrée | RT / R2 | TIR | Clic | |
| `fireLeft` | Tirer / bouclier · main gauche | tenu | C | LT / L2 | TIR G / GARDE | Clic droit | G, T, Y |
| `leftHand` | Changer la main gauche | impulsion | X | RB / R1 | | | G, T, Y |
| `sprint` | Courir | tenu | Maj G, Maj D | LS / L3, ou stick gauche à fond | | | |
| `jump` | Sauter | impulsion | **Espace** | A / ✕ | SAUT | | J |
| `dash` | Esquive | impulsion | **R** | B / ○ | ESQUIVE | | |
| `pulse` | Onde défensive | impulsion | E | LB / L1 | ONDE | | |
| `melee` | Frappe / coup de crosse | impulsion | **V** | RS / R3 | FRAPPE | | C, B, N, H |
| `interact` | Interagir | impulsion | F | X / □ | | | |
| `weaponNext` | Arme suivante | impulsion | — | Y / △ | | Molette | |
| `weapon1` | Mitraillette | impulsion | 1 | croix ↑ | | | |
| `weapon2` | Double pompe | impulsion | 2 | croix → | | | |
| `weapon3` | Lance-roquettes | impulsion | 3 | croix ↓ | | | |
| `weapon4` | Lance-grenades | impulsion | 4 | croix ← | | | G, T, Y |
| `weapon5` | Pistolet | impulsion | 5 | — | | | G, T, Y |
| `map` | Carte | impulsion | M | Vue / Create | | | |
| `pause` | Pause | impulsion | P | Menu / Options | | | |

Sticks : `move` sur le stick gauche (axes `left`/`right` et `back`/`forward`, course `sprint` au bout du stick ou du manche tactile) ; `look` sur le stick droit (axes `turnLeft`/`turnRight`, regard au clavier à 1,9 rad/s comme aujourd'hui dans `game.js`).

**Migration v1 → v2 (FEEL-09, FEEL-01).** Les réglages v1 sont les liaisons clavier actuelles de `FOptions` (`V1_KEYS` de la fixture), où Espace esquive. La fonction `migrate` de la table retire Espace de l'esquive et lui donne R si R est libre ; `normalize` affecte ensuite Espace, devenu libre, au saut. Vérifié par E22 et E21b :

| Profil v1 | Après migration |
|---|---|
| Table par défaut (`V1_KEYS`) | Exactement `defaults(M).keys` : Espace saute, R esquive, V frappe. |
| Espace et une autre touche sur l'esquive (`dash: ['Space','KeyK']`) | L'esquive garde K ; Espace saute. |
| R déjà pris (par exemple `interact: ['KeyR']`, le cas de `checks/options.test.mjs:18`) | L'esquive reste **sans touche**, à réaffecter ; Espace saute ; Interagir garde R. |
| Espace déjà ailleurs (l'esquive a été déplacée) | Rien à migrer ; le saut prend J, son repli. |
| Liaisons personnalisées (V prise par Interagir, Digit5 prise…) | Mêmes réponses que `FOptions` aujourd'hui pour toutes les autres actions (frappe sur B, pistolet sur G). |

Une table personnalisée garde ses choix, sauf Espace qui quitte l'esquive. Un profil v2 n'est jamais migré, et une erreur dans `migrate` laisse des réglages valides, sans migration. Le jeu affiche une fois le message « Espace : saut · R : esquive » quand il relit des réglages v1 (drapeau à ranger dans ses préférences) ; si l'esquive est restée sans touche, le message le dit : « Espace : saut · Esquive : à affecter (Options) ». C'est une décision à confirmer (§7).

## 4. Plan de raccord, non appliqué

Rien de ce qui suit n'est fait dans ce lot : c'est le plan du lot qui branchera FInput. Lignes citées sur la base `71eca61`.

### 4.1 `tools/build.py`, `checks/build.test.mjs`, `package.json`

- `tools/build.py` : ajouter `'input.js'` dans la liste `modules`, **juste avant `'options.js'`**. FInput ne dépend de rien ; ainsi `FOptions` peut s'en servir dès son chargement, et `game.js` le trouve. Écart : la fiche lot-08 dit « entre options.js et game.js », ce qui empêcherait `options.js` de déléguer à FInput.
- `checks/build.test.mjs` : ajouter `html.includes('FInput')` à la liste des modules présents.
- `package.json` : ajouter `checks/finput.test.mjs` au script `test`.
- Coût : la page grossit de la taille de `src/input.js` plus 3 octets (le séparateur `'\n;\n'`). Mesure exacte à l'étape 8 (`bundle-check.json`).

### 4.2 `src/options.js`

Écrit à l'étape 3, avec les réglages. Lignes de la base `71eca61` (fichier inchangé depuis).

- **Table.** `actions` (4) devient la déclaration du §3, exposée en `FOptions.inputConfig` (`{version:2, actions, sticks, migrate}`, avec la `migrate` de la fixture). `FOptions.actions` (84), lu par `game.js` (107, 108, 926), reste la liste `{id, label}` qu'on en tire ; elle gagne `jump` et `weaponNext`.
- **Rangement dans `ferro-settings`.** Recommandé : `prefs.bindings` reste la table clavier (même champ, même sens), et un champ neuf `prefs.input = {v, pad, tune}` porte la version, la table manette et les réglages de manette et de tactile. `normalize` (7) relit les deux en un appel : `const s=FInput.normalize({v:raw.input?.v??1, keys:raw.bindings, pad:raw.input?.pad, tune:{...raw.input?.tune, sensitivity:out.sensitivity, invertY:out.invertY}}, inputConfig)`, puis `out.bindings=s.keys` et `out.input={v:s.v, pad:s.pad, tune:<s.tune sans sensitivity ni invertY>}`. Un profil sans `input` est donc un profil v1, migré une fois ; la sauvegarde suivante l'écrit en v2. Écart avec la mission, qui proposait `FInput.normalize(raw.input ?? {v:1, keys:raw.bindings}, config)` avec toute la table sous `input` : `checks/options.test.mjs` (19, 31, 40, 48), `checks/input.test.mjs:124` et `checks/checkpoint.test.mjs:802` écrivent `bindings` puis relisent, et un `input` gardé d'avant l'emporterait sur leur modification.
- **`sensitivity` et `invertY`** restent des préférences de `FOptions` (bornes identiques, .25 à 3) et sont recopiés dans `tune` à chaque `normalize` ; le jeu passe `prefs` à `inp.configure` après chaque changement d'options.
- **`assign` (29)** délègue : `const r=FInput.assign(inputConfig,{v:2,keys:bindings},'keyboard',action,code)`, puis `r.ok ? {ok:true, bindings:r.settings.keys} : {ok:false, reason:r.reason, conflict:r.conflict}`. Les textes sont les mêmes (« Déjà utilisée : <label>. », « Cette touche est réservée au navigateur. », E21b).
- **`keyName` (35)** devient `FInput.keyName`, identique pour tous les codes (E38).
- **Écarts de règles entre `FOptions.normalize` (15 à 26) et `FInput.normalize`**, aucun n'est lu par `checks/options.test.mjs` :
  1. `FOptions` refuse une entrée vide (`codes.length<1`, 21) et rend alors toute la table aux défauts ; FInput accepte `[]` (action non affectée), que `unbind` produit. Conséquence au raccord : les lectures `prefs.bindings.<id>[0]` de `game.js` (130, 715, 719, 720, 721) afficheraient « undefined » (`FOptions.keyName(undefined)`), et 711 le chiffre par défaut d'une arme sans touche ; elles passent par `inp.label(id,'keyboard')` (étape 5), qui rend « — » (§4.3).
  2. Une fois sa liste préférée épuisée (18), `FOptions` prend n'importe quelle lettre ou chiffre libre ; FInput ne lit que `alt`, puis rend `[]`.
  3. `FOptions` ne complète que cinq actions ajoutées après coup (`added`, 17) ; une autre action absente reprend tous ses codes par défaut, et un doublon rend toute la table aux défauts. FInput complète toute action absente avec ses seuls codes libres, et garde donc les choix du joueur.
  4. Action inconnue dans `assign` : « Cette touche est réservée au navigateur. » chez `FOptions` (30), « Action inconnue. » chez FInput ; `game.js` n'en passe jamais.
- **Ce que `checks/options.test.mjs` devient** (E21b rejoue ses profils contre FInput) : les tests des lignes 23 à 29, 30 à 37 et 39 à 53 gardent leurs réponses (frappe sur B, pistolet sur G puis Digit6, conflit `pulse` pour E, doublon → Entrée). Le test des lignes 17 à 22 met Interagir sur R, devenu l'esquive en v2 (décision de David) : il prendra une autre touche libre (G, par exemple) dans le commit du raccord. Les autres tests du fichier (cadence, préférences) ne sont pas concernés.

### 4.3 `src/game.js`

À écrire à l'étape 10, fonction par fonction. Points d'entrée actuels : `const keys=new Set(),input=…` (ligne 20), `clearInput` (209), la fusion de `frame(now)` (783, de `input.moveX=` en 793 jusqu'à `sim.step(part,input)` en 804), les écouteurs `keydown` (888 et 914), `keyup` (934), `pointerlockchange` (946), `mousemove` (956, `.0022` par compte) et les widgets tactiles (`#move-zone`, `#fire-button`, `#left-fire-button`, `#dash-button`, `#pulse-button`, `#melee-button`, `#interact-button`, lignes 970 à 980).

Correspondances de l'étape 2 (clavier et souris), prouvées contre le vrai `game.js` par `preuves/module-entrees/t2/parite-game.mjs` (§6). Les filtres actuels de `game.js` restent devant chaque appel (mode de jeu, touches de modification, Échap et pause, champs de saisie, souris verrouillée, capture du premier clic de LOOP-10) : FInput ne connaît pas les modes du jeu.

| `game.js` (base `71eca61`) | Raccord |
|---|---|
| `keys` (20) ; `lookDX`, `lookDY`, `mouseFire`, `mouseLeftFire`, les quatre `…Queued` (21) | Remplacés par `const inp=FInput.create(config)` ; `input` (20) reste l'objet passé à `sim.step`. |
| `keydown` (914), après les filtres des lignes 922 à 925 | `if(inp.keyDown(e.code,e.timeStamp,e.repeat,e.key))e.preventDefault();` |
| `keyup` (934) | `inp.keyUp(e.code,e.timeStamp)`, sans filtre comme aujourd'hui. |
| `mousemove` (956), même condition | `inp.mouseMove(e.movementX,e.movementY,e.timeStamp)` ; `.0022` devient `mouseScale` de la déclaration ; `sensitivity` et `invertY` passent par `tune` (§4.2). |
| `mousedown` (959), mêmes conditions | Bouton 0 : `inp.button('fire',true,e.timeStamp,'mouse')` ; bouton 2 : `'fireLeft'`. |
| `endMouse` (966, `mouseup` 967), `endPointer` (968), `pointerdown` souris sans verrouillage (960) | Les mêmes relâchements, en `inp.button(…,false,…,'mouse')`. |
| `clearInput` (209) | `inp.clear()` remplace `keys.clear()`, `mouseFire=mouseLeftFire=false`, `lookDX=lookDY=0` et `…Queued=false` ; le reste de la fonction ne change pas. |
| Fusion de `frame(now)` (793 à 799) | `inp.frame(dt)` une fois par image, avant les pas (appel placé en 787, dans tous les modes : voir « Réglages, liaisons et capture » ci-dessous), puis `const p=inp.pendingLook()` pour `signals.lookYaw` et `lookPitch` (798) ; `expireFireIntents(now)` (797) reste. |
| Boucle des pas (803 à 811) | Avant chaque `sim.step(part,input)` (804) : `const s=inp.step()`, recopié dans `input` (`moveX`, `moveY`, `lookX`, `lookY`, `sprint`, `dash`, `pulse`, `melee`, `interact`), avec `input.fire=s.fire\|\|i===0&&firePressed` et de même pour `fireLeft` : l'intention de tir n'est offerte qu'au premier pas, comme en 809. Les remises à zéro de 804 et 809 deviennent inutiles. `signals.firing` prend le `fire` du premier pas (il n'est lu qu'en 833). |

Le tampon d'intention de tir de 150 ms (lot 01) reste dans `game.js` : `pressFire()` reste appelé par les écouteurs (appui non répété de `fire` ou `fireLeft`, `mousedown`), qui trouvent l'action d'un code dans la table des réglages, comme `FOptions.matches` aujourd'hui. Les changements d'arme (`switchWeapon`, `switchLeft`) et `pressFire` doivent garder leur ordre relatif, car l'intention retient l'arme du moment de l'appui : tous dans les écouteurs comme aujourd'hui, ou tous lus dans `frame().pressed`, qui garde l'ordre d'arrivée. Boutons tactiles (970 à 980, pas encore prouvés contre `game.js`) : `inp.button(id,true,t,'touch')` à l'appui et `inp.button(id,false,t,'touch')` sur `pointerup`, `pointercancel` et `lostpointercapture`, sans quoi le compteur de doigts reste tenu et l'appui suivant ne donne plus de front ; le `click` d'`#interact-button` envoie les deux à la suite (appui court, vu au premier pas).

Réglages, liaisons et capture (étape 3). `prefs` reste la source des préférences, rangées comme au §4.2 ; FInput en reçoit la part « entrées » par `inputSettings(p) = {v: p.input.v, keys: p.bindings, pad: p.input.pad, tune: {...p.input.tune, sensitivity: p.sensitivity, invertY: p.invertY}}`.

| `game.js` (base `71eca61`) | Raccord |
|---|---|
| Lecture de `ferro-settings` (7 et 8), `saveSettings` (103) | Inchangés : `FOptions.normalize` relit `bindings` et `input`. `inp` est créé avec `settings: inputSettings(prefs)`. |
| `settings()` (118 à 140) | Ajoute `inp.configure(inputSettings(prefs))` avant `saveSettings()` (139) : chaque changement d'options (sensibilité, inversion, liaisons) arrive à FInput. |
| « Réinitialiser les commandes » (893) | Remet aussi `input` aux défauts, et `inp.capture(null)` avec `bindingAction=null`. |
| Clic sur une liaison (108) | `inp.capture('keyboard')` après `bindingAction=a.id`. |
| `keydown` pendant une liaison (915 à 921) | Restent : `e.preventDefault()`, `if(e.repeat)return;` et Échap, qui fait en plus `inp.capture(null)` (918). Toute autre touche : `inp.keyDown(e.code,e.timeStamp,false,e.key)`, puis `return` ; `FOptions.assign` (919) et l'enregistrement (920) passent dans `frame`. |
| `frame(now)` (783) | `const f=inp.frame(dt)` juste après le calcul de `dt` (787), avant les retours de 788 et 789 : une fois par image présentée, dans tous les modes, car les options s'ouvrent depuis le menu comme depuis la pause. Hors du mode `playing`, seul `captured` est lu (et `nav` à l'étape 6). Si `f.captured` et `bindingAction` : `const r=inp.assign(f.captured.device,bindingAction,f.captured.code)`. Refus : `binding-status` = `r.reason+' Choisissez une autre touche, ou Échap pour annuler.'` (919), puis `inp.capture(f.captured.device)` pour l'appui suivant. Accord : `prefs.bindings=r.settings.keys`, `prefs.input.pad=r.settings.pad`, `bindingAction=null`, `settings()`, « Touche enregistrée : » suivi de `inp.keyLabel(f.captured.code)` (étape 5 : le caractère que la touche vient d'envoyer, « A » pour KeyQ en AZERTY), et le focus sur le bouton, comme en 920. |
| `setMode` (210 ; `bindingAction=null` en 214) | Rien de plus : `clearInput()` devient `inp.clear()`, qui termine aussi la capture. |
| Libellés de touches (104, 130, 711, 715, 719 à 721) | `inp.label(id,'keyboard')`, qui rend « — » pour une action sans touche (`bindingLabel`, 104, rend aujourd'hui une chaîne vide pour `[]`) ; détail par ligne dans le tableau « Invites, appareil et vibrations » ci-dessous. |

Le résultat de la capture arrive à l'image qui suit l'appui : au plus une image plus tard, 17 ms à 60 images/s. Il attend tant que `frame()` n'est pas appelé ; seuls `capture()` et `clear()` l'effacent. Les tests qui lisent `binding-status` ou `ferro-settings` juste après l'appui doivent donc faire avancer une image (§4.5). Variante sans ce délai : traiter le clavier dans `keydown` comme aujourd'hui, avec `inp.assign('keyboard',bindingAction,e.code)`, et ne garder `capture` que pour la manette. Recommandé : la même voie pour les deux appareils, avec un seul traitement des refus, et une touche capturée qui ne peut jamais atteindre le jeu. La capture manette (étape 4) passe par la même branche de `frame`, sans délai : `captured` arrive par l'image même de l'appui. Refus : `r.reason+' Choisissez un autre bouton.'`, puis `inp.capture('gamepad')` ; accord : `prefs.input.pad=r.settings.pad`, `settings()`, « Bouton enregistré : » suivi de `inp.label(id,'gamepad')` (étape 5 : l'action n'a plus que ce bouton, montré au style de la manette qui vient de servir). La liste des liaisons manette dans les options (`renderBindings`, 106 à 108) reste à écrire au raccord.

Manette (étape 4) :

| `game.js` (base `71eca61`) | Raccord |
|---|---|
| Déclaration de `inp` | `getGamepads` laissé à son défaut : FInput appelle lui-même `navigator.getGamepads()` comme une méthode. Pour un harnais, une fonction `() => liste` ; jamais `navigator.getGamepads` détaché (« Illegal invocation »). |
| `frame(now)` (783) | `inp.frame(dt,{lookScale})`, à la place de l'appel du tableau précédent : `lookScale` = .55 quand une cible est sous la mire, sinon 1. FEEL-10 : cible dans `atan((0,67 + 0,25)/d)`, vue par `sight()` de la simulation et mise en cache 100 ms ; ce calcul reste dans le jeu et sera écrit au raccord. |
| `f.connected`, `f.disconnected` | `toast('Manette connectée.')` et `toast('Manette déconnectée.')` (141) ; une déconnexion en mode `playing` met en pause (`setMode('paused')`), comme la perte du verrou de la souris (951) et la perte du focus (981). |
| `f.device` | `document.body.classList.toggle('pad',f.device==='gamepad')`, comme `touch` (6), pour le CSS et les invites (étape 5). Tant que la manette joue, ni `lock()` (243) ni `freePointerHint` (242) : on joue sans souris verrouillée, sans message de capture de la souris. |
| `input.assist` (20) | Aujourd'hui `touch`. FEEL-10 et la fiche lot-08 proposent `touch \|\| padActive`, soit `f.device==='gamepad'` ; la fiche demande aussi que le bonus de .38 m de l'arme 0 (`simulation.js:848`) ne s'active pas par la manette seule : question au §7. |
| `clearInput` (209) | `inp.clear()` : l'image suivante est calme, si bien qu'un A tenu pour valider un menu ne fait pas sauter à la reprise. |

Invites, appareil et vibrations (étape 5). Les libellés tirés de `FOptions.keyName` sont aujourd'hui en noms QWERTY (« W » et « M » sur un clavier AZERTY, dont les touches portent « Z » et « , ») et ne connaissent pas la manette ; trois textes sont figés (`preuves/module-entrees/t5/banc-depart.txt`).

| `game.js` (base `71eca61`) | Raccord |
|---|---|
| `touch` (5), calculé une fois au chargement | `const touch=FInput.guessDevice()==='touch'\|\|new URLSearchParams(location.search).get('touch')==='1'` : règle de BITUME pour la première estimation, `?touch=1` restant un forçage pour les bancs. Un PC à écran tactile avec souris n'est plus pris pour un appareil tactile (TACT-08). Ensuite, la classe `touch` (6) suit `f.device`, comme `pad` (étape 4) ; `lock()` (243, `if(touch)return;`), `input.assist` (20) et le FOV par défaut (`FOptions.defaults(touch)`, 7) cessent de dépendre de la constante : écrit au raccord (TACT-08, TACT-09). |
| `keydown` (914), même appel que pour l'étape 2 | 4e argument : `e.shiftKey?undefined:e.key`, pour que Maj ne fasse pas apprendre le second signe d'une touche de ponctuation (en AZERTY, « ? » au lieu de « , » pour KeyM ; §7, limites). |
| Après la création de `inp` | `navigator.keyboard?.getLayoutMap?.().then(m=>{inp.setLayout(m);settings();},()=>{})` : sous Chromium, la vraie table du clavier dès le chargement (en AZERTY, « Z / W / ↑ » pour avancer et « , » pour la carte), sans attendre un appui ; `settings()` refait les libellés. Firefox et Safari n'ont pas cette API : chaque lettre garde son nom QWERTY jusqu'à son premier appui, puis prend le caractère vu. |
| `bindingLabel(id)` (104), lu par `weaponHint` (105), `renderBindings` (106 à 108), le titre de `map-button` (131) et le texte d'aide (136) | `inp.label(id,'keyboard')` : les mêmes touches jointes par « / », avec les caractères vus ou ceux de la table, et « — » pour une action sans touche. |
| `interact-key` (130), `slot-key-<i>` (711), `left-hand-key` (715) | Une seule touche aujourd'hui (`[0]`). Raccord : `hint(id)`, avec `const hint=id=>inp.label(id,inp.device==='touch'?'keyboard':inp.device)` : les touches au clavier et à la souris, le glyphe à la manette (« X » ou « □ » pour Interagir), le texte clavier en tactile comme aujourd'hui. Une arme sans touche montre « — » (711 écrit aujourd'hui le chiffre par défaut, `'Digit'+(i+1)`). |
| `melee-label` (719), `dash-label` (720), `pulse-label` (721) | `hint(id).toUpperCase()` devant « · CROSSE », « · ESQUIVE PRÊTE », etc. : « V · CROSSE » au clavier, « RS · CROSSE » ou « R3 · CROSSE » à la manette. `renderHUD` (690) tourne toutes les 0,09 s (828) : une dizaine d'appels à `label` de 76 ns chacun (§6). |
| `intro-controls` (132), texte d'aide (136 ; sa version initiale est dans `index.html:52`, §4.4) | Un texte par appareil, réécrit sur `f.deviceChanged`. Au clavier, celui de 136, avec « Clic » et « Clic droit » tirés de `inp.label('fire','mouse')` et `inp.label('fireLeft','mouse')` au lieu du texte figé. À la manette, une version en glyphes construite de la même façon avec `inp.label(id,'gamepad')` (stick gauche : déplacer, stick droit : viser, puis « RT : tirer » ou « R2 : tirer », etc.). |
| Toasts figés : 262 (« clic droit : garde »), 326 (« clic droit : garde · Espace : frappe ») | `inp.label('fireLeft')+' : garde'` et `inp.label('dash')+' : frappe'`, à l'appareil actif : le coup de bouclier suit la touche d'esquive, comme en 720 (à revoir avec le lot 09). La variante tactile de 326 reste. |
| Capture des liaisons (920, et la branche `f.captured` du tableau des réglages) | « Touche enregistrée : » suivi de `inp.keyLabel(code)` ; « Bouton enregistré : » suivi de `inp.label(id,'gamepad')`. |
| Vibrations | Dans `events()` (292), à côté des impulsions de `motion` : table du §5. |

### 4.4 `src/style.css` et `src/index.html`

À compléter à l'étape 10 (`:focus-visible` avec les menus de l'étape 6, `body.pad`). Déjà relevé :
- `index.html:52` : le texte d'aide initial dit encore « Espace : esquiver · Maj : courir ». `settings()` le remplace dès le chargement, sauf en tactile (`game.js:136`), par un texte tiré des liaisons ; au raccord, la version initiale suit la v2 (« Espace : sauter · R : esquiver ») ou reste vide jusqu'à `settings()`.
- `body.pad` (§4.3, manette) : proposé pour masquer l'aide propre à la souris ; le texte de chaque invite vient de `label()`, jamais du CSS.

### 4.5 Tests à adapter au raccord

Relevé à l'étape 3 pour les réglages et la capture, puis à l'étape 4 pour la manette, lignes de la base `71eca61` ; l'étape 10 complétera la liste.
- Manette : FInput n'exige aucun bouchon. Sans `navigator.getGamepads`, ou s'il lève, `frame()` lit une liste vide (E33b) ; les `navigator` factices de `checks/input.test.mjs` (43) et de `checks/checkpoint.test.mjs` (47), qui n'ont que `maxTouchPoints`, passent donc tels quels. Pour essayer la manette à travers le jeu, ils gagneront `getGamepads: () => pads`, une liste que le test remplit (comme `fakePad` de la fixture).
- `checks/options.test.mjs`, test des lignes 17 à 22 : Interagir sur R, devenu l'esquive en v2 → G (18, 20 et 21). Essayé sur une copie de `options.js` déléguée à FInput (`raccord-options.mjs`, §6) : 12 tests sur 13 tels quels, 13 sur 13 avec ce seul changement.
- `checks/checkpoint.test.mjs`, test des lignes 665 à 676 (« Options rebind the actual interaction key… ») : R → G en 671 et 674, `'R'` → `'G'` en 675 ; et un `app.frame(100)` après les appuis capturés de 669 et 671, puisque le résultat de la capture arrive à l'image suivante (§4.3). Le refus de E (« Déjà utilisée ») ne change pas.
- `checks/checkpoint.test.mjs`, coup de bouclier et esquive sur Espace : 308 et 313 (test de la ligne 303, dont le nom dit « Space bashes »), 318 (test de 316) et 352 (test de 333). En v2, Espace saute et R esquive : `app.key('Space')` devient `app.key('KeyR')`, et le nom du test de 303 suit. Ce que fera Espace (le saut) dépend de la simulation (FEEL-09, lot 09).
- Devraient garder leurs réponses, à vérifier au raccord : `checks/input.test.mjs:124` (profil sans `input`, donc lu comme v1 et migré ; T et G ne touchent ni Espace ni R), `checks/input.test.mjs:195` et `checks/checkpoint.test.mjs:802` (réglages écrits par le jeu ou tirés de `FOptions.defaults`, donc v2).

### 4.6 Dépendances

Saut et frappe dans la simulation (FEEL-09, FEEL-01, lot 09) ; boucle à pas fixe (lot 07) ; CSS tactile (TACT-V2) ; démo (`setPilot`, DEMO-01).

## 5. Vibrations

La table de FEEL-10, traduite en appels `inp.rumble(strong, weak, ms, now)` (§2.9). Elle reste dans le document et dans le jeu, pas dans le module. Les intensités notées « a / b » sont « fort / faible » : c'est l'ordre de `rumble`, et celui que E42 vérifie avec la pompe (`rumble(.55, .35, 140, …)`). Sources dans la base `71eca61` ; le jeu lit déjà ces événements dans `events()` (`game.js:292`), où il donne leurs impulsions à `motion`.

| Événement (FEEL-10) | Source | Appel |
|---|---|---|
| Mitraillette : faible .12, 45 ms | `shot` avec `weapon === 0` (`simulation.js:1134` et `1161`) | `rumble(0, .12, 45, now)` |
| Pistolet : .18 / .05, 60 ms | `shot` avec `weapon === 4` | `rumble(.18, .05, 60, now)` |
| Pompe : .55 / .35, 140 ms | `fracture` : le tir du double pompe (arme 1, mêmes lignes) | `rumble(.55, .35, 140, now)` |
| Roquette : .6 / .3, 180 ms | `rocket` avec `owner === 'player'` (`simulation.js:990`, et `1121` quand la bouche est bloquée) | `rumble(.6, .3, 180, now)` |
| Coup reçu : fort .45 × min(1, dmg/20), 160 ms | `hurt` (`simulation.js:782`), qui ne porte pas le montant : `dmg` = baisse de `sim.state.player.hp` pendant les pas de l'image | `if(dmg>0)rumble(.45*Math.min(1,dmg/20), 0, 160, now)` |
| Blocage : faible .4, 70 ms | `shieldBlock` (`simulation.js:779`) | `rumble(0, .4, 70, now)` |
| Explosion : .7 × (1 − d/12), 250 ms | `explosion` (`simulation.js:936`) ; `d` = distance au joueur, déjà calculée en `game.js:302` | `if(d<12)rumble(.7*(1-d/12), .7*(1-d/12), 250, now)` |
| Atterrissage dur : .35, 90 ms | `land` avec `actor === 'player'` et `hard` (`impact > 9`, `simulation.js:332`) | `rumble(.35, .35, 90, now)` |
| Impact de colosse : .8, 300 ms | `bossImpact` (`simulation.js:1715`) | `rumble(.8, .8, 300, now)` |

Règles du côté du jeu (propositions, à écrire au raccord) :
- `now` est l'horloge des images en ms (le `now` de `frame(now)`, `game.js:783`), jamais le temps de la simulation : le limiteur de 40 ms compte en temps réel.
- Les événements d'une image arrivent ensemble dans `events()`, après les pas. Le jeu garde l'effet le plus fort de l'image (plus grand `max(strong, weak)`) et fait **un seul** appel : à 60 images/s, le limiteur laisse passer un effet toutes les trois images (50 ms), et un tir de mitraillette n'efface jamais l'explosion de la même image.
- Un effet refusé par le limiteur est perdu. Pour qu'une explosion qui suit d'une image un tir de mitraillette ne le soit pas, le jeu peut garder l'effet refusé le plus fort et le redemander aux images suivantes, tant que sa durée n'est pas écoulée (question au §7).
- Seulement quand `f.device === 'gamepad'` : une manette posée sur le bureau ne vibre pas pendant qu'on joue à la souris.
- Réglage du joueur : `tune.padVibration`, de 0 à 1 (FEEL-10 : « option on/off » ; 0 coupe tout). Safari n'a pas `vibrationActuator` : `rumble` y rend `false`, sans erreur.
- Lance-grenades (`grenadeLaunch`, arme 3) : absent de FEEL-10. Proposé : pas de vibration au départ, l'explosion vibrera (question au §7).
- `hurt` sans montant : la baisse de `hp` sur l'image regroupe tous les coups de l'image, ce qui convient au calcul de FEEL-10. Plus simple au lot de la simulation : `emit('hurt',{amount})` (782), hors de ce lot.
- Explosion, atterrissage dur et impact de colosse n'ont qu'une intensité dans FEEL-10 : la même valeur sur les deux moteurs, à confirmer sur une vraie manette (§7).

## 6. Mesures et preuves

Étape 1 :
- `docs/chantier-moteur/preuves/module-entrees/etat-initial.md` : base `71eca61`, absence du module, référence `npm test` (Spark : 470 tests, 462 réussis, 8 échecs connus de `checks/campaign-world.test.mjs` ; `checks/build.test.mjs` à part : PASS, 812 696 octets).
- `node --test checks/finput.test.mjs` : E01 (chargement, seul `FInput` ajouté au global, constantes gelées), E02 (source propre, contrôles de `build.py` et de `build.test.mjs` compris), E03 et E03b (validation de la déclaration, config intacte), E38 (`keyName` = `FOptions.keyName`).
- `npm test` après l'étape 1, sur le Spark : identique à la référence (470 tests, 462 réussis, les mêmes 8 échecs) ; `checks/build.test.mjs` : PASS, `dist/index.html` inchangé (812 696 octets, sha256 `4587dc49…`). Les nouveaux tests n'entrent dans `npm test` qu'au raccord.
- `src/input.js` : 6 427 octets à l'étape 1 (2 770 en gzip -9), pour 18 000 au plus.
- Contre-épreuve des tests de l'étape 1 : 14 mutations du module (contrôle d'unicité des ids ou des codes retiré, axes qui acceptent une impulsion, `TUNE` non gelé, global en plus, mot du jeu en commentaire, `keyName` sans contrôle des clés propres, `rate` accepté sur `move`, doublon dans un stick, longueur des listes, appareil, `Home` accepté, préfixe des erreurs, valeur de `TUNE`) font toutes échouer au moins un test ; le module intact les passe tous.

Étape 2 (preuves sous `docs/chantier-moteur/preuves/module-entrees/t2/`) :
- Banc de départ (`banc-depart.txt`) : l'instance de l'étape 1 n'a aucun membre ; `game.js` 793 à 799 et 956 donnent la formule de l'annexe B ; le banc TACT de l'audit (`bancs/tact/equiv.mjs`) redonne ses chiffres : même structure `input` au clavier et au tactile, manette du prototype égale au clavier + Maj, empreintes égales.
- `node --test checks/finput.test.mjs` (`tests.txt`) : 20 tests, 20 réussis, sur le Mac et sur le Spark. Nouveaux : E04 et E04b (réglages), E05 (AZERTY et QWERTY), E06 (parité), E07 à E14 (fronts, répétition, verrou, deux pas, image sans pas, `clear`, `-0`, sources virtuelles), E14b à E14d (forme des sorties, appareil actif et filtre de 800 ms, `configure`).
- E06 : 600 images, graine 7, `dt` tiré dans [1/144 ; 1/30], un pas par image, 13 touches et 0 à 3 mouvements de souris par image, 11 champs comparés à l'annexe B au bit près après normalisation de `-0`, en deux variantes (sensibilité 1, puis 1,7 et `invertY` par `configure`) : 0 écart. Les fronts de `frame()` sont ceux des appuis, dans l'ordre d'arrivée ; `pendingLook()` vaut 0 après chaque pas. Couverture vérifiée par le test : au moins 20 pas vrais et 20 faux par champ booléen, au moins 3 valeurs par champ numérique, au moins 50 images où le regard au clavier et la souris se cumulent, au moins 50 images à plusieurs fronts.
- Contre le vrai `game.js` (`parite-game.mjs`, résultat `parite-game.json`, 12 s) : deux sessions de 900 images (graines 11 et 12 ; sensibilité 1, puis 1,7 et `invertY`), 18 touches de la table actuelle, les deux boutons de souris et la souris verrouillée, `game.js` dans le harnais LOOP de l'audit. 2 874 pas comparés, dont 1 081 images à deux pas (STAB-V1) et 7 images coupées par un changement de mode ; 10 ouvertures de boutique avec `clearInput` → `inp.clear()` et 93 répétitions de touches tenues : **0 écart** sur les 11 champs. Rejeu de chaque flux dans une simulation neuve : empreinte de session = rejeu du flux de `game.js` = rejeu du flux de FInput, pour les deux sessions. Le tampon de tir de 150 ms est mis à 0 dans la copie en mémoire (§4.3).
- Contre-épreuve (`mutations.mjs`, `mutations.txt`) : 38 mutations du module (ordre de calcul du regard, verrous, fronts, `clear`, filtre de 800 ms, bornes de `dt`, valeurs non finies, table des touches, `tune`, copies, ordre des clés, appareil) font toutes échouer au moins un test ; le module intact les passe tous. Le produit `mouseScale·sensitivity` calculé d'avance n'est vu que par E06 : la parité au bit près protège l'ordre des opérations.
- Coût indicatif (`cout.mjs`, `cout.json`), domaine principal de Node, Mac arm64 : médiane de 963 à 980 ns par image (événements, `frame()`, 1,33 pas en moyenne), sur 5 séries de 100 000 images.
- Taille : `src/input.js` 11 000 octets (4 612 en gzip -9), pour 18 000 au plus.
- Assemblage (`assemblage.txt`) : `python3 tools/build.py` sur une copie de l'arbre de travail redonne `dist/index.html` et `SIZE.json` identiques octet pour octet (812 696 octets, sha256 `4587dc49…`) ; `checks/build.test.mjs` : PASS.
- `npm test` sur le Spark (`npm-test.txt`) : 470 tests, 462 réussis, les mêmes 8 échecs connus de `checks/campaign-world.test.mjs`.

Étape 3 (preuves sous `docs/chantier-moteur/preuves/module-entrees/t3/`) :
- Banc de départ (`banc-depart.txt`) : à `538e16d`, ni `assign`, ni `unbind`, ni `capture` ; `normalize` ignore la table `pad` stockée et `migrate`, n'a pas de repli `alt`, et un profil v1 garde Espace sur l'esquive, sans touche de saut. Les tests de l'étape 3 contre ce module : 21 réussis sur 31 (E15 à E19, E21 à E23, E18b et E21b échouent ; E20 passe déjà, les bornes de `tune` datent de l'étape 2). `checks/options.test.mjs` : 13 sur 13.
- `node --test checks/finput.test.mjs` (`tests.txt`) : 31 tests, 31 réussis, sur le Mac et sur le Spark. Nouveaux : E15 à E23, E18b et E21b.
- Réponses avant et après, dans le domaine principal de Node (`reglages.mjs`, `reglages.json`) : Interagir ← R refusé, « Déjà utilisée : Esquive. » ; manette, saut ← X : « Déjà utilisé : Interagir. » ; `Home` et `Z9` refusés avec leur texte ; profil v1 → exactement `defaults(M)` (avant : esquive sur Espace, saut sans touche) ; `migrate` appelée 0 fois pour un profil v2 et 1 fois pour un v1 (avant : 0 et 0) ; frappe absente avec V prise → B, pistolet absent avec 5 pris → G (avant : `[]` et `[]`) ; `{pad:{fire:['RB']}}` → RB (avant : RT) ; capture puis G → `keyDown` rend `true` et `captured` vaut `{device:'keyboard', code:'KeyG'}`. E19 : 13 profils sur 13 idempotents et stables en JSON, avant comme après.
- Contre-épreuve (`mutations.mjs`, `mutations.txt`) : 42 mutations du code de l'étape 3 (`migrate` jamais appelée, toujours, ou à la version courante ; `from` non entier ; argument et résultat de `migrate` non copiés ; résultat pris même s'il n'est pas un objet ; `migrate` hors du `try` ; entrée `null` ; clés inconnues gardées ; replis `alt` ignorés, à la manette, multiples, prioritaires, ou pris dès qu'un code par défaut manque ; codes attribués non comptés ; table `pad` ignorée ou trop permissive ; ordre des contrôles ; appareil inconnu traité comme la manette ; textes ; conflit ignoré, lu sur les réglages bruts ou avec l'action elle-même ; argument modifié ; ajout au lieu de remplacement ; `unbind` sans effet ; réglages de la déclaration au lieu de ceux de l'instance ; `assign` d'instance qui applique son résultat ; capture qui laisse passer la touche, jamais finie, qui prend une répétition ou un code qui n'est pas une chaîne ; appareil actif ; résultat jamais rendu ou rendu à chaque image ; nouvelle capture ou `clear` qui gardent l'ancienne) : toutes détectées ; le module intact passe tout. Les 38 mutations de l'étape 2, rejouées sur ce code avec cinq ancres déplacées (`mutations-etape2.mjs`, `mutations-etape2.txt`) : 38 détectées sur 38.
- Coût par image, apparié (`cout-apparie.mjs`, `cout.json`) : même image que `t2/cout.mjs`, dans le domaine principal de Node, 10 paires de séries de 100 000 images dans un ordre alterné, avant et après dans le même processus : médiane de 1 321,7 ns avant et 1 344,4 ns après (rapport 1,017). Les séries se recouvrent (1 224 à 1 364 ns avant, 1 259 à 1 726 ns après) ; un passage précédent du même script donnait 1 121,7 et 1 124,1 ns (rapport 1,002). Par image, l'étape 3 n'ajoute qu'un test dans `keyDown` et un champ dans `frame()`. `normalize` d'un profil v1 : 15,9 µs avant, 24,6 µs après (migration, replis) ; il n'est appelé qu'au chargement des réglages et à chaque `configure`.
- Raccord de `src/options.js` essayé en mémoire, sans rien écrire dans le dépôt (`raccord-options.mjs`, `raccord-options.json`) : `options.js` délégué à FInput comme au §4.2 (8 296 octets pour la copie de l'essai, déclaration METAL comprise ; 7 108 aujourd'hui), placé derrière `src/input.js` comme le fera `build.py`. `checks/options.test.mjs` : 12 sur 13 tel quel (seul échec : « Rebinding changes the real input map… », Interagir sur R), 13 sur 13 avec Interagir sur G. Un profil v1 d'aujourd'hui donne esquive R, saut Espace et `input.v` 2, et se relit à l'identique après un aller-retour JSON ; un profil v2 n'est pas migré (l'esquive y garde Espace) ; `padYaw` 420 est gardé ; `sensitivity` reste hors de `input` ; 23 actions.
- Taille : `src/input.js` 13 255 octets (5 468 en gzip -9, même mesure qu'à l'étape 2), pour 18 000 au plus.
- Assemblage (`assemblage.txt`) : sur une copie, `dist/index.html` et `SIZE.json` identiques octet pour octet (812 696 octets, sha256 `4587dc49…`) ; `checks/build.test.mjs` : PASS.
- `npm test` sur le Spark (`npm-test.txt`) : 470 tests, 462 réussis, les mêmes 8 échecs connus ; sur la même copie, `checks/finput.test.mjs` et `checks/options.test.mjs` : 44 sur 44.

Étape 4 (preuves sous `docs/chantier-moteur/preuves/module-entrees/t4/`) :
- Banc de départ (`banc-depart.txt`) : le banc FEEL-10 de l'audit (`bancs/feel/gamepad-map.mjs`, le prototype) redonne ses chiffres : lacet de 5,4, 76,3, 156,7 et 300 °/s à 20, 50, 70 et 100 %, demi-tour en 483 ms (600 sans surcroît), 0,090° par image à 20 %, 2,63 m/s au stick à 55 %, 7,60 m/s à fond, 90,8° de lacet après 2 s à 40 %. À `f36e318`, `radial` et `padStyle` sont vides et `frame()` ne lit aucune manette : tout vaut 0, `null` ou faux. Les tests de l'étape 4 contre ce module : 31 réussis sur 47 (E24 à E37, E33b et E34b échouent).
- `node --test checks/finput.test.mjs` (`tests.txt`) : 47 tests, 47 réussis, sur le Mac et sur le Spark. Nouveaux : E24 à E37, E33b et E34b.
- Chiffres de FEEL-10 avant et après (`manette.mjs`, `manette.json`), FInput dans le domaine principal de Node : après, les valeurs du prototype au dixième près (lacet, 0,55 fois sur cible, demi-tour en 58 images de 1/120 s et 29 de 1/60 s, soit 483,3 ms, 600 ms sans surcroît, visée fine de 0,09° par image, tangage de 190 °/s et −190 avec `padInvertY`) ; stick gauche à 55 % → `moveY` 0,487805 ; course fausse à .90 et vraie à .91 ; RT .25, .31, .20, .17, .29, .31 → `fire` faux, vrai, vrai, faux, faux, vrai, fronts aux images 2 et 6 ; branchement → `connected` puis `disconnected` une fois chacun. La vraie simulation, nourrie par `step()` (chargeur de l'audit `bancs/feel/load.mjs`), donne les mêmes 2,63 m/s, 7,60 m/s et 90,8° que le prototype. Avant : 0 partout.
- Session appariée avec le prototype (`manette.mjs`) : 600 images, graine 4, `dt` tiré dans [1/144 ; 1/30], les deux sticks, RT, LT et L3 tirés au hasard, stick droit à fond 60 images sur 120 (247 images avec surcroît) ; sur `moveX`, `moveY`, `lookX`, `lookY`, `fire`, `fireLeft` et `sprint` : 0 écart booléen, écart numérique d'au plus 5,6e-17 en absolu et 3,7e-16 en relatif (ordre des multiplications).
- Contre-épreuve (`mutations.mjs`, `mutations.txt`) : 73 mutations, dont 68 du code de l'étape 4 (remise à l'échelle, borne, direction et `-0` de `radial` ; `padStyle` ; `getGamepads` détaché, ignoré ou hors du `try` ; entrées qui ne sont pas des objets ou déconnectées ; clé sans `id`, index sans repli ; boutons en nombre, `pressed` et seuil de .5 ; gâchettes lues comme des boutons, sans maximum, sans hystérésis ou à seuils inclus ; activité sans `pressed`, à toute valeur, sur un axe signé ou sur tous les axes, appareil jamais manette ; `swapSticks` ignoré, zones mortes échangées, dernière ou première manette au lieu de la plus forte, rôle de visée, axe non fini ; `connected` à chaque image, `disconnected` jamais rendu, manettes vues jamais mises à jour, fiches partagées, `standard` toujours vrai ; capture de `Home`, d'un bouton déjà tenu, avec fronts, jamais finie ; image calme jamais levée, boutons précédents jamais retenus ; valeur sans zone morte, bouton ordinaire à 0, premier bouton seul ; fronts de manette absents ou dans l'image calme ; avant négatif ; course absente, à .90 ou avec fronts dans l'image calme ; visée sans courbe, maintien compté après la rampe ou dès .90, surcroît au tangage ou ignoré, `lookScale` ignoré, appliqué au clavier ou non fini ; `padInvertY` ignoré ou remplacé par `invertY`, signe du tangage ; `configure` sans boutons tenus ou sans la table `pad` ; `clear` qui garde boutons, déplacement, maintien ou fronts), et les 5 mutations des étapes 2 et 3 dont l'ancre a bougé : toutes détectées ; le module intact passe tout. Les suites des étapes 2 et 3, rejouées telles quelles (`rejeu-mutations-etapes-2-3.txt`), détectent toutes leurs autres mutations. Une exécution sur trente environ du lanceur compte le fichier entier comme un seul test échoué, sans nom de test : une telle exécution est relancée (une fois dans `mutations.txt`, deux mutations dans le rejeu, chacune détectée ensuite trois fois sur trois).
- Coût par image, apparié (`cout-apparie.mjs`, `cout.json`) : l'image du §7.2 de la mission sans le tactile (W appuyée toutes les 7 images, un mouvement de souris, `frame(1/60)`, un pas, ou deux une image sur trois), avec une manette dont les deux sticks, RT et A changent à chaque image, ou avec une liste vide ; avant et après dans le même processus, 10 tours de 100 000 images par cas, ordre alterné. `cout.json` : médiane de 1 087,7 ns avant et 1 839,8 ns après avec une manette (+752 ns), 1 092,0 et 1 463,8 ns sans manette (+372 ns, la lecture seule). Trois autres passages, le Mac chargé par d'autres travaux (charge de 3 à 6) : +629, +1 393 et +2 602 ns avec manette, +362, +630 et +1 286 ns sans. Toujours très loin des 20 000 ns par image de la mission (§7.2).
- Taille : `src/input.js` 16 681 octets (6 961 en gzip -9), pour 18 000 au plus : l'étape 4 ajoute 3 426 octets (§7, budget).
- Assemblage (`assemblage.txt`) : sur une copie, `dist/index.html` et `SIZE.json` identiques octet pour octet (812 696 octets, sha256 `4587dc49…`) ; `checks/build.test.mjs` : PASS.
- `npm test` sur le Spark (`npm-test.txt`) : 470 tests, 462 réussis, les mêmes 8 échecs connus ; sur la même copie, `checks/finput.test.mjs` et `checks/options.test.mjs` : 60 sur 60.

Étape 5 (preuves sous `docs/chantier-moteur/preuves/module-entrees/t5/`) :
- Banc de départ (`banc-depart.txt`) : l'inventaire du plan trouve 11 occurrences sur 10 lignes, dont 8 libellés tirés de `FOptions.keyName`, toujours en noms QWERTY (`game.js` 130, 711, 715, 719, 720 deux fois, 721 et 920), et 3 textes figés (« clic droit : garde » en 262 et 326, « Espace : esquiver » dans `index.html:52`). À `6b4e98c`, `glyph` et `guessDevice` sont vides ; l'instance n'a ni `keyLabel`, ni `setLayout`, ni `label`, ni `rumble`, et `keyDown` ignore `key` ; aucun fichier de `src` ne fait vibrer une manette. Même machine, deux règles : un PC à écran tactile avec souris est tactile pour `game.js:5`, clavier pour `guessDevice`. Les tests de l'étape 5 contre ce module : 47 réussis sur 54 (E39 à E42, E39b, E40b et E42b échouent, chacun pour la raison attendue) ; E38 passait déjà.
- `node --test checks/finput.test.mjs` (`tests.txt`) : 54 tests, 54 réussis, sur le Mac et sur le Spark. Nouveaux : E39 à E42, E39b, E40b et E42b. Les cas de la mission y sont tels quels (E39 à E42) ; les tests « b » ajoutent les règles du §2.9 et les cas limites (caractères non appris, ordre appris puis table, table appelée comme une méthode, propriétés héritées, index le plus bas, débranchement, bornes, limiteur au seul succès, manette visée).
- Invites des 23 actions (`invites.mjs`, `invites.json`), FInput et `src/options.js` dans le domaine principal de Node : `FInput.keyName` = `FOptions.keyName` sur les 14 codes de E38. Clavier AZERTY, chaque lettre appuyée une fois : avancer « Z / W / ↑ », aller à gauche « Q / A », carte « , », là où le jeu écrit « W », « A » et « M » ; les chiffres restent 1 à 5. Souris : « Clic », « Clic droit », « Molette ». Tactile : les textes de la table, sinon le libellé. Manette : « A », « B », « Vue », « Menu », « LS »… en Xbox ; « ✕ », « ○ », « □ », « △ », « Create », « Options », « L3 »… en PlayStation ; noms génériques sinon ; « — » pour les actions sans bouton.
- Vrai navigateur (`chrome.mjs`, `chrome.json`) : Chrome 157 sans interface, piloté par tube (`bancs/tact/cdp.mjs`, aucun port, réseau coupé), page `file://` qui charge `src/input.js` tel quel. `guessDevice()` → `'keyboard'` sur le bureau (pointeur fin, survol, 0 point de contact), `'touch'` sous émulation mobile et tactile (pointeur grossier, pas de survol, 5 points). Un vrai `keydown` (code KeyW, key « z ») passé à `keyDown` → `keyLabel('KeyW')` = « Z », et KeyM avec « , » → « , » ; avancer vaut alors « Z / Z / ↑ » (KeyZ pas encore vue, nom QWERTY). `navigator.keyboard.getLayoutMap()` (50 touches ; le Mac de l'essai est en AZERTY), passé à `setLayout` sur une instance neuve : « A » pour KeyQ, « , » pour KeyM, avancer « Z / W / ↑ », sans aucun appui ; la vraie `KeyboardLayoutMap` est bien lue par un appel de méthode. Avec le vrai `navigator.getGamepads()` (8 `null`) : `frame()` ne voit aucune manette et `rumble` rend `false`, sans exception ; aucune exception dans la page.
- Comportement des étapes 1 à 4 inchangé par le resserrement du source (`differentiel.mjs`, `differentiel.json`, `differentiel.txt`) : 400 sessions de 300 appels tirés d'une graine, jouées en miroir sur le module de `6b4e98c` et sur celui de ce commit dans le domaine principal de Node, avec les mêmes manettes simulées (branchements et débranchements, listes invalides, `getGamepads` qui lève), plus les fonctions statiques et 44 déclarations invalides : 264 218 sorties comparées au bit près (`-0`, `NaN`, `undefined` distingués), **0 écart**, hors des cinq messages d'erreur raccourcis (préfixe « FInput : » et fautif gardés, 40 rapprochements). Le banc est sensible : cinq changements plantés (seuil de gâchette, appareil actif, `clear()`, un message, annonce de connexion) donnent chacun de 15 à 5 708 écarts.
- Contre-épreuve (`mutations.mjs`, `mutations.txt`) : 74 mutations, dont 71 du code de l'étape 5 (glyphes de chaque style, flèches, style ou nom hérités ; `guessDevice` détaché, sans l'une de ses requêtes, à plus d'un point de contact, hors du `try`, sans fenêtre par défaut ; libellé appris ignoré ou lu après la table, majuscules, `get` détaché, chaîne vide ou non-chaîne acceptées, table lue pour tout code ; espace, caractère invisible ou demi-caractère appris, apprentissage absent pendant la capture ou sur une répétition, dernière touche qui ne remplace pas ; `setLayout` qui garde toute valeur ou n'efface jamais ; séparateur, « — », « ? », style de la manette, repli tactile et souris, appareil par défaut, tables de la déclaration au lieu des réglages, appareil inconnu ; dernière manette jamais remise à `null`, retenue sans activité, prise à sa place dans la liste, à l'index le plus haut ou la dernière lue ; `rumble` sans limiteur, à 40 ms inclus ou 50 ms, sans `padVibration` ou à 0 accepté, moteurs échangés, ordre des champs, durée et intensités non bornées ou bornées à 1 000 ms, `NaN` et négatifs gardés, limiteur avancé avant l'appel ou jamais, rejet non traité, hors du `try`, toujours la première manette ou sans repli, objets de la première image, type d'effet, délai de départ, limiteur initial à 0), et les 3 mutations des étapes 2 à 4 dont l'ancre a bougé : toutes détectées ; le module intact passe tout. Trois survivaient au premier passage (`glyph` qui lit le style hérité, un point de contact qui ne suffit pas, `setLayout` qui garde une fonction ou un tableau) : trois assertions ajoutées à E39b, E40b et E41 les détectent. Les suites des étapes 2 à 4, rejouées telles quelles (`rejeu-mutations-etapes-2-4.txt`) : seules ces trois ancres ont été perdues au resserrement, et toutes les autres mutations sont détectées. Deux passages précédents ont de nouveau rendu des statuts 1 sans nom de test (défaut connu du lanceur, étape 4 ci-dessus) ; le passage retenu n'en a aucun, et les deux mutations touchées, lancées seules, sont détectées 6 fois sur 6 et 24 fois sur 24.
- Coût par image, apparié (`t4/cout-apparie.mjs` rejoué entre `6b4e98c` et ce commit, `cout.json`) : médiane de 2 226,2 ns avant et 2 258,6 ns après avec une manette (+32 ns, dans le bruit : séries de 1 962 à 2 249 ns avant, de 2 165 à 2 349 ns après), 1 758,8 et 1 758,9 ns sans manette. Le Mac était plus chargé qu'au passage de l'étape 4 (1 840 ns pour le même code « après étape 4 ») : seule la comparaison appariée compte. Par image, l'étape 5 ajoute l'activité par manette, la plus petite active et la table des objets lus.
- Coût des nouveaux appels, après seulement (`cout-invites.mjs`, `cout-invites.json`) : `label()` 76 ns par appel (23 actions sur les quatre appareils, clavier AZERTY appris, manette PlayStation), `rumble()` 10 ns (un appel sur deux passe le limiteur, actionneur qui ne fait rien).
- Taille : `src/input.js` 16 253 octets (6 713 en gzip -9), pour 18 000 au plus. L'étape 5 ajoute ses fonctions et resserre les commentaires (31 lignes et 2 630 octets → 8 lignes et 582 octets), les messages et les lignes des étapes 1 à 4 : 428 octets de moins qu'à l'étape 4, et 1 747 de marge (§7, budget).
- Assemblage (`assemblage.txt`) : sur une copie, `dist/index.html` et `SIZE.json` identiques octet pour octet (812 696 octets, sha256 `4587dc49…`) ; `checks/build.test.mjs` : PASS.
- `npm test` sur le Spark (`npm-test.txt`) : 470 tests, 462 réussis, les mêmes 8 échecs connus ; sur la même copie, `checks/finput.test.mjs` et `checks/options.test.mjs` : 67 sur 67.

À venir : coût par image dans le domaine principal de Node (`tools/finput-bench.mjs`, `bench.json`), assemblage simulé (`tools/finput-bundle-check.mjs`, `bundle-check.json`), page d'essai de la mission dans Chrome sans tête (`navigateur.html`, `navigateur-resultat.txt`), `npm test` final (`npm-test-apres.txt`), et FEEL-11 (menus) et TACT vérifiés par les tests E43 à E50.

## 7. Limites et questions ouvertes

Questions pour David (valeur par défaut entre parenthèses) :
- Croix et Back : la croix n'a que quatre directions pour les armes 1 à 4, et le pistolet (arme 5) n'a pas de bouton direct ; il reste accessible par Y (arme suivante). (Table du §3.)
- Menus : ordre linéaire, comme BITUME, ou navigation spatiale (FEEL-11) ? (Ordre linéaire, défaut de la fiche lot-08.)
- Bonus d'aide à la visée de .38 m de l'arme 0 quand la manette est active (`simulation.js`, `input.assist`) : FEEL-10 et la fiche lot-08 proposent `input.assist = touch || padActive`. (Fiche : le bonus de .38 m réservé au tactile, jamais activé par la manette seule.)
- Budget de 18 000 octets de `src/input.js` (E02) : le resserrement prévu à l'étape 4 est fait. À l'étape 5, commentaires (2 630 → 582 octets), messages et lignes des étapes 1 à 4 ont été resserrés sans changer le comportement (preuve différentielle, §6) : le module fait 16 253 octets, invites et vibrations comprises, et il en reste 1 747. Les étapes 6 et 7 (`nav` avec répétition et `focusMove` ; manche flottant, zone de visée, bouton-visée, accélération et `setPilot`) en demandent environ 3 000 à 3 800, estimés sur le code compact de l'étape 5 : il manquera de 1 300 à 2 000 octets. Il n'y a plus de commentaire à retirer ; resserrer encore voudrait dire raccourcir les noms et fondre des fonctions, au prix de la lisibilité, avec la même preuve différentielle à chaque fois. (Relever le plafond de E02 à 20 000 octets à l'étape 7, mesure à l'appui, avec l'accord de David ; la page grossirait d'autant : 16 253 octets aujourd'hui, soit 2 % de `dist/index.html`.)
- Manette non standard (`mapping` vide) : lue par index, comme le veut la mission, ou ses sticks ignorés ? Sur certains pilotes, les axes 2 et 3 sont des gâchettes au repos à −1 : la vue tournerait seule. (Lue par index ; à vérifier sur du vrai matériel, §7, limites.)
- Déblocage du son par un bouton de manette. (Oui, avec « A : activer le son » si le contexte reste suspendu.)
- Signes du gyroscope, à valider sur appareil (iOS et Android diffèrent).
- Impulsion affectée à plusieurs touches : un front quand l'action passe de relâchée à tenue (FInput), ou un par `keydown` non répété de chacune de ses touches (`game.js` aujourd'hui) ? (Un par action, ci-dessous.)
- Profil v1 où R est déjà pris (Interagir sur R, par exemple) : l'esquive reste sans touche et Interagir garde R ; ou bien R passe à l'esquive et Interagir reprend une touche libre ? (L'esquive sans touche : un choix du joueur n'est jamais retiré en silence, et le message le dit, §3.)
- Message affiché une fois après la migration d'un profil v1 : « Espace : saut · R : esquive », ou « Espace : saut · Esquive : à affecter (Options) » si l'esquive est restée sans touche. (Ces deux textes, avec un drapeau rangé dans les préférences du jeu.)
- Vibrations à une seule intensité dans FEEL-10 (explosion, atterrissage dur, impact de colosse) : la même valeur sur les deux moteurs, ou le seul moteur fort ? (Les deux moteurs, à régler sur une vraie manette ; §5.)
- Lance-grenades, absent de FEEL-10 : une vibration au départ du projectile ? (Aucune : l'explosion vibrera.)
- Limiteur de 40 ms : un effet fort qui suit de moins de 40 ms un effet faible est refusé. Le jeu le redemande-t-il aux images suivantes ? (Oui : il garde l'effet refusé le plus fort et le redemande tant que sa durée n'est pas écoulée, §5.)
- Vibrer quand la manette est branchée mais que l'on joue au clavier ou à la souris ? (Non : seulement quand l'appareil actif est la manette, §5.)
- Glyphe de Back en style PlayStation : « Create » (DualSense, PS5), comme le veut la mission ; une DualShock 4 (PS4) porte « Share ». Les distinguer par l'`id` (produits `05c4` et `09cc`) coûterait une ligne. (« Create » pour toutes, comme la mission.)

Écarts relevés entre les sources (la mission du module suit les valeurs mesurées) :
- Point d'insertion dans `build.py` : avant `options.js` ici, « entre options.js et game.js » dans la fiche lot-08 (§4.1).
- Seuil du surcroît de lacet : « r > 0,95 » dans la fiche lot-08 T1 ; .97 dans le prototype mesuré (`bancs/feel/gamepad-map.mjs`), dans la mission et dans le module. Avec .95, le maintien commencerait dès 95 % de déflexion ; les chiffres de FEEL-10 (demi-tour en 483 ms) sont ceux de .97.
- E35, points 4 à 6 : la mission appelle `stickDown`, qui n'existe qu'à l'étape 7. Le test pose l'appareil tactile par `button(…, 'touch')`, qui retient le même horodatage pour le filtre de 800 ms ; la version avec `stickDown` sera écrite à l'étape 7, le fichier de tests restant vert à chaque commit.
- `lastPad` (mission, §4.6, point 5) : reporté de l'étape 4 à l'étape 5 et livré avec `rumble` et `label`, qui sont les seuls à le lire (§2.8) ; il n'apparaît dans aucune sortie de `frame()`.
- Vibrations : la mission (§7.3) recopie la table de FEEL-10 sans les moteurs ; FEEL-10 les précise (« faible » pour la mitraillette et le blocage, « fort » pour le coup reçu). Les intensités « a / b » se lisent fort / faible, l'ordre de `rumble` (§5).
- API : `FGamepad.create(prefs).poll(dt, ctx)` (FEEL-10, lot-08 T1) devient `FInput.create(config)`, puis `frame(dt, ctx)` à chaque image et `step()` à chaque pas.
- Pas de temps : la contre-vérification de TACT-09 conseillait de garder le pas variable ; `MASTER-PROMPT.md` §6 a tranché pour le pas fixe de 1/60 s (lot 07). FInput sert les deux : une sortie par pas, et le regard en attente pour la caméra.
- LOOP-07 : zones mortes .18/.12, courbe r^2,2, 241°/s et A = esquive, remplacés par FEEL-10 (A = saut, B = esquive).
- Rangement des réglages : la mission proposait `FInput.normalize(raw.input ?? {v:1, keys:raw.bindings}, config)`, avec toute la table sous `input`. Le document garde `bindings` pour le clavier et ajoute `input = {v, pad, tune}` (§4.2), parce que trois fichiers de tests écrivent `bindings` puis relisent, et qu'un `input` gardé d'avant l'emporterait sur leur modification.

Écarts voulus avec `game.js` (étape 2 ; hors de ces cas, la parité est prouvée au §6) :
- Appui plus court qu'une image (LOOP-06) : vu au premier pas, pour les actions tenues aussi (tir, garde, course). `game.js` le perd, sauf l'intention de tir de 150 ms pour une arme à feu (E09 ; une impulsion courte est déjà vue aujourd'hui, E07). Les sessions de `parite-game.mjs` n'ont qu'une transition par touche et par image, donc aucun appui de ce genre.
- Impulsion à plusieurs touches : appuyer sur sa deuxième touche pendant que la première est tenue ne donne pas de second front. Sans effet sur la table du §3, qui n'a qu'une touche par impulsion.
- `keydown` non répété d'une touche déjà tenue (`keyup` perdu) : pas de second front.
- Boutons tactiles : un compteur de doigts ; l'action reste tenue jusqu'au dernier doigt levé, là où `game.js` relâche au premier `pointerup`.
- FInput ignore les modes du jeu : les filtres de `game.js` restent devant chaque appel (§4.3).
- `addLook` change l'appareil sans le filtre de 800 ms (il n'a pas d'horodatage ; l'appelant nomme l'appareil).
- `step()` remet le regard à 0 même sans stick `look`, pour qu'il ne s'accumule jamais.

Écarts voulus de l'étape 3 (réglages et capture) :
- Avec `FOptions.normalize`, les quatre écarts de règles du §4.2 : entrée vide acceptée, repli limité à `alt`, toute action absente complétée avec ses seuls codes libres, « Action inconnue. ». Aucun n'est lu par `checks/options.test.mjs`, et E21b vérifie que les deux modules donnent les mêmes réponses sur ses profils.
- Le résultat de la capture arrive par `frame()`, à l'image qui suit l'appui, et non dans `keydown` comme aujourd'hui (§4.3). Une répétition est avalée sans être capturée, comme dans `game.js` (916) ; un code qui n'est pas une chaîne aussi.
- `capture()` efface un résultat pas encore rendu, et `clear()` termine la capture : une nouvelle demande ne reçoit jamais l'appui de la précédente.
- `migrate` reçoit sa propre copie, et son résultat est recopié en JSON : une `migrate` qui modifie son argument puis échoue ne laisse aucune trace.
- `capture('gamepad')`, accepté dès l'étape 3, est lu par `frame()` depuis l'étape 4 ; le clavier continue de jouer pendant une capture manette (E36).

Écarts voulus de l'étape 4 (manette) :
- Activité : la mission dit « un axe brut au-delà de .3 » ; FInput ne regarde que les axes 0 à 3, ceux des deux sticks. Des pilotes exposent d'autres axes loin de 0 au repos (gâchettes à −1 en axes 4 et 5, croix sur un axe « chapeau ») : la manette reprendrait la main à chaque image, et le clavier comme la souris ne la garderaient jamais (E35).
- Le bouton capturé reste tenu, sans front, tant qu'il est enfoncé ; au clavier, la touche capturée n'est jamais tenue. La manette est relue à chaque image : masquer le bouton jusqu'à son relâchement demanderait un état de plus. Sans effet dans METAL, où la capture se fait dans les options, sans pas de simulation, et où `setMode` appelle `clear()`.
- `configure` : un bouton de manette enfoncé tient sa nouvelle action sans front, comme une touche (au-delà de la mission, E34b).
- Robustesse au-delà de la mission : `index` absent → la place dans la liste ; `id` lu comme une chaîne ; bouton donné comme un nombre ; entrées qui ne sont pas des objets ignorées ; fiches rendues en copies (E33).

Écarts voulus de l'étape 5 (invites et vibrations ; au-delà de la mission, sans la contredire) :
- `keyDown` apprend le libellé avant la branche de capture : une touche capturée apprend aussi le sien, ce dont se sert « Touche enregistrée : » (§4.3) ; une répétition et un code non affecté aussi. Seuls les codes `Key…` apprennent, comme `keyLabel` ne lit l'appris que pour eux.
- Caractère visible : un seul point de code, ni blanc ni catégorie `C` d'Unicode (contrôle, format, usage privé, non attribué). La mission ne nomme que `' '`, `'Dead'` et `'Unidentified'`.
- `setLayout` : une valeur de la table ne compte que si c'est une chaîne non vide ; la référence est gardée (une `KeyboardLayoutMap` n'est pas copiée) ; une valeur qui n'est pas un objet, ou un tableau, efface la table.
- `label` : un appareil inconnu donne l'invite clavier ; « ? » vaut pour tout id qui n'est pas une action déclarée, `toString` compris.
- `glyph` : un style inconnu donne les glyphes génériques ; seules les propriétés propres des tables comptent.
- Dernière manette active : gardée sans activité tant qu'elle est branchée ; remise à `null` aussi quand la lecture des manettes échoue ; une manette rebranchée ne la redevient qu'à son premier appui.
- `rumble` : une intensité ou une durée `NaN` ou absente vaut 0, ±Infinity la borne ; le limiteur est écrit tel que la mission le dit (`t − dernier < 40` refuse), si bien qu'un `t` non fini n'est jamais limité, et le jeu passe toujours son horloge ; l'absence d'actionneur ou de `playEffect` passe par le même `try` que l'exception ; le `catch` n'est accroché que si c'est une fonction ; la manette visée est l'objet `Gamepad` de la dernière image.
- Cinq messages d'erreur de la déclaration raccourcis (« allowKey invalide », « actions invalides », « id invalide : … », « id en double : … », « getGamepads invalide ») ; le préfixe « FInput : » et le fautif restent, et le comportement des étapes 1 à 4 est inchangé (§6).

Limites : aux étapes 1 à 4, tout n'est vérifié que sous Node, et contre `game.js` dans un DOM factice ; l'étape 5 l'est aussi dans un vrai Chrome sans interface (`guessDevice`, apprentissage par un vrai `keydown`, `KeyboardLayoutMap`, `rumble` sans manette), mais sans manette réelle. Libellés appris : c'est le dernier caractère vu, Maj comprise. Une lettre ne change pas (les majuscules la ramènent au même libellé), mais une touche de ponctuation oui : en AZERTY, KeyM tenue avec Maj (la course) envoie « ? » au lieu de « , ». Au raccord, `game.js` passe donc `e.shiftKey?undefined:e.key` à `keyDown` ; Ctrl, Alt et Méta sont déjà filtrés avant (922). Verr. Maj peut aussi changer la ponctuation selon le système. Sans `getLayoutMap` (Firefox, Safari), une lettre garde son nom QWERTY jusqu'à son premier appui : en AZERTY, « avancer » se lit « W / Z / ↑ » avant tout appui, « Z / Z / ↑ » après un appui sur Z (code KeyW), puis « Z / W / ↑ » quand W (code KeyZ) a servi aussi. La manette est lue une fois par image (l'API Gamepad n'a pas d'événement de bouton) : un appui plus court que l'intervalle entre deux images peut être manqué, ce que LOOP-06 ne couvre qu'au clavier, à la souris et au tactile. Restent à essayer sur du vrai matériel : claviers AZERTY et QWERTY (codes `event.code` et répétition automatique ; capture d'une liaison, répétition avalée, touches hors de la liste comme la ponctuation, refusées avec le même texte qu'aujourd'hui), souris verrouillée (`movementX` selon le navigateur et l'écran), manettes Xbox et PlayStation (glyphes, vibrations ; branchement à chaud, y compris deux manettes du même modèle et un index réutilisé ; dérive des sticks usés face aux zones mortes .12 et .15 ; course réelle des gâchettes face à .30 et .18 ; ressenti du lacet, du surcroît et du ralentissement sur cible ; manettes non standard), téléphones (tactile, gyroscope), Safari et Firefox (manette invisible avant le premier appui, pas de vibration sur Safari).
