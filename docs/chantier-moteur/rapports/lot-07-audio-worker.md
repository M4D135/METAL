# Lot 07 — préparation audio hors du fil principal

15 novembre 2026. Après fusion du mixage et du répertoire adaptatif (cd49194).

FMusic reçoit une fonction de préparation facultative et adopte les partitions, les PCM et les modules historiques préparés. Les paquets sont copiés avant transfert : le worker garde ses caches utilisables. Les anciennes variantes par graine sont évincées. En cas de refus ou d'erreur, la préparation locale par phases reprend. FAudio reçoit un fournisseur PCM facultatif ; les variantes sont demandées une par une, puis copiées dans les AudioBuffer. Une erreur reprend les seuls tampons manquants avec le synthétiseur local. Une destruction de l'instance interdit toute adoption tardive.

METAL prépare le morceau varié du secteur avec la bonne graine et les huit pièces adaptatives avant l'entrée en jeu. Les téléversements d'instruments rendent la main entre deux tampons en mode worker. Les API autonomes conservent leur repli local et leurs options par défaut. Aucune ressource extérieure.

Validation : 65/65 tests audio et transfert/adoption passent, y compris la panne au milieu d'une banque et la libération pendant un transfert. Les tests vérifient toutes les pièces, les graines, l'intégralité des PCM et l'absence de synthèse dans le destinataire. Les 107 autres cas du premier appel ciblé (musique, jobs et checkpoint) passaient ; les 15 échecs audio de cet appel provenaient d'options omises et ont tous disparu après rétablissement de la valeur par défaut.

Chrome : 13 demandes musicales abouties en worker, aucun repli, tous les octets identiques, cache intact après un second transfert. Adoption maximale observée 0,30 ms. Zéro allocation d'AudioBuffer lors du démarrage de lecture des douze partitions déjà préparées. Les 45–95 ms d'envoi des instruments sont une durée écoulée incluant les pauses entre tampons, pas du temps CPU ni une garantie universelle. Le parcours complet jeu/mobile/manette simulée passe encore avec le worker actif. L'appareil physique et l'écoute restent non vérifiés.

Artefact construit : 1090487 octets, SHA-256 111adcf34daf036a0fd9b189122bbafe8aaa3676987f968fb18760b721573e13. Pas encore poussé ni déployé. Les budgets de simulation T5 de l'ensemble final restent à revalider.
