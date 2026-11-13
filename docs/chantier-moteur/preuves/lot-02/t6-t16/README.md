# Lot 02 / T6, T7, T10, T11, T16 — quatre groupes d'optimisation sans allocation, état identique

## Résultat

**Livré : SIM-04, SIM-06, SIM-09, SIM-10 et RESTE-04, RESTE-05, classe « état identique ».** Les
quatre groupes changent le code de simulation sans changer un seul pas, un seul snapshot et une
seule reprise. Chaque groupe est mesuré seul contre l'arbre qui le précède, puis les quatre sont
mesurés ensemble contre le point de départ (commit `e47749d`, juste après la reprise de `main`).

Le gain cumulé est réel mais **loin du but du lot** (−40 à −60 %) :

| Mesure cumulée (9 scénarios, arme 2, 1 800 pas, 3 passages) | Valeur |
| --- | --- |
| État identique, pas à pas et au snapshot | **oui, 9/9** |
| CPU total, somme des 9 scénarios | 4 598 → 4 042 ms, **−12,1 %** |
| Médiane des ratios de passages, par scénario | 0,839 à 0,964 ; **médiane 0,880** |
| Ratio des pas appariés, par scénario | 0,787 à 0,861 ; **−14 à −21 %** |

Les tâches lourdes du lot ne sont pas commencées : T5 (génération du monde), T8 (rayons), T9
(fabriques et morceaux coincés), T12 (destruction) et T15 (bancs STAB). Le reste du gain est
attendu là, pas dans cette tranche.

| Groupe | IDs | Ce qui change | Gain mesuré (médiane des médianes de passages) | Verdict |
| --- | --- | --- | ---: | --- |
| T16 | SIM-10 | `moveSpeed` saute `Math.hypot` quand le déplacement est nul ; positions de départ des ennemis en `Float64Array` au lieu d'un tableau par pas | 1,009 | sous le bruit, gardé pour l'allocation |
| T6 | SIM-04, SIM-09 | `blocked()` déroule ses trois listes au lieu de `[boxes,doors,traps]` ; `segmentFree` déroule ses deux listes et ses deux axes de tranche | 0,956 | à la limite du bruit, gardé (aucun tableau par appel) |
| T7/T10 | SIM-06, RESTE-04 | clés de voisinage numériques, listes réutilisées, `aiStats` champ par champ, six minuteries déroulées, comptes de rencontres en une passe, sélection sans `Set`/`Map`/tableau | **0,906** | gain net |
| T11 | RESTE-05 | étendue des débris en scalaires, mêmes formules et même ordre d'addition | 0,997 | sous le bruit |

Le bruit de cette machine est de 5 à 10 % en A/A : un gain inférieur à 5 % n'est **pas**
mesurable ici. T16, T6 et T11 sont donc annoncés « pas de gain mesurable », pas « gain ». Ils
restent dans l'arbre parce qu'ils suppriment des allocations par pas (pression GC que `ab2` ne
compte pas) et parce que l'état est identique ; ils ne sont pas comptés dans le gain.

## Ce que fait chaque groupe

### T16 — `Math.hypot` sur déplacement nul, départs en `Float64Array` [SIM-10]

`updateEnemies` calculait `Math.hypot(dx,dz)/dt` pour chaque ennemi, y compris les dormants qui
n'ont pas bougé. Le calcul est sauté quand `dx` et `dz` valent zéro ; le résultat est le même
(`moveSpeed=0`) et aucun autre code ne lit la valeur intermédiaire. Les positions de début
étaient un `s.enemies.map(e=>[e.x,e.z])`, donc un tableau de tableaux par pas : elles passent
dans un `Float64Array` réutilisé, agrandi seulement quand l'effectif augmente.

### T6 — `blocked()` et `segmentFree` sans tableau par appel [SIM-04, SIM-09]

`blocked` construisait `[boxes,doors,traps]` puis itérait. Les trois listes sont maintenant
déroulées dans l'ordre d'origine (`boxes`, `doors`, `traps`) par `blockedList`, avec exactement
les mêmes tests et le même ordre d'entrées. `segmentFree` construit une fois les bornes
`lowY`/`highY` au lieu de les recalculer par boîte, puis déroule ses deux listes (`local`,
`doorBoxes`) et ses deux axes de tranche. Le test de tranche est le même, y compris le rejet
anticipé des boîtes hors de l'emprise et les cas `|delta|<1e-8`. Le raccourci de seau de
`blocked` est conservé à l'identique (`staticBoxes===solids && r>=0 && r<=bucketRadius`).
Les trois `blocked(..., [])` de `segmentFree` utilisent une constante `noTraps` partagée.

### T7 — boucles ennemies sans allocation [SIM-06]

- voisinage : clé numérique `(ix+32768)*65536+(iz+32768)` au lieu d'une chaîne `ix+','+iz`,
  listes vidées et réutilisées au lieu d'une `Map` reconstruite ; valable pour |x|,|z| < 262 km,
  garanti par les bornes du monde ;
- `s.aiStats` est affecté champ par champ au lieu d'un `Object.assign` littéral ;
- les six minuteries (`senseWait`, `thinkWait`, `shareWait`, `alertWait`, `coverWait`,
  `planWait`) sont décrémentées explicitement au lieu d'une boucle sur un tableau littéral ;
- `encounterCounts` compte en une passe par rencontre (plus de `flatMap` ni de `filter`) ;
- `checkPad` n'est appelé que si le monde a des tremplins.

### T10 — sélection des rencontres sans allocation [RESTE-04]

La sélection triait un tableau de candidats avec un `sort` stable sur
`(distance − bonus 8 m si combat actif, id)`, puis remplissait un `Set` et une `Map`. Elle
utilise maintenant trois tampons réutilisés (`selectOrder`, `selectKeys`, `selectChosen`), un
tri par insertion sur la clé précalculée puis l'id — même ordre que le tri stable d'origine — et
un compteur par rencontre. Les effets de bord (`returning`, mémoire, `quietTime`) sont exécutés
au même moment, dans le même ordre d'itération. `enemyEncounterIndex` (`Int32Array`) remplace la
`Map` dans la boucle de sélection.

### T11 — étendue des débris en scalaires [RESTE-05]

`debrisHalf` appelait `Math.hypot(...v)` et `v.reduce(...)` sur des tableaux temporaires, pour
chaque pièce et chaque rotation. Le calcul passe par `debrisExtent(shape,v0,v1,v2)`, qui garde
`Math.hypot` argument par argument (sphère, cylindre, anneau). Remplacer `hypot` par `sqrt`
changerait le dernier bit et donc les snapshots : ce n'est pas fait. Le feuillage garde son
produit scalaire et son maximum.

## (1) État : identique partout

Chaque rapport `ab2` compare l'arbre avant et après sur 1 800 pas, avec un passage de chauffe
écarté et des passages mesurés alternés. L'identité exige l'empreinte FNV identique à chaque
pas, le SHA-256 identique au snapshot final, et la stabilité des passages. Résultats complets
dans [`ab2-t16.json`](ab2-t16.json), [`ab2-t6.json`](ab2-t6.json),
[`ab2-t7-t10.json`](ab2-t7-t10.json), [`ab2-t11.json`](ab2-t11.json) et
[`ab2-cumul.json`](ab2-cumul.json) (formes résumées par [`resume-ab2.mjs`](resume-ab2.mjs)).

| Scénario | T16 | T6 | T7/T10 | T11 | Cumul | Chaîne (cumul) |
| --- | --- | --- | --- | --- | --- | --- |
| legacy-s0 | identique | identique | identique | identique | identique | `576ce3b4` |
| legacy-s2 | identique | identique | identique | identique | identique | `afedbbcd` |
| campaign-w10 | identique | identique | identique | identique | identique | `6cd12673` |
| campaign-w16 | identique | identique | identique | identique | identique | `6de7419e` |
| campaign2-w1 | identique | identique | identique | identique | identique | `36b0dc6a` |
| campaign2-w7 | identique | identique | identique | identique | identique | `357d17e8` |
| campaign2-w10 | identique | identique | identique | identique | identique | `8f6aafe7` |
| campaign2-w13 | identique | identique | identique | identique | identique | `7e60456d` |
| campaign2-w18 | identique | identique | identique | identique | identique | `89ab7825` |

Le cumul porte sur l'arme 2 ; T16, T6, T7/T10 et T11 portent sur l'arme par défaut. T11 a en
plus un contrôle arme 2 sur `legacy-s2` et `campaign2-w10` ([`ab2-t11-w2.json`](ab2-t11-w2.json)) :
identique, chaînes `653ff30f` et `8f6aafe7`.

**Les chaînes de `legacy-s2` ne sont pas celles des preuves T1 à T3.** La fusion de `main`
(lot 01 suite, `FMath`) dans la branche du lot 02 a changé cette trajectoire :
`legacy-s2` arme par défaut passe de `54574123` (T3) à `afedbbcd`, et l'arme 2 de `a081121a` à
`653ff30f`. Vérifié en rejouant les sources de `4e184e9` et `2b89360` (avant fusion) : les deux
rendent `54574123`. Aucun des quatre groupes de cette tranche ne change la chaîne ; c'est la
reprise de `main` qui l'a changée, avant le premier d'entre eux.

## (2) Gain : par groupe, puis cumulé

Ratios B/A du CPU total. « Passages » est la médiane, sur les scénarios, des médianes de
passages mesurés ; « apparié » est le ratio des pas appariés (`medianPairedRatio`), moins
sensible aux pics. Somme des neuf scénarios pour le cumul.

| Groupe | Passages | Apparié (min–max) | Somme CPU |
| --- | ---: | ---: | ---: |
| T16 | 1,009 | 0,958–1,069 | 2 605 → 2 683 ms (+3 %) |
| T6 | 0,956 | 0,953–1,082 | 2 695 → 2 674 ms (−1 %) |
| T7/T10 | **0,906** | **0,776–0,977** | 2 537 → 2 267 ms (**−11 %**) |
| T11 | 0,997 | 0,962–1,071 | 2 258 → 2 330 ms (+3 %) |
| **Cumul (arme 2)** | **0,880** | **0,787–0,861** | **4 598 → 4 042 ms (−12 %)** |

Détail cumulé par scénario :

| Scénario | Passages | Apparié | CPU avant → après (ms, 3 passages) |
| --- | ---: | ---: | ---: |
| legacy-s0 | 0,851 | 0,787 | 554 → 445 |
| legacy-s2 | 0,880 | 0,861 | 629 → 589 |
| campaign-w10 | 0,839 | 0,837 | 518 → 426 |
| campaign-w16 | 0,910 | 0,811 | 441 → 391 |
| campaign2-w1 | 0,883 | 0,825 | 377 → 325 |
| campaign2-w7 | 0,873 | 0,818 | 423 → 365 |
| campaign2-w10 | 0,964 | 0,857 | 515 → 483 |
| campaign2-w13 | 0,893 | 0,825 | 520 → 465 |
| campaign2-w18 | 0,874 | 0,836 | 621 → 554 |

Les deux scénarios à charge basse (`campaign2-w10`) gagnent le moins : le coût fixe par pas
domine, et les allocations supprimées y pesaient peu. Inversement, `legacy-s0` et
`campaign-w16` gagnent le plus, là où les boucles ennemies tournent le plus.

### Ce que la mesure ne dit pas

- `ab2` chronomètre le pas de simulation complet, pas la pression GC : les allocations
  supprimées par T6, T7, T10, T11 et T16 ne sont pas valorisées ici.
- La machine est partagée (charge 2 à 3 pendant les mesures) et l'asymétrie A/A atteint 5 à 10 %.
  Les valeurs T16, T6 et T11 sont dans cette bande : elles ne prouvent ni gain ni régression.
- Aucune mesure navigateur : tout est Node 24.18 (`darwin arm64`, Apple M5, 10 cœurs logiques).

## (3) Contrôles

| Contrôle | Résultat |
| --- | --- |
| `npm test` Mac (Node 24.18, 10 cœurs) | **505/505**, zéro échec |
| `npm test` Spark (Linux arm64, Node 24) | **505/505**, zéro échec |
| `python3 tools/build.py` | PASS, **850 859 octets bruts**, version 0.9.0 |
| SHA-256 de `dist/index.html` | `0972ca16a2d8f7ebd0caf63afdd506ddbe5268f850cde5509b3a05f33944e1d7` |

Aucun test n'a été modifié ni affaibli. Les quatre groupes portent sur `src/simulation.js`
seul : `src/simulation.js` passe de `32709a91…` (commit `e47749d`) à `91174f73…` (commit
`02fff03`). Le build et `SIZE.json` sont reconstruits après chaque commit.

## Commandes

```sh
# avant / après chaque groupe, arme par défaut
SC9=legacy-s0,legacy-s2,campaign-w10,campaign-w16,campaign2-w1,campaign2-w7,campaign2-w10,campaign2-w13,campaign2-w18
node --import='data:text/javascript,Object.getOwnPropertyDescriptors(globalThis)' \
  tools/ab2.mjs <arbre-avant> . --scenario "$SC9" --no-counters --reps 2 --out /tmp/ab2.json

# cumul, arme 2
node --import='data:text/javascript,Object.getOwnPropertyDescriptors(globalThis)' \
  tools/ab2.mjs /tmp/prev-lot02 . --scenario "$SC9" --weapon 2 --no-counters --reps 3 --out /tmp/ab2-lot02-cumul.json

# forme résumée
node docs/chantier-moteur/preuves/lot-02/t6-t16/resume-ab2.mjs /tmp/ab2.json ab2-t16.json
```

`$SC9` n'est défini dans aucun document du chantier : c'est la liste des commandes de T3 —
`legacy-s0`, `legacy-s2`, `campaign-w10`, `campaign-w16`, puis `campaign2-w1`, `w7`, `w10`,
`w13`, `w18`.

## Reste à faire dans le lot 02

| Tâche | Objet | État |
| --- | --- | --- |
| T5 | Génération du monde : grille spatiale au lieu d'un tri | non commencée |
| T8 | Rayons : DDA sur les seaux de 8 m | non commencée |
| T9 | Fabriques à forme fixe ; morceaux coincés | non commencée |
| T12 | Destruction : pas de recalcul global | non commencée |
| T15 | Bancs STAB | non commencée |

Les prototypes de `docs/chantier-moteur/bancs/{sim,load}` existent déjà pour ces tâches ; ils
n'ont pas été appliqués.
