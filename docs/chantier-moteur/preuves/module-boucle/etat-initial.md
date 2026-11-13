# État initial — voie « boucle » (FLoop, FSchedule)

Pris à l'étape 0 (tâche MB-0), avant tout code, le 13 novembre 2026, dans le clone de travail du Mac :
Apple M5, 10 cœurs, macOS 27.2.1 (Darwin arm64), Node v24.18.0.
Le `npm test` complet a tourné sur le Spark, par le script de la flotte (voir plus bas) ; tout le reste a tourné sur le Mac.

## Git

- `git rev-parse HEAD` (la **base**) : `71eca61c0b8f3bbaa05b0692d9fa4fd192b9f2db`
- `git rev-parse --abbrev-ref HEAD` : `chantier/module-boucle`
- `git status --short` : vide, l'arbre est propre. Il n'y a pas de dossier `.relais/` : les journaux de cette étape sont gardés dans un dossier temporaire hors du dépôt.
- `git log --oneline -3` :

```
71eca61 Intègre le point de reprise laissé par ChatGPT
2f2a1a8 Intègre le dossier d'audit du chantier moteur (PR #2)
ffd8848 docs: préserver le point de reprise après indisponibilité de l’environnement
```

- `node --version` : `v24.18.0`

## Fichiers attendus absents

`ls src` :

```
actors.js  audio.js  brain.js  destruction.js  economy.js  effects.js  game.js  index.html
motion.js  music.js  options.js  renderer.js  simulation.js  soundscape.js  style.css  world.js
```

`src/loop.js` et `src/schedule.js` sont **absents** : la condition de départ est remplie.

`git grep -n -e FLoop -e FSchedule -- src checks tools` : **aucun résultat** (code de sortie 1), comme attendu.

## Référence `npm test`

Lancé depuis le Mac par `outils/npm-test-spark.sh` (script de la flotte, hors dépôt) : il copie l'arbre de travail du Mac sur le Spark par `rsync`, sans `.git`, `node_modules` ni `.relais`, puis y lance `npm test` (Linux aarch64, 20 cœurs, Node v24.18.0). `node --test` a duré 135 s ; 171 s en tout, copie et attente comprises.

```
# tests 470
# suites 0
# pass 462
# fail 8
# cancelled 0
# skipped 0
# todo 0
```

Les 8 échecs, tous dans `checks/campaign-world.test.mjs` :

```
not ok 108 - legacy seed 1, sector 0: exact pre-campaign world fingerprint
not ok 109 - legacy seed 1, sector 1: exact pre-campaign world fingerprint
not ok 110 - legacy seed 1, sector 2: exact pre-campaign world fingerprint
not ok 111 - legacy seed 96, sector 0: exact pre-campaign world fingerprint
not ok 112 - legacy seed 96, sector 1: exact pre-campaign world fingerprint
not ok 113 - legacy seed 96, sector 2: exact pre-campaign world fingerprint
not ok 114 - campaign mode is strictly opt-in and keeps historical clamping otherwise
not ok 115 - the first three campaign worlds preserve historical geometry outside campaign supplies and loadout
```

`npm test` sort en code 1 dès `node --test` : la chaîne `&&` du script `test` ne lance donc jamais `node checks/build.test.mjs`. Lancé à part, sur le Mac :

```
{"status": "PASS", "html_bytes": 812696, "external_assets": 0,
 "sha256": "4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a"}
```

C'est la **référence** de la voie : après chaque étape, `npm test` doit redonner 470 tests, 462 réussis et ces 8 échecs, nommés, sans aucun autre, et `node checks/build.test.mjs` doit rester PASS. Si une base plus récente corrige ces 8 tests (lot « 01 suite »), la référence devient 470 réussis sur 470.

Après `npm test`, `git status --short` est resté vide : aucun fichier suivi modifié, aucun fichier non suivi apparu. Le Spark travaille sur une copie ; sur le Mac, les commandes de cette étape ne font que lire.

## Les 8 tests `campaign-world`, sur le Mac

Sur le Mac, `node --test checks/campaign-world.test.mjs` donne 46 tests, 38 réussis, 8 échecs (113 s) : les mêmes 8 noms, numérotés de 1 à 8. C'est le constat MURS-V1 : le MASTER-PROMPT (§4) compte 8 rouges sur 46 sur la machine d'audit (macOS arm64, Node 24.18), alors que `docs/chantier-moteur/RAPPORT.md` ne les reproduit pas sous Linux x64. Chez moi, ils sont rouges sur le Mac comme sur le Spark. Ils sont hors sujet ici : rien n'est corrigé.

Le test compare `sha256(JSON.stringify(FWorld.create(graine, secteur)))` à `legacyHashes`. Les condensés obtenus ne sont pas les mêmes sur les deux machines arm64, pourtant sous la même version de Node et avec les mêmes fichiers :

| Monde | Attendu (`legacyHashes`) | Mac, macOS arm64 | Spark, Linux arm64 |
|---|---|---|---|
| graine 1, secteur 0 | `2a488a2a…` | `c20144db…` | `0a0aa821…` |
| graine 1, secteur 1 | `530cc4da…` | `76a27de4…` | `ce143e6b…` |
| graine 1, secteur 2 | `360ff380…` | `44f171cb…` | `ad3e0464…` |
| graine 96, secteur 0 | `173c9d30…` | `0c5a4f55…` | `efce7771…` |
| graine 96, secteur 1 | `3ddc4fab…` | `9f76ac8f…` | `2276b74e…` |
| graine 96, secteur 2 | `4b26155e…` | `5c287273…` | `fe6f9e33…` |

La valeur du Mac pour la graine 1, secteur 2 (`44f171cb…`) est celle que cite MURS-V1. La génération des mondes dépend donc de la plateforme au-delà du seul couple arm64 / x64 : des condensés régénérés sur une machine resteraient rouges sur l'autre. C'est à signaler au lot « 01 suite ». Pour la voie boucle, cela confirme le §8 de la mission : le `chainHash` du banc de simulation peut changer d'une machine à l'autre, et seule compte son égalité avec `replay()` dans le même processus.

## Page de la base

Une émulation en mémoire de `tools/build.py` (même liste `modules`, même `'\n;\n'.join`, mêmes `replace` ; rien n'est écrit) redonne la page à l'octet près : 812 696 octets, sha256 `4587dc49…`, gzip 245 325 octets, identiques à `dist/index.html` et à `SIZE.json`, tailles des sources comprises. La base est donc reproductible depuis ses sources, ce que l'outil d'assemblage de l'étape 6 vérifiera à son tour (§7.5, point 4).

## Reprise du relais du Spark

Un relais OpenCode du Spark avait commencé cette voie, étapes 0 à 3, sur la branche `spark/spark-wip/boucle`. Son état initial (commit `a3b2995`) a été pris sur le Spark : il n'est pas repris ici. Le squelette du document `docs/chantier-moteur/modules/boucle.md` en est repris tel quel, après vérification de ses sept titres contre le §7.7 de la mission.

## Écarts relevés à l'étape 0

- La fiche du lot 07 cite `bancs/loop/cadence.mjs` (T1) et `bancs/sched.mjs` (T8), qui n'existent pas dans le dossier d'audit. Les vrais fichiers sont `bancs/stab/cadence.mjs` et `bancs/stab/sched.mjs`.
- Les 8 rouges de `campaign-world` ne viennent pas seulement de l'architecture : macOS arm64 et Linux arm64 donnent des condensés différents (tableau ci-dessus).
- La mission attend `?? .relais/` dans `git status --short` : il n'y a pas de `.relais/` dans ce clone, donc le statut est vide.
