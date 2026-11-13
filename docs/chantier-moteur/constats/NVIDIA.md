# Axe NVIDIA — NVIDIA — PC NVIDIA et DLSS 5 : faits vérifiés et options

Écrit quand un dépôt FERRO séparé était encore prévu : lire « FERRO » comme « modules moteur de METAL ». Contre-vérifié.

## Résumé

Axe NVIDIA, état au 12/11/2026.

1) DLSS 5 existe et est livré, mais FERRO ne peut pas s'en servir. NVIDIA l'a annoncé le 16/03/2026. C'est une passe neuronale finale : une image entre, une image sort, de façon déterministe. À partir de la couleur et des vecteurs de mouvement, elle ajoute éclairage et matières, avec des masques et deux intensités réglables (structure, ton). Sorti le 03/09/2026 dans NBA 2K27, il est arrivé dans Hogwarts Legacy le 05/11 ; War Thunder et Where Winds Meet sont annoncés pour novembre. Il ne tourne que sur RTX 50, RTX Spark et GeForce NOW. Son SDK est réservé aux partenaires :
- le Streamline public 2.14.16 (16/10/2026) ne contient qu'une constante, kFeatureDLSS_NR = 1004, sans en-tête ;
- le SDK DLSS 310.9.16 n'a aucune DLL de rendu neuronal.

2) DLSS 4.5 (SR, RR, génération d'images simple et multiple) est public, mais seulement en natif : D3D11, D3D12 ou Vulkan. La licence RTX impose les logos NVIDIA à l'écran de démarrage et de prévenir NVIDIA avant une sortie commerciale. Les DLL pèsent 56 Mio (SR) et 46 Mio (RR).

3) Dans le navigateur, aucune voie ne mène à DLSS. WebGL2 et WebGPU n'exposent ni ressources D3D ou Vulkan, ni cœurs tenseurs (subgroup-matrix est encore un brouillon). Le reste n'aide pas :
- le ticket gpuweb #11088 (04/11/2026) n'est qu'un suivi ;
- RTX Video Super Resolution ne traite que la vidéo ;
- WebNN n'est pas livré ;
- le lancer de rayons WebGPU n'en est qu'aux propositions.

4) Ce qui sert vraiment les PC NVIDIA aujourd'hui se trouve dans FERRO.
- Sous Chrome Windows, powerPreference est ignoré (kEGLDualGPURendering n'est actif que sur macOS) : un portable Optimus reste sur la puce intégrée.
- En mode auto, le canvas est plafonné à 1,8 Mpx et c'est le navigateur qui l'agrandit.
- Le renderer n'a ni HDR linéaire, ni vecteurs de mouvement, ni gigue, ni profondeur échantillonnable.
- Le tonemap, la vignette et les effets d'écran sont calculés dans le shader du monde : FERRO 248043a, et de même BITUME et PDR.

Recommandation : option B.
- D'abord, rendre FERRO « prêt pour un reconstructeur » : un contrat d'image calqué sur les entrées de DLSS et FSR, une reconstruction temporelle maison en WebGL2, la détection d'adaptateur avec un conseil Optimus, et un gouverneur réglé sur le temps GPU. Le tout mesuré sur david-pc.
- Ensuite, un backend WebGPU qui serve de pont vers wgpu ou Dawn natifs.
- Une édition native DLSS 4.5 seulement si David le décide. DLSS 5 uniquement par un accès officiel.

L'option Unreal contredit la décision de David du 12/11/2026 pour PDR (« vire unreal engine, go full mon moteur ferro »). Une contradiction reste à trancher : la feuille de route de BITUME vise « pas le photoréalisme ».

Rien n'a encore été vérifié sur un GPU NVIDIA. Pages inaccessibles pendant l'audit :
- la FAQ DLSS 5 du forum GeForce (écran de chargement) ;
- le ticket Chromium 329211593 (connexion requise) ;
- le banc QuickJS (404) ;
- la licence du SDK AMD FSR (404).

Le guide DLSS (PDF, révision 310.6.0) a été lu en extrayant son texte localement : bancs/../wf2/nvidia/scripts/guide_clean.txt.

## Faits

- **NVIDIA-F01** (vérifié) DLSS 5 (« 3D-Guided Neural Rendering ») n'est pas un upscaler. C'est une passe neuronale finale, une image en entrée et une image en sortie, déterministe, qui ajoute éclairage et matières photoréalistes à l'image du moteur. Les seules entrées nommées par NVIDIA sont la couleur et les vecteurs de mouvement. — _https://www.nvidia.com/en-us/geforce/news/dlss5-breakthrough-in-visual-fidelity-for-games/ (16/03/2026) ; https://www.nvidia.com/en-us/geforce/news/dlss-5-3d-guided-neural-rendering/ (01/09/2026)_
- **NVIDIA-F02** (vérifié) Au 12/11/2026, DLSS 5 est livré dans NBA 2K27 (03/09/2026) et Hogwarts Legacy (05/11/2026). War Thunder est annoncé pour mi-novembre, Where Winds Meet pour le 23/11, et RTX Remix l'a reçu le 23/10. Matériel : RTX 50 (bureau et portables), PC RTX Spark, GeForce NOW Ultimate. Pilote requis au lancement : 616.64. — _https://www.nvidia.com/en-us/geforce/news/dlss-5-3d-guided-neural-rendering/ (01/09/2026) ; https://www.nvidia.com/en-us/geforce/news/dlss-5-faster-ai-model-hogwarts-legacy-rtx-spark-laptops/ (13/10/2026) ; https://www.nvidia.com/en-us/geforce/news/hogwarts-legacy-war-thunder-dlss-5-3d-guided-neural-rendering/ (05/11/2026)_
- **NVIDIA-F03** (vérifié) Matrice officielle NVIDIA :
- DLSS 5 et génération multiple dynamique : RTX 50 seulement ;
- génération d'images : RTX 40 et 50 ;
- Super Resolution, Ray Reconstruction et DLAA : RTX 20 à 50. — _https://www.nvidia.com/en-us/geforce/technologies/dlss/ (consultée le 12/11/2026) ; https://developer.nvidia.com/rtx/dlss (mise à jour octobre 2026)_
- **NVIDIA-F04** (probable) NVIDIA dit vouloir étendre DLSS 5 aux RTX 40 une fois les RTX 50 optimisées, sans date. Rien n'est prévu pour les RTX 30 et plus anciennes. — _Résultats de recherche du 12/11/2026, dont https://www.club386.com/nvidia-confirms-dlss-5-support-for-geforce-rtx-40-series-cards-but-wont-say-when/ (date non relevée) ; https://www.nvidia.com/en-us/geforce/news/hogwarts-legacy-war-thunder-dlss-5-3d-guided-neural-rendering/ (05/11/2026)_
- **NVIDIA-F05** (probable) Le SDK DLSS 5 n'est pas public : il est réservé aux partenaires de NVIDIA, et aucune procédure d'accès n'est publiée pour un moteur maison. — _https://forums.developer.nvidia.com/t/official-dlss-5-neural-rendering-plugin-access-for-unreal-engine-5-8-2/382731 (09/11/2026) ; https://forums.developer.nvidia.com/t/dlss-5-neural-rendering-sdk-access-for-a-custom-windows-engine/384226 (24/09/2026) ; https://forums.developer.nvidia.com/t/dlss-5-sdk-access-request-kessler-syndrome-vulkan-custom-engine/387135 (27/10/2026)_
- **NVIDIA-F06** (vérifié) Les SDK publics ne contiennent pas DLSS 5. Streamline 2.14.16 ne déclare qu'une constante, kFeatureDLSS_NR = 1004, sans en-tête. Le SDK DLSS 310.9.16 ne livre que SR, RR et FG. — _https://api.github.com/repos/NVIDIA-RTX/Streamline/commits ; https://raw.githubusercontent.com/NVIDIA-RTX/Streamline/main/include/sl_core_types.h ; https://api.github.com/repos/NVIDIA/DLSS/contents/lib/Windows_x86_64/rel (consultées le 12/11/2026)_
- **NVIDIA-F07** (vérifié) La page développeurs DLSS (mise à jour en octobre 2026) ne propose aucun téléchargement de DLSS 5. Elle propose DLSS 4.5 :
- paquet SL 2.14.16 / NGX 310.9.16 ;
- plugins Unreal Engine 5.5 à 5.8 (version 8.9.0, binaires ARM64 natifs) ;
- Streamline pour les moteurs maison. — _https://developer.nvidia.com/rtx/dlss (Last Updated: October 2026) ; https://developer.nvidia.com/blog/nvidia-rtx-spark-powers-neural-rendering-and-ai-characters-in-games/ (27/10/2026)_
- **NVIDIA-F08** (vérifié) Le guide de programmation DLSS (révision 310.6.0) fixe les exigences du moteur et les conventions des données d'entrée (détail dans evidence). — _https://github.com/NVIDIA/DLSS/blob/main/doc/DLSS_Programming_Guide_Release.pdf (révision 310.6.0, 31/03/2026 ; texte extrait localement le 12/11/2026)_
- **NVIDIA-F09** (vérifié) Streamline 2.14.16 définit, fonction par fonction, les données à fournir et les modules à livrer (détail dans evidence). — _https://github.com/NVIDIA-RTX/Streamline/blob/main/docs/ProgrammingGuideDLSS.md ; …/ProgrammingGuideDLSS_RR.md ; …/ProgrammingGuideDLSS_G.md ; …/ProgrammingGuide.md (main = 2.14.16, 16/10/2026)_
- **NVIDIA-F10** (vérifié) La licence « NVIDIA RTX SDKs » (v. 14/03/2024) autorise la redistribution du SDK DLSS, avec des obligations (détail dans evidence). — _https://raw.githubusercontent.com/NVIDIA/DLSS/main/LICENSE.txt (v. 14/03/2024, consultée le 12/11/2026) ; https://raw.githubusercontent.com/NVIDIA-RTX/Streamline/main/license.txt_
- **NVIDIA-F11** (vérifié) Une page web ne peut pas utiliser DLSS, ni en WebGL2 ni en WebGPU. DLSS ne prend que des ressources D3D11, D3D12 ou Vulkan créées par l'application (F08), et aucun navigateur ne les expose. Aucune fonction WebGPU ne donne accès à un reconstructeur. — _https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedFeatures (08/10/2026) ; https://github.com/gpuweb/gpuweb/issues/11088 (04/11/2026) ; https://github.com/gpuweb/gpuweb/issues/535_
- **NVIDIA-F12** (vérifié) La seule technique NVIDIA d'agrandissement active dans un navigateur, RTX Video Super Resolution, ne traite que la vidéo diffusée. Elle ne s'applique ni au canvas ni à WebGL. — _https://blogs.nvidia.com/blog/rtx-video-super-resolution/ (28/02/2023) ; https://www.nvidia.com/content/Control-Panel-Help/vLatest/en-us/mergedProjects/nvdsp/Reference_Adjust_Video_Image_Settings.htm (consultée le 12/11/2026) ; https://blogs.nvidia.com/blog/ai-decoded-rtxvideo-firefox/_
- **NVIDIA-F13** (vérifié) État de WebGPU par navigateur et par système au 02/10/2026 (détail dans evidence). — _https://github.com/gpuweb/gpuweb/wiki/Implementation-Status (modifié le 02/10/2026) ; https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/158 ; …/159 ; https://developer.chrome.com/blog/new-in-webgpu-147-148.md.txt (22/04/2026)_
- **NVIDIA-F14** (vérifié) Sous Windows, Chrome ignore powerPreference : WebGL et WebGPU tournent sur l'adaptateur du processus GPU de Chrome, en général la puce intégrée d'un portable. Seul macOS sait placer un contexte sur la carte rapide. — _https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips (17/10/2025) ; https://chromium.googlesource.com/chromium/src/+/main/ui/gl/gl_switches.cc (12/11/2026) ; https://developer.chrome.com/blog/new-in-webgpu-115 ; https://groups.google.com/a/chromium.org/g/graphics-dev/c/2iXXLi9157M (12/08/2023)_
- **NVIDIA-F15** (vérifié) FERRO, BITUME et PDR demandent tous powerPreference:'high-performance'. Sous Chrome Windows, ce réglage ne fait pas passer un portable Optimus sur la carte NVIDIA (F14). — _~/Projects/ferro (248043a), ~/Projects/bitume (e3bcb6b), ~/Projects/point-de-rupture (5ac0066)_
- **NVIDIA-F16** (vérifié) On peut reconnaître une carte NVIDIA localement, sans réseau, mais pas toujours (détail dans evidence). — _https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info (30/10/2026) ; https://bugzilla.mozilla.org/show_bug.cgi?id=1916271 ; https://developer.mozilla.org/en-US/docs/Web/API/GPUAdapterInfo (20/10/2025) ; https://raw.githubusercontent.com/google/dawn/main/src/dawn/gpu_info.json (12/11/2026)_
- **NVIDIA-F17** (vérifié) Fonctions WebGPU de Chrome utiles sur une carte NVIDIA (détail dans evidence). — _https://developer.chrome.com/blog/new-in-webgpu-121 ; …-120 ; …-134 ; …-129 ; https://developer.chrome.com/blog/new-in-webgpu-155-156.md.txt ; https://developer.chrome.com/blog/new-in-webgpu-131 ; https://developer.mozilla.org/en-US/docs/Web/API/GPURenderPassEncoder/drawIndexedIndirect (21/05/2026) ; https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits (02/11/2026)_
- **NVIDIA-F18** (probable) Aucun navigateur ne donne accès aux unités matricielles (cœurs tenseurs), surtout sous Windows. Sans elles, un réseau neuronal maison reste 2 à 3 fois plus lent qu'en natif. — _https://github.com/gpuweb/gpuweb/blob/main/proposals/subgroup-matrix.md ; https://github.com/gpuweb/gpuweb/issues/4195 ; https://github.com/gpuweb/gpuweb/issues/11088 (04/11/2026)_
- **NVIDIA-F19** (probable) WebNN n'est pas livré dans Chrome. Sa phase d'essai a été reportée, et son exécution sur GPU et NPU reste limitée. Une super-résolution neuronale en temps réel ne peut donc pas s'appuyer dessus. — _https://chromestatus.com/api/v0/features/5176273954144256 (mise à jour le 08/04/2026) ; https://mail-archive.com/blink-dev@chromium.org/msg15933.html (24/02/2026) ; https://groups.google.com/a/chromium.org/g/blink-dev/c/5CWKSChYo98_
- **NVIDIA-F20** (vérifié) Le lancer de rayons matériel n'existe dans aucun navigateur : on n'en est qu'aux propositions. En natif, wgpu propose des requêtes de rayons expérimentales, sous Vulkan seulement. — _https://github.com/gpuweb/gpuweb/issues/535 ; https://github.com/gpuweb/gpuweb/issues/11055 (13/10/2026) ; https://docs.rs/wgpu/latest/wgpu/struct.Features.html (wgpu 30.0.1)_
- **NVIDIA-F21** (vérifié) La crate dlss_wgpu 6.0.0 (16/09/2026) apporte DLSS à wgpu sous Vulkan seulement : Super Resolution et Ray Reconstruction, sans génération d'images. Bevy s'en sert depuis la 0.17 (détail dans evidence). — _https://docs.rs/dlss_wgpu/latest/dlss_wgpu/ (6.0.0, 16/09/2026) ; https://raw.githubusercontent.com/bevyengine/dlss_wgpu/main/src/lib.rs ; https://bevy.org/news/bevy-0-17/ (30/09/2025) ; https://bevy.org/news/bevy-0-20/ (08/10/2026)_
- **NVIDIA-F22** (probable) Electron, Tauri et WebView2 n'ouvrent aucun accès aux tampons WebGL ou WebGPU d'une page : DLSS n'y est pas applicable. Seul un hôte natif qui possède le device GPU peut l'appeler (détail dans evidence). — _https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering ; https://github.com/tauri-apps/tauri/issues/6381 ; https://github.com/tauri-apps/wry/blob/dev/examples/wgpu.rs ; https://docs.deno.com/runtime/desktop/webgpu/ ; https://github.com/denoland/deno/issues/15924 ; https://raw.githubusercontent.com/google/dawn/main/include/dawn/native/D3D12Backend.h (12/11/2026)_
- **NVIDIA-F23** (vérifié) Les alternatives ouvertes n'apportent presque rien de prêt à l'emploi dans un navigateur : seuls les concepts de FSR 2/3 (MIT) et les petits shaders EASU/RCAS se portent (détail dans evidence). — _https://github.com/GPUOpen-Effects/FidelityFX-FSR2 ; https://raw.githubusercontent.com/GPUOpen-Effects/FidelityFX-FSR2/master/LICENSE.txt ; https://gpuopen.com/fidelityfx-super-resolution-4/ (version 4.1.2, octobre 2026) ; https://github.com/intel/xess ; https://raw.githubusercontent.com/intel/xess/main/LICENSE.txt ; https://github.com/pmndrs/upscaler_
- **NVIDIA-F24** (vérifié) Le renderer de FERRO 0.2 n'est pas prêt pour une reconstruction temporelle ni pour DLSS ou FSR : couleur en 8 bits, déjà tonemappée et chargée des effets d'écran dès le shader du monde ; ni gigue, ni vecteurs de mouvement, ni profondeur échantillonnable. En auto, la résolution est réduite puis agrandie par le navigateur (détail dans evidence). — _~/Projects/ferro (248043a) ; ~/Projects/bitume (e3bcb6b) ; ~/Projects/point-de-rupture (5ac0066)_
- **NVIDIA-F25** (vérifié) FERRO n'a jamais été vérifié sur un GPU NVIDIA, et DLSS n'a jamais été essayé sur david-pc. — _~/Projects/ferro/VERSIONS.md @248043a ; KBZA learnings/2026-09-05-mac.md:L18 (sha256 6ddbe212…)_
- **NVIDIA-F26** (incertain) david-pc aurait une RTX 5090, ce qui lui permettrait DLSS 5 et toutes les fonctions de DLSS 4.5. — _KBZA learning consolidated-8036af22… (sha256 1e1b98fc…)_
- **NVIDIA-F27** (vérifié) Plusieurs décisions récentes de David et contraintes des jeux pèsent sur le choix (détail dans evidence). — _~/Projects/point-de-rupture commit 5ac0066 (12/11/2026) ; ~/Projects/bitume e3bcb6b et 9886f92 ; ~/Projects/ferro AGENTS.md @248043a_
- **NVIDIA-F28** (probable) Mesurer le temps GPU dans le navigateur est possible sous Chrome et Edge pour Windows, presque jamais sous Firefox ou Safari en WebGL2. En WebGPU, timestamp-query est quasi universel. — _https://web3dsurvey.com/webgl2/extensions/EXT_disjoint_timer_query_webgl2 ; https://web3dsurvey.com/webgpu/features/timestamp-query (consultées le 12/11/2026) ; https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query_
- **NVIDIA-F29** (incertain) Les PC RTX Spark sont des Windows on Arm, compatibles DLSS 5. Chrome y garderait WebGPU derrière un drapeau, ce qui oblige à garder WebGL2 comme voie principale. — _https://developer.nvidia.com/blog/nvidia-rtx-spark-powers-neural-rendering-and-ai-characters-in-games/ (27/10/2026) ; https://github.com/gpuweb/gpuweb/wiki/Implementation-Status (02/10/2026)_
- **NVIDIA-F30** (incertain) NVIDIA Smooth Motion génère des images au niveau du pilote, sans intégration dans le jeu. Aucune source ne dit s'il agit sur un navigateur. — _https://www.tomshardware.com/pc-components/gpu-drivers/nvidias-new-driver-update-finally-brings-smooth-motion-to-rtx-40-series-gpus-works-like-amds-fluid-motion-frames-and-claims-to-double-your-fps-with-a-single-click-in-any-game (2025) ; https://www.tomshardware.com/pc-components/gpus/nvidia-adds-vulkan-compatibility-to-smooth-motion-frame-generation-complete-with-a-boost-for-emulators_
- **NVIDIA-F31** (vérifié) Des intégrations non officielles de DLSS 5 circulent. Elles reposent sur des DLL non autorisées : à proscrire. — _https://github.com/praveenkumarappu/DLSS5ForUE5 ; https://github.com/AlrikOlson/bevy_dlss5 (consultées le 12/11/2026)_

## Propositions

### NVIDIA-01 — Choisir la voie NVIDIA : matrice des quatre options, recommandation B (web prêt pour DLSS, natif plus tard)
- type décision-à-prendre · priorité P0 · effort S · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Le 12/11/2026, David demande de tirer parti des PC NVIDIA, « surtout le dlss 5 pour un jeu photoréaliste », avec FERRO comme moteur de référence pour BITUME et PDR. Les faits restreignent les choix :
- DLSS, toutes versions, n'existe qu'en natif (F08, F11) ;
- DLSS 5 est réservé aux partenaires et aux RTX 50 (F03, F05, F06) ;
- DLSS 4.5 est public, sous la licence RTX (F06, F07, F10) ;
- PDR vient de quitter Unreal sur décision de David (F27) ;
- BITUME est publié sur le web avec un budget de 1,4 Mo (F27).

Sans décision écrite, Codex risque de promettre, ou de bricoler, un DLSS impossible dans la page.

**Preuve.** https://www.nvidia.com/en-us/geforce/news/dlss-5-3d-guided-neural-rendering/ (01/09/2026) ; https://forums.developer.nvidia.com/t/official-dlss-5-neural-rendering-plugin-access-for-unreal-engine-5-8-2/382731 (09/11/2026) ; https://raw.githubusercontent.com/NVIDIA-RTX/Streamline/main/include/sl_core_types.h (2.14.16, 16/10/2026) ; https://github.com/gpuweb/gpuweb/issues/11088 (04/11/2026) ; point-de-rupture commit 5ac0066 (12/11/2026) ; bitume FEUILLE-DE-ROUTE.md:31-32 et AGENTS.md:19-20 @e3bcb6b

**Proposition.** Matrice. Les gains chiffrés sont des estimations.

A — Web seul.
- Contenu : FERRO en WebGL2, puis WebGPU, avec une reconstruction maison (NVIDIA-02 à 06).
- Effort : L.
- Gains : à s = 0,67, 55 % de pixels ombrés en moins, pour une image plus nette que l'agrandissement bilinéaire actuel du navigateur. Toutes les cartes et les trois jeux en profitent, sans dépendance.
- Risques : traînées en FPS et en course, lignes fines du RTS, environ 59 Mo d'historique en 1440p, ni DLSS ni cœurs tenseurs.

B — Web prêt pour DLSS, natif plus tard (recommandée).
- Contenu : A, plus un contrat d'image documenté, identique aux entrées de DLSS et de FSR (NVIDIA-03), plus un backend WebGPU qui sert de langage commun avec wgpu ou Dawn en natif (NVIDIA-07). Le prototype natif (NVIDIA-08) ne se fait que sur décision.
- Effort : L maintenant, XL plus tard et facultatif.
- Gains : ceux de A tout de suite. Ensuite DLSS 4.5 SR et RR (et la génération d'images avec Streamline) sans réécrire les shaders. DLSS 5 pourra se brancher si NVIDIA ouvre l'accès, puisque ses entrées sont la couleur, les vecteurs de mouvement et des masques.
- Risques : deux produits à maintenir, la licence NVIDIA, des DLL de 107 Mo face à une page de 1,4 à 3 Mo, un accès à DLSS 5 incertain.

C — Natif d'abord.
- Contenu : un hôte Rust (wgpu, dlss_wgpu sous Vulkan, V8 par deno_core) ou C++ (Dawn D3D12, Streamline 2.14.16, V8) qui exécute le JS des jeux.
- Effort : XL ou plus. Il faut refaire le rendu, la fenêtre, les entrées, la manette et l'audio : FAudio et FMusic utilisent WebAudio (audio.js:307), que Deno n'a pas.
- Gains : DLSS 4.5 SR, RR, génération d'images et Reflex dès maintenant sur RTX.
- Risques : abandon de la page HTML unique ; mobile, tactile et Mac sans DLSS ; un exécutable à distribuer ; BITUME déjà en ligne ; DLSS 5 toujours inaccessible.

D — Unreal pour une version photoréaliste.
- Contenu : Unreal 5.5 à 5.8 avec le plugin public DLSS 4.5 (8.9.0) ; le plugin DLSS 5 est annoncé mais réservé aux partenaires.
- Effort : XL par jeu.
- Gains : Lumen, Nanite, lancer de rayons et DLSS 4.5 immédiats.
- Risques : contredit la décision du 12/11/2026 et le rôle de FERRO ; la règle « tout procédural » devient difficile ; des gigaoctets de données ; pas de DLSS sur Mac.

Recommandation : B, en trois portes.
- Porte 1 : FERRO 0.3 avec NVIDIA-02 à 06, validé au banc sur david-pc.
- Porte 2 : backend WebGPU au niveau d'image de WebGL2 (NVIDIA-07).
- Porte 3 : prototype natif DLSS 4.5 (NVIDIA-08), seulement sur accord écrit de David.

DLSS 5 : uniquement par un accès officiel (NVIDIA-09).

Garde-fous pour Codex :
- aucune mention de DLSS ni de NVIDIA dans l'interface de la page ;
- le mode s'appelle « Reconstruction FERRO », avec Qualité 0,67, Équilibré 0,58 et Performance 0,5 ;
- aucune DLL NVIDIA, Streamline ou NGX dans src/ ;
- aucune version non officielle de DLSS 5.

**Critère d'acceptation.** Le choix daté de David est écrit dans README.md et VERSIONS.md de FERRO, avec une section Limites qui dit que DLSS est indisponible dans le navigateur et renvoie à gpuweb#11088. Le master prompt reprend ce choix tel quel. `grep -riE 'dlss|nvngx|streamline' src/` ne renvoie rien. Chaque porte a ses critères : NVIDIA-04 à 06 pour la porte 1, NVIDIA-07 pour la porte 2, NVIDIA-08 pour la porte 3.

**Risques.** Déception si David attend « DLSS 5 dans le navigateur » : il faut le dire franchement. Si David choisit C ou D, NVIDIA-02 et 03 restent utiles, NVIDIA-04 et 05 le sont moins. Les conditions de NVIDIA changent vite (accès à DLSS 5, prise en charge des RTX 40) : revoir la décision à chaque version de Streamline.

**Contre-vérification.** La matrice est juste sur les faits et les calculs sont vérifiés : 0,67² = 0,449, soit 55 % de pixels en moins ; deux RGBA16F en 2560×1440 font 59 Mo, 133 Mo en 4K. En revanche, la décision n'est plus à prendre. Le 12/11/2026 à 16:41 UTC, l'assistant a proposé une édition PC native avec DLSS. À 16:43:31, David a répondu « non osef dlss 5 pas grave », et l'assistant a acté « DLSS 5 sort du plan, et l'édition PC native avec ». Source : journal KBZA, session claude-code:e16d3c39…, séquences 49 à 51.

**Correction.** Retenir A (web seul), avec le backend WebGPU en option, c'est-à-dire B sans la porte 3. C et D sont exclus par les décisions du 12/11/2026 (16:43, et 5ac0066). Garder les garde-fous : rien de NVIDIA dans src/, aucun DLSS 5 non officiel. Passer l'item en P1 de cadrage, effort S. La contradiction avec BITUME (« pas le photoréalisme ») reste à trancher.

### NVIDIA-02 — Chaîne HDR linéaire : déplacer tonemap, gamma, vignette et effets d'écran du shader du monde vers une passe finale
- type exigence · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Aujourd'hui, le shader du monde écrit une couleur déjà tonemappée, corrigée en gamma et vignettée, avec le voile de blessure et l'onde, dans une cible RGBA8. Le bloom se seuille ensuite sur cette couleur LDR (F24). Une reconstruction temporelle, FSR ou DLSS doit recevoir une couleur linéaire, avant tonemap, sans effets fixes à l'écran : sinon la vignette et le voile sont reprojetés au mauvais endroit, et le mélange en 8 bits crée des bandes. C'est aussi la condition d'un éclairage plus photoréaliste : bloom sur l'énergie réelle, exposition.

**Preuve.** FERRO src/renderer.js @248043a :
- 428-437 : tonemap, gamma, vignette, voile et onde dans le shader du monde ;
- 549-551 : idem dans le ciel ;
- 1380-1382 : couleur en RGBA8 ;
- 561-563 : bloom seuillé avec smoothstep(.56, .86) ;
- 452-499 : shader des particules.

BITUME src/moteur/renderer.js:399 et 512 @e3bcb6b. PDR Jeu/src/moteur/renderer.js:399 et 518 @5ac0066. Règle de compatibilité : FERRO AGENTS.md:11 et checks/renderer-reprises.test.mjs:70 @248043a. Format : https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float (30/10/2026).

**Proposition.** Nouveau réglage de création `hdr`, faux par défaut. Sans lui, les commandes GPU restent celles de la 0.2.

Avec `hdr:true` et l'extension EXT_color_buffer_float présente :
1. Cible de scène en R11F_G11F_B10F : 4 o par pixel, la même bande passante que RGBA8. Repli en RGBA16F si `hdrFormat:'rgba16f'`. Le MSAA utilise le même format, vérifié par getInternalformatParameter(RENDERBUFFER, format, SAMPLES).
2. Variantes des shaders du monde et du ciel compilées avec `#define FERRO_HDR`. Elles s'arrêtent à `color *= uExposure`, avant la ligne 428 : plus de tonemap, de gamma, de vignette, de voile ni d'onde.
3. Nouvelle passe plein écran FINAL_FRAG, à la résolution d'affichage, qui applique dans l'ordre :
   - le bloom, seuillé sur la valeur linéaire. Les seuils de la 0.2 se convertissent par c = 0,76·t^2,2 / (1 − t^2,2), ce qui donne [0,29 ; 1,93] pour [0,56 ; 0,86] ;
   - le tonemap c/(c+0,76) ;
   - le gamma 0,4545 ;
   - la vignette (config.vignette, 0,59 par défaut) ;
   - le voile (uEffects.z) ;
   - l'onde (uEffects.w).
4. Les particules s'écrivent en linéaire dans la même cible. Les overlays gardent leur règle de brouillard.
5. `stats.hdr` et `stats.exposure`.

Le rendu logiciel ne change pas. BITUME et PDR reçoivent le même découpage à la fusion à trois de la version qui l'apporte.

**Critère d'acceptation.** (a) `npm test` vert, avec un test « sans réglage, FERRO 0.3 envoie les commandes GPU de la 0.2 » sur le modèle de renderer-reprises.test.mjs:70.
(b) Au banc, hdr:true comparé à hdr:false sur les scènes sans bloom : écart moyen ≤ 2/255 et PSNR ≥ 40 dB. Scènes avec bloom : contrôle visuel et capture jointe.
(c) Sur david-pc en 2560×1440, la passe finale coûte au plus 0,25 ms de GPU, mesuré par EXT_disjoint_timer_query_webgl2.
(d) Sans EXT_color_buffer_float, `hdr` est ignoré et stats.hdr vaut false.

**Risques.** - Bandes dans les ombres en R11G11B10 (mantisse de 5 à 6 bits, pas de signe) : c'est la raison de l'option rgba16f.
- MSAA en flottant non garanti sur certains mobiles.
- Une passe plein écran de plus sur mobile.
- Aspect du bloom à recaler.
- Deux variantes du shader du monde à maintenir.

**Contre-vérification.** La direction est confirmée par le guide DLSS (§3.1, « before tone mapping ») et par le code (428-437, 549-551, 561-563 @248043a). Seuils vérifiés : [0,56 ; 0,86] donnent 0,29 et 1,93 ; les [0,86 ; 0,98] de PDR et BITUME (VERSIONS.md:34) donnent environ 1,93 et 16,7.

**Correction.** L'acceptation (b) (écart ≤ 2/255) échouera sans quatre traitements :
- les particules sont mélangées après tonemap et gamma (498, 1575) ;
- la vignette du ciel vaut 0,76, sans voile ni onde ;
- le MSAA est résolu par blit après un tonemap par échantillon (1764-1768). En HDR, la résolution sur des valeurs linéaires crénèle les bords contrastés, et WebGL2 ne lit pas les textures multi-échantillonnées : il faut un tonemap réversible ;
- le bloom est seuillé après la vignette.

L'acceptation (c), 0,25 ms sur RTX 5090, ne prouve rien : mesurer sur une puce intégrée ou un mobile. Voir NVIDIA-V3.

### NVIDIA-03 — Contrat d'image « prêt pour reconstructeur » : vecteurs de mouvement, gigue Halton, profondeur échantillonnable, exposition, masques, reset
- type exigence · priorité P1 · effort L · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** TAAU, FSR et DLSS demandent les mêmes données. Selon le guide DLSS (F08) :
- la couleur à la résolution de rendu ;
- les vecteurs de mouvement en pixels, du pixel courant vers sa position précédente, en RG16F ou RG32F ;
- la profondeur et l'exposition ;
- une gigue Halton d'au moins 16 phases, le minimum dépendant du rapport ;
- un biais de détail négatif ;
- un reset à chaque changement de plan.

FERRO 0.2 n'en produit aucune (F24). Une fois fixé, ce contrat sert la reconstruction web (NVIDIA-04) et permet de brancher sans refonte DLSS 4.5 ou FSR 3.1 en natif (NVIDIA-08), voire DLSS 5 (couleur, vecteurs de mouvement et masques, F01).

**Preuve.** FERRO src/renderer.js @248043a :
- 7-51 : VERT, instances iPosition, iScale, iRotation et iColor, vent aux lignes 34-39 ;
- 1705 : tremblement de caméra ;
- 1708-1709 : projection en colonnes, avec projection[11] = −1 ;
- 1723 et 1759-1762 : séparation des maillages ordinaires, overlays et effets ;
- 1380-1382 : fonction texture(…, depth) ;
- 1393 : renderbuffer de profondeur ;
- 170, 189, 288, 291 et 342 : fwidth() des motifs procéduraux.

Guide DLSS 310.6.0, §2.2, §3.5, §3.6, §3.7 et §3.13 : https://github.com/NVIDIA/DLSS/blob/main/doc/DLSS_Programming_Guide_Release.pdf (31/03/2026). Correspondances Streamline : https://github.com/NVIDIA-RTX/Streamline/blob/main/docs/ProgrammingGuideDLSS.md (2.14.16).

**Proposition.** Réglages de création :
- `reconstruction: 'none'|'taau'|'spatial'`, 'none' par défaut ;
- `renderScale: 'auto'` ou un nombre de 0,5 à 1 ;
- `maxOutputPixels`, 1 800 000 par défaut comme en 0.2.

Nouveaux champs :
- `camera.cut` vide l'historique ;
- `camera.jitter === false` coupe la gigue ;
- `mesh.id` donne une clé stable aux acteurs dynamiques ;
- `mesh.reactive`, de 0 à 1, vaut 1 d'office pour `mesh.fx` et les particules d'overlay.

1) Gigue. Suite Halton(2,3) décalée de −0,5, indice i mod N, avec N = ceil(8·(affichage/rendu)²) : 18 pour 1,5, 24 pour 1,724, 32 pour 2 et 72 pour 3. Les décalages sont exprimés en pixels de la cible de rendu. Projection : P' = T(2jx/W, 2jy/H)·P, c'est-à-dire `projection[8] -= 2*jx/W; projection[9] -= 2*jy/H` (ligne 1709), où W et H sont la taille de la cible de rendu et non celle du canvas. Garder `vp` sans gigue et `prevVp` de l'image précédente. Exposer `stats.jitter = [jx, jy]` et `stats.phase`.

2) Vecteurs de mouvement.
- Le VERT reçoit `uniform mat4 uViewProjectionNoJitter, uPrevViewProjection; uniform vec2 uPrevWindTime;` et deux attributs d'instance `iPrevPosition` et `iPrevRotation` (vec4 chacun, 32 o de plus par instance), dans un flux séparé lié seulement si la reconstruction est active.
- La position précédente se calcule avec la même formule, vent compris.
- Le FRAG écrit en `location = 1`, au format RG16F : `mv = (prevNdc − curNdc)·0,5·(W, H)`, y inversé pour une origine en haut à gauche. C'est la convention de DLSS : en pixels, du pixel courant vers sa position précédente.
- Le ciel s'écrit comme une direction (w = 0) avec `uPrevViewProjection`.
- Le tremblement de caméra est couvert par `prevVp`.
- Un cache `Map(id → Float32Array(8))` se remplit après chaque `draw` et se purge après deux images d'absence. Sans `id`, la position précédente vaut la position actuelle et le pixel est marqué réactif.

3) Masque en `location = 2`, format R8 :
- bit 0 : réactif (particules, flashs) ;
- bit 1 : overlay. L'arme de METAL (lignes 1759-1762) calcule ses vecteurs de mouvement avec ses propres matrices ;
- bit 2 : sans historique.

4) Profondeur : quand la reconstruction est active, une texture DEPTH_COMPONENT24 remplace le renderbuffer de la ligne 1393.

5) Biais de détail procédural : `uniform float uDetailScale`, rapport rendu/affichage, 1 par défaut. Il multiplie les fwidth() des motifs, ce qui équivaut au biais de mip log2(rendu/affichage). Un réglage `detailBias` de 0 à −1 se règle au banc.

6) `uExposure`, 1 par défaut.

7) Table de correspondance à écrire dans VERSIONS.md :
- couleur → kBufferTypeScalingInputColor ;
- profondeur → kBufferTypeDepth ;
- vecteurs de mouvement → kBufferTypeMvec, avec mvecScale = {1/W, 1/H} ;
- exposition → kBufferTypeExposure ;
- gigue → jitterOffset ;
- matrices sans gigue → constantes de caméra ;
- camera.cut → reset ;
- masque réactif → BiasCurrentColor pour DLSS, reactive pour FSR ;
- identifiant de matière → masquage moteur de DLSS 5.

**Critère d'acceptation.** (a) Tests Node : Halton(2,3) − 0,5 identique à la table de référence sur 16 valeurs ; N vaut 18, 24, 32 et 72 pour les rapports 1,5, 1,724, 2 et 3.
(b) Banc GPU avec une vue de débogage des vecteurs de mouvement. Sur un panoramique de caméra connu, écart RMS avec la reprojection analytique ≤ 0,05 px. Caméra fixe : |VM| < 0,01 px hors acteurs mobiles.
(c) `reconstruction:'none'` donne les mêmes commandes GPU que la 0.2 (test sur le modèle de checks/renderer-reprises.test.mjs:70).
(d) Les 32 o par instance ne sont envoyés que lorsque la reconstruction est active.
(e) Après une perte de contexte, les cibles sont recréées et l'historique vidé, sans exception.

**Risques.** - Acteurs sans `id` : traînées. Repli prévu : pixel réactif.
- PDR : la foule est calculée sur le GPU, hors de FERRO ; il lui faut un point d'accroche pour ses positions précédentes.
- BITUME : très grands vecteurs de mouvement, et route découverte sous la voiture. Le guide DLSS conseille dans ce cas le masque BiasCurrentColor.
- Coût : trois cibles de rendu (MRT) et 32 o de plus par instance.
- MSAA et MRT combinés sont délicats : préférer la reconstruction sans MSAA.

**Contre-vérification.** Vérifié :
- N et Halton : 18, 24, 32 et 72 ;
- formule de gigue correcte pour cette matrice (projection[11] = −1) ;
- convention des VM conforme au guide (§3.6.1) ;
- sl::Constants : mvecScale, jitterOffset hors des matrices, reset.

**Correction.** À corriger :
- noms Streamline exacts : kBufferTypeMotionVectors (= 1, et non « kBufferTypeMvec ») et kBufferTypeBiasCurrentColorHint (= 29) ;
- ajouter iPrevScale, soit 48 o par instance : l'échelle varie dans METAL (game.js:418-440 @673d6b2) ;
- METAL et BITUME recréent leurs pièces sans identifiant : le coût de mesh.id est sous-estimé (NVIDIA-V5) ;
- la passe des surimpressions efface la profondeur (1761, NVIDIA-V4) ;
- le lien entre l'identifiant de matière et le masquage de DLSS 5 est une hypothèse (SDK non public), sans objet depuis le 12/11 ;
- PDR a déjà, dans foule.js @5ac0066, les états précédent et courant et l'alpha : ses VM se calculent dans son propre shader.

### NVIDIA-04 — Reconstruction FERRO (TAAU en WebGL2) avec repli spatial, pilotée par une échelle de rendu découplée du canvas
- type proposition · priorité P1 · effort L · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Dans le navigateur, c'est le seul moyen d'obtenir l'effet de DLSS Super Resolution : ombrer moins de pixels sans perdre de netteté. Aujourd'hui, en auto, le canvas est réduit jusqu'à 0,65 et plafonné à 1,8 Mpx, puis le navigateur l'agrandit de façon bilinéaire (F24). Sur un écran 4K, FERRO calcule donc du 1080p étiré.

Estimations :
- s = 0,67 ombre 45 % des pixels ; s = 0,5 en ombre 25 % ;
- si 70 % du temps GPU dépend du nombre de pixels, une image coûte environ 0,3 + 0,7 × 0,45 ≈ 0,61 fois l'image native, plus le coût de la reconstruction.

La reconstruction temporelle permet aussi des effets stochastiques peu coûteux (occlusion ambiante, ombres douces, brouillard volumétrique), qui rapprochent l'image du photoréalisme.

**Preuve.** FERRO src/renderer.js @248043a :
- 806-821 : gouverneur ;
- 1541-1547 : resize avec le plafond de 1,8 Mpx ;
- 1401-1404 : MSAA ;
- 1398 : commentaire de PDR, le MSAA est exigé pour les lignes fines vues de haut ;
- 1773-1776 : perte de contexte.

Concepts : https://github.com/GPUOpen-Effects/FidelityFX-FSR2 (MIT : phases, biais de mip, masque réactif, coûts) ; https://github.com/pmndrs/upscaler (MIT, référence de lecture en WebGPU) ; guide DLSS 310.6.0 §3.7 (rapports et phases) et §3.13 (reset).

**Proposition.** Chaîne quand `reconstruction:'taau'` :
1. Scène à la résolution de rendu (W·s, H·s), avec la gigue de NVIDIA-03.
2. Passe TAAU à la résolution d'affichage, en shader de fragment, puisque WebGL2 n'a pas de shaders de calcul.
3. Bloom au quart de l'affichage.
4. Passe finale de NVIDIA-02 vers le canvas.

Le canvas reste à la résolution d'affichage (DPR ≤ 2, `maxOutputPixels`). Le gouverneur fait varier s de 0,5 à 1 par pas de 0,05 au lieu de redimensionner le canvas. Préréglages : Qualité 0,67, Équilibré 0,58, Performance 0,5.

Algorithme TAAU, en une passe :
- Dilatation : prendre le vecteur de mouvement du texel le plus proche en profondeur dans un voisinage 3×3.
- Lecture de l'historique : Catmull-Rom en 5 lectures.
- Couleur courante : noyau de Blackman-Harris 3×3, pondéré par la distance entre le centre du pixel d'affichage et chaque échantillon décalé par la gigue.
- Bornage de l'historique : en YCoCg, dans [μ − γσ ; μ + γσ], avec γ entre 1 (mouvement) et 1,25 (immobile).
- Mélange : α = max(1/16, poids courant). Pixel réactif : α de 0,5 à 1. Désocclusion (écart de profondeur linéaire supérieur à 1 %) : α = 1.
- Pondération 1/(1 + luminance) contre les points brillants.
- Historique en RGBA16F, en double tampon.
- Netteté de type RCAS (force 0,25), appliquée dans la passe finale.
- Reset sur camera.cut, au redimensionnement et à la perte de contexte.

Mode 'spatial', sans historique : agrandissement Lanczos-2 adaptatif aux bords, ou portage d'EASU en gardant la mention AMD de la licence MIT, suivi de RCAS. Il sert aux mobiles et au réglage léger.

MSAA et TAAU s'excluent : PDR garde 'msaa' par défaut.

**Critère d'acceptation.** Sur david-pc (carte NVIDIA, Chrome et Edge pour Windows), en 2560×1440, sur la scène la plus chargée du banc et sur une capture de l'arène de METAL 0.8 :
- TAAU à s = 0,67 : temps GPU total ≤ 0,65 fois celui du natif s = 1 avec MSAA ×4 ;
- passe TAAU ≤ 0,6 ms ;
- à s = 0,5 : temps GPU ≤ 0,5 fois le natif.

Qualité :
- Image fixe après 32 images, comparée à une référence suréchantillonnée à 2× : SSIM ≥ 0,97, au moins égal à celui du natif avec MSAA ×4 (calcul dans le banc par readPixels).
- Panoramique à 90°/s : aucune traînée visible au-delà de 2 images derrière un acteur mobile (capture jointe).

Compatibilité :
- Sans EXT_color_buffer_float, retour à 'none'.
- Sans réglage, mêmes commandes GPU qu'en 0.2.
- `npm test` vert.

**Risques.** - Traînées en FPS rapide (METAL) et en course (BITUME) : bornage serré et masque réactif.
- Lignes fines vues de haut (PDR) : garder le MSAA.
- Mémoire de l'historique (deux tampons RGBA16F) : 59 Mo en 1440p, 133 Mo en 4K.
- Mobiles : bande passante, d'où le mode 'spatial'.
- Ne copier aucun code GPL. Les codes MIT (FSR 2, pmndrs) peuvent servir à condition de garder leurs mentions.

**Contre-vérification.** L'algorithme est standard et faisable en WebGL2 : shaders de fragment, RGBA16F filtrable, écriture grâce à EXT_color_buffer_float. Les chiffres sont vérifiés : 0,45 et 0,61, puis 59 et 133 Mo pour l'historique seul.

**Correction.** Sur une RTX 5090, FERRO sera limité par le CPU et par des passes indépendantes de s : atlas d'ombre de 1024 à 2048², bloom, passe finale. Le critère « ≤ 0,65 du natif » peut donc échouer sans défaut de la TAAU. Exprimer les critères par passe (le temps de la passe de scène suit s² à 15 % près) et mesurer aussi sur un GPU moyen et une puce intégrée. Compter la mémoire des VM, de la profondeur, du masque et de la cible de scène. Ajouter le rejet de l'historique quand l'identifiant de matière change (guide, §9.4). Cet item dépend de NVIDIA-V4.

### NVIDIA-05 — Tirer parti des cartes NVIDIA dans le navigateur : détection d'adaptateur, conseil Optimus, gouverneur sur le temps GPU, préréglage « Fine+ »
- type proposition · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** - Sous Chrome Windows, powerPreference:'high-performance' n'a aucun effet. Un portable Optimus fait donc tourner le jeu sur la puce intégrée (F14, F15), et seul le joueur peut corriger cela, par les paramètres graphiques de Windows ou un drapeau de Chrome.
- À l'inverse, sur une grosse carte NVIDIA, le plafond de 1,8 Mpx et des seuils pensés pour 40 à 54 images/s (25 et 18,5 ms) laissent la carte sous-employée sur un écran 4K à 144 Hz (F24).
- Le temps GPU se mesure sous Chrome et Edge (F28).

**Preuve.** FERRO src/renderer.js @248043a : 1353 (getContext), 806-821 (gouverneur), 1545 (plafond de 1,8 Mpx). https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips (17/10/2025) ; https://chromium.googlesource.com/chromium/src/+/main/ui/gl/gl_switches.cc (kEGLDualGPURendering, 12/11/2026) ; https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info (30/10/2026) ; https://web3dsurvey.com/webgl2/extensions/EXT_disjoint_timer_query_webgl2 ; https://www.nvidia.com/content/Control-Panel-Help/vLatest/en-us/mergedProjects/nvdsp/Reference_Adjust_Video_Image_Settings.htm

**Proposition.** 1) `FRender.adapter()` renvoie `{api:'webgl2', vendor:'nvidia'|'amd'|'intel'|'apple'|'arm'|'qualcomm'|'other'|null, renderer, integrated:true|false|null}`.
- Lu une seule fois à la création, dans UNMASKED_RENDERER_WEBGL, ou à défaut dans gl.RENDERER.
- Exemple de chaîne ANGLE : « ANGLE (NVIDIA, NVIDIA GeForce RTX …, Direct3D11 …) ». Ce format est courant mais doit être confirmé sur david-pc.
- Règles pour `integrated` : Intel hors Arc donne true ; « AMD Radeon(TM) Graphics » ou « Vega … Graphics » donne true ; NVIDIA donne false ; Apple donne null.
- Ces données ne sont jamais envoyées ni enregistrées.

2) Conseil Optimus, avec le mécanisme dans FERRO (FOptions) et le texte dans le jeu. Il s'affiche une seule fois par appareil quand le système est Windows et que la puce Intel ou AMD est intégrée. Texte : dans Windows, Paramètres > Système > Écran > Graphiques, régler le navigateur sur Hautes performances puis le redémarrer ; ou taper chrome://flags/#force-high-performance-gpu (une page ne peut pas ouvrir ce lien). Le fait qu'il a été montré est gardé dans localStorage, dans un try/catch.

3) Gouverneur sur le temps GPU, si EXT_disjoint_timer_query_webgl2 est présent :
- anneau de 4 requêtes, lues sans attente, et jetées si GPU_DISJOINT_EXT est levé ;
- moyenne lissée du temps GPU sur 0,5 s ;
- budget B = médiane des intervalles de requestAnimationFrame sur 60 images ;
- monter s, puis `maxOutputPixels` jusqu'à 8,3 Mpx (4K), quand le temps GPU reste sous 0,55·B pendant 3 s ;
- baisser au-delà de 0,85·B pendant 1 s ;
- sans l'extension (Firefox, Safari), garder la logique actuelle fondée sur fx.frameMs.

4) Préréglage « Fine+ », proposé d'office si vendor vaut 'nvidia' et que la carte n'est pas intégrée :
- sortie à la résolution d'affichage ;
- reconstruction 'taau' à s = 0,67, sous le contrôle du gouverneur ;
- shadowMapScale 2 si MAX_TEXTURE_SIZE ≥ 8192 ;
- qualité 'high'.

**Critère d'acceptation.** (a) Test Node de l'analyseur sur 12 chaînes réelles (NVIDIA, Intel, AMD, Apple, ARM).
(b) Sur david-pc : stats.adapter.vendor vaut 'nvidia'. En auto à 3840×2160, le canvas est à la résolution d'affichage avec la reconstruction, et la scène de banc tient au moins la fréquence de l'écran moins 5 %, valeurs relevées dans le JSON du banc.
(c) Pas de régression sur une puce intégrée (Mac ou PC Intel) : images/s ≥ 97 % de la 0.2.
(d) Le conseil n'apparaît qu'avec une chaîne simulée « ANGLE (Intel, … UHD Graphics …) » sous Windows.
(e) Aucun appel réseau.

**Risques.** - Perception de pistage : la lecture reste locale et rien n'est envoyé.
- Chaîne vide ou nettoyée (Firefox avec resistFingerprinting, Safari) : vendor vaut null.
- Mauvaise classification.
- Mesures faussées par les événements « disjoint » du minuteur.
- Les profils du pilote Optimus peuvent passer outre les réglages.
- Le changement de plafond ne doit pas toucher les jeux qui ne demandent rien.

**Contre-vérification.** L'analyse de F14 et F15 est juste. Les seuils de 25 et 18,5 ms correspondent bien à 40 et 54 i/s (806-824).

**Correction.** Cinq corrections :
- le plafond de 1,8 Mpx ne touche que 'auto' : 'high' rend déjà sans plafond, sans gouverneur. « Fine+ » revient donc à 'high' plus le gouverneur ;
- choisir le préréglage d'après le nom de la carte contredit le plan annoncé à David le 12/11 (séquences 49 et 51, « d'après le temps GPU mesuré et non d'après le nom de la carte ») : le nom ne sert qu'au conseil ;
- le conseil Optimus touchera aussi des PC sans carte dédiée : rédiger le texte au conditionnel et prévenir de l'effet sur la batterie ;
- l'API est incohérente : FRender.adapter() statique, alors que l'acceptation lit stats.adapter ;
- l'analyseur doit couvrir les chaînes Linux.

### NVIDIA-06 — Banc NVIDIA reproductible sur david-pc : temps GPU par passe, adaptateur, percentiles, export JSON local
- type exigence · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Rien n'a été mesuré sur une carte NVIDIA (F25). Les gains annoncés par NVIDIA-02, 04 et 05 sont des estimations, à confirmer sur la machine visée. Le banc actuel n'a ni chronométrage GPU ni identification de l'adaptateur.

**Preuve.** FERRO banc/index.html @248043a : seulement requestAnimationFrame, lignes 83 et 85, sans minuteur GPU. VERSIONS.md:39-41 et 66 @248043a. KBZA learnings/2026-09-05-mac.md:L18 (david-pc injoignable par SSH). https://web3dsurvey.com/webgl2/extensions/EXT_disjoint_timer_query_webgl2

**Proposition.** Étendre banc/index.html sans aucune dépendance.

Ce que le banc relève :
- l'adaptateur (NVIDIA-05), le navigateur et sa version ;
- la sortie : 1920×1080, 2560×1440 et 3840×2160 ;
- le mode : none, msaa4, taau à 0,67, 0,58 et 0,5, spatial à 0,67 ;
- le temps GPU par passe (scène, reconstruction, bloom, finale) par EXT_disjoint_timer_query_webgl2 ;
- les percentiles p50, p95 et p99 de l'intervalle entre images, sur 1 200 images après 300 images de chauffe ;
- pour des parcours de caméra fixes et déterministes.

Export JSON par téléchargement (Blob), sans réseau. Les résultats sont ensuite versionnés par la session dans FERRO, sous mesures/nvidia/<date>.json. Le protocole est écrit dans le README du banc : alimentation sur secteur, synchronisation verticale notée, trois passages consécutifs.

**Critère d'acceptation.** Schéma JSON : {date, navigateur, ua, adapter, sortie, mode, s, gpuMs:{scene, reconstruction, bloom, finale, total}, frameMs:{p50, p95, p99}}. Trois passages donnent un p50 à ±5 %. Le banc tourne sous Chrome et sous Edge pour Windows. Sous Firefox, faute de minuteur, les mesures sont marquées « CPU seulement ».

**Risques.** - david-pc injoignable : il faudra un passage manuel de David.
- Variations thermiques.
- Avec la synchronisation verticale, l'intervalle entre images est plafonné par l'écran : c'est le temps GPU qui fait foi.

**Contre-vérification.** Confirmé : le banc actuel n'a ni minuteur ni mesure de temps (banc/index.html:76-85 @248043a, draw avec adaptive:false).

**Correction.** david-pc est sous Linux, en X11 d'après la note du 04/08/2026, et injoignable en SSH (18/10 et 29/10). « Chrome et Edge pour Windows sur david-pc » n'est pas réalisable : il faut deux cibles nommées et les champs os, session et pilote dans le JSON (NVIDIA-V2). Sous Linux, le minuteur n'apparaît que dans 42,79 % des rapports.

### NVIDIA-07 — Backend WebGPU facultatif, conçu comme pont vers wgpu et Dawn en natif
- type proposition · priorité P2 · effort XL · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **plausible**

**Pourquoi.** Sur les PC NVIDIA, WebGPU apporte des fonctions que WebGL2 n'a pas : chronométrage par passe, shaders de calcul pour la reconstruction et l'exposition, dessins indirects pour découper les lots sur le GPU, sous-groupes, sortie HDR du canvas (F17). Surtout, la même API et le même WGSL tournent en natif sur wgpu (Rust, où existe dlss_wgpu) et sur Dawn (C++, D3D12 et Streamline) (F21, F22). C'est le seul pont qui permettrait une édition DLSS sans réécrire le rendu. WebGL2 doit pourtant rester la voie principale : Firefox Linux, Windows ARM64 et les vieux Safari n'ont pas WebGPU par défaut (F13, F29).

**Preuve.** https://github.com/gpuweb/gpuweb/wiki/Implementation-Status (02/10/2026) ; https://developer.chrome.com/blog/new-in-webgpu-121 (timestamp-query) ; https://developer.chrome.com/blog/new-in-webgpu-129 (HDR du canvas) ; https://developer.mozilla.org/en-US/docs/Web/API/GPUSupportedLimits (02/11/2026) ; https://docs.deno.com/runtime/desktop/webgpu/ (Deno 2.9) ; https://raw.githubusercontent.com/google/dawn/main/include/dawn/native/D3D12Backend.h ; FERRO AGENTS.md:13 @248043a (scripts autonomes)

**Proposition.** `FRender.create(canvas, {backend:'webgl2'|'webgpu'|'auto'})`, 'webgl2' par défaut. En 'auto', WebGPU n'est retenu que si navigator.gpu existe et si l'adaptateur n'est pas un repli (info.isFallbackAdapter). Sinon WebGL2, puis Canvas 2D.

Le backend WebGPU met en œuvre le même contrat d'image (NVIDIA-02 et 03) en WGSL. Les shaders restent des chaînes, dans un script autonome qui pose son global.

Fonctions demandées seulement si elles sont présentes :
- timestamp-query : chronométrage par passe ; la quantification à 100 µs suffit pour des passes de plus de 0,5 ms ;
- indirect-first-instance et drawIndexedIndirect : lots de setLots découpés par un passage de calcul ;
- subgroups : réductions pour l'exposition et l'histogramme ;
- shader-f16 : facultatif ;
- canvas rgba16float avec toneMapping:{mode:'extended'} : sortie HDR facultative.

Les limites se demandent par requiredLimits à partir de adapter.limits. La perte du device se traite comme la perte de contexte WebGL.

Premier essai hors navigateur, sans DLSS : le même JS sous Deno 2.9 desktop (backend raw, wgpu), pour mesurer l'écart entre le natif et Chrome sur david-pc.

**Critère d'acceptation.** (a) Le banc rend les mêmes scènes avec les deux backends : écart moyen ≤ 2/255, PSNR ≥ 38 dB.
(b) Sur david-pc, le chronométrage par passe en WebGPU se compare à celui de WebGL2, dans le JSON de NVIDIA-06.
(c) Retour automatique à WebGL2, testé, quand navigator.gpu manque.
(d) La page de BITUME grossit de 120 Ko au plus et reste sous 1,4 Mo.
(e) `npm test` vert.

**Risques.** - Effort XL et deux backends à maintenir, avec des écarts de comportement entre ANGLE et Dawn.
- WebGPU absent de Firefox Linux stable, et peut-être derrière un drapeau sous Windows ARM64.
- Budget de taille.
- Gain réduit tant que la boucle CPU limite (voir l'audit parallèle).
- Le support de Deno desktop est récent et expérimental.

**Contre-vérification.** Les faits WebGPU sont confirmés (F13, F17). Le budget de taille suffit : la page de BITUME pèse 305 094 o pour 1,4 Mo autorisés.

**Correction.** Six corrections :
- requestAdapter et requestDevice sont asynchrones, alors que FRender.create est synchrone : il faut une promesse ready ou un createAsync, sinon la règle de compatibilité est rompue (AGENTS.md:10-12) ;
- un canvas n'a qu'un type de contexte : le repli après un échec exige un nouveau canvas ;
- sur david-pc en X11, WebGPU est derrière un drapeau ;
- l'essai Deno relève de l'édition native, exclue le 12/11 : à retirer ;
- 120 Ko est optimiste : le renderer de BITUME pèse 117 424 o à lui seul ;
- 'rg11b10ufloat-renderable' est requis pour R11G11B10.

Priorité : P2 ou P3.

### NVIDIA-08 — Prototype « FERRO natif » Windows/NVIDIA avec DLSS 4.5 (SR et RR), seulement sur décision de David
- type proposition · priorité P2 · effort XL · jeux FERRO, METAL
- contre-vérification : **réfuté**

**Pourquoi.** C'est la seule voie vers un vrai DLSS (F08, F11). DLSS 4.5 est public (F06, F07), et dlss_wgpu ou Streamline le rendent intégrable dans un moteur maison (F09, F21). Le prototype doit rester à part de la page web, qui demeure la référence : budgets, mobile, mise en ligne de BITUME (F27).

**Preuve.** https://docs.rs/dlss_wgpu/latest/dlss_wgpu/ (6.0.0, 16/09/2026) ; https://raw.githubusercontent.com/bevyengine/dlss_wgpu/main/src/lib.rs ; https://github.com/NVIDIA-RTX/Streamline/blob/main/docs/ProgrammingGuide.md (2.14.16) ; https://raw.githubusercontent.com/NVIDIA/DLSS/main/LICENSE.txt (v. 14/03/2024) ; https://api.github.com/repos/NVIDIA/DLSS/contents/lib/Windows_x86_64/rel (310.9.16) ; https://raw.githubusercontent.com/google/dawn/main/include/dawn/native/D3D12Backend.h ; https://github.com/denoland/deno/issues/15924 ; https://github.com/orottier/web-audio-api-rs ; FERRO src/audio.js:307 @248043a (AudioContext)

**Proposition.** Deux variantes, aucune encore essayée.

N1, à retenir si NVIDIA-07 est fait. Hôte Rust :
- fenêtre winit, manettes par gilrs ;
- wgpu sous Vulkan, avec instance et device créés par dlss_wgpu::create_instance et dlss_wgpu::request_device (UUID de projet fixe pour chaque jeu) ;
- deno_core (V8) qui exécute FERRO et le jeu, avec une liaison WebGPU réduite, ou un deno_webgpu modifié pour accepter le device de l'hôte ;
- une opération `ferro.native.dlss(couleur, profondeur, vm, exposition, gigue, reset, sortie)` qui appelle DlssSuperResolution ;
- l'audio par web-audio-api-rs (MIT), puisque FAudio et FMusic utilisent WebAudio : Gain, BiquadFilter, BufferSource, StereoPanner, WaveShaper, Oscillator, DynamicsCompressor, Delay.
Pas de génération d'images avec dlss_wgpu.

N2, à retenir si la génération d'images ou Reflex sont voulues. Hôte C++ :
- Dawn natif sous D3D12 ;
- les ressources sont créées en ID3D12Resource puis importées dans Dawn par SharedTextureMemoryD3D12ResourceDescriptor ;
- Streamline 2.14.16 (sl.dlss, sl.dlss_g, sl.reflex) sur GetD3D12CommandQueue ;
- V8 pour le JS.

Livraison, dans un téléchargement séparé pour Windows x64 :
- l'exécutable ;
- nvngx_dlss.dll (56,2 Mio) et, pour la reconstruction de rayons, nvngx_dlssd.dll (46,1 Mio), en versions rel signées ;
- le texte de licence ;
- l'attribution et les marques NVIDIA sur l'écran de démarrage (7.1(b)) ;
- avant toute sortie commerciale, prévenir NVIDIA (§4).

La page web ne change pas.

**Critère d'acceptation.** Sur david-pc, sur la scène de banc de METAL :
- DLSS SR en mode Quality avec une sortie 4K : au moins 1,4 fois les images/s du rendu natif s = 1 ;
- la DLL de développement, avec sa surcouche de débogage, montre des vecteurs de mouvement corrects : aucune bavure pendant un panoramique ;
- la version publiée n'embarque que les DLL rel signées ;
- le HTML de la page web reste identique à l'octet près ;
- `grep nvngx` dans les dépôts web ne renvoie rien.

**Risques.** - Effort XL.
- Parité de plateforme à refaire : entrées, audio, manette, plein écran.
- Un exécutable non signé alerte les antivirus.
- Obligations de la licence NVIDIA.
- DLSS 5 reste indisponible.
- Pas de DLSS sur macOS.
- Divergence entre le natif et le web si le contrat de NVIDIA-03 n'est pas tenu.

**Contre-vérification.** Les faits internes sont exacts : dlss_wgpu sous Vulkan seulement et sans génération d'images, tailles des DLL, licence. Mais l'item est hors du plan. Le 12/11/2026 à 16:41 UTC, l'assistant a proposé « une vraie édition PC native avec DLSS » ; à 16:43:31, David a répondu « non osef dlss 5 pas grave », et l'assistant a acté le retrait (journal KBZA, séquences 49 à 51, sha256 0786d284…, f7a985a1… et 50cf9ed7…).

**Correction.** Retirer l'item du master prompt. Noter seulement dans VERSIONS.md : « édition native non poursuivie, décision du 12/11/2026 ». De plus, N2 (Streamline) ne tournerait pas sous Linux.

### NVIDIA-09 — DLSS 5 : demander un accès officiel ou y renoncer, et interdire les versions non officielles
- type décision-à-prendre · priorité P1 · effort S · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : **réfuté**

**Pourquoi.** David demande expressément DLSS 5. Or :
- le SDK est réservé aux partenaires (F05, F06) ;
- DLSS 5 ne tourne que sur RTX 50, les RTX 40 étant promises plus tard sans date (F03, F04) ;
- des intégrations non officielles circulent avec des DLL dont la redistribution n'est pas autorisée (F31) ;
- DLSS 5 transforme les matières et l'éclairage par un modèle d'environ 118 M de paramètres entraîné par NVIDIA (F02), ce qui pose une question de direction artistique.

**Preuve.** https://forums.developer.nvidia.com/t/official-dlss-5-neural-rendering-plugin-access-for-unreal-engine-5-8-2/382731 (09/11/2026) ; https://raw.githubusercontent.com/NVIDIA-RTX/Streamline/main/include/sl_core_types.h (kFeatureDLSS_NR = 1004) ; https://www.nvidia.com/en-us/geforce/technologies/dlss/ (12/11/2026) ; https://github.com/praveenkumarappu/DLSS5ForUE5 ; https://github.com/AlrikOlson/bevy_dlss5 ; https://raw.githubusercontent.com/NVIDIA/DLSS/main/LICENSE.txt (§12, résiliation automatique) ; bitume FEUILLE-DE-ROUTE.md:31-32 @e3bcb6b ; FERRO AGENTS.md:6 @248043a

**Proposition.** (1) David décide s'il demande l'accès au SDK DLSS 5 par les relations développeurs de NVIDIA. L'accès est aujourd'hui réservé aux partenaires, et un accord de confidentialité est probable. La demande précise : moteur maison FERRO, API Vulkan (wgpu) ou D3D12 (Dawn), cible RTX 50, projet personnel ou commercial.

(2) Interdits pour Codex :
- toute DLL nvngx_dlssnr tirée d'un jeu, d'un correctif ou d'une version communautaire ;
- tout dépôt tiers comme DLSS5ForUE5 ou bevy_dlss5.
Ce sont des binaires non signés, leur redistribution n'est pas autorisée, et la licence RTX se résilie automatiquement en cas de manquement.

(3) Préparer sans attendre :
- le contrat de NVIDIA-03 fournit déjà la couleur, les vecteurs de mouvement et le masque ;
- y ajouter un identifiant de matière en R8, tiré de vMaterial (0 à 18), pour le masquage moteur ;
- prévoir deux réglages de jeu, `structure` et `tone` (0 à 1), sans effet tant que DLSS 5 n'est pas branché.

(4) David dit si une passe générative reste compatible avec « contenu graphique généré par le code », et si le « photoréaliste » de sa demande remplace la ligne de BITUME qui écarte le photoréalisme.

**Critère d'acceptation.** Décision écrite. Si l'accès est accordé : version du SDK, conditions et obligations notées dans VERSIONS.md de FERRO, sans secret ; essai sur une RTX 50 (david-pc, si la RTX 5090 se confirme) avec le coût mesuré en millisecondes. Sinon, la section Limites de FERRO indique que DLSS 5 est réservé aux partenaires au 12/11/2026.

**Risques.** - Accès refusé, ou confidentialité incompatible avec un dépôt partagé.
- Parc limité aux RTX 50 pour l'instant.
- Coût réel inconnu pour un moteur maison.
- Débat sur le respect de l'intention artistique.
- Image moins bonne si l'éclairage d'entrée est rastérisé plutôt que tracé (F01).

**Contre-vérification.** Les constats sont exacts (F05, F06, F31), mais la décision a déjà été prise : le 12/11/2026 à 16:43, David a écarté DLSS 5 (« non osef dlss 5 pas grave »).

**Correction.** Supprimer la demande d'accès et les réglages structure et tone. Reporter dans NVIDIA-01 le seul garde-fou utile : aucune DLL nvngx_dlssnr, aucun dépôt tiers ni version fuitée. L'identifiant de matière en R8 reste utile, mais pour la TAAU maison (rejet de l'historique).

### NVIDIA-10 — Alternatives ouvertes : reprendre les idées de FSR 2 (MIT), écarter FSR 4, XeSS et un réseau neuronal maison dans la page
- type proposition · priorité P3 · effort S · jeux FERRO
- contre-vérification : **confirmé**

**Pourquoi.** Le point 5 de la mission demande ce que FSR, XeSS ou une reconstruction maison apportent dans un navigateur.
- FSR 4 et XeSS sont des binaires D3D12 ou Vulkan, inutilisables dans une page (F23).
- FSR 2 et 3 sont des shaders MIT dont on peut reprendre les concepts.
- Un réseau neuronal maison bute sur l'absence d'accès aux unités matricielles (F18) et sur WebNN non livré (F19).

**Preuve.** https://github.com/GPUOpen-Effects/FidelityFX-FSR2 et son LICENSE.txt (MIT) ; https://gpuopen.com/fidelityfx-super-resolution-4/ (4.1.2, octobre 2026 : DLL signées, AMD seulement) ; https://raw.githubusercontent.com/intel/xess/main/LICENSE.txt (binaire seul, sans modification) ; https://github.com/pmndrs/upscaler (MIT, WebGPU seulement) ; https://github.com/gpuweb/gpuweb/blob/main/proposals/subgroup-matrix.md (brouillon) ; https://chromestatus.com/api/v0/features/5176273954144256 (WebNN, 08/04/2026)

**Proposition.** À reprendre dans NVIDIA-04, sans dépendance :
- de FSR 2.2/3.1 : la pyramide de luminance pour l'exposition, le découpage par la profondeur, les verrous sur les détails fins et le masque réactif ;
- EASU et RCAS pour le mode 'spatial', en gardant la mention AMD de la licence MIT.

L'édition native (NVIDIA-08) pourra ajouter FSR 3.1 (sources MIT, DX12 et Vulkan) pour les cartes non NVIDIA.

À écarter dans la page : FSR 4 et XeSS, impossibles. En natif, XeSS-SR reste envisageable pour Intel, sa licence autorisant la redistribution du binaire sans modification.

Réseau neuronal maison : rien avant NVIDIA-07 et une subgroup-matrix livrée. Estimation pour un réseau de type ESPCN à 3 couches :
- environ 15 000 MAC par pixel d'une entrée 720p, soit environ 28 GFLOP par image et 1,7 TFLOP/s à 60 images/s ;
- en WGSL naïf, à 10 à 25 % d'efficacité sur une carte de 30 TFLOPS FP32, entre 3,7 et 9,3 ms par image, contre 0,3 à 0,6 ms visés pour la TAAU ;
- s'il est tenté un jour, poids entraînés uniquement sur des images de FERRO suréchantillonnées (point à faire valider par David), 50 Ko au plus dans la page.

**Critère d'acceptation.** Un tableau de décision dans le README de FERRO, section Reconstruction, avec chaque technique, son statut, sa licence et son API. Aucun binaire d'un fabricant de GPU dans src/. Toute reprise de code MIT garde sa mention de copyright.

**Risques.** - Copier sans mention un code MIT, ou suivre par mégarde un code GPL.
- Coût d'opportunité si l'on se lance trop tôt dans le neuronal.
- Si le ticket gpuweb #11088 aboutit, les navigateurs pourraient un jour offrir un reconstructeur natif (MetalFX, DirectSR…) : le contrat de NVIDIA-03 le rendrait facile à brancher.

**Contre-vérification.** Licences et statuts relus : FSR 2 sous MIT ; FSR 4.1.2 en DLL signées pour RX 6000 à 9000 ; pmndrs sous MIT, WebGPU seul. Calculs vérifiés (estimation) : 720p × 15 000 MAC ≈ 13,8 GMAC, soit 27,6 GFLOP par image ; ×60 ≈ 1,66 TFLOP/s ; 3,7 à 9,2 ms à 10-25 % d'une carte de 30 TFLOPS.

**Correction.** La reprise de FSR 3.1 dans l'édition native tombe avec la décision du 12/11/2026. La licence XeSS n'a pas été relue.

## Ajouts du contre-vérificateur

### NVIDIA-V1 — Décision de David du 12/11/2026 : DLSS 5 et l'édition PC native sortent du plan ; recadrer l'axe NVIDIA sur le navigateur
- type exigence · priorité P0 · effort S · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** Le rapport présente DLSS 5 et l'édition native comme des décisions ouvertes (NVIDIA-01 en P0, NVIDIA-08, NVIDIA-09 en P1). David les a tranchées dans cette même session, 11 minutes après la demande (4), dès qu'on lui a dit que DLSS 5 ne marche pas dans un navigateur. Ses décisions datées priment. Un master prompt qui les rouvrirait ferait travailler Codex pour rien.

**Preuve.** Journal de conversation KBZA (privé), session claude-code:e16d3c39-dad4-44c7-b4df-971eba017053 :
- séquence 49, assistant, 12/11/2026 16:41:15 UTC (sha256 0786d2848dee…) : « Si tu veux tout de suite une vraie édition PC native avec DLSS, dis-le » ;
- séquence 50, David, 16:43:31 UTC (sha256 f7a985a150d2…) : « non osef dlss 5 pas grave » ;
- séquence 51, assistant, 16:43:53 UTC (sha256 50cf9ed79e1c…) : « D'accord, DLSS 5 sort du plan, et l'édition PC native avec ».
La demande (4) date de la séquence 47, à 16:32:13 UTC.

**Proposition.** Dans le master prompt :
- supprimer NVIDIA-08, NVIDIA-09, la porte 3 de NVIDIA-01 et l'essai Deno de NVIDIA-07 ;
- justifier NVIDIA-02 à 06 par la reconstruction et l'éclairage de FERRO, sans parler de DLSS ;
- écrire dans README.md (section Limites) et VERSIONS.md de FERRO : « DLSS indisponible dans le navigateur ; DLSS 5 et édition native non poursuivis, décision de David du 12/11/2026 » ;
- garde-fous : aucune DLL ni aucun en-tête NVIDIA (nvngx, Streamline), aucune version non officielle de DLSS 5 ;
- garder le contrat d'image de NVIDIA-03 : il sert la TAAU et laisse l'option ouverte sans coût supplémentaire.

**Critère d'acceptation.** Le master prompt ne contient aucune tâche native ni DLSS. git grep -niE 'nvngx|streamline|sl.dlss' ne renvoie rien dans FERRO, METAL, BITUME et PDR. README et VERSIONS de FERRO citent la décision datée. Aucune question n'est reposée à David sur l'accès au SDK DLSS 5.

**Risques.** David peut changer d'avis : le contrat d'image garde l'option ouverte. La preuve vient du journal privé de la session ; la session qui rédige le master prompt est la même et peut la relire.

### NVIDIA-V2 — Machines de mesure NVIDIA : david-pc est sous Linux (X11) et injoignable ; la cible Windows/Optimus disponible est le portable labo RTX 5060 Laptop
- type risque · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** Les critères de NVIDIA-04 à 06 visent « Chrome et Edge pour Windows sur david-pc ». Or les notes décrivent un david-pc sous Linux avec Xorg, qui ne répond plus en SSH. Sous Linux en X11, Chrome n'active pas WebGPU sur NVIDIA, Streamline n'existe pas et le minuteur WebGL2 est moins répandu. La seule machine Windows NVIDIA récente des notes est un portable RTX 5060 Laptop : c'est elle qui peut valider le conseil Optimus.

**Preuve.** Notes KBZA :
- learnings/2026-08-04.md:18 (sha256 87857818…) : smoke « sur RTX 5090 3840x2160 via Xorg virtuel headless HDMI-Intel/nvidia :98 (… :0 = 2560x1440) » ;
- journal, session codex:01a14fbe-f184-7251-9aa8-dacde1c18961, 18/10/2026 16:01 UTC, David : « j'ai allumé david-pc le 5090 linux » ; réponse : ping OK, SSH refusé ;
- learnings/2026-09-20-mac.md:12 (sha256 91be3dc8…) : SSH en timeout ;
- learnings/2026-10-29-mac.md:13 (sha256 6245503a…) : portable labo « ce n'est pas le david-pc RTX 5090 », WebView2 présent, Smart App Control actif ;
- learnings/2026-10-04-mac.md:101 (sha256 1b9bd14a…) : « 11 sur Windows RTX 5060 Laptop/D3D12 ».

Sources web :
- https://github.com/gpuweb/gpuweb/wiki/Implementation-Status (02/10/2026) : NVIDIA sous Linux seulement en Wayland ;
- https://web3dsurvey.com/webgl2/extensions/EXT_disjoint_timer_query_webgl2 (consultée le 12/11/2026) : Linux 42,79 %, Windows 81,18 % ;
- ProgrammingGuide.md de Streamline (2.14.16) : Windows seulement.

**Proposition.** Le README du banc nomme deux cibles.
- (A) david-pc, Linux, RTX 5090 : Chrome stable en session X11 puis Wayland (WebGPU seulement en Wayland), pilote noté, sortie 2560×1440 puis 3840×2160.
- (B) Portable Windows RTX 5060 Laptop : Chrome et Edge. Premier passage avec la préférence GPU par défaut (puce intégrée attendue si Optimus), second passage en « Hautes performances » : ce couple valide le conseil de NVIDIA-05.

Le JSON de NVIDIA-06 reçoit les champs os, session ('x11', 'wayland' ou 'windows'), pilote, chaîne d'adaptateur et alimentation (secteur ou batterie). Les critères de NVIDIA-04 à 06 sont réécrits par cible. Les passages sont faits à la main par David, ou par une session qu'il a autorisée explicitement.

**Critère d'acceptation.** Un JSON par cible et par passage, versionné dans mesures/nvidia/. La chaîne d'adaptateur montre la carte NVIDIA, et la puce intégrée au premier passage de B si le portable est Optimus. L'écart entre X11 et Wayland est noté. Plus aucun critère ne cite « Edge sur david-pc ».

**Risques.** - Machines éteintes ou injoignables : il faudra un passage manuel.
- Un portable à commutateur MUX n'est pas Optimus : il faudrait une autre machine pour ce test.
- Smart App Control bloque les outils non signés.
- Les notes sont historiques : revérifier l'OS et le GPU avant de mesurer.

### NVIDIA-V3 — Passe finale HDR : particules, ciel, MSAA et bloom changent d'image ; les traiter avant de promettre la parité
- type risque · priorité P1 · effort M · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** NVIDIA-02 promet un écart d'au plus 2/255 en déplaçant tonemap et effets d'écran dans une passe finale. Quatre détails du code de la 0.2 l'empêchent, et l'un touche l'anticrénelage MSAA que PDR exige pour ses lignes fines.

**Preuve.** FERRO src/renderer.js @248043a :
- 498 : les particules font c/(c+0,76) puis le gamma avant la sortie ; 1575 : mélange SRC_ALPHA, ONE_MINUS_SRC_ALPHA ;
- 549-551 : le ciel applique une vignette mix(.76,1,·), sans voile ni onde ; 428-437 : le monde applique config.vignette, le voile uEffects.z et l'onde uEffects.w ;
- 1764-1768 : le MSAA est résolu par blitFramebuffer après un tonemap par échantillon ;
- 561-563 : le bloom est seuillé sur l'image déjà vignettée ;
- 1739-1740 : sans bloom, la scène va directement au canvas ;
- 1398 : PDR exige le MSAA.

WebGL 2 suit OpenGL ES 3.0, sans sampler2DMS. Guide DLSS 310.6.0, §3.1.

**Proposition.** 1. La passe finale lit la profondeur. Profondeur 1 (ciel) : vignette 0,76, sans voile ni onde. Ailleurs : config.vignette, voile et onde.
2. Avec hdr et msaa : écrire t = c/(1+max(c)), résoudre par blit, inverser c = t/(1−max(t)) dans la passe finale, puis appliquer le bloom et le vrai tonemap.
3. Particules, au choix : mode parité (dessinées après la passe finale, testées contre la profondeur) ou mode linéaire, avec un écart mesuré et accepté.
4. Bloom : appliquer la vignette dans bright(), ou accepter l'écart.
5. Avec hdr:true, toujours une cible hors écran.

**Critère d'acceptation.** Cinq scènes au banc : ciel dans les coins, voile à 1, onde à 0,5, particules, MSAA ×4 avec arêtes contrastées. Comparaison hdr:true contre hdr:false :
- les quatre premières, particules en mode parité : écart moyen ≤ 2/255 et PSNR ≥ 40 dB ;
- particules en mode linéaire : écart mesuré, capture jointe.

npm test reste vert.

**Risques.** - Le tonemap réversible perd en précision dans les hautes lumières en R11G11B10.
- En mode parité, les particules deviennent des pixels réactifs pour la TAAU.
- La passe finale fait une lecture de profondeur de plus.

### NVIDIA-V4 — Les surimpressions effacent la profondeur du monde : la capturer avant, pour la TAAU et tout reconstructeur
- type exigence · priorité P1 · effort S · jeux FERRO, METAL, BITUME
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** draw() vide le tampon de profondeur avant de dessiner l'arme de METAL et le cockpit de BITUME. Après cette passe, la profondeur ne contient plus que la surimpression et vaut 1, comme le ciel, partout ailleurs. La dilatation et la désocclusion de NVIDIA-04 seraient fausses sur tout l'écran. NVIDIA-03 marque bien les surimpressions dans le masque, mais ne parle pas de cet effacement.

**Preuve.** - FERRO src/renderer.js @248043a : 1759-1762 (gl.clear(gl.DEPTH_BUFFER_BIT), puis surimpressions et leurs particules) ; 1393 (profondeur en renderbuffer).
- METAL src/game.js:579 @673d6b2 : part.overlay=true pour l'arme.
- BITUME src/voiture.js:95-111 @e3bcb6b : overlay: true pour le cockpit.
- Guide DLSS 310.6.0, §2.2 et §3.6.

**Proposition.** Quand la reconstruction ou le mode hdr est actif :
1. La cible de scène a deux textures de profondeur, worldDepth et overlayDepth. Avant les surimpressions, on change l'attachement par framebufferTexture2D au lieu de vider la profondeur.
2. La TAAU et la passe finale lisent worldDepth.
3. Les pixels de surimpression portent le bit 1 du masque ; leurs vecteurs de mouvement sont calculés avec les matrices de l'arme ou du cockpit.
4. Avec MSAA, la profondeur est résolue par blitFramebuffer(DEPTH_BUFFER_BIT, NEAREST).

Sans réglage, le chemin de la 0.2 reste identique.

**Critère d'acceptation.** Banc : hors des pixels de surimpression, worldDepth après la passe des surimpressions est identique, texel par texel, à la profondeur d'avant cette passe. Dans METAL (arme) et BITUME (cockpit), aucun halo ni aucune traînée autour de la surimpression pendant un panoramique à 90°/s (capture jointe). Le test « sans réglage, mêmes commandes GPU que la 0.2 » reste vert.

**Risques.** - Une revalidation du framebuffer par image, coût faible.
- Une résolution de profondeur de plus avec le MSAA.
- La frontière entre l'arme et le monde reste un cas difficile : la marquer comme réactive.

### NVIDIA-V5 — Vecteurs de mouvement des acteurs : les jeux recréent leurs pièces à chaque image, sans identifiant, avec une échelle et un niveau de détail variables
- type risque · priorité P1 · effort L · jeux FERRO, METAL, BITUME, PDR
- contre-vérification : ajouté par le contre-vérificateur

**Pourquoi.** NVIDIA-03 suppose un mesh.id stable et ne garde que la position et la rotation précédentes. Dans METAL comme dans BITUME, les pièces sont des objets recréés à chaque image, sans identifiant ; leur nombre varie avec la distance et la qualité, et leur échelle change (anneaux de charge, pulsations). Sans travail dans les jeux, presque tous les acteurs seront réactifs et la TAAU ne leur apportera rien. Sans échelle précédente, les pièces qui grossissent laisseront des traînées.

**Preuve.** - METAL src/game.js:418-440 @673d6b2 : models() reconstruit à chaque image des m('cylinder',…), m('ring',[…],[r*2,.08,r*2],…) et FActors.build(e,{distance,quality,…}).
- BITUME src/voiture.js:106-111 @e3bcb6b : pièces poussées dans sortie à chaque appel, sans identifiant.
- FERRO src/renderer.js @248043a : 7-51 (iScale par instance, appliqué ligne 34) ; 1723-1724 (tri puis pack à chaque draw).
- PDR Jeu/src/foule.js:1-15 @5ac0066 : états précédent et courant en textures RGBA32F, interpolés par alpha ; foule lointaine dessinée en points.

**Proposition.** 1. Flux précédent de 48 o par instance : iPrevPosition, iPrevScale et iPrevRotation, ou une matrice 3×4.
2. mesh.id est un entier choisi par le jeu ; aide FRender.partId(entite, piece) = entite·256 + piece ; Map indexée par nombre, sans chaîne créée par image.
3. Une pièce absente de l'image précédente, ou dont la forme ou la matière a changé, est marquée réactive pendant une image.
4. Ordre : FERRO (flux, cache, repli réactif), puis METAL (FActors, FEffects, destruction), puis BITUME, puis PDR, qui calcule ses vecteurs dans foule.js à partir de ses deux états.
5. Mesurer d'abord la part de pixels réactifs dans l'arène de METAL.

**Critère d'acceptation.** - Test Node : un acteur scripté (translation, rotation, anneau dont l'échelle double en 1 s) donne des vecteurs à 0,05 px RMS au plus de la valeur analytique.
- Après la reprise, dans l'arène de METAL, au moins 95 % des pixels d'acteurs ont un vecteur valide.
- Aucune chaîne n'est allouée par pièce et par image.

**Risques.** - La reprise dans METAL touche plusieurs centaines de pièces par image : coût M à L, hors de FERRO.
- Une erreur d'identifiant donne des traînées.
- Les points de la foule de PDR demandent aussi un calcul de vecteurs.

## Questions ouvertes

- Quelle carte NVIDIA équipe exactement david-pc (une piste KBZA non validée dit RTX 5090) ? Avec quel pilote, quel écran (résolution, fréquence, HDR) et quels navigateurs ? La machine est-elle joignable pour le banc (SSH injoignable le 05/09/2026) ?
- Le « jeu photoréaliste » du 12/11/2026 remplace-t-il la ligne de BITUME qui écarte le photoréalisme (FEUILLE-DE-ROUTE.md:31-32 @e3bcb6b) ? Vaut-il aussi pour PDR, vu de haut ?
- Une édition native téléchargeable (Windows, NVIDIA) est-elle acceptable à côté de la page HTML unique ? Un usage commercial est-il envisagé ? La licence NVIDIA impose alors de prévenir NVIDIA avant la sortie et d'afficher ses marques à l'écran de démarrage.
- Faut-il demander à NVIDIA l'accès au SDK DLSS 5, réservé aux partenaires avec un accord de confidentialité probable, et au nom de quelle structure ?
- Une passe générative (DLSS 5, modèle d'environ 118 M de paramètres entraîné par NVIDIA) est-elle compatible avec la règle « contenu graphique généré par le code » ?
- PDR garde-t-il le MSAA ×4 par défaut (lignes fines vues de haut) plutôt que la reconstruction temporelle ?
- Quel budget d'octets accorder au backend WebGPU dans BITUME (1,4 Mo) et PDR (3 Mo) ?
- Chrome sous Windows ARM64 (PC RTX Spark) garde-t-il WebGPU derrière un drapeau ? La page d'état est ambiguë ; à vérifier si ces machines sont visées.
- Sources inaccessibles à recouper plus tard : la FAQ DLSS 5 du forum GeForce (bloquée sur un écran de chargement) et le ticket Chromium 329211593 (connexion requise). Le statut d'employé NVIDIA de l'auteur de la réponse du 09/11/2026 n'est pas affiché.