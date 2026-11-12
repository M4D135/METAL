// (d) Fall-death rule against jumps: prototype with the current threshold (6 m/s) and the proposed one (7.75), real sim.step.
import {loadFast} from './lib.mjs';import {physPatches} from './phys.mjs';
const world=(spawnY,box)=>({seed:'fatal',stage:0,generation:6,spawn:{x:0,y:spawnY,z:0,yaw:0},bounds:{minX:-40,maxX:40,minZ:-40,maxZ:40},
  walkable:[{x:0,y:0,z:0,w:6,d:6},{x:0,y:-.25,z:0,w:80,d:80,substrate:true,fallback:true}],meshes:[],lights:[],
  colliders:[{minX:-3.26,maxX:3.26,minZ:-3.26,maxZ:-2.74,minY:0,maxY:.72},...(box?[{minX:-.6,maxX:.6,minZ:-.2,maxZ:1,minY:0,maxY:box}]:[])],enemies:[],pickups:[],cores:[{x:30,z:30},{x:32,z:30},{x:34,z:30}],exit:{x:36,z:30}});
const rows=[];
for(const fatal of [6,7.75]){const W=loadFast({patches:physPatches({fatal})});
  const test=(name,w,start,script)=>{const sim=W.FSimulation.create(w,{}),s=sim.state,p=s.player;if(start){p.x=start[0];p.y=start[1];p.z=start[2];}const input={moveX:0,moveY:0,sprint:true};let maxY=p.y;
    for(let i=0;i<240&&!s.dead;i++){script(i,input,p);sim.step(1/60,input);maxY=Math.max(maxY,p.y);}
    rows.push({'seuil m/s':fatal,cas:name,mort:s.dead,'position finale':[p.x.toFixed(1),p.y.toFixed(2),p.z.toFixed(1)].join(' '),impact:(sim.__I.HK.lastImpact||0).toFixed(2)});};
  test('saut sur place, sur le substrat (hors zone)',world(0),[10,-.25,10],(i,inp)=>{inp.jump=i===5;});
  test('saut par-dessus la barrière 0,72 m depuis le sol (y=0)',world(0),[0,0,0],(i,inp)=>{inp.moveY=1;inp.jump=i===18;});
  test('saut par-dessus la barrière depuis une caisse de 0,40 m',world(.4,.4),[0,.4,.5],(i,inp)=>{inp.moveY=1;inp.jump=i===3;});
  test('saut par-dessus la barrière depuis une caisse de 1,00 m',world(1,1),[0,1,.5],(i,inp)=>{inp.moveY=1;inp.jump=i===3;});
  test('pas dans le vide depuis une caisse de 1,00 m (sans saut), côté sans barrière',world(1,1),[0,1,.5],(i,inp,p)=>{p.yaw=Math.PI;inp.moveY=1;});
}
console.table(rows);
