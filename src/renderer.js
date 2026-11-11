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
  out vec3 vWorld;
  out vec3 vNormal;
  flat out float vMaterial;
  flat out float vEmission;
  flat out float vOverlay;
  flat out vec4 vColor;
  void main() {
    vec3 c=cos(iRotation.xyz), s=sin(iRotation.xyz);
    mat3 rx=mat3(1.,0.,0., 0.,c.x,s.x, 0.,-s.x,c.x);
    mat3 ry=mat3(c.y,0.,-s.y, 0.,1.,0., s.y,0.,c.y);
    mat3 rz=mat3(c.z,s.z,0., -s.z,c.z,0., 0.,0.,1.);
    mat3 rotation=rz*ry*rx;
    vWorld=rotation*(aPosition*iScale.xyz)+iPosition.xyz;
    vNormal=normalize(rotation*(aNormal/max(abs(iScale.xyz),vec3(.0001))));
    vMaterial=iPosition.w;
    vEmission=iScale.w;
    vOverlay=iRotation.w;
    vColor=iColor;
    gl_Position=uViewProjection*vec4(vWorld,1.);
  }`;

  const FRAG = `#version 300 es
  precision highp float;
  in vec3 vWorld;
  in vec3 vNormal;
  flat in float vMaterial;
  flat in float vEmission;
  flat in float vOverlay;
  flat in vec4 vColor;
  uniform vec3 uEye;
  uniform vec3 uForward;
  uniform vec3 uLightPosition[12];
  uniform vec3 uLightColor[12];
  uniform int uLightCount;
  uniform vec2 uResolution;
  uniform vec4 uEffects;
  uniform sampler2D uShadowMap;
  uniform mat4 uShadowMatrix;
  uniform vec2 uShadowSettings;
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
    return normalize(max(abs(determinant),.000001)*n-gradient);
  }
  float shadow(vec3 n,vec3 l) {
    if(uShadowSettings.x<.5||vOverlay>.5)return 1.;
    vec4 projected=uShadowMatrix*vec4(vWorld,1.);
    vec3 p=projected.xyz/projected.w*.5+.5;
    if(projected.w<=0.||p.z<=0.||p.z>=1.||min(p.x,p.y)<=.001||max(p.x,p.y)>=.999)return 1.;
    float bias=.00045+.0011*(1.-max(dot(n,l),0.));
    vec2 texel=vec2(uShadowSettings.y);
    float visibility=0.;
    visibility+=step(p.z-bias,texture(uShadowMap,p.xy+texel*vec2(-.65,-.65)).r);
    visibility+=step(p.z-bias,texture(uShadowMap,p.xy+texel*vec2(.65,-.65)).r);
    visibility+=step(p.z-bias,texture(uShadowMap,p.xy+texel*vec2(-.65,.65)).r);
    visibility+=step(p.z-bias,texture(uShadowMap,p.xy+texel*vec2(.65,.65)).r);
    return mix(.12,1.,visibility*.25);
  }
  void main() {
    vec3 n=normalize(vNormal), an=abs(n);
    vec2 uv=an.y>.65?vWorld.xz:(an.x>an.z?vWorld.zy:vWorld.xy);
    float m=vMaterial, emission=vEmission;
    vec3 base=vec3(.105,.135,.15);
    float roughness=.47,metalness=.65;
    float pixelSpan=max(fwidth(uv).x,fwidth(uv).y);
    float fineDetail=1.-smoothstep(.015,.10,pixelSpan);
    float grain=noise(uv*23.)*.5+mix(.5,noise(uv*71.),fineDetail)*.2;
    float broad=noise(uv*.7);
    float panel=grid(uv*.55,.012);
    if (m<.5) {
      base*=.82+grain*.27+broad*.17;
      base*=1.-panel*.55;
      vec2 panelUV=fract(uv*.55);
      float screw=1.-smoothstep(.019,.031,length(panelUV-vec2(.065)));
      screw+=1.-smoothstep(.019,.031,length(panelUV-vec2(.935,.065)));
      base+=screw*.16;
      float ribs=1.-smoothstep(.02,.03,abs(fract(uv.y*4.)-.5));
      base*=1.-ribs*.085;
      float brushing=(.5+.5*sin(uv.y*410.+noise(uv*3.)*4.))*fineDetail;
      roughness=.33+.19*brushing+.08*broad;
    } else if (m<1.5) {
      base=mix(vec3(.19,.075,.025),vec3(.47,.235,.08),broad*.8+.15);
      base*=.8+grain*.43;
      base*=1.-panel*.43;
      roughness=.37+.34*broad;
      metalness=.82;
    } else if (m<2.5) {
      float tiles=grid(uv*.5,.013);
      float variation=hash(floor(uv*.5));
      base=mix(vec3(.095,.12,.135),vec3(.17,.19,.20),variation*.6);
      base*=1.-tiles*.72;
      base*=.9+grain*.3;
      vec2 diamond=fract(mat2(.707,-.707,.707,.707)*uv*12.);
      float tread=step(.68,diamond.x)*step(.65,diamond.y);
      base+=tread*.016;
      roughness=.26+.24*broad;
      metalness=.55;
    } else if (m<3.5) {
      base=vec3(.57,.58,.54)*(.78+grain*.3+broad*.13);
      base*=1.-panel*.22;
      roughness=.85;
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
    } else {
      base=vec3(.065,.075,.085)*(.82+grain*.4);
      roughness=.86;
      metalness=0.;
    }
    if(vColor.w>.5) base=vColor.rgb*(.88+grain*.2)*(1.-panel*.12)*(m<3.5?.65:1.);
    float height=(1.-panel)*.012+grain*.003*fineDetail;
    if(m>1.5&&m<2.5){
      vec2 treadUV=mat2(.707,-.707,.707,.707)*uv*12.;
      float tread=(1.-smoothstep(.26,.34,abs(fract(treadUV.x)-.5)))*(1.-smoothstep(.08,.16,abs(fract(treadUV.y)-.5)));
      height=(1.-grid(uv*.5,.013))*.009+tread*.004*fineDetail;
    }
    if(m<3.5)n=reliefNormal(n,height);
    vec3 view=normalize(uEye-vWorld);
    float distanceToEye=length(uEye-vWorld);
    vec3 light=vec3(.10,.13,.15)*(.72+.28*n.y);
    light+=vec3(.12,.13,.13)*max(dot(n,normalize(vec3(-.45,.85,.35))),0.);
    light*=1.-panel*.18;
    float specularPower=mix(180.,10.,roughness);
    vec3 specularTint=mix(vec3(.32),base*1.45+vec3(.10),metalness);
    vec3 specular=vec3(0.);
    for(int i=0;i<12;i++) {
      if(i>=uLightCount) break;
      vec3 toLight=uLightPosition[i]-vWorld;
      float d=length(toLight);
      vec3 l=toLight/max(d,.001);
      float attenuation=.24/(1.+d*d*.26);
      float diffuse=max(dot(n,l),0.);
      float visibility=i==0?shadow(n,l):1.;
      light+=uLightColor[i]*attenuation*(diffuse*visibility+.035);
      vec3 halfVector=normalize(l+view);
      specular+=uLightColor[i]*attenuation*visibility*pow(max(dot(n,halfVector),0.),specularPower)*specularTint*(1.35-roughness*.7);
    }
    float cone=smoothstep(.58,.97,dot(-view,uForward));
    float torch=cone/(1.+distanceToEye*distanceToEye*.035);
    light+=vec3(.28,.35,.38)*torch*max(dot(n,view),0.);
    light+=vec3(1.,.48,.12)*uEffects.y*2.2/(1.+distanceToEye*distanceToEye*.14);
    if(vOverlay>.5) light+=vec3(.18,.22,.25);
    vec3 color=base*light+specular;
    float pulse=.94+.06*sin(uEffects.x*2.2+vWorld.y*3.);
    color+=base*emission*pulse*1.55;
    float fresnel=pow(1.-max(dot(n,view),0.),4.);
    color+=vec3(.035,.09,.1)*fresnel*(1.-roughness);
    vec3 fogColor=vec3(.009,.018,.024);
    float fog=1.-exp(-distanceToEye*(.014+.008*exp(-max(vWorld.y,0.)*.7)));
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

  const names = ['box','sphere','cylinder','octa','ring'];
  function geometry(low) {
    const data=[], indices=[], ranges={};
    function vertex(p,n) {const i=data.length/6;data.push(...p,...n);return i;}
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
    const longitude=low?8:16,latitude=low?6:10;
    for(let j=0;j<latitude;j++) for(let i=0;i<longitude;i++) {
      const p=[sphere(i*Math.PI*2/longitude,j*Math.PI/latitude),sphere((i+1)*Math.PI*2/longitude,j*Math.PI/latitude),sphere((i+1)*Math.PI*2/longitude,(j+1)*Math.PI/latitude),sphere(i*Math.PI*2/longitude,(j+1)*Math.PI/latitude)];
      if(j>0) triangle(p[0],p[1],p[2],p[0].map(v=>v*2),p[1].map(v=>v*2),p[2].map(v=>v*2));
      if(j<latitude-1) triangle(p[0],p[2],p[3],p[0].map(v=>v*2),p[2].map(v=>v*2),p[3].map(v=>v*2));
    }
    end('sphere');
    begin('cylinder');
    const cylinderSides=low?8:16;
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
    const ringSides=low?12:24,ringTube=low?4:6;
    for(let i=0;i<ringSides;i++) for(let j=0;j<ringTube;j++) {
      const a=i*Math.PI*2/ringSides,b=(i+1)*Math.PI*2/ringSides,c=j*Math.PI*2/ringTube,d=(j+1)*Math.PI*2/ringTube;
      const p=[torus(a,c),torus(b,c),torus(b,d),torus(a,d)],n=[torusNormal(a,c),torusNormal(b,c),torusNormal(b,d),torusNormal(a,d)];
      triangle(p[0],p[1],p[2],n[0],n[1],n[2]);triangle(p[0],p[2],p[3],n[0],n[2],n[3]);
    }
    end('ring');
    return {vertices:new Float32Array(data),indices:new Uint16Array(indices),ranges};
  }

  function pack(meshes) {
    const grouped=names.map(()=>[]);
    for(const mesh of meshes||[]) {
      const i=names.indexOf(mesh.shape||'box');
      if(i>=0) grouped[i].push(mesh);
    }
    const count=grouped.reduce((n,g)=>n+g.length,0),values=new Float32Array(count*16),groups=[];
    let offset=0;
    for(let i=0;i<names.length;i++) {
      const list=grouped[i];
      if(list.length) groups.push({name:names[i],offset:offset*4,count:list.length});
      for(const mesh of list) {
        const p=mesh.p||[0,0,0],s=mesh.s||[1,1,1],r=mesh.r||[0,0,0],c=mesh.color||[0,0,0];
        values.set([p[0],p[1],p[2],mesh.mat||0,s[0],s[1],s[2],mesh.emissive||0,r[0],r[1],r[2],mesh.overlay?1:0,c[0],c[1],c[2],mesh.color?1:0],offset);
        offset+=16;
      }
    }
    return {values,groups};
  }

  function multiply(a,b,out) {
    for(let c=0;c<4;c++) for(let r=0;r<4;r++) out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return out;
  }

  // CPU fallback: actual transformed polygons, perspective projection and near clipping.
  // It intentionally has fewer facets and a shorter draw distance than the GPU renderer.
  function createSoftware(canvas) {
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx) throw new Error('Le rendu graphique est indisponible dans ce navigateur.');
    const source=geometry(true),base={},palette=[[.105,.135,.15],[.36,.18,.065],[.13,.16,.17],[.57,.58,.54],[.025,.74,.77],[1,.42,.06],[.68,.055,.025],[.065,.075,.085]];
    const stats={backend:'canvas2d',webglVersion:0,drawCalls:0,triangles:0,instances:0,contextLost:false,bloom:false,shadows:false};
    let world=[],lights=[],quality='auto',disposed=false,vignette=null;
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
    for(const shape of names) {
      const range=source.ranges[shape],triangles=[];
      for(let j=range.offset/2;j<range.offset/2+range.count;j+=3){
        const v=[];for(let k=0;k<3;k++){const at=source.indices[j+k]*6;v.push(Array.from(source.vertices.subarray(at,at+3)));}triangles.push(v);
      }
      base[shape]=[];
      for(let j=0;j<triangles.length;j++){
        const quad=j+1<triangles.length?merge(triangles[j],triangles[j+1]):null;
        base[shape].push(quad||triangles[j]);if(quad)j++;
      }
    }
    function cache(mesh) {
      const p=mesh.p||[0,0,0],s=mesh.s||[1,1,1],r=mesh.r||[0,0,0],c=r.map(Math.cos),sn=r.map(Math.sin);
      function transform(v){
        let x=v[0]*s[0],y=v[1]*s[1],z=v[2]*s[2];
        [y,z]=[c[0]*y-sn[0]*z,sn[0]*y+c[0]*z];
        [x,z]=[c[1]*x+sn[1]*z,-sn[1]*x+c[1]*z];
        return [c[2]*x-sn[2]*y+p[0],sn[2]*x+c[2]*y+p[1],z+p[2]];
      }
      const mat=Math.max(0,Math.min(7,Math.floor(mesh.mat||0))),color=mesh.color?(mat<4?mesh.color.map(v=>v*.65):mesh.color):palette[mat],shape=mesh.shape||'box';
      const emission=(mesh.emissive||0)+(mat===4?.72:mat===5?.68:mat===6?.18:0);
      const faces=(base[shape]||base.box).map(v=>{
        const points=v.map(transform),n=normal(points),center=[0,0,0];
        for(const q of points)for(let k=0;k<3;k++)center[k]+=q[k]/points.length;
        const grain=.9+Math.abs(Math.sin(center[0]*91.17+center[1]*17.3+center[2]*51.79))*.13;
        const lines=[];
        if(shape==='box'&&points.length===4&&mat<4){
          const a=subtract(points[1],points[0]),b=subtract(points[3],points[0]);
          const na=Math.min(12,Math.floor(Math.hypot(...a)/2)),nb=Math.min(12,Math.floor(Math.hypot(...b)/2));
          for(let i=1;i<na;i++)lines.push([points[0].map((x,k)=>x+a[k]*i/na),points[3].map((x,k)=>x+a[k]*i/na)]);
          for(let i=1;i<nb;i++)lines.push([points[0].map((x,k)=>x+b[k]*i/nb),points[1].map((x,k)=>x+b[k]*i/nb)]);
        }
        return {points,n,center,grain,lines,color,emission,mat,overlay:!!mesh.overlay};
      });
      return {p,radius:Math.hypot(...s)*.5,faces};
    }
    function setWorld(meshes,points){world=(meshes||[]).map(cache);lights=points||[];}
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
      return {width,height,ratio};
    }
    function clip(points,depth,greater){
      const result=[];let previous=points[points.length-1],prevInside=greater?previous[2]>=depth:previous[2]<=depth;
      for(const p of points){
        const inside=greater?p[2]>=depth:p[2]<=depth;
        if(inside!==prevInside){const t=(depth-previous[2])/(p[2]-previous[2]);result.push([previous[0]+(p[0]-previous[0])*t,previous[1]+(p[1]-previous[1])*t,depth]);}
        if(inside)result.push(p);previous=p;prevInside=inside;
      }
      return result;
    }
    function draw(camera,dynamic,fx){
      if(disposed)return;resize();fx=fx||{};
      const width=canvas.width,height=canvas.height,t=fx.time||0,shake=fx.shake||0,p=camera.pos||[0,1.6,0];
      const eye=[p[0]+Math.sin(t*57)*shake*.025,p[1]+Math.sin(t*71)*shake*.015,p[2]],yaw=camera.yaw||0,pitch=camera.pitch||0;
      const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const right=[cy,0,sy],up=[-sy*sp,cp,cy*sp],forward=[sy*cp,sp,-cy*cp];
      const fov=Math.max(40,Math.min(110,camera.fov||75))*Math.PI/180,tan=Math.tan(fov*.5),focal=height/(2*tan),horizontal=tan*width/height;
      const near=.065,far=quality==='low'?26:quality==='high'?42:34;
      const toCamera=v=>{const d=subtract(v,eye);return [dot(d,right),dot(d,up),dot(d,forward)];};
      const project=v=>[width*.5+v[0]*focal/v[2],height*.5-v[1]*focal/v[2]];
      const nearest=lights.map(light=>({light,d:dot(subtract(light.p,eye),subtract(light.p,eye))})).sort((a,b)=>a.d-b.d).slice(0,quality==='low'?4:6).map(entry=>entry.light);
      const faces=[],overlays=[];
      stats.drawCalls=0;stats.triangles=0;stats.instances=0;
      function inView(position,r){
        const center=toCamera(position);
        return !(center[2]+r<near||center[2]-r>far||Math.abs(center[0])>center[2]*horizontal+r*(1+horizontal)||Math.abs(center[1])>center[2]*tan+r*(1+tan));
      }
      function collect(object){
        if(!inView(object.p,object.radius))return;
        stats.instances++;
        for(const face of object.faces){
          if(dot(face.n,subtract(eye,face.center))<=.00001)continue;
          let points=face.points.map(toCamera);
          if(points.every(v=>v[2]<near)||points.every(v=>v[2]>far))continue;
          if(points.some(v=>v[2]<near))points=clip(points,near,true);
          if(points.length<3)continue;
          if(points.some(v=>v[2]>far))points=clip(points,far,false);
          if(points.length<3)continue;
          const screen=points.map(project);
          if(screen.every(v=>v[0]<-2)||screen.every(v=>v[0]>width+2)||screen.every(v=>v[1]<-2)||screen.every(v=>v[1]>height+2))continue;
          const depth=points.reduce((sum,v)=>sum+v[2],0)/points.length;
          (face.overlay?overlays:faces).push({face,screen,depth});
        }
      }
      for(const object of world)collect(object);
      for(const mesh of dynamic||[])if(inView(mesh.p||[0,0,0],Math.hypot(...(mesh.s||[1,1,1]))*.5))collect(cache(mesh));
      ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle='#14252e';ctx.fillRect(0,0,width,height);
      function shade(face){
        const n=face.n,toEye=subtract(eye,face.center),distance=Math.hypot(...toEye)||.001;
        const lit=[.10,.13,.15].map(c=>c*(.72+.28*n[1]));
        const sun=Math.max(0,(-.45*n[0]+.85*n[1]+.35*n[2])/1.022)*.13;
        const head=Math.max(0,dot(n,toEye)/distance)*.35/(1+distance*distance*.035);
        for(let k=0;k<3;k++)lit[k]+=sun+head*(k===0?.8:1)+(face.overlay?.2:0)+(fx.flash||0)*.65/(1+distance*distance*.14);
        for(const light of nearest){
          const l=subtract(light.p,face.center),d2=dot(l,l),d=Math.sqrt(d2)||.001;
          const power=(light.power===undefined?1:light.power)*.24/(1+d2*.26)*(Math.max(0,dot(n,l)/d)+.065),color=light.color||[1,1,1];
          for(let k=0;k<3;k++)lit[k]+=power*color[k];
        }
        const fog=face.overlay?0:Math.min(.9,1-Math.exp(-distance*.027)),fogColor=[.009,.018,.024];
        const rgb=lit.map((value,k)=>{
          let color=face.color[k]*(value*face.grain+face.emission*1.55*(.94+.06*Math.sin(t*2.2+face.center[1]*3)));
          color=color*(1-fog)+fogColor[k]*fog;
          return Math.round(Math.pow(Math.max(0,color)/(Math.max(0,color)+.76),.4545)*255);
        });
        return 'rgb('+rgb.join(',')+')';
      }
      function line(a,b){
        let va=toCamera(a),vb=toCamera(b);
        if((va[2]<near&&vb[2]<near)||(va[2]>far&&vb[2]>far))return;
        for(const depth of [near,far]){
          const aInside=depth===near?va[2]>=depth:va[2]<=depth,bInside=depth===near?vb[2]>=depth:vb[2]<=depth;
          if(aInside!==bInside){const fraction=(depth-va[2])/(vb[2]-va[2]),hit=va.map((x,k)=>x+(vb[k]-x)*fraction);if(!aInside)va=hit;else vb=hit;}
        }
        const a2=project(va),b2=project(vb);ctx.moveTo(...a2);ctx.lineTo(...b2);
      }
      function paint(list){
        list.sort((a,b)=>b.depth-a.depth);
        for(const item of list){
          const {face,screen,depth}=item;ctx.beginPath();ctx.moveTo(...screen[0]);for(let i=1;i<screen.length;i++)ctx.lineTo(...screen[i]);ctx.closePath();
          ctx.fillStyle=shade(face);ctx.fill();stats.drawCalls++;stats.triangles+=screen.length-2;
          // The seams are projected from positions on the actual face, not screen-space stripes.
          // Do not outline individual mesh faces: that reveals triangulation instead of material detail.
          if(face.mat<4&&face.lines.length&&depth<18){
            ctx.beginPath();for(const segment of face.lines)line(segment[0],segment[1]);ctx.strokeStyle='rgba(2,7,10,.42)';ctx.lineWidth=1.5;ctx.stroke();
            if(quality!=='low'&&depth<10){ctx.strokeStyle='rgba(128,180,176,.19)';ctx.lineWidth=.45;ctx.stroke();}
          }
        }
      }
      paint(faces);paint(overlays);
      ctx.fillStyle=vignette;ctx.fillRect(0,0,width,height);
      if(fx.damage>0){ctx.fillStyle='rgba(190,12,2,'+Math.min(.3,fx.damage*.22)+')';ctx.fillRect(0,0,width,height);}
      if(fx.pulse>0){
        const strength=Math.min(1,fx.pulse),radius=(1-strength)*height*.8;
        ctx.beginPath();ctx.arc(width*.5,height*.5,Math.max(1,radius),0,Math.PI*2);ctx.strokeStyle='rgba(82,248,216,'+(strength*.35)+')';ctx.lineWidth=height*.018;ctx.stroke();
      }
    }
    function dispose(){disposed=true;world=[];lights=[];vignette=null;}
    return {setWorld,draw,resize,dispose,stats};
  }

  function create(canvas) {
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,powerPreference:'high-performance'});
    if(!gl) return createSoftware(canvas);
    const source=geometry(),view=new Float32Array(16),projection=new Float32Array(16),vp=new Float32Array(16);
    const shadowView=new Float32Array(16),shadowProjection=new Float32Array(16),shadowMatrix=new Float32Array(16);
    const lightPositions=new Float32Array(36),lightColors=new Float32Array(36);
    const stats={drawCalls:0,triangles:0,instances:0,contextLost:false,webglVersion:2,backend:'webgl2',bloom:false,shadows:false};
    let program,depthProgram,postProgram,vao,postVao,vbo,ibo,worldBuffer,dynamicBuffer,overlayBuffer,uniforms,postUniforms,depthMatrix;
    let post=null,shadowTarget=null,whiteTexture=null,targetKey='',shadowLight=null;
    let world=[],lights=[],worldBatch=pack([]),quality='auto',disposed=false;

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
      freePost();deleteTarget(shadowTarget);shadowTarget=null;
      if(quality==='low'){stats.bloom=stats.shadows=false;return;}
      const width=canvas.width,height=canvas.height,bw=Math.max(1,Math.ceil(width/4)),bh=Math.max(1,Math.ceil(height/4));
      const scene=colorTarget(width,height,true),a=colorTarget(bw,bh,false),b=colorTarget(bw,bh,false);
      if(scene&&a&&b)post={scene,a,b};else{deleteTarget(scene);deleteTarget(a);deleteTarget(b);}
      const size=quality==='high'?1024:512;
      const target={framebuffer:gl.createFramebuffer(),texture:texture(size,size,true),size};
      gl.bindFramebuffer(gl.FRAMEBUFFER,target.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,target.texture,0);
      gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE)shadowTarget=target;else deleteTarget(target);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
      stats.bloom=!!post;stats.shadows=!!shadowTarget;
    }
    function initialize() {
      program=link(VERT,FRAG);depthProgram=link(VERT,DEPTH_FRAG);postProgram=link(POST_VERT,POST_FRAG);
      uniforms={};for(const name of ['uViewProjection','uEye','uForward','uLightPosition','uLightColor','uLightCount','uResolution','uEffects','uShadowMap','uShadowMatrix','uShadowSettings']) uniforms[name]=gl.getUniformLocation(program,name);
      postUniforms={};for(const name of ['uScene','uBloom','uTexel','uPass'])postUniforms[name]=gl.getUniformLocation(postProgram,name);
      depthMatrix=gl.getUniformLocation(depthProgram,'uViewProjection');
      vao=gl.createVertexArray();gl.bindVertexArray(vao);
      vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,source.vertices,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);
      gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
      ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,source.indices,gl.STATIC_DRAW);
      for(let i=2;i<6;i++) {gl.enableVertexAttribArray(i);gl.vertexAttribDivisor(i,1);}
      worldBuffer=gl.createBuffer();dynamicBuffer=gl.createBuffer();overlayBuffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,worldBuffer);gl.bufferData(gl.ARRAY_BUFFER,worldBatch.values,gl.STATIC_DRAW);
      postVao=gl.createVertexArray();
      whiteTexture=texture(1,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
      gl.clearColor(.035,.06,.073,1);
      post=null;shadowTarget=null;targetKey='';shadowLight=null;
      stats.contextLost=false;
    }
    initialize();

    function setWorld(meshes,points) {
      world=meshes||[];lights=points||[];worldBatch=pack(world);shadowLight=null;
      if(stats.contextLost||disposed) return;
      gl.bindBuffer(gl.ARRAY_BUFFER,worldBuffer);gl.bufferData(gl.ARRAY_BUFFER,worldBatch.values,gl.STATIC_DRAW);
    }
    function resize(next) {
      if(next!==undefined) quality=next;
      const pixelRatio=window.devicePixelRatio||1;
      let ratio=typeof quality==='number'?quality:quality==='low'?.8:quality==='high'?Math.min(pixelRatio,2):Math.min(pixelRatio,1.5);
      ratio=Math.max(.5,Math.min(2,ratio));
      const width=Math.max(1,Math.round((canvas.clientWidth||window.innerWidth||800)*ratio));
      const height=Math.max(1,Math.round((canvas.clientHeight||window.innerHeight||600)*ratio));
      if(canvas.width!==width||canvas.height!==height) {canvas.width=width;canvas.height=height;}
      ensureTargets();
      gl.viewport(0,0,width,height);
      return {width,height,ratio};
    }
    function renderBatch(batch,buffer,upload,shadowPass=false) {
      if(!batch.groups.length) return;
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      if(upload) gl.bufferData(gl.ARRAY_BUFFER,batch.values,gl.DYNAMIC_DRAW);
      for(const group of batch.groups) {
        for(let i=2;i<6;i++) gl.vertexAttribPointer(i,4,gl.FLOAT,false,64,group.offset+(i-2)*16);
        const shape=source.ranges[group.name];
        gl.drawElementsInstanced(gl.TRIANGLES,shape.count,gl.UNSIGNED_SHORT,shape.offset,group.count);
        stats.drawCalls++;stats.triangles+=shape.count/3*group.count;if(!shadowPass)stats.instances+=group.count;
      }
    }
    function shadowPass(light,dynamicBatch){
      const p=light.p;
      shadowView.set([1,0,0,0,0,0,1,0,0,-1,0,0,-p[0],p[2],-p[1],1]);
      const f=1/Math.tan(138*Math.PI/360),near=.15,far=32;
      shadowProjection.fill(0);shadowProjection[0]=shadowProjection[5]=f;shadowProjection[10]=(far+near)/(near-far);shadowProjection[11]=-1;shadowProjection[14]=2*far*near/(near-far);
      multiply(shadowProjection,shadowView,shadowMatrix);
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadowTarget.framebuffer);gl.viewport(0,0,shadowTarget.size,shadowTarget.size);
      gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(depthProgram);gl.bindVertexArray(vao);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.1,2.0);gl.uniformMatrix4fv(depthMatrix,false,shadowMatrix);
      renderBatch(worldBatch,worldBuffer,false,true);renderBatch(dynamicBatch,dynamicBuffer,true,true);gl.disable(gl.POLYGON_OFFSET_FILL);
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
    function draw(camera,dynamic,fx) {
      if(disposed||stats.contextLost) return;
      resize();fx=fx||{};
      const t=fx.time||0,shake=fx.shake||0,p=camera.pos||[0,1.6,0];
      const yaw=camera.yaw||0,pitch=camera.pitch||0;
      const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const right=[cy,0,sy],up=[-sy*sp,cp,cy*sp],forward=[sy*cp,sp,-cy*cp];
      const eye=[p[0]+Math.sin(t*57.)*shake*.025,p[1]+Math.sin(t*71.)*shake*.015,p[2]];
      view.set([right[0],up[0],-forward[0],0,right[1],up[1],-forward[1],0,right[2],up[2],-forward[2],0,
        -(right[0]*eye[0]+right[1]*eye[1]+right[2]*eye[2]),-(up[0]*eye[0]+up[1]*eye[1]+up[2]*eye[2]),forward[0]*eye[0]+forward[1]*eye[1]+forward[2]*eye[2],1]);
      const fov=Math.max(40,Math.min(110,camera.fov||75))*Math.PI/180,f=1/Math.tan(fov*.5),near=.045,far=180;
      projection.fill(0);projection[0]=f/(canvas.width/canvas.height);projection[5]=f;projection[10]=(far+near)/(near-far);projection[11]=-1;projection[14]=2*far*near/(near-far);
      multiply(projection,view,vp);
      const distanceTo=light=>(light.p[0]-eye[0])**2+(light.p[1]-eye[1])**2+(light.p[2]-eye[2])**2;
      const sorted=lights.map(light=>({light,d:distanceTo(light)})).sort((a,b)=>a.d-b.d);
      const candidate=sorted.find(entry=>entry.light.p[1]>=2.5&&(entry.light.power||1)>=7)||sorted.find(entry=>entry.light.p[1]>=2.5);
      if(candidate&&(!shadowLight||distanceTo(shadowLight)>candidate.d*1.35+5))shadowLight=candidate.light;
      if(!candidate)shadowLight=null;
      const selected=sorted.filter(entry=>entry.light!==shadowLight).slice(0,(quality==='low'?6:12)-(shadowLight?1:0));
      if(shadowLight)selected.unshift({light:shadowLight,d:distanceTo(shadowLight)});
      lightPositions.fill(0);lightColors.fill(0);
      selected.forEach(({light},i)=>{lightPositions.set(light.p,i*3);const c=light.color||[1,1,1],power=light.power===undefined?1:light.power;lightColors.set([c[0]*power,c[1]*power,c[2]*power],i*3);});
      const ordinary=[],overlay=[];for(const mesh of dynamic||[]) (mesh.overlay?overlay:ordinary).push(mesh);
      const dynamicBatch=pack(ordinary);
      stats.drawCalls=0;stats.triangles=0;stats.instances=0;stats.bloom=!!post;stats.shadows=!!shadowTarget&&!!shadowLight;
      if(stats.shadows)shadowPass(shadowLight,dynamicBatch);
      gl.bindFramebuffer(gl.FRAMEBUFFER,post?post.scene.framebuffer:null);gl.viewport(0,0,canvas.width,canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindVertexArray(vao);
      gl.uniformMatrix4fv(uniforms.uViewProjection,false,vp);gl.uniform3fv(uniforms.uEye,eye);gl.uniform3fv(uniforms.uForward,forward);
      gl.uniform3fv(uniforms.uLightPosition,lightPositions);gl.uniform3fv(uniforms.uLightColor,lightColors);gl.uniform1i(uniforms.uLightCount,selected.length);
      gl.uniform2f(uniforms.uResolution,canvas.width,canvas.height);gl.uniform4f(uniforms.uEffects,t,fx.flash||0,fx.damage||0,Math.max(0,Math.min(1,fx.pulse||0)));
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,stats.shadows?shadowTarget.texture:whiteTexture);gl.uniform1i(uniforms.uShadowMap,2);
      gl.uniformMatrix4fv(uniforms.uShadowMatrix,false,shadowMatrix);gl.uniform2f(uniforms.uShadowSettings,stats.shadows?1:0,shadowTarget?1/shadowTarget.size:1);
      renderBatch(worldBatch,worldBuffer,false);
      renderBatch(dynamicBatch,dynamicBuffer,!stats.shadows);
      if(overlay.length) {gl.clear(gl.DEPTH_BUFFER_BIT);renderBatch(pack(overlay),overlayBuffer,true);}
      if(post)postPass();
    }
    function lost(event){event.preventDefault();stats.contextLost=true;}
    function restored(){if(!disposed) initialize();}
    canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
    function dispose() {
      if(disposed) return;disposed=true;
      canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);
      for(const buffer of [vbo,ibo,worldBuffer,dynamicBuffer,overlayBuffer]) gl.deleteBuffer(buffer);
      freePost();deleteTarget(shadowTarget);gl.deleteTexture(whiteTexture);
      gl.deleteVertexArray(vao);gl.deleteVertexArray(postVao);gl.deleteProgram(program);gl.deleteProgram(depthProgram);gl.deleteProgram(postProgram);
    }
    return {setWorld,draw,resize,dispose,stats};
  }
  window.FRender={create};
})();
