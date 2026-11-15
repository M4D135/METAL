# Lot 08b — commandes tactiles et menus manette

Base c31d2c5, développement Codex autorisé par David ; aucun résultat LLM Spark intégré.

- FTouch possède chaque doigt séparément : joystick flottant, zone morte, course avec hystérésis, suivi du centre, visée sur le bouton de tir, annulation sans tir résiduel. La sensibilité est calculée une fois par image ; deux flux d’événements couvrant la même distance donnent la même visée.
- Gyroscope optionnel et désactivé par défaut, permission depuis un geste, rejet des échantillons invalides ou anciens. Plein écran facultatif et verrou de veille pendant le jeu, libéré à la pause et lorsque la page est masquée.
- Réglages tactiles, portrait élargi avec projection d’arme conservée, aide à la visée réglable. Commande contextuelle dès le toucher. Le sélecteur manette avance maintenant exactement d’une option.
- Après rotation, l’ATH borne les marqueurs à la fenêtre et empêche un élément ancien d’élargir le viewport. Formats Chrome vérifiés : 390×844, 844×390, 320×568, incluant la main gauche.

Validation : 162 tests ciblés passent (checkpoint, FInput, commandes, options, premier plan, rendu et 7 tests touch/host). Chrome avec événements tactiles CDP : switch, vol maintenu, tir avec visée, joystick flottant/course/annulation, boutons ≥48 px et sans chevauchement dans les trois formats. Manette simulée : RB, A, menu et vibrations. Les fichiers receipt.json et TAP donnent les preuves exactes.

Les captures et le reçu Chrome portent l’artefact construit avant la seule tolérance `documentElement?.` ajoutée au banc DOM ; cette tolérance ne modifie pas un navigateur réel. L’artefact final est reconstruit après cette adaptation.

Limites : pas d’essai physique iPhone/Android ou manette ; permission et projection du gyroscope, veille différée/annulée testées avec hôtes factices. Les mesures Chrome SwiftShader ne sont pas une preuve de performance GPU matérielle. Le raccord de l’enregistrement, de la démo et de la cadence est traité dans les lots 07 et 13.
