# Axe FEEL — FEEL : ressenti (bouclier, sons d'armes, déplacements inspirés de Quake 3, manette, vivacité des armes)

Origine : premier tour. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

J'ai mesuré l'axe FEEL sur 673d6b2 sans toucher au clone : git status est vide et tout est instrumenté en mémoire. Les 25 scripts (dont 2 modules d'aide) sont dans bench/feel. Ils tournent sur la vraie simulation chargée dans node:vm, avec la commande node script.mjs <racine ferro> [args].

**1. Le bouclier protège mal, pour quatre raisons.**
- Géométrie : la garde est un cône 3D (seuil .55, pitch inclus) évalué au point d'impact de la balle. Elle ne couvre que 54,8 % des directions frontales, jamais les jambes, et plus rien quand on regarde vers le bas.
- Coût : chaque blocage laisse encore passer 20 % des dégâts. Il coûte 1,5 point d'énergie par point absorbé, allume le voile rouge et remet le combo à zéro.
- Tenue : garder la garde levée la vide. L'énergie oscille entre 0 et 8 et la garde clignote.
- Esquive perdue : équiper le bouclier (le défaut de la campagne v2) remplace l'esquive invulnérable de 0,18 s par une frappe. L'onde du colosse touche alors 7 fois sur 7, contre 0 sur 7 avec un dash calé.
- Prototype : arc horizontal de ±70°, absorption 100 %, coût 1 par point, régénération pendant la tenue. Sous le feu de face (30 s, 10 variantes, sans riposte), la survie passe de 23,4 à 29,8 s et les morts de 10/10 à 2/10. Les situations heavy et flank restent mortelles, comme voulu.

**2. Les armes sonnent léger.**
- 90 % de l'énergie arrive en 20 à 51 ms. Le SMG, le pistolet et la roquette ont moins de 3,1 % d'énergie sous 120 Hz, avec un centroïde entre 2,2 et 3,4 kHz.
- Une recette originale en quatre couches multiplie l'énergie grave par 7 à 19 et descend le centroïde vers 0,7–1,5 kHz. Elle respecte les règles pic, rms et DC. Seuls les plafonds de durée de audio.test.mjs:67 et :279 sont à relever.
- Des WAV d'écoute A/B sont dans bench/feel/wav.
- La vivacité est aussi bridée par la surchauffe : le SMG se verrouille dès 1,73 s de tir et reste bloqué 59 % du temps.
- Le recul est identique pour toutes les armes (ressort ω 27) et la caméra ne réagit à aucun tir.

**3. Le déplacement est raide.**
- Arrêt en 125 ms sur 0,18 m, vitesse remise à 0 à chaque atterrissage, 0,2 m de contrôle en l'air.
- Il n'y a pas de saut, alors que chaque monde compte 138 à 227 obstacles de 0,43 à 1,0 m.
- Proposition inspirée de Quake 3 (concepts seulement, en mètres) :
  - au sol : accélération 16, friction 9, stop 2,2 ;
  - en l'air : air accel 1,1 ;
  - saut : 6,2 m/s à g = 20, coyote 0,10 s, tampon 0,12 s, plafond 10,5 m/s.
- Elle garde le démarrage à 83 ms et ajoute de l'élan et de la glisse.
- Le saut exige un clip de 2,4 m sur les murets de bordure, car 97 murets bas ont du substrat derrière eux. Il faut aussi une physicsVersion 2 pour les instantanés.

**4. Rien ne gère la manette : zéro occurrence dans le code.**
- Je propose un module src/gamepad.js, ajouté avant game.js dans tools/build.py:6, et branché à la fusion des entrées de game.js:683-690.
- J'ai prototypé les courbes de visée : 300°/s à fond, demi-tour en 483 ms.
- La proposition couvre aussi le mapping des boutons, les vibrations, la navigation dans les menus et les invites de touches.

Les chiffres marqués « mesuré » viennent des bancs, qui tournaient pendant que d'autres agents mesuraient : ils sont à lire en relatif. Les gains de mixage, de caméra et d'IA sont estimés ou qualitatifs.

## Mesures

- **Couverture du cône de garde actuel (grille 0–60° d'azimut × 6 hauteurs)** : 54,8 % (23/42). Bloqué jusqu'à 45° d'azimut, plus à 55°. Jambes (y ≤ 0,4 m) jamais. Tête 1,9 m seulement à 0–10°, 1,7 m jusqu'à 30°. Regard vers le bas (pitch −0,6 rad) : 0 blocage. _(méthode : bench/feel/shield-cone.mjs : sim.hurt appelé avec une source placée autour du joueur (flatWorld, garde levée, énergie 100, code 673d6b2 instrumenté en mémoire par hurtProbe))_
- **Coût d'une balle de 8 dégâts bloquée (règles actuelles)** : 1,6 PV et 9,6 d'énergie. 100 d'énergie ≈ 10 balles. Tenue continue : énergie entre 0 et 8, la garde clignote. _(méthode : bench/feel/shield-cone.mjs et shield-detail.mjs)_
- **Survie sous le feu de face (3 tireurs), 30 s, 10 variantes, joueur sans riposte** : Sans garde : 15,0 s, 10/10 morts. Garde actuelle : 23,4 s joueur fixe, 24,2 s en suivant la menace (10/10 morts, 105/214 et 116/226 coups bloqués). Garde proposée : 29,8 s (2/10 morts, 188/270 bloqués) et 30,0 s (0/10 morts, 73 PV perdus). _(méthode : node bench/feel/shield-proto.mjs <racine> 30 10 (règles prototypes injectées en mémoire par proto-patch.mjs))_
- **Survie dans les situations heavy (3 tireurs + rusher) et flank (2 de face, 2 de côté), 30 s, 10 variantes** : Heavy : 11,0 / 16,7 / 23,8 s (sans garde / actuelle / proposée), 10/10 morts partout. Flank, joueur fixe : 11,7 / 16,5 / 26,4 s ; avec la garde proposée, 7/10 morts et 188/312 bloqués, contre 60/190 aujourd'hui. _(méthode : bench/feel/shield-proto.mjs 30 10)_
- **Répartition des PV perdus en heavy, 20 s, 6 variantes, joueur face à la menace la plus proche** : Règles actuelles : balles 454 PV (32/87 bloquées), ruée 146 PV (15/19). Règles proposées : balles 364 PV (54/102), ruée 57 PV (21/24). _(méthode : bench/feel/shield-breakdown.mjs <racine> 20 6)_
- **Retour d'un coup bloqué** : Événements ['shieldBlock','hurt'], s.damage = 1 (voile rouge à .45), combo de 3 à 0. _(méthode : bench/feel/block-feedback.mjs)_
- **Dégâts de boss bloqués, garde levée face au boss, 40 s** : 0 % pour les 3 boss. Colosse : l'onde fait 4 coups et 77 % des PV perdus. Siegebreaker et custodian : rocketZone 10 coups, 0 bloqué, y compris avec les règles prototypes. _(méthode : bench/feel/boss-shield.mjs <racine> 40 [proto])_
- **Onde du colosse sur 60 s (7 ondes)** : Bouclier + Espace : 7/7 ondes encaissées, 146 PV, 7 frappes dans le vide. Main gauche vide + dash calé : 0/7. _(méthode : bench/feel/ring-dash.mjs)_
- **Dash** : 2,47 m, 0,183 s d'invulnérabilité (p.dashing), recharge 1,7 s. Bouclier en main : Espace déclenche une frappe (énergie de 100 à 76), pas de dash. La campagne v2 démarre avec {right:4, left:'shield'}. _(méthode : bench/feel/dash-shield.mjs et move-metrics.mjs)_
- **Analyse des tirs actuels (PCM 22 050 Hz)** : SMG : 105 ms, 90 % de l'énergie en 20 ms, 1,8 % sous 120 Hz, centroïde 2398 Hz. Pistolet : 165 ms / 26 ms / 3,1 % / 2175 Hz. Pompe : 320 / 51 / 9,9 % / 3392. Roquette : 410 / 120 / 1,5 % / 2971. Crête 16 à 19 dB. Synthèse 0,4 à 4 ms par tampon. _(méthode : bench/feel/audio-analyze.mjs : FAudio.synthesize chargé dans node:vm, analyse hors ligne (énergie cumulée, bandes, centroïde, crête))_
- **Recette prototype « façon Doom » (originale, sans échantillon)** : SMG : 240 ms / 53 ms / 22,6 % / 1476 Hz / 10,8 dB. Pistolet : 340 / 84 / 25,6 % / 1394 / 11,3. Pompe : 920 / 182 / 21,5 % / 1095 / 11. Roquette : 800 / 299 / 28,9 % / 683 / 9,3. Synthèse 0,7 à 4 ms. Passe les règles pic, rms, DC, queue, variation et reproductibilité ; échoue seulement aux plafonds de durée. _(méthode : bench/feel/doomish.mjs et doomish-check.mjs, WAV A/B (coups isolés et rafales) dans bench/feel/wav/)_
- **Mouvement actuel (simulation réelle, 120 Hz)** : 90 % du sprint en 83 ms. Arrêt en 125 ms sur 0,18 m. Inversion en 100 ms, virage de 90° en 83 ms. Chute de 1,6 m : 517 ms en l'air, 0,2 m de dérive latérale, vitesse 0 après l'atterrissage. _(méthode : bench/feel/move-metrics.mjs)_
- **Modèle Q3 converti en mètres (1 u = 2,54 cm, concepts seulement)** : 90 % de la vitesse en 133 ms. Arrêt en 358 ms sur 1,09 m. Inversion en 208 ms. Saut : apex 1,16 m, 675 ms en l'air, 1,87 m de dérive latérale. 10 sauts optimaux sans plafond : 30,9 m/s. _(méthode : bench/feel/move-metrics.mjs (modèle))_
- **Réglage au sol proposé** : Accélération 16, friction 9, stop 2,2 : 90 % en 83 ms, arrêt en 242 ms sur 0,67 m, inversion en 125 ms, vitesse 7,6 m/s. _(méthode : bench/feel/move-tune.mjs (balayage de 8 réglages))_
- **Saut proposé** : 6,2 m/s à g = 20 : apex 0,96 m, 620 ms en l'air. Air accel 1,1 : 1,61 m de dérive latérale. Plafond 10,5 m/s après 10 sauts. _(méthode : bench/feel/move-metrics.mjs (modèle))_
- **Obstacles et limites que le saut rendrait franchissables** : Obstacles de 0,43 à 1,0 m : 138 (monde 0) et 227 (monde 17). outdoorBoundaries : 119 à 197 segments, 941 à 1240 m par monde, hauteurs .72/.94/1.0. 97 murets bas ont du substrat derrière eux dans les bornes. Sols à −0,25 / 0 / 1,6 / 3,2 / 4,8 / 6,4, reliés par des rampes. _(méthode : bench/feel/jumpable.mjs, jumpable2.mjs, boundaries.mjs, parapets.mjs, steps.mjs)_
- **Tir maintenu 10 s, règles arsenal actuelles** : SMG : 34 tirs, 1re surchauffe à 1,73 s, bloqué 59 % du temps. Double pompe : 7 tirs, 1,97 s, 61 %. Roquettes : 6 tirs, 58 %. Grenades : 7 tirs, 52 %. Pistolet : 30 tirs, 0 %. SMG + pompe main gauche : 20 tirs, 84 %. _(méthode : bench/feel/weapon-cadence.mjs)_
- **Tir maintenu 10 s, chaleur proposée** : SMG : 69 tirs, 1re surchauffe à 6,27 s, 11 % bloqué. Pompe : 10 tirs, 31 %. Roquettes et grenades : jamais en surchauffe. Double : 75 %. _(méthode : bench/feel/heat-proto.mjs)_
- **Recul d'arme** : SMG 2,57 cm et 1,25°, pistolet 1,97 cm et 0,96°, pompe 4,74 cm et 2,31°, roquette 7,45 cm et 3,63°. Pic à 33 ms et retour sous 10 % à 183 ms pour toutes (même ω 27). Caméra au tir : 0. fx.shake transmis au renderer : 0. _(méthode : bench/feel/kick.mjs (FMotion réel, impulsion par arme, échantillonnage de view.weapon))_
- **Prototype de courbes manette** : Lacet : 5,4°/s à 20 % de déflexion, 76°/s à 50 %, 157°/s à 70 %, 300°/s à fond. Demi-tour en 483 ms (600 ms sans boost). Dans la simulation réelle : 2,63 m/s avec le stick à 55 %, 7,60 m/s à fond (course automatique). _(méthode : bench/feel/gamepad-map.mjs (fonctions pures branchées sur sim.step))_
- **Support manette existant** : 0 occurrence de « gamepad » dans src/, index.html, tools/ et checks/. _(méthode : grep -ri gamepad)_

## Scripts de banc

- bancs/feel/load.mjs
- bancs/feel/proto-patch.mjs
- bancs/feel/shield-cone.mjs
- bancs/feel/shield-fight.mjs
- bancs/feel/shield-detail.mjs
- bancs/feel/shield-proto.mjs
- bancs/feel/shield-breakdown.mjs
- bancs/feel/block-feedback.mjs
- bancs/feel/boss-shield.mjs
- bancs/feel/ring-dash.mjs
- bancs/feel/dash-shield.mjs
- bancs/feel/audio-analyze.mjs
- bancs/feel/doomish.mjs
- bancs/feel/doomish-check.mjs
- bancs/feel/move-metrics.mjs
- bancs/feel/move-tune.mjs
- bancs/feel/jumpable.mjs
- bancs/feel/jumpable2.mjs
- bancs/feel/parapets.mjs
- bancs/feel/boundaries.mjs
- bancs/feel/steps.mjs
- bancs/feel/weapon-cadence.mjs
- bancs/feel/heat-proto.mjs
- bancs/feel/kick.mjs
- bancs/feel/gamepad-map.mjs

## Constats

### FEEL-01 — Le bouclier en main gauche supprime l'esquive : Espace devient une frappe et l'invulnérabilité du dash disparaît, alors que c'est l'équipement par défaut de la campagne v2
- sévérité critique · catégorie ressenti · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:800; src/simulation.js:1915; src/simulation.js:775; src/simulation.js:785-797; src/game.js:163; src/game.js:223; index.html (bandeau « ESPACE · ESQUIVE PRÊTE »); checks/checkpoint.test.mjs:302-310

**Preuve.** Code :
- simulation.js:800 : `if((input.bash||input.dash)&&s.equipment.left==='shield')shieldBash();`
- simulation.js:1915 : `locomote(dt,arsenal&&s.equipment.left==='shield'?{...input,dash:false}:input)`.
- simulation.js:775 : hurt() sort si `p.dashing>0||recovery>0`, donc le dash rend invulnérable.
- simulation.js:787 : la frappe coûte 24 d'énergie, abaisse la garde et empêche de la relever pendant 0,24 s (bashVisual).
- checks/checkpoint.test.mjs:302-310 fige « Space bashes instead of dashing ».
- Les toasts game.js:163 et :223 annoncent « Espace : frapper ».

Mesures :
- dash-shield.mjs : la campagne v2 démarre avec {right:4, left:'shield'} ; Espace donne une frappe (énergie de 100 à 76) et aucun dash. Main vide : dash de 2,47 m avec 0,183 s d'invulnérabilité, recharge 1,7 s.
- ring-dash.mjs (colosse, 60 s, 7 ondes) : bouclier + Espace → 7/7 ondes encaissées, 146 PV, 7 frappes dans le vide ; main gauche vide + dash calé → 0/7.

**Cause.** La frappe a été branchée sur l'entrée du dash pour économiser une touche. Du coup, l'équipement par défaut de la campagne v2 retire la seule esquive et ses frames d'invulnérabilité, alors que les attaques de zone des boss (simulation.js:1654-1655, :1722) sont faites pour être esquivées.

**Proposition.** Séparer frappe et esquive.
1. simulation.js:800 : déclencher la frappe sur `input.bash` seulement.
2. Supprimer le filtre `{...input,dash:false}` de :1915. Forcer `q.raised=false` tant que `p.dashing>0` : pas de garde pendant l'esquive.
3. game.js : avec le bouclier en main gauche, l'action « melee » (V et bouton tactile de mêlée) produit `input.bash`. La crosse (.9 dégâts) reste pour la main vide.
4. Tactile : la flèche redevient l'esquive ; le bouton de mêlée affiche « FRAPPE » quand le bouclier est équipé.
5. Réécrire les toasts game.js:163 et :223 et le bandeau de index.html.

Avec FEEL-09, la disposition finale devient : Espace = saut, R = esquive (migration des options), V = frappe ou crosse.

**Gain attendu.** Ondes du colosse : de 7/7 à 0/7 touches avec un dash calé (mesuré avec la main gauche vide). La campagne v2 retrouve 0,183 s d'invulnérabilité toutes les 1,7 s. La frappe garde une touche dédiée.

**Risques.** - Déterminisme : intact, seule l'entrée change.
- Sauvegardes : aucun champ nouveau.
- Tests : réécrire checkpoint.test.mjs:302-310 en « V frappe, Espace ou R esquive » ; les tests de frappe via input.bash ne bougent pas.
- Équilibrage : bouclier et dash se cumulent ; garder « pas de garde pendant le dash » et le coût de 24.
- AGENTS.md : libellés AZERTY/QWERTY et tactile à jour.
- Taille : moins de 0,5 Ko.

**Vérifier par.** - ring-dash.mjs adapté (bouclier en main, dash calé sur chaque onde) : 0/7 touches attendu.
- dash-shield.mjs : la touche d'esquive met p.dashing > 0 sans toucher l'énergie du bouclier.
- Nouvelle assertion dans checkpoint.test.mjs.

**Contre-vérification.** Rejoué (t1.mjs, 3 graines de campagne v2) : équipement initial {right:4,left:'shield'} ; Espace donne shieldBash, énergie 100 → 76, p.dashing = 0, déplacement 0. ring-dash.mjs rejoué : 7/7 ondes encaissées (146 PV) avec le bouclier, 0/7 main gauche vide. Code relu : simulation.js:800, :1915, :775 exacts. Le 0/7 vient d'un pilote au tempo parfait (l'onde passe en 0,14 s, l'invulnérabilité dure 0,2 s) : un joueur fera moins bien. Tests à réécrire oubliés par le constat : progression.test.mjs:267, checkpoint.test.mjs:317 et :351, en plus de :302-310 ; libellé options.js:4 « Esquive / coup de bouclier ». Voir aussi FEEL-V2 (esquive coupée au bord d'un rebord).

**Preuve corrigée.** simulation.js:1722 met a.hitPlayer=true même quand hurt() est ignoré par l'invulnérabilité : une esquive calée annule donc toute l'onde.

### FEEL-02 — La garde est un cône 3D évalué au point d'impact de la balle, pas selon la direction d'arrivée : jambes jamais protégées, tête presque jamais, rien quand on regarde vers le bas
- sévérité haute · catégorie ressenti · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:766-770; src/simulation.js:1928; src/simulation.js:1782; src/simulation.js:940

**Preuve.** Code :
- simulation.js:768-769 : `dx=source.x-p.x,dy=source.y-(p.y+1.25),...cp=Math.cos(p.pitch); return d>.08&&(dx*Math.sin(p.yaw)*cp+dy*Math.sin(p.pitch)-dz*Math.cos(p.yaw)*cp)/d>.55`.
- La source d'une balle est sa position au contact : simulation.js:1928 `{x:bullet.x,y:bullet.y,z:bullet.z}`, soit environ 0,3 à 0,6 m du centre du joueur. La composante verticale domine donc.

Mesures :
- shield-cone.mjs (sim.hurt direct, garde levée, énergie 100) : bloqué jusqu'à 45° d'azimut, plus à 55°. Jambes (y ≤ 0,4 m) jamais. Tête 1,9 m seulement à 0–10°, 1,7 m jusqu'à 30°. Pitch −0,6 rad : 0 blocage.
- Grille 0–60° × 6 hauteurs : 54,8 % (23/42).
- En combat (shield-proto, 30 s, 10 variantes) : 49 % des coups bloqués de face (joueur fixe), 32 % en flank.

**Cause.** Le test d'orientation mélange l'angle de visée (pitch) et la hauteur d'impact sur le corps. Un bouclier tenu devant le torse doit protéger selon la direction horizontale d'où vient le projectile, quel que soit l'endroit où il touche.

**Proposition.** Réécrire shieldFacing comme un arc horizontal.
- Direction d'arrivée h : l'opposé de la vitesse du projectile. Ajouter vx:bullet.dx, vz:bullet.dz à la source en :1928.
- À défaut, la position de l'attaquant (ruée, :1782).
- Pour un souffle (blast), le centre de l'explosion ; non blocable si la distance horizontale est inférieure à 1,0 m (souffle sous les pieds).
- Si la distance horizontale est inférieure à 0,05 m sans souffle : bloqué.
- Test : `(hx·sin(yaw) − hz·cos(yaw)) / |h| > 0.34`, soit ±70°, sans pitch ni hauteur.
- Option : non blocable pour une source plus haute que p.y + 3 m (tirs plongeants).

Prototype en mémoire : bench/feel/proto-patch.mjs, étape 1.

**Gain attendu.** Combiné aux règles de FEEL-03 (mesuré), la part des coups bloqués passe :
- de 49 à 70 % de face, joueur fixe ;
- de 51 à 64 % de face, en suivant la menace ;
- de 32 à 60 % en flank, joueur fixe.

Géométrie seule (calcul) : 100 % des directions jusqu'à ±70°, à toute hauteur et tout pitch.

**Risques.** - Déterminisme : fonction pure, rien ne change.
- Sauvegardes : aucune.
- Tests : recalibrer les attentes d'angle des tests de garde.
- Équilibrage : un arc plus large rend le bouclier plus fort ; FEEL-03 prévoit la riposte de l'IA (flanc, tirs en cloche).
- Licence : aucun code externe.
- Taille : neutre.

**Vérifier par.** - shield-cone.mjs sur le code modifié : 100 % jusqu'à 70°, 0 % à 80°, indépendant de la hauteur et du pitch.
- Nouveau test simulation : balle aux jambes de face bloquée ; balle de dos non bloquée ; souffle sous les pieds non bloqué.

**Contre-vérification.** Le code et la grille synthétique sont exacts, mais la cause et le gain sont surestimés. En combat réel (t2.mjs, mêmes scénarios, totaux reproduits : 105/214 bloqués, 23,4 s), la source d'une balle est à +1,44/1,45 m des pieds (p10 à 1,05 m avec un lourd) et à 0,42-0,50 m de l'axe : les jambes et la tête ne jouent presque jamais. Les coups non bloqués se répartissent ainsi de face, joueur fixe : garde baissée faute d'énergie 57/214 (27 %), azimut d'arrivée réel au-delà de 56,6° 50/214 (23 %), effet vertical ou point d'impact 2/214 (1 %) ; 1 à 6 % selon le scénario. Le tangage, lui, est confirmé avec de vraies balles (t11.mjs) : 74 % de blocage à 0 rad, 23 % à -0,55 rad, 4 % à -0,6, 0 % à -0,9. Résultats stables à 30, 60 et 120 pas/s. À livrer avec FEEL-03 : seul, le gain est marginal.

**Gain corrigé.** Géométrie seule (t3.mjs, 10 variantes, 30 s) : arc par direction d'arrivée au même angle, de face 49 → 50 % bloqués et 23,4 → 23,6 s ; arc de ±70° seul, 54 % et 24,6 s de face, 32 → 45 % et 16,6 → 17,9 s en flank. Les 49 → 70 % annoncés sont ceux de la combinaison avec FEEL-03 (économie seule : 62 %, 27,8 s). La synergie est forte en flank : économie seule 17,1 s et 10/10 morts, les deux 26,4 s et 7/10.

### FEEL-03 — Économie de garde : 20 % des dégâts passent quand même, 100 d'énergie ne couvrent que 10 balles, et la tenue vide la jauge
- sévérité haute · catégorie ressenti · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : src/simulation.js:776-778; src/simulation.js:798-805; src/brain.js (choix flanc et tir en cloche); checks/armor.test.mjs:44-62

**Preuve.** Code :
- simulation.js:777 : `absorbed=Math.min(amount*(source.blast?.55:.8),energy/1.5)`, puis 1,5 d'énergie par point absorbé et rechargeDelay = 2,2.
- simulation.js:801 : relever la garde exige plus de 8 d'énergie.
- simulation.js:803-804 : drain de 2,5/s garde levée ; recharge de 18/s seulement garde baissée et après 2,2 s.

Mesures :
- Une balle de 8 bloquée coûte 1,6 PV et 9,6 d'énergie.
- shield-detail.mjs : garde tenue → énergie bloquée entre 0 et 8, la garde clignote. L'IA contourne : coups reçus à 121°, 166° et −173°.
- shield-proto (30 s, 10 variantes, sans riposte), règles actuelles : la survie passe de 15,0 à 23,4 s de face, de 11,0 à 16,7 s en heavy, de 11,7 à 16,5 s en flank, avec 10/10 morts partout.
- Règles proposées (avec FEEL-02) : 29,8 s et 2/10 morts de face (joueur fixe) ; 0/10 morts et 73 PV perdus en suivant la menace ; 26,4 s en flank.
- Sur 20 s et 6 variantes, les PV perdus de face passent de 79 à 37.
- shield-breakdown (heavy) : les balles font 86 % des PV perdus avec les règles proposées, parce que le joueur regarde le rusher.

**Cause.** Les valeurs ont été pensées comme une réduction de dégâts, pas comme un blocage. Chaque blocage coûte encore des PV, l'énergie fond 1,5 fois plus vite que les dégâts absorbés, et tenir la garde la vide sans jamais la régénérer.

**Proposition.** Valeurs prototypées (proto-patch.mjs, PROPOSED) :
- Absorption : 100 % des coups directs, 75 % des souffles.
- Coût : 1,0 énergie par point absorbé.
- Délai de recharge : 1,2 s après un blocage ; 1,6 s si la garde casse (énergie 0).
- Relever la garde exige au moins 25.
- Drain garde levée : 1,5/s.
- Régénération pendant la tenue : 6/s après 1,2 s sans coup.
- Recharge garde baissée : 28/s.

Ajouter une parade :
- Garde levée depuis 0,15 s ou moins : le coup direct est gratuit.
- Le tireur est étourdi 0,45 s, ou le rusher 1,0 s avec un recul de 1,2 m. Émettre 'shieldParry'.
- Réarmement après 0,35 s de garde baissée (raiseAge transitoire, non sérialisé).

En option : vitesse ×0,8 garde levée. Côté IA (brain) : renforcer le flanc et les grenades quand s.shield.raised, pour garder du danger.

**Gain attendu.** - De face, joueur fixe : survie de 23,4 à 29,8 s (+27 %), morts de 10/10 à 2/10.
- Sur 20 s de face : PV perdus de 79 à 37.
- Une balle de 8 bloquée coûte 0 PV et 8 d'énergie, au lieu de 1,6 PV et 9,6.
- Heavy et flank restent mortels sans riposte, comme voulu.

**Risques.** - Déterminisme : constantes ; raiseAge doit rester hors instantané ou être validé (validation atomique, simulation.js:2088-2093).
- Sauvegardes : rien de nouveau si raiseAge n'est pas sauvé.
- Tests : recalibrer armor.test.mjs:44-62 et les tests de garde.
- Équilibrage : sans riposte de l'IA, le bouclier devient trop fort ; la parade est qualitative.
- Taille : moins de 1 Ko.

**Vérifier par.** - shield-proto.mjs 30 10 : de face, survie ≥ 29 s et ≤ 2/10 morts ; heavy et flank toujours mortels sans riposte.
- shield-breakdown.mjs.
- Test simulation : 10 s de tenue sans coup → l'énergie ne descend pas sous 85.

**Contre-vérification.** Reproduit avec mes propres patchs en mémoire (t3.mjs) : actuel 23,4 s, 10/10 morts, 105/214 ; proposé complet 29,8 s, 2/10, 188/270 ; heavy 23,8 s ; flank 26,4 s et 7/10 : identiques au constat. Attribution : l'économie seule donne 27,8 s et 4/10 de face, 0/10 en suivant la menace ; absorption 100 % + coût 1 seuls : 26,2 s et 7/10 ; sans régénération pendant la tenue : 27,5 s de face mais 20,2 s au lieu de 22,3 en heavy. Avec les règles proposées la garde reste levée 88 à 98 % du temps : la riposte de l'IA (flanc, grenades) est indispensable, comme le constat le dit. La parade n'est ni prototypée ni mesurée (qualitatif). Tests qui figent les valeurs actuelles : progression.test.mjs:259-262 (PV 96 après un coup de 20, soit la règle des 80 %) et armor.test.mjs:61 (énergie entre 66 et 67).

### FEEL-04 — Un coup bloqué est présenté comme un coup reçu : voile rouge plein, combo remis à zéro, aucune direction
- sévérité haute · catégorie ressenti · effort S · gain qualitatif
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/simulation.js:779-781; src/game.js:193-203; src/game.js:714; src/game.js:573-583; src/motion.js:36-46; src/audio.js:506; style.css (#damage)

**Preuve.** Code :
- simulation.js:781 : `p.hp=Math.max(0,p.hp-amount);s.damage=1;s.combo=0;s.comboTime=0;emit('hurt')` s'exécute même quand tout a été absorbé.
- game.js:714 : voile #damage d'opacité s.damage×.45, uniforme sur tout l'écran.
- game.js:200 : l'événement 'shieldBlock' part vers motion.impulse, qui ne connaît pas ce nom (motion.js:36-46) : aucun mouvement.
- audio.js:506 : shieldBlock = impact:metal .40.
- emit('hurt') ne transmet ni x ni z : impossible d'afficher la direction du coup.

Mesure (block-feedback.mjs) : une balle bloquée produit les événements ['shieldBlock','hurt'], s.damage = 1 (voile à .45) et un combo de 3 à 0.

**Cause.** hurt() n'a qu'une seule sortie. Le retour visuel est global : il ne distingue ni le blocage, ni la direction, ni la force du coup.

**Proposition.** 1. hurt() : si amount ≤ 0,01 après absorption, sortir juste après emit('shieldBlock'), sans s.damage ni remise à zéro du combo. Sinon, `s.damage = clamp(.35 + amount/25, 0, 1)`.
2. emit('hurt', {amount, x, z, blocked}) avec la source.
3. game.js : indicateur directionnel en arc de 40° autour du réticule. Rouge pour un coup reçu, cyan pour un blocage, avec un chevron pour les daltoniens. Angle = atan2 relatif au yaw, durée 0,6 s, 4 arcs au maximum.
4. leftMotion.impulse('block') de 3,5 (comme fracture) et flash du bord du bouclier : alpha +.25 décroissant de 8/s (game.js:573-583).
5. Son de blocage : impact:metal plus un tintement à 2,6 kHz (τ 15 ms).
6. Vibration manette faible .4 pendant 70 ms (FEEL-10).

**Gain attendu.** Plus aucun voile rouge sur un blocage complet, et le combo est conservé. La direction des attaques de flanc (121°, 166°, −173° mesurés) devient visible.

**Risques.** - Déterminisme : le combo n'est plus remis à zéro sur un blocage total, changement de règle à documenter.
- Tests : combo, hurt et événements audio.
- AGENTS.md (accessibilité) : la couleur doit être doublée par une forme.
- Taille : environ 2 Ko.

**Vérifier par.** - block-feedback.mjs : seul ['shieldBlock'] attendu, s.damage = 0, combo conservé.
- Test DOM : arc directionnel présent après un coup latéral.
- Capture headless file:// optionnelle.

**Contre-vérification.** Code relu : la ligne fautive est simulation.js:782 (et non :781, qui est l'armure) ; game.js:200 envoie bien 'shieldBlock' à motion.impulse qui l'ignore (motion.js:36-46) ; game.js:714 voile à s.damage×.45. Dépendance non dite : avec les règles actuelles un blocage laisse toujours 20 % des dégâts, donc la sortie « amount ≤ 0,01 » ne sert qu'une fois FEEL-03 livré. Pour la direction, utiliser la vitesse de la balle (comme FEEL-02), la position source n'étant qu'à 0,44 m du joueur. Le combo conservé sur blocage total change une règle : test à ajouter.

### FEEL-05 — Les attaques des boss et de l'environnement n'ont pas de source : jamais blocables, et rien ne permet de les esquiver avec le bouclier
- sévérité moyenne · catégorie boss · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:1654-1655; src/simulation.js:1716; src/simulation.js:1722; src/simulation.js:1820; src/simulation.js:1865; src/simulation.js:1884; src/simulation.js:1898; src/simulation.js:537-538

**Preuve.** Code (appels de hurt sans source) :
- simulation.js:1722 : onde et balayage, `hurt(a.damage)`.
- simulation.js:1820 : damageEnvironment (pièges 20 en :1865, vapeur 8 en :1884).
- simulation.js:1898 : sols dangereux, 8.
- simulation.js:1716 : rocketZone vise les pieds [a.x, a.y+.14, a.z].
- simulation.js:1654-1655 : slam 30, ring 22, sweep 26, rocketZone 28.

Mesures :
- boss-shield.mjs (40 s, garde levée face au boss) : 0 % des dégâts de boss bloqués. Colosse : l'onde fait 4 coups et 77 % des PV perdus. Siegebreaker et custodian : rocketZone 10 coups, 0 bloqué, y compris avec les règles prototypes.
- L'onde va jusqu'au rayon arena.r−1 en 2,3 s, sur une bande de 1,6 m. Avec r = 28, elle passe un point en environ 0,14 s.
- Avec le saut de FEEL-09, les pieds restent au-dessus de 0,45 m entre t = 0,084 s et t = 0,536 s, soit une fenêtre de 0,45 s (calcul).

**Cause.** Ces attaques sont faites pour être esquivées. Mais le joueur n'a ni saut (FEEL-09) ni dash quand il porte le bouclier (FEEL-01) : contre les boss, il n'a aucune réponse.

**Proposition.** Règles :
- Onde et balayage : ne blessent que si les pieds sont sous a.y + 0,45 m au passage de la bande (donc sautables), ou évitables au dash.
- Slam : souffle centré, blocable à 75 % au-delà de 1,2 m et dans l'arc.
- rocketZone : éclats blocables à 60 % au-delà de 1,2 m et dans l'arc ; le souffle direct reste non blocable.
- Vapeur (:1884) : passer la position du tuyau comme source, blocable de face à 50 %.
- Pièges et sols : non blocables, à éviter.

Afficher au télégraphe de l'attaque (bossTell) une icône « blocable » ou « à esquiver ».

Option armure : part absorbée de 1/3 à 1/2, et un surplus qui décroît de 1 pt/s au lieu du plafond de syncArmor (:537-538).

**Gain attendu.** - Ondes du colosse : de 4/4 touches à 0 avec un saut ou un dash calé (le dash calé donne 0/7, mesuré).
- Part blocable des dégâts de boss : de 0 % à environ 25–35 % (slam et éclats), estimé à partir de la répartition de boss-shield.

**Risques.** - Déterminisme : préservé.
- Tests : compléter les tests d'attaques de boss de simulation.test et rééquilibrer les 3 boss.
- Si l'option armure est retenue : armor.test.mjs:44-62 (plafond).
- Sauvegardes : le surplus d'armure tient dans le champ points existant.
- Taille : environ 1 Ko.

**Vérifier par.** - boss-shield.mjs proto : slam et éclats en partie bloqués ; 0 touche d'onde avec des sauts calés.
- ring-dash.mjs adapté au saut.
- Tests boss.

**Contre-vérification.** boss-shield.mjs rejoué (40 s) : colosse 4 ondes, 0 bloquée, 77 % des PV perdus ; siegebreaker et custodian 10 rocketZone, 0 bloqué. Code relu : hurt(a.damage) sans source en :1722, hurt(amount) en :1820 et :1898, dégâts 30/22/26/28 en :1655. La part « blocable 25 à 35 % » reste une estimation non prototypée. L'onde sautable dépend de FEEL-09 ; FEEL-01 seul rend déjà l'esquive. Rééquilibrage des trois boss à prévoir.

### FEEL-06 — Les tirs sont trop maigres : 90 % de l'énergie en 20 à 51 ms et presque rien sous 120 Hz, d'où le « léger »
- sévérité haute · catégorie audio · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur et jeu
- lieux : src/audio.js:20-88; src/audio.js:27; src/audio.js:58-69; src/audio.js:82; src/audio.js:288; checks/audio.test.mjs:57-70; checks/audio.test.mjs:279

**Preuve.** Code :
- audio.js:27 : durées pistolet .165, SMG .105, pompe .32, roquette .41, grenade .29.
- audio.js:58-69 : craquement 4,5 / 6 / 13 ms, corps 205 / 166 / 119 Hz, queues 17 / 25 / 52 ms.
- audio.js:82 : filtre DC .991, soit environ 32 Hz à 22 050 Hz. Ce n'est pas la cause principale : la recette n'a pas d'énergie durable sous 150 Hz.

Mesures sur la recette actuelle (audio-analyze.mjs, 22 050 Hz) :
- SMG : 105 ms, 90 % de l'énergie en 20 ms, 1,8 % sous 120 Hz, centroïde 2398 Hz.
- Pistolet : 165 ms / 26 ms / 3,1 % / 2175 Hz.
- Pompe : 320 ms / 51 ms / 9,9 % / 3392 Hz.
- Roquette : 410 ms / 120 ms / 1,5 % / 2971 Hz.
- Crête de 16 à 19 dB : un pic isolé, peu de densité.

Prototype doomish.mjs (recette originale : craquement, « thump » à hauteur descendante, corps de bruit 2 pôles saturé, clics mécaniques, réflexions à 11/17/23/31/43 ms, queue passe-bas 900 Hz, DC 25 Hz, tanh 1,25) :
- SMG : 240 ms / 53 ms / 22,6 % / 1476 Hz / 10,8 dB.
- Pistolet : 340 / 84 / 25,6 % / 1394 / 11,3.
- Pompe : 920 ms (bruit de pompe à .47 et .56 s) / 182 / 21,5 % / 1095 / 11.
- Roquette : 800 / 299 / 28,9 % / 683 / 9,3.

doomish-check passe les règles pic, rms, DC, queue, variation et reproductibilité, et échoue seulement aux plafonds de durée. WAV A/B, coups isolés et rafales : bench/feel/wav/.

**Cause.** La recette se résume à un clic plus du bruit, très court et centré sur 2–3 kHz. Il n'y a ni pression grave (40–150 Hz), ni mécanique, ni pièce. Les tests figent ces durées courtes (audio.test.mjs:67) et la longueur exacte du pistolet (.165 × 22 050, :279).

**Proposition.** Recette en quatre couches, par arme :

| Arme | Thump (hauteur, τ hauteur, τ amplitude) | Corps (passe-bas, τ, drive) | Mécanique | Pièce (τ) | Durée |
|---|---|---|---|---|---|
| Pistolet | 150→55 Hz, 20 ms, 60 ms | 2 kHz, 38 ms, 3,0 | clic à 55 ms | 85 ms | 340 ms |
| SMG | 175→62 Hz, 16 ms, 40 ms | 2,3 kHz, 26 ms, 3,4 | clic à 30 ms | 70 ms | 240 ms |
| Pompe | 120→42 Hz, 32 ms, 130 ms | 1,5 kHz, 85 ms, 4,0 | pompe à .47 et .56 s | 160 ms | 920 ms |
| Roquette | 95→38 Hz, 60 ms, 200 ms | 1,1 kHz, 180 ms, 2,6 | — | 220 ms | 800 ms |
| Grenade | 110→45 Hz, comme la roquette | — | — | — | 520 ms |

- Filtre DC à 25 Hz dépendant du taux, exp(−2π·25/rate), au lieu de .991.
- Garder la banque PCM à 22 050 Hz, construite une fois (0,7 à 4 ms par tampon).
- audio.test.mjs:67, nouveaux plafonds : pistolet < .36, SMG < .26, pompe < .95, roquette < .82, grenade < .55.
- audio.test.mjs:279 : nouvelle longueur du pistolet.
- Garder la règle « SMG rms < roquette rms » (:66).

**Gain attendu.** - Énergie sous 120 Hz ×7 à ×19 (de 1,5–9,9 % à 21,5–28,9 %).
- Centroïde de 2,2–3,4 kHz à 0,7–1,5 kHz.
- Durée de 90 % de l'énergie ×2,5 à ×3,6.
- Crête de 16–19 dB à 9–11 dB : plus dense et plus fort à pic égal.

**Risques.** - Ressenti subjectif : David doit écouter les WAV avant intégration.
- Voix : à 8 tirs/s, le SMG de 240 ms superpose 2 voix ; vérifier les limites 32/40/48 (test audio :114).
- Taille : environ +1,5 Ko.
- Déterminisme : génération reproductible par graine.
- AGENTS.md : aucun échantillon importé, concept Doom seulement, pas de code copié.

**Vérifier par.** - audio-analyze.mjs et doomish-check.mjs sur la recette intégrée.
- Tests audio avec les nouveaux plafonds.
- Écoute A/B des fichiers de bench/feel/wav.

**Contre-vérification.** Analyse indépendante (t4.mjs, FFT maison sur FAudio.synthesize) : part sous 120 Hz de 1,9 / 3,2 / 8,9 / 1,4 % (SMG, pistolet, pompe, roquette), centroïdes 2398 / 2176 / 3392 / 2971 Hz, 90 % de l'énergie en 20 / 26 / 51 / 120 ms : conforme. Prototype : 22,4 / 25,6 / 21,5 / 28,9 %. Corrections. (1) À pic égal le prototype est 8 dB plus fort en RMS (SMG 0,097 → 0,243) et +11,5 dB sur les 100 premières ms : gains de lecture (.49/.63/.77), duck et compresseur sont à régler en même temps (FEEL-07). (2) Sous 120 Hz, rien ne sort d'un téléphone ou d'un portable ; ce qui porte partout est la bande 120-500 Hz, qui gagne +7,9 dB (SMG), +4,9 (pistolet), +11,5 (pompe), +12,2 (roquette) en énergie absolue : en faire le critère d'acceptation, avec le RMS sur 100 ms. (3) audio.test.mjs:279 fige aussi la longueur du SMG (.105×22050), pas seulement celle du pistolet. (4) La grenade n'est pas prototypée et a déjà 45 % d'énergie sous 120 Hz. (5) La variante 1 de la roquette prototype finit à 0,047, au-dessus de la règle de queue 0,04 si le test s'étend aux deux variantes. audio.js étant dans FERRO, y exposer un générateur paramétrique (thump, corps, mécanique, pièce) et garder les préréglages d'armes côté METAL. Écoute par David avant intégration.

**Gain corrigé.** Bande 120-500 Hz : +4,9 à +12,2 dB d'énergie absolue ; RMS +8 dB à pic égal ; part sous 120 Hz ×7 à ×20 (confirmée, mais inaudible sur petits haut-parleurs).

### FEEL-07 — Mixage : compresseur rapide qui écrase l'attaque, ennemis qui tirent avec le son du SMG du joueur, touches et kills peu audibles
- sévérité moyenne · catégorie audio · effort S · gain estimé
- contre-vérification : **plausible**, priorité P1 · qualité meilleure · moteur et jeu
- lieux : src/audio.js:137-139; src/audio.js:314-315; src/audio.js:335; src/audio.js:588-590; src/audio.js:600; src/audio.js:603; src/audio.js:606

**Preuve.** Code :
- audio.js:314-315 : compresseur seuil −19, knee 18, ratio 5, attaque .004, release .18, suivi d'un plafond waveshaper .875.
- audio.js:137-139 : duckMusic de .45 tenu .14 s.
- audio.js:588-590 : enemyShot réutilise le tampon 'smg' à .24.
- audio.js:600 : hit = click .12 à rate 1,3.
- audio.js:603 : hurt = body .45.
- audio.js:606 : kill = body .19 + dirt .09.
- audio.js:335 : écho envoi .065, délai .117, passe-bas 1450, feedback .14.

**Cause.** Le compresseur, à seuil bas et attaque de 4 ms, tasse les transitoires des armes. Les tirs ennemis ont la signature des armes du joueur. Les confirmations de touche et de kill sont noyées.

**Proposition.** - Compresseur maître : −12 dB, ratio 3:1, knee 6, attaque 12 ms, release 120 ms. Garder le waveshaper .875 comme sécurité.
- Duck de la musique : .35 tenu .22 s pour la pompe et la roquette, .18 s pour le SMG.
- Ennemis : même recette d'arme à rate .85, passe-bas 1,1 kHz, sans clic mécanique, niveau .24, panoramique conservé.
- Touche : tick 2,8 + 4,1 kHz, τ 12 ms, niveau .30, qui monte d'un demi-ton par touche consécutive en 0,4 s (+6 au maximum).
- Kill : thunk 90→50 Hz (τ 70 ms) + tick 3,2 kHz, niveau .45, avec un réticule agrandi 1,6× pendant 0,25 s.
- Envoi d'écho des armes : .09.

**Gain attendu.** Estimé :
- +3 à +5 dB de transitoire perçu sur les tirs (attaque de 4 à 12 ms).
- Tirs ennemis distinguables de ceux du joueur.
- Confirmations de touche et de kill nettes.

**Risques.** - Niveau global plus fort : revérifier pic .8–.85 et rms .025–.4 dans checks/audio.test.mjs, ainsi que les tests de duck (:313-314).
- Limite de voix à surveiller.
- Ressenti à valider à l'écoute.
- Taille : moins de 1 Ko.

**Vérifier par.** - Harnais de checks/audio.test.mjs : gains, duck, nombre de voix.
- audio-analyze.mjs sur les nouveaux sons hit et kill.
- Écoute A/B.

**Contre-vérification.** Lignes exactes : compresseur audio.js:314-315, écho :335, enemyShot sur le tampon 'smg' à .24 en :592, hit :601, hurt :604, kill :607. Le gain de +3 à +5 dB de transitoire n'est pas mesuré. Effet caché : le DynamicsCompressorNode applique un gain de compensation automatique qui dépend du seuil, du genou et du ratio ; passer de -19/18/5 à -12/6/3 change donc aussi le niveau de tout ce qui est sous le seuil (musique, ambiance, pas), de quelques dB selon mon calcul à la main, à mesurer. Le compresseur de Chrome anticipe d'environ 6 ms, ce qui relativise l'effet d'une attaque à 12 ms. À mesurer avant de figer les valeurs : page file:// avec OfflineAudioContext dans Chrome sans interface, même rafale de SMG, anciens et nouveaux réglages, pic et RMS sur 30 ms. À faire avec FEEL-06, qui monte déjà le RMS de 8 dB.

### FEEL-08 — Déplacement raide : arrêt quasi instantané, élan perdu à chaque atterrissage, contrôle en l'air quasi nul
- sévérité haute · catégorie ressenti · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur et jeu
- lieux : src/simulation.js:8; src/simulation.js:95; src/simulation.js:324-334; src/simulation.js:403-472; src/simulation.js:1322; src/motion.js:75; checks/simulation.test.mjs:546-606

**Preuve.** Code :
- simulation.js:95 : profil moderne {walk 5.4, sprint 7.6, accel 30, friction 42, reverse 50, dash 15.2, air 2.2}.
- simulation.js:324-328 : land() appelle stopMotion(), donc vitesse nulle à l'atterrissage.
- simulation.js:334 : contrôle en l'air de 2,2 m/s².
- simulation.js:8 : GRAVITY = 12.

Mesures :
- Simulation réelle à 120 Hz (move-metrics.mjs) : 90 % du sprint en 83 ms, arrêt en 125 ms sur 0,18 m, inversion en 100 ms, virage de 90° en 83 ms.
- Chute d'une terrasse de 1,6 m : 517 ms en l'air, 0,2 m de dérive latérale, vitesse 0 après l'atterrissage.
- Modèle Q3 converti (accélération plafonnée par projection, friction avec stop speed, air accel 1, 8,13 m/s, g = 20,32) : 90 % en 133 ms, arrêt en 358 ms sur 1,09 m, inversion en 208 ms, 1,87 m de dérive par saut.
- move-tune.mjs (accel 16, friction 9, stop 2,2) : 90 % en 83 ms, arrêt en 242 ms sur 0,67 m, inversion en 125 ms.

**Cause.** Friction 42 et reverse 50 tuent l'inertie. land() remet la vitesse à zéro, donc chaque chute se termine en arrêt net. 2,2 m/s² en l'air ne donnent aucun contrôle. La raideur vient de l'absence d'élan, pas de la vitesse de pointe.

**Proposition.** Profil moderne seulement : le profil legacy garde ses tests (:546-606) et walkTo.

Au sol, par sous-pas à 120 Hz :
- Friction : perte = max(|v|, STOP) × FRICTION × dt, avec FRICTION 9 et STOP 2,2 m/s.
- Accélération plafonnée par projection : add = wish − v·ŵ ; a = min(ACCEL × wish × dt, add), avec ACCEL 16.
- Course 7,6 m/s, marche 4,2 m/s (option « toujours courir »).

En l'air :
- AIR_ACCEL 1,1 avec la même projection (strafe aérien).
- Plafond horizontal de 10,5 m/s.
- land() conserve la vitesse horizontale, sauf à l'atterrissage d'un pad.
- Gravité 20 hors pads ; avec padId ≠ null, garder 12 et 2,2 pour ne pas casser les paraboles de :361.

Autres :
- Recul d'explosion appliqué en vitesse, sans boost vertical de ses propres roquettes.
- Plongée de caméra à l'atterrissage : view.height −min(.08, impact × .012), amortie à ω 18.
- simulation.js:1322 : élargir le clamp d'observedVX/VZ de ±6 à ±11, sinon l'IA ne calcule plus l'avance de ses tirs au-delà de 6 m/s.

**Gain attendu.** - Démarrage inchangé (83 ms).
- Arrêt de 125 à 242 ms, glisse de 0,18 à 0,67 m (Q3 : 358 ms et 1,09 m).
- Inversion de 100 à 125 ms.
- Contrôle en l'air de 0,2 à 1,6 m par saut.
- Élan conservé à l'atterrissage.

Ces gains sont mesurés sur le modèle ; le ressenti en jeu reste qualitatif.

**Risques.** - Déterminisme : intégration fermée par sous-pas fixe de 120 Hz ; vérifier l'invariance de 20 à 120 fps.
- Collisions : glisse plus longue près des bords et des chutes.
- Sauvegardes : les champs AIR sont déjà sauvés ; ajouter physicsVersion 2.
- IA : prédiction observedV à élargir.
- Tests : dupliquer le test d'invariance de trajet pour le profil moderne.
- Licence : concepts Q3 seulement, aucune ligne GPL.
- Taille : moins de 1 Ko.

**Vérifier par.** - move-metrics.mjs et move-tune.mjs sur la simulation modifiée : 90 % en 90 ms au plus, arrêt sur 0,6 à 0,8 m, inversion en 130 ms au plus, vitesse après chute ≥ 90 % de la vitesse d'arrivée.
- Nouveau test : même trajet à 20, 60 et 120 fps, écart inférieur à 0,05 m.

**Contre-vérification.** Mesures refaites (t7.mjs, simulation réelle) : 90 % du sprint en 83 ms à 120 pas/s (100 ms à 60), arrêt sur 0,181 m en 117 à 133 ms, inversion en 100 ms, chute de 1,6 m en 517 ms avec vitesse 0 à l'image d'atterrissage. Corrections. (1) L'intégration actuelle est une forme fermée exacte (simulation.js:423-430), donc indépendante des fps. Le constat suppose un « sous-pas fixe de 120 Hz » qui n'existe pas : count=ceil(dt·120) et part=dt/count en :435, et game.js:690 appelle sim.step avec dt/ceil(dt·60). Un modèle Q3 intégré en Euler rendrait distance d'arrêt et vitesse de bunny-hop dépendantes des fps (le défaut historique de Q3). Exiger une forme fermée par morceaux (friction exponentielle au-dessus de STOP, linéaire en dessous ; accélération en rampe plafonnée) ou un vrai pas fixe avec accumulateur. (2) L'élan perdu à l'atterrissage coûte peu aujourd'hui : environ 0,25 m et 80 ms, car l'accélération vaut 30. (3) Le clamp ±6 de :1322 est déjà sous la vitesse de sprint de 7,6 m/s : l'IA sous-estime déjà l'avance. (4) Les citations sont décalées : land() est en :324-333, le contrôle aérien en :340-341. Destination : simulation.js pour METAL, plongée de caméra dans motion.js pour FERRO. Ressenti à valider en jouant.

### FEEL-09 — Pas de saut : les obstacles de 0,43 à 1,0 m sont infranchissables et le jeu n'a aucune verticalité
- sévérité haute · catégorie ressenti · effort L · gain mesuré
- contre-vérification : **plausible**, priorité P1 · qualité meilleure · jeu
- lieux : src/options.js:4; src/options.js:17; src/simulation.js:260; src/simulation.js:328; src/simulation.js:2088-2093; src/world.js:112-116; src/game.js:96; src/game.js:683-688

**Preuve.** Code :
- options.js:4 : aucune action « jump ».
- simulation.js:260 : move() ne franchit que des marches de ±0,42 m.
- simulation.js:328 : impact > 6 sur fallbackLanding déclenche fatalFall.
- simulation.js:2088-2093 : validAir exige airVY ≤ .001 quand on est en l'air hors pad ; un instantané pris pendant une montée serait rejeté.
- game.js:96 : saveCheckpoint attend déjà la fin d'un vol.

Mesures :
- jumpable.mjs : 138 obstacles de 0,43 à 1,0 m dans le monde 0, 227 dans le monde 17.
- world.js:112-116 : boundary() à .72 / 1.55 / .94 m.
- outdoorBoundaries : 119 à 197 segments, 941 à 1240 m par monde, hauteurs .72 / .94 / 1.0 qui deviendraient franchissables. 97 murets bas ont du substrat derrière eux dans les bornes (boundaries.mjs, parapets.mjs).
- Sols à −0,25 / 0 / 1,6 / 3,2 / 4,8 / 6,4, reliés par des rampes (steps.mjs).
- Modèle : un saut de 6,2 m/s qui retombe sur du substrat touche à 6,2–7,1 m/s, au-dessus du seuil de 6, donc mortel.

**Cause.** Le jeu n'a jamais eu de saut. La collision et la validation des instantanés supposent qu'on n'est en l'air qu'en tombant ou sur un pad.

**Proposition.** Saut :
- 6,2 m/s à g = 20 : apex 0,96 m, 620 ms en l'air.
- Coyote time : 0,10 s après avoir quitté un bord.
- Tampon : 0,12 s avant l'atterrissage.
- Bunny-hop : pas de friction sur le sous-pas d'atterrissage si un saut est en tampon, avec le plafond de 10,5 m/s (10 sauts optimaux : 10,5 m/s au lieu de 30,9 sans plafond).

Collisions et chutes :
- Boîtes de clip créées au chargement à partir de outdoorBoundaries, montées à 2,4 m pour le joueur seulement. L'empreinte du monde et le fingerprint de sauvegarde ne changent pas.
- Seuil de chute mortelle : sqrt(2·g·1,5) = 7,75 m/s à g = 20, soit la même hauteur de 1,5 m qu'aujourd'hui.
- physicsVersion 2 : autoriser airVY ≤ 6,2 quand padId est null.

Entrées :
- Nouvelle action « jump » sur Espace.
- Migration (options.js:17, motif added) : les profils où dash = Space passent à dash = KeyR et jump = Space, avec un toast « Espace : saut · R : esquive ».
- Manette : bouton A.
- Tactile : bouton de saut.

**Gain attendu.** - 138 à 227 obstacles de 0,43 à 1,0 m par monde deviennent franchissables (mesuré).
- Les ondes de boss deviennent sautables (FEEL-05).
- Les arènes gagnent de la verticalité (qualitatif).

**Risques.** - Sorties de niveau, le plus gros risque de l'axe : 97 murets bas ont du substrat derrière eux ; le clip de 2,4 m et un test de non-sortie sont obligatoires.
- Sauvegardes : physicsVersion et validAir.
- Tests : migration dans options.test, checkpoint, sortie des bornes en simulation.
- IA : joueur en hauteur (sight, observedVY).
- AGENTS.md : bouton tactile.
- Licence : concepts seulement.
- Taille : environ 2 Ko.

**Vérifier par.** - parapets.mjs et boundaries.mjs adaptés : sauter à pleine vitesse contre chaque muret bas ne fait jamais sortir des bornes.
- jumpable.mjs : part des obstacles franchis.
- Test d'instantané « restore pendant un saut ».
- options.test : migration d'Espace vers le saut.

**Contre-vérification.** Gain principal réfuté. jumpable.mjs rejoué : 138 et 227 colliders de 0,43 à 1,0 m, mais t5.mjs montre que 119 des 138 (monde 0) et 195 des 227 (monde 17) sont les murets de bordure eux-mêmes, que la même proposition ferme par un clip de 2,4 m. Restent 19 obstacles (10 de 0,71 m, 9 de 0,96 m) à 32 par monde, et aucun rebord entre 0,43 et 1,0 m (terrasses espacées de 1,6 m). Le saut reste justifié par la demande Quake 3, le ressenti et les ondes de boss, pas par la traversée. Risques oubliés. (1) GRAVITY est une constante partagée (simulation.js:8) : projectiles en :1053, grenades en :1073-1074, solution de tir en cloche de l'IA en :1218 ; g = 20 doit être réservé au vol du joueur. (2) La chute mortelle est jugée sur la vitesse d'impact (:328) : avec un seuil de 7,75 m/s, sauter d'un obstacle de 0,71 à 0,96 m vers le substrat touche à 8,2-8,8 m/s et tue ; juger sur la hauteur entre l'appui de départ et l'arrivée (plus de 1,5 m). (3) restore() doit accepter physicsVersion 1 et 2 (:1970). validAir relu en :2088-2093 : exact.

**Gain corrigé.** 19 à 32 obstacles franchissables par monde, au lieu de 138 à 227.

### FEEL-10 — Aucun support manette : architecture proposée et points d'intégration exacts
- sévérité haute · catégorie entrées · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur et jeu
- lieux : src/gamepad.js (nouveau); tools/build.py:6; src/game.js:18; src/game.js:683-690; src/game.js:813; src/simulation.js:848; checks/checkpoint.test.mjs (harnais navigator); checks/build.test.mjs

**Preuve.** Code :
- 0 occurrence de « gamepad » dans src/, index.html, tools/ et checks/.
- game.js:18 : objet input {moveX, moveY, lookX, lookY, fire, fireLeft, dash, pulse, melee, interact, weapon, sprint, assist:touch}.
- game.js:683-688 : fusion clavier, souris et tactile, puis remise à zéro des impulsions.
- game.js:690 : sous-pas ceil(dt·60).
- game.js:813 : souris à .0022 rad par compte.
- simulation.js:848 : bonus d'assistance au rayon min(s.weapon ? .16 : .38, along × (s.weapon ? .012 : .025)), actif seulement si input.assist. L'arme 0 (le SMG en arsenal) reçoit le gros bonus, sans doute un héritage du tactile.
- tools/build.py:6 : liste des modules.
- Le harnais de checkpoint.test n'a pas navigator.getGamepads.

Mesures (gamepad-map.mjs, fonctions pures branchées sur la vraie simulation) :
- Réglages : zone morte radiale .12 / .97, expo 1,7, 300°/s en lacet, 190°/s en tangage, boost +80 % après 0,18 s à fond.
- Lacet : 5,4°/s à 20 % de déflexion, 76°/s à 50 %, 157°/s à 70 %, 300°/s à fond.
- Demi-tour en 483 ms.
- Déplacement : 2,63 m/s avec le stick à 55 %, 7,60 m/s à fond.

**Cause.** Les entrées ont été conçues pour le clavier, la souris et le tactile, sans couche d'abstraction des actions.

**Proposition.** Module :
- Nouveau src/gamepad.js : FGamepad.create(prefs).poll(dt, ctx) renvoie {moveX, moveY, lookX, lookY, fire, fireLeft, sprint, pressed:{…}}.
- L'ajouter dans tools/build.py:6 entre options.js et game.js.

Intégration :
- Lire navigator.getGamepads?.() une fois par frame dans frame(), avant la fusion de :683.
- Déplacement : garder la plus forte magnitude entre clavier et stick.
- Visée : lookX += yawRate·dt, lookY += pitchRate·dt.
- Impulsions : OU logique avec dashQueued, pulseQueued, meleeQueued et interactQueued.
- input.assist = touch || padActive.

Mapping « standard » :
- Sticks : LS déplacement, RS visée, L3 course, R3 mêlée ou frappe.
- Gâchettes : RT tir (hystérésis .30 / .18), LT garde ou tir gauche.
- Faces : A saut, B esquive, X interagir, Y arme suivante.
- Bumpers : LB onde, RB main gauche.
- Croix : armes 1 à 4 et carte. Start pause, Back carte.

Aide à la visée : ralentissement ×.55 quand une cible est dans atan((0,67 + 0,25)/d), avec sight() mis en cache 100 ms.

Vibrations (vibrationActuator.playEffect('dual-rumble')) :

| Événement | Intensité | Durée |
|---|---|---|
| SMG | faible .12 | 45 ms |
| Pistolet | .18 / .05 | 60 ms |
| Pompe | .55 / .35 | 140 ms |
| Roquette | .6 / .3 | 180 ms |
| Coup reçu | fort .45 × min(1, dmg/20) | 160 ms |
| Blocage | faible .4 | 70 ms |
| Explosion | .7 × (1 − d/12) | 250 ms |
| Atterrissage dur | .35 | 90 ms |
| Impact de boss | .8 | 300 ms |

Limiteur de 40 ms entre vibrations, option on/off. Stub de navigator.getGamepads dans le harnais de test.

**Gain attendu.** Le jeu devient entièrement jouable à la manette. Visée fine : 5,4°/s à 20 % de déflexion, soit 0,09° par image. Demi-tour en 0,48 s.

**Risques.** - Déterminisme : la simulation ne voit que input. assist passe à vrai à la manette, donc revoir le bonus .38 de l'arme 0 (simulation.js:848).
- Taille : +6 à 9 Ko pour un budget de 1,4 Mo (789 Ko actuellement).
- Tests : build.test (présence du module), test unitaire des courbes.
- Navigateurs : pas de vibration sur Safari ; mapping non standard à gérer en brut.
- Aucun port ni réseau.

**Vérifier par.** - gamepad-map.mjs converti en test unitaire (lacet, vitesses).
- Test game avec navigator.getGamepads simulé : A saute, RT tire, une déconnexion met en pause.
- Essai sur une vraie manette Xbox ou PlayStation par David.

**Contre-vérification.** Aucune occurrence de gamepad dans src/game.js de METAL (vérifié). Lignes exactes : game.js:18, :683-690, :813, simulation.js:848, tools/build.py:6. Courbes recalculées à la main : ((0,2-0,12)/0,85)^1,7 × 300 = 5,4°/s, 76°/s à 50 %, 300°/s à fond. Taille actuelle 789 111 octets (SIZE.json). Corrections. (1) BITUME a déjà une manette qui marche : ~/Projects/bitume/src/jeu.js:219-247 (lireManette : zone morte .12, expo 1,6, fronts montants, gâchettes analogiques) et :250-263 (naviguerManette). La partie générique (lecture, zones mortes, courbes, fronts, vibrations, branchement à chaud, navigation de menus) sert donc à deux jeux et va dans FERRO ; seul le mapping reste dans METAL. (2) Doublon de LOOP-07 avec des valeurs contradictoires (zones mortes .18/.12, courbe r^2,2, 4,2 rad/s soit 241°/s, A = esquive) : fusionner en une seule spécification. (3) input.assist à la manette active le bonus de .38 m de l'arme 0 : à revoir comme le dit le constat. Essai sur vraie manette par David.

### FEEL-11 — Manette dans les menus, invites de touches figées pour le clavier, et branchement à chaud
- sévérité moyenne · catégorie entrées · effort M · gain qualitatif
- contre-vérification : **plausible**, priorité P1 · qualité meilleure · moteur et jeu
- lieux : src/game.js:35; src/game.js:62; src/game.js:157-163; src/game.js:223; src/game.js:608-617; src/game.js:812; src/options.js:29-35; index.html (aide, bandeau des capacités, titre des armes)

**Preuve.** Textes figés :
- game.js:163 : « Pistolet + bouclier · clic droit : garde… ».
- game.js:223 : « clic droit : garde · Espace : frapper ».
- game.js:157-158 : lock() et le toast « Maintenez et glissez… Flèches : tourner ».
- index.html : aide « Espace : esquiver · Maj : courir », bandeau « ESPACE · ESQUIVE PRÊTE / E · ONDE PRÊTE / V · CROSSE », titre « (1 à 5, molette) ».

Libellés et pause :
- game.js:35, :62 et :608-617 : libellés via FOptions.keyName, clavier seulement.
- game.js:812 : pointerlockchange met en pause, or la manette n'utilise pas le pointer lock.
- options.js:29 assign et :35 keyName.

**Cause.** Les libellés viennent uniquement des codes clavier ou de textes figés, et les menus ne savent naviguer qu'à la souris ou au toucher.

**Proposition.** 1. Navigation spatiale du focus dans #intro, #pause, #shop et #result. Croix ou LS : élément focusable le plus proche dans la direction (score = distance + 2 × écart perpendiculaire). A clique, B revient. LB/RB changent d'onglet via selectTab. Gauche/droite sur un range : stepUp/stepDown puis dispatch 'input'.
2. padBindings dans FOptions, avec defaults, normalize et assign comme pour le clavier.
3. Fonction promptLabel(id) : renvoie la touche, le bouton tactile ou le glyphe manette selon le dernier périphérique utilisé (Xbox A/B/X/Y ou PlayStation ✕○□△ d'après pad.id). Elle remplace keyName et les textes figés listés plus haut.
4. Branchement à chaud :
   - toast sur gamepadconnected, pause sur gamepaddisconnected ;
   - body.pad masque les commandes tactiles ;
   - ni toast lock() ni pause pointerlock quand la manette est active ;
   - vérifier qu'un appui manette démarre l'AudioContext, sinon afficher « A : activer le son ».
5. Section « Manette » dans les options : sensibilités en °/s, zone morte, courbe, inversion, assistance de visée, intensité des vibrations.

**Gain attendu.** Parcours complet menu → partie → boutique sans souris, avec des invites justes pour le clavier AZERTY ou QWERTY, le tactile et la manette.

**Risques.** - Tests : migration des options.
- AGENTS.md (accessibilité des relais, de la sortie et des objets) : focus visible obligatoire.
- Taille : +3 à 5 Ko.
- Activation audio par la manette : à tester sur un vrai appareil.
- Déterminisme : non concerné.

**Vérifier par.** - Test DOM : navigation du focus dans #pause dans les 4 directions ; promptLabel selon le périphérique.
- options.test : normalize de padBindings.
- Essai manuel avec une manette.

**Contre-vérification.** Lignes relues : game.js:35 (bindingLabel), :62, :159 (verrouillage et toasts), :163, :223 (texte exact : « clic droit : garde · Espace : frappe »), :608, :812. Faisable. BITUME a déjà une navigation de menus à la manette (jeu.js:250-263 : ordre linéaire du focus, curseurs à gauche/droite, A valide, B revient) : la reprendre dans FERRO avant d'écrire une navigation spatiale. Aucune mesure possible ; essai manuel requis, y compris le démarrage de l'AudioContext par un bouton de manette.

### FEEL-12 — Surchauffe : le SMG se verrouille après 1,73 s de tir et reste bloqué 59 % du temps
- sévérité haute · catégorie ressenti · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/simulation.js:1106-1135; src/simulation.js:1116; src/simulation.js:1910; src/economy.js (rangs de refroidissement); checks/simulation.test.mjs:150-162

**Preuve.** Code :
- simulation.js:1106-1135 : délais entre tirs pistolet .32, SMG .125, pompe .78/.98, roquette 1,25, grenade .95.
- simulation.js:1116 : chaleur par tir pistolet .06, SMG .09, pompe .32/.47, roquette .48, grenade .38.
- simulation.js:1910 : refroidissement dt × (fireWait > 0 ? .1 : .35) × cooling ; l'arme ne se débloque que sous heat < .3, soit environ 2 s de verrou.

Mesures (weapon-cadence.mjs, 10 s de gâchette maintenue, règles arsenal) :

| Arme | Tirs | 1re surchauffe | Temps bloqué |
|---|---|---|---|
| SMG | 34 | 1,73 s | 59 % |
| Double pompe | 7 | 1,97 s | 61 % |
| Roquettes | 6 | — | 58 % |
| Grenades | 7 | — | 52 % |
| Pistolet | 30 | jamais | 0 % |
| SMG + pompe main gauche | 20 | — | 84 % |

Économie : refroidissement +20 % par rang (3 au maximum), chaleur ÷(1 + .08 × rang) (8 rangs au maximum).

**Cause.** En tirant, l'arme ne refroidit presque pas (.1/s), et le seuil de déblocage est bas (.3). Le verrou dure donc environ 2 s : le joueur subit une arme muette au lieu de gérer sa chaleur.

**Proposition.** En arsenal seulement, pour que le test de surchauffe legacy (simulation.test.mjs:150-162) reste valide :
- Chaleur par tir : SMG .055, pompe .26/.36, roquette .34, grenade .28, pistolet .06.
- Refroidissement : .22/s en tirant, .55/s au repos.
- Déblocage sous heat < .55.
- En option : roquette de 1,25 à .95 s, grenade de .95 à .80 s.
- Signal de montée en chaleur au-dessus de .75 : cliquetis sonore et léger tremblement de l'arme.

**Gain attendu.** Mesuré avec heat-proto.mjs :
- SMG : de 34 à 69 tirs en 10 s ; 1re surchauffe de 1,73 à 6,27 s ; temps bloqué de 59 à 11 %.
- Pompe : de 7 à 10 tirs ; de 61 à 31 % bloqué.
- Roquettes et grenades : plus jamais en surchauffe.
- SMG + pompe gauche : de 84 à 75 % bloqué.

**Risques.** - TTK : le dps du SMG double, donc recalibrer les PV des boss ou ses dégâts.
- Économie : les rangs de refroidissement perdent de leur valeur, revoir prix et effets.
- Tests : legacy inchangé si la règle est limitée à l'arsenal ; tests d'arsenal à recalibrer.
- Déterminisme : constantes seulement.
- Taille : neutre.

**Vérifier par.** - heat-proto.mjs et weapon-cadence.mjs : atteindre les valeurs ci-dessus.
- Test simulation arsenal : 6 s de tir au SMG sans surchauffe.

**Contre-vérification.** Rejoué avec mon propre patch (t6.mjs, 60 pas/s, 10 s) : SMG 34 tirs, 1re surchauffe à 1,75 s, bloqué 59 % ; proposé 69 tirs, 6,28 s, 11 %. Pompe 7 → 10 tirs, 61 → 31 %. Roquettes et grenades : plus de surchauffe. SMG + pompe gauche : 84 → 75 %. Corrections : aujourd'hui les roquettes surchauffent à 2,52 s et les grenades à 2,87 s (le tableau met un tiret). Le débit du SMG double (×2,03) : équilibrage des PV et des rangs de refroidissement à refaire, comme annoncé. La ligne :1910 est commune aux deux modes : la brancher sur arsenal pour garder le test hérité. Interaction avec LOOP-08 : la cadence réelle est de 7,5 tirs/s à 60 et 120 pas/s, 8,0 à 144. Cause non vue : la jauge est unique pour toutes les armes (FEEL-V1), ce qui explique les 75 % restants à deux armes.

### FEEL-13 — Recul et caméra : même ressort pour toutes les armes, aucune réaction de la caméra au tir, shake du renderer jamais utilisé
- sévérité moyenne · catégorie ressenti · effort S · gain estimé
- contre-vérification : **plausible**, priorité P1 · qualité meilleure · moteur et jeu
- lieux : src/motion.js:36-46; src/motion.js:58; src/motion.js:69-77; src/game.js:720; src/game.js:722; src/renderer.js:1009-1010; src/renderer.js:1253-1254; src/renderer.js:1497-1498

**Preuve.** Code :
- motion.js:37-40 : impulsions de recul SMG 1,9, pistolet 1,45, pompe (fracture) 3,5, roquette 5,5.
- motion.js:58 : tout est amorti avec le même ω 27.
- motion.js:69-70 : le recul ne touche que l'arme.
- game.js:720 : la caméra prend pitch = p.pitch sans aucun décalage ; view.fov ne varie qu'avec la course et le dash (motion.js:77).
- game.js:722 : renderer.draw(… shake:0 …), alors que renderer.js:1009-1010, :1253-1254 et :1497-1498 savent appliquer fx.shake.
- Seul mouvement de caméra existant : le canal blast des explosions à moins de 14 m (motion.js:75-76).

Mesures (kick.mjs) :
- Recul : SMG 2,57 cm et 1,25°, pistolet 1,97 cm et 0,96°, pompe 4,74 cm et 2,31°, roquette 7,45 cm et 3,63°.
- Toutes les armes culminent à 33 ms et reviennent sous 10 % à 183 ms.
- Caméra au tir : 0.

**Cause.** Un seul ressort pour toutes les armes et aucun canal de caméra lié au tir : les armes ont toutes le même poids et la vue ne réagit pas.

**Proposition.** Tout ceci est de la présentation : p.pitch et la visée ne changent pas.
- Ressort par arme : ω SMG 38, pistolet 30, pompe 18, roquette 14. Multiplier les impulsions par ω/27 pour garder l'amplitude mesurée.
- Coup de tangage caméra : ajouter view.pitch à camera.pitch en game.js:720. SMG .35°, pistolet .6°, pompe 2°, roquette 2,6°, grenade 1,2°, retour à ω 16.
- Punch de FOV : pompe −1,8°, roquette −2,5° (canal fov, ω 14).
- Shake du renderer : explosions proches .6 × (1 − d/8), roquette .25, pompe .15, décroissance 6/s.
- Roulis alterné du SMG : ±.6°.
- Flash du SMG : décroissance 14/s.
- Tout multiplier par .3 quand softMotion est activé.

**Gain attendu.** Retour sous 10 %, calculé sur un ressort critique :
- SMG : de 183 à environ 129 ms, rafale plus lisible.
- Pistolet : environ 163 ms.
- Pompe : environ 272 ms, plus lourde.
- Roquette : environ 349 ms.

La caméra passe de 0 à 2–2,6° de coup sur la pompe et la roquette.

**Risques.** - Confort, risque de nausée : réduction par softMotion et option dédiée.
- Déterminisme : intact, la visée de la simulation ne bouge pas.
- Tests : éventuels tests de motion.
- Taille : moins de 1 Ko.

**Vérifier par.** - kick.mjs étendu : pic, retour sous 10 % par arme, mouvement de caméra.
- Capture headless file:// optionnelle.

**Contre-vérification.** Chiffres confirmés par le calcul : ressort critique, pic v0/(ω·e) = 1,9/(27×2,718) = 2,59 cm, retour sous 10 % à 4,89/ω = 181 ms ; 129 / 163 / 272 / 349 ms pour ω 38 / 30 / 18 / 14. game.js:722 passe bien shake:0 ; renderer.js:1009-1010, :1253-1254, :1497-1498 savent l'appliquer. Corrections. (1) Sens de softMotion inversé : softMotion=true est le défaut « Doux », effets actifs (game.js:55, :718 le passe comme enabled) ; false correspond à prefers-reduced-motion (game.js:9). La réduction doit donc s'appliquer quand softMotion est faux, avec caméra à 0 comme motion.js:78-81. (2) Un coup de tangage caméra sans toucher la visée décale le réticule des impacts : au SMG en rafale, décalage moyen ≈ pic × e/ω × cadence = 0,35° × 2,718/16 × 8 ≈ 0,48°, soit environ 7 px en 1080p. Déplacer le réticule du même angle, ou se limiter au roulis, au FOV et au recul de l'arme pour le SMG. (3) Un seul canal 'kick' à ω fixe (motion.js:58) : il faut mémoriser ω à l'impulsion. motion.js et renderer.js sont dans FERRO : passer la table d'impulsions en paramètre, défauts inchangés.

### FEEL-14 — Les ennemis ne réagissent pas aux impacts : seulement une teinte de 0,2 s
- sévérité moyenne · catégorie ia · effort M · gain estimé
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · jeu
- lieux : src/simulation.js:816; src/actors.js:30; src/simulation.js:795; src/simulation.js:1166; src/audio.js:606

**Preuve.** - simulation.js:816 : damageEnemy fait e.hurt = .2 et passe l'ennemi en mode « investigate », sans interruption ni recul.
- actors.js:30 : hurt ne produit qu'une teinte.
- Seuls retours physiques existants : la frappe de bouclier (simulation.js:795, étourdissement .65 s et poussée de 1,25 m) et la mêlée (simulation.js:1166, étourdissement .18 s).
- audio.js:606 : son de kill faible (body .19 + dirt .09).

**Cause.** Il n'existe pas d'état de douleur : toucher un ennemi n'a aucune conséquence visible, ce qui rend les armes légères.

**Proposition.** 1. Pose de recul dans actors.js, calculée depuis e.hurt : amplitude .1 + .1 × min(1, amount/2), encodée dans e.hurt sans nouveau champ sauvegardé. Buste incliné de 8 à 15°, décalage de .05 m.
2. Chance de douleur déterministe : hash(e.id, s.shots) sous un seuil. Type 0 : 60 % ; type 2 : 35 % ; lourd (type 1) : 15 % et seulement à la pompe ou à la roquette. Effet : e.windup += 0,2 s, ce qui interrompt le tir en préparation. Boss exclus.
3. Recul à la pompe et à la roquette : 0,05 m par plomb (×0,4 pour les lourds), via move(e, …) avec collision.
4. Confirmation de kill : réticule en X pendant 0,3 s et son de kill de FEEL-07.

**Gain attendu.** Chaque touche devient visible. Environ 0,2 s de répit par douleur, soit un dps ennemi effectif réduit de 10 à 20 % au corps à corps (estimé).

**Risques.** - Déterminisme : hash pur, pas de Math.random.
- Sauvegardes : rien de nouveau.
- IA : boss (giant) exclus.
- Tests combat et IA de simulation.test à compléter ; équilibrage à revoir.
- Taille : environ 1 Ko.

**Vérifier par.** - Nouveau banc : 10 s de tir au SMG sur un type 0, compter les tirs ennemis interrompus.
- Test simulation : pompe à 3 m, recul supérieur à 0,1 m sans traverser de mur.

**Contre-vérification.** Code relu : simulation.js:816 (e.hurt=.2, passage en investigate), actors.js:30 (teinte seule), mêlée en :1169 (étourdissement .18, windup=0, burstLeft=0). Défaut dans la proposition : windup est un compte à rebours (:1790 : décrément, puis attack(e) à zéro). « e.windup += 0,2 » retarde le tir au lieu de l'interrompre, et sur un ennemi au repos (windup 0) il déclencherait une attaque 0,2 s plus tard. Conditionner à e.windup>0 et borner par windupMax, ou reprendre le mécanisme existant de la mêlée. e.hurt est validé dans [0 ; 0,2] par restore() (:2114), donc l'encodage tient, mais c'est aussi une entrée du réseau tactique (:1496, e.hurt/.35) : les décisions de l'IA bougeront un peu. Gain de 10 à 20 % non mesuré.

## Constats ajoutés par le contre-vérificateur

### FEEL-V1 — Surchauffe globale : une jauge unique verrouille toutes les armes et les deux mains ; changer d'arme ne sert à rien pendant 2 s
- sévérité haute · catégorie ressenti · effort M · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/simulation.js:1113; src/simulation.js:1116; src/simulation.js:1910; src/simulation.js:1946

**Preuve.** Code : simulation.js:1116 incrémente un seul p.heat quelle que soit l'arme ou la main ; :1113 `if(p.overheated||...)return false` refuse le tir de toute arme, pistolet compris ; :1910 refroidit cette jauge unique et ne déverrouille que sous .3. Mesure (bench/feel-verif2/t10.mjs, simulation réelle, 60 pas/s) : SMG tenu jusqu'à la surchauffe à 1,75 s ; premier tir possible ensuite après 2,08 s en gardant le SMG, 2,08 s en passant au double pompe, 2,08 s en passant aux roquettes, 2,08 s avec le pompe en main gauche. FEEL-12 constate 84 % de temps bloqué à deux armes et ne le ramène qu'à 75 %.

**Cause.** La chaleur est un attribut du joueur et non de l'arme. Après une surchauffe, le joueur n'a plus que la mêlée pendant 2 s : changer d'arme, le réflexe d'un FPS nerveux, est sans effet.

**Proposition.** Chaleur par arme, en arsenal seulement. Tableau weaponHeat[weaponSlots] et weaponOverheated[weaponSlots] ; fireArsenal lit et écrit l'entrée de l'arme tirée ; chaque arme refroidit à .35/s quand elle ne tire pas (.1/s pendant son propre délai), déverrouillage par arme. p.heat et p.overheated restent le miroir de l'arme en main droite pour le HUD et les anciens instantanés. Sauvegardes : arsenalVersion +1, tableau optionnel validé (0 à 1 par entrée) ; un ancien instantané initialise toutes les entrées à p.heat. Mode hérité inchangé. Critère : après surchauffe du SMG, le pompe tire dès l'image suivant le changement d'arme ; le SMG reste verrouillé le même temps qu'aujourd'hui.

**Gain attendu.** Délai avant de pouvoir tirer avec une autre arme après une surchauffe : de 2,08 s à 0 s. SMG + pompe en main gauche : le pompe n'est plus bloqué par la chaleur du SMG.

**Risques.** Équilibrage : le débit en alternant les armes augmente, à régler avec FEEL-12. Sauvegardes : nouveau champ, donc version et validation atomique. Tests de surchauffe d'arsenal et d'instantané à compléter. Déterminisme intact (constantes). HUD : barre de chaleur de l'arme en main, et une seconde pour la main gauche.

**Vérifier par.** t10.mjs sur le code modifié : 0 s pour une autre arme, environ 2 s pour l'arme surchauffée. Test simulation : surchauffe du SMG, changement d'arme, tir accepté. Test restore d'un ancien instantané.

### FEEL-V2 — L'esquive est coupée net au bord d'un rebord : invulnérabilité annulée, vitesse de 15,2 à 7,6 m/s, puis 0 à l'atterrissage
- sévérité moyenne · catégorie ressenti · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/simulation.js:266; src/simulation.js:269; src/simulation.js:330; src/simulation.js:396-402; src/simulation.js:445-451

**Preuve.** Code : simulation.js:266 et :269, en quittant un appui de plus de 0,42 m : `airVX:velocityX ... p.dashing=0;stopMotion()` ; la vitesse d'esquive n'entre jamais dans velocityX (commentaire :396), donc elle disparaît au décollage ; :330 remet tout à zéro à l'atterrissage. Mesure (bench/feel-verif2/t10.mjs, terrasse de 1,6 m, sprint puis esquive) : sur le plat, 200 ms d'invulnérabilité et 15,2 m/s ; rebord à 0,3 m : 17 ms d'invulnérabilité, vitesse en l'air 7,60 m/s, vitesse 0 à l'atterrissage ; rebord à 0,8 m : 50 ms ; rebord à 1,5 m : 100 ms. Distance en 1,2 s : 10,23 m sur le plat contre 9,12 à 9,69 m.

**Cause.** L'esquive est une intégrale de déplacement au sol, hors de l'accumulateur de vitesse. Quitter le sol l'efface, avec ses images d'invulnérabilité.

**Proposition.** Au décollage pendant une esquive : ajouter à airVX/airVZ la vitesse instantanée de l'esquive (dérivée de dashIntegral à dashAge, fois motionProfile.dash, selon dashX/dashZ), plafonnée à 16 m/s, et laisser p.dashing finir son décompte en l'air (décrément dans airMove). Ne plus appeler stopMotion() dans ce cas, seulement remettre à zéro les mélanges d'animation. À l'atterrissage, conserver la vitesse horizontale (commun avec FEEL-08). Critère : esquive lancée à 0,3 m d'un rebord : au moins 180 ms d'invulnérabilité et plus de 12 m/s au décollage.

**Gain attendu.** Invulnérabilité au bord d'un rebord : de 17-100 ms à environ 200 ms. Vitesse au décollage : de 7,6 à environ 15 m/s. L'esquive par-dessus un vide devient possible.

**Risques.** Sorties de niveau : une esquive vers un muret bas porte plus loin, à couvrir par le test de non-sortie de FEEL-09. validAir accepte déjà des vitesses jusqu'à 32. Tests de chute et d'esquive à compléter. Déterminisme intact. Chutes mortelles plus faciles à provoquer depuis une terrasse : garder le plafond de vitesse.

**Vérifier par.** t10.mjs sur le code modifié (trois distances au rebord). Test simulation : esquive au bord, invulnérabilité au moins 0,18 s, joueur dans les bornes.

### FEEL-V3 — Les solides de 7 à 43 cm sont des murs, et la caméra saute de 0,25 à 0,40 m en une image sur une marche de sol
- sévérité moyenne · catégorie ressenti · effort M · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : src/simulation.js:209-214; src/simulation.js:242-246; src/simulation.js:260-271; src/game.js:720; src/motion.js:74-77

**Preuve.** Code : simulation.js:212, support() n'examine le dessus des solides que si le sol diffère déjà de plus de 0,43 m ; :246, blocked() n'ignore que les solides de 6 cm au plus ; :267 et :270, putHeight immédiat sur une marche ; game.js:720, hauteur de caméra = p.y+1,62+view.height, sans lissage. Mesure (bench/feel-verif2/t8.mjs, simulation réelle) : solide de 0,05 m franchi ; solides de 0,10, 0,25 et 0,40 m sur sol plat : joueur bloqué (z final -3,71 devant le solide en z = -4). Marche de sol de 0,25 m et de 0,40 m : p.y saute de 0,25 et 0,40 m en une seule image. Mondes réels (graine 96, campagne v2) : 24 solides bas dans le monde 0 (16 de 0,26 m, 8 de 0,15 m, posés sur la terrasse à 3,2 m), 16 dans les mondes 5 et 17, et 7 paires de sols à marche de 0,25 m par monde.

**Cause.** Le franchissement de marche n'existe que pour les sols, pas pour les solides, et la vue suit p.y sans amortissement. Le joueur accroche des socles de 15 cm et la vue claque à chaque seuil.

**Proposition.** (1) Vue, dans motion.js (FERRO, donc générique) : nouveau canal view.step. Le jeu passe la hauteur des pieds et un drapeau au sol ; si |Δy| ≤ 0,45 m entre deux images au sol, ajouter -Δy à un décalage qui revient à 0 en exponentielle (ω ≈ 14, environ 200 ms) ; game.js:720 l'ajoute à la hauteur de caméra et au porte-arme. Rien si le paramètre est absent (compatibilité FERRO v0.2), ni en ascenseur, ni en vol, ni avec softMotion faux. (2) Simulation, joueur seulement : dans move(), si la case suivante est bloquée à la hauteur courante par un solide dont le dessus est à 0,42 m au plus et que free(x,z,dessus) est vrai, monter dessus ; le reste inchangé pour les ennemis et la navigation. À confirmer par type de solide : certains socles peuvent être voulus infranchissables. Critère : marche de 0,40 m, déplacement de caméra par image inférieur à 0,08 m à 60 images/s ; solide de 0,25 m franchi sans arrêt.

**Gain attendu.** Saut de caméra par image sur une marche de 0,40 m : de 0,40 m à moins de 0,08 m. 16 à 24 solides bas par monde cessent de bloquer le joueur.

**Risques.** Collision : tests de simulation obligatoires (AGENTS.md) ; ne pas ouvrir de passage par-dessus un solide adossé à un mur (exiger free au-dessus). Navigation de l'IA inchangée si la règle reste réservée au joueur. Le lissage de vue ne touche ni la simulation ni les sauvegardes. Compatibilité FERRO : paramètre optionnel. Utile aussi aux atterrissages sur caisse de FEEL-09.

**Vérifier par.** t8.mjs sur le code modifié. Test motion : Δy de 0,40 m donne un décalage initial de -0,40 m, revenu sous 0,04 m en 200 ms. Test simulation : solide de 0,25 m franchi, solide de 0,25 m collé à un mur toujours bloquant.
