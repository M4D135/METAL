# Lot 04 : intégration et publication

Lire AGENTS.md, README.md et les bilans des lots. Aucun autre agent ou discussion n'est présumé actif : vérifier les commits, branches et PR réels.

## Responsabilité exclusive

`package.json`, `tools/build.py`, `tools/simulation-modules.json`, `dist/index.html`, `SIZE.json`, raccordement des modules partagés et rapports de validation. Préserver les préférences approuvées dans `config/default-controls.json` et tous les changements uniques des autres branches. Ne pas réinitialiser les touches du joueur.

## Ordre

1. Relire SHA de main et de chaque tête de lot. Préserver le checkpoint et l'historique. Ne pas écraser des modifications concurrentes ni utiliser de force push.
2. Intégrer les sources corrigées : d'abord divergence de reprise physique, ensuite cockpit/HUD/commandes, puis budgets et mesures. Coordonner les modifications de support.js, simulation.js et game.js.
3. Vérifier le verrou FERRO, reconstruire avec `python3 tools/build.py`, exécuter la suite npm entière. Ajouter les tests manquants sans supprimer les assertions gênantes. Refaire tests de distribution et empreinte.
4. Valider dans un vrai navigateur : nouveau jeu lourd, drone, lasers sans munitions, conduit, socle, piratage maintenu/interrompu, ouverture persistante, mort et reprise, changements de personnage, R/C et options d'aide, anciennes sauvegardes, démos de titre. Captures du cockpit et des accès, pas des images générées.
5. Vérifier accès aux 18 mondes, déferlantes et boss, budgets et mesures avant/après. Signaler précisément les appareils réels non testés.
6. Mettre à jour ce dossier, commiter sources/build/SIZE ensemble, comparer les SHA attendus et publier sans force. Fusionner dans main seulement les changements qualifiés. Vérifier main et l'état de la PR après fusion. Ne pas annoncer un hébergement externe modifié sans l'avoir fait.

## État de départ

Le checkpoint 0.12.9 se construit mais possède un échec connu de continuation après snapshot/restore. Il peut être poussé pour éviter de perdre le travail ; cela ne l'autorise pas à remplacer la version stable. Aucune nouvelle récurrence ou mission nocturne ne doit être créée.

## État de qualification du 17/11/2026 (relais Spark)

- Base de travail : `wip/support-drone-cockpit-20261117` à `94766578610fe700df8ac3c1c911882c5e53b695`, base publiée `351f2ccda91f0ba3c0f962316e714e9d7c20e8ac`.
- Build : `python3 tools/build.py` réussi. `dist/index.html` 13 685 006 octets, gzip 3 217 314 octets, SHA-256 `74e8f5ba04818b493a0d491ff46d8e3160596cf5247120278a0ed33788110f22`, 0 ressource externe.
- Suite npm complète sur Spark : 1396 tests annoncés, 1395 réussites, 0 échec, 0 annulé, 0 ignoré.
- Navigateur : Chrome headless 151.0.7922.137, SwiftShader/WebGL2, 0 erreur console, captures et rapport JSON produits.
- A/B CPU : `-1,09 %` médian de temps de simulation contre la tête de branche, sans annonce de FPS matériel.
- Publication : branche et `main` poussés via le Mac ; release servie `93e110412eece2da9e8aef714013ec89e5680e09`. Contrôle Mac : Node v24.18.0, build identique, npm test 1396 tests, 1395 réussites, 0 échec.
- Déploiement : `fps.estrasse.fr` basculé atomiquement sur `/home/ddd/apps/fps/releases/93e110412eece2da9e8aef714013ec89e5680e09`. URL servie : 13 685 038 octets, SHA-256 `65fc54fecac5ef2a8528c93bfa2e8fb061e7b8c205cc4b84d82f3c5b04910ca1`, `Version 0.12.9`.
- Retour arrière disponible : l'ancienne release `/home/ddd/apps/fps/releases/b985a3009508e300737cb2926641e92244dc9bbe` reste en place.
- Suite de qualification : `npm run render-check` Spark 55/55 SwiftShader et 55/55 ANGLE/NVIDIA GB10 ; navigateur local Vulkan sans erreur console ; correction du favicon public en `data:,` pour supprimer les requêtes `404`.
