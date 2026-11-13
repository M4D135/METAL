# Axe RCPU — RCPU

Origine : premier tour. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Axe RCPU : coût CPU par image du rendu, au commit 673d6b2 (clone en lecture seule, jamais modifié).

**Méthode.**
- Le harnais Node (bench/rcpu/harness.mjs) charge src/*.js dans le realm principal par vm.runInThisContext enveloppé, ce qui conserve les numéros de ligne. Un contexte node:vm est 4,5 à 5,5 fois plus lent et fausse le profil : ground ressort à 48 % en vm, alors qu'en realm principal ce sont segmentFree et blocked qui dominent.
- Le contexte WebGL2 est factice et compte les appels (octets de bufferData, draws, instances, vertexAttribPointer).
- Chaîne réelle : FRender.create, setWorld puis draw(), avec la vraie liste dynamique de game.js models() (lignes 418-586 extraites) et les vrais FActors, FEffects et FMotion.
- Scénario « tour » : mode dieu, toutes les armes, trajet glouton ennemis puis noyaux puis sortie à 7 m/s, balayage de lacet, destruction réelle via syncDestruction et updateWorld.
- 120 images de chauffe puis 3000 images mesurées, sur Apple M5 10 cœurs avec Node 24.18.
- D'autres agents chargeaient la machine (load average de 2 à 32). Tous les gains sont donc des A/B entrelacés image par image dans le même processus, et les comparaisons se lisent en relatif.

**État.**
- draw() coûte 0,41-0,66 ms par image en moyenne (p99 0,76-1,26 ms) ; models() coûte 0,19-0,26 ms. C'est faible sur M5, mais cela fait environ 3 à 9 ms par image sur un mobile 5 à 10 fois plus lent (extrapolation, estimé).
- Des pointes apparaissent à chaque destruction : updateWorld prend 2,3-2,8 ms en p50, auxquels s'ajoutent 3,3-3,5 ms de simulation dans la même image.
- Le rendu alloue 1,7 MB par image, sur 3,4 MB pour l'image complète, soit un scavenge toutes les 17 images environ.
- Cause principale : les listes statiques (vue, soleil, torche) sont recalculées et ré-uploadées sur 85 à 99 % des images, car le cache n'est valable que pour une liste strictement identique.
- Postes négligeables : lightPlan (1 µs), packEffects (5-7 µs), actorFilter (4-6 µs) et le nombre de draw calls (54-63).

**Top 10 chiffré.**
1. RCPU-01, cache temporel à marge pour la vue, le soleil et la torche.
   - draw() -57 % avec ce seul levier, -73 à -78 % combiné avec RCPU-03, 04 et 05.
   - p99 -43 à -56 %, upload -65 à -75 %, réallocations bufferData de 6,4 à 0 par image.
   - Prix : +15 à 21 % d'instances GPU. Aucun objet réellement visible manqué (contrôle par test sphère-frustum).
2. RCPU-02, updateWorld incrémental : de 2,3-2,8 ms à 0,53-0,75 ms en p50 par destruction, avec résultats et ordre de requête identiques.
3. RCPU-03, filtre des casters du soleil sans allocation : de 103 à 20 µs par image, et 245 KB par image d'allocation en moins (effort S).
4. RCPU-04, pools de buffers typés et upload par capacité.
   - pack -31 %, packIndexed -55 %.
   - Allocation du draw de 1,04 à 0,105 MB par image, scavenges -87 %.
5. RCPU-05, grille dense pour l'index spatial : requête de 58,6 à 23,3 µs, 196 KB par image en moins, ordre identique.
6. RCPU-06, sélection des débris dans effects.js : -33 à -40 % sur FEffects.build, sortie identique sur 3000 images sur 3000.
7. RCPU-07, culling de vue des pickups : 40 à 50 % de pickups modélisés en moins, soit environ -25 à -50 µs et 60 à 140 meshes dynamiques en moins par image.
8. RCPU-08, gouverneur de résolution.
   - Sous vsync 60 Hz : 10 à 11 changements d'échelle par minute, chacun réallouant les cibles de rendu.
   - Sur écran 120 Hz : aucune réaction à 40 fps.
9. RCPU-09, repli Canvas2D : 7,8 ms par image en moyenne (p99 19 ms) sur M5. Répartition : shade 22 %, collect 20 %, maskGround 12 %, tri 10 %, spread 8 %.
10. RCPU-10, appels GL.
    - vertexAttribPointer représente 50 à 52 % des 400 à 450 appels GL par image.
    - Le lot dynamique redessiné dans les 3 passes d'ombre représente 25 à 39 % des instances.

Hors top 10 : RCPU-11, FActors (environ 250 ns par primitive ; un colosse compte 111 primitives et coûte 24-33 µs par appel ; environ 90 KB par image d'allocation).

**Plan des pools de buffers typés.**
- (a) Un Float32Array scratch par site d'upload (dynamique, overlay, fx, 4 slots statiques), qui ne fait que grandir par doublement. On y écrit les 16 floats directement, sans tableau littéral.
- (b) Le code de forme est mis en cache sur le mesh, et un tri par comptage remplace names.indexOf et les 7 seaux.
- (c) Un raster extérieur Uint8Array à cellules de 2 m, construit dans setWorld, remplace zones.some.
- (d) Tampons GPU à capacité : bufferData(capacité) seulement au dépassement, puis bufferSubData. Anneau de 3 tampons pour dynamique, overlay et fx.
- (e) Tableaux de résultats réutilisés pour query et filter.
- (f) Vecteurs et matrices scratch dans motion.js et actors.js.
- Garde-fou en CI : moins de 0,2 MB alloués par draw().

**Plan de cohérence temporelle du culling.**
- Vue et torche : la sélection conservatrice teste la sphère (c, r+D) contre le cône (œil0, fw0, demi-diagonale0+θ). Elle n'est reconstruite que si l'œil bouge de plus de D = 1 m, si la direction tourne de plus de θ = 8°, ou si la portée, le FOV ou la révision du monde changent. Résultat : reconstruction sur 12 % des images, pour 1,30 fois plus d'instances que l'exact.
- Soleil : l'ensemble des casters est quantifié sur M = 4 m en espace lumière, avec une requête élargie de 1,74·M. La matrice d'ombre suit toujours le centre exact.
- Le banc contrôle que la sélection est un sur-ensemble de la sélection exacte.

**Plan des caches.**
- staticCaches indexés par un numéro de génération de sélection, ce qui supprime la comparaison entries.every en O(n).
- lampCasters et les sélections ne sont invalidés que si une cellule touchée par la destruction les concerne.
- Index spatial mis à jour cellule par cellule.
- Sélection des débris recalculée seulement si l'œil bouge de plus de 2 m ou si state.debris change.
- Pièces des pickups précalculées par type, en repère local.

**Ordre conseillé.**
1. RCPU-03, 06 et 07 : effort S, sortie identique.
2. RCPU-05 puis 02 : index, avec contrôle de l'ordre.
3. RCPU-04 : il faut étendre les mocks GL à bufferSubData.
4. RCPU-01 : il faut adapter checks/renderer-destruction.test.mjs:85.
5. RCPU-08, puis 10, puis 09, puis 11.

**Risques et budget.**
- Tous les leviers touchent le rendu seul : simulation, déterminisme et sauvegardes sont inchangés.
- Environ 8 à 10 KB de code ajouté, pour une marge de 611 KB : dist/index.html fait 789 111 octets pour un budget de 1 400 000.

Hors axe, signalé pour l'axe IA : un pic de simulation de 39 ms à l'image 620 (route, dont segmentFree 27,4 ms et blocked 9,5 ms).

## Mesures

- **Machine et protocole** : Apple M5 10 cœurs, 24 Go, Node v24.18.0. Load average 2,4 pour la matrice de référence, puis 6 à 32 (autres agents). _(méthode : sysctl et uptime. Les gains sont mesurés en A/B entrelacés image par image dans un même processus, et lus en relatif.)_
- **draw() JS par image (faux WebGL2, tour, 3000 images)** : Moyenne 0,41-0,66 ms, p99 0,76-1,26 ms, max 1,5-4,2 ms. Mondes camp:6, 12 et 17, legacy:2 ; qualités auto et high. _(méthode : matrix.sh puis bench-draw.mjs instrument=1, load 2,4.)_
- **models() par image** : Moyenne 0,19-0,26 ms, p99 0,40-0,95 ms. Sections : FEffects 91-109 µs (57-61 meshes), pickups 56-98 µs (159-284 meshes), ennemis 52-60 µs (135-142 meshes), overlay armes 21 µs (56 meshes). _(méthode : bench-models.mjs, marqueurs de section game.js 419-584, 3000 images.)_
- **Décomposition de draw() en µs par image** : camp:17 auto : requête vue 63 ; filtre visible 52 ; pack dynamique 54 ; ombres 270 (soleil : requête et filtre 150, rendu 58 ; torche : requête 43, rendu 13 ; lampes 3) ; renderStatic vue 33 ; overlay 7 ; fx 5. camp:6 : requête 68-81, filtre 41-44, pack 70-77, ombres 168-185, vue 26-30. _(méthode : bench-draw.mjs instrument=1 : marqueurs __L par ligne de draw 1535-1584, plus __B/__M dans les passes d'ombre.)_
- **Taux de reconstruction des caches statiques, caméra en mouvement** : Vue 0,94-0,99 ; soleil 0,85-0,99 ; torche 0,85-0,98 ; lampes 0,01. Entrées par reconstruction : vue 882-1641, soleil 1009-2360, torche 263-435. La liste principale change sur 99,9 % des images. _(méthode : Compteur __S(slot,same,n) injecté dans renderStatic (renderer.js:1410) ; alt.mjs D0.)_
- **Upload et appels GL par image** : uploadBytes 157-312 KB (p95 289-422) ; 5,6-6,6 bufferData ; 401-448 appels GL dont 202-231 vertexAttribPointer (50-52 %) ; 54-63 draws ; 4 520-5 950 instances au niveau GL ; 193-221 K triangles. _(méthode : Compteurs du faux GL : bench-draw.mjs et glcalls.mjs.)_
- **Allocations et GC** : Chemin de rendu : 1,71 MB par image. Principaux allocateurs : filtre soleil 245 KB, FMotion.place 206 KB, pack 204 KB, query 196 KB, supplyModel 86 KB, FEffects 79 KB, packIndexed 41 KB, FActors 39 KB. Image complète : 3,37 MB par image ; simulation seule : 1,62 MB. 214 scavenges pour 3600 images, moyenne 0,23 ms, max 1,92 ms. _(méthode : prof-draw.mjs (heap sampling, camp:6). node --trace-gc gc-bench.mjs en modes full et simonly, puis gc-parse.py.)_
- **Allocations de draw() seul, original vs prototype** : Original 1,04 MB par image (95 scavenges) ; prototype 0,105 MB par image (12 scavenges), sur 3600 images. _(méthode : gc-bench.mjs drawonly, avec simulation figée et models() mis en cache : la caméra fixe favorise le cache. --trace-gc.)_
- **A/B du prototype complet (grid, sun, cache, pool ; D=1 m, θ=8°, M=4 m)** : draw() moyen : camp:6 de 1,006 à 0,270 ms ; camp:17 de 1,892 à 0,474 ; legacy:2 de 1,662 à 0,408 ; camp:17 high de 2,242 à 0,498, soit -73 à -78 %. p99 de 2,45 à 1,17 / 4,94 à 2,83 / 5,24 à 2,32 / 4,55 à 2,18 ms. Upload de 157 à 55, 250 à 65, 251 à 63, 313 à 79 KB. bufferData de 6,4 à 0, avec 3-4 bufferSubData restants. Instances +15-21 %, staticVisible +28-31 %. 0 à 26 absents dans la vue principale, tous des faux positifs de l'original. _(méthode : ab.mjs : proto.mjs patche renderer.js en mémoire ; original et prototype dessinent la même image dans le même processus ; contrôle de sur-ensemble par passe et test sphère-frustum échantillonné sur chaque absent.)_
- **A/B par levier isolé (camp:6, 2400 images, charge forte)** : grid -29 % (listes identiques) ; sun -11 % ; cache -57 % (upload de 132 à 51 KB, instances +14 %) ; pool sans effet sur faux GL (2,19 contre 2,24 ms, dans le bruit). _(méthode : ab.mjs <levier>.)_
- **Micro-bancs sur listes réelles capturées** : Requête : A0 58,6 µs, CSR 23,3 µs (ordre identique, 5 594 063 = 5 594 063) ; sous charge 115, CSR 42,7, cellules-tableaux 66,7. Filtre vue de 23,2 à 20,0 µs. Filtre soleil de 103,3 à 20,1 µs. pack de 52,9 à 42,4 puis 36,2 µs (outdoorAt seul 12,1). packIndexed de 34,3 à 15,6 puis 6,6 µs (indirection). spatialIndex complet 1,87 ms ; diff d'identité 0,25 ms. _(méthode : alt.mjs, camp:17, 1500 images du tour.)_
- **Compromis du cache à marge** : 1 m / 8° : reconstruction sur 12 % des images, instances ×1,30. 2 m / 12° : 7,6 %, ×1,47. 3 m / 15° : 5,8 %, ×1,62. 4 m / 20° : 4,6 %, ×1,81. _(méthode : alt.mjs D1, rejeu des caméras du tour.)_
- **Destruction** : 18-20 révisions pour 3000 images. updateWorld : moyenne 2,53-3,07 ms, p50 2,29-2,78, max 3,75-4,87. Draw suivant 0,73-0,80 ms contre 0,55-0,60. sim.step 3,3-3,5 ms contre 0,6-0,75. Prototype incrémental : p50 0,53-0,75 ms, moyenne 1,04-1,65 ms, résultats et ordre identiques. _(méthode : destr.mjs, camp:17 et camp:6.)_
- **FEffects.build** : 91-109 µs sans charge, 184-223 µs instrumenté sous charge. Le bloc débris représente 80 % : scan 32 %, Set 18 %, tri 1 12 %, slice et solid 11 %, tri 2 7 %. Réécriture : de 0,169 à 0,101 ms et de 0,195 à 0,121 ms ; en ordre alterné, de 0,295 à 0,198 ms. Sorties identiques sur 3000 images sur 3000. _(méthode : effects-sections.mjs (marqueurs de ligne) ; effects-ab.mjs (isDeepStrictEqual, ordre alterné).)_
- **Pickups et butin** : 21,8 à 38,3 modélisés par image ; actorFilter n'en garderait que 50-60 %. _(méthode : pickups.mjs, avec renderer.actorFilter (caméra et volumes d'ombre, r=1,6 m).)_
- **FActors par primitive et LOD** : 191-362 ns par mesh. Machines : 49-69, 15-16 et 6 meshes aux LOD0, 1 et 2. Colosses : 111-112, 34-35 et 14 meshes ; un boss au LOD0 coûte 24-33 µs. Tour : 37-52 µs par image. _(méthode : actors-cost.mjs, appels isolés par type, distance et échelle.)_
- **Repli Canvas2D** : setWorld 9,6 ms ; première image 48,2 ms. draw : moyenne 7,8 ms, p95 15,6, p99 19,2, max 30,6. 21,1 K appels ctx par image (p99 47,9 K). Parts du draw inclusif : paint 60 %, shade 22 %, collect 20 %, maskGround 12 %, cache 11 %, tri 10 %, polygonPath 8 %, GC environ 1 ms. _(méthode : bench-canvas.mjs, contexte 2D factice à compteurs en 1024×576. prof-canvas.mjs, profilage in-process par node:inspector, sans port.)_
- **Gouverneur de résolution** : vsync 60 Hz, T1 de 19 à 30 ms : 10-11 changements par minute, 53,5-56,8 fps, 6-12 % d'images en retard. vsync 120 Hz, T1 de 19 à 24 ms : 40 fps, aucune réaction. VRR, T1 de 22 à 24 ms : 42-46 fps, aucune réaction. _(méthode : gov.mjs : resolutionGovernor réel, temps GPU synthétique T1·scale², 60 s par profil.)_
- **Biais de méthode du contexte node:vm** : 4,5 à 5,5 fois plus lent : génération 170-188 ms contre 41-63 ; 600 pas 333-389 ms contre 60-86. Profil faussé. _(méthode : vm-vs-main.mjs et spike-main.mjs.)_
- **Hors axe (IA)** : Pic de sim.step de 39 ms à l'image 620 : route, dont segmentFree 27,4 ms et blocked 9,5 ms. _(méthode : spike-main.mjs, profil in-process.)_

## Scripts de banc

- bancs/rcpu/harness.mjs
- bancs/rcpu/bench-draw.mjs
- bancs/rcpu/matrix.sh
- bancs/rcpu/proto.mjs
- bancs/rcpu/ab.mjs
- bancs/rcpu/alt.mjs
- bancs/rcpu/destr.mjs
- bancs/rcpu/gc-bench.mjs
- bancs/rcpu/gc-parse.py
- bancs/rcpu/prof-draw.mjs
- bancs/rcpu/prof-lines.mjs
- bancs/rcpu/effects-sections.mjs
- bancs/rcpu/effects-ab.mjs
- bancs/rcpu/bench-models.mjs
- bancs/rcpu/pickups.mjs
- bancs/rcpu/actors-cost.mjs
- bancs/rcpu/glcalls.mjs
- bancs/rcpu/gov.mjs
- bancs/rcpu/bench-canvas.mjs
- bancs/rcpu/prof-canvas.mjs
- bancs/rcpu/worldstats.mjs
- bancs/rcpu/trace.mjs
- bancs/rcpu/vm-vs-main.mjs
- bancs/rcpu/spike-main.mjs

## Constats

### RCPU-01 — Listes statiques recalculées et ré-uploadées à chaque image : cache temporel à marge pour la vue, le soleil et la torche
- sévérité haute · catégorie perf-cpu · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité visuellement identique · moteur (dans METAL)
- lieux : src/renderer.js:1545-1547; src/renderer.js:1408-1413; src/renderer.js:1435-1436; src/renderer.js:1454-1458; src/renderer.js:1576

**Preuve.** Code en cause :
- renderer.js:1545-1546 : query(eye,ranges) puis filter(visible) à chaque image.
- renderer.js:1410 : le cache n'est valable que si la liste est identique élément par élément (entries.every).
- renderer.js:1435-1436 : pour la torche, stable est toujours faux, donc query et filter à chaque image.
- renderer.js:1454-1458 : les casters du soleil sont recalculés à chaque image.

Mesures (bench-draw.mjs instrument=1, tour de 3000 images) :
- Taux de reconstruction : vue 0,94-0,99 ; soleil 0,85-0,99 ; torche 0,85-0,98 ; lampes 0,01.
- La liste principale change sur 99,9 % des images (alt.mjs D0).
- Conséquence : 157-312 KB ré-uploadés par image, en 5,6-6,6 bufferData.

A/B entrelacé (ab.mjs, 3000 images, prototype grid+sun+cache+pool, D=1 m, θ=8°, M=4 m) :
- draw() moyen : camp:6 de 1,006 à 0,270 ms (-73 %) ; camp:17 de 1,892 à 0,474 ms (-75 %) ; legacy:2 de 1,662 à 0,408 ms (-75 %) ; camp:17 high de 2,242 à 0,498 ms (-78 %).
- p99 : de 2,45 à 1,17 ms, de 4,94 à 2,83, de 5,24 à 2,32, de 4,55 à 2,18.
- Upload : de 157 à 55, de 250 à 65, de 251 à 63, de 313 à 79 KB par image.
- Cache seul : draw() de 0,76 à 0,33 ms (-57 %), upload de 132 à 51 KB.
- Coût : instances GPU +15-21 %, staticVisible +28-31 %.

Exactitude :
- Aucune entrée de l'original n'est absente du prototype dans les 3 passes d'ombre.
- Vue principale : 0 à 26 absents sur 3000 images. Un test sphère-frustum échantillonné les classe tous comme faux positifs du test de plans de l'original : aucune intersection réelle.

**Cause.** Le culling exact est refait à chaque image. Le cache statique ne vaut que pour une liste strictement identique, donc tout déplacement de caméra l'invalide. Chaque passe repaque alors 260 à 2400 entrées et réalloue son tampon.

**Proposition.** Sélection conservatrice à marge, réutilisée tant qu'elle reste valide.
(1) Vue et torche. À la reconstruction :
- Appeler query(eye0, ranges+D).
- Garder e si |c-eye0| ≤ r+D+near, ou si l'angle entre c-eye0 et fw0 est au plus demiDiag0+θ+asin(min(1,(r+D)/|c-eye0|)). Comparer des cosinus évite acos.
- Mémoriser eye0, fw0, demiDiag0, ranges0, aspect, FOV et worldRevision.
- La sélection reste valide tant que |eye-eye0| ≤ D, angle(fw,fw0) + demiDiag ≤ demiDiag0 + θ, ranges ≤ ranges0, et que la révision est la même.
- Valeurs : D=1 m, θ=8°. Voir la table de compromis dans les mesures.
(2) Soleil :
- Quantifier le centre en espace lumière sur une grille M=4 m (axes r, u, fw).
- Requête étendue de 1,74·M.
- Reconstruire seulement si le centre quantifié change.
- La matrice d'ombre suit toujours le centre exact.
(3) renderStatic : comparer cache.gen et sel.gen (numéro de génération) au lieu de entries.every.
(4) Construire la sélection dans l'ordre de l'index, pour garder l'ordre de dessin des coplanaires.

**Gain attendu.** draw() JS : -57 % avec ce levier seul, -73 à -78 % combiné avec RCPU-03, 04 et 05.
p99 : -43 à -56 %.
Upload : -65 à -75 %.
Repaque des statiques sur environ 12 % des images seulement.
Sur un mobile 5 à 10 fois plus lent : environ 2 à 7 ms par image rendus au jeu (extrapolation).

**Risques.** Rendu seul : aucun effet sur le déterminisme ni sur les sauvegardes.
GPU : +15-21 % d'instances, à mesurer sur GPU mobile ; RCPU-10 peut compenser.
Tests :
- stats.staticVisible (renderer.js:1547) devient la taille du sur-ensemble.
- checks/renderer-destruction.test.mjs:85 attend staticVisible===1 ('fine trim is outside its own range'). Il casse si la garniture est à moins de D au-delà de sa portée : adapter le test ou exposer un compteur exact en mode test.
- Les assertions « aucun bufferData sur image inchangée » restent vraies.
Taille : environ 2-3 KB.

**Vérifier par.** node bench/rcpu/ab.mjs <ferro> 3000 camp:17 auto cache 1 8 4 45 : temps entrelacés, contrôle de sur-ensemble par passe et classement sphère-frustum des absents. Puis npm test avec les tests adaptés, et une capture GPU mobile pour mesurer le coût des instances en plus.

**Contre-vérification.** Code relu : renderer.js:1410 (cache valable seulement si entries.every identiques), 1435-1436 (torche jamais stable), 1454-1458 (soleil recalculé), 1545-1546. Preuve indépendante dans Chrome sans interface (Metal, page file://, variantes en rotation à chaque image, 350 images, deux répétitions) et dans Node (A/B alterné, temps CPU du fil principal). Le gain est confirmé et le sur-ensemble est correct (0 entrée de l'original absente sur 900 images). Trois corrections. (1) L'image N'EST PAS identique : le cache dessine en moyenne 34 objets par image qui sont dans le frustum exact mais au-delà de leur portée de détail (niveau 0 entre 64 et 65,2 m, niveau 1 entre 32 et 33 m, niveau 2 entre 13 et 14 m), sur 99 % des images. Différence d'images mesurée contre l'original : PSNR 64,5 dB, jusqu'à 0,17 % de pixels à plus de 10/255 ; les variantes sans cache (grid, sun, pool) sont, elles, identiques au bit près. Le contrôle du premier tour (aucun objet visible manqué) ne pouvait pas voir ce défaut. Même effet attendu dans les ombres (casters de niveau 1 entre 18 et 19 m de la torche, entre 26 et 33 m pour le soleil), non mesuré séparément. Correctif : RCPU-V1 (coupure de portée exacte dans le vertex shader). (2) Le coût GPU du sur-ensemble est invisible sur M5 : +27 % d'instances et +16 % de triangles, mais le temps total avec synchronisation GPU baisse. À revérifier sur GPU mobile. (3) Les marges fixes D = 1 m et θ = 8° sont calées sur METAL : le gain tombe à -51 % en rotation rapide (387°/s, reconstruction sur 45 % des images) et à -38 % à 80 m/s (reconstruction sur 60 % des images) ; FERRO accepte un FOV de 10° pour BITUME, où θ = 8° gonfle fortement le cône. Voir RCPU-V2. Risque de test confirmé : checks/renderer-destruction.test.mjs:85 (staticVisible===1). Les copies FERRO 248043a, BITUME et Point de rupture du renderer ont la même structure (renderStatic à la ligne 1564 de la copie FERRO), donc le levier vaut pour les trois jeux. À faire après le lot exact RCPU-03+04+05, et seulement avec RCPU-V1.

**Preuve corrigée.** Chrome réel, charge machine 34 à 82 : draw() CPU médian 3,2 → 1,0 ms (cache seul, -69 %) ; exécutions du premier vérificateur relues : 2,6 → 0,8 et 2,2 → 0,7 ms. Tout le prototype : 3,2 → 0,6 ms (-81 %). Temps total avec synchronisation GPU : 12,8 → 10,9 ms. Instances 4583 → 5826. Node alterné (bench/rcpu-verif2/v-cache.mjs, camp:17, 900 images) : CPU ×0,23, upload 254 → 52 KB par image, reconstruction sur 12,6 % des images, liste ×1,30. Les valeurs absolues du premier tour (0,41 à 0,66 ms) ne sont pas comparables : charge différente.

**Gain corrigé.** draw() CPU : -57 à -77 % avec le cache seul selon le banc (-69 % dans Chrome réel), -81 % avec tout le prototype. -51 % en rotation rapide, -38 % à 80 m/s. Image non identique sans RCPU-V1.

### RCPU-02 — Destruction : updateWorld reconstruit tout l'index spatial et vide les 4 caches statiques
- sévérité haute · catégorie saccade · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1373-1382; src/renderer.js:768-792; src/renderer.js:961-973; src/game.js:152-156; src/destruction.js:160-178

**Preuve.** Code en cause :
- renderer.js:1376 : reconstruction complète par spatialIndex(world,environment,worldIndex).
- renderer.js:1379 : lampCasters vidé et les 4 staticCaches remis à zéro. Le commentaire « only the affected instance lists upload next draw » ne correspond pas : tout est ré-uploadé.
- Déclenché par game.js:152-156 (syncDestruction) à chaque révision.

Mesures (destr.mjs, tour de 3000 images) :
- 18 à 20 révisions, soit environ une toutes les 2,5-2,8 s en combat.
- updateWorld : moyenne 2,53-3,07 ms, p50 2,29-2,78, max 3,75-4,87 ms sur M5.
- Le draw suivant repaque tout : 0,73-0,80 ms contre 0,55-0,60.
- Dans la même image, sim.step coûte 3,3-3,5 ms contre 0,6-0,75 (hors axe). Total : environ 7 ms de JS sur M5, soit 35 à 70 ms sur un CPU mobile 5 à 10 fois plus lent (estimé).

Prototype incrémental par cellules touchées :
- p50 0,53-0,75 ms, moyenne 1,04-1,65 ms.
- max 4,2-4,6 ms quand 300 à 600 entrées changent.
- Résultats et ordre de requête identiques.
- Diff d'identité seul : 0,25 ms par appel, contre 1,87 ms pour la reconstruction complète (alt.mjs G0 à G2).

Canvas2D : renderer.js:961-973 invalide tous les e.software dès que les lumières ou le sol changent. updateWorld prend alors 3,6-5,3 ms, et le draw de la même image 4,6-18,6 ms (bench-canvas).

**Cause.** destruction.js:160-178 conserve l'identité des meshes intacts, mais le renderer ne s'en sert pas. Une destruction ne change que 16 à 600 entrées, et pourtant tout est reconstruit et tous les caches sont vidés.

**Proposition.** (1) Diff par identité avec une génération : marquer e.gen=g, puis les entrées non marquées sont celles qui ont été retirées.
(2) Cellules touchées : celles des entrées ajoutées, retirées ou déplacées.
- Ne reconstruire que leurs listes, en gardant l'ordre d'index des meshes (tri du contenu de la cellule par index).
- Utiliser la variante « une liste par cellule » (A3) ou une grille compacte CSR avec liste de débordement.
- maxRadius par niveau : agrandir tout de suite, réduire à l'inactivité.
(3) N'invalider que les sélections en cache (RCPU-01) et les lampCasters dont la boîte englobante touche une cellule changée (lampes : 32 m).
(4) Canvas2D : n'invalider e.software que pour les meshes à portée des lumières touchées.
(5) Si le pire cas dépasse encore 2 ms, étaler la reconstruction des cellules sur 2 images : la requête lit l'ancienne cellule jusqu'au remplacement.

**Gain attendu.** updateWorld en p50 : de 2,3-2,8 ms à 0,53-0,75 ms (-70 à -77 %, mesuré) ; en moyenne -40 à -60 %.
Le repaque complet de l'image suivante est évité (environ 0,2 ms sur M5, estimé).

**Risques.** L'ordre à l'intérieur d'une cellule doit être conservé, à cause du z-fighting entre coplanaires ; le prototype le conserve, contrôle à l'appui.
Tests : checks/renderer-destruction.test.mjs vérifie que updateWorld est paresseux et qu'aucun mur détruit ne reste référencé par une vue d'ombre. Garder ces invariants et ajouter un test « requête incrémentale identique à la reconstruction ».
La grille compacte CSR coûte plus cher à reconstruire (1,6 ms contre 1,2 ms en A3) : à coupler avec RCPU-05.
Rendu seul. Taille : environ 1,5-2 KB.

**Vérifier par.** node bench/rcpu/destr.mjs <ferro> 3000 camp:17 et camp:6 : temps, plus la ligne « identical query results+order: true ». Puis npm test.

**Contre-vérification.** Code relu : renderer.js:1376 (spatialIndex complet), 1379 (lampCasters et 4 caches vidés), game.js:152-156, destruction.js:160-178 (les meshes intacts gardent leur identité). Script destr.mjs relu puis rejoué : le rapport est reproduit, résultats et ordre de requête identiques. Corrections. (1) Les 24 à 31 ms de LOOP-04 dans la synthèse sont la même dépense mesurée dans node:vm : la valeur réelle sur M5 calme est 2,3 à 2,8 ms, plus 3,3 ms de simulation dans la même image. C'est un à-coup visible à 120 Hz et sur mobile, pas à 60 Hz sur M5. (2) Le vidage des 4 caches ne coûte presque rien aujourd'hui quand la caméra bouge, puisque 3 listes sur 4 sont déjà repaquées sur 85 à 99 % des images ; il ne devient coûteux qu'après RCPU-01, donc l'invalidation ciblée (point 3) est à livrer avec RCPU-01. (3) Écarter le point 5 (étalement sur 2 images) : un mur détruit resterait dessiné une image avec ses gravats, et le test « aucun mur détruit référencé par une vue d'ombre » l'interdit. (4) Grille dense : prévoir une marge de cellules ou un repli sur reconstruction complète quand un morceau tombe hors des bornes (le prototype prend 4 cellules de marge). Sans les points 4 et 5, sortie identique.

**Preuve corrigée.** Rejeu sous charge 47 à 82 (camp:17, 10 révisions sur 1500 images) : reconstruction complète p50 9,9 ms contre 3,3 ms en incrémental (×3,0), 147 entrées touchées en médiane, « identical query results+order: true ». alt.mjs : G0 6,1 ms contre 0,75 ms pour le diff d'identité. Valeurs absolues gonflées par la charge ; seul le rapport compte.

**Gain corrigé.** Mise à jour de l'index environ 3 fois plus rapide (rapport reproduit) ; sur M5 calme, environ 2,5 ms → 0,6 à 0,75 ms par destruction (chiffres du premier tour, non remesurés en absolu).

### RCPU-03 — Filtre des casters du soleil : 3 tableaux et 2 closures par entrée
- sévérité moyenne · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1454-1457; src/renderer.js:1440-1459

**Preuve.** Code en cause : renderer.js:1454-1457, sur environ 2000 candidats par image.
`const d=e.p.map((v,k)=>v-p[k]),along=a=>d[0]*a[0]+d[1]*a[1]+d[2]*a[2],z=along(fw)`, puis deux autres appels à along().

Mesures :
- alt.mjs : C1 103,3 µs par image, contre 20,1 µs pour C2 en scalaires en ligne, avec des résultats identiques (2039 casters par image).
- prof-lines (camp:17) : la ligne 1455 coûte 113 µs par image en temps propre, premier poste du rendu par ligne.
- Tas (prof-draw, camp:6) : 245 KB par image, premier allocateur du chemin de rendu (14 % de 1,71 MB).
- A/B du levier « sun » seul : draw() -11 %.

**Cause.** Code fonctionnel (map, closure, filter) dans une boucle chaude d'environ 2000 itérations par image. La closure s'échappe dans filter, donc V8 ne supprime pas ces allocations.

**Proposition.** Boucle indexée :
- Hors boucle, lire px, py, pz, les 9 composantes de r, u et fw, ainsi que near, far et extent.
- Pour chaque e : dx=e.p[0]-px, et de même pour dy et dz ; a=dx*rx+dy*ry+dz*rz ; b et z de la même façon.
- Si |a|<extent+e.radius, |b|<extent+e.radius, z+e.radius>near et z-e.radius<far, alors out[n++]=e.
- Terminer par out.length=n, sur un tableau réutilisé.
Même ordre et même résultat. Avec RCPU-01, le filtre ne tourne plus que sur environ 10 % des images.

**Gain attendu.** Environ -80 µs par image sur M5 (-80 % sur le filtre) et -245 KB par image d'allocation.

**Risques.** Aucun : le résultat est identique (contrôlé). Taille : environ +0,2 KB. Aucun test à modifier.

**Vérifier par.** node bench/rcpu/alt.mjs <ferro> camp:17 1500 : lignes C0 à C2, plus la ligne « C identical counts true ».

**Contre-vérification.** Code relu : renderer.js:1454-1457 (e.p.map plus closure along par candidat). Preuves indépendantes : micro-banc rejoué (comptes identiques) et Chrome réel, où l'image de la variante sun est identique au bit près à l'original (écart moyen 0 sur 30 images comparées). Correction du gain : isolé, le levier est faible et variable. En revanche le lot exact RCPU-03+04+05 est sur-additif : -45 à -47 % de draw() CPU dans Chrome (3 exécutions) et -46 % dans Node alterné, avec image identique au bit près et aucune instance en plus. Ce lot doit passer en premier, avant le cache de RCPU-01. Effort S, aucun test à adapter.

**Preuve corrigée.** alt.mjs sous charge : C1 683 µs → C2 80 µs par image (-88 %), 1652 casters, comptes identiques. Chrome réel, sun seul : draw() CPU médian 3,2 → 2,8 ms, 2,6 → 2,3 et 2,2 → 1,9 ms. Node alterné, fil principal : ×0,975 seulement (55 % des images plus rapides). Lot grid+sun+pool : ×0,54 dans Node (99 % des images plus rapides) ; 3,2 → 1,7, 2,6 → 1,4 et 2,2 → 1,2 ms dans Chrome.

**Gain corrigé.** Seul : -3 à -14 % de draw() CPU. Avec RCPU-04 et 05 : -45 à -47 %, image identique au bit près.

### RCPU-04 — Pools de buffers typés et upload par capacité (pack, packIndexed, bufferData DYNAMIC_DRAW)
- sévérité moyenne · catégorie mémoire · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:678-696; src/renderer.js:654-674; src/renderer.js:798-803; src/renderer.js:1397-1400; src/renderer.js:1561; src/renderer.js:1581

**Preuve.** Code en cause :
- pack, renderer.js:678-696 : values.set([16 littéraux]) alloue un tableau par mesh (ligne 691) ; names.indexOf ; surfaceFlags appelle outdoorAt, qui fait zones.some (654-674).
- packIndexed, renderer.js:798-803 : new Float32Array et 7 seaux à chaque reconstruction.
- renderer.js:1400 et 1561 : bufferData(…, DYNAMIC_DRAW) à taille variable, 5,6-6,6 fois par image, soit une réallocation pilote à chaque appel.

Mesures (alt.mjs) :
- pack : E0 52,9 µs ; E1 42,4 µs avec tri par comptage et sans tableau par mesh ; E2 36,2 µs avec en plus un raster extérieur en O(1). outdoorAt seul coûte 12,1 µs.
- packIndexed : F0 34,3 µs ; F1 15,6 µs avec tampon persistant et code de forme en cache ; F2 6,6 µs avec une indirection d'index à 4 octets par instance.
- Tas : pack 204 KB par image, packIndexed 41 KB.

GC (--trace-gc, gc-bench drawonly, 3600 images) :
- Original : 3736 MB libérés, soit 1,04 MB par image, et 95 scavenges.
- Prototype complet : 378 MB, soit 0,105 MB par image, et 12 scavenges.
- Image complète : 3,37 MB par image et 214 scavenges, en moyenne 0,23 ms, au maximum 1,92 ms sur M5.
- A/B du levier « pool » seul sur faux GL : draw() inchangé. Le gain se fait côté GC et pilote, pas en JS.

**Cause.** Chaque image recrée ses tableaux d'instances et réalloue les tampons GPU par des bufferData de taille variable. Il n'y a ni pool ni capacité conservée.

**Proposition.** (1) Un Float32Array scratch par site (dynamique, overlay, fx, 4 slots statiques), qui ne fait que grandir (ensure(n·16), taille doublée). Écrire les 16 floats directement : v[o]=p[0], etc.
(2) Mettre le code de forme en cache sur le mesh (mesh.__k ??= SHAPE[shape]) et trier par comptage en 2 passes : compte, préfixe, dispersion.
(3) Raster extérieur Uint8Array à cellules de 2 m, calculé dans setWorld ; drapeau extérieur des statiques calculé une seule fois.
(4) Tampons GPU à capacité :
- Si n·64 > cap, prendre cap = puissance de 2 suivante et appeler bufferData(cap).
- Puis bufferSubData(0, rows, 0, n·16).
- Anneau de 3 tampons pour dynamique, overlay et fx, pour éviter la synchronisation implicite sur mobile.
(5) Tableaux de résultats réutilisés pour query et filter.
Option ultérieure : indirection d'index par texelFetch sur une texture RGBA32F des statiques.

**Gain attendu.** pack -31 %, packIndexed -55 %.
Allocation de draw() : de 1,04 à 0,105 MB par image, scavenges -87 %, avec RCPU-01, 03 et 05 dans le scénario draw-only.
Plus aucune réallocation pilote en régime établi : gain réel surtout sur ANGLE et les pilotes mobiles (estimé).

**Risques.** Tests : le Proxy GL de checks/renderer-destruction.test.mjs:13-24 reconstruit les lignes depuis les arguments de bufferData (buffers.set(bound,Array.from(args[1]))). Un bufferData(taille) suivi de bufferSubData lui donnerait des draws vides. Il faut ajouter bufferSubData (dstOffset, src, srcOffset, length) à ce mock et à celui de checks/actor-visibility.test.mjs:30.
WebGL2 seulement ; le repli Canvas2D n'est pas concerné.
Rendu seul. Taille : environ +1,5 KB.

**Vérifier par.** node --trace-gc bench/rcpu/gc-bench.mjs <ferro> 3600 camp:17 drawonly [proto] | python3 bench/rcpu/gc-parse.py, puis node bench/rcpu/alt.mjs (E0 à E3, F0 à F2). Garde-fou CI proposé : moins de 0,2 MB alloués par draw().

**Contre-vérification.** Code relu : pack 678-696 (tableau littéral de 16 valeurs par mesh, names.indexOf, outdoorAt avec zones.some), packIndexed 798-803, bufferData de taille variable en 1400 et 1561. Le levier est confirmé dans Chrome réel, avec image identique au bit près. Corrections. (1) Les gains JS annoncés ne sont pas reproduits : pack -31 % non retrouvé, packIndexed -30 % au lieu de -55 %. (2) Le chiffre 1,04 → 0,105 MB par image vient d'un scénario à caméra fixe qui favorise le cache et cumule RCPU-01, 03 et 05 : non représentatif, non remesuré. (3) Risque non signalé : bufferSubData sur un tampon encore utilisé par l'image précédente peut bloquer certains pilotes mobiles. Garder l'orphelinage à capacité constante sur les 7 sites (bufferData(taille fixe) puis bufferSubData) plutôt qu'un anneau réservé à 3 tampons. (4) Le mock de checks/actor-visibility.test.mjs est un Proxy générique : rien à y ajouter, contrairement à ce qui est écrit. Seul checks/renderer-destruction.test.mjs:20-22 est à étendre, et ses assertions « aucun bufferData » des lignes 41, 45, 100 et 157 doivent aussi interdire bufferSubData, sinon elles passent à vide.

**Preuve corrigée.** Chrome réel, pool seul : draw() CPU médian 3,2 → 2,9 ms (-9 %) et 2,2 → 1,9 ms (-14 %), image identique (écart 0). Node alterné : ×0,91 (82 % des images plus rapides). alt.mjs sous charge : pack E0 257, E1 292, E2 208 µs ; packIndexed F0 136, F1 95, F2 39 µs.

**Gain corrigé.** -9 à -14 % de draw() CPU seul ; contribue au lot exact (-45 à -47 % avec RCPU-03 et 05). Baisse des allocations et des collectes plausible, non remesurée.

### RCPU-05 — Index spatial : clés chaîne x+','+z et Map.get pour chaque cellule, 3 requêtes par image
- sévérité moyenne · catégorie perf-cpu · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:768-792; src/renderer.js:779-786; src/renderer.js:1545; src/renderer.js:1454; src/renderer.js:1436

**Preuve.** Code en cause : renderer.js:768-792. La requête (779-786) fait levels[level].get(x+','+z) puis un test de distance sur chaque entrée de la cellule. Elle est appelée 3 fois par image : vue (1545), soleil (1454), torche (1436).

Mesures :
- prof-lines (camp:17) : query coûte 153 µs par image en temps propre (ligne 786 : 92 µs ; ligne 785 : 55 µs).
- Tas : 196 KB par image.
- alt.mjs, sur 16 843 entrées : A0 58,6 µs contre 23,3 µs pour une grille dense CSR (-60 %). L'ordre est identique (5 594 063 = 5 594 063).
- Sous charge : 115 µs contre 42,7 µs ; la variante une liste par cellule (A3) fait 66,7 µs.
- A/B du levier « grid » seul : draw() -29 %, avec des listes identiques (taille ×1,00, aucun absent).

**Cause.** Chaque cellule visitée construit une chaîne et paie un hachage de Map, sur jusqu'à (2r/8)² cellules × 3 niveaux × 3 requêtes. Les entrées sont des objets dispersés en mémoire (e.p est un tableau), donc le cache CPU est mal utilisé.

**Proposition.** Grille dense par niveau, construite dans setWorld et updateWorld :
- Bornes AABB du monde, cellules de 8 m, nx·nz cellules.
- CSR : cellStart en Int32Array(nx·nz+1), items en Int32Array.
- Coordonnées en tableaux séparés px, py, pz, rad (Float64Array pour une égalité stricte avec l'actuel), et entries[] pour l'identité.
query(eye, ranges, out) :
- Bornes de cellules ramenées à la grille.
- Test d² ≤ (range+rad)² sur ces tableaux.
- Écriture dans un tableau réutilisé.
L'ordre reste celui de l'insertion par cellule. Pour RCPU-02 : une liste par cellule, ou CSR avec liste de débordement compactée à l'inactivité.

**Gain attendu.** Environ -35 µs par image pour la requête de vue (de 58,6 à 23,3 µs), et du même ordre pour le soleil et la torche.
-196 KB par image.
draw() -29 % en A/B isolé.

**Risques.** L'ordre de sortie conditionne l'ordre de dessin des coplanaires : il est identique en CSR (contrôlé).
Les entrées hors bornes vont dans les cellules de bord.
Mémoire : quelques dizaines de KB par niveau.
La reconstruction CSR coûte 1,6 ms : à coupler avec RCPU-02, sinon updateWorld s'alourdit (vu en A/B).
Rendu seul. Taille : environ +1 KB.

**Vérifier par.** node bench/rcpu/alt.mjs <ferro> camp:17 1500 (A0, A1 et A3, plus la ligne « identical order: true ») et node bench/rcpu/ab.mjs <ferro> 3000 camp:6 auto grid.

**Contre-vérification.** Code relu : renderer.js:768-792 (clé chaîne x+','+z et Map.get par cellule, 3 requêtes par image). Preuves indépendantes : ordre de sortie identique rejoué, image identique au bit près dans Chrome. L'ordre de requête est un ordre global (niveau, cellule x, cellule z, insertion) indépendant de l'œil, donc la grille compacte le conserve par construction. Gain corrigé à la baisse hors Chrome. À coupler avec RCPU-02 comme annoncé : la reconstruction de la grille compacte coûte autant que l'index actuel. Les entrées non finies restent ignorées comme aujourd'hui. Même fonction dans la copie FERRO 248043a (ligne 828) et dans celles de BITUME et Point de rupture.

**Preuve corrigée.** alt.mjs sous charge : A0 323 µs → A1 90 µs (-72 %), « identical order: true », variante par cellules A3 235 µs. Chrome réel, grid seul : draw() CPU médian 3,2 → 2,4 ms (-25 %) et 2,2 → 1,6 ms (-27 %), image identique. Node alterné, fil principal : ×0,85 (80 % des images plus rapides).

**Gain corrigé.** -15 à -27 % de draw() CPU seul (au lieu de -29 %) ; requête -60 à -72 %.

### RCPU-06 — FEffects.build : débris triés deux fois avec des clés chaîne et des tableaux temporaires
- sévérité moyenne · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité identique · jeu
- lieux : src/effects.js:172-199; src/effects.js:17-18; src/effects.js:183-192

**Preuve.** Code en cause : effects.js:172-199.
- Par débris : every() sur [x,y,z], raw.slice() ou map, point(q), Math.hypot(...s), distance() calculée deux fois (dans fade, ligne 18, puis pour d), et p.reduce pour calculer rear.
- Tri n°1 à 6 clés, qui rappelle num() à chaque comparaison (183-184).
- Set de chaînes rear+'|'+band+'|'+sourceId (188-191).
- Second tri complet (192), puis slice (193).

Mesures (effects-sections.mjs, marqueurs de ligne, 3000 images, 110 à 120 débris structurels par image) :
- Le bloc débris représente 80 % de FEffects.build : scan 32 %, Set 18 %, tri n°1 12 %, slice et solid 11 %, tri n°2 7 %.
- Total : 184-223 µs par image sous charge, 91-109 µs sans charge.

Réécriture prototype (effects-ab.mjs) :
- Sorties identiques (isDeepStrictEqual) sur 3000 images sur 3000, sur camp:17 comme sur camp:6.
- Moyenne : de 0,169 à 0,101 ms (-40 %) et de 0,195 à 0,121 ms (-38 %).
- En ordre d'exécution alterné et sous forte charge : de 0,295 à 0,198 ms (-33 %), p99 de 1,15 à 0,74 ms.

**Cause.** Tout est recalculé à chaque image avec des structures temporaires et deux tris complets, alors que seuls debrisBudget débris au plus sont émis (18, 38 ou 60).

**Proposition.** Reprendre la version prototypée de bench/rcpu/effects-ab.mjs :
- Champs scalaires et une seule distance.
- id numérique précalculé et un seul tri : structural décroissant, puis rear, band, score, id.
- Ensuite, partition stable par groupe (structural, rear, band) : le premier morceau de chaque sourceId d'abord, puis les répétitions. Elle remplace le Set de chaînes et le tri n°2.
- Arrêt dès que debrisBudget est atteint.
- p, s et r ne sont alloués que pour les débris émis.
Étape suivante possible : ne recalculer la sélection que si l'œil bouge de plus de 2 m ou si state.debris change.

**Gain attendu.** -33 à -40 % sur FEffects.build, soit environ -40 à -100 µs par image sur M5 selon la charge. Sortie identique.

**Risques.** Rendu seul : FEffects n'est consommé que par game.js:420 et 722.
Sélection prouvée identique image par image.
Garder le repli num(q.id,num(q.seed)) et la stabilité du tri.
Relancer checks/effects.test.mjs.
Taille : environ +0,3 KB.

**Vérifier par.** node bench/rcpu/effects-ab.mjs <ferro> 3000 camp:17 (« identical outputs 3000 / 3000 » et temps), puis npm test.

**Contre-vérification.** Code relu : effects.js:172-199 (deux tris complets, Set de chaînes, tableaux temporaires par débris). Script effects-ab.mjs relu puis rejoué ; il alterne bien l'ordre d'exécution. L'équivalence tient au raisonnement : le premier tri range par (structural, rear, band, score, id) ; la partition stable par groupe (premier morceau de chaque sourceId, puis répétitions) reproduit exactement le second tri sur repeat. Gain absolu faible : 40 à 100 µs par image sur M5. effects.js n'est pas dans FERRO v0.2, donc destination METAL. Effort S, sans risque.

**Preuve corrigée.** Rejeu sous charge (camp:17, 1200 images) : sorties identiques 1200 sur 1200 (isDeepStrictEqual) ; p50 0,272 → 0,186 ms (-32 %), p95 1,17 → 0,68 ms.

**Gain corrigé.** -32 à -40 % sur FEffects.build, sortie identique.

### RCPU-07 — Pickups et butin modélisés sans culling de vue : seule la distance compte
- sévérité moyenne · catégorie perf-cpu · effort S · gain estimé
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur et jeu
- lieux : src/game.js:452; src/game.js:379-417; src/game.js:427; src/motion.js:15-26

**Preuve.** Code en cause : game.js:452.
`for(const c of [...s.pickups,...(s.loot||[])])if(supplyVisible(c)&&nearby(c.x,c.z))supplyModel(out,c,t);`
Les ennemis passent par actorVisible (game.js:427 et 436), pas les pickups.

Mesures :
- pickups.mjs, 3000 images : 21,8 (camp:17), 38,3 (camp:6) et 25,9 (legacy:2) pickups modélisés par image. renderer.actorFilter (caméra et volumes d'ombre, r=1,6 m) n'en garderait que 50-60 %.
- bench-models : la section 452 coûte 56-98 µs par image pour 159-284 meshes. Sur camp:6, cela fait 284 des 585 meshes dynamiques environ.
- supplyModel (379-417) appelle FMotion.mount et place (motion.js:15-26), qui allouent via map : place pèse 206 KB par image, deuxième allocateur du rendu.

**Cause.** Le filtre conservateur actorFilter existe déjà mais ne sert qu'aux ennemis. Chaque pickup reconstruit ses pièces avec des opérations vectorielles qui allouent.

**Proposition.** (1) Avant supplyModel : `if(!actorVisible(c.x,(c.y||0)+.5,c.z,R[kind]))continue;`. R vaut 1,6 m par défaut, avec un rayon mesuré par type de modèle (salvage et boss sont plus grands).
(2) FMotion.place et mount sans allocation : écrire dans des vecteurs scratch, ou précalculer par type les pièces en repère local et ne calculer par image que la pose (lacet t·0,3 + x·0,1).
(3) Les meshes retirés sortent aussi du lot dynamique, qui est dessiné dans la vue et dans les 3 passes d'ombre.

**Gain attendu.** -40 à -50 % de pickups modélisés (mesuré).
Environ -25 à -50 µs par image sur models().
60 à 140 meshes dynamiques de moins à paquer et uploader (environ 4-9 KB par image) puis à dessiner dans 4 passes (estimé).

**Risques.** actorFilter inclut les volumes d'ombre : pas de perte d'ombre visible tant que le rayon couvre le modèle, à vérifier type par type.
check/actor-visibility.test.mjs couvre actorFilter ; ajouter un test « un pickup derrière la caméra n'est pas modélisé ».
Rendu seul. Taille : environ +0,1 KB.

**Vérifier par.** node bench/rcpu/pickups.mjs <ferro> 3000 camp:6, puis node bench/rcpu/bench-models.mjs <ferro> 3000 camp:6 auto pour la section 452 avant et après.

**Contre-vérification.** Code relu : game.js:452 (pickups filtrés par supplyVisible et la distance seulement), 427 et 436 (actorVisible réservé aux ennemis), supplyModel 379-417, motion.js:15-26 (mount et place allouent par map). Comptage rejoué. Le script approxime supplyVisible par c.taken, donc le nombre modélisé est légèrement surestimé ; la proportion reste valable. Rayon vérifié à la lecture : centré en y+0,5, le modèle le plus étendu (coffre de boss avec arme exposée et anneaux latéraux) tient dans environ 1,2 m, donc 1,6 m couvre tous les types. actorFilter inclut les volumes d'ombre : image et ombres identiques. Les pickups pèsent 159 à 284 des 500 à 585 meshes dynamiques, chacun dessiné dans 4 passes. Le gain en temps n'a pas été remesuré (estimé). Répartition : filtre dans game.js pour METAL ; mount et place sans allocation dans motion.js pour FERRO.

**Preuve corrigée.** pickups.mjs rejoué (camp:6, 1200 images) : 32,8 pickups modélisés par image, 17,8 gardés par actorFilter (54 %), soit -46 %.

**Gain corrigé.** -46 % de pickups modélisés (mesuré) ; gain en temps estimé, non remesuré.

### RCPU-08 — Gouverneur de résolution : seuils absolus en ms, qui oscillent sous vsync 60 Hz, ne réagissent pas à 120 Hz ou en VRR, et réallouent les cibles à chaque palier
- sévérité moyenne · catégorie saccade · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur (dans METAL)
- lieux : src/renderer.js:746-764; src/renderer.js:1535; src/renderer.js:1384-1393; src/renderer.js:1318-1336; src/game.js:677

**Preuve.** Fonctionnement actuel :
- renderer.js:746-764 calcule une moyenne exponentielle de frameMs, qui est le delta rAF (game.js:677).
- Lent : plus de 25 ms pendant 1,3 s, l'échelle baisse de 0,1. Rapide : moins de 18,5 ms pendant 5 s, elle monte de 0,05. Cooldown de 2 s, plancher à 0,65.
- renderer.js:1535 applique autoScale puis resize() ; les lignes 1384-1393 changent canvas.width et canvas.height.
- ensureTargets (1318-1336) prend width×height comme clé : à chaque nouvelle taille, freePost() puis recréation de la cible de scène et des 2 cibles de bloom.

Simulation (gov.mjs, gouverneur réel, temps GPU = T1·scale², présentation quantifiée, 60 s par profil) :
- vsync 60 Hz, T1 de 19 à 30 ms : 10 à 11 changements d'échelle par minute, 53,5-56,8 fps, 6-12 % d'images en retard.
- vsync 120 Hz, T1 de 19 à 24 ms : 40 fps stables à l'échelle 1, sans aucune réaction (25,0 ms n'est pas supérieur à 25).
- VRR, T1 de 22 à 24 ms : 42-46 fps sans réaction.
- Chaque changement réalloue une cible de 1789×1006 (au moins 7 Mo en couleur, plus la profondeur), 2 cibles au quart, et le backbuffer.

**Cause.** Les seuils sont des millisecondes absolues, pas des fractions de la période de rafraîchissement. Sous vsync, frameMs saute entre 16,7 et 33,3 ms. Le gouverneur ne retient pas l'échelle qui a échoué, et une nouvelle résolution se paie par une réallocation des cibles.

**Proposition.** (1) Période de rafraîchissement : médiane des 10 % de deltas rAF les plus petits sur 2 s, bornée à 6,9-16,7 ms.
(2) Critère lent : plus de 20 % d'images au-delà de 1,5 période sur une fenêtre d'1 s. Critère rapide : 95e centile sous 0,8 période pendant 5 s.
(3) Plafond collant : retenir l'échelle à laquelle la baisse a eu lieu, et ne remonter au-dessus qu'après 30 s, puis 60 s, puis 120 s.
(4) Cibles à taille fixe : allouer une fois scène et bloom pour l'échelle 1, puis rendre dans un sous-viewport (gl.viewport et facteur d'UV à la composition). L'échelle dynamique ne touche plus canvas.width.

**Gain attendu.** Plus de 10-11 réallocations par minute ni des à-coups associés sous vsync 60 Hz. Réaction à 40-46 fps sur écran 120 Hz ou VRR. La politique actuelle est mesurée par simulation ; le gain réel est estimé.

**Risques.** checks/renderer-destruction.test.mjs:49-53 attend scale<1 après 65 images à 50 ms : borner la période estimée à 16,7 ms au plus pour que ce cas reste « lent ».
Un plafond trop collant garde une résolution basse : il doit être remis à zéro au changement de qualité (governor.reset existe déjà en 1360, 1369 et 1384).
Sous-viewport : borner les UV du bloom.
Rendu seul. Taille : environ +0,8 KB.

**Vérifier par.** node bench/rcpu/gov.mjs <ferro> avant et après : échelle finale, fps, pourcentage de retard et nombre de changements par profil T1 et vsync. Puis une trace Chrome sur un écran 120 Hz.

**Contre-vérification.** Code relu : renderer.js:746-764 (seuils absolus 25 et 18,5 ms, sans mémoire), 1318-1336 (cibles recréées à chaque nouvelle taille), game.js:677 et 722. gov.mjs relu puis rejoué : le modèle est déterministe et redonne exactement les chiffres annoncés. Deux ajouts. (1) À 120 Hz avec un GPU plus lent (T1 de 26 à 40 ms), le gouverneur descend à 0,85-0,65 alors que la cadence reste à 40 images par seconde : la résolution est perdue pour rien. (2) Quand c'est le CPU qui limite, mon rejeu du vrai gouverneur descend à 0,65 (42 % des pixels) en 12 s et n'en remonte pas ; c'est le constat LOOP-12. RCPU-08, RGPU-09 et LOOP-12 décrivent le même défaut : à fusionner en un seul chantier. Non prouvé : le coût réel d'une réallocation des cibles (estimé, aucune mesure). Sous-viewport : borner les UV du bloom et de la composition pour ne pas lire hors de la zone rendue. Le test concerné est à la ligne 51 de checks/renderer-destruction.test.mjs.

**Preuve corrigée.** gov.mjs rejoué : vsync 60 Hz, T1 de 19 à 30 ms : 10 à 11 changements par minute, 53,5 à 56,8 images par seconde ; vsync 120 Hz, T1 de 19 à 24 ms : 40 images par seconde sans réaction ; T1 de 26 à 40 ms : échelle 0,85 à 0,65, toujours 40 images par seconde. bench/rcpu-verif2/v-gov-cpu.mjs : 28 ms de CPU constant, ou un pic de 120 ms toutes les 0,5 s, mènent à l'échelle 0,65 en 12,2 s.

**Gain corrigé.** Politique actuelle confirmée par rejeu ; gain de la nouvelle politique estimé, à prouver sur écran 120 Hz.

### RCPU-09 — Repli Canvas2D : 7,8 ms de JS par image sur M5 (p99 19 ms), surtout dans shade, collect, maskGround et le tri
- sévérité moyenne · catégorie perf-cpu · effort L · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1124-1168; src/renderer.js:1027-1045; src/renderer.js:1179-1207; src/renderer.js:1209-1214; src/renderer.js:897-911

**Preuve.** Mesures (bench-canvas.mjs, contexte 2D factice à compteurs, 1024×576, tour) :
- setWorld 9,6 ms ; première image 48,2 ms.
- draw : moyenne 7,8 ms, p95 15,6, p99 19,2, max 30,6 ms.
- 21,1 K appels ctx par image (p99 47,9 K).
- Images de destruction : updateWorld 3,6-5,3 ms, plus un draw de 4,6-18,6 ms.

Profil in-process (prof-canvas.mjs, 600 images, parts du draw inclusif) :
- paint : 60 %.
- shade (1124-1168) : 22 %. lit.map, subtract, Math.hypot(...toEye), puis 'rgb('+rgb.join(',')+')' pour chaque face.
- collect (1031-1045) : 20 %. map, every et some sur chaque sommet et chaque face.
- maskGround (1180-1207) : 12 %. Boucle receivers × items, points.map, Math.min(...).
- Tri du painter, ligne 1210 : 10 %, avec dot() dans le comparateur.
- cache() (897-911) : 11 %, pour les meshes dynamiques re-transformés.
- polygonPath (1179) : 8 %, à cause de moveTo(...p) en spread.
- GC : environ 1 ms par image.

**Cause.** Le repli fait tout le pipeline en JS, face par face : transformation, clipping, éclairage, tri et masquage, avec du code fonctionnel qui alloue. C'est le chemin des appareils sans WebGL2, donc des plus faibles.

**Proposition.** (1) Sans changer l'image :
- polygonPath et line sans spread : moveTo(p[0],p[1]).
- shade avec trois scalaires r, g, b, et la chaîne de couleur mémoïsée dans une Map de clé (r<<16|g<<8|b).
- collect avec des boucles indexées et des tampons de sommets réutilisés.
- maskGround : ranger les boîtes des receivers dans une grille écran, et calculer min et max en boucle.
- Comparateur de tri sur des clés précalculées (drapeau sol, plan), en gardant exactement la même relation.
(2) Budget par qualité : plafond de faces dessinées par image (par exemple 6 K en low), avec coupure par distance, pour borner le p99.
Vérifier l'identité en comparant le flux d'appels ctx sur 300 images.

**Gain attendu.** Environ -25 à -40 % du JS du repli (estimé d'après les parts du profil) ; p99 borné par le budget de faces.

**Risques.** AGENTS.md impose le repli Canvas2D : garder la parité visuelle.
Le comparateur actuel n'est pas transitif (cas sol coplanaire contre profondeur). Toute modification du tri doit reproduire exactement la même relation et le même ordre d'entrée, sinon l'ordre de peinture change.
check/renderer-destruction.test.mjs:145 exige plus de 30 triangles en Canvas.
Rendu seul. Taille : environ +1 KB.

**Vérifier par.** node bench/rcpu/bench-canvas.mjs <ferro> 900 camp:6 auto et node bench/rcpu/prof-canvas.mjs <ferro> 600 camp:6, avant et après. Puis comparaison du flux d'appels ctx image par image.

**Contre-vérification.** Code relu et conforme : collect 1031-1045 (map, every, some par face), shade 1124, polygonPath 1179 (spread), tri 1210. Non rejoué. Deux réserves. (1) Le banc utilise un contexte 2D factice : il ne mesure pas la rastérisation des quelque 21 000 tracés par image, qui domine dans un vrai navigateur. Le gain de -25 à -40 % porte sur le JS seul, pas sur l'image complète. (2) Le point 2 (plafond de faces par qualité avec coupure par distance) retire de la géométrie : c'est une perte de qualité, à écarter ou à mettre en option désactivée par défaut. Qualité identique seulement pour le point 1, à prouver par comparaison du flux d'appels ctx. Chemin de secours rare (appareils sans WebGL2).

**Gain corrigé.** -25 à -40 % du JS du repli (estimé) ; gain sur l'image complète inférieur, non mesuré.

### RCPU-10 — Appels GL : 4 vertexAttribPointer par groupe (la moitié des appels), et lot dynamique complet redessiné dans chaque passe d'ombre
- sévérité basse · catégorie perf-cpu · effort M · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1397-1406; src/renderer.js:1422-1438; src/renderer.js:1440-1459; src/renderer.js:1555-1556; src/renderer.js:1564

**Preuve.** Code en cause :
- renderBatch, renderer.js:1401-1402 : 4 vertexAttribPointer par groupe et par passe.
- shadowPass (1438) et sunShadowPass (1440-1459) redessinent tout dynamicBatch, c'est-à-dire tous les meshes ordinaires (1555-1556).

Mesures (glcalls.mjs, tour) :
- 403-440 appels GL par image, dont 202-231 vertexAttribPointer (50-52 %).
- 54,6-61,7 draws, 4 522-5 953 instances et 193-221 K triangles par image.
- Avec 497-585 meshes dynamiques et 3 passes d'ombre, environ 1 490 à 1 755 instances par image (25-39 % du total) sont du dynamique redessiné dans les ombres. Cela inclut des meshes hors de la portée de 32 m de la lumière et des meshes émissifs.

**Cause.** Les pointeurs d'attributs d'instance dépendent du décalage du groupe dans un tampon qu'on reconstruit, donc ils sont ré-émis à chaque groupe. Le lot dynamique n'est pas séparé selon qu'un mesh porte une ombre ou non, ni selon la portée de la lumière.

**Proposition.** (1) Avec les tampons à capacité de RCPU-04 :
- Réserver une région fixe par forme (7 formes).
- Créer une fois un VAO par couple (tampon, forme).
- Par groupe, un seul bindVertexArray remplace les 4 vertexAttribPointer.
(2) Paquer le dynamique en deux sous-lots : les porteurs d'ombre (hors émissifs purs et débris de moins de 0,15 m), puis le reste. Les passes d'ombre ne dessinent que le premier.
Option : rejet par groupe selon la distance à la lumière.

**Gain attendu.** Environ -40 % d'appels GL (160 à 180 de moins par image), soit environ 0,1-0,2 ms par image sur desktop et 0,4-1 ms sur mobile selon le coût de validation WebGL.
-25 à -39 % d'instances dans les passes d'ombre, selon la part de meshes qui ne portent pas d'ombre.
Tout cela est estimé.

**Risques.** Ombres : un mesh exclu à tort perd son ombre, d'où une liste explicite des critères d'exclusion.
Le mock GL de checks/renderer-destruction.test.mjs:21 déduit instanceOffset de vertexAttribPointer(2,…) juste avant chaque draw. Avec des VAO, il faut le réécrire.
Rendu seul. Taille : environ +0,7 KB.

**Vérifier par.** node bench/rcpu/glcalls.mjs <ferro> avant et après (appels et instances par image), puis une trace GPU Chrome en file:// local.

**Contre-vérification.** Code relu et conforme : 4 vertexAttribPointer par groupe en 1401-1402, lot dynamique redessiné dans chaque passe d'ombre (1438, 1458). Le mock du test lit bien instanceOffset sur vertexAttribPointer(2,…) à la ligne 22. Gains estimés, non prouvés. Borne haute observée : dans Chrome réel, tout le prototype laisse draw() à 0,6 ms médian pour environ 440 appels GL, donc les VAO ne peuvent rendre que 0,1 à 0,3 ms sur M5 sous charge. Réserve de qualité : exclure des passes d'ombre les émissifs et les débris de moins de 0,15 m supprime des ombres réelles. Cette partie est à écarter ; seul un rejet par volume de lumière (portée de 32 m, boîte du soleil) garde l'image identique, et il demande des listes par passe dont le coût CPU peut annuler le gain. Qualité identique seulement pour le point 1 (VAO).

**Gain corrigé.** Au plus 0,1 à 0,3 ms par image sur M5 pour les VAO (borne déduite, non mesurée) ; partie ombres à écarter telle qu'écrite.

### RCPU-11 — FActors.build : environ 250 ns par primitive, avec matrices et tableaux alloués à chaque appel, sans aucune réutilisation
- sévérité basse · catégorie perf-cpu · effort M · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité identique · jeu
- lieux : src/actors.js:8-15; src/actors.js:16-23; src/actors.js:39; src/actors.js:48; src/game.js:436-438

**Preuve.** Code en cause :
- actors.js:8-15 : rotation, product et angles créent des tableaux ; piece (39) et limb (48) aussi.
- LOD à la ligne 23 : seuils near 11 et far 35 en WebGL (7 et 26 en low), appliqués à distance/échelle.

Mesures (actors-cost.mjs) :
- 191 à 362 ns par mesh.
- Machines de type 0 à 3 : 49-69 meshes au LOD0 (10-16 µs), 15-16 au LOD1 (3,6-4,8 µs), 6 au LOD2 (1,2-2,2 µs).
- Colosses (colossus, siegebreaker, custodian) : 111-112 meshes au LOD0 (24-33 µs par appel), 34-35 au LOD1 (7-11 µs), 14 au LOD2 (environ 3 µs).
- Un boss à l'échelle 6 ou 9 reste au LOD0 jusqu'à 66 ou 99 m. C'est cohérent avec sa taille à l'écran.
- Tour : actors.build coûte 37-52 µs par image (4 à 7,5 appels).
- Tas : build 39 KB, limb 30 KB, piece 11 KB et cyl 10 KB, soit environ 90 KB par image.

**Cause.** Le squelette est reconstruit entièrement à chaque image, avec des tableaux neufs pour chaque matrice, chaque point et chaque pièce.

**Proposition.** Matrices scratch (Float64Array(9)), avec les produits écrits en place.
Pool d'objets mesh par ennemi, réutilisé d'une image à l'autre : pack en fait une copie et rien n'est retenu.
Au LOD2, au-delà de 35 m, pose mise à jour une image sur deux (phase quantifiée).

**Gain attendu.** Environ -30 à -40 % sur FActors.build : environ -15 à -20 µs par image en tour, et -40 à -60 µs en combat de boss avec des adds. Environ -90 KB par image. Tout cela est estimé.

**Risques.** Pool : vérifier qu'aucun consommateur ne garde les meshes d'une image à l'autre (overlay, actorPart, et les tests checks/actor-*.test.mjs qui inspectent les pièces).
Mise à jour à demi-fréquence : la réserver au LOD2, pour éviter un saut visible.
FActors n'est utilisé que par game.js pour le rendu : pas d'effet sur la simulation. Taille neutre.

**Vérifier par.** node bench/rcpu/actors-cost.mjs <ferro> (ns par mesh, par type et par LOD) et bench-models.mjs (section 451), avant et après. Puis npm test.

**Contre-vérification.** Code relu et conforme : actors.js:8-15 (rotation, product, angles, point et frame créent des tableaux à chaque appel), LOD à la ligne 23. Non rejoué. Gain absolu faible (15 à 20 µs par image en tour). Réserve de qualité : mettre la pose à jour une image sur deux au LOD2 est une animation à demi-cadence, donc une perte ; à écarter ou à mettre en option désactivée par défaut. Matrices scratch et pool de meshes : sortie identique, à condition de vérifier qu'aucun consommateur ne garde les meshes d'une image à l'autre. actors.js n'est pas dans FERRO v0.2.

**Gain corrigé.** -30 à -40 % sur FActors.build (estimé), soit 15 à 20 µs par image.

## Constats ajoutés par le contre-vérificateur

### RCPU-V1 — Le cache à marge de RCPU-01 change l'image : ajouter la coupure de portée exacte dans le vertex shader
- sévérité haute · catégorie 3d-visuel · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:723; src/renderer.js:779-786; src/renderer.js:41-43; src/renderer.js:773-776; src/renderer.js:1545-1546; src/renderer.js:1436; src/renderer.js:1454

**Preuve.** Mesure Node (bench/rcpu-verif2/v-cache.mjs, camp:17, 900 images, prototype cache seul) : le sur-ensemble contient en moyenne 15,9 + 13,9 + 4,5 = 34 entrées par image situées dans le frustum exact mais hors de la sélection d'origine, sur 99,2 % des images ; leur distance de surface est de 64,0 à 65,2 m (niveau 0), 32,0 à 33,0 m (niveau 1) et 13,0 à 14,0 m (niveau 2), soit juste au-delà des portées detailRanges [64,32,13] de renderer.js:723. Mesure Chrome réel (bench/rcpu-verif2/out/run1.json, 30 images comparées par readPixels) : cache contre original, écart moyen 0,0055, PSNR 64,5 dB, pire image 0,17 % de pixels à plus de 10/255 ; variantes grid, sun, pool et exact : écart 0, PSNR 99. Le contrôle du premier tour (ab.mjs) ne teste que l'inclusion de la sélection d'origine, pas les objets en trop.

**Cause.** La sélection conservatrice interroge l'index avec portée + D depuis l'œil de reconstruction. Tant qu'elle reste valide, les objets situés entre portée et portée + 2D de l'œil courant sont dessinés ou non selon l'historique de la caméra. Le frustum les coupe sur les côtés, mais rien ne les coupe en distance.

**Proposition.** Refaire sur le GPU le test de distance exact que fait query().
(1) Lignes statiques (spatialIndex, e.row) : ajouter (detail+1)·8 au champ drapeaux row[11]. Les lignes dynamiques gardent 0, qui signifie « jamais coupé ».
(2) VERT, lignes 41-43 : remplacer vObject=floor(iRotation.w*.25) par mod(floor(iRotation.w*.25),2.), puis lire le niveau par floor(iRotation.w*.125).
(3) Nouveaux uniformes uCullCentre (vec3) et uCullRange (vec3), posés par passe : œil et ranges pour la vue ; position de la lampe ou de la torche et [32,18,0] ; centre du soleil et [extent+24,26,0]. VERT sert aussi au programme de profondeur.
(4) Dans VERT : si le niveau est au moins 1 et distance(uCullCentre, iPosition.xyz) > uCullRange[niveau-1] + 0,5·length(iScale.xyz), écrire gl_Position=vec4(2.,2.,2.,1.) pour sortir l'instance du volume de découpe.
(5) Garder la sélection CPU inchangée par rapport à RCPU-01.
Critère d'acceptation : PSNR 99 et écart 0 contre l'original sur le banc Chrome, sauf arrondi float32 à la frontière de portée.

**Gain attendu.** Rend RCPU-01 conforme à l'exigence « sans perdre la moindre qualité » : image identique à l'original tout en gardant -69 % de draw() CPU (Chrome réel). Coût : une distance et un length par sommet, négligeable.

**Risques.** Le fragment shader lit vObject : vérifier chaque usage après le passage au modulo.
Arrondi float32 contre float64 à la frontière : au pire un objet apparaît une image plus tôt ou plus tard.
Pas d'effet sur le déterminisme ni sur les sauvegardes.
Taille : environ +0,3 KB.
Compatibilité FERRO : les lignes dynamiques et les jeux qui ne posent pas de niveau de détail gardent 0 et ne sont jamais coupés ; uCullRange doit valoir une grande valeur par défaut.
Repli Canvas 2D non concerné.

**Vérifier par.** Regénérer la page avec node bench/rcpu-verif/chrome-gen.mjs et une variante cache+clip, la lancer comme bench/rcpu-verif2/out/run1.html (Chrome sans interface, file://), et lire diffs : PSNR 99 attendu. Puis node bench/rcpu-verif2/v-cache.mjs <metal> 900 camp:17 auto cache : la ligne « extras INSIDE exact frustum » reste un compte CPU ; le critère d'image est la différence de pixels.

### RCPU-V2 — Marges fixes D = 1 m et θ = 8° du cache : calées sur METAL, à rendre adaptatives pour FERRO (BITUME à 80 m/s, FOV de 10°)
- sévérité moyenne · catégorie architecture · effort S · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1545-1546; src/renderer.js:1436; src/renderer.js:1454; ferro_renderer_248043a.js:5; ferro_renderer_248043a.js:1708

**Preuve.** Mesures Node alternées (bench/rcpu-verif2/v-cache.mjs et v-ab2.mjs, prototype cache seul). Tour METAL à 7 m/s et 69°/s : reconstruction sur 12,6 % des images, CPU ×0,23. Rotation rapide (387°/s en crête) : reconstruction sur 45,3 % des images, CPU ×0,49. Déplacement à 80 m/s (1,33 m par image, au-delà de D) : reconstruction sur 60 % des images, upload 140 KB au lieu de 52, CPU ×0,62. Chaque reconstruction paque 1,30 fois plus d'entrées que l'original. La copie FERRO 248043a du renderer déclare FOV_MIN = 10 pour la caméra au téléobjectif de BITUME (ligne 5) et accepte camera.far (ligne 1708) : avec une demi-diagonale d'environ 10°, θ = 8° double presque l'angle du cône.

**Cause.** Les marges proposées au premier tour sont des constantes choisies sur un seul jeu, à la vitesse d'un piéton. FERRO doit servir une course à 300 km/h et un RTS sans réglage.

**Proposition.** Marges recalculées à chaque reconstruction, bornées :
- D = clamp(vitesse lissée de l'œil × 0,15 s, 1 m, 16 m).
- θ = clamp(vitesse angulaire lissée × 0,10 s, 4°, 12°), plafonné à 0,5 × demi-diagonale du champ.
- Soleil : M = clamp(2·D, 4 m, 16 m).
- Lissage exponentiel des vitesses sur 0,25 s ; aucune marge ne rétrécit tant que la sélection en cours est valide.
API : FRender.create(canvas,{cullMargin:'auto'}) par défaut ; {cullMargin:{distance,angle}} pour fixer ; {cullMargin:0} pour retrouver le culling exact par image. Avec RCPU-V1, l'image est identique quelle que soit la marge.

**Gain attendu.** Garder un taux de reconstruction voisin de 10 à 15 % aux vitesses de BITUME, au lieu de 60 % mesurés à 80 m/s avec D = 1 m. Estimé : la variante adaptative n'a pas été prototypée.

**Risques.** Plus la marge est grande, plus le GPU reçoit d'instances hors champ : plafonner et mesurer sur le banc Chrome.
Rendu seul : ni déterminisme ni sauvegardes.
Compatibilité ascendante : valeur par défaut sans réglage, option pour désactiver.
Taille : environ +0,3 KB.

**Vérifier par.** node bench/rcpu-verif2/v-ab2.mjs <metal> 300 camp:17 auto cache 45 80 et la même commande avec sweep 8 : taux « rebuilds per frame » et rapport CPU avant et après. Puis le même banc sur une trace de caméra de BITUME.

### RCPU-V3 — Aucun critère d'image dans les bancs RCPU : intégrer à FERRO le banc Chrome à variantes en rotation avec différence de pixels
- sévérité moyenne · catégorie outillage · effort M · gain qualitatif
- ajouté par le contre-vérificateur (non recontrôlé) · qualité sans objet · moteur (dans METAL)
- lieux : bench/rcpu/ab.mjs; bench/rcpu-verif/chrome-gen.mjs; bench/rgpu/pre.js; bench/rgpu/post.js; bench/rcpu-verif2/out/run1.json

**Preuve.** Le banc du premier tour (bench/rcpu/ab.mjs) tourne sur un WebGL factice : il compte les appels mais ne produit aucune image, et il dessine toujours l'original puis le prototype dans cet ordre, sans alternance. Il a validé RCPU-01 comme sans perte alors que la page Chrome donne PSNR 64,5 dB pour le cache et PSNR 99 pour grid, sun et pool. Les gains isolés varient selon le banc : grid -29 % dans ab.mjs, -15 % en Node alterné, -25 à -27 % dans Chrome ; sun -11 %, -2,5 % et -12 à -14 %. Seul le lot grid+sun+pool est stable : -45 à -47 % dans Chrome (3 exécutions) et -46 % en Node alterné. La page générée par bench/rcpu-verif/chrome-gen.mjs avec bench/rgpu/pre.js et post.js fait tourner l'ordre des variantes à chaque image, synchronise le GPU par readPixels 1×1 et compare les images par readPixels plein cadre ; une exécution de 780 images et 7 variantes prend environ une minute.

**Cause.** Les optimisations de rendu ont été jugées sur des listes d'instances et sur un faux contexte, pas sur des pixels ni sur de vrais appels GL.

**Proposition.** Ajouter à FERRO un outil tools/bench-render (hors budget de la page de jeu) :
- Il génère une page file:// autonome, sans serveur ni port, qui charge le renderer de référence et N variantes.
- Il rejoue une trace de caméra et une liste dynamique enregistrées, avec rotation de l'ordre des variantes à chaque image.
- Il sort, par variante : draw() CPU médian et p90, temps total après synchronisation GPU, instances, triangles, octets envoyés, et la différence d'images (écart moyen, part des pixels à plus de 3, 10 et 25, PSNR).
Règle d'acceptation pour tout changement annoncé « identique » : écart 0 sur toutes les images comparées. Pour « visuellement identique » : PSNR au moins 60 dB et moins de 0,1 % de pixels à plus de 10/255, chiffres écrits dans le message de commit.
Garder les bancs Node pour les comptages, avec ordre alterné et temps CPU du fil principal (process.threadCpuUsage).

**Gain attendu.** Chaque optimisation du moteur est prouvée sur l'image et sur de vrais appels GL avant d'être reprise par BITUME et Point de rupture. Le défaut d'image de RCPU-01 aurait été vu au premier tour.

**Risques.** Chrome sans interface requis sur la machine de build ; ne pas en faire un test bloquant de npm test.
Les temps restent relatifs sous charge : comparer des variantes dans une même exécution uniquement.
Aucun effet sur le jeu, la taille de la page ni AGENTS.md (outil hors build).

**Vérifier par.** Lancer l'outil sur METAL 673d6b2 avec les variantes base, exact (grid+sun+pool) et cache : retrouver PSNR 99 pour exact, environ 64,5 dB pour cache, et un draw() CPU médian en baisse d'environ 45 % et 69 %.
