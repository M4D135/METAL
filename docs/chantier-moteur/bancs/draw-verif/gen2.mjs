// DRAW : page de jeu instrumentee = METAL 0.8 (lecture seule) + renderer de FERRO v0.2 (copie) + variantes.
// node gen2.mjs <config.json> <sortie.html>
// Reprend le protocole apparie de bench/rgpu (pre.js, post.js) et y ajoute : choix du monde de campagne,
// ecart maximal et part de pixels differents, compteur de bandes de couleur, lecture du tampon d'identifiants.
import {readFileSync,writeFileSync} from 'node:fs';
import {build,rep} from './dpatches.mjs';
const METAL=(process.env.METAL_ROOT||process.cwd());
const RGPU=new URL('../rgpu/',import.meta.url).pathname,HERE=new URL('./',import.meta.url).pathname;
const [configPath,outPath]=process.argv.slice(2);
const C=JSON.parse(readFileSync(configPath,'utf8'));
const src=n=>readFileSync(METAL+'/src/'+n,'utf8');
const baseRenderer=readFileSync(HERE+'ferro-renderer-248043a.js','utf8');
const modules=['world.js','destruction.js','music.js','audio.js','soundscape.js','economy.js','brain.js','simulation.js','motion.js','actors.js','effects.js','options.js','game.js'];
const code=[baseRenderer,...modules.map(src)].join('\n;\n');
const version=JSON.parse(readFileSync(METAL+'/package.json','utf8')).version;
const codes=[...new Set(C.variants.map(v=>v.code))];
const variantScripts=codes.filter(n=>n!=='base').map(name=>{
  const c=build(baseRenderer,name).replace('window.FRender={create,foliageTriangles};',`window.__RGPU_CODE[${JSON.stringify(name)}]={create,foliageTriangles};`);
  if(c.toLowerCase().includes('</script'))throw new Error('script tag in variant');
  return `<script>${c}</script>`;
}).join('\n');

let pre=readFileSync(RGPU+'pre.js','utf8'),post=readFileSync(RGPU+'post.js','utf8');
// (1) ecart maximal, part de pixels non identiques, bandes de couleur
pre=rep(pre,"let sum=0,n3=0,n10=0,n25=0,se=0;","let sum=0,n3=0,n10=0,n25=0,se=0,mx=0,nz=0,bx0=1e9,bx1=-1,by0=1e9,by1=-1;const cw=live.find(v=>v.spec.id===id).canvas.width;",'pre-max1');
pre=rep(pre,"if(m>3)n3++;if(m>10)n10++;if(m>25)n25++;}","if(m>3)n3++;if(m>10)n10++;if(m>25)n25++;if(m>mx)mx=m;if(m>0)nz++;if(m>0){const q=i>>2,X=q%cw,Y=(q-X)/cw;if(X<bx0)bx0=X;if(X>bx1)bx1=X;if(Y<by0)by0=Y;if(Y>by1)by1=Y;}}",'pre-max2');
pre=rep(pre,"gt25:n25/px,psnr:mse>0?10*Math.log10(255*255/mse):99});}}","gt25:n25/px,max:mx,nonzero:nz/px,box:[bx0,by0,bx1,by1],psnr:mse>0?10*Math.log10(255*255/mse):99});}\n          for(const id in cmp){(R.bands||(R.bands={}))[id]=(R.bands[id]||[]);R.bands[id].push(window.__DRAW_bands(cmp[id],live.find(v=>v.spec.id===id).canvas.width,live.find(v=>v.spec.id===id).canvas.height));}}",'pre-max3');
pre=rep(pre,"    function readback(v){\n","    function readback(v){\n      if(v.spec.readback==='idbuf')return window.__DRAW_idbuf(v);\n",'pre-idbuf');
post=rep(post,"psnr:avg('psnr'),worstGt10:","psnr:avg('psnr'),max:Math.max(...L.map(x=>x.max)),nonzero:avg('nonzero'),identicalFrames:L.filter(x=>x.max===0).length,boxes:L.map((x,i)=>x.max>0?[i,x.max,x.nonzero,...x.box]:null).filter(Boolean).slice(0,12),worstGt10:",'post-max');
post=rep(post,"      const rb=recs.map(x=>x.readback).filter(Boolean);","      const rb=recs.map(x=>x.readback).filter(Boolean);\n      if(v.spec.readback==='idbuf'){r.idbuf=rb;result.variants[id]=r;continue;}",'post-idbuf');
post=rep(post,"    if(C.dumpFrames)result.perFrame=","    if(R.bands){result.bands={};for(const id in R.bands){const L=R.bands[id];result.bands[id]={n:L.length,edgesPerMPix:+(L.reduce((a,b)=>a+b.edges,0)/L.length).toFixed(1),flatShare:+(L.reduce((a,b)=>a+b.flat,0)/L.length).toFixed(4)};}}\n    result.gpu=window.__DRAW_gpu||null;result.sclog=window.__SCLOG||null;result.cam=window.__CAMLOG||null;\n    if(C.dumpFrames)result.perFrame=",'post-bands');

const extra=`(function(){
  const C=window.__RGPU_CONFIG;
  // Monde de campagne impose (la partie croit etre au monde 0).
  if(C.stage!==undefined){let real=null;Object.defineProperty(window,'FWorld',{configurable:true,get(){return real;},set(v){real=Object.assign({},v,{create:(seed,n,opts)=>v.create(seed,opts&&opts.campaign?C.stage:n,opts)});}});}
  // Bandes de couleur : le long des colonnes et des lignes (1 sur 4), un palier d'au moins 12 pixels identiques
  // suivi d'un saut d'exactement 1 niveau puis d'un autre palier d'au moins 12 pixels = un bord de bande visible.
  window.__DRAW_bands=function(buf,w,h){
    let edges=0,flat=0,total=0;
    const scan=(count,len,at)=>{for(let a=0;a<count;a+=4){let run=1,prevRun=0,prevStep=0,last=buf[at(a,0)+1];for(let b=1;b<len;b++){const v=buf[at(a,b)+1];total++;if(v===last){run++;flat++;}else{const step=v-last;if(prevRun>=12&&Math.abs(prevStep)===1&&run>=12)edges++;prevRun=run;prevStep=step;run=1;last=v;}}}};
    scan(w,h,(x,y)=>(y*w+x)*4);scan(h,w,(y,x)=>(y*w+x)*4);
    return {edges:edges/(w*h/1e6),flat:flat/Math.max(1,total)};
  };
  // Tampon d'identifiants : quelles instances dessinees ont au moins un pixel visible.
  window.__DRAW_idbuf=function(v){
    const gl=v.canvas.__gl,w=v.canvas.width,h=v.canvas.height,buf=new Uint8Array(w*h*4);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);
    const px=new Map(),mats=new Array(20).fill(0);let empty=0,stat=0,dyn=0,ov=0;
    for(let i=0;i<buf.length;i+=4){const b=buf[i+2];if(!b){empty++;continue;}const id=buf[i]|buf[i+1]<<8;px.set(id,(px.get(id)||0)+1);mats[Math.min(19,b-1)]++;if(id>=40000)ov++;else if(id>=20000)dyn++;else stat++;}
    let sSeen=0,dSeen=0,oSeen=0,s4=0,s16=0,s64=0,d4=0,d16=0;
    for(const [id,n] of px){if(id>=40000)oSeen++;else if(id>=20000){dSeen++;if(n<4)d4++;if(n<16)d16++;}else{sSeen++;if(n<4)s4++;if(n<16)s16++;if(n<64)s64++;}}
    const st=v.r.stats,total=w*h;
    return {pixels:total,empty:empty/total,statPx:stat/total,dynPx:dyn/total,ovPx:ov/total,statDrawn:st.staticVisible,statSeen:sSeen,statLt4:s4,statLt16:s16,statLt64:s64,dynSeen:dSeen,dynLt4:d4,dynLt16:d16,ovSeen:oSeen,mats:mats.map(n=>+(n/total).toFixed(4))};
  };
  try{const c=document.createElement('canvas'),g=c.getContext('webgl2');const e=g.getExtension('WEBGL_debug_renderer_info');window.__DRAW_gpu={renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),ext:g.getSupportedExtensions()};}catch(e){}
})();`;

let html=src('index.html');
html=html.replace('/*__STYLE__*/',()=>src('style.css')+`\n#app{width:${C.cssW}px!important;height:${C.cssH}px!important;right:auto!important;bottom:auto!important}`);
html=html.replace('<script>/*__CODE__*/</script>',()=>
  `<script>window.__RGPU_CONFIG=${JSON.stringify(C)};</script>\n<script>${pre}</script>\n<script>${extra}</script>\n${variantScripts}\n<script>${code}</script>\n<script>${post}</script>`);
html=html.replaceAll('__GAME_VERSION__',version);
writeFileSync(outPath,html);
console.log('ecrit',outPath,html.length,'octets ; variantes',codes.join(','));
