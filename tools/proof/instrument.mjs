// Tool-only instrumentation. The release sources are never written or imported.
export const COUNTERS = Object.freeze(['ground','blocked','segmentFree','astarPops','astarNodes','revisions']);

export function replaceOnce(source, anchor, replacement, label) {
  const at = source.indexOf(anchor);
  if (at < 0 || source.indexOf(anchor, at + anchor.length) >= 0) throw new Error(`Instrumentation anchor is missing or ambiguous: ${label}`);
  return source.slice(0, at) + replacement + source.slice(at + anchor.length);
}

export function instrumentSimulation(source) {
  let text = replaceOnce(source, 'function create(world,options={}) {', 'function create(world,options={}) {\n    let __proofStats=null;', 'simulation.create');
  const initialize = '    const encounterMap=new Map(s.encounters.map(q=>[q.id,q])),enemyEncounter=new Map();';
  text = replaceOnce(text, initialize, `    __proofStats=s.aiStats; Object.assign(__proofStats,${JSON.stringify(Object.fromEntries(COUNTERS.map(key=>[key,0])))});\n${initialize}`, 'state counters');
  for (const [key, anchor] of [
    ['ground','function ground(x,z,activeTraps=trapStates){'],
    ['blocked','function blocked(x,z,r=.28,y=ground(x,z),doors=doorBoxes,staticBoxes=solids,traps=trapBoxes,height=1.8){'],
    ['segmentFree','function segmentFree(ax,az,bx,bz,r=.4){'],
  ]) text = replaceOnce(text, anchor, `${anchor}if(__proofStats)__proofStats.${key}++;`, key);
  const pop = 'const i=pop();if(routeClosed[i]===stamp)continue;routeClosed[i]=stamp;';
  text = replaceOnce(text, pop, 'const i=pop();__proofStats.astarPops++;if(routeClosed[i]===stamp)continue;routeClosed[i]=stamp;__proofStats.astarNodes++;', 'A* pops and visited nodes');
  const revision = 's.destructionRevision++;', count = text.split(revision).length - 1;
  if (count !== 2) throw new Error(`Expected two destruction revision sites; found ${count}. Audit instrumentation before measuring.`);
  text = text.replaceAll(revision, `${revision}if(__proofStats)__proofStats.revisions++;`);
  return text;
}

export function resetCounters(state) {
  for (const key of COUNTERS) {
    if (!Number.isSafeInteger(state.aiStats?.[key])) throw new Error(`Missing instrumentation counter: s.aiStats.${key}`);
    state.aiStats[key] = 0;
  }
}

export function readCounters(state) {
  return Object.fromEntries(COUNTERS.map(key=>[key,state.aiStats[key]]));
}
