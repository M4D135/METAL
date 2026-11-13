# Axe TACT — TACT — Commandes tactiles et parcours sur téléphone (METAL 673d6b2, couche d'entrées pour FERRO)

Origine : complément. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Axe TACT sur METAL 673d6b2. Le clone est resté intact (git status vide, HEAD 673d6b2) ; tout est dans bench/tact. Trois bancs : (1) le vrai game.js dans le harnais LOOP (DOM factice, horloge virtuelle), avec un pilote de pointeurs tactiles qui imite la capture implicite et la remontée des événements ; (2) Chrome 157 sans interface piloté par tube (--remote-debugging-pipe, aucun port, comme verifications/apercu-interface.py de Point de rupture) sur dist/index.html?touch=1 en file://, avec émulation mobile, vrais touchers (Input.dispatchTouchEvent) et zones sûres d'iPhone ; (3) pages appariées de bench/rgpu et bench/rcpu-verif aux formats téléphone.

Résultats principaux.
- Commandes : le pouce droit ne peut pas viser en tirant (0 pas de tir sur 354 avec visée). Un demi-tour au glisser prend 0,70 à 1,68 s. Le manche a un centre fixe, 34 px de course, aucune zone morte et ne couvre que 8,8 % de la bande gauche. La course n'existe pas (5,4 contre 7,6 m/s). Un deuxième doigt vole la visée. Un prototype appliqué à une copie de game.js donne, sur les mêmes suites de pointeurs : visée sur 62 % des pas de tir, demi-tour en 0,23 à 0,47 s pour un geste rapide, 7,6 m/s en bout de course, 0 appui court perdu.
- Écran : 7 à 9 cibles sur 12 font moins de 48 px (minimum 14 px), 2 à 4 chevauchements par format, 5 cibles hors zone sûre en paysage, la moitié des textes du HUD sous 8 px. Une grille en arc avec saut et frappe, injectée et remesurée, donne 0 cible sous 48 px, 0 chevauchement et le tir à 17 % de la hauteur au lieu de 34 à 41 %.
- Bogue hors téléphone : sur un PC à écran tactile, le jeu passe en mode tactile et la souris ne vise plus (pointer lock jamais demandé).
- Structure d'entrée : même forme pour clavier, tactile et manette ; à flux égal le hash est égal. Deux écarts : assist dépend de l'appareil, et le pas de temps variable rend deux sessions identiques non reproductibles (écart de dt de 9e-16 s, hash différent). C'est le préalable de la « démo qui dure » : pas fixe et flux d'entrées par pas.
- GPU : en auto, DPR 2 et DPR 3 donnent la même image interne (585×1266). Le gouverneur n'a que 24 à 33 % d'autorité sur le GPU à ces formats. Le cache de RCPU-01 gonfle les statiques visibles de 129 % en portrait (22 % en paysage), sans coût GPU mesurable sur M5.

Limites. Le dossier ~/Projects/ferro n'existe pas sur cette machine : FERRO 248043a n'a pas pu être lu, les propositions FERRO s'appuient sur la description de la mission et sur BITUME et Point de rupture. Toutes les mesures GPU viennent d'un Apple M5 chargé (charge moyenne 20 à 86) : seuls les écarts appariés comptent, l'extrapolation aux GPU de téléphone est une estimation. Le gyroscope et le ressenti réel au pouce n'ont pas pu être essayés sur un appareil.

## Mesures

- **Part du temps de tir pendant laquelle la visée bouge (pouce droit sur le bouton de tir, glissant de ±60 px pendant 4 s, pouce gauche sur le manche)** : Actuel : 0 % (0 pas sur 354 à 359 pas de tir, lacet 0,00°, 13 tirs). Prototype : 62,3 % (238 pas sur 382), soit toutes les images où le pouce bouge. _(méthode : bench/tact/touch.mjs M1 : vrai game.js dans le harnais LOOP en ?touch=1, 390×844, pointeurs injectés à 60 Hz, entrées de sim.step enregistrées ; même suite rejouée sur la copie prototype (mkproto.mjs))_
- **Durée d'un demi-tour (180°) au glisser, courses de 210 px, reprise de 120 ms** : Actuel : 1683 ms à 600 px/s, 1033 ms à 1200 px/s, 700 ms à 2400 px/s (785 px à parcourir, 3,7 courses). Prototype à courbe d'accélération : 1600, 467 et 233 ms. _(méthode : touch.mjs M2 : pointeurs sur le canvas échantillonnés à 120 Hz, arrêt quand le lacet du joueur atteint π)_
- **Vitesse de pointe** : Tactile manche à fond : 5,40 m/s. Clavier avec Maj : 7,60 m/s (−28,9 %). Manche poussé à 120 px : toujours 5,40, input.sprint jamais vrai. Prototype au-delà de 1,25 rayon : 7,60 m/s. _(méthode : touch.mjs M3 : maximum de sim.state.locomotion.speed sur 3 s)_
- **Appuis courts sur le bouton de tir perdus (pistolet, 150 appuis espacés de 420 ms)** : 60 images/s : 0 % (appuis de 30 à 100 ms). 30 images/s : 10 % à 30 ms, 0 % à 60 ms et plus. 20 images/s : 18,7 % à 40 ms, 0 % à 60 ms et plus. Prototype avec verrou d'appui : 0 % partout. _(méthode : touch.mjs M4 : phase des appuis tirée au sort (LCG), comptage de sim.state.shots)_
- **Géométrie du manche et multi-doigts** : Appui au bord de la zone : amplitude 1,0 immédiate. Tremblement de 3,6 px : amplitude 0,106, soit 0,57 m/s de dérive. La zone de 102 px couvre 8,8 % de la bande gauche (36 % de l'écran) ; un appui ailleurs dans cette bande ne fait rien. Deuxième doigt sur le canvas : le lacet reste à 6,88° au lieu de 34,38°. Prototype : 0 au bord, 0 au tremblement, 0,21 à 17 px, 0,43 à 28 px, toute la bande utilisable, visée conservée. _(méthode : touch.mjs M5, M6, M7)_
- **Cibles tactiles actuelles (12 cibles par format)** : 390×844 : 7 sous 48 px, minimum 14 px (changement d'arme 114×14), esquive 40×40, onde 40×40, crosse 62×30, carte et pause 36×36, choix main gauche 170×25 ; 4 chevauchements (manche et panneau de vie 2754 px², tir et panneau d'arme 400 px², garde et panneau d'arme 47 px², bouton d'interaction et viseur 448 px²). 844×390 : 9 sous 48 px, minimum 22 px, 2 chevauchements. 360×640 : 9 sous 48 px, minimum 14 px, 4 chevauchements, écart de 3,8 px entre le tir et le changement d'arme. Test de frappe au centre : correct pour les 12 cibles. _(méthode : bench/tact/layout.mjs et measure.js : Chrome 157 sans interface par tube, Emulation.setDeviceMetricsOverride (mobile, DPR 3 ou 2), vrai toucher sur « Lancer l'assaut », getBoundingClientRect et elementFromPoint en jeu ; captures out/shot-*.png)_
- **Zones sûres et portée du pouce** : Paysage avec encoche (47 px à gauche et à droite, 21 px en bas) : manche à 23 px du bord, tir à 27 px, pause à 18 px, changement d'arme à 34 px, choix main gauche à 16 px du bas. Centre du tir à 288 px du bas en portrait (34 % de la hauteur), 158 px en paysage (41 %), 224 px en 360×640 (35 %). _(méthode : layout.mjs avec Emulation.setSafeAreaInsetsOverride (47/34 en portrait, 47/47/21 en paysage), summary.py)_
- **Tailles de texte du HUD en jeu** : 390×844 : 44 textes, 22 sous 8 px, 30 sous 10 px, minimum 5 px. 844×390 : 47 textes, 20 sous 8 px, 29 sous 10 px. 360×640 : 43 textes, 22 sous 8 px, 29 sous 10 px, minimum 4,5 px. Menu : OPTIONS 46,5×37,6 px en 8 px. _(méthode : measure.js : font-size calculée de chaque nœud texte visible de #hud)_
- **Événements souris de compatibilité après un toucher sur le canvas** : Séquence relevée aux 3 formats : pointerdown(touch), touchstart, pointerup(touch), touchend, mousedown, mouseup, click. Le mousedown atteint donc l'écouteur qui arme mouseFire. _(méthode : layout.mjs : écouteurs en capture sur #world puis Input.dispatchTouchEvent (60 ms) dans la zone de visée)_
- **Disposition proposée, avec les boutons saut et frappe ajoutés** : 390×844, 844×390 et 360×640 : 11 cibles, minimum 48 px, 0 sous 48 px, 0 chevauchement, écart minimal de 8,0 px entre boutons ronds, aucune cible hors zone sûre. Centre du tir à 144, 71 et 115 px du bas (17 à 18 % de la hauteur). _(méthode : layout.mjs avec proposal.json (CSS et bouton injectés par Runtime.evaluate), summary.py avec test de chevauchement en cercles)_
- **Temps GPU par image au format 390×844 (Apple M5, auto)** : Image interne 585×1266 (0,74 MPix), identique à DPR 2 et DPR 3. GPU 3,0 à 3,9 ms, CPU de rendu 1,1 à 2,2 ms selon la série. Paysage 1266×585 : GPU 4,5 ms. Qualité haute (780×1688) : +1,75 ms [+1,70 ; +1,90], soit +45 %. Qualité basse (312×675, 563 instances) : −2,40 ms (−62 %). _(méthode : bench/tact/gpu : pages de rcpu-verif/chrome-gen.mjs et rgpu/gen.mjs en 390×844, 230 images mesurées après 420, toutes les variantes rendues sur chaque image, ordre tourné, minimum de 2 répétitions, synchronisation readPixels, IC95 bootstrap (paired2.py))_
- **Paliers du gouverneur de résolution au format téléphone** : ×0,9 (527×1139) : −0,40 ms GPU (−10 %). ×0,8 (468×1013) : −0,70 (−18 %). ×0,7 (410×886) : −1,10 (−28 %). ×0,65 (380×823) : −1,30 ms [−1,30 ; −1,20] (−33 %) ; −0,90 ms (−24 à −30 %) dans deux autres séries ; −1,30 ms (−29 %) en paysage. Modèle : 1,3 à 2,1 ms fixes + 2,2 à 3,3 ms par MPix, soit 43 à 56 % de part fixe. _(méthode : variantes à ratio numérique 1,35, 1,2, 1,05 et 0,975 dans la même page appariée ; séries p3, p2, l3 et neutral)_
- **Surcoût des instances de RCPU-01 aux formats téléphone** : Portrait : statiques visibles 573 → 1314 (+129 %), instances 4182 → 5509 (+32 %), triangles +21 % ; GPU +0,00 ms [−0,10 ; +0,10] ; CPU de rendu 1,40 → 0,50 ms ; écart d'image MAD 0,0007. Paysage : statiques 1315 → 1603 (+22 %), instances +27 %, GPU +0,00 [0,00 ; +0,10]. _(méthode : variante cache de rcpu/proto.mjs dans les pages appariées p3, p2 et l3)_
- **Leviers du premier tour remesurés en 390×844** : Base 4,30 ms (GPU 3,00, CPU 1,10). spec4 : −0,40 ms GPU, MAD 0,036, 0 pixel au-delà de 10 niveaux. suncache : −0,10 GPU et −0,40 CPU, image identique (MAD 0). notorch : −0,30 GPU, 0,10 % des pixels au-delà de 10 niveaux. combo7 : −1,30 ms au total (−30 %), 0,17 % des pixels au-delà de 10 niveaux. Plancher du gouverneur dans la même page : −0,90 ms (−21 %). _(méthode : gpu/neutral.html (rgpu/gen.mjs), écarts d'image toutes les 20 images)_
- **Champ de vision en portrait** : FOV vertical 79° en tactile : 41,7° horizontaux en 390×844, 121,4° en 844×390. Passer à 103° vertical (60° horizontaux) : statiques visibles 494 → 681, instances 4125 → 4276 (+3,7 %), triangles +3,6 %, GPU 3,3 à 3,6 ms contre 3,5 à 3,6 ms. _(méthode : calcul d'après renderer.js:1541 ; pages gpu/fov79.html et fov103.html, 2 séries alternées (non appariées, temps indicatifs, comptes exacts))_
- **Équivalence clavier, tactile, manette** : Même structure (13 champs, mêmes types). Clavier contre tactile, même intention, 211 pas : seul assist diffère (211 pas sur 211). Hash a32ee1ef contre 0482b44e ; le flux tactile rejoué avec les dt du clavier donne a32ee1ef (égal) ; écart maximal de dt 9,1e-16 s. Rejeu de chaque flux dans une simulation neuve : hash égal. Manette (prototype FEEL-10) contre clavier avec Maj : 0 champ différent, hash égal (a1ca8e16). Le même scénario clavier a donné bf78531e dans un autre processus. _(méthode : bench/tact/equiv.mjs : sessions dans le vrai game.js, images de 16,6 ms, empreinte FNV de l'état (joueur, ennemis, projectiles, compteurs))_
- **PC à écran tactile (maxTouchPoints = 10, souris, pas de ?touch=1)** : Classe touch active, 0 appel à requestPointerLock, lacet 0 après 200 comptes de souris (0,44 rad sur un PC sans écran tactile), assist vrai, FOV 79. _(méthode : bench/tact/pctouch.mjs dans le harnais LOOP)_
- **Sous-pas à 60 Hz exact** : 72 images sur 210 font 2 sous-pas de 8,33 ms, selon l'arrondi de now − last (confirme LOOP-05). _(méthode : bench/tact/dbg.mjs)_

## Scripts de banc

- bancs/tact/lib.mjs
- bancs/tact/touch.mjs
- bancs/tact/mkproto.mjs
- bancs/tact/equiv.mjs
- bancs/tact/pctouch.mjs
- bancs/tact/dbg.mjs
- bancs/tact/cdp.mjs
- bancs/tact/layout.mjs
- bancs/tact/measure.js
- bancs/tact/proposal.css
- bancs/tact/proposal.json
- bancs/tact/show.py
- bancs/tact/summary.py
- bancs/tact/gpu/run.sh
- bancs/tact/gpu/paired2.py
- bancs/tact/gpu/cfg-p3.json
- bancs/tact/gpu/cfg-p2.json
- bancs/tact/gpu/cfg-l3.json
- bancs/tact/gpu/cfg-neutral.json
- bancs/tact/gpu/cfg-fov79.json
- bancs/tact/gpu/cfg-fov103.json
- bancs/tact/out

## Constats

### TACT-01 — Le pouce droit ne peut pas viser en tirant : 0 % du temps de tir avec visée
- sévérité haute · catégorie entrées · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur et jeu
- lieux : src/game.js:820-822; src/game.js:830-833; src/index.html:45

**Preuve.** Code : src/game.js:830-831, le bouton de tir capture son pointeur et ne fait que touchFire=true ; il n'a aucun écouteur pointermove. La visée au glisser n'existe que sur le canvas (src/game.js:820-822). Même schéma pour GARDE / TIR G (src/game.js:832-833).
Mesure (touch.mjs M1, vrai game.js, 390×844) : pouce gauche sur le manche, pouce droit appuyé 4 s sur le tir en glissant de ±60 px. 354 à 359 pas de tir, 0 avec lookX ou lookY non nul, lacet 0,00°, 13 tirs.
Prototype (copie de game.js, mêmes pointeurs) : 238 pas de tir sur 382 portent un delta de visée (62,3 %), soit toutes les images où le pouce a bougé.

**Cause.** Le tir et la visée sont deux surfaces distinctes pour le même pouce. Suivre une cible mobile oblige à lever le pouce du tir.

**Proposition.** 1. FERRO : widget « bouton-visée ». Au pointerdown, mémoriser {id, x, y, t} et capturer le pointeur. À chaque pointermove du même pointeur, appeler la même fonction de visée que la zone de visée (TACT-03).
2. Seuil de 4 px : tant que le pouce est à moins de 4 px du point d'appui, aucun delta n'est appliqué, pour qu'un tap ne déplace pas la mire.
3. METAL : activer l'option sur #fire-button et #left-fire-button (garde et tir gauche). Les ordres ponctuels (saut, esquive, frappe, onde) restent de simples boutons.
4. Les deltas du bouton et ceux de la zone de visée se somment dans lookDX et lookDY.

**Gain attendu.** Visée active pendant tout le tir : de 0 % à 62 % des pas de tir (100 % des images où le pouce bouge). Le suivi d'une cible ne coupe plus le feu.

**Risques.** Simulation inchangée : même structure input, donc déterminisme et sauvegardes intacts. Garder l'écouteur lostpointercapture. Environ 0,6 Ko. Le seuil de 4 px n'a pas été mesuré sur un vrai pouce : à régler sur appareil.

**Vérifier par.** node bench/tact/touch.mjs <racine> : M1 doit donner au moins 60 % de pas de tir avec visée. Nouveau cas : appui immobile de 100 ms (déplacement de 3 px) → lacet strictement égal à 0 et shots +1.

**Contre-vérification.** Code relu : src/game.js:830-833, aucun pointermove sur #fire-button ni #left-fire-button, visée seulement sur le canvas (:820-822). Preuve indépendante 1 : touch.mjs rejoué (base 376 pas de tir, 0 avec visée ; prototype 238/379 = 62,8 %). Preuve indépendante 2, Chrome réel (bench/tact-verif/chrome.mjs, vrais touchers, état lu par un piège sur window.FSimulation) : pouce posé sur le tir et glissé de ±60 px pendant 1,5 s → 252 pas de tir, 0 avec visée, lacet 0,00°, 8 tirs ; les 45 pointermove arrivent bien à #fire-button, sans pointercancel (touch-action:none présent, style.css:1). Le bouton-visée est donc faisable sans autre changement. Le « 62 % » est un artefact des sous-pas (lookX remis à 0 après le premier) : lire « 100 % des images où le pouce bouge ». Réserves : le seuil de 4 px n'est pas dans le prototype ; bouton-visée utile à METAL seul aujourd'hui, donc à livrer dans METAL et à ranger dans FERRO avec la couche d'entrées (TACT-09).

**Gain corrigé.** 0 % → 100 % des images où le pouce bouge (62 à 63 % des pas de tir, à cause des sous-pas).

### TACT-02 — Manche à centre fixe de 34 px, sans zone morte, sur 8,8 % de la bande gauche, et aucune course au tactile
- sévérité haute · catégorie entrées · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur et jeu
- lieux : src/game.js:827-829; src/game.js:686; src/game.js:820; src/simulation.js:413; src/simulation.js:95; src/style.css:66

**Preuve.** Code : src/game.js:827-828, centre au milieu de #move-zone, course de 34 px, ni zone morte ni courbe. src/game.js:686 : input.sprint=held('sprint') ne lit que le clavier ; src/simulation.js:413 et :95 donnent alors 5,4 m/s au lieu de 7,6.
Mesures (touch.mjs) :
- M3 : 5,40 m/s manche à fond, 7,60 au clavier avec Maj (−28,9 %) ; manche poussé à 120 px : toujours 5,40.
- M5 : un appui à 4 px du bord de la zone donne tout de suite une amplitude de 1,0. Un tremblement de 3,6 px donne 0,106, soit 0,57 m/s de dérive.
- M7 : la zone de 102×102 px couvre 8,8 % de la bande gauche ; un appui ailleurs dans cette bande ne produit ni déplacement ni visée.
Prototype, mêmes pointeurs : 0 au bord, 0 au tremblement, 0,21 à 17 px, 0,43 à 28 px, 7,60 m/s au-delà de 70 px, toute la bande utilisable.

**Cause.** Le manche est un petit widget posé à un endroit fixe. Le pouce doit le trouver sans le voir, et la moindre erreur de pose devient un déplacement à pleine vitesse.

**Proposition.** FERRO : widget « manche flottant », valeurs par défaut :
- Zone de capture : les 40 % gauches du canvas, un seul pointeur de manche à la fois.
- Centre au point de contact, rayon R = 56 px (clamp(48 px, 14,4 vmin, 64 px)).
- Zone morte radiale 0,12 remise à l'échelle : n = clamp((d/R − 0,12)/0,88, 0, 1), vecteur = direction × n.
- Au-delà de 1,6 R, le centre suit le pouce.
- Course automatique en bout de course : active à partir de 1,25 R, maintenue jusqu'à 1,05 R.
METAL : input.sprint = held('sprint') || courseTactile (src/game.js:686). Le socle visuel se place sous le pouce et revient à sa position de repos au lâcher.

**Gain attendu.** Vitesse de pointe au tactile : 5,4 → 7,6 m/s (+41 %), à parité avec le clavier. Plus de départ à pleine vitesse sur un appui mal centré, plus de dérive au repos, déplacement fin sur 56 px au lieu de 34.

**Risques.** Équilibrage : les joueurs tactiles gagnent la course, à vérifier avec IA-11 (prédiction de visée des ennemis) et FEEL-08. Simulation et sauvegardes inchangées. Les panneaux du HUD situés dans la bande gauche doivent rester en pointer-events:none. Environ 0,8 Ko.

**Vérifier par.** node bench/tact/touch.mjs <racine> : M3 « au-delà du bord » à 7,6 m/s avec sprint vu par la simulation, M5 amplitude 0 au bord et au tremblement, M7 déplacement vrai.

**Contre-vérification.** Code relu : src/game.js:827-829 (centre fixe, 34 px, pas de zone morte), :686 (sprint = clavier seul), simulation.js:95 et :413 (5,4 / 7,6 m/s, la course n'a aucun coût). touch.mjs rejoué : chiffres identiques (5,40 / 7,60 m/s, amplitude 1,0 au bord, 0,106 au tremblement, 8,8 %). Chrome réel (chrome.mjs) : 5,40 m/s à 60 px comme à 120 px, sprint jamais vu, amplitude 1,0 pour un appui à 4 px du bord, appui dans la bande gauche hors manche = ni déplacement ni visée. Correction : « toute la bande utilisable » est faux en l'état. Mesure Chrome (chrome3.mjs, grille de 4 px, elementFromPoint) : 18 à 22 % de la bande gauche est couverte par du HUD non interactif qui avale les touchers (.objective 9 à 10 %, .hud-top 4 à 9 %, enfants de .hud-bottom 3 à 5 %) ; ces blocs ne sont PAS en pointer-events:none aujourd'hui (voir TACT-V2). Risque non cité : sur iOS, un toucher parti à moins de 20 px du bord gauche déclenche le retour arrière de Safari ; borner la zone de capture à max(20 px, zone sûre). Le manche flottant sert aussi BITUME (volant à origine au contact, bitume src/jeu.js:286-291) : destination FERRO justifiée.

**Preuve corrigée.** Bande gauche réellement libre : 66 à 70 % (canvas), 8 à 16 % de commandes, 18 à 22 % de HUD mort.

### TACT-03 — Visée tactile linéaire : demi-tour en 0,70 à 1,68 s, et un deuxième doigt vole la visée
- sévérité haute · catégorie ressenti · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur (dans METAL)
- lieux : src/game.js:820-822; src/game.js:825

**Preuve.** Code : src/game.js:822, 0,004 rad par pixel sans accélération. src/game.js:820 : tout pointerdown tactile à droite de 36 % remplace dragLook.
Mesures (touch.mjs) :
- M2 : un demi-tour demande 785 px, soit 3,7 courses de 210 px. Durée : 1683 ms à 600 px/s, 1033 ms à 1200 px/s, 700 ms à 2400 px/s.
- M6 : après 30 px de glisser (6,88°), un deuxième doigt posé sur le canvas prend la visée ; les 120 px suivants du premier doigt sont ignorés, y compris après le lever du deuxième (6,88° au lieu de 34,38°).
Prototype : 1600, 467 et 233 ms ; la visée reste au premier doigt.

**Cause.** Le gain est constant, donc un réglage assez fin pour viser impose plusieurs reprises du pouce pour se retourner. L'état dragLook ne distingue pas les pointeurs.

**Proposition.** FERRO : fonction de visée tactile commune à la zone de visée et aux boutons-visée (TACT-01).
- Vitesse v du pouce en px/s, lissée sur deux échantillons (moyenne exponentielle 0,5), intervalle borné entre 4 et 50 ms.
- Gain = 1 + 2,2 × smoothstep((v − 400)/(2200 − 400)). Sous 400 px/s le gain vaut exactement 1 : la précision actuelle est conservée.
- Lacet : dx × 0,004 × sensibilité × gain. Tangage : même formule, avec un facteur réglable (1 par défaut, 0,75 conseillé en portrait).
- Option « accélération de visée » de 0 à 100 % qui pondère le 2,2 ; 0 redonne le comportement actuel.
- Un seul pointeur de visée : ignorer un nouveau pointerdown tant que le premier est posé.

**Gain attendu.** Demi-tour : 1033 → 467 ms à 1200 px/s (−55 %) et 700 → 233 ms à 2400 px/s (−67 %). Quasi inchangé pour un geste lent (1683 → 1600 ms). Fin du vol de visée par un deuxième doigt.

**Risques.** Le ressenti d'une courbe se règle sur appareil : les valeurs 400, 2200 et 2,2 sont un point de départ. Simulation inchangée. L'option à 0 garde le comportement d'origine. Environ 0,4 Ko.

**Vérifier par.** node bench/tact/touch.mjs <racine> : M2 sous 500 ms à 1200 px/s et sous 1700 ms à 600 px/s ; M6 lacet croissant après le deuxième doigt. Essai au pouce par David.

**Contre-vérification.** Code relu : game.js:820 (tout pointerdown tactile à droite de 36 % écrase dragLook), :822 (0,004 rad/px constant), :825 (au lever du 2e doigt dragLook = null). touch.mjs rejoué : 1683 / 1033 / 700 ms, prototype 1600 / 467 / 233 ms. Chrome réel : 100 px = 22,918° (0,004 rad/px exact) ; avec un 2e doigt posé sur le canvas, 60 px du premier doigt sont ignorés (6,88° au lieu de 20,6°, chrome2.mjs). Deux corrections. (1) Le correctif « un seul pointeur de visée » est un bogue à corriger tout de suite (P1) ; la courbe d'accélération est un réglage de ressenti (P2), activable mais à valider au pouce : la sensibilité se règle déjà de 0,25 à 3 (options.js), donc les durées citées valent pour le réglage par défaut. (2) Le prototype calcule la vitesse par événement : dans son propre banc M6, 30 px donnent 22° au lieu de 6,9° parce que deux événements ont le même horodatage (dt borné à 4 ms, gain 3,2). Sur un téléphone lent les pointermove arrivent en rafale : calculer la vitesse par image dans sample() (somme des deltas / dt d'image, dt borné 8 à 50 ms), pas par événement.

**Gain corrigé.** Demi-tour −55 à −67 % pour un geste de 1200 à 2400 px/s avec la courbe à 100 % ; la valeur par défaut de la courbe reste à régler sur appareil.

### TACT-04 — Ordres ponctuels au tactile : 10 à 19 % d'appuis courts perdus à 20–30 images/s, et un tap sur le canvas émet un mousedown qui tirera dès que LOOP-06 sera appliqué
- sévérité moyenne · catégorie bug · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · moteur et jeu
- lieux : src/game.js:816; src/game.js:818-821; src/game.js:830-831; src/game.js:834-837; src/game.js:686

**Preuve.** Mesure (touch.mjs M4, pistolet, 150 appuis) : 0 % perdu à 60 images/s ; 10 % à 30 images/s pour des appuis de 30 ms ; 18,7 % à 20 images/s pour des appuis de 40 ms ; 0 % dès 60 ms d'appui. Prototype avec verrou d'appui : 0 % partout. LOOP-06 est donc moins grave au pouce qu'à la souris, mais réel sur un téléphone lent.
Chrome réel (layout.mjs, vrai toucher de 60 ms dans la zone de visée, 3 formats) : pointerdown(touch), touchstart, pointerup(touch), touchend, mousedown, mouseup, click. L'écouteur src/game.js:816 arme mouseFire sur tout mousedown du canvas, sans filtre. Aujourd'hui sans effet (armé et désarmé dans la même tâche). Avec le verrou proposé par LOOP-06 sur mousedown, chaque tap de visée tirerait.
Code : #interact-button écoute click (src/game.js:837) alors qu'esquive, onde et crosse écoutent pointerdown (src/game.js:834-836). L'interaction part au lever du doigt et s'annule si le doigt glisse.

**Cause.** Le tir est un état tenu échantillonné une fois par image, et les écouteurs souris du canvas reçoivent aussi les événements de compatibilité que le navigateur fabrique après un toucher.

**Proposition.** 1. Verrou d'appui dans les écouteurs tactiles : firePressed=true au pointerdown du bouton de tir, input.fire = tenu || firePressed, verrou consommé après le premier sous-pas (prototype dans bench/tact/mkproto.mjs).
2. Dans le pointerdown du canvas, appeler e.preventDefault() pour pointerType 'touch' (supprime les événements souris de compatibilité). En complément, ignorer tout mousedown du canvas arrivé moins de 800 ms après un pointeur tactile.
3. #interact-button : déclencher au pointerdown comme les autres ordres ; garder click pour le clavier, en ignorant un click qui suit un pointerdown de moins de 500 ms.
4. Placer ces trois règles dans la couche d'entrées de FERRO (TACT-09) pour que BITUME et Point de rupture en profitent.

**Gain attendu.** 0 appui de tir perdu au tactile (10 à 19 % aujourd'hui à 20–30 images/s pour des appuis de 30 à 40 ms). Aucun tir parasite quand LOOP-06 arrive. Interaction avancée de la durée de l'appui (60 à 150 ms, estimé).

**Risques.** preventDefault sur le canvas ne doit pas viser la souris (le verrouillage du pointeur en dépend). Le commentaire src/game.js:814-815 explique pourquoi mousedown et mouseup sont gardés pour le double tir à la souris : ne pas les remplacer, les filtrer. Simulation inchangée.

**Vérifier par.** touch.mjs M4 : 0 % perdu à 20 et 30 images/s. layout.mjs après correctif : la séquence d'un tap sur le canvas ne contient plus mousedown. Nouveau cas de harnais : tap sur le canvas → shots +0 ; tap de 20 ms sur le tir à 20 images/s → shots +1.

**Contre-vérification.** touch.mjs rejoué : 10 % perdus à 30 images/s pour des appuis de 30 ms, 18,7 % à 20 images/s pour 40 ms, 0 % ailleurs ; prototype 0 % partout. Portée réelle faible : la perte n'existe que si l'appui dure moins d'une image (≈ 1 − appui/image) ; un appui de pouce dure plutôt 50 à 150 ms, donc ≈ 0 % dès 30 images/s. La partie utile est la garde pour LOOP-06, vérifiée dans Chrome réel (chrome.mjs) : tap sur le canvas = pointerdown, pointerup, mousedown, mouseup, click ; avec preventDefault au pointerdown tactile, mousedown et mouseup disparaissent, click reste, et la visée au glisser marche toujours (22,918° pour 100 px). Le canvas n'a pas d'écouteur click : sans effet. #interact-button sur click (game.js:837) : confirmé. Le filtre temporel de 800 ms devient inutile si preventDefault est posé ; garder un seul mécanisme.

**Gain corrigé.** 0 tir parasite quand LOOP-06 arrive (prouvé dans Chrome) ; appuis perdus : cas limite (appui < 1 image à 30 images/s ou moins).

### TACT-05 — 7 à 9 cibles tactiles sur 12 sous 48 px (minimum 14 px) et 2 à 4 chevauchements par format ; grille en arc avec saut et frappe validée à 0 et 0
- sévérité haute · catégorie entrées · effort L · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/style.css:62; src/style.css:66; src/style.css:86-90; src/style.css:93-95; src/style.css:10; src/index.html:45; src/game.js:834-837

**Preuve.** Chrome sur dist/index.html?touch=1 (layout.mjs, captures out/shot-*.png) :
- 390×844 : 7 cibles sur 12 sous 48 px. Changement d'arme 114×14, choix main gauche 170×25, crosse 62×30, carte et pause 36×36, esquive et onde 40×40. Chevauchements : manche et panneau de vie 2754 px², tir et panneau d'arme 400 px², garde et panneau d'arme 47 px², bouton d'interaction et viseur 448 px².
- 844×390 : 9 sous 48 px (garde 44, esquive et onde 39, crosse 57×28, interaction 128×40). La crosse passe sur le bandeau #encounter (975 px²).
- 360×640 : 9 sous 48 px ; 3,8 px entre le tir et le changement d'arme ; la crosse change de côté (src/style.css:95, left:18px).
Règles en cause : src/style.css:62, :66, :86-90 et :93-95, .icon-button à 36 px (src/style.css:1), #weapon-switch (src/style.css:10).
Avec la disposition proposée injectée (proposal.css, bouton SAUT ajouté, crosse renommée FRAPPE) : 11 cibles, minimum 48 px, 0 chevauchement, 8,0 px d'écart minimal entre boutons ronds, aux 3 formats.

**Cause.** Les commandes tactiles ont été posées une à une au-dessus d'un HUD de bureau conservé tel quel, avec une règle en pixels fixes par format. Ajouter saut et frappe dans cette grappe n'a plus de place.

**Proposition.** Grille en arc autour du tir, entièrement en variables CSS (valeurs vérifiées dans bench/tact/proposal.css) :
- u = clamp(48px, 14.4vmin, 58px) pour les boutons secondaires ; tir f = 1,5 u (84 px en 390, 78 px en 360) ; écart g = 8 px.
- Anneaux : r1 = f/2 + u/2 + g, r2 = r1 + u + g.
- Centre du tir : à droite max(16px, zone sûre) + f/2 + 10px ; en bas max(8px, zone sûre) + 8px + f/2 en paysage, avec 68 px de plus en portrait pour la rangée de pastilles.
- Angles depuis l'horizontale gauche : GARDE / TIR G sur r1 à 0°, SAUT sur r1 à 50°, ESQUIVE sur r1 à 100°, FRAPPE (crosse ou coup de bouclier, FEEL-01) sur r2 à 12°, ONDE sur r2 à 58°.
- Socle du manche : 112 px, aligné sur le bas du tir.
- HUD tactile : arsenal en tiroir ouvert par la pastille d'arme ; vie et arme en pastilles de 56 px centrées en bas ; carte et pause en 48×48 ; bouton d'interaction à 48 px de haut, à gauche sous le viseur en portrait, centré au-dessus des pastilles en paysage.
- Libellés des boutons en 10 px au moins.

**Gain attendu.** Cibles sous 48 px : de 7–9 à 0. Chevauchements : de 2–4 à 0. Le saut et la frappe ont leur bouton. Même position relative des boutons dans les 3 formats (aujourd'hui la crosse change de côté en 360×640).

**Risques.** C'est une refonte du HUD tactile : le prototype prouve la géométrie, pas le dessin final. L'arsenal en tiroir demande un petit écran de choix (main gauche comprise). AGENTS.md : accessibilité des relais, de la sortie et des objets à revérifier, libellés à jour. Tests de build et captures de référence à refaire. Le bureau n'est pas touché (règles sous body.touch). Environ 1,5 Ko de CSS, compensé par la suppression des règles par format.

**Vérifier par.** node bench/tact/layout.mjs <racine> puis python3 bench/tact/summary.py : aux 3 formats, 0 cible sous 48 px, 0 chevauchement, écart entre boutons ronds d'au moins 8 px. À intégrer comme test de mise en page.

**Contre-vérification.** État actuel confirmé par trois voies : règles CSS relues (style.css:66, :70, :86-90, :93-95 : esquive et onde 40 px, crosse 62×30, garde 49 puis 44, select de main gauche 25 px, .icon-button 36 px), captures out/shot-*.png regardées, et mes propres rectangles dans Chrome (tir 77×77 centré en 329,5/555,5 ; manche 102×102 centré en 74/544). Avec le seuil Apple/WCAG de 44 px au lieu de 48 : 7, 8 et 8 cibles trop petites, le constat tient. Nuances : #weapon-switch (114×14) double les emplacements d'arsenal de 60 px de haut, donc le « minimum 14 px » n'est pas bloquant ; la grille proposée est prouvée en géométrie seulement (layout-prop.json : 0 sous 48 px, 0 chevauchement), pas en ergonomie. Réserves sur la proposition : (1) le bouton SAUT suppose FEEL-09 (METAL 0.8 n'a pas de saut : input sans champ jump, game.js:18) ; (2) la capture proposée masque la jauge d'énergie du bouclier (GARDE 100 %), information de combat liée à la plainte de David sur le bouclier : la garder, par exemple en anneau autour de GARDE ; (3) tir à 71 px du bas en paysage (bord à 32 px, indicateur d'accueil à 21 px) : position à régler sur appareil, les jeux mobiles placent le tir vers 30 % de la hauteur.

**Preuve corrigée.** Sous 44 px : 7 (390×844), 8 (844×390), 8 (360×640).

### TACT-06 — Zones sûres perdues en paysage et commandes hors de portée : le tir est à 34–41 % de la hauteur de l'écran
- sévérité moyenne · catégorie bug · effort M · gain mesuré
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · jeu
- lieux : src/style.css:66; src/style.css:70; src/style.css:87; src/style.css:3; src/index.html:5

**Preuve.** Chrome avec Emulation.setSafeAreaInsetsOverride (paysage : 47 px à gauche et à droite, 21 px en bas) : manche à 23 px du bord gauche, tir à 27 px du bord droit, pause à 18 px, changement d'arme à 34 px, choix main gauche à 16 px du bas. Ces cibles passent sous l'encoche ou l'indicateur d'accueil.
Cause dans le CSS : les règles de base utilisent env(safe-area-inset-*) (#move-zone, #fire-button, .hud-bottom, .hud-top), mais des règles en pixels fixes les écrasent : body.touch #move-zone{left:23px} et body.touch #fire-button{right:22px} (src/style.css:66), .hud-bottom{left:20px;right:20px;bottom:11px} (src/style.css:70), .hud-top{left:18px;right:18px} et .hud-top{top:15px} (src/style.css:3).
En portrait avec 47 px d'encoche en haut, .hud-top descend mais .score-status reste à top:70px (src/style.css:87) : le score recouvre le titre du secteur (capture out/shot-390x844.png).
Portée : le bas de l'écran porte 276 px de panneaux en portrait (33 % de la hauteur). Le centre du tir est à 288 px du bas (34 %), 158 px en paysage (41 %), 224 px en 360×640 (35 %).

**Cause.** Chaque format a reçu ses positions en dur après coup, ce qui a effacé les env() d'origine. Les panneaux de vie, d'arme et d'arsenal occupent la zone naturelle des pouces.

**Proposition.** 1. Toute position de bord en tactile passe par max(valeur, env(safe-area-inset-*)) ; variables --sl, --sr, --sb, --st déclarées une fois sur body.touch.
2. Décaler .score-status, .objective, #radar-wrap et #toast de la même zone sûre haute que .hud-top.
3. Réserver le bas de l'écran aux pouces (pastilles de 56 px, TACT-05) : le centre du tir descend à 144 px du bas en portrait, 71 px en paysage, 115 px en 360×640.
Valeurs vérifiées dans bench/tact/proposal.css.

**Gain attendu.** 0 cible hors zone sûre (5 aujourd'hui en paysage). Tir et manche à 17–18 % de la hauteur au lieu de 34–41 %. Fin du recouvrement du titre par le score sur les téléphones à encoche.

**Risques.** L'émulation des zones sûres de Chrome n'est pas un iPhone : à confirmer sur appareil. Les règles de bureau ne changent pas. À livrer avec TACT-05, sinon les commandes descendent sur les panneaux actuels.

**Vérifier par.** node bench/tact/layout.mjs <racine> : liste « hors zone sûre » vide aux formats 390×844 (47/34) et 844×390 (47/47/21) ; centre du tir sous 20 % de la hauteur. Ajouter un contrôle de recouvrement HUD contre HUD dans measure.js.

**Contre-vérification.** Cause CSS confirmée : les env(safe-area-inset-*) de base (#move-zone, #fire-button, .hud-bottom) sont écrasés par des pixels fixes (style.css:66 left:23px / right:22px ; :70 .hud-bottom left/right 20px, bottom 11px, #fire-button right:27px). Le cas paysage (47 px de chaque côté, 21 px en bas) est le cas réel dans Safari. Deux affirmations surestimées. (1) Le recouvrement du score et du titre en portrait suppose 47 px de zone sûre en haut : dans Safari cette valeur est 0 (la barre du navigateur couvre l'encoche) ; elle n'existe qu'en mode application plein écran, que METAL ne déclare pas (aucun manifest ni apple-mobile-web-app dans index.html). Défaut réel mais rare. (2) « Hors de portée à 34–41 % » n'est pas mesuré : c'est la zone de repos habituelle des pouces ; descendre à 17 % rapproche le tir de l'indicateur d'accueil. Le gain prouvé est « 0 cible hors zone sûre », pas la portée.

**Gain corrigé.** 5 cibles hors zone sûre → 0 en paysage (mesuré par émulation). Portée : qualitatif, à régler sur appareil.

### TACT-07 — Lisibilité mobile : la moitié des textes du HUD fait moins de 8 px (minimum 4,5 px), et l'invite de départ dit « clic droit » sur téléphone
- sévérité moyenne · catégorie ressenti · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/style.css:87-90; src/style.css:66; src/game.js:163; src/game.js:613

**Preuve.** Mesure (measure.js, font-size calculée des textes visibles du HUD en jeu) :
- 390×844 : 44 textes, 22 sous 8 px (50 %), 30 sous 10 px (68 %), minimum 5 px (.slot-name, #left-hand-status, #ammo-unit).
- 844×390 : 47 textes, 20 sous 8 px, 29 sous 10 px.
- 360×640 : 43 textes, 22 sous 8 px, 29 sous 10 px, minimum 4,5 px (.slot-name, src/style.css:88).
Les tailles viennent des règles tactiles de src/style.css:87-90 (4.5px, 5px, 6px) et des libellés de base à 6–7 px.
Menu : OPTIONS mesure 46,5×37,6 px avec un texte de 8 px.
Invite : au lancement en tactile, le bandeau affiche « Pistolet + bouclier · clic droit : garde… » (src/game.js:163, visible sur out/shot-390x844.png). FEEL-11 traite les invites en général ; ce cas est propre au tactile.
Avec le HUD compact du prototype (TACT-05), il reste 24 textes dont 7 à 8 sous 8 px : une passe dédiée reste nécessaire.

**Cause.** Le HUD de bureau a été réduit par mise à l'échelle des polices jusqu'à tenir, au lieu de retirer des informations sur petit écran.

**Proposition.** En tactile :
- Plancher de 10 px pour tout libellé et de 12 px pour les valeurs (vie, munitions, compteurs).
- Retirer les libellés décoratifs redondants avec une icône ou une valeur : .slot-name, .equipped-label, #heat-status, #left-hand-status, #ammo-unit.
- Boutons du menu d'accueil à 48 px de haut, texte de 12 px.
- Invite de départ produite par la fonction d'invites de FEEL-11 : « Pistolet + bouclier · GARDE : maintenir ».

**Gain attendu.** 0 texte sous 10 px en jeu (29 à 30 aujourd'hui). Invite de départ juste sur téléphone.

**Risques.** Moins d'informations affichées en tactile : garder celles qui servent en combat (vie, armure, munitions, chaleur, objectif). AGENTS.md impose la lisibilité mobile, donc le changement va dans son sens. Le bureau n'est pas touché.

**Vérifier par.** node bench/tact/layout.mjs <racine> puis python3 bench/tact/show.py out/layout.json : histogramme sans classe « <6 », « 6-8 » ni « 8-10 » aux 3 formats.

**Contre-vérification.** Tailles relues dans le CSS : .slot-name 4.5px (:88), 5px (:87, :90), #left-hand-status 5px, labels 4.5 à 6px, .ammo-readout small 5px (:70). L'invite « clic droit : garde » est bien émise sans test tactile (game.js:163) alors que :223, :226 et :613 ont leur variante tactile ; elle est visible sur la capture 390×844. AGENTS.md exige la lisibilité mobile : des textes de 4,5 à 6 px la violent, d'où P1. Le correctif de l'invite est trivial (effort S) et peut partir seul ; la passe de tailles se fait avec TACT-05. Attention : ne pas retirer la jauge du bouclier ni l'état de chaleur utile en combat.

### TACT-08 — Détection tactile figée au démarrage : sur un PC à écran tactile, la souris ne vise plus
- sévérité haute · catégorie bug · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur et jeu
- lieux : src/game.js:5; src/game.js:18; src/game.js:157-158; src/game.js:813; src/options.js:6

**Preuve.** Code : src/game.js:5, touch est vrai dès que navigator.maxTouchPoints > 1, même avec une souris. Conséquences : lock() sort tout de suite (src/game.js:157-158), le mousemove n'agit que verrouillé (src/game.js:813), input.assist vaut touch (src/game.js:18), le FOV par défaut passe à 79 (src/options.js:6) et l'aide devient tactile (src/game.js:841).
Mesure (pctouch.mjs, harnais LOOP, 1920×1080, sans ?touch=1) :
- maxTouchPoints = 0 : 1 appel à requestPointerLock, lacet de 0,44 rad après 200 comptes de souris, assist faux, FOV 74.
- maxTouchPoints = 10 : classe touch active, 0 appel à requestPointerLock, lacet 0, assist vrai, FOV 79.
Il ne reste alors que le glisser, qui tire en même temps (LOOP-10).
Comparaison : BITUME teste (pointer: coarse) ou (maxTouchPoints > 0 et hover: none) (bitume src/jeu.js:283) ; Point de rupture teste seulement (pointer: coarse) (src/interface/reglages.js:269-271).

**Cause.** Le mode d'entrée est une constante calculée au chargement à partir des capacités de la machine, pas de l'appareil réellement utilisé.

**Proposition.** FERRO (couche d'entrées, TACT-09) : appareil actif = dernier appareil utilisé.
- 'touch' sur un pointerdown de pointerType 'touch'.
- 'mouse' sur un mousedown ou un mousemove, sauf dans les 800 ms qui suivent un toucher (événements de compatibilité, TACT-04).
- 'keyboard' sur keydown, 'gamepad' sur un bouton ou un axe au-delà de 0,3.
- Exposer l'appareil (rappel et body.dataset.input) ; première estimation au chargement avec la règle de BITUME.
METAL :
- lock() demande le verrouillage sur tout clic souris, quelle que soit la capacité tactile.
- Les commandes tactiles s'affichent quand l'appareil actif est 'touch' et se masquent sinon.
- assist devient un réglage (TACT-09) ; le FOV par défaut n'est choisi qu'à la première exécution.

**Gain attendu.** La souris redevient utilisable sur les PC à écran tactile : lacet de 0 → 0,44 rad pour 200 comptes dans le banc. Bascule à chaud entre souris, tactile et manette.

**Risques.** Changer l'affichage en cours de partie ne doit pas décaler le HUD pendant un combat : basculer au premier événement puis garder l'état jusqu'au suivant. ?touch=1 doit rester un forçage pour les bancs. Simulation et sauvegardes non concernées.

**Vérifier par.** node bench/tact/pctouch.mjs <racine> : avec maxTouchPoints = 10, au moins 1 appel à requestPointerLock et lacet de 0,44 rad ; classe touch absente tant qu'aucun pointeur tactile n'est venu.

**Contre-vérification.** Code relu : game.js:5 (maxTouchPoints > 1 suffit), :158 (lock() sort), :813 (mousemove seulement verrouillé), :18 (assist), options.js:6 (FOV 79). pctouch.mjs rejoué : maxTouchPoints 0 → 1 appel à requestPointerLock, lacet 0,44 rad ; maxTouchPoints 10 → classe touch, 0 appel, lacet 0, assist vrai, FOV 79. Citations BITUME (src/jeu.js:283) et Point de rupture (reglages.js:269-271) exactes. Conseil d'ordre : livrer d'abord le correctif minimal (effort S) — règle de BITUME pour la première estimation, et lock() autorisé sur tout mousedown de pointerType souris — puis la bascule à chaud (effort M) avec la couche d'entrées. La souris reste aujourd'hui utilisable en glisser (qui tire en même temps) et les flèches tournent : gênant, pas bloquant.

### TACT-09 — Couche d'entrées commune : même structure sur les trois appareils et hash égal à flux égal, mais assist dépend de l'appareil et le pas variable empêche de rejouer une session
- sévérité haute · catégorie architecture · effort L · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur (dans METAL)
- lieux : src/game.js:18; src/game.js:677; src/game.js:683-692; src/game.js:805-837; src/simulation.js:848; src/simulation.js:1917; bitume src/jeu.js:219-303; point-de-rupture src/camera.js:248-300

**Preuve.** Mesure (equiv.mjs, vrai game.js, même intention : avancer 3,2 s, tirer 1 s) :
- Structure identique au clavier et au tactile : 13 champs, mêmes types (src/game.js:18).
- 211 pas de chaque côté ; seul assist diffère, sur 211 pas (src/game.js:18, assist:touch).
- Hash clavier a32ee1ef, tactile 0482b44e. Le flux tactile rejoué avec les dt du clavier donne a32ee1ef : l'écart ne venait que du pas de temps (écart maximal 9,1e-16 s, src/game.js:677 et :690).
- Le même scénario clavier a donné bf78531e dans un autre processus : l'heure de départ change l'arrondi de now − last.
- Rejeu de chaque flux (dt et entrées) dans une simulation neuve : hash égal.
- Manette (prototype bench/feel/gamepad-map.mjs) contre clavier avec Maj : 0 champ différent, hash égal (a1ca8e16).
Autres écarts : la course n'est jamais vraie au tactile (TACT-02) ; assist ajoute jusqu'à 0,38 m de rayon à l'arme 0 et 0,16 m aux autres (src/simulation.js:848).
Récolte possible : BITUME fusionne déjà clavier, manette et tactile par plus forte amplitude (bitume src/jeu.js:263-277), lit la manette avec zone morte 0,12 et courbe 1,6 (src/jeu.js:219-245) et navigue les menus à la croix (src/jeu.js:247-261) ; Point de rupture distingue pointerType 'touch' dans src/camera.js:248-300.

**Cause.** Chaque jeu fusionne ses appareils à la main dans sa boucle. Dans METAL, le pas de simulation dérive de l'horloge d'image, donc deux sessions aux entrées identiques ne produisent pas le même état.

**Proposition.** FERRO : nouveau module src/input.js, additif (aucun export existant ne change).
- Le jeu déclare ses actions : axes (move, look), boutons tenus (fire, fireLeft, sprint), impulsions (dash, jump, bash, pulse, melee, interact).
- Sources : clavier (liaisons de FOptions), souris, widgets tactiles (manche flottant, zone de visée, bouton, bouton-visée : TACT-01 à 03), manette (zone morte radiale 0,12 à 0,97, courbe 1,7, hystérésis des gâchettes : prototype FEEL-10).
- Fusion : déplacement = source de plus forte amplitude ; visée = somme des deltas ; tenus = OU ; impulsions verrouillées et effacées après le premier pas (LOOP-06).
- sample() rend la structure du jeu plus l'appareil actif (TACT-08). Le cœur de fusion est une fonction pure, testable sous Node sans DOM.
- Enregistreur et lecteur de flux, un enregistrement par pas, pour les tests et pour la démo.
METAL :
- Pas fixe de 1/60 s avec accumulateur (LOOP-05) : le flux n'a plus besoin de dt.
- assist devient un réglage « aide à la visée » (auto : actif au tactile et à la manette), écrit dans l'en-tête du flux, avec un bonus par arme au lieu du 0,38 m réservé à l'arme 0.
- La démo (« démo qui dure ») écrit la même structure, par pilote ou par flux ; au tactile le premier toucher la quitte sans valider le bouton dessous, comme dans BITUME (src/jeu.js:207-214).

**Gain attendu.** Une seule couche d'entrées pour trois jeux. Sessions rejouables : même script, même hash d'un processus à l'autre et d'un appareil à l'autre (aujourd'hui bf78531e contre a32ee1ef pour le même script). Base commune pour la manette (FEEL-10), le tactile et la démo.

**Risques.** FERRO 248043a n'a pas pu être lu (dossier absent de cette machine) : vérifier que rien n'y porte déjà ce nom. Un jeu de la v0.2 qui n'utilise pas input.js ne change pas. La qualité « identique » est à prouver : pour le clavier et la souris, la structure produite doit être égale champ par champ à celle d'aujourd'hui. Le pas fixe modifie les états par rapport à la version actuelle : tests de simulation à pas imposé non touchés, tests de boucle à revoir. Format des sauvegardes non concerné. 5 à 7 Ko.

**Vérifier par.** node bench/tact/equiv.mjs <racine> : clavier, tactile et manette donnent le même hash sans réalignement des dt, et deux exécutions du script donnent le même hash. Test Node de la fonction de fusion (amplitude, somme, verrou). Rejeu d'un flux de 10 minutes : hash final égal à celui de la session.

**Contre-vérification.** Mesures confirmées : equiv.mjs rejoué deux fois (structure identique, seul assist diffère sur 211 pas, manette = clavier+Maj, rejeu d'un flux = hash de session). Preuve indépendante de la cause (bench/tact-verif/dtq.mjs, 3 processus) : hash de session d08bb6e4, 974ad87a, 4b8cd454 ; heure de départ 3583, 1850, 2283 ms (le chargement prend un nombre d'images qui dépend de l'horloge réelle) ; avec dt arrondi à 1e-7 ou fixé, les trois processus donnent 5536fa5e. Deux corrections importantes. (1) Le pas fixe n'est PAS un préalable : le flux (dt, entrées) se rejoue déjà à l'identique ; il suffit d'enregistrer dt par pas (8 octets). LOOP-05 déconseille le 60 Hz fixe (retard de 16,7 ms avec interpolation, saccade sans interpolation sur écrans 120/144 Hz) : l'imposer irait contre « images plus stables ». Garder le pas variable borné de LOOP-05 en jeu ; pas fixe seulement pour une session enregistrée ou rejouée. (2) La « démo qui dure » n'a pas besoin de rejeu : BITUME (commandesIA, src/jeu.js:328) et Point de rupture (trois IA, interface/titre.js:12) font jouer un pilote ; METAL a des pilotes de combat dans bench/boss et bench/feel. La démo doit donc être une source « pilote » de la couche d'entrées. « Identique » ne vaut que sans le pas fixe et si clavier et souris produisent la même structure champ par champ. FERRO 248043a reste illisible ici (dossier absent) ; la mission dit que v0.2 n'a pas d'input.js.

**Gain corrigé.** Une couche d'entrées pour trois jeux ; rejeu bit à bit en enregistrant dt par pas (prouvé : même hash dans 3 processus dès que dt est figé), sans passer au pas fixe.

### TACT-10 — Formats téléphone : même image interne à DPR 2 et 3, et un gouverneur de résolution qui n'agit que sur 24 à 33 % du GPU
- sévérité moyenne · catégorie perf-gpu · effort S · gain mesuré
- contre-vérification : **plausible**, priorité P3 · qualité visuellement identique · moteur (dans METAL)
- lieux : src/renderer.js:1386; src/renderer.js:1389; src/renderer.js:746-764; src/renderer.js:1384-1393

**Preuve.** Code : src/renderer.js:1386 plafonne le ratio auto à min(DPR, 1,5) ; :1389 applique le budget de 1,8 MPix ; :746-764 fixe les seuils du gouverneur (25 ms et 18,5 ms, plancher 0,65).
Mesures appariées sur Apple M5, 390×844 :
- Auto : 585×1266 (0,74 MPix) à DPR 2 comme à DPR 3. Sur un écran DPR 3, la 3D est donc rendue à la moitié de la définition linéaire. GPU 3,0 à 3,9 ms, CPU de rendu 1,1 à 2,2 ms.
- Paliers : ×0,9 −0,40 ms (−10 %), ×0,8 −0,70 (−18 %), ×0,7 −1,10 (−28 %), plancher ×0,65 (380×823) −1,30 ms [−1,30 ; −1,20] (−33 %). Autres séries : −0,90 ms (−24 à −30 %). Paysage : −1,30 ms (−29 %).
- Modèle : 1,3 à 2,1 ms fixes + 2,2 à 3,3 ms par MPix. La part fixe vaut 43 à 56 % du GPU à cette définition (ombres, géométrie, passes à taille constante).
- Dans la même page (base 4,30 ms) : spec4 de RGPU-01 −0,40 ms GPU, MAD 0,036, 0 pixel au-delà de 10 niveaux ; suncache de RGPU-03 −0,10 GPU et −0,40 CPU, image identique ; combo7 −1,30 ms (−30 %) ; plancher du gouverneur −0,90 ms (−21 %) pour 58 % de pixels en moins.
- notorch (RGPU-04) : −0,30 ms, mais 0,10 % des pixels changent de plus de 10 niveaux à ce format (0,73 % au pire).

**Cause.** Sur un petit écran, le coût par pixel n'est plus dominant : baisser la définition retire peu de temps et beaucoup de netteté.

**Proposition.** 1. Ordre d'implémentation dans FERRO : livrer d'abord les leviers dont l'image est prouvée inchangée (RGPU-01, RGPU-03, puis RCPU-01 corrigé par TACT-11), avant de retoucher le gouverneur. Ensemble ils rendent environ 1 ms sur 4,3 (estimation par addition de spec4 et suncache), plus que toute la plage du gouverneur.
2. RGPU-04 (torche) : revalider l'écart d'image au format téléphone avant de l'activer.
3. Gouverneur (RCPU-08, RGPU-09) : garder le plancher à 0,65 ; aucune autre dégradation automatique. Afficher dans le compteur l'échelle et la définition interne.
4. Option désactivée par défaut « netteté maximale » : plafond auto à min(DPR, 2) sous le même budget de 1,8 MPix, pour les téléphones qui ont de la marge (+1,75 ms sur M5).

**Gain attendu.** Environ −1 ms sur 4,3 ms de rendu au format téléphone sans changer l'image (estimé à partir de deux mesures appariées), contre −0,9 ms pour le plancher du gouverneur. Moins de descentes de définition sur téléphone.

**Risques.** Mesures sur M5 seulement : sur un GPU de téléphone, la part fixe et le coût par pixel diffèrent, donc l'ordre de grandeur est à confirmer sur appareil. Les écarts appariés résistent à la charge de la machine, pas les temps absolus. Rendu seul : ni déterminisme ni sauvegardes.

**Vérifier par.** cd bench/tact/gpu && ./run.sh neutral.html 390,844 > ../out/gpu-neutral.json && python3 paired2.py ../out/gpu-neutral.json base : écart de la variante livrée contre base, avec MAD et part de pixels au-delà de 10 niveaux. Refaire sur un téléphone réel avec le compteur étendu.

**Contre-vérification.** Code confirmé : renderer.js:1386 (auto = min(DPR, 1,5)), :1389 (budget 1,8 MPix : en 390×844 le plafond vaut 2,34, donc 585×1266 à DPR 2 comme à DPR 3), :746-764 (seuils 25 / 18,5 ms, plancher 0,65). paired2.py relancé sur ses sorties : chiffres exacts (g65 −1,30 ms [−1,30 ; −1,20] en portrait, −0,90 en série neutral, spec4 −0,40, suncache −0,10 GPU / −0,40 CPU, combo7 −1,30). Limites : c'est une note d'ordonnancement plus qu'un changement ; le « −1 ms sans changer l'image » est une somme de deux leviers d'autres axes (estimé, pas mesuré ensemble). L'autorité de 24 à 33 % vient d'un Apple M5 où la part fixe domine ; sur un GPU de téléphone le coût par pixel pèse bien plus, donc la conclusion ne se transpose pas. L'option « netteté maximale » existe presque déjà : la qualité haute fait min(DPR, 2) (:1386), soit le même 780×1688 à ce format.

**Gain corrigé.** Aucun gain propre : priorise RGPU-01 et RGPU-03 (≈ −1 ms sur 4,3, estimé par addition, M5 seulement).

### TACT-11 — RCPU-01 en portrait : le cône de sélection gonfle les statiques visibles de 129 % et les instances de 32 %
- sévérité moyenne · catégorie perf-gpu · effort S · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité identique · moteur (dans METAL)
- lieux : src/renderer.js:1545-1547; src/renderer.js:1503; bench/rcpu/proto.mjs

**Preuve.** RCPU-01 annonçait +28 à 31 % de statiques visibles et +15 à 21 % d'instances, mesurés en 1440×932. Variante cache de bench/rcpu/proto.mjs aux formats téléphone (pages appariées) :
- 390×844, FOV 74 : statiques visibles 573 → 1314 (+129 %), instances 4182 → 5509 (+32 %), triangles 144 904 → 175 772 (+21 %).
- 390×844, FOV 79 : 494 → 1139 (+131 %). FOV 103 : 681 → 1269 (+86 %).
- 844×390 : 1315 → 1603 (+22 %), instances +27 %.
- GPU sur M5 : +0,00 ms [−0,10 ; +0,10] en portrait, +0,00 [0,00 ; +0,10] en paysage. CPU de rendu : 1,40 → 0,50 ms. Image : MAD 0,0007.
Explication : la sélection garde ce qui tombe dans un cône de demi-angle « demi-diagonale + 8° ». En portrait la demi-diagonale (42,3°) est fixée par la hauteur, alors que le demi-champ horizontal n'est que de 20,9°. Le monde s'étalant à l'horizontale, le surcoût suit le rapport des angles horizontaux : 50,3/20,9 = 2,4 en portrait (mesuré 2,3), 71/60,7 = 1,17 en paysage (mesuré 1,22).

**Cause.** Un cône circulaire est un mauvais majorant d'un frustum étroit et haut.

**Proposition.** Dans le cache de RCPU-01, remplacer le test de cône par les 4 plans latéraux du frustum de référence, chacun tourné de θ = 8° vers l'extérieur et repoussé de D = 1 m plus le rayon de l'objet ; garder la sphère proche (distance ≤ rayon + D + plan proche). Les conditions de validité (déplacement ≤ D, rotation ≤ θ, portées, révision) ne changent pas.

**Gain attendu.** Statiques visibles en portrait : de +129 % à environ +38 % (rapport des demi-angles horizontaux 28,9/20,9) ; en paysage de +22 % à environ +13 %. Gain CPU de RCPU-01 conservé (−0,9 ms sur M5). Sur M5 le GPU ne bouge pas ; l'intérêt est pour les GPU de téléphone, où 21 % de triangles en plus ont un coût non mesuré ici.

**Risques.** L'image reste identique tant que la sélection est un sur-ensemble du frustum exact : le contrôle « aucun absent » de bench/rcpu/ab.mjs doit passer avec les plans. Le taux de reconstruction ne doit pas monter. Mêmes réserves de tests que RCPU-01 (stats.staticVisible). Rendu seul.

**Vérifier par.** Adapter proto.mjs puis cd bench/tact/gpu && ./run.sh p3.html 390,844 et python3 paired2.py : statiques visibles ≤ 830 au lieu de 1314, MAD ≤ 0,001, CPU de rendu ≤ 0,55 ms. Contrôle de sur-ensemble : node bench/rcpu/ab.mjs.

**Contre-vérification.** Prémisse confirmée : bench/rcpu/proto.mjs:146-155 sélectionne par cône (demi-angle + TURN, sphère gonflée de MARGIN) ; comptes de ses sorties : 4182 → 5509 instances en portrait, GPU +0,00 ms [−0,10 ; +0,10]. Défaut géométrique dans la proposition : des plans latéraux tournés de θ ne majorent pas le frustum pour toute rotation ≤ θ. La marge angulaire d'un rayon de coin vaut asin(sin θ · cos φ), φ étant son élévation dans le plan : en portrait (FOV 79) φ ≈ 37,6°, donc 6,3° de marge pour 8° tolérés. De plus coneValid ne compare que les vecteurs « avant » : le roulis de caméra (view.roll, game.js:720) est invisible pour lui, sans effet sur un cône mais pas sur des plans. Avec « conditions de validité inchangées », des objets peuvent manquer dans les coins : l'image n'est plus garantie identique. Correctif : valider le cache en testant les 4 rayons de coin du frustum courant contre les 4 plans élargis (16 produits scalaires), ou ramener la tolérance à 6°. Gain prédit (+38 % au lieu de +129 %) non mesuré, et le surcoût GPU actuel est nul sur M5 : à faire seulement avec RCPU-01.

**Gain corrigé.** Statiques visibles en portrait : estimation non mesurée ; GPU inchangé sur M5.

### TACT-12 — Portrait : 41,7° de champ horizontal avec le FOV vertical de 79° ; l'élargir à 60° ne coûte que 3,6 % de triangles
- sévérité moyenne · catégorie 3d-visuel · effort S · gain mesuré
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · moteur et jeu
- lieux : src/renderer.js:1541; src/renderer.js:1503; src/options.js:6; src/game.js:720

**Preuve.** Code : le FOV est vertical (src/renderer.js:1541, f = 1/tan(fov/2) ; :1503, demi-largeur = aspect × tangente). Le tactile part à 79° (src/options.js:6) et la caméra reçoit prefs.fov (src/game.js:720).
Calcul : en 390×844 (aspect 0,462), 2·atan(0,462 × tan 39,5°) = 41,7° horizontaux. En 844×390 : 121,4°. Le même joueur voit 2,9 fois moins large en portrait, ce qui aggrave le demi-tour de TACT-03.
Mesure (pages gpu/fov79.html et fov103.html, 2 séries alternées) : passer à 103° vertical, soit 60° horizontaux, fait passer les statiques visibles de 494 à 681, les instances de 4125 à 4276 (+3,7 %) et les triangles de 137 604 à 142 512 (+3,6 %). GPU 3,3 à 3,6 ms contre 3,5 à 3,6 ms : dans le bruit (séries non appariées).

**Cause.** Le réglage de FOV est vertical et unique : il convient à un écran large, pas à un écran tenu debout.

**Proposition.** FERRO : fonction utilitaire fovPour(aspect, fovVertical, minHorizontal = 60°). Si 2·atan(aspect × tan(fov/2)) est inférieur au minimum, rendre min(104°, 2·atan(tan(30°)/aspect)) ; sinon rendre le FOV demandé.
METAL : l'appliquer à la caméra du monde (src/game.js:720). L'arme en vue subjective garde son FOV actuel pour ne pas être étirée. Le curseur de FOV garde son sens en paysage.

**Gain attendu.** Champ horizontal en portrait : 41,7° → 60° (+44 %). Coût : +3,6 % de triangles, écart GPU non mesurable sur M5. Aucun changement en paysage.

**Risques.** À 103° vertical, le haut et le bas de l'image s'étirent : à juger à l'œil sur téléphone, le minimum de 60° est réglable. La passe de l'arme doit accepter un FOV distinct ; vérifier que le filtre d'acteurs et le culling lisent le même FOV que la projection. L'image change en portrait par choix ; elle est identique en paysage.

**Vérifier par.** Captures à 390×844 avant et après (bench/tact/layout.mjs) ; page gpu/fov103.html pour les comptes. Test unitaire de fovPour : 0,462 → 102,7°, 1,78 → inchangé.

**Contre-vérification.** Calcul vérifié : 2·atan(0,462 × tan 39,5°) = 41,7° ; 60° horizontaux demandent 102,7° vertical, sous le plafond de 110 (renderer.js:1541). Les comptes (+3,6 % de triangles) viennent de séries non appariées : temps GPU indicatifs. Points sous-estimés : (1) le renderer n'a qu'une projection (:1541) et le rendu Canvas 2D lit aussi camera.fov (:1012) ; garder l'arme non étirée impose une seconde projection ou une compensation du modèle, donc effort M et non S ; (2) à 103° vertical la déformation en haut et en bas est forte : commencer par un minimum horizontal de 50 à 55° ; (3) le joueur peut déjà monter le FOV à 110 dans les options (options.js:11) ; (4) le coup de FOV de FMotion (view.fov) s'ajoute et bute sur 110. Alternative complémentaire : proposer le paysage (TACT-V1).

**Gain corrigé.** Champ horizontal en portrait 41,7° → 50 à 60° selon le minimum retenu ; coût géométrique ≈ +4 %.

### TACT-13 — Gyroscope en option, désactivée par défaut, pour la visée fine
- sévérité basse · catégorie entrées · effort M · gain qualitatif
- contre-vérification : **plausible**, priorité P3 · qualité meilleure · moteur (dans METAL)
- lieux : src/game.js:822; src/options.js:6

**Preuve.** Aucune lecture de DeviceMotionEvent ni de DeviceOrientationEvent dans src/*.js de METAL, ni dans bitume/src/jeu.js. La visée au pouce reste grossière : 0,004 rad par pixel font 0,23° par pixel (src/game.js:822). Aucune mesure possible sans appareil : constat et valeurs à valider sur téléphone.

**Cause.** La visée ne dispose que du glisser, qui partage le pouce avec le tir.

**Proposition.** FERRO, source facultative de la couche d'entrées, inactive par défaut :
- Lecture de DeviceMotionEvent.rotationRate (°/s) et de accelerationIncludingGravity.
- Lacet = rotation autour de la verticale : produit scalaire de la vitesse angulaire et de la gravité normalisée. Tangage = rotation autour de l'axe horizontal de l'écran, tourné de screen.orientation.angle.
- Zone morte 0,6 °/s, plafond 400 °/s, gain 1,0 (réglable de 0,5 à 2).
- Mode par défaut « pendant la visée » : actif seulement tant qu'un pointeur de visée ou de tir est posé, pour éviter la dérive au repos.
- iOS : appeler DeviceMotionEvent.requestPermission() depuis le clic sur le réglage ; masquer le réglage si l'API manque ou hors contexte sécurisé (file://).
- Fonction pure gyroVisee(vitesseAngulaire, gravité, angleÉcran, dt, réglages), testée avec des vecteurs synthétiques : téléphone debout, à plat, en paysage.

**Gain attendu.** Correction fine de la mire sans lever le pouce du tir, pour les joueurs qui l'activent. Aucun effet par défaut.

**Risques.** Signes et axes à valider sur appareil, différents entre iOS et Android. Autorisation refusée : rester silencieux. Indisponible en file://. Simulation inchangée (deltas de visée ordinaires). Environ 1 Ko.

**Vérifier par.** Test Node de gyroVisee sur trois poses synthétiques (rotation de 90 °/s pendant 1 s → 90° de lacet à 1 % près). Essai sur iPhone et Android par David.

**Contre-vérification.** Aucune lecture de DeviceMotion dans les trois jeux (grep). Faisable, mais non mesurable ici. Contraintes à inscrire : contexte sécurisé obligatoire (HTTPS, donc inactif en file://), autorisation iOS depuis un geste, signes d'axes à valider sur appareil. Un seul jeu s'en sert aujourd'hui : à ranger comme source facultative de la couche d'entrées, après TACT-01 à 03 qui règlent l'essentiel de la visée au pouce.

## Constats ajoutés par le contre-vérificateur

### TACT-V1 — « Démo qui dure » sur téléphone : rien n'empêche la mise en veille, ni plein écran ni orientation, et aucune démo dans METAL
- sévérité haute · catégorie démo · effort M · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : src/game.js:676-678; src/game.js:838; src/game.js:161-164; src/index.html:5; bitume src/jeu.js:207-214; bitume src/jeu.js:767-777; point-de-rupture src/interface/titre.js:192-217

**Preuve.** grep sur METAL src/game.js, src/style.css, src/index.html : 0 occurrence de wakeLock, requestFullscreen, orientation, vibrate, visualViewport ; 0 occurrence de « demo ». Même recherche sur bitume/src et point-de-rupture/Jeu/src : 0 fichier pour wakeLock, requestFullscreen, orientation.lock. Or BITUME et Point de rupture ont une démo lancée après une attente sur l'écran titre (bitume src/jeu.js:767-777, sortie au premier geste :207-214 ; point-de-rupture src/interface/titre.js:192-217). Sans toucher, un téléphone éteint l'écran en 30 s à 2 min : la démo ne peut pas durer. METAL met aussi le jeu en pause sur blur et visibilitychange (game.js:838) et coupe le rendu quand document.hidden (:678). La limite d'images existe déjà (prefs.fpsLimit, game.js:676 ; valeurs 0/30/60/120, options.js:12).

**Cause.** Les trois jeux traitent la page comme un onglet de bureau : aucun ne demande à l'appareil de rester allumé, et la démo de METAL n'existe pas encore.

**Proposition.** FERRO, petit module src/host.js (additif, environ 1 Ko), utilisé par les trois jeux :
- keepAwake(on) : navigator.wakeLock?.request('screen') ; relâché à la pause ; redemandé sur visibilitychange quand la page redevient visible (le verrou tombe à chaque masquage). Silencieux si l'API manque ou hors HTTPS.
- immersive(on, orientation) : requestFullscreen sur l'élément racine puis screen.orientation.lock?.(orientation) ; uniquement depuis un geste, erreurs avalées (iPhone : non pris en charge).
- idleTimer(ms, onIdle) et la règle de BITUME : pendant la démo, le premier pointerdown, keydown, bouton de manette ou molette la quitte, en capture, avec preventDefault et le click suivant avalé.
METAL :
- Démo = source « pilote » de la couche d'entrées (TACT-09), lancée après 25 s sans geste sur l'écran titre, réglage Démo oui/non.
- Pendant la démo : keepAwake actif, plafond à 30 images/s sur appareil tactile, aucune écriture dans localStorage (ni point de reprise ni réglages), simulation et monde séparés de la partie du joueur, enchaînement des mondes sans écran de fin, son seulement après un premier geste (invite « Touchez pour jouer »).
- En jeu sur tactile : keepAwake actif tant que mode === 'playing' ; bouton « plein écran » dans le menu, paysage proposé (pas imposé) quand la hauteur dépasse la largeur.

**Gain attendu.** La démo tourne sans limite de durée sur téléphone (écran maintenu allumé), au lieu de s'éteindre avec la veille du système. En plein écran sur Android, la barre d'adresse rend environ 56 px de hauteur au jeu.

**Risques.** Wake Lock et DeviceMotion exigent HTTPS : inactifs en file://, donc repli silencieux obligatoire et tests par objet factice. Plein écran indisponible sur iPhone. La démo ne doit jamais toucher aux sauvegardes : test dédié (localStorage identique avant et après 10 min de démo). Chauffe : mesurer sur appareil que 30 images/s tiennent 30 min. Environ 1 Ko dans FERRO, la démo elle-même relève de l'axe démo.

**Vérifier par.** Harnais LOOP avec navigator.wakeLock factice : 1 request à l'entrée en démo, 1 release à la sortie, 1 nouvelle request après un visibilitychange. Test : localStorage inchangé après 36 000 pas de démo. Sur téléphone réel en HTTPS : écran encore allumé après 10 min de démo sans toucher.

### TACT-V2 — 16 à 22 % de l'écran avale les touchers sans rien faire : radar, bandeau du haut et objectif ne laissent pas passer la visée ni le manche
- sévérité moyenne · catégorie entrées · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · jeu
- lieux : src/style.css:1; src/style.css:52-53; src/game.js:786; src/game.js:817-821

**Preuve.** Chrome réel, dist/index.html?touch=1, grille de 4 px avec elementFromPoint en jeu (bench/tact-verif/chrome3.mjs). Zone de visée (x > 36 %) : 390×844 → 65,0 % canvas, 18,5 % commandes, 16,5 % de HUD non interactif (#radar-wrap 7,3 %, enfants de .hud-bottom 5,5 %, .hud-top 2,8 %, .objective 1,0 %) ; 844×390 → 61,6 % canvas, 19,5 % mort (.hud-top 7,7 %, .hud-bottom 5,4 %, #radar-wrap 5,1 %). Bande gauche : 17,9 % et 22,0 % morts (.objective 8,8 et 10,5 %). Preuve de l'effet (chrome2.mjs) : un glisser de 100 px commencé sur le radar donne 0,00° de lacet au lieu de 22,9°. Cause dans le CSS : seuls quelques blocs ont pointer-events:none (style.css:1 #toast, #crosshair, .hud-bottom ; :52 .score-status ; :59 #wave-status ; :76 #encounter) ; #radar-wrap, .hud-top, .objective et les enfants de #arsenal (:53 pointer-events:auto) restent cliquables alors que le radar n'a aucun écouteur (game.js:786 : seul #map-button agit).

**Cause.** Le HUD est cliquable par défaut et ne désactive les pointeurs que bloc par bloc ; les blocs d'information ajoutés ensuite n'ont pas reçu la règle.

**Proposition.** Inverser la règle en tactile comme au bureau : #hud{pointer-events:none}, puis pointer-events:auto uniquement sur les commandes réelles (button, select, #move-zone, .weapon-slot, #interact-button, .top-buttons). En particulier #radar-wrap, .hud-top (hors .top-buttons), .objective, .arsenal-heading et .left-hand-strip (hors select) laissent passer les touchers vers le canvas. Indispensable avant TACT-02 (manche flottant sur toute la bande gauche) et TACT-01.

**Gain attendu.** Surface de visée morte : 16,5 à 19,5 % → 0 % (hors commandes). Bande gauche morte : 18 à 22 % → 0 %.

**Risques.** Au bureau, un clic sur le radar atteindra le canvas et demandera le verrouillage du pointeur : comportement voulu. Vérifier qu'aucun bloc ne compte sur un clic (titre, infobulles). Aucun effet sur la simulation. Environ 0,1 Ko.

**Vérifier par.** node bench/tact-verif/chrome3.mjs <racine> : mortPct = 0 dans les deux zones aux deux formats ; chrome2.mjs : glisser de 100 px commencé sur le radar = 22,9° ± 0,1°.
