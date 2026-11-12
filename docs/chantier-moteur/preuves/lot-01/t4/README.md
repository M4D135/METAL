# Lot 01 / T4 — Preuves du limiteur de cadence

Ce dossier réunit les preuves déjà produites pour LOOP-09. Il est destiné à être copié dans le dépôt avec T4. Son assemblage ne relance aucun test et ne modifie aucune source. Les logs et les scénarios n’existent ici que sous forme gzip ; les patchs et les copies de travail ne sont pas dupliqués.

## Périmètre et politique retenue

Base du chantier : METAL 0.8.1, commit `63668aca7045e62cd524973b226f21e9ec5703e8`. Les résultats cumulés concernent T2 + T3 + T4, avant le correctif T3 supplémentaire de `pointercancel` et avant réunion de T1 et STAB-V1. La validation finale de la branche réunie appartient à l’intégration.

La contre-vérification de LOOP-09 prime sur les exemples contradictoires de la fiche. Le limiteur mesure la période des callbacks rAF, choisit un diviseur entier voisin de `fréquence / cible` et conserve un intervalle régulier en nombre de vsync. Le libellé **« Cadence visée »** est accompagné de la cadence calculée. Cette politique ne constitue pas un plafond strict.

Dans `lots/lot-01.md`, la formule `N = max(1, round(fréquence/limite))` contredit les résultats annoncés de 60 i/s sur 75 Hz et de 48 i/s sur 144 Hz. Avec la formule retenue et une cible 60, on obtient respectivement **75**, **72** et **55 i/s** sur 75, 144 et 165 Hz. Ces valeurs sont explicitement affichées ; aucune promesse de plafond 60 n’est faite par T4.

### Gouverneur différé, décision déjà prise

La décision de David précisée dans PR2, tête `6a17` signalée par le root, est une **cible constante de 60 i/s en résolution native avec repli calibré à 30 i/s**. La question native/30 est tranchée. Le gouverneur et ce défaut 60 avec repli 30 relèvent des chapitres **06/07/15**. La préférence actuelle `fpsLimit: 0` ne réalise pas encore ce gouverneur. T4 n’ajoute aucun calibrage automatique en plein combat.

## Corrections et reproductions

La première version de T4 alternait les diviseurs près d’un rapport demi-entier, jusque sur des timestamps exacts. Chaque alternance relançait la phase. La correction ajoute une tolérance numérique de `1e-7`, une bande d’hystérésis de ±0,02 autour du demi-entier, et une sélection fraîche à la première calibration, au changement de cible, après une variation de fréquence mesurée supérieure à 2 %, une suspension ou une reprise d’horloge. Une mesure initiale au voisinage d’une égalité choisit le diviseur supérieur ; le diviseur initial 1 n’est pas conservé par erreur.

Les tests couvrent 90/60, 75/30 et 150/60, des origines temporelles 0, 10⁶ et 10⁹ ms, les timestamps exacts ou arrondis, une faible gigue, ainsi que les changements de fréquence et de cible. Les cadences stabilisées sont respectivement 45, 25 et 50 i/s.

Le texte de cadence était aussi bloqué sur la mesure initiale lorsque l’onglet Image était ouvert en pause. Le rafraîchissement inclut désormais le mode `paused`. Le test dans le vrai shell vérifie 72 i/s sur 144 Hz pour cible 60, puis 29 i/s arrondies pour cible 30, puis 55 i/s sur 165 Hz, sans quitter la pause.

## Logs conservés

| Archive | Contenu et résultat |
|---|---|
| `options-before.log.gz` | Tests sur le premier candidat T4, avant stabilisation : 9 réussites, 3 échecs |
| `options-after.log.gz` | Même ensemble après stabilisation : 12 réussites, aucun échec |
| `paused-before.log.gz` | Test du texte en pause avant correction : 1 échec |
| `paused-after.log.gz` | Même test après correction : 1 réussite |
| `integrated-after.log.gz` | Copie T2 + T3 + T4 : 108 réussites, aucun échec, pour options, checkpoints, audio et entrées |

Les durées TAP reflètent les exécutions archivées ; elles ne constituent pas une mesure comparative de performance. Les succès ciblés isolés déjà rapportés sont inclus dans l’ensemble cumulé : leur log supplémentaire n’est pas recopié.

## Les 63 scénarios

`scenarios.json.gz` contient la sortie complète du profilage cumulatif, au format `metal-frame-gate-profile-v2`, avec empreintes SHA-256 des sources comparées. L’outil charge le candidat dans le domaine principal de Node. Il compte des callbacks synthétiques ; il ne mesure ni les FPS d’un appareil ni le temps CPU/GPU.

Les trois horloges sont des timestamps exacts, arrondis à 0,1 ms et soumis à une gigue déterministe de ±0,03 ms. Chaque scénario emploie deux secondes de chauffe puis vingt secondes de mesure. **Les 63 scénarios présentent un seul diviseur, zéro changement de diviseur après chauffe et un intervalle constant en nombre de vsync.**

| Écran / cible | Limiteur historique 0.8.1 | T4 corrigé |
|---|---:|---:|
| 75 Hz / 60 | 37,5 i/s | 75 i/s |
| 90 Hz / 60 | 45 i/s | 45 i/s |
| 144 Hz / 60 | 48 i/s | 72 i/s |
| 150 Hz / 60 | 50 i/s | 50 i/s |
| 165 Hz / 60 | 55 i/s | 55 i/s |
| 75 Hz / 30 | 25 i/s | 25 i/s |

Les trois horloges donnent les mêmes cadences dans ces exemples. Dans le JSON, `beforeFps` désigne le limiteur historique 0.8.1 ; dans les logs `*-before`, « avant » désigne le candidat T4 avant ses derniers correctifs. Ces deux références sont distinctes.

## Reproduction et intégrité

Après intégration des sources, la commande du profilage accepte deux racines de dépôt :

```sh
node tools/frame-gate-profile.mjs <reference-0.8.1> <candidate>
```

La commande ciblée cumulée employée pour le log conservé est :

```sh
node --test --test-reporter=tap checks/options.test.mjs checks/checkpoint.test.mjs checks/audio.test.mjs checks/input.test.mjs
```

`manifest.json` décrit les fichiers, leurs tailles, les empreintes des octets compressés et décompressés, ainsi que les sources candidates identifiées. Le gzip est créé au niveau 9, sans nom embarqué et avec `mtime=0` : recompresser les mêmes octets avec les mêmes versions produit les mêmes archives. Les données décompressées sont les originaux, sans réécriture des chemins ni des durées.

Aucun test physique sur écran, essai navigateur ou mesure GPU n’est revendiqué. Les tests de shell utilisent le vrai code avec ses surfaces factices. La cadence affichée provient des callbacks observés ; elle ne garantit pas le débit soutenable d’un appareil chargé. Les présentes preuves précèdent le build et la suite globale de l’intégration finale.
