# Lot 11b / T8 — Duck proportionnel au volume des effets (MIX-V2)

Constat : MIX-V2 (ajout du contre-vérificateur). Classe : **meilleure**.
Une ligne dans `src/audio.js`, à l'endroit même que cite la fiche (`:141` en 0.8.0).

## Le correctif

`duckMusic()` calculait la profondeur du caniveau sans regarder le volume des effets :
à 20 % d'effets, la musique plongeait toujours de toute sa profondeur pour des tirs
presque inaudibles. La formule de la fiche est appliquée telle quelle :

```js
strength = 1 − (1 − strength) × min(1, cueLevel × 1,25) × min(1, mix.effects)
```

Le facteur `min(1, mix.effects)` vaut **exactement 1** au défaut (`options.js` :
`effectsVolume: 1`), donc à réglage courant le rendu reste identique bit à bit.

## Reproduire

```sh
node docs/chantier-moteur/bancs/mix/run.mjs <banc-verif> "verif.html?job=fxvol" 600 fxvol.json
```

Scène (p) « cadences nominales », `duckMinDb` = minimum du gain appliqué à la musique
pendant toute la scène, en dB.

## Chiffres — avant (HEAD du lot, `95408f3`) et après, même page, même graine

| Volume des effets | `duckMinDb` avant | `duckMinDb` après | RMS des effets (inchangé) |
|---:|---:|---:|---:|
| 1 (défaut) | −9,12 dB | **−9,12 dB** | −33,79 dBFS |
| 0,5 | −9,12 dB | **−3,41 dB** | −39,81 dBFS |
| 0,2 | −9,12 dB | **−1,21 dB** | −47,77 dBFS |
| 0,05 | −9,12 dB | **−0,29 dB** | −59,81 dBFS |

Le RMS et la crête des effets ne bougent pas d'un centième : seul le caniveau change.
À effets = 0 la musique ne plonge plus du tout (test Node).

## Écart assumé avec le chiffre de la fiche

La fiche attend « à 1 reste −6,94 dB ». **−6,94 dB est la profondeur du duck de la v0.2**
(20·log₁₀0,45 = −6,94). Depuis le lot 11, la branche porte la profondeur FEEL-07 de
0,35, soit 20·log₁₀0,35 = **−9,12 dB**, et c'est bien ce que rend le banc avant comme
après ce correctif : la comparaison avant/après à effets = 1 est donc à 0,00 dB d'écart.
Les valeurs intermédiaires suivent la formule de la fiche ; la fiche arrondissait
(−3,0 / −1,0 dB attendus, −3,41 / −1,21 dB mesurés avec la profondeur 0,35 de la branche).

## Ce qui n'est pas fait ici

- Le point de rupture (autre projet de David) a sa copie de ce code : la fiche demande de
  le reporter **via FERRO**, hors de ce dépôt. Noté, non fait.
- Les tests `:352` et `:372` de `checks/audio.test.mjs` cités en garde-fou tournent à
  effets = 1 : ils passent sans modification.

## Tests et taille

`node --test checks/audio.test.mjs` : 52/52 (un test ajouté, 7 assertions).
`npm test` : **529 réussis, 0 échec** (référence 526/526).
`dist/index.html` : 867 483 → **867 749 octets** (+266), sha256 conforme à `SIZE.json`.
