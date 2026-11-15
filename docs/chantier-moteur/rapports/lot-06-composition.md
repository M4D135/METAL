# Lot 06 — composition commune et précision

METAL active `composition:true,dither:true` dans FERRO. Le ciel, le monde, les particules et l'arme reçoivent désormais la même vignette réglable, le même voile de dégâts, la même onde et la même luminosité, une seule fois lors de la composition. Le filtre CSS de luminosité et les voiles DOM sont réservés au secours Canvas. Couper le bloom conserve la composition des effets en une passe simple.

La cible de scène utilise RGB10_A2, toujours à 32 bits par pixel, avec repli RGBA8 si le framebuffer est incomplet. Le tramage final est borné à un demi-niveau avant quantification ; celui de FSky est alors coupé pour ne pas le doubler. Si aucune cible ne peut être créée, les programmes du monde, du ciel et des particules appliquent les mêmes effets directement.

FSky fournit le masque du soleil dans l'alpha. Les opaques écrivent 1 ; les particules conservent la couverture par mélange alpha séparé. L'extraction du bloom utilise ce masque : les nuages et le fond de ciel ne deviennent plus une nappe lumineuse. Le module FSky lui-même reste inchangé.

Les options nouvelles restent désactivées par défaut dans FERRO ; sans `composition`, le chemin hérité est conservé. La résolution native, les dimensions physiques et le choix de cadence ne changent pas.

## Preuves

`tools/proof/lot06/composition-chrome.mjs DOSSIER`, avec `METAL_RENDER_ANGLE=metal` sur Mac ou SwiftShader par défaut, vérifie la même scène en 512 × 288 :

- Formule des effets comparée sur les 442 368 canaux RGB : **écart maximal 1 niveau**, aucun au-delà de la tolérance de 2. Le ciel, les solides, la fumée et une arme sont présents.
- Échec volontaire de toutes les cibles : chemin direct fonctionnel, **écart maximal 1 niveau**, aucune erreur WebGL.
- Refus du format 10 bits seulement : repli 8 bits fonctionnel, **écart maximal 1 niveau**.
- Tramage activé : **écart maximal 1 niveau**, plus de 100 000 canaux effectivement modifiés.
- Bloom activé face au ciel, dos au soleil : **zéro octet changé**.

Ces résultats sont obtenus sur Apple M5 / ANGLE Metal et sur SwiftShader. Ils démontrent le rendu, pas une cadence de jeu. Les captures ont été relues ; les commandes mobiles restent dans les coins, le changement léger/lourd et le repère du partenaire restent visibles.

49 tests ciblés renderer/options/surface passent. La suite complète a produit 1 061 réussites et un échec dans son faux WebGL, qui ignorait les nouvelles constantes et méthodes. Le faux contexte a été complété en ajoutant les constantes en fin de liste, sans renuméroter les anciennes ; les 11 tests constructeur/bancs relancés passent. Les sorties initiales et corrigées sont conservées, sans présenter la première suite comme entièrement verte. Le build vérifié contient **1 152 172 octets**, zéro asset externe, SHA-256 `542adec6c0f2078a9dfe1d353c18038cf9c65bbec7fae2b71c274f0023cfa8e0`.

Le reçu Chrome du jeu couvre également le profilage, la pause et l'arsenal figés, les classes, le clavier, la manette simulée, les contrôles tactiles et les rotations. La validation complète de livraison sera rejouée après le reste du programme.
