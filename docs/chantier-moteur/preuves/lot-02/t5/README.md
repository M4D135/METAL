# Lot 02 / T5 — génération du monde : grille spatiale au lieu de tri

## Résultat

**Livré : LOAD-06, classe « état identique ».** Les 46 mondes de contrôle sont identiques octet
pour octet avant et après : 2 graines × 18 mondes de campagne V2, 2 graines × 3 mondes
historiques, et 4 indices de campagne V1. L'empreinte SHA-256 de la concaténation des 46 JSON
est la même des deux côtés : `f1062c320e5197542eba2503f8446524bbfd8913f1f5a8fbcd188f676f0de285`.

Le temps de création d'un monde baisse de **31,6 %** en somme sur les 46 mondes (2 282 →
1 560 ms), et le gain médian par monde vaut **0,321** (47,9 → 32,3 ms). C'est **sous** la
fourchette de la fiche (−34 à −50 %), et très loin des « −70 à −100 ms par monde » du
prototype : sur cette machine, la création d'origine ne coûte déjà que 48 ms en médiane, donc
le plafond absolu est bien plus bas. Le gain relatif reste net et ne dépend d'aucun compromis.

| Élément | Valeur |
| --- | --- |
| Avant | commit `4409f7d`, `src/world.js` sha256 `fd8d8f87…` |
| Après | arbre T5, `src/world.js` sha256 `7469dd86…` (seul source modifié) |
| Machine | Apple M5, 10 cœurs logiques, Node v24.18.0 (`darwin arm64`), charge 2 à 3 |
| Taille | **853 079 octets** bruts (0.9.0), soit +2 220 octets ; la fiche prévoyait +1,5 Ko |

## Ce qui change

Le patch est la reprise de `bancs/load/patches.mjs` (« worldgen3 »), adaptée à `FMath.hypot2`
du lot 01 suite. Il est conservé dans [`patch.mjs`](patch.mjs) pour la revue ; les scripts de
preuve comparent deux arbres Git, pas le patch.

1. **`demolitionMetadata`** : les groupes candidats d'une pièce ne sont plus triés en entier.
   Une grille de 4 m indexe les groupes par région (`(x*65536+z)`), chaque groupe étant inscrit
   dans toutes les cellules couvertes par ses bornes élargies de 1,46 m. La recherche ne visite
   que la cellule du point. Le minimum est pris avec l'ordre d'origine comme bris d'égalité,
   comme le tri stable.
2. **`nearest(x,y,z,region)`** : minimum linéaire au lieu de `filter` + `map` + `sort`.
   Égalité conservée : le premier groupe de distance strictement plus petite gagne, donc le
   premier dans l'ordre du tableau à égalité.
3. **`choose` (baies de renfort)** : la grille de base n'est plus recalculée cellule par
   cellule sur toute la pièce. Le rectangle libre est écrit directement, puis seules les
   cellules couvertes par chaque collider sont effacées, dans une fenêtre bornée.
4. **`nearest(p,mask)`** : la recherche des départs ne balaie plus toute la grille, seulement
   la fenêtre de ±0,6 m autour du point, avec les mêmes bornes et le même prédicat
   (`FMath.hypot2 < .6`, arité conservée).
5. **`covers` et `maskFor`** : le test de tranche est déroulé sur les trois axes, sans tableau
   littéral par boîte ; les bornes de la fenêtre de colliders sont calculées une fois hors de
   la boucle.

## (1) Identité : 46/46

[`identity.mjs`](identity.mjs) charge les deux arbres avec `tools/realm-loader.mjs` (donc avec
`src/fmath.js` avant `src/world.js`) et compare la chaîne JSON complète de chaque monde, pas
seulement une empreinte. Sortie : [`identity.json`](identity.json).

| Contrôle | Résultat |
| --- | --- |
| Mondes V2 (2 graines × 18) | 36/36 identiques |
| Mondes historiques (2 graines × 3) | 6/6 identiques |
| Campagne V1 (indices 0, 5, 10, 15) | 4/4 identiques |
| Total | **46/46**, aucun différent |
| SHA-256 des 46 JSON concaténés | `f1062c32…` des deux côtés |
| Octets par monde (dernier cas) | 4 192 404, identiques |

Le chargement des sources est identique hors `world.js` : `sourceSha256.a = fd8d8f87…` et
`sourceSha256.b = 7469dd86…` ne diffèrent que par ce fichier.

## (2) Gain : 31,6 %

[`gain.mjs`](gain.mjs) alterne les deux variantes dans le même processus, trois créations par
monde et par variante, et garde la médiane par monde. Sortie complète :
[`gain.json`](gain.json).

| Mesure | Avant | Après | Gain |
| --- | ---: | ---: | ---: |
| Somme des 46 mondes | 2 282,0 ms | 1 560,3 ms | **−31,6 %** |
| Médiane par monde | 47,9 ms | 32,3 ms | **−32,1 %** |
| Gain minimal | — | — | 0,144 (`424242/11/v2`) |
| Gain maximal | — | — | 0,409 (`424242/16/v2`) |

Les mondes V1 (`campaign-w5`, `w10`) gagnent un peu moins (0,25 à 0,27) que les V2 : leur
génération a moins de groupes à indexer.

### Ce que la mesure ne dit pas

- La création du monde a lieu une fois par partie ou par changement de secteur : ce gain ne
  change pas la cadence en jeu, seulement le temps de chargement.
- Aucune mesure navigateur : les chiffres sont Node 24.18 sur M5. Le coût de la grille
  (allocation des listes) est inclus.
- La charge de la machine (2 à 3) explique une partie de l'écart avec le prototype ; l'ordre
  alterné et la médiane par monde limitent ce biais, sans l'annuler.

## (3) Contrôles

| Contrôle | Résultat |
| --- | --- |
| `node checks/world.test.mjs` | PASS, 4 800 cibles vérifiées |
| `checks/campaign-world.test.mjs` | **46/46** |
| `npm test` complet | **505/505**, zéro échec |
| `python3 tools/build.py` | PASS, 853 079 octets, 0 ressource externe |
| `SIZE.json` | version 0.9.0, sha256 `1d67115d…` |

Aucun test n'a été modifié. Le snapshot de sauvegarde n'est pas concerné : la génération rend
les mêmes mondes, donc les mêmes empreintes de campagne.

## Commandes

```sh
# arbre d'avant (HEAD~1 une fois T5 commité)
rm -rf /tmp/avant-t5 && mkdir -p /tmp/avant-t5 && git archive HEAD~1 src | tar -x -C /tmp/avant-t5

node docs/chantier-moteur/preuves/lot-02/t5/identity.mjs /tmp/avant-t5 .
node docs/chantier-moteur/preuves/lot-02/t5/gain.mjs /tmp/avant-t5 . /tmp/gain-t5.json
```
