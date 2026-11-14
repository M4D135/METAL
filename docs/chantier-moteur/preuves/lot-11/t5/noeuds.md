# Lot 11 — T5 : compteur de nœuds par seconde (preuve exigée de la fiche)

## Ce que demandait la fiche, ce qui a été fait

La fiche (`.relais/audit/lots/lot-11.md`, T5, « Quoi » et « Preuve exigée ») demande pour
RESTE-09 : « dans `FMusic.create`, 2 GainNode persistants par piste alternés pour le fondu
8 ms ; seul l'AudioBufferSourceNode est créé par note → **15 nœuds/s au lieu de 30** » et
« **Compteur nœuds/s ≤ 15** ».

Ce point — le **point (1)** du constat — **n'est pas implémenté**. Le commit `982418a` et la
première version de ce rapport l'ont présenté sous un autre critère, « la fiche attendait
−21 % et demandait d'abandonner sous −10,5 % » : **ce critère n'existe ni dans la fiche, ni
dans le constat RESTE-09**. Il est retiré ici et remplacé par la décision réelle.

## Pourquoi le point (1) est écarté

`docs/chantier-moteur/constats/RESTE.md`, § RESTE-09, rubrique **Contre-vérification** :

> « Le point (1), GainNode persistants alternés, **est à écarter** : 30 nœuds par seconde
> sont insignifiants pour Web Audio, et réutiliser un gain qui porte encore des automations
> planifiées (`setTargetAtTime` à `time`, arrêt à `time+0,008`, effet 12 sur `t.voice.gain`)
> peut produire des clics, ce qui est une perte de qualité possible. Garder (2), (3), (4) et
> LOOP-14. »

La règle du chantier (« sans aucune perte de qualité ni de résolution ») interdit donc le
point (1) : le gain attendu est nul côté JS (le constat le dit lui-même : « Aucun gain JS
mesurable ») et le risque est audible. Les points (2) `voices` sans copie par image,
(3) `schedule` sur quatre enregistrements préalloués et (4) `prepare()` hors jeu sont, eux,
appliqués par `982418a` et mesurés dans `alloc.json`.

La fiche elle-même classe d'ailleurs ce point dans ses garde-fous : « NON contre-vérifié :
valider par écoute Chrome avant clôture » — écoute impossible sur cette machine.

## Le compteur, mesuré

`node docs/chantier-moteur/preuves/lot-11/t2/audio-root.mjs <racine>` — 3600 images à 60 i/s
de la séquence réelle de `game.js:702` (`setThreat`, `setPressure`, `setSteam`,
`setMachinery`, `tick`), musique du monde 0 jouée, contexte Web Audio factice comptant les
nœuds. Rejoué au tour 1 des correctifs, tête `chantier/lot-11-audio` contre base `35c654a` :

| arbre | appels AudioParam par image | **nœuds créés par seconde** | détail des nœuds sur 60 s | tampons créés en jeu |
|---|---|---|---|---|
| base `35c654a` | 34,2 | **29,9** | `{"gain":898,"source":898}` | 5 |
| tête (tour 1) | **2,6** | **29,9** | `{"gain":898,"source":898}` | 5 |

Le compteur est donc **inchangé par le lot** : 898 `AudioBufferSourceNode` + 898 `GainNode`
pour 898 notes en 60 s, soit **2 nœuds par note**, conformément au `note()` de
`src/music.js:382` (`ctx.createBufferSource(), ctx.createGain()`). Le critère « ≤ 15 nœuds/s »
de la fiche n'est pas atteint et ne l'est pas volontairement.

Ce que le lot a effectivement descendu, c'est le nombre d'**automatisations par image**
(34,2 → 2,6, T2) et les **allocations par image** de `FMusic.tick` (voir `alloc.json` :
1,321 → 1,027 Mo/min en monde 0, 2,450 → 2,017 en monde 1, 3,121 → 2,579 au titre).

## Preuve de non-régression

`checks/music.test.mjs`, test « sixty seconds of music create exactly two nodes per note » :
60 s de `tick()` sur le monde 0, et le compte des nœuds créés pendant le jeu est comparé à
`stats.scheduledNotes` — exactement un `source` et un `gain` par note, aucun autre nœud.
Le test échoue si quelqu'un réintroduit un nœud par note (ou « optimise » en réutilisant un
`GainNode` partagé, ce que la contre-vérification de RESTE-09 écarte).
