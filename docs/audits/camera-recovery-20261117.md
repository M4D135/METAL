# METAL : correction du retour de caméra, 17 novembre 2026

## État de livraison

Correctif du code de jeu dans `src/camera.js`, publié sur la branche `codex/flight-fixes-20261117`. Base produit : `7c7d78f3e244f33b06ec30eac1e58f8fab2eaf6a` ; parent de travail : `14fda4945825cb6cdf8e801f1e33f076cbe448e9`. **Pas une livraison reconstruite du jeu autonome.** L'intégration dans `main` attend les vérifications globales et la reconstruction de `dist/index.html` / `SIZE.json`.

`AGENTS.md`, `FERRO.lock.json`, le début de `VALIDATION.md` et le rapport d'intégrité du banc de vol ont été lus. `docs/mission-20261117/README.md` et `docs/CONSOLIDATION.md` sont absents de la base inspectée. Aucun travail 0.13.0 non publié n'est présumé disponible. Les sources de simulation, commandes, sauvegardes, rejeux, mondes et les 34 modules verrouillés FERRO ne sont pas modifiés. Aucun nouveau test complet de ces modules n'est revendiqué.

## Défaut et correction

L'ancien contrôleur amortit la distance demandée, mais pas la libération d'une obstruction. Après stabilisation devant un mur à 0,5 m, son dégagement passe en une image de 0,32 m à 3,2 m lorsque le mur disparaît. Le nouveau contrôleur conserve un état de récupération local à chaque caméra : rétraction immédiate face à un obstacle, retour exponentiel vers l'extérieur après sa disparition. À 60 Hz, dans ce scénario lourd, le premier retour passe à environ 0,8421 m au lieu de 3,2 m. Le profil drone est également couvert.

Le reset abandonne cet état, les changements ordinaires de vue conservent leur amortissement unique, et la caméra ne modifie jamais la visée ni l'état du joueur. Les calculs intermédiaires passent à des scalaires ; la table de cinq décalages n'est plus recréée à chaque image. Les tableaux transmis aux callbacks et retournés restent indépendants. La réduction des constructions de tableaux est vérifiée dans le code, pas par un profilage du tas ou du ramasse-miettes.

## Exécutions locales réelles

Node v22.16.0, Linux x64. Baseline `src/camera.js` : blob Git `a29530297485800f7b56c43ea87d446d19a283cf`. Candidat : `ceb80074c199625d972ed2882ee50650a61bef5f`.

- `node --check src/camera.js` : succès.
- `node --test checks/camera-recovery.test.mjs` : **21 tests réussis, zéro échec**.
- Même suite avec `METAL_CAMERA_SOURCE` pointant vers le blob historique exact : **15 réussites, 6 échecs attendus**. Ces six échecs sont des cas de régression du même défaut, pas six bugs distincts.
- Comparaison A/B : **14 000 étapes identiques** hors libération dynamique d'obstacle, comportement volontairement corrigé ; **36 284 appels de rayons comparés** (arguments et ordre).
- Les tests ciblés couvrent le lourd et le drone, le réticule, le sol, l'épaule, les obstacles mobiles, la rétraction immédiate, l'hystérésis, le reset, deux caméras indépendantes et la récupération à 20/60/120 Hz à temps égal.

## Mesures CPU, caméra seule

Banc A/B alterné avec échauffement, médianes, échantillons complets en sortie JSON, checksums identiques. Les rayons sont synthétiques : aucun coût de rendu GPU ni FPS du jeu n'est mesuré.

| Scénario | Passe 1, 20 000 images / 9 répétitions | Passe 2, 30 000 / 7 | Passe finale, 20 000 / 9 |
|---|---:|---:|---:|
| Première personne | -15,64 % | -16,37 % | -13,97 % |
| Lourd, troisième personne | -13,47 % | -13,55 % | -21,01 % |
| Drone, troisième personne | -14,27 % | -13,99 % | -14,92 % |

La variation entre passes, particulièrement pour le lourd, interdit de présenter un pourcentage fixe garanti. Aucun gain de FPS global n'est déduit de ces chiffres.

## Limites de qualification et reprise

Le workflow de qualification a été créé sur cette seule branche. L'exécution `44031551601` s'est terminée en échec avant tout test exploitable ; aucun journal de job n'a pu être récupéré. La cause précise n'est pas établie. Le clone complet n'est pas disponible dans le conteneur : la requête de téléchargement a échoué en résolution DNS. Les fichiers ciblés ont été récupérés par le connecteur puis vérifiés par leur hash Git.

Nouvel essai Chromium headless sur une page `data:` : expiration après 10 secondes, aucune sortie DOM ; **aucune validation navigateur du jeu**. La suite globale `npm test`, la reconstruction autonome et les essais sur appareils réels restent à faire. `dist/index.html`, `SIZE.json` et la version 0.12.6 sont donc conservés, sans les annoncer à jour avec ce correctif.

Reproduction depuis un clone complet :

```sh
git show 7c7d78f3e244f33b06ec30eac1e58f8fab2eaf6a:src/camera.js > /tmp/metal-camera-before.js
node --test checks/camera-recovery.test.mjs
METAL_CAMERA_SOURCE=/tmp/metal-camera-before.js node --test checks/camera-recovery.test.mjs
# La commande précédente doit échouer sur les six régressions décrites.
node tools/mission-20261117/camera-cpu-bench.mjs --baseline /tmp/metal-camera-before.js > /tmp/metal-camera-bench.json
python3 tools/build.py
npm test
```

Avant intégration : qualifier le build, inspecter les différences générées, ajouter `dist/index.html` et `SIZE.json`, puis relire le SHA de `main` et fusionner sans force. Les déplacements Quake III et le vol quaternion 6DOF restent des travaux séparés non livrés par ce correctif.
