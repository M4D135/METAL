# Lot 01 — STAB-V1 : subdivision provisoire

La formule réellement extraite de `src/game.js` devient `Math.max(1,Math.ceil(dt*60-.06))`. Les horodatages quantifiés à 0,1 ms ou 1 ms et le rafraîchissement à 59,94 Hz ne doublent plus les sous-pas. Le temps écoulé reste intégralement simulé ; le pas reste inférieur à 17,7 ms. La boucle fixe et son interpolation restent au lot 07.

## Preuve fonctionnelle

`checks/cadence.test.mjs` exerce la formule de production, 36 000 images à partir de deux origines d'horloge, neuf fréquences, tous les deltas en microsecondes jusqu'à 120 ms, puis une vraie simulation de sprint et d'esquive contre un mur mince. Les cinq tests passent. Cette correction change volontairement le découpage temporel : on ne revendique pas une trajectoire identique avant/après.

## Mesure appariée dans le domaine principal

Commande : `node tools/cadence-profile.mjs <main-081> <candidat> c0 15 5`. Le rapport brut joint conserve les racines réellement utilisées et les SHA-256 des sources. La racine de référence historique `METAL-title-metal` contient exactement les sources de main 63668ac, sans se fier à son ancien HEAD local. Le banc partage les fonctions de simulation identiques compilées, conserve des états indépendants, alterne AB/BA par image et par répétition, élimine une chauffe complète, et utilise le temps CPU du thread. Les snapshots sont reproduits au sein de chaque variante.

| Horloge | Pas avant | Pas après | Ratio CPU médian apparié après/avant |
|---|---:|---:|---:|
| 60 Hz, arrondi 0,1 ms | 1 500 | 900 | 0,800 |
| 60 Hz, arrondi 1 ms | 1 500 | 900 | 0,957 |
| 59,94 Hz | 1 800 | 900 | 0,841 |
| 30 Hz | 1 185 | 900 | 0,828 |
| 120 Hz, contrôle | 1 800 | 1 800 | 0,917 |
| 144 Hz, contrôle | 2 160 | 2 160 | 0,975 |

Chaque passage représente 15 secondes. Le résultat robuste est le nombre de pas : zéro image à deux pas dans les trois motifs de classe 60 Hz. Les contrôles sans changement de nombre de pas présentent eux aussi un écart CPU. Le gain annoncé de 18 à 48 % n'est donc **pas reproduit uniformément**, notamment avec l'arrondi à 1 ms (4,3 % mesurés). Le correctif est conservé pour le défaut fonctionnel démontré de subdivision, sans promesse universelle de gain CPU. Les médianes de ratios appariés ne sont pas le quotient de deux médianes indépendantes.

Les mesures précédentes basées sur le banc historique et le premier essai apparié ne remplacent pas ce rapport final. Les données brutes sont compressées sans perte ; le manifeste en donne tailles et empreintes.
