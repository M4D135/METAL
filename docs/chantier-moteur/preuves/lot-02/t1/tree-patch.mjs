// Lot 02 / T1 : variante B du banc du lot (bancs/sim/ab2.mjs, chargeur du domaine principal).
// Le banc charge A depuis METAL_ROOT (code d'avant) et B = A + correctifs : ici, un seul
// correctif remplace la simulation entière par celle de cet arbre. Les autres modules sources
// sont identiques entre les deux racines (à vérifier par git diff avant chaque mesure).
// usage : METAL_ROOT=<racine-avant> REPS=2 STEPS=300 node docs/chantier-moteur/bancs/sim/ab2.mjs \
//           ../../preuves/lot-02/t1/tree-patch.mjs treeSimulation
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {source} from '../../../bancs/sim/lib.mjs';
export function treeSimulation(){
  const root=fileURLToPath(new URL('../../../../../',import.meta.url)),before=source('simulation'),after=readFileSync(root+'src/simulation.js','utf8');
  if(before===after)throw new Error('METAL_ROOT porte déjà la simulation de cet arbre');
  return {simulation:[[before,after]]};
}
