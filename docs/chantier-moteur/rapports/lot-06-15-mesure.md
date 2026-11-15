# Lots 06 / 15 — mesure par passe et rendu figé

`FGPUProfile` et `renderer.profile(true|false|options)` instrumentent à la demande les lampes, le soleil, la torche, le ciel, les opaques, les dynamiques, les particules, l'arme et la composition. Sans activation, aucune requête ni lecture d'horloge du profileur. Les résultats GPU sont lus au moins deux images après leur émission ; les résultats disjoints sont rejetés. La file reste bornée à 128 requêtes, l'historique à 240 images. Désactivation et destruction libèrent les requêtes ; la restauration du contexte recrée le profileur.

Le banc `tools/proof/lot15/native-bench.mjs DOSSIER` produit une page autonome `natif.html`, des captures et un reçu. Il utilise quatre scènes, deux tailles physiques (512 × 288, 1024 × 576), cinq répétitions appariées en ordre alterné, des empreintes de sources, les temps des modèles et de soumission, les intervalles rAF et les changements de résolution. Avec chronomètres GPU, aucune lecture synchrone des pixels dans les tours mesurés. Sans extension, le banc fournit un temps synchronisé par lecture des pixels et des ablations explicites, sans le présenter comme un temps GPU pur. Les ablations sont des diagnostics, jamais des réglages du jeu. Le modèle linéaire à deux tailles est descriptif, pas une promesse de cadence.

Le jeu fige sa dernière image en pause, boutique, résultats et arsenal tactile. Les entrées, menus et tâches continuent à être traités. Un changement de réglage, de dimensions, de visibilité/focus ou une restauration du contexte invalide cette image. La reprise du jeu et le titre restent animés.

## Variante évaluée, laissée éteinte

Les gardes spéculaires `ggxgate` sont disponibles uniquement par `exactSpecular:true` pour le banc. Elles sont **désactivées par défaut**, y compris dans METAL :

- Sur Apple M5 / ANGLE Metal, sept des huit vues sont identiques ; la vue campagne 6 en 1024 × 576 diffère d'un octet, d'un niveau. Le même écart est reproduit par un second contrôle d'image.
- Les chronomètres GPU donnent des médianes variables et aucun gain constant. Les médianes de la somme des passes, sur cinq répétitions, sont ci-dessous. Elles incluent les effets du contexte de mesure ; elles ne sont ni une mesure de FPS en jeu, ni une garantie matérielle.

| Scène | Taille | Référence, ms | Variante, ms |
|---|---|---:|---:|
| Secteur 1 | 512 × 288 | 9,354 | 11,765 |
| Campagne 6 | 512 × 288 | 9,558 | 9,866 |
| Campagne 12 | 512 × 288 | 10,246 | 9,495 |
| Campagne 18 | 512 × 288 | 16,530 | 17,502 |
| Secteur 1 | 1024 × 576 | 14,694 | 21,914 |
| Campagne 6 | 1024 × 576 | 23,678 | 17,282 |
| Campagne 12 | 1024 × 576 | 19,983 | 23,570 |
| Campagne 18 | 1024 × 576 | 16,123 | 23,901 |

Les 960 images des paires ont des résultats GPU disponibles. Les ablations restent bruitées (certaines omissions mesurent plus cher que la scène complète) : elles n'autorisent aucune conclusion de gain par suppression. Un premier banc forçait une synchronisation à chaque image malgré l'extension ; il a été remplacé par le banc asynchrone conservé dans les preuves finales.

## Validation et périmètre

- Cinq tests du profileur couvrent le retard de lecture, les disjoints, le repli CPU, les omissions, la libération et les files bornées.
- 37 tests renderer/profileur et 106 tests cadence/entrées/checkpoints passent ; build vérifié.
- Chrome vérifie l'activation puis l'arrêt du profileur dans l'artefact, l'absence de redraw après la première image en pause, puis un redraw unique après réglage et resize. Les contrôles classes, clavier, manette simulée et tactile restent dans ce même reçu.
- Les mesures matérielles portent sur le Mac M5. Aucune conclusion NVIDIA, téléphone physique ou T5 de simulation n'est tirée de ces mesures.

La composition unifiée, les reflets, les variantes conditionnelles de tri/stencil et les mesures finales du jeu assemblé restent distincts de cette tranche. Les preuves sont dans `preuves/lot-06-15-mesure/`.
