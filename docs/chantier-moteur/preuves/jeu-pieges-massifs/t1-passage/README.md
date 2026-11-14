# T1 — la brique `FPassages` : un couloir est-il obligatoire ?

## Le problème

Un piège n'a de sens que s'il barre un chemin que le joueur est **obligé** de
prendre. Avant ce lot, la position d'un piège était choisie à la main dans une
salle extérieure : rien, dans le code, ne savait dire si ce point était sur le
chemin obligatoire. Un secteur sans piège passait donc inaperçu.

Il fallait une brique qui réponde, sur des données plates et sans connaître le
jeu, à deux questions :

1. « si j'enlève ce lien du graphe, est-ce que l'objectif n'est plus atteignable ? »
2. « est-ce que ce point est bel et bien le seul passage entre ces deux zones ? »

## Ce qui a été créé

`src/passages.js`, script autonome qui n'expose qu'un global : `FPassages`.
Il ne connaît ni salles, ni pièges, ni METAL, ni aucune table de contenu : il ne
reçoit que des rectangles, des solides, un graphe de liens et une fonction de
hauteur de sol. Il ne lit ni horloge ni hasard, ne fait aucun appel réseau, et ne
dépend d'aucun ordre d'itération propre à l'environnement. Comme `world.js`, il
prend son hypoténuse de l'engine (`FMath.hypot2`, lu au chargement) et refuse de
charger sans `src/fmath.js`.

API :

| Fonction | Rôle |
| --- | --- |
| `grid({bounds, cell, radius, height, step, heightAt, solidAt})` | grille d'occupation d'un corps de rayon `radius` : une cellule est libre si le sol y existe, si aucun solide n'y gêne le corps, et si la marche avec la voisine reste ≤ `step` |
| `flood(grid, sources, blockers, region)` | propagation 4-voisins sur les cellules libres, en bloquant des rectangles temporaires et dans une région optionnelle ; rend le masque des cellules touchées |
| `reaches(grid, sources, target, blockers, region)` | un corps partant de `sources` peut-il joindre `target` ? |
| `cuts(grid, source, target, box)` | ce rectangle barre-t-il le chemin : atteignable sans lui, injoignable avec lui |
| `nearestFree(grid, point, radius)` | cellules libres les plus proches d'un point mal placé, en anneau déterministe |
| `mandatoryLinks({links, start, objectives})` | liens dont le retrait déconnecte au moins un objectif : le couloir forcé |
| `tourLinks({links, start, objectives})` | tournée gloutonne la moins coûteuse qui passe par tous les objectifs : les liens que le joueur est bien obligé de parcourir |

`mandatoryLinks` est le critère dur (un lien sans alternative). `tourLinks` le
complète : un couloir peut avoir un contournement qui n'a aucun intérêt, et un
piège y a pourtant sa place parce que personne ne le contourne en jouant.

## Banc

`checks/passages.test.mjs` — 9 tests, hors jeu, sur des grilles fabriquées à la
main (couloir étroit, salle ouverte, renfoncement, porte unique, deux chemins,
marche trop haute, solide qui bouche, objectif isolé).

```
$ node --test checks/passages.test.mjs
# tests 9
# pass 9
# fail 0
```

## Ce qui n'a **pas** été testé

Rien de ce fichier ne prouve que les mondes réels sont bien piégés : c'est le
rôle du banc `checks/traps-mandatory.test.mjs` (dossier `t2-chemin-obligatoire`).
Et rien ici ne vaut test sur un appareil réel : la brique ne touche ni au rendu
ni aux commandes.
