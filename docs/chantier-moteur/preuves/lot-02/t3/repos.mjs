// Lot 02 / T3 (LOAD-05 point 1) : coût des gravats au repos, avant contre arbre, apparié.
// Même scène que le banc LOAD-05 (load-verif2/v05 et v05b) : huit murs démolis à la roquette,
// une marche armée de 1 800 pas, puis 600 pas de repos. A (avant) et B (arbre) sont chargés
// dans le domaine principal par tools/realm-loader et avancent en lockstep avec les mêmes
// entrées ; l'empreinte d'état (tools/proof/digest) est comparée à chaque pas, et le SHA-256 du
// snapshot à la fin de chaque phase. Mesure : blocs de 150 pas de repos, l'ordre AB/BA alterne
// d'un bloc à l'autre ; performance.now autour de sim.step et, par une sonde identique posée des
// deux côtés, autour de l'appel updateDebris(dt). On rend les médianes et la médiane des ratios
// B/A bloc par bloc (première paire écartée, chauffe).
// usage : node repos.mjs <racine avant> <racine arbre> [blocs=12] [l:0,c:9,...]
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [prevArg,treeArg,blocksArg='12',specsArg='l:0,l:2,c:9']=process.argv.slice(2);
if(!prevArg||!treeArg){console.error('usage: node repos.mjs <racine avant> <racine arbre> [blocs=12] [l:0,c:9,...]');process.exit(2);}
const prev=resolve(prevArg),tree=resolve(treeArg),BLOCKS=+blocksArg,PER=150;
const {loadRealm}=await import(pathToFileURL(tree+'/tools/realm-loader.mjs'));
const {stateDigest}=await import(pathToFileURL(tree+'/tools/proof/digest.mjs'));
const probe=[['      updateDebris(dt);\n','      {const __t=performance.now();updateDebris(dt);__X.ms+=performance.now()-__t;}\n']];
const XA={ms:0},XB={ms:0};
const A=loadRealm({root:prev,patches:{simulation:probe},globals:{__X:XA}}).window,B=loadRealm({root:tree,patches:{simulation:probe},globals:{__X:XB}}).window;
const med=a=>{const s=a.slice().sort((p,q)=>p-q),n=s.length;return n%2?s[n>>1]:(s[n/2-1]+s[n/2])/2;},r3=x=>+x.toFixed(3);
const sha=sim=>createHash('sha256').update(JSON.stringify(sim.snapshot())).digest('hex');
const rows=[];let allSame=true;
for(const spec of specsArg.split(',')){
  const campaign=spec.startsWith('c:'),index=+spec.split(':')[1];
  const make=W=>{const world=campaign?W.FWorld.create(96,index,{campaign:true,campaignVersion:2}):W.FWorld.create(96,index);
    const o={brain:W.FBrain.create({mode:'cpu'}),armorSystem:true,inventory:campaign?{weapons:[true,true,true,true,true],ammo:[180,36,12,16,1],shield:false}:{weapons:[true,true,true,true],ammo:[180,36,12,16],shield:false}};
    if(campaign){o.campaign={version:2,discovered:['pistol','smg','shotgun','grenade','rocket'],claimedBossRewards:[]};o.equipment={right:2,left:null,shieldEnergy:100};}
    return {world,sim:W.FSimulation.create(world,o),brain:o.brain};};
  const a=make(A),b=make(B),pair=[a,b];let same=true,steps=0;
  const step=input=>{for(const x of pair){x.sim.step(1/60,{...input});x.sim.state.events.length=0;x.sim.state.dead=false;}steps++;if(stateDigest(a.sim.state)!==stateDigest(b.sim.state))same=false;};
  const both=f=>{for(const x of pair)f(x.sim.state);};
  const walls=[];
  for(const g of a.world.destructibles.filter(g=>g.kind==='wall'&&g.colliders.length)){const box=g.bounds,cx=(box.minX+box.maxX)/2,cz=(box.minZ+box.maxZ)/2,thinX=box.maxX-box.minX<box.maxZ-box.minZ;
    for(const sign of [-1,1]){const nx=thinX?sign:0,nz=thinX?0:sign,x=cx+nx*7,z=cz+nz*7,y=a.sim.ground(x,z);if(!Number.isFinite(y)||Math.abs(y-box.minY)>.1||a.sim.blocked(x,z,.28))continue;const hit=a.sim.ray([x,y+1.62,z],[-nx,0,-nz],9);if(hit<6||hit>7.4)continue;walls.push({x,y,z,yaw:Math.atan2(-nx,nz),cx,cz});break;}}
  const far=walls.filter((w,i)=>walls.findIndex(q=>Math.hypot(q.cx-w.cx,q.cz-w.cz)<12)===i),snaps=[];
  for(const wall of far.slice(0,8))for(let k=0;k<2;k++){both(s=>{Object.assign(s.player,{x:wall.x,z:wall.z,y:wall.y,yaw:wall.yaw,pitch:k?.08:0,hp:100});s.inventory.ammo[2]=12;});for(let i=0;i<180;i++)step(i===0?{weapon:2,fire:true}:{});}
  snaps.push(sha(a.sim)===sha(b.sim));
  for(let i=0;i<1800;i++){both(s=>{s.player.yaw+=.01;s.player.hp=100;});step({moveX:Math.sin(i/90),moveY:1,sprint:true,fire:i%20<6,dash:i%240===0,lookX:0,lookY:0});}
  snaps.push(sha(a.sim)===sha(b.sim));
  for(let i=0;i<600;i++){both(s=>{s.player.hp=100;});step({});}
  snaps.push(sha(a.sim)===sha(b.sim));
  const rubble=a.sim.state.debris.filter(q=>q.structural),T={a:{step:[],debris:[]},b:{step:[],debris:[]}};
  for(let blk=0;blk<BLOCKS;blk++){
    const order=blk%2?[['b',b,XB],['a',a,XA]]:[['a',a,XA],['b',b,XB]];
    for(const [key,x,probeX] of order){probeX.ms=0;let t=0;for(let i=0;i<PER;i++){x.sim.state.player.hp=100;const t0=performance.now();x.sim.step(1/60,{});t+=performance.now()-t0;x.sim.state.events.length=0;x.sim.state.dead=false;}T[key].step.push(t/PER);T[key].debris.push(probeX.ms/PER);}
    steps+=PER;if(stateDigest(a.sim.state)!==stateDigest(b.sim.state))same=false;
  }
  snaps.push(sha(a.sim)===sha(b.sim));
  const kept=k=>T[k].step.slice(1),keptD=k=>T[k].debris.slice(1),ratio=(f)=>r3(med(f('b').map((v,i)=>v/f('a')[i])));
  const row={spec,walls:Math.min(8,far.length),steps,identical:same&&snaps.every(Boolean),snapshotsSame:snaps,revision:a.sim.state.destructionRevision,rubble:rubble.length,resting:rubble.filter(q=>q.resting).length,
    blocks:BLOCKS-1,stepsPerBlock:PER,stepMsMedian:{a:r3(med(kept('a'))),b:r3(med(kept('b')))},debrisMsMedian:{a:r3(med(keptD('a'))),b:r3(med(keptD('b')))},
    stepMsMin:{a:r3(Math.min(...kept('a'))),b:r3(Math.min(...kept('b')))},debrisMsMin:{a:r3(Math.min(...keptD('a'))),b:r3(Math.min(...keptD('b')))},
    stepRatioMedian:ratio(kept),debrisRatioMedian:ratio(keptD)};
  allSame&&=row.identical;rows.push(row);
  for(const x of pair){x.sim.dispose?.();x.brain.dispose?.();}
  console.log(`${spec.padEnd(5)} ${row.walls} murs, révision ${row.revision}, ${row.rubble} gravats dont ${row.resting} au repos | identique ${row.identical} | pas de repos ${row.stepMsMedian.a} → ${row.stepMsMedian.b} ms (ratio médian ${row.stepRatioMedian}) | updateDebris ${row.debrisMsMedian.a} → ${row.debrisMsMedian.b} ms (ratio médian ${row.debrisRatioMedian})`);
}
console.log(JSON.stringify({schema:'lot02-t3-repos-v1',node:process.version,clock:'performance.now par sim.step et autour de updateDebris(dt)',identical:allSame,rows},null,1));
process.exit(allSame?0:1);
