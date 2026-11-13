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

## Lot 01 — bugs bloquants — 12 novembre 2026

**T1 terminé — LOAD-01, LOOP-01 et LOOP-V2 absorbés selon les arbitrages.**
Cette section ne déclare pas le lot 01 entier terminé. Les autres tâches du
lot restent séparées de ce commit.

La référence documentaire est le [master de la PR #2 au commit
`6a17e08281b70feae33015d7059ef21717666ba3`](https://github.com/M4D135/METAL/blob/6a17e08281b70feae33015d7059ef21717666ba3/docs/chantier-moteur/MASTER-PROMPT.md).
Il demande d'abord le contrôle des huit échecs historiques MURS-V1, puis T1.
Les constats et contre-vérifications priment sur les chiffres attendus des
fiches ; aucun chiffre du Mac d'audit n'est présenté comme reproduit ici.

### Préflight MURS-V1 : les huit échecs ne sont pas reproduits

| Référence | Contrôle | Résultat ici |
|---|---|---|
| Parent `79e6e35703ec84193491f36ea44f87fa910b3847` | Huit tests historiques ciblés | **8/8, zéro échec** |
| Version 0.8.0 `673d6b2b80026103b4523fb0b3b16fb708556b06` | Huit tests historiques ciblés | **8/8, zéro échec** |
| Main intact `63668aca7045e62cd524973b226f21e9ec5703e8` | Suite complète | **422/422, zéro échec** |

Les tests ciblés portent sur les six empreintes classiques, le mode campagne
strictement explicite et la géométrie historique des trois premiers mondes
de campagne. Ils ont été exécutés avec **Node 24.22.1 sur Linux x86-64**.
Les [deux journaux et le manifeste](preuves/lot-01/preflight/README.md)
conservent la commande, les commits et les empreintes des fichiers ; la
baseline main déjà archivée avec le lot 00 n'est pas dupliquée.

`src/world.js` et `checks/campaign-world.test.mjs` de main sont identiques
octet pour octet aux fichiers du commit audité `673d6b2`. Les six valeurs de
`legacyHashes` sont inchangées entre `79e6e35`, `673d6b2` et main. Le code
0.8.0 conditionne le retrait des panneaux et l'appel à `openEntries` par
`w.campaignVersion===2` : le monde historique est explicitement conservé.

**L'attribution des huit échecs au retrait des murs n'est pas confirmée ici.**
Le résultat rapporté sur macOS arm64 / Node 24.18 n'est ni reproduit ni
expliqué. Aucune empreinte n'a été régénérée, aucun test affaibli et aucun
correctif de `world.js` n'est nécessaire sur les preuves acquises. Ce point
reste une différence d'environnement à comprendre, pas un correctif déclaré
réussi sans reproduction.

### Problème T1 et changement livré

Le validateur refusait des gravats au repos que la physique réelle avait
produits : le test d'intersection avec les solides ou pièges mobiles était
plus strict que le comportement du jeu. Un tel refus pouvait réinitialiser
le secteur et perdre l'équipement porté à son entrée.

Le seul prédicat d'intersection des gravats au repos est retiré. Les
contrôles d'appui, de bornes, d'identité, de vitesse et la validation atomique
restent en place. La physique, la position des morceaux et leur état
`resting` ne changent pas ; les variantes physiques de LOOP-01/LOOP-V2 sont
écartées conformément à l'arbitrage.

Si une reprise échoue encore, le shell tente une **copie** sans
`rubbleVersion`, `state.rubble` et `timers.rubbleSerial`. Une réussite
conserve position, santé, progression, équipement et destruction ; seuls les
débris visuels sont retirés. Le repli ultime transmet
`copyLoadout(v.entryLoadout||v.entryInventory)` et écrit le nouveau point
seulement après la relance réussie. Aucun format de sauvegarde ne change.

Le dernier point refusé est conservé dans le slot remplaçable
`ferro-expedition-v2-refuse` avant d'écraser le point actif ; le premier
backup de migration reste intact. Si cette écriture échoue, la source reste
en attente : les checkpoints suivants et l'effacement de fin de partie
doivent d'abord la préserver. Les tests couvrent une panne de stockage
temporaire, sa récupération et un échec injecté pendant la relance.

### Mesures avant et après T1

| Contrôle | Avant | Après |
|---|---:|---:|
| Reprises LOAD acceptées | **7/31** | **31/31** |
| Refus LOOP, quatre mondes, motif b | **17/44** | **0/44** |
| Nouveaux cas contractuels générés, restauration exacte | Refus reproduit sur les deux mondes | **6/6** |
| Suite complète `npm test` | **422/422** | **432/432** |
| HTML autonome brut | 803 375 octets | **804 329 octets** |

Les bancs LOAD et LOOP chargent les sources dans le domaine principal de
Node. La contre-vérification après patch utilise les sources candidates
réelles, sans leur injecter le correctif en mémoire. Le tableau détaillé
est dans [la fiche de preuve T1](preuves/lot-01/t1/README.md).

Avec `recover:false`, **31/31 snapshots sont identiques en valeurs et
structure JSON ; 30/31 le sont octet pour octet**. Dans le premier point
`rocket l:0`, un butin `salvage` change uniquement l'ordre de ses propriétés
`ammo` et `armor`. Le diagnostic récursif ne trouve aucune différence de
valeur ou de structure. Ce chemin de sérialisation est inchangé ; le chiffre
historique 29/31 avec `recover:true` ne décrit pas cette mesure actuelle.

Les six régressions contractuelles utilisent les vrais mondes l:0 et c:9
de campagne V2, graine 96 : trois murs par monde, une roquette puis 300 pas
à 1/60 s. Leur snapshot est exactement identique après restauration.
LOOP vérifie les mondes classic-0, campaign-0, campaign-9 et campaign-10 :
zéro refus dans un monde régénéré comme dans le même objet monde. Le banc
atteint 33 secondes simulées avec l'argument 30, soit onze essais par monde.

### Validation, intégration et limites

`python3 tools/build.py` et `npm test` ont terminé avec le code 0 sur le
worktree T1 : **432 réussis, zéro échec, zéro annulé, zéro ignoré**. Les dix
tests ajoutés expliquent le passage de 422 à 432. Les contrôles séparés de
génération (18 cas) et du build passent également, sans être additionnés
artificiellement au total TAP.

Après le fast-forward local du commit d'outillage lot 00 / T1
`8098725e5b85cf44996d5379fb215643b2615e46`, les **44 fichiers** de sources,
tests, configuration et build comparés sont identiques au worktree T1
validé. La suite complète n'est pas relancée pour cette copie identique.
Le build d'intégration déjà reconstruit possède le même SHA-256 :

```text
f52b93562b0566dbe167410e5099af18860190ffc14dd8a7575bed722e62ebfd
```

`SIZE.json` donne **804 329 octets bruts**, **242 483 octets gzip**, zéro
ressource externe, version **0.8.1 inchangée**. Le navigateur, les pilotes,
les tests et la documentation ne sont pas comptés dans cette taille brute.
Les sources audio, musique, HTML et CSS sont identiques à la base ; le cycle
de vie de la musique d'accueil n'est pas modifié dans `game.js`.

Les preuves T1 comprennent **16 journaux gzip déterministes**, un manifeste,
les commandes et les empreintes. Aucun double de patch ou journal brut n'est
commité lorsque le journal gzip est présent. Le préflight ajoute deux petits
journaux historiques. Aucun essai navigateur, écoute réelle, appareil
physique ou gain de performance n'est revendiqué par T1 ; téléphone,
Windows/NVIDIA, Safari et Firefox restent à vérifier dans les lots concernés.

### STAB-V1 — sous-pas stables dans l’attente du lot 07

Le calcul des sous-pas tolère maintenant les imprécisions de l’horloge : `ceil(dt*60-.06)` au lieu de `ceil(dt*60)`. Sur 900 images à 60 Hz avec horloge arrondie à 0,1 ou 1 ms, le nombre de pas passe de **1 500 à 900** ; à 59,94 Hz, de **1 800 à 900**. Il ne reste aucune image à deux pas dans ces trois motifs. Le temps total reste simulé et chaque pas reste inférieur à **17,7 ms** ; une vraie simulation vérifie sprint et esquive contre un mur mince. Ce changement volontaire du découpage temporel ne prétend pas conserver les trajectoires bit à bit.

[Les mesures appariées et leurs limites](preuves/lot-01/stab-v1/README.md) sont jointes. Cinq paires, chauffe exclue, domaine principal, alternance AB/BA : ratios CPU médians après/avant **0,800 / 0,957 / 0,841** pour q60, ms60 et 59,94 Hz. Les contrôles 120/144 Hz, dont le nombre de pas reste identique, montrent également du bruit. La promesse de gain CPU de 18 à 48 % n’est **pas reproduite uniformément** ; le correctif est conservé pour la subdivision erronée effectivement corrigée, sans revendiquer ce gain universel.

Les cinq nouveaux tests de cadence sont inclus dans `npm test`. Validation d’intégration ciblée : **55/55** tests cadence + checkpoints, puis contrôle de build PASS. Distribution **804 329 → 804 421 octets**, version 0.8.1 ; SHA-256 `3aa68a79c28e19ed982605a557c8e35585bf3478ad54de05ea3cbadc3ddc4f50`. La suite complète du lot sera exécutée après assemblage T2–T4 ; elle n’est pas présentée comme relancée ici. La boucle fixe et l’interpolation restent au lot 07.

### T2 — intention de tir conservée [LOOP-06]

Le shell conserve séparément un appui droit et gauche pendant **150 ms**, jusqu’au tir de la main concernée. Il propose l’intention au premier sous-pas et conserve l’état tenu sur les suivants. Clavier reconfiguré, souris et tactile utilisent le même contrat. Le changement d’arme, la pause, la perte de focus ou l’annulation de capture effacent l’intention ; le bouclier reste une garde tenue. Le clic utilisé pour capturer la souris ne tire pas. Aucune horloge n’entre dans la simulation.

Les treize nouveaux tests du vrai shell avec vraie simulation donnaient **5 réussites / 8 échecs avant**, puis **13/13** après. Les douze combinaisons de clic entièrement entre deux images (souris/clavier/tactile × 20/30/60/144 Hz) produisent chacune exactement un tir. Le modèle d’audit reproduit **20,3 à 26,7 %** de clics prêts perdus avant, zéro pour les modèles verrouillé/tamponné ; ce modèle ne remplace pas les tests du code livré. [Preuves et limites](preuves/lot-01/t2/PROOF.md).

Le harnais de checkpoints représente maintenant un vrai verrou de pointeur acquis et libéré. La résolution d’intégration conserve aussi les injections d’échec de stockage et de relance introduites par T1. Aucun attendu de checkpoint n’a été affaibli.

Validation cumulative T1 + STAB-V1 + T2 : **73/73** tests entrées, checkpoints, options et cadence ; build et contrôle de distribution PASS. `checks/input.test.mjs` est ajouté à `npm test`. HTML **804 421 → 806 474 octets**, SHA-256 `2aa738e123901c4616dac5ec569d07016071d7cfeeed64f94410eaf4d862f8be`, version 0.8.1.

Valeur par défaut appliquée : tampon 150 ms, exposé par `FOptions.fireBufferMs`. Question de ressenti conservée pour David : maintenir cette durée après essai réel ? Le lot 01 ne la transforme pas en format de sauvegarde.

### T3 — pointeur fiable et molette seuillée [LOOP-10]

La capture est demandée directement dans le geste souris. Le mouvement brut est demandé par défaut, avec repli sur `NotSupportedError` et préférence persistée **« Accélération du système »**, désactivée par défaut. API à promesse et API `void`, échec de capture, glisser pour viser, pause et succès tardifs sont couverts. Le clic d’acquisition ne tire pas, même si la capture arrive avant le `mousedown` de compatibilité.

La revue indépendante a reproduit puis corrigé l’annulation d’une demande encore en attente : `pointercancel` empêche désormais un repli ou une acquisition tardive, tandis qu’un simple relâchement reste valide. Le prochain geste peut à nouveau capturer. Les trois régressions supplémentaires donnent **1 réussite / 2 échecs → 3/3** ; le fichier d’entrées complet atteint **24/24**.

La molette cumule les déplacements normalisés (pixels, lignes et pages), avec seuil **100 px** et délai **150 ms**. Trente petits événements de 4 px produisent **30 → 1 changement d’arme**. Le test historique de molette attend volontairement aucun changement à 1 px, puis un à 99 px supplémentaires ; les vérifications d’arsenal restent présentes.

[Preuves avant/après, sources API et annulation tardive](preuves/lot-01/t3/PROOF.md). Validation cumulative ciblée : **85/85** (entrées, checkpoints, options, cadence), build et contrôle de distribution PASS. HTML **806 474 → 809 176 octets**, SHA-256 `9a935866e0f1b64bda17fc5e5092cd534deeab38fc0d44367bf44e6fbba950e2` ; version 0.8.1. Les horloges restent hors de la simulation. Aucun essai de souris Windows, de Safari/Firefox ou de téléphone physique n’est déduit du harnais.

Valeur par défaut appliquée : mouvement brut activé. Question de ressenti conservée pour David : maintenir cette valeur après essai de la sensibilité sur sa souris ? L’option permet déjà le mouvement traité par le système.

### T4 — cadence régulière et indication explicite [LOOP-09]

Le limiteur observe tous les callbacks, mesure leur période et présente une image tous les N rafraîchissements. La première calibration, le changement d’écran/cible et les suspensions réinitialisent proprement la décision. Une tolérance numérique et une bande d’hystérésis évitent les oscillations du diviseur aux demi-entiers. Le texte est aussi rafraîchi dans l’onglet Image **en pause**.

La fiche contient une contradiction : sa formule `round(fréquence/cible)` ne peut pas produire à la fois 60 i/s sur 75 Hz et 48 sur 144 Hz. La contre-vérification LOOP-09 prime. Le libellé est donc **« Cadence visée »**, accompagné de la cadence estimée réellement choisie. Il ne s’agit pas d’un plafond strict.

| Écran / cible | Limiteur historique | Candidat final |
|---|---:|---:|
| 75 Hz / 60 | 37,5 i/s | 75 i/s, un rafraîchissement |
| 90 Hz / 60 | 45 i/s | 45 i/s, deux rafraîchissements |
| 144 Hz / 60 | 48 i/s | 72 i/s, deux rafraîchissements |
| 165 Hz / 60 | 55 i/s | 55 i/s, trois rafraîchissements |
| 75 Hz / 30 | 25 i/s | 25 i/s, trois rafraîchissements |

Les **63 scénarios** exacts, arrondis et avec faible gigue sont stables après chauffe. Les trois défauts de stabilisation et le texte de pause ont leurs tests rouges avant/verts après. [Preuves T4](preuves/lot-01/t4/README.md) et [nouvelle mesure sur l’intégration finale](preuves/lot-01/final/README.md).

La décision nouvelle de PR #2 est déjà tranchée : **60 i/s constantes à résolution native, 30 en repli calibré**, sans oscillation en combat. Le gouverneur, le défaut 60/30 et la suppression de l’adaptation automatique de résolution appartiennent aux **lots 06/07/15**. La préférence actuelle sans limite et l’ancien gouverneur ne réalisent pas encore cette cible ; T4 ne prétend pas les avoir remplacés.

### Clôture du lot 01

**Préflight, T1, STAB-V1, T2, T3 et T4 terminés.** Les variantes physiques de LOOP-01, le changement de format des sauvegardes et la boucle fixe restent écartés ou différés conformément aux arbitrages ; aucun format n’a été ajouté. Les seuls fichiers de production modifiés sont `game.js`, `simulation.js`, `options.js` et le balisage des options dans `index.html`.

| Validation finale | Résultat |
|---|---|
| Suite complète avant / après | **422/422 → 470/470**, zéro échec ni test ignoré |
| Contrôle de monde séparé | **18 cas**, PASS |
| Build et contrôle de distribution | PASS, zéro ressource externe |
| HTML brut | **803 375 → 812 696 octets** (+9 321), limite 1 400 000 |
| Version | **0.8.1**, conservée |
| Limiteur synthétique sur les sources réunies | **63/63** scénarios stables |

SHA-256 du HTML final : `4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a`. [Journal complet, empreintes et captures](preuves/lot-01/final/README.md).

Le contrôle Chrome distant a vérifié les nouveaux réglages, leur remise à zéro, le lancement et la pause. **WebGL 2 y est indisponible et le rendu CPU affichait environ 1 FPS** : la cadence n’a pas pu y être calibrée, et le pointeur est resté en mode de visée par glisser. L’essai ne prouve aucune performance GPU, aucune fréquence d’écran physique ni l’absence d’accélération d’une souris réelle. Téléphone, Windows/NVIDIA, Safari et Firefox restent à vérifier. Aucune égalité de pixels ni écoute physique n’est annoncée.

Le lot 00 / T1 est publié dans la PR #3. Le lot 01 dépend de cet outillage ; sa branche garde une tâche par commit. Aucune fusion de main, aucun déploiement et aucun changement de version n’ont été effectués. **Les lots 02 et suivants ne sont pas réalisés dans cette livraison.** La prochaine étape est l’invalidation locale de navigation et les optimisations de simulation du lot 02, avec sa comparaison principale appariée ; la replanification sélective demeure réservée au lot 03/T4.

## Intégration et version 0.9.0 — 13 novembre 2026

Intégration sur `chantier/integration` des pistes terminées, après l'arrêt du
workflow d'agents du matin. Rien n'a été réécrit : chaque piste entre par une
fusion `--no-ff` qui garde ses commits.

| Piste | Contenu intégré | État |
|---|---|---|
| `chantier/lot-01s-determinisme-plateformes` | `FMath` (sin, cos, atan, atan2, hypot2, hypot3) dans `world.js`, empreintes dorées des 108 mondes de campagne, outillage de comparaison de plateformes | Terminée ; 6 commits |
| `chantier/lot-00-outils` | R1 et R1b : lanceur Chrome sans tête par tube CDP, PNG, comparaison d'images, `run-page.mjs`, portabilité Linux | Partielle : R1/R1b seulement, le reste du lot 00 reste à faire |
| `chantier/module-boucle` | `src/loop.js`, `src/schedule.js` et bancs | Module livré, **non raccordé** |
| `chantier/module-ciel` | `src/skies.js`, 18 ciels et captures | Module livré, **non raccordé** |
| `chantier/module-demo` | `src/demo.js` (schéma, enregistreur, rejoueur, réalisateur) | Module livré, **non raccordé** |
| `chantier/module-entrees` | `src/input.js` (clavier, souris, manette, réglages, invites, vibrations) | Module livré, **non raccordé** |
| `chantier/module-physique` | `src/physics.js` et bancs de scènes | Module livré, **non raccordé** |

Les pistes `chantier/lot-02-simulation` (T0–T4 et T17 sur 16 tâches) et
`chantier/lot-11-audio` (plus avancée, travail en cours non commité) ne sont
**pas** intégrées : elles sont partielles. Leurs clones gardent l'état exact.

### Contrôles exécutés

| Contrôle | Résultat |
|---|---|
| `npm test` sur le Mac (Node 24.18, macOS arm64) | **485/485**, zéro échec |
| `npm test` sur le Spark (Linux arm64, Node 24) | **485/485**, zéro échec |
| Tests des cinq modules, hors `npm test` | 234 réussis, 0 échec, 1 `todo` |
| `npm run render-check` (Chrome sans tête, ANGLE Metal, M5) | 56/56, WebGL 2 disponible |
| `python3 tools/build.py` et `checks/build.test.mjs` | PASS, **833 373 octets bruts**, 0 ressource externe |
| Partie lancée sans tête sur la page construite | état `playing`, 60 i/s, zéro erreur de console |

La référence de tests passe donc de 470 à 485 : les quinze tests ajoutés sont
ceux de `FMath` et des empreintes de mondes du lot 01 suite. Le même total au
Mac et au Spark est le point du lot 01 suite (MURS-V1), pas une preuve de
performance.

### Version et mise en ligne

Commit de version dédié `0604bf1` (0.8.1 → **0.9.0**), fusion dans `main` par
`a7791f0`. HTML final : **833 373 octets**, SHA-256
`8283d60608280cf78a903829318dbc6b4276137e5058067593d8828f3ccffb65`, version
affichée `V0.9.0`.

Déploiement sur https://fps.estrasse.fr (VPS amiga) : release
`releases/a7791f070fab0f34513ac6ea1254fd9332900f7d`, empreinte vérifiée avant
et après la bascule, trois versions gardées (la plus ancienne, `673d6b2`, est
retirée). La page servie est identique octet à octet au fichier testé.

### Ce qui n'est pas prouvé

- Aucun banc de non-régression apparié contre la page 0.8.1 n'a été exécuté :
  la cadence à 60 i/s vient d'une exécution sans tête sur ce Mac, pas d'une
  mesure comparative.
- Aucun essai sur Windows/NVIDIA, téléphone, Safari ou Firefox.
- Les cinq modules ne changent pas encore le jeu : ils sont fusionnés, testés
  isolément et documentés, mais aucun n'est branché dans `game.js`.
- Les lots 02 à 18 restent inachevés.
