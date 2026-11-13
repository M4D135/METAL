# Architecture — METAL 0.8.1 — Furie d’acier

## Musique d’accueil 0.8.1

`FMusic` accepte la clé symbolique `title` pour le morceau original « Furie d’acier », en plus des indices historiques `0..2`. Le morceau possède 8 patterns, 12 séquences de 4 mesures, 17 instruments synthétisés et un tempo de 212 BPM. Les identifiants des caches distinguent le titre des trois mondes ; les anciennes compositions restent identiques octet par octet.

`FAudio.prepareTitle()` ne prépare que cette musique, sans ouvrir le périphérique ni charger la banque d’effets. `start()`/`resume()` s’exécutent dans le geste utilisateur, puis `setTitlePlaying()` active le tracker sans mettre `playing` à vrai. L’index environnemental `stage` reste numérique : le vent, les moteurs et la vapeur ne suivent jamais la clé du morceau. Les effets de jeu sont inhibés pendant le titre, sauf pendant une audition explicite des réglages. Le lancement d’une partie restaure sa musique et coupe celle du titre.

Le shell distingue menu/options de l’accueil, chargement et partie/pause. Il invalide les préparations de titre devenues obsolètes après navigation, mute ou perte de visibilité/focus ; une promesse terminée tardivement ne peut donc pas relancer la musique pendant une partie. Le titre respecte les préférences master/musique, les auditions existantes et l’export MOD du contexte courant. Aucune donnée de campagne ni sauvegarde n’est modifiée par un geste musical.

## Évolution 0.8 — progression, espaces ouverts, gravats et acoustique

La variation `campaignVersion:2` est sélectionnée pour toute nouvelle expédition. Les chemins historiques restent générables pour les sauvegardes v1. Le cache du shell inclut la variation ; l’enveloppe sauvegardée ajoute `campaignRevision:2`. Les sections historiques de progression plus bas décrivent la variation v1 lorsque leurs règles diffèrent de celles-ci.

`FEconomy` calcule les récompenses déterministes de boss et les calibrages propres à chaque arme. `FSimulation` crée leur caisse au sol, applique la récompense à portée, conserve le journal des boss déjà récompensés et exige la prise du lot principal avant la sortie. Les munitions/plaques restant dans le lot sont indépendantes de ce journal. Le chargement contrôle les invariants avant de modifier la simulation. Six mondes complètent les armes ; douze autres poursuivent l’assaut avec des améliorations et une pression accrue.

`reinforcementBays` n’ajoute plus de panneaux, cadres, marques ou colliders en v2. Ses entrées utilisent les coins de pièces voisines et les virages des couloirs praticables ; `safeEntry` garde la vérification réelle de toute la silhouette et de la distance. Le runtime vérifie un chemin de navigation avant le déploiement. L’absence d’entrée cachée reporte un renfort. Les routes et chaque candidat sont vérifiés par le parcours capsule tenant compte des portes et des paliers.

Les réservistes inactifs gardent leur emplacement d’origine. Les rencontres `naturalEntries` étendent leur rayon de retour aux candidats retenus et donnent aux arrivants un trajet vers le centre de rencontre connu. Le délai `entryGrace`, borné à 60 secondes et calculé depuis la distance, évite un retour prématuré pendant l’approche. Ces arrivants comptent dans le plafond de combat même au-delà de la distance ordinaire de sélection. Les snapshots v2 avec `reinforcementVersion:1` conservent le délai et le chemin ; les anciens snapshots restent acceptés sans ce nouveau champ. Aucune position cachée du joueur n’est utilisée pour leur ordre d’approche.

`FDestruction` transmet les primitives réellement détachées, leur matériau, dimension et pose. `FSimulation` possède les positions, vitesses, rotations, contacts et temps de stabilisation ; `FEffects` ne simule rien et ne raccourcit pas leur durée. Les morceaux structurels sont persistants sous un plafond128 ; les petits éclats temporaires ont un plafond64. La sélection visuelle favorise les débris structurels proches et les groupes distincts. Les gravats ne deviennent pas des colliders pour le joueur ou la navigation. Les sauvegardes avec `rubbleVersion:1` conservent ces morceaux et leur prochaine continuation physique.

`FAudio` prépare une banque PCM déterministe par petits lots. La boucle de combat ne synthétise ni ne crée de buffer audio. Les voix et les sons de collision sont limités/priorisés. Le vent extérieur varie jusqu’au silence ; la banque de ventilateur, piston, réacteur et ascenseur n’est audible qu’à la demande de la scène. Les quatre bus gardent les préférences existantes, et la vapeur continue suit le volume d’ambiance.

Le nouveau module `FSoundscape` calcule distance3D, panoramique et atténuation par le décor intact. Il réutilise les rayons de la simulation, avec une marge au point d’impact pour éviter qu’une paroi masque son propre impact. Le cache inclut la source, la position de l’auditeur, les changements de destruction et les portes ; au plus12 sondes par125ms. Trois candidats proches par type de source suffisent pour comparer un moteur caché avec un autre audible. Les changements de monde vident le cache.

Les éléments du HUD affichent l’armement initial, la phase6+12, les rangs, les récompenses du boss, les PV et la direction de la caisse à ramasser. Le numéro de titre vient du package au build. Les tests de scène, mesures DSP, reprises réelles du shell et captures navigateur/GLES ont chacun une portée distincte décrite dans `VALIDATION.md`.

## Distribution et identité

`tools/build.py` assemble **quinze modules JavaScript**, `index.html` et `style.css` dans un HTML autonome. Aucun chargement réseau de code, image, texture, modèle, police ou audio n’est nécessaire. `SIZE.json` mesure le HTML brut, son gzip reproductible et son SHA-256. Le budget est de 1 400 000 octets bruts ; navigateur, pilotes, tests et documentation sont exclus. Les mesures du build courant et les résultats de vérification sont référencés dans `SIZE.json` et `VALIDATION.md` ; ce document décrit les contrats.

Le titre public et le dépôt GitHub sont **METAL** (`M4D135/METAL`). Les API `FWorld`, `FRender`, etc., le format de snapshot `FERRO` et les clés `ferro-settings` / `ferro-expedition-v2` restent inchangés pour préserver les migrations.

| Module | Responsabilité |
| --- | --- |
| `fmath.js` | `FMath` : `sin`, `cos`, `atan` et `atan2` en JavaScript pur (fdlibm de V8 sans FMA), et `hypot`, `hypot2`, `hypot3` (portage du `Math.hypot` de V8, sans allocation pour deux et trois arguments), bit à bit identiques sur toutes les plateformes ; chargé avant `world.js` |
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
| `soundscape.js` | Sources acoustiques locales, distance 3D, panoramique et occlusion bornée |
| `options.js` | Préférences bornées, difficulté, touches et conflits |
| `game.js` | Entrées, boucle, menus, HUD, montage des systèmes et sauvegardes navigateur |

## Campagne historique v1 et identité

`FWorld.create(seed,index,{campaign:true})` borne index à 0–17, conserve `world.stage=index%3` et ajoute `campaign/index/chapter/chapterTitle`. Sans option, la génération historique reste identique. Les flux aléatoires de l’architecture, des détails, de la nature et de la botanique utilisent l’index campagne, en conservant les clés historiques 0–2. La génération reste 6.

Le shell lance les nouvelles parties en campagne. L’ancienne enveloppe version 2 sélectionne explicitement le mode classique. Le cache de deux mondes inclut mode/graine/index dans sa clé ; audio, ambiance et MOD utilisent `world.stage`. La fin de campagne appartient à l’index 17. Les trois anciens biomes sont réutilisés, sans introduire dix-huit décors différents.

`world.campaignProfile` fixe garnison, plafond nominal, quotas d’explosifs et facteur de PV boss. Les pourcentages de garnison sont35/45/55/70/85/100, appliqués aux anciens120/140/170 et arrondis avec des entiers. Ces totaux incluent boss, six renforts et éventuels trois gardes de trophée. Les nouveaux contrôles comparent aussi six empreintes complètes du mode classique.

## Monde et circulation

La **génération 6** conserve les territoires agrandis de la génération 5, leurs terrasses, systèmes, tremplins, substrat et arènes. Elle ajoute ateliers, caches de ravitaillement et baies de renforts dotées de couverts physiques. Les graphes possèdent des boucles et des rampes alternatives aux ascenseurs. Les positions de ravitaillement évitent obstacles, pièges, jets de vapeur, commandes et points d’arrivée.

La génération reste déterministe pour une graine et un secteur, et identique d’une plateforme à l’autre sous V8 (Node sur x86-64 et arm64, Chrome) : `world.js` prend `sin`, `cos`, `atan` et `atan2` dans `FMath`, car le `Math` de V8 diffère au dernier bit sur arm64 (contraction FMA de fdlibm), et celui de Chrome encore autrement. Il y prend aussi `hypot2` et `hypot3`, à l’arité et dans l’ordre d’arguments des anciens appels à `Math.hypot` : V8 calcule `hypot` par le même algorithme sur toutes ses plateformes, mais JavaScriptCore (Safari) autrement ; le portage redonne le résultat de V8 partout, et JavaScriptCore génère alors les mêmes mondes que Node et Chrome. Les autres fonctions de `Math` qu’il appelle sont exactes. La simulation garde le `Math` de la plateforme. Les nombres de meshes/colliders dépendent de cette génération et ne reprennent pas les métriques de la version précédente. Un nombre de descriptions statiques ne mesure ni les pièces effectivement dessinées ni la durée d’un parcours.

Le terrain combine plans plats et rampes `{x,z,w,d,y,slopeX,slopeZ}`. La hauteur vaut `y+(px-x)*slopeX+(pz-z)*slopeZ`. Les sols de salle sont prioritaires dans les petits recouvrements de raccord ; le **substrat `fallback:true,substrate:true` n’intervient qu’en l’absence de sol local**, afin de ne jamais aplatir une rampe. Ce terrain inférieur visible est à −0,25 m. Les sols et rampes sont portants et ne sont pas excavés par la destruction.

`player.y` et `enemy.baseY` désignent les pieds. `enemy.y` désigne le centre de visée historique, adapté à l’échelle des géants. Les meshes de sols portent `ground:true`. Les surfaces inclinées visuelles et physiques coïncident. Les gros troncs, rochers, parois, portes et équipements possèdent des collisions ; les détails fins restent décoratifs.

Chaque monde conserve trois commandes, trois portes, deux ascenseurs, trois tremplins, trois relais, quatre conduites, trois pièges et trois ateliers. Les effectifs classiques restent 120/140/170, avec 8 grenadiers et 6 roquettiers. En campagne, les effectifs du profil varient de 42 à 170 ; les spécialistes par chapitre sont0/2/3/5/6/8 grenadiers et0/0/0/2/4/6 roquettiers. Ils arrivent dans les vagues ultérieures, et leur attaque explosive dépend aussi de la possession réelle du joueur.

Les arènes font 60 × 60 m, avec un rayon de combat de 28 m et une passerelle d’accès de 13 m. Les frontons monumentaux restent au-delà de 27 m du centre. Leur géométrie est destructible et leurs linteaux possèdent de vrais supports. Le centre est dégagé ; les couverts restent périphériques.

## Systèmes et physique

`nearestInteraction()` choisit une action à moins de 2,6 m, au bon palier et sans obstruction. F ou l’action tactile déclenche `input.interact` au premier sous-pas seulement. Les commandes alimentent les systèmes par `requires` ; une console détruite active son circuit pour éviter un verrouillage de mission. Une porte détruite cesse de bloquer immédiatement.

Une porte mobile utilise le même `progress` pour son battant visuel et physique. Les lifts exposent `y`, `target`, `powered`, `moving` et `carrying`. Les passagers restent posés sur leur plateau, avec vérification des murs et de l’espace au-dessus de la tête. `liftStop.carrying` distingue l’arrivée du joueur d’un rappel à vide.

Les tremplins exposent `{id,x,y,z,r,target:{x,y,z},flightTime,yaw}`. Le contact calcule une impulsion depuis la position réelle, avec gravité de 12 m/s², sans recentrer ni téléporter l’acteur. Les champs `airborne`, `airVX/Y/Z`, `airTime`, `padCooldown` et `padId` sont sauvegardés. Les plafonds, murs et atterrissages sont physiques ; le cooldown empêche une relance involontaire au même contact.

Le garde de chute détecte les coordonnées non finies/hors limites, `y < -14` et les pieds à plus de 0,5 m sous un terrain porteur, avec exemption d'un véritable ascenseur ou d'un sol inférieur explicitement praticable. Un impact vertical supérieur à 6 m/s sur le seul substrat de fond est fatal (environ 1,5 m de chute). Les vrais sols inférieurs conservent leurs règles d'atterrissage. `dead{reason:'fall'}` ignore protection de reprise, esquive et bouclier, arrête le jeu et n'est émis qu'une fois. Les points de reprise demandés en vol sont différés jusqu'à un atterrissage vivant ; ils ne remplacent donc pas le dernier point sûr au cours d'une chute fatale. Ce correctif de chute ne change pas à lui seul le format des snapshots ni la génération.

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

Les IDs 0–3 restent Mitraillette, Double pompe, Lance-roquettes, Lance-grenades ; le Pistolet est ajouté en ID 4 (touche 5). En campagne, `weaponSlots:5`, inventaire `{weapons:[bool×5],ammo:[int×5],shield:boolean}`, une arme au moins possédée et main droite possédée. Le départ n’a que le pistolet, droite 4, munitions `[0,0,0,0,1]`. Le pistolet tire toutes les 0,32 s, inflige 1,2, portée 75 et chaleur 0,06, avec précision sans dispersion ; la sentinelle finie 0..1 ne diminue jamais. Le mode classique conserve quatre slots et exige la mitraillette ; les petites fixtures historiques à trois slots restent valides.

En mode classique, une nouvelle expédition commence avec `[true,false,false,false]`, `[48,0,0,0]` et aucun bouclier possédé. Le double pompe et le bouclier se trouvent dans les premières zones ; le lance-grenades apparaît dans la zone de l’atelier intermédiaire et le lance-roquettes plus loin sur les parcours. Les racks déjà connus ne fournissent que leur réserve restante. `pickups[].remaining` conserve le surplus lorsque le plafond est atteint. Proximité, hauteur et ligne dégagée empêchent de récupérer à travers un mur ou un palier.

Le double pompe consomme deux cartouches pour quatorze rayons, ou une seule pour sept rayons lorsque le stock restant vaut un. La mitraillette, les roquettes et les grenades consomment une unité par départ ; le pistolet ne consomme aucune munition. Une arme non possédée ne peut pas être sélectionnée. Une arme vide émet `empty` avec cadence bornée puis tente `melee()`, sans créer un projectile ou de chaleur. La crosse, liée à **V** par défaut, a une portée de 1,8 m, une cadence de 0,72 s et des dégâts de base de 0,9 ; elle conserve les tests de couvert. Elle fournit une solution de proximité pour récupérer des munitions, pas un tir gratuit à distance.

`state.weapon` désigne la main droite et correspond à `state.equipment.right`. La main gauche vaut `null`, un autre identifiant d’arme possédée ou `'shield'`. Deux mains ne peuvent pas dupliquer la même arme. `selectWeapon`, `selectLeftWeapon` et `fireLeft` passent par cette validation. Chaque arme conserve son délai dans `weaponWait` ; chaleur et surchauffe restent communes. Changer de main ou d’arme ne supprime pas ces contraintes. Les deux bouches convergent vers la cible de la visée centrale après un balayage physique entre l’œil et la bouche ; un canon bloqué ne permet pas de tirer derrière le couvert.

Les roquettes sortent à 24 unités/s. Les grenades sortent à 13 unités/s avec une composante verticale supplémentaire de 3,5 lorsque la bouche est dégagée ; leur fusée vaut 1,8 s. Le double pompe adapte cadence et chaleur au nombre de cartouches réellement tirées. Le lance-grenades a un délai de 0,95 s. Les modèles et événements contiennent `hand`, sans ajouter une réserve de munitions par main.

Le bouclier s’équipe automatiquement à gauche à sa première acquisition. Son état est `{energy,raised,rechargeDelay,bashCooldown,bashVisual}`. Une garde valide utilise le yaw et le pitch et exige une direction source avec produit scalaire supérieur à 0,55. Elle absorbe jusqu’à 80 % du dégât direct ou 55 % d’un souffle, à raison de 1,5 énergie par point absorbé. Le coût continu de garde vaut 2,5 énergie/s ; la recharge vaut 18/s lorsqu’il est baissé et que son délai est écoulé. Un blocage ou une frappe impose 2,2 s de délai. Sans source bloquable, notamment pour les dangers de contact, il n’y a pas d’immunité cachée.

Quand le bouclier est équipé, Espace déclenche une frappe plutôt que l’esquive. Elle consomme 24 énergie, respecte un délai de 1,1 s et touche au plus trois cibles proches, dans un cône frontal et sans traverser les murs. Les machines ordinaires peuvent être repoussées et étourdies ; les géants ne sont pas déplacés. Changement d’équipement et achats ne rechargent pas l’énergie. Les événements sont `grenadeLaunch`, `shieldRaise`, `shieldBlock` et `shieldBash` ; `shieldBlock` indique aussi `broken`.

L’onde a un rayon de 6,5 m, une recharge de sept secondes et respecte le couvert. En Survie, elle inflige seulement 0,25 dégât de base aux machines ordinaires et aucun au colosse ; repoussement, étourdissement, dissipation de balles et refroidissement restent son rôle. Le chemin historique des mondes de test sans `progression` conserve ses anciens contrats ; le monde généré actuel active le chemin Survie.

La bouche nominale est à `eye + right*(±.255) + up*(-.23) + forward*1.228`, avec le signe de la main. Le trajet œil → bouche est vérifié avant le lancement ; la roquette vise ensuite l’intersection du viseur. Trop proche, un impact non armé produit un choc local de terrain et `rocketDud`, sans explosion créée derrière le mur.

Les roquettes et grenades balaient leur rayon physique sur tout leur déplacement. Les grenades suivent une parabole, rebondissent et possèdent un délai d’explosion. Les spécialistes préparent leur attaque à partir d’une observation, contrôlent la trajectoire et refusent une zone cible occupée par leur groupe.

Le souffle évalue le couvert **avant** de démolir la scène. Il ne profite donc pas rétroactivement de sa propre brèche pour traverser une protection. `state.projectiles`, `explosions` et `debris` sont distincts des anciennes balles et particules. `age` avance tandis que `life` garde la durée totale des effets. Les explosions portent `{id,kind,owner,x,y,z,age,life,radius,power,seed}` ; `kind` vaut `rocket`, `grenade`, `steam`, `boss` ou `blast`. Le feu, la fumée, les ondes et les lobes de mort du colosse restent des effets de cette décision physique, sans redéclencher le souffle de dégâts.

### Réserve d’armure

`state.armor={points,capacity}` reste distinct de `state.shield.energy` et des rangs de blindage. La capacité vaut 100, ou 200 si le bouclier est possédé et équipé à gauche ; un changement de main borne les points sans recharge. Après mitigation passive et garde directionnelle, `min(points,damage/3)` est prélevé sur l’armure. La mort de chute ignore cette réserve.

L’activation est automatique en campagne, explicite par `armorSystem:true` dans le shell classique, et possible par un profil portable `armor`. L’API classique sans option conserve son état historique. `copyArmor` valide strictement la version et les points finis ; `exportLoadout` transporte les fractions exactes. Le snapshot ajoute `armorVersion:1` et la capacité dérivée des mains. Les checkpoints compatibles sans cette version migrent avec zéro point et zéro armure dans leurs anciens butins.

Les trois pickups campagne `armor-start/armor-middle/armor-boss` contiennent 25/25/50. Ils sont placés après les autres objets sans les déplacer, sur une surface réelle, hors conduites/pièges/accès. `armorPickup{id,amount,points,capacity,x,y,z}` déclenche son, HUD et sauvegarde sûre. Les restes fractionnaires persistent ; un butin reste présent tant qu’une ressource n’est pas prise. Boss : 50 ; ennemi ordinaire avec `id%4===0` : 10. Les achats et le temps n’ajoutent aucun point d’armure.

## Rencontres et réservistes

`world.encounters` décrit des déclencheurs, zones, accès cachés et vagues d’identités stables. Le budget classique est8/10/12 ; le profil campagne et l’arsenal réel bornent ensemble les engagés à 4–12. Les premières patrouilles campagne comptent 2–3 machines et les vagues 2–6. Une vague dépassant le budget réel se déploie partiellement et attend des places ; le colosse est hors plafond ordinaire, ses renforts y participent.

`deployed:false` retire réellement le réserviste du rendu, des collisions d’acteur, de la perception et des dégâts. Il ne s’agit pas de rendre invisible une machine encore capable de bloquer ou tirer. Les patrouilles d’ouverture et les gardes préplacés du boss conservent leur présence ; leur autorisation de combattre reste distincte.

Chaque rencontre parcourt `dormant → warning → waiting → active → cleared`. La première annonce attend 1,4 s ; les suivantes utilisent l’intervalle de quatre secondes du monde. La prochaine vague n’est annoncée qu’après élimination de la précédente, lorsque le joueur est encore dans la zone concernée.

`safeEntry()` exige un sol cohérent, de l’espace pour le corps, une distance d’au moins 10 m au joueur et un couvert sur plusieurs points de la silhouette. Cette condition ne dépend pas de la direction de sa caméra. Un canon lourd doit lui aussi disposer d’un placement valide. Une entrée devenue visible après démolition ne reçoit pas de nouvelle machine. Sans entrée sûre ou sans budget, le groupe reste en attente.

Les sondes d’entrée sont bornées : huit essais au plus par mise à jour espacée de 0,2 s, et un nouveau corps déployé au plus lors de ce passage. Les rencontres partagent leur budget ; une course à travers plusieurs déclencheurs ne doit pas empiler toutes les vagues. Les corps déployés restent physiques même lorsqu’ils perdent le budget de combat. Les acteurs désengagés regagnent leur poste par navigation, sans disparition ou retour par téléportation.

`aiStats` distingue `reserve`, `combat`, `combatCap`, `awake` et `dormant`. `remaining` et `active` sont recalculés depuis les identités des vagues. Une zone devient sécurisée quand sa garnison est neutralisée. Les objectifs de sortie restent trois relais, les commandes requises et le boss : les réservistes d’une rencontre optionnelle bloquée ne verrouillent pas la mission.

## Trophées et adaptation

`world.trophies` lie pickup unique, rencontre, cache, lumière et présentation physique. Le portique et le socle sont indestructibles et collisionnés ; leur ouverture laisse passer le volume joueur. Les gardes sont préalloués avant le boss et leurs accès réemploient des couverts réels. La sortie n’exige pas l’épreuve optionnelle.

Le profil transportable `campaign:{version:1,discovered:[...]}` utilise les clés fermées pistol/shield/smg/shotgun/grenade/rocket. `copyCampaign` vérifie une correspondance exacte avec la possession ; le profil économique reste inchangé. L’état local ajoute `trophies:[{id,phase,timer}]` avec phases sealed/grace/trial/complete. Les événements `trophy`, `trophyTrial`, `trophyComplete` viennent de la simulation ; la reprise ne les réémet pas. La grâce dure 3 s et ne neutralise pas la mort de chute.

La politique calcule `tier=min(chapter,.6*meilleurPalier+.4*nombreAcquisitions)` et interpole plafonds`[4,5,6,8,10,12]`, dégâts`[.58,.66,.75,.84,.92,1]`, cadence`[.70,.76,.82,.88,.94,1]`. Un cache de 6 bits évite les allocations répétées quand la possession ne change pas. L’état sauvegardé comprend tier, entryTier, maxActive, damageMultiplier, cadenceMultiplier et bossHpFactor, avec version 1.

Les PV générés du boss utilisent`[.25,.32,.45,.62,.8,1]` par chapitre. À l’entrée, la simulation applique`max(.55,1-.09*(chapter-entryTier))` et un minimum de 30 PV. Cette valeur reste fixe pendant le monde, y compris après découverte et reprise. Les attaques explosives de l’infanterie nécessitent le bouclier ; les roquettes ordinaires nécessitent aussi une arme lourde parmi 1/2/3. Les barrages scriptés des boss suivent leurs règles propres. Les unités conservent leurs identités et peuvent employer leurs attaques ordinaires avant cette autorisation.

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

Les crédits et noyaux sont des entiers bornés ; chaque rang appartient à 0–3. Le profil strict reste inchangé. L’option `{campaign:true}` propage cinq stocks dans `ammoCaps`, `quote` et `transact` ; le cinquième plafond reste 1 même après amélioration. Les offres de première arme/bouclier sont refusées en campagne, et le shell masque aussi les réserves inutilisables. Les inventaires classiques 3/4 gardent leurs règles. `stats` et `ammoCaps` retournent null pour un profil invalide.

| Statistique | Formule |
| --- | --- |
| Santé maximale | `100 + 20*vitality` |
| Dégâts infligés | `1 + .10*power` |
| Dégâts reçus | `1 - .08*armor` |
| Vitesse de refroidissement | `1 + .20*cooling` |
| Réserves | `floor([180,36,12,16] * (1 + .25*capacity))`, élément par élément |

Le catalogue historique de 14 offres reste repair, ammo0..3, weapon1..3, shield et les cinq améliorations. En campagne, seules réparation, améliorations et munitions possédées sont proposées ; une transaction directe ne contourne pas un trophée. Les prix classiques des armes restent inchangés. Réparation de 25 PV : 24 crédits ; packs de 24 balles / 6 cartouches / 2 roquettes / 4 grenades : 18/24/36/36 crédits. Une capacité accrue ne remplit aucune réserve.

Les premiers rangs coûtent 90 / 120 / 100 / 140 / 110 crédits pour vitalité, blindage, réserves, puissance et refroidissement. Les rangs suivants valent `ceil(prixInitial * 1.6)` puis `ceil(prixInitial * 2.3)` et consomment chacun un noyau. Augmenter un plafond ne remplit ni la santé ni les munitions. Réparation et packs partiels coûtent `ceil(prixPack * quantitéReçue / quantitéPack)`, au minimum un crédit pour un achat réussi. Réserves pleines, armes verrouillées pour un pack dédié, rang maximal et fonds insuffisants sont des refus explicites.

La simulation possède `state.economy`, les stats dérivées et les plafonds courants. `shopOffers(id)` et `buy(id,itemId)` exigent un atelier proche à 2,6 m au plus, au bon palier, visible et accessible. Le shell ouvre le mode `shop`, qui suspend les pas de simulation. Un achat validé met à jour ensemble profil, inventaire, santé et stats, puis le shell enregistre un checkpoint.

Les machines ordinaires donnent 6 / 12 / 8 crédits selon leur famille, avec les munitions définies par leur drop. Un colosse donne 160 crédits, un noyau et jusqu’à`[24,6,2,3]` munitions ; en campagne les stocks d’armes inconnues restent nuls. `state.loot` conserve la position au sol, `sourceEnemy`, le contenu restant et `taken`. Un seul butin est autorisé par ennemi mort ; celui d’un géant est placé vers un pied accessible. Les crédits/noyaux peuvent être récupérés alors que des munitions restent au sol faute de place.

`exportLoadout()` retourne une copie de `{inventory,economy,equipment:{right,left,shieldEnergy}}`, plus le profil `campaign` en mode campagne et `armor:{version:1,points}` lorsque l’armure est activée. Le monde suivant reçoit exactement inventaire, découvertes, monnaies, améliorations, points d’armure et mains, sans remplir les réserves. Recommencer utilise le loadout d’entrée. Les états locaux de trophée et l’adaptation ne sont pas transportés : ils sont instanciés pour le nouveau monde. La santé courante reste une donnée de snapshot.

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

Le cœur local est **`[0,1.93,-.90]*bossScale`**, rayon **`.36*bossScale`**. Il ressort devant le plastron et reste enregistré sur le torse, indépendamment de la marche. La fenêtre après récupération dure 3 / 2,7 / 2,4 s selon le type de colosse. Les dégâts au cœur ouvert sont multipliés par 3,2 ; les autres impacts subissent le facteur d’armure de 0,30. Torse, casque et jambes restent ciblables en dehors de la fenêtre.

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

### Finition visuelle 0.7

Le niveau proche WebGL Auto/Haute ajoute 14 pièces par machine, 18 par colosse : plastrons, prises d’air, fixations, conduites et fourreaux collinéaires avec les vérins. Les niveaux moyen/lointain, Économie et Canvas ne gagnent aucune pièce. Les limites des volumes et cœurs ne changent pas.

Le métal brossé, l’usure d’arête après teinte et les petits reflets sont filtrés selon la taille du pixel. Le reflet extérieur ajoute soleil et bruit de nuages dans la passe existante. Fumée structurée et pointes d’étincelles suivent la trajectoire simulée. Aucun SSR, miroir exact, nouvelle passe d’ombre ou nombre de particules accru. La comparaison logicielle d’une pièce relève +0,98 % de triangles et 51 appels de dessin avant/après dans la scène mesurée ; ce n’est pas une mesure matérielle de FPS.

Le bouclier utilise toujours dix pièces. Le panneau mesure 0,52 × 0,66 m, à 0,98 m en garde ; le cadre suit le montage commun, à gauche du viseur. Le dégagement latéral tient compte des offsets et rotations existants de la main droite. Les silhouettes réelles sont vérifiées dans 3 500 poses ciblées aux FOV 60 et 110. La comparaison native conserve 1 529 instances et 130 088 triangles ; le tri transparent ajoute un appel de dessin (52 → 53), sans nouvelle passe. Une partie du bouclier reste hors champ en portrait, sans intersection avec l’arme ni franchissement du plan proche dans les cas testés.

## Reprises atomiques et interface

Le snapshot conserve version1, aiVersion3, systemsVersion1, physicsVersion1, destructionVersion1, bossVersion1 et directorVersion1. La progression ajoute progressionVersion1 et economyVersion1 ; l’arsenal classique utilise arsenalVersion1, la campagne cinq slots arsenalVersion2 et campaignVersion1. Inventaire, découvertes, épreuves, adaptation, projectiles et systèmes restent finis et strictement validés. L’empreinte conditionnelle inclut mode/index/chapitre/trophées ; ce n’est pas une signature cryptographique.

`restore()` valide un candidat complet avant mutation, notamment le profil avant les plafonds dérivés et les stocks. Un refus laisse la partie intacte. Une réussite conserve les références de `state` et `player`, remet les données et reconstruit les index nécessaires. Les effets purement cosmétiques ne sont pas rejoués. Le mode `{recover:true}` ajoute une protection transitoire de reprise et dissipe les projectiles immédiats dangereux ; il ne remplit ni santé, ni munitions, ni bouclier. Les réponses tactiques asynchrones antérieures sont invalidées.

Le shell utilise l’enveloppe classique `{version:2,generation:6,seed,stage,runStats,entryLoadout,checkpoint}` ou campagne `{version:3,campaign:true,index,stage:index%3,...}`. Une incohérence de mode/slots du checkpoint est refusée. Un loadout d’entrée optionnel incompatible avec le mode du monde réellement généré est ignoré avant construction ; la migration classique3→4 reste autorisée sans cadeaux. Un checkpoint sain peut donc encore restaurer ses propres ressources. Les anciennes sauvegardes ne sont pas converties silencieusement en campagne. Le redémarrage volontaire restaure l’entrée, et les acquisitions en vol attendent un sol sûr avant écriture.

Le menu possède quatre onglets accessibles depuis l’accueil et la pause. Il applique directement FOV, résolution, luminosité, ombres, mixage, mode tactique Auto/CPU et touches. Options et atelier n’avancent pas la simulation. Les conflits de touches sont refusés et Échap reste réservé. La difficulté courante est réappliquée après reprise sans régénérer les ressources ni créer un checkpoint gratuit. Le HUD distingue cinq armes en campagne (seulement les possédées), quatre en classique, stock/plafond, main gauche, garde/énergie, vague, santé maximale, blindage, monnaie et noyaux. Clic gauche/Entrée commandent la droite, clic droit/C la gauche, X le changement gauche, 1–5 la droite en campagne, V la crosse et Espace l’esquive ou la frappe de bouclier selon l’équipement.

La préparation commence par le déverrouillage audio lié au geste utilisateur, puis laisse peindre l’écran de chargement. Le shell attend `FMusic.warmup(stage)`, la préparation tactique et `audio.prepare(stage)` avant la partie. Le cache de descriptions de monde est limité à deux secteurs ; l’écran de fin peut anticiper le suivant. Les banques audio préparées sont conservées, sans changer le morceau actif. Cette organisation déplace des travaux de première utilisation hors du combat ; elle n’est pas une garantie de durée d’image.

## Audio et portée des preuves

Les MOD ont quatre canaux, signature `M.K.`, 31 emplacements dont 15 instruments synthétisés, six patterns de 64 lignes et huit positions de lecture, soit 32 mesures. **Fer noir** est à 100 BPM, boucle de 76,8 s : power chords graves en Ré, palm-mutes, arrêts et rupture doom. **Fracture** est à 170 BPM, 45,2 s : attaques chromatiques syncopées, doubles grosses caisses, rupture et montée. **Veille des cendres** est à 145 BPM, environ 53 s : galop en Mi, mode phrygien, tierces diatoniques et réponses mélodiques. Les passages de lead alternent avec la guitare rythmique et les silences ; ils ne forment pas un arpège permanent.

Les cordes synthétiques mélangent harmoniques, désaccords modérés, attaque bruitée, distorsion et filtrage de corps/cabinet. Les harmonies majeures ou mineures respectent le mode du troisième morceau. Les instruments de batterie composés permettent de conserver quatre canaux tout en superposant grosse caisse, caisse claire et cymbales. Le lecteur et l’export emploient les mêmes octets, périodes de notes et PCM signés huit bits ; aucun enregistrement n’est importé.

`FMusic.getTrack(stage)` fournit titre, tempo, style, durée et canaux. `getModule(stage)` produit un vrai MOD sans AudioContext. `warmup(stage)` partage une file asynchrone de synthèse, en cédant entre instruments sans ouvrir de périphérique. `FMusic.create(ctx,output)` n’effectue pas la synthèse complète à la construction. `audio.prepare(stage)` réutilise le contexte déjà déverrouillé et prépare les AudioBuffers sans démarrer, chercher ou remplacer le morceau. Trois banques au plus sont réutilisées ; le premier tir ne doit pas les reconstruire.

Le budget musique de 28 voix est indépendant des effets. Ceux-ci réservent au plus 32 voix aux attaquants distants, 40 aux interactions normales et 48 avec les voix prioritaires du joueur et des alertes proches. Une voix urgente peut remplacer une voix moins prioritaire. La pause annule les notes programmées et la reprise se recale sur une mesure ; le rattrapage du séquenceur est borné. Moteur et vapeur utilisent des sources persistantes avec niveau selon la distance et l’état réel des machines ; ils ne créent pas une voix par objet et par image. `audio.setPressure` agit sur l’ambiance, `audio.horror` produit les événements spatialisés.

Les bus musique, effets et ambiances sont indépendants. Avant volume utilisateur, leurs gains valent respectivement 0,56 / 0,9 / 0,7 ; le master vaut `0,65*volumeGénéral`. La passe 0.7 réduit le drone, le vent, le moteur et la vapeur ; le bruit d’air passe par un bandpass de Q 0,45. La portée sonore de vapeur devient 12 m avec atténuation quadratique. La modulation du drone s’éteint aussi en pause. Les effets de combat et la musique restent à leur niveau antérieur, les préférences ne sont pas réinitialisées. Les impacts prioritaires réduisent brièvement la musique en fonction de leur niveau. `testMix({muted})` joue les vrais bus pendant deux secondes avec les quatre curseurs, un minuteur annulable et une extinction sur l’horloge audio ; `cancelTestMix()` est appelé à la sortie ou au changement d’onglet. Les quatre curseurs peuvent être ajustés pendant l’aperçu sans le couper ; le mute explicite et la sortie de menu l’arrêtent immédiatement. Le retour au mix recommandé reste une action explicite.

Une explosion utilise sept composants au plus : attaque bruitée, grave sinusoïdal, corps filtré, résonance, fragments et queue de souffle métallique. Distance, rayon, puissance et type modulent son niveau, sa durée et son timbre ; les explosions restent dans le budget normal, pour réserver les voix du joueur. Les cooldowns sonores de tir sont séparés par main. `grenadeLaunch`, `shieldRaise`, `shieldBlock` et `shieldBash` distinguent départ sourd, engagement de garde, impact/rupture et frappe ; aucune nouvelle banque musicale n’est créée pour ces actions.

Le mix final passe par le compresseur puis une courbe de protection identique à l’entrée jusqu’à 0,875, bornée ensuite sous pleine échelle. Les limites numériques, ressources, programmations et décodages MOD indépendants sont testés ; cela ne constitue pas une écoute humaine. Les mesures diagnostiques de mélange reconstruit ne sont pas présentées comme un rendu natif du mix Web Audio complet.

Les contrôles de `checks/` et les mesures de `VALIDATION.md` distinguent tests unitaires, parcours physiques, commandes navigateur et pixels GLES logiciels. Ils ne prouvent ni cadence sur un Mac précis, ni compatibilité Safari, ni ressenti d’horreur, ni équilibrage humain complet. Un portage natif de type `.kkrieger` reste un chantier distinct de ce fichier web autonome.
