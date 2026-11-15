import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const context={window:{}};vm.createContext(context);
for(const name of ['fmath','passages','renderer','world','destruction','economy','simulation'])vm.runInContext(readFileSync(name==='simulation'&&process.env.FERRO_TEST_SIMULATION?process.env.FERRO_TEST_SIMULATION:new URL('../src/'+name+'.js',import.meta.url),'utf8'),context,{filename:name+'.js'});
const {FSimulation,FWorld}=context.window;
const fixture=(extra={})=>({seed:'jump-test',stage:0,generation:6,spawn:{x:0,z:0,yaw:0},bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100},colliders:[],enemies:[],pickups:[],cores:[{id:0,x:85,z:85},{id:1,x:88,z:85},{id:2,x:91,z:85}],exit:{x:94,z:85},...extra});
const close=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b} (±${eps})`);
const advance=(s,time,input={},fps=120)=>{for(let t=0;t<time-1e-9;t+=1/fps)s.step(Math.min(1/fps,time-t),typeof input==='function'?input(t):input);};
const events=(s,name)=>s.state.events.filter(e=>e.name===name);
const substrate={x:0,z:0,w:200,d:200,y:0,substrate:true,fallback:true};
function wallWorld(extra={}){
  const mesh={shape:'box',p:[0,.36,-2],s:[20,.72,.6],mat:3,destructibleId:'boundary'};
  return fixture({meshes:[mesh],lights:[],outdoorBoundaries:[{mesh:0}],colliders:[{minX:-10,maxX:10,minY:0,maxY:.72,minZ:-2.3,maxZ:-1.7,mesh:0}],destructibles:[{id:'boundary',kind:'wall',strength:18,meshes:[0],colliders:[0]}],...extra});
}

test('legacy movement and jump-pad path ignore the new jump action over 3,600 steps',()=>{
  for(const world of [fixture({generation:undefined}),fixture({generation:5,jumpPads:[{id:'pad',x:0,y:0,z:-3,r:1,flightTime:1,target:{x:0,y:0,z:-10}}]})]){
    const a=FSimulation.create(world),b=FSimulation.create(world);
    for(let i=0;i<3600;i++){
      const input={moveY:i%180<120?1:-1,moveX:Math.sin(i/80)*.3,sprint:i%400<200,dash:i%120===0,lookX:.004};
      a.step(1/120,input);b.step(1/120,{...input,jump:i%45<3});
    }
    assert.equal(JSON.stringify(a.snapshot()),JSON.stringify(b.snapshot()));
    // Frozen from 930c199 before the modern-motion patch, not from this source.
    assert.equal(createHash('sha256').update(JSON.stringify(a.snapshot())).digest('hex'),world.generation===5?'42219798b0b2a171f5b2b6590b6eee0cfae3d220914404d8c60d76dd6aae2b0a':'66423ad46895ebea53a68d64a061f9ac13837af65084a81b27f2c3dd7eabd593');
  }
});

test('modern ramp, stop and reversal meet the movement targets at 20/60/120 Hz',()=>{
  const routes=[];
  for(const fps of [20,60,120]){
    const s=FSimulation.create(fixture());advance(s,.1,{moveY:1,sprint:true},fps);assert(s.state.locomotion.speed>=7.6*.9);
    advance(s,.9,{moveY:1,sprint:true},fps);const start=s.state.player.z;
    advance(s,.6,{},fps);const stopping=start-s.state.player.z;assert(stopping>=.6&&stopping<=.8,`stopping ${stopping}`);
    close(s.state.locomotion.speed,0);advance(s,.4,{moveY:1,sprint:true},fps);
    advance(s,.13,{moveY:-1,sprint:true},fps);assert(s.state.locomotion.vz>0);
    routes.push([s.state.player.x,s.state.player.z]);
  }
  for(const q of routes.slice(1))for(let i=0;i<2;i++)close(q[i],routes[0][i],.05);
});

test('free jump has 0.961 m apex, 620 ms flight and retains 7.6 m/s horizontal momentum',()=>{
  const s=FSimulation.create(fixture());advance(s,.5,{moveY:1,sprint:true});
  const start=s.state.player.z;let peak=0,flight=0;
  do{s.step(1/120,{jump:flight===0,moveY:1,sprint:true});peak=Math.max(peak,s.state.player.y);flight+=1/120;}while(s.state.player.airborne&&flight<2);
  close(peak,.961,.001);close(flight,.62,1/120);close(start-s.state.player.z,7.6*flight,.005);
  assert(s.state.locomotion.speed>=7.6*.9);assert.equal(events(s,'jump').length,1);assert.equal(events(s,'land').length,1);
});

test('grounded jump buffering creates a save opportunity and keeps its remaining-step momentum',()=>{
  for(const fps of [20,60,120]){
    const s=FSimulation.create(fixture());advance(s,.5,{moveY:1,sprint:true},fps);
    s.step(1/fps,{jump:true,moveY:1,sprint:true});let buffer=false,landed=false;
    for(let i=0;i<fps;i++){
      const p=s.state.player,press=!buffer&&p.airVY<0&&p.y<.55;
      if(press)buffer=true;s.step(1/fps,{jump:press,moveY:1,sprint:true});
      if(buffer&&!p.airborne){landed=true;assert(s.state.locomotion.speed>6.8);assert.equal(FSimulation.create(fixture()).restore(s.snapshot()),true);break;}
    }
    assert(landed,'no grounded snapshot opportunity');s.step(1/fps,{moveY:1,sprint:true});assert(s.state.player.airborne,'buffered jump was not consumed next step');
  }
});

test('coyote time is 100 ms and restoring a checkpoint clears pending jump input',()=>{
  const world=fixture({walkable:[{x:0,z:0,w:10,d:2,y:1},substrate]}),s=FSimulation.create(world);
  for(let i=0;i<120&&!s.state.player.airborne;i++)s.step(1/120,{moveY:1,sprint:true});
  assert(s.state.player.airborne);advance(s,.05);s.step(1/120,{jump:true});assert(s.state.player.airVY>5);
  const late=FSimulation.create(world);for(let i=0;i<120&&!late.state.player.airborne;i++)late.step(1/120,{moveY:1,sprint:true});advance(late,.11);late.step(1/120,{jump:true});assert(late.state.player.airVY<0,'expired grace period allowed a jump');
  const restored=FSimulation.create(fixture()),point=restored.snapshot();restored.step(.01,{jump:true});assert(restored.restore(point));restored.step(.01);assert.equal(restored.state.player.airborne,false);
});

test('modern fatal falls use launch height, with authored terraces and old impact rules intact',()=>{
  for(const [height,authored,dead,jump] of [[0,false,false,true],[1,false,false,false],[1,false,false,true],[3.2,false,true,false],[3.2,true,false,false]]){
    const world=fixture({walkable:[{x:0,z:0,w:4,d:2,y:height},{...substrate,...(authored?{substrate:false,fallback:false}: {})}]}),s=FSimulation.create(world);
    for(let i=0;i<240&&!s.state.dead;i++)s.step(1/120,{moveY:1,sprint:true,jump:jump&&i===0});
    assert.equal(s.state.dead,dead,`height=${height} authored=${authored} jump=${jump}`);
  }
});

test('standing outdoor boundaries block jumping at any height, and demolition opens the actual breach',()=>{
  const world=wallWorld({spawn:{x:0,z:2,yaw:0}}),s=FSimulation.create(world);advance(s,.2,{moveY:1,sprint:true});s.step(1/120,{jump:true,moveY:1,sprint:true});advance(s,1,{moveY:1,sprint:true});
  assert(s.state.player.z>-1.43);assert(events(s,'boundaryContact').length>0);
  s.destruction.blast([0,.4,-2],3,100);advance(s,.6,{moveY:1,sprint:true});assert(s.state.player.z<-3,'breach remained blocked');
  advance(s,.8,{moveY:-1,sprint:true});assert(s.state.player.z>-1,'return through breach blocked');
});

test('old checkpoints on the boundary crest can escape, and only the player is clipped',()=>{
  const world=wallWorld({spawn:{x:0,y:.72,z:-2,yaw:0},enemies:[]}),s=FSimulation.create(world),point=s.snapshot();
  assert(s.restore(point));advance(s,.7,{moveY:1,sprint:true});assert(s.state.player.z<-3);
  const other=FSimulation.create(wallWorld({walkable:[{x:0,z:0,w:200,d:200,y:2}],enemies:[{type:0,x:4,z:0}]})),enemy=other.state.enemies[0];other.move(enemy,0,-3);assert(enemy.z<-1.7);
});

test('steps up to 0.42 m are walkable but higher ledges and overhead obstacles block the player',()=>{
  for(const [height,ceiling,pass] of [[.4,false,true],[.5,false,false],[.4,true,false]]){
    const colliders=[{minX:-2,maxX:2,minZ:-3,maxZ:-1,minY:0,maxY:height}];
    if(ceiling)colliders.push({minX:-2,maxX:2,minZ:-3,maxZ:-1,minY:1.9,maxY:2.1});
    const s=FSimulation.create(fixture({colliders}));advance(s,.5,{moveY:1});assert.equal(s.state.player.z<-1,pass);
  }
});

test('extended SMG aim assistance belongs to touch, while pad retains the smaller cone',()=>{
  const hits=[];
  for(const assist of [{},{assist:true},{touchAssist:true}]){
    const s=FSimulation.create(fixture({enemies:[{type:0,x:.84,z:-10}]}));s.step(0,{fire:true,...assist});hits.push(s.state.hits);
  }
  assert.deepEqual(hits,[0,0,1]);
});

test('a dash leaving a ledge keeps its instantaneous speed and remaining invulnerability',()=>{
  for(const edge of [.3,1,2]){
    const s=FSimulation.create(fixture({walkable:[{x:0,z:1-edge,w:20,d:2,y:1},substrate]}));
    let invulnerable=0,takeoff=null;
    for(let i=0;i<30;i++){
      s.step(1/120,{dash:i===0,moveY:1,sprint:true});
      if(s.state.player.dashing>0)invulnerable+=1/120;
      if(takeoff===null&&s.state.player.airborne)takeoff=Math.hypot(s.state.player.airVX,s.state.player.airVZ);
    }
    assert(takeoff>=12&&takeoff<=16,`takeoff ${takeoff} at ${edge} m`);assert(invulnerable>=.18,`invulnerability ${invulnerable}`);assert.equal(s.state.dead,false);
  }
});

test('a six-second sequence of buffered jumps travels the same distance at 20/60/120 Hz',()=>{
  const positions=[];
  for(const fps of [20,60,120]){
    const s=FSimulation.create(fixture());advance(s,.5,{moveY:1,sprint:true},fps);let armed=true,groundFrames=0;
    for(let i=0;i<6*fps;i++){
      const p=s.state.player,press=armed&&(!p.airborne||p.airVY<0&&p.y<.5);if(press)armed=false;if(p.airVY>0)armed=true;
      s.step(1/fps,{moveY:1,sprint:true,jump:press});if(!p.airborne)groundFrames++;
    }
    positions.push(s.state.player.z);assert(groundFrames>0);assert(events(s,'jump').length>=7);
  }
  for(const z of positions)close(z,positions[0],.05);
});
