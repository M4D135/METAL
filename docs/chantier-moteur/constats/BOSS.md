# Axe BOSS — BOSS — colosses (Colosse de Fer, Brise-siège, Veilleur) et combats de boss de la campagne v2 sur 18 mondes (METAL 0.8, commit 673d6b2)

Origine : premier tour. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Chemins utilisés : B=bancs/boss (bancs) et F=le dépôt METAL (clone en lecture seule, rien n'y a été modifié). Les mesures tournent sous Node, à 60 Hz, avec les modules chargés dans node:vm. D'autres agents tournaient en même temps sur la machine : les temps absolus sont bruités, donc je raisonne en relatif et je répète avec 3 à 5 graines.

1) Moteur. La logique de boss coûte peu : tickBoss et updateBossAttacks prennent environ 16 µs par pas. Un pas de combat coûte 0,26 à 0,49 ms en moyenne, avec un p99 de 1,7 à 3,7 ms. Les saccades viennent du code générique que le combat déclenche :
- Une route A* de garde échoue après l'effacement du cache d'arêtes. Cela donne une pointe reproductible de 42 à 52 ms contre le Brise-siège. Une borne locale testée sur une copie instrumentée la ramène à 18–21 ms sous charge (contre 126–191 ms dans les mêmes conditions), sans changer l'issue du combat.
- Chaque casse décorative invalide toute la navigation.
- Les gravats au repos prennent 38 % du CPU de simulation.
- La portée de rendu est forcée à 100 m dans l'arène, Canvas2D bas compris.

2) Équité. Le bouclier n'absorbe jamais l'Onde de choc ni le Balayage, et il retire le dash. Résultat : le bot équipé du bouclier meurt sur 7 des 9 mondes testés, toujours tué par l'Onde, avec 0 dégât absorbé. En phase 2, la double Onde arrive à 1,20 s d'écart alors que le dash se recharge en 1,7 s. Les télégraphes sont tous au sol, donc hors champ quand on vise le cœur (tangage de 41 à 66° pour un demi-champ vertical de 37°). Le son d'annonce est 13 à 50 fois plus faible que l'impact. Le cercle d'engagement de 28 m dans une arène carrée de 60 m laisse des angles sûrs : 0 dégât reçu en 120 s, et les soins et munitions sont placés hors du cercle. Le Balayage à 2 faisceaux rate toujours un joueur immobile au-delà de 9,15 m.

3) Rythme et ressenti. Le boss avance de 0,4 à 1,1 m par minute, pivote par sauts allant jusqu'à 132°, ne vacille jamais et ne fait jamais trembler la caméra. Un tir au cœur et un tir au corps donnent le même retour. Le temps pour tuer le boss va de 75 à 464 s : il faut 17 fenêtres au pistolet pour le premier, et le joueur finit à court de munitions au monde 18. La variété reste faible : le Colosse lance l'Onde dans 83 % des cas dès 10 m, et ce sont les mêmes 6 drones à tous les mondes.

4) Pas de bug bloquant trouvé : pas de renforts infinis (libération unique via bossReleased), pas de boss coincé. Les PV correspondent à la table v2 (campaignBossFactor vaut 1).

Les propositions se limitent aux concepts Doom et Quake 3, sans reprendre de code. Celles qui touchent l'état du boss imposent d'ajouter les champs à la liste BOSS, de monter la version du snapshot et de valider atomiquement. Celles qui touchent les PV et les fenêtres contredisent checks/boss-progression.test.mjs et demandent une décision de David.

## Mesures

- **Coût moyen du pas en combat de boss (joueur dans l'arène, boss réveillé, tirs + esquives)** : 0,26–0,49 ms en moyenne (séries chargées 0,6–0,75 ms), p99 1,7–3,7 ms, max 5–7 ms hors pointe de route _(méthode : B/fight.mjs idx 0/1/2, 60 s, politique skilled, graines 96/7/1234/42/2026 ; performance.now autour de sim.step ; machine partagée (relatif seulement))_
- **Pointe reproductible contre le Brise-siège** : 42–52 ms (80–84 ms sous forte charge ; 126–191 ms avec instrumentation sous charge), ~4 s après la libération des gardes de phase 1 _(méthode : B/fight.mjs F 1 60 skilled 0 <graine>, 5 graines ; attribution des pointes aux événements du pas)_
- **Cause de la pointe** : 1 route échouée d'un garde (e=72, found:false) : 2401 nœuds explorés, 4773–4853 segmentFree, A* 120–175 ms sous charge ; appelée par cover() après edgeKnown/edgeOpen.fill(0) (révision à 17,7 s, pointe à 32,0 s) _(méthode : PATCHED=1 : copie instrumentée B/patched/src/simulation.js (compteurs G.__diag : routes, explored, segmentFree, astarMs, edgeWipes))_
- **A* borné min(2400, 64+8·Manhattan) — test du correctif** : 161 nœuds, ≈416 segmentFree, A* 8,7–11,5 ms, pas max 18–22 ms contre 126–191 ms, p99 6,0–6,8 contre 6,6–10,1 ms ; issue identique (PV restants 137,8, mêmes coups reçus) _(méthode : BOUNDED=1 PATCHED=1 GOD=1 node B/fight.mjs F 1 60 skilled 0 {96,7,2026}, comparé sans BOUNDED dans la même rafale)_
- **Profil CPU d'un combat contre le Veilleur (60 s)** : sim.step 1321 ms au total ; updateProjectiles 588 dont updateDebris 503 (debrisFloor 402, debrisSupport 317) ; sol (temps propre) 549 ; pumpNav 219 ; updateEnemies 187 ; castProjectile 74 ; hitRay 71 ; tickBoss 48 ; updateBossAttacks 10,6 _(méthode : node:inspector en processus (sans port), PROFILE_STEP=99999 TOPN=22, temps inclusifs)_
- **Révisions de destruction en combat et coût en navigation** : 5–8 révisions/min, surtout des incrustations décoratives 'decor-room-#…:dressing' ; chacune remet en file 37–44 k cellules → 176–333 pas pumpNav/min (~1,1 ms chacun) ; 3 effacements du cache d'arêtes en 40 s _(méthode : PATCHED=1, compteurs de révisions, de cellules mises en file et d'edgeWipes)_
- **Pas comportant une casse de destruction** : 9–13 ms (souffle de destruction 2,7 ms, updateDebris 3,5 ms, vapeur updateEnvironment 3,75 ms) _(méthode : PROFILE_STEP=N ciblé sur le pas de pointe)_
- **Postes écartés** : blocked() avec un rayon de colosse ≈2 µs contre ≈1 µs ; FActors.build d'un géant 60–92 µs pour 93–112 maillages (LOD2 jamais atteint) ; télégraphes : 10 maillages _(méthode : B/blocked.mjs, B/actors.mjs (400 constructions par cas))_
- **Maillages statiques dans la portée de rendu depuis l'arène** : 4822–7913 à 100 m (portée forcée) contre 918–1534 à 54 m (bas) et 2219–4172 à 70 m (moyen) ; jusqu'à 10584 depuis l'entrée _(méthode : B/range.mjs, comptage des world.meshes dans le rayon, mondes 0–2)_
- **Bouclier face à chaque famille d'attaque (joueur immobile à 15 m, garde levée en continu)** : Écrasement en visant le cœur (41°) : 23,1 dégâts, 0 absorbé ; à l'horizontale : 0 absorbé ; regard −34° : 12,7 absorbés ; Onde 20,9 et Barrage 15,9 jamais absorbés _(méthode : B/shield.mjs (script pur, famille forcée par bossStep))_
- **Survie bouclier contre dash (politique max, 180 s)** : Bouclier mort sur 7/9 mondes (idx0 38 s, idx2 81, idx3 48, idx5 102, idx8 99, idx11 98, idx17 123), 100 % des dégâts par l'Onde, 0 absorbé ; dash : tue ou survit sur 7/9 (meurt idx0 à 116 s avec le boss à 10/600, idx3 à 132 s) ; Brise-siège (idx1, idx4) tué dans les deux cas _(méthode : B/fight.mjs F <idx> 180 max 1|0)_
- **Monde 1, 60 s, bot skilled** : bouclier mort à 49 s (5 Ondes × 20,9) ; dash : 0 dégât ; immobile mort à 29,6 s _(méthode : B/fight.mjs F 0 60 skilled 1|0 et static)_
- **Double Onde de phase 2** : fronts espacés de 1,20 s (tell 1,35 puis 2,55 s) pour une recharge du dash de 1,7 s _(méthode : B/phase2.mjs F 0 (et 2))_
- **Chronologie des attaques** : Barrage : tell 1,70/1,98 s + vol 0,75 s (Brise-siège) / 0,83 s (Veilleur) → impact à 2,45–2,80 s ; zone « active » 0,75–0,83 s avant l'impact et ~2 s après ; Onde : 1,55 s + 1,25 s pour atteindre 15 m = 2,8 s ; Écrasement 1,45 s (1,25 s en phase 2) _(méthode : B/timing.mjs F 1 45 et F 2 45)_
- **Exploit des angles (hors du cercle de 28 m)** : 120 s derrière le couvert NE : 1 attaque en tout, 107–124 dégâts infligés, 0 reçu (3 boss) ; distances au centre : soins 31,1 m, munitions 28,8–30,7 m, grenades 27,9 m, armure 26,1 m _(méthode : B/fight.mjs F {0,1,2} 120 corner 0 ; B/explore.mjs)_
- **Cadrage en visant le cœur** : tangage du cœur depuis 15 m : 41° (Colosse), 55° (Brise-siège), 66° (Veilleur) pour un demi-FOV vertical de 37° ; disque d'Écrasement sous les pieds hors écran au-delà de 16,4°, zone de roquettes au-delà de 10,2° _(méthode : python3 B/frustum.py (géométrie caméra, œil 1,62 m, FOV 74°))_
- **Niveau sonore des annonces** : gain effectif de bossTell 0,012–0,019 à 15 m et 0,0023–0,0045 à 25 m, contre 0,12–0,30 pour bossImpact (13 à 50× plus faible) ; portée par défaut de 36 m (bossTell absent de ranges) _(méthode : B/tellaudio.mjs via FSoundscape, sans occlusion)_
- **Répartition des attaques** : Colosse à ≥10 m : 83 % d'Ondes (15/18) ; Brise-siège, joueur immobile : 14 Barrages / 2 Balayages ; Veilleur : 14/2/1 ; joueur mobile ≈50/50 ; cœur ouvert 32–43 % du temps ; cycle de 6,4–7,4 s _(méthode : B/mix.mjs F 120 1 (réseau tactique actif), distances 6–25 m)_
- **Mobilité et rotation du boss** : déplacement 0,4–1,1 m/min ; lacet modifié sur 104–138 pas sur 2400, saut médian 4,8°, max 111–132° (extrémités de la silhouette déplacées de 15,7 à 31 m en un pas) _(méthode : B/yaw.mjs F 2 (joueur en orbite à 7,6 m/s))_
- **Temps pour tuer (TTK), bot max-DPS invulnérable** : idx0 118 s (pistolet seul), idx1 75, idx2 104, idx3 140, idx5 173, idx8 160, idx11 241, idx14 257, idx17 464 (munitions épuisées [0,0,0,28,1]) _(méthode : GOD=1 node B/fight.mjs F <idx> 600 max 1)_
- **Dégâts idéaux par fenêtre de cœur et fenêtres nécessaires** : pistolet 31–81 ; meilleure arme : 35 (monde 1) → 677 (monde 16) ; fenêtres nécessaires 7,1–21,7 (monde 1 : 17,1 ; monde 2 : 7,1 ; monde 18 : 21,7) _(méthode : B/window.mjs (boss figé, cœur ouvert pendant weakTimer, tir continu à 15 m, 6 cycles) → B/window-results.jsonl)_
- **TTK idéal limité par les munitions** : 121, 55, 76, 101, 124, 145, 54, 110, 97, 67, 152, 104, 81, 173, 159, 114, 207, 179 s (mondes 1–18) _(méthode : B/ttk.mjs (fenêtres mesurées + plafonds de munitions + ravitaillement de l'arène))_
- **Renforts** : toujours 6 drones de type 0 (3 PV), libérés en 3+3 aux Surcharges, une seule fois (bossReleased), sur les 18 mondes ; pas de renforts infinis _(méthode : B/explore.mjs + lecture de world.js:1722-1723 et simulation.js:1645-1651)_

## Scripts de banc

- bancs/boss/lib.mjs — chargeur node:vm (renderer, world, destruction, economy, brain, simulation), équipement de campagne v2 (récompenses des boss précédents, munitions pleines), corePoint, aimAt, stats
- bancs/boss/fight.mjs — combat scripté : coût par pas (moyenne, p50/p95/p99, max, pointes), dégâts par famille, fenêtres, phases ; usage : node fight.mjs <racine> [idx] [secondes] [skilled|pistol|static|corner|max] [bouclier 1|0] [graine] ; env GOD=1, PROFILE_STEP=N|99999 + TOPN (node:inspector en processus), PATCHED=1 (copie instrumentée), BOUNDED=1 (A* borné)
- bancs/boss/patched/src/simulation.js — copie locale instrumentée (compteurs G.__diag : segmentFree, routes, explored, astarMs, edgeWipes, journal par route) avec l'option G.__boundedAstar ; le dépôt n'est pas modifié
- bancs/boss/shield.mjs — protection du bouclier par famille d'attaque et par direction du regard (cœur, horizon, sol)
- bancs/boss/phase2.mjs — écart entre les fronts de la double Onde de phase 2, comparé à la recharge du dash
- bancs/boss/timing.mjs — chronologie tell → actif → impact réel de chaque attaque
- bancs/boss/mix.mjs — répartition des attaques (script + réseau) par distance, part de cœur ouvert, durée de cycle ; usage : node mix.mjs <racine> [secondes] [réseau 1|0]
- bancs/boss/window.mjs — dégâts idéaux par fenêtre de cœur, par arme et par monde (18 mondes, ~150 s) → window-results.jsonl
- bancs/boss/ttk.mjs — modèle de TTK limité par les munitions à partir de window-results.jsonl → ttk-results.jsonl
- bancs/boss/hpcurve.mjs — PV proposés à partir des fenêtres mesurées
- bancs/boss/yaw.mjs — sauts de lacet et déplacement du boss quand le joueur l'orbite à 7,6 m/s
- bancs/boss/tellaudio.mjs — niveau réel des sons de boss (FSoundscape) en fonction de la distance
- bancs/boss/frustum.py — visibilité géométrique des télégraphes au sol en fonction du tangage de visée du cœur
- bancs/boss/range.mjs — maillages statiques dans la portée de rendu depuis l'arène et l'entrée
- bancs/boss/actors.mjs — coût de FActors.build pour les géants (LOD, maillages) et maillages des télégraphes
- bancs/boss/blocked.mjs — coût de blocked() avec un petit rayon et avec un rayon de colosse
- bancs/boss/explore.mjs — inventaire de l'arène (pickups, couverts, gardes, distances au centre)
- bancs/boss/show.py — mise en forme des sorties JSON de fight.mjs

## Constats

### BOSS-01 — Le bouclier n'arrête ni l'Onde de choc ni le Balayage, protège à peine de l'Écrasement quand on vise le cœur, et retire le dash
- sévérité critique · catégorie boss · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:1722; src/simulation.js:766-770; src/simulation.js:771-783; src/simulation.js:798-805; src/simulation.js:1915; src/simulation.js:416; src/game.js:223

**Preuve.** simulation.js:1722 : `if(!a.hitPlayer&&bossZoneContains(a,p,.28)&&sight(...)){a.hitPlayer=true;hurt(a.damage);}`. hurt est appelé sans source, or shieldFacing(source) (simulation.js:766-770) exige une source et un produit scalaire > .55 qui inclut le tangage. L'absorption n'a lieu que si shieldFacing est vrai (:776). simulation.js:1915 : `locomote(dt,arsenal&&s.equipment.left==='shield'?{...input,dash:false}:input)` et :800 `if((input.bash||input.dash)&&s.equipment.left==='shield')shieldBash();` : avec le bouclier en main gauche, Espace frappe et ne dashe plus. Le dash est pourtant la seule parade à l'Onde (0,2 s d'invulnérabilité, :416 ; hurt ignoré si p.dashing>0, :775). shield.mjs : Écrasement en visant le cœur (41°) 23,1 dégâts, 0 absorbé ; à l'horizontale 0 ; regard à −34° 12,7 absorbés ; Onde 20,9 et Barrage 15,9 : 0 absorbé quel que soit le regard. fight.mjs max 180 s : le bot bouclier meurt sur 7/9 mondes (38–123 s), 100 % de ses dégâts viennent de l'Onde, shieldAbsorbed=0 ; le bot dash tue ou survit sur 7/9. Monde 1, skilled 60 s : bouclier mort à 49 s (5 Ondes × 20,9), dash 0 dégât. Cela rejoint le retour de David : « le bouclier ne protège pas bien ».

**Cause.** Les attaques de zone du boss n'ont pas de direction. Le test de garde tient compte du tangage alors que la cible utile (le cœur) est 41 à 66° au-dessus de l'horizon et que les impacts arrivent au sol. Enfin, équiper le bouclier remplace le dash par la frappe sur la même touche : le joueur perd sa seule esquive valide sans gagner de protection.

**Proposition.** 1) Donner une source aux zones en :1722 : `hurt(a.damage,true,{x:a.x,y:p.y+1.1,z:a.z,blast:a.kind==='ring',ground:true})`. Pour le Balayage, la source est le point de l'axe le plus proche du joueur, avec blast:false.
2) Dans shieldFacing (:766-770), si source.ground est vrai ou si une explosion a son centre sous les yeux (y < p.y+0,6), tester la direction à l'horizontale seulement : `(sin(yaw)·dx − cos(yaw)·dz)/hypot(dx,dz) > .5` (±60°), sans le tangage.
3) Garder les taux d'absorption actuels (.55 pour un souffle, .8 en direct) : l'Onde passe de 20,9 à environ 9,4 dégâts pour 17 d'énergie, le Balayage de 26 à 5,2.
4) Rendre le dash au porteur du bouclier. Espace dashe quand la garde n'est pas levée et frappe quand fireLeft est tenu (`input.dash&&input.fireLeft` → shieldBash). Supprimer `dash:false` en :1915, adapter :800 et le toast de game.js:223 (« clic droit + Espace : frappe »). Même logique au tactile et à la manette (garde + dash).
5) Ajouter des tests : Onde sur un joueur garde levée face au boss → absorbed>0 ; dos tourné → 0 ; dash disponible bouclier équipé quand la garde n'est pas levée.

**Gain attendu.** Le bot bouclier ne meurt plus sur 7 mondes sur 9 ; cible : une survie au moins égale à celle du bot dash. Garde levée face au boss, les dégâts d'Onde subis baissent d'environ 55 %. Le bouclier devient une alternative au dash au lieu d'un handicap, ce qui répond directement au retour joueur.

**Risques.** Le déterminisme est conservé (calcul pur) et aucun champ de sauvegarde n'est ajouté. Les tests de frappe de bouclier sur Espace (checks/simulation.test.mjs, checks/first-person.test.mjs) sont à adapter. Vérifier que garde + dash reste jouable au pouce (tactile) et en AZERTY comme en QWERTY. Équilibre : la garde ne doit pas devenir permanente (elle coûte déjà 2,5 d'énergie par seconde). L'aide et le toast doivent changer en même temps que le code.

**Vérifier par.** `node $B/shield.mjs <racine corrigée>` : Onde absorbée > 0 garde levée en visant le cœur. `node $B/fight.mjs <racine> {0,2,3,5,8,11,17} 180 max 1` comparé à `… max 0` : la survie avec bouclier doit être au moins égale à celle avec dash. Nouveaux tests simulation, puis la suite checks/.

**Contre-vérification.** Code relu : simulation.js:1722 appelle hurt(a.damage) sans source, shieldFacing (:766-770) renvoie faux sans source, :1915 force dash:false et :800 transforme Espace en frappe. Rejeu indépendant (domaine principal) : bot bouclier mort à 38,1 s (monde 1), 80,6 s (monde 3), 48,4 s (monde 4), 101,5 s (monde 6), 100 % des dégâts par l'Onde, 0 absorbé ; shield.mjs rejoué donne les mêmes chiffres (Onde 20,9 et Barrage 15,9 jamais absorbés). J'ai aussi testé le correctif proposé en mémoire (source au sol + test horizontal ±60° + dash rendu hors garde, bot adapté : dash si disponible, sinon garde levée) : le boss est tué sur 4 mondes sur 4 (117,7 / 104 / 139,8 / 173,1 s), chaque Onde encaissée passe de 20–24 à 9,4–11 dégâts (−55 %, conforme à l'annonce), 36 à 70 points absorbés. Le gain annoncé est donc mesuré, plus seulement estimé. Deux réserves. (a) « sans gagner de protection » est faux : le bouclier équipé double la capacité d'armure (armorCapacity, simulation.js:537 : 200 contre 100) ; tous les bancs tournent avec 0 point d'armure, ce qui noircit un peu le tableau. (b) Le bot d'origine ne lève la garde que contre les roquettes : la mort 7/9 mesure surtout la perte du dash ; la preuve de non-absorption vient du code et de shield.mjs. Doublon de FEEL-01 et FEEL-05 : à fusionner en un seul chantier. Risques confirmés : tests de frappe sur Espace à adapter, texte d'aide et toast game.js:223, aucun champ de sauvegarde.

**Preuve corrigée.** Survie bouclier (max, 180 s, graine 96) : morts à 38,1 / 80,6 / 48,4 / 101,5 s aux mondes 1, 3, 4, 6. Avec le correctif en mémoire : 4 victoires sur 4, Onde à 9,4–11 dégâts au lieu de 20–24. Le bouclier apporte déjà +100 de capacité d'armure (:537), non mesuré par le premier tour (armure 0 dans tous les bancs).

**Gain corrigé.** Mesuré sur 4 mondes : le porteur du bouclier passe de 0 victoire sur 4 à 4 sur 4 ; −55 % de dégâts par Onde garde levée.

### BOSS-02 — La double Onde de phase 2 arrive à 1,20 s d'écart, inesquivable au dash (recharge 1,7 s), et l'Onde n'a aucune parade de placement
- sévérité haute · catégorie boss · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/simulation.js:1654; src/simulation.js:1675; src/simulation.js:1704; src/simulation.js:1713; src/simulation.js:416; src/effects.js:31-33; src/world.js:1236-1240

**Preuve.** simulation.js:1654 : le tell de l'Onde vaut 1,55 − 0,1·phase, soit 1,35 s en phase 2. En :1675, la seconde Onde reçoit `{tell:2.55}` ; comme l'option est explicite, la réduction de phase ne s'applique pas. Les fronts sont donc espacés de 2,55 − 1,35 = 1,20 s (phase2.mjs), alors que le dash se recharge en 1,7 s (:416 `p.dash=1.7;p.dashing=.2`). L'Onde parcourt 27 m (arena.r−1) en 2,3 s, soit 11,7 m/s, plus vite que le sprint (7,6 m/s). C'est une bande au sol de 1,6 m (+0,28 de marge) (:1704, :1713). Il n'y a pas de saut (locomote :403-473), et les seuls couverts sont à 32,8 m du centre (world.js:1236-1240), hors du rayon : sight() (:1722) n'est jamais coupé dans le cercle. Le seul moyen d'éviter la seconde Onde est de sortir à plus de 27,3 m, là où le boss cesse justement de combattre (voir BOSS-03). Le Colosse choisit l'Onde dans 83 % des cas dès 10 m (mix.mjs), et l'Onde fait 100 % des dégâts du bot bouclier.

**Cause.** Le tell de la seconde Onde est une valeur absolue (2,55 s), fixée sans tenir compte de la réduction de phase ni de la recharge du dash. L'Onde est une attaque « dash ou rien » : ni brèche, ni abri, ni saut.

**Proposition.** 1) En :1675, fixer `tell: premier.tell + 1.95` : première Onde à 1,35 s, seconde à 3,30 s. Les fronts sont alors espacés de 1,95 s, au-delà des 1,7 s de recharge du dash avec 0,25 s de marge.
2) Ajouter des brèches dans l'Onde : on l'évite en se plaçant, comme dans Quake 3, au lieu de seulement réagir. À la création, `a.gaps=[θ0, θ0+2π/3, θ0+4π/3]` et `a.gapHalf=.22` rad (environ 3,3 m d'arc à 15 m), avec θ0 = (bossStep·2,399963) mod 2π pour rester déterministe. La seconde Onde est décalée de ±π/6, soit 7,9 m d'arc à 15 m et 1,0 s de sprint. Dans bossZoneContains (:1704) : `if(a.gaps){const t=Math.atan2(dx,-dz);if(a.gaps.some(g=>Math.abs(wrapAngle(t-g))<a.gapHalf-padding/Math.max(d,1)))return false;}` ; le même test vaut pour les gardes.
3) Dans effects.js:31-33, tracer l'anneau en 3 arcs et éclairer le bord des brèches pendant le tell.
4) En option, ajouter 2 piliers bas indestructibles à r=16 qui coupent sight() et servent d'abri contre l'Onde, hors des axes de balayage.

**Gain attendu.** La phase 2 ne garantit plus de dégâts. L'Onde devient une attaque de placement, praticable aussi avec le bouclier. Estimation : en phase 2, le bot max subit environ deux fois moins de dégâts d'Onde.

**Risques.** Les objets de s.bossAttacks font partie de l'état sauvegardé. Ajouter gaps et gapHalf impose une validation atomique du format : une attaque sans gaps reste acceptée comme ancienne version, des gaps mal formés font rejeter tout le snapshot. Il faut aussi monter la version du snapshot boss. Les tests « slam escapable » et « scripts distincts » (checks/simulation.test.mjs:1727-1812) sont à compléter par un test « double Onde esquivable ». En phase 2, le cycle s'allonge de 0,75 s (bossClock = durée max + 2,6, :1678), ce qui modifie légèrement le TTK. Il faut aussi adapter checks/effects.test.mjs.

**Vérifier par.** `node $B/phase2.mjs <racine> 0` et `… 2` : écart ≥ 1,9 s. `node $B/fight.mjs <racine> 0 180 max 0` et `… 2 180 max 0` : coups d'Onde subis en phase 2. Test simulation : un joueur dans une brèche ne prend aucun dégât.

**Contre-vérification.** Écart de 1,20 s rejoué (phase2.mjs mondes 1 et 3 : fronts à 9,82/11,02, 23,27/24,47…) et cohérent avec le code (:1654 tell 1,35 s en phase 2, :1675 tell absolu 2,55 s, :416 recharge 1,7 s). Avec le correctif BOSS-01, l'Onde touche encore 5 fois sur 13 au monde 1 : ce sont les doubles Ondes. Titre exagéré sur un point : il existe une parade de placement, fuir au-delà de 27,3 m est toujours possible (tell 1,35 s + 2,3 s de propagation = 3,65 s, soit 27,7 m de sprint à 7,6 m/s, même depuis le centre), mais elle fait sortir du cercle d'engagement (BOSS-03). À découper : l'étape 1 (seconde Onde à tell+1,95 s) est un changement d'une valeur, sans champ sauvegardé, à faire tout de suite ; les brèches (gaps, gapHalf) ajoutent des champs aux objets de s.bossAttacks, donc au format de sauvegarde, et relèvent de P3 après décision. Vérifier checks/simulation.test.mjs (scripts distincts) et le cycle allongé de 0,75 s.

**Preuve corrigée.** Parade de placement existante mais dégénérée : sortie du rayon de 27 m atteignable en 3,65 s depuis n'importe quel point.

**Gain corrigé.** Étape 1 seule : la double Onde devient esquivable avec deux dashs (1,95 s > 1,7 s). Le « deux fois moins de dégâts » reste une estimation.

### BOSS-03 — Cercle d'engagement de 28 m dans une arène carrée de 60 m : les angles sont sûrs et le ravitaillement est hors du cercle
- sévérité haute · catégorie bug · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:1682; src/simulation.js:1687; src/simulation.js:1698; src/simulation.js:1652; src/world.js:1203; src/world.js:1236-1240; src/world.js:1544-1550; src/world.js:1670-1673; src/game.js:217

**Preuve.** simulation.js:1682 calcule `inArena=arena&&Math.hypot(p.x-arena.x,p.z-arena.z)<arena.r&&Math.abs(p.y-e.baseY)<5`, avec r:28 (world.js:1203), alors que l'arène fait 60 × 60 m (world.js:1196-1268). Les 4 angles, de 28 à environ 41 m du centre, sont donc hors combat : en :1687 `if(!inArena)e.seen=false`, et en :1698 l'attaque exige inArena. Le boss reste pourtant blessable : damageEnemy (:812-816) ne teste ni la présence ni bossAwake, et alive = hp>0 (:20). Les couverts (±26,±20) de 1,3 m de haut sont à 32,8 m (world.js:1236-1240), les soins à 31,1 m, les munitions à 28,8–30,7 m (world.js:1544-1550), les grenades à 27,9 m (:1567-1568) et l'armure à 26,1 m (:1670-1673). fight.mjs corner, 120 s : 1 attaque en tout, 107–124 dégâts infligés gratuitement et 0 reçu, pour les 3 boss. En plus, ramasser l'armure crée un point de reprise en plein combat (game.js:217, checkpointDue).

**Cause.** La présence du joueur est testée sur un disque inscrit dans une salle carrée, et les objets (couverts, soins, munitions) ont été placés sur le pourtour du carré. La zone où l'on se repose est exactement celle où le boss ne voit rien.

**Proposition.** 1) Une fois le boss réveillé, la présence devient la salle entière : `|dx|<29.5&&|dz|<29.5&&|dy|<5`. Le réveil reste à r<28 pour garder l'entrée scénarisée, et le pont d'entrée reste exclu.
2) Anti-campement : si le joueur reste dans la salle à plus de 27 m du centre pendant plus de 3 s, le boss lance un Barrage forcé sur sa position, comme le Cyberdemon de Doom. bossPoint (:1652) est alors borné au carré (|x|,|z| ≤ 29), tandis que l'Onde garde r=27.
3) Rapprocher le ravitaillement : soins et munitions à r=20–22 sur les diagonales, couverts bas à r=18–20 (utiles contre le Balayage et l'Onde grâce à sight()).
4) Ne pas déclencher checkpointDue au ramassage d'armure tant que bossAwake est vrai. La reprise se fait au seuil de l'arène ou à la mort du boss (game.js:232).
5) Optionnel : réveiller le boss dès le premier dégât reçu, pour empêcher de l'entamer depuis l'entrée.

**Gain attendu.** L'exploit mesuré (0 dégât reçu en 120 s) disparaît. Les ressources se trouvent au milieu du danger, comme dans Doom : se soigner demande de prendre un risque.

**Risques.** Déplacer les pickups et les couverts dans world.js change l'empreinte du monde : checks/world.test.mjs, checks/campaign-world.test.mjs et checks/progression.test.mjs sont concernés, ainsi que la règle d'accessibilité des objets d'AGENTS.md. checks/checkpoint.test.mjs est concerné par le point de reprise ; vérifier aussi la restauration (recovery 1,4 s, simulation.js:2214). La règle « présence = salle » change le comportement du réveil : bien tester l'entrée de l'arène. Le déterminisme est conservé.

**Vérifier par.** `node $B/fight.mjs <racine> {0,1,2} 120 corner 0` : au moins 10 attaques et des dégâts reçus. `node $B/explore.mjs <racine>` : pickups à 24 m ou moins du centre. Suites checks/world, campaign-world et checkpoint.

**Contre-vérification.** Code relu : world.js:1203 r:28, salle de 60 m, couverts à (±26,±20) soit 32,8 m, soins à 31,1 m ; simulation.js:1682/1687/1698 coupent la perception et l'attaque hors du disque ; game.js:217 pose bien checkpointDue au ramassage d'armure. Rejeu corner 120 s : 111 à 114 s passées hors du cercle, 1 seule attaque (2 pour le Veilleur). Deux corrections. (1) « 0 dégât reçu » est faux pour 2 boss sur 3 : une Onde touche pendant le trajet vers l'angle (20,9 et 22,1 dégâts), puis plus rien. (2) L'exploit est lent : 113 à 200 dégâts infligés en 120 s (0,9 à 1,7 PV/s, corps à ×0,30, le cœur ne s'ouvre plus puisqu'aucune attaque ne se termine) : il faudrait environ 10 minutes au pistolet pour le premier boss et les munitions manqueraient ensuite. Sévérité à ramener à moyenne. Ordre conseillé : d'abord les points 1 et 2 (présence = carré une fois le boss réveillé, Barrage forcé), qui ne touchent ni au monde ni aux sauvegardes ; le déplacement des objets change l'empreinte du monde (tests world/campaign-world, points de reprise des parties en cours) et doit passer par une montée de génération.

**Preuve corrigée.** corner 120 s : dégâts reçus 20,9 / 0 / 22,1 (pendant le trajet), dégâts infligés 142,6 / 112,9 / 200,5, temps hors cercle 113,6 / 112,7 / 111,2 s.

**Gain corrigé.** Supprime une zone morte où le boss cesse d'attaquer ; l'exploit lui-même est peu rentable (≈1 PV/s).

### BOSS-04 — Télégraphes illisibles en situation : tous au sol, hors champ quand on vise le cœur, avec un seul son d'annonce très faible
- sévérité haute · catégorie boss · effort L · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · jeu
- lieux : src/effects.js:28-42; src/options.js:6; src/audio.js:541-555; src/soundscape.js:5; src/soundscape.js:37; src/game.js:629-634; src/actors.js:249-260; src/simulation.js:1678; src/simulation.js:1691

**Preuve.** effects.js:28-42 : les télégraphes sont des disques et bandes plats (épaisseur .022) posés au sol, avec un alpha de .16 pendant l'avertissement du Balayage (:36). Le cœur, qui encaisse ×3,2 contre ×0,30 pour le corps (simulation.js:813), se vise à 41°, 55° ou 66° de tangage depuis 15 m (frustum.py). Avec un demi-FOV vertical de 37° (options.js:6, FOV 74°), le sol sort complètement de l'écran au-delà de 37° ; le disque d'Écrasement sous les pieds disparaît dès 16,4°, la zone de roquettes dès 10,2°. Entre 10 et 25 m, aucun télégraphe sous les pieds n'est à l'écran quand on vise le cœur. Audio : un seul bossTell pour les 4 familles (audio.js:541-544, gain .09), absent de ranges (soundscape.js:5, donc portée par défaut de 36 m en :37). Mesure tellaudio.mjs : 0,012–0,019 à 15 m et 0,0023–0,0045 à 25 m, contre 0,12–0,30 pour bossImpact, soit 13 à 50× plus faible. Le HUD n'affiche qu'un texte (game.js:629-634). Le corps du géant n'a pas de posture d'armement (actors.js:249-260 : cadre sans inclinaison ni rebond).

**Cause.** Tout le langage d'alerte passe par le sol et par un son faible, alors que la boucle de jeu oblige à regarder 41 à 66° vers le haut pendant les fenêtres. Rien n'est porté par le corps du boss, là où le joueur regarde, ni par le HUD en dehors du texte.

**Proposition.** 1) Animer des postures sur le corps du géant (actors.js), à partir de windup/windupMax déjà calculés (simulation.js:1678, 1691) :
- Écrasement : bras levé (pitch de 0 à −120°).
- Onde : accroupissement (y −0,12·scale) et cœur qui pulse.
- Barrage : nacelles d'épaules rouges qui pivotent vers la cible.
- Balayage : lame lumineuse qui se charge à hauteur d'œil.
2) Ajouter des colonnes verticales : une colonne translucide de 0,4 × 8 m (alpha .35) sur chaque zone de Barrage ou d'Écrasement, et pour l'Onde un mur de 2 m de haut visible quand on regarde le cœur.
3) HUD : un arc rouge au bord de l'écran, orienté vers la zone qui contient le joueur, et un anneau de compte à rebours sous le réticule (1 − windup/windupMax).
4) Audio : un tell distinct par famille, tous générés par le code (AGENTS.md) :
- Écrasement : grondement de 60 à 110 Hz sur 1,4 s.
- Onde : bourdonnement montant.
- Barrage : bips de verrouillage accélérant de 4 à 12 Hz.
- Balayage : sifflement aigu.
Gain de .25 à .30 et `bossTell:90` dans ranges (soundscape.js:5).

**Gain attendu.** Estimation : au moins 80 % des tells restent visibles quand on vise le cœur à 15 m, contre 0 % aujourd'hui pour les zones au sol. Le tell sonne au moins à la moitié du niveau de l'impact. Le joueur peut lire l'alerte sans quitter le cœur des yeux.

**Risques.** Taille estimée à +3–6 Ko (budget de 1,4 Mo). À vérifier : lisibilité sur mobile et pour les daltoniens (jouer sur les formes, pas seulement les couleurs), quelques maillages de plus pour les colonnes. Aucune ressource externe. Comme c'est du rendu et de l'audio, ni le déterminisme ni les sauvegardes ne sont touchés. Tests à adapter : checks/effects.test.mjs, checks/actors.test.mjs, checks/actor-visibility.test.mjs, checks/audio.test.mjs et checks/soundscape.test.mjs.

**Vérifier par.** `python3 $B/frustum.py` mis à jour avec les hauteurs des colonnes : visibles entre 41 et 66°. `node $B/tellaudio.mjs <racine>` : gain du tell ≥ 0,06 à 15 m. Capture headless en file:// de l'arène, visée sur le cœur, pendant chaque tell.

**Contre-vérification.** Prémisse centrale réfutée par la mesure : sur deux combats de 60 s, 0 pas sur 1128 à 1139 pas de télégraphe a lieu cœur ouvert (sonde openAndWarning). C'est structurel : beginBossAttack ferme le cœur (:1665, weakPointOpen=false) et l'attaque suivante exige un cœur fermé (:1698). Le joueur n'a donc aucune raison de viser le cœur pendant un télégraphe, et « 0 % visible en visant le cœur » ne décrit pas une situation de jeu. Le vrai défaut est la transition : le télégraphe suivant démarre 0,1 s après la fermeture du cœur (:1728, bossClock=max(…, weakTimer+.1)), caméra encore levée de 41 à 66°, avec 1,35 à 1,75 s pour redescendre le regard ; le HUD affiche déjà le nom de l'attaque (game.js:634). La partie audio est confirmée par rejeu de tellaudio.mjs : gain du tell 0,0115–0,0191 à 15 m contre 0,194–0,2415 pour l'impact (×12,6 à ×16,9), 0,0023–0,0045 à 25 m (×31 à ×51) ; bossTell est absent de ranges (soundscape.js:5, portée par défaut 36 m) et son fondamental de 92 à 180 Hz passe mal sur haut-parleurs de téléphone. Reprioriser : tells sonores distincts et bossTell dans ranges (effort S, P1) ; postures du corps utiles (effort M) ; colonnes verticales et arc HUD en dernier. Géométrie de frustum.py exacte (FOV vertical : renderer.js:1541).

**Preuve corrigée.** Recouvrement cœur ouvert / télégraphe en cours : 0 pas sur 1128 (Veilleur) et 0 sur 1139 (Brise-siège). Audio à 15 m : tell 12,6 à 16,9 fois plus faible que l'impact.

**Gain corrigé.** Lisibilité de la transition fenêtre → télégraphe et tell audible ; l'objectif « 80 % des tells visibles en visant le cœur » n'a pas de sens puisque les deux états ne coexistent jamais.

### BOSS-05 — Le Balayage à 2 faisceaux ne touche jamais un joueur immobile au-delà de 9,15 m
- sévérité moyenne · catégorie boss · effort S · gain estimé
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:1670-1672; src/simulation.js:1655; src/simulation.js:1705; src/simulation.js:1722

**Preuve.** simulation.js:1671-1672 : `count=e.phase===2?3:2` faisceaux, orientés à `angle+(i-(count-1)/2)*.38`, soit ±0,19 rad autour de la visée. La largeur vaut 1,45 (:1655), plus 0,28 de marge (:1722), soit 1,73 m. L'écart latéral au joueur visé vaut d·sin(0,19) = 0,189·d, ce qui dépasse 1,73 m dès d > 9,15 m. shield.mjs : 0 dégât de Balayage sur un joueur immobile à 15 m. mix.mjs : contre le Brise-siège, joueur immobile, 14 Barrages pour 2 Balayages. Le Balayage ne touche que le joueur qui se déplace dans un faisceau : il punit le mouvement, à rebours de Doom et Quake qui punissent l'immobilité.

**Cause.** Les faisceaux encadrent symétriquement la dernière position vue, sans en viser aucun sur la position elle-même ni anticiper le déplacement.

**Proposition.** 1) Phases 0 et 1 : le faisceau 1 vise la position prédite (lastSeen + v_lat·tell, avec v estimée sur 0,3 s d'état simulé). Le faisceau 2 est décalé de +0,30 rad du côté où le joueur se déplace, pour lui couper la fuite. Les tells (1,6 et 2,02 s) restent inchangés.
2) Phase 2 : soit trois faisceaux à −0,3, 0 et +0,3 rad, soit un faisceau rotatif (angle(t) = a0 + ω·(t − tell), ω = ±0,9 rad/s, activeDuration de 0,9 s au lieu de 0,55) qui oblige à dasher ou à contourner.
3) Le test bossZoneContains (:1705) ne change pas.

**Gain attendu.** Le Balayage redevient une vraie menace. Estimation : environ un coup sur deux contre un joueur immobile, aucun contre un joueur qui lit le tell et change de direction.

**Risques.** Pour rester déterministe, la prédiction doit utiliser l'état simulé (historique interne de position) et jamais le rendu. Le test « scripts distincts » (checks/simulation.test.mjs:1727-1812) est à adapter. Avec la rotation, ω et a0 s'ajoutent à l'objet d'attaque : snapshot à valider atomiquement.

**Vérifier par.** `node $B/shield.mjs <racine>` : le Balayage inflige des dégâts à un joueur immobile. `node $B/fight.mjs <racine> 1 120 static 0` comparé à `skilled`. Test simulation : joueur immobile à 15 m touché.

**Contre-vérification.** Géométrie vérifiée dans le code (:1671-1672 faisceaux à ±0,19 rad, largeur 1,45 + marge 0,28 en :1722) : d·sin(0,19) > 1,73 m dès 9,16 m. shield.mjs rejoué : 0 dégât de Balayage à 15 m, joueur immobile. Preuve supplémentaire : sur mes combats (bots mobiles), aucun des quelque 60 Balayages lancés n'a touché (hitsTaken ne contient jamais sweep, y compris 21 Balayages au monde 18). Le Balayage ne menace donc personne aujourd'hui. Faisabilité : la prédiction peut lire la vitesse simulée existante (locomotion.vx/vz) sans historique ni champ sauvegardé ; le faisceau rotatif ajoute ω et a0 à l'objet d'attaque (format de sauvegarde) et peut attendre. Test « scripts distincts » à adapter.

**Preuve corrigée.** 0 touche sur environ 60 Balayages dans 10 combats rejoués, bot immobile ou mobile.

**Gain corrigé.** Inchangé (estimation) ; le point de départ est 0 touche mesurée.

### BOSS-06 — Barrage de roquettes : la zone passe au rouge 0,75 à 0,83 s avant l'impact et reste rouge environ 2 s après
- sévérité moyenne · catégorie boss · effort S · gain estimé
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:1654; src/simulation.js:1669; src/simulation.js:1712; src/simulation.js:1717; src/effects.js:28-42

**Preuve.** simulation.js:1712 : `a.warning=a.age<a.tell;a.active=!a.warning&&a.age<a.duration`. En :1717, la roquette part à la fin du tell à 18 m/s. En :1654, activeDuration vaut 2,8 s. timing.mjs : tells de 1,70 et 1,98 s (+0,28 par roquette, :1669), vol de 0,75 s (Brise-siège) ou 0,83 s (Veilleur), donc impact entre 2,45 et 2,80 s. La zone est « active » 0,75 à 0,83 s avant l'impact, puis reste active environ 2 s sans aucun danger. effects.js:28-42 dessine la zone active plus opaque que l'avertissement, comme si c'était la menace.

**Cause.** L'état visuel « actif » suit le tir et non l'impact, et sa durée est un forfait sans rapport avec le temps de vol.

**Proposition.** 1) Tirer à `tell − vol`, avec vol = |bouche − cible|/18 calculé à la création, pour que l'impact tombe exactement à la fin du tell. À défaut, garder warning=true jusqu'à l'explosion de la roquette (lien a.rocketId).
2) Pendant le tell, faire se resserrer un cercle intérieur (rayon·(1 − age/tell)) qui sert de compte à rebours. À l'impact, un flash suivi d'un fondu en 0,3 s. activeDuration passe de 2,8 à 0,35 s.
3) Compenser la cadence : comme bossClock = durée max + 2,6 (:1678), ajouter les 2,45 s retirées pour ne pas accélérer le cycle ni multiplier les fenêtres.

**Gain attendu.** Le moment dangereux se lit exactement : 0 s d'écart au lieu de 0,75 à 0,83 s. Environ 2 s de zone rouge trompeuse disparaissent à chaque salve.

**Risques.** Si l'on oublie la compensation, le cycle et donc le TTK changent (checks/boss-progression.test.mjs). Avec le tir anticipé, vérifier que barrel()/mouth.blocked (:1717) est bien évalué au moment du tir. Un champ ajouté à l'objet d'attaque impose une validation atomique du snapshot. checks/effects.test.mjs est à adapter.

**Vérifier par.** `node $B/timing.mjs <racine> 1 45` et `… 2 45` : l'écart entre l'impact et la fin du tell est d'environ 0. `node $B/mix.mjs <racine> 120 1` : cycle inchangé (6,4 à 7,4 s).

**Contre-vérification.** timing.mjs rejoué (Brise-siège) : zone active à 1,70 et 1,97 s, impact 0,75 s plus tard (2,45 et 2,72 s), puis zone rouge jusqu'à tell+2,8 s, soit environ 2 s sans danger. Code conforme (:1712, :1717 tir à la fin du tell à 18 m/s, :1654 activeDuration 2,8). Attention à la compensation : la fenêtre du cœur s'ouvre quand toutes les attaques sont finies (:1728) ; raccourcir activeDuration avance la fenêtre de 2,45 s. Ajouter 2,45 s à bossClock ne suffit pas, il faut aussi décider si la fenêtre suit l'impact (meilleur ressenti) et vérifier la durée de cycle avec mix.mjs. Variante sans champ sauvegardé à préférer : tirer à tell − vol, avec vol calculé à la création.

**Gain corrigé.** Écart tell → impact ramené de 0,75 s à 0 ; environ 2 s de zone rouge inoffensive en moins par salve.

### BOSS-07 — Pointe reproductible de 42 à 52 ms contre le Brise-siège : une route A* de garde échoue après l'effacement du cache d'arêtes
- sévérité haute · catégorie saccade · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité identique · jeu
- lieux : src/simulation.js:1402-1433; src/simulation.js:1414; src/simulation.js:1420; src/simulation.js:1445-1460; src/simulation.js:1383-1390; src/simulation.js:1742

**Preuve.** fight.mjs idx 1, graines 96, 7, 1234, 42 et 2026 : pas maximal de 42 à 52 ms (80 à 84 ms sous charge), environ 4 s après la libération des gardes de phase 1. La copie instrumentée (PATCHED=1) montre une seule route en cause : garde e=72, found:false, 2401 nœuds explorés, 4773 à 4853 appels à segmentFree, 120 à 175 ms d'A* sous charge. Le chemin d'appel : cover() (simulation.js:1445-1460, jusqu'à 7 setGoal) appelle route() (:1402-1433, `while(heap.length&&explored++<2400)` en :1414). Chaque nouvelle arête coûte un segmentFree (:1420) parce que refreshNav a exécuté `edgeKnown.fill(0);edgeOpen.fill(0);` (:1389) après une révision de destruction (révision à 17,7 s, pointe à 32,0 s). routeBudget, fixé à 2 par pas (:1742), compte des recherches et non des nœuds. Test d'une borne `min(2400, 64+8·Manhattan(start,end))` (BOUNDED=1) : 161 nœuds, environ 416 segmentFree, A* de 8,7 à 11,5 ms, pas maximal de 18 à 22 ms au lieu de 126 à 191 ms dans la même rafale. L'issue du combat est identique (PV restants 137,8, mêmes coups reçus) sur les 3 graines.

**Cause.** Les buts de couverture sont locaux (10 m au plus), mais l'A* garde un budget global de 2400 nœuds. Une cible injoignable (autre composante connexe, ou derrière un décor) consomme tout le budget, et après l'effacement du cache chaque arête coûte un segmentFree d'environ 10 µs.

**Proposition.** 1) Borner localement : `limit = min(2400, 64 + 8·heuristic(start))` pour cover, flank et strafe. L'heuristique de Manhattan en cellules de 0,8 m existe déjà en :1409. Garder 2400 pour les poursuites longues, via un paramètre de route().
2) Cache négatif : une Map (start,end) vers la révision de destruction, valable 1 s, pour ne pas relancer une recherche qui vient d'échouer.
3) Filtrer les candidats de cover() par composante connexe : un identifiant de composante recalculé par remplissage à chaque révision, en une passe étalée par pumpNav. Une cible hors composante n'est alors jamais cherchée.
4) Remplacer routeBudget, qui compte les recherches, par un budget de nœuds par pas (par exemple 800). Au-delà, différer (routeDeferred existe déjà).

**Gain attendu.** Mesuré : le pas maximal du combat contre le Brise-siège passe de 126–191 ms à 18–22 ms sous charge (−85 à −89 %) ; l'A* de la route fautive passe de 120–175 ms à 9–12 ms. Hors charge, on peut attendre moins de 8 ms au lieu de 42 à 52 ms.

**Risques.** Quand la cible est joignable dans la borne, les chemins sont identiques. Sinon, cover() passe au candidat suivant : le comportement des gardes change à la marge, et les tests IA et navigation de checks/simulation.test.mjs et checks/natural-spawn.test.mjs sont à rejouer. Le déterminisme est conservé (algorithme pur). Rien n'est sauvegardé : le cache négatif n'est pas persisté et repart à vide après une restauration.

**Vérifier par.** `cd $F && BOUNDED=1 PATCHED=1 GOD=1 node $B/fight.mjs $PWD 1 60 skilled 0 96`, comparé à la même commande sans BOUNDED, pour les graines 96, 7 et 2026. Puis, sur la branche corrigée, `node $B/fight.mjs <racine> 1 60 skilled 0 <graine>` : pas maximal < 10 ms. Suite checks/.

**Contre-vérification.** Pointe reproduite dans le domaine principal, en temps CPU du fil : le pas à t=32,0 s coûte 28,5 à 66,8 ms (graines 96 et 7, cinq rejeux), avec une seule route sur 60 s de combat : garde e=72, found:false, 2401 nœuds. Avec la borne min(2400, 64+8·Manhattan) : 161 nœuds, pas à 9,5 et 11,3 ms, et les trois empreintes d'état (joueur, ennemis, gravats) sont identiques graine 7 ; l'issue est identique graine 96 (PV restants 137,8). Cause à corriger : ce n'est pas l'effacement du cache d'arêtes. Avec l'effacement désactivé (variante NOWIPE), la pointe reste entière (46,7 ms, 2401 nœuds, knownBefore:0) : les arêtes n'avaient simplement jamais été explorées. La vraie cause est le candidat de cover() : la face extérieure du pilier du portail d'entrée (toRel −31,06 ; 7, hors de la salle, sol 6,65 m plus bas, tactique flank). cover() (:1445-1460) ne teste que blocked(), ni le niveau ni la composante. Corollaire : BOSS-08 ne supprime pas cette pointe. C'est un cas particulier d'IA-01 et de LOOP-02 : prendre l'étiquetage des composantes connexes (exact) comme correctif principal ; la borne locale est un bon garde-fou mais peut rejeter des couvertures réellement accessibles par un détour (160 nœuds pour 9,4 m), donc « identique » n'est prouvé que sur ces combats. Voir BOSS-V1 pour le filtre local.

**Preuve corrigée.** CPU du fil, domaine principal : 51,2 / 28,5 / 46,7 ms (graine 96) et 66,8 ms (graine 7) sans borne ; 9,5 et 11,3 ms avec. NOWIPE : pointe inchangée. Cible : (−31,06 ; 7) relative au centre, 6,65 m sous l'arène, appelant cover(), tactique flank.

**Gain corrigé.** Pas maximal du combat contre le Brise-siège : de 28–67 ms à 9,5–14,5 ms de CPU (−66 à −83 %) ; le maximum restant est le pas de première casse (voir BOSS-V3). Les 126–191 ms d'origine étaient de l'horloge murale sous charge.

### BOSS-08 — Une casse décorative invalide toute la navigation (37 à 44 k cellules) et efface le cache d'arêtes
- sévérité moyenne · catégorie perf-cpu · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P1 · qualité visuellement identique · jeu
- lieux : src/simulation.js:229-235; src/simulation.js:316; src/simulation.js:1379-1390; src/world.js:1226-1228; src/world.js:1364

**Preuve.** syncDestruction (simulation.js:229-235) : toute révision déclenche rebuildCollision et navDirty=true. En :316, `if(navDirty){refreshNav();…}`. refreshNav (:1383-1390) remet toutes les cellules en file, exécute `edgeKnown.fill(0);edgeOpen.fill(0)` et vide les chemins de tous les ennemis (:1389). Mesure (PATCHED=1) : 5 à 8 révisions par minute en combat, surtout les incrustations décoratives de l'arène (3 × 72, world.js:1226-1228, clé 'decor-room-#…:dressing' en world.js:1364). Chaque révision remet en file 37 à 44 k cellules, soit 176 à 333 pas de pumpNav par minute (environ 1,1 ms chacun ; 219 ms de pumpNav sur 60 s au profil). On compte 3 effacements du cache d'arêtes en 40 s : c'est la condition qui rend possible la pointe de BOSS-07.

**Cause.** L'invalidation est globale et non différentielle : la navigation ne sait pas quels colliders ont changé.

**Proposition.** 1) Dans syncDestruction, comparer l'ensemble des colliders solides, ou faire exposer par destruction une boîte englobante `changedBounds` par révision. Si aucun collider solide n'a changé (casse purement décorative), ne pas toucher à la navigation.
2) Sinon, ne remettre en file que les cellules de la boîte élargie de 1 m (rayon du plus gros agent), n'effacer edgeKnown et edgeOpen que sur ces cellules et leurs voisines, et ne réinitialiser que les chemins qui traversent la boîte.
3) Garder l'invalidation globale en secours si la boîte dépasse 25 % de la grille.

**Gain attendu.** Estimation : en combat de boss, pumpNav passe de 176–333 pas par minute à moins de 40. Le cache d'arêtes n'est plus effacé globalement, ce qui supprime la cause en amont de BOSS-07. Les gardes ne perdent plus leur chemin à chaque éclat de décor.

**Risques.** Il faut garantir l'exactitude de la navigation après une destruction (cas d'un mur porteur qui tombe) : rejouer checks/destruction.test.mjs, checks/renderer-destruction.test.mjs et les tests de navigation. L'ordre de pompe change mais reste déterministe. La navigation n'est pas sauvegardée : vérifier qu'une restauration force bien une reconstruction complète.

**Vérifier par.** `cd $F && PATCHED=1 node $B/fight.mjs $PWD 2 60 skilled 1` sur la branche corrigée : edgeWipes=0 et moins de 40 pas de pumpNav par minute. Suite checks/ (destruction, navigation).

**Contre-vérification.** Sonde de signature des colliders : 4 révisions sur 6 (Brise-siège, 60 s) et 5 sur 6 (Colosse, 180 s) ne changent aucun collider solide, et déclenchent pourtant refreshNav complet (:229-235, :316, :1383-1390). Variante « ne rien invalider si les solides sont inchangés » : pas de pumpNav par minute de 263 à 114 (Brise-siège) et de 201 à 57 (Veilleur), CPU moyen par pas −25 à −31 % (0,359 → 0,269 ms et 0,274 → 0,190 ms ; rejeux successifs, non alternés, donc ordre de grandeur). Deux réserves. (1) L'affirmation « supprime la cause en amont de BOSS-07 » est réfutée (voir BOSS-07, variante NOWIPE). (2) Ce n'est pas un état identique : l'empreinte des ennemis diverge sur le Brise-siège (les chemins ne sont plus remis à zéro), l'issue du combat restant la même ; c'est déterministe, mais les tests à trace figée sont à rejouer. La cible « moins de 40 pas par minute » n'est atteinte qu'avec l'invalidation locale (57 à 114 avec le seul filtre). Doublon de SIM-01 et IA-02 : même chantier.

**Preuve corrigée.** Révisions sans changement de solide : 4/6 et 5/6. pumpNav : 263 → 114 et 201 → 57 pas/min avec le seul filtre « solides inchangés ».

**Gain corrigé.** Mesuré avec le filtre seul : −57 à −72 % de pas de pumpNav, −25 à −31 % de CPU moyen en combat de boss.

### BOSS-09 — Les gravats au repos revérifient leur appui à chaque pas : 38 % du CPU de simulation en combat de boss
- sévérité moyenne · catégorie perf-cpu · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P1 · qualité identique · jeu
- lieux : src/simulation.js:992-1005; src/simulation.js:1028-1064

**Preuve.** updateDebris (simulation.js:1028-1064) appelle debrisFloor (:992-1000) et debrisSupport (:1001-1005) aussi pour les pièces posées. Profil node:inspector d'un combat contre le Veilleur sur 60 s (fight.mjs PROFILE_STEP=99999) : sim.step totalise 1321 ms, dont updateProjectiles 588 ms. Dans ce total, updateDebris pèse 503 ms (debrisFloor 402 ms, debrisSupport 317 ms, temps inclusifs) et le sol 549 ms en temps propre. Pour comparaison, tickBoss pèse 48 ms et updateBossAttacks 10,6 ms. Sur un pas de casse de 9 à 13 ms, updateDebris prend 3,5 ms.

**Cause.** Il n'existe pas d'état de sommeil : une pièce immobile coûte autant qu'une pièce en chute.

**Proposition.** 1) Passer une pièce en `q.sleep=true` quand |v| < 0,05 m/s pendant 0,5 s et que son appui est confirmé ; mémoriser `q.sleepRev=s.destructionRevision`.
2) Une pièce endormie n'est plus testée tant que destructionRevision ne change pas. Réveil ciblé des pièces situées dans le rayon d'une explosion + 2 m (grille spatiale déjà utilisée par nearby), ou touchées par la boîte d'un mécanisme mobile (ascenseur, porte).
3) Garde-fou : revérifier 1/8 des pièces endormies à chaque pas, en tourniquet, pour couvrir les cas non prévus.

**Gain attendu.** Estimation : −70 à −85 % sur updateDebris en combat, soit environ 0,1 ms de moins par pas en moyenne, et davantage sur les pas de casse. Le poste « sol » baisse d'autant.

**Risques.** Snapshot des gravats : le plus simple et le plus sûr est de ne pas sauvegarder sleep (tout est réveillé à la restauration) ; sinon, l'ajouter avec une validation atomique. Les tests de gravats de la 0.8 (checks/destruction.test.mjs) doivent retrouver les mêmes positions finales. Le déterminisme est conservé.

**Vérifier par.** `cd $F && PROFILE_STEP=99999 TOPN=30 node $B/fight.mjs $PWD 2 60 skilled 1` : part d'updateDebris avant et après. checks/destruction.test.mjs.

**Contre-vérification.** Compteurs : 96,5 à 97,9 % des pièces-pas sont au repos (50132/51924 et 100906/103103) et repassent par debrisBoxes + debrisSupport (:1028-1064). Variante « pièce au repos non revérifiée tant que la révision de destruction ne change pas » : les trois empreintes d'état sont identiques sur les deux combats testés (Brise-siège et Veilleur, 60 s), CPU moyen par pas 0,359 → 0,239 ms (−33 %) et 0,274 → 0,179 ms (−35 %). Le « 38 % du CPU » est donc crédible, et le gain estimé (−70 à −85 % sur updateDebris) est du bon ordre. Limite de ma preuve : l'arène n'a ni ascenseur ni porte ; la variante par révision seule serait fausse pour une pièce posée sur un support mobile ou sur une autre pièce qui bouge, d'où l'intérêt du réveil ciblé et du tourniquet proposés. Doublon de SIM-03 et LOAD-05 (qui portent la priorité P0 du chantier) ; ne pas sauvegarder l'état de sommeil.

**Gain corrigé.** Mesuré : −33 à −35 % du CPU moyen du pas en combat de boss, état final identique sur 2 combats.

### BOSS-10 — Durée des combats irrégulière (75 à 464 s) et pénurie de munitions en fin de campagne
- sévérité haute · catégorie boss · effort M · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité sans objet · jeu
- lieux : src/world.js:1573; src/simulation.js:1728; src/simulation.js:1645-1651; src/economy.js:53-58; checks/boss-progression.test.mjs:9

**Preuve.** La table de PV v2 (world.js:1573), de 600 à 12000, est verrouillée par checks/boss-progression.test.mjs:9. Les fenêtres durent 3, 2,7 et 2,4 s (simulation.js:1728) : le Veilleur, dont le cœur est le plus haut (66°), a la plus courte. window.mjs : 35 dégâts idéaux par fenêtre au monde 1 (pistolet seul), jusqu'à 677 au monde 16. Fenêtres nécessaires par monde : 17,1 / 7,1 / 10,8 / 12,4 / 14,4 / 19,7 / 7,8 / 13,7 / 13,5 / 9,6 / 16,4 / 14,5 / 11,0 / 18,5 / 19,0 / 14,2 / 19,6 / 21,7. TTK du bot max-DPS invulnérable : 118 s au monde 1, 75, 104, 140, 173 s au monde 6, 160, 241, 257, puis 464 s au monde 18, munitions épuisées [0,0,0,28,1]. TTK idéal limité par les munitions (ttk.mjs) : 121, 55, 76, 101, 124, 145, 54, 110, 97, 67, 152, 104, 81, 173, 159, 114, 207, 179 s.

**Cause.** Les PV croissent régulièrement alors que la puissance du joueur progresse par paliers (calendrier des récompenses : roquettes au monde 7, calibrage +40 % par rang). Les fenêtres diffèrent selon l'espèce, et rien ne ravitaille le joueur pendant le combat.

**Proposition.** 1) Fenêtre uniforme de 3,0 s pour les trois espèces (:1728). Aucune ouverture n'est raccourcie, ce qui respecte le test.
2) Dériver les PV de la puissance mesurée : PV_i = arrondi à 50 de N_i × D_i, avec N_i = 6 + 4·i/17 fenêtres idéales et D_i les dégâts idéaux par fenêtre (window.mjs, ramenés à 3 s). Table obtenue : [200, 850, 900, 850, 1000, 1100, 2750, 2100, 2950, 3950, 3000, 4500, 5500, 4200, 5250, 6450, 6000, 6900], soit de 5,7 à 10 fenêtres, en progression régulière. Variante monotone si la croissance doit rester visible : [250, 550, 700, 800, 950, 1100, 1700, 1950, 2250, 2600, 2950, 3300, 3700, 4100, 4500, 4950, 5400, 5900], soit 4,1 à 8,9 fenêtres.
3) Ravitailler à chaque Surcharge (bossPhaseChange, :1645-1651) : 2 caisses de munitions pour les armes possédées les plus déficitaires, via le butin existant (dropLoot/lootPickup), à r=12 de part et d'autre.
4) Viser 60 à 120 s par combat pour un humain, soit 6 à 10 fenêtres idéales avec 60 % de précision.

**Gain attendu.** L'écart entre le plus grand et le plus petit nombre de fenêtres nécessaires passe de 3,1× à 1,75× (2,2× avec la variante monotone). Plus de fin de campagne au pistolet au monde 18. Le premier boss dure environ 40 s en idéal (environ 1 min pour un humain) au lieu de 118 à 121 s.

**Risques.** Cela contredit la lettre de checks/boss-progression.test.mjs (« without scaling down boss HP or shortening core openings ») et la table reconstruite dans le commit 673d6b2 : il faut une décision explicite de David, puis réécrire le test. Des PV non monotones ne se voient que si l'interface affiche des nombres (game.js:629-634 n'affiche qu'un libellé). Le butin dynamique fait déjà partie de l'état sauvegardé, mais sa validation est à vérifier. Les récompenses (economy.js:54-58) ne changent pas. checks/campaign-simulation.test.mjs est concerné.

**Vérifier par.** `node $B/window.mjs <racine>` : 6 à 10 fenêtres nécessaires à chaque monde. `GOD=1 node $B/fight.mjs <racine> <i> 600 max 1` pour i ∈ {0, 5, 11, 17} : TTK régulier et munitions restantes > 0. `node $B/ttk.mjs`.

**Contre-vérification.** Rejeu : monde 1 tué en 117,7 s (118 annoncés), monde 18 en 423 s (464 annoncés, écart non expliqué, munitions finales identiques [0,0,0,28,1]). Mais le banc part d'un profil sans aucun achat en boutique. Avec Puissance 3 et Réserves 3 (economy.js:19-20, +30 % de dégâts et +75 % de capacité), le monde 18 tombe en 196,8 s avec 251 cellules et 40 grenades en réserve : la « pénurie de fin de campagne » ne concerne qu'un joueur qui n'achète rien. Le bot ne tire en outre que cœur ouvert (0 dégât au corps). La table de PV est verrouillée par checks/boss-progression.test.mjs:9 et vient d'être reconstruite dans 673d6b2 : la refaire contredit une décision récente et demande l'accord explicite de David. À garder sans débat : fenêtre uniforme de 3,0 s (n'en raccourcit aucune) et ravitaillement à la Surcharge. Sans effet sur la fluidité.

**Preuve corrigée.** TTK monde 18, bot invulnérable : 423 s sans boutique, 196,8 s avec Puissance 3 + Réserves 3 (munitions restantes [251,0,0,40,1]).

**Gain corrigé.** Écart de durée réel plus faible qu'annoncé dès que le joueur achète des améliorations ; gain de la refonte des PV surestimé.

### BOSS-11 — Variété faible : 3 scripts répétés 6 fois, un réseau tactique qui rejoue la même attaque et les mêmes gardes sur les 18 mondes
- sévérité moyenne · catégorie ia · effort L · gain qualitatif
- contre-vérification : **plausible**, priorité P3 · qualité meilleure · jeu
- lieux : src/simulation.js:1658-1680; src/brain.js:14-24; src/world.js:1720-1724; src/actors.js:33; src/actors.js:249-357; src/simulation.js:59-60

**Preuve.** simulation.js:1659 fixe un motif par espèce : Colosse slam/ring, Brise-siège rocketZone/sweep, Veilleur ring/rocketZone/sweep/rocketZone. En :1663, le réseau tactique remplace le script 2 attaques sur 3. Ses poids sont écrits à la main (brain.js:14-24) et l'Onde y est favorisée par la distance. mix.mjs : à 10 m et plus, le Colosse choisit l'Onde dans 83 % des cas (15/18). Contre un joueur immobile, le Brise-siège fait 14 Barrages pour 2 Balayages et le Veilleur 14/2/1. Les gardes sont toujours 6 drones de type 0 (3 PV), libérés en 3+3 aux Surcharges (world.js:1722-1723), quel que soit le monde : au monde 18, chacun tombe en un tir de pistolet. Entre deux cycles, seuls changent l'échelle (5,4 / 7,2 / 9), les PV et l'adaptation (dégâts ×0,95 → ×1,545, cadence ×0,95 → ×1,248 ; campaignPolicy, simulation.js:59-60). Les trois espèces partagent le même modèle articulé (actors.js:249-357) : seuls l'échelle et le jeu de couleurs changent (actors.js:33). Aucun renfort infini : la libération est unique (bossReleased).

**Cause.** La progression ne joue que sur des multiplicateurs, et l'arbitrage du réseau n'a aucune mémoire des attaques récentes.

**Proposition.** 1) Anti-répétition dans beginBossAttack : pénalité de −0,35 sur le score de la famille jouée au tour précédent, et interdiction d'une 3e attaque identique de suite (mémoriser e.lastKinds sur 2 éléments ; champ boss à sauvegarder).
2) Débloquer des modificateurs par cycle c = floor(i/3) :
- c ≥ 1 : une roquette de plus.
- c ≥ 2 : l'Écrasement laisse un sol brûlant pendant 3 s (8 dégâts/s, zone visible).
- c ≥ 3 : Onde à brèches tournantes (BOSS-02).
- c ≥ 4 : Balayage rotatif (BOSS-05).
- c ≥ 5 : combo Onde + Barrage.
3) Composer les gardes par chapitre, avec les types existants (world.js:1720-1724) : c0–1 : 3+3 drones ; c2–3 : 2 drones + 1 grenadier, deux fois ; c4–5 : 2 drones + 1 lance-roquettes, deux fois.
4) Donner à chaque espèce une attaque signature de phase 2, télégraphiée au moins 1,6 s : charge de 6 m pour le Colosse, tapis de bombes en ligne pour le Brise-siège, rayon du cœur pour le Veilleur.

**Gain attendu.** Des combats différents d'un cycle à l'autre. Aucune famille ne dépasse 50 % des attaques (mesurable avec mix.mjs).

**Risques.** Le nouveau champ lastKinds s'ajoute à la liste BOSS (simulation.js:22) : il faut monter la version du snapshot et valider atomiquement (le test « corrupt phase=3 rejected » sert de modèle). À adapter : checks/brain.test.mjs:156-160 (le réseau fait passer la 1re attaque du Colosse de slam à ring) et, côté gardes, le test « phases release 6 guards » (checks/simulation.test.mjs:1727-1812) ; changer les gardes modifie aussi l'empreinte du monde (checks/world.test.mjs, checks/campaign-world.test.mjs). La taille du fichier augmente.

**Vérifier par.** `node $B/mix.mjs <racine> 120 1` : aucune famille au-dessus de 50 % à toutes les distances. `node $B/explore.mjs <racine>` : composition des gardes par monde. Tests brain, simulation et world.

**Contre-vérification.** Code relu : motifs fixes par espèce (:1659), réseau qui remplace 2 attaques sur 3 (:1663), 6 drones de type 0 en 3+3 (world.js:1722). Mes combats recoupent la domination de l'Onde chez le Colosse à 15 m : 13 Ondes pour 4 Écrasements (76 %) au monde 1, 16 pour 4 ou 5 (76 à 80 %) au monde 4 ; 83 % annoncés. Je n'ai pas rejoué mix.mjs. L'anti-répétition (pénalité −0,35, pas de 3e identique) est peu coûteuse mais ajoute lastKinds à l'état du boss, donc au format de sauvegarde ; les modificateurs par cycle et les gardes par chapitre changent l'empreinte du monde et la taille. Contenu de jeu, sans effet sur la fluidité : après les correctifs d'équité.

**Preuve corrigée.** Colosse, joueur à 15 m : 76 à 80 % d'Ondes sur 3 combats rejoués.

### BOSS-12 — Peu de sensation de puissance : un boss-tourelle qui pivote par à-coups, sans recul ni tremblement, et des tirs au cœur indiscernables des tirs au corps
- sévérité haute · catégorie ressenti · effort L · gain qualitatif
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur et jeu
- lieux : src/simulation.js:1665; src/simulation.js:1683; src/simulation.js:1691-1696; src/simulation.js:1717; src/simulation.js:812-818; src/simulation.js:1135; src/audio.js:600-602; src/motion.js:36-46; src/game.js:194-200; src/game.js:722

**Preuve.** Le boss ne marche, à 0,8 m/s, que s'il n'a aucune attaque en cours, que son cœur est fermé et que bossClock > 0 (simulation.js:1691, 1696). Cela laisse environ 0,1 s de marche par cycle : 0,4 à 1,1 m par minute mesurés (yaw.mjs, fight.mjs). Le lacet est affecté d'un coup (:1665, :1693, :1717) : 104 à 138 sauts sur 2400 pas, médiane 4,8°, maximum 111 à 132°, ce qui déplace les extrémités de la silhouette de 15,7 à 31 m en un seul pas. Le boss ne vacille jamais : `e.stun=0` à chaque tick (:1683), et un tir au cœur ne pose que e.hurt=.2 (:816). Le retour de touche est le même pour le cœur et le corps : `if(connected){s.hits++;s.hitMarker=.18;emit('hit');}` (:1135), avec le son 'hit' = pcm('click',.12) (audio.js:600-602). Côté caméra, motion.impulse ne gère ni bossImpact, ni bossRoar, ni bossDeath (motion.js:36-46). game.js:194-200 n'applique l'impulsion 'blast' qu'aux événements 'explosion' à moins de 14 m, et renderer.draw reçoit shake:0 (game.js:722). Les 12 explosions de mort sont ajoutées sans emit('explosion') (simulation.js:818). Retours de David : jeu raide, sons d'armes trop légers, Doom et Quake 3 comme références.

**Cause.** Le boss est modélisé comme une machine à états d'attaques au sol, sans locomotion ni réaction aux coups. Le retour sensoriel n'a aucun canal propre au boss.

**Proposition.** 1) Limiter la vitesse de rotation : e.yaw += clamp(wrap(cible − yaw), −ω·dt, ω·dt), avec ω = 60°/s (90°/s en phase 2). Les attaques visent avec le lacet réel : contourner le boss devient une esquive.
2) Marche lourde entre les attaques et pendant le tell des attaques à distance : 1,2 m/s vers le joueur si d > 16 m, recul si d < 9 m, sans s'approcher à moins de 6 m du bord. Un événement 'bossStep' toutes les 0,9 s (impulsion caméra 'blast' de 0,25 à moins de 25 m et grondement grave).
3) Vacillement : e.poise accumule les dégâts au cœur. S'il atteint 12 % des PV max dans une même fenêtre, le boss vacille 0,6 s (le corps recule, la fenêtre gagne 0,5 s), au plus une fois par fenêtre.
4) Distinguer le tir au cœur : un événement 'weakHit' avec un son métallique aigu généré par le code et un réticule orange pendant 0,3 s ; le tir au corps garde un son sourd atténué.
5) Caméra : bossImpact déclenche impulse('blast', 0,8·clamp(1 − d/40)), le passage de l'Onde une impulsion de 0,4. À la mort, un arrêt sur image de 120 ms (rendu seulement), un blast de 1,0 et l'émission des 12 explosions.

**Gain attendu.** Le boss se lit comme un être massif qui pèse et réagit aux coups, et le tir au cœur est clairement récompensé. Cela répond directement au retour « raide ».

**Risques.** La rotation limitée, la marche et le vacillement sont simulés : leurs nouveaux champs (poise, staggerTimer, stepClock) entrent dans la liste BOSS (simulation.js:22), ce qui impose de monter la version du snapshot et de valider atomiquement. À rejouer : les tests snapshot/restore, « slam escapable » et checks/motion.test.mjs. Le déterminisme est conservé si tout reste calculé dans step. L'arrêt sur image doit rester côté rendu, sans modifier le dt de la simulation. Les sons doivent être générés par le code (AGENTS.md).

**Vérifier par.** `node $B/yaw.mjs <racine> 2` : saut maximal ≤ ω·dt (1° à 60 Hz). `node $B/fight.mjs <racine> 2 60 skilled 1` : déplacement ≥ 20 m/min et vacillements comptés. Tests snapshot et motion.

**Contre-vérification.** yaw.mjs rejoué (Veilleur) : lacet modifié sur 104 pas sur 2400, saut médian 4,8°, maximum 132,3°, extrémité déplacée de 31,2 m en un pas. Déplacement du boss sur un combat entier : 0,4 à 1,1 m. Code conforme : lacet affecté d'un coup (:1665, :1693, :1717), stun remis à 0 à chaque tick (:1683), même événement 'hit' pour cœur et corps (:1135), impulse() sans cas boss (motion.js:36-46), shake:0 (game.js:722), 12 explosions de mort ajoutées sans emit (:818). Une correction : « ne fait jamais trembler la caméra » est trop fort, l'Écrasement et les roquettes passent par explode() qui émet 'explosion', donc l'impulsion 'blast' à moins de 14 m (game.js:199) ; ce sont l'Onde, le Balayage, le rugissement et la mort qui n'ont aucun retour. Répond directement à « gameplay raide, pas assez vif ». Répartition : motion.js est dans FERRO (ajouter un canal d'impulsion générique paramétré, sans changer les valeurs par défaut) ; rotation limitée, marche, vacillement et weakHit sont dans METAL. Risques réels : la rotation à 60°/s change la visée des attaques (l'orbite du joueur à 29°/s reste suivie, mais le dash latéral devient une esquive, donc équilibrage à rejouer) ; poise, staggerTimer et stepClock entrent dans la liste BOSS et le format de sauvegarde. Commencer par ce qui ne touche pas la simulation : son et réticule de tir au cœur, impulsions caméra, émission des explosions de mort.

**Preuve corrigée.** Saut de lacet maximal 132,3°, 104 pas sur 2400 avec rotation ; déplacement total du boss 0,4 à 1,1 m par combat de 60 à 180 s.

### BOSS-13 — L'arène impose 100 m de portée de rendu à toutes les qualités, y compris Canvas2D en qualité basse
- sévérité moyenne · catégorie perf-gpu · effort S · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité dégradée · moteur et jeu
- lieux : src/game.js:424-425; src/world.js:1204; src/renderer.js:725-731; src/renderer.js:734

**Preuve.** game.js:425 : `const range=longView?100:renderer.stats.backend==='canvas2d'?(quality==='high'?55:quality==='low'?32:44):(quality==='high'?90:quality==='low'?54:70)`. La zone longView couvre le carré de l'arène plus 35 m de marge (game.js:424 ; world.js:1204, range:100), et renderer.js:725-731 étend aussi la distance à 100 m. range.mjs : depuis le centre, 4822 à 7913 maillages statiques dans la portée à 100 m, contre 918 à 1534 à 54 m (qualité basse) et 2219 à 4172 à 70 m (qualité moyenne) ; jusqu'à 10584 depuis l'entrée. Or la diagonale de l'arène ne fait que 85 m et l'Onde 27 m.

**Cause.** La portée étendue sert à garder la silhouette du géant visible, mais elle s'applique à toute la scène et écrase les réglages de qualité.

**Proposition.** 1) Fixer la portée de l'arène selon la qualité : 100 m en haute, 80 en moyenne, 64 en basse, 48 en Canvas2D.
2) Mieux : toujours dessiner le boss et les maillages de la région de l'arène (tag de région), quelle que soit la distance, et garder la portée normale pour le reste de la scène.
3) Régler le brouillard sur la portée effective pour que la coupure ne se voie pas.

**Gain attendu.** Estimation : −60 à −85 % de maillages soumis dans l'arène en qualité basse et en Canvas2D (918–1534 contre 4822–7913). Le combat devient plus fluide sur mobile et sur le repli logiciel.

**Risques.** Coupure visible au niveau des murs (à régler avec le brouillard). Respecter la règle d'AGENTS.md : vraie 3D avec repli Canvas2D. Lisibilité sur mobile. Tests à adapter : checks/renderer-destruction.test.mjs et checks/options.test.mjs si la portée y est vérifiée. Aucun effet sur la simulation.

**Vérifier par.** `node $B/range.mjs <racine>` pour chaque qualité. Capture headless en file:// de l'arène en qualité basse, pour vérifier la silhouette du boss et l'absence de coupure.

**Contre-vérification.** Code conforme : game.js:425 force 100 m dans la zone longView et renderer.js:725-735 (extendedDistance, y compris softwareDistance pour Canvas 2D) porte la distance à 100 m pour toutes les qualités. Deux objections. (1) La mesure compte les maillages dans un rayon, sur 360°, et non ceux réellement soumis après tri par le champ de vision : le rapport entre portées est indicatif, pas le nombre de dessins économisés ; je n'ai pas rejoué range.mjs ni mesuré le rendu. (2) Raccourcir la portée en qualité moyenne et basse retire du décor lointain aujourd'hui visible depuis l'arène (niveau au-delà du pont, portails de 18 à 24 m vus depuis l'angle opposé à 85 m) : c'est une perte d'image, contraire à l'exigence « sans perdre la moindre qualité ». À n'accepter que comme option désactivée par défaut, ou sous la forme 2 (région de l'arène et boss toujours dessinés) après preuve par différence d'images que le reste est déjà masqué par le brouillard. Le gain sans perte passe plutôt par le tri et les lots statiques des axes RCPU et RGPU. extendedDistance vit dans le renderer de FERRO : tout changement doit rester neutre pour BITUME et Point de rupture.

**Gain corrigé.** Non démontré en dessins réels ; perte de portée visible hors qualité haute.

## Constats ajoutés par le contre-vérificateur

### BOSS-V1 — cover() propose aux gardes la face extérieure des piliers de portail, hors de l'enclos et 6,65 m plus bas : c'est la vraie cause de la pointe de BOSS-07
- sévérité haute · catégorie ia · effort S · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · jeu
- lieux : src/simulation.js:1445-1460; src/simulation.js:1402-1414; src/world.js:1247-1252; src/world.js:1722

**Preuve.** Sonde de route (vfight.mjs, domaine principal, graines 96 et 7) : la seule route du combat contre le Brise-siège vient de cover() (tactique flank), garde e=72 parti de (−21,6 ; 6,4) vers (−31,06 ; 7,0) relatif au centre de l'arène, tdy=−6,65 m (groundAt de la cible moins baseY du garde), found:false, 2401 nœuds, knownBefore:0. Le point est à 0,56 m à l'ouest du pilier d'entrée (world.js:1247-1252, pilier de 2,2 m centré en x=−29,4, z=±7), donc au-delà de la bordure x=−30. Variante NOWIPE (edgeKnown/edgeOpen jamais effacés) : pointe inchangée, 46,7 ms de CPU, ce qui écarte l'effacement du cache comme cause. cover() (simulation.js:1445-1460) ne filtre ses candidats que par distance (10 m) et blocked(cx,cz,.4).

**Cause.** Les quatre points candidats autour de chaque solide sont acceptés sans vérifier qu'ils sont au niveau du garde ni dans la même composante de navigation ; pour un solide posé sur la bordure d'une plateforme, un candidat tombe dans le vide et A* épuise ses 2400 nœuds.

**Proposition.** Dans cover(), avant setGoal : rejeter le candidat si |groundAt(cx,cz) − e.baseY| > 0,6 m (un appel à ground, déjà en cache), puis, quand IA-01 est en place, si navComp[nearestNode(cx,cz)] ≠ navComp[nœud du garde]. Même filtre dans peek() et dans le choix des points de flank/strafe. Garder la borne locale de BOSS-07 comme garde-fou. Critère d'acceptation : sur `GOD=1 node vfight.mjs <racine> 1 60 skilled 0 {96,7,2026}`, 0 route en échec à plus de 200 nœuds et pas maximal sous 15 ms de CPU.

**Gain attendu.** Supprime la recherche vouée à l'échec elle-même (28 à 67 ms de CPU mesurés), au lieu de seulement la plafonner à 161 nœuds (7 à 11 ms). Vaut pour les 6 piliers de portail et tout solide en bord de plateforme des 18 mondes.

**Risques.** Déterminisme conservé (filtre pur). Un seuil de hauteur trop strict écarterait une couverture en haut d'une rampe courte : préférer le test de composante dès qu'il existe. Aucun champ sauvegardé. Tests IA de checks/simulation.test.mjs et checks/natural-spawn.test.mjs à rejouer.

**Vérifier par.** node bancs/boss-verif2/vfight.mjs <racine> 1 60 skilled 0 96 : ligne ROUTES (failed, explored, tdy) et ligne CPU (max). Le correctif patches.mjs contient déjà une variante heightFilter non branchée à activer.

### BOSS-V2 — « Démo qui dure » : un pilote automatique équipé par défaut meurt au premier colosse en 38 à 101 s
- sévérité haute · catégorie démo · effort L · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : src/game.js; src/simulation.js:116; src/simulation.js:1915; src/simulation.js:1722

**Preuve.** METAL 0.8 n'a aucun mode démo (aucune occurrence de demo/attract dans src/game.js), alors que Point de rupture en a un (src/interface/titre.js, minicarte.js, hud.js). Mesure avec le bot « max » de vfight.mjs (équipement par défaut de la campagne v2 : pistolet + bouclier à gauche, simulation.js:116) : mort à 38,1 s au monde 1, 80,6 s au monde 3, 48,4 s au monde 4, 101,5 s au monde 6, toujours par l'Onde. Sans bouclier (dash) : mort à 116,0 s au monde 1 (boss à 10/600) et à 132,5 s au monde 4, victoire aux mondes 3 et 6. Avec le correctif BOSS-01 et un pilote qui dashe ou lève la garde : 4 victoires sur 4 en 104 à 173 s, 53 à 90 PV restants.

**Cause.** Une démo qui enchaîne les mondes doit traverser l'arène du colosse ; avec l'équipement par défaut, la seule parade à l'Onde (le dash) est désactivée, donc tout pilote meurt en moins de deux minutes au boss et la démo boucle sur des morts.

**Proposition.** FERRO : un contrôleur de démo générique, sans dépendance au jeu (minuterie d'inactivité à l'écran-titre, arrêt immédiat à la première entrée clavier, souris, tactile ou manette, enchaînement de séquences, chien de garde qui relance la séquence si la progression stagne plus de N secondes, graine fixe). METAL : un pilote qui produit les mêmes entrées qu'un joueur (moveX/moveY, yaw/pitch, fire, fireLeft, dash) à partir de l'état simulé, repris de la politique « skilled/max » de bench/boss/fight.mjs : orbite à 15 m, fuite des zones signalées, dash au passage du front d'Onde, garde levée si le dash recharge, tir au cœur pendant les fenêtres. Pas d'invulnérabilité cachée : en cas de mort, reprise au point de reprise puis monde suivant après 2 échecs. Critère d'acceptation : 30 minutes de démo en horloge virtuelle (bench/loop/harness.mjs) sans blocage, au moins 2 colosses tués, aucun pas de plus de 16 ms dû au pilote.

**Gain attendu.** Démo qui tient la durée : mesuré sur 4 mondes, le pilote passe de 0 victoire sur 4 (bouclier actuel) à 4 sur 4 une fois BOSS-01 appliqué.

**Risques.** Dépend de BOSS-01 (sinon le pilote doit retirer le bouclier, ce qui donne une démo non représentative). Le pilote ne doit lire que l'état simulé pour rester déterministe et rejouable ; il ne doit rien écrire dans les sauvegardes ni dans l'économie du joueur. Taille : quelques Ko. Lisibilité mobile : bandeau « DÉMO » et sortie au premier toucher. Le contrôleur FERRO doit rester inactif par défaut pour BITUME et Point de rupture.

**Vérifier par.** FIX=1 FIXBOT=1 node bancs/boss-verif2/vfight.mjs <racine> {0,2,3,5} 180 max 1 (victoire attendue), puis le même pilote branché dans bench/loop/harness.mjs sur 30 minutes virtuelles.

### BOSS-V3 — Après correction de la route, la pointe maximale du combat est le pas de première casse (11,9 à 20,7 ms de CPU), présent dans tous les combats vers t=10,97 s
- sévérité moyenne · catégorie saccade · effort M · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · jeu
- lieux : src/simulation.js:229-235; src/simulation.js:932-950; src/simulation.js:1028-1064; src/simulation.js:316

**Preuve.** Temps CPU du fil, domaine principal, pas à t=10,90–10,97 s (événements explosion:steam + materialBreak, juste après la première attaque du boss) : 19,4 / 14,5 / 16,0 / 19,0 / 20,7 / 18,8 / 11,9 ms sur 7 rejeux (Brise-siège graines 96 et 7, Veilleur). Avec l'A* borné, c'est le pas le plus cher du combat (14,5 et 11,9 ms). Le pas suivant (10,98 s) coûte encore 4,7 à 10,9 ms et lance 768 cellules de pumpNav. Avec la variante « gravats endormis » le pas tombe à 10,6 ms, avec « solides inchangés » à 9,6 ms. Le premier tour l'avait mesuré (9 à 13 ms, dont souffle 2,7, updateDebris 3,5, vapeur 3,75 ms) sans en faire un constat.

**Cause.** Le même pas cumule l'explosion, la révision de destruction (rebuildCollision), la création des gravats, l'effet de vapeur et le déclenchement de refreshNav ; rien n'est étalé sur les pas suivants.

**Proposition.** Étaler sans changer le résultat visible : (1) appliquer les correctifs SIM-01 et SIM-03 (les deux réduisent déjà ce pas de 34 à 40 % d'après mes variantes) ; (2) déplacer refreshNav au pas suivant la révision (la navigation est déjà pompée par tranches) ; (3) profiler ce pas précis avec PROFILE_STEP=<n° du pas> pour attribuer le reste avant d'aller plus loin. Critère : pas de casse sous 8 ms de CPU dans le domaine principal sur les 3 espèces.

**Gain attendu.** Estimé : pas de première casse de 12–21 ms à moins de 8 ms ; c'est la dernière saccade perceptible du combat une fois la route corrigée.

**Risques.** Décaler refreshNav d'un pas change l'ordre des mises à jour de navigation : déterministe, mais l'état peut diverger d'un rejeu figé (tests de destruction et de navigation à rejouer). Ne pas différer rebuildCollision, sinon un projectile traverserait un mur détruit ou buterait sur un mur absent pendant un pas.

**Vérifier par.** GOD=1 BOUNDED=1 node bancs/boss-verif2/vfight.mjs <racine> {0,1,2} 60 skilled 0 : ligne CPU, entrées à t≈10,97 ; comparer aux variantes SLEEP=1 et SOLIDONLY=1.
