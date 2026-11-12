# Campagne 18 mondes — audit préalable

Référence : GitHub `main`, commit `950f743221cdac0ff7c2af48d78a4a1a766e35d5` (0.6.0), puis correctif de chute préparé dans la même session. Les lignes ci-dessous sont celles du checkout après ce correctif ; elles servent de repères d'audit et évolueront avec les phases.

## Demande et livraison

Le cahier joint demande six chapitres de trois mondes, un pistolet initial, cinq découvertes d'équipement espacées, des salles-trophées et une adaptation à l'arsenal réellement possédé. Les messages suivants demandent de fusionner l'ensemble dans le jeu et d'ajouter une passe de détails, reflets et particules. Le travail est préparé sur `campagne-18-mondes`, validé par phases, puis destiné à `main` sans déploiement d'hébergement.

Le mode historique reste disponible sans troisième argument à `FWorld.create`. Le shell de la nouvelle expédition utilisera le mode campagne ; une ancienne sauvegarde à trois secteurs continuera à se charger explicitement dans son mode historique. Les musiques et biomes restent au nombre de trois.

## Inventaire des modifications

| Fichier et repère | Modification prévue |
| --- | --- |
| `src/world.js:36–40` | Signature optionnelle, index 0–17, décor `index % 3`, RNG indexé sans modifier les clés historiques 0–2. |
| `src/world.js:652–665` | Métadonnées campagne/index/chapitre, chaîne des passes de génération. |
| `src/world.js:673,958,1152` | Graines indépendantes des détails, nature et botanique intégrant aussi l'index. |
| `src/world.js:1457–1519` | Cinq emplacements, retrait des racks prématurés, calendrier d'armes, caches conditionnées à la possession. |
| `src/world.js:1522–1557` | Garnison finie par chapitre, spécialistes progressifs, identités préallouées des épreuves. |
| `src/world.js:1589–1596` | Validation des objectifs/trophées et des effectifs campagne. |
| `src/simulation.js:33–52` | Chemin arsenal à cinq entrées, inventaire valide sans mitraillette, main droite initiale 4, sentinelle finie de munition. |
| `src/simulation.js:90,167` | État et empreinte conditionnels de campagne. |
| `src/simulation.js:459–515` | Export des découvertes, achats et butin limités à l'équipement possédé, acquisition des trophées. |
| `src/simulation.js:549–628,970` | Épreuve, grâce de découverte, adaptation des engagés/cadence/dégâts et autorisation des armes explosives ennemies. |
| `src/simulation.js:875–901` | Pistolet précis, cadence 0,32 s, recul/événement distincts, réserve jamais consommée. |
| `src/simulation.js:1696–1887` | Sauvegardes atomiques à cinq emplacements, découvertes/épreuve, identité de monde, adaptation vérifiée. |
| `src/economy.js:35–61,95` | Profil économique inchangé ; options campagne propagées aux capacités, validation, cotation et transaction. |
| `src/brain.js:7,28,43,93,113` | Aucune modification requise : adaptation déterministe de gameplay indépendante du backend tactique. |
| `src/game.js:15–30` | Noms d'armes, loadout, cache des mondes distinguant les modes, musique par décor. |
| `src/game.js:73–112,128–170` | Enveloppe de sauvegarde campagne version 3, reprise historique explicite, 18 libellés et fin au monde 18. |
| `src/game.js:174–211` | Recul pistolet, annonce et point de reprise du trophée. |
| `src/game.js:355–385,439–513` | Présentation des trophées/objets et véritable modèle du pistolet en première personne. |
| `src/game.js:535–548,599–605,721,739` | HUD dynamique, réserve infinie affichée avec ∞, radar, cinq boutons/touches. |
| `src/index.html:42–52`, `src/style.css:86–90` | Cinquième emplacement, choix main gauche, aide, grille adaptée aux seules armes possédées en campagne. |
| `src/options.js:4,17–18` | Action weapon5 et migration des attributions sans écraser une touche personnalisée existante. |
| `src/audio.js:51,85–89,447–453,523–527,619` | Timbre de pistolet et sting trophée originaux, spatialisation des deux mains, priorités/volumes. |
| `src/motion.js:36–44` | Recul amorti propre au pistolet, purement visuel. |
| `src/renderer.js:179–201,266–278,318–328` | Préserver les détails sur métal teinté, enrichir les reflets analytiques et filtrer les petits reflets spéculaires. |
| `src/effects.js:105–138,183–194` | Particules et lumière de découverte dans les budgets existants. |
| `src/actors.js:115–138,300–308` | Détails géométriques proches avec maintien des volumes, cœurs, bouches et niveaux lointains. |

## Contrats retenus

- `FWorld.create(seed,index,{campaign:true})` produit `campaign:true`, `index`, `chapter`, et `stage=index%3`. Sans option, mêmes données historiques. La génération existante reste 6 ; l'identité campagne fait partie de l'empreinte conditionnelle.
- IDs conservés : 0 mitraillette, 1 double pompe, 2 roquettes, 3 grenades, 4 pistolet. Départ : armes `[false,false,false,false,true]`, munitions `[0,0,0,0,1]`, droite 4. Aucune valeur Infinity dans une sauvegarde.
- Le tir du pistolet émet `shot` avec `weapon:4` et la main concernée. Le shell choisit le recul `pistol`, l'audio choisit le timbre à partir de l'ID.
- L'état transportable séparé `campaign:{version:1,discovered:[...]}` utilise les clés fermées `pistol`, `shield`, `smg`, `shotgun`, `grenade`, `rocket`. Il n'est pas ajouté au profil économique strict.
- `world.trophies` relie un objet, une rencontre préallouée et une grâce de trois secondes ; `pickup.trophyId` et `encounter.requiresTrophy` portent le lien. L'événement `trophy` présente la découverte ; l'état simulé et sauvegardé en garantit l'unicité.
- Garnison et identités dépendent de l'index. Les plafonds d'engagement, dégâts et cadence s'adaptent à la possession réelle. Les caches conditionnelles sont masquées et refusées tant que leur arme manque. Les options de difficulté restent un multiplicateur supplémentaire.

## Phases et validations

Correctif préalable : chute, écran de mort et reprise sûre. Puis A : 18 index et sauvegardes ; B : pistolet et cinq emplacements ; C : calendrier ; D : trophées et épreuves ; E : adaptation et mesures ; F : documentation, distribution et version 0.7.0 ; G : détails/reflets/particules demandés ensuite, avant validation finale et fusion.

Chaque phase possède ses tests propres et repasse la suite. Les contrôles historiques restent actifs. Les comptages de géométrie éventuellement augmentés par G seront justifiés explicitement ; les volumes physiques, budgets d'effets et niveaux lointains restent contrôlés. Les mesures de simulation ou de rasterisation logicielle ne seront pas présentées comme une campagne jouée par une personne ou comme des FPS sur le matériel de l'utilisateur.

## Synchronisation GitHub

Le fetch Git HTTPS direct n'a pas d'identifiants dans cet environnement. La référence `main` et son arbre sont donc lus par le connecteur GitHub autorisé avant les commits ; les 43 fichiers de départ ont été comparés par SHA Git et mode. L'objet de commit de départ a été reconstruit et vérifié contre son SHA exact pour créer la branche locale depuis le véritable commit GitHub. Toute évolution concurrente de `main` sera examinée et intégrée avant la fusion, sans écrasement forcé.

## Validation de phase A

Suite complète : 301 tests réussis, 0 échec, en 122 097,156 ms pour node:test. Les 18 configurations historiques passent toujours ; les nouveaux contrôles couvrent 54 mondes (18 index × trois graines), 13 104 cibles accessibles et six empreintes historiques exactes. Le shell parcourt réellement ses transitions jusqu’au monde 18 et recharge les enveloppes v2/v3 dans leur mode respectif. Build : 694 793 octets bruts, SHA-256 `372e9ad42d72e92b5bea416850d86e936ca3d48a27e680678c6fecad87eb669d`, aucun asset externe.

## Validation de phase B

Suite complète : 311 tests réussis, 0 échec, node:test en 122 080,297 ms. Le pistolet est une arme à cinq emplacements avec modèle, son, recul, touches, molette, commande tactile et main gauche. Les tests vérifient sa cadence, sa précision et la réserve finie jamais consommée, le transport exact entre mondes et les transactions ne débloquant pas les trophées. Le contrôle de parité des trois premiers mondes exclut maintenant seulement les quatre champs de loadout ajoutés en campagne ; les six empreintes du mode historique restent strictes. Build : 700 006 octets bruts, SHA-256 `8f60654989be60a4eff240931552961fe6215d8ceaf298446843d553b8b7f9bf`, aucun asset externe.

## Validation de phase C

Suite complète : 313 tests réussis, 0 échec, node:test en 129 859,592 ms. Le calendrier autorise une unique première acquisition aux mondes 4/7/10/13/16 ; les racks précédents sont retirés en campagne. Les caches non possédées sont refusées par la simulation et masquées dans la scène comme dans les indications. Les transactions directes en boutique ne peuvent pas contourner les découvertes. Les fixtures des nouveaux tests de shell suivent maintenant le vrai calendrier, sans retoucher les tests historiques. Build : 702 274 octets bruts, SHA-256 `6181a920b513e48d821e07898810e35e94b01f4ad581caace333d44530f28586`, aucun asset externe.
