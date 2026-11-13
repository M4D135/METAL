# Lot 11 — T5 : la musique alloue moins par image (RESTE-09 points 2 et 3)

Deux changements dans `src/music.js`, aucun dans le son produit :

1. `tick()` et `stopAll()` parcourent `voices` directement. Retirer l'entrée courante
   d'un `Set` pendant un `for…of` est défini par la spécification et conserve l'ordre
   d'insertion : les voix sont donc nettoyées dans le même ordre, sans copier le `Set`
   en tableau à chaque image (25 copies par seconde et par instance).
2. `schedule()` remplit 4 enregistrements `{sample,pitch,effect,param}` alloués une
   fois par instance (`const events=Array.from({length:4},…)`) au lieu d'en créer 4
   nouveaux par ligne programmée (environ 1 200 à 2 000 par minute de musique).

Le `Set` est gardé plutôt qu'un tableau à retrait par échange : même ordre de parcours,
`delete` en O(1), et `stats.activeVoices=voices.size` reste exact.

## Allocations mesurées — `alloc.json`

`node --expose-gc --max-semi-space-size=128 tools/music-alloc.mjs .relais/avant-t5 . --reps 7`
dans le domaine principal de Node (outil ajouté : `tools/music-alloc.mjs`). Une même
instance est chauffée sur deux minutes avant la mesure, donc les tampons d'instruments
sont déjà en cache et le tas ne compte que ce que produit `tick()`. Une minute à 25
images/s, 7 allers-retours alternés A/B dans le même processus, médiane retenue.
A = `.relais/avant-t5` (arbre de travail sur `f70b785`, avant T5), B = l'arbre.

| scène | A (Mo/min) | B (Mo/min) | écart |
| --- | --- | --- | --- |
| monde 0 « Fer noir » | 1,321 | 1,027 | **−22,3 %** |
| monde 1 | 2,450 | 2,017 | **−17,7 %** |
| écran titre | 3,121 | 2,579 | **−17,4 %** |

Le critère de la fiche était de retrouver au moins la moitié du −21 % attendu : atteint
sur les trois scènes, la tâche n'est pas abandonnée.

Notes et lignes programmées sur 60 s, identiques entre A et B : 1 071 notes et
1 202 lignes en monde 0, 2 726 notes et 2 043 lignes en monde 1.

## Identité — `journal.json`

`node docs/chantier-moteur/preuves/lot-11/t2/journal.mjs .relais/avant-t5 . .relais/mix-t3/scenes.js a,b,c,d,t`
(outil de T2 réutilisé, domaine principal de Node). Chaque appel d'automatisation est
journalisé avec (paramètre, type, valeur, instant, constante de temps), les écritures
directes de `.value` comprises.

| scène | automatisations A / B | paramètres identiques | écarts | `stats` égaux | passe |
| --- | --- | --- | --- | --- | --- |
| a | 7 106 / 7 106 | 1 046 / 1 046 | 0 | oui | oui |
| b | 2 646 / 2 646 | 1 558 / 1 558 | 0 | oui | oui |
| c | 9 497 / 9 497 | 1 802 / 1 802 | 0 | oui | oui |
| d | 2 626 / 2 626 | 1 337 / 1 337 | 0 | oui | oui |
| t (titre) | 3 737 / 3 737 | 1 863 / 1 863 | 0 | oui | oui |

Aucun événement retiré (`removed: 0`), aucun dédoublonnage invoqué : le journal de B
est celui de A, à l'identique, y compris l'ordre. A rejoué deux fois donne le même
journal (`deterministic: true` sur les cinq scènes).

`src/audio.js` est le même fichier des deux côtés (`c90230bf…`), seul `src/music.js`
change (`b37e8d84…` → `8970dbea…`).

## Modules et titres inchangés — `modules.json`

Sha256 des trois modules et du module du titre, calculés dans Node sur les deux arbres :
identiques (`50d88a07…`, `c12b06da…`, `738adaa5…`, titre `88dfafde…`).
`getTrack(0)` = « Fer noir », 100 BPM, 76,8 s ; `getTrack('title')` = « Furie d'acier »,
212 BPM, 54,34 s — mêmes valeurs des deux côtés.

## Rendu dans Chrome — `ab-t5.json`

`google-chrome --headless=new … mix.html?job=ab&scenes=c,a,t`, A = `f70b785`,
B = l'arbre. Aucune différence exploitable : écart de crête −132,45 dBFS (le plancher
de bruit du banc, mesuré à T0) et −154,5 / −156,1 dBFS en RMS pour c et a ; test nul
reçu (`nullTestPass: true`) dans les trois scènes ; appels de paramètres audio égaux
(9 485 / 9 485, 7 100 / 7 100, 3 711 / 3 711).

**À lire honnêtement.** La scène du titre affiche −96,75 dBFS de crête, soit 32 dB
au-dessus du plancher. Le banc `job=ab` n'est pas bit à bit : en relançant la même
comparaison avec **deux sources identiques** (A = B = `f70b785`, contrôle consigné dans
`ab-t5-aa.json`), l'écart mesuré est de −128,93 dBFS avec `identical: false`. L'écart
du titre est donc du bruit du banc, pas un changement de comportement ; c'est le journal
des automatisations ci-dessus, qui est exact, qui tranche.

## Vérifications

- `npm test` : 516 réussis, 0 échec (référence de départ 506/506).
- `python3 tools/build.py` : `dist/index.html` 865 078 octets (864 672 avant T5),
  gzip 265 350 octets, `sha256 c514fb2a…`, 0 actif externe. Sous la limite de
  1 400 000 octets.
- Non testé : ressenti subjectif et niveau réel sur haut-parleurs, qui restent à
  valider par David sur un appareil.
