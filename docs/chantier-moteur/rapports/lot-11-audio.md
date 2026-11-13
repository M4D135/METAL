# Lot 11 — Audio, armes puissantes et mixage

Branche `chantier/lot-11-audio`. Agent : OpenCode, modèle local du Spark.
Base du brief : `1336bdb` (`wip(spark-audio)`). Base intégrée du dépôt : `35c654a`
(rapport lot 02, version 0.9.1). Preuves : `docs/chantier-moteur/preuves/lot-11/`.

## Référence de départ

`npm test` lancé sur une arbre de travail détachée propre de `d7e7bed` (l'état **sans** le
wip Spark) : **506 réussis, 0 échec** (journal `.relais/npm-test-ref.log`). Le choix de
`d7e7bed` plutôt que de l'arbre de départ est dit ici sans détour : l'arbre de départ est
**rouge**, le test `checks/audio.test.mjs:203` laissé par le wip Spark attend
`await prepare(0)` avant d'avoir amorcé les `setTimeout` et pendouille. Cet état rouge
n'est donc pas la référence ; la référence est le dernier état vert, et le test pendouillant
a été réécrit en T1.

À la fin du lot : **516 réussis, 0 échec**. Aucun test qui passait n'a échoué. Deux tests
ont été modifiés, chacun dans le commit du changement voulu qu'il acte (dit dans la tâche
concernée). Aucun test affaibli.

Machine : Linux arm64, Node 24.18, Chrome 151 sans interface. Toutes les mesures CPU dans
le domaine principal de Node (`tools/realm-loader.mjs`, jamais `node:vm`), comparaisons
appariées et alternées, médianes. Pas de réseau, machine partagée : le bruit est réel et
les passages contraires sont conservés dans les fichiers de preuve.

## T0 — outillage de preuve (`1461e24`, fait)

`tools/audio-prep-profile.mjs` (tranches réelles du minuteur de `FAudio.prepare` et de
`FMusic.warmup('title')`, empreintes sha256 de la banque et des modules en ordre direct et
inverse, identité du chemin découpé contre la construction directe) ; `job=ab` ajouté au
banc MIX (même scène rendue avec la source A puis la source B, telles quelles, sans
réglage imposé) avec `diffPeakDbFS`, `diffRmsDbFS`, appels AudioParam des deux côtés,
critère MIX-08 et bruit du banc mesuré dans la même page ; scène `t` (écran titre).
Aucun `src/`, aucun `dist/`, aucun `SIZE.json` touchés. Preuves : `preuves/lot-11/t0/`.

## T1 — lots de synthèse bornés en temps (`93e67e8`, fait — LOAD-13, MIX-09)

Repris du wip Spark, corrigé et recommitter (`git reset --soft HEAD~1`, autorisé par le
brief). Le moteur de synthèse devient reprenable (`synthJob` avec `step`/`seal`),
`warmBank` avance sur un budget de temps de 8 ms au lieu d'un compte d'effets, et
`moduleFor` est découpé en 4 sous-tâches reprenables (`moduleSteps` : kit, compose,
serialize, decode). La banque reste bit à bit la synchrone.

- Tranche maximale de la préparation : **45,19 → 17,46 ms (−61 %)** ; tranches 25 → 37 ;
  total 298,9 → 274,8 ms. `node tools/audio-prep-profile.mjs .relais/ref-base . --reps 7`.
- Identité : banque `33ab837bd0d7…` avant et après, `sameBankAB`, `sameModulesAB`,
  `buffersDifferent 0`.
- Tests : le test pendouillant du wip réécrit, `console.log('DEBUG slices'…)` retiré, test
  MIX-09 (ordre direct contre inverse) ajouté.
- Preuves : `preuves/lot-11/t1/prep-ab.json`.

## T2 — dédoublonnage des automatisations d'ambiance (`d7e7bed`, fait — LOOP-14, MIX-08, RESTE-09 point 5)

Assistant `approcher(param, valeur, instant, tau)` dans `src/audio.js`, mémoire par
`AudioParam` (`WeakMap` propre à l'instance) de la dernière cible et de la dernière
constante envoyées ; `setTargetAtTime` n'est appelé que si l'une change. **Égalité stricte,
sans seuil ni renvoi périodique** : les seuils proposés par la fiche échouent au test de
nullité de MIX-08, c'est écrit dans le message de commit. Les 18 paramètres persistants
d'ambiance y passent (vapeur, 4 moteurs, vent, envoi d'écho), coupures du vent comprises.
Maître, bus musique, bus effets et ambiance, voix et musique : inchangés.

- Appels AudioParam par image : **34 → 5,4** ; banc RESTE-09 **34,2 → 2,6**.
- `job=ab` dans Chrome : (c) 64 479 → 9 485 appels, écart −88,67 dBFS crête / −124,15 dB
  RMS ; (a) 63 479 → 7 100, −107,47 / −130,84 ; (t) 38 280 → 3 711, −128,93 / −154,88.
  Critère MIX-08 (RMS ≤ −110 dB, crête ≤ −80 dBFS) tenu partout.
- Journal des automatisations, scènes a, b, c, d, t : B = A privé des seuls
  `setTargetAtTime` répétés, sur les 18 paramètres d'ambiance ; tous les autres identiques.
- Écart avec la fiche : `setMachinery` et `setSteam` gardent leur mise à jour immédiate
  (`audio.test.mjs:90-92` et `:188`, pause sans tick) ; la mémoire absorbe la réémission de
  `tick` dans la même image.
- Aucun test existant modifié ; un test ajouté, rouge sur le parent et sur des mutants.
- Preuves : `preuves/lot-11/t2/`.

## T3 — table de recettes d'armes (`246cbeb`, fait — FEEL-06, MIX-01, MIX-06)

Le squelette existait (wip Claude `4296a73`) : il a été **vérifié, corrigé et mesuré**, pas
recopié. `src/audio-recipes.js` porte la table METAL (crête, bande 120–500 Hz, claquement
de mécanisme, salle) et un générateur `layered` ; `FAudio.create(options)` reçoit la table ;
le raccord `tools/build.py` + `src/game.js` charge les recettes quand la racine les a.
Le filtre DC `exp(-2π·25/rate)` est appliqué au taux réel.

- Bande 120–500 Hz au-dessus du bruit de base : pistolet **+4,99 dB**, SMG +7,96, pompe
  +11,43, roquette +12,22, grenade +12,21.
- Chrome sans interface, `OfflineAudioContext` 48 kHz : aucun échantillon au-dessus de
  0,875, aucun écrêtage, aucune voix volée ; SMG +5,80 → **+11,98 dB** au-dessus de la
  musique (MIX-06).
- Tir isolé pendant un tir isolé : pire réduction **−1,43 dB** (pompe), critère ≤ 1,5 dB
  tenu.
- Avec la table, exactement **10 tampons d'armes changent** ; sans table la banque reste
  `33ab837bd0d7…` (celle de la base) — vérifié dans le profil.
- Correction du banc MIX, sans quoi la preuve serait fausse : l'ancre de crochet était
  posée sur `synthesize`, que le chemin préparé n'appelle plus depuis T1 ; avec la table
  `doom` rendait **silencieusement la banque v0.2**. L'ancre est déplacée sur `synthJob`.
- Preuves : `preuves/lot-11/t3/` (`feel06.mjs`, `feel06.json`, `matrix-t3.json`,
  `matrix3-t3.json`, `iso-t3.json`, `calib.json`, `prep-jeu.json`, `wav-sha256.json`,
  `run-linux.py`, `README.md`).

## T4 — confirmations de touche et de kill (`f70b785`, fait — reste de FEEL-07)

Touche : deux clics tonals 2 800 et 4 100 Hz, décroissance 11 ms, 55 ms, niveau 0,30,
montée d'un demi-ton par touche consécutive (jusqu'à +6), remise à zéro après pause.
Kill : thunk 90 → 50 Hz de 70 ms plus clic à 3 200 Hz dans **un seul** tampon de 200 ms,
niveau 0,45.

Brique moteur nouvelle = script autonome qui ne sait rien de METAL : `FAudio` reçoit une
option **générique** `options.extras` et prépare ces tampons avec la banque, jamais pendant
le jeu. Les noms restent du contenu METAL (`MetalAudio.extras`). Sans options, `hit()` et
`kill()` gardent le click et le body+`impact:dirt` de la v0.2 et la banque reste les
64 tampons `33ab837bd0d7…`. Le compteur de touches vit dans `FAudio` sur
`ctx.currentTime` : rien dans la simulation, aucun champ de sauvegarde.

- Centroïde de la touche 5 333 Hz (clic v0.2 : 4 401) ; kill 80,2 % d'énergie sous 120 Hz,
  centroïde 205 Hz (corps v0.2 : 1 261). Règles de forme tenues (crête 0,84,
  |dc| ≤ 0,00291, queue ≤ 0,0042).
- Chrome, quatre scènes : aucun échantillon au-dessus de 0,875, aucune voix volée, crête
  maximale inchangée à 0,009 près.
- **Test existant relevé, changement voulu** : MIX-01 attendait 64 tampons avec la table
  METAL, elle est à **68** (les 4 confirmations préparées avant le jeu). Aucune règle de
  forme relâchée. Les 4 tests FEEL-07 ont été écrits avant l'implémentation, rouges.
- Preuves : `preuves/lot-11/t4/` (`confirm.mjs`, `confirm.json`, `matrix-t4.json`,
  `README.md`).

## T5 — la musique n'alloue plus par image (`982418a`, fait — RESTE-09 points 2 et 3)

`tick()` et `stopAll()` parcourent `voices` sans le copier (`Array.from`) : retirer
l'entrée courante d'un `Set` pendant un `for…of` est défini et conserve l'ordre d'insertion.
`schedule()` remplit 4 enregistrements préalloués par instance au lieu d'en créer 4 par
ligne. Le `Set` est gardé plutôt qu'un tableau à retrait par échange : `delete` en O(1) et
`stats.activeVoices` restent exacts.

- Allocations de `FMusic.tick` (médianes de 7 allers-retours, outil ajouté
  `tools/music-alloc.mjs`, domaine principal, instance chauffée) : monde 0
  **1,321 → 1,027 Mo/min (−22,3 %)**, monde 1 **2,450 → 2,017 (−17,7 %)**, titre
  **3,121 → 2,579 (−17,4 %)**. La fiche attendait −21 % et demandait d'abandonner sous
  −10,5 % : atteint sur les trois scènes.
- Notes et lignes sur 60 s inchangées (1 071/1 202 en monde 0, 2 726/2 043 en monde 1).
- Identité : journal des automatisations **identique** sur a, b, c, d, t (0 écart,
  0 événement retiré, `stats` égaux) ; sha256 des trois modules et du module du titre
  inchangés (`88dfafde…`), mêmes titres, BPM et durées.
- `job=ab` c, a, t : crête au plancher de bruit du banc (−132,45 dBFS), test nul reçu.
  **Consigné honnêtement** : la scène du titre affiche −96,75 dBFS, mais le contrôle avec
  deux sources **identiques** (`ab-t5-aa.json`) donne −128,93 dBFS avec `identical:false` —
  le banc `ab` n'est pas bit à bit ; c'est le journal, exact, qui tranche.
- Preuves : `preuves/lot-11/t5/`.

## Au-delà de la fiche

### au-delà 1 — la première tranche d'un effet n'attend plus 256 échantillons (`ff20e35`, fait)

Le budget de tranche était vérifié **avant** un bloc, avec la durée du bloc précédent comme
prédiction ; le premier bloc de chaque effet partait donc sans contrainte (`blockMs` valait
0) à 256 échantillons, et sur les effets les plus chers un seul bloc coûtait jusqu'à 19 ms.
La taille de bloc est maintenant calculée à l'ouverture de l'effet depuis un coût mesuré
(la variante déjà rendue pour ce nom, sinon le pire débit observé) pour viser 2 ms de
travail, bornée entre 16 et 256 échantillons, et rétrécie si un bloc dépasse sa cible.
Sans horloge (rigs de test, royaumes froids) le bloc reste à 256 : rien ne dépend du temps
mural quand l'horloge manque. La taille de bloc ne touche pas au son (`rand()` appelé une
fois par échantillon, état de filtres persistant, `seal()` une seule fois à la fin).

- Écart apparié médian sur la tranche maximale : **−19,1 %** (5 paires sur 7 en faveur
  d'après ; les deux contraires, +14,0 % et +15,2 %, restent dans le bruit) ; médianes
  20,49 → 18,91 ms (−7,7 %).
- Tranches au-dessus de 8 ms : **22 → 16 (−27 %)**, médiane appariée −5 tranches.
- Effets les plus lourds : `break:glass#1` 32,5 → 12,9 ms, `break:glass#0` 29,8 → 13,4 ms.
- Total de préparation 347,7 → 336,6 ms (−3,2 %) : le découpage ajoute des reprises, le
  gain est sur la régularité, pas sur la durée totale.
- Identité : `bankSha256 acfb0222190905ab…` identique des deux côtés, 0 tampon différent
  sur 64, modules inchangés.
- Preuves : `preuves/lot-11/au1/` (`prep.json`, `README.md`).

### Deux pistes non réalisées, et pourquoi

Le brief autorise jusqu'à trois optimisations ; une seule a été faite, les deux suivantes
sont notées plutôt que bricolées en fin de course.

1. **Recettes du jeu reprenables.** Une recette fournie par le jeu est une fonction opaque
   que le moteur ne peut pas couper : c'est une propriété voulue de l'API. Elle borne
   aujourd'hui la tranche maximale — `rocket#1` reste à 21,4 ms d'un seul tenant, et c'est
   désormais lui, et non plus les effets intégrés, qui fixe le pire cas. Y toucher
   demanderait une forme de recette reprenable dans l'API des recettes, donc une décision
   d'API, pas une optimisation de ce lot.
2. **Découper `kit()` de `src/music.js`.** La tranche maximale du titre reste à 19,3 ms :
   `moduleSteps` ne cède qu'entre kit, compose, serialize et decode, alors que `kit()`
   construit sept coups de batterie, huit mesures et le grattement en un seul bloc. Le
   découpage est mécanique, mais il change le nombre de pauses attendu par le test LOAD-13
   de `checks/music.test.mjs` (`before+10`) : il demande une réécriture chiffrée de
   l'assertion, à faire sciemment, pas en passant sur un lot déjà long.

## Écartés ou absorbés (rien de fait ici, délibérément)

- **MIX-02 compresseur (−12 / 3 / 6 / 12 / 120)** → lot 11b T3.
- **MIX-03 / MIX-V1 ducking (0,35 / 0,22 / 0,18)** → lot 11b T4.
- **MIX-06 tirs ennemis filtrés (1,1 kHz, taux 0,85)** → lot 11b T11.
- **Écho 0,09** : non mesuré, donc non appliqué.

Ces quatre-là ne sont pas des oublis : ils sont hors du périmètre des tâches de la fiche,
et les appliquer sans la mesure qui les justifie aurait été exactement ce que le brief
interdit.

## Décisions à confirmer par David, avec le défaut appliqué

| Décision | Défaut appliqué | Effet si David dit autre chose |
| --- | --- | --- |
| Pistolet : la fiche écrit « au moins +4,9 dB », la décision David « ≥ +5 dB » ; mesuré **+4,99 dB**. | Recette appliquée telle quelle. | Baisser le gain de la bande du pistolet, ou accepter 4,99. Un demi-décième, mais c'est une limite basse franchie de justesse : à trancher, pas à arrondir. |
| Seuils de dédoublonnage proposés par la fiche (avec seuil et renvoi périodique). | **Égalité stricte**, sans seuil. | Les seuils font échouer le test de nullité MIX-08 ; les reprendre coûterait le critère. |
| `setMachinery` / `setSteam` : la fiche les voulait différés. | Mise à jour **immédiate** conservée. | Deux tests existants (`audio.test.mjs:90-92`, `:188`) posent une pause sans tick. |
| Confirmations de touche et de kill. | **Activées** avec la table METAL ; éteintes sans options. | Un `FAudio.create()` nu retrouve exactement la v0.2. |
| Forme des confirmations (55 ms / 0,30 ; 200 ms / 0,45 ; +½ ton par touche consécutive). | Valeurs posées ici, cohérentes avec les règles de forme. | À réégler à l'écoute, ce qui n'a pas pu être fait sur cette machine. |
| Chemins des preuves. | `preuves/lot-11/<tâche>/`, convention du dépôt (`lot-00`, `lot-01`, `lot-02`). | Le brief écrivait `lot-11-audio` ; l'arborescence a suivi le dépôt pour ne pas casser les liens des quatre commits déjà posés. |

## Ce qui attend un vrai appareil

- **Écoute réelle : non faite.** Aucun haut-parleur ni casque sur cette machine, Chrome en
  sans-interface avec `--mute-audio`. Tout ce qui est affirmé sur le son l'est sur des
  échantillons calculés (crête, centroïde, bande 120–500 Hz, énergie sous 120 Hz, RMS) et
  sur des sha256. Le ressenti des confirmations FEEL-07, du corps des armes METAL et de
  l'équilibre SMG/musique reste à juger à l'oreille par David.
- **Téléphone** : commandes tactiles, absence de défilement pendant le jeu, et surtout le
  temps de préparation réel du premier chargement (la tranche max de 19 ms est mesurée sur
  un ARM de bureau, pas sur un téléphone) — non vérifiés.
- **PC Windows à carte NVIDIA, Safari, Firefox** : non vérifiés. Les mesures Web Audio de
  ce lot viennent de Chrome 151 et de Node ; `OfflineAudioContext` n'a pas été exercé sur
  les autres moteurs.
- **Audio réel en jeu** (périphérique de sortie, latence, `ctx.state` suspendu, reprise
  après coupure d'onglet) : non vérifié hors rig sans interface.
- Les WAV A/B produits par les bancs sont **hors dépôt** (seuls leurs sha256 sont
  committés) : ils ne peuvent donc pas être rejoués depuis le dépôt seul.

## Chiffres finaux

- `npm test` : **516 réussis, 0 échec** (référence 506/506).
- `python3 tools/build.py` : `dist/index.html` **865 940 octets**, gzip 265 636 octets,
  `sha256` de `SIZE.json` vérifié, **0 actif externe**, aucun CDN ni dépendance d'exécution.
  Sous la limite de 1 400 000 octets. Le navigateur n'est pas compté dans cette taille :
  à rappeler dans toute comparaison avec un exécutable natif.
- Commits du lot : `1461e24` T0, `d7e7bed` T2, `4296a73` wip Claude repris en T3,
  `93e67e8` T1, `246cbeb` T3, `f70b785` T4, `982418a` T5, `ff20e35` au-delà 1.
