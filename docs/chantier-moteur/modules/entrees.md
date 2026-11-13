# Module d'entrées FInput (`src/input.js`)

État : **étape 3 sur 10**. `create` valide la déclaration du jeu (étape 1) et rend l'instance au clavier, à la souris et aux boutons virtuels : `frame()` sans manette, `step()`, `pendingLook()`, `clear()`, `configure()` (étape 2). Les réglages sont complets : `normalize` avec `migrate`, codes de repli et table de la manette, `assign` et `unbind` au clavier comme à la manette, capture clavier (étape 3). Manette, invites, menus et tactile arrivent aux étapes 4 à 7. Le module n'est pas branché dans le jeu : aucun fichier existant n'est modifié, et le raccord est seulement décrit au §4. Les sections encore à écrire donnent leur plan et l'étape qui les remplira.

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
| Manette : `radial`, lecture, fusion, zones mortes, courbe, surcroît, gâchettes, course, branchement à chaud, capture, échange des sticks | 4 | à faire |
| Invites et vibrations : `keyLabel`, `setLayout`, `label`, `padStyle`, `glyph`, `guessDevice`, `rumble` | 5 | à faire |
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
| `radial(x, y, inner, outer)` | → `[x', y', n]` | Zone morte radiale avec remise à l'échelle. | 4 |
| `padStyle(id)`, `glyph(name, style)` | → texte | Famille de manette, glyphe d'un bouton. | 5 |
| `guessDevice(win)` | → `'touch'` ou `'keyboard'` | Appareil probable au démarrage. | 5 |
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
| `keyDown(code, t, repeat, key)` → booléen | Appareil = `'keyboard'`, pour toute touche. Ajoute `code` aux touches tenues s'il n'y est pas ; s'il est affecté, met à jour l'action, avec la règle des fronts, sauf pour une répétition : une touche tenue pendant un `clear()` revient par son `repeat`, sans front. Une touche déjà tenue ne donne pas de second front. Rend `true` si `code` est affecté (le jeu fait alors `preventDefault`). **Capture clavier en cours** (étape 3) : le premier appui non répété d'un code (une chaîne) est mémorisé `{device:'keyboard', code}` pour `frame().captured`, la capture se termine, rien n'est appliqué au jeu (touche non tenue, aucun front) et `keyDown` rend `true` ; une répétition est avalée (`true`, rien de capturé), comme dans `game.js` aujourd'hui. Le libellé appris de `key` vient à l'étape 5. | 2, 3 |
| `keyUp(code, t)` → booléen | Retire la touche, jamais de front ; `true` si `code` est affecté. | 2 |
| `mouseMove(dx, dy, t)` | `px += dx·mouseScale·sensitivity`, puis `py -= dy·mouseScale·sensitivity·(invertY ? -1 : 1)`, dans cet ordre de calcul : parité au bit près avec `game.js`. Appareil = `'mouse'`, sauf moins de 800 ms après le dernier événement tactile. Un delta non fini compte pour 0. | 2 |
| `button(action, down, t, device)` → booléen | Source virtuelle : `'mouse'` (booléen `m` ; l'appareil passe à `'mouse'` hors du filtre de 800 ms) ou `'touch'` (compteur `t`, jamais négatif ; appareil `'touch'`, horodatage retenu pour le filtre). Autre appareil ou action inconnue → `false`, sans effet. | 2 |
| `addLook(x, y, device)` | Ajoute des radians bruts à `px` et `py` (glisser sans verrouillage, gyroscope) ; une valeur non finie compte pour 0. Si `device` est l'un des quatre appareils, il devient l'appareil actif. | 2 |
| `clear()` | Relâche touches, souris, doigts et manche ; efface verrous, fronts, `px` et `py` ; termine la capture et efface son résultat pas encore rendu (étape 3). L'appareil actif et les réglages restent. Les étapes suivantes y ajoutent l'image suivante sans front ni commande de manette (4 et 6), les pointeurs et la vitesse tactiles (7). | 2, 3 |
| `configure(settings)` → réglages | Normalise, applique, reconstruit la table code → action, recompte les touches tenues sans front (une touche tenue qui change d'action tient la nouvelle) et rend une copie des réglages appliqués. | 2 |
| `settings`, `device` | Accesseurs : copie des réglages courants ; appareil actif, au départ `config.device`. | 2 |
| `frame(dt, ctx)` → résultat | Une fois par image, avant les pas. `dt` fini borné à [0 ; 0,25], sinon 0. Regard au clavier du stick `look` : `px += (tenue(x[1]) − tenue(x[0]))·dt·rate`, et de même pour `py` si `y` a deux actions. Rend un objet neuf `{pressed, nav, device, deviceChanged, connected, disconnected, pads, captured}` : `pressed` = fronts depuis la dernière image, dans l'ordre d'arrivée, sans doublon ; `deviceChanged` = appareil différent de celui du résultat précédent. Puis vide la liste des fronts et les `edge`. `captured` (étape 3) = le résultat de la capture, rendu une seule fois, par l'image qui suit l'appui ; sinon `null`. Sans manette (jusqu'à l'étape 4) : `nav` vaut `null`, `connected`, `disconnected` et `pads` sont vides ; `ctx.lookScale` sera lu par la visée à la manette. | 2, puis 3, 4, 6, 7 |
| `step()` → entrées du pas | Une fois par pas de simulation, un objet neuf aux clés dans un ordre fixe : `<stick>X` et `<stick>Y` pour chaque stick dans l'ordre de déclaration, puis chaque action. Stick `move` : le candidat de plus forte norme parmi le clavier `(tenue(x[1]) − tenue(x[0]), tenue(y[1]) − tenue(y[0]))`, la manette et le manche tactile, examinés dans cet ordre ; un suivant ne gagne qu'avec une norme strictement plus grande (manette et manche valent 0 jusqu'aux étapes 4 et 7). Stick `look` : `px` et `py`, consommés. Action `hold` : tenue ou `latch` ; `press` : `latch` ; `value` : `max(gv, k > 0 ou m ou t > 0 ? 1 : 0)`. Puis efface tous les verrous. Le regard est remis à 0 à chaque pas, même sans stick `look`, pour ne jamais s'accumuler. | 2, pilote à l'étape 7 |
| `pendingLook()` → `{x, y}` | Regard accumulé et pas encore consommé, sans le consommer (STAB-06 : le jeu l'ajoute aux angles de la caméra entre deux pas). | 2 |
| `assign(device, action, code)`, `unbind(device, action)` → `{ok, …}` | Comme les fonctions statiques (§2.6), avec la déclaration et les réglages courants de l'instance. N'appliquent rien : le jeu appelle ensuite `configure(r.settings)` et enregistre `r.settings` (E15, E16, E18). | 3 |
| `capture(device)` | `'keyboard'` ou `'gamepad'` : le prochain appui de cet appareil ira à `frame().captured` au lieu du jeu. Toute autre valeur, `null` compris, annule. Chaque appel efface aussi un résultat pas encore rendu : une nouvelle demande ne reçoit jamais l'appui de la précédente (E23). La capture manette est lue par `frame()` à partir de l'étape 4 ; d'ici là, `capture('gamepad')` laisse le clavier jouer. | 3 |
| `keyLabel`, `setLayout`, `label`, `rumble` | Invites et vibrations. | 5 |
| `setPilot`, `stickDown`, `stickMove`, `stickUp`, `stickState`, `aimDown`, `aimMove`, `aimUp`, `aiming` | Pilote et tactile. | 7 |

### 2.8 Invariants

Établis aux étapes 2 et 3, et vérifiés par les tests (§6) :
- **Une sortie par pas.** Un deuxième pas dans la même image reçoit un regard nul et aucune impulsion ; les actions tenues restent vraies, comme dans `game.js` (E10).
- **Regard consommé par le premier pas qui suit.** Une image sans pas ne consomme rien : `pendingLook()` montre le regard en attente, et le pas suivant le rend en entier (E11).
- **Fronts verrouillés jusqu'au premier pas, puis effacés.** Un appui plus court qu'une image est vu par le premier pas (LOOP-06) : impulsion une seule fois (E07), action tenue vraie à ce pas seulement (E09).
- **Aucune sortie numérique ne vaut `-0`** (E13).
- **Déterminisme.** Mêmes appels avec les mêmes arguments → mêmes sorties, au bit près ; ni hasard ni horloge (E02, E06).
- **Rien n'est modifié de l'extérieur.** La config du jeu reste intacte (étape 1) ; `normalize`, `assign` et `unbind` ne modifient pas leurs arguments, et `migrate` reçoit sa propre copie ; `settings`, `configure`, les résultats d'`assign` et d'`unbind`, et ceux de `frame()` et `step()` sont des objets neufs, qu'on peut modifier sans effet (E04b, E14b, E14d, E15, E16, E18, E22).
- **Réglages toujours valides.** `normalize` rend des réglages complets, sans code en double, idempotents et stables après un aller-retour JSON, quoi qu'on lui donne, `migrate` qui échoue compris (E19, E22). Une réaffectation ne retire jamais en silence une touche à une autre action : elle est refusée avec le nom de l'action qui la tient (E15, E18).
- **Capture isolée du jeu.** L'appui capturé n'est ni tenu, ni un front, ni une impulsion ; il est rendu une seule fois par `frame()` (E23).

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
| `frame(now)` (783) | `const f=inp.frame(dt)` juste après le calcul de `dt` (787), avant les retours de 788 et 789 : une fois par image présentée, dans tous les modes, car les options s'ouvrent depuis le menu comme depuis la pause. Hors du mode `playing`, seul `captured` est lu (et `nav` à l'étape 6). Si `f.captured` et `bindingAction` : `const r=inp.assign(f.captured.device,bindingAction,f.captured.code)`. Refus : `binding-status` = `r.reason+' Choisissez une autre touche, ou Échap pour annuler.'` (919), puis `inp.capture(f.captured.device)` pour l'appui suivant. Accord : `prefs.bindings=r.settings.keys`, `prefs.input.pad=r.settings.pad`, `bindingAction=null`, `settings()`, « Touche enregistrée : » suivi de `FInput.keyName(f.captured.code)`, et le focus sur le bouton, comme en 920. |
| `setMode` (210 ; `bindingAction=null` en 214) | Rien de plus : `clearInput()` devient `inp.clear()`, qui termine aussi la capture. |
| Libellés de touches (104, 130, 711, 715, 719 à 721) | `inp.label(id,'keyboard')` (étape 5), qui rend « — » pour une action sans touche. `bindingLabel` (104) rend aujourd'hui une chaîne vide pour `[]`. |

Le résultat de la capture arrive à l'image qui suit l'appui : au plus une image plus tard, 17 ms à 60 images/s. Il attend tant que `frame()` n'est pas appelé ; seuls `capture()` et `clear()` l'effacent. Les tests qui lisent `binding-status` ou `ferro-settings` juste après l'appui doivent donc faire avancer une image (§4.5). Variante sans ce délai : traiter le clavier dans `keydown` comme aujourd'hui, avec `inp.assign('keyboard',bindingAction,e.code)`, et ne garder `capture` que pour la manette. Recommandé : la même voie pour les deux appareils, avec un seul traitement des refus, et une touche capturée qui ne peut jamais atteindre le jeu. La capture manette de l'étape 4 passera par la même branche de `frame`, avec « Choisissez un autre bouton ».

### 4.4 `src/style.css` et `src/index.html`

À écrire à l'étape 10 : `:focus-visible`, `body.pad`, textes d'aide produits par `label()`.

### 4.5 Tests à adapter au raccord

Relevé à l'étape 3 pour les réglages et la capture, lignes de la base `71eca61`. L'étape 4 y ajoutera le bouchon de `navigator.getGamepads` dans `checks/input.test.mjs` et `checks/checkpoint.test.mjs`, et l'étape 10 complétera la liste.
- `checks/options.test.mjs`, test des lignes 17 à 22 : Interagir sur R, devenu l'esquive en v2 → G (18, 20 et 21). Essayé sur une copie de `options.js` déléguée à FInput (`raccord-options.mjs`, §6) : 12 tests sur 13 tels quels, 13 sur 13 avec ce seul changement.
- `checks/checkpoint.test.mjs`, test des lignes 665 à 676 (« Options rebind the actual interaction key… ») : R → G en 671 et 674, `'R'` → `'G'` en 675 ; et un `app.frame(100)` après les appuis capturés de 669 et 671, puisque le résultat de la capture arrive à l'image suivante (§4.3). Le refus de E (« Déjà utilisée ») ne change pas.
- `checks/checkpoint.test.mjs`, coup de bouclier et esquive sur Espace : 308 et 313 (test de la ligne 303, dont le nom dit « Space bashes »), 318 (test de 316) et 352 (test de 333). En v2, Espace saute et R esquive : `app.key('Space')` devient `app.key('KeyR')`, et le nom du test de 303 suit. Ce que fera Espace (le saut) dépend de la simulation (FEEL-09, lot 09).
- Devraient garder leurs réponses, à vérifier au raccord : `checks/input.test.mjs:124` (profil sans `input`, donc lu comme v1 et migré ; T et G ne touchent ni Espace ni R), `checks/input.test.mjs:195` et `checks/checkpoint.test.mjs:802` (réglages écrits par le jeu ou tirés de `FOptions.defaults`, donc v2).

### 4.6 Dépendances

Saut et frappe dans la simulation (FEEL-09, FEEL-01, lot 09) ; boucle à pas fixe (lot 07) ; CSS tactile (TACT-V2) ; démo (`setPilot`, DEMO-01).

## 5. Vibrations

À écrire à l'étape 5 : la table de FEEL-10 (mitraillette, pistolet, pompe, roquette, coup reçu, blocage, explosion, atterrissage dur, impact de colosse) traduite en appels `rumble(strong, weak, ms, t)`. La table reste dans le document et dans le jeu, pas dans le module.

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

À venir : coût par image dans le domaine principal de Node (`tools/finput-bench.mjs`, `bench.json`), assemblage simulé (`tools/finput-bundle-check.mjs`, `bundle-check.json`), page d'essai dans Chrome sans tête (`navigateur.html`, `navigateur-resultat.txt`), `npm test` final (`npm-test-apres.txt`), et les valeurs de FEEL-10 et des constats TACT vérifiées par les tests E24 à E50.

## 7. Limites et questions ouvertes

Questions pour David (valeur par défaut entre parenthèses) :
- Croix et Back : la croix n'a que quatre directions pour les armes 1 à 4, et le pistolet (arme 5) n'a pas de bouton direct ; il reste accessible par Y (arme suivante). (Table du §3.)
- Menus : ordre linéaire, comme BITUME, ou navigation spatiale (FEEL-11) ? (Ordre linéaire, défaut de la fiche lot-08.)
- Bonus d'aide à la visée de .38 m de l'arme 0 quand la manette est active (`simulation.js`, `input.assist`). (Fiche : le réserver au tactile.)
- Déblocage du son par un bouton de manette. (Oui, avec « A : activer le son » si le contexte reste suspendu.)
- Signes du gyroscope, à valider sur appareil (iOS et Android diffèrent).
- Impulsion affectée à plusieurs touches : un front quand l'action passe de relâchée à tenue (FInput), ou un par `keydown` non répété de chacune de ses touches (`game.js` aujourd'hui) ? (Un par action, ci-dessous.)
- Profil v1 où R est déjà pris (Interagir sur R, par exemple) : l'esquive reste sans touche et Interagir garde R ; ou bien R passe à l'esquive et Interagir reprend une touche libre ? (L'esquive sans touche : un choix du joueur n'est jamais retiré en silence, et le message le dit, §3.)
- Message affiché une fois après la migration d'un profil v1 : « Espace : saut · R : esquive », ou « Espace : saut · Esquive : à affecter (Options) » si l'esquive est restée sans touche. (Ces deux textes, avec un drapeau rangé dans les préférences du jeu.)

Écarts relevés entre les sources (la mission du module suit les valeurs mesurées) :
- Point d'insertion dans `build.py` : avant `options.js` ici, « entre options.js et game.js » dans la fiche lot-08 (§4.1).
- Seuil du surcroît de lacet : « r > 0,95 » dans la fiche lot-08 T1 ; .97 dans le prototype mesuré (`bancs/feel/gamepad-map.mjs`) et dans le module.
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
- `capture('gamepad')` est accepté dès l'étape 3, mais la manette n'est lue qu'à partir de l'étape 4 : d'ici là, le clavier continue de jouer pendant une capture manette.

Limites : aux étapes 1 à 3, tout n'est vérifié que sous Node, et contre `game.js` dans un DOM factice. Restent à essayer sur du vrai matériel : claviers AZERTY et QWERTY (codes `event.code` et répétition automatique ; capture d'une liaison, répétition avalée, touches hors de la liste comme la ponctuation, refusées avec le même texte qu'aujourd'hui), souris verrouillée (`movementX` selon le navigateur et l'écran), manettes Xbox et PlayStation (glyphes, vibrations, branchement à chaud), téléphones (tactile, gyroscope), Safari et Firefox (manette invisible avant le premier appui, pas de vibration sur Safari).
