# METAL 0.12.7 : qualification du dépôt public

Sources de départ : b1dfdea97f21432141130842558b278081a9dd91.

Huit échecs hérités portaient sur les anciennes touches R/C et des tables de test historiques construites avec les défauts modernes. Les attentes sont corrigées, sans suppression de test. Les tests génériques FERRO v2 conservent leur ancien contrat indépendant.

Suite complète npm test : {"tests": 1334, "pass": 1333, "fail": 0, "todo": 1} ; construction autonome et tests de distribution réussis. Verrou FERRO : 34 modules exacts.

Chrome headless : 14 vérifications réussies ; moteur de rendu webgl2. Real headless Chrome, offline standalone game; no hardware FPS claim.

Contrôles navigateur :
- R view / C dodge defaults
- versioned preferences
- heavy starts active
- R switches view once despite repeat
- C dodge does not switch view
- drone descent is held
- release clears drone descent
- view rebind persists
- rebind leaves dodge unchanged
- conflict is reported
- conflict preserves prior key
- keyboard reset restores R/C
- HUD key labels follow reset
- no uncaught page exception

HTML : 13654927 octets bruts ; gzip : 3207461 ; SHA-256 : `d73ac92359e5f565b951761196e8ba559c32c9eef20479bba656f6bccbb517c3`.

Exécution : https://github.com/M4D135/METAL/actions/runs/44038257244

Ce lot livre les corrections caméra et clavier, pas le strafe-jump Quake III ni le vol quaternion 6DOF. Aucun gain FPS global, aucune validation manette physique ou téléphone réel revendiqués. Aucun hébergement externe n’est modifié.
