# T3 — densité, dégâts, lisibilité de loin

## Le problème

Après T2, les machines étaient bien sur le chemin obligatoire — mais il y en avait
une par secteur. Un secteur se traversait en esquivant une seule lame. Le brief
demande que le piège devienne **la source principale de danger du secteur**, et
qu'on le voie venir de loin.

## Ce qui a été mesuré d'abord

Sur la base (`1814b81`) comme après T2 (`d004d3a`), les mondes de référence portent
**3 pièges** par monde, posés en cour, hors des couloirs. Après le placement T2,
le nombre reste à 3 : le couloir est juste mieux choisi. Aucune lampe, aucun
repère haut : à plus de ~12 m, une lame ne se distingue pas du décor.

## Ce qui a été fait

`src/world.js`, dans la pose des barrières :

- **La tournée gloutonne de `FPassages` s'ajoute aux liens dont le retrait
  déconnecte un objectif** (`mandatoryLinks`) : 6 à 7 coupes par secteur,
  **30 à 42 machines** par monde.
- **Les liens vraiment obligatoires sont implantés en premier.** Le plafond de
  machines par monde (`w.traps.length >= 40`) ne peut plus évincer un couloir sans
  alternative au profit d'un couloir de confort. Sans cet ordre, un secteur
  pouvoit voir son unique passage libre se faire murer par une coupe posée plus tard.
- **Dégâts relevés** : lame 18 → **26**, presse 24 → **34**, pics 18 → **24**.
- **Lisibilité de loin** : une lampe émissive sur chaque montant (`trap_lamp`) et
  deux barres d'alerte au-dessus du cadre (`trap_hazard`). Les barres sont posées
  **hors du centre** du couloir : `checks/world.test.mjs` exige que le ciel reste
  ouvert au point de circulation, et c'est une bonne règle — on ne doit pas
  construire au-dessus de la tête du joueur pour qu'il voie le piège.

## Le défaut que ce lot a lui-même trouvé

Première version : toutes les lames d'une coupe balayaient le couloir **dans le
même axe et à la même phase**. Résultat, `checks/simulation.test.mjs`
« A real generated level can be completed using navigation and ordinary
collision-respecting movement » a échoué — le bot ne pouvait plus finir le niveau.

Ce n'était pas un défaut du bot. Une rangée de lames synchrones sur tout le couloir
est **un mur continu**, pas un piège : il n'y a aucun instant où passer. Un piège
doit faire mal, pas couper le chemin.

Correction : les lames glissent **perpendiculairement** au couloir, chacune dans
son intervalle (`bladeTravel = min(piece × 0,9 ; 1,6)`, portée de poutre bornée à
`[3,2 ; 5,4]`), **à phase décalée** (`phase + j × période / n`). L'union des
courses barre toujours le couloir sur toute sa largeur — le banc T2 le vérifie —
mais il reste un instant où passer.

`checks/world.test.mjs` a été mis à jour pour garder la contrainte utile et lâcher
la fausse :

- une barrière a au moins deux lames, une presse et des pics ;
- tout le lot tourne **sur un seul rythme** (`period` unique) ;
- les lames **ne partent pas d'un même bloc** : une phase distincte par lame,
  sinon le couloir est muré.

## Ce qui a été vérifié

- `checks/traps-mandatory.test.mjs` : **55 tests, 55 réussis, 0 échec** — chaque
  barrière barre bien le chemin obligatoire (aucun contournement par le flood).
- `checks/world.test.mjs` : **PASS**, 18 cas — consistance des batteries, ciel
  ouvert au centre, aucun piège dans la zone d'entrée.
- `checks/simulation.test.mjs` : **120 tests, 120 réussis** — le niveau généré est
  bel et bien finissable en marchant, avec les collisions réelles.
- Budgets tenus sur les 120 mondes de référence (12 classiques + 108 campagne) :
  **maillages 17 587 / 18 000**, **colliers 500 / 512**, **42 machines max**,
  6 à 7 barrières par monde.
- Empreintes regelées : les 6 mondes classiques (`legacyHashes`) et les 108 mondes
  de campagne (`checks/campaign-world-digests.json`), via
  `node tools/platform-math.mjs worlds . --fixture write`.

## Ce qui n'a pas été testé

Rien de ce qui se voit — les lampes, les barres d'alerte, la lecture du piège à
distance — n'a été jugé dans un navigateur sur téléphone. Le banc prouve la
géométrie et la portée, pas la lisibilité ressentie. À valider sur appareil réel.
