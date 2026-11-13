# FPhysics — noyau de corps rigides (module physique du lot 17)

`src/physics.js` expose le global `FPhysics` : des corps rigides déterministes (boîtes orientées, sphères, capsules) contre un décor statique fait de boîtes. C'est le module moteur générique de FERRO : il ne sait rien du contenu de METAL, et c'est le jeu qui décrit ses objets. Les constats et la fiche du lot 17 l'appellent « FPhys » : c'est le même module.

État : **étapes 0, 1, 2a et 2b faites** (état des lieux, squelette et garde-fous, noyau de boîtes porté du prototype, scènes de 300 et 200 corps, actions de base et premier banc). Le module n'est branché nulle part : aucun fichier du jeu n'est modifié, le raccord est seulement décrit au §6. Base du module : `71eca61` (branche `chantier/module-physique`).

| Étape | Contenu | État |
|---|---|---|
| 0 | État des lieux, référence `npm test` et sorties du prototype | fait ([etat-initial.md](../preuves/module-physique/etat-initial.md), [prototype-reference.txt](../preuves/module-physique/prototype-reference.txt)) |
| 1 | Forme du module, `MATERIALS`, conversions d'angles, `create` validé, `config`, `fingerprint` ; tests P01 à P04 | fait |
| 2a | Noyau de boîtes porté du prototype : stockage, `setStatics` sans fusion, grilles chaînées, SAT et découpage, solveur, sommeil d'île, attente simple, `pose`/`matrix`/`body`, `hash`, `snapshot`/`restore` de base ; scènes `stack10` et `pyramid55`, `runChain` ; tests P05, P06, P11, P12, P45, P46 | fait ([preuves E2a](../preuves/module-physique/E2a/)) |
| 2b | Scènes `rubble300` et `blast200`, `hashes`, premier `tools/physics-bench.mjs` ; actions de base `impulse`, `setVelocity` et `blast` sans occultation ; tests P19 (boîtes), P41, P45 sur ces scènes | fait ([preuves E2b](../preuves/module-physique/E2b/)) |
| 3 | Sphères, capsules, sols, matières, couches, cinématiques | à faire |
| 4 | Faces internes (PHYS-V1) | à faire |
| 5 | Objets minces et masses (PHYS-V4, PHYS-V3) | à faire |
| 6 | Sommeil et réveil (PHYS-V2) | à faire |
| 7 | Actions, requêtes, événements (PHYS-12) : occultation de `blast`, `wakeBox`, `ray`, `queryBox`, événements | à faire |
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

### Livrée (étapes 1, 2a et 2b)

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

**Le monde (étape 2a).** Tout ce qui suit s'appelle hors du pas, sauf `step`, et peut allouer, sauf `step`.

```js
w.setStatics(boxes, floors) → {statics, merged: 0, masked: 0, woken}   // w.updateStatics : alias
w.staticsHash                        // 8 chiffres hexadécimaux, recalculé par setStatics
w.addBody(desc) → handle | -1        // boîtes dynamiques ; -1 et stats.refused++ si plein
w.valid(h), w.isAsleep(h), w.isLost(h) → booléen
w.body(h) → objet simple | null      // {handle, shape, size, radius, height, realSize, pos, quat, vel, ang, mass,
                                     //  originalMass, material, friction, restitution, group, mask, kinematic,
                                     //  asleep, pending, lost, hard}
w.step(dt) → sous-pas exécutés       // TypeError si dt n'est pas un nombre fini ≥ 0
w.pose(h, alpha, out) → out          // [x, y, z, qx, qy, qz, qw], alpha borné à [0, 1]
w.matrix(h, out) → out               // les 9 nombres de R
w.impulse(h, px, py, pz, jx, jy, jz) → booléen       // étape 2b : impulsion au point monde ; le corps se réveille
w.setVelocity(h, vx, vy, vz, wx, wy, wz) → booléen   // étape 2b : vitesses dans le monde ; le corps se réveille
w.blast(x, y, z, radius, strength, maxDv = 14, occlude = true) → corps poussés   // étape 2b, sans occultation
w.snapshot() → objet JSON ; w.restore(snap, opts) ; w.hash() → 8 chiffres hexadécimaux
w.stats (entiers), w.phaseMs (Float64Array(4), rempli seulement avec clock)
```

- **`setStatics`** : la dalle de `ground` (indice 0, frottement 0,8, rebond 0,05), puis les `boxes` `{minX, maxX, minY, maxY, minZ, maxZ, material?, friction?, restitution?}` en AABB, dans l'ordre donné (min ≤ max sur chaque axe ; frottement dans [0, 2], rebond dans [0, 1] ; priorité : valeurs explicites, puis matière, puis 0,7 et 0,05). Pas de fusion ni de voisines à l'étape 2a ; un `floors` non vide lève `TypeError` jusqu'à l'étape 3, comme un nombre de statiques au-delà de `maxStatics`. Le même décor redonné ne change rien (`woken` = 0, même `staticsHash`) ; un autre décor réveille tous les dormeurs et retire du cache les entrées corps-statique (la différence exacte du §4.5 de la mission vient à l'étape 10).
- **`addBody`** : `shape` `'box'` seulement (`'sphere'` et `'capsule'` lèvent `TypeError` jusqu'à l'étape 3, comme `kinematic: true`) ; `size` > 0, `pos` obligatoire, `quat` normalisé (norme < 1e-9 refusée) ou `rot` converti par `eulerToQuat`, jamais les deux ; `vel` et `ang` bornées à `maxLinear` et `maxAngular` ; `mass` > 0, ou densité de la matière × volume réel ; `material` par nom ou indice ; `group` 2 et `mask` 65535 par défaut ; `asleep: true` crée un dormeur, actif tout de suite. Masse physique = min(max(masse, massMin), massMax), demi-tailles de collision max(demi-taille, minHalf). Handle `gen*4096 + index`, plus petit index libre.
- **`body(h).mass`** est la masse physique, recalculée depuis la masse d'origine (pas 1/IM) ; `size` est la taille de collision, `realSize` la taille donnée.
- **Actions (étape 2b, §4.7 de la mission)**, hors du pas et sans allocation :
  - `impulse` ajoute J·IM à v et IW·((p − P) × J) à ω (`impulseAt` du prototype) ; `setVelocity` remplace les six vitesses (−0 ramené à +0). Elles renvoient `false` pour un handle invalide, un corps cinématique ou perdu, et lèvent `TypeError('FPhysics.impulse: …')` (ou `setVelocity`) si l'un des six nombres n'est pas fini, sans rien changer ;
  - `blast` : pour chaque corps vivant, actif, dynamique et non perdu, par indice croissant, le point cp de la boîte le plus proche du centre (position locale du centre bornée aux demi-tailles de collision), d = |cp − centre| ; si d < radius, l'impulsion min(strength·(1 − d/radius), maxDv/IM) le long de normalisée(centre du corps − centre + (0 ; 0,35 ; 0)), ou (0, 1, 0) sous 1e-6, appliquée en cp. Renvoie le nombre de corps poussés. `TypeError` si un nombre n'est pas fini, si `radius`, `strength` ou `maxDv` est négatif, ou si `occlude` n'est pas un booléen. `occlude` est validé mais sans effet jusqu'à l'étape 7 : tout corps à portée est poussé ;
  - réveil : un dormeur est réveillé seul (bit effacé, ST = AT = FN = 0, RP = P, `stats.wakes` + 1) ; un corps éveillé remet seulement ST à 0, comme le `wake` du prototype. Un corps en attente n'est pas poussé par `blast` ; `impulse` et `setVelocity` changent sa vitesse gardée, qu'il emporte à son activation ;
  - après chaque action, |v| et |ω| sont bornées à `maxLinear` et `maxAngular` (comme dans `addBody`), pour qu'un instantané pris entre deux pas se restaure toujours (§7, point 8).

**Prévue (étapes 3 à 10, signatures de la mission).** `w.removeBody(h)` ; sphères, capsules, sols, `kinematic`, `w.setKinematic` (étape 3) ; l'occultation de `w.blast`, `w.wakeBox`, `w.ray`, `w.queryBox`, `w.rayHit`, événements (`w.eventCount`, `w.evA`, `w.evB`, `w.evData`, `w.evMat`, `w.readEvents()`) (étape 7) ; `w.addJoint(desc)`, `w.removeJoint(j)`, `w.broken`, `w.brokenCount` (étape 9). Invariants tenus depuis l'étape 2a : déterminisme (§4), restauration atomique, handles à génération, aucune allocation par sous-pas (§5).

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

Les bornes hautes de `capacity`, `maxStatics` et `maxJoints` viennent des encodages : handle `gen*4096 + index`, clé de paire `lo·(capacity + maxStatics + 2) + hi` qui doit rester un entier 32 bits. Celle de `maxContacts` (2²⁰) évite des tables d'adressage ouvert démesurées. Les autres contrôles écartent ce qui ne peut pas avoir de sens (division par zéro, durée ou vitesse négative). Depuis l'étape 2a, `create` refuse aussi des `bounds` et une `cell` qui donneraient plus de 1 048 576 cellules par grille (`(floor((maxX − minX)/cell) + 1) × (floor((maxZ − minZ)/cell) + 1)`, soit 4 Mo de têtes de liste par grille) : sur `B64`, 65 × 65 = 4 225.

## 4. Algorithmes

**Déterminisme (PHYS-04, T4).** Les cinq règles d'écriture sont en tête de `src/physics.js` et le test P02 en contrôle la partie lexicale :
1. `Math` limité à `sqrt`, `abs`, `floor`, `imul`, `min`, `max` et `PI` ; `sin`, `cos`, `atan2` et `asin` seulement dans les blocs TRIG (conversions d'angles, limites de charnière), jamais dans le solveur ; pas d'opérateur de puissance (la contre-vérification de PHYS-04 relève le `**` de la ligne 11 du prototype).
2. Ordre fixe : corps par indice croissant, cellules z puis x, statiques par indice, contacts dans l'ordre d'émission, articulations par emplacement ; ni `Map`, ni `Set`, ni tri, ni énumération de clés dans `step()`.
3. Grandeurs dérivées canoniques, recalculées par une seule fonction à la création, en fin de sous-pas et à la restauration, depuis les seules valeurs sauvegardées (masse inverse sauvegardée, jamais 1/(1/m)).
4. L'empreinte couvre tous les réglages ; l'instantané la porte.
5. −0 ramené à +0 par `x + 0` en fin de sous-pas, dans le cache d'impulsions et dans les articulations.

Le temps n'arrive que par `dt` ; les durées sont converties une fois en sous-pas entiers (§2), et les minuteries comptent des sous-pas.

**Stockage (étape 2a).** Colonnes de tableaux typés de NB = capacity + 1 lignes ; la ligne 0 est le monde (masse inverse, inertie et vitesse nulles, Q = [0, 0, 0, 1], `MAT` = −1) et `restore` exige qu'elle le reste. Sauvegardés, dans l'ordre de l'instantané : SH, FL (bits 1 vivant, 2 endormi, 4 cinématique, 8 en attente, 16 perdu, 32 renforcé, 64 en mouvement), GEN, GRP, MSK, MAT, P, Q, V, H, HR, IM, MO, FR, RE, ST, AT, FN (Int32, minuteries en sous-pas entiers, saturées à 2³¹ − 1), RP, KT, KN. Dérivés, recalculés par `inertia(i)`, `tolerance(i)` (SL = min(slop, slopRatio × plus petite demi-taille)) et `derive(i)` (R, BB, IW, formules du prototype) à la création, en fin de sous-pas et à la restauration : R, IL, IW, BB, FB, SL, PP, PQ. Le plus haut index utilisé + 1 est le `n` de l'instantané. Statiques : centre, demi-tailles, rotation × 9 (identité pour une AABB), drapeau OBB, AABB, frottement, rebond, matière, estampille, grille en lignes compressées (`GW = floor((maxX − minX)/cell) + 1`). Contacts : les colonnes du prototype, plus cIa et cIb (masses inverses participantes), cSl (tolérance), cSR (séparation de relaxation, voir le solveur), et par paire le premier point et le nombre de points.

**Ordre d'un sous-pas (étape 2a)** : (1) activation de tous les corps en attente, par indice croissant (ST = AT = FN = 0, RP = P) ; (2) liste des actifs, les éveillés dynamiques par indice croissant, et sortie immédiate si elle est vide, **sans vider le cache** ; (3) phases large et étroite ; (4) préparation ; (5) gravité et amortissement ; (6) démarrage à chaud ; (7) `iterations` passes avec biais ; (8) bornage des vitesses, intégration des positions et des quaternions ; séparation de relaxation ; (9) `relaxIterations` passes sans biais ; (10) restitution, puis nouveau bornage ; (14) reconstruction du cache ; (15) réveils différés ; (17) îles et sommeil ; (20) −0 ramené à +0 sur P, Q et V des participants, puis `derive`. Les numéros sont ceux du §5.2 de la mission ; les étapes 11, 12, 13, 16, 18 et 19 (événements, ruptures, règles de réveil, plan de perte, repli, gouverneur) viennent avec leurs étapes du module. Le temps passe par un accumulateur à tolérance e = tick·1e-9, au plus `maxSubsteps` sous-pas par appel, le reste jeté et compté (`droppedSteps`).

**Phase large.** Deux grilles de corps en listes chaînées (tête par cellule, suivant et élément par entrée) : la grille active, refaite à chaque sous-pas avec FB = BB élargie de min(|V_axe|, maxLinear)·h + margin, et la grille dormante, refaite quand l'ensemble des dormeurs change, avec FB = BB. On insère par indice décroissant en tête de liste, si bien qu'une cellule se lit par indice croissant, comme les lignes compressées du prototype ; on ne remet à −1 que les cellules utilisées. Les entrées sont dimensionnées dans `addBody` et `restore` (borne des cellules qu'un corps peut couvrir, vitesse bornée comprise) : un sous-pas ne déborde ni n'alloue. Pour chaque actif a, cellules z puis x : statiques si `mask & 1` (estampille, AABB, `boxBox` avec la matrice de la statique, clé a·KM + NB + s), puis grille active (b > a) et grille dormante, dédoublonnage par la cellule du coin bas du recouvrement, filtre de groupes, marge margin + (|v_a| + |v_b|)·h, `boxBox(lo, hi)`, clé lo·KM + hi, KM = NB + maxStatics + 1.

**Phase étroite.** `boxBox`, `face` et `clip` du prototype, tels quels (15 axes, préférence aux faces 0,95·x + 0,002 pour B et 0,95·x + 0,01 pour les arêtes, découpage à 4 points au plus) ; la dalle de `ground` est une statique comme les autres, côté B, et n'a plus de chemin à part (`boxGround` du prototype disparaît).

**Solveur.** Celui du prototype, en contrainte souple (constantes en SCR[5..8]). Un côté qui ne participe pas (le monde, un dormeur) a une masse inverse nulle (cIa, cIb) et des termes angulaires nuls (ligne 0 de IW) ; on lit sa vitesse, et ce qu'on lui écrit ajoute des zéros exacts. Séparation : cS + cSl dans les passes avec biais ; **dans la relaxation, cSR = cS + (d_B − d_A)·n + cSl, avec d = v·h + (ω·h) × r pour un corps qui vient de bouger** (0 sinon), calculé une fois par point après l'intégration. C'est exactement le terme D du prototype, sans tableau D : voir le §7, point 1.

**Sommeil (étape 2a).** Minuteries entières : ST + 1 sous les seuils, sinon 0 ; AT + 1. Union-find sur les paires dont les deux côtés participent (la plus grande racine sous la plus petite) ; une île dont le plus petit ST atteint `sleepSteps` s'endort, vitesses à 0. Réveil provisoire (§7, point 2) : un dormeur touché par un actif est marqué, puis réveillé seul à la fin du sous-pas (bit effacé, ST = AT = FN = 0, RP = P, `stats.wakes` + 1). Le cache n'est jamais vidé quand rien n'est actif : une pyramide endormie garde ses 492 entrées.

**Cache d'impulsions.** Reconstruit à chaque sous-pas depuis les points frais (clé, identifiant, impulsions, −0 ramené à +0), entrées d'une même clé contiguës ; table d'adressage ouvert de TS cases (plus petite puissance de 2 ≥ 2·maxContacts, par une boucle) dont on ne vide que les cases utilisées. Démarrage à chaud par identifiant de point, comme dans le prototype. Un seul jeu de tableaux à l'étape 2a : les deux jeux alternés du §5.1 viennent avec la règle c du réveil (étape 6).

**Instantané, restauration, hachage.** Format du §4.13 de la mission (sans `j` jusqu'à l'étape 9). `restore` valide tout avant d'écrire (en-tête, longueurs, nombres finis, champs entiers, ligne du monde, lignes libres à FL = 0, chaque corps vivant, cache) et lève `Error('FPhysics.restore: …')` sans rien changer ; puis copie avec −0 → +0, remet à neuf les lignes au-delà de n, recalcule les dérivées, fait PP = P et PQ = Q, reconstruit la table du cache et marque les grilles. `hash` : FNV-1a de n, acc, des tableaux de corps des lignes 0 à n − 1 (flottants par mots de 32 bits, vues créées une fois), puis du cache.

**Rendu.** `pose` interpole PP → P et PQ → Q (court chemin, normalisé), relève de SL/2, et pose la boîte réelle sur le bas de sa boîte de collision sur chaque axe où H > HR ; `addBody` fait PP = P, PQ = Q, si bien que `pose` est juste avant le premier pas.

**Actions (étape 2b).** Trois fonctions internes : `push(i)` applique l'impulsion rangée dans SCR[25..27] au point SCR[22..24] (formules d'`impulseAt`), `cap(i)` borne les vitesses d'un corps, et `rouse(i)` fait le réveil explicite. `clamp`, le bornage de fin de sous-pas, appelle désormais `cap` : mêmes opérations dans le même ordre, hachages et coûts inchangés (compare-E2a.txt, §5). Le parcours de `blast` est celui d'`explode` ; à masse physique égale, et une fois les bornes de vitesse appliquées aux deux, les vitesses données sont celles du prototype, bit à bit pour 175 des 200 corps de `blast200` et à 3,3e-16 près en relatif pour les autres (scenes-prototype.txt).

**Zéro allocation.** Pas de `new`, de littéral, de fermeture ni de chaîne dans `step()` ; les flottants passent par SCR, les entiers par ISCR. Les réglages lus pendant le pas sont recopiés une fois dans SCR[14..21] : `w.config` est un objet ordinaire, un nombre qu'on y lit arrive emballé, et la première forme de `collide()`, qui lisait `margin` et `maxLinear` dans `config`, faisait emballer par V8 les trois vitesses de chaque corps (2 656 octets par sous-pas sur `pyramid55`, 504 sur `stack10` ; 24 après correction, le coût de la boucle de mesure elle-même). Mesure indicative au §5 ; le banc du §8.2 de la mission la refera.

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
| P02 | taille ≤ 80 000 octets, motifs interdits, membres de `Math`, blocs TRIG appariés, en-tête ; le contrôle est lui-même vérifié sur 24 altérations du vrai source, qui doivent toutes être détectées | 1 | vert (étape 1 : 6 518 octets ; étape 2a : 59 932 octets, 21 799 en gzip -9 ; étape 2b : 63 989 octets, 23 400 en gzip -9, au-dessus de la cible de 60 000, en diagnostic) |
| P03 | 1 000 triplets d'angles : norme de q à 1e-12 de 1 (mesuré 3,3e-16), matrice égale à celle du jeu à 1e-12 (8,9e-16), aller-retour à 1e-9 (4,2e-15), blocage de cardan à 1e-6 (1,5e-8) | 1 | vert |
| P04 | 58 jeux d'options invalides refusés, valeurs par défaut, durées en sous-pas, empreinte recalculée selon la mission, chacun des 49 réglages la change | 1 | vert |
| P05 | chute libre exacte : y = 3,95 et vy = −12 à 1e-9 après 120 sous-pas (mesuré 3,950000000000008 et −11,999999999999973) ; `step(1/240)` renvoie 0 puis 1 | 2a | vert |
| P06 | caisse posée à 1 mm : y = 0,394672 à 2 s (enfoncement 5,33 mm), endormie au sous-pas 63, vitesses nulles, `pose` relevée de SL/2 à 1e-12 | 2a | vert |
| P11 | `stack10` NOSLEEP : dérive 30,69 / 16,83 / 23,39 mm à 1 / 5 / 10 s (seuil 30 mm à 10 s) ; plus bas sommet −9,24 mm de 1 à 10 s (seuil −12 mm), −23,56 mm au sous-pas 21 ; tassement du sommet 86,06 mm ; par défaut, endormie au sous-pas 123 (1,025 s, seuil 4 s) | 2a | vert |
| P12 | `pyramid55` NOSLEEP : dérive 9,63 / 16,39 / 19,39 mm (seuil 20 mm) ; plus bas sommet −11,73 mm de 1 à 10 s, −13,71 mm au sous-pas 16 ; par défaut, endormie au sous-pas 87 (0,725 s, seuil 10 s) | 2a | vert |
| P19 (boîtes) | 800 tirs contre le mur de 12 cm (x de 5 à 5,12) à 120 Hz, `maxLinear: 60`, 14, 24, 30 et 40 m/s : 0, 0, 0 et 0 traversées ; centre le plus avancé à x = 4,9205, 4,8785, 4,9098 et 4,8276 | 2b | vert |
| P41 | chaque chaîne calculée deux fois dans le même processus, identique : `stack10` et `pyramid55` à 600 sous-pas (5af686dc/283b179e, f1a824a1/6a47467f), `rubble300` et `blast200` à 300 (e9d0d0c3/3975d516, 01b0c057/70fd66db, souffle au sous-pas 60) ; `hashes(F, 300)` redonne ces deux-là | 2b | vert |
| P45 | aller-retour JSON dans un monde neuf (`create(w.config)` et les mêmes statiques, sans corps) : `stack10` à 100 sous-pas (instantané de 7 022 caractères, 40 entrées de cache), `pyramid55` endormie à 1 200 (44 043 caractères, 492 entrées), `rubble300` à 240 (298 éveillés, 233 899 caractères, 1 548 entrées) et `blast200` à 300 avec le souffle à 240 (199 éveillés, 120 227 caractères, 525 entrées) ; même hachage, même instantané, puis même hachage 300 sous-pas plus tard, `tick` rejoué des deux côtés | 2a, 2b | vert |
| P46 | `snapshot()` ne change pas le hachage ; un instantané tous les 10 sous-pas ne change rien en 300 sous-pas (`stack10`, `pyramid55`) | 2a | vert |
| Étape 2a (6 tests) | descriptions refusées (26 cas), handles, `body()`, masses bornées, `minHalf` ; attente, création endormie, réveil différé ; `setStatics` (résultat, empreinte, refus atomiques, `mask & 1`, réveil) ; `step` (erreurs, 1/30 → 4, 0,2 → 8 et 16 sous-pas jetés, découpage 1/60, 1/120, 1/30 identique, même chaîne dans un domaine `vm`), grille trop grande refusée ; 13 instantanés corrompus refusés sans rien changer, `ignoreStatics`, zéros négatifs ; `pose`, `matrix`, tôle réelle, horloge sans effet sur la simulation | 2a | verts |
| Étape 2b (3 tests) | `impulse` et `setVelocity` : handles invalides, `TypeError` sans changement, Δv = J/m au centre, Δω = IW(r × J) au coin (−2,4 ; 0 ; 2,4), seul le corps touché se réveille, ST remis à 0 d'un éveillé, vitesse gardée d'un corps en attente, bornes 40 m/s et 30 rad/s, −0, aller-retour JSON ; `blast` : refus, portée (6,1 m ≥ 6 : intacte), corps tourné, corps en attente ignoré, plafond de 14 m/s, `maxDv`, centre dans un corps (poussé tout droit vers le haut), `occlude: false` accepté ; scènes : 300 corps et 6 statiques, matières `i % 5`, masses ; `rubble300` dort entièrement avant 8 s (P22, première partie) ; `blast200` sans `tick` (P29 a, première partie) : 198 corps poussés vers l'extérieur à 14 m/s au plus, 2 hors de portée intacts, puis 15 s : centres dans les murs, tout dort | 2b | verts |
| P44, première partie | `rubble300` à 300 sous-pas par `step(1/60)` × 150, `step(1/120)` × 300 et `step(1/30)` × 75 : 3975d516 trois fois, la fin de la chaîne de P41 (`stack10` est vérifié depuis l'étape 2a) | 2b | vert |

**Étape 2a, module contre prototype** (13 novembre, Mac M5, Node 24.18, charge 3,3 à 4,3 ; [compare-prototype.txt](../preuves/module-physique/E2a/compare-prototype.txt), script [compare-prototype.mjs](../preuves/module-physique/E2a/compare-prototype.mjs)). Le prototype tourne avec `ground: false` et la boîte statique (−64, −0,5, −64)–(64, 0, 64), frottement 0,8, rebond 0,05 : la dalle que FPhysics construit pour `ground: 0`. Sur 1 200 sous-pas, P, Q et V de chaque caisse sont **identiques bit à bit** après chaque sous-pas, avec et sans sommeil, pour `stack10` et `pyramid55` (156 000 et 858 000 valeurs). Les diagnostics sont donc ceux du prototype sur la dalle ([prototype-avant.txt](../preuves/module-physique/E2a/prototype-avant.txt), variante run08 du chef) :

| Mesure | `stack10` | `pyramid55` | Prototype sur le plan (`drift.mjs`) |
|---|---|---|---|
| dérive à 1 / 5 / 10 s, NOSLEEP | 30,69 / 16,83 / 23,39 mm | 9,63 / 16,39 / 19,39 mm | 23,96 / 21,02 / 12,57 mm et 11,39 / 14,71 / 14,70 mm |
| tassement du sommet à 10 s | 86,06 mm (attendu ≈ 85) | — | 83,67 mm |
| plus bas sommet, régime (1 à 10 s) | −9,24 mm (sous-pas 1 113) ; −8,5 mm à la fin | −11,73 mm (sous-pas 195) ; −10,1 mm à la fin | — |
| plus bas sommet, transitoire | −23,56 mm (sous-pas 21) | −13,71 mm (sous-pas 16) | — |
| sommeil complet, réglages par défaut | fin du sous-pas 123 (1,025 s) | fin du sous-pas 87 (0,725 s) | run08 lit 1,03 s et 0,73 s : `stats.awake` y est compté au début de l'appel suivant, même sous-pas |

Le prototype garde aussi ses valeurs de référence : `drift.mjs` 12,57 / 14,70 mm ; `restore.mjs` IDENTICAL avec le cache (17089485, 3fa55997, 6d172292) ; `restore2.mjs` sans écart. Chaînes du module à 300 sous-pas (`runChain`) : `stack10` b4d9490c/283b179e, `pyramid55` 0d00077d/6a47467f.

**Allocations, indicatives** ([allocations.txt](../preuves/module-physique/E2a/allocations.txt)) : après 3 000 sous-pas de mise en route, 24 octets par sous-pas pour `stack10`, `pyramid55` et un monde vide, autant qu'une boucle qui appelle une fonction vide : rien de mesurable dans le pas. La première forme (réglages lus dans `config`) allouait 504 et 2 656 octets par sous-pas (§4, zéro allocation).

### Étape 2b : scènes, actions et premier banc

Mesures du 13 novembre, Mac M5 partagé par plusieurs agents, Node 24.18, domaine principal ; preuves dans [E2b](../preuves/module-physique/E2b/). Les chiffres absolus varient du simple au double d'une heure à l'autre sur cette machine (prototype, `rubble300`, moyenne par pas : 431 µs à charge 3,2 au départ, 894 à 1 012 µs à charge 5,5 à 6,7 pendant le banc) : seuls les rapports d'une même passe, mesurés en alternance, se comparent.

**Scènes** ([scenes-prototype.txt](../preuves/module-physique/E2b/scenes-prototype.txt), script [scenes-prototype.mjs](../preuves/module-physique/E2b/scenes-prototype.mjs)). `rubble300` et `blast200` sont celles du prototype, mêmes tirages dans le même ordre : centres et demi-tailles identiques (===), quaternions à 2,2e-16 près (le module les normalise une seconde fois), masses identiques, frottements et rebonds identiques ; les statiques sont celles des `addStatic` du prototype, lues dans sa source (`YARD`, 5 boîtes ; `WALLS30`, 4 murs), plus la dalle de `ground: 0` à la place du plan. Masses : `rubble300` de 0,50 à 9,89 kg, dont 269 sur 300 bornées à 3 kg par le module ; `blast200` de 14,11 à 59,26 kg, aucune bornée. Les scènes rendent `statics` (les boîtes données à `setStatics`), et `twin(F, scene)` en fait le monde vide de P45.

**Banc** ([bench.txt](../preuves/module-physique/E2b/bench.txt), [bench.json](../preuves/module-physique/E2b/bench.json), [bench-passe2.json](../preuves/module-physique/E2b/bench-passe2.json)) : `node tools/physics-bench.mjs`, 5 répétitions alternées module et prototype dans le même processus, minimum de chaque sous-pas, statistiques sur les sous-pas actifs à partir du 20e ; deux passes, charge 5,5 → 6,3 puis 6,5 → 6,7.

| Scène (sous-pas) | Module : médiane / moyenne µs | Prototype : médiane / moyenne µs | Module/prototype : moyenne ; total apparié | µs par corps éveillé, module / prototype | Sommeil complet, module / prototype |
|---|---|---|---|---|---|
| `stack10` (1 200) | 30,3 / 30,5 ; 22,8 / 23,0 | 42,5 / 42,1 ; 34,5 / 33,9 | ×0,73 ; ×0,73 — ×0,68 ; ×0,69 | 3,08 / 4,21 ; 2,33 / 3,39 | 1,02 s / 1,02 s |
| `pyramid55` (1 200) | 359,3 / 346,1 ; 260,3 / 261,8 | 271,7 / 286,6 ; 266,6 / 267,3 | ×1,21 ; ×1,45 — ×0,98 ; ×1,02 | 6,39 / 5,21 ; 4,83 / 4,86 | 0,72 s / 0,77 s |
| `rubble300` (1 800) | 1 156,7 / 1 053,6 ; 1 078,6 / 969,9 | 1 011,8 / 1 011,7 ; 905,2 / 894,2 | ×1,04 ; ×0,40 — ×1,08 ; ×0,42 | 3,67 / 3,50 ; 3,37 / 3,10 | 4,89 s / 11,93 s |
| `blast200` (1 500, souffle à 240) | 319,9 / 280,8 ; 384,7 / 326,2 | 255,4 / 225,8 ; 308,1 / 268,5 | ×1,24 ; ×0,97 — ×1,21 ; ×1,11 | 2,25 / 1,89 ; 2,62 / 2,25 | 6,38 s / 7,08 s (4,38 s / 5,08 s après le souffle) |

Lecture :
- les deux passes ne s'accordent que sur `stack10`, `rubble300` et `blast200` ; la pyramide, 67 sous-pas actifs seulement, va de ×0,98 à ×1,21 ;
- par sous-pas actif, le module coûte de 4 à 8 % de plus que le prototype sur `rubble300` (5 à 9 % par corps éveillé), et de 21 à 24 % de plus sur `blast200` (16 à 19 % par corps éveillé). Une cause visible : le sol est une dalle statique testée par le SAT complet, là où le prototype avait un plan (`boxGround`) ; d'où plus de tests (pics de 1 342 contre 1 160 sur `rubble300`, 446 contre 317 sur `blast200`). Le test spécialisé boîte orientée contre AABB du §5.10 de la mission, prévu en option à l'étape 11, vise ce coût ;
- sur toute la scène, `rubble300` coûte 0,40 à 0,42 fois le prototype, parce qu'il s'endort 2,4 fois plus tôt.

Cibles du §8.2 de la mission : `rubble300`, médiane par sous-pas 1,157 et 1,079 ms à charge 5,5 à 6,7, sous les 2,4 ms de la machine chargée et même sous les 1,2 ms de la machine calme ; `blast200`, moyenne 0,281 et 0,326 ms, sous les 0,5 ms. Les modes `reveil`, `monde-synthetique`, `articulations`, `--courbe`, `--alloc`, `--instantane` et `--statiques` viennent à l'étape 11.

**Rien de changé pour l'existant** ([compare-E2a.txt](../preuves/module-physique/E2b/compare-E2a.txt)) : `node tools/physics-bench.mjs --compare REF`, REF étant une copie de `src/physics.js` de l'étape 2a (commit `16820ec`) : mêmes hachages finaux (283b179e, 6a47467f, 5d011c56) et mêmes coûts, ×0,99, ×1,00 et ×0,99 en moyenne (rapports appariés ×0,94, ×0,98 et ×0,97) ; `blast200` n'existe pas à l'étape 2a.

**Chaînes** ([hashes.txt](../preuves/module-physique/E2b/hashes.txt)) : `node tools/physics-bench.mjs --hashes` donne `stack10` 5af686dc/283b179e, `pyramid55` f1a824a1/6a47467f, `rubble300` 74483875/5d011c56, `blast200` a17a182e/953773b5, les mêmes dans deux processus ; aussi à 300 et 150 sous-pas (`--pas`). Elles ne sont pas figées : P50 le fera à l'étape 12.

**Sommeil de `rubble300`** ([sommeil-rubble300.txt](../preuves/module-physique/E2b/sommeil-rubble300.txt), script [sommeil-rubble300.mjs](../preuves/module-physique/E2b/sommeil-rubble300.mjs)) :

| Variante, mêmes pièces | Sommeil complet |
|---|---|
| module, masses bornées à [3, 120] (réglages par défaut) | 4,89 s |
| module, masses d'origine (`massMin` 0,5, `massMax` 160) | 5,80 s |
| prototype sur son plan, masses d'origine | 11,93 s |
| prototype sur son plan, masses bornées | 5,17 s |
| prototype sur la dalle, masses d'origine | 19,42 s |
| prototype sur la dalle, masses bornées | 15,32 s |

À sol et masses égaux, le prototype met trois fois plus longtemps (15,32 s contre 4,89 s) : c'est le réveil qui diffère (le prototype réveille l'île entière au premier contact, le module un seul corps, règle provisoire du §7, point 2). Les masses bornées raccourcissent aussi l'éboulement. La seconde partie de P22 (étape 6), mesurée aujourd'hui : une impulsion de (6, 0, 0) sur la pièce la plus haute du tas endormi réveille de proche en proche 276 pièces (attendu ≤ 16), tout se rendort en 2,19 s (attendu < 2 s), 102 pièces bougent de plus de 2 mm (attendu ≤ 16). Le prototype réveillait 286 corps pendant 13,83 s.

**Allocations, indicatives** ([allocations.txt](../preuves/module-physique/E2b/allocations.txt), PHYS-05) : `rubble300` éveillée après 300 sous-pas, 24 octets par sous-pas ; `blast200` juste après le souffle, 25 : le coût de la boucle de mesure, rien dans le pas. Les actions n'allouent rien avec des arguments constants (1 à 2 octets par appel, comme une fonction vide). Avec des arguments calculés à chaque appel, `impulse` coûte 65 octets par appel et `setVelocity` 13 : la mise en boîte des nombres neufs passés à une fonction qui n'est pas mise en ligne, c'est-à-dire le mécanisme de PHYS-05, du côté de l'appelant. C'est permis hors du pas (§4.7 de la mission) et négligeable pour quelques tirs par image.

Les autres mesures du §8.2 de la mission (courbe, instantanés de `rubble300`, statiques, assemblage, navigateur) viendront aux étapes 11 et 12.

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
- **1. Séparation de relaxation (écart à confirmer par David).** La mission dit qu'il n'y a pas de tableau D, car « avec un sous-pas par détection, il vaut toujours 0 pendant la résolution » (§5.2), et que la séparation courante vaut cS + cSl (§5.6). C'est vrai des passes avec biais, pas de la relaxation : elle vient après l'intégration des positions, et le prototype y lit D = v·h et ω·h du sous-pas. La lecture littérale (cS + cSl partout) fait échouer P11 : dérive 52,07 mm à 10 s (seuil 30), plus bas sommet −18,72 mm (seuil −12) ; la pyramide passe (11,45 mm, −9,49 mm) (variante 2 de compare-prototype.txt). Le module garde donc le terme exact du prototype, calculé une fois par point dans cSR, sans tableau D ni cumul : c'est ce qui donne l'identité bit à bit. À confirmer, ou à remplacer par une autre règle de relaxation qui tienne P11.
- **2. Réveil provisoire.** Jusqu'à l'étape 6, tout contact entre un actif et un dormeur réveille ce dormeur, seul, à la fin du sous-pas (le prototype réveillait toute l'île, tout de suite). Les règles a à e du §5.7, la scission et le repli remplaceront cette règle ; aucune scène de l'étape 2a ne réveille d'île (`stack10` et `pyramid55` s'endorment d'un bloc). À l'étape 2b, `rubble300` s'endort sans un seul réveil ; mais l'impulsion de P22 sur le tas endormi réveille 276 pièces de proche en proche (§5) : c'est ce que les règles de l'étape 6 doivent ramener sous 16.
- **3. Attente simple.** Tous les corps en attente sont activés au sous-pas suivant ; `spawnBudget` (étape 8) les étalera. La scène « attente » de P45 (48 caisses d'un coup) viendra avec lui.
- **4. Décor.** Pas de fusion ni de voisines (étape 4), pas de sols ni d'OBB (étape 3, `floors` non vide refusé) ; un décor changé réveille tous les dormeurs et retire les entrées corps-statique du cache, en attendant la différence exacte de l'étape 10.
- **5. Plus bas sommet de P11 et P12.** La mission demande « aucun plus bas sommet sous −0,012 ». La chute initiale de la pile (les caisses sont posées sans enfoncement, et le contact est souple) descend un instant à −23,56 mm au sous-pas 21 (pyramide : −13,71 mm au sous-pas 16), exactement comme le prototype. Les tests vérifient donc le seuil à chaque sous-pas de 1 s à 10 s (régime : −9,24 et −11,73 mm, −8,5 mm à la fin comme l'attend la mission), et donnent le minimum de tout l'essai en diagnostic. À confirmer.
- **6. Marge de P12.** La dérive de la pyramide vaut 19,39 mm pour un seuil de 20 mm : 0,61 mm de marge. Le prototype sur la dalle donne la même valeur ; sur le plan, il donnait 14,70 mm. Toute étape qui change l'ordre des paires ou le solveur (faces internes, réveil) doit la remesurer.
- **7. Compléments de validation.** `restore` refuse aussi un `acc` hors de [0, tick), une ligne 0 qui n'est plus le monde, une ligne libre avec des drapeaux, et les drapeaux ou formes qui n'existent pas encore (cinématique, perdu, renforcé, en mouvement, sphère, capsule) ; `create` refuse une grille de plus de 1 048 576 cellules (§3). `stats.awake` compte les participants encore éveillés en fin de sous-pas (les réveillés de la fin du sous-pas n'y sont pas).
- **8. Bornes de vitesse dans les actions (à confirmer par David).** `impulse`, `setVelocity` et `blast` bornent |v| à `maxLinear` et |ω| à `maxAngular` tout de suite, comme `addBody` depuis l'étape 2a. La mission ne le dit pas pour les actions, mais `restore` refuse un corps au-delà de ces bornes (§4.13 de la mission) : sans cela, un instantané pris juste après un souffle, avant le pas suivant, ne se restaurerait pas. Le prototype ne bornait qu'au sous-pas suivant, après la résolution : son `explode` met 85 des 198 corps poussés de `blast200` au-delà de 30 rad/s, et sa résolution voit ces vitesses une fois. Le module donne donc d'autres trajectoires après un souffle ; une fois les bornes appliquées aux deux, les vitesses données sont les mêmes (scenes-prototype.txt, partie 3).
- **9. Enfoncement après le souffle (étape 7).** P29 (a) demande, dans les 15 s qui suivent le souffle de `blast200`, aucun sommet sous −15 mm. Mesuré : −48,67 mm à la fin du sous-pas 259, 19 sous-pas après le souffle, contre −9,05 mm avant lui ; le prototype, sur son plan : −55,67 mm, 2 sous-pas après le souffle (scenes-prototype.txt, partie 4). Le test de l'étape 2b ne vérifie donc que la première partie de P29 (a) (directions, plafond, portée, centres dans les murs, sommeil) et donne le plus bas sommet en diagnostic. Hypothèse à vérifier à l'étape 7 : des boîtes lancées à 30 rad/s, dont la marge spéculative ne compte que la vitesse linéaire.
- **10. Occultation.** `occlude` est validé mais sans effet jusqu'à l'étape 7 : tout corps à portée est poussé, même derrière un mur (P29 b viendra avec elle).
- **11. Contrôles des actions.** La mission ne nomme pas les erreurs des actions. Le module lève `TypeError` pour un nombre non fini (et, pour `blast`, un rayon, une force ou un `maxDv` négatif, ou un `occlude` qui n'est pas un booléen), sans rien changer, et renvoie `false` pour un handle invalide, cinématique ou perdu. Un corps en attente garde la vitesse donnée par `impulse` ou `setVelocity` et n'est pas réveillé (il n'est pas endormi) ; un corps éveillé n'est compté dans aucun réveil, seul son ST repart de 0, comme dans le prototype. À confirmer.
- **12. Taille.** `src/physics.js` fait 63 989 octets à l'étape 2b (23 400 en gzip -9) : sous la limite de 80 000 de P02, au-dessus des 60 000 visés, avec un diagnostic. Les étapes 3 à 10 ajoutent sphères, capsules, sols, faces internes, réveil, requêtes, événements, budgets et articulations : au rythme des étapes 2a et 2b, la limite sera atteinte avant l'étape 11. Les lignes de commentaire font 12 226 octets (19 %), dont l'en-tête, les règles et les indices de SCR que la mission demande ; le reste est du code. À arbitrer à mesure : compactage, ou limite revue par David.
- Les autres limites et les questions ouvertes de la mission (cadence 120 Hz × 1 ou 60 Hz × 2, simulation sans FPhysics, barils, taille des instantanés, épaisseur des dalles, limites de charnière, seuils de réveil, pièces d'épave, enfoncement souple, écarts volontaires avec la fiche) seront tranchées ou reprises ici à mesure des étapes.
