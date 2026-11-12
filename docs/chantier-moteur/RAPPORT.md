# METAL — rapport du chantier moteur

Référence de départ : METAL **0.8.1**, `main` au commit
`63668aca7045e62cd524973b226f21e9ec5703e8`. La version du jeu reste inchangée.

## Lot 00 — outils de preuve, T1 seulement — 12 novembre 2026

**T1 terminé — SIM-11, IA-06.** La première séance du master limite ce lot au
chargeur principal, aux mesures appariées et aux empreintes d'état. Les tâches
**T2 et suivantes sont différées après le lot 05**, comme demandé ; elles ne
sont ni réalisées ni abandonnées. Le lot 00 complet n'est donc pas déclaré fini.

### Problème et changement livré

Les anciens outils `campaign-profiles`, `campaign-balance` et `boss-profiles`
chargeaient les sources dans un contexte VM. Ce domaine introduit un surcoût
qui fausse les mesures des helpers de simulation. Les bancs de l'audit avaient
en outre des chemins locaux fixes et certains chargeurs remplaçaient le
`window` global du processus.

`tools/realm-loader.mjs` charge désormais chaque variante avec
`vm.runInThisContext`, dans une enveloppe lexicale distincte munie de son propre
`window`. Les globales hôtes sont préservées, y compris lors d'un échec de
chargement. La racine, les modules, les globales de harnais et les patches en
mémoire sont paramétrables. Le mode VM reste un diagnostic explicite ; les
tests fonctionnels gardent leur chargeur d'origine.

`tools/profile-steps.mjs` mesure le CPU `user + system` de chaque `sim.step`
avec `process.cpuUsage`. Une chauffe complète est conservée dans les données
brutes mais exclue des agrégats. `tools/ab2.mjs` compare deux variantes en
alternant AB/BA à chaque pas et à chaque répétition. Les hashes sont calculés
après les deux segments chronométrés. Les profils utilisent un rejeu séparé
non chronométré pour les compteurs : ils sont ajoutés en mémoire dans
`s.aiStats`, sans aucune modification des sources livrées.

Les empreintes encodent les Float64 en petit-boutiste, distinguent `-0`, zéro
et champ absent, et suivent les champs explicites du joueur, des ennemis, des
débris, des projectiles et des événements. Le snapshot final est comparé par
SHA-256, FNV-1a et longueur. Les 7 200 hashes des quatre scénarios de référence
sont conservés dans `tools/proof/reference-63668ac.json`.

| Élément | Avant T1 | Après T1 |
|---|---|---|
| Outils de rapports chargés en VM | 3 | 0, domaine principal ; VM uniquement pour le diagnostic |
| Chargeur partagé isolant les variantes | Absent | Enveloppe et `window` par variante, globales hôtes vérifiées |
| Profils portables CPU par pas et A/B alterné | Bancs d'audit externes | Scripts dans `tools/`, racine et patches paramétrables |
| Références d'état durables dans le dépôt | Absentes | 4 scénarios × 1 800 pas, snapshot final et compteurs |
| Suite fonctionnelle ici | 422 réussis / 0 échec | 422 réussis / 0 échec |
| HTML autonome brut | 803 375 octets | 803 375 octets, identique octet à octet |
| Version | 0.8.1 | 0.8.1 |

Les trois rapports migrés sont identiques octet à octet à leurs versions
originales extraites de `63668ac` : 36 819 octets pour `campaign-profiles`,
49 966 pour `campaign-balance`, 25 558 pour `boss-profiles`. Leurs SHA-256
figurent dans [le résumé structuré](preuves/lot-00/summary.json).
`boss-ttk.cjs` utilisait déjà une enveloppe dans le domaine principal : seuls
`--root` et `--out-dir` ont été ajoutés ; aucune nouvelle mesure TTK n'est
revendiquée.

### Reproduction préalable et diagnostic principal / VM

Les bancs historiques ont été exécutés avant le changement, avec uniquement
leur racine adaptée. Les six modules de simulation employés dans la référence
de l'audit ont les mêmes SHA-256 que ceux de `63668ac`.

Le premier `bancs/sim/realm-check.mjs` compare en réalité **deux contextes VM**,
avec ou sans `Math` partagé : 1 229,7 et 1 507,7 ns par appel `ground` ici.
Le contre-banc `sim-verif2/realm.mjs` donne, dans sa propre sortie, des ratios
VM/main de ×17,0 et ×21,2 pour `ground`, ×3,9 et ×8,2 pour les pas. Il divise
par 1 200 même en cas d'arrêt anticipé. Le banc IA `realm2` annonce une
alternance mais exécute main puis VM à chaque répétition. Ces limites des
bancs historiques sont documentées ; les nouveaux outils comptent les pas
réellement exécutés et alternent effectivement l'ordre.

Le nouveau diagnostic conserve les deux passages mesurés, après une chauffe,
sur cet hôte **Linux x64, AMD EPYC 9V45, Node 24.22.1 / V8 13.6** :

| Scénario et passage mesuré | `ground` VM → principal, ns/appel | CPU moyen d'un pas VM → principal, µs |
|---|---:|---:|
| `legacy-s0`, passage 1 | 1 365,036 → 107,834 | 2 207,254 → 496,409 |
| `legacy-s0`, passage 2 | 2 502,289 → 368,378 | 2 061,033 → 394,158 |
| `campaign-w10`, passage 1 | 1 292,145 → 104,675 | 2 215,903 → 396,947 |
| `campaign-w10`, passage 2 | 1 143,829 → 92,133 | 2 166,353 → 368,449 |

Chaque passage comprend 65 536 appels `ground` et 1 200 pas par variante.
Les états et snapshots sont identiques. Les p50 discrètes des ratios VM/main
rapportées par l'outil sont ×12,66 / ×12,42 pour `ground` et ×5,23 / ×5,88
pour le CPU des pas. La fonction de quantile prend l'indice `floor(n × p)`
dans le tableau trié : avec deux valeurs, la p50 retient la valeur haute.
Les lignes brutes ci-dessus évitent de masquer cette convention ou leur
variation.

Ces nombres mesurent le coût du domaine d'exécution du banc, **pas une
accélération du jeu livré**. Les ratios du Mac de l'audit ne sont pas des
seuils d'acceptation sur cet EPYC.

### Empreintes et compteurs déterministes

Deux exécutions indépendantes de `profile-steps`, chacune avec une chauffe,
deux passages mesurés et un rejeu instrumenté, donnent le même checksum :

```text
09a3eca48720a54628e92b5133100ae66df5e156026047c228ac818057d98acf
```

Les empreintes de chaque pas, les snapshots et les compteurs de chaque pas
sont identiques entre ces deux exécutions. Les quatre scénarios exécutent
effectivement les 1 800 pas demandés.

| Scénario | Chaîne FNV32 | ground | blocked | segmentFree | astarPops | astarNodes | révisions |
|---|---|---:|---:|---:|---:|---:|---:|
| `legacy-s0` | `4c43a6fb` | 1 010 229 | 318 467 | 15 210 | 81 453 | 81 121 | 8 |
| `legacy-s2` | `c8706f53` | 2 296 649 | 603 871 | 13 452 | 19 200 | 19 016 | 15 |
| `campaign-w10` | `59e36477` | 1 348 172 | 523 957 | 20 603 | 58 810 | 58 507 | 13 |
| `campaign-w16` | `b4e5f58e` | 1 441 338 | 587 901 | 30 016 | 61 759 | 60 783 | 13 |

`astarPops` compte les retraits du tas, doublons compris ; `astarNodes` compte
les retraits non déjà fermés, but compris. Construction initiale et snapshot
final sont exclus des comptes par pas. Le code instrumenté conserve les
empreintes et le snapshot du code normal.

### Contrôle A/A et limites des temps CPU

Le contrôle A/A complet conserve tous les états et snapshots. Ses ratios CPU
montrent toutefois une **asymétrie médiane de 5,1 à 10,2 %** :

| Scénario | Ratio médian apparié B/A | Ratio des totaux B/A | Paires mesurées |
|---|---:|---:|---:|
| `legacy-s0` | 1,052 | 1,075 | 3 600 |
| `legacy-s2` | 1,051 | 1,044 | 3 600 |
| `campaign-w10` | 1,053 | 1,097 | 3 600 |
| `campaign-w16` | 1,102 | 1,123 | 3 600 |

Ces écarts ne sont pas des gains. Une optimisation proche de cet ordre de
grandeur demandera des contrôles A/A supplémentaires et des inversions de
variantes avant toute conclusion temporelle. Les durées comprennent le CPU
GC/JIT imputé au processus ; le coût du chronomètre n'est pas soustrait.

La sélection `all` conserve les quatre scénarios historiques, dont les deux
campagnes V1. Les sélections explicites `campaign2-w1` à `campaign2-w18`
préparent les mesures V2 du lot 02. Seul un A/A court de 120 pas des mondes
V2 1 et 10 a été ajouté ici : identité par pas, snapshot et instrumentation
vérifiée, chaînes `2d73cf2a` et `65883f09`. Les campagnes V2 complètes restent
à mesurer au lot 02.

### Tests, build et version

L'intégrateur a exécuté `npm test` sur le **main propre 63668ac**, puis après
T1 : **422 réussis, 0 échec, 0 annulé, 0 ignoré** dans les deux cas. Les
journaux complets sont archivés séparément. Les huit échecs `campaign-world`
mentionnés dans le master à propos du Mac d'audit ne sont pas reproduits dans
cet environnement ; aucun test n'a été affaibli pour obtenir ce résultat.

Le build effectué par l'intégrateur et le contrôle de distribution de la
suite donnent **803 375 octets bruts**, zéro ressource externe. Le HTML est
identique octet à octet à celui de `63668ac` et son SHA-256 reste :

```text
d9503acf09a33a9b2d0f90d598c0ac881250131ce0b3f70b74e1afc8c5df1b3b
```

`SIZE.json` reste l'autorité ; le navigateur, les pilotes, les tests et la
documentation sont exclus de cette taille. `package.json`, `SIZE.json`,
`dist/index.html`, `src/` et `checks/` sont inchangés. La version reste 0.8.1.

Les contrôles ciblés de l'outillage valident également l'isolation, les
intrinsics du domaine principal, les globales après succès et échec, les
ancrages absents refusés, `-0`, les champs absents et une divergence de
`1e-10` détectée dès le premier pas. `git diff --check` est vert.

### Preuves livrées et vérifications restantes

[Le dossier de preuves](preuves/lot-00/README.md) conserve **16 archives gzip
déterministes, 2 105 101 octets compressés**, représentant 34 150 943 octets
originaux. Aucun pas ni passage de chauffe n'a été retiré des rapports
archivés. Le manifeste donne tailles et SHA-256 avant/après compression ; le
résumé lisible et le JSON de synthèse renvoient aux mesures complètes.

Aucune mesure de navigateur, GPU, cadence d'image ou appareil réel n'a été
ajoutée dans T1. Téléphone, PC Windows/NVIDIA, Safari et Firefox restent à
vérifier dans les lots concernés. FNV32 est collisionnable et le schéma de
champs par pas est explicite : les hashes et le snapshot complètent les tests
fonctionnels, sans les remplacer. Les tâches différées du lot 00 — harnais de
boucle, census, trace, overlay et comparaison de pixels notamment — restent
nécessaires après le lot 05 selon le master.
