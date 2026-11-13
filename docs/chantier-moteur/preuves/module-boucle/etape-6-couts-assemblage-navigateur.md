# Étape 6 — coûts, assemblage et navigateur réel : preuves

Mac M5 (arm64, macOS 27.2.1), Node v24.18.0, Google Chrome 157.0.8103.39, Python 3.14.7. Branche
`chantier/module-boucle`, parent `4289291` (étape 5), base `71eca61`. Classe de preuve : état identique. L'étape ne
crée que des fichiers neufs, et `dist/index.html` et `SIZE.json` ne sont pas reconstruits : l'assemblage montre qu'ils
ne changent pas. Constats : STAB-06, STAB-07 ; règles d'`AGENTS.md` (budget de 1 400 000 octets bruts, aucun actif
externe). Mesures et lecture : document, sections 4.3 à 4.5.

## Origine des fichiers

Le relais ne les avait pas écrits : `git cat-file -e spark/spark-wip/boucle:<chemin>` échoue pour les deux outils, les
deux JSON, la page et son résultat. Tout est écrit depuis les §7.4, §7.5 et §7.6 de la mission.

| Fichier | Octets | Rôle |
|---|---|---|
| `tools/boucle-banc-couts.mjs` | 8 374 | banc de coûts (§7.4) → `banc-couts.json` (3 583) |
| `tools/boucle-assemblage.mjs` | 8 337 | émulation de `tools/build.py` (§7.5) → `assemblage.json` (2 753) |
| `preuves/module-boucle/navigateur.html` | 6 043 | page d'essai pour Chrome sans tête (§7.6) → `navigateur-resultat.txt` (1 497) |
| `preuves/module-boucle/etape-6-navigateur-node.mjs` | 2 330 | rejoue sous Node le script de la page et compare son JSON à celui de Chrome |
| `preuves/module-boucle/etape-6-pump-horloge.mjs` | 1 841 | part des lectures d'horloge dans `pump10Us` |
| `docs/chantier-moteur/modules/boucle.md` | — | sections 4.3, 4.4 et 4.5, et l'en-tête de la section 4 |

## Conformité à la mission

**§7 (tous les outils).** Les outils se lancent depuis la racine et la trouvent par
`fileURLToPath(new URL('../', import.meta.url))`. Ils n'écrivent que dans `preuves/module-boucle/` et n'affichent
qu'un résumé. Ils sortent en code 1 si un critère tombe. Chaque JSON commence par `schema`, `node`, `arch`,
`platform`, `cpu` et `loadavg`. Ils ne contiennent aucun tableau par image : seulement des séries de cinq valeurs.

**§7.4 (coûts).**

| Exigence | Outil |
|---|---|
| domaine principal | `loadRealm({root, modules: ['loop', 'schedule'], realm: 'main'}).window` |
| `process.hrtime.bigint()` | oui, pour les cinq mesures |
| une série de chauffe non comptée, puis 5 séries ; chaque série et la médiane | oui : `warmup`, `series` (5), `median`, plus `min` et `max` |
| `advanceNs` : 1 000 000 horodatages `jit144` précalculés dans un `Float64Array`, rappel compteur, une boucle neuve par série | oui (`pattern('jit144')` de `tools/boucle-motifs.mjs`, images 1 à 1 000 000) |
| `advancePlanNs` : idem sans rappel | oui ; l'appelant additionne `frame.steps` |
| `pump10Us` : `FSchedule.create({now: () => performance.now()})`, 10 tâches de clés 0 à 9, priorité `k % 3`, coût .001, `run() { return false; }` ; 200 000 `pump(4)` | oui ; `performance.now()` est lu par l'outil, jamais par le module |
| `pumpSim3Ns` : 3 tâches « sim » qui rendent `Math.min(u, 100)` ; 1 000 000 `pumpSim(768)` | oui, avec `FSchedule.create()` : la file « sim » n'a pas besoin d'horloge |
| `track40Us` : par image `begin`, 40 `save`, `prune`, 40 `pose` ; 200 000 images | oui ; 5 cm de déplacement par image, donc la pose est interpolée (sous `snap` = 2 m) |
| seuils < 1 000 ns, < 1 000 ns, < 20 µs, < 2 000 ns, < 20 µs | oui, sur la médiane |

Ajouts, sans changer de critère :
- **Ordre alterné.** Dans chaque série, les cinq mesures se suivent, dans un ordre inversé une série sur deux (machine
  partagée).
- **Contrôle du travail** (`checks.workOk`, code 1 s'il est faux). Les deux modes d'`advance` font les mêmes pas, et
  `stats.steps` les compte. `pumpSim` consomme 300 unités par appel, et `track` suit 40 entités. Chaque série fait le
  même travail.
- En plus dans le JSON : `loadavgEnd`, `cores`, `seconds`, et la taille et le sha256 des deux modules.

**§7.5 (assemblage).**

| Exigence | Outil |
|---|---|
| liste `modules` de `tools/build.py` par `/modules=\[([^\]]*)\]/`, puis les noms entre apostrophes | oui |
| sources (`utf8`) jointes par `'\n;\n'` | oui ; lecture comme `Path.read_text()` de Python : UTF-8 strict, BOM gardé, fins de ligne universelles (aucun `\r` dans les sources) |
| dans `src/index.html`, `/*__STYLE__*/`, `/*__CODE__*/` et `__GAME_VERSION__` remplacés, par `split/join` | oui, dans l'ordre de `build.py`, sur toute la page |
| base : taille et sha256 de `SIZE.json` | oui : 812 696 octets, `4587dc49…` ; et identique à `dist/index.html` (`Buffer.equals`) |
| projet : `'loop.js','schedule.js'` juste après `'options.js'` | oui ; l'outil refuse une liste qui les contient déjà |
| `loopBytes`, `scheduleBytes`, `projectedHtmlBytes`, `delta` (= `loopBytes + scheduleBytes + 6`), marge, `gzipBytes` (niveau 9, indicatif) | oui ; plus le gzip de la base avec le même zlib, et l'écart des deux |
| pas de `</script` dans le code (insensible à la casse) | oui |
| les deux expressions de `checks/build.test.mjs`, recopiées : aucune ne correspond | oui, sur la page projetée et sur la base. L'outil vérifie aussi que leur texte figure tel quel dans `checks/build.test.mjs` |
| `syntaxOk` : `new vm.Script(code)` compile | oui, sur le code des 16 modules |
| `globalsOk` : `loop.js + '\n;\n' + schedule.js` dans `vm.createContext({window: {}})` définit `window.FLoop.create` et `window.FSchedule.create` | oui. En plus, `onlyTwoGlobals` : `window` ne reçoit que ces deux globaux, et le global du contexte rien |

**§7.6 (navigateur).** La page charge `../../../../src/loop.js` et `../../../../src/schedule.js` en scripts
classiques. Elle vérifie de façon synchrone les cinq points de la fiche : globaux, 144 Hz, 59,94 Hz, S11 et S01.
Elle écrit le JSON dans `<pre id="out">` et pose `document.body.dataset.result`.
- Les horodatages sont ceux de la fiche : `i * 1000 / 144` et `i * 1000 / 59.94`. L'écriture `i * (1000 / 144)` des
  motifs donne les mêmes comptes (vérifié sous Node).
- Un sixième contrôle va au-delà de la fiche : l'empreinte FNV-1a de 10 000 images `jit144` en mode plan, qui doit
  égaler celle de Node.
- Commande : celle de la fiche, avec le binaire de Chrome du Mac et `--no-default-browser-check`. Le profil est un
  dossier temporaire hors dépôt (`--user-data-dir="$(mktemp -d)"`), et il n'y a aucun port.

## Avant

- Parent `4289291` : les deux outils, les deux JSON, la page et son résultat sont absents
  (`git cat-file -e 4289291:<chemin>` échoue pour les six).
- Chiffres de départ : la page fait 812 696 octets (`SIZE.json`, main 0.8.1), sans `FLoop` ni `FSchedule`. Aucun
  coût de FLoop ni de FSchedule n'était mesuré, et ils n'avaient jamais tourné dans un navigateur.

## Après

**Coûts** : `node tools/boucle-banc-couts.mjs`, quatre passes en série, toutes en code 0. Médianes :

| Passe | `loadavg` (1 min) | `advanceNs` | `advancePlanNs` | `pump10Us` | `pumpSim3Ns` | `track40Us` | Durée |
|---|---|---|---|---|---|---|---|
| 1 | 4,92 | 87,0 | 79,7 | 1,229 | 110,9 | 1,365 | 5,8 s |
| 2 | 2,79 | 58,4 | 55,2 | 0,816 | 74,5 | 0,900 | 3,2 s |
| 3 | 2,79 | 54,3 | 53,8 | 0,868 | 77,9 | 0,944 | 3,3 s |
| 4, rangée | 2,73 | 54,2 | 56,4 | 0,852 | 76,9 | 0,921 | 3,2 s |
| seuil | | 1 000 ns | 1 000 ns | 20 µs | 2 000 ns | 20 µs | |

- Dans les quatre passes : 416 668 pas pour 1 000 000 d'images `jit144`, dans les deux modes. Les 10 tâches de
  `pump` tournent à chaque appel (2 000 000 d'exécutions par série, aucune sautée).
- Dans la passe 1, la cinquième série est jusqu'à 2,9 fois plus lente que les autres (230,3 ns pour `advanceNs`,
  contre 79,9 à 94,9) : un à-coup de la machine. La médiane l'écarte.
- Pré-mesure du chef de lot : 65 ns, 62 ns, 0,92 µs, 88 ns et 1,18 µs ; les quatre passes l'encadrent.

**Assemblage** : `node tools/boucle-assemblage.mjs`, code 0, 0,1 s :

```
base : 812 696 octets, sha256 4587dc49… ; SIZE.json reproduit, identique à dist/index.html
projet : 822 965 octets, delta 10 269 = 6 042 + 4 221 + 6 : ok ; marge 577 035 sous 1 400 000 ; gzip (Node, indicatif) 250 178 (+3 520)
bilan : ok — syntaxOk true, globalsOk true, </script absent, motifs de build.test absents
```

Contre-épreuve par Python, sans aucune écriture (`python3 -I -`, depuis la racine). Le script reprend les
expressions des lignes 6 à 12 de `tools/build.py` :

```python
from pathlib import Path
import ast, gzip, hashlib, json, re
ROOT=Path('.').resolve()
modules=ast.literal_eval('['+re.search(r"modules=\[([^\]]*)\]",(ROOT/'tools/build.py').read_text()).group(1)+']')
def page(mods):
    css=(ROOT/'src/style.css').read_text()
    code='\n;\n'.join((ROOT/'src'/name).read_text() for name in mods)
    html=(ROOT/'src/index.html').read_text().replace('/*__STYLE__*/',css).replace('/*__CODE__*/',code).replace('__GAME_VERSION__',json.loads((ROOT/'package.json').read_text())['version'])
    assert '</script' not in code.lower()
    data=html.encode('utf-8')
    assert len(data)<1_400_000
    return len(data),hashlib.sha256(data).hexdigest(),len(gzip.compress(data,mtime=0))
i=modules.index('options.js')
print('base', *page(modules))
print('projet', *page(modules[:i+1]+['loop.js','schedule.js']+modules[i+1:]))
```

```
base 812696 4587dc49da8299ab771cee377dbefde927338be8d2754badbf7d98674a5c485a 245325
projet 822965 9fdd167e4131ae47697da37c8d55d30b4c0ee6732dd35fe82fdc386756615f58 248756
```

Ce sont les sha256 de l'outil, pour la base comme pour le projet : l'émulation en JavaScript est exacte. Le gzip de
Python (245 325 octets pour la base) est celui de `SIZE.json` ; le zlib de Node donne 246 658 octets pour la même
page. Les deux ne se comparent pas.

**Navigateur** : commande du §7.6, code 0 ; stderr ne contient que des erreurs CVDisplayLink. `navigateur-resultat.txt`
porte `<body data-result="ok">` et le JSON des six contrôles, tous vrais : 601 pas et 839 images à 0 pas à 144 Hz ;
à 59,94 Hz, seule l'image 2 fait 2 pas, et c'est verrouillé à la fin ; S11 donne 53 tranches, la dernière de 64 ;
S01 donne BDAC ; l'empreinte `jit144` est `95894bbc`.
- `node docs/chantier-moteur/preuves/module-boucle/etape-6-navigateur-node.mjs` : `data-result="ok"` sous Node, et
  le même JSON que Chrome, au champ `engine` près (code 0).
- `95894bbc` est aussi l'empreinte du domaine principal : même calcul, avec FLoop chargé par `loadRealm`.

**Sur le Spark**, au-delà de la fiche (Linux aarch64, 20 cœurs, Node v24.18.0, Google Chrome 151.0.7922.137). On
copie dans `~/metal-tests/mb6-boucle/` les deux modules, la page, `realm-loader.mjs`, `proof/instrument.mjs`, les
motifs et les deux bancs ; rien n'est écrit ailleurs, il n'y a aucun port, et un seul Chrome tourne à la fois.
- La page, dans `google-chrome --headless=new --disable-gpu …` (profil sous `~/metal-tests/mb6-boucle/`, retiré
  ensuite), donne `data-result="ok"` et le même JSON qu'au Mac, au champ `engine` près. L'agent utilisateur annonce
  `Linux x86_64`, mais c'est la chaîne réduite de Chrome ; `uname -m` donne `aarch64`.
- `node tools/boucle-banc-horloge.mjs` : 21 motifs « ok », code 0. Son `banc-horloge.json` est identique à celui du
  Mac (étape 4) une fois l'en-tête retiré (`node`, `arch`, `platform`, `cpu`, `loadavg`).
- `node tools/boucle-banc-couts.mjs` (charge 1,74) : 74,5 ns, 72,0 ns, 1,542 µs, 90,3 ns et 1,349 µs ; bilan ok. Le
  JSON n'est pas rangé : `cpu` y vaut `unknown`, car Linux arm64 ne donne pas le modèle.
- `etape-6-pump-horloge.mjs` : `pump10` prend 1,572 µs avec `performance.now()` et 0,416 µs avec une horloge
  constante ; une lecture coûte 39,9 ns. Sur le Mac : 1,036 µs, 0,382 µs et 23,8 ns.

## Tests

`node --test --test-reporter=tap checks/floop.test.mjs checks/fschedule.test.mjs` : 50 tests, 50 réussis, 0 échec,
6,9 s. Aucun test n'est touché à cette étape. Les outils n'entrent pas dans `npm test` : `package.json` est inchangé
jusqu'au raccord.

`npm test` complet sur le Spark (Linux aarch64, Node v24.18.0, `outils/npm-test-spark.sh`), sur l'état final du
clone : 470 tests, 462 réussis, 8 échecs, 137,7 s de `node --test`. Ce sont les 8 échecs de la référence de
l'étape 0 : `not ok 108` à `115` de `checks/campaign-world.test.mjs`, soit six empreintes legacy (graines 1 et 96,
secteurs 0 à 2), puis « campaign mode is strictly opt-in… » et « the first three campaign worlds preserve historical
geometry… ». Aucun nouvel échec. La chaîne `&&` s'arrête avant `node checks/build.test.mjs`, lancé à part : PASS
(812 696 octets).

## Le jeu est inchangé

- Fichiers de l'étape : les deux outils, les deux JSON, la page, son résultat, les deux scripts de preuve et cette
  note sont créés ; `docs/chantier-moteur/modules/boucle.md` est complété. Aucun fichier du jeu n'est touché :
  depuis la base `71eca61`, `git diff --name-status` ne donne que des lignes `A`.
- `python3 tools/build.py` n'est pas lancé. L'assemblage refait la page en mémoire, et elle est identique à
  `dist/index.html` et à `SIZE.json`, octet pour octet : rien à reconstruire ni à commiter dans `dist/` ou
  `SIZE.json`.
