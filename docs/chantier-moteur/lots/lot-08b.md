# Lot 08b — Entrées : tactile sur téléphone (complément)
## But
Rendre le jeu jouable au pouce sur téléphone : viser en tirant, courir au manche, lire le HUD, garder l'écran allumé en démo.
Corriger la détection tactile qui bloque la souris sur PC à écran tactile et libérer la surface de visée des panneaux morts.
Livrer la couche d'entrées commune (clavier, tactile, manette) qui rend les sessions rejouables et alimente la démo pilote.
## Tâches, dans l'ordre

### T1 — pointer-events:none sur le HUD tactile [TACT-V2]
- Où : src/style.css:1; src/style.css:52-53; src/game.js:786; src/game.js:817-821
- Quoi : inverser la règle en tactile : `#hud{pointer-events:none}`, puis `pointer-events:auto` uniquement sur button, select, #move-zone, .weapon-slot, #interact-button, .top-buttons. #radar-wrap, .hud-top (hors .top-buttons), .objective, .arsenal-heading, .left-hand-strip (hors select) laissent passer les touchers.
- Preuve exigée : `node bench/tact-verif/chrome3.mjs <racine>` → mortPct = 0 aux deux zones, deux formats ; `chrome2.mjs` : glisser de 100 px commencé sur le radar = 22,9° ± 0,1°.
- Qualité : meilleure.
- Garde-fous : au bureau, un clic radar atteindra le canvas (verrouillage pointeur) : comportement voulu. Vérifier qu'aucun bloc ne compte sur un clic. ~0,1 Ko.
- Dépend de : rien.

### T2 — Détection tactile : souris utilisable sur PC à écran tactile [TACT-08]
- Où : src/game.js:5; src/game.js:18; src/game.js:157-158; src/game.js:813; src/options.js:6
- Quoi : phase 1 (effort S) — première estimation par la règle BITUME `(pointer:coarse)` ou `(maxTouchPoints>0 && hover:none)` ; `lock()` autorisé sur tout mousedown de pointerType souris. Phase 2 (avec TACT-09) — appareil actif = dernier utilisé (touch/mouse/keyboard/gamepad), bascule à chaud, `?touch=1` reste forçage banc.
- Preuve exigée : `node bench/tact/pctouch.mjs <racine>` avec maxTouchPoints=10 → ≥1 appel requestPointerLock, lacet 0,44 rad ; classe touch absente tant qu'aucun pointeur tactile n'est venu.
- Qualité : meilleure.
- Garde-fous : ne pas masquer les commandes tactiles en plein combat (basculer au 1er événement, garder jusqu'au suivant). FOV et assist deviennent réglages. Simulation et sauvegardes non concernées.
- Dépend de : rien (phase 1) ; TACT-09 (phase 2).

### T3 — Couche d'entrées commune src/input.js [TACT-09]
- Où : src/game.js:18; src/game.js:677; src/game.js:683-692; src/game.js:805-837; src/simulation.js:848; src/simulation.js:1917
- Quoi : module additif src/input.js. Le jeu déclare axes (move, look), boutons tenus (fire, fireLeft, sprint), impulsions (dash, jump, bash, pulse, melee, interact). Sources : clavier, souris, widgets tactiles, manette (zone morte 0,12, courbe 1,7, hystérésis gâchettes). Fusion : déplacement = plus forte amplitude ; visée = somme ; tenus = OU ; impulsions verrouillées, effacées après 1er sous-pas. sample() rend la structure + appareil actif. Enregistreur/lecteur de flux (dt + entrées par pas, 8 octets/pas) pour rejeu et démo pilote. assist devient réglage « aide à la visée » (auto : tactile + manette), bonus par arme.
- Preuve exigée : `node bench/tact/equiv.mjs <racine>` → clavier, tactile, manette même hash sans réalignement dt ; deux exécutions du même script → même hash. Test Node de la fonction de fusion. Rejeu 10 min : hash final = hash session.
- Qualité : identique (clavier/souris : structure égale champ par champ).
- Garde-fous : pas fixe NON imposé (STAB-06 : pas variable borné + accumulateur) ; pas fixe uniquement pour session enregistrée/rejouée. Vérifier que FERRO 248043a n'a pas déjà src/input.js (dossier absent sur cette machine). 5 à 7 Ko. Sauvegardes non concernées.
- Dépend de : rien (module additif).

### T4 — Bouton-visée : viser en tirant [TACT-01]
- Où : src/game.js:820-822; src/game.js:830-833; src/index.html:45
- Quoi : widget « bouton-visée » dans la couche d'entrées. Au pointerdown sur #fire-button / #left-fire-button : mémoriser {id, x, y, t}, capturer le pointeur. À chaque pointermove du même id : appeler la fonction de visée commune (TACT-03). Seuil 4 px : sous 4 px du point d'appui, aucun delta (tap ≠ visée). Les deltas du bouton s'ajoutent à lookDX/lookDY. Garder l'écouteur lostpointercapture.
- Preuve exigée : `node bench/tact/touch.mjs <racine>` M1 → ≥60 % des pas de tir avec visée (cible : 100 % des images où le pouce bouge). Nouveau cas : appui immobile 100 ms (3 px) → lacet strictement 0, shots +1.
- Qualité : meilleure.
- Garde-fous : simulation inchangée (même structure input) ; déterminisme et sauvegardes intacts. Seuil 4 px à régler sur appareil. ~0,6 Ko.
- Dépend de : TACT-09, TACT-V2.

### T5 — Manche flottant : course, zone morte, bande gauche [TACT-02]
- Où : src/game.js:827-829; src/game.js:686; src/game.js:820; src/simulation.js:413; src/simulation.js:95; src/style.css:66
- Quoi : widget « manche flottant » : zone de capture = 40 % gauches du canvas (borner à max(20 px, zone sûre) pour iOS), centre au contact, R = clamp(48, 14,4 vmin, 64) px, zone morte radiale 0,12 (n = clamp((d/R−0,12)/0,88, 0, 1)), au-delà de 1,6 R le centre suit le pouce, course auto active à 1,25 R maintenue jusqu'à 1,05 R. METAL : `input.sprint = held('sprint') || courseTactile` (game.js:686). Socle visuel sous le pouce, revient au repos au lâcher.
- Preuve exigée : `node bench/tact/touch.mjs <racine>` M3 → 7,60 m/s au-delà du bord avec sprint vu par la simulation ; M5 → amplitude 0 au bord et au tremblement ; M7 → déplacement vrai sur toute la bande.
- Qualité : meilleure.
- Garde-fous : les joueurs tactiles gagnent la course (vérifier avec IA-11, FEEL-08). Panneaux HUD dans la bande gauche en pointer-events:none (TACT-V2). ~0,8 Ko.
- Dépend de : TACT-09, TACT-V2.

### T6 — Visée tactile : verrouillage du pointeur + courbe d'accélération [TACT-03]
- Où : src/game.js:820-822; src/game.js:825
- Quoi : (a) Bogue P1 : un seul pointeur de visée — ignorer tout nouveau pointerdown tant que le premier est posé ; au lever du 2e doigt, ne pas remettre dragLook=null. (b) Courbe P2 : vitesse v lissée sur 2 échantillons (moyenne exp 0,5), calculée par image dans sample() (somme deltas / dt image, dt borné 8-50 ms, PAS par événement). Gain = 1 + 2,2 × smoothstep((v−400)/(2200−400)). Lacet = dx × 0,004 × sensibilité × gain. Option « accélération de visée » 0-100 % (0 = comportement actuel).
- Preuve exigée : `node bench/tact/touch.mjs <racine>` M2 → <500 ms à 1200 px/s, <1700 ms à 600 px/s ; M6 → lacet croissant après le 2e doigt. Essai au pouce par David.
- Qualité : meilleure.
- Garde-fous : valeurs 400/2200/2,2 = point de départ, à valider sur appareil. Simulation inchangée. ~0,4 Ko.
- Dépend de : TACT-09.

### T7 — Grille en arc du HUD tactile [TACT-05]
- Où : src/style.css:62; src/style.css:66; src/style.css:86-90; src/style.css:93-95; src/style.css:10; src/index.html:45; src/game.js:834-837
- Quoi : variables CSS (valeurs bench/tact/proposal.css) : u = clamp(48px, 14.4vmin, 58px), tir f = 1,5u, écart g = 8px, anneaux r1 = f/2+u/2+g, r2 = r1+u+g. Centre tir à droite max(16px, zone sûre)+f/2+10px. Angles : GARDE/TIR G r1/0°, SAUT r1/50°, ESQUIVE r1/100°, FRAPPE r2/12°, ONDE r2/58°. Socle manche 112 px. Arsenal en tiroir (pastille d'arme). Vie/arme en pastilles 56 px centrées bas. Carte/pause 48×48. Interaction 48 px haut. Libellés ≥10 px. Jauge bouclier en anneau autour de GARDE (ne pas masquer).
- Preuve exigée : `node bench/tact/layout.mjs <racine>` puis `python3 bench/tact/summary.py` : 0 cible sous 48 px, 0 chevauchement, écart ≥8 px entre boutons ronds, aux 3 formats.
- Qualité : meilleure.
- Garde-fous : refonte HUD tactile (le bureau n'est pas touché, règles sous body.touch). SAUT suppose FEEL-09 (input.jump absent en 0.8). AGENTS.md : accessibilité à revérifier. ~1,5 Ko CSS.
- Dépend de : TACT-V2.

### T8 — Lisibilité mobile : plancher 10 px et invite tactile [TACT-07]
- Où : src/style.css:87-90; src/style.css:66; src/game.js:163; src/game.js:613
- Quoi : plancher 10 px libellés, 12 px valeurs (vie, munitions, compteurs). Retirer .slot-name, .equipped-label, #heat-status, #left-hand-status, #ammo-unit (redondants avec icône). Boutons menu accueil 48 px haut, texte 12 px. Invite de départ (game.js:163) : variante tactile « Pistolet + bouclier · GARDE : maintenir » (produite par la fonction d'invites FEEL-11). Ne pas retirer la jauge bouclier ni la chaleur utile.
- Preuve exigée : `node bench/tact/layout.mjs <racine>` puis `python3 bench/tact/show.py out/layout.json` : histogramme sans classe « <6 », « 6-8 » ni « 8-10 » aux 3 formats.
- Qualité : meilleure.
- Garde-fous : moins d'infos affichées en tactile (garder vie, armure, munitions, chaleur, objectif). Bureau non touché.
- Dépend de : TACT-05.

### T9 — Démo qui dure + wake lock + plein écran [TACT-V1]
- Où : src/game.js:676-678; src/game.js:838; src/game.js:161-164; src/index.html:5; bitume src/jeu.js:207-214; bitume src/jeu.js:767-777; point-de-rupture src/interface/titre.js:192-217
- Quoi : module src/host.js (~1 Ko) : keepAwake(on) via navigator.wakeLock?.request('screen'), relâché à la pause, redemandé sur visibilitychange. immersive(on, orientation) : requestFullscreen + screen.orientation.lock?.() depuis un geste. idleTimer(ms, onIdle) + règle BITUME (premier geste quitte la démo, capture + preventDefault + click avalé). METAL : démo = source « pilote » de la couche d'entrées (TACT-09), lancée après 25 s sans geste, réglage oui/non. Pendant démo : keepAwake, 30 img/s tactile, aucune écriture localStorage, mondes enchaînés sans écran de fin, son après 1er geste. En jeu tactile : keepAwake tant que mode==='playing'.
- Preuve exigée : harnais LOOP avec wakeLock factice : 1 request entrée démo, 1 release sortie, 1 request après visibilitychange. localStorage inchangé après 36 000 pas. Téléphone HTTPS : écran allumé après 10 min.
- Qualité : meilleure.
- Garde-fous : Wake Lock et DeviceMotion exigent HTTPS (repli silencieux en file://). Plein écran indisponible iPhone. Démo ne touche JAMAIS aux sauvegardes (test dédié). Chauffe : mesurer 30 img/s × 30 min sur appareil.
- Dépend de : TACT-09.

### T10 — Verrou d'appui tactile + preventDefault + interaction au pointerdown [TACT-04]
- Où : src/game.js:816; src/game.js:818-821; src/game.js:830-831; src/game.js:834-837; src/game.js:686
- Quoi : (1) Verrou d'appui : firePressed=true au pointerdown du bouton de tir, input.fire = tenu || firePressed, consommé après 1er sous-pas. (2) preventDefault sur pointerdown du canvas si pointerType==='touch' (supprime mousedown/mouseup de compatibilité). (3) #interact-button : déclencher au pointerdown (comme esquive/onde/crosse) ; garder click pour clavier en ignorant un click <500 ms après pointerdown.
- Preuve exigée : `node bench/tact/touch.mjs <racine>` M4 → 0 % perdu à 20 et 30 img/s. `layout.mjs` après correctif : séquence tap sur canvas sans mousedown. Tap sur canvas → shots +0 ; tap 20 ms sur tir à 20 img/s → shots +1.
- Qualité : meilleure.
- Garde-fous : preventDefault ne doit PAS viser la souris (verrouillage pointeur). Ne pas remplacer mousedown/mouseup du double tir souris (game.js:814-815), les filtrer. Simulation inchangée.
- Dépend de : TACT-09.

### T11 — Zones sûres : env() partout, tir à 17 % de la hauteur [TACT-06]
- Où : src/style.css:66; src/style.css:70; src/style.css:87; src/style.css:3; src/index.html:5
- Quoi : variables --sl, --sr, --sb, --st sur body.touch = max(valeur, env(safe-area-inset-*)). Supprimer les pixels fixes qui écrasent (style.css:66 left:23px/right:22px ; :70 left/right 20px bottom 11px). Décaler .score-status, .objective, #radar-wrap, #toast de la zone sûre haute. Réserver le bas aux pouces (pastilles 56 px, TACT-05) : centre du tir à 144 px du bas portrait, 71 px paysage, 115 px en 360×640.
- Preuve exigée : `node bench/tact/layout.mjs <racine>` : liste « hors zone sûre » vide aux formats 390×844 (47/34) et 844×390 (47/47/21) ; centre du tir <20 % de la hauteur.
- Qualité : meilleure.
- Garde-fous : émulation Chrome ≠ iPhone (confirmer sur appareil). Bureau non touché. À livrer avec TACT-05.
- Dépend de : TACT-05.

### T12 — FOV portrait : minimum horizontal 50-60° [TACT-12]
- Où : src/renderer.js:1541; src/renderer.js:1503; src/options.js:6; src/game.js:720
- Quoi : fonction fovPour(aspect, fovVertical, minHorizontal=50°) dans FERRO. Si 2·atan(aspect×tan(fov/2)) < minHorizontal, rendre min(104°, 2·atan(tan(minHorizontal/2)/aspect)) ; sinon le FOV demandé. METAL : appliquer à la caméra du monde (game.js:720). L'arme en vue subjective garde son FOV actuel (seconde projection ou compensation du modèle — effort M). Le curseur de FOV garde son sens en paysage. Commencer à 50°, évaluer 55-60° sur appareil.
- Preuve exigée : captures 390×844 avant/après (bench/tact/layout.mjs) ; page gpu/fov103.html pour les comptes. Test unitaire fovPour : aspect 0,462 → ≥50° horizontal ; aspect 1,78 → inchangé.
- Qualité : meilleure (image identique en paysage).
- Garde-fous : à 103° vertical la déformation haut/bas est forte (commencer 50°). Vérifier que le filtre d'acteurs et le culling lisent le même FOV. Le coup de FOV de FMotion (view.fov) s'ajoute, bute sur 110.
- Dépend de : rien.

### T13 — Gouverneur GPU téléphone : livrer les leviers à image prouvée d'abord [TACT-10]
- Où : src/renderer.js:1386; src/renderer.js:1389; src/renderer.js:746-764; src/renderer.js:1384-1393
- Quoi : ordonnancement (pas de changement de code propre) : livrer RGPU-01 (spec4, −0,40 ms) et RGPU-03 (suncache, −0,10 GPU / −0,40 CPU, image identique) avant de retoucher le gouverneur. RGPU-04 (torche) : revalider l'écart d'image (0,10 % pixels >10 niveaux) au format téléphone avant activation. Gouverneur : garder plancher 0,65, aucune autre dégradation auto. Afficher échelle et définition interne dans le compteur. Option « netteté maximale » (plafond min(DPR,2) sous 1,8 MPix) désactivée par défaut.
- Preuve exigée : `cd bench/tact/gpu && ./run.sh neutral.html 390,844 > ../out/gpu-neutral.json && python3 paired2.py ../out/gpu-neutral.json base` : écart variante vs base avec MAD et % pixels >10 niveaux. Refaire sur téléphone réel.
- Qualité : visuellement identique.
- Garde-fous : mesures M5 seulement (part fixe 43-56 % du GPU) ; extrapolation téléphone = estimation. Écarts appariés résistent à la charge, pas les temps absolus. Rendu seul : ni déterminisme ni sauvegardes.
- Dépend de : rien (coordonne avec lots RGPU/RCPU).

### T14 — RCPU-01 portrait : cône → plans du frustum [TACT-11]
- Où : src/renderer.js:1545-1547; src/renderer.js:1503; bench/rcpu/proto.mjs
- Quoi : dans le cache de RCPU-01, remplacer le test de cône par les 4 plans latéraux du frustum de référence, chacun tourné de θ = 6° (corrigé par la contre-vérification : asin(sin 8°·cos 37,6°) ≈ 6,3°, pas 8°) et repoussé de D = 1 m + rayon objet. Valider le cache en testant les 4 rayons de coin du frustum courant contre les 4 plans élargis (16 produits scalaires). Garder la sphère proche (dist ≤ rayon+D+plan proche). Conditions de validité (déplacement ≤ D, rotation ≤ θ, portées, révision) inchangées.
- Preuve exigée : adapter proto.mjs puis `cd bench/tact/gpu && ./run.sh p3.html 390,844` et `python3 paired2.py` : statiques visibles ≤ 830 (au lieu de 1314), MAD ≤ 0,001, CPU rendu ≤ 0,55 ms. Sur-ensemble : `node bench/rcpu/ab.mjs`.
- Qualité : identique (sur-ensemble du frustum exact).
- Garde-fous : le roulis (view.roll, game.js:720) doit être testé contre les plans (coneValid ne compare que le vecteur avant). Taux de reconstruction ne doit pas monter. Mêmes réserves tests que RCPU-01. Rendu seul.
- Dépend de : TACT-10 (ordre d'implémentation).

### T15 — Gyroscope en option désactivée [TACT-13]
- Où : src/game.js:822; src/options.js:6
- Quoi : source facultative de la couche d'entrées (TACT-09), inactive par défaut. Lecture DeviceMotionEvent.rotationRate (°/s) + accelerationIncludingGravity. Lacet = produit scalaire vitesse angulaire · gravité normalisée ; tangage = rotation axe horizontal tourné de screen.orientation.angle. Zone morte 0,6 °/s, plafond 400 °/s, gain 1,0 (réglable 0,5-2). Mode « pendant la visée » actif tant qu'un pointeur visée/tir est posé. iOS : requestPermission() depuis le clic réglage ; masquer si API absente ou hors HTTPS. Fonction pure gyroVisee(vitesseAngulaire, gravité, angleÉcran, dt, réglages).
- Preuve exigée : test Node gyroVisee sur 3 poses synthétiques (rotation 90 °/s × 1 s → 90° lacet à 1 % près). Essai iPhone + Android par David.
- Qualité : meilleure.
- Garde-fous : signes/axes à valider sur appareil (iOS ≠ Android). Autorisation refusée : silencieux. Inactif en file://. Simulation inchangée. ~1 Ko.
- Dépend de : TACT-01, TACT-03.

## Options désactivées par défaut
- Aucune : aucun constat de ce lot n'a la qualité « dégradée ».

## Écartés ou absorbés
- Aucun constat réfuté. Les corrections des contre-vérifications sont intégrées dans les tâches (TACT-03 : vitesse par image pas par événement ; TACT-09 : pas fixe non imposé, enregistrement dt par pas ; TACT-11 : θ = 6° pas 8°, validation par rayons de coin ; TACT-12 : effort M, minimum 50° initial).

## Décisions à confirmer par David
- Résolution native : si une machine ne tient pas la cadence à la résolution native, le choix (baisser ou accepter les saccades) revient au joueur — valeur par défaut proposée : native, alerte non bloquante.
- Courbe d'accélération de visée (TACT-03) : valeurs 400/2200/2,2 px/s sont un point de départ — valeur par défaut proposée : 100 % (courbe active), à régler au pouce.
- Minimum FOV horizontal portrait (TACT-12) : 50° ou 55° ou 60° — valeur par défaut proposée : 50° (déformation modérée).
- Position du tir en paysage (TACT-06) : 71 px du bas ou 30 % de la hauteur — valeur par défaut proposée : 71 px, à confirmer sur iPhone.
- Seuil de la zone morte du manche (TACT-02) : 0,12 — valeur par défaut proposée : 0,12, à valider au pouce.

## Gains attendus du lot
Visée active pendant tout le tir (0 % → 100 % des images où le pouce bouge) ; course tactile à 7,6 m/s (−29 % de vitesse supprimée) ; demi-tour −55 à −67 % à geste rapide ; 0 appui court perdu ; 0 cible sous 48 px et 0 chevauchement ; 0 texte sous 10 px ; souris utilisable sur PC tactile (lacet 0 → 0,44 rad) ; surface de visée morte 16-22 % → 0 % ; démo sans veille sur téléphone ; sessions rejouables bit à bit (même hash d'un processus à l'autre). Coût combiné estimé : ~12 Ko de code/CSS, aucune dégradation d'image, aucune perte de résolution.
