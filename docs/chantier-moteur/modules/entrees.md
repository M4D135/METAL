# Module d'entrées FInput (`src/input.js`)

État : **étape 1 sur 10**. Le squelette du module existe et `create` valide la déclaration du jeu ; l'instance arrive aux étapes 2 à 7. Le module n'est pas branché dans le jeu : aucun fichier existant n'est modifié, et le raccord est seulement décrit au §4. Les sections encore à écrire donnent leur plan et l'étape qui les remplira.

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
| Instance : actions, clavier, souris, boutons, `frame()` sans manette, `step()`, `pendingLook()`, `clear()` | 2 | à faire |
| `defaults`, `normalize`, `assign`, `unbind`, `configure`, capture clavier, migration | 3 | à faire |
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
| `create(config)` | → instance | Valide la déclaration (§2.5), puis rend l'instance (un objet vide à l'étape 1). | 1 à 7 |
| `keyName(code)` | → texte | Nom affichable d'un `event.code`, identique à `FOptions.keyName` pour tous les codes réels. | 1 |
| `defaults(config)`, `normalize(raw, config)` | → réglages | Réglages par défaut, relecture tolérante et idempotente. | 3 |
| `assign(config, settings, device, action, code)`, `unbind(config, settings, device, action)` | → `{ok, …}` | Réaffectation avec détection des conflits ; ne modifient jamais leurs arguments. | 3 |
| `radial(x, y, inner, outer)` | → `[x', y', n]` | Zone morte radiale avec remise à l'échelle. | 4 |
| `padStyle(id)`, `glyph(name, style)` | → texte | Famille de manette, glyphe d'un bouton. | 5 |
| `guessDevice(win)` | → `'touch'` ou `'keyboard'` | Appareil probable au démarrage. | 5 |
| `focusMove(root, cmd, doc)` | → élément ou `null` | Déplacement du focus dans un menu. | 6 |
| `gyro(rate, gravity, angle, dt, opts)` | → `{x, y}` | Facultatif. | 9 |

Instance prévue (étapes 2 à 7) : `keyDown`, `keyUp`, `mouseMove`, `button`, `addLook`, `clear`, `configure`, `settings`, `device`, `assign`, `unbind`, `capture`, `frame`, `step`, `pendingLook`, `setPilot`, `keyLabel`, `setLayout`, `label`, `rumble`, `stickDown`, `stickMove`, `stickUp`, `stickState`, `aimDown`, `aimMove`, `aimUp`, `aiming`. Leurs signatures exactes seront écrites ici à mesure.

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

`defaults`, `normalize`, `assign` et `unbind` appliqueront la même validation à l'étape 3.

### 2.6 Invariants

À établir aux étapes 2 à 7, et vérifiés par les tests du §6 : une sortie par pas de simulation ; le regard est consommé par le premier pas qui suit ; les fronts sont verrouillés jusqu'au premier pas, puis effacés ; aucune sortie ne vaut `-0` ; mêmes appels avec les mêmes arguments → mêmes sorties, au bit près. Déjà vrai à l'étape 1 : la config du jeu n'est jamais modifiée.

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

**Migration v1 → v2.** Les réglages v1 sont les liaisons clavier actuelles de `FOptions` (`V1_KEYS` de la fixture), où Espace esquive. La fonction `migrate` de la table retire Espace de l'esquive et lui donne R si R est libre (sinon l'esquive reste sans touche, à réaffecter) ; `normalize` affecte ensuite Espace, devenu libre, au saut. Une table personnalisée garde ses choix, sauf Espace qui quitte l'esquive. Le jeu affiche une fois le message « Espace : saut · R : esquive » quand il relit des réglages v1 (drapeau à ranger dans ses préférences).

## 4. Plan de raccord, non appliqué

Rien de ce qui suit n'est fait dans ce lot : c'est le plan du lot qui branchera FInput. Lignes citées sur la base `71eca61`.

### 4.1 `tools/build.py`, `checks/build.test.mjs`, `package.json`

- `tools/build.py` : ajouter `'input.js'` dans la liste `modules`, **juste avant `'options.js'`**. FInput ne dépend de rien ; ainsi `FOptions` peut s'en servir dès son chargement, et `game.js` le trouve. Écart : la fiche lot-08 dit « entre options.js et game.js », ce qui empêcherait `options.js` de déléguer à FInput.
- `checks/build.test.mjs` : ajouter `html.includes('FInput')` à la liste des modules présents.
- `package.json` : ajouter `checks/finput.test.mjs` au script `test`.
- Coût : la page grossit de la taille de `src/input.js` plus 3 octets (le séparateur `'\n;\n'`). Mesure exacte à l'étape 8 (`bundle-check.json`).

### 4.2 `src/options.js`

À écrire à l'étape 10, avec les réglages de l'étape 3 : la table `actions` devient celle du §3 (par exemple `FOptions.inputConfig`) ; les réglages FInput se rangent sous `prefs.input` (`FInput.normalize(raw.input ?? {v:1, keys: raw.bindings}, config)`) ; `assign`, `normalize` et `keyName` délèguent à FInput en gardant l'API que lisent `checks/options.test.mjs` et `game.js` ; `sensitivity` et `invertY` restent dans FOptions et sont recopiés dans `tune`.

### 4.3 `src/game.js`

À écrire à l'étape 10, fonction par fonction. Points d'entrée actuels : `const keys=new Set(),input=…` (ligne 20), `clearInput` (209), la fusion de `frame(now)` (783, de `input.moveX=` en 793 jusqu'à `sim.step(part,input)` en 804), les écouteurs `keydown` (888 et 914), `keyup` (934), `pointerlockchange` (946), `mousemove` (956, `.0022` par compte) et les widgets tactiles (`#move-zone`, `#fire-button`, `#left-fire-button`, `#dash-button`, `#pulse-button`, `#melee-button`, `#interact-button`, lignes 970 à 980).

### 4.4 `src/style.css` et `src/index.html`

À écrire à l'étape 10 : `:focus-visible`, `body.pad`, textes d'aide produits par `label()`.

### 4.5 Tests à adapter au raccord

À écrire à l'étape 10 : `checks/input.test.mjs` et `checks/checkpoint.test.mjs` (bouchon de `navigator.getGamepads`, lignes où Espace frappe), `checks/options.test.mjs`.

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

À venir : coût par image dans le domaine principal de Node (`tools/finput-bench.mjs`, `bench.json`), assemblage simulé (`tools/finput-bundle-check.mjs`, `bundle-check.json`), page d'essai dans Chrome sans tête (`navigateur.html`, `navigateur-resultat.txt`), `npm test` final (`npm-test-apres.txt`), et les valeurs de FEEL-10 et des constats TACT vérifiées par les tests E24 à E50.

## 7. Limites et questions ouvertes

Questions pour David (valeur par défaut entre parenthèses) :
- Croix et Back : la croix n'a que quatre directions pour les armes 1 à 4, et le pistolet (arme 5) n'a pas de bouton direct ; il reste accessible par Y (arme suivante). (Table du §3.)
- Menus : ordre linéaire, comme BITUME, ou navigation spatiale (FEEL-11) ? (Ordre linéaire, défaut de la fiche lot-08.)
- Bonus d'aide à la visée de .38 m de l'arme 0 quand la manette est active (`simulation.js`, `input.assist`). (Fiche : le réserver au tactile.)
- Déblocage du son par un bouton de manette. (Oui, avec « A : activer le son » si le contexte reste suspendu.)
- Signes du gyroscope, à valider sur appareil (iOS et Android diffèrent).

Écarts relevés entre les sources (la mission du module suit les valeurs mesurées) :
- Point d'insertion dans `build.py` : avant `options.js` ici, « entre options.js et game.js » dans la fiche lot-08 (§4.1).
- Seuil du surcroît de lacet : « r > 0,95 » dans la fiche lot-08 T1 ; .97 dans le prototype mesuré (`bancs/feel/gamepad-map.mjs`) et dans le module.
- API : `FGamepad.create(prefs).poll(dt, ctx)` (FEEL-10, lot-08 T1) devient `FInput.create(config)`, puis `frame(dt, ctx)` à chaque image et `step()` à chaque pas.
- Pas de temps : la contre-vérification de TACT-09 conseillait de garder le pas variable ; `MASTER-PROMPT.md` §6 a tranché pour le pas fixe de 1/60 s (lot 07). FInput sert les deux : une sortie par pas, et le regard en attente pour la caméra.
- LOOP-07 : zones mortes .18/.12, courbe r^2,2, 241°/s et A = esquive, remplacés par FEEL-10 (A = saut, B = esquive).

Limites : à l'étape 1, tout n'est vérifié que sous Node. Restent à essayer sur du vrai matériel : manettes Xbox et PlayStation (glyphes, vibrations, branchement à chaud), téléphones (tactile, gyroscope), Safari et Firefox (manette invisible avant le premier appui, pas de vibration sur Safari).
