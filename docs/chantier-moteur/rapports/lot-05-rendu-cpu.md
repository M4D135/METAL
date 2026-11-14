# Rapport — Lot 05 : rendu, coût processeur

Branche `chantier/lot-05-rendu-cpu`, base du lot `35c654a`.
État à la remise : **T1 à T7 faites, T8 à T19 non commencées** (budget de
conversation épuisé, pas un blocage technique). Journal détaillé :
`.relais/journal.md`.

Mesures : comparaisons appariées alternées sur le même processus
(`tools/proof/render-proof.mjs`), même graine, même scénario. Les ratios
sont des médianes de plusieurs exécutions : la machine est partagée avec un
autre hébergement (charge relevée 4,5 à 9,3 sur 20 cœurs), un relevé isolé
peut s'inverser.

## Tâches faites

### T1 — Filtre des casters du soleil en boucle indexée [RCPU-03] — commit `d6c3974`

`e.p.map` + closure + `filter` remplacés par une boucle indexée sur un
tableau réutilisé, composantes lues hors boucle.

- draw() médian camp:17 : **4,658 → 3,604 ms (ratio 0,774)**, moyenne 5,449 → 4,536 ms.
- banc `alt.mjs` : variante C1 583 µs/image → C2 76 µs/image, comptes identiques.
- preuves : `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t1/`.
- test ajouté : `checks/renderer-sun-filter.test.mjs`.

### T2 — Drapeau de détail et coupure de portée dans le vertex [RCPU-V1] — commit `4a91ea9`

Niveau de détail porté par le drapeau de surface (`+ (e.detail+1)*8`),
coupure de distance calculée dans le vertex shader (`uCullCentre`,
`uCullRange`), `vObject` remis binaire.

- pixels Chrome/SwiftShader : **14/14 scénarios identiques, écart nul**.
- draw() camp:17 : 3,584 → 3,776 ms (**ratio 1,054**) — coût préparatoire
  assumé, le gain vient de T3/T4.
- preuves : `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t2/`.
- test ajouté : `checks/renderer-detail-flags.test.mjs`.

### T3 — Pools de tampons typés et upload par capacité [RCPU-04] — commit `7f1d558`

Scratch `Float32Array` par site, code de forme caché, tri par comptage,
tampons GPU à capacité en puissance de deux avec `bufferSubData` à capacité
constante, raster extérieur `Uint8Array` en cellules de 2 m calculé une fois
par `setWorld`, tableaux de résultat de `query` réutilisés.

- contenu des instances **identique** sur camp:17, camp:6, legacy:0 (digest
  relu dans le tampon à chaque dessin, indépendant de la stratégie de
  téléversement) ; digest rendu discriminant par mutation volontaire.
- pixels Chrome : **14/14 identiques**.
- draw() camp:17 : 3,502 → 3,075 ms (**ratio 0,878**), moyenne 4,247 → 3,787 ms.
- octets téléversés par 200 images : 44,3 Mo en `bufferData` → 60 Ko
  d'allocation + 44,3 Mo en `bufferSubData` sans réallocation.
- pression GC drawonly 1200 images : 0,6 → 0,5 Ko/image repris, un
  Mark-Compact en moins (plafond de la fiche : 0,2 Mo/image).
- preuves : `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t3/`.
- écart à la fiche : la preuve `bench/rcpu/alt.mjs` n'a pas été rejouée base
  contre tête (le banc mesure des variantes internes, pas le code du dépôt).
- taille : renderer.js +3 656 octets (la fiche annonçait +1,5 Ko).

### T4 — Cache temporel à marge pour la vue, le soleil et la torche [RCPU-01] — commit `088f2c6`

Sélection de garde reconstruite seulement quand la caméra sort de la marge
(D = 1 m, θ = 8°), quand la révision du monde change, ou quand le cadrage
n'est plus couvert ; centre du soleil quantifié sur grille de 4 m, requête
étendue 1,74·M ; `renderStatic` compare une empreinte et un compte.

- **flux GL et contenu des tampons byte-identiques** à la base sur
  200 images pilotées × 3 mondes.
- pixels Chrome : **14/14 identiques**.
- draw() camp:17 : **ratio médian 0,8914** sur six exécutions indépendantes,
  tête plus rapide 6 fois sur 6.
- taux de reconstruction (600 images, caméra de visite) : vue 12,2 %,
  soleil 6,3 %, torche 12,2 % (compteur `stats.cache`).
- test ajouté : `checks/renderer-view-cache.test.mjs` (4 tests, comparaison
  image par image avec et sans cache, avec et sans ombres).
- écart à la fiche : l'item (4) « construire la sélection dans l'ordre de
  l'index » n'est **pas** appliqué — le tri décale l'ordre d'émission des
  casters d'ombre et fait différer 30 pixels (écart 16/255) sur les faces
  coplanaires, alors que le critère est l'écart nul.
- bugs corrigés en vérification : marge ajoutée à une portée de niveau nulle
  (le niveau réapparaissait) ; requête élargie laissant passer 24 instances
  hors de la coupure de distance par niveau.
- taille : renderer.js +4 782 octets (la fiche annonçait 2 à 3 Ko).

### T5 — Culling de vue sur les ramassages et le butin [RCPU-07] — commit `f69a532`

`actorVisible(c.x,(c.y||0)+.5,c.z,1.6)` avant `supplyModel`.

- banc pickups camp:6, 3000 images : **38,8 modélisés → 19,2 gardés (−50 %)**
  (la fiche attendait 32,8 → 17,8, soit −46 %).
- models() camp:6 : ratio médian 0,936.
- pixels Chrome : **14/14 identiques** ; 200 images pilotées × 3 mondes :
  −118 instances/image à camp:6 sans changement d'image.
- garde-fou ajouté dans `checks/actor-visibility.test.mjs` : ramassage
  derrière la caméra non modélisé, rayon couvrant les pires branches,
  aucune branche rejetée dans une matrice de passe réelle.
- taille : game.js +178 octets.

### T6 — Marges adaptatives du cache de vue [RCPU-V2] — commit `b3d9f66`

D = clamp(vitesse lissée × 0,15, 1, 16), θ = clamp(vitesse angulaire lissée
× 0,10, 4°, 12°) plafonnée à la moitié de la demi-diagonale, grille du
soleil M = clamp(2D, 4, 16), lissage exponentiel sur 0,25 s. API
`FRender.create(canvas,{cullMargin:'auto'|{distance,angle}|0})`.

- taux de reconstruction 600 images : **11,5 % à 80 m/s** (critère < 15 %),
  **100 % avec D = 1 m fixe** ; 8,2 % à l'arrêt ; 33,8 % en rotation très
  rapide (plafond θ = 12° atteint).
- flux GL et contenu **byte-identiques** à la base : le sur-ensemble reste
  côté processeur, le GPU ne reçoit que la sélection exacte (le garde-fou
  « plafonner les instances GPU hors champ » est donc satisfait).
- pixels Chrome : **14/14 identiques**.
- draw() camp:17 : **ratio médian 1,060** sur cinq exécutions, soit ~6 % de
  plus à caméra lente (mesures sous charge 8,5 à 9,3). T6 vise le taux de
  reconstruction, pas le coût brut.
- test ajouté : `checks/renderer-cull-margin.test.mjs` (4 tests).
- écart à la fiche : un plafond de sur-ensemble à 2,2 × la sélection exacte
  a été implémenté **puis retiré** — il faisait disparaître des objets
  visibles (rattrapé par le test d'équivalence).
- taille : renderer.js +2 256 octets (la fiche annonçait +0,3 Ko).

### T7 — FMotion.place et mount sans allocation [RESTE-02] — commit `4c2ce9a`

`vector` en trois sommes scalaires, `mount` en littéral avec les cinq champs
de mémo préalloués, `place` en scalaires avec mémo par repère (ry, regular,
rz, r0 recalculés seulement si rx change).

- models() camp:6 : **ratio médian 0,753** (la fiche attendait 0,725).
- flux GL et contenu **byte-identiques** à la base sur 3 mondes × 200 images
  (la preuve pixels est absorbée par celle-là).
- test ajouté : `checks/motion-place.test.mjs` — 10 000 poses aléatoires à
  graine fixe, égalité bit à bit contre l'implémentation d'origine.
- garde-fou : aucun code ne modifie `frame.axes` après `mount` (vérifié par
  grep).
- taille : motion.js +718 octets.

## Tâches faites (suite, reprise du 14 novembre)

### T8 — Constructeur de maillage à forme unique [RESTE-03] — commit `9c5b1bc`

- `FRender.mesh(shape,p,s,mat,r,emissive)` devient le constructeur unique des
  maillages dynamiques : un seul littéral de 28 champs, dans le même ordre,
  affecté par tous les producteurs. Les classes cachées du chemin modèles
  tombent de **9 à 1**, les champs dynamiques de 28 à 1.
- `pack()` camp:6 **0,0907 → 0,0474 ms** (ratio 0,523) ; camp:17
  **0,1036 → 0,0502 ms** (ratio 0,485). `draw()+models()` totalP50 ratio 0,964
  (camp:6) et 0,928 (camp:17).
- Pixels Chrome/SwiftShader 14/14 identiques à écart nul ; `npm test` 519/519.
- Preuves : `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t8/`.
- Garde-fou tenu : le constructeur est exporté sur une ligne séparée
  (`window.FRender.mesh=mesh;`) pour ne pas casser les harnais qui remplacent la
  chaîne exacte `window.FRender={create,foliageTriangles};` ; `ground` reste
  `undefined` et jamais `false`, sinon le repli Canvas 2D perd son sol.

### T9 — Tri unique et partition stable dans FEffects.build [RCPU-06] — commit `5d1f74d`

- Un seul tri, puis partition stable par groupes contigus `(structural, rear,
  band)` ; le budget est vérifié dans la boucle de groupe au lieu d'un second
  tri.
- `FEffects.build` p50 **0,284 → 0,144 ms** (ratio 0,507), p95 0,506 → 0,388.
  La fiche annonçait « −50 à −70 % en plus de RCPU-06 » : atteint en bas de
  plage.
- « identical outputs 3000/3000 » dans les deux sens de comparaison ; pixels
  14/14 identiques ; `npm test` 519/519.
- Preuves : `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t9/`.

### T10 — Cache des gravats au repos et sélection K [RESTE-07] — **abandonné**

- Deux écritures testées (WeakMap de pose au repos seule, puis WeakMap +
  sélection par seaux à clé numérique). Sorties identiques (3000/3000 et
  2000/2000) mais **jamais plus rapide** : ratio par paire 1,03 (buckets),
  1,09 (cache seul, camp:17), 1,00 (cache seul, camp:6).
- La fiche annonçait −50 à −70 % de plus que T9 ; la règle d'abandon (moins de
  la moitié du gain annoncé) s'applique. À 115 gravats par image dont 91 au
  repos, la lookup WeakMap coûte plus cher que le `Math.hypot` et les trois
  `clamp` économisés, et le partitionnement en Map coûte plus cher que le tri
  complet de T9.
- Rien de commité ; `src/effects.js` est resté au code T9. Chiffres dans
  `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t10/abandon.json`.

### T11 — FActors.build en scalaires, sans map ni spread [RESTE-08] — commit `b3bfcb2`

- `rotationTo`, `productTo`, `anglesTo` écrivent dans des `Float64Array` du
  module (`MAT`, `MAT2`, `MAT3`, `EUL`) ; `limb()` est entièrement scalaire ;
  `Math.hypot(dx,dy,dz)` remplace le spread ; la regex d'empatement sort de la
  boucle.
- Banc apparié 72 cas : p50 **0,01474 → 0,01147 ms** (ratio 0,779), p95 ratio
  0,783, ratio par paire 0,805 — la fiche annonçait −30 à −40 % de temps :
  atteint.
- Allocations **22,06 → 20,37 Ko/build** (ratio 0,923) : l'objectif −50 % n'est
  pas atteint ici, l'octet restant étant le maillage de 28 champs et ses
  tableaux `p`, `s`, `r` — c'est T17 qui les supprime.
- Sorties identiques 72/72 ; flux GL et contenu des tampons identiques sur trois
  mondes ; `npm test` 519/519.
- Preuves : `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t11/`.

### T12 — Sommets partagés par Map dans la géométrie [DRAW-11] — commit `068b8c8`

- `vertex()` consulte une `Map` clé « six flottants » et renvoie l'indice
  existant. Qualité haute : **2 328 → 596 sommets**, tampon
  **55 872 → 14 304 octets** (0,256) ; moyenne 1 032 → 338 ; basse 648 → 188.
  Indices et plages par forme inchangés.
- La fiche n'annonçait aucun gain de temps acquis (0 ms mesuré sur M5) : le gain
  est le nombre d'exécutions du shader de sommets (−74 % sur les formes
  lisses), utile sur les GPU limités en sommets.
- Pixels 14/14 identiques à écart nul ; 55/55 sur les sept fichiers de rendu ;
  `npm test` 519/519.
- Preuves : `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t12/`.

### T13 — Table d'instances statiques en texture RGBA32F [DRAW-03] — **abandonné**

- Le téléversement statique est déjà à **60 528 octets en 10 appels puis
  0 octet par image** en régime établi (T3 + T4) : la face statique n'a plus
  rien à gagner.
- Face dynamique : **77,5 % (camp:17) et 78,7 % (camp:6)** des lignes changent à
  chaque image (acteurs qui marchent, particules, machinery). Le
  « texSubImage2D des seules lignes touchées » devrait re-téléverser ~78 % de la
  table chaque image ; le −97 % d'octets annoncé demanderait une churn sous
  ~52 %.
- S'y ajoutent les surcoûts que la fiche elle-même signalait : non prototypé,
  4 `texelFetch` par sommet au coût inconnu sur GPU mobiles, un programme de
  plus (compilation 79-111 ms), repli `instanceTable:false` demandé par David.
- Rien de commité. Chiffres dans
  `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t13/abandon.json`.

### T14 — Écrivain d'instances et migration des producteurs [RESTE-01] — **abandonné pour ce lot**

- Image complète mesurée (tas vidé, 400 images) : **92,2 Ko/image à camp:6,
  199,6 Ko/image à camp:17** après T3/T8/T11 — déjà sous le palier corrigé de la
  fiche (350 Ko/image).
- Les producteurs (`models()`) ne pèsent plus que **70,5 et 47,9 Ko/image** :
  même réduits à zéro, il resterait 21,7 et 151,7 Ko/image du côté simulation et
  dessin. La cible « sous 50 Ko/image » n'est donc pas atteignable par la seule
  migration des producteurs.
- Obstacle de contrat : le tampon ne peut pas remplacer les objets lus par le
  tri des translucides (`renderer.js:742`), les drapeaux de surface
  (`renderer.js:711-716`), le filtre des projeteurs d'ombre
  (`renderer.js:1134`), la collecte de vue (`renderer.js:1119`) et tout le repli
  Canvas 2D (`renderer.js:952-1002`), plus douze fichiers de tests qui inspectent
  `m.p`, `m.s`, `m.r`, `m.actorPart`, `m.effectPart`, `m.overlay`.
- Rien de commité ; la tâche est renvoyée vers un lot traitant ensemble
  producteurs et allocation de la simulation. Chiffres dans
  `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t14/abandon.json`.

### T15 — Repli Canvas 2D en boucles indexées, couleurs mémoïsées [RCPU-09] — commit `39dc8c0`

- `polygonPath`/`line` sans spread, `shade` en trois scalaires avec chaîne
  mémoïsée (Map clé `(r<<16|g<<8|b)`, vidée au-delà de 8 192 entrées), `collect`
  en boucles indexées sur tampons réutilisés, `maskGround` en min/max indexés,
  comparateur de `paint()` sur clés précalculées avec la même relation binaire.
- `renderer.draw` seul, ctx silencieux, paires alternées, 300 images :
  camp:6 auto p50 **33,443 → 31,380 ms** (ratio 0,938, par paire 0,954) ;
  legacy:0 neutre (0,991) ; camp:6 low sous le bruit (1,020 à 7 ms/image).
- **Flux d'appels ctx identique** sur 300 images dans les trois configurations.
- `clip()` accepte désormais le nombre d'entrées réellement valides, seul
  changement d'API interne nécessaire aux tampons réutilisés.
- Preuves : `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t15/canvas.json` ;
  `npm test` 519/519.

### T16 — VAO par couple (tampon, forme) [RCPU-10] — **abandonné**

- Les compteurs confirment la premise : **253,18 `vertexAttribPointer` par
  image**, 57 % des 446,8 appels, exactement 4 par dessin.
- Sonde « un seul appel au lieu de quatre » (190 appels GL supprimés par image) :
  ratio 1,16 à camp:17 et 0,98 à camp:6 — le signe change selon le monde, c'est
  du bruit. Si ces appels coûtaient plus de 150 µs, l'écart serait visible.
- L'audit corrige lui-même le gain à 10-15 µs (0,1 à 0,3 ms annoncé) et fixe la
  valeur par défaut : « ne pas implémenter les VAO pour le gain de temps (mesuré
  nul sur Metal) ». Aucun Metal ni ANGLE D3D11 sur cette machine pour
  redémontrer le µs/appel.
- Rien de commité. Chiffres dans
  `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t16/abandon.json`.

### T17 — Réservoir de maillages d'acteurs par ennemi [RCPU-11] — commit `2f311a3`

- `mesh()` devient `meshInto(o,...)` + `mesh(...) = meshInto({},...)` ;
  `FActors.build` accepte `options.pool` (un tableau par ennemi), recycle le
  maillage de son rang et réécrit la position dans son tableau `p` ;
  `game.js` tient `actorMeshes`, vidé au reset et à l'écart d'un ennemi.
- `FActors.build` apparié : p50 **0,01720 → 0,01365 ms** (ratio 0,794), p95
  0,773, par paire 0,892 — en plus des 0,779 de T11.
- Allocations **21,45 → 2,39 Ko/build** (ratio 0,111). `models()` seul :
  **70,7 → 2,5 Ko/image** à camp:6, 49,3 → 35,8 à camp:17.
- Sorties identiques 72/72 ; flux GL et contenu identiques sur trois mondes ;
  pixels 14/14 à écart nul ; `npm test` 519/519.
- Le réservoir est optionnel : les tests appellent `build` sans pool.
- Preuves : `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t17/`.

### T18 — Mesure des appels GL et correction de l'estimation [DRAW-04] — commit `b4cc615`

- Mesuré (600 images) : **446,8 appels par image** à camp:17 (420,2 à camp:6),
  67,69 dessins, 6,6 appels par dessin, **20,7 appels redondants** (4,6 %).
  Répartition : 253,18 `vertexAttribPointer`, 63,3 `drawElementsInstanced`,
  34,65 `uniform3fv`.
- La plage de l'audit (409-454) est confirmée ; les « 50 appels redondants »
  deviennent 20,7 mesurés. Les µs par appel (0,03-0,10 µs sur ANGLE Metal)
  restent ceux du profil M5 de l'audit : non redémontrables ici.
- Aucun fichier de `src/` modifié. Preuve :
  `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t18/appels-gl.json`.

### T19 — Sphère englobante par cellule dans la requête de vue [DRAW-08] — commit `2eef47a`

- Les cellules de 8 m gardent somme/minimum/maximum de hauteur ; `query()` teste
  la sphère de cellule (rayon 4√2 + demi-hauteur + rayon maximal du niveau) avec
  `visibleSphere()`, exactement l'expression de `visible()`, avant de toucher les
  entrées. Deux appelants fournissent un frustum : le repli Canvas 2D et les
  projeteurs d'ombre de lampe.
- Mesuré (300 images, sonde instrumentée) : 164,4 cellules testées par image,
  **38 % rejetées**, **37 à 39 % des entrées touchées évitées** selon le monde.
  L'audit annonçait « environ deux tiers » : un peu plus de la moitié, au-dessus
  du seuil d'abandon.
- Dessin Canvas 2D p50 33,19 → 32,56 ms (ratio 0,981). Flux GL et contenu
  identiques sur trois mondes, flux ctx identique, pixels 14/14 à écart nul,
  `npm test` 519/519.
- Le chemin WebGL n'est **pas** filtré à la cellule : `selectionCache` construit
  un sur-ensemble temporel validé par marge d'angle et de translation ; y
  appliquer `visible()` laisserait disparaître un objet que le filtre exact d'une
  image ultérieure, dans la marge, aurait gardé.
- Preuves : `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t19/`.

## Au-delà de la fiche

Profil de la tête de branche (`node tools/proof/lot05/phase-cost.mjs . 300
<monde> auto`, compteurs insérés dans `src/renderer.js` par
`tools/render/lot05-instrument.mjs`, variante `phases`, 300 images ; rejoué
après le revert de T17, sortie brute dans
`docs/chantier-moteur/preuves/lot-05-rendu-cpu/au-dela/`) :

| étape de `draw()` | camp:17 (ms/image) | camp:6 (ms/image) |
|---|---|---|
| ombres (3 passes) | 2,376 | 1,758 |
| statique (`renderStatic`+`renderBatch`) | 0,795 | 0,725 |
| vue (cache + boucle `shown`) | 0,639 | 0,344 |
| effets | 0,202 | 0,119 |
| lumières | 0,154 | 0,101 |
| dynamique (`pack` + upload) | 0,083 | 0,074 |
| post | 0,029 | 0,029 |
| **`draw()` complet** | **4,315** | **3,181** |
| `models()` | 0,800 | 0,557 |

Les microsecondes dépendent de la charge de la machine (relevée 4,5 à 9,3 sur
20 cœurs) : ce qui est stable et ce qui compte ici est la **répartition**,
avec le bloc d'ombres à ≈ 55 % du dessin dans les deux mondes.

Le poste dominant est le **bloc d'ombres** (≈ 55 % du dessin), devant la
statique et la vue. Trois pistes ont été évaluées et écartées sur mesures ou
sur garde-fou, aucune n'est commitée :

1. **Pré-filtre par cellule dans `selectionCache` (vue et torche)** — le sur-
   ensemble est réutilisé tant que la caméra reste dans la marge (1,03 m de
   distance et 7,41° d'angle mesurés à camp:17 ; reconstructions 44/300 images
   = 14,7 %). Le texte de ce rapport annonçait « 0,029 m de distance » : c'est
   le coût de l'étape « post » en ms/image, recopié au mauvais endroit ; la
   marge mesurée est 1,03 m, son plancher adaptatif est 1 m.
   Filtrer à la construction avec le frustum de cette image reviendrait à faire
   disparaître un objet que le filtre exact d'une image suivante, dans la marge,
   aurait gardé : même risque que l'étape 3 de DRAW-08, coupée par la fiche. Le
   gain était de toute façon borné à 14,7 % des images.
2. **Réutilisation du jeu de projeteurs du soleil entre deux images** — le jeu
   est recalculé chaque image sur `sunCache.candidates` ; le réutiliser par pas
   de quantification introduirait une ombre portée avec une image de retard,
   explicitement refusée par la fiche (apparition retardée).
3. **Moins d'appels GL dans les passes d'ombre (VAO)** — mesuré en T16 :
   supprimer 190 appels par image ne déplace pas la mesure.

Piste ouverte, non traitée faute de matériel : la répartition réelle du bloc
d'ombres entre sélection des projeteurs, `packIndexed` et draws par passe ne
peut être départagée qu'avec un vrai GPU (Metal ou D3D11) ; sur cette machine
(SwiftShader, sans réseau), les compteurs sont exacts mais les microsecondes
d'appel ne sont pas celles de la cible. Elle appartient au lot rendu/GPU, pas à
celui-ci, et y est donc notée plutôt qu'exécutée.


## Décisions à confirmer par David

1. **T4, ordre de la sélection** — défaut appliqué : ordre de balayage de
   l'index spatial, pas de tri par index. Le tri fait différer 30 pixels sur
   les faces coplanaires.
2. **T6, plafond de sur-ensemble** — défaut appliqué : aucun plafond. Le
   plafond testé (2,2 × la sélection exacte) faisait disparaître des objets.
3. **T6, draw() +6 % à caméra lente** — défaut appliqué : marges adaptatives
   actives (`cullMargin:'auto'`). Revenir en arrière possible par
   `{cullMargin:{distance:1,angle:8°}}` sans toucher au code.
4. **T2, surcoût de +5 %** — défaut appliqué : conservé, nécessaire à T3/T4.
5. **Taille** — renderer.js +10 694 octets cumulés (107 954 → 118 648) et
   motion.js +718, contre ~5 Ko annoncés par les fiches. dist :
   **852 012 → 863 602 octets bruts**, gzip **260 779 → 264 901 octets**.
   Ces chiffres sont bruts ; la taille compressée n'est pas la taille brute,
   et le navigateur est exclu de la comparaison avec un exécutable natif
   (`SIZE.json` reste l'autorité de mesure).
6. **T13, table d'instances en texture** — défaut appliqué : non implémentée.
   Le téléversement statique est déjà à 0 Ko/image en régime établi et la churn
   des lignes dynamiques (77-79 % par image) annule le gain annoncé. À
   réexaminer seulement sur un GPU mobile réel.
7. **T14, écrivain d'instances** — défaut appliqué : non migré. L'image est déjà
   à 92-200 Ko/image, sous le palier corrigé de 350 Ko ; la cible de 50 Ko
   suppose de traiter la simulation en même temps. Les producteurs restent sur
   le constructeur d'objets, que le repli Canvas 2D exige.
8. **T16, VAO** — défaut appliqué : non implémentés, conformément à la valeur par
   défaut de la fiche (gain mesuré nul sur Metal, non redémontrable ici).
9. **T17, réservoir de maillages** — défaut appliqué : recyclage activé en jeu,
   optionnel à l'appel. Aucun consommateur ne garde les maillages d'une image à
   l'autre (vérifié : `pack` copie, le cache d'ombres du repli ne mémorise
   jamais un maillage dynamique).
10. **T19, filtrage par cellule** — défaut appliqué : activé seulement là où le
    filtre par entrée est exactement `visible()` dans la même image (repli Canvas
    2D, projeteurs d'ombre de lampe). Pas de filtrage dans le sur-ensemble
    temporel, qui doit rester un sur-ensemble.

## Ce qui attend un vrai appareil

- Téléphone : commandes tactiles, absence de défilement pendant le jeu,
  lisibilité, et surtout le coût réel du GPU avec le sur-ensemble de T4/T6
  (la fiche annonçait +15 à 21 % d'instances GPU côté cache ; ici le GPU ne
  reçoit que la sélection exacte, à confirmer sur matériel mobile).
- PC Windows à carte NVIDIA : passes d'ombre et bloom après T2/T3, et le
  comportement de `bufferSubData` sur un tampon encore utilisé (la fiche
  signalait un risque de blocage pilote ; l'orphelinage est à capacité
  constante, sans anneau).
- **Metal (M5) et ANGLE D3D11 (david-pc)** : relancer `out/glcost.html` avant
  toute décision VAO (T16) et avant de rouvrir T13 ; les µs par appel de l'audit
  n'ont pas pu être redémontrés ici (Chrome en SwiftShader uniquement).
- GPU mobiles : le coût des 4 `texelFetch` par sommet (T13) et l'intérêt d'une
  table d'instances en texture restent mesurables uniquement sur cible.
- Safari et Firefox : mêmes passes, plus le repli Canvas 2D désormais optimisé
  (T15) et filtré par cellule (T19) — la parité visuelle est prouvée en
  SwiftShader, pas sur ces navigateurs.
- Écoute réelle : aucune modification audio dans ce lot, à revalider au
  passage.

## Tests

`npm test` : **519 tests, 519 réussis, 0 échec** (référence de départ :
505/505). Nouveaux fichiers : `checks/renderer-sun-filter.test.mjs`,
`checks/renderer-detail-flags.test.mjs`, `checks/renderer-view-cache.test.mjs`,
`checks/renderer-cull-margin.test.mjs`, `checks/motion-place.test.mjs`,
`checks/mesh-constructor.test.mjs`, plus un test ajouté dans
`checks/actor-visibility.test.mjs`.

Preuves navigateur pour chaque tâche touchant l'image :
`node tools/render/lot05-pixels.mjs --base <avant> --head . --out <preuve>
--tmp /tmp/opencode` — 14 captures (mondes, caméras, moments, téléphone, repli
Canvas 2D), identiques à écart nul pour T8, T9, T12, T17, T19.
