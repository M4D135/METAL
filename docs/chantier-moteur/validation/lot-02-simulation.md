# Validation — Lot 02 — Simulation

Relais : OpenCode, modèle local du Spark. Branche `chantier/lot-02-simulation`, base `731ace7`.
Machine : Linux arm64 (DGX Spark, 20 cœurs), Node 24.18, Python 3.12, sans réseau. Toutes les mesures
sont dans le **processus principal de Node** (jamais `node:vm`) ; les comparaisons sont **appariées et
alternées** avec contrôle A/A (machine partagée).

## Ce qui a été testé, et comment

### Suite de tests complète
- Référence de départ (base `731ace7`) : `npm test` → **526 tests, 526 réussis, 0 échec**
  (`.relais/npm-test-base.log`). Base verte → pas de blocage.
- Après le travail du relais : `npm test` → **532 tests, 532 réussis, 0 échec** (526 de référence +
  6 nouveaux `checks/ray-dda.test.mjs`). **Aucun test qui passait sur la base n'échoue.** Aucun test
  affaibli.
- Tests ciblés relancés : `node --test checks/world.test.mjs checks/campaign-world.test.mjs` → 47/47
  (digests de génération octet pour octet, confirment que la génération du monde est inchangée).

### T8 — Rayons DDA (SIM-07) — commit `1c71e14`
- **Identité d'état** : `tools/ab2.mjs` (domaine principal, A/B apparié alterné), A = base `731ace7`,
  B = branche avec le DDA, `--scenario legacy-s0,legacy-s2,campaign-w10,campaign-w16 --weapon 2
  --steps 1800 --reps 4 --warmups 2` → **`identical=true`, `firstDifference=null`** sur les 4 scénarios
  (7 200 paires/scénario). Couvre `ray` et `castProjectile` dans le déroulement réel.
- **Gain** : totalRatio B/A = 0,859 / 0,928 / 0,839 / 0,956 (−14 % / −7 % / −16 % / −4 %). Annoncé
  fiche −7 à −12 % en combat roquettes → reproduit.
- **Non-régression** : `checks/ray-dda.test.mjs` (6 cas : traversée multi-seaux, mur derrière
  l'origine, mur hors corridor, rayon vers le sol, origine hors grille → repli balayage complet).
- **Taille** : `python3 tools/build.py` → `dist/index.html` = 865 384 o (≤ 1 400 000), sha256 conforme
  à `SIZE.json`.

### T5, T9, T12(b), T15 — tâches non livrées, mesurées
- **T5** (grille de génération) : identité de génération prouvée (47/47) mais gain `tools/gen-ab.mjs`
  ≈ −9 % (médiane), sous la moitié de l'annoncé (−34/−50 %) → abandonnée. Contrôle A/A ≈ 1,00.
- **T9** (fabriques) : allocations/pas mesurées par compteurs V8 `--trace-gc-nvp` (domaine principal)
  = **132–211 Ko/pas**, déjà dans la cible fiche (148–239) → absorbée par T6/T7/T10/T11.
- **T12(b)** (sortie incrémentale) : identité `ab2 identical=true` prouvée, mais gain neutre
  (totalRatio ≈ 1,00 sur 2 runs) → abandonnée.
- **T15** (STAB-10) : contre-vérification fiche « aucun effet mesurable » ; point (2) déjà fait par
  T4 ; point (4) GC déjà atteint (0 scavenge sur la fenêtre mesurée) → abandonnée.

## Ce qui attend un vrai appareil (non testé dans ce relais)

- **Image** : aucune divergence d'état n'a été observée (T8 `identical=true`), donc pas de risque
  d'image attendu, mais les comparaisons pixel à pixel (Chrome sans interface / SwiftShader, plusieurs
  mondes/caméras/moment, format téléphone, repli Canvas 2D) n'ont **pas** été produites.
- **Cadence et GPU** : les chiffres sont du CPU Node (process), pas du temps d'image navigateur, du
  GPU ou du FPS d'un appareil. 60 images/s constantes à la résolution native, 30 constantes sur petite
  config, sans oscillation ni baisse automatique de résolution → à valider sur téléphone, PC Windows à
  carte NVIDIA, Safari, Firefox.
- **Commandes** (Espace/R/V, réaffectation clavier AZERTY/QWERTY et manette) et **son** (rendu hors
  ligne `OfflineAudioContext`, écoute réelle) : à valider sur appareil.
- **T8 sur téléphone** : confirmer la fluidité du DDA (projectiles, perception IA) en conditions réelles.

## Verdict

Le lot 02 est clos côté simulation Node : T8 livrée et prouvée (état identique, −7 à −16 % en combat),
T5/T12(b)/T15 abandonnées avec raison chiffrée, T9 absorbée avec mesure, et les tâches de la tranche
antérieure vérifiées par la suite (532/532). Les garanties « image/son/jeu identiques » reposent sur
l'empreinte d'état Node ; la confirmation navigateur/appareil reste à faire.
