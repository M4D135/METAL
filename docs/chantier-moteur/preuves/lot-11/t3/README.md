# Lot 11 — T3 : table de recettes d'armes façon Doom (FEEL-06, MIX-01, MIX-06)

Le code (générateur paramétrique `layered` dans `FAudio`, `src/audio-recipes.js`, raccord
`build.py` + `game.js`) venait du wip de l'équipe Claude `4296a73`, ni testé ni prouvé.
Il est **vérifié, mesuré et complété ici** ; la correction du banc MIX (ancre de crochet
déplacée de `synthesize` sur `synthJob` après le T1) est de ce commit.

## 1. Recette intégrée mesurée — `feel06.mjs`, `feel06.json`

`node docs/chantier-moteur/preuves/lot-11/t3/feel06.mjs . --out …/feel06.json`
(domaine principal de Node, `tools/realm-loader.mjs`). Énergie **absolue** de la bande
120–500 Hz, crête normalisée à 0,84 des deux côtés donc RMS comparés à crête égale.

| arme | durée (plafond) | E(120–500 Hz) v0.2 → METAL | écart | RMS à crête égale | part < 120 Hz | prototype d'audit |
|---|---|---|---|---|---|---|
| pistolet | 0,34 (< 0,36) | 13,35 → 18,34 dB | **+4,99** | **+6,44 dB** | 3,18 → 25,56 % (×8,0) | identique (2 variantes) |
| SMG | 0,24 (< 0,26) | 9,77 → 17,73 dB | **+7,96** | **+7,98 dB** | 1,94 → 22,38 % (×11,5) | identique (2 variantes) |
| pompe | 0,92 (< 0,95) | 12,39 → 23,82 dB | **+11,43** | **+7,60 dB** | 8,49 → 21,49 % (×2,5) | identique (2 variantes) |
| roquette | 0,80 (< 0,82) | 13,74 → 25,96 dB | **+12,22** | **+6,47 dB** | 1,49 → 28,91 % (×19,4) | diffère (fondu 40 ms ajouté) |
| grenade | 0,52 (< 0,55) | 12,19 → 24,40 dB | **+12,21** | **+9,86 dB** | 44,92 → 42,20 % (×0,94) | hors prototype |

Forme, sur les deux variantes de chaque arme (`feel06.json`, `shape`) : crête 0,84,
|dc| ≤ 0,0022, queue ≤ 0,0024 (règle < 0,04), variantes différentes, reproductibles.

Écarts assumés avec la fiche :

- **pistolet +4,99 dB** : la fiche annonce une plage « +4,9 à +12,2 dB » (donc +4,9
  accepté) alors que la décision par défaut de David dit « ≥ +5 dB ». Mesure rendue à
  +4,99 : intégrée, **à confirmer par David** (rapport, décisions).
- **pompe ×2,5** sous 120 Hz, hors de la plage « ×7 à ×20 » : elle partait déjà de 8,5 %
  et monte de +16 dB d'énergie absolue sous 120 Hz. Le critère en ratio n'est pas
  applicable ; lire l'énergie absolue.
- **grenade ×0,94** : la v0.2 est déjà à 44,9 % sous 120 Hz, le ratio n'a pas de sens.
  La recette d'hypothèse (520 ms, thump 110→45 Hz) est appliquée, décision 3 de la fiche.
- **roquette** : le prototype d'audit avait une queue de 0,047 (hors règle 0,04). Corrigé
  côté recette (fondu final de 40 ms), pas côté règle — d'où l'empreinte différente du
  prototype. Pistolet, SMG et pompe sont **au bit près** identiques au prototype.

## 2. Chaîne complète, Chrome sans interface (OfflineAudioContext, 48 kHz)

`run-linux.py` est l'équivalent Linux de `bancs/mix/run.py` (qui pointe sur le binaire
macOS) — MASTER-PROMPT §5. Scènes enregistrées au T0 et réutilisées telles quelles.

`matrix-t3.json` — `mix.html?job=matrix&scenes=a,b,c,d&recipes=cur,metal&comps=cur&ducks=cur` :

| scène | crête sortie cur → metal | échantillons > 0,875 | épisodes d'écrêtage | voix volées | SMG p10 au-dessus de la musique |
|---|---|---|---|---|---|
| a | 0,392 → 0,424 | 0 → 0 | 0 → 0 | 0 → 0 | 5,80 → **11,98 dB** |
| b | 0,560 → 0,550 | 0 → 0 | 0 → 0 | 0 → 0 | — |
| c | 0,673 → 0,623 | 0 → 0 | 0 → 0 | 0 → 0 | — |
| d | 0,544 → 0,599 | 0 → 0 | 0 → 0 | 0 → 0 | 5,24 → **10,48 dB** |

`iso-t3.json` — `job=iso&recipes=cur,metal&comps=cur` : réduction de gain subie par un tir
isolé, la pire est la pompe à **−1,43 dB** (critère ≤ 1,5 dB), toutes les autres entre
−0,39 et −0,97 dB. Aucun échantillon au-dessus de 0,875, crête maximale 0,465.
Durées jouées : SMG 244 ms, pistolet 345, pompe 934, roquette 812, grenade 528.

`matrix3-t3.json` — contrôle du banc lui-même : `recipes=cur,doom,metal` sur les scènes a
et d. `doom` et `metal` rendent **identiques** et diffèrent bien de `cur`. Sans la
correction d'ancre, `doom` rendait silencieusement la banque v0.2 (le banc crochetait
`synthesize`, que `warmBank` n'appelle plus depuis le T1).

`calib.json` — rattrapage du compresseur 4,55 dB et retard 288 échantillons, conforme au T0.

## 3. Raccord au jeu et identité — `prep-jeu.json`

`node tools/audio-prep-profile.mjs .relais/ref-base . --reps 7 --game` :

- sans table, la banque reste `33ab837bd0d7…` (celle du T0) ;
- avec la table METAL, **exactement 10 tampons changent** : `pistol#0/#1`, `smg#0/#1`,
  `shotgun#0/#1`, `rocket#0/#1`, `grenade#0/#1` ; banque `acfb02221909…` ;
- `buffersDifferent = 0` et `prepareMatchesDirect` vrai des deux côtés (chemin tronçonné =
  construction directe, dans les deux sens d'énumération) ;
- coût de préparation avec la table (tampons d'armes 1,8 à 2,9 fois plus longs) :
  tranche maximale 24,64 ms, total 362,3 ms, 44 tranches. La recette d'un jeu est opaque,
  elle ne se coupe pas : la tâche la plus lourde est `rocket#1` à 20,8 ms. Tenir 8 ms avec
  la table demande des recettes reprenables côté `FAudio` — noté en « au-delà ».

## 4. WAV d'écoute

Hors dépôt (4 992 044 octets chacun, 48 kHz stéréo 16 bits, scène `p`). Empreintes dans
`wav-sha256.json`. **Aucune écoute réelle n'a pu être faite sur cette machine** :
l'écoute A/B reste à faire par David (voir « vrai matériel »).

## 5. Tests

`checks/audio.test.mjs` : FEEL-06 (plafonds, crête, RMS, dc, queue, variantes,
reproductibilité, règle SMG < roquette, gain 120–500 Hz et RMS par arme), MIX-01 (la table
ne remplace que ses tampons, retombe sur la v0.2 sur sortie invalide, banque sans table
identique bit à bit), MIX-06 (le SMG de 240 ms superpose 2 voix à 8 tirs/s, plafonds
32/40/48 inchangés), et l'audition du jeu qui joue les longueurs METAL (0,24 et 0,34 s)
et aucune tampon v0.2. `npm test` : 512 réussis, 0 échec.
