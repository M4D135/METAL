// Répartition des causes de révision (comportement d'origine) sur l'ensemble des traces, par famille de décor.
import {readFileSync,readdirSync} from 'node:fs';import {loadFast} from './lib.mjs';import {patchesA,classify} from './proto.mjs';
const A=loadFast({patches:{destruction:patchesA.destruction},modules:['renderer','world','destruction']});
const FLAT=new Set(['arena_inlay','floor_drain','threshold','hazard_marking','trail','ground_patch','leaf_litter','jump_landing','dock_warning','trap_warning','arena_path_mark','trap_plate']);
const family=(w,g)=>{const q=classify(w,g),cats=new Set(g.meshes.map(i=>w.meshes[i].category||''));
  if(g.kind==='wall')return '1 murs (genre wall)';if(g.kind==='roof'||g.kind==='support'&&q.thin>=.6)return '2 toits et piliers porteurs';if(q.cat==='boundary')return '3 murets d’enceinte';
  if(['hill','cliff','cliff_stratum'].some(c=>cats.has(c)))return '4 relief d’arrière-plan';
  if(!g.colliders.length&&g.meshes.every(i=>FLAT.has(w.meshes[i].category)||w.meshes[i].s[1]<=.06&&!(w.meshes[i].r||[]).some(v=>Math.abs(v)>.01)))return '5 marquages et dallages au sol';
  if(g.kind==='tree'||[...cats].some(c=>/grass|fern|flower|mushroom|ivy|shrub|undergrowth|twig|leaf|foliage|canopy/.test(c)))return '6 végétation';
  if(!g.colliders.length)return '7 autre décor sans collision';return '8 autre décor solide (caisses, couverts, machines, poteaux)';};
const files=readdirSync(new URL('.',import.meta.url)).filter(f=>/^trace-.*-A(-spray|-passif|-arene)?\.json$/.test(f));
const total={},bySrc={};let revs=0,revSteps=0,secs=0;
for(const f of files){
  const {summary,calls}=JSON.parse(readFileSync(new URL('./'+f,import.meta.url),'utf8')),w=A.FWorld.create(96,summary.index,{campaign:true,campaignVersion:2}),d=A.FDestruction.create(w),fam=new Map(w.destructibles.map(g=>[g.id,family(w,g)]));
  const local={};globalThis.__REV=()=>{};globalThis.__LOG=(g,bullet,amount,state)=>{if(state>0){const k=fam.get(g.id);total[k]=(total[k]||0)+1;local[k]=(local[k]||0)+1;const s=globalThis.__SRC.split(':')[0]+' → '+k;bySrc[s]=(bySrc[s]||0)+1;}};
  const steps=new Set();let r=0;for(const [step,src,point,power,rad,direction,ignoreId] of calls){globalThis.__SRC=src;const res=rad>0?d.blast(point,rad,power,ignoreId??undefined):d.hit(point,power,direction??undefined);if(res.changed){r++;steps.add(step);}}
  revs+=r;revSteps+=steps.size;secs+=summary.seconds;
  console.log(f.padEnd(34),'révisions',String(r).padStart(3),'|',Object.entries(local).sort().map(([k,v])=>k.split(' ')[0]+':'+v).join(' '));
}
const sum=Object.values(total).reduce((a,b)=>a+b,0);
console.log('\nToutes traces ('+files.length+' traces, '+secs+' s) : '+revs+' révisions, '+revSteps+' pas avec révision, '+sum+' ruptures de groupes');
for(const [k,v] of Object.entries(total).sort())console.log('  '+k.padEnd(60)+String(v).padStart(4)+'  '+(100*v/sum).toFixed(1)+' %');
console.log('\npar source :');for(const [k,v] of Object.entries(bySrc).sort((a,b)=>b[1]-a[1]).slice(0,24))console.log('  '+k.padEnd(70)+v);
