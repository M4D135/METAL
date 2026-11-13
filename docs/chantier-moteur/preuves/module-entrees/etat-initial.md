# Module entrées — état initial (étape 0)

Relevé le 13/11/2026 sur le Mac, dans le clone `mod-entrees`, branche `chantier/module-entrees`, avant toute création de fichier. Aucun code n'a été écrit à cette étape.

## Base

```
$ git rev-parse HEAD
71eca61c0b8f3bbaa05b0692d9fa4fd192b9f2db
$ git status --short
(aucune sortie : arbre propre)
$ git log --oneline -3
71eca61 Intègre le point de reprise laissé par ChatGPT
2f2a1a8 Intègre le dossier d'audit du chantier moteur (PR #2)
ffd8848 docs: préserver le point de reprise après indisponibilité de l’environnement
$ node --version
v24.18.0
```

La base du module est donc `71eca61`.

## Le module n'existe pas encore

```
$ ls src
actors.js
audio.js
brain.js
destruction.js
economy.js
effects.js
game.js
index.html
motion.js
music.js
options.js
renderer.js
simulation.js
soundscape.js
style.css
world.js
$ git grep -n FInput -- src checks tools
(aucune sortie, code 1)
$ git grep -n -i gamepad -- src
(aucune sortie, code 1)
```

Pas de `src/input.js`, aucune occurrence de `FInput` dans le code, les tests ni les outils (le dossier `docs/` en parle déjà, c'est normal), et 0 occurrence de « gamepad » dans `src/` : le jeu n'a pas de manette.

## Référence des tests

`npm test` complet sur le Spark (Linux arm64, Node 24), par `outils/npm-test-spark.sh`, le 13/11 sur `71eca61`. Relevé par le chef de lot ; journal relu ici le même jour (la base n'a pas changé depuis) :

```
# tests 470
# pass 462
# fail 8
# cancelled 0
# skipped 0
# todo 0
not ok 108 - legacy seed 1, sector 0: exact pre-campaign world fingerprint
not ok 109 - legacy seed 1, sector 1: exact pre-campaign world fingerprint
not ok 110 - legacy seed 1, sector 2: exact pre-campaign world fingerprint
not ok 111 - legacy seed 96, sector 0: exact pre-campaign world fingerprint
not ok 112 - legacy seed 96, sector 1: exact pre-campaign world fingerprint
not ok 113 - legacy seed 96, sector 2: exact pre-campaign world fingerprint
not ok 114 - campaign mode is strictly opt-in and keeps historical clamping otherwise
not ok 115 - the first three campaign worlds preserve historical geometry outside campaign supplies and loadout
```

- `node checks/world.test.mjs`, premier maillon du script `test`, passe (`"status": "PASS"`, 18 cas).
- Les 8 échecs sont tous dans `checks/campaign-world.test.mjs` : les 6 empreintes historiques « legacy seed 1/96, sector 0-2 » et les tests 114 et 115. Ils échouent sur arm64 (le Mac comme le Spark) et passent sous x64 ; le lot « 01 suite » les corrige, et la référence deviendra alors 470/470.
- La chaîne `&&` du script `test` s'arrête avant `checks/build.test.mjs`. Lancé à part, sur le Mac :

```
$ node checks/build.test.mjs
{
  "status": "PASS",
  "html_bytes": 812696,
  "external_assets": 0,
  "sha256": "4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a"
}
```

## Fichiers du jeu à garder intacts

| Fichier | Octets | sha256 |
|---|---|---|
| `dist/index.html` | 812 696 | `4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a` |
| `SIZE.json` | 718 | `4221722ac3099aa28dd1972d61b157f84aa99748939cc21cf3ae08673062c972` |

Le module n'est pas branché : aucun fichier existant ne doit changer, `python3 tools/build.py` n'est pas lancé, et `git diff --name-status 71eca61 HEAD` ne doit montrer que des lignes `A`.
