# Intégration du rendu CPU — 15 novembre 2026

Le lot préparé sur 8bc8ea5 est assemblé avec le moteur 930c199. La revue corrige une collision du hash de sélection qui pouvait conserver de mauvais maillages en couleur et en ombre, et un cache FMotion.place devenu périmé quand les axes étaient modifiés. Deux tests reproduisent ces défauts avant correction et passent après. Les buffers ne sont plus conservés dans la table de capacité après restauration du contexte ou destruction du renderer. Les outils de preuve chargent FPassages avant FWorld.

Validation : 869/869 tests, build et diff réussis. Quatorze scènes Chrome/SwiftShader, dont portrait et Canvas2D, sont identiques pixel par pixel à 930c199 (écart maximal nul). Ce contrôle est une preuve d’image, pas un résultat de performance GPU.

Scène camp:17, seed 96, cinq répétitions de 600 images, ordre alterné par image et contrôle A/A : médiane CPU draw+models 7,479 → 4,995 ms ; ratio corrigé 0,6564 (−34,36 %). La médiane de draw est 5,667 → 3,636 ms et son p99 32,600 → 21,132 ms. Banc Node avec WebGL enregistreur, chiffres non assimilables aux FPS navigateur. Les reçus et sources sont conservés dans `../preuves/lot-05-integration/`.

Les abandons et limites du rapport initial restent valables, dont le seuil d’allocation T3 non atteint (0,32 Mo pour une cible de 0,2 Mo). Le rendu incrémental 03r et le budget GPU sont des travaux distincts. Aucun changement de format des parties. Artefact autonome : 919 341 octets bruts, aucun asset externe, version inchangée 0.9.2.
