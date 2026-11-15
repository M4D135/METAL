# Lot 03s — destruction et navigation

Palier T1/T4 validé, **lot 03s non terminé : T5 reste à optimiser**. Base c28ebda3f12e612370d8b8b6e1de63f7c667e77c, branche codex/lot-03s-20261115. Rendu T2/T3 et FImuse hors périmètre. Version 0.9.2, formats de sauvegarde, RNG et ordre géométrique conservés.

## Contrat runtime

`destruction.delta(cursor)` retourne `{token, revision, full, added, removed, dirtyAABB, colliders:{added,removed,dirtyAABB}}`. `token` est un objet opaque, uniquement runtime ; `revision` reste le compteur historique sauvegardé. Un nombre, un curseur étranger/absent ou une révision sautée force `full:true`. Deux lecteurs du précédent token reçoivent le même delta sans consommation ; le token courant donne un delta vide. Toute restauration réussie change le token, même à révision égale ou reculée ; une restauration invalide reste atomique. Conteneurs figés, objets vivants référencés non figés.

Les groupes modifiés seuls sont compilés ; les fragments géométriquement identiques conservent leurs objets. L'ordre reste celui des sources puis des fragments. La liste de rendu est aplatie à la demande. Les boîtes inchangées gardent leur identité : seul leur offset `collider.mesh` peut évoluer après retrait d'un décor précédent ; cet offset n'est pas un changement géométrique pour la navigation.

La simulation consomme le delta commun. Une casse sans changement solide ne refait ni seaux ni nav. Les cellules sales ont une marge de 1 m, les arêtes une cellule voisine supplémentaire. Seuls les chemins qui traversent la boîte sont réinitialisés, y compris un segment dont les deux extrémités sont dehors. Une zone inconnue/full ou >25% impose le repli global. Collisions immédiatement actualisées ; pompe bornée à 768 cellules.

## Validation fonctionnelle

- `npm test` : 816/816, zéro échec ; world et build-check PASS. Les 4 nouveaux contrats nav, ajoutés pendant cette exécution, ont ensuite passé avec les 6 contrats destruction : 10/10. Le script npm final contient les deux fichiers.
- Build 0.9.2 : HTML 888930 octets, gzip 274305, aucun asset externe. SHA256 `8ec3b0cb55c6909675e8448a5ebbfe1b21bab3c38de975b712cdc25794ba4260`. Contrôle du nouvel artefact PASS.
- Contrats : curseurs multiples/étrangers/numériques/sautés, restore égale/reculée/invalide, identités et offsets, dégâts sans révision, chemins traversants/distant, décor sans invalidation, zone inconnue, checkpoint cohérent.
- `checks/simulation.test.mjs`, test « After several breaches and a door opening… » : deux explosions, porte, pompe terminée, cellules et toutes arêtes connues égales au recalcul complet ; restauration identique. Assertions conservées.
- Fixture >25% corrigée, sans assouplir les assertions : ancienne paroi .18 m = 182/806 cellules (22,58%), artificiellement comptée plusieurs fois par l'ancien diff ; paroi 1,8 m = 234/806 (29,03%), 768 mises à jour et 38 en attente, passage et checkpoint validés.
- Revue indépendante : 280 opérations hit/blast/restore sur huit séquences, mêmes meshes/colliders/lights/snapshots/payloads que la base.

## Mesures appariées

Reçus détaillés et SHA dans [lot-03s-preuves.json](lot-03s-preuves.json), journaux publics sous `.relais/codex03s-20261115/`. Spark sous charge concurrente (autre npm observé) ; ces mesures ne prouvent ni FPS ni latence navigateur.

Destruction directe, Node24.18, domaine principal, CPU du thread : 450 impacts mesurés, cinq passes AB/BA après une passe initiale, égalité exacte après chaque impact. **Total blast + matérialisation meshes : 3600,57 → 1799,72 µs en moyenne ; ratio médian apparié 0,5001667**. Côté candidat, blast 1164,50 µs et getter 635,22 µs. Le travail déplacé vers le getter est compté ; le gain du seul blast n'est pas le gain net. Les échantillons très courts restent soumis à la résolution de l'horloge : 4 des 450 dénominateurs CPU total sont nuls et exclus des ratios, pas des moyennes. La médiane conventionnelle porte sur 446 ratios finis ; calcul corrigé depuis les rows conservées, sans nouveau banc.

AB2 canonique, Node22.11, CPU processus, legacy-s2/arme 2/1800 pas, cinq paires alternées et un échauffement :
- T1 isolé : `identical=true`, stabilité A/B et six passes identiques. Ratio CPU total 1,0256, médiane appariée 1,0319 : le microgain ne devient pas un gain de toute la boucle dans ce scénario.
- T1/T4 : A/B stables, divergence déterministe au pas 92 sur les six passes ; qualité T4 autorise les chemins ennemis différents. Ratio CPU total 0,9383 mais médiane appariée 1,0102 : pas de gain uniforme annoncé. Le rejeu indépendant au pas 92 attribue exactement le premier écart à 8 planWait et 148 thinkWait préservés : aucune position, HP, chemin ni destruction différente à cet instant. Reçu : lot-03s-premier-ecart.json, SHA256 41a10703ee494c656787027e061b3b6ea758728eae4102283e8aefd1e7a48444.

Combats production, Node24.18, CPU thread, 60 s, GOD, seed 96, pilote skilled, cinq paires par espèce alternant l'ordre A/B. Chaque combat est un processus neuf ; les runs préliminaires exclus ne chauffent pas les processus suivants. Toutes les paires ont la même durée simulée de 60 s. `edgeWipes=0`, pompe1/2/1 pas par minute sur espèces 0/1/2, donc <40.

| Espèce | Première casse | Médiane base | Médiane candidat | Maximum candidat | <8 ms aux 5 mesures |
|---|---:|---:|---:|---:|---|
| 0 | pas 658, 10,967s |16,240ms|12,638ms|14,000ms|non|
| 1 | pas 658, 10,967s |17,940ms|10,838ms|13,857ms|non|
| 2 | pas654, 10,900s |7,001ms|3,040ms|4,999ms|oui|

## T5 restant

Le décalage de refreshNav a été essayé puis retiré : un checkpoint pris avant l'invalidation différée donnait une nav différente de sa restauration. Aucun nouveau champ save, ni flush supplémentaire de chemins dans snapshot, n'a été introduit pour masquer ce défaut. Le repro reste couvert.

Les phases instrumentées (temps muraux inclusifs, non additionnables) indiquent encore damageScenery 2,35–9,53ms, nouveaux débris 0,75–1,41ms ; pumpNav est négligeable au pas de première casse. Les diagnostics BOUNDED et NO_SLEEP restent hors source et hors acceptation. Le filtre solide et le sommeil statique existaient déjà dans la base ; les anciennes sondes SOLIDONLY/SLEEP ne constituent pas de nouvelles optimisations. Désactiver le sommeil sur espèce2 ne réduit pas un coût significatif de cette première casse. Profil CPU du pas 658 espèces 0/1 demandé pour poursuivre ; aucun préchauffage artificiel ajouté.

## Reproduction

`tools/proof/lot03s/revision-cost.mjs <base> <candidat> <sortie.json>` mesure blast, getter et total CPU. `tools/proof/lot03s/run.py --base <archive-c28> --candidate <clone> --out <dossier> --node <Node24>` reproduit la série threadCPU, les cinq paires/espèce et les diagnostics. Le pilote de combat vient du banc historique, mais charge les modules courants via `tools/realm-loader.mjs` (FMath/FPassages compris), sans VM de performance ni bouclier réintroduit.

AB2 : `node tools/ab2.mjs <base> <candidat> --scenario legacy-s2 --weapon 2 --steps 1800 --reps 5 --warmups 1 --no-counters --out <reçu>`. Pour T1 isolé, copie source archivée de la base avec le seul destruction.js candidat. Aucune worktree créée, aucun push/service.

## Compléments T5 rejetés

Les deux essais ont été retirés. Les sources destruction.js et simulation.js sont exactement celles du palier fa9cf768. Aucun complément moteur n’est retenu sans gain établi.

| Essai contre fa9 | Tests ciblés | Impacts exacts | Digests de combat identiques | CPU total microbanc A → B | Max première casse B (0 / 1 / 2) |
|---|---:|---:|---:|---:|---:|
| Groupes/supports préfiltrés, compte sans allocation |40/40|450|15/15|1607,53 → 1940,99 µs|14 / 9,956 / 6,987 ms|
| copyBox littéral, mêmes champs et ordre |145/145|450|15/15|2042,44 → 2039,93 µs|10,947 / 13,224 / 7,999 ms|

Le second essai est neutre en coût net (~−0,12%), sans gain uniforme ni seuil T5 atteint. Les patches rejetés, toutes les mesures et leurs versions sont conservés sous `t5-roofs/` et `t5-copybox/` ; les synthèses sont dans lot-03s-preuves.json. Les médianes y sont recalculées depuis les rows conservées, avec exclusion explicite des ratios non finis et la convention arithmétique usuelle.

Les profils CPU inspector sur fa9 au pas 658 montrent un coût réparti entre damage, damageScenery, updateDebris et collision ; le démarrage/arrêt inspector visible dans le profil est hors pas mesuré. Ils ne prouvent pas le seuil d’acceptation. Une sonde indépendante GC/JIT **sur le candidat roofs rejeté**, en processus neuf sans inspector ni préchauffage, relève au pas 658 plusieurs déoptimisations (type feedback et wrong map), sans GC ni OSR damage observé. Son CPU 7,85 ms est un diagnostic instrumenté isolé, pas une validation T5, et n’est pas extrapolé à fa9. Reçus de cette sonde : `/home/m4d135/work/codex-metal-pilotage-20261115/gc-jit-03s/`, trace SHA256 `9755499fec3c802c0795212d0e0e43ad500c293b08d6960393e25fce4df5e4bd`.

T5 reste ouvert pour une attribution plus précise avant d’autres modifications. Aucun préchauffage artificiel, décalage de physique ou relâchement de test n’a été ajouté. Le lot 03s complet n’est pas promu.
