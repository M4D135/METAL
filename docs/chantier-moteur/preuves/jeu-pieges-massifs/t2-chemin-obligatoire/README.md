# T2 — le piège barre le chemin obligatoire, sur la grille de navigation

## Ce qui a été mesuré d'abord

`checks/traps-mandatory.test.mjs` a été écrit **avant** de toucher à la
génération, et lancé sur la base du lot (`1814b81`, worktree détaché
`.relais/avant-t2`). Il fabrique 27 mondes — 3 graines × (3 secteurs classiques
+ 6 secteurs de campagne) — et, pour chacun, deux tests :

1. *chaque piège barre un passage obligatoire du secteur* : pour chaque barrière
   de pièges, la grille de navigation (`FPassages.grid`, corps de rayon 0,38,
   hauteur 1,80, marche 0,42) montre que la cible est atteignable sans la
   barrière et **ne l'est plus** avec (`FPassages.cuts`) ;
2. *relais, sortie et objets restent atteignables* : depuis le départ, chaque
   relais, la sortie et chaque objet sont joignables **avec** toutes les
   barrières en place (`FPassages.reaches`).

Sur la base : **27 échecs sur 27 mondes** au test 1 (28 succès : les 27 tests 2
+ le test unitaire). Autrement dit, aucun des pièges existants ne barrait
quoi que ce soit — ils étaient posés à côté du chemin, en décor.

## Ce qui a été fait

`src/world.js`, dans `demolitionWorld` (le placement des pièges) :

- suppression des 3 pièges décoratifs des cours extérieures ;
- calcul des couloirs obligatoires : `FPassages.mandatoryLinks` sur le graphe
  des salles (liens dont le retrait déconnecte un objectif — arène, sortie,
  cœurs), plus l'arène forcée (`corridor.arenaPath`), plus la tournée gloutonne
  `FPassages.tourLinks` ;
- pour chaque couloir retenu, mesure de la **largeur réellement praticable** au
  niveau de son sol, au ras du garde-corps, des deux côtés (`halfScan`) : un
  couloir trop large pour être un défilé n'est pas piégé ;
- pose d'une **coupe** solidaire perpendiculaire au couloir : n lames alignées
  qui balaient toute la largeur, une presse de plein fouet, des pics derrière,
  un cadre massif (montants, rails, moteurs) et des bandes d'alerte au sol.
  Toute la coupe partage la même période, la même phase et le même
  `destructibleId` : c'est une seule machine, pas trois objets ;
- les pièges n'ajoutent **aucun collier solide permanent** : ils ne peuvent pas
  couper le chemin quand ils sont au repos.

Garde-fous conservés : rien à moins de 6,50 m du départ, de la sortie, d'un
cœur, d'un mécanisme, d'un appel d'ascenseur ou d'une rampe ; rien sur un
couloir d'ascenseur ; plafond à 28 machines.

## Résultat

```
$ node --test checks/traps-mandatory.test.mjs
# tests 55
# pass 55
# fail 0
```

Les 27 mondes passent les deux tests : chaque piège est dans un couloir dont le
retrait déconnecte un objectif, et rien n'est devenu inatteignable.

## Empreintes déplacées (volontairement)

Les mondes JSON changent, donc leurs empreintes changent :

- les 6 empreintes classiques de `checks/campaign-world.test.mjs` (`legacyHashes`) ;
- les 108 empreintes de `checks/campaign-world-digests.json`, regelées par
  `node tools/platform-math.mjs worlds . --fixture write`.

Ce n'est pas un réajustement pour faire passer un test : les mondes sont censés
changer, puisque c'est la décision de David du 13/11 qui le demande.

## Ce qui n'a **pas** été testé

Le banc travaille sur la grille de navigation, pas sur le moteur physique du
jeu : il ne prouve pas qu'un joueur réel franchit la coupe au bon moment, ni
qu'il la voit de loin. Cela relève de T3 et, pour le ressenti, d'un appareil
réel.
