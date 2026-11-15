# Validation — Lot 05 : rendu, coût processeur

Branche `chantier/lot-05-rendu-cpu`, base `35c654a`, tête `a7cefc6`
(cette page est commitée un cran au-dessus)
(T1 à T19, dont **cinq** abandons sur mesures : T10, T13, T14, T16, et T17
annulée par `55449a7`). Rapport
complet : `docs/chantier-moteur/rapports/lot-05-rendu-cpu.md`.

## Ce qui a été testé, et comment

### Suite automatique

- `npm test` complet : **529 tests, 529 réussis, 0 échec** (référence de
  départ du lot : 505/505 ; à la remise du lot avant contre-vérification :
  519/519 ; après les correctifs du tour 1 : 525/525). Journaux :
  `.relais/npm-test-t1.log` à `.relais/npm-test-t7.log`, et
  `.relais/npm-test-t2a.log` pour les correctifs du tour 2.
- `python3 tools/build.py` relancé à chaque tâche ; `SIZE.json` régénéré et
  commité avec chaque tâche.

### Identité d'image (GPU réel)

- `tools/render/lot05-pixels.mjs` : Chrome sans interface, moteur SwiftShader
  (ANGLE Vulkan), 14 scénarios — camp:17 et camp:6 sous trois angles de
  caméra, qualité basse et haute, ombres coupées, deux formats téléphone,
  deux scénarios Canvas2D. Comparaison pixel à pixel base contre tête.
- **Couverture du chemin dynamique** : la page `tools/render/pages/lot05-scene.html`
  posait 90 maillages sur sept noms de forme, dont quatre (`cone`, `torus`,
  `pyramid`, `prism`) n'existent pas dans le moteur (`src/renderer.js`,
  `const names = ['box','sphere','cylinder','octa','ring','bevel','foliage']`)
  et étaient donc écartés par `pack` : seules 3 des 90 maillages étaient
  réellement dessinées. Les noms ont été remplacés par les formes réelles.
  Après correction, 14/14 identiques à écart nul, et le nombre d'instances
  dessinées augmente de **+51 exactement** sur chacun des douze scénarios WebGL
  (90 × 4/7 = 51,4), ainsi que les appels de dessin du repli Canvas 2D
  (2 153 → 2 224 et 700 → 735). Sortie brute :
  `docs/chantier-moteur/preuves/lot-05-rendu-cpu/pages/pixels-base-head.json`.
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
  `gc-bench.mjs` (T3). **Limite, vérifiée au tour 2** : ces trois bancs ne
  tournent plus sur les sources actuelles — leur `harness.mjs` ne charge pas
  `src/fmath.js` et lève « FWorld: charger src/fmath.js avant src/world.js ».
  Les captures `t1/banc-alt-C.txt` et `t5/` restent des traces historiques.
  L'équivalent maintenu est `tools/proof/lot05/` (scène portées par
  `tools/proof/render-scene.mjs`), seul utilisé désormais pour les preuves
  rejouées, dont `t3/gc-par-image.json`.
- Bancs écrits pour la reprise (dans `tools/proof/lot05/`, comparaisons
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
  créent plus qu'une classe cachée **par forme** (6 formes réelles, donc 6
  classes, mesuré aux natives par `tools/proof/lot05/mesh-shape.mjs` :
  `formesDeClassesCachees: 6`, `partMemeClasseCachee: 1`, 0 clé ajoutée après
  création contre 29 150 avant T8).
- `checks/actors-no-mesh-pool.test.mjs` (annulation de T17, `55449a7`) —
  `meshInto` absent de `FRender`, aucun maillage ni aucune position recyclés
  entre deux `FActors.build`, rien de retenu du tableau de l'appelant. Vérifié
  qu'il échoue bien sur `2f311a3`, le commit de la tâche annulée.
- `checks/lot05-bancs.test.mjs` (correctifs du tour 2) — tout import relatif
  des bancs de `tools/proof/` et tout chemin de banc ou de doc cité par une
  preuve du lot 05 doivent exister dans le dépôt ; `writeFileSync` doit être
  importé par tout banc qui écrit. Ce garde-fou est `not ok` sur `bdd3f2d`, où
  `gc-bench.mjs` et `effects-ab.mjs` importaient un `harness.mjs` jamais
  committé.

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

Cinq tâches abandonnées sur mesures, chacune avec ses chiffres dans
`docs/chantier-moteur/preuves/lot-05-rendu-cpu/` : T10 (cache des gravats),
T13 (table d'instances en texture), T14 (écrivain d'instances — à reprendre
avec l'allocation de la simulation), T16 (VAO — à reprendre après une mesure
sur Metal ou D3D11), et **T17 (réservoir de maillages d'acteurs)**, annulée par
`55449a7` après coup : le banc apparié la mesurait à 1,33 en isolé et 1,13 sur
`models()`, une régression. Elle reste sous garde-fou
`checks/actors-no-mesh-pool.test.mjs`. L'étape « au-delà » est documentée par un
profil d'étapes de `draw()` et trois pistes écartées, sans commit supplémentaire.


## Complément de contre-vérification Codex — 14 novembre 2026

La contre-vérification tour 2 porte sur `bdd3f2d`. Deux commandes de preuve
(`effects-ab.mjs`, `gc-bench.mjs`) importaient un `harness.mjs` absent. Elles
utilisent désormais la scène maintenue `tools/proof/render-scene.mjs` ; le banc
GC conserve ses modes full, simonly, drawonly, renderonly et son prototype
optionnel. Le banc des effets sort en échec si les contenus divergent.

Contrôles du correctif : 30/30 contenus identiques pour les effets, quatre modes
GC exécutés avec succès, et somme des phases calculée sans additionner une
deuxième fois le total. Les temps de ces contrôles courts ne prouvent aucun gain.
Les anciens JSON restent des traces historiques ; pour un A/B entre révisions,
utiliser `effects-ab2.mjs` avec deux racines explicites et le banc lockstep.

Deux précisions du rapport tour 2 restent applicables : T8 comporte six classes
cachées, et le recyclage T17 est annulé. Les formulations antérieures « une seule
classe » ou « recyclage activé en jeu » ne décrivent donc pas cette tête. Aucun
code du jeu ni artefact dist n'est modifié par ce correctif d'outillage.

Journaux : `/home/m4d135/work/codex-blocages-20261114/render-tools-smoke.json`,
`render-effects-smoke.log` et `render-phases.json`.

## Contre-vérification et correctifs — tour 2, 15 novembre 2026

Reprise des huit problèmes relevés par le contre-vérificateur sur `bdd3f2d`.
Détail complet par problème dans
`docs/chantier-moteur/rapports/lot-05-rendu-cpu.md`, section « Contre-vérification
et correctifs ». Ce qui a été **rejoué sur cette machine** (Spark, Node 24.18) :

- les deux bancs cassés tournent : `node tools/proof/lot05/gc-bench.mjs . 300 camp:17`
  et `node tools/proof/lot05/effects-ab.mjs .relais/t8 300 camp:17` (300/300 sorties
  identiques) ;
- preuve T3 rejouée sur le banc corrigé (`record:false`, modes `drawcall` et
  `drawnone`) : `draw()` 0,64 → 0,32 Mo repris par image, ratio 0,50, plancher du
  banc 0 — le plafond de la fiche (0,2 Mo) n'est pas atteint, et c'est écrit tel quel ;
- preuve T9 rejouée en apparié (`effects-ab2.mjs`, trois exécutions de 1200 images,
  1200/1200 identiques) : ratioP50 médian 0,665, intervalle 0,647 – 0,751 ;
- garde-fou `checks/lot05-bancs.test.mjs` ajouté à `npm test` et vérifié `not ok`
  sur `bdd3f2d` (c'est le problème 1 lui-même qu'il attrape) ;
- `npm test` complet : 529/529, 0 échec (525 avant ces correctifs, 505 à la base du lot).
