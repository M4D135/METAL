# Axe MURS — MURS — murs cassables seulement aux armes lourdes (lance-grenades, lance-roquettes)

Origine : axe ajouté. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Règle prototypée dans une copie de travail et mesurée ; les deux dépôts sont intacts (METAL 673d6b2, git status vide). Banc : bancs/murs.

Deux écarts avec l'énoncé :
- La nouvelle partie est la campagne v2 (game.js:12 et 122). Le lance-grenades y est le butin du boss 3 et le lance-roquettes celui du boss 6 (economy.js:56), donc disponibles aux mondes 4 et 7. Les mondes 13 et 16 ne valent que pour les anciennes sauvegardes v1.
- ~/Projects/ferro n'existe pas. J'ai lu le clone 248043a de scratchpad/wf2/ferro/ferro ; son audio.js est identique à celui de METAL.

État actuel, mesuré :
- Un mur de salle (résistance 18) reçoit son premier trou après 9 balles de pistolet ou de mitraillette, ou 1 coup de pompe. Un passage franchissable s'ouvre en 44 balles (5,8 s de mitraillette) ou 3 coups de pompe (2 s).
- Une porte verrouillée tombe en 9 balles.
- Une seule balle fait tomber une colline de 9 m.
- Les balles ennemies et la frappe de bouclier n'abîment jamais le décor.

Règle proposée : chaque appel porte une classe (léger ou lourd) et chaque groupe un blindage 0, 1 ou 2, calculé par une fonction pure des données existantes. Sans cette fonction, le module se comporte comme avant : 21 traces rejouées sur 21 donnent les mêmes états.

Effet sur 8 traces de tir (900 s), en pas avec révision, puis en gravats émis :
- murs seuls : −16 %, −30 % ;
- murs, toits et piliers porteurs : −18 %, −32 % ;
- avec les murets d'enceinte : −46 %, −69 % ;
- avec le relief et les sols indestructibles : −66 %, −76 %.
Les murets pèsent 26 % des ruptures et les marquages au sol 20 %, contre 15 % pour les murs : la décision sur les murets compte plus que celle sur les murs.

Autres résultats :
- Aucun monde n'exige de percer : 75 mondes vérifiés, portes fermées jusqu'à leur mécanisme.
- Aucune brèche de mur de salle n'est un raccourci : toutes donnent sur une chute mortelle (8 essais, 8 morts).
- Il ne faut rien écrire dans l'objet monde. Ma première version y ajoutait un champ et cassait 8 tests à empreintes dorées. La seconde laisse world.js identique octet pour octet.
- Tests sur la version finale : 260 verts sur 261 (11 fichiers). Le seul rouge, simulation.test.mjs:1507, affirme l'ancienne règle.
- Points de reprise acceptés : 1 sur 24 à l'origine, 18 sur 24 avec la règle.

Limites :
- Machine très chargée (charge 13 à 130) : je ne donne que des comptages déterministes, aucun gain en millisecondes.
- Le pilote automatique tire peu et croise peu d'explosions ennemies.
- Le retour visuel et sonore est conçu, ni prototypé ni vu dans un navigateur.
- world.test et campaign-world n'ont pas été relancés sur la version finale ; world.js y est inchangé.

## Mesures

- **Recensement des groupes destructibles, 39 mondes (18 campagne v2, 18 campagne v1, 3 historiques), graine 96** : 965 à 1260 groupes par monde, dont 335 à 429 avec collider. Genre wall : 40 à 66 (v2), 48 à 73 (v1 et historiques). Avec toits et piliers porteurs : 77 à 108 (v2). Avec murets : 206 à 274 (v2). Relief d'arrière-plan : 20 à 31 groupes. 3 portes par monde. Aucune vitre : la matière 12 ne sert qu'à 1 ou 2 flaques. _(méthode : census.mjs, def-count.mjs et mats.mjs : FWorld.create dans le domaine principal de Node, classement par genre, catégorie du maillage du premier collider et dimensions)_
- **Tirs avant la première coupe, par source et par genre (contrôleur FDestruction, puissances exactes de simulation.js)** : Mur (18) : 9 balles de pistolet ou de mitraillette, 1 coup de pompe, 3 ratés de roquette, 1 explosion quelle qu'elle soit, 2 jets de vapeur. Toit (16) : 8 balles. Pilier (14) : 7. Muret (6) : 3 balles ou 1 coup de pompe. Arbre (7) : 4 balles, arbre entier, 27 gravats. Une coupe par balle dans un mur de salle émet 22 gravats en moyenne. Volume de mur perdu en une explosion : grenade du joueur 45 %, roquette du joueur 60 %, grenade ennemie 31 %, roquette ennemie 37 %, écrasement du colosse 60 %. _(méthode : breach.mjs : jusqu'à 8 groupes par catégorie sur 6 mondes, chacun isolé dans un mini-monde ; hit ou blast répétés jusqu'à result.changed ; sortie breach.out)_
- **Tirs réels (chaîne fire de simulation.js) pour ouvrir un passage dans un mur de salle de 0,66 m, joueur à 3 m, monde 12** : Origine : pistolet, trou à 9 tirs et passage à 44 tirs (14,3 s) ; mitraillette 44 tirs (5,8 s) ; pompe, trou au 1er tir et passage à 3 tirs (2 s) ; grenade 3 tirs (5,5 s) ; roquette 1 tir (0,1 s). Avec la règle : aucune coupe du mur en 150 balles de pistolet, 150 de mitraillette et 25 coups de pompe ; grenade et roquette inchangées. _(méthode : passage.mjs O puis R : visée alternée à 0,55 et 1,45 m, test sim.blocked le long du segment qui traverse le mur ; sortie passage-OR.out)_
- **Portes verrouillées (18 points de vie)** : Origine : 40 balles de mitraillette, porte détruite (9 suffisent). Règle : points de vie intacts, 40 événements ricochet, puis 1 roquette la détruit. _(méthode : verify-rule.mjs, origine et copie de travail, monde 12)_
- **Répartition des ruptures de groupes, comportement d'origine** : 13 traces, 1560 s : 400 révisions, 269 pas avec révision, 518 ruptures. Murets 26,4 % ; marquages et dallages au sol 20,5 % ; murs 14,9 % ; végétation 12,4 % ; relief 9,7 % ; décor solide 8,7 % ; décor sans collision 4,4 % ; toits et piliers porteurs 3,1 %. Auteur : joueur 361, ennemis 73, vapeur 62, boss 22. _(méthode : trace.mjs enregistre chaque appel damageScenery avec sa source ; causes.mjs rejoue sur un contrôleur neuf et classe par famille)_
- **Pas avec révision par minute selon la définition du mur (rejeu exact des mêmes impacts)** : Pompe monde 3 : 28,0 à l'origine, 20,0 avec la structure, 7,3 avec les murets, 6,0 avec relief et sols. Pompe monde 10 : 32,0 / 19,3 / 15,3 / 12,7. Pompe monde 2 : 19,3 / 16,7 / 10,7 / 6,7. Mitraillette arrosage monde 3 : 17,3 / 16,3 / 10,3 / 5,0. Mitraillette arrosage monde 10 : 12,3 / 10,0 / 7,0 / 4,7. Pistolet monde 1 : 4,7 / 4,7 / 4,0 / 1,3. Cumul des 8 traces de tir (900 s) : 245 pas à l'origine ; murs seuls 206 (−16 %) ; structure 200 (−18 %) ; avec murets 133 (−46 %) ; avec relief 100 (−59 %) ; avec relief et sols 84 (−66 %). _(méthode : replay.mjs sur les traces de trace.mjs ; pilote à erreur de visée déterministe de 0,05 à 0,07 rad, tournée des rencontres ; sortie replay-all.out)_
- **Gravats structurels émis, mêmes 8 traces** : 5093 à l'origine ; murs seuls 3545 (−30 %) ; structure 3447 (−32 %) ; avec murets 1601 (−69 %) ; avec relief et sols 1197 (−76 %). _(méthode : replay.mjs, somme des result.debris structurels)_
- **Boucle fermée avec la règle (murets compris), même pilote, 90 s** : Pompe monde 3 : 81 révisions sur 42 pas à l'origine, 27 sur 14 avec la règle, 50 tirs chacun ; gravats moyens 122,6 puis 87,3. Pompe monde 10 : 90 sur 47 puis 28 sur 18, 58 tirs chacun. Pompe monde 2 : 0,94 puis 0,50 pas avec révision par tir. Mitraillette monde 3 : 12 puis 10 révisions, gravats moyens 76,8 puis 38,6. Pistolet monde 1 : 7 puis 7. _(méthode : trace.mjs en mode A puis B ; les trajectoires divergent, d'où la normalisation par tir)_
- **Pilote scripté du premier tour (tourne et tire 30 s) : révisions et points de reprise acceptés** : Mitraillette monde 3 : 15 révisions et 0 point accepté sur 6 à l'origine, 2 révisions et 6 sur 6 avec la règle. Pompe monde 3 : 35 et 0/6, puis 14 et 1/6. Mitraillette monde 10 : 14 et 1/6, puis 5 et 5/6. Pompe monde 10 : 34 et 0/6, puis 16 et 6/6. Total : 1 sur 24, puis 18 sur 24. _(méthode : checkpoints.mjs : un instantané toutes les 5 s, restauré dans une simulation neuve de la même version avec recover:true)_
- **Empreintes et compatibilité des points de reprise** : Version finale : empreinte de simulation, signature de destruction et JSON du monde identiques à 673d6b2. Sans gravats, la restauration passe dans les quatre sens (origine vers origine, origine vers règle, règle vers origine, règle vers règle). Avec gravats, même origine vers origine échoue : c'est le défaut LOAD-01. Témoin : un champ ajouté dans world.destructibles change l'empreinte et fait refuser le point. _(méthode : save-compat.mjs sur les mondes 3 et 10)_
- **États et taille des instantanés** : États de destruction après 90 s : 82 puis 35 (mitraillette monde 3), 80 puis 32 (pompe monde 3), 94 puis 35 (pompe monde 10). Instantané : 170 451 puis 147 979 octets (−13 %), 223 528 puis 211 981. Avec la règle, 80 balles sur un mur ne créent aucun état ; à l'origine, un état avec 2 coupes. _(méthode : trace.mjs (snapshotBytes, states) et verify-rule.mjs)_
- **Progression sans percer** : 75 mondes sur 75 : les 39 mondes de graine 96 et 36 mondes v2 de graines 7 et 424242. Tous les relais, la sortie, les objets, les ateliers, l'arène et les rencontres sont atteints sans destruction. Les mécanismes 0 et 1 sont atteints portes fermées, le mécanisme 2 après ouverture d'une porte. Témoin sans mécanisme : 2 relais, la sortie et l'arène deviennent hors d'atteinte. _(méthode : reach.mjs : propagation sur une grille de 0,4 m, rayon 0,3 m, marche de 0,42 m au plus, portes closes tant que leur mécanisme n'est pas atteint, ascenseurs alimentés, propulseurs)_
- **Ce que sépare chaque mur (mondes 1 à 3 de la campagne v2)** : Murs de salle dont les deux côtés sont libres : 15, 18 et 22, tous sur une chute de 3,5 ou 6,7 m ; aucun raccourci de plain-pied. Murets : 39 à 46 de plain-pied vers le socle extérieur, 64 à 125 au bord d'une chute de 1,6 à 6,7 m. Franchir la brèche : 8 morts sur 8 essais, raison fall, en 1,05 à 1,57 s. _(méthode : walls-sides.mjs (sim.ground et sim.blocked de part et d'autre) puis fall.mjs (brèche ouverte par blast, marche réelle))_
- **Une balle de pistolet sur le relief d'arrière-plan** : Colline de 9 × 5,1 × 8 m : supprimée, un seul gravat de 9 m. Falaise de 8,8 × 5,1 × 9,4 m : groupe entier effondré. 28 collines au monde 1, 28 falaises au monde 2. _(méthode : relief.mjs : raycast puis hit de puissance 2 sur le monde réel)_
- **Explosions ennemies et attaques de boss** : Monde 10, joueur passif, 150 s : 3 grenades, 3 roquettes et 1 raté ennemis, 8 jets de vapeur ; 7 révisions, 6 si les explosions ennemies sont légères ; gravats 252 puis 185. Arènes, 120 s : 7 écrasements au monde 1, 22 et 20 roquettes de boss aux mondes 2 et 3 ; 3 à 6 révisions, les boss n'y cassent que des incrustations de sol. Dix minutes sans rien faire : 37 jets de vapeur, 1 à 3 révisions. _(méthode : trace.mjs avec PASSIVE, ARENA ou repos, puis replay.mjs)_
- **Le module à règle sans marquage se comporte comme l'original** : 21 traces rejouées sur 21 : mêmes révisions, mêmes gravats, même empreinte de l'instantané final. _(méthode : replay.mjs, variantes module d'origine et module à règle sans marquage)_
- **Tests existants** : Première version (champ dans le monde) : 261 verts sur 12 fichiers, world.test.mjs vert, campaign-world 38 sur 46 (8 empreintes dorées cassées). Version finale (world.js inchangé) : 260 sur 261 sur 11 fichiers ; seul simulation.test.mjs:1507 échoue. _(méthode : node --test dans bench/murs/work ; sorties tests-destruction.out, tests-batch1.out, tests-batch2.out, tests-campaign-world.out, tests-v2.out)_
- **Reconstruction paresseuse des tableaux de FDestruction** : Appels à rebuild : 81 puis 42 (pompe monde 3), 89 puis 48 (pompe monde 10), 80 puis 29 (pompe monde 2), 52 puis 52 (mitraillette). Instantané final, colliders et suite des tailles identiques. Temps non concluants sous charge. _(méthode : lazy.mjs : rejeu de trace, lecture des tableaux une fois par pas comme le fait syncDestruction)_
- **Coût en taille du prototype** : +2 455 octets, commentaires compris (destruction.js +935, simulation.js +1 520). world.js inchangé. _(méthode : wc -c entre 673d6b2 et bench/murs/work ; diff dans rule-v2.diff)_

## Scripts de banc

- bancs/murs/lib.mjs
- bancs/murs/proto.mjs
- bancs/murs/apply_rule.py
- bancs/murs/rule-v2.diff
- bancs/murs/apply_rule_v1_world_field.py
- bancs/murs/census.mjs
- bancs/murs/def-count.mjs
- bancs/murs/breach.mjs
- bancs/murs/passage.mjs
- bancs/murs/trace.mjs
- bancs/murs/replay.mjs
- bancs/murs/causes.mjs
- bancs/murs/combat.mjs
- bancs/murs/reach.mjs
- bancs/murs/walls-sides.mjs
- bancs/murs/fall.mjs
- bancs/murs/relief.mjs
- bancs/murs/never-cats.mjs
- bancs/murs/save-compat.mjs
- bancs/murs/checkpoints.mjs
- bancs/murs/verify-rule.mjs
- bancs/murs/lazy.mjs
- bancs/murs/ordnance.mjs
- bancs/murs/unreach.mjs
- bancs/murs/work

## Décisions pour David

- **Les murets d'enceinte (0,72 à 1,55 m, en pierre, surmontés d'une clôture) sont-ils des murs ?** — recommandé : Oui, blindés comme les murs. Ce sont 26 % des ruptures mesurées, et 64 à 125 par monde servent de garde-corps au bord d'une chute mortelle. Avec eux la règle retire 46 % des pas avec révision ; sans eux, 18 %. ; autres choix : Non : ils restent du décor cassable par toutes les armes (3 balles ou 1 coup de pompe). La règle ne gagne alors presque rien en fluidité et les garde-corps continuent de s'ouvrir par accident.
- **Toits et piliers : même règle que les murs ?** — recommandé : Oui pour les toits et les piliers porteurs (section d'au moins 0,6 m : piliers d'angle, piles d'arène, colonnes de ruine). Les poteaux fins (lampadaires, antennes, portiques) restent cassables par tout. ; autres choix : Murs seuls (genre wall) : −16 % de pas avec révision au lieu de −18 %, mais les balles continuent d'entailler plafonds et piliers.
- **Sols et relief : les marquages et dallages au sol, les collines et les falaises d'arrière-plan doivent-ils casser ?** — recommandé : Jamais, pour aucune arme. Une balle fait aujourd'hui tomber une colline de 9 m, et les marquages au sol pèsent 20 % des ruptures pour un effet à peine visible. Avec cette classe la règle atteint −66 % de pas avec révision. ; autres choix : Lourd seulement (une roquette ferait encore tomber la colline entière), ou inchangé.
- **Les roquettes et grenades ennemies percent-elles les murs ?** — recommandé : Oui : tout ce qui explose perce, quel que soit le tireur. Coût mesuré négligeable : 7 révisions au lieu de 6 en 150 s face à 3 ennemis à explosifs. ; autres choix : Non : seuls les explosifs du joueur ouvrent les murs. Plus lisible comme clé du joueur, mais un mur qui encaisse une roquette ennemie sans broncher surprend.
- **Les attaques des colosses (écrasement, barrage de roquettes) percent-elles les murs et les piles d'arène ?** — recommandé : Oui, classe lourde. En arène ouverte elles ne touchent que le sol ; elles ne comptent que si le joueur s'abrite derrière une pile. ; autres choix : Non : piles et linteaux d'arène deviennent des abris sûrs contre le boss.
- **La frappe de bouclier abîme-t-elle le décor ?** — recommandé : Non, comme aujourd'hui : elle ne touche que les ennemis. ; autres choix : Elle casse le petit décor devant le joueur (caisses, végétation), jamais les murs.
- **Jets de vapeur des conduites et roquettes non armées (tir trop près) : légers ou lourds ?** — recommandé : Légers. La vapeur continue de casser le décor proche mais n'entame plus les murs ; un raté de roquette fait des étincelles. ; autres choix : Lourds : 2 jets de vapeur ou 3 ratés ouvrent un mur, comme aujourd'hui.
- **Les portes verrouillées cèdent-elles aux balles ?** — recommandé : Non : explosifs seulement, 18 points de vie conservés (1 roquette ou 1 grenade au contact). Aujourd'hui 9 balles suffisent. Tirer sur la commande continue de l'activer. ; autres choix : Inchangé : la porte devient alors le point faible de tout mur blindé.
- **Faut-il un indice la première fois que le joueur tire sur un mur blindé ?** — recommandé : Oui, discret : un message de 2,6 s après 4 ricochets en 2,5 s, deux fois par session au plus. Texte selon l'arsenal : explosifs à venir, ou nom de l'arme lourde possédée. ; autres choix : Aucun message, seulement le son et les étincelles ; ou un rappel à chaque monde.
- **À quoi servent les brèches ? Aujourd'hui aucune n'est un raccourci : derrière chaque mur de salle il y a 3,5 à 6,7 m de vide, et la chute tue.** — recommandé : Livrer la règle telle quelle en gardant la chute mortelle, puis décider d'un lot de contenu : caches murées et raccourcis conçus pour les explosifs à partir du monde 4. Ce lot change la génération, donc les empreintes : il doit venir après la réparation des reprises (LOAD-01). ; autres choix : Rendre incassables les murs qui donnent sur le vide (plus de mur à faire sauter dans les salles), ou remplacer la mort par des dégâts de chute (risque de joueur bloqué dehors si les murets sont blindés).
- **Le joueur n'a aucune arme lourde aux mondes 1 à 3 de la campagne actuelle, ni aux mondes 1 à 12 des anciennes sauvegardes v1. Est-ce accepté ?** — recommandé : Oui. Aucun monde n'exige de percer (75 mondes vérifiés) et l'indice annonce que les explosifs viendront. ; autres choix : Poser quelques grenades à usage unique avant le boss 3, ce qui demande une arme ou un objet nouveau.
- **Que deviennent les murs déjà percés dans les sauvegardes existantes ?** — recommandé : Ils restent percés. Le format et les empreintes ne changent pas : aucune sauvegarde n'est invalidée. ; autres choix : Réparer les murs à la reprise, ce qui modifierait l'état sauvegardé et ferait apparaître des murs autour du joueur.

## Constats

### MURS-01 — La règle : une classe de dégâts portée par l'appel, un blindage par groupe, et la liste des sources lourdes
- sévérité haute · catégorie règle-de-jeu · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:903-905; src/simulation.js:953; src/simulation.js:1080; src/simulation.js:1121; src/simulation.js:1129-1132; src/simulation.js:1159; src/simulation.js:1717-1718; src/simulation.js:1876; src/destruction.js:228-262; src/destruction.js:293-294

**Preuve.** État actuel. damageScenery n'a que 6 appelants : explode (simulation.js:953) ; raté de roquette en vol (1080) ; raté au canon (1121) ; balles à canon obstrué (1129) ; balles de fireArsenal (1132) ; balles de l'ancien tir (1159).

Puissances :
- pistolet et mitraillette : hit 2 ;
- plomb de pompe : hit 5, 7 ou 14 plombs par tir ;
- raté de roquette : hit 8 ;
- grenade du joueur : rayon 3,6, puissance 34 (1122) ;
- roquette du joueur : 4,2 et 55 ;
- grenade et roquette ennemies : 3,2 et 28, 3,4 et 38 (989) ;
- barrage de boss : 3,2 et 34 (1717) ;
- écrasement du colosse : 4,3 et 24 (1718) ;
- vapeur : 2,25 et 10 (1876).

Les balles ennemies meurent sur les murs sans appeler damageScenery (1929). shieldBash (785-797) ne touche pas au décor.

Mesures (breach.out, passage-OR.out) :
- mur de résistance 18 : 9 balles ou 1 coup de pompe pour le premier trou ; 44 balles (5,8 s de mitraillette) ou 3 coups de pompe (2 s) pour un passage ;
- une coupe par balle est un cube de 0,97 m (destruction.js:242) et émet 22 gravats ;
- 13 coupes ou plus de 12 morceaux effondrent le mur entier (destruction.js:251).

Prototype (rule-v2.diff, +2 455 octets) :
- 150 balles et 25 coups de pompe ne coupent plus le mur ; grenade et roquette restent inchangées ;
- sans fonction de blindage, 21 traces rejouées sur 21 donnent les mêmes états que le module d'origine.

**Cause.** damage() ne connaît que la puissance et la résistance. Les dégâts s'accumulent sans limite de temps ni de classe, si bien que n'importe quelle arme finit par couper n'importe quel groupe. Rien ne distingue un mur d'une caisse, hormis un seuil de 18 contre 6.

**Proposition.** destruction.js :
- create(world, options={}) lit options.armor, une fonction (groupe, monde) qui rend 0, 1 ou 2 ; g.armor vaut 0 par défaut.
- damage(point, radius, power, bullet, ignoreId, direction, heavy=!bullet).
- Juste après le calcul de amount (ligne 238) : if(g.armor>(heavy?1:0)). Dans ce cas, appeler chipsFor, pousser un événement materialImpact avec deflected:true, incrémenter result.deflected, puis continue. Aucun states.set, aucune coupe, aucune révision.
- API : hit(point, power, direction, {heavy=false}) ; blast(point, radius, power, ignoreId, {heavy=true}) ; armor(id).

simulation.js :
- damageScenery(point, power, r=0, direction, ignoreId, heavy=r>0) transmet {heavy}.
- explode passe kind!=='steam' (ligne 953).
- Les trois appels de balles et les deux ratés restent légers par défaut.
- Les deux créations de contrôleur (lignes 120 et 2020) passent {armor:breachArmor}.

Classes recommandées :
- lourd : grenades et roquettes du joueur et des ennemis, écrasement et barrage des colosses ;
- léger : pistolet, mitraillette, pompe, raté de roquette, vapeur ;
- frappe de bouclier et balles ennemies : aucun dégât, comme aujourd'hui.

Acceptation :
- 200 balles sur un mur de salle généré : destruction.revision inchangé et aucun état pour ce groupe ;
- 1 roquette : passage franchissable ;
- rejeu de trace sans option armor : instantané identique à 673d6b2.

**Gain attendu.** La règle demandée par David. Combinée à MURS-02 : −46 % de pas avec révision et −69 % de gravats sur 900 s de tir ; −66 % et −76 % avec MURS-04.

**Risques.** - Déterminisme : la simulation reste déterministe mais ses trajectoires changent ; les rejeux d'entrées de la démo enregistrés avant la règle divergeront, il faut les versionner.
- Jeu : un ennemi derrière un mur n'est plus délogeable aux balles.
- Décor : clôtures, tuyaux et panneaux rattachés à un groupe blindé deviennent insensibles aux balles avec lui (un mur compte 88 maillages en moyenne, un muret 33).
- Tests : simulation.test.mjs:1507 à réécrire (MURS-12).
- Module générique, sans effet sans option : reprenable tel quel si FERRO adopte un jour la destruction.

**Vérifier par.** node verify-rule.mjs ; node passage.mjs R ; node replay.mjs trace-*.json (les lignes origine doivent avoir la même empreinte) ; node --test checks/destruction.test.mjs dans bench/murs/work.

**Contre-vérification.** Demande explicite de David, règle vérifiée par des mesures à moi (scripts dans bancs/murs-verif/).
- Sans option armor, le module modifié est équivalent à l'original : 12 000 appels hit/blast aléatoires sur les mondes 3, 10 et 16, 0 résultat différent, instantanés et colliders égaux (v2.mjs).
- Avec la règle, mondes 1 à 4 : 60 plombs de pompe sur chacun des 208 à 274 groupes blindés, tous déviés, aucun état créé ; 3 jets de vapeur ne changent aucun mur sur 30 ; une roquette perce 30 murs sur 30.
- verify-rule.mjs rejoué : mêmes résultats que l'auteur.
- Les 6 appelants de damageScenery sont exacts (953, 1080, 1121, 1129, 1132, 1159). La vapeur et l'écrasement n'ont pas de kind explicite : il est déduit à simulation.js:934, ce qui rend le test kind!=='steam' correct.

Correction à apporter : classer lourd par kind==='grenade'||kind==='rocket' plutôt que « tout sauf vapeur » (voir MURS-V2). C'est le mot de David, et l'écrasement d'un colosse ouvre aujourd'hui un garde-corps d'arène dans le prototype.

Limite du prototype : la graine de chipsFor n'est pas modifiée (seule celle de l'événement l'est), donc les éclats de tirs répétés gardent les mêmes vitesses.

**Gain corrigé.** Sur les 16 traces « A » de l'auteur (3 360 s, tirs, arènes, repos), rejouées avec le module final et la fonction breachArmor : 275 pas avec révision ramenés à 104 (−62 %), gravats 5 603 ramenés à 1 629 (−71 %). Murs seuls au sens strict : −16 % (chiffre de l'auteur, non remesuré).

### MURS-02 — Définir le mur par les données existantes : le drapeau structural ne sert à rien, et les murets comptent plus que les murs
- sévérité haute · catégorie règle-de-jeu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité sans objet · jeu
- lieux : src/world.js:1206; src/world.js:1277; src/world.js:1406; src/world.js:1493; src/world.js:307; src/world.js:328; src/world.js:112-126; src/world.js:1352-1353; src/world.js:1363

**Preuve.** - structural:true est posé en world.js:1206 (toute l'arène, sol compris), 1277 (socle, bord de terrain, pièges, conduites), 1406 (ateliers) et 1493 (cloisons de renfort). Aucun module ne le lit sur un maillage, et les murs de salle ne le portent pas (world.js:307 : boîte de matière 3, 0,66 m d'épaisseur, sans catégorie).
- Le seul marquage utile est le genre calculé en world.js:1352 : ceiling donne roof ; arena_pier donne support ; mince (moins de 1,2 m), long (plus de 2,5 m) et haut (plus de 1,8 m) donne wall ; haut et étroit donne support ; le reste donne prop.
- Résistances (1353) : wall 18, roof 16, support 14, prop 6, arbre 7, conduite 3, décor sans collision 1.

Recensement sur 39 mondes :
- genre wall : 923 murs de salle, 413 linteaux et cloisons de matière 0, 156 cages d'ascenseur, 468 hautes enceintes, 161 cloisons de renfort (v1 et historiques seulement) ; soit 40 à 73 par monde ;
- toits 689, piliers porteurs 910 ;
- murets (catégorie boundary, genre prop, résistance 6) : 5 638, soit environ 145 par monde.

Part des ruptures mesurées : murets 26,4 %, murs 14,9 %, toits et piliers 3,1 %. Aucune vitre n'existe.

**Cause.** Le générateur ne nomme pas ses murs : un mur de salle n'a ni catégorie ni drapeau, et le genre wall vient d'un test de proportions. Les murets, qui sont des murs pour l'œil, tombent dans le genre prop à cause de leur hauteur.

**Proposition.** Ne rien ajouter au monde (MURS-06). Classer par une fonction pure dans simulation.js :

const breachArmor=(g,world)=>{
  const c=g.colliders.length?world.colliders[g.colliders[0]]:null, m=c?world.meshes[c.mesh]:null;
  /* classe 2 : voir MURS-04 */
  return g.kind==='wall'||g.kind==='roof'||!!m&&(m.category==='boundary'||g.kind==='support'&&Math.min(c.maxX-c.minX,c.maxZ-c.minZ)>=.6)?1:0;
};

Blindés (classe 1) : murs de salle, linteaux, cages d'ascenseur, cloisons de renfort, hautes enceintes, toits, piliers porteurs, piles d'arène, colonnes de ruine, murets.

Restent cassables par tout : caisses et piles d'équipement, couverts de combat et d'arène, machines, rochers, lampadaires et poteaux fins, arbres, conduites, végétation.

Acceptation : 206 à 274 groupes blindés par monde de la campagne v2 ; aucun arbre, aucune conduite, aucun couvert dans la liste.

**Gain attendu.** Rend la règle lisible : le bâti tient, le mobilier casse. Les murets font passer le gain de −18 % à −46 % de pas avec révision.

**Risques.** - Le critère de section (0,6 m) repose sur les dimensions actuelles : piliers de 0,85, piles de 2,2, colonnes de 0,65, contre des poteaux de 0,16 à 0,45. Un nouveau gabarit de pilier devra être revu.
- Les clôtures posées sur les murets appartiennent au groupe du muret (world.js:1363) et deviennent insensibles aux balles.

**Vérifier par.** node def-count.mjs (fourchettes par monde et catégories ajoutées par chaque définition) ; node causes.mjs (part de chaque famille).

**Contre-vérification.** Recensement refait sur les 18 mondes v2 (v1.mjs), cohérent avec l'auteur : 904 groupes wall (50 par monde), 318 toits, 2 602 murets (145 par monde), 420 piliers blindés et 582 poteaux fins laissés cassables.
- Aucun segment de mur de salle (matière 3, sans catégorie) n'échappe au blindage.
- Aucun groupe à collider ne tombe en classe 2 : pas de mur rendu indestructible par accident.
- world.js:1352-1353 relu : conforme.

Deux réserves :
- Les groupes blindés emportent 163 446 maillages, dont 55 808 touffes d'herbe, 13 555 cailloux, des fougères, 7 777 poteaux et 4 218 lisses de clôture. Tout cela devient insensible aux balles, ce qui écorne « autre décor ok ». À l'origine ces éléments ne partaient qu'avec le cube de 0,97 m coupé dans le muret.
- 56 éléments de matière 0 hauts et minces (sur 18 mondes) ressemblent à des cloisons et restent cassables.

Décision à faire trancher par David : il a dit « murs » ; les murets portent l'essentiel du gain de fluidité.

### MURS-03 — Fluidité : la règle retire 46 à 66 % des reconstructions du monde en combat et 69 à 76 % des gravats
- sévérité haute · catégorie saccade · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/game.js:152-156; src/simulation.js:229-231; src/simulation.js:1125-1134; src/destruction.js:272; src/simulation.js:64

**Preuve.** - Chaque pas avec révision déclenche renderer.updateWorld (game.js:152-156 ; 24 à 31 ms selon LOOP-04) et un refreshNav global (simulation.js:231).
- Un coup de pompe lance 7 ou 14 appels hit séparés. Au monde 3, 50 tirs produisent 81 révisions sur 42 pas, et 94 % des tirs de pompe du monde 2 déclenchent une révision.

Pas avec révision par minute, rejeu exact :
- pompe monde 3 : 28,0 à l'origine, 20,0 avec la structure, 7,3 avec les murets, 6,0 avec relief et sols ;
- pompe monde 10 : 32,0, 19,3, 15,3, 12,7 ;
- mitraillette en arrosage, monde 3 : 17,3, 16,3, 10,3, 5,0 ;
- pistolet monde 1 : 4,7, 4,7, 4,0, 1,3.

Cumul sur 900 s : 245 pas à l'origine, 200 avec la structure, 133 avec les murets, 84 avec relief et sols. Gravats émis : 5093, puis 3447, 1601 et 1197.

La réserve de 128 gravats sature à l'origine (moyenne 118 à 126 au pompe) ; avec la règle la moyenne passe de 76,8 à 38,6 à la mitraillette du monde 3.

Limite : au pistolet et à la mitraillette sur 90 s, aucun mur n'atteint 9 impacts sur le même groupe. Le gain vient alors des murets, du relief et des sols, pas des murs.

**Cause.** Chaque groupe rompu, même un marquage au sol de 2 cm, reconstruit tout le rendu statique et toute la navigation. Les armes à balles rompent en continu des groupes de résistance 1 à 18.

**Proposition.** Appliquer MURS-01, MURS-02 et MURS-04, puis garder ces compteurs comme critère de non-régression dans un test de simulation, sur une trace de pompe de 90 s au monde 3 :
- au plus 12 pas avec révision par minute ;
- au plus 250 gravats émis.

Ce gain s'ajoute aux correctifs du premier tour (révision locale LOOP-04, RCPU-02, SIM-01, IA-02) : eux réduisent le coût d'une révision, la règle en réduit le nombre.

**Gain attendu.** Mesuré : −46 % de pas avec révision avec les murets, −66 % avec relief et sols, sur 900 s de tir ; −69 % et −76 % de gravats. Estimé d'après les 24 à 31 ms du premier tour : au pompe, environ 0,8 à 1 s d'à-coups par minute ramenée à 0,2 à 0,4 s.

**Risques.** - Les comptages sont déterministes, mais le pilote automatique tire peu (2 tirs par seconde à la mitraillette) : un joueur réel produira plus de révisions dans les deux cas.
- Aucun temps absolu n'est fiable sur cette machine chargée ; je ne donne pas de gain en millisecondes mesuré.

**Vérifier par.** node trace.mjs 2 1 90 A puis node replay.mjs trace-w03-a1-A.json : comparer les lignes origine et R5. Boucle fermée : node trace.mjs 2 1 90 B R3.

**Contre-vérification.** Comptages reproduits.
- replay.mjs rejoué sur la trace pompe monde 3 : 28,0 / 20,0 / 7,3 / 6,0 pas avec révision par minute, comme annoncé.
- Mon rejeu avec le module final et breachArmor (pas le prototype à listes) donne 9 pas et 153 gravats sur cette trace, soit la ligne R5 de l'auteur ; 15 pas sur la trace mitraillette arrosage monde 3.
- game.js:152-156 relu : un pas avec révision appelle bien renderer.updateWorld.

Réserves :
- Aucun temps mesuré ; le gain en secondes est une multiplication par les 24 à 31 ms du premier tour.
- Ce gain se recouvre avec LOOP-04 et l'axe DRAW : une fois la révision locale livrée, le coût d'une révision baisse et le bénéfice de la règle en temps d'image devient faible. Il reste entier pour les gravats et les points de reprise.
- Au sens strict de David (murs seuls), le gain est de −16 %.

**Gain corrigé.** −62 % de pas avec révision et −71 % de gravats sur 3 360 s (16 traces, règle finale complète) ; −53 % si les sols restent cassables ; −16 % pour les murs seuls. Gain en millisecondes : estimé, non mesuré.

### MURS-04 — Une balle de pistolet fait tomber une colline de 9 m ; relief et sols doivent être indestructibles
- sévérité haute · catégorie bug · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/world.js:160-163; src/world.js:1367; src/destruction.js:153-156; src/world.js:1228-1231

**Preuve.** - Collines, falaises et strates d'arrière-plan sont générées en world.js:160-163 comme simple décor, sans collider. demolitionMetadata les range dans des groupes decor de résistance 1 (1367).
- Dans compile(), un maillage non aligné sans collider disparaît en entier dès qu'une coupe touche sa boîte (destruction.js:155).
- Mesure (relief.mjs) : un hit de puissance 2 sur une colline de 9 × 5,1 × 8 m la supprime et crée un gravat de 9 m ; une falaise de 8,8 × 5,1 × 9,4 m s'effondre avec son groupe.
- 28 collines ou falaises par monde ; 9,7 % des ruptures mesurées, toutes dues aux balles du joueur.
- Marquages et dallages au sol (incrustations d'arène, caniveaux, seuils, bandes de danger, sentiers) : 20,5 % des ruptures, causées par la vapeur (35), les ennemis (32), les boss (22) et le joueur (17). En arène, les attaques de boss ne cassent que cela.

**Cause.** Tout maillage sans collider et non rattaché devient un groupe decor de résistance 1. Rien ne distingue une touffe d'herbe d'une colline de 9 m, ni un objet posé d'un marquage peint au sol.

**Proposition.** Ajouter la classe 2 (jamais) à breachArmor, calculée avant la classe 1 :

const RELIEF=['hill','cliff','cliff_stratum'], FLOOR=['arena_inlay','floor_drain','threshold','hazard_marking','trail','ground_patch','leaf_litter','jump_landing','dock_warning','trap_warning','arena_path_mark','trap_plate'];
if(meshes.some(q=>RELIEF.includes(q.category)) || !c&&meshes.every(q=>FLOOR.includes(q.category)||q.s[1]<=.06&&!(q.r||[]).some(v=>Math.abs(v)>.01))) return 2;

Dans damage(), une explosion sur un groupe de classe 2 n'émet pas d'éclats ; une balle en émet.

Acceptation :
- 1 balle puis 1 roquette sur une colline : destruction.revision inchangé ;
- en arène, 7 écrasements de colosse : au plus 1 révision ;
- 387 à 440 groupes de sol et 20 à 31 groupes de relief par monde.

**Gain attendu.** Supprime une absurdité visible. Fait passer le gain de −46 % à −66 % de pas avec révision. En arène : 3 à 6 révisions par 2 minutes ramenées à 1 ou 2.

**Risques.** - Le critère d'épaisseur (6 cm, non tourné) attrape 2 maillages hors sol sur environ 990 au monde 3 (une ailette de réacteur, un boulon), aucun aux mondes 1 et 2.
- Les sols ne gardent plus de trace des explosions : compenser par une marque de brûlure côté rendu (MURS-07).
- Aucun test existant ne casse relief ou marquages.

**Vérifier par.** node relief.mjs ; node never-cats.mjs ; node replay.mjs trace-w01-a4-A-arene.json (ligne R5).

**Contre-vérification.** Relief : confirmé. relief.mjs rejoué, une balle de puissance 2 supprime une colline de 9 × 5,1 × 8 m et effondre une falaise. C'est un bug, à corriger sans condition.

Sols : à nuancer. La classe « jamais » retire toute trace d'explosion au sol, ce qui est une perte visible et contredit « autre décor ok ». Mesure sur les 16 traces (v4.mjs) : sols en classe 2, −62 % ; sols en classe 1 (lourd seulement), −59 % ; sols inchangés, −53 %. La classe 1 garde presque tout le gain et laisse grenades et roquettes marquer le sol (voir MURS-V4).

Le critère d'épaisseur (6 cm, non tourné) attrape surtout des boulons : 1 698 maillages bolt et 317 de matière 5 sur 18 mondes dans des groupes de classe 2. Sans conséquence visible, mais plus que les « 2 maillages » annoncés pour le monde 3.

**Gain corrigé.** Relief seul : gain modeste (R3 vers R4 : 11 à 9 pas sur la trace pompe monde 3). Sols : 9 points de plus en classe 2, 6 points en classe 1.

### MURS-05 — Portes verrouillées : 9 balles contournent le mécanisme
- sévérité moyenne · catégorie règle-de-jeu · effort S · gain qualitatif
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:179; src/simulation.js:906-914; src/simulation.js:916-918; src/simulation.js:1939

**Preuve.** - Les portes ont 18 points de vie (simulation.js:179) et damageScenery les entame avec n'importe quelle puissance (906-914) : 9 balles ou 4 plombs détruisent une porte dont le mécanisme n'a pas été trouvé.
- Mesure (verify-rule.mjs) : 40 balles de mitraillette détruisent la porte à l'origine ; avec le prototype, points de vie intacts et 1 roquette la détruit.
- La progression ne dépend pas de ce contournement : les 3 mécanismes sont atteignables portes fermées dans les 75 mondes vérifiés, et la victoire exige de toute façon les 3 mécanismes (simulation.js:1939).
- Les commandes gardent leur coque de 12 points (178, 916-918) : 6 balles sur une commande l'activent.

**Cause.** Les portes sont hors de FDestruction et n'ont qu'un compteur de points de vie commun à toutes les sources. Avec des murs blindés, elles deviendraient le point faible de chaque cloison.

**Proposition.** Dans la boucle des portes de damageScenery, avant la ligne 908 :

if(!heavy){ /* émettre ricochet, matière metal */ continue; }

Garder les 18 points de vie : une roquette ou une grenade au contact suffit. Ne pas toucher aux coques des commandes ni aux pièges.

Acceptation :
- 60 balles sur une porte fermée : hp===18 ;
- 1 roquette : destroyed===true et événement doorOpen ;
- le format doorDamage du point de reprise reste le même.

**Gain attendu.** Cohérence de la règle : plus de porte en point faible, les mécanismes retrouvent leur rôle avant les armes lourdes.

**Risques.** - Un joueur habitué à ouvrir les portes à la mitraillette devra chercher la commande ; l'indice de MURS-07 le lui dit.
- Les sauvegardes où une porte est déjà entamée restent valides.

**Vérifier par.** node verify-rule.mjs (lignes porte) ; test à ajouter dans checks/simulation.test.mjs.

**Contre-vérification.** simulation.js:179 (18 points de vie) et 906-914 relus. verify-rule.mjs rejoué : à l'origine 40 balles détruisent la porte ; avec la règle, 18 points intacts, 40 ricochets, puis 1 roquette la détruit. Dans le correctif, le test de classe vient bien après le test de distance.

Effet de bord à connaître : la vapeur, classée légère, n'entame plus les portes non plus.

C'est une extension de la demande (David a parlé des murs, pas des portes) : à faire valider, d'où P2.

### MURS-06 — Ne rien écrire dans l'objet monde : un champ casse les sauvegardes ou 8 tests à empreintes dorées
- sévérité critique · catégorie architecture · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité identique · jeu
- lieux : src/simulation.js:237-241; src/simulation.js:1967; src/destruction.js:135; checks/campaign-world.test.mjs:178-203; src/game.js:113-121; src/simulation.js:120; src/simulation.js:2020

**Preuve.** - L'empreinte de simulation hache JSON.stringify d'une liste qui contient world.destructibles en entier (simulation.js:237-241), et restore() exige l'égalité (1967).
- Témoin mesuré : ajouter armor:'heavy' aux groupes wall change l'empreinte (11olkp9 devient 17ew10l) et le point de reprise est refusé. Le repli de game.js:120 recharge alors le monde sans équipement (défaut LOAD-01).
- Ma première version posait une liste w.armored à côté de destructibles : l'empreinte de simulation tient, mais 8 tests de checks/campaign-world.test.mjs échouent (lignes 178-203), car ils comparent le SHA-256 de JSON.stringify(world) à des valeurs dorées.
- Version finale : world.js identique octet pour octet (cmp) ; empreinte, signature de destruction (destruction.js:135) et JSON du monde identiques ; restauration croisée origine vers règle et règle vers origine acceptée hors gravats.
- Bénéfice mesuré avec le pilote scripté : 1 point de reprise accepté sur 24 à l'origine, 18 sur 24 avec la règle. La règle émet moins de gravats, donc moins de recouvrements refusés par simulation.js:2081.

**Cause.** Deux empreintes protègent les mondes : celle de la simulation, pour les points de reprise, et celle des tests, pour les mondes historiques. Tout champ énumérable ajouté au monde ou à ses groupes en modifie au moins une.

**Proposition.** - Garder world.js inchangé.
- Passer la classification en option : FDestruction.create(world,{armor:breachArmor}), aux deux endroits où simulation.js crée un contrôleur (lignes 120 et 2020).
- Ne changer ni kind, ni strength, ni l'ordre des groupes.
- Ne pas modifier le format de l'instantané.

Acceptation :
- snapshot().fingerprint égal à celui de 673d6b2 sur les mondes 3 et 10 ;
- un instantané de 673d6b2 sans gravats est restauré par la nouvelle version, et inversement ;
- checks/campaign-world.test.mjs reste vert sans retouche.

**Gain attendu.** Aucune sauvegarde invalidée, aucun test doré à régénérer. En prime : 18 points de reprise acceptés sur 24 au lieu de 1, et des instantanés plus légers de 5 à 13 %.

**Risques.** - La règle ne remplace pas le correctif LOAD-01 : 6 points sur 24 restent refusés, surtout au pompe.
- Si un lot de contenu change un jour la génération (MURS-10), l'empreinte changera : réparer d'abord le repli de game.js:120.

**Vérifier par.** node save-compat.mjs ; node checkpoints.mjs ; cmp work/src/world.js avec l'original ; node --test checks/campaign-world.test.mjs.

**Contre-vérification.** Le cœur est confirmé.
- Empreinte de simulation et instantané initial identiques entre 673d6b2 et la copie à règle sur 8 mondes (v2 1, 5, 12, 18 ; v1 3, 12 ; historiques 1 et 3), mesure à moi.
- world.js identique octet pour octet (cmp).
- save-compat.mjs et checkpoints.mjs rejoués : mêmes résultats, 1 point de reprise accepté sur 24 à l'origine, 18 sur 24 avec la règle.

Une affirmation est réfutée : les 8 tests à empreintes dorées de checks/campaign-world.test.mjs:178-203 ne sont pas cassés par le champ ajouté. Ils sont déjà rouges sur une copie intacte de 673d6b2 (38 verts sur 46, Node 24.18 sur ce Mac). Exemple : create(1,2) donne 44f171cb… au lieu de 360ff380… attendu. Le critère « campaign-world reste vert sans retouche » est donc inatteignable ici ; il faut le remplacer par « mêmes échecs que la référence » (voir MURS-V1).

La recommandation reste bonne : le condensé porte sur JSON.stringify(world), donc tout champ le changerait.

**Preuve corrigée.** campaign-world.test.mjs : 38 sur 46 sur 673d6b2 intact comme sur la copie à règle ; les 8 échecs préexistent à tout changement.

### MURS-07 — Retour vif quand une balle frappe un mur blindé : étincelles, éclats, marque, viseur et indice
- sévérité moyenne · catégorie ressenti · effort M · gain qualitatif
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · jeu
- lieux : src/destruction.js:190-195; src/destruction.js:240; src/simulation.js:1132; src/simulation.js:524-527; src/game.js:199-203; src/game.js:714; src/game.js:73; src/style.css

**Preuve.** - Aujourd'hui un impact sous le seuil émet déjà materialImpact et jusqu'à 3 éclats non structurels (destruction.js:190-195, 240), plus 1 à 3 particules (simulation.js:1132).
- Le son est faible : materialCue calcule l'énergie comme la puissance divisée par 18 (audio.js:276), soit 0,11 pour une balle.
- La graine des éclats dépend de revision (destruction.js:191). Sans révision, des tirs répétés au même endroit donneraient des éclats identiques.
- Le viseur n'a qu'un état, hit (game.js:714). Les messages passent par toast (game.js:73).
- Prototype : 80 balles sur un mur donnent 80 materialImpact marqués deflected et 80 événements ricochet, limités à un par 90 ms ; aucun état sauvegardé.
- Non prototypé : marques, viseur, message et son (aucun passage en navigateur).

**Cause.** Le jeu n'a pas d'état « coup refusé » : un mur qui ne casse pas ressemblerait à un impact raté, sans dire pourquoi.

**Proposition.** 1) destruction.js : l'événement dévié porte deflected:true et une graine dépendant de la position, par exemple seed + Math.imul(round(x*97)+round(y*193)+round(z*389), 2654435761), pour varier les éclats sans compteur à sauvegarder.

2) simulation.js : dans damageScenery, si result.deflected, r===0 et le délai de 0,09 s est écoulé : emit('ricochet',{x,y,z,material,count}) et particles(x,y,z,5,4).

3) game.js, état local jamais sauvegardé, sur l'événement ricochet :
- viseur : classe deflect pendant 0,14 s (gris, légèrement réduit) ;
- marque : anneau de 32 boîtes sombres de 7 cm posées sur la face touchée, effacées après 20 s ;
- indice : après 4 ricochets en 2,5 s, si aucun message n'est affiché et 2 fois par session au plus. Texte « BLINDAGE · les balles ne percent pas les murs. Il faudra des explosifs. » ou, si le joueur a une arme lourde, « BLINDAGE · seuls les explosifs ouvrent ce mur — lance-grenades ».

4) Son : MURS-08.

Acceptation :
- une rafale de 16 balles donne au moins 10 événements ricochet et un seul message ;
- pas plus de 64 éclats vivants (MAX_CHIPS) ;
- aucun champ nouveau dans snapshot().

**Gain attendu.** Le joueur comprend en une rafale que le mur est blindé et quelle arme l'ouvre ; le tir reste gratifiant.

**Risques.** - Les éclats cosmétiques sont simulés : même volume qu'aujourd'hui pour les impacts sous le seuil.
- Lisibilité sur téléphone à vérifier pour la classe du viseur.
- 32 instances de marques au plus ; les placer dans game.js, pas dans FEffects.build, dont les tests exigent la pureté.

**Vérifier par.** node verify-rule.mjs (compte des événements) ; test de simulation sur l'événement ricochet et son délai ; vérification manuelle en navigateur du viseur et du message.

**Contre-vérification.** Conception cohérente, non prototypée côté jeu, non vue en navigateur.

Défaut mesuré dans le prototype : l'événement ricochet part pour toute balle déviée, y compris sur la classe 2 et sur le décor rattaché. Sur 3 traces rejouées (v2.mjs), le maillage le plus proche de l'impact n'est le corps du mur que pour 158 balles sur 321, 86 sur 225 et 66 sur 178. Le reste : garnitures métalliques, clôtures, mécanismes de porte, collines (8 à 10 par trace), caniveaux, sentiers, et 9 à 12 impacts de matière dirt (herbe rattachée aux murets). Tel quel, tirer sur une colline ou dans l'herbe ferait tinter le métal et afficherait « BLINDAGE ». Correctif en MURS-V3.

Autres points :
- game.js:199 appelle handMotion.impulse(e.name) pour tout événement non traité ; motion.js:36 ne connaît pas ricochet. À vérifier que c'est sans effet.
- À la mitraillette (0,125 s entre deux tirs, délai de 0,09 s), chaque balle émet un ricochet : 8 par seconde.

### MURS-08 — Son de ricochet sans toucher à la banque PCM
- sévérité basse · catégorie audio · effort S · gain qualitatif
- contre-vérification : **plausible**, priorité P3 · qualité meilleure · moteur et jeu
- lieux : src/audio.js:11-13; src/audio.js:164-170; src/audio.js:257-271; src/audio.js:272-279; src/audio.js:481-483; checks/audio.test.mjs:306; src/game.js:199-203

**Preuve.** - audio.js est identique dans METAL 673d6b2 et FERRO 248043a (45 997 octets).
- La banque est figée par un test : checks/audio.test.mjs:306 exige 64 tampons PCM. Ajouter un nom à effectNames (audio.js:11-13) le casserait.
- game.js:201 appelle audio[e.name] s'il existe : une méthode ricochet suffit, aucun autre branchement.
- pcm() accepte un facteur de vitesse borné entre 0,65 et 1,4 (audio.js:262). effectEvent limite la cadence par nom (audio.js:164-170).

**Cause.** Le seul son d'impact est proportionnel à la puissance du coup. Une balle refusée sonne donc plus faible qu'une balle qui entame, l'inverse de ce qu'il faut pour un ricochet.

**Proposition.** Ajouter une méthode composée de tampons existants, dans l'objet api à côté de materialImpact (ligne 481) :

ricochet: function(value){ var e=effectEvent('ricochet',value,.07); if(!e)return; var g=e.level; pcm('impact:metal',.30*g,e.pan,e.event,1.34); if(!value||value.material!=='metal') pcm('impact:stone',.26*g,e.pan,e.event,1.08); pcm('click',.12*g,e.pan,e.event,1.25); }

Ajouter ricochet:19 aux portées de soundscape.js:5.

Plus tard, si David veut un vrai sifflement : un tampon dédié de 0,22 s (glissement de 2 600 à 1 500 Hz), en portant le test de 64 à 66.

Acceptation : la banque reste à 64 tampons ; sous 8 ricochets par seconde, stats.fxSkipped croît et aucune voix du joueur n'est volée.

**Gain attendu.** Un tintement clair distinct de l'impact sourd, pour 0 octet de PCM et environ 250 octets de code.

**Risques.** - Ajout pur : un jeu qui n'appelle pas ricochet garde exactement le son d'avant (règle de compatibilité de FERRO).
- Niveaux à régler à l'oreille ; non écouté.

**Vérifier par.** checks/audio.test.mjs inchangé et vert ; un test nouveau qui appelle api.ricochet 20 fois en 1 s et borne les voix ; écoute manuelle.

**Contre-vérification.** Faits vérifiés :
- ~/Projects/ferro n'existe pas ; le clone 248043a de scratchpad/wf2/ferro/ferro a un audio.js identique à celui de METAL (cmp, 45 997 octets).
- checks/audio.test.mjs:306 exige bien 64 tampons.
- pcm(name, level, pan, event, rate, bus) et le retour de effectEvent ({level, pan, event}) correspondent à l'appel proposé.

Rien n'a été écouté.

Variante sans toucher FERRO : dans la table d'alias de game.js:201, router ricochet vers audio.materialImpact avec material:'metal', une énergie forcée (1,2 à 1,4) et mass:.15. La vitesse plafonne alors à 1,18 au lieu de 1,34. À préférer si la méthode n'est pas jugée générique pour deux jeux.

À vérifier : ce que rend soundscape.event pour un nom absent de la table des portées.

### MURS-09 — Progression : aucun monde n'exige de percer, mais le calendrier des armes lourdes n'est pas celui de l'énoncé
- sévérité moyenne · catégorie règle-de-jeu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité sans objet · jeu
- lieux : src/game.js:12; src/game.js:122; src/economy.js:56; src/world.js:1592; src/simulation.js:29; src/world.js:1508; src/simulation.js:242-251; src/world.js:1739-1767

**Preuve.** Calendrier réel :
- Campagne v2, celle de toute nouvelle partie (game.js:12 et 122) : bossReward donne [pompe, mitraillette, lance-grenades, lance-grenades, rien, lance-roquettes] (economy.js:56), confirmé par unlock=[2,1,6,3,0] (world.js:1592). Le joueur n'a donc aucune arme lourde aux mondes 1 à 3.
- CAMPAIGN_GEAR (simulation.js:29 ; grenade au monde 13, roquette au monde 16) ne vaut que pour les sauvegardes v1.
- Secteurs historiques : le 1 démarre à la mitraillette seule, les 2 et 3 avec des roquettes (world.js:1508).

Accessibilité (reach.mjs) : 75 mondes sur 75 sont finissables sans aucune destruction, portes fermées jusqu'à leur mécanisme.

Blocage : les gravats ne bloquent personne (blocked() ne lit que solids, portes et pièges, simulation.js:242-251), et une destruction ne fait qu'enlever des colliders. La règle ne peut donc pas enfermer le joueur.

Outil défaillant : FWorld.validate (world.js:1739-1767) rend ok:false sur 26 mondes sur 39 pour la seule cible shop-0, alors que le point est praticable. Aucun test ne l'appelle.

**Cause.** Deux campagnes coexistent, et l'énoncé décrivait l'ancienne. La génération garantit déjà l'accès à tous les objectifs sans destruction, mais aucun test ne le vérifie portes fermées.

**Proposition.** 1) Ajouter un test checks/breach-progress.test.mjs, repris de reach.mjs, sur les 18 mondes v2, les 3 historiques et 2 graines de plus : tous les objectifs atteints, portes closes tant que leur mécanisme n'est pas atteint.

2) Dans FWorld.validate, tester les cibles avec un rayon de proximité (une case atteinte à moins de 0,9 m) au lieu de la seule case qui contient le point, ou le remplacer par ce nouveau test.

3) Le texte de l'indice (MURS-07) tient compte de l'arsenal réel, pas du numéro de monde.

**Gain attendu.** Garantie écrite que la règle ne bloque personne, y compris pour les graines aléatoires des nouvelles expéditions (game.js:748).

**Risques.** - Ma propagation ne modélise pas les chutes : elle est prudente, une cible atteinte l'est vraiment.
- La cause exacte du faux négatif de validate n'est pas isolée, seulement constatée.

**Vérifier par.** node reach.mjs ; SEEDS=7,424242 ONLY=v2 node reach.mjs ; NOMECH=1 ONLY=v2-w01 node reach.mjs (témoin) ; node unreach.mjs.

**Contre-vérification.** Confirmé :
- economy.js:56 donne bien [pompe, mitraillette, lance-grenades, lance-grenades, rien, lance-roquettes].
- reach.mjs rejoué sur une graine nouvelle (31337) : 9 mondes v2 sur 9 finissables sans percer.
- unreach.mjs rejoué : FWorld.validate échoue bien sur shop-0 alors que le point est praticable.

Réfuté : « aucun test ne le vérifie portes fermées ». checks/campaign-world.test.mjs:57-100 et 207-248 propage déjà avec les portes closes tant que leur mécanisme n'est pas atteint, sans destruction, sur 54 mondes (18 mondes, graines 1, 96 et 2026, 9 450 cibles). Ce test est vert sur la copie à règle.

Le test breach-progress proposé fait donc doublon pour la campagne. Il ne reste à couvrir que les 3 secteurs historiques et la réparation de validate.

**Preuve corrigée.** La garantie d'accessibilité portes fermées existe déjà dans checks/campaign-world.test.mjs.

### MURS-10 — Derrière les murs il n'y a rien : chaque brèche de salle donne sur une chute mortelle, et les murets sont des garde-corps
- sévérité moyenne · catégorie règle-de-jeu · effort M · gain qualitatif
- contre-vérification : **confirmé**, priorité P2 · qualité sans objet · jeu
- lieux : src/simulation.js:324-328; src/simulation.js:138-144; src/world.js:41; src/world.js:112-126; src/world.js:1280-1281

**Preuve.** - land() tue le joueur qui tombe de plus de 1,5 m sur le socle extérieur (simulation.js:324-328, impact supérieur à 6 m/s avec GRAVITY=12).
- Les salles couvertes sont toutes surélevées de 3,2 ou 6,4 m (niveaux en world.js:41).
- Mesure (walls-sides.mjs, mondes 1 à 3) : les 15, 18 et 22 murs de salle dont les deux côtés sont libres donnent tous sur 3,5 ou 6,7 m de vide. Aucun n'est un raccourci de plain-pied.
- Murets : 39 à 46 ouvrent de plain-pied sur le socle (marche de 0,25 m, retour possible par la même ouverture), 64 à 125 bordent une chute de 1,6 à 6,7 m.
- fall.mjs : brèche ouverte puis marche réelle, 8 morts sur 8, raison fall, en 1,05 à 1,57 s.
- Aucun objet n'est caché derrière un mur : toutes les caisses sont atteignables sans destruction (MURS-09).
- Aujourd'hui 3 balles ou 1 coup de pompe perdus suffisent à ouvrir un garde-corps.

**Cause.** Le niveau est conçu sans dépendre de la destruction : percer est un spectacle, jamais un chemin. Les garde-corps ont la résistance d'une caisse (6).

**Proposition.** 1) Blinder les murets (MURS-02) : les garde-corps ne s'ouvrent plus par accident. Ajouter un test de simulation : 30 balles sur un muret de terrasse, puis marche vers le vide, le joueur reste vivant.

2) Garder la chute mortelle. Pas de blocage possible : on ne sort de plain-pied que par une ouverture qu'on peut reprendre.

3) Décision de David : un lot de contenu qui donne un rôle de clé aux explosifs. Caches murées (crédits, armure) et raccourcis de plain-pied, signalés par une fissure, à partir du monde 4 ; objets facultatifs seulement, pour respecter la règle d'accessibilité d'AGENTS.md.

Coût d'une brèche aujourd'hui : 1 roquette sur 12 ou 1 à 3 grenades sur 16 ; en boutique, 36 crédits les 2 roquettes ou les 4 grenades.

**Gain attendu.** Moins de morts absurdes (un garde-corps ouvert par une rafale perdue). Avec le lot de contenu : les armes lourdes deviennent des clés, ce qui donne du sens à la règle.

**Risques.** - Le lot de contenu change la génération, donc les empreintes et les tests dorés : à faire après LOAD-01, avec un numéro de génération.
- Sans ce lot, le joueur qui perce un mur de salle et le franchit meurt : l'indice ne doit pas promettre un passage.

**Vérifier par.** node walls-sides.mjs ; node fall.mjs ; test nouveau « garde-corps intact sous 30 balles ».

**Contre-vérification.** fall.mjs rejoué : 8 morts sur 8, raison fall, en 1,05 à 1,57 s. walls-sides.mjs rejoué : mêmes classes (46 murets de plain-pied, 61 au bord d'une chute de 6,7 m, murs de salle tous sur 3,5 ou 6,7 m de vide). land() relu à simulation.js:324-328.

Élément rassurant ajouté : la simulation n'a aucune entrée de saut (seuls les propulseurs existent), donc le joueur ne peut pas enjamber un muret blindé et rester coincé dehors.

Contre-exemple à la promesse « les garde-corps ne s'ouvrent plus par accident » : au monde 10, un écrasement de colosse classé lourd coupe un muret d'arène surélevé (voir MURS-V2).

Le lot de contenu (caches murées) est hors périmètre et dépend de LOAD-01.

### MURS-11 — Un coup de pompe reconstruit les tableaux de destruction jusqu'à 14 fois dans le même pas
- sévérité basse · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P3 · qualité identique · jeu
- lieux : src/destruction.js:160-178; src/destruction.js:272; src/destruction.js:293; src/simulation.js:1125-1134; src/simulation.js:229-231

**Preuve.** - damage() appelle rebuild() à chaque groupe rompu (destruction.js:272). rebuild reparcourt tous les maillages d'origine (160-178 ; 1,6 à 2,3 ms par impact selon SIM-08).
- fireArsenal lance un hit par plomb (simulation.js:1125-1133) et ne lit les tableaux qu'une fois, dans syncDestruction, après la boucle (1134).
- Entre deux plombs, seuls raycast et pipeAnchored sont appelés, et ils lisent g.active, mis à jour sans délai.

Prototype (lazy.mjs), appels à rebuild :
- pompe monde 3 : 81 puis 42 ;
- pompe monde 10 : 89 puis 48 ;
- pompe monde 2 : 80 puis 29 ;
- mitraillette : 52 puis 52.

Instantané final, colliders et suite des tailles identiques dans les 4 cas. Les temps mesurés ne sont pas concluants sous charge.

**Cause.** Les tableaux meshes, colliders et lights sont recalculés au moment du dégât, alors que leur seul lecteur les consulte une fois par pas.

**Proposition.** Dans destruction.js :
- remplacer rebuild() de la ligne 272 par dirty=true ; revision++ reste immédiat, donc les graines des éclats ne changent pas ;
- ajouter const fresh=()=>{ if(dirty){ dirty=false; rebuild(); } } ;
- appeler fresh() dans les trois accesseurs meshes, colliders et lights ;
- restore() remet dirty à false avant son rebuild.

Acceptation : rejeu de trace avec instantané final et JSON des colliders identiques à 673d6b2 ; au pompe, appels à rebuild inférieurs ou égaux au nombre de pas avec révision.

**Gain attendu.** 46 à 64 % de reconstructions en moins au pompe (mesuré, exact). Gain en temps estimé d'après SIM-08 : 1,6 à 2,3 ms par reconstruction évitée.

**Risques.** - Tout nouveau lecteur des tableaux entre deux plombs doit passer par les accesseurs, ce qui est déjà le cas.
- Avec la règle, le pompe rompt moins de groupes par tir : le gain absolu baisse, l'équivalence reste.
- Complémentaire de la révision incrémentale du premier tour.

**Vérifier par.** node lazy.mjs trace-w03-a1-A.json trace-w10-a1-A.json trace-w02-a1-A.json.

**Contre-vérification.** lazy.mjs rejoué : 81 reconstructions ramenées à 42, 89 à 48 ; état final, colliders et suite des tailles identiques.

Lecteurs des tableaux vérifiés par grep : simulation.js:197 et 231, game.js:143 et 154. Aucun ne lit entre deux plombs. damage() et raycast utilisent g.active et g.solids, mis à jour sans délai.

Gain plus faible qu'annoncé : sur mes passes, le temps total de destruction passe de 116 à 74 ms et de 81 à 62 ms pour 90 s de jeu, soit 0,5 à 1,1 ms par reconstruction évitée (une seule passe, machine partagée), pas 1,6 à 2,3 ms. Avec la règle le pompe rompt moins, donc le gain absolu baisse encore.

À coordonner avec la révision incrémentale (LOOP-04, DRAW), qui réécrit rebuild.

**Gain corrigé.** Environ 20 à 40 ms économisées par 90 s de pompe, soit 0,5 à 1,1 ms par reconstruction évitée.

### MURS-12 — Tests : 260 verts sur 261 avec la règle, un test à réécrire, et rien ne couvre le comportement changé
- sévérité moyenne · catégorie outillage · effort M · gain qualitatif
- contre-vérification : **confirmé**, priorité P1 · qualité sans objet · jeu
- lieux : checks/simulation.test.mjs:1507-1518; checks/destruction.test.mjs:33-42; checks/destruction.test.mjs:139-160; checks/campaign-world.test.mjs:178-203; checks/audio.test.mjs:306

**Preuve.** Version finale, 11 fichiers (destruction, renderer-destruction, progression, checkpoint, campaign-simulation, boss-progression, natural-spawn, brain, armor, soundscape, simulation) : 260 verts sur 261.

Seul échec : checks/simulation.test.mjs:1507-1518, « Repeated Impulse hits retain structural damage across checkpoints; Fracture can break a real prop ». Il crée un groupe de genre wall et exige qu'il soit endommagé puis percé par des balles ; sa seconde moitié (caisse de genre prop au pompe) reste valable.

checks/destruction.test.mjs:33-42 (« ordinary fire accumulates structural damage ») reste vert : il appelle FDestruction sans option, donc sans blindage.

Première version, où seuls les mondes générés étaient marqués : 261 verts sur 261 et world.test.mjs vert. Aucun test existant ne tire donc sur un mur généré.

Non relancés : economy, effects, motion, actors, actor-visibility, music, audio, options, first-person, build (modules non touchés par le prototype) ; world.test et campaign-world sur la version finale, où world.js est identique à l'original.

**Cause.** La règle « tout casse » n'était affirmée que par un test sur un monde factice. Le comportement sur les mondes réels n'avait aucun filet.

**Proposition.** Réécrire simulation.test.mjs:1507 :
- 10 balles de mitraillette sur le mur factice : aucun état wall, destructionRevision===0, au moins un événement ricochet ;
- 1 grenade : révision ;
- garder la moitié sur la caisse.

Ajouter :
1) destruction.test : sans option, comportement d'origine (rejeu d'une courte trace, instantané attendu) ; armure 1, 50 hit sans effet puis blast qui coupe ; armure 2, blast sans effet.
2) simulation.test, monde généré 3 : 200 balles puis 25 coups de pompe sur un mur de salle, un muret et une colline, révision inchangée ; grenade et roquette percent ; porte intacte aux balles.
3) simulation.test : l'empreinte du point de reprise est celle de 673d6b2, pour 3 mondes.
4) breach-progress.test (MURS-09).
5) Budget : sur une trace de pompe de 90 s, bornes de MURS-03.

**Gain attendu.** La règle et ses garde-fous (empreintes, progression, fluidité) deviennent des critères rejouables par npm test.

**Risques.** Les tests tournent dans node:vm, 4,5 à 9 fois plus lents : limiter le test de budget à 90 s simulées et le rejeu à une trace courte.

**Vérifier par.** cd bench/murs/work puis node --test checks/simulation.test.mjs checks/destruction.test.mjs ; sortie de référence dans bench/murs/tests-v2.out.

**Contre-vérification.** J'ai lancé toute la suite sur une copie privée de la version à règle : 414 tests, 404 verts, 10 rouges.
- 1 rouge dû à la règle : checks/simulation.test.mjs:1507, comme annoncé.
- 8 rouges préexistants : les empreintes dorées de campaign-world, rouges aussi sur 673d6b2 intact.
- 1 rouge d'environnement : build.test.mjs, faute de dist/index.html dans la copie.

Le « 260 sur 261 » de l'auteur est donc exact sur ses 11 fichiers, mais campaign-world, qu'il n'avait pas relancé, donne 38 sur 46 avant comme après.

À ajuster dans la liste de tests proposée : breach-progress fait doublon avec campaign-world (MURS-09) ; ajouter un test « écrasement de colosse contre muret d'arène » et un test « ricochet seulement sur classe 1 ».

**Preuve corrigée.** Suite complète sur la copie à règle : 404 sur 414 ; un seul échec imputable à la règle.

### MURS-13 — Mode démo : une séquence « brèche » qui montre la règle sans tuer le pilote
- sévérité basse · catégorie démo · effort S · gain qualitatif
- contre-vérification : **plausible**, priorité P3 · qualité sans objet · jeu
- lieux : src/simulation.js:1106-1124; src/simulation.js:324-328; src/economy.js:56

**Preuve.** - Avec la règle, un muret de plain-pied s'ouvre en 1 grenade (1,8 s) ou 1 roquette (0,1 s) ; un mur de salle en 1 roquette ou 3 grenades (passage-OR.out).
- 39 à 46 murets de plain-pied par monde donnent sur le socle, d'où l'on revient par la même ouverture.
- 64 à 125 murets et tous les murs de salle donnent sur une chute mortelle (MURS-10).
- Le lance-grenades n'existe qu'à partir du monde 4 de la campagne v2 (MURS-09).
- Les rejeux d'entrées enregistrés avant la règle divergeront, puisque les murs ne cèdent plus aux balles.

**Cause.** La règle n'est visible que si l'on voit d'abord une arme légère échouer, puis une arme lourde réussir sur le même mur.

**Proposition.** Fournir au mode démo un temps fort de 6 à 8 s :
1) choisir le groupe blindé le plus proche dont les deux côtés sont au même niveau, avec le test de walls-sides.mjs (sim.ground de part et d'autre, écart de 0,42 m au plus) ;
2) 12 balles de mitraillette : étincelles, ricochets, viseur gris ;
3) changement d'arme, 1 grenade ou 1 roquette ;
4) traversée, puis retour.

Interdire au pilote de franchir une brèche si le sol de l'autre côté est plus bas de 1,5 m ou plus. Lancer la démo sur un monde d'indice 3 ou plus, ou avec un équipement de démo. Inscrire dans l'en-tête des rejeux un numéro de règles, par exemple breachRule:1.

**Gain attendu.** La démo montre la nouvelle règle et une destruction spectaculaire sans risque de mort par chute.

**Risques.** Dépend du mode démo, traité par un autre axe ; le coût se limite au choix du mur et au garde-fou de chute.

**Vérifier par.** Test de simulation du pilote : sur 3 mondes, la séquence se termine joueur vivant, avec au moins 1 ricochet et 1 révision.

**Contre-vérification.** Rien à mesurer : la proposition dépend de l'axe DEMO. Ses prémisses sont confirmées par mes rejeux (passage : 1 roquette ou 3 grenades pour un mur de salle ; murets de plain-pied ; chute mortelle ailleurs).

Le garde-fou « ne pas franchir si le sol est plus bas de 1,5 m » est indispensable. Le pilote doit partir d'un monde d'indice 3 ou plus pour avoir le lance-grenades.

## Constats ajoutés par le contre-vérificateur

### MURS-V1 — Huit tests à empreintes dorées sont déjà rouges sur 673d6b2 intact : la référence de non-régression est fausse
- sévérité haute · catégorie outillage · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité sans objet · jeu
- lieux : checks/campaign-world.test.mjs:16-22; checks/campaign-world.test.mjs:178-203; src/world.js

**Preuve.** Copie intacte de 673d6b2 (src, checks, tools) dans bancs/murs-verif/orig : node --test checks/campaign-world.test.mjs donne 38 verts sur 46.

Les 8 rouges : 6 « legacy seed …: exact pre-campaign world fingerprint », « campaign mode is strictly opt-in… » et « the first three campaign worlds preserve historical geometry… ».

Contrôle hors node:vm (v3.mjs, domaine principal) : sha256(JSON.stringify(FWorld.create(1,2))) vaut 44f171cb3875…, le test attend 360ff380dafd… (checks/campaign-world.test.mjs:19).

Le commit 673d6b2 modifie world.js (66 lignes) et ajoute 26 lignes au test sans toucher legacyHashes. Node 24.18.0, macOS arm64. Je n'ai pas pu vérifier sur david-pc : l'écart peut venir du commit ou de la plateforme.

L'auteur de MURS a attribué ces 8 échecs à son champ world.armored ; ils existent sans lui.

**Cause.** Soit le commit 0.8 a changé la génération des secteurs historiques sans régénérer les condensés, soit les condensés dépendent de la plateforme (fonctions mathématiques de V8). Dans les deux cas npm test n'est pas vert sur ce Mac avant tout changement.

**Proposition.** Avant d'implémenter la règle, Codex lance npm test sur un checkout intact, sur la machine de build, et archive la liste des échecs.
- Si les 8 tests y sont rouges aussi : décider avec David entre régénérer legacyHashes (la génération 0.8 est assumée) ou corriger world.js pour retrouver les mondes historiques.
- S'ils sont verts là-bas : chercher la source de non-portabilité dans world.js (Math.sin, Math.pow, tri non stable), car l'empreinte de simulation.js:237 protège aussi les points de reprise entre machines.

Critère d'acceptation de la règle : même ensemble d'échecs que la référence, moins simulation.test.mjs:1507 réécrit.

**Gain attendu.** Une référence de tests fiable : aucune régression imputée à tort à la règle, et détection d'un éventuel défaut de portabilité des mondes entre machines.

**Risques.** Régénérer les condensés entérine la génération actuelle. Si l'écart vient de la plateforme, les points de reprise ne sont pas portables d'une machine à l'autre, ce qui dépasse l'axe MURS.

**Vérifier par.** cd bench/murs-verif/orig puis node --test checks/campaign-world.test.mjs ; node bench/murs-verif/v3.mjs ; même commande sur david-pc.

### MURS-V2 — Classer lourd par « grenade ou roquette » : l'écrasement d'un colosse ouvre un garde-corps d'arène dans le prototype
- sévérité moyenne · catégorie règle-de-jeu · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/simulation.js:932-934; src/simulation.js:953; src/simulation.js:1717-1718; src/simulation.js:1071; src/simulation.js:1079

**Preuve.** Le prototype passe kind!=='steam' à damageScenery (rule-v2.diff, ligne 953 d'origine). Or simulation.js:934 donne kind='boss' à l'écrasement (appel de la ligne 1718, sans kind) et 'blast' à tout autre souffle anonyme : tous deviennent lourds.

Mesure (passage-d.mjs, monde 10, copie à règle, joueur au pistolet à 3 m d'un muret d'arène) : à t=3,08 s, événement explosion de propriétaire 119 et de kind boss, puis materialBreak sur solid-12930. Ce groupe est un muret d'enceinte de classe 1, à y=3,2 m, de 10 × 1 × 0,52 m. Le passage s'ouvre quelle que soit l'arme du joueur.

Les murets d'arène surélevée bordent une chute mortelle (MURS-10).

Les traces de l'auteur ne contiennent que 7 écrasements, aucun près d'un muret : le cas lui a échappé.

Mon rejeu des 16 traces donne les mêmes totaux avec « lourd = grenade ou roquette » qu'avec la règle de l'auteur : 104 pas avec révision, 1 629 gravats.

**Cause.** La classe lourde est définie par exclusion (tout sauf la vapeur) et non par la liste que David a donnée (grenade et roquette).

**Proposition.** Dans explode, passer heavy = kind==='grenade'||kind==='rocket' à damageScenery.

Conséquences :
- grenades et roquettes du joueur et des ennemis : lourdes ;
- barrage de roquettes des colosses : lourd, car il passe par spawnProjectile('rocket') ;
- écrasement (kind 'boss'), vapeur et souffles anonymes : légers.

Si David veut que l'écrasement casse les piles d'arène, l'ajouter explicitement, mais jamais sur la catégorie boundary.

Acceptation, en test de simulation : un écrasement à 2 m d'un muret d'arène laisse destruction.revision inchangé pour ce groupe ; une roquette de colosse au même point le coupe.

**Gain attendu.** Règle conforme au mot de David (« c que granade et rocket ») ; plus de garde-corps d'arène ouvert sur le vide par un boss ; aucun coût en fluidité sur les traces rejouées.

**Risques.** Les piles et couverts d'arène deviennent des abris sûrs contre l'écrasement : l'équilibrage des combats de boss est à rejouer. Les trajectoires changent par rapport au prototype, ce qui est sans effet sur les sauvegardes.

**Vérifier par.** CATS=muret node bench/murs-verif/passage-d.mjs R (ligne k=2 : explosion boss puis solid-12930 marqué CIBLE) ; node bench/murs-verif/v4.mjs.

### MURS-V3 — Le ricochet et l'indice « BLINDAGE » se déclenchent sur les collines, les sols et l'herbe rattachée aux murets
- sévérité moyenne · catégorie ressenti · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/destruction.js:236-240; src/simulation.js:903-905; src/world.js:1363; src/game.js:199-203

**Preuve.** Dans rule-v2.diff, damageScenery émet ricochet dès que result.deflected est non nul, sans regarder la classe ni le maillage touché.

Mesure (v2.mjs, module final et breachArmor, 3 traces de l'auteur), maillage le plus proche de chaque balle déviée :
- pompe monde 3 : 321 déviées, dont 158 sur le corps du mur, 87 sur des garnitures de matière 0, 18 chaperons, 15 mécanismes de porte, 19 clôtures, 8 collines ;
- mitraillette monde 3 : 225 déviées, dont 86 sur le corps du mur, 54 clôtures, 10 collines, 7 caniveaux, 4 sentiers ;
- mitraillette monde 10 : 178 déviées, dont 66 sur le corps du mur, 9 collines.

Matière dirt : 9 à 12 par trace.

Cause structurelle : world.js:1363 rattache à un mur ou à un muret tout maillage de la même région à moins de 0,85 m (1,45 m pour les détails). Sur 18 mondes, les groupes blindés contiennent 55 808 touffes d'herbe et 13 555 cailloux (v1.mjs).

**Cause.** L'armure est portée par le groupe, mais le retour « blindé » devrait dépendre du maillage réellement touché. La classe 2 (relief, sols) n'est pas un blindage au sens du joueur.

**Proposition.** destruction.js : l'événement dévié porte armor (1 ou 2) et body:true quand le maillage le plus proche est celui d'un collider du groupe (nearest.solid défini), ou que sa matière est stone ou metal.

simulation.js : émettre ricochet seulement si armor===1 et body. Sinon, laisser le materialImpact ordinaire : pas de tintement, pas de compteur d'indice.

game.js : le compteur de l'indice ne compte que ces ricochets.

Option pour respecter « autre décor ok » : une balle légère dont le maillage le plus proche est végétal (matière 11) dans un groupe blindé n'émet que les éclats de feuillage.

Acceptation : 20 balles dans une colline, un caniveau ou l'herbe au pied d'un muret donnent 0 événement ricochet ; 16 balles dans un mur de salle en donnent au moins 10.

**Gain attendu.** L'indice et le son de blindage ne mentent plus : ils ne partent que sur du bâti. Mesuré : 37 à 49 % seulement des déviations actuelles touchent le corps d'un mur.

**Risques.** Un champ de plus dans un événement transitoire, non sauvegardé. Ne pas faire dépendre la simulation de ce champ au-delà de l'émission d'événements, pour garder le déterminisme simple à prouver.

**Vérifier par.** node bench/murs-verif/v2.mjs (bloc 4, répartition des déviations) ; test de simulation sur le compte d'événements ricochet par cible.

### MURS-V4 — Sols en classe « lourd seulement » plutôt que « jamais » : presque tout le gain, sans perdre les traces d'explosion
- sévérité moyenne · catégorie saccade · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/world.js:1367; src/world.js:1228-1231; src/destruction.js:236-240

**Preuve.** MURS-04 rend marquages et dallages indestructibles pour toute arme. Les explosions ne laissent alors plus rien au sol, une perte visible que l'auteur renvoie à une marque de brûlure non prototypée. David a écrit « autre decor ok ».

Rejeu des 16 traces « A » de l'auteur (3 360 s) avec le module final (v4.mjs), pas avec révision puis gravats :
- origine : 275 et 5 603 ;
- sols en classe 2 (jamais) : 104 (−62 %) et 1 629 (−71 %) ;
- sols en classe 1 (lourd seulement) : 112 à 114 (−59 %) et 1 667 à 1 677 (−70 %) ;
- sols inchangés : 130 (−53 %) et 1 802 (−68 %).

Les ruptures de sols viennent surtout de la vapeur (légère dans la règle) et des balles ; les grenades et roquettes sont rares.

**Cause.** La classe 2 a été choisie pour maximiser le compteur de révisions, alors que l'essentiel du gain vient d'ôter les sols aux balles et à la vapeur, pas aux explosifs.

**Proposition.** Dans breachArmor, garder la classe 2 pour le relief seul (hill, cliff, cliff_stratum) et rendre 1 pour les groupes de sol (liste FLOOR et plaques minces non tournées).

Grenades et roquettes continuent d'arracher marquages et dallages. Les balles, la vapeur et l'écrasement (si MURS-V2 est retenu) n'y touchent plus.

Acceptation : sur les 16 traces, au plus 115 pas avec révision ; une grenade sur un marquage d'arène produit une révision ; 50 balles n'en produisent aucune.

**Gain attendu.** −59 % de pas avec révision au lieu de −62 % (mesuré), en conservant les dégâts visibles des explosifs au sol et sans dépendre d'un système de marques de brûlure à écrire.

**Risques.** Trois points de gain en moins. En arène, les roquettes de boss continuent de produire quelques révisions (3 à 6 par 2 minutes selon l'auteur).

**Vérifier par.** node bench/murs-verif/v4.mjs.
