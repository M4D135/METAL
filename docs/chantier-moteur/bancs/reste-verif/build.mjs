// RESTE: cumulative build of the round-1 exact prototypes, IN MEMORY only (repos are read-only).
//  simulation: SIM fullPatch (ground SoA, mirror, blocked, segmentFree, debris sleep, nav dirty-rects, identity loops, ray DDA)
//              + IA heap + nearest (+ long merged by hand with segmentV2, + labels merged with nav-local)
//  renderer  : RCPU proto (grid, sun, cache, pool)
import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {fullPatch} from '../sim/full-v2.mjs';
import {protoPatch} from '../ia/proto.mjs';
import {patchRenderer} from '../rcpu/proto.mjs';
export const ROOT=(process.env.METAL_ROOT||process.cwd());
export const FERRO='~/Projects/ferro';
const cache=new Map();
export const source=(name,root=ROOT)=>{const k=root+name;if(!cache.has(k))cache.set(k,readFileSync(root+'/src/'+name+'.js','utf8'));return cache.get(k);};
export function rep(src,from,to,label=''){
  if(typeof from==='string'){const at=src.indexOf(from);if(at<0)throw new Error('patch not found '+label+': '+from.slice(0,100));if(src.indexOf(from,at+1)>=0)throw new Error('patch not unique '+label+': '+from.slice(0,100));return src.slice(0,at)+to+src.slice(at+from.length);}
  if(!from.test(src))throw new Error('regex patch not found '+label+': '+from);return src.replace(from,to);
}
export const applyList=(src,list,label)=>{for(const [a,b] of list)src=rep(src,a,b,label);return src;};
// hand merge of IA "long" with SIM segmentV2: long sweeps scan only the buckets under the segment AABB (boolean OR => order free)
const LONG=[[`      for(let pass=0;pass<2;pass++){const list=pass?doorBoxes:local;for(let n=0;n<list.length;n++){const q=list[n];`,
`      const longScan=!short&&r<=bucketRadius;let lgx=0,lgz=0,lx0=0,lx1=0,lz0=0,lz1=0;
      if(longScan){lx0=Math.max(0,Math.floor(minX/bucketSize)-bucketX);lx1=Math.min(bucketWidth-1,Math.floor(maxX/bucketSize)-bucketX);lz0=Math.max(0,Math.floor(minZ/bucketSize)-bucketZ);lz1=Math.min(bucketDepth-1,Math.floor(maxZ/bucketSize)-bucketZ);lgx=lx0;lgz=lz0;}
      for(let pass=0;pass<2;pass++){let list=pass?doorBoxes:local;
        if(!pass&&longScan){if(lgz>lz1||lx0>lx1)continue;list=collisionBuckets[lgz*bucketWidth+lgx];if(++lgx>lx1){lgx=lx0;lgz++;}pass=-1;}
        for(let n=0;n<list.length;n++){const q=list[n];`]];
export function simSource({sim=true,heap=true,nearest=true,long=true,labels=true,extra=[]}={}){
  let src=source('simulation');
  if(sim)src=applyList(src,fullPatch().simulation,'sim');
  if(sim&&long)src=applyList(src,LONG,'long');
  const flags=[heap&&'heap',nearest&&'nearest',labels&&'labels'].filter(Boolean).join(',');
  if(labels&&sim)src=rep(src,'\n      if(reset)for(const e of s.enemies){e.path=[];','\n      /*L*/edgeKnown.fill(0);edgeOpen.fill(0);if(reset)for(const e of s.enemies){e.path=[];','labels-pre');
  if(flags)src=protoPatch(src,flags);
  if(labels&&sim)src=rep(src,'/*L*/edgeKnown.fill(0);edgeOpen.fill(0);bakeAt=0;','bakeAt=0;','labels-post');
  src=applyList(src,extra,'extra');
  return src;
}
export const ORDER=['renderer','world','destruction','economy','brain','simulation','actors','effects','motion'];
// Every module is evaluated in the MAIN realm inside a function wrapper with its own `window`,
// so several variants can coexist in one process (paired A/B in lockstep).
export function loadAll({sim=null,renderer=null,patches={},names=ORDER,hooks={}}={}){
  const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};
  for(const n of names){
    let src=n==='simulation'?(sim===null?source(n):typeof sim==='string'?sim:simSource(sim)):source(n);
    if(n==='renderer'&&renderer)src=patchRenderer(src,renderer);
    if(patches[n])src=applyList(src,patches[n],n);
    if(hooks[n])src=hooks[n](src);
    const fn=vm.runInThisContext('(function(window,globalThis,__H){'+src+'\n})',{filename:(sim||renderer||patches[n]?'P_':'O_')+n+'.js'});
    fn(win,win,hooks.__H||null);
  }
  return win;
}
export const SCENARIOS=[['legacy-s0',0,undefined],['legacy-s2',2,undefined],['campaign-w10',9,{campaign:true}],['campaign-w16',15,{campaign:true}],['camp2-w6',6,{campaign:true,campaignVersion:2}],['camp2-w12',12,{campaign:true,campaignVersion:2}]];
export function drive(i,input,s){input.moveX=Math.sin(i/90);input.fire=(i%20)<6;input.dash=(i%240)===0;s.player.yaw+=0.01;}
export const makeInput=()=>({moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0});
export function build(win,idx,opts,simOptions={}){const {FWorld,FSimulation,FBrain}=win;const world=FWorld.create(96,idx,opts);let brain=null;try{brain=FBrain.create({mode:'cpu'});}catch(e){}const sim=FSimulation.create(world,{brain,...simOptions});return {world,sim};}
const f64=new Float64Array(1),u32=new Uint32Array(f64.buffer);
export const mix=(h,v)=>{f64[0]=v;h=Math.imul(h^u32[0],16777619);return Math.imul(h^u32[1],16777619);};
export function digest(s,h){h=mix(h,s.player.x);h=mix(h,s.player.y);h=mix(h,s.player.z);h=mix(h,s.player.hp);h=mix(h,s.kills);for(const e of s.enemies){h=mix(h,e.x);h=mix(h,e.z);h=mix(h,e.hp);h=mix(h,e.baseY);h=mix(h,e.yaw||0);h=mix(h,e.attack?.time||0);}for(const d of s.debris){h=mix(h,d.x);h=mix(h,d.y);h=mix(h,d.z);h=mix(h,d.rotation[0]);}for(const q of s.projectiles||[]){h=mix(h,q.x);h=mix(h,q.y);h=mix(h,q.z);}h=mix(h,s.events.length);for(const e of s.events)for(let k=0;k<e.name.length;k++)h=Math.imul(h^e.name.charCodeAt(k),16777619);return h>>>0;}
export const snapHash=sim=>{const t=JSON.stringify(sim.snapshot());let h=2166136261;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);return (h>>>0).toString(16);};
export const q=(arr,p)=>{const a=Float64Array.from(arr).sort();return a[Math.min(a.length-1,Math.floor(a.length*p))];};
export const mean=a=>{let t=0;for(const v of a)t+=v;return t/a.length;};
export const sum=a=>{let t=0;for(const v of a)t+=v;return t;};
