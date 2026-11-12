# Validation de FERRO 0.3.0 — Profondeur

Date : 12 novembre 2026.

## Distribution et périmètre

Dépôt privé : **M4D135/FERRO**, branche **main**. Jeu autonome : `dist/index.html`.

Hébergement existant : https://ferro-procedural-fps.garden-lake-2660.chatgpt.site

L'accès reste privé, réservé au propriétaire. Cette passe conserve les trois étages, les combats, les neuf relais et le gardien. Elle enrichit le décor, remplace le mouvement instantané par une accélération contrôlée et corrige le rendu des ombres et des joints. Aucun asset externe n'est ajouté.

## Mesure du build

Les valeurs exactes de taille brute, gzip et SHA-256 sont générées dans `SIZE.json` et vérifiées contre `dist/index.html`.

- HTML autonome : **189 736 octets bruts**, soit **189,736 ko** ou **185,29 Kio**.
- Gzip reproductible : **59 021 octets**.
- Budget utilisé : **13,55 %**.
- SHA-256 du HTML : `c7b0ffec4b1c90c294de36e7be99dab3af1206f6538e1af55b60eaded714c568`.

Le budget reste **1 400 000 octets non compressés**. Le navigateur et ses API sont exclus de cette mesure ; le HTML n'est pas un exécutable natif de même taille.

## Génération : 18 mondes, PASS

Six graines sur chacun des trois étages. Un flood fill indépendant utilise un disque joueur de rayon **0,28 m**, une grille de **0,25 m**, les sols et les obstacles, sans diagonale à travers les coins.

**750 positions contrôlées** : relais, sortie, soins, positions initiales des ennemis, centres des salles et liaisons. Les objectifs restent accessibles en traitant simultanément tous les évents comme dangereux. Les plans et colliders sont inchangés.

Les empreintes SHA-256 des données physiques et de checkpoint sont comparées à celles du générateur publié en 0.2 : **les 18 cas sont identiques**. Le générateur décoratif indépendant ne consomme pas l'aléatoire des placements existants.

Pour la graine 96 :

| Étage | Architecture conservée | Détails moyens | Microdétails | Total statique | Colliders | Sources ambiantes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Ateliers | 1 044 | 5 663 | 3 566 | 10 273 | 224 | 23 |
| Fonderie | 1 654 | 5 419 | 3 423 | 10 496 | 184 | 21 |
| Cœur | 1 340 | 6 494 | 3 946 | 11 780 | 218 | 24 |

Le maximum observé sur les 18 cas est de **11 795 primitives**, sous le budget de 12 000. Les microdétails ont une dimension maximale de 0,35 m. Les détails bas sont ancrés aux surfaces/empreintes existantes ; les réseaux suspendus et effets ambiants restent au-dessus des passages. Les écrans exposent une normale et des dimensions vérifiées.

## Simulation : 30 tests, PASS

Les **23 régressions précédentes restent inchangées** : murs minces, glissement, tirs en 3D et couvertures basses, surchauffe, esquive, collecte après dégât fatal, parcours ordinaire d'un niveau généré, armes, onde, télégraphes, charges, boss, score, évents, snapshots et protection de reprise.

Sept suites supplémentaires vérifient :

- Intensité analogique conservée et diagonales normalisées.
- Distance et trajet cohérents de 20 à 120 pas de simulation par seconde, y compris inversion et freinage.
- Accélération progressive, freinage rapide et visée immédiate.
- Transition de course liée à la vitesse réelle.
- Arrêt de la foulée et des animations quand un mur bloque le joueur, avec glissement encore possible.
- Esquive bornée à 0,2 s, sans boost résiduel ni prolongation d'invulnérabilité.
- Reprise des checkpoints version 1 au repos, même lorsqu'un ancien dash était enregistré.

Le moteur intègre le déplacement en segments physiques d'au plus 1/120 s. Le test de parcours neutralise les ennemis pour isoler la navigation ; les tests de combat sont séparés. Il ne remplace pas une campagne humaine entière avec tous les ennemis actifs.

## Présentation : 7 tests, PASS

Les ressorts de présentation sont indépendants de l'état de collision et de la visée. Les contrôles couvrent :

- Résultat identique à 20, 60 et 120 images/s pour une même cible de ressort et les mêmes impulsions.
- Retour au repos après l'arrêt du déplacement réel.
- Désactivation immédiate des variations de caméra par le réglage de confort.
- Recul borné, amorti, sans modification de la direction de tir.
- Variation progressive et bornée du champ de vision pendant la course et l'esquive.
- Roulis de caméra et distances relatives des pièces de l'arme conservés.
- Repères orthonormaux pour des angles arbitraires, y compris près d'une singularité d'Euler.

Les pas sonores sont déclenchés sur la phase de foulée réelle. Leur garde-fou audio ne supprime plus un pas sur deux. Les animations décoratives exclues en Économie sont filtrées avant la sélection des sources proches. Le mouvement de caméra du menu respecte aussi le réglage de confort.

## Vérifications navigateur

Contrôle dans Chromium avec le **rendu de secours Canvas 2D**, WebGL 2 étant indisponible dans ce navigateur :

- Accueil 03 / PROFONDEUR, démarrage et reprise d'un point d'entrée existant.
- Marche, course, esquive, rotation de visée, tirs de Fracture, changement d'arme et pause.
- Nouveaux détails inspectés au sas et dans le couloir ; contrôle du sol en vue oblique et près d'un mur.
- Joints de sol amincis et alignés dans le monde ; ombres au sol visibles dans les scènes contrôlées.
- Commandes tactiles, HUD, accueil et pause inspectés en cadres **390 × 844** et **844 × 390**.
- Changement d'arme et onde utilisés en portrait ; cycle Auto / Économie / Haute et désactivation/réactivation des mouvements utilisés en paysage.
- Aucun débordement constaté dans ces menus. Ces cadres ne valident pas le multitouch d'un appareil physique.

Des relevés ponctuels au premier plan ont donné environ **21 à 26 images/s** dans le sas et le couloir avec le décor enrichi, contre environ 6 avant limitation des détails. Ce sont des observations du renderer logiciel dans cet environnement, pas un benchmark matériel ni une promesse de performance sur toute la campagne.

Les pages temporaires de contrôle ne font pas partie du build distribué.

## Rendu avancé

Les appels du renderer, ses vrais shaders, matrices, buffers et paramètres ont été capturés puis rejoués dans **EGL / OpenGL ES avec Mesa llvmpipe**. Les programmes compilent et se lient, les framebuffers sont complets et les dessins s'exécutent sans erreur GL.

### Bandes d'ombre : cause reproduite et correctif vérifié

La première version du nouvel atlas produisait des bandes diagonales et verticales sur les murs. Leur disparition lorsque seule l'ombre de la torche était coupée a isolé le chemin concerné. La correction de pente PCF ne suffisait pas à elle seule. La déclaration explicite **`uniform highp sampler2D uShadowMap`** a supprimé les bandes ; revenir uniquement à la précision implicite les réintroduit dans la comparaison. Le défaut de précision de lecture de la profondeur est donc reproduit et expliqué dans cet environnement.

Les captures finales conservent les ombres au pied des caisses. Les vues oblique, rasante, au bord du cône, contre un mur, du monde enrichi et du mode Économie ont été inspectées. Le décalage de la torche a aussi été réduit pour rester dans le rayon de collision du joueur. Le bias utilise la normale géométrique ; chaque échantillon PCF tient compte de la pente du plan récepteur. Le bord et la portée des ombres sont fondus.

Le backend exact de la photo initiale n'est pas établi. Ces vérifications ne prétendent pas reproduire le navigateur ou le GPU de l'utilisateur. Les corrections Canvas et GLES ont été vérifiées séparément.

### Passes et ressources

En Auto et Haute, l'atlas contient les vues de deux plafonniers et de la torche ; chaque case mesure 512 ou 1024 pixels de côté. Économie coupe ombres WebGL et bloom. Aucun SSAO n'est ajouté.

| Cycle de vérification | Ressources créées | Détruites | Restantes |
| --- | ---: | ---: | ---: |
| Auto → Économie → Haute → Économie → Auto → dispose | 44 | 44 | 0 |
| Même cycle avec tous les FBO forcés incomplets | 44 | 44 | 0 |

Le second cas conserve un rendu direct et désactive les effets indisponibles. Matrices, instances et coordonnées projetées contrôlées sont finies.

Sur le monde de 10 273 primitives, vue du sas :

| Chemin et qualité | Statiques retenus | Écartés |
| --- | ---: | ---: |
| WebGL Auto | 2 788 | 7 485 |
| WebGL Économie | 1 423 | 8 850 |
| Canvas Auto | 637 | 9 636 |
| Canvas Économie | 359 | 9 914 |
| Canvas Haute | 1 148 | 9 125 |

La capture WebGL Auto emploie **17 appels de dessin**, bloom et trois passes d'ombre compris. Ces nombres décrivent cette vue et ne sont pas un budget garanti de toute la campagne. Le renderer testé mesure 50 086 octets, SHA-256 `e0605ed4a6a12a9174b8e0cc983b6ba59dddac34ae38ca161f49ec585201f264`.

Mesa llvmpipe est un rasteriseur logiciel. Ce test natif des shaders est distinct d'un essai WebGL dans un navigateur ou sur un GPU physique.

## Intégration et limites

Le build rassemble six modules JavaScript sans chargement réseau de code, modèle, texture, police ou son. La taille, le SHA-256 et le remplacement des marqueurs d'assemblage sont contrôlés par `checks/build.test.mjs`.

Les événements de simulation restent consommés après chaque sous-pas afin de ne pas perdre un relais pris avant un dégât fatal ultérieur dans la même image. Les sauvegardes restent locales au navigateur et à l'origine, sans synchronisation entre appareils.

Le secours Canvas emploie un tri de polygones et des ombres projetées simplifiées ; il peut encore montrer des limites aux intersections. Le sol est horizontal et les structures élevées sont décoratives. La boucle conserve au plus 0,12 s par image : une machine durablement sous environ 8 images/s ralentit encore la simulation.

Les essais décrits ne constituent pas une validation sur Safari/macOS ou iOS, sur GPU physique, ni une qualification du multitouch réel ou de l'équilibrage intégral de la campagne.
