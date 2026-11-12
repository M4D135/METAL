# Axe ARCHI — ARCHI

Écrit quand un dépôt FERRO séparé était encore prévu : lire « FERRO » comme « modules moteur de METAL ». Contre-vérifié.

## Résumé

Axe ARCHI, mené en lecture seule. Les essais ont été faits sur des copies. Préfixes utilisés dans les preuves :
- ferro/ = ~/Projects/ferro@248043a (= v0.2 = origin/main) ;
- metal/ = le dépôt METAL. Malgré son nom, c'est un clone de github.com/M4D135/METAL à 673d6b2 ;
- bitume/ = ~/Projects/bitume@39b3214, plus une copie de travail non commitée ;
- pdr/ = ~/Projects/point-de-rupture@5ac0066 ;
- essais/ = bancs/../wf2/archi.

CONSTAT
- FERRO 0.2 se compose de cinq modules extraits de METAL.
- Seul le renderer est vraiment partagé (BITUME et PDR le copient). PDR porte aussi l'audio et la musique. FMotion et FOptions ne servent qu'à METAL.
- FERRO n'a ni boucle, ni entrées (pas de manette), ni mesure de temps, ni navigation, ni hasard commun. BITUME et PDR ont déjà réécrit ces briques chacun de leur côté : boucle 1/120 et manette de BITUME, travailleur et champs de flux de PDR, mulberry32 recopié dans 9 fichiers.
- Le renderer alloue de la mémoire à chaque image.
- Son gouverneur de résolution ne réagit pas entre 40 et 54 images/s.
- Le test de compatibilité compare les appels GL bruts. Il bloque donc les optimisations invisibles : le tampon persistant échoue au rang 157, une forme inutilisée au rang 113.
- J'ai prototypé une trace sémantique. Elle laisse passer ces deux changements et détecte toujours un déplacement de 1 cm.

PLAN
- 0.3 Mesure et cadence : trace, FProfile, FLoop.
- 0.4 Rendu fluide.
- 0.5 Commandes : FInput, FOptions.schema.
- 0.6 Son : test d'empreintes, FAudio.define, FSynth, FMixer.
- 0.7 Navigation : FNav.
- 0.8 Accroches : BITUME et PDR sans fourche.
- 0.9 Image : seulement si David la retient.
- 1.0 : le contenu de METAL sort de FERRO.

Pour chaque version : FERRO d'abord, puis METAL par copie directe. BITUME et PDR adoptent dans leurs propres sessions ; rien n'est écrit chez eux.

Les demandes de David sont réparties en ARCHI-16 :
- bouclier et mouvement façon Quake : dans METAL, sans code GPL ;
- sons, manette, fluidité : FERRO et METAL ;
- DLSS : décision à prendre (ARCHI-17).

ÉTAT AU 2026-11-12, APRÈS 17 H 50
- La session BITUME ajoute en ce moment trois retouches à son renderer (wedge, cockpit, peinture).
- L'origin/main local de PDR est passé de 28d1d7c à 5ac0066 pendant la journée.

## Faits

- **ARCHI-F01** (vérifié, contre-vérification : confirmé) FERRO main = 248043a = origin/main = étiquette v0.2. Étiquettes annotées : metal-0.6→c863bd4, metal-0.8→ff8ac68, metal-4ce2271→213b99c, v0.1→affd6ab. — _~/Projects/ferro@248043a_ **Correction :** Cet état ne vaut que pour 18:29. Depuis 18:35, ~/Projects/ferro n'existe plus (ls à 18:35 et à 18:52 ; find sous /Users/david, profondeur 5 : aucun recolte.py). Toutes mes vérifications portent sur cv/ferro = bancs/../wf2/archi-cv/ferro, cloné de l'original à 18:29 (248043a, mêmes étiquettes). Voir ARCHI-V1.
- **ARCHI-F02** (vérifié, contre-vérification : confirmé) Les cinq modules de FERRO v0.1 sont identiques octet pour octet à ceux de METAL 673d6b2. De v0.1 à v0.2, seul src/renderer.js change parmi les modules. Son rendu de secours ne change que par FOV_MIN (Math.max(40,…) devient Math.max(FOV_MIN,…)). — _~/Projects/ferro (v0.1 affd6ab, v0.2 248043a) ; metal/@673d6b2_ **Correction :** Le rendu de secours change sur DEUX lignes, toutes deux du type Math.max(40,…) → Math.max(FOV_MIN,…) : renderer.js:1072 (draw, hunk @@ -1012 +1072 @@) et :1317 (actorFilter, hunk @@ -1257 +1317 @@). Les deux sont dans createSoftware (905-1333).
- **ARCHI-F03** (vérifié, contre-vérification : confirmé) npm test sur un clone de FERRO 248043a donne 44 tests verts. Il n'y a aucun test audio : package.json:7 ne lance que motion, music, options, renderer-destruction et renderer-reprises. — _bancs/../wf2/archi/ferro_ **Correction :** Ce « 44 verts » suppose les étiquettes. Dans un clone sans étiquettes, 2 tests sont ignorés et npm test sort quand même avec le code 0 (ARCHI-V2).
- **ARCHI-F04** (vérifié, contre-vérification : confirmé) Le test de reprise compare la suite brute des appels GL entre git show v0.1:src/renderer.js et le fichier courant. Avec la même image, deux variantes échouent : un tampon persistant (capacité doublée + bufferSubData) au rang 157, l'ajout d'une forme inutilisée (wedge) au rang 113. — _bancs/../wf2/archi_
- **ARCHI-F05** (vérifié, contre-vérification : confirmé) Le prototype de trace sémantique enregistre 107 entrées, dont 69 dessins.
- Aucune différence pour v0.1↔v0.2, v0.2↔tampon persistant, v0.2↔wedge et v0.1↔tampon.
- Un déplacement de 1 cm est détecté au rang 4.
- Appels encore ignorés : clearColor, depthFunc, drawBuffers, polygonOffset, readBuffer, texParameteri. — _bancs/../wf2/archi/trace-semantique.mjs_
- **ARCHI-F06** (vérifié, contre-vérification : confirmé) Le renderer n'active aucune extension (0 getExtension). Il fait 11 bufferData et 0 bufferSubData, et ses cibles sont en RGBA8. Le contexte est créé par getContext('webgl2',{alpha:false,antialias:false,depth:true,powerPreference:'high-performance'}). — _~/Projects/ferro/src/renderer.js@248043a_
- **ARCHI-F07** (vérifié, contre-vérification : confirmé) pack() alloue un Float32Array(count×16) et un tableau littéral de 16 valeurs par maillage. Elle tourne à chaque image : lot dynamique en :1724, premier plan en :1761. La ligne :1729 re-spécifie le tampon dynamique par bufferData à chaque image. Format d'une instance : position xyz, matière, échelle xyz, émissif, rotation xyz, drapeaux (premier plan 1, dehors 2, objet 4), rgb, hasColor. — _~/Projects/ferro/src/renderer.js@248043a_
- **ARCHI-F08** (vérifié, contre-vérification : réfuté) Le code contredit la documentation de METAL : docs/ARCHITECTURE.md:242 annonce des « buffers persistants », alors que le renderer réalloue le stockage du lot dynamique à chaque image. — _metal/@673d6b2 ; ferro/@248043a_ **Correction :** Il n'y a pas de contradiction démontrée. Le fait vrai est que le STOCKAGE du lot dynamique est re-spécifié par bufferData à chaque image (:1729), c'est-à-dire l'orphelinage classique. La doc ne le nie pas. Ce n'est pas une raison suffisante pour passer à bufferSubData (voir ARCHI-06).
- **ARCHI-F09** (vérifié, contre-vérification : confirmé) Le gouverneur de résolution :
- n'agit que si quality vaut 'auto' et fx.adaptive===true ;
- suit une moyenne exponentielle de constante 0,65 s ;
- baisse l'échelle de 0,1 (plancher 0,65) après 1,3 s au-dessus de 25 ms ;
- la remonte de 0,05 après 5 s sous 18,5 ms ;
- attend 2 s entre deux changements.
Plafond automatique : 1,8 Mpx. Entre 18,5 et 25 ms, soit 40 à 54 images/s, il ne fait rien. — _~/Projects/ferro/src/renderer.js@248043a_
- **ARCHI-F10** (vérifié, contre-vérification : confirmé) Le rendu de secours createSoftware pèse environ 32 647 octets, soit 27 % des 120 863 octets du renderer. Il n'a ni setNappes ni setLots. BITUME et PDR refusent de tourner sans backend webgl2. — _ferro/@248043a ; bitume/@39b3214 ; pdr/@5ac0066_ **Correction :** createSoftware (renderer.js:905-1333) pèse 32 232 octets, soit 26,7 %. En ajoutant ses aides propres, softwareSky et skyColor (:865-904) et softwareDistance (:793-795), le code réservé au secours fait 35 845 octets, soit 29,7 % des 120 863 octets.
- **ARCHI-F11** (vérifié, contre-vérification : confirmé) Le renderer de FERRO contient des chemins propres à METAL :
- formes codées en dur (:621) ;
- horrorLights pour fx.horror (:796) ;
- actorPart et actorScale (:1156, :1297) ;
- lumière ajoutée au premier plan, pensée pour l'arme (:399 light+=vec3(.18,.22,.25)) ;
- premier plan exclu des ombres (:135) ;
- matières codées en branches GLSL, environ 10 tests m<… dont :324.
API publiée : :1785 {setWorld,updateWorld,draw,resize,dispose,stats,actorFilter,setNappes,setLots} ; :1787 window.FRender={create,foliageTriangles}. — _~/Projects/ferro/src/renderer.js@248043a_ **Correction :** - Il y a 26 tests « m< » pour 17 seuils distincts (m<.5 à m<17.5), et non « environ 10 ».
- actorPart et actorScale (:1156, :1297) ne servent que dans createSoftware, pas dans le chemin WebGL2.
- Le global est posé sur window (:1787), pas sur globalThis.
- **ARCHI-F12** (vérifié, contre-vérification : réfuté) FAudio expose 65 membres publics.
- 10 sont des services : start, resume, prepare, setMuted, setMix, stats, tick, testMix, cancelTestMix, dispose.
- 55 sont des déclencheurs de METAL : shot, rocket, shieldBash, bossRoar, liftStart, trophy…
L'en-tête dit « METAL: original procedural audio ». Le module dépend de window.FMusic. synthesize(name, variant, sampleRate) est déterministe (LCG à graine). Le contexte est créé sans option. Bus maître : compresseur-limiteur et WaveShaper ; aucune réverbération (aucun createConvolver). — _~/Projects/ferro/src/audio.js@248043a_ **Correction :** - Il n'y a pas de ConvolverNode, mais il y a un retour de salle : envoi 0,065, retard 117 ms, passe-bas 1 450 Hz, rétroaction 0,14 (audio.js:330-338), modulé par l'extérieur (:396).
- Les 65 membres se répartissent en 10 services, 7 réglages d'état (setThreat, setPressure, setStage, setPlaying, setEnvironment, setMachinery, setSteam) et 48 déclencheurs.
- **ARCHI-F13** (vérifié, contre-vérification : confirmé) FMusic contient les trois morceaux de METAL (SONGS :10, compose :112) et un noyau générique : serialize :171, decode :186, warmup :208, create(ctx,output) :235, export :313.
FMotion garde damp interne à create() (:32-35) et des impulsions de FPS (shot, pistol, rocket, melee, :36-46) ; export :86.
FOptions code en dur les actions de METAL (:4) ; export :36. — _~/Projects/ferro@248043a_
- **ARCHI-F14** (vérifié, contre-vérification : confirmé) La boucle de METAL est à pas variable :
- dt borné à 0,12 s, puis ceil(dt×60) sous-pas égaux, sans interpolation ;
- 0 occurrence de « gamepad » dans game.js ;
- requestPointerLock appelé sans option.
Stockage :
- réglages sous la clé générique 'ferro-settings' ;
- sauvegarde 'ferro-expedition-v2', limitée à 2,2 Mo. — _metal/@673d6b2_
- **ARCHI-F15** (vérifié, contre-vérification : confirmé) Navigation de METAL :
- seaux de sol de 8 m et ground() (:123-137) ;
- blocked (:242), ray (:474), segmentFree (:1349) ;
- pumpNav(768) (:1379) ; nearestNode, 7×7 essais (:1392) ;
- route : A* en 4 connexités, tas de tableaux, 2 400 nœuds au plus, segmentFree paresseux, fil tiré sur 14 nœuds (:1402-1433) ;
- routeBudget = advanced ? 2 : Infinity (:1742). — _metal/@673d6b2_
- **ARCHI-F16** (vérifié, contre-vérification : confirmé) La documentation de METAL dit :
- « Il n'existe pas d'entrée de saut libre » ; profil Survie : marche 5,4, course 7,6, accélération 30, freinage 42, contrôle aérien 2,2 ;
- les principes de Quake III ont été consultés, « aucun code GPL n'a été repris » ;
- A* sur grille de 0,8 m, deux recherches par sous-pas.
L'AGENTS.md de FERRO n'a aucune règle sur la GPL. PDR n'a pas d'AGENTS.md. — _metal/@673d6b2 ; ferro/@248043a ; pdr/@5ac0066_
- **ARCHI-F17** (vérifié, contre-vérification : confirmé) Le build de METAL joint 14 modules (renderer, world, destruction, music, audio, soundscape, economy, brain, simulation, motion, actors, effects…) en un seul script. Budget : moins de 1 400 000. SIZE.json : 789 111 octets (gzip 238 558). — _metal/@673d6b2_
- **ARCHI-F18** (vérifié, contre-vérification : confirmé) BITUME à 39b3214 :
- DT = 1/120 ; accumulateur limité à 14 pas ; alpha = clamp(S.acc/DT,0,1) ;
- manette lue à chaque image : zone morte axiale 0,12, exposant 1,6, gâchettes b(7)/b(6) ;
- stockage sous try/catch.
Feuille de route :
- 1,5 ms GPU par image ; banc p50/p95 ;
- manette 0,07 / 1,3 ;
- comportement identique à 30, 60 et 120 Hz ;
- résultats découpés à 4 ms (28 800 pas d'un bloc aujourd'hui) ;
- réglages bornés ; vibration possible. — _~/Projects/bitume@39b3214_ **Correction :** Le contexte de :79 est faux. « 1,5 ms GPU au plus par image rafraîchie » est le budget des RÉTROVISEURS (vue 512×128, 110°, 30/10 Hz, FEUILLE-DE-ROUTE.md:76-80), pas celui de l'image. La cible d'image de BITUME est p95 ≤ 16,7 ms et pire image ≤ 29 ms en 1390×1295 sur le Mac (:83-86).
- **ARCHI-F19** (vérifié, contre-vérification : confirmé) PDR à 5ac0066 :
- simulation dans un travailleur, à 20 itérations/s ;
- navigation « ni window ni document », grilles de 2 et 4 m en mm, Dial 10/14, cache par but et par version ;
- foule sur GPU, jusqu'à 262 144 unités interpolées entre deux états ;
- lots écrits à la main au format de pack (DRAPEAUX_OBJET = 6, creerLot) ;
- amortir : copie de damp ;
- réglages à la manière de FOptions.
Budget : 3 000 000 octets ; SIZE.json : 1 265 540. — _~/Projects/point-de-rupture@5ac0066_
- **ARCHI-F20** (vérifié, contre-vérification : réfuté) mulberry32 est recopié dans au moins 9 fichiers. Les suites sont identiques sur 6 graines × 10 000 tirages. Vecteur de test : mulberry32(96) → 0,0621094990 ; 0,0957705327 ; 0,2783730279. BITUME a aussi hache, bruit de valeur et fbm. — _metal/@673d6b2 ; bitume/@39b3214 ; pdr/@5ac0066 ; essais/_ **Correction :** Les deux autres copies diffèrent :
- metal world.js:26-35 tire mulberry32(FNV-1a(`${seed}:${stage}`)) ;
- pdr sim/monde.js:141-148 tire mulberry32 en entier u32 à partir de graine ^ 0x9E3779B9.
Les deux se ramènent exactement au cœur commun (cv/prng/test2.mjs : vrai, vrai). Ainsi, « identiques sur 6 graines × 10 000 » n'est vrai que pour 7 copies sur 9.
- **ARCHI-F21** (vérifié, contre-vérification : confirmé) outils/recolte.py :
- appelle git show et rev-parse sans --no-optional-locks ;
- lit le jeu à son HEAD, sauf avec --copie-de-travail ;
- ne donne que des tailles en mode portage ;
- compare au HEAD de FERRO.
jeux/jeux.json:8 envoie METAL vers ~/Projects/metal, qui n'existe pas : la récolte répond « dossier absent ». — _~/Projects/ferro@248043a_
- **ARCHI-F22** (vérifié, contre-vérification : confirmé) Récolte d'essai du 2026-11-12, sur copies.
- PDR 28d1d7c : renderer à +322/−36 depuis metal-0.6, 34 lignes marquées, 13 conflits contre v0.2 (8 à la récolte 0.2).
- BITUME 39b3214 : 5 conflits, tous couverts par le côté FERRO.
Après résolution :
- BITUME ne diffère de v0.2 que de 10 lignes : 4 d'en-tête, plus vignettage 0,84 et bloom 0,86-0,98, déjà réglables à la création ;
- PDR garde +121/−2 (voile, PDR_GLSL, accroches). — _bancs/../wf2/archi_
- **ARCHI-F23** (vérifié, contre-vérification : confirmé) PROVENANCE.md de PDR compte 17 retouches du renderer, dont :
- n°7 : fx.msaa === false ;
- n°14 : voile du brouillard ;
- n°15 : PDR_GLSL, PDR_INDOOR, PDR_UNIFORMS ;
- n°16 : fx.lots versionnés ;
- n°17 : fx.foule = {ombre, couleur}.
VERSIONS.md:29 de FERRO les classe comme non reprises. — _pdr/@5ac0066 ; ferro/@248043a_
- **ARCHI-F24** (vérifié, contre-vérification : confirmé) BITUME a une copie de travail non commitée sur 39b3214 : 10 fichiers, 853 ajouts et 274 suppressions. Elle grossissait pendant la lecture (665 ajouts quelques minutes plus tôt). src/moteur/renderer.js y reçoit 3 retouches marquées, notées n°7-9 dans PROVENANCE.md :
- forme wedge ;
- premier plan éclairé comme le monde et recevant les ombres ;
- matière 17 en peinture satinée (rugosité .46, métal .04).
Un worktree .claude/worktrees/wf_654723d2-ff3-1 est sur physique/conduite (e3bcb6b). — _~/Projects/bitume (copie de travail sur 39b3214)_ **Correction :** La copie de travail a encore grossi : à 18:31, 11 fichiers, +892/−293 (git --no-optional-locks diff --stat).
- **ARCHI-F25** (vérifié, contre-vérification : confirmé) PDR est à 5ac0066 (« Retire la partie Unreal : le jeu passe entièrement sur FERRO », 17 h 50), qui est désormais l'origin/main local. À ma première lecture, origin était à 28d1d7c. Jeu/ est identique entre 28d1d7c et 5ac0066. — _~/Projects/point-de-rupture@5ac0066_ **Correction :** Nouveau depuis 18:12, copie de travail propre :
- branche wip-ferro-02 (66687b2, « passage à FERRO v0.2, interrompu… non vérifié ») : renderer.js porté sur v0.2, à +197/−6 de v0.2, plus decor.js et jeu.js ;
- branche v03-feu-sim (588e8ad) ;
- 5 worktrees dans le scratchpad d'une autre session.
- **ARCHI-F26** (vérifié, contre-vérification : confirmé) Le banc de FERRO n'affiche que des compteurs, aucun temps. — _~/Projects/ferro@248043a_
- **ARCHI-F27** (vérifié, contre-vérification : confirmé) VERSIONS.md :
- l'entrée 0.2 n'a pas de table sha256 ;
- procédure de passage : options {msaa:4, shadowMapScale:2, vignette:.84, bloomThreshold:[.86,.98]}, 5 conflits pour BITUME, 8 pour PDR ;
- limites de la 0.1 : audio = recettes de METAL, renderer = chemins de METAL, aucun test GPU. — _~/Projects/ferro@248043a_
- **ARCHI-F28** (vérifié, contre-vérification : confirmé) Règles de FERRO :
- scripts autonomes chargés avant le code du jeu ;
- cycle Prendre, Retoucher, Récolter, Trier, Publier ;
- entre ce qui sert à deux jeux au moins ou est générique ; accroches sans effet pour les autres ;
- rien de propre à un seul jeu ;
- compatibilité exacte avec la version précédente ;
- pas de modules ES ;
- la récolte ne modifie pas les jeux ;
- npm test et VERSIONS.md à chaque version ; étiquettes jamais déplacées. — _~/Projects/ferro@248043a_ **Correction :** AGENTS.md:10 dit « se comportent exactement comme dans la version précédente ». La formule « mêmes commandes GPU » vient de VERSIONS.md:9.
- **ARCHI-F29** (probable, contre-vérification : plausible) Constats de l'audit METAL 0.8, repris tels quels :
- pas moyen de 0,85 à 1,45 ms ;
- pointes de 40 à 56 ms dues à route/segmentFree ;
- ground() = 47,7 % du CPU de simulation ;
- pas variable sans interpolation ;
- aucune manette ;
- tampons dynamiques réalloués à chaque image. — _audit METAL 0.8 (autre axe), non refait ici_
- **ARCHI-F30** (probable, contre-vérification : plausible) Chrome de bureau (ANGLE) expose EXT_disjoint_timer_query_webgl2, qui donne des temps GPU par passe. Safari ne l'expose pas. — _à confirmer au banc sur david-pc_
- **ARCHI-F31** (probable, contre-vérification : plausible) API Gamepad :
- mapping « standard » : gâchettes = boutons analogiques 6/7, 4 axes ;
- les manettes n'apparaissent qu'après un appui ;
- vibrationActuator.playEffect('dual-rumble') existe sous Chromium.
Autres :
- requestPointerLock({unadjustedMovement:true}) donne une souris brute sous Chromium ;
- KHR_parallel_shader_compile permet d'interroger la compilation sans bloquer ;
- localStorage dispose d'environ 5 Mo par origine. — _spécifications publiques, sans date de consultation_
- **ARCHI-F32** (incertain, contre-vérification : plausible) Une page web n'a pas accès à DLSS, version « 5 » comprise : ni WebGL2 ni WebGPU n'exposent les API NVIDIA. Il faut une application native. — _à confirmer par l'axe NVIDIA (recherche web datée)_
- **ARCHI-F33** (incertain, contre-vérification : plausible) navigator.keyboard.getLayoutMap() pourrait être absent hors Chromium et dans un iframe d'une autre origine. Le minuteur GPU est probablement absent sous Safari. — _à vérifier dans le navigateur cible_

## Propositions

### ARCHI-01 — Carte des sous-systèmes : déjà dans FERRO, à faire entrer, propre au jeu
- type exigence · priorité P0 · effort S · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** La règle d'entrée existe : deux jeux au moins ou générique, accroches sans effet pour les autres, rien de propre à un seul jeu. Pourtant FERRO 0.2 contient encore le contenu de METAL. Il ne contient pas non plus les briques que BITUME et PDR ont déjà réécrites chacun de leur côté. Sans carte, Codex risque de verser dans FERRO du code de METAL (bouclier, mouvement, recettes). Il risque aussi de laisser dans METAL ce qui sert déjà ailleurs.

**Preuve.** ferro/README.md:49, ferro/AGENTS.md:8, ferro/VERSIONS.md:63-65@248043a
ferro/jeux/jeux.json : renderer copié par BITUME et PDR ; audio et musique portés par PDR
metal/tools/build.py:6@673d6b2
bitume/src/jeu.js:5, :189-197, :744-751@39b3214
pdr/Jeu/src/sim/nav.js:1-14, Jeu/src/camera.js:12, Jeu/src/interface/reglages.js:1-21@5ac0066
essais/prng.mjs

**Proposition.** DÉJÀ DANS FERRO 0.2
- FRender : WebGL2 + secours Canvas 2D.
- FAudio : service + recettes de METAL.
- FMusic : lecteur + 3 morceaux de METAL.
- FMotion, FOptions.
- Outillage : outils/recolte.py, checks/renderer-reprises, banc/.
Partage réel : le renderer (copié par BITUME et PDR), l'audio et la musique (portés par PDR). FMotion et FOptions ne servent qu'à METAL.

À FAIRE ENTRER (deux jeux au moins, ou générique)
- FLoop : BITUME, PDR, METAL.
- FProfile : générique ; BITUME le demande.
- FInput : BITUME a son lecteur, METAL n'en a aucun.
- FOptions.schema : PDR, METAL, BITUME.
- Renderer sans allocation et format d'instance déclaré : PDR écrit déjà ce format à la main.
- Accroches du renderer : PDR et BITUME.
- FAudio.define, FSynth, FMixer, noyau de FMusic : PDR et BITUME ont leur propre chaîne.
- FNav : METAL et PDR.
- FRandom et FNoise : 9 copies.
- FStore : 3 jeux.
- FMotion.damp exporté : METAL et PDR.
- Registre FERRO.
- FSpace : à décider (ARCHI-12).

RESTE AU JEU
METAL :
- simulation.js : collisions, armes, bouclier, déplacements. Sa grille de navigation passe à FNav.
- world.js : génération des niveaux. Seul randomFor passe à FRandom.
- destruction.js : règles de fracture. Le rendu des débris est déjà dans FRender (checks/renderer-destruction).
- brain.js et actors.js : IA, mobs, boss. Ils consommeront FNav et FLoop.
- effects.js : contenu. packEffects est déjà dans FERRO.
- economy.js.
- game.js : flux du jeu. Boucle :675-690 vers FLoop, écouteurs :792-838 vers FInput, sauvegarde :8/:34/:87 vers FStore.
- soundscape.js : ambiance, qui passera par FMixer.
BITUME : conduite, voiture, circuits, course, décor.
PDR : règles du RTS, protocole, travailleur, foule GPU, voile, ville réelle, interface.

À SORTIR DE FERRO EN 1.0 (dedans aujourd'hui, mais propre à METAL)
- Recettes et 55 déclencheurs (audio.js:11, :440-726).
- 3 morceaux (music.js:10-112).
- Actions (options.js:4).
- Impulsions du FPS (motion.js:36-46).
- fx.horror (renderer.js:796).
- actorPart et actorScale (:1156, :1297).
- Lumière et ombres du premier plan pensées pour l'arme (:399, :135).
En 1.0, ce contenu passe dans des fichiers de METAL chargés avant game.js. D'ici là il reste en place, pour ne casser aucun jeu v0.2.

**Critère d'acceptation.** La carte figure dans README.md de FERRO, section « Ce qui entre ». Chaque ligne « à faire entrer » cite deux jeux, ou justifie le caractère générique. Pendant la campagne, aucune ligne propre à METAL (bouclier, mouvement, recettes) n'est ajoutée à FERRO. Tout ajout absent de la carte est refusé en revue.

**Risques.** Trop faire entrer alourdit les trois pages : budgets 1,4 Mo, 1,4 Mo et 3 Mo. Sortir le contenu de METAL avant 1.0 casserait les jeux v0.2.

**Contre-vérification.** Carte juste dans l'ensemble. Les budgets 1,4 / 1,4 / 3 Mo sont confirmés : metal build.py:12, bitume construire.py:33, pdr construire.py:58.

**Correction.** 1) PDR n'a pas « porté » l'audio et la musique : il les a réécrits (README.md:34 ; jeux.json:24-25, mode « portage » ; 77 340 et 59 249 octets). Le partage est d'architecture, pas de code.
2) FNav n'a qu'un client certain, METAL. Au sens de README.md:49, il entre comme brique générique, ou mieux par récolte de pdr Jeu/src/sim/nav.js.
3) Ajouter à « à faire entrer » deux pièces déjà écrites chez PDR : l'hôte de travailleur hote.js (ARCHI-V3) et l'écrivain de lots (decor.js:79-125).
4) FMotion.damp doit garder la forme mutante de PDR (camera.js:12-14).

### ARCHI-02 — Contrat de compatibilité : trace sémantique des dessins au lieu du journal GL brut, plus un banc de pixels
- type exigence · priorité P0 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** AGENTS.md:10 et VERSIONS.md:9 promettent « les mêmes commandes GPU ». Le test compare la suite brute des appels GL. Il refuse donc, à image égale, un tampon persistant (rang 157) et une forme ajoutée mais inutilisée (rang 113). Ce sont précisément les optimisations (ARCHI-06) et les accroches (ARCHI-07) demandées. Le prototype de trace sémantique les accepte et détecte toujours un déplacement de 1 cm (rang 4).

**Preuve.** ferro/AGENTS.md:10, ferro/VERSIONS.md:9, ferro/checks/renderer-reprises.test.mjs:24-74@248043a
essais/v02-tampon.js, essais/v02-coin.js
essais/trace-semantique.mjs (107 enregistrements, 69 dessins, 0 différence)

**Proposition.** 1) checks/trace.mjs : un outil de test, pas un module. Il reprend gpu() et play() du test actuel. Pour chaque drawArrays ou drawElements (instancié ou non), il enregistre :
- le rôle du programme : empreinte FNV-1a du source lié ;
- l'état : blend et blendFunc, depth test/func/mask, cull, colorMask, viewport, scissor, polygonOffset ;
- la cible : formats des attachements ;
- les uniformes : valeurs arrondies à 1e-6 ;
- les textures de chaque unité : empreinte du contenu chargé et paramètres ;
- les sommets réellement lus : empreinte par attribut des indices utilisés ;
- les instances [first, first+count).
Il ajoute clear, clearColor, clearDepth, depthFunc, drawBuffers, readBuffer et texParameteri, encore ignorés par le prototype. Il ignore beginQuery et endQuery (ARCHI-04).
2) Nouvelle phrase d'AGENTS.md:10 : « sans réglage, une version produit la même trace sémantique que la précédente sur les scènes de référence ». Le journal brut reste affiché, sans faire échouer le test.
3) Trois scènes de référence, synthétiques, sans code des jeux :
- METAL : play() actuel ;
- BITUME : options de VERSIONS.md:33-36 ;
- PDR : setLots et fx.msaa=false.
4) Banc de pixels facultatif sur david-pc :
- banc/pixels.html, ouvert en file://, sans serveur ;
- rendu des trois scènes en 1280×720, puis readPixels ;
- PSNR ≥ 45 dB contre l'image de la version précédente (seuil à caler au premier passage, estimation).
5) Un changement d'image voulu passe par une option. Un changement de défaut attend 1.0 et s'annonce dans VERSIONS.md.

**Critère d'acceptation.** - Trace identique v0.1↔v0.2 sur les trois scènes.
- v02-tampon.js et defineShape passent.
- 5 mutations sur 5 détectées : déplacement de 1 cm, couleur de 1/255, uniforme, état de mélange, paramètre de texture.
- Test en moins de 2 s sous Node (estimation).

**Risques.** - Une trace égale reste stricte : deux dessins qui commutent mais changent d'ordre sont signalés à tort. C'est l'erreur du côté sûr.
- Tout changement du source d'un shader change la trace. C'est voulu : il faut alors le banc de pixels.
- Changement de doctrine : David doit valider la nouvelle phrase d'AGENTS.md.

**Contre-vérification.** Diagnostic confirmé (F04 et F05 rejoués). Mais la proposition se contredit : programmes identifiés par l'empreinte de leur source, et en même temps « trace identique v0.1↔v0.2 ». Le shader du monde a changé en 0.2 ; avec cette identité, la trace diverge au rang 2 (cv/trace-source.mjs).

**Correction.** - Nommer les programmes par rôle déclaré, ou par ordre de création comme le prototype.
- Garder un contrat séparé pour les sources GLSL, comme le test actuel :77-85 (liste des shaders dont le changement est permis), plus le banc de pixels.
- La scène « PDR » emploie fx.msaa=false, absent de v0.2 : elle dépend d'ARCHI-07.
- Pour une optimisation invisible, exiger des pixels égaux (écart maximal 0) plutôt qu'un PSNR ≥ 45 dB.
- Reprendre l'idée du banc de PDR (Jeu/verifications/rendu.test.mjs, cité par VERSIONS.md:66-67).

### ARCHI-03 — FLoop : pas fixe, interpolation et tâches découpées
- type proposition · priorité P0 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** METAL avance d'un pas variable sans interpolation. Le rendu montre donc des états à intervalles irréguliers : c'est une cause directe du « gameplay raide ». BITUME a déjà la bonne boucle (1/120 s, 14 pas au plus, alpha). Il veut aussi le même comportement à 30, 60 et 120 Hz et des tâches découpées à 4 ms. PDR interpole sa foule entre deux états. Au moins deux jeux en ont besoin : la brique entre dans FERRO.

**Preuve.** metal/src/game.js:675-690@673d6b2 ; audit METAL 0.8
bitume/src/jeu.js:5, :744-751@39b3214 ; bitume/FEUILLE-DE-ROUTE.md:189, :246
pdr/Jeu/src/foule.js:1, Jeu/src/sim/travailleur.js:3@5ac0066

**Proposition.** Fichier src/loop.js, global FLoop, motif (function(G){…})(typeof window!=='undefined'?window:globalThis). Rien ne démarre au chargement.

API :
- const loop = FLoop.create({hz:120, maxSteps:14, fpsLimit:0, pauseWhenHidden:true, profile:null, now, raf}) ; now et raf sont injectables pour les tests ;
- loop.onStep(fn(dt)) : dt constant = 1/hz ;
- loop.onFrame(fn(alpha, frameDt)) : alpha dans [0,1) ;
- loop.start(), loop.stop() ;
- loop.advance(secondes) : synchrone, pour les tests et le rejeu ;
- loop.later(générateur, {budgetMs:4}) → Promise : tâche coopérative découpée ;
- loop.stats() → {steps, dropped, frameMs, alpha} ;
- FLoop.lerp, FLoop.lerpAngle.

Règles :
- 14 pas = 0,117 s, l'équivalent des plafonds de METAL et de BITUME. Au-delà, le temps de jeu ralentit (dropped++) au lieu de spiraler.
- Onglet caché : l'accumulateur est remis à zéro.
- Les angles de visée s'appliquent à l'image, sans interpolation ni latence ajoutée.
- Les positions s'interpolent entre l'état précédent et l'état courant.

METAL :
- 120 Hz visé si le pas moyen reste ≤ 1 ms après les corrections de l'audit. À 120 Hz, le coût passe à 1,7-2,9 ms par image de 16,7 ms (estimation).
- Sinon, 60 Hz avec interpolation. On tranche au banc.

**Critère d'acceptation.** Tests Node à horloge injectée :
- 10 s d'images à intervalles aléatoires de 4 à 40 ms → 1200 ± 1 pas à 120 Hz ;
- advance(60) → exactement 7200 pas ;
- une image de 500 ms → au plus 14 pas, et dropped est compté ;
- alpha toujours dans [0,1) ;
- later() sur 28 800 pas (le cas de BITUME) ne dépasse jamais 4 ms par image et se termine.
Dans METAL : même état après 600 pas joués à 30, 60 et 144 Hz d'affichage, avec les mêmes entrées.

**Risques.** - METAL doit garder l'état précédent de tout ce qui est dessiné.
- La visée risque d'être appliquée deux fois si le jeu interpole aussi la caméra.
- Le ressenti des armes et du mouvement sera à retoucher.
- 120 Hz double le coût de simulation.

**Contre-vérification.** La brique a deux clients prouvés : BITUME (jeu.js:744-751) et la foule interpolée de PDR. Elle peut entrer. La simulation de METAL n'appelle pas Math.random : l'acceptation est faisable sous conditions.

**Correction.** Réfuté : « cause directe du gameplay raide ».
- METAL simule exactement le temps écoulé à chaque image (game.js:677, :690). L'image montre l'état à l'instant de l'image, sans saccade d'échantillonnage.
- Un pas fixe apporte le déterminisme et l'égalité 30/60/144 Hz, pas de fluidité visible. Interpolé, il retarde les positions d'au plus un pas.
- La raideur tient plutôt au profil de mouvement : accélération 30, freinage 42, pas de saut, contrôle aérien 2,2 (ARCHITECTURE.md:78).
Risque oublié : FBrain est asynchrone (WebNN, brain.js:2, :63 ; simulation.js:1480-1502). « Même état à 30, 60 et 144 Hz » exige aiAcceleration:'cpu', ou des avis appliqués après un nombre fixe de pas (ARCHI-V4).

### ARCHI-04 — FProfile : mesurer CPU et GPU par section, et caler le gouverneur sur une cible réelle
- type proposition · priorité P0 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Sans mesure, aucune demande de fluidité n'est vérifiable.
- Le banc n'affiche que des compteurs.
- Le renderer n'active aucune extension : il n'y a donc aucun temps GPU.
- BITUME vise 1,5 ms GPU et un banc p50/p95.
- Le gouverneur ne réagit qu'au-delà de 25 ms et ne remonte que sous 18,5 ms. Entre 40 et 54 images/s, il ne fait rien, alors que la cible est 60 Hz ou plus.

**Preuve.** ferro/banc/index.html, ferro/src/renderer.js:806-824, :1545 (0 getExtension)@248043a
bitume/FEUILLE-DE-ROUTE.md:79, :84@39b3214

**Proposition.** Fichier src/profile.js, global FProfile.
- const p = FProfile.create({frames:600, gl}).
- p.begin('sim') et p.end('sim') : temps CPU par performance.now.
- p.count('route') : compteur.
- p.gpuBegin('shadows') et p.gpuEnd('shadows') : passent par EXT_disjoint_timer_query_webgl2 si elle est présente, sinon ne font rien. Les requêtes sont recyclées et lues 2 à 3 images plus tard. Un résultat est écarté si GPU_DISJOINT_EXT est levé.
- p.frame() clôt l'image.
- p.report() → {frames, cpu:{sim:{p50,p95,p99,max}}, gpu|null, long:nombre d'images > 33 ms}.
- p.overlay(element) affiche une surcouche texte ; c'est le jeu qui choisit la touche.
- FProfile.none : profil vide, sans coût.

Renderer : avec FRender.create(canvas,{profile:p}), il mesure ombres, opaques, transparents, post et bloom. Sans l'option, il n'ajoute aucun appel.

Gouverneur : FRender.create(…,{frameBudgetMs:16.7}) vise un p95 ≤ budget. Il utilise le temps GPU s'il existe, sinon le temps d'image. Sans l'option, les seuils restent 25 et 18,5 ms (compatibilité). METAL et BITUME passent l'option.

banc/ affiche p50, p95 et p99, et exporte un JSON au format du banc de BITUME.

**Critère d'acceptation.** - Moins de 0,05 ms par image avec 20 sections (banc Node).
- Sans l'option profile, aucun appel GL n'est ajouté et la trace est identique.
- Centiles exacts à 1 % près sur données synthétiques.
- Temps GPU présents sous Chrome de bureau sur david-pc (NVIDIA), et null ailleurs sans erreur.
- Scène METAL avec frameBudgetMs 16,7 : p95 ≤ 16,7 ms une fois l'échelle stabilisée.

**Risques.** - Le minuteur GPU varie selon le navigateur : probable sous Chrome, absent sous Safari (incertain).
- performance.now est arrondi par les navigateurs : on agrège en centiles.
- Un gouverneur trop nerveux fait varier la netteté : garder le délai de 2 s.

**Contre-vérification.** Utile et faisable. Le constat (0 extension, banc sans temps, bande morte du gouverneur) est confirmé.

**Correction.** 1) Les 1,5 ms GPU de BITUME visent les rétroviseurs (FEUILLE-DE-ROUTE.md:76-80). La cible d'image est p95 ≤ 16,7 ms et pire ≤ 29 ms (:85).
2) Avec la synchro verticale, le temps d'image se quantifie à 16,7 ms ou 33,3 ms. Un gouverneur qui vise « p95 ≤ 16,7 » sur le temps présenté oscillera. Viser plutôt le temps GPU ou CPU ≤ 0,8 × budget, en gardant l'hystérésis et le délai de 2 s.
3) Les requêtes TIME_ELAPSED ne s'imbriquent pas : gpuBegin doit refuser l'imbrication.
4) Hors isolation d'origine, performance.now est arrondi à 0,1 ms ou plus : une section plus courte ne se lit qu'en agrégat.

### ARCHI-05 — FInput : clavier, souris brute, tactile et manette en un seul état
- type proposition · priorité P0 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** David : « on doit pouvoir jouer au gamepad ».
- METAL n'a aucune gestion de manette, et son pointer lock est sans option.
- BITUME a écrit son propre lecteur (zone morte axiale 0,12, exposant 1,6). Il vise 0,07 et 1,3, plus la vibration.
- PDR a besoin du pointeur, du clavier et, plus tard, d'un curseur à la manette.
Trois lecteurs séparés finiraient par diverger.

**Preuve.** metal/src/game.js:159 et 0 occurrence de « gamepad »@673d6b2
bitume/src/jeu.js:189-197@39b3214 ; bitume/FEUILLE-DE-ROUTE.md:123, :323
demande (1) de David

**Proposition.** Fichier src/input.js, global FInput. Rien n'écoute avant create().

API :
- FInput.create(element, {deadzone:.12, edge:.98, curve:1.6, shape:'radial'|'axial', trigger:{press:.5, release:.4}, rawMouse:true, schema}).
- input.poll(now), une fois par image : lit navigator.getGamepads(), le clavier et la souris.
- input.consume(), une fois par pas fixe : {held, pressed, released} par action. Un appui bref entre deux pas n'est jamais perdu ni compté deux fois.
- input.action(nom) → {down, pressed, released, value}.
- input.stick(nom) → {x, y}, après zone morte et courbe.
- input.look() : souris brute {dx, dy} et stick {x, y} séparés, pour régler deux sensibilités distinctes.
- input.device() → 'keyboard', 'gamepad' ou 'touch' : le dernier appareil utilisé.
- input.prompt(action) → libellé : 'Clic gauche', 'RT' ou 'R2'.
- input.rumble({strong:.6, weak:.3, ms:120}) : vibrationActuator 'dual-rumble' si présent, sinon rien.
- input.lock() : requestPointerLock({unadjustedMovement:true}), avec repli sans option. input.unlock(), input.dispose().

Zone morte radiale : m = |v| ; si m < dz, la sortie vaut 0 ; sinon v/m × courbe((min(m,edge)−dz)/(edge−dz)).
Un mapping non standard est signalé, et les indices du W3C restent utilisés. L'aide à la visée reste dans le jeu. poll() ne crée aucun objet en régime établi.

**Critère d'acceptation.** Tests Node avec un getGamepads simulé :
- (0,1 ; 0,1) → (0,0) ;
- magnitude ≤ 1 en diagonale ;
- gâchette à 0,45 après 0,55 : toujours appuyée ; à 0,39 : relâchée ;
- appui-relâche entre deux pas de 8,33 ms : pressed une seule fois ;
- {shape:'axial', deadzone:.12, curve:1.6} reproduit au bit près la direction de BITUME.
Essai manuel : METAL jouable de bout en bout à la manette (déplacement, visée, tir, armes, bouclier, menus), sous Chrome sur david-pc, avec une manette Xbox et une DualSense.

**Risques.** - Le mapping diffère selon le navigateur et l'OS.
- Vibration et souris brute sont probablement réservées à Chromium.
- Une manette reste invisible avant un premier appui : afficher un message.
- Lecture en double si un jeu garde son ancien lecteur.

**Contre-vérification.** Bien fondé : METAL n'a aucune manette, BITUME a son propre lecteur. PDR n'a aucune manette (0 occurrence) : le « curseur à la manette » de PDR est une hypothèse.

**Correction.** 1) La parité au bit près avec BITUME exige edge:1. BITUME divise par (1 − zone morte) (jeu.js:195) ; le défaut edge .98 change toute sortie au-delà de 0,98.
2) « Un appui bref n'est jamais perdu » ne vaut que pour le clavier, la souris et le tactile, qui arrivent par événements. Les boutons de manette sont lus une fois par image : un appui-relâche entre deux lectures est perdu.
3) En artefact, prévoir un repli si le verrou du pointeur, la manette ou getLayoutMap sont refusés (ARCHI-V5).

### ARCHI-06 — Renderer sans allocation par image : écrivain d'instances, tampons persistants, format déclaré, compilation préparée
- type proposition · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Le renderer gaspille à chaque image :
- pack() alloue un Float32Array et un tableau de 16 valeurs par maillage, pour le lot dynamique et le premier plan ;
- bufferData réalloue le stockage (11 bufferData, 0 bufferSubData), alors que METAL documente des buffers persistants.
Le format d'instance est une API de fait, non déclarée : PDR l'écrit déjà à la main. Faute de KHR_parallel_shader_compile, la compilation bloque au premier dessin.

**Preuve.** ferro/src/renderer.js:621, :738-756, :1724, :1729, :1761@248043a
metal/docs/ARCHITECTURE.md:242@673d6b2
pdr/Jeu/src/decor.js:44, :79-125@5ac0066
essais/v02-tampon.js

**Proposition.** 1) FRender.INSTANCE, gelé, documente le format actuel : {floats:16, position:0, material:3, scale:4, emissive:7, rotation:8, flags:11, color:12, hasColor:15, OVERLAY:1, OUTDOOR:2, OBJECT:4}.
2) FRender.SHAPES, gelé : ['box','sphere','cylinder','octa','ring','bevel','foliage']. FRender.defineShape arrive avec cette version (ARCHI-07).
3) Écrivain réutilisable : FRender.writer(capacité) → {reset(), push(mesh), view()}. pack() écrit directement ses champs dans un Float32Array persistant dont la capacité double, sans tableau littéral.
4) Tampons GPU persistants. Le remplacement est déjà essayé dans v02-tampon.js :
if(!(buf.cap>=need)){buf.cap=Math.max(need,(buf.cap||0)*2);gl.bufferData(gl.ARRAY_BUFFER,buf.cap,gl.DYNAMIC_DRAW);} gl.bufferSubData(gl.ARRAY_BUFFER,0,values)
5) renderer.prepare() → Promise, résolue quand les programmes sont liés. Elle passe par KHR_parallel_shader_compile si l'extension existe, sinon elle se résout tout de suite. Les jeux l'appellent derrière l'écran de chargement.

**Critère d'acceptation.** - Trace sémantique identique à v0.2 sur les trois scènes.
- En régime établi, draw() ne crée aucun Float32Array (constructeur espionné) et n'appelle plus bufferData, seulement bufferSubData.
- METAL, 5 min du scénario de l'audit : aucune image de plus de 33 ms due au ramasse-miettes (FProfile et profil Chrome). Gain non chiffré tant que FProfile n'a rien mesuré.

**Risques.** - bufferSubData sur un tampon encore lu peut faire attendre certains pilotes : passer à deux tampons alternés si FProfile le montre.
- La capacité doublée peut prendre jusqu'à 2× la mémoire du lot.
- Ce code est celui des lots de PDR : il y aura plus de conflits à la prochaine récolte de PDR tant qu'ARCHI-07 n'est pas livré.

**Contre-vérification.** Les allocations par image et le format d'instance de fait sont confirmés. PDR écrit déjà ce format à la main (decor.js:44, :79-84).

**Correction.** 1) La compilation ne bloque pas « au premier dessin » mais dans create(). initialize() (:1462, et :1772 après perte du contexte) compile et lie 5 programmes, puis lit aussitôt COMPILE_STATUS et LINK_STATUS (:1369-1377, :1434). prepare() oblige à différer ces lectures, donc à changer l'ordre des appels et la trace.
2) bufferSubData n'est pas un gain garanti face à l'orphelinage par bufferData : il peut attendre un tampon encore lu. Le gain sûr est de supprimer les allocations JS : Float32Array persistant, puis bufferData ou bufferSubData avec srcOffset et longueur. Ensuite, mesurer.
3) L'acceptation ne vérifie que Float32Array, alors que draw() alloue bien d'autres objets : :1719, :1723, :1725, packEffects, fermeture d'actorFilter. Titre à réduire ou mesure du tas.
4) Récolter l'écrivain de PDR.
5) Ajouter une version à fx.instances (:1732).

### ARCHI-07 — Accroches du renderer pour que BITUME et PDR n'aient plus de fourche
- type proposition · priorité P1 · effort L · jeux FERRO, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Faute d'accroches, chaque besoin d'un jeu devient une fourche.
- PDR porte 17 retouches du renderer. Après fusion il reste +121/−2 lignes, et les conflits sont passés de 8 à 13.
- BITUME n'avait plus que 10 lignes d'écart. Sa session en ajoute trois en ce moment : wedge ; cockpit éclairé comme le monde et ombré (FERRO l'éclaire et l'exclut des ombres pour l'arme d'un FPS) ; matière 17 satinée.
README.md:49 exige des accroches sans effet pour les jeux qui ne s'en servent pas.

**Preuve.** pdr/Jeu/src/moteur/PROVENANCE.md:24, :35, :38, :42, :45@5ac0066
ferro/VERSIONS.md:29, :36 ; ferro/src/renderer.js:135, :324, :399, :621, :633-634@248043a
essais/recolte-2026-11-12/RAPPORT.md, essais/pdr-reste.diff, essais/bitume-resolu.js
bitume/src/moteur/renderer.js : diff non commité du 2026-11-12

**Proposition.** Tout est facultatif. Sans option, le comportement et la trace sont ceux de v0.2.
- FRender.defineShape(name, {positions, normals, indices}), avant create. Le nouvel index suit les 7 formes, qui gardent les index 0-6. Livré en 0.4.
- create(…, {overlay:{light:[.18,.22,.25], shadows:false}}) : valeurs par défaut de METAL. BITUME passe {light:[0,0,0], shadows:true}.
- create(…, {materials:{17:{roughness:.46, metalness:.04, base:'color', grain:.05}}}) : table de matières surchargeable, compilée en branches GLSL. Le source ne change pas si l'option est absente.
- create(…, {extension:{glsl:{common, material, light}, uniforms:{name:()=>value}}}) : injection à des marqueurs fixes (// FERRO:common…). Remplace PDR_GLSL, PDR_INDOOR et PDR_UNIFORMS. Une erreur de compilation est levée avec le nom du marqueur.
- fx.passes = [{name, at:'after-opaque'|'before-post'|'before-vignette', shadow(gl,ctx), color(gl,ctx)}], avec ctx = {view, proj, viewProj, invViewProj, light, depthTexture, colorTarget, width, height, time}. La foule de PDR devient shadow et color en 'after-opaque', à la place de renderer.gl et renderer.pdr. Le voile devient une passe 'before-vignette', écrite chez PDR.
- setLots(name, view, version) : lots versionnés. fx.lots reste comme alias déprécié.
- fx.msaa === false : repris tel quel.
- renderer.features → {backend, msaa, floatTargets, timer, parallelCompile} ; FRender.version.

**Critère d'acceptation.** - La copie de BITUME devient identique octet pour octet à FERRO, avec 0 ligne marquée : wedge, premier plan et peinture passent par des options.
- La copie de PDR n'a plus aucune ligne marquée. Voile, PDR_GLSL et foule vivent dans des fichiers de PDR.
- La trace PDR est identique entre la fourche et FERRO + accroches, hors appels faits par le jeu dans ses accroches.
- Jeux v0.2 sans option : trace identique.

**Risques.** - Chaque accroche fige un morceau d'interne (matrices, cible de profondeur, marqueurs GLSL), qui devient un contrat.
- L'injection GLSL peut casser un shader sans bruit.
- Ce sont les sessions de BITUME et de PDR qui migrent, pas Codex (ARCHI-15).

**Contre-vérification.** Bonne direction : les fourches sont réelles (PDR 17 retouches, BITUME 3 de plus en cours).

**Correction.** 1) ctx.depthTexture n'existe pas : la profondeur de scène est un renderbuffer (:1393) ou un renderbuffer MSAA (:1404). L'exposer demande une texture de profondeur, plus une résolution si MSAA : coût et contrat nouveaux.
2) Le modèle existe déjà chez PDR : fx.foule, avec objets réutilisés et état GL rétabli (PROVENANCE.md:45-52). PDR y ajoute renderer.pdr.generation, programme() et lier() pour recompiler après perte du contexte. Sans compteur de génération et rappel « contexte rétabli », PDR ne peut pas migrer.
3) defineShape : indices Uint16, donc 65 536 sommets au plus pour toutes les formes (:703, :1560). La géométrie basse (:929) et le secours (:1297) doivent connaître la forme.
4) FERRO n'a jamais eu fx.lots : parler d'alias de migration, pas d'alias qui « reste ».
5) Partir de wip-ferro-02 (66687b2), déjà porté sur v0.2.
6) Prévoir le rendu d'une vue dans une cible pour les rétroviseurs de BITUME (FEUILLE-DE-ROUTE.md:76-80).

### ARCHI-08 — FOptions.schema : commandes et réglages déclarés par le jeu, manette comprise
- type proposition · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** FOptions code en dur les actions de METAL. Son filtre allowed exclut Control, Meta et Escape. PDR a réécrit le même principe, avec groupes et rangs. BITUME veut des réglages bornés champ par champ, et FInput a besoin de codes de manette. Enfin, METAL range ses réglages sous la clé générique 'ferro-settings' : deux jeux FERRO servis depuis la même origine se les écraseraient.

**Preuve.** ferro/src/options.js:4, :36@248043a
pdr/Jeu/src/interface/reglages.js:1-21@5ac0066
bitume/FEUILLE-DE-ROUTE.md:257@39b3214
metal/src/game.js:8, :34@673d6b2

**Proposition.** Création : FOptions.schema({version:1, storageKey, actions, settings, contexts}). Exemples :
- actions : {forward:{group:'move', keys:['KeyW','ArrowUp'], pad:['LS-Up'], rank:0}, …} ;
- settings : {sensitivity:{type:'number', min:.1, max:5, step:.05, default:1}, rumble:{type:'bool', default:true}} ;
- contexts : {play:[…], menu:['confirm','back']}.
Méthodes : defaults(), normalize(raw) (bornes, types, migration de version), assign(state, action, code, slot), conflicts(state, context), label(code, device), matches(state, action, code).
Codes :
- clavier : e.code ;
- souris : Mouse0-4, WheelUp, WheelDown ;
- manette : Pad0-16, alias A B X Y LB RB LT RT Back Start LS RS Up Down Left Right Home ;
- axes : LS-Up, RS-Left…
label() se sert de getLayoutMap s'il existe, sinon de e.key.
window.FOptions et ses 7 membres actuels restent inchangés.

**Critère d'acceptation.** - checks/options.test.mjs reste inchangé et vert.
- Nouveaux tests : bornes, types, migration v0→v1, conflits par contexte, libellés clavier, Xbox et PlayStation.
- Test de parité dans FERRO : les réglages de PDR (reglages.js:1-21) s'expriment en schéma sans changer une valeur par défaut.

**Risques.** - Deux API cohabitent jusqu'en 1.0.
- Les libellés AZERTY (getLayoutMap) restent incertains hors Chromium.

**Contre-vérification.** Constat confirmé : options.js:4 fixe les actions, :5 le filtre allowed, :36 l'export. PDR a réécrit le même principe (reglages.js:1-6).

**Correction.** 1) La collision de clés est théorique. BITUME écrit sous 'bitume.*' (jeu.js:23-25) et PDR sous 'pdr.reglages', versionné (reglages.js:39). Seul METAL utilise des clés « ferro- ».
2) defaults() code aussi en dur les réglages de METAL (:6 : difficulty, aiAcceleration, crt, crosshairScale…), pas seulement les actions.
3) allowed() exclut aussi Alt, le pavé numérique, la ponctuation et la souris.

### ARCHI-09 — Son : test d'empreintes, puis FAudio.define, FSynth, FMixer et noyau de FMusic
- type proposition · priorité P1 · effort L · jeux FERRO, METAL, PDR, BITUME
- contre-vérification : **plausible**

**Pourquoi.** David : « bruitages de fusils pas assez ressemblants… faut du bruit genre doom… pas assez vif ».
- FAudio mélange service (10 membres) et contenu de METAL (55 déclencheurs).
- Il n'a pas de réverbération.
- FERRO n'a aucun test audio, et celui de METAL charge 11 modules du jeu.
- Atout : synthesize() est déterministe, donc testable sous Node sans AudioContext.
- PDR a son compresseur (−19 dB, genou 18, ratio 5, 4/180 ms). BITUME a son limiteur et tire son bruit avec Math.random.

**Preuve.** ferro/src/audio.js:1, :11, :20, :24-26, :307-319, :440-726@248043a
ferro/package.json:7
ferro/src/music.js:10-112, :171-235, :313
metal/checks/audio.test.mjs
pdr/Jeu/src/moteur/PROVENANCE-SON.md@5ac0066
bitume/src/son.js

**Proposition.** Version 0.6, dans cet ordre.
1) checks/audio.test.mjs : empreinte FNV-1a des tampons de synthesize(), pour chaque nom d'effectNames, chaque variante, à 44,1 et 48 kHz. Plus le graphe de nœuds enregistré sur un AudioContext simulé, pour start, setMix et testMix. C'est le contrat sonore.
2) FAudio.define(name, recipe) : une recette du jeu remplace ou complète l'intégrée. Sans define(), les empreintes ne bougent pas. METAL met ses nouvelles armes dans src/son-armes.js, sans toucher audio.js.
3) FSynth.render(recipe, {sampleRate, seed}) → Float32Array. Pur, déterministe (FRandom), utilisable dans un travailleur.
Couches : {type:'noise'|'osc'|'fm', env:{a,d,s,r}, filter:{type,f,q,env}, pitch:{from,to,curve}, drive, gain}.
4) FMixer.create(ctx, {…}) :
- buses {sfx, music, voice, ui} ;
- compressor {threshold:-19, knee:18, ratio:5, attack:.004, release:.18} ;
- limiter {ceiling:-1} ;
- reverb {seconds:1.6, decay:3, seed}.
Méthodes :
- play(buffer, {bus, gain, rate, pan, position, priority, group}) ;
- duck(bus, dB, ms) ;
- voices({max:40, steal:'oldest-quietest'}) ;
- setMix(), testMix().
Réverbération : ConvolverNode sur une réponse impulsionnelle calculée par FSynth, sans fichier.
5) FMusic.create(ctx, output, {songs}) : sans songs, les 3 morceaux de METAL. FMusic.tracker = {serialize, decode, warmup}.

Le son « genre Doom » reste du contenu de METAL (ARCHI-16). Point de départ, à régler à l'oreille (hypothèse) :
- attaque de 0 à 2 ms ;
- corps de bruit filtré 80-200 Hz, à hauteur tombante ;
- saturation ;
- queue envoyée à la réverbération ;
- musique baissée de 6 dB pendant 120 ms à chaque tir.

**Critère d'acceptation.** - Sans define(), empreintes de synthesize() identiques entre 0.5 et 0.6.
- FSynth : même graine → tampon identique au bit près sous Node et en navigateur.
- Rendu d'un effet de 0,5 s à 48 kHz en moins de 2 ms (estimation à mesurer).
- FMixer sur OfflineAudioContext (david-pc) : jamais plus de 40 voix ; baisse de −6 ± 0,5 dB à 20 ms, retour à 120 ± 10 ms.
- Les valeurs du compresseur de PDR se reproduisent par options.

**Risques.** - Node n'a pas d'OfflineAudioContext : les tests y vérifient le graphe et les tampons ; l'écoute et le rendu se font sur david-pc.
- Le vol de voix peut s'entendre.
- La convolution coûte sur une petite machine : prévoir de couper la réverbération.

**Contre-vérification.** Le test d'empreintes, FAudio.define et FSynth restent sains : synthesize est déterministe, testable sous Node.

**Correction.** 1) FAudio a une réverbération simple : retour de salle par retard de 117 ms, rétroaction 0,14 (audio.js:330-338). Ce qui manque, c'est une convolution.
2) Les voix bornées par priorité, le vol de voix (stats.stolenVoices) et l'effacement de la musique existent déjà en interne (:99-116 ; README.md:12). FMixer doit les extraire et les exposer, pas les réécrire.
3) Le compresseur « de PDR » (−19, 18, 5, 4/180 ms) est celui de FERRO (audio.js:313-315), repris tel quel par PDR (pdr audio.js:570).
4) Le contexte audio simulé de METAL (checks/audio.test.mjs:11-30) peut servir au test de FERRO.

### ARCHI-10 — FNav : navigation sur grille, budgetée et déterministe, commune à METAL et PDR
- type proposition · priorité P1 · effort L · jeux FERRO, METAL, PDR
- contre-vérification : **plausible**

**Pourquoi.** David demande de fluidifier l'IA des mobs et boss. Dans METAL, route() est un A* 4-connexe, avec un segmentFree paresseux par arête et jusqu'à 2 400 nœuds. Le budget est infini hors mode avancé, d'où les pointes de 40 à 56 ms (audit). nearestNode essaie 49 segmentFree. PDR a déjà, dans un travailleur, des grilles en mm, Dial 10/14 et un cache par but et par version. Deux jeux en ont besoin : la brique entre dans FERRO.

**Preuve.** metal/src/simulation.js:1349, :1379, :1392, :1402-1433, :1742@673d6b2
metal/docs/ARCHITECTURE.md:210 ; audit METAL
pdr/Jeu/src/sim/nav.js:1-14, Jeu/src/sim/travailleur.js:3@5ac0066

**Proposition.** Fichier src/nav.js, global FNav. Sans window ni document (travailleur, Node), calcul en entiers.

API :
- const g = FNav.grid({width, height, cell:.8, origin:[x,z]}) : coûts Uint8Array (0 bloqué, 1-254 coût, 255 inconnu).
- g.set(i, j, c), g.fill(fn), g.version : la version augmente à chaque changement.
- g.clearance() → Uint8Array : distance au mur en cellules (chanfrein 10/14). Un agent de rayon r passe si clearance ≥ ceil(r/cell). Remplace les 7×7 segmentFree et les tests par arête.
- g.los(a, b) : ligne de vue sur grille (DDA supercouverte), pour tirer le fil.
- FNav.path(g, from, to, {radius, diagonal:true, maxNodes:4000, smooth:true}) → ticket {state:'pending'|'done'|'failed', points, cost}.
- FNav.pump({nodes:512}), une fois par pas : il fait avancer les tickets ; aucune recherche d'un bloc.
- FNav.field(g, goals, {radius, maxCost}) : champ de flux par Dial, coûts 10/14. Cache LRU de 8 champs par (buts, rayon, version). f.dir(x,z), f.cost(x,z).
- FNav.invalidate(g, rect) : portes, destruction. version++, et les tickets repartent.

METAL :
- un champ vers la cellule du joueur, recalculé quand il en change (sous budget) et partagé par tous les poursuivants ;
- un A* à ticket seulement pour les buts particuliers (boss vers un point, fuite) ;
- la marche et le sol restent chez METAL, qui remplit la grille à partir de ground() : FNav ignore la 3D.
PDR garde son nav.js ou l'adosse à FNav : c'est sa décision.

**Critère d'acceptation.** - 1000 grilles aléatoires 64×64 : coût A* (heuristique octile) = coût Dijkstra.
- Parité avec le nav.js de PDR : mêmes coûts entiers pour 100 buts.
- METAL, 40 poursuivants, scénario de l'audit sur 5 min : pas p99 ≤ 4 ms, pire pas ≤ 8 ms.
- Mêmes chemins sous Node, en navigateur et dans un travailleur.
- pump() n'alloue rien en régime établi.

**Risques.** - Des cellules de 0,8 m manquent les passages étroits ; METAL les utilise déjà.
- Mémoire des champs : 1024² cellules × 4 octets × 8 champs ≈ 32 Mo (estimation), donc LRU réglable.
- Si PDR adopte FNav, il faut respecter ses conventions (entiers, mm).

**Contre-vérification.** La proposition est utile, mais sa motivation est en partie réfutée.

**Correction.** - « Budget infini hors mode avancé, d'où les pointes » est faux pour METAL 0.8. advanced = combat || generation ≥ 5 (simulation.js:86), et tous les mondes ont generation:6 (world.js:653) : le budget est déjà de 2 recherches par sous-pas.
- Point chaud visible : segmentFree recalculé à chaque arête pour r > 0,4 (:1421), plus 2×49 segmentFree dans nearestNode. La carte de dégagement y répond bien.
- Selon le cycle de FERRO, récolter pdr Jeu/src/sim/nav.js plutôt que réécrire. Il est sans window, en Dial 10/14, avec cache par version et budget (nav.avancer). Il reste à paramétrer la cellule (0,8 m contre 4 m) et les unités (mètres contre mm).

### ARCHI-11 — Socle : motif des modules, registre FERRO, FRandom, FNoise, FStore, FMotion.damp
- type proposition · priorité P2 · effort S · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** - mulberry32 existe en 9 copies, toutes équivalentes, et FNV-1a se trouve dans METAL.
- BITUME a son bruit et son fbm.
- PDR a copié damp en amortir.
- Trois jeux utilisent localStorage, dont la clé générique 'ferro-settings' de METAL (limite 2,2 Mo).
- PDR fait tourner sa simulation dans un travailleur, sans window.

**Preuve.** essais/prng.mjs
metal/src/world.js:26-32, metal/src/game.js:8, :11, :87@673d6b2
bitume/src/decor.js:17-31, bitume/src/jeu.js:20@39b3214
pdr/Jeu/src/camera.js:12@5ac0066
ferro/src/motion.js:32-35, ferro/AGENTS.md:13@248043a

**Proposition.** Motif de tout nouveau module : (function(G){'use strict'; G.FERRO=G.FERRO||{modules:{}}; G.FERRO.modules.FLoop='0.3.0'; G.FLoop=…})(typeof window!=='undefined'?window:globalThis).
Il marche dans une page, un travailleur et sous Node, sans module ES, et rien ne s'exécute au chargement.

Modules :
- FRandom (0.6) : mulberry32(seed), hash(str) (FNV-1a), create(seed) → {next, int, range, pick, shuffle, fork(label)}.
- FNoise (0.8) : value2(x, y, seed), fbm2(x, y, {octaves, lacunarity, gain, seed}), aux résultats de BITUME.
- FStore (0.5) : create(namespace, {version, maxBytes:2200000, migrate}) → {get, set → booléen, remove, size}. Tout sous try/catch, préfixe namespace:. Un quota dépassé rend false, jamais d'exception.
- FMotion.damp(x, v, target, omega, dt) → [x, v] : la formule de motion.js:32-35, exportée pure.

Le registre FERRO.modules est lu par les tests de build et par la récolte.

**Critère d'acceptation.** - Vecteurs de test identiques aux 9 copies (6 graines × 10 000 tirages).
- FNoise = BITUME sur 10 000 points.
- FStore avec quota simulé : set rend false sans exception ; deux espaces sur la même origine sont isolés.
- Chaque module se charge sans window (vm de Node).
- METAL relit une fois 'ferro-settings', puis écrit dans son propre espace.

**Risques.** Risques faibles. La clé de METAL demande une migration. Les jeux ne sont pas forcés d'abandonner leurs copies.

**Contre-vérification.** Socle à faible risque, mais quatre corrections.

**Correction.** 1) 7 copies sur 9 seulement donnent la même suite (F20). FRandom doit offrir mulberry32(graine, {entier}) et hash(chaîne) ; chaque vecteur de test nomme sa variante : brute, FNV-1a « seed:stage », XOR 0x9E3779B9 en u32.
2) FMotion.damp(...) → [x, v] alloue un tableau à chaque appel. Garder la forme mutante damp(q, cible, ω, dt) de PDR (camera.js:12-14).
3) La limite de 2,2 Mo vise la sauvegarde 'ferro-expedition-v2' (game.js:87), pas 'ferro-settings'.
4) Le motif (G)(window||globalThis) est déjà celui de motion.js et music.js. renderer.js, audio.js et options.js écrivent sur window (:1787, :89, :36) : ils ne se chargent pas dans un travailleur.

### ARCHI-12 — FSpace, index spatial commun : à décider
- type décision-à-prendre · priorité P2 · effort M · jeux FERRO, METAL, PDR
- contre-vérification : **plausible**

**Pourquoi.** Selon l'audit, ground() prend 47,7 % du CPU de simulation de METAL. METAL a ses propres seaux de sol de 8 m, blocked et ray. Je n'ai pas vérifié si PDR a une structure équivalente, et BITUME suit une piste. Un seul jeu est concerné de façon prouvée : la règle des deux jeux n'est pas remplie.

**Preuve.** audit METAL
metal/src/simulation.js:123-137, :242, :474@673d6b2
ferro/README.md:49

**Proposition.** Option A : FSpace.grid({cell}) → {insert(id, aabb), update, remove, query(aabb, out), ray(origin, dir, tMax, filter)}, à clés entières et mémoire préallouée.
Option B, recommandée pour l'instant : METAL corrige ground() chez lui (hauteur en cache par cellule, tableau plat), mesure avec FProfile. FSpace n'entre que si la session PDR chiffre le même point chaud.

**Critère d'acceptation.** David décide par écrit. Si A est retenue : query et ray équivalents à une recherche exhaustive sur 10 000 requêtes, et gain mesuré dans METAL et dans PDR.

**Risques.** A fige une API sur un seul usage. B laisse METAL et PDR diverger.

**Contre-vérification.** L'option B (METAL corrige ground() chez lui) reste la bonne à court terme.

**Correction.** - « Je n'ai pas vérifié PDR » : PDR a bien un index spatial, une grille de 4 m triée par comptage à chaque itération, plus une grille de présence de 8 m (sim/monde.js:8-10, :806).
- Le renderer de FERRO a lui aussi son index (spatialIndex, renderer.js:828).
- Au sens large, deux jeux sont donc concernés. Mais les usages diffèrent : hauteurs de sol statiques chez METAL, unités mobiles chez PDR.

### ARCHI-13 — Processus : versions 0.3 à 1.0, branches, ordre FERRO → METAL → BITUME/PDR, tests, VERSIONS.md
- type exigence · priorité P0 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Le cycle existe (Prendre, Retoucher, Récolter, Trier, Publier ; npm test ; étiquettes jamais déplacées). Mais l'entrée 0.2 n'a pas d'empreintes, et METAL n'est pas récoltable. METAL contient v0.1 sans retouche : il peut prendre chaque version par copie directe. BITUME et PDR ont des sessions actives.

**Preuve.** ferro/README.md:42-53, ferro/AGENTS.md:16, ferro/VERSIONS.md@248043a
metal/tools/build.py:12, metal/SIZE.json (789 111)@673d6b2
bitume/SIZE.json (305 094)@39b3214
pdr/Jeu/construire.py:58, Jeu/SIZE.json (1 265 540)@5ac0066
metal/docs/ARCHITECTURE.md:208

**Proposition.** VERSIONS
- 0.3 Mesure et cadence : ARCHI-02, 04, 03, registre.
- 0.4 Rendu fluide : ARCHI-06 et defineShape.
- 0.5 Commandes : ARCHI-05, 08, FStore.
- 0.6 Son : ARCHI-09, FRandom.
- 0.7 Navigation : ARCHI-10.
- 0.8 Accroches : reste d'ARCHI-07, FNoise, damp.
- 0.9 Image : ARCHI-17 voie A, si David la retient.
- 1.0 : le contenu de METAL sort, le contrat est figé.
Dépendances : 0.3 avant tout ; 0.4 avant 0.8 ; 0.5 après FLoop. David peut permuter 0.5 à 0.7.

BRANCHES
Une branche ferro/0.x par version, partie de main. Fusion quand tout est vert, puis étiquette annotée v0.x sur main, jamais déplacée. Push vers github.com/M4D135/FERRO seulement sur accord de David.

ORDRE POUR CHAQUE VERSION
(1) FERRO : code, tests, VERSIONS.md.
(2) METAL : copie directe des fichiers, adoption, tests, build sous 1,4 Mo. METAL prend d'abord v0.2 telle quelle (à confirmer par ses tests).
(3) BITUME et PDR : rien n'est écrit chez eux. Une note de passage par jeu ; leurs sessions adoptent quand elles le veulent, et peuvent sauter des versions.

TESTS EXIGÉS
- npm test vert (44 tests et les nouveaux).
- Trace identique sur les 3 scènes.
- Modules chargeables sans window.
- Tests et build de METAL verts.
- Mesure FProfile avant et après, consignée.

MODÈLE D'ENTRÉE DE VERSIONS.md
- Version, date, commit, étiquette.
- Nouveau.
- Inchangé : globaux v0.2, trace.
- Mesures : p50, p95, p99, tailles.
- Empreintes sha256 de src/*.js.
- Passage par jeu : fichiers, conflits attendus, options.
- Commits lus chez BITUME et PDR.
- Limites.

BUDGETS DE TAILLE (estimation, non minifié)
- FLoop 4 Ko ; FProfile 8 ; FInput 14 ; schéma 6 ; FStore 2 ; FRandom et FNoise 3 ; FSynth 10 ; FMixer 10 ; FNav 14.
- Total ≈ 71 Ko.
- Après ajout : METAL ≈ 860 000 (< 1 400 000), BITUME ≈ 376 000, PDR ≈ 1 337 000 (< 3 000 000).

RÈGLE À AJOUTER À AGENTS.md DE FERRO
« Aucun code sous GPL (Quake III, ioquake3) n'entre dans FERRO ni dans les jeux. On s'inspire de comportements décrits ; on ne recopie ni ne traduit le code. »

**Critère d'acceptation.** - Chaque étiquette a son entrée complète dans VERSIONS.md, sha256 vérifiable par shasum -a 256.
- npm test est vert sur l'étiquette.
- METAL est construit et testé à chaque version.
- Aucune écriture dans BITUME ni dans PDR.
- Aucune étiquette n'est déplacée.

**Risques.** - Huit passages si BITUME et PDR suivent tout ; ils peuvent sauter des versions.
- Le push public : vérifier qu'aucun contenu propre à un jeu ni aucun secret ne part.
- Les tailles sont estimées.

**Contre-vérification.** Processus cohérent avec README.md:42-55 et AGENTS.md:16. La règle anti-GPL à ajouter est justifiée : aucun AGENTS.md n'en a.

**Correction.** - bitume SIZE.json vaut 305 330 octets à 39b3214. 305 094 est la valeur jusqu'à e3bcb6b. La copie de travail est à 342 322.
- PDR porte déjà son renderer sur v0.2 (wip-ferro-02).
- Le clone local de référence a disparu (ARCHI-V1).
- « npm test vert » ne prouve rien sans étiquettes (ARCHI-V2).

### ARCHI-14 — Outils : récolte sans verrou, METAL récoltable, manifeste par jeu, script de passage, empreintes
- type proposition · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** - recolte.py appelle git sans --no-optional-locks, donc il peut toucher l'index d'un jeu en cours d'édition.
- METAL est « dossier absent ».
- La comparaison se fait au HEAD de FERRO et non à une étiquette.
- Les conflits se résolvent à la main à chaque fois : 5 pour BITUME, 8 puis 13 pour PDR.
- Il n'y a pas de table d'empreintes.

**Preuve.** ferro/outils/recolte.py:35, :50, :178, :196-212, :217 ; ferro/jeux/jeux.json:8 ; ferro/VERSIONS.md:33-36@248043a
essais/recolte-2026-11-12/RAPPORT.md

**Proposition.** 1) Tous les appels git avec --no-optional-locks, et GIT_OPTIONAL_LOCKS=0 dans l'environnement.
2) jeux.json : le vrai chemin de METAL (question ouverte). En attendant, l'avertissement se met en tête du rapport.
3) FERRO.json à la racine de chaque jeu, posé par sa session : {'ferro':'v0.4', 'fichiers':{'src/moteur/renderer.js':{'mode':'copie','base':'v0.4','marque':'BITUME'}}}.
4) --ferro REF, pour comparer à une étiquette.
5) --copie-de-travail refusé si un fichier de FERRO est modifié chez le jeu, sauf --accepter-sale.
6) outils/passer.py JEU VERSION :
- prépare la copie fusionnée (git merge-file -p --diff3) dans recolte/<date>/ ;
- applique les résolutions connues : côté FERRO quand la valeur du jeu est déjà une option ;
- n'écrit jamais dans le jeu.
7) outils/empreintes.py : table sha256 pour VERSIONS.md.

**Critère d'acceptation.** - Sur un dépôt témoin : aucun .git/index.lock, et la date de .git/index ne change pas.
- METAL est récolté.
- passer.py reproduit pour BITUME 39b3214 la copie résolue (v0.2 + 10 lignes).
- La table d'empreintes est égale à shasum -a 256.

**Risques.** Risques faibles. Le manifeste est un fichier de plus dans chaque jeu, posé par sa session.

**Contre-vérification.** Récolte au HEAD de FERRO, METAL « dossier absent » et absence de table d'empreintes : confirmés.

**Correction.** 1) Motivation réfutée : git show et git rev-parse ne touchent pas l'index (essai cv/lockt). Le drapeau --no-optional-locks reste une hygiène gratuite. Seul le futur contrôle « copie propre » (point 5) en a vraiment besoin.
2) passer.py se réduit presque à git merge-file -p --ours : rejoué, il redonne au bit près bitume-resolu.js et pdr-resolu.js.
3) jeux.json devra suivre la nouvelle base de PDR (v0.2) quand wip-ferro-02 sera intégré.

### ARCHI-15 — Sessions concurrentes : risque de collision avec BITUME et PDR
- type risque · priorité P0 · effort S · jeux FERRO, BITUME, PDR
- contre-vérification : **confirmé**

**Pourquoi.** - La copie de travail de BITUME grossit pendant la lecture : 10 fichiers, 665 puis 853 ajouts, dont 3 retouches du renderer et un worktree physique/conduite.
- L'origin/main local de PDR est passé de 28d1d7c à 5ac0066 dans la journée.
- Le contexte donné par la tâche était déjà dépassé deux fois.
- La récolte sans --no-optional-locks peut toucher leur index.

**Preuve.** bitume : git --no-optional-locks diff --stat et worktree list (2026-11-12, après 17 h 42)
pdr : git --no-optional-locks rev-parse origin/main = 5ac0066
ferro/outils/recolte.py:35, :50 ; ferro/AGENTS.md:14@248043a

**Proposition.** Règles pour le master prompt :
- Codex n'écrit que dans FERRO et METAL.
- BITUME et PDR ne se lisent que par git --no-optional-locks show <commit>:<chemin>, jamais par leur copie de travail sans accord.
- Chaque entrée de VERSIONS.md note les commits lus.
- La note de passage liste les fonctions du renderer touchées (pack, tampons, shaders).
- Aucun reformatage ni réindentation de renderer.js.
- Un seul écrivain dans FERRO pendant la campagne.
- Chaque étiquette est annoncée par le canal que David choisit.

**Critère d'acceptation.** - Avant et après la campagne, git --no-optional-locks status de BITUME et de PDR ne montre que les changements de leurs sessions, et aucun verrou créé.
- Chaque entrée de VERSIONS.md liste les commits lus.
- Le diff de renderer.js n'a aucune ligne seulement réindentée.

**Risques.** Les sessions retouchent le renderer en parallèle : les conflits continueront jusqu'à ARCHI-07.

**Contre-vérification.** Le risque est réel, et plus fort que décrit :
- BITUME à 18:31 : 11 fichiers, +892/−293 ;
- PDR : wip-ferro-02 et v03-feu-sim créées à 18:12, 5 worktrees ailleurs ;
- FERRO : ~/Projects/ferro absent depuis 18:35.

**Correction.** Retirer la phrase « la récolte sans --no-optional-locks peut toucher leur index » : elle est réfutée (F21). Ajouter les branches WIP de PDR, et la disparition du clone de FERRO, à la liste des collisions possibles.

### ARCHI-16 — Répartition des demandes de David entre FERRO et METAL
- type exigence · priorité P0 · effort S · jeux FERRO, METAL
- contre-vérification : **plausible**

**Pourquoi.** Codex implémente dans FERRO (moteur seul, publié) et dans METAL. Il faut savoir où va chaque demande, pour ne pas verser du contenu de METAL dans FERRO ni réécrire dans METAL une brique commune.

**Preuve.** demandes (1) à (4) de David
metal/docs/ARCHITECTURE.md:78, :208, metal/src/simulation.js:1742@673d6b2
ferro/src/audio.js:440-726@248043a
audit METAL

**Proposition.** (1) Le bouclier protège mal → METAL seul (règles de dégâts). Je ne l'ai pas inspecté.
(1) Armes « genre Doom », plus vives :
- FERRO 0.6 : FAudio.define, FSynth, FMixer ;
- METAL : recettes dans son propre fichier, réglées à l'oreille.
(1) Gameplay raide, inspiration Quake 3 :
- FERRO 0.3 et 0.5 : FLoop, souris brute, appuis consommés par pas, damp ;
- METAL : son modèle de mouvement (profil Survie de ARCHITECTURE.md:78 ; pas de saut libre aujourd'hui), d'après des descriptions publiques, jamais d'après le code GPL.
(1) Manette :
- FERRO 0.5 : FInput et schéma ;
- METAL : liaisons, courbe de visée, aide à la visée, invites, menus.
(2)(3) Fluidité :
- FERRO 0.3 et 0.4 : FProfile, gouverneur sur budget, renderer sans allocation, prepare() ;
- METAL : ground() (47,7 %), segmentFree ; budget de route fini en toute difficulté tout de suite (aujourd'hui Infinity hors mode avancé, :1742). Le détail revient à l'audit METAL.
(2) IA des mobs et boss :
- FERRO 0.7 : FNav (champ partagé, A* budgeté) ;
- METAL : comportements, cadence de réflexion par ennemi.
(4) NVIDIA, DLSS, photoréalisme → ARCHI-17.
(4) Moteur de référence, poussé sur le Git de FERRO, utilisé par BITUME et PDR → ARCHI-13, ARCHI-07 et ARCHI-01.

**Critère d'acceptation.** - Chaque demande a un propriétaire (version de FERRO ou tâche de METAL) et un critère mesurable dans le master prompt.
- Aucune tâche de METAL ne modifie un fichier de FERRO chez METAL sans passer par une version de FERRO.

**Risques.** - GPL : traduire le pmove de Quake III contaminerait METAL, puis FERRO par la récolte.
- Le ressenti « Quake » est subjectif : prévoir des valeurs réglables et un essai avec David.

**Contre-vérification.** La répartition FERRO / METAL est saine, et la mise en garde sur la GPL est juste.

**Correction.** - « Budget de route fini en toute difficulté tout de suite » est déjà le cas en jeu. advanced ne dépend pas de la difficulté : il vaut world.combat || generation ≥ 5 (simulation.js:86), et tous les mondes ont generation:6. Infinity ne vaut que pour d'anciens mondes de test.
- La manette ne concerne que METAL et BITUME : PDR n'en a pas.

### ARCHI-17 — NVIDIA, DLSS et photoréalisme : choisir la voie, et geler le rendu de secours
- type décision-à-prendre · priorité P1 · effort XL · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** David : « sur les pc avec nvidia, faut en tirer parti et surtout le dlss 5 ».
- Le renderer n'active aucune extension et rend en RGBA8, sans HDR.
- Le seul levier lié au GPU est powerPreference:'high-performance' : il choisit probablement la carte dédiée sur un portable à deux GPU.
- Je ne connais aucun accès à DLSS depuis une page web (incertain : l'axe NVIDIA doit confirmer).
- Le secours Canvas 2D prend 27 % du renderer, et BITUME comme PDR le refusent.

**Preuve.** ferro/src/renderer.js:1353, :905 (0 getExtension, cibles RGBA8) ; ferro/VERSIONS.md:43@248043a
bitume/src/jeu.js:777@39b3214
pdr/Jeu/src/jeu.js:254@5ac0066
demande (4) de David

**Proposition.** Voie A, recommandée, sur option, en FERRO 0.9 : palier web « ultra ».
- Cibles RGBA16F (EXT_color_buffer_float).
- Tonemapping filmique.
- TAA, puis TAAU : rendu à 0,67-0,77 de la résolution, puis reconstruction temporelle.
- Occlusion ambiante d'écran.
- Paliers bas, moyen, haut, ultra, choisis par FProfile. Par défaut, l'image de v0.2.

Voie B : version native pour NVIDIA (D3D12 ou Vulkan + SDK NVIDIA). C'est un autre moteur, hors de la page unique. Electron ou Tauri n'y changeraient rien (hypothèse).

Voie C : un backend WebGPU, à terme, toujours sans DLSS.

Rendu de secours : gelé (aucune fonction nouvelle), puis sorti en renderer-logiciel.js chargé à part en 1.0. BITUME et PDR gagnent environ 32 Ko.

**Critère d'acceptation.** - David décide par écrit.
- Voie A : scène METAL en 2560×1440, palier ultra, sur david-pc avec NVIDIA, à p95 ≤ 16,7 ms (cible estimée).
- Palier par défaut : trace identique à v0.2.
- Repli propre sans EXT_color_buffer_float.

**Risques.** - La TAA laisse des traînées aux vitesses de Quake.
- Coût GPU.
- Écart entre l'attente « DLSS 5 » et ce que permet le web.
- La voie B coûterait plus que tout le reste réuni.

**Contre-vérification.** Décision bien posée. « Seul levier GPU : powerPreference » est exact pour le code (:1353).

**Correction.** - TAA, TAAU et SSAO demandent une texture de profondeur (aujourd'hui un renderbuffer, :1393 et :1404), des vecteurs de mouvement (donc l'état précédent des instances) et le MRT. Il faut aussi trancher entre TAA et le MSAA actuel (:1400-1409). L'effort XL est justifié.
- La voie B (native) sort de la charte de FERRO (AGENTS.md:5-6 et :13 : scripts autonomes, page unique) : ce serait un autre moteur.
- Le code propre au secours fait environ 35,8 Ko, pas 32.

## Ajouts du contre-vérificateur

### ARCHI-V1 — Point de départ vérifié : le clone local de FERRO a disparu et PDR porte déjà v0.2
- type risque · priorité P0 · effort S · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** Le master prompt vise ~/Projects/ferro@248043a, mais ce dossier n'existe plus depuis 18:35. Il ne reste que des clones de travail.
Pendant ce temps :
- la session de PDR a créé wip-ferro-02 (66687b2, 18:12), qui porte son renderer sur v0.2 (+197/−6 par rapport à v0.2, non vérifié), plus v03-feu-sim ;
- la copie de travail de BITUME grossit.
Codex risque de partir d'une mauvaise base, ou de refaire un portage déjà en cours.

**Preuve.** - ls ~/Projects à 18:35 et 18:52 : pas de ferro ; find /Users/david -maxdepth 5 -name recolte.py : aucun résultat.
- pdr : git --no-optional-locks branch -v (wip-ferro-02 66687b2, v03-feu-sim 588e8ad) ; reflog de HEAD à 18:12:37.
- git diff --no-index --numstat v02.js pdr-wip-renderer.js : 197/6 (cv/).
- bitume : diff --stat à 18:31 : 11 fichiers, +892/−293.

**Proposition.** Étape 0 du master prompt :
(a) demander à David où se trouve FERRO, sinon cloner github.com/M4D135/FERRO ;
(b) vérifier git rev-parse 'v0.2^{commit}' = 248043a674e5353724731a7322ae932487c236b7, les étiquettes de F01 et les sha256 de src/*.js (audio 5ea97d09…, motion c20b6e38…, music f5036133…, options b5a81d77…, renderer d57dae38eed729f6ba72b6673a2174e82869c8ab85670dd7c6a71628504a85a1) ; s'arrêter en cas d'écart ;
(c) lire PDR à wip-ferro-02, et non à 5ac0066, pour planifier ARCHI-06 et ARCHI-07 ;
(d) noter dans VERSIONS.md chaque commit lu, avec l'heure.

**Critère d'acceptation.** Avant toute écriture :
- rev-parse et sha256 identiques à la table ;
- journal listant les commits lus de FERRO, METAL, BITUME et PDR ;
- aucun fichier écrit hors de FERRO et METAL.

**Risques.** Si David a déplacé FERRO exprès (vers Forgejo, ou sous un autre nom), recloner GitHub créerait une seconde référence. Demander d'abord.

### ARCHI-V2 — Le contrat de compatibilité se désactive sans bruit quand les étiquettes manquent
- type exigence · priorité P0 · effort S · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** Le test de reprise charge sa référence par git show v0.1:src/renderer.js. Si l'étiquette manque, les deux tests de compatibilité sont ignorés (skip), et npm test reste vert avec le code 0.
C'est le cas dans un clone superficiel ou sans étiquettes : bac à sable Codex, ou intégration continue (actions/checkout ne rapatrie pas les étiquettes par défaut, hypothèse à vérifier). Le critère « npm test vert » du plan passerait alors sans contrôler la compatibilité.

**Preuve.** - ferro/checks/renderer-reprises.test.mjs:12, :70, :77@248043a.
- cv/ferro-sanstag (git clone --no-tags --single-branch) : # tests 44, # pass 42, # skipped 2, # fail 0, code de sortie 0.

**Proposition.** (1) Mettre les références dans le dépôt :
- checks/reference/renderer-v0.1.js (106 801 octets, sha256 11460253…944874, VERSIONS.md:53) ;
- puis renderer-v0.2.js (120 863 octets, sha256 d57dae38…504a85a1) dès la 0.3.
Le test vérifie leur sha256 avant de comparer.
(2) À défaut, une référence absente fait échouer le test, sauf avec FERRO_PERMETTRE_SKIP=1.
(3) Ajouter la table sha256 de la 0.2 dans VERSIONS.md.

**Critère d'acceptation.** - Dans un clone --no-tags, npm test donne 0 test ignoré et les tests de reprise passent.
- shasum -a 256 checks/reference/* correspond à VERSIONS.md.

**Risques.** Environ 227 Ko de références dans le dépôt, non chargées par les jeux. Changer de référence devient un acte explicite, ce qui est voulu.

### ARCHI-V3 — Récolter l'hôte de travailleur de PDR (FHost) pour sortir la navigation et l'IA de METAL du fil principal
- type proposition · priorité P1 · effort L · jeux FERRO, METAL, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** Les pointes de 40 à 56 ms bloquent le rendu, car route() est synchrone sur le fil principal. Les tickets de FNav (ARCHI-10) sont par nature asynchrones.
PDR a déjà un hôte générique compatible avec une page unique :
- le travailleur est construit depuis le texte des scripts data-travailleur, par Blob URL ;
- repli sur le fil principal si la politique de sécurité, un cadre isolé ou l'absence de Worker l'empêchent ;
- même protocole des deux côtés.
Il respecte les AGENTS.md : une page, aucun fichier en plus, aucun CDN. Il sert deux jeux : il entre dans FERRO (README.md:49).

**Preuve.** - pdr Jeu/src/hote.js:1-20, :29, :97-103@5ac0066 ; Jeu/construire.py:55 ; Jeu/src/sim/travailleur.js:1-5.
- metal/src/simulation.js:1402-1433 : route synchrone, segmentFree à chaque arête :1421.
- Audit METAL : pointes de 40 à 56 ms.

**Proposition.** src/host.js, global FHost :
- FHost.create({scripts:'script[data-ferro-worker]', name, onMessage, onFailure, forceMain}) → {mode:'worker'|'main', reason, post(msg, transfer), terminate()} ;
- même code dans le travailleur et en repli.
METAL (0.7) :
- FNav, et éventuellement FBrain, tournent dans le travailleur ;
- leurs résultats s'appliquent au pas N+k, avec k fixe (point de départ k=2 à 120 Hz, estimation) ;
- joueur, collisions et armes restent sur le fil principal.

**Critère d'acceptation.** - Scénario de l'audit : plus aucune image > 33 ms due à route ou segmentFree sur le fil principal (profil Chrome sur david-pc).
- 1 000 requêtes : coûts égaux en travailleur et en repli.
- Repli constaté avec Worker indéfini et dans un iframe sandbox.

**Risques.** - Il faut copier la grille vers le travailleur (Uint8Array transférable) et synchroniser les invalidations (portes, destruction).
- Débogage plus difficile.
- L'IA réagit k pas plus tard.
- La politique de sécurité de l'hébergement doit admettre blob: (à vérifier).

### ARCHI-V4 — Déterminisme : FBrain asynchrone et empreinte d'état commune pour les tests de cadence et de rejeu
- type risque · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** L'acceptation d'ARCHI-03 (même état après 600 pas à 30, 60 et 144 Hz) et les rejeux supposent une simulation déterministe.
- METAL : FBrain passe par WebNN, et ses avis s'appliquent « dès que prêts », donc selon l'heure réelle. Le reste de la simulation n'appelle pas Math.random.
- PDR garantit déjà le déterminisme : entiers, aléa à graine, empreinte FNV-1a de 64 bits toutes les 100 itérations.
- BITUME exige le même comportement à 30, 60 et 120 Hz.
Sans empreinte commune, « même état » n'est pas testable.

**Preuve.** - metal/src/brain.js:1-3, :63 (navigator.ml.createContext) ; metal/src/simulation.js:1480-1502@673d6b2.
- grep : 0 Math.random dans simulation, brain, actors et world.
- pdr Jeu/src/sim/monde.js:3-6@5ac0066.
- bitume FEUILLE-DE-ROUTE.md:189@39b3214.

**Proposition.** FERRO :
- FRandom.fingerprint(...vuesTypées|nombres) → chaîne hexadécimale FNV-1a de 64 bits, à la manière de PDR ;
- FLoop.stats().step.
METAL :
- avis de FBrain appliqués au pas exact request.step+k, jamais « dès que prêt » ;
- sim.fingerprint() exposé ;
- tests de cadence avec aiAcceleration:'cpu' tant que k n'est pas en place.

**Critère d'acceptation.** Sous Node :
- 600 pas joués à 30, 60 et 144 Hz d'affichage, mêmes entrées → empreintes égales ;
- avec un faux WebNN à latence aléatoire de 0 à 200 ms → empreintes encore égales une fois k en place.

**Risques.** Retarder l'avis du réseau de k pas modifie légèrement l'IA. L'empreinte coûte si on la calcule trop souvent : une fois tous les 100 pas, comme PDR.

### ARCHI-V5 — Contextes d'hébergement et plateformes : artefact en cadre isolé, page servie, téléphone et Safari dans les critères
- type exigence · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** BITUME et PDR produisent dist/artefact.html pour une publication en artefact, en plus de leurs pages servies (BITUME sur bitume.estrasse.fr). Dans un cadre isolé d'une autre origine, plusieurs API peuvent être refusées (hypothèse à vérifier) : verrou du pointeur, manette, keyboard-map, travailleur blob:, stockage. hote.js de PDR prévoit déjà ce cas.
Or les critères du rapport se mesurent presque tous sur david-pc, avec Chrome et NVIDIA. Les AGENTS.md exigent pourtant le téléphone et le tactile, et VERSIONS.md avoue que Safari, Firefox et le téléphone ne sont pas vérifiés.

**Preuve.** - bitume construire.py:8, :33, :71@39b3214.
- pdr Jeu/construire.py:58, :91 ; Jeu/src/hote.js:5-7@5ac0066.
- metal/AGENTS.md:7@673d6b2.
- ferro/VERSIONS.md:40-41@248043a.

**Proposition.** FERRO.features() : sondage sans effet → {webgl2, timer, parallelCompile, floatTargets, gamepad, pointerLock, rawMouse, keyboardMap, worker, storage, vibration, crossOriginIsolated}, affiché par le banc.
Recette par version sur cinq contextes :
- Chrome sur david-pc (NVIDIA) ;
- Safari sur le Mac ;
- Safari sur iPhone ;
- Chrome sur Android ;
- banc chargé dans un iframe sandbox='allow-scripts', sans allow-pointer-lock ni allow-same-origin.
Chaque brique documente son repli :
- verrou refusé → glisser pour regarder (déjà dans METAL, game.js:159) ;
- stockage refusé → mémoire ;
- travailleur refusé → fil principal.

**Critère d'acceptation.** - Tableau features() des cinq contextes consigné dans VERSIONS.md à chaque étiquette.
- Aucune exception non capturée dans le cadre isolé.
- METAL jouable au tactile sur un téléphone, p95 ≤ 33 ms en qualité auto (cible estimée).
- FInput rend device() juste quand la manette est refusée.

**Risques.** Il faut des appareils réels (iPhone, Android). Le comportement des navigateurs et des artefacts évolue : refaire la recette à chaque version.

## Questions ouvertes

- Où se trouve le clone permanent de METAL ? jeux.json:8 pointe vers ~/Projects/metal, qui n'existe pas. La seule copie lue est un clone de github.com/M4D135/METAL à 673d6b2 : METAL a-t-il avancé ailleurs (david-pc, Forgejo) ?
- Que faire du rendu de secours Canvas 2D (27 % du renderer), refusé par BITUME et PDR ? Le garder, le geler, ou le sortir en fichier à part en 1.0 ?
- Langue des nouveaux identifiants : anglais, comme l'API actuelle (create, setLots, actorFilter) — c'est ma recommandation — ou français, comme le code de BITUME et PDR ?
- Pour l'inspiration Quake 3, METAL reçoit-il un saut libre, absent par conception (ARCHITECTURE.md:78) ? Et jusqu'où pousser le contrôle aérien ?
- DLSS : David accepte-t-il la voie web (HDR + TAAU, sans DLSS), ou veut-il une version native pour NVIDIA, qui serait un autre moteur ?
- Pas fixe de METAL : 120 Hz comme BITUME, ce qui double le coût de simulation, ou 60 Hz avec interpolation ?
- BITUME et PDR adopteront-ils FLoop, FInput et FNav, ou garderont-ils les leurs ? PDR travaille en entiers et en millimètres, dans un travailleur.
- Faut-il prévoir un backend WebGPU pour FERRO après la 0.9 ?
- Par quel canal annoncer chaque version aux sessions de BITUME et de PDR : une note KBZA à identifiant stable, un fichier dans FERRO, ou un message de David ?
- David remplace-t-il « mêmes commandes GPU » par « même trace sémantique sur les scènes de référence » (AGENTS.md:10, VERSIONS.md:9) ?
- Push de FERRO vers GitHub : à chaque étiquette, ou par lot après la revue de David ?
- FSpace : la session de PDR a-t-elle mesuré un point chaud de requêtes spatiales qui justifierait un index commun ?