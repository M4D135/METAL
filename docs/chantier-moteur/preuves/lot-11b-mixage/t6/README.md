# Lot 11b / T6 — Annonce du boss audible : le mixage livré, la partie son renvoyée à BOSS-04 (MIX-05)

Constat : MIX-05. Classe : **meilleure**. La fiche pose une dépendance : **BOSS-04
(lot-10 T7), non intégré dans cette branche**.

## Ce qui est livré ici

Les trois leviers de **mixage** demandés par la fiche, sans toucher au dessin sonore :

1. **Portée** — `bossTell: 90` dans `ranges` de `src/soundscape.js`. L'annonce héritait
   des 36 m par défaut du décor : à 17 m elle était traitée comme un bruit de fond.
2. **Plancher de niveau dans l'enclos** — `level = max(0,6, niveau localisé)` pour les
   quatre annonces (`bossTell`, `bossRoar`, `bossImpact`, `bossPhase`) tant que le joueur
   est dans `world.bossArena` (rayon 28, à moins de 5 m de hauteur), **panoramique et
   occultation conservés**. Une alerte de jeu n'est pas un son du décor.
3. **Caniveau qui ne suit plus la distance** — classe de duck
   `{cues:['bossTell','bossRoar','bossImpact','bossPhase'], fixed:true}` dans
   `src/audio-recipes.js`. Le champ `fixed` du moteur (ignore `cueLevel`) avait été livré
   en T4 pour MIX-V1 ; ici METAL s'en sert. À 17 m, l'annonce ne duckait la musique que
   de ×0,84, soit −1,5 dB : elle se faisait écraser par ce qu'elle devait prévenir.
4. **Gain ×3** de l'annonce (`0,09 → 0,27`, `0,035 → 0,105`), exactement les valeurs que
   l'audit utilisait pour simuler BOSS-04 dans le banc.

## Reproduire

```sh
node docs/chantier-moteur/bancs/mix/run.mjs $S "mix.html?job=tell" 900 tell.json
```

Le banc rend la scène (d) (l'arène du boss), cinq annonces à ~17,1 m, et mesure le RMS de
l'annonce seule contre celui de la musique au même instant, sur trois lois de niveau :
`actuel` (source telle quelle, niveau enregistré sous l'ancienne portée), `boss04` (la
simulation de l'audit : ×3 et portée 90 m), `metal` (la loi réellement livrée : ×3, portée
90 m **et** plancher 0,6 dans l'enclos).

## Mesure, scène (d), cinq annonces à 17,1 m, recette `cur`

| loi de niveau | RMS annonce | RMS musique | annonce − musique | annonce − autres effets | crête |
|---|---:|---:|---:|---:|---:|
| départ de l'audit (gain 0,09, portée 36 m) | −50,0 à −50,3 | −21,3 à −24,5 | **−25,8 à −29,0** | −9,1 à −10,2 | 0,012 |
| `actuel` (×3 livré, niveau d'enregistrement) | −40,75 | −22,37 | −18,38 | −2,92 | 0,04 |
| `boss04` (simulation de l'audit) | −33,23 | −23,44 | −9,79 | −0,63 | 0,08 |
| **`metal` (livré)** | **−31,65 à −31,68** | −22,6 à −26,6 | **−5,08 à −9,09** (moyenne **−7,85**) | **−0,44** | 0,101 |

L'annonce gagne **+18,3 dB** par rapport au départ de l'audit (−50,0 → −31,67) et se place
**au niveau des autres effets** (−0,44 dB, contre −9,1 à −10,2 dB au départ) : le critère
interne de l'audit « au niveau des autres effets » est tenu. La musique baisse de 1,45 dB
de plus pendant l'annonce que sous l'ancienne loi, ce que produit `fixed`.

## Ce qui n'est PAS atteint, et pourquoi

Critère de la fiche : `RMS annonce ≥ RMS musique après duck − 3 dB`, **de 10 à 25 m,
quatre familles**.

- **−3 dB : non atteint**, à −7,85 dB en moyenne (−5,08 au mieux). L'écart restant de
  ~4,9 dB est exactement celui que l'audit prévoyait : « avec BOSS-04 (gain ×3, portée
  90 m, level 0,50) : annonce à −33,2 dBFS, encore **7,2 à 11,0 dB sous la musique** ».
  Le plancher de l'enclos ne rend que 1,5 dB. Les 4,9 dB restants sont dans la **bande**,
  pas dans le niveau : la musique met 84 à 88 % de son énergie sous 250 Hz et moins de
  10 % entre 500 Hz et 4 kHz, alors que l'annonce est un triangle 92→180 Hz. C'est le
  quatrième item de la fiche — « énergie des quatre annonces entre 500 Hz et 2,5 kHz,
  le grondement 60-110 Hz doit être doublé » — qui les donne, et il appartient au dessin
  sonore de **BOSS-04**, qui n'est pas dans cette branche.
- **Quatre familles : non mesurable ici.** La scène (d) du banc ne contient que des
  `bossTell` ; `bossRoar`, `bossImpact` et `bossPhase` existent dans le moteur mais aucune
  trame du banc ne les émet. Le plancher et le duck `fixed` sont posés pour les quatre et
  vérifiés à l'unité (test ci-dessous), mais leur niveau dans le mixage ne sera mesuré
  qu'avec les annonces de BOSS-04.

**Décision rendue, défaut de la fiche appliqué** : le mixage est intégré, le dessin
sonore est renvoyé à BOSS-04. La tâche est **partiellement réalisée** ; le critère −3 dB
reste ouvert tant que BOSS-04 n'est pas là. Rien dans ce commit n'empêche BOSS-04
d'atteindre −3 dB : le plancher, la portée et le caniveau sont déjà en place pour le
recevoir.

## Tests et taille

`node --test checks/audio.test.mjs checks/soundscape.test.mjs` : **62 tests, 62 réussis**.
- `checks/soundscape.test.mjs` : un test nouveau vérifie la portée 90 m (une annonce à
  60 m porte encore, à 95 m non), le plancher à 0,6 dans l'enclos, son **absence** hors de
  l'enclos (le rugissement y reste à 0,5275, sa loi propre à 100 m), et que le panoramique
  n'est pas touché.
- `checks/audio.test.mjs` : un test nouveau vérifie que l'annonce abat la musique à 0,38
  **identiquement** à level 0,2 et à level 1 (`fixed` ignore `cueLevel`), et qu'un cue sans
  classe (`hurt`) reste proportionnel au volume des effets.

`npm test` : **534 réussis, 0 échec** (référence de départ 526/526).
`dist/index.html` : 872 105 → **873 014 octets** (+909), sha256 conforme à `SIZE.json`.

## Attend du vrai matériel

Le garde-fou de la fiche tient : le gain estimé (−3 dB ou mieux) « n'est pas encore rendu
». Ce qui est rendu ici ne l'a été qu'en rendu hors ligne ; l'annonce d'un boss à 17 m
dans un haut-parleur de portable n'a pas été entendue.
