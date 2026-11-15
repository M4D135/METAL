# Lot — Musique metal adaptative (décision David du 14/11)

Branche `chantier/jeu-musique-metal`. Agent : OpenCode, modèle local du Spark.
Base du lot : `731ace7` (intégration du lot 11-audio), arbre propre, aucun wip à
reprendre. Aucune fiche `lots/*.md` ne correspond : le travail est défini par
`MASTER-PROMPT` §6 quater point 3 et le brief reçu.

Machine de toutes les mesures : Linux arm64 (DGX Spark), Node **24.18.0**,
machine **partagée**. Aucune mesure dans un navigateur dans ce lot (voir
« Limites »).

## Référence de départ

`npm test` sur l'arbre de départ `731ace7` : **526 réussis, 0 échec**
(`.relais/npm-test-base.log`). À la fin du lot : **563 réussis, 0 échec**
(`docs/chantier-moteur/preuves/jeu-musique-metal/t5/npm-test.tap`). Aucun test
qui passait n'a échoué ; aucun test affaibli. Les 37 tests ajoutés :

| apport | nombre | commit |
| --- | --- | --- |
| `checks/imuse.test.mjs` (brique iMUSE) | +15 | `4a6e445` |
| `checks/music.test.mjs` (répertoire adaptatif) | +9 | `507e043` |
| `checks/audio.test.mjs` (branchement mixeur) | +3 | `cf9956f` |
| `checks/music-director.test.mjs` (déclencheurs) | +9 | `c456997` |
| `checks/audio.test.mjs` (bout en bout dans le jeu réel) | +1 | `c456997` |

## Non-régression centrale, vérifiée à chaque tâche

Les trois modules historiques et la musique d'accueil thrash de la 0.8.1 sont
**identiques octet pour octet** à la base. Vérification faite à chaque commit,
pas seulement aux tests : le module courant et celui du worktree de base
`.relais/avant-t1` (`731ace7`) sont comparés par empreinte.

| module | octets | empreinte 16 premiers hex. |
| --- | --- | --- |
| monde 0 | 259 920 | identique base |
| monde 1 | 194 400 | identique base |
| monde 2 | 210 544 | identique base |
| accueil `title` | 183 704 | identique base |

Les tests `checks/music.test.mjs` épinglent en plus ces empreintes, le nombre
de tampons et de nœuds créés, et les gains exacts vérifiés par
`checks/audio.test.mjs`. La jointure écrite ajoutée aux pièces historiques est
**ajoutée à la table lue par le lecteur**, jamais au module exporté
(`legacyJoin`, `src/music.js`) : c'est ce qui permet à la fois une liaison
musicale et des octets intacts.

## Tâches

### T1 — brique séquenceur iMUSE — fait — `4a6e445`

`src/imuse.js`, exposant `FImuse` : brique **générique**, sans aucun contenu de
jeu. Grille mesure/segment, points de synchronisation, couches verticales
commandées à la mesure selon un seuil d'intensité par couche (intensité
quantifiée par pas de 0,05 pour ne pas faire claquer une couche à chaque
image), enchaînements horizontaux (on finit la mesure, puis le segment, puis on
joue la transition écrite, puis on entre sur la cible), `urgent` pour couper à
la mesure suivante, dédoublonnage par clé d'évènement. Aucune horloge, aucun
aléa, aucun nœud audio.

Preuves : `docs/chantier-moteur/preuves/jeu-musique-metal/t1/`
(`imuse-test.tap`, `music-cost-t1.json`). Tests : 15/15.

### T2 — matériau musical nouveau — fait — `507e043`

Huit pièces dans `src/music.js`, sur **cinq pistes** (rythmique, basse, lead,
batterie, percussions d'annonce), chacune avec sa forme, ses motifs et ses
instruments :

| pièce | titre | tempo | style |
| --- | --- | --- | --- |
| `calm` | Veille basse | 72 | doom lent |
| `doom1` | Chape de fer | 62 | doom lourd |
| `doom2` | Puits de sel | 54 | doom pesant |
| `thrash1` | Rouille vive | 196 | thrash |
| `thrash2` | Scie noire | 208 | thrash rapide |
| `combat` | Meute | 214 | thrash rapide |
| `boss` | Colosse | 152 | groove lourd |
| `victory` | Acier tenu | 128 | métal héroïque |

Guitares synthétisées neuves par pièce (échantillons 24 à 27, graines
différentes) : aucune ne recycle la banque historique. Percussions d'annonce
(`gong`, `timpani` ajoutés à la frappe ; bars d'annonce 16 à 23) distinctes du
kit. Jointures **écrites** `fill` (1 mesure), `roll` (2), `bridge` (2) :
montée du lead sur le roulement, stop sur le pont — pas de fondu aléatoire.

Le thrash est mesuré plus dense que le doom sur la piste rythmique (test
`adaptive scores write real played parts on all five tracks`) ; les ondes
synthétisées sont contrôlées bipolaires et sans composante continue.

**T2 absorbe la tâche T3 du plan** (matériau thrash rapide + pièces doom
lourdes) : le matériau et la table de couches sont produits par le même
générateur, les séparer n'aurait fait que dupliquer la preuve.

### T3 — couches verticales calées sur la mesure — fait — `507e043` puis `cf9956f`

Un **porteur de couche** (`gate`) par piste, placé entre l'enveloppe de note et
le fader de piste, commandé **une seule fois par mesure** (`setTargetAtTime` au
bord de mesure). Les faders et les gains du mixeur ne sont jamais réécrits :
les tests de gain de `checks/audio.test.mjs` (`lead.gain.value` à .52 et .30
selon l'alerte) restent verts sans modification.

Le lecteur passe par `FImuse` quand le module est chargé, sinon par un
**transport cyclique de repli** — corrigé au passage : il tournait
éternellement sur le premier segment et son `reset` levait une
`ReferenceError`. `nextBar()` a été réécrit en « calculer puis avancer » pour
que le descripteur renvoyé soit toujours auto-cohérent (`cue`, `segment`, `bar`
décrivent la même mesure) : le lecteur peut changer de partition sur cette
seule information.

Preuves : `t5/music-test.tap`, `t5/imuse-test.tap`. Les deux tests de
comportement (couches, évènement sans coupure) sont joués **deux fois**, avec
et sans `FImuse`.

### T4 — branchement du mixeur — fait — `cf9956f`

`src/audio.js` : `audio.requestMusic(cue, {key, urgent, force})` et
`audio.releaseMusic()`, `stats.musicCue`. `syncMusic()` ne force plus le thème
du secteur à chaque image : il joue la pièce tenue, sinon le thème du secteur,
l'accueil ayant la main pendant le titre. Une pièce inconnue est **refusée**
au lieu de retomber sur le monde 0. La pièce demandée prépare ses instruments
au moment de la demande, pas sous la première note.

Piège trouvé et consigné : `FAudio` emballe chaque méthode publique dans
l'enveloppe de priorité des effets sonores (`src/audio.js:985`) ; sans
l'exemption `helpers`, `requestMusic` renvoyait `undefined` pendant l'accueil
et se faisait compter comme un effet sonore.

### T5 — déclencheurs de la simulation — fait — `c456997`

Nouveau module `src/music-director.js` (`FMusicDirector`) : lit un instantané
de la simulation (`threat`, `director.pressure`, `bossAlive`, `won`, `dead`) et
demande la pièce. Aucune horloge, aucun aléa, aucun audio — l'hôte avance le
temps, ce qui rend la règle testable sans DOM.

Règles et valeurs par défaut : victoire immédiate ; colosse si `bossAlive` et
`threat >= .25` ; meute si `threat >= .5` ou `pressure >= .62` ; sortie de
combat à `threat <= .18` ; veille basse après **25 s** de calme ; reprise du
thème du secteur si l'alerte remonte à `.3`. Temps de séjour de **6 s** entre
deux changements (compté dans `state().blocked`) pour qu'une alerte qui
oscille autour du seuil ne fasse pas claquer la musique.

`src/game.js` : `update(sim.state, dt)` une fois par image pendant qu'on joue,
`reset()` à l'entrée du secteur, `victory()` sur l'évènement `win`. Le jeu ne
coupe jamais le transport lui-même. L'écran de chargement chauffe `calm`,
`combat`, `boss` en tâche de fond.

Test de bout en bout : le jeu réel (DOM factice, vrai `FAudio`, vrai
transport), une alerte forcée → la meute est demandée **et jouée** par le
transport, avec les percussions d'annonce ouvertes à pleine alerte.

### T6 — musique d'accueil thrash conservée — fait — vérifié à chaque commit

Voir « Non-régression centrale » : `title` identique octet pour octet, ses
tests de gain et de préparation intacts, et le test
`laccueil et la pause gardent la main sur la musique adaptative` vérifie que
l'accueil reprend la main sur une pièce adaptative en cours et qu'une nouvelle
partie repart sur le thème du secteur.

### T7 — budget processeur — fait — `db2c360`

Preuve : `docs/chantier-moteur/preuves/jeu-musique-metal/t5/music-cost-t5.json`
et le commentaire `budget` du même répertoire. Banc `tools/music-cost.mjs`
étendu : ordonnancement sur les cinq pistes adaptatives, séquenceur sur la
**vraie table** du jeu, chef d'orchestre, synthèse et tranches des huit pièces.
Comparaison appariée et alternée contre la base, 9 passages, médianes.

| mesure | après | base | écart |
| --- | --- | --- | --- |
| ordonnancement des notes, monde 0 | 0,215 µs/image | 0,238 | −9,7 % |
| monde 1 | 0,418 | 0,372 | +12,4 % |
| monde 2 | 0,363 | 0,347 | +4,6 % |
| accueil | 0,523 | 0,564 | −7,3 % |
| séquenceur sur la table réelle | 0,343 µs/mesure | — | nouveau |
| chef d'orchestre | 0,200 µs/image | — | nouveau |
| pièces `calm` / `combat` / `boss` / `victory` | 0,232 / 0,452 / 0,430 / 0,331 µs/image | — | nouveau |
| synthèse d'une pièce | 76 à 103 ms | 76 à 90 ms (historiques) | ajouté |
| plus grosse tranche de synthèse | 12,9 à 14,6 ms | 11,2 à 15,4 ms | identique |

Une image à 60 Hz vaut **16 700 µs**. Tout le chemin musical — chef d'orchestre,
séquenceur amorti, ordonnancement des notes — tient dans **≈ 0,7 µs**, soit
**0,004 %** du budget d'image. Les médiannes des modules historiques oscillent
de ±10 % d'un run à l'autre sur cette machine partagée : **aucun de ces écarts
n'est interprétable**, et c'est écrit comme tel, pas comme un gain.

## Au-delà

Deux allocations retirées du chemin chaud, chacune mesurée en apparié :

1. **Clé du cache de tampons d'instruments** : elle était devenue une
   concaténation de chaînes (`clef + '#' + sample`), payée **à chaque note**,
   là où la base utilisait un nombre. Redevienue un nombre
   (`slot de pièce + numéro d'instrument`).
2. **Adresse de la ligne à lire** dans la partition : calculée une fois par
   mesure (`startBar`) au lieu d'une fois par ligne.

Gain mesuré, **non démontrable** : comparaison appariée et alternée, 9 passages
(`.relais/banc-musique-cout-au-dela.json`), médiannes de −13,3 % à +28,9 % sur
les huit mesures, **médiane d'ensemble −1,8 %**. La bande de bruit de la
machine, mesurée en relançant la même comparaison, est de l'ordre de ±15 % sur
ces valeurs de 0,2 à 0,5 µs. **Aucun gain n'est donc annoncé.** Les deux
changements sont gardés : ils suppriment une allocation par note, ce qui est
vérifiable à la lecture du code, et ne peuvent pas être pires.

Pistes mesurées puis écartées, chiffres à l'appui :

- **Gagner sur le chemin par image** : 5 % de 0,4 µs font 0,02 µs, très
  en dessous du plancher de bruit de la machine (±15 %, soit ±0,06 µs). Aucune
  optimisation de cette zone n'est démontrable ici. La zone est déjà à
  0,004 % du budget d'image.
- **Court-circuiter la boucle de nettoyage des voix** (`for (const v of
  voices)` dans `tick()`, jusqu'à 28 voix) par une sortie anticipée : les voix
  sont rangées par ordre d'insertion, pas par fin de jeu, donc une sortie
  anticipée laisserait des voix comptées à tort comme actives et le budget de
  voix se boucherait. Écarté pour risque sur un invariant testé
  (`activeVoices` doit revenir à 0), pas pour le coût.
- **Gagner sur la synthèse** (76 à 103 ms par pièce, le seul coût restant qui
  pèse) : elle est déjà découpée en tranches de 12 à 15 ms et payée sur l'écran
  de chargement, jamais sur une image de jeu. Un gain y serait utile au
  chargement, pas à la fluidité ; il appartient à la zone préparation du lot
  11 et n'est pas fait ici pour ne pas empiéter.

## Taille

`dist/index.html` reconstruit à chaque tâche avec `python3 tools/build.py`.

| | octets | gzip | sha256 (16 premiers hex.) |
| --- | --- | --- | --- |
| base `731ace7` | 862 797 | 265 375 | `eedbd9884a149cc7` |
| fin du lot | **905 768** | 277 748 | `89c2e48862c321ad` |

Écart **+42 971 octets** pour huit pièces complètes, leurs instruments, la
brique de séquençage et le chef d'orchestre. Sous le plafond de 1 400 000
octets. `SIZE.json` est l'autorité de mesure ; le navigateur n'est pas compté
dans cette taille, contrairement à un exécutable natif.

## Décisions à confirmer par David

1. **Veille basse après 25 s de calme** (défaut appliqué : 25 s). Le thème du
   secteur reste la musique de fond par défaut ; `calm` ne le remplace qu'après
   un combat terminé et 25 s sans alerte.
2. **Seuils de combat** (défauts appliqués) : entrée à `threat >= .5` ou
   `pressure >= .62`, sortie à `threat <= .18`, colosse à `threat >= .25`.
3. **Temps de séjour de 6 s** entre deux changements de pièce (défaut appliqué) :
   il empêche le claquettement quand l'alerte oscille ; 0 s rendrait la musique
   plus réactive et plus hachée.
4. **Urgence** (défaut appliqué) : `combat`, `boss` et `victory` coupent à la
   mesure suivante ; `calm` et le retour au thème du secteur attendent la fin du
   segment. Rendre tout urgent hacherait les arrangements.
5. **Le thème du secteur reprend toujours la main** sur un changement de secteur
   et sur l'écran d'accueil (défaut appliqué). Une pièce adaptative n'est
   jamais gardée d'un secteur à l'autre.
6. **Les percussions d'annonce** ne jouent que sur les pièces qui les
   déclarent (`combat`, `boss`, `victory` en continu ; deux mesures sur quatre
   pour `calm`, `doom1`, `doom2`, `thrash1`, `thrash2`) — défaut appliqué.
7. **La mort rend le thème du secteur** immédiatement, sans attendre le temps de
   séjour (défaut appliqué).

## Ce qui reste à vérifier sur du vrai matériel

- **Écoute réelle**, haut-parleurs et casque : les huit pièces, les guitares
  par pièce, le gong et les timbales n'ont **jamais été entendus**. Elles sont
  vérifiées structurellement (ondes bipolaires, sans continu, périodes dans la
  plage jouable, tempo encodé), pas à l'oreille. Le mélange à cinq pistes, les
  entrées/sorties de couches à la mesure et les jointures doivent être jugés.
- **Téléphone** : coût CPU réel du chemin à cinq pistes en thermal soutenu,
  commandes tactiles pendant un changement de pièce, et l'effet de la chauffe
  des trois pièces adaptatives au démarrage sur le temps d'affichage du jeu.
- **PC Windows à carte NVIDIA, Safari, Firefox** : nombre de nœuds WebAudio en
  pratique, repli sans `StereoPannerNode`, comportement du `setTargetAtTime`
  des porteurs de couche selon les moteurs.
- **Images manquées** : rien n'a été mesuré dans un navigateur. Les chiffres
  ci-dessus sont du coût JavaScript sous Node avec un contexte audio factice.
  Une mesure Chrome sans interface, puis sur appareil, reste à faire.

## Limites et restes

- **Aucune mesure navigateur** dans ce lot. Le banc `tools/music-cost.mjs`
  chronomètre du JavaScript sous Node, avec nœuds et tampons audio simulés.
- **Bruit de la machine partagée** : ±15 % sur les mesures de 0,2 à 0,5 µs. Les
  écarts avant/après sur les modules historiques ne sont pas interprétables et
  sont présentés comme tels.
- **Tranches de synthèse à 12,9–14,6 ms**, au-dessus du budget de préparation de
  8 ms : constat **préexistant**, identique avant et après ce lot, non aggravé.
- Le test de bout en bout force l'observable lu par le jeu (`threat`,
  `bossAlive`, `won`) au lieu de jouer un secteur jusqu'à la victoire : la
  montée réelle de l'alerte par une vraie meute n'est pas couverte par un test.
- Le worktree de base `.relais/avant-t1` (et `.relais/avant-opt`, utilisé pour
  la mesure « au-delà ») sont des outils de mesure locaux, hors dépôt, à retirer
  à la fin.
