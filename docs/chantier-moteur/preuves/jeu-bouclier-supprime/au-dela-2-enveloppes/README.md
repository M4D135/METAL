# Au-delà 2 — génération : enveloppes sans tableau intermédiaire

## Ce qui a été mesuré d'abord

Après le premier volet (`../au-dela-1-generation/`), le profil de génération pure
(108 mondes, `../au-dela-1-generation/banc-profil.mjs` + `--cpu-prof`) laissait en tête :

| Fonction | Temps propre |
| --- | --- |
| `demolitionMetadata` | 14,7 % |
| `create` (world.js) | 9,5 % |
| ramasse-miettes | 8,3 % |
| `bbox` (enveloppe d'un maillage) | 7,0 % |
| `union` (enveloppe d'un groupe) | 2,1 % |

`demolitionMetadata` construit 19 926 groupes pour les 18 mondes. Deux allocations
dominaient :

- `union(list)` : `Object.fromEntries(keys.map(k=>[k,Math[...](...list.map(b=>b[k]))]))`.
  Par appel : 6 tableaux `map` + 6 tableaux de paramètres + 1 tableau d'entrées, soit
  ≈ 13 allocations, multipliées par 2 appels par groupe (à la création puis au
  recalcul après tri) — environ un demi-million d'objets par passage de banc, ce qui
  explique les 8,3 % de ramasse-miettes ;
- `bbox(m)` : un tableau `h` de trois hauteurs alloué pour chacun des 262 787 maillages.

## Ce qui a été fait

`src/world.js`, toujours dans `demolitionMetadata` :

- `unionOf(indices)` parcourt les indices et met à jour six scalars, puis renvoie un
  objet littéral `{minX,maxX,minY,maxY,minZ,maxZ}` — **mêmes clés dans le même ordre**
  que l'ancien `Object.fromEntries` ;
- `bbox` calcule `h0`, `h1`, `h2` en scalars au lieu d'un tableau `h` ;
- les deux sites qui faisaient `union(members.map(i=>boxes[i]))` passent directement
  les indices, sans tableau mappé.

Les appels à `Math.min` / `Math.max` sont conservés tels quels, y compris leur
sémantique exacte : une liste vide donne `Infinity` / `-Infinity`, une valeur `NaN`
contamine le résultat. Rien n'a été remplacé par des comparaisons `<`, qui ne
propageraient pas `NaN` de la même façon.

## Test mis à jour (comportement voulu, dit explicitement)

`checks/fmath.test.mjs:298` comptait les accès **calculés** à `Math` dans `world.js` et
exigeait exactement une occurrence de la clé dynamique `Math[k.startsWith('min')?'min':'max']`
(« the bounds union is the only computed Math access »). Cette clé n'existe plus : la
condition est maintenant `=== 1`, c'est-à-dire **zéro accès calculé**, avec le message
« no computed Math access survives in world.js ». Le garde n'est pas affaibli : la
vérification précédente (lignes 293-297) signale toujours tout `Math.<nom>` hors liste
et toute apparition de `Math` qui ne serait pas une de ces formes. `checks/fmath.test.mjs`
passe 15/15.

## Preuve d'identité

`../au-dela-1-generation/comparer-generation.mjs` sur **270 mondes** (5 graines × 18
index × classique / campagne v1 / campagne v2), six empreintes sha256 chacun
(groupes destructibles, affectations des maillages, colliers, ramassages, ennemis,
arbres) : `ecarts: []`, `identique: true` (`comparaison-generation.json`).

## Mesure appariée

Même banc que le volet 1 (`../au-dela-1-generation/banc-generation.mjs`), deux passages
indépendants de 15 répétitions alternées, consignés bruts dans `mesures-banc.json` :

| passage | médiane avant | médiane après | gain médian | minima | ratios < 1 |
| --- | --- | --- | --- | --- | --- |
| 1 | 3 675,6 ms | 3 164,7 ms | **13,90 %** | 13,05 % | 13 / 15 |
| 2 | 3 043,3 ms | 2 788,6 ms | **8,37 %** | 5,87 % | 11 / 15 |
| combiné | — | — | **9,27 %** (médiane des 30 ratios = 0,9073) | — | 24 / 30 |

La machine est partagée : le pire ratio observé vaut 1,0472 (une passées sur trente
au-dessus de la référence). Le gain reste au-dessus du seuil de 5 % sur les deux
passages, en médiane comme sur les minima, ce qui est le critère retenu.

## Portée et limites

- Coût concerné : création d'un monde (chargement de secteur, écran de titre, bancs).
  Pas une mesure d'images par seconde, de GPU ou d'appareil réel.
- `npm test` : **510 tests, 510 passés, 0 échec**.
- `dist/index.html` 841 206 octets, sha256
  `5c118a3007970be6cfd73643c8ce40f1b74ef9e6a9ecf45ec246619295f4c7d6`, égal à `SIZE.json`.
