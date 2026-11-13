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

## Tâches non commencées

T8 [RESTE-03], T9 [RCPU-06], T10 [RESTE-07], T11 [RESTE-08], T12 [DRAW-11],
T13 [DRAW-03], T14 [RESTE-01], T15 [RCPU-09], T16 [RCPU-10], T17 [RCPU-11],
T18 [DRAW-04], T19 [DRAW-08]. Aucune n'est abandonnée ni absorbée : elles
attendent d'être reprises, dans l'ordre de la fiche, à partir de `4c2ce9a`.
La reprise est documentée dans `.relais/journal.md` (outils, worktrees,
pièges connus).

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

## Ce qui attend un vrai appareil

- Téléphone : commandes tactiles, absence de défilement pendant le jeu,
  lisibilité, et surtout le coût réel du GPU avec le sur-ensemble de T4/T6
  (la fiche annonçait +15 à 21 % d'instances GPU côté cache ; ici le GPU ne
  reçoit que la sélection exacte, à confirmer sur matériel mobile).
- PC Windows à carte NVIDIA : passes d'ombre et bloom après T2/T3, et le
  comportement de `bufferSubData` sur un tampon encore utilisé (la fiche
  signalait un risque de blocage pilote ; l'orphelinage est à capacité
  constante, sans anneau).
- Safari et Firefox : mêmes passes, plus le repli Canvas2D (T15 non fait).
- Écoute réelle : aucune modification audio dans ce lot, à revalider au
  passage.

## Tests

`npm test` : **519 tests, 519 réussis, 0 échec** (référence de départ :
505/505). Nouveaux fichiers : `checks/renderer-sun-filter.test.mjs`,
`checks/renderer-detail-flags.test.mjs`, `checks/renderer-view-cache.test.mjs`,
`checks/renderer-cull-margin.test.mjs`, `checks/motion-place.test.mjs`, plus
un test ajouté dans `checks/actor-visibility.test.mjs`.
