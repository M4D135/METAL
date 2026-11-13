# Lot 00 — Outils de preuve et de mesure
## But
Remplacer les bancs node:vm par un chargeur en domaine principal et publier des compteurs déterministes par pas. Livrer l'overlay de diagnostic CPU/GPU, le recensement des images longues et le banc Chrome à différence de pixels. Sans ces outils, aucun correctif des lots suivants ne peut être prouvé ni protégé contre les régressions.
## Tâches, dans l'ordre
### T1 — Chargeur domaine principal et compteurs déterministes [SIM-11, IA-06]
- Où : checks/simulation.test.mjs:7-11 ; src/world.js:1340-1390 ; tools/campaign-profiles.mjs:2-9 ; tools/campaign-balance.mjs:5-7 ; tools/boss-profiles.mjs:3-4 ; src/game.js:675-695 (⚠ game.js a bougé en 0.8.1, relocaliser).
- Quoi : créer tools/realm-loader.mjs (vm.runInThisContext, window neuf, une fonction enveloppe par variante). Remplacer vm.createContext dans tous les outils de performance. Ajouter au dépôt tools/profile-steps.mjs (temps CPU via process.cpuUsage par pas, rejet du premier passage JIT) et tools/ab2.mjs (A/B apparié alterné, empreinte FNV par pas des Float64 joueur/ennemis/débris, hash snapshot final, ratio médian). Publier dans s.aiStats : appels ground, blocked, segmentFree, nœuds A* explorés, révisions. Garder vm pour les checks fonctionnels.
- Preuve exigée : `node tools/realm-loader.mjs` puis comparaison realm-check.mjs : ground ×8 à ×9 plus lent en vm qu'en realm principal (confirmé ×8,6 et ×14,0 par la contre-vérification) ; pas moyen ×3,7 (legacy-s0) et ×5,2 (campaign-w10). Deux exécutions de profile-steps.mjs donnent le même checksum.
- Qualité : identique (outillage, aucun effet sur le jeu livré).
- Garde-fous : l'eval indirect pollue globalThis → un processus par mesure. Ne pas modifier les checks fonctionnels. tools/ hors de npm test, hors budget 1,4 Mo.
- Dépend de : rien.

### T2 — Critères d'acceptation en compteurs pour la boucle [LOOP-V3]
- Où : bench/loop/harness.mjs ; bench/loop/routes.mjs ; bench/loop/snapshot.mjs ; bench/loop/worldupdate.mjs ; bench/loop-verif2/fast.mjs.
- Quoi : porter le harnais de boucle (vrai game.js, DOM factice) dans le domaine principal via le chargeur T1. Remplacer les seuils absolus en ms par des critères déterministes : segmentFree par recherche échouée ≤ 500 ; expansions A* par pas ≤ 600 ; cellules de navigation remises en file par révision ≤ 1 500 ; sous-pas par image = 1,000 à 60 Hz arrondi ; points de reprise refusés = 0 sur 11. Durées en rapport apparié uniquement (jamais seuil absolu). Seuil indicatif recalé : pas > 8 ms, snapshot < 4 ms, image de révision < 3 ms sur Apple M5.
- Preuve exigée : `node bench/loop-verif2/routes.mjs campaign-9 30 a` exécuté deux fois : mêmes comptes (26 recherches A*, 18 échecs, 7 plafonds, 4 078-4 390 segmentFree), mêmes instants de pas longs (10,97 s, 11,28 s, 19,75 s, 24,33 s, 28,78 s).
- Qualité : identique (outillage).
- Garde-fous : le domaine principal partage les globaux → enveloppe par jeu. Compteurs par réécriture du source en mémoire, jamais dans le dépôt. Aucun effet sur dist/index.html.
- Dépend de : T1.

### T3 — Recensement des images longues (census) [STAB-01]
- Où : src/game.js:152-156, 716 ; src/renderer.js:1373-1382 ; src/simulation.js:1402, 1028 ; src/destruction.js:160-178.
- Quoi : livrer tools/stab-census.mjs (harnais de bench/stab, chargement domaine principal T1) et un script npm `stab` hors de npm test. Rejoue 10 sessions de 180 s (mondes c0, c1, c2, c9, c13, c17, l0, l2, arènes c5, c14), 2 rejeux alignés par session, minimum par image. Sortie JSON : longFramesOver3xMedian, table des causes (updateWorld, route(), destruction). Échoue si une session dépasse les seuils : 0 image > 6× médiane hors première, ≤ 2/min > 3× médiane. Plafond absolu sur machine calme.
- Preuve exigée : `node tools/stab-census.mjs <racine> <monde> 180 60 A.json` deux fois, puis `node tools/analyze.mjs A.bin.json B.bin.json` : 85-97 % des images longues communes aux deux rejeux. Avant correctif : 547/100 528 > 3× médiane, 66 > 6×, 2 > 12×.
- Qualité : identique (outillage).
- Garde-fous : DOM et WebGL factices (ne voit ni GPU ni mise en page). Un correctif qui baisse la médiane fait monter le nombre de dépassements → plafond absolu obligatoire. Tests existants inchangés.
- Dépend de : T1.

### T4 — Enregistreur de temps d'image et journal des saccades [STAB-08]
- Où : src/game.js:723-729, 675-722 ; src/renderer.js:1533-1584.
- Quoi : créer tools/trace.js (FTrace.create({frames:3600, channels})). begin/enter/leave à temps exclusif, mark pour événements (révision destruction, point de reprise, vague, rattrapage de pas, tâche forcée). end(pas, alpha, gpuMs). Tampons circulaires Float32Array, zéro allocation par image. Journal : image > 3× médiane glissante → {temps, ms, multiple, cause, part non attribuée, marques}. export() rend le même JSON que census.mjs. Paramètres URL trace=1 et bench=secondes. Canaux METAL : sim, événements, HUD, modèles, dessin, audio, ordonnanceur.
- Preuve exigée : `node tools/probe-cost.mjs <racine>` : coût unitaire ≤ 123 ns (entrée+sortie), cumul ≤ 7 µs/image. export() d'une démo 180 s dans le navigateur donne les mêmes causes et proportions que census.mjs sur le même monde.
- Qualité : identique (coût nul quand éteint, un test de branchement).
- Garde-fous : performance.now réduit hors isolation (0,1 ms Chrome, 1 ms Safari) → médianes glissantes. Ne jamais faire dépendre la simulation de l'enregistreur. ~2 Ko.
- Dépend de : T1 (format commun avec T3).

### T5 — Overlay de diagnostic CPU/GPU par sous-système [RGPU-11]
- Où : src/game.js:723-729 (⚠ 0.8.1) ; src/renderer.js:1281, 1547, 1550, 1558-1559, 1545-1556, 1561, 1564, 1576-1583, 1584.
- Quoi : overlay activé par ?perf=1 ou touche F3 (event.code, AZERTY+QWERTY), canvas 2D. (1) CPU par sous-système : sim.step, événements, audio, renderHUD, models, culling/emballage, envoi, ombres, scène, post. Anneau 240 images, p50/p95/p99, graphe. (2) GPU : une requête TIME_ELAPSED par image, jamais imbriquée, contrôle de plausibilité (≤ 2× intervalle, GPU_DISJOINT → n/d). (3) stats.* et renderScale. (4) Mode banc ?bench=graine : dt=1/60 fixe, entrées scriptées, sauvegarde désactivée, sortie JSON, lançable en CI sur david-pc. Débit pipeliné (N images, une seule synchro), jamais readPixels par image.
- Preuve exigée : overlay vs harnais RGPU sur cfg/runJ.json : écart < 10 % pour CPU draw() et total. Mode banc : deux exécutions → mêmes états échantillonnés. Coût overlay ≤ 0,1 ms, nul sinon.
- Qualité : identique.
- Garde-fous : mode banc n'écrit jamais de sauvegarde (validation atomique intacte). Contraste et taille police (accessibilité). +3 Ko. Requête GPU : 164-216 résultats sur 240, GPU_DISJOINT jamais levé (bancs/rgpu-verif/out/v2b.json).
- Dépend de : T4 (partage F3 et format export).

### T6 — Banc Chrome à variantes avec différence de pixels [RCPU-V3]
- Où : bench/rcpu/ab.mjs ; bench/rcpu-verif/chrome-gen.mjs ; bench/rgpu/pre.js ; bench/rgpu/post.js ; bench/rcpu-verif2/out/run1.json.
- Quoi : livrer tools/bench-render (hors budget page). Génère une page file:// autonome (sans serveur ni port) chargeant le renderer de référence et N variantes. Rejoue trace caméra + liste dynamique enregistrées, rotation de l'ordre des variantes à chaque image. Sortie par variante : draw() CPU médian et p90, temps total post-synchro GPU, instances, triangles, octets envoyés, écart moyen, % pixels > 3/10/25, PSNR. Règle « identique » : écart 0 sur toutes images. « Visuellement identique » : PSNR ≥ 60 dB et < 0,1 % pixels > 10/255, chiffres dans le commit. Garder bancs Node pour comptages (ordre alterné, process.threadCpuUsage).
- Preuve exigée : sur METAL 673d6b2, variantes base/exact(grid+sun+pool)/cache : PSNR 99 pour exact, ≈ 64,5 dB pour cache, draw() CPU médian −45 % et −69 %.
- Qualité : identique (outil hors build).
- Garde-fous : Chrome sans interface requis sur machine de build ; hors npm test. Temps relatifs sous charge → comparer variantes dans une même exécution uniquement.
- Dépend de : T1 (chargeur domaine principal).

### T7 — Scénarios à états de portes légitimes pour les bancs IA [IA-V3]
- Où : bench/ia/load.mjs ; bench/ia/abrun.sh ; bench/ia-verif2/lib.mjs ; src/simulation.js:649, 298-300.
- Quoi : ajouter au banc trois scénarios (pilote `tourx`, variables ENC et OPEN) : A) portes fermées, rencontres composante de départ (ENC=2,5) ; B) toutes portes ouvertes, tour complet (OPEN=0,1,2 ENC=0..7) ; C) door-0 et door-1 ouvertes, door-2 fermée (OPEN=0,1 ENC=0,1,3,4). Critères par scénario : 0 A* échoué par épuisement ou plafond, nœuds explorés/min ≤ prototype (3 699-12 332), 0 report, 0 refresh global sans changement de collider. Garder `tour` comme test de robustesse (joueur par pad/brèche). À terme : pilote qui marche et actionne les mécanismes (base du mode démo David).
- Preuve exigée : `ENC=2,5 node V2/spikes.mjs R tourx 3600 v2-w01,v2-w10 check` : 162 échecs dont 127 returnToPost (vs 68 dont 62 ligne 711 avec tour). `OPEN=0,1,2 ENC=0..7` : 9 échecs, aucun par 711.
- Qualité : identique (outillage).
- Garde-fous : forcer d.progress=1 court-circuite les mécanismes → bancs uniquement, jamais tests fonctionnels. Hors dépôt ou tools/.
- Dépend de : T1.

### T8 — Ciel après l'opaque et tri spatial sur GPU immédiat [RGPU-V1]
- Où : src/renderer.js:1566, 1460-1467, 1576-1577, 1359, 1276.
- Quoi : (1) Dessiner skyPass après renderBatch(dynamicBatch) et avant FX, test de profondeur actif, gl_Position.z = gl_Position.w dans POST_VERT, depthMask(false). (2) Détecter famille GPU une fois à l'init via WEBGL_debug_renderer_info (repli gl.RENDERER) : tuiles = Apple/Mali/Adreno/PowerVR, immédiat sinon. Exposer stats.gpuClass. (3) Sur GPU immédiat : émettre groupes statiques visibles par cellule de l'index spatial, proche→lointain, ordre interne inchangé. (4) Pré-passe de profondeur activée uniquement si banc T5 sur david-pc montre un gain.
- Preuve exigée : sur david-pc (NVIDIA), banc T5 débit pipeliné : variantes base/skylate/f2b/prepass ; écart d'image nul (MAD 0, 0 pixel différent sur 7 scènes) pour skylate et f2b ; temps GPU scène référence −10 % minimum avec (1)+(3). Sur M5 : IC95 incluant 0 (aucune régression). Puis npm test.
- Qualité : identique (image exacte vérifiée).
- Garde-fous : depthFunc LEQUAL (renderer.js:1359) → trier par cellule entière, garder ordre interne, vérifier écart nul sur coplanaires. Détection renderer masquée → repli comportement actuel. +0,4 Ko. Compatible tuiles (comportement inchangé).
- Dépend de : T5 (banc pour mesurer le gain sur david-pc).

### T9 — Budgets d'allocation, classes cachées et désoptimisations [RESTE-11]
- Où : bancs/reste/phases.mjs ; bancs/reste/ab-frame.mjs ; bancs/reste/alloc.mjs ; bancs/reste/deopt.mjs ; bancs/ia/proto.mjs.
- Quoi : livrer tools/perf-budget.mjs (npm run perf, hors npm test). Chargeur domaine principal (T1), WebGL factice compteur, hash de liste. Seuils sur grandeurs déterministes : Ko/image ≤ 1 100 (cible 50, abaisser à chaque correctif) ; 1 classe cachée par liste dynamique ; ≤ 20 désoptimisations sur 900 images en régime établi ; ratios médians appariés vs commit précédent pour le pas et models(). Pour IA-01 : réétiqueter par union-find incrémental (variante local de bench/ia/proto.mjs), jamais parcours complet.
- Preuve exigée : npm run perf rend les mêmes compteurs deux fois (octets à l'échantillonnage près, classes et désoptimisations identiques). Échoue si réintroduction d'une allocation par maillage ou d'une forme d'objet. 177 désoptimisations en 900 images → ≤ 20.
- Qualité : identique (outillage).
- Garde-fous : --allow-natives-syntax et --trace-deopt dépendent de V8 → épingler version Node, tolérer absence. Pas de seuils de temps absolus en CI. Hors page livrée.
- Dépend de : T1.

### T10 — Temps CPU par fil, worker sans fil et Chrome asynchrone [PARA-13]
- Où : bench/para/proto.mjs ; bench/para/chrome/run.sh ; checks/simulation.test.mjs:7-11.
- Quoi : livrer tools/bench/cpu.mjs (process.threadCpuUsage, repli process.cpuUsage Node < 23.9). Patron FWorker.create(send, {clock, timer}) avec horloge factice pour tester protocole, rattrapage, réserve tampons, pannes de façon déterministe. Test d'équivalence par jeu : même empreinte avec et sans couche worker. Banc deux fils proto.mjs hors npm test. Lanceur Chrome file:// avec tube nommé (run.sh) pour mesurer retard états, aller-retour, images perdues. Dans l'overlay T5 : mode hôte, âge dernier état en ticks, aller-retour moyen, images dessinées sur état en retard.
- Preuve exigée : deux exécutions proto.mjs (repos vs charge 99) : moyennes temps CPU à moins de 20 % l'une de l'autre (vs facteur 10 en horloge). Test worker sans fil : empreinte identique avec/sans worker.
- Qualité : identique (outillage).
- Garde-fous : process.threadCpuUsage exige Node ≥ 23.9 → repli. Lanceur Chrome dépend du chemin macOS → hors npm test. Aucun effet sur la page.
- Dépend de : T5 (affichage dans l'overlay).

## Options désactivées par défaut
- *(aucune : aucun constat de qualité « dégradée » dans ce lot)*

## Écartés ou absorbés
- *(aucun constat réfuté ; SIM-11 et IA-06 sont fusionnés en T1 car même cause et même correctif)*

## Décisions à confirmer par David
- Seuil de gain GPU sur david-pc pour T8 : −10 % minimum sur la scène de référence — valeur par défaut proposée : −10 %.
- Plafond d'images longues par minute pour le banc stab (T3) : ≤ 2/min > 3× médiane et 0 > 6× hors première image — valeur par défaut proposée : ces deux chiffres.
- Touche F3 pour l'overlay (T5) : sur mobile/tactile, prévoir un bouton dans le menu options ou se limiter au paramètre ?perf=1 ? — valeur par défaut proposée : ?perf=1 sur mobile, F3 sur clavier.

## Gains attendus du lot
Les bancs passent d'un facteur de bruit ×10 à ×18 (horloge sous charge) à des compteurs déterministes insensibles à la machine. Le recensement T3 identifie 96,7 % des 547 images longues (529/547) attribuables à trois causes mesurables, remplaçant les priorités faussées par node:vm (ground 52 % → 11 % réel). L'overlay T5 et le banc Chrome T6 rendent chaque régression de fluidité ou d'image détectable avant fusion, avec un écart de méthode de ×1,5 à ×2 éliminé (débit pipeliné vs synchro par image). Le ciel après l'opaque (T8) donne un gain nul sur tuiles et jusqu'à −10 % GPU sur NVIDIA, sans perte d'image. Coût total du lot sur le jeu livré : ~5 Ko (overlay + trace + stats.gpuClass), zéro surcoût en jeu normal.

## Mise à jour après contre-vérification

Cette fiche a été rédigée avant la contre-vérification des axes STAB, DRAW, RESTE et PARA. Les verdicts ci-dessous priment sur le texte des tâches.

- **STAB-01 — confirmé, priorité P0, qualité sans objet.** Gain corrigé : Inchangé : environ 97 % des images longues supprimées si les trois causes le sont. Aucun seuil du futur script npm « stab » ne doit être fixé avant la correction de l'horloge du banc.
- **STAB-08 — confirmé, priorité P1, qualité sans objet.** Code exact (game.js:723-729 : un compteur d'images par seconde toutes les 750 ms, rien d'autre). Rejoué probe-cost.mjs : 35 sondes par image en médiane (42 au plus), 60 ns par sonde avec performance.now dans mon exécution (123 ns chez lui), soit 2 à 5 µs par i…
- **RESTE-11 — confirmé, priorité P1, qualité sans objet.** Les compteurs sont bien reproductibles : Ko/image à 0,3 % près, 5,6 classes cachées à l'identique. Deux défauts des bancs sont à corriger avant d'en faire un outil de référence. (1) ab.mjs a un biais de position de 2 à 3 % en faveur de B : le protocole doit in…
- **PARA-13 — confirmé, priorité P2, qualité sans objet.** Vérifié en m'en servant : process.threadCpuUsage fonctionne sous Node 24.18 et donne des séries stables (0,62 puis 0,54 ms de moyenne sur deux passes encadrantes) alors que l'horloge donne 0,90 ms avec un p99 de 8,8 ms sous une charge de 24 ; le lanceur Chrome…
- **STAB-V3 — nouveau constat, ajouté par le contre-vérificateur (moyenne).** Le banc de stabilité change de régime à 48,6 s : son horloge franchit 2^20 ms et toutes les sessions passent de 1 à 2 sous-pas par image Où : bench/stab/census.mjs:28; bench/stab/analyze.mjs (seuil sur la médiane globale, dérive par tranche de 10 s); src/game.js:690. Quoi : Avant d'intégrer le banc au dépôt (tools/stab-census.mjs) : (1) piloter le harnais avec des horodatages réalistes et déclarés (motifs q60 = arrondi à 0,1 ms, 59,94, 120, 144), jamais une horloge « exacte » partie d'une constante ; (2) dans analyze.mjs, stratifier médianes, seuils et dérive par nombre de sous-pas, et écrire l'histogramme des pas par tranche de 10 s dans la sortie ; (3) faire échouer l'analyse si la part d'images à 2 pas varie de plus de 10 points entre deux tranches ; (4) ajouter une session d'endurance de 10 minutes en simulation seule (endure.mjs : coût par pas et tas après collecte forcée toutes les 30 s) et, dès que la démo existe, un enchaînement d'au moins 6 mondes. Apr… Gain attendu : Des seuils de régression fiables et plus de faux constats de dérive ; les critères d'endurance de STAB-02 et STAB-09 deviennent mesurables. Détail dans `constats/STAB.md`.
- **RESTE-V3 — nouveau constat, ajouté par le contre-vérificateur (moyenne).** Le régime permanent d'une longue session (débris au plafond) n'est pas celui des fenêtres de mesure : budgets et gains à établir en état saturé Où : bancs/reste-verif/endure.mjs; bancs/reste/alloc.mjs; src/effects.js:172-199; src/simulation.js:1028-1065; src/destruction.js:269. Quoi : Ajouter aux bancs une scène saturée déterministe : 1 500 images de chauffe avec tir, puis mesure sur 600 images, en vérifiant que s.debris.length dépasse 120 pendant toute la mesure. Fixer deux budgets d'allocation distincts (début : 1 100 Ko/image aujourd'hui ; saturé : 1 400). Mesurer RESTE-05 et RESTE-07 dans cette scène, où leur gain est le plus grand. Pour la démo : la rotation de secteur de RESTE-V1 borne aussi les destructions accumulées. Gain attendu : Priorités justes pour la fluidité des longues sessions : FEffects.build et updateDebris remontent dans le classement en état saturé. Détail dans `constats/RESTE.md`.

