# Validation — Lot 11b (Mixage complet)

Branche `chantier/lot-11b-mixage`. Rapport :
`docs/chantier-moteur/rapports/lot-11b-mixage.md`. Preuves :
`docs/chantier-moteur/preuves/lot-11b-mixage/{t2,t3,t4,t5,t6,t7,t8,t10,t12,absorbes}/`.

Page de ce qui a **réellement** été exécuté sur cette machine, de ce qui ne l'a pas été, et
de ce qui reste à juger par un humain ou par un autre lot.

## Environnement des vérifications

Linux arm64 (DGX Spark, 20 cœurs), Node 24.18, Python 3.12 (uniquement `tools/build.py`),
Chrome **151** en `--headless=new --mute-audio`, **un seul Chrome à la fois**. Aucun réseau.
Toutes les mesures audio viennent du banc `docs/chantier-moteur/bancs/mix` en
`OfflineAudioContext` 48 kHz, lancé par `run.mjs` (lanceur Linux ajouté en T2, équivalent du
`run.py` du Mac d'audit). Les mesures de variation musicale (`musicvar.mjs`) tournent sous
Node dans `node:vm`.

**Provenance** : toutes les preuves committées dans ce lot ont été produites sur **ce**
Spark sous HeadlessChrome **151**, sauf mention. Aucune preuve n'a été recopiée du Mac
d'audit sous Chrome 157. Les comparaisons avant/après sont faites sur des **arbres de
travail détachés** du commit parent, avec la **même page, la même graine et le même
`scenes.js`** (sha256 `1f066203…f9345`, restauré de `preuves/lot-11/t0/scenes.js.gz`).

## Testé, et comment

| Ce qui est vérifié | Comment | Résultat |
|---|---|---|
| Non-régression | `npm test`, à chaque tâche | **536 réussis, 0 échec** (référence de départ 526/526) |
| Moteur audio seul | `node --test checks/audio.test.mjs` | 57/57 |
| Sons du décor | `node --test checks/soundscape.test.mjs` | 6/6 |
| Musique | `node --test checks/music.test.mjs` | 16/16 |
| Rendu hors ligne du vrai graphe | `FAudio.create({context})`, `api.graph()` (T2) | mix identique à l'ouverture par `AudioContext`, six nœuds exposés |
| Seuil du vérificateur | `mixage.mjs` sur la matrice d'acceptation | 112 contrôles, 104 conformes, 8 hors seuil — un seul contrôle, le pompage MIX-03 |
| Armes contre musique | `job=matrix`, 4 scènes × **8 passes**, 32 rendus | transitoire p10 13,22 à 16,74 dB ; 90e centile 12,2 à 16,0 dB ; 0 échantillon > 0,875 ; réduction tir isolé ≤ 1,33 dB ; 0 voix volée |
| Duck et ondulation | `job=matrix`, `job=fxvol` | ondulation pistolet 6,32 → 0,08 dB ; duck −9,12 dB à effets 1, −0,29 dB à effets 0,05 |
| Rattrapage annoncé | `job=calib` | écart mesuré/annoncé **0,000 dB** sur six réglages ; 3,73 → 3,53 dB avec le préréglage |
| Coût au repos | `job=attrib`, scène (c) | 22,56 / 24,60 → **10,65 / 11,31 ms/s** (cible ≤ 16) |
| Nullité d'un changement | `job=ab` (A contre A, et avant contre après) | A/A −136,60 et −124,71 dBFS RMS ; avant/après T12 −55,18 et −66,26 (phase des boucles, prévu par la fiche) |
| Mise en veille | `job=idle`, **vrai** `AudioContext` | `running` → `suspended` à 2 s → `running` en **5 ms** ; jamais endormi si interrompu à 800 ms |
| Tenue sur la durée | `job=long`, 483,5 s de scène (c) | 38,03 → 34,03 ms/s sans dérive, tas plat 17,36 Mo, **0 voix restante** |
| Variation musicale | `musicvar.mjs` + test Node | boucle 460,8 / 271,1 / 317,8 s ; **aucune** fenêtre de 2, 4 ni 8 positions répétée ; module sans graine **identique au sha256** |
| Préparation découpée | `load13.mjs` | 64 tampons, `tamponsDifferents: 0`, `modulesIdentiques: true`, `−Infinity` |
| Annonce du boss | `job=tell`, scène (d), 5 annonces | −50,0/−50,3 → **−31,65/−31,68 dBFS** ; au niveau des autres effets (−0,44 dB) |
| Taille et intégrité | `python3 tools/build.py`, `SIZE.json` | 877 468 octets bruts, sha256 vérifié, **0 actif externe** |

## Vérifié en mesure, **pas** en jeu

Rien de ce lot n'a été joué dans le jeu. Les mesures portent sur le **graphe audio réel**
(mêmes recettes, mêmes options, même `scenes.js`), rendu hors ligne, mais :

- aucune partie n'a été lancée avec ces réglages ;
- aucune des scènes n'a été entendue ;
- le mode démo de T10 n'existe pas, donc son mixage n'a pas pu être mesuré en situation ;
- les annonces `bossRoar`, `bossImpact`, `bossPhase` ne sont émises par aucune trame du
  banc : leur plancher et leur caniveau sont testés à l'unité, pas mesurés dans le mixage ;
- les 16 ennemis actifs ne sont pas rendus (la scène (b) vaut 6 tireurs) ; le `job=stress`
  à 18 tireurs du banc de contre-vérification n'a pas été relancé.

## Non testé — attend un vrai appareil ou un humain

1. **L'écoute.** C'est le point qui pèse le plus : la fiche conditionnait T1, T5 et l'option
   MIX-03 à l'écoute de quatre extraits, et elle demandait l'écoute de l'annonce du boss (T6)
   et des silences du 3e canal (T7). **Aucune oreille humaine n'a entendu quoi que ce soit de
   ce lot.**
2. **Safari iOS** : le chemin `'interrupted'` de `resume()` est en place mais non testé sur
   l'appareil.
3. **Clic audible au réveil** du contexte (T10) sur haut-parleurs de portable.
4. **Autonomie réelle** sur téléphone, raison d'être de T10.
5. **Réserve sous le genou** : 0,68 dB sur 6 minutes d'après l'audit avec le préréglage de
   T5 ; non revérifié sur 6 minutes ici (la matrice fait 8 passes de 30 s).

## Points à trancher par David

| point | défaut appliqué | ce que ça laisse ouvert |
|---|---|---|
| Écoute A/B des quatre extraits (T1, T5, MIX-03) | intégration faite sans écoute | si l'écoute dit le contraire, T5 (armes +3 dB) est le réglage à discuter en premier |
| MIX-03, duck en étagère | **non livré** | le pompage reste à 9,12 dB contre la cible de 4 ; le banc le rend (`ducks=shelf`) |
| Mode démo et niveau des effets en démo | **non livré** | le mode attract reste à créer ; ×0,4 (−8 dB) est à trancher avec lui |
| T6 : mixage sans le dessin sonore de BOSS-04 | **livré partiel** | critère « −3 dB sous la musique » ouvert ; les ~4,9 dB restants sont la bande 500 Hz–2,5 kHz |
| T7 : nombre de cycles de variation | **5 cycles** (48 positions) | le commentaire du prototype de l'audit comptait faux ; si l'on veut plus long, une constante |
| T12 : nullité non bit à bit | accepté, prévu par la fiche | différence de phase de boucles de bruit à −52 dBFS ; à valider à l'écoute |

## Ce qui a été corrigé en cours de route, et dit

- `job=null` du banc est **mort depuis l'intégration de LOOP-14** (ses variantes `loop14`
  patchent des ancres disparues). Toutes les nullités de ce lot passent par `job=ab`.
- Le prototype `musicvar.mjs` de l'audit annonçait « 5 cycles (48 positions) » alors que sa
  boucle poussait 6 positions par cycle ; l'ordre écrit en compte 8. La fiche est respectée
  à la lettre et retrouve la plage annoncée.
- Quatre tests audio et un test de sons du décor ont été **adaptés** aux comportements
  changés exprès (tenues du duck, compresseur du préréglage, boucles débranchées), chaque
  fois dans le commit qui change le comportement, jamais en catimini.
- Le faux contexte du test n'implémentait pas `disconnect(cible)` ni `suspend()` ; il le fait
  maintenant, conformément à Web Audio.
