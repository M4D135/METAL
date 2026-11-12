# METAL — chantier moteur, fluidité et ressenti

Master prompt pour l'agent de développement. Rédigé le 12 novembre 2026 à partir d'un audit mesuré de METAL 0.8.0 : 335 constats sur 21 axes, contre-vérifiés par un second auditeur.

## 1. Mission

Tu travailles dans le dépôt du jeu **METAL** (`M4D135/METAL`, branche `main`, version 0.8.1). C'est un FPS 3D procédural pour navigateur, en JavaScript sans dépendance, rendu WebGL2, livré en une page HTML.

Ta mission, dans cet ordre :

1. **Rendre le moteur parfaitement fluide**, partout, sans rien perdre en qualité ni en résolution.
2. **Améliorer le ressenti** : bouclier, armes, déplacements, manette.
3. **Ajouter** : mode démo qui dure, ciel moderne, physique d'objets, puis une image plus réaliste.

METAL est la base de référence du moteur FERRO. Il n'existe pas de dépôt moteur séparé : tout se fait ici. Écris le code moteur de façon générique, sans dépendance au contenu du jeu, car les autres jeux le recopieront.

## 2. Le dossier d'audit

Tout est dans `docs/chantier-moteur/` de ce dépôt. Les chemins cités dans les fiches et les constats (`lots/…`, `constats/…`, `bancs/…`) sont relatifs à ce dossier.

| Chemin | Contenu |
|---|---|
| `MASTER-PROMPT.md` | Ce fichier. |
| `lots/lot-NN.md` | Une fiche par lot : les tâches, dans l'ordre, avec la preuve exigée pour chacune. |
| `constats/<AXE>.md` | La source de vérité : preuves, mesures, propositions, contre-vérifications. |
| `constats/INDEX.md` | Tous les constats, avec verdict et priorité. |
| `constats/ARBITRAGES.md` | 18 conflits entre constats, et la solution retenue pour chacun. |
| `bancs/` | Les scripts de mesure de l'audit, et les prototypes sous forme de patchs. |
| `ciel/` | Captures du ciel actuel et du prototype de nouveau ciel. |

À savoir avant de lire :

- **En cas d'écart entre une fiche et un constat, le constat et sa contre-vérification priment.** Les fiches sont un premier jet rédigé par un modèle local à partir des constats, puis contrôlé. Signale toute incohérence dans ton compte rendu.
- **Les références `fichier:ligne` visent METAL 0.8.0 (commit `673d6b2`).** Depuis, la 0.8.1 a modifié `src/game.js`, `src/audio.js`, `src/music.js`, `src/index.html` et `src/style.css`. Les autres sources n'ont pas bougé. Pour ces cinq fichiers, retrouve le code par son extrait, pas par son numéro de ligne.
- **« FERRO » dans les constats** désigne les modules moteur de METAL : `src/renderer.js`, `audio.js`, `music.js`, `motion.js`, `options.js`. Ignore ce qui parle d'un dépôt FERRO séparé, de « récolte », d'étiquettes de moteur, de BITUME ou de Point de rupture.
- Chaque constat porte un verdict : confirmé (preuve indépendante), plausible (cohérent, non reprouvé), réfuté (écarté), ou « non contre-vérifié ». Traite un constat plausible ou non contre-vérifié comme une hypothèse : reproduis sa mesure avant de coder.
- Certaines fiches se terminent par une section « Mise à jour après contre-vérification ». Elle prime sur le texte des tâches.

## 3. Règles non négociables

Ce sont les demandes de David.

1. **Fluidité d'abord.** Temps d'image stable partout : mondes, colosses, menus, transitions, à 60, 120 et 144 Hz. Aucune tâche ne doit ajouter de saccade.
2. **Aucune perte de qualité ni de résolution.** Le rendu se fait à la résolution native de l'écran et n'est jamais baissé automatiquement. Une optimisation doit donner une image, un son et un jeu identiques ou meilleurs, preuve à l'appui. Ce qui dégrade devient une option désactivée par défaut.
3. **Murs.** Ils ne cèdent qu'au lance-grenades et au lance-roquettes. Le reste du décor reste cassable par toutes les armes.
4. **Ressenti.** Le bouclier doit vraiment protéger. Les armes doivent sonner fort, façon Doom. Les déplacements doivent être vifs, inspirés de Quake 3 (concepts seulement, aucun code GPL). Le jeu doit se jouer à la manette.
5. **Mode démo qui dure** sur l'écran titre.
6. **Ciel moderne** et **physique d'objets digne de Half-Life 2**.
7. **PC à carte NVIDIA** : en tirer parti dans le navigateur. DLSS est abandonné, il n'y a pas d'édition native.

## 4. Invariants techniques

- Respecte `AGENTS.md` : tout est généré par le code (aucun asset importé, aucun CDN, aucune bibliothèque externe, aucun WASM importé) ; vraie scène 3D, avec un rendu de secours qui suit la même scène ; page autonome `dist/index.html` reconstruite par `python3 tools/build.py` ; `SIZE.json` fait foi, 1 400 000 octets bruts au plus (803 375 aujourd'hui) ; téléphone, tactile, AZERTY et QWERTY.
- **Déterminisme.** La simulation n'utilise ni `Math.random`, ni horloge. Garde-la ainsi. Une tâche dite « état identique » se prouve par l'égalité de l'empreinte d'état sur les rejeux de référence.
- **Sauvegardes.** Les points de reprise existants doivent rester lisibles. Tous les changements de format sont regroupés en **une seule révision**, en fin de chantier simulation (lot 12).
- **Tests.** Avant tout changement, lance `npm test` sur `main` intact et archive la liste des échecs : c'est ta référence. Sur la machine d'audit (Node 24.18, macOS arm64), `checks/campaign-world.test.mjs` a **8 tests rouges sur 46** sur `main` : les 6 empreintes de mondes historiques, « campaign mode is strictly opt-in… » et « the first three campaign worlds preserve historical geometry… » (constat MURS-V1). La 0.8.0 a modifié `src/world.js` sans mettre à jour ces empreintes. David te confie ce point : traite-le en premier (lot 01, décision en tête de fiche), et dis dans ton compte rendu si ces 8 tests sont rouges aussi chez toi.
- Ensuite, aucun commit ne doit ajouter d'échec à cette référence. N'affaiblis jamais un test pour le faire passer. Si une tâche change volontairement un comportement testé, mets le test à jour dans le même commit et dis-le.
- **Mesure.** Un contexte `node:vm`, celui des tests, ralentit le code de 4,5 à 9 fois et fausse les profils. Mesure dans le domaine principal de Node (voir `bancs/sim/fast.mjs`). Sur une machine chargée, n'utilise que des comparaisons appariées et alternées dans un même processus.

## 5. Méthode de travail

1. **Reproduis d'abord.** Avant de toucher au code d'une tâche, relance le banc cité et note le chiffre de départ.
2. **Une tâche, un commit.** Le message cite les identifiants des constats et donne le chiffre avant et après.
3. **Trois classes de preuve.**
   - *État identique* : même empreinte d'état que la référence, sur les scénarios du lot.
   - *Image identique* : différence nulle, pixel par pixel.
   - *Visuellement identique* ou *meilleure* : écart maximal par canal donné dans la fiche, plus une capture avant et après.
4. **Si un gain annoncé ne se reproduit pas** (moins de la moitié), arrête la tâche, note-le, passe à la suivante. Ne force pas.
5. **Ne commence pas un lot que tu ne peux pas finir proprement.** Un lot se termine par : build, `npm test`, tableau de mesures, entrée dans `VALIDATION.md`, `SIZE.json` à jour.
6. **Branches.** Une branche par lot, `chantier/lot-NN-nom`, partie de `main`. Une demande de fusion par lot. Ne déploie rien et ne change pas le numéro de version sans l'accord de David.
7. **Compte rendu.** Tiens `docs/chantier-moteur/RAPPORT.md` : par lot, les tâches faites, les mesures avant et après, les tests, les tâches abandonnées et pourquoi, et ce qui reste à vérifier sur du vrai matériel (téléphone, PC Windows à carte NVIDIA, Safari, Firefox).
8. **Décisions de David.** Chaque fiche liste des « Décisions à confirmer par David », avec une valeur par défaut. Applique la valeur par défaut, et recopie la question dans ton compte rendu.

Pour les bancs :

- Lance-les depuis la racine du dépôt : `node docs/chantier-moteur/bancs/sim/ab2.mjs …`. Ils mesurent le dépôt courant. Pour mesurer une autre version, donne sa racine dans la variable `METAL_ROOT`, ou en premier argument quand le script l'accepte.
- Pour rejouer une mesure de référence sur la version auditée : `git worktree add ../metal-080 673d6b2`, puis `METAL_ROOT=../metal-080`.
- Dans une fiche ou un constat, `bench/X` veut dire `bancs/X`, et `<ferro>` ou `<racine>` désigne la racine du dépôt à mesurer.
- Les fichiers `*.patch` de `bancs/` sont les prototypes de l'audit : la différence entre METAL 0.8.0 et la version modifiée qui a servi à la mesure. Lis-les avant de coder la tâche correspondante. Ce sont des prototypes, pas du code à fusionner tel quel.
- Les dossiers `bancs/*-verif` et `bancs/*-verif2` sont ceux des contre-vérificateurs : des mesures refaites de façon indépendante.
- Les bancs ont été écrits pour une machine précise. Si un script échoue pour une raison de chemin ou d'outil absent, corrige-le ou écris l'équivalent, et dis-le. Les pages de mesure GPU demandent un navigateur ; sans navigateur, signale les preuves d'image que tu n'as pas pu produire.

## 6. Décisions déjà prises

- **Boucle à pas fixe.** La simulation passe à un pas fixe de 1/60 s, avec accumulateur, verrouillage sur la période de l'écran, rattrapage borné à 5 pas et interpolation de rendu. La rotation de la vue reste appliquée à chaque image, pour ne pas ajouter de latence. C'est la conception mesurée de STAB-06 (lot 07) : une seule empreinte d'état quel que soit l'écran, et 15 à 49 % de calcul de simulation en moins selon la fréquence de l'écran. Elle remplace l'arbitrage antérieur en faveur d'un pas variable (LOOP-05, dans `constats/ARBITRAGES.md`). Le déplacement du joueur et la physique se sous-divisent en interne à 1/120 s. Le lot 07 vient après les lots 02 à 04, et avant le déplacement, la physique et le rejeu de démo.
- **En attendant le lot 07**, corrige la formule actuelle en une ligne (STAB-V1, dans le lot 01) : aujourd'hui, à 60 Hz, deux images sur trois font deux pas de simulation au lieu d'un.
- **Destruction.** Une seule interface de « delta de révision » (ajoutés, retirés, zone touchée, numéro), consommée par la navigation, les gravats, l'index du rendu et les caches d'ombre. C'est le lot 03.
- **Résolution et cadence.** Rendu à la résolution native, jamais modifiée. La cible par défaut est 60 images par seconde constantes. Sur une machine qui ne les tient pas à la résolution native, le jeu se cale sur 30 images par seconde constantes. La constance passe avant la cadence : jamais d'oscillation entre deux cadences en cours de jeu. Une cadence plus haute (120, 144 Hz) est une option du joueur. Le gouverneur de qualité ne touche plus à la résolution ; le joueur garde une option explicite pour la baisser.
- **Hors du fil principal.** Sortent du fil principal : la génération du monde, la cuisson de la navigation, les points de reprise et la synthèse des sons. La simulation, elle, reste sur le fil principal : dans un worker, elle ajoute une image de latence (mesuré, PARA-V1). La page doit continuer à marcher ouverte en `file://`, sans `SharedArrayBuffer`, avec repli complet sur le fil principal.
- **Modules moteur.** Chaque nouvelle brique générique est un script autonome qui expose un global `F…` (boucle, entrées, mesure, démo, physique, ciel), sans rien savoir du contenu de METAL.

## 6 bis. Décisions de David du 12 novembre

Elles priment sur les valeurs par défaut des fiches. Les fiches concernées les rappellent en tête.

1. **Tests rouges sur `main`.** C'est à toi de t'en charger, avant tout le reste (lot 01).
2. **Cadence.** « 60 c'est ok par défaut, même 30 si on a une petite config, tant que c'est constant. » Toujours à la résolution native (lots 06, 07 et 15).
3. **Destruction.** « Avec roquette et grenade on peut vraiment tout péter sauf le sol. » Aux explosifs, tout casse sauf le sol, relief compris. Les armes légères ne cassent ni les murs, ni les murets, ni les toits, ni les piliers porteurs, ni le relief (lot 14).
4. **Touches.** Espace saute, R esquive, V frappe, et tout reste reconfigurable au clavier comme à la manette (lots 08 et 09).
5. **Physique.** Pas de saisie ni de lancer d'objets pour le moment. Tout le reste est voulu : explosions, décor cassé en débris physiques, machines détruites qui se disloquent ou s'effondrent (lot 17).
6. **Ciel.** 18 ciels distincts, un par monde (lot 16).

## 7. Les lots, dans l'ordre

Si `lots/lot-NN.md` n'existe pas encore, n'invente pas son contenu : finis le lot en cours et signale-le.

| Lot | Sujet | Dépend de | Ce qu'on attend |
|---|---|---|---|
| 00 | Outils de preuve et de mesure | rien | Empreinte d'état, faux WebGL2 qui compte, page de différence d'images, enregistreur de temps d'image, versés dans `tools/`. |
| 01 | Bugs bloquants | 00 | Points de reprise acceptés (2 sur 55 aujourd'hui), un seul pas de simulation par image à 60 Hz, tir jamais perdu, pointeur fiable, limiteur d'images exact. |
| 02 | Simulation : mêmes résultats, moins de calcul | 00 | Temps de simulation réduit de 40 à 60 % en combat, à état identique. |
| 03 | Destruction : un seul delta par révision | 02 | Une révision ne reconstruit plus tout (24 à 31 ms côté rendu aujourd'hui, plus toute la navigation). |
| 14 | Murs cassables seulement aux armes lourdes | 03 | La règle de jeu, et beaucoup moins de révisions de destruction. |
| 04 | Navigation et IA des ennemis | 02, 03 | Plus aucun pas de simulation bloqué par une recherche de chemin ; ennemis plus vifs. |
| 05 | Rendu : coût processeur, image identique | 00 | `draw()` réduit de plus de 70 %, dix fois moins d'allocations par image. |
| 06, 15 | Rendu : carte graphique, à résolution native | 05 | Résolution native tenue, 60 images par seconde constantes (30 en repli), plus aucune baisse automatique. |
| 07 | Cadence, échauffement, chargement | 02 à 05 | Pas fixe, plus de saccade « de première fois », chargement sans gel. |
| 08, 08b | Entrées : manette et tactile | 07 | Jeu et menus jouables à la manette ; tactile revu. |
| 09, 09b | Ressenti : déplacement, saut, bouclier, armes | 07, 08 | Les demandes de David sur le ressenti. |
| 10 | Colosses et équilibrage | 09 | Combats lisibles, bouclier utile, durée régulière. |
| 11, 11b | Audio : armes puissantes et mixage | rien | Tirs « façon Doom », mixage qui ne les écrase pas. |
| 12 | Sauvegardes : une seule révision de format | 02, 09, 10, 17 | Voir ci-dessous. |
| 13 | Mode démo qui dure, rejeu d'entrées | 01, 04, 07, 09 | Démo sur l'écran titre, qui tourne des heures ; rejeu servant de banc reproductible. |
| 16 | Ciel | 06 | Ciel moderne, distinct par monde, sans coût par image notable. |
| 17 | Physique de corps rigides | 03, 07 | Moteur maison, déterministe, par étapes. Sans saisie ni lancer d'objets pour le moment. |
| 18 | Image haut de gamme, PC NVIDIA | 06, 16 | Feuille de route : HDR, éclairage physique, anticrénelage temporel. À lancer sur décision de David. |

**Lot 12, sans fiche.** Regroupe en une révision de format tout ce que les autres lots demandent de changer dans les points de reprise : gravats (LOAD-05, point 2), fabriques à ordre de clés stable (SIM-05), version de physique du déplacement (FEEL-08, FEEL-09), attaques de colosse (BOSS-02), état des corps rigides (lot 17). La nouvelle version relit les anciennes. La validation dans `restore` reste atomique. Un seul lot de tests dans `checks/checkpoint.test.mjs`.

**Priorité immédiate :** 00, 01, 02, 03, 14, 04, 05, puis 06 et 15. C'est le cœur de la demande : moteur et fluidité. Les lots 07 à 18 viennent ensuite.

**Pour la première séance, qui est courte :**

1. Lot 00, tâche T1 seulement (chargeur dans le domaine principal, comparaison appariée, empreinte d'état). Pour le reste, sers-toi des bancs du dossier. Les autres tâches du lot 00 se feront après le lot 05.
2. Lot 01 : d'abord les 8 tests rouges (décision en tête de fiche), puis T1 (les points de reprise refusés sont le bug le plus grave), puis la correction d'une ligne de STAB-V1.
3. Lots 02, 03 et 04, dans cet ordre.
4. Lot 05 s'il reste du temps.

Mieux vaut trois lots finis et prouvés qu'un survol de dix. Arrête-toi à la fin d'un lot, pas au milieu.

**La navigation après une destruction apparaît dans trois fiches** (lot 02 T1, lot 03 T4, lot 04 T3). C'est un seul chantier, en deux temps. D'abord le lot 02 T1 (SIM-01) : invalidation locale, résultat égal à un recalcul complet. Ensuite la replanification sélective (IA-02, BOSS-08) : fais-la une seule fois, dans le lot 03 T4, et considère le lot 04 T3 comme déjà fait.

Trois causes font 96,7 % des images longues mesurées (STAB-01) : la reconstruction du rendu après une destruction, la recherche de chemin, et la destruction elle-même. Les lots 02, 03, 14 et 04 les traitent toutes les trois.

## 8. Ce qu'il ne faut pas faire

- Baisser la résolution ou la qualité d'image pour gagner des images par seconde.
- Additionner les gains annoncés : plusieurs constats mesurent la même saccade. Cite le gain combiné que tu mesures.
- Appliquer deux solutions concurrentes au même code : lis `constats/ARBITRAGES.md` avant chaque lot.
- Ajouter une dépendance, un asset, un appel réseau.
- Compter `docs/chantier-moteur/` dans la taille du jeu : seul `dist/index.html` est limité.
- Toucher à un autre dépôt que METAL, ou déployer.

## 9. Fini, pour un lot

- Toutes les tâches de la fiche sont faites, ou abandonnées avec la raison écrite.
- `python3 tools/build.py` passe et `npm test` n'a aucun échec de plus que la référence ; la page reste sous 1 400 000 octets.
- Chaque preuve exigée est jointe : empreintes, différences d'images, tableau avant et après.
- `VALIDATION.md` dit honnêtement ce qui a été testé en simulation, dans le navigateur, et ce qui attend un vrai appareil.
- `docs/chantier-moteur/RAPPORT.md` est à jour, avec les décisions laissées à David.
