# Preuves du lot 00 / R1 — lanceur Chrome, PNG, comparaison d'images

Constats : RCPU-V3, RGPU-11, PARA-13 (point 5), étape 0 de `ARBITRAGES.md`
(pages de différence d'images). Remplace, pour ce Mac, les outils Linux perdus
du point de reprise (`render-egl.mjs`, `render-proof.mjs`,
`tools/render/harness.mjs`). Outils : [`tools/render`](../../../../../tools/render/README.md).

Classe de preuve : état identique (outillage). `src/`, `dist/index.html` et
`SIZE.json` sont inchangés (812 696 octets, SHA-256 `4587dc49…`).

Machine : Mac M5 à 10 cœurs, Darwin 27.2.0, Node 24.18.0, Chrome
157.0.8103.39 (`@9a31f0ac…`), GPU « ANGLE (Apple, ANGLE Metal Renderer: Apple
M5, Unspecified Version) », pilote Apple 27.2.1. Machine partagée avec
d'autres agents (charge 5 à 9 pendant les mesures).

## Fichiers

| Fichier | Contenu |
|---|---|
| `self-check-a.json` | `npm run render-check -- --out … --png-dir …` : 56/56 contrôles. |
| `self-check-b.json` | `node tools/render/self-check.mjs --compare self-check-a.json` : 57/57, aucune empreinte différente. |
| `legacy-1.5.png`, `legacy-2.5.png`, `scene3d.png`, `scene3d-wide.png`, `canvas2d.png` | Rendus de la page sonde (premier lancement de `self-check-a`). |
| `diff-one-pixel-scene3d.png` | Carte de différence de `scene3d` contre elle-même avec un pixel modifié en (123, 45). |
| `banc-avant-apres.json` | Banc apparié : prototype vérifié contre le nouveau lanceur, six paires alternées. |
| `interruptions.mjs`, `interruptions.json` | Auto-contrôle interrompu huit fois (SIGINT au groupe comme Ctrl-C, SIGTERM au processus) : aucun reste. |

## Résultats

**Reproductibilité des pixels.** Mêmes SHA-256 entre deux rendus d'un même
lancement, entre deux lancements d'un même processus (profils neufs, cache de
shaders froid) et entre quatre processus (deux essais préliminaires et les
deux rapports ci-dessus) :

| Scène | Taille | SHA-256 des pixels RGBA, de haut en bas |
|---|---|---|
| `legacy-1.5` | 320×200 | `2cbf4fa047cdb23c1359ce3f84d9605a15fc73cf08ab12c28dedafec0758eae5` |
| `legacy-2.5` | 320×200 | `7c0df53b8feb70f0cf8493639cf4affa7330ac19fc0023fef0b33304891c92c7` |
| `scene3d` | 480×270 | `0e200bdb21dc1167e083d9743af889537d538a9476a4eed0453067091f027e70` |
| `scene3d-wide` | 640×360 | `c5209079995d072fb37406088cecd357b0413f76f643572f3ba4028808e48dc7` |
| `canvas2d` | 320×200 | `251dcba21b48548779a0338c2d35f26d88585f1efd3685bac752d45524faaf88` |

Chaque transfert est contrôlé par un SHA-256 calculé dans la page. Les octets
bruts de `readPixels` de la scène `legacy` (graine 1,5), qui reprend les
shaders du prototype, valent `1eb2798a…f86ffe` : la valeur du prototype.
`--dump-dom` donne les mêmes pixels que le tube pour `legacy-1.5` et
`scene3d`.

**PNG.** Encodage puis décodage identiques octet pour octet : 5 images
synthétiques × 6 filtres, et les 5 rendus. Le décodeur de Chrome relit nos PNG
à l'identique ; notre décodeur relit à l'identique le PNG produit par
`canvas.toDataURL` de Chrome. Les quatre autres types de couleur (gris, gris
et alpha, RVB, palette, avec `tRNS`) sont décodés comme attendu ; CRC faux,
fichier tronqué, 16 bits et entrelacement sont refusés.

**Comparaison.** `diffImages(a, a)` : 0 pixel différent, verdict
`identical`. Un pixel modifié d'une unité sur un canal : exactement 1 pixel
différent, rectangle (123, 45)-(123, 45), PSNR 104,0 dB, verdict
`visually-identical` ; la carte marque exactement un pixel. Un écart d'alpha
seul donne `different`, des tailles différentes `comparable: false`. Les
graines 1,5 et 2,5 donnent PSNR 13,8 dB, verdict `different`.

**Aucun port.** `lsof -n -P -a -p <tous les processus du groupe de Chrome> -i`
ne renvoie rien, dans les deux lancements de chaque rapport (11 processus) et
pour le Chrome des processus enfants des contrôles de signaux. La ligne de
commande réelle contient `--remote-debugging-pipe` et le profil jetable, et ni
`--remote-debugging-port`, ni `--remote-debugging-address`, ni
`--allow-file-access`. Un drapeau de port passé en option est refusé, une URL
`https://` aussi.

**Nettoyage.** Le profil existe pendant l'exécution et disparaît, et le groupe
de processus de Chrome avec lui, après : fermeture normale (code 0) ; erreur
levée dans `withChrome` ; délai dépassé (évaluation bloquée, rejet en
543-554 ms, Chrome tué) ; Chrome introuvable (aucun profil laissé) ; SIGINT et
SIGTERM reçus par un processus enfant (sortie par le même signal) ; exception
non rattrapée (code 1). Les huit interruptions de l'auto-contrôle entier
n'ont laissé ni profil `metal-render-*` ni processus.

**Environnement relevé.** WebGL2 par ANGLE Metal sur le vrai GPU ; 36
extensions, dont `EXT_disjoint_timer_query_webgl2`,
`KHR_parallel_shader_compile`, `EXT_color_buffer_float`, `WEBGL_multi_draw` ;
`performance.now` avance par pas de 0,1 ms (minimum et médiane) ;
`crossOriginIsolated` faux, `isSecureContext` vrai en `file://`,
`SharedArrayBuffer` absent, WebGPU présent ; `OfflineAudioContext` présent et
constructible à 48 kHz ; fenêtre d'affichage exacte (800×600,
`devicePixelRatio` 1) après `Emulation.setDeviceMetricsOverride`. Transfert
binaire par blocs vérifié sur 3 145 745 octets.

**Banc de départ et banc apparié.** Départ : le prototype `pipe-probe.mjs`
lancé deux fois donne le même SHA-256 (`1eb2798a…` pour la graine 1,5). Après
: six paires alternées, même page (celle du prototype), même travail (trois
rendus, graines 1,5, 1,5 et 2,5), même machine chargée :

| | Prototype (avant) | Nouveau lanceur (après) |
|---|---|---|
| SHA-256 identiques | 6/6, `1eb2798a…` et `34008411…` | 6/6, mêmes valeurs |
| Durée médiane d'un lancement, processus compris | 5 722 ms | 764 ms |
| Travail médian, du lancement au dernier rendu | 677 ms | 631 ms |

Rapport apparié médian : 0,13 sur la durée totale (le prototype garde une
minuterie de 5 s qui retient le processus après la fermeture) et 1,04 sur le
travail, soit une égalité dans le bruit de la machine chargée. R1 ne promettait
pas de gain de temps : le critère est la reproductibilité, tenue.

## Rejouer

```sh
npm run render-check -- --out /tmp/rendu-a.json --png-dir /tmp/rendu-png
node tools/render/self-check.mjs --out /tmp/rendu-b.json --compare /tmp/rendu-a.json
node tools/render/self-check.mjs --compare docs/chantier-moteur/preuves/lot-00/r1/self-check-a.json
node docs/chantier-moteur/preuves/lot-00/r1/interruptions.mjs /tmp/interruptions.json
```

La troisième commande compare la machine courante à ces empreintes : sur un
autre GPU, un autre pilote ou une autre version de Chrome, des empreintes
différentes sont attendues. Le banc apparié dépend du prototype de
l'orchestrateur, hors du dépôt ; ses mesures brutes sont dans
`banc-avant-apres.json`.

## Limites et vrai matériel

- Pixels d'un seul GPU (Apple M5, ANGLE Metal). À refaire sur david-pc
  (Windows, NVIDIA, `--use-angle=d3d11`) : tube sur les descripteurs 3 et 4,
  chemin de Chrome, destruction des processus sans groupe de processus,
  contrôle de sockets sans `lsof`.
- Un SIGKILL de Node ne peut rien nettoyer : Chrome se ferme de lui-même à la
  fermeture du tube (vérifié), le profil est supprimé au lancement suivant.
- La minuterie GPU `EXT_disjoint_timer_query_webgl2` est présente mais rend
  des valeurs cumulées sous ANGLE Metal (RGPU-11) ; mesurer par blocs
  d'images.
