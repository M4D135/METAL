# Lot 06 — Rendu : carte graphique, à résolution native

> **Décision de David (12 novembre) — elle prime sur les valeurs par défaut de cette fiche.** « 60 c'est ok par défaut, même 30 si on a une petite config, tant que c'est constant. »
> - La cible par défaut est **60 images par seconde constantes, à la résolution native**. Une cadence plus haute (120, 144 Hz) est une option du joueur, pas la cible.
> - Sur une machine qui ne tient pas 60 de façon constante à la résolution native, le jeu se cale sur **30 images par seconde constantes**.
> - **La constance passe avant la cadence.** Jamais d'oscillation entre deux cadences en cours de jeu, jamais de baisse de résolution. Le choix se fait par mesure (au lancement, révisable entre deux secteurs, jamais en plein combat), avec une marge pour ne pas basculer sans cesse. Le joueur peut le forcer dans les options.
> - Le limiteur affiche une image tous les N rafraîchissements de l'écran (LOOP-09). Avec le pas fixe de 1/60 s, 30 images par seconde font toujours deux pas de simulation par image.
> - Les critères d'acceptation du type « 120 Hz tenus » deviennent des mesures d'information, pas des objectifs. La question laissée ouverte par NATIF-V1 est tranchée : natif, 60 par défaut, 30 en repli.

## But
Un seul gouverneur de résolution sans réallocation, une passe de composition unique couvrant ciel, géométrie et particules, et un rendu figé derrière la pause. Aucune perte de qualité ni de résolution native ; les gains GPU proviennent du tri, du stencil et du cache, pas de la baisse d'image.
## Tâches, dans l'ordre

### T1 — Faux contexte WebGL2 pour les tests [RGPU-05, RGPU-01, RGPU-13, DRAW-01, DRAW-02, DRAW-05, DRAW-06, DRAW-07, DRAW-09, DRAW-10, DRAW-12, DRAW-13]
- Où : checks/renderer-destruction.test.mjs:13-24, :42, :52, :85, :96-101 ; checks/actor-visibility.test.mjs:30
- Quoi : réécrire le faux contexte pour gérer bufferSubData, les VAO (createVertexArray, bindVertexArray, vertexAttribDivisor) et exposer des compteurs exacts (drawElementsInstanced, texImage2D, renderbufferStorage). Exposer shadowMaps, staticVisible et l'ordre des lumières via des compteurs nommés.
- Preuve exigée : npm test vert sur les 12 constats qui lisent le faux contexte ; état identique.
- Qualité : identique.
- Garde-fous : premier commit du chantier rendu ; chaque constat arrive seul ensuite avec sa ligne de test. Ne pas modifier le source du renderer.
- Dépend de : rien.

### T2 — Gouverneur unique : temps GPU, sous-viewport, plafond collant [RGPU-09, LOOP-12, RCPU-08, STAB-05]
- Où : src/renderer.js:746-764, :1318-1336, :1383-1396, :1535 ; src/game.js:677, :722
- Quoi : (a) Signal = max(temps CPU frame(), temps GPU par EXT_disjoint_timer_query_webgl2 si disponible et plausible) ; repli : temps CPU + régularité rAF. (b) Période d'écran = médiane des 10 % plus petits deltas rAF sur 2 s, bornée 6,9-16,7 ms, partagée avec le limiteur. (c) Baisse : >20 % d'images >1,5 période sur 1 s → échelle ×0,85 en 0,5 s. Hausse : 95e centile <0,8 période pendant 3 s → ×1,08. Plafond collant : remonter au-dessus après 30/60/120 s. (d) Cibles allouées une fois à la taille max ; rendre via gl.viewport + facteur d'UV à la composition ; canvas.width ne bouge plus. (e) Actif en haute (plancher 0,8) et à 120/144 Hz. (f) Désactiver en banc et test.
- Preuve exigée : node bench/rcpu/gov.mjs <ferro> : ≤2 changements/min, 0 inversion, <2 % d'images en retard ; à 120 Hz tenir 119 fps ; à 144 Hz tenir 143 fps. createTexture/renderbufferStorage = 0 après chauffe. checks/renderer-destruction.test.mjs:51 vert.
- Qualité : meilleure (supprime 10-11 accrocs/min de +6 ms médiane, +11 ms p90).
- Garde-fous : le test :51 (65 images à 50 ms → scale<1) doit rester vert en bornant la période à 16,7 ms. Reset du plafond au changement de qualité. Sous-viewport : borner les UV du bloom. +1 Ko.
- Dépend de : T1.

### T3 — Facteur d'atténuation par rôle, pas par créneau [RGPU-05]
- Où : src/renderer.js:316, :1551, :1554 ; src/effects.js:209-227
- Quoi : (1) Avant l'attribution des créneaux, éliminer les transitoires à portée finie dont la sphère (p, range) ne coupe pas le frustum. (2) À la ligne 1554, multiplier lightColors par 2,077 pour la lampe ombrée, la lampe ordinaire la plus proche et les transitoires retenues. (3) Dans le shader (ligne 316), attenuation=.13/(1.+d*d*.26) pour toutes. (4) Poids continu pour la lampe la plus proche : gain = 1 + 1,077 × clamp((d2−d1)/3 m, 0, 1). (5) Si aucune lampe ombrée, donner le facteur aux deux plus proches.
- Preuve exigée : node slot1.mjs ../../ferro out/scene-w0.json : couleur effective identique avec et sans transitoire sur 60 images. Écart d'image hors halo de la transitoire ≈ 0.
- Qualité : meilleure (supprime un saut de 2-4,5 % de luminance à chaque transitoire lointaine, 20 sauts/min en marche).
- Garde-fous : checks/renderer-destruction.test.mjs:96-101 lit uLightColor ; appliquer le facteur dans la même boucle que le blackout. +60 octets.
- Dépend de : T1.

### T4 — Arme par stencil, sans clear(DEPTH) en pleine passe [DRAW-01]
- Où : src/renderer.js:1579-1583, :1567, :1312, :1400-1409 (METAL)
- Quoi : (1) Cible de scène en DEPTH24_STENCIL8. (2) Effacer STENCIL_BUFFER_BIT au début. (3) Dessiner l'arme avec stencilFunc(ALWAYS,1,255)+REPLACE, puis le monde avec stencilFunc(NOTEQUAL,1,255)+KEEP. (4) Éclair de bouche : même lot dessiné deux fois (EQUAL+depth test, puis NOTEQUAL+depth off). (5) disable(STENCIL_TEST) avant le post. (6) Blackout : couleurs pleines avant l'arme, atténuées pour le monde. (7) Sans stencil (qualité basse) : garder le chemin actuel ou passer par la cible (T18).
- Preuve exigée : écart maximal 0 sur 47 images (mondes 0, 6, 17) ; IC95 du gain GPU entièrement sous 0.
- Qualité : identique (bit à bit).
- Garde-fous : checks/renderer-reprises.test.mjs compare les commandes GPU : accepter la nouvelle séquence et noter dans VERSIONS.md. Le chemin MSAA (Point de rupture, BITUME) demande le même format sur renderbufferStorageMultisample.
- Dépend de : T1.

### T5 — Contexte sans profondeur, chemin unique cible→canvas, compilation asynchrone [DRAW-12]
- Où : src/renderer.js:1276, :1288-1298, :1318-1336, :1338, :1566-1567 (METAL)
- Quoi : (1) Toujours rendre la scène dans la cible ; qualité basse : blitFramebuffer vers le canvas. Contexte créé avec depth:false, stencil:false (si DRAW-01 n'est pas actif) ou stencil:true (si DRAW-01 actif). (2) invalidateFramebuffer (3 appels) après la passe de profondeur et avant écriture bloom. (3) Compilation asynchrone via KHR_parallel_shader_compile pendant le chargement ; API FRender.create({async:true}) rendant une promesse. (4) Échauffement : une image avec chaque forme, une particule, une pièce d'arme, le post.
- Preuve exigée : image identique sur 13/13 ; première image <15 ms (contre 29-32 ms) ; FRender.create <20 ms avec async.
- Qualité : identique.
- Garde-fous : depth:false est irréversible pour la vie du contexte ; le chemin direct doit disparaître. La copie plein écran en basse est à mesurer sur mobile. Garder le chemin synchrone par défaut (compatibilité FERRO). +0,5 Ko.
- Dépend de : T1.

### T6 — Ordre de dessin : arme, dynamiques, statiques en 4 bandes [DRAW-02]
- Où : src/renderer.js:1576-1582, :798-803, :1397-1407 (METAL)
- Quoi : (1) Ordre : arme (T4), lot dynamique, puis statiques en 4 bandes (œil−rayon < 8, 18, 34 m, reste), chaque bande groupée par forme. (2) Sélection par WEBGL_debug_renderer_info : si Apple/Mali/Adreno/PowerVR → groupement par forme actuel ; sinon bandes. (3) Option FRender.create({drawOrder:'auto'|'shape'|'bands'}), défaut 'shape' dans FERRO, METAL passe 'auto'. (4) Pas de pré-passe de profondeur.
- Preuve exigée : sur david-pc (sans --use-angle=metal) : IC95 du temps GPU sous 0 ; part de pixels différents <0,01 %. Sur M5 : surdessin 1,41 vs 1,82 (mesuré).
- Qualité : visuellement identique (<0,005 % pixels, écart max 44).
- Garde-fous : image non identique bit à bit (départage coplanaires) ; valider à l'œil sur les 6 images concernées. +10 draws (58→68). checks/renderer-reprises à adapter.
- Dépend de : T4.

### T7 — Passe de composition unique : vignette, voile, onde, luminosité en uniformes [RGPU-07]
- Où : src/renderer.js:370-377, :490-491, :428-439, :493-519 ; src/style.css:1 ; src/game.js:61, :714-715 ; src/index.html:14
- Quoi : (1) Créer une fonction GLSL screenFx(color) appelée dans FRAG, SKY_FRAG et FX_FRAG : vignette mix(.59,1.,v), voile rouge mix, onde uEffects.w, luminosité. (2) Retirer ces termes de chaque matériau (−12 ALU/fragment ombré). (3) Lier l'intensité de vignette à l'option game.js:60 (uniforme). (4) #vignette et #damage en CSS uniquement pour le repli Canvas2D. (5) N'écrire style.opacity que si la valeur change. (6) Retirer canvas.style.filter (game.js:61) au profit de l'uniforme.
- Preuve exigée : banc spec.fx {damage:0.8,pulse:0.5} en extérieur : teinte moyenne du ciel = teinte de la géométrie sur les bords (readPixels). Écart d'image hors effets ≈ 0.
- Qualité : meilleure (corrige l'incohérence ciel/géométrie en combat extérieur).
- Garde-fous : l'arme (overlay) garde son voile. Accessibilité : intensité réglable. Le repli Canvas2D garde les surcouches CSS. +0,3 Ko.
- Dépend de : T2 (sous-viewport et bornes d'UV).

### T8 — Rendu figé en pause, boutique et écrans de fin [RGPU-08, LOOP-11]
- Où : src/game.js:675-722, :190 ; src/style.css:1
- Quoi : (1) Drapeau sceneDirty, levé à l'entrée en pause/boutique/dead/cleared/complete, par settings(), resize, webglcontextrestored, visibilitychange, focus. (2) Tant que sceneDirty est baissé, ne pas appeler renderer.draw ; le canvas garde la dernière image. (3) Au retour en jeu, lever le drapeau. (4) En démo et sur le titre : rendu continu, sans backdrop-filter. (5) Découper preparePlay (~458 ms) par yields pour garder l'écran de chargement animé.
- Preuve exigée : en pause, drawElementsInstanced/s = 0 après la première image ; capture identique avant/après.
- Qualité : identique.
- Garde-fous : un réglage modifié en pause déclenche un redessin. webglcontextlost (game.js:840) force un dessin à la restauration. Le repli Canvas2D suit la même règle. +150 octets.
- Dépend de : T2 (gouverneur inactif hors playing).

### T9 — Culling des projeteurs soleil par capsule contre frustum [DRAW-05]
- Où : src/renderer.js:1440-1459, :1454-1458, :1503-1519 (METAL)
- Quoi : (1) Garder un projeteur si sa capsule (centre → centre+fw·(far−z), rayon = rayon objet + 1,0 m) coupe le frustum (4 plans latéraux + plan œil, expressions de visible()). (2) Écriture scalaire sans allocation (~20 mult/candidat). (3) La liste mise en cache reste le sur-ensemble de la boîte ; la capsule produit la liste d'indices par image. (4) Même principe optionnel pour le lot dynamique dans chaque vue d'ombre.
- Preuve exigée : écart maximal 0 sur ≥100 images (mondes 0, 6, 17) ; instances −21 à −36 % ; octets envoyés −28 à −46 %.
- Qualité : visuellement identique.
- Garde-fous : marge 1,0 m (pas 0,6 m, qui laisse 1 image/49 à 3 niveaux). Sans DRAW-03 (indices), élargir la capsule des marges D et θ du cache. actorFilter non concerné. +0,3 Ko.
- Dépend de : T4 (stencil), T2 (cache du gouverneur).

### T10 — Temps des shaders replié en JS pour la démo longue [RGPU-V2]
- Où : src/renderer.js:1569, :1418, :1465, :34-36, :409-422 ; src/game.js:717, :677, :722
- Quoi : (1) Dans FRender.draw, garder fx.time en double ; envoyer des phases repliées : vent t mod 739,198 s ; FX (t×.65) mod 2π et (t×.41) mod 2π ; feu (t×2,7) mod (2π/.7) ; fumée (t×.30) mod (200π/7) ; nuages t×.006×vent en double. (2) METAL active fx.adaptive aussi en démo et sans focus tant que document.visible. (3) Le mode démo fournit un temps de rendu propre, jamais le clock du menu.
- Preuve exigée : à t=200 000 s, animation du feuillage identique à t mod période (écart d'image nul) ; pas d'animation <1 ms à 120 Hz. En démo sans focus, fx.adaptive = true.
- Qualité : identique.
- Garde-fous : les périodes doivent être exactes (test dédié). fx.time garde le même sens pour BITUME et Point de rupture. +0,3 Ko.
- Dépend de : T2 (gouverneur actif en démo).

### T11 — Fondu de proximité des particules volumiques [RGPU-V3]
- Où : src/renderer.js:1414-1421, :1359, :416-427, :697-709
- Quoi : (1) Dans FX_VERT, calculer flat proximite = smoothstep(.55, 1.35, distance(uEye, centre)/rayon). (2) Dans FX_FRAG, multiplier alpha par proximite, sauf pour les télégraphes de danger (vMaterial ≥ 15,5). (3) À la surface (rapport 1), particule à demi-fondue ; à 0,55 rayon, invisible.
- Preuve exigée : traversée d'une bouffée par pas de 0,1 m : MAD entre images successives continu (pas de pic) ; bouffée à >1,35 rayon rendue à l'identique.
- Qualité : meilleure (supprime un saut visuel à chaque traversée).
- Garde-fous : lisibilité en combat rapproché à valider par David. Télégraphes exclus. checks/effects.test.mjs et renderer-destruction.test.mjs:64-67 à relancer. +150 octets.
- Dépend de : rien.

### T12 — Cible RGB10_A2 et tramage à la composition [DRAW-06]
- Où : src/renderer.js:1299-1316, :517, :378, :491, :501-519 (METAL)
- Quoi : (1) Cible de scène en RGB10_A2 (texImage2D, UNSIGNED_INT_2_10_10_10_REV). (2) À la composition (uPass==2) : ajouter (fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255. (3) Chemins sans composition : même terme derrière uniform uDither=0 par défaut. (4) Option FRender.create({dither:true}), false dans FERRO, METAL active.
- Preuve exigée : <10 bords de bande/Mpix (3 192 → 1,1) ; écart max 2 niveaux ; IC95 du temps GPU non significatif.
- Qualité : meilleure (supprime les bandes de quantification dans le ciel et le brouillard).
- Garde-fous : le tramage change ≤57 % des pixels d'au plus 2 niveaux : les tests d'images tolèrent 2 niveaux ou coupent l'option. RGB10_A2 a 2 bits d'alpha (sans effet ici). +0,2 Ko.
- Dépend de : T5 (chemin unique cible→canvas).

### T13 — HUD : écritures filtrées, barres en scaleX, radar en deux couches [LOOP-13]
- Où : src/game.js:61, :587-674, :713-714 ; src/style.css:1, :10, :106
- Quoi : (1) setText/setStyle/toggle avec cache de dernière valeur ; n'écrire que si elle change (97 % d'écritures en moins). (2) Barres en transform:scaleX(v) avec transform-origin:left ; transition sur transform. (3) Radar : couche statique dans un canvas hors écran, redessiner les marqueurs seuls. (4) Munitions et vie rafraîchies à l'événement (tir, dégât) plutôt qu'au tic 90 ms. (5) #vignette et #damage supprimés du DOM en WebGL (déjà dans les uniformes de T7) ; gardés pour le repli Canvas2D.
- Preuve exigée : domPerHudTick ≈ 0 écritures redondantes ; pas de mise en page pendant les transitions (trace Chrome).
- Qualité : visuellement identique.
- Garde-fous : accessibilité (aria-live) : ne pas réécrire une valeur inchangée est préférable. Le repli Canvas2D garde les surcouches. Aucun impact simulation.
- Dépend de : T7 (uniformes vignette/voile/luminosité).

### T14 — Cascade soleil proche, diffusion brouillard, fumée éclairée [RGPU-14]
- Où : src/renderer.js:1440-1459, :364-367, :428 ; src/effects.js:209-216
- Quoi : (a) Cascade soleil ±10 m, 512 px (0,04 m/texel) dans la 4e tuile (confirmée libre) ; acteurFilter inclut son volume. (b) Brouillard : fogColor += uSunColor*pow(max(dot(-view,uSunDirection),0.),8.)*.35*outdoors (6 ALU). (c) FX_FRAG : éclairer fumée/étincelles par la transitoire la plus forte (uniform vec4 pos+puissance) et uEffects.y (10 ALU). (d) Coupée si uShadowSettings.w>1.5 (soleil plein atlas). Désactivée par défaut dans FERRO.
- Preuve exigée : captures avant/après sur 3 biomes ; coût ≤+0,6 ms ; npm test (actor-visibility) vert.
- Qualité : meilleure (ombres nettes au premier plan, explosions qui éclairent leur fumée).
- Garde-fous : biais d'ombre à régler par cascade ; +1 Ko ; coût estimé non mesuré. À valider par David sur captures.
- Dépend de : T2 (gouverneur), T9 (culling soleil).

### T15 — Liseré ennemis, occlusion ambiante par instance, impacts procéduraux [RGPU-15]
- Où : src/renderer.js:172, :304-308, :1309-1316, :674-677
- Quoi : (a) Bit 8 dans surfaceFlags pour les acteurs ennemis ; color += rim*pow(1.-nv,3.)*.35 (5 ALU). (b) Occlusion par instance : assombrir le bas via vLocal.y dans le vertex shader (3 ALU). (c) Impacts : anneau de 64 instances box plates (s≈[.25,.004,.25]), matériau radial, polygonOffset, 1 draw call. (d) L'occlusion écran (profondeur en texture, 8 lectures à 0,45 MPix) est reportée après T2 et un lot GPU dédié.
- Preuve exigée : captures comparatives par biome ; coût ≤+0,05 ms (a+b+c) ; checks/actors.test.mjs vert.
- Qualité : meilleure.
- Garde-fous : décalques alimentés par la simulation, jamais l'inverse (déterminisme). Pas d'instantanés de sauvegarde. +1,5 Ko. Liseré à valider par David.
- Dépend de : T2, T16 (detailFade pour les drapeaux).

### T16 — Fondu de détail par mise à l'échelle dans le vertex shader [DRAW-09]
- Où : src/renderer.js:723, :786, :28-51, :674-677 (METAL)
- Quoi : (1) Élargir la portée de requête de 12 % par niveau. (2) Uniform vec4 uDetail (3 portées + largeur de fondu) et vec3 uViewEye. (3) k = smoothstep(0.,1.,(1.12·R+rayon−d)/(0.12·R)) ; position = centre+(sommet−centre)·k. (4) 2 bits de niveau de détail dans iRotation.w. (5) Les ombres suivent la même échelle. (6) Option FRender.create({detailFade:true}), false dans FERRO.
- Preuve exigée : sur une séquence de marche, aucune instance passe de 0 à >4 pixels entre deux images à cause de la portée.
- Qualité : meilleure (supprime les apparitions brusques).
- Garde-fous : image différente par construction (objets visibles 12 % plus loin) : c'est une amélioration à option. Drapeaux modifiés : pack, spatialIndex, packEffects, renderer-reprises touchés. +25 % d'instances niveaux 1-2.
- Dépend de : rien.

### T17 — Constat D3D11 et hoisting des dérivées [DRAW-07]
- Où : src/renderer.js:124-161, :162-298, :311-322 (METAL)
- Quoi : (1) Sur david-pc (sans --use-angle=metal) : lire getTranslatedShaderSource() du shader du monde, noter le temps de FRender.create. (2) Remplacer texture() par textureLod(uShadowMap,tap,0.) dans depthSample (identique sur Metal). (3) Si l'aplatissement HLSL est confirmé : calculer les dérivées (fwidth, dFdx, dFdy) une fois en tête de main(), hors branches. (4) Ombres par dérivées analytiques si Direct3D. (5) Pas de programmes par matière.
- Preuve exigée : IC95 du temps GPU sous 0 sur D3D11 ; écart d'image ≤1 niveau. Sur Metal : 0 (mesuré).
- Qualité : visuellement identique.
- Garde-fous : hypothèse non vérifiée sur la machine cible ; constat avant tout travail. Sortir les dérivées change les arrondis (≤1 niveau). +0,3 Ko.
- Dépend de : T1.

### T18 — Cache des projeteurs statiques d'ombre [DRAW-10]
- Où : src/renderer.js:1422-1439, :1440-1459, :1325-1333, :1562-1565 (METAL)
- Quoi : (1) Lampe : rendre les statiques une fois dans une texture de profondeur de cache ; chaque image : blitFramebuffer(DEPTH_BUFFER_BIT) + dynamiques. (2) Soleil : cache ancré au monde, centre quantifié sur 32 texels (3,5 m) ; texture 576² (640² haute) ; copie du rectangle 512² au décalage entier ; refonte quand la cellule change (~0,5 s à 7 m/s). (3) Biais inchangé (0,014, polygonOffset 1,1/2). (4) À faire après T9.
- Preuve exigée : écart d'image ≤1 niveau ; aucune image plus chère qu'aujourd'hui ; uploadKB du soleil ×2/s au lieu de ×60/s.
- Qualité : visuellement identique.
- Garde-fous : +1,3 Mo (auto), +6,5 Mo (haute). La destruction invalide les caches. Avec fx.sunOnly (Point de rupture), le cache suit camera.sun. Complexité élevée pour un gain borné (≤0,25 ms).
- Dépend de : T9.

### T19 — Profondeur inversée (EXT_clip_control) [DRAW-13]
- Où : src/renderer.js:1541-1542, :1312, :1357 (METAL)
- Quoi : (1) Si EXT_clip_control : clipControlEXT(LOWER_LEFT, ZERO_TO_ONE), DEPTH_COMPONENT32F (ou DEPTH32F_STENCIL8 avec T4), projection inversée (proche→1, lointain→0), clearDepth(0), depthFunc(GEQUAL). (2) Vues d'ombre : convention actuelle, matrices séparées. (3) Sans l'extension : chemin actuel. (4) Option FRender.create({reverseDepth:'auto'}), coupée dans FERRO.
- Preuve exigée : la variante par tranche de profondeur ne change plus de pixels à l'horizon ; écart limité aux pixels déjà instables.
- Qualité : meilleure (stabilité du départage lointain).
- Garde-fous : le défaut est déduit d'un indice, pas observé en mouvement : confirmer avant d'investir. +7-21 Mo (32F). Toute comparaison de profondeur écrite en dur doit suivre l'inversion. renderer-reprises touché.
- Dépend de : T4 (stencil).

## Options désactivées par défaut
- [RGPU-01] Reflet GGX limité aux 4 premières lumières — MAD 0,037 hors transitoires mais 0,87 % pixels >10 niveaux en combat intérieur avec 3 transitoires ; perte de reflets métalliques visible. À activer en auto/basse seulement après les 3 corrections (culling frustum des transitoires, classement par contribution, plafond par qualité).
- [RGPU-02] Plafond de pixels en haute (3,3 MPix) — retire 39 % des pixels (échelle 0,78) ; perte de netteté dans le mode choisi pour la qualité. À garder comme « résolution dynamique en haute » pilotée par T2.
- [RGPU-06] Plafond de couverture particules + texture de bruit — le motif change, le plafond retire de la fumée, la demi-résolution floute. Gain réel ≤−0,25 ms (part du bruit), non −0,5 à −0,8 ms.
- [RGPU-10] FXAA dans la composition — adoucit les détails fins (grilles, rivets, bruit haute fréquence) ; contredit « sans perdre la moindre qualité ». MSAA 4× (non mesuré sur NVIDIA) est la voie sans flou.
- [RGPU-12] Texture de bruit 256×256 en lieu et place du hash ALU — motif décalé (période 256, quantification 8 bits) ; MAD 0,93-1,27, 9-12 % pixels >3 niveaux. Gain −0,4 à −0,56 ms mais image non identique.
- [RGPU-13] Fenêtre douce de portée sur les lumières — MAD 0,24-0,31 (assombrissement lointain) ; gain GPU nul après RGPU-01. Garder seulement le classement par contribution P/(1+.26d²), intégré à T3.
- [BOSS-13] Portée réduite dans l'arène (64 m basse, 48 m Canvas2D) — retire du décor lointain visible (portails, niveau au-delà du pont) ; perte d'image. À n'accepter que sous la forme « région arène + boss toujours dessinés » après preuve par différence d'images.

## Écartés ou absorbés
- [RGPU-04] — Réfuté. « Torche quasi invisible » faux dès qu'un obstacle ou un acteur est proche (MAD 0,35, 1,12 % pixels >10 niveaux avec un acteur à 2,2 m). La lampe ombrée « hors de portée de 32 m » est un raisonnement erroné (32 m est le plan lointain de la lampe, pas la distance à l'œil). Gain non significatif (−0,1 à −0,2 ms). La 4e tuile est réservée à T14.

## Décisions à confirmer par David
- Liseré des ennemis (T15a) : couleur et intensité (rim × 0,35 proposé) — valeur par défaut : activé, réglable dans les options.
- Fondu de proximité des particules (T11) : la fumée très proche devient plus transparente — valeur par défaut : activé, télégraphes exclus.
- Cascade soleil proche (T14a) : direction artistique (ombres nettes au premier plan) — valeur par défaut : désactivée, à valider sur captures.
- Diffusion brouillard vers le soleil (T14b) : modification de l'ambiance atmosphérique — valeur par défaut : désactivée.
- Tramage RGB10_A2 (T12) : ≤2 niveaux de bruit sur 57 % des pixels — valeur par défaut : activé dans METAL.
- Ordre par bandes (T6) : image non identique bit à bit sur <0,005 % des pixels — valeur par défaut : activé sur GPU à rendu immédiat, 'shape' sur Apple/Mali/Adreno.
- Profondeur inversée (T19) : le défaut est déduit, pas observé en mouvement — valeur par défaut : désactivé jusqu'à confirmation par une séquence.

## Gains attendus du lot
En débit pipeliné sur M5 (ANGLE Metal, 1668×1079, qualité auto) : le gouverneur corrigé supprime 10-11 accrocs/min de +6 ms médiane et rend le régulateur actif à 120/144 Hz (T2) ; le stencil arme retire −0,60 ms GPU (−7,5 %, T4) ; le culling soleil −28 à −46 % d'octets envoyés et −21 à −36 % d'instances (T9) ; la composition unique −12 ALU/fragment ombré et 1-3 calques de composition plein écran (T7) ; le rendu figé en pause ramène le GPU de 5,2-5,7 ms à 0 (T8) ; le tramage supprime 3 192 bords de bande/Mpix (T12). Gains combinés mesurés sur la scène de jeu : environ −1,5 ms GPU par image en auto (stencil + culling + composition), −6 ms par accrocs supprimés, et un rendu stable à 120 Hz où il était inerte. En haute : −3,3 ms si l'option T2 est activée (39 % de pixels en moins, non par défaut).

## Mise à jour après contre-vérification

Cette fiche a été rédigée avant la contre-vérification des axes STAB, DRAW, RESTE et PARA. Les verdicts ci-dessous priment sur le texte des tâches.

- **STAB-05 — confirmé, priorité P1, qualité meilleure.** Gain corrigé : Suppression de l'image doublée par palier (mesurée) ; fin de l'oscillation en scène stable ; le gain à 120 et 144 Hz est un choix de qualité à laisser en option, pas un gain net.
- **DRAW-01 — confirmé, priorité P1, qualité identique.** Gain corrigé : -0,3 à -0,6 ms GPU par image en auto sur M5 (-3 à -7,5 %), image identique ; l'extrapolation à -1,8 ms en haute reste une estimation.
- **DRAW-02 — plausible, priorité P2, qualité visuellement identique.** Gain corrigé : 0 sur M5 (mesuré) ; -22 à -37 % de fragments opaques ombrés sur GPU à rendu immédiat (compte mesuré, temps non mesuré).
- **DRAW-05 — plausible, priorité P3, qualité visuellement identique.** Gain corrigé : Version identique mesurée (amont 10 m, un seul monde) : -23 % d'instances et -31 % d'octets envoyés (209,6 → 143,9 Ko). Version à 0,6 m : -37 % et -47 % mais image non identique. Temps GPU : 0 sur M5.
- **DRAW-06 — confirmé, priorité P2, qualité meilleure.** Rejoué sur un autre monde (6) : mêmes ordres de grandeur. Code conforme : cible RGBA8 (FERRO 1381-1383), couleur déjà en gamma. Deux remarques. (1) Le tramage à la source sur RGBA8 (2 lignes, aucun changement de format, valable aussi sans bloom et en qualité b…
- **DRAW-07 — plausible, priorité P2, qualité visuellement identique.** Gain corrigé : 0 sur Metal (mesuré) ; inconnu sur D3D11.
- **DRAW-09 — plausible, priorité P2, qualité meilleure.** Code conforme : portées 64/32/13 m en auto (FERRO 783), seuil binaire d ≤ (portée + rayon)² dans la requête, aucun fondu dans le shader de sommets (lignes 28-51 relues). Chiffres à corriger : en projection perspective, un objet de 1 m à 13,5 m fait 52 pixels (…
- **DRAW-10 — confirmé, priorité P3, qualité visuellement identique.** Code relu : recalage au texel du centre de la boîte du soleil sur les deux axes lumière (xSnap, ySnap, FERRO 1603-1604), axes dépendant du seul soleil, donc stables en rotation ; liste de la lampe en cache (lampCasters). La borne de 0,25 ms n'a pas été remesur…
- **DRAW-12 — plausible, priorité P2, qualité identique.** Gain corrigé : Chargement : environ 110 ms de blocage en moins sur M5 si la compilation devient asynchrone ; première image 29 ms au lieu de 9 à 15 ms ensuite.
- **DRAW-13 — plausible, priorité P3, qualité meilleure.** Le calcul est juste (z²/(proche × 2^24) : 4,8 mm à 60 m, 13 mm à 100 m) et les lignes citées sont exactes. Mais la cause est douteuse : une résolution de 5 à 13 mm suffit largement pour une géométrie non coplanaire. Des pixels qui basculent quand la plage chan…
- **DRAW-V1 — nouveau constat, ajouté par le contre-vérificateur (moyenne).** Ciel dessiné en premier sur tout l'écran alors qu'il n'est visible que sur 28 à 30 % des pixels : le dessiner après les opaques, à la profondeur 1 Où : src/renderer.js:1741 (FERRO) / 1567 (METAL); src/renderer.js:1623-1630 (FERRO) / 1460-1467 (METAL); src/renderer.js:521-560 (FERRO, SKY_FRAG). Quoi : 1. Retirer l'appel de skyPass après l'effacement. 2. Le placer après le dernier lot opaque (statiques, nappes, lots, dynamiques, foule) et avant renderEffects(particles) : gl.depthRange(1,1) ; gl.depthMask(false) ; test de profondeur laissé actif (LEQUAL déjà en place) ; skyPass ; gl.depthMask(true) ; gl.depthRange(0,1) ; puis useProgram(program) et bindVertexArray(vao). 3. Dans skyPass, ne plus couper DEPTH_TEST (garder la coupure de CULL_FACE). 4. Avec DRAW-01, le masque stencil reste actif pendant le ciel : aucun fragment de ciel sous l'arme. 5. Aucun changement de shader : depthRange(1,1) donne exactement la profondeur 1, égale à la valeur d'effacement.  Critère d'acceptation : écart max… Gain attendu : 70 à 72 % des fragments du ciel en moins sur GPU à rendu immédiat (estimé à partir de la couverture mesurée) ; 0 sur M5 (mesuré). Détail dans `constats/DRAW.md`.
- **DRAW-V2 — nouveau constat, ajouté par le contre-vérificateur (moyenne).** Masque stencil de l'arme : le chemin direct vers le canvas (bloom coupé, qualité basse) n'a pas de stencil ; demander stencil:true au contexte Où : src/renderer.js:1353 (FERRO) / 1276 (METAL); src/renderer.js:1740-1741 (FERRO) / 1566-1567 (METAL); src/game.js:722 (METAL). Quoi : 1. Créer le contexte avec {alpha:false, antialias:false, depth:true, stencil:true, powerPreference:'high-performance'}. 2. Lire gl.getContextAttributes().stencil ; s'il vaut false, garder l'ancien chemin (effacement de profondeur puis arme en dernier) pour le rendu direct. 3. Un seul code pour DRAW-01, quel que soit le framebuffer : effacement COLOR | DEPTH | STENCIL, arme en premier avec REPLACE, monde en NOTEQUAL. 4. Si le chemin unique de DRAW-12 est adopté plus tard (toujours par la cible de scène), le contexte pourra repasser à depth:false et stencil:false.  Critère d'acceptation : écart maximal 0 avec et sans bloom, et intervalle de confiance du gain GPU sous 0 sans bloom. Gain attendu : -0,3 à -0,5 ms GPU par image sans bloom sur M5 (-6 à -7 %, mesuré), image identique. Détail dans `constats/DRAW.md`.
- **DRAW-V3 — nouveau constat, ajouté par le contre-vérificateur (moyenne).** Ombres : l'extrapolation de profondeur du receveur n'est pas bornée, un projeteur influence des receveurs situés en amont de lui ; toute réduction de la liste des projeteurs doit en tenir compte Où : src/renderer.js:126-133 (FERRO) / 124-131 (METAL); src/renderer.js:134-162 (FERRO) / 132-160 (METAL); src/renderer.js:1613-1618 (FERRO) / 1454-1458 (METAL). Quoi : 1. Règle pour tout filtre ou cache de projeteurs : le volume conservateur d'un projeteur est la capsule allant de c - fw·U jusqu'au fond du volume de lumière, de rayon rayon + 0,6 m, avec U = 10 m (valeur qui donne l'identité sur le monde 17 ; à valider sur les mondes 0 et 6 et sur au moins 300 images). 2. Banc d'acceptation commun à DRAW-05, DRAW-10 et RCPU-01 : comparaison toutes les 2 images (une comparaison toutes les 10 images n'avait vu qu'une image fautive sur 49), écart maximal 0 exigé. 3. Option séparée, coupée par défaut car elle change l'image : borner l'extrapolation dans depthSample, par exemple clamp(dot(slope, (centre - uv) × 2), -k, k) avec k égal à 4 texels de profondeur du… Gain attendu : Pas de gain de temps propre : c'est la condition pour que les optimisations de liste de projeteurs tiennent l'exigence d'image identique. Avec U = 10 m, le filtre du soleil garde -23 % d'instances et -31 % d'octets envoyés (4 321 → 3 325 instances, 209,6 → 143… Détail dans `constats/DRAW.md`.
- **RESTE-V2 — nouveau constat, ajouté par le contre-vérificateur (moyenne).** Temps envoyé aux shaders en flottant 32 bits sans repli : les animations saccadent après quelques heures d'écran titre ou de démo Où : src/renderer.js:1416; src/renderer.js:1418; src/renderer.js:1453; src/renderer.js:1465; src/game.js:677; src/game.js:717. Quoi : FERRO : le renderer garde le temps en double et calcule côté JS, pour chaque fréquence utilisée par un shader, la phase (t*f) modulo 2π, envoyée dans un petit tableau d'uniformes ; les shaders remplacent sin(x+uTime*f) par sin(x+uPhase[k]). Les fréquences sont peu nombreuses (0,65 et 0,41 à renderer.js:409, vent, ciel) : les recenser par grep sur uTime, uWindTime et uSkyMotion. Résultat égal à l'arrondi flottant près sur les premières minutes et exact ensuite. En attendant, côté METAL : la démo remet l'horloge de présentation à zéro à chaque changement de secteur, sous le fondu. Gain attendu : Animations de vent, de ciel et d'effets régulières quelle que soit la durée ; aujourd'hui la gigue du pas d'animation atteint 6 % à 4,6 h et 40 % à 18 h. Détail dans `constats/RESTE.md`.

