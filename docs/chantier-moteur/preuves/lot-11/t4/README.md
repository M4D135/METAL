# Lot 11 — T4 : confirmations, puis les quatre réglages de mixage FEEL-07

## Ce commit (tour 1) : les quatre items qui manquaient

Le contre-vérificateur a relevé (problème 2) que ce dossier annonçait les quatre réglages de
FEEL-07 comme **non appliqués** — compresseur maître, maintien du duck, voix ennemie, envoi
d'écho — alors que la fiche en fixe la **décision par défaut** : « FEEL-07 conditionné aux
mesures de la lacune MIX : lancer le harnais OfflineAudioContext SMG (ancien vs nouveau
compresseur) et valider les valeurs −12/3/6/12/120 — valeur par défaut : **accepter si pic
≤ .85 et pas de saturation du waveshaper .875** ». Le harnais n'avait pas été lancé, donc la
décision par défaut n'avait pas été exécutée. Il l'est ici, et elle s'applique.

Le banc est celui du lot : `docs/chantier-moteur/bancs/mix/mix.html`, Chrome sans interface,
`OfflineAudioContext` 48 kHz, scènes enregistrées au T0. `scenes.js` (non suivi) restauré
depuis `preuves/lot-11/t0/scenes.js.gz`, `src.js` régénéré par `gen.mjs`.

```
node docs/chantier-moteur/bancs/mix/gen.mjs . docs/chantier-moteur/bancs/feel/doomish.mjs docs/chantier-moteur/bancs/mix [.relais/avant-t4]
node docs/chantier-moteur/preuves/lot-11/t3/run-linux.py ../../bancs/mix/mix.html?job=matrix\&scenes=a,b,c,d\&recipes=metal\&comps=cur,v02\&ducks=cur,v02
```

`cur` = la source telle quelle, `v02` = les valeurs d'avant FEEL-07 réinjectées par le banc
(`COMP.v02`, `DUCK.v02` dans `mix.js`), donc l'ancien et le nouveau dans le même processus.

**Décision : acceptée.** Sur les quatre scènes et les 16 rendus, la crête de sortie maximale
est **0,669** (scène c) — sous le .85 exigé —, `aboveKnee` = 0 et `clipEpisodes` = 0 partout :
aucun échantillon n'atteint le coude du waveshaper .875, donc pas de saturation.

| scène | crête avant → après | RMS sortie avant → après | voix max | voix volées |
|---|---|---|---|---|
| a — rafales de SMG | 0,424 → 0,417 | −19,00 → −21,73 dB | 5 → 5 | 0 → 0 |
| b — pompe + 6 ennemis | 0,562 → 0,601 | −18,77 → −19,18 dB | 6 → 6 | 0 → 0 |
| c — roquettes et casses | 0,623 → 0,669 | −19,03 → −19,64 dB | 14 → 14 | 0 → 0 |
| d — combat de boss | 0,608 → 0,650 | −20,02 → −20,34 dB | 12 → 12 | 0 → 0 |

Le garde-fou de la fiche (« le gain de compensation du compresseur décale le niveau de tout ce
qui est sous le seuil de quelques dB → mesurer avant de figer ») est mesuré, pas supposé :
`calib-feel07.json` donne la **compensation automatique du `DynamicsCompressorNode` à
4,55 dB avant, 3,73 dB après** (et le même délai de 288 échantillons, soit 6 ms, des deux
côtés — la fiche annonçait bien une attaque effective vers 6 ms). La baisse de RMS ci-dessus,
0,32 à 0,73 dB, est ce décalage mesuré ; elle reste sous le dB.

**Rafale SMG, l'exigence littérale de la fiche** (`pump-feel07.json`, scène `p` : SMG 8/s,
pistolet, pompe, roquette, caniveau de musique mesuré à la fenêtre de 30 ms) :

| mesure sur la rafale | avant (v02) | après (cur) |
|---|---|---|
| crête de sortie | 0,521 | **0,552** (≤ .85) |
| RMS de sortie | −19,94 dB | −20,45 dB |
| chute de la musique pendant la rafale (p50 / max) | 8,15 / 8,49 dB | **9,14 / 9,36 dB** |
| ondulation après la rafale (p50) | 7,86 dB | 9,10 dB |
| marge du transitoire de SMG sur la musique (p50) | 15,93 dB | **18,11 dB** |

La musique s'efface 2,2 dB de plus sous la rafale : c'est l'effet demandé par le duck
0,35/0,22/0,18, et la crête ne monte pas au-dessus de ce que le plafond souple sait tenir.

**Voix ennemie** (`ab-ennemis.json`, `job=ab`, scène b avec ses 65 tirs ennemis, A = après,
B = avant, même processus) : crête 0,562 → 0,601, RMS −18,84 → −19,26 dBFS, différence de
crête −9,28 dBFS — le mixage change, ce n'est pas un réglage pour rien. Les appels
d'automatisation sont **identiques (2 630 des deux côtés)**, aucune voix volée, 6 voix max des
deux côtés : la voix ennemie plus grave et plus fermée ne coûte ni nœud ni voix.

## Ce que le commit d'origine faisait déjà : les deux confirmations

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

**Ajout du tour 1 — les deux voix ennemies.** `src/audio-recipes.js` ajoute `enemySmg` et
`enemyGrenade`, construits par `noMech()` **à partir des mêmes objets** que `smg` et
`grenade`, avec `mech: []` : c'est littéralement « même recette, sans clic mécanique », et le
PCM de l'ennemi est celui du joueur octet pour octet dès qu'on retire le clic. La vitesse
(0,85), le passe-bas (1,1 kHz) et le niveau (0,24) vivent dans la voix, `FAudio.enemyShot`,
et non dans le tampon. `pcm()` accepte pour cela un septième argument `cutoff`, qui se
combine avec la filtre d'éloignement existant (`Math.min` des deux). Sans la table METAL,
`enemyShot` retombe sur `smg`/`grenade` de la v0.2 — plus grave et plus fermé, mais pas le
silence. La banque METAL passe de 68 à **72** tampons (quatre confirmations + deux voix
ennemies, deux variantes chacun).

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

### Ajout du tour 1 — le cinquième test, et les bornes relevées

`checks/audio.test.mjs`, test « FEEL-07 fige les quatre réglages décidés » : il lit les valeurs
dans le graphe et dans les événements d'automatisation, il ne les recopie pas depuis un
commentaire.

- `DynamicsCompressorNode` du maître : `[-12, 6, 3, .012, .12]`, et le `WaveShaperNode`
  `.875` toujours câblé derrière (`curve` non vide, `oversample 'none'`) ;
- envoi d'écho du bus des effets : `0.09` ;
- caniveau de la musique : `stats.duckGain = 0,56 × 0,35` à pleine pompe comme à pleine rafale,
  et **l'instant de remontée** — `0,22 s` après `fracture`, `0,18 s` après `shot` — lu sur le
  dernier événement `setTargetAtTime` du `musicBus`, pas déduit d'une constante ;
- voix ennemie : le tampon joué est **l'empreint exact** de `MetalAudio.extras.enemySmg`, la
  vitesse est `0,85` à la variation de 1,5 % près du générateur, le premier nœud après la
  source est un `lowpass` à `1100 Hz`, le crête d'enveloppe ne dépasse pas `0,24` ;
- et le repli sans table METAL : l'ennemi garde un tampon v0.2 (pas le silence) avec le même
  passe-bas.

Deux assertions existantes relevées, changement voulu et chiffré : la banque METAL passe de
**68 à 72** tampons (MIX-01 et le test de préparation), et la liste des noms d'`extras` gagne
`enemySmg` et `enemyGrenade`, avec une vérification qu'ils ne deviennent pas des noms d'effets
du moteur.

`npm test` après ces quatre items : **521 réussis, 0 échec**.

## Écoute

Aucune écoute réelle possible sur cette machine : à vérifier par David.
