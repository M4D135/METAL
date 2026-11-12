import test from 'node:test';
import assert from 'node:assert/strict';
import {viewModels,primitivePoints,localCorners,bounds,projectedHull,visibleOverlap} from './first-person-fixture.mjs';

const camera={pos:[11,8.62,-12],yaw:.68,pitch:.37,roll:.025,fov:74};
const plain=v=>JSON.parse(JSON.stringify(v));
const frames=[[1280,720],[844,390],[390,844],[320,568]];
const profiles=['still','runleft','runright','lookleft','lookright','recoil','melee'];
function animate(app,profile,weapon,enabled=true){
  app.motion.reset();app.leftMotion.reset();
  const impulse=profile==='melee'?'melee':profile==='recoil'?(weapon===4?'pistol':weapon===2||weapon===3?'rocket':weapon===1?'fracture':'shot'):null;
  if(impulse)app.motion.impulse(impulse);
  const side=profile.endsWith('left')?-1:1,loc=profile.startsWith('run')?{speed:7.6,sprintBlend:1,moveBlend:1,strafe:side*5,stridePhase:2,accelForward:20}:{};
  for(let i=0;i<(impulse?4:45);i++)for(const m of [app.motion,app.leftMotion])m.update(1/120,loc,{time:3,lookYaw:profile.startsWith('look')?side*8:0,lookPitch:profile.startsWith('look')?side*6:0},enabled);
}
function split(meshes){const first=meshes.findIndex(m=>m.fx);assert(first>0);return {gun:meshes.slice(0,first),shield:meshes.slice(first)};}

test('The actual shield frame clears all five gun silhouettes through guard, bash, motion, portrait and FOV extremes',()=>{
  const app=viewModels(),vertices=primitivePoints();let checked=0;
  for(const [width,height] of frames)for(let weapon=0;weapon<5;weapon++)for(const profile of profiles){
    app.context.innerWidth=width;app.context.innerHeight=height;app.state.weapon=weapon;animate(app,profile,weapon);
    const gun=split(app.build(camera)).gun.map(m=>projectedHull(m,camera,vertices[m.shape]));
    for(const guard of [0,.25,.5,.75,1])for(const bash of [0,.25,.5,.75,1]){
      app.context.shieldLift=guard;app.state.shield.bashVisual=bash*.35;
      const {shield}=split(app.build(camera));
      for(const part of shield){
        assert(part.p.concat(part.s,part.r).every(Number.isFinite));
        assert(localCorners(part,camera).every(p=>p[2]<-.045),'Every shield part stays in front of the near plane');
      }
      const frame=shield.filter(m=>!m.fx).map(m=>projectedHull(m,camera,vertices[m.shape]));
      for(const fov of [60,110]){
        const vertical=Math.tan(fov*Math.PI/360),horizontal=vertical*width/height;
        for(const a of gun)for(const b of frame)assert(!visibleOverlap(a,b,horizontal,vertical),JSON.stringify({width,height,weapon,profile,guard,bash,fov}));
      }
      checked++;
    }
  }
  assert.equal(checked,3500);
});

test('Guard is compact, translucent and left of the sight, while every part follows the same raise and bash mount',()=>{
  const app=viewModels();app.context.shieldLift=0;const lowered=split(app.build(camera)).shield;
  app.context.shieldLift=1;const raised=split(app.build(camera)).shield,panel=bounds([raised[0]],camera);
  assert.equal(raised.length,10,'No new first-person instances are required');
  assert(panel.projected.maxX<-.11,'Opaque rim and glass stay left of the sight line');
  const height=(panel.projected.maxY-panel.projected.minY)/(2*Math.tan(60*Math.PI/360));
  assert(height<.61,'Even at the minimum FOV the raised panel fits within 61% of the screen height');
  assert(raised[0].p[1]>lowered[0].p[1]);
  for(const energy of [0,20,100])for(const guard of [0,.5,1])for(const bash of [0,.175,.35]){
    app.context.shieldLift=guard;Object.assign(app.state.shield,{energy,bashVisual:bash});
    const parts=split(app.build(camera)).shield;
    assert(parts[0].fx&&parts[0].alpha>.05&&parts[0].alpha<.2);
    assert(parts.every(p=>p.overlay&&p.surface==='object'));
    for(let i=1;i<parts.length;i++){
      const distance=Math.hypot(...parts[i].p.map((v,k)=>v-parts[0].p[k])),reference=Math.hypot(...raised[i].p.map((v,k)=>v-raised[0].p[k]));
      assert(Math.abs(distance-reference)<1e-8,'A hand or frame piece detached from the shield mount');
    }
  }
  app.context.shieldLift=1;app.state.shield.bashVisual=.175;
  assert(bounds([split(app.build(camera)).shield[0]],camera).max[2]<panel.min[2]-.1,'The bash pushes the complete shield forward');
});

test('Equipping, raising and bashing the shield never changes a right-hand weapon or its muzzle assembly',()=>{
  const app=viewModels();
  for(const [width,height] of frames)for(let weapon=0;weapon<5;weapon++)for(const enabled of [true,false]){
    app.context.innerWidth=width;app.context.innerHeight=height;app.state.weapon=weapon;animate(app,'recoil',weapon,enabled);
    app.state.equipment.left='shield';app.context.shieldLift=0;app.state.shield.bashVisual=0;
    const original=plain(split(app.build(camera)).gun),count=original.length;
    for(const guard of [0,.5,1])for(const bash of [0,.175,.35]){
      app.context.shieldLift=guard;app.state.shield.bashVisual=bash;
      assert.deepEqual(plain(split(app.build(camera)).gun),original);
    }
    app.state.equipment.left=(weapon+1)%5;
    assert.deepEqual(plain(app.build(camera).slice(0,count)),original,'The right gun keeps the exact paired-hand mount used by dual weapons');
  }
});
