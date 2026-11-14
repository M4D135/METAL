# Au-delà 1 — le pas de simulation des machines, mesuré avant de toucher au code

Le lot fait passer un secteur de 3 à 30-42 machines. Avant d'optimiser quoi que ce
soit, on mesure où va ce surcoût, puis on ne garde que ce qui tombe sous le
profil. Deux pistes ont été instruites : le pas de simulation (les machines) et la
génération (la brique `FPassages`, ajoutée par ce lot).

## Ce qui a été mesuré d'abord

### Le pas de simulation

`banc-pas.mjs` (12 scénarios de preuve × 3 passes × 1 800 pas = 21 600 pas,
`--cpu-prof`), résumé par `profil-pas-avant.txt` :

| Fonction | Temps propre |
| --- | --- |
| `updateEnemies` | 5,4 % |
| ramasse-miettes | 5,7 % |
| `updateEnvironment` | **5,1 %** |
| `create` (world.js, hors banc) | 5,1 % |
| `rebuild` | 4,1 % |
| `updateDebris` | 3,8 % |
| `trapPose` | **3,1 %** |

La part imputable aux machines est donc de l'ordre de **8 % du pas** :
`updateEnvironment` (5,1 %, requête spatiale comprise) plus `trapPose` (3,1 %).
C'est le plafond de ce que n'importe quelle optimisation des pièges peut rendre.

### La génération

`banc-generation.mjs` + `--cpu-prof` sur 360 mondes (23,9 s de CPU) ne montre
aucune trace de `FPassages` dans les fonctions de tête : la génération est dominée
par `demolitionMetadata` (19,5 %), `create` (12,6 %), le ramasse-miettes (8,7 %) et
`bbox` (7,6 %) — tout cela vient du lot précédent, pas de celui-ci
(`profil-generation.txt`).

Pour ne pas se fier au seul profil, `part-passages.mjs` enrobe les deux points
d'entrée réellement appelés par `world.js` (`mandatoryLinks`, `tourLinks`) et
chronomètre 360 mondes sur 3 passes :

```
génération totale    360 mondes   29029 ms
liens publics englobants           103 ms   0,35 %
```

**`FPassages` coûte 0,35 % de la génération.** Il n'y a rien à y gagner qui soit
mesurable : la piste est écartée, `src/passages.js` n'est pas touché.

## Ce qui a été fait

`src/simulation.js`, dans `updateEnvironment`, deux choses, toutes deux sans
changement d'état observable :

1. **La requête spatiale n'est plus due qu'en course.** Une lame ou une presse ne
   peut rencontrer un corps que pendant son mouvement : à l'arrêt, `trapPose` ne
   pousse aucun contact (le signe du déplacement est nul) et personne ne lit la
   liste d'acteurs. Elle n'est donc appelée que si `hot || warning`, contre à
   chaque pas auparavant. Les pics gardent leur requête à chaque pas : eux se
   déclenchent à l'approche, c'est leur règle.
2. **La boîte de repos n'est plus recalculée ni reallocuée.** Tant qu'une pièce
   périodique reste au repos (`progress === 0` déjà atteint, `t.box` en place), sa
   géométrie est identique à celle du pas précédent : on réutilise l'objet au lieu
   de refaire `trapShape` + `trapPose`. Le premier pas qui suit la fin d'une course
   recalcule, comme avant.

Avec 30 à 42 machines par secteur et des cycles de 7 à 15 s dont 1,7 s en course,
ces deux branches sont prises la plupart des pas.

## Ce qui a été mesuré après

A/B apparié `tools/ab2.mjs`, `A = .relais/avant-t5` (commit `afcabea`, sans
l'optimisation), `B = l'arbre de travail`, mêmes mondes, mêmes scénarios :

| Scénario | Run 1 (5 reps, 9 000 paires) | Run 2 (7 reps, 12 600 paires) |
| --- | --- | --- |
| `legacy-s0` | −4,5 % | −2,5 % |
| `legacy-s2` | −10,3 % | −7,8 % |
| `campaign-w10` | −7,1 % | −2,3 % |
| `campaign-w16` | −5,3 % | −4,6 % |

`identical: true` sur les deux runs : les empreintes d'état des quatre scénarios
sont **strictement identiques** avant et après. Le gain est positif dans les huit
mesures, entre **2,3 % et 10,3 %** selon le scénario et le run — pas partout au
dessus de 5 %.

Dit honnêtement : la moyenne (`meanUs`) est inutilisable ici, elle est dominée par
des pics de ramasse-miettes et de noyau (`maxUs` jusqu'à 62 ms pour un pas de
200 µs). Le chiffre retenu est le **ratio de médiane apparié**
(`medianPairedRatio`), qui compare pas à pas les deux arbres. Un gain de 2 à 10 %
sur une fonction qui valait 8 % du pas est ce que la piste pouvait donner ; elle
est gardée pour ça, pas pour un chiffre.

Pour situer l'effort : le même banc contre la base du lot (`.relais/avant-t2`,
3 machines par secteur) donnait **+14 % à +36 %** de coût de pas après la
densification. Cette optimisation en rend une partie, pas la totalité.

## Ce qui n'a pas été fait, et pourquoi

- **`FPassages`** : 0,35 % de la génération, hors de portée du seuil.
- **`updateEnemies`, `rebuild`, `updateDebris`, le ramasse-miettes** : plus chers
  que les pièges, mais étrangers à ce lot. Les toucher ici, ce serait attribuer au
  lot « jeu-pieges-massifs » un travail qui appartient au chantier du moteur, et
  le brief demande des preuves pour ce lot.
- **Réutiliser les objets de boîte en place** (muter `t.box` au lieu d'en créer un
  neuf) : le gain serait plus net, mais `t.box` est lu hors de `updateEnvironment`
  (collision, rendu, bancs). Un objet partagé et muté est exactement le genre de
  défaut qui passe tous les bancs et casse sur appareil réel. Écarté.

## Comment reproduire

```
node docs/chantier-moteur/preuves/jeu-pieges-massifs/au-dela-1-pas-de-pieges/banc-pas.mjs . --steps 1800 --reps 3
node docs/chantier-moteur/preuves/jeu-pieges-massifs/au-dela-1-pas-de-pieges/banc-generation.mjs . --reps 3
node docs/chantier-moteur/preuves/jeu-pieges-massifs/au-dela-1-pas-de-pieges/part-passages.mjs . --reps 3
node tools/ab2.mjs .relais/avant-t5 . --scenario all --steps 1800 --reps 7 --warmups 1 --out .relais/ab-t5c.json
```

Les profils `--cpu-prof` sont résumés par
`../../jeu-bouclier-supprime/au-dela-1-generation/resumer-profil.mjs` ; les
`.cpuprofile` sont ignorés par Git, les résumés texte sont dans ce dossier.

## Rectification des bancs de génération — 14 novembre, Codex

Les chiffres historiques ci-dessus sont conservés, mais les options `variant`, `width`
et `height` utilisées par les deux scripts étaient ignorées : leurs « campagnes »
étaient des mondes classiques. Ces chiffres ne prouvaient donc pas le coût en campagne.
Les scripts appellent désormais le mode `campaign` avec le bon indice en deuxième
argument, pour 54 mondes V1, 54 V2 et 12 classiques par passe ; ils vérifient le mode,
la version et l’indice effectivement produits. `part-passages` mesure les deux entrées
publiques réellement appelées, sans additionner des temps internes imbriqués.

Une passe corrigée sur le Spark partagé : 120 mondes, 9 654 ms de génération,
`tourLinks` 56 ms et `mandatoryLinks` 3 ms, soit 0,61 % ensemble. C’est un contrôle
fonctionnel et une mesure indicative unique, pas une nouvelle preuve de gain apparié.
