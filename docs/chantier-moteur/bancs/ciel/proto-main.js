// CIEL : prototype et banc (inséré dans la page par gen-proto.mjs). Modes : #shots (captures), #bench (mesures).
const OUT={shots:{},stats:{},bench:{},errors:[],info:{}};
const MODE=(location.hash||'#shots').slice(1).split(',')[0],ARG=(location.hash||'').split(',').slice(1);
function finish(){document.getElementById('out').textContent='@@JSON@@'+JSON.stringify(OUT)+'@@END@@';}
window.onerror=(m,s,l,c)=>{OUT.errors.push(String(m)+' @'+l+':'+c);finish();};
const canvas=document.getElementById('c');
const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
const extF=gl.getExtension('EXT_color_buffer_float'),extH=gl.getExtension('EXT_color_buffer_half_float');gl.getExtension('OES_texture_float_linear');
const dbg=gl.getExtension('WEBGL_debug_renderer_info');
OUT.info={renderer:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):'?',float:!!extF,half:!!extH,dpr:devicePixelRatio,max3d:gl.getParameter(gl.MAX_3D_TEXTURE_SIZE)};
function compile(type,src,name){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){OUT.errors.push(name+': '+gl.getShaderInfoLog(s));}return s;}
function program(name){
  const t0=performance.now(),p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,SH.vert,'vert'));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,SH[name],name));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))OUT.errors.push(name+' link: '+gl.getProgramInfoLog(p));
  const cache={};p.u=n=>n in cache?cache[n]:(cache[n]=gl.getUniformLocation(p,n));p.ms=performance.now()-t0;return p;
}
const P={};for(const n of ['old','flat','noise','sky','cloud','blur','comp','direct'])P[n]=program(n);
const vao=gl.createVertexArray();gl.bindVertexArray(vao);
const HDR=extF||extH;
function tex2D(w,h,hdr,filter=gl.LINEAR){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,hdr&&HDR?gl.RGBA16F:gl.RGBA8,w,h);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
function fbo(...textures){const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);textures.forEach((t,i)=>gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,t,0));
  gl.drawBuffers(textures.map((t,i)=>gl.COLOR_ATTACHMENT0+i));const s=gl.checkFramebufferStatus(gl.FRAMEBUFFER);if(s!==gl.FRAMEBUFFER_COMPLETE)OUT.errors.push('fbo '+s);return f;}
const px=new Uint8Array(4);
const pxf=new Float32Array(4);
function sync(f,float=false){gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.readBuffer(gl.COLOR_ATTACHMENT0);if(float)gl.readPixels(0,0,1,1,gl.RGBA,gl.FLOAT,pxf);else gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);}
// --- bruit 3D 64^3 généré par tranches sur le GPU
const NS=64,noise=gl.createTexture();gl.bindTexture(gl.TEXTURE_3D,noise);gl.texStorage3D(gl.TEXTURE_3D,7,gl.RGBA8,NS,NS,NS);
for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.REPEAT],[gl.TEXTURE_WRAP_T,gl.REPEAT],[gl.TEXTURE_WRAP_R,gl.REPEAT]])gl.texParameteri(gl.TEXTURE_3D,k,v);
const noiseFbo=gl.createFramebuffer(),syncTex=tex2D(1,1,false),syncFbo=fbo(syncTex);
function bakeNoise(){
  gl.useProgram(P.noise);gl.viewport(0,0,NS,NS);gl.bindFramebuffer(gl.FRAMEBUFFER,noiseFbo);
  for(let z=0;z<NS;z++){gl.framebufferTextureLayer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,noise,0,z);gl.uniform1f(P.noise.u('uZ'),(z+.5)/NS);gl.drawArrays(gl.TRIANGLES,0,3);}
  gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);gl.bindTexture(gl.TEXTURE_3D,noise);gl.generateMipmap(gl.TEXTURE_3D);
}
const SKYW=192,SKYH=128,skyR=tex2D(SKYW,SKYH,true),skyM=tex2D(SKYW,SKYH,true),skyFbo=fbo(skyR,skyM);
let DOME=1024;const domes=[],domeFbos=[];
function makeDomes(size){DOME=size;for(const t of domes)gl.deleteTexture(t);for(const f of domeFbos)gl.deleteFramebuffer(f);domes.length=0;domeFbos.length=0;for(let i=0;i<4;i++){const t=tex2D(size,size,true);domes.push(t);domeFbos.push(fbo(t));}}
makeDomes(1024);
// --- préréglages
const RAD=Math.PI/180,dirOf=(el,az)=>[Math.cos(el*RAD)*Math.sin(az*RAD),Math.sin(el*RAD),-Math.cos(el*RAD)*Math.cos(az*RAD)];
const BRc=[5.802e-3,13.558e-3,33.1e-3],BOc=[.650e-3,1.881e-3,.085e-3],ALT=.25;
const BASE={sunAz:25,mie:.004,g:.8,ray:1,ozone:1,mieTint:[1,1,1],absorb:[0,0,0],ground:[.18,.17,.15],E:[22,22,22],atmoScale:1,cloud:[.42,15,1.5,1.6],shape:[6,.5,0,0],cloudTint:[1,1,1],wind:[2.3,.1,1.1],aerial:.016,exposure:.20,stars:0,night:[0,0,0],sunSize:.0125,camYaw:-22,camPitch:14,tone:0};
const PRESETS={
  'aube':{sunEl:4.2,mie:.006,cloud:[.40,13,1.9,1.4],exposure:.42,camYaw:-16,camPitch:12,wind:[5.1,.3,2.2]},
  'plein-jour':{sunEl:47,sunAz:40,cloud:[.45,15,1.5,1.7],exposure:.22,camYaw:-34,camPitch:20},
  'crepuscule':{sunEl:.9,mie:.0055,cloud:[.46,9,4.0,1.1],shape:[9,.55,.4,0],exposure:.62,camYaw:-12,camPitch:11,wind:[7.7,.6,3.1]},
  'nuit':{sunEl:-32,sunAz:205,moon:[34,18],E:[.050,.056,.066],cloud:[.33,12,1.8,1.4],exposure:5.5,stars:1,night:[.004,.006,.0105],camYaw:-14,camPitch:17,wind:[1.2,.9,6.3],moonSize:.026},
  'orage':{sunEl:36,mie:.02,atmoScale:.16,cloud:[.90,34,.75,2.8],shape:[8,.5,.6,0],cloudTint:[.70,.77,.92],exposure:.40,camYaw:28,camPitch:15,wind:[4.4,.2,8.8],aerial:.03},
  'cendres':{sunEl:13,mie:.055,g:.74,mieTint:[1.,.70,.40],absorb:[.004,.013,.034],ground:[.20,.13,.08],cloud:[.58,10,1.1,1.8],shape:[8,.55,.55,0],cloudTint:[.80,.58,.40],exposure:.50,camYaw:-15,camPitch:11,wind:[9.4,.7,4.2],aerial:.07},
  'brume-industrielle':{sunEl:21,mie:.034,g:.76,mieTint:[.98,.96,.88],absorb:[.0015,.002,.0035],cloud:[.30,10,2.6,.9],shape:[10,.5,.7,0],exposure:.26,camYaw:-20,camPitch:12,aerial:.06}
};
function preset(name){const p={...BASE,...PRESETS[name],name};p.sunDir=dirOf(p.sunEl,p.sunAz);p.moonDir=p.moon?dirOf(p.moon[0],p.sunAz+180+p.moon[1]):[0,-1,0];p.lightDir=p.moon?p.moonDir:p.sunDir;return p;}
function transmitJS(dir,p){
  const o=RG_+ALT,sph=r=>{const b=o*dir[1],c=o*o-r*r,h=b*b-c;if(h<0)return [1e9,-1e9];const s=Math.sqrt(h);return [-b-s,-b+s];};
  const g=sph(RG_);if(g[0]>0&&g[0]<1e8)return [0,0,0];
  const L=sph(6460)[1],od=[0,0,0];
  for(let i=0;i<8;i++){const a=i/8,b=(i+1)/8,t0=L*a*a,t1=L*b*b,tm=.5*(t0+t1),h=Math.hypot(dir[0]*tm,o+dir[1]*tm,dir[2]*tm)-RG_;
    const dR=Math.exp(-h/8)*p.ray,dM=Math.exp(-h/1.2),dO=Math.max(0,1-Math.abs(h-25)/15)*p.ozone;
    for(let k=0;k<3;k++)od[k]+=(BRc[k]*dR+(p.mie*1.11+p.absorb[k])*dM+BOc[k]*dO)*(t1-t0);}
  return od.map(v=>Math.exp(-v));
}
const RG_=6360;
function atmoUniforms(pr,p){
  gl.uniform3fv(pr.u('uLightDir'),p.lightDir);gl.uniform3fv(pr.u('uLightRad'),p.E);gl.uniform4f(pr.u('uAtmo'),p.mie,p.g,p.ray,p.ozone);
  gl.uniform3fv(pr.u('uMieTint'),p.mieTint);gl.uniform3fv(pr.u('uAbsorb'),p.absorb);gl.uniform3fv(pr.u('uGround'),p.ground);gl.uniform1f(pr.u('uAlt'),ALT);
}
function cloudUniforms(pr,p,time){
  gl.uniform4fv(pr.u('uCloud'),p.cloud);gl.uniform4fv(pr.u('uCloudShape'),p.shape);gl.uniform3f(pr.u('uWind'),p.wind[0]+time*.012,p.wind[1]+time*.0004,p.wind[2]+time*.005);
  gl.uniform3fv(pr.u('uCloudTint'),p.cloudTint);gl.uniform1f(pr.u('uAerial'),p.aerial);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,noise);gl.uniform1i(pr.u('uNoise'),0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,skyR);gl.uniform1i(pr.u('uSkyR'),1);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,skyM);gl.uniform1i(pr.u('uSkyM'),2);
}
function axesOf(yawDeg,pitchDeg){const yaw=yawDeg*RAD,pitch=pitchDeg*RAD,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);return {right:[cy,0,sy],up:[-sy*sp,cp,cy*sp],forward:[sy*cp,sp,-cy*cp]};}
function viewUniforms(pr,p,cam,W,H,dither=1){
  const a=axesOf(cam.yaw,cam.pitch),tan=Math.tan((cam.fov||75)*RAD/2);
  gl.uniform3fv(pr.u('uRight'),a.right);gl.uniform3fv(pr.u('uUp'),a.up);gl.uniform3fv(pr.u('uForward'),a.forward);gl.uniform2f(pr.u('uFov'),W/H*tan,tan);
  const T=transmitJS(p.sunDir,p),mx=Math.max(T[0],T[1],T[2]),bright=mx>1e-5?(p.sunBright||(3+37*Math.pow(mx,1.5)))/p.exposure/mx:0;
  gl.uniform3fv(pr.u('uSunDir'),p.sunDir);gl.uniform3fv(pr.u('uMoonDir'),p.moonDir);
  gl.uniform4f(pr.u('uSunDisc'),T[0]*bright,T[1]*bright,T[2]*bright,p.sunSize);
  const mg=p.moon?1/p.exposure:0;gl.uniform4f(pr.u('uMoonDisc'),1.45*mg,1.5*mg,1.62*mg,p.moonSize||.02);
  gl.uniform4f(pr.u('uView'),p.exposure,p.stars*.35/p.exposure,2*tan/H,dither);gl.uniform4f(pr.u('uNight'),p.night[0]/p.exposure,p.night[1]/p.exposure,p.night[2]/p.exposure,-Math.sqrt(2*ALT/RG_));gl.uniform1f(pr.u('uTone'),p.tone);
}
function bakeSky(p){gl.useProgram(P.sky);gl.bindFramebuffer(gl.FRAMEBUFFER,skyFbo);gl.viewport(0,0,SKYW,SKYH);atmoUniforms(P.sky,{...p,E:p.E.map(v=>v*p.atmoScale)});gl.drawArrays(gl.TRIANGLES,0,3);}
function bakeCloud(p,index,time,row0=0,rows=DOME){
  // marche brute dans la texture de travail (3), avec une ligne de garde, puis résolution filtrée vers la cible
  gl.useProgram(P.cloud);gl.bindFramebuffer(gl.FRAMEBUFFER,domeFbos[3]);gl.viewport(0,0,DOME,DOME);atmoUniforms(P.cloud,p);cloudUniforms(P.cloud,p,time);
  gl.enable(gl.SCISSOR_TEST);gl.scissor(0,Math.max(0,row0-1),DOME,rows+2);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.useProgram(P.blur);gl.bindFramebuffer(gl.FRAMEBUFFER,domeFbos[index]);gl.activeTexture(gl.TEXTURE5);gl.bindTexture(gl.TEXTURE_2D,domes[3]);gl.uniform1i(P.blur.u('uSrc'),5);gl.uniform1f(P.blur.u('uTexel'),1/DOME);
  gl.scissor(0,row0,DOME,rows);gl.drawArrays(gl.TRIANGLES,0,3);gl.disable(gl.SCISSOR_TEST);
}
function drawComp(p,cam,target,W,H,opt={}){
  gl.useProgram(P.comp);gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,W,H);atmoUniforms(P.comp,p);viewUniforms(P.comp,p,cam,W,H,opt.dither===undefined?1:opt.dither);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_3D,noise);gl.uniform1i(P.comp.u('uNoise'),0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,skyR);gl.uniform1i(P.comp.u('uSkyR'),1);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,skyM);gl.uniform1i(P.comp.u('uSkyM'),2);
  gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,domes[opt.a||0]);gl.uniform1i(P.comp.u('uCloudA'),3);
  gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,domes[opt.b===undefined?1:opt.b]);gl.uniform1i(P.comp.u('uCloudB'),4);
  gl.uniform4f(P.comp.u('uBlend'),opt.blend===undefined?.5:opt.blend,opt.shiftX||0,opt.shiftZ||0,0);gl.drawArrays(gl.TRIANGLES,0,3);
}
function drawDirect(p,cam,target,W,H,parts=1,time=0){
  gl.useProgram(P.direct);gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,W,H);atmoUniforms(P.direct,p);cloudUniforms(P.direct,p,time);viewUniforms(P.direct,p,cam,W,H);
  gl.uniform1i(P.direct.u('uParts'),parts);gl.drawArrays(gl.TRIANGLES,0,3);
}
const OLD_ENV={woodland:{skyTop:[.055,.105,.14],skyBottom:[.20,.25,.22],fog:[.15,.205,.18],sunDirection:[-.48,.78,.36],sunColor:[.48,.62,.59],wind:.7},
  quarry:{skyTop:[.11,.07,.08],skyBottom:[.35,.16,.09],fog:[.23,.13,.09],sunDirection:[-.65,.56,-.36],sunColor:[.66,.33,.15],wind:1.1},
  garden:{skyTop:[.025,.035,.08],skyBottom:[.14,.16,.26],fog:[.10,.135,.22],sunDirection:[.42,.45,-.79],sunColor:[.36,.48,.74],wind:.45},
  bitume:{skyTop:[.11,.39,.72],skyBottom:[.74,.84,.91],fog:[.70,.79,.86],sunDirection:[-.42,.64,.38],sunColor:[1.40,1.20,.94],wind:.85}};
function drawOld(env,cam,target,W,H,time=20){
  const e=OLD_ENV[env],a=axesOf(cam.yaw,cam.pitch),tan=Math.tan((cam.fov||75)*RAD/2),s=e.sunDirection,l=Math.hypot(...s);
  gl.useProgram(P.old);gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,W,H);
  gl.uniform3fv(P.old.u('uSkyRight'),a.right);gl.uniform3fv(P.old.u('uSkyUp'),a.up);gl.uniform3fv(P.old.u('uSkyForward'),a.forward);
  gl.uniform3fv(P.old.u('uSkyTop'),e.skyTop);gl.uniform3fv(P.old.u('uSkyBottom'),e.skyBottom);gl.uniform3fv(P.old.u('uSkyFog'),e.fog);
  gl.uniform3fv(P.old.u('uSunDirection'),s.map(v=>v/l));gl.uniform3fv(P.old.u('uSunColor'),e.sunColor);gl.uniform2f(P.old.u('uSkyFov'),W/H*tan,tan);gl.uniform2f(P.old.u('uSkyMotion'),time,e.wind);
  gl.drawArrays(gl.TRIANGLES,0,3);
}
function drawFlat(target,W,H){gl.useProgram(P.flat);gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,W,H);gl.drawArrays(gl.TRIANGLES,0,3);}
function setup(p,time=0){bakeSky(p);bakeCloud(p,0,time);bakeCloud(p,1,time);}
function grab(name){OUT.shots[name]=canvas.toDataURL('image/png');}
function readAll(target,W,H){const d=new Uint8Array(W*H*4);gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,d);return d;}
// Bandes : part des pixels du ciel (moitié haute) pris dans une plage verticale d'au moins 8 pixels strictement identiques.
function bands(d,W,H){
  let inRuns=0,total=0,maxRun=0;const levels=new Set();
  for(let c=0;c<48;c++){const x=Math.floor((c+.5)*W/48);let run=1;
    for(let y=Math.floor(H*.5)+1;y<H;y++){const i=(y*W+x)*4,j=i-W*4;total++;levels.add(d[i]<<16|d[i+1]<<8|d[i+2]);
      if(d[i]===d[j]&&d[i+1]===d[j+1]&&d[i+2]===d[j+2])run++;else{if(run>=8)inRuns+=run;if(run>maxRun)maxRun=run;run=1;}}
    if(run>=8)inRuns+=run;if(run>maxRun)maxRun=run;}
  return {partPlages8:+(inRuns/total).toFixed(4),plageMax:maxRun,couleurs:levels.size};
}
function diff(a,b){let sum=0,n3=0,n10=0;const n=a.length/4;for(let i=0;i<a.length;i+=4){const m=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));sum+=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;if(m>3)n3++;if(m>10)n10++;}return {mad:+(sum/n).toFixed(3),part3:+(n3/n).toFixed(4),part10:+(n10/n).toFixed(4)};}
function med(a){const s=[...a].sort((x,y)=>x-y);return s[s.length>>1];}
function q(a,f){const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(s.length*f))];}

try{
  let t0=performance.now();bakeNoise();sync(syncFbo);OUT.stats.bruit3dMs=+(performance.now()-t0).toFixed(2);
  OUT.stats.compileMs=Object.fromEntries(Object.entries(P).map(([k,v])=>[k,+v.ms.toFixed(1)]));
  if(MODE==='shots'){
    const W=canvas.width,H=canvas.height,list=ARG.length?ARG:Object.keys(PRESETS);
    for(const name of list){
      const p=preset(name);setup(p);
      const cam={yaw:p.sunAz+p.camYaw+(p.moon?180+p.moon[1]:0),pitch:p.camPitch,fov:75};
      drawComp(p,cam,null,W,H);grab('nouveau-'+name);
      p.tone=1;p.exposure*=1.45;drawComp(p,cam,null,W,H);grab('nouveau-'+name+'-ton-filmique');
    }
    if(!ARG.length){
    // vues de contrôle : zénith (pas de pincement du dôme), contre-jour, ton filmique
    let p=preset('plein-jour');setup(p);
    drawComp(p,{yaw:p.sunAz+70,pitch:78,fov:95},null,W,H);grab('nouveau-plein-jour-zenith');
    drawComp(p,{yaw:p.sunAz+180,pitch:10,fov:75},null,W,H);grab('nouveau-plein-jour-dos-au-soleil');
    // identité visuelle : chemin par textures contre calcul direct par pixel (même préréglage, même caméra)
    p=preset('plein-jour');setup(p);const cam={yaw:p.sunAz+p.camYaw,pitch:p.camPitch,fov:75};
    const ta=tex2D(W,H,false),fa=fbo(ta),tb=tex2D(W,H,false),fb=fbo(tb);
    drawComp(p,cam,fa,W,H);drawDirect(p,cam,fb,W,H,1);const A=readAll(fa,W,H),B=readAll(fb,W,H);OUT.stats.texturesContreDirect=diff(A,B);
    drawDirect(p,cam,null,W,H,1);grab('nouveau-plein-jour-calcul-direct');
    // dôme à 512 et 2048 contre 1024
    for(const size of [512,2048]){makeDomes(size);setup(p);drawComp(p,cam,fb,W,H);OUT.stats['dome'+size+'Contre1024']=diff(A,readAll(fb,W,H));if(size===512){drawComp(p,cam,null,W,H);grab('nouveau-plein-jour-dome512');}}
    makeDomes(1024);
    // bandes à 2560x1440 : ciel actuel (jardin, nuit bleue) contre nouveau ciel de nuit, avec et sans tramage
    const BW=2560,BH=1440,tc=tex2D(BW,BH,false),fc=fbo(tc),camB={yaw:200,pitch:24,fov:75};
    for(const env of ['garden','woodland','quarry']){drawOld(env,camB,fc,BW,BH);OUT.stats['bandesActuel-'+env]=bands(readAll(fc,BW,BH),BW,BH);}
    for(const name of ['nuit','aube','plein-jour']){p=preset(name);setup(p);const c2={yaw:p.sunAz+p.camYaw+(p.moon?180+p.moon[1]:0)+60,pitch:24,fov:75};
      drawComp(p,c2,fc,BW,BH,{dither:1});OUT.stats['bandesNouveau-'+name+'-trame']=bands(readAll(fc,BW,BH),BW,BH);
      drawComp(p,c2,fc,BW,BH,{dither:0});OUT.stats['bandesNouveau-'+name+'-sansTrame']=bands(readAll(fc,BW,BH),BW,BH);}
    }
  }
  if(MODE==='bench'){
    const sizes=[[2560,1440],[2880,1864]],rounds=+(ARG[0]||36),p=preset(ARG[1]||'plein-jour'),pn=preset('nuit');
    // coûts ponctuels (synchronisés par lecture d'un pixel)
    const once=(f,target,float=false)=>{const a=[];for(let i=0;i<7;i++){const t=performance.now();f();sync(target,float&&HDR);a.push(performance.now()-t);}return +med(a).toFixed(2);};
    OUT.bench.cuissonAtmosphere192x128Ms=once(()=>bakeSky(p),skyFbo,true);
    OUT.bench.cuissonDome1024Ms=once(()=>bakeCloud(p,2,0),domeFbos[2],true);
    OUT.bench.lectureVide=once(()=>{},syncFbo);
    setup(p);
    for(const [W,H] of sizes){
      const fbs=[fbo(tex2D(W,H,false)),fbo(tex2D(W,H,false))],cam={yaw:p.sunAz+p.camYaw,pitch:p.camPitch,fov:75};
      let strip=0,strip4=0;
      const V={
        plat:{m:6,f:t=>drawFlat(t,W,H)},
        actuel:{m:6,f:t=>drawOld('woodland',cam,t,W,H)},
        textures:{m:6,f:t=>drawComp(p,cam,t,W,H,{blend:.37,shiftX:.01,shiftZ:.004})},
        texturesNuit:{m:6,f:t=>drawComp(pn,cam,t,W,H,{blend:.37,shiftX:.01,shiftZ:.004})},
        texturesTranche64:{m:6,f:t=>{bakeCloud(p,2,strip,(strip%64)*16,16);strip++;drawComp(p,cam,t,W,H,{blend:.37,shiftX:.01,shiftZ:.004});}},
        texturesTranche256:{m:6,f:t=>{bakeCloud(p,2,strip4,(strip4%256)*4,4);strip4++;drawComp(p,cam,t,W,H,{blend:.37,shiftX:.01,shiftZ:.004});}},
        directAtmosphere:{m:1,f:t=>drawDirect(p,cam,t,W,H,0)},
        directComplet:{m:1,f:t=>drawDirect(p,cam,t,W,H,1)}
      };
      const names=Object.keys(V),S=Object.fromEntries(names.map(n=>[n,[]]));
      const one=v=>{const t=performance.now();for(let i=0;i<v.m;i++)v.f(fbs[i&1]);sync(fbs[(v.m-1)&1]);return (performance.now()-t)/v.m;};
      for(let r=-3;r<rounds;r++)for(let k=0;k<names.length;k++){const n=names[(k+r+3)%names.length];if((n==='directAtmosphere'||n==='directComplet')&&r>=0&&r%4)continue;const ms=one(V[n]);if(r>=0)S[n].push(ms);}
      const res={};
      for(const n of names){const base=S.plat,paired=S[n].map((v,i)=>v-base[Math.min(base.length-1,n.startsWith('direct')?i*4:i)]);
        res[n]={n:S[n].length,mediane:+med(S[n]).toFixed(3),p10:+q(S[n],.1).toFixed(3),p90:+q(S[n],.9).toFixed(3),ecartApparieAuPlat:+med(paired).toFixed(3),ecartP10:+q(paired,.1).toFixed(3),ecartP90:+q(paired,.9).toFixed(3)};}
      const pairs=(a,b)=>{const d=S[a].map((v,i)=>v-S[b][i]);return {mediane:+med(d).toFixed(3),p10:+q(d,.1).toFixed(3),p90:+q(d,.9).toFixed(3),ratio:+(med(S[a].map((v,i)=>v-S.plat[i]))/Math.max(1e-6,med(S[b].map((v,i)=>v-S.plat[i])))).toFixed(3)};};
      res['textures-moins-actuel']=pairs('textures','actuel');res['tranche64-moins-actuel']=pairs('texturesTranche64','actuel');res['tranche256-moins-actuel']=pairs('texturesTranche256','actuel');res['nuit-moins-actuel']=pairs('texturesNuit','actuel');
      OUT.bench[W+'x'+H]=res;
    }
  }
}catch(error){OUT.errors.push(String(error&&error.stack||error));}
finish();
