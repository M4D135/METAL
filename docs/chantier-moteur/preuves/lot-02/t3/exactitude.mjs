// Lot 02 / T3 (SIM-03, LOAD-05) : contrôle en ombre des quatre changements, sur l'arbre.
// L'arbre est chargé (domaine principal, tools/realm-loader) avec des sondes posées par
// remplacement de chaînes exactes, une seule occurrence exigée :
// - sommeil : une pièce que l'arbre sauterait suit quand même le chemin complet. On compte les
//   cas où ce chemin l'aurait réveillée (sommeil faux), où il aurait touché rotation,
//   angularVelocity ou settleTime, et où son appui statique aurait disparu ;
// - mémo de debrisFloor : chaque réponse est comparée (Object.is) à la formule de l'avant ;
// - debrisBoxes : la liste rendue est comparée, rang par rang (même objet), à celle de la
//   fonction de l'avant, dont le texte est lu dans <racine avant> ;
// - feuillage : le maximum sur 38 points est comparé à celui de l'avant sur les 216 points.
// Le chemin complet étant suivi, l'état avance comme celui de l'avant. Scénarios : les 22 de
// tools/proof avec son pilote, arme d'origine, roquettes (3 600 pas) et grenades ; une reprise
// snapshot → JSON → restore à mi-course (simulation neuve avec l'arme d'origine, même
// simulation avec les grenades) ; puis des démolitions de murs à la roquette, à la manière du
// banc LOAD-05 (v05b), suivies d'une marche armée et d'un repos. Enfin debrisHalf de l'arbre
// et de l'avant sur 7 formes × 40 000 tailles et rotations tirées d'un générateur à graine.
// usage : node exactitude.mjs <racine arbre> <racine avant> [--quick] [--json sortie.json]
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const args=process.argv.slice(2),flag=k=>{const i=args.indexOf(k);if(i<0)return null;const v=args[i+1];args.splice(i,2);return v;};
const jsonOut=flag('--json'),quick=args.includes('--quick');if(quick)args.splice(args.indexOf('--quick'),1);
const [treeArg,prevArg]=args;
if(!treeArg||!prevArg){console.error('usage: node exactitude.mjs <racine arbre> <racine avant> [--quick] [--json sortie.json]');process.exit(2);}
const tree=resolve(treeArg),prev=resolve(prevArg);
const {loadRealm}=await import(pathToFileURL(tree+'/tools/realm-loader.mjs'));
const {SCENARIO_CATALOG,buildScenario,makeInput,drive}=await import(pathToFileURL(tree+'/tools/proof/scenarios.mjs'));

// Textes de l'avant, lus tels quels.
const old=readFileSync(prev+'/src/simulation.js','utf8');
const once=(text,needle)=>{const i=text.indexOf(needle);if(i<0||text.indexOf(needle,i+1)>=0)throw new Error('ancre absente ou multiple : '+needle.slice(0,80));return i;};
const block=(start,end)=>{const i=once(old,start),j=old.indexOf(end,i);return old.slice(i,j+end.length);};
const oldBoxes=block('    function debrisBoxes(q,h,reach,dynamic){','\n    }\n').replace('function debrisBoxes(','function __oldBoxes(');
const oldFloor=(()=>{const head='    function debrisFloor(x,z,h){\n      return ',i=once(old,head)+head.length;return old.slice(i,old.indexOf(';\n',i));})();
const oldFoliage=(()=>{const head='        if(debrisFoliage.length)return ',i=once(old,head)+head.length;return old.slice(i,old.indexOf(';\n',i)).replaceAll('debrisFoliage','__all');})();
const oldHalf=block('  function debrisHalf(q,r=q.rotation||[0,0,0]){','\n  }\n').replace('function debrisHalf(','function __oldHalf(').replaceAll('debrisExtentCache','__oldCache').replaceAll('debrisFoliage','__oldFoliage');

const P=[
  // Sommeil en ombre.
  ['if(q.resting&&sleepy&&debrisSleep.get(q)===seenDestructionRevision)continue;',
   'const __asleep=q.resting&&sleepy&&debrisSleep.get(q)===seenDestructionRevision,__r0=q.rotation,__a0=q.angularVelocity,__s0=q.settleTime;if(q.resting)__X.restingChecks++;if(__asleep)__X.asleep++;'],
  ['if(q.resting){if(Number.isFinite(debrisSupport(q,h,boxes))){if(sleepy&&debrisStaticSupport(q,h,boxes))debrisSleep.set(q,seenDestructionRevision);continue;}q.resting=false;',
   'if(q.resting){if(Number.isFinite(debrisSupport(q,h,boxes))){const __st=sleepy&&debrisStaticSupport(q,h,boxes);if(__asleep){if(!__st)__X.staticLost++;if(q.rotation!==__r0||q.angularVelocity!==__a0||!Object.is(q.settleTime,__s0))__X.touched++;}else if(__st)__X.fellAsleep++;if(__st)debrisSleep.set(q,seenDestructionRevision);continue;}if(__asleep)__X.wrongSleep++;q.resting=false;'],
  // Mémo de debrisFloor contre la formule de l'avant.
  ['if(x===dfX0&&z===dfZ0&&a===dfA0&&c===dfC0)return dfV0;',
   `__X.floorCalls++;const __o=${oldFloor};if(x===dfX0&&z===dfZ0&&a===dfA0&&c===dfC0){__X.memoHits++;if(!Object.is(dfV0,__o))__X.memoBad++;return dfV0;}`],
  ['if(x===dfX1&&z===dfZ1&&a===dfA1&&c===dfC1)return dfV1;',
   'if(x===dfX1&&z===dfZ1&&a===dfA1&&c===dfC1){__X.memoHits++;if(!Object.is(dfV1,__o))__X.memoBad++;return dfV1;}'],
  ['const v=Math.max(ground(x,z),ground(x-a,z-c),ground(x+a,z-c),ground(x-a,z+c),ground(x+a,z+c));',
   'const v=Math.max(ground(x,z),ground(x-a,z-c),ground(x+a,z-c),ground(x-a,z+c),ground(x+a,z+c));if(!Object.is(v,__o))__X.memoBad++;'],
  // debrisBoxes contre la fonction de l'avant.
  ['    const debrisOverlaps=',oldBoxes+'    const debrisOverlaps='],
  ['let h=debrisHalf(q),boxes=debrisBoxes(q,h,Math.hypot(q.vx,q.vz)*dt+.1,dynamic);',
   'let h=debrisHalf(q),boxes=debrisBoxes(q,h,Math.hypot(q.vx,q.vz)*dt+.1,dynamic);__X.boxCalls++;{const __b=__oldBoxes(q,h,Math.hypot(q.vx,q.vz)*dt+.1,dynamic);if(__b.length!==boxes.length||__b.some((x,i)=>x!==boxes[i]))__X.boxesBad++;__X.boxes+=boxes.length;}'],
  // Feuillage en jeu contre les 216 points de l'avant.
  ['if(d>m)m=d;}return m;}',
   `if(d>m)m=d;}__X.foliage++;{const __all=__X.allFoliage||(__X.allFoliage=G.FRender.foliageTriangles().flat()),__o=${oldFoliage};if(!Object.is(__o,m))__X.foliageBad++;}return m;}`],
  // debrisHalf de l'avant, à part (cache et feuillage propres), pour le tirage direct.
  ['  function create(world,options={}) {',`  const __oldCache=new WeakMap();let __oldFoliage;\n${oldHalf}  __X.half=debrisHalf;__X.oldHalf=__oldHalf;\n  function create(world,options={}) {`],
];
const KEYS=['restingChecks','asleep','fellAsleep','wrongSleep','touched','staticLost','floorCalls','memoHits','memoBad','boxCalls','boxes','boxesBad','foliage','foliageBad'];
const X=Object.fromEntries(KEYS.map(k=>[k,0]));
const L=loadRealm({root:tree,patches:{simulation:P},globals:{__X:X}});
const W=L.window,rows=[],total=Object.fromEntries(KEYS.map(k=>[k,0]));
const measure=(id,fn)=>{const before={...X};const t0=Date.now();const info=fn()||{};const row={id,...Object.fromEntries(KEYS.map(k=>[k,X[k]-before[k]])),...info,seconds:+((Date.now()-t0)/1000).toFixed(1)};rows.push(row);for(const k of KEYS)total[k]+=row[k];
  console.log(`${id.padEnd(30)} repos ${String(row.restingChecks).padStart(8)} | endormies ${String(row.asleep).padStart(8)} | faux ${row.wrongSleep} | touchées ${row.touched} | appui statique perdu ${row.staticLost} | mémo ${row.memoHits}/${row.floorCalls}, écarts ${row.memoBad} | boîtes ${row.boxCalls}, écarts ${row.boxesBad} | feuillage ${row.foliage}, écarts ${row.foliageBad}${info.note?' | '+info.note:''}`);};
const clean=s=>{s.events.length=0;};

// (1) Les 22 scénarios de tools/proof.
const weapons=[[undefined,'arme d’origine',1800,'neuve'],[2,'roquettes',3600,null],[3,'grenades',1800,'même']];
for(const sc of quick?SCENARIO_CATALOG.slice(0,2):SCENARIO_CATALOG)for(const [weapon,label,steps,reprise] of weapons)measure(`${sc.id} ${label}`,()=>{
  let run=buildScenario(L,sc),input=makeInput(weapon),restored=null;const n=quick?Math.min(steps,600):steps;
  for(let i=0;i<n;i++){
    if(reprise&&i===n/2){const text=JSON.stringify(run.sim.snapshot());if(reprise==='neuve'){const next=buildScenario(L,sc);restored=next.sim.restore(JSON.parse(text));run.dispose();run=next;}else restored=run.sim.restore(JSON.parse(text));}
    drive(i,input,run.sim.state);run.sim.step(1/60,input);clean(run.sim.state);
  }
  const rubble=run.sim.state.debris.filter(q=>q.structural);run.dispose();
  return {steps:n,restore:reprise?{into:reprise,ok:restored}:null,rubbleAtEnd:rubble.length,restingAtEnd:rubble.filter(q=>q.resting).length};
});

// (2) Démolitions à la roquette, comme le banc LOAD-05 (load-verif2/v05b), puis marche armée et repos.
const specs=quick?['l:0']:['l:0','l:1','l:2','c:0','c:9','c:12','c:17'];
for(const spec of specs)measure('démolition '+spec,()=>{
  const campaign=spec.startsWith('c:'),index=+spec.split(':')[1],world=campaign?W.FWorld.create(96,index,{campaign:true,campaignVersion:2}):W.FWorld.create(96,index);
  const o={brain:W.FBrain.create({mode:'cpu'}),armorSystem:true,inventory:campaign?{weapons:[true,true,true,true,true],ammo:[180,36,12,16,1],shield:false}:{weapons:[true,true,true,true],ammo:[180,36,12,16],shield:false}};
  if(campaign){o.campaign={version:2,discovered:['pistol','smg','shotgun','grenade','rocket'],claimedBossRewards:[]};o.equipment={right:2,left:null,shieldEnergy:100};}
  const sim=W.FSimulation.create(world,o),s=sim.state,p=s.player,walls=[];
  for(const g of world.destructibles.filter(g=>g.kind==='wall'&&g.colliders.length)){const b=g.bounds,cx=(b.minX+b.maxX)/2,cz=(b.minZ+b.maxZ)/2,thinX=b.maxX-b.minX<b.maxZ-b.minZ;
    for(const sign of [-1,1]){const nx=thinX?sign:0,nz=thinX?0:sign,x=cx+nx*7,z=cz+nz*7,y=sim.ground(x,z);if(!Number.isFinite(y)||Math.abs(y-b.minY)>.1||sim.blocked(x,z,.28))continue;const hit=sim.ray([x,y+1.62,z],[-nx,0,-nz],9);if(hit<6||hit>7.4)continue;walls.push({x,y,z,yaw:Math.atan2(-nx,nz),cx,cz});break;}}
  const far=walls.filter((w,i)=>walls.findIndex(q=>Math.hypot(q.cx-w.cx,q.cz-w.cz)<12)===i),step=input=>{sim.step(1/60,input);clean(s);s.dead=false;};
  for(const wall of far.slice(0,8))for(let k=0;k<2;k++){Object.assign(p,{x:wall.x,z:wall.z,y:wall.y,yaw:wall.yaw,pitch:k?.08:0,hp:100});s.inventory.ammo[2]=12;for(let i=0;i<180;i++)step(i===0?{weapon:2,fire:true}:{});}
  for(let i=0;i<1800;i++){p.yaw+=.01;p.hp=100;step({moveX:Math.sin(i/90),moveY:1,sprint:true,fire:i%20<6,dash:i%240===0,lookX:0,lookY:0});}
  for(let i=0;i<600;i++){p.hp=100;step({});}
  const rubble=s.debris.filter(q=>q.structural);sim.dispose?.();o.brain.dispose?.();
  return {walls:Math.min(8,far.length),revision:s.destructionRevision,rubbleAtEnd:rubble.length,restingAtEnd:rubble.filter(q=>q.resting).length};
});

// (3) debrisHalf, arbre contre avant, sur un tirage à graine (xorshift32).
let seed=0x9e3779b9;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
const shapes=['box','bevel','cylinder','sphere','octa','ring','foliage'],special=[0,-0,Math.PI/2,-Math.PI/2,Math.PI,-Math.PI,1e-12,3*Math.PI];
const half={draws:0,bad:0,perShape:{}};
for(const shape of shapes){let bad=0;const n=quick?2000:40000;
  for(let i=0;i<n;i++){
    const angle=()=>i%5===0?special[Math.floor(rnd()*special.length)]:(rnd()*2-1)*Math.PI*1.5,size=i%7===0?.05+rnd()*3:[.05+rnd()*3,.05+rnd()*3,.05+rnd()*3];
    const r=[angle(),angle(),angle()],a=X.half({shape,size},r),b=X.oldHalf({shape,size},r);
    if(a.length!==3||a.some((v,k)=>!Object.is(v,b[k])))bad++;
  }
  half.draws+=n;half.bad+=bad;half.perShape[shape]={draws:n,bad};
}
console.log(`debrisHalf direct : ${half.draws} tirages sur ${shapes.length} formes, écarts ${half.bad}`);
const foliagePoints=W.FRender.foliageTriangles().flat(),unique=new Set(foliagePoints.map(p=>p.join(','))).size;
console.log(`feuillage : ${foliagePoints.length} points, ${unique} uniques`);
const bad=total.wrongSleep+total.touched+total.staticLost+total.memoBad+total.boxesBad+total.foliageBad+half.bad;
console.log(`TOTAL repos ${total.restingChecks} | endormies ${total.asleep} (${(100*total.asleep/Math.max(1,total.restingChecks)).toFixed(1)} %) | faux ${total.wrongSleep} | touchées ${total.touched} | appui statique perdu ${total.staticLost} | mémo ${total.memoHits}/${total.floorCalls}, écarts ${total.memoBad} | boîtes ${total.boxCalls}, écarts ${total.boxesBad} | feuillage ${total.foliage}, écarts ${total.foliageBad} | debrisHalf écarts ${half.bad} → ${bad?'ÉCARTS':'aucun écart'}`);
if(jsonOut)writeFileSync(jsonOut,JSON.stringify({schema:'lot02-t3-exactitude-v1',quick,node:process.version,sourceSha256:{tree:L.sourceSha256.simulation,before:(await import('node:crypto')).createHash('sha256').update(old).digest('hex')},total,debrisHalf:half,foliage:{points:foliagePoints.length,unique},rows},null,1)+'\n');
process.exit(bad?1:0);
