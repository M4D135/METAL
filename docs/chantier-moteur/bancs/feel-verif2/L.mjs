// Main-realm loader (read-only on repo); patches in memory only.
import {readFileSync} from 'node:fs';import vm from 'node:vm';
export const ROOT=(process.env.METAL_ROOT||process.cwd());
export function load(mods=['renderer','world','destruction','economy','brain','simulation'],patch=null){
  const win={};globalThis.window=win;
  for(const n of mods){let src=readFileSync(ROOT+'/src/'+n+'.js','utf8');if(patch)src=patch(n,src);vm.runInThisContext(src,{filename:n+'.js'});}
  delete globalThis.window;return win;
}
export function rep(src,a,b){const i=src.indexOf(a);if(i<0)throw new Error('anchor missing: '+a.slice(0,80));if(src.indexOf(a,i+1)>=0)throw new Error('anchor not unique: '+a.slice(0,80));return src.slice(0,i)+b+src.slice(i+a.length);}
export function flat(extra={}){
  return {seed:'v2',stage:0,generation:6,spawn:{x:0,y:0,z:0,yaw:0},bounds:{minX:-50,maxX:50,minZ:-50,maxZ:50},
    walkable:[{x:0,y:0,z:0,w:100,d:100}],meshes:[],lights:[],colliders:[],enemies:[],pickups:[],cores:[{x:40,z:40},{x:42,z:40},{x:44,z:40}],exit:{x:46,z:40},
    progression:{version:1,weaponSlots:4,startWeapons:[true,true,true,true],startAmmo:[180,36,12,16],startShield:true,ammoCaps:[180,36,12,16],maxActive:8},...extra};
}
