# Lot 11b / T2 — Infrastructure de test et banc hors ligne (MIX-11)

Constat : MIX-11. Classe de preuve : **sans objet (infrastructure)** — aucun comportement du
jeu ne change ; le seul code du jeu touché est additif (`FAudio.create({context})`,
`api.graph()`, et le pendant dans `FMusic` pour qu'un contexte hors ligne compte comme « en cours »
au lieu d'attendre une horloge qui n'existe pas).

Machine : Linux arm64 (DGX Spark), Node 24.18, **Chrome 151** sans interface
(`HeadlessChrome/151.0.0.0` dans le champ `ua` de chaque fichier), `OfflineAudioContext` à 48 kHz.
Rendu hors ligne déterministe : les mêmes graines et les mêmes scènes rendent les mêmes nombres.

## Ce que la tâche livre

1. **`src/audio.js`** — `FAudio.create({context})` adopte un contexte fourni (un
   `OfflineAudioContext` de banc) : il n'est jamais ouvert, relancé ni fermé par le moteur ;
   `available()` le tient pour disponible alors qu'il reste `suspended` ; `api.graph()` rend
   `{master, limiter, guard, effects, ambience, musicBus}`, documenté comme réservé aux bancs.
2. **`src/music.js`** — même règle pour le mod : un contexte qui a un `startRendering` n'a pas
   d'horloge à attendre. Sans cela, la musique ne se programme pas du tout en hors ligne
   (mesuré : écran titre à 0 d'crête, 39 appels d'AudioParam contre 3 711).
3. **`docs/chantier-moteur/bancs/mix/`** — `run.mjs` (lanceur Linux/CI, équivalent de `run.py`,
   qui vise le Chrome du Mac d'audit), `mixage.mjs` (le vérificateur de seuils de la fiche :
   réduction ≤ 3 dB, 0 échantillon > 0,875, pompage ≤ 4 dB, 0 voix volée, nullité ≤ −110 dB RMS
   et ≤ −80 dBFS, au moins 8 passes par scène), `job=inject` dans `mix.html`, passes répétées
   (`&passes=N`, 16 au plus) dans `job=matrix`, et le **duck mesuré par bande**
   (`out.duckBands`, énergies cumulées sous 120/250/500/1 000/2 000/4 000 Hz pendant chaque rafale
   contre la même durée juste avant).
4. **`checks/audio.test.mjs`** — un test de 50 assertions environ : contexte injecté jamais ouvert,
   relancé ni fermé, tir et mod programmés malgré l'état `suspended`, six nœuds rendus par
   `graph()`, et le contraste avec le jeu normal (qui, lui, ferme bien son contexte).

## Écarts assumés avec la fiche

- La fiche demandait `bancs/mixage.html` et `outils/mixage.py`. Le banc de mixage hors ligne
  existe déjà sous `docs/chantier-moteur/bancs/mix/` (lot 11, T0) avec ses douze emplois ;
  le vérificateur de seuils est donc `bancs/mix/mixage.mjs` et le lanceur `bancs/mix/run.mjs`,
  dans le prolongement direct de l'existant (MASTER-PROMPT §5 : « si un script échoue pour une
  raison de chemin ou d'outil absent, corrige-le ou écris l'équivalent, et dis-le »).
- `job=null` ne peut plus s'appliquer depuis LOOP-14 : ses ancres `l14a`/`l14b` ont disparu du
  source (dit noir sur blanc dans `preuves/lot-11/t0/README.md`). La nullité se prouve par
  `job=ab`, A contre A, comme l'avait fait le lot 11.
- `bench/mix/out/` (les `iso.json`, `matrix-*.json`, `null.json` de l'audit) n'est pas versé dans
  le dépôt : les chiffres de référence sont donc ceux cités dans les constats, rejoués ici.

## Reproduire

```sh
S=/tmp/mix11b; mkdir -p $S
cp -R docs/chantier-moteur/bancs/mix $S
gzip -dc docs/chantier-moteur/preuves/lot-11/t0/scenes.js.gz > $S/scenes.js   # sha256 1f066203…f9345
node $S/gen.mjs . docs/chantier-moteur/bancs/feel/doomish.mjs $S .
node docs/chantier-moteur/bancs/mix/run.mjs $S "mix.html?job=matrix&scenes=a&recipes=cur&comps=cur&ducks=cur&passes=8" 900 matrix-a-8p.json
node docs/chantier-moteur/bancs/mix/run.mjs $S "mix.html?job=iso&recipes=cur&comps=cur" 900 iso-cur.json
node docs/chantier-moteur/bancs/mix/run.mjs $S "mix.html?job=ab&scenes=c,a,t&noise=1" 900 ab-aa.json
node docs/chantier-moteur/bancs/mix/run.mjs $S "mix.html?job=attrib&reps=3" 900 attrib.json
node docs/chantier-moteur/bancs/mix/run.mjs $S "mix.html?job=inject&scenes=c,a,t" 600 inject.json
node docs/chantier-moteur/bancs/mix/mixage.mjs --passes=1 ab-aa.json inject.json
```

## Chiffres

`job=inject` — le contexte injecté rend le même mixage que l'ouverture par `AudioContext` :

| Scène | Différence crête / RMS | Appels AudioParam ouvert → injecté | Sortie crête / RMS (les deux) | Voix de pic |
|---|---|---|---|---|
| c | −138,47 / −157,84 dB | 9 485 → 9 485 | 0,737 / −21,36 dBFS | 13 |
| a | −138,47 / −162,00 dB | 7 100 → 7 100 | 0,381 / −24,77 dBFS | 4 |
| t | −138,47 / −155,90 dB | 3 711 → 3 711 | 0,358 / −19,59 dBFS | 0 |

`job=ab` A contre A (nullité, remplace `job=null`) : −132,45/−157,91 (c), −138,47/−161,21 (a),
−138,47/−156,28 (t) — sous le critère MIX-08, comme au lot 11.

`job=iso`, recettes actuelles, compresseur actuel : réduction maximale 0,00 à 0,03 dB,
0 échantillon au-dessus de 0,875 sur les cinq armes (24 contrôles, tous conformes).

`job=matrix&scenes=a`, 8 passes, recettes et chaîne actuelles : crête de sortie 0,381,
0 échantillon > 0,875, 0 voix volée, 4 voix de pic. **Pompage 9,11 dB et ondulation 9,12 dB** :
c'est le point de départ mesuré de T4 (MIX-V1), très au-dessus du seuil de 4 dB. Le duck par
bande de cette même passe plonge la musique de 5,7 dB sous 120 Hz à 8,3 dB sous 4 kHz.

`job=attrib`, 3 répétitions, médianes en ms par seconde d'audio : graphe au repos **25,95**,
sans les boucles d'ambiance **13,16**. Les six boucles coûtent donc 12,8 ms/s : c'est le point de
départ de T12 (MIX-07, cible ≤ 16 ms/s).

## Tests

`node --test checks/audio.test.mjs` : 50/50. `npm test` complet : **527 réussis, 0 échec**
(référence de départ : 526/526 ; un test ajouté, aucun enlevé, aucun affaibli).
`python3 tools/build.py` : `dist/index.html` 864 346 octets (+1 549), sha256 conforme à `SIZE.json`.
