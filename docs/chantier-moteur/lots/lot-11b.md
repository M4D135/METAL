# Lot 11b — Mixage complet (complément)

## But
Rendre le mixage audible et stable : armes avec du corps, annonces de boss présentes, musique qui dure, sans pompage ni perte de marge. T1 (MIX-11) installe le banc qui rend chaque retouche vérifiable ; les options FERRO gardent la v0.2 comme défaut. Aucune dégradation par défaut : l'étagère de duck reste une option désactivée.

## Tâches, dans l'ordre

### T1 — Banc de mixage hors ligne et injection de contexte [MIX-11]
- Où : bancs/mixage.html, outils/mixage.py, à partir de bancs/mix (mix.html, mix.js, run.py, record.mjs) ; src/audio.js:120; src/audio.js:305-312; src/audio.js:313; src/audio.js:319
- Quoi : ajouter FAudio.create({context}) (BaseAudioContext fourni, available() accepte un OfflineAudioContext), api.graph() en lecture {master, limiter, guard, effects, ambience, musicBus}, reprendre checks/audio.test.mjs de METAL sans les armes, scènes en fichiers de données. Corriger la mesure : duck par bande en rendu différentiel contre duck nul, crêtes sur au moins 8 passes, ignorer reduction les 2 premières secondes, temps sur machine calme à 2 canaux.
- Preuve exigée : python3 -I run.py "mix.html?job=iso" 240 puis job=matrix, job=null, job=attrib sans remplacement de source ; recouper bancs/mix/out/ (iso.json, matrix-*.json, null.json) ; job=calib : écart ≤ 0,05 dB.
- Qualité : identique (outillage, aucun changement de rendu sans option).
- Garde-fous : banc hors npm test, à documenter au README ; api.graph() réservé aux bancs ; sans option, comportement v0.2 ; test audio METAL de 436 lignes à porter.
- Dépend de : rien ; prérequis de MIX-01, MIX-04 et MIX-05.

### T2 — Table de recettes doomish et réglage de la marge des armes [MIX-01]
- Où : src/audio.js:20-88; src/audio.js:27; src/audio.js:85; src/audio.js:101; src/audio.js:281-291; src/audio.js:489-492; src/audio.js:557-566; src/options.js:6
- Quoi : FAudio.create({recipes}) avec {nom: {synth(variante, taux), variants}} ; synthesize() et warmBank() consultent la table avant les recettes internes, effectNames s'étend ; sans table, PCM v0.2 bit à bit. Garder les recettes internes comme défaut (ne pas les sortir de FERRO). Fournir les cinq recettes FEEL-06 (pistolet, SMG, pompe, roquette, grenade), reporter sur METAL 0.8.1 (63668ac).
- Preuve exigée : gen.mjs puis mix.html?job=matrix&scenes=a,b,c,d sur au moins 8 passes : transitoire p10 ≥ 9 dB pour SMG, pompe et roquette ; niveau 400 ms 90e centile ≥ +6 dB dans (a) à (d) ; 0 échantillon > 0,875 dans (a) à (c) ; réduction sur tir isolé ≤ 1,5 dB ; 0 voix volée ; test Node recipes absent → sha256 des 64 tampons identique v0.2.
- Qualité : meilleure.
- Garde-fous : écoute de 1-actuel.wav contre 2-recettes-doom-chaine-actuelle.wav avant intégration ; recette grenade hypothèse (110→45 Hz, 520 ms) ; checks/audio.test.mjs:279 (durées, longueur du pistolet) à relever ; +1,5 Ko ; tirs ennemis doomish à −46,1 dBFS sous 120 Hz contre −23,8 pour la musique.
- Dépend de : MIX-11 ; écoute de David.

### T3 — Compresseur : ne pas appliquer FEEL-07, exposer chain et makeupDb [MIX-02]
- Où : src/audio.js:311-325; src/audio.js:313-315; checks/audio.test.mjs:27
- Quoi : ne pas appliquer FEEL-07 (0 dB de transitoire rendu, mixage baissé de 0,6 à 0,8 dB). Ajouter chain {masterGain, compressor, level} ; FAudio.makeupDb : T = 10^(seuil/20), courbe de genou, k par 15 bissections géométriques entre 0,1 et 10 000, y1, rattrapage = −0,6 × 20·log10(y1) ; stats.makeupDb. Le GainNode de compensation level:'fixe' va après le compresseur et avant l'écrêteur, pas sur master.gain. Garder l'écrêteur.
- Preuve exigée : job=calib 60 : rattrapages mesurés contre makeupDb, écart ≤ 0,05 dB (4,55 / 3,73 / 3,53 / 2,56) ; job=iso 240 : réduction sur tir isolé ≤ 1,5 dB ; ne jamais lire reduction dans les 2 premières secondes ; test Node de makeupDb sur les quatre couples mesurés ; état identique sans option.
- Qualité : identique.
- Garde-fous : Chrome 157 seulement, Firefox et Safari à calibrer par job=calib ; checks/audio.test.mjs:27 simule le compresseur ; sans chain, valeurs strictement identiques, à noter dans VERSIONS.md.
- Dépend de : rien.

### T4 — Ondulation du pistolet : tenue de 0,36 s, sans étagère [MIX-V1]
- Où : src/audio.js:139; src/audio.js:143; src/audio.js:146; checks/audio.test.mjs:266
- Quoi : option duck.classes = [{cues, depth, hold}], défaut = les trois expressions régulières et tenues 0,14/0,28 s de la v0.2 ; hold = classe.hold dans duckMusic. METAL : shot 0,36 s ; fracture, rocket, grenade, grenadeLaunch 0,30 s ; profondeur 0,45 inchangée ; aucune étagère.
- Preuve exigée : mix.html?job=matrix&scenes=a,p&comps=cur&ducks=cur,curhold 250 : ondulation au pistolet de 5,80 à 0,95 dB (recettes actuelles) et de 6,28 à 1,42 dB (doomish), soit ≤ 1,5 dB ; marge pistolet +1,4 à +1,5 dB (p50 9,14→10,62 ; p10 8,10→9,49) ; SMG, pompe et roquette inchangés (7,4 à 7,9 dB) ; tests :266, :352, :372 duckGain < 0,6 × base.
- Qualité : meilleure.
- Garde-fous : la musique reste basse 0,22 s de plus après le dernier tir (tau 0,18 s), à écouter ; aucun effet simulation ni sauvegardes ; quelques dizaines d'octets ; défaut sans option identique.
- Dépend de : rien ; requis par MIX-04 et MIX-05.

### T5 — Préréglage Doom : gains ×1,41 et limiteur −9/6/8 [MIX-04]
- Où : src/audio.js:491; src/audio.js:561; src/audio.js:565; src/audio.js:313-315
- Quoi : après MIX-01 et MIX-V1, gains des tirs du joueur ×1,41 : shot 0,69, pistolet 0,89, fracture 1,09, rocket 0,80 (au lieu de 0,49 / 0,63 / 0,77 / 0,57) ; chain.compressor {threshold: −9, knee: 6, ratio: 8, attack: .002, release: .10}, level:'auto', sans compensation ; duck en mode 'gain' avec les tenues MIX-V1, à remesurer sans étagère.
- Preuve exigée : mix.html?job=matrix&scenes=a,b,c,d,p&recipes=doom&comps=cur,lim2&ducks=curhold&weaponGain=1.41 250 : cinq cibles tenues sur au moins 8 passes, réduction ≤ 3 dB, pompage ≤ 4 dB, 0 échantillon > 0,875, 0 voix volée ; crêtes 0,52 / 0,71 / 0,77 / 0,74 ; marges SMG 18,4-20,6 dB, pompe 16,7-23,1, roquette 14,0-16,2, pistolet 20,5 ; rattrapage 4,55→3,53 dB (musique et ambiances −1,0 dB, armes +2,0 dB).
- Qualité : meilleure.
- Garde-fous : réserve réelle sous le genou 0,7 dB sur 6 min (crêtes 0,696-0,809), pas 1,1 dB ; réglage propre à METAL, pas défaut FERRO ; tests des gains de tir à adapter ; écoute de 3-prereglage-doom.wav ; remesure obligatoire avec duck 'gain' avant intégration.
- Dépend de : MIX-01, MIX-V1, MIX-11.

### T6 — Annonces de boss audibles dans le mixage [MIX-05]
- Où : src/audio.js:541-544; src/audio.js:141; src/audio.js:139; src/soundscape.js:5; src/soundscape.js:32; src/soundscape.js:37
- Quoi : les annonces sont des alertes de jeu, pas du décor : niveau = max(0,6, niveau localisé) tant que le joueur est dans l'arène, panoramique conservé ; placer l'énergie des quatre annonces entre 500 Hz et 2,5 kHz, le grondement 60-110 Hz de l'Écrasement doublé dans cette bande ; gain 0,27 à 0,30 ; bossTell: 90 dans ranges ; classes de duck de MIX-V1 avec fixe: true ignorant cueLevel.
- Preuve exigée : mix.html?job=tell 200 : RMS de l'annonce sur 0,5 s ≥ RMS de la musique après duck − 3 dB, de 10 à 25 m, pour les quatre familles ; colonnes tellMinusMusicDb et tellMinusAllFxDb sur les variantes actuelle, BOSS-04 et corrigée.
- Qualité : meilleure.
- Garde-fous : gain estimé, pas rendu ; garder l'anti-répétition de 0,25 s (src/audio.js:542) ; tests checks/audio.test.mjs et checks/soundscape.test.mjs à adapter ; taille comprise dans les +3 à 6 Ko de BOSS-04 ; simulation et sauvegardes intouchées.
- Dépend de : BOSS-04 (lot boss) et MIX-V1 (duck.classes, fixe: true).

### T7 — Musique longue : variation par graine, un module par monde [MIX-10]
- Où : src/music.js:112-170; src/music.js:116; src/music.js:161-162; src/music.js:224-234; src/music.js:256; src/music.js:298; src/audio.js:462; src/game.js:145; checks/music.test.mjs:55; checks/music.test.mjs:122
- Quoi : compose(stage, samples, seed) : premier cycle = arrangement actuel, puis 5 cycles de 8 positions ; échange de deux positions parmi 1 à 5 ; kit de batterie par mesure dans la même famille (0, 1, 2 entre eux ; 6 ou 2) ; une fois sur trois hors rupture, volume 0 sur la réponse du 3e canal ; random((seed|0)×7919 + stage + 1) ; moduleFor(stage, seed) avec éviction ; getModule, getTrack, setStage(seed), duration = 46 080/bpm ; audio.setStage(value, seed). METAL passe la graine numérique du monde en démo et en campagne.
- Preuve exigée : node musicvar.mjs : loopSeconds 460,8 / 271,1 / 317,8 s (≥ 240 s), module sans graine identique (sha256), 8 graines → 8 modules, 11/11 tests verts. La non-répétition n'est vraie que batterie comprise : hors batterie, première répétition à 51-192 s et 9 à 29 % des fenêtres, ce que corrige MIX-V3.
- Qualité : meilleure (durée), à valider à l'écoute.
- Garde-fous : +998 octets (890 sans commentaire), module +40 960 octets, 225-300 Ko avec éviction, 4,5 à 7,7 ms par changement de monde ; report sur 0.8.1 : getTrack et setStage ont changé (titre à 12 positions, src/music.js:318 et :382), remplacements à réécrire ; test du mode phrygien intact.
- Dépend de : rien ; MIX-V3 le complète.

### T8 — Riffs réellement variés : permutation de mesures des guitares [MIX-V3]
- Où : src/music.js:112-170; src/music.js:116; src/music.js:298; src/game.js:145
- Quoi : dans la boucle « for(const b of o) » de MIX-10, si b && b < 5 et une fois sur deux : x = pick(4), y = (x + 1 + pick(3)) % 4, échanger les blocs de 16 lignes sur les canaux 0 à 2, batterie laissée en place ; motifs 0 et 5 intacts ; +172 octets. METAL, pour la démo : changer de morceau à chaque monde pour qu'aucun riff ne tourne plus de 5 à 8 minutes.
- Preuve exigée : node musicvar.mjs puis musicperc2.mjs : sur 12 couples graine/morceau, au moins 12 contenus distincts sur les canaux 0-1 (mesuré 12 à 19) et au plus 2 fenêtres de 4 positions répétées hors batterie (mesuré 0 à 2, première à 132 s au plus tôt, aucune dans 5 cas sur 9) ; 17 à 25 contenus distincts hors batterie ; module sans graine identique ; périodes 24/23/22, aucune note nouvelle ; 11/11 tests.
- Qualité : meilleure.
- Garde-fous : une mesure déplacée peut couper une note tenue, écoute des trois morceaux (aucun extrait rendu) ; même réserve que MIX-10 pour le report sur 0.8.1 ; simulation et sauvegardes intouchées.
- Dépend de : MIX-10.

### T9 — Préparation audio découpée, hash comparatif [MIX-09]
- Où : src/audio.js:24-26; src/audio.js:281-303; src/music.js:194-231
- Quoi : appliquer LOAD-13 sans réserve : lots bornés à 8 ms, une variante par tâche pour les effets lourds, moduleFor découpé, ou Worker ; ajouter un test Node qui compare le sha256 des 64 tampons et des trois modules entre ordre direct et ordre inverse dans le même processus, jamais une valeur figée.
- Preuve exigée : node load13.mjs <racine METAL> : tamponsDifferents = 0, modulesIdentiques = true ; état identique bit à bit (graine = nom + variante + taux, aucun état partagé).
- Qualité : identique.
- Garde-fous : un Worker exécute les mêmes Math.exp et Math.sin, le hash doit comparer deux constructions du même processus ; les fonctions mathématiques peuvent différer d'un navigateur à l'autre ; aucun risque sonore.
- Dépend de : rien (prérequis du découpage de chargement).

### T10 — Duck proportionnel au volume des effets [MIX-V2]
- Où : src/audio.js:138; src/audio.js:141; src/audio.js:464; checks/audio.test.mjs:266; checks/audio.test.mjs:352; checks/audio.test.mjs:372
- Quoi : strength = 1 − (1 − strength) × min(1, cueLevel × 1,25) × min(1, mix.effects) ; à effects = 1, identique bit à bit ; à 0,5 → −3,0 dB, à 0,2 → −1,0 dB. Test : setMix({effects: .2}) puis shot → duckGain > 0,85 × base ; effects 1 → duckGain < 0,6 × base.
- Preuve exigée : bench/mix-verif verif.html?job=fxvol 120 : duckMinDb suit effectsVolume et reste à −6,94 dB pour 1 ; aujourd'hui il vaut −6,94 dB aux quatre volumes, alors que les effets passent de −33,8 à −59,8 dBFS RMS (crête 0,375→0,019).
- Qualité : meilleure.
- Garde-fous : les tests :352 et :372 tournent à effects = 1 et restent à vérifier ; aucun changement au réglage par défaut ; report par FERRO.
- Dépend de : rien.

### T11 — État audio « démo » et mise en veille du contexte [MIX-V4]
- Où : src/game.js:71; src/game.js:838; src/audio.js:120; src/audio.js:371-376; src/audio.js:464; src/music.js:290
- Quoi : audio.setIdle(bool) : son coupé sans préécoute depuis 1,5 s → ctx.suspend() ; ctx.resume() sur setIdle(false), start() ou testMix() ; sans appel, comportement v0.2. METAL : mode 'demo' hors de la liste muette de src/game.js:71 ; à l'entrée, setMix({master, music, effects: effectsVolume × 0,4, ambience}) (−8 dB) ; morceau varié par graine ; à la sortie, mixage du joueur restauré ; aucun audio.start() sans geste ; visibilitychange caché → démo en pause et setIdle(true).
- Preuve exigée : onglet caché ou menu depuis 2 s → ctx.state === 'suspended' ; retour → 'running' en moins de 100 ms, stats.resyncs inchangé ; job=long (16 passes, 483 s, 998 689 automatisations) avec le mixage démo : coût stable (11,0 à 11,7 ms/s), 0 voix restante, 0 voix volée ; test Node avec AudioContext factice : setIdle(true) + 1,5 s → suspend une fois, setIdle(false) → resume.
- Qualité : identique.
- Garde-fous : ctx.resume() est asynchrone, un son demandé dans les premières millisecondes peut être perdu (available() exige 'running'), rejouer le jingle après la promesse ; Safari iOS 'interrupted' déjà géré (src/audio.js:374) ; −8 dB à valider à l'écoute.
- Dépend de : MIX-10, MIX-V3, MIX-V2.

### T12 — Polyphonie : plafonds inchangés, coupure par événement [MIX-06]
- Où : src/audio.js:122-136; src/audio.js:170; src/audio.js:266; src/audio.js:588-593; src/music.js:8; checks/audio.test.mjs:150
- Quoi : ne pas relever les plafonds 32/40/48 et ne pas ajouter de vol ; pour les tirs ennemis, event.cutoff = 1100 appliqué dans le filtre existant : filter.frequency = min(event.cutoff, valeur actuelle), en forçant la création du filtre quand cutoff est fourni ; pas de second filtre ; garder le test de vol de voix.
- Preuve exigée : job=matrix : stolenVoices = 0 dans (a) à (d), pics 4 / 4 / 13 / 12 (5 / 6 / 14 / 12 avec doomish) ; scène (b) à tirs triplés et panoramiques décalés (195 tirs, équivalent 18 tireurs) : pic 6 (actuel) et 10 (doomish), 0 voix volée, 22 sons sautés ; borne 9 tranches × 1 tir/60 ms = 18 voix à 105 ms, 45 à 244 ms.
- Qualité : identique.
- Garde-fous : combat à 16 ennemis non rendu, l'anti-rafale borne ; un passe-bas à 1,1 kHz garde le coup grave doomish (−46 dBFS sous 120 Hz) ; aucun nœud de plus par tir.
- Dépend de : MIX-01 (recettes doomish pour la mesure).

### T13 — Boucles d'ambiance endormies quand inaudibles [MIX-07]
- Où : src/audio.js:294; src/audio.js:347-362; src/audio.js:180-197; src/audio.js:379-397
- Quoi : endormir les six boucles (vapeur :347-350, vent :351-356, quatre moteurs :358-362 démarrés en :294) quand la cible de gain est 0 depuis plus de 12 constantes de temps ; retenir la variante mesurée la plus simple : source.disconnect(filtre) / connect, sans recréer de nœud ni calculer de phase ; échéance par boucle dans updateSteam, updateMachinery et tick.
- Preuve exigée : job=attrib, 5 répétitions alternées, machine calme (charge 3,6), 2 canaux : repos 6,94 → ≤ 4,5 ms/s (débranché 3,79 et 3,58), scène (c) 10,64 → ≤ 7,5 ms/s ; job=null sur (a) et (c) : ≤ −90 dBFS RMS pour les boucles sans moteur ; pour les moteurs, phase différente, écart documenté.
- Qualité : visuellement identique (état identique sauf phase des moteurs, inaudible pour une boucle).
- Garde-fous : la phase d'interpolation des moteurs à 22 050 Hz peut différer d'un arrondi ; ne pas vendre plus que −3,15 ms/s (−45 % du repos, −30 % de la scène c, 0,3 % d'un cœur ici, 1 à 1,5 % sur téléphone) ; VERSIONS.md ; aucun effet sur la simulation.
- Dépend de : rien ; MIX-V4 traite mieux menu, pause et onglet caché.

### T14 — Dédoublonnage strict des automatisations [MIX-08]
- Où : src/audio.js:180-197; src/audio.js:379-397; src/audio.js:475-476; invalidation en src/audio.js:410, :458, :463, :471
- Quoi : setMachinery et setSteam mémorisent, tick fait l'unique mise à jour de l'image ; assistant set(param, valeur, instant, tau) garde par AudioParam la dernière cible et la dernière constante et n'appelle setTargetAtTime que si l'une change ; pas de seuil, pas de renvoi périodique ; vider la mémoire à chaque cancelScheduledValues ou écriture directe (:410, :458, :463, :471).
- Preuve exigée : job=null sur (c) et (a) : appels AudioParam 64 475 → 9 481 (−85 %) et 63 479 → 7 100 (−89 %, soit 3,5 à 4,7 par image) ; diff RMS −124 à −131 dB, crête ≤ −80 dBFS (c : −88,7) ; critère RMS ≤ −110 dB plus crête ≤ −80 dBFS ; état identique à −124 dB RMS.
- Qualité : visuellement identique.
- Garde-fous : gain réel négligeable (−0,004 ms par image sur le fil principal, −1,6 % sur le fil audio, non significatif), à faire seulement si on touche déjà ces fonctions ; une mauvaise invalidation fige une cible ; relire checks/audio.test.mjs.
- Dépend de : MIX-07 (mêmes fonctions).

## Options désactivées par défaut
- [MIX-03] duck en étagère basse 150 Hz −12 dB plus 2,2 dB large bande (tenues 0,36/0,30 s) — qualité dégradée : chute réelle 11,4 à 13,2 dB RMS large bande (13,7 à 13,9 sous 150 Hz) contre 6,9 dB aujourd'hui, marge des tirs actuels −2,2 à −4,4 dB et grave retiré de 14 dB par tir. À n'activer qu'après MIX-01 et écoute de 4-actuel-duck-etagere.wav sur casque et haut-parleurs de portable ; coût a-rate non remesuré. Variante passe-bas statique du premier ordre non mesurée.

## Écartés ou absorbés
- FEEL-07 — compresseur plus profond écarté : 0 dB de transitoire rendu et mixage baissé de 0,6 à 0,8 dB (a : −23,83 → −24,57 ; c : −20,58 → −21,26) ; absorbé par MIX-02.
- LOOP-05 — pas variable borné, remplacé par STAB-06 (pas de 1/60 s avec accumulateur, verrouillage écran et interpolation), décision antérieure non rouverte ici.
- PARA-05 — simulation audio en worker écartée : une image de latence (PARA-V1).
- [MIX-06] second filtre passe-bas par tir ennemi — absorbé par event.cutoff dans le filtre existant, sans nœud de plus.
- [MIX-07] recréation de la source avec phase d'origine — non prototypée ; la déconnexion du filtre donne le même gain mesuré (3,58 à 3,87 ms/s), au prix de la phase des moteurs et du test de nullité pour eux.
- [MIX-10] variation limitée à la batterie — insuffisante : les guitares gardent 6 contenus et la première répétition arrive à 51-192 s ; complétée par MIX-V3.
- [MIX-02] level:'fixe' comme défaut METAL — capacité conservée, mais METAL reste en 'auto' (MIX-04) : la compensation porterait la crête de (c) de 0,77 à 0,87.
- [MIX-04] duck en étagère dans le préréglage — non retenu : ses chiffres de pompage héritent d'une métrique qui ignore l'étagère ; remesure avec duck 'gain' et tenue MIX-V1.
- [MIX-09] Worker pour la préparation — option parmi d'autres, non nécessaire : lots de 8 ms et hash comparatif suffisent.
- [MIX-11] remplacement de window.AudioContext — absorbé par FAudio.create({context}).
- [MIX-05] étagère basse pour dégager le grave — absorbée : fixe: true et déplacement spectral suffisent.
- [MIX-01] sortie des recettes d'armes hors de FERRO — corrigé : les recettes internes restent le défaut, la table ne fait que les remplacer.

## Décisions à confirmer par David
- Écoute des quatre extraits (1-actuel, 2-recettes-doom-chaine-actuelle, 3-prereglage-doom, 4-actuel-duck-etagere) sur casque puis haut-parleurs de portable avant toute intégration — défaut proposé : rien d'activé sans validation.
- Ondulation du pistolet : tenue seule (MIX-V1, 5,8 → 0,95 dB) plutôt que l'étagère — défaut proposé : tenue, étagère désactivée.
- Préréglage Doom : gains ×1,41 et limiteur −9/6/8 en level:'auto' sans compensation, remesuré avec duck 'gain' — défaut proposé : appliquer après remesure et écoute.
- Annonces de boss : plancher 0,6, gain 0,27 à 0,30, bande 500 Hz à 2,5 kHz, livrées avec BOSS-04 — défaut proposé : ces valeurs.
- Démo : effets à −8 dB, changement de morceau à chaque monde, setIdle en onglet caché — défaut proposé : −8 dB.
- Machine ne tenant pas la cadence à la résolution native : choix proposé au joueur (NATIF-V1) — défaut proposé : résolution native, jamais modifiée en cours de partie.

## Gains attendus du lot
Mesurés sur le banc après ces tâches : transitoire des armes SMG 8,5 → 14,5 dB, pompe 7,5 → 13,2, roquette 4,5 → 10,7 ; avec le préréglage, armes +2 dB absolus et +3 dB relatifs, marges de 14 à 23 dB. Pompage au pistolet 5,8 → 0,95 dB avec +1,4 dB de marge, sans étagère ; annonces de boss de −26/−29 dB à −3 dB ou mieux (estimé). Musique : boucle de 45-77 s à 271-461 s, contenus de guitare 6 → 12-19, fenêtres répétées hors batterie 4-13 → 0-2, pour +1,17 Ko. Repos audio −3,15 ms/s, et 0 ms/s en menu, pause et onglet caché une fois suspendu (estimé). Ensemble : 0 voix volée, 0 échantillon au-dessus de 0,875, réduction sur tir isolé ≤ 3 dB, sous la limite de 1 400 000 octets.
