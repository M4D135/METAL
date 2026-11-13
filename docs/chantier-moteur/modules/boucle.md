# Module « boucle » — FLoop (pas fixe) et FSchedule (ordonnanceur)

Modules génériques du moteur FERRO, livrés par la voie « boucle ». Rien n'est branché dans le jeu :
le raccord est décrit en section 5, non appliqué. Base : `71eca61` (branche `chantier/module-boucle`).

## 1. Rôle et périmètre

Deux modules génériques du moteur FERRO, prêts à brancher dans METAL :

- **`FLoop`** (`src/loop.js`, 6 042 octets) : pas fixe de simulation de 1/60 s, avec accumulateur, verrouillage sur la
  période de l'écran, rattrapage borné à 5 pas et dette de temps bornée. `FLoop.aim` donne les angles de la vue à
  chaque image, `FLoop.track` interpole le rendu.
- **`FSchedule`** (`src/schedule.js`, 4 221 octets) : une file « image » budgétée en millisecondes (présentation,
  caches, sérialisation) et une file « sim » déterministe, budgétée en unités de travail.

Ce sont des scripts classiques qui posent chacun un global, comme `src/options.js`. Ils ne lisent aucune horloge, ne
tirent aucun hasard et ne savent rien de METAL (T-F24, S22) : le temps leur arrive en paramètre.

**Constats couverts.**

| Constat | Ce que livre la voie | Sections |
|---|---|---|
| STAB-06 (P1, lot 07 T1), qui absorbe LOOP-05 | pas fixe, verrouillage, dette bornée, interpolation ; une seule empreinte d'état pour 9 écrans ; écart temps simulé / temps réel sous un pas sur 10 minutes (réserve 2) ; réserves 3 et 4 reprises en limites | 2.2 à 2.7, 3, 4.1, 4.2, 6 |
| STAB-07 (P2, lot 07 T8) | ordonnanceur à deux files et ses 5 règles de déterminisme ; réserves 1 et 3 reprises au plan ; sur la vraie pré-synthèse audio, plus longue tranche −44 à −46 % au calme, PCM identique, sous les 32 ms de T8 | 2.8 à 2.12, 3.10, 4.3, 4.6, 5.11, 5.12 |
| DEMO-V3, côté interpolation | `track` : aucune image répétée, contre 50 % des images où le joueur avance à 120 Hz et 58 % à 144 Hz sans interpolation | 2.6 |
| PARA-V1 | la simulation reste sur le fil principal : le rappel de pas appelle `sim.step` dans le rappel rAF, avant le dessin | 4.2, 5.7 |
| MASTER-PROMPT §6, décision prise | pas fixe de 1/60 s, accumulateur, verrouillage, rattrapage borné à 5 pas, interpolation, rotation de la vue à chaque image. Elle remplace l'arbitrage « LOOP-05, FEEL-08, LOOP-08, SIM-12 » (pas variable) | tout le module |

Traités seulement dans le plan de raccord (section 5), sans rien appliquer :
- LOOP-06 : les impulsions restent en file jusqu'à une image qui a au moins un pas (5.6) ;
- LOOP-09 : `FOptions.frameGate`, déjà dans main, reste devant FLoop (5.4, 5.5, limite 6) ;
- LOAD-03 et l'arbitrage « LOOP-03, LOAD-03, SIM-01 » : instantané synchrone, écriture différée seulement en P2 (5.11) ;
- LOAD-13 : pré-synthèse audio, une tâche par tampon (5.12), mesurée sur la vraie synthèse sans rien brancher (4.6) ;
- PARA-V2 : l'écho `input.weapon` reste tel quel (5.14, question 5) ;
- l'arbitrage « RCPU-08, RGPU-09, LOOP-12, RGPU-02, LOOP-09 » : une seule estimation partagée de la période
  d'affichage (question 1).

**Hors périmètre** (§4.12 de la mission) :
- ni limiteur d'images ni `setLimit` : c'est LOOP-09, déjà dans `src/options.js` ;
- ni gouverneur de qualité ;
- ni worker, ni DOM, ni lecture d'horloge ;
- pas de pas à 120 Hz automatique : `hz:120` existe, le choix revient au jeu (question 2) ;
- ni regroupement des événements ni écho d'arme (lot 07 T2) ;
- aucune modification de `pumpNav`.

**Rien n'est branché dans le jeu.** Aucun fichier existant n'est modifié : `git diff --name-status 71eca61` ne montre
que des ajouts. Les deux modules ne sont pas dans la liste `modules` de `tools/build.py`, donc pas dans
`dist/index.html` (812 696 octets, inchangé), et leurs tests ne sont pas dans `npm test`. Le raccord est décrit en
section 5, non appliqué.

**Origine.**
- `REPRISE-ENVIRONNEMENT-2026-11-12.md` (section « Lot 07 — cadence ») est une piste. L'essai de ChatGPT n'a jamais été
  commité et il est perdu : rien n'en est repris.
- Un relais OpenCode du Spark avait commencé la voie (branche `spark/spark-wip/boucle`). Les fichiers qu'il avait
  laissés (squelette de ce document, `src/loop.js`, `src/schedule.js`, les deux suites de tests, l'outil d'horloge) sont
  repris aux étapes 0 à 4, après relecture ligne à ligne contre la mission. Ils sont renforcés là où ils étaient plus
  faibles que sa lettre (T-F18, T-F22, S10, S18, entre autres). Les étapes 5 à 8 sont écrites depuis la mission.

## 2. API

### 2.1 FLoop : forme, chargement, signatures

`src/loop.js` (6 042 octets, sha256 `2002052f16b930748cb33c59366686744d8f7ba0b05add3e517d6271e46214c5`) est
le code normatif du §4.5 de la mission, recopié octet pour octet. C'est un script classique, de la forme de
`src/motion.js` : `(function(G){'use strict';…G.FLoop={create,aim,track};})(typeof window!=='undefined'?window:globalThis);`,
sans `import` ni `export`. `tools/realm-loader.mjs` le repère par `G.FLoop=`. Le module ne lit aucune horloge,
ne tire aucun hasard et ne sait rien du jeu : le temps arrive toujours en paramètre (T-F24 le vérifie).

```
FLoop.create(options = {})        → loop
loop.advance(now, step)           → loop.frame   step : function (h, i) (mode rappel), undefined ou null (mode plan)
loop.observe(now)                 → loop.frame
loop.abort(done)                  → loop.frame
loop.reset()                      → loop.frame
loop.resetPeriod()                → loop.frame
loop.frame, loop.stats, loop.hz, loop.step, loop.stepMs      propriétés
loop.period, loop.locked, loop.acc, loop.debt                accesseurs en lecture
FLoop.aim(yaw, pitch, lookX, lookY, min = -Infinity, max = Infinity, out = {}) → out
FLoop.track({snap = 2})           → traqueur
traqueur.begin()
traqueur.save(id, x, y, z, a = 0)
traqueur.pose(id, x, y, z, a = 0, alpha = 1, out = {})        → out
traqueur.prune()
traqueur.clear()
traqueur.size                                                accesseur en lecture
```

**Unités et repères** (alignés sur METAL) :

| Grandeur | Unité, repère | Remarque |
|---|---|---|
| `now` d'`advance` et d'`observe` | ms, horloge de rAF (`performance.now()`) | jamais lue par le module |
| `h` passé au rappel de pas, `loop.step` | secondes, `1/hz` | `1/60 === STEP_SECONDS` de `tools/proof/scenarios.mjs` ; c'est le `dt` de `sim.step(dt,input)` |
| `loop.stepMs`, `frame.raw`, `frame.dt`, `frame.dropped`, `period`, `acc`, `debt`, les `stats.*Ms` | ms | `stepMs = 1000/hz` |
| `frame.alpha` | 0 à 1 | part du pas suivant déjà écoulée ; rendu = avant + (après − avant) × alpha |
| angles (`aim`, `track`) | radians | lacet non borné (il s'additionne) ; tangage borné par l'appelant (METAL : −1,2 à 1,2) |
| positions (`track`) | mètres, x y z du monde | `snap` = 2 m par défaut |

### 2.2 `FLoop.create(options)` — pas fixe de simulation

**Options** (seules `hz` et `maxSteps` sont validées ; les autres sont des réglages internes que le jeu ne change pas) :

| Option | Défaut | Rôle |
|---|---|---|
| `hz` | 60 | pas de simulation par seconde. Nombre fini de 1 à 1000, sinon `TypeError` |
| `maxSteps` | 5 | rattrapage maximal par image. Entier de 1 à 60, sinon `TypeError` |
| `maxFrameMs` | 250 | borne de l'intervalle brut ; le surplus va dans `stats.clampedMs` |
| `samples` | 30 | taille de l'anneau d'estimation de la période |
| `minSamples` | 8 | échantillons pour être « calibré », et nombre d'aberrants consécutifs qui vident l'anneau |
| `snap` | 0.2 | tolérance d'accrochage de l'intervalle à k périodes (part de période) |
| `sampleTol` | 0.3 | écart au-delà duquel un échantillon est aberrant (part de période) |
| `lock` | 0.01 | seuil d'entrée en verrouillage (écart relatif entre la période et un multiple du pas) |
| `unlock` | 0.02 | seuil de sortie du verrouillage (hystérésis) |
| `debtRate` | 0.1 | part de la dette résorbée à chaque image |
| `debtCap` | 2 | dette prise en compte par image avant le facteur `debtRate` (ms) |
| `fill` | 0.999 | remplissage de l'accumulateur à la remise en phase (en pas) |

**Méthodes et propriétés** : `advance(now, step)`, `observe(now)`, `abort(done)`, `reset()`,
`resetPeriod()`, plus `frame`, `stats`, `hz`, `step` (= `1/hz`, secondes), `stepMs` (= `1000/hz`) et
les accesseurs en lecture `period`, `locked`, `acc`, `debt`. Toutes les méthodes rendent `loop.frame`.

- `advance(now, step)` — une fois par image. `now` : horodatage rAF en ms (jamais lu par le module).
  - `step` fonction : mode **rappel**, appelé `step(h, i)` pour chaque pas (`h = 1/hz` en s, `i` de 0 à n−1) ;
    un retour `false` arrête l'image (le pas compte comme fait, le reste est abandonné dans `stats.abortedMs`).
  - `step` `undefined`/`null` : mode **plan** — `frame.steps` donne les pas à faire, l'appelant les exécute
    et appelle `abort(done)` s'il en fait moins. Toute autre valeur : `TypeError`.
  - Une exception du rappel remonte ; les pas commencés comptent comme faits, le reste comme abandonné,
    l'invariant de conservation reste vrai.
- `observe(now)` — met à jour période et verrouillage sans avancer le temps simulé (menus, pause, chargement).
- `abort(done)` — mode plan : ramène `frame.steps` à `done` (entier, 0 ≤ done ≤ `frame.steps`, sinon `TypeError`) ;
  `(frame.steps − done) × stepMs` va dans `stats.abortedMs`.
- `reset()` — remise en phase : le prochain `advance` fait exactement un pas, sans rattraper le temps écoulé ;
  garde période et verrouillage.
- `resetPeriod()` — oublie la période et déverrouille (changement d'écran ou de limiteur).

Usage type : `advance(now, step)` une fois par image en jeu ; `observe(now)` à chaque image présentée hors jeu ;
`reset()` à chaque reprise (entrée en jeu, fin de pause, retour d'onglet, fin de chargement) ; `resetPeriod()`
quand l'écran ou le limiteur change. Le détail du branchement est au plan de raccord (section 5).

### 2.3 L'image (`frame`) et les statistiques (`stats`)

`frame` est **le même objet** à chaque appel : copier ses valeurs avant l'appel suivant.

| Champ de `frame` | Sens |
|---|---|
| `steps` | pas faits (mode rappel) ou à faire (mode plan) dans cet appel |
| `alpha` | `clamp(acc/stepMs, 0, 1)` ; vaut `fill` quand c'est verrouillé |
| `raw` | intervalle brut retenu (ms, après la borne `maxFrameMs`) ; 0 au premier appel, et pour un doublon |
| `dt` | temps ajouté (ms) : `stepMs` au premier appel ; n × `stepMs` en verrouillage, avant plafond ; l'intervalle lissé hors verrouillage ; 0 sinon |
| `dropped` | temps abandonné par le plafond de rattrapage (ms) |
| `locked`, `period` | état après l'appel |

`stats` est cumulatif : exactement ces 11 clés, toutes à 0 au départ.

| Clé de `stats` | Sens |
|---|---|
| `frames` | appels d'`advance` traités (ni `now` non fini, ni horloge qui recule) |
| `steps` | pas exécutés |
| `zeroStepFrames`, `multiStepFrames` | images à 0 pas, à plus d'un pas |
| `realMs` | somme des intervalles bruts retenus |
| `droppedMs`, `clampedMs`, `abortedMs` | abandon par plafond, coupe à `maxFrameMs`, arrêt anticipé |
| `dilationMs` | temps de simulation ajouté ou retiré volontairement : premier pas, pas arrondis du verrouillage, remises en phase |
| `maxDebtMs` | maximum de \|debt\| |
| `lockChanges` | nombre d'entrées et de sorties de verrouillage |

### 2.4 Invariants de FLoop, et les tests qui les vérifient

1. **Conservation** — à 1e-6 ms près :
   `stats.steps × stepMs + (acc − fill × stepMs) = stats.realMs − debt − stats.droppedMs − stats.abortedMs + stats.dilationMs`.
   T-F12 (21 motifs, image par image, < 1e-6) ; T-F15, T-F17 et T-F19 (< 1e-9, arrêt anticipé, exception, remise en phase).
2. **Écart borné** — |debt| ≤ stepMs à tout moment. C'est le critère STAB-06 « écart temps simulé / temps réel
   inférieur à un pas », hors abandons voulus (images longues, arrêt anticipé) et hors dilatation du verrouillage. T-F13.
3. **Dilatation bornée** — |stats.dilationMs| ≤ stepMs + 1 % de stats.realMs. Verrouillée, la simulation suit
   l'écran : à 59,94 Hz elle prend 0,0944 % de retard (−566,65 ms sur 10 minutes), voulu et compté. T-F12, T-F07.
4. **Bornes** — 0 ≤ frame.steps ≤ maxSteps, 0 ≤ alpha ≤ 1 ; verrouillé ⇒ alpha = fill. T-F12 (image par image,
   21 motifs), T-F05, T-F14.
5. **Premier pas** — le premier appel, ou le premier après `reset()`, fait exactement un pas. T-F04, T-F19.
6. **Déterminisme** — mêmes appels, mêmes sorties, au bit près. T-F24 (deux exemplaires, 10 000 images, `Object.is`
   sur alpha), T-F16 (mode plan et mode rappel donnent les mêmes pas).

### 2.5 `FLoop.aim(yaw, pitch, lookX, lookY, min = -Infinity, max = Infinity, out = {})` — angles de la vue

Rend `out`, avec `out.yaw` et `out.pitch` : les angles à afficher dans l'image, c'est-à-dire les angles de la
simulation plus le regard pas encore consommé. Un `lookX` ou un `lookY` non fini, ou qui n'est pas un nombre,
compte pour 0. Les autres champs de `out` ne sont pas touchés ; sans `out`, chaque appel rend un objet neuf.

Les opérations sont **exactement** celles du pas de simulation de METAL (`src/simulation.js`, dans `step`) :

```js
p.yaw+=Number.isFinite(input.lookX)?input.lookX:0;p.pitch=clamp(p.pitch+(Number.isFinite(input.lookY)?input.lookY:0),-1.2,1.2);
// avec, en tête du fichier : const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
```

Quand le pas suivant consomme ce regard, la simulation arrive donc **au bit près** à l'angle déjà affiché : la
rotation de la vue reste appliquée à chaque image, sans latence ajoutée et sans saut (MASTER-PROMPT §6). C'est
la prédiction de PARA-05, dont la contre-vérification réfute le dessin hors du rappel rAF mais garde « la visée
peut être prédite » ; sur le fil principal il n'y a rien à recaler, puisque `aim` repart de l'état de la
simulation à chaque image.

- **Lacet** : non borné, il s'additionne et n'est jamais replié (`aim(3, 0, 1, 0).yaw` vaut 4).
- **Tangage** : borné par `min` et `max`. Aucune borne par défaut (module générique) ; METAL passe −1,2 et 1,2.
- **Conditions d'exactitude**, à respecter au raccord :
  1. `aim` reçoit exactement la valeur que le prochain pas mettra dans `input.lookX` et `input.lookY` (le même
     nombre flottant). Le regard s'accumule dans une seule variable par axe (souris, toucher, touches de rotation
     × dt × 1,9, manette), qui sert à `aim` à chaque image puis au premier pas qui la consomme, et qui est remise
     à 0 après ce pas. Si le regard est transformé avant la simulation (quantification d'un enregistrement de
     démo, lot 13), c'est la valeur transformée qui va à `aim`.
  2. Les bornes passées à `aim` sont celles du pas (−1,2 et 1,2).
  3. Quand `step` quitte avant de consommer le regard (partie gagnée, mort, `checkPlayerBounds`), il faut vider
     le regard en attente : sinon l'image affiche un regard que la simulation n'appliquera jamais.
- **Borne par pas** : le tangage est borné une fois par pas, sur le regard cumulé depuis le pas précédent, et
  non plus à chaque image. Un regard qui dépasse la borne puis revient dans la même fenêtre de pas (16,7 ms au
  plus) n'est donc pas rogné. Ce qui est affiché reste toujours ce que la simulation atteindra.

**Vérifié.**
- T-F26 : 1 000 tuples semés (36 touchent la borne basse du tangage, 50 la borne haute, 207 ont un lacet hors
  de [−π, π]), les regards non finis ou non numériques (`NaN`, `undefined`, ±`Infinity`, `null`, `'0.1'`), un
  tangage hors bornes et un lacet de 1 000 rad. `Object.is` est vrai à chaque fois entre `aim`, le calcul
  transcrit du §6.2, et la ligne de `src/simulation.js` relue dans la source et exécutée telle quelle.
- Émulation du raccord sur la vraie simulation (`preuves/module-boucle/etape-2-emulation.mjs`, résultat dans
  `etape-2-emulation.json`) : 4 scénarios × 4 motifs (60, 120, 144 Hz, gigue à 144 Hz), plus `legacy-s2` au
  lance-roquettes, 1 800 pas chacun. Sur 32 400 pas qui consomment un regard, dont 5 441 avec le tangage en
  butée, l'angle atteint par la simulation est celui de `aim` au bit près (0 écart). À chaque image, le lacet
  affiché par `aim` suit la somme de toute la souris reçue à 8,2e-14 rad près. La vue de la simulation seule,
  elle, retarde sur chaque image sans pas : 1 798 images sur 3 598 à 120 Hz, 2 517 sur 4 317 à 144 Hz, avec
  jusqu'à deux images de regard en attente (13,9 ms) à 144 Hz.

### 2.6 `FLoop.track({snap = 2})` — interpolation du rendu

Un traqueur mémorise la pose de chaque entité **avant** un pas, pour rendre l'image entre l'état d'avant le
dernier pas et l'état courant. Stockage : une `Map` d'`id` vers un `Float64Array(5)` (x, y, z, a, génération).
Positions en mètres, un seul angle `a` par entité (le lacet), en radians.

| Méthode | Rôle |
|---|---|
| `begin()` | ouvre une passe d'enregistrement : une fois par image qui a au moins un pas, avant le premier pas |
| `save(id, x, y, z, a = 0)` | pose avant un pas ; à appeler avant **chaque** pas pour chaque entité suivie (la dernière écrase) |
| `pose(id, x, y, z, a = 0, alpha = 1, out = {})` | rend `out` = pose interpolée entre la pose sauvée et la pose courante (x, y, z, a) |
| `prune()` | oublie les entités non sauvées depuis le dernier `begin()` ; à appeler après les pas, seulement si l'image en a eu |
| `clear()` | oublie tout |
| `size` | nombre d'entités suivies (accesseur en lecture) |

Règles de `pose` :
- une entité inconnue (née pendant le dernier pas, ou jamais sauvée) rend la pose courante ;
- si la distance 3D entre la pose sauvée et la pose courante dépasse `snap`, `pose` rend la pose courante :
  téléportation, ascenseur, propulsion, reprise. Exactement `snap` reste interpolé ;
- sinon, l'interpolation est linéaire, `x = x_sauvé + (x − x_sauvé) × alpha`, et l'angle prend le chemin court :
  `a = a_sauvé + wrap(a − a_sauvé) × alpha`, avec `wrap(d) = d − 2π·round(d/2π)`. L'angle rendu est égal à `a`
  **modulo 2π** : à `alpha = 1`, il peut différer de `a` d'un multiple de 2π. Il ne sert qu'à orienter un modèle ;
- les images sans pas n'appellent ni `begin`, ni `save`, ni `prune` : `pose` continue d'interpoler entre les
  deux mêmes états avec l'alpha qui grandit.

Usage, dans le rappel de pas de FLoop :

```js
const f=loop.advance(now,(h,i)=>{if(i===0)T.begin();for(const e of liste)T.save(e.id,e.x,e.y,e.z,e.yaw);sim.step(h,input);});
if(f.steps)T.prune();
T.pose(e.id,e.x,e.y,e.z,e.yaw,f.alpha,q);   // q, objet réutilisé : pose de rendu de e (q.x, q.y, q.z, q.a)
```

- **Un traqueur par type d'entité**, car les `id` se recouvrent d'un type à l'autre (ennemis, projectiles et
  débris structurels ont chacun leur compteur). Le seuil se règle par type, `FLoop.track({snap})`.
- **`clear()` quand les `id` changent de sens** : nouveau monde (les `id` d'ennemis repartent de 0), reprise
  d'un point de reprise. Le premier pas qui suit réécrit les poses et `prune()` oublie les autres ; mais d'ici
  là, une entité de même `id` à moins de `snap` de l'ancienne serait interpolée depuis une pose de l'ancien monde.
- **Corps sans `id`** (balles ennemies `s.bullets`, éclats non structurels) : hors de `track`, voir le plan de
  raccord (extrapolation arrière par la vitesse).

**Vérifié.**
- T-F27 : les cas du §6.2 (interpolation, chemin court, saut de 5 m, exactement 2 m, `id` inconnu, `size`,
  144 Hz) et des cas ajoutés (section 2.7).
- Émulation du raccord sur la vraie simulation (mêmes 18 parties qu'en 2.5), avec un traqueur pour le joueur,
  un pour les ennemis (jusqu'à 170 suivis), un pour les projectiles (jusqu'à 3, au lance-roquettes) et un pour
  les débris structurels (jusqu'à 128) :
  - **images répétées (DEMO-V3)** : sans interpolation, la caméra répète la pose de l'image précédente sur 50,0 %
    des images où le joueur avance à 120 Hz et 58,3 % à 144 Hz (852 à 2 130 images par partie) ; avec `track`,
    sur aucune image des 18 parties ;
  - **seuil de 2 m** : en un pas, le joueur se déplace d'au plus 0,40 m, les ennemis de 0,10 m, les projectiles
    de 0,40 m. Aucun saut de plus de 2 m sur les 16 parties sans arme lourde. Au lance-roquettes, un saut par
    partie : un débris structurel soulevé de 2,23 m en un pas, sans vitesse (une correction de position de la
    simulation, pas un mouvement). `track` rend alors la pose courante, comme voulu ;
  - **lecture seule** : chaque partie, rejouée sans `aim` ni `track`, donne la même empreinte d'état
    (`chainHash` et `snapshot`) : brancher l'affichage ne change pas la simulation.

### 2.7 Tests et outil de motifs de FLoop

- `checks/floop.test.mjs` : T-F01 à T-F28 (28 tests), `node --test checks/floop.test.mjs`, environ 7 s
  sur le Mac M5. Le module est chargé par `node:vm`, comme dans `checks/options.test.mjs` : les erreurs sont
  comparées par leur nom, les objets du module par JSON. Ce fichier n'entre dans `npm test` qu'au raccord
  (`package.json` n'est pas modifié).
- `tools/boucle-motifs.mjs` : l'annexe A de la mission, recopiée telle quelle (sha256 `91608081942e…`) : les
  21 motifs d'horodatage synthétiques (`FRAMES`, environ 10 minutes chacun), `pattern(nom)`, `runPattern(FLoop, nom)`,
  la table `REFERENCE` avec `TOLERANCE`, et `compare`. T-F28 vérifie les 21 motifs contre la table.
- Renforcements par rapport au §6.2 de la mission, sans changer aucune valeur attendue :
  - T-F12 vérifie aussi l'invariant 4 image par image sur les 21 motifs ;
  - T-F18 vérifie qu'`observe(NaN)` laisse `period`, `locked`, `acc`, `debt` et `stats` inchangés, et garde la
    référence d'horodatage (l'image suivante mesure une période, `raw` ≈ 16,667 ms) ;
  - T-F19 vérifie que la boucle est verrouillée avant `reset()` ;
  - T-F22 copie `steps` et `locked` image par image dans la descente 144 → 60 Hz : la première version poussait
    1 700 fois le même objet `frame`, et ne vérifiait donc que la dernière image ;
  - T-F26 exécute aussi la ligne du regard **relue dans `src/simulation.js`** (avec sa définition de `clamp`) et
    la compare à `aim` au bit près : c'est le contrat entre FLoop et le jeu demandé par les risques de PARA-05.
    Si la simulation se met à consommer le regard autrement (autres bornes, lacet replié, recul ajouté au
    tangage, seconde consommation du regard), T-F26 échoue et dit de revoir l'usage de `aim` au raccord ; un
    simple reformatage de la ligne, ou une autre lecture du regard qui n'écrit pas les angles, ne le fait pas
    échouer. T-F26 vérifie aussi que les tuples touchent les deux bornes et sortent de [−π, π], et couvre les
    regards non finis ou non numériques, un tangage hors bornes, la borne basse et un lacet de 1 000 rad ;
  - T-F27 vérifie en plus quel `id` `prune()` oublie, le chemin court dans l'autre sens, l'angle rendu modulo 2π,
    la distance en 3D (saut vertical de 5 m, saut en z, diagonale de 2,08 m dont chaque composante fait 1,2 m),
    les valeurs par défaut (`snap` de 2 m, `a = 0` à la sauvegarde, `alpha = 1`), l'option `snap`, deux traqueurs
    qui ne partagent pas leurs `id`, et les images à plusieurs pas (30 Hz, et `long60` à 3 et 5 pas), où la
    pose part de l'état d'avant le dernier pas.
- Contrôle par mutants de `src/loop.js` (copies jetables, détail dans `preuves/module-boucle/etape-2-aim-track.md`) :
  sur 14 erreurs plausibles d'`aim` et de `track`, les T-F26 et T-F27 du §6.2 en laissent passer 10, ceux-ci aucune.

### 2.8 FSchedule : forme, chargement, signatures

`src/schedule.js` (4 221 octets, sha256 `48a8b7cf0bba9a54ef6cff896110a654195b05606392c2d74ef3a3691edf9d12`) est
le code normatif du §4.10 de la mission, recopié octet pour octet. Même forme que `src/motion.js` :
`(function(G){'use strict';…G.FSchedule={create,budget};})(typeof window!=='undefined'?window:globalThis);`,
sans `import` ni `export` ; `tools/realm-loader.mjs` le repère par `G.FSchedule=`. Le module ne lit aucune horloge
à lui (le temps de la file « image » vient de la fonction `now` injectée), ne tire aucun hasard et ne sait rien du
jeu (S22 le vérifie). Il ne dépend pas de FLoop : `FSchedule.budget` reçoit la période en paramètre.

```
FSchedule.create({now, agingFrames = 30} = {})        → ordonnanceur
sched.add({lane = 'frame', priority = 5, cost = 1, key, run})   → enregistrement de la tâche
sched.cancel(key)                 → true si au moins une tâche a été retirée
sched.has(key)                    → booléen
sched.count(lane)                 → nombre de tâches de 'frame', de 'sim', ou des deux sans argument
sched.pump(budget)                → ms passées (file « image », mesurées par now)
sched.pumpSim(units)              → unités consommées (file « sim », sans horloge)
sched.flush(key)                  → true ; false si la clé est inconnue
sched.stats                       7 compteurs cumulés
FSchedule.budget(periodMs, workMs, capMs = 4)         → ms
run(deadline, task)               file « image » : false = « rappelle-moi », toute autre valeur = fini
run(left, task)                   file « sim » : rend un entier de 0 à left, pose task.done = true à la fin
```

**Unités et repères** (§4.2 de la mission) :

| Grandeur | Unité, repère | Remarque |
|---|---|---|
| budget de `pump`, `cost`, `spentMs`, `deadline`, `stats.overrunMs`, `stats.maxSliceMs` | ms, horloge `now` injectée | au raccord : `performance.now()` |
| unités de `pumpSim`, `stats.simUnits` | entiers (cellules, nœuds…) | jamais des ms |
| `priority` | nombre, 0 = le plus urgent | 5 par défaut |

Taille : STAB-07 estimait l'ordonnanceur à « environ 1,5 Ko » ; le code normatif fait 4,2 Ko, parce qu'il valide
ses entrées, tient deux files, garde `flush` contre une tâche sans fin et compte 7 statistiques. C'est sous la
limite de 6 000 octets et sous la cible de 4 300. Le prototype de l'audit (`bancs/stab/sched.mjs`, pré-synthèse
audio sur la 0.8.0) a seulement été lu : rien n'en est repris dans le module. L'étape 8 le lance comme banc de
départ, à côté de son propre banc (4.6).

### 2.9 `FSchedule.create({now, agingFrames = 30})` — ordonnanceur à deux files

Deux files : **`'frame'`** (présentation, caches, sérialisation), budgétée en **millisecondes** par la fonction
`now` injectée ; **`'sim'`** (déterministe), budgétée en **unités de travail** entières.

**Création.** `now` est facultatif ; s'il est donné, c'est une fonction qui rend des ms, sinon `TypeError`. Sans
`now`, la file « sim » et `flush` marchent, mais `pump` lève `TypeError` (quel que soit le budget) : un
ordonnanceur purement « sim » n'a pas besoin d'horloge. `agingFrames` est un entier ≥ 1, sinon `TypeError`.

**`add(task)`** rend l'enregistrement de la tâche, `{lane, key, priority, cost, run, seq, age, runs, spentMs, done,
removed, lastPump}`. `task = {lane = 'frame', priority = 5, cost = 1, key, run}` :
- `run` est obligatoire, une fonction, sinon `TypeError` ; `lane` vaut `'frame'` ou `'sim'`, sinon `TypeError` ;
- `priority` non fini devient 5 (0 = le plus urgent) ; `cost` non fini ou négatif devient 1 (ms estimées) ;
- une tâche de même `key` dans la **même** file est remplacée : l'ancienne est retirée (`removed` vrai), la
  nouvelle prend un nouveau numéro d'ordre (`seq`). Une même `key` peut exister dans les deux files.

**Autres méthodes.** `cancel(key)` retire toutes les tâches de cette clé, dans les deux files, et rend `true` si
au moins une a été retirée ; `has(key)` dit si une tâche de cette clé existe ; `count(lane)`. `stats` contient
exactement 7 clés, toutes à 0 au départ :

| Clé de `stats` | Sens |
|---|---|
| `ran` | exécutions dans `pump` (file « image ») |
| `skipped` | tâches sautées par `pump`, faute de budget |
| `flushes` | appels de `flush` sur une clé connue |
| `overrunMs` | dépassements cumulés du budget de `pump` |
| `maxSliceMs` | plus longue exécution mesurée dans `pump` |
| `simUnits` | unités consommées par la file « sim » (`pumpSim` et `flush`) |
| `errors` | exceptions des tâches et retours « sim » invalides |

**`pump(budget)`, la file « image »**, une fois par image, après le dessin.
- Si `budget` n'est pas strictement positif (0, négatif, NaN) ou si la file est vide : rend 0 et n'exécute rien.
- Ordre : priorité effective `priority − floor(age/agingFrames)`, puis `seq`, sur un instantané de la file.
- `run(deadline, task)` reçoit l'échéance `now() + budget restant`, et l'enregistrement lui-même.
- Une tâche dont `cost` dépasse le budget restant est sautée (`stats.skipped`), **sauf si rien n'a encore tourné**
  dans ce `pump` : une tâche longue part toujours seule.
- Après chaque exécution : `cost = cost × 0,5 + durée mesurée × 0,5`.
- `run` qui rend `false` signifie « rappelle-moi » ; toute autre valeur signifie « fini ».
- Les tâches de l'instantané qui n'ont pas tourné prennent `age + 1` (vieillissement, contre la famine) ; une
  tâche ajoutée pendant le `pump` ne tourne pas et ne vieillit pas dans ce `pump`. Avec `agingFrames` 30, une
  tâche de priorité 5 sautée à chaque `pump` passe devant une tâche de priorité 0 plus ancienne qu'elle au bout de
  180 pompes (3 s à 60 Hz si chaque image pompe, S04) ; un `pump` à budget nul ne fait vieillir personne (S09).
- Rend le temps passé (ms, mesuré par `now`), et ajoute le dépassement éventuel à `stats.overrunMs`.

**`pumpSim(units)`, la file « sim »**, déterministe, à un point fixe du pas de simulation.
- `units` est un entier ≥ 0, sinon `TypeError`. `pumpSim` ne lit **jamais** l'horloge.
- Ordre : priorité, puis `seq` (pas de vieillissement dans cette file).
- `run(left, task)` rend le nombre entier d'unités utilisées, de 0 à `left`, et pose `task.done = true` quand il a
  fini. Un retour invalide lève `TypeError`, retire la tâche et compte une erreur.
- Rend le nombre d'unités consommées.

**`flush(key)`** force la tâche tout de suite : file « image », `run(Infinity)` jusqu'à un retour autre que `false` ;
file « sim », `run(Number.MAX_SAFE_INTEGER)` jusqu'à `done`. Elle rend `false` si la clé est inconnue, et ne lit
pas l'horloge. Après 1e6 appels sans fin, elle lève `Error('FSchedule.flush: task never finished')`, et la tâche
reste dans la file.

**Exceptions** : une exception d'une tâche la retire, ajoute 1 à `stats.errors`, puis est relancée ; les autres
tâches restent en file et tournent au `pump` ou au `pumpSim` suivant.

**À savoir pour le raccord.** Une tâche sans `key` a la clé `undefined` : `cancel()`, `has()` et `flush()` appelés
sans clé (ou avec une variable `undefined`) visent alors les tâches sans clé ; `cancel()` les retire toutes. Le
code normatif est gardé tel quel : donner une clé à toute tâche qu'on voudra annuler ou forcer, et ne jamais
appeler ces méthodes avec une clé indéfinie.

Usage type : `sched.pump(FSchedule.budget(loop.period || 1000/60, performance.now() - débutDeLImage))` après le
dessin ; `sched.pumpSim(n)` à un point fixe du pas, avec un `n` fixe ; `sched.flush('save')` sur `pagehide`. Pour
la pré-synthèse audio (LOAD-13), une tâche « image » par tampon (priorité 6, coût 2) : la plus longue tranche est
alors celle du tampon le plus lourd, indivisible tant que la synthèse n'est pas découpée. Réserve de la
contre-vérification de STAB-07 : cette pré-synthèse tourne derrière l'écran de chargement, donc le découpage rend
la barre de chargement plus fluide, pas la partie ; en partie, le gain attendu se limite à 1,0 à 2,9 ms sur l'image
d'un point de reprise. Le détail du branchement (points de reprise, pré-synthèse audio) est au plan de raccord
(section 5).

### 2.10 `FSchedule.budget(periodMs, workMs, capMs = 4)`

`max(0, min(cap, 0,85 × P − work))`, où `P = periodMs` si c'est un nombre fini strictement positif, sinon `1000/60`.
Le résultat vaut 0 si `workMs` n'est pas fini. Le jeu appelle
`pump(FSchedule.budget(loop.period || 1000/60, tempsDéjàPasséDansLImage))` : le budget vaut 0 dans une image déjà
en retard, et l'on ne pompe jamais dans une image en retard. Exemples (S17) : 4 ms à 60 Hz après 5 ms de travail,
1,17 ms après 13 ms, 0 après 15 ms ; 2,90 ms à 144 Hz après 3 ms. `capMs` n'est pas validé : un `capMs` NaN
donne un budget NaN, que `pump` traite comme nul.

### 2.11 Règles de déterminisme de FSchedule

1. Tout ce que la simulation relit passe par la file « sim », budgétée en unités, jamais en ms.
2. `pumpSim` est appelé à un point fixe du pas, avec un nombre fixe d'unités.
3. La simulation n'appelle jamais `pump`.
4. Le `flush` d'une tâche « sim » ne se fait qu'à un point déterministe, dans un pas.
5. La file « image » ne contient que de la présentation, des caches et de la sérialisation.

Le point de reprise suit l'arbitrage « LOOP-03, LOAD-03, SIM-01 » : l'instantané (`snapshot()`) reste pris de
façon synchrone, dans l'image, et n'est jamais différé ; seuls `JSON.stringify` et `setItem` peuvent devenir une
tâche « image » (clé `'save'`), forcée par `flush('save')` sur `pagehide` et quand la page devient cachée. Deux
conditions des contre-vérifications, pour le raccord : différer `stringify` exige que `snapshot()` rende une copie
sans aucune référence vers l'état vivant, à garantir par un test (instantané, 60 pas, puis JSON identique à celui
pris tout de suite, STAB-07) ; et LOAD-03 classe ce report en P2 (1,0 à 1,2 ms de `stringify`, `setItem` non
mesuré, risque de perdre le dernier point), à décider après une mesure dans Chrome.

### 2.12 Tests de FSchedule

- `checks/fschedule.test.mjs` : S01 à S22 (22 tests), `node --test checks/fschedule.test.mjs`, environ 0,1 s sur
  le Mac M5 (S18 en prend 70 ms sous `node:vm`, pour les 1e6 appels de sa garde ; 6 ms dans le domaine principal).
  Chargement par `node:vm`, comme pour FLoop. Horloge factice
  (une tâche « dure » d ms si elle avance l'horloge de d) et horloge interdite, qui lève si on la lit. Ce fichier
  n'entre dans `npm test` qu'au raccord (`package.json` n'est pas modifié).
- Renforcements par rapport au §6.3 de la mission, sans changer aucune valeur attendue :
  - S10 vérifie que la tâche reçue par `run` est l'enregistrement rendu par `add` (identité, pas seulement la clé),
    et que l'échéance est bien `now() + budget restant` : après une tâche de 1 ms, la seconde reçoit 101 + 3 = 104 ;
  - S18 vérifie que **chacun** des 40 appels du `flush` « sim » reçoit `Number.MAX_SAFE_INTEGER` (pas seulement le
    dernier), que `runs` vaut 40, que la tâche sans fin n'est pas marquée retirée, et que le retour −2 compte une
    erreur ;
  - S04 vérifie aussi la valeur par défaut d'`agingFrames` (sans option : pompe 181), s'arrête dès que L a tourné
    (puis vérifie `done` et `removed`), et que S a tourné à chacune des pompes d'avant ;
  - S14 note aussi les unités offertes dans la trace, et vérifie que l'horloge irrégulière a bien changé la file
    « image » (`maxSliceMs` 0 contre 4,8 ms) sans rien changer à la file « sim » (59 entrées identiques) ;
  - S15 vérifie qu'un retour invalide ne compte aucune unité, qu'un argument refusé de `pumpSim` (y compris
    `pumpSim()` sans argument) n'appelle aucune tâche et ne compte pas d'erreur ;
  - S16 fait « la même chose » dans la file « sim » : la tâche qui suit reste et tourne au `pumpSim` suivant ;
    l'erreur relancée est l'objet levé par la tâche ;
  - S20 vérifie les 12 champs de l'enregistrement, les 7 statistiques à 0 d'un ordonnanceur neuf, et que `pump(0)`
    lève aussi sans horloge ;
  - S08 et la garde de S18 tournent avec l'horloge interdite : `flush` ne la lit pas ; S11 vérifie que l'horloge
    interdite donne le même découpage (53 appels) ; S09, qu'un `pump` sans budget ne fait pas vieillir la tâche ;
    S02, S03, S06, S07, S09, S12, S13, S19 et S21 vérifient en plus l'ordre des tâches, les comptes par file,
    `removed`, `runs`, `ran` et `skipped`.
- Contrôle par mutants de `src/schedule.js` (copies jetables, `preuves/module-boucle/etape-3-mutants.mjs`, détail
  dans `preuves/module-boucle/etape-3-fschedule.md`) : sur 19 erreurs plausibles, les tests du relais (conformes au
  §6.3, sauf S10 et S18, plus faibles que la lettre) en laissent passer 12, ceux-ci aucune.

## 3. Algorithme

Ce qui suit décrit le code normatif de `src/loop.js` (§4.5 de la mission), dans l'ordre où `advance(now, step)`
l'exécute. H = `stepMs` = 1000/hz, soit 16,667 ms à 60 Hz ; les seuils sont les options par défaut (2.2).

### 3.1 Intervalle brut

- `raw = now − last`, l'écart entre deux appels. Au premier appel, et au premier après `reset()`, il n'y a pas
  d'intervalle : un pas, compté en dilatation (H).
- `now` non fini : rien ne change. Horloge qui recule : la référence est reprise, et l'image fait 0 pas.
- Au-delà de 250 ms (`maxFrameMs`), l'intervalle est coupé à 250 ms (`clampedMs`) et n'entre pas dans l'estimation de
  la période : une image très longue ne la fausse pas.

### 3.2 Période de l'écran

- Chaque intervalle est ramené à une période : k = round(raw / période), au moins 1, et l'échantillon vaut raw / k. Une
  image perdue (2 périodes), ou une image sautée par le limiteur, donne donc encore un échantillon d'une période.
- La période est la moyenne des 30 derniers échantillons (`samples`).
- Une fois la période calibrée (8 échantillons, `minSamples`), un échantillon à plus de 30 % de la période
  (`sampleTol`) est ignoré. Huit d'affilée vident l'anneau : l'écran a changé, et le huitième devient le premier
  échantillon de la nouvelle période.
- `observe(now)` fait la même estimation hors jeu, sans avancer le temps simulé.

### 3.3 Verrouillage et hystérésis

- La boucle compare la période au multiple du pas le plus proche, m × H (m = round(période / H), au moins 1). Elle se
  verrouille quand l'écart relatif passe sous 1 % (`lock`), et ne se déverrouille qu'au-delà de 2 % (`unlock`). Une
  période qui hésite autour de 1 % ne fait donc pas basculer la boucle à chaque image.
- Verrouillée, la boucle fait n = round(raw / H) pas, sans passer par l'accumulateur : chaque image d'une période fait
  exactement un pas. La différence n × H − raw est comptée en dilatation (3.7).
- Seules les périodes multiples du pas se verrouillent : 60, 30 ou 20 Hz, et 59,94 Hz (0,1 % d'écart). À 120 Hz, la
  période vaut un demi-pas : m = 1, l'écart vaut 50 %, et la boucle, non verrouillée, fait un pas une image sur deux.

### 3.4 Hors verrouillage : accrochage et dette

- L'intervalle est accroché à k périodes s'il est à moins de 0,2 période d'un tel multiple (`snap`) : dt = k × période,
  et la différence raw − dt va dans la dette. Des horodatages arrondis à 0,1 ou 1 ms donnent ainsi un dt régulier.
- Chaque image rend 10 % de la dette (`debtRate`), prise au plus à 2 ms (`debtCap`) : au plus 0,2 ms par image, trop
  peu pour se voir.
- La dette reste sous un pas : si ce qui reste dépassait H, le remboursement est augmenté pour la ramener à H. C'est
  l'invariant 2 (2.4).
- Le dt, remboursement compris, va dans l'accumulateur ; tant qu'il contient un pas (à 1e-9 près, pour le bruit
  flottant), la boucle fait un pas.
- Le temps simulé suit donc le temps réel à la dette près : 6,26 ms au pire sur les 21 motifs (`bimodal`), 0,08 à
  0,8 ms sous gigue ou avec des horodatages arrondis à 144 Hz (4.1).

### 3.5 Remplissage à 0,999 et remise en phase

- La remise en phase met l'accumulateur à 0,999 pas (`fill`) et la dette à 0, et compte le saut en dilatation. Elle a
  lieu à l'entrée en verrouillage et à chaque `reset()`.
- Pourquoi 0,999 : l'image suivante d'une période porte l'accumulateur à 1,999 pas, soit exactement un pas, et il
  revient à 0,999. alpha reste à 0,999 : l'image montre l'état courant, sans retard ajouté. 0,999 plutôt que 1 laisse
  une marge au bruit flottant (un intervalle un peu long ne fait pas 2 pas) ; 0,999 plutôt que 0 évite d'afficher un
  pas entier de retard.

### 3.6 Rattrapage et abandon

- Au plus 5 pas par image (`maxSteps`). Le surplus est abandonné et compté (`frame.dropped`, `stats.droppedMs`) : hors
  verrouillage, l'accumulateur revient à 0,999 pas ; verrouillée, les pas en trop sont comptés en abandon.
- Une image longue (ramasse-miettes, onglet repris) ne lance donc jamais de spirale de rattrapage : au plus 83 ms de
  simulation par image. Sous 12 images par seconde, le jeu ralentit, et le temps perdu est compté.
- Exemple, `long60` (4.1) : une image de 116,67 ms fait 5 pas et abandonne 33,33 ms ; une image de 500 ms est coupée à
  250 ms, fait 5 pas et abandonne 166,67 ms.

### 3.7 Dilatation contre dérive

Le temps simulé peut s'écarter du temps réel de deux façons, que la boucle sépare :
- la **dette**, hors verrouillage : bornée à un pas et remboursée, elle ne s'accumule pas. Il n'y a pas de dérive :
  c'est le critère de STAB-06, un écart inférieur à un pas sur 10 minutes ;
- la **dilatation** (verrouillage, premier pas, remises en phase) : voulue, et comptée dans `stats.dilationMs`.
  Verrouillée, la simulation suit l'écran pour garder un pas par image : à 59,94 Hz, elle prend 0,0944 % de retard,
  soit −566,65 ms sur 10 minutes, sans à-coup.

L'invariant 1 (2.4) relie les deux, à 1e-6 ms près : pas × H + (acc − 0,999 H) = temps réel − dette − abandons +
dilatation. L'invariant 3 borne la dilatation à un pas plus 1 % du temps réel, et il tient sur les 21 motifs.
L'hystérésis laisse pourtant la boucle verrouillée jusqu'à 2 % d'écart : une période qui glisse après le verrouillage
peut dépasser cette borne (limite 13 de la section 6, question 3).

### 3.8 Modes, arrêt anticipé, `observe`, `reset`, `resetPeriod`, alpha

- **Mode rappel** : `advance(now, step)` appelle `step(h, i)` pour chaque pas. Un retour `false` arrête l'image : le pas
  compte comme fait, et le reste va dans `stats.abortedMs`. Une exception remonte, après le même compte.
- **Mode plan** : `frame.steps` dit combien de pas faire. L'appelant les fait, et appelle `abort(done)` s'il s'arrête
  avant. Les deux modes donnent les mêmes pas (T-F16).
- **`observe(now)`** : estimation de la période et verrouillage, sans pas. La référence est gardée : le prochain
  `advance` mesure l'intervalle depuis la dernière image observée.
- **`reset()`** : remise en phase, puis oubli de la référence. Le prochain `advance` fait exactement un pas, sans
  rattraper le temps passé en pause ; la période et le verrouillage sont gardés.
- **`resetPeriod()`** : vide l'anneau et déverrouille, sans toucher à l'accumulateur.
- **alpha** = acc / H, borné à [0, 1] : la part du pas suivant déjà écoulée, 0,999 en verrouillage. Le rendu se place
  entre l'état d'avant le dernier pas et l'état courant (`track`, 2.6), au temps `sim.state.time − (1 − alpha) × h`.

### 3.9 Pourquoi « moyenne + dette », et pas la médiane sans dette

Le prototype de l'audit (`bancs/stab/cadence.mjs`) a deux variantes de lissage. Celle qui a servi aux empreintes et au
CPU, une médiane glissante sans dette, fait courir l'horloge : 2 086 images au lieu de 2 160 avec la gigue à 144 Hz
(+3,5 %), 882 au lieu de 900 avec des horodatages à 1 ms (+2 %) (contre-vérification de STAB-06, réserve 2). Deux
causes s'ajoutent :
- la médiane d'intervalles arrondis est biaisée. À 60 Hz, avec des horodatages à la milliseconde, les intervalles
  valent 17, 16 et 17 ms : la médiane vaut 17 ms, 2 % de trop ;
- sans dette, rien ne rend la différence entre l'intervalle réel et le dt ajouté : le biais devient une dérive.

La variante retenue, celle de la proposition de STAB-06, corrige les deux. La moyenne des échantillons normalisés n'a
pas ce biais : sur 30 intervalles de 17, 16 et 17 ms, elle vaut 16,667 ms. Et toute différence entre l'intervalle réel
et le dt accroché va dans la dette, rendue et bornée à un pas. Mesuré (4.1) : 6,26 ms d'écart au pire sur 10 minutes
pour les 21 motifs ; hors verrouillage, la seule dilatation est celle du premier pas (0,0028 %). La vitesse affichée
reste régulière : CV de 0 à 0,9 % selon le motif, contre ±4 % de vitesse perçue avec des horodatages à 1 ms sur la
boucle de la 0.8.0 (STAB-06).

### 3.10 FSchedule, en bref

- **File « image »** : `pump(budget)` une fois par image, après le dessin, avec `FSchedule.budget` = min(4 ms,
  0,85 × période − travail déjà fait). Le budget est nul dans une image en retard : on n'y pompe jamais.
- Ordre : la priorité, diminuée d'un point toutes les 30 pompes d'attente (vieillissement, contre la famine), puis
  l'ordre d'arrivée. Une tâche dont le coût estimé dépasse le reste du budget est sautée, sauf si rien n'a tourné dans
  cette pompe : une tâche longue part seule. L'estimation suit la durée mesurée (moyenne à 0,5).
- **File « sim »** : `pumpSim(unités)` à un point fixe du pas, en unités entières, sans horloge ni vieillissement. Le
  découpage est le même sur toutes les machines (S11, S14).
- **`flush(key)`** force une tâche sans lire l'horloge, avec une garde à 1e6 appels.
- Pourquoi deux files : ce que la simulation relit ne peut pas dépendre de la vitesse de la machine (règle 1, 2.11) ; la
  présentation, les caches et la sérialisation peuvent, eux, prendre le temps libre de l'image.

## 4. Mesures

Les bancs chargent les modules dans le domaine principal de Node (`loadRealm({root, modules, realm: 'main'})`),
jamais sous `node:vm`, qui ralentit le code de 4,5 à 9 fois (MASTER-PROMPT §4). Chaque JSON de
`preuves/module-boucle/` commence par `schema`, `node`, `arch`, `platform`, `cpu` et `loadavg` : la machine et sa
charge au moment de la mesure. Horloge (4.1) et simulation réelle (4.2) : étapes 4 et 5 ; coûts (4.3), assemblage
de la page (4.4) et navigateur réel (4.5) : étape 6 ; pré-synthèse audio (4.6) : étape 8, facultative. L'émulation
de l'étape 2 (`aim` et `track` sur la vraie simulation) est résumée en 2.5 et 2.6.

### 4.1 Horloge : `banc-horloge.json` (étape 4)

Constats : STAB-06 (réserve 2 de sa contre-vérification), STAB-V3 (horodatages réalistes et déclarés), LOOP-05
(absorbé par STAB-06).

- **Commande** : `node tools/boucle-banc-horloge.mjs`, depuis la racine. Pour chacun des 21 motifs,
  `runPattern(FLoop, nom)` puis `compare(résultat, REFERENCE[nom])` (§7.2 de la mission). Une ligne par motif
  (`nom : ok`), puis un bilan ; code 0, ou 1 si un motif s'écarte ou si un critère tombe. Durée : 0,15 à 0,17 s
  sur 6 lancements, démarrage de Node compris (T-F28 fait le même calcul sous `node:vm` en 2,2 s).
- **Sortie** : seulement `docs/chantier-moteur/preuves/module-boucle/banc-horloge.json` (16,6 Ko) : `stepMs`, un
  résultat par motif avec ses écarts à la référence (`differences`, vide pour les 21), et le bilan `checks`. Aucun
  tableau par image : seuls `long60` (3 images) et `switch` (2 valeurs) gardent des `marks`.
- **Machine et charge** : Apple M5, 10 cœurs, macOS 27.2.1 (`darwin`, `arm64`), Node v24.18.0 ; `loadavg`
  3,94 / 3,71 / 3,12 (Mac partagé par plusieurs agents). Les comptes ne dépendent ni de la charge ni de la machine :
  les horodatages sont synthétiques et le banc ne lit aucune horloge. Cinq lancements donnent le même JSON, hors
  `loadavg`. `runPattern` rend les mêmes résultats au bit près dans le domaine principal et sous `node:vm`
  (`preuves/module-boucle/etape-4-domaines.mjs`, 10 exécutions alternées) : le banc et T-F28 mesurent la même chose.

**Motifs d'horodatage, déclarés.** Ils sont figés dans `tools/boucle-motifs.mjs` (annexe A de la mission). Image
i = 1, 2, 3… ; P60 = 1000/60 ms, P144 = 1000/144 ms ; chaque motif couvre environ 10 minutes d'affichage.

| Motif | Horodatage de l'image i (ms) | Cas représenté | Temps réel |
|---|---|---|---|
| `30`, `50`, `59.94`, `60`, `75`, `90`, `120`, `144`, `165`, `240` | i × 1000/hz | écran à cette fréquence, horloge exacte | 600 s |
| `60@1e6` | 10⁶ + i × P60 | horloge partie d'une constante, le défaut relevé par STAB-V3 (2²⁰ ms franchi vers 48,6 s) | 600 s |
| `q60`, `q144` | i × P arrondi à 0,1 ms | horodatages de Chrome hors isolation d'origine (STAB-06) | 600 s |
| `ms60`, `ms144` | i × P arrondi à 1 ms | horodatages à la milliseconde | 600 s |
| `jit60` | i × P60 + gigue de −2 à +2 ms (générateur congruentiel, graine 0) | forte gigue à 60 Hz | 600 s |
| `jit144` | i × P144 + gigue de −0,36 à +0,36 ms, par pas de 0,12 ms | gigue à 144 Hz | 600 s |
| `drop60` | 60 Hz ; une image sur 20 dure 2 périodes | images perdues | 630 s |
| `long60` | 60 Hz ; une image sur 300 dure 3 périodes, une sur 1 000 en dure 7, l'image 5 000 en dure 30 | images longues : rattrapage, plafond de 5 pas, borne de 250 ms | 607,3 s |
| `bimodal` | une image sur 5 dure 10 ms, les autres 18,33 ms | cadence irrégulière, sans période nette | 599,9 s |
| `switch` | 300 images à 60 Hz, puis 144 Hz | changement d'écran | 602,9 s |

Le temps réel est la somme des intervalles retenus par FLoop (`stats.realMs`, après la borne de 250 ms), déduite du
JSON : 100 × `dilationMs` / `dilationPct`.

**Résultats** (valeurs du JSON). « Verrou » est l'image du premier verrouillage (0 = jamais) ; « Fin verr. », l'état
à la dernière image ; « Dette max », le maximum de |dette| ; « CV », la variation de la vitesse affichée d'un corps
qui avance d'une unité par pas (après les 40 premières images, hors images à abandon).

| Motif | Images | Pas | Histogramme des pas | Verrou | Fin verr. | Changements | Dilatation % | Dette max ms | CV % |
|---|---|---|---|---|---|---|---|---|---|
| 30 | 18 000 | 35 999 | 1:1, 2:17 999 | 9 | oui | 1 | 0,0028 | 0 | 0 |
| 50 | 30 000 | 36 000 | 1:24 000, 2:6 000 | 0 | non | 0 | 0,0028 | 0 | 0 |
| 59.94 | 35 964 | 35 965 | 1:35 963, 2:1 | 9 | oui | 1 | −0,0944 | 0 | 0 |
| 60 | 36 000 | 36 000 | 1:36 000 | 9 | oui | 1 | 0,0028 | 0 | 0 |
| 60@1e6 | 36 000 | 36 000 | 1:36 000 | 9 | oui | 1 | 0,0028 | 0 | 0 |
| q60 | 36 000 | 36 000 | 1:36 000 | 9 | oui | 1 | 0,0028 | 0 | 0 |
| ms60 | 36 000 | 36 000 | 1:36 000 | 9 | oui | 1 | 0,0028 | 0 | 0 |
| 75 | 45 000 | 36 001 | 0:8 999, 1:36 001 | 0 | non | 0 | 0,0028 | 0 | 0 |
| 90 | 54 000 | 36 001 | 0:17 999, 1:36 001 | 0 | non | 0 | 0,0028 | 0 | 0 |
| 120 | 72 000 | 36 001 | 0:35 999, 1:36 001 | 0 | non | 0 | 0,0028 | 0 | 0 |
| 144 | 86 400 | 36 001 | 0:50 399, 1:36 001 | 0 | non | 0 | 0,0028 | 0 | 0 |
| 165 | 99 000 | 36 001 | 0:62 999, 1:36 001 | 0 | non | 0 | 0,0028 | 0 | 0 |
| 240 | 144 000 | 36 001 | 0:107 999, 1:36 001 | 0 | non | 0 | 0,0028 | 0 | 0 |
| jit60 | 36 000 | 36 001 | 1:35 999, 2:1 | 10 | oui | 1 | 0,0050 | 0,727 | 0 |
| drop60 | 36 000 | 37 800 | 1:34 200, 2:1 800 | 9 | oui | 1 | 0,0026 | 0 | 0 |
| long60 | 36 000 | 36 360 | 1:35 856, 3:108, 5:36 | 9 | oui | 1 | 0,0027 | 0 | 0 |
| bimodal | 36 000 | 35 995 | 0:2 870, 1:30 265, 2:2 865 | 0 | non | 0 | 0,0028 | 6,260 | 0,035 |
| jit144 | 86 400 | 36 001 | 0:50 399, 1:36 001 | 0 | non | 0 | 0,0028 | 0,383 | 0,535 |
| q144 | 86 400 | 36 001 | 0:50 399, 1:36 001 | 0 | non | 0 | 0,0028 | 0,080 | 0,062 |
| ms144 | 86 400 | 36 001 | 0:50 399, 1:36 001 | 0 | non | 0 | 0,0028 | 0,800 | 0,606 |
| switch | 86 400 | 36 173 | 0:50 227, 1:36 173 | 9 | non | 2 | −0,0053 | 0 | 0,900 |

Les 21 lignes sont celles du §8 de la mission (qui regroupe `60`, `60@1e6`, `q60` et `ms60` en une ligne) : comptes
exacts, flottants dans les tolérances de `TOLERANCE`. Les « 0 » de la dette et du CV sont des zéros flottants
(moins de 4e-10).

**Bilan `checks`.**

| Critère | Mesuré | Attendu |
|---|---|---|
| `allMatchReference` | vrai : 21 motifs sur 21 conformes à `REFERENCE` | vrai |
| `allInvariant` (`maxInvariantErr < 1e-6`) | vrai : 3,49e-10 ms au pire (`59.94`) | vrai (mission : moins de 4e-10) |
| `allEcartBelowStep` (`maxEcartMs ≤ stepMs`) | vrai : 6,26 ms au pire (`bimodal`) | vrai, ≤ 16,667 ms |
| `allDilationBound` (\|dilatation\| ≤ 1 pas + 1 % du temps réel) | vrai : 566,65 ms au pire (`59.94`), pour une borne de 6 016 ms | vrai |
| `maxStepsPerFrame` | 5 (`long60`) ; 2 au plus ailleurs | ≤ 5 |
| `loopBytes`, `loopSha256` | 6 042 octets, `2002052f…46214c5` | code normatif du §4.5 |

**Autres valeurs.**
- `long60` : 1 333,333 ms abandonnés par le plafond de 5 pas (`droppedMs`) et 250 ms coupés par la borne
  (`clampedMs`). Image 300 : 50 ms, 3 pas, rien d'abandonné ; image 1 000 : 116,67 ms, 5 pas, 33,33 ms
  abandonnés ; image 5 000 : 500 ms coupés à 250 ms, 5 pas, 166,67 ms abandonnés.
- `switch` : déverrouillage à l'image 308, au huitième intervalle à 144 Hz (8 échantillons aberrants d'affilée
  vident l'anneau) ; période de 6,9444 ms à l'image 330 ; pas de nouveau verrouillage, 144 Hz n'étant pas un multiple
  de 60. Les images 301 à 307, encore verrouillées, font 0 pas (arrondi de 6,94/16,67) : ce sont les 7 images à 0 pas
  d'affilée du motif, soit 48,6 ms de simulation retirés et comptés en dilatation (−31,944 ms au total avec le
  premier pas).
- `59.94` et `jit60` : la seule image à 2 pas est la deuxième, avant le calibrage de la période.

**Ce que montre le banc.**
1. **Écart temps simulé / temps réel, sur 10 minutes (STAB-06, réserve 2).** L'écart mesuré est le temps simulé (pas
   faits × durée du pas, plus la part de l'accumulateur au-delà de 0,999 pas) moins le temps réel retenu, hors
   abandons voulus (`droppedMs`, `abortedMs`) et hors dilatation (`dilationMs` : premier pas, arrondis du
   verrouillage, remises en phase) ; par l'invariant 1, il vaut −dette. Il reste sous un pas pour chacun des 21
   motifs : 0 quand la boucle est verrouillée, 0,08 à 0,8 ms sous gigue ou horodatages arrondis à 144 Hz, 0,73 ms
   pour `jit60`, 6,26 ms au pire (`bimodal`). La réserve visait la variante « médiane glissante sans dette » du
   prototype, qui faisait courir l'horloge de 2 à 3,5 % ; ici, hors verrouillage, la seule dilatation est celle du
   premier pas (16,667 ms sur 600 s, 0,0028 %), et le reste de l'écart est la dette, bornée : l'horloge ne court pas.
2. **La dilatation est voulue, bornée et comptée.** Verrouillée, la simulation suit l'écran : à 59,94 Hz, elle prend
   0,0944 % de retard, soit −566,65 ms sur 600 s. Le critère des 10 minutes s'applique donc hors verrouillage
   (\|dette\| < 1 pas) ; en verrouillage, c'est la dilatation qui est bornée (invariant 3). C'est la question
   ouverte n° 3 de la mission, à confirmer (section 7).
3. **Horodatages réalistes et déclarés (STAB-V3).** Les motifs couvrent ceux que demande STAB-V3 (arrondi à 0,1 ms,
   59,94, 120 et 144 Hz) et son cas fautif : avec l'horloge partie de 10⁶ ms, `60@1e6` donne les mêmes comptes que
   `60` (1 pas par image sur 36 000 images, verrouillé à l'image 9), sans changement de régime après 48,6 s.
4. **Le nombre de pas ne dépend plus de l'écran (LOOP-05).** Avec des horodatages arrondis à 0,1 ms ou à 1 ms, FLoop
   fait 1 pas par image ; à 59,94 Hz aussi, sauf la deuxième image (2 pas). De 75 à 240 Hz, jamais plus d'un pas par
   image, et 36 001 pas en 10 minutes quelle que soit la cadence. Par comparaison, la formule actuelle de `game.js`
   (`Math.max(1,Math.ceil(dt*60-.06))`) fait à 144 Hz un pas de 6,94 ms par image, soit 86 400 pas en 10 minutes
   (calcul, non mesuré ici). La section 4.2 le mesure sur la vraie simulation (4 320 pas en 30 s à 144 Hz, contre
   1 800 avec FLoop) et compare aussi les empreintes.

Ce banc ne mesure que l'horloge, sur des horodatages synthétiques. Un vrai écran à 59,94 Hz, le VRR et les
horodatages de Safari et de Firefox restent à essayer.

### 4.2 Simulation réelle : `banc-simulation.json` (étape 5)

Constats : STAB-06 (une seule empreinte d'état quel que soit l'écran ; son « Vérifier par » demande la même empreinte
à 60, 75, 120 et 144 Hz et avec des horodatages arrondis), LOOP-05 (absorbé par STAB-06), STAB-V1 (la formule
actuelle, déjà dans main), PARA-V1 (la simulation reste sur le fil principal).

- **Commande** : `node tools/boucle-banc-simulation.mjs`, depuis la racine (délai de 20 minutes). Une ligne par motif,
  puis un bilan ; code 0, ou 1 si `distinctChainHashes` ≠ 1, si `allSameAsReplay` est faux, ou si une exécution FLoop
  ne fait pas ses 1 800 pas (critère 6 du §9 de la mission, ajouté au §7.3). Durée : 127 à 179 s sur trois passes.
- **Ce qui est comparé.** Le code du §7.3 de la mission est recopié tel quel (lignes 8 à 52 de l'outil, identiques
  au bloc de la mission, `cmp`). Il s'appuie sur les outils de preuve du lot 00, en lecture seule : scénario
  `legacy-s0`, graine 96, pilote `drive()`, empreinte d'état chaînée à chaque pas (`observeRun`), instantané final
  (`finishRun`).
  - **Référence** : `replay()`, 1 800 pas de 1/60 s, sans chronométrage.
  - **FLoop** (`withLoop`) : les mêmes 1 800 pas, rythmés par FLoop. L'image i appelle
    `advance(horodatage de l'image i, rappel)` ; le rappel fait `drive`, `sim.step(h)` avec h = 1/60 s, puis
    `observeRun`, et rend `false` au 1 800e pas (arrêt anticipé).
  - **Actuel** (`current`) : la formule de `frame()` dans `src/game.js` (lignes 787 et 802 : dt borné à 0,12 s,
    puis `Math.max(1,Math.ceil(dt*60-.06))` sous-pas de dt/steps), pendant 30 s d'affichage.
  - Motifs : `60`, `q60`, `59.94`, `75`, `120`, `144`, `165`, `jit144` et `long60`, déclarés en 4.1.
- **Déroulé** : une chauffe (un `withLoop('60')` et un `current('60')`, non comptés), puis, pour chaque motif, trois
  paires alternées : (FLoop, actuel), (actuel, FLoop), (FLoop, actuel). Avec le rejeu, cela fait 57 exécutions, en
  série (la machine est partagée). Rapport de CPU : `cpuMsPerSimSecond` de FLoop sur celui de l'actuel, par paire,
  puis la médiane des trois.
- **Sortie** : seulement `preuves/module-boucle/banc-simulation.json` (11,3 Ko), sans `rows` ni tableau par pas :
  `reference` réduit à `{steps, chainHash, snapshotSha256}` ; `floop[]` et `current[]`, la première exécution de
  chaque motif ; `distinctChainHashes`, `allSameAsReplay` et `distinctSnapshotsCurrent` ; les rapports de CPU.
  - Écart avec le §7.3 : sa liste `cpu[]` s'appelle ici `cpuRatios`. La clé `cpu` est déjà le modèle du processeur,
    dans l'en-tête de chaque JSON (§7 de la mission), et un objet JSON ne peut pas porter les deux.
  - Ajouts, pour information : `loadavgEnd`, `seconds`, `scenario`, `seed`, `steps`, `patterns`, `floopRuns`,
    `allStepsDone` et `currentRepeatable` ; par motif, le CPU des trois exécutions de chaque sorte ;
    `floopCpuSpread`.
- **Machine et charge** : Apple M5, 10 cœurs, macOS 27.2.1 (`darwin`, `arm64`), Node v24.18.0 ; `loadavg`
  4,74 / 4,15 / 3,50 au départ et 3,94 / 4,50 / 3,81 à la fin, 178,6 s (Mac partagé par plusieurs agents). Trois
  passes donnent le même JSON, hors champs de CPU, de charge et de durée. Le JSON rangé est celui de la troisième.

**Référence** : `replay()` fait ses 1 800 pas, sans mort ni victoire ; `chainHash` `576ce3b4`, instantané
`966c41e5710dbe3e…`. Ces valeurs peuvent dépendre de la base et de l'architecture (les 8 empreintes historiques de
`checks/campaign-world.test.mjs` échouent sur arm64 et passent sous x64) : seule compte l'égalité avec `replay()` dans
le même processus.

**Résultats** (valeurs du JSON). « À 0 pas » et « à plusieurs pas » comptent les images FLoop (`zeroStepFrames`,
`multiStepFrames`) ; « Verr. » est l'état du verrouillage à la fin.

| Motif | FLoop : images pour 1 800 pas | À 0 pas | À plusieurs pas | Verr. | FLoop : empreinte | Actuel : images (30 s) | Actuel : pas | Actuel : pas par seconde simulée | Actuel : instantané |
|---|---|---|---|---|---|---|---|---|---|
| 60 | 1 800 | 0 | 0 | oui | `576ce3b4`, celle du rejeu | 1 800 | 1 800 | 60 | `ac685f99` |
| q60 | 1 800 | 0 | 0 | oui | `576ce3b4`, celle du rejeu | 1 800 | 1 800 | 60 | `fa0276aa` |
| 59.94 | 1 799 | 0 | 1 | oui | `576ce3b4`, celle du rejeu | 1 798 | 1 798 | 59,94 | `083c6174` |
| 75 | 2 249 | 449 | 0 | non | `576ce3b4`, celle du rejeu | 2 250 | 2 250 | 74,99 | `23032362` |
| 120 | 3 598 | 1 798 | 0 | non | `576ce3b4`, celle du rejeu | 3 600 | 3 600 | 119,97 | `fc1cc16f` |
| 144 | 4 317 | 2 517 | 0 | non | `576ce3b4`, celle du rejeu | 4 320 | 4 320 | 143,95 | `468aa42e` |
| 165 | 4 946 | 3 146 | 0 | non | `576ce3b4`, celle du rejeu | 4 950 | 4 950 | 164,94 | `5a54e825` |
| jit144 | 4 317 | 2 517 | 0 | non | `576ce3b4`, celle du rejeu | 4 320 | 4 320 | 143,95 | `80d53a86` |
| long60 | 1 786 | 0 | 6 | oui | `576ce3b4`, celle du rejeu | 1 800 | 1 818 | 60 | `4e292bf1` |

Les colonnes du §8 de la mission (images FLoop, empreinte, pas en 30 s, pas par seconde simulée) sont conformes sur
les 9 lignes. Le temps simulé vaut 30 s pour chaque exécution FLoop (1 800 × 1/60, à 5e-13 près) ; de 29,997 à
30,011 s pour la formule actuelle, et 30,3 s pour `long60`, dont les images longues ajoutent 18 pas.

**Bilan.**

| Critère | Mesuré | Attendu |
|---|---|---|
| `distinctChainHashes` | 1, sur les 27 exécutions FLoop comptées (3 par motif) | 1 |
| `allSameAsReplay` | vrai : chaque exécution FLoop a les 1 800 pas, le `chainHash`, l'instantané et l'empreinte de chacun des 1 800 pas du rejeu (`sameState`) | vrai |
| `allStepsDone` | vrai : 1 800 pas pour chaque exécution FLoop | vrai (critère 6 du §9) |
| `distinctSnapshotsCurrent` | 9 instantanés distincts sur 9 | 9 sur 9 (mesuré par la mission sur le Mac) |
| `currentRepeatable` | vrai : pour chaque motif, les trois exécutions de la formule actuelle donnent le même instantané | (information) |

**Rapport de CPU, FLoop sur actuel** (information, sans seuil). Les colonnes 2 et 3 viennent de la passe rangée dans
le JSON ; la colonne 4 réunit les 9 rapports des trois passes (médiane, puis minimum et maximum).

| Motif | 3 rapports (JSON) | Médiane (JSON) | 9 rapports, 3 passes | Actuel : pas par seconde simulée |
|---|---|---|---|---|
| 60 | 1,06 ; 1,09 ; 0,93 | 1,06 | 1,00 (0,92 à 1,09) | 60 |
| q60 | 1,37 ; 0,99 ; 1,01 | 1,01 | 1,01 (0,99 à 1,88) | 60 |
| 59.94 | 0,88 ; 1,01 ; 0,83 | 0,88 | 1,01 (0,83 à 1,64) | 59,94 |
| 75 | 1,03 ; 0,94 ; 0,90 | 0,94 | 0,94 (0,85 à 1,29) | 74,99 |
| 120 | 0,54 ; 0,54 ; 0,60 | 0,54 | 0,56 (0,53 à 0,60) | 119,97 |
| 144 | 0,40 ; 0,57 ; 0,42 | 0,42 | 0,46 (0,40 à 0,63) | 143,95 |
| 165 | 0,66 ; 0,39 ; 0,41 | 0,41 | 0,40 (0,39 à 0,66) | 164,94 |
| jit144 | 0,48 ; 0,33 ; 0,43 | 0,43 | 0,48 (0,33 à 0,51) | 143,95 |
| long60 | 0,70 ; 0,94 ; 1,00 | 0,94 | 0,97 (0,70 à 1,26) | 60 |

Bruit de la machine : les 27 exécutions FLoop d'une passe font le même travail (même trajectoire, même empreinte). Dans
la passe rangée, elles coûtent pourtant de 44,2 à 142,7 ms de CPU par seconde simulée (de 42,7 à 127,1 dans la
deuxième) : un facteur 3, dû à la seule machine. Le Mac est partagé, et le type de cœur (performance ou efficacité)
sur lequel tourne le processus n'est pas maîtrisé. Les paires alternées comparent des exécutions voisines dans le
temps ; un rapport isolé peut quand même s'écarter de 88 % (`q60`, première passe).

**Ce que montre le banc.**
1. **Une seule empreinte, quel que soit l'écran (STAB-06, LOOP-05).** Avec FLoop, les 9 motifs jouent la même partie
   que `replay()`, pas par pas : 60 Hz exact, horodatages arrondis à 0,1 ms, 59,94, 75, 120, 144 et 165 Hz, gigue à
   144 Hz, images longues à 60 Hz. L'écran ne change que le nombre d'images (1 786 à 4 946) qui portent les 1 800 pas,
   jamais l'état. C'est le test que demande le « Vérifier par » de STAB-06, fait sur la vraie simulation.
   - Avec la formule actuelle, les 9 motifs donnent 9 états finaux différents, et aucun n'est celui du rejeu, pas même
     à 60 Hz exact : 1 pas par image, mais d'une durée prise sur l'intervalle mesuré, bruit flottant compris, et non
     de 1/60 s. `60` et `q60`, qui ne diffèrent que par l'arrondi des horodatages, divergent déjà.
   - Avant : 9 empreintes pour 9 écrans (formule actuelle). Après : 1 (FLoop).
2. **Le nombre de pas ne dépend plus de l'écran.** FLoop fait 1 800 pas pour 30 s simulées partout.
   - En verrouillage, un pas par image : `60` et `q60` ; `59.94`, sauf l'image 2, qui en fait 2 ; `long60`, sauf ses
     6 images longues.
   - Au-dessus de 60 Hz, 0 ou 1 pas par image. Images sans pas : 20 % à 75 Hz, 50 % à 120 Hz, 58 % à 144 Hz, 64 % à
     165 Hz.
   - La formule actuelle fait autant de pas que l'écran a d'images : de 2 250 à 4 950 pas pour les mêmes 30 s
     au-dessus de 60 Hz.
3. **CPU : une information, aucun gain annoncé.**
   - Classe 60 Hz (`60`, `q60`, `59.94`, `long60`) : rapport d'environ 1 (0,97 à 1,01 en médiane des 9 rapports), à
     nombre de pas égal. STAB-V1 (lot 01, déjà dans main) a supprimé les pas doublés à 60 Hz : le gain CPU de STAB-06
     à 60 Hz est déjà pris, il n'y a rien à annoncer ici.
   - Au-dessus de 60 Hz : 0,94 à 75 Hz, 0,56 à 120, 0,46 à 144, 0,40 à 165, 0,48 avec la gigue à 144 Hz. Mais les deux
     exécutions d'une paire ne jouent pas la même partie : la formule actuelle fait 75 à 165 pas par seconde simulée,
     et le pilote `drive()` est indexé par pas (lacet + 0,01 rad à chaque pas ; tir, esquive et déplacement latéral
     selon le numéro du pas). Le joueur y tourne 1,25 à 2,75 fois plus vite et son entrée suit le nombre de pas, pas
     le temps : ce n'est pas le même travail. Le rapport montre le poids du coût fixe d'un pas, pas un gain.
   - Les chiffres corrigés de l'audit (−19 % à 120 Hz, −26 % à 144 Hz, −49 % à 240 Hz, sur son scénario `c0`) ne
     sont ni reproduits ni comparables.
4. **La simulation reste sur le fil principal (PARA-V1).** Le rappel de pas appelle `sim.step` de façon synchrone,
   comme le fera `frame()` dans le rappel rAF, avant le dessin : la boucle à pas fixe n'ajoute pas d'image de latence.

Ce banc ne joue qu'un scénario (`legacy-s0`, 30 s, pilote scripté du lot 00), dans Node, avec des horodatages
synthétiques. « Même partie sur tous les écrans » vaut pour des entrées scriptées (démo, banc), pas pour un joueur
(STAB-06, réserve 4). L'interpolation du rendu (`track`) et les angles (`aim`) ne sont pas mesurés ici : voir
l'émulation de l'étape 2 (sections 2.5 et 2.6).

### 4.3 Coûts : `banc-couts.json` (étape 6)

Constats : STAB-06 et STAB-07 (coût propre de la boucle et de l'ordonnanceur, à chaque image).

- **Commande** : `node tools/boucle-banc-couts.mjs`, depuis la racine. Une ligne par mesure (médiane, cinq séries,
  seuil), puis un bilan ; code 0, ou 1 si une médiane atteint son seuil ou si le travail mesuré n'est pas le bon.
  Durée : 3,2 à 5,8 s.
- **Protocole** (§7.4 de la mission) : domaine principal, `process.hrtime.bigint()`, une série de chauffe non
  comptée, puis 5 séries ; on retient la médiane. Dans chaque série, les cinq mesures se suivent, dans un ordre
  inversé une série sur deux : sur une machine partagée, une charge passagère ou un ramasse-miettes ne tombe pas
  toujours sur la même mesure.

| Mesure | Protocole | Seuil (médiane) |
|---|---|---|
| `advanceNs` | 1 000 000 `advance(t, rappel)` sur les horodatages `jit144` précalculés (`Float64Array`), rappel qui incrémente un compteur, une boucle neuve par série ; ns par appel | < 1 000 ns |
| `advancePlanNs` | idem en mode plan, l'appelant lisant `frame.steps` | < 1 000 ns |
| `pump10Us` | `FSchedule.create({now: () => performance.now()})`, 10 tâches (clés 0 à 9, priorité k % 3, coût 0,001, `run()` rend `false`) ; 200 000 `pump(4)` ; µs par appel | < 20 µs |
| `pumpSim3Ns` | `FSchedule.create()`, 3 tâches « sim » qui rendent `Math.min(u, 100)` ; 1 000 000 `pumpSim(768)` ; ns par appel | < 2 000 ns |
| `track40Us` | `FLoop.track()` ; par image, `begin`, 40 `save`, `prune` et 40 `pose` (5 cm de déplacement : la pose est interpolée) ; 200 000 images ; µs par image | < 20 µs |

- **Le travail est vérifié** (`checks.workOk`). Les deux modes d'`advance` font les mêmes 416 668 pas pour
  1 000 000 d'images ; `pumpSim` consomme 300 unités par appel ; `track` suit 40 entités ; chaque série fait le même
  travail. Dans `pump`, les 10 tâches tournent à chaque appel : 2 000 000 d'exécutions par série, aucune sautée.
  L'horloge de `pump` est lue par l'outil (`performance.now()`), jamais par le module.
- **Sortie** : seulement `preuves/module-boucle/banc-couts.json` (3,6 Ko). Par mesure : la chauffe, les 5 séries, la
  médiane, le minimum, le maximum, le seuil et le travail ; en tête, la taille et le sha256 des deux modules mesurés.
- **Machine et charge** : Apple M5, 10 cœurs, macOS 27.2.1 (`darwin`, `arm64`), Node v24.18.0. Le JSON rangé est
  la dernière de quatre passes ; `loadavg` 2,73 / 4,15 / 4,09. La première passe a tourné sous une charge de 4,9.

**Résultats.** « 4 passes » donne la plus petite et la plus grande des quatre médianes du Mac. La colonne du Spark
(Linux arm64, 20 cœurs, Node v24.18.0, charge 1,7) est une passe faite au-delà de la fiche ; son JSON n'est pas
rangé. Marge : seuil divisé par la médiane du JSON rangé.

| Mesure | JSON rangé : 5 séries | Médiane | 4 passes, Mac | Spark | Seuil | Marge |
|---|---|---|---|---|---|---|
| `advanceNs` (ns) | 59,8 ; 59,3 ; 54,2 ; 54,2 ; 52,2 | 54,2 | 54,2 à 87,0 | 74,5 | 1 000 | × 18 |
| `advancePlanNs` (ns) | 58,4 ; 58,3 ; 56,4 ; 52,6 ; 52,5 | 56,4 | 53,8 à 79,7 | 72,0 | 1 000 | × 18 |
| `pump10Us` (µs) | 0,816 ; 0,868 ; 0,862 ; 0,828 ; 0,852 | 0,852 | 0,816 à 1,229 | 1,542 | 20 | × 23 |
| `pumpSim3Ns` (ns) | 75,5 ; 76,9 ; 77,5 ; 82,1 ; 74,7 | 76,9 | 74,5 à 110,9 | 90,3 | 2 000 | × 26 |
| `track40Us` (µs) | 0,921 ; 0,911 ; 0,907 ; 0,932 ; 0,931 | 0,921 | 0,900 à 1,365 | 1,349 | 20 | × 22 |

Repères de la mission (Mac M chargé) : 67 ns, 76 ns, 1,1 µs, 100 ns et 1,1 µs. Pré-mesure du chef de lot : 65 ns,
62 ns, 0,92 µs, 88 ns et 1,18 µs. Les quatre passes du Mac les encadrent. La passe sous une charge de 4,9 est 1,4 à
1,6 fois plus lente que les trois autres (charge 2,7 à 2,8), et sa marge reste d'au moins 11.

**Ce que montre le banc.**
1. **Le coût propre de la boucle est négligeable.** Par image, le jeu paiera un `advance` (54 ns), le suivi des
   entités (0,92 µs pour 40, proportionnel à leur nombre) et une pompe de la file « image » (0,85 µs pour 10 tâches).
   Cela fait 1,8 µs, soit 0,011 % d'une image de 16,7 ms (0,026 % à 144 Hz). Le travail des tâches elles-mêmes
   (synthèse, sérialisation) n'y est pas : c'est leur propre coût, que l'ordonnanceur étale sur les images.
2. **`pump` coûte surtout ses lectures d'horloge.** Avec 10 tâches, il appelle 31 fois `now()` : une fois au départ,
   trois fois par tâche. Une passe à part, hors banc, le confirme
   (`preuves/module-boucle/etape-6-pump-horloge.mjs`). Même protocole, horloges alternées, médianes de 5 séries :
   1,036 µs avec `performance.now()` contre 0,382 µs avec une horloge constante. Sous Node, `performance.now()`
   coûte 23,8 ns sur le Mac, soit 0,74 µs pour les 31 lectures. Sur le Spark : 1,572 µs contre 0,416 µs, et
   39,9 ns par lecture.
3. **La file « sim » est déterministe et peu coûteuse.** Un `pumpSim` de 3 tâches coûte 77 ns. À 60 pas par
   seconde, cela fait 4,6 µs par seconde simulée, sans aucune lecture d'horloge.
4. **Mêmes ordres de grandeur sous Linux arm64** (Spark, machine moins chargée). Seul `pump` y coûte plus, car la
   lecture d'horloge y est plus lente (point 2). Dans le navigateur, `performance.now()` a son propre coût et sa
   propre granularité : la part de l'horloge dans `pump` y reste à mesurer, au raccord.

### 4.4 Assemblage de la page : `assemblage.json` (étape 6)

Constats et règles : `AGENTS.md` (page autonome `dist/index.html`, `SIZE.json` fait foi, 1 400 000 octets bruts au
plus, aucun actif externe) ; §4.13 de la mission (insertion au raccord). Rien n'est reconstruit :
`python3 tools/build.py` n'est pas lancé, et `dist/index.html` et `SIZE.json` ne changent pas.

- **Commande** : `node tools/boucle-assemblage.mjs`, depuis la racine. Trois lignes (base, projet, bilan) ; code 0,
  ou 1 si un critère tombe. Une base non reproduite est signalée sans faire échouer l'outil (§7.5, point 4). Durée :
  0,1 s. L'outil n'écrit que `preuves/module-boucle/assemblage.json` (2,8 Ko).
- **Ce que fait l'outil** (§7.5) :
  - il lit la liste `modules` de `tools/build.py` (expression `/modules=\[([^\]]*)\]/`, puis les noms entre
    apostrophes) et joint les sources par `'\n;\n'` ;
  - il fait les trois remplacements de `build.py` dans `src/index.html`, dans le même ordre et sur toute la page :
    `/*__STYLE__*/`, `/*__CODE__*/`, puis `__GAME_VERSION__` ;
  - il remplace par `split/join` : `String.replace` ne remplacerait que la première occurrence et interpréterait les
    `$` ;
  - il lit les fichiers comme `Path.read_text()` de Python : UTF-8 strict, BOM gardé, fins de ligne universelles.
    Aucun fichier ne contient de `\r` (`checks.carriageReturns` est vide), donc le texte lu est celui du fichier,
    octet pour octet.
- **Base**, la liste telle quelle (14 modules) : 812 696 octets, sha256 `4587dc49…5c485a`.
  - Ce sont `html_bytes` et `sha256` de `SIZE.json` (0.8.1), et c'est `dist/index.html` octet pour octet.
  - Les tailles des 14 sources égalent les `source_bytes` de `SIZE.json`. La base est reproduite.
- **Projet** : `'loop.js','schedule.js'` juste après `'options.js'`, avant `'game.js'` (16 modules).

| Mesure | Base (main 0.8.1) | Projet du raccord | Écart |
|---|---|---|---|
| page brute | 812 696 octets | 822 965 octets | + 10 269 = 6 042 + 4 221 + 6 |
| marge sous 1 400 000 | 587 304 | 577 035 | − 10 269 |
| sha256 | `4587dc49…` | `9fdd167e…` | |
| gzip, zlib de Node (niveau 9, indicatif) | 246 658 | 250 178 | + 3 520 |
| gzip, zlib de Python (`gzip.compress`, comme `SIZE.json`) | 245 325 | 248 756 | + 3 431 |

Les deux gzip ne se comparent pas entre eux : `gzip_bytes` de `SIZE.json` vient du zlib de Python. Seul l'écart entre
base et projet, mesuré avec un même zlib, a un sens.

| Contrôle | Résultat |
|---|---|
| `delta === loopBytes + scheduleBytes + 6` (deux séparateurs `'\n;\n'` de 3 octets) | vrai |
| page projetée sous 1 400 000 octets (assertion de `build.py`) | vrai : marge de 577 035 octets |
| `</script` dans le code joint (assertion de `build.py`, insensible à la casse) | absent |
| les deux expressions de `checks/build.test.mjs` (actifs externes, code chargé par le réseau) | aucune ne correspond, ni sur la base ni sur le projet ; l'outil vérifie que leur texte figure tel quel dans le test |
| marqueurs `/*__CODE__*/` et `/*__STYLE__*/` | résolus |
| `FLoop` et `FSchedule` dans la page | absents de la base, présents dans le projet : le contrôle à ajouter dans `checks/build.test.mjs` au raccord (§4.13) passera |
| `syntaxOk` : `new vm.Script(code projeté)` | le code des 16 modules compile |
| `globalsOk` : `loop.js + '\n;\n' + schedule.js` dans `vm.createContext({window: {}})` | `window.FLoop.create` et `window.FSchedule.create` sont des fonctions. Rien d'autre n'est posé : `window` reçoit `FLoop` et `FSchedule`, le global du contexte ne reçoit rien |

**Contre-épreuve par Python.** On rejoue sous `python3 -I` les expressions des lignes 6 à 12 de `tools/build.py`,
sans aucune écriture. Le texte est dans `preuves/module-boucle/etape-6-couts-assemblage-navigateur.md`. Résultats :
- base : 812 696 octets, sha256 `4587dc49…` ;
- projet : 822 965 octets, sha256 `9fdd167e…`.

L'émulation en JavaScript donne donc la même page, octet pour octet, pour la base comme pour le projet. Le gzip de
Python (248 756 octets) est le chiffre que `SIZE.json` donnera au raccord, si les autres sources n'ont pas changé.

**Ce que montre l'assemblage.**
1. Le raccord coûte 10 269 octets bruts, soit 1,26 % de la page et 1,75 % de la marge, et 3,4 Ko compressés. La
   marge restante est de 577 035 octets.
2. Rien d'interdit n'entre dans la page : ni `</script`, ni réseau, ni actif. Les deux modules ne posent que leurs
   deux globaux.
3. Au raccord, `build.py`, `SIZE.json` et `checks/build.test.mjs` feront foi. L'outil refuse une liste qui contient
   déjà `loop.js` ou `schedule.js` : il ne sert qu'avant l'insertion.

### 4.5 Navigateur réel : Chrome sans tête (étape 6)

Constats : STAB-06 et STAB-07 (comptes et déterminisme des deux modules) ; MASTER-PROMPT §6 (la page doit marcher en
`file://`).

- **Page** : `preuves/module-boucle/navigateur.html` (6 Ko).
  - Elle charge `../../../../src/loop.js` et `../../../../src/schedule.js` en scripts classiques, ouverte en
    `file://` : ni serveur, ni port, ni réseau.
  - Son script en ligne vérifie de façon synchrone, pendant l'analyse de la page. Il écrit le JSON dans
    `<pre id="out">`, puis pose `data-result` (`ok` ou `echec`) sur le corps de page.
  - `--dump-dom` rend la page avant toute image rAF : aucune image réelle n'est mesurée.
- **Commande**, depuis la racine :
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-first-run --no-default-browser-check --user-data-dir="$(mktemp -d)" --dump-dom "file://$PWD/docs/chantier-moteur/preuves/module-boucle/navigateur.html" 2>/dev/null | grep -E '<body|<pre'`.
  Code 0. Sur stderr, il n'y a que des erreurs CVDisplayLink (pas d'écran en mode sans tête), sans effet.
- **Résultat** : `preuves/module-boucle/navigateur-resultat.txt`. La ligne `<body data-result="ok">` et le `<pre>`
  y sont recopiés tels quels, sous un en-tête de cinq lignes (version, machine, commande).

| Contrôle | Attendu (§7.6) | Chrome 157.0.8103.39, Mac M5 |
|---|---|---|
| globaux | `FLoop.create` et `FSchedule.create` sont des fonctions | oui ; `window.FLoop === FLoop` et `window.FSchedule === FSchedule` ; clés `create,aim,track` et `create,budget` |
| 144 Hz synthétique, 1 440 images (i·1000/144), rappel compteur | 601 pas, 839 images à 0 pas | 601 pas, 839 images à 0 pas, aucune à plusieurs pas, non verrouillé |
| 59,94 Hz synthétique, 600 images | seule l'image 2 fait 2 pas ; verrouillé à la fin | image 2 : 2 pas ; aucune image à 0 pas ; 601 pas ; verrouillé, période 16,6834 ms |
| S11 | 53 tranches, la dernière de 64 | 53 tranches, 52 de 768 puis 64 ; 40 000 unités |
| S01, horloge factice | ordre « BDAC » | `pump(10)` rend 4, ordre BDAC, file vide, 4 exécutions |
| `jit144`, au-delà de la fiche | même empreinte que sous Node | 10 000 images en mode plan : 4 168 pas, 5 832 images à 0 pas, empreinte `95894bbc`, celle de Node |

**Mêmes octets dans trois environnements.** Le dernier contrôle mélange dans une empreinte FNV-1a les octets de
chaque image (`steps`, `alpha`, `dt`, `dropped`), puis ceux de l'état final (11 statistiques, `acc`, `debt`,
période). Il prouve l'égalité au bit près, pas seulement celle des comptes.
- **Node v24.18.0, Mac.** `preuves/module-boucle/etape-6-navigateur-node.mjs` rejoue le script même de la page
  (extrait du fichier) avec les deux modules. Son JSON est celui de Chrome, au champ `engine` près. L'empreinte
  attendue dans la page vient de là ; le domaine principal (`loadRealm`) donne la même.
- **Chrome 151.0.7922.137 sur le Spark** (Linux aarch64), au-delà de la fiche. Même page et même commande avec
  `google-chrome`, sous `~/metal-tests/` : `data-result="ok"`, et le même JSON qu'au Mac, au champ `engine` près.
  L'agent utilisateur y annonce `Linux x86_64`, mais c'est la chaîne réduite de Chrome : `uname -m` donne `aarch64`.
- **Banc d'horloge sur le Spark** (Node v24.18.0, Linux arm64). Son `banc-horloge.json` est celui du Mac
  (section 4.1), en-tête excepté : les 21 motifs donnent les mêmes valeurs au bit près. FLoop n'utilise que les
  quatre opérations, `Math.round`, `abs`, `min`, `max` et un modulo entier, tous exacts ou correctement arrondis en
  IEEE 754 : le résultat ne dépend ni du moteur ni du processeur.

**Ce que montre l'essai.**
1. Les deux modules marchent comme ils seront dans la page : scripts classiques, `file://`, globaux sur `window`,
   sans `import` ni réseau.
2. Les comptes et les octets sont ceux de Node, sur deux versions de Chrome et deux systèmes : « mêmes appels, mêmes
   sorties, au bit près » tient d'un moteur à l'autre.
3. Les horodatages restent synthétiques. Restent à essayer au raccord : une vraie boucle rAF, un vrai écran
   (59,94 Hz, VRR), Safari et Firefox. Ils sont absents ici : Safari n'a pas de mode sans tête, et son pilote
   d'automatisation demande un réglage système ; Firefox n'est pas installé sur le Mac.

### 4.6 Pré-synthèse audio : `banc-audio.json` (étape 8, facultative)

Constats : STAB-07 (preuve du lot 07 T8 : plus longue tâche de pré-synthèse au plus 32 ms) et LOAD-13 (lots de
synthèse découpés par nombre d'effets, et non par durée) ; arbitrage « FEEL-06, FEEL-07, LOAD-13, LOOP-14,
BOSS-04 » (LOAD-13 d'abord, lots bornés en temps). Classe de preuve : état identique, PCM et jeu inchangés ; les
durées sont une information. Rien n'est branché : `audio.js` est mesuré tel qu'il est sur la base.

- **Commande** : `node tools/boucle-banc-audio.mjs`, depuis la racine. Trois lignes (A, B, PCM), puis un bilan ;
  code 0, ou 1 si un critère tombe. Durée : 0,9 s au calme, 1,3 à 1,9 s sous charge.
- **Protocole** (§7.8 de la mission) :
  - `FAudio` vient de `loadRealm({root, modules: ['music', 'audio'], realm: 'main'})`, et FSchedule de
    `loadRealm({root, modules: ['schedule'], realm: 'main'})` : domaine principal.
  - Horloge : le temps CPU du fil, `process.threadCpuUsage()` (utilisateur + système, en ms). C'est aussi l'horloge
    `now` passée à FSchedule : le module ne lit rien lui-même.
  - Tampons : chaque nom de `FAudio.effectNames`, variantes 0 et 1, une seule pour `motor:*`. Cela fait 34 noms et
    64 tampons à 22 050 Hz. Chauffe : chacun une fois.
  - **A, aujourd'hui** : des lots de 2 noms, avec toutes leurs variantes, comme `warmBank` (`audio.js:311`) ; une
    tranche chronométrée par lot.
  - **B, FSchedule** : une tâche « image » par tampon (clé `'pcm:'+nom+':'+variante`, priorité 6, coût 2), puis
    `while (S.count('frame')) tranches.push(S.pump(4))`, et `stats.maxSliceMs`.
  - 5 répétitions au lieu des 3 de la fiche, pour suivre la règle du chantier (au moins cinq, appariées et
    alternées). A passe avant B aux répétitions impaires, après B aux paires. On retient les médianes.
  - **PCM** : le sha256 des 64 `Float32Array`, dans l'ordre canonique, est comparé à celui de la chauffe, pour
    chacune des 11 constructions (chauffe, 5 fois A, 5 fois B).
- **Critères** (code 1 si l'un tombe) : PCM identique partout ; dans B, chaque tampon construit une fois, sans
  erreur ; dans A, une tranche par paire de noms ; dans B, la plus longue tranche et la plus longue tâche au plus à
  32 ms.
- **Sortie** : seulement `preuves/module-boucle/banc-audio.json` (7,6 Ko), sans aucune tranche une à une.
  - Par répétition : le nombre de tranches, la plus longue, la médiane, le total, et les comptes au-delà de 4, 8,
    16,7 et 32 ms.
  - Pour B, en plus : la plus longue tâche (`stats.maxSliceMs`) et son tampon, `ran`, `skipped` et `overrunMs`.
  - Les médianes, les trois lots et les trois tampons les plus lourds.
  - En tête : la taille et le sha256 de `audio.js`, `music.js` et `schedule.js`.
- **Machine et charge** : Apple M5, 10 cœurs, macOS 27.2.1 (`darwin`, `arm64`), Node v24.18.0. Le JSON rangé est la
  dernière de trois passes faites au calme (`loadavg` 1,88 / 3,55 / 3,77).

**Avant : le banc de départ.** Le prototype de l'audit, `node …/metal-audit/bancs/stab/sched.mjs <clone>`, tourne
sur la base du clone juste avant chaque passe. Il mesure dans le domaine principal, sur les mêmes 64 tampons et avec
la même horloge.

| Lancement | Lots actuels : tranches ; plus longue ; total | Prototype à 4 ms : tranches ; plus longue ; tâche la plus longue |
|---|---|---|
| 3 passes au calme (charge 1,9 à 2,0) | 17 ; 18,1 à 20,4 ms ; 72 à 82 ms | 17 ou 18 ; 9,8 à 11,2 ms ; 8,4 à 9,8 ms |
| 3 passes sous charge (3,2 à 3,3) | 17 ; 22,8 à 35,1 ms ; 92 à 146 ms | 22 à 25 ; 11,6 à 16,3 ms ; 11,6 à 15,0 ms |
| 1er lancement (charge 11,6) | 17 ; 24,6 à 27,8 ms ; 103 à 111 ms | 22 à 24 ; 12,5 à 15,6 ms ; 12,5 à 14,2 ms |
| pré-mesure du chef de lot (même M5) | 17 ; 18,1 à 18,3 ms ; 73 à 79 ms | 17 ou 18 ; 9,8 à 10,6 ms |

**Après : FSchedule (code normatif)**, `node tools/boucle-banc-audio.mjs`. Valeurs en ms : la médiane des 5
répétitions, et entre parenthèses l'étendue. « Écart » est l'écart de la plus longue tranche, tiré du rapport
apparié B/A médian.

| Passe (charge 1 min) | A : plus longue ; total | B : tranches ; plus longue ; tâche la plus longue ; total | Rapport B/A (plus longue) | Écart | Total B/A |
|---|---|---|---|---|---|
| 1 (1,95) | 18,9 (18,5 à 21,0) ; 75,4 | 18 ; 10,5 (10,1 à 10,9) ; 8,8 ; 76,9 | 0,552 (0,516 à 0,573) | −45 % | 1,01 |
| 2 (1,95) | 19,1 (18,5 à 21,1) ; 75,9 | 18 (17 à 20) ; 11,0 (10,0 à 11,4) ; 9,3 ; 75,8 | 0,564 (0,527 à 0,594) | −44 % | 1,00 |
| **3, rangée** (1,88) | **18,1** (18,0 à 18,9) ; **72,8** | **17** (17 à 19) ; **9,8** (9,7 à 10,0) ; **8,4** ; **73,0** | **0,540** (0,529 à 0,545) | **−46 %** | **1,00** |
| 4 passes préliminaires, sous charge (3,2 à 3,4) | 27,7 à 40,4 ; 111 à 161 | 23 à 25 (22 à 27) ; 13,0 à 20,3 ; 13,0 à 18,8 ; 108 à 162 | 0,455 à 0,505 | −49 à −55 % | 1,00 à 1,03 |
| Spark, 3 passes (1,4) | 20,6 à 21,0 ; 86 à 87 | 17 ou 18 (17 à 20) ; 11,0 ; 10,0 ; 86 à 87 | 0,524 | −48 % | 1,00 à 1,01 |

A compte toujours 17 tranches. Les passes préliminaires suivent le même protocole : depuis, seul l'affichage du
résumé a changé. La ligne du Spark (Linux arm64, 20 cœurs, Node v24.18.0) est une passe faite au-delà de la
fiche, sous `~/metal-tests/` ; son JSON n'est pas rangé.

**Ce que montre le banc.**
1. **PCM et jeu inchangés.**
   - Dans chaque passe, les 64 tampons ont les mêmes octets dans les 11 constructions, dans les deux ordres :
     sha256 `12eb48d9f0ca0e7da0228390f3ce4c9142a9ca20c725e2dd9ddbc9f370f3d50e`, soit 473 216 échantillons et
     1 892 864 octets de `Float32`, ou 1 848,5 Kio (les « 1,85 Mo » de LOAD-13).
   - Le Spark donne le même sha256 : la synthèse ne dépend ni de l'ordre de construction ni du système.
   - Aucun fichier du jeu n'est touché : rien n'est branché.
2. **La plus longue tranche baisse de 44 à 46 % au calme**, ce qui est l'« environ −45 % » attendu. Elle baisse de
   49 à 55 % sous charge et de 48 % sur le Spark.
   - Au calme, avec FSchedule, aucune tranche ne dépasse 16,7 ms, contre 1 ou 2 lots sur 17 aujourd'hui. Dans la
     pire passe sous charge, 3 ou 4 tranches dépassent 16,7 ms (la plus longue de 20,2 à 22,5 ms), contre 4 lots
     (le plus long de 40,0 à 42,0 ms).
   - Le total ne change pas (rapport de 1,00 à 1,03) : l'ordonnanceur étale le travail, il ne le réduit pas.
3. **Le seuil de 32 ms du lot 07 T8 tient.** La tâche la plus longue fait 8,4 à 9,3 ms au calme (médianes des
   passes), soit une marge de 3,4 à 3,8. Dans la pire passe sous charge, elle va jusqu'à 20,6 ms : la marge est
   encore de 1,55.
4. **Ce qui borne la tranche, c'est le tampon indivisible le plus lourd.**
   - Le plus lourd est `break:glass` (8,4 ms par variante au calme), devant `break:metal` (7,7 ms). Aujourd'hui, le
     lot le plus lourd est `impact:glass` et `break:glass` (18,1 ms), devant `impact:metal` et `break:metal`
     (16,7 ms).
   - Une tranche de B peut dépasser la tâche la plus longue d'au plus 2 ms. Toutes les tâches ont le coût estimé
     de 2 : un tampon lourd part donc tant qu'il reste 2 ms, y compris après un tampon léger (9,8 ms de tranche pour
     8,4 ms de tâche).
   - Pour descendre sous 4 ms, il faudrait découper `synthesize` (STAB-07). C'est hors du périmètre.
5. **Plus de tranches, plus courtes.** FSchedule fait 17 à 20 pompes au calme pour toute la banque, contre 17 lots
   aujourd'hui, et 22 à 27 sous charge. Ce nombre suit la vitesse de la machine : c'est le principe de la file
   « image ».
6. **Le plafond de pompe pendant le chargement** (point 12). Une passe à part le mesure, hors banc
   (`preuves/module-boucle/etape-8-plafond.mjs`, protocole B, 5 répétitions alternées, 3 passes sous une charge
   de 2,8) :

   | Plafond | Tranches | Plus longue (ms) | Au-delà de 16,7 ms | Images à 60 Hz, une pompe par image |
   |---|---|---|---|---|
   | `pump(4)` | 17 à 20 | 9,8 à 10,0 (9,7 à 11,1) | 0 | 17 à 20, soit 0,28 à 0,33 s |
   | `pump(8)` | 9 à 11 | 13,3 à 13,5 (10,5 à 13,7) | 0 | 9 à 11 |
   | `pump(12)` | 7 | 13,3 à 13,4 (13,2 à 14,4) | 0 | 7, soit 0,12 s |

   Le total (73 ms) et le PCM ne changent pas. Sur ce M5, un plafond de 12 ms construit la banque en 7 images au
   lieu de 18, sans aucune tranche au-delà d'une image à 60 Hz.
7. **Les repères ne se reproduisent pas tous.**
   - La pré-mesure du chef de lot (même M5) est reproduite par les passes au calme.
   - Le repère du §7.8 de la mission (A à 24 à 28 ms ; B à 21 ou 22 tranches et 11 ms) correspond au régime
     chargé de ce Mac, pas à son régime au calme.
   - STAB-07 donnait 52 à 86 ms aujourd'hui et 28 à 32 ms avec le prototype, sur la 0.8.0 et une autre machine.
     Les chiffres d'ici sont 2,5 à 4,8 fois plus petits. Le rapport reste du même ordre : STAB-07 annonçait −55 à
     −67 %.
   - LOAD-13 donnait des lots de 110 à 177 ms et 559 à 764 ms au total, soit 5 à 10 fois les chiffres d'ici. Il a
     mesuré sous `node:vm` (`bancs/load/music.mjs`, lignes 11 et 12 : `vm.createContext`, puis `vm.runInContext`),
     à l'horloge murale. Or ce contexte ralentit le code de 4,5 à 9 fois (MASTER-PROMPT §4) : cela explique
     l'essentiel de l'écart.
8. **Limites de la mesure.**
   - Node seulement : `warmBank` appelle aussi `ctx.createBuffer` et copie le PCM dans le tampon WebAudio. Ce coût
     n'est compté ni dans A ni dans B.
   - Sur ce Mac, le temps CPU d'un même travail varie d'un facteur 2,2 d'une passe à l'autre (charge, type de
     cœur). Seuls les rapports appariés d'une même passe se comparent.
   - Sur le Spark, l'horloge du fil avance par pas de 1 ms (comptage au tic), d'où les valeurs rondes.
   - `process.threadCpuUsage()` coûte 2,2 µs par appel sur le Mac et 0,19 µs sur le Spark. Une construction B en
     fait 209 à 219 (trois par tâche, une par pompe), soit moins de 0,5 ms en tout, comptées dans les tranches ; une
     construction A en fait 34.
9. **À relancer au raccord si `audio.js` change** (lot 11, recettes d'armes de FEEL-06). Le banc mesure
   l'`audio.js` de la base, dont le sha256 (`4b36fde2…`) est en tête du JSON. Le nombre de tampons suit
   `effectNames`.

## 5. Plan de raccord, non appliqué

Rien de ce qui suit n'est appliqué : aucun fichier existant n'est modifié, et FLoop et FSchedule ne sont ni dans
`tools/build.py` ni dans `npm test`. Les extraits et les numéros de ligne sont ceux de la base du clone (`71eca61`, dont
`src/` est identique à main 0.8.1, `363473a`) ; les constats citent souvent ceux de la 0.8.0. Les chiffres marqués
« calcul » viennent de `preuves/module-boucle/etape-7-raccord-calculs.mjs` : FLoop et `FOptions.frameGate` seuls,
horodatages synthétiques, sortie dans `etape-7-raccord-calculs.json`. Ce sont des calculs sur la boucle, pas des
mesures du jeu.

Ordre conseillé : les points 1 à 9 et 13 à 16 forment un seul changement, la boucle (le banc de 4.2 et les tests du
point 16 le vérifient) ; l'ordonnanceur (points 10 et 12) peut suivre ; le report du point de reprise (point 11)
attend une mesure dans Chrome.

### 5.1 Assemblage (§4.13 de la mission)

- `tools/build.py:6`, liste `modules` : ajouter `'loop.js','schedule.js'` juste après `'options.js'`, avant
  `'game.js'`. La page passe de 812 696 à 822 965 octets (+10 269 = 6 042 + 4 221 + 6), avec une marge de 577 035
  octets sous 1 400 000 (4.4).
- `checks/build.test.mjs:14` : ajouter `html.includes('FLoop')&&html.includes('FSchedule')`.
- `package.json:8`, script `test` : ajouter `checks/floop.test.mjs checks/fschedule.test.mjs`.
- `tools/realm-loader.mjs:12` : n'ajouter `'schedule'` aux `DEFAULT_MODULES`, et ne placer `schedule.js` avant
  `simulation.js`, que si la simulation se sert un jour de `pumpSim`.
- `dist/index.html` et `SIZE.json` sont reconstruits par `tools/build.py` au raccord.

### 5.2 Création

À côté de `game.js:14`, aujourd'hui :

```js
const framePacer=FOptions.createFrameGate();let cadenceHintAt=0;
```

ajouter :

```js
const loop=FLoop.create({hz:60,maxSteps:5}),sched=FSchedule.create({now:()=>performance.now()});
const track={player:FLoop.track(),enemies:FLoop.track(),projectiles:FLoop.track(),rubble:FLoop.track()};
const aimView={},playerView={};let pacerHz=0;
```

- Un traqueur par type d'entité, car les `id` se recouvrent d'un type à l'autre (2.6) : joueur, ennemis, projectiles
  (`id:++projectileSerial`, `simulation.js:989`), débris structurels (`id:++rubbleSerial`, `simulation.js:893`). Les
  corps sans `id` sont au point 9.
- `for(const k in track)track[k].clear()` quand les `id` changent de sens : nouvelle simulation dans `load()`
  (`game.js:225`) et reprise d'un point (`sim.restore`, `game.js:185` et `:198`).

### 5.3 Remise en phase

Une seule ligne dans `setMode` (`game.js:210-217`), le seul endroit où `mode` change (`:214`) :

```js
if(value==='playing')loop.reset();
```

- Elle couvre les quatre cas du §7.7 : entrée en jeu (`start`, `:261`), reprise après la pause ou la boutique
  (`togglePause`, `:846`), retour d'onglet, et fin de chargement (`preparePlay`, puis `action()` et `start`, `:274`).
- Le retour d'onglet passe par la pause : `visibilitychange` (`:983`), `blur` (`:981`) et `webglcontextlost` (`:985`)
  mettent le jeu en pause, et la reprise repasse par `setMode('playing')`. Aucun écouteur de plus n'est nécessaire.
- `last` (`:12`, `:212`, `:787`) reste pour le dt d'affichage (point 13). `setMode` appelle déjà `clearInput()`
  (définie en `:209`, appelée en `:214`), qui vide le regard et les impulsions en attente.

### 5.4 Hors jeu

Après `if(!present)return;` (`game.js:786`), avant les retours de `:788` et `:789` :

```js
if(mode!=='playing')loop.observe(now);
```

- Menus, pause, options, boutique, écrans de fin et chargement : FLoop continue d'estimer la période, sans avancer le
  temps simulé.
- Les images refusées par `frameGate` (`!present`) n'appellent pas FLoop. Il ne voit que les images présentées, et sa
  période devient la leur : 13,9 ms pour une limite de 60 sur un écran 144 Hz (calcul).

### 5.5 Changement de période

Le §7.7 demande `loop.resetPeriod()` quand `prefs.fpsLimit` change ou que l'écran change. Le calcul montre où
l'appeler.
- Dans l'écouteur de l'option (`game.js:891`), c'est trop tôt. `frameGate` montre la première image de la nouvelle
  cadence en phase 0, et cette image mesure encore un intervalle de l'ancienne. FLoop repart de 8,333 ms, lit ensuite
  16,667 ms comme deux périodes et reste pris au sous-multiple : un pas par image, sans verrouillage, alpha figé.
- Juste après `advance`, à l'image où `framePacer.effectiveHz` s'écarte de plus de 5 % de sa valeur au dernier
  `resetPeriod()`, la boucle se verrouille sur la nouvelle période. Le même test couvre le changement d'écran, qu'aucun
  événement ne signale.

```js
const ehz=framePacer.effectiveHz;           // juste après loop.advance(…)
if(ehz>0){if(!pacerHz)pacerHz=ehz;else if(Math.abs(ehz/pacerHz-1)>.05){loop.resetPeriod();pacerHz=ehz;}}
```

| Cas (calcul, 50 s après le changement) | `resetPeriod()` | Verrouillée à la fin | Période | Pas par image après le changement | alpha à la fin |
|---|---|---|---|---|---|
| limite 0 → 60, écran 120 Hz | aucun | non | 8,333 ms | 1 : 3 000 | 0,001 |
| limite 0 → 60, écran 120 Hz | dans l'écouteur de l'option | non | 8,333 ms | 0 : 5, 1 : 2 990, 2 : 5 | 0,001 |
| limite 0 → 60, écran 120 Hz | après `advance`, sur écart de `effectiveHz` | oui | 16,667 ms | 0 : 1, 1 : 2 998, 2 : 1 | 0,999 |
| écran 144 → 60 Hz, sans limite | aucun | non | 8,333 ms | 1 : 3 000 | 0,585 |
| écran 144 → 60 Hz, sans limite | après `advance`, sur écart de `effectiveHz` (2 appels) | oui | 16,667 ms | 1 : 3 000 | 0,999 |

Pris au piège, la boucle reste juste (un pas par image), mais l'interpolation affiche un retard constant de
(1 − alpha) × h : 16,65 ms, un pas entier, dans le cas de la limite, au lieu de 0 une fois verrouillée. Hors jeu, la
même règle après `observe` n'est pas calculée ici : à vérifier au raccord.

### 5.6 Entrées

Aujourd'hui (`game.js:795-799`), le regard et les impulsions sont lus une fois par image, puis effacés avant la boucle
de pas :

```js
input.lookX=lookDX+(Number(held('turnRight'))-Number(held('turnLeft')))*dt*1.9;input.lookY=lookDY;
…input.dash=dashQueued;input.pulse=pulseQueued;input.melee=meleeQueued;input.interact=interactQueued;…
lookDX=lookDY=0;dashQueued=pulseQueued=meleeQueued=interactQueued=false;
```

Avec FLoop, à 144 Hz sans limite, 58 % des images n'ont aucun pas (calcul : 58,322 %) : ce qui est effacé sur une
image sans pas est perdu (LOOP-06).
- **Regard** : il s'accumule d'image en image dans `lookDX` et `lookDY` (souris `:956`, toucher `:965`), touches de
  rotation comprises : `lookDX+=(Number(held('turnRight'))-Number(held('turnLeft')))*dt*1.9;`. Il n'est remis à zéro
  qu'après le premier pas qui le consomme (point 7) ; entre-temps, `aim` l'affiche (point 8).
- **Impulsions** `dashQueued`, `pulseQueued`, `meleeQueued` et `interactQueued` (posées par le clavier et par les
  boutons, `:977-980`) : copiées dans `input` au premier pas, effacées après ce pas seulement. La ligne `:799`
  disparaît.
- **Tir** : rien à changer. Depuis le lot 01 T2 (LOOP-06), `firePressed` et `fireLeftPressed` restent posés jusqu'au
  tir (`events()`, `:296-297`) ou 150 ms (`expireFireIntents`, `:33-36`), et `input.fire=fireHeld||firePressed` reste
  posé avant les pas (`:797`). L'écart le plus long entre deux images à pas est de 27,8 ms (72 i/s, calcul), loin des
  150 ms.
- `input.moveX`, `input.moveY`, `input.sprint`, `input.fire`, `input.fireLeft` et `input.weapon` restent posés avant
  les pas, comme aujourd'hui (`:793-797`).

### 5.7 Pas

Aujourd'hui (`game.js:802-811`) :

```js
const steps=Math.max(1,Math.ceil(dt*60-.06)),part=dt/steps;
for(let i=0;i<steps;i++){
  sim.step(part,input);input.lookX=input.lookY=0;input.dash=input.pulse=input.melee=input.interact=false;
  events();
  if(mode!=='playing')break;
  input.fire=fireHeld;input.fireLeft=fireLeftHeld;
  input.weapon=selectedWeapon;
}
```

Après :

```js
const f=loop.advance(now,(h,i)=>{
  if(i===0){for(const k in track)track[k].begin();
    input.lookX=lookDX;input.lookY=lookDY;input.dash=dashQueued;input.pulse=pulseQueued;input.melee=meleeQueued;input.interact=interactQueued;}
  saveTracks();                       // track.*.save(id,x,y,z,a) de chaque entité suivie, avant le pas
  sim.step(h,input);
  if(i===0){lookDX=lookDY=0;dashQueued=pulseQueued=meleeQueued=interactQueued=false;}
  input.lookX=input.lookY=0;input.dash=input.pulse=input.melee=input.interact=false;
  events();
  if(mode!=='playing')return false;
  input.fire=fireHeld;input.fireLeft=fireLeftHeld;input.weapon=selectedWeapon;
});
if(f.steps)for(const k in track)track[k].prune();
```

- `saveTracks()`, fonction neuve, sauve avant chaque pas la pose que lira le rendu : joueur (`p.x`, `p.y||0`, `p.z`,
  `p.yaw`), ennemis (`e.x`, `e.baseY`, `e.z`, `e.yaw`, ce que lit `FActors.build`), projectiles et débris structurels.
- `h` vaut toujours 1/60 s : `sim.step` ne reçoit plus un dt qui dépend de l'écran.
- Le retour `false` arrête l'image après un pas qui a changé de mode (victoire, mort, boutique), comme le `break`
  d'aujourd'hui. Le reste est compté en abandon (`stats.abortedMs`), et `reset()` remettra la boucle en phase à la
  reprise.
- Le rappel tourne de façon synchrone, dans le rappel rAF et avant le dessin : la simulation reste sur le fil
  principal, sans image de latence (PARA-V1).

### 5.8 Rendu

Aujourd'hui (`game.js:832-837`), la caméra et les modèles lisent l'état courant :

```js
const p=sim.state.player,isPlay=mode==='playing'||mode==='paused',t=mode==='menu'?clock:sim.state.time;
const camera={pos:[p.x,(p.y||0)+1.62+(isPlay?view.height:0),p.z],yaw:p.yaw,pitch:p.pitch,…};
```

Après :

```js
const p=sim.state.player,isPlay=mode==='playing'||mode==='paused',alpha=loop.frame.alpha,t=mode==='menu'?clock:sim.state.time-(1-alpha)*loop.step;
const a=FLoop.aim(p.yaw,p.pitch,lookDX,lookDY,-1.2,1.2,aimView),q=track.player.pose(0,p.x,p.y||0,p.z,p.yaw,alpha,playerView);
const camera={pos:[q.x,q.y+1.62+(isPlay?view.height:0),q.z],yaw:a.yaw,pitch:a.pitch,…};
```

- **Angles** : `FLoop.aim` ajoute aux angles de la simulation le regard pas encore consommé, avec les opérations exactes
  du pas (`simulation.js:1909`) : le pas suivant arrive au même angle, au bit près (2.5). Les bornes sont celles du
  pas, −1,2 et 1,2.
- **Positions** : `track.*.pose(…, alpha, out)`, avec des objets `out` créés une fois et réutilisés.
- **Temps de rendu** `t = sim.state.time − (1 − alpha) × loop.step`, pour `signals.time`, `models(t, …)` et
  `renderer.draw({time:t})`. Sans lui, les animations n'avancent qu'aux images qui ont un pas : à-coups à 144 Hz.
- **Modèles** : `models()` (`:521`) lit l'état directement. Les ennemis passent par `FActors.build(e, options)` (`:541`,
  qui lit `e.x`, `e.baseY`, `e.z` et `e.yaw`), avec leurs anneaux et repères (`:544-553`). Les projectiles et les
  débris passent par `FEffects.build(s, world, camera, options)` (`:523` ; `effects.js:145`, `:173`, et les traînées
  de roquette, `:214`). Il leur faut une pose de rendu : une option `pose` dans `FActors.build` et `FEffects.build`, ou
  une vue de rendu par entité. Ne jamais écrire la pose interpolée dans `sim.state` : l'état reste celui des pas
  (lecture seule, 2.6).
- La rotation des débris (trois angles) n'est pas couverte par `track`, qui n'a qu'un angle. La laisser à l'état
  courant, ou ajouter un second traqueur dont x, y et z sont les trois angles, avec un `snap` d'environ 1 rad pour
  qu'un repli à ±π rende la pose courante. À juger à l'écran.
- Menus et options (`:836`) : la caméra reste celle d'aujourd'hui.

### 5.9 Corps sans `id`

Trois sortes de corps n'ont pas d'`id` : les balles ennemies (`s.bullets`, créées à `simulation.js:1252`, dessinées à
`game.js:569`), les éclats non structurels (`simulation.js:892`, dessinés par `FEffects`) et les particules
(`simulation.js:525`, dessinées à `game.js:570`).
- **Voie du §7.7 : extrapolation arrière.** Le corps est dessiné à `position − vitesse × (1 − alpha) × h`.
  - Balles : exacte, elles vont en ligne droite à vitesse constante (`dx`, `dy`, `dz`, `simulation.js:1930`).
  - Particules : leur vitesse verticale perd 3 m/s par seconde (`q.vy-=dt*3`, `:1936`). Erreur de 3 × h² × (1 − alpha),
    0,83 mm au plus.
  - Éclats : gravité de 12 m/s² et rebonds (`updateDebris`, `:1028`). Erreur de |Δv| × h × (1 − alpha), 3,3 mm au plus
    pour la gravité seule, davantage sur un rebond.
  - Un corps né pendant le dernier pas serait dessiné en arrière de son point de départ : ne pas extrapoler un corps de
    moins d'un pas (balles : `5 − life < h` ; éclats : `age < h`).
- **Autre voie, sans changement de format : `track` avec l'objet pour clé.** `track.save(id, …)` range la pose dans une
  `Map`, dont la clé peut être l'objet lui-même : `track.bullets.save(q,q.x,q.y,q.z)`, un traqueur par sorte de corps.
  L'interpolation est alors exacte, comme pour les entités à `id`, et rien n'est écrit dans `sim.state`.
  - Condition : la simulation garde le même objet d'un pas à l'autre. C'est le cas dans le code lu : mises à jour en
    place (`:1930`, `:1936`, `updateDebris`), filtres qui gardent les objets (`:1064`, `:1186`, `:1932`, `:1937`).
    `restore` en crée de nouveaux (`:2210-2211`), d'où le `clear()` du point 2.
  - Coût : environ 23 ns par corps et par image (4.3 : 0,92 µs pour 40), soit 4 µs pour 180 particules.
  - À vérifier par un test au raccord ; aucun calcul ici.
- **Voie du §7.7, aussi : leur donner un `id`**, ce qui change le format des points de reprise (lot 12).

Recommandation : question 4.

### 5.10 Ordonnanceur

Après `renderer.draw` (`game.js:837`) :

```js
sched.pump(FSchedule.budget(loop.period||1000/60,performance.now()-frameStart));
```

- `frameStart=performance.now()` est lu au début de `frame()`.
- `loop.period` est la période des images présentées (13,9 ms pour une limite de 60 sur 144 Hz) : c'est le bon budget.
  Tant qu'aucun intervalle n'est mesuré, elle vaut 0, et le budget part de 1000/60.
- En mode « loading », `frame()` sort à `:789`, avant le dessin. Pour que la pré-synthèse du point 12 avance pendant
  l'écran de chargement, pomper aussi juste avant ce retour.
- La file « image » ne contient que de la présentation, des caches et de la sérialisation (règle 5) ; la simulation
  n'appelle jamais `pump` (règle 3).
- Le coût propre de `pump` est surtout celui de ses lectures d'horloge (4.3) : à mesurer dans le navigateur.

### 5.11 Point de reprise (LOAD-03, lot 02 T4)

Aujourd'hui (`game.js:165-174`), tout se fait dans l'image :

```js
checkpoint=sim.snapshot();
savedRun={version:…,runStats:{...runStats},entryLoadout:copyLoadout(stageEntryLoadout),checkpoint};
try{preserveRefusedSave();localStorage.setItem(SAVE_KEY,JSON.stringify(savedRun));saveAvailable=true;}catch{saveAvailable=false;}
$('checkpoint-status').textContent=…;refreshContinue();
```

- **L'instantané reste synchrone** (`:169`) : l'arbitrage « LOOP-03, LOAD-03, SIM-01 » interdit de le différer (SIM-01,
  puis LOAD-03).
- **Ce qui peut devenir une tâche « image »** : les lignes `:171-173`, dans
  `sched.add({key:'save',priority:2,run(){…}})`. La clé unique fusionne les points d'une même image en une écriture :
  une nouvelle tâche `'save'` remplace l'ancienne.
- **Forcer l'écriture** : `sched.flush('save')` dans un écouteur `pagehide`, qui n'existe pas aujourd'hui (aucun dans
  `src/`), et dans l'écouteur `visibilitychange` (`:983`) quand `document.hidden`.
- **Deux réserves, à lever avant de différer quoi que ce soit** :
  1. Réserve 3 de la contre-vérification de STAB-07 : différer `stringify` exige que `snapshot()` rende une copie sans
     aucune référence vers l'état vivant. À garantir par un test : instantané, 60 pas, puis JSON identique à celui pris
     tout de suite. Le test porte sur tout `savedRun`, dont `runStats` (copie superficielle, `:170`) et `entryLoadout`.
  2. Réserve de LOAD-03 : le report rapporte peu (`stringify` de 1,0 à 1,2 ms pour 167 K caractères, `setItem` non
     mesuré) et risque de perdre le dernier point. C'est du P2, à décider après une mesure dans Chrome (`file://`,
     panneau Performance). Le gros du coût (33 à 35 ms après une brèche) part avec la réduction de la file de
     navigation (LOAD-02, SIM-01), sans rien différer.
- **Appels hors de l'image** : `saveCheckpoint()` est aussi appelé depuis des menus, la boutique et les chargements
  (`:200`, `:206`, `:207`, `:264`, `:350`, `:867`, `:873`). Seul l'appel d'`events()` (`:341`), pendant les pas, gagne
  à être différé ; les autres peuvent rester synchrones.
- L'échéance du report « en l'air » (`:167`, `checkpointPending`), que demande le même arbitrage, est au lot 02 T4,
  hors de cette voie.

### 5.12 Pré-synthèse audio (LOAD-13, lot 11)

Aujourd'hui, `warmBank` (`audio.js:290-313`) construit la banque par lots de 2 effets, un lot par `setTimeout`
(`:311`), sans borne de temps. `audio.prepare` l'appelle (`:458`), et `preparePlay` l'attend derrière l'écran de
chargement (`game.js:271`).
- Avec FSchedule : une tâche « image » par tampon (nom et variante), priorité 6, coût 2, clé `'pcm:'+nom+':'+variante`.
  `finish()` (démarrage des moteurs, `pcmReady`) tourne après la dernière. `audio.js` étant un module FERRO,
  l'ordonnanceur lui est passé en paramètre (par exemple `audio.prepare(n,{schedule:sched})`) ; sans ordonnanceur, le
  chemin reste celui d'aujourd'hui.
- La plus longue tranche devient celle du tampon le plus lourd, indivisible tant que `synthesize` n'est pas découpée :
  `break:glass`, 8,4 ms au calme sur le Mac M5, et 10 ms sur le Spark (4.6).
- Réserve 1 de la contre-vérification de STAB-07 : cette pré-synthèse tourne derrière l'écran de chargement. Le
  découpage rend la barre plus fluide, pas la partie.
- **Plafond pendant le chargement**, mesuré en Node (4.6, point 6). Avec `pump(4)`, il faut 17 à 20 pompes pour toute
  la banque, soit 0,28 à 0,33 s à 60 Hz avec une pompe par image. Avec `pump(12)`, il en faut 7, soit 0,12 s, et la
  plus longue tranche fait 13,3 à 14,4 ms, sous une image à 60 Hz. L'image de chargement est presque vide (`frame()`
  sort à `:789`) : un plafond de 12 ms, `FSchedule.budget(P,travail,12)`, garde la barre animée sans allonger le
  chargement. L'estimation d'avant l'étape 8 (« plus d'une seconde en plus ») partait des totaux de LOAD-13, mesurés
  sous `node:vm`.
- Le PCM doit rester identique au bit près (`checks/audio.test.mjs`, `checks/music.test.mjs`) : l'ordre de
  construction est indifférent si chaque synthèse est pure (LOAD-13). Le banc le vérifie : même sha256 dans les deux
  ordres, sur le Mac comme sur le Spark (4.6, point 1).
- Mesuré à l'étape 8 (4.6), sur le Mac M5 au calme : aujourd'hui, 17 tranches, la plus longue de 18,0 à 21,1 ms ;
  avec FSchedule, 17 à 20 tranches, la plus longue de 9,7 à 11,4 ms, pour le même total (73 à 77 ms). L'écart est de
  −44 à −46 %. Les repères du §7.8 de la mission (24 à 28 ms ; 21 ou 22 tranches et 11 ms) sont ceux du même Mac
  sous charge.
- Le coût estimé de 2 ms, le même pour tous, laisse un tampon lourd suivre un tampon léger dans la même pompe : la
  tranche dépasse alors la tâche d'au plus 2 ms (9,8 ms de tranche pour 8,4 ms de tâche). Un coût par tampon (plus
  lourd pour `break:*`) ne gagnerait que ces 2 ms, derrière l'écran de chargement : on garde le coût de 2.

### 5.13 Ce qui reste au dt d'affichage

Le dt de l'image (`dt`, `game.js:787`) reste celui de la présentation :
- `:812-829` : mélange extérieur, paysage sonore, `audio.tick(dt)`, bruits de pas, phases d'animation des acteurs
  (`actorMotion`), mécanismes (`systemMotion`), toasts, rencontre, tic de HUD, réticule et dégâts ;
- `:833-834` : `motion.update` et `leftMotion.update` (balancement de l'arme), `shieldLift` ;
- `signals.lookYaw` et `signals.lookPitch` (`:798`) : le regard **reçu dans l'image**, divisé par dt, et non le regard
  consommé par le pas ; sinon le balancement de l'arme saute d'une image à pas à l'autre. Par exemple, garder la part
  de `lookDX` laissée en attente à la fin de l'image précédente, et la retrancher au début de la suivante.

### 5.14 À ne pas toucher

- `pumpNav` (`simulation.js:1379`) : le modifier casse `checks/simulation.test.mjs` (fiche T1 ; `:1866` vérifie au
  plus 768 cellules par pas). Avec le pas fixe, il répare 768 cellules par pas, donc 46 080 par seconde simulée, quel
  que soit l'écran : c'est déjà le « pumpNav en cellules par seconde » de l'arbitrage « LOOP-05, FEEL-08, LOOP-08,
  SIM-12 », sans y toucher. À 144 Hz, la boucle actuelle en répare 110 592 par seconde : la réparation après une
  brèche y sera 2,4 fois plus lente qu'aujourd'hui, comme à 60 Hz.
- L'écho `input.weapon=selectedWeapon` à chaque pas (`game.js:797` et `:810`, PARA-V2, lot 07 T2) : gardé tel quel dans
  le rappel (point 7), à traiter à part (question 5).

### 5.15 Retour anticipé de `sim.step`

`simulation.js:1902` :

```js
dt=Number.isFinite(dt)?clamp(dt,0,.05):0;if(s.won||s.dead||checkPlayerBounds())return;
```

Ce retour vient avant la ligne du regard (`:1909`) : le regard du pas n'est pas consommé. Le rappel du point 7 vide
`lookDX` et `lookDY` après le premier pas sans condition, retour anticipé compris : `aim` montre alors les angles de la
simulation, et l'image n'affiche jamais un regard que la simulation n'appliquera pas (condition 3 de 2.5). Les retours
de `:1913`, `:1915` et `:1920` viennent après la ligne du regard, qui est alors consommé. Aujourd'hui, le regard est
déjà jeté de la même façon, à chaque image (`game.js:799`).

### 5.16 Tests et outils à adapter

- `checks/cadence.test.mjs:8` et `tools/cadence-profile.mjs:20` lisent la formule par l'expression
  `/const steps=([^\n]+?),part=dt\/steps;/`, qui ne trouvera plus rien. Les remplacer par `checks/floop.test.mjs` et
  un test du raccord : `game.js` crée `FLoop.create({hz:60,maxSteps:5})` et `frame()` appelle `loop.advance` ; même
  empreinte d'état à travers `frame()` à 60, 75, 120 et 144 Hz et avec des horodatages arrondis, pour des entrées
  scriptées (le « Vérifier par » de STAB-06). `tools/cadence-profile.mjs` est à réécrire sur FLoop, ou à retirer.
- Les tests qui appellent `frame()` : `checks/input.test.mjs` et son harnais, `checks/checkpoint.test.mjs`,
  `checks/audio.test.mjs`. Calcul : FLoop seul après `reset()` (entrée en jeu), contre la formule actuelle
  (`game.js:787` et `:802`).

| Suite | Images (ms) | Pas FLoop par image | Temps simulé, FLoop | Aujourd'hui | Effet attendu |
|---|---|---|---|---|---|
| `input.test.mjs:82-89` | une première image de 50, 33,3, 16,7 ou 6,94 | 1 | 16,667 ms | 3, 2, 1 ou 1 pas | l'appui est consommé par ce pas : le test devrait passer |
| `input.test.mjs:91-95` | 120, 120 | 1, puis 5 (36,667 ms abandonnés) | 100 ms | 8, 8 (240 ms) | `assert(app.steps.length>1)` échoue : la première image après `reset()` fait un seul pas |
| `input.test.mjs:97-102` | 10, 100, 100, 60 | 1, 5, 5, 4 (16,667 ms abandonnés deux fois) | 250 ms | 1, 6, 6, 4 (270 ms) | délai restant du pistolet de 0,087 s au lieu de 0,06 : la fenêtre ]0 ; 0,07[ échoue |
| `checkpoint.test.mjs` | 7 images de 100 | 1, puis 5 par image (16,667 ms abandonnés à chaque) | 516,667 ms | 6 par image (700 ms) | 83,3 ms simulés par image au lieu de 100 : les attentes de N images donnent 17 % de temps en moins |
| `input.test.mjs` | 10 images de 20 | 1, 2, 1, 1, 1, 1, 2, 1, 1, 1 | 200 ms | 2 par image (200 ms) | même temps simulé, moitié moins de pas |
| `audio.test.mjs` | 10 images de 40 | 1, 3, 2, 3, 2, 2, 3, 2, 3, 2 | 383,333 ms | 3 par image (400 ms) | à vérifier |

Corrections proposées, sans baisser aucune valeur attendue (calcul, `fixes` dans le JSON) :
- `input.test.mjs:91-95` : une image d'amorce (`app.frame(1000/60)`) avant l'appui. Les images de 120 ms font alors
  5 pas, dont un seul reçoit le tir verrouillé.
- `input.test.mjs:97-102` : après `firstShot`, 16 images de 1000/60 ms au lieu de 100, 100 et 60 ms. Cela fait 16 pas
  et un délai restant de 0,053 s, dans la fenêtre. Les 6 images de 20 ms font ensuite 1, 2, 1, 1, 1 et 1 pas, et le
  pistolet est prêt au quatrième pas, bien avant les 150 ms du tampon d'appui.
- `checkpoint.test.mjs:390` (6 images de 100 ms « pour laisser finir la récupération de la Fracture ») : 0,5 s
  simulée au lieu de 0,6. À vérifier, et ajouter une image si la récupération dure plus.
- Ajouter un test de LOOP-06 sur les images sans pas : à 144 Hz, une impulsion (esquive) posée sur une image sans pas
  est consommée une fois, par le pas suivant, et un tap n'est jamais perdu.
- Ajouter le test de la réserve 3 de STAB-07 (point 11) avant tout report de `stringify`.
- `checks/floop.test.mjs` et `checks/fschedule.test.mjs` entrent dans `npm test` (point 1).

## 6. Limites connues

1. **Environnements.** Seulement Node (Mac et Spark) et Chrome sans tête (deux versions), avec des horodatages
   synthétiques ; `--dump-dom` rend la page avant toute image rAF. Pas testés : une vraie boucle rAF, un vrai écran à
   59,94 Hz, le VRR (G-Sync, FreeSync), la quantification des horodatages de Safari et de Firefox.
2. **Piège du sous-multiple** (T-F22). Après le passage d'un écran rapide à un lent, ou d'une limite à une autre, la
   boucle reste juste (un pas par image), mais ne se verrouille plus : sa période reste à 8,333 ms. alpha reste figé à
   une valeur quelconque, et les positions affichées gardent un retard constant de (1 − alpha) × h. Calcul : 16,65 ms
   (alpha 0,001) pour une limite passée de 0 à 60 sur un écran 120 Hz, 6,9 ms (alpha 0,585) pour un écran passé de 144
   à 60 Hz. Remède : `resetPeriod()` placé comme au point 5 ; appelé dans l'écouteur de l'option, il ne suffit pas.
3. **Latence hors verrouillage** : un demi-pas en moyenne (8,3 ms) sur les positions, zéro sur les angles (`aim`).
4. **Réserve 3 de STAB-06 : tir et impulsions sur écran rapide.** Ce qui passe par un pas (tir, esquive,
   déplacement) attend la prochaine image qui a un pas. Calcul : appui uniforme dans le temps, attente jusqu'au pas qui
   le consomme, hors latence du navigateur et de la composition, qui est la même dans les deux cas.

   | Cadence | FLoop : moyenne / pire (ms) | Aujourd'hui : moyenne / pire (ms) | Écart entre deux images à pas (ms) |
   |---|---|---|---|
   | 60 Hz | 8,3 / 16,7 | 8,3 / 16,7 | 16,7 |
   | 72 i/s (limite 60 sur 144 Hz) | 9,3 / 27,8 | 6,9 / 13,9 | 13,9 et 27,8 |
   | 75 Hz | 9,3 / 26,7 | 6,7 / 13,3 | 13,3 et 26,7 |
   | 120 Hz | 8,3 / 16,7 | 4,2 / 8,3 | 16,7 |
   | 144 Hz | 8,7 / 20,8 | 3,5 / 6,9 | 13,9 et 20,8 |
   | 144 Hz avec gigue (`jit144`) | 8,7 / 21,6 | 3,5 / 7,2 | 13,5 à 21,6 |
   | 165 Hz | 8,5 / 18,2 | 3,0 / 6,1 | 12,1 et 18,2 |

   La réserve dit qu'« un tir attend jusqu'à 16,7 ms » : c'est 20,8 ms à 144 Hz, où les images à pas sont espacées de
   2 ou 3 images. À 60 Hz, rien ne change. Les angles restent immédiats. Le remède de la réserve, le pas à 120 Hz
   automatique, n'est pas dans le module (question 2).
5. **Réserve 4 de STAB-06.** « Même partie sur tous les écrans » vaut par construction pour des entrées scriptées
   (démo, banc, 4.2), pas pour un joueur, dont les gestes n'arrivent pas aux mêmes instants.
6. **Limite à 60 par défaut** (MASTER-PROMPT §6, lot 07 ; aujourd'hui `fpsLimit` vaut 0, `options.js:6`). Avec
   `frameGate` tel quel, seuls les écrans 60, 120 et 240 Hz donnent une boucle verrouillée. Calcul, 60 s par cas,
   horodatages arrondis à 0,1 ms ; une limite d'au moins 95 % de la fréquence ne limite rien (LOOP-09), et ces cas ne
   sont pas recalculés :

   | Écran | Sans limite | Limite 30 | Limite 60 | Limite 120 |
   |---|---|---|---|---|
   | 60 Hz | verrouillée, 1 pas par image | 30 i/s, verrouillée, 2 pas par image | comme sans limite | comme sans limite |
   | 120 Hz | non verrouillée, 50 % d'images sans pas | 30 i/s, verrouillée | 60 i/s, verrouillée | comme sans limite |
   | 144 Hz | non verrouillée, 58 % sans pas | 28,8 i/s, non verrouillée, 1 image sur 12 à 3 pas | **72 i/s, non verrouillée, 1 image sur 6 sans pas** | 144 i/s, comme sans limite |
   | 165 Hz | non verrouillée, 64 % sans pas | 33,0 i/s, non verrouillée, 1 image sur 5,5 à un seul pas | **55 i/s, non verrouillée, 1 image sur 11 à 2 pas** | 165 i/s, comme sans limite |
   | 240 Hz | non verrouillée, 75 % sans pas | 30 i/s, verrouillée | 60 i/s, verrouillée | 120 i/s, non verrouillée, 50 % sans pas |

   L'interpolation garde le mouvement fluide dans tous les cas ; ce sont la latence et la régularité du travail par
   image qui changent (question 9).
7. **La file « image » ne coupe jamais une tâche** : la plus longue tâche indivisible borne l'image. Pour la
   pré-synthèse, c'est le tampon le plus lourd, `break:glass` : 8,4 ms au calme sur le Mac M5, jusqu'à 20,6 ms sous
   charge. Une tranche peut y ajouter jusqu'à 2 ms d'un tampon léger (4.6).
8. **Mesures de CPU sur une machine partagée** (Mac, charge de 2 à 5) : un facteur 3 entre des exécutions identiques
   (4.2). Les rapports de CPU de 4.2 ne sont qu'une information. Au banc audio (4.6), le temps CPU du fil d'un même
   travail varie d'un facteur 2,2 d'une passe à l'autre ; seuls les rapports appariés d'une même passe se comparent.
9. **Rattrapage borné à 5 pas** : sous 12 images par seconde, le jeu ralentit (le temps abandonné est compté) ;
   aujourd'hui, il ralentit sous 8,3 images par seconde (dt borné à 0,12 s).
10. **Réparation de la navigation** : 46 080 cellules par seconde simulée partout ; sur un écran 144 Hz, 2,4 fois moins
    vite qu'aujourd'hui (point 14).
11. **Entités nées pendant le dernier pas**, ou déplacées de plus de 2 m en un pas (téléportation, ascenseur,
    propulsion) : dessinées à leur pose courante, sans interpolation, pendant une image.
12. **Corps sans `id`** : l'extrapolation se trompe d'au plus 0,83 mm pour les particules, davantage pour un éclat qui
    rebondit (point 9) ; avec l'objet pour clé, l'interpolation est exacte.
13. **Dilatation dans la bande d'hystérésis.** L'invariant 3 (au plus un pas plus 1 % du temps réel) tient sur les 21
    motifs. Mais une boucle verrouillée garde son verrou jusqu'à 2 % d'écart : si la période glisse après le
    verrouillage, la simulation prend autant de retard. Calcul, boucle verrouillée 5 s à 60 Hz, puis période allongée
    pendant 10 minutes :

    | Glissement de la période | Verrouillée à la fin | Dilatation sur 10 min | Borne de l'invariant 3 | Invariant 3 |
    |---|---|---|---|---|
    | +0,5 % | oui | −2 968 ms (−0,49 %) | 6 067 ms | tenu |
    | +0,9 % | oui | −5 335 ms (−0,88 %) | 6 067 ms | tenu |
    | +1,2 % | oui | −7 098 ms (−1,17 %) | 6 066 ms | **dépassé** |
    | +1,5 % | oui | −8 850 ms (−1,46 %) | 6 067 ms | **dépassé** |
    | +1,9 % | oui | −11 171 ms (−1,85 %) | 6 067 ms | **dépassé** |
    | +2,1 % | non, déverrouillée | +7 ms (0,001 %) | 6 067 ms | tenu |
    | +1,5 % dès le départ | jamais verrouillée | +17 ms (0,0028 %) | 6 017 ms | tenu |

    Il n'y a pas d'à-coup : un pas par image, et une partie 1 à 2 % plus lente. Un écran qui passerait de 60 à 59 Hz
    (1,7 %) en cours de partie, ou un écran VRR, pourrait le faire (non essayé). Question 3.
14. **`pump` et l'horloge** : 31 lectures de `now()` pour 10 tâches (4.3). Dans le navigateur, le coût et la
    granularité de `performance.now()` restent à mesurer.
15. **`track` n'interpole qu'un angle**, le lacet : la rotation des débris n'est pas couverte (point 8).

## 7. Questions ouvertes

### 7.1 Questions, chacune avec une recommandation

Les cinq premières sont celles du §10 de la mission, dans son ordre (la section 4.1 renvoie à la question 3).

1. **Deux estimations de la période d'affichage.** `frameGate` prend la médiane de 30 intervalles rAF bruts ; FLoop, la
   moyenne de 30 intervalles normalisés, sur les seules images présentées. L'arbitrage « RCPU-08, RGPU-09, LOOP-12,
   RGPU-02, LOOP-09 » demande une seule période, estimée une fois et partagée.
   *Recommandation* : `frameGate` reste la seule estimation de l'écran (`refreshHz`, `effectiveHz`), lue par le
   limiteur, `cadenceHint`, le futur gouverneur et le déclenchement de `resetPeriod()` (point 5). `loop.period`
   n'estime pas l'écran : c'est la période des images présentées, interne au pas et au budget de FSchedule (point 10).
   Les deux ne mesurent pas la même chose (intervalles bruts, images présentées) : ne pas brancher l'une sur l'autre.
   À confirmer avec le lot du gouverneur.
2. **Pas à 120 Hz automatique** quand la période est sous 10 ms.
   *Recommandation* : non. Il casse « une seule empreinte quel que soit l'écran », dont le banc et la démo ont besoin.
   Une option explicite, désactivée par défaut (`FLoop.create({hz:120})` existe). Le prix est la latence sur écran
   rapide (limite 4 : jusqu'à 20,8 ms à 144 Hz). Le lot 07 propose « activé », le lot 13 et la proposition de STAB-06
   « désactivé » (7.2). À trancher par David.
3. **Critère des 10 minutes.** Il est appliqué hors verrouillage (|dette| < 1 pas, 6,26 ms au pire) ; en verrouillage,
   la dilatation est bornée et comptée (−0,0944 % à 59,94 Hz). Fait nouveau : l'hystérésis laisse la dilatation aller
   jusqu'à 2 % si la période glisse après le verrouillage (limite 13).
   *Recommandation* : confirmer le critère tel quel, et lire l'invariant 3 comme « au plus un pas plus 2 % du temps
   réel » (le seuil de sortie), sans toucher aux constantes (règle 10 de la mission). Si 2 % paraît trop, le raccord
   peut appeler `resetPeriod()` quand `stats.dilationMs` croît de plus de 1 % du temps réel sur quelques secondes.
   À confirmer.
4. **Balles ennemies, éclats et particules sans `id`.**
   *Recommandation* : `track` avec l'objet pour clé (point 9) : interpolation exacte, sans changement de format, sans
   rien écrire dans `sim.state`, après un test du raccord qui vérifie que les objets restent les mêmes d'un pas à
   l'autre. L'extrapolation arrière en repli. Des `id` (lot 12) ne sont pas nécessaires pour le rendu.
5. **Écho d'arme (PARA-V2) et regroupement des événements après rattrapage** (lot 07 T2).
   *Recommandation* : brancher d'abord avec `events()` à chaque pas et l'écho tel quel (points 7 et 14), pour que le
   banc d'empreintes juge la boucle seule. Ensuite, T2 : `input.weapon` seulement sur l'image d'un geste, et `events()`
   une fois après `advance`, le rappel rendant `false` après un pas qui a émis `shopOpen`, `win` ou `dead`. Le rappel
   de FLoop tient alors le rôle de `stepFrame` pour le découpage en pas.
6. **Tâches sans clé dans FSchedule.** `cancel()`, `has()` et `flush()`, appelés avec une clé indéfinie, visent les
   tâches sans clé, et `cancel()` les retire toutes (2.9).
   *Recommandation* : garder le code normatif ; au raccord, donner une clé à toute tâche (`'save'`,
   `'pcm:'+nom+':'+variante`) et ne jamais passer une clé qui peut être indéfinie.
7. **`capMs` non validé** (2.10) : un `capMs` NaN donne un budget NaN, que `pump` traite comme nul.
   *Recommandation* : laisser ainsi ; le jeu passe des constantes (4, ou 12 pendant le chargement, point 12).
8. **Sortie du piège du sous-multiple.** FLoop devrait-il en sortir seul ?
   *Recommandation* : non, le module ne change pas (règle 10) ; le `resetPeriod()` du point 5 couvre les deux cas
   calculés. Un changement d'écran que `effectiveHz` ne voit pas laisserait la boucle juste mais non verrouillée : à
   observer sur de vrais écrans.
9. **Quelle cadence « 60 » sur un écran 144 ou 165 Hz ?** `frameGate` arrondit le saut d'images : 72 i/s sur 144 Hz,
   55 i/s sur 165 Hz. Aucune des deux ne verrouille, et 48 i/s sur 144 Hz (une image sur 3) ne verrouillerait pas non
   plus (1,25 pas par image). « 60 constant », au sens strict, n'existe que sur les écrans 60, 120 et 240 Hz.
   *Recommandation* : garder `frameGate` tel quel. La cadence est constante (décision 2 de David du 12 novembre :
   « tant que c'est constant »), et l'interpolation garde le mouvement fluide. À confirmer par David.

### 7.2 Écarts relevés

Il n'y a pas de `.relais/RESULTAT.md` dans ce clone : les écarts sont rangés ici. D'abord ceux du §10 de la mission,
puis ceux des notes d'étape (`preuves/module-boucle/`), puis ceux de cette étape.

**Du §10 de la mission.**
- Lot 07, chemins des bancs : la fiche cite `bancs/loop/cadence.mjs` (T1) et `bancs/sched.mjs` (T8). Les vrais
  fichiers sont `bancs/stab/cadence.mjs` et `bancs/stab/sched.mjs`.
- Lot 07 T1, « dilatation ≤ 0,33 ms » : 0,33 ms est la dérive d'horloge du prototype, pas la dilatation du
  verrouillage (−566,65 ms sur 10 minutes à 59,94 Hz, voulus et comptés, 4.1).
- Lot 07 T8, `create({now})` : `now` est facultatif ici ; seule `pump` en a besoin (2.9).
- Lot 07 T8 et STAB-07, « flush (compté saccade) » : ici, seulement `stats.flushes` ; le reste revient à
  l'enregistreur STAB-08.
- STAB-06 proposait `advance` → `workBudget`, `reset(now)` et `setLimit` : ici, `FSchedule.budget`, un `reset()` sans
  argument, et pas de limiteur (LOOP-09, déjà dans `src/options.js`).
- REPRISE : ses noms de tests (`checks/loop.test.mjs`, `checks/schedule.test.mjs`) diffèrent des nôtres
  (`checks/floop.test.mjs`, `checks/fschedule.test.mjs`).

**Des notes d'étape.**
- Étape 0 : les 8 rouges de `checks/campaign-world.test.mjs` ne tiennent pas qu'à l'architecture. Le Mac (macOS
  arm64) et le Spark (Linux arm64) donnent des condensés différents l'un de l'autre, sous la même version de Node
  (`etat-initial.md`) ; la mission les dit verts sous Linux x64. Des condensés régénérés sur une machine resteraient
  rouges sur l'autre : à signaler au lot « 01 suite ».
- Étape 0 : la mission attend `?? .relais/` dans `git status --short`. Il n'y a pas de `.relais/` dans ce clone, et le
  statut est vide.
- Étapes 1 à 3 : les tests du relais gardaient les valeurs du §6, mais certaines vérifications étaient plus faibles que
  sa lettre. T-F22 ne regardait que la dernière image (le même objet `frame` poussé 1 700 fois), T-F18 laissait passer
  un mutant, S10 ne vérifiait que la clé, S18 que le dernier argument. Ils sont renforcés sans changer aucune valeur
  attendue (2.7, 2.12).
- Étape 3 : STAB-07 estimait l'ordonnanceur à « environ 1,5 Ko » ; le code normatif fait 4 221 octets.
- Étape 5 : la liste `cpu[]` du §7.3 s'appelle `cpuRatios`, la clé `cpu` étant déjà le modèle du processeur, dans
  l'en-tête de chaque JSON (§7).
- Étape 6 : la commande Chrome du §7.6 est adaptée au Mac (binaire de Google Chrome, `--no-default-browser-check`,
  profil temporaire hors dépôt) ; sur le Spark, `google-chrome`.

**De cette étape.**
- Lot 07 T1 et proposition de STAB-06, « dette résorbée à 10 %/image bornée ±2 ms » : dans le code normatif, 2 ms est
  la part de la dette prise en compte par image avant le facteur de 10 % (`debtCap`). Le remboursement est donc d'au
  plus 0,2 ms par image, et c'est la dette elle-même qui est bornée, à un pas (16,667 ms ; 6,26 ms au pire mesuré).
- Lot 08b T3 (« pas fixe NON imposé (STAB-06 : pas variable borné + accumulateur) »), lot 13 T10 et T11 (pas fixe
  réservé au banc et au rejeu ; démo affichée au dt de l'image) et la proposition de DEMO-V3 suivent l'ancien
  arbitrage, en faveur du pas variable. La décision du MASTER-PROMPT §6 le remplace : le pas fixe vaut aussi en jeu, et
  la démo affichée, jouée par la boucle normale, est fluide grâce à l'interpolation (2.6).
- Lot 17 T3 suppose un dt variable (« 1 à 3 pas par image ») pour son accumulateur interne à 1/120 s. Avec FLoop,
  `sim.step` reçoit toujours 1/60 s, donc exactement deux pas de physique par pas.
- Pas à 120 Hz : le lot 07 (« Décisions à confirmer par David ») le propose « activé » par défaut ; le lot 13 (« Options
  désactivées par défaut ») et la proposition de STAB-06 le veulent désactivé. La mission recommande désactivé
  (question 2).
- Points du §7.7 précisés au plan, sans contredire la mission :
  - point 3 : une ligne dans `setMode` couvre les quatre cas, et le retour d'onglet passe par la pause ;
  - point 5 : `resetPeriod()` dans l'écouteur de l'option ne suffit pas (calcul) ;
  - point 6 : `firePressed` et `fireLeftPressed` sont déjà verrouillés depuis le lot 01 T2 ;
  - point 8 : `FActors.build` et `FEffects.build` lisent l'état directement ;
  - point 9 : les particules non plus n'ont pas d'`id` ;
  - points 10 et 12 : en mode « loading », `frame()` sort avant le dessin ;
  - point 11 : `saveCheckpoint()` est aussi appelé hors de l'image ;
  - point 16 : deux tests de `input.test.mjs` échouent tels quels (calcul).
- Les constats citent les lignes de la 0.8.0. La formule des pas est en `game.js:690` dans STAB-06, en `:802` sur la
  base ; `stringify` et `setItem` en `game.js:100` dans STAB-07, en `:171` ; le lot de 2 effets en `audio.js:302`, en
  `:311` ; le report « en l'air » en `game.js:96` dans l'arbitrage, en `:167`.
- Réserve 3 de STAB-06, « un tir attend jusqu'à 16,7 ms » : le calcul donne jusqu'à 20,8 ms à 144 Hz, et 27,8 ms à
  72 i/s (limite 4).
- Invariant 3 du §4.6 (« |dilatation| ≤ un pas + 1 % du temps réel ») : vrai sur les 21 motifs, mais pas garanti par
  l'algorithme, dont l'hystérésis garde le verrou jusqu'à 2 % (limite 13, question 3).
- La preuve du lot 07 T8 (plus longue tâche de pré-synthèse sous 32 ms) est faite à l'étape 8 (4.6), sans rien
  brancher.

**De l'étape 8** (banc audio, 4.6).
- Lot 07 T8, preuve exigée : « plusLongueTacheMs ≤ 32 ms (vs 66-86 ms actuel) ». Avec FSchedule, la tâche la plus
  longue fait 8,4 à 9,3 ms au calme sur le Mac M5, et jusqu'à 20,6 ms sous charge. « 66-86 ms actuel » ne se
  reproduit pas : les lots actuels font 18,0 à 21,1 ms au calme, et 22,8 à 42,0 ms sous charge.
- §7.8 de la mission : 3 répétitions. Le banc en fait 5, en alternant A et B, pour suivre la règle du chantier (au
  moins cinq répétitions, appariées et alternées) ; les trois premières sont celles de la fiche.
- §7.8 de la mission, repère « A fait 17 tranches, la plus longue de 24 à 28 ms ; B fait 21 à 22 tranches, la plus
  longue de 11 ms » (Mac, main 0.8.1). Ce sont les chiffres du même Mac sous charge. Au calme : 18,0 à 21,1 ms pour A
  ; 17 à 20 tranches et 9,7 à 11,4 ms pour B.
- STAB-07 (52 à 86 ms, puis 28 à 32 ms avec le prototype) et LOAD-13 (lots de 110 à 177 ms, 559 à 764 ms au total)
  ont mesuré la 0.8.0, sur une autre machine. LOAD-13 l'a fait de plus sous `node:vm` (`bancs/load/music.mjs`, lignes
  11 et 12), à l'horloge murale. LOAD-13 donne `break:metal` comme l'effet le plus lourd ; ici, c'est `break:glass`
  (8,4 ms par variante, contre 7,7 ms), comme le dit STAB-07 (« un seul tampon, break:glass »).
- Plan de raccord, point 12 : l'estimation « plus d'une seconde de chargement en plus à 60 Hz » avec un plafond de
  4 ms partait des totaux de LOAD-13. Mesuré : 17 à 20 pompes, soit 0,28 à 0,33 s à 60 Hz ; et 7 pompes avec un
  plafond de 12 ms (5.12).
- Sur le Spark, l'horloge du fil (`process.threadCpuUsage()`) avance par pas de 1 ms : ses durées sont arrondies.
