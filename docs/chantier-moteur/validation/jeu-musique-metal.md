# Validation — musique metal adaptative (décision David du 14/11)

Branche `chantier/jeu-musique-metal`, base `731ace7`. Rapport complet :
`docs/chantier-moteur/rapports/jeu-musique-metal.md`.

Machine des mesures : DGX Spark arm64, Node **24.18.0**, machine partagée.
**Aucune mesure dans un navigateur dans ce lot.**

## Ce qui a été testé, et comment

### 1. Les modules historiques sont intacts

`npm test` (563 tests) comprend les tests qui épinglent l'empreinte sha256 des
trois modules des mondes et de l'accueil, le nombre de tampons et de nœuds
créés à la lecture, les gains exacts du mixeur et le comportement du transport.

Vérification **supplémentaire**, faite hors tests à chaque commit : le module
produit par le code courant est comparé octet pour octet à celui produit par le
code de la base `731ace7` (worktree `.relais/avant-t1`), chargé dans un contexte
isolé.

| module | octets | résultat |
| --- | --- | --- |
| monde 0 | 259 920 | identique |
| monde 1 | 194 400 | identique |
| monde 2 | 210 544 | identique |
| accueil | 183 704 | identique |

### 2. La brique de séquençage

`checks/imuse.test.mjs` — **15 tests**. Vérifié : une demande ne change la
pièce qu'au bord de mesure ; la mesure en cours est toujours jouée jusqu'au
bout ; la transition écrite est jouée avant l'entrée sur la cible ; le même
évènement (même clé) ne relance pas la même pièce ; l'intensité quantifiée ne
fait pas bouger une couche à chaque image ; `request` refuse une pièce inconnue ;
aucune horloge ni aléa dans le module (lecture du code source sous contrat).

### 3. Le contenu musical

`checks/music.test.mjs` — **24 tests** dont 9 nouveaux. Vérifié sur les huit
pièces : chacune a son titre, sa partition (empreintes deux à deux
différentes), son tempo dans la famille annoncée (thrash ≥ 180, doom ≤ 70) ;
toutes les pistes jouent réellement (batterie, basse, lead, annonce, guitare
propre à la pièce) ; le picking thrash est mesuré plus de deux fois plus dense
que le doom ; toutes les périodes restent dans la plage jouable ; le tempo est
encodé dans chaque motif ; les ondes synthétisées sont bipolaires et sans
composante continue ; la synthèse est déterminée (deux contextes isolés donnent
les mêmes octets) ; l'export ne mute pas l'état de lecture.

### 4. Les couches et les enchaînements, avec et sans la brique iMUSE

Les deux tests de comportement (couches verticales, évènement sans coupure)
sont exécutés **deux fois**, une fois avec `FImuse` chargé, une fois avec le
seul transport de repli. Vérifié : un porteur de couche par piste, branché
entre l'enveloppe de note et le fader ; les cinq porteurs bougent **ensemble et
une seule fois par mesure** (le compte de commandes est égal au nombre de
mesures, à une près) ; à intensité nulle les percussions d'annonce restent
fermées et le plancher de la pièce continue de jouer ; à pleine intensité le
lead et l'annonce entrent ; le même évènement ne reprogramme aucune note ; une
pièce inconnue est refusée sans retomber sur le monde 0.

### 5. Le branchement mixeur

`checks/audio.test.mjs` — **53 tests** dont 4 nouveaux. Vérifié : une demande
prend la musique et la garde tant que la situation dure, le thème du secteur ne
la reprend pas tout seul alors que `syncMusic` tourne à chaque image ; la
libération la lui rend à la mesure suivante ; l'accueil et la pause gardent la
main ; sans module audio la demande est sans danger ; **sans `FImuse`** les
pièces adaptatives jouent quand même.

### 6. Les déclencheurs de la simulation

`checks/music-director.test.mjs` — **9 tests**. Vérifié sur des suites d'états
fixes : une alerte qui monte demande la meute sans attendre ; une alerte qui
oscille entre les deux seuils ne change rien ; le retour au calme exige 25 s
réelles ; le colosse et la victoire passent immédiatement, sans attendre le
temps de séjour ; un changement trop rapide est **refusé et compté** puis
accepté ; la mort rend le thème ; la même suite d'états produit exactement les
mêmes demandes (déterminisme) ; le module ne contient ni `setTimeout`, ni
`Date.now`, ni `Math.random`, ni `AudioContext`.

### 7. Bout en bout, dans le jeu réel

Un test lance le vrai `game.js` avec un DOM factice, le vrai `FAudio` et le
vrai transport : une alerte forcée amène la meute (demandée **et** jouée, avec
les percussions d'annonce ouvertes), le colosse éveille prend la main, la
meute reprend, 25 s de calme amènent la veille basse, la victoire prend la
musique immédiatement — et le transport n'a jamais été coupé en route (les
notes programmées ne retombent jamais à zéro).

### 8. Budget processeur

`tools/music-cost.mjs`, comparaison **appariée et alternée** contre la base,
9 passages, médianes, dans le domaine principal de Node. Preuve :
`docs/chantier-moteur/preuves/jeu-musique-metal/t5/music-cost-t5.json`.

| mesure | valeur |
| --- | --- |
| chef d'orchestre, par image | 0,200 µs |
| séquenceur sur la table réelle du jeu, par mesure | 0,343 µs |
| ordonnancement des notes, mondes historiques | 0,215 à 0,523 µs/image (base 0,238 à 0,564) |
| ordonnancement des pièces adaptatives (5 pistes) | 0,232 à 0,452 µs/image |
| synthèse d'une pièce | 76 à 103 ms, tranche max 12,9 à 14,6 ms |

Une image à 60 Hz vaut 16 700 µs : tout le chemin musical pèse **≈ 0,7 µs**,
soit **0,004 %** du budget d'image. Les écarts avant/après sur les modules
historiques (de −9,7 % à +12,4 %) sont **dans le bruit de la machine partagée**
(bande mesurée ±15 % en relançant la même comparaison) et ne sont présentés
comme un gain ni une perte.

### 9. Construction et tests complets

`python3 tools/build.py` puis `npm test` : **563 réussis, 0 échec** (référence
de départ 526/526, aucun échec nouveau). `dist/index.html` **905 768 octets**
(contre 862 797 à la base), sha256 `89c2e48862c321ad…` conforme à `SIZE.json`,
sous le plafond de 1 400 000 octets.

## Ce qui attend un vrai appareil

- **Écoute réelle**, haut-parleurs et casque : les huit pièces, les guitares
  propres à chaque pièce, le gong et les timbales n'ont jamais été entendus.
  Rien dans ce lot ne peut valider le ressenti du picking thrash, du poids du
  doom, du volume relatif des cinq pistes, ni des jointures à l'oreille.
- **Téléphone** : coût CPU réel à cinq pistes en charge prolongée, commandes
  tactiles pendant un changement de pièce, effet sur le temps d'affichage de la
  chauffe des trois pièces adaptatives au démarrage.
- **PC Windows à carte NVIDIA, Safari, Firefox** : nombre de nœuds WebAudio en
  pratique, repli sans `StereoPannerNode`, rendu du `setTargetAtTime` des
  porteurs de couche selon les moteurs.
- **Images manquées en navigateur** : à mesurer sous Chrome sans interface puis
  sur appareil. Les chiffres ci-dessus sont du coût JavaScript sous Node, avec
  un contexte audio factice — ils ne disent rien du mixage audio réel.
- **Montée réelle de l'alerte** : le test de bout en bout force les observables
  lus par le jeu. Jouer un secteur jusqu'à la victoire avec une vraie meute qui
  fait monter `threat` reste à faire à la main.

## Ce qui est connu et non résolu

- Tranches de synthèse de 12,9 à 14,6 ms, au-dessus du budget de préparation de
  8 ms : **préexistant**, identique avant et après ce lot, non aggravé.
- Aucun gain « au-delà » n'est revendiqué : les deux allocations supprimées du
  chemin chaud ont été mesurées en apparié (médiane −1,8 % sur huit mesures) et
  ne passent pas le plancher de bruit de la machine. Chiffres dans le rapport.
