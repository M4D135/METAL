# Intégration musicale — 15 novembre 2026

Fusion des voies `mixage` et `jeu-musique-metal` dans la finition, après le mobile, la cadence fixe et le worker de préparation. Le mixage est le commit 1d874a2.

La fusion conserve les arrangements par graine (48 positions), les règles de mixage propres à METAL, le contexte hors ligne, les contrôles mobiles et le pas fixe. Le chef musical avance avec chaque pas de simulation, à 60 Hz. Une pause conserve la transition musicale en attente ; elle ne remplace plus brutalement la pièce à la reprise. Les trois protections déjà validées de FImuse restent en place (table non vide, durées entières, copie des descripteurs). Les ajouts de force/realign du transport sont repris.

Relecture : correction des appels de caisse claire qui passaient une vélocité à la place du nom d'instrument ; durée des pièces adaptatives corrigée pour compter quatre temps par mesure. Le transport parcourt aussi les cycles variés, après les huit premières positions.

Validation : 126 cas musique, séquenceur, chef musical et checkpoint passent dans music-merged.tap. Le fichier audio de ce premier appel avait une fermeture de test perdue lors de la fusion ; elle a été rétablie. music-audio.tap passe ensuite 60/61 cas ; le dernier attendait une transition non urgente avant la fin de ses quatre mesures et de sa jointure. La vérification respecte désormais cette durée et exige explicitement que la reprise ne saute pas la transition. music-adjusted.tap passe ce cas et le nouveau contrôle du transport varié (2/2). Aucun échec restant parmi ces cas. Les journaux initiaux sont conservés pour traçabilité.

Limites : ce contrôle ne remplace pas une écoute physique. La préparation des nouvelles pièces et des tampons doit encore être déportée/adoptée dans le worker avant de valider les budgets de chargement du lot 07. Pas encore poussé ni déployé.
