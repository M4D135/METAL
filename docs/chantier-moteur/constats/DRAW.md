# Axe DRAW — DRAW — soumission au GPU et visibilité, sans perte de qualité (renderer de FERRO v0.2, jeu METAL 0.8)

Origine : second tour. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Le levier le plus net de cet axe est de dessiner l'arme en premier avec un masque stencil : −0,60 ms GPU par image (−7,5 %) sur M5, image identique bit à bit sur 47 images sur 47. À l'inverse, le volume d'appels GL ne vaut presque rien : VAO, UBO et filtrage d'états ne sont pas des leviers de performance mesurables.

**Incident à connaître.** Le dossier ~/Projects/ferro a disparu pendant l'audit (présent et lu en entier vers 18 h 35–18 h 40, absent à 18 h 44 et encore à 19 h 10). Je n'y ai rien écrit. La suite a tourné sur la copie src/renderer.js (variante FERRO 0.2) (120 863 octets, même taille et mêmes lignes que le fichier lu dans le dépôt), recopiée dans mon dossier de banc.

**Conditions.** Apple M5, Chrome sans interface (ANGLE Metal), 1440×932 CSS à DPR 2, qualité auto (1668×1079). Charge moyenne de la machine entre 27 et 138 : seuls les écarts appariés comptent. Le contrôle A/A donne −0,05 ms [−0,30 ; +0,10]. Rien n'a pu être mesuré sur NVIDIA ou D3D11 ; ce qui les concerne est marqué « estimé », avec la page de banc à lancer sur david-pc.

**Ce qui gagne, preuves à l'appui**
- **Arme d'abord + stencil (DRAW-01)** : le gain ci-dessus. Aujourd'hui l'arme est dessinée en dernier après un gl.clear(DEPTH) en pleine passe, et les 8,6 % d'écran qu'elle couvre sont ombrés puis écrasés.
- **Ordre de dessin (DRAW-02)** : le surdessin opaque passe de 1,79–2,19 à 1,40–1,41 fragment par pixel couvert avec l'ordre arme, dynamiques, statiques en 4 bandes de distance. Cela fait −22 à −37 % de fragments ombrés par pixel d'écran sur un GPU à rendu immédiat. Sur M5 (tuiles), aucun gain de temps, comme attendu.
- **Bandes de couleur (DRAW-06)** : 3 192 bords de bande par mégapixel aujourd'hui, 1,1 avec une cible RGB10_A2 et un tramage d'un demi-pas, sans coût mesurable.
- **Projeteurs du soleil (DRAW-05)** : −21 à −36 % d'instances par image et −28 à −46 % d'octets envoyés, 48 images identiques sur 49.
- **Sommets partagés (DRAW-11)** : 2 328 sommets ramenés à 597, image identique sur 49 images sur 49.

**Ce que la mesure réfute ou relativise**
- **Appels GL (DRAW-04)** : 409 à 454 par image, mais environ 30 µs de fil principal en tout. Un bindVertexArray coûte autant que 4 vertexAttribPointer côté processus GPU. Cela corrige l'estimation de RCPU-10 d'un facteur 10 environ.
- **Plages par cellule** : 53 à 121 plages pour la seule vue, soit 5 à 20 fois plus de draws, sans extension d'instance de base. Je propose à la place une table d'instances en texture et des listes d'indices (DRAW-03, non prototypée).
- **Pré-passe de profondeur** : +0,70 ms GPU et image non identique (0,36 % des pixels, 0 image identique sur 13).
- **Flou vertical du bloom au quart** : non identique (écart maximal de 6 niveaux).
- **invalidateFramebuffer et depth:false** : image identique, aucun gain de temps mesurable sur M5.
- **Variantes de shader par matière** : les matières émissives ne couvrent que 0,3 % de l'écran.
- **Occlusion** : 66 à 70 % des instances statiques dessinées n'ont aucun pixel visible, mais leur coût se compte en sommets, pas en pixels.
- **Cache d'ombres statiques** : au plus 0,25 ms GPU sur M5.

Tout le banc est dans bancs/draw/. Les numéros de ligne sont donnés sous la forme FERRO 248043a / METAL 673d6b2.

## Mesures

- **Appels GL par image, par fonction (renderer FERRO v0.2, jeu METAL, scénario « tour », 600 images après 120 de chauffe)** : 409 à 454 appels par image (camp:6 421 ; camp:17 446 ; legacy:2 409 ; camp:17 haute 454). vertexAttribPointer 219–242 (52–53 %) ; drawElementsInstanced 55–60 ; uniform* 49–56 dont 25–31 redondants ; enable 14–15 dont 6 redondants ; bindBuffer 11–12 ; useProgram 7–9 dont 2 ; bindFramebuffer 8 dont 3 ; viewport 7 dont 1 ; bufferData 5,6–6,6 ; bindVertexArray 6 dont 2 ; bindTexture 5 dont 3 ; polygonOffset 3 dont 3 ; blendFunc 0,65–1,65 tous redondants. Total redondant : 46–52 par image (11–12 %). _(méthode : glstat.mjs sur h.mjs : WebGL2 factice qui suit l'état (programme, VAO, FBO, tampon, texture, capacités, valeur de chaque uniforme, pointeurs d'attribut par VAO) et classe redondant tout appel qui repose une valeur déjà en place. Domaine principal de Node.)_
- **Appels GL par passe (camp:17, auto)** : Ombre lampe 31,7 + 34,1 (dynamique) ; ombre soleil 42,0 + 34,1 ; ombre torche 40,0 + 34,1 : les trois vues d'ombre font environ 218 appels sur 446 (49 %). Uniformes de scène 28 (21 uniform*, dont 14 redondants) ; ciel 17 (dont 6) ; statique 32 ; dynamique 33 ; arme 26 ; particules 60 (1,65 passe par image) ; post 28 (dont 4). _(méthode : Marqueurs de passe posés par ancre de texte dans une copie en mémoire du renderer (h.mjs, fonction instrument).)_
- **Triangles et octets envoyés par passe** : Triangles par image : 180 000 à 239 000. Le lot dynamique (344–464 instances, 22 700–30 300 triangles) est redessiné dans les 3 vues d'ombre : 68 000–91 000 triangles, soit 38–43 % du total. Octets envoyés : 220–306 Ko par image, dont 192–273 Ko de lignes statiques (87–89 %) : soleil 104–137 Ko, vue 60–112 Ko, torche 23–27 Ko, lampe 0,2 Ko. Dynamique 21–29 Ko, arme 3 Ko, particules moins de 1 Ko. _(méthode : glstat.mjs, compteurs par passe du WebGL2 factice.)_
- **Coût réel d'un appel WebGL2 dans Chrome (ANGLE Metal, M5)** : Fil principal : vertexAttribPointer 0,05–0,07 µs ; drawElementsInstanced 0,07–0,10 ; uniform* 0,073–0,079 ; appel d'état redondant 0,033–0,040 ; bindVertexArray 0,03–0,10. Avec l'exécution par le processus GPU : draw 0,9–1,0 µs ; vertexAttribPointer 0,42–0,48 ; bindVertexArray 1,93–1,97 ; uniform* 0,09. Séquence 4 pointeurs + draw : 2,67–2,80 µs ; VAO + draw : 2,87–2,93 µs. 21 uniformes : 1,5–1,7 µs sur le fil principal ; un bloc d'uniformes de 896 octets : 0,20–0,27 µs. bufferData de 100 Ko : au plus 3,3 µs sur le fil principal, environ 10 µs au total ; bufferSubData de 4 Ko : environ 1 µs au total. _(méthode : out/glcost.html, 2 lancements : 9 tours entrelacés de 1 500 à 3 000 itérations (60 à 300 pour les tampons), minimum par test, synchronisation par readPixels. L'horloge de la page a un pas de 0,1 ms : les valeurs des tampons sont grossières.)_
- **Extensions et attributs du contexte** : 36 extensions, dont WEBGL_multi_draw, EXT_clip_control, EXT_depth_clamp, EXT_color_buffer_float, EXT_color_buffer_half_float, EXT_disjoint_timer_query_webgl2, KHR_parallel_shader_compile, WEBGL_debug_shaders. Absentes : WEBGL_draw_instanced_base_vertex_base_instance et WEBGL_multi_draw_instanced_base_vertex_base_instance. Attributs accordés : alpha false, antialias false, depth true, stencil false, powerPreference high-performance. MAX_SAMPLES 8, MAX_VERTEX_TEXTURE_IMAGE_UNITS 16. _(méthode : out/glcost.html (getSupportedExtensions, getContextAttributes, getParameter).)_
- **Arme d'abord : temps GPU apparié** : Monde 17, 100 images × 3 répétitions, base 8,0 ms GPU : masque stencil −0,60 ms [IC95 −0,90 ; −0,45] (−7,5 %) ; variante par tranche de profondeur −0,60 [−0,75 ; −0,40] ; contrôle A/A −0,05 [−0,30 ; +0,10]. Monde 0, 120 images × 2 répétitions : tranche de profondeur −0,50 [−0,70 ; −0,20]. _(méthode : gen2.mjs + run.sh, cfg/C.json et cfg/A.json, puis bench/rgpu/paired.py. Chaque image est rendue par toutes les variantes, ordre tourné, minimum des répétitions, synchronisation par readPixels.)_
- **Identité d'image des variantes (écart par pixel avec la base, toutes les 10 images)** : Identiques bit à bit : masque stencil 47/47 images ; sommets partagés 49/49 ; invalidateFramebuffer 13/13 ; textureLod 13/13 ; depth:false 13/13. Projeteurs du soleil : 48/49, une image avec un écart maximal de 3 niveaux. Arme par tranche de profondeur : 2/13 identiques, 0,01 % des pixels, écart maximal 150. Bandes de distance : 5/11 identiques, écart maximal 44 sur moins de 0,005 % des pixels. Pré-passe de profondeur : 0/13, 0,36 % des pixels, écart maximal 148. Flou vertical du bloom au quart : 4,2 % des pixels, écart maximal 6 (3 images). RGB10_A2 + tramage : écart moyen 0,28 niveau, maximal 2. Tramage à la source : écart moyen 0,25, maximal 2. _(méthode : Lecture readPixels du canvas de chaque variante, comparaison octet par octet (écart moyen, maximal, part de pixels différents, boîte englobante des écarts de plus de 10 niveaux). Runs smoke, A, B0, B6, B17, C.)_
- **Surdessin opaque (fragments ayant passé le test de profondeur, par pixel couvert)** : Ordre actuel, arme comprise : 1,82 (monde 0), 1,79 (monde 6), 2,19 (monde 17) ; monde seul 1,62 / 1,60 / 2,01. Ordre arme, dynamiques, statiques en 4 bandes (8, 18, 34 m) : 1,41 / 1,40 / 1,41. Par pixel d'écran : 1,29 → 1,00 (−23 %), 1,30 → 1,01 (−22 %), 1,60 → 1,01 (−37 %). _(méthode : Variantes overdraw, overdrawworld et overdraworder (mélange additif 1/255 par fragment, sans ciel ni particules), 22 lectures par monde, cfg/B0, B6, B17.)_
- **Temps GPU apparié des autres variantes** : Monde 17 : ordre complet avec stencil −0,65 ms [−0,80 ; −0,50], CPU +0,2 ; bandes seules +0,10 [−0,10 ; +0,30] ; projeteurs du soleil +0,05 [−0,10 ; +0,15], CPU +0,2 ; invalidateFramebuffer +0,10 [−0,20 ; +0,30]. Monde 0 : pré-passe +0,70 [+0,40 ; +0,90] et CPU +0,40 ; ombres sans statiques −0,25 [−0,50 ; 0,00] ; ombres sans dynamiques −0,10 [−0,70 ; +0,15] ; sommets partagés −0,35 [−0,75 ; +0,20] ; depth:false −0,20 [−0,50 ; +0,10] ; RGB10_A2 −0,20 [−0,45 ; 0,00] ; tramage à la source +0,10 [−0,35 ; +0,40] ; textureLod −0,10 [−0,45 ; +0,10]. _(méthode : cfg/C.json et cfg/A.json, paired.py. Les temps des runs B (1 répétition, charge 38 à 138) sont inexploitables et ne sont pas cités.)_
- **Tampon d'identifiants : ce qui est réellement visible** : Écran : statique 47–51 %, dynamique 12–17 %, arme 8,6 %, ciel 28–30 %. Statiques dessinés par image : 867–951 ; avec au moins un pixel : 293–336. Part invisible : 66–70 % en moyenne (54 % au minimum, 99,9 % au maximum). Parmi les visibles : 19–21 couvrent moins de 4 pixels, 71–85 moins de 16, 134–165 moins de 64. Pièces dynamiques visibles : environ 28 sur 200 soumises hors arme. Arme : 23,5 pièces visibles sur 58. Matières à l'écran : 0 (métal) 24–27 %, 1 14–17 %, 8 12–14 %, 9 6–7 %, 11 4–5 %, 3 3,6–4,8 %, 7 1,7 %, émissives 4 à 6 0,3 %. _(méthode : Variante idbuf : identifiant d'instance et matière écrits en couleur, lecture readPixels toutes les 5 images, 22 lectures par monde (cfg/B0, B6, B17).)_
- **Projeteurs du soleil limités au champ de vision** : Instances par image : 4 175 → 3 285 (−21 %, monde 0), 4 114 → 3 131 (−24 %, monde 6), 4 325 → 2 764 (−36 %, monde 17). Triangles −15 %, −16 %, −29 %. Octets envoyés 198,8 → 142,9 Ko, 196,2 → 135,2 Ko, 211,6 → 114,4 Ko (−28 à −46 %). _(méthode : Variante suncull (capsule contre les 4 plans latéraux et le plan de l'œil, marge 0,6 m), compteurs WebGL du harnais, cfg/B*.json.)_
- **Bandes de couleur** : Bords de bande par mégapixel : base 3 192 (13 images, monde 0) ; RGB10_A2 + tramage à la composition 1,1 ; tramage à la source sur RGBA8 4,6. Part de pixels égaux à leur voisin : 0,678 → 0,444. _(méthode : Compteur ajouté par gen2.mjs : le long d'une ligne et d'une colonne sur 4, un palier d'au moins 12 pixels identiques, un saut d'exactement 1 niveau, puis un autre palier d'au moins 12 pixels (canal vert).)_
- **Structure des listes visibles (camp:17, 300 images)** : 17 390 statiques (octa 8 403, box 5 827, cylindre 2 500, feuillage 360, sphère 171, anneau 129), soit 1,11 Mo de lignes. Vue : 3 296 candidats dans la portée, 1 015 visibles (69 % rejetés un par un par le test de champ) ; par niveau de détail 668 / 301 / 47. Plages (cellule, forme) touchées par la vue : 121 en cellules de 8 m, 53 en 16 m, 30,5 en 32 m. Projeteurs : soleil 1 776, torche 458, lampe 339. Indices Uint16 de toutes les listes : 6,5 Ko par image, contre 208 Ko de lignes. _(méthode : vis.mjs : crochets posés dans la copie du renderer (liste shown, projeteurs par passe).)_
- **Partage des sommets de la géométrie** : Sommets émis → uniques : box 36 → 24 ; sphère 864 → 170 ; cylindre 192 → 70 ; anneau 864 → 175 ; feuillage 216 → 38 ; biseau 132 → 96 ; octa 24 → 24. Total 2 328 → 597, tampon de 55,9 Ko → 14,3 Ko. _(méthode : vis.mjs, crochet à la sortie de geometry() : ensemble des couples (position, normale) par forme.)_
- **Premier usage des programmes** : FRender.create (5 programmes, compilation et édition de liens synchrones) : 79–111 ms à froid, 66 ms avec le cache disque de Chrome. Première image : 29–32 ms au total, contre 7–18 ms ensuite. Premier usage de l'arme, des particules, du rendu sans bloom : pas de saut distinct du bruit. _(méthode : out/first.html avec runfresh.sh : 2 profils Chrome neufs, puis un relancement sur le premier.)_
- **Charge de la machine pendant les mesures** : Charge moyenne de 79 au début, 138 pendant le run A, 27 à 38 pendant les runs B, C, glcost et first. _(méthode : uptime avant et après chaque run.)_

## Scripts de banc

- bancs/draw/h.mjs
- bancs/draw/glstat.mjs
- bancs/draw/vis.mjs
- bancs/draw/dpatches.mjs
- bancs/draw/gen2.mjs
- bancs/draw/run.sh
- bancs/draw/runfresh.sh
- bancs/draw/cfg/A.json
- bancs/draw/cfg/B0.json
- bancs/draw/cfg/B6.json
- bancs/draw/cfg/B17.json
- bancs/draw/cfg/C.json
- bancs/draw/cfg/smoke.json
- bancs/draw/out/glcost.html
- bancs/draw/out/first.html
- bancs/draw/ferro-renderer-248043a.js
- bancs/draw/out/A.json
- bancs/draw/out/B0.json
- bancs/draw/out/B6.json
- bancs/draw/out/B17.json
- bancs/draw/out/C.json
- bancs/draw/out/smoke.json
- bancs/draw/out/glcost1.json
- bancs/draw/out/glcost2.json
- bancs/draw/out/first-cold.json
- bancs/draw/out/glstat-camp17.json

## Constats

### DRAW-01 — Arme dessinée en dernier après un gl.clear(DEPTH) en pleine passe : la dessiner d'abord avec un masque stencil
- sévérité haute · catégorie perf-gpu · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1759-1763 (FERRO) / 1579-1583 (METAL); src/renderer.js:1741 (FERRO) / 1567 (METAL); src/renderer.js:1393 (FERRO) / 1312 (METAL); src/renderer.js:1400-1409 (FERRO, cible MSAA)

**Preuve.** Code : renderer.js 1759-1763 (FERRO) / 1579-1583 (METAL). Après tout le monde et ses particules, gl.clear(gl.DEPTH_BUFFER_BIT) puis renderBatch(pack(overlay…)).

Mesures (Chrome, ANGLE Metal, M5, 1668×1079) :
- L'arme couvre 8,6 % de l'écran (tampon d'identifiants, 66 lectures sur 3 mondes) et ajoute 0,13 fragment par pixel d'écran (surdessin 1,29 avec l'arme contre 1,16 sans).
- Variante wstencil : −0,60 ms GPU par image [IC95 −0,90 ; −0,45], soit −7,5 % (monde 17, 100 images × 3 répétitions ; contrôle A/A −0,05 [−0,30 ; +0,10]).
- Image identique bit à bit sur 47 images sur 47 (mondes 0, 6 et 17).
- Variante par tranche de profondeur (arme dans [0 ; 0,1], monde dans [0,1 ; 1]) : même gain (−0,50 et −0,60 ms sur deux runs), mais image non identique : 0,01 % des pixels, écart maximal 150, dans une bande à l'horizon. À écarter.

**Cause.** L'arme doit toujours passer devant le monde, même collée à un mur. Le renderer l'obtient en effaçant la profondeur au milieu de la passe. Tous les pixels du monde situés sous l'arme sont donc ombrés avec le shader complet (12 lumières, 3 ombres) puis écrasés, et l'effacement en cours de passe coupe le travail du GPU à tuiles.

**Proposition.** Reprendre la variante wstencil de dpatches.mjs.
1. Cible de scène : renderbuffer DEPTH24_STENCIL8 attaché en DEPTH_STENCIL_ATTACHMENT (colorTarget, et msaaTarget pour le chemin MSAA).
2. Effacement de début de scène : ajouter STENCIL_BUFFER_BIT.
3. Juste après les uniformes de scène, si overlay.length : enable(STENCIL_TEST), stencilFunc(ALWAYS,1,255), stencilOp(KEEP,KEEP,REPLACE), dessiner l'arme, puis stencilFunc(NOTEQUAL,1,255) et stencilOp(KEEP,KEEP,KEEP) pour tout le monde et ses particules.
4. Particules d'overlay (éclair de bouche) : même lot dessiné deux fois, sans le réemballer. Une fois avec stencilFunc(EQUAL,1) et test de profondeur (contre l'arme), une fois avec NOTEQUAL et test de profondeur coupé. C'est exactement le comportement actuel après l'effacement.
5. disable(STENCIL_TEST) avant le post.
6. Coupure de courant (blackout) : envoyer les couleurs de lumière pleines avant l'arme, puis les couleurs atténuées pour le monde.
7. Sans cible de scène (qualité basse, contexte sans stencil) : garder le chemin actuel, ou faire passer la qualité basse par la cible (voir DRAW-12).

Critère d'acceptation : écart maximal 0 sur toutes les images comparées et intervalle de confiance du gain GPU entièrement sous 0.

**Gain attendu.** −0,60 ms GPU par image en auto sur M5 (−7,5 %, mesuré). Le gain suit le nombre de pixels : environ −1,8 ms en haute à 5,4 MPix (estimé). Sur GPU à rendu immédiat, au moins les 8,6 % d'écran ombrés pour rien (estimé).

**Risques.** checks/renderer-reprises.test.mjs compare les commandes GPU à celles de v0.1 : il faudra le faire évoluer, par exemple en comparant sans l'arme ou en acceptant la nouvelle séquence, et le noter dans VERSIONS.md. Point de règle à trancher : l'image est identique mais les commandes changent, ce que la règle « mêmes commandes sans option » de FERRO n'autorise que si elle est relue comme « même image ». Le stencil ne coûte pas de mémoire : la profondeur 24 bits est déjà stockée sur 32. Le chemin MSAA de Point de rupture et BITUME demande le même format sur renderbufferStorageMultisample ; ces jeux n'ont pas d'arme, donc le chemin reste inactif chez eux.

**Vérifier par.** Dans bench/draw : node gen2.mjs cfg/C.json out/C.html && ./run.sh out/C.html 1440,1000 2 > out/C.json && python3 -I ../rgpu/paired.py out/C.json base. Lire la ligne wstencil et diffs.wstencil.identicalFrames, qui doit égaler n.

**Contre-vérification.** Code relu : gl.clear(DEPTH) puis arme en fin de passe (FERRO 1760-1763, METAL 1579-1582) ; aucun discard dans le shader du monde, arme opaque. Preuve indépendante : 5 runs à moi. Identité bit à bit sur 94 images sur 94 (66 avec bloom sur les mondes 0 et 17, 28 sans bloom sur les mondes 6 et 17). Le gain est réel mais plus petit et plus bruité qu'annoncé : IC sous 0 dans 3 runs sur 5, même signe dans les 5. P1 plutôt que P0 : 3 à 7 % du GPU, pas un gain perceptible à lui seul. Correction importante de l'étape 7 : le chemin direct vers le canvas (bloom coupé dans les options de METAL, qualité basse) n'a pas de stencil ; la variante wstencil appliquée telle quelle y casse l'image (0 image identique sur 18, 9 à 13 % des pixels, écart maximal 160). Il faut demander stencil:true au contexte (voir DRAW-V2) : image identique et gain mesuré aussi sur ce chemin. Sur M5 le gain vient sans doute surtout de la suppression de l'effacement en pleine passe (la variante par tranche de profondeur gagne autant) ; sur GPU à rendu immédiat il se limitera aux 8,6 % d'écran. Le ciel reste dessiné avant l'arme : le passer en tardif sous le même masque (DRAW-V1). Je n'ai pas pu vérifier le test renderer-reprises (dépôt FERRO absent ; METAL n'a que renderer-destruction.test.mjs).

**Preuve corrigée.** wstencil contre base : -0,40 ms GPU [IC95 -0,70 ; -0,05] (monde 17, 2 répétitions, A/A +0,40 [-0,15 ; +0,60]) ; sans bloom avec stencil:true au contexte : -0,50 [-0,60 ; -0,40] (monde 17, 4 répétitions, A/A 0,00 [-0,10 ; 0,00]) et -0,30 [-0,40 ; -0,20] (monde 6, 3 répétitions) ; deux runs sous forte charge non significatifs (-0,55 [-1,30 ; +0,60] et -0,30 [-0,55 ; +0,05]). Fichiers out/v1.json, v2.json, v2b.json, v8_0.json, v8_17.json.

**Gain corrigé.** -0,3 à -0,6 ms GPU par image en auto sur M5 (-3 à -7,5 %), image identique ; l'extrapolation à -1,8 ms en haute reste une estimation.

### DRAW-02 — Ordre de dessin : 1,8 à 2,2 fragments ombrés par pixel dans l'ordre actuel, 1,4 avec arme, dynamiques puis statiques par bandes de distance ; pré-passe de profondeur écartée
- sévérité haute · catégorie perf-gpu · effort M · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité visuellement identique · moteur (dans METAL)
- lieux : src/renderer.js:1752-1762 (FERRO) / 1576-1582 (METAL); src/renderer.js:858-863 (FERRO) / 798-803 (METAL); src/renderer.js:1553-1563 (FERRO) / 1397-1407 (METAL)

**Preuve.** Ordre actuel : statiques groupés par forme (box, sphère, cylindre, octa, anneau, biseau, feuillage) sans égard à la distance, puis dynamiques, puis arme (renderer.js 1752-1762 FERRO / 1576-1582 METAL ; packIndexed 858-863 / 798-803).

Surdessin mesuré (fragments opaques ayant passé le test de profondeur, par pixel couvert, 22 lectures par monde) :
- Ordre actuel : 1,82 (monde 0), 1,79 (monde 6), 2,19 (monde 17).
- Ordre arme, dynamiques, statiques en 4 bandes (moins de 8 m, 18 m, 34 m, au-delà) : 1,41 / 1,40 / 1,41.
- Par pixel d'écran : −23 %, −22 %, −37 % de fragments ombrés.
- À comparer au tri par instance de RGPU, limité à chaque groupe de forme : 1,70 → 1,54.

Temps sur M5 (GPU à tuiles) : aucun gain au-delà de l'arme d'abord (ordre complet −0,65 ms contre −0,60 ; bandes seules +0,10 [−0,10 ; +0,30]). C'est attendu, le GPU élimine déjà les surfaces cachées.

Image : 5 images identiques sur 11 ; sur les autres, moins de 0,005 % des pixels changent (écart maximal 44).

Pré-passe de profondeur : +0,70 ms GPU [+0,40 ; +0,90], +0,40 ms CPU, et image non identique malgré invariant gl_Position (0 image sur 13, 0,36 % des pixels, écart maximal 148, répartis sur tout l'écran).

**Cause.** L'ordre de soumission suit la forme des maillages et la nature des lots, pas la distance. Un GPU à rendu immédiat (NVIDIA, AMD, Intel) ombre alors des fragments recouverts ensuite. Le shader de matière est le poste dominant du GPU (environ 2,3 ms par mégapixel d'après RGPU).

**Proposition.** 1. Ordre : arme (DRAW-01), lot dynamique, puis statiques en 4 bandes de distance œil-objet (distance moins rayon : 8, 18, 34 m, reste), chaque bande groupée par forme. La distance au carré est déjà calculée dans la requête (ligne 846 / 786) : un simple rangement par seau, aucun tri par instance. Au plus 28 groupes statiques au lieu de 7 (58 → 68 draws mesurés).
2. Sélection par classe de GPU, lue dans WEBGL_debug_renderer_info : si la chaîne contient Apple, Mali, Adreno ou PowerVR, garder le groupement actuel ; sinon activer les bandes. Option FRender.create({drawOrder:'auto'|'shape'|'bands'}), valeur par défaut 'shape' dans FERRO pour respecter la règle de compatibilité ; METAL passe 'auto'.
3. Avec la table d'instances de DRAW-03, les bandes ne sont que l'ordre des indices.
4. Ne pas implémenter de pré-passe de profondeur tant qu'elle n'est pas identique sur la machine visée.

Critère d'acceptation sur david-pc : écart de temps GPU négatif avec intervalle de confiance sous 0, et part de pixels différents sous 0,01 %.

**Gain attendu.** Sur GPU à rendu immédiat : −22 à −37 % de fragments opaques ombrés (mesuré), donc une baisse du même ordre du coût d'ombrage opaque (estimé, non mesuré faute de NVIDIA). Sur GPU à tuiles : 0.

**Risques.** L'image n'est pas identique bit à bit. L'explication la plus probable est le départage de surfaces coplanaires, qui dépend de l'ordre de dessin : c'est une hypothèse, pas vérifiée pixel par pixel. À valider à l'œil sur les 6 images concernées avant d'activer par défaut. Plus de draws (+10). Le test renderer-reprises devra couvrir les deux ordres. La détection par chaîne de renderer peut échouer si l'extension est masquée : retomber sur 'shape'.

**Vérifier par.** Sur david-pc, dans bench/draw, retirer --use-angle=metal de run.sh, puis lancer cfg/C.json et paired.py : lignes order2 et bands. Surdessin : cfg/B17.json, variantes od et odo (readback.meanCovered).

**Contre-vérification.** Surdessin rejoué sur le monde 6 : mêmes chiffres que l'auditeur. Sur M5 l'ordre complet ne gagne rien de plus que l'arme d'abord (-0,50 [-0,70 ; -0,40] contre -0,40). Le gain sur GPU à rendu immédiat reste une estimation, non mesurable ici ; il concerne surtout les puces intégrées Intel et AMD, une carte NVIDIA de bureau étant rarement limitée par les fragments à cette résolution. Risque non signalé : l'appartenance d'un objet à une bande change quand la caméra avance, donc le gagnant d'un départage entre deux surfaces coplanaires peut s'inverser en cours de marche (scintillement nouveau), alors que l'ordre actuel est stable pour une paire donnée. À contrôler sur une séquence en mouvement avant toute activation par défaut. La détection par chaîne de renderer est fragile : garder 'shape' par défaut dans FERRO est correct. Pré-passe de profondeur : écartée à juste titre.

**Preuve corrigée.** Monde 6, 20 lectures : fragments par pixel couvert 1,79 (ordre actuel), 1,597 (monde seul), 1,383 (arme, dynamiques, 4 bandes) ; par pixel d'écran 1,302 → 0,998 (-23 %). Image order2 : 12 images identiques sur 22, écart maximal 43, boîtes dans la bande d'horizon (lignes 447 à 571). Fichiers out/v7.json et out/v1.json.

**Gain corrigé.** 0 sur M5 (mesuré) ; -22 à -37 % de fragments opaques ombrés sur GPU à rendu immédiat (compte mesuré, temps non mesuré).

### DRAW-03 — Monde statique : 87 à 89 % des octets envoyés chaque image sont des lignes qui ne changent jamais ; table d'instances persistante et listes d'indices
- sévérité moyenne · catégorie mémoire · effort L · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:835-836 (FERRO) / 775-776 (METAL); src/renderer.js:858-863 (FERRO) / 798-803 (METAL); src/renderer.js:1564-1569 (FERRO) / 1408-1413 (METAL); src/renderer.js:1529-1538 (FERRO) / 1373-1382 (METAL); src/renderer.js:7-51 (shader de sommets)

**Preuve.** Les lignes d'instance statiques sont calculées une fois (e.row, renderer.js 835-836 FERRO / 775-776 METAL), puis recopiées par packIndexed (858-863 / 798-803) et renvoyées par bufferData DYNAMIC_DRAW (1556 / 1400) dès que la liste change.

Mesures (glstat.mjs, 4 configurations) : soleil 104–137 Ko par image (0,96–0,99 bufferData par image), vue 60–112 Ko (1,00), torche 23–27 Ko (0,97), lampe 0,2 Ko. Total statique : 192–273 Ko sur 220–306 Ko.

camp:17 : 17 390 statiques, 1,11 Mo de lignes en tout.

Les plages par cellule ont été évaluées et écartées (vis.mjs) : la seule vue touche 121 plages (cellule, forme) en cellules de 8 m, 53 en 16 m, 30,5 en 32 m, contre 6 draws aujourd'hui. Chaque plage coûte 2,7–2,9 µs côté processus GPU. Aucune extension d'instance de base n'est exposée, et WEBGL_multi_draw ne sait pas choisir une plage d'instances.

Listes d'indices : 6,5 Ko par image en Uint16 pour vue + soleil + torche, contre 208 Ko de lignes (−97 %).

À garder en proportion : un bufferData de 100 Ko coûte au plus 3,3 µs sur le fil principal et environ 10 µs au total sur M5. Le coût réel est l'emballage en JS et les allocations (RCPU-04), pas l'envoi.

**Cause.** Le GPU ne garde aucune donnée statique : chaque passe reçoit une copie de 64 octets par instance visible. Sans instance de base en WebGL2, un attribut instancié ne peut pas piocher des lignes éparses dans un tampon persistant.

**Proposition.** Conception proposée, non prototypée.
1. Table statique : texture RGBA32F de 1 024 texels de large (256 lignes d'instance par ligne de texels ; 68 lignes pour camp:17), filtre NEAREST, remplie une fois dans setWorld à partir de e.row. Chaque entrée garde un emplacement stable e.slot ; liste d'emplacements libres pour la destruction.
2. updateWorld : texSubImage2D des seules lignes de texels touchées (16 à 600 entrées, soit 1 à 38 Ko par révision). Mise à jour locale, compatible avec l'index incrémental de RCPU-02.
3. Shader de sommets (monde et profondeur) : attribut entier iRow (vertexAttribIPointer, UNSIGNED_SHORT, diviseur 1) et uniform highp sampler2D uRows. Quatre texelFetch à ivec2(int(iRow&255u)*4+k, int(iRow>>8u)) remplacent iPosition, iScale, iRotation et iColor. Le reste du shader ne change pas.
4. Par passe (vue, soleil, lampes, torche) : le culling écrit une liste Uint16 groupée par forme dans un tampon à capacité (bufferSubData, 2 octets par instance). Avec la sélection à marge de RCPU-01, rien n'est envoyé sur environ 88 % des images.
5. Dynamiques : même chemin, avec une seconde table mise à jour par texSubImage2D (21–29 Ko par image) et un tampon d'indices identité envoyé une fois. Un seul format de sommet.
6. Repli : option instanceTable:false qui garde les lignes en attributs avec tampons à capacité (RCPU-04), à utiliser si le banc montre un surcoût de sommets sur un GPU donné.
7. Faire d'abord DRAW-11 (sommets partagés), qui réduit le nombre de lectures de texture.

Critère d'acceptation : écart maximal 0 au banc d'images, octets statiques par image sous 10 Ko, écart de temps GPU non positif.

**Gain attendu.** Lignes statiques renvoyées : 192–273 Ko par image → 6,5 Ko (mesuré en tailles), puis environ 0 avec RCPU-01. Plus de Float32Array de n×16 flottants par réemballage. Après destruction : 1 à 38 Ko au lieu de tout. Temps sur M5 : quelques dizaines de µs, donc surtout un gain de régularité et de bande passante sur mobile (estimé).

**Risques.** Non prototypé : le coût des 4 lectures de texture par sommet est inconnu sur GPU mobiles et intégrés ; à mesurer avant de l'activer par défaut. L'identité d'image est attendue (mêmes flottants 32 bits), à prouver. Un programme ou une branche d'uniforme de plus : temps de compilation à surveiller (79–111 ms aujourd'hui pour 5 programmes). Le test renderer-reprises doit couvrir les deux chemins. Limite de 65 536 statiques en Uint16 (17 600 au plus aujourd'hui) : passer en UNSIGNED_INT au-delà. Compatible avec setLots et camera.allStatic, qui deviennent des listes d'indices stables.

**Vérifier par.** Écrire une variante rowtex dans dpatches.mjs, l'ajouter à cfg/A.json avec compare:true, puis lire diffs.rowtex.max (0 attendu) et la ligne rowtex de paired.py. Octets : glstat.mjs, colonne envoiKo par passe.

**Contre-vérification.** Code conforme (lignes e.row, packIndexed, bufferData DYNAMIC_DRAW) et volumes cohérents avec mes runs (209,6 Ko envoyés par image en médiane au monde 17). Mais de l'aveu même du constat, l'envoi coûte une dizaine de µs pour 100 Ko : le vrai coût est l'emballage JS, que RCPU-01 (cache à marge, liste inchangée sur environ 88 % des images) et RCPU-04 (tampons à capacité) suppriment pour beaucoup moins d'effort. La table en texture est une refonte de taille L, non prototypée, avec 4 lectures de texture par sommet dont le coût est inconnu sur mobile et puces intégrées, un format de sommet changé pour les 3 jeux et un programme de plus à compiler. L'identité d'image est attendue mais pas prouvée. À ne lancer qu'après RCPU-01, RCPU-04 et DRAW-11, et seulement si un profil sur mobile montre que les envois restants comptent.

**Gain corrigé.** Octets envoyés : -97 % en taille (calculé) ; temps : quelques dizaines de µs sur M5, l'essentiel du gain CPU étant déjà pris par RCPU-01 et RCPU-04.

### DRAW-04 — Volume d'appels GL : 409 à 454 par image, mais environ 30 µs de fil principal ; VAO, UBO, filtrage d'états et multi_draw ne sont pas des leviers de performance
- sévérité basse · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P3 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1553-1563 (FERRO) / 1397-1407 (METAL); src/renderer.js:1742-1751 (FERRO) / 1568-1575 (METAL); src/renderer.js:1623-1630 (FERRO) / 1460-1467 (METAL); src/renderer.js:1631-1643 (FERRO) / 1468-1480 (METAL); src/renderer.js:1586-1588 (FERRO) / 1430-1432 (METAL); src/renderer.js:1489-1497 (FERRO, nappes)

**Preuve.** Comptage (glstat.mjs) : 409–454 appels par image.
- vertexAttribPointer : 219–242 (52–53 %), soit 4 par groupe (renderer.js 1558 FERRO / 1402 METAL).
- uniform* : 49–56, dont 25–31 redondants. Le programme du monde reçoit 21 uniformes par image (1742-1751 / 1568-1575), dont 14 ne changent pas d'une image à l'autre ; le ciel en reçoit 10, dont 6 redondants.
- États redondants : enable 6, bindTexture 3, bindFramebuffer 3, polygonOffset 3, useProgram 2, bindVertexArray 2.
- Total redondant : 46–52 (11–12 %).
- Les 3 vues d'ombre font 49 % des appels.

Coût réel (out/glcost.html, Chrome ANGLE Metal M5, 2 lancements) :
- Fil principal : 0,03 à 0,10 µs par appel, soit environ 30 µs par image pour tout le flux.
- Processus GPU : draw 0,9–1,0 µs ; vertexAttribPointer 0,42–0,48 µs ; bindVertexArray 1,93–1,97 µs.
- 4 pointeurs + draw : 2,67–2,80 µs. VAO + draw : 2,87–2,93 µs. Le VAO par groupe ne gagne rien.
- 21 uniformes : 1,5–1,7 µs ; un bloc d'uniformes de 896 octets : 0,20–0,27 µs, soit environ 1,3 µs gagnés par image.
- 50 appels redondants : environ 2 µs.

WEBGL_multi_draw est présent, mais aucune des deux extensions d'instance de base ne l'est.

**Cause.** Les passes reposent leur état sans le suivre et les pointeurs d'instance sont réémis à chaque groupe. Mais dans Chrome un appel WebGL coûte moins de 0,1 µs sur le fil principal : la validation et la traduction se font dans le processus GPU, sur un autre cœur.

**Proposition.** Ne pas en faire un chantier de performance. Cela corrige l'estimation de RCPU-10 (0,1–0,2 ms par image) d'environ un facteur 10.
1. VAO par couple (tampon, forme) : ne pas le faire pour gagner du temps. Mesuré équivalent à 4 pointeurs sur ANGLE Metal.
2. Filtrage d'états : seulement en passant, à l'occasion de DRAW-01 et DRAW-03. Une petite ombre d'état (programme, FBO, capacités, polygonOffset, blendFunc, texture active) et l'envoi des uniformes d'environnement dans setWorld au lieu de chaque image (uSunDirection, uSunColor, uAmbient, uFogColor, uEnvironment, uSkyTop, uSkyBottom, uShadowMap, et les 5 constantes du ciel).
3. Blocs d'uniformes (WebGL2 de base) : utiles pour partager les données par image et par lumière entre programmes quand DRAW-03 et DRAW-07 en ajoutent. Gain de temps de l'ordre de 1 µs par image.
4. WEBGL_multi_draw : inutilisable pour le rendu instancié faute d'instance de base. Seul usage possible : dessinerNappes (FERRO 1489-1497), N drawElements réunis en un multiDrawElementsWEBGL, avec repli.
5. Avant toute décision pour Windows : ouvrir out/glcost.html sur david-pc (ANGLE D3D11) et relire derived.bindVertexArray_us et derived.vertexAttribPointer_us.

**Gain attendu.** Au mieux 10 à 15 µs de fil principal par image sur M5 (moins de 0,1 % d'une image à 60 Hz), et environ 0,02 ms côté processus GPU. Sur un mobile 5 à 10 fois plus lent : 0,1 à 0,3 ms (estimé).

**Risques.** Mesure faite sur ANGLE Metal uniquement : D3D11 peut se comporter autrement, d'où la page glcost.html à relancer. L'horloge de la page a un pas de 0,1 ms ; les coûts par appel viennent de boucles de 1 500 à 3 000 itérations. Une ombre d'état mal tenue (perte de contexte, appels directs d'un jeu via renderer.gl dans Point de rupture) crée des bugs d'état : la remettre à zéro dans initialize().

**Vérifier par.** node glstat.mjs camp:17 600 auto : appelsParImage et redondantsParImage avant et après. Chrome : ./run.sh out/glcost.html 400,300 1.

**Contre-vérification.** J'ai relancé out/glcost.html : les coûts sur le fil principal sont reproduits (draw 0,067 µs, 4 pointeurs + draw 0,267 µs, VAO + draw 0,167 µs, 21 uniformes 1,53 µs). La conclusion tient : le volume d'appels GL n'est pas un levier et le VAO par groupe ne gagne rien. Réserve : les coûts par appel « côté processus GPU » ne sont pas stables d'un lancement à l'autre (vertexAttribPointer 0,09 µs chez moi contre 0,42 ; bindVertexArray 0,73 contre 1,93 ; draw 2,67 contre 1,0) ; ne pas les citer comme des constantes. Seul le rapport entre séquences est fiable : 4 pointeurs + draw 3,03 µs, VAO + draw 3,40 µs. Rien n'est mesuré sur D3D11 : relancer la page sur david-pc avant de fermer le sujet.

**Preuve corrigée.** out/glcost-v.json (mon lancement) comparé à bench/draw/out/glcost1.json.

**Gain corrigé.** Au mieux 10 à 15 µs de fil principal par image ; environ 0,2 ms de processus GPU pour les quelque 60 groupes, incompressible sans réduire le nombre de groupes.

### DRAW-05 — Projeteurs d'ombre du soleil : la moitié environ ne peut atteindre aucun receveur visible ; les limiter par un test capsule contre champ de vision
- sévérité moyenne · catégorie perf-cpu · effort M · gain mesuré
- contre-vérification : **plausible**, priorité P3 · qualité visuellement identique · moteur (dans METAL)
- lieux : src/renderer.js:1613-1618 (FERRO) / 1454-1458 (METAL); src/renderer.js:1596-1622 (FERRO) / 1440-1459 (METAL); src/renderer.js:1666-1685 (FERRO) / 1503-1519 (METAL)

**Preuve.** Code : sunShadowPass prend tous les statiques de la boîte du soleil (renderer.js 1613-1618 FERRO / 1454-1458 METAL), boîte centrée 8 m devant l'œil qui déborde 20 m derrière lui.

Mesures (variante suncull) :
- Instances par image, toutes passes : −21 % (4 175 → 3 285, monde 0), −24 % (monde 6), −36 % (4 325 → 2 764, monde 17).
- Triangles : −15 à −29 %.
- Octets envoyés : −28 à −46 % (211,6 → 114,4 Ko au monde 17). La passe soleil est le premier poste d'envoi (104–137 Ko par image).
- Image : 48 images identiques sur 49 ; une image du monde 17 a quelques pixels à 3 niveaux d'écart au plus.
- Temps GPU sur M5 : pas de gain mesurable (+0,05 ms [−0,10 ; +0,15]).
- Le filtre naïf (closure par entrée) coûte +0,2 ms de CPU dans Chrome sous charge.

**Cause.** Le filtre des projeteurs ne teste que la boîte orthographique du soleil. Il garde des objets dont l'ombre, portée le long des rayons, tombe entièrement hors du champ de la caméra.

**Proposition.** 1. Test : garder un projeteur si sa capsule coupe le champ. La capsule va du centre c jusqu'à c + fw·(far − z), z étant la profondeur du projeteur en espace lumière. Rayon : rayon de l'objet + marge. Tests : les 4 plans latéraux et le plan de l'œil, avec les expressions de visible() (793 / 853) ; rejet si les deux extrémités sont dehors du même plan de plus du rayon.
2. Marge : 1,0 m au lieu des 0,6 m essayés, pour viser l'identité. La couvrir : noyau PCF de 1,25 texel, extrapolation de pente du plan receveur, décalage de normale de 0,014, flexion du feuillage au vent.
3. Écriture scalaire sans allocation, comme RCPU-03 (environ 20 multiplications par candidat).
4. Combinaison avec les caches : la liste mise en cache (RGPU-03, RCPU-01) reste le sur-ensemble de la boîte ; la capsule produit chaque image la liste d'indices de DRAW-03. Sans DRAW-03, élargir la capsule des marges D et θ de RCPU-01 pour garder le cache valide.
5. Même principe, optionnel, pour le lot dynamique dans chaque vue d'ombre : il est redessiné entier 3 fois, soit 68 000–91 000 triangles et 38–43 % des triangles de l'image.

Critère d'acceptation : écart maximal 0 sur au moins 100 images comparées dans les mondes 0, 6 et 17.

**Gain attendu.** −28 à −46 % d'octets envoyés et −21 à −36 % d'instances par image (mesuré). Temps GPU inchangé sur M5 ; gain attendu en emballage CPU et en sommets sur GPU faibles (estimé).

**Risques.** La marge de 0,6 m n'est pas tout à fait conservatrice (1 image sur 49) : ne pas livrer sans la preuve à 1,0 m. Le filtre dépend de la vue, donc la liste change à chaque image : sans listes d'indices ou marge de cache, il annulerait le gain de RCPU-01. actorFilter (volume du soleil) n'est pas concerné. Les lots de BITUME (setLots) passent par le même test via inside() : appliquer la capsule à la sphère du lot.

**Vérifier par.** cfg/B0.json, B6.json et B17.json : variante suncull, diffs.suncull.max et identicalFrames, colonnes instancesMedian et uploadKBMedian. Sur-ensemble : ajouter dans vis.mjs un contrôle « aucun projeteur rejeté n'a de texel lu ».

**Contre-vérification.** Les gains en volume sont reproduits, mais le critère d'acceptation proposé (identité avec une marge de 1,0 m) est réfuté par la mesure : à 1,0 m et à 3,0 m une image diffère encore, et avec une comparaison toutes les 2 images la marge de 0,6 m donne 48 images identiques sur 55 (écart maximal 6 niveaux, jusqu'à 0,12 % des pixels, collés aux bords gauche et droit). La cause n'est pas la marge. Par bissection : seuls les plans latéraux sont en cause (plan de l'œil seul et plans haut/bas seuls : 55/55 identiques) ; les fautifs sont les gros projeteurs non tournés de rayon supérieur ou égal à 3 m, c'est-à-dire les dalles de sol (box 10×0,6×10 m et 24,4×0,4×24,9 m) ; allonger la capsule de 10 m vers le soleil rend l'image identique. Explication : depthSample (FERRO 126-133, METAL 124-131) extrapole la profondeur du receveur le long de son plan sans borne ; un mur presque parallèle aux rayons est donc comparé plus profond que lui-même et se fait ombrer par le texel de la dalle voisine en aval. Un projeteur influence ainsi des receveurs situés en amont de lui (voir DRAW-V3). Version identique mesurée : capsule de c - fw·10 m jusqu'au fond, pour un gain réduit. Comme le temps GPU ne bouge pas sur M5, que le filtre coûte du CPU et qu'il dépend de la vue (conflit avec le cache de RCPU-01), je le classe P3.

**Preuve corrigée.** Monde 17, 55 images comparées par variante (out/v3.json à v6.json). Marge 0,6 m : 48/55 identiques, écart maximal 6. Marges 1,0 et 3,0 m : 21/22 identiques, écart maximal 3 (out/v1.json). Marge 30 m : 55/55 mais 4 186 instances contre 4 321. Rayon ×4 : 55/55, 2 920 instances. Capsule allongée de 10 m en amont : 55/55, 3 325 instances et 143,9 Ko ; de 40 m : 55/55, 3 997 instances. Contrôle A/A image : 55/55.

**Gain corrigé.** Version identique mesurée (amont 10 m, un seul monde) : -23 % d'instances et -31 % d'octets envoyés (209,6 → 143,9 Ko). Version à 0,6 m : -37 % et -47 % mais image non identique. Temps GPU : 0 sur M5.

### DRAW-06 — Bandes de couleur dans le ciel et le brouillard : cible de scène RGB10_A2 et tramage d'un demi-pas à la composition
- sévérité moyenne · catégorie 3d-visuel · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · moteur (dans METAL)
- lieux : src/renderer.js:1380-1397 (FERRO) / 1299-1316 (METAL); src/renderer.js:577 (FERRO) / 517 (METAL); src/renderer.js:438 (FERRO) / 378 (METAL); src/renderer.js:551 (FERRO) / 491 (METAL); src/renderer.js:561-579 (FERRO) / 501-519 (METAL)

**Preuve.** La scène est quantifiée sur 8 bits dès l'écriture : texture() crée du RGBA8 (renderer.js 1382 FERRO / 1301 METAL), et la couleur déjà en gamma sort à la ligne 438 / 378 (ciel 551 / 491).

Mesures (run A, 13 images, monde 0) :
- Base : 3 192 bords de bande par mégapixel.
- Cible RGB10_A2 + tramage à la composition : 1,1.
- Tramage à la source sur RGBA8 : 4,6.
- Écart d'image avec la base : 0,28 niveau en moyenne, 2 au maximum, aucun pixel à plus de 3 niveaux.
- Coût : RGB10_A2 −0,20 ms [−0,45 ; 0,00] ; tramage à la source +0,10 [−0,35 ; +0,40]. Aucun des deux n'est significatif.

Essai écarté : flou vertical du bloom au quart de résolution. Image non identique (4,2 % des pixels, écart maximal 6) pour un gain nul sur M5 d'après RGPU.

**Cause.** Les dégradés lents (ciel, brouillard, vignette) sont arrondis à 256 niveaux sans tramage, ce qui donne des paliers de plusieurs dizaines de pixels.

**Proposition.** 1. Cible de scène en RGB10_A2 : texImage2D(…, gl.RGB10_A2, …, gl.RGBA, gl.UNSIGNED_INT_2_10_10_10_REV, null). Format WebGL2 de base, rendable et filtrable, même mémoire que RGBA8. Les cibles du bloom restent en RGBA8.
2. À la composition (uPass==2) : ajouter (fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5)/255. à la couleur finale.
3. Chemins sans composition (bloom coupé, qualité basse) : même terme à la fin du shader du monde et du ciel, derrière un uniform uDither qui vaut 0 par défaut. Ou faire passer tous les chemins par la composition (DRAW-12).
4. Option FRender.create({dither:true}), false par défaut dans FERRO ; METAL l'active.
5. Étage ultérieur facultatif, EXT_color_buffer_float étant présent : scène en R11F_G11F_B10F linéaire, bloom sans seuil et courbe de tons à la composition. Cela change l'image : à proposer comme réglage, pas par défaut.

Critère d'acceptation : moins de 10 bords de bande par mégapixel, écart maximal de 2 niveaux au plus, écart de temps GPU non significatif.

**Gain attendu.** Bords de bande divisés par environ 3 000 (3 192 → 1,1 par mégapixel), sans coût mesurable.

**Risques.** Le tramage change jusqu'à 57 % des pixels d'au plus 2 niveaux : les tests qui comparent des images au pixel doivent tolérer 2 niveaux ou couper l'option. Option coupée par défaut, donc image de v0.2 inchangée. RGB10_A2 n'a que 2 bits d'alpha : sans effet ici, les particules se mélangent avec l'alpha source. Le rendu Canvas 2D ignore l'option.

**Vérifier par.** cfg/A.json : bands.rgb10.edgesPerMPix et diffs.rgb10.max ; ligne rgb10 de paired.py.

**Contre-vérification.** Rejoué sur un autre monde (6) : mêmes ordres de grandeur. Code conforme : cible RGBA8 (FERRO 1381-1383), couleur déjà en gamma. Deux remarques. (1) Le tramage à la source sur RGBA8 (2 lignes, aucun changement de format, valable aussi sans bloom et en qualité basse) apporte 99,8 % du bénéfice : commencer par lui, RGB10_A2 en second temps. (2) La métrique tombe à presque zéro par construction (un tramage d'un demi-pas casse tout palier) ; le bénéfice visible existe sur les dégradés sombres mais reste discret. Le motif est fixe à l'écran, sans bruit temporel. Temps non remesuré. Option coupée par défaut dans FERRO : correct.

**Preuve corrigée.** Monde 6, 11 images : 3 263,9 bords de bande par mégapixel en base ; 0,9 avec RGB10_A2 + tramage à la composition (écart moyen 0,277 niveau, maximal 2, 57 % des pixels touchés) ; 5,7 avec tramage à la source sur RGBA8 (écart moyen 0,251, maximal 2). Fichier out/v7.json.

### DRAW-07 — Shader de matière sur D3D11 : dérivées et lectures d'ombre placées dans les branches (risque d'aplatissement) ; les variantes par matière ne rapportent rien
- sévérité moyenne · catégorie perf-gpu · effort M · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité visuellement identique · moteur (dans METAL)
- lieux : src/renderer.js:126-163 (FERRO) / 124-161 (METAL); src/renderer.js:164-358 (FERRO) / 162-298 (METAL); src/renderer.js:371-382 (FERRO) / 311-322 (METAL)

**Preuve.** Opérations à gradient dans des branches du shader du monde (FERRO / METAL quand la ligne existe) :
- fwidth dans le bloc métal (189) ; grid() dans le bloc sol (201, 212) ; façade (288, 291) et dallage (320), propres à FERRO ; usure d'objet (342).
- reliefNormal sous 3 conditions (355-357 / 296-298), plus une 4e pour les matières urbaines (358, FERRO seul).
- shadow() : dFdx et dFdy (138), texture() à gradient implicite (132 / 130) sous conditions (135, 141, 147), appelée depuis la boucle de 12 lumières qui contient un break (371-382 / 311-322).

Mesures :
- Matières à l'écran : métal 24–27 %, matière 1 14–17 %, sol 12–14 %, roche 6–7 %, feuillage 4–5 %, émissives 0,3 %. Toutes les matières dominantes utilisent grain et broad (172-173 / 169-170).
- textureLod à la place de texture dans l'atlas d'ombre : image identique sur 13 images sur 13, temps inchangé sur Metal (−0,10 ms [−0,45 ; +0,10]).

Non mesurable ici : aucun backend D3D11 sur macOS.

**Cause.** Sur Windows, Chrome traduit le GLSL en HLSL. À ma connaissance, le compilateur HLSL ne peut pas garder une vraie branche autour d'une opération à gradient : il l'aplatit et calcule les deux côtés, et déroule les boucles concernées. Si c'est bien le cas ici, chaque pixel paierait plusieurs blocs de matière au lieu d'un. Sur Metal ce sont de vraies branches : rien n'est visible sur mon banc.

**Proposition.** À faire et à mesurer sur david-pc, pas à l'aveugle.
1. Constat d'abord : dans la page de banc, lire WEBGL_debug_shaders.getTranslatedShaderSource() du shader du monde et le journal de compilation, puis noter le temps de FRender.create avec out/first.html.
2. Changement exact à faire dès maintenant : textureLod(uShadowMap,tap,0.) dans depthSample. Même texel, l'atlas n'ayant pas de mip.
3. Sortir les dérivées des branches : calculer une fois en tête de main() les dérivées de uv et de vWorld, en tirer les fwidth des expressions linéaires, et calculer hors branche les quelques fwidth d'expressions non linéaires (peu coûteuses). Les appels à noise restent dans des branches sans gradient.
4. Ombres : dérivées analytiques par la matrice d'ombre, seulement si le renderer annonce Direct3D. Cette variante coûte +0,25 ms sur Metal d'après RGPU (shbranch).
5. Ne pas créer de programmes par matière : au mieux 0,3 % des pixels y gagneraient, pour plus de draws et de compilation.

Critère d'acceptation : garder chaque étape seulement si l'intervalle de confiance du temps GPU est sous 0 sur D3D11 et si l'écart d'image ne dépasse pas 1 niveau.

**Gain attendu.** Inconnu tant que le constat n'est pas fait sur D3D11 ; potentiellement de l'ordre du coût du bruit des matières (environ 10 % du GPU d'après RGPU) si l'aplatissement est confirmé. Sur Metal : 0 (mesuré pour textureLod).

**Risques.** Hypothèse non vérifiée sur la machine cible : c'est un constat à faire avant tout travail. Sortir les dérivées change les arrondis, donc l'image peut bouger d'un niveau sur quelques pixels : passer par le banc d'images. Un chemin par backend ajoute une variante de shader à tester. Le texte du shader change : le test renderer-reprises compare aussi les sources.

**Vérifier par.** Sur david-pc : ./run.sh sans --use-angle=metal avec cfg/A.json (variante texlod, puis une variante hoist à écrire dans dpatches.mjs), et out/first.html pour le temps de compilation.

**Contre-vérification.** Lignes vérifiées : dFdx et dFdy dans shadow() (FERRO 138), texture() dans depthSample (132), appels depuis la boucle de lumières (379) et sous condition (383, 391). textureLod : identité rejouée, 11 images sur 11 au monde 6 ; ce changement-là est exact et peut partir tout de suite. Tout le reste repose sur une hypothèse (aplatissement des branches par le compilateur HLSL) qui n'est pas vérifiable sur macOS : c'est un constat à faire sur david-pc (source traduite par WEBGL_debug_shaders, temps de FRender.create) avant d'écrire la moindre ligne. Refuser les variantes par matière est justifié par la mesure (0,3 % de pixels émissifs). Sortir les dérivées des branches change les arrondis : la qualité « visuellement identique » reste à prouver au banc d'images.

**Gain corrigé.** 0 sur Metal (mesuré) ; inconnu sur D3D11.

### DRAW-08 — Visibilité : 66 à 70 % des instances statiques dessinées n'ont aucun pixel visible, mais ce gaspillage coûte peu ; test de champ par cellule d'abord, occlusion plus tard
- sévérité basse · catégorie perf-cpu · effort M · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:839-857 (FERRO) / 779-797 (METAL); src/renderer.js:1714 (FERRO) / 1545-1546 (METAL); src/renderer.js:1657-1699 (FERRO) / 1496-1533 (METAL)

**Preuve.** Le culling est un test de sphère par objet (visible(), renderer.js 853-857 FERRO / 793-797 METAL) appliqué à tous les candidats de la requête par cellules de 8 m (839-850 / 779-790), sans rejet par cellule ni occlusion.

Mesures :
- camp:17 : 3 296 candidats dans la portée, 1 015 visibles ; 69 % sont rejetés un par un.
- Tampon d'identifiants (3 mondes, 66 lectures) : 867–951 statiques dessinés par image, 293–336 avec au moins un pixel. Part invisible : 66–70 % en moyenne, de 54 % à 99,9 %.
- Dynamiques : environ 28 pièces visibles sur 200 soumises hors arme. Ce nombre inclut les faces arrière des acteurs visibles.

Ce que cela coûte : les statiques de la vue ne font que 20 000–43 000 triangles sur 180 000–239 000 par image. Retirer tous les projeteurs statiques des ombres (41 000–55 000 triangles) ne rend que 0,25 ms GPU sur M5. Le coût en pixels relève de l'ordre de dessin (DRAW-02).

**Cause.** Le monde est généré sans structure de visibilité (ni secteurs ni portails) et les 21 mondes ont un extérieur. La seule granularité est l'objet. Les instances cachées ne coûtent que du travail de sommets et d'emballage, déjà faible.

**Proposition.** 1. À faire, résultat identique : test de champ par cellule dans la requête, avant de toucher les entrées. Sphère englobante de la cellule : centre de la cellule à la hauteur moyenne de ses entrées, rayon 4√2 + demi-hauteur + rayon maximal du niveau. Elle passe par visible() ; les cellules rejetées sont sautées. À coupler à la grille dense de RCPU-05. Vérifier l'égalité des listes shown sur 3 000 images.
2. Ne pas implémenter d'occlusion maintenant : le potentiel en instances est élevé, la valeur en millisecondes faible sur le matériel mesuré, et le risque d'apparition tardive n'est pas nul.
3. Si un profil sur GPU faible le justifie plus tard : requêtes d'occlusion WebGL2 (ANY_SAMPLES_PASSED_CONSERVATIVE) sur les boîtes de blocs de 16 m (53 dans la vue), résultat lu à l'image suivante sans blocage. Boîtes gonflées de max(1 m, vitesse × 2 images). Tout bloc sans historique est dessiné. Derrière une option, coupée par défaut.
4. Pas d'ensembles visibles par cellule calculés au chargement : sans occulteurs de pleine hauteur garantis, le calcul ne serait pas conservateur.

**Gain attendu.** Étape 1 : environ deux tiers des tests par entrée évités dans le filtre de vue (estimé à partir des 69 % rejetés ; à mesurer avec l'A/B de RCPU). Étape 3 : jusqu'à −66 % d'instances statiques dans la vue, pour moins de 0,2 ms sur M5 (estimé).

**Risques.** Étape 1 : la sphère de cellule doit couvrir la hauteur réelle des objets (cellules en 2D, objets en 3D), sinon des objets hauts disparaissent ; le contrôle d'égalité des listes le détecte. Étape 3 : apparition retardée d'une image possible si la marge est trop faible, donc contraire à l'exigence de qualité sans la marge de vitesse.

**Vérifier par.** Étape 1 : vis.mjs (candidats contre visibles) et bench/rcpu/alt.mjs pour l'A/B à listes identiques. Potentiel d'occlusion : cfg/B*.json, variante idbuf (statDrawn, statSeen).

**Contre-vérification.** Code conforme : requête par cellules de 8 m puis test de sphère par entrée, sans rejet par cellule (FERRO 839-857). J'ai relancé vis.mjs : 3 296 candidats, 1 015 visibles, 69 % rejetés un par un. L'étape 1 est faisable, mais elle devient presque sans objet si RCPU-01 est fait (la liste n'est recalculée que sur environ 12 % des images) ; à ne garder que comme complément de RCPU-05. Reporter l'occlusion est le bon choix : gain en millisecondes faible sur le matériel mesuré et risque d'apparition tardive contraire à l'exigence de qualité. La part de 66 à 70 % d'instances sans pixel n'a pas été remesurée.

**Gain corrigé.** Étape 1 : environ deux tiers des tests par entrée évités, mais seulement sur les images où la liste est recalculée.

### DRAW-09 — Apparition brusque aux portées de détail : un objet d'un mètre surgit à 13 m avec une soixantaine de pixels de haut ; fondu par mise à l'échelle dans le shader de sommets
- sévérité moyenne · catégorie 3d-visuel · effort M · gain qualitatif
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · moteur (dans METAL)
- lieux : src/renderer.js:783 (FERRO) / 723 (METAL); src/renderer.js:846 (FERRO) / 786 (METAL); src/renderer.js:28-51 (shader de sommets); src/renderer.js:734-737 (FERRO) / 674-677 (METAL)

**Preuve.** Portées par niveau de détail : 64, 32 et 13 m en auto, 82/42/19 en haute, 48/20/0 en basse (detailRanges, renderer.js 783 FERRO / 723 METAL). Le test est binaire : d ≤ (portée + rayon)² (846 / 786).

Calcul : avec un champ vertical de 75° sur 1 079 pixels (14,4 pixels par degré), un objet de 1 m de niveau 2 apparaît d'un coup à 13,5 m sous 4,2°, soit environ 60 pixels de haut. Au niveau 1, à 32,5 m : environ 25 pixels.

Mesure : 71 à 85 statiques visibles par image couvrent moins de 16 pixels et 134 à 165 moins de 64, sur 293–336 visibles. Les entrées et sorties de liste sont donc fréquentes en déplacement. À 7 m/s, la liste change sur 99,9 % des images d'après RCPU.

**Cause.** La portée par niveau de détail sert à la fois de budget et de seuil de visibilité, sans zone de transition.

**Proposition.** 1. Élargir la portée de requête de 12 % par niveau et faire le fondu dans cette couronne. Rien de ce qui est visible aujourd'hui ne rétrécit.
2. Shader de sommets, monde et profondeur : uniform vec4 uDetail (3 portées et la largeur de fondu) et uniform vec3 uViewEye (œil de la caméra principale, aussi dans les passes d'ombre). Facteur k = smoothstep(0., 1., (1.12·R + rayon − d)/(0.12·R)), avec rayon = length(iScale.xyz)·.5 comme dans metadata() (826 / 766). Position : centre + (sommet − centre)·k.
3. Niveau de détail par instance : 2 bits de plus dans les drapeaux de iRotation.w (surfaceFlags). Adapter le décodage de vObject en mod(floor(w·.25), 2.).
4. Les ombres suivent la même échelle : pas d'ombre sans objet.
5. Option FRender.create({detailFade:true}), false par défaut dans FERRO.
6. Coût : environ 25 % d'instances de plus pour les niveaux 1 et 2, sans effet sur M5 vu DRAW-08.

Critère d'acceptation : sur une séquence de marche, aucune instance ne passe de 0 à plus de 4 pixels entre deux images à cause de la portée.

**Gain attendu.** Plus d'apparition ni de disparition brusque du décor de détail en marche ; coût négligeable.

**Risques.** Image différente par construction (objets visibles 12 % plus loin) : c'est une amélioration à option. Les lignes d'instance changent de drapeaux : pack, spatialIndex, packEffects et le test renderer-reprises sont touchés. Le rendu Canvas 2D n'a pas d'équivalent et garde le seuil dur. Les acteurs ont leurs propres seuils de niveau de détail (actors.js), hors de ce constat.

**Vérifier par.** Variante idbuf étendue : suivre le nombre de pixels de chaque identifiant d'une image à l'autre et compter les passages de 0 à plus de 4 pixels, avant et après.

**Contre-vérification.** Code conforme : portées 64/32/13 m en auto (FERRO 783), seuil binaire d ≤ (portée + rayon)² dans la requête, aucun fondu dans le shader de sommets (lignes 28-51 relues). Chiffres à corriger : en projection perspective, un objet de 1 m à 13,5 m fait 52 pixels (et non environ 60) sur 1 079 pixels à 75° ; à 32,5 m, 22 pixels (et non 25). Le niveau 2 ne pèse que 47 instances visibles par image sur 1 015 ; l'essentiel des apparitions concerne le niveau 1 (301 visibles) à 32 m. Point manquant : les requêtes de projeteurs ont leurs propres portées, centrées ailleurs que sur l'œil (soleil : [étendue + 24, 26, 0] autour du centre de la boîte) ; les ombres du niveau 1 surgissent donc indépendamment, et le fondu doit couvrir aussi ces listes sinon l'ombre apparaîtra d'un coup sous un objet en train de grandir. Les drapeaux de iRotation.w sont partagés avec vOverlay, vOutdoor et vObject : vérifier la place et les lignes écrites par les jeux (fx.instances de Point de rupture). Amélioration à option, image différente par construction.

**Preuve corrigée.** vis.mjs relancé : par niveau de détail 668 / 301 / 47 visibles. Taille à l'écran = 1 079 × (1/d) / (2 × tan 37,5°).

### DRAW-10 — Ombres : la stabilisation au texel existe déjà ; un cache des projeteurs statiques vaut au plus 0,25 ms GPU sur M5
- sévérité basse · catégorie perf-gpu · effort L · gain estimé
- contre-vérification : **confirmé**, priorité P3 · qualité visuellement identique · moteur (dans METAL)
- lieux : src/renderer.js:1578-1595 (FERRO) / 1422-1439 (METAL); src/renderer.js:1596-1622 (FERRO) / 1440-1459 (METAL); src/renderer.js:1419-1429 (FERRO) / 1325-1333 (METAL); src/renderer.js:1733-1738 (FERRO) / 1562-1565 (METAL)

**Preuve.** État du code :
- Soleil : centre de la boîte recalé au texel sur les deux axes lumière (renderer.js 1603-1604 FERRO / 1445-1446 METAL), étendue constante. Pas de scintillement en translation ni en rotation.
- Lampe : source fixe, liste de projeteurs en cache (1590-1593 / 1434-1437, 0,01 envoi par image), mais redessinée à chaque image.
- Torche : vue perspective qui suit la caméra, jamais en cache.

Mesures :
- Projeteurs statiques par image : soleil 1 740–2 206 instances (41 000–55 000 triangles, 104–137 Ko envoyés), lampe 288–363 (3 400–6 700 triangles), torche 384–444 (9 400–9 800 triangles).
- Lot dynamique : 344–464 instances dans chacune des 3 vues.
- Ombres sans aucun projeteur statique : −0,25 ms GPU [−0,50 ; 0,00]. Sans projeteurs dynamiques : −0,10 ms [−0,70 ; +0,15], non significatif.

**Cause.** Chaque vue d'ombre redessine tout, statique et dynamique, à chaque image. Mais la géométrie d'ombre est légère (512² par tuile en auto) et n'est pas le goulot sur le matériel mesuré.

**Proposition.** À faire après DRAW-03 et DRAW-05, pas avant.
1. Lampe : rendre les projeteurs statiques une fois dans une texture de profondeur de cache, à refaire quand la lampe, la révision du monde ou la liste changent. Chaque image : blitFramebuffer(DEPTH_BUFFER_BIT, NEAREST) du cache vers la tuile, puis les dynamiques par-dessus.
2. Soleil : cache ancré au monde. Quantifier le centre sur 32 texels (3,5 m à 512 pixels pour 56 m) en espace lumière. Texture de cache de 576² (640² en haute) pour garder exactement 0,109 m par texel. Chaque image : copie du rectangle de 512² au décalage entier courant, puis les dynamiques. Refaire le cache quand la cellule de 3,5 m change, soit toutes les 0,5 s environ à 7 m/s ; cette image coûte ce que coûte chaque image aujourd'hui.
3. Biais : ne pas y toucher (décalage de normale 0,014, biais de plan receveur, polygonOffset 1,1/2) ; aucun défaut relevé.
4. Lumières lointaines : le cas de la lampe ombrée hors de portée est traité par RGPU-04.

Critère d'acceptation : écart d'image d'au plus 1 niveau, et aucune image plus chère qu'aujourd'hui.

**Gain attendu.** Au plus 0,25 ms GPU par image en auto sur M5 (borne mesurée), davantage en haute (tuiles 1024²) et sur GPU limités en sommets (estimé). Les 104–137 Ko par image du soleil ne partent plus que 2 fois par seconde environ.

**Risques.** Le cache du soleil est rendu depuis un centre quantifié différent : la profondeur n'est pas identique bit à bit, donc des bords d'ombre peuvent bouger d'un texel. À prouver par le banc. Mémoire : +1,3 Mo en auto, +6,5 Mo en haute. La destruction invalide les caches : une image plus chère par révision, à étaler si besoin. Avec fx.sunOnly (Point de rupture, soleil sur tout l'atlas), le cache doit suivre camera.sun. Complexité élevée pour un gain borné.

**Vérifier par.** cfg/A.json : variantes shnostat et shnodyn pour la borne ; puis une variante shcache à écrire, avec compare:true.

**Contre-vérification.** Code relu : recalage au texel du centre de la boîte du soleil sur les deux axes lumière (xSnap, ySnap, FERRO 1603-1604), axes dépendant du seul soleil, donc stables en rotation ; liste de la lampe en cache (lampCasters). La borne de 0,25 ms n'a pas été remesurée, je la reprends telle quelle. Complexité L pour un gain borné : P3, après tout le reste. Avertissement tiré de DRAW-05 : un cache rendu depuis un centre quantifié différent ne sera pas identique, et toute réduction de la liste des projeteurs doit tenir compte de l'influence en amont (DRAW-V3).

### DRAW-11 — Géométrie : 3 sommets émis par triangle, 2 328 sommets au lieu de 597 ; les partager
- sévérité basse · catégorie perf-gpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:622-704 (FERRO) / 562-644 (METAL); src/renderer.js:1441-1444 (FERRO) / 1345-1348 (METAL); src/renderer.js:929-954 (FERRO) / 869-894 (METAL)

**Preuve.** Code : vertex() pousse chaque sommet sans le chercher (renderer.js 624 FERRO / 564 METAL), alors que le rendu est indexé (drawElementsInstanced, 1560 / 1404).

Mesures (vis.mjs), sommets émis → couples (position, normale) uniques : box 36 → 24 ; sphère 864 → 170 ; cylindre 192 → 70 ; anneau 864 → 175 ; feuillage 216 → 38 ; biseau 132 → 96 ; octa 24 → 24. Total 2 328 → 597, tampon de 55,9 Ko → 14,3 Ko.

Variante vdedup : image identique bit à bit sur 49 images sur 49 (runs A, B0, B6, B17). Temps GPU sur M5 : −0,35 ms [−0,75 ; +0,20], non significatif.

Le rendu Canvas 2D relit la géométrie par indices (933 / 873), donc reste compatible.

**Cause.** Le générateur de primitives écrit chaque triangle avec ses trois sommets propres. Le GPU exécute donc le shader de sommets jusqu'à 5 fois trop souvent pour les formes lisses.

**Proposition.** Dans geometry() : une Map clé « px,py,pz|nx,ny,nz » vers l'indice. vertex() renvoie l'indice existant ou en crée un. Les plages par forme et les indices Uint16 ne changent pas de structure.

À faire avant DRAW-03, dont il réduit d'autant les lectures de texture par sommet.

**Gain attendu.** Exécutions du shader de sommets : −33 % pour les boîtes, −63 % pour les cylindres, −80 % pour les sphères et les anneaux, −82 % pour le feuillage, 0 pour les octaèdres (formes majoritaires : octa 8 403 et box 5 827 sur 17 390). Sans effet mesurable sur M5 ; utile sur GPU limités en sommets et avec DRAW-03 (estimé).

**Risques.** Aucun changement d'image (prouvé). Les coutures des sphères et des anneaux gardent des doublons : sin(2π) n'est pas exactement 0, ce qui est sans conséquence. Le test renderer-reprises compare les tampons envoyés : le tampon de sommets change de taille et de contenu, à mettre à jour.

**Vérifier par.** cfg/A.json ou B*.json : diffs.vdedup.identicalFrames doit égaler n. node vis.mjs : champ geometrie.

**Contre-vérification.** Code conforme : vertex() pousse sans chercher (FERRO 624), rendu indexé. Rejoué : image identique sur 22 images sur 22 au monde 17, et vis.mjs redonne 2 328 sommets émis pour 597 uniques. Aucun gain de temps mesurable sur M5 (+0,20 ms [-0,10 ; +0,40] chez moi), comme annoncé. Taille S, risque nul, tampon de sommets de 55,9 Ko ramené à 14,3 Ko : à faire en passant, P2. La clé en chaîne de caractères ne sert qu'une fois, à la création.

**Preuve corrigée.** out/v1.json : diffs.vdedup identicalFrames 22 sur 22, écart maximal 0.

**Gain corrigé.** 0 ms sur M5 (mesuré) ; -74 % d'exécutions du shader de sommets pour les formes lisses, utile sur GPU limités en sommets (estimé).

### DRAW-12 — Contexte et cibles : tampon de profondeur par défaut inutile, invalidateFramebuffer sans effet sur M5, compilation des 5 programmes bloquante
- sévérité basse · catégorie chargement · effort M · gain mesuré
- contre-vérification : **plausible**, priorité P2 · qualité identique · moteur et jeu
- lieux : src/renderer.js:1353 (FERRO) / 1276 (METAL); src/renderer.js:1369-1379 (FERRO) / 1288-1298 (METAL); src/renderer.js:1434 (FERRO) / 1338 (METAL); src/renderer.js:1411-1432 (FERRO) / 1318-1336 (METAL); src/renderer.js:1740-1741 (FERRO) / 1566-1567 (METAL)

**Preuve.** Attributs du contexte (renderer.js 1353 FERRO / 1276 METAL) : alpha false, antialias false, depth true, powerPreference high-performance, identiques dans les deux dépôts et accordés tels quels.

Mesures :
- depth:false : image identique sur 13 images sur 13 ; temps −0,20 ms [−0,50 ; +0,10], non significatif. En auto et en haute, la scène passe par sa propre cible et le tampon de profondeur du canvas ne sert pas : 7,2 Mo à 1,8 MPix, 21,5 Mo à 5,37 MPix.
- invalidateFramebuffer (profondeur de scène après la passe, couleur des cibles du bloom avant écriture) : image identique sur 13 images sur 13 ; temps +0,05 et +0,10 ms, non significatif sur ANGLE Metal.
- FRender.create : 79–111 ms à froid, 66 ms avec le cache disque de Chrome. Compilation et édition de liens synchrones (1369-1379 / 1288-1298, 1434 / 1338). KHR_parallel_shader_compile est présent.
- Première image : 29–32 ms contre 7–18 ms ensuite.

**Cause.** Le contexte demande toujours un tampon de profondeur, parce que la qualité basse dessine directement dans le canvas. Les programmes sont compilés et vérifiés de façon bloquante à la création. Aucune image d'échauffement n'est rendue avant le jeu.

**Proposition.** 1. Un seul chemin : toujours rendre la scène dans la cible. En qualité basse, cible sans bloom puis blitFramebuffer vers le canvas. Le contexte peut alors être créé avec depth:false et stencil:false, et DRAW-01 et DRAW-06 valent aussi en basse. Option de création, valeur par défaut inchangée dans FERRO.
2. invalidateFramebuffer : l'ajouter dans le même changement (3 appels, variante inv). Gratuit et identique ; utile sur GPU à tuiles avec pilotes GLES (Android), nul sur M5.
3. Compilation : lancer compileShader et linkProgram des 5 programmes sans rien lire, puis interroger COMPLETION_STATUS_KHR pendant l'écran de chargement quand l'extension existe. Ne lire LINK_STATUS et les emplacements d'uniformes qu'à la fin. Nouvelle API FRender.create(canvas,{async:true}) qui rend une promesse ; chemin synchrone conservé.
4. Échauffement : pendant le chargement, une image avec un maillage de chaque forme, une particule, une pièce d'arme et le post, dans les cibles finales.
5. METAL, écran d'options : afficher la carte graphique utilisée (WEBGL_debug_renderer_info) et une aide quand un PC portable tourne sur la puce intégrée. À ma connaissance, une page ne peut pas forcer la carte NVIDIA sous Windows ; c'est le réglage graphique de Windows pour Chrome qui décide.
6. desynchronized:true : à essayer sur david-pc seulement, non demandé ni mesuré ici.

**Gain attendu.** −7 à −21 Mo de mémoire GPU (calculé). Chargement : 79–111 ms de blocage en moins sur M5, sans doute davantage sur D3D11 (estimé, à mesurer avec out/first.html). Première image : environ 15–20 ms de saccade en moins (mesuré sur M5).

**Risques.** Le chemin unique ajoute une copie plein écran en qualité basse : à mesurer sur mobile avant de l'imposer. depth:false est irréversible pour la vie du contexte : le chemin direct doit disparaître en même temps. L'API asynchrone touche game.js et les deux autres jeux : garder le chemin synchrone par défaut. La restauration après perte de contexte doit refaire l'échauffement.

**Vérifier par.** cfg/A.json : variantes depthfalse et inv (identicalFrames). ./runfresh.sh out/first.html profil-neuf : première ligne et « draw 1 » contre « draw 2 ».

**Contre-vérification.** Vérifié : attributs du contexte identiques dans les deux dépôts (FERRO 1353, METAL 1276), compilation et édition de liens synchrones avec lecture immédiate des statuts (FERRO 1369-1379), depth:false identique sur 11 images sur 11 (monde 6), first-cold.json : 111 ms pour FRender.create, première image 29,3 ms. Contradiction à lever : depth:false au contexte s'oppose au stencil dont DRAW-01 a besoin sur le chemin direct. Les deux ne sont compatibles que si le chemin unique par la cible de scène est fait d'abord ; sinon il faut depth:true et stencil:true (DRAW-V2). La copie plein écran ajoutée en qualité basse n'est pas mesurée sur mobile. Le point 5 (afficher la carte graphique utilisée et aider quand un portable tourne sur la puce intégrée) répond directement à la demande de David sur les PC NVIDIA et mérite P1 à lui seul, côté METAL ; le contexte demande déjà powerPreference high-performance. Gain mémoire calculé, non mesuré.

**Gain corrigé.** Chargement : environ 110 ms de blocage en moins sur M5 si la compilation devient asynchrone ; première image 29 ms au lieu de 9 à 15 ms ensuite.

### DRAW-13 — Précision de profondeur à distance : 24 bits avec un plan proche à 4,5 cm, des pixels basculent à l'horizon dès que la plage change de 10 %
- sévérité basse · catégorie 3d-visuel · effort M · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité meilleure · moteur (dans METAL)
- lieux : src/renderer.js:1708-1709 (FERRO) / 1541-1542 (METAL); src/renderer.js:1393 (FERRO) / 1312 (METAL); src/renderer.js:1456 (FERRO) / 1357 (METAL)

**Preuve.** Projection : plan proche 0,045 m, plan lointain 180 m (renderer.js 1708-1709 FERRO / 1541-1542 METAL), profondeur DEPTH_COMPONENT24 (1393 / 1312).

Calcul : la résolution vaut z²/(proche × 2^24), soit environ 5 mm à 60 m et 13 mm à 100 m.

Indice mesuré : la variante qui réduit la plage de profondeur du monde à [0,1 ; 1] change 0,01 % des pixels, jusqu'à 150 niveaux, dans une bande horizontale au milieu de l'écran (lignes 424 à 649 sur 1 079, lecture depuis le bas). La variante au stencil, qui laisse la profondeur intacte, est identique sur 47 images sur 47. Des surfaces lointaines sont donc départagées à la limite de la résolution ; je n'ai pas observé directement de scintillement en mouvement.

EXT_clip_control est présent sur cette machine.

**Cause.** Une profondeur entière en ordre normal concentre presque toute sa précision près de la caméra. Avec un plan proche à 4,5 cm (pour l'arme), il en reste très peu au-delà de 50 m.

**Proposition.** Profondeur inversée, derrière une détection.
1. Si EXT_clip_control existe : clipControlEXT(LOWER_LEFT_EXT, ZERO_TO_ONE_EXT), renderbuffer DEPTH_COMPONENT32F (DEPTH32F_STENCIL8 avec DRAW-01), projection inversée (proche → 1, lointain → 0), clearDepth(0), depthFunc(GEQUAL).
2. Les vues d'ombre gardent leur convention actuelle : matrices et atlas séparés.
3. Sans l'extension : chemin actuel.
4. Option FRender.create({reverseDepth:'auto'}), coupée par défaut dans FERRO.

Critère d'acceptation : la variante par tranche de profondeur ne doit plus changer de pixels à l'horizon, et l'écart avec la base se limite aux pixels déjà instables.

**Gain attendu.** Départage stable des surfaces lointaines presque coplanaires ; coût nul. Utile surtout à BITUME (longues lignes droites) et à la vue de haut de Point de rupture.

**Risques.** Le défaut actuel est déduit d'un indice, pas observé en mouvement : à confirmer par une séquence avant d'investir. L'image change sur les pixels concernés, par construction. La profondeur 32 bits flottante avec stencil prend 8 octets par pixel sur certains GPU, soit +7 à +21 Mo. Toute comparaison de profondeur écrite en dur (ciel tardif de RGPU, particules) doit suivre l'inversion. Le test renderer-reprises est touché.

**Vérifier par.** Variante revz à écrire dans dpatches.mjs, puis cfg/A.json : comparer diffs de wfirst avec et sans revz, boîtes des écarts comprises.

**Contre-vérification.** Le calcul est juste (z²/(proche × 2^24) : 4,8 mm à 60 m, 13 mm à 100 m) et les lignes citées sont exactes. Mais la cause est douteuse : une résolution de 5 à 13 mm suffit largement pour une géométrie non coplanaire. Des pixels qui basculent quand la plage change de 10 % signalent deux surfaces à moins d'un pas de profondeur, donc coplanaires ou empilées à quelques millimètres ; la profondeur inversée ne départage pas deux faces exactement coplanaires, elle déplace seulement le bruit. Aucun scintillement n'a été observé en mouvement. Avant d'investir : identifier les paires en cause (tampon d'identifiants sur les pixels qui basculent) ; si elles sont coplanaires, la correction est dans la génération du monde (décalage des dalles), pas dans le renderer. La profondeur inversée reste une option légitime pour BITUME et Point de rupture, à juger sur leurs propres scènes.

## Constats ajoutés par le contre-vérificateur

### DRAW-V1 — Ciel dessiné en premier sur tout l'écran alors qu'il n'est visible que sur 28 à 30 % des pixels : le dessiner après les opaques, à la profondeur 1
- sévérité moyenne · catégorie perf-gpu · effort S · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1741 (FERRO) / 1567 (METAL); src/renderer.js:1623-1630 (FERRO) / 1460-1467 (METAL); src/renderer.js:521-560 (FERRO, SKY_FRAG)

**Preuve.** Code : skyPass est appelé juste après l'effacement, test de profondeur coupé, triangle plein écran (renderer.js 1741 et 1623-1630 FERRO ; 1567 et 1460-1467 METAL). Le shader du ciel appelle 6 fois noise(), soit 24 hash à base de sin, plus des pow (SKY_FRAG, FERRO 521-560). D'après le tampon d'identifiants de l'auditeur, le ciel ne reste visible que sur 28 à 30 % de l'écran : 70 à 72 % de ses fragments sont ombrés puis recouverts sur un GPU à rendu immédiat.

Mesure (variante skylate de bench/draw-verif/dpatches.mjs, mondes 0 et 17, 22 images comparées par monde) : image identique bit à bit sur 44 images sur 44, seule ou combinée au masque stencil de DRAW-01 (44 sur 44 aussi). Temps GPU sur M5 : non significatif (+0,05 ms [-0,30 ; +0,35] au monde 0), comme attendu sur un GPU à tuiles qui élimine déjà les surfaces cachées.

**Cause.** Le ciel sert de fond et passe donc en premier, sans test de profondeur. L'ordre de soumission ne profite pas du rejet précoce en profondeur.

**Proposition.** 1. Retirer l'appel de skyPass après l'effacement.
2. Le placer après le dernier lot opaque (statiques, nappes, lots, dynamiques, foule) et avant renderEffects(particles) : gl.depthRange(1,1) ; gl.depthMask(false) ; test de profondeur laissé actif (LEQUAL déjà en place) ; skyPass ; gl.depthMask(true) ; gl.depthRange(0,1) ; puis useProgram(program) et bindVertexArray(vao).
3. Dans skyPass, ne plus couper DEPTH_TEST (garder la coupure de CULL_FACE).
4. Avec DRAW-01, le masque stencil reste actif pendant le ciel : aucun fragment de ciel sous l'arme.
5. Aucun changement de shader : depthRange(1,1) donne exactement la profondeur 1, égale à la valeur d'effacement.

Critère d'acceptation : écart maximal 0 sur toutes les images comparées ; sur david-pc, écart de temps GPU non positif.

**Gain attendu.** 70 à 72 % des fragments du ciel en moins sur GPU à rendu immédiat (estimé à partir de la couverture mesurée) ; 0 sur M5 (mesuré).

**Risques.** Aucun changement d'image (prouvé sur 44 images). Le ciel doit rester avant les particules translucides, qui se mélangent par-dessus. Le test renderer-reprises de FERRO compare les commandes : à mettre à jour avec DRAW-01. BITUME et Point de rupture passent par le même skyPass : même image attendue, à rejouer sur leurs scènes.

**Vérifier par.** Dans bench/draw-verif : node gen2.mjs cfg/v8_17.json out/v8_17.html && ./run.sh out/v8_17.html 1440,1000 2 > out/v8_17.json ; lire diffs.skylate et diffs.ws_sky (identicalFrames égal à n). Sur david-pc : même page sans --use-angle=metal, puis python3 -I ../rgpu/paired.py out/v8_17.json base.

### DRAW-V2 — Masque stencil de l'arme : le chemin direct vers le canvas (bloom coupé, qualité basse) n'a pas de stencil ; demander stencil:true au contexte
- sévérité moyenne · catégorie perf-gpu · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1353 (FERRO) / 1276 (METAL); src/renderer.js:1740-1741 (FERRO) / 1566-1567 (METAL); src/game.js:722 (METAL)

**Preuve.** Code : le contexte est créé sans stencil (renderer.js 1353 FERRO / 1276 METAL), et quand le bloom est coupé (option prefs.bloom de METAL, game.js 722) ou en qualité basse, la scène est dessinée directement dans le canvas (bindFramebuffer(null), FERRO 1740). DRAW-01 propose d'y garder le chemin actuel.

Mesures (bench/draw-verif, variantes dessinées avec fx.bloom=false) :
- Masque stencil appliqué sans stencil au contexte : image cassée, 0 image identique sur 18, 9 à 13 % des pixels différents, écart maximal 160 (monde 6, out/v2.json).
- Masque stencil + stencil:true au contexte : image identique sur 28 images sur 28 (mondes 6 et 17) ; temps GPU -0,50 ms [-0,60 ; -0,40] soit -7,2 % (monde 17, 4 répétitions, A/A 0,00 [-0,10 ; 0,00]) et -0,30 ms [-0,40 ; -0,20] (monde 6).
- stencil:true seul, sans changer l'ordre : image identique sur 10 images sur 10, coût non significatif (-0,10 ms [-0,30 ; 0,00]).

**Cause.** Le masque stencil n'existe que sur la cible de scène. Les joueurs qui coupent le bloom ou jouent en qualité basse, donc les machines les plus faibles, resteraient sur l'effacement de profondeur en pleine passe, ou verraient une image fausse si le garde-fou est oublié.

**Proposition.** 1. Créer le contexte avec {alpha:false, antialias:false, depth:true, stencil:true, powerPreference:'high-performance'}.
2. Lire gl.getContextAttributes().stencil ; s'il vaut false, garder l'ancien chemin (effacement de profondeur puis arme en dernier) pour le rendu direct.
3. Un seul code pour DRAW-01, quel que soit le framebuffer : effacement COLOR | DEPTH | STENCIL, arme en premier avec REPLACE, monde en NOTEQUAL.
4. Si le chemin unique de DRAW-12 est adopté plus tard (toujours par la cible de scène), le contexte pourra repasser à depth:false et stencil:false.

Critère d'acceptation : écart maximal 0 avec et sans bloom, et intervalle de confiance du gain GPU sous 0 sans bloom.

**Gain attendu.** -0,3 à -0,5 ms GPU par image sans bloom sur M5 (-6 à -7 %, mesuré), image identique.

**Risques.** Mémoire inchangée sur la plupart des GPU (profondeur 24 bits déjà stockée avec 8 bits de bourrage). Un contexte peut refuser le stencil : d'où le repli de l'étape 2. L'attribut change pour les 3 jeux ; mesuré sans effet sur l'image ni sur le temps quand l'ordre ne change pas.

**Vérifier par.** Dans bench/draw-verif : node gen2.mjs cfg/v2b.json out/v2b.html && ./run.sh out/v2b.html 1440,1000 2 > out/v2b.json && python3 -I ../rgpu/paired.py out/v2b.json nb ; lire les lignes nbws et nbctx et diffs.nbws.identicalFrames.

### DRAW-V3 — Ombres : l'extrapolation de profondeur du receveur n'est pas bornée, un projeteur influence des receveurs situés en amont de lui ; toute réduction de la liste des projeteurs doit en tenir compte
- sévérité moyenne · catégorie 3d-visuel · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:126-133 (FERRO) / 124-131 (METAL); src/renderer.js:134-162 (FERRO) / 132-160 (METAL); src/renderer.js:1613-1618 (FERRO) / 1454-1458 (METAL)

**Preuve.** Code : depthSample compare depth + dot(slope, (centre - uv) × 2) au texel lu (renderer.js 126-133 FERRO / 124-131 METAL), slope étant tiré des dérivées d'écran de la position en espace lumière (138-140), sans borne. Sur une surface presque parallèle aux rayons, la pente est très grande : la profondeur comparée dépasse celle du receveur de plusieurs mètres, et le texel voisin d'une dalle de sol située plus bas l'ombre.

Mesure par bissection sur le filtre de projeteurs du soleil (monde 17, 55 images comparées par variante, contrôle A/A image 55 sur 55) :
- Filtre capsule avec marge de 0,6 m : 7 images différentes sur 55, écart maximal 6 niveaux, jusqu'à 0,12 % des pixels, aux bords gauche et droit de l'écran. Marges de 1,0 et 3,0 m : encore une image différente sur 22.
- Plans latéraux seuls : mêmes 7 images. Plan de l'œil seul, plans haut et bas seuls : 55 sur 55 identiques.
- Filtre limité aux projeteurs de rayon ≥ 3 m : mêmes 7 images. Limité aux petits : 1 image, écart 2. Les rejetés en cause sont des dalles de sol (box 10×0,6×10 m, 24,4×0,4×24,9 m).
- Capsule allongée de 10 m vers le soleil : 55 sur 55 identiques.

**Cause.** Le biais de plan receveur extrapole sans limite. Le volume d'influence d'un projeteur n'est donc pas son ombre géométrique : il remonte vers la lumière, d'une hauteur qui dépend de la pente du receveur. Les optimisations qui retirent ou mettent en cache des projeteurs en raisonnant sur l'ombre géométrique (DRAW-05, DRAW-10, RGPU-03, marge de RCPU-01) ne sont pas identiques à l'image près.

**Proposition.** 1. Règle pour tout filtre ou cache de projeteurs : le volume conservateur d'un projeteur est la capsule allant de c - fw·U jusqu'au fond du volume de lumière, de rayon rayon + 0,6 m, avec U = 10 m (valeur qui donne l'identité sur le monde 17 ; à valider sur les mondes 0 et 6 et sur au moins 300 images).
2. Banc d'acceptation commun à DRAW-05, DRAW-10 et RCPU-01 : comparaison toutes les 2 images (une comparaison toutes les 10 images n'avait vu qu'une image fautive sur 49), écart maximal 0 exigé.
3. Option séparée, coupée par défaut car elle change l'image : borner l'extrapolation dans depthSample, par exemple clamp(dot(slope, (centre - uv) × 2), -k, k) avec k égal à 4 texels de profondeur du volume. Elle supprimerait l'influence en amont et les fausses ombres rasantes ; à juger à l'œil sur les murs éclairés en rasant.

**Gain attendu.** Pas de gain de temps propre : c'est la condition pour que les optimisations de liste de projeteurs tiennent l'exigence d'image identique. Avec U = 10 m, le filtre du soleil garde -23 % d'instances et -31 % d'octets envoyés (4 321 → 3 325 instances, 209,6 → 143,9 Ko, mesuré).

**Risques.** U = 10 m est empirique : la pente n'étant pas bornée, l'identité ne se démontre pas, elle se constate au banc. L'étape 3 modifie les ombres existantes et doit rester une option. Aucun effet sur la simulation ni sur les sauvegardes.

**Vérifier par.** Dans bench/draw-verif : cfg/v3.json à v6.json (variantes suncull, sceye, scside, scvert, scbig, scsmall, scup10, scadd10) ; node gen2.mjs cfg/v6.json out/v6.html && ./run.sh out/v6.html 1440,1000 2 > out/v6.json ; diffs.scup10.identicalFrames doit égaler n.

### DRAW-V4 — Mode démo qui dure : le gouverneur de résolution est coupé hors du mode « playing » ou sans focus, une démo tournerait à résolution figée
- sévérité moyenne · catégorie démo · effort S · gain qualitatif
- ajouté par le contre-vérificateur (non recontrôlé) · qualité sans objet · moteur et jeu
- lieux : src/game.js:722 (METAL); src/renderer.js:806-818 (FERRO) / 746-758 (METAL)

**Preuve.** METAL n'a aucun mode démo aujourd'hui (0 occurrence de « demo » ou « attract » dans game.js, simulation.js, index.html). L'appel de rendu passe adaptive: mode==='playing' && (!prefs.fpsLimit || prefs.fpsLimit>=60) && document.hasFocus() (game.js 722). Le gouverneur ne fait rien quand fx.adaptive n'est pas true : il remet ses compteurs à zéro et rend l'échelle courante (renderer.js 811 FERRO / 751 METAL).

Conséquence par lecture du code : une démo lancée depuis le menu (mode autre que « playing ») ou affichée sans focus (second écran, borne, onglet intégré) garde indéfiniment l'échelle du moment, 1 au départ. Sur une machine trop lente pour la scène, la démo reste lente pendant toute sa durée ; rien ne la rattrape.

**Cause.** L'activation du gouverneur est liée au mode de jeu et au focus, pas au fait qu'une scène 3D animée est réellement affichée.

**Proposition.** 1. METAL : introduire un prédicat unique sceneLive (partie en cours ou démo, hors pause) et passer adaptive: sceneLive && limite d'images compatible. Retirer document.hasFocus() de la condition pour la démo ; garder la mise en veille du rendu quand document.hidden est vrai.
2. FERRO : documenter fx.adaptive comme « scène animée affichée » et ajouter stats.renderScale au relevé de la démo.
3. Banc d'endurance pour « démo qui dure » : avec bench/loop/harness.mjs et l'horloge virtuelle, faire tourner la démo 30 minutes simulées et relever, par tranche de 5 minutes, le temps de draw, les octets envoyés, le nombre d'instances et renderScale. Critère d'acceptation : aucune dérive de plus de 5 % entre la première et la dernière tranche, et une échelle qui baisse puis remonte quand on injecte des images lentes.
4. À coordonner avec RGPU-09, RCPU-08 et LOOP-12, qui refondent le même gouverneur.

**Gain attendu.** Démo fluide sur les machines modestes pendant toute sa durée, au lieu d'une résolution figée.

**Risques.** Le gouverneur actuel réalloue les cibles à chaque palier (RGPU-09) : l'activer en démo expose ces à-coups tant qu'il n'est pas refondu. Sans focus, requestAnimationFrame peut être ralenti par le navigateur : filtrer les intervalles aberrants (déjà borné à 500 ms). Aucun effet sur la simulation ni sur les sauvegardes.

**Vérifier par.** bench/loop/harness.mjs : scénario démo de 30 minutes simulées, relevé de stats.renderScale et du temps de draw par tranche ; test unitaire du gouverneur avec adaptive vrai hors mode « playing ».
