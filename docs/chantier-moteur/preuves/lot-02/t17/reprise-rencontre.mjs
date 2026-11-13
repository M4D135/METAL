// Lot 02 / T17, constat annexe (hors SIM-13) : point de reprise refusé après une rencontre vidée à distance.
// Campagne V2, monde 1 (nouvelle expédition) : le joueur reste au point d'apparition, hors de la zone
// de encounter-1 (marge de 8 m de inEncounter), et abat au pistolet de départ ses 3 membres, déjà
// déployés à la création. Le jeu (events() de src/game.js) prend un point de reprise sur encounterClear.
// Le visé se fait en orientant le joueur vers la cible, comme le ferait la souris ; aucun patch du
// calcul. Une seconde passe charge un patch qui note seulement la pile de l'exigence refusée.
// usage (depuis la racine du dépôt) : node $W reprise-rencontre.mjs <racine> [<racine>…]
import {loadRealm} from '../../../../../tools/realm-loader.mjs';
import {buildScenario} from '../../../../../tools/proof/scenarios.mjs';
const roots=process.argv.slice(2).length?process.argv.slice(2):['.'];
const spec={id:'campaign2-w1',index:0,options:{campaign:true,campaignVersion:2}},ENC='encounter-1';

function play(L,root){
  const r=buildScenario(L,spec),sim=r.sim,s=sim.state,p=s.player,q=s.encounters.find(c=>c.id===ENC),ids=q.waves.flatMap(w=>w.enemyIds),t=q.trigger;
  const inside=m=>Math.abs(p.x-t.x)<=t.w/2+m&&Math.abs(p.z-t.z)<=t.d/2+m&&Math.abs(p.y-(t.y||0))<2.2;
  const input={moveX:0,moveY:0,sprint:false,fire:false,lookX:0,lookY:0};
  const check=label=>{const text=JSON.stringify(sim.snapshot()),e=JSON.parse(text).state.encounters.find(c=>c.id===ENC);L.window.__t17RestoreError=null;
    const r2=buildScenario(L,spec),ok=r2.sim.restore(JSON.parse(text));r2.dispose();
    const stack=L.window.__t17RestoreError||'',start=L.sourceRanges.simulation.startLine,at=[...stack.matchAll(/proof-main-variant\.js:(\d+):(\d+)/g)].map(m=>`${+m[1]-start+1}:${m[2]}`);
    return {label,step:n,encounter:{status:e.status,wave:e.wave,pendingWave:e.pendingWave},released:ids.filter(i=>s.enemies[i].encounterReleased).length,restore:ok,...(at.length?{failingCheck:'src/simulation.js:'+(at[1]||at[0])}:{})};};
  const deployedAtCreate=ids.filter(i=>s.enemies[i].deployed!==false).length;
  let n=0,everInside=false,clearedAt=null,firstKill=null,shots=0,hits=0;const checks=[check('création')];
  for(;n<7200;n++){
    const alive=ids.map(i=>s.enemies[i]).filter(e=>e.hp>0&&e.deployed!==false);
    if(alive.length){const e=alive.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0],dx=e.x-p.x,dy=e.y-(p.y+1.62),dz=e.z-p.z;
      p.yaw=Math.atan2(dx,-dz);p.pitch=Math.atan2(dy,Math.hypot(dx,dz));input.fire=n%2===0;}else input.fire=false;
    sim.step(1/60,input);everInside||=inside(8);
    let clearNow=false,killNow=false;
    for(const ev of s.events){if(ev.name==='shot')shots++;if(ev.name==='hit')hits++;if(ev.name==='kill')killNow=true;if(ev.name==='encounterClear'&&ev.id===ENC)clearNow=true;}
    s.events.length=0;
    if(killNow&&firstKill===null){firstKill=n;checks.push(check('après le premier mort'));}
    if(clearNow){clearedAt=n;checks.push(check('encounterClear (point de reprise du jeu)'));break;}
    if(s.dead)break;
  }
  input.fire=false;for(let i=0;i<1800&&!s.dead;i++,n++){sim.step(1/60,input);s.events.length=0;}
  checks.push(check('1 800 pas plus tard'));
  const out={root,world:spec.id,encounter:ENC,members:ids.length,deployedAtCreate,trigger:{distanceFromSpawnM:+Math.hypot(t.x-r.world.spawn.x,t.z-r.world.spawn.z).toFixed(1)},
    playerMovedM:+Math.hypot(p.x-r.world.spawn.x,p.z-r.world.spawn.z).toFixed(2),everInsideTriggerPlus8m:everInside,shots,hits,kills:s.kills,firstKill,clearedAt,dead:s.dead,checks};
  r.dispose();return out;
}
const results=[];
for(const root of roots){
  const plain=play(loadRealm({root}),root);
  const traced=play(loadRealm({root,patches:{simulation:[['}catch(_){return false;}','}catch(_){window.__t17RestoreError=_&&_.stack;return false;}']]}}),root);
  const same=JSON.stringify(plain.checks.map(c=>[c.step,c.restore]))===JSON.stringify(traced.checks.map(c=>[c.step,c.restore]));
  results.push({...traced,tracePatchNeutral:same&&plain.clearedAt===traced.clearedAt&&plain.shots===traced.shots});
}
console.log(JSON.stringify(results,null,1));
