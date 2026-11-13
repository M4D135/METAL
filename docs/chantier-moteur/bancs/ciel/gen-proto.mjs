// CIEL : génère la page file:// du prototype de ciel (atmosphère physique, nuages en volume cuits dans un dôme,
// soleil, lune, étoiles, tramage) et son banc apparié contre le ciel actuel de FERRO v0.2 (SKY_FRAG repris tel quel).
// node gen-proto.mjs <renderer-ferro-248043a.js> <sortie.html>
import {readFileSync, writeFileSync} from 'node:fs';
const [rendererPath, out] = process.argv.slice(2);
const R = readFileSync(rendererPath, 'utf8');
const grab = name => { const m = R.match(new RegExp('const ' + name + '=`([\\s\\S]*?)`;')); if (!m) throw new Error('introuvable ' + name); return m[1]; };
const OLD_SKY = grab('SKY_FRAG'), POST_VERT = grab('POST_VERT');

const HEAD = `#version 300 es
precision highp float;
precision highp sampler3D;
const float PI=3.14159265359;
const float RG=6360.,RT=6460.;
const vec3 BR=vec3(5.802e-3,13.558e-3,33.1e-3);
const vec3 BO=vec3(.650e-3,1.881e-3,.085e-3);
uniform vec3 uLightDir;   // source de l'atmosphère : soleil, ou lune la nuit
uniform vec3 uLightRad;   // éclairement hors atmosphère
uniform vec4 uAtmo;       // x : Mie /km ; y : g ; z : échelle Rayleigh ; w : échelle ozone
uniform vec3 uMieTint;    // albédo coloré des aérosols
uniform vec3 uAbsorb;     // absorption des aérosols /km (fumée, cendres)
uniform vec3 uGround;     // albédo du sol lointain
uniform float uAlt;       // altitude de l'œil, km
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 sphere(vec3 o,vec3 d,float r){float b=dot(o,d),c=dot(o,o)-r*r,h=b*b-c;if(h<0.)return vec2(1e9,-1e9);h=sqrt(h);return vec2(-b-h,-b+h);}
vec3 dens(float h){return vec3(exp(-h/8.)*uAtmo.z,exp(-h/1.2),max(0.,1.-abs(h-25.)/15.)*uAtmo.w);}
vec3 ext(vec3 dn){return BR*dn.x+(vec3(uAtmo.x*1.11)+uAbsorb)*dn.y+BO*dn.z;}
vec3 transmit(vec3 p,vec3 s){
  vec2 g=sphere(p,s,RG);if(g.x>0.&&g.x<1e8)return vec3(0.);
  float L=sphere(p,s,RT).y;vec3 od=vec3(0.);
  for(int i=0;i<8;i++){float a=float(i)/8.,b=float(i+1)/8.,t0=L*a*a,t1=L*b*b;od+=ext(dens(length(p+s*(.5*(t0+t1)))-RG))*(t1-t0);}
  return exp(-od);
}
float phaseM(float mu,float g){return 3./(8.*PI)*((1.-g*g)*(1.+mu*mu))/((2.+g*g)*pow(1.+g*g-2.*g*mu,1.5));}
// Diffusion simple intégrée + multidiffusion isotrope approchée (prototype ; FERRO : table de Hillaire 32x32).
void atmosphere(vec3 d,int steps,out vec3 rayl,out vec3 mie){
  vec3 o=vec3(0.,RG+uAlt,0.);
  vec2 top=sphere(o,d,RT),gr=sphere(o,d,RG);
  bool hit=gr.x>0.&&gr.x<1e8;
  float L=hit?gr.x:top.y,mu=dot(d,uLightDir),pr=3./(16.*PI)*(1.+mu*mu);
  vec3 T=vec3(1.);rayl=vec3(0.);mie=vec3(0.);
  for(int i=0;i<40;i++){
    if(i>=steps)break;
    float a=float(i)/float(steps),b=float(i+1)/float(steps),t0=L*a*a,t1=L*b*b,dt=t1-t0;
    vec3 p=o+d*(.5*(t0+t1));
    vec3 dn=dens(length(p)-RG),e=ext(dn),Ts=transmit(p,uLightDir),stepT=exp(-e*dt),integ=(1.-stepT)/max(e,vec3(1e-9));
    vec3 ms=(BR*dn.x+uMieTint*uAtmo.x*dn.y*.5)*.030*sqrt(transmit(p+normalize(p)*9.,uLightDir));
    rayl+=T*(BR*dn.x*Ts*pr+ms)*integ;
    mie+=T*(uAtmo.x*dn.y*Ts)*integ;
    T*=stepT;
  }
  rayl*=uLightRad;mie*=uLightRad;
  if(hit){vec3 pg=o+d*L,n=normalize(pg);vec3 Tg=transmit(pg+n*.002,uLightDir);rayl+=T*uGround/PI*(max(0.,dot(n,uLightDir))*Tg+.10*sqrt(Tg))*uLightRad;}
}
`;
const MAPS = `
const float RMAX=1.1;
vec2 skyUV(vec3 d){
  float e=asin(clamp(d.y,-1.,1.)),v=.5+.5*sign(e)*sqrt(abs(e)/(PI*.5));
  float phi=acos(clamp(dot(normalize(d.xz+vec2(1e-6,0.)),normalize(uLightDir.xz+vec2(1e-6,0.))),-1.,1.));
  return (vec2(phi/PI,v)*(vec2(192.,128.)-1.)+.5)/vec2(192.,128.);
}
vec2 domeUV(vec3 d){return .5+.5*d.xz/((1.+d.y)*RMAX);}
`;
const CLOUDS = `
uniform sampler3D uNoise;
uniform vec4 uCloud;       // couverture, extinction /km, base km, épaisseur km
uniform vec4 uCloudShape;  // km par période du bruit, érosion, type (0 cumulus, 1 stratus), évolution
uniform vec3 uWind;        // décalage du champ (km) x, évolution, z
uniform vec3 uCloudTint;
float density(vec3 p,bool detail){
  float h=length(p)-RG,hn=(h-uCloud.z)/uCloud.w;if(hn<=0.||hn>=1.)return 0.;
  float S=uCloudShape.x;vec3 q=vec3(p.x+uWind.x,h*2.2,p.z+uWind.z);
  float w=textureLod(uNoise,vec3(q.x,uWind.y*S,q.z)/(S*4.7)+vec3(.13,.37,.71),0.).a;
  float cov=clamp(uCloud.x+(w-.5)*.6*(1.-uCloudShape.z*.7),0.,1.);
  float base=textureLod(uNoise,q/S+vec3(0.,uWind.y,0.),0.).r;
  // érosion par la hauteur : base plate, sommets arrondis d'autant plus hauts que le bruit est fort
  float foot=(1.-smoothstep(0.,.10,hn))*.9,cum=foot+hn*hn*.55*(1.3-w),str=foot+smoothstep(.72,1.,hn)*.9;
  float d=clamp((base-(1.-cov)-mix(cum,str,uCloudShape.z))/max(.35*cov,.03),0.,1.);
  if(detail&&d>0.){
    vec3 n=textureLod(uNoise,q/S*3.7+vec3(.31,uWind.y*3.,.77),0.).gba;
    float hf=n.x*.55+n.y*.3+n.z*.15;
    d=clamp(d-uCloudShape.y*(1.-hf)*(1.05-d),0.,1.);
  }
  return d;
}
float hg(float mu,float g){return (1.-g*g)/(4.*PI*pow(1.+g*g-2.*g*mu,1.5));}
// Marche dans la couche : Beer-Lambert, deux lobes de Henyey-Greenstein, multidiffusion approchée, ambiance du ciel.
vec4 clouds(vec3 d,float jitter,vec3 ambTop,vec3 skyAlong,float aerial){
  vec3 o=vec3(0.,RG+uAlt,0.);
  if(d.y<-.02)return vec4(0.,0.,0.,1.);
  vec2 g=sphere(o,d,RG);if(g.x>0.&&g.x<1e8)return vec4(0.,0.,0.,1.);
  float t0=sphere(o,d,RG+uCloud.z).y,t1=min(sphere(o,d,RG+uCloud.z+uCloud.w).y,t0+28.);
  const int N=36;float dt=(t1-t0)/float(N),mu=dot(d,uLightDir);
  float phase=mix(hg(mu,.78),hg(mu,-.22),.32)+hg(mu,.96)*.12;
  vec3 sunC=uLightRad*transmit(o+d*t0,uLightDir)*uCloudTint;
  float T=1.,depth=0.,weight=0.;vec3 L=vec3(0.);
  for(int i=0;i<N;i++){
    float t=t0+dt*(float(i)+jitter);vec3 p=o+d*t;float dn=density(p,true);
    if(dn>.002){
      float od=0.,ls=.07;vec3 lp=p;
      for(int j=0;j<5;j++){lp+=uLightDir*ls;od+=density(lp,false)*ls;ls*=1.8;}
      float e=dn*uCloud.y,hn=clamp((length(p)-RG-uCloud.z)/uCloud.w,0.,1.);
      float tau=od*uCloud.y,beer=exp(-tau),ms=.34*(.72*exp(-tau*.13)+.28*exp(-tau*.025));
      vec3 S=sunC*(beer*phase+ms)+ambTop*uCloudTint*(.25+.75*hn)*(.5+.5*exp(-tau*.25));
      float stepT=exp(-e*dt);
      L+=T*S*(1.-stepT);depth+=t*T*(1.-stepT);weight+=T*(1.-stepT);T*=stepT;
      if(T<.012){T=0.;break;}
    }
  }
  float dist=weight>0.?depth/weight:t0,ap=exp(-dist*aerial);
  L=mix(skyAlong*(1.-T),L,ap);
  return vec4(L,T);
}
`;
const SHADE = `
uniform vec3 uSunDir;      // vrai soleil (disque, phase de la lune)
uniform vec3 uMoonDir;
uniform vec4 uSunDisc;     // rgb : luminance du disque ; a : rayon angulaire (rad)
uniform vec4 uMoonDisc;    // rgb : luminance ; a : rayon angulaire
uniform vec4 uView;        // exposition, intensité des étoiles, angle d'un pixel (rad), tramage
uniform vec4 uNight;       // rgb : lueur nocturne ; a : sinus de l'abaissement de l'horizon
uniform float uTone;
vec3 stars(vec3 d){
  vec3 a=abs(d);vec2 o=d.xz/(a.x+a.y+a.z);if(d.y<0.)o=(1.-abs(o.yx))*sign(o);
  vec3 acc=vec3(0.);
  for(int layer=0;layer<2;layer++){
    float N=layer==0?90.:260.,k=float(layer);
    vec2 gq=(o*.5+.5)*N,c=floor(gq),r=vec2(hash12(c+17.3*k+1.7),hash12(c.yx+91.7+k*3.1));
    float m=hash12(c*1.37+5.1+k);
    float lum=pow(m,layer==0?60.:40.)*(layer==0?14.:4.);
    float dist=length(gq-(c+.2+.6*r))/N*2.,size=max(uView.z*1.25,.0011*(1.+m*.8));
    float fall=max(0.,1.-dist/size);
    acc+=mix(vec3(1.,.80,.58),vec3(.70,.82,1.),hash12(c+3.3))*lum*fall*fall;
  }
  return acc;
}
vec3 shade(vec3 d,vec3 rayl,vec3 mie,vec4 cloud){
  float mu=dot(d,uLightDir);
  vec3 col=rayl+mie*uMieTint*phaseM(mu,uAtmo.y)+uNight.rgb;
  float above=smoothstep(uNight.a-.0015,uNight.a+.0035,d.y);
  float airmass=exp(-.10/(max(d.y-uNight.a,0.)+.035));
  vec3 cel=vec3(0.);
  // disque solaire : assombrissement au bord par canal, bord anticrénelé, couronne
  float r=sqrt(max(0.,2.*(1.-dot(d,uSunDir))))/uSunDisc.a;
  if(r<6.){
    float z=sqrt(max(0.,1.-r*r));
    vec3 limb=1.-vec3(.50,.62,.78)*(1.-z);
    cel+=uSunDisc.rgb*(limb*smoothstep(1.,1.-1.5*uView.z/uSunDisc.a,r)+.035*exp(-r*1.7)+.004/(r*r+.25));
  }
  if(uView.y>0.){
    float band=exp(-pow(dot(d,normalize(vec3(.35,.48,.80)))/.24,2.));
    float dust=textureLod(uNoise,d*1.3+.21,0.).a;
    cel+=(stars(d)*(1.+band*1.5)+vec3(.55,.62,.80)*band*smoothstep(.30,.72,dust)*.016)*uView.y*airmass;
    float rm=sqrt(max(0.,2.*(1.-dot(d,uMoonDir))))/uMoonDisc.a;
    if(rm<8.){
      vec3 mx=normalize(cross(vec3(0.,1.,0.),uMoonDir)),my=cross(uMoonDir,mx);
      vec2 q=vec2(dot(d,mx),dot(d,my))/uMoonDisc.a;float z=sqrt(max(0.,1.-dot(q,q)));
      vec3 n=q.x*mx+q.y*my-z*uMoonDir;
      float lit=pow(max(0.,dot(n,uSunDir)),.65),maria=textureLod(uNoise,n*.55+.4,0.).a,crater=textureLod(uNoise,n*2.3+.1,0.).g;
      float albedo=mix(.30,1.,smoothstep(.36,.60,maria))*(.84+.32*crater);
      cel+=uMoonDisc.rgb*(albedo*(lit+.012)*smoothstep(1.,1.-1.5*uView.z/uMoonDisc.a,rm)+.010*exp(-rm*1.1))*airmass;
    }
  }
  col+=cel*above;
  col=col*cloud.a+cloud.rgb;
  col*=uView.x;
  if(uTone>.5)col=clamp(col*(2.51*col+.03)/(col*(2.43*col+.59)+.14),0.,1.);else col=col/(col+vec3(.76));
  col=pow(max(col,vec3(0.)),vec3(.4545));
  col+=(hash12(gl_FragCoord.xy)+hash12(gl_FragCoord.xy+vec2(113.5,37.25))-1.)*uView.w/255.;
  return col;
}
`;
const RAY = `
in vec2 vUV;
uniform vec3 uRight,uUp,uForward;
uniform vec2 uFov;
vec3 viewRay(){vec2 uv=vUV*2.-1.;return normalize(uForward+uRight*uv.x*uFov.x+uUp*uv.y*uFov.y);}
`;
const shaders = {
  vert: POST_VERT,
  old: OLD_SKY,
  flat: `#version 300 es
precision highp float;in vec2 vUV;out vec4 fragColor;void main(){fragColor=vec4(vUV,.5,1.);}`,
  // Résolution du dôme : filtre en tente 3x3 (4 lectures bilinéaires) qui efface le grain de la marche décalée.
  blur: `#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uSrc;uniform float uTexel;out vec4 fragColor;
void main(){vec2 o=vec2(uTexel*.5);fragColor=.25*(texture(uSrc,vUV+o)+texture(uSrc,vUV-o)+texture(uSrc,vUV+vec2(o.x,-o.y))+texture(uSrc,vUV+vec2(-o.x,o.y)));}`,
  // Bruit 3D périodique : R Perlin-Worley, G et B Worley plus fins, A Perlin FBM. Généré par tranches.
  noise: `#version 300 es
precision highp float;in vec2 vUV;uniform float uZ;out vec4 fragColor;
vec3 hash33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float hash13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float worley(vec3 p,float period){p*=period;vec3 i=floor(p),f=fract(p);float d=1.;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=vec3(x,y,z),r=g+hash33(mod(i+g,period))-f;d=min(d,dot(r,r));}
  return 1.-min(1.,sqrt(d));}
float vnoise(vec3 p,float period){p*=period;vec3 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);
  float a=hash13(mod(i,period)),b=hash13(mod(i+vec3(1,0,0),period)),c=hash13(mod(i+vec3(0,1,0),period)),d=hash13(mod(i+vec3(1,1,0),period));
  float e=hash13(mod(i+vec3(0,0,1),period)),g=hash13(mod(i+vec3(1,0,1),period)),h=hash13(mod(i+vec3(0,1,1),period)),k=hash13(mod(i+vec3(1,1,1),period));
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,g,f.x),mix(h,k,f.x),f.y),f.z);}
float perlin(vec3 p,float f0){return vnoise(p,f0)*.5+vnoise(p,f0*2.)*.25+vnoise(p,f0*4.)*.125+vnoise(p,f0*8.)*.0625+vnoise(p,f0*16.)*.0625;}
void main(){
  vec3 p=vec3(vUV,uZ);
  float pf=perlin(p,4.),w1=worley(p,4.)*.625+worley(p,8.)*.25+worley(p,16.)*.125;
  float w2=worley(p,8.)*.625+worley(p,16.)*.25+worley(p,32.)*.125,w3=worley(p,16.)*.75+worley(p,32.)*.25;
  float pw=clamp((pf-(1.-w1)*.62)/(1.-(1.-w1)*.62)*1.25,0.,1.);
  fragColor=vec4(pw,w2,w3,perlin(p,3.));
}`,
  sky: HEAD + `in vec2 vUV;layout(location=0) out vec4 oRayl;layout(location=1) out vec4 oMie;
void main(){
  vec2 uv=(gl_FragCoord.xy-.5)/(vec2(192.,128.)-1.);
  float s=uv.y*2.-1.,e=sign(s)*s*s*PI*.5,phi=uv.x*PI;
  vec2 b=normalize(uLightDir.xz+vec2(1e-6,0.)),h=vec2(b.x*cos(phi)-b.y*sin(phi),b.x*sin(phi)+b.y*cos(phi));
  vec3 d=vec3(h.x*cos(e),sin(e),h.y*cos(e)),rayl,mie;
  atmosphere(d,32,rayl,mie);oRayl=vec4(rayl,1.);oMie=vec4(mie,1.);
}`,
  cloud: HEAD + MAPS + CLOUDS + `in vec2 vUV;uniform sampler2D uSkyR,uSkyM;uniform float uAerial;out vec4 fragColor;
void main(){
  vec2 q=(vUV*2.-1.)*RMAX;float r2=dot(q,q),y=(1.-r2)/(1.+r2);vec3 d=vec3(q.x*(1.+y),y,q.y*(1.+y));
  vec3 up=normalize(vec3(uLightDir.x*.15,1.,uLightDir.z*.15));
  vec3 ambTop=(texture(uSkyR,skyUV(up)).rgb+texture(uSkyR,skyUV(normalize(vec3(-uLightDir.x,.6,-uLightDir.z)))).rgb)*1.5;
  vec2 suv=skyUV(d);vec3 skyAlong=texture(uSkyR,suv).rgb+texture(uSkyM,suv).rgb*uMieTint*phaseM(dot(d,uLightDir),uAtmo.y);
  fragColor=clouds(d,hash12(gl_FragCoord.xy),ambTop,skyAlong,uAerial);
}`,
  comp: HEAD + MAPS + RAY + `uniform sampler3D uNoise;uniform sampler2D uSkyR,uSkyM,uCloudA,uCloudB;
uniform vec4 uBlend;   // x : fondu A vers B ; y,z : glissement du vent (unités de hauteur de couche) ; w : inutilisé
` + SHADE + `out vec4 fragColor;
void main(){
  vec3 d=viewRay();vec2 suv=skyUV(d);
  vec3 rayl=texture(uSkyR,suv).rgb,mie=texture(uSkyM,suv).rgb;
  // reprojection du dôme : le vent translate la couche entre deux cuissons
  vec3 dw=d;if(d.y>.01){vec2 P=d.xz/d.y-uBlend.yz;dw=normalize(vec3(P.x,1.,P.y));}
  vec2 cuv=domeUV(dw);
  vec4 cloud=mix(texture(uCloudA,cuv),texture(uCloudB,cuv),uBlend.x);
  float keep=smoothstep(-.02,.01,d.y);cloud=vec4(cloud.rgb*keep,mix(1.,cloud.a,keep));
  fragColor=vec4(shade(d,rayl,mie,cloud),1.);
}`,
  direct: HEAD + MAPS + RAY + CLOUDS + `uniform sampler2D uSkyR,uSkyM;uniform float uAerial;uniform int uParts;
` + SHADE + `out vec4 fragColor;
void main(){
  vec3 d=viewRay(),rayl,mie;atmosphere(d,16,rayl,mie);
  vec4 cloud=vec4(0.,0.,0.,1.);
  if(uParts>0){
    vec3 up=normalize(vec3(uLightDir.x*.15,1.,uLightDir.z*.15)),r1,m1,r2,m2;
    atmosphere(up,8,r1,m1);atmosphere(normalize(vec3(-uLightDir.x,.6,-uLightDir.z)),8,r2,m2);
    cloud=clouds(d,hash12(gl_FragCoord.xy),(r1+r2)*1.5,rayl+mie*uMieTint*phaseM(dot(d,uLightDir),uAtmo.y),uAerial);
  }
  fragColor=vec4(shade(d,rayl,mie,cloud),1.);
}`
};

const page = `<!doctype html><meta charset="utf-8"><title>prototype ciel</title>
<style>html,body{margin:0;background:#000}canvas{display:block}</style>
<canvas id="c" width="1600" height="900"></canvas><pre id="out"></pre>
<script>
const SH=${JSON.stringify(shaders)};
${readFileSync(new URL('./proto-main.js', import.meta.url), 'utf8')}
</script>`;
writeFileSync(out, page);
console.log('wrote', out, page.length, 'octets ; shaders', Object.entries(shaders).map(([k, v]) => k + ':' + v.length).join(' '));
