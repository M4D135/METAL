# Validation de FERRO 0.4.0 — Horizons

Vérifications réalisées le **12 novembre 2026** sur le fichier autonome assemblé et les sources correspondantes.

## Version contrôlée

- Dépôt : https://github.com/M4D135/FERRO
- Site privé : https://ferro-procedural-fps.garden-lake-2660.chatgpt.site/
- Version : **0.4.0**, génération de terrain **4**.
- Taille du fichier jouable : **248 290 octets bruts**, **76 041 octets gzip**.
- SHA-256 du HTML : `7fd67226b0f445b99e51b64c7737de49e775d73fd2776870253ef92d3c3f32f2`.
- Aucun asset ou code externe chargé à l’exécution. Le navigateur reste exclu de la mesure.

Les trois territoires mêlent des cours et chemins à ciel ouvert avec des bâtiments industriels. Le joueur commence dehors. Les deux armes, neuf relais, évents et gardien final restent présents. La simulation ajoute perception, mémoire, alerte locale, navigation tactique et couverture sans augmenter les PV ou dégâts des machines.

## Résultat des contrôles automatisés

| Groupe | Résultat |
| --- | --- |
| Génération et accessibilité | **18 configurations réussies**, 750 cibles contrôlées |
| Simulation | **42 tests réussis**, dont les 30 régressions précédentes |
| Mouvement et présentation | **7 tests réussis** |
| Bouton Continuer et migration du stockage | **4 tests réussis** |
| Distribution | Taille, SHA-256, modules embarqués et absence de chargement externe vérifiés |

La suite du projet a passé. Après le dernier durcissement du couvert au rayon 3D, les 53 tests simulation/mouvement/shell ont été réexécutés sur les sources finales ; le build et son contrôle ont également passé. La génération n’avait pas changé depuis ses 18 vérifications.

Commandes reproductibles :

```sh
python3 tools/build.py
node checks/world.test.mjs
node --test checks/simulation.test.mjs checks/motion.test.mjs checks/checkpoint.test.mjs
node checks/build.test.mjs
```

## Mondes et extérieurs

Six graines sont vérifiées dans chacun des trois secteurs : `1`, `7`, `42`, `96`, `2026`, `65535`. Un flood fill indépendant utilise un disque joueur de rayon **0,28 m**, une grille de **0,25 m** et les obstacles réels, sans diagonale traversant les coins.

Les contrôles couvrent le déterminisme, les valeurs finies, le dégagement du départ, les centres des régions, les relais, la sortie, les soins et les positions initiales des ennemis. Les objectifs restent accessibles lorsque tous les évents sont considérés dangereux. Chaque axe de connexion reste ouvert, et l’arène conserve son dégagement pour le gardien.

Les tests extérieurs vérifient également :

- Cinq régions extérieures dans chacun des secteurs, et des atmosphères distinctes.
- Présence d’un arbre proche dans le champ avant au départ.
- Rayons verticaux libres vers le ciel au centre des régions et chemins extérieurs.
- Correspondance exacte des colliders avec leurs meshes solides visibles.
- Troncs collidables jusqu’à 2,9 m, utilisables comme obstacle à hauteur de tir.
- Conservation des troncs, canopées et silhouettes essentielles au niveau de détail minimal.
- Un second flood fill qui **ignore entièrement le masque de sol** : aucune cellule accessible ne sort du terrain. Les frontières bloquent donc physiquement le joueur et ne reposent pas sur une restriction invisible du sol.

| Secteur, graine 96 | Meshes statiques | Arbres | Arbres dans les zones jouables | Cours extérieures | Chemins extérieurs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lisière rouillée | 10 696 | 48 | 20 | 5 | 7 |
| Carrière des braises | 8 378 | 10 | 10 | 5 | 9 |
| Jardins du veilleur | 12 275 | 44 | 20 | 5 | 12 |

Sur les 18 configurations, les budgets observés vont de **8 324 à 12 356 meshes** et de **177 à 213 colliders**, sous les plafonds de 16 000 et 500. Ces nombres décrivent le monde généré complet ; le renderer n’affiche que sa partie pertinente.

Le sol de circulation reste horizontal. Collines et falaises de fond donnent du relief au décor ; elles ne constituent pas des pentes ou plateformes traversables.

## Preuves comportementales de l’IA

Les nouveaux contrôles observent les trajectoires et les conséquences des décisions, pas seulement le nom d’un état.

1. **Perte de trace.** Deux parties identiques placent le joueur dans deux positions cachées différentes après une observation. Les décisions, souvenirs et trajectoires des ennemis restent strictement identiques. La mémoire expire ensuite sans observation nouvelle.
2. **Patrouille.** Une machine non alertée parcourt réellement un trajet local, en restant sur le terrain autorisé.
3. **Bruit.** Les tirs d’Impulse, Fracture et l’onde produisent des enquêtes sur le lieu de leur émission. Un mur réduit la portée d’écoute ; déplacer ensuite le joueur caché ne déplace pas ce souvenir.
4. **Coordination locale.** Un observateur prévient un voisin proche avec sa position connue. Un allié qui ne voit pas le joueur ne retransmet pas cette alerte à toute la carte.
5. **Contournement.** Un éclaireur atteint un flanc en passant physiquement autour de l’extrémité d’un mur solide, sans le traverser.
6. **Couvert puis sortie.** Un éclaireur blessé rejoint une position réellement masquée par une caisse haute, attend, ressort sur un côté puis reprend une attaque annoncée. Un vrai tir vers le scout caché laisse son dernier PV intact. Sauvegarder puis restaurer au milieu de ce comportement conserve la suite exacte.
7. **Séparation.** Les membres d’un groupe se dégagent sans traverser les collisions ; leur vitesse de présentation correspond au déplacement mesuré.
8. **Canon contre un mur.** Une rafale déjà engagée ne peut pas créer un projectile de l’autre côté d’une paroi lorsque le canon la touche.
9. **Cadence.** Une investigation suit le même trajet physique à 20, 60 et 120 pas de simulation par seconde.
10. **Reprise tactique.** Les données mal formées sont refusées sans modifier la partie. Une ancienne reprise compatible importe seulement sa visée enregistrée, sans obtenir la position actuelle d’un joueur caché.
11. **Gardien.** La recherche après perte de contact reste dans son arène, sans l’expédier dans une liaison trop étroite.
12. **Mondes réels.** Des mises à jour tactiques dans les nouveaux extérieurs conservent des positions physiques valides et des checkpoints restaurables.

La revue indépendante a trouvé un arrondi flottant : une attente calculée à `1.4000000000000001` était refusée par une limite de snapshot à `1.4`. Les durées sont maintenant les littéraux `[1.1, 1.25, 1.4]`. Le scénario de couverture et reprise contrôle ce cas avec un ennemi d’identifiant 2.

Les anciens contrôles de collision, de rayon 3D, des deux armes, de surchauffe, d’onde, de charge et rafale verrouillées, d’évents, de score, de boss et de victoire sont conservés. Le parcours de niveau généré avec déplacement ordinaire continue de réussir.

## Mouvement et sauvegardes

Les sept tests de présentation conservent les contrôles des ressorts à différentes cadences, du repos après déplacement, des mouvements réduits, du recul borné et du montage cohérent de l’arme avec lacet, tangage et roulis. Les contrôles de locomotion restent dans la simulation, notamment les collisions, diagonales, accélération, freinage et esquive.

Les quatre tests du shell exécutent le vrai module navigateur avec DOM, son et rendu simulés, et la vraie validation de simulation. Ils actionnent le bouton **Continuer** et examinent l’état ainsi que les écritures de stockage :

- Un point de génération 4 reprend à son relais.
- Un point de génération 3 reprend à l’entrée du même secteur, avec graine, arme et totaux des secteurs terminés.
- Une ancienne enveloppe sans champ `generation` suit la même migration.
- Un snapshot incompatible reprend son secteur sans écraser une copie de migration existante.

L’ancien point est conservé séparément si le stockage le permet. Les relais et ennemis du secteur en cours sont réinitialisés lors d’une migration de terrain. Les points compatibles gardent le mode de récupération avec protection transitoire, sans inflation des statistiques.

## Navigateur et commandes

Le navigateur de contrôle utilise le secours **Canvas 2D** ; ces observations ne constituent donc pas une validation WebGL dans Chromium ou Safari.

Contrôles effectués dans l’aperçu géré du projet :

- Menu Horizons et arbres/ciel visibles dès le départ.
- Reprise d’une vraie sauvegarde de la version précédente : message de migration et entrée dans le même secteur observés.
- Déplacement au clavier depuis la lisière jusqu’au sentier des fougères ; collisions, poursuite et dégâts ennemis actifs.
- Tir continu, surchauffe, onde, pause et reprise.
- Élimination puis retour au point de reprise, avec intégrité restaurée.
- Passage entre Auto, Économie et Haute, puis retour en Auto.
- Menu, HUD, pause et boutons aux formats **390 × 844** et **844 × 390**, avec commandes tactiles forcées. Aucun débordement de la page dans les dimensions contrôlées.
- Actions des boutons d’onde, d’esquive et de changement d’arme dans le format paysage. L’interface affiche bien Fracture ensuite.
- Aucune erreur JavaScript attribuée à la page du jeu dans les journaux inspectés. Des erreurs d’extension du navigateur sont distinctes du jeu.

Sur le build final, des relevés ponctuels au premier plan à **1363 × 936** ont donné environ **21 images/s en Auto** pendant le déplacement et **39 images/s en Économie** dans le sentier. Ces relevés ne comparent pas un trajet strictement identique et ne sont pas un benchmark matériel ni une garantie sur toute la campagne. Les deux iframes mobiles servent à contrôler l’interface, pas à mesurer les performances.

Le site de production garde une porte de connexion privée. Le contrôle visuel porte sur l’aperçu ; le résultat de publication est confirmé séparément par le service d’hébergement.

## Rendu GLES réel et ressources

Les shaders réels sont exécutés dans un contexte **EGL / OpenGL ES logiciel Mesa**. Ce contrôle est indépendant du navigateur de test et n’active aucune option graphique spéciale dans celui-ci.

Les images contrôlées comprennent les trois extérieurs, un intérieur, cet intérieur avec flash de tir, la proximité d’un mur, ainsi que les modes Auto, Haute et Économie. **Zéro erreur GL** dans ces vues ; les shaders compilent et les framebuffers de rendu sont complets.

Le ciel, les nuages, le soleil, les matériaux naturels et les ombres directionnelles sont visibles. Les volumes des bâtiments masquent le ciel, et l’éclairage intérieur conserve son caractère industriel. Les bandes du défaut d’ombre précédent ne réapparaissent pas dans les vues contrôlées.

L’atlas contient une lampe locale, le soleil et la torche. Le soleil utilise neuf lectures PCF pondérées, sur 56 m de couverture en Auto ; la lampe et la torche conservent quatre lectures. Le sampler de profondeur reste explicitement **highp**, la correction de pente est appliquée à chaque échantillon et le décalage de torche reste dans le rayon de collision du joueur.

Une assertion confirme que la passe couleur et les trois passes de profondeur reçoivent exactement le même vent et le même temps. Les silhouettes et ombres de feuillage ne sont donc pas animées avec des horloges différentes.

Un cycle Auto → Économie → Haute → Économie → Auto puis destruction du renderer compte **47 ressources créées et 47 libérées, zéro restante**. Le même contrôle avec framebuffers forcés incomplets n’observe aucune fuite. Ce contrôle des appels et allocations complète le rendu GLES réel ; il ne mesure pas la mémoire d’un pilote physique.

Le secours Canvas a reçu deux niveaux de facettes, des chapeaux de cylindres regroupés et une projection unique des sommets partagés. Le contrôle Canvas natif séparé passe d’environ 100 ms par vue extérieure avant ces changements à 44–48 ms en Auto, et environ 22 ms en Économie. Ce comparatif natif ne doit pas être présenté comme des FPS navigateur.

## Limites pratiques

Les essais ne remplacent pas une partie humaine complète ni une validation sur GPU physique, Safari macOS/iOS ou téléphone réel. Le multitouch simultané et l’équilibrage de la campagne restent à éprouver sur ces appareils.

Le secours Canvas utilise un tri de polygones et des ombres projetées simplifiées ; certaines intersections peuvent rester imparfaites. Les ombres WebGL ne couvrent qu’un voisinage et les sources retenues, pas toutes les lumières du niveau. Le déplacement reste horizontal et la boucle conserve au plus 0,12 s par image : une machine durablement sous environ huit images/s peut encore ralentir la simulation.
