/* METAL — original procedural humanoid machines (David, 16/11/2026): a chrome
   endoskeleton, a liquid-metal runner and a headless bomber. Their bodies are
   generated at runtime from the parametric human of EMPRISE (same author):
   no imported model, texture or capture. Each body part is one rigid free
   shape attached to a joint; FActors poses them. */
(function(G){'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  const mesh=()=>({positions:[],indices:[]});
  function vertex(m,p){m.positions.push(p);return m.positions.length-1;}
  // EMPRISE: shape-preserving cubic interpolation of [y, rx, rz, cz…] rows.
  function profile(y,rows){
    if(y<=rows[0][0])return rows[0].slice(1);let i=1;while(i<rows.length-1&&y>rows[i][0])i++;
    const a=rows[i-1],b=rows[i],h=b[0]-a[0],t=clamp((y-a[0])/h),slope=(j,k)=>{if(j===0)return (rows[1][k]-rows[0][k])/(rows[1][0]-rows[0][0]);if(j===rows.length-1)return (rows[j][k]-rows[j-1][k])/(rows[j][0]-rows[j-1][0]);const h0=rows[j][0]-rows[j-1][0],h1=rows[j+1][0]-rows[j][0],d0=(rows[j][k]-rows[j-1][k])/h0,d1=(rows[j+1][k]-rows[j][k])/h1;if(d0*d1<=0)return 0;return 3*(h0+h1)/((2*h1+h0)/d0+(h1+2*h0)/d1);};
    return a.slice(1).map((v,k)=>{k++;const n=(2*t*t*t-3*t*t+1)*v+(t*t*t-2*t*t+t)*h*slope(i-1,k)+(-2*t*t*t+3*t*t)*b[k]+(t*t*t-t*t)*h*slope(i,k);return clamp(n,Math.min(v,b[k]),Math.max(v,b[k]));});
  }
  function surface(m,{bottom,top,rows,sides,point,cap=true}){
    const start=m.positions.length;
    for(let j=0;j<=rows;j++){const y=bottom+(top-bottom)*j/rows;for(let i=0;i<sides;i++)vertex(m,point(y,i*Math.PI*2/sides));}
    for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){const a=start+j*sides+i,b=a+sides,c=start+j*sides+(i+1)%sides,d=c+sides;m.indices.push(a,b,c,c,b,d);}
    if(cap)for(const [j,flip] of [[0,true],[rows,false]]){const p=[0,0,0];for(let i=0;i<sides;i++)for(let k=0;k<3;k++)p[k]+=m.positions[start+j*sides+i][k]/sides;const centre=vertex(m,p);for(let i=0;i<sides;i++){const a=start+j*sides+i,b=start+j*sides+(i+1)%sides;m.indices.push(centre,...(flip?[a,b]:[b,a]));}}
  }
  function ellipsoid(m,centre,radii,{rows=6,sides=10,tilt=0}={}){
    const start=m.positions.length,ct=Math.cos(tilt),st=Math.sin(tilt);
    for(let j=0;j<=rows;j++)for(let i=0;i<sides;i++){const v=j*Math.PI/rows,u=i*Math.PI*2/sides,x=radii[0]*Math.sin(v)*Math.cos(u),y=radii[1]*Math.cos(v),z=radii[2]*Math.sin(v)*Math.sin(u);vertex(m,[centre[0]+ct*x-st*y,centre[1]+st*x+ct*y,centre[2]+z]);}
    for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){const a=start+j*sides+i,b=a+sides,c=start+j*sides+(i+1)%sides,d=c+sides;if(j>0)m.indices.push(a,d,b);if(j<rows-1)m.indices.push(a,c,d);}
  }
  const g=(x,y,cx,cy,sx,sy)=>Math.exp(-(((x-cx)/sx)**2+((y-cy)/sy)**2));
  const HEAD=[[1.525,.028,.028,.018],[1.55,.057,.049,.026],[1.585,.079,.066,.021],[1.625,.091,.080,.008],[1.67,.095,.086,0],[1.71,.093,.083,-.002],[1.75,.092,.078,-.007],[1.79,.080,.067,-.012],[1.815,.055,.047,-.015],[1.827,.006,.006,-.015]];
  // A human face (liquid metal) or a bare skull with deep sockets and cheekbones (endoskeleton).
  function head(skull){
    const m=mesh();
    surface(m,{bottom:1.525,top:1.827,rows:18,sides:24,point(y,a){
      const [rx,rz,cz]=profile(y,HEAD),x=rx*Math.cos(a),front=Math.max(0,Math.sin(a))**6;let z=cz+rz*Math.sin(a);
      z+=front*(skull?-.006*g(x,y,0,1.669,.016,.024)-.017*g(x,y,-.038,1.700,.019,.015)-.017*g(x,y,.038,1.700,.019,.015)+.010*g(x,y,-.060,1.662,.020,.014)+.010*g(x,y,.060,1.662,.020,.014)+.006*g(x,y,0,1.615,.040,.010)
        :.023*g(x,y,0,1.669,.022,.030)+.010*g(x,y,0,1.703,.015,.042)+.008*g(x,y,-.054,1.660,.026,.023)+.008*g(x,y,.054,1.660,.026,.023)-.010*g(x,y,-.038,1.703,.021,.013)-.010*g(x,y,.038,1.703,.021,.013)+.009*g(x,y,0,1.611,.036,.008)-.003*g(x,y,0,1.617,.040,.003));
      return [x*(skull?1-.08*smooth(1.58,1.64,y)*(1-smooth(1.64,1.68,y)):1),y,z];}});
    if(!skull)for(const side of [-1,1])ellipsoid(m,[side*.097,1.669,-.008],[.014,.034,.020],{rows:4,sides:8});
    surface(m,{bottom:1.465,top:1.555,rows:3,sides:12,point(y,a){const rx=(skull?.036:.053)+smooth(1.51,1.555,y)*.009;return [rx*Math.cos(a),y,.004+(skull?.034:.050)*Math.sin(a)];}});
    return m;
  }
  const SHIRT=[[1.035,.195,.140],[1.11,.197,.145],[1.24,.207,.150],[1.36,.219,.143],[1.43,.216,.122],[1.475,.150,.088],[1.495,.077,.066],[1.512,.070,.064],[1.532,.067,.061]];
  function torso(){const m=mesh();surface(m,{bottom:1.035,top:1.532,rows:12,sides:18,point(y,a){const [rx,rz]=profile(y,SHIRT);return [rx*Math.cos(a),y-.018*smooth(1.475,1.532,y)*Math.max(0,Math.sin(a))**2,rz*Math.sin(a)];}});return m;}
  function pelvis(){const m=mesh();surface(m,{bottom:.86,top:1.045,rows:5,sides:18,point(y,a){const [rx,rz]=profile(y,[[.86,.150,.104],[.95,.185,.127],[1.045,.196,.141]]);return [rx*Math.cos(a),y,rz*Math.sin(a)];}});return m;}
  const ARM=[[.955,.045,.049],[1.04,.053,.058],[1.12,.058,.063],[1.19,.057,.062],[1.30,.069,.076],[1.40,.070,.076],[1.43,.061,.068],[1.465,.036,.043],[1.485,.012,.018]];
  function armPoint(side){return (y,a)=>{const [rx,rz]=profile(y,ARM),t=clamp((1.43-y)/.24),lower=clamp((1.19-y)/.24),cx=side*(y>1.43?.235-.085*smooth(1.43,1.485,y):y<1.19?.255+.005*lower:.235+.020*t),cz=.015*lower;return [cx+rx*Math.cos(a),y-.026*smooth(1.27,1.43,y)*Math.max(0,side*Math.cos(a))**2,cz+rz*Math.sin(a)];};}
  function upperArm(side){const m=mesh();surface(m,{bottom:1.165,top:1.485,rows:10,sides:10,point:armPoint(side)});return m;}
  function foreArm(side){const m=mesh();surface(m,{bottom:.955,top:1.235,rows:8,sides:10,point:armPoint(side)});return m;}
  function hand(side){
    const m=mesh(),lengths=[.045,.057,.054,.043],offsets=[-.027,-.009,.010,.027];
    ellipsoid(m,[side*.26,.910,.015],[.042,.057,.024],{rows:6,sides:10});
    for(let f=0;f<4;f++)ellipsoid(m,[side*(.26+offsets[f]),.861-lengths[f]/2,.018],[.0095,lengths[f]/2+.009,.0105],{rows:4,sides:6});
    ellipsoid(m,[side*.216,.900,.026],[.012,.030,.014],{tilt:side*.42,rows:5,sides:6});return m;
  }
  const LEG=[[.145,.058,.065],[.29,.072,.082],[.45,.078,.086],[.54,.080,.088],[.72,.096,.107],[.88,.103,.115],[1.0,.102,.119]];
  const legPoint=side=>(y,a)=>{const [rx,rz]=profile(y,LEG);return [side*.105+rx*Math.cos(a),y,rz*Math.sin(a)];};
  function thigh(side){const m=mesh();surface(m,{bottom:.50,top:1.0,rows:10,sides:12,point:legPoint(side)});return m;}
  function shin(side){const m=mesh();surface(m,{bottom:.145,top:.56,rows:9,sides:12,point:legPoint(side)});return m;}
  function foot(side){const m=mesh();surface(m,{bottom:.005,top:.15,rows:5,sides:12,point(y,a){const [rx,rz,cz]=profile(y,[[.005,.052,.110,.027],[.020,.059,.126,.035],[.052,.060,.124,.032],[.088,.055,.105,.023],[.115,.047,.071,.010],[.15,.041,.052,0]]);return [side*.105+rx*Math.cos(a)*(1-.08*Math.max(0,Math.sin(a))),y,cz+rz*Math.sin(a)];}});return m;}
  // EMPRISE models face +z; METAL faces -z. Mirror z, keep the winding outward,
  // smooth the normals and fit the triangles to the unit cube of a free shape.
  function shape(name,m){
    const p=m.positions.map(q=>[q[0],q[1],-q[2]]),n=p.map(()=>[0,0,0]),tri=[];
    for(let i=0;i<m.indices.length;i+=3){const ids=[m.indices[i],m.indices[i+2],m.indices[i+1]],[a,b,c]=ids.map(j=>p[j]),u=b.map((v,k)=>v-a[k]),v=c.map((w,k)=>w-a[k]),f=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const j of ids)for(let k=0;k<3;k++)n[j][k]+=f[k];tri.push(ids);}
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const q of p)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],q[k]);hi[k]=Math.max(hi[k],q[k]);}
    const centre=lo.map((v,k)=>(v+hi[k])/2),size=lo.map((v,k)=>Math.max(1e-4,hi[k]-v)),unit=v=>{const l=Math.hypot(...v);return l>1e-10?v.map(x=>x/l):[0,1,0];};
    const triangles=tri.map(ids=>[...ids.map(j=>p[j].map((v,k)=>(v-centre[k])/size[k])),...ids.map(j=>unit(unit(n[j]).map((v,k)=>v*size[k])))]);
    const id='metal-hum-'+name;let registered=false;
    if(G.FRender&&typeof G.FRender.forme==='function'){try{G.FRender.forme(id,triangles);registered=true;}catch(error){registered=false;}}
    return {shape:id,centre,size,triangles:triangles.length,registered};
  }
  const sides=f=>[f(-1),f(1)];
  const parts={face:shape('face',head(false)),skull:shape('skull',head(true)),torso:shape('torso',torso()),pelvis:shape('pelvis',pelvis()),
    upper:sides(s=>shape('upper-'+s,upperArm(s))),fore:sides(s=>shape('fore-'+s,foreArm(s))),hand:sides(s=>shape('hand-'+s,hand(s))),
    thigh:sides(s=>shape('thigh-'+s,thigh(s))),shin:sides(s=>shape('shin-'+s,shin(s))),foot:sides(s=>shape('foot-'+s,foot(s)))};
  // Joint pivots in METAL space (front -z); side -1 is the left of the body.
  const pivots={hip:.97,waist:1.035,neck:1.50,shoulder:s=>[s*.235,1.43,0],elbow:s=>[s*.255,1.19,-.015],wrist:s=>[s*.26,.955,-.015],leg:s=>[s*.105,.97,0],knee:s=>[s*.105,.52,0],ankle:s=>[s*.105,.145,0]};
  // EMPRISE gait: two-joint leg inverse kinematics along a smooth step cycle.
  const GAIT=Object.freeze({duty:.52,stride:.30,lift:.09,drop:.072,thigh:.45,shin:.375,ankleY:.145});
  // crouch lowers the hips (body units): the same solve bends the knees.
  function gait(phase,amount=1,crouch=0){
    amount=clamp(amount,0,1.6);const q=GAIT,u=((phase/(Math.PI*2))%1+1)%1,s=u<q.duty?0:(u-q.duty)/(1-q.duty),swing=u>=q.duty,t=s*s*(3-2*s),z=q.stride*amount*(swing?-1+2*t:1-2*u/q.duty),lift=swing?q.lift*amount*Math.sin(Math.PI*s)**2:0,bodyY=-q.drop*Math.min(1,amount)+.003*amount*Math.cos(phase*2)-clamp(crouch,0,.6),dy=.97+bodyY-q.ankleY-lift,d=Math.max(.05,Math.min(q.thigh+q.shin-.00001,Math.hypot(dy,z))),knee=-Math.acos(clamp((d*d-q.thigh*q.thigh-q.shin*q.shin)/(2*q.thigh*q.shin),-1,1)),hip=Math.atan2(z,dy)+Math.acos(clamp((q.thigh*q.thigh+d*d-q.shin*q.shin)/(2*q.thigh*d),-1,1));
    return {hip,knee,ankle:-hip-knee,bodyY,lift,z,stance:!swing};
  }
  const triangles=Object.values(parts).flat().reduce((n,q)=>n+q.triangles,0);
  G.MetalHumanoids=Object.freeze({parts,pivots,gait,triangles,registered:Object.values(parts).flat().every(q=>q.registered),provenance:'EMPRISE parametric human, original runtime code'});
})(typeof window!=='undefined'?window:globalThis);
