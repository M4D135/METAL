# Lot 11b / T3 — Ne pas appliquer FEEL-07 ; fonction makeupDb (MIX-02)

Constat : MIX-02 (contre-vérifié, priorité P1, **qualité identique**).
Classe de preuve : **état identique côté mixage** — sans l'option `chain`, la chaîne est
celle d'aujourd'hui, au bit près ; seul un jeu qui demande `chain` change quelque chose.

Machine : Linux arm64 (DGX Spark), Node 24.18, Chrome **151** sans interface, 48 kHz.

## Ce que la tâche livre

1. **`FAudio.makeupDb(seuil, genou, ratio)`** — le rattrapage automatique que le
   `DynamicsCompressor` de Chromium applique et que le code ne nomme jamais :
   `T = 10^(seuil/20)`, `courbe(x) = x` sous `T`, sinon `T + (1 − e^(−k(x−T)))/k`, `k` par
   15 bissections géométriques entre 0,1 et 10 000 (départ `√(min·max)`) pour que la pente en dB
   prise entre `x` et `1,001x` à l'entrée du genou vaille `1/ratio` ;
   `y1 = courbe(1)` si `seuil+genou > 0`, sinon `10^((20·log10(courbe(x_genou)) − (seuil+genou)/ratio)/20)` ;
   `rattrapage = −0,6 × 20·log10(y1)`.
2. **`FAudio.create({chain})`** — `{masterGain, compressor:{threshold,knee,ratio,attack,release},
   level:'auto'|'fixe'}`. Avec `level:'fixe'`, un **GainNode après le compresseur et avant
   l'écrêteur** vaut `10^((4,547 − rattrapage)/20)`, le rattrapage de référence étant celui de la
   chaîne v0.2 (−19 / genou 18 / 5:1), calculé par la même fonction. La correction de la
   contre-vérification est appliquée : **jamais** `master.gain`, qui est avant le compresseur et
   déplacerait son point de travail.
3. **`stats.makeupDb`** pour les tests, et `annonceDb` dans `job=calib` du banc.
4. **L'écrêteur est inchangé** (il ne sert jamais dans les scènes mesurées).

## La décision « ne pas appliquer FEEL-07 »

Le réglage que MIX-02 réfute est **seuil −12, genou 12, ratio 3, attaque 12 ms** : il baisse le
mixage de 0,6 à 0,8 dB et rend 0 dB de transitoire (la réduction sur tir isolé y est de 0 dB,
0,05 pour la pompe). **Il n'est pas appliqué et ne sera pas appliqué par ce lot.** Ce que la
branche portait depuis le lot 11 est un autre réglage (−12 / genou 6 / 3:1 / 12 ms / 120 ms),
décidé par le banc MIX, que T3 ne touche pas (la tâche est dite « qualité identique ») et que
**T5 remplacera** par le préréglage mesuré de MIX-04 (−9 / 6 / 8:1 / 2 ms / 100 ms). Autrement
dit : à la fin du lot, le compresseur qui sort est celui de MIX-04, pas celui de FEEL-07.

## Reproduire

```sh
node docs/chantier-moteur/bancs/mix/run.mjs $S "mix.html?job=calib" 240 calib.json
node docs/chantier-moteur/bancs/mix/run.mjs $S "mix.html?job=iso&recipes=cur&comps=cur" 900 iso-cur.json
node docs/chantier-moteur/bancs/mix/mixage.mjs --passes=1 calib.json iso-cur.json
```

## Chiffres

`job=calib` — rattrapage rendu par Chrome contre `FAudio.makeupDb` (cible ≤ 0,05 dB) :

| Réglage | Seuil / genou / ratio | Rendu (dB) | Annoncé (dB) | Écart |
|---|---|---:|---:|---:|
| cur | −12 / 6 / 3 | 3,73 | 3,73 | 0,000 |
| v02 | −19 / 18 / 5 | 4,55 | 4,55 | 0,000 |
| feel07 | −12 / 6 / 3 | 3,73 | 3,73 | 0,000 |
| lim | −6 / 4 / 12 | 2,56 | 2,56 | 0,000 |
| lim2 | −9 / 6 / 8 | 3,53 | 3,53 | 0,000 |
| off | 0 / 0 / 1 | 0,00 | 0,00 | 0,000 |

Les quatre couples cités par le constat (3,73 / 4,55 / 2,56 / 3,53) sont reproduits ; la formule
donne de plus 3,300 dB pour le limiteur de BITUME (−6 / 0 / 12), comme le calcul indépendant de
l'audit (3,30).

`job=iso`, recettes actuelles, compresseur actuel : réduction maximale **0,050 dB** sur les cinq
armes (24 contrôles conformes) — très sous le seuil de 1,5 dB exigé par la fiche, et sous celui
de 3 dB du vérificateur.

## Ce qui reste à vérifier sur un vrai appareil

Le rattrapage est une propriété du moteur de Chrome. **Firefox et Safari descendent du même code
mais ont leur propre `DynamicsCompressor`** : `job=calib` doit être rejoué chez eux avant de
garantir `level:'fixe'` ailleurs que sous Chrome.

## Tests et taille

`node --test checks/audio.test.mjs` : 51/51 (un test ajouté, 25 assertions).
`npm test` : **528 réussis, 0 échec** (référence 526/526).
`dist/index.html` : 864 346 → **867 483 octets** (+3 137), sha256 conforme à `SIZE.json`.
