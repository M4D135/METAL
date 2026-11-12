// Chargeur domaine principal (vm.runInThisContext) avec remplacements en mémoire ; dépôt jamais modifié.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
export function loadPatched(root, patches = {}, extra = []) {
  const win = {}; globalThis.window = win;
  for (const n of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation', ...extra]) {
    let src = readFileSync(root + '/src/' + n + '.js', 'utf8');
    for (const [from, to] of patches[n] || []) {
      const k = src.split(from).length - 1;
      if (k !== 1) throw new Error(`patch ${n}: ${k} occurrences of ${from.slice(0, 60)}`);
      src = src.replace(from, () => to);
    }
    vm.runInThisContext(src, {filename: n + '.js'});
  }
  return win;
}
