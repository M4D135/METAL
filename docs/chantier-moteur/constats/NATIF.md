# Axe NATIF — NATIF — fluidité parfaite à la résolution native (renderer de FERRO v0.2, commit 248043a, avec les lignes de METAL 0.8, commit 673d6b2)

Origine : axe ajouté. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Aujourd'hui, le réglage par défaut « Auto » ne rend à la résolution native sur aucun écran à partir du 1080p, et aucune optimisation sans perte ne suffit à tenir 60 i/s en natif sur M5 au-delà d'environ 6 à 7 MPix. Les optimisations exactes rapportent 0 à 5 % sur GPU Apple ; le seul gros poste est la boucle des 12 lumières (34 à 41 % de l'image).

Périmètre et limites :
- ~/Projects/ferro était absent du disque pendant l'audit. J'ai travaillé sur la copie du renderer au commit 248043a (sha256 d57dae38…85a1), copiée dans bench/natif. Le clone METAL est resté intact (git status vide, HEAD 673d6b2).
- Mesures sur Apple M5, Chrome 157 sans interface, ANGLE Metal, pages file://, sans serveur ni port. Charge machine de 21 à 58 : seuls les écarts appariés sont fiables.
- Les temps n'incluent ni la composition du navigateur ni la logique de jeu.
- Non mesuré : le coût des calques CSS (#vignette, #damage, #scanlines, filtre brightness), faute de présentation à l'écran en mode sans interface.
- Élimination des faces arrière : déjà active dans toutes les passes de géométrie, rien à gagner.

Inventaire (recalcul de resize()) :
- « Auto » rend 87 % des pixels sur un 1080p, 49 % sur un 1440p, 22 % en 4K, 30 % sur un MacBook Pro 14, 25 % sur un téléphone à DPR 3.
- Le gouverneur peut descendre à 9–37 % des pixels.
- « Économie » vaut 0,8 fois la taille CSS quel que soit le DPR ; « Haute » plafonne à DPR 2.
- Le tampon du canvas ne tombe pas sur les pixels physiques dans 9 cas fractionnaires sur 15. Un seul pixel d'écart fait chuter le contraste des détails fins à 25 %.

Coût à la résolution native sur M5 :
- 2,0 à 2,3 ms par mégapixel, plus 1 à 3 ms fixes.
- À 5,94 MPix (Retina 14) : 12,8 à 18,6 ms par image, donc limite pour 60 i/s. En 4K : 16,6 à 21,8 ms. 120 i/s n'est tenu que jusqu'à environ 3 MPix.
- Ombres, ciel et post-traitement sont des coûts presque fixes (1 à 2 ms au total).

Optimisations mesurées à 5,94 MPix et en 4K :
- Ciel après l'opaque, invalidateFramebuffer, programme d'ombre en profondeur seule : image identique bit à bit (0 pixel différent sur 373 M), gain nul sur GPU Apple. Leur intérêt est sur les GPU Intel, AMD et NVIDIA, à valider sur les PC de David.
- Branches exactes du shader : −3,9 % (−4,7 % en 4K), écart d'au plus 1 niveau sur moins d'un pixel par million.
- Portée finie des lumières : −9 à −11 %, mais jusqu'à 9 niveaux d'écart. C'est une décision de David ; deux paires d'images A/B sont dans out/.
- Reflet limité à 4 lumières (RGPU-01) : −13,8 %, mais jusqu'à 42 niveaux d'écart. Ce n'est pas une optimisation sans perte.
- Tri avant-arrière et pré-passe : plus lents sur M5 et image différente. Ils révèlent des faces coplanaires dont le gagnant dépend de l'ordre de dessin.
- MSAA ×4 à la résolution native : +26 %.

Politique proposée : tampon égal aux pixels physiques (ResizeObserver, devicePixelContentBoxSize), aucune baisse automatique, échelle de rendu réglable seulement par le joueur, plafond de sécurité signalé. Le gouverneur devient une vigie : il consigne, verrouille au besoin la cadence sur un diviseur du taux d'affichage, et ne touche jamais à l'image.

Cibles proposées, à confirmer au banc sur chaque machine :
- PC NVIDIA : 120 i/s en 1440p, 60 i/s en 4K, au plus 1 % d'images hors budget (extrapolé).
- Apple M3 à M5 : 60 i/s à 5,94 MPix, au plus 5 % d'images au-delà de 16,7 ms.
- GPU intégré en 1080p : 30 i/s verrouillés en Auto, 60 i/s en détail Économie (extrapolé).
- Partout : zéro changement automatique de taille du tampon.

## Mesures

- **Banc et matériel** : Apple M5, macOS 27.2.1, Chrome 157.0.8103.39 sans interface, ANGLE Metal ; renderer FERRO 248043a (copie, sha256 d57dae38…85a1) ; mondes METAL 0.8 numéros 0 (forêt), 13 (carrière) et 17 (jardin) ; charge machine 21 à 58 _(méthode : Pages file:// générées par gen.mjs, lancées par run.sh (--headless=new --use-angle=metal --dump-dom), sans port ni serveur. 4 scènes : w0cap (60 images de jeu capturées par RGPU, 357 pièces dynamiques dont 56 d'arme), w0in (intérieur, 40 vues), w13walk et w17walk (40 vues sur un trajet simulé, décor seul). Blocs de 10 images, une synchronisation readPixels par bloc, ordre des variantes tourné, 3 tours, soit 54 écarts appariés par variante ; IC95 par bootstrap de la médiane (an.py).)_
- **Contrôles A/A (bruit de la méthode)** : Même code dans deux contextes : −0,04 ms [−0,18 ; +0,04], image identique. Variantes au flux GL identique : −0,14 à +0,09 ms à résolution unique. Dans une page à résolutions mêlées, biais de position jusqu'à −0,9 ms (−5 %) en 4K _(méthode : Variante base2 de cfg/L1-mac.json ; variantes nofx, noweapon et static sur les scènes sans dynamique de cfg/P-mac.json et cfg/PS.json. Conséquence : les pentes par passe sont données à ±0,15 ms/MPix près.)_
- **Résolution réellement rendue par mode et par écran** : Auto : 1080p DPR 1 → 1789×1006 (87 % des pixels) ; 1440p → 1789×1006 (49 %) ; 4K à DPR 1,5 ou 2 → 1789×1006 (22 %) ; MacBook Pro 14 → 1665×1081 (30 %) ; 5K → 12 % ; téléphone DPR 3 → 1278×590 (25 %). Plancher du gouverneur (×0,65) : 37 %, 21 %, 9 %, 13 %, 5 %, 11 %. Haute : natif jusqu'à DPR 2, 44 % à DPR 3. Économie : 64 % (DPR 1), 16 % (DPR 2), 7 % (DPR 3). Repli logiciel Auto : 1024×576 au plus _(méthode : inventaire.mjs : recalcul à l'identique de resize() (FERRO renderer.js:1539-1552 et 1034-1040), sans mesure.)_
- **Netteté après rééchantillonnage par le navigateur** : Tampon natif : contraste d'un damier d'un pixel 100 %, netteté des traits 100 %. Tampon trop petit d'un pixel (599 pour 600) : contraste 24,9 % (pire bande 1,3 %), netteté 67,4 %. Échelle 0,93 (Auto sur 1080p) : contraste 26,0 %, netteté 71,7 %. Échelle 0,55 (Auto sur Retina 14) : netteté 40,0 % _(méthode : blur.html : même dessin vectoriel dans 5 canvas de 300×300 px CSS à DPR 2 ; capture --screenshot ; blur.py décode le PNG et mesure le contraste moyen du damier et le gradient horizontal moyen des traits.)_
- **Taille du tampon contre pixels physiques** : Sur 15 cas à taille CSS ou DPR fractionnaires : formule actuelle round(clientWidth×ratio) juste 6 fois, round(rect×DPR) juste 12 fois, arrondi des bords juste 15 fois. Exemple : 411,43×914,29 px CSS à DPR 3 → 1233×2742 calculé, 1234×2743 réel _(méthode : dprprobe.html à DPR 1,1, 1,5, 1,75 et 3 : ResizeObserver avec box device-pixel-content-box comme référence. L'arrondi des bords est recalculé hors page avec les valeurs CSS au 1/64 de pixel.)_
- **Temps d'image selon la résolution (rendu complet)** : Même processus, charge forte (S) : w0cap 8,75 / 13,54 / 19,85 / 25,75 ms à 2,07 / 3,69 / 5,94 / 8,29 MPix ; w0in 9,80 / 15,35 / 21,27 / 30,65 ; w13walk 5,52 / 9,36 / 14,27 / 19,41 ; w17walk 6,08 / 9,44 / 14,33 / 19,23. Même processus, charge moindre (PS) : pente 1,95 à 2,28 ms/MPix (médiane 2,14 [1,96 ; 2,22]), part fixe 1,0 à 3,1 ms. Pages à résolution unique : 12,8 à 18,6 ms à 5,94 MPix, 16,6 à 21,8 ms à 8,29 MPix _(méthode : cfg/S.json (7 variantes de taille), cfg/PS.json (2 tailles, ps.py), cfg/P-*.json et cfg/F-*.json. Qualité numérique 2 : réglages de détail d'Auto, tampon = taille CSS × 2.)_
- **Coût de chaque passe à 5,94 MPix (écart apparié sans la passe, par scène)** : Boucle des 12 lumières 4,99 à 6,74 ms (34 à 41 %). Ombres complètes 1,34 à 2,16 ms (8 à 15 %), dont rendu des 3 vues 0,52 à 1,63 ms et 0,6 à 1,75 ms de CPU d'émission. Ciel 0,10 ms (intérieur) à 1,18 ms. Post complet 0,79 à 1,15 ms (5 à 8 %), dont chaîne du bloom seule 0 à 0,6 ms. Arme en surimpression environ 1,1 ms (7,8 %) dans la capture de jeu. Particules 0,5 ms pour 4 instances _(méthode : cfg/P-mac.json : variantes sans ciel, sans ombres, sans rendu d'ombre après la première image, sans bloom, composition seule, 0 lumière, sans particules, sans arme, sans dynamique.)_
- **Coût de chaque passe en 4K et en 1080p** : 4K : lumières 5,28 à 8,94 ms (32 à 44 %), ombres 1,53 à 2,66 ms, ciel 0 à 1,50 ms, post 0,62 à 1,46 ms. 1080p : lumières 1,48 à 2,95 ms (26 à 32 %), ombres 0,77 à 1,48 ms, ciel 0,05 à 0,34 ms, post 0 à 1,00 ms _(méthode : cfg/P-4k.json et cfg/P-1080.json, même protocole.)_
- **Pente par passe en ms par mégapixel** : Image complète 2,14 [1,96 ; 2,22]. Lumières 0,77 [0,66 ; 0,84], soit 36 % de la pente (0,67 à 0,96 selon la scène). Ombres 0,10 [0,04 ; 0,14] plus environ 1 ms fixe. Ciel et post : pente dans le bruit (±0,1), 0,3 à 0,6 ms à 1080p _(méthode : cfg/PS.json : 6 variantes à 2,07 MPix et les mêmes à 8,29 MPix dans le même processus ; pente = différence des écarts appariés divisée par 6,22 MPix (ps.py).)_
- **Paquet exact : identité d'image et gain** : Ciel après l'opaque, invalidateFramebuffer, programme d'ombre en profondeur seule, et les deux premiers combinés : 0 pixel différent sur 45 images en 4K (373 M de pixels par variante) et sur 18 à 24 images à 5,94 MPix. Gains à 5,94 MPix : ciel −0,12 ms [−0,31 ; +0,10], invalidate −0,03 [−0,18 ; +0,12], profondeur seule −0,03 [−0,23 ; +0,26], paquet −0,04 [−0,39 ; +0,15] ; en 4K −0,20 [−0,54 ; +0,04]. Invalider aussi le tampon du canvas : +0,30 ms [+0,15 ; +0,43]. Contexte sans profondeur par défaut : image identique, −0,07 ms [−0,31 ; +0,29] _(méthode : cfg/X-4k.json (identité, une image sur 4), cfg/L1-mac.json, cfg/L2-mac.json, cfg/F-mac.json, cfg/F-4k.json ; lecture de tout le tampon par readPixels, écart maximal par canal.)_
- **Branches exactes du shader du monde** : Paquet (exact + reflet sauté quand N·L ≤ 0 + branches sur uniformes) : −0,60 ms [−0,86 ; −0,40] soit −3,9 % à 5,94 MPix (intérieur −1,15 ms, −7,9 %) ; −0,94 ms [−1,43 ; −0,74] soit −4,7 % en 4K (intérieur −1,91 ms, −8,8 %). Image : écart maximal 1 niveau, 6 à 13 pixels différents par lot de 4 à 6 images. Lectures d'ombre conditionnelles seules : 1 pixel sur 373 M, gain +0,02 ms [−0,17 ; +0,11] _(méthode : Variantes ubranch, ggxgate, shgate et exactplus de npatches.mjs ; cfg/L1-mac.json, L2-mac.json, F-mac.json, F-4k.json, X-4k.json.)_
- **Portée finie des lumières** : Seuil 0,004 : image modifiée de 6 à 9 niveaux au plus, plus de 3 niveaux sur 8 700 à 57 000 pixels par lot de 4 à 6 images, MAD 0,24 à 0,43. Le saut hors portée est exact par rapport à la fenêtre (1 niveau sur 1 à 28 pixels). Gain du paquet : −1,65 ms [−2,00 ; −1,15] soit −11,1 % à 5,94 MPix (−6 à −15 % selon la scène) ; −1,86 ms [−2,44 ; −1,56] soit −9,4 % en 4K (intérieur −17,7 %). Seuil 0,001 : écart 2 à 4 niveaux mais gain nul (+0,04 ms [−0,26 ; +0,33]) _(méthode : Variantes lrange, lskip, lrange1, visu1 et visu4 ; cfg/L2-mac.json, F-mac.json, F-4k.json. Images A/B à 1920×1080 : out/ab-base-ext.png, out/ab-visu4-ext.png, out/ab-base-int.png, out/ab-visu4-int.png (abdiff.py : écart maximal 7 ; plus d'un niveau sur 9,7 % et 5,7 % des pixels).)_
- **Reflet GGX limité aux 4 premières lumières (RGPU-01) à la résolution native** : −1,97 ms [−2,11 ; −1,79] soit −13,8 % à 5,94 MPix. Image : écart maximal 19 à 42 niveaux, plus de 10 niveaux sur 189 à 4 422 pixels par lot, MAD 0,033 à 0,065. Ajouté à la portée finie : −11,2 % contre −11,1 % à 5,94 MPix, −11,7 % contre −9,4 % en 4K _(méthode : Variantes spec4 et visu4s ; cfg/L2-mac.json, F-mac.json, F-4k.json.)_
- **Tri avant-arrière et pré-passe de profondeur à 5,94 MPix** : Tri : +0,21 ms [+0,06 ; +0,42], image différente (écart maximal 36 à 144, 79 à 4 716 pixels par lot). Pré-passe : +2,40 ms [+1,95 ; +2,88] soit +16,2 %, image différente (écart maximal 116 à 151, 35 000 à 85 000 pixels par lot) _(méthode : Variantes f2b et prepass (gl_Position invariant) ; cfg/L2-mac.json.)_
- **Borne supérieure d'un cache d'atlas d'ombres** : Sans rendu des 3 vues après la première image : −0,88 ms [−1,35 ; −0,66] à 5,94 MPix, −1,12 [−1,45 ; −0,47] en 4K, −0,50 [−0,79 ; −0,27] en 1080p ; CPU d'émission −0,62 à −1,75 ms par image _(méthode : Variante shskip avec fx.skipSh = 7 (atlas figé, lecture conservée : l'image diffère, seule la durée compte) ; cfg/P-*.json.)_
- **MSAA ×4 (option de création de FERRO) à la résolution native** : +4,11 ms [+3,85 ; +4,52] soit +26,0 % à 5,94 MPix ; +5,34 ms [+4,86 ; +5,59] soit +25,3 % en 4K. Mémoire calculée : 190 Mo à 5,94 MPix et 265 Mo en 4K pour les deux tampons multi-échantillons _(méthode : Variante de base créée avec {msaa:4} ; cfg/F-mac.json et cfg/F-4k.json. Mémoire = pixels × 4 échantillons × 8 octets.)_
- **Empreinte du halo du bloom selon la résolution** : Pixels modifiés d'au moins 2 niveaux par le bloom : 13,04 % à 1920×1080, 12,22 % à 3840×2160 (−6,3 % en relatif) ; apport moyen inchangé (0,94 et 0,96 niveau) _(méthode : run-bloom.js et cfg/bloom.json : 10 images de la capture rendues avec puis sans bloom aux deux tailles.)_

## Scripts de banc

- bancs/natif/gen.mjs
- bancs/natif/run.js
- bancs/natif/npatches.mjs
- bancs/natif/run.sh
- bancs/natif/an.py
- bancs/natif/ps.py
- bancs/natif/slopes.py
- bancs/natif/inventaire.mjs
- bancs/natif/dprprobe.html
- bancs/natif/blur.html
- bancs/natif/blur.py
- bancs/natif/run-bloom.js
- bancs/natif/run-shot.js
- bancs/natif/abdiff.py
- bancs/natif/worlds.mjs
- bancs/natif/chk.mjs
- bancs/natif/ferro-renderer-248043a.js
- bancs/natif/cfg
- bancs/natif/out

## Décisions pour David

- **Comment activer la résolution native dans FERRO, dont la règle est qu'un jeu de la v0.2 garde son comportement sans réglage ?** — recommandé : Option de création resolution:'native' dans FERRO 0.3, passée par METAL, BITUME et Point de rupture dans leur propre dépôt. Sans l'option, rien ne change et le test renderer-reprises reste vert. ; autres choix : Natif par défaut pour tous les jeux, avec une rupture notée dans VERSIONS.md (image plus nette mais 1,15 à 4,6 fois plus de pixels à calculer). Ou ne rien changer.
- **Quel plafond de sécurité absolu pour les écrans extrêmes ?** — recommandé : 8,85 MPix (4096×2160) : natif jusqu'à la 4K. Les écrans 5K et 6K sont plafonnés, le plafond est affiché dans les options et consigné dans stats, et le joueur peut le lever. S'y ajoutent les limites du GPU (MAX_RENDERBUFFER_SIZE). ; autres choix : Aucun plafond : un écran 5K fait 14,75 MPix, soit environ 33 à 43 ms par image sur M5 d'après la pente mesurée. Plafond plus bas à 5,9 MPix. Plafond calculé par machine au premier lancement du banc.
- **Que peut faire le gouverneur quand la cadence ne tient pas à la résolution native ?** — recommandé : Rien qui change l'image. Il mesure, consigne et prévient le joueur. Seul levier : verrouiller la cadence sur un diviseur du taux d'affichage (60 sur un écran 120 Hz) pour un rythme régulier. ; autres choix : L'autoriser à baisser le détail (12 lumières vers 6, ombre de torche). L'autoriser à activer la portée finie des lumières. Garder l'ancienne résolution dynamique comme option désactivée par défaut.
- **Accepter la portée finie des lumières : −9 à −11 % de temps d'image (jusqu'à −18 % en intérieur), mais des pixels modifiés de 9 niveaux au plus ?** — recommandé : Désactivée par défaut tant que David n'a pas comparé les deux paires d'images de bench/natif/out (ab-base-ext.png et ab-visu4-ext.png, ab-base-int.png et ab-visu4-int.png). Si elle est acceptée, écrire la portée de chaque lumière dans world.js : l'image de référence devient celle-là et le saut est exact. ; autres choix : L'activer d'emblée avec le seuil 0,004. La refuser : il reste alors −3,9 à −4,7 % de gain sans perte sur GPU Apple.
- **Faut-il une option joueur « Échelle de rendu 3D » ?** — recommandé : Oui, à 100 % (native) par défaut, avec les valeurs 85, 75, 66 et 50 %. C'est le seul moyen de baisser la résolution et il reste entre les mains du joueur. ; autres choix : Aucune option : natif imposé, le joueur n'a que le détail pour gagner des images. Ajouter plus tard un agrandissement plus net que le bilinéaire du navigateur.
- **Que devient le préréglage « Économie » ?** — recommandé : Détail bas (6 lumières, portées courtes, sans ombres ni bloom) à la résolution native, donc net. Le joueur baisse l'échelle lui-même s'il le faut. ; autres choix : Garder le comportement actuel (0,8 fois la taille CSS, soit 16 % des pixels sur Retina) sous le nom « Économie floue ».
- **Téléphones à DPR 2,6 à 3 : natif (2,6 à 3,0 MPix) ou plafond à DPR 2 ?** — recommandé : Natif comme partout, avec la cadence verrouillée à 30 i/s et un message si elle ne tient pas. À confirmer sur un vrai téléphone, car rien n'a été mesuré sur mobile. ; autres choix : Plafonner à DPR 2 sur écran tactile (1,3 à 1,5 MPix) : plus fluide, mais c'est une baisse de résolution par défaut.
- **Quelles cadences cibles par classe de machine pour l'acceptation ?** — recommandé : PC NVIDIA : 120 i/s en 1440p et 60 i/s en 4K, au plus 1 % d'images hors budget. Apple M3 à M5 : 60 i/s à 5,94 MPix, au plus 5 % d'images au-delà de 16,7 ms et aucune au-delà de 33,3 ms. GPU intégré en 1080p : 30 i/s verrouillés en Auto, 60 i/s en détail Économie. Partout : zéro changement automatique de taille du tampon. ; autres choix : Exiger 60 i/s partout en Auto : sur GPU intégré et en 4K sur M5, cela impose de baisser le détail ou d'accepter la portée finie des lumières. Viser 120 i/s sur les écrans ProMotion : tenu seulement jusqu'à environ 3 MPix sur M5.
- **MSAA ×4 de Point de rupture et BITUME à la résolution native (+26 % mesuré, 265 Mo en 4K) : le garder tel quel ?** — recommandé : Ajouter msaa:'auto' dans FERRO (4 échantillons à DPR inférieur à 2, 2 à DPR 2 ou plus) et laisser chaque jeu le choisir dans sa session ; msaa:4 reste inchangé. ; autres choix : Garder 4 échantillons partout. Pour METAL, qui n'a aucun anticrénelage, proposer MSAA en option : les arêtes en escalier sont visibles en natif sur un écran DPR 1.

## Constats

### NATIF-01 — « Auto » ne rend à la résolution native sur aucun écran à partir du 1080p : plafond de DPR à 1,5 et budget de 1,8 MPix
- sévérité critique · catégorie 3d-visuel · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur et jeu
- lieux : FERRO src/renderer.js:1539-1552; METAL src/renderer.js:1383-1396; METAL src/options.js:6; METAL src/game.js:763; METAL src/game.js:839; METAL src/game.js:843

**Preuve.** FERRO src/renderer.js:1542 : ratio = min(DPR, 1,5) en auto, min(DPR, 2) en haute, 0,8 en économie ; :1544 borne [0,5 ; 2] ; :1545 : ratio = min(ratio, sqrt(1800000/(largeur×hauteur CSS))) × autoScale. Mêmes lignes dans METAL src/renderer.js:1386-1389 ; options.js:6 met quality:'auto' par défaut. Recalcul (inventaire.mjs) : 1080p DPR 1 → 1789×1006 (87 % des pixels, échelle 0,93) ; 1440p → 49 % ; 4K → 22 % ; MacBook Pro 14 → 1665×1081 (30 %) ; téléphone DPR 3 → 25 %. Mesure de netteté (blur.html, capture Chrome) : à l'échelle 0,93 le contraste d'un détail d'un pixel tombe à 26,0 % et la netteté des traits à 71,7 % du natif ; à l'échelle 0,55, netteté 40,0 %.

**Cause.** La résolution sert de variable d'ajustement des performances : plafond de DPR, budget de pixels et gouverneur s'appliquent avant tout autre levier, et le navigateur agrandit ensuite l'image.

**Proposition.** FERRO : option de création resolution:'native'. Dans ce mode, le tampon vaut les pixels physiques du canvas (NATIF-02) multipliés par renderScale, qui vaut 1 par défaut et que seul le jeu modifie sur demande du joueur. Le paramètre de resize() ne choisit plus que le détail. Exposer stats.native = {device:[l,h], buffer:[l,h], scale, capped, changes}. METAL : FRender.create(canvas,{resolution:'native'}) en game.js:843 ; préférence renderScale (1, 0,85, 0,75, 0,66, 0,5 ; défaut 1) normalisée dans FOptions.normalize ; réglage « Échelle de rendu 3D : 100 % (native) » dans l'onglet image. Acceptation : pour les 9 écrans d'inventaire.mjs, tampon égal au natif en Auto et en Haute ; stats.native.changes reste à 0 pendant 10 minutes de jeu.

**Gain attendu.** Netteté des traits : de 71,7 % à 100 % sur un 1080p, de 40 % à 100 % sur Retina. Coût GPU sur M5 d'après la pente mesurée (2,14 ms/MPix) : +0,6 ms en 1080p, +8,9 ms sur Retina 14, +13,9 ms en 4K.

**Risques.** Le coût par image est multiplié par 1,15 (1080p) à 4,6 (4K) : la cadence baisse sur les machines justes (NATIF-05). Compatibilité FERRO : option facultative, donc aucun changement pour un jeu de la v0.2 ; le test renderer-reprises compare les commandes GPU sans option et doit rester vert. Sauvegardes et déterminisme non concernés. Nouvelle préférence renderScale : valeur par défaut 1 pour les préférences existantes.

**Vérifier par.** node inventaire.mjs adapté au nouveau resize() : 100 % partout. Dans le navigateur : le banc affiche canvas.width×height et la taille en pixels physiques.

**Contre-vérification.** Lignes exactes (FERRO renderer.js:1539-1552, METAL renderer.js:1383-1396, options.js:6, game.js:763/839/843). J'ai recalculé resize() à la main : 1080p DPR 1 → 1789×1006 (87 %), 1440p → 49 %, 4K → 22 %, MacBook Pro 14 → 1665×1081 (30 %), téléphone DPR 3 → 1278×590 (25 %). Capture de netteté rejouée (blur.html + blur.py) : mêmes valeurs, 26,0 % et 71,7 % à l'échelle 0,93, 40,0 % à 0,55. Réserves : (1) le « contraste du damier » est un pire cas à la fréquence de Nyquist (il remonte à 82,6 % à l'échelle 0,55, ce qui montre que la métrique est capricieuse) ; la netteté des traits est le chiffre à retenir. (2) Le natif existe déjà : « Haute » rend le natif jusqu'à DPR 2 ; le vrai changement est le réglage par défaut. (3) Coût mesuré dans le même processus (cfg/VA.json) : Auto actuel sur Retina 14 = 4,6 à 5,6 ms par image, natif = 12,5 à 14,4 ms, soit +8,44 ms [+7,62 ; +8,77], +155 %. Aujourd'hui le M5 tient le budget de 8,3 ms d'un écran 120 Hz ; en natif il ne le tient plus, et sous charge j'ai relevé 17,6 à 28,8 ms à 5,94 MPix (VB, VC), donc sous 60 i/s. David demande de ne pas perdre de résolution, pas de l'augmenter au prix de la cadence : le natif imposé par défaut est une décision à lui soumettre (voir NATIF-V1), d'où P1 et non P0.

**Preuve corrigée.** Auto → natif sur Retina 14 : +8,44 ms [+7,62 ; +8,77] (+155 %), soit 2,04 ms/MPix ; sur 1080p DPR 1 : +0,55 ms [+0,44 ; +0,74] (+10,5 %). A/A entre deux tampons Auto de même taille : +0,06 ms [−0,04 ; +0,19].

**Gain corrigé.** Netteté des traits de 71,7 % à 100 % (1080p) et de 40 % à 100 % (Retina), confirmé. Contrepartie mesurée : temps GPU ×2,55 sur Retina 14 (perte du 120 Hz sur M5), ×1,10 en 1080p.

### NATIF-02 — Le tampon du canvas ne tombe pas sur les pixels physiques quand la taille CSS ou le DPR est fractionnaire : un pixel d'écart retire 75 % du contraste fin
- sévérité haute · catégorie 3d-visuel · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · moteur (dans METAL)
- lieux : FERRO src/renderer.js:1543; FERRO src/renderer.js:1546; FERRO src/renderer.js:1702; METAL src/renderer.js:1387; METAL src/renderer.js:1390; METAL src/game.js:839

**Preuve.** FERRO src/renderer.js:1543 lit canvas.clientWidth (entier) et :1546 calcule Math.round(cssWidth×ratio) ; METAL :1387 et :1390. resize() est rappelé à chaque image (FERRO :1702, METAL :1535). Sonde dprprobe.html à DPR 1,1, 1,5, 1,75 et 3 sur 15 cas fractionnaires : la formule actuelle est juste 6 fois sur 15, round(rect×DPR) 12 fois, l'arrondi des bords 15 fois ; la référence est devicePixelContentBoxSize. Exemple : 411,43×914,29 px CSS à DPR 3 donne 1233×2742 au lieu de 1234×2743. blur.html : un tampon de 599 pour 600 pixels physiques fait tomber le contraste du damier à 24,9 % (pire bande 1,3 %) et la netteté des traits à 67,4 %.

**Cause.** La taille vient d'un clientWidth entier multiplié par un ratio, alors que le navigateur cale les bords de l'élément sur les pixels physiques. Seule la boîte en pixels physiques du ResizeObserver donne la taille exacte.

**Proposition.** Dans create() : new ResizeObserver(cb).observe(canvas,{box:'device-pixel-content-box'}), sous try/catch avec repli sur la boîte par défaut. Le rappel mémorise [inlineSize, blockSize] de devicePixelContentBoxSize. Si le champ manque (à vérifier sur Safari) : r = getBoundingClientRect(), largeur = round(r.right×dpr) − round(r.left×dpr), idem en hauteur, réévaluée au rappel et sur un écouteur matchMedia de résolution. resize() n'interroge plus clientWidth à chaque image et utilise la taille mémorisée. canvas.width et canvas.height ne sont modifiés que dans draw(), jamais dans le rappel, pour ne pas effacer l'image déjà dessinée. Après affectation, comparer gl.drawingBufferWidth à la demande et consigner capped:'gpu' si le navigateur a borné. Garde typeof ResizeObserver pour les tests sous Node.

**Gain attendu.** Plus aucun rééchantillonnage par le navigateur : contraste des détails d'un pixel de 24,9 % à 100 % dans les cas décalés (9 sur 15 dans la sonde). Une lecture de mise en page en moins par image.

**Risques.** Le rappel arrive après le dessin : une image étirée lors d'un redimensionnement. Repli nécessaire là où la boîte en pixels physiques n'existe pas. À activer avec le mode natif seulement, pour respecter la compatibilité de FERRO.

**Vérifier par.** dprprobe.html aux 6 DPR : 15 cas sur 15. Mire d'un pixel dans le canvas du jeu, capture d'écran, blur.py : contraste 100 %.

**Contre-vérification.** Code relu : clientWidth (entier) en :1543, Math.round(css×ratio) en :1546, resize() rappelé à chaque image en :1702. L'erreur est arithmétiquement certaine dès que la largeur CSS ou le DPR est fractionnaire (640,5 px CSS à DPR 1,5 : clientWidth 641 → 962 calculé pour 961 réels). Capture de netteté rejouée : tampon de 599 pour 600 → traits 67,4 %, damier 24,9 %, identique à l'annonce. La sonde dprprobe.html (6 justes sur 15) n'a pas pu être rejouée : je reprends son décompte sans preuve indépendante. Sévérité surestimée : le défaut ne se voit que si le tampon vise le natif (donc seulement en « Haute » aujourd'hui) et que le DPR ou la taille est fractionnaire (Windows à 125/150/175 %, zoom du navigateur, Android 2,625) ; en plein écran à DPR entier, la formule actuelle est exacte. Le titre « 75 % du contraste fin » ne vaut que pour un motif d'un pixel ; retenir −33 % de netteté des traits. À livrer avec le mode natif, pas avant. Vérifier devicePixelContentBoxSize sur Safari (repli obligatoire) et garder l'affectation de canvas.width dans draw().

**Gain corrigé.** Netteté des traits de 67,4 % à 100 % dans les cas décalés d'un pixel ; nul en plein écran à DPR entier.

### NATIF-03 — Le gouverneur baisse la résolution jusqu'à 42 % des pixels du mode Auto : le remplacer par une vigie qui ne touche jamais à l'image
- sévérité haute · catégorie saccade · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur et jeu
- lieux : FERRO src/renderer.js:806-826; FERRO src/renderer.js:1545; FERRO src/renderer.js:1702; FERRO src/renderer.js:1412; METAL src/renderer.js:746-764; METAL src/game.js:722

**Preuve.** FERRO src/renderer.js:806-826 : l'échelle descend par pas de 0,1 jusqu'à 0,65 quand la moyenne dépasse 25 ms pendant 1,3 s, et remonte par pas de 0,05 sous 18,5 ms pendant 5 s ; appliquée en :1545 et :1702. METAL :746-764, :1389, :1535 ; game.js:722 passe adaptive pendant le jeu. Au plancher (inventaire.mjs) : 1080p → 1163×654 (37 % du natif), MacBook Pro 14 → 1082×703 (13 %), 4K → 9 %. Chaque palier recrée toutes les cibles, car la clé d'ensureTargets contient la taille du canvas (:1412) ; RCPU-08 et RGPU-09 comptent 10 à 11 réallocations par minute sous vsync à 60 Hz.

**Cause.** Le gouverneur n'a qu'un levier, la résolution, et il agit sur un intervalle rAF qui ne mesure pas le coût réel.

**Proposition.** En mode natif, autoScale reste à 1. Le gouverneur devient une vigie : anneau de 240 valeurs de fx.frameMs ; stats.budget = {target (intervalle d'affichage mesuré), p50, p95, over (part au-delà de 1,25 × target), sustained (over > 10 % pendant 3 s)} ; rappel options.onBudget(stats.budget) à chaque changement d'état, au plus toutes les 5 s. Seul levier permis par défaut : le jeu verrouille son limiteur d'images sur taux d'affichage / 2 quand sustained est vrai (à brancher sur le limiteur corrigé par LOOP-09) ; l'image reste identique. Journal stats.budgetLog (32 entrées : instant, p95, cible, action), affiché dans le banc et dans le menu pause avec une suggestion (détail Économie ou échelle de rendu). Le mode historique garde resolutionGovernor tel quel. À fusionner avec le travail de l'axe STAB sur le gouverneur.

**Gain attendu.** Zéro changement de résolution et zéro réallocation de cibles en jeu (accrocs estimés à 5–30 ms par RGPU-09). Netteté constante.

**Risques.** Sur une machine trop faible, la cadence baisse au lieu de la résolution : il faut un message clair et l'option d'échelle (NATIF-04). Le verrouillage de cadence dépend de LOOP-09. Sans l'option native, comportement inchangé pour les jeux de la v0.2.

**Vérifier par.** bench/loop/harness.mjs avec 60 s de frameMs à 30 ms : taille du canvas constante, stats.budget.sustained vrai, un seul appel onBudget ; en mode historique, mêmes paliers qu'aujourd'hui.

**Contre-vérification.** Code relu : FERRO :806-826 (pas de −0,1 jusqu'à 0,65 quand la moyenne dépasse 25 ms pendant 1,3 s, remontée de +0,05 sous 18,5 ms pendant 5 s), appliqué en :1545 et :1702 ; la clé d'ensureTargets (:1412) contient la taille, donc chaque palier réalloue les cibles ; METAL :746-764 et game.js:722 (adaptive actif en jeu si la limite d'images vaut 0 ou au moins 60 et si la fenêtre a le focus). 0,65² = 42 % des pixels : exact. C'est le seul mécanisme qui retire de la résolution sans que le joueur l'ait demandé : c'est la demande explicite de David, d'où P0. Mesure indépendante de ce que le plancher rapporte (cfg/VA.json, tampon de 0,76 MPix contre 1,80) : −2,00 ms [−2,15 ; −1,83], −37 %. C'est donc aussi ce que perd une machine faible si on fige la résolution : la vigie doit arriver avec l'option d'échelle et un message. Réserves : le verrouillage sur un diviseur du taux d'affichage dépend du limiteur (game.js:676, faux hors multiples exacts d'après LOOP-09) ; 30 i/s verrouillés sur un écran 60 Hz ne sont pas une « fluidité parfaite » pour un FPS, à ne proposer qu'en dernier recours ; l'oscillation de 10 à 11 réallocations par minute vient de RCPU-08/RGPU-09 et n'a pas été re-mesurée ici. À fusionner avec l'axe STAB.

**Gain corrigé.** Zéro changement de résolution en jeu (certain par construction). Contrepartie : jusqu'à +37 % de temps GPU là où le gouverneur était au plancher.

### NATIF-04 — Les préréglages mêlent résolution et détail : « Économie » vaut 0,8 fois la taille CSS sans bloom ni ombres, « Haute » plafonne à DPR 2
- sévérité haute · catégorie architecture · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P2 · qualité meilleure · moteur et jeu
- lieux : FERRO src/renderer.js:1542; FERRO src/renderer.js:1414; FERRO src/renderer.js:1421; FERRO src/renderer.js:782-783; FERRO src/renderer.js:1037-1038; METAL src/renderer.js:1386; METAL src/renderer.js:1321; METAL src/game.js:763

**Preuve.** FERRO src/renderer.js:1542 (économie → ratio 0,8 quel que soit le DPR ; une qualité numérique est un ratio borné à [0,5 ; 2]) ; :1414 (économie : cibles de post et d'ombre libérées, donc bloom et ombres coupés d'office) ; :1421 (tuile d'ombre 512 ou 1024) ; :782-783 (portées de détail) ; :1718-1719 (6 ou 12 lumières) ; :1037-1038 (repli logiciel : 1024×720 au plus en auto). METAL :1386, :1321, :722-723, :977-978 ; game.js:763 fait tourner auto, économie, haute. Calcul : « Économie » rend 1210×786 sur un MacBook Pro 14 (16 % du natif) et 682×314 sur un téléphone DPR 3 (7 %) ; « Haute » y rend 44 % ; le repli logiciel rend 1024×576 sur un 1080p (28 %).

**Cause.** Un seul paramètre, quality, règle à la fois le ratio de pixels, les distances, le nombre de lumières et la présence des effets.

**Proposition.** FERRO, en mode natif : resize(détail) où détail vaut 'low', 'auto' ou 'high' et ne règle que les portées, le nombre de lumières, la tuile et l'emprise d'ombre. L'échelle est un réglage séparé (renderScale, défaut 1). En détail bas, les cibles de bloom et d'ombre restent allouées et le jeu coupe par fx.bloom et fx.shadows. Une qualité numérique reste un alias historique de l'échelle. Plafond de sécurité maxPixels (défaut proposé 8 847 360) : au-delà, échelle = sqrt(maxPixels/natif), capped:'safety' dans stats et mention dans les options. Repli logiciel : plafonds inchangés mais signalés par capped:'software'. METAL : « Économie » = détail bas, ombres et bloom coupés par ses propres préférences, à la résolution native.

**Gain attendu.** « Économie » net : 5,94 MPix au lieu de 0,95 sur Retina 14. Coût du détail bas en natif estimé à −34 % du rendu Auto, d'après les écarts mesurés (lumières, ombres, bloom).

**Risques.** « Économie » calcule 6 fois plus de pixels sur Retina : une machine faible perd des images tant que le joueur n'a pas baissé l'échelle ; prévoir un message au premier lancement. Les préférences enregistrées gardent leurs valeurs. Sans option native, rien ne change pour les jeux de la v0.2.

**Vérifier par.** inventaire.mjs sur le nouveau resize() ; checks/options.test.mjs pour la normalisation de renderScale ; comparaison visuelle d'« Économie » avant et après.

**Contre-vérification.** Faits exacts : :1542 (économie = 0,8 × CSS quel que soit le DPR, qualité numérique bornée à [0,5 ; 2]), :1414 (économie libère les cibles de post et d'ombre), :1421 (tuile 512 ou 1024), :782-783, :1718-1719 (6 ou 12 lumières), :1037-1038 (repli logiciel). Chiffres recalculés : 1210×786 sur Retina 14 (16 %), 1024×576 en logiciel sur 1080p (28 %). Séparer le détail de l'échelle est sain. La proposition « Économie en natif » est contestée : ce préréglage est choisi par les joueurs dont la machine ne suit pas, et le détail bas ne rend qu'environ −34 % (estimation du constat) alors que le nombre de pixels est multiplié par 6,25 sur Retina, soit un coût net de l'ordre de ×4 pour ces joueurs. Comme c'est un choix explicite du joueur, garder une échelle réduite n'enfreint pas la consigne de David. Recommandation corrigée : Économie = détail bas + échelle affichée et réglable, préréglée à sa valeur actuelle. Sévérité ramenée de haute à moyenne. Sans l'option native, rien ne doit changer pour les jeux de la v0.2.

**Gain corrigé.** Netteté réglable par le joueur en Économie ; ne pas compter sur un gain de cadence, c'est l'inverse si l'échelle passe à 100 %.

### NATIF-05 — Coût à la résolution native sur M5 : 2,0 à 2,3 ms par mégapixel plus 1 à 3 ms fixes ; la boucle des 12 lumières pèse 34 à 41 % de l'image
- sévérité haute · catégorie perf-gpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité sans objet · moteur (dans METAL)
- lieux : FERRO src/renderer.js:371-382; FERRO src/renderer.js:117-125; FERRO src/renderer.js:1719; METAL src/renderer.js:311-322; METAL src/renderer.js:1551

**Preuve.** Deux tailles dans le même processus (cfg/PS.json) : pente 1,95 à 2,28 ms/MPix (médiane 2,14 [1,96 ; 2,22]), part fixe 1,0 à 3,1 ms. Pages à résolution unique : 12,8 à 18,6 ms à 5,94 MPix, 16,6 à 21,8 ms à 8,29 MPix ; sous forte charge jusqu'à 21,3 et 30,7 ms. Par passe à 5,94 MPix (cfg/P-mac.json) : lumières 4,99 à 6,74 ms (34 à 41 %), ombres 1,34 à 2,16 ms, ciel 0,10 à 1,18 ms, post 0,79 à 1,15 ms, arme environ 1,1 ms. Pentes : lumières 0,77 ms/MPix [0,66 ; 0,84], ombres 0,10 [0,04 ; 0,14], ciel et post dans le bruit. La boucle est en FERRO src/renderer.js:371-382 (METAL :311-322) et le reflet GGX en :117-125.

**Cause.** Le shader du monde évalue pour chaque pixel 12 lumières avec diffus et reflet GGX complet. Ce coût croît avec le nombre de pixels, alors que les ombres, le ciel et le post sont presque fixes.

**Proposition.** (1) Inscrire le modèle temps = fixe + pente × MPix dans le banc (NATIF-13), mesuré à deux tailles dans le même processus, et l'afficher par scène. (2) Budgets à consigner dans VALIDATION.md pour le M5 : 60 i/s tenus jusqu'à 6,4–7,7 MPix au calme et 4,1–7,1 MPix sous charge ; 120 i/s jusqu'à 2,7–3,6 MPix. Pour tenir 60 i/s en 4K, il faut une pente d'au plus 1,7 ms/MPix avec 2,5 ms fixes. (3) Ordre de travail : la boucle des lumières d'abord (NATIF-07, NATIF-08) ; ne pas chercher de gain de résolution dans les ombres, le ciel ou le post.

**Gain attendu.** Aucun gain direct : c'est le modèle de coût qui dit où agir. Atteindre 1,7 ms/MPix représente −20 % sur la pente, soit plus que les −3,9 à −11 % mesurés ici.

**Risques.** Temps mesurés sans composition du navigateur ni logique de jeu, sur une machine chargée : les valeurs absolues varient de ±30 % d'une série à l'autre ; les parts et les pentes sont appariées. Valable pour un GPU Apple à tuiles ; à refaire sur les PC.

**Vérifier par.** node gen.mjs cfg/PS.json out/PS.html && ./run.sh out/PS.html 1920,1080 1 > out/PS.json && python3 -I ps.py

**Contre-vérification.** Pente retrouvée par une mesure à moi (cfg/VA.json, 1,80 et 5,94 MPix dans le même processus) : 8,44 ms / 4,14 MPix = 2,04 ms/MPix [1,84 ; 2,12], dans la fourchette annoncée. ps.py rejoué sur out/PS.json donne bien 2,14 [1,96 ; 2,22] et 0,77 pour les lumières. Lignes de la boucle (:371-382) et du reflet (:117-125) exactes. Deux corrections. (1) La décomposition laisse un poste sans nom : les matières procédurales (bruits, grilles, relief, FERRO :168-358) pèsent −2,80 ms [−3,54 ; −2,26], soit 17,8 % de l'image à 5,94 MPix (ablation flatmat, cfg/VB.json), deuxième poste après les lumières ; dire que la boucle des lumières est « le seul gros poste » est donc inexact (voir NATIF-V2). (2) Les budgets « 60 i/s tenus jusqu'à 6,4 à 7,7 MPix » sont du GPU seul, sans logique de jeu ni composition ; dans mes séries sous charge, la base à 5,94 MPix a varié de 12,3 à 28,8 ms : ne pas inscrire ces seuils dans VALIDATION.md sans la marge du jeu réel. Aucun gain direct : c'est un modèle, d'où P2.

**Preuve corrigée.** Pente 2,04 ms/MPix [1,84 ; 2,12] (VA). Parts à 5,94 MPix : lumières 34 à 41 % (données du constat), matières procédurales 17,8 % (ma mesure), ombres 8 à 15 %, post 5 à 8 %.

### NATIF-06 — Paquet exact (ciel après l'opaque, invalidateFramebuffer, ombre en profondeur seule) : image identique bit à bit, gain nul sur GPU Apple, à valider sur GPU à rendu immédiat
- sévérité moyenne · catégorie perf-gpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P2 · qualité identique · moteur (dans METAL)
- lieux : FERRO src/renderer.js:1623-1630; FERRO src/renderer.js:1741; FERRO src/renderer.js:1769; FERRO src/renderer.js:1636-1638; FERRO src/renderer.js:1434; METAL src/renderer.js:1460-1467; METAL src/renderer.js:1567; METAL src/renderer.js:1584; METAL src/renderer.js:1338

**Preuve.** Identité : 0 pixel différent sur 45 images en 4K (373 M de pixels par variante, cfg/X-4k.json) pour skylate, inval, depthvs et skyinval ; 0 sur 18 à 24 images à 5,94 MPix. Gains à 5,94 MPix : ciel −0,12 ms [−0,31 ; +0,10], invalidate −0,03 [−0,18 ; +0,12], profondeur seule −0,03 [−0,23 ; +0,26] ; paquet −0,04 [−0,39 ; +0,15], et −0,20 [−0,54 ; +0,04] en 4K. Contre-exemple : invalider aussi le tampon du canvas avant la composition coûte +0,30 ms [+0,15 ; +0,43]. Contexte créé sans profondeur : image identique, −0,07 ms [−0,31 ; +0,29], non retenu car le chemin sans bloom dessine dans le tampon par défaut et a besoin de sa profondeur.

**Cause.** Le ciel est dessiné en premier, plein écran et sans test de profondeur (4 octaves de nuages et 3 bruits de crête, FERRO :531-547). La profondeur de la scène est conservée après la passe alors que rien ne la relit. Le programme d'ombre exécute le shader de sommets complet avec ses 11 sorties.

**Proposition.** Reprendre trois variantes de npatches.mjs. skylate : le ciel passe après le lot dynamique et avant les particules, avec gl.enable(DEPTH_TEST), gl.depthMask(false) et gl.depthRange(1,1), puis retour à depthRange(0,1) et depthMask(true) ; le shader du ciel ne change pas. inval : gl.invalidateFramebuffer(FRAMEBUFFER,[DEPTH_ATTACHMENT]) sur la cible de scène juste avant postPass(), et [COLOR_ATTACHMENT0] sur les deux cibles du bloom juste après leur liaison ; ne jamais invalider le tampon du canvas. depthvs : DEPTH_VERT réduit à la position, mêmes expressions de rotation et de vent que VERT, attributs aux mêmes emplacements. Acceptation : écart maximal 0 sur les images du banc, sur chaque GPU.

**Gain attendu.** M5 : 0 (mesuré). GPU à rendu immédiat (Intel, AMD, NVIDIA) : le ciel n'est plus calculé sous le décor, gain estimé à 3–8 % de l'image en extérieur. GPU mobiles à tuiles : 4 octets par pixel de profondeur non réécrits à chaque image (24 Mo à 5,94 MPix), estimé.

**Risques.** Preuve faite sans MSAA : la refaire avec msaa:4 pour Point de rupture et BITUME. Le test renderer-reprises compare le flux de commandes GPU à la v0.1 : l'ordre du ciel et les invalidate le modifient ; mettre le test à jour et noter le changement dans VERSIONS.md, ou placer le paquet derrière une option. Suppose une profondeur effacée à 1 et un test LEQUAL (:1456, :1741), ce qui est le cas.

**Vérifier par.** node gen.mjs cfg/X-4k.json out/X-4k.html && ./run.sh out/X-4k.html 1920,1080 1 > out/X-4k.json : 45 images identiques par variante. Même comparaison dans le banc intégré sur les PC.

**Contre-vérification.** Rejoué (cfg/VB.json, variante skylate+inval+depthvs) : 18 images sur 18 identiques au bit près à 5,94 MPix, gain −0,03 ms [−0,43 ; +0,35], donc nul sur M5 comme annoncé. Patchs relus : ciel au plan lointain avec depthRange(1,1) et depthMask(false), valide avec un effacement à 1 et LEQUAL ; placé avant les particules et avant l'effacement de profondeur de l'arme. Corrections : le champ gainBasis « mesuré » ne vaut que pour le zéro sur GPU Apple ; les 3 à 8 % sur GPU à rendu immédiat sont une estimation, bornée par le coût total du ciel (0,10 à 1,18 ms). Sur les 373 M de pixels en 4K, je n'ai pas rejoué. Risque réel : le test renderer-reprises de FERRO compare le flux de commandes GPU à la v0.1, donc déplacer le ciel et ajouter des invalidate le casse (non vérifiable ici, dépôt absent) ; à placer derrière une option ou à livrer avec la mise à jour du test. Avec MSAA, j'ai mesuré qu'invalider la profondeur multi-échantillon avant la résolution et la couleur après est identique en image mais coûte +0,28 ms [+0,17 ; +0,42] (cfg/VD.json) : ne pas étendre inval au chemin MSAA. À ne faire qu'après mesure sur le PC NVIDIA ; sans cela, c'est du code en plus pour zéro gain.

**Gain corrigé.** 0 sur Apple M5 (confirmé). Gain sur Intel, AMD et NVIDIA non mesuré : au plus le coût du ciel sous le décor.

### NATIF-07 — Branches exactes dans le shader du monde : −3,9 % à 5,94 MPix et −4,7 % en 4K, écart d'au plus 1 niveau sur moins d'un pixel par million
- sévérité moyenne · catégorie perf-gpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité visuellement identique · moteur (dans METAL)
- lieux : FERRO src/renderer.js:381; FERRO src/renderer.js:386; FERRO src/renderer.js:393; FERRO src/renderer.js:394-398; FERRO src/renderer.js:433-437; FERRO src/renderer.js:134-166; METAL src/renderer.js:321; METAL src/renderer.js:326; METAL src/renderer.js:333; METAL src/renderer.js:334-338; METAL src/renderer.js:373-377

**Preuve.** Paquet exactplus (NATIF-06 + reflet sauté quand N·L ≤ 0 + branches sur uniformes + lectures d'ombre conditionnelles) : −0,60 ms [−0,86 ; −0,40] à 5,94 MPix (intérieur −1,15 ms [−1,96 ; −0,84], −7,9 %) ; −0,94 ms [−1,43 ; −0,74] en 4K (intérieur −1,91 ms, −8,8 %). Image : écart maximal 1 niveau, 6 à 13 pixels par lot de 4 à 6 images. Isolément à 5,94 MPix : branches sur uniformes −0,24 ms [−0,51 ; −0,04] ; reflet conditionnel −0,12 ms [−0,47 ; +0,03] en tout et −0,99 ms [−1,40 ; −0,36] en intérieur ; lectures d'ombre conditionnelles +0,02 ms [−0,17 ; +0,11] avec 1 pixel différent sur 373 M. metalHighlight se termine par une multiplication par nl (FERRO :124) : le terme est exactement nul quand la surface tourne le dos à la lumière.

**Cause.** Des termes multipliés par un zéro exact sont calculés en entier : le reflet GGX des 12 lumières, du soleil et de la torche sur les faces qui leur tournent le dos ; l'éclair de bouche, l'onde et le voile de dégâts quand leur uniforme vaut 0.

**Proposition.** Reprendre ggxgate, ubranch et shgate de npatches.mjs : if(diffuse>0.) devant le reflet de la boucle ; if(sunlight>0.&&dot(n,uSunDirection)>0.) devant celui du soleil ; if(torch>0.&&dot(n,torchDirection)>0.) devant celui de la torche ; if(uEffects.y>0.){…} autour de l'éclair de bouche, if(uEffects.z>0.){…} autour du voile, if(uEffects.w>0.){…} autour de l'onde ; shadow(n,l,slot,need) où les dérivées restent calculées avant le test et seules les lectures de l'atlas sont conditionnelles. Acceptation : écart d'au plus 1 niveau sur au plus 1 pixel par million, sur les 4 scènes du banc.

**Gain attendu.** −0,60 ms (−3,9 %) à 5,94 MPix, −0,94 ms (−4,7 %) en 4K ; jusqu'à −8,8 % en intérieur.

**Risques.** Pas identique au bit près : le compilateur réordonne quelques opérations flottantes. Sur un GPU où les branches coûtent cher, le gain peut s'annuler : garder la comparaison dans le banc. Seul le texte du shader change, ce que la règle de FERRO 0.2 admet.

**Vérifier par.** node gen.mjs cfg/F-mac.json out/F-mac.html && ./run.sh out/F-mac.html 1920,1080 1 > out/F-mac.json && python3 -I an.py out/F-mac.json (ligne exactplus) ; idem cfg/F-4k.json.

**Contre-vérification.** Rejoué (cfg/VB.json et VC.json, 5,94 MPix). Paquet exactplus : −0,74 ms [−1,18 ; −0,23], −4,9 %, écart maximal 1 niveau sur 9 à 13 pixels par lot : conforme. Mais le gain n'est pas réparti comme annoncé. Reflet conditionnel seul (ggxgate) : −0,15 ms [−0,66 ; +0,17] toutes scènes, −1,76 ms [−2,21 ; −0,40] (−8,2 %) en intérieur. Branches sur uniformes seules (ubranch) : −0,07 ms [−0,47 ; +0,19], les −0,24 ms annoncés ne sont pas reproduits. Lectures d'ombre conditionnelles : gain nul d'après le constat lui-même. Dans la capture de jeu en extérieur, le paquet n'est pas significatif (−0,32 ms [−0,83 ; +0,59]). Conclusion : ne livrer que ggxgate (trois tests devant le reflet de la boucle, du soleil et de la torche, exacts car metalHighlight se termine par ×nl, :124) ; laisser shgate et ubranch de côté tant qu'un autre GPU ne montre pas de gain, chacun ajoutant des écarts d'un niveau pour rien. L'image n'est pas identique au bit près : annoncer « 1 niveau sur environ 2 pixels par image ». Effet de bord favorable : le test évite le NaN de normalize(view+l) quand la lumière est exactement à l'opposé du regard. C'est le seul gain sans perte mesuré en natif sur GPU Apple, d'où P1.

**Gain corrigé.** −4,9 % [−7,8 ; −1,5] toutes scènes à 5,94 MPix ; −8 à −9 % en intérieur ; non significatif en extérieur. Presque tout vient du reflet sauté quand N·L ≤ 0.

### NATIF-08 — Lumières à portée finie : sauter une lumière hors de portée est exact, mais la fenêtre de portée modifie l'image de 9 niveaux au plus ; −9 à −11 %, à décider par David
- sévérité moyenne · catégorie perf-gpu · effort M · gain mesuré
- contre-vérification : **plausible**, priorité P3 · qualité dégradée · moteur et jeu
- lieux : FERRO src/renderer.js:1722; FERRO src/renderer.js:375-377; FERRO src/renderer.js:1719; METAL src/renderer.js:1554; METAL src/renderer.js:315-317; METAL src/world.js

**Preuve.** Les lumières des mondes n'ont pas de portée (inventaire RGPU, 21 mondes) : lightRanges[i]=light.range||0 (FERRO :1722) et l'atténuation de :375-377 n'atteint jamais 0. Fenêtre (1−(d/R)^4)², R tel que la contribution vaille 0,004 : image modifiée de 6 à 9 niveaux au plus, plus de 3 niveaux sur 8 700 à 57 000 pixels par lot de 4 à 6 images à 5,94 MPix, MAD 0,24 à 0,43. Le saut if(i>0&&d>=R)continue est exact par rapport à cette fenêtre (1 niveau sur 1 à 28 pixels). Paquet visu4 : −1,65 ms [−2,00 ; −1,15] à 5,94 MPix (−6,3, −15,0, −13,0 et −7,7 % selon la scène) ; −1,86 ms [−2,44 ; −1,56] en 4K (intérieur −3,85 ms, −17,7 %). Seuil 0,001 : écart 2 à 4 niveaux mais gain nul (+0,04 ms [−0,26 ; +0,33]). Images A/B à 1920×1080 dans bench/natif/out : écart maximal 7 ; plus d'un niveau sur 9,7 % (extérieur) et 5,7 % (intérieur) des pixels.

**Cause.** Faute de portée, la contribution d'une lumière n'est jamais exactement nulle : aucun saut ne peut être exact, et chaque pixel paie 12 lumières (0,77 ms/MPix).

**Proposition.** Option désactivée par défaut dans FERRO : fx.lightRange:'auto' calcule R = sqrt(((i<2 ? 0,27 : 0,13) × max(couleur) × puissance / 0,004 − 1) / 0,26), applique la fenêtre (1−(d/R)^4)² et saute la lumière pour i > 0 quand d ≥ R. Le créneau 0 n'est pas sauté, pour garder les dérivées de son ombre en flux uniforme. Si David accepte l'image, écrire la portée de chaque lumière dans world.js : l'image avec portées devient la référence et le saut est alors exact.

**Gain attendu.** −9,4 à −11,1 % du temps d'image (−6 à −18 % selon la scène), si l'option est acceptée.

**Risques.** Change l'image : le remplissage lointain des zones sombres baisse de 9 niveaux au plus. Ce n'est donc pas une optimisation sans perte, d'où le défaut désactivé. Se recoupe avec RGPU-13. Sans effet sur les sauvegardes ni le déterminisme.

**Vérifier par.** cfg/F-mac.json et cfg/F-4k.json (lignes visu4 et visu1) ; comparer à l'œil out/ab-base-ext.png et out/ab-visu4-ext.png, puis out/ab-base-int.png et out/ab-visu4-int.png.

**Contre-vérification.** Non re-mesuré ; j'ai seulement rejoué an.py sur out/F-mac.json (visu4 : −1,65 ms [−2,00 ; −1,15], écart maximal 6 à 9, plus d'un niveau sur 0,8 à 2,0 M de pixels par lot de 4 à 6 images) et relu le patch : la formule de portée et le saut pour i > 0 sont cohérents. Le constat reconnaît lui-même que l'image change : ce n'est pas une optimisation sans perte, et seule l'option désactivée par défaut est recevable. Risque non signalé : la portée dépend du créneau (0,27 pour i < 2, 0,13 sinon), donc elle saute quand une lumière change de créneau, par exemple à l'arrivée d'une lumière passagère d'explosion (RGPU-05) ; corriger RGPU-05 d'abord et attacher la portée à la lumière, pas au créneau. Écrire des portées dans world.js change l'image de référence de tous les mondes : décision de David sur les deux paires d'images, rien avant.

### NATIF-09 — Le reflet limité à 4 lumières (RGPU-01) n'est pas sans différence visible à la résolution native : jusqu'à 42 niveaux d'écart
- sévérité moyenne · catégorie perf-gpu · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité dégradée · moteur (dans METAL)
- lieux : FERRO src/renderer.js:381; METAL src/renderer.js:321

**Preuve.** Variante spec4 (if(i<4) devant le reflet de FERRO :381) à 5,94 MPix : −1,97 ms [−2,11 ; −1,79] soit −13,8 % (−12,6 à −16,8 % par scène). Image : écart maximal 19 à 42 niveaux, plus de 10 niveaux sur 189 à 4 422 pixels par lot de 4 à 6 images, plus de 3 niveaux sur 7 000 à 43 000 pixels, MAD 0,033 à 0,065. Ajoutée à la portée finie, elle n'apporte presque rien à 5,94 MPix (−11,2 % contre −11,1 %) et un peu en 4K (−11,7 % contre −9,4 %).

**Cause.** Les lumières des créneaux 4 à 11 produisent de vrais reflets sur le métal proche ; le premier tour avait jugé la variante sur une moyenne (MAD 0,037) à 1,8 MPix, qui masque ces points brillants.

**Proposition.** Ne pas mettre spec4 dans le chemin par défaut. Le réserver au détail bas, où il n'y a déjà que 6 lumières. Dans le chemin par défaut, utiliser le saut exact de NATIF-07 (reflet sauté quand N·L ≤ 0), qui donne −6,1 % en intérieur avec 1 niveau d'écart au plus.

**Gain attendu.** −13,8 % si le levier est activé en détail bas ; 0 par défaut.

**Risques.** Corrige le classement de RGPU-01 (« sans différence visible ») : à signaler à qui l'implémente pour qu'il ne l'active pas par défaut.

**Vérifier par.** cfg/L2-mac.json, ligne spec4 : colonnes « écart max » et « >10 ».

**Contre-vérification.** Rejoué (cfg/VB.json, variante spec4) : −2,17 ms [−2,88 ; −1,81], −13,6 % à 5,94 MPix ; écart maximal 23, 37, 42 et 19 niveaux selon la scène ; plus de 10 niveaux sur 189, 4 422, 710 et 308 pixels par lot : chiffres du constat retrouvés à l'unité près. La moyenne reste infime (MAD 0,033 à 0,065), ce qui explique le classement « sans différence visible » du premier tour, mais des reflets entiers disparaissent sur le métal proche. La correction de RGPU-01 est donc fondée et doit parvenir à Codex avant l'implémentation : ne pas activer la limite à 4 lumières par défaut. La réserver au détail bas dégrade aussi cette image-là : à n'accepter que comme option. P1 parce qu'il évite une perte de qualité qui allait être livrée ; aucun gain à attendre par défaut.

**Gain corrigé.** 0 par défaut. −13,6 % seulement si la limite est activée, avec perte visible de reflets.

### NATIF-10 — Tri avant-arrière et pré-passe de profondeur : plus lents sur GPU Apple et image différente ; des faces coplanaires dépendent de l'ordre de dessin
- sévérité moyenne · catégorie 3d-visuel · effort M · gain mesuré
- contre-vérification : **plausible**, priorité P3 · qualité sans objet · moteur et jeu
- lieux : FERRO src/renderer.js:1456; FERRO src/renderer.js:1714; FERRO src/renderer.js:1434; METAL src/renderer.js:1357; METAL src/renderer.js:1546; METAL src/world.js

**Preuve.** À 5,94 MPix : tri des statiques par distance +0,21 ms [+0,06 ; +0,42] ; pré-passe (programme de profondeur existant, gl_Position invariant, couleur sans écriture de profondeur) +2,40 ms [+1,95 ; +2,88] soit +16,2 %. Images : le tri change 79 à 4 716 pixels par lot avec un écart de 36 à 144 niveaux ; la pré-passe change 35 000 à 85 000 pixels avec un écart de 116 à 151 niveaux. Le test de profondeur est LEQUAL (FERRO :1456), donc le dernier dessiné gagne à profondeur égale, et l'ordre de soumission suit la requête de l'index spatial (:1714).

**Cause.** (1) Le GPU Apple élimine déjà les surfaces cachées par tuile : trier ou pré-dessiner n'ajoute que du travail. (2) Des faces du décor se recouvrent dans le même plan : le pixel gagnant dépend de l'ordre de dessin, qui change avec l'ensemble visible. C'est un scintillement latent. (3) La profondeur du programme d'ombre ne retombe pas exactement sur celle du programme principal malgré invariant.

**Proposition.** (a) Ne pas livrer la pré-passe. (b) Écrire un contrôle qui compte, par monde, les paires de faces statiques coplanaires qui se recouvrent, puis les supprimer à la génération dans world.js ; ou rendre le gagnant stable par un décalage de profondeur minuscule tiré d'un hachage de la position d'instance dans le shader de sommets (de l'ordre de 1e-5 × w). (c) Une fois l'écart du tri revenu à 0, essayer un ordre proche-vers-loin par bandes sur les GPU à rendu immédiat. Acceptation : variante f2b contre base, écart maximal 0.

**Gain attendu.** Supprime des pixels dont la couleur dépend de l'ordre de dessin (environ 800 par image à 5,94 MPix dans la capture de jeu). Ouvre un ordre de dessin exact pour les GPU à rendu immédiat, où RGPU a compté 1,70 fragment par pixel contre 1,54 une fois trié.

**Risques.** Le décalage stable change le gagnant actuel dans ces pixels (aujourd'hui arbitraire). Le gain du tri sur les PC n'est pas mesuré ici. Toucher world.js change la génération : vérifier les tests de collision et le format des sauvegardes si des maillages disparaissent.

**Vérifier par.** cfg/L2-mac.json : la ligne f2b doit passer à « max 0 » après correction ; nombre de recouvrements coplanaires à 0 pour les 21 mondes.

**Contre-vérification.** Tri avant-arrière rejoué (cfg/VB.json) : +0,20 ms [+0,02 ; +0,33], image différente (écart maximal 66, 136, 36 et 144 ; 4 716, 286, 79 et 938 pixels par lot), conforme. Pré-passe non rejouée. Ne livrer ni l'un ni l'autre : confirmé. La cause avancée (faces coplanaires dans world.js) n'est pas prouvée : aucun décompte de paires coplanaires n'a été fait. Autre cause possible, non examinée : la précision de profondeur. Avec near = 0,045 (:1707) et 24 bits, le pas de profondeur vaut environ 3 mm à 50 m et 13 mm à 100 m, donc deux surfaces distinctes mais proches (plaque posée sur un mur) tombent à égalité au loin, et LEQUAL donne alors la victoire au dernier dessiné. Dans ce cas, retirer des faces à la génération ne corrige rien. Le décalage de profondeur par hachage d'instance est risqué : il déplace les intersections entre objets qui se touchent et change l'image partout, sans preuve qu'elle soit meilleure. Avant tout changement : localiser les pixels (champ worst.box des différences) et trancher entre coplanarité et précision. Toucher world.js engage le déterminisme, les collisions et les sauvegardes.

**Gain corrigé.** Aucun gain de temps. Environ 800 pixels par image sur 5,94 M (0,013 %) dépendent de l'ordre de dessin ; scintillement visible non démontré.

### NATIF-11 — Passes d'ombre : coût fixe indépendant de la résolution ; borne supérieure mesurée d'un cache d'atlas
- sévérité moyenne · catégorie perf-gpu · effort M · gain mesuré
- contre-vérification : **plausible**, priorité P2 · qualité sans objet · moteur (dans METAL)
- lieux : FERRO src/renderer.js:1578-1595; FERRO src/renderer.js:1596-1622; FERRO src/renderer.js:1733-1738; METAL src/renderer.js:1422-1459; METAL src/renderer.js:1562-1566

**Preuve.** Atlas figé après la première image, lecture conservée (variante shskip, fx.skipSh=7) : −0,88 ms [−1,35 ; −0,66] à 5,94 MPix (−0,52, −0,77, −1,56 et −1,63 ms par scène), −1,12 ms [−1,45 ; −0,47] en 4K, −0,50 ms [−0,79 ; −0,27] en 1080p ; le CPU d'émission baisse de 0,62 à 1,75 ms par image. Ombres entièrement coupées : −1,89 ms (−12,9 %) à 5,94 MPix. La pente par mégapixel des ombres n'est que de 0,10 ms [0,04 ; 0,14] : c'est la lecture dans le shader. La liste des projeteurs de la lampe est déjà stable (FERRO :1589-1592) mais sa tuile est redessinée à chaque image ; le centre du soleil est calé au texel (:1603).

**Cause.** Les trois vues de profondeur sont redessinées à chaque image avec tous leurs projeteurs statiques, même quand ni la lumière ni le décor n'ont bougé.

**Proposition.** Pour l'axe DRAW, qui conçoit le cache. Lampe : dessiner une fois les projeteurs statiques dans une tuile de réserve, puis à chaque image copier cette tuile (blitFramebuffer de profondeur) et n'y ajouter que les projeteurs dynamiques. Soleil : ne redessiner que si le centre calé change ou si un projeteur dynamique a bougé. Torche : à chaque image. Le gain ne peut pas dépasser la borne mesurée ici. La preuve d'identité d'image (écart maximal 0) reste à faire à l'implémentation avec cfg/X-4k.json.

**Gain attendu.** Au plus −0,5 à −1,1 ms de GPU et −0,6 à −1,75 ms de CPU par image, quelle que soit la résolution.

**Risques.** Borne supérieure seulement : un cache réel garde la copie et les projeteurs dynamiques. L'identité d'image du cache n'est pas prouvée ici. Invalidation à chaque révision de destruction (updateWorld, FERRO :1529).

**Vérifier par.** cfg/P-mac.json et cfg/P-4k.json, ligne shskip ; puis variante de cache réelle dans cfg/X-4k.json avec écart maximal 0.

**Contre-vérification.** Borne non re-mesurée (les données de out/P-*.json sont cohérentes). Lignes exactes. La borne est loin d'être atteignable en jeu, et le constat ne le dit pas assez : la torche dépend de l'œil et des axes (:1738), donc elle se redessine à chaque image ; le centre du soleil vaut œil + 8 × direction du regard, calé au texel (:1602-1603, texel d'environ 0,11 m à 28 m d'emprise et 512 de tuile), donc il change à presque chaque image dès que le joueur tourne ou avance (1° de rotation déplace le centre de 0,14 m). Seules les tuiles de lampe (une en extérieur, deux en intérieur, :1652) sont cachables en mouvement, et il faut encore la copie et les projeteurs dynamiques. Le gain réaliste est donc une fraction de la borne, sans doute moins de la moitié. Coût fixe indépendant de la résolution : confirmé par la pente de 0,10 ms/MPix. À laisser à l'axe DRAW, avec preuve d'identité d'image à l'implémentation et invalidation à chaque révision de destruction.

**Gain corrigé.** Borne haute −0,5 à −1,1 ms GPU et −0,6 à −1,75 ms CPU ; atteignable en mouvement : la part des tuiles de lampe seulement.

### NATIF-12 — MSAA ×4 (option de FERRO utilisée par Point de rupture et BITUME) à la résolution native : +26 % de temps d'image et 265 Mo en 4K
- sévérité moyenne · catégorie perf-gpu · effort S · gain estimé
- contre-vérification : **confirmé**, priorité P3 · qualité dégradée · moteur (dans METAL)
- lieux : FERRO src/renderer.js:1400-1409; FERRO src/renderer.js:1418; FERRO src/renderer.js:1764-1768; FERRO src/renderer.js:1339-1343

**Preuve.** Renderer créé avec {msaa:4} contre le même sans : +4,11 ms [+3,85 ; +4,52] soit +26,0 % à 5,94 MPix (+22,4 à +28,4 % par scène) ; +5,34 ms [+4,86 ; +5,59] soit +25,3 % en 4K. msaaTarget alloue deux tampons multi-échantillons RGBA8 et DEPTH24 à la taille du canvas (FERRO :1400-1409, :1418), résolus par blitFramebuffer (:1764-1768). Mémoire calculée : 190 Mo à 5,94 MPix, 265 Mo en 4K, en plus des 132 Mo de la scène et du tampon par défaut. METAL n'a aucun anticrénelage : les arêtes en escalier se voient dans out/ab-base-int.png (1920×1080).

**Cause.** Le nombre d'échantillons est fixe, quel que soit le nombre de pixels physiques par pixel CSS ; à la résolution native d'un écran dense, 4 échantillons par pixel coûtent un quart de l'image.

**Proposition.** Ajouter une valeur msaa:'auto' dans settings() : 4 échantillons quand le DPR est inférieur à 2, 2 quand il vaut 2 ou plus (si MAX_SAMPLES le permet). msaa:4 garde son sens actuel. Consigner stats.msaa et la mémoire estimée des cibles. Chaque jeu choisit dans sa session.

**Gain attendu.** Environ −13 % sur les écrans à DPR 2 pour les jeux qui passent à msaa:'auto' (moitié du surcoût mesuré), et −95 à −130 Mo.

**Risques.** Deux échantillons à DPR 2 n'ont pas été mesurés ni comparés à l'œil : c'est une baisse du nombre d'échantillons, donc une décision du jeu. Coût du MSAA très différent sur NVIDIA (faible) et sur GPU intégré (fort) : à mesurer au banc.

**Vérifier par.** cfg/F-mac.json et cfg/F-4k.json, ligne msaa4 ; ajouter une variante à 2 échantillons et une comparaison d'images des arêtes.

**Contre-vérification.** Surcoût du MSAA ×4 rejoué deux fois : +5,51 ms [+4,73 ; +6,47] (+25,6 %, VC) et +3,56 ms [+3,02 ; +4,23] (+25,3 %, VD) : conforme aux +26 %. Mémoire : 5,94 M × 4 × 8 octets = 190 Mo, exact. En revanche le gain attendu de msaa:'auto' est réfuté par la mesure que le constat n'avait pas faite : deux échantillons coûtent encore +2,80 ms [+2,31 ; +3,29] (+19,9 %), soit seulement −0,64 ms [−0,89 ; −0,50] (−3,8 %) par rapport à quatre (cfg/VD.json, stats.msaa = 2 vérifié). Environ 80 % du surcoût est donc fixe (stockage et résolution par blitFramebuffer) et ne dépend pas du nombre d'échantillons. Invalider la profondeur et la couleur multi-échantillons autour de la résolution : image identique, +0,28 ms [+0,17 ; +0,42], donc inutile. Passer de 4 à 2 échantillons est une baisse de qualité pour 4 % : à ne pas faire par défaut ; msaa:'auto' n'a d'intérêt que pour la mémoire (−95 Mo à 5,94 MPix). À re-mesurer sur NVIDIA et GPU intégré avant toute décision.

**Gain corrigé.** −3,8 % [−5,3 ; −3,0] en passant de 4 à 2 échantillons sur M5, au lieu des −13 % estimés ; −95 Mo à 5,94 MPix et −130 Mo en 4K (calcul inchangé).

### NATIF-13 — Banc intégré et protocole d'acceptation : temps GPU par passe, temps CPU par système, résolution réellement rendue, critères chiffrés par classe de machine
- sévérité haute · catégorie outillage · effort L · gain qualitatif
- contre-vérification : **plausible**, priorité P1 · qualité sans objet · moteur et jeu
- lieux : METAL src/game.js:723-729; FERRO src/renderer.js:1700-1770; FERRO banc/index.html

**Preuve.** Le jeu n'affiche qu'un compteur d'images (METAL game.js:723-729). EXT_disjoint_timer_query_webgl2 existe sur M5 avec ANGLE Metal, mais RGPU l'a trouvée inexploitable (11 résultats sur 40, valeurs cumulées). Ici, la synchronisation par readPixels en blocs de 10 images donne un bruit A/A de −0,04 ms [−0,18 ; +0,04]. Piège mesuré : dans une page qui mêle deux résolutions, le biais de position atteint −0,9 ms (−5 %). Les gains des optimisations pour GPU à rendu immédiat (ciel tardif, ordre de dessin, arme d'abord) ne peuvent pas être validés sur ce Mac.

**Cause.** Aucun outil ne mesure, sur la machine du joueur, le temps par passe, la taille réelle du tampon ni la part d'images hors budget.

**Proposition.** FERRO : page banc/natif.html utilisable en file:// et renderer.profile(true). (1) Si l'extension de minuterie existe : une requête TIME_ELAPSED par passe (ombres lampe, soleil, torche ; ciel ; opaque statique ; dynamique ; particules ; arme ; post), lue au moins 2 images plus tard et jetée si GPU_DISJOINT. (2) Sinon : mode d'ablation du banc (la même image rendue avec et sans la passe, blocs de 10 images, une synchronisation readPixels, variantes à la même résolution, ordre tourné). (3) CPU : performance.now() autour de sim.step, de la construction des modèles, de draw() et du HUD. (4) Intervalles rAF : p50, p95, p99, part au-delà du budget, taux d'affichage déduit de la médiane de 120 intervalles. (5) Ligne de résolution : canvas, pixels physiques, échelle, plafond, nombre de changements de taille. (6) 4 scènes rejouées à la résolution native. (7) Bascule de chaque optimisation avec empreinte des pixels lus, pour refaire la preuve d'identité sur chaque GPU. (8) Export JSON à coller. Critères proposés : zéro changement automatique de taille ; tampon égal aux pixels physiques ou plafond signalé ; NATIF-06 à écart 0 ; NATIF-07 à 1 niveau au plus sur 1 pixel par million. Cibles : PC NVIDIA 120 i/s en 1440p et 60 i/s en 4K, au plus 1 % d'images hors budget ; Apple M3–M5 60 i/s à 5,94 MPix, au plus 5 % au-delà de 16,7 ms et aucune au-delà de 33,3 ms ; GPU intégré en 1080p 30 i/s verrouillés en Auto et 60 i/s en détail Économie ; téléphone 30 i/s verrouillés.

**Gain attendu.** Rend vérifiables sur les PC de David les gains que ce Mac ne peut pas montrer, et transforme « fluidité parfaite » en critères mesurés par machine.

**Risques.** Les cibles pour NVIDIA, GPU intégré et téléphone sont extrapolées, non mesurées. Les requêtes de minuterie peuvent être absentes ou arrondies selon le navigateur. Le banc ne doit ouvrir aucun port ni charger aucun fichier externe (règles AGENTS.md). Poids : quelques kilo-octets dans FERRO, à garder hors de la page du jeu si le budget de taille l'exige.

**Vérifier par.** Sur ce Mac, le banc intégré doit retrouver, à ±0,3 ms, les écarts de cfg/F-mac.json (exactplus −0,60 ms, msaa4 +4,11 ms). Sur chaque PC : export JSON du banc à 2 résolutions.

**Contre-vérification.** Constat qualitatif, cohérent. Vérifié : game.js:723-729 n'affiche qu'un compteur d'images ; l'extension de minuterie est bien annoncée par ce Chrome (timerExt true dans mes sorties) ; la méthode par blocs synchronisés donne chez moi un bruit A/A de −0,12 ms [−0,23 ; +0,32] et reproduit les écarts du constat. Sans ce banc, NATIF-06, le tri et tout ce qui vise les GPU à rendu immédiat restent invérifiables sur les PC de David, d'où P1. Réserves : les cibles NVIDIA, GPU intégré et téléphone sont extrapolées et ne doivent pas devenir des critères d'acceptation avant une première mesure ; la cible « 60 i/s à 5,94 MPix sur M3 à M5 » est déjà fragile sur M5 (12,3 à 28,8 ms selon la charge, GPU seul) ; le critère de vérification « ±0,3 ms » est plus serré que le bruit observé d'une série à l'autre (exactplus : −0,60 chez lui, −0,74 chez moi) : comparer des écarts relatifs appariés. Ajouter au banc l'ablation des matières (flatmat) et le couple Auto/natif. Recouvre l'axe STAB : un seul outil pour les deux. Garder le banc hors de la page du jeu (budget de taille, aucun port).

### NATIF-14 — Le halo du bloom est défini en pixels du tampon : son empreinte à l'écran rétrécit quand la résolution monte
- sévérité basse · catégorie 3d-visuel · effort S · gain mesuré
- contre-vérification : **plausible**, priorité P3 · qualité sans objet · moteur (dans METAL)
- lieux : FERRO src/renderer.js:1415; FERRO src/renderer.js:563-577; FERRO src/renderer.js:1631-1643; METAL src/renderer.js:1322; METAL src/renderer.js:503-517

**Preuve.** Les cibles du bloom font un quart du canvas (FERRO src/renderer.js:1415) et le flou lit à ±1,38 et ±3,23 texels (:571-575) : le rayon vaut environ 13 pixels physiques quelle que soit la résolution, soit 1,2 % de la hauteur à 1080 lignes et 0,6 % à 2160. Mesure sur 10 images de la capture, rendues avec puis sans bloom : pixels modifiés d'au moins 2 niveaux 13,04 % à 1920×1080 contre 12,22 % à 3840×2160 (−6,3 % en relatif), pour un apport moyen égal (0,94 et 0,96 niveau).

**Cause.** Le diviseur des cibles du bloom est fixe (4) : la taille du halo suit les pixels du tampon et non la taille de l'écran.

**Proposition.** En mode natif, choisir le diviseur d = 4 × max(1, round(hauteur/1080)) : 4 jusqu'à 1620 lignes, 8 en 4K, 12 en 6K. Garder l'extraction actuelle au quart et ajouter une réduction bilinéaire par 2 avant le flou quand d = 8. Le halo garde ainsi la même part de l'écran qu'à 1080 lignes, c'est-à-dire l'aspect que voient aujourd'hui les joueurs en Auto. Sans l'option native, rien ne change.

**Gain attendu.** Halo de taille constante à l'écran entre 1080p et 4K (écart mesuré aujourd'hui : −6,3 % d'empreinte). Cibles du bloom 4 fois plus petites en 4K, gain de temps estimé faible.

**Risques.** En 4K, l'image diffère légèrement de la « Haute » actuelle (halo un peu plus large) : c'est voulu, mais à noter dans VERSIONS.md. Une réduction supplémentaire peut faire scintiller de très petites sources brillantes : vérifier sur les étincelles.

**Vérifier par.** node gen.mjs cfg/bloom.json out/bloom.html && ./run.sh out/bloom.html 1920,1080 1 > out/bloom.json : les deux empreintes doivent être égales à 0,3 point près.

**Contre-vérification.** Non rejoué. Code relu : cibles au quart (:1415), flou à ±1,38 et ±3,23 texels (:571-575), donc le rayon est bien fixe en pixels du tampon. L'effet mesuré est minime : 13,04 % contre 12,22 % de pixels touchés, apport moyen inchangé. La proposition change l'image de la « Haute » actuelle en 4K et ajoute une cible et une passe ; une réduction supplémentaire par 2 en un seul prélèvement bilinéaire peut faire scintiller les petites sources brillantes (étincelles, traçantes). Rien ne prouve que le résultat soit meilleur, il est seulement plus constant d'une résolution à l'autre. À ne faire que si David trouve le halo trop fin en 4K, et en mode natif uniquement.

**Gain corrigé.** Empreinte du halo +6,3 % en relatif en 4K ; gain de temps non mesuré, vraisemblablement nul.

## Constats ajoutés par le contre-vérificateur

### NATIF-V1 — Le natif imposé par défaut fait perdre le 120 Hz que le M5 tient aujourd'hui : choisir l'échelle une fois, par calibrage, sans jamais descendre sous l'Auto actuel
- sévérité haute · catégorie saccade · effort M · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : FERRO src/renderer.js:1539-1552; FERRO src/renderer.js:806-826; METAL src/game.js:676-677; METAL src/game.js:843; METAL src/options.js:6

**Preuve.** Mesure appariée dans le même processus (bench/natif-verif/cfg/VA.json, 54 écarts, M5, ANGLE Metal) : Auto actuel sur Retina 14 (1665×1081, 1,80 MPix) = 5,00 / 5,58 / 4,60 / 5,42 ms par image selon la scène ; natif (3024×1964, 5,94 MPix) = 12,48 / 14,35 / 13,59 / 14,29 ms ; écart +8,44 ms [+7,62 ; +8,77], +155 %. Le budget d'un écran 120 Hz est de 8,33 ms : tenu aujourd'hui, perdu en natif. Sous charge machine, la même base à 5,94 MPix a donné 13,1 à 21,5 ms (VB) puis 18,5 à 28,8 ms (VC), GPU seul, sans logique de jeu ni composition : même 60 i/s n'est pas garanti. Sur 1080p DPR 1, le natif ne coûte que +0,55 ms [+0,44 ; +0,74] (+10,5 %). NATIF-01 propose renderScale = 1 pour tous et NATIF-03 interdit toute adaptation : sur Retina, la cadence est divisée par deux dès le premier lancement.

**Cause.** Le coût croît de 2,0 ms par mégapixel alors que les optimisations sans perte ne rendent que 0 à 5 % : passer de 30 % à 100 % des pixels ne peut pas être compensé. La politique proposée ne distingue pas les écrans où le natif est presque gratuit (1080p) de ceux où il coûte ×2,5 (Retina, 4K).

**Proposition.** Règle : jamais moins de pixels que l'Auto actuel, natif dès que la marge mesurée le permet, aucun changement pendant le jeu. FERRO : renderer.calibrate({frames:30}) exécuté hors jeu (écran de préparation), qui rend une vue de référence à deux tailles (échelle Auto actuelle et natif), synchronise par readPixels en blocs de 10 images, et renvoie {fixe, pente en ms/MPix, taux d'affichage déduit de 60 intervalles rAF}. METAL : au premier lancement et sur demande dans les options, choisir la plus grande échelle parmi 1, 0,85, 0,75, 0,66 et l'échelle Auto actuelle dont le temps prédit reste sous 0,7 × l'intervalle d'affichage (marge pour la simulation et la composition) ; plancher = échelle Auto actuelle ; valeur enregistrée dans les préférences avec une empreinte (chaîne du GPU, taille et DPR de l'écran) et recalculée seulement si l'empreinte change. Afficher « Échelle de rendu : N % (calibrée) » avec le réglage manuel de NATIF-01. Demander à David s'il préfère 120 i/s à l'échelle actuelle ou 60 i/s en natif sur ses écrans 120 Hz. Acceptation : 1080p DPR 1 → 100 % ; Retina 14 sur M5 à 120 Hz → l'échelle retenue tient 8,3 ms au 95e centile sur les 4 scènes du banc ; zéro changement de taille en 10 minutes de jeu.

**Gain attendu.** Natif partout où il coûte peu (+10,5 % en 1080p), et aucune perte de cadence là où il coûte +155 % ; résolution toujours supérieure ou égale à celle d'aujourd'hui.

**Risques.** Un calibrage fait pendant une charge passagère sous-estime la machine : prévoir le bouton « recalibrer ». Le calibrage bloque 0,5 à 1 s sur l'écran de préparation. L'échauffement thermique n'est pas vu par une mesure courte. Sans l'option, comportement de FERRO v0.2 inchangé. Sauvegardes et déterminisme non concernés ; une préférence de plus à normaliser dans FOptions.

**Vérifier par.** node gen.mjs cfg/VA.json out/VA.html && ./run.sh out/VA.html 1920,1080 1 > out/VA.json && python3 -I an.py out/VA.json auto@mbp (dans bancs/natif-verif/) ; puis le même couple Auto/natif dans le banc intégré de NATIF-13 sur chaque machine.

### NATIF-V2 — Poste oublié du modèle de coût : les matières procédurales pèsent 17,8 % de l'image en natif, et l'optimisation exacte évidente (bruits évalués à la demande) ne rapporte rien
- sévérité moyenne · catégorie perf-gpu · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité sans objet · moteur (dans METAL)
- lieux : FERRO src/renderer.js:168-358; FERRO src/renderer.js:172-173; FERRO src/renderer.js:89-99; METAL src/renderer.js

**Preuve.** Ablation flatmat (base, rugosité, métal, normale et joints fixés juste avant l'éclairage, FERRO renderer.js:359, ce qui laisse le compilateur retirer tout le calcul des matières) à 5,94 MPix, cfg/VB.json : −2,80 ms [−3,54 ; −2,26], −17,8 % (−17,3, −20,5, −18,9 et −16,9 % par scène). C'est le deuxième poste après les lumières (34 à 41 %), absent de la décomposition de NATIF-05. Essai de l'optimisation exacte la plus naturelle (variante lazymat, cfg/VC.json : grain et broad, :172-173, calculés seulement pour les matières qui les lisent) : +0,01 ms [−0,32 ; +0,38], avec 3 à 19 pixels à 1 niveau d'écart par lot, donc ni gain ni identité stricte.

**Cause.** Chaque pixel évalue plusieurs bruits de valeur (4 hachages chacun), des grilles filtrées par fwidth et un relief par dérivées avant même l'éclairage. Ce coût croît avec le nombre de pixels, comme la boucle des lumières, et aucun de ses termes n'est un zéro exact que l'on puisse sauter.

**Proposition.** (1) Ajouter l'ablation flatmat au banc de NATIF-13 et inscrire le poste dans le modèle : lumières, matières, ombres, post, reste. (2) Ne pas implémenter l'évaluation paresseuse des bruits : mesurée sans effet. (3) Ne pas chercher ici de gain sans perte : remplacer les bruits par une texture ou baisser leur fréquence changerait l'image, donc à écarter au titre de la consigne de David. (4) Conséquence pour les cibles : en natif sur GPU Apple, le plafond des gains sans perte reste d'environ 5 % (NATIF-07) ; tenir 60 i/s en 4K demande soit une option qui change l'image, soit une échelle choisie (NATIF-V1).

**Gain attendu.** Aucun gain direct. Évite un chantier sans effet et fixe le plafond réaliste des optimisations sans perte.

**Risques.** flatmat est une borne haute : elle retire aussi le relief des normales et la branche de reflet de nuages. Mesure sur GPU Apple seulement ; sur un GPU où les branches par matière sont aplaties par le compilateur, la part peut être plus forte.

**Vérifier par.** node gen.mjs cfg/VB.json out/VB.html && ./run.sh out/VB.html 1920,1080 1 > out/VB.json && python3 -I an.py out/VB.json base (ligne flatmat) ; idem cfg/VC.json (ligne lazymat), dans bancs/natif-verif/.
