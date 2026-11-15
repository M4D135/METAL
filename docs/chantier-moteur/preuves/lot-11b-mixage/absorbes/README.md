# Lot 11b / T1, T9, T11, T13 — Quatre tâches absorbées par le lot 11, revérifiées ici

Ces quatre tâches ne produisent **aucun commit** : le lot 11 (`731ace7`, intégré avant ce
lot) a déjà livré le code demandé. La fiche exigeait pourtant des preuves chiffrées — elles
sont rejouées ici, sur la tête du lot 11b, et non recopiées du rapport du lot 11.

`docs/chantier-moteur/rapports/lot-11-audio.md` rend compte de l'intégration ; ce dossier
rend compte de la **revérification**.

## T1 — Table de recettes doomish [MIX-01] : absorbée

`FAudio.create({recipes})` existe (`src/audio.js`), `synthesize()` et `warmBank()`
consultent la table avant les recettes internes, et `src/audio-recipes.js` porte les cinq
recettes (pistolet, SMG, pompe, roquette, grenade). Les recettes internes restent le défaut :
les tests sans table jouent la v0.2.

**Preuve** : `matrice-acceptation.json`, `job=matrix&scenes=a,b,c,d&recipes=metal&
comps=metal&ducks=cur&passes=8` — 32 rendus, la configuration réellement livrée.

| critère de la fiche | cible | mesuré, pire des 8 passes |
|---|---|---|
| transitoire p10, SMG / pompe / roquette | ≥ 9 dB | **13,22 à 16,74 dB** |
| 400 ms, 90e centile effets contre musique | ≥ +6 dB | **12,2 à 16,0 dB** |
| échantillons > 0,875 | 0 | **0** partout |
| réduction sur tir isolé | ≤ 1,5 dB | **1,33 dB** (pire : pompe en (d), p10) |
| voix volées | 0 | **0** partout |

Les cinq critères de la fiche sont tenus sur les 32 rendus. La réduction **maîtresse**
descend à −1,70 dB en (d) — au-delà des 1,5 dB — mais elle est portée par d'autres cues que
les tirs (le critère porte sur le tir isolé, et le `grDb` p10 le plus haut des tirs est
1,33 dB). Les crêtes maximales sont 0,518 / 0,719 / 0,743 / 0,750.

Garde-fou non levé : la fiche demande l'**écoute** de `1-actuel.wav` contre
`2-recettes-doom-chaine-actuelle.wav` avant intégration. Elle n'a pas eu lieu — aucune
oreille humaine n'a entendu ces rendus. La recette de grenade reste l'hypothèse du banc
(FEEL-06 ne donnait que 110→45 Hz et 520 ms), défaut de la fiche.

## T9 — LOAD-13, découpage de la préparation [MIX-09] : absorbée

`moduleSteps(stage)` découpe la préparation en phases reprenables (caisse par mesure,
compose, serialize, decode) pour que l'écran de chargement peigne dans le budget.

**Preuve** : `load13.json`, `node docs/chantier-moteur/bancs/mix/load13.mjs .`

```
tamponsEffets: 64 · tamponsDifferents: 0 · modulesIdentiques: true · differenceDb: -Infinity (bit à bit)
```

Les 64 tampons rendus par les phases découpées sont bit à bit identiques à ceux de
l'ordre direct, et les trois modules aussi. C'est exactement le critère de la fiche
(« tamponsDifferents = 0 ; modulesIdentiques = true »), dans le même processus, sans
hachage figé — comme le demandait le garde-fou.

## T11 — Polyphonie coupée par l'événement, pas de filtre de plus [MIX-06] : absorbée

Les plafonds n'ont **pas** été relevés (32 / 40 / 48) et le cutoff de 1100 Hz des tirs
ennemis passe par l'événement dans le filtre existant. Le test de vol de voix est conservé
(`checks/audio.test.mjs`, la voix ennemie : un seul tampon, un seul filtre passe-bas à
1 100 Hz, niveau 0,24).

**Preuve** : `matrice-acceptation.json` — `stolenVoices = 0` dans (a), (b), (c) et (d), sur
les 8 passes de chacune, avec les pics de polyphonie 5 / 6 / 14 / 12. La scène (c) tient
14 voix sans en voler une seule.

Limite, comme l'annonçait la fiche : la scène (b) du banc vaut 6 tireurs ; les 16 ennemis
actifs ne sont pas rendus. Le banc de contre-vérification a un `job=stress` à 18 tireurs,
non relancé ici.

## T13 — Dédoublonnage strict des automatisations [MIX-08] : absorbée

L'assistant `approach(param, valeur, temps, tau)` mémorise la dernière cible et le dernier
tau par `AudioParam` (une `WeakMap`) et n'appelle `setTargetAtTime` que si l'un des deux
change — pas de seuil, pas de renvoi périodique, comme la fiche le prescrivait.

**Preuve** : `nullite-a-a.json`, `job=ab&scenes=c,a&noise=1` avec la **même** source des
deux côtés (`sameSource: true`) :

| scène | diffRmsDbFS (cible ≤ −110) | diffPeakDbFS (cible ≤ −80) | appels AudioParam A / B |
|---|---:|---:|---|
| (c) | **−136,60** | **−108,10** | 9 485 / 9 485 |
| (a) | **−124,71** | **−90,41** | 7 100 / 7 100 |

Les deux critères sont tenus. Deux précautions honnêtes :

1. `job=null`, la commande de la fiche, **n'est plus rejouable** : ses variantes `loop14`
   patchent le source sur des ancres que LOOP-14 a fait disparaître à l'intégration. `job=ab`
   avec la même source des deux côtés est la mesure la plus proche qui existe.
2. Le rendu n'est plus **bit à bit** identique à lui-même (il l'était, `−Infinity`, avant la
   T12) : débrancher puis rebrancher une boucle de bruit la reprend ailleurs dans le tampon
   circulaire. C'est le garde-fou que la fiche de la **T12** prévoyait, pas une régression de
   la T13 — les niveaux, eux, restent identiques au centième.

La fiche elle-même classait ce gain comme négligeable (−0,004 ms/image, −1,6 % du fil audio)
et demandait de ne pas le vendre comme un gain de fluidité. Il n'est pas vendu.
