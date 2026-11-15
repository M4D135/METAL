# Lot 16 — intégration des 18 ciels

Le jeu charge FSky pour les 18 mondes de campagne. Les anciennes expéditions gardent leur environnement ; la génération et les sauvegardes ne changent pas. Le module livré en une passe, sans textures, est conservé : la première fiche de textures amorties est remplacée par la mission du module décrite dans `modules/ciel.md`.

Le raccord `skyEnvironment` résout et mémorise un ciel par monde, sans modifier ce monde. Il fournit l'astre visible, la lumière clé séparée, la teinte et l'ambiance. Le brouillard du monde et des particules lit la même table atmosphérique dans la direction de vue. Le programme de ciel est dessiné à profondeur 1 après les opaques, avant les particules et l'arme : la géométrie masque ainsi le calcul des pixels de ciel inutiles. L'option de diagnostic `skyFirst:true` permet la contre-épreuve.

L'absence de FSky ou un échec de compilation garde le ciel historique. Les uniformes sont remis en place après restauration du contexte. Le secours Canvas utilise les couleurs résolues, cinq arrêts de dégradé, l'astre réel, les étoiles et une couverture de nuages teintée ; il reste une approximation, sans prétention de parité avec WebGL.

## Validation

- `tools/proof/lot16/sky-chrome.mjs` : 18 mondes, 512 × 288 pixels natifs, géométrie et particules, deux ordres de rendu ; **zéro octet différent**, aucune erreur WebGL ni compilation.
- Six vues héritées (trois secteurs × deux tangages), comparées au renderer de `23fc0a5` : **zéro octet différent**.
- Perte puis restauration réelle du contexte Chrome : ciel rechargé sans erreur. Compilation du ciel volontairement invalide : repli historique WebGL fonctionnel. Secours Canvas exécuté et capturé.
- 39 tests ciblés ciel et renderer passent. Le module ciel est désormais dans la suite npm.
- Suite complète : **1 057 tests réussis, zéro échec** ; build autonome de **1 143 141 octets**, SHA-256 `9c1de31e0c0f35184ab40fd425aef64eec277cfb221d866b115a55ad2e959bf6`.
- Treize contrôles du jeu Chrome : classes, T/RB, jetpack, pause, haptique simulée, tactile 320/390/844 et rotations.
- Les captures jour/nuit ont été relues. Les résultats Chrome utilisent SwiftShader ; ils ne mesurent pas la cadence d'une carte graphique.

Les preuves sont dans `preuves/lot-16-integration/`. Le raccord des reflets de la scène et le masque de bloom relèvent des lots reflets/composition. Les nuages volumétriques et leurs textures ne sont pas annoncés : la mission FSky retient des nuages procéduraux 2D. La preuve historique du module mesurait un surcoût du nouveau ciel plein écran, pas un gain ; aucune nouvelle affirmation GPU n'est faite ici.
