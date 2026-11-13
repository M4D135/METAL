# Validation — Lot 11 (Audio, armes puissantes et mixage)

Branche `chantier/lot-11-audio`. Rapport complet :
`docs/chantier-moteur/rapports/lot-11-audio.md`. Preuves :
`docs/chantier-moteur/preuves/lot-11/{t0,t1,t2,t3,t4,t5,au1}/`.

Page de ce qui a **réellement** été exécuté sur cette machine, de ce qui ne l'a pas été,
et de ce qui reste à juger par un humain.

## Environnement des vérifications

Linux arm64, Node 24.18, Python 3.12 (pour `tools/build.py`), Chrome 151 en
`--headless=new --mute-audio`. Aucun réseau. Machine partagée : toutes les comparaisons
sont appariées et alternées (avant, après, avant, après…), au moins 5 répétitions,
médianes, et les passages contraires sont conservés dans les fichiers de preuve.

Les mesures CPU et d'allocation se font dans le **domaine principal** de Node
(`tools/realm-loader.mjs`), jamais en `node:vm` en contexte séparé. Les mesures de rendu
audio se font dans Chrome sans interface via `OfflineAudioContext` 48 kHz.

## Testé, et comment

| Ce qui est vérifié | Comment | Résultat |
| --- | --- | --- |
| Non-régression | `npm test` complet, sur la base et à chaque commit | base **506/506**, final **516/516**, 0 échec |
| Banque bit à bit | `tools/audio-prep-profile.mjs`, sha256 des 64 tampons d'effets et des modules, ordre direct contre inverse (MIX-09) | banque `33ab837bd0d7…` inchangée sans table ; `buffersDifferent 0` ; modules `50d88a07…`, `c12b06da…`, `738adaa5…`, titre `88dfafde…` |
| Chemin découpé = chemin direct | même outil, `prepareMatchesDirect` | modules identiques ; en mode `--game` le champ `bank` est `false` **de façon identique avant et après**, parce que le chemin préparé applique la table de recettes |
| Tranches de chargement (LOAD-13) | tranches réelles du minuteur de `FAudio.prepare(0)` et `FMusic.warmup('title')`, 7 passages alternés | tranche max **45,19 → 17,46 ms** (T1), puis **20,49 → 18,91 ms** médian, écart apparié médian **−19,1 %** (au-delà 1) ; tranches > 8 ms **22 → 16** |
| Absence de dépendance au temps mural | même outil sur rig sans `performance.now` | la file avance d'un effet par tranche, aucune tranche ne dépend du temps |
| Automatisations d'ambiance (LOOP-14, MIX-08) | banc `play.mjs` + journal des automatisations (paramètre, type, valeur, instant, constante) sur les scènes a, b, c, d, t | **34 → 5,4** appels par image ; B = A privé des seuls `setTargetAtTime` répétés ; 0 écart ailleurs |
| Nullité du mixage (MIX-08) | banc MIX `job=ab`, même scène rendue avec A puis B, sources telles quelles | RMS ≤ **−124,15 dB** et crête ≤ **−88,67 dBFS** sur c, a, t ; critère (RMS ≤ −110, crête ≤ −80) tenu |
| Rendu sans écrêtage | Chrome `OfflineAudioContext` 48 kHz, quatre scènes matricielles | aucun échantillon > **0,875**, aucun écrêtage, aucune voix volée |
| Corps des armes (FEEL-06) | FFT bande **120–500 Hz** sur les tirs, calibrée contre le bruit de base | pistolet **+4,99**, SMG +7,96, pompe +11,43, roquette +12,22, grenade +12,21 dB |
| Separability tir/musique (MIX-06) | même matrice, SMG contre musique | **+11,98 dB** au-dessus de la musique |
| Tir isolé (MIX-01) | tir pendant un tir, réduction mesurée | pire cas **−1,43 dB** (pompe), critère ≤ 1,5 dB |
| Confirmations FEEL-07 | mesure de forme (crête, |dc|, queue), centroïde, énergie sous 120 Hz | touche centroïde **5 333 Hz**, kill **80,2 %** sous 120 Hz, centroïde 205 Hz ; crête 0,84, |dc| ≤ 0,00291, queue ≤ 0,0042 |
| Allocations musique (RESTE-09) | `tools/music-alloc.mjs`, `--expose-gc --max-semi-space-size=128`, instance chauffée, 7 allers-retours | monde 0 **−22,3 %**, monde 1 **−17,7 %**, titre **−17,4 %** de Mo/min ; notes et lignes sur 60 s inchangées |
| Taille et autonomité | `python3 tools/build.py`, `SIZE.json`, `sha256sum` | `dist/index.html` **865 940 octets**, gzip 265 636, **0 actif externe**, aucun CDN ; sous 1 400 000 |
| Déterminisme | rejeu du journal des automatisations (A contre A′), sha256 des banques et modules, `stats` égaux | identique sur les cinq scènes ; aucun `Math.random`, aucune horloge dans la simulation |

## Ce qui a été vérifié en simulation et pas en jeu

Le rendu est celui d'un `OfflineAudioContext` de banc, avec un contexte Web Audio factice
là où le moteur de Node en a besoin. Cela prouve la **forme du signal** et la
**reproductibilité**, pas le comportement d'un vrai périphérique de sortie.

## Non testé — attend un vrai appareil ou un humain

- **Écoute humaine : aucune.** Pas de haut-parleur ni de casque sur cette machine, Chrome
  lancé avec `--mute-audio`. Le jugement subjectif (le corps des armes METAL est-il
  convaincant, les confirmations sont-elles agréables ou   fatigantes à la longue, l’équilibre SMG/musique est-il bon) appartient à David. Les chiffres ci-dessus ne le
  remplacent pas.
- **Téléphone : rien.** Commandes tactiles, absence de défilement pendant le jeu, lisibilité,
  et surtout le temps de préparation réel du premier chargement — la tranche max de 19 ms
  est mesurée sur un ARM de bureau, pas sur un téléphone.
- **Safari et Firefox : rien.** Tout ce qui touche Web Audio vient de Chrome 151 et de Node ;
  `OfflineAudioContext` n'a été exercé sur aucun autre moteur.
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
5. **Preuves sous `preuves/lot-11/`** et non `preuves/lot-11-audio/`, pour suivre la
   convention du dépôt (`lot-00`, `lot-01`, `lot-02`).

## Ce qui n'a volontairement pas été fait

Compresseur MIX-02 (−12 / 3 / 6 / 12 / 120), ducking MIX-03 / MIX-V1 (0,35 / 0,22 / 0,18),
filtre des tirs ennemis MIX-06 (1,1 kHz, taux 0,85) : attribués au lot 11b. Écho 0,09 :
non mesuré, donc non appliqué.
