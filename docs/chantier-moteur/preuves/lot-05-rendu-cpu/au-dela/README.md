# Preuves « Au-delà de la fiche » — Lot 05

## Ce qui est mesuré ici

Le profil de `draw()` par étape qui étaye la section « Au-delà de la fiche » du rapport,
et les trois pistes évaluées puis écartées.

## Comment reproduire

```
node tools/proof/lot05/phase-cost.mjs . 300 camp:17 auto
node tools/proof/lot05/phase-cost.mjs . 300 camp:6  auto
```

Le banc n'utilise **aucune copie du moteur** : `tools/render/lot05-instrument.mjs` insère
les compteurs de temps dans `src/renderer.js` à huit ancres exactes et lève une exception
si le code a bougé. Les trois variantes instrumentées utilisées pendant le lot (les fichiers
hors dépôt `renderer-phases.js`, `renderer-t19-sonde.js`, `renderer-t16-sonde.js`) ont été
vérifiées **octet pour octet** identiques à la sortie de ce générateur :

| variante | source d'origine | vérification |
|---|---|---|
| `phases` | `c5d72df:src/renderer.js` | reproduit `renderer-phases.js` à l'octet près |
| `t19-sonde` | `c5d72df:src/renderer.js` | reproduit `renderer-t19-sonde.js` à l'octet près |
| `t16-sonde` | `39dc8c0:src/renderer.js` (T15) | reproduit `renderer-t16-sonde.js` à l'octet près |

Sonde des cellules de la requête de vue (prémisse de T19, écartée pour le chemin WebGL) :

```
node tools/proof/lot05/cell-sonde.mjs . 300 camp:6 auto
```

Sortie sur la tête courante : 164,4 cellules testées par image, 62,7 rejetées (38,11 %),
4 140,9 entrées touchées, 1 547,3 évitées (37,37 %) — conforme à `../t19/`.

## Sortie brute

- `profil-camp17.json`, `profil-camp6.json` : `node tools/proof/lot05/phase-cost.mjs . 300 <monde> auto`,
  rejouées sur la tête **après le revert de T17** (commit `55449a7`). La machine était chargée
  (4,5 à 9,3 sur 20 cœurs) : les microsecondes sont plus hautes que dans le tableau d'origine,
  la **répartition** est la même (ombres ≈ 55 % du dessin).
- `pistes-ecartees.json` : les mesures qui ont fait écarter les trois pistes.

## Ce qui n'est pas prouvé ici

La répartition réelle du bloc d'ombres entre sélection des projeteurs, `packIndexed` et
draws par passe ne peut être départagée qu'avec un vrai GPU (Metal ou D3D11). Sur cette
machine (SwiftShader, sans réseau) les compteurs sont exacts mais les microsecondes d'appel
ne sont pas celles de la cible. Piste notée pour le lot rendu/GPU, non exécutée ici.
