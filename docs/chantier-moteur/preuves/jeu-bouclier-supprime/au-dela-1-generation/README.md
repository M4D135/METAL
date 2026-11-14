# Au-delà 1 — génération : index des colliers et recherche du solide le plus proche

## Ce qui a été mesuré d'abord

Profil CPU de la génération pure (108 mondes de campagne v2, `banc-profil.mjs` +
`--cpu-prof`, `resumer-profil.mjs`), sur la tête de branche avant la modification
(`profil-avant.txt`) :

| Fonction | Temps propre |
| --- | --- |
| `demolitionMetadata` (world.js) | 23,0 % |
| `create` (world.js) | 8,3 % |
| ramasse-miettes | 7,6 % |
| fermeture de tri `(anon):3415` (recherche du solide le plus proche) | 6,8 % |
| `bbox` | 6,2 % |

Deux coûts dominaient `demolitionMetadata` :

1. `w.colliders.flatMap((c,i)=>members.includes(c.mesh)?[i]:[])` appelé pour chaque
   arbre et chaque assemblage : à chaque groupe, on parcourt **tous** les colliers du
   monde (≈ 8 000) et on teste `members.includes` (linéaire dans le groupe).
2. pour chaque maillage meuble, `(byRegion.get(region)||[]).map(g=>({g,d:distance(...)})).sort(...)[0]` :
   on alloue un tableau de candidats, on le trie entièrement, puis on jette tout sauf
   le premier.

## Ce qui a été fait

`src/world.js`, fonction `demolitionMetadata` uniquement :

- un index `collidersByMesh` (Map maillage → indices de colliers) est construit une
  seule fois ; `collidersOf(members)` concatène les indices des maillages du groupe
  puis les trie par indice croissant — **même contenu et même ordre** que l'ancien
  balayage complet ;
- la recherche du solide le plus proche devient une **minimale linéaire** sur la liste
  des groupes de la région : plus d'allocation de tableau de candidats, plus de tri.
  `Array.prototype.sort` de V8 est stable et le premier élément d'un tri croissant est
  le premier au sens strict ; la boucle avec comparaison strictement inférieure retient
  exactement le même groupe en cas d'égalité.

Aucune règle de jeu, aucun champ, aucun ordre de sortie n'est modifié.

## Preuve d'identité

`comparer-generation.mjs` crée chaque monde dans les deux arbres et compare six
empreintes sha256 (groupes destructibles, affectations des maillages, colliers,
ramassages, ennemis, arbres) :

```
node comparer-generation.mjs <avant> <après> --seeds 96,7,1234,20260514 --worlds 18
```

`comparaison-generation.json` : **216 mondes** (4 graines × 18 index × 3 modes
classique / campagne v1 / campagne v2), `ecarts: []`, `identique: true`.

Les empreintes dorées existantes n'ont pas bougé : `checks/world.test.mjs` et les
46 tests de `checks/campaign-world.test.mjs` passent sans recalcul de fixture.

## Mesure appariée

`banc-generation.mjs` (processus principal Node, `process.cpuUsage`, jamais `node:vm`,
passées alternées avant/après, 11 répétitions après 2 échauffements) :

| | médiane | min | max |
| --- | --- | --- | --- |
| avant | 3 614,9 ms | 3 468,4 ms | 3 846,7 ms |
| après | 2 724,1 ms | 2 523,6 ms | 3 218,7 ms |

**Gain médian 24,64 %** sur la création des 18 mondes de campagne v2 ; **les 11 ratios
appariés sont inférieurs à 1** (0,699 à 0,843). Sur les minima, 27,2 %. Sortie
complète dans `mesure-banc.json`, qui consigne aussi l'égalité des quantités générées
(262 787 maillages, 8 098 colliers, 19 926 groupes).

Profil après modification (`profil-apres.txt`, mêmes 108 mondes) :
`demolitionMetadata` 23,0 % → **14,7 %**, la fermeture de tri de 6,8 % a disparu,
temps CPU total 12,9 s → **10,9 s**.

## Portée et limites

- La génération de monde n'est le sujet d'aucune fiche de lot (lot 03 traite les
  révisions de destruction à l'exécution, lot 14 la règle des murs cassables) ; la
  modification reste confinée à l'indexation et à une minimale, sans règle nouvelle.
- Coût concerné : le temps de création d'un monde (chargement de secteur, monde de
  titre, bancs). Ce n'est **pas** une mesure d'images par seconde, de GPU ou
  d'appareil réel.
- `npm test` : 510 tests, 510 passés. `dist/index.html` 840 654 octets, sha256
  `0051f845634d7e6a560c24b4b4ad62126814dfdc76df06fb34e667fe0805b932`, égal à `SIZE.json`.
