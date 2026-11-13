# Point de reprise — chantier METAL — 2026-11-12

## Statut réel

Le chantier est interrompu par une indisponibilité de l’environnement de développement : `exec-server transport closed` / `No usable execution environment is available`. Les outils de navigateur ont également été retirés. GitHub et Sites restent accessibles par leurs connecteurs.

Ce document est un point de reprise documentaire. Il ne contient pas les modifications de code locales et ne constitue pas une sauvegarde de celles-ci. Leur présence doit être contrôlée lorsque l’environnement redevient accessible. Aucun nouveau lot local n’a été publié après l’incident.

## Mission et autorisations

L’utilisateur demande de poursuivre toute l’étude, de faire évoluer le jeu au maximum, de terminer toutes les modifications, puis de fusionner et déployer tout ce qui est validé. L’autorisation de fusion et de déploiement est déjà explicite ; ne pas la redemander.

- Dépôt : https://github.com/M4D135/METAL
- Étude : https://github.com/M4D135/METAL/pull/2
- Référence de l’étude contrôlée : `6a17e08281b70feae33015d7059ef21717666ba3`, branche `chantier-moteur`.
- La PR #2 est encore ouverte ; elle contient la documentation, pas l’implémentation des lots.
- Version du jeu conservée : 0.8.1.
- Distribution autonome `dist/index.html`, aucun actif importé, CDN ou dépendance ; limite brute 1 400 000 octets.
- Une tâche par commit, preuves réelles et une PR par lot. Les arbitrages du MASTER-PROMPT et les contre-vérifications priment sur les anciens prototypes.

## État distant revérifié après l’incident

| Élément | État confirmé |
|---|---|
| `main` | `363473aecd5a96e7f5b8d476c40208d604606c2d` |
| PR #3 | Fusionnée : lot 00 / T1, outillage de mesure ; les autres tâches du lot 00 restent à faire |
| Fusion PR #3 | `ad5f1e4f445438307f6ef92b454a2f44bd2e21f2` |
| PR #4 | Fusionnée : lot 01, reprises et commandes |
| Fusion PR #4 | `363473aecd5a96e7f5b8d476c40208d604606c2d` |
| Validation de la PR #4 | 470/470 tests, distribution 812 696 octets |
| SHA-256 distribution PR #4 | `4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a` |
| Site METAL | Actif, publication précédente ; aucune publication des nouveaux lots |
| Dernière version Sites enregistrée | 7, source `94505882ec2d86892447623bb69f92103eeace1a` |

Liens : [PR #3](https://github.com/M4D135/METAL/pull/3), [PR #4](https://github.com/M4D135/METAL/pull/4), [main](https://github.com/M4D135/METAL/tree/main).

## Emplacement du travail local à récupérer

Racine de la session : `/workspace/scratch/5ba980389006`.

- Dépôt commun : `METAL-chantier` ; ses worktrees partagent les objets Git.
- Étude à jour : `chantier-input/github-6a17/MASTER-PROMPT.md`, `lots/`, `constats/`.
- Les 26 fichiers de constats complets à jour ont été récupérés ; ne pas reprendre les anciennes copies non contre-vérifiées.
- Bancs et prototypes originaux : `chantier-input/metal-audit/`.
- Archive d’origine : `/upload/metal-audit.zip`.
- Les worktrees cités ci-dessous sont locaux ; leur branche ne doit pas être supposée publiée sur GitHub.

### Lot 02 — simulation

Intégration : `METAL-lot02-simulation`, branche `chantier/lot-02-simulation`, base distant `363473a`.

| Tâche | Commit intégré | Résultat acquis |
|---|---|---|
| T1 navigation | `a179399` | Diff numérique local ; 19 arêtes obsolètes corrigées, état conservé |
| T4 LOAD-03 | `3cb9823` | Écriture différée des sauvegardes, coalescence, reprise après erreur, vidage à la sortie |
| T2 sol | `d00073c` | Index SoA ; plus de 25 millions de positions et 1,2 million de pièges vérifiés exactement |
| T3 débris | `d698d82` | Mise en sommeil ; baisse CPU mesurée de 15,6 à 28,8 % dans quatre scénarios |
| T5 génération | `1a8d501` | 200/200 mondes JSON identiques, baisse du coût CPU mesurée |

Source agent : `METAL-agent-sim`, branche `travail/lot02-sim`.

- T1 original : `efcc9539510215d56d8ee4d4171b314b6cb5a31c`.
- T2 original : `71794b3865283b0d0ee8b64df78782bcb4fd2e27`.
- T3 original : `05cb846a8210c5315e64b555f0e1be0a2673586d`.
- T5 original : `ec4a69afd8996a9a31f64d7224c2ccc530fb9549`.
- Dernier commit agent confirmé : `02acc13`, T6 documentaire. À intégrer : les variantes CSR `blocked` / `segmentFree` ont été écartées après régressions sur V2 ; la source est revenue à T5 pour ces variantes.
- T7/T16 : source modifiée, validée, NON COMMITTÉE. SHA-256 de `src/simulation.js` : `6ba2b6f9ea597a81f744f0bd6fd1721398c628adb086464931bda204bdf016f0`.
- T7 : quatre scénarios, deux ordres A/B, quatre rejeux de 1 800 pas avec restauration au pas 900, états/snapshots/compteurs exacts ; 35/35 tests ciblés et 16 cas de zéros signés. Ratios CPU médians orientés : 0,854 / 0,941 / 0,882 / 0,836.
- La commande de création des preuves documentées et du commit T7 a échoué avant démarrage. Ne pas considérer ce commit comme existant.
- Bruts T7 : `lot02-evidence/t7-*`. Outil `tools/lot02-state-proof.mjs` à inclure au commit T7.
- T8 : `tools/lot02-ray-proof.mjs`, `checks/ray-grid.test.mjs` et prototype externe `lot02-bancs/t8-candidate.mjs` préparés seulement ; aucune application ni mesure.
- Restent T8, T10, T11, T12, T17 et les autres tâches non closes. Les changements de format de T9 sont réservés au lot 12.
- Le build, le script global de tests, SIZE et la clôture du lot 02 ne sont pas encore actualisés.

### Lot 03 — rendu et destruction incrémentale

Worktree root : `METAL-agent-delta`, branche `travail/lot03-rendu`, base `363473a`.

- T2 committé : `38e8643`, index dense avec coordonnées Float64 par cellule.
- T2 : 640 requêtes exactement identiques, ordre compris. Ratios CPU médians 0,544 et 0,619 sur deux mondes ; le premier essai insuffisant est conservé.
- T3 NON COMMITTÉ : `src/renderer.js`, `src/game.js`, `checks/renderer-index.test.mjs`, `tools/render-revision-profile.mjs`, preuves `docs/chantier-moteur/preuves/lot-03/t3/`.
- T3 : mises à jour des seules cellules touchées, conservation des caches, invalidation correcte des dépendances de lampes Canvas. 30/30 tests ciblés ; avant correctif, les cinq nouveaux cas échouaient.
- T3 : 28 explosions réelles par monde, 1 792 requêtes exactes au total ; ratios CPU médians 0,484 et 0,506. La comparaison de pixels EGL finale et le rapport restent à terminer.
- Instantanés : `lot03-index-baseline/`, `lot03-t2-snapshot/`, `lot03-t3-snapshot/`.
- L’agent simulation devait ensuite prendre T1 (delta), T4 (chemins sélectifs), T5 (première destruction), puis le lot 04 ; aucun de ces travaux n’a commencé.
- Contrat critique : un restore peut réutiliser ou faire reculer un numéro de révision. `getDelta(sinceRevision)` doit alors forcer `full:true`, même si le numéro paraît égal ; pas de nouveau champ de sauvegarde requis.
- L’index expose `dirtyAABB` ; `null` signifie inconnu/repli global, jamais absence de changement prouvée.

### Lot 05 — rendu

Worktree moteur : `METAL-agent-rendu`, branche `travail/lot05-rendu`.

Worktree raccord jeu : `METAL-agent-rendu-game`, branche `travail/lot05-jeu`.

| Travail | Commit connu |
|---|---|
| Prérequête outillage lot 00, fake GL et banc portable | `064f3e62a36edb538d29af11a4c35232b4310753` |
| T1 filtre soleil | `c984148` |
| T2 portée shader | `f0a0d7b` |
| T3 pools/capacités/FX/raster extérieur | `15d201b` |
| T4 caches conservateurs | `f7ce65d` |
| T5 filtre des acteurs, branche jeu seulement | `99e273c0299953a45215d016b020065c19e45af8` |
| T6 marges adaptatives | Retrouver le SHA dans le journal local |
| T7 poses/mouvement | `5c9fbbd` |
| T8 fabrique FX moteur | `7b50ff71e5bebd75dc952acbfbeb7fbf592037e9` |
| T8 fabrique FX jeu, branche jeu seulement | `779f67f01e8ce04e5ef76c171fa9aeb1d284b0d6` |

- Ne pas réintégrer les commits moteur dupliqués dans la branche de validation jeu.
- T4 : un défaut d’omission de grandes dalles sur format téléphone a été corrigé ; zéro omission sur 180 images et six comparaisons EGL exactes.
- T5 : six tests et trois comparaisons EGL exactes, objets sous la lumière conservés même hors champ.
- T6 : seuil annoncé de reconstruction non atteint dans tous les cas ; limitation documentée, ne pas gonfler les bornes pour masquer le résultat.
- T7 : 10 000 poses Float64 exactes, dix tests, 61 images de dessin identiques.
- Banc CPU T1+T2+T3 : ratios 0,710 / 0,759 / 0,727 / 0,647 ; A/A résiduel environ ±7 %. Pas une mesure GPU.
- Restent T9–T19 et clôture, puis les autres lots de rendu.
- Les agents renderer et son remplaçant ont échoué sur un modèle indisponible avant la panne globale. Leur travail doit être repris depuis le disque.
- Outils réutilisables : `tools/render-egl.mjs`, `tools/render-proof.mjs`, `tools/render/egl.py`, `tools/render/harness.mjs`.
- EGL utilise Mesa llvmpipe : il prouve les pixels, pas les performances d’une carte physique.
- Après intégration du lot 07, ajouter `renderState` à l’environnement d’extraction des modèles du banc.

### Lot 07 — cadence

Worktree : `METAL-agent-loop`, branche `travail/lot07-cadence`, base `363473a`. Tout est encore NON COMMITTÉ.

- T1 : `src/loop.js` (`FLoop`), boucle fixe à 60 Hz, maximum cinq rattrapages, dette temporelle conservée, interpolation de positions et angles immédiats.
- Raccords dans `src/game.js` et `tools/build.py`.
- Tests : `checks/loop.test.mjs`, `checks/cadence.test.mjs`, adaptations `checks/input.test.mjs` et `checks/checkpoint.test.mjs`.
- Premier essai : 83 réussites sur 87, quatre échecs de fixtures qui simulaient de longues images ; journal conservé dans `preuves/lot-07/t1/essai.tap`.
- Les fixtures ont ensuite été corrigées pour avancer à 60 Hz réel ; AUCUNE réexécution confirmée après cette correction.
- À faire : contrôle des intentions sur images sans pas de physique, preuve de 900 pas / quatre mondes, tests et commit T1.
- T2 doit encore supprimer l’écho systématique de sélection d’arme et regrouper les événements après rattrapage.
- T8 : `src/schedule.js` et `checks/schedule.test.mjs`, ordonnanceur image/simulation déterministe préparé ; quatre tests passaient, mais aucun raccord au jeu/build.
- Tout le reste du lot, dont workers et gouverneur, reste à terminer.

### Lots 11 et 11b — audio

Worktree : `METAL-agent-audio`, branche `travail/lot11-audio`. Dernier commit confirmé : `4ca0e78`. Aucun raccord final au jeu, aucune publication.

| Ordre | Commit | Travail |
|---|---|---|
| 1 | `355a904` | LOAD-13 / MIX-09, synthèse découpée |
| 2 | `5425e94` | MIX-11, OfflineAudioContext et banc réel |
| 3 | `1273866` | LOOP-14 / MIX-08, automatisations dédupliquées |
| 4 | `b735ee3` | FEEL-06, cinq recettes d’armes |
| 5 | `c35f40a` | MIX-02, makeup fixe post-compresseur |
| 6 | `d940cb0` | MIX-01, preuves des recettes seules |
| 7 | `7e2a83e` | MIX-V1, tenues de duck |
| 8 | `0ae745f` | MIX-V2, duck proportionnel au volume d’effets |
| 9 | `ed0db79` | MIX-04, preset METAL mesuré |
| 10 | `4ca0e78` | MIX-06, tirs ennemis filtrés à 1 100 Hz, taux 0,85 |

- Dernier contrôle : 41/41 tests audio. Le rendu du preset précède le dernier correctif des ennemis, comme indiqué dans la preuve.
- Vrais rendus Chrome 156 à 48 kHz : quatre calibrations, effets isolés, quatre volumes et quarante rendus de trente secondes.
- Transitoires p10 minimaux : SMG 11,39 dB, pompe 13,12 dB, roquette 9,44 dB.
- Crête maximale 0,7547 ; aucun échantillon pré-écrêteur au-dessus de 0,875, aucune voix volée ; réduction maximale des effets isolés 0,342 dB.
- Nullité LOOP-14 : automatisations 22 668 → 1 028 et 23 086 → 1 456 ; RMS des différences −123,994 et −131,854 dBFS.
- Aucun test d’écoute matérielle revendiqué. Les recettes seules avaient des marges insuffisantes, conservées dans les preuves ; le preset final les corrige.
- Archives : `/workspace/shared/metal-chantier-qa/audio-baseline.json`, `audio-loop14.json`, `audio-recipes.json`, `audio-holds.json`, `audio-preset.json`.
- Fichiers non suivis : `checks/audio-confirmation.test.mjs` (deux tests rouges avant correctif), `tools/audio-order-profile.mjs` (non exécuté). La tentative d’implémentation des nouvelles confirmations a échoué avant modification.
- Restent confirmations FEEL-07, tracker RESTE-09, annonces de boss MIX-05, variations par graine MIX-10, contrôle d’ordre MIX-09, veille MIX-V4, boucles silencieuses MIX-07, ricochet lot 14.
- Raccord requis : charger `audio-recipes.js` après `audio.js`, créer FAudio avec `MetalAudio.options()`, transmettre la graine à `setStage` une fois le support livré.
- Préserver la musique de titre thrash de la version 0.8.1. Ne pas appliquer l’ancien compresseur FEEL-07, remplacé par MIX-02.

### Lot 14 — brèches

Worktree : `METAL-agent-breach`, branche `travail/lot14-breches`, base `1a8d501`. AUCUNE modification écrite ; lecture et conception seulement.

- Règle la plus récente : explosifs, y compris attaques lourdes/piétinements de boss, détruisent tout sauf le sol ; relief détruit localement.
- Armes légères : pas de destruction de murs, murets, toits, piliers ou relief.
- Ajouter une API générique d’armure et un classificateur METAL sans changer les mondes JSON de référence.
- Préserver le comportement générique de FDestruction sans options.
- Les collines et falaises utilisent des octaèdres orientés ; le code actuel supprime un maillage non axial entier au premier recouvrement. Il faut résoudre la destruction locale sans faire disparaître toute la colline ni dégrader sa silhouette.
- Ne pas lancer l’ancien `apply_rule.py` : il modifie les métadonnées du monde contrairement à la stratégie actuelle.
- Une simple règle de dalle mince classerait des ailettes/boulons comme sol : utiliser une vraie classification de plancher.
- Filtrer les ricochets : blindage approprié, pas terrain/herbe/sol. Le son seul ne doit pas décider de la catégorie.
- Les objets fonctionnels marqués indestructibles (ateliers/trophées) demandent une décision qui conserve la jouabilité.

## Arbitrages à préserver pendant la suite

- Simulation déterministe, pas de Math.random ni de décision physique fondée sur l’horloge réelle.
- Mesures Node dans le domaine principal, paires AB/BA ; conserver les essais défavorables. Une optimisation qui n’atteint pas la moitié du gain annoncé est abandonnée honnêtement.
- États et images exacts, sauf amélioration de comportement explicitement voulue. Pas de baisse de qualité ou résolution par défaut.
- Résolution native, 60 stable par défaut ; repli 30 calibré hors combat, 120/144 comme option.
- Simulation fixe 60 Hz, maximum cinq rattrapages, interpolation ; angles immédiats. La simulation reste dans le fil principal.
- Workers : génération, bake de navigation, sérialisation et synthèse audio, selon le MASTER-PROMPT.
- Format des sauvegardes : UNE seule révision au lot 12 ; anciennes sauvegardes lisibles, restauration atomique.
- Espace saut, R esquive, V mêlée, commandes reconfigurables clavier/manette.
- Physique demandée sauf saisir/lancer ; 18 ciels distincts ; lot 18 avancé inclus dans la demande de tout terminer.
- Invalidation sélective de navigation au lot 03/T4, lot 04/T3 absorbé.
- Les huit tests historiques annoncés rouges dans l’audit ne se reproduisaient pas sur les références vérifiées. Ne pas régénérer les empreintes.

## Publication à reprendre après validation

- Site existant : `appgprj_6af4ce74bcbc8191b531d973a81c2cf1`.
- URL : https://ferro-procedural-fps.garden-lake-2660.chatgpt.site
- Audience propriétaire privé confirmée ; la conserver.
- Checkout ouvert : `METAL-hosting-source/.sites-checkout`, résultat d’ouverture `metal-site-source.json`.
- Plugin Sites utilisé : `/home/agent/.codex/plugins/cache/openai-curated-remote/sites/1.1.6`.
- Renouveler le credential Sites avant publication ; l’ancien a expiré. Ne jamais l’écrire dans les fichiers ou les logs.
- Publier le code exact fusionné avec `scripts/site-workflow.mjs`, puis la version correspondante ; aucun nouveau site à créer.
- Helpers GitHub locaux : `github-publication.py`, `import-remote-commit.py`. Utiliser les API Git data avec leases, sans force push.
- La PR #2 de documentation reste à fusionner en tenant compte des preuves ajoutées par le chantier.

## Ordre pratique de reprise

1. Rétablir l’environnement ; inspecter les statuts Git et la présence des fichiers avant tout nettoyage ou reset.
2. Sauvegarder/publier les branches de travail et les modifications non committées après contrôle ; cette note seule n’en conserve pas le code.
3. Finir le commit T7, intégrer T6 documentaire, reprendre T8 et terminer le lot 02.
4. Réexécuter les tests corrigés du lot 07 et finir les preuves T1 ; terminer la preuve de pixels du lot 03/T3.
5. Reprendre les lots 05 et audio depuis leurs commits confirmés ; intégrer leurs raccords sans dupliquer l’historique.
6. Continuer tous les lots restants conformément aux fiches ; ne pas présenter ce point d’arrêt comme la fin de l’étude.
7. Build complet, tests globaux, contrôles de sauvegarde/déterminisme/pixels/audio, SIZE, VALIDATION et RAPPORT.
8. Fusionner les lots validés et la documentation, puis publier le Site existant et vérifier la version effectivement servie.

Les validations locales listées sont celles terminées avant l’incident. Leur présence sur disque et l’intégration finale doivent être vérifiées à la reprise.
