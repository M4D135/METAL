// Shape, size and bucket statistics of world.walkable (the floors that ground() scans).
import vm from 'node:vm';import {load,SCENARIOS,build} from './lib.mjs';
const ctx=load();
for(const [label,idx,opts] of SCENARIOS){
  const {world}=build(ctx,idx,opts);const floors=world.walkable,b=world.bounds;
  const shapes=new Map();for(const f of floors){const k=Object.keys(f).join(',');shapes.set(k,(shapes.get(k)||0)+1);}
  // Hidden-class identity using V8 natives (node --allow-natives-syntax).
  let maps=0;try{ctx.__floors=floors;maps=vm.runInContext('(()=>{const reps=[];for(const f of __floors)if(!reps.some(r=>%HaveSameMap(r,f)))reps.push(f);return reps.length;})()',ctx);}catch(e){maps='n/a ('+e.message.slice(0,40)+')';}
  console.log('== '+label+' floors '+floors.length+' bounds x['+b.minX+','+b.maxX+'] z['+b.minZ+','+b.maxZ+'] distinct key-sets '+shapes.size+' distinct V8 maps '+maps);
  for(const [k,v] of shapes)console.log('   '+v+'x {'+k+'}');
  const kinds={flat:0,ramp:0,fallback:0};let area=0;
  for(const f of floors){if(f.substrate||f.fallback)kinds.fallback++;else if(!f.slopeX&&!f.slopeZ)kinds.flat++;else kinds.ramp++;area+=f.w*f.d;}
  console.log('   kinds',JSON.stringify(kinds),'total area',area.toFixed(0),'world area',((b.maxX-b.minX)*(b.maxZ-b.minZ)).toFixed(0));
  for(const f of floors.slice().sort((a,c)=>c.w*c.d-a.w*a.d).slice(0,6))console.log('   big floor w',f.w,'d',f.d,'y',f.y,'slope',f.slopeX||0,f.slopeZ||0,'sub',!!f.substrate,'fb',!!f.fallback);
  for(const cs of [8,4,2,1]){
    const gx=Math.floor(b.minX/cs),gz=Math.floor(b.minZ/cs),gw=Math.floor(b.maxX/cs)-gx+1,gd=Math.floor(b.maxZ/cs)-gz+1,len=new Array(gw*gd).fill(0);
    for(const f of floors){const x0=Math.max(0,Math.floor((f.x-f.w/2-1e-7)/cs)-gx),x1=Math.min(gw-1,Math.floor((f.x+f.w/2+1e-7)/cs)-gx),z0=Math.max(0,Math.floor((f.z-f.d/2-1e-7)/cs)-gz),z1=Math.min(gd-1,Math.floor((f.z+f.d/2+1e-7)/cs)-gz);for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)len[z*gw+x]++;}
    const avg=len.reduce((a,c)=>a+c,0)/len.length,hist={};for(const l of len)hist[l]=(hist[l]||0)+1;
    console.log('   cell '+cs+' m: '+gw+'x'+gd+' cells, floors/cell avg '+avg.toFixed(2)+' max '+Math.max(...len)+' hist '+JSON.stringify(hist));
  }
}
