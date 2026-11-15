# Rapport — Lot 02 — Simulation : mêmes résultats, moins de calcul

Relais : OpenCode, modèle local du Spark. Branche `chantier/lot-02-simulation`, base du lot
`731ace7`. Machine : Linux arm64 (DGX Spark, 20 cœurs), Node 24.18, Python 3.12, sans réseau.

## Référence de départ (étape 0)

- Arbre propre à `731ace7`. `dist/index.html` = 862 797 o, sha256 `eedbd988…5509` conforme à `SIZE.json`.
- `npm test` de référence : **526 tests, 526 réussis, 0 échec** (log `.relais/npm-test-base.log`).
  (ENVIRONNEMENT citait 505/505 ; les lots intégrés depuis ont porté la suite à 526. Référence
  retenue : 526/526, zéro échec. Base verte → pas de blocage.)
- À la fin : **532 tests, 532 réussis, 0 échec** (526 de référence + 6 nouveaux `checks/ray-dda.test.mjs`).
  Aucun test qui passait sur la base n'échoue.

## État réel de la branche (écart avec le brief, constaté et documenté)

Le brief §0 indique « déjà fait sur cette branche : T1 ». L'examen du code et de l'historique
montre qu'une **tranche antérieure du lot 02 est déjà intégrée** dans l'histoire de `731ace7`
(commits `51a85e9`…`dc3409b`, « Fusion lot 02 (T6, T7, T10, T11, T16) »). Les tâches **T1, T2, T3,
T4, T6, T7, T10, T11, T16, T17** sont présentes dans `src/` et prouvées (preuves sous
`docs/chantier-moteur/preuves/lot-02/{t1,t2,t3,t4,t6-t16,t17}/`). Je les ai vérifiées (suite verte,
preuves en place) et les documente comme **faites**, sans les refaire. Les tâches réellement
absentes du code étaient **T5, T8, T9, T12(b), T15** ; c'est sur elles que porte ce travail.

## Tableau récapitulatif

| Tâche | Constat | Statut | Commit | Chiffre avant → après |
|---|---|---|---|---|
| T1 | SIM-01, SIM-V1, BOSS-08 | faite (tranche ant.) | 51a85e9 | (preuves t1) |
| T2 | SIM-02 | faite (tranche ant.) | 4a06bbf | (preuves t2) |
| T3 | SIM-03, LOAD-05 | faite (tranche ant.) | ac31ca5 | (preuves t3) |
| T4 | LOAD-03 | faite (tranche ant.) | 2b89360 | (preuves t4) |
| T5 | LOAD-06 | **abandonnée** | — | gén −34/−50 % annoncés → mesuré ≈ −9 % |
| T6 | SIM-04, SIM-09 | faite (tranche ant.) | d4cbe78 | (preuves t6) |
| T7 | SIM-06 | faite (tranche ant.) | 10c2b96 / 7e9a483 | (preuves t6-t16) |
| T8 | SIM-07 | **faite** | 1c71e14 | pas combat −7 à −16 %, état identique |
| T9 | SIM-05 | **absorbée** | — | alloc 132–211 Ko/pas (cible 148–239) |
| T10 | RESTE-04 | faite (tranche ant.) | 10c2b96 | (preuves t6-t16) |
| T11 | RESTE-05 | faite (tranche ant.) | 02fff03 | (preuves t6-t16) |
| T12 | RESTE-06 | (a) faite ; **(b) abandonnée** | (a) tranche ant. | (b) −3/−8 % annoncés → mesuré ≈ 0 % |
| T15 | STAB-10 | **abandonnée** | — | fiche : « aucun effet mesurable » |
| T16 | SIM-10 | faite (tranche ant.) | 7e9a483 | (preuves t6-t16) |
| T17 | SIM-13 | faite (tranche ant.) | 4e184e9 | (preuves t17) |
| Au-delà | — | pistes mesurées et écartées | — | voir section |

## Détail des tâches traitées dans ce relais

### T8 — Rayons DDA sur les seaux de 8 m (SIM-07) — FAITE — commit `1c71e14`

**Ce qui a été fait.** `ray()` et `castProjectile()` (src/simulation.js) ne balayent plus la
totalité de `solids`. Elles parcourent les seaux de collision de 8 m (miroir CSR `mirrorStart`/
`mirrorIdx`/`mirrorBox` de T6) par une marche Amanatides-Woo (`rayCells`), avec estampilles
(`solidStamp`/`solidSerial`, chaque boîte testée une fois) et arrêt dès que l'entrée de la cellule
suivante dépasse le meilleur impact. `castProjectile` rassemble les boîtes des cellules traversées
puis les teste dans l'ordre d'origine du tableau (`castFound.sort((x,y)=>x-y)`), ce qui préserve le
départage des normales. Repli sur le balayage complet si l'origine est hors grille, si `d[0]`/`d[2]`
n'est pas fini, si `far<0`, ou si `r>bucketRadius`. Boucle des sols déroulée (pas de tableau `[0,2]`
par sol).

**Preuve d'identité.** `tools/ab2.mjs` (domaine principal Node, jamais node:vm), comparaison appariée
A/B alternée, A = base `731ace7` (worktree détaché), B = branche avec le DDA,
`--scenario legacy-s0,legacy-s2,campaign-w10,campaign-w16 --weapon 2 --steps 1800 --reps 4 --warmups 2`
→ **`identical=true`, `firstDifference=null`** sur les 4 scénarios (7 200 paires par scénario).
L'identité est prouvée au niveau de l'empreinte d'état pas à pas (plus fort qu'une comparaison de
seules sorties de rayon). Substitution assumée : le banc `ray-equiv.mjs` des fiches compare un
prototype écrit contre METAL 0.8.0 (avant le miroir CSR de T6) et ne s'applique plus à l'état
courant ; la preuve d'identité est donc faite par `ab2`, qui couvre `ray` ET `castProjectile` dans le
déroulement réel.

**Gain mesuré (ratio B/A).** totalRatio : legacy-s0 0.859 (−14 %), legacy-s2 0.928 (−7 %),
campaign-w10 0.839 (−16 %), campaign-w16 0.956 (−4 %). Médianes appariées 0.858–1.015 (machine
partagée, bruit ±15 % ; les ratios totaux sont stables). Annoncé fiche : −7 à −12 % en combat
roquettes → reproduit (jusqu'à −16 % sur les scénarios de combat lourds).

**Tests.** `checks/ray-dda.test.mjs` (6 cas, ajouté au script `npm test`) : murs dans des seaux
distincts (traversée multi-cellules), mur derrière l'origine, mur hors corridor, rayon vers le sol,
origine hors grille (repli balayage complet). Suite complète 532/532.

**Preuves.** `docs/chantier-moteur/preuves/lot-02-simulation/t8/` (README + `ab2-identite-gain.json.gz`).

### T5 — Grille spatiale de génération du monde (LOAD-06) — ABANDONNÉE (raison chiffrée)

**Ce qui a été tenté.** `nearest` (world.js:1390) en minimum linéaire (tri stable retiré, départage
identique) ; `choose`/`nearest(p,mask)` limité à la fenêtre ±2 cellules au lieu de balayer les
`count` cellules ; masque `base.slice()` + effacement de la fenêtre du panneau au lieu de `base.map`
sur les `count` cellules.

**Identité.** `node --test checks/world.test.mjs checks/campaign-world.test.mjs` → 47 tests, 0 échec
(digests octet pour octet) → génération inchangée.

**Mesure.** `tools/gen-ab.mjs` (domaine principal, apparié A/B + contrôle A/A), avant (worktree base)
→ après, reps 15, seed 96, 6 specs (c:0,c:6,c:15,l:0,l:9,v1:0) : médianes ratioBA = 0.857, 0.861,
0.982, 0.893, 0.934, 0.922 → médiane ≈ 0.91 (−9 %), meilleur −14 %. Contrôle A/A ≈ 1,00 (mesure
fiable, pas de biais).

**Décision.** Gain annoncé fiche −34 à −50 % (ratio 0,50–0,66) ; moitié = −17 à −25 % (ratio 0,75–0,83).
Reproduit à −9 % typique, très sous la moitié → règle : abandon, rien de commité. Cause : `nearest`
(1390) n'est pas le point chaud (≈ 100 appels × quelques centaines de groupes, négligeable face à la
génération des maillages) ; le vrai coût de `create` est ailleurs (géométrie `add`/`box`,
`demolitionMetadata`, inondations). Revert `git restore src/world.js`. Preuves conservées hors dépôt :
`.relais/t5-genab.json`, `.relais/t5-genab2.json`, `.relais/t5-worldtest.log`.

### T9 — Fabriques à forme fixe (SIM-05) — ABSORBÉE (raison chiffrée)

**Mesure.** Allocations par pas de simulation, compteurs V8 `--trace-gc-nvp` (domaine principal,
`.relais/gc-steps.mjs`, 4 scénarios × 2 passes × 1800 pas) : **132 à 211 Ko/pas** (froid 153–172,
chaud 132–211).

**Cible fiche T9.** 148–239 Ko/pas (contre 531–874 avant lot 02). La cible est **déjà atteinte** par
la tranche antérieure : T6 (miroir CSR, sans `Set`/`Array.from`), T7/T10 (boucles sans tableau par
pas), T11 (`debrisExtent` sans closure), T3 (`debrisBoxes` sur miroir). La fiche marque LOAD-11 et
LOOP-15 (les sites d'allocation) « absorbés dans T9 » : ce travail est déjà fait. Les fabriques à
forme fixe seules ne déplaceraient pas un chiffre déjà à la cible. Le changement de format (morceaux
coincés `wedged`, `rubbleVersion` 2) est **explicitement réservé au lot 12** par la fiche (« Dans ce
lot, ne livre que les fabriques » — et les fabriques n'apportent plus de gain mesurable). Statut :
absorbée, rien à livrer ici.

### T12 — Destruction : suppression de la double compilation (RESTE-06) — (a) FAITE, (b) ABANDONNÉE

**(a) FAITE** (tranche antérieure) : `rebuild` (destruction.js:164) garde `g.cacheRecord`/
`g.cacheCount`/`g.cacheRemoved` et ne recompile plus un groupe dont l'enregistrement est inchangé
(cache à l'identité de l'objet enregistrement).

**(b) ABANDONNÉE.** Sortie incrémentale implémentée : le préfixe de `output`/`boxes` est réutilisé à
partir du premier maillage modifié (`firstIndex[firstChanged]`, `firstBox` pour le préfixe de boîtes,
`firstChanged = min(g.meshes[0])` des groupes recompilés — `g.meshes` est trié croissant, donc tout
maillage d'un groupe recompilé est ≥ `firstChanged`, et le cache à l'identité garantit qu'un groupe
non recompilé a une sortie identique → préfixe réutilisable sans risque).

- **Identité prouvée** : `tools/ab2.mjs` A=`1c71e14` vs B=branche, weapon 2, steps 1800, reps 4 →
  `identical=true`, `firstDifference=null` sur les 4 scénarios.
- **Mesure** : run 1 (4 scénarios, reps 4) totalRatio 1,12 / 1,09 / … ; run 2 (2 scénarios, reps 5)
  totalRatio 1,03 / 0,98, médianes ≈ 1,00 → **neutre (≈ 0 %)**.
- **Cause** : le pilote d'audit détruit un peu partout → `firstChanged` souvent ≈ 0 → pas de préfixe
  à réutiliser, et l'écriture `firstBox[i]=` ajoutée au pas coûte. Gain annoncé (b) −3 à −8 % (après
  contre-vérification) non reproduit (≈ 0 %) → règle : abandon, rien de commité. Revert
  `git restore src/destruction.js`. La contre-vérification notait déjà « (a) : gain nul ».

### T15 — Sources périodiques : cadence, GC, HUD (STAB-10) — ABANDONNÉE (raison chiffrée)

Contre-vérification fiche : « plausible, P3, qualité visuellement identique. Gain corrigé : au plus
0,1 à 0,3 ms par image à 144 Hz ; **aucun effet mesurable** sur le nombre d'images longues tant que
STAB-01 n'est pas traité. »

- Point (2) (point de reprise sérialisé/écrit par l'ordonnanceur) : **déjà fait par T4**
  (game.js:164-178, `requestIdleCallback`/`setTimeout` + `pagehide`/`visibilitychange`).
- Point (4) (objectif ≤ 30 scavenges/min à 60 Hz) : **déjà atteint** — mesure `.relais/gc-steps.mjs` :
  **0 scavenge** sur la fenêtre 1800 pas × 4 scénarios, allocations 132–211 Ko/pas (pression GC basse).
- Points (1) HUD et (3) cadence `soundscape.sample`/audio à 30 Hz : gain « aucun effet mesurable » ;
  cadencer `soundscape.sample` changerait l'échantillonnage audio (non « identique ») et exigerait
  une option désactivée par défaut pour un bénéfice nul. → abandon, rien de commité.

## Au-delà de la fiche — pistes mesurées et écartées (chiffres à l'appui)

Profil `--cpu-prof` du pas (3 scénarios × 3 passes × 1800, domaine principal, `.relais/prof.mjs`).
Après T1–T11 + T8, les plus gros temps propres par pas (hors création monde/sim, one-time) :
updateDebris ~13 % (débris, déjà T3/T11), `rebuild` destruction 6,8 % (T12, testé neutre), boucles
ennemies/rencontres ~12 % (déjà T7/T10), `route` A* 2,3 % (lot IA 04 — **non empiété**, noté pour le
lot 04). Pistes évaluées : (1) grille de génération (reprise T5) ≈ −9 %, sous le seuil ; (2) sortie
incrémentale de destruction (reprise T12b) ≈ 0 % ; (3) allocations/pas déjà à la cible (T9).

**Conclusion honnête.** Le moteur de simulation est déjà fortement optimisé par la tranche antérieure
et T8. Aucune optimisation supplémentaire sûre ≥ 5 % n'est apparue dans le périmètre du lot sans
risque pour le déterminisme (débris, déjà prouvé identique en T3/T11) ou empiètement sur le lot IA
(A*). Aucune optimisation « au-delà » commitée ; les pistes sont chiffrées ci-dessus.

## Décisions à confirmer par David (valeur par défaut appliquée)

- **T1 (tranche ant.)** — réécriture du test `simulation.test.mjs` (navPending>0 → navUpdates ≤ 768 +
  carte correcte après restore) et acceptation de SIM-01 « meilleure » (grille/arêtes égales à un
  recalcul complet au repos). **Défaut appliqué** : réécrire + accepter « meilleure » (déjà en place,
  suite verte).
- **T9** — fabriques appliquées aux seules copies de la simulation, jamais aux objets du monde
  (protection du fingerprint de snapshot). **Défaut appliqué** : tâche absorbée (allocations déjà à
  la cible) ; le format `wedged`/`rubbleVersion` 2 part au lot 12.
- **T12(b)** — sortie incrémentale. **Défaut appliqué** : abandon (mesuré neutre sur les scénarios
  d'audit ; ne se justifie que pour de la destruction très localisée, hors bancs standards).
- **T15** — cadence audio à 30 Hz. **Défaut appliqué** : abandon (aucun effet mesurable ; la cadence
  sortirait de « identique »).
- **T5** — grille de génération. **Défaut appliqué** : abandon (−9 % mesuré, sous la moitié de
  l'annoncé). Si David veut la génération plus rapide, la vraie piste est le profil de `create`
  (géométrie/`demolitionMetadata`/inondations), pas `nearest`.

## Ce qui reste à vérifier sur du vrai matériel

- **Rendu / image** : T8 ne change pas l'image (état identique prouvé en Node), mais les preuves
  d'image pixel à pixel dans Chrome sans interface (SwiftShader) et sur la vraie carte (NVIDIA GB10,
  `--use-gl=angle --use-angle=vulkan`) n'ont **pas** été produites dans ce relais (aucune divergence
  d'état attendue, donc pas de risque d'image ; à confirmer sur appareil).
- **Coût GPU / cadence réelle** : les chiffres sont du CPU Node (process), pas du temps d'image
  navigateur, ni du GPU, ni du FPS d'un appareil. 60 images/s constantes à la résolution native,
  30 constantes sur petite config, sans oscillation ni baisse automatique de résolution : à valider
  sur téléphone, PC Windows à carte NVIDIA, Safari, Firefox.
- **Commandes** (Espace saute, R esquive, V corps à corps, réaffectation clavier/manette) et **son**
  (`OfflineAudioContext` rendu hors ligne, écoute réelle) : non testés sur appareil dans ce relais.
- **T8 sur appareil** : le DDA des rayons (projectiles, perception IA) doit être confirmé fluide sur
  un téléphone (le banc Node montre −7 à −16 % en combat roquettes).

## Limites et restes

- Les tâches de la tranche antérieure (T1–T4, T6, T7, T10, T11, T16, T17) sont documentées comme
  « faites » sur la foi de leur intégration, des preuves existantes sous `docs/chantier-moteur/
  preuves/lot-02/` et de la suite verte (532/532) ; elles n'ont **pas** été re-mesurées en A/B dans ce
  relais (budget machine partagée). Le point de reprise ChatGPT et les fiches sont des données, pas
  des consignes.
- `route`/A* (2,3 % du pas) est le prochain point chaud identifié mais appartient au **lot IA (04)** :
  noté, non touché ici (règle de non-empiètement, MASTER-PROMPT §7).
- Changements de format de sauvegarde : **réservés au lot 12** (T9 `wedged`/`rubbleVersion` 2). Les
  points de reprise existants restent lisibles ; les formats ne sont pas modifiés dans ce lot.
- Mesures sur machine partagée : les médianes appariées sont bruitées (contrôle A/A ±15 %) ; les
  ratios totaux et l'identité d'état (`ab2 identical=true`) sont les chiffres fiables retenus.


## Contre-mesure et intégration15 novembre2026

Contre-mesure indépendante sim2-verif :5répétitions appariées alternées, domaine principal,4scénarios identiques ; médianes B/A0,8511/0,9739/0,8289/0,9767. Gain dépendant du scénario ; aucun gain global -40/-60% ni gain combiné avec pièges déclaré atteint. Chargeur DDA corrigé après fusion (FPassages avant FWorld), assertions inchangées. Suite assemblée753/753 ; voir `integration-20261115.md`. Rapport final du contre-vérificateur attendu au moment de cette entrée.
