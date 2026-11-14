# Sauvegardes antérieures aux pièges massifs

Les dix points viennent du code historique `1814b81558d7e3e6a80cbb8fcbbe3ccdee81cef4`, après le retrait du bouclier et avant le lot des pièges massifs. Ils ont été produits le 14 novembre 2026 sur le Spark, avec Node 24.18.0, puis validés par une reprise exacte dans cette même version avant leur ajout ici.

Les huit premiers cas jouent 180 pas du pilote `tools/proof/scenarios.mjs`, puis infligent 7 points de dégâts. Ils couvrent les secteurs classiques 0 et 2, et les index 0, 9 et 17 des campagnes V1 et V2, avec la graine 96. Les deux cas `*-rubble` tirent une vraie roquette sur un mur, simulent 300 pas et conservent chacun 40 débris structurels. Aucun identifiant, piège ou fingerprint n'est fabriqué ou remplacé.

Chaque `.json.gz` contient le scénario et l'enveloppe stockée par le navigateur. `manifest.json` donne le SHA-256 du JSON décompressé, celui du monde historique complet, et le commit source. Les fixtures sont immuables : les régénérer avec le générateur courant ferait disparaître la régression qu'elles vérifient.

`checks/pre-massive-checkpoint.test.mjs` vérifie le monde historique entier, tous les champs du checkpoint, une nouvelle sauvegarde, les refus atomiques des données invalides et le maintien des pièges actuels dans les nouvelles parties. `checks/checkpoint.test.mjs` exerce le code réel de Continuer, le stockage inchangé, un relais et son autosave, puis une deuxième reprise. Avant le correctif, 20 de ces 40 contrôles échouent ; après, les 40 passent.

Les scripts de fabrication et les journaux avant/après sont conservés sur le Spark dans `/home/m4d135/work/codex-blocages-20261114/`. Le mode historique sert uniquement à retrouver un checkpoint dont l'empreinte exacte est reconnue. Il ne constitue pas une migration universelle des formats plus anciens, notamment ceux antérieurs au retrait du bouclier.
