import {loadFast,loadRoot,worldList,fnv} from '../murs/lib.mjs';
const O=loadFast(),R=loadRoot((process.env.METAL_BANCS||process.cwd()+'/docs/chantier-moteur/bancs')+'/murs/work');
const RELIEF=['hill','cliff','cliff_stratum'],FLOOR=['arena_inlay','floor_drain','threshold','hazard_marking','trail','ground_patch','leaf_litter','jump_landing','dock_warning','trap_warning','arena_path_mark','trap_plate'];
const breachArmor=(g,world)=>{
  const meshes=g.meshes.map(i=>world.meshes[i]),c=g.colliders.length?world.colliders[g.colliders[0]]:null,m=c?world.meshes[c.mesh]:null;
  if(meshes.some(q=>RELIEF.includes(q.category))||!c&&meshes.every(q=>FLOOR.includes(q.category)||q.s[1]<=.06&&!(q.r||[]).some(v=>Math.abs(v)>.01)))return 2;
  return g.kind==='wall'||g.kind==='roof'||!!m&&(m.category==='boundary'||g.kind==='support'&&Math.min(c.maxX-c.minX,c.maxZ-c.minZ)>=.6)?1:0;
};
const inc=(o,k,n=1)=>o[k]=(o[k]||0)+n;const top=(o,n=18)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>k+'×'+v).join(' ');
const c2solid={},c2thinCats={},c1members={},c0wallish={},c0mat3={},kinds={};let nW=0,c1groups=0,c1meshes=0,c2reliefAttached={};
const list=worldList().filter(w=>w.label.startsWith('v2'));
for(const w of list){
  const world=O.FWorld.create(96,w.index,w.opts);nW++;
  for(const g of world.destructibles){
    const a=breachArmor(g,world),c=g.colliders.length?world.colliders[g.colliders[0]]:null,m=c?world.meshes[c.mesh]:null;
    inc(kinds,g.kind+':'+a);
    if(a===2){
      if(c)inc(c2solid,g.kind+'|'+(m.category||'mat'+m.mat));
      const hasRelief=g.meshes.some(i=>RELIEF.includes(world.meshes[i].category));
      if(hasRelief){for(const i of g.meshes){const q=world.meshes[i];if(!RELIEF.includes(q.category))inc(c2reliefAttached,(q.category||'mat'+q.mat));}}
      else for(const i of g.meshes){const q=world.meshes[i];if(!FLOOR.includes(q.category))inc(c2thinCats,(q.category||'mat'+q.mat)+(q.p[1]>1?'@haut':''));}
    }
    if(a===1){c1groups++;for(const i of g.meshes){c1meshes++;if(!c||i!==c.mesh)inc(c1members,world.meshes[i].category||'mat'+world.meshes[i].mat);}}
    if(a===0&&c){const sx=c.maxX-c.minX,sy=c.maxY-c.minY,sz=c.maxZ-c.minZ;
      if(m.mat===3&&!m.category)inc(c0mat3,g.kind+' '+Math.min(sx,sz).toFixed(2)+'×'+Math.max(sx,sz).toFixed(1)+'×h'+sy.toFixed(1));
      if(sy>=1.6&&Math.max(sx,sz)>=1.2&&Math.min(sx,sz)<=1.2)inc(c0wallish,g.kind+'|'+(m.category||'mat'+m.mat));}
  }
}
console.log('mondes',nW,'\ngenre:classe',top(kinds,40));
console.log('classe 2 AVEC collider (indestructible même au lourd):',top(c2solid,30)||'aucun');
console.log('classe 2 par relief: maillages rattachés non relief:',top(c2reliefAttached,30)||'aucun');
console.log('classe 2 par critère mince, catégories hors liste FLOOR:',top(c2thinCats,40)||'aucun');
console.log('classe 1 : groupes',c1groups,'maillages',c1meshes,'membres rattachés:',top(c1members,40));
console.log('classe 0 murs mat3 sans catégorie (segments de mur de salle non blindés):',top(c0mat3,30)||'aucun');
console.log('classe 0 à collider haut>=1.6, long>=1.2, mince<=1.2 :',top(c0wallish,40));
