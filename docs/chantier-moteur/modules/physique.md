# FPhysics — noyau de corps rigides (module physique du lot 17)

`src/physics.js` expose le global `FPhysics` : des corps rigides déterministes (boîtes orientées, sphères, capsules) contre un décor statique fait de boîtes. C'est le module moteur générique de FERRO : il ne sait rien du contenu de METAL, et c'est le jeu qui décrit ses objets. Les constats et la fiche du lot 17 l'appellent « FPhys » : c'est le même module.

État : **étapes 0 et 1 faites** (état des lieux, squelette et garde-fous). Le module n'est branché nulle part : aucun fichier existant n'est modifié, le raccord est seulement décrit au §6. Base du module : `71eca61` (branche `chantier/module-physique`).

| Étape | Contenu | État |
|---|---|---|
| 0 | État des lieux, référence `npm test` et sorties du prototype | fait ([etat-initial.md](../preuves/module-physique/etat-initial.md), [prototype-reference.txt](../preuves/module-physique/prototype-reference.txt)) |
| 1 | Forme du module, `MATERIALS`, conversions d'angles, `create` validé, `config`, `fingerprint` ; tests P01 à P04 | fait |
| 2 | Noyau de boîtes porté du prototype ; scènes, banc | à faire |
| 3 | Sphères, capsules, sols, matières, couches, cinématiques | à faire |
| 4 | Faces internes (PHYS-V1) | à faire |
| 5 | Objets minces et masses (PHYS-V4, PHYS-V3) | à faire |
| 6 | Sommeil et réveil (PHYS-V2) | à faire |
| 7 | Actions, requêtes, événements (PHYS-12) | à faire |
| 8 | Budgets (PHYS-14) | à faire |
| 9 | Articulations (PHYS-11) | à faire |
| 10 | Sauvegarde complète et décor modifié (PHYS-06) | à faire |
| 11 | Performances et preuves (PHYS-05, PHYS-14) | à faire |
| 12 | Figeage des hachages, navigateur | à faire |
| 13 | Document complet, `npm test` final | à faire |

## 1. Rôle et périmètre

**Rôle.** Donner à METAL, puis aux autres jeux FERRO, une physique d'objets « digne de Half-Life 2 » (MASTER-PROMPT §3, règle 6) : objets qui réagissent aux tirs et aux explosions, décor cassé qui devient des débris physiques, machines détruites qui se disloquent ou s'effondrent sur leurs articulations (décision de David du 12 novembre, §6 bis point 5). Aujourd'hui METAL n'a aucun corps rigide (PHYS-01) : les gravats tombent chacun pour soi et s'ignorent, les accessoires sont statiques, les machines détruites disparaissent.

**Constats couverts par le module** : PHYS-02 (noyau), PHYS-03 (120 Hz, marge spéculative), PHYS-04 (déterminisme), PHYS-05 (zéro allocation), PHYS-06 (instantané exact), PHYS-11 (articulations), PHYS-12 (événements de choc), PHYS-14 (budgets), et les quatre défauts de la contre-vérification : PHYS-V1 (arêtes internes), PHYS-V2 (réveil d'île entière), PHYS-V3 (rapports de masses), PHYS-V4 (objets minces). PHYS-01 est l'état des lieux de l'étape 0.

**Tâches du lot 17, côté module** : T2, T3, T4, T5, T6, T8, T9, T10, T11, T14, T16, T18. Les tâches d'intégration (T1, T7, T12, T13, T15, T17, et le côté jeu de T3, T9, T11, T16 et T18) sont seulement décrites au §6.

**Hors périmètre** : le contrôleur de personnage et `sweepCapsule` (étape D, plus tard) ; la saisie et le lancer d'objets (refusés par David le 12 novembre) ; toute modification d'un fichier du jeu ; les éclats cosmétiques, qui restent hors de FPhysics ; le travailleur (worker), le stockage en Float32, le monde non borné ; le mode 60 Hz × 2.

## 2. API

### Livrée (étape 1)

```js
FPhysics.VERSION                     // 2 : format de l'instantané (physicsVersion 2 au lot 12)
FPhysics.MATERIALS                   // tableau gelé de 5 objets gelés {name, friction, restitution, density}
FPhysics.eulerToQuat(rx, ry, rz, out = [0,0,0,0]) → out          // [x, y, z, w]
FPhysics.quatToEuler(x, y, z, w, out = [0,0,0]) → out            // [rx, ry, rz]
FPhysics.create(options) → w        // w.config, w.fingerprint ; TypeError si une option est invalide
```

Forme du fichier : `(function(G){'use strict';…G.FPhysics={VERSION:2,MATERIALS,create,eulerToQuat,quatToEuler};})(typeof window!=='undefined'?window:globalThis)`, la même que `src/motion.js`. Aucun autre global (test P01). Les conversions d'angles sont dans le seul bloc `// TRIG-BEGIN` … `// TRIG-END`.

**Table des matières** (l'indice est l'identifiant de matière ; ordre de `RUBBLE_MATERIALS` dans `src/simulation.js`, ligne 64 à la base) :

| id | name | friction | restitution | density |
|---|---|---|---|---|
| 0 | metal | 0.45 | 0.24 | 65 |
| 1 | stone | 0.70 | 0.16 | 28 |
| 2 | wood | 0.55 | 0.22 | 8 |
| 3 | glass | 0.35 | 0.16 | 25 |
| 4 | dirt | 0.80 | 0.05 | 12 |

Au contact (étapes 2 et 3) : frottement √(fA·fB), rebond max(rA, rB). Sans matière ni valeur explicite : corps 0,6 et 0,1 ; boîte statique ou sol 0,7 et 0,05 ; dalle de `ground` 0,8 et 0,05 (valeurs du prototype).

**Conventions** (alignées sur METAL) :
- mètres, secondes, kilogrammes, radians ; Y vers le haut ; gravité −12 m/s² sur Y (`GRAVITY` = 12, `src/simulation.js` ligne 8 à la base) ;
- quaternion `[x, y, z, w]` unitaire ; matrice R rangée ligne par ligne (`R[3*ligne+col]`), la colonne k est l'axe local k dans le monde, monde = R·local + pos ;
- angles d'Euler du jeu : `rotation = [rx, ry, rz]` avec M = Rz·Ry·Rx (le shader de `src/renderer.js` fait `rotation=rz*ry*rx`, `debrisHalf` écrit la même matrice). `eulerToQuat` donne q = qz ⊗ qy ⊗ qx ; `quatToEuler` lit ry = asin(−R[6]) borné à [−1, 1], puis rx = atan2(R[7], R[8]) et rz = atan2(R[3], R[0]), ou, au blocage de cardan (|sin ry| ≥ 0,9999999), rx = 0 et rz = atan2(−R[1], R[4]) ;
- `size` donne les dimensions complètes ; vitesse angulaire dans le repère du monde ; normales de A vers B (pour les étapes suivantes).

**`create(options)`.** Valide toutes les options (§3) avant de créer quoi que ce soit ; la première invalide lève `TypeError('FPhysics.create: …')`. Les clés inconnues sont ignorées, donc `create(w.config)` redonne le même monde et la même empreinte. Le monde expose :
- `w.config` : la copie gelée des valeurs effectives, `bounds` compris (gelé aussi), sans `clock`, −0 ramené à +0. Elle contient en plus les quatre durées converties en sous-pas entiers par `Math.floor(durée/tick + 0.5)` : `sleepSteps`, `splitSteps`, `fallbackSteps` et `windowSteps` (la fenêtre d'une seconde du repli). Aux réglages par défaut : 60, 120, 720 et 120 ;
- `w.fingerprint` : 8 chiffres hexadécimaux, le FNV-1a 32 bits des codes de caractères de `'FPhysics2|' + valeurs.join('|')`, les valeurs prises dans l'ordre du tableau du §3, `bounds` mis à plat (minX, maxX, minZ, maxZ), `ground` écrit `none` s'il est nul, sans `clock`. Deux mondes aux réglages égaux ont la même empreinte ; un seul réglage différent la change (test P04, sur les 49 valeurs). Aux réglages par défaut sur `B64` (±64 m) : `04031f9d`.

### Prévue (étapes 2 à 10, signatures de la mission)

`w.setStatics(boxes, floors)` et `w.updateStatics` ; `w.addBody(desc)`, `w.removeBody(h)`, `w.valid`, `w.isAsleep`, `w.isLost`, `w.body(h)` ; `w.impulse`, `w.setVelocity`, `w.wakeBox`, `w.blast`, `w.setKinematic` ; `w.step(dt)` ; `w.ray`, `w.queryBox` ; `w.pose(h, alpha, out)`, `w.matrix(h, out)` ; événements (`w.eventCount`, `w.evA`, `w.evB`, `w.evData`, `w.evMat`, `w.readEvents()`) ; `w.addJoint(desc)`, `w.removeJoint(j)`, `w.broken`, `w.brokenCount` ; `w.snapshot()`, `w.restore(snap, opts)`, `w.hash()` ; `w.stats`, `w.phaseMs`, `w.rayHit`, `w.staticsHash`. Invariants à tenir : déterminisme (§4), restauration atomique, handles à génération (`gen*4096 + index`), aucune allocation par pas.

## 3. Réglages

Toutes les options de `create`, dans l'ordre de l'empreinte. Contrôles : *fini* = nombre fini quelconque ; *> 0* et *≥ 0* = nombre fini de ce signe ; *entier* = `Number.isInteger` dans l'intervalle donné. Une option absente (`undefined`) prend sa valeur par défaut ; `null` n'est permis que pour `ground` et `clock`.

| Option | Défaut | Contrôle | Sens | Origine |
|---|---|---|---|---|
| `bounds` | obligatoire | minX < maxX, minZ < maxZ, finis | zone couverte par la grille ; un corps au-delà reste simulé dans les cellules du bord | T2, PHYS-02 |
| `cell` | 2 | > 0 | côté d'une cellule de grille (m) ; change l'ordre des paires, donc fait partie de la version | T2, PHYS-02, PHYS-04 |
| `gravity` | −12 | fini | accélération sur Y | `GRAVITY` de `src/simulation.js` |
| `ground` | null | null ou fini | y d'une dalle statique [minX, y − floorThickness, minZ]–[maxX, y, maxZ], toujours à l'indice 0 | mission ; remplace le plan de sol du prototype (T5, point 4) |
| `floorThickness` | 0.5 | > 0 | épaisseur des dalles de sol | T5, point 4 |
| `minY` | −60 | fini | plan de perte : un corps plus bas devient « perdu » | T14 (dégradation) |
| `tick` | 1/120 | > 0 | durée d'un sous-pas ; seule valeur validée | T3, PHYS-03, MASTER-PROMPT §6 |
| `maxSubsteps` | 8 | entier 1 à 2³¹−1 | sous-pas au plus par appel de `step` ; le reste est jeté et compté | T14 |
| `capacity` | 384 | entier 1 à 4095 | corps au plus ; l'index tient sous 4096 dans le handle | T2 ; PHYS, décisions pour David (384 corps) |
| `maxStatics` | 4096 | entier 1 à 65 535 | boîtes statiques après fusion ; borne qui garde les clés de paire sous 2³¹ | mission (mondes de 448 à 504 boîtes, worldstats) |
| `maxContacts` | 16384 | entier 1 à 1 048 576 | points de contact par sous-pas et entrées du cache | prototype ; T14 |
| `maxJoints` | 128 | entier 0 à 4095 | articulations ; l'emplacement tient sous 4096 dans le handle | T18 |
| `iterations` | 2 | entier 1 à 2³¹−1 | passes du solveur avec biais | PHYS-02 (2 + 1), T2 |
| `relaxIterations` | 1 | entier 0 à 2³¹−1 | passes de relaxation, sans biais | PHYS-02, T2 |
| `hardIterations` | 4 | entier 0 à 2³¹−1 | passes avec biais **au total** pour les îles renforcées | T11 point 4, T18, PHYS-V3 |
| `hardRelaxIterations` | 2 | entier 0 à 2³¹−1 | relaxations au total pour les îles renforcées | T11 point 4, PHYS-V3 |
| `hardRatio` | 8 | ≥ 0 | île renforcée si masse max / masse min > 8, ou si elle a une articulation | mission §5.8 (écart volontaire avec T11) |
| `contactHertz` | 30 | > 0 | raideur des contacts, bornée à 0,25/tick | PHYS-02 |
| `dampingRatio` | 10 | ≥ 0 | amortissement des contacts | PHYS-02 |
| `pushout` | 3 | ≥ 0 | vitesse maximale de dégagement (m/s) | PHYS-02 ; T12 (dégagement plafonné à 3 m/s) |
| `restitutionThreshold` | 1 | ≥ 0 | vitesse d'approche minimale du rebond (m/s) | PHYS-02 |
| `jointHertz` | 60 | > 0 | raideur des articulations, bornée à 0,5/tick | T18 (mission) |
| `jointDampingRatio` | 2 | ≥ 0 | amortissement des articulations | T18 (mission) |
| `linearDamping` | 0.02 | ≥ 0 | amortissement linéaire, par seconde | prototype |
| `angularDamping` | 0.06 | ≥ 0 | amortissement angulaire, par seconde | prototype |
| `rollingDamping` | 2 | ≥ 0 | amortissement angulaire en plus pour les sphères et capsules en contact | mission |
| `maxLinear` | 40 | > 0 | vitesse linéaire maximale (m/s) | prototype ; PHYS-06 (bornes de restauration) |
| `maxAngular` | 30 | > 0 | vitesse angulaire maximale (rad/s) | prototype ; PHYS-06 |
| `margin` | 0.02 | ≥ 0 | marge spéculative fixe (m) | T3, PHYS-03 |
| `slop` | 0.005 | ≥ 0 | tolérance d'appui maximale ; à ne pas baisser (97 mm d'écart transitoire à 2 mm) | PHYS-02, T6 |
| `slopRatio` | 0.12 | ≥ 0 | tolérance par corps = min(slop, 0,12 × plus petite demi-taille) | T6, PHYS-V4 |
| `minHalf` | 0.02 | ≥ 0 | demi-taille de collision minimale | T6, PHYS-V4 |
| `sleepLinear` | 0.08 | ≥ 0 | seuil de sommeil, vitesse linéaire | PHYS-02 |
| `sleepAngular` | 0.12 | ≥ 0 | seuil de sommeil, vitesse angulaire | PHYS-02 |
| `sleepTime` | 0.5 | ≥ 0 | durée sous les seuils avant que l'île dorme (s) | PHYS-02 |
| `splitTime` | 1 | ≥ 0 | un groupe immobile depuis 1 s s'endort seul | T10, PHYS-V2 |
| `fallbackTime` | 6 | ≥ 0 | repli : éveillé depuis 6 s… | T10, PHYS-V2 |
| `fallbackDistance` | 0.002 | ≥ 0 | …et déplacé de moins de 2 mm en 1 s : endormi | T10, PHYS-V2 |
| `wakeSpeed` | 0.25 | ≥ 0 | réveil d'un dormeur par un choc plus rapide (m/s) | T10, PHYS-V2 |
| `supportSpeed` | 0.08 | ≥ 0 | réveil d'un dormeur posé sur un corps plus rapide (m/s) | mission §5.7 b |
| `massMin` | 3 | > 0 | borne basse de la masse physique | T11 point 1, PHYS-V3 |
| `massMax` | 120 | > 0 et ≥ massMin | borne haute de la masse physique | T11 point 1, PHYS-V3 |
| `maxAwake` | 160 | entier 0 à 2³¹−1 | gouverneur de réveil | T14 point 7 |
| `spawnBudget` | 24 | entier 1 à 2³¹−1 | corps activés au plus par sous-pas | T14 point 8 |
| `eventSpeed` | 1.2 | ≥ 0 | vitesse d'approche minimale d'un événement de choc (m/s) | T16, PHYS-12 |
| `maxEvents` | 16 | entier 0 à 2³¹−1 | événements gardés par appel de `step` | T16, PHYS-12 |
| `clock` | null | null ou fonction | millisecondes pour `w.phaseMs`, banc seulement ; hors `config`, hors empreinte, sans effet sur la simulation | mission |

Les bornes hautes de `capacity`, `maxStatics` et `maxJoints` viennent des encodages : handle `gen*4096 + index`, clé de paire `lo·(capacity + maxStatics + 2) + hi` qui doit rester un entier 32 bits. Celle de `maxContacts` (2²⁰) évite des tables d'adressage ouvert démesurées. Les autres contrôles écartent ce qui ne peut pas avoir de sens (division par zéro, durée ou vitesse négative).

## 4. Algorithmes

**Déterminisme (PHYS-04, T4).** Les cinq règles d'écriture sont en tête de `src/physics.js` et le test P02 en contrôle la partie lexicale :
1. `Math` limité à `sqrt`, `abs`, `floor`, `imul`, `min`, `max` et `PI` ; `sin`, `cos`, `atan2` et `asin` seulement dans les blocs TRIG (conversions d'angles, limites de charnière), jamais dans le solveur ; pas d'opérateur de puissance (la contre-vérification de PHYS-04 relève le `**` de la ligne 11 du prototype).
2. Ordre fixe : corps par indice croissant, cellules z puis x, statiques par indice, contacts dans l'ordre d'émission, articulations par emplacement ; ni `Map`, ni `Set`, ni tri, ni énumération de clés dans `step()`.
3. Grandeurs dérivées canoniques, recalculées par une seule fonction à la création, en fin de sous-pas et à la restauration, depuis les seules valeurs sauvegardées (masse inverse sauvegardée, jamais 1/(1/m)).
4. L'empreinte couvre tous les réglages ; l'instantané la porte.
5. −0 ramené à +0 par `x + 0` en fin de sous-pas, dans le cache d'impulsions et dans les articulations.

Le temps n'arrive que par `dt` ; les durées sont converties une fois en sous-pas entiers (§2), et les minuteries comptent des sous-pas.

Le reste (ordre du sous-pas, phases large et étroite, faces internes, solveur, réveil, masses, objets minces, budgets, zéro allocation) sera résumé ici à mesure des étapes 2 à 11.

## 5. Mesures et preuves

**Référence de départ (étape 0, 13 novembre, Mac M5, Node 24.18, domaine principal, charge 2,5 à 2,9)** — détail dans [prototype-reference.txt](../preuves/module-physique/prototype-reference.txt) :

| Mesure sur le prototype `bancs/phys/fphys.mjs` | Valeur | Contre-vérification de l'audit |
|---|---|---|
| chaînes de `determinism.mjs` | stack10 37d0ca59, pyramid55 56c8b99b, rubble300 170702f6, blast200 fe961b81 | identiques (PHYS-04) |
| dérive de `drift.mjs`, 120 Hz × 1, 10 s sans sommeil | pile de 10 : 12,57 mm ; pyramide de 55 : 14,70 mm | 12,57 et 14,70 (PHYS-02) |
| `bench.mjs 3 120 1`, rubble300, médiane par pas | 0,50 à 0,59 ms (3 passes ; 289 éveillés, 1 460 points) | 1,72 à 1,74 ms sur la machine d'audit chargée |
| `bench.mjs 3 120 1`, blast200, moyenne par pas | 0,14 à 0,17 ms (3 passes) | 0,42 ms |
| `phys-verif/wake.mjs`, impulsion de 6 sur le tas endormi | 286 corps réveillés, 13,83 s, 714 ms cumulées | 286 corps, 13,8 s (PHYS-V2) |
| `worldstats.mjs`, mondes générés | 448 à 504 statiques, 26 à 28 sols dont 3 à 6 en pente | identiques (PHYS-01) |

**Référence `npm test` à la base** ([etat-initial.md](../preuves/module-physique/etat-initial.md)) : 470 tests, 462 réussis, 8 échecs connus (`checks/campaign-world.test.mjs` n° 108 à 115) ; `checks/build.test.mjs`, que la chaîne `&&` n'atteint pas, passe seul.

**Tests du module** (`node --test checks/fphysics.test.mjs`) :

| Test | Contenu | Étape | Résultat |
|---|---|---|---|
| P01 | un seul global `FPhysics`, `MATERIALS` gelé, chargement par `new Function` et par `node:vm` | 1 | vert |
| P02 | taille ≤ 80 000 octets, motifs interdits, membres de `Math`, blocs TRIG appariés, en-tête ; le contrôle est lui-même vérifié sur 24 altérations du vrai source, qui doivent toutes être détectées | 1 | vert (6 518 octets, 2 920 en gzip -9) |
| P03 | 1 000 triplets d'angles : norme de q à 1e-12 de 1 (mesuré 3,3e-16), matrice égale à celle du jeu à 1e-12 (8,9e-16), aller-retour à 1e-9 (4,2e-15), blocage de cardan à 1e-6 (1,5e-8) | 1 | vert |
| P04 | 58 jeux d'options invalides refusés, valeurs par défaut, durées en sous-pas, empreinte recalculée selon la mission, chacun des 49 réglages la change | 1 | vert |

Les mesures du §8.2 de la mission (banc, courbe, allocations, instantanés, statiques, assemblage, navigateur) viendront aux étapes 2, 11 et 12.

## 6. Plan de raccord, non appliqué

Rien de ce qui suit n'est fait : le lot qui intègre FPhysics l'appliquera. Numéros de ligne au commit de base `71eca61`.

- **`tools/build.py`** : ajouter `'physics.js'` dans la liste `modules` (ligne 6), juste avant `'simulation.js'` ; les sources sont jointes par `'\n;\n'` (ligne 8), d'où 3 octets de plus que la taille du module.
- **`checks/build.test.mjs`** : ajouter `html.includes('FPhysics')` à la liste des modules présents (ligne 14).
- **`package.json`** : ajouter `checks/fphysics.test.mjs` au script `test` (ligne 8).
- Le reste du plan (`src/simulation.js`, `src/effects.js`, `src/destruction.js`, `src/world.js`, IA, budget, dépendances aux lots 02, 07 et 12, tests qui chargent `simulation.js`) sera écrit à l'étape 13, fonctions citées par leur nom après vérification par grep.

## 7. Limites connues et questions ouvertes

- **En-tête du fichier.** L'en-tête proposé par la mission (§4.1) contient le texte « no Math.random », que le test P02 de la même mission interdit, commentaires compris. Il est écrit « no random source » : même sens, P02 vert.
- **Validation.** La mission nomme les cas d'erreur (valeur non finie, négative là où ce n'est pas permis, `capacity` hors de 1 à 4095, `bounds` absent ou min ≥ max). Le module y ajoute : des contrôles d'entier pour les nombres et les budgets ; les bornes hautes qui découlent des encodages (§3) ; un minimum de 1 pour `maxSubsteps`, `iterations` et `spawnBudget`, sans lequel le monde ne peut pas avancer ; `massMin` ≤ `massMax`. Tout est testé par P04. À confirmer si une autre règle est préférée ; aucun réglage par défaut n'en dépend.
- **Durées converties.** `w.config` porte en plus `sleepSteps`, `splitSteps`, `fallbackSteps` et `windowSteps`, que la mission ne nomme pas : ce sont les seuils effectifs des minuteries, utiles aux tests ; elles sont hors empreinte, car dérivées de réglages qui y sont.
- Les autres limites et les questions ouvertes de la mission (cadence 120 Hz × 1 ou 60 Hz × 2, simulation sans FPhysics, barils, taille des instantanés, épaisseur des dalles, limites de charnière, seuils de réveil, pièces d'épave, enfoncement souple, écarts volontaires avec la fiche) seront tranchées ou reprises ici à mesure des étapes.
