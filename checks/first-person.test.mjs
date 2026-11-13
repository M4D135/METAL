import test from 'node:test';
import assert from 'node:assert/strict';
import {viewModels,primitivePoints,localCorners,bounds,projectedHull} from './first-person-fixture.mjs';

const camera={pos:[11,8.62,-12],yaw:.68,pitch:.37,roll:.025,fov:74};
const level={pos:[0,1.62,0],yaw:0,pitch:0,roll:0,fov:74};
const plain=v=>JSON.parse(JSON.stringify(v));
const frames=[[1280,720],[844,390],[390,844],[320,568]];
const profiles=['still','runleft','runright','lookleft','lookright','recoil'];
function animate(app,profile,weapon,enabled=true){
  app.motion.reset();app.leftMotion.reset();
  const impulse=profile==='recoil'?(weapon===4?'pistol':weapon===2||weapon===3?'rocket':weapon===1?'fracture':'shot'):null;
  if(impulse)app.motion.impulse(impulse);
  const side=profile.endsWith('left')?-1:1,loc=profile.startsWith('run')?{speed:7.6,sprintBlend:1,moveBlend:1,strafe:side*5,stridePhase:2,accelForward:20}:{};
  for(let i=0;i<(impulse?4:45);i++)for(const m of [app.motion,app.leftMotion])m.update(1/120,loc,{time:3,lookYaw:profile.startsWith('look')?side*8:0,lookPitch:profile.startsWith('look')?side*6:0},enabled);
}

test('Every first-person part stays in front of the near plane and each hand keeps its own side of the sight',()=>{
  const app=viewModels(),vertices=primitivePoints();let checked=0;
  for(const [width,height] of frames)for(let weapon=0;weapon<5;weapon++)for(const profile of profiles){
    app.context.innerWidth=width;app.context.innerHeight=height;app.state.weapon=weapon;animate(app,profile,weapon);
    app.state.equipment.left=null;const count=app.build(camera).length;assert(count>0,'the right hand always draws its gun');
    app.state.equipment.left=(weapon+1)%5;const all=app.build(camera);
    assert(all.length>count,'the left hand adds its own complete weapon');
    const right=all.slice(0,count),left=all.slice(count);
    for(const part of all){
      assert(part.p.concat(part.s,part.r).every(Number.isFinite));
      assert(part.overlay&&part.surface==='object','First-person parts share one overlay pass');
      assert(localCorners(part,camera,vertices[part.shape]).every(p=>p[2]<-.045),'Every first-person part stays in front of the near plane');
    }
    const centre=m=>{const c=bounds([m],camera).projected;return (c.minX+c.maxX)/2;};
    assert(centre(right[0])>.05,'the right hand sits right of the sight line');
    assert(centre(left[0])<-.05,'the left hand sits left of the sight line');
    checked+=all.length;
  }
  assert(checked>3000);
});

test('Both hands stay clear of the crosshair on every phone and desktop frame',()=>{
  const app=viewModels(),vertices=primitivePoints();
  for(const [width,height] of frames)for(let weapon=0;weapon<5;weapon++){
    app.context.innerWidth=width;app.context.innerHeight=height;app.state.weapon=weapon;animate(app,'still',weapon);
    app.state.equipment.left=(weapon+1)%5;const all=app.build(level),vertical=Math.tan(60*Math.PI/360);
    let top=-Infinity;
    for(const part of all){
      assert(projectedHull(part,level,vertices[part.shape]).length>=3,'A gun part keeps a real silhouette');
      const c=bounds([part],level).projected;
      assert(!(c.minX<=0&&c.maxX>=0&&c.minY<=0&&c.maxY>=0),'No gun part may cover the crosshair');
      top=Math.max(top,c.maxY);
    }
    assert(top>-vertical,'The paired hands stay inside the visible frame at the narrowest FOV');
  }
});

test('Equipping or changing the left-hand weapon never moves the right-hand gun or its muzzle assembly',()=>{
  const app=viewModels();
  for(const [width,height] of frames)for(let weapon=0;weapon<5;weapon++)for(const enabled of [true,false]){
    app.context.innerWidth=width;app.context.innerHeight=height;app.state.weapon=weapon;animate(app,'recoil',weapon,enabled);
    app.state.equipment.left=null;const count=app.build(camera).length;assert(count>0,'the right hand always draws its gun');
    app.state.equipment.left=(weapon+1)%5;const paired=plain(app.build(camera));
    assert(paired.length>count,'the left hand adds its own complete weapon');
    for(const left of [(weapon+1)%5,(weapon+2)%5,(weapon+3)%5,(weapon+4)%5]){
      app.state.equipment.left=left;
      assert.deepEqual(plain(app.build(camera).slice(0,count)),paired.slice(0,count),'The right gun keeps the exact paired-hand mount used by dual weapons');
    }
    app.state.equipment.left=null;const alone=app.build(camera);
    assert.equal(alone.length,count,'a free left hand removes no right-hand part');
    assert(alone[0].p[1]>paired[0].p[1]&&alone[0].p[2]>paired[0].p[2],'the single-hand mount sits higher and closer than the paired one');
  }
});
