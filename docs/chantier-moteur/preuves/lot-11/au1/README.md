# Lot 11 — au-delà 1 : la première tranche d'un effet n'attend plus 256 échantillons

## Ce qui a été trouvé

Profil de la préparation audio sur la tête de branche (`node tools/audio-prep-profile.mjs
. --reps 7 --game`, domaine principal de Node, contexte Web Audio factice) : la tranche
la plus lourde de `FAudio.prepare(0)` atteignait 20 à 27 ms, alors que le budget de
LOAD-13 est de 8 ms. La cause est dans la boucle de découpage :

```js
if(clock&&job.blockMs>0&&clock()+job.blockMs>deadline)return false;
var done=job.renderer.step(BLOCK);          // BLOCK = 256
```

Le budget est vérifié *avant* un bloc, avec la durée du bloc précédent comme prédiction.
Le premier bloc de chaque effet part donc sans contrainte (`blockMs` vaut 0) à 256
échantillons, et sur les effets les plus chers un seul bloc de 256 échantillons coûtait
jusqu'à 19 ms : la tranche dépassait le budget de plus du double, sans qu'aucune
vérification ne puisse l'arrêter.

## Ce qui a été fait

Le bloc n'est plus une constante. À l'ouverture d'un effet, sa taille est calculée depuis
un coût déjà mesuré — la durée de la variante déjà rendue pour ce nom, sinon le pire
débit observé (`worst`, en ms par échantillon) — pour viser 2 ms de travail, bornée entre
16 et 256 échantillons. Un bloc qui dépasse malgré tout sa cible rétrécit pour la suite du
même effet.

Sans horloge (rigs de test, royaumes froids) le bloc reste à 256 et la file avance d'un
effet par tranche, comme avant : rien dans la préparation ne dépend du temps mural quand
l'horloge manque.

La taille de bloc ne touche pas au son : `synthJob` garde son index `i`, son état de
filtres et son LCG entre les appels, et appelle `rand()` exactement une fois par
échantillon. `step(64)` quatre fois produit bit à bit le même `Float32Array` que
`step(256)` ; la normalisation de `seal()` se fait une fois à la fin, comme avant.

## Mesures — `prep.json`, puis **rejouées au tour 1** (`prep-replay-1.json`, `prep-replay-2.json`)

`node tools/audio-prep-profile.mjs .relais/avant-au1 .relais/au1 --reps 7 --game` : deux
arbres de travail, A = `982418a` (avant), B = `ff20e35` (au-delà 1), 7 allers-retours alternés
A,B,A,B… dans le même processus, médianes. Machine partagée, le bruit est réel : la table
complète est conservée.

**La table publiée par la première version de ce README ne se reproduit pas.** Elle annonçait
une tranche max médiane de 20,49 → 18,91 ms, une médiane des écarts appariés de **−19,1 %
(5 paires sur 7)** et surtout « tranches au-dessus de 8 ms : **22 → 16, soit −27 %** ». Deux
rejouées indépendantes de 7 passages, sur cette machine, donnent autre chose :

| passage | rejouée 1 : max A | max B | écart | > 8 ms A | B | rejouée 2 : max A | max B | écart | > 8 ms A | B |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 16,97 | 14,76 | −13,0 % | 20 | 20 | 18,39 | 21,74 | +18,2 % | 17 | 19 |
| 1 | 20,23 | 25,83 | +27,7 % | 22 | 19 | 28,49 | 20,34 | −28,6 % | 30 | 24 |
| 2 | 29,92 | 28,50 | −4,7 % | 21 | 23 | 25,72 | 33,26 | +29,3 % | 19 | 19 |
| 3 | 28,51 | 29,70 | +4,2 % | 19 | 22 | 40,66 | 28,30 | −30,4 % | 26 | 25 |
| 4 | 32,62 | 28,86 | −11,5 % | 19 | 21 | 27,29 | 26,04 | −4,6 % | 18 | 23 |
| 5 | 27,04 | 42,10 | +55,7 % | 17 | 15 | 26,45 | 25,09 | −5,1 % | 16 | 23 |
| 6 | 24,59 | 22,88 | −6,9 % | 17 | 19 | 24,66 | 25,46 | +3,2 % | 13 | 18 |
| **médiane** | **27,04** | **28,50** | **−4,7 %** | **19** | **20** | **26,45** | **25,46** | **−4,6 %** | **18** | **23** |

- **Tranches au-dessus de 8 ms : le −27 % annoncé n'existe pas.** Médiane des écarts appariés :
  **+2 tranches** dans les deux rejouées, et seulement **2 paires sur 7** en faveur de B dans
  chacune. B (au-delà 1) a *plus* de tranches hors budget que son parent, pas moins.
- **Tranche max : −4,7 % et −4,6 %** (4 paires sur 7), et non −19,1 % (5 sur 7). Un gain réel
  mais deux fois plus faible, et qui ne passe pas le seuil des 5 paires sur 7 que le brief
  demande pour retenir un gain.
- **Durée totale** : médiane des écarts appariés **0,0 %** puis **+2,3 %**, contre les −3,2 %
  publiés. Là encore, non reproduit.

Pourquoi l'écart avec la table d'origine : l'outil a changé depuis. `tools/audio-prep-profile.mjs`
ignorait les noms ajoutés par le jeu (`options.extras`) ; depuis le correctif du problème 3 il
les embarque, donc la file mesurée n'est plus la même (68 puis 72 tampons avec la table METAL au
lieu de 64). La table d'origine a été prise avec un outil qui ne mesurait pas le même travail.
La machine est de plus partagée et la variance d'un passage à l'autre est énorme (16,97 à
42,10 ms pour le même arbre) : c'est exactement le cas où le brief impose la médiane appariée
et les paires favorables, et ces deux-là ne suivent pas.

**Ce qui tient quand même, et qui est le vrai objet du commit** : le mécanisme. La taille de
bloc calculée à l'ouverture d'un effet, bornée entre 16 et 256 échantillons, et le fait que
`step(64)` quatre fois produise bit à bit le même `Float32Array` que `step(256)` — vérifié par
test, et `bankSha256` identique ci-dessous. Le gain de régularité que la première version
présentait comme acquis n'était qu'un effet de la table publiée : il n'est pas reproduit.

**Ce que le lot livre réellement aujourd'hui** n'est plus ce commit : c'est le correctif du
problème 3 (`e9de02c`), mesuré `.relais/prep-fix2.json` — tranche max médiane **24,44 → 14,41 ms**,
tranches au-dessus de 8 ms **22 → 4**, banque identique. Le blocage venait des recettes opaques
du jeu, que ce README listait justement comme « ce que ça ne règle pas » : c'est ce point-là
qu'il a fallu ouvrir, pas la taille de bloc.


## Identité

`bankSha256` identique des deux côtés (`54d3df3c8b3a1d2a…`), `buffersDifferent: 0` sur les
**68** tampons (64 d'effets + les 4 de confirmation du T4, deux variantes chacun),
`changedVsDefault` = les dix noms d'armes attendus, `modulesIdentical: true`, modules
`50d88a07…`, `c12b06da…`, `738adaa5…`, titre `88dfafde…`, `sameBankAB: true`.

**Correction du tour 1.** La première version écrivait que `prepareMatchesDirect.bank` était
`false` « de façon identique sur A et sur B », en l'expliquant par la table de recettes. C'était
un **bug de l'outil**, pas un comportement des arbres : `tools/audio-prep-profile.mjs` comparait
les tampons préparés à une synthèse nue y compris pour les noms portés par `options.extras`,
qu'il ne chargeait pas. Depuis le correctif, `prepareMatchesDirect` est `true` sur les trois
volets (`bank`, `module`, `titleModule`) des deux côtés. La phrase d'origine naturalisait un
défaut de mesure ; elle est retirée.


## Vérifications et limites

- `npm test` : 516 réussis, 0 échec (référence 506/506).
- `python3 tools/build.py` : `dist/index.html` 865 940 octets, gzip 265 636 octets,
  0 actif externe, sous la limite de 1 400 000.
- **Ce que ça ne réglait pas** (état au moment du commit, depuis ouvert) : la tranche
  maximale était bornée par les recettes opaques du jeu. Une recette fournie par
  `src/audio-recipes.js` était une fonction opaque que le moteur ne pouvait pas couper —
  `rocket#1` restait à 21,4 ms d'un seul tenant — et ce README la laissait en « piste ».
  C'est le correctif du problème 3 (`e9de02c`) qui l'a ouverte : `FAudio.recipe` expose un
  rendu reprenable (`job`) que la file de préparation découpe comme un effet du moteur.
- Non mesuré : le ressenti réel du chargement sur téléphone, qui attend un appareil.
