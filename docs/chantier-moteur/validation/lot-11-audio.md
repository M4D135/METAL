# Validation — Lot 11 (Audio, armes puissantes et mixage)

Branche `chantier/lot-11-audio`. Rapport complet :
`docs/chantier-moteur/rapports/lot-11-audio.md`. Preuves :
`docs/chantier-moteur/preuves/lot-11/{t0,t1,t2,t3,t4,t5,au1}/`.

Page de ce qui a **réellement** été exécuté sur cette machine, de ce qui ne l'a pas été,
et de ce qui reste à juger par un humain. Réécrite à l'état de la tête au tour 2 des
correctifs : elle décrivait encore un état antérieur (chiffres rétractés, réglages depuis
appliqués, taille d'avant).

## Environnement des vérifications

Linux arm64 (DGX Spark, 20 cœurs), Node 24.18, Python 3.12 (pour `tools/build.py`),
Chrome **151** en `--headless=new --mute-audio`. Aucun réseau. Machine partagée : toutes
les comparaisons sont appariées et alternées (avant, après, avant, après…), au moins 5
répétitions, médianes, et les passages contraires sont conservés dans les fichiers de preuve.

Les mesures CPU et d'allocation se font dans le **domaine principal** de Node
(`tools/realm-loader.mjs`), jamais en `node:vm` en contexte séparé. Les mesures de rendu
audio se font dans Chrome sans interface via `OfflineAudioContext` 48 kHz.

### Provenance des preuves Chrome, par preuve (tour 2, problème 5)

Le champ `ua` de chaque preuve porte le moteur qui l'a produite. Quatre preuves committées
viennent du Mac d'audit sous Chrome **157**, le reste de ce Spark sous Chrome **151** :

| preuve | moteur |
| --- | --- |
| `t0/ab-aa.json`, `t0/calib.json`, `t0/null.json` | macOS, HeadlessChrome/**157** |
| `t2/ab-t2.json` (committé) | macOS, HeadlessChrome/**157** |
| `t2/ab-t2-linux151.json` (rejouée du tour 2) | Linux arm64, HeadlessChrome/**151** |
| `t3/*`, `t4/*`, `t5/*` | Linux arm64, HeadlessChrome/**151** |

Sur la scène `t` du `job=ab` de T2, la preuve committée (Mac 157) annonce une crête de
−128,93 dBFS ; la rejouée sous Chrome 151 donne −96,75 dBFS (une autre relance Spark a donné
−138,47). Les scènes `c` (−88,67 / −124,15) et `a` (−107,47 / −130,84) se reproduisent **au
centième** d'un moteur à l'autre. La scène `t` tombe au plancher de bruit du banc : sa
différence y est instable, `identical:false`. Les trois passent MIX-08 (crête ≤ −80, RMS ≤
−110). C'est un écart de provenance — la preuve Mac n'est pas rejouable à l'identique sous
Chrome 151 — pas un défaut de résultat.

## Testé, et comment

| Ce qui est vérifié | Comment | Résultat |
| --- | --- | --- |
| Non-régression | `npm test` complet, sur la base et à chaque commit | référence **506/506** (`d7e7bed`), final **521/521**, 0 échec |
| Banque bit à bit | `tools/audio-prep-profile.mjs`, sha256 des 64 tampons d'effets et des modules, ordre direct contre inverse (MIX-09) | banque `33ab837bd0d7…` inchangée sans table ; `buffersDifferent 0` ; module monde 0 `50d88a07…`, titre `88dfafde…` |
| Chemin découpé = chemin direct | même outil, `prepareMatchesDirect` | modules identiques ; en mode `--game` `prepareMatchesDirect` = `{bank, module, titleModule}` **vrai des deux côtés** (le `false` publié au premier passage était un bug de l'outil, corrigé au tour 1) |
| Tranches de chargement (LOAD-13) | tranches réelles du minuteur de `FAudio.prepare(0)` et `FMusic.warmup('title')`, 7 passages alternés | correctif T1 `e9de02c` : tranche max médiane **24,44 → 14,41 ms**, tranches > 8 ms **22 → 4** ; contre la base du lot **64,63 → 15,49 ms**, **16 → 7**. Le gain « au-delà 1 » (**−19,1 %**, **22 → 16**) est **retiré** : deux rejouées de 7 passages (`preuves/lot-11/au1/`) donnent **27,04 → 28,50** et **26,45 → 25,46 ms**, tranches > 8 ms **19 → 20** et **18 → 23**, soit **aucun gain** |
| Absence de dépendance au temps mural | même outil sur rig sans `performance.now` | la file avance d'un effet par tranche, aucune tranche ne dépend du temps |
| Automatisations d'ambiance (LOOP-14, MIX-08) | banc `play.mjs` + journal des automatisations (paramètre, type, valeur, instant, constante) sur les scènes a, b, c, d, t | **34 → 5,4** appels par image ; banc RESTE-09 **34,2 → 2,6** ; B = A privé des seuls `setTargetAtTime` répétés ; 0 écart ailleurs |
| Nullité du mixage (MIX-08) | banc MIX `job=ab`, même scène rendue avec A puis B, sources telles quelles | RMS ≤ **−124,15 dB** et crête ≤ **−88,67 dBFS** sur c, a ; t au plancher de bruit ; critère (RMS ≤ −110, crête ≤ −80) tenu |
| Rendu sans écrêtage | Chrome `OfflineAudioContext` 48 kHz, quatre scènes matricielles | aucun échantillon > **0,875**, aucun écrêtage, aucune voix volée |
| Corps des armes (FEEL-06) | FFT bande **120–500 Hz** sur les tirs, calibrée contre le bruit de base | pistolet **+4,99**, SMG +7,96, pompe +11,43, roquette +12,22, grenade +12,21 dB |
| Separability tir/musique (MIX-06) | même matrice, SMG contre musique | **+11,98 dB** au-dessus de la musique |
| Tir isolé (MIX-01) | tir pendant un tir, réduction mesurée | pire cas **−1,43 dB** (pompe), critère ≤ 1,5 dB |
| Confirmations FEEL-07 | mesure de forme (crête, \|dc\|, queue), centroïde, énergie sous 120 Hz | touche centroïde **5 333 Hz**, kill **80,2 %** sous 120 Hz, centroïde 205 Hz ; crête 0,84, \|dc\| ≤ 0,00291, queue ≤ 0,0042 |
| Allocations musique (RESTE-09) | `tools/music-alloc.mjs`, `--expose-gc --max-semi-space-size=128`, instance chauffée, 7 allers-retours | monde 0 **−22,3 %**, monde 1 **−17,7 %**, titre **−17,4 %** de Mo/min ; notes et lignes sur 60 s inchangées |
| Taille et autonomité | `python3 tools/build.py`, `SIZE.json`, `sha256sum` | `dist/index.html` **872 451 octets**, gzip **267 891**, **0 actif externe**, aucun CDN ; sous 1 400 000 |
| Déterminisme | rejeu du journal des automatisations (A contre A′), sha256 des banques et modules, `stats` égaux | identique sur les cinq scènes ; aucun `Math.random`, aucune horloge dans la simulation |

## Ce qui a été vérifié en simulation et pas en jeu

Le rendu est celui d'un `OfflineAudioContext` de banc, avec un contexte Web Audio factice
là où le moteur de Node en a besoin. Cela prouve la **forme du signal** et la
**reproductibilité**, pas le comportement d'un vrai périphérique de sortie.

## Budget résiduel de tranche (LOAD-13) — chiffré et acté (tour 2, problème 4)

Le critère de la fiche (« aucune tranche de préparation au-dessus de 8 ms ») **n'est pas
atteint à la tête** et ne l'a jamais été totalement. Ce qui est acquis : la tranche max
médiane est descendue de **64,63 → 15,49 ms** et les tranches au-dessus de 8 ms de **16 → 7**
entre la base du lot et la tête (`--game`). Le résidu est chiffré, causes nommées :

- tranche max médiane résiduelle **≈ 15,49 ms** (7 tranches > 8 ms) en `--game` ;
- banc cité par la fiche `bancs/load/music.mjs` : `warmup0.maxSliceMs` **16,5 ms** (28 tranches),
  `maxBatchMs` 73,8 — ce chemin ne passe pas par `warmBank` et n'est donc pas atteignable par
  le budget de tranche ;
- causes : `instrument()`, `strings()` et `drumHit()` de `src/music.js` produisent chacun leur
  PCM en **un seul passage** (les recettes du jeu, elles, sont reprenables depuis `e9de02c`).

Les rendre reprenables est le travail qui reste. Faute de fiche modifiable (dossier
d'audit en lecture seule), ce **budget résiduel chiffré est posé comme décision à confirmer
par David** (voir le rapport, table des décisions) : la tranche est bornée à ≈ 16 ms en
préparation, et non à 8 ms.

## Ce qui reste reporté, chiffré (tour 2, problème 3)

- **Sous-item T1 « appeler `music.prepare()` pour les 3 étapes pendant l'écran de
  chargement, par tranches de 8 ms » : reporté.** `src/game.js` ne prépare que l'étape jouée
  (`preparePlay`, l. 286) et le titre (l. 1005) ; les trois étapes ne sont pas toutes préparées
  à l'écran de chargement. Le but de la fiche (« qu'aucun `createBuffer` ne survienne en jeu »)
  n'est donc **pas atteint** : `preuves/lot-11/t2/audio-root.mjs` relève encore **5 tampons
  créés en jeu** et **84 170 échantillons convertis** au changement d'étape — chiffres
  identiques à la base, donc **non régressifs**, mais non nuls. Préparer les trois étapes à la
  fois triplerait le temps de chargement sans supprimer ces `createBuffer` (les tampons
  d'échantillons par note sont créés à la première note, une fois le contexte audio ouvert).
- **Proposition MIX** (limiteur de sécurité −6/4/12/1/90 et étagère basse 150 Hz à −12 dB) :
  hors fiche, gardée mesurable (`COMP.lim`, `DUCK.shelf`) pour le lot 11b.

## Non testé — attend un vrai appareil ou un humain

- **Écoute humaine : aucune.** Pas de haut-parleur ni de casque sur cette machine, Chrome
  lancé avec `--mute-audio`. Le jugement subjectif (le corps des armes METAL est-il
  convaincant, les confirmations sont-elles agréables ou fatigantes à la longue, l'équilibre
  SMG/musique est-il bon) appartient à David. Les chiffres ci-dessus ne le remplacent pas.
- **Téléphone : rien.** Commandes tactiles, absence de défilement pendant le jeu, lisibilité,
  et surtout le temps de préparation réel du premier chargement — la tranche max de ≈ 16 ms
  est mesurée sur un ARM de bureau, pas sur un téléphone.
- **Safari et Firefox : rien.** Tout ce qui touche Web Audio vient de Chrome (151 sur ce
  Spark, 157 sur le Mac d'audit) et de Node ; `OfflineAudioContext` n'a été exercé sur aucun
  autre moteur.
- **PC Windows à carte NVIDIA : rien.**
- **Vrai contexte audio en jeu : rien.** `ctx.state` suspendu au premier geste, reprise après
  coupure d'onglet, latence de sortie, changement de périphérique : non exercés hors rig.
- **WAV A/B** produits par les bancs : **hors dépôt**, seuls leurs sha256 sont committés.
  Ils ne sont pas rejouables depuis le dépôt seul.

## Points à trancher par David

1. **Pistolet +4,99 dB** : entre le « au moins +4,9 » de la fiche et le « ≥ +5 » de la
   décision David. Appliqué tel quel ; à valider ou à retoucher.
2. **Égalité stricte du dédoublonnage** (aucun seuil, aucun renvoi périodique), alors que la
   fiche proposait des seuils — les seuils font échouer le test de nullité MIX-08.
3. **`setMachinery` / `setSteam` gardés immédiats**, contrairement à la fiche, à cause de
   deux tests existants qui posent une pause sans tick.
4. **Confirmations activées avec la table METAL**, éteintes sans options ; leurs valeurs
   (55 ms / 0,30 ; 200 ms / 0,45 ; +½ ton par touche consécutive) sont posées ici et à
   réégler à l'écoute.
5. **Budget résiduel de tranche ≈ 16 ms** (LOAD-13) et **report du sous-item T1 de
   préparation au chargement** : les deux sont chiffrés ci-dessus, à acter ou à reprendre.
6. **Preuves sous `preuves/lot-11/`** et non `preuves/lot-11-audio/`, pour suivre la
   convention du dépôt (`lot-00`, `lot-01`, `lot-02`).
