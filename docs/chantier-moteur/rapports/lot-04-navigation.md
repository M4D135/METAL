# Navigation, coordination et points de reprise — 15 novembre 2026

Base : `1dc42da`, branche `codex/finition-complete-20261115`. Développement Codex autorisé, aucun appel au modèle Spark. Les commandes ont utilisé le dépôt et Node de la machine accessible par SSH.

## Changements

- Graphe statique : hauteurs sans pose de piège, arêtes symétriques, balayage exact des arêtes adjacentes, empreintes complètes des presses et lames. Leur destruction retire l'obstacle. Le déplacement physique du joueur conserve les pièges mobiles.
- Masque du sol construit avec une frange de deux cellules ; buts de flanc ramenés sur le sol ; un garde placé sur la frange peut revenir.
- Rejet des composantes inaccessibles avant de consommer une recherche. Ouvertures réunies localement ; fermetures réétiquetées par tranches. Initialisation et restauration terminent les étiquettes synchroniquement. Les files d'arêtes sont réparées même lorsqu'un changement interrompt leur cuisson.
- Tas typé et nearestNode stable ; candidats de segments longs présélectionnés dans les seaux, avec repli conservateur. Cache négatif borné, clé comprenant le rayon exact, invalidation par époque. Les caches sont vidés à la frontière d'un point de reprise.
- Au plus deux A* par pas, budget de travail de 6 000 unités (pop 1, arête froide ou grand rayon 8), au plus 768 cellules puis 96 arêtes en maintenance. `false` signifie report et conserve le chemin ; `null` signifie échec.
- Couverts filtrés par niveau, rayons après le tri stable ; aperçu de tir interrompu au premier choix utile. Position atteignable de substitution : 841 cellules et six visibilités au maximum.
- Garde de composante avant les entrées naturelles, cache des approches, au plus 64 rayons de silhouette par pas. Retour au poste via un tremplin approprié, sinon poste provisoire. Un tremplin vers une impasse n'est pas choisi sans retour.
- Engagements simultanés limités à 2 + difficulté ; déplacement latéral sans jeton ; tir de suppression et grenade de débusquage fondés sur la dernière observation ; déplacement pendant l'annonce, sauf délai d'esquive. Replanifications événementielles limitées à trois par pas. Visée verticale bornée au sol avec trajectoire en vol.
- CPU tactique par défaut, WebNN explicitement expérimental ; les deux appliquent leurs conseils à la même échéance de 250 ms de simulation. Réponse tardive abandonnée, curseur remis à zéro à la frontière d'un point de reprise.
- Le point de reprise attend la navigation pendant au plus 1,5 s ; la sortie de page termine et écrit le point en attente. L'interdiction de sauvegarder en vol est conservée.

## Vérification et mesures

Les tests de partition couvrent 80 destructions/ouvertures aléatoires, les interruptions et les budgets. Les arêtes de quatre mondes sont comparées au balayage statique indépendant ; étiquettes et instantanés sont comparés après restauration. Tests supplémentaires : entrée des renforts, jetons, frange, réponse WebNN tôt/tard, replay CPU après point de reprise et report de sauvegarde.

Le banc `tools/proof/lot04/navigation-proof.mjs` compare les coûts au source de la base et vérifie séparément deux instances du nouveau comportement. **10 800 pas appariés et six instantanés finaux identiques.** Les trajectoires anciennes et nouvelles diffèrent volontairement ; les nombres de routes trouvées ne sont donc pas supposés égaux.

Source simulation mesuré : `d233dbeda2da1d5c66a3509d0cd298ab0d799e8cf0818ce9921115e9d5c7e905`.

| Scène | Route base µs | Route nouvelle µs | Pas base µs | Pas nouveau µs | Max nouveau ms |
|---|---:|---:|---:|---:|---:|
| legacy0 | 780.95 | 25.01 | 150.48 | 147.98 | 7.21 |
| legacy2 | 1216.75 | 125.01 | 173.91 | 167.31 | 2.0 |
| campaign6 | 1265.26 | 25 | 136.87 | 142.89 | 2.0 |
| campaign17 | 1204.01 | 74.96 | 196.34 | 151.6 | 2.0 |
| profiles6 | 1221.53 | 19.88 | 135.3 | 101.73 | 1.05 |
| profiles17 | 1262 | 37.21 | 160.48 | 128.58 | 2.0 |

Mesure Node 24.18 en domaine principal, temps CPU du fil. L'horloge est grossière (nombreux pas à 0 ou 1 000 µs) : les moyennes agrégées servent à la comparaison ; les percentiles sous la milliseconde ne sont pas une précision réelle. Ce n'est ni un résultat FPS, ni une mesure GPU.

Un premier passage a donné un pic de 17,533 ms sur legacy0, contre 7,205 ms dans le passage final. Les deux sorties sont conservées : aucune garantie universelle sous 8 ms n'est déduite de ces tours. La preuve T5 des premières destructions de colosses doit être rejouée sur l'assemblage final.

Le passage complet initial a révélé 30 échecs de bancs obsolètes : modules tactiles absents du faux navigateur, import sans espace mal reconnu par son contrôle et faux GL/extracteur de modèles incomplets après le natif et l'interpolation. Corrigés : modules, vrais coordonnées/événements PointerEvent, attentes fondées sur le pas fixe, capacités GL et `renderState` de test. Les 39 tests ciblés repassent. Le passage complet corrigé termine à **1 040 réussis, zéro échec**. Le parcours Chrome valide 13 contrôles : démarrage, alternance légère/lourde, clavier, RB/A, pause, haptique simulée, visée au tir tactile, course, annulation, trois tailles et rotations. Son artefact est exactement celui du build : `8bd1f3a5cb423c7899721716857d397a4782e6d3c8cf0845caa520a6e5f0977a`, 1 114 833 octets, zéro ressource extérieure.

## Limites conservées pour la suite

La cuisson initiale reste synchrone dans `FSimulation.create` : son découpage à l'écran de chargement relève du raccord de cadence. Les listes de voisins gardent leur propriété par appel (certains appelants les conservent pendant des appels imbriqués) ; aucune économie d'allocation n'est revendiquée pour ces listes. La sélection de couverts garde l'ordre des solides pour préserver les égalités ; seul le balayage des segments utilise les seaux.

Les essais matériels de manette, téléphone et écoute ne sont pas remplacés par Chrome ou les périphériques simulés. Publication GitHub et Sites encore distincte de ce commit de travail.
