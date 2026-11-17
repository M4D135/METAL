# Journal de décisions — reprise Spark 17/11/2026

1. **Ne pas toucher `main` avant qualification.** Le travail reste sur `wip/support-drone-cockpit-20261117` jusqu'au contrôle Mac et à la publication de la branche.
2. **Corriger le digest plutôt que l'asserter.** `destructionRevision` et `aiStats` sont des compteurs d'observation recalculés par `restore()` ; ils sont exclus de `digestMix` à la racine, sans retirer le contrôle de déterminisme.
3. **Annuler le hack côté simulation et shell.** La simulation expose `cancelSupportAction()` ; `game.js` nettoie les entrées et annule l'action quand le mode quitte `playing`.
4. **Garder les fragments courts entiers.** Un fragment déjà sous 1 m n'est pas éclaté par le chemin `small`; les grandes pièces restent bornées à cinq corps et environ `0,75 m` par axe.
5. **Aligner le test de porte sur le contrat actuel.** La porte détruite doit produire des pièces métalliques réelles, bornées et restaurables, sans exiger que cinq corps reconstituent le volume complet de la porte.
6. **Ne pas modifier les contrôles approuvés sans décision.** Les manques gamepad sont documentés, mais `config/default-controls.json` reste épinglé par son test.
7. **Séparer CPU et FPS.** Le banc A/B mesure uniquement le temps de simulation Node ; aucune annonce de FPS matériel n'est faite sans GPU réel.
8. **Publication prudente.** GitHub et le déploiement passent par le Mac ; l'URL servie est revérifiée par HTTPS et empreinte après bascule.
