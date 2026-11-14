# Lot 11 / T2 — Dédoublonnage strict des automatisations

Constats : LOOP-14, MIX-08, RESTE-09 (point 5). Fiche : `lots/lot-11.md`, tâche T2.

Classe de preuve : **visuellement identique**. Critère audio de MIX-08 : différence RMS ≤ −110 dB et crête ≤ −80 dBFS
dans les scènes (c), (a) et (t), avec `job=ab` et A = le commit parent. S'y ajoute une preuve exacte, indépendante
du navigateur : le journal des automatisations de B est celui de A privé des seuls doublons.

- A : `fda6445` (lot 11/T0), `src/audio.js` `4b36fde2…452b6d`.
- B : l'arbre de la tâche, `src/audio.js` `fd03c584…b2d6fd`. `src/music.js` est inchangé (`6f1ab99a…f61f74`).
- sha256 complets dans `manifest.json`.

## Ce qui change

Un assistant `approach(param, valeur, instant, tau)`, interne à `FAudio.create` :
- il garde, par AudioParam, la dernière cible et la dernière constante de temps envoyées ;
- il n'appelle `setTargetAtTime` que si l'une des deux change ;
- égalité stricte : ni seuil, ni renvoi périodique ;
- la mémoire est une `WeakMap` propre à l'instance : elle repart à neuf avec un nouveau contexte.

`setTargetAtTime` est une approche exponentielle sans mémoire. Relancer la même cible avec la même constante redessine
la même courbe : seul le message vers le fil audio disparaît.

Passent par l'assistant toutes les automatisations des 18 paramètres persistants d'ambiance :
- vapeur : gain, panoramique, filtre ;
- 4 moteurs : gain, panoramique, filtre ;
- vent : filtre, gain ;
- envoi d'écho.

Cela comprend les cinq coupures du vent : `cancelTestMix`, `setTitlePlaying`, `setMuted`, `setPlaying` et `setMix`.
Aucun autre code n'écrit ces paramètres après leur création, donc la mémoire n'est jamais périmée.

Jamais dédoublonnés : le maître et le bus musique (`cancelScheduledValues` et instants futurs du duck), les bus effets et
ambiance (`setMix`), les voix d'effets et la musique.

Écart assumé avec la fiche et MIX-08, qui proposaient des setters qui mémorisent sans rien envoyer :
- `setMachinery` et `setSteam` gardent leur mise à jour immédiate ;
- `checks/audio.test.mjs:90-92` et `:188` lisent la valeur juste après le setter, sans `tick` ;
- le jeu appelle `setMachinery(0)` et `setSteam(0)` en quittant le jeu (`game.js:216`), et `tick` ne tourne pas en pause ;
- la mémoire suffit à annuler la réémission de `tick` dans la même image : on obtient exactement le flux de la variante
  « exact » du banc (mêmes comptes en (c) et (a)).

Aucun test existant n'est modifié. Un test est ajouté (voir plus bas).

## Résultats

### Appels AudioParam

| Banc | Avant (A) | Après (B) | Écart |
|---|---:|---:|---:|
| `play.mjs . 30 60` (`node:vm`, comptes seulement), par image | 34 | 5,4 | −84 % |
| `audio-root.mjs` (banc de RESTE-09, domaine principal), par image | 34,2 | 2,6 | −92 % |
| `job=ab`, Chrome, scène (c), total sur 1 919 images | 64 479 | 9 485 | −85,3 % |
| `job=ab`, Chrome, scène (a) | 63 479 | 7 100 | −88,8 % |
| `job=ab`, Chrome, scène (t), écran titre | 38 280 | 3 711 | −90,3 % |

Par image en Chrome : (c) 33,6 → 4,9 ; (a) 33,1 → 3,7 ; (t) 19,9 → 1,9.

`play.mjs` par paramètre :
- `gain.gain` 23 259 → 3 684 ;
- `filter.frequency` 19 800 → 17 ;
- `panner.pan` 18 000 → 5 848.

Le panoramique reste le premier poste : le joueur de `play.mjs` tourne et se déplace sans cesse, donc les panoramiques de
la vapeur et des moteurs changent vraiment à chaque image. Le dédoublonnage strict doit les envoyer. Tirs (78), points de
vie et nœuds créés (0,64 par image) sont inchangés. Le harnais de `play.mjs` dépend de minuteurs réels : d'une passe à
l'autre, quelques appels sur 30 s changent (23 259 ou 23 263 `gain.gain` pour A, 3 684 ou 3 686 pour B).

La fiche annonçait −45 % pour le seul dédoublonnage et ≤ 17 appels par image : c'est tenu et dépassé. MIX-08 annonçait
−85 à −89 % : c'est reproduit à l'appel près (9 485 et 7 100, les comptes de la variante `LOOP-14 exact` de T0).

### Rendu hors ligne, Chrome — `ab-t2.json`

`mix.html?job=ab&scenes=c,a,t&noise=3`, A = `fda6445`, B = l'arbre. Le bruit est le pire cas de 3 rendus
supplémentaires de A, dans la même page.

| Scène | Différence A/B, crête / RMS | Bruit du banc, crête / RMS | Critère MIX-08 | Sortie A = B, crête / RMS |
|---|---|---|---|---|
| c | −88,67 dBFS / −124,15 dB | −113,86 / −151,52 | vrai | 0,673 / −20,52 dBFS |
| a | −107,47 / −130,84 | −138,47 / −158,32 | vrai | 0,392 / −23,72 dBFS |
| t | −128,93 / −154,88 | −102,98 / −151,45 | vrai | 0,369 / −18,93 dBFS |

- Les valeurs de (c) et (a) sont celles du `job=null` « LOOP-14 exact » de T0 (−88,67 / −124,15 et −107,47 / −130,84).
- En (t), la différence reste dans le bruit du banc.
- En (c), la crête de la différence dépasse de 1,3 dB le seuil strict de −90 dBFS ; le premier échantillon au-delà de
  −90 dBFS est à 29,79 s du rendu. Le RMS est 14 dB sous le critère de −110 dB. C'est l'écart d'arrondi de Chrome entre une
  exponentielle continue et une exponentielle relancée à chaque image, prévu par MIX-08. Une égalité « −∞ » n'est pas
  atteignable : deux rendus de A diffèrent déjà (T0).
- Voix, voix volées et sons sautés sont identiques des deux côtés.

### Journal des automatisations — `journal.mjs`, `journal.json`

Preuve exacte, sans navigateur. Les scènes (a), (b), (c), (d) et (t) sont rejouées dans le domaine principal de Node,
dans l'ordre exact de `mix.js` (`render`), sur un Web Audio factice qui journalise chaque automatisation : paramètre,
type, valeur, instant, constante. Les écritures directes de `.value` sont journalisées aussi.

Critère, paramètre par paramètre : le journal de B est celui de A, ou celui de A privé des `setTargetAtTime` qui répètent
la cible et la constante de l'événement précédent du même paramètre. Ce sont les seuls retraits possibles à l'identique.

| Scène | Automatisations A → B | Par image | Paramètres identiques | Dédoublonnés | Avec `cancelScheduledValues`, identiques |
|---|---|---|---|---:|---|
| a | 63 485 → 7 106 | 33,08 → 3,70 | 1 028 / 1 046 | 18 | 9 / 9 |
| b | 64 230 → 2 646 | 33,47 → 1,38 | 1 540 / 1 558 | 18 | 12 / 12 |
| c | 64 491 → 9 497 | 33,61 → 4,95 | 1 784 / 1 802 | 18 | 11 / 11 |
| d | 63 706 → 2 626 | 33,20 → 1,37 | 1 319 / 1 337 | 18 | 9 / 9 |
| t | 38 306 → 3 737 | 19,96 → 1,95 | 1 845 / 1 863 | 18 | 17 / 17 |

- Les 18 paramètres dédoublonnés sont exactement les 18 paramètres d'ambiance, tous créés par `start()`.
- Tous les autres journaux, maître, bus musique, voix et musique compris, sont identiques à l'événement près.
- `audio.stats` est identique en fin de scène ; A rejoué deux fois donne le même journal.
- Contrôle de sensibilité, non versionné : la variante à seuil 1e-3 échoue, avec 7 paramètres en écart en (a) et (c).

### Coût réel — `perfab.html`, `perfab.json`, `pair.mjs`, `pair.json`

Ce n'est pas un gain de fluidité, comme l'avait mesuré la contre-vérification de MIX-08 (−0,004 ms par image sur le fil
principal, −1,6 % sur le fil audio). Le chiffre qui compte est le nombre de messages d'automatisation vers le fil audio :
environ 2 000 → 220 à 300 par seconde dans les scènes (c) et (a).

Chrome, vrais AudioParam (`perfab.html`, page jetable à copier dans la copie du banc) : 9 rendus de A et de B en
alternance, médianes. « JS » est le temps des rappels d'image (appels de la scène, setters, `tick`, musique).

| Scène | JS par image, A → B | Rendu par seconde d'audio, A → B |
|---|---|---|
| c | 23,4 → 21,0 µs (min 20,8 → 16,2) | 12,45 → 11,93 ms (min 11,54 → 11,10) |
| a | 26,7 → 22,6 µs (min 23,4 → 16,4) | 11,47 → 11,74 ms (min 10,76 → 10,09) |

Soit 2 à 4 µs de moins par image sur le fil principal (0,02 % d'une image à 60 Hz) ; le rendu reste dans le bruit.

Node, domaine principal (`pair.mjs`) : séquence audio de `game.js:813-817`, 2 séries de 9 rondes alternées de
3 600 images. Le Web Audio factice compte des appels bien moins chers que ceux du navigateur. Les médianes changent de
signe d'une série à l'autre (A 0,51 / B 0,69 µs, puis A 0,71 / B 0,60 µs) : l'assistant n'ajoute aucun coût mesurable.

## Test ajouté

`checks/audio.test.mjs`, « steady ambience is automated once per change and every wind cut can be undone at the same
instant (LOOP-14) » :
- 120 images à entrées constantes n'ajoutent aucune automatisation aux 18 paramètres, ni par l'image suivante, ni par
  `tick` après un setter ;
- un changement de 1e-9 du niveau de vapeur est envoyé, une seule fois : pas de seuil ;
- le vent coupé par `setMuted`, `setPlaying`, `setMix({ambience:0})`, `setTitlePlaying` et `cancelTestMix` revient, au
  même instant, à sa valeur exacte : aucune coupure ne laisse une cible périmée dans la mémoire.

Le test a été vérifié par mutation, sur des copies non versionnées :
- il échoue sur le parent : « unchanged targets are not sent again » ;
- il échoue sur un seuil de 1e-3 : « strict equality » ;
- il échoue si la coupure de `setMuted`, de `setMix` ou de `setPlaying` contourne l'assistant : « stale target ».

## Tests et page

- `node --test checks/audio.test.mjs` : 34/34 (33 existants, inchangés, et le nouveau).
- `npm test` : 463/471, soit la référence 462/470 plus le nouveau test. Les 8 échecs sont les échecs admis de
  `checks/campaign-world.test.mjs` : les six empreintes « legacy seed 1 / 96, sector 0 à 2 », « campaign mode is strictly
  opt-in… » et « the first three campaign worlds preserve historical geometry… ». La chaîne `&&` s'arrête après eux ;
  `node checks/build.test.mjs`, lancé à part, rend `PASS`.
- `python3 tools/build.py` : `dist/index.html` 812 696 → 813 418 octets (+722), sha256 `070bd432…776430`.

## Reproduire

Toujours sur une copie du banc hors du dépôt : `run.py` écrit son profil Chrome à côté de lui.

```sh
cd <racine du dépôt>; S=<dossier temporaire hors dépôt>; mkdir -p $S/A
git archive fda6445 src tools | tar -x -C $S/A
cp -R docs/chantier-moteur/bancs/mix $S/mix
gzip -dc docs/chantier-moteur/preuves/lot-11/t0/scenes.js.gz > $S/mix/scenes.js   # sha256 1f066203…
node $S/mix/gen.mjs $S/A docs/chantier-moteur/bancs/feel/doomish.mjs $S/mix .
(cd $S/mix && python3 -I run.py "mix.html?job=ab&scenes=c,a,t&noise=3" 280 > ab-t2.json)
node docs/chantier-moteur/preuves/lot-11/t2/journal.mjs $S/A . $S/mix/scenes.js a,b,c,d,t > $S/journal.json
node docs/chantier-moteur/preuves/lot-11/t2/pair.mjs $S/A . 9 3600 > $S/pair.json
cp docs/chantier-moteur/preuves/lot-11/t2/perfab.html $S/mix/
(cd $S/mix && MIX_PROFILE=-perf python3 -I run.py "perfab.html?scenes=c,a&reps=9" 280 > perfab.json)
node docs/chantier-moteur/bancs/loop/play.mjs . 30 60 > $S/play-after.json
node docs/chantier-moteur/preuves/lot-11/t2/audio-root.mjs .
node --test checks/audio.test.mjs
```

`job=null` ne s'applique plus : ses remplacements visent les anciens `setTargetAtTime` et s'arrêtent à l'ancre `l14c`.

## Provenance du rendu Chrome (correction du tour 2, problème 5)

Le fichier committé `ab-t2.json` porte `"ua": … HeadlessChrome/157 … Macintosh; Intel Mac OS X` : il a été produit
sur le Mac d'audit, pas sur ce Spark. Il n'est donc **pas rejouable à l'identique** sous le Chrome 151 de cette machine.
Il a été **rejoué sous Chrome 151 (Linux arm64)** dans `ab-t2-linux151.json` (mêmes sources A = `1461e24`
`audio.js 4b36fde2…452b6d`, B = `d7e7bed` `audio.js fd03c584…b2d6fd`, même banc, `noise=3`) :

| Scène | `ab-t2.json` (Mac 157) | `ab-t2-linux151.json` (Spark 151) | Critère MIX-08 |
|---|---|---|---|
| c | −88,67 / −124,15 | −88,67 / −124,15 | vrai |
| a | −107,47 / −130,84 | −107,47 / −130,84 | vrai |
| t | −128,93 / −154,88 | −96,75 / −143,84 | vrai |

Les scènes (c) et (a) se reproduisent **au centième** d'un moteur à l'autre. La scène (t), écran titre, tombe au
**plancher de bruit du banc** (`noise` de la scène t ≈ −96 dBFS de crête) : sa différence y est instable d'un moteur et
d'un passage à l'autre (−128,93 sur Mac 157, −138,47 à une relance Spark 151, −96,75 à celle-ci), `identical:false` —
le banc `ab` n'est pas bit à bit, seul le journal (`journal.json`) tranche. Les trois scènes passent MIX-08 partout.
C'est donc un **écart de provenance**, pas un défaut de résultat.

## Limites

- Le rendu committé vient de Chrome 157 sous macOS ; la rejouée `ab-t2-linux151.json` vient de Chrome 151 sous Linux
  arm64. Firefox et Safari ne sont pas mesurés. Ils suivent la même spécification de `setTargetAtTime`, mais leur
  arrondi peut différer de celui de Chrome.
- Aucune écoute : rien d'audible n'est attendu (différence RMS ≤ −124 dB), à confirmer sur vrai matériel.
- Le bénéfice visé (moins de messages vers le fil audio) concerne surtout les téléphones ; il n'est pas mesurable ici.

## Fichiers

| Fichier | Contenu |
|---|---|
| `ab-t2.json` | `job=ab&scenes=c,a,t&noise=3`, A = T0 (`audio.js 4b36fde2…452b6d`), B = l'arbre — **Mac Chrome 157** |
| `ab-t2-linux151.json` | même banc rejoué sous **Linux Chrome 151** (provenance, tour 2) |
| `journal.mjs`, `journal.json` | Preuve par journal des automatisations, 5 scènes |
| `perfab.html`, `perfab.json` | Chrome : temps des rappels d'image et du rendu, A et B alternés, scènes (c) et (a) |
| `pair.mjs`, `pair.json` | Node : coût JavaScript par image, A contre B, rondes alternées |
| `play-before.json`, `play-after.json` | `play.mjs . 30 60`, A puis B |
| `audio-root.mjs` | Banc audio de RESTE-09 (`bancs/reste/audio.mjs` de l'audit, racine en argument) |
| `audio-root-before.txt`, `audio-root-after.txt` | Ce banc, A puis B |
| `npm-test.log.gz` | `npm test` complet sur l'arbre de T2 |
| `manifest.json` | sha256 des sources, de la page, des outils et des fichiers de ce dossier |
