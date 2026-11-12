# Lot 01 — validation finale de la branche réunie

Cette preuve porte sur **T1 + STAB-V1 + T2 + T3 (annulation tardive comprise) + T4**, après résolution des contextes communs. Les empreintes exactes des sources, des tests et de la distribution figurent dans `manifest.json`. Base main : `63668aca7045e62cd524973b226f21e9ec5703e8` ; source des décisions : PR #2, `6a17e08281b70feae33015d7059ef21717666ba3`.

## Suite complète et distribution

`python3 tools/build.py` puis `npm test` : **470/470 tests TAP, zéro échec, zéro ignoré**, plus les 18 cas du contrôle de monde et le contrôle de distribution, comptés séparément. Le journal complet est dans `npm-test.log.gz`. La baseline sur main était 422/422. Les 48 ajouts couvrent les comportements corrigés ; les détails des évolutions volontaires des tests historiques sont dans RAPPORT.md.

HTML autonome : **812 696 octets bruts**, 245 325 octets gzip, aucune ressource externe ; version **0.8.1**. SHA-256 : `4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a`. Les fichiers de preuve, les outils et le navigateur restent hors de la taille brute du jeu.

## Limiteur sur les sources finales

`node tools/frame-gate-profile.mjs <main-081> <branche-réunie>` : **63/63 scénarios synthétiques stables**, un seul diviseur après chauffe, zéro changement de diviseur, intervalle constant en nombre de rafraîchissements. Les trois familles d’horodatages et les valeurs par écran/cible sont conservées dans `frame-gate-final.json.gz`. Le choix est un diviseur entier proche, pas un plafond strict. Les spécifications contradictoires et les valeurs effectivement affichées sont expliquées dans le dossier T4.

## Essai limité dans le navigateur disponible

La copie de `dist/index.html` servie localement possède exactement le SHA-256 ci-dessus. Aucun hébergement de production n’a été changé.

Observé dans Chrome distant, fenêtre 1 363 × 936 :

- Titre METAL et badge V0.8.1 chargés ; musique d’accueil indiquée « Lecture · thrash metal original » après geste. Aucune écoute physique n’est revendiquée.
- Onglet Image lisible, libellé « Cadence visée », sélection de 60 puis 30 FPS utilisable.
- Onglet Commandes lisible ; « Accélération du système » désactivée par défaut, activation puis remise à zéro réellement observées.
- Lancement d’une nouvelle partie, HUD du monde 01 avec pistolet/bouclier, passage en pause puis onglet Image utilisable sans reprendre la partie.
- Le navigateur annonce **WebGL 2 indisponible**, utilise le **rendu CPU de secours** et affiche environ **1 FPS**. La capture automatique n’a pas été obtenue ; le message de visée par glisser apparaît. La cadence reste sur « Mesure… » dans ce contexte. Cet essai ne valide donc ni la calibration réelle, ni un écran 60/120/144 Hz, ni la capture brute sur souris physique.

Les captures [commandes](navigateur/controls.jpg), [partie CPU](navigateur/gameplay-cpu.jpg) et [Image en pause](navigateur/paused-image.jpg) documentent cette portée. Le texte accessible final est joint. Les vingt dernières entrées de console consultées concernent une extension du navigateur ; le résumé n’est pas une garantie exhaustive d’absence d’erreur.

Les scénarios de pause/cadence, d’échec de capture, d’annulation tardive, de reprise et de clic bref sont validés par les vrais modules dans un harnais déterministe. Les essais physiques **téléphone, PC Windows/NVIDIA, Safari et Firefox** restent à effectuer. Aucune comparaison pixel à pixel ni mesure GPU n’est revendiquée pour ce lot de corrections.
