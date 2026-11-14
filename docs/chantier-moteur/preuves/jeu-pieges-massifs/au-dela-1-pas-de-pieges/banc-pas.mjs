// Banc de profil du pas de simulation, pour le lot « jeu-pieges-massifs ».
// Il ne mesure qu'une chose : le coût de sim.step() sur les scénarios de preuve,
// avec les pièges du lot. Lancer avec --cpu-prof puis résumer avec
// ../../../jeu-bouclier-supprime/au-dela-1-generation/resumer-profil.mjs.
// Usage : node banc-pas.mjs [racine] [--steps 1800] [--reps 3]
import { loadRealm } from '../../../../../tools/realm-loader.mjs';
import { selectScenarios, STEP_SECONDS } from '../../../../../tools/proof/scenarios.mjs';

const args = process.argv.slice(2);
const root = args[0] && !args[0].startsWith('--') ? args[0] : '.';
const get = (name, dflt) => { const i = args.indexOf('--' + name); return i < 0 ? dflt : Number(args[i + 1]); };
const steps = get('steps', 1800), reps = get('reps', 3);
const { window } = loadRealm({ root, modules: ['fmath', 'passages', 'renderer', 'world', 'destruction', 'economy', 'brain', 'simulation'] });
const { FWorld, FSimulation, FBrain } = window;

let totalSteps = 0;
for (const scenario of selectScenarios('all')) {
  for (let pass = 0; pass < reps; pass++) {
    const world = FWorld.create(scenario.seed ?? 96, scenario.index, scenario.options);
    const sim = FSimulation.create(world, { brain: FBrain.create({ mode: 'cpu' }), armorSystem: true });
    for (let i = 0; i < steps; i++) sim.step(STEP_SECONDS, { moveX: .4, moveY: .2, weapon: 0, fire: i % 6 === 0 });
    sim.dispose?.();
    totalSteps += steps;
  }
}
console.log('pas simulés :', totalSteps, '— mondes :', selectScenarios('all').length * reps);
