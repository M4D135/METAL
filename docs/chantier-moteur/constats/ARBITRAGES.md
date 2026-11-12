# Arbitrages entre constats et ordre de travail (critique du premier tour)

Écrit avant l'abandon du dépôt FERRO séparé : lire « FERRO » comme « modules moteur de METAL ».

## Conflits et arbitrages

### SIM-01, IA-02, BOSS-08, LOAD-02, LOOP-04, LOOP-02

**Problème.** Six constats réécrivent l'invalidation de la navigation après destruction (src/simulation.js:229-235, :300, :316, :912, :1379-1391), de trois façons incompatibles. Détection : diff numérique des boîtes ajoutées et retirées (SIM-01), Set de clés chaînes des seules boîtes retirées (LOAD-02), ou changedBounds fourni par la destruction (IA-02, BOSS-08, LOOP-04). Marges : 0,4 et 1,2 m (SIM-01), 0,41 et 1,25 m (LOAD-02), boîte élargie de 1 m (BOSS-08). Chemins : tous remis à zéro pour rester bit à bit (SIM-01), tous gardés « par monotonie » (LOAD-02, faux dès qu'une boîte est ajoutée), ou seuls ceux qui croisent la zone (IA-02, LOOP-04). Le gain est le même et ne se compte qu'une fois (−22 à −31 % du temps de simulation).

**Arbitrage.** Deux temps. A : SIM-01 tel que prototypé, seul à être prouvé identique bit à bit, avec ses marges. B : IA-02 (replanification sélective, composantes tenues à jour), qui change le comportement et fixe une nouvelle référence. Écarter le Set de chaînes et l'hypothèse de monotonie de LOAD-02. Garder de BOSS-08 le repli global au-delà de 25 % de la grille. Réécrire une seule fois checks/simulation.test.mjs:1862-1872, que trois constats cassent.

### IA-01, LOOP-02, BOSS-07, LOAD-04, SIM-12, IA-03, IA-04, IA-08

**Problème.** Les mêmes pointes d'A* vers une zone inaccessible sont comptées quatre fois (IA-01 : 13–22 → 2,5–8,6 ms ; LOOP-02 : 97–175 ms ; BOSS-07 : 126–191 → 18–22 ms ; LOAD-04 : 42–69 ms) : les gains ne s'additionnent pas. Quatre budgets par pas se contredisent (600 expansions, 800 nœuds, 6000 unités de travail, 400 arêtes avec recherche reprise au pas suivant) ; IA-01 écarte explicitement la recherche reprenable que SIM-12 propose. Les caches négatifs à durée de BOSS-07 et LOAD-04 ne sont pas sauvegardés : s'ils modifient la consommation de routeBudget, la partie restaurée diverge de la partie vivante. La borne locale de BOSS-07 change le choix des couvertures.

**Arbitrage.** Chaîne unique : IA-05 (arêtes statiques et symétriques, qui contient le cache symétrique de LOAD-04), puis IA-02, IA-01 (étiquettes de composantes cuites de façon synchrone dans create et restore), IA-03 (report distinct de l'échec, un seul budget en unités de travail), IA-04 (tas typé, déjà demandé par LOOP-02 et LOAD-04), IA-08 (meilleur point atteignable, qui absorbe le point 2 de LOOP-02). Abandonner la borne locale et le cache négatif de BOSS-07, le cache négatif de LOAD-04, le mémo de LOOP-02 et l'A* reprenable de SIM-12.

### LOAD-01, LOOP-01

**Problème.** Deux corrections opposées du même bug de point de reprise refusé. LOAD-01 supprime la ligne de validation src/simulation.js:2081 sans toucher à la physique (2/55 → 55/55 points acceptés, 54 identiques octet pour octet). LOOP-01 garde la validation, réécrit snapshot() et change la pose des gravats en :1060, ce qui déplace des débris et modifie les attentes de checks/simulation.test.mjs:1927-1996. Appliquer le point 2 de LOOP-01 invalide aussi la référence bit à bit dont SIM-03 a besoin.

**Arbitrage.** Retenir LOAD-01 (points 1 à 4), dont le repli sans gravats est le même que le point 3 de LOOP-01. Reporter la correction physique de LOOP-01 après SIM-03, comme amélioration visuelle facultative avec nouvelle référence.

### SIM-03, BOSS-09, LOAD-05, LOOP-04

**Problème.** Trois stratégies de sommeil des gravats sur le même code (src/simulation.js:992-1005, :1028-1065). SIM-03 est exact (sommeil indexé sur la révision, rien dans la sauvegarde). BOSS-09 endort sur seuil de vitesse avec revérification d'un huitième des pièces par pas (comportement modifié). LOAD-05 ajoute un état « coincé », rubbleVersion 2 et une retouche du validateur en :2080, qui interagit avec LOAD-01. Les trois visent le même coût : −18 à −29 % ne se comptent qu'une fois.

**Arbitrage.** SIM-03 d'abord (identique bit à bit). Ensuite seulement le point 2 de LOAD-05 pour les morceaux qui ne s'endorment jamais (0,38 à 1,0 ms par pas restants), regroupé avec les autres changements de format. Abandonner BOSS-09. Le point 4 de LOOP-04 est déjà le point 3 de SIM-03.

### LOOP-03, LOAD-03, SIM-01

**Problème.** Même blocage au point de reprise (snapshot() vide la file de navigation), deux traitements. LOOP-03 diffère la prise de l'instantané tant que la navigation est en attente, ce qui déplace un effet de bord et change les trajectoires de l'IA. LOAD-03 garde l'instantané dans l'image et ne diffère que stringify et setItem. Après SIM-01, la file ne contient plus que quelques centaines de cellules et le report de LOOP-03 devient inutile.

**Arbitrage.** SIM-01 puis LOAD-03 (écriture différée, secours sur pagehide). Ne pas différer l'instantané. Ajouter l'échéance du report « en l'air » de src/game.js:96, nécessaire dès que le saut existe (lacune SAUT).

### SIM-08, LOAD-10, LOOP-04, RCPU-02, LOAD-09, RCPU-05, RCPU-01

**Problème.** Une révision de destruction a un producteur (src/destruction.js:160-178) et quatre consommateurs (navigation, gravats, index du rendu, caches d'ombre), et chaque constat invente son propre delta. RCPU-02 repose sur l'identité des maillages, que SIM-08 modifie dans rebuild. La grille CSR de RCPU-05 coûte 1,6 ms à reconstruire contre 1,2 ms en listes par cellule, donc ne vaut qu'avec RCPU-02. LOOP-04 propose un troisième index (Map numérique et lots statiques de 8 × 8 m) incompatible avec les sélections en cache de RCPU-01.

**Arbitrage.** Une seule interface de delta par révision (ajoutés, retirés, boîte englobante sale, numéro de révision), avec identité stable des maillages inchangés (point 1 de SIM-08) comme prérequis de RCPU-02. Côté rendu : RCPU-05 en listes par cellule plus RCPU-02. Abandonner le découpage en lots de LOOP-04 et LOAD-09, qui sont absorbés.

### RCPU-01, RGPU-03, RCPU-03, RGPU-04

**Problème.** Deux caches différents pour les projeteurs d'ombre du soleil sur les mêmes lignes (src/renderer.js:1440-1459) : centre quantifié sur une grille de 4 m en espace lumière (RCPU-01) ou réutilisation tant que le centre a bougé de moins de 2 m (RGPU-03). Les −30 % de draw() de RGPU-03 sont déjà dans les −57 % de RCPU-01. Avec le cache, le filtre de RCPU-03 ne tourne plus que sur 10 % des images, donc son gain est divisé par dix. RGPU-04 supprime la passe de torche que RCPU-01 met en cache. Enfin RCPU-01 ajoute 15 à 21 % d'instances côté GPU, et son taux de réutilisation (D = 1 m, θ = 8°) a été mesuré à 7 m/s.

**Arbitrage.** Trancher RGPU-04 d'abord (en option, voir le conflit sur la qualité), puis RCPU-01 pour la vue et le soleil, avec RCPU-03 en boucle interne. Abandonner RGPU-03 mais garder sa preuve (écart d'image nul) comme critère d'acceptation. Remesurer RCPU-01 à 10,5 m/s et 300°/s, et sur un format téléphone.

### RCPU-08, RGPU-09, LOOP-12, RGPU-02, LOOP-09

**Problème.** Trois gouverneurs de résolution différents pour src/renderer.js:746-764. RCPU-08 se fie à la part d'images en retard d'après l'intervalle rAF ; LOOP-12 montre que ce signal trompe (rAF plafonné à 30 Hz : l'échelle tombe à 0,65 en 12,3 s alors que le GPU est au repos) et veut le temps GPU ; RGPU-09 prend le maximum du temps CPU et du temps GPU, avec d'autres seuils et d'autres pas. RGPU-02 dépend du gouverneur retenu, et LOOP-09 estime la période d'affichage une seconde fois.

**Arbitrage.** Un seul gouverneur, à arbitrer avec l'axe STAB : signal = temps GPU par requête quand il existe, sinon temps CPU (LOOP-12, RGPU-09) ; période d'affichage estimée une fois et partagée avec le limiteur de LOOP-09 ; baisse rapide, hausse lente et plafond collant (RCPU-08) ; cibles allouées une fois et sous-viewport, sur lequel les trois s'accordent. RGPU-02 seulement après. Adapter une seule fois checks/renderer-destruction.test.mjs:49-53.

### RGPU-01, RGPU-02, RGPU-04, RGPU-13, RGPU-10, RGPU-05

**Problème.** Ces constats précèdent l'exigence « sans perdre la moindre qualité » et la règle de FERRO (comportement identique sans nouvelle option). Ils changent l'image : RGPU-01 retire les reflets des lumières lointaines (écart moyen 0,037), RGPU-02 rend la qualité haute moins nette à DPR 2 (échelle 1,57), RGPU-04 retire les ombres de torche (0,013), RGPU-13 affaiblit l'éclairage lointain (0,24 à 0,31), RGPU-10 floute légèrement. RGPU-01 et RGPU-13 ne s'additionnent pas (gain de RGPU-13 proche de 0 après RGPU-01) et RGPU-01 suppose un ordre des lumières que RGPU-13 retrie.

**Arbitrage.** Dans FERRO, en faire des options désactivées par défaut. Dans METAL, les activer seulement en qualité auto et basse ; la qualité haute garde les 12 reflets et la résolution native, ce qui convient aux PC à carte NVIDIA. RGPU-05 est une correction (image meilleure) : activée dans METAL, option dans FERRO. Ordre : RGPU-05, RGPU-13, puis RGPU-01, avec une seule mise à jour des tests qui lisent l'ordre des lumières (checks/renderer-destruction.test.mjs:96-101).

### RGPU-07, RGPU-10, RCPU-08, RGPU-09, LOOP-13, FEEL-04, FEEL-13

**Problème.** Sept constats touchent la passe de composition (src/renderer.js:493-519) ou les surcouches #vignette et #damage (src/style.css:1, src/game.js:61, :713-715) : facteur d'échelle du sous-viewport, FXAA, vignette et voile en uniformes, suppression des doublons CSS, voile rouge absent sur un blocage, secousse de caméra. Faits séparément, ils se réécrivent les uns les autres ; FEEL-04 codé sur les surcouches CSS serait jeté par RGPU-07.

**Arbitrage.** Une seule réécriture de la passe, dans l'ordre : échelle et bornes d'UV du sous-viewport, FXAA sur la scène avant tout voile, puis vignette, voile et onde en uniformes (RGPU-07). Ensuite FEEL-04 et FEEL-13 sur ces uniformes, et LOOP-13 pour retirer les doublons CSS, gardés pour le seul repli Canvas 2D.

### RGPU-08, LOOP-11

**Problème.** Les deux constats sont le même (arrêter le rendu derrière la pause et les menus). Tels qu'écrits, ils gèlent aussi l'écran titre, ce qui contredit le mode démo demandé ensuite : comme dans Point de rupture, la démo tourne derrière le titre. Un flou d'arrière-plan sur une démo vivante coûterait une passe plein écran à chaque image.

**Arbitrage.** Une seule implémentation : image figée en pause, boutique et écran de fin (un rendu, puis arrêt, nouveau rendu au redimensionnement ou au changement d'option). Le rendu continue en démo et sur le titre, sans backdrop-filter. À coordonner avec l'axe DEMO.

### BOSS-01, FEEL-01, FEEL-09, FEEL-10, LOOP-07

**Problème.** Affectations de touches contradictoires. BOSS-01 : Espace esquive, Espace avec la garde frappe. FEEL-01 : la frappe passe sur l'action de mêlée. FEEL-09 : Espace saute et l'esquive va sur R. À la manette, LOOP-07 met l'esquive sur A et la mêlée sur B, FEEL-10 le saut sur A et l'esquive sur B ; zones mortes, courbes et vitesses diffèrent (0,18 et 0,12, puissance 2,2, 240°/s contre 0,12, expo 1,7, 300°/s). BITUME a déjà sa lecture de manette (src/jeu.js:220).

**Arbitrage.** Schéma FEEL-01 plus FEEL-09 (Espace saut, R esquive, V frappe ou crosse). Réglages de FEEL-10, seuls mesurés sur prototype, avec le verrou de tir de LOOP-06. Un seul module d'entrées dans FERRO (fonction pure, table d'affectation par jeu), récolté depuis BITUME et le prototype, tactile compris (lacune TACT). LOOP-07 est absorbé.

### BOSS-01, FEEL-02, FEEL-03, FEEL-05, BOSS-02

**Problème.** Deux réécritures de la garde sur les mêmes lignes (src/simulation.js:766-770, :776-778) : arc horizontal de ±60° pour les seules sources au sol avec absorption inchangée de 0,55 et 0,8 (BOSS-01), ou arc de ±70° pour tout, absorption de 100 % et 75 %, plus parade (FEEL-02, FEEL-03). Les chiffres de BOSS-01 (Onde de 20,9 à 9,4 dégâts) ne valent plus avec FEEL-03. L'Onde reçoit trois parades à la fois : blocable (BOSS-01), brèches angulaires et écart de 1,95 s (BOSS-02), sautable ou esquivable (FEEL-05, qui dépend du saut). Cumulées, elles vident le combat de boss.

**Arbitrage.** FEEL-02 et FEEL-03 pour la géométrie et l'économie, plus le seul point 1 de BOSS-01 (donner une source aux zones). Fixer une table de parades par attaque avant de coder, par exemple : Onde = saut ou brèche, bouclier à 75 % ; Balayage = esquive ou saut ; Écrasement = blocage à 75 % ou sortie de zone. La valider avec les bots de bench/boss : les bots esquive, bouclier et saut survivent, aucun ne reste à 0 dégât sur 120 s.

### LOOP-08, FEEL-12, BOSS-10, FEEL-14, FEEL-03, IA-09, IA-10, IA-11, LOOP-06

**Problème.** Chaque constat a été mesuré seul et leurs effets sur la difficulté se multiplient. Côté joueur : cadence exacte (+6,7 % à 60 Hz, +19 % au pas des tests), mitraillette de 34 à 69 tirs en 10 s, clics jamais perdus, garde à 100 %, ennemis étourdis (−10 à −20 % de leurs dégâts). Côté ennemis : décisions 2 à 3 fois plus fréquentes, escouade coordonnée, visée qui suit le sprint et le saut. La table de PV de BOSS-10 est dérivée des dégâts par fenêtre mesurés avec les armes actuelles : elle est périmée dès que LOOP-08 et FEEL-12 sont appliqués. checks/boss-progression.test.mjs:9 interdit de baisser les PV.

**Arbitrage.** Ordre imposé : LOOP-08, puis FEEL-12, puis nouvelle mesure des dégâts par fenêtre (bench/boss/window.mjs), puis table de BOSS-10. Ajouter une étape d'équilibrage commune avant de toucher à l'économie, avec tools/campaign-balance.mjs, tools/boss-ttk.cjs et les bots de bench/boss (cible : 60 à 120 s par boss). Décision explicite de David sur le test de progression. Cette étape conditionne aussi la démo qui dure : son pilote doit survivre.

### LOOP-05, FEEL-08, LOOP-08, SIM-12

**Problème.** Le schéma de pas n'est pas tranché. LOOP-05 recommande un pas variable borné à 1/40 s et déconseille le pas fixe. FEEL-08 mesure ses réglages à 120 Hz et exige le même trajet de 20 à 120 images par seconde. Le plafond de sous-pas de SIM-12 ralentit le temps de jeu. L'axe DEMO rejoue des entrées à pas fixe de 1/60 s (bench/demo/session.mjs), ce qu'un pas variable ne reproduit pas sans enregistrer dt.

**Arbitrage.** Décider avant tout travail sur le déplacement et la démo : pas variable borné en jeu (LOOP-05), sous-pas internes fixes pour la locomotion (FEEL-08) et reliquat de cadence (LOOP-08), donc résultats indépendants de la cadence d'image ; en démo ou en rejeu, pas fixe de 1/60 s ou dt enregistré. Exprimer pumpNav en cellules par seconde, comme LOOP-05 le propose.

### SIM-05, LOAD-05, LOAD-14, BOSS-02, FEEL-08, FEEL-09

**Problème.** Cinq changements indépendants du format de sauvegarde : ordre des clés (SIM-05), rubbleVersion 2 (LOAD-05), ennemis compactés (LOAD-14), brèches des attaques de boss (BOSS-02), physicsVersion 2 (FEEL-08, FEEL-09). Chacun demande sa migration et sa validation atomique dans restore.

**Arbitrage.** Une seule révision de format en fin de chantier simulation, qui accepte les anciennes versions, avec un seul lot de tests dans checks/checkpoint.test.mjs.

### FEEL-06, FEEL-07, LOAD-13, LOOP-14, BOSS-04

**Problème.** FEEL-06 allonge les tampons d'armes de 1,8 à 2,9 fois : les temps de LOAD-13 (559 à 764 ms de synthèse, lots de 110 à 177 ms) sont à remesurer. FEEL-07 change le compresseur et le duck et ajoute un filtre par tir ennemi, pendant que LOOP-14 réduit les automations et que BOSS-04 monte le niveau des annonces dans le même compresseur. Les recettes d'armes sont dans audio.js, fichier identique dans FERRO (45 997 octets), donc soumis à la règle « identique sans option ».

**Arbitrage.** LOAD-13 d'abord (lots bornés en temps), puis LOOP-14 avec test de nullité. FEEL-06 sous forme de table de recettes fournie par le jeu, les recettes v0.2 restant le défaut de FAudio. FEEL-07 et BOSS-04 seulement après les mesures de la lacune MIX.

### RCPU-04, RCPU-10, RCPU-01, RGPU-03, RGPU-04, RGPU-05, RGPU-13

**Problème.** Sept constats modifient chacun les attentes du même test et de son faux contexte WebGL : checks/renderer-destruction.test.mjs (:13-24 lignes reconstruites depuis bufferData et vertexAttribPointer, :42, :52 shadowMaps, :85 staticVisible, :96-101 ordre des lumières) et checks/actor-visibility.test.mjs:30.

**Arbitrage.** Premier commit du chantier rendu : un faux contexte qui gère bufferSubData et les VAO et expose des compteurs exacts. Ensuite chaque constat arrive seul, avec sa ligne de test.

## Ordre recommandé

Remarques préalables.
- Les gains du premier tour ne s'additionnent pas. Simulation : les six correctifs exacts font −60 à −70 % ensemble, alors que la somme des gains isolés dépasserait 100 %. Rendu CPU : −73 à −78 % pour RCPU-01, 03, 04 et 05 réunis. Le prompt maître doit citer les gains combinés.
- Tous les bancs de preuve vivent dans un dossier temporaire que Codex n'aura pas.
- ~/Projects/ferro n'existe pas sur cette machine ; FERRO 248043a a été lu dans bancs/../wf2/ferro/ferro.
- Règle de destination : ce qui touche renderer, audio, music, motion et options va d'abord dans FERRO, en option avec le comportement v0.2 par défaut, entrée dans VERSIONS.md et étiquette ; METAL monte ensuite de version et active. Simulation, world, destruction et game restent dans METAL.

Étape 0 — Outils de preuve (FERRO puis METAL). Verser dans les dépôts : chargeur dans le domaine principal (bench/sim/fast.mjs), A/B en lockstep (ab2.mjs), empreinte d'état FNV avec hashes de référence par scénario, faux WebGL2 compteur (bench/rcpu/harness.mjs), pages de différence d'images (bench/rgpu), test de nullité audio. Réécrire le faux contexte des tests de rendu. Ajouter l'instrumentation de RGPU-11. Sans cela, « identique » ne peut pas être prouvé.

Étape 1 — Décisions et bugs indépendants (METAL). Trancher le schéma de pas (LOOP-05) et la table des touches (FEEL-01 avec FEEL-09). Puis LOAD-01, LOOP-06, LOOP-09, LOOP-10.

Étape 2 — Simulation à résultat identique, chaque correctif prouvé par hash : SIM-02, SIM-04, SIM-09, SIM-03, SIM-07, SIM-06, SIM-10, puis SIM-01, puis LOAD-03 et LOAD-06 (sortie du générateur identique).

Étape 3 — Delta de révision de destruction : interface unique et identité stable (SIM-08), puis RCPU-05 et RCPU-02 côté rendu (FERRO), puis LOAD-10. Dépend de l'étape 2 pour les références.

Étape 4 — Navigation à comportement modifié, nouvelle référence : IA-05, IA-02, IA-01, IA-03, IA-04, IA-08, puis IA-07, IA-13, IA-14. IA-09 et IA-10 après. IA-11 attend le déplacement (étape 8).

Étape 5 — Rendu CPU (FERRO), image identique à prouver par différence nulle : RCPU-04, RCPU-01, RCPU-03, RCPU-10 ; puis dans METAL RCPU-06, RCPU-07, RCPU-11. À coordonner avec les axes DRAW et RESTE.

Étape 6 — Rendu GPU et cadence (FERRO, options) : gouverneur unique (LOOP-12, RCPU-08, RGPU-09, avec STAB), passe de composition réécrite une fois (sous-viewport, RGPU-10, RGPU-07), lumières (RGPU-05, RGPU-13, RGPU-01), RGPU-04, RGPU-06 et RGPU-12 (visuellement identiques à prouver), RGPU-02, puis pause figée (RGPU-08 et LOOP-11, sauf démo) et LOOP-13.

Étape 7 — Entrées (FERRO) : module commun clavier, tactile et manette, récolté depuis BITUME et le prototype de FEEL-10 ; menus et invites (FEEL-11). Attend la lacune TACT.

Étape 8 — Ressenti (METAL) : FEEL-08, puis FEEL-09 une fois la lacune SAUT levée, IA-11, garde (FEEL-02, FEEL-03, point 1 de BOSS-01), table de parades (FEEL-05, BOSS-02), FEEL-04 (après RGPU-07), FEEL-13, FEEL-14, puis LOOP-08 et FEEL-12.

Étape 9 — Boss et équilibrage : BOSS-03, BOSS-05, BOSS-06, BOSS-04, BOSS-12, BOSS-11, BOSS-13 ; nouvelle table de BOSS-10 ; étape d'équilibrage commune avec les outils du dépôt. Dépend de l'étape 8.

Étape 10 — Audio (FERRO) : LOAD-13, LOOP-14, table de recettes et FEEL-06, puis FEEL-07 après la lacune MIX.

Étape 11 — Format de sauvegarde, une seule révision : LOAD-05 (point 2), LOAD-14, physicsVersion 2, attaques de boss, fabriques de SIM-05.

Étape 12 — Chargement : LOAD-07, LOAD-08 (après l'axe PARA), LOAD-12.

Étape 13 — Démo qui dure (après l'axe DEMO). Elle dépend de l'étape 1 (reprises acceptées), de l'étape 4 (plus d'ennemis figés ni de blocages), des étapes 8 et 9 (pilote qui survit), de l'exception au gel du rendu de l'étape 6 et de la variation musicale de la lacune MIX.
