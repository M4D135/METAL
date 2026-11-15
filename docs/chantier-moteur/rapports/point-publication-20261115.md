# Point de publication du 15 novembre 2026

David demande de publier la version en cours puis de mettre le chantier en pause. Cette livraison ne clôt pas le programme complet.

## Modifications depuis la dernière livraison

Les commits de la branche `codex/finition-complete-20261115` apportent les deux personnages à positions distinctes (léger avec jetpack, lourd avec destruction), les passages imposant leur alternance, une commande de switch visible et le repère du partenaire. Ils incluent les commandes manette et tactiles, l’ATH mobile réduit, la destruction incrémentale, la navigation, le pas fixe, la préparation des mondes et de l’audio, la musique adaptative, les dix-huit ciels, le rendu natif, la pause sans redessin continu et la composition des effets à l’écran.

Le dernier changement ajoute le recul propre à chaque arme, sa compensation au réticule, la cadence sans perte due à l’arrondi des pas et une chaleur indépendante par arme. L’ATH affiche la chaleur des deux mains ; une alerte sonore réutilise un tampon procédural existant. Les anciens checkpoints restent lisibles et conservent leur représentation lors d’une restauration immédiatement suivie d’un export. Les tableaux thermiques apparaissent dès que la simulation évolue ; leurs valeurs invalides sont rejetées sans modification partielle de l’état.

## Vérification de cette livraison

- Validation des mondes réussie, puis suite de 1 071 tests : 958 réussis et 113 échecs dus au même manque de `style.setProperty` dans trois faux DOM. Après correction des seuls bancs `audio`, `input` et `checkpoint`, leurs 168 tests passent (ils comprennent les 113 échecs initiaux). Aucun échec restant observé ; la suite entière n’a pas été relancée après cette correction des doubles de test.
- `checks/build.test.mjs` : PASS sur le même artefact. Les logs initiaux, y compris les échecs du faux DOM, sont conservés dans `/home/m4d135/work/codex-metal-finish-20261115/publish-*.tap`.
- Chrome : 15 contrôles réussis sur l’artefact final (clavier, manette simulée, deux profils, jetpack, sauvegarde, pause, mobile 390×844, 844×390 et 320×568).
- Chrome : recul visible des deux mains sans changer la visée simulée, réticule compensé et alertes thermiques indépendantes ; zéro erreur JavaScript.
- 36 contrôles ciblés de chaleur et de migration des checkpoints précédents réussis.
- Relecture visuelle de la capture mobile 320×568 : commandes dans les coins, switch et partenaire lisibles.
- Ni manette physique ni téléphone physique testés. SwiftShader vérifie le fonctionnement et ne constitue pas une mesure de performances matérielles. Les vérifications précédentes du rendu sur le Mac M5 sont documentées dans les rapports des lots 06, 15 et 16.

## Travail encore ouvert lors de la pause

Réactions supplémentaires des ennemis, équilibrage et télégraphes des colosses, intégration complète de la physique, reflets de scène, démo/rejeu, consolidation finale des sauvegardes, finitions restantes et mesure T5 du jeu assemblé restent ouverts. La preuve historique T5 sous 8 ms ne valide pas automatiquement cette nouvelle version complète.

## Artefact

`dist/index.html` : 1158935 octets bruts ; zéro ressource extérieure. Navigateur exclu de la taille.

SHA-256 : `c7d3dc0f362ea4cdef68e2daaa1469b2f3f5361f832dee2253746ded1d85bed4`.

Le dépôt GitHub et le site METAL existants sont les destinations. L’accès du site reste réservé à son propriétaire. Le reçu de publication est conservé séparément après retour du service.
