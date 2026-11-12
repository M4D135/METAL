# Lot 10 — Colosses et équilibrage
## But
Rendre les trois colosses lisibles, esquivables et variés sans saccade. Fixer la double Onde, le Balayage aveugle et le Barrage trompeur. Livrer une démo qui tient 30 min et un équilibrage PV validé par les bots.
## Tâches, dans l'ordre

### T1 — Sensation de puissance : audio, réticule, caméra, mort [BOSS-12]
- Où : src/audio.js:600-602 ; src/motion.js:36-46 ; src/game.js:194-200, :722 ; src/simulation.js:812-818, :1135
- Quoi : (a) événement `weakHit` avec son métallique aigu généré par le code + réticule orange 0,3 s ; le tir au corps garde un son sourd atténué. (b) `motion.impulse` reçoit un canal générique paramétré (sans changer les valeurs par défaut) ; `bossImpact` déclenche `blast(0,8·clamp(1−d/40))`, l'Onde 0,4, la mort 1,0. (c) Les 12 explosions de mort émettent `emit('explosion')` (simulation.js:818). (d) Arrêt sur image 120 ms côté rendu uniquement.
- Preuve exigée : `node $B/yaw.mjs <racine> 2` inchangé ; capture headless visée cœur pendant tir → réticule orange visible ; `node $B/fight.mjs <racine> 2 60 skilled 1` → événements `bossImpact` ≥ 1 par Onde.
- Qualité : meilleure (répond au retour « raide » de David).
- Garde-fous : aucun champ de sauvegarde ajouté ; sons 100 % générés (AGENTS.md) ; tests checks/motion.test.mjs et checks/audio.test.mjs à compléter ; taille +1 à 2 Ko.
- Dépend de : rien.

### T2 — Double Onde : écart 1,20 s → 1,95 s [BOSS-02]
- Où : src/simulation.js:1675 (tell de la seconde Onde)
- Quoi : remplacer `tell:2.55` par `tell: premier.tell + 1.95`. Première Onde à 1,35 s (phase 2), seconde à 3,30 s. Écart de fronts = 1,95 s > recharge dash 1,7 s (marge 0,25 s). Aucune valeur sauvegardée n'est ajoutée.
- Preuve exigée : `node $B/phase2.mjs <racine> 0` et `… 2` → écart ≥ 1,9 s. `node $B/fight.mjs <racine> 0 180 max 0` → coups d'Onde en phase 2 ≤ moitié de la référence. Cycle bossClock allongé de 0,75 s : vérifier `node $B/mix.mjs <racine> 120 1` (cycle 6,4 à 7,4 s).
- Qualité : meilleure (la double Onde devient esquivable à deux dashs).
- Garde-fous : checks/simulation.test.mjs:1727-1812 « scripts distincts » à compléter par un test « double Onde esquivable » ; déterminisme conservé (valeur constante).
- Dépend de : rien.

### T3 — Démo qui dure : pilote et contrôleur [BOSS-V2]
- Où : src/game.js (contrôleur démo) ; src/simulation.js:116, :1915, :1722 (lecture état simulé)
- Quoi : (a) Contrôleur FERRO générique : minuterie d'inactivité à l'écran-titre, arrêt à la première entrée, graine fixe, chien de garde (relance si stagnation > N s). (b) Pilote METAL reproduit les entrées du bot « skilled/max » de bench/boss/fight.mjs : orbite 15 m, fuite zones, dash au front d'Onde, garde si dash recharge, tir cœur en fenêtre. (c) Mort → reprise au checkpoint, monde suivant après 2 échecs. Bandeau « DÉMO » + sortie au premier toucher.
- Preuve exigée : `FIX=1 FIXBOT=1 node bancs/boss-verif2/vfight.mjs <racine> {0,2,3,5} 180 max 1` → 4 victoires. Pilote dans bench/loop/harness.mjs sur 30 min virtuelles → ≥ 2 colosses tués, aucun pas > 16 ms.
- Qualité : meilleure (démo fonctionnelle vs 0 victoire sur 4 actuellement).
- Garde-fous : pilote lit uniquement l'état simulé (déterminisme) ; n'écrit ni sauvegarde ni économie ; contrôleur FERRO inactif par défaut pour BITUME/Point de rupture ; taille +3 à 5 Ko.
- Dépend de : T2 (Onde esquivable) + BOSS-01 (lot antérieur, garde ±70° / absorption 75 %).

### T4 — Présence = carré, anti-campement, pas de checkpoint en boss [BOSS-03]
- Où : src/simulation.js:1682, :1687, :1698, :1652 ; src/game.js:217
- Quoi : (a) Une fois `bossAwake`, la présence devient `|dx|<29,5 && |dz|<29,5 && |dy|<5` ; le réveil reste à r<28. (b) Si le joueur reste à > 27 m du centre plus de 3 s → Barrage forcé sur sa position (bossPoint borné au carré |x|,|z| ≤ 29 ; Onde garde r=27). (c) `checkpointDue` supprimé au ramassage d'armure tant que `bossAwake` est vrai ; reprise au seuil ou à la mort du boss.
- Preuve exigée : `node $B/fight.mjs <racine> {0,1,2} 120 corner 0` → ≥ 10 attaques et dégâts reçus > 0 (référence actuelle : 1 attaque, 0-22 dégâts). checks/checkpoint.test.mjs vert.
- Qualité : meilleure (supprime la zone morte ; l'exploit à ≈ 1 PV/s disparaît).
- Garde-fous : le réveil scénarisé (r<28) est conservé ; déterminisme OK ; checks/simulation.test.mjs à compléter (test « corner 120 s → ≥ 10 attaques »).
- Dépend de : rien.

### T5 — Balayage qui touche un joueur immobile [BOSS-05]
- Où : src/simulation.js:1670-1672, :1655, :1722
- Quoi : Phases 0 et 1 : faisceau 1 vise la position prédite (`lastSeen + v_lat·tell`, v lue sur l'état simulé `locomotion.vx/vz` sur 0,3 s) ; faisceau 2 décalé de +0,30 rad côté déplacement pour couper la fuite. Tells 1,6 et 2,02 s inchangés. Phase 2 : trois faisceaux à −0,3 / 0 / +0,3 rad. Aucun champ sauvegardé ajouté (prédiction en interne).
- Preuve exigée : `node $B/shield.mjs <racine>` → Balayage inflige des dégâts à un joueur immobile à 15 m (référence : 0). `node $B/fight.mjs <racine> 1 120 static 0` → ≥ 1 touche de Balayage (référence : 0 sur ~60 lancements).
- Qualité : meilleure (le Balayage punit l'immobilité, cohérent Doom/Quake).
- Garde-fous : prédiction sur état simulé uniquement (déterminisme) ; checks/simulation.test.mjs « scripts distincts » à adapter ; le faisceau rotatif (ω, a0) est reporté à la révision de format (T8).
- Dépend de : rien.

### T6 — Barrage : impact à la fin du tell [BOSS-06]
- Où : src/simulation.js:1654, :1669, :1712, :1717 ; src/effects.js:28-42
- Quoi : (a) Tirer la roquette à `tell − vol`, avec `vol = |bouche − cible| / 18` calculé à la création (variante sans champ sauvegardé). (b) `activeDuration` passe de 2,8 à 0,35 s ; pendant le tell, cercle intérieur qui se resserre (`rayon·(1−age/tell)`) ; à l'impact, flash + fondu 0,3 s. (c) Compenser bossClock (:1678) pour que le cycle reste 6,4 à 7,4 s ; vérifier que la fenêtre du cœur suit l'impact.
- Preuve exigée : `node $B/timing.mjs <racine> 1 45` et `… 2 45` → écart impact − fin tell ≈ 0 (référence : 0,75 à 0,83 s). `node $B/mix.mjs <racine> 120 1` → cycle inchangé. checks/effects.test.mjs adapté.
- Qualité : meilleure (zone rouge trompeuse de 2 s supprimée ; danger lisible).
- Garde-fous : `barrel()/mouth.blocked` évalué au moment du tir ; pas de champ sauvegardé ; checks/boss-progression.test.mjs non touché (cycle compensé).
- Dépend de : rien.

### T7 — Télégraphes lisibles : audio distinct + postures corps [BOSS-04]
- Où : src/audio.js:541-555 ; src/soundscape.js:5, :37 ; src/actors.js:249-260 ; src/simulation.js:1678, :1691 ; src/game.js:629-634
- Quoi : (a) Un tell distinct par famille (Écrasement : grondement 60-110 Hz / 1,4 s ; Onde : bourdon montant ; Barrage : bips 4→12 Hz ; Balayage : sifflement), gain 0,25-0,30, `bossTell:90` dans ranges. (b) Postures sur le corps du géant à partir de `windup/windupMax` : bras levé (Écrasement), accroupissement + cœur pulsant (Onde), nacelles rouges (Barrage), lame lumineuse (Balayage). (c) Colonne verticale translucide 0,4×8 m (α 0,35) sur zones Barrage/Écrasement. (d) HUD : arc rouge orienté + anneau de compte à rebours sous le réticule.
- Preuve exigée : `node $B/tellaudio.mjs <racine>` → gain tell ≥ 0,06 à 15 m (référence : 0,012-0,019). `python3 $B/frustum.py` mis à jour → colonnes visibles entre 41° et 66°. Capture headless arène visée cœur pendant chaque tell.
- Qualité : meilleure (transition fenêtre → télégraphe lisible ; tell audible).
- Garde-fous : **bloqué par les mesures de la lacune MIX** (arbitrage FEEL-06/07/LOAD-13/LOOP-14/BOSS-04) ; sons générés par le code ; taille +3 à 6 Ko ; checks/effects, actors, actor-visibility, audio, soundscape à adapter ; daltonisme : formes ≠ couleurs.
- Dépend de : mesures de la lacune MIX (lot antérieur) ; T1 (canal impulsion générique).

### T8 — Équilibrage PV, fenêtre uniforme, ravitaillement [BOSS-10]
- Où : src/world.js:1573 ; src/simulation.js:1728, :1645-1651 ; src/economy.js:53-58 ; checks/boss-progression.test.mjs:9
- Quoi : (a) Fenêtre uniforme 3,0 s pour les trois espèces (:1728) — aucune ouverture raccourcie. (b) Ravitaillement à chaque Surcharge : 2 caisses (armes les plus déficitaires) à r=12, via dropLoot/lootPickup. (c) Table de PV dérivée de `bench/boss/window.mjs` après application de LOOP-08 et FEEL-12 : `PV_i = arrondi_50(N_i × D_i)`, N_i = 6 + 4·i/17. Cible : 6 à 10 fenêtres par monde, TTK humain 60 à 120 s. (d) Réécriture de checks/boss-progression.test.mjs:9 après accord David.
- Preuve exigée : `node $B/window.mjs <racine>` → 6 à 10 fenêtres à chaque monde. `GOD=1 node $B/fight.mjs <racine> {0,5,11,17} 600 max 1` → TTK régulier, munitions > 0. `node $B/ttk.mjs` vert.
- Qualité : sans objet (équilibrage).
- Garde-fous : **ordre imposé par l'arbitrage** : LOOP-08 → FEEL-12 → nouvelle mesure window.mjs → table. Décision explicite David sur le test de progression. Butin dynamique : validation atomique du snapshot. checks/campaign-simulation.test.mjs concerné.
- Dépend de : LOOP-08 et FEEL-12 (lots antérieurs) ; T2, T4, T5, T6 (équité appliquée avant mesure).

### T9 — Variété : anti-répétition, modificateurs, gardes, attaques signature [BOSS-11]
- Où : src/simulation.js:1658-1680, :22 ; src/brain.js:14-24 ; src/world.js:1720-1724 ; src/actors.js:33, :249-357
- Quoi : (a) Anti-répétition : pénalité −0,35 sur la famille du tour précédent, interdiction de 3 attaques identiques de suite (`e.lastKinds` sur 2 éléments). (b) Modificateurs par cycle c = floor(i/3) : c≥1 +1 roquette ; c≥2 sol brûlant 3 s (8 dég/s) ; c≥3 Onde à brèches tournantes ; c≥4 Balayage rotatif ; c≥5 combo Onde+Barrage. (c) Gardes par chapitre : c0-1 : 3+3 drones ; c2-3 : 2 drones + 1 grenadier ×2 ; c4-5 : 2 drones + 1 lance-roquettes ×2. (d) Attaque signature phase 2 par espèce (charge 6 m / tapis bombes / rayon cœur), tell ≥ 1,6 s.
- Preuve exigée : `node $B/mix.mjs <racine> 120 1` → aucune famille > 50 % à toutes distances (référence : Onde 76-83 %). `node $B/explore.mjs <racine>` → composition gardes par monde. checks/brain, simulation, world adaptés.
- Qualité : meilleure (combats différents d'un cycle à l'autre).
- Garde-fous : `lastKinds` + champs modificateurs → **révision unique du format de sauvegarde en fin de chantier simulation** (arbitrage SIM-05/LOAD-05/LOAD-14/BOSS-02/FEEL-08/FEEL-09) ; un seul lot de tests checks/checkpoint.test.mjs ; empreinte du monde modifiée (world, campaign-world) ; taille +2 à 4 Ko.
- Dépend de : T2 (brèches Onde), T5 (Balayage rotatif), T8 (équité validée avant variété).

## Options désactivées par défaut
- (aucun constat de qualité « dégradée » dans ce lot)

## Écartés ou absorbés
- (aucun constat « réfuté » parmi les 9 identifiants ; les corrections de la contre-vérification sont intégrées dans les tâches ci-dessus)

## Décisions à confirmer par David
- Table de PV reconstruite vs table verrouillée par checks/boss-progression.test.mjs:9 (commit 673d6b2) — valeur par défaut : table dérivée de window.mjs, test réécrit.
- Fenêtre du cœur suit-elle l'impact du Barrage (T6) ou la fin du tell — valeur par défaut : suit l'impact (meilleur ressenti, +2,45 s à bossClock).
- Déplacement des pickups (soins, munitions, couverts) à r=20-22 (T4 point 3) : nécessite une montée de génération du monde — valeur par défaut : différé à la prochaine montée de génération.
- Résolution native vs repli manuel si la machine ne tient pas (NATIF-V1, hérité) — valeur par défaut : native, choix au joueur dans options.

## Gains attendus du lot
Double Onde esquivable (écart 1,20 → 1,95 s) ; Balayage passe de 0 touche sur ~60 lancements à ≈ 1 sur 2 contre un immobile ; Barrage sans zone rouge trompeuse (−2 s/salve) ; zone morte des angles supprimée (≥ 10 attaques vs 1 en corner 120 s) ; tell audible ×13 à ×16 vs référence ; démo 30 min avec ≥ 2 colosses tués (vs 0 victoire sur 4) ; TTK humain 60-120 s par boss (vs 75-464 s) ; aucune famille d'attaque > 50 % (vs Onde 76-83 %). Aucun impact sur la fluidité : toutes les tâches sont côté simulation ou rendu sans boucle lourde ; la démo est bornée à 16 ms/pas.
