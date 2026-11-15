// Articulation, real transformations and renderer budgets, without DOM or assets.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {FRenderMesh} from './mesh-fixture.mjs';
const sandbox={window:{FRender:{mesh:FRenderMesh}}};
vm.runInNewContext(readFileSync(new URL('../src/actors.js',import.meta.url),'utf8'),sandbox);
const {build}=sandbox.window.FActors;
const HEIGHT=[1.35,1.05,1.6,1.8],nearCounts=[35,45,40,55],middleCounts=[16,16,15,16];
const entity=(type,overrides={})=>({id:7,type,hp:type===3?30:5,x:2,z:-3,baseY:0,y:HEIGHT[type],yaw:0,moveSpeed:1.5,awareness:'engage',attackState:'idle',stun:0,hurt:0,windup:0,phase:0,aimX:2,aimY:1.45,aimZ:-25,goalX:2,goalZ:-25,...overrides});
const options={time:2.5,phase:.7,blend:.8,distance:4,quality:'auto',backend:'webgl2'};
const close=(a,b,msg)=>assert(Math.abs(a-b)<1e-8,`${msg}: ${a} != ${b}`);
const vecclose=(a,b,msg)=>a.forEach((v,i)=>close(v,b[i],msg+' axis'+i));
function matrix(r){const [x,y,z]=r,a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z);return [e*c,e*d*b-f*a,e*d*a+f*b,f*c,f*d*b+e*a,f*d*a-e*b,-d,c*b,c*a];}
const transform=(a,p)=>[a[0]*p[0]+a[1]*p[1]+a[2]*p[2],a[3]*p[0]+a[4]*p[1]+a[5]*p[2],a[6]*p[0]+a[7]*p[1]+a[8]*p[2]];
function multiply(a,b){return [0,1,2].flatMap(r=>[0,1,2].map(c=>a[r*3]*b[c]+a[r*3+1]*b[c+3]+a[r*3+2]*b[c+6]));}
function endpoints(m){const a=matrix(m.r),v=[a[1]*m.s[1]/2,a[4]*m.s[1]/2,a[7]*m.s[1]/2];return [m.p.map((x,i)=>x-v[i]),m.p.map((x,i)=>x+v[i])];}
function nearest(points,p){return Math.min(...points.map(q=>Math.hypot(...p.map((v,i)=>v-q[i]))));}
function bounds(meshes){const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];for(const m of meshes){const a=matrix(m.r);for(let axis=0;axis<3;axis++){const h=(Math.abs(a[axis*3])*m.s[0]+Math.abs(a[axis*3+1])*m.s[1]+Math.abs(a[axis*3+2])*m.s[2])/2;low[axis]=Math.min(low[axis],m.p[axis]-h);high[axis]=Math.max(high[axis],m.p[axis]+h);}}return {low,high,size:high.map((v,i)=>v-low[i])};}

test('four families have bounded tiers, polished close geometry and object materials',()=>{
  const allowed=new Set(['box','bevel','sphere','cylinder','octa','ring']);
  for(let type=0;type<4;type++)for(const backend of ['webgl2','canvas2d'])for(const quality of ['auto','high','low'])for(const [lod,distance] of [[0,4],[1,18],[2,50]]){
    const meshes=build(entity(type),{...options,distance,quality,backend});
    assert.equal(meshes.length,lod===0?nearCounts[type]+(backend==='webgl2'&&quality!=='low'?14:0):lod===1?middleCounts[type]:6);
    assert.equal(new Set(meshes.map(m=>m.actorPart)).size,meshes.length,'duplicate model part names');
    const bevels=meshes.filter(m=>m.shape==='bevel');
    assert(lod?bevels.length===0:bevels.length>=3&&bevels.length<=6,'chamfers must be on a few close armor shells');
    for(const m of meshes){
      assert(allowed.has(m.shape));assert.equal(m.surface,'object','architectural grid returned on enemy surface');
      assert.equal(m.actorLod,lod);assert(m.s.every(v=>Number.isFinite(v)&&v>0));assert(m.p.every(Number.isFinite)&&m.r.every(Number.isFinite));
      assert(m.color.length===3&&m.color.every(v=>v>=0&&v<=1));assert(m.emissive>=0&&m.emissive<1);
      if(m.emissive)assert(m.s[0]*m.s[1]*m.s[2]<.025,'large glowing body obscures mechanical finish');
    }
  }
});

test('close metal construction follows articulated shells and vanishes outside the GPU detail tier',()=>{
  const anchors=['drone-hull','helmet','turret-sensor-housing','custodian-plastron'];
  const parts=['detail-drone-bolt','detail-helmet-bolt','detail-sensor-bolt','detail-plastron-bolt'];
  for(let type=0;type<4;type++)for(const yaw of [-2.1,0,.9])for(const stun of [0,.3]){
    const e=entity(type,{yaw,stun}),meshes=build(e,{...options,phase:1.2,time:3}),anchor=meshes.find(m=>m.actorPart===anchors[type]);
    const bolts=meshes.filter(m=>m.actorPart.startsWith(parts[type]));assert.equal(bolts.length,4);
    assert.equal(meshes.filter(m=>m.actorPart.startsWith('detail-')).length,14);
    const a=matrix(anchor.r),axis=type===0?1:2;
    for(const bolt of bolts){
      const d=bolt.p.map((v,i)=>v-anchor.p[i]),local=[0,1,2].map(k=>a[k]*d[0]+a[k+3]*d[1]+a[k+6]*d[2]);
      close(Math.abs(local[axis]),anchor.s[axis]/2+bolt.s[1]/2,'bolt must touch its shell, including during stun and yaw');
      for(let k=0;k<3;k++)if(k!==axis)assert(Math.abs(local[k])+bolt.s[0]/2<anchor.s[k]/2);
    }
    for(const less of [{backend:'canvas2d'},{quality:'low'},{distance:50}]){
      assert(!build(e,{...options,...less}).some(m=>m.actorPart.startsWith('detail-')),'lower tiers retain their existing model budgets');
    }
  }
});

test('model generation is pure, deterministic and keeps its heading under all joint rotations',()=>{
  for(let type=0;type<4;type++){
    const e=Object.freeze(entity(type)),before=JSON.stringify(e),initial=build(e,options);
    assert.equal(JSON.stringify(initial),JSON.stringify(build(e,options)));assert.equal(before,JSON.stringify(e));
    for(const yaw of [Math.PI/2,-Math.PI/2,Math.PI,.73]){
      const moved=build({...e,yaw},options),turn=matrix([0,-yaw,0]);
      for(let i=0;i<initial.length;i++){
        const a=initial[i],b=moved[i];
        // A fixed emplacement turns its upper carriage above a stationary tripod.
        if(type===2&&/^(turret-(pad|strut|pivot|swivel|foundation|hinge|piston)|detail-turret-(bearing|jacket))/.test(a.actorPart)){vecclose(b.p,a.p,'fixed turret base');continue;}
        const offset=[a.p[0]-e.x,a.p[1]-e.baseY,a.p[2]-e.z],expected=transform(turn,offset).map((v,j)=>v+[e.x,e.baseY,e.z][j]);
        vecclose(b.p,expected,'rotated '+a.actorPart);
        vecclose(matrix(b.r),multiply(turn,matrix(a.r)),'oriented '+a.actorPart);
      }
    }
  }
});

test('optics and long weapon barrels face the actual simulated yaw',()=>{
  const sensor=['camera','visor','turret-optic','custodian-optic'],barrel=['drone-gun','rifle-barrel','turret-barrel-1','custodian-barrel-1'];
  for(let type=0;type<4;type++)for(const yaw of [0,.8,Math.PI/2,Math.PI]){
    const e=entity(type,{yaw,attackState:'aim',aimX:2+Math.sin(yaw)*22,aimZ:-3-Math.cos(yaw)*22});
    const meshes=build(e,{...options,blend:0}),eye=meshes.find(m=>m.actorPart===sensor[type]),gun=meshes.find(m=>m.actorPart===barrel[type]);
    const forward=[Math.sin(yaw),0,-Math.cos(yaw)],delta=[eye.p[0]-e.x,0,eye.p[2]-e.z];
    assert(delta[0]*forward[0]+delta[2]*forward[2]>.22,'sensor points behind actor');
    const a=matrix(gun.r),axis=[a[1],a[4],a[7]],cosine=Math.abs(axis[0]*forward[0]+axis[2]*forward[2]);
    assert(cosine>.91,'barrel rotated sideways instead of along aim');
  }
});

test('every model translates exactly with a 3.2m/6.4m terrace, including articulated attachments',()=>{
  for(let type=0;type<4;type++)for(const distance of [4,18,50])for(const height of [3.2,6.4]){
    const a=build(entity(type),{...options,distance}),b=build(entity(type,{baseY:height,y:HEIGHT[type]+height,aimY:1.45+height}),{...options,distance});
    assert.equal(a.length,b.length);
    a.forEach((m,i)=>{vecclose(b[i].p,[m.p[0],m.p[1]+height,m.p[2]],'raised '+m.actorPart);vecclose(b[i].r,m.r,'raised orientation');});
  }
  for(let type=0;type<4;type++){
    const a=build(entity(type,{baseY:undefined,y:HEIGHT[type]+3.2}),options),b=build(entity(type,{baseY:3.2,y:HEIGHT[type]+3.2}),options);
    a.forEach((m,i)=>{vecclose(m.p,b[i].p,'inferred feet');vecclose(m.r,b[i].r,'inferred orientation');});
  }
});

test('guns elevate toward a player on a nearby upper terrace without detaching the hands',()=>{
  for(const type of [1,2,3])for(const targetY of [.25,4.65,7.85]){
    const e=entity(type,{attackState:'aim',aimX:2,aimZ:-7,aimY:targetY}),model=build(e,{...options,blend:0});
    const name=type===1?'rifle-barrel':type===2?'turret-barrel-1':'custodian-barrel-1';
    const barrel=model.find(m=>m.actorPart===name),a=matrix(barrel.r),forward=[-a[1],-a[4],-a[7]],height=type===1?1.33:type===2?1.50:2.28;
    const angle=Math.max(-.9,Math.min(.9,Math.atan2(targetY-height,4))),direction=[0,Math.sin(angle),-Math.cos(angle)];
    assert(forward.reduce((n,v,i)=>n+v*direction[i],0)>.999,'gun pitch does not follow an upper/lower target');
    if(type===1)for(const side of [-1,1]){
      const arm=model.find(m=>m.actorPart==='forearm-'+side),hand=model.find(m=>m.actorPart==='hand-'+side);
      assert(nearest(endpoints(arm),hand.p)<.08,'elevated aim detached hand');
    }
  }
});

test('walking plants support feet and keeps both bone segments joined at the real pivots',()=>{
  for(const type of [1,3])for(const baseY of [0,3.2,6.4])for(let j=0;j<20;j++){
    const phase=j*Math.PI/10,meshes=build(entity(type,{baseY,y:HEIGHT[type]+baseY,yaw:.51,attackState:j%3?'idle':'rush'}),{...options,phase,blend:1});
    const feet=meshes.filter(m=>/boot/.test(m.actorPart)),grounded=feet.map(m=>bounds([m]).low[1]-baseY);
    assert(grounded.every(y=>y>=-1e-8&&y<.18),'boot clips floor or floats too high');
    assert(grounded.filter(y=>Math.abs(y)<1e-8).length>=(type===3?2:1),'no planted support foot during gait');
    for(const thigh of meshes.filter(m=>/(?:^thigh-|custodian-thigh-)/.test(m.actorPart))){
      const id=thigh.actorPart.replace(type===3?'custodian-thigh-':'thigh-',''),prefix=type===3?'custodian-':'';
      const knee=meshes.find(m=>m.actorPart===prefix+'knee-'+id),hip=meshes.find(m=>m.actorPart===prefix+'hip-'+id),shin=meshes.find(m=>m.actorPart===prefix+'shin-'+id);
      assert(nearest(endpoints(thigh),hip.p)<.085&&nearest(endpoints(thigh),knee.p)<.085,'thigh detached from hip or knee');
      assert(nearest(endpoints(shin),knee.p)<.085,'shin detached from knee');
    }
  }
});

test('the mobile tripod cycles one support at a time while its other feet stay planted',()=>{
  for(let i=0;i<30;i++){
    const phase=i*Math.PI/15,model=build(entity(2,{baseY:3.2,y:4.8,goalX:12,goalZ:-9}),{...options,phase,blend:1});
    const feet=model.filter(m=>/^turret-pad/.test(m.actorPart)),floor=feet.map(m=>bounds([m]).low[1]-3.2);
    assert(floor.every(v=>v>=-1e-8&&v<.12),'tripod foot clips or floats');
    assert(floor.filter(v=>Math.abs(v)<1e-8).length>=2,'tripod loses its two support feet');
    for(const [j,foot] of feet.entries()){
      const strut=model.find(m=>m.actorPart==='turret-strut-'+j);
      assert(nearest(endpoints(strut),[foot.p[0],foot.p[1]+.1,foot.p[2]])<1e-8,'tripod strut detached from moving foot');
    }
  }
  const idle=build(entity(2),{...options,blend:0}),walk=build(entity(2),{...options,blend:1});
  assert(idle.some((m,i)=>m.actorPart.startsWith('turret-pad')&&Math.hypot(...m.p.map((v,j)=>v-walk[i].p[j]))>.05),'tripod has no visible walking stride');
});

test('hands connect to the rifle, aim changes its elevation and stun/rush remain distinct poses',()=>{
  for(const attackState of ['idle','aim','burst','rush','stunned']){
    const e=entity(1,{attackState,stun:attackState==='stunned'?.4:0}),meshes=build(e,options);
    for(const side of [-1,1]){
      const arm=meshes.find(m=>m.actorPart==='forearm-'+side),hand=meshes.find(m=>m.actorPart==='hand-'+side),elbow=meshes.find(m=>m.actorPart==='elbow-'+side);
      assert(nearest(endpoints(arm),hand.p)<.08&&nearest(endpoints(arm),elbow.p)<.08,'forearm is not attached to weapon grip');
    }
  }
  const poses=['idle','aim','rush','stunned'].map(attackState=>build(entity(1,{attackState,stun:attackState==='stunned'?.4:0}),options));
  assert.equal(new Set(poses.map(a=>JSON.stringify(a))).size,4);
  const idle=poses[0].find(m=>m.actorPart==='rifle-barrel'),aim=poses[1].find(m=>m.actorPart==='rifle-barrel');
  assert(Math.hypot(...idle.r.map((v,i)=>v-aim.r[i]))>.15,'rifle does not raise into aimed position');
});

test('rotors, mechanical recoil and silhouettes remain visible at their intended scale',()=>{
  const droneA=build(entity(0),options),droneB=build(entity(0),{...options,time:options.time+.13});
  const blades=droneA.filter(m=>/rotor-blade/.test(m.actorPart));assert.equal(blades.length,8);
  assert(blades.every(m=>{const b=droneB.find(q=>q.actorPart===m.actorPart);return Math.hypot(...m.r.map((v,i)=>v-b.r[i]))>.05;}),'rotor blades are static');
  for(const type of [2,3]){
    const a=build(entity(type,{attackState:'burst'}),{...options,time:.02}),b=build(entity(type,{attackState:'burst'}),{...options,time:.07});
    const name=type===2?'turret-barrel-1':'custodian-barrel-1',aa=a.find(m=>m.actorPart===name),bb=b.find(m=>m.actorPart===name);
    assert(Math.hypot(...aa.p.map((v,i)=>v-bb.p[i]))>.01,'cannon has no physical recoil');
  }
  for(let type=0;type<4;type++){
    const near=bounds(build(entity(type),{...options,blend:0})),far=bounds(build(entity(type),{...options,blend:0,distance:60}));
    assert(far.size[0]/near.size[0]>.6&&far.size[0]/near.size[0]<1.3,`type ${type}: distant silhouette changes width excessively ${far.size[0]/near.size[0]}`);
    assert(far.size[1]/near.size[1]>.60&&far.size[1]/near.size[1]<1.3,`type ${type}: distant silhouette changes height excessively ${far.size[1]/near.size[1]}`);
  }
  const heavy=bounds(build(entity(1),{...options,blend:0})),boss=bounds(build(entity(3),{...options,blend:0}));
  assert(boss.size[0]>heavy.size[0]*1.55&&boss.size[1]>heavy.size[1]*1.4,'boss is only a recoloured ordinary mob');
});

test('airborne bipeds and tripods retract supports instead of running in mid-air',()=>{
  for(const type of [1,2]){
    const e=entity(type,{baseY:7.2,y:7.2+HEIGHT[type],airborne:true,airVY:8}),a=build(e,{...options,phase:0,blend:1}),b=build(e,{...options,phase:Math.PI*.7,blend:1});
    const feet=a.filter(m=>type===1?m.actorPart.startsWith('boot-'):m.actorPart.startsWith('turret-pad'));
    assert(feet.length=== (type===1?2:3));
    for(const foot of feet){assert(bounds([foot]).low[1]>e.baseY+.17,'airborne support not retracted');vecclose(foot.p,b.find(m=>m.actorPart===foot.actorPart).p,'no running cycle during flight');}
  }
});

test('muzzle bores touch actual solid sleeves instead of floating in front of thin rings',()=>{
  for(const [type,names] of [[1,[['rifle-muzzle','rifle-bore']]],[2,[['turret-muzzle--1','turret-bore--1'],['turret-muzzle-1','turret-bore-1']]],[3,[['custodian-muzzle--1','custodian-bore--1'],['custodian-muzzle-1','custodian-bore-1']]]]){
    const model=build(entity(type,{attackState:'aim'}),{...options,blend:0});
    for(const [sleeveName,boreName] of names){
      const sleeve=model.find(m=>m.actorPart===sleeveName),bore=model.find(m=>m.actorPart===boreName);
      assert.equal(sleeve.shape,'cylinder');assert.equal(bore.shape,'cylinder');
      const distance=Math.hypot(...sleeve.p.map((v,i)=>v-bore.p[i]));
      assert(distance<=(sleeve.s[1]+bore.s[1])/2+1e-8,'bore floats beyond sleeve');
      assert(bore.s[0]<sleeve.s[0]*.7,'muzzle loses its annular metal rim');
    }
  }
});

test('zero-health actors produce no geometry and close helmet centres match hit-volume contract',()=>{
  for(let type=0;type<4;type++)assert.equal(build(entity(type,{hp:0}),options).length,0);
  for(const [type,name,height] of [[1,'helmet',1.88],[3,'custodian-helmet',2.89]]){
    const model=build(entity(type,{baseY:6.4,y:HEIGHT[type]+6.4}),{...options,phase:0,blend:0});
    close(model.find(m=>m.actorPart===name).p[1],6.4+height,'helmet hit centre');
  }
});

test('Rocket and grenade specialists keep aligned muzzles and fit the conservative actor sphere',()=>{
  for(const weapon of ['rocket','grenade'])for(const yaw of [0,.75,2.7])for(const aimY of [-3,1.4,8])for(const airborne of [false,true]){
    const e=entity(1,{weapon,yaw,attackState:'aim',windup:.3,windupMax:1,aimY,airborne,airVY:5});
    const near=build(e,{...options,blend:0}),normal=build({...e,weapon:undefined},{...options,blend:0});
    const bore=near.find(m=>m.actorPart==='launcher-bore'),reference=normal.find(m=>m.actorPart==='rifle-bore');
    vecclose(bore.p,reference.p,'specialist physical muzzle');vecclose(bore.r,reference.r,'specialist barrel heading');
    assert(near.length<=64);assert(near.some(m=>m.actorPart===(weapon==='rocket'?'launcher-tube':'grenade-drum')));
    for(const distance of [4,18,50])for(const m of build(e,{...options,distance})){
      assert.equal(m.surface,'object');assert(m.p.every(Number.isFinite));
      assert(Math.hypot(m.p[0]-e.x,m.p[1]-(e.baseY+1.6),m.p[2]-e.z)+Math.hypot(...m.s)/2<3.5,'weapon must not be clipped by actor visibility filtering');
    }
  }
});

test('colossi keep the targetable heart registered through scale, heading, gait and exposure',()=>{
  for(const [bossKind,bossScale] of [['colossus',5.4],['siegebreaker',7.2],['custodian',9]])for(const yaw of [0,.81,Math.PI])for(const phase of [0,1.3,3.7])for(const weakPointOpen of [false,true]){
    const e=entity(3,{x:13,z:-5,baseY:6.4,y:6.4+1.8*bossScale,bossKind,bossScale,yaw,bossAwake:true,weakPointOpen,windup:1,attackState:'aim'});
    const meshes=build(e,{...options,distance:35,phase,blend:1}),core=meshes.find(m=>m.actorPart==='titan-heart'),turn=matrix([0,-yaw,0]);
    const centre=transform(turn,[0,1.93*bossScale,-.90*bossScale]).map((v,i)=>v+[e.x,e.baseY,e.z][i]);
    vecclose(core.p,centre,'physical weak point alignment');vecclose(core.s,[.72*bossScale,.72*bossScale,.72*bossScale],'weak point hit diameter');
    assert.equal(core.shape,'sphere');assert.equal(core.surface,'object');
    const foot=meshes.filter(m=>m.actorPart.startsWith('custodian-boot'));
    assert(foot.every(m=>bounds([m]).low[1]>=e.baseY-1e-8),'giant support clips the arena floor');
    assert(foot.filter(m=>Math.abs(bounds([m]).low[1]-e.baseY)<1e-8).length>=2,'giant has no grounded support');
    assert(meshes.length<=113,'giant draw cost grows with its size');
    for(const m of meshes){
      assert.equal(m.actorScale,bossScale);assert(m.p.every(Number.isFinite)&&m.r.every(Number.isFinite));
      assert(Math.hypot(m.p[0]-e.x,m.p[1]-(e.baseY+1.6*bossScale),m.p[2]-e.z)+Math.hypot(...m.s)/2<4.5*bossScale,'giant exceeds visibility bound');
    }
  }
});

test('each giant has a distinct silhouette and size-aware detail across the arena',()=>{
  const parts=[],heights=[];
  for(const [bossKind,bossScale] of [['colossus',5.4],['siegebreaker',7.2],['custodian',9]]){
    const e=entity(3,{bossKind,bossScale,bossAwake:true}),near=build(e,{...options,blend:0,distance:30}),distant=build(e,{...options,blend:0,distance:60,backend:'canvas2d'});
    parts.push(near.map(m=>m.actorPart).join(','));heights.push(bounds(near).size[1]);
    assert(distant.length>20,'a visible colossus degenerates into six cubes across its own arena');
    const awake=near.find(m=>m.actorPart==='titan-heart'),dormant=build({...e,bossAwake:false},{...options,blend:0,distance:30}).find(m=>m.actorPart==='titan-heart');
    assert(awake.emissive>dormant.emissive*3,'awakening has no visible state');
    const open=build({...e,weakPointOpen:true},{...options,blend:0,distance:30}),shutters=near.filter(m=>m.actorPart.startsWith('titan-heart-shutter'));
    assert(shutters.every(m=>Math.hypot(...m.p.map((v,i)=>v-open.find(q=>q.actorPart===m.actorPart).p[i]))>.2*bossScale),'exposed heart remains covered');
  }
  assert.equal(new Set(parts).size,3,'bosses are recolours of the same silhouette');
  for(const [i,h] of heights.entries())assert(Math.abs(h-[18,24,30][i])<.5,`colossus height ${h}`);
});

test('close piston jackets remain collinear with the working struts across gait, aim, stun and airborne poses',()=>{
  const pairs=[['detail-leg-jacket-','leg-piston-'],['detail-turret-jacket-','turret-piston-'],['detail-custodian-jacket-','custodian-piston-']];
  for(const type of [1,2,3])for(const yaw of [-1.2,.7])for(const phase of [.1,1.9,4.7])for(const airborne of [false,true])for(const stun of [0,.4]){
    const e=entity(type,{yaw,airborne,airVY:7,stun,attackState:'aim',aimY:6}),meshes=build(e,{...options,phase}),[jacketPrefix,pistonPrefix]=pairs[type-1];
    const jackets=meshes.filter(m=>m.actorPart.startsWith(jacketPrefix));assert.equal(jackets.length,type===1?2:type===2?3:4);
    for(const jacket of jackets){
      const piston=meshes.find(m=>m.actorPart===pistonPrefix+jacket.actorPart.slice(jacketPrefix.length)),[a,b]=endpoints(piston),delta=b.map((v,k)=>v-a[k]),length2=delta.reduce((n,v)=>n+v*v,0);
      for(const p of endpoints(jacket)){
        const f=p.reduce((n,v,k)=>n+(v-a[k])*delta[k],0)/length2;
        assert(f>=-1e-7&&f<=1+1e-7,'sleeve must terminate on its existing articulated piston');
        assert(Math.hypot(...p.map((v,k)=>v-(a[k]+delta[k]*f)))<1e-7,'sleeve cannot float away from its working shaft');
      }
      assert(jacket.s[1]<piston.s[1]*.6,'a telescopic portion of the original shaft remains exposed');
    }
  }
});
