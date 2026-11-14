// RCPU: A/B of FEffects.build wreckage selection (effects.js:172-198) vs an allocation-light rewrite with
// identical output (checked by deep equality every frame). Tour scenario, same state/camera for both.
// usage: node effects-ab.mjs <ferroRoot> [frames=3000] [world=camp:17]
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {isDeepStrictEqual} from 'node:util';
import {scene,stats} from './harness.mjs';
const root=process.argv[2],frames=+(process.argv[3]||3000),[kind,idx]=(process.argv[4]||'camp:17').split(':');
const S=scene(root,{world:[kind,+idx],wrap:false});
const src=readFileSync(root+'/src/effects.js','utf8');
let start=src.indexOf('    const wreckage=[],yaw=num(camera?.yaw)');
if(start<0)start=src.indexOf('    const yaw=num(camera?.yaw),pitch=num(camera?.pitch),heading=');
const end=src.indexOf('    return out;\n  }\n  function flash(');
if(start<0||end<0)throw new Error('effects.js wreckage block not found');
const fast=`    // Same selection as before, without per-item temporary arrays, string keys or a second full sort.
    const yaw=num(camera?.yaw),pitch=num(camera?.pitch),hasHeading=Number.isFinite(camera?.yaw)||Number.isFinite(camera?.pitch);
    const hx=Math.sin(yaw)*Math.cos(pitch),hy=Math.sin(pitch),hz=-Math.cos(yaw)*Math.cos(pitch),bandSize=software?12:24,fadeFar=software?42:105,fadeSpan=software?18:40;
    const items=[];
    for(const q of state.debris||[]){
      const x=q.x,y=q.y,z=q.z;if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))continue;
      const structural=q.structural===true,age=Math.max(0,num(q.age)),life=Math.max(.01,num(q.life,1.5));if(!structural&&age>=life)continue;
      let raw=q.size,s;
      if(structural){if(!Array.isArray(raw)||raw.length!==3||!(Number.isFinite(raw[0])&&raw[0]>0&&Number.isFinite(raw[1])&&raw[1]>0&&Number.isFinite(raw[2])&&raw[2]>0))continue;s=raw;}
      else{if(!Array.isArray(raw)){const v=num(q.size,.12);raw=[v,v,v];}const k=clamp((life-age)/(life*.24),0,1);s=raw.map(v=>clamp(num(v,.1),.015,3)*k);if(s.some(v=>v<.005))continue;}
      const radius=Math.hypot(s[0],s[1],s[2])*.5,dx=x-eye[0],dy=y-eye[1],dz=z-eye[2],dist=Math.hypot(dx,dy,dz);
      if(clamp((fadeFar-Math.max(0,dist-radius))/fadeSpan,0,1)<=0)continue;
      const d=Math.max(0,dist-radius),rear=hasHeading&&dx*hx+dy*hy+dz*hz<-radius?1:0;
      items.push({q,x,y,z,s,raw,structural,age,band:Math.floor(d/bandSize),rear,score:d/(1+Math.min(radius,3)*.3),id:num(q.id,num(q.seed)),repeat:0});
    }
    items.sort((a,b)=>(b.structural-a.structural)||a.rear-b.rear||a.band-b.band||a.score-b.score||a.id-b.id);
    // Stable partition of every (structural, rear, band) group: first piece of each source, then repeats.
    const ordered=[];
    for(let i=0;i<items.length;){
      let j=i;const g=items[i];while(j<items.length&&items[j].structural===g.structural&&items[j].rear===g.rear&&items[j].band===g.band)j++;
      if(g.structural){const seen=new Set();let repeats=null;
        for(let k=i;k<j;k++){const it=items[k],id=it.q.sourceId;if(typeof id==='string'){if(seen.has(id)){(repeats||(repeats=[])).push(it);continue;}seen.add(id);}ordered.push(it);}
        if(repeats)for(const it of repeats)ordered.push(it);}
      else for(let k=i;k<j;k++)ordered.push(items[k]);
      i=j;if(ordered.length>=debrisBudget)break;
    }
    for(let n=0;n<ordered.length&&n<debrisBudget;n++){const {q,x,y,z,raw,structural,age}=ordered[n],p=[x,y,z],s=structural?raw.slice():ordered[n].s;
      const supplied=Array.isArray(q.rotation)&&q.rotation.length===3&&q.rotation.every(Number.isFinite),seed=num(q.seed,1);
      const r=supplied?q.rotation.slice():structural?[0,0,0]:q.resting?[0,hash(seed,2)*Math.PI*2,0]:[age*(hash(seed,1)*5-2.5),age*(hash(seed,2)*5-2.5),age*(hash(seed,3)*5-2.5)];
      if(!structural&&q.resting)p[1]-=(clamp(num(raw[1],.1),.015,3)-s[1])*.5;
      const shape=structural&&debrisShapes.includes(q.shape)?q.shape:'box',color=Array.isArray(q.color)?q.color.slice():undefined,m=solid(shape,p,s,clamp(num(q.mat,3),0,12),color,r,'debris');
      if(structural){m.structural=true;m.debrisId=q.id;m.sourceId=q.sourceId;m.material=q.material;}
    }
`;
const W1={FRender:S.win.FRender},W2={FRender:S.win.FRender};
vm.runInThisContext('(function(window){'+src+'\n})',{filename:'effects-a.js'})(W1);
vm.runInThisContext('(function(window){'+src.slice(0,start)+fast+src.slice(end)+'\n})',{filename:'effects-b.js'})(W2);
const A=[],B=[];let mismatches=0,checked=0;
for(let i=0;i<frames+120;i++){
  const r=S.frame(1/60,{tour:true});const st=S.sim.state,opt={quality:'auto',backend:'webgl2'};
  // Alternate which version runs first so cache warmth does not favour either side.
  let a,b,ta,tb,t;
  if(i&1){t=performance.now();b=W2.FEffects.build(st,S.world,r.camera,opt);tb=performance.now()-t;t=performance.now();a=W1.FEffects.build(st,S.world,r.camera,opt);ta=performance.now()-t;}
  else{t=performance.now();a=W1.FEffects.build(st,S.world,r.camera,opt);ta=performance.now()-t;t=performance.now();b=W2.FEffects.build(st,S.world,r.camera,opt);tb=performance.now()-t;}
  if(i<120)continue;A.push(ta);B.push(tb);checked++;if(!isDeepStrictEqual(a,b))mismatches++;
}
console.log('world',kind+':'+idx,'frames',checked,'identical outputs:',checked-mismatches,'/',checked);
console.log('effects.build original',JSON.stringify(stats(A)));
console.log('effects.build rewrite ',JSON.stringify(stats(B)));
