# T2 — Sortie du bouclier de la couche audio

## Ce qui a été retiré

| Fichier | Retiré |
| --- | --- |
| `src/audio.js` | cues `shieldRaise`, `shieldBlock` (et sa variante `shieldBreak`), `shieldBash` ; retraits dans la table de ducking de la musique (`shieldBlock\|shieldBash` du groupe 0,45, `shieldRaise` du groupe 0,68) et dans la liste de réservation prioritaire `urgent` |
| `src/soundscape.js` | `shield`, `shieldBash`, `shieldBlock` retirés du jeu des sources « personnelles » (celles que le tracker rattache au joueur) |

Aucun cue ajouté, aucune autre table modifiée. Les sons restent synthétisés par le code : aucun fichier
audio importé, aucune dépendance.

## Preuve d'inventaire

```
node docs/chantier-moteur/preuves/jeu-bouclier-supprime/t2-audio/inventaire-cues.mjs <base> . > inventaire-cues.txt
```

Sortie consignée dans `inventaire-cues.txt` (base `35c654a` contre arbre courant) :

| Module | Avant | Après | Retirés | Ajoutés |
| --- | --- | --- | --- | --- |
| `src/audio.js` (fonctions de cue) | 61 | 58 | `shieldRaise`, `shieldBlock`, `shieldBash` | aucun |
| `src/soundscape.js` (sources personnelles) | 11 | 8 | `shield`, `shieldBash`, `shieldBlock` | aucun |

Lignes `shield` restantes dans les deux modules : **0** (8 → 0 dans `audio.js`, 1 → 0 dans `soundscape.js`).
Les deux expressions régulières (`strength` du ducking et `urgent` des réservations) sont recopiées avant /
après dans le fichier de sortie, pour vérifier qu'aucun autre nom n'a disparu avec elles.

## Vérifications exécutées

`checks/audio.test.mjs` : **34 tests, 34 passés**.

- deux tests qui décrivaient les cues du bouclier ont été **réécrits**, pas supprimés :
  - « melee, mechanism, ammunition and grenade cues stay short, deduplicated and silent outside play »
    reprend la même mécanique (nombre de voix par cue, durée < 0,8 s, partage du cooldown sur doublon,
    ducking sous 0,56, silence effets coupés / muet / hors jeu, libération des voix au `dispose`) avec les
    cues restants ; le contrôle « silencieux hors jeu » n'est exercé que sur les cues qui possèdent réellement
    la garde `!playing && !preview` (`rocket`, `grenade`, `grenadeLaunch`) ;
  - « a grenade launch and a real melee hit keep the player reservation during an explosion storm » remplace
    le blocage de bouclier par un coup de crosse réel, et vérifie toujours la réservation du joueur pendant
    l'orage d'explosions (`voices ≤ 48`, voix locales `≤ 28`) ;
- un test ajoute la vérification d'absence : « no shield cue survives in the audio API, the ducking table or
  the local source tracker » — les noms `shield`, `shieldRaise`, `shieldBlock`, `shieldBreak`, `shieldBash`,
  `guard` sont `undefined` sur l'API, les cues restants sonnent toujours, et le texte des deux modules ne
  contient plus `shield` ;
- les clés de trophée `shield` utilisées par le test de la fanfare sont devenues `smg` (la fanfare ne dépend
  pas de la clé, c'est le calendrier de découverte qui a changé).

Suite complète : `npm test` → **505 tests, 505 passés, 0 échec**.

## Ce qui reste à vérifier hors simulation

Aucune écoute humaine ni périphérique réel : le banc stubbe `AudioContext` et vérifie la planification des
voix, les gains et la propriété des nœuds. Le rendu subjectif des cues restants après suppression des trois
cues du bouclier (notamment la densité du ducking pendant un combat rapproché) demande une écoute sur
appareil.
