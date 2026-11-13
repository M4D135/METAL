// Enveloppes de chronométrage en mémoire autour de fonctions internes de simulation.js (le dépôt n'est pas modifié).
export function timerPatches(names) {
  return names.map(n => [`function ${n}(`, `function ${n}(...__a){const __t=performance.now();const __r=__${n}(...__a);const T=(G.__T||={});T['${n}']=(T['${n}']||0)+performance.now()-__t;return __r;}\n    function __${n}(`]);
}
