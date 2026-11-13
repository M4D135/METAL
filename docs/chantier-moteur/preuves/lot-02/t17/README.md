# Lot 02 / T17 — Croissance des tableaux : contrat de l'hôte documenté

## Résultat

**Livré : SIM-13, classe « état identique ».** Aucun fichier de `src/`, de `checks/` ou de `tools/` ne change. `dist/index.html` et `SIZE.json` sont identiques octet pour octet après `python3 tools/build.py` (822 198 octets, sha256 `5f30929c…`). Seul `CONTRACT.md` change, en plus de ce dossier : la section « 0.8 Arsenal — current release contract » reçoit un paragraphe, écrit en anglais comme le reste du fichier. Il dit :

- `sim.state.events` est une file qui appartient à l'hôte. La simulation y ajoute pendant `sim.step()` et pendant les appels directs qui émettent, comme `sim.buy()` (`purchase`). Elle ne la lit, ne la tronque et ne la plafonne jamais, et `restore()` la remplace par un tableau neuf.
- Après chaque `sim.step()` et chaque appel de ce genre, l'hôte consomme les événements, puis vide le tableau en place (`sim.state.events.length=0`). C'est ce que fait `events()` dans `src/game.js` : ligne 354 de cet arbre (339 sur main `363473a`, 236 dans 0.8.0), appelée après chaque sous-pas (lignes 819-820) et après un achat (ligne 365). Après `restore()`, l'hôte relit `sim.state.events` au lieu de garder l'ancien tableau.
- Vider la file ne sert qu'à la mémoire (preuve 2). Sans ce vidage, la file garde tous les événements de la session.
- La simulation borne elle-même les autres tableaux. Le butin est borné par l'effectif du monde, de 42 à 221 ennemis selon le monde. Il garde les entrées ramassées, que la validation des points de reprise exige.
- Le paragraphe cite enfin les maxima observés et renvoie à ce dossier.

| Élément | Valeur |
| --- | --- |
| Arbre mesuré | `chantier/lot-02-simulation` à `2b89360` (T4), sans modification de code |
| Machine | Apple M5, 10 cœurs, macOS 27.2, Node v24.18.0, domaine principal de Node (`tools/realm-loader.mjs`, `realm:'main'`), jamais `node:vm` isolé ; charge 5 à 6 (machine partagée) |
| Tests | `npm test` sur le Spark : 478/486, les 8 mêmes échecs admis que la base (`checks/campaign-world.test.mjs`, empreintes arm64), journal [`npm-test.log.gz`](npm-test.log.gz) ; `node checks/build.test.mjs` : PASS, 822 198 octets |

## Banc de départ du plan : reproduit

`node $W $S/probe/t17-lengths.mjs . 10000`, lancé sur l'arbre `2b89360`, donne les chiffres du plan, à l'unité près : débris ≤ 143, particules ≤ 50, projectiles ≤ 2, explosions ≤ 3, événements ≤ 18 par pas, butin ≤ 5 (= ennemis tués) ; pour `legacy-s2`, débris ≤ 140 et particules ≤ 44. Le banc prend 20 s pour 6 mondes à 10 000 pas. Aucune fuite n'apparaît, et la tâche reste documentaire. La sonde de ce dossier, [`t17-lengths.mjs`](t17-lengths.mjs), refait ce banc à l'identique en (1), avec des relevés en plus, puis ajoute (2) et (3). Ses chemins d'import sont relatifs. Elle tourne en 60 s.

## (1) Bornes sur 10 000 pas : section `bounds` de [`t17-lengths.json`](t17-lengths.json)

Le pilote est celui de `tools/proof/scenarios.mjs`, avec la graine 96. `sim.state.events` est vidé après chaque pas, comme le fait `events()`. Les PV du joueur sont remis à 100 dès qu'ils passent sous 40, pour tenir 10 000 pas. La sonde mesure donc des bornes, elle ne prouve pas un état.

| Monde | Effectif | Tués | Butin | Débris (gros / éclats) | Particules | Projectiles | Explosions | Balles | Événements par pas | Événements en tout |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `legacy-s0` | 120 | 0 | 0 | 73 (66 / 9) | 28 | 0 | 1 | 10 | 5 | 800 |
| `legacy-s2`, arme 2 | 170 | 1 | 1 | 140 (128 / 16) | 44 | 2 | 3 | 12 | 18 | 910 |
| `campaign-w10` | 84 | 5 | 5 | 136 (128 / 11) | 30 | 0 | 1 | 5 | 6 | 1 162 |
| `campaign-w16` | 120 | 4 | 4 | 138 (128 / 10) | 50 | 0 | 1 | 7 | 9 | 1 125 |
| `campaign2-w1` | 66 | 5 | 5 | 143 (128 / 15) | 32 | 0 | 1 | 7 | 7 | 1 115 |
| `campaign2-w10` | 120 | 2 | 2 | 136 (128 / 9) | 46 | 0 | 1 | 8 | 6 | 1 212 |

*Maxima sur 10 000 pas. « Événements en tout » est la somme des événements par pas, c'est-à-dire ce que garderait un hôte qui ne vide jamais la file.*

Le plafond des gros débris (128) est atteint dans 5 mondes sur 6 et n'est jamais dépassé. Aucun boss n'est engagé, et `bossAttacks` reste à 0 partout. Bornes lues dans le code de cet arbre (`src/simulation.js`) :

- `particles` ≤ 180 : 602 ;
- `explosions` ≤ 24 : 894 (mort d'un boss) et 1011 ;
- `projectiles` ≤ 48 : 1064 (seul ajout, `spawnProjectile`) et 1189 ; `restore` accepte au plus 48 ;
- `bullets` ≤ 160 : 1328-1329 (seul ajout) ; `restore` accepte au plus 160 (2293) ;
- `debris` : 128 gros morceaux (`MAX_RUBBLE`) et 64 éclats (`MAX_CHIPS`), ligne 64 et `appendDebris` (952-969), seul ajout ; `restore` accepte au plus 128 gros morceaux (2168) ;
- `bossAttacks` : ajout en 1756, retrait à la fin de leur durée (1827), au changement de phase (1748) et à la mort du boss (894) ; `restore` en accepte au plus 16 (2281) ;
- `loot` : un seul ajout (717), précédé de deux gardes. Un ennemi mort ne peut plus prendre de dégâts (`alive`, lignes 20 et 889), et il n'y a jamais deux entrées pour le même ennemi (712). Les entrées ramassées restent, car `restore` exige une entrée par ennemi mort qui porte une récompense (2277). La même fonction refuse plus d'entrées que d'ennemis (2264) et deux entrées pour le même ennemi (2266) ;
- `events` : la simulation n'y touche qu'à deux endroits, à l'ajout (`emit`, 599) et dans `restore`, qui le remplace par `[]` (2311). `destruction.js` remplit sa propre liste `result.events`, qui ne sert que le temps d'un appel.

## (2) Le vidage est neutre : section `clearing`

Les deux mondes `legacy-s2` (arme 2) et `campaign2-w10` tournent 10 000 pas, une fois avec vidage après chaque pas, une fois sans. L'empreinte de `tools/proof/digest.mjs` est calculée à chaque pas sans le champ `events`. Les chaînes valent `ed3d5bdb` et `94a378c5` dans les deux cas, et le SHA-256 de l'instantané final est le même (`de00886f…` et `c694d14a…`). Sans vidage, la file garde 910 et 1 212 événements, exactement les totaux du (1). Ne pas vider la file ne fait donc grossir que la mémoire. Les tests qui gardent les événements d'une partie courte (aide `events()` de `checks/simulation.test.mjs`) restent justes.

## (3) Le butin par le vrai chemin de dégâts : section `killPath`, et [`effectifs.mjs`](effectifs.mjs)

Les 39 mondes (3 secteurs classiques, 18 mondes de campagne V1, 18 de campagne V2) tournent 1 800 pas. Toutes les 30 étapes, la sonde tue tous les ennemis déployés par `damageEnemy`, la fonction de dégâts du jeu. Cette fonction n'est exposée qu'en mémoire, par un patch de chargement de la sonde, et `src/` ne change pas. Chaque monde compte de 11 à 15 morts. Le butin compte exactement une entrée par mort, sans doublon, et une passe de plus sur les morts n'ajoute rien. Les explosions montent à 12 au plus (mort d'un boss) et les particules à 180, leur plafond.

Ce n'est pas une saturation de l'effectif. Ce pilote ne fait pas entrer les réserves, qui ne meurent donc pas. La borne de l'effectif se lit dans le code (voir le (1)). L'effectif lui-même (`world.enemies.length`) est le même pour les 5 graines essayées (1, 7, 96, 31337, 123456), d'après [`effectifs.json`](effectifs.json) : 120/140/170 en classique, de 42 à 170 en campagne V1, de 66 à 221 en campagne V2. **La borne du butin est donc de 221 entrées (monde 18 de la campagne V2), et non de 170 comme l'écrivait SIM-13.** Dans l'instantané, une entrée pèse en moyenne 179 octets de JSON dans le pire monde. À 221 entrées, cela ferait environ 40 Ko (estimation), sur un instantané de 313 Ko mesuré dans ce monde avec 13 entrées.

**Instantané → JSON → `restore` dans une simulation neuve.** Le butin restauré est identique dans 33 mondes sur 39. Les 6 autres refus tombent tous sur la même exigence, `src/simulation.js:2258` (colonne 421), qui porte sur les rencontres. Aucun ne tombe sur celles du butin (2264-2277). Ils sont expliqués ci-dessous.

## Constat annexe, hors SIM-13 : point de reprise refusé après une rencontre vidée de loin

**Le mécanisme.** Certaines rencontres ont tous leurs membres déployés dès la création. Le joueur peut en blesser un sans être entré dans la zone de la rencontre. `damageEnemy` le marque alors `encounterReleased` et annonce la vague 0 (891) : `pendingWave=0`, statut `warning` (726-729). La vague ne s'active que si le joueur entre dans la zone, à 8 m près (767). Si les membres meurent tous avant cela, la rencontre passe à `cleared` avec `pendingWave=-1` et garde `wave=-1` (764). Le jeu prend aussitôt un point de reprise sur `encounterClear` (`src/game.js:346`). Or `restore` exige qu'aucun membre d'une vague au-delà de `max(wave,pendingWave)=-1` ne soit marqué (2258). Il refuse donc ce point, et tous les suivants du même monde, car la rencontre ne change plus.

**La reproduction, sans patch du calcul** : [`reprise-rencontre.mjs`](reprise-rencontre.mjs), sortie [`reprise-rencontre.json`](reprise-rencontre.json). Le monde 1 de la campagne V2 est celui d'une nouvelle expédition. Le joueur reste au point d'apparition, à 41,7 m de `encounter-1`, sans jamais entrer dans sa zone à 8 m près. Il abat au pistolet de départ les 3 membres de la rencontre (27 tirs, 10 touches), en s'orientant vers la cible comme avec la souris. Les résultats :

- l'instantané se restaure à la création, et encore après le premier mort ;
- il est refusé à `encounterClear` (pas 520), puis 1 800 pas plus tard ;
- c'est le même résultat, au même pas, sur main `363473a` (0.8.1) et sur 0.8.0 `673d6b2` (ligne 2158 dans ces versions). Le défaut est donc antérieur au chantier ;
- la seconde passe, qui note seulement la pile de l'exigence refusée, ne change rien au déroulement (`tracePatchNeutral`).

**L'effet en jeu.** Après une mort dans ce monde, « Reprendre au point de reprise » appelle `resumeSaved`. `restore` refuse le point, puis aussi la copie sans gravats, et le jeu affiche « Point de reprise illisible. Reprise à l'entrée de ce secteur. » (`src/game.js:202-223`, message ligne 220). La progression du monde est perdue. À la graine 96, 9 rencontres sont entièrement déployées à la création : dans les mondes 1, 2, 3, 4 et 7 de la campagne V1 et dans le monde 1 de la campagne V2 (`encounter-1`). Ce sont exactement les 6 refus du (3).

**La correction proposée, à confier à une tâche qui touche la simulation.** Elle n'est pas faite ici, puisque T17 ne modifie pas de code. À la ligne 2258, l'exigence ne s'appliquerait plus aux rencontres vidées : `if(wave>Math.max(q.wave,q.pendingWave)&&q.status!=='cleared')require(!enemies[id].encounterReleased);`. Un prototype chargé en mémoire a été joué sur ce scénario. Le point pris à `encounterClear` se restaure, la rencontre reste vidée sans aucun membre vivant après 1 800 pas, et l'instantané suivant se restaure aussi. Ni le format ni le déroulement ne changent, et les points déjà écrits par les joueurs de la 0.8.1 redeviennent lisibles. Corriger plutôt la ligne 764 (garder la dernière vague annoncée) changerait l'état vivant, et ne sauverait pas ces points. Le prototype n'a pas été passé à `npm test`. Le test à ajouter dans `checks/checkpoint.test.mjs` est ce scénario : pistolet depuis le point d'apparition du monde 1 V2, puis instantané, `restore` et continuation.

## Pour le lot 12

Compacter `s.loot` (retirer les entrées ramassées) change le contenu des points de reprise. C'est aussi incompatible avec la validation actuelle, qui exige une entrée par ennemi mort qui porte une récompense (2277) : il faut une révision du format. Le gain serait de 40 Ko de JSON au plus par point, à la fin du monde 18 V2 si tout est tué, et bien moins en jeu ordinaire. LOAD-14 jugeait déjà ce gain négligeable (0,5 ms de `stringify`). Il n'y a rien à faire, sauf si le lot 12 révise le format pour d'autres raisons.

## Ce qui n'est pas prouvé

- Les PV remis à 100 et le pilote automatique ne représentent pas une vraie partie. Le nombre d'événements par pas et par session dépend du jeu réel.
- Les réserves ne sont pas tuées en (3). La borne de l'effectif vient du code, pas de la mesure.
- `bossAttacks` n'est pas exercé : aucun combat de boss n'a lieu.
- Il n'y a rien à vérifier sur du vrai matériel, puisque rien ne change à l'exécution.

## Reproduire

Depuis la racine du dépôt, avec `W='--import=data:text/javascript,Object.getOwnPropertyDescriptors(globalThis)'` tant que T0 n'est pas appliqué :

```sh
node $W docs/chantier-moteur/preuves/lot-02/t17/t17-lengths.mjs . 10000 1800 > t17-lengths.json
node $W docs/chantier-moteur/preuves/lot-02/t17/effectifs.mjs . > effectifs.json
node $W docs/chantier-moteur/preuves/lot-02/t17/reprise-rencontre.mjs . <racine-main> <racine-0.8.0> > reprise-rencontre.json
```

Les deux passages complets de `t17-lengths.mjs` donnent les mêmes valeurs. Les fichiers JSON de ce dossier sont ces sorties, avec les racines remplacées par des étiquettes et mises en forme sur une ligne par monde.
