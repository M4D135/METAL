# Lot 11b / T10 — Le contexte audio s'endort au repos (MIX-V4)

Constat : MIX-V4. Classe : **identique** (rien ne change à l'oreille). Dépend de T7 et T8,
tous deux livrés.

## Ce qui est livré

`src/audio.js` — FERRO, générique :

```js
FAudio.setIdle(bool)
```

À `true`, un minuteur de **1,5 s** laisse les queues trainantes s'éteindre, puis
`ctx.suspend()`. À `false`, le minuteur est annulé et `resume()` réveille le contexte.
`start()` **est** `resume()`, et `testMix()` appelle `resume()` : aucun des deux ne laisse
jamais le contexte endormi. `stats.idle` dit l'état. Le `resume()` existant traite déjà
`'suspended'` **et `'interrupted'`** — c'est le chemin de Safari iOS que la fiche demandait
de ne pas oublier.

`src/game.js` — METAL : `audioGate()` calcule une seule fois si la scène est audible
(`muted || document.hidden || !windowFocused || !audibleScene`) et en déduit **les deux** :
`setMuted(gated)` et `setIdle(gated)`. Le menu sans musique de titre, la pause, l'onglet
caché, la fenêtre sans focus et le son coupé endorment donc le contexte ; `visibilitychange`
passe déjà par `audioGate()`, donc l'onglet caché met en veille.

## Reproduire

```sh
node docs/chantier-moteur/bancs/mix/run.mjs $V "verif.html?job=idle" 120 idle.json
node docs/chantier-moteur/bancs/mix/run.mjs $V "verif.html?job=long&n=16&scene=c&recipe=metal&duck=cur" 1500 long.json
```

`job=idle` est nouveau dans le banc de contre-vérification : il crée un **vrai**
`AudioContext` (pas le contexte hors ligne du banc), et lit l'état sur
`api.graph().master.context`. Le lanceur ajoute `--autoplay-policy=no-user-gesture-required`
pour ce seul job — sans ce drapeau, Chrome garde tout contexte créé sans geste à
`'suspended'`, et la mesure ne voudrait rien dire.

## Critères de la fiche

`idle.json`, Chrome 151 sans interface :

| moment | `ctx.state` | `stats.idle` |
|---|---|---|
| en jeu, après `start()` | `running` | false |
| **2 s après `setIdle(true)`** | **`suspended`** | true |
| après `setIdle(false)` | **`running` en 5 ms** | false |
| repos interrompu à 800 ms | `running` (jamais endormi) | false |

« `ctx.state === 'suspended'` après 2 s en menu » : **tenu**. « `running` en moins de
100 ms au retour » : **tenu, 5 ms**. Et un repos interrompu avant l'échéance ne suspend
rien — le minuteur est annulé, jamais la file de lecture.

`long.json`, scène (c) rejouée 16 fois, **483,5 s** de son, recettes et options réelles de
METAL :

| minute | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ms par seconde d'audio | 38,03 | 32,61 | 29,55 | 37,03 | 33,75 | 34,40 | 35,41 | 34,03 |
| tas JS (Mo) | 17,36 | 17,36 | 17,36 | 17,36 | 17,36 | 17,36 | 17,36 | 17,36 |

**Coût stable sur 8 minutes** (34,03 à la dernière minute contre 38,03 à la première,
aucune dérive), **tas plat**, **0 voix restante** à la fin (`stats.voices`), 0 voix volée,
pic de 13 voix.

## Ce qui n'est PAS livré : le mode démo

La fiche demande aussi, côté METAL : « mode `demo` hors liste muette `game.js:71` ;
entrée démo `setMix({effects: effectsVolume×0,4})`, morceau varié (T7) ; sortie : mixage
restauré ».

**Ce mode n'existe pas dans le jeu et n'a pas été créé.** `game.js` ne connaît que
`menu, options, playing, paused, shop, loading, dead, cleared, complete` ; il n'y a aucun
mode attract ni boucle de démonstration à sortir de la liste muette. Deux raisons à ne pas
l'inventer ici :

1. Le garde-fou de la fiche — « pas d'`audio.start()` automatique sans geste » — interdit
   précisément le déclencheur évident d'un mode démo (démarrer seul après N secondes
   d'inactivité). Le jeu ne joue déjà le morceau du titre qu'après un geste
   (`titleGesture`), et un mode démo devrait obéir à la même règle, ce qui en fait un choix
   de design d'interaction, pas un réglage de mixage.
2. La fiche elle-même pose le niveau des effets en démo comme une **décision à confirmer
   par David** (« valeur par défaut proposée : ×0,4 (−8 dB) »). Rien n'est livré qui fixe
   ce niveau.

Le contrat d'entrée/sortie reste donc à écrire avec le mode lui-même : `setMix({effects:
prefs.effectsVolume * 0.4})` à l'entrée, restauration à la sortie, et `setStage(stage,
graine)` pour le morceau varié de T7 — les trois briques existent et sont testées
(`setMix`, `setStage(value, seed)`, `setIdle`). **Décision rendue : mode démo non livré,
renvoyé à la création du mode attract ; la mise en veille, elle, est livrée et mesurée.**

## Tests et taille

`node --test checks/audio.test.mjs` : 56 → **57 tests, 57 réussis**. Le test nouveau
vérifie que l'état reste `running` tant que l'échéance de 1,5 s n'est pas atteinte, que le
contexte est `suspended` après 1,6 s de repos, que `setIdle(false)` le réveille par la
promesse de `resume()`, qu'un repos interrompu à 1 s ne suspend jamais, et que ni `start()`
ni `testMix()` ne laissent le contexte endormi. Le faux contexte implémente maintenant
`suspend()`.

`npm test` : **536 réussis, 0 échec** (référence de départ 526/526).
`dist/index.html` : 876 156 → **877 468 octets** (+1 312), sha256 conforme à `SIZE.json`.

## Attend du vrai matériel

Trois choses que le rendu hors ligne et Chrome sans interface ne prouvent pas :

- le comportement réel sur **Safari iOS**, où un contexte peut passer à `'interrupted'`
  (appel entrant, Siri) : le chemin existe dans `resume()` mais n'a pas été testé sur
  l'appareil ;
- que la mise en veille ne provoque **pas de clic audible** au réveil, sur les haut-parleurs
  du portable ;
- le gain réel d'autonomie sur téléphone, qui est la raison d'être de la tâche.
