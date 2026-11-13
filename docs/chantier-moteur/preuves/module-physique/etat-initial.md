# État initial — module physique (étape 0, tâche E0-1)

Relevé le 13 novembre 2026 entre 08:06 et 08:10 (heure de Paris), dans le clone `mod-physique` du Mac M5, avant toute écriture. Aucun commit « wip » ni changement en cours : la tâche part de zéro.

## Base

| Commande | Résultat |
|---|---|
| `git rev-parse HEAD` | `71eca61c0b8f3bbaa05b0692d9fa4fd192b9f2db` : c'est la **base** du module |
| `git branch --show-current` | `chantier/module-physique` |
| `git status --short` | vide : arbre propre |
| `node --version` | `v24.18.0` (V8 13.6.233.17-node.50), darwin 27.2.0 arm64, Apple M5, 10 cœurs logiques |

`git log --oneline -3` :

```
71eca61 Intègre le point de reprise laissé par ChatGPT
2f2a1a8 Intègre le dossier d'audit du chantier moteur (PR #2)
ffd8848 docs: préserver le point de reprise après indisponibilité de l’environnement
```

## Absences et présences

- `src/physics.js` : absent (`ls src/physics.js` → « No such file or directory »).
- `git grep -n FPhysics` : aucune occurrence, code de sortie 1. Rien dans le dépôt ne connaît FPhysics.
- `docs/chantier-moteur/bancs/phys/fphys.mjs` : présent, 38 674 octets, 365 lignes, sha256 `378eb857ae2dbef93220e00388b4b79faa1259f1ea6beb337f23ec1066ad7210`, identique au miroir de l'audit (`/Users/david/claude/metal-audit/bancs/phys/fphys.mjs`). C'est la base à porter.
- `docs/chantier-moteur/modules/` : absent ; le dossier est créé par l'étape 1 avec `physique.md`.
- Le point de reprise de ChatGPT (`REPRISE-ENVIRONNEMENT-2026-11-12.md`) ne mentionne aucun travail sur FPhysics.

Aucune condition d'arrêt de la mission (prototype manquant ou `src/physics.js` déjà présent) n'est remplie.

## Référence `npm test`

Commande : `/Users/david/claude/metal-chantier/outils/npm-test-spark.sh /Users/david/claude/metal-chantier/mod-physique`, qui recopie l'arbre par rsync (sans `.git`) sur le Spark (Linux arm64, Node 24 par nvm) et y lance `npm test` complet ; durée 130,6 s.

- `node checks/world.test.mjs`, premier maillon de la chaîne : PASS.
- `node --test` sur les 23 fichiers du script : **470 tests, 462 réussis, 8 échecs**, 0 annulé, 0 sauté, 0 todo.
- Les 8 échecs sont les empreintes historiques connues de `checks/campaign-world.test.mjs`, rouges sous arm64 (Mac comme Spark) et vertes sous x64, que le lot « 01 suite » corrige :
  - n° 108 `legacy seed 1, sector 0: exact pre-campaign world fingerprint`
  - n° 109 `legacy seed 1, sector 1: exact pre-campaign world fingerprint`
  - n° 110 `legacy seed 1, sector 2: exact pre-campaign world fingerprint`
  - n° 111 `legacy seed 96, sector 0: exact pre-campaign world fingerprint`
  - n° 112 `legacy seed 96, sector 1: exact pre-campaign world fingerprint`
  - n° 113 `legacy seed 96, sector 2: exact pre-campaign world fingerprint`
  - n° 114 `campaign mode is strictly opt-in and keeps historical clamping otherwise`
  - n° 115 `the first three campaign worlds preserve historical geometry outside campaign supplies and loadout`
- `node checks/build.test.mjs` n'est pas atteint par la chaîne `&&` du script `test`, à cause de ces 8 échecs. Lancé seul sur le Mac : **PASS** (`html_bytes` 812 696, `external_assets` 0, sha256 `4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a`, égal à `SIZE.json`).

Référence pour toute la suite du module : 462 réussis sur 470, les mêmes 8 échecs, et `build.test` PASS quand il est lancé seul. Le module ne modifie aucun fichier existant, donc ni `dist/index.html` ni `SIZE.json` ne doivent changer.

## Prototype

Les sorties des cinq bancs (`determinism.mjs`, `drift.mjs`, `bench.mjs 3 120 1`, `phys-verif/wake.mjs`, `worldstats.mjs`) sont dans [prototype-reference.txt](prototype-reference.txt). Les chaînes de déterminisme sont exactement celles de la contre-vérification de l'audit : stack10 `37d0ca59`, pyramid55 `56c8b99b`, rubble300 `170702f6`, blast200 `fe961b81`.
