# Lot 03 : budgets, stabilité et mesures

Lire AGENTS.md et README.md. Les 34 modules verrouillés ne se retouchent pas localement : tout correctif moteur commun part de la référence FERRO, est qualifié puis propagé.

## Isolation des modifications

Ne pas modifier simultanément `src/simulation.js` (lot 01) ou `src/game.js` (lot 02). Préparer des modules de budget/diagnostic indépendants et leurs tests ; transmettre les points d'appel nécessaires au lot 04. Réserver les nouveaux bancs sous `tools/reprise-support-20261117/` et les rapports de ce lot dans ce dossier. Ne pas supprimer les anciens benchmarks.

## Priorités

Le chantier inclut un plafond candidat de 20 machines et des limites de fragments ; vérifier toutes les voies de création (déferlantes, renforts, boss) et l'absence de vague bloquée. Préserver la densité perçue par étalement des renforts, pas en supprimant les objectifs. Hors vue, réduire le coût sans rendre inoffensifs les ennemis proches hors champ ou casser les projectiles/contacts.

Au plus cinq morceaux physiques par événement concerné ; conserver les vraies formes. Limiter ragdolls/joints, sommeil ou pose figée après stabilisation, réveil cohérent. Mesurer allocations et coûts avant d'introduire des pools de particules/audio. Ne pas annoncer « poussière GPU » ou « pool GPU » tant qu'ils ne sont pas réellement implémentés.

L'overlay développeur est amorcé dans game.js. Séparer CPU frame/simulation/rendu, draw calls, triangles, corps éveillés/endormis, joints, particules et voix. GPU indisponible doit rester N/D, pas zéro. Vérifier la provenance des compteurs ; la longueur de debris n'est pas un compteur universel de particules. Pas de résolution native abaissée automatiquement. Les seuils 83 % et 4,5 s sont à qualifier avec hystérésis ; ne pas promettre 40–45 FPS sur un téléphone non testé.

## Mesures requises

Même monde, seed, inputs, durée et environnement pour A/B. Déferlante complète et combat de boss, échauffement et répétitions alternées, médianes et dispersion, CPU/allocations distincts des FPS. Tester le banc sur les vraies sources. Le WebGPU parallèle est un chantier ultérieur, pas un prérequis à cette correction.

## Sortie attendue

Module(s), tests, traces brutes, comparaison honnête et limites. Ne pas transformer un banc CPU en annonce de gain FPS matériel. Aucun merge main avant qualification intégrée.

## Résultats du 17/11/2026 (relais Spark)

- Overlay développeur corrigé dans `src/game.js` : particules = débris + particules, voix réelles depuis `audio.stats`, `peakVoices`, corps éveillés/endormis, draw calls, triangles, CPU frame/simulation/rendu. GPU reste `null`/N/D, pas zéro.
- Test de budget ajouté dans `checks/support-budgets.test.mjs` : plafond de déferlante respecté sur les mondes 0, 8 et 17, vagues déployées, salle nettoyable, aucun éveil au-delà du plafond effectif.
- Banc A/B honnête ajouté : `tools/reprise-support-20261117/ab-budgets.mjs`. Même monde `FWorld.create(96,0)`, mêmes options, mêmes entrées scriptées, échauffement, répétitions alternées, médianes, dispersion, p95/p99, pire pas, pics de corps/joints/particules, delta tas.
- Rapport brut : `docs/reprise-support-20261117/ab-budgets-latest.json` et le fichier daté du 17/11/2026.
- Mesure Spark Node 24.18, Linux arm64, 5 répétitions de 12 s, baseline = tête de branche `9476657`, chantier = correction courante : médiane `0,1749 ms/pas` contre `0,1730 ms/pas`, soit `-1,09 %` de temps CPU de simulation. Ce n'est pas une mesure de FPS matériel.
- `npm run render-check` sur Spark : 55/55 en SwiftShader, puis 55/55 avec `--angle vulkan` sur ANGLE/NVIDIA GB10. Rapport : `docs/reprise-support-20261117/render-spark-vulkan.json`.
- `npm run render-check` sur Mac : 55/55 avec `--use-angle=metal` sur ANGLE/Apple M5.
- Soak démo Spark : 1800 s, 57 scènes, 108 000 pas, 0 mort, 0 arrêt bloqué, 0 erreur ; `p50` simulation `1,68 ms`, `p99` `4,90 ms`, tas suivi de `26,47 MiB` à `35,53 MiB` avec GC périodique.
- Soak boss Spark : 600 s, 10 scènes boss, 8 boss tués, 0 mort, 0 arrêt bloqué, 0 erreur ; `p50` simulation `2,13 ms`, `p99` `6,71 ms`, `max` `31,41 ms`.
- Limites : le banc A/B reste un mesure CPU Node ; le GPU matériel est validé en rendu et absence d'erreur, pas en FPS GPU horodaté. Pas de banc apparié WebGL sur GPU Apple, pas de téléphone ni manette physique.
