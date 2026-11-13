# Lot 18 — Image haut de gamme et PC à carte NVIDIA
> **À lire d'abord.** Ce lot est une feuille de route. Il ne se lance que sur décision de David, après les lots 06, 15 et 16.
> **Résolution.** La règle 2 du prompt principal s'applique aussi ici : rendu à la résolution native, jamais baissée automatiquement. L'échelle dynamique et le plafond de pixels décrits en T8, ainsi que le rendu sous-échantillonné puis reconstruit (TAAU) de T7, ne sont permis que comme options explicites du joueur, désactivées par défaut. Par défaut, le mode « photo » rend lui aussi à la résolution native, avec l'anticrénelage temporel seul.

## But
Livrer le socle photo (HDR, TAAU, BRDF, cascades) en option stricte dans le dépôt METAL, sans toucher au chemin classique.
Exploiter les PC NVIDIA dans le navigateur : détection d'adaptateur, gouverneur sur temps GPU, plafond pixels levé.
Aucune dépendance externe, aucune DLL, aucune édition native ; tout tient dans la page HTML à 1,4 Mo.

## Tâches, dans l'ordre

### T1 — Recadrage : DLSS et natif exclus, cibles de mesure fixées [NVIDIA-V1, NVIDIA-V2]
- Où : README.md (section Limites), VERSIONS.md, bancs/README.md
- Quoi : inscrire la décision du 12/11/2026 (« DLSS 5 et édition native sortent du plan »). Écrire que DLSS est indisponible dans le navigateur (gpuweb#11088). Définir deux cibles de banc : (A) david-pc Linux X11/Wayland RTX 5090, (B) portable Windows RTX 5060 Laptop. Le JSON de banc porte os, session, pilote, chaîne d'adaptateur, alimentation.
- Preuve exigée : `git grep -niE 'nvngx|streamline|sl\.dlss'` ne renvoie rien dans src/. README et VERSIONS citent la décision datée.
- Qualité : identique (aucun code de rendu modifié).
- Garde-fous : aucune DLL NVIDIA dans src/ ; aucune version non officielle de DLSS 5 ; le contrat d'image (T6) garde l'option ouverte sans coût.
- Dépend de : rien.

### T2 — Option photo stricte, chemin classique gelé, repli automatique [PHOTO-01]
- Où : src/renderer.js (aiguillage ~1 Ko), nouveau src/photo.js
- Quoi : `FRender.create(canvas, {rendu:'photo', preset:'auto'|'bas'|'moyen'|'haut'|'ultra'})`. Sans rendu ou 'classique', zéro ligne nouvelle exécutée, `getExtension` jamais appelé. Repli sur classique si photo.js absent, EXT_color_buffer_float absent, rendu logiciel, ou échec FBO. Preset 'bas' = classique v0.2. Le shader classique reste identique à l'octet près.
- Preuve exigée : npm test vert, renderer-reprises inchangé. Test GL simulé : `create(c)` et `create(c,{})` produisent le flux v0.2 hors appels de détection ; `create(c,{rendu:'photo'})` sans extension donne `stats.rendu==='classique'`. Page sans photo.js ≤ v0.2 + 1,5 Ko.
- Qualité : visuellement identique (classique inchangé).
- Garde-fous : deux chemins à maintenir ; aspect diffère selon la machine (décision PHOTO-17) ; taille ≤ 1,4 Mo.
- Dépend de : T1.

### T3 — Socle : capacités, chrono GPU par groupe, profondeur échantillonnable, Z inversé [PHOTO-02]
- Où : src/photo.js (capacites, minuteur), src/renderer.js:1390-1397,1401,1421
- Quoi : `capacites(gl)` lit 11 extensions, limites, UNMASKED_RENDERER, drapeau GPU à tuiles. Minuteur : une requête TIME_ELAPSED_EXT active à la fois, groupes non imbriqués (ombres, prepasse, ecran, opaque, transparents, temporel, post), anneau de 4, médiane sur 30 images. Profondeur DEPTH_COMPONENT32F en texStorage2D. Z inversé si EXT_clip_control (depthFunc GREATER, clearDepth 0). invariant gl_Position dans tous les vertex shaders photo.
- Preuve exigée : sur M5 2560×1440, somme stats.gpu à ±15 % du total readPixels (méthode bancs/renderer.html), scènes A à D. Sans extension chrono, stats.gpu===null et repli sur temps d'image. Capture D (far 900 m) : aucun z-fighting en Z inversé.
- Qualité : identique (le classique ne lit pas ces données).
- Garde-fous : chrono absent sous Firefox/Safari ; EXT_clip_control non vérifié sous Windows NVIDIA (T20) ; MSAA résolu par blit DEPTH vers D32F.
- Dépend de : T2.

### T4 — Architecture : cadre de rendu, graphe de passes, ressources décrites, UBO matières [PHOTO-03]
- Où : src/photo.js (graphe, allocateur, UBO), src/renderer.js:177-332,738-769,1411-1432,1700-1770
- Quoi : renderer.js produit un objet cadre (camera, lots, lumieres, effets, temps). photo.js lit un graphe déclaratif figé à la construction : ombres→prepasse→mips→gtao→ssr→opaque→ciel→transparents→temporel→flou→pdc→exposition→bloom→final. Allocateur crée les cibles au redimensionnement, réutilise les éphémères. UBO Matieres std140 : 32×4 vec4 = 2 Ko. Compilation asynchrone (KHR_parallel_shader_compile) : le classique rend tant que le photo n'est pas prêt.
- Preuve exigée : test simulé : liste ordonnée des passes et ressources figée par preset, octets sous budget. Perte/restauration contexte : image identique. Échelle 1→0,67→1 : aucun texImage ni texStorage. Aucune image > 50 ms pendant la compilation (bancs/passes.html sur M5).
- Qualité : identique (le classique ne passe pas par le graphe).
- Garde-fous : sur-ingénierie (liste déclarative, pas d'ordonnanceur) ; les copies des jeux dérivent du cadre ; le cadre ajoute du CPU par image (mesurer avec draw()).
- Dépend de : T3.

### T5 — HDR linéaire, passe finale unique, bloom en mips, exposition auto [PHOTO-04, NVIDIA-02, NVIDIA-V3]
- Où : src/photo.js (passe finale, bloom, exposition), src/renderer.js:428-437,498,549-551,563,577,1380-1409
- Quoi : cible RGBA16F (Haut/Ultra) ou R11F_G11F_B10F (Moyen). Shaders photo écrivent HDR linéaire × uPreExposition. Passe finale : exposition EV100 → bloom 6 mips (13 taps Karis, tente 3×3) → tonemap 'agx' (Filament Apache-2.0) ou 'aces' (Hill) ou 'ferro' (c/(c+.76)) → LUT 3D 32³ → vignette une seule fois → voile/onde → sRGB exact + tramage ±1/255. Exposition auto : log-moyenne quart résolution, mips 1×1 R16F, τ 0,5 s clair / 1,5-2 s sombre. **NVIDIA-V3** : la passe finale lit la profondeur ; ciel (profondeur 1) → vignette 0,76 sans voile ; avec MSAA+HDR, tonemap réversible t=c/(1+max(c)) avant blit.
- Preuve exigée : dégradé ciel : aucun saut > 1/255 entre lignes voisines. Écrêtage < 0,5 % pixels à 255 (A à D). Exposition B→A : convergence ±0,1 EV en 2 s. Migration 'ferro' : écart ≤ 6/255 vs capture classique A. Coût ≤ 0,8 ms sur M5 1440p.
- Qualité : meilleure (vraie dynamique, pas de bandes).
- Garde-fous : NaN/Inf en fp16 → saturer à 64 000 ; particules mélangées en linéaire (mode parité ou linéaire, écart mesuré) ; MSAA résolu sur valeurs linéaires (crénelage) ; taille ~8-12 Ko.
- Dépend de : T4.

### T6 — Contrat d'image : gigue Halton, vecteurs de mouvement, masque, profondeur, surimpressions [NVIDIA-03, NVIDIA-V4, NVIDIA-V5]
- Où : src/photo.js (gigue, vitesse, masque), src/renderer.js:7-51,738-756,1709,1759-1762
- Quoi : Gigue Halton(2,3)−0,5, N=ceil(8·(Waff/Wrendu)²) : 18, 24, 32, 72. Projection[8]−=2jx/W, [9]−=2jy/H. Vitesse en RG16F location 1 : mv=(prevNdc−curNdc)·0,5·(W,H). Flux précédent 48 o/instance (iPrevPosition, iPrevScale, iPrevRotation). Masque R8 location 2 : bit 0 réactif, bit 1 overlay, bit 2 sans historique. **NVIDIA-V4** : avant les surimpressions, changer l'attachement par framebufferTexture2D au lieu de vider la profondeur ; worldDepth et overlayDepth séparés. **NVIDIA-V5** : mesh.id entier (FRender.partId(entite,piece)=entite·256+piece) ; pièce absente ou forme changée → réactif 1 image.
- Preuve exigée : Halton identique à table référence sur 16 valeurs. Panoramique connu : RMS ≤ 0,05 px vs reprojection analytique. Caméra fixe : |VM| < 0,01 px hors acteurs. worldDepth après surimpressions identique texel par texel. reconstruction:'none' → flux v0.2.
- Qualité : identique (inactif sans réglage).
- Garde-fous : acteurs sans id → réactifs (traînées) ; PDR calcule ses VM dans foule.js ; 32 o/instance envoyés seulement si reconstruction active ; MSAA et MRT délicats (préférer sans MSAA).
- Dépend de : T4, T5.

### T7 — TAA et TAAU maison, interface au format DLSS SR [PHOTO-10, NVIDIA-04]
- Où : src/photo.js (passe TAAU), src/renderer.js:98-112,738-756,1761,1764-1768
- Quoi : Dilatation VM (3×3 plus proche en profondeur). Historique Catmull-Rom 5 taps. Courant : Blackman-Harris 3×3 pondéré 1/(1+luma) en YCoCg. Découpe variance γ 1,0 mouvement / 1,25 arrêt. α ≥ 0,05, relevé par masque réactif, désocclusion (>1 % profondeur linéaire), fx.coupure. Affûtage adaptatif (RCAS force 0,25). Historique RGBA16F double tampon. MSAA coupé en TAA. Interface `amplificateur.evaluer({couleur,profondeur,vitesse,gigue,exposition,preExposition,reactif,transparence,reinitialiser,tailleRendu,tailleSortie,dt,camera})`. Mode 'spatial' (Lanczos-2 ou EASU/RCAS MIT) pour mobiles.
- Preuve exigée : scène statique 64 images : différence temporelle < 0,5/255. SSIM ≥ 0,97 à 100 %, ≥ 0,93 à 67 % vs référence 16×. Cube traversant 20 px/image : traînée < 2 % après 4 images. Coût TAA ≤ 1,4 ms, TAAU ≤ 2,5 ms sur M5. Scène B TAAU 0,67 : critère par passe (temps de scène suit s² à 15 % près), pas de seuil absolu sans protocole (PHOTO-V4).
- Qualité : meilleure (netteté > bilinéaire du navigateur).
- Garde-fous : traînées FPS/course (bornage serré + masque) ; lignes fines PDR (garder MSAA) ; mémoire historique 59 Mo en 1440p ; motifs procéduraux filtrés à la résolution de rendu (ajuster fwidth).
- Dépend de : T5, T6.

### T8 — Presets Bas/Moyen/Haut/Ultra, détection GPU, échelle dynamique, plafond pixels [PHOTO-14, PHOTO-V5]
- Où : src/photo.js (presets, gouverneur), src/renderer.js:806-824,1539-1552
- Quoi : Bas=classique. Moyen(≤128 Mo) : R11G11B10, TAA ou TAAU 0,77 >2 Mpx, 2 cascades 1024 PCF4, SH9, cubemap 64², ni AO/SSR/flou. Haut(≤256 Mo) : RGBA16F, TAAU 0,67-1, 3 cascades 2048 Vogel8, GTAO, SSR, froxels, sondes. Ultra(≤512 Mo) : 4 cascades 3072 PCSS, 8 lampes, ombres contact, TAAU 0,77-1. Détection : garde-fous (sans EXT_color_buffer_float→Bas ; mobile→Moyen ≤1 Mpx DPR≤1,5) ; a priori par regex UNMASKED_RENDERER ; calibration 60 images médiane 30. Budget = 0,85×médiane rAF sur 120 images (14,2 ms à 60 Hz, 7,1 ms à 120 Hz), plancher 6 ms. **PHOTO-V5** : réglage pixelBudget ('gpu' : 1,8/2,4/3,7/8,3 Mpx selon classe) ; sans réglage garder 1,8 Mpx. Échelle dynamique s←s·√(budget/gpu), pas [−0,1;+0,05], plage [0,5;1] TAAU.
- Preuve exigée : tests Node sur traces synthétiques (palier 20→10 ms, bruit ±20 %, pics 50 ms) : convergence < 3 s, ≤ 1 changement/10 s, aucun changement sur pic isolé. Garde-fou mobile : Adreno + 5 points tactiles → Moyen. Banc M5 1440p A-D : p95 ≤ 1,1×budget après 5 s. PC NVIDIA : même mesure dans VERSIONS.md.
- Qualité : identique (le classique ignore les presets).
- Garde-fous : noms masqués (Firefox, Safari) ; Optimus (T18) ; oscillation (10 s entre changements, ≤ 2 montées/session) ; preset qui change en pleine partie (r.onPreset).
- Dépend de : T3, T5.

### T9 — Tests : GL simulé enrichi, bancs file://, chrono par passe, protocole NVIDIA [PHOTO-18, PHOTO-V4]
- Où : checks/photo.test.mjs, bancs/photo.html, bancs/passes.html, bancs/README.md
- Quoi : Simulateur gpu({extensions,limites,echecFbo,chrono}) avec objets d'extension, getParameter étendu, checkFramebufferStatus réglable, requêtes simulées. Tests : repli, budget mémoire, instantané graphe/ressources par preset, gigue, vitesse, gouverneur sur traces, table DFG, std140. Bancs ouverts en file:// par Chrome sans interface (--dump-dom, --host-resolver-rules=MAP * ~NOTFOUND). Scènes A-D. Mesures par readPixels : écrêtage, bandes, scintillement, traînées, SSIM vs référence 16×, NaN. Chrono TIME_ELAPSED par passe (cibles alternées, passe 1×1 dépendante, readPixels), 5 répétitions. **PHOTO-V4** : critères en rapports A/B entrelacés ≥ 6×30 images, médiane et p10 ; ms absolues seulement au repos avec uptime relevé. Corriger GTAO v2 : texelFetch(s,p,0) avec BASE=MAX=l−1.
- Preuve exigée : npm test passe. Une commande lance les deux bancs sur Mac et rend un JSON par scène/preset. Seuils T5-T14 vérifiés automatiquement. 3 sessions au repos : < 15 % d'écart par passe.
- Qualité : identique (aucun code de rendu modifié).
- Garde-fous : sans interface DPR 1, pas de vsync (mesure un débit) ; chrono Metal inclut l'attente en file ; temps réel → fx.time et graines fixés ; aucun serveur, aucun port.
- Dépend de : T2.

### T10 — Ciel dessiné après l'opaque : correctif classique, image identique [PHOTO-V1]
- Où : src/renderer.js:531-551,1623-1630,1741-1758
- Quoi : Vertex shader du ciel : gl_Position=vec4(p*2.-1.,1.,1.). Ordre : ciel après la foule, DEPTH_TEST LEQUAL, depthMask(false), CULL_FACE coupé. Particules et overlay inchangés. Chemin classique derrière {cielApres:true} (défaut en 0.3 sur décision David). Chemin photo : par défaut.
- Preuve exigée : captures C et D avec/sans MSAA : 0 pixel différent. Gain médian ≥ 1,5 ms sur C au M5 (A/B entrelacé 6×30). npm test : sans le réglage, flux v0.2.
- Qualité : visuellement identique.
- Garde-fous : géométrie collée au plan lointain (conflit profondeur) ; flux change → décision de rupture ; gain diminue si ciel très visible.
- Dépend de : rien (correctif indépendant du photo).

### T11 — BRDF physique (GGX, Smith corrélé, multidiffusion) et lumières photométriques [PHOTO-05]
- Où : src/photo.js (brdf, lumières), src/renderer.js:117-125,162,359-368,371-382,390-393,400,403-421
- Quoi : Diffus Lambert×base×(1−metal). Spéculaire GGX α=rugosité² plancher 0,045, Smith-GGX corrélé, Schlick f0=mix(0,16·reflectance²,base,metal). Multidiffusion 1+f0·(1/DFG.y−1), table DFG 32×32 RG16F, 1 024 échantillons. Lumières : power×K (calibré A/B), atténuation saturate(1−(d/r)⁴)²/max(d²,0,01). Retirer fuite +.035, plancher .055, ambiance fixe, reflet ad hoc, borne 12. Garder AA spéculaire.
- Preuve exigée : four blanc metal=1 : 1,00±0,03. Four blanc metal=0 : 0,97-1,10 hors rasant. Table DFG vs intégration CPU : écart ≤ 1 %. Scène B multidiffusion ≤ +5 %. Luminance A/B à ±1 EV du classique.
- Qualité : meilleure (conservation d'énergie, métaux crédibles).
- Garde-fous : intérieurs METAL sans sondes paraissent noirs (repli SH9 + exposition auto) ; couleurs matières à reprendre ; taille ~3-5 Ko.
- Dépend de : T5.

### T12 — Ciel physique Hillaire 2020, perspective aérienne, IBL et sondes [PHOTO-06]
- Où : src/photo.js (atmosphere, ibl, sondes), src/renderer.js:403-421,512-552,1623-1630
- Quoi : Tables transmittance 256×64 RGBA16F, multidiffusion 32×32. Vue ciel 192×108 par image. Perspective aérienne 32³ en atlas 1024×32. Ciel dessiné après l'opaque (test profondeur). IBL cubemap 128² RGBA16F 6 mips GGX 32-64 échantillons, SH9 en 9×1 GPU. Sondes octaédriques 128² TEXTURE_2D_ARRAY, 32 max (~5,6 Mo), capturées au chargement (6 faces 128²), parallaxe boîte, mélange 2 plus proches. API r.setSondes([{p,boite}]), r.salirSondes(zone).
- Preuve exigée : captures soleil −2°, 5°, 30°, 80° : aucun NaN/Inf, horizon continu. Ciel+tables ≤ 0,3 ms/image, recapture ≤ 0,5 ms. Sphère miroir centre pièce cubique : arêtes à 2 texels près. Ciel en dernier : gain mesuré sur C.
- Qualité : meilleure (ciel physique, reflets plausibles).
- Garde-fous : biomes actuels (skyTop/skyBottom) à faire correspondre ; captures au chargement coûteuses sur grands niveaux ; boîte mal posée → lumière traverse murs ; taille ~15-20 Ko.
- Dépend de : T5, T11.

### T13 — Ombres en cascade du soleil, atlas des lampes, filtrage par preset [PHOTO-07]
- Où : src/photo.js (cascades, atlas lampes), src/renderer.js:134-163,379,1421,1578-1622,1737,1751
- Quoi : 2-4 cascades DEPTH_COMPONENT32F en TEXTURE_2D_ARRAY, sampler2DArrayShadow LINEAR. Découpe λ=0,75, sphère englobante, accrochage texel, transition tramée 10 %. EXT_depth_clamp + EXT_polygon_offset_clamp. Cascades lointaines mises à jour toutes les 2^i images (statiques). Moyen : 2×1024 PCF4. Haut : 3×2048 (50 Mo) Vogel8. Ultra : 4×3072 (151 Mo) PCSS 16+16. Lampes : atlas 2048/4096, 2/4/8 tuiles par contribution écran. Correctif classique : torch:false → sauter passe, uShadowSettings.z=0, corriger stats.shadowMaps.
- Preuve exigée : déplacement caméra fraction de texel : contours stables (différence < 1/255 hors pénombre). Aucune couture entre cascades sur D. Ombres jusqu'à 300 m. torch:false → stats.shadowMaps passe de 2 à 1. Ombres ≤ 2 ms Haut M5 scène D.
- Qualité : meilleure (portée, douceur).
- Garde-fous : 2 600 arbres sans cache coûteux ; pénombre PCSS bruitée sans TAA ; extensions non vérifiées Windows ; voitures lointaines perdent ombre si cascades statiques ; taille ~6-10 Ko.
- Dépend de : T5, T4.

### T14 — Pré-passe profondeur+normale, mips de profondeur, GTAO, ombres de contact [PHOTO-08]
- Où : src/photo.js (prepasse, gtao, contact), src/renderer.js:35-39,1390-1397
- Quoi : Pré-passe : D32F + RGB10_A2 (normale octaédrique 10+10, rugosité 10, 2 bits drapeaux). Opaque NVIDIA/AMD/Intel : depthFunc EQUAL sans écriture. Apple : pré-passe seulement si AO/SSR. Mips profondeur RG16F (min,max) 5 niveaux demi-résolution. GTAO demi-résolution 2 directions 6-12 pas tournées, débruitage bilatéral 4×4, remontée guidée profondeur. Ombres contact 8-16 pas écran vers soleil/lampe. Appliquer au diffus indirect et occlusion spéculaire (Lagarde), jamais directe.
- Preuve exigée : GTAO ≤ 1,3 ms M5 1440p. Halos ≤ 2 px aux discontinuités (A,B,D). Sol au soleil contre mur : luminance ±2 % AO on/off. Pré-passe EQUAL : effet chiffré au chrono sur D.
- Qualité : meilleure (posé, contact).
- Garde-fous : pré-passe sur 209 000 triangles inutile sur Apple ; vent matière 11 (L35-39) reproduit à l'identique ; EQUAL échoue si vertex non invariant ; sortir normale géométrique+rugosité de table (pas normale perturbée) ; taille ~6-8 Ko.
- Dépend de : T3, T5.

### T15 — Matières PBR en données : vernis, paillettes, mouillé, métal usé, béton, verre [PHOTO-12]
- Où : src/photo.js (matieres, couches), src/renderer.js:104-112,177-348
- Quoi : Table UBO (T4) : matières 0-18 avec valeurs proches du classique. Couches : vernis (GGX 2e lobe rugosité 0,03 f0 0,04) ; paillettes (normales hachées cellule stables TAA) ; mouillé (fx.pluie×porosité → albédo assombri, rugosité→0,05-0,1, flaques bruit n.y>0,9, SSR) ; métal usé (arêtes L337-348 pilote métal/rugosité) ; béton (reliefNormal) ; verre (réfraction copie HDR opaque). Cuisson facultative Haut+ : TEXTURE_2D_ARRAY 256² (~13 Mo) ou 512² (~51 Mo), mips, anisotropie 16.
- Preuve exigée : jeu ajoute matière 19 par options.matieres sans toucher src/. Voiture vernie : deux lobes visibles. fx.pluie 0→1 : rugosité chaussée ≤ 0,15, SSR apparaît. Cuisson fait baisser chrono opaque sur A (sinon abandon). Chaque matière sans motif passe four blanc T11.
- Qualité : meilleure (laque, mouillé, usure).
- Garde-fous : mémoire textures cuites sur GPU intégré ; aspect actuel à retrouver ; paillettes instables TAAU ; bruits non périodiques (répétition visible) ; taille ~10-20 Ko.
- Dépend de : T11.

### T16 — Points d'accroche externes : passes HDR avec vitesse, vues secondaires [PHOTO-15]
- Où : src/photo.js (fx.passes, r.vue), src/renderer.js:1759-1762
- Quoi : fx.passes=[{nom,phase:'ombre'|'opaque'|'transparent',dessiner(gl,ctx)}]. ctx.glsl.commun (UBO Image binding 0), ctx.glsl.eclairage (ferroEclairer), ctx.glsl.sortie (ferroSortie→HDR+vitesse+masque). Passe finale (brouillard, tonemap, vignette) reste FERRO. r.vue(nom,{largeur,hauteur,camera,frequence}) : graphe réduit (pas TAA, exposition principale, cascades réutilisées, ni SSR/froxels), sortie RGBA8. Classique : fx.foule et renderer.pdr inchangés.
- Preuve exigée : bancs/ dessine foule 10 000 instances via fx.passes : écart ≤ 2/255 vs cube FERRO. Mouvement : pas de traînée (test T7). Rétroviseur 512×128 ≤ 1,5 ms M5. Sans fx.passes, flux identique.
- Qualité : identique (inactif sans fx.passes).
- Garde-fous : GLSL exposé = contrat à versionner ; PDR réécrit ses shaders ; seconde vue coûteuse sur intégré ; découper draw() et couper vignette/blessure/onde (L430-437) ; taille ~4-6 Ko.
- Dépend de : T4, T5.

### T17 — Compilation asynchrone sous ANGLE D3D11 : variantes par #define [PHOTO-20]
- Où : src/photo.js (compilation), src/renderer.js:53-439,371-382,1369-1378,1434
- Quoi : Variantes par #define selon le preset (ne compiler que celle du preset courant). KHR_parallel_shader_compile + COMPLETION_STATUS_KHR : le classique rend pendant la compilation. Boucles lumières bornées par grappes, jamais déroulées. stats.compilation par variante.
- Preuve exigée : PC NVIDIA : ≤ 1 s/variante, aucune image > 50 ms. M5 : ≤ 300 ms/variante.
- Qualité : identique (aucun changement d'image).
- Garde-fous : risque D3D11 sur portable (5060 Laptop) ; la 5090 Linux passe par OpenGL/Vulkan ; cache Chrome atténue les lancements suivants ; registres réduisent l'occupation.
- Dépend de : T4.

### T18 — Détection adaptateur, conseil Optimus, gouverneur sur temps GPU [NVIDIA-05]
- Où : src/photo.js (adapter, gouverneur), src/renderer.js:1353,806-821,1545
- Quoi : FRender.adapter()→{api,vendor,renderer,integrated} lu une fois dans UNMASKED_RENDERER_WEBGL. Analyseur sur 12 chaînes (NVIDIA/Intel/AMD/Apple/ARM). Conseil Optimus (Windows + puce intégrée) : texte au conditionnel, localStorage try/catch, une fois par appareil. Gouverneur : anneau 4 requêtes, lissée 0,5 s, budget médiane rAF/60 ; monter s et maxOutputPixels (→8,3 Mpx) si GPU < 0,55×B pendant 3 s ; baisser si > 0,85×B pendant 1 s. Sans extension : logique actuelle fx.frameMs. Préréglage 'Fine+' (vendor=nvidia, non intégré) : sortie native, TAAU 0,67, shadowMapScale 2, qualité high.
- Preuve exigée : test Node analyseur 12 chaînes. david-pc : stats.adapter.vendor='nvidia'. Auto 3840×2160 : canvas à résolution d'affichage, banc tient fréquence−5 %. Pas de régression puce intégrée : i/s ≥ 97 % de la 0.2. Conseil sur chaîne simulée Intel UHD Windows. Aucun appel réseau.
- Qualité : identique (le classique ignore l'adaptateur).
- Garde-fous : chaîne vide (Firefox resistFingerprinting) → vendor null ; mauvaise classification ; événements GPU_DISJOINT ; profils pilote Optimus passent outre ; le nom ne sert qu'au conseil (pas au preset, décision 12/11) ; analyseur couvre Linux.
- Dépend de : T3.

### T19 — Banc NVIDIA reproductible : temps GPU par passe, adaptateur, percentiles, JSON [NVIDIA-06]
- Où : bancs/photo.html, bancs/passes.html, bancs/README.md, mesures/nvidia/
- Quoi : Étendre bancs/ sans dépendance. Relève : adaptateur, navigateur, sortie (1080/1440/4K), mode (none/msaa4/taau 0,67/0,58/0,5/spatial), temps GPU par passe (scène, reconstruction, bloom, finale) via EXT_disjoint_timer_query_webgl2, percentiles p50/p95/p99 sur 1 200 images après 300 chauffe, parcours caméra fixes. Export JSON par Blob (téléchargement, sans réseau). Protocole : secteur, vsync noté, 3 passages. Champs os, session, pilote, alimentation.
- Preuve exigée : schéma JSON {date,navigateur,ua,adapter,sortie,mode,s,gpuMs:{scene,reconstruction,bloom,finale,total},frameMs:{p50,p95,p99}}. 3 passages : p50 à ±5 %. Tourne Chrome et Edge Windows, Chrome Linux. Firefox : marqué « CPU seulement ».
- Qualité : identique (aucun code de rendu modifié).
- Garde-fous : david-pc injoignable (SSH) → passage manuel David ; variations thermiques ; vsync plafonne intervalle (le temps GPU fait foi) ; sous Linux X11 minuteur dans 42,79 % des rapports.
- Dépend de : T9, T3.

### T20 — Matrice de qualification NVIDIA : 5090 Linux + 5060 Laptop Windows [PHOTO-V3]
- Où : bancs/README.md, VERSIONS.md
- Quoi : David désigne la machine de référence et confirme son état. Sur chaque poste (5090 Linux, 5060 Windows, M5) : relever backend ANGLE ; sur portable forcer Chrome sur RTX ; lancer sonde et bancs en file:// ; écrire JSON daté (renderer, pilote, backend, résolution, fréquence, charge). Revoir l'option WebGPU (T24) selon le système.
- Preuve exigée : trois tableaux dans VERSIONS.md. UNMASKED_RENDERER nomme la RTX 5060 (pas la puce intégrée). Décision David écrite.
- Qualité : identique (mesure seule).
- Garde-fous : machines injoignables au dernier relevé ; une note ne prouve pas l'état présent ; liste de blocage GPU Chrome Linux ; Smart App Control portable.
- Dépend de : T19.

### T21 — SSR hi-Z et brouillard volumétrique en froxels [PHOTO-09]
- Où : src/photo.js (ssr, froxels), src/renderer.js:424-427
- Quoi : SSR demi-résolution, marche hi-Z mips min/max, 32+6 pas. Source HDR pré-exposé image précédente reprojetée. Coupure progressive rugosité 0,35-0,5. Confiance réduite bord écran, faces arrière, épaisseur. Mélangé à IBL/sondes. Froxels 160×90×64 tranches exponentielles, atlas 2D 8×8 tuiles 160×90. Injection densité×diffusion soleil+lampes. Intégration avant→arrière. Reprojection temporelle 0,9 (2×7,4 Mo). Lus dans opaque et ciel. Moyen : brouillard hauteur + perspective aérienne seulement.
- Preuve exigée : SSR et froxels ≤ 1,5 ms chacun M5 Haut 1440p. Aucun reflet d'objet derrière le réflecteur. Faisceau B : luminance sous lampe ≥ 1,2× volume voisin. Aucune bande (gigue de tranche).
- Qualité : meilleure (sols mouillés, faisceaux).
- Garde-fous : bords d'écran ; vue de haut PDR (rayons sortent) ; petites lampes floues ; ×2,5-×4 sur intégré (coupés) ; banc SSR sans hi-Z réel (coût à remesurer) ; taille ~14-18 Ko.
- Dépend de : T7, T14.

### T22 — Flou de mouvement (McGuire) et profondeur de champ [PHOTO-11]
- Où : src/photo.js (flou, pdc), src/renderer.js:4-5
- Quoi : Flou : max par tuile 16×16 borné 32 px, max voisinage 3×3, 12 taps, obturateur 180°. options.flou{camera:0..1,objets:0..1}. Overlay exclu. PDC : collecte demi-résolution 24 taps, CoC physique (focale FOV, ouverture, mise au point jeu ou sonde centre). Mode miniature (bande nette) PDR. Moyen : les deux coupés.
- Preuve exigée : vitesse nulle + mise au point ∞ : sortie identique à l'entrée au bit près (court-circuit si max tuile < 0,5 px → copier). Coûts M5 : flou ≤ 2,2 ms, PDC ≤ 1,6 ms. Aucune fuite sur arme/cockpit.
- Qualité : meilleure (vitesse, visée).
- Garde-fous : flou caméra gêne en FPS ; artefacts bords objets rapides ; dépend de vitesse correcte (id fournis) ; taille ~9-13 Ko.
- Dépend de : T7.

### T23 — Lumières en grappes (forward+) et décalques procéduraux [PHOTO-13]
- Où : src/photo.js (grappes, decalques), src/renderer.js:371-382,717-730
- Quoi : Grappes 16×9×24 tranches exponentielles. Lumières ≤ 256 en UBO 8 Ko (2 vec4 chacune). Indices en R16UI. Répartition CPU par image < 0,2 ms pour 64 lumières. Décalques : 128 boîtes orientées UBO 8 Ko (64 o chacune). Motifs procéduraux (impact, brûlure, trace, bande, fissure). Appliqués dans opaque avant éclairage sur albédo/rugosité/normale. API r.decalque({p,taille,orientation,motif,couleur,duree}).
- Preuve exigée : B avec 64 lampes : chrono opaque ≤ boucle fixe 16 lampes actuelle. Répartition ≤ 0,3 ms CPU. 128 décalques sans perte d'images. Test simulé : blocs < MAX_UNIFORM_BLOCK_SIZE.
- Qualité : meilleure (tirs, explosions, impacts).
- Garde-fous : coût CPU JS grandes lumières ; décalques sur dynamiques exclus v1 ; lumières transitoires divergentes classique/photo ; atlas généré par code ; taille ~10-15 Ko.
- Dépend de : T4.

### T24 — Backend WebGPU facultatif, pont vers wgpu/Dawn [NVIDIA-07]
- Où : src/photo.js (backend webgpu), nouveau src/photo-webgpu.js
- Quoi : FRender.create(canvas,{backend:'webgl2'|'webgpu'|'auto'}), 'webgl2' par défaut. 'auto' : WebGPU si navigator.gpu et non isFallbackAdapter. WGSL écrit à la main. Fonctions si présentes : timestamp-query, drawIndexedIndirect, subgroups, shader-f16, canvas rgba16float extended. requiredLimits depuis adapter.limits. Perte device = perte contexte. createAsync ou promesse ready (requestAdapter/Device asynchrones).
- Preuve exigée : banc rend mêmes scènes deux backends : écart ≤ 2/255, PSNR ≥ 38 dB. david-pc : chrono WebGPU vs WebGL2 dans JSON T19. Retour auto WebGL2 testé. Page BITUME +120 Ko max, sous 1,4 Mo. npm test vert.
- Qualité : identique (même contrat d'image).
- Garde-fous : effort XL, deux backends ; WebGPU absent Firefox Linux stable, Windows ARM64 derrière drapeau ; budget taille (renderer BITUME pèse 117 Ko seul) ; rg11b10ufloat-renderable requis ; canvas un seul type de contexte.
- Dépend de : T6.

### T25 — Traçage analytique des primitives FERRO (expérimental) [PHOTO-19]
- Où : bancs/trace.html (prototype), src/photo.js (si validé)
- Quoi : BVH CPU au setWorld (primitives statiques L622-704, instances 64 o L751) en RGBA32F. Passe demi-résolution 1-2 rayons/pixel, pile 24 nœuds, intersections rayon-boîte orientée et rayon-cylindre. Usages : AO 2-8 m, ombre douce soleil étendu. Accumulation TAA. Repli : GTAO + PCSS. Prototype dans bancs/ avant intégration.
- Preuve exigée : scène C demi-résolution 1440p : ≤ 3 ms RTX milieu gamme, ≤ 6 ms M5. Gain jugé sur captures vs GTAO/PCSS ; sinon abandon consigné.
- Qualité : meilleure (si validé).
- Garde-fous : nappes et dynamiques hors BVH ; rayons divergents ; mémoire > 10 000 primitives ; reconstruction coûteuse destruction METAL ; BITUME passe par setLots (BVH doit l'inclure) ; P3, hypothèse non mesurée.
- Dépend de : T14, T7.

### T26 — Alternatives ouvertes : FSR 2 (MIT), XeSS, neuronal [NVIDIA-10]
- Où : README.md (section Reconstruction)
- Quoi : Tableau de décision : technique, statut, licence, API. Reprendre de FSR 2.2/3.1 (MIT) : pyramide luminance, découpage profondeur, verrous détails, masque réactif. EASU/RCAS pour mode 'spatial' (mention AMD). Écarter FSR 4 (DLL signées AMD) et XeSS (binaire seul) dans la page. Réseau neuronal : rien avant WebGPU + subgroup-matrix livré. Estimation ESPCN 3 couches : ~28 GFLOP/image, 3,7-9,3 ms à 10-25 % d'une carte 30 TFLOPS (vs 0,3-0,6 ms TAAU).
- Preuve exigée : tableau dans README. Aucun binaire fabricant dans src/. Toute reprise MIT garde sa mention.
- Qualité : identique (documentation).
- Garde-fous : copier sans mention MIT ou suivre GPL par mégarde ; coût d'opportunité neuronal ; gpuweb#11088 pourrait offrir un reconstructeur natif un jour.
- Dépend de : rien.

## Options désactivées par défaut
- [PHOTO-01] Mode photo — désactivé tant que la fluidité à résolution native n'est pas prouvée sur les deux cibles NVIDIA (T20). Le joueur active via menu « Rendu : photo ».
- [NVIDIA-07] Backend WebGPU — désactivé par défaut (backend:'webgl2') ; activé seulement si navigator.gpu et adaptateur non-fallback.
- [PHOTO-19] Traçage analytique — désactivé, expérimental, non mesuré ; activé par bancs/trace.html uniquement.
- [PHOTO-04] Histogramme 64 cases (EXT_float_blend) — désactivé par défaut, activé par options.exposition.histogramme.
- [PHOTO-12] Cuisson des matières en TEXTURE_2D_ARRAY — désactivée par défaut, activée en Haut+ après mesure du gain au chrono.

## Écartés ou absorbés
- [PHOTO-16] — Décision DLSS déjà prise (12/11/2026 : web seul, TAAU maison). Absorbé par T1 (NVIDIA-V1).
- [PHOTO-V2] — Voile du brouillard de guerre de PDR : concerne seulement Point de rupture. Le mécanisme fx.finale est intégré dans T16 (fx.passes phase finale) si PDR l'utilise un jour.
- [NVIDIA-01] — Choix de la voie NVIDIA déjà tranché (A, web seul). Absorbé par T1 (NVIDIA-V1).
- [NVIDIA-08] — Prototype natif DLSS 4.5 : réfuté, David a exclu l'édition native le 12/11/2026 (« non osef dlss 5 pas grave »).
- [NVIDIA-09] — Accès SDK DLSS 5 : réfuté, même décision. Seul garde-fou retenu : aucune DLL nvngx_dlssnr, aucun dépôt tiers (reporté dans T1).

## Décisions à confirmer par David
- [PHOTO-17] Place du photoréalisme : la feuille de route BITUME (FEUILLE-DE-ROUTE.md:31-32) dit « pas le photoréalisme », la demande du 12/11 le réclame. Le photo est-il le rendu par défaut sur PC à GPU dédié, ou une option de menu ? Tonemap par défaut (agx / aces / ferro) ? Critères de capture à réécrire avec exposition fixe ? — **Valeur par défaut proposée** : photo en option de menu, 'auto' sur GPU dédié, classique ailleurs ; tonemap 'agx' ; critères réécrits avec EV fixe.
- [PHOTO-V1] Le ciel après l'opaque devient-il le défaut du chemin classique en 0.3 (rupture de flux GL), ou reste-t-il derrière {cielApres:true} ? — **Valeur par défaut** : défaut en 0.3, inscrit dans VERSIONS.md.
- [PHOTO-V5] Le plafond de 1,8 Mpx est-il levé par défaut sur les cartes NVIDIA détectées, ou reste-t-il à 1,8 Mpx tant que le joueur n'a pas choisi 'gpu' ? — **Valeur par défaut** : garder 1,8 Mpx sans réglage ; 'gpu' est une option.
- [NVIDIA-V2] david-pc (RTX 5090 Linux) est-il joignable pour le banc, ou faut-il un passage manuel ? Le portable RTX 5060 Laptop est-il disponible et sous quelle version de Chrome ? — **Valeur par défaut** : prévoir un passage manuel David sur les deux machines.
- [PHOTO-10] Les jeux peuvent-ils fournir un id stable par acteur dynamique (METAL : FActors, destruction ; BITUME : pièces voiture) ? — **Valeur par défaut** : id optionnel ; sans id, pixel réactif.

## Gains attendus du lot
- **Fluidité** : à s=0,67 en TAAU, 55 % de pixels ombrés en moins ; le monde coûte ~0,94 ns/px sur M5, soit ~5 ms économisés sur une scène B à 1440p. Sur RTX milieu gamme (÷2 à ÷3), le gain absolu est de 2 à 4 ms. Le gouverneur sur temps GPU (T18) évite les saccades en maintenant le budget à 0,85×rAF.
- **Qualité** : HDR + BRDF + cascades + GTAO + TAAU donnent une image de niveau « photo » sans asset importé. Le bloom sur l'énergie réelle (T5) supprime les bandes ; les cascades (T13) portent l'ombre à 300 m ; le GTAO (T14) pose les objets.
- **NVIDIA** : détection d'adaptateur + conseil Optimus + plafond pixels levé (T18, T8) exploitent une RTX 5060/5090 dans le navigateur sans DLL. Le contrat d'image (T6) permet de brancher un reconstructeur natif un jour sans réécrire les shaders.
- **Mesuré** : ciel après opaque (T10) gagne 2,2-3,7 ms sur C à image identique. HDR net (T5) : +0,40 à +0,63 ms sur M5. TAAU (T7) : ≤ 2,5 ms. Le lot complet Haut à 1440p vise ≤ 12 ms sur M5 (vs 4,9-12,2 ms du classique), soit une image photo dans le budget 60 Hz.
