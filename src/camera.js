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
    let mode=0,distance=0,range=20,visible=false;
    function set(third){mode=third?1:0;}
    function reset(third){mode=third?1:0;distance=mode?RIGS.heavy.distance:0;range=20;visible=false;}
    // ray(origin, unit direction, far) returns the free distance. ground(x,z)
    // and actorRange(origin, direction, far) are optional.
    function frame(player,ray,dt,{profile='heavy',ground,actorRange}={}){
      const rig=RIGS[profile]||RIGS.heavy,want=mode*rig.distance,step=1-Math.exp(-Math.max(0,dt)*12);
      distance+=(want-distance)*step;if(Math.abs(want-distance)<.004)distance=want;
      const yaw=Number(player.yaw)||0,pitch=clamp(Number(player.pitch)||0,-1.2,1.2),cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const origin=[player.x,(player.y||0)+EYE,player.z],forward=[sy*cp,sp,-cy*cp],back=forward.map(v=>-v),right=[cy,0,sy];
      let safe=distance;
      if(distance>.05)for(const [x,y] of [[0,0],[-.16,0],[.16,0],[0,-.16],[0,.16]]){
        const o=[origin[0]+right[0]*x,origin[1]+y,origin[2]+right[2]*x],free=ray(o,back,distance+PROBE);
        if(Number.isFinite(free))safe=Math.min(safe,Math.max(0,free-PROBE));
      }
      // A small hysteresis keeps the body from blinking along a wall.
      visible=visible?safe>VISIBLE-.1:safe>VISIBLE+.1;
      const pos=origin.map((v,k)=>v+back[k]*safe);let viewYaw=yaw,viewPitch=pitch;
      if(visible){
        // The shoulder offset never moves the firing ray: only the eye moves.
        const lift=[right[0]*rig.shoulder,rig.height,right[2]*rig.shoulder],length=Math.hypot(...lift);
        if(length>1e-6){const unit=lift.map(v=>v/length),free=ray(pos,unit,length+PROBE),reach=Number.isFinite(free)?clamp(free-PROBE,0,length):length;for(let k=0;k<3;k++)pos[k]+=unit[k]*reach;}
        const floor=typeof ground==='function'?ground(pos[0],pos[2]):NaN;
        if(Number.isFinite(floor)&&floor<origin[1]&&pos[1]<floor+.3)pos[1]=floor+.3;
        let reach=ray(origin,forward,120);if(!Number.isFinite(reach))reach=120;
        const actor=typeof actorRange==='function'?actorRange(origin,forward,reach):Infinity;if(Number.isFinite(actor))reach=Math.min(reach,actor);
        // Near targets keep a small parallax; abrupt depth changes are eased so
        // the camera does not swing when the crosshair crosses an edge.
        range+=(clamp(reach,5,120)-range)*(1-Math.exp(-Math.max(0,dt)*14));
        const target=origin.map((v,k)=>v+forward[k]*range),delta=target.map((v,k)=>v-pos[k]);
        viewYaw=Math.atan2(delta[0],-delta[2]);viewPitch=Math.atan2(delta[1],Math.hypot(delta[0],delta[2]));
      }
      return {pos,yaw:viewYaw,pitch:viewPitch,thirdPerson:visible,distance,clearance:safe,range};
    }
    return {set,reset,frame,get third(){return mode===1;},get distance(){return distance;},get thirdPerson(){return visible;}};
  }
  G.MetalCamera={create,rigs:RIGS};
})(typeof window!=='undefined'?window:globalThis);
