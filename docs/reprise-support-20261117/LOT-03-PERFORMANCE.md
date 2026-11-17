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
