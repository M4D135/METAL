# Lot 11b — Mixage complet (complément)
## But
Rendre les armes audibles et puissantes sans écraser la musique, corriger le pompage à 3 Hz du duck, sortir l'annonce du boss du masquage, allonger la boucle musicale pour la démo. Cinq correctifs mesurés sur le vrai graphe FAudio (bancs/mix, Chrome 157, OfflineAudioContext 48 kHz), un préréglage Doom validé par 48 rendus hors ligne. Tout reste déterministe, aucune sauvegarde touchée, ≤ +4 Ko.
## Tâches, dans l'ordre
### T1 — Table de recettes doomish pour les armes [MIX-01]
- Où : src/audio.js:20-88, :27, :85, :101, :281-291, :489-492, :557-566 ; src/options.js:6 (réf. 0.8.0, reporter sur 0.8.1 63668ac).
- Quoi : FAudio.create({recipes}) où recipes = {nom: {synth(variante,taux)→Float32Array, variants:1|2}}. synthesize() et warmBank() consultent la table avant les recettes internes. Cinq recettes doomish (pistolet, SMG, pompe, roquette, grenade). Les recettes internes restent le défaut (correction contre-vérif : « un jeu v0.2 marche sans réglage »).
- Preuve exigée : bancs/mix job=matrix ≥ 8 passes par scène (a)-(d) ; transitoire p10 ≥ 9 dB (SMG, pompe, roquette) ; 400 ms 90e centile ≥ +6 dB ; 0 échantillon > 0,875 ; réduction tir isolé ≤ 1,5 dB ; 0 voix volée.
- Qualité : meilleure.
- Garde-fous : David écoute out/wav/1-actuel.wav contre 2-recettes-doom-chaine-actuelle.wav avant intégration. Recette grenade = hypothèse (FEEL-06 : 110→45 Hz, 520 ms). checks/audio.test.mjs:279 plafonds à relever. ≈ +1,5 Ko. Reporter sur 0.8.1.
- Dépend de : T2 (banc).
### T2 — Infrastructure de test et banc hors ligne [MIX-11]
- Où : src/audio.js:120, :305-312, :313, :319 ; checks/audio.test.mjs ; banc/index.html (FERRO).
- Quoi : FAudio.create({context}) accepte un OfflineAudioContext ; available() le tient pour disponible. api.graph() rend {master, limiter, guard, effects, ambience, musicBus}. Reprendre le test audio de METAL dans checks/. Ajouter bancs/mixage.html + outils/mixage.py (seuils : réduction ≤ 3 dB, 0 échantillon > 0,875, pompage ≤ 4 dB, 0 voix volée, nullité ≤ −110 dB RMS).
- Preuve exigée : job=iso, job=matrix, job=null, job=attrib reproduisent bench/mix/out/ (iso.json, matrix-*.json, null.json) sans remplacement de source dans mix.js.
- Qualité : sans objet (infrastructure).
- Garde-fous : banc hors npm test (README le dit). api.graph() documenté réservé bancs. Corriger le banc : mesurer duck par bande, ≥ 8 passes, ignorer reduction les 2 premières s, machine calme 2 canaux.
- Dépend de : rien.
### T3 — Ne pas appliquer FEEL-07 ; fonction makeupDb [MIX-02]
- Où : src/audio.js:311-325 (réf. 0.8.0, reporter sur 0.8.1).
- Quoi : Effort nul : ne PAS appliquer le réglage FEEL-07 (seuil −12, genou 12, ratio 3, attaque 12 ms) au mixage actuel (gain mesuré nul ou négatif). Exporter FAudio.makeupDb(threshold, knee, ratio) : T=10^(seuil/20) ; courbe(x)=x si x<T sinon T+(1−e^(−k(x−T)))/k ; k par 15 bissections géométriques ; rattrapage = −0,6×20·log₁₀(y₁). stats.makeupDb pour les tests. Écrêteur inchangé.
- Preuve exigée : job=calib : rattrapage mesuré vs makeupDb écart ≤ 0,05 dB. job=iso : réduction ≤ 1,5 dB.
- Qualité : identique.
- Garde-fous : Chrome 157 seul ; Firefox/Safari à vérifier (job=calib). checks/audio.test.mjs:27 : ajouter test makeupDb sur les 4 couples mesurés. Correction contre-vérif : la compensation level:'fixe' passe par un GainNode APRÈS le compresseur, AVANT l'écrêteur (jamais master.gain qui est avant le compresseur).
- Dépend de : rien.
### T4 — Tenues du duck corrigées (ondulation 3 Hz) [MIX-V1]
- Où : src/audio.js:139, :143, :146 ; checks/audio.test.mjs:266 (réf. 0.8.0, reporter sur 0.8.1).
- Quoi : Option duck.classes = [{cues, depth, hold}] ; défaut = expressions régulières et tenues 0,14/0,28 s de la v0.2 (comportement identique sans option). METAL : shot 0,36 s ; fracture, rocket, grenade, grenadeLaunch 0,30 s ; profondeur 0,45 inchangée.
- Preuve exigée : bancs/mix job=matrix scenes=a,p ducks=cur,curhold : ondulation pistolet ≤ 1,5 dB ; marge pistolet ≥ actuelle ; duckGain < 0,6×base conservé (tests :266, :352, :372).
- Qualité : meilleure.
- Garde-fous : musique reste basse 0,22 s de plus après dernier tir (τ 0,18 s inchangé) : écoute à valider. Aucun effet simulation/sauvegarde. Quelques dizaines d'octets.
- Dépend de : rien.
### T5 — Préréglage Doom (armes +3 dB, limiteur −9/6/8) [MIX-04]
- Où : src/audio.js:491, :561, :565, :313-315 (réf. 0.8.0, reporter sur 0.8.1).
- Quoi : Après T1+T4. Gains tirs joueur ×1,41 : shot 0,69 ; pistolet 0,89 ; fracture 1,09 ; rocket 0,80. chain.compressor = {threshold:−9, knee:6, ratio:8, attack:.002, release:.10}, level:'auto'. Ne pas compenser (crête (c) passerait à 0,87). Duck de T4.
- Preuve exigée : bancs/mix job=matrix scenes=a,b,c,d,p recipes=doom comps=cur,lim2 ducks=prop weaponGain=1.41 : cinq cibles tenues ; réduction tir isolé ≤ 3 dB ; pompage ≤ 4 dB ; 0 échantillon > 0,875 dans (a)-(c).
- Qualité : meilleure.
- Garde-fous : réserve réelle 0,7 dB sur 6 min (pas 1,1 sur 30 s). Écoute 3-prereglage-doom.wav. Réglage propre METAL, pas défaut FERRO. Remesurer avec duck gain + tenues T4 avant intégration (pompage hérité de la métrique MIX-03 qui ignore l'étagère).
- Dépend de : T1, T4.
### T6 — Annonce du boss audible [MIX-05]
- Où : src/audio.js:541-544, :141, :139 ; src/soundscape.js:5, :32, :37 (réf. 0.8.0, reporter sur 0.8.1).
- Quoi : Niveau = max(0,6, niveau localisé) dans l'arène, panoramique conservé. Énergie des quatre annonces entre 500 Hz et 2,5 kHz (le grondement 60-110 Hz de BOSS-04 doit être doublé). Gain 0,27-0,30 ; bossTell:90 dans ranges. FERRO : champ fixe:true dans les classes de duck (ignore cueLevel, src/audio.js:141).
- Preuve exigée : bancs/mix job=tell : RMS annonce ≥ RMS musique après duck − 3 dB, de 10 à 25 m, quatre familles.
- Qualité : meilleure.
- Garde-fous : anti-répétition 0,25 s conservée (src/audio.js:542). Tests audio.test.mjs + soundscape.test.mjs. Taille dans les +3-6 Ko de BOSS-04. Gain estimé (−3 dB ou mieux), pas encore rendu. Simulation et sauvegardes non touchées.
- Dépend de : BOSS-04 (lot externe).
### T7 — Variation musicale par graine + riffs variés [MIX-10, MIX-V3]
- Où : src/music.js:112-170, :116, :161-162, :224-234, :256, :298 ; src/game.js:145 ; checks/music.test.mjs:55, :122 (réf. 0.8.0, reporter sur 0.8.1 63668ac où getTrack et setStage ont changé : music.js:318, :382).
- Quoi : compose(stage, samples, seed) : premier cycle = arrangement actuel, puis 5 cycles (échange 2 positions parmi 1-5 ; kit batterie par mesure dans la famille ; réponse 3e canal → volume 0 une fois sur 3 hors rupture). MIX-V3 : pour motifs 1-4, une fois sur 2, échange de 2 mesures (blocs 16 lignes) sur canaux 0-2. moduleFor(stage,seed) avec éviction. METAL : audio.setStage(world.stage, graine).
- Preuve exigée : node musicvar.mjs : boucle ≥ 240 s aux 3 tempos ; aucune fenêtre 4 positions répétée (batterie comprise) ; module sans graine identique (sha256) ; 11/11 tests verts. MIX-V3 : ≥ 12 contenus guitare distincts, ≤ 2 fenêtres répétées hors batterie.
- Qualité : meilleure.
- Garde-fous : +998 + 172 octets. Guitares : 6 → 12-19 contenus distincts. Mémoire : un module varié/morceau, 225-300 Ko. Écoute à valider (passages sans 3e canal). Aucune note hors mode (test phrygien vrai).
- Dépend de : rien.
### T8 — Duck proportionnel au volume des effets [MIX-V2]
- Où : src/audio.js:138, :141, :464 (réf. 0.8.0, reporter sur 0.8.1).
- Quoi : src/audio.js:141 : strength = 1 − (1−strength) × min(1, cueLevel×1,25) × min(1, mix.effects). À effectsVolume = 1 (défaut, options.js:6) : résultat identique bit à bit. En dessous : duck proportionnel (0,5 → −3,0 dB ; 0,2 → −1,0 dB).
- Preuve exigée : bancs/mix-verif verif.html?job=fxvol : duckMinDb suit effectsVolume ; à 1 reste −6,94 dB.
- Qualité : meilleure.
- Garde-fous : tests :352 et :372 tournent à effects = 1 : vérifier inchangés. Point de rupture a sa copie : reporter via FERRO.
- Dépend de : rien.
### T9 — LOAD-13 : découpage de la préparation audio, bit à bit [MIX-09]
- Où : src/audio.js:24-26, :281-303 ; src/music.js:194-231 (réf. 0.8.0, reporter sur 0.8.1).
- Quoi : Appliquer LOAD-13 (lots bornés 8 ms, une variante par tâche, moduleFor découpé, Worker) sans réserve qualité. Ajouter test Node : sha256 des 64 tampons et 3 modules, ordre direct vs inverse, même processus.
- Preuve exigée : node load13.mjs <racine METAL> : tamponsDifferents = 0 ; modulesIdentiques = true.
- Qualité : identique.
- Garde-fous : Worker = même moteur JS : identique sur même machine. Le test compare deux constructions dans le même processus (pas un hachage figé, les fonctions mathématiques peuvent différer d'un navigateur à l'autre).
- Dépend de : rien.
### T10 — Mode démo + mise en veille du contexte [MIX-V4]
- Où : src/game.js:71, :838 ; src/audio.js:120, :371-376, :464 ; src/music.js:290 (réf. 0.8.0, reporter sur 0.8.1).
- Quoi : FERRO : audio.setIdle(bool) → ctx.suspend() après 1,5 s muet ; ctx.resume() sur setIdle(false)/start()/testMix(). METAL : mode 'demo' hors liste muette game.js:71 ; entrée démo : setMix({effects: effectsVolume×0,4}) (−8 dB), morceau varié (T7) ; sortie : mixage restauré. visibilitychange caché : pause démo + setIdle(true).
- Preuve exigée : ctx.state === 'suspended' après 2 s en menu ; 'running' < 100 ms au retour ; verif.html?job=long 8 min : coût stable, 0 voix restante.
- Qualité : identique.
- Garde-fous : ctx.resume() asynchrone : rejouer jingle après promesse. Safari iOS 'interrupted' (audio.js:374). −8 dB à valider à l'écoute. Pas d'audio.start() automatique sans geste.
- Dépend de : T7, T8.
### T11 — Polyphonie : coupure par l'événement, pas de nouveau filtre [MIX-06]
- Où : src/audio.js:122-136, :170, :266, :588-593 ; src/music.js:8.
- Quoi : Ne PAS relever les plafonds (32/40/48). Tirs ennemis : event.cutoff = 1100 passé à l'événement ; dans le filtre existant (src/audio.js:266) : filter.frequency = min(event.cutoff, valeur actuelle), forcer la création du filtre si cutoff fourni. Aucun nœud de plus. Garder le test de vol de voix (checks/audio.test.mjs:150).
- Preuve exigée : job=matrix : stolenVoices = 0 dans (a)-(d).
- Qualité : sans objet.
- Garde-fous : scène (b) = 6 tireurs ; 16 ennemis actifs non rendus. Anti-rafale borne à 9 × 1/60 ms.
- Dépend de : rien.
### T12 — Boucles d'ambiance au repos : débrancher du filtre [MIX-07]
- Où : src/audio.js:294, :347-362, :180-197, :379-397 (réf. 0.8.0, reporter sur 0.8.1).
- Quoi : Quand la cible de gain = 0 : source.disconnect(filtre) ; quand > 0 : source.connect(filtre). Pas de stop/start ni de calcul de phase (implémentation plus simple, mesurée : même gain 3,58-3,87 ms/s). Pour menu/pause/onglet caché : utiliser T10 (ctx.suspend) qui est supérieur.
- Preuve exigée : job=attrib repos ≤ 16 ms/s ; job=null scenes=c,a diff ≤ −90 dBFS RMS.
- Qualité : visuellement identique.
- Garde-fous : phase de la boucle diffère du rendu actuel (test nullité échoue pour les moteurs : inaudible pour une boucle). Pas d'option : changement interne, noter VERSIONS.md. Aucun effet simulation.
- Dépend de : rien.
### T13 — Dédoublonnage strict des automatisations [MIX-08]
- Où : src/audio.js:180-197, :379-397, :475-476 (réf. 0.8.0, reporter sur 0.8.1).
- Quoi : Seulement si on touche déjà ces fonctions. Assistant set(param, valeur, instant, tau) : garde dernière cible + dernière constante par AudioParam, n'appelle setTargetAtTime que si l'une change. Pas de seuil, pas de renvoi périodique. Vider la mémoire aux cancelScheduledValues / écritures directes (:410, :458, :463, :471).
- Preuve exigée : job=null scenes=c,a : diffRmsDbFS ≤ −110 dB ; diffPeakDbFS ≤ −80 dBFS.
- Qualité : visuellement identique.
- Garde-fous : gain réel négligeable (−0,004 ms/image, −1,6 % fil audio, non significatif). Ne pas vendre comme gain de fluidité. Bien invalider la mémoire aux 4 points listés.
- Dépend de : rien.
## Options désactivées par défaut
- [MIX-03] Duck en étagère basse 150 Hz −12 dB + large bande ×0,775 — qualité dégradée par la contre-vérification : la musique baisse de 11,4-13,2 dB RMS large bande (vs 6,9 aujourd'hui), le grave pompe de 13,7-13,9 dB, et la marge des tirs actuels (bande > 250 Hz) chute de −2,2 à −4,4 dB. L'ondulation à 3 Hz est corrigée par T4 (tenue seule). À n'activer qu'après T1 (recettes doomish qui ont du contenu sous 120 Hz) et après écoute de bancs/mix/out/wav/4-actuel-duck-etagere.wav sur casque ET haut-parleurs de portable.
## Écartés ou absorbés
- (aucun constat réfuté dans ce lot ; MIX-03 est classé en option par sa qualité dégradée, pas écarté)
## Décisions à confirmer par David
- Écoute A/B des quatre extraits (bancs/mix/out/wav/1-actuel.wav, 2-recettes-doom-chaine-actuelle.wav, 3-prereglage-doom.wav, 4-actuel-duck-etagere.wav) avant intégration de T1, T5 et l'option MIX-03 — valeur par défaut : intégrer T1+T4+T5, garder MIX-03 désactivé.
- Niveau des effets en mode démo (T10) — valeur par défaut proposée : ×0,4 (−8 dB).
- Recette de grenade (T1) : FEEL-06 ne donne que 110→45 Hz et 520 ms, le reste est hypothèse — valeur par défaut : garder l'hypothèse du banc, valider à l'écoute.
- Si une machine ne tient pas la cadence à la résolution native (NATIF-V1) : le choix revient au joueur dans les options — valeur par défaut : native, jamais modifiée automatiquement.
## Gains attendus du lot
Transitoire des armes contre la musique +6 dB (SMG 8,5→14,5 ; pompe 7,5→13,2 ; roquette 4,5→10,7) ; niveau moyen des effets pendant une rafale +10,5 à +12,7 dB par rapport à la musique (mesure indépendante) ; ondulation de la musique au pistolet 5,8→0,95 dB ; annonce du boss de −26/−29 dB à −3 dB ou mieux (estimé) ; boucle musicale sans répétition de 16 mesures de 45-77 s à 271-461 s (guitares : 6→12-19 contenus distincts) ; fil audio au repos 6,94→3,79 ms/s (boucles débranchées) puis 0 ms/s en menu/pause/onglet caché (ctx.suspend) ; appels AudioParam −85-89 % (T13, si fait) ; 0 échantillon > 0,875, 0 voix volée, réduction tir isolé ≤ 1,5 dB sur les 48 rendus de la matrice.
