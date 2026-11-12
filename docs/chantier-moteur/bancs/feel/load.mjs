// Shared loader: runs METAL sources in a node:vm context (read-only on the repo).
// patch(name, source) may rewrite a module's text IN MEMORY for instrumentation only.
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
export function load(root,{modules=['renderer','world','destruction','economy','brain','simulation'],patch=null}={}){
  const ctx={window:{},performance,console,Math,Date}; vm.createContext(ctx);
  for(const n of modules){let src=readFileSync(root+'/src/'+n+'.js','utf8');if(patch)src=patch(n,src);vm.runInContext(src,ctx,{filename:n+'.js'});}
  return ctx.window;
}
// Instrument hurt(): record caller line and the amounts before/after guard and armor.
export function hurtProbe(name,src){
  if(name!=='simulation')return src;
  const head='function hurt(amount,difficulty=true,source=null){';
  if(!src.includes(head))throw new Error('hurt() signature changed');
  return src.replace(head,head+"const __line=(new Error().stack.split('\\n')[2]||'').match(/simulation\\.js:(\\d+)/)?.[1]|0;const __hp=p.hp,__shield=s.shield?.energy,__armor=s.armor?.points;try{return __hurt(amount,difficulty,source);}finally{(G.__HURTS||(G.__HURTS=[])).push({line:__line,raw:amount,source:source?{...source}:null,hp:__hp-p.hp,shield:__shield!==undefined?__shield-s.shield.energy:0,armor:__armor!==undefined?__armor-s.armor.points:0,raised:!!s.shield?.raised,dashing:p.dashing>0,t:s.time});}}function __hurt(amount,difficulty=true,source=null){");
}
export function flatWorld(extra={}){
  return {seed:'feel',stage:0,generation:6,spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40},
    walkable:[{x:0,y:0,z:0,w:80,d:80}],meshes:[],lights:[],colliders:[],enemies:[],pickups:[],cores:[{x:25,z:25},{x:28,z:25},{x:31,z:25}],exit:{x:34,z:25},
    progression:{version:1,weaponSlots:4,startWeapons:[true,true,true,true],startAmmo:[180,36,12,16],startShield:true,ammoCaps:[180,36,12,16],maxActive:8},...extra};
}
