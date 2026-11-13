# T1 — Retrait du bouclier du jeu (src + checks + dist)

Lot : « Décision David 13/11 — le bouclier sort du jeu ».
Base du lot : `35c654adba3904b6617c59ba7a06ec71b590ce2b`, branche `chantier/jeu-bouclier-supprime`.

## Ce qui a été retiré

| Fichier | Retiré |
| --- | --- |
| `src/simulation.js` | état `shield` (`energy`, `raised`, `rechargeDelay`, `bashCooldown`, `bashVisual`), `SHIELD`, `shieldFacing`, `shieldBash()`, `updateShield()`, absorption frontale dans `hurt()`, bonus de capacité d'armure 200, `input.bash` |
| `src/world.js` | `progression.startShield`, ramassage `arsenal-shield`, trophée d'index 3 (`trophy-shield`), branches `shield` de `campaignTrophies` |
| `src/economy.js` | offre `shield` du catalogue (14 → 13 offres), `kind:'shield'` dans `copyState`/`quote`/`transact` |
| `src/game.js` | jauge d'énergie, modèle 3D du bouclier, `shieldLift`, dessin du ramassage, choix « garde » de la main gauche, toasts et aides clavier/tactile |
| `src/options.js` | libellé `fireLeft` (« Tirer · main gauche »), `dash` (« Esquive ») |
| `src/index.html`, `src/style.css` | option de main gauche « Garde », `#shield-meter`, `#shield-energy`, règles CSS associées |

Conservés volontairement : `pulse` (onde défensive, indépendante du bouclier), `melee` (coup de crosse),
invulnérabilité courte de l'esquive (`p.dashing > 0` dans `hurt()`), `arsenalVersion` inchangé.

## Tolérance pour les données antérieures (aucun format de sauvegarde modifié)

Un point de reprise écrit avant le retrait peut encore mentionner le bouclier. Il est **toléré**, jamais refusé :

- `state.shield` et `inventory.shield` sont ignorés à la lecture ;
- `equipment.left === 'shield'` devient `null` (main gauche libérée) ;
- `campaign.discovered` contenant `'shield'` est filtré ;
- `armor.capacity === 200` est accepté et clampé à 100, `armor.points` jusqu'à 200 est clampé à 100 ;
- un ramassage `kind:'shield'` resté dans un monde reste inerté (jamais ramassé, aucun événement).

Preuve d'absence de plantage : `checks/progression.test.mjs` (« An old loadout that held the shield simply
frees the left hand »), `checks/checkpoint.test.mjs` (« Malformed entry equipment cannot prevent resuming… »,
charge d'entrée corrompue avec `equipment.left:'shield'`, `inventory.shield:true`, `armor.capacity:200`),
`checks/armor.test.mjs` (« a save from the two-hundred-point era is clamped to the flat ceiling, never refused »),
`checks/progression.test.mjs` (« an old shield pickup stays inert »).

## Vérifications exécutées

```
npm test            → 505 tests, 505 passés, 0 échec
python3 tools/build.py
```

Références des fichiers de tests concernés, exécutés individuellement puis en chaîne :

| Fichier | Résultat |
| --- | --- |
| `checks/simulation.test.mjs` | 120 / 120 |
| `checks/checkpoint.test.mjs` | 61 / 61 |
| `checks/campaign-world.test.mjs` | 46 / 46 |
| `checks/input.test.mjs` | 25 / 25 |
| `checks/progression.test.mjs` | 23 / 23 |
| `checks/finput.test.mjs` | 54 / 54 |
| `checks/campaign-simulation.test.mjs` | 16 / 16 |
| `checks/armor.test.mjs` | 12 / 12 |
| `checks/economy.test.mjs` | 14 / 14 |
| `checks/world.test.mjs` | 18 cas, PASS |
| `checks/boss-progression.test.mjs` | 7 / 7 |
| `checks/first-person.test.mjs` | 3 / 3 |

Suite de référence sur la base du lot : 505 tests, 505 passés, 0 échec (`.relais/npm-test-base.log`).
Aucun test n'a été supprimé ; les tests qui décrivaient le bouclier ont été réécrits pour décrire le
comportement attendu après retrait (esquive toujours disponible, main gauche appariée, capacité d'armure
plate, silhouettes des deux mains lisibles).

## Empreintes de génération recalculées

Le retrait modifie la génération (ramassage d'ouverture, trophées, budget d'épreuve) : ce sont des
changements de contenu **volontaires**, pas une dérive.

- `checks/campaign-world.test.mjs` → `legacyHashes` (6 empreintes) recalculées ;
- `checks/campaign-world-digests.json` régénéré (108 mondes modifiés) par la commande officielle :

```
node tools/platform-math.mjs worlds . --fixture write
```

## Conséquences équilibrage, assumées et chiffrées

| Grandeur | Avant | Après | Motif |
| --- | --- | --- | --- |
| Palier de pression max (arsenal complet, monde 18) | 5 | 4,6 | le compteur d'équipements ne compte plus le bouclier (4 au lieu de 5) ; `campaignPolicy` conserve la courbe `best*0,6 + count*0,4` |
| `maxActive` au palier maximal | 12 | 11 | conséquence directe du palier 4,6 |
| Palier d'un arsenal partiel (roquette seule, monde 18) | 3,4 | 3,4 | inchangé : les paliers intermédiaires ne bougent pas |
| PV du colosse, arsenal complet (monde 16) | 130 | 125 | facteur `1 − 0,09 × (chapitre − palier)` avec palier 4,6 |
| Capacité d'armure | 100, ou 200 bouclier équipé | 100 partout | le bonus était attaché au bouclier |
| Catalogue d'atelier | 14 offres | 13 offres | offre `shield` retirée |
| Trophées de campagne | 6 (mondes 4, 7, 10, 13, 16) | 5 (mondes 7, 10, 13, 16) | le trophée du monde 4 distribuait le bouclier |
| Infanterie explosive (campagne) | attend le bouclier **et** l'arsenal lourd | attend l'arsenal lourd (`weapons[1..3]`) | la réponse au danger explosif est désormais l'arsenal lourd |

Le ramassage `arsenal-shield` du monde 1 est devenu `arsenal-smg-cells` (24 cellules de mitraillette,
même position) pour ne pas laisser un trou d'équipement en ouverture ; l'ancre de réservation de
`campaignArmory` v1 devient `arsenal-grenade-launcher`.

## Taille livrée

`dist/index.html` reconstruit avec `python3 tools/build.py` :

- 841 413 octets (plafond du lot : 1 400 000) ;
- `sha256` `b1fe2f5f9d820590375486a8165fe5a307ac310b08ed7989556cc36b75c6bcad`, identique à `SIZE.json` ;
- 0 actif externe, aucune dépendance d'exécution.

## Ce qui reste à vérifier hors simulation

Le navigateur n'est pas exercé par ces tests : HUD sans jauge, sélecteur de main gauche sans « Garde »,
ramassage absent en 3D et commandes tactiles doivent être revus sur un appareil réel.
