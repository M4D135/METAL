# Lot 11 — Audio, armes puissantes et mixage

Branche `chantier/lot-11-audio`. Agent : OpenCode, modèle local du Spark.
Base du brief : `1336bdb` — **attention** : cet objet existe dans le clone mais n'est **pas**
sur la branche ; c'est un fils du wip `4296a73` (« wip(spark-audio): état laissé par le relais
OpenCode à son arrêt »), pas le point de départ du lot. Base réelle du lot : `35c654a`
(rapport lot 02, version 0.9.1), parent de `1461e24` (T0). Preuves :
`docs/chantier-moteur/preuves/lot-11/`.

## Référence de départ

`npm test` lancé sur une arbre de travail détachée propre de `d7e7bed` (l'état **sans** le
wip Spark) : **506 réussis, 0 échec** (journal `.relais/npm-test-ref.log`). C'est cette
référence qui a été retenue, et le test de préparation réécrit en T1.

**Correction apportée au tour 1 des correctifs.** Ce paragraphe écrivait que « l'arbre de
départ est **rouge**, le test `checks/audio.test.mjs:203` laissé par le wip Spark attend
`await prepare(0)` avant d'avoir amorcé les `setTimeout` et pendouille », et que le
`console.log('DEBUG slices'…)` avait été retiré en T1. **Aucun état commité n'est rouge.**
Reproduit au tour 1 : `git worktree add --detach .relais/wip 4296a73` puis `npm test` →
**510 réussis, 0 échec** (journal `.relais/npm-test-wip.log`), et `grep -n DEBUG` sur
`checks/audio.test.mjs`, `src/audio.js`, `src/music.js` de ce commit ne renvoie rien.
La phrase exacte est donc : **l'arbre non commité que j'ai reçu était rouge** — un état de
travail, non contrôlable par personne, qui n'existe dans aucun commit. La référence retenue
reste le commit vert `d7e7bed` (**506/506**, chiffre reproduit à l'unité près), et le test
réécrit en T1 l'a été sur un arbre déjà vert.

À la fin du lot : **521 réussis, 0 échec** (516 à la fin du premier passage, 506 à la
référence de départ). Aucun test qui passait n'a échoué. Cinq tests ont été modifiés ou
relevés, chacun dans le commit du changement voulu qu'il acte (dit dans la tâche concernée).
Aucun test affaibli.

Machine : Linux arm64 (DGX Spark), Node 24.18, Chrome **151** sans interface pour tout ce qui est mesuré ici.
**Provenance des preuves Chrome, par preuve (correction du tour 2, problème 5)** : quatre preuves committées viennent
en réalité du Mac d'audit sous Chrome **157** — `t0/ab-aa.json`, `t0/calib.json`, `t0/null.json` et `t2/ab-t2.json`
(leur champ `ua` porte `Macintosh; Intel Mac OS X … HeadlessChrome/157`). Les preuves `t3`, `t4`, `t5` sont bien de ce
Spark sous Chrome 151. `t2/ab-t2.json` a été **rejoué sous Chrome 151** dans `t2/ab-t2-linux151.json` : les scènes (c)
et (a) s'y reproduisent au centième, la scène (t) tombe au plancher de bruit du banc et varie d'un moteur à l'autre
(−128,93 Mac 157, −138,47 à une relance Spark, −96,75 à la rejouée committée), les trois passant MIX-08. C'est un
écart de provenance (preuve non rejouable à l'identique), pas un défaut de résultat. Toutes les mesures CPU dans
le domaine principal de Node (`tools/realm-loader.mjs`, jamais `node:vm`), comparaisons appariées et alternées,
médianes. Pas de réseau, machine partagée : le bruit est réel et les passages contraires sont conservés dans les
fichiers de preuve.

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
- **Tour 1 (problème 3 du contre-vérificateur) : le critère « tranche ≤ 8 ms » de la fiche
  n'était pas atteint, et ne l'est toujours pas totalement.** Le contre-vérificateur a mesuré
  sur la tête du lot `medianMaxSliceMs` **46,22 → 21,43 ms** et `medianOver8` **13 → 16** : le
  nombre de tranches hors budget *augmentait*, et le banc cité par la fiche
  (`bancs/load/music.mjs`) ne peut pas mesurer ce critère — il synthétise les noms en direct et
  ne passe jamais par `warmBank` (il donne 80,8 → 76,7 ms des deux côtés, quel que soit le
  réglage du budget). Trois causes, chacune mesurée avec une sonde de tranche par tranche :
  les recettes fournies par le jeu étaient des fonctions opaques (`rocket#1` : 21 à 30 ms d'un
  seul tenant) ; le coût d'un nom était enregistré depuis une tranche partielle, donc le nom
  suivant ouvrait un bloc trop gros ; et un nom inconnu se dimensionnait sur le pire débit
  **global**, ce qui sous-estime un effet jamais vu (`break:metal#0` ouvrait à 13–18 ms).
  Corrigées par `layeredJob` reprenable exposé par `FAudio.recipe`, coût enregistré à la fin du
  travail et bloc dimensionné sur le pire débit observé **pour ce nom** (`peakCost`), ouverture
  à `BLOCK_MIN` pour un nom inconnu, plus une marge de 0,6 ms dans la tranche et le découpage
  du `kit()` de `src/music.js` (7 frappes, 8 mesures, ajouts).
  Mesure appariée 7 passages (`--game`) : tranche max médiane **24,44 → 14,41 ms**, tranches
  au-dessus de 8 ms **22 → 4**, total 354,4 → 314,7 ms, banque `54d3df3c8b3a…` identique,
  `sameBankAB` vrai, `prepareMatchesDirect` vrai des deux côtés. Contre la base du lot :
  55,91 → 14,75 ms et 15 → 4.
  **Résidu écrit noir sur blanc : il reste 4 tranches au-dessus de 8 ms et une tranche max
  médiane de 14,41 ms.** Le solde n'est plus dans les effets mais dans `src/music.js` :
  `instrument()`, `strings()` et `drumHit()` produisent chacun leur PCM en un seul passage, et
  les deux premiers rendus réchauffent le JIT. Les rendre reprenables est le travail qui reste,
  et il n'est pas fait ici.
- Tests ajoutés au tour 1 : PCM d'une recette identique à `synth()` pour toutes les tailles de
  bloc (1, 16, 64, 256, 4096) ; aucune tranche au-dessus de 8 ms sur l'horloge que le
  planificateur consulte réellement ; banque préparée identique à la synthèse directe, noms de
   recettes et extras compris. Deux assertions LOAD-13 relevées (19 phases par étape au lieu
   de 4), changement voulu et chiffré.
- **Tour 2 (problème 3 du contre-vérificateur) : le sous-item « appeler `music.prepare()`
  pour les 3 étapes pendant l'écran de chargement, par tranches de 8 ms » est reporté, et
  c'est écrit ici.** Il n'était ni fait, ni déclaré. `src/game.js` ne prépare que l'étape
  jouée (`preparePlay`, l. 286 : `FMusic.warmup(nextStage%3)`) et le titre (l. 1005) ; les
  trois étapes ne sont pas toutes préparées à l'écran de chargement. Le but de la fiche (« qu'aucun
  `createBuffer` ne survienne en jeu ») n'est donc **pas atteint**. Mesuré au tour 2,
  `node docs/chantier-moteur/preuves/lot-11/t2/audio-root.mjs .` : **5 tampons créés en jeu**
  et, au changement `stage -> 2`, **7 tampons créés / 84 170 échantillons convertis** — chiffres
  identiques à la base `35c654a`, donc **non régressifs**, mais non nuls. Préparer les trois
  étapes d'un coup à l'écran de chargement triplerait le temps de chargement sans supprimer ces
  `createBuffer` : les tampons d'échantillons par note (`buffer(sample)`, `music.js` l. 373-376)
  sont créés à la première note jouée, une fois le contexte audio ouvert, et `warmup` ne prépare
  que le PCM/la portée, pas les `AudioBuffer`. Le sous-item est donc **reporté avec son chiffre
  résiduel**, et non « fait ».


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
- **RMS à crête égale (correction du tour 1, problème 4)** : le critère d'acceptation de la
  fiche est « RMS **+8 dB** à pic égal ». Il n'est atteint que pour la grenade. Mesuré
  (`preuves/lot-11/t3/feel06.json`, rejoué au tour 1) : pistolet +6,44, SMG +7,98, pompe
  +7,60, roquette +6,47, grenade +9,86. Ce qui est tenu, c'est la **règle de décision par
  défaut** de la fiche (« intégrer si bande 120–500 Hz ≥ +5 dB et **RMS ≥ +6 dB** à pic
  égal »), satisfaite par les cinq armes. La ligne « Écarts assumés » du README T3 le dit
  depuis le tour 1 ; cette version du rapport l'omettait.
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
- **Tour 1 (problème 2)** : les quatre réglages de mixage de FEEL-07 que ce commit laissait
  de côté sont appliqués, après exécution de la décision par défaut de la fiche sur le banc
  MIX (crête max 0,669 ≤ .85, zéro échantillon au coude .875). Compresseur maître
  −12/6/3/12 ms/120 ms, duck 0,35 tenu 0,22 s (pompe, roquette, grenade) et 0,18 s (SMG),
  tirs ennemis à taux 0,85 avec passe-bas 1,1 kHz sans clic mécanique au niveau 0,24, envoi
  d'écho 0,09. La banque METAL passe de 68 à **72** tampons (deux voix ennemies de plus, en
  deux variantes). Chiffres, commandes et test dans `preuves/lot-11/t4/README.md` et la
  section « Écartés ou absorbés — puis repris au tour 1 ».

## T5 — la musique n'alloue plus par image (`982418a`, fait — RESTE-09 points 2 et 3)

`tick()` et `stopAll()` parcourent `voices` sans le copier (`Array.from`) : retirer
l'entrée courante d'un `Set` pendant un `for…of` est défini et conserve l'ordre d'insertion.
`schedule()` remplit 4 enregistrements préalloués par instance au lieu d'en créer 4 par
ligne. Le `Set` est gardé plutôt qu'un tableau à retrait par échange : `delete` en O(1) et
`stats.activeVoices` restent exacts.

- Allocations de `FMusic.tick` (médianes de 7 allers-retours, outil ajouté
  `tools/music-alloc.mjs`, domaine principal, instance chauffée) : monde 0
  **1,321 → 1,027 Mo/min (−22,3 %)**, monde 1 **2,450 → 2,017 (−17,7 %)**, titre
  **3,121 → 2,579 (−17,4 %)**.
- **Correction du tour 1 (problème 1).** Cette phrase écrivait « La fiche attendait −21 % et
  demandait d'abandonner sous −10,5 % ». **Ce critère n'existe ni dans la fiche, ni dans le
  constat RESTE-09** : c'est un chiffre inventé par ce rapport (et repris dans le message du
  commit `982418a`, que je ne peux pas réécrire). Ce qui est réellement mesuré, ce sont les
  trois chiffres ci-dessus, en comparaison appariée.
- **Le point (1) de RESTE-09 (deux `GainNode` persistants par piste, « 15 nœuds/s au lieu de
  30 ») n'est pas implémenté, et ne le sera pas.** La contre-vérification du constat le classe
  « **à écarter** » : « 30 nœuds par seconde sont insignifiants pour Web Audio, et réutiliser
  un gain qui porte encore des automations planifiées (…) peut produire des clics, ce qui est
  une perte de qualité possible. Garder (2), (3), (4) et LOOP-14. » La règle du chantier
  interdit toute perte de qualité, et le constat dit lui-même « Aucun gain JS mesurable »
  pour ce point. La fiche le marque d'ailleurs « NON contre-vérifié : valider par écoute
  Chrome avant clôture », écoute impossible ici.
  **Le compteur exigé par la fiche est publié quand même** : `preuves/lot-11/t5/noeuds.md`,
  rejoué au tour 1 — **29,9 nœuds/s des deux côtés** (base `35c654a` et tête), soit
   `{"gain":898,"source":898}` pour 898 notes en 60 s, **2 nœuds par note**. Le critère
   « ≤ 15 nœuds/s » n'est donc pas atteint, volontairement et chiffres à l'appui. Le test
   qui le verrouillait (`checks/music.test.mjs`, « … create exactly two nodes per note »)
   **comptait les nœuds et bloquait l'état contraire de la fiche** : un agent voulant
   implémenter le point (1) l'aurait trouvé rouge. **Corrigé au tour 2 (problème 7)** : le test
   s'appelle maintenant « sixty seconds of music fade every note cut before its natural end to
   silence (no click) » — il garde les invariants neutres (une source par note, pas de
   panoramisation par note) et vérifie la propriété de qualité réelle qui justifiait l'écart :
   les 303 notes coupées sur 60 s fondent bien au silence (le fondu ~8 ms de `music.js:380`),
   donc ne cliquent pas. Il ne verrouille plus le nombre de `GainNode`.
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

- **Chiffres repris au tour 1 (problème 7 du contre-vérificateur).** La première version de
  ce rapport publiait, pour ce seul commit comparé à son parent : écart apparié médian
  **−19,1 % (5 paires sur 7)**, médianes 20,49 → 18,91 ms, **tranches au-dessus de 8 ms
  22 → 16 (−27 %)**, total 347,7 → 336,6 ms (−3,2 %). **Ces chiffres ne se reproduisent
  pas.** Deux rejouées indépendantes de 7 passages
  (`preuves/lot-11/au1/prep-replay-1.json`, `prep-replay-2.json`, mêmes arbres
  `982418a` contre `ff20e35`, même outil, même machine) donnent :

  | mesure | publié | rejouée 1 | rejouée 2 |
  |---|---|---|---|
  | tranche max médiane A → B | 20,49 → 18,91 | 27,04 → 28,50 | 26,45 → 25,46 |
  | médiane des écarts appariés | −19,1 % (5/7) | **−4,7 % (4/7)** | **−4,6 % (4/7)** |
  | tranches > 8 ms A → B | 22 → 16 (−27 %) | 19 → 20 (**+2**, 2/7) | 18 → 23 (**+2**, 2/7) |
  | total de préparation | −3,2 % | 0,0 % | +2,3 % |

  Le « −27 % de tranches hors budget » est **faux** : dans les deux rejouées l'arbre au-delà 1
  a *plus* de tranches au-dessus de 8 ms que son parent. Le gain réel sur la tranche max
  (−4,7 %) ne passe pas le seuil des 5 paires sur 7 que le brief impose pour retenir un gain.
  Cause de la divergence : l'outil a été corrigé depuis — il ignorait les noms portés par
  `options.extras`, donc la file mesurée n'était pas la même — et la variance d'un passage à
  l'autre sur cette machine partagée est énorme (16,97 à 42,10 ms pour le même arbre).
- Ce qui tient : le **mécanisme** (taille de bloc calculée à l'ouverture, bornée 16–256,
  rétrécie si le bloc dépasse) et son innocuité bit à bit (`step(64)` quatre fois =
  `step(256)`, `bankSha256` identique). Ce qui est publié à la place des chiffres retirés,
  c'est celui du correctif `e9de02c` : tranche max médiane **24,44 → 14,41 ms**, tranches
  au-dessus de 8 ms **22 → 4**, banque `54d3df3c8b3a…` identique des deux côtés.
- Identité : `bankSha256 54d3df3c8b3a…` identique des deux côtés, 0 tampon différent sur 68,
  modules inchangés, `prepareMatchesDirect` `true` sur `bank`, `module` et `titleModule`.
  (La première version annonçait `acfb0222190905ab…` sur 64 tampons et
  `prepareMatchesDirect.bank: false` « de façon identique sur A et B » : c'était un bug de
  l'outil, pas un comportement des arbres — corrigé au tour 1.)
- Preuves : `preuves/lot-11/au1/` (`prep.json`, `prep-replay-1.json`, `prep-replay-2.json`,
  `README.md`).

### Les deux pistes « au-delà » restantes, en fait réalisées au tour 1 (tour 2, problème 2)

Une première version de ce rapport inscrivait ici deux optimisations « non réalisées » : les
recettes du jeu laissées opaques (`rocket#1` à 21,4 ms d'un seul tenant) et le `kit()` de
`src/music.js` laissé en un seul bloc. **Ces deux affirmations étaient fausses et
contredisaient le § T1 du présent rapport** : elles dataient d'avant le correctif `e9de02c`.

1. **Recettes du jeu reprenables — fait.** `FAudio.recipe` (`src/audio.js` l. 170) attache à
   toute recette du jeu un rendu reprenable (`job:` → `layeredJob`), et `src/audio-recipes.js`
   construit ses neuf entrées par `FAudio.recipe`. Le test « a game recipe renders bit for bit
   the same PCM whether the engine cuts it into blocks or not » l'exige. Une recette n'est
   marquée `opaque` (`src/audio.js` l. 440) que si elle n'a pas de `job` — aucune recette METAL
   n'est dans ce cas. `rocket#1` n'est plus « d'un seul tenant » : il ne figure plus dans les
   `heaviestJobs` après `e9de02c` (pire cas rendu mesuré 11,2 ms, contre `rocket#1 21,4 ms` sur
   l'arbre d'avant).
2. **Découpage du `kit()` — fait.** `moduleSteps` (`src/music.js` l. 309-340) cède le kit par
   mesure : sept phases `kitDrum`, huit phases `kitBar`, une phase `kitExtras`, plus compose,
   serialize, decode. Le test LOAD-13 de `checks/music.test.mjs` a été relevé en conséquence
   (19 phases par étape au lieu de 4), changement voulu et chiffré écrit au § T1.

Le seul résidu qui tienne encore est que `instrument()`, `strings()` et `drumHit()` de
`src/music.js` rendent chacun leur PCM en un seul passage : c'est le budget résiduel chiffré
de la section « Décisions à confirmer par David » et du point 4 de la contre-vérification
(tour 2), plus le vrai travail qui reste.

## Écartés ou absorbés — puis repris au tour 1 (problème 2 du contre-vérificateur)

La première version de ce rapport inscrivait ces quatre réglages parmi les « écartés,
délibérément », reportés sur le lot 11b :

- **MIX-02 compresseur (−12 / 3 / 6 / 12 / 120)** → lot 11b T3.
- **MIX-03 / MIX-V1 ducking (0,35 / 0,22 / 0,18)** → lot 11b T4.
- **MIX-06 tirs ennemis filtrés (1,1 kHz, taux 0,85)** → lot 11b T11.
- **Écho 0,09** : non mesuré, donc non appliqué.

Le contre-vérificateur a vu juste sur le fait, et la fiche tranche : la ligne « Décisions à
confirmer par David » de FEEL-07 porte une **valeur par défaut** — « lancer le harnais
OfflineAudioContext SMG (ancien vs nouveau compresseur) et valider les valeurs
−12/3/6/12/120 — valeur par défaut : accepter si pic ≤ .85 et pas de saturation du waveshaper
.875 ». Le harnais n'avait pas été lancé : la décision par défaut n'avait pas été exécutée, et
le report n'était donc pas ratifiable. Il est exécuté au tour 1, la condition est remplie, les
quatre réglages sont **appliqués** (`preuves/lot-11/t4/README.md`, `matrix-feel07.json`,
`pump-feel07.json`, `calib-feel07.json`, `ab-ennemis.json`) :

| réglage | avant | après | mesure qui valide |
|---|---|---|---|
| compresseur maître | −19 / 18 / 5 / 4 ms / 180 ms | **−12 / 6 / 3 / 12 ms / 120 ms** | crête max 0,669 ≤ .85, zéro échantillon au coude .875 sur 16 rendus |
| duck musique | 0,45, tenue 0,14/0,28 s | **0,35, tenu 0,22 s (pompe, roquette, grenade), 0,18 s (SMG)** | rafale SMG : musique −9,14 dB sous la rafale contre −8,15, marge du transitoire +2,2 dB |
| tirs ennemis | tampon joueur, taux 1 / 1,13, niveau 0,24 / 0,28 | **même recette sans clic mécanique, taux 0,85, passe-bas 1,1 kHz, niveau 0,24** | scène b (65 tirs) : mix modifié (Δcrête −9,28 dBFS), 2 630 automatisations des deux côtés, 0 voix volée |
| envoi d'écho des armes | 0,065 | **0,09** | crête et RMS des quatre scènes sous les mêmes bornes, plafond souple intact |

La compensation automatique du `DynamicsCompressorNode`, que la fiche demandait de quantifier,
vaut **4,55 dB avant, 3,73 dB après**, avec le même délai de 288 échantillons (6 ms) des deux
côtés ; le RMS de sortie baisse de 0,32 à 0,73 dB selon la scène, ce qui est le décalage
annoncé par le garde-fou, mesuré avant de figer et non supposé.

Ce qui reste reporté sur le lot 11b, et pour une raison qui tient : la **proposition MIX**
(limiteur de sécurité −6/4/12/1/90 et l'étagère basse 150 Hz à −12 dB) n'est pas dans la fiche,
et le banc `mix.js` la garde mesurable (`COMP.lim`, `DUCK.shelf`) pour ce lot-là.

## Décisions à confirmer par David, avec le défaut appliqué

| Décision | Défaut appliqué | Effet si David dit autre chose |
| --- | --- | --- |
| Pistolet : la fiche écrit « au moins +4,9 dB », la décision David « ≥ +5 dB » ; mesuré **+4,99 dB**. | Recette appliquée telle quelle. | Baisser le gain de la bande du pistolet, ou accepter 4,99. Un demi-décième, mais c'est une limite basse franchie de justesse : à trancher, pas à arrondir. |
| Critère d'acceptation FEEL-06 « RMS +8 dB à pic égal » (fiche, preuve exigée de T3). | **Non atteint** sauf grenade : +6,44 / +7,98 / +7,60 / +6,47 / +9,86. La règle de décision par défaut de la fiche (RMS ≥ +6 dB) est en revanche tenue par les cinq armes. | Si David exige +8 dB, il faut reprendre les recettes (thump plus grave et plus long, corps plus saturé) et re-mesurer ; ce n'est pas réglable par un simple gain, qui écraserait le facteur de crête. |
| FEEL-07 conditionné aux mesures de la lacune MIX (fiche, « valeur par défaut : accepter si pic ≤ .85 et pas de saturation du waveshaper .875 »). | **Décision exécutée au tour 1 et acceptée** : crête de sortie maximale 0,669 sur 16 rendus, zéro échantillon au coude .875, compensation du compresseur mesurée (4,55 → 3,73 dB). Les quatre réglages sont en dur dans `src/audio.js`. | Un refus se débranche en quatre endroits (`limiter.*`, `DUCK_HOLD`, `enemyShot`, `send.gain`) et le banc garde les valeurs d'avant sous `COMP.v02` / `DUCK.v02` pour re-mesurer l'aller-retour. Le point (1) de RESTE-09 reste écarté, lui, sur avis du constat. |
| Seuils de dédoublonnage proposés par la fiche (avec seuil et renvoi périodique). | **Égalité stricte**, sans seuil. | Les seuils font échouer le test de nullité MIX-08 ; les reprendre coûterait le critère. |
| `setMachinery` / `setSteam` : la fiche les voulait différés. | Mise à jour **immédiate** conservée. | Deux tests existants (`audio.test.mjs:90-92`, `:188`) posent une pause sans tick. |
| Confirmations de touche et de kill. | **Activées** avec la table METAL ; éteintes sans options. | Un `FAudio.create()` nu retrouve exactement la v0.2. |
| Forme des confirmations (55 ms / 0,30 ; 200 ms / 0,45 ; +½ ton par touche consécutive). | Valeurs posées ici, cohérentes avec les règles de forme. | À réégler à l'écoute, ce qui n'a pas pu être fait sur cette machine. |
| Chemins des preuves. | `preuves/lot-11/<tâche>/`, convention du dépôt (`lot-00`, `lot-01`, `lot-02`). | Le brief écrivait `lot-11-audio` ; l'arborescence a suivi le dépôt pour ne pas casser les liens des quatre commits déjà posés. |
| **Budget résiduel de tranche (LOAD-13)** — tour 2, problème 4. Le critère de la fiche « aucune tranche de préparation > 8 ms » n'est atteint ni à la tête, ni nulle part. | **Budget accepté ≈ 16 ms**, chiffré. Mesuré au tour 2 : `audio-prep-profile --game` base→tête tranche max médiane **51,36 → 14,34 ms**, tranches > 8 ms **15 → 6** (le contre-vérificateur : 64,63 → 15,49 et 16 → 7) ; banc de la fiche `bancs/load/music.mjs` `warmup0.maxSliceMs` **16,4 ms** (28 tranches), `maxBatchMs` 65,3 (chemin hors `warmBank`, hors d'atteinte du budget). Causes nommées : `instrument()`, `strings()`, `drumHit()` de `src/music.js` rendent leur PCM en un seul passage. | Si David exige 8 ms, il faut rendre reprenables `instrument()`, `strings()` et `drumHit()` (les recettes du jeu le sont déjà depuis `e9de02c`) et relever à nouveau les assertions LOAD-13 ; c'est le vrai travail restant, non fait ici. Faute de fiche modifiable (dossier d'audit en lecture seule), le budget est acté dans ce rapport plutôt que dans la fiche. |

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

## Contre-vérification et correctifs (tour 1)

Un contre-vérificateur a repris le lot et relevé huit problèmes. Chacun est traité ci-dessous,
avec la commande qui le reproduit et le commit qui le corrige. Les huit ont été **reproduits
avant d'être corrigés** ; aucun n'a été écarté sans mesure.

| # | problème | reproduit ? | ce qui a été fait | commit |
|---|---|---|---|---|
| 1 | T5 : le point (1) de RESTE-09 (2 `GainNode` persistants par piste) n'est pas implémenté, et le critère « −21 % » cité n'existe nulle part | oui — `audio-root.mjs` : **29,9 nœuds/s des deux côtés**, `{"gain":898,"source":898}` | point (1) **écarté** en citant la contre-vérification du constat lui-même ; faux critère retiré du rapport et du README ; compteur publié dans `preuves/lot-11/t5/noeuds.md` ; test de compteur de nœuds (remplacé au tour 2 par un test de non-clic, problème 7) | `583530a` |
| 2 | T4 : les quatre réglages de mixage (compresseur, duck, ennemis, écho) ne sont pas appliqués alors que la fiche en fixe une décision par défaut | oui — le README T4 le disait explicitement | banc MIX lancé, condition « pic ≤ .85 et pas de saturation .875 » **remplie** (crête max 0,669, 0 échantillon au coude), les quatre réglages **appliqués** et mesurés | `00b3cd2` |
| 3 | T1 : le budget de 8 ms par tranche n'est pas atteint, et le banc cité ne peut pas le mesurer | oui — `medianMaxSliceMs` 21,43 ms, `medianOver8` 13 → 16 | trois causes corrigées (recettes reprenables, coût enregistré à la fin, ouverture à `BLOCK_MIN`) + découpage du `kit()` ; **24,44 → 14,41 ms**, **22 → 4** ; résidu écrit | `e9de02c` |
| 4 | T3 : le critère « RMS +8 dB à pic égal » n'est pas dans les écarts assumés | oui — `feel06.mjs` rejoué : 6,44 / 7,98 / 7,60 / 6,47 / 9,86 | ligne d'écart ajoutée au README T3, au rapport et à la table des décisions | `7a63961` |
| 5 | Le rapport accuse l'arbre de départ d'être rouge avec un `console.log` qui n'existe pas | oui — `4296a73` est **510/510**, `grep -n DEBUG` ne renvoie rien | paragraphe réécrit : c'est l'arbre **non commité** reçu qui était rouge, aucun commit n'est rouge | `7165001` |
| 6 | Taille : « +2,5 Ko » annoncé contre +15 081 octets mesurés | oui — `SIZE.json` | chiffres publiés par fichier : **+21 592 octets bruts** (872 451 contre 850 859), gzip +7 533 ; dépassement du budget dit comme tel | ce commit |
| 7 | README au1 : « 22 → 16 tranches > 8 ms » ne se reproduit pas | oui — deux rejouées de 7 passages donnent **+2** tranches, 2 paires sur 7 seulement | chiffre retiré du README et du rapport, tables des deux rejouées publiées, bug de l'outil expliqué ; `prepareMatchesDirect` et l'empreint de banque corrigés | `1eab8bf` |
| 8 | BRIEF/MISSION citent des identifiants de commit inexistants | **partiellement** — les trois objets existent dans le clone, mais **aucun n'est sur la branche** | mission corrigée avec les identifiants réels et la nuance « objet existant mais hors branche » ; `.relais/` n'est pas suivi par git, donc non commitable | hors dépôt |

Deux remarques qui engagent le lot, pas seulement le rapport. D'abord, quatre des huit
problèmes (1, 2, 3, 7) sont des **chiffres publiés qui ne se reproduisaient pas** : la règle
du brief sur les médianes appariées et les 5 paires sur 7 n'était pas appliquée partout, et un
outil de mesure contenait un bug qui naturalisait un écart (`prepareMatchesDirect.bank`).
Ensuite, le problème 2 n'était pas un oubli de réglage mais une **décision par défaut de la
 fiche qui n'avait pas été exécutée** : ne pas lancer le harnais, c'était reporter sans l'écrire.

## Contre-vérification et correctifs (tour 2)

Un second contre-vérificateur a relu le travail après le tour 1 et relevé sept problèmes (un
majeur, six mineurs). Chacun a été **reproduit avec la commande citée en preuve** avant d'être
traité. Aucun n'a nécessité de `git revert` : le seul « gain qui ne se reproduit pas » (au-delà 1)
l'avait déjà été au tour 1 (`1eab8bf`).

| # | problème | reproduit ? | ce qui a été fait | commit |
|---|---|---|---|---|
| 1 | **[majeur]** la page de validation, livrable obligatoire, n'avait été touchée par aucun des six commits du tour 1 et contredisait le code, le rapport et les preuves | oui — `git log 7fa34d0..f983413 -- …/validation/lot-11-audio.md` **vide** ; elle écrivait encore 516/516, 865 940 octets, `prepareMatchesDirect.bank:false`, « ce qui n'a volontairement pas été fait » pour les quatre réglages appliqués | page **réécrite à l'état de la tête** : final **521/521**, `dist` **872 451**/gzip **267 891**, `prepareMatchesDirect` vrai des deux côtés, gain « au-delà 1 » retiré et remplacé par les deux rejouées sans gain, section des réglages retirée (les quatre sont appliqués : `limiter.threshold=-12`, `DUCK_HOLD`, passe-bas ennemis 1,1 kHz taux 0,85, `send.gain=.09`) ; ajout provenance + budget résiduel + report T1 | `8d04b6b` |
| 2 | rapport « Deux pistes non réalisées » contredit le code **et** le § T1 | oui — `FAudio.recipe` (`audio.js:170`) attache `job:layeredJob`, `moduleSteps` (`music.js:309-340`) découpe le kit | section **réécrite** : les deux pistes sont faites, `rocket#1` hors `heaviestJobs` (pire cas 11,2 ms) ; seul résidu `instrument()`/`strings()`/`drumHit()` | `d0225e1` |
| 3 | sous-item T1 « préparer les 3 étapes au chargement » non fait **et** non déclaré | oui — `game.js` ne prépare que `nextStage%3` (l. 286) + titre (l. 1005) ; `audio-root.mjs` : **5 tampons créés en jeu**, **84 170 échantillons** convertis `stage->2` | **déclaré reporté** avec le chiffre résiduel (identique à la base, non régressif) ; préparer les trois d'un coup triplerait le chargement sans supprimer ces `createBuffer` | `1d414c8` |
| 4 | critère chiffré de la fiche (tranche ≤ 8 ms) non atteint à la tête | oui — `audio-prep-profile --game` base→tête **51,36 → 14,34 ms**, over8 **15 → 6** ; `bancs/load/music.mjs` `warmup0` **16,4 ms**/28 tranches, `maxBatchMs` 65,3 hors `warmBank` | **budget résiduel chiffré ≈ 16 ms** posé comme décision à confirmer (fiche en lecture seule) ; le ramener à 8 ms demande de rendre `instrument()`/`strings()`/`drumHit()` reprenables | `66a4e70` |
| 5 | provenance Chrome : quatre preuves Mac 157 annoncées « Linux arm64 … Chrome 151 » | oui — `grep ua` sur `t0/{ab-aa,calib,null}`, `t2/ab-t2` = `HeadlessChrome/157 … Macintosh` | provenance **écrite preuve par preuve** (rapport, `t2/README`, validation) ; `t2/ab-t2` **rejoué sous Chrome 151** (`t2/ab-t2-linux151.json`) : c et a au centième, t au plancher de bruit, MIX-08 tenu | `6deb7d4` |
| 6 | MISSION-DU-LOT.md affirme les trois objets existants ; `1336bdb` = `fatal: bad object` sur le clone du contre-vérificateur | oui **sur le clone du contre-vérificateur** ; sur le clone du Spark les trois existent (`1336bdb` fils de `4296a73`) | nuance écrite : deux des trois partout, `1336bdb` absent du clone du contre-vérificateur, **aucun des trois sur la branche** | hors dépôt (`.relais/`, non suivi) |
| 7 | `checks/music.test.mjs` verrouille 2 nœuds par note, soit l'état contraire de la fiche (T5 pt 1) | oui — `assert(gain===notes)` et `assert(created===2*notes)` | test **remplacé** par un test de **non-clic** (les 303 notes coupées sur 60 s fondent au silence, fondu 8 ms) ; invariants neutres gardés ; `node --test checks/music.test.mjs` **15/15** | `1af736e` |

Le fil rouge du tour 2 est le même que celui du tour 1 : des **livrables écrits qui n'avaient pas
été remis à l'état du code** (page de validation, section « deux pistes », provenance, sous-item
non déclaré). Rien de neuf n'a été ajouté au moteur ; les deux seuls points où le code n'était pas
conforme à la fiche (préparation au chargement, tranche ≤ 8 ms) sont des **reports chiffrés**, pas
des silences.

## Chiffres finaux

- `npm test` : **521 réussis, 0 échec** (516 à la fin du premier passage, 506 à la référence
  de départ).
- `python3 tools/build.py` : `dist/index.html` **872 451 octets bruts**, gzip **267 891 octets**,
  `sha256` de `SIZE.json` vérifié, **0 actif externe**, aucun CDN ni dépendance d'exécution.
  Sous la limite de 1 400 000 octets. **Le navigateur n'est pas compté dans cette taille** : à
  rappeler dans toute comparaison avec un exécutable natif. `SIZE.json` est l'autorité de
  mesure ; le chiffre gzip n'est jamais la taille brute.

### Taille — ce que le lot a vraiment coûté (problème 6 du contre-vérificateur)

La fiche annonçait « Taille totale **+2,5 Ko** » pour le lot. Le contre-vérificateur a mesuré
**+15 081 octets** entre la base et le commit de rapport, soit six fois le budget annoncé, et
le rapport ne le chiffrait pas. Le voici, en octets bruts `SIZE.json`, du premier passage et
du tour 1 :

| arbre | `html_bytes` | gzip | écart brut sur la base |
|---|---|---|---|
| base `35c654a` | 850 859 | 260 358 | — |
| premier passage clos (`ff20e35` / `7fa34d0`) | 865 940 | 265 636 | **+15 081** |
| tête après le tour 1 | **872 451** | 267 891 | **+21 592** |

Le budget de la fiche est dépassé d'un facteur **8,4** (+21 592 pour +2 560 attendus), et non
de « +2,5 Ko ». Répartition par source (`source_bytes` de `SIZE.json`, base → tête) :

| fichier | base | tête | écart |
|---|---|---|---|
| `src/audio.js` | 47 822 | 64 113 | **+16 291** |
| `src/audio-recipes.js` (nouveau) | 0 | 3 255 | **+3 255** |
| `src/music.js` | 26 522 | 28 535 | **+2 013** |
| `src/game.js` | 104 907 | 104 937 | +30 |
| total source | 768 940 | 790 529 | **+21 589** (les 3 octets restants sont la soudure du build) |

Lecture honnête : le budget de la fiche était écrit pour des tâches de réglage (changer des
constantes de mixage, dédoublonner des automations). Ce qui a coûté cher n'est pas ce réglage
mais ce que les tâches sont devenues : la table de recettes METAL entière (3 255 octets de
contenu paramétrique, sans tampon importé), le découpage reprenable des recettes et le
dimensionnement de blocs de T1, les deux confirmations et les deux voix ennemies de T4, et le
découpage du `kit()` de T5. Le gzip, lui, n'augmente que de 7 533 octets (2,9 %), parce qu'une
partie du surplus est du code de planification très répétitif.

Ce qui est **retiré** du rapport sur ce point : aucune formule du type « +2,5 Ko » ou
« taille maîtrisée » n'est conservée. La taille est donnée mesurée, par fichier, et le dépassement
est écrit comme un dépassement. Si le budget doit être tenu, c'est une décision à prendre par
David — le levier évident est `src/audio-recipes.js` (la table de recettes), pas le moteur.

- Commits du lot : `1461e24` T0, `d7e7bed` T2, `4296a73` wip Claude repris en T3,
  `93e67e8` T1, `246cbeb` T3, `f70b785` T4, `982418a` T5, `ff20e35` au-delà 1, puis tour 1 :
  `7165001`, `7a63961`, `e9de02c`, `583530a`, `00b3cd2`, `1eab8bf`, `7fa34d0` (rapport),
  `f983413` (rapport taille) ; puis tour 2 : `6deb7d4` (P5 provenance + rejouée Chrome 151),
  `8d04b6b` (P1 page de validation), `d0225e1` (P2 deux pistes), `1d414c8` (P3 report T1),
  `66a4e70` (P4 budget résiduel), `1af736e` (P7 test de non-clic).
