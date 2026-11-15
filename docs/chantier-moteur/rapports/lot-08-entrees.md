# Lot 08 — contrôle manette raccordé

Les contrôles METAL utilisent FInput pour le premier pad connecté, les courbes 0,07 / 1,3 demandées le 14 novembre, les gâchettes avec hystérésis, les fronts et le branchement à chaud. Les réglages de visée, assistance, permutation des sticks, affectations et vibrations sont persistants. Les conflits de boutons sont refusés. Les menus, onglets et curseurs sont navigables au pad ; les invites suivent le périphérique actif.

Les vibrations sont fusionnées, espacées de 40 ms, arrêtées à la pause, au masquage et à la perte de focus. Les rejets de promesses sont récupérés. Aucun effet avant une action pad. Le saut et le changement de profil sont des fronts destinés au premier sous-pas ; leur mécanique arrive dans le lot jeu. Le bonus tactile de visée est signalé séparément à la simulation.

Validation : 108 tests ciblés réussis. Chrome/SwiftShader, page autonome : accueil → options → partie, mouvement, visée, tir, vibrations, pause, onglets, curseur persistant, réaffectation et déconnexion avec pause. Aucune erreur JavaScript ; aucune demande de capture souris pour démarrer au pad. Preuve : `../preuves/lot-08-entrees/chrome-pad.json`.

Manette physique non vérifiée. L’activation audio par pad dépend du navigateur et affiche une indication si un clic reste nécessaire. Le mode démo et ses transitions restent à raccorder au lot 13. La refonte complète du tactile est suivie séparément dans le lot 08b. Aucun changement du format des parties sauvegardées, aucune publication.
