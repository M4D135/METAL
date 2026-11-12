# Architecture — METAL 0.6.0 — Survie

## Distribution et identité

`tools/build.py` assemble **treize modules JavaScript**, `index.html` et `style.css` dans un HTML autonome. Aucun chargement réseau de code, image, texture, modèle, police ou audio n’est nécessaire. `SIZE.json` mesure le HTML brut, son gzip reproductible et son SHA-256. Le budget est de 1 400 000 octets bruts ; navigateur, pilotes, tests et documentation sont exclus. Les mesures du build courant et les résultats de vérification sont référencés dans `SIZE.json` et `VALIDATION.md` ; ce document décrit les contrats.

Le titre public devient **METAL**. Les API `FWorld`, `FRender`, etc., le format de snapshot `FERRO`, les clés `ferro-settings` / `ferro-expedition-v2` et le dépôt GitHub historique restent inchangés pour préserver les références et les migrations.

| Module | Responsabilité |
| --- | --- |
| `world.js` | Monde déterministe, terrain, arènes, réservistes, rencontres, réserves, ateliers et métadonnées de démolition |
| `destruction.js` | Découpe, assemblages, dépendances structurelles, collisions et snapshots de terrain |
| `economy.js` | Profil strict, stats dérivées, plafonds, catalogue, devis et achats purs |
| `brain.js` | Réseau tactique procédural, exécution WebNN vérifiée et calcul CPU équivalent |
| `simulation.js` | Physique, IA, vagues, inventaire, butin, achats, projectiles, boss et validation des reprises |
| `actors.js` | Modèles articulés, poses et LOD des quatre familles et des trois colosses |
| `motion.js` | Présentation amortie, caméra et repère unique des armes |
| `effects.js` | Représentation des projectiles, explosions, vapeur, débris, pièges et attaques de boss |
| `renderer.js` | Primitives, matériaux, ombres, WebGL 2 et secours Canvas 2D |
| `music.js` | Générateur, exporteur et lecteur de modules ProTracker |
| `audio.js` | Contexte audio, effets, ambiances, pression, mixage et protection de crête |
| `options.js` | Préférences bornées, difficulté, touches et conflits |
| `game.js` | Entrées, boucle, menus, HUD, montage des systèmes et sauvegardes navigateur |

## Monde et circulation

La **génération 6** conserve les territoires agrandis de la génération 5, leurs terrasses, systèmes, tremplins, substrat et arènes. Elle ajoute ateliers, caches de ravitaillement et baies de renforts dotées de couverts physiques. Les graphes possèdent des boucles et des rampes alternatives aux ascenseurs. Les positions de ravitaillement évitent obstacles, pièges, jets de vapeur, commandes et points d’arrivée.

La génération reste déterministe pour une graine et un secteur. Les nombres de meshes/colliders dépendent de cette génération et ne reprennent pas les métriques de la version précédente. Un nombre de descriptions statiques ne mesure ni les pièces effectivement dessinées ni la durée d’un parcours.

Le terrain combine plans plats et rampes `{x,z,w,d,y,slopeX,slopeZ}`. La hauteur vaut `y+(px-x)*slopeX+(pz-z)*slopeZ`. Les sols de salle sont prioritaires dans les petits recouvrements de raccord ; le **substrat `fallback:true,substrate:true` n’intervient qu’en l’absence de sol local**, afin de ne jamais aplatir une rampe. Ce terrain inférieur visible est à −0,25 m. Les sols et rampes sont portants et ne sont pas excavés par la destruction.

`player.y` et `enemy.baseY` désignent les pieds. `enemy.y` désigne le centre de visée historique, adapté à l’échelle des géants. Les meshes de sols portent `ground:true`. Les surfaces inclinées visuelles et physiques coïncident. Les gros troncs, rochers, parois, portes et équipements possèdent des collisions ; les détails fins restent décoratifs.

Chaque secteur possède trois commandes, trois portes, deux ascenseurs, trois tremplins, trois relais, quatre conduites, trois pièges et trois ateliers. Un boss et six renforts de boss sont compris dans les totaux de 120 / 140 / 170 identités. La majeure partie de la garnison attend en réserve, sans présence physique. Huit lourds par secteur utilisent un lance-grenades, six un lance-roquettes ; ils sont placés dans les vagues ultérieures.

Les arènes font 60 × 60 m, avec un rayon de combat de 28 m et une passerelle d’accès de 13 m. Les frontons monumentaux restent au-delà de 27 m du centre. Leur géométrie est destructible et leurs linteaux possèdent de vrais supports. Le centre est dégagé ; les couverts restent périphériques.

## Systèmes et physique

`nearestInteraction()` choisit une action à moins de 2,6 m, au bon palier et sans obstruction. F ou l’action tactile déclenche `input.interact` au premier sous-pas seulement. Les commandes alimentent les systèmes par `requires` ; une console détruite active son circuit pour éviter un verrouillage de mission. Une porte détruite cesse de bloquer immédiatement.

Une porte mobile utilise le même `progress` pour son battant visuel et physique. Les lifts exposent `y`, `target`, `powered`, `moving` et `carrying`. Les passagers restent posés sur leur plateau, avec vérification des murs et de l’espace au-dessus de la tête. `liftStop.carrying` distingue l’arrivée du joueur d’un rappel à vide.

Les tremplins exposent `{id,x,y,z,r,target:{x,y,z},flightTime,yaw}`. Le contact calcule une impulsion depuis la position réelle, avec gravité de 12 m/s², sans recentrer ni téléporter l’acteur. Les champs `airborne`, `airVX/Y/Z`, `airTime`, `padCooldown` et `padId` sont sauvegardés. Les plafonds, murs et atterrissages sont physiques ; le cooldown empêche une relance involontaire au même contact.

Le shell conserve au plus 0,12 s de temps écoulé par image, divisée en sous-pas d’au plus 1/60 s. Les entrées ponctuelles sont consommées une seule fois ; les tirs et déplacements tenus continuent. Une suspension plus longue ne déclenche pas un rattrapage illimité. Les déplacements sont eux-mêmes subdivisés pour ne pas franchir une paroi mince.

Le profil de mouvement Survie utilise marche 5,4, course 7,6, accélération 30, freinage 42, inversion 50, impulsion d’esquive 15,2 et contrôle aérien 2,2, dans les unités du moteur. L’esquive dure 0,2 s et se recharge en 1,7 s. L’intégration amortie et le découpage aux collisions restent actifs ; les vitesses plus élevées ne sont pas des téléportations. Il n’existe pas d’entrée de saut libre.

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

### Buses de vapeur

Une conduite décrit sa direction normalisée, sa longueur, son rayon et son assemblage destructible. `nozzle` désigne le cap matériel de la buse, à 0,46 m du centre du manifold dans cette direction ; son cylindre rejoint réellement l’assemblage. Rendu du jet, vérification du couvert et dégâts utilisent cette même origine, au lieu de faire partir la vapeur du centre d’un bloc.

`pipeAnchored()` vérifie le support avec le contrôleur de destruction, jusqu’au solide situé juste derrière le cap. La disparition de la buse, même si une autre pièce du groupe existe encore, marque la conduite `broken`. `stopLeak()` remet `active`, `warning` et `hot` à false et annule le temps restant. Aucun jet, dommage ou souffle continu ne doit survivre à cette coupure. Les snapshots refusent une conduite cassée encore chaude/active.

## Armes, inventaire, projectiles et dommages

Les noms publics sont **Mitraillette / Double pompe / Lance-roquettes / Lance-grenades**, dans l’ordre des touches 1–4. Impulse, Fracture et Rupture restent les noms historiques des trois premières armes. La campagne déclare `world.progression.version===1` et `weaponSlots:4` ; l’inventaire est `{weapons:[bool×4],ammo:[int×4],shield:boolean}`. La mitraillette doit être possédée. Les quantités sont des entiers positifs ou nuls, bornés par les plafonds du profil. Les petits mondes de test historiques peuvent conserver trois armes.

La nouvelle expédition commence avec `[true,false,false,false]`, `[48,0,0,0]` et aucun bouclier possédé. Le double pompe et le bouclier se trouvent dans les premières zones ; le lance-grenades apparaît dans la zone de l’atelier intermédiaire et le lance-roquettes plus loin sur les parcours. Les racks déjà connus ne fournissent que leur réserve restante. `pickups[].remaining` conserve le surplus lorsque le plafond est atteint. Proximité, hauteur et ligne dégagée empêchent de récupérer à travers un mur ou un palier.

Le double pompe consomme deux cartouches pour quatorze rayons, ou une seule pour sept rayons lorsque le stock restant vaut un. Les autres armes consomment une unité par départ. Une arme non possédée ne peut pas être sélectionnée. Une arme vide émet `empty` avec cadence bornée puis tente `melee()`, sans créer un projectile ou de chaleur. La crosse, liée à **V** par défaut, a une portée de 1,8 m, une cadence de 0,72 s et des dégâts de base de 0,9 ; elle conserve les tests de couvert. Elle fournit une solution de proximité pour récupérer des munitions, pas un tir gratuit à distance.

`state.weapon` désigne la main droite et correspond à `state.equipment.right`. La main gauche vaut `null`, un autre identifiant d’arme possédée ou `'shield'`. Deux mains ne peuvent pas dupliquer la même arme. `selectWeapon`, `selectLeftWeapon` et `fireLeft` passent par cette validation. Chaque arme conserve son délai dans `weaponWait` ; chaleur et surchauffe restent communes. Changer de main ou d’arme ne supprime pas ces contraintes. Les deux bouches convergent vers la cible de la visée centrale après un balayage physique entre l’œil et la bouche ; un canon bloqué ne permet pas de tirer derrière le couvert.

Les roquettes sortent à 24 unités/s. Les grenades sortent à 13 unités/s avec une composante verticale supplémentaire de 3,5 lorsque la bouche est dégagée ; leur fusée vaut 1,8 s. Le double pompe adapte cadence et chaleur au nombre de cartouches réellement tirées. Le lance-grenades a un délai de 0,95 s. Les modèles et événements contiennent `hand`, sans ajouter une réserve de munitions par main.

Le bouclier s’équipe automatiquement à gauche à sa première acquisition. Son état est `{energy,raised,rechargeDelay,bashCooldown,bashVisual}`. Une garde valide utilise le yaw et le pitch et exige une direction source avec produit scalaire supérieur à 0,55. Elle absorbe jusqu’à 80 % du dégât direct ou 55 % d’un souffle, à raison de 1,5 énergie par point absorbé. Le coût continu de garde vaut 2,5 énergie/s ; la recharge vaut 18/s lorsqu’il est baissé et que son délai est écoulé. Un blocage ou une frappe impose 2,2 s de délai. Sans source bloquable, notamment pour les dangers de contact, il n’y a pas d’immunité cachée.

Quand le bouclier est équipé, Espace déclenche une frappe plutôt que l’esquive. Elle consomme 24 énergie, respecte un délai de 1,1 s et touche au plus trois cibles proches, dans un cône frontal et sans traverser les murs. Les machines ordinaires peuvent être repoussées et étourdies ; les géants ne sont pas déplacés. Changement d’équipement et achats ne rechargent pas l’énergie. Les événements sont `grenadeLaunch`, `shieldRaise`, `shieldBlock` et `shieldBash` ; `shieldBlock` indique aussi `broken`.

L’onde a un rayon de 6,5 m, une recharge de sept secondes et respecte le couvert. En Survie, elle inflige seulement 0,25 dégât de base aux machines ordinaires et aucun au colosse ; repoussement, étourdissement, dissipation de balles et refroidissement restent son rôle. Le chemin historique des mondes de test sans `progression` conserve ses anciens contrats ; le monde généré actuel active le chemin Survie.

La bouche nominale est à `eye + right*(±.255) + up*(-.23) + forward*1.228`, avec le signe de la main. Le trajet œil → bouche est vérifié avant le lancement ; la roquette vise ensuite l’intersection du viseur. Trop proche, un impact non armé produit un choc local de terrain et `rocketDud`, sans explosion créée derrière le mur.

Les roquettes et grenades balaient leur rayon physique sur tout leur déplacement. Les grenades suivent une parabole, rebondissent et possèdent un délai d’explosion. Les spécialistes préparent leur attaque à partir d’une observation, contrôlent la trajectoire et refusent une zone cible occupée par leur groupe.

Le souffle évalue le couvert **avant** de démolir la scène. Il ne profite donc pas rétroactivement de sa propre brèche pour traverser une protection. `state.projectiles`, `explosions` et `debris` sont distincts des anciennes balles et particules. `age` avance tandis que `life` garde la durée totale des effets. Les explosions portent `{id,kind,owner,x,y,z,age,life,radius,power,seed}` ; `kind` vaut `rocket`, `grenade`, `steam`, `boss` ou `blast`. Le feu, la fumée, les ondes et les lobes de mort du colosse restent des effets de cette décision physique, sans redéclencher le souffle de dégâts.

## Rencontres et réservistes

`world.encounters` décrit des déclencheurs, une zone d’activité, des entrées cachées et des vagues de `enemyIds` stables. `world.progression.maxActive` fixe le budget global des combattants ordinaires à 8 / 10 / 12 selon le secteur. Les premières patrouilles comptent trois machines au premier secteur, quatre ensuite ; les vagues suivantes ne dépassent pas six. Le colosse est exclu du plafond ordinaire, ses renforts libérés y participent.

`deployed:false` retire réellement le réserviste du rendu, des collisions d’acteur, de la perception et des dégâts. Il ne s’agit pas de rendre invisible une machine encore capable de bloquer ou tirer. Les patrouilles d’ouverture et les gardes préplacés du boss conservent leur présence ; leur autorisation de combattre reste distincte.

Chaque rencontre parcourt `dormant → warning → waiting → active → cleared`. La première annonce attend 1,4 s ; les suivantes utilisent l’intervalle de quatre secondes du monde. La prochaine vague n’est annoncée qu’après élimination de la précédente, lorsque le joueur est encore dans la zone concernée.

`safeEntry()` exige un sol cohérent, de l’espace pour le corps, une distance d’au moins 10 m au joueur et un couvert sur plusieurs points de la silhouette. Cette condition ne dépend pas de la direction de sa caméra. Un canon lourd doit lui aussi disposer d’un placement valide. Une entrée devenue visible après démolition ne reçoit pas de nouvelle machine. Sans entrée sûre ou sans budget, le groupe reste en attente.

Les sondes d’entrée sont bornées : huit essais au plus par mise à jour espacée de 0,2 s, et un nouveau corps déployé au plus lors de ce passage. Les rencontres partagent leur budget ; une course à travers plusieurs déclencheurs ne doit pas empiler toutes les vagues. Les corps déployés restent physiques même lorsqu’ils perdent le budget de combat. Les acteurs désengagés regagnent leur poste par navigation, sans disparition ou retour par téléportation.

`aiStats` distingue `reserve`, `combat`, `combatCap`, `awake` et `dormant`. `remaining` et `active` sont recalculés depuis les identités des vagues. Une zone devient sécurisée quand sa garnison est neutralisée. Les objectifs de sortie restent trois relais, les commandes requises et le boss : les réservistes d’une rencontre optionnelle bloquée ne verrouillent pas la mission.

## Économie et ateliers

`FEconomy` est un module pur, chargé avant la simulation. Il ne possède ni stockage, ni horloge, ni accès au monde. Son profil est `{credits,cores,upgrades:{vitality,armor,capacity,power,cooling}}`. Les devis et achats prennent `{profile,inventory,hp}`.

```js
FEconomy.fresh()
FEconomy.validate(profile)
FEconomy.copy(profile)             // copie profonde, null si invalide
FEconomy.stats(profile)
FEconomy.ammoCaps(profile)
FEconomy.catalog()
FEconomy.quote(state, itemId)
FEconomy.transact(state, itemId)    // même devis + state copié
```

Un devis expose `{ok,reason,message,item,cost:{credits,cores},amount,rank,nextRank}`. Le catalogue fournit les labels/descriptions à l’interface ; le shell ne recalcule pas les prix. Chaque transaction refait son devis sur l’état actuel, puis applique l’opération à une copie. Un échec conserve un état copié identique, ou `null` si l’entrée était invalide. Aucun prélèvement partiel n’est appliqué.

Les crédits et noyaux sont des entiers bornés ; chaque rang appartient à 0–3. Les objets, tableaux d’inventaire, booléens de possession et quantités sont validés strictement. Le format courant possède quatre stocks et le booléen de bouclier ; le catalogue sait refuser ses offres supplémentaires aux inventaires historiques de trois armes. `stats()` et `ammoCaps()` renvoient `null` pour un profil invalide.

| Statistique | Formule |
| --- | --- |
| Santé maximale | `100 + 20*vitality` |
| Dégâts infligés | `1 + .10*power` |
| Dégâts reçus | `1 - .08*armor` |
| Vitesse de refroidissement | `1 + .20*cooling` |
| Réserves | `floor([180,36,12,16] * (1 + .25*capacity))`, élément par élément |

Les 14 offres sont `repair`, `ammo0..3`, `weapon1..3`, `shield`, puis les cinq noms d’amélioration. Réparation de 25 PV : 24 crédits ; packs de 24 balles / 6 cartouches / 2 roquettes / 4 grenades : 18 / 24 / 36 / 36 crédits. Double pompe, lance-roquettes et lance-grenades coûtent 150 / 260 / 220 crédits avec un bonus unique de 6 cartouches / 2 roquettes / 4 grenades, borné aux plafonds. Le bouclier coûte 180 crédits. Le rachat d’un équipement possédé est refusé ; une transaction de bouclier ne touche pas son énergie.

Les premiers rangs coûtent 90 / 120 / 100 / 140 / 110 crédits pour vitalité, blindage, réserves, puissance et refroidissement. Les rangs suivants valent `ceil(prixInitial * 1.6)` puis `ceil(prixInitial * 2.3)` et consomment chacun un noyau. Augmenter un plafond ne remplit ni la santé ni les munitions. Réparation et packs partiels coûtent `ceil(prixPack * quantitéReçue / quantitéPack)`, au minimum un crédit pour un achat réussi. Réserves pleines, armes verrouillées pour un pack dédié, rang maximal et fonds insuffisants sont des refus explicites.

La simulation possède `state.economy`, les stats dérivées et les plafonds courants. `shopOffers(id)` et `buy(id,itemId)` exigent un atelier proche à 2,6 m au plus, au bon palier, visible et accessible. Le shell ouvre le mode `shop`, qui suspend les pas de simulation. Un achat validé met à jour ensemble profil, inventaire, santé et stats, puis le shell enregistre un checkpoint.

Les machines ordinaires donnent 6 / 12 / 8 crédits selon leur famille, avec les munitions définies par leur drop. Un colosse donne 160 crédits, un noyau et `[24,6,2,3]` munitions. `state.loot` conserve la position au sol, `sourceEnemy`, le contenu restant et `taken`. Un seul butin est autorisé par ennemi mort ; celui d’un géant est placé vers un pied accessible. Les crédits/noyaux peuvent être récupérés alors que des munitions restent au sol faute de place.

`exportLoadout()` retourne une copie de `{inventory,economy,equipment:{right,left,shieldEnergy}}`. Le secteur suivant reçoit cette copie exacte, sans utiliser ses stocks de démarrage par défaut à la place d’un inventaire transmis. Les améliorations, monnaies, armes sélectionnées et énergie du bouclier survivent à ce passage ; les valeurs par défaut des secteurs ultérieurs servent seulement à une entrée sans équipement transmis, notamment après migration incompatible. La santé courante appartient au snapshot ; le portage d’équipement entre secteurs n’est pas un portage de blessure.

## IA et charge de calcul

Les ennemis alternent patrouille, investigation, engagement et recherche. Vue, son, mémoire, observation verticale et partage local déterminent ce qu’ils savent. Un joueur caché ne transmet pas sa position actuelle. Flanc, couverture, suppression et visée prédictive utilisent cette information observée.

Les machines mobiles se séparent physiquement. Les tripodes se repositionnent. Les esquives ont un délai de réaction et ne retirent pas un dégât déjà résolu. Certaines machines prennent un tremplin si son arrivée rapproche de leur dernier contact mémorisé. Les principes de Quake III ont été consultés dans le dépôt officiel ; aucun code GPL n’a été repris.

Les routes A* utilisent une grille de 0,8 m, un budget de deux recherches par sous-pas, des passages testés avec le volume de l’acteur et un cache de segments. Un index de voisins évite une comparaison quadratique de toute la population. Les acteurs déjà déployés peuvent dormir sans perdre leur identité, leur corps ou leurs PV. Ce sommeil est distinct des réservistes encore absents et du plafond d’autorisation de combat.

La démolition invalide les passages concernés. **Le champ global BFS `nav.dist` n’est plus calculé automatiquement pour les mondes avancés** : l’IA emploie ses routes locales. Une lecture explicite de l’API historique le reconstruit à la demande. Cela retire un gel important après portes et brèches, sans changer la décision de parcours.

`FBrain` apporte un réseau tactique procédural `16 → 20 ReLU → 8`, avec lots de 16 acteurs au plus. Les poids sont des coefficients définis dans le code, sans entraînement ou modèle importé. Les entrées décrivent l’état propre de l’acteur, son rôle, les alliés observables et le dernier contact autorisé ; elles ne révèlent pas un joueur caché. Les sorties évaluent approche, flanc, retraite, maintien et les quatre familles d’attaque de boss.

`prepare()` essaie WebNN en mode Auto et n’adopte ce chemin que si le contexte annonce `accelerated:true` et si une vraie exécution numérique correspond au calcul CPU. L’interface indique alors **WebNN accéléré, type GPU/NPU non exposé**. Le matériel exact n’est pas déduit d’un simple paramètre de préférence. API absente, contexte perdu, délai dépassé, résultat invalide ou mode CPU demandé entraînent le calcul local équivalent. Les tenseurs et le graphe sont conservés jusqu’au changement de mode ou à la destruction du contrôleur.

La simulation soumet un lot au plus toutes les 0,25 s et n’attend pas une promesse d’inférence dans son pas physique. Elle écarte une réponse devenue obsolète après reprise, démolition, changement de contexte ou évolution significative de l’acteur et de son observation. Les scores conseillent les décisions existantes ; les tests de couvert, volumes, annonce des attaques et délais restent obligatoires. Ce calcul ne remplace ni le moteur physique ni l’ensemble de l’IA par une accélération matérielle garantie.

## Colosses et directeur de tension

Les boss possèdent `bossScale` 5,4 / 7,2 / 9, `bossKind`, `bossName` et `arena`. Les états sauvegardés comprennent `bossAwake`, `phase` 0–2, `bossClock`, `bossStep`, `attackLabel`, `weakPointOpen` et `weakTimer`. Les renforts restent des acteurs préplacés, libérés par phase.

Les seuils de phase sont 67 % et 34 % des PV. L’entrée dans l’arène déclenche l’éveil ; un boss n’attaque pas à travers le territoire avant activation. Les scripts emploient disques d’écrasement, anneaux creux, capsules de balayage et barrages de vraies roquettes. La cible d’une attaque annoncée est engagée à partir du dernier contact observé.

Le cœur local est **`[0,1.93,-.90]*bossScale`**, rayon **`.36*bossScale`**. Il ressort devant le plastron et reste enregistré sur le torse, indépendamment de la marche. La fenêtre après récupération dure 3 / 2,7 / 2,4 s selon phase. Les dégâts au cœur ouvert sont multipliés par 3,2 ; les autres impacts subissent le facteur d’armure de 0,30. Torse, casque et jambes restent ciblables en dehors de la fenêtre.

`state.bossAttacks` constitue la vérité physique et visuelle. `FEffects` dessine les mêmes rayons, ouvertures et bandes, sans remplir le trou d’un anneau. Les marqueurs de danger passent avant les effets cosmétiques. `bossRoar`, `bossTell`, `bossImpact`, `bossPhase` et `bossDeath` alimentent audio et HUD.

Le directeur utilise les sites réels de `world.horrorSites`. Son état contient pression, tension, progression, palier, prochain événement, type, âge, position et intensité. Les chocs métalliques, alarmes, coupures locales et embuscades sont déterministes. Une embuscade réoriente une escouade existante vers un bruit de site, jamais vers des coordonnées secrètes du joueur.

Une grâce initiale de dix secondes protège le voisinage du départ du premier secteur. La pression augmente avec secteur, objectifs et combat proche. Les événements conservent un intervalle borné et de courtes accalmies. `setDifficulty(0|1|2)` sélectionne Standard, Brutal ou Cauchemar ; cadence, vitesse de projectiles et dégâts changent. La sélection ne remplit ni les PV, ni les munitions, ni le bouclier, et ne recrée pas de vague ou de butin.

## Modèles, rendu et absence de grille parasite

Les personnages regardent localement vers −Z ; leur rotation globale vaut −yaw, cohérente avec `[sin(yaw),0,-cos(yaw)]`. Les membres sont construits entre leurs articulations et les supports suivent la vitesse réelle. La présentation utilise des ressorts amortis indépendants de la visée et de la physique. Un repère unique `FMotion.mount/place` porte toutes les pièces de l’arme. Désactiver les mouvements fixe hauteur, roulis et variation de FOV.

`FActors.build` choisit le niveau de détail selon distance, qualité et backend. Pour un géant, la distance est divisée par son échelle avant ce choix ; sa phase de marche progresse aussi moins vite. Les trois colosses ajoutent des silhouettes distinctes, un cœur et des volets mobiles. Le nombre de pièces est borné indépendamment de leur taille.

Les matériaux `surface:'object'` utilisent le grain métallique local ; seuls les bâtiments reçoivent joints et motifs architecturaux. Les normales géométriques mondiales restent utilisées pour éclairage et ombres. L’arme overlay appartient toujours aux objets. Cette séparation corrige le motif de grille sur armes et ennemis sans retirer les vraies ombres.

WebGL 2 utilise des primitives instanciées et des buffers persistants. Les objets dynamiques sont préparés une fois par image pour toutes les passes. Soleil, lampe locale et torche emploient un atlas de profondeur en Auto/Haute. Les lectures de profondeur sont explicitement `highp`, avec bias géométrique, correction du plan récepteur et filtrage PCF. Le microrelief est borné et filtré selon la taille du pixel. Le ciel, les nuages et le vent sont procéduraux.

Les reflets métalliques utilisent une réponse de microfacettes, un Fresnel de Schlick et la rugosité du matériau. Une réflexion analytique reprend les couleurs du ciel, du sol et d’un plafond intérieur diffus ; aucun miroir de scène, ray tracing ou capture cubique complète n’est revendiqué. Le grain, les rayures et le microrelief continuent d’utiliser le repère local des objets. Les matériaux d’écorce ajoutent fibres, crevasses et nœuds ; les feuilles reçoivent une variation de bouquets et de nervures filtrée avec la distance.

`polishTrees()` réutilise les descriptions existantes de chaque arbre pour ses troncs articulés, fourches et couronnes. Il ne déplace ni les colliders des troncs ni les emplacements de jeu et n’ajoute aucun mesh par arbre. La primitive `foliage` possède 72 triangles fermés, dans la boîte locale `[-.5,.5]^3`. GPU, Canvas et raycasts de destruction utilisent la même définition ; Canvas fusionne seulement les paires coplanaires pour réduire les commandes de dessin. `FRender.foliageTriangles()` expose un tableau immuable sans créer de contexte graphique. Le module renderer est donc défini avant toute création de destruction d’un monde arboré.

`FEffects.lights(state)` fournit au plus quatre sources cosmétiques aux positions réelles. `renderer.draw(...,{lights})` en retient au plus trois en WebGL, deux en Canvas, avec des budgets réduits en Basse. Le total WebGL reste limité à douze lumières, six en Basse. Chaque source transitoire possède une portée et une extinction douce. Elle éclaire aussi les surfaces Canvas déjà en cache ; elle ne réattribue pas les slots des cartes d’ombres et ne déclenche pas de reconstruction de géométrie. Ces sources supplémentaires n’ont pas leur propre passe d’ombre. Le flash uniforme du tir reste séparé d’une explosion à distance.

`renderer.actorFilter` est conservatif sur l’union de la vue couleur et des volumes d’ombre. La sphère ordinaire a un rayon de 3,5 m ; celle des géants est centrée à `baseY+1.6*scale` et a un rayon `4.5*scale`. Un doute conserve l’acteur. Les arènes déclarent `longViewZones` : les volumes essentiels peuvent porter jusqu’à 100 m, sans élargir tous les détails secondaires.

La vapeur, la fumée et les explosions utilisent une passe translucide testée en profondeur. Elles ne projettent pas d’ombres opaques fantômes. Les bouffées `fxFire:true` reçoivent une turbulence advectée, des températures rouge/orange/jaune et des bords doux dans cette même passe. Les marqueurs de danger gardent leur opacité lisible aux angles rasants. La géométrie des projectiles reste dans le volume physique ; les pièges utilisent leur boîte simulée. Les budgets cosmétiques bornent la charge et ne suppriment pas une annonce dangereuse.

Les maillages `overlay:true,fx:true` du bouclier sont séparés des pièces opaques des mains. Après la scène et ses particules, la profondeur est effacée pour les armes opaques ; le panneau du bouclier est ensuite mélangé en transparence contre cette profondeur des mains. Il ne devient pas une plaque opaque et ne participe à aucun atlas d’ombres. Les faces overlay du secours Canvas conservent elles aussi leur alpha.

Une coupure d’horreur réduit temporairement les contributions de quelques vraies lampes proches de son origine, puis les rétablit en 1,2 s au plus. Elle n’ajoute pas de tache noire ni de cache géométrique. Veilleuses, torche, arme et annonces restent lisibles.

Le secours Canvas découpe les faces au plan proche, trie la profondeur, projette des ombres simplifiées sur les sols réels et masque les faces derrière les terrasses. Il n’équivaut pas à l’atlas WebGL et peut conserver des imperfections aux intersections. Les mesures Canvas ne représentent pas les performances GPU.

## Reprises atomiques et interface

Le snapshot conserve `version:1`, `aiVersion:3`, `systemsVersion:1`, `physicsVersion:1`, `destructionVersion:1`, `bossVersion:1` et `directorVersion:1`. La campagne ajoute `progressionVersion:1`, `economyVersion:1` et `arsenalVersion:1`. Il comprend terrain détruit, projectiles, portes, mécanismes, lifts, vols, boss, directeur, réservistes, rencontres, stocks restants, inventaire, profil, butin, mains équipées et énergie/délais du bouclier. L’empreinte inclut les paramètres de progression, rencontres et ateliers pour détecter une configuration incompatible ; ce n’est pas une signature cryptographique.

`restore()` valide un candidat complet avant mutation, notamment le profil avant les plafonds dérivés et les stocks. Un refus laisse la partie intacte. Une réussite conserve les références de `state` et `player`, remet les données et reconstruit les index nécessaires. Les effets purement cosmétiques ne sont pas rejoués. Le mode `{recover:true}` ajoute une protection transitoire de reprise et dissipe les projectiles immédiats dangereux ; il ne remplit ni santé, ni munitions, ni bouclier. Les réponses tactiques asynchrones antérieures sont invalidées.

Le shell utilise l’enveloppe `{version:2,generation:6,seed,stage,runStats,entryLoadout,checkpoint}`. Il sauvegarde entrée, relais, commandes, arrivée de lift avec le joueur, arme ou bouclier récupéré, rencontre sécurisée, boss abattu, butin de boss et achat validé. `entryLoadout` conserve l’équipement exact reçu au début du secteur ; le redémarrage volontaire le restaure. Les générations incompatibles repartent à l’entrée du même secteur avec ses stocks de départ par défaut, en conservant graine et statistiques antérieures ; elles ne promettent pas de convertir un ancien inventaire. Une sauvegarde précédente est préservée séparément lorsque le stockage le permet.

Le menu possède quatre onglets accessibles depuis l’accueil et la pause. Il applique directement FOV, résolution, luminosité, ombres, mixage, mode tactique Auto/CPU et touches. Options et atelier n’avancent pas la simulation. Les conflits de touches sont refusés et Échap reste réservé. La difficulté courante est réappliquée après reprise sans régénérer les ressources ni créer un checkpoint gratuit. Le HUD distingue quatre armes, stock/plafond, main gauche, garde/énergie, vague, santé maximale, blindage, monnaie et noyaux. Clic gauche/Entrée commandent la droite, clic droit/C la gauche, X le changement gauche, 1–4 la droite, V la crosse et Espace l’esquive ou la frappe de bouclier selon l’équipement.

La préparation commence par le déverrouillage audio lié au geste utilisateur, puis laisse peindre l’écran de chargement. Le shell attend `FMusic.warmup(stage)`, la préparation tactique et `audio.prepare(stage)` avant la partie. Le cache de descriptions de monde est limité à deux secteurs ; l’écran de fin peut anticiper le suivant. Les banques audio préparées sont conservées, sans changer le morceau actif. Cette organisation déplace des travaux de première utilisation hors du combat ; elle n’est pas une garantie de durée d’image.

## Audio et portée des preuves

Les MOD ont quatre canaux, signature `M.K.`, 31 emplacements dont 15 instruments synthétisés, six patterns de 64 lignes et huit positions de lecture, soit 32 mesures. **Fer noir** est à 100 BPM, boucle de 76,8 s : power chords graves en Ré, palm-mutes, arrêts et rupture doom. **Fracture** est à 170 BPM, 45,2 s : attaques chromatiques syncopées, doubles grosses caisses, rupture et montée. **Veille des cendres** est à 145 BPM, environ 53 s : galop en Mi, mode phrygien, tierces diatoniques et réponses mélodiques. Les passages de lead alternent avec la guitare rythmique et les silences ; ils ne forment pas un arpège permanent.

Les cordes synthétiques mélangent harmoniques, désaccords modérés, attaque bruitée, distorsion et filtrage de corps/cabinet. Les harmonies majeures ou mineures respectent le mode du troisième morceau. Les instruments de batterie composés permettent de conserver quatre canaux tout en superposant grosse caisse, caisse claire et cymbales. Le lecteur et l’export emploient les mêmes octets, périodes de notes et PCM signés huit bits ; aucun enregistrement n’est importé.

`FMusic.getTrack(stage)` fournit titre, tempo, style, durée et canaux. `getModule(stage)` produit un vrai MOD sans AudioContext. `warmup(stage)` partage une file asynchrone de synthèse, en cédant entre instruments sans ouvrir de périphérique. `FMusic.create(ctx,output)` n’effectue pas la synthèse complète à la construction. `audio.prepare(stage)` réutilise le contexte déjà déverrouillé et prépare les AudioBuffers sans démarrer, chercher ou remplacer le morceau. Trois banques au plus sont réutilisées ; le premier tir ne doit pas les reconstruire.

Le budget musique de 28 voix est indépendant des effets. Ceux-ci réservent au plus 32 voix aux attaquants distants, 40 aux interactions normales et 48 avec les voix prioritaires du joueur et des alertes proches. Une voix urgente peut remplacer une voix moins prioritaire. La pause annule les notes programmées et la reprise se recale sur une mesure ; le rattrapage du séquenceur est borné. Moteur et vapeur utilisent des sources persistantes avec niveau selon la distance et l’état réel des machines ; ils ne créent pas une voix par objet et par image. `audio.setPressure` agit sur l’ambiance, `audio.horror` produit les événements spatialisés.

Les bus musique, effets et ambiances sont indépendants. Avant le volume utilisateur, les gains sont 0,56 pour le bus musique et 0,9 pour chacun des deux autres ; le master vaut `0,65*volumeGénéral`. Les impacts prioritaires réduisent brièvement la musique, proportionnellement à leur niveau, sans relever les curseurs des effets ou de l’ambiance. `testMix({muted})` joue les vrais bus pendant deux secondes, respecte le mute utilisateur et les quatre volumes, et possède son minuteur annulable et une extinction sur l’horloge audio. `cancelTestMix()` est appelé à la sortie ou au changement d’onglet. Le retour au mix recommandé reste une action explicite.

Une explosion utilise sept composants au plus : attaque bruitée, grave sinusoïdal, corps filtré, résonance, fragments et queue de souffle métallique. Distance, rayon, puissance et type modulent son niveau, sa durée et son timbre ; les explosions restent dans le budget normal, pour réserver les voix du joueur. Les cooldowns sonores de tir sont séparés par main. `grenadeLaunch`, `shieldRaise`, `shieldBlock` et `shieldBash` distinguent départ sourd, engagement de garde, impact/rupture et frappe ; aucune nouvelle banque musicale n’est créée pour ces actions.

Le mix final passe par le compresseur puis une courbe de protection identique à l’entrée jusqu’à 0,875, bornée ensuite sous pleine échelle. Les limites numériques, ressources, programmations et décodages MOD indépendants sont testés ; cela ne constitue pas une écoute humaine. Les mesures diagnostiques de mélange reconstruit ne sont pas présentées comme un rendu natif du mix Web Audio complet.

Les contrôles de `checks/` et les mesures de `VALIDATION.md` distinguent tests unitaires, parcours physiques, commandes navigateur et pixels GLES logiciels. Ils ne prouvent ni cadence sur un Mac précis, ni compatibilité Safari, ni ressenti d’horreur, ni équilibrage humain complet. Un portage natif de type `.kkrieger` reste un chantier distinct de ce fichier web autonome.
