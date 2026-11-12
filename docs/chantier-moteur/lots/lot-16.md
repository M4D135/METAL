# Lot 16 — Ciel

> **Décision de David (12 novembre).** 18 ciels distincts, un par monde : confirmé.

## But
Remplacer la passe de ciel procédurale par un ciel physique en textures amorties (tables d'atmosphère + dôme de nuages cuit), coût par pixel ×0,36 à ×0,60 mesuré, bandes divisées par 40.
Donner 18 ciels distincts aux 18 mondes de METAL via une API `atmosphere.sky` ; sans ce champ, l'image actuelle reste identique au bit près.
Architecture en trois étages (tables, dôme, passe finale) compatible FERRO v0.2, secours Canvas 2D, paliers mobile.

## Tâches, dans l'ordre

### T1 — API de ciel et chemin hérité préservé [CIEL-11]
- Où : ferro src/renderer.js:1339-1343@248043a ; ferro src/renderer.js:706-713@248043a ; ferro src/renderer.js:866-901@248043a ; metal src/renderer.js:452-492@673d6b2
- Quoi : exposer `atmosphere.sky = {sun, moon, turbidity, aerosol, ozone, groundAlbedo, clouds, wind, stars, exposure, seed, shadows, horizon}` ; absent → chemin actuel, image identique. Par renderer : `create(canvas, {sky:{dome, slices, tone, dither}})`. Exposer `renderer.skyPresets` (7 préréglages) et `renderer.sky = {sunColor, ambient, exposure}`. Secours Canvas 2D : dégradé 5 arrêts par portage JS. Sans rendu flottant : RGBA8 encodé.
- Preuve exigée : bancs/ciel-verif/ `./run2.sh 'cielv.html#gate,24' out gate.json` → `octetsDifferents = 0` sur 4 environnements × 4 tangages × 2 définitions ; test contexte WebGL simulé : sans `sky`, séquence d'appels GL identique à 248043a.
- Qualité : identique (chemin hérité) ; meilleure (avec `sky`).
- Garde-fous : `settings` figé à la création (pas de seuil de bloom par monde) ; deux chemins à maintenir ; `environmentInfo` recopie les champs inconnus par `{...value}` → `sky` traverse sans modification (vérifié). Taille ajoutée ≈ 25-28 Ko (2 % du budget 1,4 Mo).
- Dépend de : rien.

### T2 — Architecture du ciel en textures amorties [CIEL-01]
- Où : ferro src/renderer.js:512-552@248043a ; ferro src/renderer.js:1623-1629@248043a ; ferro src/renderer.js:1741@248043a ; metal src/renderer.js:452-492@673d6b2 ; metal src/renderer.js:1460-1465@673d6b2
- Quoi : trois étages — (1) deux tables 192×128 RGBA16F (Rayleigh + Mie sans phase), recuites au changement de soleil/météo ; (2) dôme paraboloïde 1024² RGBA16F (A, B, en cours + travail), cuisson par tranches de 4 lignes (1/256/image), permutation A←B←C ; (3) passe finale native : 2 lectures table + 2 lectures dôme fondues, reprojection vent, Mie analytique, disque solaire, tramage. Repli RGBA8 si `EXT_color_buffer_float` absent.
- Preuve exigée : bancs/ciel/ `node gen-proto.mjs <renderer> ciel.html && ./run2.sh 'ciel.html#bench,40,plein-jour' out bench.json` → à 2880×1864 plein écran, textures + tranche 1/256 ≤ 60 % de l'actuel (mesuré 0,56-0,60) ; à 1792×1008 (qualité auto METAL) : neutre à −0,25 ms.
- Qualité : meilleure (modèle physique, nuages volumétriques, étoiles).
- Garde-fous : 33,5 Mo de textures à 1024² (4 dômes RGBA16F) ; premier usage de `EXT_color_buffer_float` dans FERRO (actuellement RGBA8, lignes 1382/1403) ; recuire après `webglcontextrestored` ; image différente → derrière `atmosphere.sky` (T1).
- Dépend de : T1 (CIEL-11).

### T3 — Crêtes d'horizon : branches sur le chemin hérité + couche pour le nouveau ciel [CIEL-V3]
- Où : ferro src/renderer.js:539-548@248043a ; metal src/renderer.js:479-488@673d6b2 ; ferro src/renderer.js:893-900@248043a
- Quoi : (1) chemin hérité : entourer les lignes 539-542 de `if(ray.y > -.01){…}` et 544-548 de `if(ray.y < .125){…}` — `smoothstep` sature hors bornes, `mix(a,b,0)=a` → image identique au bit près. (2) Nouveau ciel : anneau de géométrie (bande 256 segments, teintée par la couronne d'horizon de T13) ou borne `if(d.y < .125)` ; exposer `atmosphere.sky.horizon`. (3) Secours Canvas 2D garde ses deux couches.
- Preuve exigée : bancs/ciel-verif/ `./run2.sh 'cielv.html#gate,24'` → `octetsDifferents = 0` ; `./run2.sh 'cielv.html#bench,30,plein-jour'` → ratio texturesCretes ≤ 0,80. Chemin hérité : 0,53-0,64× à 2560×1440 (−0,50 à −0,65 ms), 0,62-0,79× à 1792×1008 (−0,17 à −0,27 ms).
- Qualité : identique (hérité, vérifié bit à bit) ; meilleure (nouveau ciel avec horizon fermé).
- Garde-fous : un compilateur peut aplatir les branches (gain nul, image identique) ; les octets de `SKY_FRAG` changent → les tests comparent des pixels, pas la chaîne du shader.
- Dépend de : T1 (CIEL-11) ; le point 1 est indépendant du nouveau ciel.

### T4 — Séparer l'astre visible de la direction d'éclairage [CIEL-V2]
- Où : ferro src/renderer.js:1596-1617@248043a ; ferro src/renderer.js:383-386@248043a ; ferro src/renderer.js:711@248043a ; metal src/renderer.js:651@673d6b2 ; metal src/renderer.js:1440@673d6b2 ; metal checks/world.test.mjs:93@673d6b2
- Quoi : dans `atmosphere.sky`, deux directions : `sun` (astre visible, libre sous l'horizon) et `key` (éclairage + ombres). Par défaut `key` = même azimut, élévation relevée à un plancher réglable (18° conseillé, `sin ≥ 0,3` pour `world.test.mjs:93`). La nuit, `key` = direction de la lune avec le même plancher. La borne de la ligne 711 s'applique à `key`, pas à `sun`. `environment.sunDirection` de METAL reste `key` : aucun test ni monde modifié.
- Preuve exigée : capture d'une arène à `key = 3°` puis `key = 18°` avec le même ciel → ≥ 40 % du sol au soleil direct ; `npm test` inchangé (world.test.mjs:93 vert) ; écart disque/key ≤ 20°.
- Qualité : meilleure (crépuscules et nuits possibles sans arènes à l'ombre).
- Garde-fous : écart visible disque/ombres aux soleils très bas (masquer par nuages bas) ; compatible cache d'ombres statiques (axe DRAW) car `key` fixe par monde ; aucun coût par image.
- Dépend de : T1 (CIEL-11).

### T5 — Atmosphère physique Rayleigh / Mie / ozone [CIEL-02]
- Où : ferro src/renderer.js:536@248043a ; ferro src/renderer.js:706-713@248043a ; metal src/renderer.js:476@673d6b2 ; metal src/renderer.js:651@673d6b2
- Quoi : modèle Hillaire 2020 — rayon 6360 km, atmosphère 100 km ; Rayleigh (5,802 ; 13,558 ; 33,1)e-3/km, h=8 ; Mie 3,996e-3×turbidité, g=0,8 (Cornette-Shanks), h=1,2 ; ozone tente à 25 km. Tables : transmittance 256×64, multidiffusion 32×32 (approximation isotrope 0,030×√transmittance+9 km, à remplacer par table de Hillaire), vue du ciel 192×128. Lever la borne ligne 711 pour `sun` (pas `key`, voir T4). Nuit : source = lune.
- Preuve exigée : bancs/ciel/ `./run2.sh 'ciel.html#shots,aube,plein-jour,crepuscule,nuit'` → captures à −2°, 5°, 30°, 80° sans NaN ni rupture à l'horizon ; cuisson des tables 1,7-2,2 ms (mesuré) ; RGBA/FLOAT vérifié.
- Qualité : meilleure (ciels crédibles à toute heure, 5 paramètres au lieu de 3 couleurs).
- Garde-fous : courbe de tonalité actuelle (blanc à 0,76) désature le ciel de jour → livrer avec la courbe moteur, filmique en même temps que PHOTO-04/NVIDIA-02 ; soleil sous l'horizon impossible sur le chemin hérité ; exposition manuelle par préréglage (auto dépend de T12).
- Dépend de : T1 (CIEL-11), T4 (CIEL-V2).

### T6 — Nuages en volume cuits dans le dôme [CIEL-03]
- Où : ferro src/renderer.js:526-531@248043a ; ferro src/renderer.js:539-542@248043a ; metal src/renderer.js:479-482@673d6b2
- Quoi : bruit 3D périodique 64³ RGBA8 (Perlin-Worley + Worley fins + Perlin), mips, généré par 64 tranches GPU au chargement. Marche 36 pas, portée 28 km, 5 pas de lumière croissants, Beer-Lambert, phase deux lobes (g 0,78 et −0,22) + lobe bord (g 0,96), multidiffusion deux exponentielles, ambiance depuis la table du ciel. Décalage aléatoire par texel + filtre tente (4 lectures bilinéaires). Fondu A→B, reprojection vent. Qualité basse : cuisson unique au chargement.
- Preuve exigée : bancs/ciel/ `./run2.sh 'ciel.html#shots' shots.json` → `texturesContreDirect` ≤ 2,0 niveaux moyen ; `dome512Contre1024` lu ; cuisson complète 17,9-18,9 ms sous charge ; surcoût tranche 1/256 : 0,12-0,27 ms à 1,8 MPix. Capture à la définition native avec géométrie du jeu et bloom.
- Qualité : meilleure (volume, ombre propre, bords éclairés, teinte de l'heure).
- Garde-fous : tranches en cours jamais affichées (cuire dans C, permuter) ; grain résiduel en couches épaisses → accumulation entre cuissons ; stries radiales à l'horizon (voir T14) ; bords flous à 1024² (4-8 texels/° contre 16-21 px/° écran).
- Dépend de : T2 (CIEL-01).

### T7 — Masque de bloom pour le nouveau ciel [CIEL-V1]
- Où : ferro src/renderer.js:561-563@248043a ; ferro src/renderer.js:577@248043a ; ferro src/renderer.js:1740-1741@248043a ; metal src/renderer.js:501@673d6b2
- Quoi : la passe de ciel écrit `alpha = 0` (atmosphère, corps des nuages), `alpha = 1` (disque solaire), fraction (bords éclairés). `bright()` multiplie par `texture(uScene, uv).a`. Monde et ciel hérité écrivent déjà `alpha = 1` (lignes 438, 551) → image inchangée. Particules : `blendFuncSeparate` pour ne pas salir le masque. MSAA : cible RGBA8 (ligne 1403).
- Preuve exigée : capture « plein jour » avec bloom, écart moyen ≤ 2 niveaux vs sans bloom hors rayon 5° autour du soleil ; silhouettes d'ennemis sur fond de ciel sans halo ; poids du seuil de bloom ≤ 0,07 (actuel) au lieu de 0,25-0,60 (mesuré sur les nouveaux préréglages).
- Qualité : meilleure (évite un voile 4-30× plus fort qu'aujourd'hui).
- Garde-fous : chemin hérité à `alpha = 1` obligatoire ; si chaîne HDR (PHOTO-04) arrive, le seuil se fait avant tonalité → masque inutile ; coût nul (une multiplication).
- Dépend de : T2 (CIEL-01).

### T8 — 18 ciels distincts pour METAL [CIEL-10]
- Où : metal src/world.js:38@673d6b2 ; metal src/world.js:645-652@673d6b2 ; metal src/game.js:143@673d6b2 ; metal src/game.js:154@673d6b2 ; metal src/game.js:698@673d6b2
- Quoi : table de 18 préréglages dans `src/skies.js` (≈ 2 Ko), passée par `renderer.setWorld(…, {…world.environment, sky: SKIES[index]})` aux lignes 143/154. `world.js` non modifié. 6 paliers par biome (Lisière : aube brumeuse → nuit de lune ; Carrière : après-midi poussiéreuse → orage sec ; Jardins : nuit étoilée → heure bleue). Le vent du ciel reprend `environment.wind`. La météo de particules (pollen, ash, motes) reste celle du biome : limiter les paliers à ce que le biome sait montrer.
- Preuve exigée : `npm test` inchangé (monde identique octet pour octet) ; planche de 18 captures à l'arène de chaque monde ; test : deux mondes d'index différents → préréglages différents.
- Qualité : meilleure (18 ambiances reconnaissables au lieu de 3).
- Garde-fous : l'objet monde n'a pas de champ d'index → `game.js` fournit l'index de campagne ; les paliers à soleil très bas (1°, 2°, 3°, −6°) contredisent `sunDirection` → utiliser `key` de T4 ; lisibilité des mondes sombres : plancher d'ambiance (décision nuit américaine).
- Dépend de : T1 (CIEL-11), T5 (CIEL-02).

### T9 — Soleil, lune et étoiles en points [CIEL-04]
- Où : ferro src/renderer.js:537-538@248043a ; metal src/renderer.js:477-478@673d6b2 ; metal src/world.js:648@673d6b2
- Quoi : soleil rayon angulaire 0,0125 rad (actuel 1,5-2,2° = 7× le vrai 0,27°), assombrissement au bord `1−u·(1−√(1−r²))`, u=(0,50;0,62;0,78), bord anticrénelé, couleur = transmittance vers le soleil, masqué par nuages et sous l'horizon. Lune : normale reconstruite, phase par direction du vrai soleil, mers par bruit 3D. Étoiles : ~3 000 points instanciés (magnitudes loi de puissance, deux teintes), additif après le ciel, atténués par masse d'air et transmittance des nuages (shader de sommets). Voie lactée cuite dans la table de nuit.
- Preuve exigée : bancs/ciel/ variante « étoiles en points » vs « texturesNuit » → nuit à 2560×1440 : 0,72-0,80 ms (rapport 0,31-0,33 de l'actuel 2,37-2,47 ms) ; à 1792×1008 : 0,30-0,43 ms vs 0,87-0,90 ms. Coût points ≤ 0,05 ms (sous le bruit).
- Qualité : meilleure (nuit crédible, astres physiques).
- Garde-fous : points ≥ 1 px pour ne pas scintiller ; si le ciel passe après l'opaque (T11), points à `z = w` avec `LEQUAL` ; secours Canvas 2D : quelques dizaines d'étoiles ; branche lune dans le shader (coût limité au voisinage).
- Dépend de : T2 (CIEL-01), T5 (CIEL-02).

### T10 — Tramage anti-bandes [CIEL-05]
- Où : ferro src/renderer.js:549-551@248043a ; ferro src/renderer.js:428-432@248043a ; metal src/renderer.js:489-491@673d6b2
- Quoi : après le gamma, ajouter `(hash(p) + hash(p+(113,5;37,25)) − 1)/255`, `p = gl_FragCoord.xy`. Appliquer à la dernière écriture 8 bits : dans `POST_FRAG` (composition) quand le bloom est actif, dans les shaders de ciel et de monde sinon (les aplats de brouillard ont le même défaut). Bruit blanc ou bleu, pas de motif ordonné (moiré au redimensionnement). Option `settings({dither:true})`, désactivée par défaut sur le chemin hérité.
- Preuve exigée : bancs/ciel/ mode `#shots` → `bandesActuel-*` et `bandesNouveau-*-trame` dans `shots.json` ; critère : part ≤ 3 % et plage maximale ≤ 20 px à 2560×1440. Mesuré : actuel 40-55 % (plage max 59-123 px) → tramé 0,9-1,2 % (plage max 13-16 px).
- Qualité : meilleure (bandes divisées par 40-50).
- Garde-fous : change chaque pixel d'au plus 1 niveau → tests de capture au pixel près désactivent l'option ; compression vidéo légèrement moins efficace ; avec bloom actif, le tramage dans la passe de ciel est défait par la requantification de `POST_FRAG` (ligne 577).
- Dépend de : rien (applicable au ciel actuel dès maintenant).

### T11 — Ciel après l'opaque, cuisson suspendue, compilation différée [CIEL-12]
- Où : ferro src/renderer.js:1741@248043a ; ferro src/renderer.js:1623-1629@248043a ; ferro src/renderer.js:549-551@248043a ; ferro src/renderer.js:1434@248043a
- Quoi : dessiner la passe finale du ciel après les opaques, avant les particules, `gl_Position.z = w`, `depthFunc(LEQUAL)` → seuls les pixels de ciel visibles sont ombrés. Suspendre la cuisson quand `fx.skyVisible === false` (METAL : `isOutdoors`, game.js:252) ; geler l'horloge des nuages si le vent continue. Compiler les programmes de cuisson après la première image via `KHR_parallel_shader_compile` (mesuré : 290-404 ms au premier usage). Retirer la vignette du ciel (ligne 551) quand elle passe en post-traitement (RGPU-07). Recuire tables/bruit/dôme après `webglcontextrestored` (ligne 1773).
- Preuve exigée : bancs/rgpu/ variantes « ciel en premier » vs « ciel après l'opaque » sur une image d'intérieur et une d'extérieur → différence d'images nulle ; première image extérieure sans pic de temps dans bancs/stab. Gain M5 : 0 à −0,3 ms ; GPU sans HSR : 2,2-3,7 ms.
- Qualité : identique (image exacte, toute la géométrie est opaque).
- Garde-fous : l'arme est dessinée après un effacement de profondeur (ligne 1761) → le ciel doit être avant ; MSAA : même état de profondeur ; `POST_VERT` partagé avec le post-traitement → variante à `z = w`.
- Dépend de : T2 (CIEL-01).

### T12 — Dérivation de la lumière du soleil et de l'ambiance depuis le ciel [CIEL-06]
- Où : ferro src/renderer.js:367-368@248043a ; ferro src/renderer.js:383-386@248043a ; ferro src/renderer.js:1743-1745@248043a ; metal src/world.js:645-649@673d6b2
- Quoi : quand `atmosphere.sky` présent : couleur du soleil = éclairement × transmittance (8 pas, `transmitJS`), × transmittance des nuages. Ambiance = harmoniques sphériques ordre 2 (9 coeff) du ciel sans le disque, sonde 16×8 RGBA16F rendue à la fin de chaque cuisson. Heure fixe par monde → lecture synchrone unique à `setWorld` (pas de PIXEL_PACK/fenceSync). Ajouter un terme de rebond du sol (albédo × éclairement) dans la sonde. Multiplier soleil et ambiance par l'exposition en JS. Plancher d'ambiance pour la lisibilité (nuit américaine).
- Preuve exigée : test contexte WebGL simulé : ciel uniforme → 9 coeff = constante attendue ; capture d'une sphère blanche sous les 6 préréglages : côté soleil le plus clair, teinte suit le disque. Coût estimé < 0,05 ms par MPix (non mesuré).
- Qualité : meilleure (décor, ciel, reflets changent ensemble ; plus de réglage croisé par monde).
- Garde-fous : non prototypé ; ambiances actuelles volontairement claires → plancher obligatoire ; shader du monde sans exposition → multiplier en JS ; une ou deux images de latence (lecture différée) sans effet visible.
- Dépend de : T2 (CIEL-01), T5 (CIEL-02).

### T13 — Brouillard tiré de la table du ciel (perspective aérienne) [CIEL-07]
- Où : ferro src/renderer.js:424-427@248043a ; ferro src/renderer.js:544-548@248043a ; ferro src/renderer.js:496-497@248043a
- Quoi : pour les fragments extérieurs, couleur du brouillard = table du ciel lue dans la direction de vue ramenée à l'horizon (élévation bornée ±2°) + Mie × phase vers le soleil. Densité inchangée (`uEnvironment.y`). Crêtes = couche facultative colorée par la même lecture. Même traitement dans le shader des particules (ligne 496). Pour limiter le coût : couronne 64×1 indexée par le cosinus de l'azimut relatif au soleil (dot des directions horizontales, sans acos), une seule lecture.
- Preuve exigée : capture d'un mur gris à 60, 120 et 180 m devant l'horizon → écart de couleur avec le ciel adjacent ≤ 3 niveaux à 180 m ; variante appariée dans bancs/rgpu/ pour le coût. Coût : 0,15-0,3 ms par MPix (deux lectures) ou ~0,05 ms (couronne 64×1 sans trigonométrie).
- Qualité : meilleure (horizon continu, contre-jour s'éclaircit vers le soleil).
- Garde-fous : derrière `atmosphere.sky` (pas de changement d'image actuelle) ; recoupe BITUME-19 et PHOTO-06 → une seule mise en œuvre ; prioritaire pour BITUME (vues 1 900 m), secondaire dans les arènes de METAL.
- Dépend de : T2 (CIEL-01), T5 (CIEL-02).

### T14 — Dôme de nuages : résolution, format et netteté [CIEL-V4]
- Où : bancs/ciel/gen-proto.mjs:56-64 ; bancs/ciel/proto-main.js:38 ; bancs/../audit/ciel/nouveau-plein-jour.png
- Quoi : (1) Format RGBA8 (luminance normalisée par le max de cuisson, codée en racine, tramée ; transmittance en alpha) → 4 Mo/texture au lieu de 8 ; supprime la dépendance `EXT_color_buffer_float` pour le dôme. (2) Trois textures au lieu de quatre (marche brute → « en cours », résolution filtrée → cible à permuter). (3) Déformer l'élévation (rayon en racine) pour ≥ 12 texels/° sous 15° d'élévation. (4) Passe finale : éroder le bord des nuages avec une lecture du bruit 3D (détail haute fréquence sur la transmittance).
- Preuve exigée : variante RGBA8 et variante 2048², `diff()` contre le calcul direct → écart moyen ≤ 1,0 niveau (contre 2,0 aujourd'hui) ; recadrage ×3 à l'horizon à 2880×1864 : aucune strie radiale, transition de bord ≤ 4 px écran ; mémoire ≤ 16 Mo (ordinateur), ≤ 6 Mo (mobile).
- Qualité : meilleure (nuages nets à la définition native, conforme à « sans perdre en résolution »).
- Garde-fous : codage 8 bits impose un tramage à la cuisson (bandes dans les nuages sombres) ; l'érosion de détail doit glisser avec le vent (sinon bords fourmillent) ; non prototypé ; dépend du format retenu dans T2.
- Dépend de : T2 (CIEL-01), T6 (CIEL-03).

### T15 — Reflets cohérents avec le ciel visible [CIEL-08]
- Où : ferro src/renderer.js:401-419@248043a ; metal src/renderer.js:341-355@673d6b2
- Quoi : pour les fragments extérieurs, reflet = table du ciel (direction réfléchie) × transmittance du dôme + lumière du dôme, mip choisi par la rugosité. Mips du dôme par `generateMipmap` à chaque fin de cuisson (filtre en boîte ; pas de préfiltrage GGX). Lobe du soleil analytique. Les lignes 405-414 (bruit, seuil, pow) disparaissent pour ces fragments. Sous l'horizon : garder le mélange vers `uAmbient × .20` (ligne 415). Intérieur : terme « inside » inchangé.
- Preuve exigée : capture d'une sphère chromée et d'une sphère rugueuse sous « plein jour » et « crépuscule » → le reflet montre les mêmes nuages que le ciel ; variante appariée dans bancs/rgpu/. Coût estimé neutre (3 lectures vs bruit + 3 pow).
- Qualité : meilleure (reflets cohérents : nuages, heure, soleil).
- Garde-fous : `generateMipmap` sur RGBA16F à chaque fin de cuisson → coût périodique non mesuré + 33 % de mémoire ; mips d'un paraboloïde mélangent des texels sous l'horizon → remplir avec la couleur du sol ; derrière `atmosphere.sky`.
- Dépend de : T2 (CIEL-01), T14 (CIEL-V4).

### T16 — BITUME et Point de rupture : mêmes textures, besoins différents [CIEL-13]
- Où : ~/Projects/bitume/src/decor.js:57 ; ~/Projects/bitume/src/jeu.js:584 ; ~/Projects/point-de-rupture/Jeu/src/jeu.js:17 ; ~/Projects/point-de-rupture/Jeu/src/jeu.js:233
- Quoi : BITUME — un préréglage par course (heure + météo), dôme 1024² ou 2048² en ultra (ciel très présent), perspective aérienne (T13) indispensable sur les longues vues (1 900 m), reflets (T15) sur laque et asphalte mouillé, ombres de nuages à l'échelle réelle. Soleils actuels à 41,5°, 48,5° et 52° (corrigé). Point de rupture — pas de passe finale en vue plongeante (automatique avec T11), cuisson au ralenti (1/1024/image), apport = ambiance dérivée (T12) + ombres de nuages (T17). Valeurs de préréglage dans chaque jeu ; modèle et API dans FERRO.
- Preuve exigée : captures de BITUME à trois heures sur le même circuit ; dans Point de rupture, compteur de passes : aucune passe de ciel en vue plongeante.
- Qualité : meilleure (heure, météo, reflets cohérents ; lumière vivante à coût ≈ 0).
- Garde-fous : Point de rupture a un arbre de travail en cours par une autre session → n'intégrer qu'après ; BITUME : borner l'élévation par circuit (soleil bas face à la piste gêne la lecture des trajectoires) ; BITUME a déjà son seuil de bloom plus haut (0,86-0,98).
- Dépend de : T1 (CIEL-11), T12 (CIEL-06), T13 (CIEL-07), T15 (CIEL-08).

### T17 — Ombres de nuages qui glissent sur le sol [CIEL-09]
- Où : ferro src/renderer.js:383-386@248043a ; ~/Projects/point-de-rupture/Jeu/src/jeu.js:233 ; ~/Projects/bitume/src/jeu.js:584
- Quoi : carte d'ombre de nuages 256² R8 périodique, cuite avec la même fonction de densité : `transmittance = exp(−extinction × épaisseur optique verticale)`. Dans le shader du monde, fragments extérieurs : `ombre = texture(uCloudShadow, (vWorld.xz + sun.xz/sun.y × (base − vWorld.y) + vent × t) / pas)`, multipliée au terme solaire diffus et spéculaire, plancher 0,35. Pas réglable : ~240 m pour METAL (ombres glissent sur les arènes), échelle réelle pour BITUME et Point de rupture. Couverture moyenne module la couleur du soleil (T12).
- Preuve exigée : capture vue de dessus d'un sol uni à deux instants → taches d'ombre translatées de `vent × Δt` ; variante appariée pour le coût. Une lecture de texture par fragment extérieur, estimé ≤ 0,05 ms par MPix (non mesuré).
- Qualité : meilleure (météo visible au sol, surtout Point de rupture et BITUME).
- Garde-fous : à l'échelle « de jeu », l'ombre au sol ne correspond pas exactement au nuage visible ; rendu seul → aucun effet sur la simulation ni les sauvegardes ; dans les arènes de METAL l'effet est marginal.
- Dépend de : T6 (CIEL-03).

## Options désactivées par défaut
- [CIEL-05] Tramage sur le chemin hérité — `settings({dither:true})` désactivé par défaut pour préserver l'image identique des jeux v0.2 sans `atmosphere.sky`.
- [CIEL-V1] Masque de bloom par alpha — actif uniquement quand `atmosphere.sky` est présent ; le chemin hérité garde `alpha = 1` partout.
- Éclairs dans les ciels d'orage — désactivés par défaut (photosensibilité, lisibilité en combat) ; option « éclairs atténués » disponible.

## Écartés ou absorbés
- [CIEL-03] Décalage ordonné par texel dans la marche de ray — essayé et écarté : produit un tressage visible ; remplacé par le décalage aléatoire + filtre tente.
- [CIEL-07] Évaluation par sommet du brouillard — absorbée dans T13 comme variante de coût (couronne 64×1) ; la version par fragment reste la référence.
- [CIEL-12] RGPU-07 (vignette du ciel) — absorbée dans T11 : la vignette est retirée du shader de ciel quand elle passe en post-traitement.

## Décisions à confirmer par David
- Plancher d'ambiance et d'exposition pour la nuit « américaine » : quelle luminance minimale pour que la lisibilité des ennemis en extérieur reste celle d'aujourd'hui ? — valeur par défaut proposée : ambiance ≥ 0,12 × le soleil de plein jour, exposition plancher à 0,4.
- Le dôme à 1024² donne un écart moyen de 2,0 niveaux sur 255 vs le calcul direct (concentré sur les bords de nuages). Accepte-t-on cet écart en attendant T14 (RGBA8 + érosion de détail) ? — valeur par défaut proposée : oui, écart invisible en jeu ; T14 le ramène à ≤ 1,0 niveau.
- Le seuil de bloom est figé à la création (`settings`) : accepte-t-on un seuil global pour le lot, ou faut-il exposer un réglage par monde dans `atmosphere.sky` ? — valeur par défaut proposée : seuil global à 0,56-0,86 (actuel) avec le masque alpha de T7 ; réglage par monde reporté à la chaîne HDR (PHOTO-04).

## Gains attendus du lot
À la qualité par défaut de METAL (1792×1008, 30-50 % de ciel visible) : temps d'image neutre (−0,17 à −0,25 ms plein écran de ciel, nul en jeu courant). Le gain réel est qualitatif : 18 ciels distincts, atmosphère physique, nuages volumétriques, étoiles et lune, bandes divisées par 40 (40-55 % → 0,9-1,2 %), bloom maîtrisé (poids 0,25-0,60 → ≤ 0,07).
Plein écran de ciel à 2560×1440 : −0,50 à −0,65 ms (branches de T3 sur le chemin hérité, mesuré) ; nuit −1,4 ms (T9, mesuré).
Mémoire : 33,5 Mo (RGBA16F, T2) ou 16 Mo (RGBA8, T14) ; taille ajoutée ≈ 25-28 Ko (2 % du budget).
