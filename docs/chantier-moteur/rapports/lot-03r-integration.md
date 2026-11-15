# Lot 03r — index spatial et rendu après destruction

Le rendu consomme maintenant le delta de destruction partagé et conserve les cellules, sélections et instances inchangées. Le passage léger/lourd et l'ATH mobile du palier précédent restent intégrés. Ce lot ne clôt pas le programme complet du moteur.

## Comportement

L'index utilise une grille dense par niveau de détail, des listes d'indices par cellule de 8 m et des coordonnées/rayons en `Float64Array`. L'ordre reste niveau de détail, cellule X, cellule Z, puis ordre d'insertion des maillages. Les positions négatives, rayons importants, maillages déplacés et identités répétées sont couverts. Une marge de quatre cellules absorbe les fragments ordinaires ; sortir de cette marge déclenche une reconstruction immédiate. Les étendues pathologiques utilisent un repli sparse borné en mémoire.

Les objets inchangés conservent leurs métadonnées et lignes d'instances. Le delta identifie directement les retraits ; les autres appelants gardent un diff par génération. Seules les cellules touchées sont retriées et leurs statistiques recalculées. La partie suit le jeton opaque du delta, y compris une restauration conservant le même numéro de révision.

Les sélections de vue, torche, soleil et lampes sont invalidées lorsque leurs zones de sélection touchent les cellules modifiées. Les références retirées sont supprimées avant le dessin suivant. Les lots GPU inchangés restent réutilisables même si la suppression d'un maillage antérieur renumérote leurs entrées. Aucun étalement sur deux images n'est introduit.

En Canvas, l'invalidation des faces éclairées suit les lampes dont elles dépendent. Le moteur choisit quatre lampes et leur contribution n'a pas de coupure à 32 m : une invalidation basée seulement sur ce rayon aurait changé l'image. Les suppressions, ajouts et changements d'ordre des lampes réévaluent donc les dépendances exactes. La classification du sol et les géométries d'ombre déplacées sont également actualisées.

## Preuves et portée

Les tests comparent l'index incrémental à la reconstruction complète et à l'ancien algorithme Map/chaînes, y compris l'ordre, le culling par cellule, des déplacements, des permutations et les deltas partagés. Ils vérifient aussi la conservation des caches lors d'une casse lointaine, l'absence immédiate des murs retirés dans les ombres, la restauration à révision identique et l'équivalence de l'éclairage Canvas.

Le banc de coût fonctionne dans le domaine principal de Node sur les mondes `camp:17` et `camp:6`, graine 96. Il alterne l'ordre des mesures et publie un contrôle A/A. Chaque mise à jour remplace un maillage et fournit le delta correspondant ; ce scénario synthétique isole l'entretien de l'index. Ce n'est ni un débit FPS, ni une mesure GPU, ni une nouvelle validation T5 des colosses. Les valeurs de la fiche initiale étaient des estimations sur une autre machine et ne sont pas présentées comme atteintes.

Les comparaisons Chrome/SwiftShader couvrent les scènes statiques, les formats mobiles, les niveaux de qualité, puis quatre scènes après une casse réelle dans les nouvelles expéditions à profils : deux mondes, WebGL et Canvas. Le nombre de pixels modifiés par la casse est vérifié pour éviter une comparaison de scènes restées intactes.

La preuve T5 historique reste attachée à `930c199`. La résolution native, le GPU, la cadence et les autres lots restent suivis séparément. Aucun déploiement sur l'hébergement n'est effectué par ce palier.

## Résultats retenus

La version assemblée passe **917/917 tests**, le contrôle des mondes et celui de l’artefact autonome. Les **14 paires statiques et 4 paires après destruction** sont identiques au pixel près. Le clic souris, Entrée/Espace, T et RB du bouton de classe sont à nouveau vérifiés dans Chrome sur cet artefact ; la manette reste simulée.

| Monde | Maillages | Mise à jour avant, p50 | Après, p50 | Gain corrigé A/A | Gain requête corrigé A/A |
|---|---:|---:|---:|---:|---:|
| camp:17 | 17471 | 3.307 ms | 2.027 ms | 38.8 % | 58.3 % |
| camp:6 | 14131 | 2.829 ms | 1.295 ms | 54.0 % | 57.7 % |

Mesures Node en temps écoulé, avec 1 500 requêtes et 3 000 mises à jour par variante et par monde, après échauffement ; ordre alterné et contrôle A/A publiés. Le premier prototype sans consommation directe des retraits du delta était peu rentable : sa mesure est conservée séparément, et ne sert pas au résultat retenu. Les performances de la scène complète et les autres matériels ne se déduisent pas de ces chiffres.

Artefact : **1005030 octets bruts**, zéro asset extérieur ; SHA256 `29f7792735b45d82e05a3f8fd605731a2f877575061eec03cbe5587ace65467b`. Source assemblée vérifiée : `5e23bfc6ecfd1b3727b82c4d4a300ad57ab6c670`.

Reproduction : `node tools/proof/lot03r/index-bench.mjs <base> <candidat> <rapport.json>` ; `node tools/render/lot05-pixels.mjs --base <base> --head <candidat> --out <rapport.json>` ; `node tools/proof/lot03r/destruction-pixels.mjs <base> <candidat> <rapport.json>` avec la page `tools/render/pages/lot03r-scene.html` présente dans les deux racines.
