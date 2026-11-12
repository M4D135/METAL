# Lot 05 — Rendu : coût processeur, image identique
## But
Réduire le CPU de `draw()` de 45 à 81 % par cache temporel, pools de tampons et boucles scalaires, sans perte d'image ni de résolution. Prouver l'égalité au bit près (PSNR 99, MAD 0) sur Chrome réel et Node alterné. Préparer la table d'instances GPU et le chemin écrivain pour les lots suivants.

## Tâches, dans l'ordre

### T1 — Filtre des casters du soleil en boucle indexée [RCPU-03]
- Où : `src/renderer.js:1454-1457`, `src/renderer.js:1440-1459`
- Quoi : remplacer `e.p.map` + closure `along` + `filter` par une boucle `for` indexée sur un tableau réutilisé `out`. Lire hors boucle px, py, pz, les 9 composantes de r, u, fw, near, far, extent. Écrire `dx=e.p[0]-px`, etc., puis `a=dx*rx+dy*ry+dz*rz` ; garder si `|a|<extent+e.radius`, `|b|<extent+e.radius`, `z+e.radius>near`, `z-e.radius<far`. Terminer par `out.length=n`.
- Preuve exigée : `node bench/rcpu/alt.mjs <ferro> camp:17 1500` → lignes C0 à C2, compte identique (1652 casters). Chrome réel : draw() CPU médian 3,2 → 2,8 ms ; image identique (écart 0).
- Qualité : identique.
- Garde-fous : aucun test à modifier. Taille +0,2 Ko. Avec RCPU-01, le filtre ne tourne plus que sur ~10 % des images.
- Dépend de : rien.

### T2 — Coupure de portée exacte dans le vertex shader [RCPU-V1]
- Où : `src/renderer.js:723`, `src/renderer.js:779-786`, `src/renderer.js:41-43`, `src/renderer.js:773-776`, `src/renderer.js:1545-1546`, `src/renderer.js:1436`, `src/renderer.js:1454`
- Quoi : ajouter `(detail+1)·8` au champ drapeaux `row[11]` des lignes statiques (dynamiques = 0, jamais coupées). Dans VERT, lire le niveau par `floor(iRotation.w*.125)`. Nouveaux uniformes `uCullCentre` (vec3) et `uCullRange` (vec3) posés par passe. Si niveau ≥ 1 et `distance(uCullCentre, iPosition.xyz) > uCullRange[niveau-1] + 0.5*length(iScale.xyz)`, écrire `gl_Position=vec4(2.,2.,2.,1.)`.
- Preuve exigée : banc Chrome `bench/rcpu-verif2/out/run1.html` → PSNR 99, écart 0 contre l'original (sauf arrondi float32 à la frontière). `node bench/rcpu-verif2/v-cache.mjs <metal> 900 camp:17 auto cache` : la ligne « extras INSIDE exact frustum » reste un compte CPU, le critère est la différence de pixels.
- Qualité : identique (corrige le défaut de RCPU-01 sans cache).
- Garde-fous : vérifier chaque usage de `vObject` dans le fragment shader après le passage au modulo. Lignes dynamiques et jeux sans niveau de détail gardent 0. Repli Canvas2D non concerné. Taille +0,3 Ko.
- Dépend de : rien.

### T3 — Pools de tampons typés et upload par capacité [RCPU-04]
- Où : `src/renderer.js:678-696`, `src/renderer.js:654-674`, `src/renderer.js:798-803`, `src/renderer.js:1397-1400`, `src/renderer.js:1561`, `src/renderer.js:1581`
- Quoi : (1) Float32Array scratch par site (dynamique, overlay, fx, 4 slots statiques), `ensure(n·16)` taille doublée, écriture directe `v[o]=p[0]`. (2) Code de forme en cache `mesh.__k ??= SHAPE[shape]`, tri par comptage 2 passes. (3) Raster extérieur `Uint8Array` cellules 2 m, calculé dans `setWorld`. (4) Tampons GPU à capacité : si `n·64 > cap`, `cap = puissance de 2 suivante`, `bufferData(cap)` ; puis `bufferSubData(0, rows, 0, n·16)`. Orphelinage à capacité constante sur les 7 sites (pas d'anneau). (5) Tableaux de résultats réutilisés pour query et filter.
- Preuve exigée : `node --trace-gc bench/rcpu/gc-bench.mjs <ferro> 3600 camp:17 drawonly [proto] | python3 bench/rcpu/gc-parse.py` → moins de 0,2 MB alloués par draw(). Chrome réel pool seul : draw() CPU 3,2 → 2,9 ms (−9 %) et 2,2 → 1,9 ms (−14 %), image identique (écart 0). `node bench/rcpu/alt.mjs` : pack E0 257 → E2 208 µs ; packIndexed F0 136 → F2 39 µs.
- Qualité : identique.
- Garde-fous : étendre `checks/renderer-destruction.test.mjs:20-22` pour gérer `bufferSubData` ; les assertions « aucun bufferData » des lignes 41, 45, 100, 157 doivent aussi interdire `bufferSubData`. Le Proxy de `checks/actor-visibility.test.mjs` est générique, rien à y ajouter. `bufferSubData` sur un tampon encore utilisé peut bloquer certains pilotes mobiles : orphelinage à capacité constante. Taille +1,5 Ko.
- Dépend de : premier commit du chantier rendu (faux contexte gérant `bufferSubData` et VAO, compteurs exacts) — arbitrage 3.

### T4 — Cache temporel à marge pour la vue, le soleil et la torche [RCPU-01]
- Où : `src/renderer.js:1545-1547`, `src/renderer.js:1408-1413`, `src/renderer.js:1435-1436`, `src/renderer.js:1454-1458`, `src/renderer.js:1576`
- Quoi : (1) Vue et torche : `query(eye0, ranges+D)`, garder si `|c-eye0|≤r+D+near` ou angle ≤ `demiDiag0+θ+asin(min(1,(r+D)/|c-eye0|))` (comparer des cosinus). Mémoriser eye0, fw0, demiDiag0, ranges0, aspect, FOV, worldRevision. Valide tant que `|eye-eye0|≤D`, angle+`demiDiag≤demiDiag0+θ`, `ranges≤ranges0`, révision identique. D=1 m, θ=8°. (2) Soleil : quantifier le centre sur grille M=4 m, requête étendue 1,74·M, reconstruire seulement si le centre quantifié change. (3) `renderStatic` : comparer `cache.gen` et `sel.gen` au lieu de `entries.every`. (4) Construire la sélection dans l'ordre de l'index.
- Preuve exigée : `node bench/rcpu/ab.mjs <ferro> 3000 camp:17 auto cache 1 8 4 45` → draw() camp:17 de 1,892 à 0,474 ms (−75 %), upload 250 → 65 Ko. Chrome réel cache seul : draw() 3,2 → 1,0 ms (−69 %). **Remesurer à 10,5 m/s, 300°/s et sur format téléphone (arbitrage 2).** Critère d'acceptation image : écart nul (preuve héritée de RGPU-03, arbitrage 2).
- Qualité : visuellement identique (avec RCPU-V1).
- Garde-fous : `stats.staticVisible` devient la taille du sur-ensemble ; adapter `checks/renderer-destruction.test.mjs:85` (attend `staticVisible===1`) ou exposer un compteur exact en mode test. GPU : +15-21 % d'instances, à mesurer sur GPU mobile. Taille 2-3 Ko.
- Dépend de : T1 (RCPU-03), T2 (RCPU-V1), T3 (RCPU-04), RCPU-05 (autre lot).

### T5 — Culling de vue sur les pickups et le butin [RCPU-07]
- Où : `src/game.js:452`, `src/game.js:379-417`, `src/game.js:427`, `src/motion.js:15-26`
- Quoi : avant `supplyModel`, ajouter `if(!actorVisible(c.x,(c.y||0)+.5,c.z,R[kind]))continue;` avec R=1,6 m (couvre tous les types, vérifié à la lecture). Écrire `FMotion.place` et `mount` sans allocation : vecteurs scratch ou pièces précalculées en repère local, ne calculer par image que la pose (lacet `t·0.3+x·0.1`). Les meshes retirés sortent du lot dynamique (4 passes).
- Preuve exigée : `node bench/rcpu/pickups.mjs <ferro> 3000 camp:6` → 32,8 modélisés, 17,8 gardés (−46 %). `node bench/rcpu/bench-models.mjs <ferro> 3000 camp:6 auto` section 452 avant/après.
- Qualité : identique (actorFilter inclut les volumes d'ombre, rayon couvre le modèle).
- Garde-fous : ajouter un test « un pickup derrière la caméra n'est pas modélisé » dans `check/actor-visibility.test.mjs`. Taille +0,1 Ko.
- Dépend de : rien.

### T6 — Marges adaptatives du cache de vue [RCPU-V2]
- Où : `src/renderer.js:1545-1546`, `src/renderer.js:1436`, `src/renderer.js:1454`
- Quoi : recalculer à chaque reconstruction : `D = clamp(vitesse_lissée×0,15, 1, 16)`, `θ = clamp(vitesse_angulaire_lissée×0,10, 4°, 12°)` plafonné à `0,5×demi-diagonale`. Soleil : `M = clamp(2·D, 4, 16)`. Lissage exponentiel sur 0,25 s ; aucune marge ne rétrécit tant que la sélection est valide. API : `FRender.create(canvas,{cullMargin:'auto'})` par défaut ; `{cullMargin:{distance,angle}}` pour fixer ; `{cullMargin:0}` pour culling exact.
- Preuve exigée : `node bench/rcpu-verif2/v-ab2.mjs <metal> 300 camp:17 auto cache 45 80` → taux de reconstruction sous 15 % à 80 m/s (contre 60 % avec D=1 m). Puis trace caméra BITUME.
- Qualité : identique (avec RCPU-V1, l'image est identique quelle que soit la marge).
- Garde-fous : plafonner les instances GPU hors champ. Rendu seul, pas de déterminisme. Taille +0,3 Ko.
- Dépend de : T4 (RCPU-01).

### T7 — FMotion.place et mount sans allocation [RESTE-02]
- Où : `src/motion.js:15`, `src/motion.js:16-19`, `src/motion.js:20-26`, `src/game.js:381`, `src/game.js:477-479`, `src/game.js:578-579`
- Quoi : reprendre `bench/reste/motionfast.mjs`. `vector` : trois sommes scalaires. `mount` : `rotation(angles[0],angles[1],angles[2])`, pos en littéral, retour `{pos,axes,ry:NaN,rz:0,regular:false,rx:NaN,r0:0}`. `place` : mémo par repère (ry, regular, rz, r0 recalculés seulement si rx change), retour `p` en littéral et `r=[r0,ry,rz]`. Même arithmétique, même ordre.
- Preuve exigée : `node ab-frame.mjs r1 r1+motionfast:motionFast 500 camp:6` → liste dynamique identique bit à bit sur 620 images (hash shape, p, s, r, color, mat, emissive, alpha, drapeaux) ; models() médiane 866 → 584 µs (ratio 0,725). supplyModel 243,4 → 118,9 Ko/image.
- Qualité : identique.
- Garde-fous : objet repère gagne 5 champs (initialisation paresseuse). Vérifier par grep que BITUME et Point de rupture ne modifient pas `axes` après `mount`. Test FERRO : 10 000 poses aléatoires à graine fixe, égalité stricte.
- Dépend de : rien.

### T8 — Constructeur de maillage à forme unique [RESTE-03]
- Où : `src/game.js:240`, `src/game.js:381`, `src/game.js:479`, `src/game.js:579`, `src/actors.js:41`, `src/effects.js:10`, `src/effects.js:198`, `src/renderer.js:674-696`, `src/renderer.js:1555`
- Quoi : exporter `FRender.mesh(shape,p,s,mat,r,emissive)` retournant toujours le même littéral dans le même ordre, tous champs présents (`color:undefined, surface:undefined, overlay:false, fx:false, alpha:undefined, additive:undefined, outdoor:undefined, actorPart:undefined, actorLod:0, structural:false, debrisId:undefined, sourceId:undefined, material:undefined`). Migrer `m()`, `piece()`, `mesh()`, `solid()` vers ce constructeur. Affecter les champs existants au lieu d'en ajouter.
- Preuve exigée : `node --allow-natives-syntax shapes.mjs 420 camp:6` → 1,0 classe par liste ; ratio pack proche de 1 (médiane 91,5 → 63,4 µs, ratio 0,742). `ab-frame.mjs` : liste identique.
- Qualité : identique.
- Garde-fous : grep les tests `'alpha' in m` ou `hasOwnProperty` ; n'utiliser que des valeurs par défaut neutres. Taille +0,3 Ko.
- Dépend de : rien.

### T9 — FEffects.build : tri unique et partition stable [RCPU-06]
- Où : `src/effects.js:172-199`, `src/effects.js:17-18`, `src/effects.js:183-192`
- Quoi : reprendre `bench/rcpu/effects-ab.mjs`. Champs scalaires, une seule distance. `id` numérique précalculé. Un seul tri : structural décroissant, puis rear, band, score, id. Partition stable par groupe (premier morceau de chaque sourceId, puis répétitions) remplaçant le Set de chaînes et le tri n°2. Arrêt dès `debrisBudget`. `p`, `s`, `r` alloués uniquement pour les débris émis.
- Preuve exigée : `node bench/rcpu/effects-ab.mjs <ferro> 3000 camp:17` → « identical outputs 3000/3000 » (isDeepStrictEqual) ; p50 0,272 → 0,186 ms (−32 %), p95 1,17 → 0,68 ms. Puis `npm test`.
- Qualité : identique.
- Garde-fous : garder le repli `num(q.id,num(q.seed))` et la stabilité du tri. Relancer `checks/effects.test.mjs`. Taille +0,3 Ko.
- Dépend de : rien.

### T10 — FEffects.build : cache des gravats au repos et sélection K-meilleurs [RESTE-07]
- Où : `src/effects.js:172-181`, `src/effects.js:183-192`, `src/effects.js:193-199`, `src/game.js:420`
- Quoi : `WeakMap` par pièce contenant validité, p, s, rayon, raw, couleur, rotation, forme, clé sourceId ; valable tant que `q.resting`, `q.rotation` est le même tableau et x, y, z, size inchangés. Par image, ne recalculer que d, band, rear, score. Remplacer les deux tris par une sélection des `debrisBudget` meilleurs (même comparateur), trier seulement ces K. Clé numérique `(band*2+rear)` + identité sourceId.
- Preuve exigée : `ab-frame.mjs r1` contre `r1+correctif` sur camp:6 et legacy:0 en combat aux roquettes → liste identique. `bench/rcpu/effects-ab.mjs` pour isoler. Gain −50 à −70 % de FEffects.build en plus de RCPU-06.
- Qualité : identique.
- Garde-fous : l'ordre final conditionne le budget et le dessin ; ne jamais cacher les pièces non structurelles (dépendent de l'âge). Coordonner l'identité de `q.rotation` avec RESTE-05.
- Dépend de : T9 (RCPU-06).

### T11 — FActors.build : calcul scalaire sans map ni spread [RESTE-08]
- Où : `src/actors.js:8-15`, `src/actors.js:39-46`, `src/actors.js:48`, `src/actors.js:153`, `src/actors.js:191`, `src/actors.js:249`, `src/game.js:436-438`
- Quoi : (1) `product` et `rotation` écrivent dans une pile de `Float64Array` propre au module. (2) `angles` écrit 3 scalaires. (3) `limb` en scalaires, `Math.hypot(dx,dy,dz)`. (4) Remonter `piece, box, armor, cyl, ring, eye` au niveau module avec contexte explicite `(out, root, lod, palette)`. (5) Sortie par le constructeur de RESTE-03, puis par l'écrivain de RESTE-01. Pas de cache entre images (réutilisation mesurée à 16,5 % seulement).
- Preuve exigée : `ab-frame.mjs` → liste identique. `alloc.mjs` : catégorie models>FActors.build sous 90 Ko/image. `bench/rcpu/actors-cost.mjs` pour le temps par primitive. Gain estimé −50 % allocations (−90 Ko/image), −30 à −40 % temps.
- Qualité : identique.
- Garde-fous : vérifier que `game.js` n'altère pas `p, s, r` après build. Tests `checks/actor-*.test.mjs` : sorties identiques au bit près.
- Dépend de : T8 (RESTE-03).

### T12 — Géométrie : sommets partagés par Map [DRAW-11]
- Où : `src/renderer.js:622-704` (FERRO) / `src/renderer.js:562-644` (METAL), `src/renderer.js:1441-1444` (FERRO) / `src/renderer.js:1345-1348` (METAL), `src/renderer.js:929-954` (FERRO) / `src/renderer.js:869-894` (METAL)
- Quoi : dans `geometry()`, une `Map` clé `"px,py,pz|nx,ny,nz"` → indice. `vertex()` renvoie l'indice existant ou en crée un. Plages par forme et indices `Uint16` inchangés. Total 2 328 → 597 sommets, tampon 55,9 → 14,3 Ko.
- Preuve exigée : `cfg/A.json` ou `B*.json` → `diffs.vdedup.identicalFrames === n` (49/49). `node vis.mjs` : champ géométrie. Temps GPU M5 : −0,35 ms [−0,75 ; +0,20], non significatif.
- Qualité : identique (prouvé bit à bit).
- Garde-fous : coutures des sphères et anneaux gardent des doublons (sin(2π)≠0, sans conséquence). Le test `renderer-reprises` compare les tampons envoyés : le tampon de sommets change de taille, à mettre à jour.
- Dépend de : rien.

### T13 — Table d'instances statiques en texture RGBA32F [DRAW-03]
- Où : `src/renderer.js:835-836` (FERRO) / `775-776` (METAL), `src/renderer.js:858-863` (FERRO) / `798-803` (METAL), `src/renderer.js:1564-1569` (FERRO) / `1408-1413` (METAL), `src/renderer.js:1529-1538` (FERRO) / `1373-1382` (METAL), `src/renderer.js:7-51` (shader)
- Quoi : (1) Texture RGBA32F 1024 texels de large, remplie une fois dans `setWorld` à partir de `e.row`. (2) `updateWorld` : `texSubImage2D` des seules lignes touchées (1-38 Ko/révision). (3) Shader : `vertexAttribIPointer` `iRow` (UNSIGNED_SHORT, diviseur 1) + `texelFetch` ×4. (4) Par passe : liste `Uint16` groupée par forme, `bufferSubData` (2 octets/instance). (5) Dynamiques : seconde table, `texSubImage2D` 21-29 Ko/image. (6) Repli `instanceTable:false` (RCPU-04). (7) Faire DRAW-11 avant.
- Preuve exigée : variante `rowtex` dans `dpatches.mjs`, `cfg/A.json` avec `compare:true` → `diffs.rowtex.max === 0`. `glstat.mjs` : octets statiques sous 10 Ko/image. Temps GPU non positif.
- Qualité : identique (mêmes flottants 32 bits).
- Garde-fous : non prototypé ; coût des 4 lectures de texture par sommet inconnu sur GPU mobiles → mesurer avant activation par défaut. Limite 65 536 statiques en Uint16 (17 600 aujourd'hui) : passer en UNSIGNED_INT au-delà. Un programme/uniforme de plus : compilation 79-111 ms à surveiller.
- Dépend de : T12 (DRAW-11), T3 (RCPU-04).

### T14 — Écrivain d'instances et migration des producteurs [RESTE-01]
- Où : `src/game.js:240`, `src/game.js:418-586`, `src/renderer.js:678-696`, `src/renderer.js:1555`, `src/actors.js:39-41`, `src/effects.js:10-11`
- Quoi : ajouter `renderer.frameWriter()` avec `w.begin()`, `w.put(codeForme, px,py,pz, sx,sy,sz, mat, rx,ry,rz, emissive, drapeaux, cr,cg,cb, aCouleur)` écrivant 16 flottants dans un tampon croissant par forme (7 formes), `w.putFx(...)` pour translucides, `w.end()` concatène par `set()` dans le Float32Array mutualisé de RCPU-04 puis `bufferSubData`. Migrer les producteurs par allocation décroissante : butin (243 Ko), acteurs (180 Ko), particules, balles, débris, machinerie. Côté simulation : `coord(i)` en deux fonctions scalaires, supprimer `{...input,dash:false}`, sortir `lifts.map`.
- Preuve exigée : `alloc.mjs r1 400 camp:6` → sous 50 Ko/image et sous 0,1 scavenge/s. `ab-frame.mjs` : octets du tampon dynamique identiques chemin liste vs chemin écrivain sur 600 images.
- Qualité : identique.
- Garde-fous : refonte large, à faire producteur par producteur avec comparaison d'octets à chaque étape. Le tri des translucides et le filtre des projeteurs lisent les objets : leur donner les champs depuis le tampon. API FERRO additive. Taille +2-3 Ko.
- Dépend de : T8 (RESTE-03), T3 (RCPU-04).

### T15 — Repli Canvas2D : boucles indexées et mémoïsation [RCPU-09]
- Où : `src/renderer.js:1124-1168`, `src/renderer.js:1027-1045`, `src/renderer.js:1179-1207`, `src/renderer.js:1209-1214`, `src/renderer.js:897-911`
- Quoi : (1) `polygonPath` et `line` sans spread : `moveTo(p[0],p[1])`. (2) `shade` : trois scalaires r, g, b ; chaîne mémoïsée dans une `Map` clé `(r<<16|g<<8|b)`. (3) `collect` : boucles indexées, tampons de sommets réutilisés. (4) `maskGround` : grille écran des boîtes receivers, min/max en boucle. (5) Comparateur de tri sur clés précalculées (drapeau sol, plan), reproduisant exactement la même relation.
- Preuve exigée : `node bench/rcpu/bench-canvas.mjs <ferro> 900 camp:6 auto` et `prof-canvas.mjs <ferro> 600 camp:6` avant/après. Comparaison du flux d'appels ctx sur 300 images → identique.
- Qualité : identique (point 1 uniquement).
- Garde-fous : AGENTS.md impose le repli ; garder la parité visuelle. Le comparateur actuel n'est pas transitif (cas sol coplanaire) : reproduire exactement la même relation. `check/renderer-destruction.test.mjs:145` exige plus de 30 triangles. Taille +1 Ko.
- Dépend de : rien.

### T16 — VAO par couple (tampon, forme) [RCPU-10]
- Où : `src/renderer.js:1397-1406`, `src/renderer.js:1422-1438`, `src/renderer.js:1440-1459`, `src/renderer.js:1555-1556`, `src/renderer.js:1564`
- Quoi : avec les tampons à capacité de RCPU-04, réserver une région fixe par forme (7 formes). Créer une fois un VAO par couple (tampon, forme). Par groupe, un seul `bindVertexArray` remplace les 4 `vertexAttribPointer`. Gain borné : 0,1 à 0,3 ms sur M5 (mesuré DRAW-04).
- Preuve exigée : `node bench/rcpu/glcalls.mjs <ferro>` avant/après → appels par image. Trace GPU Chrome en `file://`.
- Qualité : identique.
- Garde-fous : le mock de `checks/renderer-destruction.test.mjs:21` déduit `instanceOffset` de `vertexAttribPointer(2,…)` : réécrire pour les VAO. Taille +0,7 Ko.
- Dépend de : T3 (RCPU-04).

### T17 — FActors.build : matrices scratch et pool de meshes [RCPU-11]
- Où : `src/actors.js:8-15`, `src/actors.js:16-23`, `src/actors.js:39`, `src/actors.js:48`, `src/game.js:436-438`
- Quoi : matrices `Float64Array(9)` scratch, produits écrits en place. Pool d'objets mesh par ennemi, réutilisé d'une image à l'autre (pack en fait une copie, rien n'est retenu). Gain estimé −30 à −40 % sur FActors.build (15-20 µs/image en tour, 40-60 µs en combat boss).
- Preuve exigée : `node bench/rcpu/actors-cost.mjs <ferro>` (ns/mesh, par type et LOD) et `bench-models.mjs` section 451 avant/après. Puis `npm test`.
- Qualité : identique.
- Garde-fous : vérifier qu'aucun consommateur ne garde les meshes d'une image à l'autre (overlay, actorPart, tests `checks/actor-*.test.mjs`). Taille neutre.
- Dépend de : rien.

### T18 — Mesure des appels GL et correction de l'estimation [DRAW-04]
- Où : `src/renderer.js:1553-1563` (FERRO) / `1397-1407` (METAL), `src/renderer.js:1742-1751` (FERRO) / `1568-1575` (METAL), `src/renderer.js:1623-1630` (FERRO) / `1460-1467` (METAL), `src/renderer.js:1631-1643` (FERRO) / `1468-1480` (METAL), `src/renderer.js:1586-1588` (FERRO) / `1430-1432` (METAL)
- Quoi : documenter que 409-454 appels GL coûtent environ 30 µs de fil principal sur M5 (0,03-0,10 µs/appel). VAO par groupe : équivalent à 4 pointeurs sur ANGLE Metal (2,87 vs 2,67 µs). UBO : 1,3 µs/image. 50 appels redondants : 2 µs. Corriger l'estimation de RCPU-10 (×10). Filtrage d'états : seulement en passant avec DRAW-01 et DRAW-03.
- Preuve exigée : `node glstat.mjs camp:17 600 auto` → appelsParImage et redondantsParImage. Chrome : `./run.sh out/glcost.html 400,300 1`. Sur Windows (david-pc, ANGLE D3D11) : relancer `out/glcost.html`, relire `derived.bindVertexArray_us` et `derived.vertexAttribPointer_us`.
- Qualité : identique (mesure et documentation).
- Garde-fous : mesure sur ANGLE Metal uniquement ; D3D11 peut différer. Ombre d'état mal tenue → bugs : remettre à zéro dans `initialize()`.
- Dépend de : rien.

### T19 — Test de champ par cellule dans la requête de vue [DRAW-08]
- Où : `src/renderer.js:839-857` (FERRO) / `779-797` (METAL), `src/renderer.js:1714` (FERRO) / `1545-1546` (METAL), `src/renderer.js:1657-1699` (FERRO) / `1496-1533` (METAL)
- Quoi : dans la requête par cellules de 8 m, avant de toucher les entrées, calculer la sphère englobante de la cellule (centre à la hauteur moyenne, rayon `4√2 + demi-hauteur + rayon maximal du niveau`). Passer par `visible()` ; sauter les cellules rejetées. À coupler à la grille dense de RCPU-05.
- Preuve exigée : `vis.mjs` (candidats contre visibles) et `bench/rcpu/alt.mjs` pour l'A/B à listes identiques sur 3 000 images. Égalité stricte des listes `shown`.
- Qualité : identique.
- Garde-fous : la sphère de cellule doit couvrir la hauteur réelle (cellules 2D, objets 3D) ; le contrôle d'égalité le détecte. Pas d'occlusion maintenant (valeur en ms faible sur M5, risque d'apparition tardive).
- Dépend de : rien.

## Options désactivées par défaut
- [RCPU-09] Plafond de faces dessinées par qualité avec coupure par distance — retire de la géométrie, perte de qualité (contre-vérification).
- [RCPU-11] Pose mise à jour une image sur deux au LOD2 — animation à demi-cadence, perte visuelle (contre-vérification).
- [DRAW-08] Étape 3 : requêtes d'occlusion `ANY_SAMPLES_PASSED_CONSERVATIVE` sur boîtes de 16 m — risque d'apparition retardée d'une image ; coupée par défaut, activable si profil GPU faible le justifie.

## Écartés ou absorbés
- [RGPU-03] — abandonné par arbitrage 2 (le cache de RCPU-01 le couvre) ; sa preuve (écart d'image nul, MAD 0, PSNR 93 dB) est conservée comme critère d'acceptation de RCPU-01.
- [RCPU-10] Exclusion des émissifs purs et débris < 0,15 m des passes d'ombre — supprime des ombres réelles, contraire à l'exigence de qualité (contre-vérification). Seul le point 1 (VAO) est retenu en T16.

## Décisions à confirmer par David
- RCPU-01 : remesurer à 10,5 m/s, 300°/s et sur format téléphone (arbitrage 2) — valeur par défaut : D=1 m, θ=8°, M=4 m, à ajuster si le taux de reconstruction dépasse 20 % à ces vitesses.
- DRAW-03 : la table d'instances en texture est non prototypée ; le coût des 4 `texelFetch` par sommet est inconnu sur GPU mobiles — valeur par défaut : `instanceTable:false` (repli RCPU-04) jusqu'à mesure sur un appareil cible.
- DRAW-04 : relancer `out/glcost.html` sur david-pc (ANGLE D3D11) avant toute décision VAO pour Windows — valeur par défaut : ne pas implémenter les VAO pour le gain de temps (mesuré nul sur Metal).
- RESTE-01 : migration des producteurs par allocation décroissante — ordre butin → acteurs → particules → balles → débris → machinerie ; confirmer ou inverser.

## Gains attendus du lot
- draw() CPU : −45 à −47 % par le lot exact RCPU-03+04+05 (image identique au bit près, mesuré Chrome 3 exécutions et Node alterné) ; −69 à −81 % supplémentaire avec le cache RCPU-01+V1 (Chrome réel, charge 34-82).
- Upload GPU : 250 → 52 Ko/image (cache seul, Node) ; 192-273 → 6,5 Ko/image (DRAW-03, tailles mesurées).
- Allocations : 1,04 → 0,105 MB/image (pool seul, scénario à valider) ; 892 → sous 50 Ko/image (RESTE-01+02+03+08, alloc.mjs).
- Scavenges : 5,25 → sous 0,1/s en régime établi.
- p99 draw() : −43 à −56 % (ab.mjs).
- FEffects.build : −32 à −70 % (RCPU-06 + RESTE-07). FActors.build : −30 à −40 % (RESTE-08 + RCPU-11).
- Sommets GPU : −33 à −82 % par forme (DRAW-11), utile sur GPU limités et avec DRAW-03.
- Gains combinés mesurés, non la somme des gains isolés : le lot RCPU-03+04+05 est sur-additif (−46 % vs −3 à −14 % isolés).

## Mise à jour après contre-vérification

Cette fiche a été rédigée avant la contre-vérification des axes STAB, DRAW, RESTE et PARA. Les verdicts ci-dessous priment sur le texte des tâches.

- **RESTE-01 — confirmé, priorité P1, qualité identique.** Gain corrigé : Certain : suppression des 644 Ko/image de models() et de pack. La cible de 50 Ko/image reste à prouver ; viser d'abord moins de 350 Ko/image (reste = simulation), puis traiter la simulation séparément.
- **RESTE-02 — confirmé, priorité P0, qualité identique.** Gain corrigé : models() -20 % (et non -27,5 %), soit environ -8 à -10 % du JS de l'image. Effet sur draw() : ratio 0,91 dans un sens, 0,97 dans l'autre ; le 0,798 annoncé ne se reproduit pas.
- **RESTE-03 — confirmé, priorité P2, qualité identique.** Gain corrigé : pack -6 à -14 % (et non -26 %), soit -0,4 à -0,9 % du JS de l'image.
- **RESTE-07 — plausible, priorité P1, qualité identique.** Gain corrigé : Estimation inchangée (-50 à -70 % de build), mais elle porte sur un poste environ 3,7 fois plus gros en régime saturé que dans la fenêtre de 400 images.
- **RESTE-08 — plausible, priorité P2, qualité identique.** Code relu (actors.js:8-15, 39-48) : new Array(9) par produit, rotation(...r), cinq closures recréées par build, limb avec map et hypot(...dy). Math.hypot(dx,dy,dz) reçoit les mêmes arguments que le spread : identique. Les 180,5 Ko/image se reproduisent. Le ris…
- **DRAW-03 — plausible, priorité P3, qualité identique.** Gain corrigé : Octets envoyés : -97 % en taille (calculé) ; temps : quelques dizaines de µs sur M5, l'essentiel du gain CPU étant déjà pris par RCPU-01 et RCPU-04.
- **DRAW-04 — confirmé, priorité P3, qualité identique.** Gain corrigé : Au mieux 10 à 15 µs de fil principal par image ; environ 0,2 ms de processus GPU pour les quelque 60 groupes, incompressible sans réduire le nombre de groupes.
- **DRAW-08 — plausible, priorité P3, qualité identique.** Gain corrigé : Étape 1 : environ deux tiers des tests par entrée évités, mais seulement sur les images où la liste est recalculée.
- **DRAW-11 — confirmé, priorité P2, qualité identique.** Gain corrigé : 0 ms sur M5 (mesuré) ; -74 % d'exécutions du shader de sommets pour les formes lisses, utile sur GPU limités en sommets (estimé).

