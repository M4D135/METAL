# Rapport — lot « jeu-pieges-massifs »

Branche `chantier/jeu-pieges-massifs`, base du lot `1814b81558d7e3e6a80cbb8fcbbe3ccdee81cef4`.
La consigne de référence est `.relais/BRIEF.md` ; aucune fiche `lots/lot-*` ne couvre
ce lot. La règle de destruction reprise ici est celle du lot 14 (arme légère ≠ fin
d'un obstacle structurel).

Référence de tests au départ : **510 tests, 510 passés, 0 échec**
(`.relais/npm-test-base.log`). Résultat final, après le tour de contre-vérification :
**579 tests, 579 passés, 0 échec** (`.relais/npm-test-final.log`).

| Tâche | État | Commit | Chiffre avant → après | Preuves |
| --- | --- | --- | --- | --- |
| T1 brique `FPassages` | faite | `1f60b61` | 510 → 519 tests (+9 dédiés) | `docs/chantier-moteur/preuves/jeu-pieges-massifs/t1-passage/` |
| T2 pièges sur le chemin obligatoire | faite | `d004d3a` | banc : **27 échecs → 55/55** ; 3 pièges en cour → barrières sur le couloir | `…/t2-chemin-obligatoire/` |
| T3 densité, dégâts, lisibilité | faite | `d207bc1` | 3 → **30 à 42 machines** ; lame 18 → 26, presse 24 → 34, pics 18 → 24 | `…/t3-densite/` |
| T4 destruction | faite | `afcabea` | 55 → **58 tests** ; arme légère : destruction possible → **impossible** | `…/t4-destruction/` |
| Au-delà 1 — pas des machines | faite, **seuil de 5 % non atteint et assumé** | `e366203`, corrigé par `99596c3` | médiane appariée **−0,83 % à −10,92 %** selon scénario et run, `identical: true` | `…/au-dela-1-pas-de-pieges/`, `.relais/ab2-*.json` |
| Au-delà 2 — `FPassages` à la génération | **écartée** | rien | **0,35 %** de la génération (103 ms / 29 029 ms) | chiffres dans `…/au-dela-1-pas-de-pieges/` |
| Contre-vérification tour 1 — 5 problèmes | 4 corrigés, 1 seuil assumé | `7dc6600`, `99596c3`, `e193f53` | 577 → **579 tests**, 0 échec ; lame figée `-1,97` → repos `-4,35` | section « Contre-vérification et correctifs » |

## T1 — `FPassages`, la brique des passages obligatoires

`src/passages.js`, nouveau module, lit `window.FMath` au chargement comme
`src/world.js` et refuse de démarrer sans lui. Sept entrées : `grid`, `flood`,
`reaches`, `cuts`, `nearestFree`, `mandatoryLinks`, `tourLinks`.

- `mandatoryLinks` : les liens dont la suppression **déconnecte** un objectif
  (relais, sortie, objets) du chemin du joueur. C'est la définition operative de
  « obligatoire » — pas une distance, pas une intuition.
- `tourLinks` : les liens dont le retrait ne déconnecte rien mais allonge la
  tournée. Utiles pour densifier, jamais au prix d'un couloir sans alternative.
- `cuts` renvoie les points d'articulation ; `nearestFree` garantit qu'une machine
  posée ne tombe jamais sur un point de passage bloqué.

Deux pièges de plate-forme ont été corrigés sous banc, pas à l'aveugle :

1. `Math.hypot` de l'hôte est interdit pendant la génération (`checks/fmath.test.mjs`
   installe un `Math` qui le refuse) : la brique utilise `FMath.hypot2`.
2. `world.js` lisait `window.FPassages` au moment de `create()`. Or
   `checks/checkpoint.test.mjs` (LOAD-01) pose `window` le temps d'exécuter les
   modules puis le retire : la création plantait. `FPassages` est capté au
   chargement, à la ligne suivante de `FMath`.

Le module est branché partout où `world.js` est chargé : `tools/build.py`,
`tools/realm-loader.mjs`, `tools/platform-math.mjs`, `tools/campaign-profiles.mjs`,
`tools/boss-profiles.mjs`, `tools/gen-ab.mjs`, et les bancs qui listent les modules.

## T2 — plus aucun piège décoratif

Sur la base, le banc `checks/traps-mandatory.test.mjs` compte **27 échecs** sur les
mondes de référence : les pièges étaient posés dans des cours, à côté du chemin,
jamais dessus. Un secteur se traversait sans jamais rencontrer une machine.

Après T2, chaque barrière est posée **sur un lien obligatoire** calculé par
`FPassages`, et le banc passe **55/55** : le flood depuis le départ ne peut plus
atteindre la sortie sans croiser la batterie. Une barrière est un lot solidaire —
deux lames au moins, une presse pleine largeur, des pics — et non trois objets
éparpillés.

## T3 — le piège devient le danger du secteur

- **Densité** : la tournée gloutonne s'ajoute aux liens obligatoires → 6 à 7 coupes
  par secteur, **30 à 42 machines** par monde (3 sur la base).
- **Ordre d'implantation** : les liens vraiment obligatoires d'abord, la tournée
  ensuite. Sans cet ordre, le plafond de 40 machines pouvait évincer le seul couloir
  sans alternative au profit d'un couloir de confort.
- **Dégâts** : lame 18 → 26, presse 24 → 34, pics 18 → 24.
- **Lisibilité de loin** : lampe émissive sur chaque montant, deux barres d'alerte
  au-dessus du cadre, posées **hors du centre** pour laisser le ciel ouvert au point
  de circulation.

### Le défaut que le lot s'est trouvé lui-même

Des lames synchrones dans le même axe formaient un **mur continu** : le test
« A real generated level can be completed using navigation and ordinary
collision-respecting movement » a échoué. Ce n'était pas le bot qui était faux,
c'était le piège — une rangée synchrone ne laisse aucun instant où passer. Les lames
glissent désormais perpendiculairement au couloir, par intervalles, à phase décalée.
L'union des courses barre toujours le couloir sur toute sa largeur, mais on peut
passer.

Le bot de navigation a été rendu physiquement honnête en parallèle : il attend la
pièce qui barre sa case, fuit celle qui passe sur lui, fait un pas de côté s'il est
bloqué. **Aucun piège n'a été diminué pour le faire passer** — ni dégâts, ni course,
ni cadence.

## T4 — l'explosion démonte, l'arme légère abîme

```js
t.hp = Math.max(r ? 0 : 1, (t.hp ?? 18) - power * (r ? Math.max(.2, 1 - d / r) : 1));
```

Avec `r` rayon d'explosion : une charge peut mettre la structure à 0 ; un tir d'arme
légère ne descend jamais sous **1 point de structure**. Le cadre passe de résistance
12 à 40. Trois tests : une grenade réelle démonte la coupe ; 1 200 tirs de
mitraillette l'usent sans la détruire **et** marquent au moins une pièce (sinon le
test validerait aussi bien des tirs sans effet) ; et chaque groupe destructible de
piège porte **0 collier solide** — donc les détruire ne peut couper aucun chemin.

## Au-delà — mesuré, chiffré, et une piste écartée

Profil du pas (21 600 pas, `--cpu-prof`) : `updateEnvironment` 5,1 % + `trapPose`
3,1 %, soit **8 % du pas** imputables aux machines — le plafond de la piste. Deux
changements sans effet sur l'état : la requête spatiale n'est due qu'en course
(`hot || warning`), et la boîte de repos n'est plus recalculée ni reallocuée.

A/B apparié `tools/ab2.mjs`, `identical: true` sur les deux runs : **2,3 % à 10,3 %**
de gain de médiane appariée, positif dans les huit mesures. La moyenne est écartée
comme non fiable ici : dominée par des pics de ramasse-miettes (`maxUs` jusqu'à
62 ms pour un pas de 200 µs). Le gain n'atteint pas 5 % partout ; il est gardé parce
qu'il est réel, déterministe et dans le sens attendu, pas parce qu'il franchit un seuil.

**Re-mesuré après le correctif du raccourci (contre-vérification, `99596c3`)**, même
méthode, même machine, 6 scénarios × 5 répétitions × 1 800 pas, `identical: true` :

| scénario | gain run 1 | gain run 2 |
| --- | --- | --- |
| `legacy-s0` | 4,76 % | 2,27 % |
| `legacy-s2` | 10,92 % | 3,85 % |
| `campaign-w10` | 2,82 % | 2,17 % |
| `campaign-w16` | 5,13 % | 3,59 % |
| `campaign2-w1` | 2,63 % | 3,57 % |
| `campaign2-w10` | 0,83 % | 4,17 % |

Le seuil de 5 % de l'étape 2 de la mission n'est atteint sur **aucun** run à l'échelle
du lot (1 mesure sur 12 le dépasse), et la dispersion d'un run à l'autre est du même
ordre que le gain lui-même : les médianes sont des entiers de microsecondes et le
`maxUs` dépasse 50 ms pour un pas de 180 µs. **Le seuil est donc assumé plus bas pour
cette tâche** — c'est l'option que laisse la contre-vérification — et non présenté comme
franchi : la tâche est gardée parce que le gain est positif dans les 12 mesures, qu'il
ne change aucun état (`identical: true`) et qu'il ne touche ni qualité ni résolution.
La piste restante du profil, `updateEnvironment` hors pièges, n'appartient pas à ce lot
et n'est pas traitée ici.

Pour situer : contre la base du lot (3 machines par secteur), le pas avait coûté
**+14 % à +36 %** après la densification. Cette optimisation en rend une partie.

**Piste écartée** : `FPassages` à la génération, mesurée en enrobant les deux points
d'entrée appelés par `world.js` sur 360 mondes chronométrés → **0,35 %**
(103 ms / 29 029 ms). Rien à y gagner de mesurable ; `src/passages.js` n'est pas
touché.

## Contre-vérification et correctifs (tour 1)

Le contre-vérificateur a relevé 5 problèmes. Chacun est traité ci-dessous : reproduit
ou non, corrigé ou non, avec la commande et les chiffres. Les bancs de mesure sont sous
`.relais/` (non commités, hors dépôt) : `compare2.mjs`, `detail-diff.mjs`,
`plan-pin.mjs`, `emprise.mjs`, `densite.mjs`, `shortcut-probe.mjs`.

### 1. [majeur] la justification de la reglée des empreintes était fausse — **corrigé** (`7dc6600`)

Reproduit. Le commentaire de `checks/campaign-world.test.mjs` affirmait « Same world,
same layout, same supplies and garrison — only `traps` and the trap meshes of each
sector changed ». `node .relais/compare2.mjs .relais/base .` (81 mondes, 3 graines ×
{3 classiques, 6 campagne, 18 campagne V2}) répond `same=0 diffs=81 total=81` et, hors
les maillages de piège :

| champ qui bouge | mondes touchés | cause |
| --- | --- | --- |
| `pipes` | 81/81 | chaque barrière est poussée dans la liste d'exclusion que `spot()` honore (`src/world.js:1395`), pour qu'aucun collecteur ne se pose dans la coupe |
| `enemies` | 81/81 | `safeSupply` (`src/world.js:1487`) tient la garnison hors de l'emprise d'une machine, et les collecteurs solides des conduites ont bougé (`isWalkable`) |
| `encounterBays` | 74/81 | idem, baies recalculées sur le sol et les objets |
| `encounters` | 65/81 | idem, entrées et patrouilles |
| `ambience` | 27/81 | `destructibleId` rattaché au groupe le plus proche (`src/world.js:1467`), désormais un cadre de piège |
| `pickups` | 22/81 | idem `safeSupply` |
| `machinery` | 9/81 | `destructibleId`, comme `ambience` |

Ce qui **n'a pas** bougé, sur les 81 comme sur les 114 mondes : `rooms`, `corridors`,
`connections`, `spawn`, `exit`, `cores`, `bounds`, `walkable`, `mechanisms`, `doors`,
`lifts`, `jumpPads`, `hazards`, `outdoorBoundaries`, `bossArena`, `routeLength`,
`environment`, `trees`, `shops`, `progression`, `campaignProfile`, `natureStats`.
L'empreinte de ces 16 champs du plan est identique sur la base et sur la tête —
`c512762e3cf8f14c3ecb4611f38eb019807dff98891ab4547105e3b97c2be352`
(`node .relais/plan-pin.mjs .relais/base .` → `PLAN IDENTIQUE`).

Corrigé : le commentaire dit maintenant ce qui bouge réellement et pourquoi, et
l'affirmation « même plan » est devenue un **test** (empreinte épinglée, calculée hors
du chemin de production) plutôt qu'une phrase. Un second test vérifie qu'aucune entrée
de garnison ne naît dans l'emprise d'une machine (0 violation sur les 114 mondes, base
et tête). Sortir les positions de pièges de `chosen` n'a pas été fait : c'est ce qui
empêche un collecteur de conduite de se poser dans la coupe, et le faire ferait bouger
une deuxième fois les 114 empreintes pour un bénéfice nul côté joueur.

**Mesure annexée, non corrigée** : 17 `supply-1-cells` sur les 114 mondes se retrouvent
dans l'emprise d'une machine (0 sur la base). Ils restent **atteignables** — le banc
`checks/traps-mandatory.test.mjs` l'exige — mais sous la menace d'une machine. Le
générateur ne repositionne un approvisionnement que s'il n'est pas `isWalkable`, et une
machine ne rend pas une case non praticable. À confirmer par David : soit on accepte la
cellule sous menace (le piège punit la cueillette), soit on étend la relocalisation aux
cases dans l'emprise, ce qui fait bouger à nouveau ces empreintes.

### 2. [majeur] le raccourci « au-delà » figeait une lame arrêtée par un corps — **corrigé** (`99596c3`)

Reproduit, et le banc `tools/ab2.mjs` ne le voit toujours pas (`identical: true`) :
il faut un corps exactement dans la bande d'arrêt au pas où la course s'arrête.
`node .relais/shortcut-probe.mjs .relais/avant-au-dela .` (même monde, mêmes graines,
mêmes entrées) :

```
pas du contact : avant -1.9700 | tête -1.9700 -> identique: true
repos attendu : minZ -4.3500
arrêt sur le corps : avant -1.9700 (pas 68) | tête -1.9700 (pas 68)
après retrait : avant -4.3500 | tête -1.9700 FIGÉE
DIVERGENCE: OUI
```

Une lame stoppée par un corps pendant son dernier pas en course restait figée à sa
position bloquée, et sa boîte continuait d'entrer dans `trapBoxes` — donc dans la
collision — jusqu'à la course suivante, soit une période entière (6,4 à 11,9 s).

Corrigé comme proposé : la condition ne porte plus sur `t.box` seule mais sur un
drapeau `t.boxAtRest`, tenu vrai seulement quand la pièce est au repos **et** que la
pose calculée ne porte aucun contact (`pose.contacts.length===0`,
`pose.progress===progress`) ; le premier pas qui suit un contact repasse donc par
`trapPose`. Le drapeau est hors de la liste blanche `TRAP` (`src/simulation.js:27`) :
**format de sauvegarde inchangé**, et le `restore` le remet à faux pour qu'une reprise
ne fige pas une boîte restaurée hors repos.

Test de non-régression ajouté au banc : « un corps dans la bande d'arrêt d'une lame ne
la fige pas hors de son repos ». Il échoue sur `9e13e25` (`lame figée à -1.97 au lieu
de son repos -4.35 après le départ du corps`) et passe après correctif.

### 3. [mineur] le seuil de 5 % de l'optimisation « au-delà 1 » n'est pas atteint — **non corrigé, seuil assumé et chiffré**

Reproduit, et aggravé par la re-mesure : deux runs appariés complets (6 scénarios ×
5 répétitions × 1 800 pas, `identical: true`) donnent de 0,83 % à 10,92 % selon le
scénario et le run, avec une dispersion d'un run à l'autre du même ordre que le gain.
Détail dans la section « Au-delà ». Le seuil de 5 % n'est pas franchi à l'échelle du
lot : il est **assumé plus bas** pour cette tâche, ce que la contre-vérification
autorisait explicitement, et la tâche n'est pas annulée parce que le gain est positif
dans les 12 mesures, sans aucun changement d'état ni perte de qualité. La piste
suivante du profil (`updateEnvironment` hors pièges) appartient à un autre lot et n'est
pas traitée ici. Le correctif du problème 2 ne mange pas le gain : les médianes restent
inférieures ou égales à celles de l'état d'avant sur les 6 scénarios.

### 4. [mineur] le plancher de densité était trop bas — **corrigé** (`e193f53`)

Reproduit : `assert(world.traps.length>=4)` alors que la mesure donne **30 à 42 machines
par monde en 6 à 7 coupes** sur les 18 mondes du banc (`.relais/densite.mjs`) ; la base
du lot était à 3. Porté à `>=24` machines (quatre coupes complètes) et complété par
`>=4` coupes.

### 5. [mineur] l'assertion sur les ancres du directeur était tautologique — **corrigé** (`e193f53`)

Reproduit : l'assertion reproduisait terme à terme `src/world.js:1474`. Remplacée par un
décompte indépendant — conduites, lames, presses, pics comptés séparément hors du
périmètre de 16 m — plus un contrôle que toute machine est l'une des trois sortes, plus
un plancher à 24 (mesuré **34 à 46** sur ces 18 mondes). Elle valait 7 sur la base.

## Décisions à confirmer par David

Chacune avec la **valeur par défaut appliquée** dans le code livré.

1. **Une cellule de réserve dans l'emprise d'une machine.** 17 `supply-1-cells` sur les
   114 mondes de référence se retrouvent à portée d'une machine (0 sur la base) : le
   générateur ne repositionne un approvisionnement que si la case n'est pas praticable,
   et une machine ne rend pas une case impraticable. Elles restent atteignables (le banc
   l'exige). *Défaut appliqué : on les laisse en place* — le piège punit la cueillette,
   ce qui est l'esprit de la décision du 13/11. Si David veut des objets hors de portée
   des machines, il faut étendre la relocalisation de `suppliesWorld` aux cases dans
   l'emprise, et les empreintes des mondes concernés bougeront une deuxième fois.
2. **Seuil de gain des optimisations « au-delà ».** La mission demande 5 % de gain
   apparié sur la mesure visée ; la piste des machines plafonne à 8 % du pas et le gain
   mesuré est de 0,83 % à 10,92 % selon le scénario et le run, avec une dispersion du
   même ordre que le gain. *Défaut appliqué : l'optimisation est gardée et le seuil est
   assumé plus bas pour cette tâche*, parce que le gain est positif dans les 12 mesures
   et que l'état reste strictement identique.
3. **Approche d'une barrière à pied.** Le bot de navigation attend la pièce qui barre sa
   case et fuit celle qui passe sur lui ; les dégâts (lame 26, presse 34, pics 24) ne
   sont pas abaissés. *Défaut appliqué : le piège reste mortel si l'on traverse sans
   regarder.* À juger sur un vrai appareil, banc à l'appui mais sans mesure du ressenti.

## Ce qui reste à voir sur un appareil réel

- **La lisibilité du piège de loin** : les lampes et les barres d'alerte sont
  prouvées en géométrie et en portée, pas jugées à l'œil sur téléphone.
- **Le rendu visible d'une machine à 1 point de structure** : le banc travaille sur
  l'état de simulation.
- **Le son et les effets** de la destruction d'une machine : non instrumentés.
- **Le combat réel** : « une explosion d'ennemi démonte la machine qui me barrait le
  chemin » n'est pas exercé.

## Mesures et autorité de taille

`SIZE.json` est l'autorité de mesure. Bundle final : **858 656 octets bruts**,
**264 342 octets compressés** (`gzip_bytes`), sha256
`e2348300654115f74cd391f971e5c1f264f081bfe0e3f3e76b7616390162bf02`. Le chiffre annoncé
au lecteur est le chiffre **brut** ; le compressé n'est jamais présenté comme la taille du
fichier. Le navigateur n'est pas compté dans cette taille — un comparatif avec un
exécutable natif doit le rappeler. Plafond du projet : 1 400 000 octets, largement tenu.

## Contrôle de compatibilité du 14 novembre — Codex

Le format sérialisé reste le même, mais cela ne garantit pas la reprise des anciennes parties.
`node tools/checkpoint-compat.mjs RACINE_AVANT .` compare trois scénarios (classique,
campagne V1 et campagne V2) avec des contrôles de reprise à version identique.
Contre la base du lot `1814b81`, les trois reprises base → base et tête → tête passent ;
les trois reprises base → tête échouent parce que l’empreinte du monde a changé.
La commande rend donc un code de sortie 1. **La compatibilité demandée reste bloquée** ;
ce constat ne vaut ni migration des sauvegardes ni autorisation de les abandonner.
Les sources `snapshot`/`restore` n’ont pas été modifiées par ce contrôle.

Les correctifs Codex du même contrôle chargent `FPassages` dans le recensement instrumenté
et couvrent les 54 mondes de campagne V2 dans le banc des pièges obligatoires.
La suite complète est passée à 690 tests réussis, zéro échec. Le test de chargement
vérifie aussi le refus explicite si `FPassages` manque (15 tests FMath réussis).


## Compatibilité rétablie — Codex, 14 novembre 2026

Le blocage constaté plus haut sur `11d361a` est corrigé. « Continuer » essaie le
monde actuel, puis, pour un checkpoint de génération 6 dont l'empreinte diffère,
recrée exactement le monde antérieur aux pièges massifs (base `1814b81`). Le
validateur `restore` vérifie toujours l'empreinte et tous les champs avant toute
acceptation. Aucun fingerprint, format ou champ du checkpoint source n'est
réécrit. Les sauvegardes invalides restent refusées et préservées.

Une partie reprise conserve son monde et peut être sauvegardée puis rechargée.
Les nouvelles parties, nouveaux secteurs et redémarrages gardent les pièges
actuels. Le cache distingue les deux variantes. La révision globale de format
réservée au lot 12/profils n'est pas consommée. Ce correctif couvre la rupture
du lot des pièges ; il ne restaure pas les formats antérieurs au retrait du bouclier.

Preuves : dix vraies sauvegardes historiques, dont deux avec 40 débris structurels
chacune. Monde historique intégral identique ; checkpoint intégral identique en
simulation ; vrais parcours du code de Continuer, relais/autosave, seconde reprise.
Avant correctif : 20 échecs sur 40 nouveaux contrôles ; après : 40/40. Le contrôle
croisé classique/V1/V2 rend maintenant 0 et distingue explicitement le refus du
monde actuel de la reprise réussie dans le monde historique.

Suite complète : 730/730, zéro échec. Le premier essai avait détecté l'option
`null` historiquement acceptée par le générateur ; le garde correspondant est
corrigé et le test existant reste inchangé. Deux reprises dans Chrome sans
interface/SwiftShader passent sur la page construite, avec débris, stockage source
intact et zéro exception JS. Ce n'est pas une mesure de FPS ni un test sur téléphone.
Page : 861495 octets bruts (navigateur exclu), zéro actif externe,
SHA-256 `014190878d0adc2683ff69df2ba9543df261d8fa8ef9b847afa2cedef2b8fbb8`. Aucun déploiement effectué par cette correction.

Fixtures et provenance : `checks/fixtures/pre-massive-traps/README.md`.
Journaux et contrôles avant/après : `/home/m4d135/work/codex-blocages-20261114/`,
notamment `metal-compat-full-fixed.log`, `metal-cross-compat.json` et
`metal-chrome-compat.json`.


## Rectification intégration15 novembre2026

Les deux raccourcis updateEnvironment de e366203 sont retirés. Gain sous seuil non homologué et défaut ennemi au retour au repos reproduit. Garanties99596c3 préservées par recalcul systématique, tests joueur/ennemi verts. Les anciennes annonces de maintien/gain de cette optimisation ne décrivent plus la tête intégrée. Voir `integration-20261115.md` (753/753 et sauvegardes Chrome).
