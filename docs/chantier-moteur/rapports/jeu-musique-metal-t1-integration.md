# Musique adaptative — intégration de la brique T1, 15 novembre 2026

Source : commit audio2 `4a6e445083532a9bd95e8624070e2a6930979fb0`. Intégration sur la base `c28ebda`, sans modifier la voie audio2 encore active.

`FImuse` fournit un transport déterministe par mesures, des couches verticales selon l'intensité et des transitions horizontales écrites. Il ne connaît ni le jeu ni une horloge réelle. Le module est inclus dans la page autonome après music.js. Aucun appel FImuse.create dans game.js/music.js/audio.js : **la musique adaptative du jeu n'est pas encore raccordée** et le lot jeu-musique-metal n'est pas déclaré terminé.

Trois défauts de la brique proposée ont été corrigés avant intégration :
- Une partition vide, précédemment acceptée par validate puis cause de TypeError, est refusée explicitement.
- Les segments, tableaux de couches et transitions sont copiés pour qu'une mutation du descripteur hôte ne change pas le transport déjà créé.
- Les nombres de mesures doivent être des entiers finis positifs ; Infinity, NaN, zéro, nombres négatifs et fractions sont refusés.

Preuves discriminantes : les deux premiers tests ajoutés échouent sur la source initiale (15/17), puis passent (17/17). Le cas paramétré de mesures invalides échoue ensuite (17/18) et passe après la dernière correction (18/18). Sources et SHA dans preuves/jeu-musique-metal/t1-integration/review-result.json ; les preuves originales t1 restent historiques.

Validation de l'assemblage exact : **npm test 828/828**, zéro échec, build et git diff --check réussis. Les suites FInput et FImuse sont toutes deux inscrites dans npm test ; FPassages et audio-recipes restent chargés. Chrome/SwiftShader : FImuse est présent ; classic-rubble et campaign2-rubble reprennent en playing avec40débris structurels chacune, empreintes attendues, stockage inchangé, aucune erreurJS.

Page : 894568octets bruts, 276067gzip, zéro asset externe, SHA256 `54cbaa87312e7406b57a5a19d5770496e10371665853efab290ae6aa5ee4d5d4`. Le navigateur est exclu de la taille. Version0.9.2 inchangée. Pas de nouvelle mesure GPU, de manette physique ou d'écoute humaine. Les bancs de coût originaux ne prouvent pas le coût de la future musique raccordée.

Journaux complets et reçu sur Spark : `/home/m4d135/work/codex-metal-pilotage-20261115/imuse-integration`. Aucun GitHub push ni déploiement ; intégration uniquement dans le dépôt nu local du chantier.
