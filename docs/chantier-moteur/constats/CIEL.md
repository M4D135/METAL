# Axe CIEL — CIEL — refonte du ciel (FERRO v0.2 248043a, METAL 0.8 673d6b2, regard sur BITUME et Point de rupture)

Origine : axe ajouté. Contre-vérifié.

Références de lignes : METAL 0.8.0 (commit 673d6b2). « FERRO » désigne les modules moteur de METAL.

## Résumé

Le ciel actuel est remplaçable par un ciel physique en textures amorties qui coûte moins cher par pixel (×0,37, mesuré) et supprime les bandes ; le prototype tourne et les captures sont dans bancs/../audit/ciel/ (27 PNG : 9 de l'existant, 18 du nouveau).

Écart avec la consigne : ~/Projects/ferro n'existe pas sur cette machine. J'ai travaillé sur la copie du renderer de FERRO v0.2 déjà présente, src/renderer.js (variante FERRO 0.2) (120 863 octets) ; les numéros de ligne FERRO viennent de cette copie. Le clone METAL est resté intact (git status vide), aucun serveur, aucun port, aucun paquet.

État actuel (identique dans FERRO, METAL, BITUME et Point de rupture) :
- Une passe plein écran dessinée en premier, sans test de profondeur : dégradé entre deux couleurs, nuages en bruit 2D à 4 octaves de couleur fixe, deux crêtes plates, soleil en disque uni d'environ 1,9° de rayon (7 fois le vrai).
- Tonalité et vignette dans le shader, sortie 8 bits sans tramage.
- Ni diffusion atmosphérique, ni étoiles, ni lune ; le soleil est bridé au-dessus de l'horizon, donc ni crépuscule ni nuit.
- Lumière ambiante, couleur du soleil, brouillard et reflets sont cinq réglages à la main sans lien avec le ciel.
- METAL n'a que 3 ciels pour 18 mondes (stage = index % 3) ; les 3 thèmes de BITUME sont tous un plein jour bleu ; Point de rupture a une seule atmosphère.

Prototype (page file:// autonome, 49 Ko, 100 % procédural) :
- Atmosphère Rayleigh, Mie et ozone cuite dans deux tables 192×128 en RGBA16F.
- Une couche de nuages en volume (bruit 3D Perlin-Worley 64³ généré sur le GPU, Beer-Lambert, deux lobes de Henyey-Greenstein) cuite dans un dôme paraboloïde 1024², filtrée, mise à jour par tranches.
- Disque solaire avec assombrissement au bord, lune avec phase, étoiles, voie lactée, tramage.
- 7 préréglages : aube, plein jour, crépuscule, nuit, orage, cendres, brume industrielle, chacun en tonalité du moteur et en tonalité filmique.

Mesures appariées sur Apple M5, passe plein écran, en ms au-dessus d'un remplissage uni :

| Variante | 2560×1440 | 2880×1864 (Retina natif) |
|---|---|---|
| Ciel actuel | 1,58 | 2,32 |
| Nouveau, par textures (jour) | 0,58 | 0,87 |
| Nouveau + cuisson d'1/256 du dôme par image | 0,75 | 1,03 |
| Nouveau + cuisson d'1/64 du dôme par image | 0,92 | 1,22 |
| Nouveau, de nuit (étoiles dans le shader) | 1,57 | 2,22 |
| Nouveau calculé directement par pixel | 37,2 | 53,5 |

- Le gain dépend de la surface de ciel visible : la cuisson amortie est un coût fixe d'environ 0,17 ms (1/256), rentabilisé au-delà d'environ 0,6 MPix de ciel visible. En dessous, le coût est neutre ; en intérieur la cuisson peut être suspendue.
- Les étoiles calculées dans le shader ramènent le coût de nuit au niveau actuel : il faut les dessiner en points.
- Bandes à 2560×1440 : 66 à 72 % des pixels du ciel actuel sont dans des plages verticales d'au moins 8 pixels identiques (plage maximale 75 à 160 px) ; 1,4 à 2,3 % avec le tramage (13 à 16 px).

Limites du prototype, à ne pas prendre pour acquises :
- La multidiffusion atmosphérique est approchée (la table de Hillaire reste à écrire).
- Le chemin par textures n'est pas identique au calcul direct : écart moyen de 2,0 niveaux sur 255, concentré sur les bords de nuages ; les nuages sont doux à 1024² et gardent un grain dans les couches épaisses.
- Les expositions sont réglées à la main par préréglage.
- Lumière ambiante dérivée du ciel, brouillard, reflets et ombres de nuages sont conçus mais non prototypés ; leurs coûts sont estimés.
- Les captures du nouveau ciel sont sans géométrie de jeu.

## Mesures

- **Matériel et banc** : Apple M5, Chrome sans interface, ANGLE Metal, fenêtre 1600×900 à DPR 1, cibles hors écran RGBA8 de 2560×1440 et 2880×1864 (définition native de l'écran Retina de la machine) _(méthode : bench/ciel/run2.sh (file://, --dump-dom, sans temps virtuel, aucun port) ; UNMASKED_RENDERER_WEBGL ; system_profiler pour la définition native)_
- **Protocole de coût GPU** : 40 tours après 3 tours d'échauffement ; 8 variantes par tour, ordre tourné ; 6 passes par échantillon en alternant deux cibles (1 passe pour les variantes directes, 10 échantillons) ; écart apparié à un remplissage uni _(méthode : proto-main.js mode #bench : temps mur de N passes puis readPixels 1×1 (seule synchronisation fiable sous ANGLE Metal, cf. RGPU) ; médiane et p10–p90 des écarts appariés ; fichier bench2.json)_
- **Ciel actuel de FERRO v0.2 (SKY_FRAG repris tel quel), plein écran** : 2560×1440 : +1,58 ms (p10–p90 1,42–1,72) ; 2880×1864 : +2,32 ms (2,17–2,43) ; soit 0,43 ms par MPix de ciel ombré _(méthode : variante « actuel » de bench2.json ; cohérent avec RGPU (ciel −0,4 ms à 1,8 MPix dans une image réelle où une partie du ciel est masquée))_
- **Nouveau ciel par textures, de jour (2 lectures de table, 2 lectures de dôme, reprojection du vent, disque solaire, tonalité, tramage)** : 2560×1440 : +0,58 ms (0,43–0,78), soit −0,97 ms contre l'actuel (rapport 0,37) ; 2880×1864 : +0,87 ms (0,67–1,07), soit −1,48 ms (rapport 0,37) ; 0,16 ms par MPix _(méthode : variante « textures », écart apparié image par image contre « actuel »)_
- **Nouveau ciel + cuisson amortie du dôme 1024² (marche + résolution filtrée) à chaque image** : 1/256 du dôme : +0,75 ms à 1440p et +1,03 ms à 2880×1864 (−0,77 et −1,28 ms contre l'actuel) ; 1/64 : +0,92 et +1,22 ms (−0,60 et −1,08 ms) ; surcoût fixe de la tranche ≈ 0,17 ms (1/256) ou 0,33 ms (1/64) _(méthode : variantes « texturesTranche256 » et « texturesTranche64 » ; sans la passe de résolution (bench1.json) : +0,68/+0,88 et +0,73/+0,90 ms)_
- **Nouveau ciel de nuit, étoiles, voie lactée et lune calculées dans le shader** : +1,57 ms à 1440p, +2,22 ms à 2880×1864 : égal à l'actuel (écart +0,02 et −0,08 ms) ; les étoiles coûtent donc ≈ 1,0 à 1,35 ms plein écran _(méthode : variante « texturesNuit »)_
- **Nouveau ciel calculé directement par pixel (16 pas × 8 pas de lumière ; nuages 36 pas × 5 pas de lumière)** : atmosphère seule : +27,5 ms à 1440p, +40,1 ms à 2880×1864 ; complet : +37,2 et +53,5 ms ; soit 60 à 64 fois le chemin par textures _(méthode : variantes « directAtmosphere » et « directComplet », 10 échantillons d'une passe)_
- **Coûts ponctuels de cuisson** : tables d'atmosphère 192×128 ×2 : 1,4 à 2,3 ms ; dôme 1024² complet (marche + résolution) : 7,3 à 11,4 ms ; bruit 3D 64³ : 11 à 34 ms à chaud, 164 à 284 ms quand la première exécution inclut la compilation Metal ; lecture de synchronisation à vide : 0,1 ms _(méthode : médiane de 7 exécutions synchronisées (bench1.json, bench2.json) ; bruit 3D mesuré une fois par lancement sur 6 lancements)_
- **Compilation des programmes du ciel** : 5 à 555 ms par programme selon le lancement (le premier gros programme absorbe la compilation) ; cumul observé de 0,05 à 1,1 s sur 6 lancements, machine chargée _(méthode : performance.now autour de compile + link + lecture de LINK_STATUS ; trop bruité pour un chiffre unique)_
- **Bandes de couleur à 2560×1440, moitié haute de l'image, 48 colonnes** : ciel actuel : 65,7 % (jardin), 68,5 % (lisière), 72,0 % (carrière) des pixels dans une plage verticale ≥ 8 pixels strictement identiques, plage maximale 75, 160 et 77 px ; nouveau avec tramage : 1,6 % (nuit), 2,3 % (aube), 1,4 % (plein jour), plage maximale 13 à 16 px ; nouveau sans tramage : 64 à 81 %, plage maximale 56 à 169 px _(méthode : fonction bands() de proto-main.js sur readPixels de la cible ; shots.json)_
- **Fidélité du chemin par textures** : textures contre calcul direct (plein jour, 1600×900) : écart moyen 2,0 niveaux sur 255, 13,6 % des pixels à plus de 3 niveaux, 6,5 % à plus de 10 ; dôme 512² contre 1024² : 1,40 ; dôme 2048² contre 1024² : 0,90 _(méthode : fonction diff() sur deux rendus de la même caméra ; les écarts sont sur les bords de nuages (grain de la marche, filtre du dôme))_
- **Inventaire des ciels par jeu** : METAL : 3 environnements pour 18 mondes (mondes 0, 3, 6… identiques : même soleil, mêmes couleurs) ; BITUME : 3 thèmes, tous en plein jour bleu ; Point de rupture : 1 atmosphère _(méthode : probe-world.mjs (FWorld.create dans le domaine principal de Node, index 0 à 5 et 17) ; lecture de bitume/src/decor.js:57-65 et de point-de-rupture/Jeu/src/jeu.js:17-22)_
- **Taille** : page prototype 49 112 octets, dont ≈ 12,5 Ko de GLSL unique et ≈ 8 Ko de JS de cuisson ; estimation pour FERRO complet : 25 à 28 Ko bruts _(méthode : sortie de gen-proto.mjs ; l'estimation ajoute table de multidiffusion, sonde, ombres de nuages, étoiles en points et secours Canvas 2D)_

## Scripts de banc

- bancs/ciel/gen-proto.mjs
- bancs/ciel/proto-main.js
- bancs/ciel/ciel.html
- bancs/ciel/run2.sh
- bancs/ciel/gen-existant.mjs
- bancs/ciel/existant.html
- bancs/ciel/run.sh
- bancs/ciel/extract.py
- bancs/ciel/probe-world.mjs
- bancs/ciel/bench2.json
- bancs/ciel/bench1.json
- bancs/ciel/shots.json
- bancs/ciel/existant.json
- bancs/../audit/ciel

## Décisions pour David

- **Compatibilité de FERRO : un jeu de la v0.2 sans réglage garde-t-il l'image d'aujourd'hui, ou reçoit-il le nouveau ciel ?** — recommandé : Nouveau ciel sur demande seulement (atmosphere.sky présent) ; sans ce champ, chemin actuel conservé à l'identique. C'est la règle de FERRO, et chaque jeu bascule quand ses préréglages sont prêts. ; autres choix : Nouveau ciel par défaut, déduit automatiquement de skyTop, skyBottom et sunDirection : tous les jeux changent d'image d'un coup, sans réglage, mais aucune image n'est identique à l'actuelle.
- **METAL : 18 ciels distincts (un par monde) ou garder l'identité de 3 biomes ?** — recommandé : 18 ciels : pour chaque biome, 6 paliers d'heure et de météo (table proposée dans CIEL-10), en gardant la teinte dominante du biome. ; autres choix : 3 ciels refaits (un par biome) : moins de réglage, mais la campagne reste visuellement répétitive.
- **Mondes de nuit et d'orage : accepte-t-on des extérieurs plus sombres ?** — recommandé : Non : nuit « américaine », avec un plancher d'ambiance et d'exposition tel que la lisibilité des ennemis en extérieur reste celle d'aujourd'hui. ; autres choix : Nuit réaliste, plus immersive mais plus difficile et risquée sur mobile en plein soleil.
- **Heure du jour fixe par monde, ou soleil qui se déplace pendant la partie ?** — recommandé : Fixe par monde dans METAL (seuls les nuages dérivent) : c'est compatible avec le cache d'ombres statiques étudié par l'axe DRAW. Préréglage par course dans BITUME ; accéléré possible en mode démo. ; autres choix : Cycle continu : spectaculaire, mais il invalide les ombres statiques en continu et impose de recuire les tables d'atmosphère régulièrement (1,4 à 2,3 ms chaque fois).
- **Courbe de tonalité du ciel** — recommandé : Livrer d'abord avec la courbe actuelle du moteur (couleur / (couleur + 0,76)) pour rester cohérent avec le monde ; passer en filmique en même temps que la chaîne HDR déjà proposée (PHOTO-04, NVIDIA-02). Les captures existent dans les deux tons. ; autres choix : Filmique tout de suite pour le ciel seul : plus flatteur, mais ciel et décor n'auraient plus la même réponse.
- **Paliers de qualité et mobile** — recommandé : Dôme 1024² sur ordinateur, 512² sur mobile, et en qualité basse : atmosphère par table sans nuages en volume (nuages 2D cuits une fois). Dôme 2048² en option « ultra ». ; autres choix : Un seul palier 1024² partout : plus simple, mais 16 Mo de textures RGBA16F en plus sur mobile et une cuisson plus lourde.
- **Échelle des ombres de nuages au sol dans METAL** — recommandé : Échelle « de jeu » (motif d'environ 240 m) pour que les ombres glissent visiblement sur les arènes ; échelle réelle dans BITUME et Point de rupture. ; autres choix : Échelle réelle partout : cohérente avec les nuages visibles, mais dans METAL une zone reste des minutes entières au soleil ou à l'ombre.
- **Éclairs dans les ciels d'orage** — recommandé : Désactivés par défaut, avec une option « éclairs atténués » (photosensibilité, lisibilité en combat). ; autres choix : Activés : plus d'ambiance, mais des flashs plein écran subis par le joueur.

## Constats

### CIEL-01 — Remplacer la passe de ciel par un ciel en textures amorties : coût par pixel ×0,37 et qualité en hausse
- sévérité haute · catégorie ciel · effort L · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur (dans METAL)
- lieux : ferro src/renderer.js:512-552@248043a; ferro src/renderer.js:1623-1629@248043a; ferro src/renderer.js:1741@248043a; metal src/renderer.js:452-492@673d6b2; metal src/renderer.js:1460-1465@673d6b2

**Preuve.** FERRO renderer.js:512-552 : le ciel recalcule à chaque pixel et à chaque image 4 octaves de bruit de nuages, 3 bruits de crête, un atan et 3 pow. Mesuré plein écran : 1,58 ms à 2560×1440 et 2,32 ms à 2880×1864 au-dessus d'un remplissage uni (0,43 ms par MPix). Le prototype par textures coûte 0,58 et 0,87 ms (rapport 0,37) ; avec la cuisson d'1/256 du dôme par image, 0,75 et 1,03 ms ; le même ciel calculé directement par pixel coûte 37,2 et 53,5 ms. Captures : audit/ciel/nouveau-*.png contre audit/ciel/existant-*.png.

**Cause.** Tout le contenu du ciel est de basse fréquence et presque statique, mais il est recalculé à la définition native à chaque image, ce qui interdit tout modèle plus riche.

**Proposition.** Trois étages, comme dans bench/ciel/gen-proto.mjs :
1. Tables d'atmosphère : 2 textures 192×128 RGBA16F (Rayleigh + multidiffusion + sol ; Mie sans phase), azimut relatif au soleil sur [0, π], élévation en racine pour serrer les lignes à l'horizon. Recuites seulement quand le soleil ou la météo changent.
2. Dôme de nuages : 3 textures 1024² RGBA16F (A, B, en cours) plus une de travail, projection paraboloïde uv = d.xz / (1 + d.y) / 1,1 (aucun pincement au zénith, vérifié sur nouveau-plein-jour-zenith.png). Cuisson par tranches de 4 lignes (1/256 par image), puis A←B, B←C.
3. Passe finale à la définition native : 2 lectures de table, 2 lectures de dôme mélangées par le fondu A→B, reprojection du vent (translation dans le plan de la couche), phase de Mie analytique, disque solaire, tramage.
Critère : à 2880×1864 plein écran, coût ≤ 45 % de l'actuel avec la tranche d'1/256.

**Gain attendu.** −0,77 ms à 2560×1440 et −1,28 ms à 2880×1864 quand tout l'écran est du ciel (tranche 1/256 comprise). Le gain suit la surface de ciel visible : 0,27 ms par MPix de ciel, moins ≈ 0,17 ms fixes de cuisson ; neutre vers 0,6 MPix de ciel visible.

**Risques.** Rendu en RGBA16F : dépend de EXT_color_buffer_float ou half_float (prévoir un repli RGBA8 encodé). 40 Mo de textures à 1024² (4 dômes de 8 Mo + tables), à réduire sur mobile. À recuire après une perte de contexte. Image différente de l'actuelle : à activer sur demande (voir CIEL-11).

**Vérifier par.** cd bench/ciel && node gen-proto.mjs <renderer FERRO> ciel.html && ./run2.sh 'ciel.html#bench,40,plein-jour' out bench.json : comparer « actuel », « textures » et « texturesTranche256 » aux deux définitions.

**Contre-vérification.** Lignes relues (FERRO 512-552, 1623-1629, 1741 ; METAL 452-492) : exactes. J'ai rejoué le banc dans mon dossier (3 lancements, 20 à 30 tours). Le rapport 0,37 est reproduit pour le prototype tel qu'écrit, mais la comparaison n'est pas à contenu égal et le gain réel par défaut est proche de zéro.
- Le prototype n'a ni les deux crêtes d'horizon ni la vignette de l'ancien ciel. Les crêtes pèsent 27 % de l'ancien shader (actuel sans crêtes : rapport 0,74). Nouveau ciel + crêtes procédurales : rapport 0,72 à 0,81. Nouveau ciel + crêtes teintées par la table + vignette : 0,96 à 1,09, soit aucun gain. Voir CIEL-V3.
- La qualité par défaut de METAL est « auto », plafonnée à 1,8 MPix (resize, FERRO 1539-1547). À 1792×1008 plein écran de ciel, tranche 1/256 comprise : −0,25 à −0,28 ms ; avec 30 à 50 % de ciel visible, le gain est nul. C'est donc un saut de qualité à coût neutre, pas un gain de fluidité.
- Mémoire : 4 dômes 1024² RGBA16F = 33,5 Mo (40 Mo avec les mips de CIEL-08). FERRO n'a aujourd'hui aucune cible flottante (RGBA8 seulement, lignes 1382 et 1403) : c'est le premier usage de EXT_color_buffer_float.
- Le critère d'acceptation « ≤ 45 % à 2880×1864 » est à la limite (0,446 dans son banc, 0,56 à 0,65 dans le mien sous charge) : le fixer à ≤ 60 %, crêtes comprises.
P0 parce que c'est l'architecture qui porte la demande explicite sur le ciel.

**Preuve corrigée.** 2560×1440, écart apparié au remplissage uni : actuel 2,32 à 2,40 ms ; textures 0,83 à 1,07 ms (rapport 0,36 et 0,44) ; textures + tranche 1/256 : 1,33 à 1,40 ms (rapport 0,56 à 0,60). 1792×1008 : actuel 0,72 à 0,80 ; textures 0,33 à 0,40 (rapport 0,47 à 0,50) ; tranche 1/256 : 0,52 à 0,60. Cuisson complète du dôme : 17,9 à 18,9 ms sous charge (annoncé 7,3 à 11,4).

**Gain corrigé.** Plein écran de ciel : −1,0 à −1,3 ms à 2560×1440 et −0,25 à −0,5 ms à 1,8 MPix, sans les crêtes. À contenu égal (crêtes gardées par pixel) : −0,6 ms à 1440p, −0,17 ms à 1,8 MPix. En jeu, à la qualité par défaut : neutre.

### CIEL-02 — Atmosphère physique (Rayleigh, Mie, ozone) à la place du dégradé à deux couleurs ; soleil autorisé sous l'horizon
- sévérité haute · catégorie ciel · effort M · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur (dans METAL)
- lieux : ferro src/renderer.js:536@248043a; ferro src/renderer.js:706-713@248043a; metal src/renderer.js:476@673d6b2; metal src/renderer.js:646-652@673d6b2

**Preuve.** renderer.js:536 : color = mix(uSkyBottom, uSkyTop, pow(elevation, .55)), sans aucune dépendance à la direction du soleil : pas d'auréole, pas d'horizon plus clair, pas de rougissement. renderer.js:711 : sun[1] = Math.max(.12, sun[1]) interdit un soleil à moins de 7° environ, donc ni crépuscule ni nuit. Captures existant-monde*-soleil.png : ciel uniforme, soleil blanc quelle que soit l'heure. Prototype : aube à 4,2°, crépuscule à 0,9° et nuit à −32° rendus par le même shader (nouveau-aube.png, nouveau-crepuscule.png, nouveau-nuit.png).

**Cause.** Le ciel est décrit par des couleurs choisies à la main (skyTop, skyBottom, fog) et non par une cause physique (position du soleil, quantité d'aérosols).

**Proposition.** Modèle de Hillaire 2020 en passes de fragments :
- Constantes en km : rayon 6360, atmosphère 100 ; Rayleigh (5,802 ; 13,558 ; 33,1)e-3 /km, hauteur d'échelle 8 ; Mie 3,996e-3 × turbidité, extinction ×1,11, hauteur 1,2, g 0,8 (phase de Cornette-Shanks) ; ozone (0,650 ; 1,881 ; 0,085)e-3 /km en tente centrée à 25 km.
- Tables : transmittance 256×64, multidiffusion 32×32, vue du ciel 192×128. Le prototype remplace la table de multidiffusion par une approximation isotrope (0,030 × racine de la transmittance prise 9 km plus haut), à ne pas reprendre telle quelle.
- Paramètres de météo : turbidité, teinte et absorption des aérosols (cendres : teinte (1 ; 0,70 ; 0,40), absorption (0,004 ; 0,013 ; 0,034) /km), albédo du sol.
- Lever la borne de la ligne 711 quand atmosphere.sky est présent ; la nuit, la source de l'atmosphère devient la lune.
Critère : captures à −2°, 5°, 30° et 80° sans NaN ni rupture à l'horizon.

**Gain attendu.** Ciels crédibles à toute heure et par tout temps avec 5 paramètres au lieu de 3 couleurs ; coût par image inclus dans CIEL-01 ; cuisson des tables 1,4 à 2,3 ms à chaque changement de soleil.

**Risques.** Avec la courbe de tonalité actuelle (par canal, blanc à 0,76), le ciel de jour est moins saturé qu'en filmique : voir les paires de captures. Le soleil sous l'horizon doit rester impossible sur le chemin hérité pour ne pas changer les jeux actuels. L'exposition est manuelle dans le prototype ; l'automatique dépend de CIEL-06.

**Vérifier par.** ./run2.sh 'ciel.html#shots,aube,plein-jour,crepuscule,nuit' <dossier> : comparer aux captures de référence ; relire les tables en RGBA/FLOAT et vérifier l'absence de NaN.

**Contre-vérification.** Lignes exactes : dégradé sans dépendance au soleil (FERRO 536, METAL 476), borne sun[1] ≥ 0,12 (FERRO 711, METAL 651 et non 646-652). Cuisson des tables rejouée : 1,7 à 2,2 ms (annoncé 1,4 à 2,3). Deux réserves que le constat ne traite pas.
- Lever la borne de la ligne 711 abaisse aussi la direction d'éclairage et d'ombre : sunShadowPass (FERRO 1596-1617) et le terme solaire (383-386) lisent environment.sunDirection. À 1-6° d'élévation, un mur de 4 m porte une ombre de 38 à 230 m : les arènes murées de METAL n'ont plus de soleil direct, et le biais d'ombre (ligne 142) est rasant. Le test checks/world.test.mjs:93 exige d'ailleurs sunDirection[1] > 0,3. Il faut séparer l'astre visible de la direction d'éclairage (voir CIEL-V2).
- Les captures du prototype sont sans la passe de bloom du moteur : les ciels clairs dépassent largement le seuil [0,56 ; 0,86] (voir CIEL-V1).
La multidiffusion approchée est bien signalée comme limite. « Gain mesuré » : seule la cuisson est mesurée, le reste est qualitatif.

### CIEL-03 — Nuages en volume éclairés, cuits dans le dôme, à la place du bruit 2D blanc
- sévérité haute · catégorie ciel · effort L · gain mesuré
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · moteur (dans METAL)
- lieux : ferro src/renderer.js:526-531@248043a; ferro src/renderer.js:539-542@248043a; metal src/renderer.js:479-482@673d6b2

**Preuve.** renderer.js:539-542 : nuages = seuil sur un bruit 2D, couleur fixe mix(uSkyBottom, vec3(1.12, 1.10, 1.01), .62), donc blancs même dans le ciel de cendres ou de nuit (existant-monde1-quarry-arene.png, existant-cielseul-garden-2560.png) ; aucun ombrage ni épaisseur ; animation réduite à une translation sur un axe (uSkyMotion.x * .006). Prototype : cuisson complète du dôme 1024² en 7,3 à 11,4 ms, soit ≈ 0,17 ms par image à 1/256.

**Cause.** Un plan de bruit 2D ne porte ni volume, ni lumière, ni évolution ; le faire en volume par pixel coûterait 37 à 54 ms par image.

**Proposition.** - Bruit 3D périodique 64³ RGBA8 avec mips, généré par 64 tranches sur le GPU au chargement (R : Perlin-Worley ; G, B : Worley fins ; A : Perlin).
- Densité : seuil de couverture modulé par une carte météo de basse fréquence, érosion par la hauteur (base plate, sommets arrondis), érosion de détail ; paramètre type de 0 (cumulus) à 1 (stratus).
- Marche de 36 pas dans la couche, portée bornée à 28 km, 5 pas de lumière croissants ; Beer-Lambert ; phase à deux lobes (g 0,78 et −0,22) plus un lobe de bord lumineux (g 0,96) ; multidiffusion approchée à deux exponentielles ; ambiance prise dans la table du ciel ; perspective aérienne vers la couleur du ciel de même direction.
- Décalage aléatoire par texel, puis résolution par un filtre en tente (4 lectures bilinéaires). Un décalage ordonné produit un tressage visible : essayé et écarté.
- Fondu entre deux cuissons et reprojection par le vent pour un mouvement continu.
- Qualité basse : une cuisson unique au chargement, sans mise à jour.

**Gain attendu.** Nuages avec volume, ombre propre, bords éclairés, teinte de l'heure et du temps, dérive et évolution lentes ; coût fixe ≈ 0,17 ms par image (1/256), nul si la cuisson est suspendue.

**Risques.** Chemin par textures non identique au calcul direct : écart moyen de 2,0 niveaux sur 255, sur les bords ; nuages doux à 1024² (512² contre 1024² : 1,40 ; 2048² contre 1024² : 0,90). Grain résiduel dans les couches épaisses (nouveau-orage.png) : prévoir une accumulation entre cuissons. Les tranches en cours ne doivent jamais être affichées (cuire dans C, puis permuter).

**Vérifier par.** ./run2.sh 'ciel.html#shots' <dossier> shots.json : lire texturesContreDirect et dome512Contre1024 ; inspection de nouveau-orage.png et de nouveau-plein-jour-zenith.png ; coût par « cuissonDome1024Ms » du mode #bench.

**Contre-vérification.** Lignes exactes (FERRO 526-531, 539-542 ; METAL 479-482). Coûts rejoués : dôme complet 17,9 à 18,9 ms sous charge ; surcoût de la tranche 1/256 : 0,12 à 0,27 ms à 1,8 MPix, plus bruité à 1440p. Ce surcoût est 3 à 4 fois la part proportionnelle (11,4 / 256 = 0,045 ms) : c'est le prix fixe de deux passes sur des cibles 1024² RGBA16F, chargées et stockées en entier sur un GPU à tuiles.
Réserves de qualité, vues sur nouveau-plein-jour.png (recadrage bancs/ciel-verif/crop-horizon3.png) :
- stries radiales visibles dans les nuages proches de l'horizon ;
- bords flous : le dôme paraboloïde 1024² donne 4 texels par degré au zénith et 8 à l'horizon, contre 16 à 21 pixels par degré à l'écran (1440p à 2880×1864, champ de 75°). Ce n'est pas une régression (les nuages actuels n'ont aucun détail sous 2,7°), mais David demande « sans perdre en résolution » : voir CIEL-V4.
Ajouter au critère d'acceptation une capture à la définition native avec la géométrie du jeu et le bloom.

**Gain corrigé.** Coût fixe de cuisson : 0,17 ms dans son banc, 0,12 à 0,27 ms dans le mien à 1,8 MPix. Cuire une tranche 4 fois plus haute toutes les 4 images diviserait le coût moyen par deux environ, au prix d'un temps d'image moins régulier.

### CIEL-04 — Soleil, lune et étoiles : disque sept fois trop grand et uni, nuit sans astres ; étoiles à dessiner en points
- sévérité moyenne · catégorie ciel · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur (dans METAL)
- lieux : ferro src/renderer.js:537-538@248043a; metal src/renderer.js:477-478@673d6b2; metal src/world.js:648@673d6b2

**Preuve.** renderer.js:538 : smoothstep(.99925, .99965, sun) * 2.8 donne un disque uni de 1,5 à 2,2° de rayon (le soleil réel fait 0,27°), de couleur fixe uSunColor, sans assombrissement au bord ni rougissement. Le thème jardin est une nuit bleue éclairée par un « soleil » bleu (.36, .48, .74), sans étoiles ni lune (world.js:648, existant-monde2-garden-soleil.png). Prototype : étoiles, voie lactée et lune calculées dans le shader coûtent 1,0 ms à 1440p et 1,35 ms à 2880×1864, ce qui annule le gain de CIEL-01 la nuit.

**Cause.** Un seul astre codé par deux puissances et un seuil ; aucune notion de nuit dans l'environnement.

**Proposition.** - Soleil : rayon angulaire réglable (0,0125 rad dans le prototype, à valider), assombrissement 1 − u·(1 − √(1 − r²)) avec u = (0,50 ; 0,62 ; 0,78), bord anticrénelé à la taille du pixel, couleur = transmittance de l'atmosphère vers le soleil (rouge à l'horizon), masqué par les nuages et sous l'horizon.
- Lune : disque avec normale reconstruite, phase donnée par la direction du vrai soleil, mers par le bruit 3D.
- Étoiles : environ 3 000 points instanciés générés une fois par graine (magnitudes en loi de puissance, deux teintes), mélange additif après le ciel, atténués par la masse d'air et par la transmittance des nuages lue dans le shader de sommets.
- Voie lactée : bande cuite dans la table du ciel de nuit.
Critère : ciel de nuit au coût du ciel de jour à ±0,1 ms.

**Gain attendu.** Nuit crédible ; coût de nuit ramené de 1,57 à environ 0,6 ms à 1440p plein écran (étoiles en points : estimation, non mesurée).

**Risques.** Les points doivent garder une taille minimale d'un pixel pour ne pas scintiller en mouvement. Le secours Canvas 2D dessine au plus quelques dizaines d'étoiles.

**Vérifier par.** Ajouter au banc une variante « étoiles en points » et comparer à « texturesNuit » ; capture de nuit à 2880×1864 : comptage et netteté des étoiles.

**Contre-vérification.** Disque vérifié : acos(0,99925) = 2,22° et acos(0,99965) = 1,52°, contre 0,27° pour le vrai soleil (FERRO 538, METAL 478). Jardin : « soleil » bleu (.36, .48, .74) confirmé (METAL world.js:648).
L'estimation « étoiles en points » n'était pas mesurée : je l'ai mesurée (3 000 points additifs de 2 à 4 px après la passe de ciel, branche étoiles du shader coupée). Le coût des points est sous le bruit (≤ 0,05 ms) et la nuit revient au coût du jour.
Réserves : les points s'additionnent après tonalité et gamma (acceptable, à régler à l'œil) ; si le ciel passe après l'opaque (CIEL-12), les points doivent aussi être à z = w avec LEQUAL ; la branche lune reste dans le shader (coût limité à son voisinage).

**Preuve corrigée.** 2560×1440 : nuit avec étoiles dans le shader 2,37 à 2,47 ms ; nuit sans étoiles 0,68 à 1,10 ; nuit sans étoiles + 3 000 points 0,72 à 0,80 (rapport 0,31 à 0,33 du ciel actuel). 1792×1008 : 0,87 à 0,90 contre 0,30 à 0,43.

**Gain corrigé.** Mesuré : la nuit passe de 0,99-1,07 fois le coût actuel à 0,31-0,54 fois, soit −1,4 ms à 1440p et −0,4 à −0,5 ms à 1,8 MPix plein écran.

### CIEL-05 — Bandes de couleur : aucune trame nulle part ; un tramage en bruit blanc les supprime
- sévérité moyenne · catégorie 3d-visuel · effort S · gain mesuré
- contre-vérification : **confirmé**, priorité P1 · qualité meilleure · moteur (dans METAL)
- lieux : ferro src/renderer.js:549-551@248043a; ferro src/renderer.js:428-432@248043a; metal src/renderer.js:489-491@673d6b2

**Preuve.** Aucune occurrence de tramage dans les deux renderers. À 2560×1440, 66 à 72 % des pixels du ciel actuel sont dans des plages verticales d'au moins 8 pixels identiques, jusqu'à 160 px de haut (lisière). Le nouveau ciel sans tramage fait pareil (64 à 81 %) : c'est la sortie 8 bits qui crée les bandes, pas le modèle. Avec un bruit triangulaire de ±1 niveau : 1,4 à 2,3 %, plage maximale 13 à 16 px.

**Cause.** Dégradés lents quantifiés sur 8 bits après tonalité et gamma, sans bruit de décorrélation.

**Proposition.** Après le gamma, ajouter (hash(p) + hash(p + (113,5 ; 37,25)) − 1) / 255, p = gl_FragCoord.xy. Applicable tout de suite au ciel actuel (une ligne dans SKY_FRAG), puis à la passe finale du monde (les aplats de brouillard ont le même défaut). Prendre un bruit blanc ou bleu, pas un motif ordonné : le bruit à gradient entrelacé a produit un moiré visible dès que l'image est redimensionnée, cas du canvas en qualité auto. Option settings({dither:true}), désactivée par défaut sur le chemin hérité.

**Gain attendu.** Part des pixels en plages de 8 identiques ou plus divisée par 30 à 50 ; coût de deux hachages par pixel, compris dans les mesures de CIEL-01.

**Risques.** Change chaque pixel d'au plus un niveau : les tests de capture au pixel près doivent désactiver l'option. Compression vidéo un peu moins efficace en diffusion.

**Vérifier par.** Mode #shots : lire bandesActuel-* et bandesNouveau-*-trame dans shots.json ; critère : part ≤ 3 % et plage maximale ≤ 20 px à 2560×1440.

**Contre-vérification.** Aucun tramage dans les deux renderers : confirmé (grep, seules des fonctions de grain de matière). Le bruit triangulaire ±1 niveau est correct. J'ai refait la mesure de bandes sur ses PNG, avec mon propre décodeur : l'ordre de grandeur tient, la valeur dépend du cadrage.
Correction importante de l'emplacement : avec le bloom actif, l'image passe par la composition finale (POST_FRAG, ligne 577 : scène + bloom × 0,28), qui requantifie sur 8 bits. Là où le bloom n'est pas nul (cas des nouveaux ciels clairs, voir CIEL-V1), un tramage posé dans la passe de ciel est en partie défait. Le tramage doit être appliqué à la dernière écriture 8 bits : dans la composition quand le bloom est actif, dans les shaders de ciel et de monde sinon. C'est aussi ce qui traite les aplats de brouillard du monde.
Petit effort, effet visible direct sur le reproche « old school ».

**Preuve corrigée.** Ciel actuel, captures existant-cielseul-*-2560.png, moitié haute, 48 colonnes : 40 % (lisière), 53 % (jardin), 55 % (carrière) des pixels dans des plages verticales ≥ 8 identiques, plage maximale 59 à 123 px (annoncé 66 à 72 % et 75 à 160 px avec une autre caméra). Nouveau ciel tramé (1600×900) : 0,9 à 1,2 %, plage maximale 13 à 16 px.

### CIEL-06 — Lumière du soleil et lumière ambiante réglées à la main, sans lien avec le ciel : les dériver du ciel
- sévérité haute · catégorie ciel · effort M · gain estimé
- contre-vérification : **plausible**, priorité P1 · qualité meilleure · moteur (dans METAL)
- lieux : ferro src/renderer.js:367-368@248043a; ferro src/renderer.js:383-386@248043a; ferro src/renderer.js:1743-1745@248043a; metal src/world.js:645-649@673d6b2

**Preuve.** Chaque environnement porte cinq triplets indépendants (skyTop, skyBottom, fog, sunColor, ambient) : world.js:646-648 ; environmentInfo se contente de les borner (renderer.js:706-713). Lisière : soleil à 52° de couleur (.48, .62, .59), ambiance (.18, .23, .20), soit 37 % du soleil, sous un ciel sombre (.055, .105, .14) ; le disque, lui, sort presque blanc (uSunColor × 3,65). L'ambiance extérieure est uAmbient × (.72 + .28·n.y) (renderer.js:367-368), sans direction ni couleur de ciel.

**Cause.** L'éclairage et le ciel sont deux jeux de constantes ; rien ne garantit qu'un ciel de crépuscule éclaire en orange.

**Proposition.** Quand atmosphere.sky est présent :
- Couleur du soleil = éclairement × transmittance vers le soleil, calculée en JS (8 pas, fonction transmitJS du prototype), × transmittance des nuages au-dessus de la caméra.
- Ambiance = harmoniques sphériques d'ordre 2 (9 coefficients) du ciel final sans le disque : sonde 16×8 RGBA16F rendue à la fin de chaque cuisson, relue sans blocage (tampon PIXEL_PACK + fenceSync, getBufferSubData une ou deux images plus tard), projetée en JS, envoyée en uniform vec3[9]. Dans le shader, light = SH(n) remplace uAmbient × (.72 + .28·n.y).
- La luminance moyenne de la même sonde sert l'exposition automatique.
- Exposer renderer.sky = {sunColor, ambient, exposure} en lecture pour le jeu (HUD, audio).

**Gain attendu.** Décor, ciel et reflets changent ensemble avec l'heure et la météo ; plus de réglage croisé par monde. Coût : 9 uniformes et un produit scalaire de plus par fragment extérieur (estimé < 0,05 ms par MPix), une sonde de 128 texels par cycle de cuisson.

**Risques.** Les ambiances actuelles sont volontairement claires pour la lisibilité : prévoir un plancher (voir la décision sur la nuit). Lecture différée : une ou deux images de latence, sans effet visible. Non prototypé.

**Vérifier par.** Test en contexte WebGL simulé : pour un ciel uniforme, les 9 coefficients valent la constante attendue ; capture d'une sphère blanche sous les 6 préréglages : le côté soleil est le plus clair et sa teinte suit le disque.

**Contre-vérification.** Lignes exactes (367-368, 383-386, 1743-1745 ; world.js:646-648). Ratios vérifiés : ambiance de la lisière = 37 % du soleil ; disque = uSunColor × 3,65. Non prototypé, coût estimé non mesuré.
Simplification : la recommandation même du rapport est une heure fixe par monde. La sonde peut alors être lue une seule fois à setWorld (readPixels synchrone de 16×8 texels, ou calcul en JS avec le portage de l'atmosphère) : le tampon PIXEL_PACK, fenceSync et la relecture différée sont inutiles tant qu'il n'y a pas de cycle jour-nuit.
Risques à ajouter :
- l'ambiance actuelle garde 72 % vers le bas (.72 + .28·n.y) ; des harmoniques du seul ciel noircissent les faces tournées vers le sol. Il faut un terme de rebond du sol (albédo × éclairement) dans la sonde.
- le shader du monde n'a pas d'exposition : couleur du soleil et ambiance dérivées doivent être multipliées par l'exposition en JS, sinon l'équilibre avec les lampes d'intérieur change.
- plancher d'ambiance pour la lisibilité des ennemis (décision sur la nuit).

### CIEL-07 — Brouillard d'une seule couleur, différente de l'horizon : le tirer de la table du ciel (perspective aérienne)
- sévérité moyenne · catégorie ciel · effort M · gain estimé
- contre-vérification : **plausible**, priorité P1 · qualité meilleure · moteur (dans METAL)
- lieux : ferro src/renderer.js:424-427@248043a; ferro src/renderer.js:544-548@248043a; ferro src/renderer.js:496-497@248043a

**Preuve.** renderer.js:424-427 : le décor lointain fond vers uFogColor, constant quelle que soit la direction, plafonné à .86. L'horizon du ciel a d'autres couleurs : mix(uSkyFog, uSkyBottom, .43) et uSkyFog × .80 pour les crêtes (renderer.js:546-548). Lisière : brouillard (.15, .205, .18) contre bas du ciel (.20, .25, .22), 25 % plus sombre, d'où des silhouettes découpées (existant-monde0-woodland-arene.png). BITUME voit jusqu'à 1 900 m avec ce seul brouillard exponentiel.

**Cause.** Brouillard et ciel sont deux modèles distincts ; la couleur du brouillard ne sait rien du soleil.

**Proposition.** Pour les fragments extérieurs : couleur du brouillard = table du ciel lue dans la direction de vue ramenée à l'horizon (élévation bornée à ±2°), plus le terme de Mie × phase vers le soleil ; densité inchangée (uEnvironment.y), ou brume de hauteur analytique en option (BITUME-19). Le décor lointain rejoint ainsi exactement la couleur du ciel derrière lui, et le contre-jour s'éclaircit vers le soleil. Les crêtes deviennent une couche facultative colorée par la même lecture. Même traitement dans le shader des particules (ligne 496).

**Gain attendu.** Horizon continu entre décor et ciel, profondeur lisible sur les longues vues ; 2 lectures d'une texture 192×128 par fragment extérieur (estimé ≤ 0,1 ms par MPix, non mesuré).

**Risques.** À faire derrière atmosphere.sky pour ne pas changer les images actuelles. Recoupe BITUME-19 et PHOTO-06 : une seule mise en œuvre.

**Vérifier par.** Capture d'un mur gris placé à 60, 120 et 180 m devant l'horizon : écart de couleur avec le ciel adjacent ≤ 3 niveaux à 180 m ; variante appariée dans bench/rgpu pour le coût.

**Contre-vérification.** Lignes exactes (424-427, 544-548, 496-497). Écart lisière : brouillard 18 à 25 % plus sombre que le bas du ciel selon le canal (annoncé 25 %). Les deux vignettes différentes (0,76 pour le ciel, 0,59 pour le monde) ajoutent à la rupture.
Le coût estimé (≤ 0,1 ms par MPix pour 2 lectures) est optimiste : dans mon banc, une seule lecture de table supplémentaire avec son skyUV (asin, acos, deux normalisations) et un pow coûte 0,07 à 0,15 ms par MPix. Pour le brouillard, seule la couronne d'horizon est utile : une texture 64×1 indexée par le cosinus de l'azimut relatif au soleil (dot des directions horizontales, sans acos), une seule lecture, ou une évaluation par sommet.
Prioritaire pour BITUME (vues de 1 900 m) ; secondaire dans les arènes de METAL.

**Gain corrigé.** Coût à prévoir : 0,15 à 0,3 ms par MPix de fragments extérieurs avec deux lectures par skyUV ; environ 0,05 ms par MPix avec une couronne 64×1 sans trigonométrie (estimé).

### CIEL-08 — Reflets : le décor reflète un autre ciel que celui qu'on voit
- sévérité moyenne · catégorie 3d-visuel · effort M · gain qualitatif
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · moteur (dans METAL)
- lieux : ferro src/renderer.js:401-419@248043a; metal src/renderer.js:341-355@673d6b2

**Preuve.** renderer.js:404 : le reflet utilise smoothstep(0, 1, reflected.y) alors que le ciel utilise pow(elevation, .55) (ligne 536) : deux dégradés différents. Les nuages du reflet sont un seul octave de bruit (lignes 405-412) contre quatre dans le ciel, donc d'autres formes. BITUME n'a même pas ce terme (bitume renderer.js:385-386 @e3bcb6b) : carrosseries et chaussée mouillée reflètent un dégradé nu.

**Cause.** Faute de carte d'environnement, le reflet réévalue une version simplifiée du ciel dans le shader du monde.

**Proposition.** Réutiliser les textures de CIEL-01 comme environnement : pour un fragment extérieur, reflet = table du ciel (direction réfléchie) × transmittance du dôme + lumière du dôme, avec un niveau de mip choisi par la rugosité. Les mips du dôme sont produits par generateMipmap à chaque fin de cuisson (filtre en boîte, suffisant pour un ciel doux ; pas de préfiltrage GGX à 64 échantillons). Le lobe du soleil reste analytique. Les lignes 405-414 (bruit, seuil, pow) disparaissent pour ces fragments. Intérieur : terme « inside » inchangé.

**Gain attendu.** Reflets cohérents avec le ciel visible (nuages, heure, soleil) sur métal, carrosserie et sol mouillé ; 3 lectures de texture à la place d'un bruit et de 3 pow pour les fragments métalliques extérieurs (coût estimé neutre, non mesuré).

**Risques.** Image changée pour les matières métalliques extérieures : derrière atmosphere.sky. Sous l'horizon, le dôme n'a pas de contenu : garder le mélange vers uAmbient × .20 de la ligne 415.

**Vérifier par.** Capture d'une sphère chromée et d'une sphère rugueuse sous « plein jour » et « crépuscule » : le reflet montre les mêmes nuages que le ciel ; variante appariée dans bench/rgpu.

**Contre-vérification.** Lignes exactes (401-419 : smoothstep contre pow(.55), un octave contre quatre). Référence BITUME à corriger : le renderer est ~/Projects/bitume/src/moteur/renderer.js, lignes 389-390 au commit courant 762f78f (et non src/renderer.js:385-386 @e3bcb6b) ; l'absence du terme de nuages y est confirmée.
Réserves : generateMipmap sur un dôme RGBA16F à chaque fin de cuisson ajoute un coût périodique non mesuré et 33 % de mémoire ; les mips d'un paraboloïde mélangent des texels sous l'horizon, à remplir avec la couleur du sol. Dépend de CIEL-01 et du format retenu dans CIEL-V4.

### CIEL-09 — Ombres de nuages qui glissent sur le sol
- sévérité basse · catégorie ciel · effort M · gain estimé
- contre-vérification : **plausible**, priorité P3 · qualité meilleure · moteur (dans METAL)
- lieux : ferro src/renderer.js:383-386@248043a; ~/Projects/point-de-rupture/Jeu/src/jeu.js:233; ~/Projects/bitume/src/jeu.js:584

**Preuve.** renderer.js:383-386 : l'éclairement solaire extérieur ne dépend que de la carte d'ombre du décor ; aucune modulation par les nuages. Dans Point de rupture (vue de haut, ciel hors champ, jeu.js:233 avec sunOnly) et sur les lignes droites de BITUME, c'est le seul moyen de faire exister la météo dans l'image.

**Cause.** Le ciel n'a aucune représentation réutilisable par le shader du monde.

**Proposition.** Carte d'ombre de nuages 256² en R8, périodique, cuite avec la même fonction de densité : transmittance = exp(−extinction × épaisseur optique verticale de la couche). Dans le shader du monde, pour les fragments extérieurs : ombre = texture(uCloudShadow, (vWorld.xz + sun.xz / sun.y × (base − vWorld.y) + vent × t) / pas), multipliée au terme solaire diffus et spéculaire, avec un plancher de 0,35. Le pas est réglable par jeu (voir décision : environ 240 m pour METAL, échelle réelle ailleurs). La couverture moyenne module aussi la couleur du soleil de CIEL-06.

**Gain attendu.** Météo visible au sol, surtout dans Point de rupture et BITUME ; une lecture de texture par fragment extérieur (estimé ≤ 0,05 ms par MPix, non mesuré).

**Risques.** À l'échelle « de jeu », l'ombre au sol ne correspond pas exactement au nuage visible. Aucun effet sur la simulation (rendu seul).

**Vérifier par.** Capture vue de dessus d'un sol uni à deux instants : taches d'ombre translatées de vent × Δt ; coût par variante appariée.

**Contre-vérification.** Lignes exactes (383-386 ; Point de rupture jeu.js:233 avec sunOnly:true ; BITUME jeu.js:584). Rien de mesuré. Utile surtout à Point de rupture et à BITUME (P2 pour eux) ; dans les arènes de METAL, l'effet est marginal et l'échelle « de jeu » rompt le lien avec les nuages visibles. Rendu seul : aucun effet sur la simulation ni les sauvegardes.

### CIEL-10 — METAL : 18 mondes mais 3 ciels ; donner un ciel distinct à chaque monde sans toucher à la génération
- sévérité haute · catégorie ciel · effort M · gain qualitatif
- contre-vérification : **confirmé**, priorité P0 · qualité meilleure · jeu
- lieux : metal src/world.js:38@673d6b2; metal src/world.js:645-652@673d6b2; metal src/game.js:143@673d6b2; metal src/game.js:154@673d6b2; metal src/game.js:698@673d6b2

**Preuve.** world.js:38 : stage = campaign ? index % 3 : … ; world.js:645-650 : trois environnements indexés par stage. Vérifié par probe-world.mjs : les mondes 0 et 3 ont le même soleil (−.488, .793, .366) et les mêmes couleurs, de même 1 et 4, 2 et 5, 17. L'environnement ne sert qu'au rendu et au son (game.js:143, 154, 698, 703), pas à la simulation.

**Cause.** La campagne a été étendue à 18 mondes en réutilisant les 3 thèmes d'origine.

**Proposition.** Table de 18 préréglages dans METAL (nouveau src/skies.js, ou dans game.js), passée au rendu par renderer.setWorld(meshes, lights, {...world.environment, sky: SKIES[index]}) aux lignes 143 et 154 ; world.js n'est pas modifié. Proposition, 6 paliers par biome :
- Lisière : aube brumeuse (soleil 6°), matin clair (28°, cumulus 0,3), midi voilé (55°, couche haute 0,5), averse (couverture 0,9), crépuscule doré (3°), nuit de lune.
- Carrière : fin d'après-midi poussiéreuse (22°, turbidité 6), tempête de cendres, midi blanc sans nuage (70°), crépuscule rouge (1°, aérosols absorbants), nuit de braises (lueur orangée à l'horizon), orage sec.
- Jardins : nuit claire étoilée, aube rose (2°, nuages hauts), brume industrielle, nuit d'orage, heure bleue (−6°), ciel du monde final à définir.
Le vent du ciel reprend environment.wind, déjà utilisé par le son.

**Gain attendu.** 18 ambiances reconnaissables au lieu de 3, sans coût par image supplémentaire.

**Risques.** Placer la table hors de world.js évite de changer l'objet monde, donc les sauvegardes, la simulation et les tests de génération. Lisibilité des mondes sombres : voir la décision sur la nuit. Le budget de taille n'est pas menacé (table ≈ 2 Ko).

**Vérifier par.** npm test inchangé (monde identique octet pour octet) ; planche de 18 captures prises à l'arène de chaque monde ; test : deux mondes d'index différents ont des préréglages différents.

**Contre-vérification.** Sonde rejouée (probe-world.mjs, domaine principal de Node) : mondes 0 et 3, 1 et 4, 2, 5 et 17 ont le même soleil, les mêmes couleurs et le même titre. world.js:38 et 645-650 exacts. simulation.js ne lit jamais environment (grep) : simulation et sauvegardes sont hors de cause, comme annoncé.
Corrections :
- l'objet monde n'a pas de champ d'index (world.js:652 : seed, stage, generation…) : game.js doit fournir l'index de campagne ; la ligne 154 n'est que la branche de secours, updateWorld garde l'environnement.
- les paliers à soleil très bas (1°, 2°, 3°, −6°) contredisent environment.sunDirection, qui reste la direction des ombres (élévations actuelles : 52°, 37° et 27°). Soit le disque et les ombres divergent, soit les arènes perdent leur soleil direct (voir CIEL-V2).
- la météo de particules (pollen, ash, motes, world.js:646-648) et le vent sonore restent ceux du biome : un palier « averse » ou « nuit d'orage » sans pluie ni son est incohérent. Limiter les paliers à ce que le biome sait montrer, ou ajouter la météo correspondante.
Ordre conseillé : d'abord les 3 ciels de biome refaits (P0, c'est ce que David verra), puis les 18 variantes (P1).

### CIEL-11 — API de ciel de FERRO : préréglage dans l'atmosphère, chemin actuel conservé, secours Canvas 2D et paliers mobiles
- sévérité haute · catégorie architecture · effort M · gain estimé
- contre-vérification : **confirmé**, priorité P0 · qualité identique · moteur (dans METAL)
- lieux : ferro src/renderer.js:1339-1343@248043a; ferro src/renderer.js:706-713@248043a; ferro src/renderer.js:866-901@248043a; ~/Projects/bitume/src/decor.js:57; ~/Projects/point-de-rupture/Jeu/src/jeu.js:17

**Preuve.** FERRO v0.2 a déjà les deux points d'entrée utiles : settings(options) lu par create(canvas, options) (renderer.js:1339-1343) et setWorld(meshes, points, atmosphere) normalisé par environmentInfo (706-713). Le secours logiciel a son propre ciel (softwareSky, 866-901) : dégradé à 3 arrêts, disque, 20 ellipses. BITUME et Point de rupture passent un objet de même forme (decor.js:57-65, jeu.js:17-22).

**Cause.** Le ciel n'a pas d'interface propre : il lit des champs épars de l'atmosphère.

**Proposition.** - Par monde : atmosphere.sky = {sun:{elevation, azimuth}, moon:{elevation, azimuth}, turbidity, aerosol:{tint, absorb, g}, ozone, groundAlbedo, clouds:{cover, type, base, thickness, density, scale, erosion, tint}, wind:{direction, speed}, stars, exposure:'auto'|nombre, seed, shadows:{scale}}. Absent : chemin actuel, image identique au pixel près.
- Par renderer : create(canvas, {sky:{dome:1024|512|0, slices:256, tone:'moteur'|'filmique', dither}}).
- FRender.skyPresets : aube, jour, crepuscule, nuit, orage, cendres, brume (valeurs de proto-main.js).
- Lecture : renderer.sky = {sunColor, ambient, exposure} ; stats.skyBakeMs.
- Secours Canvas 2D : mêmes préréglages, dégradé à 5 arrêts calculé par le portage JS de l'atmosphère, disque teinté par la transmittance.
- Sans rendu flottant : textures RGBA8 encodées ; qualité basse : dôme cuit une fois.
- Tests : contexte WebGL simulé (bench/rcpu/harness.mjs) vérifiant que sans sky la suite d'appels GL est inchangée, et qu'avec sky le nombre de passes par image est borné ; captures de référence des 7 préréglages.

**Gain attendu.** Les trois jeux pilotent le ciel par données ; aucun jeu de la v0.2 ne change sans le demander. Code ajouté : 25 à 28 Ko bruts (2 % du budget de METAL).

**Risques.** Deux chemins de ciel à maintenir tant que les jeux n'ont pas migré. Les tests qui comparent des chaînes de shader restent verts tant que SKY_FRAG n'est pas touché.

**Vérifier par.** Test de non-régression : même séquence d'appels WebGL et mêmes octets de shader qu'en 248043a quand atmosphere.sky est absent ; capture identique sur existant.html.

**Contre-vérification.** Faits de code confirmés : settings (1339-1343) lu par create (1355) ; environmentInfo (706-713) recopie les champs inconnus par {...value}, donc atmosphere.sky traverse sans modification ; softwareSky (866-901) a un dégradé à 3 arrêts, un disque, 20 ellipses et aussi deux couches de crêtes, oubliées dans le constat. BITUME decor.js:57-65 et Point de rupture jeu.js:17-22 confirmés.
Réserves :
- ~/Projects/ferro est absent : l'affirmation sur les tests de FERRO (comparaison de chaînes de shader) n'a pas pu être vérifiée.
- « image identique » ne vaut que si le chemin hérité reste tel quel. Or il mérite la borne exacte de CIEL-V3 (octets de shader différents, pixels identiques) : le test de non-régression doit comparer des pixels, pas les octets du shader.
- settings est figé à la création : un seuil de bloom par monde n'est pas réglable aujourd'hui (voir CIEL-V1).
- l'API doit distinguer l'astre visible de la direction d'éclairage (CIEL-V2) et prévoir une couche d'horizon (CIEL-V3).
P0 en tant que prérequis de tout le reste. Taille de 25 à 28 Ko : plausible (12,5 Ko de GLSL et 8 Ko de JS dans le prototype).

### CIEL-12 — Intégration dans l'image : ciel après l'opaque, cuisson suspendue en intérieur, compilation différée
- sévérité moyenne · catégorie perf-gpu · effort M · gain estimé
- contre-vérification : **plausible**, priorité P1 · qualité identique · moteur (dans METAL)
- lieux : ferro src/renderer.js:1741@248043a; ferro src/renderer.js:1623-1629@248043a; ferro src/renderer.js:549-551@248043a; ferro src/renderer.js:1434@248043a

**Preuve.** renderer.js:1741 puis 1624 : le ciel est dessiné en premier, test de profondeur coupé, sur tout l'écran, y compris en intérieur. RGPU a déjà mesuré le ciel après l'opaque : 0 à −0,3 ms sur M5, image exacte ; le gain est plus grand sur les GPU sans élimination des surfaces cachées. Compilation des programmes du prototype : 5 à 555 ms par programme selon le lancement. Le ciel porte sa propre vignette (mix(.76, 1., vignette), ligne 551) différente de celle du monde (.59, ligne 432), incohérence déjà relevée par RGPU-07.

**Cause.** Le ciel est traité comme un fond d'écran et non comme le dernier objet opaque de la scène.

**Proposition.** - Dessiner la passe finale du ciel après les opaques et avant les particules, avec gl_Position.z = w et depthFunc(LEQUAL) : seuls les pixels de ciel visibles sont ombrés, coût nul en intérieur.
- Suspendre la cuisson des tranches quand le jeu signale l'intérieur (fx.skyVisible === false ; METAL connaît isOutdoors, game.js:252), et la ralentir quand le vent est nul.
- Compiler les programmes de cuisson après la première image, avec KHR_parallel_shader_compile ; en attendant, afficher l'atmosphère seule ou le chemin hérité. Le shader de la passe finale ne doit pas inclure les fonctions de cuisson.
- Retirer la vignette du ciel quand elle passe en post-traitement (RGPU-07).
- Recuire tables, bruit et dôme après webglcontextrestored (ligne 1773).

**Gain attendu.** Coût du ciel nul en intérieur et proportionnel au ciel réellement visible sur tous les GPU ; aucune saccade de compilation au premier affichage extérieur.

**Risques.** L'arme est dessinée après un effacement de profondeur (ligne 1761) : le ciel doit être dessiné avant. Avec MSAA, le ciel est rendu dans la cible multi-échantillons : même état de profondeur à respecter.

**Vérifier par.** Banc bench/rgpu : variantes « ciel en premier » et « ciel après l'opaque » sur une image d'intérieur et une d'extérieur, différence d'images nulle ; première image extérieure sans pic de temps dans bench/stab.

**Contre-vérification.** Ordre confirmé : effacement, ciel sans test de profondeur, puis monde (1741, 1624). Le seul mélange alpha du moteur est dans renderEffects (1575-1576) : toute la géométrie est opaque, donc le ciel après l'opaque donne une image exactement identique. L'arme est bien dessinée après un effacement de profondeur (1761). Sur M5 le gain est de 0 à −0,3 ms (RGPU) ; il est réel sur les GPU à rendu immédiat (2,2 à 3,7 ms mesurés par la vérification de PHOTO-06 sur une autre machine).
Recoupe RGPU et PHOTO-06 : une seule mise en œuvre.
Réserves : POST_VERT est partagé avec le post-traitement, il faut une variante à z = w ; si la cuisson est suspendue en intérieur alors que le glissement du vent continue, la reprojection étire le dôme : geler aussi l'horloge des nuages. KHR_parallel_shader_compile : dans mes lancements, un programme absorbe 290 à 404 ms au premier usage, ce qui confirme le risque de saccade.

### CIEL-13 — BITUME et Point de rupture : mêmes textures de ciel, besoins différents
- sévérité moyenne · catégorie ciel · effort M · gain qualitatif
- contre-vérification : **plausible**, priorité P2 · qualité meilleure · moteur (dans METAL)
- lieux : ~/Projects/bitume/src/decor.js:57; ~/Projects/bitume/src/jeu.js:584; ~/Projects/point-de-rupture/Jeu/src/jeu.js:17; ~/Projects/point-de-rupture/Jeu/src/jeu.js:233

**Preuve.** BITUME : les trois thèmes (forêt, côte, montagne) ont le même type de ciel, bleu de plein jour, soleil entre 35 et 44° (decor.js:57-65) ; le ciel occupe une grande part de l'image et le décor est vu jusqu'à 1 900 m avec fogDensity de .00075 à .0011 ; ni heure, ni météo. Point de rupture : une seule atmosphère (jeu.js:17-22), vue de haut avec sunOnly:true et torch:false (jeu.js:233), ciel le plus souvent hors champ.

**Cause.** Les deux jeux ont repris l'atmosphère de METAL avec des valeurs de plein jour, faute de mieux dans le moteur.

**Proposition.** - BITUME : un préréglage par course (heure et météo), dôme 1024² ou 2048² en ultra car le ciel est très présent ; perspective aérienne de CIEL-07 indispensable sur les longues vues ; reflets de CIEL-08 sur la laque et l'asphalte mouillé ; ombres de nuages à l'échelle réelle.
- Point de rupture : pas de passe finale tant que la caméra regarde vers le bas (automatique avec CIEL-12) ; cuisson du dôme au ralenti (1/1024 par image) ; l'apport est l'ambiance dérivée du ciel (CIEL-06) et les ombres de nuages sur la ville (CIEL-09).
- Les valeurs des préréglages restent dans chaque jeu ; seuls le modèle et l'API sont dans FERRO.

**Gain attendu.** BITUME gagne heure du jour, météo et reflets cohérents ; Point de rupture gagne une lumière vivante pour un coût par image proche de zéro.

**Risques.** Point de rupture a un arbre de travail en cours de modification par une autre session : n'intégrer qu'après. Dans BITUME, un soleil bas face à la piste peut gêner la lecture des trajectoires : borner l'élévation par circuit.

**Vérifier par.** Captures de BITUME à trois heures sur le même circuit ; dans Point de rupture, compteur de passes : aucune passe de ciel en vue plongeante.

**Contre-vérification.** Citations confirmées (BITUME decor.js:57-65, jeu.js:584 ; Point de rupture jeu.js:17-22 et 233). Correction : les soleils de BITUME sont à 41,5°, 48,5° et 52° d'élévation, pas 35 à 44°. Qualitatif, sans mesure. Les valeurs de préréglage restent dans chaque jeu, conformément à la règle de FERRO. BITUME a déjà son propre seuil de bloom plus haut (0,86 à 0,98 d'après la vérification BITUME) : c'est un indice de plus pour CIEL-V1. Ne rien intégrer dans Point de rupture tant que l'autre session y travaille.

## Constats ajoutés par le contre-vérificateur

### CIEL-V1 — Le bloom du moteur va voiler tous les nouveaux ciels : seuil appliqué à l'image déjà tonalisée, ciel compris
- sévérité haute · catégorie ciel · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur (dans METAL)
- lieux : ferro src/renderer.js:561-563@248043a; ferro src/renderer.js:577@248043a; ferro src/renderer.js:1740-1741@248043a; metal src/renderer.js:501@673d6b2

**Preuve.** FERRO renderer.js:561-563 : bright() garde c × smoothstep(.56, .86, max(c)) sur la scène 8 bits ; ligne 577 : scène + bloom × 0,28. Le ciel est dessiné dans cette même cible (1740-1741). Les captures du prototype sont faites sans cette passe. Mesure sur ses PNG (55 % haut de l'image, un pixel sur 9, décodage BMP maison) du poids moyen du seuil de bloom : ciel actuel 0,008 (jardin), 0,044 (lisière), 0,068 (carrière) ; nouveau : nuit 0,001, aube 0,11, brume 0,15, plein jour 0,25, crépuscule 0,28, orage 0,29, cendres 0,60. Part des pixels au-dessus de 0,56 : 33 à 35 % aujourd'hui, 39 à 93 % avec les nouveaux préréglages de jour.

**Cause.** Le bloom seuille une image déjà tonalisée et ne distingue pas le ciel du décor ; il était calibré pour des ciels sombres. Un ciel physique clair le déclenche sur toute sa surface.

**Proposition.** Utiliser le canal alpha de la cible de scène comme masque de bloom : la nouvelle passe de ciel écrit alpha = 0 pour l'atmosphère et le corps des nuages, 1 pour le disque solaire et une fraction pour les bords éclairés ; bright() multiplie par texture(uScene, uv).a. Le monde et le ciel hérité écrivent déjà alpha = 1 (lignes 438 et 551) : image inchangée pour eux. Les particules mélangent en alpha (1575) : passer à blendFuncSeparate pour ne pas salir le masque. Avec MSAA la cible est aussi RGBA8 (1403). Critère : sur une capture « plein jour » avec bloom, écart moyen ≤ 2 niveaux avec la même capture sans bloom hors d'un rayon de 5° autour du soleil ; silhouettes d'ennemis sur fond de ciel sans halo.

**Gain attendu.** Évite un voile lumineux 4 à 30 fois plus fort qu'aujourd'hui sur le ciel et un halo autour des silhouettes ; coût nul (une multiplication dans la passe de seuil).

**Risques.** Le chemin hérité doit rester à alpha = 1 pour une image identique. Si la chaîne HDR (PHOTO-04, NVIDIA-02) arrive, le seuil se fera avant tonalité et le masque deviendra inutile.

**Vérifier par.** Refaire la mesure : sips vers BMP puis script de bancs/ciel-verif/ ; ajouter au prototype la passe POST_FRAG du moteur et comparer avec et sans masque.

### CIEL-V2 — Soleil bas ou sous l'horizon : séparer l'astre visible de la direction d'éclairage, sinon les arènes perdent leur soleil et leurs ombres
- sévérité haute · catégorie ciel · effort S · gain qualitatif
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur et jeu
- lieux : ferro src/renderer.js:1596-1617@248043a; ferro src/renderer.js:383-386@248043a; ferro src/renderer.js:711@248043a; metal src/renderer.js:651@673d6b2; metal src/renderer.js:1440@673d6b2; metal checks/world.test.mjs:93@673d6b2

**Preuve.** FERRO renderer.js:1596-1617 : sunShadowPass construit le volume d'ombre sur environment.sunDirection (emprise 28 à 36 m, profondeur 115 m, recul 55 m) ; 383-386 : le terme solaire utilise la même direction ; 142 : biais d'ombre fonction de dot(n, l). Ligne 711 : la borne à 0,12 que CIEL-02 veut lever. METAL checks/world.test.mjs:93 exige sunDirection[1] > 0,3. Élévations actuelles de METAL : 52,5°, 37° et 26,7°. CIEL-10 propose des paliers à 6°, 3°, 2°, 1° et −6°. Géométrie : à 3°, un mur de 4 m porte une ombre de 76 m, plus que la largeur d'une arène ; à 1°, 229 m.

**Cause.** Le constat traite le soleil comme un seul objet, alors que le moteur s'en sert à la fois pour l'image du ciel et pour l'éclairage et les ombres du décor.

**Proposition.** Dans atmosphere.sky, deux directions : sun (astre visible et source de l'atmosphère, libre jusque sous l'horizon) et key (direction d'éclairage et d'ombre). Par défaut key = même azimut que l'astre, élévation relevée à un plancher réglable (18° conseillé, soit sin ≥ 0,3 comme le test de METAL) ; la nuit, key = direction de la lune avec le même plancher. La couleur et l'intensité de key viennent de la transmittance vers l'astre visible (CIEL-06). environment.sunDirection de METAL reste inchangé et sert de key : aucun test ni monde modifié. La borne de la ligne 711 reste appliquée à key, pas à sun. Critère : dans chaque préréglage, au moins 40 % du sol d'une arène type reste au soleil direct ; aucune acné d'ombre sur le sol.

**Gain attendu.** Crépuscules, aubes et nuits possibles sans arènes entièrement à l'ombre ni ombres dégradées ; aucun coût par image.

**Risques.** Écart visible entre la hauteur du disque et la direction des ombres aux soleils très bas : c'est la triche habituelle des jeux, à garder sous 15 à 20° d'écart ou à masquer par des nuages bas. Compatible avec le cache d'ombres statiques de l'axe DRAW puisque key est fixe par monde.

**Vérifier par.** Capture d'une arène de METAL à key = 3° puis 18° avec le même ciel : part du sol au soleil direct et inspection du biais ; npm test inchangé (world.test.mjs:93 vert).

### CIEL-V3 — Crêtes d'horizon : oubliées par le prototype (27 % du coût actuel) ; et le ciel hérité gagne 35 à 45 % avec deux bornes exactes, image identique au bit près
- sévérité haute · catégorie perf-gpu · effort S · gain mesuré
- ajouté par le contre-vérificateur (non recontrôlé) · qualité identique · moteur (dans METAL)
- lieux : ferro src/renderer.js:539-548@248043a; metal src/renderer.js:479-488@673d6b2; ferro src/renderer.js:893-900@248043a

**Preuve.** FERRO renderer.js:543-548 : deux crêtes (atan + 3 bruits) calculées pour chaque pixel alors qu'elles ne peuvent agir que sous ray.y = 0,121 ; 539-542 : nuages (16 hachages) calculés même sous l'horizon où leur poids est nul. Mesures appariées (cielv.html, modes #bench et #gate) : ciel actuel sans crêtes = 0,74 fois l'actuel ; nouveau ciel + crêtes procédurales = 0,72 à 0,81 ; nouveau ciel + crêtes teintées par la table + vignette = 0,96 à 1,09. Variante bornée du shader actuel (if(ray.y > -.01) autour des nuages, if(ray.y < .125) autour des crêtes) : 0 octet différent sur 4 environnements × 4 tangages (35°, 20°, 0°, −20°) × 2 définitions ; coût 0,53 à 0,64 fois l'actuel à 2560×1440 (−0,50 à −0,65 ms plein écran) et 0,62 à 0,79 à 1792×1008 (−0,17 à −0,27 ms). softwareSky (866-901) dessine aussi ces crêtes.

**Cause.** Le shader de ciel est sans branche : chaque pixel paie les nuages et les crêtes, même là où leur poids est exactement nul. Le prototype a supprimé les crêtes sans le dire, ce qui embellit son rapport de coût et laisse un sol plat sous l'horizon.

**Proposition.** 1. Chemin hérité, tout de suite : entourer les lignes 539-542 de if(ray.y > -.01){…} et les lignes 544-548 de if(ray.y < .125){…}. Les smoothstep saturent hors de ces bornes et mix(a, b, 0) rend a exactement : image identique au bit près, vérifiée.
2. Nouveau ciel : garder une couche d'horizon, mais pas par pixel sur tout l'écran. Soit la même borne if(d.y < .125), soit un anneau de géométrie (bande de 256 segments générée par graine, dessinée avec le ciel, teintée par la couronne d'horizon de CIEL-07), net à toute définition. Le secours Canvas 2D garde ses deux couches.
3. Exposer la couche dans l'API (atmosphere.sky.horizon : graine, hauteur, 0 pour la retirer).
Critère : octets identiques au ciel 248043a pour le point 1 ; nouveau ciel avec horizon ≤ 60 % du coût actuel.

**Gain attendu.** Chemin hérité (les trois jeux aujourd'hui) : −36 à −47 % du coût du ciel à 1440p, soit −0,5 à −0,65 ms plein écran, et −0,17 à −0,27 ms à 1,8 MPix. En jeu, les pixels de ciel au-dessus de 7° gagnent les 27 % des crêtes. Nouveau ciel : garde un horizon fermé sans retomber au coût actuel.

**Risques.** Les octets de SKY_FRAG changent : un test qui compare la chaîne du shader doit comparer les pixels. Un compilateur peut aplatir les branches sur certains pilotes : gain alors nul, image toujours identique. Mesures faites sous forte charge : rapports fiables, valeurs absolues gonflées.

**Vérifier par.** cd bancs/ciel-verif && ./run2.sh 'cielv.html#gate,24' out gate.json (octetsDifferents doit valoir 0, ratio < 0,8) ; './run2.sh cielv.html#bench,30,plein-jour' pour texturesCretes et texturesPlein.

### CIEL-V4 — Dôme de nuages : 4 à 8 texels par degré contre 16 à 21 pixels à l'écran, stries à l'horizon, 33,5 Mo en RGBA16F
- sévérité moyenne · catégorie ciel · effort M · gain estimé
- ajouté par le contre-vérificateur (non recontrôlé) · qualité meilleure · moteur (dans METAL)
- lieux : bancs/ciel/gen-proto.mjs:56-64; bancs/ciel/proto-main.js:38; bancs/../audit/ciel/nouveau-plein-jour.png

**Preuve.** Projection du prototype (gen-proto.mjs, domeUV : uv = .5 + .5·d.xz / ((1 + d.y)·1,1)) : densité de 233 texels par radian au zénith et 465 à l'horizon pour 1024², soit 4 et 8 texels par degré ; l'écran en a 16,4 à 1440p et 21 à 2880×1864 (champ de 75°). Recadrage agrandi de nouveau-plein-jour.png : bords flous et stries radiales dans les nuages proches de l'horizon (bancs/ciel-verif/crop-horizon3.png). Mémoire : 4 textures 1024² × 8 octets = 33,5 Mo, sans les mips de CIEL-08. Le rapport lui-même donne 2048² contre 1024² : écart moyen 0,90 niveau, donc 1024² n'a pas convergé.

**Cause.** Le paraboloïde ne donne à l'horizon que deux fois la densité du zénith, alors que la perspective y entasse la couche de nuages ; et le format demi-flottant sur quatre textures consomme la mémoire qui permettrait de monter en définition.

**Proposition.** - Format : dôme en RGBA8 (luminance des nuages normalisée par le maximum de la cuisson, codée en racine, tramée à la cuisson ; transmittance en alpha). 4 Mo par texture au lieu de 8 : un dôme 2048² coûte alors 16 Mo par texture, ou 1024² tombe à 12 Mo au total avec trois textures. Supprime aussi la dépendance à EXT_color_buffer_float pour le dôme.
- Trois textures au lieu de quatre : la marche brute s'écrit dans la texture « en cours », la résolution filtrée va directement dans la cible à permuter.
- Répartition : déformer l'élévation (rayon en racine, par exemple) pour donner au moins 12 texels par degré sous 15° d'élévation.
- Netteté à la définition native : dans la passe finale, éroder le bord des nuages avec une lecture du bruit 3D (détail de haute fréquence appliqué à la transmittance), comme les suréchantillonnages de nuages des moteurs récents.
Critère : sur un recadrage ×3 de l'horizon à 2880×1864, aucune strie radiale ; largeur de transition d'un bord de nuage ≤ 4 pixels écran ; mémoire du ciel ≤ 16 Mo sur ordinateur et ≤ 6 Mo sur mobile.

**Gain attendu.** Nuages nets à la définition native, conformes à « sans perdre en résolution » ; mémoire divisée par 2 à 3. Coût : une lecture de texture 3D de plus par pixel de ciel couvert de nuages (estimé 0,05 à 0,1 ms par MPix, non mesuré).

**Risques.** Le codage 8 bits impose un tramage à la cuisson, sinon bandes dans les nuages sombres (orage, nuit). L'érosion de détail doit glisser avec le vent comme le dôme, sinon les bords fourmillent. Non prototypé.

**Vérifier par.** Dans le prototype : variante de dôme RGBA8 et variante 2048², fonction diff() contre le calcul direct (viser un écart moyen ≤ 1,0 niveau, contre 2,0 aujourd'hui) ; recadrages comparés à l'horizon ; coût par variante appariée du mode #bench.
