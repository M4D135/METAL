/* METAL — the two playable characters seen from outside: the heavy hero and
 * his light drone with twin cannons. Procedural primitives only. */
(function(G){
  'use strict';
  const PI=Math.PI,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=(v,d=0)=>Number.isFinite(v)?v:d;
  // Renderer order is Rz * Ry * Rx, as in actors.js.
  function rotation(x=0,y=0,z=0){
    const a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z);
    return [e*c,e*d*b-f*a,e*d*a+f*b,f*c,f*d*b+e*a,f*d*a-e*b,-d,c*b,c*a];
  }
  function product(a,b){const c=new Array(9);for(let r=0;r<3;r++)for(let k=0;k<3;k++)c[r*3+k]=a[r*3]*b[k]+a[r*3+1]*b[k+3]+a[r*3+2]*b[k+6];return c;}
  function angles(m){const y=Math.asin(clamp(-m[6],-1,1)),c=Math.cos(y);return Math.abs(c)>1e-6?[Math.atan2(m[7],m[8]),y,Math.atan2(m[3],m[0])]:[Math.atan2(-m[5],m[4]),y,0];}
  function point(f,p){const a=f.b;return [f.p[0]+a[0]*p[0]+a[1]*p[1]+a[2]*p[2],f.p[1]+a[3]*p[0]+a[4]*p[1]+a[5]*p[2],f.p[2]+a[6]*p[0]+a[7]*p[1]+a[8]*p[2]];}
  function frame(parent,p,r=[0,0,0]){const b=product(parent.b,rotation(r[0],r[1],r[2]));return {p:point(parent,p),b,r:angles(b)};}
  function root(x,y,z,yaw){const b=rotation(0,-yaw,0);return {p:[x,y,z],b,r:angles(b)};}

  // Bronze armour, orange trim and an acid visor: never mistaken for a machine.
  const HEAVY={palette:{shell:[.44,.37,.26],edge:[.31,.32,.29],trim:[.92,.52,.16],steel:[.63,.64,.58],dark:[.10,.10,.09]},signal:[.80,.98,.34]};
  function heavy(p,o={}){
    if(!G.FActors)return [];
    const yaw=finite(p.yaw),pitch=clamp(finite(p.pitch),-1.2,1.2),reach=30,weapon=o.weapon===2?'rocket':o.weapon===3?'grenade':undefined;
    const eye=finite(p.y)+1.62,aim={x:finite(p.x)+Math.sin(yaw)*Math.cos(pitch)*reach,y:eye+Math.sin(pitch)*reach,z:finite(p.z)-Math.cos(yaw)*Math.cos(pitch)*reach};
    const actor={id:-2,type:1,x:finite(p.x),z:finite(p.z),baseY:finite(p.y),y:finite(p.y)+1.05,yaw,hp:1,moveSpeed:finite(o.speed),airborne:!!p.airborne,airVY:finite(p.airVY),attackState:'aim',aimX:aim.x,aimY:aim.y,aimZ:aim.z,weapon,awareness:'patrol'};
    const out=G.FActors.build(actor,{time:finite(o.time),phase:finite(o.phase),blend:clamp(finite(o.blend),0,1),distance:finite(o.distance,3),quality:o.quality,backend:o.backend,palette:HEAVY.palette,signal:HEAVY.signal,legYaw:finite(o.legYaw)});
    for(const m of out)m.playerAvatar='heavy';
    if(finite(o.flash)>.2){
      // The flash sits at the end of the barrel FActors places on the gun frame.
      const body=root(finite(p.x),finite(p.y),finite(p.z),yaw),gun=frame(frame(body,[0,.9,0]),[.23,.43,-.29],[pitch,0,0]),length=weapon==='rocket'?-1.02:-1.05;
      const flash=G.FRender.mesh('octa',point(gun,[0,.045,length]),[.20+o.flash*.12,.20+o.flash*.12,.34+o.flash*.3],5,gun.r,2.4);flash.surface='object';flash.color=[1,.62,.22];flash.playerAvatar='heavy';out.push(flash);
    }
    return out;
  }

  // The light drone: ducted rotors, a cyan sensor and twin cannons whose
  // barrels follow the weapon it carries (0 SMG, 1 pump, 4 pistol).
  const DRONE={shell:[.66,.70,.70],edge:[.36,.41,.43],dark:[.09,.11,.12],steel:[.58,.62,.63],glow:[.44,.90,.80],boost:[.55,1,.92]};
  function drone(p,o={}){
    const out=[],time=finite(o.time),yaw=finite(p.yaw),pitch=clamp(finite(p.pitch),-1.2,1.2),forward=clamp(finite(o.forward)/9,-1,1),strafe=clamp(finite(o.strafe)/9,-1,1);
    const bob=Math.sin(time*2.4+finite(o.seed))*.035,tilt=-forward*.22,bank=-strafe*.26,boosting=!!o.boosting,quality=o.quality||'auto',rich=quality!=='low'&&o.backend!=='canvas2d';
    const base=root(finite(p.x),finite(p.y)+1.42+bob,finite(p.z),yaw),body=frame(base,[0,0,0],[tilt,0,bank]);
    function part(shape,f,at,size,color,mat=0,turn=null,glow=0){
      const r=turn?angles(product(f.b,rotation(turn[0],turn[1],turn[2]))):f.r,m=G.FRender.mesh(shape,point(f,at),size,mat,r,glow);
      m.color=color;m.surface='object';m.playerAvatar='light';out.push(m);return m;
    }
    part('bevel',body,[0,0,0],[.56,.22,.66],DRONE.shell);
    part('bevel',body,[0,.13,.04],[.40,.09,.44],DRONE.edge);
    part('box',body,[0,-.13,.06],[.26,.08,.40],DRONE.dark,7);
    part('cylinder',body,[0,-.02,-.34],[.18,.07,.18],DRONE.glow,4,[PI/2,0,0],1.1);
    part('ring',body,[0,-.02,-.35],[.24,.05,.24],DRONE.steel,1,[PI/2,0,0]);
    for(const side of [-1,1])part('box',body,[side*.205,.115,-.18],[.035,.02,.20],DRONE.glow,4,null,.8);
    for(const [i,[x,z]] of [[-.46,-.30],[.46,-.30],[-.46,.32],[.46,.32]].entries()){
      part('box',body,[x*.5,.02,z*.5],[Math.hypot(x,z)*.85,.05,.07],DRONE.edge,1,[0,-Math.atan2(z,x),0]);
      part('ring',body,[x,.04,z],[.40,.08,.40],DRONE.shell);
      part('cylinder',body,[x,.03,z],[.09,.10,.09],DRONE.dark,7);
      if(rich)for(let k=0;k<2;k++)part('box',body,[x,.075,z],[.34,.012,.045],DRONE.steel,1,[0,time*(i%2?-36:36)+i*.7+k*PI/2,0]);
    }
    // Thrusters brighten with the boost and leave a short cyan flame.
    for(const side of [-1,1]){
      part('box',body,[side*.15,.0,.35],[.13,.09,.05],boosting?DRONE.boost:DRONE.glow,4,null,boosting?2.2:.55);
      if(boosting)part('octa',body,[side*.15,0,.52+Math.sin(time*40+side)*.03],[.09,.09,.30],DRONE.boost,4,null,2.6);
    }
    // Twin cannons: same weapon on both mounts, aimed with the view.
    const weapon=Number.isInteger(o.weapon)?o.weapon:4,aim=pitch-tilt,flash=finite(o.flash);
    for(const side of [-1,1]){
      part('box',body,[side*.30,-.06,-.06],[.10,.08,.16],DRONE.edge,1);
      const gun=frame(body,[side*.36,-.11,-.08],[aim,0,0]);
      if(weapon===1){
        part('bevel',gun,[0,0,-.06],[.17,.12,.30],DRONE.dark);
        for(const x of [-.038,.038]){part('cylinder',gun,[x,.005,-.36],[.07,.40,.07],DRONE.steel,1,[PI/2,0,0]);part('ring',gun,[x,.005,-.55],[.085,.025,.085],DRONE.dark,7,[PI/2,0,0]);}
      }else if(weapon===0){
        part('bevel',gun,[0,0,-.08],[.12,.12,.36],DRONE.dark);
        part('box',gun,[0,-.10,-.04],[.08,.12,.10],DRONE.edge,1);
        part('cylinder',gun,[0,.01,-.46],[.06,.50,.06],DRONE.steel,1,[PI/2,0,0]);
        for(let j=0;j<3;j++)part('ring',gun,[0,.01,-.30-j*.11],[.10,.03,.10],DRONE.dark,7,[PI/2,0,0]);
      }else{
        part('bevel',gun,[0,0,-.08],[.11,.11,.30],DRONE.dark);
        part('cylinder',gun,[0,.01,-.36],[.075,.32,.075],DRONE.steel,1,[PI/2,0,0]);
        part('ring',gun,[0,.01,-.52],[.10,.03,.10],DRONE.dark,7,[PI/2,0,0]);
      }
      part('box',gun,[0,.065,-.12],[.02,.02,.16],DRONE.glow,4,null,.7);
      if(flash>.2){const tip=weapon===0?-.74:weapon===1?-.60:-.56;part('octa',gun,[0,.01,tip],[.10+flash*.07,.10+flash*.07,.16+flash*.18],[1,.72,.32],5,null,2.6);}
    }
    if(rich)part('ring',base,[0,-.30,0],[.36,.012,.36],DRONE.glow,4,null,.45+(boosting?.6:0));
    return out;
  }
  G.MetalAvatars={heavy,drone,palettes:{heavy:HEAVY,drone:DRONE}};
})(typeof window!=='undefined'?window:globalThis);
