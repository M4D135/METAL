// STAB — page file:// pour Chrome sans interface : coût de création du renderer (compilation + édition de liens
// des 5 programmes), puis premier dessin de chaque passe contre les suivants, sur des contextes WebGL2 neufs.
// node gen-shader.mjs <racine METAL> <sortie.html>
import {readFileSync, writeFileSync} from 'node:fs';
const [root, out] = process.argv.slice(2), src = n => readFileSync(root + '/src/' + n, 'utf8');
const driver = `
(function(){
  const out={reps:[]};
  try{
    const P=WebGL2RenderingContext.prototype,acc={compile:0,link:0,status:0,uniformLoc:0};
    for(const [k,key] of [['compileShader','compile'],['linkProgram','link'],['getProgramParameter','status'],['getShaderParameter','status'],['getUniformLocation','uniformLoc']]){const f=P[k];P[k]=function(...a){const t=performance.now();const r=f.apply(this,a);acc[key]+=performance.now()-t;return r;};}
    const t0=performance.now();const world=FWorld.create(96,0,{campaign:true,campaignVersion:2});out.worldMs=+(performance.now()-t0).toFixed(1);
    const probe=document.createElement('canvas').getContext('webgl2');out.parallelCompile=!!probe.getExtension('KHR_parallel_shader_compile');out.timerQuery=!!probe.getExtension('EXT_disjoint_timer_query_webgl2');
    const dbg=probe.getExtension('WEBGL_debug_renderer_info');out.gpu=dbg?probe.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'?';
    for(let rep=0;rep<4;rep++){
      const c=document.createElement('canvas');c.style.cssText='width:1280px;height:720px;display:block';document.body.appendChild(c);
      for(const k in acc)acc[k]=0;
      let t=performance.now();const r=FRender.create(c);const createMs=performance.now()-t;const A={...acc};
      const gl=c.getContext('webgl2'),px=new Uint8Array(4);const sync=()=>{gl.finish();gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);};
      r.resize('auto');t=performance.now();r.setWorld(world.meshes,world.lights,world.environment);const setWorldMs=performance.now()-t;
      const cam={pos:[world.spawn.x,(world.spawn.y||0)+1.62,world.spawn.z],yaw:world.spawn.yaw||0,pitch:0,roll:0,fov:74};
      const fx={time:1,flash:0,lights:[],damage:0,pulse:0,shake:0,frameMs:16.7,shadows:true,bloom:true,horror:null,adaptive:false};
      const time=(dyn)=>{fx.time+=1/60;const t=performance.now();r.draw(cam,dyn,fx);sync();return +(performance.now()-t).toFixed(2);};
      const plain=[];for(let i=0;i<6;i++)plain.push(time([]));
      const part=[{shape:'sphere',p:[cam.pos[0]+Math.sin(cam.yaw)*3,cam.pos[1],cam.pos[2]-Math.cos(cam.yaw)*3],s:[1,1,1],mat:4,r:[0,0,0],emissive:.6,fx:true,alpha:.5,color:[1,.6,.2]}];
      let fxDraws=[],fxError=null;try{for(let i=0;i<4;i++)fxDraws.push(time(part));}catch(e){fxError=String(e);}
      const box=[{shape:'box',p:[cam.pos[0]+Math.sin(cam.yaw)*2,cam.pos[1]-.3,cam.pos[2]-Math.cos(cam.yaw)*2],s:[.3,.3,.3],mat:2,r:[0,0,0],emissive:0,overlay:true}];
      let ovDraws=[],ovError=null;try{for(let i=0;i<4;i++)ovDraws.push(time(box));}catch(e){ovError=String(e);}
      // changement de palier du gouverneur : réallocation des cibles (resize avec une autre qualité)
      // paliers du gouverneur imités par une qualité numérique (même atlas d'ombre 512, cibles post réallouées, canvas redimensionné)
      const gov=[];r.resize(1.3);for(let i=0;i<3;i++)time([]);
      for(let k=0;k<6;k++){const q=k%2?1.3:1.17;let t2=performance.now();r.resize(q);const d=time([]);const stepMs=+(performance.now()-t2).toFixed(2);const next=[time([]),time([])];gov.push({q,stepMs,next});}
      r.resize('auto');const resizeHigh=0,resizeAuto=0;for(let i=0;i<2;i++)time([]);
      const after=[];for(let i=0;i<4;i++)after.push(time([]));
      out.reps.push({rep,createMs:+createMs.toFixed(1),compileMs:+A.compile.toFixed(1),linkMs:+A.link.toFixed(1),statusMs:+A.status.toFixed(1),uniformLocMs:+A.uniformLoc.toFixed(1),setWorldMs:+setWorldMs.toFixed(1),plain,fxDraws,fxError,ovDraws,ovError,gov,after,size:[c.width,c.height]});
      r.dispose();c.remove();const lose=gl.getExtension('WEBGL_lose_context');if(lose)lose.loseContext();
    }
  }catch(e){out.error=String(e&&e.stack||e);}
  document.getElementById('out').textContent=JSON.stringify(out);document.title='done';
})();`;
writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8"><title>stab</title></head><body style="margin:0"><pre id="out">pending</pre>\n<script>${src('renderer.js')}</script>\n<script>${src('world.js')}</script>\n<script>${driver}</script></body></html>`);
console.log('wrote', out);
