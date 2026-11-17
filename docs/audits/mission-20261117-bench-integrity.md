# METAL — contrôle d'intégrité du banc CPU drone (17 novembre 2026, passage 3)

Base GitHub inspectée : `1046953c40bf80df9864265310226a7fd306817a`. `AGENTS.md` et les rapports `docs/audits/main-20261117-audit-independant.md`, `docs/audits/mission-20261117-flight-bench.md`, `docs/chantier-moteur/rapports/finition-finale-20261115.md` et `docs/chantier-moteur/rapports/lot-03s-t5.md` ont été consultés. `docs/mission-20261117/README.md` était encore absent (404 sur cette tête). Aucun PR ouvert à la lecture. Travail concurrent local non observable : modification limitée à l'outil de mesure et à ce rapport ; aucun `src/`, `dist/`, `SIZE.json`, module FERRO ou branche existante modifié.

## Deux erreurs démontrables du banc précédent

1. **Durées simulées inégales :** le paramètre `--steps` acceptait tout entier >= 6 ; `Math.round(steps * fps / 120)` donnait, pour `--steps 841`, 140 pas à 20 Hz soit **7,000000 s**, mais 841 pas à 120 Hz soit **7,008333 s**. La couverture des quatre phases d'entrée différait aussi. La version corrigée impose `--steps` divisible par 24 : les trois fréquences ont alors exactement la même durée et chaque phase contient un nombre entier de pas.
2. **Comparaison CPU sur une statistique incohérente :** le rapport affichait une médiane pour chaque variante, mais `candidateVsBaselineCPUPercent` utilisait la moyenne, sensible aux pointes JIT/GC. Sur les exemples A = [1, 1, 100] et B = [2, 2, 2] ms, l'ancienne formule indiquait **-94,118 %** tandis que les médianes affichées impliquent **+100 %**. La nouvelle valeur utilise le rapport des médianes, ou `null` si la médiane CPU de base est nulle. Les échantillons complets restent dans le JSON pour ne pas masquer la variance ou les pics.

## Contrôles et limites

- Les transformations textuelles ont été contrôlées sur six ancres uniques ; vérification arithmétique indépendante des deux contre-exemples effectuée pendant ce passage.
- **Validation isolée du code exact du blob candidat :** syntaxe compilée via le moteur V8 après retrait des six imports Node, puis exécution effective des **17 assertions** de `selfTest()` avec remplacement minimal des fonctions `assert`, du hash et du résolveur de chemin. **Smoke test A/B factice :** 9 scénarios/fréquences, 480 appels simulés, durée 0,2 s identique à 20/60/120 Hz, états A/B égaux et stables. Ces contrôles ne sont **pas** des exécutions Node du banc complet ni du moteur METAL. `node --check`, `npm test` et le banc sur la vraie simulation restent non exécutés : le clone privé n'est pas disponible localement (résolution DNS bloquée).
- Nouvel essai navigateur dans le conteneur : Chromium n'a pas fourni le DOM d'une page `data:` avant le délai de 12 s (sortie vide, expiration), malgré `--no-sandbox` ; **aucune validation navigateur/FPS**.
- Les tests de référence FERRO restent ceux du passage précédent (34/34 blobs identiques), **pas une nouvelle exécution**. La dernière vérification de dist et SIZE porte sur la version 0.12.6 ; le présent changement ne touche aucun code de jeu. Le rebuild `dist/index.html` / `SIZE.json` ne serait pas pertinent pour une correction d'outil uniquement.

## Priorités

Exécuter `node tools/mission-20261117/flight-cpu-bench.mjs --self-test`, puis des A/B réels avec `--steps 840` (durée = 7 s), code du premier passage effectivement disponible, snapshots identiques si comparaison équivalente, et mesures de GC/allocations indépendantes. Refaire ensuite les tests de simulation, sauvegarde/rejeu, dix-huit mondes, contrôles et rendu en navigateur avant tout changement du jeu. Les contributions 6DOF et strafe-jump restent non vérifiables sur le `main` inspecté. Ne pas tirer de FPS des mesures CPU.
