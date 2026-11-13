# Étape 1 — FLoop : preuves

Mac M5 (arm64, macOS), Node v24.18.0, branche `chantier/module-boucle`, parent `bed0cb2` (étape 0), base `71eca61`.
Classe de preuve : état identique pour le jeu (fichiers neufs seulement, rien n'est branché).

## Origine des fichiers et conformité au code normatif

Les fichiers viennent du commit `0a326af` du relais (branche `spark/spark-wip/boucle`), repris par
`git checkout 0a326af -- <chemins>` (pas de cherry-pick), puis relus.

| Fichier | Octets | sha256 | Contrôle |
|---|---|---|---|
| `src/loop.js` | 6 042 | `2002052f16b930748cb33c59366686744d8f7ba0b05add3e517d6271e46214c5` | `cmp` avec les lignes 243 à 351 de la mission (§4.5) : identique |
| `tools/boucle-motifs.mjs` | 10 343 | `91608081942e785442b5bf8b3e550a35b3ce2a3dfa9536b7041ac8e93676e73a` | `cmp` avec les lignes 1282 à 1382 de la mission (annexe A) : identique |
| `checks/floop.test.mjs` | 16 613 | `7f6c9b7a4ec38880d8fbf0f3863b53ffff7f0b4cda1a0776db7d127409074917` | relu test par test contre le §6.2 ; lignes 1 à 24, T-F07 et T-F28 identiques à l'annexe B |

`src/loop.js` fait 6 042 octets : sous la limite de 8 000, au-dessus de la cible de 6 000. Il n'est pas compacté,
car la taille projetée de la page (822 965 octets) et `loopSha256` supposent le code normatif tel quel.

## Tests : `node --test checks/floop.test.mjs`

26 tests, 26 réussis, 0 échec, 0 todo, 7,2 s (charge 2,2) : T-F01 à T-F25 et T-F28. T-F26 et T-F27 viennent
à l'étape 2. Avant ce travail : `src/loop.js` absent ; version du relais : 26 réussis en 5,4 s.

Écarts trouvés dans les tests du relais, et renforcements (aucune valeur attendue changée) :

1. **T-F22, descente 144 → 60 Hz : vérification vide.** Le relais poussait `L2.advance(t, …)` dans `rows2`, soit
   1 700 fois le même objet `frame` (1 seul objet distinct, compté) : `rows2.every(…)` ne regardait que la dernière
   image. Le test copie maintenant `steps` et `locked` image par image. Mesure : histogramme `{"1":1700}`,
   0 image verrouillée, période finale 8,33333333333394 ms : le comportement attendu par le §6.2 tient.
2. **T-F18** : `observe(NaN)` doit laisser `period`, `locked`, `acc`, `debt` et `stats` inchangés, et garder la
   référence d'horodatage (l'image suivante, `advance(t + 5·P)`, fait 1 pas avec `raw` = P à 1e-9 près).
   Mutant de contrôle (dans une copie jetable) : `observe` qui pose `last = now` même si `now` n'est pas fini.
   Le T-F18 du relais passe sur ce mutant ; le T-F18 renforcé échoue (`raw : 0`).
3. **T-F12** : vérifie aussi l'invariant 4 du §4.6 image par image sur les 21 motifs (0 ≤ steps ≤ 5,
   0 ≤ alpha ≤ 1, verrouillé ⇒ |alpha − 0,999| < 1e-12), pour que « invariants tous testés » soit vrai.
4. **T-F19** : vérifie que la boucle est verrouillée avant `reset()` (« après 100 images à 60 Hz (verrouillé) »).

## Le jeu est inchangé

- `python3 tools/build.py`, lancé dans une copie jetable de l'arbre de travail (le clone n'est pas reconstruit) :
  code 0 ; `dist/index.html` et `SIZE.json` identiques à ceux du dépôt (`cmp`) ; 812 696 octets,
  sha256 `4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a` ; `FLoop` absent de la page
  (le module n'est pas dans la liste `modules` de `tools/build.py`).
- `node checks/build.test.mjs` : PASS, 812 696 octets.
- `npm test` complet sur le Spark (Linux aarch64, Node v24.18.0, `outils/npm-test-spark.sh`) : 470 tests,
  462 réussis, 8 échecs, 131 s de `node --test`. Ce sont les 8 échecs de la référence de l'étape 0
  (`not ok 108` à `115` de `checks/campaign-world.test.mjs` : six empreintes legacy, graines 1 et 96, secteurs 0 à 2,
  puis « campaign mode is strictly opt-in… » et « the first three campaign worlds preserve historical geometry… »).
  Aucun nouvel échec. `checks/floop.test.mjs` n'est pas dans `npm test` (`package.json` inchangé, raccord).
- Chargement dans le domaine principal : `loadRealm({root, modules: ['loop'], realm: 'main'}).window.FLoop`
  donne `create`, `aim` et `track` ; 144 Hz synthétique, 1 440 images : 601 pas, 839 images à 0 pas
  (valeurs attendues par la page `navigateur.html` du §7.6).
