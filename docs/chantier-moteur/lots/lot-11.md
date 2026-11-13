# Lot 11 — Audio : armes puissantes et mixage
## But
Rendre les tirs denses et graves (bande 120–500 Hz +5 à +12 dB), supprimer les doublons d'automatisation audio, borner les lots de synthèse à 8 ms, et préparer le mixage (compresseur, ennemis, confirmations) après mesure de la lacune MIX. Tout reste déterministe, PCM identique bit à bit, une page HTML ≤ 1 400 000 octets.
## Tâches, dans l'ordre

### T1 — Lots de synthèse bornés en temps [LOAD-13]
- Où : src/audio.js:281-303 ; src/music.js:208-231 ; src/game.js:172 ; src/game.js:190
- Quoi : remplacer le découpage « 2 noms par setTimeout » par `while(performance.now()-t0<8) build(suivant)`. Une seule variante par tâche pour break:metal (147 ms), break:glass (138 ms), break:stone (57 ms). Découper moduleFor en 4 sous-tâches (batterie, compose, serialize, decode). Appeler `music.prepare()` pour les 3 étapes pendant l'écran de chargement, par tranches de 8 ms.
- Preuve exigée : `node bench/load/music.mjs` avant/après → maxBatchMs ≤ 8 ms, maxSliceMs ≤ 75 ms (moitié de break:metal). Total banque ≈ 542 ms inchangé. `node --test checks/audio.test.mjs checks/music.test.mjs` verts, PCM identique bit à bit.
- Qualité : identique.
- Garde-fous : ordre de construction indifférent si chaque synthèse est pure (vérifié par les tests PCM). Worker Blob URL optionnel, non requis ici. Pas d'asset importé.
- Dépend de : rien.

### T2 — Suppression des doublons d'automatisation [LOOP-14]
- Où : src/audio.js:180-197 ; src/audio.js:379-397 ; src/audio.js:475-476
- Quoi : les setters `setSteam`/`setMachinery` mémorisent la valeur sans appeler `update*` ; seul `tick()` déclenche une mise à jour par image. Supprimer le double appel (audio.js:475-476 puis 382-383). Tenir une mémoire `{target, tau}` par AudioParam ; ne réémettre `setTargetAtTime` que si la cible change de plus de 1e-3. Invalidater la mémoire quand un autre code (atténuation d'ambiance) programme le même paramètre.
- Preuve exigée : `play.mjs` → audioParamPerFrame ≤ 17 (−45 % par suppression des doublons, identique). Capture OfflineAudioContext 10 s échantillon par échantillon identique à la référence. `node --test checks/audio.test.mjs` vert.
- Qualité : identique (setTargetAtTime sans mémoire : relancer vers la même cible ne change pas la courbe).
- Garde-fous : ne pas supprimer la mise à zéro du vent (seuil 1e-3 trop bas pour le gain). Aucun impact sur la simulation. Gain non audible sur desktop ; utile mobile.
- Dépend de : T1 (prepare() en charge évite les conversions en jeu).

### T3 — Table de recettes d'armes façon Doom [FEEL-06]
- Où : src/audio.js:20-88 ; src/audio.js:27 ; src/audio.js:58-69 ; src/audio.js:82 ; src/audio.js:288 ; checks/audio.test.mjs:57-70 ; checks/audio.test.mjs:279
- Quoi : exposer dans FAudio un générateur paramétrique (thump, corps passe-bas saturé, mécanique, pièce) ; les préréglages d'armes vivent côté METAL (table ci-dessous). Filtre DC à 25 Hz dépendant du taux : `exp(−2π·25/rate)` au lieu de .991. Recette v0.2 reste le défaut de FAudio. Plafonds tests : pistolet < .36, SMG < .26, pompe < .95, roquette < .82, grenade < .55 ; longueur pistolet et SMG recalculées (:279). Règle « SMG rms < roquette rms » conservée (:66).
- Preuve exigée : `audio-analyze.mjs` + `doomish-check.mjs` sur la recette intégrée. Critère d'acceptation : bande 120–500 Hz +4,9 à +12,2 dB d'énergie absolue ; RMS +8 dB à pic égal ; part sous 120 Hz ×7 à ×20. WAV A/B dans `bench/feel/wav/`. Écoute David obligatoire avant intégration.
- Qualité : meilleure.
- Garde-fous : à 8 tirs/s le SMG 240 ms superpose 2 voix → vérifier limites 32/40/48 (test :114). Taille +1,5 Ko. Génération reproductible par graine. Aucun échantillon importé, concept Doom seulement. Grenade non prototypée (45 % sous 120 Hz déjà) → valider séparément.
- Dépend de : T1 (lots bornés pour le warmBank des nouvelles recettes), T2 (automations propres).

### T4 — Mixage : compresseur, ennemis, confirmations [FEEL-07]
- Où : src/audio.js:137-139 ; src/audio.js:314-315 ; src/audio.js:335 ; src/audio.js:588-590 ; src/audio.js:600 ; src/audio.js:603 ; src/audio.js:606
- Quoi : compresseur maître −12 dB / ratio 3:1 / knee 6 / attaque 12 ms / release 120 ms (waveshaper .875 conservé). Duck musique .35 tenu .22 s (pompe, roquette), .18 s (SMG). Ennemis : même recette à rate .85, passe-bas 1,1 kHz, sans clic mécanique, niveau .24. Touche : tick 2,8+4,1 kHz τ 12 ms niveau .30, +½ ton par touche consécutive (max +6). Kill : thunk 90→50 Hz τ 70 ms + tick 3,2 kHz niveau .45. Envoi écho armes .09.
- Preuve exigée : page `file://` OfflineAudioContext Chrome, rafale SMG, ancien vs nouveau → pic et RMS sur 30 ms mesurés (compensation automatique du DynamicsCompressorNode à quantifier). `checks/audio.test.mjs` : pic .8–.85, rms .025–.4, duck (:313-314), voix. Écoute A/B.
- Qualité : meilleure.
- Garde-fous : le gain de compensation du compresseur décale le niveau de tout ce qui est sous le seuil (musique, ambiance, pas) de quelques dB → mesurer avant de figer. Chrome anticipe ~6 ms : l'attaque 12 ms est effective à ~6 ms. À faire **après** les mesures de la lacune MIX (arbitrage). Taille < 1 Ko.
- Dépend de : T3 (recettes intégrées pour mesurer le RMS +8 dB de FEEL-06 en même temps).

### T5 — Réduction du travail navigateur (nœuds, allocation) [RESTE-09]
- Où : src/audio.js:180-197 ; src/audio.js:281-299 ; src/audio.js:379-398 ; src/music.js:257-261 ; src/music.js:262-271 ; src/music.js:272-287 ; src/music.js:289-295 ; src/game.js:702
- Quoi : dans `FMusic.create`, 2 GainNode persistants par piste alternés pour le fondu 8 ms ; seul l'AudioBufferSourceNode est créé par note → 15 nœuds/s au lieu de 30. `voices` en tableau avec retrait par échange (supprimer `Array.from(Set)` par tick). `schedule` décode dans 4 enregistrements préalloués. Aucun `createBuffer` en jeu (prepare() de T1 couvre les 3 étapes).
- Preuve exigée : `audio.mjs` étendu journalisant (paramètre, instant, valeur) → journaux identiques hors doublons. Compteur nœuds/s ≤ 15. Capture OfflineAudioContext 10 s échantillon par échantillon identique.
- Qualité : identique.
- Garde-fous : réutiliser un GainNode change l'ordre des automations → garder exactement `setValueAtTime(0,t)`, rampe à `t+0,0015`, coupure à `t+0,008` ; vérifier absence de clic au recouvrement. NON contre-vérifié : valider par écoute Chrome avant clôture.
- Dépend de : T1 (prepare()), T2 (mémoire AudioParam).

## Options désactivées par défaut
- [LOOP-14] Variante à seuil (gain 0,003, fréquence 1 %, pan 0,01) — modifie légèrement le lissage exponentiel ; la suppression des doublons seule est identique.

## Écartés ou absorbés
- (aucun) — aucun des 5 constats n'est « réfuté » ; RESTE-09 est absorbé en partie par T1 (prepare) et T2 (mémoire AudioParam) mais conserve ses points propres (GainNode persistants, voices tableau, pré-allocation).

## Décisions à confirmer par David
- Écoute des WAV `bench/feel/wav/` (doomish-check) avant intégration FEEL-06 — valeur par défaut : intégrer si bande 120–500 Hz ≥ +5 dB et RMS ≥ +6 dB à pic égal.
- FEEL-07 conditionné aux mesures de la lacune MIX : lancer le harnais OfflineAudioContext SMG (ancien vs nouveau compresseur) et valider les valeurs −12/3/6/12/120 — valeur par défaut : accepter si pic ≤ .85 et pas de saturation du waveshaper .875.
- Grenade (45 % sous 120 Hz déjà, non prototypée) : appliquer la table FEEL-06 ou garder la recette v0.2 — valeur par défaut : appliquer la table (durée 520 ms, thump 110→45 Hz).

## Gains attendus du lot
Bande 120–500 Hz +5 à +12 dB (ressenti « lourd » sur haut-parleurs mobiles et desktop) ; RMS +8 dB à pic égal ; automations audio −45 % (identique) à −90 % (option seuil) ; nœuds/s musique divisés par 2 ; plus longue tâche de synthèse 156 ms → ≤ 8 ms ; tirs ennemis distinguables ; confirmations de touche et kill nettes. Taille totale +2,5 Ko.
