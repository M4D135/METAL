import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/renderer.js',import.meta.url),'utf8');
const camera={pos:[0,2,4],yaw:0,pitch:-.08,fov:74},fx={time:2,adaptive:false};
const box=(p,s,extra={})=>({shape:'box',p,s,mat:3,...extra});
const floor=box([0,-.12,-4],[24,.24,24],{mat:2,ground:true}),wall=box([0,1.6,-4],[5,3.2,.5]);
const original=[floor,wall],broken=[floor,box([-1.75,1.6,-4],[1.5,3.2,.5]),box([1.75,1.6,-4],[1.5,3.2,.5]),box([0,2.85,-4],[2,.7,.5])];
const lights=[{p:[-2,5,1],color:[1,.6,.3],power:12},{p:[3,6,-6],color:[.3,.7,1],power:9}];
function gpu(){
  const calls=[],draws=[],buffers=new Map(),uniforms=new Map();let serial=0,bound=null,currentProgram=null,framebuffer=null,instanceOffset=0;
  const gl=new Proxy({FRAMEBUFFER_COMPLETE:36053,COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256},{get(target,name){
    if(name in target)return target[name];if(/^[A-Z_0-9]+$/.test(name))return name;
    return (...args)=>{calls.push({name,args});
      if(name.startsWith('create'))return {kind:name,id:++serial};
      if(name==='getUniformLocation')return {program:args[0],name:args[1]};
      if(name==='getShaderParameter'||name==='getProgramParameter')return true;if(name==='checkFramebufferStatus')return 36053;
      if(name==='bindBuffer'&&args[0]==='ARRAY_BUFFER')bound=args[1];
      if(name==='bufferData'&&args[0]==='ARRAY_BUFFER')buffers.set(bound,Array.from(args[1]));
      if(name==='useProgram')currentProgram=args[0];if(name==='bindFramebuffer')framebuffer=args[1];
      if(name==='vertexAttribPointer'&&args[0]===2)instanceOffset=args[5]/4;
      if(name.startsWith('uniform'))uniforms.set(args[0].name,ArrayBuffer.isView(args.at(-1))?Array.from(args.at(-1)):args.slice(1));
      if(name==='drawElementsInstanced')draws.push({program:currentProgram,framebuffer,values:(buffers.get(bound)||[]).slice(instanceOffset,instanceOffset+args[4]*16),count:args[4],indexCount:args[1],indexOffset:args[3],callIndex:calls.length-1});
    };
  }});
  const canvas={width:960,height:600,clientWidth:960,clientHeight:600,getContext:()=>gl,addEventListener(){},removeEventListener(){}},scope={window:{innerWidth:960,innerHeight:600,devicePixelRatio:1}};vm.runInNewContext(source,scope);
  return {renderer:scope.window.FRender.create(canvas),api:scope.window.FRender,calls,draws,uniforms,canvas};
}
function software(){
  const calls=[],gradient={addColorStop(...args){calls.push(['colorStop',...args]);}},ctx=new Proxy({},{get(target,name){if(name in target)return target[name];return (...args)=>{calls.push([name,...args]);return name.startsWith('create')?gradient:undefined;};},set(target,name,value){calls.push(['set',name,value===gradient?'gradient':value]);target[name]=value;return true;}});
  const canvas={width:960,height:600,clientWidth:960,clientHeight:600,getContext:kind=>kind==='2d'?ctx:null},scope={window:{innerWidth:960,innerHeight:600,devicePixelRatio:1}};vm.runInNewContext(source,scope);
  return {renderer:scope.window.FRender.create(canvas),calls};
}
const rows=draws=>draws.flatMap(d=>Array.from({length:d.values.length/16},(_,i)=>d.values.slice(i*16,i*16+16)));
const isWall=row=>row[0]===0&&Math.abs(row[1]-1.6)<1e-5&&row[2]===-4&&row[4]===5&&Math.abs(row[5]-3.2)<1e-5;

test('a destruction revision replaces every colour/depth instance cache and retains lights/environment',()=>{
  const g=gpu(),r=g.renderer,environment={biome:'woodland',outdoorZones:[{x:0,z:0,w:100,d:100}],sunDirection:[-.4,.8,.3]};r.setWorld(original,lights,environment);r.resize('auto');r.draw(camera,[],fx);assert(rows(g.draws).some(isWall));
  const lightPositions=g.uniforms.get('uLightPosition'),fog=g.uniforms.get('uFogColor'),resources=g.calls.filter(c=>c.name.startsWith('create')).length;
  g.calls.length=0;g.draws.length=0;assert.equal(r.updateWorld(broken,1),true);assert.equal(r.stats.worldRevision,1);assert.equal(r.stats.staticTotal,4);assert(!g.calls.some(c=>c.name.startsWith('create')||c.name==='bufferData'),'revision is lazy and reuses GPU allocations');
  r.draw(camera,[],fx);assert(!rows(g.draws).some(isWall),'removed wall cannot survive in any cached shadow view');assert(rows(g.draws).some(row=>row[0]===-1.75));assert.equal(r.stats.shadowMaps,3);
  assert.deepEqual(g.uniforms.get('uLightPosition'),lightPositions);assert.deepEqual(g.uniforms.get('uFogColor'),fog);
  const before=g.calls.length;assert.equal(r.updateWorld(broken,1),false);assert.equal(g.calls.length,before);
  g.calls.length=0;r.draw(camera,[],fx);assert(!g.calls.some(c=>c.name==='bufferData'),'unchanged static revision/frame uploads no instance rows');
  assert(resources>0);r.dispose();
});

test('geometry updates preserve the adaptive resolution and can retire destroyed lamps',()=>{
  const g=gpu(),r=g.renderer;r.setWorld(original,lights);r.resize('auto');
  for(let i=0;i<65;i++)r.draw(camera,[],{time:2,adaptive:true,frameMs:50});const scale=r.stats.renderScale;assert(scale<1);
  r.updateWorld(broken,1,[]);r.draw(camera,[],fx);assert.equal(r.stats.renderScale,scale);assert.equal(g.uniforms.get('uLightCount')[0],0);assert.equal(r.stats.shadowMaps,1,'only the player torch remains');
  r.dispose();assert.equal(r.updateWorld(original,2),false);
});

test('Canvas geometry/light revisions match a fresh scene and leave unchanged frames identical',()=>{
  const a=software(),r=a.renderer;r.setWorld(original,lights);r.resize('auto');r.draw(camera,[],fx);a.calls.length=0;r.draw(camera,[],fx);const intact=JSON.stringify(a.calls);
  assert(r.updateWorld(original,1));a.calls.length=0;r.draw(camera,[],fx);assert.equal(JSON.stringify(a.calls),intact,'retained geometry must not change pixels/commands');
  r.updateWorld(broken,2,[]);a.calls.length=0;r.draw(camera,[],fx);
  const b=software();b.renderer.setWorld(broken,[]);b.renderer.resize('auto');b.calls.length=0;b.renderer.draw(camera,[],fx);
  assert.deepEqual(a.calls,b.calls,'ground masks, fixed lighting and caster caches must all reflect the new world');r.dispose();b.renderer.dispose();
});

test('translucent FX skip all shadow passes, preserve depth writes and render before the weapon overlay',()=>{
  const g=gpu(),r=g.renderer;r.setWorld(original,lights);r.resize('auto');g.calls.length=0;g.draws.length=0;
  const cloud={shape:'sphere',p:[.5,1,-2],s:[2,2,2],r:[0,0,0],mat:7,color:[.4,.3,.2],fx:true,alpha:.3,surface:'object'},weapon=box([.4,1.6,3.4],[.2,.2,.4],{overlay:true,surface:'object'});
  r.draw(camera,[cloud,weapon],fx);assert.equal(r.stats.fxInstances,1);
  const fxDraw=g.draws.find(d=>d.values.length===16&&d.values[3]===7&&Math.abs(d.values[15]-.3)<1e-5);assert(fxDraw);
  assert.equal(g.draws.filter(d=>d.values.length===16&&Math.abs(d.values[15]-.3)<1e-5).length,1,'cloud must only be drawn once, never into an atlas');
  const mask=g.calls.filter(c=>c.name==='depthMask').map(c=>c.args[0]);assert.deepEqual(mask,[false,true]);
  const blend=g.calls.filter(c=>(c.name==='enable'||c.name==='disable')&&c.args[0]==='BLEND').map(c=>c.name);assert.deepEqual(blend,['enable','disable']);
  const final=g.draws.at(-1);assert.notEqual(final.program,fxDraw.program);assert(final.values[11]%2===1,'weapon remains in its ordinary overlay shader');r.dispose();
});

test('Canvas arena range includes a full giant from the arena border without extending ordinary detail tiers',()=>{
  const a=software(),r=a.renderer,environment={biome:'woodland',outdoorZones:[{x:0,z:0,w:60,d:60}],longViewZones:[{x:0,z:0,w:60,d:60,range:100}]};
  r.setWorld([floor],lights,environment);r.resize('auto');const eye={...camera,pos:[0,1.62,45]},keep=r.actorFilter(eye,{shadows:false});assert(keep(0,15,-10,22));r.draw(eye,[],fx);assert.equal(r.stats.viewDistance,100);
  r.draw({...eye,pos:[0,1.62,100]},[],fx);assert.equal(r.stats.viewDistance,38);r.dispose();
});

test('GPU arena keeps essential terrain behind the giant while fine-detail ranges remain bounded',()=>{
  const g=gpu(),r=g.renderer,environment={biome:'woodland',outdoorZones:[{x:0,z:0,w:60,d:60}],longViewZones:[{x:0,z:0,w:60,d:60,range:100}]};
  const distantFloor=box([0,-.12,-35],[10,.24,10],{ground:true}),detail=box([1,1,-35],[.5,2,.5],{detail:1});
  r.setWorld([distantFloor,detail],[],environment);r.resize('auto');r.draw({...camera,pos:[0,1.62,45]},[],{...fx,shadows:false});
  assert.equal(r.stats.viewDistance,100);assert.equal(r.stats.staticVisible,1,'far floor stays, fine trim is outside its own range');
  r.draw({...camera,pos:[0,1.62,100]},[],{...fx,shadows:false});assert.equal(r.stats.viewDistance,64);r.dispose();
});

test('Canvas giant bodies cast grounded shadows above the old sixteen-metre height limit',()=>{
  const a=software(),r=a.renderer,environment={biome:'woodland',outdoorZones:[{x:0,z:0,w:100,d:100}],sunDirection:[.2,1,.1]};
  r.setWorld([box([0,-.12,0],[100,.24,100],{ground:true,outdoor:true})],[],environment);r.resize('auto');
  const torso=box([0,22,-5],[12,8,10],{actorPart:'titan-chest',actorScale:9,surface:'object'});
  r.draw({pos:[12,14,25],yaw:-.35,pitch:-.35,fov:74},[torso],fx);assert.equal(r.stats.shadows,true,'a visible thirty-metre actor still projects its torso shadow');r.dispose();
});

test('blackouts dim only real nearby lamp contributions, preserve shadow geometry and recover within 1.2 seconds',()=>{
  const g=gpu(),r=g.renderer,lamps=[lights[0],{p:[30,6,-20],color:[.3,.7,1],power:9}],horror={eventType:'blackout',eventX:-2,eventY:5,eventZ:1,eventIntensity:1,eventAge:.2};
  r.setWorld(original,lamps);r.resize('auto');r.draw(camera,[],fx);const ordinary=g.uniforms.get('uLightColor').slice(),shadow=g.uniforms.get('uShadowMatrix').slice();
  g.calls.length=0;r.draw(camera,[],{...fx,horror});const dim=g.uniforms.get('uLightColor');assert.equal(r.stats.blackoutLights,1);assert(dim[0]>ordinary[0]*.2&&dim[0]<ordinary[0]*.3);assert.deepEqual(dim.slice(3),ordinary.slice(3));
  assert.deepEqual(g.uniforms.get('uShadowMatrix'),shadow);assert(!g.calls.some(c=>c.name==='bufferData'||c.name.startsWith('create')),'a short blackout must not rebuild geometry or resources');
  r.draw(camera,[],{...fx,horror:{...horror,eventAge:1.21}});assert.deepEqual(g.uniforms.get('uLightColor'),ordinary);assert.equal(r.stats.blackoutLights,0);
  const a=software();a.renderer.setWorld(original,lamps);a.renderer.resize('auto');a.renderer.draw(camera,[],fx);a.calls.length=0;a.renderer.draw(camera,[],fx);const baseline=JSON.stringify(a.calls);
  a.calls.length=0;a.renderer.draw(camera,[],{...fx,horror});assert.notEqual(JSON.stringify(a.calls),baseline,'Canvas also dims the actual cached local lighting');
  a.calls.length=0;a.renderer.draw(camera,[],{...fx,horror:{...horror,eventAge:1.21}});assert.equal(JSON.stringify(a.calls),baseline);r.dispose();a.renderer.dispose();
});

test('danger telegraphs keep their designed opacity at grazing ground angles',()=>{
  const g=gpu(),r=g.renderer,marker=box([0,.026,-12],[4,.022,8],{surface:'object',fx:true,fxPriority:'hazard',alpha:.74,color:[1,.5,.05]});
  r.setWorld([floor],[]);r.draw(camera,[marker],{...fx,shadows:false});assert(rows(g.draws).some(row=>row[3]===16&&Math.abs(row[15]-.74)<1e-6));
  const a=software();a.renderer.setWorld([floor],[]);a.renderer.draw(camera,[marker],{...fx,shadows:false});assert(a.calls.some(c=>c[0]==='set'&&c[1]==='globalAlpha'&&c[2]===.74),'ground-level warning cannot fade like a spherical smoke silhouette');r.dispose();a.renderer.dispose();
});

test('foliage is one immutable closed crown shared with exact raycasts and every GPU quality',()=>{
  const g=gpu(),triangles=g.api.foliageTriangles(),edges=new Map(),vertices=new Set();
  assert.equal(triangles,g.api.foliageTriangles());assert.equal(triangles.length,72);assert(Object.isFrozen(triangles));
  const key=p=>p.join(',');let volume=0;
  for(const tri of triangles){
    assert(Object.isFrozen(tri));
    for(const p of tri){assert(Object.isFrozen(p));assert(p.every(v=>Number.isFinite(v)&&v>=-.5&&v<=.5));vertices.add(key(p));}
    for(let i=0;i<3;i++){const a=key(tri[i]),b=key(tri[(i+1)%3]),edge=a<b?a+'|'+b:b+'|'+a;const entry=edges.get(edge)||{count:0,direction:0};entry.count++;entry.direction+=a<b?1:-1;edges.set(edge,entry);}
    const [a,b,c]=tri;volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
  }
  assert(volume>.15&&volume<.55);assert.equal(vertices.size-edges.size+triangles.length,2);
  for(const edge of edges.values())assert.deepEqual(edge,{count:2,direction:0},'every edge has two oppositely wound neighbours');
  assert.throws(()=>{triangles[0][0][0]=4;});
  const vertexData=g.calls.find(c=>c.name==='bufferData'&&c.args[0]==='ARRAY_BUFFER').args[1];
  const indexData=g.calls.find(c=>c.name==='bufferData'&&c.args[0]==='ELEMENT_ARRAY_BUFFER').args[1];
  const canonical=Array.from(triangles,tri=>Array.from(tri,p=>Array.from(p,Math.fround).join(',')).sort().join('|')).sort();
  const canopy={shape:'foliage',p:[0,3,-4],s:[4,3,4],mat:11,outdoor:true},r=g.renderer;
  r.setWorld([floor,canopy],lights,{outdoorZones:[{x:0,z:0,w:100,d:100}],wind:0});
  for(const quality of ['low','auto','high']){
    r.resize(quality);g.draws.length=0;r.draw(camera,[],fx);
    const leaves=g.draws.filter(d=>d.values.some((v,i)=>i%16===3&&v===11));assert(leaves.length>0);
    for(const draw of leaves){
      assert.equal(draw.indexCount,216);
      const actual=[];
      for(let j=draw.indexOffset/2;j<draw.indexOffset/2+draw.indexCount;j+=3){
        const triangle=[];for(let k=0;k<3;k++){const at=indexData[j+k]*6;triangle.push(Array.from(vertexData.slice(at,at+3)).join(','));assert(Math.abs(Math.hypot(...vertexData.slice(at+3,at+6))-1)<1e-5);}
        actual.push(triangle.sort().join('|'));
      }
      assert.deepEqual(actual.sort(),canonical,'colour and shadow draws use the raycast triangles');
    }
  }
  const a=software();a.renderer.setWorld([floor,canopy],lights,{outdoorZones:[{x:0,z:0,w:100,d:100}],wind:0});a.renderer.draw(camera,[],fx);
  assert(a.renderer.stats.instances>=2);assert(a.renderer.stats.triangles>30,'Canvas cannot silently substitute a cube');a.renderer.dispose();r.dispose();
});

test('transient lights are local, bounded and never reassign existing shadow slots or rebuild geometry',()=>{
  const g=gpu(),r=g.renderer,lamps=Array.from({length:20},(_,i)=>({p:[i-8,6,-i],color:[.4,.7,1],power:9}));
  r.setWorld(original,lamps);r.resize('auto');r.draw(camera,[],fx);const shadow=g.uniforms.get('uShadowMatrix').slice(),first=g.uniforms.get('uLightPosition').slice(0,6),maps=r.stats.shadowMaps;
  const flashes=Array.from({length:10},(_,i)=>({p:[i,1,-3],color:[1,.4,.08],power:30,range:14}));
  flashes.unshift({p:[NaN,2,0],power:30,range:12},{p:[0,2,0],power:Infinity,range:12});
  g.calls.length=0;r.draw(camera,[],{...fx,lights:flashes});
  assert.equal(r.stats.dynamicLights,3);assert.equal(g.uniforms.get('uLightCount')[0],12);assert.equal(g.uniforms.get('uLightRange').filter(v=>v>0).length,3);
  assert(g.uniforms.get('uLightPosition').every(Number.isFinite));assert.deepEqual(g.uniforms.get('uLightPosition').slice(0,6),first);
  assert.deepEqual(g.uniforms.get('uShadowMatrix'),shadow);assert.equal(r.stats.shadowMaps,maps);
  assert(!g.calls.some(c=>c.name==='bufferData'||c.name.startsWith('create')),'moving light parameters need no new meshes, buffers or atlas');
  r.draw(camera,[],fx);assert.equal(r.stats.dynamicLights,0);assert(g.uniforms.get('uLightRange').every(v=>v===0),'expired flames cannot leave phantom lighting');
  r.resize('low');r.draw(camera,[],{...fx,lights:flashes});assert.equal(r.stats.dynamicLights,2);assert.equal(g.uniforms.get('uLightCount')[0],6);r.dispose();
});

test('Canvas transient lighting reaches cached surfaces and expires outside its real range',()=>{
  const a=software(),r=a.renderer;r.setWorld(original,lights);r.resize('auto');r.draw(camera,[],fx);a.calls.length=0;r.draw(camera,[],fx);const base=JSON.stringify(a.calls);
  const local={p:[1,1,-2],power:30,range:10,color:[1,.4,.08]};
  a.calls.length=0;r.draw(camera,[],{...fx,lights:[local]});assert.notEqual(JSON.stringify(a.calls),base);assert.equal(r.stats.dynamicLights,1);
  a.calls.length=0;r.draw(camera,[],{...fx,lights:[{...local,p:[80,1,-2]}]});assert.equal(JSON.stringify(a.calls),base,'distant light cannot brighten a nearby room through a global camera flash');
  a.calls.length=0;r.draw(camera,[],fx);assert.equal(JSON.stringify(a.calls),base);r.dispose();
});

test('only explicit flames use the animated fire material, leaving smoke and danger masks unchanged',()=>{
  const g=gpu(),r=g.renderer;
  const puff={shape:'sphere',p:[0,2,-3],s:[2,2,2],mat:7,fx:true,alpha:.5,emissive:2,surface:'object'};
  r.setWorld([floor],lights);r.draw(camera,[{...puff,fxFire:true},{...puff,p:[3,2,-3],emissive:0},{...puff,p:[-3,.05,-3],fxFire:true,fxPriority:'hazard'}],fx);
  const materials=new Set(rows(g.draws).filter(row=>Math.abs(row[15]-.5)<1e-6).map(row=>row[3]));
  assert.deepEqual(materials,new Set([14,7,16]));assert.equal(r.stats.fxInstances,3);r.dispose();
});

test('a translucent first-person shield blends after the opaque hand depth and never enters world shadows',()=>{
  const g=gpu(),r=g.renderer,weapon=box([.35,1.65,3.3],[.25,.3,.6],{overlay:true,surface:'object'});
  const shield=box([-.28,1.8,3.35],[.5,.65,.03],{overlay:true,fx:true,alpha:.22,color:[.15,.75,.8],emissive:.3,surface:'object'});
  const smoke={shape:'sphere',p:[0,2,-1],s:[2,2,2],mat:7,fx:true,alpha:.35,color:[.4,.4,.4],surface:'object'};
  r.setWorld(original,lights);g.calls.length=0;r.draw(camera,[shield,smoke,weapon],fx);
  const shieldDraws=g.draws.filter(d=>d.values.some((v,i)=>i%16===15&&Math.abs(v-.22)<1e-6));assert.equal(shieldDraws.length,1);
  const shieldDraw=shieldDraws[0],smokeDraw=g.draws.find(d=>d.values.some((v,i)=>i%16===15&&Math.abs(v-.35)<1e-6));
  const weaponDraw=g.draws.find(d=>d.values.some((v,i)=>i%16===11&&v%2===1)&&d!==shieldDraw);
  assert.equal(shieldDraw.program,smokeDraw.program);assert.notEqual(shieldDraw.program,weaponDraw.program);
  assert(smokeDraw.callIndex<weaponDraw.callIndex&&weaponDraw.callIndex<shieldDraw.callIndex);
  const clears=g.calls.flatMap((c,i)=>c.name==='clear'&&c.args[0]===256?[i]:[]),handsClear=clears.at(-1);
  assert(smokeDraw.callIndex<handsClear&&handsClear<weaponDraw.callIndex,'world depth is cleared once, before both hand passes');
  const shieldCalls=g.calls.slice(weaponDraw.callIndex+1,shieldDraw.callIndex+1);
  assert(shieldCalls.some(c=>c.name==='enable'&&c.args[0]==='BLEND'));assert(shieldCalls.some(c=>c.name==='depthMask'&&c.args[0]===false));
  assert.equal(r.stats.fxInstances,2,'world FX and hand FX both count toward diagnostics');
  const a=software();a.renderer.setWorld(original,lights);a.renderer.draw(camera,[shield,weapon],fx);
  assert(a.calls.some(c=>c[0]==='set'&&c[1]==='globalAlpha'&&c[2]>.05&&c[2]<=.22),'Canvas preserves the shield alpha in the overlay pass');r.dispose();a.renderer.dispose();
});
