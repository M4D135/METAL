# Lot 15 — Résolution native : coût GPU par passe

> **Décision de David (12 novembre) — elle prime sur les valeurs par défaut de cette fiche.** « 60 c'est ok par défaut, même 30 si on a une petite config, tant que c'est constant. »
> - La cible par défaut est **60 images par seconde constantes, à la résolution native**. Une cadence plus haute (120, 144 Hz) est une option du joueur, pas la cible.
> - Sur une machine qui ne tient pas 60 de façon constante à la résolution native, le jeu se cale sur **30 images par seconde constantes**.
> - **La constance passe avant la cadence.** Jamais d'oscillation entre deux cadences en cours de jeu, jamais de baisse de résolution. Le choix se fait par mesure (au lancement, révisable entre deux secteurs, jamais en plein combat), avec une marge pour ne pas basculer sans cesse. Le joueur peut le forcer dans les options.
> - Le limiteur affiche une image tous les N rafraîchissements de l'écran (LOOP-09). Avec le pas fixe de 1/60 s, 30 images par seconde font toujours deux pas de simulation par image.
> - Les critères d'acceptation du type « 120 Hz tenus » deviennent des mesures d'information, pas des objectifs. La question laissée ouverte par NATIF-V1 est tranchée : natif, 60 par défaut, 30 en repli.

## But
Rendre le tampon du canvas égal aux pixels physiques de l'écran, sans jamais le modifier en cours de partie. Remplacer le gouverneur qui baisse la résolution par une vigie qui consigne et verrouille la cadence. Livrer le seul gain sans perte mesuré sur GPU Apple (−4,9 %) et un banc intégré pour valider sur les PC de David.
## Tâches, dans l'ordre
### T1 — Gouverneur remplacé par une vigie [NATIF-03]
- Où : src/renderer.js:746-764 ; src/game.js:722 ; src/renderer.js:1389 ; src/renderer.js:1535.
- Quoi : en mode natif, autoScale reste à 1. Remplacer la logique de descente par pas de 0,1 (plancher 0,65) par un anneau de 240 valeurs de fx.frameMs. Exposer stats.budget = {target, p50, p95, over, sustained}. Rappel options.onBudget au plus toutes les 5 s. Seul levier permis : verrouiller le limiteur d'images sur taux d'affichage / 2 quand sustained est vrai (brancher sur le limiteur corrigé par LOOP-09). Journal stats.budgetLog (32 entrées). Le mode historique garde resolutionGovernor tel quel.
- Preuve exigée : bancs/loop/harness.mjs, 60 s de frameMs à 30 ms → taille du canvas constante, stats.budget.sustained vrai, un seul appel onBudget. En mode historique, mêmes paliers qu'aujourd'hui.
- Qualité : meilleure (zéro changement de résolution en jeu, zéro réallocation de cibles).
- Garde-fous : sur une machine trop faible la cadence baisse (−37 % de temps GPU au plancher mesuré) → message clair + option d'échelle (T4). Verrouillage dépend de LOOP-09. Sans l'option native, comportement FERRO v0.2 inchangé. À fusionner avec l'axe STAB.
- Dépend de : rien.

### T2 — Branches exactes dans le shader du monde [NATIF-07]
- Où : src/renderer.js:321, :326, :333, :334-338, :373-377 (équivalent FERRO :381, :386, :393, :394-398, :433-437).
- Quoi : livrer uniquement ggxgate : if(diffuse>0.) devant le reflet de la boucle ; if(sunlight>0.&&dot(n,uSunDirection)>0.) devant celui du soleil ; if(torch>0.&&dot(n,torchDirection)>0.) devant celui de la torche. metalHighlight se termine par ×nl (FERRO :124), donc le terme est exactement nul quand N·L ≤ 0. Laisser ubranch et shgate de côté (gain non reproduit, écarts d'un niveau pour rien). Effet de bord favorable : évite le NaN de normalize(view+l).
- Preuve exigée : bancs/natif/cfg/F-mac.json ligne exactplus, écart maximal 1 niveau sur au plus 2 pixels par image, sur les 4 scènes. Gain attendu −4,9 % [−7,8 ; −1,5] toutes scènes à 5,94 MPix ; −8 à −9 % en intérieur.
- Qualité : visuellement identique (1 niveau sur environ 2 pixels par image).
- Garde-fous : sur un GPU où les branches coûtent cher le gain peut s'annuler → garder la comparaison dans le banc. Seul le texte du shader change (règle FERRO 0.2). Sauvegardes et déterminisme non concernés.
- Dépend de : rien.

### T3 — Banc intégré et protocole d'acceptation [NATIF-13]
- Où : src/game.js:723-729 ; bancs/natif.html (nouveau) ; bancs/index.html (FERRO).
- Quoi : page bancs/natif.html en file:// avec renderer.profile(true). (1) Si EXT_disjoint_timer_query_webgl2 : une requête TIME_ELAPSED par passe (ombres ×3, ciel, opaque statique, dynamique, particules, arme, post), lue ≥ 2 images plus tard, jetée si GPU_DISJOINT. (2) Sinon : ablation par blocs de 10 images, readPixels, variantes à la même résolution, ordre tourné. (3) CPU : performance.now() autour de sim.step, construction des modèles, draw(), HUD. (4) Intervalles rAF : p50, p95, p99, part hors budget, taux d'affichage (médiane de 120 intervalles). (5) Ligne de résolution : canvas, pixels physiques, échelle, plafond, changements. (6) 4 scènes rejouées en natif. (7) Bascule de chaque optimisation avec empreinte des pixels. (8) Export JSON. Ajouter l'ablation flatmat et le couple Auto/natif.
- Preuve exigée : sur ce Mac, le banc retrouve à ±0,5 ms (bruit observé) les écarts de bancs/natif/cfg/F-mac.json (exactplus −0,74 ms, msaa4 +4,11 ms). Sur chaque PC : export JSON à 2 résolutions.
- Qualité : sans objet (outillage).
- Garde-fous : aucun port, aucun fichier externe (AGENTS.md). Poids quelques kilo-octets, hors page du jeu si budget de taille l'exige. Cibles NVIDIA, GPU intégré et téléphone extrapolées → ne pas les inscrire comme critères d'acceptation avant première mesure.
- Dépend de : rien.

### T4 — Option résolution native et échelle de rendu [NATIF-01]
- Où : src/renderer.js:1383-1396 ; src/options.js:6 ; src/game.js:763, :839, :843.
- Quoi : FRender.create(canvas,{resolution:'native'}) en game.js:843. Dans ce mode, le tampon vaut les pixels physiques × renderScale (défaut 1). resize() ne choisit plus que le détail. Préférence renderScale (1, 0,85, 0,75, 0,66, 0,5 ; défaut 1) normalisée dans FOptions.normalize. Réglage « Échelle de rendu 3D : 100 % (native) » dans l'onglet image. Exposer stats.native = {device:[l,h], buffer:[l,h], scale, capped, changes}. Option facultative : sans elle, rien ne change pour FERRO v0.2.
- Preuve exigée : bancs/natif/inventaire.mjs adapté au nouveau resize() → tampon égal au natif en Auto et en Haute pour les 9 écrans. stats.native.changes = 0 pendant 10 min de jeu. Netteté des traits : 71,7 % → 100 % (1080p), 40 % → 100 % (Retina).
- Qualité : meilleure.
- Garde-fous : coût ×1,10 (1080p) à ×2,55 (Retina 14) → cadence divisée par deux sur M5 en natif (voir T5). Test renderer-reprises compare les commandes GPU sans option → doit rester vert. Sauvegardes et déterminisme non concernés. Nouvelle préférence renderScale : valeur par défaut 1 pour les préférences existantes.
- Dépend de : T1 (le gouverneur ne doit plus toucher à l'image).

### T5 — Calibrage de l'échelle au premier lancement [NATIF-V1]
- Où : src/renderer.js:1539-1552 ; src/renderer.js:806-826 ; src/game.js:676-677, :843 ; src/options.js:6.
- Quoi : renderer.calibrate({frames:30}) hors jeu (écran de préparation) : rend une vue de référence à deux tailles (échelle Auto actuelle et natif), synchronise par readPixels en blocs de 10, renvoie {fixe, pente ms/MPix, taux d'affichage}. METAL choisit la plus grande échelle parmi 1, 0,85, 0,75, 0,66 et l'échelle Auto dont le temps prédit reste sous 0,7 × intervalle d'affichage. Plancher = échelle Auto actuelle. Valeur enregistrée avec empreinte (chaîne GPU, taille, DPR) ; recalculée seulement si l'empreinte change. Afficher « Échelle de rendu : N % (calibrée) » + réglage manuel.
- Preuve exigée : 1080p DPR 1 → 100 % ; Retina 14 sur M5 à 120 Hz → l'échelle retenue tient 8,3 ms au p95 sur les 4 scènes. Zéro changement de taille en 10 min. Bancs/natif-verif/cfg/VA.json : écart Auto/natif +8,44 ms [+7,62 ; +8,77] reproduit.
- Qualité : meilleure (résolution ≥ Auto actuel partout).
- Garde-fous : calibrage sous charge passagère → bouton « recalibrer ». Bloque 0,5 à 1 s sur l'écran de préparation. Échauffement thermique non vu par une mesure courte. Sans l'option, comportement FERRO v0.2 inchangé. Une préférence de plus à normaliser.
- Dépend de : T3 (banc), T4 (option native).

### T6 — Tampon égal aux pixels physiques (ResizeObserver) [NATIF-02]
- Où : src/renderer.js:1387, :1390 ; src/game.js:839.
- Quoi : dans create(), new ResizeObserver(cb).observe(canvas,{box:'device-pixel-content-box'}), sous try/catch avec repli sur getBoundingClientRect arrondi par bord. Le rappel mémorise [inlineSize, blockSize]. resize() n'interroge plus clientWidth à chaque image. canvas.width/height modifiés uniquement dans draw(). Comparer gl.drawingBufferWidth à la demande ; consigner capped:'gpu' si borné. Garde typeof ResizeObserver pour les tests Node.
- Preuve exigée : bancs/natif/dprprobe.html aux 6 DPR → 15 cas sur 15. Mire d'un pixel, capture, blur.py : contraste 100 %. Netteté des traits 67,4 % → 100 % dans les cas décalés.
- Qualité : meilleure.
- Garde-fous : le rappel arrive après le dessin → une image étirée lors d'un redimensionnement (acceptable, transitoire). Repli obligatoire là où devicePixelContentBoxSize manque (à vérifier sur Safari). À activer avec le mode natif seulement (compatibilité FERRO).
- Dépend de : T4 (mode natif).

### T7 — Séparation détail / échelle dans les préréglages [NATIF-04]
- Où : src/renderer.js:1386, :1321 ; src/game.js:763.
- Quoi : resize(détail) où détail vaut 'low', 'auto', 'high' et ne règle que portées, nombre de lumières, tuile, emprise d'ombre. L'échelle est un réglage séparé (renderScale, défaut 1). En détail bas, les cibles de bloom et d'ombre restent allouées ; le jeu coupe par fx.bloom et fx.shadows. Plafond de sécurité maxPixels (défaut 8 847 360 = 4096×2160) : au-delà, échelle = sqrt(maxPixels/natif), capped:'safety' dans stats. Repli logiciel : plafonds inchangés, capped:'software'. « Économie » = détail bas + échelle préréglée à sa valeur actuelle (0,8 × CSS), affichée et réglable.
- Preuve exigée : bancs/natif/inventaire.mjs sur le nouveau resize() ; checks/options.test.mjs pour la normalisation de renderScale. Comparaison visuelle d'« Économie » avant/après.
- Qualité : meilleure (netteté réglable par le joueur en Économie).
- Garde-fous : « Économie » à l'échelle 1 calcule ×6,25 de pixels sur Retina → message au premier lancement. Préférences enregistrées gardent leurs valeurs. Sans l'option native, rien ne change pour FERRO v0.2.
- Dépend de : T4 (mode natif).

### T8 — Modèle de coût GPU inscrit dans le banc [NATIF-05]
- Où : src/renderer.js:311-322, :1551 (équivalent FERRO :371-382, :117-125, :1719).
- Quoi : inscrire le modèle temps = fixe + pente × MPix dans le banc (T3), mesuré à deux tailles dans le même processus. Pente mesurée : 2,04 ms/MPix [1,84 ; 2,12] ; part fixe 1,0 à 3,1 ms. Par passe à 5,94 MPix : lumières 4,99 à 6,74 ms (34 à 41 %), matières procédurales 2,80 ms (17,8 %), ombres 1,34 à 2,16 ms, post 0,79 à 1,15 ms. Budgets à consigner dans VALIDATION.md avec la marge du jeu réel (la base à 5,94 MPix varie de 12,3 à 28,8 ms sous charge).
- Preuve exigée : node gen.mjs cfg/PS.json out/PS.html && ./run.sh out/PS.html 1920,1080 1 > out/PS.json && python3 -I ps.py → pente dans [1,84 ; 2,22].
- Qualité : sans objet (modèle de coût).
- Garde-fous : temps sans composition navigateur ni logique de jeu ; ±30 % d'une série à l'autre sur machine chargée. Valable GPU Apple à tuiles ; à refaire sur PC.
- Dépend de : T3 (banc).

### T9 — Paquet exact (ciel tardif, invalidate, profondeur seule) [NATIF-06]
- Où : src/renderer.js:1460-1467, :1567, :1584, :1338 (équivalent FERRO :1623-1630, :1741, :1769, :1636-1638, :1434).
- Quoi : trois variantes de npatches.mjs. skylate : ciel après le lot dynamique, avant les particules, avec DEPTH_TEST, depthMask(false), depthRange(1,1), puis retour. inval : invalidateFramebuffer(FRAMEBUFFER,[DEPTH_ATTACHMENT]) sur la cible de scène avant postPass(), [COLOR_ATTACHMENT0] sur les cibles du bloom ; jamais le tampon du canvas. depthvs : DEPTH_VERT réduit à la position, mêmes rotations et vent, attributs aux mêmes emplacements. Ne pas étendre inval au chemin MSAA (+0,28 ms mesuré).
- Preuve exigée : bancs/natif/cfg/X-4k.json → 45 images identiques bit à bit par variante (0 pixel sur 373 M). À 5,94 MPix : 18/18 identiques. Gain sur M5 : 0 (confirmé). Gain sur Intel/AMD/NVIDIA : à valider sur les PC de David avant livraison.
- Qualité : identique (0 pixel différent).
- Garde-fous : le test renderer-reprises compare le flux de commandes GPU à la v0.1 → déplacer le ciel et ajouter des invalidate le casse ; mettre le test à jour et noter dans VERSIONS.md, ou placer derrière une option. Preuve faite sans MSAA. À ne livrer qu'après mesure sur le PC NVIDIA ; sans cela, code en plus pour zéro gain.
- Dépend de : T3 (banc pour validation PC).

### T10 — Cache des passes d'ombre (borne et conception) [NATIF-11]
- Où : src/renderer.js:1422-1459, :1562-1566 (équivalent FERRO :1578-1595, :1596-1622, :1733-1738).
- Quoi : borne mesurée (shskip, fx.skipSh=7) : −0,88 ms [−1,35 ; −0,66] à 5,94 MPix, −1,12 ms en 4K, CPU −0,62 à −1,75 ms. Pente ombres 0,10 ms/MPix → coût fixe. Pour l'axe DRAW : lampe, dessiner une fois les projeteurs statiques dans une tuile de réserve puis blitFramebuffer de profondeur + projeteurs dynamiques. Soleil : redessiner seulement si le centre calé change (≈ chaque image en mouvement, 1° de rotation déplace le centre de 0,14 m). Torche : chaque image. Gain réaliste en mouvement : fraction des tuiles de lampe, sans doute moins de la moitié de la borne.
- Preuve exigée : bancs/natif/cfg/P-mac.json ligne shskip (borne) ; puis variante cache réelle dans cfg/X-4k.json, écart maximal 0. Invalidation à chaque révision de destruction (updateWorld, FERRO :1529).
- Qualité : sans objet (conception pour l'axe DRAW).
- Garde-fous : identité d'image non prouvée ici. La torche dépend de l'œil et des axes → se redessine à chaque image. Le centre du soleil change à presque chaque image. À laisser à l'axe DRAW.
- Dépend de : rien.

### T11 — Matières procédurales : poste ajouté au modèle [NATIF-V2]
- Où : src/renderer.js (équivalent FERRO :168-358, :172-173, :89-99).
- Quoi : ajouter l'ablation flatmat (base, rugosité, métal, normale, joints fixés avant éclairage) au banc de T3. Poste mesuré : −2,80 ms [−3,54 ; −2,26], −17,8 % à 5,94 MPix (deuxième après les lumières). Ne pas implémenter l'évaluation paresseuse des bruits (lazymat : +0,01 ms [−0,32 ; +0,38], sans effet). Ne pas remplacer les bruits par une texture ni baisser leur fréquence (changerait l'image, consigne David). Conséquence : plafond des gains sans perte sur GPU Apple ≈ 5 % (T2).
- Preuve exigée : bancs/natif-verif/cfg/VB.json ligne flatmat → −2,80 ms [−3,54 ; −2,26]. bancs/natif-verif/cfg/VC.json ligne lazymat → gain nul.
- Qualité : sans objet (modèle).
- Garde-fous : flatmat est une borne haute (retire aussi le relief des normales et la branche de reflet de nuages). Mesure GPU Apple seulement.
- Dépend de : T3 (banc).

### T12 — Faces coplanaires : diagnostic avant toute correction [NATIF-10]
- Où : src/renderer.js:1357, :1546 ; src/world.js (équivalent FERRO :1456, :1714, :1434).
- Quoi : ne livrer ni le tri avant-arrière (+0,20 ms [+0,02 ; +0,33], image différente) ni la pré-passe (+2,40 ms [+1,95 ; +2,88], +16,2 %). Écrire un contrôle qui compte, par monde, les paires de faces statiques coplanaires qui se recouvrent. Avant tout changement : localiser les pixels (champ worst.box des différences) et trancher entre coplanarité et précision de profondeur (pas ≈ 3 mm à 50 m avec near = 0,045 et 24 bits). Le décalage par hachage d'instance est risqué (déplace les intersections) → ne pas l'appliquer sans preuve.
- Preuve exigée : bancs/natif/cfg/L2-mac.json ligne f2b → écart maximal 0 après correction. Nombre de recouvrements coplanaires à 0 pour les 21 mondes.
- Qualité : sans objet (diagnostic).
- Garde-fous : toucher world.js engage le déterminisme, les collisions et les sauvegardes. Cause non prouvée (aucun décompte fait). Environ 800 pixels par image sur 5,94 M (0,013 %) dépendent de l'ordre de dessin ; scintillement visible non démontré.
- Dépend de : rien.

### T13 — Halo du bloom : taille constante à l'écran [NATIF-14]
- Où : src/renderer.js:1322, :503-517 (équivalent FERRO :1415, :563-577, :1631-1643).
- Quoi : en mode natif, diviseur d = 4 × max(1, round(hauteur/1080)) : 4 jusqu'à 1620 lignes, 8 en 4K, 12 en 6K. Garder l'extraction au quart + réduction bilinéaire par 2 avant le flou quand d = 8. Le halo garde la même part de l'écran qu'à 1080 lignes. Sans l'option native, rien ne change.
- Preuve exigée : bancs/natif/cfg/bloom.json → les deux empreintes (1080p et 4K) égales à 0,3 point près. Écart mesuré aujourd'hui : −6,3 % d'empreinte en 4K.
- Qualité : sans objet (constance visuelle, non une amélioration).
- Garde-fous : en 4K l'image diffère de la « Haute » actuelle (halo un peu plus large) → noter dans VERSIONS.md. Une réduction par 2 en un prélèvement bilinéaire peut faire scintiller les étincelles. À ne faire que si David trouve le halo trop fin en 4K.
- Dépend de : T4 (mode natif).

## Options désactivées par défaut
- [NATIF-08] Portée finie des lumières (−9 à −11 %, −18 % en intérieur) — qualité dégradée : jusqu'à 9 niveaux d'écart, plus de 3 niveaux sur 8 700 à 57 000 pixels par lot. Désactivée tant que David n'a pas comparé bancs/natif/out/ab-base-ext.png / ab-visu4-ext.png et ab-base-int.png / ab-visu4-int.png. Risque non signalé : la portée dépend du créneau (0,27 pour i < 2, 0,13 sinon) → corriger RGPU-05 d'abord.
- [NATIF-09] Reflet limité à 4 lumières (spec4, −13,6 %) — qualité dégradée : écart maximal 19 à 42 niveaux, plus de 10 niveaux sur 189 à 4 422 pixels par lot. Ne pas activer par défaut. Réserver au détail bas comme option. La moyenne MAD 0,033-0,065 masquait la perte de reflets entiers sur le métal proche.
- [NATIF-12] MSAA ×4 à la résolution native (+26 %, 265 Mo en 4K) — qualité dégradée (baisse du nombre d'échantillons). msaa:'auto' (4 → 2 à DPR ≥ 2) ne rapporte que −3,8 % [−5,3 ; −3,0] sur M5 (80 % du surcoût est fixe : stockage + blitFramebuffer). Intérêt limité à la mémoire (−95 Mo à 5,94 MPix). À re-mesurer sur NVIDIA et GPU intégré avant toute décision.

## Écartés ou absorbés
- (aucun constat réfuté dans ce lot)

## Décisions à confirmer par David
- Sur ses écrans 120 Hz (Retina 14, M5) : préfère-t-il 120 i/s à l'échelle Auto actuelle (30 % des pixels, flou) ou 60 i/s en natif (100 %, net) ? — valeur par défaut proposée : calibrage automatique (T5), natif si la marge le permet, sinon échelle Auto.
- Plafond de sécurité absolu pour les écrans 5K/6K : 8,85 MPix (4096×2160) avec mention dans les options et stats, ou aucun plafond ? — valeur par défaut proposée : 8,85 MPix, levable par le joueur.
- Accepter la portée finie des lumières (NATIF-08) après comparaison des deux paires d'images A/B ? — valeur par défaut proposée : non, tant que les images n'ont pas été comparées à l'œil.
- Téléphones à DPR 2,6-3 : natif (2,6-3,0 MPix, cadence verrouillée 30 i/s) ou plafond à DPR 2 (1,3-1,5 MPix) ? — valeur par défaut proposée : natif, à confirmer sur un vrai téléphone (rien n'a été mesuré sur mobile).
- METAL n'a aucun anticrénelage ; les arêtes en escalier sont visibles en natif sur écran DPR 1. Ajouter msaa:'auto' (4 échantillons à DPR < 2, 2 à DPR ≥ 2) ? — valeur par défaut proposée : non (gain −3,8 % non significatif, perte de qualité).

## Gains attendus du lot
Le lot ne rend pas le jeu plus rapide sur GPU Apple en mode natif : la pente de 2,04 ms/MPix et le coût des matières (17,8 %) fixent le plafond des gains sans perte à environ 5 %. Le seul gain GPU mesuré est T2 (−4,9 % toutes scènes, −8 à −9 % en intérieur). T1 supprime les 10 à 11 réallocations par minute du gouverneur (accrocs de 5 à 30 ms) et garantit une netteté constante. T4 et T6 ramènent la netteté des traits de 71,7 % à 100 % (1080p) et de 40 % à 100 % (Retina). T3 rend vérifiables sur les PC de David les gains du paquet exact (T9, estimé 3-8 % sur GPU à rendu immédiat, non mesuré ici). Le lot est d'abord une correction de politique (résolution native, pas de baisse automatique) et un outillage, pas une optimisation de cadence.
