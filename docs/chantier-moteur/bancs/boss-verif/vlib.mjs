// Chargeur indépendant : applique des remplacements de texte en mémoire (le dépôt n'est jamais modifié).
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
export function loadPatched(root, patches = {}) {
  const ctx = {window: {}, performance, console, Math, Date};
  vm.createContext(ctx);
  for (const n of ['renderer', 'world', 'destruction', 'economy', 'brain', 'simulation']) {
    let src = readFileSync(root + '/src/' + n + '.js', 'utf8');
    for (const [from, to] of patches[n] || []) {
      const k = src.split(from).length - 1;
      if (k !== 1) throw new Error(`patch ${n}: ${k} occurrences of ${from.slice(0, 60)}`);
      src = src.replace(from, to);
    }
    vm.runInContext(src, ctx, {filename: n + '.js'});
  }
  return ctx.window;
}
