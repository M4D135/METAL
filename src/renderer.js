/* FERRO — original WebGL2 renderer. All surfaces and meshes are mathematical. */
(function () {
  'use strict';

  const VERT = `#version 300 es
  precision highp float;
  layout(location=0) in vec3 aPosition;
  layout(location=1) in vec3 aNormal;
  layout(location=2) in vec4 iPosition;
  layout(location=3) in vec4 iScale;
  layout(location=4) in vec4 iRotation;
  layout(location=5) in vec4 iColor;
  uniform mat4 uViewProjection;
  uniform vec2 uWindTime;
  uniform vec3 uCullCentre;
  uniform vec3 uCullRange;
  out vec3 vWorld;
  out vec3 vNormal;
  out vec3 vSurface;
  out vec3 vLocal;
  out vec3 vSurfaceNormal;
  flat out float vMaterial;
  flat out float vEmission;
  flat out float vOverlay;
  flat out float vOutdoor;
  flat out float vObject;
  flat out vec4 vColor;
  void main() {
    vec3 c=cos(iRotation.xyz), s=sin(iRotation.xyz);
    mat3 rx=mat3(1.,0.,0., 0.,c.x,s.x, 0.,-s.x,c.x);
    mat3 ry=mat3(c.y,0.,-s.y, 0.,1.,0., s.y,0.,c.y);
    mat3 rz=mat3(c.z,s.z,0., -s.z,c.z,0., 0.,0.,1.);
    mat3 rotation=rz*ry*rx;
    vWorld=rotation*(aPosition*iScale.xyz)+iPosition.xyz;
    if(iPosition.w>10.5&&iPosition.w<11.5){
      float phase=uWindTime.y*.85+iPosition.x*.37+iPosition.z*.21;
      float bend=(aPosition.y+.5)*uWindTime.x*.055;
      vWorld.x+=sin(phase)*bend;vWorld.z+=cos(phase*.73)*bend*.6;
    }
    vNormal=normalize(rotation*(aNormal/max(abs(iScale.xyz),vec3(.0001))));
    vMaterial=iPosition.w;
    vEmission=iScale.w;
    vOverlay=mod(iRotation.w,2.);
    vOutdoor=mod(floor(iRotation.w*.5),2.);
    vObject=mod(floor(iRotation.w*.25),2.);
    vSurface=vObject>.5?aPosition*iScale.xyz:vWorld;
    vLocal=aPosition;
    vSurfaceNormal=vObject>.5?normalize(aNormal/max(abs(iScale.xyz),vec3(.0001))):vNormal;
    vColor=iColor;
    vec4 clip=uViewProjection*vec4(vWorld,1.);
    int niveau=int(floor(iRotation.w*.125));
    if(niveau>=1){
      float range=niveau==1?uCullRange.x:(niveau==2?uCullRange.y:uCullRange.z);
      if(distance(uCullCentre,iPosition.xyz)>range+.5*length(iScale.xyz))clip=vec4(2.,2.,2.,1.);
    }
    gl_Position=clip;
  }`;

  const FRAG = `#version 300 es
  precision highp float;
  in vec3 vWorld;
  in vec3 vNormal;
  in vec3 vSurface;
  in vec3 vLocal;
  in vec3 vSurfaceNormal;
  flat in float vMaterial;
  flat in float vEmission;
  flat in float vOverlay;
  flat in float vOutdoor;
  flat in float vObject;
  flat in vec4 vColor;
  uniform vec3 uEye;
  uniform vec3 uForward;
  uniform vec3 uLightPosition[12];
  uniform vec3 uLightColor[12];
  uniform float uLightRange[12];
  uniform int uLightCount;
  uniform vec2 uResolution;
  uniform vec4 uEffects;
  uniform vec2 uWindTime;
  // Explicit sampler precision keeps 24-bit depth from being quantized into bands.
  uniform highp sampler2D uShadowMap;
  uniform mat4 uShadowMatrix[3];
  uniform vec4 uShadowSettings;
  uniform vec3 uTorchPosition;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  uniform vec3 uFogColor;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyBottom;
  uniform vec2 uEnvironment;
  out vec4 fragColor;
  float hash(vec2 p) {
    vec3 p3=fract(vec3(p.xyx)*.1031);
    p3+=dot(p3,p3.yzx+33.33);
    return fract((p3.x+p3.y)*p3.z);
  }
  float noise(vec2 p) {
    vec2 a=floor(p), b=fract(p); b=b*b*(3.-2.*b);
    return mix(mix(hash(a),hash(a+vec2(1,0)),b.x),
      mix(hash(a+vec2(0,1)),hash(a+vec2(1,1)),b.x),b.y);
  }
  float grid(vec2 uv,float width) {
    vec2 distanceToEdge=min(fract(uv),1.-fract(uv));
    vec2 aa=max(fwidth(uv),vec2(.0001));
    vec2 line=1.-smoothstep(vec2(width),vec2(width)+aa,distanceToEdge);
    return max(line.x,line.y);
  }
  vec3 reliefNormal(vec3 n,float height) {
    vec3 dpdx=dFdx(vWorld), dpdy=dFdy(vWorld);
    vec3 r1=cross(dpdy,n),r2=cross(n,dpdx);
    float determinant=dot(dpdx,r1);
    vec3 gradient=sign(determinant)*(dFdx(height)*r1+dFdy(height)*r2);
    float scale=max(abs(determinant),.000001);
    gradient*=min(1.,scale*.35/max(length(gradient),.000001));
    return normalize(scale*n-gradient);
  }
  vec3 fresnelSchlick(float cosine,vec3 f0){
    float q=1.-clamp(cosine,0.,1.),q2=q*q;
    return f0+(1.-f0)*q2*q2*q;
  }
  vec3 metalHighlight(vec3 n,vec3 view,vec3 l,float roughness,vec3 f0){
    vec3 h=normalize(view+l);
    float nv=max(dot(n,view),.001),nl=max(dot(n,l),0.),nh=max(dot(n,h),0.);
    float a=max(.055,roughness*roughness),a2=a*a,d=nh*nh*(a2-1.)+1.;
    float distribution=a2/max(3.141593*d*d,.00001);
    float k=(roughness+1.)*(roughness+1.)*.125;
    float visibility=1./max(4.*(nv*(1.-k)+k)*(nl*(1.-k)+k),.001);
    return fresnelSchlick(max(dot(view,h),0.),f0)*min(distribution*visibility,12.)*nl;
  }
  float depthSample(vec2 uv,vec2 offset,float depth,vec2 slope) {
    float texel=uShadowSettings.y;
    vec2 tap=uv+offset*texel;
    // The nearest depth texel represents a different point on a sloping surface.
    // Compare against that point on the receiver plane, not the centre depth.
    vec2 centre=(floor(tap/texel)+.5)*texel;
    return step(depth+dot(slope,(centre-uv)*2.),texture(uShadowMap,tap).r);
  }
  float shadow(vec3 n,vec3 l,int slot) {
    if(vOverlay>.5||(slot==0&&uShadowSettings.x<.5)||(slot==1&&uShadowSettings.x<1.5&&uShadowSettings.w<.5)||(slot==2&&uShadowSettings.z<.5))return 1.;
    vec4 projected=uShadowMatrix[slot]*vec4(vWorld+n*.014,1.);
    vec3 p=projected.xyz/projected.w*.5+.5;
    vec3 dx=dFdx(p),dy=dFdy(p);
    float determinant=dx.x*dy.y-dx.y*dy.x;
    vec2 slope=abs(determinant)>.00000000001?vec2(dx.z*dy.y-dy.z*dx.y,dy.z*dx.x-dx.z*dy.x)/determinant:vec2(0.);
    if(projected.w<=0.||p.z<=0.||p.z>=1.||min(p.x,p.y)<=.001||max(p.x,p.y)>=.999)return 1.;
    float bias=slot==1&&uShadowSettings.w>.5?.00014+.00024*(1.-max(dot(n,l),0.)):.00005+.00014*(1.-max(dot(n,l),0.));
    vec2 tile=slot==1?vec2(.5,0.):slot==2?vec2(0.,.5):vec2(0.);
    vec2 uv=p.xy*.5+tile;
    float visibility=0.;
    if(slot==1&&uShadowSettings.w>.5){
      // A wider, weighted kernel softens the sun's large world-space texels.
      // Every tap still compares its own receiver-plane depth at full precision.
      visibility=depthSample(uv,vec2(0.),p.z-bias,slope)*4.;
      visibility+=(depthSample(uv,vec2(-1.25,0.),p.z-bias,slope)+depthSample(uv,vec2(1.25,0.),p.z-bias,slope)+depthSample(uv,vec2(0.,-1.25),p.z-bias,slope)+depthSample(uv,vec2(0.,1.25),p.z-bias,slope))*2.;
      visibility+=depthSample(uv,vec2(-1.25,-1.25),p.z-bias,slope)+depthSample(uv,vec2(1.25,-1.25),p.z-bias,slope)+depthSample(uv,vec2(-1.25,1.25),p.z-bias,slope)+depthSample(uv,vec2(1.25,1.25),p.z-bias,slope);
      visibility*=.0625;
    }else{
      visibility+=depthSample(uv,vec2(-.65,-.65),p.z-bias,slope);
      visibility+=depthSample(uv,vec2(.65,-.65),p.z-bias,slope);
      visibility+=depthSample(uv,vec2(-.65,.65),p.z-bias,slope);
      visibility+=depthSample(uv,vec2(.65,.65),p.z-bias,slope);visibility*=.25;
    }
    float edge=min(min(p.x,p.y),min(1.-p.x,1.-p.y));
    float blend=smoothstep(.012,.085,edge)*(slot==1&&uShadowSettings.w>.5?1.:1.-smoothstep(24.,31.,projected.w));
    return mix(1.,mix(.055,1.,visibility),blend);
  }
  void main() {
    vec3 geometricNormal=normalize(vNormal), n=geometricNormal, an=abs(normalize(vSurfaceNormal));
    vec2 uv=an.y>.65?vSurface.xz:(an.x>an.z?vSurface.zy:vSurface.xy);
    float m=vMaterial, emission=vEmission;
    vec3 base=vec3(.105,.135,.15);
    float roughness=.47,metalness=.65,organicHeight=0.;
    float pixelSpan=max(fwidth(uv).x,fwidth(uv).y);
    float fineDetail=1.-smoothstep(.015,.10,pixelSpan);
    float grain=noise(uv*23.)*.5+mix(.5,noise(uv*71.),fineDetail)*.2;
    float broad=noise(uv*.7);
    // Architectural joints belong to the building, not to moving armour or the weapon.
    float architectural=1.-clamp(vObject,0.,1.);
    float panel=m<7.5?grid(uv*.55,.007)*architectural:0.;
    if (m<.5) {
      base*=.82+grain*.27+broad*.17;
      base*=1.-panel*.38;
      vec2 panelUV=fract(uv*.55);
      float screw=1.-smoothstep(.019,.031,length(panelUV-vec2(.065)));
      screw+=1.-smoothstep(.019,.031,length(panelUV-vec2(.935,.065)));
      base+=screw*.16*architectural;
      float ribs=1.-smoothstep(.02,.03,abs(fract(uv.y*4.)-.5));
      base*=1.-ribs*.085*architectural;
      // Integrate the brushed finish once it becomes smaller than a pixel;
      // distant armour must not turn into bands of bright parallel lines.
      float brushPhase=uv.y*980.+broad*4.;
      float brushFilter=1.-smoothstep(.65,2.8,fwidth(brushPhase));
      float brushing=.5+.5*sin(brushPhase)*brushFilter*fineDetail;
      roughness=.32+.12*brushing+.12*broad;
      float scratch=(1.-smoothstep(.008,.025,abs(fract(uv.y*4.3+noise(vec2(uv.x*1.1,0.))*.4)-.5)))*step(.62,noise(uv*vec2(2.,.25)))*fineDetail;
      base+=vec3(.035,.045,.05)*scratch;
    } else if (m<1.5) {
      base=mix(vec3(.19,.075,.025),vec3(.47,.235,.08),broad*.8+.15);
      base*=.8+grain*.43;
      base*=1.-panel*.43;
      roughness=.37+.34*broad;
      metalness=.82;
    } else if (m<2.5) {
      float tiles=grid(uv*.5,.007)*architectural;
      float variation=mix(broad,hash(floor(uv*.5)),architectural);
      base=mix(vec3(.095,.12,.135),vec3(.17,.19,.20),variation*.6);
      base*=1.-tiles*.43;
      base*=.9+grain*.3;
      vec2 diamond=fract(mat2(.707,-.707,.707,.707)*uv*12.);
      float tread=step(.68,diamond.x)*step(.65,diamond.y);
      base+=tread*.016;
      roughness=.26+.24*broad;
      float oil=smoothstep(.57,.80,noise(uv*.47+19.));
      base*=1.-oil*.24;roughness=mix(roughness,.19,oil);
      float wornEdge=max(0.,grid(uv*.5,.04)*architectural-tiles);
      base+=vec3(.025,.029,.03)*wornEdge*noise(uv*17.);
      metalness=.55;
    } else if (m<3.5) {
      base=vec3(.57,.58,.54)*(.78+grain*.3+broad*.13);
      base*=1.-panel*.22;
      roughness=.85;
      base*=.79+.21*noise(uv*vec2(6.,.19));
      metalness=0.;
    } else if (m<4.5) {
      base=vec3(.025,.74,.77);
      emission+=.72;
      roughness=.2;
      metalness=.3;
    } else if (m<5.5) {
      base=vec3(1.,.42,.06);
      emission+=.68;
      roughness=.28;
      metalness=.3;
    } else if (m<6.5) {
      base=vec3(.68,.055,.025);
      emission+=.18;
      roughness=.4;
      metalness=.4;
    } else if(m<7.5) {
      base=vec3(.065,.075,.085)*(.82+grain*.4);
      roughness=.86;
      metalness=0.;
    } else if(m<8.5) {
      float soil=noise(uv*.6)*.6+noise(uv*3.7)*.4;
      base=mix(vec3(.13,.105,.057),vec3(.16,.24,.075),smoothstep(.3,.7,soil));
      base*=.75+grain*.5;roughness=.95;metalness=0.;
    } else if(m<9.5) {
      float strata=.5+.5*sin(vWorld.y*4.+noise(uv*.9)*8.);
      base=mix(vec3(.23,.24,.22),vec3(.42,.40,.33),broad)*(.8+strata*.17+grain*.15);
      roughness=.91;metalness=0.;
    } else if(m<10.5) {
      vec2 barkUV=vec2(uv.x+sin(uv.y*.8)*.055,uv.y);
      float bark=noise(barkUV*vec2(7.,.72));
      float fibres=noise(barkUV*vec2(39.,1.5));
      vec2 knotCell=floor(barkUV*vec2(1.2,.45)),knot=fract(barkUV*vec2(1.2,.45))-.5;
      knot.x+=.17*sin(knot.y*3.+hash(knotCell)*6.);
      float knotRadius=length(knot*vec2(2.5,1.3));
      float knotMask=(1.-smoothstep(.12,.48,knotRadius))*step(.76,hash(knotCell+4.));
      float knotRings=.5+.5*sin(knotRadius*48.);
      float crevice=smoothstep(.28,.43,bark);
      base=mix(vec3(.045,.025,.013),vec3(.25,.145,.06),bark)*(.60+.40*crevice);
      base*=1.+(fibres-.5)*.30*fineDetail-knotMask*(.16+knotRings*.20)*fineDetail;
      organicHeight=bark*.022+(fibres-.5)*.005*fineDetail-knotMask*.012;
      roughness=.97;metalness=0.;
    } else if(m<11.5) {
      float clump=noise(uv*2.8),leaves=noise(uv*8.)*.7+noise(uv*19.)*.3;
      vec2 leafUV=uv*13.+vec2(clump,noise(uv*2.8+7.))*1.3;
      vec2 leaf=fract(leafUV)-.5;float angle=hash(floor(leafUV))*6.283185;
      leaf=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*leaf;
      float leafShape=1.-smoothstep(.20,.51,length(leaf*vec2(1.1,2.25)));
      float vein=(1.-smoothstep(.012,.045,abs(leaf.y)))*leafShape;
      base=mix(vec3(.025,.075,.022),vec3(.19,.31,.075),leaves)*(.78+clump*.32);
      base*=1.+(leafShape-.4)*.32*fineDetail+vein*.10*fineDetail;
      organicHeight=clump*.014+leafShape*.007*fineDetail;
      roughness=.88;metalness=0.;
    } else {
      base=vec3(.035,.12,.15)*(.9+sin(uv.x*9.+uEffects.x)*sin(uv.y*7.-uEffects.x*.7)*.1);
      roughness=.13;metalness=.35;
    }
    if(vColor.w>.5){
      vec3 tint=vColor.rgb*(.88+grain*.2)*(1.-panel*.12)*(m<3.5?.65:1.);
      base=m>7.5?base*.35+tint*.65:tint;
    }
    if(vObject>.5&&m<2.5){
      // Local edge wear survives instance tinting and follows the moving plate.
      // It cannot bring the architecture's world-space panel grid onto a gun.
      vec2 localUV=an.y>.65?vLocal.xz:(an.x>an.z?vLocal.zy:vLocal.xy);
      float edgeDistance=.5-max(abs(localUV.x),abs(localUV.y));
      float wear=(1.-smoothstep(.008,.025+fwidth(edgeDistance),edgeDistance))*(.52+.48*broad);
      float scuff=(1.-smoothstep(.015,.055,abs(sin(uv.y*173.+grain*11.))))*smoothstep(.52,.74,broad)*fineDetail;
      base*=.82+.24*broad+.14*grain;
      base=mix(base,base*1.28+vec3(.055,.065,.07),wear*.7);
      base+=vec3(.04,.045,.048)*scuff;
      roughness=mix(roughness,.21,wear*.82);
    }
    float height=(1.-panel)*.012+grain*.003*fineDetail;
    if(m>1.5&&m<2.5){
      vec2 treadUV=mat2(.707,-.707,.707,.707)*uv*12.;
      float tread=(1.-smoothstep(.26,.34,abs(fract(treadUV.x)-.5)))*(1.-smoothstep(.08,.16,abs(fract(treadUV.y)-.5)));
      height=(1.-grid(uv*.5,.007)*architectural)*.006+tread*.0018*fineDetail;
    }
    if(m<3.5)n=reliefNormal(n,height);
    if(m>7.5&&m<9.5)n=reliefNormal(n,(noise(uv*7.)-.5)*.009*fineDetail);
    if(m>9.5&&m<11.5)n=reliefNormal(n,organicHeight*fineDetail);
    // Pixel-scale normal variation broadens highlights instead of shimmering.
    vec3 ndx=dFdx(n),ndy=dFdy(n);
    roughness=min(.98,sqrt(roughness*roughness+min(.16,max(dot(ndx,ndx),dot(ndy,ndy))*.28)));
    vec3 view=normalize(uEye-vWorld);
    float distanceToEye=length(uEye-vWorld);
    vec3 light=vec3(.075,.10,.12)*(.72+.28*n.y);
    light+=vec3(.075,.09,.09)*max(dot(n,normalize(vec3(-.45,.85,.35))),0.);
    light*=1.-panel*.18;
    float outdoors=clamp(vOutdoor,0.,1.)*uEnvironment.x;
    light=mix(light,uAmbient*(.72+.28*max(n.y,0.)),outdoors);
    vec3 f0=mix(vec3(.04),clamp(base,vec3(.025),vec3(.92)),metalness);
    vec3 specular=vec3(0.);
    for(int i=0;i<12;i++) {
      if(i>=uLightCount) break;
      vec3 toLight=uLightPosition[i]-vWorld;
      float d=length(toLight);
      vec3 l=toLight/max(d,.001);
      float attenuation=(i<2?.27:.13)/(1.+d*d*.26);
      if(uLightRange[i]>0.)attenuation*=1.-smoothstep(uLightRange[i]*.35,uLightRange[i],d);
      float diffuse=max(dot(n,l),0.);
      float visibility=i==0?shadow(geometricNormal,l,0):i==1&&uEnvironment.x<.5?shadow(geometricNormal,l,1):1.;
      light+=uLightColor[i]*attenuation*(diffuse*visibility+.035);
      specular+=uLightColor[i]*attenuation*visibility*metalHighlight(n,view,l,roughness,f0)*2.4;
    }
    float sunlight=outdoors>.5?shadow(geometricNormal,uSunDirection,1):0.;
    float leafBack=m>10.5&&m<11.5?max(dot(-n,uSunDirection),0.)*.24:0.;
    light+=uSunColor*(max(dot(n,uSunDirection),0.)+leafBack)*sunlight;
    specular+=uSunColor*sunlight*metalHighlight(n,view,uSunDirection,roughness,f0);
    vec3 torchVector=uTorchPosition-vWorld;
    float torchDistance=length(torchVector);
    vec3 torchDirection=normalize(torchVector);
    float cone=smoothstep(.59,.96,dot(-torchDirection,uForward));
    float torch=cone/(1.+torchDistance*torchDistance*.045)*shadow(geometricNormal,torchDirection,2);
    light+=vec3(.44,.52,.56)*torch*max(dot(n,torchDirection),0.);
    specular+=vec3(.44,.52,.56)*torch*metalHighlight(n,view,torchDirection,roughness,f0)*1.5;
    vec3 muzzleVector=uTorchPosition+uForward*.8-vWorld;
    float muzzleDistance=length(muzzleVector),muzzlePower=uEffects.y*2.2/(1.+muzzleDistance*muzzleDistance*.14);
    vec3 muzzleDirection=muzzleVector/max(muzzleDistance,.001);
    light+=vec3(1.,.48,.12)*muzzlePower*(.22+.78*max(dot(n,muzzleDirection),0.));
    specular+=vec3(1.,.48,.12)*muzzlePower*metalHighlight(n,view,muzzleDirection,roughness,f0);
    if(vOverlay>.5) light+=vec3(.18,.22,.25);
    vec3 color=base*light+specular;
    // Analytic environment reflection: the biome's sky/ground hemisphere and
    // a soft indoor ceiling. This is intentionally not a scene-mirror pass.
    vec3 reflected=reflect(-view,n);
    vec3 sky=mix(uSkyBottom,uSkyTop,smoothstep(0.,1.,reflected.y));
    if(outdoors>.5&&roughness<.65&&metalness>.25){
      vec2 cloudUV=reflected.xz/max(.13,reflected.y+.18)*1.8+vec2(uWindTime.y*.006*uWindTime.x,0.);
      // One broad procedural lobe, filtered by roughness; no cubemap pass.
      float field=noise(cloudUV)*.8+.2;
      float cloud=smoothstep(.49-roughness*.08,.73+roughness*.08,field)*smoothstep(-.01,.24,reflected.y);
      float sun=max(0.,dot(reflected,uSunDirection));
      vec3 cloudColor=mix(uSkyBottom,vec3(1.12,1.10,1.01),.62)+uSunColor*pow(sun,6.)*.12;
      sky=mix(sky,cloudColor,cloud*.66);
      sky+=uSunColor*pow(sun,mix(48.,10.,roughness))*.16;
    }
    vec3 outside=mix(uAmbient*.20,sky,smoothstep(-.16,.18,reflected.y));
    vec3 inside=mix(vec3(.02,.03,.035),vec3(.18,.24,.27),smoothstep(-.45,.75,reflected.y));
    vec3 environmentReflection=mix(inside,outside,outdoors);
    environmentReflection=mix(environmentReflection,uAmbient*.85,roughness*roughness*.8);
    float nv=max(dot(n,view),0.),grazing=pow(1.-nv,5.);
    vec3 environmentFresnel=f0+(max(vec3(1.-roughness),f0)-f0)*grazing;
    color+=environmentReflection*environmentFresnel*(.18+1.3*(1.-roughness)*(1.-roughness))*(.5+metalness*2.5);
    float pulse=.94+.06*sin(uEffects.x*2.2+vWorld.y*3.);
    color+=base*emission*pulse*1.55;
    vec3 fogColor=mix(vec3(.009,.018,.024),uFogColor,outdoors);
    float fog=1.-exp(-distanceToEye*mix(.014+.008*exp(-max(vWorld.y,0.)*.7),uEnvironment.y,outdoors));
    if(vOverlay>.5) fog=0.;
    color=mix(color,fogColor,min(fog,.86));
    color=color/(color+vec3(.76));
    color=pow(max(color,vec3(0.)),vec3(.4545));
    vec2 screen=gl_FragCoord.xy/uResolution;
    float vignette=pow(max(0.,16.*screen.x*screen.y*(1.-screen.x)*(1.-screen.y)),.13);
    color*=mix(.59,1.,vignette);
    float hurt=uEffects.z*(1.-vignette*.65);
    color=mix(color,vec3(.64,.035,.015),clamp(hurt*.68,0.,.6));
    float waveRadius=(1.-clamp(uEffects.w,0.,1.))*.8;
    float wave=exp(-abs(length((screen-.5)*vec2(uResolution.x/uResolution.y,1.))-waveRadius)*85.)*uEffects.w;
    color+=vec3(.03,.27,.23)*wave;
    fragColor=vec4(color,1.);
  }`;

  // A separate translucent pass keeps smoke/steam out of depth atlases and
  // leaves the established opaque material shader unchanged.
  const FX_VERT=VERT.replace('vWorld=rotation*(aPosition*iScale.xyz)+iPosition.xyz;',`
    vec3 particlePosition=aPosition;
    if(iPosition.w>=20.){
      float radial=length(aPosition.xz);
      float side=clamp((radial-.37)/.13,0.,1.);
      float inner=clamp(iPosition.w-20.,0.,.999);
      particlePosition.xz*=mix(inner*.5,.5,side)/max(radial,.0001);
    }
    vWorld=rotation*(particlePosition*iScale.xyz)+iPosition.xyz;`);
  const FX_FRAG=`#version 300 es
  precision highp float;
  in vec3 vWorld;
  in vec3 vNormal;
  in vec3 vSurface;
  in vec3 vLocal;
  flat in float vMaterial;
  flat in float vEmission;
  flat in float vOutdoor;
  flat in vec4 vColor;
  uniform vec3 uEye;
  uniform vec3 uAmbient;
  uniform vec3 uFogColor;
  uniform vec2 uEnvironment;
  uniform float uTime;
  out vec4 fragColor;
  float noise(vec3 p){
    return .5+.18*sin(p.x*3.7+p.y*2.1+uTime*.65)+.16*sin(p.y*4.9-p.z*3.1-uTime*.41)+.12*sin(p.z*7.1+p.x*4.3);
  }
  void main(){
    vec3 toEye=uEye-vWorld;
    float distanceToEye=max(length(toEye),.001);
    // Ground telegraphs must stay readable at grazing player-eye angles.
    // Only cosmetic volumes soften toward their silhouette.
    float edge=vMaterial>=15.5?1.:pow(max(dot(normalize(vNormal),toEye/distanceToEye),0.),.65);
    float grain=clamp(noise(vSurface),.1,1.);
    bool fire=vMaterial>13.5&&vMaterial<14.5,smoke=vMaterial>14.5&&vMaterial<15.5,spark=vMaterial>16.5&&vMaterial<17.5;
    float heat=fire?smoothstep(.22,.83,noise(vSurface*vec3(1.65,.72,1.65)-vec3(0.,uTime*2.7,0.))):0.;
    float alpha=clamp(vColor.a*edge*(.58+grain*.42)*(fire?mix(.28,1.,heat):1.),0.,.94);
    if(smoke){
      vec3 flow=vSurface*vec3(.91,.65,.91)-vec3(0.,uTime*.30,0.);
      float billow=noise(flow)*.66+noise(flow*2.1+vec3(7.,3.,11.))*.34;
      alpha*=smoothstep(.16,.76,billow);
    }
    if(spark)alpha*=.30+.70*smoothstep(-.5,.18,vLocal.y);
    if(alpha<.004)discard;
    vec3 color=vColor.rgb*(uAmbient*.65+vec3(.34)+max(vEmission,0.)*1.25);
    if(fire){
      vec3 temperature=mix(vec3(.72,.025,.002),vec3(1.8,.23,.008),smoothstep(.10,.65,heat));
      temperature=mix(temperature,vec3(2.7,1.45,.23),smoothstep(.60,1.,heat));
      color=temperature*(.55+max(vEmission,0.)*.45)*(.7+grain*.3);
    }
    if(smoke)color*=.74+.40*grain;
    if(spark)color=mix(vec3(1.3,.10,.005),vec3(2.6,1.7,.52),smoothstep(-.25,.42,vLocal.y))*(.5+vEmission*.45);
    float fog=1.-exp(-distanceToEye*mix(.018,uEnvironment.y,clamp(vOutdoor,0.,1.)));
    color=mix(color,uFogColor,min(.86,fog));
    color=pow(max(color/(color+vec3(.76)),vec3(0.)),vec3(.4545));
    fragColor=vec4(color,alpha);
  }`;

  const DEPTH_FRAG=`#version 300 es
  precision highp float;
  void main() {}`;
  const POST_VERT=`#version 300 es
  precision highp float;
  out vec2 vUV;
  void main(){
    vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
    vUV=p;gl_Position=vec4(p*2.-1.,0.,1.);
  }`;
  const SKY_FRAG=`#version 300 es
  precision highp float;
  in vec2 vUV;
  uniform vec3 uSkyRight;
  uniform vec3 uSkyUp;
  uniform vec3 uSkyForward;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyBottom;
  uniform vec3 uSkyFog;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform vec2 uSkyFov;
  uniform vec2 uSkyMotion;
  out vec4 fragColor;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){
    vec2 a=floor(p),b=fract(p);b=b*b*(3.-2.*b);
    return mix(mix(hash(a),hash(a+vec2(1.,0.)),b.x),mix(hash(a+vec2(0.,1.)),hash(a+vec2(1.)),b.x),b.y);
  }
  float cloud(vec2 p){return noise(p)*.52+noise(p*2.03+11.)*.28+noise(p*4.17)*.14+noise(p*8.1)*.06;}
  void main(){
    vec2 uv=vUV*2.-1.;
    vec3 ray=normalize(uSkyForward+uSkyRight*uv.x*uSkyFov.x+uSkyUp*uv.y*uSkyFov.y);
    float elevation=clamp(ray.y,0.,1.);
    vec3 color=mix(uSkyBottom,uSkyTop,pow(elevation,.55));
    float sun=max(0.,dot(ray,uSunDirection));
    color+=uSunColor*(pow(sun,48.)*.20+pow(sun,650.)*.65+smoothstep(.99925,.99965,sun)*2.8);
    vec2 cloudUV=ray.xz/max(.13,ray.y+.18)*1.8+vec2(uSkyMotion.x*.006*uSkyMotion.y,0.);
    float clouds=smoothstep(.49,.73,cloud(cloudUV))*smoothstep(-.01,.24,ray.y);
    vec3 cloudColor=mix(uSkyBottom,vec3(1.12,1.10,1.01),.62)+uSunColor*pow(sun,6.)*.12;
    color=mix(color,cloudColor,clouds*.66);
    // Two distant ridgelines close the horizon without a flat, fog-coloured void.
    float angle=atan(ray.z,ray.x);
    float ridge=.018+noise(vec2(angle*5.,1.7))*.075+noise(vec2(angle*13.,4.))*.025;
    color=mix(color,mix(uSkyFog,uSkyBottom,.43),1.-smoothstep(ridge-.003,ridge+.003,ray.y));
    float nearRidge=-.025+noise(vec2(angle*7.+25.,2.8))*.065;
    color=mix(color,uSkyFog*.80,1.-smoothstep(nearRidge-.002,nearRidge+.002,ray.y));
    color=color/(color+vec3(.76));color=pow(max(color,vec3(0.)),vec3(.4545));
    float vignette=pow(max(0.,16.*vUV.x*vUV.y*(1.-vUV.x)*(1.-vUV.y)),.13);
    fragColor=vec4(color*mix(.76,1.,vignette),1.);
  }`;
  const POST_FRAG=`#version 300 es
  precision highp float;
  in vec2 vUV;
  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform vec2 uTexel;
  uniform int uPass;
  out vec4 fragColor;
  vec3 bright(vec2 uv){
    vec3 c=texture(uScene,uv).rgb;
    return c*smoothstep(.56,.86,max(max(c.r,c.g),c.b));
  }
  void main(){
    if(uPass==0){
      vec3 c=bright(vUV+uTexel*vec2(-1,-1))+bright(vUV+uTexel*vec2(1,-1));
      c+=bright(vUV+uTexel*vec2(-1,1))+bright(vUV+uTexel*vec2(1,1));
      fragColor=vec4(c*.25,1.);return;
    }
    vec2 axis=uPass==1?vec2(uTexel.x,0.):vec2(0.,uTexel.y);
    vec3 c=texture(uBloom,vUV).rgb*.227027;
    c+=texture(uBloom,vUV+axis*1.384615).rgb*.316216;
    c+=texture(uBloom,vUV-axis*1.384615).rgb*.316216;
    c+=texture(uBloom,vUV+axis*3.230769).rgb*.070270;
    c+=texture(uBloom,vUV-axis*3.230769).rgb*.070270;
    if(uPass==2)c=texture(uScene,vUV).rgb+c*.28;
    fragColor=vec4(c,1.);
  }`;

  // A closed, asymmetric crown shared with collision raycasts. Its canonical
  // 72 triangles are smaller than the old GPU sphere and remain identical in
  // every quality mode: a visual hollow never turns into a hidden solid box.
  const FOLIAGE=(()=>{
    const points=[[.018,.5,-.012]],faces=[],sides=12;
    for(let j=1;j<4;j++)for(let i=0;i<sides;i++){
      const u=i*Math.PI*2/sides,v=j*Math.PI/4;
      const radius=.5*Math.pow(Math.sin(v),.88)*(.79+.16*Math.cos(u*3)+.055*Math.sin(u*5+.7));
      const angle=u+.045*Math.sin(u*2+1);
      // Parallel, irregular rings keep the connecting quadrilaterals planar.
      // Canvas can merge each triangle pair without changing a single pixel
      // of silhouette or the canonical geometry used by rays and GPU shadows.
      points.push([Math.cos(angle)*radius+.024*Math.cos(v),.5*Math.cos(v),Math.sin(angle)*radius-.018*Math.cos(v)]);
    }
    points.push([-.025,-.5,.015]);
    // Keep exactly the existing p/s/r envelope, without widening the trunk's
    // physical footprint or the spatial index bounds of a replaced canopy.
    for(let axis=0;axis<3;axis++){
      const lo=Math.min(...points.map(p=>p[axis])),hi=Math.max(...points.map(p=>p[axis]));
      for(const p of points)p[axis]=(p[axis]-lo)/(hi-lo)-.5;
    }
    const ring=(j,i)=>1+j*sides+(i+sides)%sides;
    for(let i=0;i<sides;i++){
      faces.push([0,ring(0,i+1),ring(0,i)]);
      for(let j=0;j<2;j++)faces.push([ring(j,i),ring(j,i+1),ring(j+1,i+1)],[ring(j,i),ring(j+1,i+1),ring(j+1,i)]);
      faces.push([points.length-1,ring(2,i),ring(2,i+1)]);
    }
    const normals=points.map(()=>[0,0,0]);
    for(const face of faces){
      const [a,b,c]=face.map(i=>points[i]),ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]);
      let n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      if(n.reduce((sum,v,k)=>sum+v*(a[k]+b[k]+c[k]),0)<0){[face[1],face[2]]=[face[2],face[1]];n=n.map(v=>-v);}
      for(const i of face)for(let k=0;k<3;k++)normals[i][k]+=n[k];
    }
    for(const n of normals){const length=Math.hypot(...n)||1;for(let k=0;k<3;k++)n[k]/=length;Object.freeze(n);}
    points.forEach(Object.freeze);faces.forEach(Object.freeze);
    const triangles=Object.freeze(faces.map(face=>Object.freeze(face.map(i=>points[i]))));
    return Object.freeze({points:Object.freeze(points),faces:Object.freeze(faces),normals:Object.freeze(normals),triangles});
  })();
  function foliageTriangles(){return FOLIAGE.triangles;}
  const names = ['box','sphere','cylinder','octa','ring','bevel','foliage'];
  function geometry(low) {
    const data=[], indices=[], ranges={}, seen=new Map();
    // DRAW-11 : un sommet (position + normale) n'est écrit qu'une fois. La clé est la
    // représentation exacte des six flottants, donc deux triangles voisins partagent le même
    // indice au bit près ; les coutures de sphère et d'anneau gardent leurs doublons (sin(2π)
    // n'est pas exactement 0), sans conséquence sur l'image.
    function vertex(p,n) {
      const key=p[0]+','+p[1]+','+p[2]+'|'+n[0]+','+n[1]+','+n[2];
      const found=seen.get(key);if(found!==undefined)return found;
      const i=data.length/6;data.push(...p,...n);seen.set(key,i);return i;
    }
    function triangle(p0,p1,p2,n0,n1,n2) {
      const a=[p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2]],b=[p2[0]-p0[0],p2[1]-p0[1],p2[2]-p0[2]];
      const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      const len=Math.hypot(...cross)||1;
      n0=n0||cross.map(v=>v/len);n1=n1||n0;n2=n2||n0;
      if(cross[0]*n0[0]+cross[1]*n0[1]+cross[2]*n0[2]<0) {const t=p1;p1=p2;p2=t;const n=n1;n1=n2;n2=n;}
      indices.push(vertex(p0,n0),vertex(p1,n1),vertex(p2,n2));
    }
    function begin(name){ranges[name]={offset:indices.length*2,count:0};}
    function end(name){ranges[name].count=indices.length-ranges[name].offset/2;}
    begin('box');
    for(let axis=0;axis<3;axis++) for(const sign of [-1,1]) {
      const n=[0,0,0];n[axis]=sign;
      const a=(axis+1)%3,b=(axis+2)%3;
      const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(q=>{const p=[0,0,0];p[axis]=sign*.5;p[a]=q[0]*.5;p[b]=q[1]*.5;return p;});
      triangle(points[0],points[1],points[2],n);triangle(points[0],points[2],points[3],n);
    }
    end('box');
    begin('sphere');
    const sphere=(u,v)=>[Math.sin(v)*Math.cos(u)*.5,Math.cos(v)*.5,Math.sin(v)*Math.sin(u)*.5];
    const longitude=low===2?6:low?8:16,latitude=low===2?4:low?6:10;
    for(let j=0;j<latitude;j++) for(let i=0;i<longitude;i++) {
      const p=[sphere(i*Math.PI*2/longitude,j*Math.PI/latitude),sphere((i+1)*Math.PI*2/longitude,j*Math.PI/latitude),sphere((i+1)*Math.PI*2/longitude,(j+1)*Math.PI/latitude),sphere(i*Math.PI*2/longitude,(j+1)*Math.PI/latitude)];
      if(j>0) triangle(p[0],p[1],p[2],p[0].map(v=>v*2),p[1].map(v=>v*2),p[2].map(v=>v*2));
      if(j<latitude-1) triangle(p[0],p[2],p[3],p[0].map(v=>v*2),p[2].map(v=>v*2),p[3].map(v=>v*2));
    }
    end('sphere');
    begin('foliage');
    for(const [a,b,c] of FOLIAGE.faces)triangle(FOLIAGE.points[a],FOLIAGE.points[b],FOLIAGE.points[c],FOLIAGE.normals[a],FOLIAGE.normals[b],FOLIAGE.normals[c]);
    end('foliage');
    begin('cylinder');
    const cylinderSides=low===2?6:low?8:16;
    for(let i=0;i<cylinderSides;i++) {
      const a=i*Math.PI*2/cylinderSides,b=(i+1)*Math.PI*2/cylinderSides;
      const na=[Math.cos(a),0,Math.sin(a)],nb=[Math.cos(b),0,Math.sin(b)];
      const p0=[na[0]*.5,-.5,na[2]*.5],p1=[nb[0]*.5,-.5,nb[2]*.5],p2=[nb[0]*.5,.5,nb[2]*.5],p3=[na[0]*.5,.5,na[2]*.5];
      triangle(p0,p1,p2,na,nb,nb);triangle(p0,p2,p3,na,nb,na);
      triangle([0,-.5,0],p1,p0,[0,-1,0]);triangle([0,.5,0],p3,p2,[0,1,0]);
    }
    end('cylinder');
    begin('octa');
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2,b=(i+1)*Math.PI/2;
      const p0=[Math.cos(a)*.5,0,Math.sin(a)*.5],p1=[Math.cos(b)*.5,0,Math.sin(b)*.5];
      triangle([0,.5,0],p1,p0);triangle([0,-.5,0],p0,p1);
    }
    end('octa');
    begin('ring');
    const torus=(u,v)=>[(.435+.065*Math.cos(v))*Math.cos(u),.065*Math.sin(v),(.435+.065*Math.cos(v))*Math.sin(u)];
    const torusNormal=(u,v)=>[Math.cos(v)*Math.cos(u),Math.sin(v),Math.cos(v)*Math.sin(u)];
    const ringSides=low===2?8:low?12:24,ringTube=low?4:6;
    for(let i=0;i<ringSides;i++) for(let j=0;j<ringTube;j++) {
      const a=i*Math.PI*2/ringSides,b=(i+1)*Math.PI*2/ringSides,c=j*Math.PI*2/ringTube,d=(j+1)*Math.PI*2/ringTube;
      const p=[torus(a,c),torus(b,c),torus(b,d),torus(a,d)],n=[torusNormal(a,c),torusNormal(b,c),torusNormal(b,d),torusNormal(a,d)];
      triangle(p[0],p[1],p[2],n[0],n[1],n[2]);triangle(p[0],p[2],p[3],n[0],n[2],n[3]);
    }
    end('ring');
    // Close armour and weapon plates catch light on real, flat chamfers. The
    // coarse Canvas primitive uses the existing box; silhouettes retain scale.
    if(low===2)ranges.bevel=ranges.box;
    else{
      begin('bevel');const inner=.42,outer=.5;
      for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
        const n=[0,0,0];n[axis]=sign;const a=(axis+1)%3,b=(axis+2)%3;
        const p=[[-1,-1],[1,-1],[1,1],[-1,1]].map(q=>{const v=[0,0,0];v[axis]=sign*outer;v[a]=q[0]*inner;v[b]=q[1]*inner;return v;});
        triangle(p[0],p[1],p[2],n);triangle(p[0],p[2],p[3],n);
      }
      for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)for(const sa of [-1,1])for(const sb of [-1,1]){
        const c=3-a-b,n=[0,0,0];n[a]=sa/Math.SQRT2;n[b]=sb/Math.SQRT2;
        const p=[[outer,inner,-inner],[inner,outer,-inner],[inner,outer,inner],[outer,inner,inner]].map(q=>{const v=[0,0,0];v[a]=q[0]*sa;v[b]=q[1]*sb;v[c]=q[2];return v;});
        triangle(p[0],p[1],p[2],n);triangle(p[0],p[2],p[3],n);
      }
      for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
        const n=[x,y,z].map(v=>v/Math.sqrt(3));
        triangle([x*outer,y*inner,z*inner],[x*inner,y*outer,z*inner],[x*inner,y*inner,z*outer],n);
      }
      end('bevel');
    }
    return {vertices:new Float32Array(data),indices:new Uint16Array(indices),ranges};
  }

  function environmentInfo(value){
    if(!value)return null;
    const color=(v,fallback)=>Array.isArray(v)&&v.length>=3?v.slice(0,3).map((x,i)=>Number.isFinite(x)?Math.max(0,x):fallback[i]):fallback;
    // A direction can contain negative horizontal coordinates; colours cannot.
    const sun=Array.isArray(value.sunDirection)&&value.sunDirection.length>=3?value.sunDirection.slice(0,3).map((x,i)=>Number.isFinite(x)?x:[.4,.8,.3][i]):[.4,.8,.3];
    sun[1]=Math.max(.12,sun[1]);const sunLength=Math.hypot(...sun)||1;
    const zones=value.outdoorZones||[];
    return {...value,skyTop:color(value.skyTop,[.22,.39,.51]),skyBottom:color(value.skyBottom,[.65,.72,.66]),fog:color(value.fog,[.35,.43,.42]),sunDirection:sun.map(x=>x/sunLength),sunColor:color(value.sunColor,[1,.86,.62]),ambient:color(value.ambient,[.24,.29,.27]),wind:Number.isFinite(value.wind)?Math.max(0,Math.min(2,value.wind)):.6,fogDensity:Number.isFinite(value.fogDensity)?Math.max(.001,value.fogDensity):.011,outdoorZones:zones,outdoorRaster:outdoorRaster(zones)};
  }
  const OUTDOOR_CELL=2,OUTDOOR_CELLS_MAX=1<<20;
  function outdoorRaster(zones) {
    if(!zones.length)return null;
    let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
    for(const zone of zones){
      if(!(zone.w>0)||!(zone.d>0))return null;
      const hw=zone.w*.5+.08,hd=zone.d*.5+.08;
      if(zone.x-hw<minX)minX=zone.x-hw;if(zone.x+hw>maxX)maxX=zone.x+hw;
      if(zone.z-hd<minZ)minZ=zone.z-hd;if(zone.z+hd>maxZ)maxZ=zone.z+hd;
    }
    if(!Number.isFinite(minX))return null;
    const x0=Math.floor(minX/OUTDOOR_CELL)*OUTDOOR_CELL-OUTDOOR_CELL,z0=Math.floor(minZ/OUTDOOR_CELL)*OUTDOOR_CELL-OUTDOOR_CELL;
    const nx=Math.ceil((maxX-x0)/OUTDOOR_CELL)+1,nz=Math.ceil((maxZ-z0)/OUTDOOR_CELL)+1;
    if(!(nx>0&&nz>0)||nx*nz>OUTDOOR_CELLS_MAX)return null;
    const grid=new Uint8Array(nx*nz);
    for(const zone of zones){
      const hw=zone.w*.5+.08,hd=zone.d*.5+.08;
      const ax=Math.max(0,Math.floor((zone.x-hw-x0)/OUTDOOR_CELL)),bx=Math.min(nx-1,Math.floor((zone.x+hw-x0)/OUTDOOR_CELL));
      const az=Math.max(0,Math.floor((zone.z-hd-z0)/OUTDOOR_CELL)),bz=Math.min(nz-1,Math.floor((zone.z+hd-z0)/OUTDOOR_CELL));
      for(let x=ax;x<=bx;x++)for(let z=az;z<=bz;z++)grid[x*nz+z]=1;
    }
    return {grid,nx,nz,x0,z0};
  }
  function outdoorAt(p,environment){
    if(!environment)return false;
    const zones=environment.outdoorZones,raster=environment.outdoorRaster;
    if(raster){
      const cx=Math.floor((p[0]-raster.x0)/OUTDOOR_CELL),cz=Math.floor((p[2]-raster.z0)/OUTDOOR_CELL);
      if(cx<0||cz<0||cx>=raster.nx||cz>=raster.nz)return false;
      if(!raster.grid[cx*raster.nz+cz])return false;
    }
    for(let i=0;i<zones.length;i++){const zone=zones[i];if(Math.abs(p[0]-zone.x)<=zone.w*.5+.08&&Math.abs(p[2]-zone.z)<=zone.d*.5+.08)return true;}
    return false;
  }
  function transientLights(value,eye,limit){
    if(!Array.isArray(value))return [];
    const valid=[];
    for(const source of value.slice(0,16)){
      if(!source||!Array.isArray(source.p)||source.p.length!==3||!source.p.every(Number.isFinite)||!Number.isFinite(source.power)||source.power<=0||!Number.isFinite(source.range)||source.range<=0)continue;
      const range=Math.min(48,source.range),power=Math.min(64,source.power),p=source.p;
      const distance=(p[0]-eye[0])**2+(p[1]-eye[1])**2+(p[2]-eye[2])**2;
      if(distance>(180+range)**2)continue;
      const color=Array.isArray(source.color)&&source.color.length===3?source.color.map(v=>Number.isFinite(v)?Math.max(0,Math.min(3,v)):0):[1,.42,.09];
      if(!color.some(v=>v>0))continue;
      valid.push({p,color,power,range,score:power/(1+distance*.1)});
    }
    return valid.sort((a,b)=>b.score-a.score).slice(0,limit);
  }
  function outdoorMesh(mesh,environment){
    return !!environment&&(mesh.outdoor===undefined?((mesh.mat||0)>=8||outdoorAt(mesh.p||[0,0,0],environment)):!!mesh.outdoor);
  }
  function surfaceFlags(mesh,environment,objects=false){
    const object=mesh.overlay||mesh.surface==='object'||objects&&mesh.surface!=='architecture';
    return (mesh.overlay?1:0)+(outdoorMesh(mesh,environment)?2:0)+(object?4:0);
  }
  const SHAPE={box:0,sphere:1,cylinder:2,octa:3,ring:4,bevel:5,foliage:6},ZERO3=[0,0,0],ONE3=[1,1,1],GREY3=[.5,.5,.5];
  function scratchRows(){return {data:new Float32Array(0),counts:new Int32Array(7),starts:new Int32Array(7),codes:new Int8Array(0)};}
  function rowsFor(scratch,count) {
    if(scratch.data.length<count*16){let n=scratch.data.length/16||16;while(n<count)n*=2;scratch.data=new Float32Array(n*16);}
    if(scratch.codes.length<count){let n=scratch.codes.length||64;while(n<count)n*=2;scratch.codes=new Int8Array(n);}
    return scratch.data;
  }
  function pack(meshes,environment,objects=false,scratch=null) {
    const list=meshes||[];if(!scratch)scratch=scratchRows();
    if(scratch.codes.length<list.length)rowsFor(scratch,list.length);
    const counts=scratch.counts,starts=scratch.starts;counts.fill(0);let count=0;
    for(let k=0;k<list.length;k++){const code=SHAPE[list[k].shape||'box'],c=code===undefined?-1:code;scratch.codes[k]=c;if(c>=0){counts[c]++;count++;}}
    const data=rowsFor(scratch,count),groups=[];let offset=0;
    for(let i=0;i<7;i++){starts[i]=offset;if(counts[i])groups.push({name:names[i],offset:offset*64,count:counts[i]});offset+=counts[i];}
    for(let k=0;k<list.length;k++){
      const c=scratch.codes[k];if(c<0)continue;
      const mesh=list[k],j=(starts[c]++)*16,p=mesh.p||ZERO3,s=mesh.s||ONE3,r=mesh.r||ZERO3,col=mesh.color;
      data[j]=p[0];data[j+1]=p[1];data[j+2]=p[2];data[j+3]=mesh.mat||0;data[j+4]=s[0];data[j+5]=s[1];data[j+6]=s[2];data[j+7]=mesh.emissive||0;
      data[j+8]=r[0];data[j+9]=r[1];data[j+10]=r[2];data[j+11]=surfaceFlags(mesh,environment,objects);
      if(col){data[j+12]=col[0];data[j+13]=col[1];data[j+14]=col[2];data[j+15]=1;}else{data[j+12]=0;data[j+13]=0;data[j+14]=0;data[j+15]=0;}
    }
    return {values:data.subarray(0,count*16),groups};
  }
  function packEffects(meshes,environment,eye,scratch){
    const distance=m=>(m.p[0]-eye[0])**2+(m.p[1]-eye[1])**2+(m.p[2]-eye[2])**2;
    const list=meshes.filter(m=>names.includes(m.shape||'sphere')&&m.alpha>.003).slice().sort((a,b)=>distance(b)-distance(a));
    if(!scratch)scratch=scratchRows();
    const values=rowsFor(scratch,list.length),groups=[];let offset=0;
    for(const mesh of list){
      const name=mesh.shape||'sphere',last=groups[groups.length-1];
      if(last&&last.name===name)last.count++;else groups.push({name,offset:offset*4,count:1});
      const p=mesh.p,s=mesh.s||ONE3,r=mesh.r||ZERO3,c=mesh.color||GREY3,j=offset;
      const material=mesh.shape==='ring'&&Number.isFinite(mesh.innerRatio)?20+Math.min(.999,Math.max(0,mesh.innerRatio)):mesh.fxPriority==='hazard'?16:mesh.fxFire?14:mesh.fxSmoke?15:mesh.fxSpark?17:7;
      values[j]=p[0];values[j+1]=p[1];values[j+2]=p[2];values[j+3]=material;values[j+4]=s[0];values[j+5]=s[1];values[j+6]=s[2];values[j+7]=mesh.emissive||0;
      values[j+8]=r[0];values[j+9]=r[1];values[j+10]=r[2];values[j+11]=surfaceFlags(mesh,environment,true);
      values[j+12]=c[0];values[j+13]=c[1];values[j+14]=c[2];values[j+15]=Math.min(1,Math.max(0,mesh.alpha));
      offset+=16;
    }
    return {values:values.subarray(0,offset),groups};
  }

  function multiply(a,b,out) {
    for(let c=0;c<4;c++) for(let r=0;r<4;r++) out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return out;
  }

  function cameraAxes(camera){
    const yaw=camera.yaw||0,pitch=camera.pitch||0,roll=camera.roll||0;
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
    const r=[cy,0,sy],u=[-sy*sp,cp,cy*sp];
    return {right:r.map((v,i)=>v*cr+u[i]*sr),up:u.map((v,i)=>v*cr-r[i]*sr),forward:[sy*cp,sp,-cy*cp]};
  }
  function detailRanges(quality,software=false){
    return software?(quality==='low'?[26,16,0]:quality==='high'?[42,30,12]:[34,23,8]):(quality==='low'?[48,20,0]:quality==='high'?[82,42,19]:[64,32,13]);
  }
  function extendedDistance(range,environment,eye){
    for(const zone of environment?.longViewZones||[]){
      const dx=Math.max(0,Math.abs(eye[0]-zone.x)-zone.w*.5),dz=Math.max(0,Math.abs(eye[2]-zone.z)-zone.d*.5),distance=Math.hypot(dx,dz);
      const t=Math.max(0,Math.min(1,(35-distance)/20)),blend=t*t*(3-2*t),target=Math.max(range,Math.min(140,Number(zone.range)||100));
      range=Math.max(range,range+(target-range)*blend);
    }
    return range;
  }
  function softwareDistance(quality,environment,eye){
    return extendedDistance(environment?(quality==='low'?30:quality==='high'?50:38):(quality==='low'?26:quality==='high'?42:34),environment,eye);
  }
  function horrorLights(director,lights){
    if(director?.eventType!=='blackout'||!(director.eventAge>=0&&director.eventAge<1.2))return null;
    const p=[director.eventX,director.eventY,director.eventZ];if(!p.every(Number.isFinite))return null;
    const age=director.eventAge,smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
    const strength=.78*Math.max(0,Math.min(1,Number.isFinite(director.eventIntensity)?director.eventIntensity:1))*smooth(age/.08)*(1-smooth((age-.72)/.48));
    if(strength<.0001)return null;
    const local=lights.map(light=>({light,d:Math.hypot(...light.p.map((v,k)=>v-p[k]))})).filter(e=>e.d<10).sort((a,b)=>a.d-b.d).slice(0,3),plan=new Map();
    for(const {light,d} of local)plan.set(light,1-strength*(1-smooth((d-4)/6)));
    return plan.size?plan:null;
  }
  function resolutionGovernor(){
    let scale=1,mean=0,slow=0,fast=0,cooldown=1;
    return {
      reset(){scale=1;mean=slow=fast=0;cooldown=1;},
      update(fx,quality){
        if(quality!=='auto'||fx.adaptive!==true){mean=slow=fast=0;return scale;}
        const raw=Number(fx.frameMs);if(!(raw>0&&raw<500))return scale;
        // One loading spike cannot lower quality; sustained slow frames still count.
        const dt=Math.min(.25,raw/1000),sample=Math.min(150,raw);
        mean=mean?mean+(sample-mean)*(1-Math.exp(-dt/.65)):sample;
        cooldown=Math.max(0,cooldown-dt);
        if(cooldown>0){slow=fast=0;return scale;}
        slow=mean>25?slow+dt:0;fast=mean<18.5?fast+dt:0;
        if(slow>1.3&&scale>.65){scale=Math.max(.65,Math.round((scale-.1)*100)/100);cooldown=2;slow=fast=0;}
        else if(fast>5&&scale<1){scale=Math.min(1,Math.round((scale+.05)*100)/100);cooldown=2;slow=fast=0;}
        return scale;
      }
    };
  }
  function metadata(mesh){
    return {mesh,p:mesh.p||[0,0,0],radius:Math.hypot(...(mesh.s||[1,1,1]))*.5,detail:Math.max(0,Math.min(2,Math.floor(mesh.detail||0))),software:null,softwareCoarse:null};
  }
  function spatialIndex(meshes,environment,previous,delta){
    if(previous)return previous.update(meshes||[],delta);
    let entries=[],generation=0,nextSlot=0,capacity=0,px,py,pz,rad;
    const byMesh=new WeakMap(),slots=[],free=[],maxRadius=[0,0,0];
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(const m of meshes||[]){const p=m.p||[0,0,0],x=Math.floor(p[0]/8),z=Math.floor(p[2]/8);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
    if(minX===Infinity)minX=maxX=minZ=maxZ=0;
    minX-=4;maxX+=4;minZ-=4;maxZ+=4;
    const nx=maxX-minX+1,nz=maxZ-minZ+1,dense=Number.isSafeInteger(nx*nz)&&nx*nz<=262144;
    // Normal worlds use a dense table of cell lists. Pathological extents stay
    // sparse instead of allocating a continent-sized array.
    const levels=dense?[new Array(nx*nz),new Array(nx*nz),new Array(nx*nz)]:[new Map(),new Map(),new Map()];
    function cellAt(level,x,z,create=false){
      const grid=levels[level],key=dense?(x-minX)*nz+z-minZ:x+','+z;
      let cell=dense?grid[key]:grid.get(key);
      if(!cell&&create){cell={x,z,level,list:[],sumY:0,minY:Infinity,maxY:-Infinity,radius:0,seen:0,lastOrder:-1};if(dense)grid[key]=cell;else grid.set(key,cell);}
      return cell;
    }
    function grow(required){
      if(required<=capacity)return;capacity=Math.max(64,required,capacity*2);
      const copy=a=>{const b=new Float64Array(capacity);if(a)b.set(a);return b;};px=copy(px);py=copy(py);pz=copy(pz);rad=copy(rad);
    }
    function makeEntry(mesh){
      const e=metadata(mesh),i=free.length?free.pop():nextSlot++;grow(i+1);
      const p=e.p,s=mesh.s||[1,1,1],r=mesh.r||[0,0,0],c=mesh.color||[0,0,0];
      e.row=new Float32Array([p[0],p[1],p[2],mesh.mat||0,s[0],s[1],s[2],mesh.emissive||0,r[0],r[1],r[2],surfaceFlags(mesh,environment)+(e.detail+1)*8,c[0],c[1],c[2],mesh.color?1:0]);
      e.created=generation;e.sourceDetail=mesh.detail||0;e.slot=i;e.size=[s[0],s[1],s[2]];e.live=true;slots[i]=e;px[i]=p[0];py[i]=p[1];pz[i]=p[2];rad[i]=e.radius;
      e.cell=cellAt(e.detail,Math.floor(p[0]/8),Math.floor(p[2]/8),true);byMesh.set(mesh,e);return e;
    }
    function cellBounds(cell){
      const r=cell.radius;return {level:cell.level,minX:cell.x*8-r,maxX:cell.x*8+8+r,minY:cell.minY-r,maxY:cell.maxY+r,minZ:cell.z*8-r,maxZ:cell.z*8+8+r};
    }
    function update(next,delta){
      // A four-cell halo absorbs ordinary destruction fragments. Crossing it
      // rebuilds in one revision; no removed wall survives for a second frame.
      generation++;maxRadius.fill(0);
      const dirty=new Set(),changes=[],retained=[];
      // The shared destruction delta identifies retirements directly. Generic
      // callers still get the generation diff, including in-place movement.
      const old=delta&&!delta.full&&Array.isArray(delta.removed)&&Array.isArray(delta.added)?delta.removed.map(mesh=>byMesh.get(mesh)).filter(Boolean):entries;
      function touch(cell){if(dirty.has(cell))return;dirty.add(cell);if(cell.list.length)changes.push(cellBounds(cell));}
      for(let order=0;order<next.length;order++){
        const mesh=next[order],p=mesh.p||[0,0,0],s=mesh.s||[1,1,1];let e=byMesh.get(mesh);
        if(e&&(e.gen===generation||px[e.slot]!==p[0]||py[e.slot]!==p[1]||pz[e.slot]!==p[2]||e.size[0]!==s[0]||e.size[1]!==s[1]||e.size[2]!==s[2]||e.sourceDetail!==(mesh.detail||0)))e=null;
        if(!e){
          const x=Math.floor(p[0]/8),z=Math.floor(p[2]/8);if(x<minX||x>maxX||z<minZ||z>maxZ)return spatialIndex(next,environment);
          e=makeEntry(mesh);touch(e.cell);e.cell.list.push(e.slot);
        }
        else{
          const cell=e.cell;if(cell.seen===generation&&e.order<cell.lastOrder)touch(cell);
          cell.seen=generation;cell.lastOrder=e.order;
        }
        e.order=order;e.gen=generation;retained.push(e);maxRadius[e.detail]=Math.max(maxRadius[e.detail],e.radius);
      }
      for(const e of old)if(e.gen!==generation){touch(e.cell);e.live=false;slots[e.slot]=null;free.push(e.slot);if(byMesh.get(e.mesh)===e)byMesh.delete(e.mesh);}
      for(const cell of dirty){
        cell.list=cell.list.filter(i=>slots[i]?.gen===generation).sort((a,b)=>slots[a].order-slots[b].order);
        cell.sumY=0;cell.minY=Infinity;cell.maxY=-Infinity;cell.radius=0;
        for(const i of cell.list){cell.sumY+=py[i];cell.minY=Math.min(cell.minY,py[i]);cell.maxY=Math.max(cell.maxY,py[i]);cell.radius=Math.max(cell.radius,rad[i]);}
        if(cell.list.length)changes.push(cellBounds(cell));
      }
      entries=retained;index.entries=entries;index.generation=generation;index.changes=changes;index.full=generation===1;index.changedCells=dirty.size;return index;
    }
    function query(eye,ranges,out,frustum){
      const result=out||[];result.length=0;
      for(let level=0;level<3;level++){
        const range=ranges[level];if(!(range>0))continue;
        const radius=range+maxRadius[level],x0=Math.max(minX,Math.floor((eye[0]-radius)/8)),x1=Math.min(maxX,Math.floor((eye[0]+radius)/8)),z0=Math.max(minZ,Math.floor((eye[2]-radius)/8)),z1=Math.min(maxZ,Math.floor((eye[2]+radius)/8));
        for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
          const cell=cellAt(level,x,z);if(!cell||!cell.list.length)continue;
          if(frustum){
            const count=cell.list.length,cy=cell.sumY/count,half=Math.max(cy-cell.minY,cell.maxY-cy);
            if(!visibleSphere(x*8+4,cy,z*8+4,5.656854249492381+half+maxRadius[level],eye,frustum.axes,frustum.horizontal,frustum.vertical,frustum.far))continue;
          }
          for(const i of cell.list){const d=(px[i]-eye[0])**2+(py[i]-eye[1])**2+(pz[i]-eye[2])**2;if(d<=(range+rad[i])**2)result.push(slots[i]);}
        }
      }
      return result;
    }
    const index={entries,query,byMesh,update,generation,changes:[],full:true,changedCells:0,dense};
    return update(meshes||[]);
  }
  function changedSelection(index,origin,ranges){
    if(index.full)return true;
    for(const q of index.changes){const r=ranges[q.level];if(!(r>0))continue;
      if(origin[0]+r>=q.minX&&origin[0]-r<=q.maxX&&origin[1]+r>=q.minY&&origin[1]-r<=q.maxY&&origin[2]+r>=q.minZ&&origin[2]-r<=q.maxZ)return true;
    }
    return false;
  }
  function visibleSphere(cx,cy,cz,r,eye,axes,horizontal,vertical,far){
    const x=cx-eye[0],y=cy-eye[1],d=cz-eye[2],f=axes.forward,right=axes.right,up=axes.up;
    const z=x*f[0]+y*f[1]+d*f[2];
    return z+r>.04&&z-r<far&&Math.abs(x*right[0]+y*right[1]+d*right[2])<=z*horizontal+r*Math.sqrt(1+horizontal*horizontal)&&Math.abs(x*up[0]+y*up[1]+d*up[2])<=z*vertical+r*Math.sqrt(1+vertical*vertical);
  }
  function visible(e,eye,axes,horizontal,vertical,far){
    const x=e.p[0]-eye[0],y=e.p[1]-eye[1],d=e.p[2]-eye[2],f=axes.forward,right=axes.right,up=axes.up;
    const z=x*f[0]+y*f[1]+d*f[2],r=e.radius;
    return z+r>.04&&z-r<far&&Math.abs(x*right[0]+y*right[1]+d*right[2])<=z*horizontal+r*Math.sqrt(1+horizontal*horizontal)&&Math.abs(x*up[0]+y*up[1]+d*up[2])<=z*vertical+r*Math.sqrt(1+vertical*vertical);
  }
  function packIndexed(entries,scratch){
    if(!scratch)scratch=scratchRows();
    const counts=scratch.counts,starts=scratch.starts;counts.fill(0);let count=0;
    for(const e of entries){if(e.shapeCode===undefined)e.shapeCode=SHAPE[e.mesh.shape||'box']===undefined?-1:SHAPE[e.mesh.shape||'box'];if(e.shapeCode>=0){counts[e.shapeCode]++;count++;}}
    const data=rowsFor(scratch,count),groups=[];let offset=0;
    for(let i=0;i<7;i++){starts[i]=offset;if(counts[i])groups.push({name:names[i],offset:offset*64,count:counts[i]});offset+=counts[i];}
    for(const e of entries)if(e.shapeCode>=0)data.set(e.row,(starts[e.shapeCode]++)*16);
    return {values:data.subarray(0,count*16),groups};
  }

  function skyColor(values,scale=1){return 'rgb('+values.map(v=>Math.round(Math.pow(Math.max(0,v*scale)/(Math.max(0,v*scale)+.76),.4545)*255)).join(',')+')';}
  function softwareSky(ctx,width,height,axes,tan,environment,time){
    const {right,up,forward}=axes,focal=height/(2*tan),span=Math.hypot(right[1],up[1])||1;
    const ux=right[1]/span,uy=-up[1]/span,offset=-forward[1]*focal/span;
    const hx=width*.5+ux*offset,hy=height*.5+uy*offset;
    const gradient=ctx.createLinearGradient(hx+ux*height,hy+uy*height,hx-ux*height*.15,hy-uy*height*.15);
    gradient.addColorStop(0,skyColor(environment.skyTop));gradient.addColorStop(.84,skyColor(environment.skyBottom));gradient.addColorStop(1,skyColor(environment.fog,.85));
    ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
    const projectDirection=d=>{const z=d[0]*forward[0]+d[1]*forward[1]+d[2]*forward[2];return z>.03?[width*.5+(d[0]*right[0]+d[1]*right[1]+d[2]*right[2])*focal/z,height*.5-(d[0]*up[0]+d[1]*up[1]+d[2]*up[2])*focal/z,z]:null;};
    const sun=projectDirection(environment.sunDirection);
    if(sun){
      const radius=Math.max(4,focal*.022/sun[2]),glow=ctx.createRadialGradient(sun[0],sun[1],radius*.2,sun[0],sun[1],radius*7);
      glow.addColorStop(0,'rgba(255,233,179,.70)');glow.addColorStop(1,'rgba(255,232,182,0)');
      ctx.fillStyle=glow;ctx.fillRect(sun[0]-radius*7,sun[1]-radius*7,radius*14,radius*14);
      ctx.beginPath();ctx.arc(sun[0],sun[1],radius,0,Math.PI*2);ctx.fillStyle=skyColor(environment.sunColor,5);ctx.fill();
    }
    // Clouds occupy stable directions in the sky; walking never drags them with the camera.
    for(let i=0;i<20;i++){
      const angle=i*2.399963+time*.0008*environment.wind,elevation=.16+(.5+.5*Math.sin(i*5.17))*.52;
      const d=[Math.sin(angle),elevation,-Math.cos(angle)],cloud=projectDirection(d);if(!cloud)continue;
      const size=focal*(.075+(.5+.5*Math.sin(i*3.1))*.08)/cloud[2];
      if(cloud[0]<-size*3||cloud[0]>width+size*3||cloud[1]<-size||cloud[1]>height+size)continue;
      ctx.save();ctx.translate(cloud[0],cloud[1]);ctx.rotate(Math.atan2(right[1],up[1]));ctx.scale(2.6,1);
      const haze=ctx.createRadialGradient(0,0,0,0,0,size);haze.addColorStop(0,'rgba(247,249,234,.27)');haze.addColorStop(.5,'rgba(247,249,234,.19)');haze.addColorStop(1,'rgba(247,249,234,0)');
      ctx.fillStyle=haze;ctx.fillRect(-size,-size,size*2,size*2);ctx.restore();
    }
    // A yaw-stable panorama continues behind the actual trees, cliffs and buildings.
    for(let layer=0;layer<2;layer++){
      const points=[];
      for(let x=-width*.25;x<=width*1.25;x+=width/48){
        const lateral=(x-width*.5)/focal,dx=forward[0]+right[0]*lateral,dz=forward[2]+right[2]*lateral,angle=Math.atan2(dx,-dz);
        const ridge=(layer?-.018:.026)+(.5+.5*Math.sin(angle*7.3+layer*5))*.035+(.5+.5*Math.sin(angle*17.1+2))*.022;
        const point=projectDirection([Math.sin(angle),ridge,-Math.cos(angle)]);if(point)points.push(point);
      }
      if(points.length>1){ctx.beginPath();ctx.moveTo(points[0][0],height*3);for(const p of points)ctx.lineTo(p[0],p[1]);ctx.lineTo(points[points.length-1][0],height*3);ctx.closePath();ctx.fillStyle=skyColor(environment.fog,layer?.8:1.12);ctx.fill();}
    }
  }

  // CPU fallback: actual transformed polygons, perspective projection and near clipping.
  // It intentionally has fewer facets and a shorter draw distance than the GPU renderer.
  function createSoftware(canvas) {
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx) throw new Error('Le rendu graphique est indisponible dans ce navigateur.');
    const base={},coarseBase={},palette=[[.105,.135,.15],[.36,.18,.065],[.13,.16,.17],[.57,.58,.54],[.025,.74,.77],[1,.42,.06],[.68,.055,.025],[.065,.075,.085],[.16,.21,.075],[.32,.31,.27],[.18,.10,.04],[.105,.255,.055],[.035,.12,.15]];
    const stats={backend:'canvas2d',webglVersion:0,drawCalls:0,triangles:0,instances:0,contextLost:false,bloom:false,shadows:false};
    // Couleurs de nuance mémoïsées : 'rgb(r,g,b)' ne dépend que de (r,g,b).
    const shadeCache=new Map();
    // Tampons de sommets réutilisés d'une face à l'autre (rien n'est retenu ici :
    // les écrans conservés viennent de project(), jamais de ces tampons).
    const vertexScratch=[],projectScratch=[],faceScratch=[];
    let world=spatialIndex([]),lights=[],environment=null,quality='auto',disposed=false,vignette=null,shadowGeometry=new WeakMap(),explicitGround=false,staticCasterPlan=null,worldRevision=0;
    const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
    const same=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])<.00001;
    function normal(v) {
      const a=subtract(v[1],v[0]),b=subtract(v[2],v[0]);
      const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n)||1;
      return n.map(x=>x/length);
    }
    function merge(a,b) {
      if(dot(normal(a),normal(b))<.99999) return null;
      const edges=[];
      for(const v of [a,b]) for(let j=0;j<3;j++) edges.push([v[j],v[(j+1)%3]]);
      const boundary=edges.filter(e=>!edges.some(f=>e!==f&&same(e[0],f[1])&&same(e[1],f[0])));
      if(boundary.length!==4)return null;
      const v=[boundary[0][0]];let tip=boundary[0][1];
      for(let j=0;j<3;j++){v.push(tip);const next=boundary.find(e=>same(e[0],tip));if(!next)return null;tip=next[1];}
      return same(tip,v[0])?v:null;
    }
    for(const [source,shapes] of [[geometry(true),base],[geometry(2),coarseBase]]){
      for(const shape of names) {
        const range=source.ranges[shape],triangles=[];
        for(let j=range.offset/2;j<range.offset/2+range.count;j+=3){
          const v=[];for(let k=0;k<3;k++){const at=source.indices[j+k]*6;v.push(Array.from(source.vertices.subarray(at,at+3)));}triangles.push(v);
        }
        shapes[shape]=[];
        for(let j=0;j<triangles.length;j++){
          const quad=j+1<triangles.length?merge(triangles[j],triangles[j+1]):null;
          shapes[shape].push(quad||triangles[j]);if(quad)j++;
        }
        if(shape==='cylinder'){
          // A planar cap is one polygon, not a fan of separately shaded triangles.
          for(const sign of [-1,1]){
            const vertices=[];for(const face of shapes[shape])if(normal(face)[1]*sign>.999)for(const p of face)if(Math.hypot(p[0],p[2])>.49&&!vertices.some(v=>same(v,p)))vertices.push(p);
            vertices.sort((a,b)=>Math.atan2(a[2],a[0])-Math.atan2(b[2],b[0]));if(normal(vertices)[1]*sign<0)vertices.reverse();
            shapes[shape]=shapes[shape].filter(face=>normal(face)[1]*sign<.999);shapes[shape].push(vertices);
          }
        }
        // Weld the mathematical primitive once. Moving actors reuse topology
        // instead of rebuilding string-keyed vertex maps for every mesh/frame.
        const faces=shapes[shape],vertices=[],keys=new Map(),indices=faces.map(face=>face.map(p=>{
          const key=p.map(v=>Math.round(v*100000)).join(',');
          if(!keys.has(key)){keys.set(key,vertices.length);vertices.push(p);}return keys.get(key);
        }));
        shapes[shape]={faces,vertices,indices};
      }
    }
    function cache(mesh,staticLighting=false,coarse=false,objects=false) {
      const p=mesh.p||[0,0,0],s=mesh.s||[1,1,1],r=mesh.r||[0,0,0],c=r.map(Math.cos),sn=r.map(Math.sin);
      function transform(v){
        let x=v[0]*s[0],y=v[1]*s[1],z=v[2]*s[2];
        if(mesh.fx&&mesh.shape==='ring'&&Number.isFinite(mesh.innerRatio)){
          const radial=Math.hypot(v[0],v[2]),side=Math.max(0,Math.min(1,(radial-.37)/.13)),inner=Math.max(0,Math.min(.999,mesh.innerRatio)),scale=(inner*.5+(.5-inner*.5)*side)/Math.max(radial,.0001);x*=scale;z*=scale;
        }
        [y,z]=[c[0]*y-sn[0]*z,sn[0]*y+c[0]*z];
        [x,z]=[c[1]*x+sn[1]*z,-sn[1]*x+c[1]*z];
        return [c[2]*x-sn[2]*y+p[0],sn[2]*x+c[2]*y+p[1],z+p[2]];
      }
      const mat=Math.max(0,Math.min(12,Math.floor(mesh.mat||0))),outdoor=outdoorMesh(mesh,environment),color=mesh.color?(mat<4?mesh.color.map(v=>v*.65):mat>=8?mesh.color.map((v,k)=>v*.65+palette[mat][k]*.35):mesh.color):palette[mat],shape=mesh.shape||'box';
      const object=surfaceFlags(mesh,environment,objects)>=4;
      const emission=(mesh.emissive||0)+(mat===4?.72:mat===5?.68:mat===6?.18:0);
      const shapeSet=coarse?coarseBase:base,template=shapeSet[shape]||shapeSet.box,vertices=template.vertices.map(transform),faces=template.faces.map((v,index)=>{
        const indices=template.indices[index],points=indices.map(i=>vertices[i]),n=normal(points),center=[0,0,0];
        for(const q of points)for(let k=0;k<3;k++)center[k]+=q[k]/points.length;
        const surface=object?[0,0,0]:center;
        if(object)for(const q of v)for(let k=0;k<3;k++)surface[k]+=q[k]*s[k]/v.length;
        const grain=.9+Math.abs(Math.sin(surface[0]*91.17+surface[1]*17.3+surface[2]*51.79))*.13;
        // Explicit receivers include terraces, ramps and moving lift decks. Keep
        // the original zero-level inference for older, unmarked scene fixtures.
        const lines=[],ground=!object&&(mesh.ground===true?n[1]>.55:!explicitGround&&mesh.ground!==false&&n[1]>.98&&(mat===2||mat===8||mat===9||mat===12)&&Math.abs(center[1])<.08),plane=dot(n,center);
        if(!object&&shape==='box'&&points.length===4&&mat<4){
          if(ground){
            // Intersect world-aligned seams with the face edges: interpolation
            // keeps every endpoint on sloping and rotated floor polygons.
            for(const axis of [0,2]){
              const coords=points.map(v=>v[axis]),lo=Math.min(...coords),hi=Math.max(...coords);
              for(let value=Math.ceil(lo/2)*2;value<hi;value+=2){
                const hits=[];
                for(let i=0;i<points.length;i++){
                  const a=points[i],b=points[(i+1)%points.length];
                  if((a[axis]<=value)!==(b[axis]<=value)){const t=(value-a[axis])/(b[axis]-a[axis]);hits.push(a.map((x,k)=>x+(b[k]-x)*t));}
                }
                if(hits.length===2)lines.push(hits);
              }
            }
          }else{
            const a=subtract(points[1],points[0]),b=subtract(points[3],points[0]);
            const na=Math.min(12,Math.floor(Math.hypot(...a)/2)),nb=Math.min(12,Math.floor(Math.hypot(...b)/2));
            for(let i=1;i<na;i++)lines.push([points[0].map((x,k)=>x+a[k]*i/na),points[3].map((x,k)=>x+a[k]*i/na)]);
            for(let i=1;i<nb;i++)lines.push([points[0].map((x,k)=>x+b[k]*i/nb),points[1].map((x,k)=>x+b[k]*i/nb)]);
          }
        }
        let fixedLight=null,fixedLampParts=null;
        if(staticLighting){
          fixedLampParts=[];
          fixedLight=(outdoor?environment.ambient:[.10,.13,.15]).map(v=>v*(.72+.28*Math.max(outdoor?0:-1,n[1])));
          const sun=outdoor?Math.max(0,dot(n,environment.sunDirection)):Math.max(0,(-.45*n[0]+.85*n[1]+.35*n[2])/1.022)*.13;
          for(let k=0;k<3;k++)fixedLight[k]+=sun*(outdoor?environment.sunColor[k]:1);
          const nearby=lights.map(light=>({light,d:(light.p[0]-center[0])**2+(light.p[1]-center[1])**2+(light.p[2]-center[2])**2})).sort((a,b)=>a.d-b.d).slice(0,4);
          for(const {light,d} of nearby){const vector=subtract(light.p,center),power=(light.power===undefined?1:light.power)*.24/(1+d*.26)*(Math.max(0,dot(n,vector)/(Math.sqrt(d)||.001))+.035),c=light.color||[1,1,1];for(let k=0;k<3;k++)fixedLight[k]+=power*c[k];fixedLampParts.push(light,power);}
        }
        return {points,indices,n,center,plane,grain,lines,color,emission,mat,ground,fixedLight,fixedLampParts,outdoor,region:mesh.region,overlay:!!mesh.overlay,fx:!!mesh.fx,fxFire:!!mesh.fxFire,fxHazard:mesh.fxPriority==='hazard',alpha:mesh.fx?Math.min(1,Math.max(0,mesh.alpha||0)):1};
      });
      return {p,radius:Math.hypot(...s)*.5,faces,vertices,sway:mat===11,s};
    }
    function setWorld(meshes,points,atmosphere){
      environment=environmentInfo(atmosphere);world=spatialIndex(meshes||[],environment);lights=points||[];
      explicitGround=(meshes||[]).some(mesh=>mesh.ground===true);
      shadowGeometry=new WeakMap();staticCasterPlan=null;for(const e of world.entries)shadowGeometry.set(e.mesh,null);
      worldRevision=0;stats.worldRevision=0;stats.staticTotal=world.entries.length;stats.biome=environment?environment.biome:null;
    }
    function updateWorld(meshes,revision,points,delta){
      if(disposed||revision===worldRevision&&!delta?.full)return false;
      const previousLights=lights,changedLights=Array.isArray(points)&&(points.length!==lights.length||points.some((light,i)=>light!==lights[i]));
      if(changedLights)lights=points;
      const next=meshes||[],ground=next.some(mesh=>mesh.ground===true);world=spatialIndex(next,environment,delta?.full?null:world,delta);
      // Fixed Canvas lighting uses the nearest FOUR lamps, with no hard range
      // cutoff. Retire exactly the cached faces whose lamp dependencies change.
      const removed=changedLights?new Set(previousLights.filter(light=>!lights.includes(light))):null;
      const reordered=changedLights&&previousLights.filter(light=>lights.includes(light)).some((light,i)=>light!==lights.filter(l=>previousLights.includes(l))[i]);
      const additions=changedLights&&(reordered||lights.some(light=>!previousLights.includes(light)));
      function stale(object){
        if(!object)return false;
        return object.faces.some(face=>{
          const parts=face.fixedLampParts;if(!parts)return false;
          if(parts.some((light,i)=>i%2===0&&removed.has(light)))return true;
          if(!additions)return false;
          const p=face.center,nearby=lights.map(light=>({light,d:(light.p[0]-p[0])**2+(light.p[1]-p[1])**2+(light.p[2]-p[2])**2})).sort((a,b)=>a.d-b.d).slice(0,4);
          return nearby.length*2!==parts.length||nearby.some(({light},i)=>light!==parts[i*2]);
        });
      }
      for(const e of world.entries){
        if(ground!==explicitGround||changedLights&&(stale(e.software)||stale(e.softwareCoarse)))e.software=e.softwareCoarse=null;
        if(e.created===world.generation||!shadowGeometry.has(e.mesh))shadowGeometry.set(e.mesh,null);
      }
      explicitGround=ground;
      if(staticCasterPlan&&changedSelection(world,staticCasterPlan.eye,[environment?25:13,13,0]))staticCasterPlan=null;
      worldRevision=revision===undefined?worldRevision+1:revision;stats.worldRevision=worldRevision;stats.staticTotal=world.entries.length;
      return true;
    }
    function resize(next){
      if(next!==undefined)quality=next;
      const cssWidth=canvas.clientWidth||window.innerWidth||800,cssHeight=canvas.clientHeight||window.innerHeight||600;
      const requested=typeof quality==='number'?Math.max(.5,Math.min(1.5,quality)):quality==='low'?.8:quality==='high'?1.25:1;
      const limit=quality==='low'?[720,480]:quality==='high'?[1280,900]:[1024,720];
      const ratio=Math.min(requested,limit[0]/cssWidth,limit[1]/cssHeight);
      const width=Math.max(1,Math.round(cssWidth*ratio)),height=Math.max(1,Math.round(cssHeight*ratio));
      if(canvas.width!==width||canvas.height!==height||!vignette){
        canvas.width=width;canvas.height=height;
        vignette=ctx.createRadialGradient(width*.5,height*.47,height*.15,width*.5,height*.5,Math.hypot(width,height)*.58);
        vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,5,12,.47)');
      }
      stats.renderScale=1;stats.pixelRatio=ratio;stats.width=width;stats.height=height;
      return {width,height,ratio};
    }
    function clip(points,depth,greater,limit){
      const end=limit===undefined?points.length:limit,result=[];let previous=points[end-1],prevInside=greater?previous[2]>=depth:previous[2]<=depth;
      for(let index=0;index<end;index++){
        const p=points[index];
        const inside=greater?p[2]>=depth:p[2]<=depth;
        if(inside!==prevInside){const t=(depth-previous[2])/(p[2]-previous[2]);result.push([previous[0]+(p[0]-previous[0])*t,previous[1]+(p[1]-previous[1])*t,depth]);}
        if(inside)result.push(p);previous=p;prevInside=inside;
      }
      return result;
    }
    function screenBounds(points){
      const b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of points){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b;
    }
    const overlap=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
    function clipScreenLine(points,a,b,c){
      const side=p=>a*p[0]+b*p[1]+c,result=[];let previous=points[points.length-1],before=side(previous);
      for(const p of points){const after=side(p);if((before>=0)!==(after>=0)){const t=before/(before-after);result.push([previous[0]+(p[0]-previous[0])*t,previous[1]+(p[1]-previous[1])*t]);}if(after>=0)result.push(p);previous=p;before=after;}
      return result;
    }
    function draw(camera,dynamic,fx){
      if(disposed)return;resize();fx=fx||{};
      const width=canvas.width,height=canvas.height,t=fx.time||0,shake=fx.shake||0,p=camera.pos||[0,1.6,0];
      const eye=[p[0]+Math.sin(t*57)*shake*.025,p[1]+Math.sin(t*71)*shake*.015,p[2]];
      const axes=cameraAxes(camera),{right,up,forward}=axes;
      const fov=Math.max(40,Math.min(110,camera.fov||75))*Math.PI/180,tan=Math.tan(fov*.5),focal=height/(2*tan),horizontal=tan*width/height;
      const near=.065,far=softwareDistance(quality,environment,eye);stats.viewDistance=far;
      const toCamera=v=>{const x=v[0]-eye[0],y=v[1]-eye[1],z=v[2]-eye[2];return [x*right[0]+y*right[1]+z*right[2],x*up[0]+y*up[1]+z*up[2],x*forward[0]+y*forward[1]+z*forward[2]];};
      const toCameraInto=(x,y,z,out)=>{const dx=x-eye[0],dy=y-eye[1],dz=z-eye[2];out[0]=dx*right[0]+dy*right[1]+dz*right[2];out[1]=dx*up[0]+dy*up[1]+dz*up[2];out[2]=dx*forward[0]+dy*forward[1]+dz*forward[2];};
      const project=v=>[width*.5+v[0]*focal/v[2],height*.5-v[1]*focal/v[2]];
      function projectPolygon(points){
        let transformed=points.map(toCamera);if(transformed.length<3||transformed.every(v=>v[2]<near)||transformed.every(v=>v[2]>far))return [];
        if(transformed.some(v=>v[2]<near))transformed=clip(transformed,near,true);
        if(transformed.length&&transformed.some(v=>v[2]>far))transformed=clip(transformed,far,false);
        return transformed.length>2?transformed.map(project):[];
      }
      const nearest=lights.map(light=>({light,d:dot(subtract(light.p,eye),subtract(light.p,eye))})).sort((a,b)=>a.d-b.d).slice(0,quality==='low'?4:6).map(entry=>entry.light);
      const transient=transientLights(fx.lights,eye,quality==='low'?1:2);stats.dynamicLights=transient.length;
      const blackout=horrorLights(fx.horror,lights);stats.blackoutLights=blackout?.size||0;
      const faces=[],overlays=[],grounds=[];
      stats.drawCalls=0;stats.triangles=0;stats.instances=0;
      function inView(position,r){
        const center=toCamera(position);
        return !(center[2]+r<near||center[2]-r>far||Math.abs(center[0])>center[2]*horizontal+r*(1+horizontal)||Math.abs(center[1])>center[2]*tan+r*(1+tan));
      }
      function collect(object){
        const objectFocal=object.faces[0]?.overlay&&camera.overlayFov?height/(2*Math.tan(Math.max(40,Math.min(110,camera.overlayFov))*Math.PI/360)):focal;
        const project=v=>[width*.5+v[0]*objectFocal/v[2],height*.5-v[1]*objectFocal/v[2]];
        if(!inView(object.p,object.radius))return;
        stats.instances++;
        const phase=t*.85+object.p[0]*.37+object.p[2]*.21,bend=object.sway&&environment?environment.wind*.055:0;
        const source=object.vertices,vertexCount=source.length,originY=object.p[1],objectHeight=Math.max(.01,object.s[1]);
        while(vertexScratch.length<vertexCount)vertexScratch.push([0,0,0]);
        while(projectScratch.length<vertexCount)projectScratch.push(null);
        const bendX=Math.sin(phase)*bend,bendZ=Math.cos(phase*.73)*bend*.6;
        for(let i=0;i<vertexCount;i++){
          const v=source[i],slot=vertexScratch[i];
          if(bend){const weight=Math.max(0,Math.min(1,(v[1]-originY)/objectHeight+.5));toCameraInto(v[0]+bendX*weight,v[1],v[2]+bendZ*weight,slot);}
          else toCameraInto(v[0],v[1],v[2],slot);
          const depth=vertexScratch[i][2];projectScratch[i]=depth>=near&&depth<=far?project(vertexScratch[i]):null;
        }
        for(const face of object.faces){
          if(dot(face.n,subtract(eye,face.center))<=.00001)continue;
          const indices=face.indices,indexCount=indices.length;
          let allNear=true,allFar=true;
          for(let i=0;i<indexCount;i++){const depth=vertexScratch[indices[i]][2];if(depth>=near)allNear=false;if(depth<=far)allFar=false;}
          if(allNear||allFar)continue;
          let points=faceScratch,count=indexCount,clipped=false,anyNear=false,anyFar=false;
          for(let i=0;i<indexCount;i++){const v=vertexScratch[indices[i]];faceScratch[i]=v;if(v[2]<near)anyNear=true;if(v[2]>far)anyFar=true;}
          if(anyNear){points=clip(points,near,true,count);count=points.length;clipped=true;if(count<3)continue;}
          if(anyFar){points=clip(points,far,false,count);count=points.length;clipped=true;if(count<3)continue;}
          const screen=[];
          if(clipped)for(let i=0;i<count;i++)screen.push(project(points[i]));
          else for(let i=0;i<indexCount;i++)screen.push(projectScratch[indices[i]]);
          let offLeft=true,offRight=true,offTop=true,offBottom=true;
          for(let i=0;i<screen.length;i++){const v=screen[i];if(v[0]>=-2)offLeft=false;if(v[0]<=width+2)offRight=false;if(v[1]>=-2)offTop=false;if(v[1]<=height+2)offBottom=false;}
          if(offLeft||offRight||offTop||offBottom)continue;
          let sum=0;for(let i=0;i<count;i++)sum+=points[i][2];
          (face.overlay?overlays:face.ground?grounds:faces).push({face,screen,depth:sum/count,bounds:screenBounds(screen),ground:face.ground===true,plane:face.plane,n0:face.n[0],n1:face.n[1],n2:face.n[2]});
        }
      }
      const ranges=detailRanges(quality,true),tiers=[[],[],[]];if(environment)ranges[0]=far;let staticVisible=0;
      for(const e of world.query(eye,ranges,null,{axes,horizontal,vertical:tan,far}))if(visible(e,eye,axes,horizontal,tan,far)){
        const delta=subtract(e.p,eye),distance=Math.hypot(...delta),pixelRadius=e.radius*focal/Math.max(.2,dot(delta,forward));
        if(e.detail>0&&pixelRadius<(e.detail===2?2.1:1.0))continue;
        tiers[e.detail].push({e,pixelRadius,score:distance/(1+Math.min(e.radius,3)*.32)});
      }
      const budget=quality==='low'?[Infinity,80,0]:quality==='high'?[Infinity,360,120]:[Infinity,170,45];
      for(let level=0;level<3;level++){
        if(level)tiers[level].sort((a,b)=>a.score-b.score);
        for(const {e,pixelRadius} of tiers[level].slice(0,budget[level])){
          const key=quality!=='high'&&(quality==='low'||pixelRadius<75)?'softwareCoarse':'software';
          if(!e[key])e[key]=cache(e.mesh,true,key==='softwareCoarse');collect(e[key]);staticVisible++;
        }
      }
      stats.staticVisible=staticVisible;stats.staticCulled=world.entries.length-staticVisible;
      for(const mesh of dynamic||[]){
        const p=mesh.p||[0,0,0],radius=Math.hypot(...(mesh.s||[1,1,1]))*.5;
        if(inView(p,radius)){const pixelRadius=radius*focal/Math.max(.2,dot(subtract(p,eye),forward)),coarse=!mesh.overlay&&quality!=='high'&&(quality==='low'||pixelRadius<28);collect(cache(mesh,false,coarse,true));}
      }
      const receivers=new Map(),regionPlanes=new Map();
      for(const item of grounds){
        const {face,bounds}=item,key=face.n.map(v=>Math.round(v*10000)).join(',')+','+Math.round(face.plane*10000)+','+face.outdoor;
        let receiver=receivers.get(key);
        if(!receiver){receiver={n:face.n,plane:face.plane,outdoor:face.outdoor,items:[],shadows:[],bounds:bounds.slice(),regions:new Set()};receivers.set(key,receiver);}
        receiver.items.push(item);item.receiver=receiver;
        if(face.region){
          receiver.regions.add(face.region);if(!regionPlanes.has(face.region))regionPlanes.set(face.region,new Set());
          regionPlanes.get(face.region).add(face.n.map(v=>Math.round(v*1000)).join(',')+','+Math.round(face.plane*10));
        }
        for(let i=0;i<4;i++)receiver.bounds[i]=i<2?Math.min(receiver.bounds[i],bounds[i]):Math.max(receiver.bounds[i],bounds[i]);
      }
      if(receivers.size&&(nearest.length||environment)&&quality!=='low'&&fx.shadows!==false){
        const candidates=staticCasters(eye).concat((dynamic||[]).filter(m=>!m.overlay&&shadowCaster(m)))
          .sort((a,b)=>Math.hypot(a.p[0]-eye[0],a.p[2]-eye[2])-Math.hypot(b.p[0]-eye[0],b.p[2]-eye[2])).slice(0,environment?28:18);
        const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
        const casters=[];
        for(const m of candidates){
          const outdoor=outdoorMesh(m,environment),vertices=[];
          // Only setWorld geometry is immutable; reused dynamic meshes may have moved.
          let object=shadowGeometry.get(m);if(!object){object=cache(m,false,true);if(shadowGeometry.has(m))shadowGeometry.set(m,object);}
          const phase=t*.85+object.p[0]*.37+object.p[2]*.21,bend=object.sway&&environment?environment.wind*.055:0;
          for(const [x,py,z] of object.vertices){
            const weight=Math.max(0,Math.min(1,(py-object.p[1])/Math.max(.01,object.s[1])+.5)),px=x+Math.sin(phase)*bend*weight,pz=z+Math.cos(phase*.73)*bend*.6*weight;
            vertices.push([px,py,pz]);
          }
          casters.push({outdoor,vertices,heightLimit:m.actorScale>1?44:16});
        }
        for(const receiver of receivers.values()){
          const {n,plane,outdoor}=receiver,sun=environment&&environment.sunDirection,lamp=outdoor?null:nearest.find(light=>dot(n,light.p)-plane>1.2),sunHeight=sun?dot(n,sun):0;
          if(outdoor?sunHeight<=.05:!lamp)continue;
          const sourceHeight=lamp?dot(n,lamp.p)-plane:0;
          for(const caster of casters){
            if(caster.outdoor!==outdoor)continue;
            const heights=caster.vertices.map(v=>dot(n,v)-plane),top=Math.max(...heights);
            if(top<.025||(outdoor?top>caster.heightLimit:top>=sourceHeight-.15))continue;
            const vertices=[];
            for(let i=0;i<caster.vertices.length;i++){
              if(heights[i]<-.025)continue;
              const v=caster.vertices[i],height=heights[i];
              if(outdoor){const amount=height/sunHeight;vertices.push(v.map((x,k)=>x-sun[k]*amount));}
              else{const amount=sourceHeight/(sourceHeight-height);if(amount<=7)vertices.push(v.map((x,k)=>lamp.p[k]+(x-lamp.p[k])*amount));}
            }
            if(vertices.length<3)continue;
            vertices.sort((a,b)=>a[0]-b[0]||a[2]-b[2]);const hull=[];
            for(const v of vertices){while(hull.length>1&&cross(hull[hull.length-2],hull[hull.length-1],v)<=0)hull.pop();hull.push(v);}
            const lower=hull.length;for(let i=vertices.length-2;i>=0;i--){const v=vertices[i];while(hull.length>lower&&cross(hull[hull.length-2],hull[hull.length-1],v)<=0)hull.pop();hull.push(v);}hull.pop();
            const polygon=projectPolygon(hull);if(polygon.length>2){const bounds=screenBounds(polygon);if(overlap(bounds,receiver.bounds))receiver.shadows.push({polygon,bounds});}
          }
        }
      }
      stats.shadows=Array.from(receivers.values()).some(receiver=>receiver.shadows.length);stats.shadowMode='projected';
      ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle='#14252e';ctx.fillRect(0,0,width,height);
      if(environment)softwareSky(ctx,width,height,axes,tan,environment,t);
      function shade(face){
        const n=face.n,toEye=subtract(eye,face.center),distance=Math.hypot(...toEye)||.001;
        const lit=face.fixedLight?face.fixedLight.slice():(face.outdoor?environment.ambient:[.10,.13,.15]).map(c=>c*(.72+.28*Math.max(face.outdoor?0:-1,n[1])));
        // Dim real local lamp contributions, never a painted dark patch or the
        // sky/torch/emergency emission. Cached light components stay reusable.
        if(blackout&&face.fixedLampParts&&!face.overlay&&!face.fxHazard)for(let i=0;i<face.fixedLampParts.length;i+=2){
          const light=face.fixedLampParts[i],drop=1-(blackout.get(light)??1),color=light.color||[1,1,1];
          if(drop)for(let k=0;k<3;k++)lit[k]-=face.fixedLampParts[i+1]*color[k]*drop;
        }
        const sun=face.outdoor?Math.max(0,dot(n,environment.sunDirection)):Math.max(0,(-.45*n[0]+.85*n[1]+.35*n[2])/1.022)*.13;
        const head=Math.max(0,dot(n,toEye)/distance)*.35/(1+distance*distance*.035);
        for(let k=0;k<3;k++)lit[k]+=(face.fixedLight?0:sun*(face.outdoor?environment.sunColor[k]:1))+head*(k===0?.8:1)+(face.overlay?.2:0)+(fx.flash||0)*.65/(1+distance*distance*.14);
        for(const light of face.fixedLight?[]:nearest){
          const l=subtract(light.p,face.center),d2=dot(l,l),d=Math.sqrt(d2)||.001;
          const factor=!face.overlay&&!face.fxHazard?blackout?.get(light)??1:1;
          const power=(light.power===undefined?1:light.power)*factor*.24/(1+d2*.26)*(Math.max(0,dot(n,l)/d)+.065),color=light.color||[1,1,1];
          for(let k=0;k<3;k++)lit[k]+=power*color[k];
        }
        for(const light of transient){
          const dx=light.p[0]-face.center[0],dy=light.p[1]-face.center[1],dz=light.p[2]-face.center[2],d2=dx*dx+dy*dy+dz*dz;
          if(d2>=light.range*light.range)continue;
          const d=Math.sqrt(d2)||.001,q=Math.max(0,Math.min(1,(d/light.range-.35)/.65)),falloff=1-q*q*(3-2*q);
          const power=light.power*.24*falloff/(1+d2*.26)*(Math.max(0,(n[0]*dx+n[1]*dy+n[2]*dz)/d)+.035);
          for(let k=0;k<3;k++)lit[k]+=power*light.color[k];
        }
        let reflection=null;
        if(face.mat<3||face.mat===12){
          const nv=Math.max(0,dot(n,toEye)/distance),ry=-toEye[1]/distance+2*nv*n[1],roughness=[.48,.60,.35][face.mat]||.13;
          const skyMix=Math.max(0,Math.min(1,ry)),hemisphere=Math.max(0,Math.min(1,(ry+.45)/1.2));
          const strength=(.04+.35*(1-nv)**5)*(.45+.8*(1-roughness));
          reflection=[0,1,2].map(k=>{
            const sky=face.outdoor?environment.skyBottom[k]*(1-skyMix)+environment.skyTop[k]*skyMix:[.18,.24,.27][k];
            const ground=face.outdoor?environment.ambient[k]*.2:[.02,.03,.035][k];
            return (ground*(1-hemisphere)+sky*hemisphere)*strength;
          });
        }
        const fog=face.overlay?0:Math.min(.9,1-Math.exp(-distance*(face.outdoor?environment.fogDensity:.027))),fogColor=face.outdoor?environment.fog:[.009,.018,.024];
        const flicker=.94+.06*Math.sin(t*2.2+face.center[1]*3),flickerFire=.72+.28*Math.sin(face.center[0]*5.3+face.center[1]*7.1-face.center[2]*3.7-t*11.),keep=1-fog;
        let red=0,green=0,blue=0;
        for(let k=0;k<3;k++){
          let color=face.color[k]*(lit[k]*face.grain+face.emission*1.55*flicker);
          if(reflection)color+=reflection[k];
          if(face.fxFire)color*=flickerFire;
          color=color*keep+fogColor[k]*fog;
          const value=Math.round(Math.pow(Math.max(0,color)/(Math.max(0,color)+.76),.4545)*255);
          if(k===0)red=value;else if(k===1)green=value;else blue=value;
        }
        const shadeKey=(red<<16)|(green<<8)|blue,memoized=shadeCache.get(shadeKey);
        if(memoized!==undefined)return memoized;
        if(shadeCache.size>8192)shadeCache.clear();
        const shadeText='rgb('+red+','+green+','+blue+')';shadeCache.set(shadeKey,shadeText);return shadeText;
      }
      function line(a,b){
        let va=toCamera(a),vb=toCamera(b);
        if((va[2]<near&&vb[2]<near)||(va[2]>far&&vb[2]>far))return;
        for(const depth of [near,far]){
          const aInside=depth===near?va[2]>=depth:va[2]<=depth,bInside=depth===near?vb[2]>=depth:vb[2]<=depth;
          if(aInside!==bInside){const fraction=(depth-va[2])/(vb[2]-va[2]),hit=va.map((x,k)=>x+(vb[k]-x)*fraction);if(!aInside)va=hit;else vb=hit;}
        }
        const a2=project(va),b2=project(vb);ctx.moveTo(a2[0],a2[1]);ctx.lineTo(b2[0],b2[1]);
      }
      function polygonPath(points){ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();}
      function maskGround(item){
        let saved=false;
        // Large ground polygons must still be painted first (their mean depth
        // can lie in front of a nearby actor). Mask only the part of a later
        // face behind a visible receiver plane, within that finite floor. This
        // gives terraces/ramps real occlusion without inverting the base floor.
        for(const receiver of receivers.values()){
          if(receiver===item.receiver||!overlap(item.bounds,receiver.bounds))continue;
          // Dressing built onto one floor already shares its elevation. Avoid
          // hundreds of clips for embedded roots/stone and thin trail inlays.
          // Multi-level regions (lift shafts) keep full plane occlusion.
          if(item.face.fixedLight&&item.face.region&&regionPlanes.get(item.face.region)?.size===1&&receiver.regions.has(item.face.region))continue;
          const points=item.face.points,pointCount=points.length;let lowest=Infinity,highest=-Infinity;
          for(let i=0;i<pointCount;i++){const height=dot(receiver.n,points[i])-receiver.plane;if(height<lowest)lowest=height;if(height>highest)highest=height;}
          if(lowest>=-.002)continue;
          const crossing=highest>-.002,eyeFloor=dot(receiver.n,eye)-receiver.plane,eyeFace=dot(item.face.n,eye)-item.face.plane;
          // On this face, the intersection of the two 3D planes is a screen
          // line. Extend that line across the receiver instead of clipping at
          // actor edges, where antialiased clip boundaries would leave a halo.
          const separator=crossing?item.face.n.map((v,k)=>v*eyeFloor-receiver.n[k]*eyeFace):null;
          const a=crossing?dot(separator,right)/focal:0,b=crossing?-dot(separator,up)/focal:0,c=crossing?dot(separator,forward)-a*width*.5-b*height*.5:0;
          for(const ground of receiver.items){
            if(!overlap(item.bounds,ground.bounds))continue;
            const hidden=crossing?clipScreenLine(ground.screen,a,b,c):ground.screen;if(hidden.length<3)continue;
            if(!saved){ctx.save();saved=true;}
            ctx.beginPath();ctx.rect(0,0,width,height);polygonPath(hidden);ctx.clip('evenodd');
          }
        }
        return saved;
      }
      function paint(list){
        list.sort((a,b)=>a.ground&&b.ground&&a.n0*b.n0+a.n1*b.n1+a.n2*b.n2>.99999&&Math.abs(a.plane-b.plane)<.05?a.plane-b.plane:b.depth-a.depth);
        for(const item of list){
          const {face,screen,depth}=item,masked=!face.overlay&&maskGround(item);ctx.beginPath();polygonPath(screen);
          if(face.fx){const v=subtract(eye,face.center);ctx.globalAlpha=face.alpha*(face.fxHazard?1:Math.pow(Math.max(0,dot(face.n,v)/(Math.hypot(...v)||1)),.65));}
          ctx.fillStyle=shade(face);ctx.fill();if(face.fx)ctx.globalAlpha=1;stats.drawCalls++;stats.triangles+=screen.length-2;
          if(item.receiver&&item.receiver.shadows.length){
            ctx.save();ctx.clip();ctx.fillStyle=face.outdoor?'rgba(5,18,23,.27)':'rgba(0,7,11,.24)';
            for(const {polygon,bounds} of item.receiver.shadows)if(overlap(bounds,item.bounds)){ctx.beginPath();polygonPath(polygon);ctx.fill();}ctx.restore();
          }
          // The seams are projected from positions on the actual face, not screen-space stripes.
          // Do not outline individual mesh faces: that reveals triangulation instead of material detail.
          if(face.mat<4&&face.lines.length&&depth<18){
            ctx.beginPath();for(const segment of face.lines)line(segment[0],segment[1]);ctx.strokeStyle=face.ground?'rgba(2,7,10,.22)':'rgba(2,7,10,.32)';ctx.lineWidth=face.ground?.65:1.0;ctx.stroke();
            if(!face.ground&&quality!=='low'&&depth<10){ctx.strokeStyle='rgba(128,180,176,.14)';ctx.lineWidth=.35;ctx.stroke();}
          }
          if(masked)ctx.restore();
        }
      }
      paint(grounds);paint(faces);paint(overlays);
      ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
      if(fx.damage>0){ctx.fillStyle='rgba(190,12,2,'+Math.min(.3,fx.damage*.22)+')';ctx.fillRect(0,0,width,height);}
      if(fx.pulse>0){
        const strength=Math.min(1,fx.pulse),radius=(1-strength)*height*.8;
        ctx.beginPath();ctx.arc(width*.5,height*.5,Math.max(1,radius),0,Math.PI*2);ctx.strokeStyle='rgba(82,248,216,'+(strength*.35)+')';ctx.lineWidth=height*.018;ctx.stroke();
      }
    }
    function shadowCaster(m){
      const s=m.s||[1,1,1],mat=m.mat||0,limit=m.actorPart&&m.actorScale>1?44:10;
      return !m.fx&&(m.shape==='box'||m.shape==='bevel'||m.shape==='cylinder'||m.shape==='sphere'||m.shape==='foliage'||m.shape==='octa')&&s[0]>.45&&s[2]>.45&&s[1]>.4&&s[0]<limit&&s[2]<limit&&(mat<4||mat>7);
    }
    function staticCasters(eye){
      if(staticCasterPlan&&eye.every((v,k)=>v===staticCasterPlan.eye[k]))return staticCasterPlan.meshes;
      const meshes=world.query(eye,[environment?25:13,13,0]).map(e=>e.mesh).filter(shadowCaster)
        .sort((a,b)=>Math.hypot(a.p[0]-eye[0],a.p[2]-eye[2])-Math.hypot(b.p[0]-eye[0],b.p[2]-eye[2])).slice(0,environment?28:18);
      staticCasterPlan={eye:eye.slice(),meshes};return meshes;
    }
    // Dynamic casters can only lower the last selected static caster's distance.
    // Reject an offscreen actor only when its ENTIRE sphere is beyond that
    // bound; the exact original 18/28-caster set and stable ordering survive.
    // Sparse scenes retain every actor that might enter that shadow ranking.
    function actorFilter(camera,fx={}){
      stats.actorsConsidered=stats.actorsCulled=0;
      if(disposed)return ()=>true;
      const t=fx.time||0,shake=fx.shake||0,p=camera.pos||[0,1.6,0],axes=cameraAxes(camera);
      const eye=[p[0]+Math.sin(t*57)*shake*.025,p[1]+Math.sin(t*71)*shake*.015,p[2]];
      const cssWidth=canvas.clientWidth||window.innerWidth||800,cssHeight=canvas.clientHeight||window.innerHeight||600;
      const aspect=Math.max(canvas.width/Math.max(1,canvas.height),cssWidth/cssHeight)+(1+cssWidth/cssHeight)/Math.max(1,cssHeight*.3);
      const tangent=Math.tan(Math.max(40,Math.min(110,camera.fov||75))*Math.PI/360),horizontal=aspect*tangent;
      const far=softwareDistance(quality,environment,eye);
      const shadows=quality!=='low'&&fx.shadows!==false&&(lights.length||environment),casters=shadows?staticCasters(eye):[];
      const cutoff=!shadows?-Infinity:casters.length<(environment?28:18)?Infinity:Math.hypot(casters[casters.length-1].p[0]-eye[0],casters[casters.length-1].p[2]-eye[2]);
      stats.actorFilterMode=shadows?'camera-and-ranked-casters':'camera-frustum';stats.actorCasterDistance=cutoff;
      return (x,y,z,radius)=>{
        stats.actorsConsidered++;
        if(![x,y,z,radius].every(Number.isFinite)||radius<0)return true;
        const dx=x-eye[0],dy=y-eye[1],dz=z-eye[2],r=radius+.002,along=a=>dx*a[0]+dy*a[1]+dz*a[2],depth=along(axes.forward);
        const inView=!(depth+r<.065||depth-r>far||Math.abs(along(axes.right))>depth*horizontal+r*(1+horizontal)||Math.abs(along(axes.up))>depth*tangent+r*(1+tangent));
        if(inView||Math.hypot(dx,dz)-r<=cutoff+.002)return true;
        stats.actorsCulled++;return false;
      };
    }
    function dispose(){disposed=true;world=spatialIndex([]);lights=[];vignette=null;shadowGeometry=new WeakMap();staticCasterPlan=null;}
    return {setWorld,updateWorld,draw,resize,dispose,stats,actorFilter};
  }

  function create(canvas,options={}) {
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,powerPreference:'high-performance'});
    if(!gl) return createSoftware(canvas);
    // Marges du cache de vue : 'auto' (défaut) suit la vitesse, un objet {distance,angle}
    // les fixe (en mètres et en radians), 0 force un culling exact reconstruit à chaque image.
    const marginOption=options.cullMargin===undefined?'auto':options.cullMargin;
    const exactMargin=marginOption===0,fixedMargin=marginOption&&typeof marginOption==='object'?marginOption:null;
    const motion={time:null,x:0,y:0,z:0,fx:0,fy:0,fz:0,speed:0,turn:0};
    function trackMotion(eye,forward,time){
      const dt=motion.time===null?0:Math.max(0,Math.min(.1,time-motion.time));
      motion.time=time;
      if(dt>0){
        const speed=Math.hypot(eye[0]-motion.x,eye[1]-motion.y,eye[2]-motion.z)/dt;
        const cosine=Math.max(-1,Math.min(1,forward[0]*motion.fx+forward[1]*motion.fy+forward[2]*motion.fz));
        const turn=Math.acos(cosine)/dt,blend=1-Math.exp(-dt/.25);
        motion.speed+=(speed-motion.speed)*blend;motion.turn+=(turn-motion.turn)*blend;
      }
      motion.x=eye[0];motion.y=eye[1];motion.z=eye[2];motion.fx=forward[0];motion.fy=forward[1];motion.fz=forward[2];
    }
    function margins(demiDiag){
      if(exactMargin)return {distance:0,tilt:0};
      if(fixedMargin)return {distance:Number.isFinite(fixedMargin.distance)?fixedMargin.distance:VIEW_MARGIN,tilt:Number.isFinite(fixedMargin.angle)?fixedMargin.angle:VIEW_TILT};
      const distance=Math.max(1,Math.min(16,motion.speed*.15)),tilt=Math.min(demiDiag*.5,Math.max(4*Math.PI/180,Math.min(12*Math.PI/180,motion.turn*.1)));
      return {distance,tilt};
    }
    const source=geometry(),view=new Float32Array(16),projection=new Float32Array(16),vp=new Float32Array(16);
    const shadowView=new Float32Array(16),shadowProjection=new Float32Array(16),shadowMatrix=new Float32Array(16),shadowMatrices=new Float32Array(48);
    const lightPositions=new Float32Array(36),lightColors=new Float32Array(36),lightRanges=new Float32Array(12);
    const stats={drawCalls:0,triangles:0,instances:0,contextLost:false,webglVersion:2,backend:'webgl2',bloom:false,shadows:false};
    let program,depthProgram,postProgram,skyProgram,fxProgram,vao,postVao,vbo,ibo,worldBuffer,dynamicBuffer,overlayBuffer,fxBuffer,uniforms,postUniforms,skyUniforms,fxUniforms,depthMatrix,depthWind,depthCullCentre,depthCullRange;
    let post=null,shadowTarget=null,whiteTexture=null,targetKey='',shadowKey='',shadowLight=null;
    let world=[],worldIndex=spatialIndex([]),lights=[],environment=null,worldBatch=pack([]),quality='auto',disposed=false,worldRevision=0;
    let staticCaches=[],lampCasters=[],actorLightPlan=null,viewCache=null,torchCache=null,sunCache=null,indexRevision=0,selectionGen=0;
    const cacheStats={viewFrames:0,viewRebuilds:0,torchRebuilds:0,sunRebuilds:0,marginDistance:1,marginAngle:8};
    let guardMargin={distance:1,tilt:8*Math.PI/180};
    const sunCasterOut=[],SHADOW_RANGES=[32,18,0],VIEW_MARGIN=1,VIEW_TILT=8*Math.PI/180,SUN_GRID=4,SUN_PAD=1.74*SUN_GRID;
    const capacity=new Map(),dynamicRows=scratchRows(),overlayRows=scratchRows(),fxRows=scratchRows();
    const governor=resolutionGovernor();let autoScale=1;

    function compile(type,code) {
      const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error('Compilation 3D : '+message);}
      return shader;
    }
    function link(vertex,fragment){
      const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();
      gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const message=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw new Error('Initialisation 3D : '+message);}
      return p;
    }
    function texture(width,height,depth=false){
      const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texImage2D(gl.TEXTURE_2D,0,depth?gl.DEPTH_COMPONENT24:gl.RGBA8,width,height,0,depth?gl.DEPTH_COMPONENT:gl.RGBA,depth?gl.UNSIGNED_INT:gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,depth?gl.NEAREST:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,depth?gl.NEAREST:gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      return t;
    }
    function deleteTarget(target){
      if(!target)return;gl.deleteFramebuffer(target.framebuffer);gl.deleteTexture(target.texture);if(target.depth)gl.deleteRenderbuffer(target.depth);
    }
    function colorTarget(width,height,depth){
      const target={framebuffer:gl.createFramebuffer(),texture:texture(width,height),width,height,depth:null};
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.texture,0);
      if(depth){target.depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,target.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,target.depth);}
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){deleteTarget(target);return null;}
      return target;
    }
    function freePost(){if(post){deleteTarget(post.scene);deleteTarget(post.a);deleteTarget(post.b);post=null;}}
    function ensureTargets(){
      const key=canvas.width+'x'+canvas.height+':'+quality;if(key===targetKey)return;targetKey=key;
      freePost();
      if(quality==='low'){deleteTarget(shadowTarget);shadowTarget=null;shadowKey='';stats.bloom=stats.shadows=false;return;}
      const width=canvas.width,height=canvas.height,bw=Math.max(1,Math.ceil(width/4)),bh=Math.max(1,Math.ceil(height/4));
      const scene=colorTarget(width,height,true),a=colorTarget(bw,bh,false),b=colorTarget(bw,bh,false);
      if(scene&&a&&b)post={scene,a,b};else{deleteTarget(scene);deleteTarget(a);deleteTarget(b);}
      const size=quality==='high'?1024:512;
      // Pixel resolution may adapt; a depth atlas of the same size remains valid.
      if(shadowKey!==String(size)){
        deleteTarget(shadowTarget);shadowTarget=null;shadowKey=String(size);
        const target={framebuffer:gl.createFramebuffer(),texture:texture(size*2,size*2,true),size};
        gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,target.texture,0);
        gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE)shadowTarget=target;else deleteTarget(target);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
      stats.bloom=!!post;stats.shadows=!!shadowTarget;
    }
    function initialize() {
      capacity.clear();
      program=link(VERT,FRAG);depthProgram=link(VERT,DEPTH_FRAG);postProgram=link(POST_VERT,POST_FRAG);skyProgram=link(POST_VERT,SKY_FRAG);fxProgram=link(FX_VERT,FX_FRAG);
      uniforms={};for(const name of ['uViewProjection','uWindTime','uEye','uForward','uLightPosition','uLightColor','uLightRange','uLightCount','uResolution','uEffects','uShadowMap','uShadowMatrix','uShadowSettings','uTorchPosition','uSunDirection','uSunColor','uAmbient','uFogColor','uSkyTop','uSkyBottom','uEnvironment','uCullCentre','uCullRange']) uniforms[name]=gl.getUniformLocation(program,name);
      postUniforms={};for(const name of ['uScene','uBloom','uTexel','uPass'])postUniforms[name]=gl.getUniformLocation(postProgram,name);
      skyUniforms={};for(const name of ['uSkyRight','uSkyUp','uSkyForward','uSkyTop','uSkyBottom','uSkyFog','uSunDirection','uSunColor','uSkyFov','uSkyMotion'])skyUniforms[name]=gl.getUniformLocation(skyProgram,name);
      fxUniforms={};for(const name of ['uViewProjection','uWindTime','uEye','uAmbient','uFogColor','uEnvironment','uTime'])fxUniforms[name]=gl.getUniformLocation(fxProgram,name);
      depthMatrix=gl.getUniformLocation(depthProgram,'uViewProjection');depthWind=gl.getUniformLocation(depthProgram,'uWindTime');
      depthCullCentre=gl.getUniformLocation(depthProgram,'uCullCentre');depthCullRange=gl.getUniformLocation(depthProgram,'uCullRange');
      vao=gl.createVertexArray();gl.bindVertexArray(vao);
      vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,source.vertices,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
      gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
      ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,source.indices,gl.STATIC_DRAW);
      for(let i=2;i<6;i++) {gl.enableVertexAttribArray(i);gl.vertexAttribDivisor(i,1);}
      worldBuffer=gl.createBuffer();dynamicBuffer=gl.createBuffer();overlayBuffer=gl.createBuffer();fxBuffer=gl.createBuffer();
      // Main colour and the three shadow views must keep independent instance buffers.
      staticCaches=[worldBuffer,gl.createBuffer(),gl.createBuffer(),gl.createBuffer()].map(buffer=>({buffer,entries:[],batch:pack([])}));
      lampCasters=[];
      gl.bindBuffer(gl.ARRAY_BUFFER,worldBuffer);gl.bufferData(gl.ARRAY_BUFFER,worldBatch.values,gl.STATIC_DRAW);
      postVao=gl.createVertexArray();
      whiteTexture=texture(1,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
      gl.clearColor(.035,.06,.073,1);
      post=null;shadowTarget=null;targetKey=shadowKey='';shadowLight=null;
      governor.reset();autoScale=1;
      stats.contextLost=false;
    }
    initialize();

    function setWorld(meshes,points,atmosphere) {
      environment=environmentInfo(atmosphere);world=meshes||[];worldIndex=spatialIndex(world,environment);lights=points||[];worldBatch=pack([]);shadowLight=null;actorLightPlan=null;stats.staticTotal=world.length;stats.biome=environment?environment.biome:null;
      worldRevision=0;stats.worldRevision=0;indexRevision++;viewCache=torchCache=sunCache=null;
      lampCasters=[];for(const cache of staticCaches){cache.entries=[];cache.batch=pack([]);cache.gen=undefined;}
      governor.reset();autoScale=1;
      if(stats.contextLost||disposed) return;
      gl.bindBuffer(gl.ARRAY_BUFFER,worldBuffer);capacity.delete(worldBuffer);uploadRows(worldBuffer,worldBatch.values,gl.STATIC_DRAW);
    }
    function updateWorld(meshes,revision,points,delta){
      if(disposed||revision===worldRevision&&!delta?.full)return false;
      const changedLights=Array.isArray(points)&&(points.length!==lights.length||points.some((light,i)=>light!==lights[i]));
      if(changedLights){lights=points;actorLightPlan=null;if(!lights.includes(shadowLight))shadowLight=null;}
      world=meshes||[];worldIndex=spatialIndex(world,environment,delta?.full?null:worldIndex,delta);indexRevision++;
      function keep(cache){if(!cache||changedSelection(worldIndex,cache.origin,cache.ranges))return null;cache.revision=indexRevision;return cache;}
      viewCache=keep(viewCache);torchCache=keep(torchCache);sunCache=keep(sunCache);
      for(let i=0;i<lampCasters.length;i++){const c=lampCasters[i];if(c&&(!lights.includes(c.light)||changedSelection(worldIndex,c.p,SHADOW_RANGES)))lampCasters[i]=null;}
      // Clear dead references now, before any colour or shadow pass can run.
      // Unchanged lists retain their rows and GPU storage across distant breaks.
      for(const cache of staticCaches){
        if(worldIndex.full||cache.entries.some(e=>!e.live)){cache.entries=[];cache.batch=pack([]);cache.gen=undefined;}
        // Removing an earlier mesh renumbers survivors without changing their
        // instance rows. Keep the hash filter consistent with those new orders.
        else if(cache.gen!==undefined){let hash=0;for(const e of cache.entries)hash=(hash*31+e.order)|0;cache.gen=hash;}
      }
      worldRevision=revision===undefined?worldRevision+1:revision;stats.worldRevision=worldRevision;stats.staticTotal=world.length;
      return true;
    }
    function resize(next) {
      if(next!==undefined&&next!==quality){quality=next;governor.reset();autoScale=1;}
      const pixelRatio=window.devicePixelRatio||1;
      let ratio=typeof quality==='number'?quality:quality==='low'?.8:quality==='high'?Math.min(pixelRatio,2):Math.min(pixelRatio,1.5);
      const cssWidth=canvas.clientWidth||window.innerWidth||800,cssHeight=canvas.clientHeight||window.innerHeight||600;
      ratio=Math.max(.5,Math.min(2,ratio));
      if(quality==='auto')ratio=Math.min(ratio,Math.sqrt(1800000/(cssWidth*cssHeight)))*autoScale;
      const width=Math.max(1,Math.round(cssWidth*ratio)),height=Math.max(1,Math.round(cssHeight*ratio));
      if(canvas.width!==width||canvas.height!==height) {canvas.width=width;canvas.height=height;}
      stats.renderScale=autoScale;stats.pixelRatio=ratio;stats.width=width;stats.height=height;
      ensureTargets();
      gl.viewport(0,0,width,height);
      return {width,height,ratio};
    }
    function uploadRows(buffer,values,usage){
      let cap=capacity.get(buffer)||0;
      if(values.byteLength>cap){cap=Math.max(65536,values.byteLength,cap*2);gl.bufferData(gl.ARRAY_BUFFER,cap,usage||gl.DYNAMIC_DRAW);capacity.set(buffer,cap);}
      gl.bufferSubData(gl.ARRAY_BUFFER,0,values);stats.uploadBytes+=values.byteLength;
    }
    function renderBatch(batch,buffer,upload,shadowPass=false) {
      if(!batch.groups.length) return;
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      if(upload)uploadRows(buffer,batch.values);
      for(const group of batch.groups) {
        for(let i=2;i<6;i++) gl.vertexAttribPointer(i,4,gl.FLOAT,false,64,group.offset+(i-2)*16);
        const shape=source.ranges[group.name];
        gl.drawElementsInstanced(gl.TRIANGLES,shape.count,gl.UNSIGNED_SHORT,shape.offset,group.count);
        stats.drawCalls++;stats.triangles+=shape.count/3*group.count;if(!shadowPass)stats.instances+=group.count;
      }
    }
    function cached(e,origin,forward,demiDiag,k,margin,tilt,near,far){
      const dx=e.p[0]-origin[0],dy=e.p[1]-origin[1],dz=e.p[2]-origin[2],r=e.radius+margin,dist=Math.hypot(dx,dy,dz);
      if(dist>r+far)return false;
      if(dist<r+near+margin)return true;
      const c=(dx*forward[0]+dy*forward[1]+dz*forward[2])/dist;
      return c>=Math.cos(demiDiag+tilt+Math.asin(Math.min(1,r*k/dist)));
    }
    // Sélection de garde : un sur-ensemble reconstruit seulement quand la caméra sort de la
    // marge (D mètres, θ radians) ou quand le monde, le cadrage ou la portée changent.
    function selectionCache(previous,revision,origin,axes,horizontal,vertical,far,ranges,near,margin,tilt){
      if(previous&&previous.revision===revision&&previous.horizontal===horizontal&&previous.vertical===vertical&&previous.far>=far
        &&previous.ranges[0]>=ranges[0]&&previous.ranges[1]>=ranges[1]&&previous.ranges[2]>=ranges[2]
        &&Math.hypot(origin[0]-previous.origin[0],origin[1]-previous.origin[1],origin[2]-previous.origin[2])<=previous.margin
        &&axes.forward[0]*previous.forward[0]+axes.forward[1]*previous.forward[1]+axes.forward[2]*previous.forward[2]>=Math.cos(previous.tilt))return previous;
      const demiDiag=Math.atan(Math.hypot(horizontal,vertical)),k=Math.hypot(1,horizontal,vertical);
      // Un niveau à portée nulle doit rester exclu : ajouter la marge le ferait revenir dans la requête.
      // Pas de plafond sur la taille du sur-ensemble : le réduire ferait disparaître des objets
      // visibles. Le sur-ensemble reste côté processeur, le GPU ne reçoit que la sélection exacte.
      const query0=[ranges[0]>0?ranges[0]+margin:0,ranges[1]>0?ranges[1]+margin:0,ranges[2]>0?ranges[2]+margin:0],candidates=worldIndex.query(origin,query0),entries=[];
      for(let i=0;i<candidates.length;i++){const e=candidates[i];if(cached(e,origin,axes.forward,demiDiag,k,margin,tilt,near,far))entries.push(e);}
      // Pas de tri par index ici : le balayage de l'index spatial est deja deterministe et
      // stable tant que le cache est valide. Trier les casters d'ombre changerait l'ordre
      // d'emission et quelques pixels sur les faces coplanaires (preuve Chrome : ecart
      // 16/255 sur 30 pixels des scenarios camp17-a, camp17-b, camp6-a, legacy0-b).
      entries.gen=++selectionGen;
      return {revision,origin:[origin[0],origin[1],origin[2]],forward:[axes.forward[0],axes.forward[1],axes.forward[2]],horizontal,vertical,far,ranges:query0,margin,tilt,entries};
    }
    function renderStatic(entries,slot,shadow=false,reuse=false){
      const cache=staticCaches[slot];
      // A matching 32-bit selection hash is only a fast filter, not identity.
      // Distinct lists of equal length can collide (e.g. orders [1,63] and [2,32]).
      const same=cache.entries===entries||cache.entries.length===entries.length
        &&(entries.gen===undefined||cache.gen===entries.gen&&cache.count===entries.count)
        &&entries.every((entry,i)=>entry===cache.entries[i]);
      if(!same){cache.entries=reuse?entries.slice():entries;cache.gen=entries.gen;cache.count=entries.count;cache.batch=packIndexed(entries,cache.rows||(cache.rows=scratchRows()));}
      renderBatch(cache.batch,cache.buffer,!same,shadow);
    }
    function renderEffects(meshes,eye,time){
      const batch=packEffects(meshes,environment,eye,fxRows);stats.fxInstances+=batch.values.length/16;if(!batch.groups.length)return;
      gl.useProgram(fxProgram);gl.uniformMatrix4fv(fxUniforms.uViewProjection,false,vp);gl.uniform2f(fxUniforms.uWindTime,0,time);
      gl.uniform3fv(fxUniforms.uEye,eye);gl.uniform3fv(fxUniforms.uAmbient,environment?environment.ambient:[.12,.15,.16]);
      gl.uniform3fv(fxUniforms.uFogColor,environment?environment.fog:[.009,.018,.024]);gl.uniform2f(fxUniforms.uEnvironment,environment?1:0,environment?environment.fogDensity:.018);gl.uniform1f(fxUniforms.uTime,time);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      renderBatch(batch,fxBuffer,true);gl.depthMask(true);gl.disable(gl.BLEND);gl.useProgram(program);
    }
    function shadowPass(light,dynamicBatch,slot,torchAxes,time){
      const p=light.p,shadowAxes=torchAxes||{right:[1,0,0],up:[0,0,-1],forward:[0,-1,0]};
      const {right:r,up:u,forward:fw}=shadowAxes;
      shadowView.set([r[0],u[0],-fw[0],0,r[1],u[1],-fw[1],0,r[2],u[2],-fw[2],0,-(r[0]*p[0]+r[1]*p[1]+r[2]*p[2]),-(u[0]*p[0]+u[1]*p[1]+u[2]*p[2]),fw[0]*p[0]+fw[1]*p[1]+fw[2]*p[2],1]);
      const f=1/Math.tan((torchAxes?108:138)*Math.PI/360),near=torchAxes?.08:.15,far=32;
      shadowProjection.fill(0);shadowProjection[0]=shadowProjection[5]=f;shadowProjection[10]=(far+near)/(near-far);shadowProjection[11]=-1;shadowProjection[14]=2*far*near/(near-far);
      multiply(shadowProjection,shadowView,shadowMatrix);
      shadowMatrices.set(shadowMatrix,slot*16);
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget.framebuffer);gl.viewport((slot%2)*shadowTarget.size,Math.floor(slot/2)*shadowTarget.size,shadowTarget.size,shadowTarget.size);
      gl.useProgram(depthProgram);gl.bindVertexArray(vao);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.1,2.0);gl.uniformMatrix4fv(depthMatrix,false,shadowMatrix);gl.uniform2f(depthWind,environment?environment.wind:0,time);
      const tangent=1/f;
      const previous=lampCasters[slot];
      const stable=!torchAxes&&previous&&previous.light===light&&previous.p.every((v,k)=>v===p[k]);
      let casters;
      if(stable)casters=previous.entries;
      else if(torchAxes){
        const before=torchCache,guard=torchCache=selectionCache(torchCache,indexRevision,p,shadowAxes,tangent,tangent,32,SHADOW_RANGES,.08,guardMargin.distance,guardMargin.tilt);
        if(guard!==before)cacheStats.torchRebuilds++;
        casters=[];let hash=0;
        for(let i=0;i<guard.entries.length;i++){
          const e=guard.entries[i],limit=SHADOW_RANGES[e.detail]+e.radius,dx=e.p[0]-p[0],dy=e.p[1]-p[1],dz=e.p[2]-p[2];
          if(dx*dx+dy*dy+dz*dz>limit*limit||!visible(e,p,shadowAxes,tangent,tangent,32))continue;
          casters.push(e);hash=(hash*31+e.order)|0;
        }
        casters.gen=hash;casters.count=casters.length;
      }
      else{casters=worldIndex.query(p,SHADOW_RANGES,null,{axes:shadowAxes,horizontal:tangent,vertical:tangent,far:32}).filter(e=>visible(e,p,shadowAxes,tangent,tangent,32));lampCasters[slot]={light,p:p.slice(),entries:casters};}
      gl.uniform3fv(depthCullCentre,p);gl.uniform3fv(depthCullRange,SHADOW_RANGES);
      renderStatic(casters,slot+1,true);renderBatch(dynamicBatch,dynamicBuffer,false,true);gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    function sunShadowPass(eye,axes,dynamicBatch,time){
      const sun=environment.sunDirection,fw=sun.map(v=>-v),length=Math.hypot(fw[0],fw[2]);
      const r=length>.0001?[-fw[2]/length,0,fw[0]/length]:[1,0,0],u=[r[1]*fw[2]-r[2]*fw[1],r[2]*fw[0]-r[0]*fw[2],r[0]*fw[1]-r[1]*fw[0]];
      const extent=quality==='high'?36:28,texel=extent*2/shadowTarget.size;
      const center=[eye[0]+axes.forward[0]*8,eye[1]+1.4,eye[2]+axes.forward[2]*8],dot=a=>a[0]*center[0]+a[1]*center[1]+a[2]*center[2];
      const xSnap=Math.round(dot(r)/texel)*texel-dot(r),ySnap=Math.round(dot(u)/texel)*texel-dot(u);
      for(let k=0;k<3;k++)center[k]+=r[k]*xSnap+u[k]*ySnap;
      const p=center.map((v,k)=>v+sun[k]*55);
      shadowView.set([r[0],u[0],-fw[0],0,r[1],u[1],-fw[1],0,r[2],u[2],-fw[2],0,-(r[0]*p[0]+r[1]*p[1]+r[2]*p[2]),-(u[0]*p[0]+u[1]*p[1]+u[2]*p[2]),fw[0]*p[0]+fw[1]*p[1]+fw[2]*p[2],1]);
      const near=1,far=115;shadowProjection.fill(0);shadowProjection[0]=shadowProjection[5]=1/extent;shadowProjection[10]=-2/(far-near);shadowProjection[14]=-(far+near)/(far-near);shadowProjection[15]=1;
      multiply(shadowProjection,shadowView,shadowMatrix);shadowMatrices.set(shadowMatrix,16);
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget.framebuffer);gl.viewport(shadowTarget.size,0,shadowTarget.size,shadowTarget.size);
      gl.useProgram(depthProgram);gl.bindVertexArray(vao);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.1,2);
      gl.uniformMatrix4fv(depthMatrix,false,shadowMatrix);gl.uniform2f(depthWind,environment.wind,time);
      const sunRanges=[extent+24,26,0],sunGrid=Math.max(SUN_GRID,Math.min(16,guardMargin.distance*2)),grid=[Math.round(center[0]/sunGrid),Math.round(center[1]/sunGrid),Math.round(center[2]/sunGrid)];
      if(!sunCache||sunCache.revision!==indexRevision||sunCache.extent!==extent||sunCache.grid[0]!==grid[0]||sunCache.grid[1]!==grid[1]||sunCache.grid[2]!==grid[2])
        {const pad=1.74*sunGrid;sunCache={revision:indexRevision,extent,grid,origin:center.slice(),ranges:[sunRanges[0]+pad,sunRanges[1]+pad,0],candidates:worldIndex.query(center,[sunRanges[0]+pad,sunRanges[1]+pad,0])};cacheStats.sunRebuilds++;}
      const candidates=sunCache.candidates;
      const px=p[0],py=p[1],pz=p[2],rx=r[0],ry=r[1],rz=r[2],ux=u[0],uy=u[1],uz=u[2],fwx=fw[0],fwy=fw[1],fwz=fw[2];
      sunCasterOut.length=0;
      let sunHash=0;
      for(let i=0;i<candidates.length;i++){
        const e=candidates[i],dx=e.p[0]-px,dy=e.p[1]-py,dz=e.p[2]-pz,radius=e.radius,z=dx*fwx+dy*fwy+dz*fwz;
        const sx=e.p[0]-center[0],sy=e.p[1]-center[1],sz=e.p[2]-center[2],limit=sunRanges[e.detail]+radius,sq=sx*sx+sy*sy+sz*sz;
        if(sq<=limit*limit&&Math.abs(dx*rx+dy*ry+dz*rz)<extent+radius&&Math.abs(dx*ux+dy*uy+dz*uz)<extent+radius&&z+radius>near&&z-radius<far){sunCasterOut.push(e);sunHash=(sunHash*31+e.order)|0;}
      }
      sunCasterOut.gen=sunHash;sunCasterOut.count=sunCasterOut.length;
      gl.uniform3fv(depthCullCentre,center);gl.uniform3fv(depthCullRange,sunRanges);
      renderStatic(sunCasterOut,2,true,true);renderBatch(dynamicBatch,dynamicBuffer,false,true);gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    function skyPass(axes,f,time){
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(skyProgram);
      gl.uniform3fv(skyUniforms.uSkyRight,axes.right);gl.uniform3fv(skyUniforms.uSkyUp,axes.up);gl.uniform3fv(skyUniforms.uSkyForward,axes.forward);
      gl.uniform3fv(skyUniforms.uSkyTop,environment.skyTop);gl.uniform3fv(skyUniforms.uSkyBottom,environment.skyBottom);gl.uniform3fv(skyUniforms.uSkyFog,environment.fog);
      gl.uniform3fv(skyUniforms.uSunDirection,environment.sunDirection);gl.uniform3fv(skyUniforms.uSunColor,environment.sunColor);
      gl.uniform2f(skyUniforms.uSkyFov,canvas.width/canvas.height/f,1/f);gl.uniform2f(skyUniforms.uSkyMotion,time,environment.wind);gl.drawArrays(gl.TRIANGLES,0,3);
      stats.drawCalls++;gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
    }
    function postPass(){
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(postVao);gl.useProgram(postProgram);
      gl.uniform1i(postUniforms.uScene,0);gl.uniform1i(postUniforms.uBloom,1);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,post.scene.texture);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);
      gl.bindFramebuffer(gl.FRAMEBUFFER,post.a.framebuffer);gl.viewport(0,0,post.a.width,post.a.height);
      gl.uniform1i(postUniforms.uPass,0);gl.uniform2f(postUniforms.uTexel,1/canvas.width,1/canvas.height);gl.drawArrays(gl.TRIANGLES,0,3);
      gl.bindFramebuffer(gl.FRAMEBUFFER,post.b.framebuffer);gl.bindTexture(gl.TEXTURE_2D,post.a.texture);
      gl.uniform1i(postUniforms.uPass,1);gl.uniform2f(postUniforms.uTexel,1/post.a.width,1/post.a.height);gl.drawArrays(gl.TRIANGLES,0,3);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,post.b.texture);
      gl.uniform1i(postUniforms.uPass,2);gl.drawArrays(gl.TRIANGLES,0,3);stats.drawCalls+=3;
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.activeTexture(gl.TEXTURE0);
    }
    function lightPlan(eye){
      const distanceTo=light=>(light.p[0]-eye[0])**2+(light.p[1]-eye[1])**2+(light.p[2]-eye[2])**2;
      const sorted=lights.map(light=>({light,d:distanceTo(light)})).sort((a,b)=>a.d-b.d);
      const candidate=sorted.find(entry=>entry.light.p[1]>=2.5&&(entry.light.power||1)>=7)||sorted.find(entry=>entry.light.p[1]>=2.5);
      let chosen=shadowLight;
      if(candidate&&(!chosen||distanceTo(chosen)>candidate.d*1.35+5))chosen=candidate.light;
      if(!candidate)chosen=null;
      const second=sorted.find(entry=>entry.light!==chosen&&entry.light.p[1]>=2.5);
      return {sorted,distanceTo,chosen,shadowLights:chosen?[chosen,...(second&&!environment?[second.light]:[])]:[]};
    }
    // Called once before model construction. A rejected enclosing sphere cannot
    // reach the camera OR any GPU shadow pass, including offscreen sun casters.
    // This changes neither geometry nor shadow resolution/order for kept actors.
    function actorFilter(camera,fx={}){
      stats.actorsConsidered=stats.actorsCulled=0;actorLightPlan=null;
      if(disposed||stats.contextLost){stats.actorFilterMode='inactive';return ()=>true;}
      const t=fx.time||0,shake=fx.shake||0,p=camera.pos||[0,1.6,0],axes=cameraAxes(camera);
      const eye=[p[0]+Math.sin(t*57)*shake*.025,p[1]+Math.sin(t*71)*shake*.015,p[2]];
      const cssWidth=canvas.clientWidth||window.innerWidth||800,cssHeight=canvas.clientHeight||window.innerHeight||600;
      // resize may round/adapt resolution during draw. Enclose every allowed
      // rounded aspect instead of relying on the previous backing-store size.
      const aspect=Math.max(canvas.width/Math.max(1,canvas.height),cssWidth/cssHeight)+(1+cssWidth/cssHeight)/Math.max(1,cssHeight*.3);
      const tangent=Math.tan(Math.max(40,Math.min(110,camera.fov||75))*Math.PI/360),views=[{eye,axes,h:aspect*tangent,v:tangent,far:180}];
      const shadows=quality!=='low'&&fx.shadows!==false;
      let sunVolume=null;
      if(shadows){
        const plan=lightPlan(eye);actorLightPlan={eye:eye.slice(),previous:shadowLight,plan};
        const {shadowLights}=plan,down={right:[1,0,0],up:[0,0,-1],forward:[0,-1,0]},lampTangent=Math.tan(138*Math.PI/360);
        for(const light of shadowLights)views.push({eye:light.p,axes:down,h:lampTangent,v:lampTangent,far:32});
        const torch=eye.map((v,i)=>v+axes.right[i]*.16-axes.up[i]*.08),torchTangent=Math.tan(108*Math.PI/360);
        views.push({eye:torch,axes,h:torchTangent,v:torchTangent,far:32});
        if(environment){
          const sun=environment.sunDirection,fw=sun.map(v=>-v),length=Math.hypot(fw[0],fw[2]);
          const right=length>.0001?[-fw[2]/length,0,fw[0]/length]:[1,0,0],up=[right[1]*fw[2]-right[2]*fw[1],right[2]*fw[0]-right[0]*fw[2],right[0]*fw[1]-right[1]*fw[0]];
          // The real pass snaps this centre by <=.071 m. A quarter metre guard
          // includes the entire snap and PCF border at both atlas resolutions.
          sunVolume={center:[eye[0]+axes.forward[0]*8,eye[1]+1.4,eye[2]+axes.forward[2]*8],right,up,forward:fw,extent:(quality==='high'?36:28)+.25};
        }
      }
      stats.actorFilterMode=shadows?'camera-and-shadow-frusta':'camera-frustum';stats.actorFilterVolumes=views.length+(sunVolume?1:0);
      return (x,y,z,radius)=>{
        stats.actorsConsidered++;
        if(![x,y,z,radius].every(Number.isFinite)||radius<0)return true;
        const e={p:[x,y,z],radius:radius+.002};
        for(const v of views)if(visible(e,v.eye,v.axes,v.h,v.v,v.far))return true;
        if(sunVolume){
          const q=sunVolume,dx=x-q.center[0],dy=y-q.center[1],dz=z-q.center[2],dot=a=>dx*a[0]+dy*a[1]+dz*a[2],depth=55+dot(q.forward);
          if(Math.abs(dot(q.right))<=q.extent+e.radius&&Math.abs(dot(q.up))<=q.extent+e.radius&&depth+e.radius>=1&&depth-e.radius<=115)return true;
        }
        stats.actorsCulled++;return false;
      };
    }
    function draw(camera,dynamic,fx) {
      if(disposed||stats.contextLost) return;
      fx=fx||{};autoScale=governor.update(fx,quality);resize();
      const t=fx.time||0,shake=fx.shake||0,p=camera.pos||[0,1.6,0];
      const axes=cameraAxes(camera),{right,up,forward}=axes;
      const eye=[p[0]+Math.sin(t*57.)*shake*.025,p[1]+Math.sin(t*71.)*shake*.015,p[2]];
      view.set([right[0],up[0],-forward[0],0,right[1],up[1],-forward[1],0,right[2],up[2],-forward[2],0,
        -(right[0]*eye[0]+right[1]*eye[1]+right[2]*eye[2]),-(up[0]*eye[0]+up[1]*eye[1]+up[2]*eye[2]),forward[0]*eye[0]+forward[1]*eye[1]+forward[2]*eye[2],1]);
      const fov=Math.max(40,Math.min(110,camera.fov||75))*Math.PI/180,f=1/Math.tan(fov*.5),near=.045,far=180;
      projection.fill(0);projection[0]=f/(canvas.width/canvas.height);projection[5]=f;projection[10]=(far+near)/(near-far);projection[11]=-1;projection[14]=2*far*near/(near-far);
      multiply(projection,view,vp);
      const ranges=detailRanges(quality);ranges[0]=extendedDistance(ranges[0],environment,eye);stats.viewDistance=ranges[0];
      const horizontal=canvas.width/canvas.height/f,vertical=1/f;
      cacheStats.viewFrames++;
      trackMotion(eye,axes.forward,t);
      guardMargin=margins(Math.atan(Math.hypot(horizontal,vertical)));
      cacheStats.marginDistance=+guardMargin.distance.toFixed(2);cacheStats.marginAngle=+(guardMargin.tilt*180/Math.PI).toFixed(2);
      const previousView=viewCache,guard=viewCache=selectionCache(viewCache,indexRevision,eye,axes,horizontal,vertical,ranges[0],ranges,near,guardMargin.distance,guardMargin.tilt);
      if(guard!==previousView)cacheStats.viewRebuilds++;
      const shown=[];let viewHash=0;
      for(let i=0;i<guard.entries.length;i++){
        const e=guard.entries[i],limit=ranges[e.detail]+e.radius,dx=e.p[0]-eye[0],dy=e.p[1]-eye[1],dz=e.p[2]-eye[2];
        if(dx*dx+dy*dy+dz*dz>limit*limit||!visible(e,eye,axes,horizontal,vertical,ranges[0]))continue;
        shown.push(e);viewHash=(viewHash*31+e.order)|0;
      }
      shown.gen=viewHash;shown.count=shown.length;
      stats.staticVisible=shown.length;stats.staticSuperset=guard.entries.length;stats.staticCulled=world.length-shown.length;stats.cache=cacheStats;
      const planned=actorLightPlan&&actorLightPlan.previous===shadowLight&&eye.every((v,k)=>v===actorLightPlan.eye[k])?actorLightPlan.plan:lightPlan(eye);actorLightPlan=null;
      const {sorted,distanceTo,chosen,shadowLights}=planned;shadowLight=chosen;
      const transient=transientLights(fx.lights,eye,quality==='low'?2:3);stats.dynamicLights=transient.length;
      const selected=shadowLights.map(light=>({light,d:distanceTo(light)})).concat(transient.map(light=>({light,d:distanceTo(light)})),sorted.filter(entry=>!shadowLights.includes(entry.light)).slice(0,(quality==='low'?6:12)-shadowLights.length-transient.length));
      const blackout=horrorLights(fx.horror,lights);stats.blackoutLights=blackout?.size||0;
      lightPositions.fill(0);lightColors.fill(0);lightRanges.fill(0);
      selected.forEach(({light},i)=>{lightPositions.set(light.p,i*3);lightRanges[i]=light.range||0;const c=light.color||[1,1,1],power=(light.power===undefined?1:light.power)*(blackout?.get(light)??1);lightColors.set([c[0]*power,c[1]*power,c[2]*power],i*3);});
      const ordinary=[],overlay=[],particles=[],overlayParticles=[];for(const mesh of dynamic||[]) (mesh.overlay?(mesh.fx?overlayParticles:overlay):mesh.fx?particles:ordinary).push(mesh);
      const dynamicBatch=pack(ordinary,environment,true,dynamicRows);
      const torchPosition=eye.map((v,i)=>v+right[i]*.16-up[i]*.08);
      stats.drawCalls=0;stats.triangles=0;stats.instances=0;stats.bloom=!!post&&fx.bloom!==false;stats.shadows=!!shadowTarget&&fx.shadows!==false;stats.shadowMaps=stats.shadows?shadowLights.length+1+(environment?1:0):0;stats.shadowMode=environment?'sun-atlas':'atlas';
      stats.uploadBytes=0;stats.fxInstances=0;
      // Animated instances are shared unchanged by every depth and colour pass.
      if(dynamicBatch.values.length){gl.bindBuffer(gl.ARRAY_BUFFER,dynamicBuffer);uploadRows(dynamicBuffer,dynamicBatch.values);}
      if(stats.shadows){
        gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget.framebuffer);gl.clear(gl.DEPTH_BUFFER_BIT);
        shadowLights.forEach((light,i)=>shadowPass(light,dynamicBatch,i,null,t));if(environment)sunShadowPass(eye,axes,dynamicBatch,t);shadowPass({p:torchPosition},dynamicBatch,2,axes,t);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,stats.bloom?post.scene.framebuffer:null);gl.viewport(0,0,canvas.width,canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(environment)skyPass(axes,f,t);gl.useProgram(program);gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(uniforms.uViewProjection,false,vp);gl.uniform3fv(uniforms.uEye,eye);gl.uniform3fv(uniforms.uForward,forward);
      gl.uniform2f(uniforms.uWindTime,environment?environment.wind:0,t);gl.uniform3fv(uniforms.uSunDirection,environment?environment.sunDirection:[.4,.8,.3]);gl.uniform3fv(uniforms.uSunColor,environment?environment.sunColor:[0,0,0]);
      gl.uniform3fv(uniforms.uAmbient,environment?environment.ambient:[.075,.10,.12]);gl.uniform3fv(uniforms.uFogColor,environment?environment.fog:[.009,.018,.024]);gl.uniform2f(uniforms.uEnvironment,environment?1:0,environment?environment.fogDensity:.014);
      gl.uniform3fv(uniforms.uSkyTop,environment?environment.skyTop:[.05,.08,.10]);gl.uniform3fv(uniforms.uSkyBottom,environment?environment.skyBottom:[.16,.20,.22]);
      gl.uniform3fv(uniforms.uLightPosition,lightPositions);gl.uniform3fv(uniforms.uLightColor,lightColors);gl.uniform1fv(uniforms.uLightRange,lightRanges);gl.uniform1i(uniforms.uLightCount,selected.length);
      gl.uniform2f(uniforms.uResolution,canvas.width,canvas.height);gl.uniform4f(uniforms.uEffects,t,fx.flash||0,fx.damage||0,Math.max(0,Math.min(1,fx.pulse||0)));
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,stats.shadows?shadowTarget.texture:whiteTexture);gl.uniform1i(uniforms.uShadowMap,2);
      gl.uniformMatrix4fv(uniforms.uShadowMatrix,false,shadowMatrices);gl.uniform4f(uniforms.uShadowSettings,stats.shadows?shadowLights.length:0,shadowTarget?1/(shadowTarget.size*2):1,stats.shadows?1:0,stats.shadows&&environment?1:0);gl.uniform3fv(uniforms.uTorchPosition,torchPosition);
      gl.uniform3fv(uniforms.uCullCentre,eye);gl.uniform3fv(uniforms.uCullRange,ranges);
      renderStatic(shown,0);
      renderBatch(dynamicBatch,dynamicBuffer,false);
      if(particles.length)renderEffects(particles,eye,t);
      if(overlay.length||overlayParticles.length) {
        if(camera.overlayFov&&camera.overlayFov!==camera.fov){const of=1/Math.tan(Math.max(40,Math.min(110,camera.overlayFov))*Math.PI/360);projection[0]=of/(canvas.width/canvas.height);projection[5]=of;multiply(projection,view,vp);gl.uniformMatrix4fv(uniforms.uViewProjection,false,vp);}
        if(blackout){selected.forEach(({light},i)=>{const c=light.color||[1,1,1],power=light.power===undefined?1:light.power;lightColors.set([c[0]*power,c[1]*power,c[2]*power],i*3);});gl.uniform3fv(uniforms.uLightColor,lightColors);}
        gl.clear(gl.DEPTH_BUFFER_BIT);if(overlay.length)renderBatch(pack(overlay,environment,true,overlayRows),overlayBuffer,true);
        if(overlayParticles.length)renderEffects(overlayParticles,eye,t);
      }
      if(stats.bloom)postPass();
    }
    function lost(event){event.preventDefault();stats.contextLost=true;}
    function restored(){if(!disposed) initialize();}
    canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
    function dispose() {
      if(disposed) return;disposed=true;
      canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);
      for(const buffer of [vbo,ibo,worldBuffer,dynamicBuffer,overlayBuffer,fxBuffer]) gl.deleteBuffer(buffer);
      for(const cache of staticCaches.slice(1))gl.deleteBuffer(cache.buffer);
      capacity.clear();
      freePost();deleteTarget(shadowTarget);gl.deleteTexture(whiteTexture);
      gl.deleteVertexArray(vao);gl.deleteVertexArray(postVao);gl.deleteProgram(program);gl.deleteProgram(depthProgram);gl.deleteProgram(postProgram);gl.deleteProgram(skyProgram);gl.deleteProgram(fxProgram);
    }
    return {setWorld,updateWorld,draw,resize,dispose,stats,actorFilter};
  }
  // Constructeur unique de maillage dynamique (RESTE-03) : même littéral, même ordre,
  // tous les champs lus par le moteur sont présents dès la création. Les producteurs
  // affectent ensuite des valeurs, ils n'ajoutent jamais de clé, pour que toutes les
  // listes dynamiques partagent une seule classe cachée. Les valeurs par défaut sont
  // neutres : elles reproduisent exactement la lecture d'un champ absent.
  function mesh(shape,p,s,mat,r=[0,0,0],emissive=0){
    return {shape,p,s,mat,r,emissive,color:undefined,surface:undefined,overlay:false,fx:false,
      alpha:undefined,additive:undefined,outdoor:undefined,actorPart:undefined,actorLod:0,
      actorScale:undefined,structural:false,debrisId:undefined,sourceId:undefined,material:undefined,
      effectPart:'',fxFire:false,fxSmoke:false,fxSpark:false,fxPriority:undefined,ground:undefined,
      innerRatio:undefined,region:undefined};
  }
  window.FRender={create,foliageTriangles};
  window.FRender.mesh=mesh;
})();
