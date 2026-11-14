# Validation — lot « Décision David 13/11 — le bouclier sort du jeu »

Branche `chantier/jeu-bouclier-supprime`, base `35c654a`. Machine : poste de
développement partagé, Node 24, processus principal (jamais `node:vm` pour les mesures).

## Ce qui a été exécuté, et comment

| Vérification | Comment | Résultat |
| --- | --- | --- |
| Suite complète | `npm test` (27 fichiers : 25 dans le lot `node --test`, plus `checks/world.test.mjs` et `checks/build.test.mjs`) | **510 tests, 510 passés, 0 échec** (référence de départ : 505/505) |
| Référence de départ | `npm test` sur `35c654a` avant toute modification | 505 tests, 505 passés, 0 échec — aucun test de la base ne tombe |
| Équivalence de simulation | `tools/ab2.mjs`, quatre scénarios historiques (`legacy-s0`, `legacy-s2`, `campaign-w10`, `campaign-w16`), 1 800 pas, comparaison appariée alternée | chaîne d'étapes et empreintes pas à pas identiques ; seul le point sérialisé diffère (retrait voulu) |
| Vitesse de simulation | mêmes scénarios, ratios médians B/A | 1,00 à 1,03 — **aucun gain mesuré**, annoncé comme tel |
| Empreintes de génération | `node tools/platform-math.mjs worlds . --fixture write`, puis `checks/campaign-world.test.mjs` (46 tests) et `checks/world.test.mjs` | 108 mondes recalculés une fois (changement de génération voulu), stables depuis |
| Audio | `checks/audio.test.mjs` sur un `AudioContext` factice : voix, gains, durées, cooldowns, ducking, réservation prioritaire, `dispose` | 34/34 ; inventaire 61 cues → 58, aucun ajouté |
| Points de reprise antérieurs | `checks/legacy-checkpoint.test.mjs` rejoue trois points **produits par le code de la base** (gzippés sous les preuves) | 4/4 ; refus propre sans mutation ; tolérance de charge convergente |
| Bancs d'outils | `campaign-profiles`, `campaign-balance`, `boss-profiles`, `boss-ttk` exécutés après correction | 18 mondes, 4 trophées, 22 round-trips exacts ; colosses 1/6/18 tués |
| Neutrité du banc de combat | 36 combats base vs courant, comparés champ à champ | 34 identiques, 2 écarts au seul monde 4 (gardes d'épreuve retirés) |
| Identité de génération (au-delà) | `comparer-generation.mjs`, 270 mondes (5 graines × 18 index × 3 modes), six empreintes sha256 chacun | aucun écart |
| Mesures d'optimisation | `banc-generation.mjs`, processus principal, `process.cpuUsage`, passées alternées, 11 puis 2×15 répétitions, médianes et minima | 24,64 % ; puis 13,90 % et 8,37 % (combiné 9,27 %) |
| Abandon chiffré | même banc, 15 répétitions, troisième piste | 2,08 %, 7/15 ratios sous 1 → abandonné, rien de commité |
| Taille et intégrité | `python3 tools/build.py`, `sha256sum dist/index.html` contre `SIZE.json` | 841 206 octets, sha256 `5c118a3007970be6cfd73643c8ce40f1b74ef9e6a9ecf45ec246619295f4c7d6`, identique à `SIZE.json` ; `external_assets: 0` |

## Ce qui n'est PAS testé, et attend un vrai appareil

- **Clavier physique** : AZERTY et QWERTY réels, répétition automatique, capture d'une
  liaison dans les options. Les tests utilisent un DOM factice et des codes synthétiques.
- **Manette** : jamais exercée (aucun lot entrées fait) ; le lot n'a rien changé aux
  affects manette, mais le bouton contextuel « esquive / bouclier » a disparu de la
  table tactile et n'a pas été revu sur matériel.
- **Tactile sur téléphone** : le bouton « TIR G » (ex « TIR G / GARDE ») n'a pas été
  essayé avec un pouce ; les libellés sont seulement vérifiés dans `finput.test.mjs`.
- **Écoute humaine** : aucune. Les cues sont vérifiés par leurs paramètres (voix, gain,
  durée, propriété des nœuds) dans un contexte audio factice, pas par une oreille. Le
  ducking après suppression de trois cues mérite une écoute réelle.
- **Reprise depuis un appareil ayant tourné avant le lot** : les points antérieurs sont
  rejoués en mémoire depuis des fixtures. `localStorage`, import/export de fichier et
  redémarrage d'un vrai navigateur ne sont pas exercés.
- **Image** : aucune comparaison pixel à pixel pour ce lot. La première personne est
  couverte par des vérifications géométriques (pièces devant le plan proche, mains de
  chaque côté de la visée, monture droite invariable), pas par des captures. Chrome sans
  interface (SwiftShader), format téléphone et repli Canvas 2D restent à faire si une
  preuve d'image est demandée.
- **GPU, NPU, Safari, Firefox, PC à carte NVIDIA, téléphone Android** : rien ici ne sort
  de Node et d'un DOM factice. Aucune affirmation de cadence matérielle, de rendu exact
  ou de ressenti ne doit être déduite de ce document.

## Limites assumées

- Le banc de combat `campaign-balance` encaisse **0 dégât** avant comme après le retrait :
  il ne mesurait pas la valeur défensive du bouclier. La suppression n'est donc validée
  que sous l'angle « le combat mesuré n'est pas dégradé », pas « le niveau de difficulté
  est équivalent ».
- Aucun point de reprise écrit avant le lot ne se charge (l'empreinte de monde a changé
  sur les 96 combinaisons sondées). Le comportement validé est le **refus propre** et le
  repli sur l'équipement d'entrée, pas la migration.
- Les chiffres d'optimisation sont des temps CPU de processus Node sur une machine
  partagée. Les ratios bruts sont conservés dans les preuves ; le pire ratio observé sur
  les 30 passées appariées du volet 2 vaut 1,0472.
- `docs/chantier-moteur/modules/entrees.md` (libellé « Tirer / bouclier · main gauche »,
  vibration `shieldBlock`) et `modules/boucle.md` (`shieldLift`) citent encore un bouclier
  qui n'existe plus. Ces fichiers appartiennent au chantier d'entrées (lot FInput) et n'ont
  pas été modifiés ici pour ne pas empiéter dessus : à reprendre par l'intégrateur.
