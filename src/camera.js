/* METAL — first/third person follow camera with a swept clearance.
 * Same principle as EMPRISE: the body hides when a wall pushes the camera
 * against it, and the third-person view looks at the point the firing ray
 * really reaches, so the crosshair keeps its meaning. No simulation state. */
(function(G){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // Heavy: over the right shoulder. Light drone: straight behind and above it.
  const RIGS={heavy:{distance:3.2,shoulder:.8,height:.55},light:{distance:2.7,shoulder:0,height:.55}};
  const EYE=1.62,VISIBLE=.75,PROBE=.18;
  function create(){
    let mode=0,distance=0,range=20,visible=false,recovery=null;
    function set(third){mode=third?1:0;}
    function reset(third){mode=third?1:0;distance=mode?RIGS.heavy.distance:0;range=20;visible=false;recovery=null;}
    // ray(origin, unit direction, far) returns the free distance. ground(x,z)
    // and actorRange(origin, direction, far) are optional. Callback vectors and
    // returned positions remain independent arrays; no shared scratch escapes.
    function frame(player,ray,dt,{profile='heavy',ground,actorRange}={}){
      const rig=RIGS[profile]||RIGS.heavy,want=mode*rig.distance,step=1-Math.exp(-Math.max(0,dt)*12);
      distance+=(want-distance)*step;if(Math.abs(want-distance)<.004)distance=want;
      const yaw=Number(player.yaw)||0,pitch=clamp(Number(player.pitch)||0,-1.2,1.2),cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const ox=player.x,oy=(player.y||0)+EYE,oz=player.z,fx=sy*cp,fy=sp,fz=-cy*cp,bx=-fx,by=-fy,bz=-fz;
      let safe=distance;
      if(distance>.05){
        const back=[bx,by,bz];
        // Same centre/left/right/down/up probe order, without allocating the
        // nested offset table (six arrays) on every rendered frame.
        for(let i=0;i<5;i++){
          const x=i===1?-.16:i===2?.16:0,y=i===3?-.16:i===4?.16:0;
          const o=[ox+cy*x,oy+y,oz+sy*x],free=ray(o,back,distance+PROBE);
          if(Number.isFinite(free))safe=Math.min(safe,Math.max(0,free-PROBE));
        }
      }
      // Obstructions retract immediately. Only their outward release is eased:
      // a disappearing wall must not teleport the eye to the full boom length.
      // Normal first/third-person transitions keep their original single easing.
      if(safe<distance-1e-7||recovery!==null){
        if(recovery===null||safe<=recovery)recovery=safe;
        else recovery+=(safe-recovery)*step;
        if(safe===distance&&safe-recovery<.004)recovery=null;
        else safe=recovery;
      }
      // A small hysteresis keeps the body from blinking along a wall.
      visible=visible?safe>VISIBLE-.1:safe>VISIBLE+.1;
      const pos=[ox+bx*safe,oy+by*safe,oz+bz*safe];let viewYaw=yaw,viewPitch=pitch;
      if(visible){
        // The shoulder offset never moves the firing ray: only the eye moves.
        const lx=cy*rig.shoulder,ly=rig.height,lz=sy*rig.shoulder,length=Math.hypot(lx,ly,lz);
        if(length>1e-6){const unit=[lx/length,ly/length,lz/length],free=ray(pos,unit,length+PROBE),reach=Number.isFinite(free)?clamp(free-PROBE,0,length):length;for(let k=0;k<3;k++)pos[k]+=unit[k]*reach;}
        const floor=typeof ground==='function'?ground(pos[0],pos[2]):NaN;
        if(Number.isFinite(floor)&&floor<oy&&pos[1]<floor+.3)pos[1]=floor+.3;
        const origin=[ox,oy,oz],forward=[fx,fy,fz];
        let reach=ray(origin,forward,120);if(!Number.isFinite(reach))reach=120;
        const actor=typeof actorRange==='function'?actorRange(origin,forward,reach):Infinity;if(Number.isFinite(actor))reach=Math.min(reach,actor);
        // Near targets keep a small parallax; abrupt depth changes are eased so
        // the camera does not swing when the crosshair crosses an edge.
        range+=(clamp(reach,5,120)-range)*(1-Math.exp(-Math.max(0,dt)*14));
        const dx=ox+fx*range-pos[0],dy=oy+fy*range-pos[1],dz=oz+fz*range-pos[2];
        viewYaw=Math.atan2(dx,-dz);viewPitch=Math.atan2(dy,Math.hypot(dx,dz));
      }
      return {pos,yaw:viewYaw,pitch:viewPitch,thirdPerson:visible,distance,clearance:safe,range};
    }
    return {set,reset,frame,get third(){return mode===1;},get distance(){return distance;},get thirdPerson(){return visible;}};
  }
  G.MetalCamera={create,rigs:RIGS};
})(typeof window!=='undefined'?window:globalThis);
