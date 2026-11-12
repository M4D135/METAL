# Préflight lot 01 — MURS-V1

Le [master de la PR #2, commit `6a17e08281b70feae33015d7059ef21717666ba3`](https://github.com/M4D135/METAL/blob/6a17e08281b70feae33015d7059ef21717666ba3/docs/chantier-moteur/MASTER-PROMPT.md) demande de traiter d’abord les huit tests historiques signalés rouges sur le Mac d’audit. **Ils passent tous ici sur les deux révisions historiques examinées ; la suite main intacte passe 422/422.**

| Référence | Contrôle exécuté | Résultat |
| --- | --- | --- |
| Parent `79e6e35703ec84193491f36ea44f87fa910b3847` | Les huit tests ciblés | 8/8, zéro échec |
| Version 0.8.0 `673d6b2b80026103b4523fb0b3b16fb708556b06` | Les huit tests ciblés | 8/8, zéro échec |
| Main intact `63668aca7045e62cd524973b226f21e9ec5703e8` | `npm test` complet | 422/422, zéro échec |

Environnement des contrôles historiques : **Linux x86-64, Node 24.22.1**. Il ne s’agit pas du Mac arm64 / Node 24.18 de l’audit. Les deux journaux ciblés et leurs empreintes sont dans [le manifeste](manifest.json) ; la [suite main](../../lot-00/baseline-main-tests.log.gz) est déjà archivée avec les preuves du lot 00 et n’est pas dupliquée.

## Commande ciblée

Depuis chaque copie des sources historiques correspondantes :

```sh
node --test --test-reporter=tap --test-name-pattern='exact pre-campaign|strictly opt-in|first three campaign' checks/campaign-world.test.mjs
```

Elle couvre les six empreintes de mondes classiques (graines 1 et 96, secteurs 0–2), l’activation explicite du mode campagne et la préservation de la géométrie historique des trois premiers mondes de campagne.

## Vérification de la cause proposée

`src/world.js` et `checks/campaign-world.test.mjs` de main sont identiques octet pour octet aux fichiers extraits du commit 0.8.0 `673d6b2`. Les six valeurs de `legacyHashes` sont identiques dans le parent `79e6e35`, dans `673d6b2` et dans main. Les tailles, SHA-256 et identifiants de blobs historiques figurent au manifeste.

La lecture du générateur 0.8.0 montre que le chemin de retrait des panneaux et l’appel à `openEntries` sont conditionnés par `w.campaignVersion===2`. La géométrie historique est donc explicitement conservée dans ce code ; ces huit contrôles la retrouvent ici.

**L’attribution des huit échecs au retrait des murs n’est pas confirmée par ces preuves.** Les échecs signalés sur macOS arm64 ne sont ni reproduits ni expliqués. Aucune empreinte n’a été régénérée, aucun test affaibli et aucun correctif de `world.js` n’est nécessaire sur les observations acquises. Ce verdict ne prétend pas résoudre le résultat du Mac d’audit.
