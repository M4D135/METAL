import {readFileSync} from 'node:fs';
import {loadFast,loadRoot,worldList,fnv,loadoutV2} from '../murs/lib.mjs';
const WORK=(process.env.METAL_BANCS||process.cwd()+'/docs/chantier-moteur/bancs')+'/murs/work';
const O=loadFast(),R=loadRoot(WORK);
const RELIEF=['hill','cliff','cliff_stratum'],FLOOR=['arena_inlay','floor_drain','threshold','hazard_marking','trail','ground_patch','leaf_litter','jump_landing','dock_warning','trap_warning','arena_path_mark','trap_plate'];
const breachArmor=(g,world)=>{
  const meshes=g.meshes.map(i=>world.meshes[i]),c=g.colliders.length?world.colliders[g.colliders[0]]:null,m=c?world.meshes[c.mesh]:null;
  if(meshes.some(q=>RELIEF.includes(q.category))||!c&&meshes.every(q=>FLOOR.includes(q.category)||q.s[1]<=.06&&!(q.r||[]).some(v=>Math.abs(v)>.01)))return 2;
  return g.kind==='wall'||g.kind==='roof'||!!m&&(m.category==='boundary'||g.kind==='support'&&Math.min(c.maxX-c.minX,c.maxZ-c.minZ)>=.6)?1:0;
};
function rng(seed){let n=seed|0||1;return()=>{n=Math.imul(n^n>>>15,2246822519);n=Math.imul(n^n>>>13,3266489917);return((n^n>>>16)>>>0)/4294967296;};}
// 1) Équivalence sans option : séquence aléatoire à moi (pas les traces de l'auteur)
for(const idx of [2,9,15]){
  const world=O.FWorld.create(96,idx,{campaign:true,campaignVersion:2}),a=O.FDestruction.create(world),b=R.FDestruction.create(world),rand=rng(1234+idx),gs=world.destructibles;
  let diff=0,changed=0,N=4000;
  for(let i=0;i<N;i++){
    const g=gs[Math.floor(rand()*gs.length)],bb=g.bounds,pt=[bb.minX+rand()*(bb.maxX-bb.minX)+(rand()-.5)*.2,bb.minY+rand()*(bb.maxY-bb.minY),bb.minZ+rand()*(bb.maxZ-bb.minZ)+(rand()-.5)*.2];
    let ra,rb;const t=rand();
    if(t<.75){const pw=rand()<.5?2:rand()<.8?5:8,dir=[rand()-.5,rand()*.2-.1,rand()-.5];ra=a.hit(pt,pw,dir);rb=b.hit(pt,pw,dir);}
    else{const rad=2.25+rand()*2,pw=10+rand()*45;ra=a.blast(pt,rad,pw);rb=b.blast(pt,rad,pw);}
    delete rb.deflected;if(JSON.stringify(ra)!==JSON.stringify(rb))diff++;if(ra.changed)changed++;
  }
  console.log('équivalence sans option, monde',idx+1,': appels',N,'ruptures',changed,'résultats différents',diff,'instantanés égaux',JSON.stringify(a.snapshot())===JSON.stringify(b.snapshot()),'colliders égaux',JSON.stringify(a.colliders)===JSON.stringify(b.colliders),'révisions',a.revision,b.revision);
}
// 2) Règle sur tous les groupes blindés des mondes 1 à 4 : 60 plombs de pompe au centre de chaque face, puis léger, puis lourd
for(const idx of [0,1,2,3]){
  const world=O.FWorld.create(96,idx,{campaign:true,campaignVersion:2});const d=R.FDestruction.create(world,{armor:breachArmor});
  let c1=0,c2=0,bad=0;
  for(const g of world.destructibles){const a=breachArmor(g,world);if(!a)continue;a===1?c1++:c2++;
    const bb=g.colliders.length?world.colliders[g.colliders[0]]:g.bounds,pt=[(bb.minX+bb.maxX)/2,(bb.minY+bb.maxY)/2,(bb.minZ+bb.maxZ)/2];
    if(d.armor(g.id)!==a)bad++;
  }
  // tir : on tire sur chaque groupe blindé ; d'autres groupes proches (non blindés) peuvent encaisser la balle (slice(0,1) = groupe le plus proche)
  let rev0=d.revision,deflected=0,other=0,statesArmored=0;
  for(const g of world.destructibles){const a=breachArmor(g,world);if(a!==1||!g.colliders.length)continue;const c=world.colliders[g.colliders[0]],thinX=c.maxX-c.minX<c.maxZ-c.minZ;
    for(let k=0;k<60;k++){const pt=[thinX?c.minX:(c.minX+c.maxX)/2,(c.minY+c.maxY)/2,thinX?(c.minZ+c.maxZ)/2:c.minZ];const r=d.hit(pt,5,[thinX?1:0,0,thinX?0:1]);if(r.deflected)deflected++;else other++;}}
  const snap=d.snapshot(),ids=new Set(world.destructibles.filter(g=>breachArmor(g,world)).map(g=>g.id));statesArmored=snap.states.filter(s=>ids.has(s.id)).length;
  // souffle léger (vapeur) puis lourd (roquette) sur 30 murs de salle
  let lightChanged=0,heavyChanged=0,n=0;
  for(const g of world.destructibles){if(g.kind!=='wall'||n>=30)continue;n++;const c=world.colliders[g.colliders[0]],pt=[(c.minX+c.maxX)/2,(c.minY+c.maxY)/2,(c.minZ+c.maxZ)/2];
    const before=JSON.stringify(d.snapshot().states.find(s=>s.id===g.id)||null);d.blast(pt,2.25,10,undefined,{heavy:false});d.blast(pt,2.25,10,undefined,{heavy:false});d.blast(pt,2.25,10,undefined,{heavy:false});
    if(JSON.stringify(d.snapshot().states.find(s=>s.id===g.id)||null)!==before)lightChanged++;
    d.blast(pt,4.2,55);const st=d.snapshot().states.find(s=>s.id===g.id);if(st&&(st.removed||st.cuts.length))heavyChanged++;}
  console.log('règle monde',idx+1,': classe1',c1,'classe2',c2,'armor() incohérents',bad,'| 60 plombs par groupe blindé à collider : déviés',deflected,'autres',other,'états créés sur blindés',statesArmored,'révisions dues aux voisins',d.revision-rev0,'| murs: vapeur×3 change',lightChanged,'/',n,' roquette perce',heavyChanged,'/',n);
}
// 3) Empreintes de simulation O contre R
for(const w of worldList().filter((_,i)=>[0,4,11,17,20,29,36,38].includes(i))){
  const mk=W=>{const world=W.FWorld.create(96,w.index,w.opts);const opts=w.label.startsWith('v2')?{...loadoutV2(W,w.index),armorSystem:true}:{};const sim=W.FSimulation.create(world,opts);return sim.snapshot().fingerprint+'/'+fnv(JSON.stringify(sim.snapshot()));};
  let a,b;try{a=mk(O);b=mk(R);}catch(e){a='erreur '+e.message;}
  console.log('empreinte',w.label,a,b,a===b?'identiques':'DIFFÉRENTES');
}
// 4) Ricochets : matière et maillage le plus proche des coups déviés (traces de l'auteur, module final + breachArmor)
for(const file of ['trace-w03-a1-A.json','trace-w03-a0-A-spray.json','trace-w10-a0-A-spray.json']){
  const {summary,calls}=JSON.parse(readFileSync('../murs/'+file,'utf8'));const world=O.FWorld.create(96,summary.index,{campaign:true,campaignVersion:2}),d=R.FDestruction.create(world,{armor:breachArmor});
  const byId=new Map(world.destructibles.map(g=>[g.id,g]));const mats={},cats={};let defl=0,revSteps=new Set(),revs=0,debris=0,calls2=0;
  const dist=(p,m)=>{const h=m.s.map(v=>v/2);return Math.hypot(Math.max(Math.abs(p[0]-m.p[0])-h[0],0),Math.max(Math.abs(p[1]-m.p[1])-h[1],0),Math.max(Math.abs(p[2]-m.p[2])-h[2],0));};
  for(const [step,src,point,power,r,direction,ignoreId] of calls){
    const heavy=src.endsWith(':steam')||src.endsWith(':raté')||src==='joueur:balle'?false:true;calls2++;
    const res=r>0?d.blast(point,r,power,ignoreId,{heavy}):d.hit(point,power,direction,{heavy});
    if(res.changed){revs++;revSteps.add(step);debris+=res.debris.filter(q=>q.structural).length;}
    if(!r)for(const e of res.events)if(e.deflected){defl++;mats[e.material]=(mats[e.material]||0)+1;const g=byId.get(e.sourceId);let best=null,bd=1e9;for(const i of g.meshes){const dd=dist(point,world.meshes[i]);if(dd<bd){bd=dd;best=world.meshes[i];}}const c=g.colliders.length?world.meshes[world.colliders[g.colliders[0]].mesh]:null;const k=best===c?'CORPS DU MUR':(best.category||'mat'+best.mat);cats[k]=(cats[k]||0)+1;}
  }
  console.log(file,'règle finale: révisions',revs,'pas avec révision',revSteps.size,'gravats structurels',debris,'| balles déviées',defl,'matière',JSON.stringify(mats),'maillage le plus proche',Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>k+'×'+v).join(' '));
}
