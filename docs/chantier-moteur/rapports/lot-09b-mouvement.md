# Palier mouvement et saut moderne

Le profil moderne reçoit la rampe d’accélération, la friction intégrée, le saut libre (6,2 m/s, gravité 20), le tampon de 120 ms, le délai de grâce de 100 ms et la conservation de l’élan à l’atterrissage. Les propulseurs et le profil historique gardent leur trajectoire. Le clip des murets est lié à leurs fragments restants et produit un événement boundaryContact limité à une fois par 300 ms. Le franchissement des solides bas vérifie la place disponible. La chute sur substrat utilise la hauteur de départ.

Validation du palier : 242 tests ciblés réussis (saut, progression, simulation, checkpoints et simulation campagne). Les deux traces historiques de 3 600 pas restent identiques à 930c199. Apex mesuré 0,961 m, durée de vol 620 ms, arrêt 0,6–0,8 m et parcours contrôlés à 20/60/120 Hz. Le pilote de test s’arrête désormais avant les consoles pour tenir compte de l’élan ; les objectifs et collisions restent vérifiés.

Ce palier ne clôt pas les lots 09/09b : le balayage complet des murets générés, la suppression des lamelles de destruction, le lissage caméra, le ressenti des armes et leur cadence restent à réaliser. Les profils léger/lourd et le jetpack restent un lot distinct. Aucun changement de format sauvegardé ni de physicsVersion ; les temporisations de saut sont remises à zéro à la restauration.
