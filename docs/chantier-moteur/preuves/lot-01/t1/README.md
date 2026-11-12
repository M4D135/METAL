# Lot 01 / T1 — preuve de livraison

## Résultat

**Build réussi ; `npm test` complet réussi : 432/432 tests TAP, zéro échec, zéro test ignoré.** Les contrôles supplémentaires de génération (`world.test.mjs`, 18 cas) et du document distribué (`build.test.mjs`) passent également.

Validation exécutée le 12 novembre 2026 dans le worktree isolé T1, sur la base `63668aca7045e62cd524973b226f21e9ec5703e8` plus le patch T1. L’intégration sur `chantier/lot-01-correctifs`, après le commit d’outillage lot 00 / T1 `8098725e5b85cf44996d5379fb215643b2615e46`, conserve exactement les 44 fichiers de sources, tests, configuration et build comparés. La suite complète n’a pas été relancée pour cette copie identique. Les autres tâches du lot 01 restent distinctes.

La [baseline main archivée](../../lot-00/baseline-main-tests.log.gz) donne 422/422 dans ce même environnement. T1 ajoute dix tests, ce qui donne les 432 tests observés ici ; un test existant est également enrichi.

## IDs traités et limites de portée

| ID | Statut et contenu livré |
| --- | --- |
| LOAD-01 | Retrait du seul rejet d'intersection des gravats au repos ; reprise d'une copie sans gravats ; équipement d'entrée conservé au repli ; nouvelle sauvegarde écrite après relance réussie. |
| LOOP-01 | Absorbé pour la reprise et le repli sans gravats. Les variantes physiques et la sérialisation `resting:false` ont été écartées par l'arbitrage et ne sont pas appliquées. |
| LOOP-V2 | Absorbé : le prédicat compatible avec les gravats réels est livré, et le dernier point refusé est conservé dans un slot `-refuse` remplaçable avant tout écrasement du point actif. |

Seuls `src/simulation.js`, les portions de reprise de `src/game.js` et `checks/checkpoint.test.mjs` appartiennent au patch logique. Le build autorisé a régénéré `dist/index.html` et `SIZE.json`. La livraison constitue un seul commit local T1, sans push, déploiement ou changement de version.

## Preuves de reprise mesurées

Les bancs utilisent les modules dans le domaine principal de Node. Les sources candidates ont été réellement chargées depuis le worktree, sans leur injecter le correctif en mémoire.

| Scénario LOAD | Points | Acceptés avant | Acceptés après | JSON identiques après, `recover:false` |
| --- | ---: | ---: | ---: | ---: |
| walk l:0 | 8 | 0 | 8 | 8 |
| walk c:9 | 8 | 1 | 8 | 8 |
| rocket l:0 | 8 | 6 | 8 | 7 |
| rocket c:9 | 7 | 0 | 7 | 7 |
| **Total** | **31** | **7** | **31** | **30** |

**Les 31 snapshots sont identiques en valeurs et structure JSON ; 30 sont aussi identiques octet pour octet.** Le premier point du sous-banc `rocket l:0` contient un butin `salvage` dont les clés `ammo` et `armor` sont sérialisées après `x/y/z/taken` lors de la restauration, alors qu'elles les précèdent à l'origine. Le diagnostic récursif ne trouve aucune différence de valeur ou de structure. Ce chemin de sérialisation est inchangé par T1. Le détail est dans `logs/load-first-difference.txt.gz`.

Cette égalité sémantique porte sur le snapshot JSON, pas sur une représentation binaire de toute la mémoire du simulateur. Le résultat historique 29/31 obtenu avec `recover:true` n'est pas présenté comme le résultat actuel : ce mode applique en plus un filtre de sécurité aux projectiles proches.

| Monde LOOP, motif b | Refus avant / essais | Refus après / essais |
| --- | ---: | ---: |
| classic-0 | 3 / 11 | 0 / 11 |
| campaign-0 | 3 / 11 | 0 / 11 |
| campaign-9 | 1 / 11 | 0 / 11 |
| campaign-10 | 10 / 11 | 0 / 11 |
| **Total** | **17 / 44** | **0 / 44** |

Le contrôle après patch réussit avec un monde régénéré et avec le même objet monde. Le banc atteint 33 secondes simulées avec l'argument 30 en raison de son découpage en blocs ; onze points par monde ont effectivement été examinés.

Les nouveaux tests contractuels couvrent en outre les vrais mondes générés l:0 et c:9 de campagne V2, graine 96 : trois murs par monde, une roquette puis 300 pas à 1/60 s. Les six restaurations réussissent avec un snapshot exactement identique et `recover:false`.

## Sauvegarde refusée et échecs d'écriture

Le slot `ferro-expedition-v2-refuse` garde le dernier point rejeté, même si la première sauvegarde `-before-ascension` existe déjà. Cette première sauvegarde n'est pas remplacée.

Les tests du shell emploient la vraie simulation et la vraie validation ; le navigateur, le rendu et l'audio sont simulés. Ils vérifient notamment :

- une erreur injectée pendant la relance empêche tout remplacement du slot actif ;
- une erreur d'écriture du slot `-refuse` conserve le JSON source en attente et bloque l'écrasement du point actif ;
- le checkpoint automatique suivant doit lui aussi préserver la source avant d'écrire ;
- lorsque le stockage redevient disponible, `-refuse` est écrit avant la nouvelle sauvegarde active ;
- le repli conserve exactement l'équipement d'entrée classique, campagne V1, campagne V2 avec récompenses et améliorations de boss, ou ancien `entryInventory` ;
- la reprise réparée conserve position, santé, progression et destruction, sans modifier le snapshot refusé.

Le garde-fou de stockage est également utilisé avant l'effacement du point actif. Les contrôles d'appui, de bornes et de validation atomique des gravats restent en place ; les tests existants correspondants passent dans la suite complète.

## Commandes et résultat final

```sh
python3 tools/build.py
npm test
```

Les deux commandes terminent avec le code 0. La commande complète `npm test` a duré 191,398 secondes, dont 154,344 secondes pour la partie TAP. Ces durées documentent l'exécution et ne servent pas à revendiquer un gain de performance.

Avant cette validation complète, les suites ciblées avaient passé 174/174, puis le fichier checkpoint final 50/50. Les neuf premières régressions ciblées, comprenant un test existant enrichi, échouaient sur les sources de référence ; leurs journaux sont conservés.

## Build et invariants

| Élément | Résultat |
| --- | --- |
| Version | 0.8.1, inchangée |
| HTML brut | 804 329 octets |
| Variation depuis la base | +954 octets |
| Gzip du build | 242 483 octets, +258 octets |
| Budget HTML | 1 400 000 octets |
| Assets externes | 0 |
| SHA-256 HTML | `f52b93562b0566dbe167410e5099af18860190ffc14dd8a7575bed722e62ebfd` |
| SHA-256 patch logique | `9731bcb2c87208fc67cc833286d25e41d0a2a8b2607fd426bf6cbbb1caf5d0af` |

`audio.js`, `music.js`, le HTML source et les styles sont identiques octet pour octet à la base. Le cycle de vie de la musique du titre dans `game.js`, la physique et le format des sauvegardes sont inchangés. La suite complète couvre également les tests audio/musique existants.

Aucun essai navigateur, écoute réelle ou appareil physique n'a été réalisé pour cette livraison T1 ; les résultats ne prouvent pas des FPS réels ou une qualité sonore entendue.

## Contenu du dossier

- `manifest.json` : IDs, mesures, provenance, compteurs de tests, commandes, SHA-256 des sources et des journaux.
- `execution.json` : dates, durées et codes de retour des deux commandes finales.
- `file-hashes.json` : empreintes des sources et des artefacts de build.
- `logs/*.gz` : seize sorties brutes utiles. Compression gzip déterministe : date d'en-tête nulle, aucun nom d'origine, niveau 9. Le manifeste porte les tailles et SHA-256 avant et après compression.
- `SHA256SUMS` : contrôle d'intégrité du dossier.

Le [préflight MURS-V1](../preflight/README.md) documente séparément les huit tests historiques et la baseline main. Le [rapport du chantier](../../../RAPPORT.md) cite le master de la PR #2 au commit `6a17e08281b70feae33015d7059ef21717666ba3`. Les journaux bruts et les manifestes ci-dessus constituent les preuves durables de cette livraison.
