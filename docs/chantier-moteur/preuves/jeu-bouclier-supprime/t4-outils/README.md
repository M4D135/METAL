# T4 — Outils de mesure et documentation alignés sur le retrait

## Outils corrigés

| Outil | Ce qui a changé |
| --- | --- |
| `tools/campaign-profiles.mjs` | entrée `{…shield…}` supprimée de l’inventaire d’entrée ; la clé `'shield'` retirée de la table des acquisitions (le palier d’index 3 disparaît, `slice(1)` reste correct) ; note `heavyCounts` : les attaques explosives sont conditionnées à la possession d’une arme lourde, plus au bouclier |
| `tools/campaign-balance.mjs` | plus de `shield` dans l’inventaire, plus de `left:'shield'` / `shieldEnergy` à l’équipement, `fireLeft:false` (la main gauche reste vide), méthodologie réécrite |
| `tools/boss-profiles.mjs` | `campaignPolicy` appelé avec `{weapons}` seul, plus `shield:true` |
| `tools/boss-ttk.cjs` | `inventory` sans `shield`, `discovered` sans `['shield',-1]`, filtre simplifié en `weapons[i]` |

Les quatre outils tournent sans erreur après la correction :

- `campaign-profiles.mjs` : 18 mondes, `discoveryPickups` **5 → 4**, `exactCheckpointRoundTrips` 22,
  `conditionalTrophyGuards` 12, aucune chaîne `shield` dans le rapport JSON ;
- `boss-profiles.mjs` : 18 mondes, premier colosse 600 PV, dernier 12 000 PV ;
- `boss-ttk.cjs` (arène contrôlée, visée parfaite) : colosse 1 tué en 116,800 s au pistolet, colosse 6 en
  215,225 s, colosse 18 en 272,175 s, joueur vivant dans les trois cas ;
- `campaign-balance.mjs` : 36 combats, tous `cleared`.

## Comparaison appariée du banc de combat

`campaign-balance.mjs` a été lancé sur la base (`35c654a`, avec le bouclier) puis sur l’arbre courant,
mêmes graines, mêmes scénarios (`nominal`, `pistol-only`), 18 mondes :

```
node tools/campaign-balance.mjs --root <base> --out balance-avant.json
node tools/campaign-balance.mjs --root .      --out balance-apres.json
node comparer-balance.mjs balance-avant.json balance-apres.json
```

Résultat (`comparatif-balance.txt`, sorties complètes compressées dans `balance-avant.json.gz` et
`balance-apres.json.gz`) : **34 combats sur 36 strictement identiques** (issue, durée, tués, dégâts subis,
tirs, touches, munitions consommées, distance parcourue, pic de combat). Les deux seuls écarts sont au
**monde 4**, dans les deux scénarios :

| | avant | après | écart |
| --- | --- | --- | --- |
| durée | 5,225 s | 4,575 s | −0,650 s (−12,4 %) |
| tirs / touches | 17 / 17 | 15 / 15 | −2 |
| distance | 15,409 | 13,810 | −10,4 % |
| issue / dégâts | cleared / 0 | cleared / 0 | inchangés |

Le monde 4 est exactement l’ancien monde du trophée de bouclier : sa suppression retire les trois gardes
d’épreuve qui accompagnaient ce trophée, donc l’échantillonnage des quatre fantassins de l’arène ne tombe
plus sur les mêmes définitions. C’est le seul monde concerné, parce que les autres mondes à trophée
(7, 10, 13, 16) conservent leurs gardes.

**Limite à dire clairement** : ce banc ne subit aucun dégât, avant comme après (`dégât moyen 0.00` sur les
quatre séries). Il n’a donc jamais mesuré la valeur défensive du bouclier, et son issue ne peut pas prouver
que le retrait est neutre au combat. Il prouve seulement qu’il ne dégrade pas le combat mesuré.

## Documentation alignée

`inventaire-mentions.mjs` compte les mentions `shield`/`bouclier` avant/après et recopie celles qui
restent (`inventaire-mentions.txt`) :

| Fichier | Avant | Après |
| --- | --- | --- |
| `tools/campaign-profiles.mjs` | 6 | 0 |
| `tools/campaign-balance.mjs` | 7 | 0 |
| `tools/boss-profiles.mjs` | 1 | 0 |
| `tools/boss-ttk.cjs` | 2 | 0 |
| `CONTRACT.md` | 11 | 8 (3 lignes, toutes des phrases de mise à la retraite) |
| `README.md` | 18 | 2 (1 ligne) |
| `docs/ARCHITECTURE.md` | 28 | 12 (8 lignes) |

Chiffres corrigés au passage dans `CONTRACT.md` : `fireLeft` sans second rôle, départ pistolet main droite
main gauche libre, jalons de trophée aux mondes 7/10/13/16, plafonds d’activité 4–11, capacité d’armure
100 sans condition de garde, tiers des dégâts résiduels après seule mitigation passive, 13 offres,
`exportLoadout()` sans `shieldEnergy`, sons d’explosion seuls, et un paragraphe dédié à la retraite
(incluant le refus propre des points antérieurs et le rack `arsenal-smg-cells`).

Dans `docs/ARCHITECTURE.md` : inventaires sans `shield`, main gauche `null` ou arme possédée, remplacement
du paragraphe du bouclier par l’esquive (0,2 s d’invulnérabilité, 1,7 s de délai), la crosse et l’onde,
événements `melee`/`dash`/`pulse`, clés `discovered` sans `shield` avec tolérance de lecture, politique
`[4,5,6,8,10,11]`, explosifs conditionnés à l’arme lourde, catalogue 13 offres et `unknown-item`,
overlay des mains sans panneau translucide, paragraphe de première personne réécrit sur les mesures
réellement faites par `checks/first-person.test.mjs`.

## Ce qui n’est pas touché, et pourquoi

- `docs/chantier-moteur/RAPPORT.md`, `VALIDATION.md` : réservés à l’intégrateur (mission §2).
- `docs/chantier-moteur/constats/*`, `MASTER-PROMPT.md`, `docs/qa-v08/*`, les preuves des lots déjà
  intégrés : ce sont des relevés historiques, pas des consignes ni de la documentation vivante.
- `docs/chantier-moteur/modules/entrees.md` (ligne 291, le libellé « Tirer / bouclier · main gauche » ;
  ligne 440, la vibration `shieldBlock` mappée sur `simulation.js:779`) et `modules/boucle.md` (ligne 1468,
  `shieldLift`) décrivent le code à un commit de référence et appartiennent au lot qui doit raccorder
  `FInput`. Les réécrire ici empiéterait sur ce lot. **Reste à faire par l’intégrateur ou le lot entrées** :
  ces trois lignes citent un bouclier qui n’existe plus.

## Vérification

`npm test` : **510 tests, 510 passés, 0 échec**. `dist/index.html` inchangé par cette tâche (aucune
modification de `src/`) : 840 220 octets, sha256 `0b5b9425588339950667681b45df1b76b9b94f6481381d765da07dabcacc6957`,
égal à `SIZE.json`.
