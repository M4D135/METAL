# Module « boucle » — FLoop (pas fixe) et FSchedule (ordonnanceur)

Modules génériques du moteur FERRO, livrés par la voie « boucle ». Rien n'est branché dans le jeu :
le raccord est décrit en section 5, non appliqué. Base : `71eca61` (branche `chantier/module-boucle`).

## 1. Rôle et périmètre

(à compléter à l'étape 7)

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
audio sur la 0.8.0) a seulement été lu : rien n'en est repris.

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

(à compléter à l'étape 7)

## 4. Mesures

Les bancs chargent les modules dans le domaine principal de Node (`loadRealm({root, modules, realm: 'main'})`),
jamais sous `node:vm`, qui ralentit le code de 4,5 à 9 fois (MASTER-PROMPT §4). Chaque JSON de
`preuves/module-boucle/` commence par `schema`, `node`, `arch`, `platform`, `cpu` et `loadavg` : la machine et sa
charge au moment de la mesure. La simulation réelle, les coûts, l'assemblage et le navigateur viennent aux étapes 5
et 6 ; l'émulation de l'étape 2 (`aim` et `track` sur la vraie simulation) est résumée en 2.5 et 2.6.

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
   (calcul, non mesuré ici). Le coût et l'empreinte sur la vraie simulation sont mesurés à l'étape 5
   (`banc-simulation.json`).

Ce banc ne mesure que l'horloge, sur des horodatages synthétiques. Un vrai écran à 59,94 Hz, le VRR et les
horodatages de Safari et de Firefox restent à essayer.

## 5. Plan de raccord, non appliqué

(à compléter à l'étape 7)

## 6. Limites connues

(à compléter à l'étape 7)

## 7. Questions ouvertes

(à compléter à l'étape 7)
