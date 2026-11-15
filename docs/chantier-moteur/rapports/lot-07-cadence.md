# Lot 07 — cadence fixe et interpolation

Base du raccord : aa1a55f. La page utilise désormais FLoop à 60 pas/s, avec un maximum de cinq pas de rattrapage. Les angles restent immédiats dans les images sans pas ; les impulsions et la visée en attente ne sont consommées qu’une fois. Les positions affichées du joueur, des ennemis et des projectiles sont interpolées dans des miroirs réutilisés ; aucun état de simulation n’est modifié pour le rendu. Les téléportations et changements de personnage annulent l’interpolation.

L’arme choisie n’est plus renvoyée à chaque pas : les gestes explicites et le ramassage restent propriétaires de l’équipement. Les appels `step(dt)` et les anciens points de reprise sont conservés.

Validation : 99 tests boucle/reprises passés, puis 62 tests du noyau (FLoop, ordonnanceur, interpolation, collision, premier plan et visibilité). Trois tests supplémentaires exécutent la vraie page : instantané identique après 120 pas à 60/75/120/144 Hz ; visée immédiate et impulsion unique sur une image sans pas ; cinq pas maximum et aucun rattrapage du temps de pause. Les 14 tests ciblés reprises/cadence passent après la vérification du raccord de l’ordonnanceur. Chrome : même parcours manette/tactile que le lot 08b, trois tailles et rotation, passé avec la nouvelle boucle.

Les anciennes assertions de sous-division `ceil(dt*60)` sont remplacées par les tests de FLoop et de la page. Les tests de refroidissement et d’ascenseur avancent désormais à 60 Hz : une image artificielle de 100 ms dépasse le plafond explicite de cinq pas.

L’ordonnanceur est construit et pompé après le dessin pour les futurs travaux de préparation. Une tentative d’y inscrire directement l’écriture des points a été retirée : elle avançait l’écriture avant la fenêtre idle vérifiée par les tests LOAD-03. La politique existante (instantané à l’événement, écriture idle, vidage à pagehide) reste donc en vigueur.

Ce rapport clôt le raccord T1 et l’écho d’arme de T2 ; il ne clôt pas les workers, le chargement, l’échauffement ou les budgets audio du lot 07. Essai de manette physique et appareils mobiles non effectué.
