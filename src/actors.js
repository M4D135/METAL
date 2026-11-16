/* FERRO — original articulated mechanical actors. No models or textures imported. */
(function (G) {
  'use strict';
  const PI=Math.PI,TAU=PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const identity=[1,0,0,0,1,0,0,0,1];
  // Renderer order is Rz * Ry * Rx. Compose complete joint frames so a rolled
  // shoulder, gun elevation and world heading keep the same physical axes.
  function rotation(x=0,y=0,z=0){
    const a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z);
    return [e*c,e*d*b-f*a,e*d*a+f*b,f*c,f*d*b+e*a,f*d*a-e*b,-d,c*b,c*a];
  }
  function product(a,b){const c=new Array(9);for(let r=0;r<3;r++)for(let k=0;k<3;k++)c[r*3+k]=a[r*3]*b[k]+a[r*3+1]*b[k+3]+a[r*3+2]*b[k+6];return c;}
  // RESTE-08 : les calculs intermédiaires (rotation d'une articulation, produit de deux cadres,
  // décomposition d'un axe) écrivent dans des tampons flottants du module. Seules les valeurs
  // réellement stockées dans un maillage — p, s, r — sont des tableaux frais.
  const MAT=new Float64Array(9),MAT2=new Float64Array(9),MAT3=new Float64Array(9),EUL=new Float64Array(3);
  const LIMB_INSET=/(?:thigh|shin|upper-arm|forearm)/;
  // Guardian joints in horde worlds, as in simulation.js (giant frame before scaling).
  const JOINTS_HUMAN=[[-.62,2.36,-.30],[.62,2.36,-.30],[-.28,1.45,-.45],[.28,1.45,-.45]],JOINTS_ROBOT=[[-1.36,2.31,.05],[1.36,2.31,.05],[-.62,1.37,-.62],[.62,1.37,-.62]],JOINT_R=.15;
  const LIVERIES=[null,[[.45,.38,.27],[.31,.27,.21],[.66,.46,.17]],[[.64,.66,.68],[.40,.43,.47],[.16,.46,.62]],[[.40,.19,.13],[.28,.20,.17],[.72,.55,.24]],[[.12,.13,.14],[.21,.22,.24],[.88,.42,.08]],[[.23,.32,.19],[.17,.22,.15],[.76,.70,.20]]];
  function rotationTo(o,x,y,z){
    const a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z);
    o[0]=e*c;o[1]=e*d*b-f*a;o[2]=e*d*a+f*b;o[3]=f*c;o[4]=f*d*b+e*a;o[5]=f*d*a-e*b;o[6]=-d;o[7]=c*b;o[8]=c*a;return o;
  }
  function productTo(o,a,b){
    for(let r=0;r<3;r++){const a0=a[r*3],a1=a[r*3+1],a2=a[r*3+2];
      o[r*3]=a0*b[0]+a1*b[3]+a2*b[6];o[r*3+1]=a0*b[1]+a1*b[4]+a2*b[7];o[r*3+2]=a0*b[2]+a1*b[5]+a2*b[8];}
    return o;
  }
  function anglesTo(o,m){
    const y=Math.asin(clamp(-m[6],-1,1)),c=Math.cos(y);
    if(Math.abs(c)>.000001){o[0]=Math.atan2(m[7],m[8]);o[1]=y;o[2]=Math.atan2(m[3],m[0]);}
    else{o[0]=Math.atan2(-m[5],m[4]);o[1]=y;o[2]=0;}
    return o;
  }
  function angles(m){anglesTo(EUL,m);return [EUL[0],EUL[1],EUL[2]];}
  function point(f,p){const a=f.b;return [f.p[0]+a[0]*p[0]+a[1]*p[1]+a[2]*p[2],f.p[1]+a[3]*p[0]+a[4]*p[1]+a[5]*p[2],f.p[2]+a[6]*p[0]+a[7]*p[1]+a[8]*p[2]];}
  function frame(parent,p,r=[0,0,0]){productTo(MAT2,parent.b,rotationTo(MAT,r[0],r[1],r[2]));const b=[MAT2[0],MAT2[1],MAT2[2],MAT2[3],MAT2[4],MAT2[5],MAT2[6],MAT2[7],MAT2[8]];return {p:point(parent,p),b,r:angles(b)};}
  function build(e,options={}) {
    if(e.hp!==undefined&&e.hp<=0)return [];
    const time=Number.isFinite(options.time)?options.time:0,type=clamp(Math.floor(e.type||0),0,3),distance=Math.max(0,Number(options.distance)||0);
    const scale=type===3&&Number.isFinite(e.bossScale)?clamp(e.bossScale,1,9):1,giant=scale>1;
    const canvas=options.backend==='canvas2d',low=options.quality==='low',near=low?7:canvas?9:11,far=canvas?22:low?26:35;
    // A thirty-metre silhouette needs close geometry at a very different distance
    // from a human-sized patrol. The LOD decision follows its projected size.
    const lod=distance/scale<near?0:distance/scale<far?1:2,stun=e.stun>0,charge=e.windup>0?clamp(1-e.windup/(e.windupMax||1),0,1):0;
    const rich=lod===0&&!canvas&&!low,tellFamily=giant&&e.windup>0?({'Écrasement':'slam','Onde de choc':'ring','Barrage de roquettes':'rocketZone','Balayage':'sweep','Charge':'slam','Tapis de bombes':'rocketZone','Rayon du cœur':'sweep'}[e.attackLabel]||''):'',tellPose=clamp(1-(e.windup||0)/(e.windupMax||1),0,1);
    const airborne=!!e.airborne;
    const aim=e.attackState==='aim'||e.attackState==='burst'||e.windup>0?1:0,rush=e.attackState==='rush';
    const phase=Number.isFinite(options.phase)?options.phase:time*(e.moveSpeed||0)*4.8/scale+(e.id||0)*.7;
    const blend=stun?0:clamp(options.blend??(e.moveSpeed||0)/1.4,0,1),base=Number.isFinite(e.baseY)?e.baseY:(Number(e.y)||[1.35,1.05,1.6,1.8][type])-[1.35,1.05,1.6,1.8][type];
    // options.yaw: displayed heading, eased by the host; the simulation keeps its own.
    const yaw=Number.isFinite(options.yaw)?-options.yaw:Number.isFinite(e.yaw)?-e.yaw:0,b=rotation(0,yaw,0),root={p:[e.x||0,base,e.z||0],b,r:angles(b)},out=[];
    const impact=giant?0:clamp((e.hurt||0)/.2,0,1),hurt=clamp((e.hurt||0)*3,0,.45),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
    const palette={shell:mix([.24,.28,.31],[.61,.54,.43],hurt),steel:[.56,.62,.64],edge:[.34,.39,.42],trim:[.34,.29,.22],dark:[.085,.105,.12],rubber:[.055,.068,.078],glass:[.10,.20,.23]};
    if(giant){
      const scheme=e.bossKind==='siegebreaker'?[[.23,.20,.18],[.37,.29,.22],[.60,.34,.13]]:e.bossKind==='custodian'?[[.43,.46,.43],[.25,.32,.34],[.57,.52,.36]]:[[.25,.29,.25],[.37,.41,.32],[.49,.37,.23]];
      palette.shell=mix(scheme[0],[.66,.49,.30],hurt);palette.edge=scheme[1];palette.trim=scheme[2];
    }
    // Chapter liveries for the machines (David, 16/11/2026): desert, arctic,
    // rust, black and toxic. The guardians keep their own schemes.
    const livery=!giant&&Number.isInteger(e.livery)?LIVERIES[e.livery]:null;
    if(livery){palette.shell=mix(livery[0],[.61,.54,.43],hurt);palette.edge=livery[1];palette.trim=livery[2];}
    // The playable heavy reuses this frame with its own livery and visor.
    if(options.palette)for(const key of Object.keys(palette))if(Array.isArray(options.palette[key]))palette[key]=options.palette[key];
    const peaceful=e.awareness==='patrol',scanning=e.awareness==='search'||e.awareness==='investigate';
    const signal=Array.isArray(options.signal)?options.signal:stun||peaceful?[.20,.67,.70]:charge||scanning?[.86,.49,.14]:[.80,.20,.075];
    const emission=stun?.20+.08*Math.sin(time*9):.28+charge*.45,signalMat=Array.isArray(options.signal)?4:stun||peaceful?4:charge||scanning?5:6;
    function piece(name,shape,p,s,skin='shell',f=root,r=null,mat=0,emissive=0){
      const color=Array.isArray(skin)?skin:palette[skin],rot=r?angles(productTo(MAT2,f.b,rotationTo(MAT,r[0],r[1],r[2]))):f.r;
      const m=G.FRender.mesh(shape,point(f,p),s,mat,rot,emissive);m.color=color;m.surface='object';m.actorPart=name;m.actorLod=lod;out.push(m);return m;
    }
    const box=(n,p,s,skin='shell',f=root,r=null)=>piece(n,'box',p,s,skin,f,r,skin==='rubber'?7:0);
    const armor=(n,p,s,skin='shell',f=root,r=null)=>piece(n,lod===0?'bevel':'box',p,s,skin,f,r);
    const cyl=(n,p,s,skin='steel',f=root,r=null)=>piece(n,'cylinder',p,s,skin,f,r,skin==='rubber'?7:0);
    const ring=(n,p,s,skin='edge',f=root,r=null)=>piece(n,'ring',p,s,skin,f,r);
    const eye=(n,p,s,f=root,r=null,shape='box')=>piece(n,shape,p,s,signal,f,r,signalMat,emission);
    function limb(name,a,c,width,depth,skin='edge',shape='box',reference=root.b){return limbPiece(name,a,c,width,depth,skin,shape,reference);}
    function limbPiece(name,a,c,width,depth,skin='edge',shape='box',reference=root.b){
      const ddx=c[0]-a[0],ddy=c[1]-a[1],ddz=c[2]-a[2],length=Math.hypot(ddx,ddy,ddz);
      if(length<.0001)return;
      const yx=ddx/length,yy=ddy/length,yz=ddz/length;
      const axis=Math.abs(reference[0]*yx+reference[3]*yy+reference[6]*yz)>.95?2:0;
      const rx=reference[axis],ry=reference[axis+3],rz=reference[axis+6],dot=rx*yx+ry*yy+rz*yz;
      const sx=rx-dot*yx,sy=ry-dot*yy,sz=rz-dot*yz,n=Math.hypot(sx,sy,sz),xx=sx/n,xy=sy/n,xz=sz/n;
      MAT3[0]=xx;MAT3[1]=yx;MAT3[2]=xy*yz-xz*yy;MAT3[3]=xy;MAT3[4]=yy;MAT3[5]=xz*yx-xx*yz;MAT3[6]=xz;MAT3[7]=yz;MAT3[8]=xx*yy-xy*yx;
      anglesTo(EUL,MAT3);
      const inset=LIMB_INSET.test(name)?Math.min(length*.24,width*.42):0;
      return piece(name,shape,[0,0,0],[width,length-inset,depth],skin,{p:[(a[0]+c[0])/2,(a[1]+c[1])/2,(a[2]+c[2])/2],b:MAT3,r:[EUL[0],EUL[1],EUL[2]]});
    }
    function joint(name,p,size,skin='dark',f=root){return cyl(name,p,[size,size*.62,size],skin,f,[0,0,PI/2]);}
    function pitch(height){return Number.isFinite(e.aimY)&&Number.isFinite(e.aimX)&&Number.isFinite(e.aimZ)?clamp(Math.atan2(e.aimY-base-height*scale,Math.hypot(e.aimX-(e.x||0),e.aimZ-(e.z||0))),-.9,.9):0;}
    function heavy(){
      const launcher=e.weapon==='rocket',grenadier=e.weapon==='grenade',armed=launcher||grenadier;
      const bounce=airborne?0:Math.sin(phase*2)*.025*blend,lean=stun?-.10:airborne?.07:rush?.15:.025*blend;
      const body=frame(root,[0,.9+bounce,impact*.05],[-lean-impact*.26,0,stun?Math.sin(time*23)*.035:airborne?0:Math.sin(phase)*.018*blend]);
      const head=frame(body,[0,.98,-.035],[.10,0,0]);
      const gun=frame(body,[.23,.43,-.29],[aim?pitch(1.33)+lean:-.23,0,0]);
      const legRoot=Number.isFinite(options.legYaw)&&options.legYaw?frame(root,[0,0,0],[0,-options.legYaw,0]):root,legs=[];
      for(const side of [-1,1]){
        const t=phase+(side<0?0:PI),lift=airborne?.18+.15*clamp(((e.airVY||0)+10)/22,0,1):Math.max(0,Math.cos(t))*.16*blend,stride=airborne?.12+side*.035:Math.sin(t)*.29*blend*(rush?1.25:1);
        const hip=point(body,[side*.25,-.025,0]),ankle=point(legRoot,[side*.27,.23+lift,stride+.015]);
        const kneeY=airborne?.68:.49+lift*.4,kneeZ=airborne?-.25:stride*.52-.095,knee=point(legRoot,[side*.28,kneeY,kneeZ]);
        legs.push({side,hip,knee,ankle,lift,stride,kneeY,kneeZ});
      }
      if(lod===2){
        box('torso',[0,.46,-.01],[1.08,.64,.65],'shell',body);box('helmet',[0,0,0],[.5,.4,.49],'dark',head);
        eye('visor',[0,.035,-.247],[.34,.055,.022],head);
        for(const l of legs)limb('leg-'+l.side,l.hip,l.ankle,.29,.36,'dark');
        box(launcher?'rocket-launcher':grenadier?'grenade-launcher':'rifle',[0,.015,-.30],launcher?[.31,.32,1.25]:grenadier?[.28,.27,1.05]:[.19,.20,.91],launcher?'trim':'dark',gun);return;
      }
      box('pelvis',[0,-.005,.02],[.69,.27,.47],'dark',body);
      armor('torso',[0,.48,-.015],[.98,.56,.61],'shell',body);
      armor('helmet',[0,0,0],[.5,.4,.49],'shell',head);
      eye('visor',[0,.035,-.247],[.34,.055,.022],head);
      ring('neck-bearing',[0,.765,-.015],[.40,.075,.40],'steel',body);
      box('backpack',[0,.48,.37],launcher?[.64,.65,.30]:[.60,.55,.22],'dark',body);
      for(const side of [-1,1]){
        armor('shoulder-'+side,[side*.61,.57,.005],[.34,.34,.48],'shell',body,[0,0,-side*.12]);
        const shoulder=point(body,[side*.54,.51,.005]),elbow=point(body,[side>0?.60:-.44,side>0?.19:.22,side>0?.015:-.24]);
        const hand=point(gun,side>0?[.03,-.14,.12]:[-.18,-.07,-.31]);
        if(lod===1)limb('arm-'+side,shoulder,hand,.23,.27,'edge');
        else{
          limb('upper-arm-'+side,shoulder,elbow,.245,.27,'edge');
          joint('elbow-'+side,[side>0?.60:-.44,side>0?.19:.22,side>0?.015:-.24],.25,'steel',body);
          limb('forearm-'+side,elbow,hand,.23,.29,'shell');
          box('hand-'+side,side>0?[.03,-.14,.12]:[-.18,-.07,-.31],[.15,.15,.20],'rubber',gun);
        }
      }
      for(const l of legs){
        if(lod===1)limb('leg-'+l.side,l.hip,l.ankle,.30,.34,'edge');
        else{
          limb('thigh-'+l.side,l.hip,l.knee,.31,.34,'shell');
          limb('shin-'+l.side,l.knee,l.ankle,.26,.29,'edge');
          joint('hip-'+l.side,[l.side*.25,-.025,0],.25,'steel',body);
          joint('knee-'+l.side,[l.side*.28,l.kneeY,l.kneeZ],.265,'steel',legRoot);
          box('knee-plate-'+l.side,[l.side*.28,l.kneeY+.01,l.kneeZ-.163],[.25,.25,.075],'trim',legRoot);
          limb('leg-piston-'+l.side,point(legRoot,[l.side*.37,.73,l.stride*.20+.12]),point(legRoot,[l.side*.37,.27+l.lift,l.stride+.12]),.065,.065,'steel','cylinder');
        }
        box('boot-'+l.side,[l.side*.27,.11+l.lift,l.stride-.07],[.34,.22,.51],'rubber',legRoot);
      }
      if(launcher){
        cyl('launcher-tube',[0,.045,-.43],[.32,1.08,.32],'shell',gun,[PI/2,0,0]);
        box('launcher-grip',[0,-.17,-.13],[.14,.27,.19],'dark',gun);
      }else{
        box('rifle-receiver',[0,.015,-.14],grenadier?[.30,.27,.60]:[.23,.23,.55],'dark',gun);
        cyl('rifle-barrel',[0,.045,-.67],grenadier?[.23,.58,.23]:[.11,.58,.11],'steel',gun,[PI/2,0,0]);
      }
      if(lod===1)return;
      cyl('abdomen',[0,.17,.015],[.48,.25,.38],'rubber',body);
      for(const side of [-1,1])armor('chest-plate-'+side,[side*.188,.52,-.33],[.34,.35,.12],'edge',body,[0,side*.08,side*.035]);
      box('visor-frame',[0,.035,-.237],[.425,.135,.035],'dark',head);
      box('face-guard',[0,-.11,-.242],[.25,.12,.10],'dark',head,[.18,0,0]);
      box('chest-breather',[0,.53,-.410],[.065,.22,.022],'dark',body);
      box('unit-badge',[-.28,.68,-.403],[.14,.035,.020],launcher?[.75,.27,.10]:grenadier?[.72,.58,.18]:'trim',body);
      if(!launcher)box('rifle-handguard',[0,.045,-.43],grenadier?[.27,.24,.30]:[.20,.19,.30],'shell',gun);
      cyl(armed?'launcher-muzzle':'rifle-muzzle',[0,.045,-.96],launcher?[.38,.09,.38]:grenadier?[.30,.09,.30]:[.165,.09,.165],'dark',gun,[PI/2,0,0]);
      cyl(armed?'launcher-bore':'rifle-bore',[0,.045,-1.005],launcher?[.25,.012,.25]:grenadier?[.17,.012,.17]:[.085,.012,.085],'rubber',gun,[PI/2,0,0]);
      if(launcher){
        for(const side of [-1,1]){cyl('spare-rocket-'+side,[side*.19,.49,.57],[.15,.63,.15],'trim',body);piece('rocket-tip-'+side,'octa',[side*.19,.87,.57],[.15,.18,.15],'dark',body);}
        ring('launcher-rear',[0,.045,.13],[.36,.08,.36],'trim',gun,[PI/2,0,0]);
        box('launcher-sight',[0,.25,-.20],[.065,.13,.25],'dark',gun);
        eye('launcher-arming',[.168,.08,-.17],[.012,.025,.11],gun);
      }else if(grenadier){
        cyl('grenade-drum',[.09,-.15,-.20],[.37,.32,.37],'trim',gun,[0,0,PI/2]);
        for(let j=0;j<3;j++){cyl('grenade-belt-'+j,[-.26+j*.25,.20,-.37],[.14,.25,.14],'trim',body);box('grenade-cap-'+j,[-.26+j*.25,.335,-.37],[.085,.04,.085],'dark',body);}
        box('grenade-range-sight',[0,.23,-.19],[.055,.12,.27],'dark',gun);
      }else{
        box('rifle-magazine',[0,-.18,-.13],[.15,.26,.18],'trim',gun,[-.13,0,0]);
        cyl('rifle-scope',[0,.205,-.18],[.115,.25,.115],'dark',gun,[PI/2,0,0]);
        eye('scope-lens',[0,.205,-.309],[.075,.015,.075],gun,[PI/2,0,0],'cylinder');
      }
      if(rich)for(const side of [-1,1]){
        for(const y of [-.12,.12])cyl('detail-helmet-bolt-'+side+'-'+y,[side*.20,y,-.251],[.035,.012,.035],'steel',head,[PI/2,0,0]);
        box('detail-chest-seam-'+side,[side*.35,.50,-.404],[.018,.21,.014],'steel',body);
        const plate=frame(body,[side*.188,.52,-.33],[0,side*.08,side*.035]);
        box('detail-chest-laminate-'+side,[0,.015,-.072],[.265,.27,.024],'trim',plate);
        box('detail-chest-intake-'+side,[0,-.005,-.087],[.17,.13,.006],'rubber',plate);
      }
      if(rich)for(const l of legs){
        const upper=point(root,[l.side*.37,.73,l.stride*.20+.12]),lower=point(root,[l.side*.37,.27+l.lift,l.stride+.12]);
        limb('detail-leg-jacket-'+l.side,upper,upper.map((v,i)=>v+(lower[i]-v)*.55),.108,.108,'dark','cylinder');
        cyl('detail-knee-cap-'+l.side,[l.side*.37,l.kneeY,l.kneeZ],[.14,.025,.14],'steel',root,[0,0,PI/2]);
      }
    }
    function drone(){
      const hover=1.35+Math.sin(time*2.2+(e.id||0))*.045,bank=stun?.18:Math.sin(time*1.5+(e.id||0))*.025+(e.tactic==='flank'?.075:0);
      const body=frame(root,[0,hover,impact*.05],[(stun?.16:-blend*.055)-impact*.26,0,bank]);
      const hubs=[];for(const side of [-1,1])for(const end of [-1,1])hubs.push([side*.58,0,end*.36]);
      if(lod===2){
        box('drone-hull',[0,0,0],[.72,.60,.82],'shell',body);eye('camera',[0,-.04,-.43],[.23,.13,.04],body);
        for(const [i,h] of hubs.entries())cyl('rotor-pod-'+i,h,[.44,.10,.44],'dark',body);return;
      }
      armor('drone-hull',[0,0,0],[.72,.34,.82],'shell',body);
      armor('drone-carapace',[0,.20,.055],[.60,.16,.58],'edge',body);
      eye('camera',[0,-.12,-.66],[.18,.035,.18],body,[PI/2,0,0],'cylinder');
      cyl('drone-gun',[0,-.24,-.36],[.12,.55,.12],'dark',body,[PI/2,0,0]);
      for(const [i,h] of hubs.entries()){
        limb('rotor-arm-'+i,point(body,[Math.sign(h[0])*.20,0,Math.sign(h[2])*.13]),point(body,h),.105,.14,'steel');
        ring('rotor-duct-'+i,h,[.48,.10,.48],'shell',body);
        cyl('rotor-motor-'+i,[h[0],.035,h[2]],[.14,.14,.14],'dark',body);
        if(lod===0)for(let k=0;k<2;k++)box('rotor-blade-'+i+'-'+k,[h[0],.074,h[2]],[.39,.018,.045],'edge',body,[0,time*(stun?1.2:31)*(i%2?-1:1)+i*.7+k*PI/2,0]);
      }
      if(lod===1)return;
      armor('drone-nose',[0,-.015,-.415],[.46,.25,.22],'trim',body);
      cyl('camera-gimbal',[0,-.12,-.465],[.28,.23,.28],'dark',body,[0,0,PI/2]);
      ring('camera-bezel',[0,-.12,-.625],[.27,.075,.27],'steel',body,[PI/2,0,0]);
      box('drone-keel',[0,-.235,.08],[.28,.19,.43],'dark',body);
      ring('drone-muzzle',[0,-.24,-.64],[.17,.065,.17],'steel',body,[PI/2,0,0]);
      for(const side of [-1,1]){
        box('drone-exhaust-'+side,[side*.18,.035,.424],[.19,.13,.035],'rubber',body);
        box('landing-skid-'+side,[side*.27,-.35,.04],[.055,.07,.49],'steel',body);
      }
      cyl('drone-aerial',[0,.40,.19],[.026,.29,.026],'edge',body);
      eye('drone-status',[0,.55,.19],[.055,.055,.055],body,null,'sphere');
      if(rich)for(const side of [-1,1]){
        for(const z of [-.31,.31])cyl('detail-drone-bolt-'+side+'-'+z,[side*.28,.177,z],[.035,.014,.035],'steel',body);
        box('detail-drone-grille-'+side,[side*.15,-.015,-.529],[.05,.09,.012],'dark',body);
        box('detail-drone-intake-'+side,[side*.374,-.025,-.23],[.028,.17,.28],'rubber',body);
        for(const y of [-.07,.025])box('detail-drone-louver-'+side+'-'+y,[side*.395,y,-.23],[.014,.018,.24],'steel',body);
        limb('detail-drone-optic-feed-'+side,point(body,[side*.285,-.13,-.38]),point(body,[side*.1,-.11,-.56]),.045,.045,'steel','cylinder',body.b);
      }
    }
    function sentinel(){
      const fixed={p:root.p,b:identity,r:[0,0,0]},body=frame(root,[0,1.60,impact*.05],[(stun?-.12:0)-impact*.26,0,stun?Math.sin(time*15)*.025:0]);
      const recoil=e.attackState==='burst'?Math.max(0,Math.sin(time*37))*.07:0,gun=frame(body,[0,-.10,recoil],[aim?pitch(1.50):-.035,0,0]);
      if(lod===2){
        cyl('turret-foot',[0,.14,0],[1.28,.28,1.28],'dark',fixed);cyl('turret-pivot',[0,.80,0],[.33,1.1,.33],'edge',fixed);
        box('turret-hull',[0,0,0],[.87,.55,.74],'shell',body);eye('turret-optic',[0,.13,-.405],[.23,.14,.055],body);
        for(const side of [-1,1])box('turret-barrel-'+side,[side*.36,0,-.58],[.15,.18,.95],'dark',gun);return;
      }
      const feet=[],motionYaw=Number.isFinite(e.goalX)&&Number.isFinite(e.goalZ)?Math.atan2(e.goalX-(e.x||0),(e.z||0)-e.goalZ):-yaw;
      for(let i=0;i<3;i++){
        const a=i*TAU/3+PI/6,x=Math.cos(a)*.76,z=Math.sin(a)*.76,t=((phase+i*TAU/3)%TAU+TAU)%TAU;
        const swing=t<TAU/3,u=swing?t/(TAU/3):(t-TAU/3)/(TAU*2/3),stride=airborne?0:(swing?-1+2*u:1-2*u)*.25*blend,lift=airborne?.22:swing?Math.sin(u*PI)*.115*blend:0;
        const footX=x*(airborne?.85:1)+Math.sin(motionYaw)*stride,footZ=z*(airborne?.85:1)-Math.cos(motionYaw)*stride;
        box('turret-pad-'+i,[footX,.08+lift,footZ],[.33,.16,.40],'rubber',fixed,[0,-a,0]);
        limb('turret-strut-'+i,point(fixed,[footX,.18+lift,footZ]),point(fixed,[x*.37,.78,z*.37]),.17,.19,'edge','box',fixed.b);feet.push({x,z,a,footX,footZ,lift});
      }
      cyl('turret-pivot',[0,1.02,0],[.37,.78,.37],'steel',fixed);
      ring('turret-swivel',[0,1.28,0],[.64,.10,.64],'dark',fixed);
      armor('turret-hull',[0,0,0],[.86,.54,.76],'shell',body);
      armor('turret-rear',[0,.06,.31],[.68,.38,.27],'edge',body);
      eye('turret-optic',[0,.14,-.497],[.22,.15,.055],body,null,'sphere');
      for(const side of [-1,1]){
        box('turret-receiver-'+side,[side*.37,0,-.25],[.22,.29,.47],'dark',gun);
        cyl('turret-barrel-'+side,[side*.37,0,-.79],[.14,.73,.14],'steel',gun,[PI/2,0,0]);
      }
      if(lod===1)return;
      cyl('turret-foundation',[0,.19,0],[.64,.29,.64],'dark',fixed);
      for(const [i,f] of feet.entries()){
        joint('turret-hinge-'+i,[f.x*.37,.78,f.z*.37],.24,'dark',fixed);
        limb('turret-piston-'+i,point(fixed,[f.footX*.82,.29+f.lift,f.footZ*.82]),point(fixed,[f.x*.23,.92,f.z*.23]),.058,.058,'steel','cylinder',fixed.b);
      }
      for(const side of [-1,1])armor('turret-cheek-'+side,[side*.40,.09,-.10],[.13,.40,.47],'trim',body,[0,0,-side*.12]);
      armor('turret-sensor-housing',[0,.15,-.395],[.39,.29,.17],'dark',body);
      cyl('turret-optic-bezel',[0,.14,-.465],[.28,.065,.28],'steel',body,[PI/2,0,0]);
      box('turret-sensor-hood',[0,.315,-.42],[.44,.07,.23],'shell',body);
      for(const side of [-1,1]){
        ring('turret-barrel-collar-'+side,[side*.37,0,-.54],[.235,.11,.235],'trim',gun,[PI/2,0,0]);
        cyl('turret-muzzle-'+side,[side*.37,0,-1.165],[.20,.09,.20],'dark',gun,[PI/2,0,0]);
        cyl('turret-bore-'+side,[side*.37,0,-1.213],[.105,.013,.105],'rubber',gun,[PI/2,0,0]);
        box('turret-rail-'+side,[side*.37,.157,-.30],[.095,.035,.35],'edge',gun);
      }
      for(let i=0;i<3;i++)box('turret-heat-fin-'+i,[(i-1)*.18,.09,.468],[.08,.35,.055],'dark',body);
      cyl('turret-aerial',[.32,.45,.22],[.025,.43,.025],'steel',body);eye('turret-status',[.32,.67,.22],[.055,.055,.055],body,null,'sphere');
      if(rich)for(const side of [-1,1]){
        for(const y of [.05,.25])cyl('detail-sensor-bolt-'+side+'-'+y,[side*.16,y,-.486],[.035,.012,.035],'steel',body,[PI/2,0,0]);
        box('detail-turret-conductor-'+side,[side*.18,.09,.474],[.026,.26,.018],'trim',body);
        limb('detail-turret-feed-'+side,point(body,[side*.40,-.20,.10]),point(gun,[side*.37,-.16,-.25]),.055,.055,'rubber','cylinder',body.b);
      }
      if(rich){
        box('detail-turret-plastron',[0,-.16,-.407],[.57,.17,.055],'trim',body);
        box('detail-turret-intake',[0,-.16,-.438],[.40,.075,.007],'rubber',body);
        ring('detail-turret-bearing',[0,1.14,0],[.46,.07,.46],'trim',fixed);
        for(const [i,f] of feet.entries()){
          const upper=point(fixed,[f.x*.23,.92,f.z*.23]),lower=point(fixed,[f.footX*.82,.29+f.lift,f.footZ*.82]);
          limb('detail-turret-jacket-'+i,upper,upper.map((v,k)=>v+(lower[k]-v)*.48),.105,.105,'trim','cylinder',fixed.b);
        }
      }
    }
    function custodian(){
      // A sweep is announced by the whole upper body winding up, never by a detached bar.
      const bounce=giant?(tellFamily==='ring'?-.12*tellPose:0):Math.sin(phase*2)*.035*blend,body=frame(root,[0,1.5+bounce,0],giant?[0,tellFamily==='sweep'?.42*tellPose:0,0]:[stun?.075:rush?-.085:0,0,stun?Math.sin(time*19)*.023:0]);
      const feet=[];for(const side of [-1,1])for(const end of [-1,1]){
        if(end<0&&Array.isArray(e.joints)&&e.joints[side<0?2:3]<=0){piece('custodian-stump-'+side+'','sphere',[side*.62,-.13,-.40],[.22,.22,.22],[1,.45,.1],body,null,5,.8+.3*Math.sin(time*13));continue;}
        const t=phase+(side===end?0:PI),lift=Math.max(0,Math.cos(t))*.17*blend,stride=Math.sin(t)*.20*blend;
        feet.push({side,end,lift,stride,hip:point(body,[side*.62,-.13,end*.40]),knee:point(root,[side*.89,.77+lift*.4,end*.65+stride*.5]),ankle:point(root,[side*.98,.24+lift,end*.78+stride])});
      }
      if(lod===2){
        box('custodian-torso',[0,.40,.025],[1.65,1.4,1.2],'shell',body);box('custodian-helmet',[0,1.39,-.08],[1,.5,.75],'dark',body);
        eye('custodian-optic',[0,1.40,-.47],[.67,.13,.04],body);
        for(const side of [-1,1])if(!(Array.isArray(e.joints)&&e.joints[side<0?0:1]<=0))box('custodian-cannon-'+side,[side*1.04,.77+(tellFamily==='slam'?tellPose*.7:0),-.43],[.40,.44,1.40],tellFamily==='rocketZone'?[.8,.12,.03]:tellFamily==='sweep'?[1,.52,.09]:'dark',body);
        cyl('custodian-stance',[0,.30,.03],[2.06,.58,1.85],'edge');return;
      }
      armor('custodian-torso',[0,.40,.025],[1.65,1.4,1.2],'shell',body);
      armor('custodian-helmet',[0,1.39,-.08],[1,.5,.75],'edge',body);
      eye('custodian-optic',[0,1.40,-.468],[.67,.13,.04],body);
      box('custodian-pack',[0,.48,.73],[1.10,.94,.33],'dark',body);
      for(const [i,l] of feet.entries()){
        if(lod===1)limb('custodian-leg-'+i,l.hip,l.ankle,.32,.39,'edge');
        else{
          joint('custodian-hip-'+i,[l.side*.62,-.13,l.end*.4],.39,'dark',body);
          limb('custodian-thigh-'+i,l.hip,l.knee,.38,.42,'shell');
          joint('custodian-knee-'+i,[l.side*.89,.77+l.lift*.4,l.end*.65+l.stride*.5],.34,'dark');
          limb('custodian-shin-'+i,l.knee,l.ankle,.29,.34,'edge');
          limb('custodian-piston-'+i,point(root,[l.side*1.015,1.13,l.end*.5]),point(root,[l.side*1.045,.34+l.lift,l.end*.76+l.stride]),.08,.08,'steel','cylinder');
        }
        box('custodian-boot-'+i,[l.side*.98,.12+l.lift,l.end*.78+l.stride-.04],[.43,.24,.59],'rubber');
      }
      for(const side of [-1,1]){
        if(Array.isArray(e.joints)&&e.joints[side<0?0:1]<=0){piece('custodian-stump-arm-'+side+'','sphere',[side*1.04,.78,0],[.22,.22,.22],[1,.45,.1],body,null,5,.8+.3*Math.sin(time*13));continue;}
        const recoil=e.attackState==='burst'?Math.max(0,Math.sin(time*31+side))*.12:0;
        const gun=frame(body,[side*1.04,.78,recoil],[tellFamily==='slam'?.95*tellPose:tellFamily==='ring'?-.25*tellPose:aim?pitch(2.28):-.04,0,0]);
        armor('custodian-shoulder-'+side,[0,.07,.12],[.58,.58,.74],tellFamily==='rocketZone'?[.7,.12,.035]:tellFamily==='sweep'?[1,.52,.09]:'trim',gun);
        cyl('custodian-barrel-'+side,[0,0,-.87],[.23,1.05,.23],'steel',gun,[PI/2,0,0]);
        if(lod===0){
          joint('custodian-gun-pivot-'+side,[0,.03,.16],.38,'dark',gun);
          box('custodian-receiver-'+side,[0,0,-.27],[.38,.36,.57],'dark',gun);
          cyl('custodian-muzzle-'+side,[0,0,-1.41],[.34,.14,.34],'dark',gun,[PI/2,0,0]);
          cyl('custodian-bore-'+side,[0,0,-1.486],[.18,.016,.18],'rubber',gun,[PI/2,0,0]);
          box('custodian-ammo-'+side,[side*.29,-.04,.13],[.17,.48,.56],'edge',gun);
        }
      }
      if(lod===1)return;
      armor('custodian-plastron',[0,.43,-.62],[1.21,.87,.16],'edge',body);
      cyl('custodian-neck',[0,1.03,-.03],[.52,.23,.52],'steel',body);
      cyl('custodian-jaw',[0,1.18,-.44],[.28,.11,.28],'dark',body,[PI/2,0,0]);
      cyl('custodian-reactor',[0,.54,.96],[.56,.22,.56],'trim',body,[PI/2,0,0]);
      ring('custodian-reactor-cage',[0,.54,1.08],[.71,.11,.71],'steel',body,[PI/2,0,0]);
      for(let j=0;j<4;j++)box('custodian-heat-fin-'+j,[(j-1.5)*.23,.54,.94],[.065,.80,.34],'dark',body);
      for(const side of [-1,1]){
        cyl('custodian-aerial-'+side,[side*.43,1.60,.12],[.035,.45,.035],'steel',body);
        eye('custodian-core-strip-'+side,[side*.36,.43,-.712],[.045,.42,.025],body);
      }
      if(rich)for(const side of [-1,1]){
        for(const y of [.11,.75])cyl('detail-plastron-bolt-'+side+'-'+y,[side*.5,y,-.709],[.055,.018,.055],'steel',body,[PI/2,0,0]);
        box('detail-plastron-seam-'+side,[side*.36,.08,-.709],[.16,.025,.018],'trim',body);
        box('detail-plastron-laminate-'+side,[side*.19,.43,-.728],[.25,.60,.056],'trim',body);
        box('detail-plastron-intake-'+side,[side*.19,.43,-.760],[.145,.27,.008],'rubber',body);
      }
      if(rich)for(const [i,l] of feet.entries()){
        const upper=point(root,[l.side*1.015,1.13,l.end*.5]),lower=point(root,[l.side*1.045,.34+l.lift,l.end*.76+l.stride]);
        limb('detail-custodian-jacket-'+i,upper,upper.map((v,k)=>v+(lower[k]-v)*.55),.14,.14,'trim','cylinder');
      }
    }
    // Humanoid machines (David, 16/11/2026): parametric bodies from EMPRISE,
    // posed joint by joint. 'endo' is a chrome endoskeleton gunner, 'blade' a
    // liquid-metal runner, 'kamikaze' a headless bomber. Giants ('endo',
    // 'liquid') stand hunched so that the simulation's weak point sits in the
    // chest, with guns on the shoulders where the simulation fires from.
    function humanoid(kind){
      const H=G.MetalHumanoids,P=H.parts,V=H.pivots,k=giant?1.9:1,K=v=>v*k,bulk=giant?2:1,T=v=>K(v)*bulk,hs=giant?1.3:1,id=e.id||0;
      const endo=kind==='endo',bomber=kind==='kamikaze',chrome=kind==='blade'||kind==='liquid',engaged=e.awareness==='engage'||!!e.active;
      const shine=chrome?.05*Math.sin(time*2.7+id*1.3):0;
      const skin={metal:chrome?[.50+shine,.54+shine,.59+shine]:endo?[.46,.48,.51]:[.19,.20,.21],joint:chrome?[.42,.46,.51]:endo?[.09,.095,.10]:[.10,.085,.07],accent:bomber?[.42,.17,.06]:endo?[.30,.31,.34]:[.66,.70,.75]};
      if(hurt>0)for(const key of ['metal','accent'])skin[key]=mix(skin[key],[.95,.55,.25],hurt*.6);
      // Polished metal (material 19, low roughness) catches the scene's
      // reflections: mirror chrome for liquid metal, bright bone for the
      // endoskeleton. Joints, the bomber and far bodies stay brushed steel.
      const shiny=(chrome||endo)&&lod<2?19:0,matFor=color=>color===skin.metal||chrome&&color===skin.accent||chrome&&color===skin.joint?shiny:0;
      const box=(n,p,s,color,f=root,r=null)=>piece(n,'box',p,s,color,f,r,matFor(color));
      const armor=(n,p,s,color,f=root,r=null)=>piece(n,lod===0?'bevel':'box',p,s,color,f,r,matFor(color));
      const cyl=(n,p,s,color,f=root,r=null)=>piece(n,'cylinder',p,s,color,f,r,matFor(color));
      const ring=(n,p,s,color,f=root,r=null)=>piece(n,'ring',p,s,color,f,r,matFor(color));
      const limb=(n,a,c,width,depth,color,shape,reference)=>{const m=limbPiece(n,a,c,width,depth,color,shape,reference);if(m)m.mat=matFor(color);return m;};
      const running=bomber||kind==='blade'&&engaged||rush,amount=airborne?0:clamp(blend*(running?1.35:1),0,1.5);
      const crouch=giant&&tellFamily==='ring'?tellPose:0,drop=(giant?.17:0)+crouch*.12;
      const L=H.gait(phase,amount,drop),R=H.gait(phase+PI,amount,drop),swing=Math.sin(phase)*(running?.6:.25)*blend;
      const hipY=V.hip+(airborne?-.04:L.bodyY);
      const lean=stun?-.12:(giant?.30:0)+(running?.24:.05)*blend+(rush?.10:0)+crouch*.15,twist=giant&&tellFamily==='sweep'?.55*Math.sin(PI*tellPose):0;
      const hips=frame(root,[0,K(hipY),impact*.05],[0,0,stun?Math.sin(time*23)*.04:0]);
      const chest=frame(hips,[0,K(V.waist-V.hip),0],[-lean-impact*.22,twist,airborne?0:Math.sin(phase)*.03*blend]);
      const put=(name,part,f,pivot,color,widen=1,grow=1)=>piece(name,part.shape,[K(part.centre[0]-pivot[0])*grow,K(part.centre[1]-pivot[1])*grow,K(part.centre[2]-pivot[2])*grow],[K(part.size[0]*widen)*grow,K(part.size[1])*grow,K(part.size[2]*widen)*grow],color,f,null,matFor(color));
      const ball=(name,p,d,color,f,mat=matFor(color),glow=0)=>piece(name,'sphere',p,[T(d),T(d),T(d)],color,f,null,mat,glow);
      const widen=giant?1.2:1,simple=lod===2;
      // Legs: one gait for every look; the endoskeleton shows bare struts.
      for(const side of [-1,1]){
        const i=side<0?0:1,g=side<0?L:R,lp=V.leg(side),kp=V.knee(side),ap=V.ankle(side);
        if(Array.isArray(e.joints)&&e.joints[side<0?2:3]<=0){piece('hum-stump-leg-'+side+'','sphere',[K(lp[0]),0,0],[K(.22),K(.22),K(.22)],[1,.45,.1],hips,null,5,.8+.3*Math.sin(time*13));continue;}
        const th=frame(hips,[K(lp[0]),0,0],[airborne?.55:g.hip,0,0]),sh=frame(th,[0,K(kp[1]-lp[1]),0],[airborne?-.95:g.knee,0,0]),ft=frame(sh,[0,K(ap[1]-kp[1]),0],[airborne?.3:g.ankle,0,0]);
        if(simple){limb('hum-leg-'+side,point(th,[0,0,0]),point(ft,[0,0,0]),T(.15),T(.16),endo?skin.joint:skin.metal,'box');box('hum-foot-'+side,[0,K(-.07),K(-.05)],[T(.12),K(.13),K(.25)],skin.joint,ft);continue;}
        if(endo){
          cyl('endo-thigh-'+side,[0,K(-.225),0],[T(.065),K(.43),T(.065)],skin.metal,th);
          cyl('endo-thigh-piston-'+side,[K(side*.05)*bulk,K(-.21),K(.05)*bulk],[T(.032),K(.30),T(.032)],skin.joint,th);
          ball('endo-hip-'+side,[0,0,0],.11,skin.joint,th);ball('endo-knee-'+side,[0,K(-.45),0],.10,skin.joint,th);
          for(const dx of [-.026,.026])cyl('endo-shin-'+side+(dx>0?'-b':'-a'),[K(dx)*bulk,K(-.19),0],[T(.034),K(.37),T(.034)],skin.metal,sh);
          armor('endo-foot-'+side,[0,K(-.075),K(-.055)],[T(.11),K(.07)*bulk,K(.25)*(giant?1.4:1)],skin.metal,ft);
          if(lod===0)box('endo-toe-'+side,[0,K(-.11),K(-.19)*(giant?1.4:1)],[T(.10),K(.035)*bulk,K(.06)],skin.joint,ft);
        }else{put('hum-thigh-'+side,P.thigh[i],th,lp,skin.metal,giant?1.15:1);put('hum-shin-'+side,P.shin[i],sh,kp,skin.metal,giant?1.15:1);put('hum-foot-'+side,P.foot[i],ft,ap,bomber?skin.joint:skin.metal,giant?1.2:1);}
      }
      // Torso and head.
      const neck=frame(chest,[0,K(V.neck-V.waist),0],[(giant?.30:0)+(aim?clamp(pitch(1.7)*.6,-.4,.4):bomber?0:.05),0,0]),H2=v=>K(v)*hs;
      if(simple){
        box('hum-torso',[0,K(.25),0],[K(.42*widen),K(.50),K(.28*widen)],endo?skin.joint:skin.metal,chest);
        if(!bomber)ball('hum-head',[0,H2(.17),H2(-.01)],.23*hs/bulk,skin.metal,neck);
        if(endo||bomber)eye('hum-eye',bomber?[0,K(.02),0]:[0,H2(.20),H2(-.11)],[H2(.12),H2(.03),H2(.03)],bomber?chest:neck);
      }else if(endo){
        armor('endo-pelvis',[0,K(-.02),0],[K(.34*widen),T(.13),K(.20*widen)],skin.metal,hips);
        cyl('endo-spine',[0,K(.22),K(.07)],[T(.05),K(.46),T(.05)],skin.joint,chest);
        for(let j=0;j<4;j++)ring('endo-rib-'+j,[0,K(.17+.075*j),K(.01)],[K((.40-.025*j)*widen),T(.035),K((.27-.012*j)*widen)],skin.metal,chest);
        box('endo-sternum',[0,K(.27),K(-.125)*widen],[T(.05),K(.25),T(.03)],skin.metal,chest);
        if(!giant)ball('endo-core',[0,K(.28),K(.01)],.11,signal,chest,signalMat,emission+.35);
        for(const side of [-1,1])limb('endo-clavicle-'+side,point(chest,[0,K(.41),K(-.02)]),point(chest,[K(side*.235),K(.395),0]),T(.045),T(.045),skin.metal,'cylinder',chest.b);
        if(lod===0)put('endo-skull',P.skull,neck,[0,V.neck,0],skin.metal,1,hs);else ball('endo-skull',[0,H2(.16),H2(-.01)],.2*hs/bulk,skin.metal,neck);
        for(const side of [-1,1])piece('endo-eye-'+side,'sphere',[H2(side*.038),H2(.20),H2(lod===0?-.083:-.1)],[H2(.028),H2(.022),H2(.016)],[1,.07,.03],neck,null,6,.95+.4*charge);
        box('endo-jaw',[0,H2(.088),H2(-.045)],[H2(.105),H2(.034),H2(.085)],skin.metal,neck);
        if(lod===0){box('endo-teeth',[0,H2(.112),H2(-.083)],[H2(.078),H2(.022),H2(.012)],[.80,.80,.76],neck);for(const side of [-1,1])cyl('endo-neck-'+side,[K(side*.032)*bulk,K(.43),K(.015)],[T(.026),K(.12),T(.026)],skin.joint,chest);for(let j=0;j<4;j++)box('endo-vertebra-'+j,[0,K(.04+.1*j),K(.10)],[T(.075),K(.034),T(.06)],skin.metal,chest);}
      }else{
        put('hum-pelvis',P.pelvis,hips,[0,V.hip,0],bomber?skin.joint:skin.metal,widen);
        put('hum-torso',P.torso,chest,[0,V.waist,0],skin.metal,widen);
        if(bomber){
          // Headless: a smouldering neck socket instead of a head.
          cyl('kamikaze-neck',[0,K(.47),0],[K(.11),K(.07),K(.10)],skin.joint,chest);
          piece('kamikaze-socket','sphere',[0,K(.51),0],[K(.07),K(.04),K(.07)],[1,.36,.06],chest,null,5,.55+.35*Math.abs(Math.sin(time*17+id)));
          if(lod===0)for(let j=0;j<3;j++)piece('kamikaze-spark-'+j,'sphere',[K(.05*Math.sin(time*9+j*2.1+id)),K(.56+.05*((time*3+j*.33+id*.1)%1)),K(.05*Math.cos(time*7+j))],[K(.022),K(.022),K(.022)],[1,.62,.15],chest,null,5,.9);
          box('kamikaze-harness',[0,K(.22),K(-.13)],[K(.34),K(.06),K(.04)],skin.accent,chest);
        }else if(lod===0)put('hum-face',P.face,neck,[0,V.neck,0],skin.metal,1,hs);else ball('hum-head',[0,H2(.17),H2(-.01)],.23*hs/bulk,skin.metal,neck);
      }
      // Arms: the gunner holds its weapon with both hands; the others swing,
      // raise a blade, carry two charges, or brace for a giant's attack.
      if(endo&&!giant){
        const gun=frame(hips,[.23,1.33-hipY,-.29],[aim?pitch(1.33):-.25,0,0]),launcher=e.weapon==='rocket',grenadier=e.weapon==='grenade';
        for(const side of [-1,1]){
          const s=point(chest,[side*.235,1.43-V.waist,0]),h=point(gun,side>0?[.03,-.14,.12]:[-.18,-.07,-.31]),d=h.map((v,j)=>v-s[j]),length=Math.hypot(...d)||1,reach=Math.min(length,.49),along=reach/2,rise=Math.sqrt(Math.max(0,.245*.245-along*along));
          const dir=d.map(v=>v/length),pole=[side*.6,-.8,.2],dot=pole[0]*dir[0]+pole[1]*dir[1]+pole[2]*dir[2],off=pole.map((v,j)=>v-dir[j]*dot),n=Math.hypot(...off)||1,elbow=s.map((v,j)=>v+dir[j]*along+off[j]/n*rise);
          if(simple){limb('hum-arm-'+side,s,h,.09,.09,skin.joint,'box');continue;}
          const world={p:[0,0,0],b:identity,r:[0,0,0]};
          ball('endo-shoulder-'+side,s,.10,skin.joint,world);
          limb('endo-upper-arm-'+side,s,elbow,.055,.055,skin.metal,'cylinder');
          ball('endo-elbow-'+side,elbow,.08,skin.joint,world);
          limb('endo-forearm-'+side,elbow,h,.05,.065,skin.metal,'cylinder');
          if(lod===0)limb('endo-forearm-rod-'+side,elbow.map((v,j)=>v+(j===1?-.03:0)),h.map((v,j)=>v+(j===1?-.03:0)),.022,.022,skin.joint,'cylinder');
          box('endo-hand-'+side,side>0?[.03,-.14,.12]:[-.18,-.07,-.31],[.08,.11,.12],skin.joint,gun);
        }
        if(launcher){cyl('rocket-launcher',[0,.045,-.43],[.30,1.08,.30],skin.accent,gun,[PI/2,0,0]);box('launcher-grip',[0,-.17,-.13],[.12,.25,.17],skin.joint,gun);if(!simple)ring('launcher-rear',[0,.045,.13],[.34,.08,.34],skin.metal,gun,[PI/2,0,0]);}
        else{box('rifle-receiver',[0,.015,-.14],grenadier?[.28,.25,.58]:[.17,.19,.55],skin.joint,gun);cyl('rifle-barrel',[0,.045,-.67],grenadier?[.22,.58,.22]:[.09,.58,.09],skin.metal,gun,[PI/2,0,0]);if(!simple){box('plasma-coil',[0,.13,-.42],[.11,.06,.40],signal,gun);if(grenadier)cyl('grenade-drum',[.09,-.15,-.20],[.34,.30,.34],skin.accent,gun,[0,0,PI/2]);}}
        if(!simple)cyl('rifle-muzzle',[0,.045,-.97],launcher?[.36,.08,.36]:grenadier?[.28,.08,.28]:[.15,.08,.15],skin.joint,gun,[PI/2,0,0]);
        return;
      }
      const blades=kind==='blade'&&engaged||kind==='liquid'&&giant&&tellFamily==='sweep';
      for(const side of [-1,1]){
        const i=side<0?0:1,sp=V.shoulder(side),ep=V.elbow(side),wp=V.wrist(side);
        if(Array.isArray(e.joints)&&e.joints[side<0?0:1]<=0){piece('hum-stump-arm-'+side+'','sphere',[K(sp[0])*widen,K(sp[1]-V.waist),K(sp[2])],[K(.22),K(.22),K(.22)],[1,.45,.1],chest,null,5,.8+.3*Math.sin(time*13));continue;}
        let angle=side<0?-swing:swing,bend=running?.55:.15,spread=giant?.22:.06;
        if(bomber){angle=1.85+.12*Math.sin(phase*2+side);bend=.35;spread=.10;}
        else if(kind==='blade'&&side>0&&e.windup>0){angle=.3+2.4*charge;bend=.5;}
        else if(kind==='blade'&&e.attackState==='recover'&&side>0){angle=.25;bend=.05;}
        if(giant){
          angle+=.35;bend+=.35;
          if(tellFamily==='slam'){angle=angle+(2.75-angle)*tellPose;bend=.25+.3*tellPose;}
          else if(tellFamily==='rocketZone'){angle=angle+(1.2-angle)*tellPose;}
          else if(tellFamily==='sweep'&&side>0){spread=.2+1.25*tellPose;angle=.4;}
          else if(crouch){spread=.22+.5*crouch;}
        }
        const upper=frame(chest,[K(sp[0])*widen,K(sp[1]-V.waist),K(sp[2])],[angle,0,side*spread]),fore=frame(upper,[K(ep[0]-sp[0]),K(ep[1]-sp[1]),K(ep[2]-sp[2])],[bend,0,0]),wrist=frame(fore,[K(wp[0]-ep[0]),K(wp[1]-ep[1]),K(wp[2]-ep[2])],[0,0,0]);
        if(simple){limb('hum-arm-'+side,point(upper,[0,0,0]),point(wrist,[0,0,0]),T(.11),T(.11),skin.metal,'box');}
        else if(endo){
          ball('endo-shoulder-'+side,[0,0,0],.10,skin.joint,upper);cyl('endo-upper-arm-'+side,[0,K(-.12),0],[T(.055),K(.24),T(.055)],skin.metal,upper);
          ball('endo-elbow-'+side,[0,0,0],.08,skin.joint,fore);for(const dx of [-.02,.02])cyl('endo-forearm-'+side+(dx>0?'-b':'-a'),[K(dx)*bulk,K(-.115),0],[T(.03),K(.235),T(.03)],skin.metal,fore);
          if(lod===0)put('endo-hand-'+side,P.hand[i],wrist,wp,skin.metal,1,giant?1.3:1);else box('endo-hand-'+side,[0,K(-.07),0],[T(.08),K(.13),T(.05)],skin.metal,wrist);
        }else{put('hum-upper-'+side,P.upper[i],upper,sp,skin.metal,giant?1.15:1);put('hum-fore-'+side,P.fore[i],fore,ep,skin.metal,giant?1.1:1);}
        if(simple)continue;
        if(blades)piece('liquid-blade-'+side,'octa',[0,K(-.38),K(-.01)],[K(.11),K(.86),K(.04)],skin.accent,wrist,null,matFor(skin.accent),.08);
        else if(!endo){if(lod===0)put('hum-hand-'+side,P.hand[i],wrist,wp,skin.metal,1,giant?1.3:1);else box('hum-hand-'+side,[0,K(-.07),0],[T(.08),K(.14),T(.05)],skin.metal,wrist);}
        if(bomber){
          piece('kamikaze-bomb-'+side,'sphere',[0,K(-.17),K(-.07)],[K(.30),K(.30),K(.30)],[.075,.08,.085],wrist);
          ring('kamikaze-bomb-band-'+side,[0,K(-.17),K(-.07)],[K(.31),K(.05),K(.31)],skin.accent,wrist);
          piece('kamikaze-fuse-'+side,'sphere',[0,K(-.02),K(-.07)],[K(.05),K(.05),K(.05)],[1,.12,.04],wrist,null,6,(Math.sin(time*(rush?22:9)+side)>0?1.2:.25));
        }
      }
      // Giant looks: guns on the shoulders where the simulation fires from,
      // and a mount holding the exposed heart to the chest.
      if(giant){
        if(!Array.isArray(e.joints))cyl('titan-core-mount',[0,1.93,-.52],[.52,.56,.52],skin.joint,root,[PI/2,0,0]);
        for(const side of [-1,1]){
          if(Array.isArray(e.joints)&&e.joints[side<0?0:1]<=0)continue;
          const up=tellFamily==='rocketZone'?-.75*tellPose:0,mount=frame(root,[side*1.04,2.28,0],[aim?pitch(2.28):up-.08,0,0]);
          box('titan-gun-yoke-'+side,[-side*.36,.02,.10],[.62,.30,.46],skin.joint,mount);
          cyl('titan-gun-'+side,[0,0,-.74],[.32,1.48,.32],chrome?skin.metal:'steel',mount,[PI/2,0,0]);
          ring('titan-gun-rim-'+side,[0,0,-1.46],[.42,.10,.42],skin.joint,mount,[PI/2,0,0]);
          if(lod<2)piece('titan-gun-glow-'+side,'cylinder',[0,0,-1.50],[.20,.03,.20],signal,mount,[PI/2,0,0],signalMat,emission+.3*charge);
        }
      }
    }
    const humanLook=G.MetalHumanoids&&!canvas?(giant?(e.bossLook==='endo'||e.bossLook==='liquid'?e.bossLook:''):type===1&&(e.variant==='endo'||e.variant==='blade'||e.variant==='kamikaze')?e.variant:''):'';
    if(humanLook)humanoid(humanLook);else if(type===0)drone();else if(type===1)heavy();else if(type===2)sentinel();else custodian();
    if(giant){
      const awake=e.bossAwake!==false,open=!!e.weakPointOpen,kind=e.bossKind||'colossus';
      const glow=open?[.20,.90,.80]:kind==='siegebreaker'?[.98,.33,.055]:kind==='custodian'?[.37,.70,.78]:[.89,.61,.20];
      const energy=awake?(open?.72+.12*Math.sin(time*8):tellFamily==='ring'?.5+.3*Math.sin(time*(5+tellPose*12)):.25+.06*Math.sin(time*2.2)):.055;
      // This centre and diameter are the simulation's real, targetable weak point.
      // It stays attached to the torso; gait only animates the articulated supports.
      if(Array.isArray(e.joints)){
        // Horde worlds: four small joints are the targets; the bare chest core
        // appears once they are all broken.
        const J=humanLook?JOINTS_HUMAN:JOINTS_ROBOT;
        if(e.joints.every(v=>v<=0))piece('titan-heart','sphere',[0,1.93,-.90],[.4,.4,.4],[.20,.90,.80],root,null,4,energy);
        else for(let i=0;i<4;i++)if(e.joints[i]>0){
          piece('titan-joint-'+i,'sphere',J[i],[JOINT_R*2,JOINT_R*2,JOINT_R*2],glow,root,null,open?4:5,energy);
          ring('titan-joint-collar-'+i,[J[i][0],J[i][1],J[i][2]+.04],[.42,.06,.42],'trim',root,[PI/2,0,0]);
        }
      }else{
      piece('titan-heart','sphere',[0,1.93,-.90],[.72,.72,.72],glow,root,null,open?4:5,energy);
      ring('titan-heart-collar',[0,1.93,-.79],[.94,.15,.94],'trim',root,[PI/2,0,0]);
      for(let j=0;j<6;j++){
        const a=j*TAU/6,r=open?.51:.27;
        armor('titan-heart-shutter-'+j,[Math.cos(a)*r,1.93+Math.sin(a)*r,-1.035],[.22,.28,.10],'edge',root,[open?.20:0,0,a-PI/2]);
      }
      }
      if(lod<2&&!humanLook){
        for(const side of [-1,1]){
          armor('titan-shoulder-buttress-'+side,[side*.83,2.30,.12],[.33,.91,.64],'edge',root,[0,0,-side*.12]);
          box('titan-cheek-'+side,[side*.45,2.86,-.43],[.13,.41,.18],'trim',root,[0,0,-side*.09]);
          if(kind==='colossus'){
            limb('titan-horn-root-'+side,point(root,[side*.41,3.03,.10]),point(root,[side*.63,3.23,.10]),.13,.16,'trim');
            limb('titan-horn-tip-'+side,point(root,[side*.63,3.23,.10]),point(root,[side*.90,3.05,.10]),.085,.12,'steel');
            cyl('titan-spine-'+side,[side*.44,2.15,.91],[.24,1.31,.24],'dark');
          }else if(kind==='siegebreaker'){
            cyl('titan-chimney-'+side,[side*.62,2.56,.73],[.29,1.18,.29],'dark');
            ring('titan-chimney-rim-'+side,[side*.62,3.15,.73],[.37,.08,.37],'steel');
            armor('titan-siege-jaw-'+side,[side*.30,2.65,-.51],[.42,.29,.34],'trim',root,[.18,0,side*.10]);
          }else{
            armor('titan-crown-'+side,[side*.32,3.15,.04],[.14,.30,.27],'trim',root,[0,0,-side*.17]);
            armor('titan-mantle-'+side,[side*.75,1.65,.69],[.34,1.69,.27],'edge',root,[0,0,side*.11]);
            limb('titan-halo-support-'+side,point(root,[side*.47,2.19,.76]),point(root,[side*.65,2.65,.78]),.09,.10,'steel');
          }
        }
        if(kind==='custodian')ring('titan-halo',[0,2.60,.77],[1.22,.11,1.22],'trim',root,[PI/2,0,0]);
      }
      if(lod===0&&!humanLook){
        for(const side of [-1,1]){
          for(let j=0;j<3;j++){
            box('titan-rib-'+side+'-'+j,[side*.69,1.66+j*.19,-.60],[.21,.075,.14],'steel',root,[0,0,side*.17]);
            cyl('titan-rivet-'+side+'-'+j,[side*.69,1.67+j*.19,-.685],[.055,.025,.055],'trim',root,[PI/2,0,0]);
          }
          for(let j=0;j<3;j++)box('titan-back-vent-'+side+'-'+j,[side*.26,1.72+j*.26,.98],[.25,.10,.12],'dark');
          piece('titan-reactor-seal-'+side,'box',[side*.46,2.29,.99],[.035,.39,.025],glow,root,null,5,energy*.55);
        }
        if(rich&&!Array.isArray(e.joints))for(let j=0;j<4;j++){
          const a=j*PI/2+PI/4;
          cyl('detail-reactor-coupling-'+j,[Math.cos(a)*.52,1.93+Math.sin(a)*.52,-.875],[.09,.06,.09],'steel',root,[PI/2,0,0]);
        }
      }
      for(const mesh of out){
        mesh.p=[root.p[0]+(mesh.p[0]-root.p[0])*scale,base+(mesh.p[1]-base)*scale,root.p[2]+(mesh.p[2]-root.p[2])*scale];
        mesh.s=mesh.s.map(v=>v*scale);mesh.actorScale=scale;
        if(!awake&&mesh.actorPart!=='titan-heart'&&mesh.emissive)mesh.emissive*=.16;
      }
    }
    return out;
  }
  G.FActors={build};
})(typeof window!=='undefined'?window:globalThis);
