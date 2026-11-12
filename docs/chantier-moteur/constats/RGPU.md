# Axe RGPU — RGPU

Origine : premier tour. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Axe RGPU (rendu GPU, passes, qualité 3D) sur METAL au commit 673d6b2. Le clone est resté en lecture seule : git status vide, aucun fichier modifié.

Conditions de mesure. Apple M5 (GPU 10 cœurs), Chrome 157 sans interface avec ANGLE Metal, fenêtre de 1440×932 CSS à DPR 2. Monde de campagne 0 (extérieur, forêt) : 190 images mesurées après 560 images de jeu scriptées par un pilote déterministe à 60 Hz (avance, sprint, rotations, tirs, sauts). Chaque image est rendue par toutes les variantes : copies du renderer modifiées en mémoire, ordre tourné, 2 répétitions, synchronisation par readPixels. On obtient ainsi des écarts appariés qui résistent au bruit de la machine partagée (IC95 bootstrap), et des écarts d'image (MAD sur 0–255, part de pixels > 3/10/25 niveaux, PSNR). Le CPU du renderer a été isolé en Node (faux WebGL2, 60 images capturées, A/B entrelacé). Aucun serveur, aucun port, aucun paquet installé : Chrome tourne en file:// avec --dump-dom.

Passes d'une image (auto, extérieur) :
- Ombres : effacement de l'atlas 1024², puis 3 vues de profondeur (lampe 512², soleil 512² sur 56 m, torche 512²). La 4e tuile reste vide.
- Scène, dans un FBO RGBA8 + profondeur : ciel plein écran (4 octaves + 3 bruits de crête), décor statique (≈774 instances visibles sur ≈14 000), objets dynamiques (≈353 pièces), FX translucides triés (≈13), puis effacement de profondeur et arme (58 pièces).
- Post : extraction de brillance au 1/4, flou H au 1/4, composition plein écran (flou V + scène).
- Navigateur : composition de 1 à 3 calques CSS plein écran (#vignette, #damage, #scanlines en CRT) et d'un filtre brightness quand il diffère de 1.
Au total : 58 draw calls, ≈4 600 instances, ≈163 k triangles et 210 Ko envoyés au GPU par image.

Résolution et coûts :
- Auto : 1668×1079 (1,8 MPix), 6,5 à 8,8 ms par image (GPU 4,8 à 5,7 ms, CPU de rendu 1,0 à 2,4 ms). Ce CPU de rendu pèse 3 à 6 fois la logique de jeu, qui prend 0,2 à 0,4 ms.
- Haute : 2880×1864 (5,37 MPix), 15,4 à 18,2 ms, p90 de 21 à 25 ms. Le 60 Hz est raté sur M5, et cette qualité n'a ni budget de pixels ni gouverneur.
- Low : 1152×746, 2,9 ms.

Le coût est par pixel : environ 2,3 ms GPU par MPix plus environ 1,3 ms fixes. La boucle de 12 lumières pèse 28 à 34 % du GPU, dont 11 à 15 % de reflet GGX inutile au-delà de 4 lumières. Les ombres coûtent ≈1 ms GPU + 0,45 ms CPU, le bruit des matériaux ≈10 %, le bloom 0,5 ms, le ciel 0,4 ms. La géométrie n'est pas le goulot. En combat, 48 bouffées proches ajoutent 19 à 25 %.

Pistes réfutées sur GPU Apple (rendu par tuiles avec élimination des surfaces cachées) :
- pré-passe de profondeur : +1,2 ms ;
- tri avant-arrière : +0,5 ms (utile seulement sur GPU sans tuiles : surdessin de 1,70 à 1,54) ;
- branches d'ombre : +0,25 ms ;
- flou V au quart de résolution : ≈0 ;
- soleil à 4 lectures : ≈0 ;
- clés numériques de l'index spatial : CPU ×1,008 ;
- sous-lot dynamique de projeteurs : 0 à −0,25 ms ;
- boucle de lumières scindée : moins bonne que le simple test i<4 ;
- portée des lumières + GGX limité : gains non cumulables.

Paquet mesuré (combo8) : cache des projeteurs soleil, branche d'éclair de bouche, GGX limité à 4 lumières, sans ombre de torche, PCF matériel, ciel après l'opaque, préfixe de projeteurs, texture de bruit. Résultat : −2,1 ms en auto (−32 %), −5,05 ms en haute (−33 %), CPU de draw() ×0,56, envois de 210 à 84 Ko. Sans la texture de bruit (combo7, MAD 0,15, invisible) : −1,8 ms. Avec un budget de 3,3 MPix en haute (hicap6) : de 16,25–16,9 ms à 8,8–9,0 ms (−45 %), p90 ≤ 15 ms.

Deux défauts visuels trouvés :
- le facteur .27 est attaché au créneau de lumière 1 : la lampe proche perd 52 % dès qu'une explosion ou une roquette apparaît (60 images sur 60) ;
- la vignette, le voile de dégâts et l'onde sont absents du ciel et des particules.
Le budget libéré (≈2 ms) peut financer un anticrénelage en post, une cascade soleil proche, un brouillard diffusant, un liseré sur les ennemis et des décalques.

Reproduction : cd bancs/rgpu && node gen.mjs ../../ferro cfg/runL.json out/runL.html && ./run.sh out/runL.html 1440,1000 2 > out/runL.json && python3 -I paired.py out/runL.json base

## Mesures

- **Banc et matériel** : Apple M5 (GPU 10 cœurs), Chrome 157 sans interface, ANGLE Metal ; fenêtre 1440×932 CSS, DPR 2 ; METAL 673d6b2 ; monde de campagne 0 (extérieur, forêt) _(méthode : probe.html (UNMASKED_RENDERER_WEBGL) ; run.sh : --headless=new --use-angle=metal, file:// + --dump-dom, aucun serveur ni port ; copie instrumentée assemblée par gen.mjs dans l'ordre de tools/build.py, ferro/ jamais modifié)_
- **Protocole A/B** : 190 images mesurées après 560 images scriptées ; chaque image rendue par toutes les variantes, ordre tourné, 2 répétitions (minimum retenu) ; écarts appariés et IC95 bootstrap ; écarts d'image toutes les 10 images (MAD 0–255, % px > 3/10/25, PSNR) _(méthode : pre.js (proxy FRender, synchronisation readPixels sur FBO 1×1, compteurs WebGL), post.js (pilote 60 Hz : W+Maj, flèches, tir toutes les 0,5 s, saut toutes les 5 s), paired.py ; GPU = total − émission CPU)_
- **Résolution interne par qualité** : auto 1668×1079 (1,80 MPix, budget renderer.js:1389) ; haute 2880×1864 (5,37 MPix, min(DPR,2) ligne 1386) ; low 1152×746 (ratio 0,8) _(méthode : stats.width/height relevés par le harnais)_
- **Composition d'une image (auto, extérieur)** : 58 draw calls, ≈4 620 instances, ≈163 400 triangles sur 4 vues, 210 Ko envoyés par image (max 235), 774 statiques visibles sur ≈14 000, 353 pièces dynamiques dont 58 d'arme, 13 FX (max 16) _(méthode : compteurs drawElementsInstanced/drawArrays/bufferData, médiane de 190 images, identique sur runH à runL)_
- **Temps d'image de la base** : auto : médiane 6,5–8,8 ms (GPU 4,8–5,7 ms, CPU de rendu 1,0–2,4 ms) ; haute : 15,4–18,2 ms, p90 21,1–25 ms ; low : 2,9 ms _(méthode : total = émission + synchronisation, médiane de 190 images ; plage = séries runH, runI, runJ, runJ2, runL sur machine partagée)_
- **CPU de la logique de jeu hors rendu (sim, IA, HUD, modèles)** : médiane 0,2–0,4 ms, p95 0,5–1,5 ms, max 3–7,3 ms _(méthode : phase de chauffe de post.js (images 61 à 560) où le proxy de rendu ne dessine pas)_
- **Boucle de 12 lumières ponctuelles** : 0 lumière : −1,5 à −2,3 ms GPU (−28 à −34 %), haute −3,9 ms ; 6 lumières : −0,6 à −0,9 ; GGX limité à i<4 (spec4) : −0,6 à −1,2 ms auto (−11 à −17 %), −1,6 à −1,8 ms haute, MAD 0,037, 0 px > 10 niveaux _(méthode : variantes l0, l6, spec4 appariées, 7 séries (runC, runF, runG, runH, runI, runJ, runJ2))_
- **Lumières utiles par pixel** : 4,08 lumières sur 12 au-dessus de 0,004 ; 1,48 à moins de 16 m ; 0,28 à moins de 8 m _(méthode : variante lcount (compteurs encodés en couleur, lecture readPixels toutes les 10 images), runC)_
- **Portée des lumières et forme de boucle** : portée auto (lightcull2) −0,5 à −0,7 ms, MAD 0,24 ; portée 24 m −0,4 (MAD 0,31) ; portée 16 m −0,4 ; spec4 + portée 16 m −0,4 ; deux boucles (split) −0,4 ; split + portée −0,5 ; spec4 seul −0,6 à −0,8 dans les mêmes séries _(méthode : runH, runI appariés)_
- **Ombres** : toutes : −0,9 à −1,1 ms GPU et −0,4 à −0,5 ms CPU (auto), −1,2 / −0,6 (haute) ; soleil −0,4 / −0,3 ; torche −0,3 à −0,6 GPU et −0,1 à −0,3 CPU, MAD 0,013 ; lampe −0,2 ; PCF matériel −0,1 à −0,25 (haute −0,4), MAD 0,10 ; soleil 4 lectures ≈0 ; branches d'ombre +0,25 (réfuté) _(méthode : variantes fx.shadows=false, nosun, notorch, nolamp, hwpcf, sun4, shbranch ; runA, runC, runD, runE, runF, runG)_
- **Lampe ombrée et créneau de lumière 1** : lampe ombrée à 37–42 m de l'œil (médiane 40,8 m) sur 60/60 images, hors de sa portée d'ombre de 32 m ; une transitoire fait passer la lampe du créneau 1 au créneau 2 sur 60/60 images (facteur .27 → .13, −52 %) _(méthode : slot1.mjs : faux WebGL2, lecture des uniformes uLightPosition/uLightColor sur les 60 images de out/scene-w0.json, transitoire injectée à 6 m)_
- **Post, ciel, matériaux** : bloom complet −0,5 ms (haute −0,9) ; flou V au quart ≈0 ; ciel −0,4, ciel après l'opaque 0 à −0,3 (image exacte) ; bruit des matériaux constant −0,5 (haute −1,2, −10,5 %) ; texture de bruit −0,3 (haute −1,05), MAD 1,10 ; branche d'éclair de bouche 0 à −0,2 (image exacte) _(méthode : variantes fx.bloom=false, bloomq, nosky, skylate, nomat, noisetex, muzzle ; runA, runF, runG, runL)_
- **Surdessin et ordre de rendu** : 1,70 fragment opaque par pixel couvert dans l'ordre de soumission, 1,54 trié avant-arrière (−9 %) ; mais sur M5 (rendu par tuiles) tri +0,5 ms et pré-passe de profondeur +1,2 ms _(méthode : variante overdraw (mélange additif 1/255 par fragment, lecture readPixels), f2b, prepass ; runC)_
- **Particules (stress de 48 bouffées entre 2,5 et 12 m)** : +1,2 à +1,6 ms GPU (+19 à +23 %) en auto, +2,9 ms (+25 %) en haute ; bruit constant : surcoût −50 % ; à 6–14 m : +0,5 ; taille ×0,5 : +0,4 _(méthode : injection synthétique pre.js inject() dans la même image ; runC, runF, runK)_
- **Anticrénelage** : MSAA 4× : +1,2 ms GPU (+19,7 %), 1,66 % des pixels changent de plus de 3 niveaux (les arêtes), MAD 0,21 _(méthode : variante msaa4 (renderbuffers multi-échantillons + blitFramebuffer), runG)_
- **CPU de FRender.draw() isolé** : profil : sunShadowPass 35,7 % inclusif, visible() 24,8 %, query 17,1 % ; A/B entrelacé : suncache ×0,68–0,70 (IC95 0,671–0,712) en auto et ×0,76 en haute, envois 220 → 111 Ko ; cpuopt ×1,008 (non significatif) ; combo7 ×0,62, combo8 ×0,56 ; dynsh ×1,15 et dynsh2 ×1,22 (non concluant) ; notorch entre ×0,92 et ×1,03 selon la série _(méthode : cpu-draw.mjs --profile et cpu-paired.mjs (Node 24, faux WebGL2, 60 images capturées, 720 paires par variante, ordre tourné))_
- **Paquets combinés** : auto : combo6 −1,7 à −2,1 ms (−21 à −27 %), combo7 −1,8, combo8 −2,1 ms (−32 %), CPU −0,5 à −1,0 ms, envois 210 → 84–90 Ko, MAD 0,15 (1,16 avec texture de bruit) ; haute : combo8 −5,05 ms (−33 %) ; budget 3,3 MPix + combo6 : de 16,25–16,9 à 8,8–9,0 ms (−45 %), p90 13,9–15 ms _(méthode : runI, runJ, runJ2, runL appariés)_
- **Minuterie GPU et synchronisation** : EXT_disjoint_timer_query_webgl2 sous ANGLE Metal : valeurs cumulées, 11 résultats disponibles sur 40 ; gl.finish() ne synchronise pas (0 ms) ; seule une lecture readPixels synchronise _(méthode : probe2.html, probe3.html, probe4.html, probe5.html)_
- **Inventaire des mondes** : 21/21 mondes (3 legacy + 18 campagne) ont un environnement extérieur ; 37 à 47 lumières, puissance 1,5 à 13, aucune portée définie ; 12 500 à 17 600 maillages _(méthode : worldstats.mjs (FWorld.create en vm Node))_

## Scripts de banc

- bancs/rgpu/gen.mjs
- bancs/rgpu/pre.js
- bancs/rgpu/post.js
- bancs/rgpu/patches.mjs
- bancs/rgpu/run.sh
- bancs/rgpu/extract.py
- bancs/rgpu/paired.py
- bancs/rgpu/cpu-draw.mjs
- bancs/rgpu/cpu-paired.mjs
- bancs/rgpu/slot1.mjs
- bancs/rgpu/worldstats.mjs
- bancs/rgpu/probe.html
- bancs/rgpu/probe2.html
- bancs/rgpu/probe3.html
- bancs/rgpu/probe4.html
- bancs/rgpu/probe5.html
- bancs/rgpu/cfg
- bancs/rgpu/out

## Constats

### RGPU-01 — Reflet GGX évalué pour les 12 lumières ponctuelles : le limiter aux 4 premières
- sévérité haute · catégorie perf-gpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité dégradée · moteur (dans METAL)
- lieux : src/renderer.js:321; src/renderer.js:311-322; src/renderer.js:115-123; src/renderer.js:1551

**Preuve.** src/renderer.js:311-322 : boucle for(int i=0;i<12;i++). La ligne 321 ajoute specular+=uLightColor[i]*attenuation*visibility*metalHighlight(n,view,l,roughness,f0)*2.4 pour chaque lumière. metalHighlight (115-123) enchaîne normalize, 4 produits scalaires, GGX, Smith et un Fresnel en puissance 5. La ligne 1551 retient 12 lumières (6 en low) et la ligne 1554 leur donne une portée nulle. Mesures en A/B apparié par image (M5, ANGLE Metal, 1668×1079) : sans aucune lumière (l0), −1,5 à −2,3 ms GPU (−28 à −34 %) ; avec 6 lumières, −0,6 à −0,9 ms. spec4 (ajouter if(i<4) devant la ligne 321) : −0,6 à −1,2 ms GPU (−11 à −17 %) sur 7 séries (runC, runG, runH, runI, runJ, runJ2) et −1,6 à −1,8 ms en haute. Écart d'image : MAD 0,037/255, 0,08 % des pixels à plus de 3 niveaux, aucun à plus de 10, PSNR 61 dB. lcount : en moyenne, seules 4,08 des 12 lumières dépassent 0,004 au pixel.

**Cause.** Le reflet GGX (≈35 ALU avec normalize et pow) est payé à chaque fragment pour 12 lumières, alors que les lumières 5 à 12, les plus lointaines et sans ombre, ne donnent qu'un reflet imperceptible. Le shader est limité par l'ALU par pixel, pas par la géométrie.

**Proposition.** Remplacer la ligne 321 par if(i<4)specular+=... . L'ordre de la ligne 1551 met déjà dans les créneaux 0 à 3 la lampe ombrée, puis les transitoires (explosions, roquettes), puis les lumières les plus proches. Garder le diffus pour les 12 lumières. Option pour la qualité haute : i<6. Ne pas scinder la boucle en deux : c'est mesuré moins bon (−0,4 ms seulement, variante split). Ne pas y ajouter de continue de portée non plus : spec4 + portée 16 m donne −0,4 ms au lieu de −0,7, car le déroulage de la boucle est perdu.

**Gain attendu.** −0,6 à −1,2 ms GPU par image en auto (−11 à −17 % du GPU), −1,6 à −1,8 ms en haute, sans différence visible.

**Risques.** Changement de rendu seulement : aucun effet sur la simulation, le déterminisme, les sauvegardes ni les instantanés. Les reflets métalliques des lumières lointaines disparaissent (MAD 0,037). Aucun test ne lit le source du shader : checks/renderer-destruction.test.mjs et checks/actor-visibility.test.mjs ne changent pas. +7 octets, pour un budget de 1 400 000 et un dist actuel de 789 111 octets.

**Vérifier par.** Banc RGPU : node gen.mjs ../../ferro cfg/runJ.json out/runJ.html && ./run.sh out/runJ.html 1440,1000 2 > out/runJ.json && python3 -I paired.py out/runJ.json base. Sur la ligne spec4, l'IC95 de Δgpu doit être entièrement négatif et diffs.spec4.gt10 doit valoir 0. Puis npm test.

**Contre-vérification.** Code relu : boucle renderer.js:311-322, reflet ligne 321, ordre des créneaux ligne 1551 (FERRO 248043a : lignes 376-381). Le gain est confirmé par une mesure indépendante, mais l'affirmation « sans différence visible » est fausse en combat intérieur. Avec 3 transitoires, les créneaux sont lampe ombrée + 3 transitoires : la lampe ordinaire la plus proche n'a jamais de créneau < 4 (300 images sur 300, 5 mondes). En salle métallique, le lustre du sol et des murs disparaît alors : 0,87 % des pixels à plus de 10 niveaux en moyenne (2,2 % sur la pire image) dans le monde 0, 0,54 % (2,0 %) dans le monde 17 ; capture d'écart dans out/C-inT-spec4-diff.jpg. Le reflet réapparaît d'un coup à la mort de la transitoire. De plus, dans 4 mondes sur 5 testés, le créneau 0 est une lampe ombrée située à 53-82 m : un des 4 reflets est gaspillé. Telle quelle, la proposition viole la règle « aucune perte ». Pour la rendre acceptable : (1) ne plus laisser une transitoire à portée finie prendre un créneau si sa sphère (p, range) ne coupe pas le frustum (exact) ; (2) classer les créneaux de reflet par contribution P/(1+.26d²) et non par rôle ; (3) compiler le plafond en constante par qualité : 12 en haute (image identique), 4 ou 6 en auto seulement après validation visuelle de David en salle métallique. Sans ces trois points, ne pas l'appliquer en auto par défaut.

**Preuve corrigée.** Banc indépendant (pages sans le jeu, blocs de 10 images pipelinées avec une seule synchro, variantes alternées, M5 ANGLE Metal, 1668×1079, charge machine 66-86) : spec4 −0,51 ms (−11,0 %, IC95 −0,63/−0,20) en extérieur, −0,62 ms (−11,6 %) en intérieur, −0,85 ms (−15,5 %) en intérieur avec 3 transitoires ; monde 17 : −10 % et −17 % (plus bruité). Écart d'image : extérieur MAD 0,037, 0 px > 10 ; intérieur sans transitoire MAD 0,08, 0,03 % > 10 ; intérieur + 3 transitoires MAD 0,38, 3,4 % > 3 niveaux, 0,87 % > 10, pire image 2,17 %. Scripts : bancs/rgpu-verif2/ (vrun-b.js, cfgA.json, out/A.json, out/B.json, worldscan.mjs).

**Gain corrigé.** −0,5 à −0,85 ms par image en auto en débit pipeliné (−11 à −15,5 %), au prix d'une perte de reflets mesurable en combat intérieur. Gain en haute non remesuré.

### RGPU-02 — Qualité haute : DPR natif jusqu'à 2 (5,4 MPix) sans budget de pixels ni gouverneur
- sévérité haute · catégorie perf-gpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité dégradée · moteur (dans METAL)
- lieux : src/renderer.js:1386; src/renderer.js:1389; src/renderer.js:751

**Preuve.** src/renderer.js:1386 : ratio=quality==='high'?Math.min(pixelRatio,2). La ligne 1389 applique le budget de 1,8 MPix au seul mode 'auto', et la ligne 751 désactive le gouverneur hors 'auto'. Sur 1440×932 CSS à DPR 2, la haute rend en 2880×1864 (5,37 MPix) : médiane de 15,4 à 18,2 ms, p90 de 21,1 à 25 ms (runJ, runJ2, runL, 190 images), contre 6,5 à 8,8 ms en auto (1,8 MPix). Cela fait environ 2,3 ms GPU par MPix plus environ 1,3 ms fixes. Variante hicap (budget de 3,3 MPix, soit 2258×1461) : −3,35 à −4,7 ms par image en apparié (GPU −26 à −34 %). Variante hicap6 (ce budget + le paquet combo6) : 8,8 à 9,0 ms contre 16,25 à 16,9 ms (−45 %), p90 de 13,9 à 15 ms. Un MacBook Pro 16 (1728×1117 CSS) monterait à 7,7 MPix en haute, soit environ 19 ms GPU (extrapolé).

**Cause.** La qualité haute agit sur le nombre de pixels (trois fois celui de auto) alors que le coût du shader est proportionnel aux pixels. Rien ne borne ce nombre sur les grands écrans Retina.

**Proposition.** Après la ligne 1389, ajouter : else if(quality==='high')ratio=Math.min(ratio,Math.sqrt(3300000/(cssWidth*cssHeight))). Le budget, entre 3 et 3,5 MPix, devient une constante nommée. La haute garde ce qui fait sa qualité : atlas 1024, portées 82/42/19 et vue soleil de 72 m. Ensuite, activer en haute le gouverneur v2 avec un plancher de 0,8 (RGPU-09).

**Gain attendu.** −3,4 à −4,7 ms par image en haute (−21 à −29 % du total), p90 ramené de 21–25 ms à 16,5–18 ms ; 8,8 à 9 ms avec le paquet P1.

**Risques.** Image un peu moins nette en haute sur les écrans à DPR 2 (échelle 1,57). Aucun effet sur la simulation ni les sauvegardes. checks/options.test.mjs ne change pas (la valeur 'high' est conservée). checks/actor-visibility.test.mjs dérive l'aspect du canvas : à relancer. +90 octets.

**Vérifier par.** Banc RGPU cfg/runJ.json : python3 -I paired.py out/runJ.json high. Les lignes hicap et hicap6 doivent avoir un IC95 négatif, et stats.width/height doit valoir 2258×1461.

**Contre-vérification.** Code relu : renderer.js:1386, 1389, 751 exacts (FERRO : ligne 1542). Les coûts sont confirmés, mais deux corrections s'imposent. (1) « Le 60 Hz est raté sur M5 en haute » n'est pas démontré : les 15,4-18,2 ms du premier tour viennent d'une synchro readPixels à chaque image, qui gonfle les temps d'environ ×2 (mon mode latence donne 22,4 ms sous charge, contre 11,2 ms en débit pipeliné). En pipeliné, la haute tient 60 Hz sur M5 dans les scènes mesurées ; elle ne tient pas 120 Hz. (2) Plafonner la haute à 3,3 MPix retire 39 % des pixels (2880×1864 vers 2258×1461, échelle linéaire 0,78) : c'est une perte de netteté dans le mode que le joueur a choisi pour la qualité, donc interdite par défaut. À garder seulement comme option « résolution dynamique en haute », désactivée par défaut, pilotée par le gouverneur corrigé de RGPU-09. Le coût de la haute doit baisser par RGPU-03, RGPU-05 et RGPU-V1, pas par les pixels. Compatibilité FERRO : défaut inchangé, donc BITUME et Point de rupture ne bougent pas.

**Preuve corrigée.** Débit pipeliné, même banc : haute 11,21 ms/image contre 4,65 en auto en extérieur (×2,4), 12,67 contre 5,34 en intérieur. hicap : −3,33 ms (−29,7 %, IC95 −3,59/−3,13) en extérieur, −3,77 ms (−29,7 %) en intérieur, −3,83 ms avec transitoires. Tailles relevées : 2880×1864 et 2258×1461.

**Gain corrigé.** −3,3 à −3,8 ms par image en haute (−30 %) si l'option est activée, avec 39 % de pixels en moins. Aucun gain par défaut.

### RGPU-03 — Projeteurs d'ombre du soleil requêtés, filtrés, réemballés et renvoyés à chaque image
- sévérité moyenne · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité visuellement identique · moteur (dans METAL)
- lieux : src/renderer.js:1454-1457; src/renderer.js:1444-1446; src/renderer.js:1408-1413; src/renderer.js:1435-1437

**Preuve.** src/renderer.js:1454-1457 : worldIndex.query(center,[extent+24,26,0]).filter(e=>{const d=e.p.map(...)...}) tourne à chaque image. Le centre suit l'œil et se recale sur le texel (1444-1446). La liste change donc presque toujours, et renderStatic (1408-1413) relance packIndexed (798-803) puis un bufferData pour la tuile soleil. La lampe a déjà un cache (1435-1437), pas le soleil. Profil Node (cpu-draw.mjs --profile) : sunShadowPass pèse 35,7 % de draw() en inclusif. A/B entrelacé (cpu-paired.mjs, 720 paires), variante suncache : draw() ×0,68 à ×0,70 en auto (IC95 0,671–0,712, 2 séries) et ×0,76 en haute ; envois de 220 à 111 Ko par image (288 à 153 Ko en haute). Dans Chrome (runG) : CPU de rendu de 2,7 à 1,6 ms (−1,0 ms), image identique (MAD 0, PSNR 93 dB). Les clés numériques dans l'index et le filtre sans allocation (cpuopt) n'apportent rien : ×1,008 (IC95 1,00–1,02).

**Cause.** La vue soleil n'a aucune cohérence temporelle : la liste est reconstruite à chaque image, donc le cache de renderStatic, qui compare les éléments un par un, échoue et déclenche réemballage et envoi.

**Proposition.** Déclarer let sunPlan=null. Dans sunShadowPass : const reuse=sunPlan&&sunPlan.index===worldIndex&&Math.hypot(center[0]-sunPlan.c[0],center[1]-sunPlan.c[1],center[2]-sunPlan.c[2])<2. Sinon, lancer la requête avec [extent+26,28,0] et un filtre élargi de 2 m (extent+2+e.radius, near-2, far+2), puis stocker sunPlan={index:worldIndex,c:center.slice(),casters}. Réutiliser le même tableau fait passer le test same de renderStatic : ni packIndexed ni bufferData. updateWorld crée un nouvel index, ce qui invalide le plan. Le même principe vaut pour la vue caméra quand l'œil ne bouge pas.

**Gain attendu.** −30 % du CPU de FRender.draw() (−0,4 à −1,0 ms par image dans Chrome selon la charge, davantage sur CPU mobile) et −50 % des octets envoyés au GPU.

**Risques.** L'ensemble de projeteurs devient un sur-ensemble (marge de 2 m) : l'ombre est identique (MAD 0). Le test checks/renderer-destruction.test.mjs:42 (removed wall cannot survive in any cached shadow view) reste vrai grâce à la condition index===worldIndex, mais il faut le relancer. Aucun effet sur la simulation ni les sauvegardes. +300 octets.

**Vérifier par.** node cpu-paired.mjs ../../ferro out/scene-w0.json auto base suncache doit donner un ratio inférieur à 0,75. Sur le banc cfg/runG.json, Δcpu doit être négatif et diffs.suncache.mad nul. Puis npm test.

**Contre-vérification.** Code relu : renderer.js:1454-1457 (requête et filtre à chaque image), 1444-1446 (recalage), 1408-1413 (cache par identité), cache de lampe 1435-1437. Gain moyen confirmé et image inchangée. Trois corrections. (1) Le gain disparaît pendant les rotations rapides, justement là où les images sont les plus chères : le centre de la vue soleil est œil + 8 m × forward, donc 14° de rotation le déplacent de 2 m et invalident le cache. Octets envoyés, base contre suncache : 120°/s moyenne ×0,52 mais p90 ×0,77 ; 300°/s p90 ×0,97 ; 600°/s p90 ×1,00 et maximum plus élevé (263 contre 247 Ko). Pour stabiliser aussi le pire cas, faire la requête autour de l'œil avec un rayon extent+8+2 (sur-ensemble invariant en rotation) et n'invalider que si l'œil a bougé de plus de 2 m ; coût : environ 1,6 fois plus de projeteurs dans la passe de profondeur, à mesurer. (2) La clé du plan oublie extent : passer de auto (28) à haute (36) sans bouger de 2 m réutiliserait une liste trop petite, d'où des ombres manquantes au bord. Ajouter sunPlan.extent===extent. (3) FERRO a un mode soleil plein atlas pour Point de rupture (uShadowSettings.w>1.5, ligne 145 du renderer FERRO) : la clé doit couvrir ce mode. Le chiffre « 35,7 % de draw() » vient d'un profil en node:vm et ne doit pas être repris ; les mesures Chrome sont fiables.

**Preuve corrigée.** Banc Chrome indépendant : suncache ΔCPU −0,66 ms sur 2,29 (−29 %) en extérieur, −0,16 ms en intérieur, −0,28 ms avec transitoires ; total −0,32 ms (IC95 −0,44/−0,03) en extérieur. Image : MAD 0 à 0,0001, 0 px > 3 niveaux sur 7 scènes. Rotation : bancs/rgpu-verif2/sunrot.mjs (faux WebGL2, comptage d'octets, 120 images par cas).

**Gain corrigé.** −0,2 à −0,7 ms de CPU de rendu par image en déplacement (−15 à −30 %), octets envoyés ×0,5 en marche ; aucun gain sur le p90 au-delà de 300°/s sans la variante centrée sur l'œil.

### RGPU-04 — Ombres : torche quasi invisible, lampe ombrée hors de portée, 4e tuile d'atlas et 2e lampe jamais utilisées
- sévérité moyenne · catégorie perf-gpu · effort S · gain mesuré
- contre-vérification : **réfuté**, priorité P3 · qualité dégradée · moteur (dans METAL)
- lieux : src/renderer.js:1564; src/renderer.js:327-333; src/renderer.js:1484-1489; src/renderer.js:1325-1332; src/renderer.js:1510-1511

**Preuve.** Torche : src/renderer.js:1564 appelle shadowPass({p:torchPosition},...,2,axes,t) à chaque image, sans cache (à la ligne 1435, stable exige !torchAxes), et shadow(...,2) fait 4 lectures (ligne 331). La retirer (notorch, runG et runE) donne −0,3 à −0,6 ms GPU et −0,1 à −0,3 ms CPU, pour un écart d'image MAD de 0,013 (0,02 % de pixels à plus de 10 niveaux). Lampe : lightPlan (1484) prend la lampe la plus proche de puissance ≥ 7. Sur les 60 images capturées, elle est à 37–42 m de l'œil (médiane 40,8 m, slot1.mjs), au-delà de la portée de son ombre de 32 m (ligne 1426). Sa passe est payée pour rien (nolamp : −0,2 ms GPU). Atlas : 2×2 tuiles (lignes 1325 et 1329 : 1024² en auto, 2048² en haute). La tuile 0 sert à la lampe, la 1 au soleil (1451), la 2 à la torche ; la tuile (1,1) n'est jamais écrite, soit 25 % de 4 Mio (auto) ou de 16 Mio (haute). Lignes 1488-1489 : la 2e lampe ombrée n'existe que sans environnement, or les 21 mondes en ont un (worldstats.mjs).

**Cause.** Les passes d'ombre sont décidées par rôle (lampe, soleil, torche), sans critère de visibilité ni de contribution. C'est un héritage d'un mode intérieur à deux lampes.

**Proposition.** (1) En auto, retirer la passe torche et mettre uShadowSettings.z à 0 (ligne 1575). Retirer aussi le volume torche d'actorFilter (1510-1511) pour rejeter plus d'acteurs. (2) Ne garder la lampe ombrée que si elle est à moins de 28 m de l'œil, sinon shadowLights=[]. Faire ce test dans lightPlan pour qu'actorFilter et draw restent cohérents. (3) Supprimer la branche de la 2e lampe. Puis, au choix : réduire l'atlas à 2×1 (−50 % de mémoire), ou utiliser les tuiles libérées pour une cascade soleil proche (RGPU-14). (4) En haute, rendre l'ombre de torche optionnelle.

**Gain attendu.** −0,5 à −0,8 ms GPU et −0,1 à −0,3 ms CPU par image en auto (torche + lampe lointaine) ; avec un atlas 2×1, −1 Mio en auto et −4 Mio en haute.

**Risques.** checks/renderer-destruction.test.mjs:52 attend stats.shadowMaps===1 (only the player torch remains) : à mettre à jour. checks/actor-visibility.test.mjs:65 reste valide : il y a moins de passes et le filtre reste conservateur. Les ombres de torche sur l'arme et les murs proches disparaissent (MAD 0,013). Aucun effet sur la simulation ni les sauvegardes. −150 octets.

**Vérifier par.** Bancs cfg/runG.json et cfg/runL.json (variantes notorch, combo7) : python3 -I paired.py out/runL.json base. slot1.mjs pour la distance de la lampe. Puis npm test.

**Contre-vérification.** Partiellement réfuté ; lignes citées exactes (1564, 1484-1489, 1325-1332, 1510-1511). (1) « Torche quasi invisible » est faux dès qu'il y a de la géométrie ou un acteur proche. La torche est décalée de 0,16 m par rapport à l'œil, donc un obstacle proche projette une bande d'ombre large sur le fond. Le MAD 0,013 du premier tour vient d'une scène dégagée. Retirer la passe en auto est une perte visible : rejeté. Piste sans perte à mesurer : limiter les projeteurs de la torche à 6-8 m, puisque la largeur de l'ombre vaut 0,16 × (D−d)/d ; critère : moins de 0,05 % de pixels à plus de 10 niveaux. (2) Lampe ombrée lointaine : fait confirmé (53-82 m de l'œil sur 100 % des images dans les mondes 0, 4, 9 et 13 ; 1,3-11,7 m dans le monde 17), mais le raisonnement « hors de sa portée de 32 m » est faux : 32 m est le plan lointain dans l'espace de la lampe, pas une distance à l'œil. La supprimer au-delà d'un seuil est quasi invisible quand elle est loin et très visible quand elle est proche : il faut un fondu par distance à l'œil (par exemple 34 à 42 m), pas une coupure à 28 m. Gain faible et non significatif. Ce point doit être fait avec RGPU-05, sinon le facteur .27 change de lampe au franchissement du seuil. (3) Ne pas supprimer la branche de la 2e lampe dans FERRO : elle sert tout jeu sans environnement extérieur (ligne 1652 du renderer FERRO). La 4e tuile est bien libre (tuiles : slot 0 en (0,0), 1 en (.5,0), 2 en (0,.5)) : à réserver à la cascade de RGPU-14.

**Preuve corrigée.** notorch, écart d'image : scène dégagée MAD 0,011 et 0,03 % > 10 niveaux ; marche près d'une clôture (monde 0) MAD 0,23, 0,67 % > 10, pire image 2,4 % ; avec un acteur à 2,2 m MAD 0,35, 1,12 % > 10, pire image 3,0 %, 0,78 % > 25 ; monde 17 : 1,0 à 1,5 % > 10, pire image 4,0 %. Captures : bancs/rgpu-verif2/out/C-walk-notorch-diff.jpg et C-walkA-notorch-diff.jpg. Coût : notorch −0,26 ms (−5,6 %) en extérieur, −0,10 ms non significatif en intérieur. nolamp : −0,15 ms (IC95 −0,33/+0,11) ; image MAD 0,0005 quand la lampe est à 53-70 m, mais 3,2 % de pixels > 3 niveaux et 0,85 % > 10 quand elle est à 2,5 m avec un acteur.

**Gain corrigé.** Torche : gain refusé (perte visible). Lampe lointaine avec fondu : −0,1 à −0,2 ms GPU, non significatif sur M5.

### RGPU-05 — Facteur d'atténuation .27 attaché au créneau 1 : la lampe proche perd 52 % dès qu'une explosion ou une roquette apparaît
- sévérité moyenne · catégorie bug · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur (dans METAL)
- lieux : src/renderer.js:316; src/renderer.js:1551; src/renderer.js:1554; src/effects.js:209-227

**Preuve.** src/renderer.js:316 : float attenuation=(i<2?.27:.13)/(1.+d*d*.26). Le facteur double dépend du numéro de créneau. En extérieur, shadowLights ne contient qu'une lampe (ligne 1489) ; d'après la ligne 1551, le créneau 1 reçoit donc la première transitoire s'il y en a une, sinon la lampe ordinaire la plus proche. slot1.mjs (faux WebGL2, 60 images capturées, une transitoire à 6 m) : sur les 60 images, la lampe du créneau 1 (par exemple à 5,8 m de l'œil, puissance 4,5) passe au créneau 2. Son facteur tombe de .27 à .13 (−52 %) pendant toute la vie de la transitoire, puis remonte. Transitoires concernées : explosions (jusqu'à 1,05 s), roquettes en vol, trophées découverts (permanents) (src/effects.js:209-227). Le même saut se produit quand la lampe ombrée change (hystérésis, ligne 1486).

**Cause.** Reste du mode à deux lampes ombrées : le gain .27 suit l'indice du tableau au lieu du rôle de la lumière.

**Proposition.** Donner le facteur par rôle, côté JS. À la ligne 1554, multiplier lightColors par 2,077 (=.27/.13) pour la lampe ombrée, la lampe ordinaire la plus proche et les transitoires. Dans le shader, utiliser attenuation=.13/(1.+d*d*.26) pour toutes. Sans transitoire, l'image reste identique à aujourd'hui. Avec une transitoire, la lampe proche ne bouge plus, et les 2e et 3e transitoires deviennent aussi fortes que la première, ce qui est cohérent.

**Gain attendu.** Supprime un clignotement de l'éclairage principal pendant les combats (roquettes, explosions) et aux changements de lampe ombrée, pour un coût nul.

**Risques.** checks/renderer-destruction.test.mjs:96-101 compare uLightColor avant, pendant et après un blackout : le facteur doit être appliqué de la même façon dans les deux cas, ce qui est garanti s'il est calculé dans la même boucle. Vérifier qu'aucun test d'effets ne lit l'ordre des créneaux. Changement de rendu seulement. +60 octets.

**Vérifier par.** Après correctif, node slot1.mjs ../../ferro out/scene-w0.json : la couleur effective de la lampe proche (facteur compris) doit être identique avec et sans transitoire sur les 60 images. Sur le banc avec fx.lights injectées (spec.fx de pre.js), l'écart d'image hors du halo de la transitoire doit être proche de 0.

**Contre-vérification.** Code relu : renderer.js:316 (i<2?.27:.13), 1551 (lampe ombrée, transitoires, puis ordinaires), effects.js:209-227 ; FERRO : ligne 376. Le défaut est plus large que décrit. (a) Une transitoire prend le créneau 1 même quand elle n'éclaire rien de visible : effects.js:226 garde toute source à moins de range+45 m. Une roquette (portée 5,5 m) à 30 m, ou un trophée découvert (portée 7 m, permanent) à 50 m, assombrit la lampe proche. (b) Sans aucune transitoire, la lumière du créneau 1 change 20 fois par minute en marche (5 changements en 15 s, mondes 0, 4, 9 et 13) : à chaque fois une lampe perd 52 % et une autre double. Le correctif proposé règle le cas des transitoires mais pas (b). Proposition corrigée : (1) éliminer avant l'attribution des créneaux les transitoires à portée finie dont la sphère (p, range) ne coupe pas le frustum caméra : contribution exactement nulle à l'écran, donc exact ; (2) facteur par rôle côté JS comme proposé, mais avec un poids continu pour la lampe ordinaire la plus proche : gain = 1 + 1,077 × clamp((d2 − d1)/3 m, 0, 1), où d1 et d2 sont les distances des deux plus proches. Image inchangée quand la plus proche est nettement détachée, plus de saut au croisement ; (3) si aucune lampe ombrée n'est retenue, donner le facteur aux deux plus proches, pas à une seule, sinon l'image change. Sans transitoire et hors croisement, l'écart est limité à l'arrondi float (.13 × 2,0769 au lieu de .27). Tests : renderer-destruction.test.mjs:96-101 lit uLightColor, donc appliquer le facteur dans la même boucle que le blackout.

**Preuve corrigée.** Mesure d'image indépendante (même variante de base, même caméra, une seule transitoire de type roquette ajoutée 30 m devant, puissance 3,5, portée 5,5 m) : en salle du monde 0, 25,6 % des pixels changent de plus de 3 niveaux, 8,7 % de plus de 10, luminance moyenne −2,1 % (pire image −4,5 %) ; monde 17 : 38,7 % > 3 niveaux, −2,6 % ; en extérieur de jour : 2,6 % > 3 niveaux. Fichiers : bancs/rgpu-verif2/out/A.json et out/B.json (champ pairs), worldscan.mjs pour les changements de créneau.

**Gain corrigé.** Supprime un saut d'éclairage de 2 à 4,5 % de la luminance de l'image à chaque transitoire lointaine et 20 sauts par minute en marche ; coût nul.

### RGPU-06 — Particules translucides : coût proportionnel à la surface couverte, dont la moitié en bruit sinusoïdal
- sévérité moyenne · catégorie perf-gpu · effort M · gain mesuré
- contre-vérification : **plausible**, priorité P3 · qualité dégradée · moteur et jeu
- lieux : src/renderer.js:408-427; src/renderer.js:697-709; src/renderer.js:1414-1421; src/effects.js:16

**Preuve.** src/renderer.js:408-410 : noise() fait 3 sin. Elle est appelée une fois (ligne 417), une fois de plus pour le feu (419) et deux fois de plus pour la fumée (423). Le mélange se fait sans écriture de profondeur (1419) : sur GPU à tuiles, le surdessin translucide est payé en entier. Le budget ne compte que le nombre de particules (src/effects.js:16 : [48,96,144]). Stress (inject de pre.js : 48 bouffées entre 2,5 et 12 m, taille 2,6 m) : +1,2 à +1,6 ms GPU (+19 à +23 %) en auto (runC, runK), +2,9 ms (+25 %) en haute (runF). Avec le bruit remplacé par une constante (fxnoise0) : +0,6 ms, soit la moitié du surcoût. Avec les mêmes bouffées à 6–14 m : +0,5 ms. Avec une taille divisée par 2 : +0,4 ms (runK).

**Cause.** Le coût suit la surface d'écran couverte, dominée par les bouffées proches de la caméra, et l'ALU du bruit est recalculée à chaque couche. Aucun plafond en pixels.

**Proposition.** (1) Une texture de bruit 64×64 R8 tuilable générée par code à l'initialisation (conforme à AGENTS.md), partagée avec RGPU-12 : 1 ou 2 lectures au lieu de 3 à 12 sin. (2) Dans packEffects, estimer la couverture de chaque particule par π(r·f/z)²/(4·aspect) et plafonner la somme à environ 2,5 écrans, en atténuant d'abord les particules cosmétiques (jamais fxPriority 'hazard' ni les particules obligatoires). Si la caméra est dans la sphère (z<r), réduire rayon et alpha. (3) En haute, quand le gouverneur est bas, rendre les FX dans une cible à demi-résolution composée en post (coût estimé ×0,3).

**Gain attendu.** −0,5 à −0,8 ms GPU dans les pics de combat en auto (sur +1,2 ms mesurés), −1,2 à −1,8 ms en haute, et moins de saccades aux explosions proches.

**Risques.** L'aspect de la fumée (motif) est à valider visuellement. Les télégraphes de danger (vMaterial ≥ 15,5) doivent rester lisibles. À relancer : checks/effects.test.mjs (budgets) et checks/renderer-destruction.test.mjs:64-67 (FX hors des passes d'ombre, rendus avant l'arme). Changement de rendu seulement. +0,6 Ko.

**Vérifier par.** Banc cfg/runK.json : python3 -I paired.py out/runK.json stress. Ajouter une variante fxtex et viser au plus +0,6 ms sur le stress.

**Contre-vérification.** Code relu : FX_FRAG 408-427 (3 sin par appel ; 1 appel pour grain, 1 pour le feu, 2 pour la fumée), mélange sans écriture de profondeur ligne 1419, budget effects.js:16 (96 particules en auto, donc le stress de 48 bouffées est atteignable). Je n'ai pas rejoué le stress moi-même. Le surcoût relevé par le banc du vérificateur interrompu (relu) est la moitié de celui annoncé. Les trois remèdes changent l'image : la texture de bruit déplace le motif, le plafond de couverture retire de la fumée, la demi-résolution floute. Aucun n'est acceptable par défaut. Deux pistes sans perte à mesurer d'abord : de vraies branches sur la matière (variable flat, donc branche cohérente) pour ne payer le bruit du feu et de la fumée que sur ces particules ; et le fondu de proximité de RGPU-V3, qui corrige un défaut et réduit le surdessin des bouffées proches.

**Preuve corrigée.** Banc du vérificateur interrompu (bancs/rgpu-verif/out/v2a.json, harnais vrun2.js relu, débit pipeliné, 18 blocs) : 48 bouffées +0,64 ms (+24 %) en extérieur, +0,58 ms (+19 %) en intérieur ; bruit constant : +0,37 et +0,33 ms, soit 42 % du surcoût dû au bruit. Le premier tour annonçait +1,2 à +1,6 ms en mode latence.

**Gain corrigé.** Au plus −0,25 ms dans un pic de 48 bouffées proches en auto (part du bruit), contre −0,5 à −0,8 ms annoncés.

### RGPU-07 — Vignette, voile de dégâts et onde d'impulsion appliqués aux seuls fragments de géométrie : ciel et particules y échappent, vignettes incohérentes et doublées en CSS
- sévérité moyenne · catégorie bug · effort M · gain qualitatif
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · moteur et jeu
- lieux : src/renderer.js:370-377; src/renderer.js:490-491; src/renderer.js:428-439; src/style.css:1; src/game.js:61; src/game.js:714-715; src/index.html:14

**Preuve.** src/renderer.js:370-377 : la vignette mix(.59,1.,v), le voile rouge hurt (jusqu'à 60 % aux bords) et l'onde uEffects.w sont dans le shader des matériaux. SKY_FRAG (lignes 490-491) a une vignette mix(.76,1.,v) et aucun uEffects. Conséquence en extérieur : pendant les dégâts, la géométrie vire au rouge mais pas le ciel voisin, et l'anneau d'impulsion est coupé par le ciel. Au coin (0,02 ; 0,02), la géométrie est assombrie à ×0,80 contre ×0,88 pour le ciel. FX_FRAG (428-439) n'a ni vignette ni voile, d'où une fumée plus claire que le fond assombri. S'y ajoutent trois problèmes CSS. #vignette (src/style.css:1, box-shadow inset 0 0 20vw rgba(3,8,9,.45) ; src/index.html:14) se superpose, ce qui assombrit les coins trois fois. L'opacité de #damage (inset 18vw 5vw) est réécrite à chaque image (src/game.js:714-715). La luminosité passe par canvas.style.filter (game.js:61), ce qui ajoute une passe de composition plein écran dès qu'elle diffère de 1.

**Cause.** Les effets d'écran sont implémentés dans chaque matériau au lieu d'une passe d'écran unique qui couvre chaque pixel une fois.

**Proposition.** Déplacer vignette, voile, onde et luminosité dans la composition (POST_FRAG uPass==2, ligne 517), qui couvre ciel, géométrie, particules et arme. Sans bloom, utiliser une petite passe plein écran équivalente. Retirer ces termes de FRAG (environ 12 ALU de moins par fragment ombré). Garder #vignette et #damage en CSS seulement pour le repli Canvas2D, et n'écrire style.opacity que si la valeur change.

**Gain attendu.** Corrige une incohérence visible en combat extérieur. Retire 1 à 3 calques de composition plein écran (estimé à 0,3 ms au plus sur M5, davantage sur mobiles à DPR 3) et allège un peu l'ALU sur les GPU sans tuiles (surdessin mesuré : 1,70).

**Risques.** L'arme (overlay) doit garder son voile. Les réglages vignette et luminosité deviennent des uniformes (src/game.js:60-61). Accessibilité : l'intensité doit rester réglable. Aucun test ne lit #vignette, et le repli Canvas2D ne change pas. +0,3 Ko.

**Vérifier par.** Banc RGPU avec spec.fx {damage:0.8,pulse:0.5} en extérieur : comparer la teinte moyenne du ciel et de la géométrie sur les bords (readPixels) avant et après ; captures file://.

**Contre-vérification.** Code relu : FRAG 370-377 (vignette .59, voile, onde), SKY_FRAG 490-491 (vignette .76, pas de uEffects), FX_FRAG sans vignette ni voile, style.css #vignette et #damage, index.html:14, game.js:61 et 714. Calcul vérifié au coin (0,02 ; 0,02) : ×0,80 pour la géométrie, ×0,88 pour le ciel. Constat de plus : l'option « vignette » (game.js:60) ne masque que le calque CSS ; la vignette du shader reste toujours active, donc le réglage d'accessibilité est inopérant en WebGL. Réserve sur le remède : la passe post n'existe que si le bloom est actif (renderer.js:1565 : cible nulle sinon) et jamais en qualité low ; tout déplacer en post impose une passe plein écran de plus dans ces modes. Variante plus simple et exacte : une fonction GLSL commune screenFx(color) appelée dans FRAG, SKY_FRAG et FX_FRAG. Pour une couche translucide, vignette (multiplicatif), voile (mix) et onde (additif) commutent avec le mélange alpha, donc le résultat est identique à une passe finale. Ajouter un uniforme d'intensité de vignette lié à l'option. Le gain de performance annoncé (0,3 ms) n'est pas mesuré.

**Gain corrigé.** Correction visuelle ; gain de performance non mesuré, à ne pas compter.

### RGPU-08 — Rendu 3D complet à chaque image derrière la pause et la boutique (image figée), flou backdrop-filter recalculé
- sévérité moyenne · catégorie perf-gpu · effort S · gain estimé
- contre-vérification : **confirmé**, priorité P2 · qualité identique · jeu
- lieux : src/game.js:675-722; src/style.css:1

**Preuve.** src/game.js:675-722 : seuls document.hidden et le mode 'loading' arrêtent le rendu. En 'paused' et 'shop', la simulation ne tourne pas (ligne 681) et t=sim.state.time reste constant (717) : l'image est identique. Pourtant renderer.draw (722) refait ombres, scène et post, soit 5,2 à 5,7 ms GPU mesurés en auto et 12,7 à 14,6 ms en haute. .modal-screen (src/style.css:1) applique backdrop-filter:blur(10px), qui doit reflouter le canvas à chaque nouvelle image. Au menu et dans les options, la caméra oscille (721) à plein régime sans gouverneur (adaptive=false).

**Cause.** Boucle de rendu inconditionnelle, sans notion d'image à redessiner.

**Proposition.** Ajouter un drapeau sceneDirty, levé à l'entrée en pause ou en boutique, par settings(), par resize, par webglcontextrestored et au retour en jeu. En pause et en boutique, ne pas appeler renderer.draw tant qu'il est baissé : le canvas garde la dernière image présentée. Au menu et dans les options, limiter à 30 images par seconde avec une échelle réduite.

**Gain attendu.** Supprime tout le coût GPU et CPU de rendu pendant la pause et la boutique (environ 6 à 17 ms par image à 60 Hz selon la qualité, d'après la scène de jeu mesurée) : moins de chauffe et de batterie sur portables et mobiles, menus plus fluides sur iGPU.

**Risques.** Un réglage modifié en pause doit déclencher un redessin. En cas de perte de contexte en pause, restored() doit forcer le dessin. Tests first-person et options à relancer. Aucune incidence sur la simulation ni les sauvegardes. +150 octets.

**Vérifier par.** Harnais pre.js : en pause, le nombre de drawElementsInstanced par seconde doit tomber à 0 après la première image, et la capture doit rester identique avant et après.

**Contre-vérification.** Code relu : game.js:675-722. Seuls document.hidden et 'loading' arrêtent la boucle ; hors 'playing', la simulation ne tourne pas, motion.update reçoit dt=0, t=sim.state.time est constant et renderer.draw (722) est appelé à chaque image. Le constat vaut aussi pour 'dead', 'cleared' et 'complete', pas seulement pause et boutique. Compléments indispensables : lever le drapeau aussi sur visibilitychange et focus (certains navigateurs mobiles libèrent le tampon d'un canvas en arrière-plan) et après webglcontextlost, car game.js:840 met alors le jeu en pause : la première image après restauration doit être dessinée. Le gain est en chauffe et en batterie, pas en fluidité de jeu. Non mesuré par moi (lecture de code).

**Gain corrigé.** Coût de rendu ramené à zéro sur les écrans figés, soit 4,7 à 5,5 ms par image en auto et 11 à 13 ms en haute (débit pipeliné mesuré sur la scène de jeu).

### RGPU-09 — Gouverneur de résolution calé sur 60 Hz, piloté par l'intervalle rAF, lent, et qui réalloue les cibles à chaque pas
- sévérité moyenne · catégorie saccade · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur et jeu
- lieux : src/renderer.js:746-764; src/renderer.js:1319; src/renderer.js:1391; src/game.js:677; src/game.js:722

**Preuve.** src/renderer.js:746-764 : le gouverneur n'agit qu'en 'auto' avec fx.adaptive (ligne 751 ; src/game.js:722 : en jeu, fenêtre active, fpsLimit à 0 ou ≥ 60). Son signal est frameMs, l'intervalle rAF (game.js:677), quantifié par la synchro verticale. Il baisse de 0,1 après 1,3 s au-dessus de 25 ms (758-759) et remonte de 0,05 après 5 s sous 18,5 ms (760). À 120 Hz, une image de 10 à 16 ms (cible ratée) compte comme rapide. À 60 Hz, une image tout juste à l'heure et une image avec 8 ms de marge sont indiscernables, d'où des oscillations. Chaque pas change canvas.width/height (1391) et la clé des cibles (1319) : freePost, puis réallocation de la scène RGBA8 + profondeur, des 2 cibles de bloom (≈15 Mo en auto, ≈46 Mo en haute) et du tampon du canvas. Minuterie GPU : sous ANGLE Metal, EXT_disjoint_timer_query_webgl2 a rendu des valeurs cumulées, avec seulement 11 résultats disponibles sur 40 (probe2, probe3).

**Cause.** Le régulateur a été conçu comme filet de sécurité à 60 Hz, sans mesure de marge, et la résolution dynamique passe par un redimensionnement du canvas.

**Proposition.** Cible : min(intervalle vsync médian mesuré au menu, 1000/fpsLimit) × 0,9. Signal : le maximum entre le temps CPU de frame() (performance.now) et le temps GPU d'une requête TIME_ELAPSED quand il est disponible et plausible ; à défaut, la latence d'une fence fenceSync interrogée sans blocage. Baisse rapide (0,5 s, surface ×0,85), hausse lente (3 s, ×1,08), avec hystérésis. Résolution dynamique par viewport dans des cibles allouées une fois à la taille maximale, avec un facteur d'échelle en uniforme dans la passe post qui échantillonne déjà la scène : plus aucune réallocation. Actif aussi en haute, avec un plancher de 0,8.

**Gain attendu.** Supprime les accrocs dus aux réallocations (estimés à 5–30 ms par pas). Réaction en environ 0,5 s au lieu de 1,3 s au moins. Tenue des écrans 120 Hz en auto (estimé).

**Risques.** checks/renderer-destruction.test.mjs:51 (65 images à 50 ms donnent renderScale < 1, valeur conservée après updateWorld) doit rester vert. Désactiver le gouverneur en mode banc et en test pour la reproductibilité. Aucun effet sur la simulation (dt inchangé). +1 Ko.

**Vérifier par.** Banc RGPU avec adaptive:true et une charge GPU contrôlée (variante stress) : tracer renderScale et frameMs. Le compteur createTexture/renderbufferStorage doit rester à 0 après la chauffe. Puis npm test.

**Contre-vérification.** Code relu : renderer.js:746-764, 1319, 1391 ; game.js:677 et 722 ; FERRO : ligne 806. Prouvé en exécutant le vrai gouverneur extrait du source avec un coût modélisé (25 % fixe, 75 % proportionnel aux pixels) et une présentation calée sur la synchro verticale. Cela répond à la demande « images par seconde plus stables partout », et une démo longue sur une machine qui chauffe retombe exactement dans la zone d'oscillation. Corrections de la proposition : (1) la minuterie GPU est inutilisable sous ANGLE Metal (valeurs cumulées), il faut donc un repli sans elle : temps CPU de frame() et régularité des intervalles rAF ; (2) le rendu par viewport dans des cibles fixes exige que la passe post existe aussi sans bloom et en low, que uResolution, la vignette (gl_FragCoord) et les texels du bloom utilisent la taille du viewport, et que l'aspect de actorFilter (ligne 1502) suive ; (3) aujourd'hui le gouverneur est coupé hors 'playing' et sans focus (game.js:722) : voir RGPU-V2 pour la démo. Le test renderer-destruction.test.mjs:51 (65 images à 50 ms donnent renderScale < 1) doit rester vert.

**Preuve corrigée.** bancs/rgpu-verif2/gov.mjs : à 60 Hz, pour un coût de 17,5 à 22 ms à l'échelle 1, le gouverneur oscille sans fin (1→0,9→0,95→1→0,9…) avec 10 à 11 changements d'échelle par minute et 10 à 13 % d'images ratées, par salves de 1,3 s à 30 images/s toutes les 17 s environ ; à 120 Hz ou 144 Hz, pour un coût de 9 à 20 ms, 100 % des images ratent la cible et l'échelle ne bouge jamais. Réallocation mesurée dans Chrome (16 cycles, même chemin que le gouverneur) : image normale 8,5 ms, image avec redimensionnement 14,7 ms en médiane, 19,6 ms au p90 ; CPU JS synchrone 1,6 → 6,3 ms (max 7,5).

**Gain corrigé.** Supprime 10 à 11 accrocs par minute de +6 ms en médiane (+11 ms au p90, et non 5 à 30 ms) ainsi que les salves à 30 images/s dans la zone marginale ; rend le gouverneur actif à 120 Hz, où il est inerte aujourd'hui.

### RGPU-10 — Aucun anticrénelage : MSAA 4× mesuré à +20 %, FXAA dans la composition proposé
- sévérité moyenne · catégorie 3d-visuel · effort M · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · moteur (dans METAL)
- lieux : src/renderer.js:1276; src/renderer.js:493-519; src/renderer.js:1477-1478

**Preuve.** src/renderer.js:1276 : getContext('webgl2',{antialias:false,...}). POST_FRAG (493-519) n'a aucune passe d'anticrénelage, et les arêtes des boîtes, des octaèdres et du feuillage sont crénelées à 1668×1079. Variante msaa4 (renderbuffers 4× + blitFramebuffer, runG) : +1,2 ms GPU (+19,7 %), 1,66 % des pixels changent de plus de 3 niveaux (les arêtes), MAD 0,21. Le bloom complet (3 passes) coûte environ 0,5 ms : une passe plein écran à 5 ou 6 lectures coûterait donc de l'ordre de 0,2 à 0,3 ms.

**Cause.** Le MSAA a été écarté (coût, cible hors écran) sans alternative en post-traitement.

**Proposition.** Ajouter un FXAA allégé dans uPass==2 en auto et en haute : luminance du centre et de 4 voisins, direction du bord, 2 lectures bilinéaires. Le rendre désactivable dans les options (accessibilité, netteté). Réserver le MSAA 4× à la haute quand le gouverneur a de la marge. Sans bloom, utiliser une mini-passe dédiée.

**Gain attendu.** Arêtes lissées pour environ 0,2 à 0,3 ms (estimé, soit le cinquième du MSAA mesuré à +1,2 ms).

**Risques.** Léger flou des grilles et des vis à haute fréquence : régler un seuil de contraste. Changement de rendu seulement. +0,8 Ko.

**Vérifier par.** Ajouter une variante fxaa dans patches.mjs. Banc cfg/runJ.json : coût apparié, diffs (gt3 concentré sur les arêtes) et captures.

**Contre-vérification.** Code relu : renderer.js:1276 (antialias:false), POST_FRAG sans anticrénelage. Coût du MSAA 4× confirmé par ma mesure. Le coût du FXAA (0,2 à 0,3 ms) reste une estimation. Réserve de qualité : le FXAA adoucit aussi les détails fins des matières (grilles, rivets, bruit à haute fréquence), ce qui contredit « sans perdre la moindre qualité » ; il doit être une option désactivée par défaut. Le MSAA ne floute rien, et comme le shader écrit une couleur déjà tonemappée et en gamma, sa résolution se fait en espace d'affichage, ce qui est correct pour les arêtes. Recommandation : MSAA 4× par défaut en haute et sur GPU dédié (carte NVIDIA : coût relatif attendu plus faible, à mesurer avec RGPU-11), financé par RGPU-03 ; FXAA en option pour l'auto. Contrainte : la cible MSAA est un renderbuffer, à résoudre par blitFramebuffer avant le bloom ; mémoire ×4 sur la couleur et la profondeur.

**Preuve corrigée.** Banc indépendant : msaa4 +0,79 ms (+17,1 %, IC95 +0,59/+1,02) en extérieur, +1,23 ms (+23,1 %) en intérieur, +1,16 ms (+21,1 %) avec transitoires ; 1,1 à 2,9 % des pixels changent de plus de 3 niveaux (les arêtes).

**Gain corrigé.** MSAA 4× : +0,8 à +1,2 ms par image en auto sur M5 pour des arêtes lissées sans flou ; FXAA non mesuré.

### RGPU-11 — Instrumentation : un seul compteur FPS, ni temps par sous-système ni temps GPU
- sévérité moyenne · catégorie perf-cpu · effort M · gain qualitatif
- contre-vérification : **confirmé**, priorité P1 · qualité sans objet · moteur et jeu
- lieux : src/game.js:723-729; src/renderer.js:1281; src/renderer.js:1558-1559

**Preuve.** src/game.js:723-729 : le FPS est seulement moyenné sur 750 ms. Le renderer tient déjà des compteurs, jamais affichés (src/renderer.js:1281, 1547, 1550, 1558-1559 : drawCalls, triangles, instances, uploadBytes, staticVisible, shadowMaps, fxInstances, renderScale). Cette étude a dû passer par un harnais externe : pre.js (synchronisation readPixels, variantes en rotation) et post.js (entrées scriptées). Sous ANGLE Metal, la minuterie GPU donne des valeurs cumulées avec 11 résultats disponibles sur 40 (probe2, probe3), et gl.finish() ne synchronise pas (probe5).

**Cause.** Le jeu n'a ni mode diagnostic intégré ni banc déterministe.

**Proposition.** Un overlay activé par ?perf=1 ou la touche F3 (lue par event.code, donc valable en AZERTY et en QWERTY), dessiné dans un petit canvas 2D. (1) CPU par sous-système avec performance.now : sim.step (692), événements, audio (698-703), renderHUD (713), models (722), et dans draw : culling et emballage (1545-1556), envoi (1561), ombres (1564), scène (1576-1583), post (1584). Anneau de 240 images, p50/p95/p99 et graphe. (2) GPU : une requête TIME_ELAPSED par image, jamais imbriquée, avec contrôle de plausibilité (au plus 2 fois l'intervalle, GPU_DISJOINT), sinon affichage n/d. (3) Les compteurs stats.* et renderScale. (4) Un mode banc ?bench=graine : dt fixe de 1/60, entrées scriptées comme post.js, sauvegarde désactivée, sortie JSON copiable, lançable en CI sur david-pc.

**Gain attendu.** Diagnostic des saccades sur machine réelle et régressions de performance détectables en CI. Coût inférieur à 0,1 ms quand l'overlay est affiché, nul sinon (estimé).

**Risques.** Le mode banc ne doit jamais écrire de sauvegarde ni d'instantané (la validation atomique reste intacte). Aucune dépendance externe. Accessibilité : contraste et taille de police. +3 Ko.

**Vérifier par.** Comparer l'overlay au harnais RGPU sur la même scène (cfg/runJ.json) : l'écart doit rester sous 10 % pour le CPU de draw() et le total. Test unitaire du mode banc : deux exécutions doivent produire les mêmes états échantillonnés.

**Contre-vérification.** Code relu : game.js:723-729 (seul un compteur FPS moyenné sur 750 ms), compteurs stats.* du renderer jamais affichés. La minuterie GPU inutilisable sous ANGLE Metal est confirmée par le banc du vérificateur interrompu (relu, non rejoué). Deux exigences de plus pour que l'outil ne trompe pas : (1) le mode banc doit mesurer un débit pipeliné (N images, une seule synchro) et la régularité des intervalles, pas une synchro readPixels par image, qui a gonflé les temps absolus du premier tour d'un facteur 1,5 à 2 ; (2) il doit tourner sur david-pc avec la carte NVIDIA, car toutes les décisions de cet axe reposent sur un seul GPU Apple à tuiles (voir RGPU-V1). Le cœur (anneau de mesures, percentiles, compteurs, requête GPU avec contrôle de plausibilité) est générique et va dans FERRO ; les entrées scriptées et le branchement dans game.js restent dans METAL.

**Preuve corrigée.** bancs/rgpu-verif/out/v2b.json et v2c.json : requêtes TIME_ELAPSED à 4,5 puis 15,9, 31,5, 41,6 ms… (valeurs cumulées), puis 100 à 330 ms pour des images de 5 à 12 ms ; 164 à 216 résultats disponibles sur 240 ; GPU_DISJOINT jamais levé. Écart de méthode mesuré par moi : base 4,65 ms en débit pipeliné contre 10,1 ms en synchro par image ; haute 11,2 contre 22,4 ms.

### RGPU-12 — Bruit de valeur des matériaux : 4 hash ALU par appel, 3 à 8 appels par pixel
- sévérité basse · catégorie perf-gpu · effort M · gain mesuré
- contre-vérification : **plausible**, priorité P3 · qualité dégradée · moteur (dans METAL)
- lieux : src/renderer.js:86-95; src/renderer.js:167-170; src/renderer.js:1337-1362

**Preuve.** src/renderer.js:86-95 : hash et noise. Appels systématiques aux lignes 169-170 : grain fait 2 appels, dont uv*71 calculé même quand fineDetail=0, et broad 1 appel. S'y ajoutent, selon le matériau, les lignes 189, 207, 210, 216, 238, 242-248 et 260-261, et le reflet (348). Bruit constant (nomat) : −0,5 ms en auto, −1,2 ms en haute (−10,5 %). Variante noisetex (texture R8 256×256 en REPEAT/LINEAR, remplie à l'initialisation par le même hash en JS, noise()=texture(uNoise,(a+b+.5)/256)) : −0,3 ms GPU en auto (−5,8 %, IC95 −0,4/−0,2) et −1,05 ms en haute (−7,7 %) (runL). L'image garde la même statistique mais le motif est décalé (période de 256 cellules, quantification sur 8 bits) : MAD 1,10, 2,4 % des pixels à plus de 10 niveaux.

**Cause.** Le value noise est évalué en ALU (4 hash et 3 mix) pour chaque fragment, alors qu'une lecture de texture filtrée coûte bien moins cher sur les GPU Apple et mobiles.

**Proposition.** Dans initialize(), donc aussi à la restauration du contexte, créer la texture R8 256×256 à partir du hash existant. noise() lit la texture après le lissage smoothstep. Garder hash() pour les usages par cellule (lignes 199, 249-252, 262). Lier la texture sur TEXTURE3, à côté de l'atlas (ligne 1574). En option : un 2e canal décorrélé pour broad, et la même texture pour SKY_FRAG (466-471 : 4 octaves + 3 crêtes) et FX_FRAG (RGPU-06).

**Gain attendu.** −0,3 ms en auto, −1,0 ms en haute (mesuré) ; davantage sur iGPU et mobiles dont l'ALU est plus faible (estimé).

**Risques.** Le motif procédural change : pas de perte de détail, mais rayures, nœuds et feuilles se déplacent. Revue visuelle à faire sur les 3 biomes. Une unité de texture de plus. Le repli Canvas2D n'est pas concerné. Conforme à AGENTS.md (texture générée par code). +0,5 Ko.

**Vérifier par.** Banc cfg/runL.json (variantes noisetex et high-noisetex). Captures file:// avant et après sur le bois (mat 10), le feuillage (11) et l'acier brossé (0).

**Contre-vérification.** Code relu : hash et noise 86-95, appels systématiques 169-170. Non rejoué par moi ; le banc du vérificateur interrompu (relu) donne un gain plus élevé que le premier tour. Mais l'image n'est pas identique et ne peut pas l'être : la texture boucle sur 256 cellules alors que hash() reçoit des coordonnées de cellule non bornées, donc le motif change forcément, avec en plus une quantification sur 8 bits des valeurs et des poids bilinéaires. Ce n'est pas une perte de détail, mais ce n'est ni « identique » ni « visuellement identique » au sens de la règle : à garder comme option désactivée par défaut, ou à faire valider par David sur captures. Risque accru dans FERRO : les matières de Point de rupture (façades, asphalte, dallage, lignes 276-331 du renderer FERRO) seuillent le même bruit, donc la périodicité peut s'y voir.

**Preuve corrigée.** bancs/rgpu-verif/out/v1.json (débit pipeliné, 24 blocs) : noisetex −0,56 ms (−13,4 %) en extérieur, −0,50 ms (−9,8 %) en intérieur, −0,42 ms avec transitoires. Image : MAD 0,93 à 1,27 ; 9 à 12 % des pixels à plus de 3 niveaux ; 0,9 à 1,1 % à plus de 10 ; jusqu'à 0,26 % à plus de 25.

**Gain corrigé.** −0,4 à −0,56 ms en auto (−10 à −13 %) en débit pipeliné, au lieu de −0,3 ms ; avec un motif différent.

### RGPU-13 — Lumières du monde sans portée : 8 des 12 lumières évaluées n'apportent rien ; éclairage clustered non justifié aujourd'hui
- sévérité basse · catégorie perf-gpu · effort M · gain mesuré
- contre-vérification : **plausible**, priorité P3 · qualité dégradée · moteur (dans METAL)
- lieux : src/renderer.js:1554; src/renderer.js:317; src/renderer.js:1481-1490; src/renderer.js:1551

**Preuve.** worldstats.mjs : 37 à 47 lumières par monde, aucune avec une portée (rangeZero = total, sur les 21 mondes). src/renderer.js:1554 écrit lightRanges[i]=light.range||0, donc la ligne 317 ne coupe jamais. La sélection (1551) prend les 12 lumières les plus proches de l'œil (tri à la ligne 1483). lcount (runC) : 4,08 des 12 lumières dépassent 0,004 au pixel, 1,48 sont à moins de 16 m et 0,28 à moins de 8 m. Portée automatique (lightcull2 : fenêtre (1−(d/R)⁴)², R choisi pour une contribution < 0,004) : −0,5 à −0,7 ms GPU seule, MAD 0,24. Portée fixe de 24 m : −0,4 ms (MAD 0,31). Combinée à RGPU-01 en revanche, spec4 + portée 16 m donne −0,4 ms et split + portée −0,5 ms, contre −0,6 à −0,8 ms pour spec4 seul (runH, runI).

**Cause.** Sans rayon d'influence, chaque pixel paie toutes les lumières retenues. Mais une fois RGPU-01 appliqué, ce qui reste (un diffus d'environ 15 ALU par lumière) coûte moins que la divergence qu'introduirait une coupure.

**Proposition.** Calculer au setWorld R=√(((k·P/0,004)−1)/0,26), avec k=.13 (R entre 13 et 40 m environ). Utiliser R pour : (a) trier la sélection par contribution P/(1+.26d²) plutôt que par distance ; (b) appliquer la fenêtre douce par simple multiplication, sans continue, ce qui supprime la discontinuité au 12e rang. Ne pas implémenter de grille clustered ou tiled tant qu'il y a au plus 12 lumières utiles (1,5 lumière à moins de 16 m par pixel). La reconsidérer si un niveau dépasse environ 24 lumières visibles (texture d'indices 16×9×16).

**Gain attendu.** Sans RGPU-01 : −0,4 à −0,7 ms GPU. Avec RGPU-01 : gain GPU proche de 0, mais éclairage lointain stable.

**Risques.** L'éclairage lointain devient un peu plus faible (MAD 0,24 à 0,31). checks/renderer-destruction.test.mjs lit uLightPosition et uLightColor, donc l'ordre des lumières : à revoir si le tri change. Changement de rendu seulement. +200 octets.

**Vérifier par.** Bancs cfg/runH.json et cfg/runI.json (variantes lightcull2, lcR24, splitW, spec4R16), avec paired.py et les diffs.

**Contre-vérification.** Faits confirmés indépendamment : aucune des 37 à 47 lumières n'a de portée dans les 5 mondes testés (0, 4, 9, 13, 17) ; renderer.js:1554 écrit light.range||0 et la ligne 317 ne coupe donc jamais. Je n'ai pas rejoué les variantes de portée. Le constat reconnaît lui-même que le gain GPU tombe à zéro une fois RGPU-01 appliqué, et la fenêtre douce assombrit l'éclairage lointain (MAD 0,24 à 0,31 d'après ses propres mesures) : c'est une perte, à écarter. À garder seulement : le classement de la sélection par contribution P/(1+.26d²) au lieu de la distance, déjà demandé pour RGPU-01 et RGPU-05, qui choisit de meilleures lumières sans retirer de lumière. D'accord pour ne pas faire de grille clustered. Attention au test renderer-destruction.test.mjs, qui lit l'ordre de uLightPosition.

**Gain corrigé.** Gain GPU nul ; seule la stabilité du choix des 12 lumières s'améliore.

### RGPU-14 — Qualité de lumière à coût maîtrisé : cascade soleil proche, brouillard diffusant, fumée éclairée par les explosions
- sévérité basse · catégorie 3d-visuel · effort L · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · moteur (dans METAL)
- lieux : src/renderer.js:1440-1459; src/renderer.js:364-367; src/renderer.js:428; src/effects.js:209-216

**Preuve.** Le soleil n'a qu'une vue : 56 m à 512 px en auto (0,11 m/texel), 72 m à 1024 px en haute (0,07 m/texel) (src/renderer.js:1443). Une tuile d'atlas est libre et la tuile torche récupérable (RGPU-04). Le brouillard est exponentiel, sans diffusion (364-367). Les FX ne sont pas éclairés : FX_FRAG ligne 428, color=vColor.rgb*(uAmbient*.65+vec3(.34)+...), ignore les explosions et roquettes (src/effects.js:209-216) ainsi que l'éclair de bouche. Coût de référence mesuré : retirer la passe soleil fait gagner 0,4 ms GPU et 0,3 ms CPU.

**Cause.** Le budget GPU est absorbé par la boucle de lumières et par la torche ; les FX ont été laissés non éclairés.

**Proposition.** (a) Une cascade soleil proche (±10 m, 512 px, soit 0,04 m/texel) dans la tuile torche, choisie par distance dans shadow() (branche uniforme). actorFilter doit inclure son volume. Coût estimé : à peu près celui d'une passe soleil (+0,4 ms GPU), le CPU restant contenu par le cache de RGPU-03. (b) Une diffusion vers le soleil dans le brouillard : fogColor+=uSunColor*pow(max(dot(-view,uSunDirection),0.),8.)*.35*outdoors, et la même chose dans SKY_FRAG (environ 6 ALU, moins de 0,05 ms estimé). (c) Dans FX_FRAG, éclairer fumée et étincelles par la transitoire la plus forte (un uniform vec4 position + puissance) et par uEffects.y (environ 10 ALU, moins de 0,1 ms hors stress).

**Gain attendu.** Ombres nettes au premier plan en extérieur, explosions qui éclairent leur fumée, profondeur atmosphérique. Coût total estimé de +0,4 à +0,6 ms, financé par RGPU-01 et RGPU-04.

**Risques.** Le biais d'ombre est à régler par cascade. checks/actor-visibility.test.mjs vérifie que tout acteur rejeté sort de toutes les passes réelles : il faut y ajouter le volume de la cascade. Changement de rendu seulement. +1 Ko.

**Vérifier par.** Ajouter les variantes dans patches.mjs. Banc cfg/runJ.json en apparié pour le coût, captures avant et après, puis npm test (actor-visibility).

**Contre-vérification.** Code relu : vue soleil unique (1440-1459, 28 ou 36 m de demi-étendue), brouillard exponentiel 364-367, FX non éclairés ligne 428. Tous les coûts sont des estimations. Corrections : (a) la cascade proche ne peut pas prendre la tuile de la torche, car la passe torche doit rester (RGPU-04 réfuté) ; elle doit utiliser la 4e tuile, confirmée libre. Dans FERRO, Point de rupture utilise le soleil en plein atlas (uShadowSettings.w>1.5) : la cascade doit être coupée dans ce mode, et rester désactivée par défaut pour qu'un jeu de la v0.2 marche sans réglage. Elle ajoute un quatrième volume à actorFilter (test actor-visibility) et relève le coût CPU que RGPU-03 doit d'abord réduire. (b) et (c) changent la direction artistique : à livrer derrière un réglage et à valider sur captures. Sert la demande « photoréaliste », mais passe après la stabilité.

**Gain corrigé.** Qualité seulement ; coût estimé de +0,4 à +0,6 ms, non mesuré.

### RGPU-15 — Lisibilité et matière : liseré des ennemis, occlusion ambiante, impacts procéduraux
- sévérité basse · catégorie 3d-visuel · effort L · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité meilleure · moteur et jeu
- lieux : src/renderer.js:172; src/renderer.js:304-308; src/renderer.js:1309-1316; src/renderer.js:674-677

**Preuve.** Le shader ne distingue pas un ennemi d'un décor : vObject indique seulement un objet (ligne 172). Il n'y a aucune occlusion ambiante, l'ambiant ne dépend que de n.y (304-308), et aucune trace d'impact ne persiste. La profondeur de scène est un renderbuffer (1312), donc pas d'occlusion ambiante écran sans modification. Coût de référence mesuré : une passe plein écran légère coûte environ 0,2 ms à 1,8 MPix (le bloom, en 3 passes, environ 0,5 ms).

**Cause.** La direction artistique repose sur une matière procédurale, sans information de rôle par instance ni passe de profondeur lisible.

**Proposition.** (a) Liseré : un bit 8 dans surfaceFlags (674-677) pour les acteurs ennemis, puis color+=rim*pow(1.-nv,3.)*.35 (environ 5 ALU, moins de 0,05 ms). (b) Occlusion ambiante, deux options. La première est quasi gratuite : par instance, assombrir le bas des pièces posées via vLocal.y dans le vertex shader (environ 3 ALU). La seconde est écran, au quart de résolution : profondeur en texture DEPTH_COMPONENT24, 8 lectures à 0,45 MPix et flou bilatéral, appliquées en composition, estimée à +0,4 à 0,6 ms. (c) Impacts et brûlures : un anneau de 64 instances box plates (s≈[.25,.004,.25]) orientées sur la normale, avec un matériau procédural radial et polygonOffset, en un seul draw call (moins de 0,05 ms).

**Gain attendu.** Ennemis lisibles à distance et en sous-bois, volumes mieux posés, retour visuel des impacts. Coût total estimé de +0,5 à +0,7 ms avec l'occlusion écran.

**Risques.** Les décalques sont purement visuels : ils sont alimentés par les événements de simulation et jamais l'inverse, le déterminisme reste intact. Ne pas les mettre dans les instantanés (validation atomique inchangée). checks/actors.test.mjs est concerné si un drapeau d'acteur est ajouté. Tout reste généré par code (AGENTS.md). +1,5 Ko.

**Vérifier par.** Ajouter les variantes dans patches.mjs, mesurer le coût sur le banc apparié et faire des captures comparatives par biome.

**Contre-vérification.** Code relu : surfaceFlags 674-677 (bits 1, 2, 4 ; pas de rôle ennemi), ambiant fonction de n.y seulement (304-308), profondeur de scène en renderbuffer (ligne 1312). Faisable, mais tout est estimé et rien n'est prototypé. Réserves : le liseré est un choix de lisibilité de jeu qui modifie le rendu des ennemis, donc à valider par David et à rendre réglable ; l'occlusion écran exige de passer la profondeur en texture et une passe de plus, à ne lancer qu'après RGPU-09 et RGPU-11 ; les décalques ne doivent pas entrer dans les instantanés de sauvegarde. Le drapeau de rôle par instance et le shader vont dans FERRO, l'alimentation par les événements de simulation dans METAL.

**Gain corrigé.** Qualité seulement ; coût estimé de +0,5 à +0,7 ms avec l'occlusion écran, non mesuré.

## Constats ajoutés par le contre-vérificateur

### RGPU-V1 — Toutes les décisions de l'axe reposent sur un seul GPU Apple à tuiles : aucun chemin ni mesure pour les GPU immédiats (carte NVIDIA)
- sévérité haute · catégorie perf-gpu · effort M · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1566; src/renderer.js:1460-1467; src/renderer.js:1576-1577; src/renderer.js:1359; src/renderer.js:1276

**Preuve.** Toutes les mesures du premier tour et les miennes viennent d'un seul matériel : « ANGLE (Apple, ANGLE Metal Renderer: Apple M5) » (info.renderer de bancs/rgpu-verif2/out/A.json). Le résumé RGPU classe comme réfutées la pré-passe de profondeur (+1,2 ms), le tri avant-arrière (+0,5 ms) et juge le ciel après l'opaque à « 0 à −0,3 ms », en précisant lui-même que c'est propre au rendu par tuiles. Or il mesure 1,70 fragment opaque ombré par pixel couvert (1,54 trié), et le shader coûte cher par fragment : 12 lumières avec GGX (renderer.js:311-322), 9 lectures d'ombre soleil (147-150), 3 à 8 bruits. Sur un GPU immédiat, chaque fragment recouvert est payé. Le ciel est dessiné en premier, sans test de profondeur (renderer.js:1460 et 1566), avec 4 octaves et 3 bruits de crête par pixel (466-489), puis recouvert par le décor. Ma mesure : ciel après l'opaque = image exacte (MAD 0, 0 pixel différent sur 7 scènes) et gain non significatif sur M5 (+0,12 ms, IC95 −0,08/+0,42).

**Cause.** L'audit a optimisé pour le GPU du banc. Un rendu par tuiles élimine les surfaces cachées avant d'ombrer ; un GPU immédiat (NVIDIA, Intel, AMD de bureau) ombre dans l'ordre de soumission. Les conclusions « réfutées » ne se transposent donc pas à la cible que David demande explicitement d'exploiter.

**Proposition.** (1) Ciel après l'opaque, partout : dessiner skyPass après renderBatch(dynamicBatch) et avant les FX, test de profondeur actif, profondeur du triangle fixée au plan lointain (gl_Position.z = gl_Position.w dans POST_VERT pour ce programme), depthMask(false). Image exacte, gratuit sur tuiles, gagnant ailleurs. (2) Détecter la famille de GPU une fois à l'initialisation par WEBGL_debug_renderer_info (repli : gl.RENDERER) : tuiles = Apple, Mali, Adreno, PowerVR ; immédiat sinon. Exposer stats.gpuClass. (3) Sur GPU immédiat seulement, émettre les groupes statiques visibles par cellule de l'index spatial, de la plus proche à la plus lointaine, sans changer l'ordre à l'intérieur d'une cellule. (4) N'activer une pré-passe de profondeur que si le banc de RGPU-11, lancé sur david-pc, montre un gain. Critère d'acceptation : sur david-pc, temps GPU de la scène de référence en baisse d'au moins 10 % avec (1) et (3), et écart d'image nul.

**Gain attendu.** Estimé, à mesurer sur david-pc : le tri récupère jusqu'à 9 % des fragments opaques ombrés (1,70 vers 1,54), une pré-passe jusqu'à 41 % (1,70 vers 1,0) ; le ciel après l'opaque évite son shader sur tous les pixels couverts par le décor. Aucun gain sur Apple.

**Risques.** depthFunc vaut LEQUAL (renderer.js:1359) : à profondeur égale, le dernier dessiné gagne, donc réordonner peut changer le vainqueur entre surfaces coplanaires (gravats, panneaux). Il faut trier par cellule entière, garder l'ordre interne et vérifier l'écart d'image nul. La détection par chaîne de renderer peut être masquée par le navigateur : repli sur le comportement actuel. Aucun effet sur la simulation ni les sauvegardes. Compatible FERRO : comportement inchangé sur tuiles. Environ +0,4 Ko.

**Vérifier par.** Sur david-pc (NVIDIA), banc de RGPU-11 en débit pipeliné : variantes base, skylate (déjà dans bancs/rgpu/patches.mjs), f2b et prepass ; écart d'image nul exigé pour skylate et f2b. Sur M5 : aucune régression (IC95 incluant 0). Puis npm test.

### RGPU-V2 — Démo qui dure : temps des shaders en float32 jamais replié et gouverneur coupé hors partie ou sans focus
- sévérité moyenne · catégorie démo · effort S · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · moteur et jeu
- lieux : src/renderer.js:1569; src/renderer.js:1418; src/renderer.js:1465; src/renderer.js:34-36; src/renderer.js:409-422; src/game.js:717; src/game.js:677; src/game.js:722

**Preuve.** Le temps est envoyé tel quel en uniform float : renderer.js:1569 (uWindTime.y = t), 1418 (uTime), 1465 (uSkyMotion.x). Il sert de phase : vent du feuillage sin(uWindTime.y*.85+…) et cos(phase*.73) (lignes 34-36), bruit des FX sin(…+uTime*.65), sin(…−uTime*.41), défilement uTime*2.7 et uTime*.30 (409, 419, 422), nuages (346, 479). Côté jeu, game.js:717 : t = clock au menu (cumulé depuis le chargement de la page, ligne 677), sinon sim.state.time. Calcul : un float32 a 24 bits de mantisse, donc le pas représentable de t vaut 3,9 ms à partir de 32 768 s (9,1 h), 15,6 ms à partir de 131 072 s (36,4 h, une image entière à 60 Hz) et 31 ms à partir de 72,8 h. Au-delà de 36 h, le vent, le feu et la fumée avancent par à-coups ; à 120 Hz une image sur deux ne bouge plus. Deuxième point : game.js:722 n'active le gouverneur que si mode==='playing' et document.hasFocus() ; une démo dans un autre mode, ou une fenêtre sans focus (second écran, borne), tourne donc sans régulation, alors que la simulation du gouverneur (RGPU-09) montre déjà 10 à 11 réallocations par minute en zone marginale.

**Cause.** Le renderer suppose des sessions courtes : il reçoit un temps absolu en secondes et le convertit en float32 avant de le multiplier par des fréquences. Le pilotage du gouverneur suppose un joueur actif devant une fenêtre qui a le focus.

**Proposition.** (1) Dans FRender.draw, garder fx.time en double et envoyer des phases déjà repliées, calculées en JS : pour le vent, t modulo 200π/.85 (739,198 s), période commune exacte de sin(.85t) et cos(.73×.85t) ; pour les FX, deux phases (t×.65) mod 2π et (t×.41) mod 2π, et deux décalages (t×2.7) mod (2π/.7) pour le feu et (t×.30) mod (200π/7) pour la fumée, périodes exactes des sinus de noise() pour les coefficients 2.1 et 4.9 et l'octave ×2.1. Les shaders reçoivent ces phases à la place de uTime. Pour les nuages, envoyer le décalage t×.006×vent calculé en double. (2) API FERRO : fx.adaptive reste décidé par le jeu ; METAL l'active aussi en mode démo et sans exiger le focus tant que le document est visible. (3) Le mode démo de METAL fournit un temps de rendu propre, jamais le clock du menu. Critère : à t = 200 000 s, l'animation du feuillage est identique à celle de t modulo la période (écart d'image nul entre les deux), et le pas d'animation reste inférieur à 1 ms.

**Gain attendu.** Animation du vent, du feu, de la fumée et des nuages aussi fluide après plusieurs jours qu'à la première minute ; démo régulée en résolution même sans focus. Coût nul.

**Risques.** Les périodes doivent être exactes, sinon un saut visible à chaque repli : test dédié nécessaire. Aucun effet sur la simulation ni les sauvegardes (rendu seulement). Compatibilité FERRO : fx.time garde le même sens pour BITUME et Point de rupture, le repli est interne. Environ +0,3 Ko. Je n'ai pas vérifié comment la démo de Point de rupture gère son temps : à aligner.

**Vérifier par.** Banc à faux WebGL2 : appeler draw avec time = T et time = T + période pour chaque phase et vérifier l'égalité des uniformes envoyés. Page file:// : rendu à t = 10 s et à t = 10 s + 739,198 s, écart d'image attendu nul sur le feuillage ; puis à t = 200 000 s, deux images espacées de 1/120 s doivent différer. Harnais bench/loop : en mode démo sans focus, fx.adaptive doit valoir true.

### RGPU-V3 — Fumée et feu disparaissent d'un coup quand la caméra entre dans la particule (faces arrière éliminées), sans fondu de proximité
- sévérité moyenne · catégorie 3d-visuel · effort S · gain qualitatif
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur (dans METAL)
- lieux : src/renderer.js:1414-1421; src/renderer.js:1359; src/renderer.js:416-427; src/renderer.js:697-709

**Preuve.** renderer.js:1359 active CULL_FACE en BACK pour tout le contexte ; renderEffects (1414-1421) active le mélange et coupe l'écriture de profondeur mais ne touche pas au culling. Une sphère de FX qui contient l'œil ne présente que des faces arrière : aucun fragment n'est dessiné. FX_FRAG (ligne 416) n'atténue que la silhouette (edge) et rien ne dépend de la proximité de l'œil. Mesure du vérificateur interrompu (harnais vrun2.js relu, non rejouée par moi) : une bouffée de fumée de rayon 1,5 m centrée à 0,6 m de l'œil donne un écart d'image nul avec la scène sans bouffée (MAD 0, 0 pixel changé, 10 images × 2 scènes), alors que la même bouffée à 2,4 m change 22 à 25 % des pixels de plus de 3 niveaux et 8 % de plus de 10 (MAD 1,9 à 2,1). En approchant, la fumée couvre donc de plus en plus l'écran, puis disparaît en une image au franchissement de la surface. C'est aussi dans cette zone que le surdessin translucide coûte le plus (RGPU-06 : +0,64 ms pour 48 bouffées proches).

**Cause.** Les particules volumiques sont des maillages fermés rendus comme des surfaces opaques (faces avant seules), sans atténuation quand la caméra s'approche ou entre dans le volume.

**Proposition.** Dans FX_VERT, calculer une fois par instance (variable flat) proximite = smoothstep(.55, 1.35, distance(uEye, centre) / rayon), où le rayon est la demi-étendue maximale de l'instance, et multiplier alpha par ce facteur dans FX_FRAG, sauf pour les télégraphes de danger (vMaterial ≥ 15,5), qui doivent rester pleinement lisibles. À la surface (rapport 1), la particule est déjà à demi fondue ; à 0,55 rayon elle est invisible, donc plus aucun saut à l'entrée. Critère : en traversant une bouffée à vitesse constante, l'écart d'image entre deux images consécutives reste continu (pas de pic), et une bouffée dont le centre est à plus de 1,35 rayon de l'œil est rendue à l'identique.

**Gain attendu.** Supprime un saut visuel à chaque traversée de fumée ou d'explosion et réduit le surdessin des particules les plus coûteuses, celles qui remplissent l'écran. Le gain GPU dans les pics de combat est à mesurer.

**Risques.** La fumée très proche devient plus transparente : c'est le but, mais cela change légèrement la lisibilité en combat rapproché, à valider par David. Les télégraphes de danger et les particules prioritaires sont exclus. Rendu seulement : aucun effet sur la simulation ni les sauvegardes. À relancer : checks/effects.test.mjs et checks/renderer-destruction.test.mjs:64-67. Compatible FERRO (les particules lointaines sont inchangées). Environ +150 octets.

**Vérifier par.** Page file:// du banc bancs/rgpu-verif/ (vrun2.js, variantes puff) : faire avancer la caméra de 3 m à 0 m du centre d'une bouffée par pas de 0,1 m et tracer le MAD entre images successives, avant et après ; variante stress de RGPU-06 pour le coût.
