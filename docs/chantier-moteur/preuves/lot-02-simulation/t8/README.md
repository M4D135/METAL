# Lot 02 — T8 : rayons DDA sur les seaux de 8 m (SIM-07)

## Ce qui a été fait
`ray()` et `castProjectile()` (src/simulation.js) ne balayent plus la totalité de
`solids`. Elles parcourent les seaux de collision de 8 m déjà construits (miroir CSR
`mirrorStart`/`mirrorIdx`/`mirrorBox` de T6) par une marche Amanatides-Woo (`rayCells`),
avec estampilles (`solidStamp`/`solidSerial`, chaque boîte testée une fois) et arrêt dès
que l'entrée de la cellule suivante dépasse le meilleur impact. `castProjectile` rassemble
les boîtes des cellules traversées puis les teste dans l'ordre d'origine du tableau
(`castFound.sort((x,y)=>x-y)`) pour préserver le départage des normales. Repli sur le
balayage complet si l'origine est hors grille, si `d[0]`/`d[2]` n'est pas fini, si `far<0`,
ou si `r > bucketRadius` pour `castProjectile`. Boucle des sols déroulée (pas de tableau
`[0,2]` par sol).

## Preuve d'identité
`tools/ab2.mjs` (domaine principal Node, jamais node:vm), comparaison appariée A/B alternée,
A = base `731ace7` (worktree `.relais/avant-t8`), B = branche avec le DDA.
`--scenario legacy-s0,legacy-s2,campaign-w10,campaign-w16 --weapon 2 --steps 1800 --reps 4 --warmups 2`.
Résultat : **`identical=true` sur les 4 scénarios**, `firstDifference=null` partout
(7 200 paires par scénario). L'identité est prouvée au niveau de l'EMPREINTE D'ÉTAT
pas à pas (plus fort qu'une comparaison de sorties de rayon).

Substitution assumée : le banc `ray-equiv.mjs` des fiches compare un prototype écrit contre
METAL 0.8.0 (avant le miroir CSR de T6) ; il ne s'applique plus à l'état courant. La preuve
d'identité est donc faite par `ab2` (empreinte d'état), qui couvre `ray` ET `castProjectile`
dans le déroulement réel de la simulation.

## Gain mesuré (ratio B/A, médian apparié et total)
| scénario | medianPairedRatio | totalRatio |
|---|---|---|
| legacy-s0 | 0.873 | 0.859 (−14 %) |
| legacy-s2 | 0.953 | 0.928 (−7 %) |
| campaign-w10 | 0.858 | 0.839 (−16 %) |
| campaign-w16 | 1.015 | 0.956 (−4 %) |

Gain annoncé fiche : −7 à −12 % en combat roquettes. Reproduit (jusqu'à −16 % sur les
scénarios de combat lourds, jamais sous la moitié de l'annoncé). Machine partagée : les
médianes par pas sont bruitées (contrôle A/A ≈ 1) ; les ratios totaux sont stables.

## Tests
`checks/ray-dda.test.mjs` (6 cas, ajouté au script `npm test`) : murs dans des seaux
distincts (traversée multi-cellules), mur derrière l'origine (aucun impact), mur hors
corridor, rayon vers le sol, origine hors grille (repli balayage complet). Suite complète :
532 tests, 532 passés, 0 échec.

## Fichier
`ab2-identite-gain.json.gz` : résumé compact du rapport `ab2` (environnement, méthode,
par scénario : identical, firstDifference, timing, proofA/proofB, checksum).
