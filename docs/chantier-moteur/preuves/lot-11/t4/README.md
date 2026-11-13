# Lot 11 — T4 : confirmations de touche et de kill (reste de FEEL-07)

Ce qui est fait ici : les deux confirmations demandées par FEEL-07, et **rien d'autre**.
Le compresseur −12/3/6/12/120 (MIX-02, lot 11b T3), le duck 0,35/0,22/0,18 (MIX-03 /
MIX-V1, lot 11b T4), le filtrage des tirs ennemis à 1,1 kHz et taux 0,85 (MIX-06,
lot 11b T11) et l'envoi d'écho 0,09 (non mesuré) ne sont **pas** appliqués.

## Sons

`src/audio-recipes.js` ajoute deux recettes au générateur paramétrique générique de
`FAudio` (`layered`) :

- **touche** : deux clics tonals à 2 800 et 4 100 Hz, décroissance tonale de 11 ms du
  générateur tenant lieu des 12 ms de la fiche, 55 ms, joué au niveau **0,30** ;
- **kill** : thump 90 → 50 Hz avec décroissance d'amplitude de 70 ms, corps passe-bas
  600 Hz et un clic à 3 200 Hz, le tout dans **un seul** tampon de 200 ms, joué au
  niveau **0,45**.

Ces noms sont du contenu METAL, pas des noms d'effets du moteur : `FAudio` reçoit
`options.extras` (nouvelle option générique) et les prépare **avec** la banque, jamais en
jeu. Sans options, `hit()` et `kill()` gardent le `click` et le `body`+`impact:dirt` de la
v0.2, et la banque reste les 64 tampons `33ab837bd0d7…`.

Le compteur de touches consécutives vit dans `FAudio`, sur `ctx.currentTime` : rien
n'entre dans la simulation, aucun champ de sauvegarde.

## `confirm.mjs`, `confirm.json` — forme et spectre

`node docs/chantier-moteur/preuves/lot-11/t4/confirm.mjs . --out …/confirm.json`
(domaine principal). Bandes = % de l'énergie [<120, 120–500, 500–4000, >4000] Hz, comme
`bancs/feel/audio-analyze.mjs`. Crête normalisée à 0,84 par le générateur.

| son | durée | crête | \|dc\| | queue | énergie <120 Hz | centroïde |
|---|---|---|---|---|---|---|
| clic v0.2 (hit actuel) | 70 ms | 0,84 | 0,00047 | 0 | 0 % | 4 401 Hz |
| corps v0.2 (kill actuel) | 160 ms | 0,84 | 0,00060 | 0 | 6,2 % | 1 261 Hz |
| **touche METAL** var. 0 | 55 ms | 0,84 | 0,00073 | 0,0004 | 0,2 % | **5 333 Hz** |
| **touche METAL** var. 1 | 55 ms | 0,84 | 0,00002 | 0,0002 | 0,1 % | 5 034 Hz |
| **kill METAL** var. 0 | 200 ms | 0,84 | 0,00112 | 0,0042 | **80,2 %** | **205 Hz** |
| **kill METAL** var. 1 | 200 ms | 0,84 | 0,00291 | 0,0038 | 78,6 % | 220 Hz |

Règles du test appliquées aux deux variantes des deux sons : crête dans [.80 ; .85[,
RMS dans ]0,025 ; 0,4[, |dc| < 0,003, queue < 0,04, variantes différentes, reproductibles.
La touche est nette et claire (centroïde 5,3 kHz contre 4,4 kHz au clic v0.2) ; le kill est
un thunk grave (80 % sous 120 Hz, centroïde 205 Hz) et non plus un impact moyen.

## `matrix-t4.json` — la chaîne complète, Chrome sans interface

`mix.html?job=matrix&scenes=a,b,c,d&recipes=cur,metal&comps=cur&ducks=cur`, scènes
enregistrées au T0, 48 kHz OfflineAudioContext. Comparé au rendu T3 (mêmes scènes, avant
l'ajout des confirmations) :

| scène | crête avant → après | échantillons > 0,875 | voix volées | voix max | RMS sortie |
|---|---|---|---|---|---|
| a | 0,424 → 0,424 | 0 → 0 | 0 → 0 | 5 → 5 | −21,00 → −21,00 dB |
| b | 0,550 → 0,562 | 0 → 0 | 0 → 0 | 6 → 6 | −18,78 → −18,78 dB |
| c | 0,623 → 0,623 | 0 → 0 | 0 → 0 | 14 → 14 | −19,03 → −19,03 dB |
| d | 0,599 → 0,608 | 0 → 0 | 0 → 0 | 12 → 12 | −20,00 → −20,02 dB |

Aucun échantillon au-dessus de 0,875, aucune voix volée, aucune voix de plus : les
confirmations se logent dans le mixage sans le pousser.

## Tests

Quatre tests écrits **avant** l'implémentation, tous rouges avant le correctif :

1. touche : une seule `AudioBufferSourceNode`, aucun oscillateur, aucun filtre de plus,
   niveau 0,30, +1 octave au bout de six touches consécutives (`2^(6/12)`, plafonné à 6),
   remise à zéro après une pause ;
2. kill : un seul tampon portant le thunk et le tick, niveau 0,45, pas d'oscillateur ;
3. formes des deux recettes sur les deux variantes, et ces noms n'entrent pas dans
   `FAudio.effectNames` ;
4. sans extras, `hit` et `kill` gardent les cues v0.2 et la banque reste à 64 tampons ;
   avec, elle est à 68 (préparés avant le jeu, jamais de `createBuffer` pendant le jeu).

**Un test existant modifié dans ce commit, changement voulu** : MIX-01 attendait 64
tampons pour la banque avec table METAL ; elle est à 68 depuis l'ajout des quatre tampons
de confirmation. La borne est relevée, aucune règle de forme n'est relâchée.

`npm test` : 516 réussis, 0 échec (référence de départ 506/506).

## Écoute

Aucune écoute réelle possible sur cette machine : à vérifier par David.
