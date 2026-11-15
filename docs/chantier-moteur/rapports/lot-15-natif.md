# Lot 15 — résolution native et cadence stable

15 novembre 2026. La décision de David du 12 novembre remplace tout calibrage automatique de l'échelle.

METAL crée le renderer en mode natif. Le détail bas/auto/haut n'abaisse plus sa résolution. L'échelle 3D est séparée (100, 85, 75, 66 ou 50 %), avec défaut 100 %. La mesure utilise device-pixel-content-box ou l'arrondi des bords CSS multipliés par le DPR. Le canvas GPU est modifié seulement au dessin. Les plafonds GPU et de sécurité sont exposés ; Canvas 2D conserve ses plafonds logiciels et accepte l'échelle manuelle. Sans l'option native, FERRO conserve son comportement antérieur.

Le gouverneur de résolution est désactivé en natif. Une vigie de 240 images expose p50, p95, dépassements et historique borné, sans changer la taille. Elle notifie une charge durable et prépare seulement le repli de cadence au chargement suivant.

Nouvelle préférence par défaut : Auto 60/30. Le chargement mesure 30 dessins synchronisés, après cinq dessins de chauffe. Un p95 de dessin sous 11,7 ms retient 60 ; sinon 30. Revenir de 30 à 60 exige moins de 9 ms. Cette marge réserve du temps à la simulation ; elle ne prouve pas que toutes les scènes de combat tiendront la cible. Les préférences forcées existantes restent conservées ; 30, 60, 120, 144 et sans limite sont accessibles. Le pas de simulation reste 60 Hz. Aucun changement de cadence ni d'échelle n'est décidé en plein combat.

Validation : 37 tests taille/détail/options passent, avec neuf formats (320×568, mobile, 1080p, Retina, 4K) et charge prolongée. Le nouveau test du secours logiciel passe aussi. Parmi les 106 tests initiaux renderer/options/checkpoint, 105 passaient ; le seul cas à 1 ms supposait encore le défaut sans limite. Il demande maintenant explicitement ce réglage et passe : visée immédiate et consommation unique sont toujours vérifiées.

Chrome : parcours complet avec calibration réelle, switch accessible, manette simulée, jetpack et trois tailles tactiles. Tampon desktop 1100×720 égal au dispositif, zéro changement en jeu. Les deux changements mobiles sont les deux rotations demandées par le banc. Le p95 synchronisé SwiftShader est 274,1 ms : cette exécution valide le repli et le comportement, pas 30 FPS sur GPU physique. Pas de mesure de gain Apple/NVIDIA ni d'essai de dix minutes sur téléphone.

La preuve Chrome porte sur SHA256 2ed326d5665da73bfc9876b6d9918c0bb0a1a5bb966f232e351b2fd2435e3866. Le build final de ce jalon est 5b92d8c4cdf6dd76c0705b65dd758cc3ed2aa49b4be1a1b9060d73253763f667 (1 098 918 octets). Les deux différences sont circonscrites aux chemins non utilisés par ce parcours WebGL natif : application de l'échelle au secours logiciel (test dédié ci-dessus), suppression de deux requêtes GL en mode historique (tests renderer). Aucun changement du chemin WebGL natif entre les deux.

Restent dans le lot15 : comparaison des branches exactes du shader et outillage GPU par passe ; variantes conditionnelles à activer seulement après bénéfice mesuré. Le calibrage ancien qui abaissait automatiquement l'échelle est écarté par décision explicite de David. Pas encore poussé ni déployé.
