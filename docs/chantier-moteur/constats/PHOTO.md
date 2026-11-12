# Axe PHOTO — PHOTO

Écrit quand un dépôt FERRO séparé était encore prévu : lire « FERRO » comme « modules moteur de METAL ». Contre-vérifié.

## Résumé

Axe PHOTO : conception du palier photoréaliste de FERRO pour METAL, BITUME et Point de rupture (PDR).

**Périmètre et méthode**
- Lus en lecture seule : FERRO v0.2 (248043a), BITUME (39b3214, citations prises au commit, l'arbre de travail étant en cours de modification par une autre session), PDR (5ac0066, dont Jeu/ est identique à 28d1d7c) et la copie METAL (673d6b2).
- Rien n'a été écrit dans ces quatre dossiers. Les mesures ont été faites dans un clone, sous bancs/../wf2/photo : Chrome sans interface sur file://, sans port, sans réseau ni paquet. Le clone passe npm test (44/44).
- Seul GPU disponible : Apple M5. Aucune mesure NVIDIA : tous les coûts RTX et GPU intégré sont des hypothèses.

**Constat sur FERRO 0.2**
- C'est un rendu forward en couleurs 8 bits, sans HDR.
- Chaque shader applique lui-même le tonemap, le gamma et la vignette ; la vignette du ciel (0,76) diffère de celle du monde (0,59).
- Le bloom est seuillé sur des valeurs déjà compressées pour l'écran.
- La profondeur n'est pas lisible par un shader ; il n'y a ni gigue, ni vitesse, ni historique, ni chrono GPU, ni aucune extension WebGL.
- L'éclairage est empirique : constantes 0,035, 0,055, 0,27 et 0,13, ambiance fixe, métaux qui diffusent.
- Défauts annexes :
  - la passe d'ombre de la torche tourne même avec torch:false ;
  - le ciel est ombré sous la géométrie ;
  - le gouverneur de résolution se règle sur le temps CPU fourni par le jeu.

**Capacités et coûts mesurés (M5, 2560×1440)**
- Ce qu'il faut est présent : extensions de rendu flottant et de chrono, contrôle de la profondeur, compilation parallèle, 8 sorties par passe, blocs d'uniformes de 16 Ko. WebGPU accepte une sortie HDR d'écran, ce que WebGL refuse.
- HDR, bloom, exposition et tonemap : 0,8 à 1,0 ms, soit +0,5 à 0,7 ms par rapport à aujourd'hui.

| Passe | Coût M5 |
|---|---|
| GTAO | 1,0 à 1,2 ms (3,4 à 6,3 ms sans mips de profondeur) |
| TAA | 0,8 à 1,4 ms |
| TAAU 67 % | 0,9 à 2,4 ms |
| SSR (reflets écran) | 0,5 à 1,5 ms |
| Brouillard volumétrique en atlas | 1,2 à 1,4 ms |
| Flou de mouvement | 1,4 à 2,2 ms |
| Profondeur de champ | 1,1 à 1,5 ms |
| PCSS (ombres douces) | 2,0 à 2,4 ms |
| FERRO 0.2 tel quel, selon la scène | 4,9 à 12,2 ms |

**DLSS**
- Il n'est pas accessible depuis un navigateur (probable, à confirmer par l'axe NVIDIA).
- L'amplification sera donc un TAAU maison, dont l'interface reprend les entrées de DLSS.

**Plan proposé**
- Architecture :
  - un rendu photo en option stricte, dans un script séparé (src/photo.js) qui consomme un « cadre » produit par renderer.js ;
  - un graphe de passes déclaratif, des ressources décrites, des matières en bloc d'uniformes ;
  - le chemin classique reste identique au bit près et sert de preset Bas.
- Ordre des paliers :
  1. socle ;
  2. HDR ;
  3. TAA et TAAU au format DLSS ;
  4. BRDF physique, puis ciel Hillaire, IBL et sondes ;
  5. ombres en cascade ;
  6. pré-passe et GTAO ;
  7. SSR et brouillard volumétrique ;
  8. flou de mouvement et profondeur de champ.
- En parallèle :
  - matières PBR à couches ;
  - lumières en grappes et décalques ;
  - points d'accroche pour la foule PDR et les rétroviseurs BITUME.
- Presets de Bas à Ultra :
  - a priori tiré du nom du GPU, puis calibrage sur le temps GPU mesuré ;
  - échelle dynamique sans réallocation ;
  - garde-fous pour mobiles et faible mémoire.
- Tests : GL simulé enrichi, captures mesurées sur file://, chrono par passe, protocole de mesure NVIDIA.

**Décisions pour David**
- DLSS natif, donc hors navigateur, ou non.
- La place du photoréalisme face à la feuille de route BITUME, qui écrit « pas le photoréalisme ».

## Faits

- **F01** (vérifié, contre-vérification : confirmé) FERRO v0.2 n'emploie aucune extension WebGL2 ni format flottant : aucun getExtension, aucune cible RGBA16F ou R11F_G11F_B10F, aucune requête de temps, aucun texStorage, aucun UBO, aucune gigue, vitesse ni historique. Seules MAX_SAMPLES et MAX_TEXTURE_SIZE sont lues. — _~/Projects/ferro/src/renderer.js@248043a (étiquette v0.2), lu le 2026-11-12_
- **F02** (vérifié, contre-vérification : confirmé) Chaque shader tonemappe et corrige lui-même ; le bloom travaille sur des valeurs déjà compressées ; toutes les cibles sont en RGBA8. — _~/Projects/ferro/src/renderer.js@248043a_
- **F03** (vérifié, contre-vérification : confirmé) L'éclairage du monde est empirique, non conservatif en énergie. — _~/Projects/ferro/src/renderer.js@248043a_
- **F04** (vérifié, contre-vérification : confirmé) La profondeur n'est pas échantillonnable. Le ciel est dessiné en premier sans test de profondeur. L'overlay est dessiné après effacement de la profondeur. — _~/Projects/ferro/src/renderer.js@248043a_ **Correction :** « La profondeur de scène n'est pas échantillonnable » : l'atlas d'ombre l'est déjà.
- **F05** (vérifié, contre-vérification : confirmé) Les ombres passent par un atlas 2×2 à usage fixe, avec un seul ortho pour le soleil. La passe de la torche tourne même avec fx.torch===false. — _~/Projects/ferro/src/renderer.js@248043a ; bancs/../wf2/photo/banc/renderer-m5-5.json (2026-11-12)_
- **F06** (vérifié, contre-vérification : confirmé) Le gouverneur de résolution se règle sur le temps d'image CPU fourni par le jeu, pas sur le GPU. — _~/Projects/ferro/src/renderer.js@248043a_ **Correction :** Le gouverneur se règle sur l'intervalle d'image mesuré par le jeu (rAF), pas sur un temps CPU, et jamais sur le GPU.
- **F07** (vérifié, contre-vérification : confirmé) Les règles de FERRO imposent une compatibilité stricte, des scripts autonomes et aucun code propre à un jeu dans src/. Le test de reprise compare le flux de commandes GL. — _~/Projects/ferro@248043a_ **Correction :** API : README.md:20-23@248043a.
- **F08** (vérifié, contre-vérification : confirmé) Capacités WebGL2 mesurées dans Chrome 157 sans interface, sur « ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version) ». — _bancs/../wf2/photo/sonde/sonde.html et sonde/resultat-headless.json (2026-11-12)_
- **F09** (vérifié, contre-vérification : réfuté) WebGPU, la sortie HDR et la précision des horloges ont été sondés sur le même poste. — _bancs/../wf2/photo/sonde/sonde.html, sonde-hdr.html et sonde-hdr2.html, lus par --dump-dom (2026-11-12)_ **Correction :** - WebGL 2 accepte un tampon d'affichage RGBA16F quand le contexte est créé en alpha:true avec EXT_color_buffer_float.
- FERRO le crée en alpha:false (renderer.js:1353).
- L'affichage étendu (valeurs au-delà de 1) n'est pas vérifié en WebGL.
- **F10** (vérifié, contre-vérification : confirmé) Micro-banc des passes à 2560×1440 sur M5 : minimum par passage, plage sur les passages 3 à 5, synchronisés. — _bancs/../wf2/photo/banc/passes.html, passes-m5-3.json à passes-m5-5.json (2026-11-12)_
- **F11** (vérifié, contre-vérification : confirmé) FERRO 0.2 tel quel, en qualité 'high' à 2560×1440 sur M5 : médiane du temps total CPU+GPU synchronisé par readPixels, 5 passages. — _bancs/../wf2/photo/banc/renderer.html, renderer-m5-1.json à renderer-m5-5.json (2026-11-12)_
- **F12** (probable, contre-vérification : plausible) Décomposition estimée sur M5 : environ 0,94 ns par pixel marginal et environ 2,5 ms fixes pour la scène A. Ombres et bloom coûtent environ 1,2 ms en A et environ 4 ms en B. — _bancs/../wf2/photo/banc/renderer-m5-5.json (2026-11-12)_
- **F13** (vérifié, contre-vérification : confirmé) Sur le GPU à tuiles du M5, un micro-banc naïf mesure du vide. Il faut des cibles alternées (ping-pong), une passe 1×1 qui lit les sorties, puis readPixels. — _bancs/../wf2/photo/banc/passes-m5-1.json et passes-m5-2.json (2026-11-12)_ **Correction :** Passage 1 seul sans dépendance ; GTAO à 3,67 ms dès le passage 2.
- **F14** (vérifié, contre-vérification : confirmé) Le banc de PDR pilote Chrome par tube, sans port. Il note que sous ANGLE et Metal le chrono GPU englobe l'attente en file. — _~/Projects/point-de-rupture/Jeu/verifications/banc-rendu.py@5ac0066_
- **F15** (vérifié, contre-vérification : confirmé) PDR recopie l'éclairage et la sortie du monde pour sa foule, en RGBA8 déjà tonemappé, et juge le MSAA indispensable. FERRO n'a pas repris cette bibliothèque. — _~/Projects/point-de-rupture/Jeu/src/moteur/renderer.js@5ac0066 ; ~/Projects/ferro/VERSIONS.md:29@248043a_
- **F16** (vérifié, contre-vérification : confirmé) La feuille de route BITUME exclut le photoréalisme et fixe des critères chiffrés de capture et de coût. — _~/Projects/bitume/FEUILLE-DE-ROUTE.md et src/jeu.js @39b3214 (arbre de travail modifié par une autre session, non utilisé pour les citations)_
- **F17** (vérifié, contre-vérification : confirmé) Budgets de taille des pages : 1,4 Mo pour METAL, 1,4 Mo pour BITUME, 3 Mo pour PDR. — _le dépôt METAL@673d6b2 ; ~/Projects/bitume@39b3214 ; ~/Projects/point-de-rupture/Jeu@5ac0066_
- **F18** (vérifié, contre-vérification : confirmé) METAL ne revendique aucune mesure sur GPU physique. — _VALIDATION.md:184@673d6b2_ **Correction :** Citer VALIDATION.md:44,52@673d6b2.
- **F19** (probable, contre-vérification : plausible) DLSS, quelle que soit sa version, n'est utilisable que par une application native D3D11, D3D12 ou Vulkan via NGX ou Streamline. Ni WebGL2 ni WebGPU ne l'exposent, et la génération d'images est impossible dans un navigateur. La version « DLSS 5 » citée par David n'est pas vérifiée ici. — _https://github.com/NVIDIA/DLSS (non consulté le 2026-11-12) ; à confirmer par l'axe NVIDIA_
- **F20** (probable, contre-vérification : plausible) Entrées de DLSS Super Resolution, partagées dans l'esprit par FSR2 : couleur à la résolution de rendu (HDR linéaire de préférence), profondeur (drapeau Z inversé), vecteurs de mouvement 2D en pixels du courant vers le précédent, sans gigue, décalage de gigue en pixels, exposition (ou exposition auto) et pré-exposition, drapeau de réinitialisation, masques réactif et de transparence facultatifs, tailles de rendu et de sortie. FSR2 recommande 8×(affichage/rendu)² phases de gigue. — _https://github.com/NVIDIA/DLSS ; https://github.com/GPUOpen-Effects/FidelityFX-FSR2 (non consultés le 2026-11-12)_
- **F21** (incertain, contre-vérification : plausible) Rapport de coût supposé par rapport au M5 : RTX milieu de gamme (classe 4060 à 5060) de ÷2 à ÷3 ; GPU intégré faible (Iris Xe, UHD) de ×2,5 à ×4 ; GPU intégré récent (Radeon 780M, Arc 140V) de ×1 à ×1,5. — _Hypothèse de l'axe PHOTO, 2026-11-12_
- **F22** (incertain, contre-vérification : confirmé) Une note KBZA mentionne un passage réussi sur RTX 5090 en 3840×2160 sur david-pc, et un tour plus récent cite un autre PC Windows pour les tests. L'état actuel de la machine NVIDIA n'est pas vérifié. — _KBZA (kbza_context, 2026-11-12)_ **Correction :** - La 5090 tourne sous Linux, écran physique en 2560×1440 ; le 4K était virtuel.
- Le PC Windows est un portable équipé d'une RTX 5060 Laptop.
- **F23** (vérifié, contre-vérification : confirmé) Aucune écriture dans les quatre dossiers. Un clone de FERRO v0.2 (renderer.js sha256 d57dae38…) passe npm test sous Node v24.18.0. — _bancs/../wf2/photo/ferro (2026-11-12)_

## Propositions

### PHOTO-01 — Palier photo en option stricte, chemin classique gelé et repli automatique
- type exigence · priorité P0 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **confirmé**

**Pourquoi.** AGENTS.md:10-11 impose qu'un FRender sans nouvelles options se comporte exactement comme avant, et le test de reprise compare le flux GL (F07). Les trois jeux créent le renderer sans option photo (BITUME jeu.js:776). Les budgets de 1,4 à 3 Mo (F17) imposent que seul le jeu qui choisit le photo en paie le code. Le chemin classique reste aussi le seul repli sûr pour les GPU faibles, les rendus logiciels et les mobiles.

**Preuve.** ~/Projects/ferro/AGENTS.md:8-13@248043a ; ~/Projects/ferro/checks/renderer-reprises.test.mjs:24-35,70-75@248043a ; ~/Projects/bitume/src/jeu.js:776@39b3214 ; F17

**Proposition.** - **Fichier** : nouveau script autonome src/photo.js, chargé après renderer.js, qui pose FRender.photo (global, sans module ES, conforme à AGENTS.md:13).
- **Création** : FRender.create(canvas, {rendu:'photo', preset:'auto'|'bas'|'moyen'|'haut'|'ultra', ...}).
  - Sans rendu, ou avec 'classique', aucune ligne nouvelle n'est exécutée et getExtension n'est jamais appelé.
- **Repli sur le classique** (stats.rendu='classique', stats.raison) dans ces cas :
  - photo.js absent (console.warn une seule fois) ;
  - EXT_color_buffer_float absent ;
  - rendu logiciel (SwiftShader, llvmpipe) ;
  - échec d'un FBO flottant ou d'une compilation.
- **Preset 'bas'** : chemin classique v0.2 en qualité 'auto'.
- **Shader classique** : texte identique à l'octet près. Les corrections du classique passent par des réglages nommés, inscrits dans VERSIONS.md.
- **Copies des jeux** : leurs retouches restent chez elles ; photo.js ne consomme que le cadre défini en PHOTO-03.
- **Taille** : renderer.js grossit d'environ 1 Ko (aiguillage) ; tout le reste est dans photo.js.

**Critère d'acceptation.** - npm test vert, renderer-reprises inchangé.
- Nouveau test, avec un GL simulé sans extensions :
  - create(c), create(c,{}) et create(c,{rendu:'photo'}) produisent le même flux de commandes que l'étiquette v0.2 ;
  - getExtension n'est appelé aucune fois dans les deux premiers cas ;
  - le troisième donne stats.rendu==='classique' et stats.raison==='EXT_color_buffer_float'.
- Une page sans photo.js garde exactement la même taille dans SIZE.json.

**Risques.** - Deux chemins à maintenir : le classique gelé s'éloigne du photo.
- L'aspect diffère selon la machine (photo sur NVIDIA, classique sur mobile) ; c'est une décision artistique (PHOTO-17).
- Les copies BITUME et PDR doivent produire le même cadre.

**Contre-vérification.** Exigence fondée : AGENTS.md:8-13, le test de reprise et jeu.js:776 sont vérifiés.
Deux critères se contredisent :
- Le GL simulé journalise getExtension (test:28). Le mode photo ne peut donc pas donner le flux exact de v0.2.
- « Même taille » contredit « +1 Ko ».
À ajouter : AGENTS.md:7.

**Correction.** - Même flux que v0.2, hors appels de détection (getExtension, getSupportedExtensions, UNMASKED_*).
- Page sans photo.js : au plus v0.2 + 1,5 Ko.

### PHOTO-02 — Socle : capacités, minuteries GPU par groupe de passes, profondeur échantillonnable, Z inversé
- type exigence · priorité P0 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **confirmé**

**Pourquoi.** Sans profondeur lisible par les shaders ni chrono, aucun effet d'écran (AO, SSR, TAA, brouillard) ni aucun pilotage par le temps GPU n'est possible. Or FERRO 0.2 n'a ni l'un ni l'autre : profondeur en renderbuffer DEPTH_COMPONENT24, aucune requête de temps (F01, F04). Sur M5, le chrono existe (TIME_ELAPSED sur 64 bits) mais pas l'horodatage (0 bit). PDR a constaté que sous Metal le chrono inclut l'attente en file (F14).

**Preuve.** ~/Projects/ferro/src/renderer.js:1390-1397,1401,1421@248043a ; ~/Projects/point-de-rupture/Jeu/verifications/banc-rendu.py:17-18,334-347@5ac0066 ; F08

**Proposition.** - **capacites(gl)**, appelée en photo seulement :
  - extensions : EXT_color_buffer_float, EXT_color_buffer_half_float, EXT_float_blend, OES_texture_float_linear, EXT_disjoint_timer_query_webgl2, EXT_clip_control, EXT_depth_clamp, EXT_polygon_offset_clamp, KHR_parallel_shader_compile, OES_draw_buffers_indexed, WEBGL_multi_draw, EXT_texture_filter_anisotropic ;
  - limites, et échantillons par format via getInternalformatParameter ;
  - UNMASKED_RENDERER_WEBGL ;
  - drapeau « GPU à tuiles » (Apple, Mali, Adreno, PowerVR).
- **minuteur** :
  - une seule requête TIME_ELAPSED_EXT active à la fois ;
  - groupes non imbriqués : ombres, prepasse, ecran, opaque, transparents, externes, temporel, post ;
  - anneau de 4 images par groupe, lecture par QUERY_RESULT_AVAILABLE, image jetée si GPU_DISJOINT_EXT ;
  - stats.gpu en ms, médiane sur 30 images.
- **Profondeur** : DEPTH_COMPONENT32F en texStorage2D, échantillonnable.
  - Z inversé si EXT_clip_control : clipControlEXT(LOWER_LEFT, ZERO_TO_ONE), depthFunc GREATER, clearDepth 0 ; sinon Z classique.
- **invariant gl_Position** dans tous les vertex shaders photo.
- **Extensions** : WebGL2 suffit ; WebGPU n'est pas requis.
- **Taille** : environ 4 Ko.

**Critère d'acceptation.** - Sur M5 à 2560×1440, une image à la fois et synchronisée : la somme de stats.gpu reste à ±15 % du total mesuré par readPixels (méthode de banc/renderer.html) sur les scènes A à D ; tout écart est documenté.
- Test simulé : sans l'extension de chrono, stats.gpu===null et le gouverneur se replie sur le temps d'image.
- Capture D (far 900 m, near 0,1) : aucun z-fighting en Z inversé.

**Risques.** - Chrono absent sous Firefox et Safari (probable), ou faussé par l'attente en file sous Metal.
- EXT_clip_control et EXT_polygon_offset_clamp ne sont pas vérifiés sous Windows NVIDIA.

**Contre-vérification.** Preuves vérifiées ; c'est faisable avec WebGL 2 seul. Points à reprendre :
- MSAA : la profondeur se résout par un blit DEPTH vers une D32F de même format, sinon il faut couper le MSAA.
- La 5090 tourne sous Linux (ANGLE sur OpenGL ou Vulkan) et le portable sous Windows (D3D11) : vérifier EXT_clip_control et le chrono sur les deux (PHOTO-V3).
- La marge de ±15 % compare un temps GPU à un temps mur qui inclut l'envoi CPU.

### PHOTO-03 — Architecture minimale : cadre de rendu, graphe de passes déclaratif, ressources décrites, morceaux GLSL, matières en UBO
- type proposition · priorité P0 · effort L · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Le draw 0.2 enchaîne en dur ombres, ciel, statiques, nappes, lots, dynamiques, foule, particules, overlay, MSAA et post (L1700-1770), avec des cibles fixes (L1411-1432). Les matières y forment une chaîne de if (L177-332). Les jeux copient puis retouchent ce fichier : PDR en est à 17 retouches. Ajouter une dizaine d'effets sans structure multiplierait les états GL implicites et les conflits de fusion. Un futur WebGPU exige des passes explicites.

**Preuve.** ~/Projects/ferro/src/renderer.js:177-332,738-769,1411-1432,1700-1770@248043a ; ~/Projects/point-de-rupture/Jeu/src/moteur/PROVENANCE.md@5ac0066 ; F08 (UBO de 16 Ko, 8 sorties par passe, KHR_parallel_shader_compile)

**Proposition.** 1. **Cadre**
   - renderer.js garde la gestion de scène : setWorld, nappes, lots, actorFilter, index spatial, pack L738-769.
   - À chaque image, il produit un objet cadre :
     - camera {vue, proj, projGiguee, vueProjPrecedente, pos, near, far} ;
     - lots [{tampon, nombre, forme, statique, tamponPrecedent?}] ;
     - lumieres, soleil, environnement, effets, overlay, externes, temps, tempsPrecedent.
   - photo.js ne lit que ce cadre.
2. **Graphe**
   - Liste de passes {nom, entrees:[...], sorties:[...], actif(preset), executer(ctx)}, figée à la construction.
   - Ordre : ombres, prepasse, mipsProfondeur, gtao, ssr, froxels, opaque, ciel (après l'opaque, avec test de profondeur), transparents, externes, temporel, flou, pdc, exposition, bloom, final.
   - Chaque passe pose tout son état GL.
3. **Ressources**
   - Description {format, taille:'rendu'|'affichage'|fraction, mips, couches, echantillons, persistante, double}.
   - Un allocateur crée les cibles au redimensionnement et à la restauration du contexte. Il réutilise les cibles éphémères (alias) et tient stats.memoire.
   - Les cibles « rendu » sont allouées à l'échelle 1 ; l'échelle dynamique ne change que le viewport.
4. **Morceaux GLSL**, assemblés par gabarits et #define selon le preset :
   - commun : UBO Image en std140, binding 0 ;
   - bruit : repris de L88-112 ;
   - brdf, ombres, brouillard, matieres ;
   - sortie : location0 HDR pré-exposé, location1 vitesse.
   - Compilation asynchrone (KHR_parallel_shader_compile) : le classique rend tant que le photo n'est pas prêt.
5. **Matières**
   - UBO Matieres std140 : 32 entrées × 4 vec4 = 2 Ko, sous la limite vérifiée de 16 Ko.
   - Champs : base.rgb, rugosite ; metal, reflectance, vernis, vernisRugosite ; motif, echelle, contraste, relief ; emission, translucidite, porosite, paillettes.
   - Les motifs procéduraux restent du code, choisi par leur indice.
   - Les jeux passent par options.matieres et r.setMatiere(id, valeurs), sans toucher src/.
6. **Backend** : une seule implémentation WebGL2 ; le WebGPU viendra plus tard derrière les mêmes descriptions (PHOTO-16).

**Taille** : environ 12 à 18 Ko.

**Critère d'acceptation.** - Test simulé : liste ordonnée des passes actives et des ressources (format, taille) figée en instantané pour chaque preset, avec un total d'octets sous le budget du preset.
- Perte puis restauration du contexte : ressources recréées, image identique sur capture.
- Échelle 1 → 0,67 → 1 : aucun appel texImage ni texStorage, compté par le GL simulé.
- Aucune image au-delà de 50 ms pendant la compilation photo (banc navigateur sur M5).

**Risques.** - Sur-ingénierie si le graphe devient générique ; s'en tenir à une liste déclarative sans ordonnanceur automatique.
- Les copies des jeux peuvent dériver du cadre.
- Le cadre ajoute un peu de travail CPU par image ; à mesurer avec draw().

**Contre-vérification.** Lignes vérifiées ; UBO de 2 Ko exact. À reprendre :
- L'ordre des passes oublie l'overlay (L1759-1763).
- « Externes » est à découper par phase.
- Aujourd'hui, l'échelle redimensionne le canevas et recrée toutes les cibles (L1546-1549, L1411-1418). L'allocation à l'échelle 1 règle ce problème.
- Ne pas lire COMPILE_STATUS avant COMPLETION_STATUS_KHR : la v0.2 compile en bloquant (L1369-1378).

### PHOTO-04 — Palier 1 : HDR linéaire, pré-exposition, exposition auto, bloom en mips, tonemapping et sortie sRGB exacte
- type proposition · priorité P0 · effort L · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Aujourd'hui, chaque shader tonemappe lui-même, en RGBA8, et le bloom seuille des valeurs déjà compressées (F02).
- Conséquences : pas de vraie dynamique (soleil, tirs, phares), vignettage incohérent entre ciel (0,76) et monde (0,59), bandes dans les dégradés.
- Coûts mesurés sur M5 (F10) : RGBA16F se copie aussi vite que RGBA8 ; le bloom en 6 niveaux coûte 0,38-0,48 ms contre 0,30-0,32 aujourd'hui ; l'exposition 0,135-0,168 ms ; le tonemap 0,20-0,28 ms.
- Bénéfice par jeu :
  - METAL : passages entre intérieur et extérieur, tirs, explosions ;
  - BITUME : soleil rasant, tunnels, nuit et phares ;
  - PDR : jour et nuit, incendies, avec une exposition aux bornes étroites pour rester lisible.

**Preuve.** ~/Projects/ferro/src/renderer.js:428-437,498,549-551,563,577,1380-1409@248043a ; mesures F10 (2026-11-12) ; F09 (sortie HDR WebGPU acceptée, WebGL refusée)

**Proposition.** - **Cible de scène** : RGBA16F en Haut et Ultra, R11F_G11F_B10F en Moyen.
  - Les shaders photo du monde, des particules et du ciel écrivent du HDR linéaire × uPreExposition (l'exposition de l'image précédente).
  - Les particules se mélangent en linéaire.
- **Passe finale unique**, dans l'ordre :
  1. exposition EV100 ;
  2. bloom ajouté à 4 % (option bloomForce) ;
  3. tonemap 'agx' par défaut, 'aces' (approximation de Hill) ou 'ferro' (c/(c+.76), pour migrer sans changer l'aspect) ;
  4. LUT 3D 32³ facultative, générée par paramètres (contraste, saturation, balance des blancs) ;
  5. vignette, appliquée une seule fois ;
  6. teinte de blessure et onde, avec les mêmes fx (L433-437) ;
  7. sRGB exact par morceaux, puis tramage triangulaire ±1/255.
- **Bloom** :
  - 6 niveaux depuis la demi-résolution ;
  - descente 13 taps, avec moyenne de Karis au premier niveau ;
  - montée en tente 3×3 additive ;
  - bloomThreshold devient un genou doux exprimé en EV.
- **Exposition auto** :
  - log-moyenne au quart de résolution, puis mips jusqu'à 1×1 en R16F ;
  - option : histogramme de 64 cases (points en mélange additif, via EXT_float_blend), percentiles 50-95 % ;
  - adaptation τ 0,5 s vers le clair, 1,5 à 2 s vers le sombre ;
  - options.exposition {min, max, compensation} par jeu, et EV fixe pour les captures.
- **Extensions** : EXT_color_buffer_float requis, EXT_float_blend facultatif. WebGPU sert seulement plus tard, pour la sortie HDR d'écran.
- **Coût net** :
  - M5 : +0,5 à 0,7 ms (mesures F10, moins le bloom actuel) ;
  - RTX : 0,2 à 0,35 ms (hypothèse F21) ;
  - GPU intégré faible : 1,3 à 2,8 ms (hypothèse F21).
- **Mémoire à 1440p** : RGBA16F 29,5 Mo. En MSAA×4, utiliser R11G11B10 (59 Mo) et non RGBA16F (118 Mo).
- **Taille** : environ 8 à 12 Ko.

**Critère d'acceptation.** - **Ciel** : aucun saut de plus de 1/255 entre deux lignes voisines du dégradé, tramage actif.
- **Écrêtage** : moins de 0,5 % de pixels à 255 sur les captures A à D en exposition auto.
- **Exposition** : de B vers A, convergence à ±0,1 EV en 2 s, sans dépassement de plus de 0,5 EV.
- **Migration** : avec 'ferro' et l'EV de référence, écart moyen ≤ 6/255 avec la capture classique de A.
- **Coût** : ≤ 0,8 ms sur M5 à 2560×1440.
- **BITUME** : critère de chaussée (FEUILLE-DE-ROUTE:203) tenu en EV fixe.

**Risques.** - L'aspect des trois jeux change (décision en PHOTO-17).
- Un spéculaire très fort peut donner des NaN ou Inf en fp16 : saturer à 64 000 et neutraliser les NaN dans la passe finale.
- Le seuil de bloom de PDR ([.86,.98]) se traduit mal en EV.

**Contre-vérification.** Preuves et chiffres mémoire exacts. À reprendre :
- Le coût net tiré de F10 est de +0,40 à +0,63 ms.
- Que RGBA16F coûte autant que RGBA8 est propre aux GPU à tuiles ; sur NVIDIA, le débit de la cible double.
- L'histogramme doit être en R32F avec EXT_float_blend.
- AgX et ACES : partir de Filament (Apache-2.0) ou de three.js (MIT), pas d'un Shadertoy (CC BY-NC-SA). METAL interdit le GPL (CONTRACT.md:92@673d6b2).
- Un tampon d'affichage RGBA16F est possible en WebGL (F09).

### PHOTO-05 — Palier 3 : BRDF physique (GGX, Smith corrélé, multidiffusion) et lumières photométriques
- type proposition · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Les constantes ad hoc (0,035, 0,055, 0,27/0,13, ambiance fixe, métaux qui diffusent) donnent des ombres grises et des matières plates (F03). Avec le HDR et l'IBL, ces erreurs deviennent visibles. Bénéfice par jeu :
- METAL : métal industriel crédible ;
- BITUME : laque et jantes ;
- PDR : façades et toits au soleil.

**Preuve.** ~/Projects/ferro/src/renderer.js:117-125,162,359-368,371-382,390-393,400,403-421@248043a

**Proposition.** - **Diffus** : Lambert × base × (1−metal).
- **Spéculaire** :
  - D GGX avec α = rugosité², plancher 0,045 ;
  - V Smith-GGX à hauteur corrélée ;
  - F Schlick, avec f0 = mix(0,16·reflectance², base, metal) et reflectance 0,5 par défaut (soit 0,04).
- **Multidiffusion** : facteur 1 + f0·(1/DFG.y − 1). La table DFG 32×32 en RG16F est calculée une fois par le GPU au démarrage, à 64 échantillons par texel.
- **Lumières** :
  - intensité = power × K, avec une seule constante K calibrée sur les bancs A et B ;
  - atténuation saturate(1−(d/r)⁴)²/max(d²,0,01), en gardant range ;
  - torche en projecteur, cône repris de smoothstep(.59,.96) (L390-393) ;
  - soleil en lux, ciel apporté par l'IBL (PHOTO-06).
- **À retirer** :
  - la fuite +.035 (L380) ;
  - le plancher .055 (L162) ;
  - l'ambiance fixe (L364-368), remplacée par SH9 ou les sondes, avec une constante en repli ;
  - le reflet ad hoc (L403-421) ;
  - la borne à 12 (L117-125).
- **À garder** : l'AA spéculaire (L359-361).
- **Extensions** : EXT_color_buffer_float pour la table RG16F.
- **Coût** : estimé quasi neutre, puisque le GGX est déjà évalué par lumière ; à mesurer.
- **Taille** : environ 3 à 5 Ko.

**Critère d'acceptation.** - **Four blanc** : sphère de base 1 dans un environnement uniforme à 1, rugosité de 0 à 1, métal 0 et 1 ; sortie linéaire de débogage à 1,00 ±0,03.
- **Test Node** : écart ≤ 1 % entre la table DFG et une intégration numérique sur le CPU.
- **Coût** : scène B au plus 5 % plus lente avec la multidiffusion que sans.
- **Calibrage de K** : luminance moyenne de A et B à ±1 EV de l'image classique.

**Risques.** - Sans sondes, les intérieurs METAL perdent leur appoint fixe et paraissent noirs : prévoir un repli et compter sur l'exposition auto.
- Les couleurs de matières des jeux sont à reprendre.

**Contre-vérification.** Lignes vérifiées ; la compensation suit Filament. À reprendre :
- Le four blanc à 1,00 ±0,03 est hors d'atteinte pour metal=0 avec un Lambert non pondéré : 1,04 de face, davantage au rasant.
- 64 échantillons pour la table DFG risquent de ne pas tenir 1 % ; 1 024 coûtent un temps négligeable.

**Correction.** - Four blanc, metal=1 : 1,00 ±0,03.
- Four blanc, metal=0 : entre 0,97 et 1,10 hors du bord rasant, ou bien diffus pondéré par (1−E_spec).
- Table DFG : 1 024 échantillons.

### PHOTO-06 — Palier 3 bis : ciel physique Hillaire 2020, perspective aérienne, IBL et sondes de réflexion
- type proposition · priorité P1 · effort L · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Le ciel 0.2 se résume à un dégradé, un soleil, des nuages de bruit à 4 octaves et deux crêtes (L512-552). Il est dessiné en premier, sans test de profondeur, donc ombré même sous la géométrie (F04). Le reflet d'environnement est analytique. Bénéfice par jeu :
- BITUME : ciel à toute heure, perspective aérienne sur les longues lignes droites, reflets sur la laque (FEUILLE-DE-ROUTE:233) ;
- PDR : perspective aérienne pour les vues de ville à 330-900 m ;
- METAL : extérieurs industriels, et métaux d'intérieur qui reflètent quelque chose de plausible grâce aux sondes.

**Preuve.** ~/Projects/ferro/src/renderer.js:403-421,512-552,1623-1630@248043a ; ~/Projects/bitume/FEUILLE-DE-ROUTE.md:233@39b3214 ; F08 (MAX_3D_TEXTURE_SIZE 2048, rendu flottant)

**Proposition.** - **Atmosphère Hillaire 2020**, en passes de fragments faute de compute :
  - tables de transmittance (256×64, RGBA16F) et de multidiffusion (32×32), recalculées au changement d'atmosphère ;
  - vue du ciel en 192×108, à chaque image ;
  - perspective aérienne 32×32×32 rangée dans un atlas 2D 1024×32, appliquée aux surfaces dans l'opaque.
- **Ciel** : dessiné après l'opaque, avec test de profondeur au plan lointain. Nuages et crêtes deviennent des couches facultatives de l'environnement.
- **IBL** :
  - cubemap 128² en RGBA16F, 6 mips, préfiltrée GGX avec 32 à 64 échantillons importants ;
  - SH9 dans une texture 9×1 calculée sur le GPU, sans relecture ;
  - recalcul quand le soleil bouge de plus de 1°, à raison d'une face par image.
- **Sondes intérieures** :
  - octaédriques 128², dans une TEXTURE_2D_ARRAY RGBA16F, 32 au plus (environ 5,6 Mo) ;
  - capturées au chargement, en rendant 6 faces de 128² ;
  - parallaxe corrigée par boîte, mélange des 2 sondes les plus proches ;
  - API : options.sondes ou r.setSondes([{p, boite:[min,max]}]) ;
  - r.salirSondes(zone) pour la destruction dans METAL, avec recapture d'une face par image.
- **Extensions** : EXT_color_buffer_float, OES_texture_float_linear facultatif. WebGPU n'est pas requis.
- **Coût estimé, non mesuré** : ≤ 0,3 ms par image sur M5, ≤ 0,15 ms sur RTX, 0,8 à 1,2 ms sur GPU intégré, captures amorties sur plusieurs images.
- **Taille** : environ 15 à 20 Ko.

**Critère d'acceptation.** - **Ciel** : captures avec un soleil à −2°, 5°, 30° et 80° ; aucun NaN ni Inf en relisant le RGBA16F, horizon continu, coucher de soleil validé à l'œil.
- **Chrono** : ciel et tables ≤ 0,3 ms par image, recapture ≤ 0,5 ms par image.
- **Parallaxe** : une sphère miroir au centre d'une pièce cubique reflète les arêtes à 2 texels près.
- **Ciel dessiné en dernier** : le gain est mesuré sur la scène C.

**Risques.** - Il faut faire correspondre les biomes actuels (skyTop et skyBottom).
- Les captures au chargement coûtent cher sur les grands niveaux.
- Une boîte mal posée laisse la lumière d'une sonde traverser les murs.

**Contre-vérification.** L512-552 vérifiés ; les tailles suivent Hillaire 2020 ; 5,6 Mo exact.
- Mesuré : dessiner le ciel en premier coûte 2,2 à 3,7 ms sur C, à image identique. Le gain n'est donc pas réservé au mode photo (PHOTO-V1).
- Capturer les sondes demande une caméra hors écran, comme PHOTO-15.
- Les coûts restent à mesurer.

### PHOTO-07 — Palier 4 : ombres en cascade du soleil, atlas des lampes, filtrage par preset
- type proposition · priorité P1 · effort L · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Le soleil n'a qu'un seul ortho de 28 ou 36 m, ou camera.sun (F05). BITUME n'ombre donc que 44 à 46 m autour de la voiture (jeu.js:438), alors que la vue porte à des centaines de mètres. Seules les lampes 0 et 1 portent une ombre, la quatrième tuile reste vide, et la passe de la torche tourne même avec torch:false. Coûts de filtrage mesurés sur M5, plein écran à 1440p (F10) :
- PCF FERRO 9 taps : 0,25-0,36 ms ;
- sampler2DShadow 3×3 bilinéaire : 0,75-1,04 ms ;
- PCSS 16+16 : 1,99-2,41 ms.

**Preuve.** ~/Projects/ferro/src/renderer.js:134-163,379,1421,1578-1622,1737,1751@248043a ; ~/Projects/bitume/src/jeu.js:438,466@39b3214 ; mesures F10 et F11

**Proposition.** - **Soleil en cascades** :
  - 2 à 4 cascades en DEPTH_COMPONENT32F, rangées dans une TEXTURE_2D_ARRAY et lues par sampler2DArrayShadow (comparaison LINEAR) ;
  - découpe λ=0,75, sphère englobante, accrochage au texel (repris de L1603-1604), transition tramée sur 10 % ;
  - EXT_depth_clamp pour aplatir les projeteurs situés hors de la cascade, EXT_polygon_offset_clamp contre l'acné ;
  - les cascades lointaines ne se mettent à jour que toutes les 2^i images, et seulement pour les statiques.
- **Par preset** :
  - Moyen : 2 cascades de 1024, PCF à 4 taps comparés ;
  - Haut : 3 cascades de 2048 (50 Mo), 8 taps de Vogel tournés par pixel et par image, que le TAA lisse ;
  - Ultra : 4 cascades de 3072 (151 Mo), PCSS 16+16.
- **Réglages** : options.ombres {portee, cascades}. camera.sun reste respecté ; pour PDR, 1 ou 2 cascades ajustées à l'emprise au sol.
- **Lampes** :
  - atlas de 2048 en Haut et de 4096 en Ultra ;
  - tuiles attribuées par contribution à l'écran : 2, 4 ou 8 lampes selon le preset ;
  - cache statique copié, puis complété par les objets dynamiques.
- **Correctif du classique**, image identique, à inscrire dans VERSIONS.md : ne plus lancer la passe de la torche quand fx.torch===false.
- **Extensions** : cœur WebGL2, plus EXT_depth_clamp et EXT_polygon_offset_clamp facultatifs.
- **Coût estimé en Haut** :
  - filtrage : 0,7 à 0,9 ms sur M5 en 1440p natif, ×0,45 en TAAU 0,67 ; ÷2 à ÷3 sur RTX ;
  - rendu des cascades : à mesurer au chrono sur D.
- **Taille** : environ 6 à 10 Ko.

**Critère d'acceptation.** - **Stabilité** : en déplaçant la caméra d'une fraction de texel, les contours d'ombre ne bougent pas (différence temporelle < 1/255 hors pénombre).
- **Coutures et portée** : aucune couture visible entre cascades sur la capture D ; ombres jusqu'à 300 m dans BITUME.
- **Torche** : avec torch:false, stats.shadowMaps passe de 2 à 1 sur D, en classique comme en photo.
- **Chrono** : ombres ≤ 2 ms en Haut sur M5, scène D.

**Risques.** - Rendre les cascades avec 2 600 arbres sans cache coûte cher.
- Sans TAA, la pénombre PCSS est bruitée.
- Les extensions ne sont pas vérifiées sous Windows.

**Contre-vérification.** Lignes vérifiées ; 50 et 151 Mo exacts.
- Sur BITUME, la zone ombrée va d'environ −14 à +78 m autour de la caméra.
- Le correctif de la torche est incomplet ; je l'ai testé : image identique, gain dans le bruit (F05).
- Avec des cascades lointaines statiques, les voitures lointaines perdent leur ombre.

**Correction.** Avec torch:false : sauter la passe, mettre uShadowSettings.z à 0 (L1749) et corriger stats.shadowMaps (L1726). Aucun gain promis.

### PHOTO-08 — Palier 5 : pré-passe profondeur et normale, mips de profondeur, GTAO et ombres de contact
- type proposition · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** L'occlusion ambiante et les ombres de contact font l'essentiel du « posé » photo :
- METAL : coins et encombrement industriels ;
- BITUME : pneus sur la chaussée ;
- PDR : unités au sol.
Sur M5, le GTAO v2 en demi-résolution avec mips de profondeur coûte 0,99-1,22 ms, contre 3,39-6,31 ms pour la version naïve (F10) : les mips sont obligatoires. La pré-passe fournit aussi les normales au SSR.

**Preuve.** ~/Projects/ferro/src/renderer.js:35-39,1390-1397@248043a ; mesures F10 (2026-11-12)

**Proposition.** - **Pré-passe photo** : profondeur D32F, plus une sortie RGB10_A2 qui porte la normale octaédrique (10+10 bits), la rugosité (10 bits) et 2 bits de drapeaux (dynamique, overlay). La vitesse reste écrite par l'opaque (PHOTO-10).
- **Opaque** :
  - GPU à rendu immédiat (NVIDIA, AMD, Intel) : depthFunc EQUAL sans écriture, ce qui supprime la surombre ;
  - GPU à tuiles (Apple) : pré-passe seulement si l'AO ou le SSR l'exigent ;
  - dans les deux cas, même vertex shader, invariant.
- **Mips de profondeur linéaire** : RG16F (min, max), 5 niveaux depuis la demi-résolution.
- **GTAO** :
  - demi-résolution, 2 directions de 6 à 12 pas, tournées à chaque image pour le TAA ;
  - débruitage bilatéral 4×4, puis remontée guidée par la profondeur ;
  - appliqué au diffus indirect et à l'occlusion spéculaire (Lagarde), jamais à la lumière directe.
- **Ombres de contact** : 8 à 16 pas en espace écran vers le soleil et vers la lampe principale, dans l'opaque. Coût estimé 0,2 à 0,4 ms sur M5.
- **Extensions** : EXT_color_buffer_float pour le R16F et le RG16F. RGB10_A2 et les sorties multiples sont du cœur WebGL2.
- **Coût estimé** : RTX 0,4 à 0,7 ms ; GPU intégré faible 2,5 à 5 ms, d'où l'AO coupée en Moyen.
- **Taille** : environ 6 à 8 Ko.

**Critère d'acceptation.** - **Coût** : GTAO ≤ 1,3 ms sur M5 en 2560×1440.
- **Halos** : ≤ 2 px aux discontinuités sur les captures A, B et D.
- **Lumière directe** : un sol au soleil contre un mur garde sa luminance à ±2 %, AO activée ou non.
- **Pré-passe en EQUAL** : effet chiffré au chrono de l'opaque sur D, d'abord sur M5, puis sur NVIDIA quand ce sera possible.

**Risques.** - La pré-passe sur 209 000 triangles n'apporte rien sur Apple.
- Le vent de la matière 11 (L35-39) doit être reproduit à l'identique.
- Le test EQUAL échoue si le vertex shader n'est pas invariant.

**Contre-vérification.** « Mips obligatoires » n'est pas établi : la v2 change aussi le format, la résolution, les normales et le débruitage, et ses mips 2 et 3 valent 0.
- Coût oublié : si la pré-passe sort la normale perturbée, elle exécute tout le code des matières (L164-361).
- Sortir plutôt la normale géométrique et la rugosité de table.

### PHOTO-09 — Palier 6 : réflexions en espace écran (hi-Z) et brouillard volumétrique en froxels
- type proposition · priorité P2 · effort L · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Sols mouillés, laque et métal sont des signatures photo de METAL et BITUME. Faisceaux, fumée et brume servent METAL, BITUME et la fumée urbaine de PDR. Le brouillard actuel est exponentiel et borné à 0,86 (L424-427). Mesures sur M5 (F10) :
- SSR en demi-résolution, 32+6 pas : 0,52-1,54 ms ;
- froxels 160×90×64 rendus couche par couche : 2,1-3,1 ms ;
- mêmes froxels en atlas 2D : 1,16-1,44 ms.

**Preuve.** ~/Projects/ferro/src/renderer.js:424-427@248043a ; mesures F10 (2026-11-12)

**Proposition.** - **SSR** :
  - demi-résolution, marche hi-Z sur les mips min et max, 32 pas puis 6 d'affinage ;
  - source : HDR pré-exposé de l'image précédente, reprojeté avec la vue-projection précédente ;
  - coupure progressive entre rugosité 0,35 et 0,5 ;
  - confiance réduite au bord de l'écran, sur les faces arrière et selon l'épaisseur ;
  - mélangé à l'IBL et aux sondes dans l'opaque ; la porosité mouillée (PHOTO-12) l'alimente.
- **Froxels** :
  - grille 160×90×64 en tranches exponentielles jusqu'à options.brouillard.portee (150 m par défaut) ;
  - rangée en atlas 2D de 8×8 tuiles de 160×90 ;
  - injection : densité (hauteur, bruit, volumes locaux) × diffusion du soleil (lecture des cascades) et des lampes ;
  - intégration d'avant en arrière ;
  - reprojection temporelle à 0,9, ce qui demande un deuxième atlas (2 × 7,4 Mo) ;
  - lus dans l'opaque et dans le ciel.
- **En Moyen** : brouillard de hauteur analytique et perspective aérienne seulement.
- **Extensions** : EXT_color_buffer_float. WebGPU (compute) simplifierait sans être requis.
- **Coût estimé** :
  - RTX : SSR 0,2 à 0,8 ms, froxels 0,4 à 0,7 ms ;
  - GPU intégré faible : effets coupés.
- **Taille** : environ 14 à 18 Ko.

**Critère d'acceptation.** - **Coût** : SSR et froxels ≤ 1,5 ms chacun sur M5, en Haut à 1440p.
- **SSR** : aucun reflet d'un objet situé derrière le réflecteur (test d'épaisseur), aucun NaN.
- **Faisceau** : sur la capture B, la luminance sous une lampe est au moins 1,2 fois celle du volume voisin.
- **Tranches** : aucune bande visible, grâce à une gigue de tranche à chaque image.

**Risques.** - Bords d'écran.
- Vue de haut de PDR : les rayons sortent souvent de l'écran, le bénéfice est faible.
- Petites lampes floues dans les froxels.
- Coût de ×2,5 à ×4 sur GPU intégré.

**Contre-vérification.** L424-427 et la mémoire sont vérifiés.
- Le banc SSR n'utilise ni hi-Z ni rayons divergents : le coût réel sera probablement plus élevé.
- L'avantage de l'atlas tient surtout aux 64 changements de cible et disparaît dans ma réplique sous charge. Il est à remesurer sur NVIDIA.

### PHOTO-10 — Palier 2 : TAA et TAAU maison, vecteurs de mouvement, interface d'amplification au format DLSS
- type exigence · priorité P0 · effort XL · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Le navigateur n'a pas accès au DLSS (F19) ; un TAAU maison est donc le seul amplificateur possible.
- C'est aussi le pilier des autres paliers : AO, SSR et froxels, bruités, convergent dans le temps.
- Il finance le budget : à 67 %, seuls 45 % des pixels sont ombrés.
- Point de départ : FERRO n'a ni gigue, ni vitesse, ni historique (F01), et ses instances n'ont pas d'identité stable : 16 flottants reconstruits à chaque image (L738-756).
- Mesures sur M5 (F10, F12) : TAA 0,82-1,38 ms, TAAU 67 % 0,92-2,42 ms ; le monde coûte environ 0,94 ns par pixel.

**Preuve.** ~/Projects/ferro/src/renderer.js:98-112,738-756,1761,1764-1768@248043a ; mesures F10 et F12 ; ~/Projects/point-de-rupture/Jeu/src/moteur/renderer.js:1449@5ac0066

**Proposition.** - **Gigue** :
  - suite de Halton(2,3) en N = ceil(8·(Waff/Wrendu)²) phases : 8, 18 ou 32 ;
  - décalage dans (−0,5 ; 0,5) pixel de rendu, appliqué à proj[8] et proj[9] (signe fixé par un test) ;
  - matrices non giguées pour la vitesse.
- **Vitesse** :
  - le vertex shader calcule les positions de clip courante et précédente, sans gigue ;
  - le fragment shader écrit v = (ndcPrec−ndcCour)·0,5·tailleRendu en RG16F, en pixels de rendu, précédent moins courant ;
  - id facultatif sur les acteurs : une Map de l'id vers l'instance précédente, dans un second tampon d'instances ;
  - sans id : vitesse de la caméra seule, plus le bit réactif ;
  - vent de la matière 11 recalculé à tempsPrecedent ;
  - overlay (L1761) en espace caméra, avec le bit réactif.
- **Résolution, par pixel d'affichage** :
  - échantillonnage :
    - vitesse prise au plus proche en profondeur sur un voisinage 3×3 ;
    - historique lu en Catmull-Rom à 5 taps ;
    - échantillons courants pondérés par un Lanczos2 approché, en YCoCg, avec le poids 1/(1+luma) ;
  - accumulation :
    - découpe par variance, γ 1,0 en mouvement et 1,25 à l'arrêt ;
    - poids d'accumulation dans l'alpha, α au moins 0,05 ;
    - α relevé par le masque réactif (écrit par les particules en mélange MAX via OES_draw_buffers_indexed), par la désocclusion et par fx.coupure ou un saut de caméra ;
    - correction quand l'exposition change ;
  - finition :
    - affûtage adaptatif au contraste (0,1 à 0,2 ms) ;
    - biais de mip passé dans texture(s, uv, biais), WebGL2 n'ayant pas de LOD_BIAS d'échantillonneur.
  - MSAA coupé en TAA.
- **Interface au format DLSS SR et FSR2** :
  - amplificateur.evaluer({couleur, profondeur, vitesse, gigue, exposition, preExposition, reactif?, transparence?, reinitialiser, tailleRendu, tailleSortie, dt, camera:{near, far, fovY, zInverse}}) → sortie ;
  - implémentations 'taa' et 'taau' ; 'natif' plus tard (PHOTO-16).
- **Extensions** : EXT_color_buffer_float ; OES_draw_buffers_indexed facultatif.
- **Coût estimé** : RTX 0,3 à 1,2 ms ; GPU intégré faible 2,3 à 9,7 ms, donc TAA sans amplification en Moyen.
- **Taille** : environ 10 à 14 Ko.

**Critère d'acceptation.** - **Tests Node** :
  - suite de Halton et nombre de phases ;
  - un point projeté se déplace bien de +gigue ;
  - caméra translatée en +x : vitesse positive sur un objet statique ;
  - fx.coupure vide l'historique.
- **Captures sur file://, M5, 2560×1440** :
  - scène statique après 64 images : différence temporelle moyenne < 0,5/255, à 100 % comme à 67 % ;
  - SSIM face à une référence suréchantillonnée 16× : ≥ 0,97 à 100 % et ≥ 0,93 à 67 % (cibles à calibrer) ;
  - cube traversant à 20 px par image : traînée < 2 % de l'énergie après 4 images ;
  - façades PDR : moins de scintillement qu'en MSAA×4.
- **Coût** : TAA ≤ 1,4 ms et TAAU ≤ 2,5 ms sur M5. Scène B en TAAU 0,67 sans autre effet : au plus 0,8 × le classique natif (11,7 ms).

**Risques.** - Flou et traînées sur les petites unités de PDR (qui exige le MSAA, L1449) et sur les arbres de BITUME à grande vitesse.
- Sans id, les objets animés sont traités en réactif et paraissent moins nets.
- Les motifs procéduraux sont filtrés à la résolution de rendu (L98-112) : le TAAU ne retrouve pas leur détail sans ajuster ce filtrage.

**Contre-vérification.** Lignes vérifiées ; N≈18 exact ; WebGL 2 n'a pas de LOD_BIAS.
- Le critère B ≤ 0,8×11,7 ms est fragile : environ 4 ms d'ombres et de bloom ne dépendent presque pas de la résolution (F12).
- Foule PDR (100 000 unités) : la vitesse doit venir de son shader.

**Correction.** Critère B à fixer après la décomposition au chrono, par mesure A/B entrelacée.

### PHOTO-11 — Palier 7 : flou de mouvement et profondeur de champ
- type proposition · priorité P2 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Usages par jeu :
- BITUME : vitesse et caméra de télévision au téléobjectif (FOV de 10° admis, renderer.js:4-5) ;
- METAL : visée ;
- PDR : effet miniature, en option artistique.
Mesures sur M5 (F10) : flou de mouvement à tuiles 16 et 12 taps, 1,39-2,18 ms ; profondeur de champ en demi-résolution à 24 taps, 1,10-1,54 ms. Les deux reposent sur la vitesse et la profondeur des paliers 2 et 5.

**Preuve.** ~/Projects/ferro/src/renderer.js:4-5@248043a ; mesures F10 (2026-11-12)

**Proposition.** - **Flou de mouvement (McGuire 2012)** :
  - maximum par tuile de 16×16, borné à 32 px ;
  - maximum du voisinage 3×3, collecte de 12 taps ;
  - obturateur à 180° ;
  - options.flou {camera:0..1, objets:0..1} : par exemple camera 0,3 dans METAL pour le confort, 1 dans BITUME ;
  - overlay exclu par son drapeau.
- **Profondeur de champ** :
  - collecte en demi-résolution, 24 taps ;
  - cercle de confusion physique : focale tirée du FOV, ouverture, mise au point donnée par le jeu ou par une sonde au centre ;
  - mode miniature (bande nette) pour PDR.
- **En Moyen** : les deux sont coupés.
- **Extensions** : cœur WebGL2.
- **Coût estimé sur RTX** : 0,5 à 1,1 ms pour le flou, 0,4 à 0,8 ms pour la profondeur de champ.
- **Taille** : environ 9 à 13 Ko.

**Critère d'acceptation.** - Avec une vitesse nulle et une mise au point à l'infini, la sortie est identique à l'entrée au bit près.
- Coûts sur M5 : ≤ 2,2 ms pour le flou, ≤ 1,6 ms pour la profondeur de champ.
- Aucune fuite sur l'arme ni sur le cockpit.

**Risques.** - Le flou de caméra peut gêner en FPS.
- Artefacts aux bords des objets rapides.
- Dépend d'une vitesse correcte, donc d'id fournis par les jeux.

**Contre-vérification.** L4-5 vérifiés ; les mesures valent sous les réserves de F10.
L'identité au bit près à vitesse nulle demande un court-circuit : si la vitesse maximale de la tuile est sous 0,5 px, copier l'image.

### PHOTO-12 — Matières PBR en données et couches : vernis, paillettes, mouillé, métal usé, béton, verre ; cuisson facultative
- type proposition · priorité P1 · effort L · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Les 19 matières sont écrites en code (L177-332), avec teinte d'instance et usure des arêtes (L333-348). Un jeu ne peut pas en ajouter sans toucher src/, ce que la règle de FERRO interdit (AGENTS.md:8). Besoins par jeu :
- BITUME : une laque vernie (FEUILLE-DE-ROUTE:233) ;
- PDR : des façades et des toits ;
- METAL : du métal usé et du béton mouillé.

**Preuve.** ~/Projects/ferro/src/renderer.js:104-112,177-348@248043a ; ~/Projects/ferro/AGENTS.md:8@248043a ; ~/Projects/bitume/FEUILLE-DE-ROUTE.md:233@39b3214 ; F08 (anisotropie 16)

**Proposition.** - **Table d'UBO** (PHOTO-03) : les matières 0 à 18 y reçoivent des valeurs proches de leur aspect classique.
- **Couches** :
  - vernis : second lobe GGX (vernisRugosite 0,03, f0 0,04), qui atténue le lobe de base ;
  - paillettes : normales hachées par cellule, stables sous TAA ;
  - mouillé : fx.pluie (0 à 1) × porosité assombrit l'albédo, ramène la rugosité vers 0,05-0,1 et creuse des flaques de bruit sur les faces horizontales (n.y > 0,9), reprises par le SSR ;
  - métal usé : l'usure des arêtes (L337-348) pilote le métal et la rugosité ;
  - béton et asphalte : relief borné (reliefNormal, L104-112) ;
  - verre : réfraction en lisant la copie HDR de l'opaque, 0,1 à 0,3 ms estimés.
- **Cuisson facultative** au chargement, en Haut et au-dessus, après mesure :
  - motifs cuits en TEXTURE_2D_ARRAY (albédo et rugosité, normale et AO) ;
  - 256², soit environ 13 Mo pour 19 matières, ou 512², environ 51 Mo ;
  - mips, anisotropie 16, placage par boîte ou triplanaire ;
  - moins de calcul et moins de scintillement.
- **Extensions** : EXT_texture_filter_anisotropic facultative, cœur WebGL2.
- **Taille** : environ 10 à 20 Ko.

**Critère d'acceptation.** - Un jeu ajoute une matière 19 par options.matieres, sans toucher src/.
- Une voiture vernie au soleil montre ses deux lobes.
- Avec fx.pluie de 0 à 1, la rugosité moyenne de la chaussée tombe à 0,15 au plus et le SSR apparaît.
- La cuisson fait baisser le chrono de l'opaque sur A, sinon elle est abandonnée.
- Chaque matière sans motif passe le four blanc de PHOTO-05.

**Risques.** - Mémoire des textures cuites sur GPU intégré.
- Aspect actuel des matières à retrouver.
- Paillettes instables en TAAU.

**Contre-vérification.** Lignes vérifiées ; 19 matières (README.md:11 dit encore « 0 à 12 »). 13 Mo exact.
- AGENTS.md:8 n'interdit pas à un jeu de retoucher sa propre copie.
- Cuisson permise (AGENTS.md:5-6), mais les bruits ne sont pas périodiques : la répétition se verra.

### PHOTO-13 — Lumières en grappes (forward+) et décalques procéduraux
- type proposition · priorité P2 · effort L · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** La boucle fixe de 12 lumières (L371-382) et les 16 lumières transitoires au plus, retenues par score (L717-730), brident :
- METAL : tirs, explosions, lampes ;
- PDR la nuit : lampadaires, incendies.
Sur B, 16 lampes donnent 10,8-12,2 ms, dont environ 4 ms d'ombres et de bloom (F11, F12). Il n'existe aucun décalque pour les impacts, brûlures, traces de freinage ou marquages.

**Preuve.** ~/Projects/ferro/src/renderer.js:371-382,717-730@248043a ; mesures F11 (B défaut contre B sans ombres ni bloom)

**Proposition.** - **Grappes** : découpage 16×9×24, tranches exponentielles en profondeur.
- **Lumières** :
  - jusqu'à 256, dans un UBO de 8 Ko (2 vec4 chacune ; les cônes dans un bloc à part) ;
  - indices rangés dans une texture R16UI ;
  - répartition faite par le CPU à chaque image, par lumière, sur la plage de grappes que couvre sa sphère ; moins de 0,2 ms estimé pour 64 lumières.
- **Décalques** :
  - 128 boîtes orientées dans un UBO séparé (64 octets chacune, 8 Ko) ;
  - motifs procéduraux (impact, brûlure, trace, bande, fissure) ou petit atlas ;
  - appliqués dans l'opaque avant l'éclairage, sur l'albédo, la rugosité et la normale ;
  - API r.decalque({p, taille, orientation, motif, couleur, duree}), durée de vie gérée par FERRO.
- **Extensions** : cœur WebGL2 (textures entières, UBO).
- **Taille** : environ 10 à 15 Ko.

**Critère d'acceptation.** - Scène B avec 64 lampes : chrono de l'opaque au plus égal à celui de la boucle fixe actuelle avec 16 lampes.
- Répartition : au plus 0,3 ms CPU par image.
- 128 décalques affichés sans perte d'images.
- Test simulé : chaque bloc reste sous MAX_UNIFORM_BLOCK_SIZE.

**Risques.** - Coût CPU en JavaScript avec de grandes lumières.
- Décalques sur objets dynamiques exclus en v1.
- Les lumières transitoires peuvent diverger entre classique et photo.

**Contre-vérification.** L371-382 vérifiés.
- L717-730 examine au plus 16 sources, mais draw n'en retient que 3 (2 en low, L1718), dans un total de 12 lumières (6 en low, L1719).
- B : 16 lampes posées, 12 éclairées.
- Décalques : l'atlas doit être généré par le code.

**Correction.** Limite actuelle : 3 lumières transitoires et 12 au total par image.

### PHOTO-14 — Presets Bas/Moyen/Haut/Ultra, détection par nom de GPU puis temps GPU mesuré, échelle dynamique, garde-fous mobiles
- type exigence · priorité P0 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Le gouverneur actuel se règle sur le temps CPU fourni par le jeu, avec des seuils fixes (F06), et rien ne lit le nom du GPU ni son temps. Il faut pourtant exploiter une RTX en 1440p tout en protégeant les GPU intégrés et les mobiles. BITUME n'a aucun banc mobile (FEUILLE-DE-ROUTE:345), et le chrono de Metal inclut l'attente en file (F14).

**Preuve.** ~/Projects/ferro/src/renderer.js:806-824,1539-1552@248043a ; ~/Projects/bitume/FEUILLE-DE-ROUTE.md:345@39b3214 ; ~/Projects/point-de-rupture/Jeu/verifications/banc-rendu.py:17-18@5ac0066 ; F08 et F09 (noms GPU lus)

**Proposition.** - **Contenu des presets** :
  - Bas : chemin classique v0.2.
  - Moyen (≤ 128 Mo) :
    - R11G11B10 ;
    - TAA, ou TAAU 0,77 au-delà de 2 Mpx ;
    - 2 cascades de 1024 en PCF 4 ;
    - SH9 et cubemap 64² ;
    - brouillard de hauteur, bloom 5 niveaux ;
    - ni AO, ni SSR, ni flou, ni profondeur de champ.
  - Haut (≤ 256 Mo) :
    - RGBA16F ;
    - TAAU 0,67 à 1 ;
    - 3 cascades de 2048 en Vogel 8, 4 lampes ombrées ;
    - GTAO, SSR en demi-résolution, froxels, sondes ;
    - flou et profondeur de champ selon le jeu.
  - Ultra (≤ 512 Mo) :
    - 4 cascades de 3072 en PCSS, 8 lampes ombrées ;
    - ombres de contact ;
    - froxels ombrés par les lampes ;
    - TAAU 0,77 à 1.
- **Détection, étape 1 : garde-fous**
  - Sans EXT_color_buffer_float, ou en rendu logiciel : Bas.
  - Mobile (maxTouchPoints > 0 et pointer:coarse, Android/iPhone/iPad, ou GPU Mali/Adreno/PowerVR) : Moyen au plus, ≤ 1 Mpx rendu, DPR ≤ 1,5, ≤ 64 Mo.
  - deviceMemory ≤ 4 : Moyen au plus.
- **Détection, étape 2 : a priori**, par expressions régulières sur UNMASKED_RENDERER_WEBGL, ou sur adapter.info si navigator.gpu répond en 300 ms :
  - RTX xx70 et plus, RX 7800 et plus, Apple M Pro ou Max : Ultra ;
  - RTX xx50 et xx60, GTX 16, RX 6600 à 7700, Apple M de base, Arc A7 : Haut ;
  - GTX 10, Radeon 780M et 890M, Arc 140V : Moyen ;
  - Intel UHD et Iris Xe : Bas ;
  - GPU inconnu : Moyen.
- **Détection, étape 3 : calibration** sur 60 images, médiane des 30 dernières du chrono.
  - Au-dessus de 1,15 × budget : un cran en dessous.
  - Sous 0,5 × budget : un seul essai un cran au-dessus.
- **Budget** : options.cibleMs. En 'auto', 0,85 × la médiane de l'intervalle rAF sur 120 images (14,2 ms à 60 Hz, 7,1 ms à 120 Hz), plancher 6 ms. Le jeu peut imposer 60 Hz, par exemple PDR.
- **Échelle dynamique**, toutes les 0,5 s :
  - s ← s·√(budget/gpu), pas borné à −0,1 et +0,05 ;
  - montée seulement si le GPU reste sous 0,8 × budget pendant 2 s ;
  - plage [0,5 ; 1] en TAAU, [0,65 ; 1] sinon ;
  - seul le viewport change.
- **Changement de preset** :
  - descente si s est au minimum et le GPU au-dessus du budget pendant 3 s ;
  - montée si s = 1 et le GPU sous 0,55 × budget pendant 10 s ;
  - au moins 10 s entre deux changements, au plus 2 montées par session ;
  - le jeu est prévenu par r.onPreset(ancien, nouveau, raison) et mémorise lui-même le choix.
- **Replis** :
  - sans chrono, ou si le chrono dépasse durablement 1,2 × l'intervalle rAF : décision sur le temps d'image, par minimum glissant ;
  - après une perte de contexte : un cran en dessous.
- **Extensions** : WEBGL_debug_renderer_info, EXT_disjoint_timer_query_webgl2.
- **Taille** : environ 5 à 7 Ko.

**Critère d'acceptation.** - **Tests Node sur traces synthétiques** : palier de 20 à 10 ms, bruit ±20 %, pics isolés de 50 ms.
  - Convergence en moins de 3 s.
  - Au plus un changement de preset par 10 s.
  - Échelle toujours dans sa plage.
  - Aucun changement provoqué par un pic isolé.
- **Garde-fou mobile** : un GPU Adreno avec 5 points tactiles donne Moyen au plus.
- **Banc M5, 2560×1440, scènes A à D** : preset et échelle consignés, p95 ≤ 1,1 × budget après 5 s.
- **PC NVIDIA** : même mesure consignée dans VERSIONS.md.

**Risques.** - Noms de GPU masqués : Firefox, ou « Apple GPU » sous Safari.
- Portables Optimus, où Chrome rend sur le GPU intégré.
- Oscillation si le budget est mal estimé.
- Un preset qui change en pleine partie surprend le joueur.

**Contre-vérification.** Lignes vérifiées ; budgets de 14,2 et 7,1 ms exacts.
- frameMs est un intervalle d'image, pas un temps CPU (F06).
- Oubli : le plafond de 1,8 Mpx en 'auto' et l'absence de plafond en 'high' (PHOTO-V5).
- powerPreference:'high-performance' est déjà demandé (L1353).

### PHOTO-15 — Points d'accroche v2 : passes externes en HDR avec vitesse (foule PDR) et vues secondaires (rétroviseurs BITUME)
- type exigence · priorité P1 · effort M · jeux FERRO, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** La foule de PDR recopie l'éclairage et la sortie du monde, puis écrit de la couleur finale en RGBA8 (F15). En photo, elle serait tonemappée deux fois et sans vitesse, donc pleine de traînées en TAA. FERRO n'a pas repris cette bibliothèque (VERSIONS.md:29). BITUME prévoit des rétroviseurs de 512×128 à 110°, rafraîchis à 30 Hz pour au plus 1,5 ms GPU (FEUILLE-DE-ROUTE:76-80).

**Preuve.** ~/Projects/point-de-rupture/Jeu/src/moteur/renderer.js:555-632,1418,1449@5ac0066 ; ~/Projects/point-de-rupture/Jeu/src/moteur/PROVENANCE.md:35-54@5ac0066 ; ~/Projects/ferro/VERSIONS.md:29@248043a ; ~/Projects/bitume/FEUILLE-DE-ROUTE.md:76-80@39b3214

**Proposition.** - **Passes externes** : fx.passes = [{nom, phase:'ombre'|'opaque'|'transparent', dessiner(gl, ctx)}]. Le contexte ctx fournit :
  - ctx.glsl.commun : l'UBO Image en binding 0 (vue, proj avec et sans gigue, vueProjPrecedente, gigue, preExposition, soleil, brouillard) ;
  - ctx.glsl.eclairage : ferroEclairer(position, normale, matiere), avec la même BRDF, les mêmes cascades et les mêmes grappes ;
  - ctx.glsl.sortie : ferroSortie(hdr, ndcPrecedent), qui écrit location0 en HDR pré-exposé, location1 la vitesse et location2 le masque réactif ;
  - ctx.cibles et ctx.ombre.
- **Passe finale** : brouillard, tonemap et vignette restent faits par FERRO.
- **Classique** : fx.foule et renderer.pdr restent tels quels.
- **Vues secondaires** : r.vue(nom, {largeur, hauteur, camera, frequence}).
  - Graphe réduit : pas de TAA, exposition reprise de la vue principale, cascades réutilisées, ni SSR ni froxels.
  - Sortie en RGBA8, composée dans un rectangle d'écran par la passe finale (v1), ou lue par une matière « miroir » (v2).
- **Taille** : environ 4 à 6 Ko.

**Critère d'acceptation.** - Un exemple dans banc/ dessine une foule de 10 000 instances via fx.passes.
  - Éclairage : écart ≤ 2/255 avec un cube identique dessiné par FERRO.
  - Mouvement : pas de traînée au test de PHOTO-10.
- Un rétroviseur de 512×128 coûte au plus 1,5 ms au chrono sur M5.
- Sans fx.passes, le flux de commandes est identique.

**Risques.** - PDR doit réécrire ses shaders de foule.
- Le GLSL exposé devient un contrat à versionner ; renderer.pdr.generation existe déjà.
- Une seconde vue coûte cher sur GPU intégré.

**Contre-vérification.** Lignes vérifiées.
- Il manque une phase finale pour le voile de PDR (PHOTO-V2).
- fx.lots et setLots sont à unifier (VERSIONS.md:30-31).
- Une vue secondaire oblige à découper draw() et à couper vignette, blessure et onde (L430-437).

### PHOTO-16 — Décision : DLSS hors navigateur ; amplificateur maison au format DLSS maintenant, WebGPU ensuite, natif seulement sur décision de David
- type décision-à-prendre · priorité P0 · effort XL · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** David veut tirer parti du « DLSS 5 » sur NVIDIA. Les obstacles :
- aucune version de DLSS n'est exposée à WebGL2 ni à WebGPU (F19, probable, à confirmer par l'axe NVIDIA) ;
- FERRO se compose de scripts autonomes sans compilation (AGENTS.md:13) ;
- les jeux sont des pages uniques à budget fixe (F17) ;
- la génération d'images est hors de portée.

**Preuve.** ~/Projects/ferro/AGENTS.md:13@248043a ; F19 et F20 (https://github.com/NVIDIA/DLSS, non consulté le 2026-11-12) ; F09 (fonctionnalités WebGPU vérifiées sur M5)

**Proposition.** - **Option A, recommandée maintenant** : le TAAU maison (PHOTO-10), dont l'interface reprend les entrées de DLSS SR.
  - Dans le navigateur, les vrais leviers d'une NVIDIA sont la résolution et le filtrage Ultra (cascades, PCSS), les froxels et le traçage analytique (PHOTO-19).
- **Option B, après le palier 6** : un backend WebGPU derrière le même graphe.
  - Il apporte le compute (froxels, histogramme, GTAO, grappes), l'horodatage et la sortie HDR d'écran.
  - Les shaders WGSL s'écrivent à la main, ce qui coûte cher.
- **Option C, seulement si David accepte une application hors navigateur** : une coquille native (Dawn ou wgpu sur D3D12, avec Streamline) alimentée par les mêmes entrées.
  - Elle rompt la règle des pages autonomes.

**Critère d'acceptation.** - Une décision écrite de David (A seule, A puis B, ou A, B et C) est inscrite dans VERSIONS.md et dans les feuilles de route des jeux.
- L'axe NVIDIA a confirmé l'absence d'API DLSS sur le web et la version de DLSS visée.

**Risques.** - Annoncer « DLSS » dans un navigateur serait faux.
- Une application native double la chaîne de livraison et de tests.
- Commencer WebGPU trop tôt retarde les paliers visibles.

**Contre-vérification.** AGENTS.md:13 vérifié ; DLSS absent du web reste non relu (F19).
- La 5090 de David est sous Linux : l'option C passerait par Vulkan et NGX, pas par D3D12 et Streamline (à confirmer par l'axe NVIDIA).
- La génération d'images est impraticable plutôt qu'impossible.

### PHOTO-17 — Décision : place du photoréalisme dans BITUME, PDR et METAL, et critères de capture
- type décision-à-prendre · priorité P0 · effort S · jeux METAL, BITUME, PDR
- contre-vérification : **confirmé**

**Pourquoi.** La feuille de route de BITUME vise la lisibilité, « pas le photoréalisme » (FEUILLE-DE-ROUTE.md:31-32), alors que la demande du jour veut un moteur photoréaliste pour BITUME et PDR. La contradiction est signalée ici sans réécrire l'archive. Les critères des jeux supposent la courbe actuelle :
- chaussée de gris moyen < 64/255 et d'écart-type < 6/255 (L203) ;
- 60 i/s en MSAA×4 (L283) ;
- p95 ≤ 16,7 ms (L85).
PDR a adouci la vignette et relevé le seuil du bloom pour rester lisible (PROVENANCE.md:22-23).

**Preuve.** ~/Projects/bitume/FEUILLE-DE-ROUTE.md:31-32,85,203,283@39b3214 ; ~/Projects/point-de-rupture/Jeu/src/moteur/PROVENANCE.md:22-23@5ac0066

**Proposition.** - **Choix de rendu** : le photo devient une option du jeu (menu « Rendu : classique ou photo »), en 'auto' sur les PC à GPU dédié et en classique ailleurs.
- **Critères de capture** : réécrits avec une exposition fixe et un tonemap déclaré.
- **Migration** : le tonemap 'ferro' garde l'identité visuelle pendant la transition.
- **PDR** : exposition à bornes étroites et lisibilité des unités d'abord, avec un rehaut facultatif dans la passe finale.

**Critère d'acceptation.** - David tranche pour chaque jeu : photo par défaut ou en option, tonemap par défaut, critères à réécrire.
- La feuille de route de BITUME reçoit une nouvelle entrée datée, sans effacer l'ancienne.

**Risques.** - Sans décision, les couleurs seront réglées deux fois.
- Les captures et les bancs actuels deviennent caducs.

**Contre-vérification.** La contradiction est réelle : la feuille de route (FDR:31-32, écrite le 12/11 dans e3bcb6b) contre la demande du jour.
- La demande explicite de David prime (CLAUDE.md), mais « un jeu photoréaliste » reste ambigu : il faut une décision.
- L283 est un constat.

### PHOTO-18 — Tests : GL simulé enrichi, captures mesurées sans interface sur file://, chrono GPU par passe, protocole NVIDIA
- type exigence · priorité P0 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **confirmé**

**Pourquoi.** Le GL simulé de FERRO renvoie null pour toute méthode inconnue (F07) : il ne peut tester que le repli. METAL n'a aucune mesure sur GPU physique (F18). PDR possède un banc par tube sans port (F14). Sur Apple, un micro-banc qui ne force aucune dépendance mesure du vide (F13).

**Preuve.** ~/Projects/ferro/checks/renderer-reprises.test.mjs:24-35,70-75@248043a ; VALIDATION.md:184@673d6b2 ; ~/Projects/point-de-rupture/Jeu/verifications/banc-rendu.py:10-18,334-347,505-516@5ac0066 ; bancs/../wf2/photo/banc/passes.html et renderer.html (2026-11-12)

**Proposition.** 1. **checks/photo.test.mjs**, avec gpu({extensions, limites, echecFbo, chrono}) :
   - le simulateur fournit des objets d'extension avec leurs constantes, getSupportedExtensions, un getParameter étendu, un checkFramebufferStatus réglable et des requêtes de temps simulées ;
   - tests :
     - repli et budget mémoire ;
     - instantané du graphe et des ressources par preset ;
     - gigue et vitesse ;
     - gouverneur sur traces ;
     - table DFG, std140 ;
   - aucune compilation GLSL sous Node.
2. **banc/photo.html**, ouvert en file:// par Chrome sans interface :
   - lancement : --dump-dom ou --remote-debugging-pipe, profil jetable, --host-resolver-rules=MAP * ~NOTFOUND ;
   - scènes A (banc), B (intérieur METAL), C (ville PDR), D (circuit BITUME) ;
   - mesures calculées dans la page par readPixels et écrites en JSON : écrêtage, bandes, scintillement, traînées, SSIM face à une référence 16×, NaN, erreurs de compilation ;
   - captures par --screenshot ;
   - fx.time et graines fixés.
3. **banc/passes.html**, repris du scratchpad :
   - chrono TIME_ELAPSED par passe, plus le total synchronisé (cibles alternées, passe 1×1 dépendante, readPixels) ;
   - 5 répétitions, minimum et médiane.
4. **Protocole NVIDIA** : mêmes pages sur le PC Windows (Chrome, ANGLE D3D11). Résultats datés dans VERSIONS.md, avec nom du GPU, pilote et résolution.

Aucun serveur, aucun port.

**Critère d'acceptation.** - npm test passe avec les nouveaux tests.
- Une commande documentée lance les deux bancs sur le Mac et rend un JSON par scène et par preset.
- Les seuils de PHOTO-04 à PHOTO-14 sont vérifiés automatiquement.
- Aucun gain n'est annoncé avant qu'un tableau M5 et un tableau NVIDIA réel soient consignés.

**Risques.** - Sans interface, DPR 1 et pas de vsync : on mesure un débit, pas la fluidité.
- Sous Metal, le chrono inclut l'attente en file.
- Le temps réel rend les captures non déterministes s'il n'est pas fixé.

**Contre-vérification.** Lignes vérifiées. Le banc en file://, sans port, fonctionne : je l'ai rejoué.
Corrections :
- F18 se cite en VALIDATION.md:44 et :52.
- Protocole NVIDIA : Linux sur la 5090 (pas de D3D11), Windows sur le portable 5060 (PHOTO-V3).
- Mesures A/B entrelacées, charge consignée (PHOTO-V4).
- Corriger le GTAO v2.

### PHOTO-19 — Ultra expérimental : traçage analytique des primitives FERRO (AO et ombres douces à grande échelle)
- type proposition · priorité P3 · effort XL · jeux FERRO, METAL, PDR, BITUME
- contre-vérification : **plausible**

**Pourquoi.** Ni WebGL2 ni WebGPU n'offrent de lancer de rayons matériel. La puissance d'une RTX se traduit donc seulement en calcul brut. Or le monde FERRO est fait de primitives analytiques : box, sphere, cylinder, octa, ring, bevel, foliage (L622-704), en instances de 64 octets (L751). Il permet des rayons exacts contre une BVH de boîtes orientées, sans maillage. C'est une hypothèse, non mesurée.

**Preuve.** ~/Projects/ferro/src/renderer.js:622-704,738-756@248043a ; scènes C (4 000 façades) et D (5 200 primitives) de bancs/../wf2/photo/banc/renderer.html

**Proposition.** - **BVH** : construite par le CPU au setWorld à partir des primitives statiques, rangée dans une texture RGBA32F.
- **Passe en demi-résolution** :
  - 1 à 2 rayons par pixel, pile de 24 nœuds ;
  - intersections rayon-boîte orientée et rayon-cylindre ;
  - usages : AO de 2 à 8 m, ombre douce d'un soleil étendu ;
  - accumulation par le TAA.
- **Repli** : GTAO et PCSS.
- **Méthode** : prototype dans banc/ avant toute intégration.
- **Extensions** : cœur WebGL2.

**Critère d'acceptation.** - Sur la scène C en demi-résolution 1440p : ≤ 3 ms sur une RTX de milieu de gamme et ≤ 6 ms sur M5.
- Gain jugé sur captures face au GTAO et au PCSS ; sinon l'abandon est consigné.

**Risques.** - Les nappes et les objets dynamiques restent hors BVH.
- Rayons divergents.
- Mémoire au-delà de 10 000 primitives.
- Reconstruction coûteuse quand METAL détruit des objets.

**Contre-vérification.** Vérifiés : L621 (7 formes) et L751 (64 o).
- Le décor de BITUME passe par setLots : la BVH doit l'inclure.
- Une pile dynamique est permise en GLSL ES 3.00.
- Rien n'est mesuré ; la priorité P3 est raisonnable.

### PHOTO-20 — Risque : compilation et poids du shader photo sous ANGLE D3D11 (Windows NVIDIA)
- type risque · priorité P1 · effort S · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Le shader du monde est déjà lourd : 19 matières, boucle de 12 lumières, ombres (L53-439). Le photo y ajoute BRDF, cascades, grappes, brouillard et couches. Sous Windows, ANGLE traduit le GLSL en HLSL compilé par D3D, et les gros shaders aux boucles déroulées peuvent prendre plusieurs secondes. C'est probable mais non mesuré, faute de machine Windows. La pression sur les registres réduit aussi l'occupation du GPU.

**Preuve.** ~/Projects/ferro/src/renderer.js:53-439,371-382@248043a ; F08 (KHR_parallel_shader_compile présent sur M5, non vérifié sous Windows)

**Proposition.** - Variantes par #define selon le preset, en ne compilant que celles du preset courant.
- Compilation asynchrone (KHR_parallel_shader_compile, COMPLETION_STATUS_KHR) pendant que le classique rend.
- Boucles de lumières bornées par les grappes, jamais déroulées.
- Temps de compilation par variante dans stats.compilation.

**Critère d'acceptation.** - PC NVIDIA : au plus 1 s de compilation par variante, sans aucune image au-delà de 50 ms.
- M5 : au plus 300 ms par variante.

**Risques.** Sans ces précautions, la machine visée par le palier photo gèle plusieurs secondes au lancement ou à chaque changement de preset.

**Contre-vérification.** L53-439 vérifiés ; la v0.2 compile en bloquant (L1369-1378, L1434).
- Le risque D3D11 concerne le portable et les joueurs sous Windows ; la 5090 passe par OpenGL ou Vulkan sous Linux.
- Le cache de Chrome atténue les lancements suivants.

## Ajouts du contre-vérificateur

### PHOTO-V1 — Ciel dessiné après l'opaque, dès le chemin classique : 2,2 à 3,7 ms gagnées en 1440p sur M5 à image identique
- type proposition · priorité P1 · effort S · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** skyPass coupe le test de profondeur et ombre tout l'écran avant le monde (L1623-1630, appelé en L1741). Chaque pixel paie 4 octaves de bruit et deux crêtes (L531-548), même s'il est caché.

Banc A/B entrelacé (6×30 images, msaa4 et atlas ×2, 2560×1440, M5, 3 sessions) :
- C, vue de haut où le ciel est caché : médianes 11,3→8,6, 21,3→17,6 et 14,6→12,4 ms ; p10 de −2,3 à −3,0 ms ; 0 pixel différent ;
- D sans ciel : 10,6→8,8, 20,8→15,5 et 13,7→10,6 ms, ce qui borne le gain par le haut.

**Preuve.** ~/Projects/ferro/src/renderer.js:531-551,1623-1630,1741-1758@248043a (lu dans un clone) ; bancs/../wf2/photo-cv/banc/variantes.html, variantes-m5-1.json à variantes-m5-3.json et charge.txt (2026-11-12)

**Proposition.** - **Vertex shader du ciel** : gl_Position=vec4(p*2.-1.,1.,1.).
- **Ordre** : le ciel passe après la foule. On active DEPTH_TEST, avec depthFunc(LEQUAL), depthMask(false) et CULL_FACE coupé. Particules et overlay ne bougent pas.
- **Chemin classique** : derrière un réglage de création {cielApres:true}, pour respecter AGENTS.md:10-11. Il devient le défaut en 0.3 seulement si David accepte la rupture, inscrite dans VERSIONS.md.
- **Chemin photo** : par défaut.

**Critère d'acceptation.** - Captures C et D, avec et sans MSAA : 0 pixel différent.
- Gain médian d'au moins 1,5 ms sur C au M5, mesuré en A/B entrelacé ; la mesure est aussi consignée sur NVIDIA.
- npm test : sans le réglage, le flux de commandes reste celui de v0.2.

**Risques.** - La géométrie collée au plan lointain peut entrer en conflit de profondeur avec le ciel.
- Le flux de commandes change, ce qui suppose une décision de rupture.
- Le gain diminue quand le ciel est très visible.

### PHOTO-V2 — Voile du brouillard de guerre de PDR en mode photo : phase finale et aucune fuite
- type exigence · priorité P1 · effort M · jeux FERRO, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** fx.voile assombrit le dehors hors de la vue du joueur, après le gamma et avant le vignettage (PROVENANCE.md:35-37). FERRO ne l'a pas repris (VERSIONS.md:29).

En photo, tonemap et vignette passent en passe finale, et PHOTO-15 n'offre que les phases ombre, opaque et transparent : l'étape où le voile s'applique disparaît. De plus, le bloom, le TAA et le SSR peuvent faire passer de la lumière à travers le voile, ce qui fuit de l'information dans un RTS.

**Preuve.** ~/Projects/point-de-rupture/Jeu/src/moteur/PROVENANCE.md:35-37@5ac0066 ; ~/Projects/ferro/VERSIONS.md:29-31@248043a ; item PHOTO-15 du rapport

**Proposition.** - **Accroche** : fx.finale = {glsl, textures, uniformes}, sans effet si elle est absente. Elle s'exécute après tonemap et sRGB, avant la vignette et après le TAA, avec la position monde reconstruite depuis la profondeur (PHOTO-02).
- **Option** : fx.masqueHdr atténue l'émission sous le voile dans l'opaque.
- **Partage** : le voile reste dans PDR (AGENTS.md:8).

**Critère d'acceptation.** - À EV égale, le rapport de luminance voilé/visible reste à ±5 % de celui du chemin classique.
- Une explosion sous le voile ajoute au plus 1/255 au-delà de 2 px du bord.
- Sans fx.finale, le flux de commandes est inchangé.

**Risques.** - PDR doit porter son shader.
- Reconstruction de la position : environ 0,1 ms, estimé.
- Les bords peuvent scintiller en TAAU.

### PHOTO-V3 — Matrice de qualification NVIDIA : RTX 5090 sous Linux et RTX 5060 Laptop sous Windows
- type décision-à-prendre · priorité P1 · effort S · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** Le rapport suppose partout Windows et ANGLE D3D11 (PHOTO-16, 18 et 20). Les notes KBZA décrivent autre chose :
- david-pc : RTX 5090 sous Linux, écran en 2560×1440, SSH refusé le 18/10 et machine injoignable le 29/10 ;
- portable Windows avec RTX 5060 Laptop, de type hybride.

Sous Linux, Chrome passe par ANGLE sur OpenGL ou Vulkan : la compilation des shaders, EXT_clip_control, le chrono GPU, WebGPU et DLSS y diffèrent.

**Preuve.** KBZA learnings/2026-08-04.md:18 (sha256 87857818…), learnings/2026-10-04-mac.md:101 (sha256 1b9bd14a…), learnings/2026-10-29-mac.md:13 (sha256 6245503a…), tour du 2026-10-18 ; renderer.js:1353@248043a

**Proposition.** - David désigne la machine de référence et confirme son état.
- Sur chaque poste (5090 Linux, 5060 Windows, M5) :
  - relever le backend ANGLE ;
  - sur le portable, forcer Chrome sur la RTX ;
  - lancer la sonde et les bancs en file:// ;
  - écrire un JSON daté : renderer, pilote, backend, résolution, fréquence, charge.
- Revoir l'option C de PHOTO-16 selon le système.

**Critère d'acceptation.** - Trois tableaux dans VERSIONS.md.
- UNMASKED_RENDERER nomme la RTX 5060 et non la puce intégrée.
- La décision de David est écrite.

**Risques.** - Machines injoignables au dernier relevé.
- Une note ne prouve pas l'état présent.
- Liste de blocage GPU de Chrome sous Linux.

### PHOTO-V4 — Mesures prises sur un Mac partagé et chargé, banc GTAO v2 faux : aucun seuil absolu à tirer de ces passages
- type risque · priorité P1 · effort S · jeux FERRO
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** - La charge moyenne était de 147 à 18:58 ; aucun JSON ne la consigne.
- Ma réplique de passes.html donne des temps ×1,2 à ×2 et inverse l'ordre des froxels.
- Le GTAO v2 bâtit ses mips avec BASE=MAX=l−1 et texelFetch(lod=l−1) : les niveaux 2 et 3 valent 0.
- Les seuils « ≤ x ms sur M5 » des items 02 à 14 reposent sur ces passages.

**Preuve.** bancs/../wf2/photo-cv/banc/passes-cv-1.json, texelfetch.html, texelfetch-m5.json, charge.txt (2026-11-12) ; bancs/../wf2/photo/banc/passes.html (pDepthDown, gtao2)

**Proposition.** - **Critères** : rapports A/B entrelacés, au moins 6×30 images, médiane et p10. Les ms absolues seulement sur machine au repos, avec uptime relevé avant et après.
- **Corrections du banc** :
  - texelFetch(s,p,0) avec BASE=MAX=l−1 ;
  - SSR en vraie marche hi-Z sur une profondeur FERRO capturée ;
  - TAAU avec son filtre de reconstruction.
- **JSON** : chaque fichier porte Chrome, renderer, charge et date.

**Critère d'acceptation.** - 3 sessions au repos : moins de 15 % d'écart par passe.
- Le test des mips est juste à chaque niveau.
- Le master prompt ne contient aucun seuil absolu sans son protocole.

**Risques.** - Un poste au repos est difficile à obtenir avec des agents en parallèle.
- Les rapports masquent le coût absolu sur GPU faible.

### PHOTO-V5 — Plafond de pixels : 'auto' bride toute RTX à 1,8 Mpx, 'high' n'a aucune borne
- type proposition · priorité P1 · effort S · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** - resize() borne 'auto' à √(1 800 000/(cssW·cssH)) (L1545), soit une échelle de 0,70 en 2560×1440, quel que soit le GPU.
- La même constante figure dans METAL (L1389), BITUME (L1489) et PDR (L1540), et BITUME démarre en 'auto' (jeu.js:22).
- 'high' prend min(DPR,2) sans aucun budget (L1542).
- C'est le levier NVIDIA le moins cher, et PHOTO-14 ne le traite pas.

**Preuve.** ~/Projects/ferro/src/renderer.js:1539-1552@248043a ; ~/Projects/bitume/src/jeu.js:22,466@39b3214 ; renderer.js:1489@39b3214 (BITUME) ; Jeu/src/moteur/renderer.js:1540@5ac0066 (PDR) ; src/renderer.js:1389@673d6b2 (METAL)

**Proposition.** - **Réglage de création** pixelBudget : un nombre de Mpx, ou 'gpu'. Sans réglage, on garde 1,8 Mpx.
- **Mode 'gpu'** :
  - départ selon la classe de GPU de PHOTO-14 : 1,8 / 2,4 / 3,7 / 8,3 Mpx ;
  - ajustement ensuite par le chrono GPU (PHOTO-02).
- **Statistiques** : stats.pixelBudget.

**Critère d'acceptation.** - Sans réglage, le flux de commandes reste celui de v0.2.
- En 'gpu' sur le M5 en 2560×1440, A rend en natif tant que le GPU reste sous 0,8 du budget, puis redescend en moins de 3 s dans B.
- La résolution native est atteinte et consignée sur NVIDIA.

**Risques.** - Échauffement des portables.
- Sans chrono GPU, rester à 1,8 Mpx.
- Combiner avec l'allocation à l'échelle 1 de PHOTO-03.

## Questions ouvertes

- Quelle carte NVIDIA, dans quelle machine, avec quel écran (résolution, fréquence) et quel navigateur ? Une note KBZA du 04/08/2026 évoque une RTX 5090 en 3840×2160 sur david-pc, et un tour du 21/10/2026 cite un autre PC Windows ; rien n'est vérifié. Peut-on y lancer banc/photo.html et banc/passes.html ?
- « DLSS 5 » : David accepte-t-il une version native hors navigateur (Dawn ou wgpu avec Streamline) pour BITUME et PDR, ou s'en tient-on au web avec le TAAU maison ? Quelle version exacte est visée ? (à confirmer par l'axe NVIDIA)
- BITUME : la feuille de route (FEUILLE-DE-ROUTE.md:31-32) exclut le photoréalisme, la demande du jour le réclame. Quelle décision datée prévaut ? Le photo doit-il être le rendu par défaut sur PC à GPU dédié, ou une option de menu ?
- PDR : faut-il passer au TAA ou au TAAU, ce qui oblige la foule à écrire sa vitesse, ou garder le MSAA×4 pour les lignes fines (renderer.js:1449) ?
- Les jeux peuvent-ils fournir un id stable par acteur dynamique, pour des vecteurs de mouvement exacts ?
- En mode photo, faut-il viser 60 Hz ou la fréquence de l'écran (120 ou 144 Hz) ? Faut-il un budget propre à chaque jeu ?
- La pluie, la nuit et la météo sont-elles prévues dans BITUME, PDR et METAL ? C'est ce qui décide des couches mouillées, du SSR, des phares et de l'éclairage urbain.
- Quel calendrier pour WebGPU : un backend dans FERRO 0.x, ou seulement après le palier 6 ?
- Quel budget mémoire GPU accepter sur portable ? En Haut, les cibles prennent environ 220 Mo à 1440p, plus 13 à 51 Mo de matières cuites.
- Les bancs de capture des jeux (critère de chaussée de BITUME, captures PDR) passent-ils en exposition fixe ?
- Les copies de BITUME et de PDR reprendront-elles le cadre de FERRO, ou chaque copie aura-t-elle sa propre intégration photo ?