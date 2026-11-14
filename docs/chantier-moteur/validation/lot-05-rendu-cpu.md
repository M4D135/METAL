# Validation — Lot 05 : rendu, coût processeur

Branche `chantier/lot-05-rendu-cpu`, base `35c654a`, tête `b4cc615`
(T1 à T19, dont quatre abandons sur mesures : T10, T13, T14, T16). Rapport
complet : `docs/chantier-moteur/rapports/lot-05-rendu-cpu.md`.

## Ce qui a été testé, et comment

### Suite automatique

- `npm test` complet : **519 tests, 519 réussis, 0 échec** (référence de
  départ du lot : 505/505). Journaux : `.relais/npm-test-t1.log` à
  `.relais/npm-test-t7.log`.
- `python3 tools/build.py` relancé à chaque tâche ; `SIZE.json` régénéré et
  commité avec chaque tâche.

### Identité d'image (GPU réel)

- `tools/render/lot05-pixels.mjs` : Chrome sans interface, moteur SwiftShader
  (ANGLE Vulkan), 14 scénarios — camp:17 et camp:6 sous trois angles de
  caméra, qualité basse et haute, ombres coupées, deux formats téléphone,
  deux scénarios Canvas2D. Comparaison pixel à pixel base contre tête.
- Résultat : **14/14 identiques, écart de canal maximal 0**, pour T2, T3, T4,
  T5, T6, puis **T8, T9, T12, T17, T19**. T7 n'a pas eu de passage pixels
  séparé : son flux GL est byte-identique à la base, ce qui absorbe la preuve
  pixels.
- Journaux : `.relais/t2-pixels.json` à `.relais/t6-pixels.json`, puis
  `docs/chantier-moteur/preuves/lot-05-rendu-cpu/t{8,9,12,17,19}/pixels.json`.

### Identité de la scène rendue (hors navigateur)

- `tools/proof/render-proof.mjs --mode stream` : faux WebGL2 enregistreur,
  vraie partie pilotée sur 200 images, trois mondes. Deux empreintes :
  le flux de commandes GL, et le **contenu réellement présent dans le tampon
  d'instances à chaque dessin** (relu dans le tampon, donc indépendant du
  passage de `bufferData` à `bufferSubData`).
- Résultat : **flux et contenu byte-identiques à la base** pour T3, T4, T6,
  T7 ; pour T5 le contenu baisse du seul fait des ramassages écartés, sans
  changement d'image.
- Le digest a été rendu **discriminant** par une mutation volontaire du
  contenu (changement de matériau dans `pack`) : l'empreinte change.

### Coût

- `tools/proof/render-proof.mjs --mode cost` : comparaison appariée alternée
  (les deux versions dans le même processus, en alternance, même graine),
  400 images × 5 répétitions, médianes. Relancé 3 à 6 fois par tâche, ratio
  retenu = médiane, car la machine est partagée (charge relevée 4,5 à 9,3
  sur 20 cœurs). Le suivi de contenu de l'enregistreur est désactivé en mode
  coût (il pénalisait injustement le code à `bufferData`).
- Bancs de l'audit réutilisés : `pickups.mjs` (T5), `alt.mjs` (T1),
  `gc-bench.mjs` (T3).
- Bancs écrits pour la reprise (dans `.relais/bancs/lot05/`, comparaisons
  appariées base/tête sur deux worktrees) : `pack-cost.mjs` (T8),
  `effects-ab2.mjs` (T9, T10), `actors-cost.mjs` (T11, T17),
  `geometry-sonde.mjs` (T12), `row-churn.mjs` (T13), `alloc-image.mjs` et
  `alloc-models.mjs` (T14), `canvas-cost.mjs` (T15, T19), `glcalls.mjs`
  (T16, T18), `cell-sonde.mjs` (T19), `phase-cost.mjs` (étape « au-delà »).
- Limite honnête : `bench-models.mjs` et les bancs qui instrumentent le
  renderer **par numéros de ligne** ne fonctionnent plus après T2 (les lignes
  ont bougé) ; ils ne font pas partie des preuves ci-dessus.
- Limite de mesure : les microsecondes par appel GL et le coût réel du bloc
  d'ombres supposent un GPU cible. Ici Chrome tourne en SwiftShader, sans
  Metal ni D3D11 et sans réseau : les **compteurs** d'appels sont exacts, les
  **µs/appel** restent ceux du profil M5 de l'audit.

### Tests de non-régression ajoutés

- `checks/renderer-sun-filter.test.mjs` — le filtre du soleil suit la caméra
  malgré le tableau réutilisé.
- `checks/renderer-detail-flags.test.mjs` — lignes statiques porteuses du
  niveau de détail, dynamiques à zéro.
- `checks/renderer-view-cache.test.mjs` — sélection identique image par image
  avec et sans cache (invalidation forcée), avec et sans ombres ; cache
  réellement réutilisé ; invalidation immédiate sur changement de monde.
- `checks/renderer-cull-margin.test.mjs` — taux de reconstruction < 15 % à
  80 m/s, marge fixe respectée, `cullMargin:0` identique au sans-cache, marge
  qui redescend après un arrêt.
- `checks/motion-place.test.mjs` — 10 000 poses aléatoires à graine fixe,
  égalité bit à bit de `mount` et `place` contre l'implémentation d'origine.
- `checks/actor-visibility.test.mjs` — ramassage derrière la caméra non
  modélisé, rayon de garde couvrant les pires branches, aucune branche
  rejetée dans une matrice de passe réelle.
- `checks/mesh-constructor.test.mjs` (T8) — le constructeur unique produit les
  28 champs dans l'ordre, `ground` reste `undefined`, et les producteurs ne
  créent plus qu'une seule classe cachée.

## Ce qui attend un vrai appareil

- **Téléphone** : commandes tactiles, absence de défilement pendant le jeu,
  lisibilité sur petit écran, et coût GPU réel du cache de sélection (la
  fiche prévoyait +15 à 21 % d'instances GPU ; ici le GPU ne reçoit que la
  sélection exacte, à confirmer sur matériel mobile).
- **PC Windows à carte NVIDIA** : passes d'ombre et bloom après le vertex
  shader modifié (T2) et l'upload par capacité (T3) ; surveiller
  `bufferSubData` sur un tampon encore utilisé (risque de blocage pilote
  signalé par la fiche, orphelinage à capacité constante sans anneau).
- **Metal (M5) et ANGLE D3D11 (david-pc)** : relancer `out/glcost.html` avant
  toute décision VAO (T16 abandonnée sur ce critère) et avant de rouvrir T13 ;
  les µs par appel n'ont pas pu être redémontrés ici.
- **GPU mobiles** : coût des 4 `texelFetch` par sommet (T13) et intérêt d'une
  table d'instances en texture, mesurables seulement sur cible.
- **Safari et Firefox** : mêmes passes WebGL2, plus le repli Canvas 2D
  désormais optimisé (T15) et filtré par cellule (T19) — la parité visuelle
  est prouvée en SwiftShader sur 14 scénarios, pas dans ces navigateurs.
- **Écoute réelle** : aucune modification audio dans ce lot ; à revalider au
  passage avec les réglages de son existants.
- **Rapport qualité/autonomie** : le gouverneur adaptatif (`governor`) n'a
  pas été mesuré sur appareil réel avec le cache de T4/T6.

## Ce qui reste ouvert

Quatre tâches abandonnées sur mesures, chacune avec ses chiffres dans
`docs/chantier-moteur/preuves/lot-05-rendu-cpu/` : T10 (cache des gravats),
T13 (table d'instances en texture), T14 (écrivain d'instances — à reprendre
avec l'allocation de la simulation), T16 (VAO — à reprendre après une mesure
sur Metal ou D3D11). L'étape « au-delà » est documentée par un profil
d'étapes de `draw()` et trois pistes écartées, sans commit supplémentaire.
