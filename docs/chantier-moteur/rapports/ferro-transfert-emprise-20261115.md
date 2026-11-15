# Premier transfert FERRO — Emprise vers METAL, 15 novembre 2026

Source inspectée : Emprise/RADE `src/gamepad.js`, fonctions `stop()`/`suspend()`, snapshot du clone `ed9af58` avec modifications en cours, SHA256 du fichier `cc9d938452f3b8459c777c8098a386ba141798f3996cbdd6601915918b8df2c7`. La copie est figée dans le dossier de preuve Mac ; le projet source n'a pas été modifié.

Contrat adapté au module générique METAL `FInput` : `clear()` annule les vibrations qu'il a lancées, même si la manette a été déconnectée depuis. Chaque actionneur utilisé est suivi ; reset() est préféré, un effet de magnitude nulle sert de repli. Exceptions et rejets asynchrones sont récupérés ; aucun reset si aucune vibration n'a été lancée, pas de reset répété après clear(). L'API publique ne change pas.

Trois tests de régression échouent avant correction. Dans la copie isolée, FInput57/57 après correction ; le premier essai complet manquait options.js (2ENOENT), puis la fixture inchangée a été rétablie et la suite relancée. Sur le Spark, la tête d'intégration corrigée passe `checks/finput.test.mjs` + `checks/input.test.mjs` : **82/82**. La suite FInput est désormais dans npm test pour éviter que ce module soit oublié lors des prochaines validations complètes.

La précédente suite complète **753/753** porte sur138390a ; elle n'est pas présentée comme une nouvelle suite810 de cette tête. Le présent changement reçoit les82tests ciblés et un build. FInput n'est pas encore raccordé dans game.js : aucun effet joueur n'est revendiqué avant le lot08. Aucun actionneur physique testé. Le contenu de dist/index.html doit rester identique au build précédent, car le module n'est pas encore chargé par le jeu.

Preuves Spark : `/home/m4d135/work/codex-metal-pilotage-20261115/input-transfer-tests.log`. Preuves Mac : `work/ferro-comparison/evidence/coordinator/` du chat METAL (patch, avant/après, provenance).
