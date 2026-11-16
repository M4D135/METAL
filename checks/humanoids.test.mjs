// Humanoid machines from the EMPRISE parametric human (David, 16/11/2026).
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {FRenderMesh} from './mesh-fixture.mjs';
const load=(names,extra={})=>{const shapes=new Map(),ctx={window:{FRender:{mesh:FRenderMesh,forme:(name,triangles)=>shapes.set(name,triangles)},...extra}};vm.createContext(ctx);for(const n of names)vm.runInContext(readFileSync(new URL('../src/'+n+'.js',import.meta.url),'utf8'),ctx,{filename:n+'.js'});return {...ctx.window,shapes};};
const {MetalHumanoids:H,FActors:A,shapes}=load(['humanoids','actors']);
const {FActors:robotOnly}=load(['actors']);
const parts=Object.values(H.parts).flat();
const actor=(variant,extra={})=>({id:3,type:1,hp:5,maxHp:5,x:2,z:-3,baseY:0,y:1.05,yaw:.4,variant,awareness:'engage',active:true,attackState:'idle',aimX:2,aimY:1.4,aimZ:-12,...extra});

test('Every body part is a registered free shape inside the unit cube, from runtime code only',()=>{
  assert(H.registered);assert.equal(shapes.size,parts.length);assert(parts.length>=16);
  for(const q of parts){const t=shapes.get(q.shape);assert(t&&t.length===q.triangles&&q.triangles>40,q.shape);
    for(const tri of t){for(let k=0;k<3;k++)assert(tri[k].every(v=>v>=-.5-1e-9&&v<=.5+1e-9),q.shape);for(let k=3;k<6;k++)assert(Math.abs(Math.hypot(...tri[k])-1)<1e-6);}}
  assert(H.triangles<7000,'a light body for hordes: '+H.triangles);assert.match(H.provenance,/EMPRISE/);
  // Front is -z in METAL: the toes and the face point that way.
  assert(H.parts.foot[0].centre[2]<0&&H.parts.face.centre[2]<0);
});

test('The gait keeps the planted foot on the ground and bends the knees when crouching',()=>{
  for(const [phase,amount,crouch] of [[0,0,0],[.3,1,0],[1.1,1.4,0],[0,0,.17],[2,1,.17]]){
    const g=H.gait(phase,amount,crouch);if(!g.stance)continue;
    const hip=.97+g.bodyY,knee=hip-.45*Math.cos(g.hip),ankle=knee-.375*Math.cos(g.hip+g.knee);
    assert(Math.abs(ankle-.145)<1e-4,`ankle ${ankle} at ${phase}/${amount}/${crouch}`);assert(g.knee<=0);
  }
  assert(H.gait(0,0,.17).knee<H.gait(0,0,0).knee-.3,'a crouch bends the knees');
});

test('The endoskeleton gunner, the liquid blade and the headless bomber are distinct bodies',()=>{
  const names=v=>new Set(A.build(actor(v,v==='endo'?{weapon:'rocket'}:{}),{time:1,distance:3,quality:'high',backend:'webgl2'}).map(m=>m.actorPart));
  const endo=names('endo'),blade=names('blade'),bomber=names('kamikaze');
  for(const part of ['endo-skull','endo-eye--1','endo-eye-1','endo-rib-0','rocket-launcher','endo-thigh-1'])assert(endo.has(part),part);
  for(const part of ['hum-face','hum-torso','liquid-blade-1','hum-thigh--1'])assert(blade.has(part),part);
  for(const part of ['kamikaze-bomb--1','kamikaze-bomb-1','kamikaze-socket','hum-torso'])assert(bomber.has(part),part);
  assert(!bomber.has('hum-face'),'headless');assert(!names('blade').has('heavy-torso'));
  const patrol=new Set(A.build(actor('blade',{awareness:'patrol',active:false}),{time:1,distance:3,quality:'high',backend:'webgl2'}).map(m=>m.actorPart));
  assert(!patrol.has('liquid-blade-1')&&patrol.has('hum-hand-1'),'blades only once engaged');
  const far=A.build(actor('kamikaze'),{time:1,distance:60,quality:'high',backend:'webgl2'});assert(far.length<=14&&far.every(m=>!m.shape.startsWith('metal-hum-')),'cheap primitives far away');
  for(const v of ['endo','blade','kamikaze'])for(const m of A.build(actor(v),{time:1.7,phase:1.2,blend:1,distance:4,quality:'high',backend:'webgl2'}))assert([...m.p,...m.s,...m.r].every(Number.isFinite),v+' '+m.actorPart);
});

test('Humanoid guardians keep the simulation weak point and shoulder guns',()=>{
  for(const look of ['endo','liquid']){
    const e={id:9,type:3,hp:900,maxHp:900,x:4,z:-2,baseY:0,y:5,yaw:.7,bossScale:5.4,bossLook:look,bossKind:'colossus',bossAwake:true,weakPointOpen:true,aimX:4,aimY:2,aimZ:30};
    const meshes=A.build(e,{time:2,distance:40,quality:'high',backend:'webgl2'}),heart=meshes.find(m=>m.actorPart==='titan-heart'),guns=meshes.filter(m=>/^titan-gun--?1$/.test(m.actorPart));
    const yaw=-e.yaw,expect=[e.x+Math.cos(yaw)*0+Math.sin(yaw)*-.9*5.4,1.93*5.4,e.z-Math.sin(yaw)*0+Math.cos(yaw)*-.9*5.4];
    assert(heart);for(let k=0;k<3;k++)assert(Math.abs(heart.p[k]-expect[k])<1e-6,look+' heart '+k);assert(Math.abs(heart.s[0]-.72*5.4)<1e-9);
    assert.equal(guns.length,2);assert(guns.every(m=>Math.abs(m.p[1]-2.28*5.4)<1.2*5.4));
    assert(meshes.some(m=>m.shape.startsWith('metal-hum-')),'a humanoid body');assert(!meshes.some(m=>/titan-horn|titan-chimney|titan-crown/.test(m.actorPart)));
  }
});

test('Without the humanoid module the machines fall back to the robots',()=>{
  const meshes=robotOnly.build(actor('kamikaze'),{time:1,distance:3,quality:'high',backend:'webgl2'});
  assert(meshes.length>10&&!meshes.some(m=>/^hum-|^kamikaze-|^endo-/.test(m.actorPart)));
});

test('Chapter liveries recolour the robots but never the playable heavy',()=>{
  const plain=A.build({id:1,type:1,hp:5,x:0,z:0,baseY:0,y:1.05,yaw:0},{time:1,distance:3,quality:'high',backend:'webgl2'}),tinted=A.build({id:1,type:1,hp:5,x:0,z:0,baseY:0,y:1.05,yaw:0,livery:4},{time:1,distance:3,quality:'high',backend:'webgl2'});
  const torso=list=>list.find(m=>m.actorPart==='torso').color;assert.notDeepEqual(torso(plain),torso(tinted));
  const own=A.build({id:1,type:1,hp:5,x:0,z:0,baseY:0,y:1.05,yaw:0,livery:4},{time:1,distance:3,quality:'high',backend:'webgl2',palette:{shell:[.1,.2,.3]}});assert.deepEqual([...torso(own)],[.1,.2,.3]);
});
