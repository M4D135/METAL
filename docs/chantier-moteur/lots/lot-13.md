# Lot 13 — Mode démo qui dure et rejeu d'entrées
## But
Livrer un mode démo autonome qui tourne des heures sans intervention, piloté par un joueur artificiel déterministe, sans toucher à la sauvegarde du joueur. Fournir un enregistreur/rejoueur d'entrées qui sert de banc de performance reproductible et de preuve « état identique » pour chaque optimisation future.

## Tâches, dans l'ordre

### T1 — Onde de choc parable et esquive par le pilote [DEMO-V1]
- Où : src/simulation.js:1655, 1704, 1722, 766-769, 775, 1915 ; bancs/demo/pilot.mjs ; bancs/demo-verif/cause.mjs, noring.mjs
- Quoi : (1) L'Onde de choc (ring) passe une source `{x:a.x, y:a.y+1, z:a.z}` à `hurt()` pour que `shieldFacing()` bloque. (2) Pilote : nouvelle règle prioritaire sur le tir — pour chaque `s.bossAttacks` ring en annonce ou active dont `currentRadius` n'a pas dépassé la distance joueur de plus de 1,6 m, tourner vers `(a.x, a.z)` et tenir `input.fireLeft` si bouclier > 15 énergie ; sans bouclier, esquive à `currentRadius` = 1,2 m du joueur ; à défaut, rompre la ligne de vue derrière un pilier < 6 m. (3) `danger()` du pilote traite slam, rocketZone, sweep **et ring**. (4) Pas d'option `demo` dans `hurt()` ni `restore()` ; difficulté 0 en démo ; mort = fondu puis scène suivante.
- Preuve exigée : `node bancs/demo-verif/cause.mjs 15 6 0 1` et `node bancs/demo-verif/cause.mjs 0 8 0 1` : 0 mort, part de l'Onde < 30 % des dégâts. Référence haute : `noring.mjs` (0 mort sur 26 min en neutralisant l'Onde).
- Qualité : meilleure (bouclier qui protège enfin, règle 4 de David).
- Garde-fous : changer l'Onde modifie le combat → tests de simulation à ajuster, version de boss incrémentée si un point de reprise en dépend. Si le bouclier n'absorbe que 80 % (ligne 777), il reste ≈ 4,4 PV par Onde → pilote cherche les trousses sous 45 PV.
- Dépend de : rien (prérequis de T3, T4, T5, T9).

### T2 — FDemo.attract : automate d'écran titre [DEMO-01]
- Où : src/demo.js (nouveau) ; src/game.js:721 ; src/options.js:6, 9 ; références : point-de-rupture/Jeu/src/interface/titre.js:50-52, 184-232, 617-632, 648-660, 675-678 ; bitume/src/jeu.js:183, 208-231, 765-794
- Quoi : `FDemo.attract({idleMs:5000, swallowMs:600, enabled, canStart, start, stop, onCountdown, window, now})` → `{tick, poke, state, dispose}`. États : idle → armed → starting → running. Écouteurs capture : pointerdown, keydown, wheel, touchstart ; pendant starting/running, premier geste → `preventDefault` + `stopPropagation` + `stop('geste')` ; clic avalé 600 ms ; Shift/Ctrl/Alt/Meta/CapsLock seuls ne sortent pas ; **Ctrl+R, F5, F1-F12 ne sont pas bloqués** (sortie sans `preventDefault` si `ctrlKey||metaKey||altKey` ou F1-F12). Manette : `navigator.getGamepads()` à chaque tick, bouton ou axe > 0,5 (front montant). Onglet caché : pas de départ, minuteur remis à zéro ; pendant running → `onPause`/`onResume`, > 60 s cachés → scène suivante. `prefers-reduced-motion` → coupé. Préférences `demo` (booléen, vrai) et `demoDelay` (5/10/30/60 s) dans `FOptions.defaults` et `normalize`.
- Preuve exigée : `checks/demo.test.mjs` avec faux window et horloge injectée : départ entre 5,0 et 5,7 s ; chaque geste (pointerdown, keydown lettre, wheel, touchstart, bouton manette) → `stop` dans le même appel ; Maj seule ne sort pas ; clic 300 ms après sortie avalé, clic 700 ms passe.
- Qualité : meilleure.
- Garde-fous : écouteurs capture n'agissent qu'en starting/running (sinon volent les clics du menu) ; navigateurs sans Gamepad → sondage ignoré ; taille ≈ 2 Ko.
- Dépend de : rien.

### T3 — Pilote automatique FPilot [DEMO-04]
- Où : src/pilot.js (nouveau) ; src/simulation.js:2219, 1901-1940, 273-296, 512-516, 1939 ; bancs/demo/pilot.mjs (prototype 192 lignes, 15,8 Ko)
- Quoi : `FPilot.create(sim, world, {seed})` → `{think(input, dt), reset, goalKey, stats}`. Fonction pure de l'état, ni `Math.random` ni horloge murale. Couches : objectifs par priorité (butin colosse → soin < 45 PV → mécanismes → relais → trophées → colosse → sortie) ; suivi à 0,5 m, replanification 4 s, écart latéral au 2ᵉ échec, objectif écarté 10 s au 5ᵉ ; combat : cible visible < 42 m, maintien 6-13 m, sens inversé 1,1-1,8 s ; visée : erreur × 14/s bornée 7,5 rad/s combat, tremblement 0,006 rad, **délai de réaction 0,2-0,3 s**, erreur ∝ vitesse angulaire cible, objectif précision 55-75 %, rafales, arrêt à 80 % chaleur ; armes : roquette > 10 m colosse/groupe 3, grenade 8-24 m groupe 2, pompe < 11 m, mitraillette sinon ; garde si ennemi < 30 m arme/tire et énergie > 25 ; onde défensive ≥ 4 ennemis < 14 m ; interaction : impulsion sur mécanisme uniquement.
- Preuve exigée : `node --expose-gc bancs/demo/run.mjs 30 0 96 1` : ≥ 4 mondes terminés, 0 blocage, 0 exception. `node bancs/demo/replay.mjs 100 6` : second enregistrement identique. Précision 55-75 %, < 2 surchauffes/min.
- Qualité : meilleure.
- Garde-fous : dépend des champs `sim.state` → test de traversée dans `npm test` ; taille 16-20 Ko sur budget 1,4 Mo ; sans T1 meurt souvent ; résultats obtenus difficulté 1, graine 96.
- Dépend de : T1 (Onde parable), T7 (navigation).

### T4 — Mode démo dans game.js sans effet de bord [DEMO-11, LOOP-V1, STAB-V2, RESTE-V1]
- Où : src/game.js:11, 94-104, 125-132, 161-165, 178, 220, 675-722, 760-761, 792-800, 838 ; src/index.html:15-25
- Quoi : Mode `'demo'` distinct de `'playing'`. (1) Entrée : mémoriser stage/seed/runStats/checkpoint/savedRun/selectedWeapon ; `load()` avec option demo ; pas de `start()`, `lock()`, `canvas.focus`. (2) `saveCheckpoint`/`clearSave`/`refreshContinue` rendent la main immédiatement en démo ; points de reprise en mémoire seulement. (3) `events()` : `shopOpen` ignoré ; win → scène suivante ; dead → fondu + scène suivante (3ᵉ mort) ; toasts masqués sauf bannière colosse. (4) `blur` ne met **pas** en pause ; `document.hidden` → suspend sans changer de mode, reprend avec reset horloge. (5) Échap et toute touche sortent (pas de bascule pause). (6) Sortie au premier geste : `setMode('menu')` dans le même événement, 0 `FWorld.create`, 0 `sim.step` ensuite ; monde de démo reste en fond du titre ; **rétablir `sector-number`, `mission-summary`, `body.dataset.stage`** (game.js:147-150). (7) Son : bus 35 % + musique titre si contexte audio déjà actif, sinon silence. (8) HUD réduit + bandeau « DÉMO — cliquez, touchez ou appuyez sur une touche », variante tactile, marges zone sûre. (9) `wakeLock.request('screen')` à l'entrée, relâché à la sortie ; échec silencieux. (10) Tactile : arrêt après 10 min → titre fixe.
- Preuve exigée : banc `bancs/loop/harness.mjs` : après 5 min de démo, `localStorage['ferro-expedition-v2']` identique octet pour octet ; `requestPointerLock` jamais appelé ; aucun passage mode `shop` ; au premier geste, mode menu dans le même tour, 0 appel `FWorld.create`/`sim.step` ensuite.
- Qualité : meilleure.
- Garde-fous : le drapeau `demo` ne doit jamais entrer dans `snapshot` ni sauvegardes ; tests de pause sur blur en mode `playing` restent valables (mode distinct) ; taille ≈ 3-5 Ko dans METAL.
- Dépend de : T1, T2, T3.

### T5 — FDemo.runner : enchaînement, endurance, transitions [DEMO-03, PARA-12, PARA-V4, LOAD-V2]
- Où : src/demo.js ; src/game.js:31, 133-151 ; src/renderer.js:1365-1371 ; bancs/demo/cycle.mjs, run.mjs
- Quoi : `FDemo.runner({scenes, open(scene)→{step, progressKey, done, dispose}, sceneSeconds:240, stallSeconds:50, fadeMs:300, onScene, onError})`. (1) Scènes `{id, seed, index, loadout, spawn}` ; ordre mélangé par graine en démo, fixe en banc. (2) **Pas de pas fixe imposé** : le runner reçoit `step(dt)` du jeu (voir T11) ; pas d'accumulateur interne. (3) Fin de scène : `done()`, durée atteinte, ou blocage. (4) Blocage : `progressKey()` inchangé 50 s → reset pilote ; 2ᵉ constat → scène suivante. Clé : objectif|relais|mécanismes|kills|plafond(30×PV colosse/PVmax). (5) Exception : journal 1×, dispose, scène suivante ; 3 exceptions/60 s → arrêt démo, titre fixe. (6) Transition : fondu noir 300 ms, génération + création pendant le noir ; préparer le monde suivant pendant la scène courante par tranches. (7) Mémoire : une seule sim vivante, `dispose()` systématique, cache limité à 2 mondes (game.js:31) ; **pas de remplacement de worker** (tas stable +0,01 Mo/monde mesuré sur 24 mondes). (8) `keepAwake` option ; `visibilitychange` → pause. (9) Durée illimitée bureau ; tactile 10 min. (10) Cache de démo séparé (`demoWorld`) pour ne pas évincer le monde du joueur.
- Preuve exigée : `node --expose-gc bancs/demo/cycle.mjs 6 900` : dérive tas < 0,5 Mo sur 12 rotations. `node --expose-gc bancs/demo/run.mjs 30 0 96 1` : 0 exception, 0 blocage. Chrome `file://` 10 min : `performance.memory` stable après 2 min, `createBuffer` constant, images > 33 ms seulement pendant les fondus.
- Qualité : meilleure.
- Garde-fous : gel de génération 260-460 ms masqué par le fondu (mobile ×3-5) ; mémoire GPU non mesurée en navigateur ; seuils 50 s / 240 s réglables par jeu.
- Dépend de : T4.

### T6 — Démo = banc d'endurance rejouable [STAB-09]
- Où : src/game.js:165, 166-177, 675-722, 721 ; src/simulation.js:2220 ; bancs/demo/ ; bancs/loop/harness.mjs
- Quoi : Paramètres URL `demo=1` et `bench=180` (secondes). En mode banc : pas fixe 1/60 s, rendu non bridé, trois scènes fixes de 60 s jouées par le pilote (monde 1 départ ; monde 7 arsenal ; colosse monde 13). Sortie JSON dans `document.body.dataset.bench` et console : histogramme intervalles d'image, p50/p95/p99/max, 1 % le plus lent, images > 25 ms, temps `sim.step` et `draw`, `renderer.stats`, empreinte d'état par scène. Critères d'endurance 10 min : médiane dernière minute ≤ 1,1 × première ; aucune image > 6 × médiane hors changement de monde ; tas stable ±5 %. Deux exécutions → même empreinte.
- Preuve exigée : Chrome `file://` avec `demo=1&bench=600` : rapport FTrace conforme aux critères ; deux exécutions → empreinte identique.
- Qualité : meilleure.
- Garde-fous : dépend de T11 pour le pas fixe en banc (pas en démo affichée) ; pas de dérive mesurée (STAB-02 non requis) ; taille ≈ 1 Ko pour le mode banc.
- Dépend de : T3, T4, T5, T11.

### T7 — Navigation du pilote : A* hors simulation [DEMO-05]
- Où : src/simulation.js:2219, 1402-1433, 1349-1377, 517-522 ; bancs/demo/pilot.mjs
- Quoi : Exporter `sim.nav.component(x, z)` (O(1) joignabilité) et `sim.nav.path(ax, az, bx, bz, {radius:.4, avoid})` (liste de points + traction de corde). Budget 600 nœuds/pas, recherche reprenable (état au pilote, jamais sauvegardé). Pendant la recherche, pilote garde l'ancien chemin. `avoid` reçoit le masque des disques (T8). **En attendant IA-01/IA-05** : garder cache paresseux, tester 400 arêtes/pas, vider uniquement cellules < 6 m d'une porte ou explosion.
- Preuve exigée : `bancs/demo/run.mjs 30 0 96 1` avant/après : ligne `think` p99,9 < 0,5 ms, max < 2 ms, décisions > 4 ms → 0 (avant : max 55-100 ms, 1,4-2,0/min > 4 ms). Même progression (mondes terminés). Empreinte inchangée quand pilote remplacé par rejeu.
- Qualité : identique.
- Garde-fous : deux fonctions de plus dans l'API publique, ne modifient aucun état → sauvegardes et déterminisme inchangés ; budget en nœuds (pas ms) → déterminisme préservé.
- Dépend de : T3.

### T8 — Disques de propulsion exclus du graphe [DEMO-06]
- Où : src/simulation.js:367-374, 361-365 ; bancs/demo/pilot.mjs, pilot-v1.mjs
- Quoi : Dans le pilote : masque des cellules < r + 0,75 m de chaque `world.jumpPads`, exclues de l'A* sauf si aucun chemin alternatif ; traction de corde refusée si segment passe < r + 0,45 m d'un disque. (Version simulation avec arête orientée : différée, change les chemins ennemis → passe par `aiVersion` et tests.)
- Preuve exigée : `node bancs/demo/run.mjs 9 3 96 1` et `node bancs/demo/run.mjs 9 12 96 1` : mondes 4 et 13 terminés, 0 blocage. Référence : v1 monde 4 = 359,7 s + 1 blocage → v2 = 275,4 s + 0 blocage.
- Qualité : identique.
- Garde-fous : version pilote ne touche pas au jeu ; version simulation (arête orientée) modifie chemins ennemis → `aiVersion` + tests.
- Dépend de : T7.

### T9 — Garde-fous de survie (réduit) [DEMO-07]
- Où : src/simulation.js:771-783, 1960, 2081 ; src/game.js:178 ; bancs/demo/session.mjs
- Quoi : (1) Difficulté forcée à 0 en démo. (2) Mort en démo : fondu puis `restore()` du dernier point de reprise (après LOAD-01), sinon réouverture du monde, scène suivante à la 3ᵉ mort. (3) Durée de scène bornée (T5) : colosse 9 600 PV ne retient pas > 4 min. **Pas d'option `demo` dans `hurt()` ni `restore()`** (la cause réelle est l'Onde, traitée en T1 ; `incomingMultiplier` économie offre déjà ×0,5). (4) Aide de régénération hors simulation : **abandonnée** (dérive au pas 5940).
- Preuve exigée : Six courses `bancs/demo/run.mjs` de 9 min (mondes 1, 4, 7, 10, 13, 16) avec T1 : 0 mort, `assistHp` en baisse. `replay.mjs` : rejeu identique.
- Qualité : sans objet.
- Garde-fous : l'option `demo` ne doit jamais entrer dans les points de reprise joueurs (validation `restore`) ; valeurs `.35/40/12` non retenues (insuffisantes, mesuré).
- Dépend de : T1, T5.

### T10 — Fermer les sources de divergence + digest pur [DEMO-09, DEMO-V2]
- Où : src/game.js:677, 690, 746, 248, 763, 98 ; src/brain.js:93-101 ; src/simulation.js:1500-1505, 1944-1945, 1908 ; bancs/demo-verif/verif3.mjs, verif4.mjs
- Quoi : (1) Enregistrement d'une partie humaine : stocker `dt` en ticks de 1/48000 s sur 16 bits (2 octets/pas) ; simulation reçoit `ticks/48000`. (2) `FBrain` forcé `cpu` pendant enregistrement/rejeu/démo, noté dans l'en-tête. (3) Chaque appel hors flux (`selectLeftWeapon`, `buy`, `setDifficulty`, `snapshot`, `restore`) devient une **commande datée** du flux (T14). (4) `snapshot()` rendu neutre : retirer `invalidateBrain()` et `pumpNav()` (simulation.js:1944-1945) ; tant que non fait, enregistrer comme commande. (5) Exporter `sim.digest()` : fonction pure, sans allocation, FNV-1a 32 bits sur tous les champs numériques/énumérés (joueur, ennemis dont tactic/goalX/goalZ/planWait/attackState, projectiles, attaques colosse, gravats au repos, temps, kills, relays, révision destruction). Coût < 0,1 ms pour 200 ennemis, appelé toutes les 600 pas. (6) Règle CONTRACT.md : rien n'écrit dans `sim.state` hors simulation.
- Preuve exigée : `bancs/loop/harness.mjs` : enregistrer 60 s avec intervalles irréguliers (16,7 ± 4 ms), rejouer avec d'autres intervalles → même empreinte toutes les 60 pas. `verif4.mjs` : `firstFullStateDivergence` = null. `verif3.mjs` : `finalFullStateEqual` vrai.
- Qualité : identique.
- Garde-fous : `snapshot()` neutre change la suite post-reprise (déterministe mais différent) → vérifier `tools/campaign-profiles.mjs:69` ; format sauvegardes inchangé ; pas fixe réservé au banc/rejeu (T11).
- Dépend de : T14 (format commandes).

### T11 — Pas variable pour la démo affichée [DEMO-V3]
- Où : src/game.js:677, 690-696 ; bancs/demo-verif/hz.mjs, session-hz.mjs
- Quoi : (1) Démo affichée : **boucle normale du jeu** (dt de l'image, sous-pas internes 1/120 s pour joueur/physique) ; `pilot.think(input, part)` avant chaque `sim.step`. (2) Banc `?bench=1` et rejeu : pas fixe 1/60 s, rendu non bridé. (3) `FDemo.runner` ne contient pas d'accumulateur (T5). (4) Pilote : seuils en secondes, jamais en nombre de pas. (5) Option désactivée : pas global 1/120 s.
- Preuve exigée : `HZ=30 node bancs/demo-verif/hz.mjs 8 0` et `HZ=144 node bancs/demo-verif/hz.mjs 8 0` : mondes terminés, 0 blocage. Chrome 144 Hz : 0 image avec pose caméra identique à la précédente sur 10 s de démo (avant : 58,3 %).
- Qualité : meilleure (fluidité à 120/144/240 Hz, règle 1 de David).
- Garde-fous : démo pas variable non rejouable bit à bit entre machines (sans importance, non enregistrée) ; durées de monde varient ±10 % selon cadence → durées de scène = plafonds.
- Dépend de : T3, T4.

### T12 — Rejeu comme banc reproductible [DEMO-10]
- Où : bancs/demo/abreplay.mjs, session.mjs ; src/game.js:723-729 ; bancs/sim/full-v2.mjs
- Quoi : (1) Mode banc `?bench=1` (T6). (2) `FDemo.stats()` : histogramme à seaux fixes, percentiles, sans allocation/image. (3) `npm test` : `checks/demo.test.mjs` joue 3 scènes de 20 s, compare empreintes à `checks/demo-reference.json` (régénéré par outil explicite). Non-régression perf en compteurs déterministes (`segmentFree`, `ground`, nœuds A* au pire pas), pas en ms. (4) `tools/replay-ab.mjs` : rejeu apparié/alterné de deux versions, égalité d'état exigée, rapport temps.
- Preuve exigée : `node bancs/demo/abreplay.mjs 120 6` : `A_equals_record` et `B_equals_record` vrais. `checks/demo.test.mjs` échoue si constante de combat modifiée. Gain mesuré : -69 % à -78,5 % temps CPU simulation, état complet identique (4,42 Mo JSON + 188 Ko snapshot octet pour octet).
- Qualité : identique.
- Garde-fous : référence régénérée à chaque changement voulu → outil + AGENTS.md ; `node:vm` 5× plus lent → charger dans domaine principal ; +1 Ko page.
- Dépend de : T10, T14.

### T13 — FDemo.director : ordonnanceur de plans [DEMO-02]
- Où : src/demo.js ; src/game.js:720-722 ; références : point-de-rupture/Jeu/src/camera.js:364-374, 396-531 ; bitume/src/realisateur.js:13-28, 50-88
- Quoi : `FDemo.director({seed, shots, fly})` → `{update(dt, ctx)→{shot, pose, cut}, reset()}`. Plan : `{id, weight(ctx), duration:[min,max], valid(ctx), cutIf(ctx,age), pose(ctx,age,dt)→{pos,yaw,pitch,fov}}`. Noyau : temps simulé uniquement ; `mulberry32(seed)` ; tirage pondéré excluant plan précédent ; coupe fin durée ou `cutIf` ; vol amorti `6t⁵-15t⁴+10t³`, durée `clamp(dist/160+1,8 ; 2,2 ; 5,5)` s. Catalogue METAL : « yeux » (poids 60, 12-25 s) ; « surveillance » (poids 15, 6-9 s, valide si `sim.sight` dégagé) ; « colosse » (orbite 20-26 m, poids 40 combat, 6-10 s) ; « survol » (4 s ouverture monde). Avant pose extérieure : `sim.ray` cible→caméra, rapprocher si obstacle.
- Preuve exigée : Test FERRO : même graine + contexte → même suite ; durées dans [min,max] ; jamais même plan de suite ; saut position/image borné pendant vol. Test METAL : 5 min démo → ≥ 3 plans différents, 0 plan extérieur avec ligne bouchée.
- Qualité : meilleure.
- Garde-fous : plans extérieurs demandent un corps de joueur (gabarit FActors reteinté, arme masquée) → livrer après « yeux » ; ne pas modifier `camera.js` de Point de rupture avant enregistrement de l'autre session ; réalisateur reçoit `sim.state.time`, jamais horloge murale.
- Dépend de : T4.

### T14 — FDemo.recorder : format d'entrées compact [DEMO-08, DEMO-V4]
- Où : src/demo.js ; bancs/demo/session.mjs, replay.mjs ; bitume/src/course.js:89, 326-345 ; src/simulation.js:1946
- Quoi : Conteneur : 4 octets « FDM1 », longueur en-tête 16 bits, en-tête JSON, corps. En-tête : `{format:1, game, gameVersion, simHash, simVersion, engine, hz:60, dtTicks, fields:[{name,type,scale}], scenes:[{seed,index,options,loadout,steps}], checksumEvery:600}`. Corps : enregistrements taille fixe (moveX/Y i8, lookX/Y **i16 au pas 1/8192 rad** ±4 rad, boutons u8, arme u8) ; table commandes hors flux (pas 32 bits, type, payload) ; empreinte `sim.digest()` (T10) toutes les 600 pas. **Pas de tampon circulaire** (restore non exact, 0/8 reprises réussies) : enregistrement depuis création de scène, 28,8 Ko/min brut, 9-13 Ko/min compressé (delta + `CompressionStream('deflate-raw')`). API : `FDemo.recorder(entête)` → `step(input)` rend entrée quantifiée ; `command(type, données)` ; `checksum(u32)` ; `end()→Uint8Array`. Lecture : `FDemo.player(octets)` → `next(input)`, `commandsAt(pas)`, `verify(pas, u32)`.
- Preuve exigée : `checks/demo.test.mjs` : aller-retour encode/decode exact valeurs limites ; en-tête refusé si `format` ou `simHash` diffèrent. `node bancs/demo/replay.mjs 100 6` : rejeu identique, taille 10,7-12,8 Ko/min (monde 1), 8,9-11,6 (monde 7).
- Qualité : sans objet.
- Garde-fous : enregistrement valable pour même `simHash` (refuser ou avertir) ; `Math` non identiques entre moteurs → empreintes signalent divergence ; quantification regard 1/8192 rad imperceptible, activée seulement en enregistrement.
- Dépend de : T10.

### T15 — Mise en valeur : scènes de démonstration [DEMO-12]
- Où : src/economy.js:53-58 ; src/world.js:1573 ; tools/campaign-profiles.mjs:77 ; bancs/demo/session.mjs ; bancs/boss/lib.mjs
- Quoi : Liste de scènes `{index, seed, loadout, spawn, maxSeconds}`. Arsenal d'entrée = récompenses boss des mondes précédents (bancs/boss/lib.mjs), munitions pleines. Ordre : monde 7 (mitraillette+pompe), colosse monde 13 (spawn couloir arène), monde 16 (arsenal complet), monde 2, colosse monde 5, monde 12, mélange par graine. Durées : 150-240 s exploration, 120 s colosse. Spawn déplacé à la création via `{...world, spawn}` (tools/campaign-profiles.mjs:77), vérifier `blocked()` faux. Pilote vitrine : roquette si 2 ennemis dans rayon 4,2 m ou près décor destructible ; changer d'arme après 3 kills ; pistolet seulement si reste vide.
- Preuve exigée : 10 min de la liste : chaque arme ≥ 20 tirs, ≥ 3 combats colosse entamés, ≥ 100 révisions de destruction (chiffres `session.mjs`).
- Qualité : meilleure.
- Garde-fous : scènes colosse **à livrer après T1** (sinon mort vedette) ; spawn déplacé testé par scène (déterminisme) ; arsenal démo jamais dans sauvegarde (T4).
- Dépend de : T1, T3, T4, T5.

### T16 — Critères d'acceptation et tests [DEMO-13]
- Où : bancs/demo/run.mjs, cycle.mjs, replay.mjs ; src/simulation.js:526, 818, 1113 ; point-de-rupture/Jeu/verifications/apercu-interface.py:704-741
- Quoi : (1) Durée : 30 min simulées, ≥ 4 mondes, 0 exception, 0 blocage, **0 mort** (après T1). (2) Mémoire : dérive < 0,5 Mo/12 rotations ; tableaux sous plafonds (180 particules, 48 projectiles, 24 explosions) ; Chrome 10 min : tas ±1 Mo, `createBuffer` constant. (3) Fluidité : décision pilote < 2 ms max ; images > 33 ms seulement pendant fondus ; **aucune image répétée à 120 et 144 Hz** (T11). (4) Départ : 5,0-5,7 s ; jamais options ouvertes/onglet caché/option coupée. (5) Sortie : clic/touche/toucher/molette/manette → titre même événement, 0 pas ensuite, clic avalé 600 ms, sauvegarde inchangée, pointeur jamais verrouillé, touche de modification seule ne sort pas. (6) Déterminisme : 100 s rejoué, empreintes `sim.digest()` égales/60 pas ; deux enregistrements identiques ; monde × 6 même empreinte. Tests : `checks/demo.test.mjs` FERRO (automate, ordonnanceur, codec) ; `checks/demo.test.mjs` METAL (3×20 s contre référence, critères 5-6 sur faux DOM) ; `tools/demo-soak.mjs` hors `npm test` (critères 1-2) ; Chrome `file://` (critères 2-5).
- Preuve exigée : `node --expose-gc bancs/demo/run.mjs 30 0 96 1` ; `node --expose-gc bancs/demo/cycle.mjs 6 900` ; `node bancs/demo/replay.mjs 100 6` ; `node bancs/demo/abreplay.mjs 120 6`.
- Qualité : sans objet.
- Garde-fous : essai long hors `npm test` ; seuils à recaler une fois pilote définitif ; mémoire GPU nécessite vraie machine graphique.
- Dépend de : T1-T15.

### T17 — Gouverneur de résolution en démo [DRAW-V4]
- Où : src/game.js:722 ; src/renderer.js:806-818 (FERRO) / 746-758 (METAL)
- Quoi : Introduire prédicat `sceneLive` (partie en cours **ou** démo, hors pause) ; passer `adaptive: sceneLive && limiteFPS compatible`. Retirer `document.hasFocus()` de la condition pour la démo ; garder veille quand `document.hidden`. Ajouter `stats.renderScale` au relevé démo.
- Preuve exigée : `bancs/loop/harness.mjs` : 30 min démo simulées, relevé `stats.renderScale` + temps `draw` par tranche de 5 min ; dérive < 5 % première/dernière tranche ; échelle baisse puis remonte quand on injecte des images lentes.
- Qualité : sans objet.
- Garde-fous : gouverneur réalloue cibles à chaque palier (RGPU-09) → à-coups tant que non refondu ; rAF ralenti sans focus → filtrer intervalles aberrants (déjà borné 500 ms) ; aucun effet simulation/sauvegardes.
- Dépend de : T4.

## Options désactivées par défaut
- Pas global 1/120 s (arbitrage STAB-06) — la sous-division interne à 1/120 s du joueur/physique suffit ; un pas global double le coût sans gain mesuré.
- `keepAwake` (T5) — demande de veille d'écran peut être refusée (Safari, économie) ; échec silencieux.

## Écartés ou absorbés
- [LOOP-V1] — Absorbé par T2 (attract), T3 (pilote), T4 (mode démo). Constat de synthèse non recontrôlé ; chaque point est couvert par une tâche dédiée.
- [PARA-12] — Absorbé par T5 (runner sur fil principal). La contre-vérification PARA-V4 corrige : pas de worker pour la démo (étape 4 d'un plan XL non requis), pas de remplacement de worker tous les 6 mondes (tas stable +0,01 Mo/monde).
- [STAB-V2] — Absorbé par T4 (mode distinct, blur, wakeLock, chien de garde) et T5 (blocage, transitions).
- [RESTE-V1] — Absorbé par T4 (drapeau demo, sauvegarde neutralisée, transitions automatiques) et T11 (pas variable).
- [LOAD-V2] — Absorbé par T5 (cache séparé, fondu, durée bornée) et T4 (sauvegarde neutralisée).
- [DEMO-V4] — Absorbé par T14 (pas de tampon circulaire, enregistrement depuis création de scène). La reprise exacte est différée après LOAD-01.

## Décisions à confirmer par David
- Résolution native vs adaptation automatique si la machine ne tient pas 60 fps en démo (NATIF-V1) — valeur par défaut : native, le joueur choisit dans les options ; le gouverneur (T17) ne baisse que si le joueur l'active.
- Garder le monde de la démo en fond du titre après sortie (T4, point 6) — valeur par défaut : oui (sortie en une image, 260-460 ms évités) ; alternative : fond noir.
- Harmoniser le clic avalé à 400 ms (BITUME) ou 600 ms (Point de rupture) — valeur par défaut : 600 ms (plus prudent, évite les doubles-clics).
- Durée max démo sur tactile : 10 min (T5) ou 30 min — valeur par défaut : 10 min (batterie).

## Gains attendus du lot
Démo sans fin sur bureau (mesuré : tas +0,01 Mo/monde sur 24 mondes, 0 exception sur 120 min simulées, 5 mondes/30 min par le pilote). Sortie en une image : 260-460 ms de CPU évités sur le fil principal. Fluidité à 144 Hz : 0 % d'images répétées (contre 58,3 % avec un pas fixe 60 Hz). Rejeu exact : état complet identique (4,42 Mo JSON + 188 Ko snapshot octet pour octet), permettant de prouver chaque optimisation future en une commande. Décision pilote sous 2 ms max (contre 55-100 ms), éliminant la saccade toutes les 30-45 s. Sauvegarde du joueur intacte (0 écriture localStorage en démo, vérifié octet pour octet).
