# Étape 8 — banc audio (facultative) : preuves

Mac M5 (arm64, macOS 27.2.1), Node v24.18.0, branche `chantier/module-boucle`, parent `c745dc9` (étape 7), base `71eca61`.
Classe de preuve : état identique (PCM et jeu inchangés) ; les durées sont une information. Constats : STAB-07 (lot 07
T8), LOAD-13 ; arbitrage « FEEL-06, FEEL-07, LOAD-13, LOOP-14, BOSS-04 ». Mesures et lecture : document, section 4.6.
Condition de la mission : les étapes 0 à 7 sont vertes (commits `bed0cb2` à `c745dc9`, 50 tests du module verts).

## Origine de l'outil et conformité au §7.8

Le relais ne l'avait pas écrit : `git cat-file -e spark/spark-wip/boucle:tools/boucle-banc-audio.mjs` sort en code 128.
L'outil est écrit depuis la mission. Le prototype de l'audit (`bancs/stab/sched.mjs`) n'est repris ni dans l'outil ni
dans le module : il sert de banc de départ.

| Exigence (§7, §7.8) | Outil |
|---|---|
| `FAudio` de `loadRealm({root, modules: ['music', 'audio'], realm: 'main'}).window.FAudio` | oui ; FSchedule par `loadRealm({root, modules: ['schedule'], realm: 'main'})` |
| horloge `() => { const u = process.threadCpuUsage(); return (u.user + u.system) / 1000; }` | oui, la même expression, aussi passée à `FSchedule.create({now})` |
| tampons : chaque nom de `effectNames`, variantes 0 et 1, seulement 0 pour `motor:*` ; 64 sur main | oui : 34 noms, 64 tampons |
| chauffe : `FAudio.synthesize(nom, variante, 22050)` sur chacun | oui ; ce PCM sert de référence |
| A : lots de 2 noms avec toutes leurs variantes, une tranche par lot, chronométrée | oui (17 tranches) |
| B : une tâche « image » par tampon (priorité 6, coût 2), `while (S.count('frame')) tranches.push(S.pump(4))`, puis `stats.maxSliceMs` | oui ; clé `'pcm:'+nom+':'+variante` (point 12 du plan) |
| par répétition : nombre de tranches, plus longue, total | oui, avec la médiane et les comptes au-delà de 4, 8, 16,7 et 32 ms |
| racine par `fileURLToPath(new URL('../', import.meta.url))` ; écrit dans `preuves/module-boucle/` ; court résumé ; code 1 si un critère tombe | oui ; seulement `banc-audio.json` |
| le JSON commence par `schema`, `node`, `arch`, `platform`, `cpu`, `loadavg` ; aucun tableau par image | oui ; aucune tranche une à une |

**Écart avec le §7.8.** 5 répétitions au lieu de 3 : la règle du chantier demande au moins cinq répétitions,
appariées et alternées (A puis B aux répétitions impaires, B puis A aux paires). Les trois premières sont celles de la
fiche.

**Ajouts, pour information** (aucun ne change un critère du §7.8) : le sha256 du PCM et sa comparaison à chaque
construction ; `bank` (échantillons, octets, durée de la chauffe à froid) ; pour B, la tâche la plus longue et son
tampon, `ran`, `skipped`, `overrunMs` ; les trois lots et les trois tampons les plus lourds ; la taille et le sha256
de `audio.js`, `music.js` et `schedule.js`.

Critères qui font sortir en code 1 : PCM différent dans une construction ; dans B, un tampon non construit, construit
deux fois ou en erreur ; dans A, un nombre de tranches autre que 17 ; dans B, une tranche ou une tâche au-delà de
32 ms (lot 07 T8).

## Avant

- Parent `c745dc9` : ni outil ni JSON (`git show c745dc9:tools/boucle-banc-audio.mjs` : code 128).
- Banc de départ (commande du plan, première moitié) : `node /Users/david/claude/metal-audit/bancs/stab/sched.mjs
  /Users/david/claude/metal-chantier/mod-boucle`, juste avant chaque passe de l'outil. Le prototype charge `music.js` et
  `audio.js` par `vm.runInThisContext` (domaine principal) et mesure le temps CPU du fil.

| Lancement (charge 1 min) | Lots actuels : tranches ; plus longue ; total | Prototype à 4 ms : tranches ; plus longue ; tâche la plus longue |
|---|---|---|
| 1er lancement (11,57) | 17 ; 24,59, 25,56, 27,78 ms ; 103 à 111 ms | 22 à 24 ; 12,48 à 15,63 ms ; 12,48 à 14,21 ms |
| 3 passes sous charge (3,15 à 3,29) | 17 ; 22,83 à 35,10 ms ; 92 à 146 ms | 22 à 25 ; 11,55 à 16,33 ms ; 11,55 à 14,97 ms |
| 3 passes au calme (1,95) | 17 ; 18,08 à 20,39 ms ; 72 à 82 ms | 17 ou 18 ; 9,75 à 11,24 ms ; 8,40 à 9,79 ms |

Pré-mesure du chef de lot (même Mac, prototype) : 17 tranches, 18,1 à 18,3 ms, total 73 à 79 ms ; prototype à 4 ms,
17 ou 18 tranches, 9,8 à 10,6 ms. Les passes au calme la reproduisent.

## Après

`node tools/boucle-banc-audio.mjs`, sept passes sur le Mac et trois sur le Spark, toutes en code 0. Le JSON rangé est
la troisième passe au calme :

```
A (lots de 2 noms) : 17 tranches ; plus longue 18.1 ms (18.0 à 18.9) ; total 72.8 ms
B (FSchedule, pump(4)) : 17 à 19 tranches ; plus longue 9.8 ms (9.7 à 10.0) ; tâche la plus longue 8.4 ms (break:glass, variante 0) ; total 73.0 ms
PCM : 64 tampons (34 noms), 1892864 octets, sha256 12eb48d9… ; identique dans les 11 constructions
bilan : ok — plus longue tranche -46 % (médiane de 5 rapports appariés), total x1.00 ; seuil 32 ms ; charge 1.88 / 3.55 / 3.77 ; 0.9 s
```

| Passe (charge 1 min) | A : plus longue, médiane | B : tranches ; plus longue ; tâche la plus longue (médianes) | Rapport B/A médian | Écart | Total B/A |
|---|---|---|---|---|---|
| préliminaire 0 (3,40, après 11,57) | 29,04 | 23 ; 13,03 ; 13,02 | 0,455 | −54,5 % | 1,035 |
| préliminaire 1 (3,15) | 27,83 | 23 ; 14,02 ; 13,01 | 0,485 | −51,5 % | 1,002 |
| préliminaire 2 (3,29) | 40,38 | 25 ; 20,34 ; 18,83 | 0,504 | −49,6 % | 0,999 |
| préliminaire 3 (3,29) | 27,72 | 23 ; 14,01 ; 12,95 | 0,505 | −49,5 % | 1,003 |
| 1 (1,95) | 18,87 | 18 ; 10,50 ; 8,83 | 0,552 | −44,8 % | 1,011 |
| 2 (1,95) | 19,06 | 18 ; 10,98 ; 9,30 | 0,564 | −43,6 % | 1,004 |
| **3, rangée (1,88)** | **18,06** | **17 ; 9,79 ; 8,43** | **0,540** | **−46,0 %** | **1,001** |
| Spark 1 à 3 (1,40 à 1,45) | 20,61 à 21,00 | 17 ou 18 ; 11,00 ; 10,00 | 0,524 | −47,6 % | 0,999 à 1,012 |

- Les passes préliminaires ont tourné avec la même mesure ; seul l'affichage du résumé a changé depuis (une valeur
  seule quand le minimum égale le maximum).
- **PCM** : sha256 `12eb48d9f0ca0e7da0228390f3ce4c9142a9ca20c725e2dd9ddbc9f370f3d50e` dans les 11 constructions de
  chacune des 10 passes, Mac et Spark : 473 216 échantillons, 1 892 864 octets.
- **Spark** (Linux aarch64, 20 cœurs, Node v24.18.0) : seuls l'outil, `tools/realm-loader.mjs`,
  `tools/proof/instrument.mjs`, `src/music.js`, `src/audio.js` et `src/schedule.js` sont copiés sous
  `~/metal-tests/module-boucle-mb8/`. L'horloge du fil y avance par pas de 1 ms (comptage au tic ; mesuré : pas de
  998 à 1 003 µs), d'où les valeurs rondes. Ses JSON ne sont pas rangés.
- **Coût de l'horloge** : `process.threadCpuUsage()` coûte 2,2 µs par appel sur le Mac, et 0,19 µs sur le Spark ;
  une construction B en fait 209 à 219, soit moins de 0,5 ms, comptés dans les tranches.
- **Gain** : la plus longue tranche baisse de 44 à 46 % au calme (« environ −45 % » attendu), de 49 à 55 % sous
  charge, de 48 % sur le Spark. Plus de la moitié du gain annoncé, partout : rien à abandonner.

**Passe à part : le plafond de chargement** (`preuves/module-boucle/etape-8-plafond.mjs`, depuis la racine ; n'écrit
rien). Protocole B avec `pump(4)`, `pump(8)` et `pump(12)` en alternance, 5 répétitions ; trois passes, charge 2,77 :

```
pump(4) : 17 à 20 tranches (médiane 18) ; plus longue 9.8 ms (9.7 à 10.7) ; au-delà de 16,7 ms : 0 au plus ; total 73.0 ms ; PCM identique
pump(8) : 9 à 10 tranches (médiane 9) ; plus longue 13.3 ms (13.3 à 13.7) ; au-delà de 16,7 ms : 0 au plus ; total 73.1 ms ; PCM identique
pump(12) : 7 à 7 tranches (médiane 7) ; plus longue 13.3 ms (13.2 à 14.3) ; au-delà de 16,7 ms : 0 au plus ; total 73.0 ms ; PCM identique
```

Les deux autres passes donnent les mêmes médianes à 0,2 ms près. Leurs étendues vont jusqu'à 11,1 ms pour `pump(4)`,
de 10,5 à 13,7 ms pour `pump(8)` (jusqu'à 11 tranches) et jusqu'à 14,4 ms pour `pump(12)` ; totaux de 72,7 à 74,6 ms.

## Tests

- `node --test --test-reporter=tap checks/floop.test.mjs checks/fschedule.test.mjs` : 50 réussis, 0 échec, 6,9 s.
  Aucun test n'est touché à cette étape. Le banc n'entre pas dans `npm test` (`package.json` inchangé, raccord).
- `npm test` complet sur le Spark (Linux aarch64, Node v24.18.0, `outils/npm-test-spark.sh`), sur l'état final de
  l'outil et des preuves : 470 tests, 462 réussis, 8 échecs, 131,4 s de `node --test`. Ce sont les 8 échecs de la
  référence de l'étape 0 (`not ok 108` à `115` de `checks/campaign-world.test.mjs`). Aucun nouvel échec. La chaîne
  `&&` s'arrête avant `node checks/build.test.mjs`, lancé à part dans l'arbre jetable : PASS.

## Le jeu est inchangé

- Fichiers de l'étape : `tools/boucle-banc-audio.mjs` (9 527 octets), `banc-audio.json` (7 624),
  `etape-8-plafond.mjs` (3 032) et cette note sont créés. `docs/chantier-moteur/modules/boucle.md` est complété :
  section 4.6, point 12 du plan (5.12), limites 7 et 8, écarts de l'étape 8 (7.2), et des renvois en 1, 2.8 et 4.
  Aucun fichier du jeu n'est touché.
- `python3 tools/build.py` dans un arbre jetable au parent (`git worktree add --detach
  …/verif/module-boucle-MB-8-avant c745dc9`, avec les fichiers de l'étape recopiés, retiré ensuite) : code 0 ;
  `dist/index.html` et `SIZE.json` identiques à ceux du clone (`cmp`) ; 812 696 octets (budget 1 400 000), sha256
  `4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a` ; `FLoop` et `FSchedule` absents de la page.
  Rien à commiter dans `dist/` ni dans `SIZE.json`.
- Relancer le banc réécrit `banc-audio.json` (charge, durées). Le document cite la passe rangée ; le sha256 du PCM, le
  nombre de tampons et les critères ne changent pas d'une passe à l'autre. À relancer au raccord si `audio.js`
  change (lot 11).
