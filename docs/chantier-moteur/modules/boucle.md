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

*(FSchedule vient à l'étape 3.)*

## 3. Algorithme

(à compléter à l'étape 7)

## 4. Mesures

(à compléter aux étapes 4 à 6 ; l'émulation de l'étape 2, `aim` et `track` sur la vraie simulation, est
résumée en 2.5 et 2.6)

## 5. Plan de raccord, non appliqué

(à compléter à l'étape 7)

## 6. Limites connues

(à compléter à l'étape 7)

## 7. Questions ouvertes

(à compléter à l'étape 7)
