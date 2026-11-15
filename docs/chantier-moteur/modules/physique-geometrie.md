# FPhysicsGeometry — complément de géométrie

Charger `physics-geometry.js` avant `physics.js`, puis créer le monde avec `FPhysics.create({...config, geometry:true})`. METAL active cette option pour les nouvelles expéditions. Les anciens points restaurés conservent leur géométrie. L’empreinte du nouveau monde se termine par `/G1`.

## Capsule continue

```js
const hit = {};
world.sweepCapsule([x, yPieds, z], [dx, dy, dz], {
  radius: .28, height: 1.8, skin: .001,
  mask: 65535, ignore: 0, statics: true
}, hit);
```

Le déplacement est balayé en entier. `height` inclut les deux calottes et doit valoir au moins deux rayons. Les vecteurs ont trois nombres finis. La requête ne modifie pas le monde.

Le résultat contient `hit`, `fraction` (0 à 1), `handle` pour un corps ou `staticIndex` pour une surface fixe, `depth`, la normale `nx/ny/nz` et le point de contact `x/y/z`. Le point est significatif seulement si `hit` vaut vrai. La couche 1 désigne les statiques. Les corps supprimés, perdus et en attente sont exclus.

`ignoreInitial:true` ignore les objets déjà recouverts au départ ; METAL l’utilise uniquement pour chercher un appui sous les pieds. `allowExit:true` permet de sortir d’un recouvrement initial sans s’enfoncer dans sa normale. Les deux options valent faux par défaut.

## Déplacement de personnage

```js
const controller = world.character({radius:.28, height:1.8, step:.42, slope:.7});
const result = controller.move([x,yPieds,z], [dx,dy,dz], {});
```

`step` est la hauteur maximale de marche ; `slope` est le cosinus minimal d’une normale d’appui. Le résultat fournit la position `x/y/z`, `grounded`, le corps d’appui `handle`, la normale et sa vitesse linéaire `vx/vy/vz`. L’appel glisse le long des parois, traite les recouvrements et vérifie le plafond avant de monter. Il n’ajoute ni gravité, ni saut, ni déplacement automatique avec la plateforme : l’hôte fournit le déplacement voulu. METAL garde son locomoteur et utilise directement les requêtes de capsule sur les objets physiques.

## Raccords et budget

`setStatics` fusionne seulement les unions exactement rectangulaires de même matériau, friction et restitution. Les raccords partiels sont masqués, avec conservation des marches et trous. Après une modification, les raccords inchangés sont remappés ; seuls les nouveaux volumes sont comparés. Les voisins retirés rendent leur bord exposé. La fusion et l’index spatial conservent une reconstruction globale.

Avec `bounded:true`, le gouverneur peut endormir les îles lentes soutenues par un contact. `stats.governedSleep` cumule ces endormissements. `stats.overBudget` compte l’excédent inévitable lorsque les corps encore actifs ne peuvent être endormis sans figer leur chute. Ce mécanisme ne promet pas un plafond strict de tous les réveils.
