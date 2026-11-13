# Lot 11 — T1 : lots de synthèse bornés en temps (LOAD-13, MIX-09)

## Ce qui est prouvé

`prep-ab.json` — `node tools/audio-prep-profile.mjs .relais/ref-base . --reps 7`
(worktree `.relais/ref-base` = `d7e7bed`, état d'avant ; 7 paires alternées, domaine
principal de Node, jamais `node:vm`).

| Mesure (médiane sur 7 paires) | avant | après |
|---|---|---|
| tranche maximale de `prepare(0)` | 45,19 ms | 17,46 ms (−61 %) |
| tranches au-dessus de 8 ms | 12 | 14 (sur 25 → 37 tranches) |
| nombre de tranches | 25 | 37 |
| total `prepare(0)` | 298,9 ms | 274,8 ms (−8 %) |
| tranche maximale du titre | 17,26 ms | 17,60 ms |

La tranche maximale qui reste est une sous-tâche de `FMusic` (la batterie d'un module,
≈ 13 ms) : les effets, eux, sont coupés à 256 échantillons et tiennent dans le budget.
Le ≤ 8 ms plein suppose le worker de la synthèse (lot 07 T12, MASTER-PROMPT §6 « hors du
fil principal ») ; ici le jeu reste sur le fil principal, sans ordonnanceur concurrent.

Seuil d'abandon du plan (−26 % sur la tranche maximale) : largement dépassé (−61 %).

## Identité (état identique, bit à bit)

`identity` de `prep-ab.json` :

- `sameBankAB: true`, `sameModulesAB: true`, `buffersDifferent: 0` des deux côtés ;
- empreinte de la banque de 64 tampons : `33ab837bd0d7…` avant et après, identique à la
  référence figée au T0 ;
- `prepareMatchesDirect` : banque, module d'étape et module du titre identiques à la
  construction directe, dans les deux sens d'énumération (MIX-09) ;
- `changedVsDefault: 0` : sans table de recettes, la banque reste la v0.2.

## Tests

- `checks/audio.test.mjs` : « effect preparation slices on a time budget instead of an
  effect count and rebuilds the same bank bit for bit (LOAD-13) » — horloge fausse à
  0,05 ms par lecture, banque tronçonnée identique bit à bit à la banque synchrone,
  ≥ 20 tranches, au moins une tranche à plusieurs variantes (le budget commande, pas le
  compte), au moins une tranche à zéro tampon (une synthèse lourde est coupée puis
  reprise) ;
- `checks/audio.test.mjs` : « every effect renders the same bytes whatever the build
  order and the prepared bank is exactly those renders (MIX-09) » ;
- `checks/music.test.mjs` : deux assertions passées de «  _yields ≤ before+2 / before+1_ »
  à l'**égalité exacte** `before+10` et `before+5` (4 sous-tâches par module + la pause
  finale). Changement voulu, aucun relâchement : la borne est plus serrée qu'avant.
- `node --test checks/audio.test.mjs checks/music.test.mjs` : 54/54.
- `npm test` complet : 512 réussis, 0 échec (référence de départ : 506/506).
