# Lot 09 — Ressenti : déplacement, bouclier, armes
## But
Rendre le déplacement vif (élan, saut, contrôle aérien), le bouclier réellement protecteur (arc horizontal, absorption 100 %, parade) et les armes réactives (cadence exacte, chaleur par arme, recul distinct). Aucun asset importé, aucune dépendance, 60/120/144 Hz sans saccade.
## Tâches, dans l'ordre

### T1 — Physique de déplacement : élan, air, atterrissage [FEEL-08]
- Où : src/simulation.js:95 (profil), :324-333 (land), :340-341 (air control), :423-430 (intégration), :1322 (clamp observedV) ; src/motion.js:75 (plongée caméra).
- Quoi : profil moderne {walk 4,2, sprint 7,6, accel 16, friction 9, stop 2,2, air_accel 1,1, plafond_horiz 10,5, gravité 20 hors pads}. Friction exponentielle au-dessus de STOP, linéaire en dessous ; accélération en rampe plafonnée par projection (forme fermée par morceaux, pas Euler). land() conserve la vitesse horizontale (sauf padId ≠ null). Plongée caméra view.height −min(.08, impact×.012), ω 18. Élargir clamp observedVX/VZ à ±11.
- Preuve exigée : bench/feel/move-metrics.mjs + move-tune.mjs → 90 % sprint ≤ 90 ms, arrêt 0,6-0,8 m, inversion ≤ 130 ms, vitesse post-chute ≥ 90 % arrivée. Nouveau test : même trajet à 20/60/120 fps, écart < 0,05 m.
- Qualité : meilleure (mesuré : arrêt 125→242 ms, dérive air 0,2→1,6 m).
- Garde-fous : déterminisme par forme fermée (pas Euler) ; sauvegardes → physicsVersion 2 (révision unique fin chantier) ; IA observedV à ±11 ; profil legacy et tests :546-606 intacts ; concepts Q3 uniquement, zéro GPL ; < 1 Ko.
- Dépend de : rien (fondation du lot).

### T2 — Séparer frappe et esquive du bouclier [FEEL-01]
- Où : src/simulation.js:800 (bash/dash), :1915 (filtre dash:false), :775 (invulnérabilité) ; src/game.js:163, :223 (toasts) ; index.html (bandeau) ; checks/checkpoint.test.mjs:302-310, :317, :351 ; checks/progression.test.mjs:267 ; src/options.js:4 (libellé).
- Quoi : :800 → frappe sur input.bash seul. Supprimer le filtre dash:false de :1915. Forcer q.raised=false tant que p.dashing>0. Action « melee » (V / bouton tactile) → input.bash avec bouclier. Espace = saut (FEEL-09), R = esquive (migration options.js:17, toast « Espace : saut · R : esquive »). Corriger :1722 pour ne pas poser hitPlayer=true quand hurt() est ignoré par l'invulnérabilité.
- Preuve exigée : bench/feel/ring-dash.mjs (bouclier + dash calé) → 0/7 ondes touchées. bench/feel/dash-shield.mjs → p.dashing>0 sans perte d'énergie. checkpoint.test réécrit : « V frappe, R esquive ».
- Qualité : meilleure (mesuré : 7/7→0/7 touches avec dash calé).
- Garde-fous : tests progression.test:267, checkpoint:317/:351 à réécrire ; libellé options.js:4 ; déterminisme intact ; < 0,5 Ko.
- Dépend de : rien (indépendant de T1).

### T3 — Garde : arc horizontal + économie + source aux zones [FEEL-02, FEEL-03, BOSS-01]
- Où : src/simulation.js:766-770 (shieldFacing), :776-778 (absorption), :798-805 (drain/recharge), :1722 (zones boss sans source), :1928 (source balle) ; src/brain.js (flanc/tir cloche) ; checks/armor.test.mjs:44-62 ; checks/progression.test.mjs:259-262.
- Quoi : shieldFacing → arc horizontal ±70° sur la direction d'arrivée (opposé vitesse balle ; position attaquant en repli ; centre souffle), sans pitch ni hauteur. Absorption 100 % direct, 75 % souffle ; coût 1,0 énergie/pt ; recharge 1,2 s (1,6 si casse) ; relever ≥ 25 ; drain 1,5/s ; régén 6/s après 1,2 s sans coup ; recharge baissée 28/s. Parade : garde levée ≤ 0,15 s → coup gratuit, tireur étourdi 0,45 s (rusher 1,0 s + recul 1,2 m). Point 1 de BOSS-01 : source {x:a.x, y:p.y+1.1, z:a.z, blast, ground:true} en :1722. Fixer table parades (Onde = saut/brèche 75 % ; Balayage = esquive/saut ; Écrasement = blocage 75 %/sortie). Renforcer flanc IA quand shield.raised.
- Preuve exigée : bench/feel/shield-cone.mjs → 100 % à ±70°, 0 % à 80°, indépendant hauteur/pitch. bench/feel/shield-proto.mjs 30 10 → survie ≥ 29 s, ≤ 2/10 morts de face ; heavy/flank mortels sans riposte. bench/boss/ bots esquive+bouclier+saut survivent, aucun à 0 dégât sur 120 s.
- Qualité : meilleure (mesuré : survie 23,4→29,8 s ; PV perdus 79→37 sur 20 s).
- Garde-fous : raiseAge hors instantané (validation atomique :2088-2093) ; tests armor.test:44-62 et progression.test:259-262 recalibrés ; équilibrage conditionné par T9/T10 ; < 1 Ko.
- Dépend de : rien (parallèle T1, T2).

### T4 — Saut : verticalité, coyote, bunny-hop [FEEL-09]
- Où : src/simulation.js:260 (marche), :328 (fatalFall), :2088-2093 (validAir), :8 (GRAVITY partagée) ; src/options.js:4, :17 ; src/world.js:112-116 ; src/game.js:96, :683-688.
- Quoi : saut 6,2 m/s (apex 0,96 m, 620 ms, g=20 joueur uniquement — projectiles/grenades/IA gardent g=12). Coyote 0,10 s, tampon 0,12 s. Bunny-hop : pas de friction sur sous-pas d'atterrissage si saut en tampon, plafond 10,5 m/s. Clip 2,4 m sur outdoorBoundaries (joueur seul, empreinte/fingerprint inchangés). Chute mortelle jugée sur hauteur d'appui > 1,5 m (pas sur vitesse d'impact). physicsVersion 2 : validAir accepte airVY ≤ 6,2 quand padId null ; restore accepte v1 et v2. Action « jump » Espace ; manette A ; tactile bouton.
- Preuve exigée : bench/feel/jumpable.mjs → 19-32 obstacles franchis/monde. bench/feel/parapets.mjs + boundaries.mjs → jamais sortie de bornes. Test restore pendant un saut. options.test : migration Espace→saut.
- Qualité : meilleure (mesuré : 19-32 obstacles franchissables ; ondes sautables).
- Garde-fous : sortie de niveau (97 murets bas + substrat) → test non-sortie obligatoire ; GRAVITY partagée → g=20 réservé au joueur ; IA sight/observedVY ; AGENTS.md bouton tactile ; ~2 Ko.
- Dépend de : T1 (contrôle aérien, plafond 10,5), T2 (Espace libéré).

### T5 — Esquive au bord d'un rebord [FEEL-V2]
- Où : src/simulation.js:266, :269 (décollage), :330 (atterrissage), :396-402 (dashIntegral), :445-451 (airMove).
- Quoi : au décollage pendant p.dashing>0, injecter la vitesse instantanée de l'esquive (dérivée de dashIntegral/dashAge × motionProfile.dash × dashX/Z) dans airVX/airVZ, plafonnée 16 m/s. Laisser p.dashing finir son décompte en l'air (décrément dans airMove). Ne pas appeler stopMotion() ; zéro uniquement les mélanges d'animation. À l'atterrissage, conserver vitesse horizontale (commun T1).
- Preuve exigée : bench/feel-verif2/t10.mjs (3 distances au rebord) → ≥ 180 ms invulnérabilité, ≥ 12 m/s au décollage. Test simulation : esquive au bord, joueur dans les bornes.
- Qualité : meilleure (mesuré : invuln 17-100→~200 ms ; vitesse 7,6→~15 m/s).
- Garde-fous : sortie de niveau couverte par le test de FEEL-09 ; validAir accepte déjà ≤ 32 ; plafond vitesse garde chutes mortelles ; déterminisme intact.
- Dépend de : T1 (airMove, conservation vitesse).

### T6 — Franchissement de solides bas + lissage caméra [FEEL-V3]
- Où : src/simulation.js:209-214 (support), :242-246 (blocked), :260-271 (move) ; src/game.js:720 (caméra) ; src/motion.js:74-77 (FERRO).
- Quoi : (1) motion.js (FERRO) : canal view.step — si |Δy| ≤ 0,45 m au sol, décalage exponentiel ω 14 (~200 ms) ajouté à la caméra et au porte-arme ; paramètre optionnel (compat FERRO v0.2). (2) simulation.js move(), joueur seul : si case bloquée par solide dont dessus ≤ 0,42 m et free(x,z,dessus) vrai → monter dessus. Ennemis et navigation inchangés.
- Preuve exigée : bench/feel-verif2/t8.mjs → marche 0,40 m, déplacement caméra < 0,08 m/image à 60 fps ; solide 0,25 m franchi. Test motion : Δy 0,40 → décalage initial −0,40, revenu < 0,04 en 200 ms. Test simulation : solide 0,25 collé à un mur reste bloquant.
- Qualité : meilleure (mesuré : 16-24 solides/monde cessent de bloquer ; caméra 0,40→<0,08 m).
- Garde-fous : ne pas ouvrir passage par-dessus solide adossé à mur (exiger free) ; IA/navigation intactes ; lissage hors simulation/sauvegardes ; FERRO paramètre optionnel.
- Dépend de : T1 (conservation vitesse à l'atterrissage).

### T7 — Retour visuel du blocage [FEEL-04]
- Où : src/simulation.js:782 (sortie hurt après absorption) ; src/game.js:193-203, :714 (voile), :573-583 (flash bouclier) ; src/motion.js:36-46 (impulse) ; src/audio.js:506 ; style.css #damage.
- Quoi : hurt() : si amount ≤ 0,01 après absorption → emit('shieldBlock') puis return, sans s.damage ni reset combo. Sinon s.damage = clamp(.35+amount/25, 0, 1). emit('hurt', {amount, x, z, blocked}) avec direction (vitesse balle, cf FEEL-02). game.js : arc directionnel 40° autour réticule (rouge reçu, cyan bloqué, chevron daltonien, 0,6 s, 4 max). leftMotion.impulse('block') 3,5 ; flash bord bouclier alpha +.25 décroissance 8/s. Son : impact:metal .40 + tintement 2,6 kHz τ 15 ms. Vibration manette .4 / 70 ms.
- Preuve exigée : bench/feel/block-feedback.mjs → événements ['shieldBlock'] seul, s.damage=0, combo conservé. Test DOM : arc présent après coup latéral.
- Qualité : meilleure (qualitatif : plus de voile rouge sur blocage complet).
- Garde-fous : dépend de FEEL-03 (absorption 100 %) pour que amount ≤ 0,01 soit atteignable ; dépend de la passe de composition (lot précédent, RGPU-07) pour les uniformes voile/vignette ; combo conservé = changement de règle à documenter ; accessibilité couleur doublée forme ; ~2 Ko.
- Dépend de : T3 (FEEL-03), passe de composition (lot précédent).

### T8 — Recul par arme et réaction caméra [FEEL-13]
- Où : src/motion.js:36-46 (impulsions), :58 (ω), :69-77 (canal kick) ; src/game.js:720 (pitch caméra), :722 (shake:0) ; src/renderer.js:1009-1010, :1253-1254, :1497-1498 (fx.shake).
- Quoi : ω par arme (SMG 38, pistolet 30, pompe 18, roquette 14), impulsions × ω/27. Canal view.pitch (SMG .35°, pistolet .6°, pompe 2°, roquette 2,6°, grenade 1,2°, ω 16) ajouté à camera.pitch en game.js:720 — déplacer le réticule du même angle (décalage ~0,48° ≈ 7 px à 1080p). Punch FOV pompe −1,8°, roquette −2,5° (ω 14). Shake renderer : explosions .6×(1−d/8), roquette .25, pompe .15, décroissance 6/s. Roulis SMG ±.6°. Mémoriser ω à l'impulsion (canal unique aujourd'hui). Réduction ×0,3 quand softMotion=false (prefers-reduced-motion). Table d'impulsions en paramètre FERRO.
- Preuve exigée : bench/feel/kick.mjs étendu → pic, retour <10 % par arme (SMG ~129 ms, pompe ~272 ms, roquette ~349 ms), mouvement caméra ≠ 0. Capture headless file:// optionnelle.
- Qualité : meilleure (mesuré/calculé : caméra 0→2-2,6° ; SMG 183→129 ms).
- Garde-fous : softMotion=true = défaut « Doux » actif, false = reduced-motion (correction contre-vérif) ; réticule à déplacer avec le pitch ; FERRO paramétrable ; < 1 Ko ; dépend de la passe de composition (uniformes) pour le shake.
- Dépend de : passe de composition (lot précédent, RGPU-07).

### T9 — Cadence exacte des armes [LOOP-08]
- Où : src/simulation.js:1114-1115 (weaponWait), :1904-1905 (décréments), :2008, :2100 (validation restore).
- Quoi : dans fire(), weaponWait[w] = max(0, delay − carry[w]) avec carry[i] = max(0, dt − ancienneValeur) mémorisé si ancienneValeur > 0 (état ≥ 0, non sérialisé, format inchangé). Décrément sans plancher pendant l'appui ; fin de pas : if(!input.fire || x < −dt) x = max(0, x). Garantit plancher ≥ 0 avant snapshot.
- Preuve exigée : bench/loop/firerate2.mjs → 80 tirs/10 s à tous les pas (6,94-33,3 ms). npm test vert (tests de combat recalibrés).
- Qualité : meilleure (mesuré : 75→80 tirs à 60 Hz ; 67→80 au pas des tests).
- Garde-fous : +6,7 % dps SMG → équilibrage T10/T12 ; tests combat à mettre à jour ; validation restore ≥ 0 garantie ; déterminisme intact.
- Dépend de : rien (préalable obligatoire à FEEL-12, arbitrage).

### T10 — Surchauffe : valeurs arsenal [FEEL-12]
- Où : src/simulation.js:1106-1135 (délais/chaleur), :1116 (heat), :1910 (refroidissement) ; src/economy.js (rangs) ; checks/simulation.test.mjs:150-162.
- Quoi : arsenal uniquement (test hérité :150-162 intact). Chaleur/tir : SMG .055, pompe .26/.36, roquette .34, grenade .28, pistolet .06. Refroidissement .22/s en tirant, .55/s repos. Déblocage heat < .55. Option : roquette 1,25→.95 s, grenade .95→.80 s. Signal ≥ .75 : cliquetis + tremblement arme. Brancher :1910 sur arsenal (mode hérité inchangé).
- Preuve exigée : bench/feel/heat-proto.mjs + weapon-cadence.mjs → SMG 69 tirs/10 s, 1re surchauffe 6,27 s, bloqué 11 % ; pompe 10 tirs, 31 % ; roquettes/grenades jamais en surchauffe.
- Qualité : meilleure (mesuré : SMG 34→69 tirs, bloqué 59→11 %).
- Garde-fous : dps SMG ×2,03 → recalibrer PV boss (bench/boss/window.mjs) et rangs refroidissement ; tests arsenal recalibrés ; déterminisme constantes ; taille neutre.
- Dépend de : T9 (LOOP-08, arbitrage : cadence avant surchauffe).

### T11 — Chaleur par arme [FEEL-V1]
- Où : src/simulation.js:1113 (refus tir), :1116 (heat unique), :1910 (refroidissement), :1946 (snapshot).
- Quoi : arsenal : tableau weaponHeat[weaponSlots] + weaponOverheated[weaponSlots] ; fireArsenal lit/écrit l'entrée de l'arme tirée ; refroidissement .35/s quand arme inactive (.1/s pendant son délai) ; déverrouillage par arme. p.heat/p.overheated = miroir arme main droite (HUD, anciens instantanés). Sauvegarde : arsenalVersion +1, tableau optionnel validé [0;1]. Ancien instantané → toutes entrées = p.heat. Mode hérité inchangé.
- Preuve exigée : bench/feel-verif2/t10.mjs → après surchauffe SMG, pompe tire dès image suivante (0 s) ; SMG reste verrouillé ~2 s. Test simulation : surchauffe SMG, changement arme, tir accepté. Test restore ancien instantané.
- Qualité : meilleure (mesuré : délai autre arme 2,08→0 s).
- Garde-fous : débit alternance ↑ → équilibrage avec T10 ; nouveau champ sauvegarde (révision unique fin chantier) ; HUD 2 barres ; déterminisme constantes.
- Dépend de : T10 (FEEL-12, valeurs de refroidissement).

### T12 — Sources des attaques de boss et environnement [FEEL-05]
- Où : src/simulation.js:1654-1655 (slam/ring/sweep/rocketZone), :1716 (rocketZone pieds), :1722 (onde/balayage), :1820 (damageEnvironment), :1865 (pièges), :1884 (vapeur), :1898 (sols dangereux) ; src/game.js (bossTell).
- Quoi : Onde/balayage : blessent si pieds < a.y+0,45 (sautables) ou évitables au dash. Slam : souffle blocable 75 % au-delà 1,2 m dans l'arc. rocketZone : éclats 60 % au-delà 1,2 m dans l'arc ; souffle direct non blocable. Vapeur : source = position tuyau, blocable face 50 %. Pièges/sols : non blocables. Icône « blocable » / « à esquiver » au télégraphe bossTell.
- Preuve exigée : bench/feel/boss-shield.mjs proto → slam/éclats partiellement bloqués ; 0 touche onde avec sauts calés. bench/feel/ring-dash.mjs adapté au saut. Tests boss simulation.test.
- Qualité : meilleure (estimé : part blocable boss 0→25-35 % ; ondes 4/4→0 avec saut/dash).
- Garde-fous : dépend FEEL-02 (arc) et FEEL-09 (saut) ; rééquilibrage 3 boss à prévoir ; option armure (surplus 1 pt/s) → armor.test:44-62 ; ~1 Ko.
- Dépend de : T3 (FEEL-02 arc), T4 (FEEL-09 saut).

### T13 — Réaction des ennemis aux impacts [FEEL-14]
- Où : src/simulation.js:816 (damageEnemy), :795 (bash), :1166 (mêlée), :1790 (windup countdown), :2114 (validation hurt), :1496 (réseau tactique) ; src/actors.js:30 ; src/audio.js:606.
- Quoi : (1) Pose de recul dans actors.js : amplitude .1+.1×min(1, amount/2), encodée dans e.hurt (champ existant, validé [0;0,2]). Buste incliné 8-15°, décalage .05 m. (2) Douleur déterministe (hash(e.id, s.shots)) : type 0 60 %, type 2 35 %, lourd 15 % (pompe/roquette uniquement). Effet : si e.windup > 0 → e.windup = min(windupMax, e.windup − 0,2) (interruption, pas retard). Boss exclus. (3) Recul pompe/roquette : 0,05 m/plomb (×0,4 lourds) via move() avec collision. (4) Kill : réticule X 0,3 s + son.
- Preuve exigée : nouveau banc 10 s SMG sur type 0 → compter tirs ennemis interrompus. Test simulation : pompe 3 m, recul > 0,1 m sans traverser mur.
- Qualité : meilleure (estimé : dps ennemi −10-20 % au corps à corps).
- Garde-fous : windup est un compte à rebours (:1790) → conditionner à > 0 et borner windupMax ; e.hurt entre dans réseau tactique (:1496) → décisions IA légèrement modifiées ; boss (giant) exclus ; tests combat/IA à compléter ; ~1 Ko.
- Dépend de : rien (parallèle).

## Options désactivées par défaut
- Aucune : aucun des 15 constats n'est de qualité « dégradée ».

## Écartés ou absorbés
- [BOSS-01] — ses points 2 à 5 (arc ±60° absorption .55/.8, schéma Espace esquive/frappe, suppression dash:false) sont absorbés par FEEL-02/FEEL-03 (géométrie et économie) et FEEL-01/FEEL-09 (touches). Seul le point 1 (source aux zones) est intégré à T3.

## Décisions à confirmer par David
- Test checks/boss-progression.test.mjs:9 interdit de baisser les PV : après T9+T10 (dps SMG ×2), faut-il relever le seuil ou exclure le test de la CI ? — valeur par défaut : relever le seuil à +25 % PV boss, garder le test actif.
- Table de parades par attaque (Onde/Balayage/Écrasement) : valider la proposition T3 avant codage ? — valeur par défaut : Onde = saut ou brèche 75 %, Balayage = esquive ou saut, Écrasement = blocage 75 % ou sortie de zone.
- Coup de tangage caméra (T8) : déplacer le réticule avec le pitch ou limiter SMG à roulis + FOV + recul arme ? — valeur par défaut : déplacer le réticule (cohérence visée/impact).
- Résolution native si la machine ne tient pas 60 fps (NATIF-V1) : proposer un menu de réduction ou laisser le joueur choisir hors jeu ? — valeur par défaut : menu options, jamais automatique en partie.

## Gains attendus du lot
- Déplacement : arrêt 125→242 ms, contrôle aérien 0,2→1,6 m/saut, élan conservé, 19-32 obstacles franchissables/monde, esquive au rebord 17→200 ms d'invulnérabilité, caméra stable sur marches (0,40→<0,08 m/image).
- Bouclier : arc ±70° indépendant hauteur/pitch, absorption 100 %/75 %, survie de face 23,4→29,8 s (morts 10/10→2/10), ondes boss 4/4→0 touches, bot bouclier 0→4/4 victoires.
- Armes : cadence exacte à toute fréquence (75→80 tirs SMG/10 s), surchauffe 59→11 % bloqué, chaleur par arme (0 s pour changer d'arme), recul distinct par arme (SMG 183→129 ms, pompe 272 ms, roquette 349 ms), caméra réactive (0→2-2,6°).
- Feedback : plus de voile rouge sur blocage, arc directionnel, douleur ennemie visible (~10-20 % dps ennemi réduit au corps à corps).
- Coût combiné : ~10 Ko ajouté, aucune dépendance externe, déterminisme préservé (forme fermée + hash pur), une seule révision de format sauvegarde en fin de chantier.
