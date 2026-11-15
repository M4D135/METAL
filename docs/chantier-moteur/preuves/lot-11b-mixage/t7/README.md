# Lot 11b / T7 — La boucle musicale varie par graine (MIX-10, MIX-V3)

Constats : MIX-10 (variation par graine) et MIX-V3 (échange de mesures aux guitares).
Classe : **meilleure**. Ne dépend de rien.

## Ce qui est livré

`src/music.js` : `compose(stage, samples, seed)`. **Sans graine, le module rendu est
octet pour octet celui d'aujourd'hui** — le bloc de variation ne s'exécute pas. Avec une
graine, le premier cycle reste l'arrangement écrit et `VARIATION_CYCLES = 5` cycles
s'ajoutent, chacun construit sur l'ordre écrit :

- **échange de 2 positions parmi 1 à 5** — l'entrée et la chute du morceau restent
  ancrées, c'est le milieu de la boucle qui se réordonne ;
- **batterie par mesure dans la famille** — la caisse du premier temps change de famille
  de mesure en mesure, avec la garde-fou du prototype : jamais sur la rupture ;
- **le 3e canal se tait une fois sur trois** sur sa réponse, jamais sur la rupture
  (motif 3) ;
- **MIX-V3** : une fois sur deux, les motifs 1 à 4 échangent **deux mesures** (blocs de
  16 lignes) sur les **canaux 0 à 2**, ceux des guitares.

Le cache devient `(morceau, graine)` avec **éviction** : un seul module varié par morceau
en mémoire, le module sans graine n'est jamais évincé. `getModule(stage, seed)`,
`getTrack(stage, seed)`, et l'instance suit la graine : `setStage(value, nextSeed)`.
`src/audio.js` : `FAudio.setStage(value, valueSeed)` mémorise la graine et la passe à
`music.setStage`. `src/game.js` : `audio.setStage?.(world.stage, seed)` — la graine est
celle du monde, donc la même partie rejoue la même variation.

## Reproduire

```sh
node docs/chantier-moteur/bancs/mix/musicvar.mjs .            # > musicvar.json
# comparaison « module sans graine identique » contre la racine d'avant
node -e "…deux vm.runInContext, hash des getModule(0|1|2|'title')…"   # > sans-graine.json
```

`musicvar.mjs` était le prototype de l'audit : il patchait une copie de `src/music.js`.
Il détecte maintenant que la variation est intégrée (marqueur `MIX-10`) et mesure la
**source réelle** au lieu de la re-patcher.

## Critères de la fiche

**Boucle ≥ 240 s aux trois tempos**, graine 96 :

| morceau | tempo | positions | boucle | annoncé par l'audit |
|---|---:|---:|---:|---|
| 0 | 100 | 48 | **460,8 s** | 271 à 461 s |
| 1 | 170 | 48 | **271,1 s** | — |
| 2 | 145 | 48 | **317,8 s** | — |

La boucle passe de 76,8 / 45,2 / 53,0 s à 460,8 / 271,1 / 317,8 s, soit **×6**, et retombe
sur la plage annoncée (271 à 461 s) au dixième de seconde près.

**Aucune fenêtre de 4 positions répétée, batterie comprise** : tenu, et au-delà — le banc
ne trouve **aucune** fenêtre répétée de 2, de 4 ni de 8 positions sur les 48, pour aucune
des trois chansons ni des quatre graines testées (1, 7, 96, 2026).

**Module sans graine identique (sha256)** : tenu, `sans-graine.json`, contre la racine
d'avant (`1e854e1`) :

| morceau | sha256 (16 premiers), avant = après |
|---|---|
| 0 | `50d88a07744be3d2` |
| 1 | `c12b06dab600fbc3` |
| 2 | `738adaa5a8460e6f` |
| title | `88dfafde9f335f64` |

`getTrack(stage)` sans graine est aussi inchangé (mêmes titres, tempos et durées).

**Guitares, 6 → 12 à 19 contenus distincts** : **41 à 44 contenus distincts par module
varié** (empreinte des canaux 0 à 2 des 48 positions), **199 à 212 distincts en croisant
huit graines**. Le critère ≥ 12 est dépassé, l'audit sous-estimait la place de l'échange
de mesures.

**Reproductibilité** : la même graine rend le même module (deux appels de suite, et à
travers les huit graines, 8 modules distincts par morceau).

**Coût** : construire un module varié prend **3,1 à 5,8 ms** ; il pèse **235 à 301 Ko**
(garde-fou annoncé : 225 à 300 Ko — le morceau 0 est à 300,9 Ko, à la borne).

## Écarts, dits

1. **Le prototype de l'audit comptait faux sur lui-même.** Son commentaire annonçait
   « 5 cycles de plus (48 positions) » alors que sa boucle poussait 6 positions par cycle.
   L'ordre écrit compte **8** positions, donc un cycle ajoute 8 positions : 5 cycles font
   bien 48 positions, ce qui restaure exactement la plage annoncée. Les 5 cycles de la
   fiche sont donc respectés à la lettre ; c'est le prototype qui déviait.
2. **Taille** : la fiche estimait « +998 + 172 octets ». Mesuré **+3 142 octets**
   (`music.js` +2 765, `audio.js` +371, `game.js` +6). L'estimation ne couvrait que le
   prototype (sans MIX-V3, sans éviction, sans commentaires) ; la part de commentaires de
   décision explique l'essentiel du reste. C'est le plus gros écart de taille du lot.
3. `getTrack(stage, seed)` annonce la durée nominale (48 positions) **sans construire le
   module**, comme le faisait déjà `getTrack(stage)` : la durée annoncée et la durée jouée
   sont vérifiées égales dans le test, mais l'annonce ne lit pas le module.
4. Le module varié est construit **à la demande** au `setStage` (3 à 5 ms), et non par le
   réchauffement LOAD-13, qui continue de réchauffer le module **sans graine**. Un
   réchauffement de la graine courante reste à faire si 5 ms au chargement se remarquent.

## Tests et taille

`node --test checks/music.test.mjs` : 15 → **16 tests, 16 réussis** (la fiche demandait
« 11/11 tests verts », le fichier en compte 16 depuis le lot 11). Le test nouveau vérifie,
pour les trois morceaux : 8 positions sans graine, module changé par la graine, **reproductible
à la graine**, deux graines différentes, ≥ 48 positions, **durée annoncée = durée jouée**,
**≥ 240 s**, **aucune fenêtre de 4 positions répétée**, **≥ 12 contenus de guitare**, et
que la lecture avec graine ne provoque **aucune resynchronisation**.

`npm test` : **535 réussis, 0 échec** (référence de départ 526/526).
`dist/index.html` : 873 014 → **876 156 octets** (+3 142), sha256 conforme à `SIZE.json`.

## Attend du vrai matériel

Le garde-fou de la fiche reste ouvert : « écoute à valider (passages sans 3e canal) ». Les
silences du 3e canal, une fois sur trois, n'ont été jugés qu'en mesure — aucune oreille
humaine n'a entendu une boucle variée en jeu.
