# Rapport — lot « jeu-pieges-massifs »

Branche `chantier/jeu-pieges-massifs`, base du lot `1814b81558d7e3e6a80cbb8fcbbe3ccdee81cef4`.
La consigne de référence est `.relais/BRIEF.md` ; aucune fiche `lots/lot-*` ne couvre
ce lot. La règle de destruction reprise ici est celle du lot 14 (arme légère ≠ fin
d'un obstacle structurel).

Référence de tests au départ : **510 tests, 510 passés, 0 échec**
(`.relais/npm-test-base.log`). Résultat final : **577 tests, 577 passés, 0 échec**
(`.relais/npm-test-final.log`).

| Tâche | État | Commit | Chiffre avant → après | Preuves |
| --- | --- | --- | --- | --- |
| T1 brique `FPassages` | faite | `1f60b61` | 510 → 519 tests (+9 dédiés) | `docs/chantier-moteur/preuves/jeu-pieges-massifs/t1-passage/` |
| T2 pièges sur le chemin obligatoire | faite | `d004d3a` | banc : **27 échecs → 55/55** ; 3 pièges en cour → barrières sur le couloir | `…/t2-chemin-obligatoire/` |
| T3 densité, dégâts, lisibilité | faite | `d207bc1` | 3 → **30 à 42 machines** ; lame 18 → 26, presse 24 → 34, pics 18 → 24 | `…/t3-densite/` |
| T4 destruction | faite | `afcabea` | 55 → **58 tests** ; arme légère : destruction possible → **impossible** | `…/t4-destruction/` |
| Au-delà 1 — pas des machines | faite | `e366203` | médiane appariée **−2,3 % à −10,3 %**, `identical: true` | `…/au-dela-1-pas-de-pieges/` |
| Au-delà 2 — `FPassages` à la génération | **écartée** | rien | **0,35 %** de la génération (103 ms / 29 029 ms) | chiffres dans `…/au-dela-1-pas-de-pieges/` |

## T1 — `FPassages`, la brique des passages obligatoires

`src/passages.js`, nouveau module, lit `window.FMath` au chargement comme
`src/world.js` et refuse de démarrer sans lui. Sept entrées : `grid`, `flood`,
`reaches`, `cuts`, `nearestFree`, `mandatoryLinks`, `tourLinks`.

- `mandatoryLinks` : les liens dont la suppression **déconnecte** un objectif
  (relais, sortie, objets) du chemin du joueur. C'est la définition operative de
  « obligatoire » — pas une distance, pas une intuition.
- `tourLinks` : les liens dont le retrait ne déconnecte rien mais allonge la
  tournée. Utiles pour densifier, jamais au prix d'un couloir sans alternative.
- `cuts` renvoie les points d'articulation ; `nearestFree` garantit qu'une machine
  posée ne tombe jamais sur un point de passage bloqué.

Deux pièges de plate-forme ont été corrigés sous banc, pas à l'aveugle :

1. `Math.hypot` de l'hôte est interdit pendant la génération (`checks/fmath.test.mjs`
   installe un `Math` qui le refuse) : la brique utilise `FMath.hypot2`.
2. `world.js` lisait `window.FPassages` au moment de `create()`. Or
   `checks/checkpoint.test.mjs` (LOAD-01) pose `window` le temps d'exécuter les
   modules puis le retire : la création plantait. `FPassages` est capté au
   chargement, à la ligne suivante de `FMath`.

Le module est branché partout où `world.js` est chargé : `tools/build.py`,
`tools/realm-loader.mjs`, `tools/platform-math.mjs`, `tools/campaign-profiles.mjs`,
`tools/boss-profiles.mjs`, `tools/gen-ab.mjs`, et les bancs qui listent les modules.

## T2 — plus aucun piège décoratif

Sur la base, le banc `checks/traps-mandatory.test.mjs` compte **27 échecs** sur les
mondes de référence : les pièges étaient posés dans des cours, à côté du chemin,
jamais dessus. Un secteur se traversait sans jamais rencontrer une machine.

Après T2, chaque barrière est posée **sur un lien obligatoire** calculé par
`FPassages`, et le banc passe **55/55** : le flood depuis le départ ne peut plus
atteindre la sortie sans croiser la batterie. Une barrière est un lot solidaire —
deux lames au moins, une presse pleine largeur, des pics — et non trois objets
éparpillés.

## T3 — le piège devient le danger du secteur

- **Densité** : la tournée gloutonne s'ajoute aux liens obligatoires → 6 à 7 coupes
  par secteur, **30 à 42 machines** par monde (3 sur la base).
- **Ordre d'implantation** : les liens vraiment obligatoires d'abord, la tournée
  ensuite. Sans cet ordre, le plafond de 40 machines pouvait évincer le seul couloir
  sans alternative au profit d'un couloir de confort.
- **Dégâts** : lame 18 → 26, presse 24 → 34, pics 18 → 24.
- **Lisibilité de loin** : lampe émissive sur chaque montant, deux barres d'alerte
  au-dessus du cadre, posées **hors du centre** pour laisser le ciel ouvert au point
  de circulation.

### Le défaut que le lot s'est trouvé lui-même

Des lames synchrones dans le même axe formaient un **mur continu** : le test
« A real generated level can be completed using navigation and ordinary
collision-respecting movement » a échoué. Ce n'était pas le bot qui était faux,
c'était le piège — une rangée synchrone ne laisse aucun instant où passer. Les lames
glissent désormais perpendiculairement au couloir, par intervalles, à phase décalée.
L'union des courses barre toujours le couloir sur toute sa largeur, mais on peut
passer.

Le bot de navigation a été rendu physiquement honnête en parallèle : il attend la
pièce qui barre sa case, fuit celle qui passe sur lui, fait un pas de côté s'il est
bloqué. **Aucun piège n'a été diminué pour le faire passer** — ni dégâts, ni course,
ni cadence.

## T4 — l'explosion démonte, l'arme légère abîme

```js
t.hp = Math.max(r ? 0 : 1, (t.hp ?? 18) - power * (r ? Math.max(.2, 1 - d / r) : 1));
```

Avec `r` rayon d'explosion : une charge peut mettre la structure à 0 ; un tir d'arme
légère ne descend jamais sous **1 point de structure**. Le cadre passe de résistance
12 à 40. Trois tests : une grenade réelle démonte la coupe ; 1 200 tirs de
mitraillette l'usent sans la détruire **et** marquent au moins une pièce (sinon le
test validerait aussi bien des tirs sans effet) ; et chaque groupe destructible de
piège porte **0 collier solide** — donc les détruire ne peut couper aucun chemin.

## Au-delà — mesuré, chiffré, et une piste écartée

Profil du pas (21 600 pas, `--cpu-prof`) : `updateEnvironment` 5,1 % + `trapPose`
3,1 %, soit **8 % du pas** imputables aux machines — le plafond de la piste. Deux
changements sans effet sur l'état : la requête spatiale n'est due qu'en course
(`hot || warning`), et la boîte de repos n'est plus recalculée ni reallocuée.

A/B apparié `tools/ab2.mjs`, `identical: true` sur les deux runs : **2,3 % à 10,3 %**
de gain de médiane appariée, positif dans les huit mesures. La moyenne est écartée
comme non fiable ici : dominée par des pics de ramasse-miettes (`maxUs` jusqu'à
62 ms pour un pas de 200 µs). Le gain n'atteint pas 5 % partout ; il est gardé parce
qu'il est réel, déterministe et dans le sens attendu, pas parce qu'il franchit un seuil.

Pour situer : contre la base du lot (3 machines par secteur), le pas avait coûté
**+14 % à +36 %** après la densification. Cette optimisation en rend une partie.

**Piste écartée** : `FPassages` à la génération, mesurée en enrobant les deux points
d'entrée appelés par `world.js` sur 360 mondes chronométrés → **0,35 %**
(103 ms / 29 029 ms). Rien à y gagner de mesurable ; `src/passages.js` n'est pas
touché.

## Ce qui reste à voir sur un appareil réel

- **La lisibilité du piège de loin** : les lampes et les barres d'alerte sont
  prouvées en géométrie et en portée, pas jugées à l'œil sur téléphone.
- **Le rendu visible d'une machine à 1 point de structure** : le banc travaille sur
  l'état de simulation.
- **Le son et les effets** de la destruction d'une machine : non instrumentés.
- **Le combat réel** : « une explosion d'ennemi démonte la machine qui me barrait le
  chemin » n'est pas exercé.

## Mesures et autorité de taille

`SIZE.json` est l'autorité de mesure. Bundle final : **858 218 octets bruts**,
**264 166 octets compressés** (`gzip_bytes`). Le chiffre annoncé au lecteur est le
chiffre **brut** ; le compressé n'est jamais présenté comme la taille du fichier. Le
navigateur n'est pas compté dans cette taille — un comparatif avec un exécutable
natif doit le rappeler.
