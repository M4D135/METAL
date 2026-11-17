# METAL 0.12.8 : composants originaux et demos de combat

Base : `ba2784517b99b092c404df38a8408f2733cc2221`.

## Corrections

Les ennemis se separent en groupes de composants de leur modele original : formes, dimensions, couleurs et materiaux conserves. Les boites de collision restent invisibles. Suppression de la pluie de cubes a la mort ; impacts representes par des trainees lumineuses, pas des blocs solides. Corps physiques limites, composants groupes sans remplacement par des cubes, sauvegardes validees.

Six demos de combats ordinaires utilisant la simulation actuelle, lourd et drone, sans presentation des boss. Camera de jeu puis camera suiveuse avec collisions. Changement de scene apres le combat, sans teleportation ni guerison forcee du personnage pendant une scene.

Pilote de demonstration : cheminement borne tenant compte du gabarit, des obstacles physiques, des pieges et des bords. Anticipation, freinage, contournement et replanification remplacent les coups et dashs de deblocage. Le repere de mouvement est corrige quand la visee tourne avant le deplacement. Ce lot ne remplace pas toute l IA des ennemis.

## Qualification

Suite complete du meme HTML : **1 350 reussites, zero echec, un TODO historique, 1 351 tests comptes**, execution 44045094131. Les preuves recuperees sont verifiees par empreinte SHA-256, et le HTML reconstruit est strictement identique. Modules FERRO : 34/34 verifies par le build.

Une verification supplementaire locale de reprise a reussi : 94 tests de geometrie, navigation, ragdoll, commandes, preferences et camera. Aucun changement de code produit apres la suite complete.

Le controle clavier precedent expirait pendant le chargement a 1280x800 sur GPU logiciel. Le banc utilise maintenant une fenetre 480x320, un delai borne plus large et des diagnostics de chargement ; aucune assertion clavier, horloge ou position du jeu modifiee.

Nouvelle execution Chrome : **10 controles combat et 14 controles clavier reussis**, rendu webgl2.

| Monde | Profil | Secondes | Tirs | Tues | Penetrations | Blocage consecutif max. | Boss visibles | Coups obstacles |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 8 | heavy | 32.0 | 22 | 3 | 0 | 0 | 0 | 0 |
| 14 | light | 32.0 | 6 | 3 | 0 | 0 | 0 | 0 |
| 4 | heavy | 32.0 | 10 | 2 | 0 | 0 | 0 | 0 |
| 11 | heavy | 32.0 | 13 | 3 | 0 | 0 | 0 | 0 |
| 17 | heavy | 32.0 | 22 | 3 | 0 | 0 | 0 | 0 |
| 6 | heavy | 32.0 | 8 | 2 | 0 | 0 | 0 | 0 |

Controles navigateur :
- title demo is actual gameplay with shots
- six current combat scenes without boss showcases
- current horde world and correct heavy profile
- normal combat produces a real kill
- wrecks render named original geometry, not collision boxes
- game follow camera used instead of boss orbit shots
- no boss killed or obstacle attacked
- no static penetration in observed scene
- Escape immediately returns to title
- no uncaught browser exception
- R view / C dodge defaults
- versioned preferences
- heavy starts active
- R switches view once despite repeat
- C dodge does not switch view
- drone descent is held
- release clears drone descent
- view rebind persists
- rebind leaves dodge unchanged
- conflict is reported
- conflict preserves prior key
- keyboard reset restores R/C
- HUD key labels follow reset
- no uncaught page exception

HTML : 13660361 octets bruts ; gzip : 3209779 ; SHA-256 `0a08aabba483e79d1717d67c45084e984af68ae3e3997d0cdede8e2be967c8ca`.

Suite complete : https://github.com/M4D135/METAL/actions/runs/44045094131

Validation finale : https://github.com/M4D135/METAL/actions/runs/44050130384

## Limites

Qualification sur six scenes fixes et cas de regression, pas une garantie universelle d absence de bug. GPU logiciel : aucun gain FPS materiel revendique. Pas de telephone ou manette physique testes. Les deplacements Quake III et le vol quaternion 6DOF ne font pas partie de ce lot. Aucun hebergement externe modifie.
