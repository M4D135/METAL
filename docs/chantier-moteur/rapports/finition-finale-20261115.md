# Finition intégrée du 15 novembre 2026

Base déjà poussée : `cd198ae`, après `18083d8` (combat) et `02afc51` (démo). Cette livraison raccorde les fonctionnalités au jeu complet ; elle ne transforme pas les objectifs expérimentaux de toutes les fiches en garanties matérielles.

## Changements livrés

- Deux opérateurs persistants, switch T/RB/bouton visible, jetpack léger, explosifs lourds, passages et boss exigeant la bonne classe, repère de l’autre personnage. Commandes tactiles dans les coins, tir avec visée, course, menus et options au pad. ATH desktop compact ; notification mobile limitée à son texte.
- Physique des accessoires, grenades, épaves et articulations. Les grandes plaques se fragmentent au lieu de reboucher une brèche. Une révision de destruction ne réveille que les corps voisins de la zone changée ; les autres accessoires restent au repos.
- Murs, murets, supports épais et relief résistent aux balles ; les explosifs les ouvrent. Sols et verrous de coopération restent protégés. Étincelles/son de matière, viseur de ricochet, 32 marques au maximum, indice limité à deux apparitions par session. Les sources de dégâts environnementaux alimentent l’indicateur directionnel.
- Reflets : double sonde 256², une face par image, activation après six faces, invalidation immédiate à la destruction ; rugosité et flaques. SSR à la résolution native, bord progressif et repli sonde, historique borné. Options Éteints / Scène locale / Scène locale + écran ; mobile éteint par défaut. Aucune image importée.
- Navigation préparée dans le worker du monde puis adoptée après vérification d’identité et des colonnes typées ; repli principal identique. Chargement de simulation et rendu séparés par une image, bouton de retour au menu, restauration directe du monde courant après décès. La reprise initiale préserve les métadonnées d’équipement d’entrée.
- Format physique final v2 : corps, articulations, locomotion et deux profils. Lecture des points v1 historiques et du v1 physique intermédiaire ; les campagnes sans physique restent sans physique à leur reprise. Rejets atomiques des données incohérentes.
- Pilote de démo corrigé : franchissement des gravats, vol au-dessus des pièges et jusqu’au relais, récupération du carburant. Ses actions passent par les entrées ordinaires, sans invulnérabilité ni modification des PV.

## Preuves

- Suite complète : **1 213 réussites, zéro échec, un TODO historique**. Les 97 régressions ciblées passent également.
- T5 final : **34 processus neufs**, 18 mondes, cinq répétitions des mondes d'indices 0, 1, 2 et 17. Maximum de première casse **4,703 ms CPU**, maximum de tout pas **7,731 ms CPU** ; aucun pas à 8 ms ou plus. Sources lues et exécutées identiques. Ce contrôle clôt la revalidation du lot 03s sur cet assemblage.
- Endurance : **30 minutes simulées / 108 000 pas / 13 scènes**, zéro mort, stagnation ou exception ; pas p99 **0,566 ms**, maximum **5,351 ms**. La pensée du pilote atteint **2,129 ms**, donc le seuil absolu de 2 ms n'est pas déclaré satisfait.
- Chrome natif : **13 contrôles** du jeu final, navigation préparée effectivement adoptée, switch visible, RB, jetpack A maintenu, repère du partenaire, sauvegarde des deux classes, tactile aux formats 390×844, 844×390 et 320×568. Cibles de 48 pixels minimum, pas de chevauchement des commandes, aucune exception. Calibration 30 images à 1100×720 : p95 **10,4 ms**, sélection Auto 60, résolution native.
- Reflets : mode éteint identique pixel par pixel au chemin sans module ; sonde et SSR produisent une différence mesurée, aucune erreur GL, destruction invalidée immédiatement puis capture complète. Scène contrôlée 640×360, médianes de cinq répétitions GPU : référence **1,095 ms**, éteint **1,129 ms**, sonde **1,496 ms**, écran **2,714 ms**. Ce n'est pas une mesure de FPS du jeu complet.
- Page autonome : **1 373 769 octets bruts**, 431 688 octets gzip, aucune ressource externe ; navigateur exclu. SHA256 `c9c53bd7db725dc90a9bea68715f8e113e23ef10b0ad4f2dc241d03a9e53fdba`.

Les reçus accompagnant ce rapport sont sous `../preuves/finition-finale-20261115/`. Le manifeste JSON relie les fichiers, leurs tailles et SHA256. Le contrôle de 900 pas de navigation et le rejeu physique de 100 secondes comparent les états exacts. Le banc T5 emploie Node 24.18, le domaine principal, des processus neufs, aucune transformation de source et aucun échauffement artificiel. Les durées CPU du thread sont distinguées du temps mural.

Les captures Chrome utilisent le GPU natif Apple M5 via ANGLE Metal. Le pad est simulé et le tactile injecté dans Chrome : ces contrôles prouvent le raccord des commandes et la disposition, pas une séance avec une manette ou un téléphone physique. La démo d’endurance est une simulation accélérée ; elle ne mesure pas les FPS.

Les essais rejetés restent conservés. Une première série sur une version intermédiaire a un pic de première casse à 9,248 ms. Le réveil local et la règle de protection des sols ont ensuite changé la simulation : les nouvelles mesures ne constituent donc pas un gain apparié à état identique face à cette série.

## Qualification encore ouverte et options non activées

- Un ancien test TODO de glissement d’un cube sur pente reste ouvert. Le contrôleur joueur utilise les collisions du jeu et les requêtes physiques ; un module générique complet de balayage capsule, la fusion locale de statiques et un plafond strict de tous les réveils ne sont pas livrés.
- Les seuils absolus des fiches (allocation de rendu 0,2 Mo, zéro allocation partout, chaque pensée du pilote <2 ms, chaque événement <8/16 ms dans toute charge, croissance mémoire <0,5 Mo) ne sont pas tous démontrés. T5 désigne les scénarios et la machine documentés, pas une garantie universelle.
- Les variantes GPU conditionnelles sans preuve suffisante restent désactivées, dont `ggxgate`. Le lot 18 photo/WebGPU/NVIDIA complet n’est pas livré : ses budgets, son contrat d’image et les essais RTX 5090/5060 ne sont pas qualifiés. Il ne faut pas le marquer terminé dans l’inventaire.
- Essais sur manette, téléphone réel, Safari, Firefox et PC NVIDIA, écoute audio et campagne humaine complète restent à faire. Aucun résultat de ces appareils n’est inventé.

La simulation principale reste sur la page : les variantes de transfert intégral vers un worker, conditionnelles dans la fiche 07, ne sont pas activées. La compilation asynchrone de tous les programmes, l’ensemble des microbudgets de polissage et les extensions physiques ci-dessus restent des travaux distincts du jeu fonctionnel publié.
