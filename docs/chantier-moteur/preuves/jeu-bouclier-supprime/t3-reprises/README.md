# T3 — Reprise des points de reprise écrits avant le retrait

## Question traitée

Le BRIEF exige : « Les points de reprise antérieurs doivent se charger sans le
bouclier ou être refusés proprement, sans planter. » Les deux branches sont
couvertes, et la branche réellement déclenchée est mesurée, pas supposée.

## Fabrique de fixtures

`generer-points-legacy.mjs` charge le code de la **base du lot**
(`35c654a`) dans un processus Node, équipe trois parties avec le bouclier
(`inventory.shield:true`, `equipment.left:'shield'`, bouclier levé en cours de
route, armure à capacité 200, `campaign.discovered` contenant `'shield'`),
fait tourner 600 pas d'entrée réelle, puis consigne `snapshot()` et
`exportLoadout()` compressés :

| Fichier | Mode | Empreinte du point | Contenu bouclier conservé |
| --- | --- | --- | --- |
| `points/classique-s0.json.gz` | classique s0 i0 | `575kl1` | `state.shield`, `inventory.shield`, main gauche `shield`, armure 200 |
| `points/campagne-v1-w7.json.gz` | campagne v1 i6 | `504r81` | idem |
| `points/campagne-v2-w16.json.gz` | campagne v2 i15 | `15dro5r` | idem |

`manifeste.json` reprend l'empreinte, la version de campagne, la version
d'économie et les champs bouclier de chaque point. Un test vérifie d'abord que
ces fixtures contiennent **vraiment** le bouclier, pour qu'aucune vérification
ultérieure ne repose sur un point déjà nettoyé.

Régénération :

```
node docs/chantier-moteur/preuves/jeu-bouclier-supprime/t3-reprises/generer-points-legacy.mjs <base> docs/chantier-moteur/preuves/jeu-bouclier-supprime/t3-reprises/points
```

## Ce que la simulation fait vraiment

Aucun point antérieur **ne se charge** : l'identité du monde a changé, et pour
de bonnes raisons. L'empreinte d'un point mélange la génération du monde, or le
lot a supprimé `progression.startShield` de tous les mondes générés et remplacé
le ramassage d'ouverture `arsenal-shield` par `arsenal-smg-cells`. Sonde sur
96 combinaisons (classique + campagne v1/v2, 18 index) : **0 empreinte
identique** entre la base et l'arbre courant. Faire semblant du contraire — en
normalisant l'empreinte pour masquer ces changements — ferait accepter des
points qui décrivent des ramassages et des réglages qui n'existent plus.

Le refus est propre, et c'est ce que vérifie `checks/legacy-checkpoint.test.mjs`
(**4 tests, 4 passés**) :

1. les fixtures contiennent bien le bouclier et correspondent à leur manifeste ;
2. `restore()` des trois points antérieurs renvoie `false` **sans lever**, et
   l'état en cours est inchangé au bit près (`JSON.stringify(snapshot())` avant
   = après) — pas de mutation partielle, pas de PV fuiés, aucun champ bouclier
   introduit ;
3. le `exportLoadout()` de ces mêmes parties équipe quand même une partie
   fraîche : main gauche libérée (`null`), main droite sur une arme possédée,
   capacité d'armure ramenée à 100, `'shield'` retiré des découvertes, et le
   résultat repasse par `restore()` sans accroc ;
4. une charge **taillée pour le code antérieur** mais posée sur un monde inchangé
   (mêmes champs bouclier réinjectés dans un point courant) se charge : `restore()`
   renvoie `true` et l'état obtenu est **identique** à celui d'une partie saine.
   La tolérance n'est donc pas un chargement dégradé : elle converge vers le
   même état.

Le chemin de l'interface (point irrécupérable → repli sur l'équipement
d'entrée, sans écran figé) est couvert par `checks/checkpoint.test.mjs`.

## Vérification complète

`npm test` : **510 tests, 510 passés, 0 échec** (505 sur la base du lot, +4 ici,
+1 côté audio à la tâche précédente).

## Ce qui reste à vérifier hors simulation

Le stockage réel (`localStorage`, import/export de fichier, reprise depuis un
appareil où le jeu tournait avant le lot) n'est pas exercé ici : les points
antérieurs sont rejoués en mémoire depuis des fixtures. Une reprise sur
navigateur réel, avec une sauvegarde écrite avant le déploiement, confirme la
chaîne complète de stockage.
