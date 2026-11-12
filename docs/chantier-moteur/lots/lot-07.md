# Lot 07 — Cadence, échauffement, chargement et travail hors du fil principal
## But
Rendre la simulation indépendante de la cadence d'affichage (pas fixe 1/60 + accumulateur + interpolation), échauffer le code et les shaders avant la première image, et sortir du fil principal la génération du monde, la synthèse audio et la cuisson de navigation. Aucune tâche n'ajoute de saccade ni ne dégrade l'image.

## Tâches, dans l'ordre

### T1 — Boucle de jeu : pas fixe 1/60, accumulateur, interpolation [STAB-06, LOOP-05]
- Où : src/game.js:676-677 ; src/game.js:690-696 ; src/game.js:718-722
- Quoi : remplacer `steps=Math.max(1,Math.ceil(dt*60))` (game.js:690) par un module `src/loop.js` (FLoop.create({hz:60, maxSteps:5})) : intervalle brut borné 250 ms ; période = moyenne glissante de 30 intervalles normalisés ; verrouillage si période à moins de 1 % du pas (dilatation ≤ 0,33 ms) ; dette résorbée à 10 %/image bornée ±2 ms ; accumulateur initialisé à 0,999 pas ; au plus 5 pas/image, surplus abandonné et journalisé. Avant chaque pas, mémoriser position joueur/ennemis visibles/projectiles ; rendre à position interpolée par alpha (pas d'interpolation si saut > 2 m) ; lacet et tangage immédiats. Sous-pas internes à 1/120 s pour locomotion (simulation.js:432) et projectiles (1068). pumpNav : NE PAS modifier (la contre-vérification casse checks/simulation.test.mjs:1866) ; si nécessaire, borner par `min(768, ceil(30720*dt))`. Option « pas 120 Hz » désactivée par défaut ; pas 120 Hz automatique quand période détectée < 10 ms (coût mesuré 27,3 vs 23,1 ms/s).
- Preuve exigée : `node bancs/loop/cadence.mjs <racine> c0 30` → « hash distincts : fixed60 1 », colonne cpu/s constante ; STRAIGHT_ONLY=1 → CV% = 0 ; test ajouté dans checks : même empreinte pour 60, 75, 120, 144 Hz et horodatages arrondis ; écart temps simulé/temps réel < 1 pas sur 10 min pour chaque motif d'horodatage.
- Qualité : meilleure (régularité, rejouabilité, fin de la bimodalité 1 ou 2 pas).
- Garde-fous : trajectoires changent vs aujourd'hui (pas de 1/60 fixe) mais restent déterministes pour une suite de dt donnée ; tests de simulation (step(.025), progression.test.mjs:136-142) inchangés ; sauvegardes inchangées ; latence hors verrouillage = demi-pas (8,3 ms) sur la position, 0 sur les angles ; état précédent par acteur (~12 flottants/ennemi visible).
- Dépend de : rien (STAB-V1 en lot 01 corrige la formule en une ligne en attendant).

### T2 — Corriger l'écho input.weapon et stepFrame [PARA-V2]
- Où : src/game.js:686 ; src/game.js:691-695 ; src/game.js:221 ; src/game.js:237 ; src/simulation.js:1908 ; src/simulation.js:611 ; src/simulation.js:593
- Quoi : (1) `input.weapon` renseigné uniquement sur l'image d'un geste (molette, touche, tactile), sinon `undefined` ; `selectedWeapon` devient une copie de `sim.state.weapon` pour l'affichage. (2) Exposer `FSimulation.stepFrame(dt, input)` : découpage en sous-pas, remise à zéro des entrées ponctuelles après le premier, arrêt après un sous-pas ayant émis shopOpen/win/dead, rend le nombre de sous-pas exécutés. (3) game.js appelle `events()` une fois après stepFrame.
- Preuve exigée : test simulation : ramassage d'arme + 3 pas sans input.weapon → arme conservée ; même test avec stepFrame(1/30) (2 sous-pas) ; rejeu 4 scénarios × 1 800 pas → empreinte égale avant/après.
- Qualité : identique.
- Garde-fous : events() regroupé en fin d'image déplace des sons de ≤ 8 ms dans les images à 2 sous-pas (vérifier à l'oreille) ; les tests passant input.weapon à chaque pas restent valides.
- Dépend de : T1 (stepFrame intègre le découpage de STAB-06).

### T3 — Build par rôles : séparer page, shared, sim [PARA-10]
- Où : tools/build.py:6-8 ; src/destruction.js:13 ; src/simulation.js:78 ; src/brain.js:63
- Quoi : modifier tools/build.py pour émettre un script par module avec attribut `data-role` : « page », « shared » (data-worker, exécuté aussi dans la page), « sim » (type text/plain + data-worker). Tant que la simulation tourne sur la page, les modules sim restent « shared » : aucun changement visible. Worker toujours en script classique (jamais module). Sauvegardes écrites par la page (localStorage). Repli complet : Worker/Blob/createObjectURL absents ou erreur avant « ready » → même code sur le fil principal. Mobile : mode worker proposé seulement si `navigator.hardwareConcurrency ≥ 4`.
- Preuve exigée : checks/build.test.mjs : la page contient les scripts data-worker dans l'ordre, reste sous 1 400 000 octets ; test de l'hôte avec un faux document ; `node bancs/para/chrome/caps.html` rejoué sur la page construite.
- Qualité : identique.
- Garde-fous : budget 0,69 Mo sur 1,4 Mo, surcoût estimé 12-15 Ko ; Safari et Firefox en file:// à vérifier avant activation par défaut ; audio.js et music.js (66 Ko) à marquer « shared » si T12 est fait.
- Dépend de : rien.

### T4 — Module d'exécution hors fil principal : plan et socle [PARA-11, PARA-V1, PARA-V3]
- Où : src/host.js (nouveau) ; src/worker.js (nouveau) ; src/protocol.js (nouveau) ; src/game.js:166-177
- Quoi : créer trois fichiers. `FHost.create({onMessage, onCrash, selector, forceMain, name})` rend {mode, reason, post, request, dispose} ; un seul worker par page, créé au chargement pendant le menu ; message `{t:'reset'}` au lieu de terminate ; chien de garde (ping 1 s, panne après 3 s) suspendu quand `document.hidden` ; cadence « image » (un message d'entrée par rAF) ; recyclage de tous les tampons transférés. `FWorker.serve({jobs, sim})` se branche sur self.onmessage. `FProto` (voir T11). Règle inscrite (PARA-V1) : FHost ne dessine jamais hors rAF ; le mode worker ajoute 1 image de latence (mesuré : dessin hors rAF remis 17,6-17,7 ms après, 120/120 essais). Tâche « warm » au menu : générer le premier monde, créer la sim, exécuter 120 pas jetables (PARA-V3 : premiers pas 2-3,5× plus lents à froid, pas max 8-10 ms → 1,5-3 ms chaud).
- Preuve exigée : tests verts (hote.test.mjs porté + request/réponse + chien de garde horloge factice + 0 allocation après 100 états) ; Point de rupture passe avec l'alias ; un jeu v0.2 qui n'appelle pas ces modules produit la même page.
- Qualité : identique.
- Garde-fous : +6-8 Ko par jeu ; taille totale ~12-15 Ko ; mémoire worker ~+6 Mo ; le seuil hardwareConcurrency ≥ 4 est une hypothèse à valider sur appareil.
- Dépend de : T3 (build par rôles).

### T5 — Génération du monde hors du fil principal [PARA-06]
- Où : src/game.js:31 ; src/game.js:133-151 ; src/game.js:166-177 ; src/destruction.js:13 ; src/simulation.js:78 ; src/simulation.js:1379-1391
- Quoi : tâche `host.request('world', {seed, index, options})`. Mode B (par défaut, sim sur la page) : le worker génère FWorld.create (130-159 ms à froid, 94-111 ms chaud) puis envoie le monde en messages de 2 000 maillages au plus (désérialisation 2-3 ms/message) ; FSimulation.create (44-94 ms) reste sur la page. Mode A (option, sim en worker) : le worker crée aussi la sim et cuit la navigation ; la page reçoit les maillages empaquetés (22 nombres/maillage + dictionnaire 1 240 chaînes, 1,26 Mo ; empaquetage 6 ms worker, reconstruction 1,5 ms page). Extraire foliageTriangles dans un module géométrie partagé. Préparer le monde suivant pendant le jeu (game.js:31 cache de 2 mondes rempli à l'avance).
- Preuve exigée : test Node : FNV du JSON du monde et empreinte sim après 900 pas égaux entre monde local, cloné, cloné en tranches (clone-world.mjs → test) ; banc Chrome : image max ≤ 17 ms pendant la génération, plus longue tâche ≤ 4 ms à l'arrivée.
- Qualité : identique.
- Garde-fous : format maillage doit couvrir les 19 clés (shape, p, s, mat, color, r, emissive, detail, region, category, surface, destructibleId, assembly, trophyId…) ; destructibleId est une chaîne pour 13 437/13 956 maillages ; sauvegardes inchangées (monde régénéré depuis graine) ; mode B : +25 Mo transitoire.
- Dépend de : T4 (hôte).

### T6 — Découpage du chargement et retour au menu [LOAD-08]
- Où : src/game.js:166-177 ; src/game.js:133-151 ; src/game.js:105-123 ; src/game.js:760-761 ; src/game.js:190
- Quoi : (1) Découper action() en étapes séparées par `await nextFrame()` : cachedWorld → FSimulation.create → setWorld → restore ; barre avance de 76 % à 100 %. (2) Mort puis « Reprendre » sur le même monde : sauter load(), appeler `sim.restore(checkpoint)` sur la sim courante puis `renderer.updateWorld`. (3) back-menu et pause-main (game.js:760-761) : afficher le menu immédiatement, laisser preparePlay charger au lancement. (4) Le monde suivant sur l'écran « cleared » (game.js:190) est généré par étapes, pas en une tâche de 200-400 ms.
- Preuve exigée : Chrome file:// panneau Performance : plus longue tâche au lancement ≤ 180-250 ms (FWorld.create seul) ou ≤ 90-160 ms avec caches LOAD-07 ; reprise ≤ 100 ms ; menu ne se fige pas.
- Qualité : identique.
- Garde-fous : le Worker pour le monde (point 2 de la proposition initiale) est réfuté par la contre-vérification (structuredClone 99-289 ms) ; ne PAS l'implémenter ici, c'est T5 qui le fait correctement. Tests progression et checkpoint inchangés.
- Dépend de : rien (indépendant de T5 ; T5 améliore le résultat mais T6 est autonome).

### T7 — Shaders : compilation non bloquante et échauffement des pipelines [STAB-04]
- Où : src/renderer.js:1288-1298 ; src/renderer.js:1337-1338 ; src/renderer.js:1414-1421
- Quoi : (1) Ne plus appeler getShaderParameter dans compile() ; lancer les 5 linkProgram d'affilée ; reporter getUniformLocation (renderer.js:1339+) ET la lecture LINK_STATUS à la première utilisation ou après COMPLETION_STATUS_KHR. (2) Si KHR_parallel_shader_compile exposé, exposer `renderer.ready()` : promesse interrogeant COMPLETION_STATUS_KHR à chaque image du chargement, sans bloquer. (3) `renderer.warm(camera)` : dessiner une fois chaque programme × état (opaque, profondeur, ciel, particules, surimpression, post-traitement) dans un viewport 1×1 pendant le chargement. (4) Secours Canvas 2D : prévoir un canvas de remplacement (le contexte webgl2 existant empêche createSoftware sur le même canvas).
- Preuve exigée : `node bancs/gen-shader.mjs <racine> shader.html` puis `./run-chrome.sh shader.html <profil neuf>` : statusMs ≈ 0, plain[0] ≈ plain[5] ; à refaire sur PC NVIDIA (ANGLE D3D11, non mesuré).
- Qualité : identique.
- Garde-fous : sans appel à ready()/warm(), comportement v0.2 inchangé ; erreur de shader levée au premier draw ou dans ready() (même message, même repli) ; restauration de contexte (renderer.js:1587) rappelle initialize() en pleine session.
- Dépend de : rien.

### T8 — Ordonnanceur de tâches à budget par image [STAB-07]
- Où : src/audio.js:281-304 ; src/game.js:94-103 ; src/game.js:133-151 ; src/game.js:166-177 ; src/simulation.js:1379-1391 ; src/music.js:208-231
- Quoi : `src/schedule.js`, FSchedule.create({now}). add({lane, priority, cost, key, run(deadline)}) ; cancel(key) ; pump(budgetMs) appelé une fois/image après dessin, budget = min(4 ms, 0,85 période − travail image), jamais dans une image en retard ; pumpSim(unités) à un point fixe du pas ; flush(key) force une tâche (compté saccade). File « sim » : unités de travail (cuisson nav, A*), ordonnée par priorité puis ordre → même résultat toutes machines. File « image » : pré-synthèse audio, module musique, génération monde suivant, repaquetage, écriture sauvegarde. Une tâche > budget ne part que si rien n'a tourné dans l'image ; vieillissement anti-faim. Point de reprise : instantané synchrone, stringify + setItem différés, vidés sur pagehide.
- Preuve exigée : `node bancs/sched.mjs <racine>` : plusLongueTacheMs ≤ 32 ms (vs 66-86 ms actuel) ; banc STAB-01 : aucune image de point de reprise > 1,5× médiane ; test unitaire file « sim » : même découpage pour même nombre d'unités.
- Qualité : identique.
- Garde-fous : déterminisme impératif (règle 1) ; sauvegarde différée → vidage pagehide + visibilitychange ; ~1,5 Ko ; les jeux v0.2 sans pump() inchangés ; le seul gain mesuré en jeu est 1,0-2,9 ms sur l'image de point de reprise.
- Dépend de : rien.

### T9 — Échauffement du code de simulation avant la première image [STAB-03]
- Où : src/game.js:133-151 ; src/game.js:166-177 ; src/simulation.js:1901 ; src/simulation.js:1106 ; src/soundscape.js:39
- Quoi : dans preparePlay, après préparation audio, exécuter une simulation jetable (FSimulation.create sur le même monde en cache, jamais la vraie) : 240 pas de 1/60 avec script tirant 0,8 s par arme (5 armes), esquive, onde, crosse, explosion (destruction.blast), 60 pas dans l'arène colosse. Pour ces états : soundscape.sample/event, FEffects.build, FActors.build, models. Trois renderer.draw cachés (voir T7). Dispose. Borné 150 ms/image, 1 s total (mobile). Ne jamais jouer de son.
- Preuve exigée : `node bancs/warm-ab.mjs <racine> c0 cold` puis `warm`, 3 paires : première image ≤ 1,5× médiane (mesuré : 23,6-26,4 → 4,5-7,6 ms) ; première explosion ≤ 1,2× suivantes (29,8-33,4 → 16,1-23,6 ms) ; empreinte finale identique (87698713, 1 200 pas).
- Qualité : identique.
- Garde-fous : simulation jetable isolée (aucun partage d'état mutable avec le cache game.js:31) ; allonge le chargement de 0,1-0,3 s sur machine calme ; une seule fois par chargement de page (V8 reste chaud d'un monde au suivant) ; sauvegardes et tests inchangés.
- Dépend de : T8 (budget de l'ordonnanceur).

### T10 — Vue de simulation : séparer les lectures de la page [PARA-02]
- Où : src/game.js:141 ; src/game.js:193-237 ; src/game.js:256 ; src/game.js:290 ; src/game.js:418-586 ; src/game.js:587-674 ; src/game.js:675-722 ; src/soundscape.js:26-40 ; src/simulation.js:2219
- Quoi : écrire `src/simview.js` : liste déclarative des champs lus par la page (scalaires + listes). Remplacements : (1) isAlive → Uint8Array « vivant » par id, renvoyé à chaque révision de destruction (supprime 98 appels/image). (2) Occlusion sonore : FSoundscape.sample exécuté côté sim, 8 valeurs publiées. (3) HUD : nearestInteraction + stats publiés toutes les 0,09 s. (4) Marqueurs d'attaque : 3 hauteurs de sol par ennemi < 24 m publiées. Écritures → commandes `{t:'weapon', slot}` ; événements livrés avec l'état. Faire sur le fil principal d'abord ; le passage en worker devient un changement de transport.
- Preuve exigée : census.mjs transformé en test : page tourne 60 s sur 3 mondes + boss avec miroir proxy ; échoue à la première lecture hors schéma, appel direct à sim, ou écriture.
- Qualité : identique.
- Garde-fous : recensement initial incomplet (bullets, projectiles, bossAttacks, hazards vides à 20 s) ; ajouter au schéma : mechanisms[].name, enemies[].bossName, encounters[].waves.length, encounters[].requiresTrophy ; input.weapon est un écho (PARA-V2), pas une commande ; events() entre sous-pas (game.js:691-695) ; sauvegardes et 262 tests inchangés.
- Dépend de : T2 (stepFrame clarifie le flux).

### T11 — Protocole de transfert : Float64Array typé [PARA-03]
- Où : bancs/para/schema.mjs ; bancs/para/proto.mjs ; src/simulation.js:2219
- Quoi : `src/protocol.js`, FProto.compile({scalars, lists, strings}) rend {needed, pack(state, f64)→longueur, unpack(f64, mirror, dict)}. Règles : Float64Array par défaut (0 nombre différent sur 3 173-3 984) ; en-tête [version, tick, temps simulé, nb scalaires] ; compteur par liste ; chaînes par indice de dictionnaire ; **schéma typé** (nombre, booléen, chaîne, facultatif) — PAS « booléens en 0/1, absent en NaN » (la contre-vérification trouve 28-29 % de changements de type) ; unpack restitue le type d'origine (v!==0 pour booléen, masque de présence pour absent) ; tampon pris dans réserve de 4, rendu par {t:'ret', buf} ; événements en petits objets clonés (0-5/image) ; unpack remplit des objets réutilisés aux mêmes noms. Code généré par new Function (variante boucles si CSP).
- Preuve exigée : test Node : aller-retour pack→unpack avec Object.is sur TOUS les champs (type inclus), 4 scénarios × 900 pas → 0 différence ; 0 allocation après 10 états ; banc proto.mjs : fil principal ≤ 0,15 ms/image moyenne.
- Qualité : identique.
- Garde-fous : new Function exige 'unsafe-eval' si CSP (garder variante boucles) ; surcoût dépaquetage pour restituer les types ; ~3 Ko ; sauvegardes inchangées.
- Dépend de : T10 (schéma de simview).

### T12 — Synthèse audio et musique dans un worker [PARA-07]
- Où : src/audio.js:11-13 ; src/audio.js:20 ; src/audio.js:89-91 ; src/audio.js:281-303 ; src/music.js:208-232 ; src/game.js:166-177
- Quoi : tâche 'fx' de l'hôte : le worker appelle FAudio.synthesize(name, variant, 22050) pour les 64 tampons (303 ms là-bas) et renvoie {name, list:[ArrayBuffer]} en transférant ; la page crée AudioBuffer + copyToChannel (0,72 ms total, max 0,042 ms/message). Tâche 'music' : FMusic.getModule (85-89 ms) ; FMusic.adopt(stage, bytes) pour le décodage. Lancer dès le menu (pas besoin d'AudioContext pour synthétiser). Pas d'AudioWorklet (refusé depuis Blob en file://).
- Preuve exigée : test Node : FNV des PCM égale entre voie worker et voie actuelle, 64 tampons + 3 modules ; banc offload.mjs audio : réception + copie ≤ 2 ms total, tâche max ≤ 0,1 ms (vs 58 ms actuel).
- Qualité : identique.
- Garde-fous : gain = barre de chargement fluide + premier lancement raccourci si lancé au menu ; dans un worker séquentiel unique, l'attente totale ne baisse pas ; ajouter audio.js + music.js (66 Ko) aux scripts « shared » ; tests audio existants inchangés ; ~+1 Ko.
- Dépend de : T4 (hôte).

### T13 — Caches par monde : destruction, empreinte, nav statique [LOAD-07]
- Où : src/destruction.js:120-137 ; src/simulation.js:512-516 ; src/simulation.js:236-237 ; src/simulation.js:2020 ; src/simulation.js:2215 ; src/game.js:31
- Quoi : WeakMap par objet monde : (a) entries (bornes + rotation maillages) et signature de destruction (destruction.js:125, 135) ; (b) empreinte du monde (simulation.js:236-237) ; (c) nav statique (Uint8Array) + sol statique (Float32Array, sans pièges/portes) calculés une fois ; la sim copie (nav.set) puis ne réévalue que les cellules touchées. (d) restore : séparer FDestruction en validate(snapshot) pur + commit, au lieu de recréer un second contrôleur (simulation.js:2020). (e) Reprise même monde : réutiliser la sim existante (T6).
- Preuve exigée : gen-time.mjs : simCreateMs et restoreMs à la seconde création ; gen-profile.mjs <racine> c:9 restore ; restore-diff.mjs ; `node --test checks/checkpoint.test.mjs checks/simulation.test.mjs`.
- Qualité : identique.
- Garde-fous : entries réutilisés comme g.active (destruction.js:128) → vérifier qu'aucun champ n'est écrit dans le cache (Object.freeze en test) ; mémoire +0,2 Mo/monde en cache ; atomicité validate (test simulation.test.mjs:1940) ; gains non mesurés (estimations de profil) ; à faire après LOAD-02/LOAD-V1 qui changent la nav.
- Dépend de : T6 (reprise sans load()).

### T14 — Points de reprise dans le worker [PARA-08]
- Où : src/game.js:94-103 ; src/game.js:193-237 ; src/simulation.js:1941-1959
- Quoi : quand la sim est dans le worker (option PARA-04) : à l'événement de point de reprise, le worker fait snapshot() + JSON.stringify et envoie {t:'save', tick, text}. La page garde la chaîne en mémoire et écrit localStorage dans requestIdleCallback (délai max 500 ms) + écriture immédiate sur pagehide. Format et localStorage inchangés.
- Preuve exigée : test Node : texte reçu du worker = JSON.stringify(sim.snapshot()) caractère pour caractère au même tick ; restore() l'accepte ; banc offload.mjs snap : coût fil principal ≤ 0,1 ms.
- Qualité : identique.
- Garde-fous : ne vaut que dans le mode worker (option) ; fermeture brutale dans les 500 ms → perte du dernier point (d'où pagehide) ; sur le fil principal, LOAD-03 + requestIdleCallback donnent l'essentiel du gain sans worker.
- Dépend de : T4 (hôte), option PARA-04 activée.

### T15 — Préparation du rendu dans le worker (révisions de destruction) [PARA-09]
- Où : src/renderer.js:1373-1382 ; src/renderer.js:1534-1584 ; src/game.js:152-156
- Quoi : NE PAS déplacer le rendu (OffscreenCanvas non activé). Quand la sim est dans le worker : à chaque révision de destruction, le worker calcule la liste des maillages retirés/ajoutés empaquetés + cellules d'index touchées (ce que updateWorld fait sur la page) et transfère ; la page met à jour ses tampons GPU. Complément de RCPU-02 et LOOP-04. OffscreenCanvas gardé derrière un réglage pour un cas futur de fil principal saturé.
- Preuve exigée : test Node : tampons d'instances du worker = octet pour octet à ceux d'updateWorld sur la page pour la même révision ; banc rcpu/destr.mjs : coût par révision sur le fil principal.
- Qualité : identique.
- Garde-fous : estimation non mesurée (24-31 ms → < 1 ms) ; dépend de PARA-04 ; OffscreenCanvas WebGL2 à vérifier Safari/Firefox ; aucune dégradation d'image.
- Dépend de : T4 (hôte), option PARA-04 activée.

## Options désactivées par défaut
- [PARA-04] Simulation dans un worker (sim:'worker') — qualité dégradée : ajoute 1 image de latence (16,7 ms à 60 Hz, 8,3 ms à 120 Hz) sur déplacement, tir, impacts et sons (mesuré, PARA-V1). Gain résiduel après IA-01 et SIM-01-06 : ~0,1-0,2 ms/image (1 % d'une image). Utile au RTS et à la démo où la latence ne compte pas. Repli : ?sim=main.

## Écartés ou absorbés
- [PARA-05] — Réfuté par mesure (PARA-V1) : un dessin WebGL hors rAF est remis au compositeur à l'image suivante (120/120 essais, écart 1 rAF). Le mécanisme « dessin à l'arrivée + échéance par minuterie » ne rapporte rien et ajoute de la latence sur la visée. La prédiction de yaw/pitch reste valide (simulation.js:1909 seule écriture) mais avec recalage à chaque état reçu (simulation.js:1902 quitte step() avant cette ligne).
- [LOOP-05] — Absorbé par STAB-06 : la solution « pas variable borné à 1/40 s » est remplacée par le pas fixe 1/60 + accumulateur + interpolation (STAB-06, conception mesurée et contre-vérifiée). Le diagnostic (ceil(dt*60) fait 1,667 sous-pas à 60 Hz arrondis, +37-39 % CPU) est exact et résolu par STAB-06. La suggestion pumpNav en cellules/s est annulée par la contre-vérification (casse checks/simulation.test.mjs:1866).

## Décisions à confirmer par David
- Si une machine ne tient pas 60 images/s à la résolution native, le joueur choisit-il de baisser la résolution (option manuelle) ou le jeu reste-t-il bloqué à la native ? — valeur par défaut proposée : native verrouillée, message d'avertissement, aucune baisse automatique (règle 2).
- Pas 120 Hz automatique quand la période d'écran détectée est sous 10 ms (144 Hz+) : coût constant mesuré 27,3 vs 23,1 ms/s, latence réduite de 8,3 ms sur la position. — valeur par défaut proposée : activé (la règle 1 « vif » le commande).
- Le worker unique est créé au chargement pendant le menu (PARA-V3) : accepte-t-on +16-20 ms de démarrage de page pour éviter le froid à chaque monde ? — valeur par défaut proposée : oui.

## Gains attendus du lot
- **Cadence** : CPU de simulation −15 à −49 % selon l'écran (0,1-0,3 ms/image sur machine calme), un seul régime de pas, démo et banc rejouables (empreinte unique sur 15 cadences).
- **Chargement** : ~390 ms (audio + musique) + 90-208 ms (monde) de CPU retirés du fil principal ; plus longue tâche au lancement ramenée de 300-450 ms à ≈ 120-175 ms ; barre animée à 60 images/s.
- **Première image** : −68 à −83 % (23-26 ms → 4-8 ms) ; première explosion −21 à −46 % ; pire image des 10 premières secondes −40 à −45 %.
- **Démarrage shaders** : 40-90 ms de blocage en moins sur le fil principal (Metal) ; gain supérieur attendu sur PC NVIDIA (ANGLE D3D11, non mesuré).
- **Reprise** : ~2× plus rapide (−100 à −250 ms) avec les caches LOAD-07 ; menu immédiat.
- **Points de reprise** : 1,0-2,9 ms de moins par image (sous charge) avec l'ordonnanceur.
- **Régularité** : variation de vitesse perçue 0 % (vs ±4-8,6 % actuel) ; fin de la bimodalité 1 ou 2 sous-pas ; aucune saccade ajoutée.
