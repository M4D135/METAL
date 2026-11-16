import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {FRenderMesh} from './mesh-fixture.mjs';

const context={window:{FRender:{mesh:FRenderMesh}}};vm.createContext(context);
for(const name of ['actors','avatars','camera'])vm.runInContext(readFileSync(new URL('../src/'+name+'.js',import.meta.url),'utf8'),context,{filename:name+'.js'});
const {MetalCamera,MetalAvatars}=context.window;
const open=(o,d,far)=>far;
// Axis-aligned walls with the same contract as FSimulation.ray: free distance, or far.
function walls(list){return (o,d,far)=>{let best=far;for(const q of list){let lo=0,hi=best;for(let k=0;k<3;k++){if(Math.abs(d[k])<1e-9){if(o[k]<q.min[k]||o[k]>q.max[k]){hi=-1;break;}}else{let a=(q.min[k]-o[k])/d[k],c=(q.max[k]-o[k])/d[k];if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(hi<lo)break;}}if(hi>=lo&&lo>=0&&lo<best)best=lo;}return best;};}
const settle=(camera,player,ray,options={})=>{let f;for(let i=0;i<180;i++)f=camera.frame(player,ray,1/60,options);return f;};
const direction=(yaw,pitch)=>[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
const finite=meshes=>meshes.every(m=>[...m.p,...m.s,...m.r].every(Number.isFinite));

test('first person keeps the eye; third person sits behind and above the right shoulder of the heavy',()=>{
  const camera=MetalCamera.create(),player={x:0,y:0,z:0,yaw:0,pitch:0};camera.reset(false);
  let f=settle(camera,player,open);assert.equal(f.thirdPerson,false);assert.deepEqual(Array.from(f.pos),[0,1.62,0]);
  camera.set(true);f=camera.frame(player,open,1/60);assert(f.distance>0&&f.distance<3.2,'the camera eases out');
  f=settle(camera,player,open);assert(f.thirdPerson);assert.equal(f.distance,3.2);
  // Yaw 0 looks toward -z: behind is +z and the right shoulder is +x.
  assert(f.pos[2]>3.1&&f.pos[0]>.7&&f.pos[1]>2);
  camera.set(false);f=settle(camera,player,open);assert.equal(f.distance,0);assert.equal(f.thirdPerson,false);
});

test('the third-person view is centred on the very point the firing ray reaches',()=>{
  const wall=walls([{min:[-60,-5,-26],max:[60,40,-25]}]);
  for(const [yaw,pitch] of [[0,0],[.7,.2],[-.4,-.35],[2.6,.5]]){
    const camera=MetalCamera.create(),player={x:2,y:1,z:-3,yaw,pitch};camera.reset(true);
    const before={...player},f=settle(camera,player,wall);assert(f.thirdPerson);assert.deepEqual(player,before,'the camera never moves the aim');
    const eye=[player.x,player.y+1.62,player.z],aim=direction(yaw,pitch),reach=Math.min(120,wall(eye,aim,120)),target=eye.map((v,k)=>v+aim[k]*Math.max(5,reach));
    const toward=target.map((v,k)=>v-f.pos[k]),length=Math.hypot(...toward),view=direction(f.yaw,f.pitch);
    assert(toward.reduce((n,v,k)=>n+v/length*view[k],0)>1-1e-6,JSON.stringify({yaw,pitch}));
  }
});

test('a wall behind pulls the camera in front of it, then hides the body when it is too close',()=>{
  const camera=MetalCamera.create(),player={x:0,y:0,z:0,yaw:0,pitch:0};camera.reset(true);
  let f=settle(camera,player,walls([{min:[-5,-1,1.5],max:[5,5,1.7]}]));assert(f.thirdPerson);assert(f.pos[2]<1.5,'the camera stays on the player side');assert(f.clearance<1.5);
  f=settle(camera,player,walls([{min:[-5,-1,.5],max:[5,5,.7]}]));assert.equal(f.thirdPerson,false,'too close: first person');
  f=settle(camera,player,open);assert(f.thirdPerson,'the camera comes back once the wall is gone');
  // The shoulder offset is also swept: a wall on the right keeps the eye on the player's side.
  f=settle(camera,player,walls([{min:[.4,-1,-5],max:[.6,5,5]}]));assert(f.thirdPerson);assert(f.pos[0]<.4);
});

test('looking up near the floor never sends the camera underground',()=>{
  const camera=MetalCamera.create(),player={x:0,y:0,z:0,yaw:0,pitch:1.1};camera.reset(true);
  const f=settle(camera,player,open,{ground:()=>0});assert(f.pos[1]>=.3-1e-9);
});

test('the drone is followed from straight behind, a little closer than the heavy',()=>{
  const camera=MetalCamera.create(),player={x:0,y:0,z:0,yaw:0,pitch:0};camera.reset(true);
  const f=settle(camera,player,open,{profile:'light'});assert(f.thirdPerson);assert(Math.abs(f.pos[0])<1e-9);assert.equal(f.distance,2.7);
});

test('the heavy hero is a real articulated body in its own livery, aiming where the player aims',()=>{
  const player={x:3,y:0,z:-2,yaw:.4,pitch:.25},hero=MetalAvatars.heavy(player,{time:2,weapon:4,distance:3});
  const enemy=context.window.FActors.build({id:1,type:1,x:3,z:-2,baseY:0,y:1.05,yaw:.4,hp:1,awareness:'patrol'},{time:2,distance:3});
  assert(hero.length>40);assert(finite(hero));assert(hero.every(m=>m.playerAvatar==='heavy'&&m.surface==='object'&&!m.overlay));
  const shell=hero.find(m=>m.actorPart==='torso'),visor=hero.find(m=>m.actorPart==='visor');
  assert.notDeepEqual(Array.from(shell.color),Array.from(enemy.find(m=>m.actorPart==='torso').color),'never mistaken for a machine');
  assert.deepEqual(Array.from(visor.color),[.80,.98,.34]);
  for(const weapon of [2,3])assert(MetalAvatars.heavy(player,{weapon}).some(m=>/launcher/.test(m.actorPart)),'launchers are visible');
  assert(MetalAvatars.heavy(player,{weapon:4,flash:1}).length>hero.length,'muzzle flash in third person');
});

test('the drone shows the same cannon on both mounts, mirrored, with flashes and boost flames',()=>{
  const player={x:0,y:0,z:0,yaw:0,pitch:0};
  for(const [weapon,barrels] of [[4,2],[0,2],[1,4]]){
    const drone=MetalAvatars.drone(player,{time:0,weapon});assert(finite(drone));assert(drone.every(m=>m.playerAvatar==='light'));
    const tubes=drone.filter(m=>m.shape==='cylinder'&&m.s[1]>.3);assert.equal(tubes.length,barrels,'weapon '+weapon);
    const xs=tubes.map(m=>m.p[0]).sort((a,b)=>a-b);for(let i=0;i<xs.length;i++)assert(Math.abs(xs[i]+xs[xs.length-1-i])<1e-9,'mirrored mounts');
  }
  const still=MetalAvatars.drone(player,{weapon:4}),fired=MetalAvatars.drone(player,{weapon:4,flash:1}),boost=MetalAvatars.drone(player,{weapon:4,boosting:true});
  assert.equal(fired.filter(m=>m.shape==='octa').length-still.filter(m=>m.shape==='octa').length,2,'one flash per cannon');
  assert(boost.length>still.length,'boost flames');
  const tilted=MetalAvatars.drone(player,{weapon:4,forward:9}),hull=m=>m.find(q=>q.shape==='bevel');assert(hull(tilted).r[0]<hull(still).r[0],'nose dips when flying forward');
});
