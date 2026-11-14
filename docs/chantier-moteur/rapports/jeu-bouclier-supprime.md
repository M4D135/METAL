# Rapport — lot « Décision David 13/11 — le bouclier sort du jeu »

Branche `chantier/jeu-bouclier-supprime`, base du lot `35c654adba3904b6617c59ba7a06ec71b590ce2b`.
Aucune fiche `lots/lot-*` ne correspond au lot : la consigne de référence est
`.relais/BRIEF.md` §4 et `MASTER-PROMPT.md` §6 ter point 1 (« le bouclier vire le c
inutile »). Les fiches 09, 09b et 10 qui décrivaient un « bouclier utile » sont caduques
sur ce point et n'ont pas été réintroduites.

Référence de tests au départ : **505 tests, 505 passés, 0 échec**
(`.relais/npm-test-base.log`). Résultat final : **510 tests, 510 passés, 0 échec**.

| Tâche | État | Commit | Chiffre avant → après | Preuves |
| --- | --- | --- | --- | --- |
| T1 retrait du bouclier | faite | `df9d675` (code, tests, dist) puis `53fdb35` (preuves) | 505/505 → 505/505 ; `dist` 841 413 octets | `docs/chantier-moteur/preuves/jeu-bouclier-supprime/t1-retrait/` |
| T2 sortie audio | faite | `18f187b` | 61 cues → 58 ; mentions `shield` 8 → 0 et 1 → 0 | `…/t2-audio/` |
| T3 points de reprise antérieurs | faite | `6ce4a4a` | 505 → 510 tests (+4 dédiés) | `…/t3-reprises/` |
| T4 outils et documentation | faite | `0a3a7a8` (+ `7fbc9e7` pour une précision de texte) | 36 combats de banc : 34 identiques ; mentions 6/7/1/2 → 0 | `…/t4-outils/` |
| Au-delà 1 — index des colliers + minimale | faite | `466a804` | génération 18 mondes : 3 614,9 ms → 2 724,1 ms (**24,64 %**) | `…/au-dela-1-generation/` |
| Au-delà 2 — enveloppes sans tableaux | faite | `b2428cb` | 3 675,6 ms → 3 164,7 ms (**13,90 %**) puis 3 043,3 ms → 2 788,6 ms (**8,37 %**) | `…/au-dela-2-enveloppes/` |
| Au-delà 3 — boîte de requête des sondes | **abandonnée** | rien | 3 266,4 ms → 3 198,5 ms (**2,08 %**, 7 ratios sur 15 seulement sous 1) | chiffres ci-dessous |

## T1 — Retirer le bouclier du jeu

Ce n'est pas un retrait de touche : l'état, la génération, l'économie, l'interface et
les textes ne le connaissent plus.

- `src/simulation.js` : état `shield` supprimé, `shieldFacing`, `shieldBash`,
  `updateShield` supprimés ; `hurt()` ne bloque plus rien — un dégât qui était absorbé
  fait maintenant mal normalement ; `locomote(dt,input)` ne recopie plus l'objet
  d'entrée à chaque pas ; `hasOrdnance` conditionné à l'arsenal lourd
  (`weapons[1..3]`) et plus au bouclier ; `CAMPAIGN_GEAR` sans bouclier avec un champ
  `rank` explicite ; capacité d'armure plate à 100 ; tolérances de lecture pour les
  charges antérieures (`state.shield` ignoré, `inventory.shield` ignoré,
  `equipment.left:'shield'` → main libre, découverte `'shield'` écartée,
  `armor.capacity:200` ramené à 100).
- `src/world.js` : `progression.startShield` supprimé ; le ramassage d'ouverture
  `arsenal-shield` devient `arsenal-smg-cells` (24 balles de mitraillette, même
  position, même fonction d'accueil) ; l'atelier de campagne v1 réserve
  `arsenal-grenade-launcher` ; `trialEnemies` `[6,9,12,15]` ; trophées sans branches
  bouclier.
- `src/economy.js` : offre `shield` retirée (14 → 13 offres ; un achat direct de cette
  clé renvoie `unknown-item`).
- `src/game.js`, `src/options.js`, `src/index.html`, `src/style.css` : jauge et libellés
  HUD, modèle 3D, `shieldLift`, choix de la main gauche, toasts, aides et CSS retirés ;
  `fireLeft` devient « Tirer · main gauche » et `dash` « Esquive ».
- Conservés, parce qu'ils ne dépendaient pas du bouclier : l'onde (`input.pulse`,
  6,5 m, 7 s, indépendante de tout équipement), le coup de crosse (`input.melee`) et
  l'invulnérabilité courte de l'esquive (0,2 s, délai 1,7 s). `input.bash` n'existe plus.

**Équilibrage assumé.** Le bouclier comptait comme une acquisition dans la politique de
campagne. Pour ne pas écraser la courbe de difficulté, `CAMPAIGN_GEAR` porte désormais
des `rank` explicites (pistolet 0, mitraillette 2, pompe 3, grenades 4, roquettes 5) :
le tableau d'interpolation des plafonds reste `[4,5,6,8,10,12]`, mais le palier
s'arrête à 4,6 au lieu de 5,0, donc le plafond d'activité effectif est 11 au lieu de 12.
Le colosse du monde 16 passe de 130 à 125 PV ; l'arsenal partiel (roquette seule) reste
à 3,4. Capacité d'armure : 100 partout.

**Ce qui a été mesuré.** `tools/ab2.mjs` sur les quatre scénarios historiques
(`legacy-s0`, `legacy-s2`, `campaign-w10`, `campaign-w16`, 1 800 pas) : **la chaîne
d'étapes et les empreintes pas à pas sont identiques** ; le point sérialisé diffère, et
c'est voulu (champs du bouclier, ramassage d'ouverture, trophées, empreinte de monde).
Aucun gain de vitesse n'a été mesuré (ratio médian B/A de 1,00 à 1,03) : le retrait
n'était pas justifié par la vitesse. Empreintes dorées recalculées : `legacyHashes` 6/6
et `campaign-world-digests.json` (108 mondes) via
`node tools/platform-math.mjs worlds . --fixture write`.

**Tests.** Aucun test supprimé. Douze fichiers réalignés sur le comportement voulu
(simulation 120/120, checkpoint 61/61, campaign-world 46/46, input 25/25, progression
23/23, finput 54/54, campaign-simulation 16/16, armor 12/12, economy 14/14, world PASS,
boss-progression 7/7, first-person 3/3). `checks/first-person.test.mjs` a été **réécrit**
vers ce qui compte maintenant : lisibilité des deux mains, silhouettes réelles, monture
de l'arme droite invariable quel que soit le contenu de la main gauche.
`checks/campaign-simulation.test.mjs` garde `startShield:false` dans sa fixture
historique, pour que l'empreinte `575kl1` reste la preuve vivante de la tolérance.

## T2 — Sortie du bouclier de la couche audio

`src/audio.js` : cues `shieldRaise`, `shieldBlock` (et sa variante `shieldBreak`) et
`shieldBash` supprimés, avec leurs entrées dans la table de ducking de la musique et
dans la liste de réservation prioritaire des voix. `src/soundscape.js` : `shield`,
`shieldBash`, `shieldBlock` retirés des sources personnelles.

Inventaire consigné : **61 cues avant, 58 après, aucun ajouté** ; mentions `shield`
8 → 0 dans `audio.js`, 1 → 0 dans `soundscape.js`. Les deux expressions régulières sont
recopiées avant/après dans `inventaire-cues.txt`, pour vérifier qu'aucun autre nom n'a
disparu avec elles.

Les deux tests qui décrivaient ces cues ont été **réécrits sur les cues restants**
(mes, mécanisme, munitions, grenade) en gardant les mêmes mécaniques vérifiées : nombre
de voix par cue, durée sous 0,8 s, partage du cooldown sur doublon, ducking sous 0,56,
silence effets coupés/muet/hors jeu, libération des voix au `dispose`, réservation du
joueur pendant un orage d'explosions. Un test ajoute la vérification d'absence.
`checks/audio.test.mjs` : 34/34.

## T3 — Points de reprise écrits avant le retrait

Trois points **authentiques** ont été produits par le code de la base du lot
(bouclier équipé, armure à capacité 200, découverte `'shield'` consignée, 600 pas
d'entrée réelle), stockés compressés, puis rejoués par `checks/legacy-checkpoint.test.mjs`
(4 tests).

Résultat mesuré, à dire sans détour : **aucun point antérieur ne se charge**. Le lot a
supprimé `progression.startShield` de tous les mondes générés et remplacé le ramassage
d'ouverture ; l'empreinte de monde mélange la génération, donc elle a changé. Sonde sur
96 combinaisons (classique + campagne v1/v2, 18 index) : **0 empreinte identique**. Le
refus propre est donc la branche réellement déclenchée, et c'est elle qui est prouvée :
`restore()` renvoie `false` sans lever et **sans mutifier l'état** (JSON avant = après),
le même `exportLoadout()` équipe quand même une partie fraîche (main gauche libre,
armure ramenée à 100, découverte périmée retirée), et une charge taillée pour l'ancien
code posée sur un monde inchangé aboutit à un état **identique** à une partie saine.

Faire semblant du contraire — normaliser l'empreinte pour masquer ces changements —
ferait accepter des points qui décrivent des ramassages et des réglages qui n'existent
plus. Ce n'est pas ce qui a été choisi.

## T4 — Bancs et documentation

`tools/campaign-profiles.mjs`, `tools/campaign-balance.mjs`, `tools/boss-profiles.mjs`
et `tools/boss-ttk.cjs` ne connaissent plus le bouclier ; les quatre tournent
(18 mondes profilés, 4 ramassages de trophée contre 5, 22 allers-retours de point de
reprise exacts, colosses 1/6/18 tués en 116,800 s / 215,225 s / 272,175 s).

Comparaison appariée du banc de combat, base contre arbre courant, 36 combats :
**34 strictement identiques**. Les deux seuls écarts sont au monde 4 (5,225 s → 4,575 s,
17 tirs → 15), exactement l'ancien monde du trophée de bouclier : sa suppression retire
les trois gardes d'épreuve et décale l'échantillonnage des fantassins de l'arène.
**Limite à connaître : ce banc encaisse 0 dégât avant comme après.** Il n'a jamais mesuré
la valeur défensive du bouclier et ne peut donc pas prouver que le retrait est neutre au
combat ; il prouve seulement qu'il ne dégrade pas le combat mesuré.

Documentation vivante alignée : `CONTRACT.md` (11 → 8 mentions, toutes des phrases de
mise à la retraite), `README.md` (18 → 2), `docs/ARCHITECTURE.md` (28 → 12).

## Au-delà de la fiche

Profil CPU de la zone sur la tête de branche, en processus principal Node. Deux
optimisations commitées, une abandonnée.

**Au-delà 1 — `466a804`.** `demolitionMetadata` balayait tous les ~8 000 colliers du
monde pour chaque arbre et chaque assemblage, avec une recherche linéaire dans le
groupe, et triait entièrement un tableau de candidats pour trouver le solide le plus
proche de chaque maillage meuble. Un index `Map` maillage → colliers est construit une
seule fois (mêmes indices, même ordre croissant) et la recherche devient une minimale
linéaire (le tri de V8 étant stable, le groupe retenu en cas d'égalité est le même).
Génération des 18 mondes de campagne v2 : **3 614,9 ms → 2 724,1 ms, soit 24,64 %**,
avec les 11 ratios appariés inférieurs à 1 (0,699 à 0,843). Identité prouvée sur 216
mondes, six empreintes sha256 chacun : aucun écart.

**Au-delà 2 — `b2428cb`.** Les enveloppes de groupes allouaient une douzaine de
tableaux par appel pour 19 926 groupes × 2 appels ; `bbox` allouait un tableau de trois
hauteurs pour chacun des 262 787 maillages. Remplacés par six scalars et un littéral,
en gardant `Math.min`/`Math.max` (donc `Infinity` sur liste vide et propagation de `NaN`
inchangées). Deux passages de 15 répétitions : **13,90 %** puis **8,37 %** de gain
médian ; combiné, médiane des 30 ratios à 0,9073 (**9,27 %**), 24 ratios sur 30 sous 1,
pire ratio 1,0472. Identité prouvée sur 270 mondes. Le garde `checks/fmath.test.mjs:298`
a été mis à jour dans le même commit : il comptait exactement un accès calculé à `Math`
dans `world.js`, il n'y en a plus aucun ; le contrôle des lignes 293-297 reste en place.

**Au-delà 3 — abandonnée, rien de commité.** La boîte de requête de `maskFor` (sondes
d'entrée des renforts) était recalculée sur chacun des ~8 000 colliers ; son calcul
anticipé est mathématiquement identique. Mesure appariée, 15 répétitions :
3 266,4 ms → 3 198,5 ms, soit **2,08 %**, avec seulement 7 ratios sur 15 sous 1 et un
pire ratio à 1,1371. Sous le seuil de 5 %, et sous la moitié du gain attendu d'après le
profil : la tâche a été abandonnée et l'arbre remis en l'état (`git restore`).

**Pistes mesurées et non prises, parce qu'appartenant à d'autres lots.** Le profil du
rejeu de simulation (28 800 pas, quatre scénarios historiques) donne en tête :
`ray` 7,7 %, `rebuild` (destruction) 8,3 %, `updateEnemies` 5,0 %, `updateDebris` 3,8 %,
`encounterCounts` 2,9 %, `route` 2,3 %, `rebuildNeighbors` 2,0 %. Ce sont exactement les
sujets des lots **02** (simulation, mêmes résultats moins de calcul), **03** (destruction,
un seul delta par révision) et **04** (navigation et IA). Elles sont notées ici au lieu
d'être traitées. Le retrait du bouclier n'a introduit aucun coût nouveau : les seules
branches restantes liées à l'ancien équipement sont des tolérances de lecture, exécutées
à la création et à la reprise, pas au pas de simulation.

## Décisions à confirmer par David

1. **Paliers de campagne après le retrait** — défaut appliqué : `rank` explicites
   (0/2/3/4/5), tableau d'interpolation conservé, palier maximal 4,6, plafond d'activité
   effectif 11, colosse du monde 16 à 125 PV. Alternative : laisser le palier tomber à
   4,0 (campagne nettement plus facile) ou remonter les courbes.
2. **Le ramassage d'ouverture** — défaut appliqué : `arsenal-shield` est devenu un rack
   de 24 balles de mitraillette à la même position (`arsenal-smg-cells`), pour garder un
   objet d'accueil qui a du sens. Alternative : un soin, ou rien du tout.
3. **Capacité d'armure** — défaut appliqué : 100 partout, sans condition d'équipement,
   et une charge antérieure déclarant 200 est **bornée** à 100 plutôt que refusée.
   Alternative : refuser ces charges.
4. **Points de reprise antérieurs** — défaut appliqué : refus propre + repli sur
   l'équipement d'entrée. Alternative : normaliser l'empreinte pour les charger, écartée
   parce qu'elle ferait accepter des contenus qui n'existent plus.
5. **Trophées** — défaut appliqué : 5 trophées (mondes 7, 10, 13, 16) et le toast du
   premier trophée renvoie au monde 7. Le trophée d'index 3 (bouclier) a été supprimé
   plutôt que remplacé. Alternative : y mettre une arme, ce qui déplacerait la courbe.
6. **L'onde (`E`) et la crosse (`V`) restent les deux réponses défensives actives**, avec
   l'esquive. Rien n'a été rééquilibré autour d'elles dans ce lot.

## Ce qui reste à vérifier sur du vrai matériel

- **Clavier réel** : les libellés et les affects de `fireLeft` (C, « Tirer · main gauche »)
  et `dash` (Espace, « Esquive ») n'ont été vérifiés que dans `checks/finput.test.mjs` et
  `checks/input.test.mjs`, sur un DOM factice. Un clavier AZERTY et un QWERTY réels, y
  compris la capture d'une liaison dans les options, restent à essayer.
- **Tactile** : le bouton « TIR G » a été renommé et le bouton « GARDE » supprimé ;
  `checks/finput.test.mjs` couvre les libellés, pas un pouce sur un écran de téléphone.
- **Écoute réelle** : les cues sont vérifiés hors ligne (voix, gains, durées, propriété
  des nœuds) mais aucune écoute humaine n'a eu lieu. La densité du ducking pendant un
  combat rapproché, maintenant que trois cues ont disparu, demande une écoute.
- **Reprise depuis un appareil ayant tourné avant le lot** : les points antérieurs sont
  rejoués en mémoire depuis des fixtures ; le chemin complet `localStorage`, import/export
  de fichier et reprise réelle n'est pas exercé.
- **Rendu** : aucune comparaison d'images n'a été faite pour ce lot, la première personne
  étant couverte par des vérifications géométriques (`checks/first-person.test.mjs`) et
  non par des captures. Une passe Chrome sans interface (SwiftShader), un format
  téléphone et le repli Canvas 2D restent à faire si l'on veut une preuve d'image.
- **Hors simulateur** : GPU, NPU, Safari, Firefox, PC à carte NVIDIA — rien de ce qui est
  affirmé ici ne sort de Node et d'un DOM factice.
