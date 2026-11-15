# Lot 07 — génération des mondes en arrière-plan

Le build émet un script identifié par module et rôle. Les modules partagés alimentent un worker classique depuis un Blob, sans réseau et sans ressource extérieure. FJobs est générique ; MetalTasks fournit les opérations du jeu. Le monde est transmis par tableaux découpés en blocs de 2 000 éléments maximum, puis placé dans le cache de deux mondes de la page.

La première scène, le démarrage, la reprise, le changement de monde et la préparation après victoire utilisent cette même voie. La simulation et le rendu restent dans la page. Les machines tactiles à moins de quatre cœurs logiques, les navigateurs sans Worker/Blob, une erreur de démarrage, un message invalide ou un worker silencieux reprennent le travail localement. Le watchdog est suspendu lorsque la page est masquée. `?jobs=main` permet de comparer la voie locale.

Validation : 81 tests reprises/transport passent, dont sept tests de protocole, repli, timeout, cycle de vie et découpage. Build autonome vérifié. Chrome file:// : les mondes de campagne 0 et 17 avec les deux profils ont exactement le même JSON haché que la génération locale, avec respectivement 14 063 et 17 490 maillages ; 66 blocs reçus, aucun repli. Les quatre modules musicaux et les quatre premiers sons d’armes donnent les mêmes octets/échantillons par cette voie. Ce dernier contrôle valide le transport, pas encore l’adoption par le lecteur audio.

Le parcours de jeu Chrome avec manette simulée et événements tactiles passe avec le worker actif, incluant le switch, le jetpack, le tir/visée, le joystick flottant, les trois tailles et les rotations. Aucun essai de manette physique ou d’appareil mobile réel n’est revendiqué.

Banc reproductible : `node tools/proof/lot07/worker-chrome.mjs <dossier-de-preuves>`. Ses temps et compteurs décrivent cette machine Chrome headless ; ils ne prouvent pas une cadence GPU matérielle. La seconde génération peut ne contenir aucun callback rAF dans cette configuration, alors que les minuteries de la page continuent : ne pas présenter ce banc comme une preuve de 60 FPS.

Restent au lot 07 : adoption audio/musique, préparation et échauffement par phases, caches/navigation et mesures finales. Les transports de simulation/rendu en worker sont des options désactivées, distinctes de cette livraison.
