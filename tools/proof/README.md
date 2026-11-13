# Outils de preuve — lot 00, T1

Ces outils exécutent les sources locales de METAL dans le domaine principal de
Node. Ils ne modifient ni `src/`, ni les tests fonctionnels, ni le HTML livré.
Ils sont hors de `npm test` et hors du budget de 1 400 000 octets du jeu.
Ils ne constituent pas un bac à sable pour du code non fiable.

## Commandes

Depuis la racine du dépôt :

```sh
node tools/realm-loader.mjs
node tools/proof/self-check.mjs
node tools/profile-steps.mjs . --out /tmp/metal-profile-1.json
node tools/profile-steps.mjs . --out /tmp/metal-profile-2.json
node tools/proof/reference-check.mjs /tmp/metal-profile-1.json
node tools/ab2.mjs . . --out /tmp/metal-aa.json
node tools/ab2.mjs . ../METAL-variante --out /tmp/metal-ab.json
node tools/realm-check.mjs . --out /tmp/metal-realms.json
```

Les profils et comparaisons utilisent par défaut les quatre scénarios de
`scenarios.mjs`, la graine 96, 1 800 pas à 1/60 s, un passage complet de chauffe
et deux passages mesurés. Le profil de domaine utilise deux scénarios et 1 200
pas par défaut. `--scenario legacy-s0,campaign-w10`, `--steps`, `--reps`,
`--warmups`, `--seed`, `--weapon` et `--out` sont paramétrables. La chauffe ne
peut pas être supprimée : un premier passage complet au minimum est écarté.

`all` désigne toujours les quatre scénarios historiques de l'audit ; les deux
scénarios `campaign-w10` et `campaign-w16` utilisent donc la campagne V1.
Pour sélectionner explicitement la campagne V2 du jeu livré, les identifiants
`campaign2-w1` à `campaign2-w18` passent `{campaign:true,campaignVersion:2}`
au générateur. Ils utilisent le même pilote déterministe, par exemple :

```sh
node tools/ab2.mjs . . --scenario campaign2-w1,campaign2-w10 --steps 120 --reps 1 --out /tmp/metal-v2-aa.json
```

Ces sélections V2 n'étendent pas implicitement `all` et ne remplacent aucune
référence historique. Les mesures de campagne V2 complètes relèvent du lot 02.

Sans `--out`, le rapport JSON complet est écrit sur la sortie standard.
Les sorties contiennent les mesures brutes de chaque pas, y compris celles
des passages de chauffe marqués `excludedWarmup`. Ces passages sont exclus
de tous les agrégats de temps. Les pas réellement exécutés sont comptés ;
une mort ou une victoire anticipée n'est pas divisée par la durée demandée.

Les anciens outils conservent leur argument historique de sortie et acceptent
désormais une racine indépendante du répertoire courant :

```sh
node tools/campaign-profiles.mjs --root ../METAL-variante --out /tmp/worlds.json
node tools/campaign-balance.mjs --root ../METAL-variante --out /tmp/balance.json
node tools/boss-profiles.mjs --root ../METAL-variante --out /tmp/bosses.json
node tools/boss-ttk.cjs --root ../METAL-variante --out-dir /tmp/metal-ttk
```

`boss-ttk.cjs` utilisait déjà une fonction enveloppe dans le domaine principal ;
son chargement ne passait pas par `node:vm`. Seuls ses chemins deviennent
paramétrables. Les trois outils qui utilisaient `vm.createContext` passent par
le nouveau chargeur. Les règles et pilotes de ces anciens rapports ne changent
pas ; notamment, les rapports de trophées décrivent toujours leur campagne
historique, pas un nouveau scénario de progression par boss.

## API du chargeur et variantes en mémoire

```js
import {loadRealm} from './tools/realm-loader.mjs';

const variant = loadRealm({
  root: '/chemin/vers/METAL',
  modules: ['fmath', 'renderer', 'world', 'destruction', 'economy', 'brain', 'simulation'],
  patches: {simulation: [['ancre unique', 'remplacement']]},
  instrument: false,
  realm: 'main',
  globals: {},
});
const {FWorld, FSimulation} = variant.window;
```

Chaque variante a un `window` neuf et une enveloppe lexicale distincte, compilée
avec `vm.runInThisContext`. `window`, `self` et `globalThis` pointent vers cet
objet local. Les exports `F…` peuvent être utilisés comme variables par les
modules suivants, sans les inscrire sur le `globalThis` de Node. Les globales
fournies par `globals` sont des paramètres de cette enveloppe. Les API et
intrinsics natifs de Node gardent leur domaine principal.

La valeur renvoyée contient `window`, `root`, `realm`, `modules`, les SHA-256
des sources originales et des sources chargées, ainsi que les positions des
modules dans l'enveloppe pour le diagnostic. `transform(name, source)` peut
compléter `patches`. Les remplacements de chaînes exigent exactement une
occurrence ; les expressions régulières doivent correspondre au moins une
fois. Les ancrages absents provoquent une erreur, jamais une mesure du mauvais
code. Un échec de compilation ou d'exécution ne laisse pas de `window` global.

L'A/B accepte aussi des modules locaux de patches sans écrire dans les sources :

```sh
node tools/ab2.mjs . . --patch-b /tmp/variante.mjs#patches --out /tmp/ab.json
```

L'export nommé est un objet de patches, ou une fonction sans argument qui le
renvoie. Sans `#export`, l'export `default` est utilisé. `--patch-a` prépare
également une référence modifiée. Le module de patches est du code local de
confiance ; ce mécanisme n'est pas une isolation de sécurité.

## Empreintes et preuve d'identité

Le pilote `audit-sim-driver-v1` reprend explicitement les quatre scénarios du
banc SIM, leur mouvement sinusoïdal, leurs rafales, leur esquive et l'incrément
direct de lacet de 0,01 radian avant chaque pas. Ce pilote sert à reproduire
l'audit ; il n'est pas présenté comme une partie humaine ni comme une démo.

`fnv1a32-float64le-state-v1` encode les nombres en Float64 petit-boutiste,
avec des tags distinguant nombre, booléen, chaîne, valeur absente et `null`.
Il conserve notamment `-0`. Les positions, vitesses, orientations, états de
combat et chemins des acteurs, les poses et vitesses des débris, les
projectiles et les événements participent à l'empreinte. Le schéma des champs
est explicite dans `digest.mjs`. Un changement de ce schéma exige une nouvelle
version et de nouvelles références.

Chaque pas a son empreinte ; une empreinte cumulée protège aussi leur ordre.
Les événements sont lus avant d'être vidés, comme dans le shell réel. Le
snapshot final est comparé par SHA-256, FNV-1a et longueur UTF-8. FNV32 reste
un signal de régression avec possibilité de collision ; il ne remplace pas
une démonstration mathématique ou les tests fonctionnels.

`reference-63668ac.json` conserve les empreintes des 1 800 pas et du snapshot
final pour chacun des quatre scénarios, les hashes des sources de départ et
les comptes de référence. `reference-check.mjs` vérifie un rapport enregistré
contre ces états. Il accepte un sous-ensemble explicite de scénarios ; il
refuse une graine, un pas de temps, une durée ou un schéma différents. Les
comptes et hashes des sources restent documentés, mais leur différence n'est
pas un échec d'identité : une optimisation exacte doit pouvoir les changer.

L'A/B doit conserver l'état à chaque pas et le snapshot final. Il vérifie aussi
la stabilité de chaque variante entre répétitions et l'identité du rejeu
instrumenté. Une divergence produit un rapport avec le premier pas divergent
et un code de sortie 1. Un A/A et deux profils identiques doivent avoir les
mêmes empreintes, pas les mêmes durées CPU.

## Mesures et compteurs

Le temps CPU est la somme `user + system` de `process.cpuUsage` autour de
`sim.step` uniquement. Le pilote, les hashes, le snapshot et la collecte des
compteurs sont hors des segments chronométrés. En A/B, les deux pas sont
mesurés avant le calcul de leurs hashes. Leur ordre alterne AB/BA à chaque pas
et au début de chaque répétition. Le rapport donne le ratio médian B/A des
paires où les deux temps atteignent `--min-cpu-us` (5 µs par défaut), le nombre
de paires écartées et le ratio des totaux séparément.

Par défaut, un rejeu supplémentaire **non chronométré** applique les compteurs
par réécriture du source en mémoire. Le code livré n'en contient aucun.
Les compteurs vivent uniquement dans `s.aiStats` et sont remis à zéro avant
chaque pas par le banc :

| Compteur | Définition |
|---|---|
| `ground` | Entrées dans `ground` après la création de `s.aiStats`. |
| `blocked` | Entrées dans `blocked`, y compris les appels des autres helpers. |
| `segmentFree` | Entrées dans le test de passage d'un segment. |
| `astarPops` | Éléments réellement retirés du tas A*, doublons compris. |
| `astarNodes` | Nœuds retirés non déjà fermés, objectif final compris. |
| `revisions` | Incréments effectifs de `s.destructionRevision`. |

Ces définitions évitent de compter comme nœud développé le post-incrément
d'une condition de boucle qui vient de refuser une itération. La construction
initiale et le snapshot final peuvent travailler sur la navigation ; leurs
compteurs ne sont pas attribués à un pas simulé. `aiStats` est exclu de
l'empreinte. `--no-counters` saute ce rejeu ; une nouvelle implémentation de
navigation doit faire relire les ancrages de `instrument.mjs` avant de
réactiver les compteurs.

Les durées incluent le GC/JIT imputé au processus. Le coût des appels de mesure
n'est pas soustrait. Une chauffe ne garantit pas l'absence de compilation
tardive. Les rapports donnent CPU, Node/V8, système, charge et hashes des
sources ; aucune valeur absolue issue du Mac de l'audit ne devient un seuil
sur une autre machine.

`realm:'vm'` et `--realm vm` existent uniquement pour reproduire le biais de
méthode. Ils ne sont pas le mode des profils de performance ordinaires.
Le banc historique `bancs/sim/realm-check.mjs` compare deux contextes VM
(Math partagé ou non) ; `tools/realm-check.mjs` complète ce diagnostic par une
vraie comparaison main/VM avec temps CPU et checksums.

## Trigonométrie portable (lot 01 suite)

Depuis le lot 01 suite (T2), `src/world.js` prend `sin`, `cos`, `atan` et
`atan2` dans `FMath` (`src/fmath.js`), identique bit à bit sur toutes les
plateformes, et depuis T3 `hypot2` et `hypot3` (le `Math.hypot` de V8, que
JavaScriptCore calcule autrement). Sans `modules`, `loadRealm` charge donc `fmath` en tête quand la
racine a `src/fmath.js` (`defaultModules(root)`) ; une racine plus ancienne
garde la liste historique, et une racine dont `world.js` cite `FMath` sans
`src/fmath.js` est refusée. Une liste explicite qui contient `world` doit
placer `fmath` avant lui.

La simulation, la destruction et le pilote gardent le `Math` de la machine : sur
arm64 (Mac, Linux arm64), un rejeu s'écarte des références x86-64 dès le
44e pas. La précharge `fmath-global.mjs` remplace ces quatre fonctions dans
tout le processus, pour comparer un rejeu fait sur arm64 aux références :

```sh
node --import=./tools/proof/fmath-global.mjs tools/profile-steps.mjs . --reps 1 --warmups 1 --no-counters --out /tmp/p.json
node tools/proof/reference-check.mjs /tmp/p.json
```

`tools/gen-ab.mjs` compare le coût de `FWorld.create` entre deux racines (A/A
intégré) ; `tools/platform-math.mjs` mesure la sensibilité des mondes, des
points de reprise et des rejeux à la plateforme.

## Limites de la livraison T1

Aucun rendu WebGL, navigateur, téléphone, écran à fréquence élevée ou matériel
NVIDIA n'est mesuré ici. Le faux WebGL2, les différences de pixels, l'overlay,
le census de saccades et les autres tâches du lot 00 restent distincts et
reportés selon le master prompt. Cet outillage ne les remplace pas.
