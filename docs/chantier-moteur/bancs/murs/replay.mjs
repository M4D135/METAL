// Rejoue une trace d'appels damageScenery sur un contrôleur FDestruction neuf, sous plusieurs définitions de « mur ».
// Comparaison exacte des variantes sur les mêmes impacts. usage : node replay.mjs trace-xxx.json [...]
import {readFileSync} from 'node:fs';import {loadFast,fnv} from './lib.mjs';import {patchesA,patchesB,armoredIds,classify,unbreakableIds} from './proto.mjs';
const A=loadFast({patches:{destruction:patchesA.destruction},modules:['renderer','world','destruction']}),B=loadFast({patches:{destruction:patchesB.destruction},modules:['renderer','world','destruction']});
const VARIANTS=[['origine (module d’origine)',A,null,{}],['origine (module à règle, aucun marquage)',B,null,{}],['R1 murs seuls',B,'R1',{}],['R2 structure',B,'R2',{}],['R3 structure + murets',B,'R3',{}],['R3, explosions ennemies légères',B,'R3',{enemy:false}],['R3, ennemis et boss légers',B,'R3',{enemy:false,boss:false}],['R4 = R3 + relief jamais',B,'R3',{never:{relief:true,floor:false}}],['R5 = R3 + relief et sols jamais',B,'R3',{never:{relief:true,floor:true}}]];
const heavyOf=(src,rule)=>src.endsWith(':steam')||src.endsWith(':raté')||src==='joueur:balle'?false:src.startsWith('joueur:')?true:src.startsWith('boss:')?rule.boss!==false:rule.enemy!==false;
for(const file of process.argv.slice(2)){
  const {summary,calls}=JSON.parse(readFileSync(new URL('./'+file,import.meta.url),'utf8'));
  const bySrc={};for(const c of calls)bySrc[c[1]]=(bySrc[c[1]]||0)+1;
  console.log('\n=== '+file+' : monde '+(summary.index+1)+', arme '+summary.weapon+', '+summary.seconds+' s, '+calls.length+' appels '+JSON.stringify(bySrc)+', tirs '+summary.shots+', touches '+summary.hits);
  for(const [name,W,def,rule] of VARIANTS){
    const world=W.FWorld.create(96,summary.index,{campaign:true,campaignVersion:2});if(def)world.armored=armoredIds(world,def);if(rule.never)world.unbreakable=unbreakableIds(world,rule.never);
    const d=W.FDestruction.create(world),kinds=new Map(world.destructibles.map(g=>[g.id,classify(world,g)]));
    const breaks={},deflected={};let revs=0,revSteps=new Set(),fallen=0,chips=0,collapsed=0,defl=0,impacts=0;
    globalThis.__LOG=(g,bullet,amount,state)=>{const c=kinds.get(g.id),key=globalThis.__SRC.split(':')[0]+'>'+c.kind+'|'+(c.cat||'mat'+c.mat);if(state>0)breaks[key]=(breaks[key]||0)+1;else if(state<0){deflected[key]=(deflected[key]||0)+1;defl++;}else impacts++;};
    globalThis.__REV=()=>{};
    for(const [step,src,point,power,r,direction,ignoreId] of calls){
      globalThis.__SRC=src;const heavy=heavyOf(src,rule),res=r>0?d.blast(point,r,power,ignoreId??undefined,{heavy}):d.hit(point,power,direction??undefined,{heavy});
      if(res.changed){revs++;revSteps.add(step);collapsed+=res.collapsed.length;}
      for(const q of res.debris)if(q.structural)fallen++;else chips++;
    }
    const snap=d.snapshot(),top=o=>Object.entries(o).sort((x,y)=>y[1]-x[1]).slice(0,7).map(([k,v])=>k+'×'+v).join(' ');
    console.log((name+' ').padEnd(42,'.')+' révisions '+String(revs).padStart(4)+' ('+(revs*60/summary.seconds).toFixed(1).padStart(5)+'/min) | pas avec révision '+String(revSteps.size).padStart(4)+' ('+(revSteps.size*60/summary.seconds).toFixed(1).padStart(5)+'/min) | gravats '+String(fallen).padStart(5)+' | éclats '+String(chips).padStart(4)+' | déviés '+String(defl).padStart(4)+' | groupes effondrés '+String(collapsed).padStart(3)+' | états '+String(snap.states.length).padStart(4)+' | blindés '+(world.armored?.length||0)+(world.unbreakable?'+'+world.unbreakable.length+' jamais':'')+' | empreinte '+fnv(JSON.stringify(snap)));
    console.log('      ruptures : '+top(breaks)+(defl?'\n      déviés   : '+top(deflected):''));
  }
}
