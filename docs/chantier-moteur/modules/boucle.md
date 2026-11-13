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
FLoop.aim(yaw, pitch, lookX, lookY, min = -Infinity, max = Infinity, out = {}) → out     (étape 2)
FLoop.track({snap = 2})           → traqueur                                             (étape 2)
```

**Unités et repères** (alignés sur METAL) :

| Grandeur | Unité, repère | Remarque |
|---|---|---|
| `now` d'`advance` et d'`observe` | ms, horloge de rAF (`performance.now()`) | jamais lue par le module |
| `h` passé au rappel de pas, `loop.step` | secondes, `1/hz` | `1/60 === STEP_SECONDS` de `tools/proof/scenarios.mjs` ; c'est le `dt` de `sim.step(dt,input)` |
| `loop.stepMs`, `frame.raw`, `frame.dt`, `frame.dropped`, `period`, `acc`, `debt`, les `stats.*Ms` | ms | `stepMs = 1000/hz` |
| `frame.alpha` | 0 à 1 | part du pas suivant déjà écoulée ; rendu = avant + (après − avant) × alpha |

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

### 2.5 Tests et outil de motifs de FLoop

- `checks/floop.test.mjs` : T-F01 à T-F25 et T-F28 (26 tests), `node --test checks/floop.test.mjs`, environ 7 s
  sur le Mac M5. Le module est chargé par `node:vm`, comme dans `checks/options.test.mjs` : les erreurs sont
  comparées par leur nom, les objets du module par JSON. Ce fichier n'entre dans `npm test` qu'au raccord
  (`package.json` n'est pas modifié). T-F26 (`aim`) et T-F27 (`track`) viennent à l'étape 2.
- `tools/boucle-motifs.mjs` : l'annexe A de la mission, recopiée telle quelle (sha256 `91608081942e…`) : les
  21 motifs d'horodatage synthétiques (`FRAMES`, environ 10 minutes chacun), `pattern(nom)`, `runPattern(FLoop, nom)`,
  la table `REFERENCE` avec `TOLERANCE`, et `compare`. T-F28 vérifie les 21 motifs contre la table.
- Renforcements par rapport au §6.2 de la mission, sans changer aucune valeur attendue :
  - T-F12 vérifie aussi l'invariant 4 image par image sur les 21 motifs ;
  - T-F18 vérifie qu'`observe(NaN)` laisse `period`, `locked`, `acc`, `debt` et `stats` inchangés, et garde la
    référence d'horodatage (l'image suivante mesure une période, `raw` ≈ 16,667 ms) ;
  - T-F19 vérifie que la boucle est verrouillée avant `reset()` ;
  - T-F22 copie `steps` et `locked` image par image dans la descente 144 → 60 Hz : la première version poussait
    1 700 fois le même objet `frame`, et ne vérifiait donc que la dernière image.

*(`FLoop.aim` et `FLoop.track` sont déjà dans `src/loop.js`, qui suit le code normatif ; leur documentation
et leurs tests (T-F26, T-F27) viennent à l'étape 2. FSchedule vient à l'étape 3.)*

## 3. Algorithme

(à compléter à l'étape 7)

## 4. Mesures

(à compléter aux étapes 4 à 6)

## 5. Plan de raccord, non appliqué

(à compléter à l'étape 7)

## 6. Limites connues

(à compléter à l'étape 7)

## 7. Questions ouvertes

(à compléter à l'étape 7)
