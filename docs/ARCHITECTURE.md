# Architecture — METAL 0.5.0

## Distribution et identité

`tools/build.py` assemble **onze modules JavaScript**, `index.html` et `style.css` dans un HTML autonome. Aucun chargement réseau de code, image, texture, modèle, police ou audio n’est nécessaire. `SIZE.json` mesure le HTML brut, son gzip reproductible et son SHA-256. Le budget est de 1 400 000 octets bruts ; navigateur, pilotes, tests et documentation sont exclus.

Le titre public devient **METAL**. Les API `FWorld`, `FRender`, etc., le format de snapshot `FERRO`, les clés `ferro-settings` / `ferro-expedition-v2` et le dépôt GitHub historique restent inchangés pour préserver les références et les migrations.

| Module | Responsabilité |
| --- | --- |
| `world.js` | Monde déterministe, terrain, arènes, population, systèmes, danger et métadonnées de démolition |
| `destruction.js` | Découpe, assemblages, dépendances structurelles, collisions et snapshots de terrain |
| `simulation.js` | Physique, IA, projectiles, objectifs, boss, directeur de tension et validation des reprises |
| `actors.js` | Modèles articulés, poses et LOD des quatre familles et des trois colosses |
| `motion.js` | Présentation amortie, caméra et repère unique des armes |
| `effects.js` | Représentation des projectiles, explosions, vapeur, débris, pièges et attaques de boss |
| `renderer.js` | Primitives, matériaux, ombres, WebGL 2 et secours Canvas 2D |
| `music.js` | Générateur, exporteur et lecteur de modules ProTracker |
| `audio.js` | Contexte audio, effets, ambiances, pression, mixage et protection de crête |
| `options.js` | Préférences bornées, difficulté, touches et conflits |
| `game.js` | Entrées, boucle, menus, HUD, montage des systèmes et sauvegardes navigateur |

## Monde et circulation

La génération 5 agrandit les territoires par rapport à la génération 4 et ajoute terrasses, systèmes, tremplins, substrat et arènes. Les graphes possèdent des boucles et des rampes alternatives aux ascenseurs. Les métriques suivantes concernent la graine 96 :

| Secteur | Régions | Liaisons | Somme des liaisons | Meshes statiques | Colliders |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lisière | 10 | 11 | 467,6 m | 13 964 | 437 |
| Carrière | 9 | 10 | 477,7 m | 12 453 | 411 |
| Jardins | 10 | 13 | 612,7 m | 17 264 | 493 |

La somme des liaisons n’est pas une distance minimale de campagne ni une durée de jeu. Le nombre de meshes est le nombre de descriptions du monde, pas le nombre de pièces affichées simultanément.

Le terrain combine plans plats et rampes `{x,z,w,d,y,slopeX,slopeZ}`. La hauteur vaut `y+(px-x)*slopeX+(pz-z)*slopeZ`. Les sols de salle sont prioritaires dans les petits recouvrements de raccord ; le **substrat `fallback:true,substrate:true` n’intervient qu’en l’absence de sol local**, afin de ne jamais aplatir une rampe. Ce terrain inférieur visible est à −0,25 m. Les sols et rampes sont portants et ne sont pas excavés par la destruction.

`player.y` et `enemy.baseY` désignent les pieds. `enemy.y` désigne le centre de visée historique, adapté à l’échelle des géants. Les meshes de sols portent `ground:true`. Les surfaces inclinées visuelles et physiques coïncident. Les gros troncs, rochers, parois, portes et équipements possèdent des collisions ; les détails fins restent décoratifs.

Chaque secteur possède trois commandes, trois portes, deux ascenseurs, trois tremplins, trois relais, quatre conduites et trois pièges. Un boss et six renforts de boss sont compris dans les totaux de 120 / 140 / 170 acteurs. Huit lourds par secteur utilisent un lance-grenades, six un lance-roquettes. Les autres conservent leurs rôles ordinaires.

Les arènes font 60 × 60 m, avec un rayon de combat de 28 m et une passerelle d’accès de 13 m. Les frontons monumentaux restent au-delà de 27 m du centre. Leur géométrie est destructible et leurs linteaux possèdent de vrais supports. Le centre est dégagé ; les couverts restent périphériques.

## Systèmes et physique

`nearestInteraction()` choisit une action à moins de 2,6 m, au bon palier et sans obstruction. F ou l’action tactile déclenche `input.interact` au premier sous-pas seulement. Les commandes alimentent les systèmes par `requires` ; une console détruite active son circuit pour éviter un verrouillage de mission. Une porte détruite cesse de bloquer immédiatement.

Une porte mobile utilise le même `progress` pour son battant visuel et physique. Les lifts exposent `y`, `target`, `powered`, `moving` et `carrying`. Les passagers restent posés sur leur plateau, avec vérification des murs et de l’espace au-dessus de la tête. `liftStop.carrying` distingue l’arrivée du joueur d’un rappel à vide.

Les tremplins exposent `{id,x,y,z,r,target:{x,y,z},flightTime,yaw}`. Le contact calcule une impulsion depuis la position réelle, avec gravité de 12 m/s², sans recentrer ni téléporter l’acteur. Les champs `airborne`, `airVX/Y/Z`, `airTime`, `padCooldown` et `padId` sont sauvegardés. Les plafonds, murs et atterrissages sont physiques ; le cooldown empêche une relance involontaire au même contact.

Le shell conserve au plus 0,12 s de temps écoulé par image, divisée en sous-pas d’au plus 1/60 s. Les entrées ponctuelles sont consommées une seule fois ; les tirs et déplacements tenus continuent. Une suspension plus longue ne déclenche pas un rattrapage illimité. Les déplacements sont eux-mêmes subdivisés pour ne pas franchir une paroi mince.

Le disque du joueur a un rayon de 0,28 m. L’index de collision en cellules de 8 m sert aux acteurs ordinaires ; les grands rayons conservent une requête exhaustive exacte. Les géants ont un rayon de corps `1.5*bossScale` et une hauteur de `3.18*bossScale`. Leur centre reste dans `max(1,arena.r-2.1*bossScale-5)` autour du centre de l’arène : cette marge inclut les longs canons et préserve les couverts périphériques.

## Destruction persistante

`FDestruction.create(world)` garde le monde original immuable et expose :

```js
{
  meshes, colliders, lights, revision,
  isAlive(id), raycast(origin,direction,maxDistance),
  hit([x,y,z],power,direction), blast([x,y,z],radius,power),
  snapshot(), restore(data,options)
}
```

Les groupes `world.destructibles` rassemblent solides et détails attachés, avec identifiant, résistance, limites et dépendances. Les arbres réunissent tronc et canopée. Les éléments statiques animés et les lampes indiquent leur propriétaire destructible.

Une boîte moins une boîte produit au plus six solides disjoints. Les fragments survivants utilisent **les mêmes limites pour le rendu et les collisions**. Les éléments séparés de leur support disparaissent de la structure et émettent des débris. Les pièces et découpes par groupe sont bornées ; il ne s’agit ni d’un monde voxel ni d’un solveur structurel complet.

Le raycast des accessoires respecte les primitives, notamment le trou d’un tore, au lieu d’utiliser systématiquement sa boîte pleine. Les fittings retirés cessent aussi d’être animés. Les lampes détruites sont retirées de la liste d’éclairage.

La simulation compare la révision du contrôleur pour reconstruire collisions et navigation après changement. `state.destructionRevision` est un compteur de présentation monotone, y compris lorsqu’un restore remplace le contrôleur par un candidat atomiquement validé. **Le shell utilise ce compteur**, car deux contrôleurs différents peuvent avoir la même révision logique.

`renderer.updateWorld(meshes,revision,lights)` invalide sélections et caches d’ombre/couleur nécessaires, conserve caméra et réglages, et réutilise les allocations GPU et la géométrie inchangée. Il est appelé après les sous-pas, une fois par image au plus.

## Armes, projectiles et dommages

Impulse est un tir précis ; Fracture disperse sept rayons ; Rupture crée une roquette physique. Les trois armes partagent chaleur et surchauffe. L’onde a un rayon de 6,5 m, une recharge de sept secondes et respecte le couvert.

La bouche nominale de Rupture est à `eye + right*.255 + up*(-.23) + forward*1.228`. Le trajet œil → bouche est vérifié avant le lancement ; la roquette vise ensuite l’intersection du viseur. Trop proche, un impact non armé produit un choc local de terrain et `rocketDud`, sans explosion créée derrière le mur.

Les roquettes et grenades balaient leur rayon physique sur tout leur déplacement. Les grenades suivent une parabole, rebondissent et possèdent un délai d’explosion. Les spécialistes préparent leur attaque à partir d’une observation, contrôlent la trajectoire et refusent une zone cible occupée par leur groupe.

Le souffle évalue le couvert **avant** de démolir la scène. Il ne profite donc pas rétroactivement de sa propre brèche pour traverser une protection. `state.projectiles`, `explosions` et `debris` sont distincts des anciennes balles et particules. `age` avance tandis que `life` garde la durée totale des effets.

## IA et charge de calcul

Les ennemis alternent patrouille, investigation, engagement et recherche. Vue, son, mémoire, observation verticale et partage local déterminent ce qu’ils savent. Un joueur caché ne transmet pas sa position actuelle. Flanc, couverture, suppression et visée prédictive utilisent cette information observée.

Les machines mobiles se séparent physiquement. Les tripodes se repositionnent. Les esquives ont un délai de réaction et ne retirent pas un dégât déjà résolu. Certaines machines prennent un tremplin si son arrivée rapproche de leur dernier contact mémorisé. Les principes de Quake III ont été consultés dans le dépôt officiel ; aucun code GPL n’a été repris.

Les routes A* utilisent une grille de 0,8 m, un budget de deux recherches par sous-pas, des passages testés avec le volume de l’acteur et un cache de segments. Un index de voisins évite une comparaison quadratique de toute la population. Les acteurs éloignés peuvent dormir sans perdre leur identité ou leurs PV ; il n’y a pas de quota d’ennemis proches effacés.

La démolition invalide les passages concernés. **Le champ global BFS `nav.dist` n’est plus calculé automatiquement pour les mondes avancés** : l’IA emploie ses routes locales. Une lecture explicite de l’API historique le reconstruit à la demande. Cela retire un gel important après portes et brèches, sans changer la décision de parcours.

## Colosses et directeur de tension

Les boss possèdent `bossScale` 5,4 / 7,2 / 9, `bossKind`, `bossName` et `arena`. Les états sauvegardés comprennent `bossAwake`, `phase` 0–2, `bossClock`, `bossStep`, `attackLabel`, `weakPointOpen` et `weakTimer`. Les renforts restent des acteurs préplacés, libérés par phase.

Les seuils de phase sont 67 % et 34 % des PV. L’entrée dans l’arène déclenche l’éveil ; un boss n’attaque pas à travers le territoire avant activation. Les scripts emploient disques d’écrasement, anneaux creux, capsules de balayage et barrages de vraies roquettes. La cible d’une attaque annoncée est engagée à partir du dernier contact observé.

Le cœur local est **`[0,1.93,-.90]*bossScale`**, rayon **`.36*bossScale`**. Il ressort devant le plastron et reste enregistré sur le torse, indépendamment de la marche. La fenêtre après récupération dure 3 / 2,7 / 2,4 s selon phase. Les dégâts au cœur ouvert sont multipliés par 3,2 ; les autres impacts subissent le facteur d’armure de 0,30. Torse, casque et jambes restent ciblables en dehors de la fenêtre.

`state.bossAttacks` constitue la vérité physique et visuelle. `FEffects` dessine les mêmes rayons, ouvertures et bandes, sans remplir le trou d’un anneau. Les marqueurs de danger passent avant les effets cosmétiques. `bossRoar`, `bossTell`, `bossImpact`, `bossPhase` et `bossDeath` alimentent audio et HUD.

Le directeur utilise les sites réels de `world.horrorSites`. Son état contient pression, tension, progression, palier, prochain événement, type, âge, position et intensité. Les chocs métalliques, alarmes, coupures locales et embuscades sont déterministes. Une embuscade réoriente une escouade existante vers un bruit de site, jamais vers des coordonnées secrètes du joueur.

Une grâce initiale de dix secondes protège le voisinage du départ du premier secteur. La pression augmente avec secteur, objectifs et combat proche. Les événements conservent un intervalle borné et de courtes accalmies. `setDifficulty(0|1|2)` sélectionne Standard, Brutal ou Cauchemar ; cadence, vitesse de projectiles et dégâts changent, sans gonfler les PV ni ajouter des ennemis.

## Modèles, rendu et absence de grille parasite

Les personnages regardent localement vers −Z ; leur rotation globale vaut −yaw, cohérente avec `[sin(yaw),0,-cos(yaw)]`. Les membres sont construits entre leurs articulations et les supports suivent la vitesse réelle. La présentation utilise des ressorts amortis indépendants de la visée et de la physique. Un repère unique `FMotion.mount/place` porte toutes les pièces de l’arme. Désactiver les mouvements fixe hauteur, roulis et variation de FOV.

`FActors.build` choisit le niveau de détail selon distance, qualité et backend. Pour un géant, la distance est divisée par son échelle avant ce choix ; sa phase de marche progresse aussi moins vite. Les trois colosses ajoutent des silhouettes distinctes, un cœur et des volets mobiles. Le nombre de pièces est borné indépendamment de leur taille.

Les matériaux `surface:'object'` utilisent le grain métallique local ; seuls les bâtiments reçoivent joints et motifs architecturaux. Les normales géométriques mondiales restent utilisées pour éclairage et ombres. L’arme overlay appartient toujours aux objets. Cette séparation corrige le motif de grille sur armes et ennemis sans retirer les vraies ombres.

WebGL 2 utilise des primitives instanciées et des buffers persistants. Les objets dynamiques sont préparés une fois par image pour toutes les passes. Soleil, lampe locale et torche emploient un atlas de profondeur en Auto/Haute. Les lectures de profondeur sont explicitement `highp`, avec bias géométrique, correction du plan récepteur et filtrage PCF. Le microrelief est borné et filtré selon la taille du pixel. Le ciel, les nuages et le vent sont procéduraux.

`renderer.actorFilter` est conservatif sur l’union de la vue couleur et des volumes d’ombre. La sphère ordinaire a un rayon de 3,5 m ; celle des géants est centrée à `baseY+1.6*scale` et a un rayon `4.5*scale`. Un doute conserve l’acteur. Les arènes déclarent `longViewZones` : les volumes essentiels peuvent porter jusqu’à 100 m, sans élargir tous les détails secondaires.

La vapeur, la fumée et les explosions utilisent une passe translucide testée en profondeur. Elles ne projettent pas d’ombres opaques fantômes. La géométrie des projectiles reste dans le volume physique ; les pièges utilisent leur boîte simulée. Les budgets cosmétiques bornent la charge et ne suppriment pas une annonce dangereuse.

Une coupure d’horreur réduit temporairement les contributions de quelques vraies lampes proches de son origine, puis les rétablit en 1,2 s au plus. Elle n’ajoute pas de tache noire ni de cache géométrique. Veilleuses, torche, arme et annonces restent lisibles.

Le secours Canvas découpe les faces au plan proche, trie la profondeur, projette des ombres simplifiées sur les sols réels et masque les faces derrière les terrasses. Il n’équivaut pas à l’atlas WebGL et peut conserver des imperfections aux intersections. Les mesures Canvas ne représentent pas les performances GPU.

## Reprises atomiques et interface

Le snapshot conserve `version:1`, `aiVersion:3`, `systemsVersion:1`, `physicsVersion:1`, ainsi que `destructionVersion:1`, `bossVersion:1` et `directorVersion:1`. Il comprend terrain détruit, projectiles, portes, mécanismes, lifts, vols, boss et directeur. L’empreinte du monde détecte une configuration incompatible ; ce n’est pas une signature cryptographique.

`restore()` valide un candidat complet avant mutation. Un refus laisse la partie intacte. Une réussite conserve les références de `state` et `player`, remet les données et reconstruit les index nécessaires. Les effets purement cosmétiques ne sont pas rejoués. Le mode `{recover:true}` ajoute une protection transitoire de reprise et dissipe les projectiles immédiats dangereux.

Le shell utilise l’enveloppe `{version:2,generation:5,seed,stage,runStats,checkpoint}`. Il sauvegarde entrée, relais, commandes, arrivée de lift avec le joueur et boss abattu. Les générations incompatibles repartent à l’entrée du même secteur en conservant graine, arme et statistiques antérieures ; une sauvegarde précédente est préservée séparément lorsque le stockage le permet.

Le menu possède quatre onglets accessibles depuis l’accueil et la pause. Il applique directement FOV, résolution, luminosité, ombres, mixage et touches. Le mode options n’avance pas la simulation. Les conflits de touches sont refusés et Échap reste réservé. La difficulté courante du joueur est réappliquée après reprise sans régénérer sa santé ni créer un checkpoint gratuit.

## Audio et portée des preuves

Les MOD ont quatre canaux, signature `M.K.`, 31 emplacements dont 14 instruments synthétisés, six patterns de 64 lignes et huit positions de lecture. Les tempos sont 100 / 170 / 145 BPM. Le lecteur et l’export emploient les mêmes données. `FMusic.getModule(stage)` fonctionne sans AudioContext ; le son réel attend une interaction.

Le budget musique de 28 voix est indépendant des 48 voix d’effets. La pause annule les notes programmées et la reprise se recale sur une mesure. Moteur et vapeur utilisent des sources persistantes, avec niveau selon distance ; ils ne créent pas une voix par objet et par image. `audio.setPressure` agit sur l’ambiance, `audio.horror` produit les événements spatialisés.

Le mix final applique une courbe de protection identique à l’entrée jusqu’à 0,875, puis bornée sous pleine échelle. Les limites numériques et les décodages MOD indépendants sont testés ; cela ne constitue pas une écoute humaine.

Les contrôles de `checks/` et les mesures de `VALIDATION.md` distinguent tests unitaires, parcours physiques, commandes navigateur et pixels GLES logiciels. Ils ne prouvent ni cadence sur un Mac précis, ni compatibilité Safari, ni ressenti d’horreur, ni équilibrage humain complet. Un portage natif de type `.kkrieger` reste un chantier distinct de ce fichier web autonome.
