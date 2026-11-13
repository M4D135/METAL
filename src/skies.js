/* FERRO — FSky : ciel procédural en une seule passe plein écran, sans aucune texture. */
(function(G){
'use strict';
// --- Sources GLSL (référence validée) ---
const VERT=`#version 300 es
precision highp float;
out vec2 vUV;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUV=p;gl_Position=vec4(p*2.-1.,1.,1.);}
`;
const FOG_GLSL=`uniform vec3 uFskyRay[30];
uniform vec3 uFskyMie[30];
uniform vec2 uFskyRefH;
uniform vec4 uFskyRef;
uniform vec4 uFskyGlow;
float fskyPhase(float mu,float g){float g2=g*g,k=1.+g2-2.*g*mu;return .1193662*(1.-g2)*(1.+mu*mu)/((2.+g2)*k*sqrt(k));}
vec3 fskyAtmos(vec3 d){
  float y=clamp(d.y,0.,1.),r=sqrt(y)*5.,l=length(d.xz),c=l>1e-5?clamp(dot(d.xz,uFskyRefH)/l,-1.,1.):1.,k=(1.-c)*2.;
  int r0=min(int(r),4),k0=min(int(k),3),i=r0*5+k0;float fr=r-float(r0),fk=k-float(k0);
  vec3 ray=mix(mix(uFskyRay[i],uFskyRay[i+1],fk),mix(uFskyRay[i+5],uFskyRay[i+6],fk),fr);
  vec3 mie=mix(mix(uFskyMie[i],uFskyMie[i+1],fk),mix(uFskyMie[i+5],uFskyMie[i+6],fk),fr);
  return ray+mie*fskyPhase(dot(d,uFskyRef.xyz),uFskyRef.w)+uFskyGlow.rgb*exp(-y*uFskyGlow.a);
}
vec3 fskyFog(vec3 d){vec2 h=d.xz;float l=length(h);h=l>1e-5?h/l:uFskyRefH;return fskyAtmos(vec3(h.x,0.,h.y));}
`;
const FRAG='#version 300 es\nprecision highp float;\nprecision highp int;\n'+FOG_GLSL+`in vec2 vUV;
uniform vec3 uFskyRight;
uniform vec3 uFskyUp;
uniform vec3 uFskyForward;
uniform vec2 uFskyFov;
uniform float uFskyTime;
uniform float uFskyPixel;
uniform vec4 uFskyPost;
uniform vec3 uFskySun;
uniform vec4 uFskySunDisc;
uniform vec3 uFskyMoon;
uniform vec4 uFskyMoonDisc;
uniform vec3 uFskyMoonRight;
uniform vec3 uFskyMoonUp;
uniform vec4 uFskyCloud;
uniform vec4 uFskyCloud2;
uniform vec3 uFskyCloudSun;
uniform vec3 uFskyCloudAmb;
uniform vec4 uFskyWind;
uniform vec4 uFskySeed;
uniform vec4 uFskyStars;
uniform vec4 uFskyHorizon;
uniform vec4 uFskyLayers;
out vec4 fragColor;
float fskyHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float fskyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(fskyHash(i),fskyHash(i+vec2(1.,0.)),f.x),mix(fskyHash(i+vec2(0.,1.)),fskyHash(i+vec2(1.,1.)),f.x),f.y);}
float fskyFbm(vec2 p,int n){float s=0.,a=.5,w=0.;for(int i=0;i<4;i++){if(i>=n)break;s+=a*fskyNoise(p);w+=a;p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(17.3,9.1);a*=.5;}return s/w;}
uvec3 fskyPcg(uvec3 v){v=v*1664525u+1013904223u;v.x+=v.y*v.z;v.y+=v.z*v.x;v.z+=v.x*v.y;v^=v>>16u;v.x+=v.y*v.z;v.y+=v.z*v.x;v.z+=v.x*v.y;return v;}
float fskyHG(float mu,float g){float g2=g*g,k=1.+g2-2.*g*mu;return .0795775*(1.-g2)/(k*sqrt(k));}
void main(){
  vec2 uv=vUV*2.-1.;
  vec3 d=normalize(uFskyForward+uFskyRight*uv.x*uFskyFov.x+uFskyUp*uv.y*uFskyFov.y);
  vec3 col;float mask=0.;
  if(d.y<=0.)col=fskyFog(d);
  else{
    vec3 sky=fskyAtmos(d);col=sky;
    vec3 cc=vec3(0.);float ca=0.;
    if(uFskyLayers.x>0.&&(uFskyCloud.x>0.||uFskyCloud2.z>0.)){
      vec2 p=d.xz/(d.y+uFskyCloud2.w)*uFskyCloud.w;
      p=vec2(dot(p,uFskyWind.zw),dot(p,vec2(-uFskyWind.w,uFskyWind.z)));
      p.x=p.x/uFskyCloud2.x+uFskyWind.x*uFskyTime;p+=uFskySeed.xy;
      float mu=dot(d,uFskyRef.xyz),fade=smoothstep(0.,.08,d.y);
      if(uFskyCloud.x>0.){
        float n=fskyFbm(p,4),th=1.-uFskyCloud.x;
        ca=smoothstep(th-uFskyCloud.y,th+uFskyCloud.y,n)*uFskyCloud.z*fade*uFskyLayers.x;
        if(ca>.002){
          float thick=clamp((n-th)/max(1.-th,.05),0.,1.);
          vec2 sd=vec2(dot(uFskyRefH,uFskyWind.zw),dot(uFskyRefH,vec2(-uFskyWind.w,uFskyWind.z)));
          float ns=fskyFbm(p+sd*.35,2),lit=clamp(.62+(n-ns)*2.6,.12,1.);
          cc=uFskyCloudAmb*(1.-uFskyCloud2.y*thick)+uFskyCloudSun*lit*(.35+2.2*fskyHG(mu,.6));
          cc=mix(cc,sky,(1.-smoothstep(0.,.35,d.y))*.55);
        }
      }
      if(uFskyCloud2.z>0.){
        float v=fskyFbm(p*vec2(.6,1.5)+vec2(31.,7.),2),va=smoothstep(.3,.9,v)*uFskyCloud2.z*.5*fade*uFskyLayers.x;
        vec3 vc=mix(uFskyCloudAmb,uFskyCloudSun*(.5+2.*fskyHG(mu,.7)),.6);
        cc=mix(vc,cc,ca);ca=ca+va*(1.-ca);
      }
    }
    if(uFskyLayers.y>0.){
      float cs=cos(uFskySeed.z),sn=sin(uFskySeed.z);vec3 q=vec3(cs*d.x-sn*d.z,d.y,sn*d.x+cs*d.z);
      if(uFskyStars.x>0.){
        vec3 a=abs(q);vec2 f;float face;
        if(a.x>=a.y&&a.x>=a.z){f=q.yz/a.x;face=q.x>0.?0.:1.;}else if(a.y>=a.z){f=q.xz/a.y;face=q.y>0.?2.:3.;}else{f=q.xy/a.z;face=q.z>0.?4.:5.;}
        vec2 g=(f*.5+.5)*160.,cell=floor(g);
        uvec3 h=fskyPcg(uvec3(uvec2(cell),uint(face)+uint(uFskySeed.w)*6u));
        vec3 rnd=vec3(h>>8u)*(1./16777216.);
        if(rnd.x<uFskyStars.y){
          vec2 cpos=cell+.15+.7*rnd.yz;float px=uFskyPixel*80.*(1.+dot(f,f)),rad=max(px*.75,.04);
          float m=rnd.x/uFskyStars.y,b=.12+2.6*pow(1.-m,7.);
          float s=exp(-dot(g-cpos,g-cpos)/(rad*rad))*b*min(1.,(.08*.08)/(rad*rad));
          col+=mix(vec3(1.,.82,.66),vec3(.72,.84,1.),rnd.z)*s*uFskyStars.x*smoothstep(0.,.25,d.y);
        }
      }
      if(uFskyStars.z>0.){
        float bt=dot(q,vec3(.35,.48,.80))/.22,band=exp(-bt*bt);
        col+=vec3(.55,.62,.8)*band*(.35+.65*fskyFbm(q.xz*9.+q.y*3.,3))*uFskyStars.z*.07*smoothstep(0.,.3,d.y);
      }
      if(uFskyMoonDisc.a>0.){
        vec3 dm=d-uFskyMoon;float t=length(dm)/uFskyMoonDisc.a;
        if(t<1.){
          vec2 q2=vec2(dot(dm,uFskyMoonRight),dot(dm,uFskyMoonUp))/uFskyMoonDisc.a;float z=sqrt(max(0.,1.-dot(q2,q2)));
          vec3 n=q2.x*uFskyMoonRight+q2.y*uFskyMoonUp-z*uFskyMoon;
          float lit=smoothstep(-.06,.12,dot(n,uFskySun)),maria=fskyFbm(q2*2.2+7.,3),alb=mix(.6,1.,smoothstep(.38,.62,maria));
          float w=min(.5,1.5*uFskyPixel/uFskyMoonDisc.a);
          col+=uFskyMoonDisc.rgb*alb*(lit+.03)*(1.-smoothstep(1.-w,1.,t));
        }
        col+=uFskyMoonDisc.rgb*.012*exp(-max(t-1.,0.)*.9);
      }
    }
    if(uFskyLayers.z>0.&&uFskySunDisc.a>0.){
      float t=length(d-uFskySun)/uFskySunDisc.a;
      if(t<1.){float z=sqrt(max(0.,1.-t*t)),w=min(.5,1.5*uFskyPixel/uFskySunDisc.a),e=1.-smoothstep(1.-w,1.,t);
        col+=uFskySunDisc.rgb*(1.-vec3(.5,.62,.78)*(1.-z))*e*smoothstep(0.,.01,d.y);mask=e;}
    }
    col=mix(col,cc,ca);mask*=1.-ca;
    if(uFskyLayers.w>0.&&d.y<uFskyHorizon.x){
      vec2 hz=normalize(d.xz)+uFskySeed.z;
      float far=uFskyHorizon.x*(.2+.8*(fskyNoise(hz*5.)*.75+fskyNoise(hz*13.+3.)*.25));
      float near=uFskyHorizon.y*(fskyNoise(hz*7.+11.)*.8+fskyNoise(hz*19.+5.)*.2);
      float aa=uFskyPixel*1.5;vec3 fog=fskyFog(d);
      col=mix(col,mix(fog,sky,uFskyHorizon.z),1.-smoothstep(far-aa,far+aa,d.y));
      col=mix(col,fog*uFskyHorizon.w,1.-smoothstep(near-aa,near+aa,d.y));
      mask*=smoothstep(far-aa,far+aa,d.y);
    }
  }
  col=col/(col+.76);col=pow(max(col,vec3(0.)),vec3(.4545));
  float v=pow(max(0.,16.*vUV.x*vUV.y*(1.-vUV.x)*(1.-vUV.y)),.13);col*=mix(uFskyPost.x,1.,v);
  col+=(fskyHash(gl_FragCoord.xy)+fskyHash(gl_FragCoord.xy+vec2(113.5,37.25))-1.)/255.*uFskyPost.y;
  fragColor=vec4(col,mix(1.,mask,uFskyPost.z));
}
`;
// --- Uniformes : nom -> [type, nombre, genre] ---
const UNIFORMS={uFskyRay:['vec3',30,'monde'],uFskyMie:['vec3',30,'monde'],uFskyRefH:['vec2',1,'monde'],uFskyRef:['vec4',1,'monde'],
 uFskyGlow:['vec4',1,'monde'],uFskySun:['vec3',1,'monde'],uFskySunDisc:['vec4',1,'monde'],uFskyMoon:['vec3',1,'monde'],
 uFskyMoonDisc:['vec4',1,'monde'],uFskyMoonRight:['vec3',1,'monde'],uFskyMoonUp:['vec3',1,'monde'],uFskyCloud:['vec4',1,'monde'],
 uFskyCloud2:['vec4',1,'monde'],uFskyCloudSun:['vec3',1,'monde'],uFskyCloudAmb:['vec3',1,'monde'],uFskyWind:['vec4',1,'monde'],
 uFskySeed:['vec4',1,'monde'],uFskyStars:['vec4',1,'monde'],uFskyHorizon:['vec4',1,'monde'],
 uFskyRight:['vec3',1,'image'],uFskyUp:['vec3',1,'image'],uFskyForward:['vec3',1,'image'],uFskyFov:['vec2',1,'image'],
 uFskyTime:['float',1,'image'],uFskyPixel:['float',1,'image'],uFskyPost:['vec4',1,'image'],uFskyLayers:['vec4',1,'image']};
// --- Préréglage par défaut, normalisation, validation ---
const defaults={sun:{el:30,az:0,size:.7,bright:8},moon:{el:-30,az:180,size:.6,bright:3},turbidity:2,absorb:.1,tint:[1,1,1],g:.8,rayleigh:1,ozone:1,multi:.25,key:.25,grade:[1,1,1],floor:[0,0,0],
  clouds:{cover:.35,soft:.18,opacity:.95,scale:1,stretch:1,dark:.5,veil:0,curve:.15,tint:[1,1,1]},wind:{dir:30,speed:1},stars:0,milky:0,glow:{color:[1,.4,.1],strength:0,width:6},horizon:{far:.07,near:.035,mix:.5,dark:1},seed:7};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),isObj=v=>Object.prototype.toString.call(v)==='[object Object]';
const dup=v=>Array.isArray(v)?v.slice():v,txt=v=>{try{return String(v);}catch(_){return typeof v;}};
// Fusion clé à clé avec d : une valeur fournie reste telle quelle, même invalide, pour que validate la juge ;
// tableaux copiés, clés inconnues recopiées, undefined vaut absent.
function merge(d,s){const o={};
 for(const k of Object.keys(d)){const x=d[k],v=s[k];o[k]=isObj(x)&&(v===undefined||isObj(v))?merge(x,v||{}):dup(v===undefined?x:v);}
 for(const k of Object.keys(s))if(!own(d,k)&&s[k]!==undefined)o[k]=dup(s[k]);
 return o;}
function normalize(p){return merge(defaults,isObj(p)?p:{});}
// Bornes inclusives : [min,max] pour un nombre, [min,max,3] pour un triplet ; un objet décrit un sous-objet.
const BORNES={sun:{el:[-90,90],az:[-360,360],size:[.1,5],bright:[0,50]},moon:{el:[-90,90],az:[-360,360],size:[.1,6],bright:[0,20]},
 turbidity:[.5,15],absorb:[0,.95],tint:[0,2,3],g:[0,.95],rayleigh:[.1,4],ozone:[0,4],multi:[0,1],key:[.005,.6],grade:[.2,2.5,3],floor:[0,.1,3],
 clouds:{cover:[0,1],soft:[.01,.6],opacity:[0,1],scale:[.1,5],stretch:[1,8],dark:[0,1],veil:[0,1],curve:[.02,.6],tint:[0,2,3]},
 wind:{dir:[-360,360],speed:[0,10]},stars:[0,1],milky:[0,1],glow:{color:[0,2,3],strength:[0,1],width:[1,45]},
 horizon:{far:[0,.2],near:[0,.15],mix:[0,1],dark:[0,2]},seed:[0,65535]};
function validate(p){
 if(!isObj(p))return['preset: objet attendu'];
 const q=normalize(p),e=[],h=q.horizon,hors=(n,v,b)=>{if(v<b[0]||v>b[1])e.push(n+': hors bornes ['+b[0]+','+b[1]+'] ('+v+')');};
 // Un sous-objet qui n'en est pas un est signalé une fois, sans descendre dedans.
 const walk=(o,b,pre)=>{for(const k of Object.keys(o))if(!own(b,k)&&(pre||k!=='id'&&k!=='name'))e.push(pre+k+': clé inconnue');
  for(const k of Object.keys(b)){const v=o[k],x=b[k],n=pre+k;
   if(!Array.isArray(x)){if(isObj(v))walk(v,x,n+'.');else e.push(n+': objet attendu ('+txt(v)+')');}
   else if(!x[2]){if(Number.isFinite(v))hors(n,v,x);else e.push(n+': nombre fini attendu ('+txt(v)+')');}
   else if(Array.isArray(v)&&v.length===3&&[0,1,2].every(i=>Number.isFinite(v[i])))v.forEach((c,i)=>hors(n+'['+i+']',c,x));
   else e.push(n+': 3 nombres finis attendus ('+txt(v)+')');}};
 walk(q,BORNES,'');
 if(Number.isFinite(q.seed)&&!Number.isInteger(q.seed))e.push('seed: entier attendu ('+q.seed+')');
 if(own(q,'id')&&!(typeof q.id==='string'&&/^[a-z0-9]+(-[a-z0-9]+)*$/.test(q.id)))e.push('id: chaîne « mot[-mot] » attendue ('+txt(q.id)+')');
 if(own(q,'name')&&!(typeof q.name==='string'&&q.name.length>=1&&q.name.length<=40))e.push('name: chaîne de 1 à 40 caractères attendue ('+txt(q.name)+')');
 if(isObj(h)&&Number.isFinite(h.near)&&Number.isFinite(h.far)&&h.near>h.far)e.push('horizon: near ('+h.near+') doit rester ≤ far ('+h.far+')');
 return e;
}
// --- Physique de diffusion et résolution ---
const RAD=Math.PI/180;
const direction=(el,az)=>{const e=el*RAD,a=az*RAD;return[Math.cos(e)*Math.sin(a),Math.sin(e),-Math.cos(e)*Math.cos(a)];};
// Bouchons provisoires : l'API a déjà sa forme ; résolution, miroir JS et pose des uniformes viennent ensuite.
const bouchon=n=>function(){throw new Error('FSky.'+n+': non implémenté');};
const resolve=bouchon('resolve');
// --- Miroir JS du shader, encodage, signature ---
const radianceAt=bouchon('radianceAt'),fogAt=bouchon('fogAt'),signature=bouchon('signature');
const encode=(rgb,vignette=1)=>[0,1,2].map(k=>{const x=Math.max(0,rgb[k]);return Math.round(255*Math.min(1,Math.max(0,Math.pow(x/(x+.76),.4545)*vignette)));});
// --- Caméra, uniformes d'image, pose des uniformes ---
function view(yaw,pitch,fovY,aspect){
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),t=Math.tan(fovY/2);
 return{right:[cy,0,sy],up:[-sy*sp,cp,cy*sp],forward:[sy*cp,sp,-cy*cp],fov:[aspect*t,t]};
}
const frameUniforms=bouchon('frameUniforms'),bind=bouchon('bind');
// --- Données METAL (CIEL-13) ---
const presets=[];
G.FSky={VERSION:1,VERT,FOG_GLSL,FRAG,UNIFORMS,defaults,presets,normalize,validate,direction,view,resolve,frameUniforms,bind,radianceAt,fogAt,encode,signature};
})(typeof window!=='undefined'?window:globalThis);
