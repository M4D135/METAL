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

## Mesures — `prep.json`

`node tools/audio-prep-profile.mjs .relais/avant-au1 . --reps 7 --game` : deux arbres de
travail, A = `982418a` (avant), B = l'arbre, 7 allers-retours alternés A,B,A,B… dans le
même processus, médianes. Machine partagée, le bruit est réel : la table complète est
conservée.

| passage | tranche max A | tranche max B | écart | tranches > 8 ms A | B |
| --- | --- | --- | --- | --- | --- |
| 0 | 16,21 | 18,48 | +14,0 % | 16 | 18 |
| 1 | 20,49 | 18,37 | −10,3 % | 23 | 18 |
| 2 | 25,86 | 20,92 | −19,1 % | 25 | 14 |
| 3 | 17,94 | 10,94 | −39,0 % | 19 | 11 |
| 4 | 24,83 | 19,35 | −22,1 % | 22 | 16 |
| 5 | 17,40 | 20,04 | +15,2 % | 17 | 15 |
| 6 | 27,41 | 18,91 | −31,0 % | 25 | 20 |
| **médiane** | **20,49** | **18,91** | **−7,7 %** | **22** | **16** |

- **Médiane des écarts appariés sur la tranche max : −19,1 %** (5 paires sur 7 en faveur
  de B ; les deux paires contraires, +14,0 % et +15,2 %, restent dans le bruit mesuré).
- Tranches au-dessus de 8 ms : 22 → 16, soit **−27 %** (médiane des écarts appariés :
  −5 tranches).
- Effets intégrés les plus lourds, durée totale de l'effet : `break:glass#1`
  32,5 → 12,9 ms, `break:glass#0` 29,8 → 13,4 ms.
- Total de la préparation : 347,7 → 336,6 ms (−3,2 %) ; le découpage ajoute des
  reprises, le gain est sur la régularité, pas sur la durée totale.

## Identité

`bankSha256` identique des deux côtés (`acfb0222190905ab…`), `buffersDifferent: 0` sur
les 64 tampons d'effets, `modulesIdentical: true`, modules `50d88a07…`, `c12b06da…`,
`738adaa5…`, titre `88dfafde…`. `prepareMatchesDirect.bank` est `false` **de façon
identique sur A et sur B** : en mode `--game` le chemin préparé applique la table de
recettes et ne peut pas correspondre à une synthèse nue ; ce n'est pas un écart introduit
ici, et les deux arbres se comportent pareil.

## Vérifications et limites

- `npm test` : 516 réussis, 0 échec (référence 506/506).
- `python3 tools/build.py` : `dist/index.html` 865 940 octets, gzip 265 636 octets,
  0 actif externe, sous la limite de 1 400 000.
- **Ce que ça ne règle pas** : la tranche maximale est maintenant bornée par les recettes
  opaques du jeu. Une recette fournie par `src/audio-recipes.js` est une fonction opaque
  que le moteur ne peut pas couper — `rocket#1` reste à 21,4 ms d'un seul tenant. Le
  rendre interruptible demanderait une forme de recette reprenable dans l'API, ce qui
  dépasse une optimisation de ce lot : c'est noté comme piste, pas fait ici.
- Non mesuré : le ressenti réel du chargement sur téléphone, qui attend un appareil.
