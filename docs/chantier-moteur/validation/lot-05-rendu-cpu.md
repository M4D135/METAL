# Validation — Lot 05 : rendu, coût processeur

Branche `chantier/lot-05-rendu-cpu`, base `35c654a`, tête `4c2ce9a`
(T1 à T7). Rapport complet :
`docs/chantier-moteur/rapports/lot-05-rendu-cpu.md`.

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
  T5 et T6. T7 n'a pas eu de passage pixels séparé : son flux GL est
  byte-identique à la base, ce qui absorbe la preuve pixels.
- Journaux : `.relais/t2-pixels.json` à `.relais/t6-pixels.json`.

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
- Limite honnête : `bench-models.mjs` et les bancs qui instrumentent le
  renderer **par numéros de ligne** ne fonctionnent plus après T2 (les lignes
  ont bougé) ; ils ne font pas partie des preuves ci-dessus.

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

## Ce qui attend un vrai appareil

- **Téléphone** : commandes tactiles, absence de défilement pendant le jeu,
  lisibilité sur petit écran, et coût GPU réel du cache de sélection (la
  fiche prévoyait +15 à 21 % d'instances GPU ; ici le GPU ne reçoit que la
  sélection exacte, à confirmer sur matériel mobile).
- **PC Windows à carte NVIDIA** : passes d'ombre et bloom après le vertex
  shader modifié (T2) et l'upload par capacité (T3) ; surveiller
  `bufferSubData` sur un tampon encore utilisé (risque de blocage pilote
  signalé par la fiche, orphelinage à capacité constante sans anneau).
- **Safari** : mêmes passes WebGL2, plus le repli Canvas2D (tâche T15 non
  réalisée, donc le repli est encore celui d'avant le lot).
- **Firefox** : idem, à valider sur les 14 scénarios en GPU réel.
- **Écoute réelle** : aucune modification audio dans ce lot ; à revalider au
  passage avec les réglages de son existants.
- **Rapport qualité/autonomie** : le gouverneur adaptatif (`governor`) n'a
  pas été mesuré sur appareil réel avec le cache de T4/T6.

## Ce qui n'est pas encore fait

T8 à T19 de la fiche (voir le rapport). La reprise est décrite dans
`.relais/journal.md`.
