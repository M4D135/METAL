# METAL — passage indépendant, 17 novembre 2026 : banc de vol CPU

Ce passage part de `main` à `912ba19157285ff10825590b7506297bacd3a0c7`. `AGENTS.md`, `FERRO.lock.json`, `VALIDATION.md`, `docs/chantier-moteur/rapports/finition-finale-20261115.md`, `docs/chantier-moteur/rapports/lot-03s-t5.md` et le précédent audit ont été examinés. **`docs/mission-20261117/README.md` reste absent** du `main` accessible à ce passage. Aucun PR ouvert n'est visible ; cela ne démontre pas l'absence de travail local en cours.

## Contribution indépendante (outillage, pas gameplay)

Nouveau `tools/mission-20261117/flight-cpu-bench.mjs` : banc de reproduction pour la simulation du drone. Il utilise le chargeur `tools/realm-loader.mjs` et la **même structure de monde pilote** que `checks/flight.test.mjs`, sans modifier les sources de jeu, les commandes, les sauvegardes, le rendu ni les 34 fichiers verrouillés FERRO.

- 3 situations : stationnaire, déplacement+montée/descente/boost, obstacles avec mur et plafond ;
- 20 / 60 / 120 Hz, **même durée simulée**, entrée construite hors chrono ;
- nouveaux mondes et simulations à chaque passage ; échauffements exclus ; répétitions et empreintes SHA-256 des snapshots ;
- option `--candidate` pour un couple A/B dans **le même processus**, ordre A/B puis B/A alterné, sortie JSON contenant durées CPU (user+system), durées murales, échantillons, empreintes et SHA-256 des sources ;
- arrêt en cas de mort/victoire prématurée, incohérence d'état entre passages ou divergences A/B. Une divergence fonctionnelle intentionnelle (par exemple 6DOF) doit être étudiée séparément et ne doit pas être présentée comme un gain équivalent.

Commandes, depuis la racine d'un clone complet :

```bash
node tools/mission-20261117/flight-cpu-bench.mjs --self-test
node tools/mission-20261117/flight-cpu-bench.mjs --steps 840 --warmups 1 --reps 5 --out flight-baseline.json
node tools/mission-20261117/flight-cpu-bench.mjs --candidate /chemin/vers/autre-clone --steps 840 --warmups 1 --reps 5 --out flight-ab.json
```

**Limite d'interprétation :** les chiffres que produira cet outil mesurent le coût **CPU de `simulation.step`** et non isolément les allocations, `fly()`, les FPS, le GPU, WebGL ou le temps image. Le compteur mémoire n'est volontairement pas extrapolé en octets alloués. Les résultats devront être confrontés aux épreuves de rejouabilité, aux 18 mondes, aux modes tactile/manette et à un vrai navigateur.

## Qualification effectivement faite

- `node --check` du nouveau banc : **PASS**.
- `--self-test` : **12 assertions réussies**, uniquement sur ses fonctions pures ; pas de code du jeu chargé.
- Exécution du banc avec un **`realm-loader.mjs` factice déterministe**, 9 couples situation/fréquence, deux variantes identiques : `allStable=true`, `sameStateAcrossVariants=true`. C'est un **smoke test d'orchestration**, pas une validation des performances du jeu.
- Vérification du SHA du blob Git du script proposé contre le fichier local vérifié : **identique** (`9565aa9e5231ff3ada970dde9aa0b41684fd6177`).
- Le dépôt privé complet n'est pas monté dans l'environnement d'exécution ; aucun `npm test` sur le projet ni benchmark METAL réel n'a été effectué. Aucun navigateur fonctionnel du jeu n'a pu être validé ici ; le précédent essai Chromium échouait avant `about:blank` (ProcessSingleton). Aucun gain FPS ni allocation économisée annoncé.

## Risques et intégration

Ce commit ne doit contenir que **deux nouveaux fichiers** : ce rapport et le banc. `src/`, `FERRO.lock.json`, `AGENTS.md`, les 34 modules, `dist/index.html` et `SIZE.json` doivent rester octet pour octet identiques. L'artefact 0.12.6 **n'est pas reconstruit** puisque le code du produit est inchangé. Toutes les branches divergentes, y compris `opencode/titre-zip-signature-20261116`, doivent être préservées.

## Suite conditionnelle

1. Lire les sources et le README nocturnes **lorsqu'ils seront réellement publiés**, puis qualifier le vol quaternion 6DOF et le strafe-jump sans effacer les contrôles de profil ou les reprises.
2. Exécuter le banc sur **deux racines complètes** avec snapshots comparables, et le test complet, pour départager les optimisations réellement mesurées.
3. Établir un profil GC/allocations et un profil navigateur WebGL sur matériel disponible ; corriger uniquement une cause localisée en gardant l'empreinte de simulation identique.
4. Reconstruire `dist/index.html` et `SIZE.json` **avec `python3 tools/build.py` après une modification produit qualifiée**, conformément aux règles.

**Bilan :** ajout d'un outil de mesure reproductible et d'une preuve de smoke-test. **Zéro bug de gameplay corrigé et zéro gain CPU/FPS démontré** pendant ce passage ; aucune hypothèse n'est présentée comme livraison.
