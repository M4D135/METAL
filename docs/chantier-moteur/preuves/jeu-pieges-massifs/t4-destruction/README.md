# T4 — démonter une machine, sans jamais pouvoir se faire un chemin à l'arme légère

## La règle à tenir

Deux choses se contredisent si on les pose naïvement :

- le brief demande que **les pièges soient destructibles** — une explosion doit
  pouvoir démonter une machine qui barre le passage ;
- le lot 14 (règle reprise par celui-ci) demande qu'**une arme légère ne finisse
  jamais un obstacle structurel** — on ne troue pas un mur obligatoire au pistolet.

Un piège est les deux à la fois : c'est du mobilier destructible **et** c'est le
danger obligatoire du secteur. La règle retenue : **l'explosion démonte, l'arme
légère abîme sans finir.**

## Ce qui a été fait

`src/simulation.js`, dans la boucle de dégâts des pièges :

```js
t.hp = Math.max(r ? 0 : 1, (t.hp ?? 18) - power * (r ? Math.max(.2, 1 - d / r) : 1));
```

`r` est le rayon de l'explosion. `r > 0` : la structure peut descendre à 0 et la
machine tombe. `r === 0` (tir d'arme légère) : **plancher à 1 point** — la machine
se marque, se cabosse, continue de tourner.

`src/world.js` : le cadre d'une machine passe de résistance **12 à 40**, comme les
autres éléments de machinerie. Les tirs le creusent visiblement, une roquette ou
une grenade l'emporte.

## Les trois tests ajoutés

`checks/traps-mandatory.test.mjs`, sur des mondes générés, en simulant :

1. **« une explosion démonte la machine qui barre le chemin obligatoire »** —
   charges réelles posées au centre des pièces encore debout (`kind: 'grenade'`,
   `blastRadius: 4,2`, `damage: 32`, `terrainPower: 55`, les mêmes champs que le
   projectile du jeu), jusqu'à 6 charges. La coupe entière tombe.
2. **« une arme légère abîme la machine sans jamais la démonter »** — 1 200 tirs de
   mitraillette (`weapon: 0`) soutenus sur la barrière. Assertion double : aucune
   pièce détruite (`!destroyed`, `hp >= 1` pour toutes) **et** au moins une pièce
   marquée (`hp < 18`) — sinon le test passerait aussi si les tirs n'avaient aucun
   effet, ce qui serait une autre façon de mentir.
3. **« démonter les machines ne coupe aucun chemin : elles ne portent aucun collier
   solide »** — pour chaque `destructibleId` de piège, `colliders.length === 0`.

Le test 3 est celui qui protège la règle du projet (accessibilité des relais, de la
sortie et des objets). Une machine bloque par sa **boîte animée** recalculée à
chaque pas, pas par un collier physique. La détruire retire l'obstacle animé et ne
peut donc pas, non plus, en créer un nouveau ni faire disparaître un mur porteur.
C'est ce qu'on vérifie directement, au lieu de le déduire du test 1.

## Ce qui a été vérifié

- `checks/traps-mandatory.test.mjs` : **58 tests, 58 réussis, 0 échec**.
- `checks/simulation.test.mjs` : **120 tests, 120 réussis** — le niveau reste
  finissable, y compris après la règle de plancher.
- `npm test` complet : **577 tests, 577 réussis, 0 échec**.

## Ce qui n'a pas été testé

- **Le rendu de la destruction** : ce banc travaille sur l'état de simulation.
  Qu'une machine à `hp = 1` après 1 200 balles se *voie* abîmée dans le rendu n'est
  pas prouvé ici — c'est le cadre à résistance 40 et les maillages marqués qui
  s'en chargent, et cela demande un œil dans le navigateur.
- **Le son et les effets** de la destruction d'une machine : non instrumentés.
- **Le combat réel contre des ennemis poussés dans les lames** : les contacts
  piège/ennemis sont exercés par `checks/simulation.test.mjs`, mais pas le cas
  précis « une explosion d'ennemi démonte la machine qui me barrait le chemin ».
