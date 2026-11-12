// Independent loader (read-only on the repo). patch(name,src) rewrites module text in memory only.
import {readFileSync} from 'node:fs';import vm from 'node:vm';
export function vload(root,mods=['destruction','economy','simulation'],patch=null){
  const ctx={window:{},performance,console};vm.createContext(ctx);
  for(const n of mods){let src=readFileSync(root+'/src/'+n+'.js','utf8');if(patch)src=patch(n,src);vm.runInContext(src,ctx,{filename:n+'.js'});}
  return ctx.window;
}
export function arena(extra={}){
  return {seed:'verif',stage:0,generation:6,spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-50,maxX:50,minZ:-50,maxZ:50},
    walkable:[{x:0,y:0,z:0,w:100,d:100}],meshes:[],lights:[],colliders:[],enemies:[],pickups:[],cores:[{x:40,z:40},{x:42,z:40},{x:44,z:40}],exit:{x:46,z:40},
    progression:{version:1,weaponSlots:4,startWeapons:[true,true,true,true],startAmmo:[180,36,12,16],startShield:true,ammoCaps:[180,36,12,16],maxActive:8},...extra};
}
