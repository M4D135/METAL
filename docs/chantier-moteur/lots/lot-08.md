# Lot 08 — Entrées : manette et tactile
## But
Rendre le jeu entièrement jouable à la manette (mapping standard, courbes mesurées, vibration, menus navigables). Un module FERRO générique (lecture, zones mortes, fronts, vibration) sert METAL et le prototype ; le mapping FPS reste dans METAL.
## Tâches, dans l'ordre
### T1 — Module manette FERRO + intégration METAL [FEEL-10]
- Où : src/gamepad.js (nouveau) ; tools/build.py:6 ; src/game.js:18 ; src/game.js:683-690 ; src/game.js:813 ; src/simulation.js:848
- Quoi : Créer `FGamepad.create(prefs).poll(dt, ctx)` en fonction pure (pas de DOM). Récolter la lecture générique depuis BITUME `jeu.js:219-246` (zones mortes radiales, fronts montants via `pad.precedent`, gâchettes analogiques). Mapping METAL : LS déplacement, RS visée, L3 sprint, R3 mêlée, RT tir (hystérésis .30/.18), LT garde, A saut, B esquive, X interagir, Y arme suivante, LB onde, RB main gauche, croix armes 1-4 et carte, Start pause, Back carte. Réglages mesurés : zone morte radiale .12/.97, expo 1,7, lacet 300°/s, tangage 190°/s, boost +80 % après 0,18 s à r > 0,95. Fusion dans `frame()` avant :683 : garder la plus forte magnitude entre clavier et stick ; `lookX += yawRate·dt`. Impulsions en OU logique avec les files existantes. `input.assist = touch || padActive`. Corriger le bonus .38 m de l'arme 0 à simulation.js:848 (ne pas l'activer par la manette seule). Vibrations `vibrationActuator.playEffect('dual-rumble')` selon la table (SMG .12/45 ms, Pompe .55/.35/140 ms, Roquette .6/.3/180 ms, Coup reçu .45×min(1,dmg/20)/160 ms, Explosion .7×(1−d/12)/250 ms, Impact boss .8/300 ms), limiteur 40 ms. Ajouter le module dans `tools/build.py:6` entre options.js et game.js.
- Preuve exigée : `gamepad-map.mjs` converti en test unitaire node. Seuils : lacet 5,4°/s à 20 %, 76°/s à 50 %, 300°/s à 100 % ; demi-tour 483 ms ; déplacement 2,63 m/s à 55 %, 7,60 m/s à 100 %. Hystérésis RT vérifiée (front montant verrouillé, seuils .30/.18).
- Qualité : meilleure (jeu jouable de bout en bout à la manette).
- Garde-fous : déterminisme — `input.assist` passe à vrai à la manette, vérifier que la simulation reste identique à pas fixe (empreinte d'état). Taille +6 à 9 Ko sur budget 1 400 000 octets (actuel 789 111). Safari/Firefox : manette invisible avant premier appui → stub `navigator.getGamepads` dans le harnais `checkpoint.test.mjs`. Aucun port réseau, aucune dépendance externe.
- Dépend de : rien.

### T2 — Navigation menus, libellés dynamiques, branchement à chaud [FEEL-11]
- Où : src/game.js:35 ; src/game.js:62 ; src/game.js:157-163 ; src/game.js:223 ; src/game.js:608-617 ; src/game.js:812 ; src/options.js:29-35 ; index.html (aide, bandeau capacités, titre armes)
- Quoi : Réutiliser l'ordre linéaire du focus de BITUME `jeu.js:250-263` dans FERRO (curseurs gauche/droite sur les ranges, A valide, B revient, LB/RB changent d'onglet via `selectTab`). Ajouter `padBindings` dans `FOptions` (defaults, normalize, assign symétriques au clavier). Créer `promptLabel(id)` : renvoie le glyphe manette (Xbox A/B/X/Y ou PlayStation ✕○□△ selon `pad.id`), la touche clavier ou l'invite tactile selon le dernier périphérique ; remplacer `keyName` et les textes figés de game.js:163, :223, :157-158 et index.html. Branchement à chaud : toast `gamepadconnected`, pause `gamepaddisconnected`, `body.pad` masque les commandes tactiles, supprimer le toast `lock()` et la pause `pointerlockchange` (game.js:812) quand la manette est active. Vérifier qu'un appui manette démarre l'AudioContext, sinon afficher « A : activer le son ». Section « Manette » dans les options (sensibilité °/s, zone morte, courbe, inversion, assistance, vibration on/off).
- Preuve exigée : test DOM — navigation du focus dans `#pause` dans les 4 directions, A clique, B revient. `options.test` : `normalize` de `padBindings` idempotent. `promptLabel` renvoie le bon glyphe selon le périphérique simulé. Essai manuel avec une manette Xbox et une PlayStation par David.
- Qualité : meilleure (parcours menu → partie → boutique sans souris, invites justes AZERTY/QWERTY/tactile/manette).
- Garde-fous : migration des options (versionner `padBindings`, fallback si absent). AGENTS.md : focus visible obligatoire (outline CSS). Taille +3 à 5 Ko. Activation AudioContext par la manette : à valider sur appareil réel (Safari iOS). Déterminisme non concerné (couche affichage uniquement).
- Dépend de : T1.

## Options désactivées par défaut
- (aucune — aucun constat de ce lot n'est de qualité « dégradée »)

## Écartés ou absorbés
- [LOOP-07] — Absorbé par FEEL-10 sur arbitrage. Ses valeurs (zone morte .18/.12, courbe r^2,2, 4,2 rad/s soit 241°/s, A = esquive) sont remplacées par les réglages mesurés de FEEL-10 (.12/.97, expo 1,7, 300°/s, A = saut, B = esquive). Le verrou de tir de LOOP-06 est conservé.

## Décisions à confirmer par David
- Bonus d'assistance .38 m de l'arme 0 (SMG) à simulation.js:848 quand `input.assist` est vrai via la manette — valeur par défaut proposée : désactiver ce bonus à la manette, le réserver au tactile.
- Démarrage de l'AudioContext par un bouton de manette (A au premier écran) — valeur par défaut proposée : oui, avec message « A : activer le son » si le contexte reste suspendu.
- Navigation de menus : ordre linéaire BITUME (jeu.js:250-263) ou navigation spatiale (score distance + 2× écart perpendiculaire) — valeur par défaut proposée : ordre linéaire BITUME, plus simple et déjà éprouvé.

## Gains attendus du lot
Le jeu devient jouable de bout en bout à la manette (visée fine 0,09°/image à 20 %, demi-tour 0,48 s, déplacement 7,60 m/s) avec menus, boutique et options navigables sans souris ni clavier. Coût combiné : +9 à 14 Ko sur le budget (reste ≈ 775 Ko de marge). Aucun impact sur le déterminisme de la simulation ni sur le format de sauvegarde.
