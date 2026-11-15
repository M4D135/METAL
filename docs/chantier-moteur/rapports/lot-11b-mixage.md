# Lot 11b — Mixage complet

Branche `chantier/lot-11b-mixage`. Agent : OpenCode, modèle local du Spark.
Base du lot : `731ace7` (« Intègre le lot lot-11-audio »). Preuves :
`docs/chantier-moteur/preuves/lot-11b-mixage/`. Page de validation :
`docs/chantier-moteur/validation/lot-11b-mixage.md`.

## Référence de départ

`npm test` sur un arbre de travail détaché propre de `731ace7` : **526 réussis, 0 échec**
(journal `.relais/npm-test-base.log`). `dist/index.html` **862 797 octets**, sha256
`eedbd988…5509`, conforme à `SIZE.json`.

## Ce que le lot a livré

Dix commits, sept tâches réalisées, une partiellement (bloquée par un lot externe), quatre
absorbées par le lot 11 et revérifiées sans commit.

| tâche | constat | commit | ce qu'elle change |
|---|---|---|---|
| T2 | MIX-11 | `ec69376` | `FAudio.create({context})` hors ligne, `api.graph()`, banc `job=inject`, vérificateur de seuils |
| T3 | MIX-02 | `95408f3` | `FAudio.makeupDb()` annonce le rattrapage, option `chain`, `level:'auto'\|'fixe'` |
| T8 | MIX-V2 | `0a38bc0` | le duck de la musique suit le volume des effets |
| T4 | MIX-V1 | `432c8ed` | tenues du duck par classe : l'ondulation à 3 Hz du pistolet disparaît |
| T5 | MIX-04 | `786bc4a` | préréglage Doom : armes +3 dB, limiteur −9/6/8, sans compensation |
| T12 | MIX-07 | `05804f1` | une boucle d'ambiance muette se débranche de son filtre |
| T6 | MIX-05 | `1e854e1` | l'annonce du boss devient une alerte de jeu dans le mixage |
| T7 | MIX-10, MIX-V3 | `5fda876` | la boucle musicale varie par graine, les guitares échangent leurs mesures |
| T10 | MIX-V4 | `5388528` | le contexte audio s'endort au repos |
| — | T1, T9, T11, T13 | `21655bb` | absorbées par le lot 11, preuves rejouées |

## Gains mesurés, sur la configuration réellement livrée

Toutes les mesures ci-dessous viennent du banc `docs/chantier-moteur/bancs/mix` (Chrome
151 sans interface, `OfflineAudioContext` 48 kHz, une seule page à la fois), sur les
recettes et options réelles de `src/audio-recipes.js` — pas sur les variantes du banc.

**Armes contre musique** (matrice d'acceptation, 4 scènes × 8 passes, 32 rendus,
`absorbes/matrice-acceptation.json`) : transitoire p10 des tirs **13,22 à 16,74 dB** (cible
≥ 9) ; 400 ms au 90e centile **12,2 à 16,0 dB** (cible ≥ +6) ; **0 échantillon au-dessus de
0,875** ; réduction sur tir isolé au plus **1,33 dB** (cible ≤ 1,5) ; **0 voix volée**, pics
de polyphonie 5 / 6 / 14 / 12.

Détail par tâche, avec avant/après sur les mêmes graines :

- **T5** — crêtes 0,417 → 0,518 (a), 0,600 → 0,719 (b), 0,669 → 0,743 (c), 0,650 → 0,751
  (d), 0,551 → 0,687 (p) ; **chaque marge de tir la plus faible gagne +2,99 dB**, la valeur
  exacte de ×1,41 ; voix volées 0, pic de voix inchangé.
- **T4** — ondulation de la musique à la cadence du pistolet **6,32 → 0,08 dB** (cible
  ≤ 1,5 ; la fiche annonçait 5,8 → 0,95) ; marge du pistolet p10 14,79 → 16,71 dB ; SMG,
  pompe et roquette inchangés au dixième.
- **T8** — duck mesuré pendant une rafale selon le volume des effets : −9,12 dB à 1,
  −3,41 dB à 0,5, −1,21 dB à 0,2, −0,29 dB à 0,05.
- **T12** — fil audio au repos, scène (c) : **22,56 / 24,60 → 10,65 / 11,31 ms/s** (cible
  ≤ 16) ; rendu hors ligne **32 % plus rapide** ; niveaux de sortie identiques au centième.
- **T10** — contexte `suspended` 2 s après la mise au repos, **réveillé en 5 ms** (cible
  < 100 ms) ; sur 483,5 s de scène rejouée, coût stable de 38,03 à 34,03 ms/s, tas plat à
  17,36 Mo, **0 voix restante**.
- **T7** — boucle musicale de 76,8 / 45,2 / 53,0 s à **460,8 / 271,1 / 317,8 s** (×6, la
  plage annoncée 271 à 461 s retrouvée) ; **aucune** fenêtre de 2, 4 ni 8 positions répétée ;
  contenus de guitare 6 → **41 à 44 par module** ; module sans graine **identique au sha256**.
- **T6** — annonce du boss −50,0/−50,3 → **−31,65/−31,68 dBFS** (+18,3 dB), écart à la
  musique −25,8/−29,0 → **−5,08/−9,09 dB**, et **au niveau des autres effets** (−0,44 dB
  contre −9,1/−10,2 au départ).

## Vérificateur de seuils

`node docs/chantier-moteur/bancs/mix/mixage.mjs <pruve.json>` (livré en T2) applique les
seuils de la fiche à tout JSON du banc. Sur la matrice d'acceptation : **112 contrôles, 104
conformes, 8 hors seuil** — les 8 sont **le même** contrôle, « pompage de la musique ≤ 4 dB »
en (a), développé ci-dessous.

## Ce qui n'est pas atteint, et pourquoi

1. **Pompage ≤ 4 dB : non atteint** (9,12 dB en (a), 9,53 en (p)). Ce seuil est celui de
   **MIX-03** (duck en étagère basse 150 Hz −12 dB + large bande ×0,775), que la fiche classe
   en **option désactivée par défaut** : la contre-vérification de l'audit montre que la
   musique perd alors 11,4 à 13,2 dB RMS large bande, que le grave pompe de 13,7 à 13,9 dB
   et que la marge des tirs actuels chute de −2,2 à −4,4 dB. La décision « à confirmer par
   David » a pour **valeur par défaut : intégrer T1+T4+T5, garder MIX-03 désactivé**. Le duck
   livré est donc un duck en gain à profondeur 0,35 : sa profondeur **est** la chute mesurée,
   ce n'est pas une modulation. L'ondulation à 3 Hz, elle, est corrigée (0,08 dB). Le banc
   sait rendre l'étagère (`ducks=shelf`, `ducks=shelfmix`) pour l'écoute.
2. **T6 (MIX-05) partiellement réalisée.** Le critère « RMS annonce ≥ RMS musique après duck
   − 3 dB » n'est pas atteint (−7,85 dB en moyenne). Les ~4,9 dB restants sont dans la
   **bande** : la musique met 84 à 88 % de son énergie sous 250 Hz alors que l'annonce est un
   triangle 92→180 Hz. C'est le quatrième item de la fiche — énergie des annonces entre
   500 Hz et 2,5 kHz, grondement doublé — qui les donne, et c'est le dessin sonore de
   **BOSS-04 (lot-10 T7), absent de cette branche**. Les quatre familles ne sont pas
   mesurables non plus : la scène (d) du banc n'émet que des `bossTell`. Plancher, portée et
   caniveau sont en place pour recevoir BOSS-04 sans y revenir.
3. **T10 : le mode démo n'est pas livré.** `game.js` ne connaît aucun mode attract ; son
   déclencheur évident (démarrer seul après inactivité) est ce que le garde-fou de la fiche
   interdit (« pas d'`audio.start()` automatique sans geste »), et le niveau des effets en
   démo est une décision à confirmer. La mise en veille, elle, est livrée et mesurée.
4. **Réduction maîtresse à −1,70 dB en (d)**, au-delà des 1,5 dB du gain attendu du lot :
   portée par d'autres cues que les tirs. Le critère de la fiche porte sur le **tir isolé**,
   dont le pire est 1,33 dB.
5. **`job=null` n'est plus rejouable** depuis que LOOP-14 a été intégré : ses variantes
   `loop14` patchent des ancres disparues (`patch introuvable : l14c`). Le banc rend les
   mêmes mesures par `job=ab`. C'est dit dans les preuves T12 et T13.

## Options désactivées par défaut

- **MIX-03, duck en étagère basse** : non livré, comme décidé ci-dessus. Le banc le rend
  (`ducks=shelf`, `ducks=shelfmix`) pour l'écoute, sans qu'il entre dans le jeu.

## Décisions à confirmer par David, avec le défaut appliqué

| décision | défaut appliqué |
|---|---|
| Écoute A/B des quatre extraits avant T1, T5 et l'option MIX-03 | **non faite** — aucune oreille humaine n'a entendu ces rendus. T1+T4+T5 intégrés, MIX-03 gardé désactivé, conformément au défaut de la fiche |
| MIX-03 (duck en étagère) | **non livré** |
| Niveau des effets en mode démo (T10) | **non appliqué** — le mode démo n'existe pas ; ×0,4 (−8 dB) reste à trancher avec le mode lui-même |
| Recette de grenade (T1) | **hypothèse du banc conservée** (FEEL-06 ne donnait que 110→45 Hz et 520 ms) |
| T6 : livrer le mixage sans le dessin sonore de BOSS-04 | **oui**, et critère −3 dB laissé ouvert |
| T7 : 5 cycles de variation (la fiche) contre le compte du prototype | **5 cycles**, ce qui donne 48 positions et retrouve la plage annoncée ; le commentaire du prototype comptait 6 positions par cycle alors que l'ordre écrit en fait 8 |

## Taille

| arbre | `html_bytes` | écart |
|---|---:|---:|
| base `731ace7` | 862 797 | — |
| après T2 | 864 346 | +1 549 |
| après T3 | 867 483 | +3 137 |
| après T8 | 867 749 | +266 |
| après T4 | 869 908 | +2 159 |
| après T5 | 871 229 | +1 321 |
| après T12 | 872 105 | +876 |
| après T6 | 873 014 | +909 |
| après T7 | 876 156 | +3 142 |
| après T10 | **877 468** | +1 312 |

**+14 671 octets bruts** pour le lot, dont **+3 142 pour la seule T7** contre « +998 + 172 »
estimés — le plus gros écart de taille du lot, l'estimation ne couvrant ni MIX-V3, ni
l'éviction du cache, ni les commentaires de décision. Sous la limite de 1 400 000 octets.
**Le navigateur n'est pas compté dans cette taille** : à rappeler dans toute comparaison avec
un exécutable natif. `SIZE.json` est l'autorité de mesure ; le chiffre gzip (271 362 octets)
n'est jamais la taille brute. **0 actif externe**, aucun CDN, aucune dépendance d'exécution.

## Ce qui attend un vrai appareil

- **L'écoute**, d'abord : aucune des mesures de ce lot n'a été entendue. Quatre extraits
  d'écoute sont attendus par la fiche (`1-actuel.wav`, `2-recettes-doom-chaine-actuelle.wav`,
  `3-prereglage-doom.wav`, `4-actuel-duck-etagere.wav`), plus les silences du 3e canal de T7
  et le −8 dB des effets en démo.
- **Safari iOS** : le chemin `'interrupted'` de `resume()` existe mais n'a pas été testé sur
  l'appareil.
- **Le clic au réveil** du contexte (T10) sur haut-parleurs de portable.
- **Le gain réel d'autonomie** sur téléphone, qui est la raison d'être de T10.
- **La réserve sous le genou** : l'audit l'a mesurée à 0,68 dB sur 6 minutes avec le
  préréglage de T5 ; l'écrêteur reste la sécurité, mais une explosion de boss à bout portant
  avec tir simultané peut l'atteindre.
