// DRAW harness : renderer de FERRO v0.2 (lecture seule) + jeu METAL 0.8 (monde, simulation, models() de game.js)
// sur un WebGL2 factice qui SUIT L'ETAT : chaque appel est compte par fonction et par passe, et classe
// "redondant" quand il repose une valeur deja en place (programme, VAO, FBO, tampon, texture, capacite,
// uniforme, pointeur d'attribut). Tout tourne dans le domaine principal de Node (vm.runInThisContext enveloppe).
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadModels} from '../rcpu/harness.mjs';

export const METAL=(process.env.METAL_ROOT||process.cwd());
export const FERRO='~/Projects/ferro';

export function rep(code,find,replace,label){
  const n=code.split(find).length-1;
  if(n!==1)throw new Error(`patch ${label}: ancre trouvee ${n} fois: ${find.slice(0,90)}`);
  return code.replace(find,()=>replace);
}

// ---- WebGL2 factice a suivi d'etat -------------------------------------------------------------
export function makeGL(){
  const T={pass:'init',frame:0,byFn:new Map(),byPass:new Map(),red:new Map(),redPass:new Map(),sameAsPrevFrame:0,
    upload:new Map(),uploadCalls:new Map(),draws:new Map(),inst:new Map(),tris:new Map(),bufNames:new Map(),log:null};
  const bump=(map,k,n=1)=>map.set(k,(map.get(k)||0)+n);
  const bump2=(map,a,b,n=1)=>{let m=map.get(a);if(!m){m=new Map();map.set(a,m);}m.set(b,(m.get(b)||0)+n);};
  let id=0;
  const st={program:null,vao:null,fbDraw:null,fbRead:null,arrayBuffer:null,activeTex:0,tex:new Map(),caps:new Map(),
    depthMask:true,blend:'',cull:'',depthFunc:'',poly:'',viewport:'',clearColor:'',colorMask:'',rb:null};
  const uni=new WeakMap(),prevUni=new WeakMap(); // program -> Map(name -> string)
  const vaoState=new WeakMap();
  const vs=()=>{const key=st.vao||st;let s=vaoState.get(key);if(!s){s={ptr:new Map(),div:new Map(),en:new Map()};vaoState.set(key,s);}return s;};
  function call(name,redundant){
    bump(T.byFn,name);bump2(T.byPass,T.pass,name);
    if(redundant){bump(T.red,name);bump2(T.redPass,T.pass,name);}
    if(T.log)T.log.push(T.pass+' '+name+(redundant?' (R)':''));
  }
  const gl={};
  let n=100;
  for(const k of 'TEXTURE_2D FRAMEBUFFER READ_FRAMEBUFFER DRAW_FRAMEBUFFER ARRAY_BUFFER DEPTH_TEST CULL_FACE TRIANGLES STATIC_DRAW RENDERBUFFER POLYGON_OFFSET_FILL TEXTURE0 FLOAT DEPTH_BUFFER_BIT UNSIGNED_BYTE RGBA8 RGBA NONE NEAREST LINEAR ELEMENT_ARRAY_BUFFER DYNAMIC_DRAW DEPTH_COMPONENT24 DEPTH_ATTACHMENT COLOR_ATTACHMENT0 CLAMP_TO_EDGE BLEND VERTEX_SHADER UNSIGNED_SHORT UNSIGNED_INT TEXTURE_WRAP_T TEXTURE_WRAP_S TEXTURE_MIN_FILTER TEXTURE_MAG_FILTER SRC_ALPHA ONE_MINUS_SRC_ALPHA LINK_STATUS LEQUAL FRAGMENT_SHADER DEPTH_COMPONENT COLOR_BUFFER_BIT BACK COMPILE_STATUS STREAM_DRAW MAX_SAMPLES MAX_TEXTURE_SIZE ONE'.split(' '))gl[k]=++n;
  gl.TEXTURE0=33984;gl.TEXTURE1=33985;gl.TEXTURE2=33986;gl.TEXTURE3=33987;
  gl.FRAMEBUFFER_COMPLETE=36053;gl.COLOR_BUFFER_BIT=16384;gl.DEPTH_BUFFER_BIT=256;
  const simple=(name,key)=>{gl[name]=(...a)=>{const v=a.join(',');const r=st[key]===v;st[key]=v;call(name,r);};};
  simple('blendFunc','blend');simple('cullFace','cull');simple('depthFunc','depthFunc');simple('polygonOffset','poly');simple('viewport','viewport');simple('clearColor','clearColor');simple('colorMask','colorMask');
  gl.depthMask=v=>{const r=st.depthMask===v;st.depthMask=v;call('depthMask',r);};
  gl.enable=c=>{const r=st.caps.get(c)===true;st.caps.set(c,true);call('enable',r);};
  gl.disable=c=>{const r=(st.caps.get(c)||false)===false;st.caps.set(c,false);call('disable',r);};
  gl.useProgram=p=>{const r=st.program===p;st.program=p;call('useProgram',r);};
  gl.bindVertexArray=v=>{const r=st.vao===v;st.vao=v;call('bindVertexArray',r);};
  gl.bindFramebuffer=(target,fb)=>{let r;if(target===gl.FRAMEBUFFER){r=st.fbDraw===fb&&st.fbRead===fb;st.fbDraw=st.fbRead=fb;}else if(target===gl.DRAW_FRAMEBUFFER){r=st.fbDraw===fb;st.fbDraw=fb;}else{r=st.fbRead===fb;st.fbRead=fb;}call('bindFramebuffer',r);};
  gl.bindRenderbuffer=(t,rb)=>{const r=st.rb===rb;st.rb=rb;call('bindRenderbuffer',r);};
  gl.bindBuffer=(target,b)=>{if(target===gl.ARRAY_BUFFER){const r=st.arrayBuffer===b;st.arrayBuffer=b;call('bindBuffer',r);}else call('bindBuffer',false);};
  gl.activeTexture=u=>{const r=st.activeTex===u;st.activeTex=u;call('activeTexture',r);};
  gl.bindTexture=(target,t)=>{const r=st.tex.get(st.activeTex)===t;st.tex.set(st.activeTex,t);call('bindTexture',r);};
  gl.vertexAttribPointer=(i,size,type,norm,stride,offset)=>{const s=vs(),v=(st.arrayBuffer&&st.arrayBuffer.id)+':'+size+':'+type+':'+stride+':'+offset;const r=s.ptr.get(i)===v;s.ptr.set(i,v);call('vertexAttribPointer',r);};
  gl.vertexAttribDivisor=(i,d)=>{const s=vs();const r=s.div.get(i)===d;s.div.set(i,d);call('vertexAttribDivisor',r);};
  gl.enableVertexAttribArray=i=>{const s=vs();const r=s.en.get(i)===true;s.en.set(i,true);call('enableVertexAttribArray',r);};
  gl.disableVertexAttribArray=i=>{const s=vs();const r=s.en.get(i)===false;s.en.set(i,false);call('disableVertexAttribArray',r);};
  gl.vertexAttrib4f=()=>call('vertexAttrib4f',false);
  const setUniform=(fn,loc,value)=>{
    if(!loc){call(fn,false);return;}
    let m=uni.get(st.program);if(!m){m=new Map();uni.set(st.program,m);}
    let pm=prevUni.get(st.program);if(!pm){pm=new Map();prevUni.set(st.program,pm);}
    const v=typeof value==='number'?String(value):Array.prototype.join.call(value,',');
    const r=m.get(loc.name)===v;m.set(loc.name,v);call(fn,r);
    if(!r&&pm.get(loc.name)===v)T.sameAsPrevFrame++;
    bump2(T.uniNames||(T.uniNames=new Map()),(st.program&&st.program.tag||'?'),loc.name);
  };
  gl.uniform1i=(l,a)=>setUniform('uniform1i',l,a);gl.uniform1f=(l,a)=>setUniform('uniform1f',l,a);
  gl.uniform2f=(l,a,b)=>setUniform('uniform2f',l,[a,b]);gl.uniform4f=(l,a,b,c,d)=>setUniform('uniform4f',l,[a,b,c,d]);
  gl.uniform3fv=(l,v)=>setUniform('uniform3fv',l,v);gl.uniform1fv=(l,v)=>setUniform('uniform1fv',l,v);
  gl.uniformMatrix4fv=(l,t,v)=>setUniform('uniformMatrix4fv',l,v);
  T.endFrame=()=>{T.frame++;}; // prevUni is filled lazily below
  T.snapshotUniforms=programs=>{for(const p of programs){const m=uni.get(p);if(m)prevUni.set(p,new Map(m));}};
  gl.bufferData=(target,data,usage)=>{call('bufferData',false);const b=data&&data.byteLength||0;const name=target===gl.ARRAY_BUFFER?(st.arrayBuffer&&st.arrayBuffer.id):'ibo';bump2(T.upload,T.pass,'bytes',b);bump2(T.uploadCalls,T.pass,'n');bump(T.bufNames,T.pass+'#buf'+name,b);};
  gl.bufferSubData=(target,off,data)=>{call('bufferSubData',false);bump2(T.upload,T.pass,'bytes',data&&data.byteLength||0);};
  gl.drawElementsInstanced=(mode,count,type,offset,instances)=>{call('drawElementsInstanced',false);bump(T.draws,T.pass);bump(T.inst,T.pass,instances);bump(T.tris,T.pass,count/3*instances);};
  gl.drawElements=(mode,count)=>{call('drawElements',false);bump(T.draws,T.pass);bump(T.tris,T.pass,count/3);};
  gl.drawArrays=()=>{call('drawArrays',false);bump(T.draws,T.pass);};
  gl.clear=()=>call('clear',false);
  gl.blitFramebuffer=()=>call('blitFramebuffer',false);
  for(const f of ['createBuffer','createVertexArray','createFramebuffer','createTexture','createShader','createRenderbuffer'])gl[f]=()=>{call(f,false);return {id:++id};};
  const programs=[];T.programs=programs;
  gl.createProgram=()=>{call('createProgram',false);const p={id:++id,tag:'prog'+programs.length};programs.push(p);return p;};
  gl.getUniformLocation=(p,name)=>{call('getUniformLocation',false);return {name};};
  gl.getShaderParameter=gl.getProgramParameter=()=>true;gl.getShaderInfoLog=gl.getProgramInfoLog=()=>'';
  gl.checkFramebufferStatus=()=>36053;gl.getExtension=()=>null;gl.getParameter=()=>4096;gl.isContextLost=()=>false;
  for(const f of 'texParameteri texImage2D framebufferTexture2D drawBuffers deleteVertexArray deleteTexture deleteBuffer attachShader shaderSource renderbufferStorage renderbufferStorageMultisample readBuffer linkProgram framebufferRenderbuffer deleteRenderbuffer deleteFramebuffer compileShader deleteShader deleteProgram pixelStorei scissor invalidateFramebuffer'.split(' '))gl[f]=()=>call(f,false);
  T.reset=()=>{for(const k of ['byFn','byPass','red','redPass','upload','uploadCalls','draws','inst','tris','bufNames'])T[k].clear();T.sameAsPrevFrame=0;T.frame=0;if(T.uniNames)T.uniNames.clear();};
  return {gl,T};
}

// ---- Marqueurs de passe et crochets d'observation, poses par ancre de texte sur renderer.js de FERRO ----
export function instrument(src){
  let c=src;
  c=rep(c,"function shadowPass(light,dynamicBatch,slot,torchAxes,time){","function shadowPass(light,dynamicBatch,slot,torchAxes,time){__P(torchAxes?'ombre-torche':'ombre-lampe');",'p-lamp');
  c=rep(c,"renderStatic(casters,slot+1,true);renderBatch(dynamicBatch,dynamicBuffer,false,true);gl.disable(gl.POLYGON_OFFSET_FILL);","renderStatic(casters,slot+1,true);__P(torchAxes?'ombre-torche:dyn':'ombre-lampe:dyn');renderBatch(dynamicBatch,dynamicBuffer,false,true);gl.disable(gl.POLYGON_OFFSET_FILL);__H(torchAxes?'torch':'lamp',casters,p,shadowAxes,tangent);",'p-lamp2');
  c=rep(c,"function sunShadowPass(eye,axes,dynamicBatch,time,camera={},fx={},crowd=null){","function sunShadowPass(eye,axes,dynamicBatch,time,camera={},fx={},crowd=null){__P('ombre-soleil');",'p-sun');
  c=rep(c,"      renderStatic(casters,2,true);\n","      renderStatic(casters,2,true);__H('sun',casters,{p,r,u,fw,extent,near,far,center});__P('ombre-soleil:dyn');\n",'p-sun2');
  c=rep(c,"function skyPass(axes,f,time){","function skyPass(axes,f,time){__P('ciel');",'p-sky');
  c=rep(c,"function postPass(){","function postPass(){__P('post');",'p-post');
  c=rep(c,"const batch=packEffects(meshes,environment,eye);","const __prev=__P('fx');const batch=packEffects(meshes,environment,eye);",'p-fx');
  c=rep(c,"renderBatch(batch,fxBuffer,true);gl.depthMask(true);gl.disable(gl.BLEND);gl.useProgram(program);","renderBatch(batch,fxBuffer,true);gl.depthMask(true);gl.disable(gl.BLEND);gl.useProgram(program);__P(__prev==='arme'?'arme':'scene-apres-fx');",'p-fx2');
  c=rep(c,"fx=fx||{};autoScale=governor.update(fx,quality);resize();","__P('prep');fx=fx||{};autoScale=governor.update(fx,quality);resize();",'p-prep');
  c=rep(c,"      if(stats.shadows){\n        gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget.framebuffer);gl.clear(gl.DEPTH_BUFFER_BIT);","      if(stats.shadows){__P('ombre-clear');\n        gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget.framebuffer);gl.clear(gl.DEPTH_BUFFER_BIT);",'p-shclear');
  c=rep(c,"      const msaa=stats.bloom&&post.msaa?post.msaa:null;","      __P('scene-uniformes');const msaa=stats.bloom&&post.msaa?post.msaa:null;",'p-scene');
  c=rep(c,"if(environment)skyPass(axes,f,t);gl.useProgram(program);gl.bindVertexArray(vao);","if(environment)skyPass(axes,f,t);__P('scene-uniformes');gl.useProgram(program);gl.bindVertexArray(vao);",'p-scene2');
  c=rep(c,"      renderStatic(shown,0);\n","      __H('view',shown,{eye,axes,h:canvas.width/canvas.height/f,v:1/f,far:ranges[0],ranges,world:worldIndex});__P('scene-statique');renderStatic(shown,0);\n",'p-static');
  c=rep(c,"      renderBatch(dynamicBatch,dynamicBuffer,false);\n      if(crowd)","      __P('scene-dynamique');renderBatch(dynamicBatch,dynamicBuffer,false);\n      if(crowd)",'p-dyn');
  c=rep(c,"      if(overlay.length||overlayParticles.length) {","      if(overlay.length||overlayParticles.length) {__P('arme');",'p-arme');
  c=rep(c,"      if(stats.bloom)postPass();\n    }","      if(stats.bloom)postPass();__P('hors-draw');\n    }",'p-end');
  return c;
}

export function scene({world:spec=['camp',6],quality='auto',seed=96,patch=null,hooks={},rendererPath=new URL('./ferro-renderer-248043a.js',import.meta.url).pathname,options=undefined,marks=true}={}){
  const {gl,T}=makeGL();
  const __P=name=>{const prev=T.pass;T.pass=name;return prev;};
  const __H=(kind,...a)=>{const h=hooks[kind];if(h)h(...a);};
  const win={innerWidth:1280,innerHeight:720,devicePixelRatio:2};
  let rsrc=readFileSync(rendererPath,'utf8');
  if(patch)rsrc=patch(rsrc);
  if(marks)rsrc=instrument(rsrc);
  vm.runInThisContext('(function(window,__P,__H){'+rsrc+'\n})',{filename:'ferro-renderer.js'})(win,__P,__H);
  for(const m of ['world','destruction','economy','brain','simulation','actors','effects','motion']){
    const src=readFileSync(METAL+'/src/'+m+'.js','utf8');
    vm.runInThisContext('(function(window){'+src+'\n})',{filename:m+'.js'})(win);
  }
  const {FWorld,FSimulation,FBrain,FRender,FActors,FEffects,FMotion}=win;
  const world=spec[0]==='camp'?FWorld.create(seed,spec[1],{campaign:true,campaignVersion:2}):FWorld.create(seed,spec[1]);
  let brain=null;try{brain=FBrain.create({mode:'cpu'});}catch{}
  const sim=FSimulation.create(world,{armorSystem:true,...(brain?{brain}:{})});sim.setDifficulty?.(0);
  const canvas={width:300,height:150,clientWidth:1280,clientHeight:720,getContext:()=>gl,addEventListener(){},removeEventListener(){}};
  const renderer=FRender.create(canvas,options);renderer.resize(quality);
  renderer.setWorld(sim.destruction?.meshes||world.meshes,sim.destruction?.lights||world.lights,world.environment);
  let renderRevision=sim.state.destructionRevision??sim.destruction?.revision??-1;
  const motion=FMotion.create(),leftMotion=FMotion.create(),actorMotion=new Map(),systemMotion=new Map();
  const prefs={shadows:true,bloom:true,fov:74};
  const game=loadModels(METAL,{sim,world,quality,renderer,actorMotion,systemMotion,motion,leftMotion,prefs,clamp:FSimulation.clamp,FMotion,FActors,FEffects,window:{FEffects},innerWidth:1280,innerHeight:720},{});
  const s=sim.state;
  if(s.inventory?.weapons){s.inventory.weapons.fill(true);if(s.inventory.ammo)s.inventory.ammo=s.inventory.ammo.map((v,i)=>[180,36,12,16,200][i]??v);}
  const input={moveX:0,moveY:1,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:true,assist:false};
  let frameIndex=0,leg=0;
  const stops=[...(world.enemies||[]).map(e=>[e.x,e.z]),...(world.cores||[]).map(c=>[c.x,c.z]),[world.exit.x,world.exit.z]];
  const route=[];{let cur=[world.spawn.x,world.spawn.z];const left=stops.slice();while(left.length){let bi=0,bd=Infinity;for(let k=0;k<left.length;k++){const d=Math.hypot(left[k][0]-cur[0],left[k][1]-cur[1]);if(d<bd){bd=d;bi=k;}}cur=left.splice(bi,1)[0];route.push(cur);}}
  const out={win,world,sim,renderer,game,gl,T,canvas,route};
  out.frame=(dt=1/60,{speed=7,sweep=45,draw=true}={})=>{
    const i=frameIndex++;T.pass='hors-draw';
    const p=s.player,w=route[leg%route.length],dx=w[0]-p.x,dz=w[1]-p.z,d=Math.hypot(dx,dz);
    if(d<1.5)leg++;else{const k=Math.min(1,speed*dt/d);p.x+=dx*k;p.z+=dz*k;const y=sim.ground(p.x,p.z);if(Number.isFinite(y))p.y=y;}
    input.moveX=0;input.moveY=0;input.sprint=false;input.fire=(i%30)<12;input.dash=false;input.weapon=[0,2,1,3][Math.floor(i/300)%4];
    p.yaw=Math.atan2(dx,-dz)+Math.sin(i/sweep)*.9;p.pitch=Math.sin(i/70)*.12;
    sim.step(dt,input);input.lookX=input.lookY=0;
    for(const e of s.events||[]){if(e.name==='shot'||e.name==='fracture')motion.impulse(e.name==='shot'?'shot':'fracture');}
    if(s.player.hp<50)s.player.hp=100;
    const dd=sim.destruction,revision=s.destructionRevision??dd?.revision;let changed=false;
    if(dd&&revision!==renderRevision){renderer.updateWorld(dd.meshes,revision,dd.lights);renderRevision=revision;changed=true;}
    for(const e of s.enemies){const scale=e.type===3?Math.max(1,Number(e.bossScale)||1):1;if(e.deployed===false||e.hp<=0||(e.type!==1&&e.type!==2&&e.type!==3)||(e.x-s.player.x)**2+(e.z-s.player.z)**2>(scale>1?140:40)**2){actorMotion.delete(e.id);continue;}const pose=actorMotion.get(e.id)||{phase:e.id*.7,blend:0};pose.phase=(pose.phase+(e.moveSpeed||0)*dt*4.8/scale)%(Math.PI*2);pose.blend+=(Math.min(1,(e.moveSpeed||0)/.9)-pose.blend)*(1-Math.exp(-dt*15));actorMotion.set(e.id,pose);}
    const signals={time:s.time,lookYaw:.6,lookPitch:0,firing:input.fire};
    const view=motion.update(dt,s.locomotion||{},signals,true);leftMotion.update(dt,s.locomotion||{},{...signals,firing:false},true);
    const camera={pos:[p.x,(p.y||0)+1.62+view.height,p.z],yaw:p.yaw,pitch:p.pitch,roll:view.roll,fov:prefs.fov+view.fov};
    const dynamic=game.models(s.time,true,camera);
    const lights=FEffects.lights(s);
    const fx={time:s.time,flash:Math.max(s.flash||0,s.leftFlash||0),lights,damage:s.damage,pulse:0,shake:0,frameMs:16.7,shadows:prefs.shadows,bloom:prefs.bloom,horror:s.director,adaptive:false};
    let drawMs=0;
    if(draw){T.snapshotUniforms(T.programs);const t=performance.now();renderer.draw(camera,dynamic,fx);drawMs=performance.now()-t;T.endFrame();}
    return {i,changed,drawMs,camera,dynamic,fx};
  };
  return out;
}
export const mapObj=(m,f=v=>v)=>Object.fromEntries([...m].map(([k,v])=>[k,v instanceof Map?mapObj(v,f):f(v)]));
