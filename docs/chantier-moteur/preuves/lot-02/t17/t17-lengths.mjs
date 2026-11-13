// Lot 02 / T17 (SIM-13) : longueurs des tableaux de l'état sur une longue partie.
// (1) bornes : N pas (10 000 par défaut) sur 6 mondes, pilote de tools/proof/scenarios.mjs,
//     sim.state.events vidé après chaque pas comme events() de src/game.js. hp remis à 100
//     sous 40 pour tenir la durée : la sonde mesure des bornes, elle ne prouve pas un état.
//     eventsTotal = somme des événements par pas = ce que garderait un hôte qui ne vide jamais.
// (2) vidage neutre : mêmes N pas sur 2 mondes, avec et sans vidage ; chaîne d'empreintes
//     (tools/proof/digest.mjs, champ events exclu) et SHA-256 de l'instantané final.
// (3) butin par le vrai chemin de dégâts : 39 mondes (3 classiques, 18 campagne V1, 18 campagne V2),
//     M pas (1 800 par défaut) ; tous les ennemis déployés sont tués toutes les 30 étapes, puis une
//     passe de plus. Les réserves que ce pilote ne fait pas entrer ne meurent pas : ce n'est pas une
//     saturation de l'effectif, dont la borne se lit dans le code (README). damageEnemy n'est exposée
//     qu'en mémoire, pour cette sonde (patch de chargement) ; src/ n'est pas modifié.
//     Puis instantané -> JSON -> restore dans une simulation neuve.
// usage (depuis la racine du dépôt) : node $W t17-lengths.mjs <racine> [N] [M]
import {loadRealm} from '../../../../../tools/realm-loader.mjs';
import {buildScenario,makeInput,drive,selectScenarios} from '../../../../../tools/proof/scenarios.mjs';
import {stateDigest,chainDigest,hex} from '../../../../../tools/proof/digest.mjs';
import {createHash} from 'node:crypto';
const [root='.',stepsArg='10000',killArg='1800']=process.argv.slice(2),N=+stepsArg,M=+killArg;
const WORLDS='legacy-s0,legacy-s2,campaign-w10,campaign-w16,campaign2-w1,campaign2-w10';
const KEYS=['loot','debris','particles','projectiles','explosions','bullets','bossAttacks','events'];
const weaponOf=sc=>sc.id==='legacy-s2'?2:undefined,sha=t=>createHash('sha256').update(t).digest('hex').slice(0,16);
const L=loadRealm({root});

function bounds(sc){
  const r=buildScenario(L,sc),s=r.sim.state,input=makeInput(weaponOf(sc)),max={rubble:0,chips:0};for(const k of KEYS)max[k]=0;
  let n=0,total=0;
  for(let i=0;i<N;i++){
    drive(i,input,s);if(s.player.hp<40)s.player.hp=100;r.sim.step(1/60,input);n++;
    let rubble=0;for(const q of s.debris)if(q.structural)rubble++;
    max.rubble=Math.max(max.rubble,rubble);max.chips=Math.max(max.chips,s.debris.length-rubble);
    for(const k of KEYS)max[k]=Math.max(max[k],(s[k]||[]).length);
    total+=s.events.length;s.events.length=0;if(s.dead||s.won)break;
  }
  const out={id:sc.id,roster:r.world.enemies.length,steps:n,kills:s.kills,max,eventsTotal:total,
    final:{loot:s.loot.length,debris:s.debris.length,particles:s.particles.length,projectiles:s.projectiles.length,bullets:s.bullets.length}};
  r.dispose();return out;
}

const NONE=Object.freeze([]);
function chain(sc,clear){
  const r=buildScenario(L,sc),s=r.sim.state,input=makeInput(weaponOf(sc));let c=0,n=0;
  for(let i=0;i<N;i++){
    drive(i,input,s);if(s.player.hp<40)s.player.hp=100;r.sim.step(1/60,input);n++;
    c=chainDigest(c,stateDigest({...s,events:NONE}));if(clear)s.events.length=0;if(s.dead||s.won)break;
  }
  const out={steps:n,chain:hex(c),snapshot:sha(JSON.stringify(r.sim.snapshot())),eventsHeld:s.events.length};
  r.dispose();return out;
}

// Deux patches en mémoire, pour (3) seulement : exposer damageEnemy, et noter la pile de l'exigence
// qui refuse un instantané (restore renvoie false sans dire pourquoi). Aucun ne change le calcul.
const ANCHOR='return {state:s,get destruction()';
const LP=loadRealm({root,patches:{simulation:[[ANCHOR,'return {t17DamageEnemy:damageEnemy,state:s,get destruction()'],
  ['}catch(_){return false;}','}catch(_){window.__t17RestoreError=_&&_.stack;return false;}']]}});
const START=LP.sourceRanges.simulation.startLine;
const failingCheck=()=>{const stack=LP.window.__t17RestoreError||'',at=[...stack.matchAll(/proof-main-variant\.js:(\d+):(\d+)/g)].map(m=>`${+m[1]-START+1}:${m[2]}`);return at[1]||at[0]||null;};
function killPath(spec){
  const r=buildScenario(LP,spec),s=r.sim.state,kill=r.sim.t17DamageEnemy,input=makeInput(),roster=r.world.enemies.length;
  const pass=()=>{for(const e of s.enemies)if(e.hp>0&&e.deployed!==false)kill(e,1e9,{x:e.x,y:e.y,z:e.z,credit:false});};
  const max={loot:0,explosions:0,particles:0,eventsPerStep:0};let n=0;
  for(let i=0;i<M;i++){
    if(i%30===0)pass();
    drive(i,input,s);if(s.player.hp<40)s.player.hp=100;r.sim.step(1/60,input);n++;
    max.loot=Math.max(max.loot,s.loot.length);max.explosions=Math.max(max.explosions,s.explosions.length);
    max.particles=Math.max(max.particles,s.particles.length);max.eventsPerStep=Math.max(max.eventsPerStep,s.events.length);
    s.events.length=0;if(s.dead||s.won)break;
  }
  pass();const repeat=s.loot.length;pass();s.events.length=0;
  const text=JSON.stringify(r.sim.snapshot()),snap=JSON.parse(text),lootBytes=snap.state.loot?Buffer.byteLength(JSON.stringify(snap.state.loot)):0;
  LP.window.__t17RestoreError=null;
  const r2=buildScenario(LP,spec),ok=r2.sim.restore(JSON.parse(text)),restored=r2.sim.state.loot.length;
  // Rencontres vidées alors qu'aucune vague n'était encore active (voir README, constat annexe).
  const clearedIdle=snap.state.encounters?snap.state.encounters.filter(q=>q.status==='cleared'&&q.wave===-1&&q.pendingWave===-1).map(q=>q.id):[];
  const out={id:spec.id,roster,steps:n,kills:s.kills,loot:s.loot.length,uniqueSources:new Set(s.loot.map(q=>q.sourceEnemy)).size,
    repeatAdds:s.loot.length-repeat,max,snapshotBytes:Buffer.byteLength(text),lootBytes,restore:ok,restoredLoot:ok?restored:null,
    ...(ok?{}:{failingCheck:'src/simulation.js:'+failingCheck(),clearedIdle})};
  r.dispose();r2.dispose();return out;
}

const report={probe:'lot-02/t17 SIM-13',root,steps:N,killPathSteps:M,worlds:WORLDS.split(','),bounds:[],clearing:[],killPath:[]};
for(const sc of selectScenarios(WORLDS)){const b=bounds(sc);report.bounds.push(b);console.error(JSON.stringify(b));}
for(const sc of selectScenarios('legacy-s2,campaign2-w10')){
  const cleared=chain(sc,true),kept=chain(sc,false);
  const c={id:sc.id,identical:cleared.chain===kept.chain&&cleared.snapshot===kept.snapshot&&cleared.steps===kept.steps,cleared,kept};
  report.clearing.push(c);console.error(JSON.stringify(c));
}
const specs=[...[0,1,2].map(i=>({id:'classic-s'+i,index:i,options:null})),
  ...Array.from({length:18},(_,i)=>({id:'campaign-w'+(i+1),index:i,options:{campaign:true}})),
  ...Array.from({length:18},(_,i)=>({id:'campaign2-w'+(i+1),index:i,options:{campaign:true,campaignVersion:2}}))];
for(const spec of specs){const q=killPath(spec);report.killPath.push(q);console.error(JSON.stringify(q));}
const sat=report.killPath;
report.summary={
  bounds:Object.fromEntries([...KEYS,'rubble','chips'].map(k=>[k,Math.max(...report.bounds.map(b=>b.max[k]))])),
  eventsTotal:Object.fromEntries(report.bounds.map(b=>[b.id,b.eventsTotal])),
  clearingNeutral:report.clearing.every(c=>c.identical),
  rosterMax:Math.max(...sat.map(q=>q.roster)),
  rosters:Object.fromEntries(['classic-','campaign-','campaign2-'].map(p=>{const v=sat.filter(q=>q.id.startsWith(p)).map(q=>q.roster);return [p.slice(0,-1),[Math.min(...v),Math.max(...v)]];})),
  lootMax:Math.max(...sat.map(q=>q.loot)),
  lootWithinRoster:sat.every(q=>q.loot<=q.roster&&q.loot<=q.kills&&q.uniqueSources===q.loot&&q.repeatAdds===0),
  restoreOk:sat.filter(q=>q.restore&&q.restoredLoot===q.loot).length+'/'+sat.length,
  restoreRefused:sat.filter(q=>!q.restore).map(q=>`${q.id} ${q.failingCheck} ${q.clearedIdle.join('+')}`),
  explosionsMax:Math.max(...sat.map(q=>q.max.explosions)),
  particlesMax:Math.max(...sat.map(q=>q.max.particles)),
  eventsPerStepMax:Math.max(...sat.map(q=>q.max.eventsPerStep)),
  lootBytesMax:Math.max(...sat.map(q=>q.lootBytes)),
  lootBytesPerEntryMax:Math.round(Math.max(...sat.filter(q=>q.loot).map(q=>q.lootBytes/q.loot))),
  lootShareMax:+Math.max(...sat.map(q=>q.lootBytes/q.snapshotBytes)).toFixed(4),
};
console.log(JSON.stringify(report));
