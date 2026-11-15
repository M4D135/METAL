# Lot 11b / T4 — Tenues du duck corrigées, ondulation à 3 Hz (MIX-V1)

Constat : MIX-V1 (ajout du contre-vérificateur). Classe : **meilleure**.
Rien n'est dégradé : seule la **durée** pendant laquelle la musique reste basse change.

## Le correctif

`duckMusic()` n'avait qu'une logique de tenue : la table `DUCK_HOLD` (0,22 s aux armes
lourdes, 0,18 s au tir) et, à défaut, 0,14 s / 0,28 s. Le pistolet tire tous les 0,32 s :
la musique remontait puis replongeait trois fois par seconde.

Moteur (FERRO, générique) : option `FAudio.create({duck: {classes: [{cues, depth, hold, fixed}]}})`.
Une classe qui nomme un cue prend la main sur sa profondeur et/ou son maintien ;
`fixed: true` ignore le niveau du son (`cueLevel`). **Sans l'option, le calcul est
exactement celui d'aujourd'hui**, ligne pour ligne (test à l'appui).

Jeu (METAL, `src/audio-recipes.js`, chargé après `audio.js`) :

```js
{cues: ['shot'], hold: .36},
{cues: ['fracture', 'rocket', 'grenade', 'grenadeLaunch'], hold: .30}
```

Profondeur inchangée (0,35, celui de la branche depuis le lot 11 — la fiche écrivait
« 0,45 inchangée », qui était la profondeur de la v0.2) ; retour à tau 0,18 s inchangé.

## Reproduire

```sh
node docs/chantier-moteur/bancs/mix/run.mjs $S "mix.html?job=matrix&scenes=a,p&recipes=cur&comps=cur&ducks=cur,curhold&passes=2" 1200 matrix-cur-curhold.json
# avant / après, sur la vraie configuration METAL (recettes + options de src/audio-recipes.js)
node docs/chantier-moteur/bancs/mix/run.mjs $S_A "mix.html?job=matrix&scenes=p&recipes=metal&comps=cur&ducks=cur&passes=3" 1200 metal-avant.json
node docs/chantier-moteur/bancs/mix/run.mjs $S_B "mix.html?job=matrix&scenes=p&recipes=metal&comps=cur&ducks=cur&passes=3" 1200 metal-apres.json
```

`pump.perBurst` est un `[chute, ondulation]` par rafale de la scène (p) :
**0 = SMG 8/s, 1 = pistolet 0,32 s, 2 = pompe 1 s, 3 = roquette 1,2 s**.

## Critère de la fiche, sur le banc tel qu'elle le demande (`ducks=cur,curhold`, recettes actuelles)

| | ondulation pistolet | chute pistolet | marge pistolet p50 |
|---|---:|---:|---:|
| `cur` | 6,30 dB | 9,12 dB | 11,14 dB |
| `curhold` | **0,04 dB** | 6,97 dB | 10,62 dB |

Cible « ondulation pistolet ≤ 1,5 dB » : **tenu** (0,04). Le `p50` de `curhold` (10,62)
tombe au centième sur le 10,62 publié par l'audit dans `bancs/mix/out/pump.json`.
Attention à la lecture : `curhold` change **aussi** la profondeur (0,45, la v0.2), d'où
sa chute moindre — ce n'est pas ce que livre METAL.

## Ce que livre réellement METAL (recettes + options du dépôt, avant contre après)

| Mesure, scène (p), 3 passes, avant → après | avant | après |
|---|---:|---:|
| **ondulation du pistolet** | 6,32 dB | **0,08 dB** |
| chute du pistolet | 9,14 dB | 9,20 dB |
| ondulation SMG / pompe / roquette | 0,01 / 9,28 / 9,10 | 0,01 / 9,24 / 9,08 |
| marge du pistolet, p10 | 14,79 dB | **16,71 dB** |
| marge du pistolet, p50 | 16,91 dB | **19,00 dB** |
| crête de sortie | 0,552 | 0,551 |
| échantillons > 0,875 | 0 | 0 |
| voix volées | 0 | 0 |

La fiche annonçait 5,8 → 0,95 dB ; la mesure rend **6,32 → 0,08 dB**, et la marge du
pistolet **augmente** de 1,9 à 2,1 dB (critère « marge ≥ actuelle » tenu, et au-delà).
Le SMG, la pompe et la roquette sont inchangés au dixième, comme l'annonce le constat.

## Ce qui n'est PAS corrigé par cette tâche, et pourquoi

Le vérificateur signale **pompage 9,36 dB > 4 dB** à la configuration par défaut. Ce
seuil est celui de **MIX-03** (duck en étagère basse 150 Hz −12 dB + large bande ×0,775),
que la fiche classe en **option désactivée par défaut** : la contre-vérification montre
que la musique baisse alors de 11,4 à 13,2 dB RMS large bande, que le grave pompe de
13,7 à 13,9 dB et que la marge des tirs actuels chute de −2,2 à −4,4 dB. Il n'est donc
pas livré ; le banc peut le rendre (`ducks=shelf`, `ducks=shelfmix`) pour l'écoute.
La décision est notée « à confirmer par David », défaut : **non livré**.

## Tests et taille

`node --test checks/audio.test.mjs` : 53/53. Deux assertions du test FEEL-07 ont été
**mises à jour dans ce commit**, parce que le comportement change exprès et que la fiche
le demande : la pompe tient le caniveau 0,30 s (et non 0,22 s) et le SMG 0,36 s (et non
0,18 s). Un test nouveau vérifie que **sans l'option le duck est exactement celui d'avant**
(0,35 et 0,18 s), qu'une classe remplace profondeur et tenue cue par cue, et que
`fixed:true` fait duck un cue que le moteur ne duckait pas.

`npm test` : **530 réussis, 0 échec** (référence 526/526).
`dist/index.html` : 867 749 → **869 908 octets** (+2 159), sha256 conforme à `SIZE.json`.

## Attend du vrai matériel

La musique reste basse 0,18 s de plus après le dernier tir (le retour à tau 0,18 s est
inchangé) : à valider à l'écoute, aucune oreille humaine n'a entendu ces rendus.
