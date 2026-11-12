# Axe MIX — MIX — mixage complet : musique, nouveaux tirs, compresseur, duck et polyphonie

Origine : complément. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Banc écrit dans bancs/mix : une page file:// pour Chrome sans interface (157, OfflineAudioContext 48 kHz, 12 canaux) qui exécute le VRAI src/audio.js + src/music.js (copie en mémoire, FAudio.create() complet : maître 0,65, compresseur, écrêteur, bus, écho, FMusic) et rejoue image par image (60 Hz, suspend/resume) quatre flux d'appels de 30 s enregistrés sur la vraie simulation et le vrai FSoundscape (record.mjs) : (a) rafales de SMG sur « Fer noir », (b) pompe + 6 ennemis, (c) roquettes/explosions/casses, (d) boss ; plus deux scènes synthétiques (tirs isolés, cadences nominales). Des prises séparées (entrée et sortie du limiteur, musique après duck, effets, enveloppe du duck) donnent réduction de gain, pompage, marges et bandes. Le dépôt METAL est resté intact (git status vide, HEAD 673d6b2). ~/Projects/ferro n'existe plus sur ce Mac : FERRO 248043a a été lu dans le clone scratchpad/wf2/ferro/ferro, où src/audio.js et src/music.js sont identiques octet pour octet à METAL 673d6b2 (cmp) ; les numéros de ligne valent donc pour les deux dépôts.

Résultat principal : le diagnostic de FEEL-07 est faux. Le compresseur n'écrase pas l'attaque : sur un tir isolé il réduit de 0,3 à 1,1 dB (1,4 dB avec le prototype doomish), le facteur de crête perd au plus 0,4 dB, et dans les quatre scènes la réduction maximale est de 3,1 dB (moyenne 0,03 à 0,08 dB). Les armes sont « légères » parce qu'elles sont basses et sans corps : crête de sortie 0,32 à 0,44, niveau à 400 ms de 7 à 20 dB SOUS la musique, 21 dB de moins que la musique sous 120 Hz. Le compresseur de FEEL-07 ne rend pas +3 à +5 dB : il baisse tout le mixage de 0,7 à 0,8 dB, parce que le DynamicsCompressor du navigateur applique un gain de rattrapage caché (+4,55 dB aujourd'hui, +3,73 dB avec FEEL-07 ; formule vérifiée à 0,01 dB près).

Cibles : (1) transitoire d'arme ≥ 6 dB au-dessus de la musique : NON tenu aujourd'hui pour la roquette (4,5 dB, p10 3,5) et limite pour le SMG (p10 5,2 à 5,8) ; tenu avec les recettes doomish (10,7 à 15,7 dB). (2) ≤ 3 dB de réduction sur un tir isolé : tenu partout (≤ 1,4 dB). (3) aucun échantillon au-dessus de 0,875 : tenu dans les 48 rendus de la matrice (crête max avant écrêteur 0,80 ; 0,67 dans la chaîne actuelle). (4) pompage ≤ 4 dB : NON tenu par le duck actuel (7,3 à 7,8 dB, ondulation de 5,8 dB à la cadence du pistolet) et aggravé par le duck FEEL-07 (9,1 à 10,6 dB) ; tenu par un duck en étagère basse 150 Hz −12 dB + 2,2 dB large bande (2,6 à 3,7 dB) qui garde ou améliore la marge des tirs, car 65 à 68 % de l'énergie de la musique est sous 120 Hz. (5) aucune voix volée en (b) : tenu (0 voix volée partout, pic de 4 à 14 voix pour des plafonds de 32/40/48 ; doomish ajoute 1 à 2 voix).

Autres mesures : l'annonce du boss est 26 à 29 dB sous la musique dans le mixage (encore 7 à 11 dB dessous avec les valeurs de BOSS-04) ; 62 % de la charge du fil audio vient du graphe au repos, dont 37 % des six boucles d'ambiance qui tournent à gain nul ; LOOP-14 en dédoublonnage strict retire 85 à 89 % des automatisations pour une différence de −124 dB RMS (les seuils proposés au premier tour échouent à −65 dB crête) ; LOAD-13 est exact bit à bit ; une variation musicale par graine de +998 octets donne 271 à 461 s sans répétition de 16 mesures, module par défaut inchangé et 11/11 tests verts.

Limites : Chrome 157 sur macOS seulement (Firefox et Safari non mesurés) ; machine très chargée (charge 33 à 80), donc temps de rendu en relatif, alternés, minimum de 3 ; aucune écoute humaine : quatre extraits A/B du mixage complet sont prêts pour David dans bancs/mix/out/wav/ (1-actuel.wav, 2-recettes-doom-chaine-actuelle.wav, 3-prereglage-doom.wav, 4-actuel-duck-etagere.wav). METAL 0.8.1 (scratchpad/metal-main, 63668ac) modifie déjà audio.js et music.js (musique d'accueil) : les correctifs sont à reporter dessus.

## Mesures

- **Gain de rattrapage et retard du DynamicsCompressor de Chrome** : Réglage actuel (−19/18/5) : +4,55 dB ; FEEL-07 (−12/6/3) : +3,73 dB ; limiteur −9/6/8 : +3,53 dB ; −6/4/12 : +2,56 dB ; retard 288 échantillons (6 ms) à 48 kHz. Formule recalculée : 4,547 / 3,731 / 3,531 / 2,557 dB _(méthode : mix.html?job=calib : sinus 1 kHz à −60 dBFS et impulsion à travers le nœud seul, rapport sortie/entrée ; formule de Chromium recodée en Python et comparée)_
- **Tir isolé sans musique, chaîne actuelle, recettes actuelles** : Réduction max : SMG 0,28 dB, pistolet 0,54, pompe 1,09, roquette 0,49, explosion 0,69, grenade 0,85. Perte de facteur de crête entre le bus et la sortie : 0,07 à 0,37 dB. Crête de sortie 0,317 / 0,356 / 0,444 / 0,365 / 0,395 / 0,402 ; aucun échantillon > 0,875 _(méthode : mix.html?job=iso : un tir toutes les 2 s, musique à 0 ; réduction = rapport RMS sortie/entrée du limiteur par fenêtres de 128 échantillons, retard de 6 ms compensé, rattrapage retiré ; recoupé avec l'attribut reduction lu à 60 Hz (écart ≤ 0,02 dB))_
- **Tir isolé, prototype doomish, chaîne actuelle** : Réduction max : SMG 0,39 dB, pistolet 0,86, pompe 1,42, roquette 0,67, grenade 0,97. Facteur de crête du tampon 8,4 à 11,1 dB (17,6 à 20,2 dB pour les recettes actuelles), conservé à 0,2 dB près en sortie _(méthode : mix.html?job=iso, recettes de bench/feel/doomish.mjs injectées par la table de recettes du banc)_
- **Effet du compresseur FEEL-07 sur un tir isolé** : Crête de sortie : SMG 0,298 contre 0,317 (−0,5 dB), pistolet −0,3 dB, pompe +0,2 dB, roquette −0,3 dB ; RMS de sortie des scènes −0,7 dB (a : −23,83 → −24,57 dBFS ; c : −20,58 → −21,26) _(méthode : job=iso et job=matrix, variantes appariées dans le même processus)_
- **Crête avant écrêteur et échantillons au-dessus de 0,875, chaîne actuelle** : (a) 0,392, (b) 0,560, (c) 0,673, (d) 0,544 ; 0 échantillon au-dessus du genou. Maximum des 48 rendus (2 recettes × 2 compresseurs × 3 ducks × 4 scènes) : 0,801 en (c) avec le compresseur FEEL-07 et le duck en étagère _(méthode : job=matrix, prise à la sortie du limiteur (canaux 2 et 3), comptage par échantillon sur 30 s)_
- **Réduction de gain du compresseur dans les scènes, chaîne actuelle** : Minimum −0,58 dB (a), −1,68 (b), −3,08 (c, 0,02 % des fenêtres sous −3 dB), −1,76 (d) ; moyenne −0,03 à −0,08 dB. Musique seule : −0,45 à −0,57 dB _(méthode : job=matrix et job=bands, fenêtres de 256 échantillons)_
- **Transitoire d'arme contre musique (RMS 5 ms des effets / RMS 400 ms de la musique après duck)** : Recettes actuelles : SMG 8,5 dB (p10 5,8) en (a), 9,7 (p10 5,2) en (d) ; pompe 7,5 (p10 6,3) en (b) ; roquette 4,5 (p10 3,5) en (c). Doomish : SMG 14,5 (p10 12,0) ; pompe 13,2 (11,8) ; roquette 10,7 (9,7) _(méthode : job=matrix, prises séparées effets (canaux 8-9) et musique (6-7), médiane et 10e centile sur tous les tirs du joueur)_
- **Niveau à court terme (400 ms) des effets contre la musique** : Recettes actuelles, médiane / p90 : (a) −6,9 / −0,3 dB, (b) −18,3 / −4,1, (c) −20,7 / −1,8, (d) −14,0 / −0,5. Doomish : (a) +3,3 / +10,9, (b) −10,1 / +8,2, (c) −12,2 / +6,8, (d) −10,2 / +10,7 _(méthode : job=matrix, fenêtres de 400 ms par pas de 100 ms où les effets dépassent −50 dBFS)_
- **Énergie sous 120 Hz, musique contre effets** : Scène (a) : musique −26,9 dBFS, effets actuels −48,0 (écart −21,1 dB), effets doomish −30,6 (écart −3,7 dB) ; avec armes +3 dB : +0,6 dB _(méthode : job=matrix, passe-bas Butterworth d'ordre 4 à 120 Hz appliqué hors ligne aux deux prises)_
- **Spectre de la musique seule, par morceau** : Sous 60 Hz : 23 à 25 % de l'énergie ; 60-120 Hz : 41 à 46 % ; 120-250 Hz : 18 à 20 % ; 250-500 : 4 à 7 % ; 500-1000 : 3,5 à 5 % ; 1-2 kHz : 2,6 % ; 2-4 kHz : 1,2 à 1,5 % ; 4-8 kHz : 0,3 % ; au-delà : 0,02 %. Crête de sortie 0,35 à 0,365 ; RMS de sortie −22,1 / −20,4 / −20,1 dBFS _(méthode : job=bands : 37,5 s de musique sans événement, énergie cumulée par passe-bas successifs)_
- **Pompage de la musique, duck actuel (cadences nominales, recettes actuelles)** : Chute / ondulation : SMG 8 tirs/s 7,4 / 0,4 dB (musique tenue 7,4 dB plus bas pendant toute la rafale) ; pistolet 0,32 s 7,6 / 5,8 dB ; pompe 7,8 / 7,7 ; roquette 7,6 / 7,6. Scène réelle (a) : 7,3 / 6,7 dB (reprise après la surchauffe) _(méthode : job=matrix scènes p et a : gain total appliqué à la musique = enveloppe exacte du duck (gain miroir sur une source constante) + réduction du limiteur)_
- **Pompage avec les autres ducks** : FEEL-07 (×0,35, tenues 0,22/0,18 s) : 9,5 à 10,6 dB, ondulation pistolet 6,9 à 7,3 dB. Étagère 150 Hz −12 dB seule : 0,5 à 1,7 dB large bande. Étagère + large bande ×0,775 + tenues 0,36/0,30 s : 2,6 à 3,7 dB, ondulation pistolet 1,2 à 1,3 dB _(méthode : job=matrix&ducks=cur,feel07,shelf,shelfmix,prop,curhold)_
- **Marge des tirs selon le duck (SMG, scène a, médiane)** : Recettes actuelles : duck actuel 8,5 dB, FEEL-07 10,6, étagère seule 7,1, étagère + large bande 9,1. Doomish : 14,5 / 16,5 / 13,4 / 15,5 _(méthode : job=matrix)_
- **Voix simultanées, voix volées, sons sautés** : Pic de voix : (a) 4, (b) 4, (c) 13, (d) 12 ; doomish : 5 / 6 / 14 / 12. Voix volées : 0 dans tous les rendus. Sons sautés par l'anti-rafale : 4 / 1 / 57 / 3 _(méthode : audio.stats en fin de rendu et stats.voices relevé à chaque image)_
- **Préréglage armes +3 dB, doomish, duck en étagère** : Compresseur actuel : réduction sur la pompe 2,9 à 3,0 dB (p10 3,15), pompage 4,4 à 4,9 dB, crête 0,71. Limiteur −9/6/8, 2 ms/100 ms : réduction 0,7 dB (p10 1,4), pompage 2,3 à 2,6 dB, crête 0,77, 0 échantillon > 0,875 ; marges SMG 18,4 à 20,6 dB, pompe 16,7 à 23,1, roquette 14,0 à 16,2 _(méthode : job=matrix&recipes=doom&comps=cur,lim2&ducks=prop&weaponGain=1.41 sur a, b, c, d, p)_
- **Annonce du boss dans le mixage (17,1 m, level 0,21)** : Actuel : RMS −50,0 à −50,3 dBFS, crête 0,012, soit 25,8 à 29,0 dB sous la musique et 9,1 à 10,2 dB sous les autres effets. Valeurs BOSS-04 (gain ×3, portée 90 m) : −33,2 dBFS, crête 0,084, encore 7,2 à 11,0 dB sous la musique _(méthode : job=tell : scène (d) rendue en entier puis avec les seuls bossTell et la musique à 0 ; RMS sur 0,52 s après chacune des 5 annonces)_
- **Charge du fil audio (ms de rendu par seconde d'audio, 48 kHz)** : Banc nu 2,6 ; graphe FAudio au repos 24,3 ; + musique 34,3 ; scène (c) 39,4. Repos sans les 6 boucles d'ambiance : 15,4 ; sans compresseur : 22,8 ; sans boucles ni compresseur : 10,6. Étagère du duck automatisée : +3 à +6 _(méthode : job=attrib, job=idle, job=shelfk : variantes alternées dans le même processus, minimum de 3, temps de rejeu JavaScript déduit ; charge machine 33 à 80)_
- **Test de nullité LOOP-14** : Bruit du banc (même rendu deux fois) : −113,9 / −138,5 dBFS crête. Dédoublonnage strict : −88,7 dBFS crête et −124,2 dB RMS en (c), −107,5 / −130,8 en (a) ; appels AudioParam 64 475 → 9 481 (−85 %) et 63 479 → 7 100 (−89 %). Seuils du premier tour : −65,3 / −68,7 dBFS crête, 9 022 et 8 285 appels _(méthode : job=null : différence échantillon par échantillon avec le rendu actuel, scènes (c) et (a))_
- **Test de nullité LOAD-13** : 64 tampons d'effets et 3 modules identiques bit à bit quel que soit l'ordre ou le découpage (différence nulle) _(méthode : node load13.mjs : sha256 des PCM construits dans l'ordre, en ordre inverse et une variante par tâche ; modules par warmup tranché contre getModule direct)_
- **Variation musicale par graine** : +998 octets de source (890 sans le commentaire). 48 positions, 46 motifs (37 à 41 contenus distincts) ; boucle 460,8 s / 271,1 s / 317,8 s ; aucune fenêtre de 4 positions (16 mesures) répétée sur 12 couples graine/morceau ; module par défaut identique (sha256) ; 11/11 tests de checks/music.test.mjs verts ; construction 4,5 ms (médiane 7,7) ; module +40 960 octets _(méthode : node musicvar.mjs sur une copie patchée (bench/mix/musicvar/src/music.js), node --test dans ce dossier, node musictime.mjs)_
- **Automatisation k-rate de l'étagère** : Différence avec a-rate : −28 à −29 dBFS crête, −65 dB RMS ; gain de temps 0 à 3 ms/s _(méthode : job=shelfk)_
- **Cadence réelle du SMG dans la simulation** : 8 images à 60 Hz entre deux tirs (0,133 s) ; 9,3 tirs par rafale de 1,6 s avant le verrouillage de surchauffe ; 93 tirs en 30 s _(méthode : record.mjs, histogramme des intervalles de la scène (a))_

## Scripts de banc

- bancs/mix/record.mjs — node record.mjs <racine METAL> <dossier> : enregistre les 4 scènes de 30 s (vraie simulation + FSoundscape, même répartition que game.js:193-203 et :697-703) dans scenes.js
- bancs/mix/gen.mjs — node gen.mjs <racine METAL> <bench/feel/doomish.mjs> <dossier> : copie de travail de audio.js, music.js et du prototype doomish dans src.js
- bancs/mix/mix.js — moteur du banc : variantes (recettes, compresseur, duck, gain des armes, LOOP-14, annonce de boss), rendu hors ligne avec prises, analyse
- bancs/mix/mix.html — page file:// ; ?job=calib | iso | matrix&scenes=a,b,c,d,p&recipes=cur,doom&comps=cur,feel07,lim2&ducks=cur,feel07,shelf,prop[&weaponGain=1.41] | null | tell | bands | perf | shelfk | idle | attrib | wav[&sr=24000]
- bancs/mix/run.py — python3 -I run.py "mix.html?job=matrix&scenes=a,p" 280 > out/x.json : Chrome sans interface, sans port ni réseau, résultat par la console
- bancs/mix/show.py — python3 show.py out/matrix-bcd.json : tableau lisible d'une matrice
- bancs/mix/musicvar.mjs — node musicvar.mjs <racine METAL> : applique la variation musicale à une copie (musicvar/src/music.js), vérifie l'identité par défaut et la non-répétition ; puis cd musicvar && node --test checks/music.test.mjs
- bancs/mix/musictime.mjs — temps de construction d'un module varié
- bancs/mix/load13.mjs — node load13.mjs <racine METAL> : test de nullité de LOAD-13
- bancs/mix/out/ — résultats bruts : iso.json, matrix-ap.json, matrix-bcd.json, pump.json, prop.json, prop-wg.json, prop-wg-feel07.json, tell.json, bands.json, null.json, perf.json, idle.json, attrib.json, shelfk.json, musicvar.json
- bancs/mix/out/wav/ — extraits A/B du mixage complet (26 s, 24 kHz stéréo) : 1-actuel.wav, 2-recettes-doom-chaine-actuelle.wav, 3-prereglage-doom.wav, 4-actuel-duck-etagere.wav

## Constats

### MIX-01 — Les armes sont légères parce qu'elles sont basses et sans corps dans le mixage, pas parce que la chaîne les écrase : les recettes doomish règlent la marge, à passer par une table de recettes
- sévérité haute · catégorie audio · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur et jeu
- lieux : src/audio.js:20-88; src/audio.js:27; src/audio.js:85; src/audio.js:101; src/audio.js:281-291; src/audio.js:489-492; src/audio.js:557-566; src/options.js:6

**Preuve.** Code : durées 0,105 à 0,41 s (src/audio.js:27), normalisation en crête à 0,84 (:85), gains de tir 0,49 SMG / 0,63 pistolet (:561), 0,77 pompe (:565), 0,57 roquette (:491), bus effets 0,9 et musique 0,56 (:101), maître 0,65 (:312), volume musique 0,45 (src/options.js:6).

Mesures dans la chaîne complète, recettes actuelles :
- Tir isolé : crête de sortie 0,317 (SMG), 0,356 (pistolet), 0,444 (pompe), 0,365 (roquette), soit −10 à −7 dBFS ; RMS de sortie −29,4 à −26,7 dBFS.
- Niveau à 400 ms des effets contre la musique : médiane −6,9 dB en (a), −18,3 en (b), −20,7 en (c), −14,0 en (d) ; même le 90e centile reste sous la musique (−0,3 à −4,1 dB).
- Transitoire contre musique : SMG 8,5 dB (p10 5,8), pompe 7,5 (p10 6,3), roquette 4,5 (p10 3,5) : la cible de 6 dB n'est pas tenue pour la roquette.
- Sous 120 Hz : effets −48,0 dBFS, musique −26,9 dBFS.

Même chaîne, recettes de bench/feel/doomish.mjs :
- Transitoire contre musique : SMG 14,5 dB (p10 12,0), pompe 13,2 (11,8), roquette 10,7 (9,7).
- 400 ms, 90e centile : +10,9 / +8,2 / +6,8 / +10,7 dB.
- Sous 120 Hz : −30,6 dBFS (écart avec la musique −3,7 dB au lieu de −21,1).
- Crête avant écrêteur 0,42 / 0,55 / 0,62 / 0,60 : aucun échantillon au-dessus de 0,875. Réduction max 0,9 / 2,1 / 2,9 / 2,5 dB. Pic de voix 5 / 6 / 14 / 12, aucune voix volée.

**Cause.** Les recettes actuelles sont un clic de 20 à 50 ms à fort facteur de crête (17,6 à 20,2 dB) : normalisées en crête puis atténuées par 0,49 à 0,77 × 0,9 × 0,65, elles ont très peu d'énergie moyenne. La musique, dense et grave, les dépasse en niveau perçu. Le prototype doomish a un facteur de crête de 8,4 à 11,1 dB : à crête égale il porte 6 à 9 dB d'énergie en plus.

**Proposition.** FERRO : FAudio.create({recipes}) où recipes est une table {nom: {synth(variante, taux) → Float32Array, variants: 1|2}}. synthesize() et warmBank() (src/audio.js:20, :284-291) consultent la table avant les recettes internes ; effectNames s'étend aux noms ajoutés. Sans table, le PCM est celui de la v0.2 bit à bit. C'est le crochet window.__SYNTH du banc (mix.js, buildAudio), qui n'a demandé qu'une ligne.

METAL : fournir les cinq recettes de FEEL-06 (pistolet, SMG, pompe, roquette, grenade) par cette table, puis sortir de FERRO les recettes d'armes de METAL (limite déjà notée dans VERSIONS.md 0.1).

Critères d'acceptation, à rejouer avec mix.html?job=matrix :
- transitoire contre musique, 10e centile ≥ 9 dB pour SMG, pompe et roquette ;
- niveau 400 ms effets/musique, 90e centile ≥ +6 dB dans (a) à (d) ;
- 0 échantillon au-dessus de 0,875 dans (a) à (c) ;
- réduction sur tir isolé ≤ 1,5 dB ;
- 0 voix volée.

**Gain attendu.** Mesuré, chaîne inchangée : marge du transitoire +6 dB (SMG 8,5 → 14,5 ; pompe 7,5 → 13,2 ; roquette 4,5 → 10,7) ; niveau 400 ms au 90e centile de −0,3 à +10,9 dB en (a) ; écart de grave avec la musique de −21,1 à −3,7 dB.

**Risques.** - Ressenti : David doit écouter out/wav/1-actuel.wav contre 2-recettes-doom-chaine-actuelle.wav avant intégration.
- La recette de grenade du banc est une hypothèse (FEEL-06 ne donne que 110→45 Hz et 520 ms).
- checks/audio.test.mjs fige les durées courtes et la longueur du pistolet (:279) : plafonds à relever comme l'indique FEEL-06.
- Taille : environ +1,5 Ko côté METAL.
- METAL 0.8.1 (63668ac) a déjà modifié audio.js : reporter le correctif dessus.
- FERRO n'a aucun test audio (checks/ : motion, music, options, renderer) : ajouter un test de la table de recettes.

**Vérifier par.** node gen.mjs <METAL> <doomish.mjs> . puis python3 -I run.py "mix.html?job=matrix&scenes=a,b,c,d" 285 > out/m.json ; python3 show.py out/m.json. Test Node : avec recipes absent, sha256 des 64 tampons identique à la v0.2.

**Contre-vérification.** Lignes exactes (audio.js:27, :85, :101, :312, :491, :561, :565 ; options.js:6). Banc rejoué dans bench/mix-verif (src.js régénéré, identique par cmp) : tous les chiffres reviennent à l'identique (rendu hors ligne déterministe). Preuves indépendantes : (1) calcul direct de la chaîne : crête du SMG 0,84 x 0,49 x 0,9 x 0,65 puis panoramique = 0,194 à l'entrée du compresseur, 0,317 en sortie, alors que la musique seule culmine à 0,35-0,365 : la crête d'un tir est sous celle de la musique ; (2) ma propre mesure (verif.html?job=bandduck, filtres à moi, RMS des effets sur toute la rafale contre RMS de la musique après duck) : SMG -1,3 dB avec les recettes actuelles contre +10,0 dB avec doomish ; pistolet -4,7 / +6,6 ; pompe -7,8 / +4,9 ; roquette -7,3 / +3,2, soit +10,5 à +12,7 dB ; (3) attribut reduction natif du compresseur : 0,29 à 1,10 dB sur tir isolé. Vérifié aussi que les tirs ennemis doomish (tampon smg à 0,24) n'encombrent pas le grave : -46,1 dBFS sous 120 Hz contre -23,8 pour la musique. Corrections : (a) « sortir de FERRO les recettes d'armes » viole la règle « un jeu de la v0.2 marche sans réglage » : garder les recettes internes comme défaut, la table ne fait que les remplacer ; (b) les critères d'acceptation doivent porter sur au moins 8 passes de scène, car la crête varie de 0,62 à 0,70 selon la phase de la musique (mesuré sur 16 passes de la scène c, 0,673 à la première) ; (c) reste une affaire d'écoute : aucune oreille humaine n'a validé.

**Gain corrigé.** Inchangé pour la marge du transitoire (+6 dB). Ajout : niveau moyen des effets pendant une rafale +10,5 à +12,7 dB par rapport à la musique (mesure indépendante).

### MIX-02 — Le compresseur de FEEL-07 ne rend pas de transitoire : il baisse tout le mixage de 0,8 dB, à cause du gain de rattrapage caché du navigateur
- sévérité moyenne · catégorie audio · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité identique · moteur (dans METAL)
- lieux : src/audio.js:311-325; Jeu/src/moteur/audio.js:569-577 (Point de rupture); src/son.js:90-91 (BITUME)

**Preuve.** Code : src/audio.js:313-315 (seuil −19, genou 18, ratio 5, attaque 4 ms, relâchement 180 ms). La même chaîne est dans Point de rupture (Jeu/src/moteur/audio.js:569-570) ; BITUME a son limiteur −6/0/12 (src/son.js:90-91).

Mesures :
- Rattrapage automatique de Chrome : +4,55 dB avec le réglage actuel, +3,73 dB avec FEEL-07, retard de 6 ms (job=calib).
- Tir isolé, réglage actuel : réduction max 0,28 dB (SMG), 0,54 (pistolet), 1,09 (pompe), 0,49 (roquette), 0,69 (explosion) ; perte de facteur de crête ≤ 0,37 dB.
- Scènes, réglage actuel : minimum −0,6 / −1,7 / −3,1 / −1,8 dB, moyenne −0,03 à −0,08 dB.
- FEEL-07 : crête de sortie du SMG 0,298 contre 0,317 (−0,5 dB), pompe +0,2 dB, roquette −0,3 dB ; RMS de sortie −0,7 dB en (a) et (c) ; crête avant écrêteur en (c) 0,738 contre 0,673.
- Formule recodée : 4,547 / 3,731 / 3,531 / 2,557 dB contre 4,55 / 3,73 / 3,53 / 2,56 mesurés. Elle donne +3,3 dB pour le limiteur de BITUME (calculé, non mesuré).

**Cause.** Le compresseur travaille à peine parce que le mixage arrive bas : crêtes d'entrée de 0,19 à 0,30 pour un genou qui commence à −19 dB. Son effet principal est le gain de rattrapage, que le code ne mentionne pas : il vaut (1/courbe(0 dBFS))^0,6 et change dès qu'on touche au seuil, au genou ou au ratio. FEEL-07 a attribué au temps d'attaque une perte de transitoire qui n'existe pas (estimée, jamais rendue).

**Proposition.** 1) Ne pas appliquer le réglage FEEL-07 au mixage actuel : gain mesuré nul ou négatif.

2) FERRO : FAudio.create({chain: {masterGain: .65, compressor: {threshold, knee, ratio, attack, release}, level: 'auto' | 'fixe'}}). Par défaut, valeurs et comportement de la v0.2. Avec level: 'fixe', master.gain = masterGain × 10^((4,55 − rattrapage(seuil, genou, ratio))/20), pour qu'un changement de compresseur ne déplace plus le niveau des sons faibles.

3) Fonction rattrapage, exportée (FAudio.makeupDb) :
- T = 10^(seuil/20) ; courbe(x) = x si x < T, sinon T + (1 − e^(−k(x−T)))/k ;
- k par 15 bissections géométriques entre 0,1 et 10 000 (départ 5, k = √(min·max)) pour que la pente en dB de courbe, prise entre x et 1,001·x à x = 10^((seuil+genou)/20), vaille 1/ratio ;
- y1 = courbe(1) si seuil+genou > 0, sinon 10^((dB(courbe(x_genou)) − (seuil+genou)/ratio)/20) ;
- rattrapage = −0,6 × 20·log10(y1).

4) stats.makeupDb pour les tests. Garder l'écrêteur tel quel : il ne sert jamais dans les scènes mesurées.

**Gain attendu.** Aucun effort gaspillé sur un réglage sans effet (réduction déjà ≤ 1,1 dB sur tir isolé). Niveau global stable à 0,01 dB près quand un jeu change son compresseur, pour les trois jeux.

**Risques.** - Mesuré sur Chrome 157 seulement. Firefox et Safari descendent du même code, mais leur rattrapage est à vérifier avec job=calib.
- checks/audio.test.mjs:27 simule le compresseur : ajouter un test de makeupDb sur les quatre couples mesurés.
- Compatibilité FERRO : sans chain, valeurs strictement identiques ; à noter dans VERSIONS.md.

**Vérifier par.** python3 -I run.py "mix.html?job=calib" 60 : rattrapages mesurés contre FAudio.makeupDb, écart ≤ 0,05 dB. python3 -I run.py "mix.html?job=iso" 240 : réduction sur tir isolé ≤ 1,5 dB.

**Contre-vérification.** audio.js:313-315 exact ; Point de rupture Jeu/src/moteur/audio.js:569-570 exact (-19/18/5/0,004/0,18) ; BITUME src/son.js:90-91 exact (-6/0/12). Preuve indépendante : formule de Chromium recodée par moi en Python (courbe de genou, 15 bissections, saturation à 0 dBFS, puissance 0,6) : 4,547 / 3,731 / 3,531 / 2,557 dB et 3,30 dB pour BITUME ; étalonnage rejoué dans Chrome 157 : 4,55 / 3,73 / 3,53 / 2,56 dB, retard 288 échantillons. L'attribut reduction du nœud confirme : avec le réglage FEEL-07 la réduction sur tir isolé est 0 dB (0,05 pour la pompe), donc aucun transitoire à « rendre » ; crête de sortie du SMG 0,298 contre 0,317. Deux corrections : (1) la compensation level:'fixe' ne doit pas passer par master.gain, qui est AVANT le compresseur et déplace son point de travail ; mettre un GainNode après le compresseur et avant l'écrêteur ; (2) piège de mesure à noter dans le banc : l'attribut reduction démarre vers -12 dB sur du silence et met 2 s à revenir à 0 (artefact du vu-mètre, pas une réduction réelle : rapport sortie/entrée normal) ; ne jamais lire reduction dans les 2 premières secondes. La partie « ne pas appliquer le compresseur de FEEL-07 » est à effort nul et prioritaire ; l'API chain/makeupDb sert surtout à l'arrivée de BITUME (P2).

**Gain corrigé.** Inchangé : FEEL-07 baisse le mixage de 0,6 à 0,8 dB (RMS -23,83 -> -24,57 en a ; -20,58 -> -21,26 en c) et rend 0 dB de transitoire.

### MIX-03 — Le duck fait pomper toute la musique de 7 dB, et celui de FEEL-07 de 9 à 10 dB : un duck en étagère basse tient la cible de 4 dB sans perdre de marge
- sévérité haute · catégorie audio · effort M · gain mesuré
- contre-vérification : **plausible**, priorité P3 · qualité dégradée · moteur (dans METAL)
- lieux : src/audio.js:137-151; src/audio.js:139; src/audio.js:143; src/audio.js:328; src/music.js:31; src/music.js:60-66; checks/audio.test.mjs:266

**Preuve.** Code : src/audio.js:137-151. Profondeur ×0,45 en 6 ms, tenue 0,14 s, retour τ = 0,18 s ; classes de sons reconnues par des expressions régulières en dur aux noms de METAL (:139).

Pompage mesuré (gain total appliqué à la musique = duck + limiteur), cadences nominales :
- SMG à 8 tirs/s : chute 7,4 dB, ondulation 0,4 dB. La tenue ne retombe jamais, la musique reste 7,4 dB plus bas pendant toute la rafale.
- Pistolet à 0,32 s : chute 7,6 dB, ondulation 5,8 dB à 3 Hz.
- Pompe et roquette : un creux de 7,6 à 7,8 dB par tir.
- Scène réelle (a) : 7,3 dB, et 6,7 dB de reprise quand la surchauffe coupe la rafale.

Duck FEEL-07 (×0,35, tenues 0,22 et 0,18 s) : 9,5 à 10,6 dB de chute, 6,9 à 7,3 dB d'ondulation au pistolet, pour +2,1 dB de marge.

Pourquoi l'étagère : 65 à 68 % de l'énergie de la musique est sous 120 Hz et moins de 0,35 % au-dessus de 4 kHz (job=bands). C'est la bande des coups graves du prototype doomish (55 à 175 Hz).

Variantes mesurées :
- Étagère 150 Hz −12 dB seule : pompage large bande 0,5 à 1,7 dB, marge du SMG 7,1 dB (−1,4 dB).
- Étagère −12 dB + large bande ×0,775 + tenues 0,36 s (shot) et 0,30 s : chute 2,6 à 3,7 dB, ondulation pistolet 1,2 à 1,3 dB, marge du SMG 9,1 dB (+0,6 dB par rapport à aujourd'hui) ; avec doomish 15,5 dB.
- Coût : +3 à +6 ms de rendu par seconde d'audio. En k-rate la différence atteint −28 dBFS crête : à ne pas faire.

**Cause.** Le duck baisse tout le spectre alors que le masquage est dans le grave. La tenue de 0,14 s est plus courte que l'intervalle du pistolet (0,32 s), d'où une ondulation à la cadence de tir. Approfondir le duck, comme le propose FEEL-07, aggrave le défaut que David entend.

**Proposition.** FERRO, option duck (défaut = v0.2, mode 'gain') :
duck: {mode: 'shelf', shelfHz: 150, fullband: .3, attack: .006, release: .18, classes: [{cues, depth, hold}]}.

- En mode 'shelf' seulement, insérer un BiquadFilter lowshelf (fréquence shelfHz, gain 0 dB) entre musicBus et master (src/audio.js:328).
- Dans duckMusic : shelf.gain.cancelScheduledValues(now) ; setTargetAtTime(20·log10(duckDepth), now, attack) ; setTargetAtTime(0, duckUntil, release). Le bus reçoit MUSIC_GAIN × (1 − fullband × (1 − duckDepth)).
- Automatisation a-rate (défaut du navigateur).
- classes remplace les trois expressions régulières de :139, pour que BITUME et Point de rupture déclarent leurs propres sons.

Valeurs mesurées pour METAL :
- armes et coups reçus : depth 0,25 (−12 dB sous 150 Hz, −2,2 dB large bande) ;
- hold : shot 0,36 s ; fracture, rocket, grenade, grenadeLaunch 0,30 s ;
- classes boss/explosion (0,38) et légère (0,68) inchangées.

stats.duckGain garde son sens, ajouter stats.duckShelfDb.

Critères d'acceptation (job=matrix, scènes a et p) : chute ≤ 4 dB par rafale ; ondulation au pistolet ≤ 1,5 dB ; marge du SMG ≥ celle du duck actuel.

**Gain attendu.** Mesuré : pompage large bande de 7,3-7,8 dB à 2,6-3,7 dB ; ondulation au pistolet de 5,8 à 1,2 dB ; marge du SMG +0,6 dB (8,5 → 9,1) avec les recettes actuelles et 15,5 dB avec doomish.

**Risques.** - checks/audio.test.mjs:266, :352 et :372 exigent duckGain < 0,6 × base : ils restent vrais en mode 'gain' ; ajouter des tests pour le mode 'shelf'.
- Coût audio +10 à 15 % en mode 'shelf' (+0,3 à 0,6 % d'un cœur ici).
- Écoute à valider : out/wav/4-actuel-duck-etagere.wav contre 1-actuel.wav.
- Une variante moins chère (passe-bas statique du premier ordre soustrait par un gain automatisé, nulle au repos) est possible mais n'a pas été mesurée.

**Vérifier par.** python3 -I run.py "mix.html?job=matrix&scenes=a,p&comps=cur&ducks=cur,feel07,shelf,prop" 250 > out/pump.json : champ pump.perBurst (chute, ondulation) par rafale et shots.*.transientOverMusicDb.

**Contre-vérification.** Diagnostic confirmé : audio.js:137-151 exact, profondeur 0,45 (-6,94 dB), tenue 0,14 s, ondulation de 5,8 dB à la cadence du pistolet (rejoué : 7,36/0,43 ; 7,64/5,80 ; 7,78/7,74 ; 7,64/7,63). Le remède est surestimé, sa métrique de « pompage » ne compte que le gain large bande et le compresseur et EXCLUT l'étagère, alors que 65 % de l'énergie de la musique est dans la bande coupée. Ma mesure indépendante (job=bandduck : même musique rendue avec duck 'none', rapport de RMS par bande, déterministe) : avec le duck proposé la musique baisse en réalité de 11,4 à 13,2 dB en RMS large bande au pire (6,9 dB aujourd'hui), de 13,7 à 13,9 dB sous 150 Hz, et de 2,7 à 3,4 dB au-dessus de 250 Hz. La cible de 4 dB n'est tenue qu'au-dessus de 250 Hz ; la basse et la grosse caisse disparaissent de 14 dB à chaque tir. « Sans perdre de marge » est faux pour les recettes actuelles, qui n'ont rien sous 120 Hz : dans leur bande (> 250 Hz) la marge du SMG passe de +4,15 à -0,24 dB (-4,4 dB) et celle du pistolet de +1,21 à -1,04 dB. Avec doomish le bilan est mitigé : +5,4 dB sous 150 Hz (6,05 -> 11,47), -4,4 dB au-dessus de 250 Hz (15,95 -> 11,55). Donc : à ne proposer qu'en option désactivée, après MIX-01 et après écoute de 4-actuel-duck-etagere.wav sur casque ET sur haut-parleurs de portable. Le vrai défaut audible (ondulation à 3 Hz) se corrige par la tenue seule : voir MIX-V1. Coût audio de l'étagère a-rate non remesuré.

**Preuve corrigée.** Chute réelle de la musique avec le duck en étagère + large bande : 11,4 à 13,2 dB RMS large bande (fenêtres de 100 ms), 13,7 à 13,9 dB sous 150 Hz, 2,7 à 3,4 dB au-dessus de 250 Hz ; duck actuel : 6,9 dB partout.

**Gain corrigé.** Ondulation au pistolet 5,8 -> 1,3 dB (confirmé, mais dû à la tenue de 0,36 s, pas à l'étagère). Pompage au-dessus de 250 Hz 6,9 -> 2,7-3,4 dB ; pompage sous 150 Hz 6,9 -> 13,7-13,9 dB. Marge dans la bande des tirs actuels : -2,2 à -4,4 dB.

### MIX-04 — Préréglage « Doom » mesuré : armes +3 dB, limiteur −9/6/8 et duck en étagère tiennent les cinq cibles ; avec le compresseur actuel, +3 dB fait pomper
- sévérité moyenne · catégorie audio · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · jeu
- lieux : src/audio.js:491; src/audio.js:561; src/audio.js:565; src/audio.js:313-315

**Preuve.** Variante : recettes doomish, gains des tirs du joueur ×1,41, duck en étagère de MIX-03.

Avec le compresseur actuel (−19/18/5) :
- réduction sur chaque coup de pompe 2,9 à 3,0 dB (p10 3,15) ;
- pompage de la musique 4,4 à 4,9 dB (le limiteur ajoute 1,7 à 2,8 dB au duck) ;
- crête avant écrêteur 0,71.

Avec un limiteur −9 dB, genou 6, ratio 8, attaque 2 ms, relâchement 100 ms :
- réduction 0 dB sur le SMG, 0,7 dB sur la pompe (p10 1,4), minimum 1,8 dB en (c) ;
- pompage 2,3 à 2,6 dB ;
- crête avant écrêteur 0,52 / 0,71 / 0,77 / 0,74 en (a) à (d), 0 échantillon au-dessus de 0,875 ;
- marges : SMG 18,4 à 20,6 dB, pompe 16,7 à 23,1, roquette 14,0 à 16,2, pistolet 20,5 ;
- 0 voix volée, pic de 14 voix.

Le réglage FEEL-07 (ratio 3, attaque 12 ms) sur la même variante laisse 1,5 dB de réduction sur la pompe pour une crête de 0,75 en (c).

**Cause.** Le mixage garde 2,3 à 7 dB de réserve inutilisée sous le genou de l'écrêteur (crêtes de 0,39 à 0,67). David demande des armes plus fortes : on peut les prendre sur cette réserve, mais dès que les armes montent c'est le compresseur à seuil bas (−19 dB) qui se met à travailler sur chaque tir et à moduler la musique.

**Proposition.** METAL, après MIX-01 à MIX-03, par les options de FERRO :
- gains des tirs du joueur : shot 0,69 (SMG), 0,89 (pistolet), fracture 1,09, rocket 0,80 (au lieu de 0,49 / 0,63 / 0,77 / 0,57) ;
- chain.compressor = {threshold: −9, knee: 6, ratio: 8, attack: .002, release: .10}, level: 'auto'. Mesuré ainsi : le rattrapage passe de +4,55 à +3,53 dB, donc musique et ambiances −1,0 dB, armes +2,0 dB en absolu. Ne pas compenser : la crête de (c) passerait de 0,77 à 0,87, au ras du genou ;
- duck de MIX-03.

Critères d'acceptation : les cinq cibles de la mission dans (a) à (d) et (p), dont réduction sur tir isolé ≤ 3 dB, pompage ≤ 4 dB et 0 échantillon au-dessus de 0,875 dans (a) à (c).

**Gain attendu.** Mesuré : armes +2 dB en absolu et +3 dB par rapport à la musique, marges de 14 à 23 dB, pompage 2,3 à 2,6 dB au lieu de 7,3 à 7,8 dB aujourd'hui.

**Risques.** - Réserve restante de 1,1 dB sous le genou dans la scène (c), qui n'est pas le pire cas possible : une explosion de boss à bout portant avec un tir simultané peut l'atteindre. L'écrêteur reste la sécurité.
- Niveau perçu à valider à l'écoute : out/wav/3-prereglage-doom.wav.
- Réglage propre à METAL : ne pas en faire le défaut de FERRO.
- Tests audio de METAL sur les gains de tir à adapter.

**Vérifier par.** python3 -I run.py "mix.html?job=matrix&scenes=a,b,c,d,p&recipes=doom&comps=cur,lim2&ducks=prop&weaponGain=1.41" 250 > out/prop-wg.json ; python3 show.py out/prop-wg.json.

**Contre-vérification.** Rejoué sur b, c, p : mêmes chiffres (pompe : réduction p50 -2,85 / p10 -3,00 avec le compresseur actuel, -0,67 / -0,86 avec -9/6/8 ; crêtes 0,713 / 0,770 / 0,686 ; 0 échantillon au-dessus de 0,875 ; 0 voix volée, pic 14). Pas de plafonnement du niveau dans pcm() (audio.js:257-270) : le gain 1,09 de la pompe passe bien. Mesure indépendante de durée : 12 passes de la scène (c) avec le préréglage complet : crête de 0,696 à 0,809 selon la phase de la musique, donc réserve réelle sous le genou de 0,68 dB et non 1,1 dB ; toujours 0 échantillon écrêté, coût audio stable (11,0 à 11,7 ms/s). Réserves : (1) les chiffres de pompage (2,3 à 2,6 dB) héritent de la métrique de MIX-03 qui ignore l'étagère ; (2) le préréglage n'a été mesuré qu'avec le duck en étagère : à remesurer avec le duck en gain + tenue de MIX-V1 avant intégration ; (3) dépend de MIX-01 et d'une écoute de 3-prereglage-doom.wav.

**Gain corrigé.** Armes +2 dB absolus et +3 dB relatifs : confirmé. Réserve sous le genou : 0,7 dB sur 6 minutes (et non 1,1 dB sur 30 s).

### MIX-05 — L'annonce du boss est 26 à 29 dB sous la musique dans le mixage ; avec les valeurs de BOSS-04 elle reste 7 à 11 dB dessous
- sévérité haute · catégorie boss · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur et jeu
- lieux : src/audio.js:541-544; src/audio.js:141; src/audio.js:139; src/soundscape.js:5; src/soundscape.js:32; src/soundscape.js:37

**Preuve.** Code :
- src/audio.js:541-544 : bossTell = triangle 92→180 Hz à 0,09, sinus 370→530 Hz à 0,035, bruit à 720 Hz.
- src/soundscape.js:5 et :37 : bossTell absent de ranges, donc portée 36 m ; :32 : niveau = fade² / (1 + 0,018·d).
- src/audio.js:141 : la profondeur du duck est multipliée par le niveau du son.

Mesure sur la scène (d), cinq annonces à 17,1 m (level 0,21) :
- annonce seule : −50,0 à −50,3 dBFS RMS sur 0,52 s, crête 0,012 ;
- musique au même instant : −21,3 à −24,5 dBFS, soit 25,8 à 29,0 dB au-dessus ;
- les autres effets sont 9,1 à 10,2 dB au-dessus.

Avec BOSS-04 (gain ×3, portée 90 m, level 0,50) : annonce à −33,2 dBFS, crête 0,084, encore 7,2 à 11,0 dB sous la musique, au niveau des autres effets (−0,6 dB).

Spectre de la musique : 84 à 88 % de l'énergie sous 250 Hz, moins de 10 % entre 500 Hz et 4 kHz (job=bands).

**Cause.** Trois causes s'additionnent : l'annonce est atténuée comme un bruit du décor (carré de la distance) ; son ton principal (92 à 180 Hz) tombe dans la bande où la musique a les deux tiers de son énergie ; et son duck est proportionnel à son niveau, donc presque nul à 17 m (×0,84, soit −1,5 dB).

**Proposition.** METAL :
- les annonces de boss sont des alertes de jeu, pas des sons du décor : niveau = max(0,6, niveau localisé) tant que le joueur est dans l'arène, panoramique conservé ;
- placer l'énergie des quatre annonces de BOSS-04 entre 500 Hz et 2,5 kHz. Le grondement de 60 à 110 Hz proposé pour l'Écrasement doit être doublé d'une composante dans cette bande, sinon il sera masqué ;
- gain 0,27 à 0,30 comme le propose BOSS-04, bossTell: 90 dans ranges.

FERRO : dans les classes de duck de MIX-03, un champ fixe: true qui ignore cueLevel (src/audio.js:141) pour les alertes, et l'étagère basse pour dégager un éventuel grave.

Critère d'acceptation (job=tell) : RMS de l'annonce sur 0,5 s ≥ RMS de la musique après duck − 3 dB, de 10 à 25 m, pour les quatre familles.

**Gain attendu.** Estimé : de −26/−29 dB à −3 dB ou mieux par rapport à la musique. Le niveau plancher 0,6 apporte +1,6 dB sur BOSS-04, le duck fixe 4 à 7 dB, le déplacement spectral le reste.

**Risques.** - Une annonce trop forte fatigue : garder la limite anti-répétition de 0,25 s (src/audio.js:542) et valider à l'écoute.
- Tests à adapter : checks/audio.test.mjs et checks/soundscape.test.mjs.
- Taille comprise dans les +3 à 6 Ko de BOSS-04.
- Ni la simulation ni les sauvegardes ne sont touchées.

**Vérifier par.** python3 -I run.py "mix.html?job=tell" 200 > out/tell.json : colonnes tellMinusMusicDb et tellMinusAllFxDb par annonce, variantes actuelle et BOSS-04 ; ajouter la variante corrigée dans buildAudio (mix.js).

**Contre-vérification.** Lignes exactes : audio.js:541-544, :139, :141 ; soundscape.js:5 (bossTell absent de ranges), :32 (niveau), :37 (36 m par défaut). Rejoué : annonce à -50,0 / -50,3 dBFS, 25,8 à 29,0 dB sous la musique ; avec BOSS-04, -33,2 dBFS et 7,2 à 11,0 dB dessous. Recoupé à la main : niveau = (1 - 17,12/36)^2 / (1 + 0,018 x 17,12) = 0,210 ; duck = 1 - 0,62 x min(1 ; 0,21 x 1,25) = 0,837 soit -1,5 dB. Réserve : les cinq annonces de la scène sont toutes à 17,12 m (pilote immobile) ; à 5 m le niveau vaut 0,68 (+10 dB), l'annonce reste donc 16 à 19 dB sous la musique : le constat tient à toute distance. Le gain du correctif (-3 dB ou mieux) est estimé, pas rendu : plancher 0,6 = +1,6 dB sur BOSS-04, duck fixe 0,38 = +6,9 dB ; la somme atteint -2,5 à +1,3 dB sans même déplacer le spectre. Le champ fixe:true des classes de duck est utile même sans l'étagère de MIX-03. À faire avec BOSS-04.

### MIX-06 — Polyphonie : aucune voix volée, pic de 14 voix pour un plafond de 32 à 48 ; les recettes longues ajoutent 1 à 2 voix
- sévérité basse · catégorie audio · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P3 · qualité sans objet · moteur et jeu
- lieux : src/audio.js:122-136; src/audio.js:170; src/audio.js:266; src/audio.js:588-593; src/music.js:8

**Preuve.** Code : plafonds 32 / 40 / 48 selon la priorité (src/audio.js:127), 28 voix pour le tracker (src/music.js:8), anti-rafale par nom et direction (src/audio.js:170).

Mesures (stats de FAudio, 30 s par scène) :
- pic de voix : (a) 4, (b) 4, (c) 13, (d) 12 ;
- avec doomish (durées ×1,8 à ×2,9) : 5 / 6 / 14 / 12 ;
- voix volées : 0 dans les 60 rendus ;
- sons sautés par l'anti-rafale : 4 / 1 / 57 / 3 ; les 57 de (c) sont des casses et des chutes de gravats simultanées, c'est voulu.

Le filtre par tir ennemi de FEEL-07 existe déjà : pcm() pose un passe-bas dès que le niveau est sous 0,7 ou que la source est occultée (src/audio.js:266), ce qui est le cas de presque tous les tirs ennemis.

**Cause.** La crainte d'une saturation des voix n'était pas mesurée. La limite d'intervalle par son (effectEvent) plafonne la polyphonie bien avant les plafonds de voix.

**Proposition.** - Ne pas relever les plafonds de voix ni ajouter de logique de vol pour les nouvelles recettes.
- Tirs ennemis de FEEL-07 : ne pas ajouter un second filtre. Passer une coupure maximale par l'événement (event.cutoff = 1100) et l'appliquer dans le filtre existant : filter.frequency = min(event.cutoff, valeur actuelle), en forçant la création du filtre quand cutoff est fourni (src/audio.js:266). Aucun nœud de plus par tir.
- Garder le test de vol de voix de METAL (checks/audio.test.mjs:150).

**Gain attendu.** Aucun travail inutile sur la polyphonie ; un BiquadFilter économisé par tir ennemi par rapport à FEEL-07 (65 tirs en 30 s dans la scène b).

**Risques.** La scène (b) a 6 tireurs ; un combat à 16 ennemis actifs (maximum de la campagne) n'a pas été rendu. L'anti-rafale borne quand même les tirs ennemis à 9 directions × 1 son par 60 ms.

**Vérifier par.** job=matrix : champ voices (peakVoices, stolenVoices, fxSkipped) ; critère stolenVoices = 0 dans (a) à (d).

**Contre-vérification.** Lignes exactes (audio.js:127 plafonds 32/40/48, :170 anti-rafale, :266 passe-bas quand niveau < 0,7 ou occlusion, :588-593 enemyShot par tranche de panoramique, music.js:8). Rejoué : pics 4/4/13/12 (5/6/14/12 doomish), 0 voix volée. Preuve indépendante sur le cas qu'il n'avait pas rendu : scène (b) avec les tirs ennemis triplés et panoramiques décalés (195 tirs ennemis en 30 s, équivalent 18 tireurs) : pic de 6 voix (actuel) et 10 (doomish), 0 voix volée, 22 sons sautés. Borne théorique : 9 tranches x 1 tir par 60 ms, soit 18 voix à 105 ms et 45 à 244 ms ; au-delà de 32, les tirs ennemis sont sautés, jamais volés (priorité 1). La proposition « coupure par l'événement dans le filtre existant » est faisable ; un passe-bas à 1,1 kHz garde le coup grave doomish, mais c'est sans conséquence mesurée (-46 dBFS sous 120 Hz).

### MIX-07 — 62 % de la charge du fil audio vient du graphe au repos : six boucles d'ambiance tournent en permanence à gain nul
- sévérité moyenne · catégorie perf-cpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P3 · qualité visuellement identique · moteur (dans METAL)
- lieux : src/audio.js:294; src/audio.js:347-362; src/audio.js:180-197; src/audio.js:379-397; Jeu/src/moteur/audio.js:519 (Point de rupture); Jeu/src/moteur/audio.js:536 (Point de rupture)

**Preuve.** Code : la vapeur (src/audio.js:347-350), le vent (:351-356) et les quatre moteurs (:358-362, démarrés en :294) sont des sources en boucle créées une fois et jamais arrêtées ; seul leur gain passe à 0. Point de rupture a repris le même schéma (Jeu/src/moteur/audio.js:519 et :536).

Temps de rendu hors ligne par seconde d'audio (48 kHz, sans les prises du banc, minimum de 3, variantes alternées) :
- banc nu : 2,6 ms ;
- graphe FAudio au repos, sans musique ni événement : 24,3 ms (médiane 30,2) ;
- le même sans démarrer les six boucles : 15,4 ms (médiane 15,8) ;
- sans compresseur : 22,8 ms ; sans boucles ni compresseur : 10,6 ms ;
- avec la musique : 34,3 ms ; scène (c) complète : 39,4 ms.

Les boucles coûtent donc 8,9 à 14,4 ms par seconde, soit 37 à 48 % du repos et 23 % de la scène la plus chargée. Les effets eux-mêmes ne pèsent que 2 à 6 ms.

**Cause.** Une source en lecture et son filtre sont calculés même quand le gain qui suit vaut 0 : le navigateur ne coupe le calcul qu'à partir du nœud de gain nul. Les moteurs sont en plus rééchantillonnés de 22 050 Hz au taux du contexte.

**Proposition.** FERRO : endormir chaque boucle quand elle est inaudible.

- Garder filtre, gain et panoramique ; ne créer et démarrer l'AudioBufferSourceNode qu'au moment où la cible de gain devient > 0.
- Démarrage en phase : source.start(now, (now − epoch) % buffer.duration), epoch étant l'instant du premier démarrage. La boucle reprend où elle en serait sans interruption.
- Arrêt : quand la cible est 0 depuis plus de 12 constantes de temps (moteurs 0,66 s, vapeur 0,72 s, vent 0,54 s ; gain résiduel sous −100 dB), source.stop() et disconnect().
- Logique à placer dans updateSteam, updateMachinery et tick, avec une échéance par boucle.

En jeu, au plus un moteur (machineKind), la vapeur et le vent restent actifs selon le lieu.

Critères d'acceptation : job=attrib, repos ≤ 16 ms par seconde ; job=null sur (a) et (c), qui ont des moteurs et du vent, différence ≤ −90 dBFS RMS.

**Gain attendu.** Mesuré par attribution (boucles non démarrées) : −8,9 à −14,4 ms de rendu par seconde d'audio, soit −37 % au repos et environ −23 % sur la scène la plus chargée. Sur un téléphone 3 à 5 fois plus lent, cela écarte d'autant le risque de craquements.

**Risques.** - L'implémentation proposée n'a pas été prototypée : seul le coût des boucles est mesuré. L'identité sonore est à prouver par le test de nullité ; le filtre repart de zéro, mais sous un gain qui monte depuis 0.
- Pour les moteurs à 22 050 Hz, la phase d'interpolation peut différer d'un arrondi.
- Sans option : changement interne de FERRO, à noter dans VERSIONS.md avec la mesure.
- Aucun effet sur la simulation.

**Vérifier par.** python3 -I run.py "mix.html?job=attrib&reps=3" 280 (lignes « repos » et « sans boucles d ambiance ») ; python3 -I run.py "mix.html?job=null&scenes=c,a" 200 avec la variante ajoutée dans buildAudio.

**Contre-vérification.** Code exact : audio.js:294 (moteurs démarrés une fois), :347-362 ; Point de rupture Jeu/src/moteur/audio.js:519 et :536 (même schéma). Remesuré par moi sur machine calme (charge 3,6 au lieu de 33 à 80), contexte à 2 canaux, 5 répétitions alternées : repos 6,94 ms par seconde d'audio (médiane 7,19), boucles non démarrées 3,79 (3,90), sans compresseur 5,84, scène (c) 10,64. Les proportions tiennent (boucles = 45 % du repos, 30 % de la scène c), mais les valeurs absolues annoncées sont 3,5 fois trop hautes : l'économie réelle est de 3,15 ms par seconde, soit 0,3 % d'un coeur ici. Implémentation plus simple, mesurée : laisser la source tourner mais la débrancher du filtre (source.disconnect(filtre) / connect) donne le même gain (3,58 à 3,87 ms/s) sans recréer de noeud ni calculer de phase ; contrepartie : la phase de la boucle n'est plus celle du rendu actuel, donc le test de nullité échouera pour les moteurs (inaudible pour une boucle). Mieux encore pour pause, menu et onglet caché : voir MIX-V4 (ctx.suspend).

**Preuve corrigée.** Repos 6,94 ms/s ; sans boucles 3,79 ; boucles débranchées 3,58 ; sans compresseur 5,84 ; scène (c) 10,64 (minimum de 5, alterné, charge 3,6).

**Gain corrigé.** -3,15 ms de rendu par seconde d'audio (-45 % du repos, -30 % de la scène la plus chargée), soit environ 0,3 % d'un coeur sur ce Mac ; 1 à 1,5 % sur un téléphone 3 à 5 fois plus lent.

### MIX-08 — LOOP-14 : le dédoublonnage strict retire 85 à 89 % des automatisations pour −124 dB de différence ; les seuils proposés au premier tour échouent au test de nullité
- sévérité basse · catégorie audio · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P3 · qualité visuellement identique · moteur (dans METAL)
- lieux : src/audio.js:180-197; src/audio.js:379-397; src/audio.js:475-476

**Preuve.** Code : updateSteam et updateMachinery sont appelés par les setters puis par tick dans la même image (src/audio.js:180-197, :382-383, :475-476) ; tick réémet aussi airFilter, airVolume et echoSend (:393-396).

Test de nullité contre le rendu actuel, scènes (c) et (a) :
- bruit du banc (deux rendus identiques) : −113,9 et −138,5 dBFS crête ;
- dédoublonnage strict (même cible et même constante de temps, les setters ne font que mémoriser) : −88,7 dBFS crête et −124,2 dB RMS en (c) ; −107,5 et −130,8 en (a). Appels AudioParam : 64 475 → 9 481 (−85 %) et 63 479 → 7 100 (−89 %), soit 32 → 3,5 à 4,7 par image ;
- seuils du premier tour (gain 0,003, fréquence 1 %, panoramique 0,01, renvoi à 100 ms) : −65,3 et −68,7 dBFS crête, −91,9 et −95,2 dB RMS, pour 9 022 et 8 285 appels. En (a) c'est plus d'appels que le dédoublonnage strict, à cause du renvoi périodique.

**Cause.** Réémettre setTargetAtTime avec la même cible et la même constante relance une exponentielle identique : c'est un message inutile. Les seuils, eux, laissent le gain à une valeur légèrement fausse (jusqu'à 0,003), ce qui s'entend au test de nullité sans rien économiser de plus.

**Proposition.** FERRO : appliquer LOOP-14 en dédoublonnage strict seulement.

- setMachinery et setSteam mémorisent ; tick fait l'unique mise à jour de l'image.
- Un assistant set(param, valeur, instant, tau) garde par AudioParam la dernière cible et la dernière constante, et n'appelle setTargetAtTime que si l'une des deux change.
- Pas de seuil, pas de renvoi périodique.
- Vider cette mémoire quand un chemin fait cancelScheduledValues ou écrit la valeur directement (setPlaying, setMuted, cancelTestMix : src/audio.js:410, :458, :463, :471).

Le correctif exact est la variante loop14: 'exact' de mix.js (fonction buildAudio).

**Gain attendu.** Mesuré : −85 à −89 % d'appels AudioParam (environ 1 900 → 210 à 280 par seconde à 60 images par seconde), différence de −124 à −131 dB RMS.

**Risques.** - En (c) la crête de la différence (−88,7 dBFS) dépasse de 1,3 dB le critère strict de −90 dB, alors que le RMS est 34 dB en dessous : écart d'arrondi du navigateur entre une exponentielle relancée et une exponentielle continue, inaudible. Retenir un critère en RMS (≤ −110 dB) plus une crête ≤ −80 dBFS.
- Bien invalider la mémoire aux endroits listés, sinon une cible resterait figée après une coupure.
- Tests de METAL sur les automatisations (checks/audio.test.mjs) à relire.

**Vérifier par.** python3 -I run.py "mix.html?job=null&scenes=c,a" 200 > out/null.json : diffPeakDbFS, diffRmsDbFS, audioParamCalls par variante.

**Contre-vérification.** Lignes exactes (audio.js:180-197, :382-383, :393-396, :475-476). Test de nullité rejoué : -88,67 dBFS crête / -124,16 dB RMS en (c), -107,47 / -130,84 en (a) ; 64 475 -> 9 481 et 63 479 -> 7 100 appels ; les seuils du premier tour échouent bien (-65,3 et -68,7 dBFS crête). Mais le gain réel, que personne n'avait mesuré, est négligeable : sur 5 répétitions alternées de la scène (c), le temps de TOUS les appels audio du fil principal passe de 0,010 à 0,006 ms par image, et le fil de rendu de 9,37 à 9,22 ms/s (-1,6 %, dans le bruit). Sur 8 minutes et 998 689 automatisations, le coût par seconde d'audio ne croît pas (pas d'accumulation dans les lignes de temps de Chrome). À faire seulement si on touche déjà ces fonctions ; ne pas le vendre comme un gain de fluidité. Bien vider la mémoire de dédoublonnage en :410, :458, :463, :471 (lignes vérifiées).

**Gain corrigé.** -85 à -89 % d'appels AudioParam, mais seulement -0,004 ms par image sur le fil principal et environ -1,6 % sur le fil audio (non significatif).

### MIX-09 — LOAD-13 : l'ordre et le découpage de la préparation audio ne changent rien, bit à bit
- sévérité basse · catégorie chargement · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité identique · moteur (dans METAL)
- lieux : src/audio.js:24-26; src/audio.js:281-303; src/music.js:194-231

**Preuve.** Code : chaque tampon dérive sa graine de son nom et de sa variante (src/audio.js:24-26) et n'a aucun état partagé ; les instruments et la batterie de la musique ont chacun leur graine (src/music.js:194-201, :227).

Mesure (load13.mjs, sha256) :
- les 64 tampons d'effets à 22 050 Hz sont identiques construits dans l'ordre de warmBank, en ordre inverse ou une variante par tâche : 0 tampon différent ;
- les trois modules sont identiques qu'ils soient préparés par FMusic.warmup en tranches dans l'ordre 0, 1, 2 ou par getModule direct dans l'ordre 2, 1, 0.

**Cause.** Synthèse pure par graine : le résultat ne dépend que du nom, de la variante et du taux.

**Proposition.** Appliquer LOAD-13 sans réserve sur la qualité : lots bornés en temps (8 ms), une variante par tâche pour les effets lourds, moduleFor découpé, ou Worker. Ajouter à FERRO un test Node qui fige ce résultat : sha256 des 64 tampons et des trois modules, comparés entre l'ordre direct et l'ordre inverse.

**Gain attendu.** Aucun risque sonore pour le découpage de LOAD-13 : différence nulle, prouvée.

**Risques.** Un Worker exécute le même moteur JavaScript, donc les mêmes Math.exp et Math.sin : le résultat reste identique sur une même machine. Le test de hachage doit comparer deux constructions dans le même processus, pas une valeur figée, car les fonctions mathématiques peuvent différer d'un navigateur à l'autre.

**Vérifier par.** node load13.mjs <racine METAL> : tamponsDifferents = 0 et modulesIdentiques = true.

**Contre-vérification.** audio.js:24-26 exact (graine dérivée du nom et de la variante, aucun état partagé). load13.mjs rejoué : 64 tampons, 0 différent, 3 modules identiques entre warmup tranché 0,1,2 et getModule direct 2,1,0. Lève le seul doute de qualité sur LOAD-13. Le test à ajouter doit comparer deux constructions dans le même processus (pas un hachage figé), comme il le dit.

### MIX-10 — Musique : boucles de 45 à 77 s, trop courtes pour une démo qui dure ; une variation par graine de +998 octets donne 271 à 461 s sans répétition de 16 mesures
- sévérité moyenne · catégorie démo · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur et jeu
- lieux : src/music.js:112-170; src/music.js:116; src/music.js:161-162; src/music.js:224-234; src/music.js:256; src/music.js:298; src/audio.js:462; src/game.js:145; checks/music.test.mjs:55; checks/music.test.mjs:122

**Preuve.** Code : 6 motifs et 8 positions par morceau (src/music.js:113, :116), soit 76,8 s à 100 bpm, 45,2 s à 170 et 53,0 s à 145 (:234) ; une mesure de batterie par échantillon sur la 4e voie (:161-162) ; game.js:145 ne transmet que le numéro de morceau.

Prototype appliqué à une copie (bench/mix/musicvar/src/music.js) :
- +998 octets de source, 890 sans la ligne de commentaire ;
- 48 positions et 46 motifs, dont 37 à 41 contenus distincts ;
- boucle de 460,8 s / 271,1 s / 317,8 s pour les trois morceaux ;
- sur 12 couples graine/morceau, aucune fenêtre de 4 positions consécutives (16 mesures) ne revient dans la boucle ; une paire de positions revient dans 2 cas, après 248 s et 317 s ;
- 8 graines donnent 8 modules différents par morceau ;
- sans graine, module identique octet pour octet (sha256) et 11/11 tests de checks/music.test.mjs verts ;
- construction d'un module varié : 4,5 ms au minimum, 7,7 ms en médiane ; module +40 960 octets ; aucun échantillon nouveau, donc aucun AudioBuffer de plus.

**Cause.** L'arrangement est une table fixe de 8 positions. Le format M.K. en admet 128 et 64 motifs, et la batterie, qui est un échantillon par mesure, peut être permutée sans toucher aux guitares.

**Proposition.** FERRO (FMusic), sans effet quand la graine est absente :
- compose(stage, samples, seed) : le premier cycle reste l'arrangement actuel, puis 5 cycles de 8 positions. À chaque cycle : échange de deux positions parmi les positions 1 à 5 ; pour chaque position, copie du motif avec, par mesure, un kit de batterie tiré dans la même famille (0, 1, 2 entre eux ; 6 ou 2) et, une fois sur trois hors rupture, la réponse du 3e canal remplacée par un volume 0 ;
- générateur : random((seed|0)·7919 + stage + 1) ;
- moduleFor(stage, seed) avec la clé stage/seed, et éviction du module varié précédent du même morceau ;
- getModule(stage, seed) ; getTrack(stage, seed) avec duration = 46 080/bpm ; setStage(stage, seed) dans le lecteur ; audio.setStage(value, seed) qui transmet.

Le correctif complet, ligne par ligne, est dans bench/mix/musicvar.mjs.

METAL : audio.setStage(world.stage, graine numérique du monde) en démo et en campagne.

Critères d'acceptation : boucle ≥ 240 s aux trois tempos ; aucune fenêtre de 4 positions répétée ; module sans graine identique.

**Gain attendu.** Mesuré : durée sans répétition de 16 mesures de 45-77 s à 271-461 s, pour moins de 1 Ko de source et 4,5 à 7,7 ms par changement de monde.

**Risques.** - Les variations sont audibles par construction : à valider à l'écoute, surtout les passages sans réponse du 3e canal.
- Le test du mode phrygien (checks/music.test.mjs) reste vrai : aucune note n'est transposée.
- Mémoire : un module varié par morceau, 225 à 300 Ko, grâce à l'éviction.
- METAL 0.8.1 (63668ac) a déjà changé music.js de 108 lignes pour la musique d'accueil : reporter le correctif sur cette version.
- Tests à ajouter : durée et non-répétition avec graine.

**Vérifier par.** node musicvar.mjs <racine METAL> > out/musicvar.json (champs defaut[].identique, varie[].repeat4, loopSeconds, sourceBytes.ajout) ; cd musicvar && node --test checks/music.test.mjs.

**Contre-vérification.** Lignes exactes (music.js:113, :116, :161-162, :234, :256, :298 ; game.js:145 ; music.test.mjs:55 et :122). Rejoué : +998 octets, 48 positions, 46 motifs, 37 à 41 contenus distincts, 460,8 / 271,1 / 317,8 s, module par défaut identique, 11/11 tests verts, 3,3 à 7,1 ms. Mais la « non-répétition » n'est vraie qu'en comptant la batterie. Ma mesure par canal (musicperc.mjs) : les guitares (canaux 0 et 1) n'ont toujours que 6 contenus distincts ; en ignorant la batterie, 4 à 13 fenêtres de 16 mesures sur 45 sont des répétitions exactes, la première dès 51 à 192 s ; pour les guitares seules, 16 à 32 fenêtres sur 45, dès 45 à 125 s. L'oreille suit le riff : le gain perçu est donc bien plus faible qu'annoncé. Complément prototypé (MIX-V3, +172 octets) qui varie réellement les riffs sans note nouvelle. Report sur METAL 0.8.1 (63668ac) : l'ancre de la table orders existe encore (1 occurrence), mais getTrack et setStage ont changé (morceau 'title' de 12 positions, music.js:318 et :382) : ces deux remplacements sont à réécrire. C'est la seule pièce de l'axe qui répond à « démo qui dure ».

**Gain corrigé.** Durée de boucle 45-77 s -> 271-461 s (confirmé). Sans répétition de 16 mesures seulement batterie comprise ; hors batterie, première répétition à 51-192 s et 9 à 29 % des fenêtres répétées.

### MIX-11 — FERRO n'a ni test ni banc audio : reprendre le banc de mixage hors ligne et permettre d'injecter le contexte
- sévérité moyenne · catégorie outillage · effort M · gain qualitatif
- contre-vérification : **confirmé**, priorité P1 · qualité sans objet · moteur (dans METAL)
- lieux : src/audio.js:120; src/audio.js:305-312; src/audio.js:313; src/audio.js:319; checks/audio.test.mjs (METAL); banc/index.html (FERRO)

**Preuve.** - FERRO 248043a : checks/ contient motion, music, options et deux tests du renderer ; aucun test de audio.js. Le test audio de METAL (checks/audio.test.mjs, 436 lignes) n'a pas été repris.
- Pour rendre le mixage hors ligne, le banc a dû : remplacer window.AudioContext (src/audio.js:307-310) ; forcer ctx.state à 'running', parce que available() l'exige (:120) alors qu'un OfflineAudioContext est 'suspended' pendant les rappels de suspend ; ajouter deux lignes pour atteindre les nœuds, car limiter et guard sont locaux à initialize() (:313, :319).
- Avec ces trois points, un rendu de 33,5 s prend 1 à 2 s dans Chrome sans interface et se répète à −114 dBFS près.
- Aucune mesure du premier tour ne passait par la chaîne : FEEL-06 mesurait des tampons isolés et FEEL-07 était estimé, d'où un diagnostic faux (MIX-02).

**Cause.** FAudio crée et cache son contexte et ses nœuds : rien ne permet de le brancher sur un contexte hors ligne ni de mesurer ce qui sort de la chaîne.

**Proposition.** FERRO :
1) FAudio.create({context}) : accepte un BaseAudioContext fourni, et available() tient un OfflineAudioContext pour disponible. Sans option, comportement v0.2.
2) api.graph() rend {master, limiter, guard, effects, ambience, musicBus} en lecture, pour les bancs.
3) Reprendre le test audio de METAL dans checks/, sans les parties propres aux armes.
4) Ajouter banc/mixage.html et outils/mixage.py à partir de bench/mix (mix.html, mix.js, run.py, record.mjs), avec les seuils en réussite ou échec : réduction sur tir isolé ≤ 3 dB, 0 échantillon au-dessus de 0,875, pompage ≤ 4 dB, 0 voix volée, test de nullité ≤ −110 dB RMS. Les scènes sont des fichiers de données : chaque jeu enregistre les siennes avec son propre enregistreur.

**Gain attendu.** Toute retouche du son (recettes, chaîne, duck, optimisations dites sans effet) devient vérifiable en moins de deux minutes, pour les trois jeux, au lieu d'être estimée.

**Risques.** - Le banc demande un vrai navigateur : il reste hors de npm test, comme banc/index.html, et le README doit le dire.
- api.graph() expose des nœuds : le documenter comme réservé aux bancs.
- Règle de FERRO : sans option, aucun changement de comportement.

**Vérifier par.** python3 -I run.py "mix.html?job=iso" 240 puis job=matrix, job=null et job=attrib sans aucun remplacement de source dans mix.js : les résultats doivent recouper ceux de bench/mix/out/ (iso.json, matrix-*.json, null.json).

**Contre-vérification.** Vérifié : ~/Projects/ferro n'existe pas ; le clone scratchpad/wf2/ferro/ferro est bien à 248043a, src/audio.js et src/music.js identiques à METAL 673d6b2 (cmp) ; checks/ ne contient que motion, music, options, renderer-destruction, renderer-reprises ; banc/ ne contient que index.html ; checks/audio.test.mjs de METAL fait 436 lignes. available() exige bien ctx.state === 'running' (audio.js:120) et limiter/guard sont locaux (:313, :319). Le banc est rejouable tel quel (toutes mes relances donnent les mêmes valeurs). À corriger en le reprenant dans FERRO : (1) mesurer le duck PAR BANDE par rendu différentiel contre un duck nul (sinon une étagère passe pour 3 dB de pompage alors qu'elle en fait 14 dans le grave) ; (2) crêtes et écrêtage sur au moins 8 passes de scène (la crête varie de 0,62 à 0,70 d'une passe à l'autre) ; (3) ignorer l'attribut reduction pendant les 2 premières secondes ; (4) mesurer les temps sur machine calme, contexte à 2 canaux. Prérequis des critères d'acceptation de MIX-01, MIX-04 et MIX-05.

## Constats ajoutés par le contre-vérificateur

### MIX-V1 — L'ondulation de la musique à la cadence du pistolet se corrige par la tenue seule (0,36 s), sans étagère ni perte de marge
- sévérité moyenne · catégorie audio · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : src/audio.js:139; src/audio.js:143; src/audio.js:146; checks/audio.test.mjs:266

**Preuve.** src/audio.js:143 : tenue = 0,14 s (0,28 s pour les sons forts), plus courte que l'intervalle du pistolet (0,32 s) : la musique remonte et replonge de 5,8 dB trois fois par seconde. L'auteur de MIX-03 a mesuré la variante « curhold » (duck actuel 0,45, tenues 0,36 s pour shot et 0,30 s pour fracture/rocket/grenade) mais ne l'a pas proposée : dans bancs/mix/out/pump.json, scène p, l'ondulation au pistolet passe de 5,80 à 0,95 dB (recettes actuelles) et de 6,28 à 1,42 dB (doomish) ; la marge du pistolet monte de 9,14 à 10,62 dB (p50) et de 8,10 à 9,49 (p10) ; SMG, pompe et roquette inchangés (chute 7,4 à 7,9 dB). Ma mesure par bande (bench/mix-verif/verif.html?job=bandduck) montre qu'à l'inverse l'étagère de MIX-03 retire 2,2 à 4,4 dB de marge dans la bande des tirs actuels et fait pomper le grave de 14 dB.

**Cause.** Une seule tenue pour toutes les armes, plus courte que la cadence du pistolet ; le défaut n'est pas la profondeur du duck mais sa modulation à 3 Hz.

**Proposition.** FERRO : option duck.classes = [{cues, depth, hold}] (défaut = les trois expressions régulières et les tenues 0,14/0,28 de la v0.2, donc comportement identique sans option) ; dans duckMusic, hold = classe.hold. METAL : shot 0,36 s ; fracture, rocket, grenade, grenadeLaunch 0,30 s ; profondeur 0,45 inchangée. Critères (mix.html?job=matrix&scenes=p&ducks=cur,curhold) : ondulation au pistolet <= 1,5 dB ; marge du pistolet >= actuelle ; duckGain < 0,6 x base conservé (tests :266, :352, :372 inchangés).

**Gain attendu.** Ondulation de la musique au pistolet 5,8 -> 0,95 dB ; marge du pistolet +1,4 à +1,5 dB ; aucun changement de timbre de la musique.

**Risques.** La musique reste basse 0,22 s de plus après le dernier tir (retour tau 0,18 s inchangé) : à valider à l'écoute. Aucun effet sur la simulation ni les sauvegardes. Quelques dizaines d'octets.

**Vérifier par.** python3 -I run.py "mix.html?job=matrix&scenes=a,p&comps=cur&ducks=cur,curhold" 250 puis champ pump.perBurst (2e rafale = pistolet) et shots.pistol.transientOverMusicDb.

### MIX-V2 — Le duck de la musique ignore le volume des effets : à 20 % d'effets, la musique plonge toujours de 6,9 dB pour des tirs presque inaudibles
- sévérité moyenne · catégorie audio · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur (dans METAL)
- lieux : src/audio.js:138; src/audio.js:141; src/audio.js:464

**Preuve.** src/audio.js:138 ne coupe le duck que si mix.effects <= 0 ; :141 pondère la profondeur par le niveau du son (cueLevel) mais pas par mix.effects. Mesure (bench/mix-verif/verif.html?job=fxvol, scène p, enveloppe exacte du gain du bus musique) : volume des effets 1 / 0,5 / 0,2 / 0,05 -> duck minimal -6,94 dB dans les quatre cas, alors que les effets tombent de -33,8 à -39,8, -47,8 et -59,8 dBFS RMS (crête 0,375 -> 0,019). Le même code est dans FERRO 248043a (fichier identique par cmp).

**Cause.** La profondeur du duck dépend de la classe et de la distance du son, jamais du réglage de volume du joueur. Un joueur qui baisse les effets pour écouter la musique l'entend se creuser sans raison ; un mode démo qui baisse les effets aura le même défaut.

**Proposition.** FERRO, audio.js:141 : strength = 1 - (1 - strength) x min(1, cueLevel x 1,25) x min(1, mix.effects). À effectsVolume = 1 (défaut, options.js:6) le résultat est identique bit à bit ; en dessous le duck devient proportionnel (0,5 -> -3,0 dB ; 0,2 -> -1,0 dB). Ajouter un test dans checks/audio.test.mjs : setMix({effects: .2}) puis shot -> duckGain > 0,85 x base ; effects 1 -> duckGain < 0,6 x base (test :266 inchangé).

**Gain attendu.** Musique stable quand les effets sont baissés : duck de -6,9 dB ramené à -1,0 dB à 20 % d'effets ; aucun changement au réglage par défaut.

**Risques.** Aucun au défaut. Les tests :352 et :372 (duckGain < 0,56) tournent à effects = 1 : à vérifier. Point de rupture a sa propre copie : à reporter via FERRO.

**Vérifier par.** python3 -I run.py "verif.html?job=fxvol" 120 dans bench/mix-verif : colonne duckMinDb, qui doit suivre effectsVolume après correctif et rester à -6,94 pour 1.

### MIX-V3 — Démo qui dure : la variation de MIX-10 ne change que la batterie ; permuter les mesures des guitares (+172 octets) donne de vrais riffs variés sans note nouvelle
- sévérité moyenne · catégorie démo · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : src/music.js:112-170; src/music.js:116; src/music.js:298; src/game.js:145

**Preuve.** Analyse par canal du module varié de MIX-10 (bench/mix-verif/musicperc.mjs, 9 couples graine/morceau) : canaux 0-1 (guitares) = 6 contenus distincts comme aujourd'hui ; en ignorant la batterie, 4 à 13 fenêtres de 16 mesures sur 45 se répètent à l'identique, la première entre 51 et 192 s. Prototype ajouté à la copie (bench/mix-verif/musicvar2/src/music.js, une ligne, +172 octets) : dans la boucle de variation, pour les motifs 1 à 4 et une fois sur deux, échange de deux mesures (blocs de 16 lignes) sur les canaux 0 à 2, batterie laissée en place. Résultat (musicperc2.mjs) : 12 à 19 contenus de guitare distincts, 17 à 25 contenus distincts hors batterie, 0 à 2 fenêtres répétées sur 45 (première à 132 s au plus tôt, aucune dans 5 cas sur 9) ; aucune période de note nouvelle (24/23/22 périodes avant et après, donc le test du mode phrygien reste vrai) ; module sans graine identique (sha256) ; 11/11 tests de checks/music.test.mjs verts.

**Cause.** MIX-10 mesure la non-répétition sur les octets du motif entier : un seul kit de batterie changé suffit à rendre deux motifs « différents », alors que l'oreille suit le riff, qui n'a que 6 formes.

**Proposition.** FERRO (FMusic), à ajouter au correctif de MIX-10, dans la boucle « for(const b of o) » : if(b&&b<5&&pick(2)){const x=pick(4),y=(x+1+pick(3))%4; échanger pour r de 0 à 15 et k de 0 à 11 les octets q[(x*16+r)*16+k] et q[(y*16+r)*16+k];}. Les motifs 0 (impact d'ouverture) et 5 (relance, avec le silence de la ligne 63) ne sont pas touchés. METAL, pour la démo : audio.setStage(world.stage, graine du monde) et changer de morceau à chaque monde de démo (3 morceaux, plus le thème d'accueil de la 0.8.1) pour qu'aucun riff ne tourne plus de 5 à 8 minutes. Critère d'acceptation : sur 12 couples graine/morceau, au moins 12 contenus distincts sur les canaux 0-1 et au plus 2 fenêtres de 4 positions répétées hors batterie ; module sans graine identique ; aucune période nouvelle.

**Gain attendu.** Contenus de guitare distincts 6 -> 12 à 19 ; fenêtres de 16 mesures répétées hors batterie 4-13 sur 45 -> 0-2 sur 45 ; +172 octets.

**Risques.** Musical : une mesure déplacée peut couper une note tenue autrement ; à valider à l'écoute sur les trois morceaux (aucun extrait rendu). Aucune note hors mode. Même réserve que MIX-10 pour le report sur METAL 0.8.1. Simulation et sauvegardes non touchées.

**Vérifier par.** node musicvar.mjs <racine METAL> puis appliquer la ligne à musicvar/src/music.js ; node musicperc2.mjs (colonnes ch01, ch012_rep4) ; cd musicvar2 && node --test checks/music.test.mjs.

### MIX-V4 — Démo qui dure : le mixage tient 8 minutes sans dérive, mais il manque un état audio « démo » et la mise en veille du contexte (menu, pause, onglet caché)
- sévérité moyenne · catégorie démo · effort M · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · moteur et jeu
- lieux : src/game.js:71; src/game.js:838; src/audio.js:120; src/audio.js:371-376; src/audio.js:464; src/music.js:290; Jeu/src/son.js:412-430 (Point de rupture)

**Preuve.** Tenue dans la durée, mesurée (bench/mix-verif/verif.html?job=long) : scène (c) rejouée 16 fois, 483 s d'audio, 998 689 automatisations : coût par seconde d'audio sans tendance (13,0 puis 9,7 à 11,8 ms/s minute par minute), 0 voix restante, 0 voix volée, pic 13, tas JS constant ; idem avec le préréglage Doom sur 6 minutes (11,0 à 11,7 ms/s). Rien à corriger côté fuite. En revanche : (1) src/game.js:71 coupe le son par setMuted dans les modes menu, paused, options, shop, loading, et ni audio.js ni game.js n'appellent jamais ctx.suspend() (grep) : le graphe continue de tourner à vide, 6,94 ms par seconde d'audio mesurés au repos (MIX-07), y compris onglet caché (game.js:838 ne fait que passer en pause) ; (2) aucun mode « demo » n'existe dans METAL 0.8.0 ni 0.8.1 (grep : 0) : un mode démo ajouté sans retoucher la liste de game.js:71 sera soit muet, soit au niveau de combat complet pendant des heures ; (3) avant le premier geste du joueur le contexte est 'suspended' : available() (audio.js:120) et FMusic.tick (music.js:290) ne font rien, la démo sera muette, ce qui est correct mais doit être voulu ; (4) Point de rupture a déjà cet état : Jeu/src/son.js:422-424, son.ecran('demo') = ambiances actives + thème du titre.

**Cause.** L'audio n'a que deux états, « joue » et « muet », et le contexte n'est jamais suspendu. Une démo longue a besoin d'un troisième état (musique au premier plan, effets en retrait) et d'un arrêt réel quand personne n'écoute.

**Proposition.** FERRO : (a) audio.setIdle(bool) : quand le son est coupé sans préécoute depuis 1,5 s, ctx.suspend() ; ctx.resume() dès setIdle(false), start() ou testMix() ; sans appel, comportement v0.2 ; (b) correctif MIX-V2 pour que baisser les effets baisse aussi le duck. METAL : mode 'demo' hors de la liste muette de game.js:71 ; à l'entrée en démo, audio.setMix({master, music, effects: effectsVolume x 0,4, ambience}) (-8 dB) et morceau varié par graine (MIX-10 + MIX-V3) ; à la sortie, mixage du joueur restauré ; ne jamais créer le contexte pour la démo sans geste (pas d'audio.start() automatique) ; visibilitychange caché : démo en pause et setIdle(true). Critères : onglet caché ou menu depuis 2 s -> ctx.state === 'suspended' ; retour -> 'running' en moins de 100 ms et musique qui reprend sans resynchronisation (stats.resyncs inchangé) ; verif.html?job=long avec le mixage démo : coût stable et 0 voix restante sur 8 minutes.

**Gain attendu.** Fil audio à 0 au lieu de 6,9 ms par seconde d'audio en menu, pause et onglet caché (mesuré au repos, estimé une fois suspendu) ; démo écoutable longtemps : effets 8 dB plus bas, duck réduit en proportion.

**Risques.** ctx.resume() est asynchrone : un son demandé dans les premières millisecondes du retour peut être perdu (available() exige 'running') ; rejouer le jingle de reprise après la promesse. Safari iOS passe par l'état 'interrupted' (déjà géré en audio.js:374). Tests audio de METAL sur setMuted à compléter. Le niveau -8 dB est un choix à valider à l'écoute.

**Vérifier par.** python3 -I run.py "verif.html?job=long&n=16&scene=c" 200 dans bench/mix-verif (marks[].msPerS, stats.voices) ; test Node avec AudioContext factice : setIdle(true) + 1,5 s -> suspend appelé une fois, setIdle(false) -> resume.
