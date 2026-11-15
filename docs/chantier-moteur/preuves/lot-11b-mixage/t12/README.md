# Lot 11b / T12 — Les boucles d'ambiance au repos se débranchent du filtre (MIX-07)

Constat : MIX-07. Classe : **visuellement identique**. Ne dépend de rien.

## Le correctif

Trois boucles tournent en permanence : la vapeur (`hiss` → `steamFilter`), le vent
(`air` → `airFilter`) et les quatre machines (`m.source` → `m.filter`). Leur gain est
automatisé à 0 quand elles n'ont rien à dire, mais la source restait **branchée au
filtre** : le filtre et le traitement en aval continuaient de tourner pour du silence.

La fiche prescrit l'implémentation la plus simple, celle qu'elle a mesurée : quand la
**cible de gain** vaut 0, `source.disconnect(filtre)` ; quand elle repasse au-dessus de
0, `source.connect(filtre)`. Rien n'est arrêté, relancé, ni recalculé en phase.

`src/audio.js` : un `loopLink(source, filtre, on)` mémorise l'état de liaison par source
(et ne fait rien si rien ne change), appelé dans `updateSteam`, `updateMachinery` et
l'automatisation du vent. `hiss` et `air` sont montés à la portée du closure pour être
visibles de ces automatisations. Aucune option : changement interne.

Écart de fourchette : la fiche demande de « noter VERSIONS.md ». Ce fichier n'existe pas
dans le dépôt (`git ls-files` ne renvoie aucun VERSIONS.md, et le lot 11 ne l'a pas créé).
Le changement interne est donc noté ici, dans le rapport du lot et dans la page de
validation, qui sont les emplacements de documentation réels de ce projet.

## Reproduire

```sh
node docs/chantier-moteur/bancs/mix/run.mjs $S_A "mix.html?job=attrib&scenes=c" 900 attrib-avant.json
node docs/chantier-moteur/bancs/mix/run.mjs $S_B "mix.html?job=attrib&scenes=c" 600 attrib.json
node /tmp/opencode/mix11b/gen.mjs $S_A docs/chantier-moteur/bancs/feel/doomish.mjs $S_B $S_A   # SRC et SRC_B
node docs/chantier-moteur/bancs/mix/run.mjs $S_B "mix.html?job=ab&scenes=c,a&noise=1" 900 ab.json
```

## Critère de la fiche : coût du fil audio au repos, scène (c)

| cas | avant, min / médiane | après, min / médiane |
|---|---|---|
| **repos** | 22,56 / 24,60 ms/s | **10,65 / 11,31 ms/s** |
| repos avec prises | 27,07 / 27,83 | 11,41 / 13,14 |
| sans boucles d'ambiance | 13,65 / 16,41 | 10,77 / 13,74 |
| sans compresseur | 23,94 / 24,88 | 7,64 / 8,73 |
| sans écrêteur | 24,66 / 26,76 | 11,03 / 11,48 |
| sans boucles ni compresseur | 9,82 / 11,75 | 6,87 / 8,38 |

Cible « repos ≤ 16 ms/s » : **tenu**, 11,31 ms/s médiane, soit **−54 %**. Le repos tombe
au niveau du cas « sans boucles d'ambiance » (13,74) : une boucle muette ne coûte plus
rien. L'écart restant avec « sans boucles ni compresseur » (8,38) est le compresseur, que
T5 a descendu à −9 dB et qui travaille davantage.

## Critère de nullité : ce que la fiche annonçait, et ce que la mesure rend

La fiche écrivait : `job=null scenes=c,a diff ≤ −90 dBFS RMS`, avec le garde-fou
« la phase de la boucle diffère du rendu actuel, le test de nullité échoue pour les
moteurs, inaudible pour une boucle ».

`job=null` n'est plus rejouable tel quel : ses variantes `loop14` patchent le source sur
des ancres que LOOP-14 a fait disparaître quand le lot 11 l'a intégré (erreur
`patch introuvable : l14c`). Le banc a déjà ce qu'il faut à la place, `job=ab`, qui rend
la même scène avec la source d'avant (A) et celle d'après (B) :

| scène | diff. crête | diff. RMS | bruit de fond du banc (A contre A) |
|---|---:|---:|---:|
| (c) | −32,72 dBFS | **−55,18 dBFS** | −132,45 / −155,90 |
| (a) | −40,28 dBFS | **−66,26 dBFS** | −138,47 / −157,88 |

Le critère ≤ −90 dBFS n'est **pas atteint**, exactement comme l'annonçait le garde-fou :
ce n'est pas du bruit (le banc, lui, rend de l'identique à −156 dBFS), c'est la **phase
des boucles de bruit**. Une boucle débranchée puis rebranchée reprend le tampon
circulaire à une autre position ; deux bruits décorrélés donnent une différence d'environ
3 dB sous le niveau du signal. Les niveaux de sortie, eux, sont **identiques au centième** :

| scène | crête A / B | RMS A / B | appels AudioParam A / B | voix pic / volées | temps de rendu A → B |
|---|---|---|---|---|---|
| (c) | 0,743 / 0,743 | −18,62 / −18,62 dBFS | 9 485 / 9 485 | 14 / 0 | 1 716 → **1 172 ms** |
| (a) | 0,518 / 0,518 | −20,26 / −20,26 dBFS | 7 100 / 7 100 | 5 / 0 | 1 595 → **1 161 ms** |

Même crête, même RMS, même nombre d'appels d'automatisation, même polyphonie, et le
rendu hors ligne **32 % plus rapide**. La première divergence apparaît à 2,007 s, après
les 2 s que le banc ignore, et elle est portée par des boucles dont le niveau est de
l'ordre de −52 dBFS.

## Ce qui reste à confirmer sur un appareil réel

La fiche demande l'écoute pour trancher « inaudible ». Deux oreilles humaines manquent :
la différence mesurée est une phase de bruit décorrélé à −52 dBFS, pas un changement de
niveau, mais personne ne l'a entendue sur haut-parleurs de portable.

## Tests et taille

`node --test checks/audio.test.mjs` : 54 → **55 tests, 55 réussis**.
Un test nouveau vérifie que la cible à zéro débranche la source de son filtre, que
**rien n'est arrêté** (le `stopTime` de la boucle ne bouge pas), que le filtre reste en
place, et que la source se rebranche dès que la cible remonte — pour la vapeur et pour le
vent.
Quatre tests existants (boucles d'ambiance, LOOP-14 d'automatisation, vapeur continue)
ont dû être **adaptés dans ce commit**, parce qu'ils lisaient `source.connections[0]`
pour retrouver le filtre d'une boucle que le moteur vient de débrancher exprès. Le faux
contexte implémente maintenant `disconnect(cible)` conformément à Web Audio (une seule
liaison part) et mémorise la première liaison de chaque nœud ; les assertions portent
toujours sur le même filtre.

`npm test` : **532 réussis, 0 échec** (référence de départ 526/526).
`dist/index.html` : 871 229 → **872 105 octets** (+876), sha256 conforme à `SIZE.json`.
