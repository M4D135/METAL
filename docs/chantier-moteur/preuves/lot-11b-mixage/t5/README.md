# Lot 11b / T5 — Préréglage « Doom » : armes +3 dB, limiteur −9/6/8 (MIX-04)

Constat : MIX-04. Classe : **meilleure**. Dépend de T1 (recettes) et T4 (tenues du duck).

## Le réglage, et où il vit

La fiche demande que ce soit **propre à METAL, pas le défaut de FERRO**. Le moteur
n'offre donc que deux options, et le préréglage est dans `src/audio-recipes.js` :

- `FAudio.create({weaponGain: {pistol, smg, shotgun, rocket}})` — multiplicateur lu
  **uniquement dans les cues du joueur** (`shot`, `fracture`, `rocket`), jamais dans
  `enemyShot` ni dans les autres effets. Sans l'option, le facteur vaut exactement `1`
  et le rendu reste identique bit à bit.
- `FAudio.create({chain})` (déjà livré en T3) avec `level:'auto'`.

METAL passe `weaponGain = {pistol:1.41, smg:1.41, shotgun:1.41, rocket:1.41}` — soit
0,89 / 0,69 / 1,09 / 0,80 sur les gains internes 0,63 / 0,49 / 0,77 / 0,57, exactement
les quatre valeurs de la fiche — et
`chain = {compressor:{threshold:-9, knee:6, ratio:8, attack:.002, release:.10}, level:'auto'}`.
`level:'auto'` = **aucune compensation** du rattrapage, comme l'exige la fiche : compenser
ferait passer la crête de (c) de 0,77 à 0,87, au ras du genou de l'écrêteur.

## Reproduire

```sh
# la commande exacte de la fiche (recettes doomish, comps banc, duck proportionnel)
node docs/chantier-moteur/bancs/mix/run.mjs $S "mix.html?job=matrix&scenes=a,b,c,d,p&recipes=doom&comps=cur,lim2&ducks=prop&weaponGain=1.41&passes=1" 1500 matrix-fiche.json
# la configuration réellement livrée, avant (432c8ed) contre après, même graine
node docs/chantier-moteur/bancs/mix/run.mjs $S_A "mix.html?job=matrix&scenes=a,b,c,d,p&recipes=metal&comps=metal&ducks=cur&passes=1" 1500 metal-avant.json
node docs/chantier-moteur/bancs/mix/run.mjs $S_B "mix.html?job=matrix&scenes=a,b,c,d,p&recipes=metal&comps=metal&ducks=cur&passes=1" 1500 metal-apres.json
node docs/chantier-moteur/bancs/mix/run.mjs $S_B "mix.html?job=calib" 900 calib.json
```

`comps=metal` est une variante ajoutée au banc : elle **ne touche pas** au compresseur,
c'est la source qui le règle — la mesure porte donc bien sur l'option du moteur et non
sur une valeur imposée par le banc.

## Cinq cibles, sur la commande exigée par la fiche (`matrix-fiche.json`)

| scène | compresseur | crête | > 0,875 | réduction tir isolé (p10) | pompage | voix volées |
|---|---|---:|---:|---:|---:|---:|
| (a) | `cur` | 0,521 | 0 | 0,20 | 2,47 | 0 |
| (a) | `lim2` = −9/6/8 | 0,523 | 0 | **0,00** | **2,21** | 0 |
| (b) | `cur` | 0,708 | 0 | 1,63 | – | 0 |
| (b) | `lim2` | 0,713 | 0 | **0,86** | – | 0 |
| (c) | `cur` | 0,752 | 0 | 0,52 | – | 0 |
| (c) | `lim2` | **0,770** | 0 | **0,04** | – | 0 |
| (d) | `cur` | 0,742 | 0 | 1,72 | – | 0 |
| (d) | `lim2` | 0,737 | 0 | **1,39** | – | 0 |
| (p) | `cur` | 0,673 | 0 | 1,35 | 3,55 | 0 |
| (p) | `lim2` | 0,686 | 0 | **0,75** | **2,62** | 0 |

Les cinq cibles sont tenues : réduction ≤ 3 dB (max 1,39), pompage ≤ 4 dB (2,21 à 2,62),
0 échantillon au-dessus de 0,875 dans (a) à (c) et partout ailleurs, 0 voix volée, pic de
14 voix en (c). Les crêtes reproduisent l'audit à 1/1000 près (0,52 / 0,71 / 0,77 / 0,74
en (a) à (d), 0,686 en (p)), et le constat est confirmé sur son propre point : avec le
compresseur actuel `cur`, la pompe de (b) et (d) est réduite de 1,63 à 1,72 dB et le
maître descend à −2,18 dB en (c), alors que le limiteur −9/6/8 laisse 0,04 à 1,39 dB.

Marges transitoire contre musique, p10, avec `lim2` : SMG 15,41 (a) et 13,77 (d),
pompe 15,32 (b) / 15,46 (d) / 20,44 (p), roquette 13,11 (c) / 14,90 (p), pistolet 18,71 (p).

## Ce que livre réellement METAL, avant contre après (`metal-avant.json`, `metal-apres.json`)

Mêmes scènes, mêmes graines, recettes et options du dépôt, `comps=metal`, `ducks=cur`
(tenues de T4), 1 passe :

| scène | crête avant → après | > 0,875 | marge du tir le plus faible, p10 | voix volées |
|---|---|---:|---|---:|
| (a) | 0,417 → **0,518** | 0 → 0 | SMG 13,71 → **16,70** | 0 → 0 |
| (b) | 0,600 → **0,719** | 0 → 0 | pompe 12,28 → **15,25** | 0 → 0 |
| (c) | 0,669 → **0,743** | 0 → 0 | roquette 10,21 → **13,22** | 0 → 0 |
| (d) | 0,650 → **0,751** | 0 → 0 | SMG 10,97 → **13,91** | 0 → 0 |
| (p) | 0,551 → **0,687** | 0 → 0 | roquette 11,91 → **14,90** | 0 → 0 |

Chaque marge gagne **+2,99 dB**, la valeur exacte de ×1,41, et les crêtes retombent
entre 0,52 et 0,75 comme l'annonçait l'audit. Le pic de voix est inchangé (5, 6, 14, 12, 2).
Réduction de gain sur tir isolé, après : 0,00 à 1,33 dB (max en (d), pompe), contre
0,00 à 0,56 avant — le nouveau limiteur travaille un peu plus sur les gros rapports,
mais reste sous la cible de 3 dB.

## Écarts, dits

1. **Rattrapage** : la fiche annonce « +4,55 → +3,53 dB, donc musique −1,0 dB ». Sur
   cette branche le compresseur courant est déjà à −12/6/3 (lot 11), mesuré à **3,73 dB** ;
   le préréglage descend à **3,53 dB** (`calib.json`, écart mesuré/annoncé 0,000). La
   musique ne perd donc que **0,20 dB**, et les armes prennent +2,99 dB absolus,
   +3,19 dB relatifs — l'ordre de grandeur annoncé (+2 absolus, +3 relatifs) est tenu.
2. **Pompage à la configuration livrée** : 9,12 dB en (a) et 9,53 en (p), contre ≤ 4 dB
   attendu. Ce seuil est celui de **MIX-03** (duck en étagère basse), que la fiche classe
   en option désactivée par défaut et dont la décision « à confirmer par David » a pour
   **valeur par défaut : intégrer T1+T4+T5, garder MIX-03 désactivé**. La mesure à 2,21
   et 2,62 dB ci-dessus est celle du duck proportionnel du banc (`ducks=prop`), pas du
   duck livré. Le duck livré baisse la musique de sa profondeur (0,35), d'où 9 dB : c'est
   la profondeur du caniveau, pas une modulation. Décision notée, non prise ici.
3. **Réduction ≤ 1,5 dB « sur les 48 rendus »** (gain attendu du lot) : tenu sur la
   commande de la fiche (max 1,39), **dépassé de 0,21 dB** en (d) sur la configuration
   livrée à 1 passe (1,71). La matrice d'acceptation à 8 passes, exigée par la fiche, est
   relevée dans le rapport du lot.
4. **Marge de la roquette en (c)** : 13,22 dB au p10 (14,11 au p50), sous les « 14 à 23 dB »
   de l'audit, qui publiait un percentile médian.

## Tests et taille

`node --test checks/audio.test.mjs` : 53 → **54 tests, 54 réussis**. Un test nouveau
vérifie que le préréglage vient bien de l'option (limiteur à −9/6/8/.002/.10, aucun gain
de rattrapage entre compresseur et écrêteur, `makeupDb` cohérent), que le rapport du
joueur est multiplié par 1,41 et que **le tir ennemi est rigoureusement inchangé**.
Une assertion du test FEEL-07 est **mise à jour dans ce commit** : elle figeait le
compresseur maître à −12/6/3, que T5 remplace exprès par −9/6/8.

`npm test` : **531 réussis, 0 échec** (référence de départ 526/526).
`dist/index.html` : 869 908 → **871 229 octets** (+1 321), sha256 conforme à `SIZE.json`.

## Attend du vrai matériel

Le niveau perçu du préréglage : l'audit renvoie à `bancs/mix/out/wav/3-prereglage-doom.wav`
et la fiche exige l'écoute avant intégration. Aucune oreille humaine n'a entendu ces
rendus ; la réserve sous le genou mesurée par l'audit est de 0,68 dB sur 6 minutes.
