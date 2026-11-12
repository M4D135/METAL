# Lot 14 — Murs cassables seulement aux armes lourdes
## But
Les balles (pistolet, mitraillette, pompe) ne percent plus murs, toits, piliers porteurs, murets, relief ni sols. Seuls les explosifs du joueur et des ennemis, les écrasements et barrages de colosse ouvrent le bâti. Le reste du décor (caisses, couverts, arbres, conduites, poteaux fins) casse comme avant.
## Tâches, dans l'ordre
### T1 — Règle de blindage et contrainte d'empreinte [MURS-01, MURS-06]
- Où : src/destruction.js:228-262, 293-294 ; src/simulation.js:903-905, 953, 1080, 1121, 1129-1132, 1159, 120, 2020 ; src/simulation.js:237-241, 1967
- Quoi : `FDestruction.create(world,{armor:breachArmor})` aux deux lignes de création (120, 2020). `damage(point,radius,power,bullet,ignoreId,direction,heavy=!bullet)` ; après le calcul de `amount` (ligne 238) : `if(g.armor>(heavy?1:0))` → `chipsFor`, `materialImpact{deflected:true}`, `result.deflected++`, `continue`. `damageScenery(point,power,r=0,direction,ignoreId,heavy=r>0)` transmet `{heavy}`. `explode` passe `kind!=='steam'`. world.js reste identique octet pour octet ; aucun champ ajouté à l'objet monde ni à l'instantané.
- Preuve exigée : `node replay.mjs trace-*.json` → 21 traces sur 21, empreinte identique à 673d6b2 sans option armor. 200 balles sur un mur de salle : `destruction.revision` inchangé, aucun état pour ce groupe. 1 roquette : passage franchissable. `cmp work/src/world.js` avec l'original : 0 diff.
- Qualité : identique (sans option) ; meilleure (avec option).
- Garde-fous : les rejeux d'entrées de la démo enregistrés avant la règle divergent → inscrire `breachRule:1` dans l'en-tête. Les clôtures et tuyaux rattachés à un groupe blindé deviennent insensibles aux balles (88 maillages/mur, 33/muret). Déterminisme préservé : la simulation reste déterministe, seules les trajectoires changent.
- Dépend de : rien.

### T2 — Fonction breachArmor : classer par les données existantes [MURS-02]
- Où : src/simulation.js (nouvelle fonction pure) ; src/world.js:1352-1353, 1363, 307, 112-126
- Quoi : `const breachArmor=(g,world)=>{…}` retourne 0, 1 ou 2. Classe 1 (blindé balles) : `kind==='wall'`, `kind==='roof'`, `kind==='support'` avec section ≥ 0,6 m, `category==='boundary'` (murets). Classe 2 (jamais) : voir T3. Classe 0 : caisses, couverts, machines, rochers, lampadaires, poteaux fins (< 0,6 m), arbres, conduites, végétation. Ne rien écrire dans world.js ; la fonction est passée en option à `FDestruction.create`.
- Preuve exigée : `node def-count.mjs` → 206 à 274 groupes blindés par monde v2 ; aucun arbre, aucune conduite, aucun couvert dans la liste. Murets : 145/monde classés boundary.
- Qualité : identique (données mondes inchangées).
- Garde-fous : le seuil 0,6 m repose sur les gabarits actuels (piliers 0,85, piles 2,2, colonnes 0,65 vs poteaux 0,16-0,45). Un nouveau gabarit de pilier devra être revu. Les clôtures sur murets (world.js:1363) héritent du blindage.
- Dépend de : T1.

### T3 — Classe 2 : relief et sols indestructibles [MURS-04]
- Où : src/world.js:160-163, 1367, 1228-1231 ; src/destruction.js:153-156 ; src/simulation.js (breachArmor)
- Quoi : dans `breachArmor`, avant le test classe 1 : `RELIEF=['hill','cliff','cliff_stratum']`, `FLOOR=['arena_inlay','floor_drain','threshold','hazard_marking','trail','ground_patch','leaf_litter','jump_landing','dock_warning','trap_warning','arena_path_mark','trap_plate']`. Si `meshes.some(q=>RELIEF.includes(q.category))` ou (pas de collider ET tous les maillages ∈ FLOOR ou épaisseur ≤ 0,06 m non tourné) → retourne 2. Dans `damage()`, classe 2 : explosion n'émet pas d'éclats ; balle en émet (marque visuelle).
- Preuve exigée : `node relief.mjs` → 1 balle puis 1 roquette sur une colline 9×5,1×8 m : `destruction.revision` inchangé. En arène, 7 écrasements de colosse : au plus 1 révision. 387 à 440 groupes de sol et 20 à 31 groupes de relief par monde.
- Qualité : meilleure (supprime l'absurdité d'une balle qui fait tomber une colline de 9 m).
- Garde-fous : le critère 6 cm attrape 2 maillages hors sol sur ~990 au monde 3 (ailette de réacteur, boulon), aucun aux mondes 1-2. Les sols ne gardent plus de trace d'explosion → compenser par une marque de brûlure côté rendu (T6). Aucun test existant ne casse relief ou marquages.
- Dépend de : T2.

### T4 — Portes verrouillées : explosifs seulement [MURS-05]
- Où : src/simulation.js:179, 906-914, 916-918, 1939
- Quoi : dans la boucle portes de `damageScenery`, avant la ligne 908 : `if(!heavy){ emit ricochet matière metal ; continue; }`. Garder les 18 points de vie (1 roquette ou 1 grenade au contact suffit). Ne pas toucher aux coques des commandes (12 pts) ni aux pièges.
- Preuve exigée : `node verify-rule.mjs` → 60 balles sur une porte fermée : `hp===18`. 1 roquette : `destroyed===true`, événement `doorOpen`. Format `doorDamage` du point de reprise inchangé.
- Qualité : meilleure (les mécanismes retrouvent leur rôle avant les armes lourdes).
- Garde-fous : un joueur habitué à ouvrir à la mitraillette devra chercher la commande ; l'indice de T6 le lui dit. Les sauvegardes où une porte est déjà entamée restent valides (hp sauvegardé).
- Dépend de : T1.

### T5 — Budget de fluidité : compteurs de non-régression [MURS-03]
- Où : src/game.js:152-156 ; src/simulation.js:229-231, 1125-1134, 64 ; src/destruction.js:272 ; bench/murs/
- Quoi : garder les compteurs `pasAvecRevision` et `gravatsEmis` comme assertions dans un test de simulation. Trace de pompe 90 s au monde 3 : au plus 12 pas avec révision par minute, au plus 250 gravats émis. Ces compteurs s'ajoutent aux correctifs du premier tour (LOOP-04, RCPU-02, SIM-01, IA-02) qui réduisent le coût d'une révision ; la règle en réduit le nombre.
- Preuve exigée : `node trace.mjs 2 1 90 A` puis `node replay.mjs trace-w03-a1-A.json` → comparer lignes origine et R5. Cumul 900 s : 245 pas à l'origine → 84 avec relief+sols (−66 %). Gravats : 5093 → 1197 (−76 %).
- Qualité : meilleure (moins d'à-coups).
- Garde-fous : le pilote automatique tire peu (2 tirs/s à la mitraillette) ; un joueur réel produira plus de révisions dans les deux cas. Aucun temps absolu fiable sur la machine de mesure (charge 13-130) ; seuls les comptages sont déterministes.
- Dépend de : T1, T2, T3.

### T6 — Retour vif sur mur blindé : étincelles, viseur, marque, indice [MURS-07]
- Où : src/destruction.js:190-195, 240 ; src/simulation.js:1132, 524-527 ; src/game.js:199-203, 714, 73 ; src/style.css
- Quoi : 1) `destruction.js` : événement dévié porte `deflected:true`, graine `seed+Math.imul(round(x*97)+round(y*193)+round(z*389),2654435761)` pour varier les éclats sans compteur sauvegardé. 2) `simulation.js` : si `result.deflected` et `r===0` et délai 0,09 s écoulé → `emit('ricochet',{x,y,z,material,count})` + `particles(x,y,z,5,4)`. 3) `game.js` (état local, jamais sauvegardé) : viseur classe `deflect` 0,14 s ; anneau de 32 boîtes sombres 7 cm sur la face touchée, effacées après 20 s ; indice après 4 ricochets en 2,5 s, 2×/session max, texte selon arsenal réel.
- Preuve exigée : `node verify-rule.mjs` → rafale de 16 balles : ≥ 10 événements ricochet, 1 seul message. Pas plus de 64 éclats vivants (MAX_CHIPS). Aucun champ nouveau dans `snapshot()`.
- Qualité : meilleure (le joueur comprend en une rafale que le mur est blindé).
- Garde-fous : les éclats cosmétiques sont simulés (même volume qu'aujourd'hui sous le seuil). Lisibilité du viseur sur téléphone à vérifier. Les 32 instances de marques vont dans game.js, pas dans FEffects.build (pureté des tests).
- Dépend de : T1, T4.

### T7 — Garantie de progression : aucun monde n'exige de percer [MURS-09]
- Où : src/game.js:12, 122 ; src/economy.js:56 ; src/world.js:1592, 1508, 1739-1767 ; src/simulation.js:29, 242-251 ; checks/
- Quoi : ajouter `checks/breach-progress.test.mjs` (repris de reach.mjs) sur les 18 mondes v2, 3 historiques et 2 graines supplémentaires : tous les objectifs atteints, portes closes tant que leur mécanisme n'est pas atteint. Corriger `FWorld.validate` (world.js:1739-1767) : tester les cibles avec un rayon de proximité (case atteinte à < 0,9 m) au lieu de la seule case contenant le point. Texte de l'indice (T6) adapté à l'arsenal réel (pas de lance-grenades avant monde 4).
- Preuve exigée : `node reach.mjs` → 75/75 mondes finissables sans destruction. `SEEDS=7,424242 ONLY=v2 node reach.mjs` vert. `NOMECH=1 ONLY=v2-w01 node reach.mjs` : témoin qui échoue si un mécanisme est inaccessible.
- Qualité : identique (garantie écrite, pas de changement de comportement).
- Garde-fous : la propagation ne modélise pas les chutes (prudente, une cible atteinte l'est vraiment). Le faux négatif de `validate` sur shop-0 (26/39 mondes) n'est pas isolé en cause, seulement constaté.
- Dépend de : T1, T2.

### T8 — Murets garde-corps : pas de mort par rafale perdue [MURS-10]
- Où : src/simulation.js:324-328, 138-144 ; src/world.js:41, 112-126, 1280-1281 ; checks/
- Quoi : les murets sont blindés classe 1 (T2) → les garde-corps (64 à 125/monde, bordant une chute de 1,6 à 6,7 m) ne s'ouvrent plus par accident. Garder la chute mortelle (land() tue au-delà de 1,5 m, impact > 6 m/s, GRAVITY=12). Ajouter un test de simulation : 30 balles sur un muret de terrasse, puis marche vers le vide → joueur vivant. Les 39 à 46 murets de plain-pied (marche 0,25 m, retour possible) restent accessibles.
- Preuve exigée : `node walls-sides.mjs` → 15/18/22 murs de salle donnent sur 3,5-6,7 m de vide (aucun raccourci). `node fall.mjs` → 8/8 morts, raison `fall`, 1,05-1,57 s. Test nouveau : garde-corps intact sous 30 balles.
- Qualité : meilleure (moins de morts absurdes).
- Garde-fous : le lot de contenu (caches murées, raccourcis conçus pour les explosifs, monde 4+) change la génération → empreintes et tests dorés modifiés. À faire après LOAD-01, avec un numéro de génération. Sans ce lot, l'indice ne doit pas promettre un passage.
- Dépend de : T2.

### T9 — Suite de tests : réécrire le rouge, couvrir la règle [MURS-12]
- Où : checks/simulation.test.mjs:1507-1518 ; checks/destruction.test.mjs:33-42, 139-160 ; checks/campaign-world.test.mjs:178-203 ; checks/audio.test.mjs:306 ; bench/murs/
- Quoi : réécrire simulation.test.mjs:1507 → 10 balles sur mur factice : aucun état wall, `destructionRevision===0`, ≥ 1 événement ricochet ; 1 grenade : révision ; garder la moitié caisse prop. Ajouter dans destruction.test : sans option = comportement d'origine ; armure 1 → 50 hit sans effet puis blast qui coupe ; armure 2 → blast sans effet. Ajouter dans simulation.test monde 3 : 200 balles + 25 coups de pompe sur mur/muret/colline → révision inchangée ; grenade et roquette percent ; porte intacte aux balles. Empreinte point de reprise = celle de 673d6b2 sur 3 mondes. Budget MURS-03 sur trace 90 s.
- Preuve exigée : `node --test checks/simulation.test.mjs checks/destruction.test.mjs` → 261/261 verts. `node --test checks/campaign-world.test.mjs` vert sans retouche. Sortie de référence : bench/murs/tests-v2.out.
- Qualité : identique (les tests deviennent un filet, pas un changement de comportement).
- Garde-fous : les tests tournent dans node:vm (4,5 à 9× plus lents) → limiter le budget à 90 s simulées et le rejeu à une trace courte. world.test et campaign-world non relancés sur la version finale (world.js identique, risque faible).
- Dépend de : T1, T2, T3, T4, T5.

### T10 — Son de ricochet sans toucher la banque PCM [MURS-08]
- Où : src/audio.js:11-13, 164-170, 257-271, 272-279, 481-483 ; checks/audio.test.mjs:306 ; src/game.js:199-203 ; src/soundscape.js:5
- Quoi : ajouter une méthode `ricochet` dans l'objet `api` (ligne 481) composée de tampons existants : `pcm('impact:metal',.30*g,e.pan,e.event,1.34)` + `pcm('impact:stone',.26*g,e.pan,e.event,1.08)` (si matière ≠ metal) + `pcm('click',.12*g,e.pan,e.event,1.25)`. Ajouter `ricochet:19` aux portées de soundscape.js:5. La banque reste à 64 tampons.
- Preuve exigée : `checks/audio.test.mjs` inchangé et vert (64 tampons). Test nouveau : `api.ricochet` appelé 20 fois en 1 s → `stats.fxSkipped` croît, aucune voix du joueur volée. ~250 octets de code, 0 octet de PCM.
- Qualité : meilleure (tintement clair distinct de l'impact sourd).
- Garde-fous : ajout pur → un jeu qui n'appelle pas `ricochet` garde exactement le son d'avant. Niveaux à régler à l'oreille (non écouté). Si David veut un vrai sifflement : tampon dédié 0,22 s (2600→1500 Hz), test porté à 66.
- Dépend de : T6.

### T11 — Pompe : rebuild paresseux, −46 à −64 % d'appels [MURS-11]
- Où : src/destruction.js:160-178, 272, 293 ; src/simulation.js:1125-1134, 229-231
- Quoi : dans `damage()`, remplacer l'appel direct `rebuild()` (ligne 272) par `dirty=true` ; `revision++` reste immédiat (graines d'éclats inchangées). Ajouter `const fresh=()=>{if(dirty){dirty=false;rebuild();}}` et l'appeler dans les trois accesseurs `meshes`, `colliders`, `lights`. `restore()` remet `dirty=false` avant son `rebuild`.
- Preuve exigée : `node lazy.mjs trace-w03-a1-A.json trace-w10-a1-A.json trace-w02-a1-A.json` → appels à rebuild : pompe monde 3 de 81 à 42, monde 10 de 89 à 48, monde 2 de 80 à 29. Instantané final, colliders et suite des tailles identiques à 673d6b2.
- Qualité : identique (résultat final inchangé).
- Garde-fous : tout nouveau lecteur des tableaux entre deux plombs doit passer par les accesseurs (déjà le cas). Complémentaire de la révision incrémentale du premier tour (LOOP-04). Avec la règle (T1), le pompe rompt moins de groupes par tir → gain absolu baisse, équivalence reste.
- Dépend de : rien (indépendant de la règle de blindage).

### T12 — Séquence de brèche pour le mode démo [MURS-13]
- Où : src/simulation.js:1106-1124, 324-328 ; src/economy.js:56 ; bench/murs/
- Quoi : temps fort de 6 à 8 s dans la démo : 1) choisir le groupe blindé le plus proche dont les deux côtés sont au même niveau (écart ≤ 0,42 m, test walls-sides.mjs) ; 2) 12 balles de mitraillette → étincelles, ricochets, viseur gris ; 3) changement d'arme, 1 grenade (1,8 s) ou 1 roquette (0,1 s) ; 4) traversée puis retour. Interdire au pilote de franchir une brèche si le sol de l'autre côté est plus bas de ≥ 1,5 m. Lancer sur un monde d'indice ≥ 3 ou avec équipement de démo.
- Preuve exigée : test de simulation du pilote sur 3 mondes → séquence terminée joueur vivant, ≥ 1 ricochet, ≥ 1 révision.
- Qualité : meilleure (la démo montre la règle sans risque de mort par chute).
- Garde-fous : dépend du mode démo (autre axe) ; le coût se limite au choix du mur et au garde-fou de chute. Les rejeux d'entrées avant la règle divergent → `breachRule:1` dans l'en-tête.
- Dépend de : T1, T2, T6.
## Options désactivées par défaut
- (aucune)
## Écartés ou absorbés
- (aucun)
## Décisions à confirmer par David
- Le lot de contenu « caches murées et raccourcis conçus pour les explosifs » (MURS-10) : le lancer dans ce lot ou le reporter à un lot ultérieur après LOAD-01 ? — valeur par défaut proposée : reporter (change la génération → empreintes → tests dorés ; à faire après la réparation des reprises).
- Le texte de l'indice (T6) : « BLINDAGE · les balles ne percent pas les murs. Il faudra des explosifs. » (2,6 s, 4 ricochets en 2,5 s, 2×/session) est-il acceptable, ou préfères-tu un rappel à chaque monde ? — valeur par défaut proposée : 2×/session, discret.
- Les roquettes et grenades ennemies percent les murs (classe lourde quel que soit le tireur) : validé ? — valeur par défaut proposée : oui (coût mesuré négligeable : 7 révisions au lieu de 6 en 150 s).
## Gains attendus du lot
Sur 900 s de tir (rejeu déterministe) : −66 % de pas avec révision (245 → 84) et −76 % de gravats émis (5093 → 1197) en combinant T1+T2+T3+T4. Au pompe monde 3, les à-coups passent d'environ 0,8-1 s/min à 0,2-0,4 s/min (estimé d'après les 24-31 ms/revision du premier tour). La réserve de 128 gravats ne sature plus (moyenne 118-126 → 38,6 à la mitraillette). Points de reprise acceptés : 1/24 → 18/24 (−5 à −13 % de taille d'instantané). T11 ajoute −46 à −64 % d'appels à `rebuild` au pompe, indépendant de la règle.

## Mise à jour après contre-vérification

Cette fiche a été rédigée avant la contre-vérification de cet axe. Les verdicts ci-dessous priment sur le texte des tâches.

- **MURS-01 — confirmé, priorité P0, qualité meilleure.** Gain corrigé : Sur les 16 traces « A » de l'auteur (3 360 s, tirs, arènes, repos), rejouées avec le module final et la fonction breachArmor : 275 pas avec révision ramenés à 104 (−62 %), gravats 5 603 ramenés à 1 629 (−71 %). Murs seuls au sens strict : −16 % (chiffre de l'auteur, non remesuré).
- **MURS-02 — confirmé, priorité P0, qualité sans objet.** Recensement refait sur les 18 mondes v2 (v1.mjs), cohérent avec l'auteur : 904 groupes wall (50 par monde), 318 toits, 2 602 murets (145 par monde), 420 piliers blindés et 582 poteaux fins laissés cassables. - Aucun segment de mur de salle (matière 3, sans cat…
- **MURS-03 — confirmé, priorité P1, qualité meilleure.** Gain corrigé : −62 % de pas avec révision et −71 % de gravats sur 3 360 s (16 traces, règle finale complète) ; −53 % si les sols restent cassables ; −16 % pour les murs seuls. Gain en millisecondes : estimé, non mesuré.
- **MURS-04 — confirmé, priorité P1, qualité meilleure.** Gain corrigé : Relief seul : gain modeste (R3 vers R4 : 11 à 9 pas sur la trace pompe monde 3). Sols : 9 points de plus en classe 2, 6 points en classe 1.
- **MURS-05 — confirmé, priorité P2, qualité meilleure.** simulation.js:179 (18 points de vie) et 906-914 relus. verify-rule.mjs rejoué : à l'origine 40 balles détruisent la porte ; avec la règle, 18 points intacts, 40 ricochets, puis 1 roquette la détruit. Dans le correctif, le test de classe vient bien après le tes…
- **MURS-06 — confirmé, priorité P0, qualité identique.** Le cœur est confirmé. - Empreinte de simulation et instantané initial identiques entre 673d6b2 et la copie à règle sur 8 mondes (v2 1, 5, 12, 18 ; v1 3, 12 ; historiques 1 et 3), mesure à moi. - world.js identique octet pour octet (cmp). - save-compat.mjs et c…
- **MURS-07 — plausible, priorité P2, qualité meilleure.** Conception cohérente, non prototypée côté jeu, non vue en navigateur.  Défaut mesuré dans le prototype : l'événement ricochet part pour toute balle déviée, y compris sur la classe 2 et sur le décor rattaché. Sur 3 traces rejouées (v2.mjs), le maillage le plus…
- **MURS-08 — plausible, priorité P3, qualité meilleure.** Faits vérifiés : - ~/Projects/ferro n'existe pas ; le clone 248043a de scratchpad/wf2/ferro/ferro a un audio.js identique à celui de METAL (cmp, 45 997 octets). - checks/audio.test.mjs:306 exige bien 64 tampons. - pcm(name, level, pan, event, rate,…
- **MURS-09 — confirmé, priorité P2, qualité sans objet.** Confirmé : - economy.js:56 donne bien [pompe, mitraillette, lance-grenades, lance-grenades, rien, lance-roquettes]. - reach.mjs rejoué sur une graine nouvelle (31337) : 9 mondes v2 sur 9 finissables sans percer. - unreach.mjs rejoué : FWorld.validate échoue bi…
- **MURS-10 — confirmé, priorité P2, qualité sans objet.** fall.mjs rejoué : 8 morts sur 8, raison fall, en 1,05 à 1,57 s. walls-sides.mjs rejoué : mêmes classes (46 murets de plain-pied, 61 au bord d'une chute de 6,7 m, murs de salle tous sur 3,5 ou 6,7 m de vide). land() relu à simulation.js:324-328.  Élément rassur…
- **MURS-11 — confirmé, priorité P3, qualité identique.** Gain corrigé : Environ 20 à 40 ms économisées par 90 s de pompe, soit 0,5 à 1,1 ms par reconstruction évitée.
- **MURS-12 — confirmé, priorité P1, qualité sans objet.** J'ai lancé toute la suite sur une copie privée de la version à règle : 414 tests, 404 verts, 10 rouges. - 1 rouge dû à la règle : checks/simulation.test.mjs:1507, comme annoncé. - 8 rouges préexistants : les empreintes dorées de campaign-world, rouges aussi su…
- **MURS-13 — plausible, priorité P3, qualité sans objet.** Rien à mesurer : la proposition dépend de l'axe DEMO. Ses prémisses sont confirmées par mes rejeux (passage : 1 roquette ou 3 grenades pour un mur de salle ; murets de plain-pied ; chute mortelle ailleurs).  Le garde-fou « ne pas franchir si le sol est plus ba…
- **MURS-V1 — nouveau constat, ajouté par le contre-vérificateur (haute).** Huit tests à empreintes dorées sont déjà rouges sur 673d6b2 intact : la référence de non-régression est fausse Où : checks/campaign-world.test.mjs:16-22; checks/campaign-world.test.mjs:178-203; src/world.js. Quoi : Avant d'implémenter la règle, Codex lance npm test sur un checkout intact, sur la machine de build, et archive la liste des échecs. - Si les 8 tests y sont rouges aussi : décider avec David entre régénérer legacyHashes (la génération 0.8 est assumée) ou corriger world.js pour retrouver les mondes historiques. - S'ils sont verts là-bas : chercher la source de non-portabilité dans world.js (Math.sin, Math.pow, tri non stable), car l'empreinte de simulation.js:237 protège aussi les points de reprise entre machines.  Critère d'acceptation de la règle : même ensemble d'échecs que la référence, moins simulation.test.mjs:1507 réécrit. Gain attendu : Une référence de tests fiable : aucune régression imputée à tort à la règle, et détection d'un éventuel défaut de portabilité des mondes entre machines. Détail dans `constats/MURS.md`.
- **MURS-V2 — nouveau constat, ajouté par le contre-vérificateur (moyenne).** Classer lourd par « grenade ou roquette » : l'écrasement d'un colosse ouvre un garde-corps d'arène dans le prototype Où : src/simulation.js:932-934; src/simulation.js:953; src/simulation.js:1717-1718; src/simulation.js:1071; src/simulation.js:1079. Quoi : Dans explode, passer heavy = kind==='grenade'||kind==='rocket' à damageScenery.  Conséquences : - grenades et roquettes du joueur et des ennemis : lourdes ; - barrage de roquettes des colosses : lourd, car il passe par spawnProjectile('rocket') ; - écrasement (kind 'boss'), vapeur et souffles anonymes : légers.  Si David veut que l'écrasement casse les piles d'arène, l'ajouter explicitement, mais jamais sur la catégorie boundary.  Acceptation, en test de simulation : un écrasement à 2 m d'un muret d'arène laisse destruction.revision inchangé pour ce groupe ; une roquette de colosse au même point le coupe. Gain attendu : Règle conforme au mot de David (« c que granade et rocket ») ; plus de garde-corps d'arène ouvert sur le vide par un boss ; aucun coût en fluidité sur les traces rejouées. Détail dans `constats/MURS.md`.
- **MURS-V3 — nouveau constat, ajouté par le contre-vérificateur (moyenne).** Le ricochet et l'indice « BLINDAGE » se déclenchent sur les collines, les sols et l'herbe rattachée aux murets Où : src/destruction.js:236-240; src/simulation.js:903-905; src/world.js:1363; src/game.js:199-203. Quoi : destruction.js : l'événement dévié porte armor (1 ou 2) et body:true quand le maillage le plus proche est celui d'un collider du groupe (nearest.solid défini), ou que sa matière est stone ou metal.  simulation.js : émettre ricochet seulement si armor===1 et body. Sinon, laisser le materialImpact ordinaire : pas de tintement, pas de compteur d'indice.  game.js : le compteur de l'indice ne compte que ces ricochets.  Option pour respecter « autre décor ok » : une balle légère dont le maillage le plus proche est végétal (matière 11) dans un groupe blindé n'émet que les éclats de feuillage.  Acceptation : 20 balles dans une colline, un caniveau ou l'herbe au pied d'un muret donnent 0 événement ri… Gain attendu : L'indice et le son de blindage ne mentent plus : ils ne partent que sur du bâti. Mesuré : 37 à 49 % seulement des déviations actuelles touchent le corps d'un mur. Détail dans `constats/MURS.md`.
- **MURS-V4 — nouveau constat, ajouté par le contre-vérificateur (moyenne).** Sols en classe « lourd seulement » plutôt que « jamais » : presque tout le gain, sans perdre les traces d'explosion Où : src/world.js:1367; src/world.js:1228-1231; src/destruction.js:236-240. Quoi : Dans breachArmor, garder la classe 2 pour le relief seul (hill, cliff, cliff_stratum) et rendre 1 pour les groupes de sol (liste FLOOR et plaques minces non tournées).  Grenades et roquettes continuent d'arracher marquages et dallages. Les balles, la vapeur et l'écrasement (si MURS-V2 est retenu) n'y touchent plus.  Acceptation : sur les 16 traces, au plus 115 pas avec révision ; une grenade sur un marquage d'arène produit une révision ; 50 balles n'en produisent aucune. Gain attendu : −59 % de pas avec révision au lieu de −62 % (mesuré), en conservant les dégâts visibles des explosifs au sol et sans dépendre d'un système de marques de brûlure à écrire. Détail dans `constats/MURS.md`.

