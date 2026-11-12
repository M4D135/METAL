/* FERRO — damped presentation. Aim and collision state are never modified here. */
(function(G){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
  function basis(yaw=0,pitch=0,roll=0){
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
    const r=[cy,0,sy],u=[-sy*sp,cp,cy*sp],b=[-sy*cp,-sp,cy*cp];
    return [r.map((v,k)=>v*cr+u[k]*sr),u.map((v,k)=>v*cr-r[k]*sr),b];
  }
  function rotation(x=0,y=0,z=0){
    const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
    return [[cz*cy,sz*cy,-sy],[cz*sy*sx-sz*cx,sz*sy*sx+cz*cx,cy*sx],[cz*sy*cx+sz*sx,sz*sy*cx-cz*sx,cy*cx]];
  }
  const vector=(axes,v)=>[0,1,2].map(k=>axes[0][k]*v[0]+axes[1][k]*v[1]+axes[2][k]*v[2]);
  function mount(camera,offset=[0,0,0],angles=[0,0,0]){
    const axes=basis(camera.yaw||0,camera.pitch||0,camera.roll||0),shift=vector(axes,offset);
    return {pos:camera.pos.map((v,k)=>v+shift[k]),axes:rotation(...angles).map(v=>vector(axes,v))};
  }
  function place(frame,offset,rx=0){
    const shift=vector(frame.axes,offset),c=Math.cos(rx),s=Math.sin(rx);
    const axes=[frame.axes[0],frame.axes[1].map((v,k)=>v*c+frame.axes[2][k]*s),frame.axes[2].map((v,k)=>v*c-frame.axes[1][k]*s)];
    const ry=Math.asin(clamp(-axes[0][2],-1,1)),regular=Math.abs(Math.cos(ry))>1e-6;
    const r=regular?[Math.atan2(axes[1][2],axes[2][2]),ry,Math.atan2(axes[0][1],axes[0][0])]:[Math.atan2(-axes[2][1],axes[1][1]),ry,0];
    return {p:frame.pos.map((v,k)=>v+shift[k]),r};
  }
  function create(){
    const springs={};
    const view={height:0,roll:0,fov:0,weapon:{offset:[0,0,0],rotation:[0,0,0],slide:0}};
    function channel(key){return springs[key]||(springs[key]={x:0,v:0});}
    // Exact critically damped step for a constant target. Stable at any render cadence.
    function damp(key,target,omega,dt){
      const q=channel(key),x=q.x-target,e=Math.exp(-omega*dt),t=(q.v+omega*x)*dt;
      q.x=target+(x+t)*e;q.v=(q.v-omega*t)*e;return q.x;
    }
    function impulse(kind){
      if(kind==='shot')channel('kick').v+=1.9;
      else if(kind==='fracture')channel('kick').v+=3.5;
      else if(kind==='switch')channel('equip').v-=2.5;
      else if(kind==='hurt')channel('impact').v+=.7;
      else if(kind==='pulse')channel('equip').v-=1.1;
    }
    function reset(){
      for(const key of Object.keys(springs))delete springs[key];
      view.height=view.roll=view.fov=0;view.weapon.offset.fill(0);view.weapon.rotation.fill(0);view.weapon.slide=0;
      return view;
    }
    function update(dt,loc={},signals={},enabled=true){
      dt=clamp(finite(dt),0,.12);
      const speed=Math.max(0,finite(loc.speed)),move=speed>.04?clamp(finite(loc.moveBlend),0,1):0;
      const run=clamp(finite(loc.sprintBlend),0,1),dash=clamp(finite(loc.dashBlend),0,1),phase=finite(loc.stridePhase);
      const strafe=clamp(finite(loc.strafe)/5,-1,1),forward=clamp(finite(loc.forward)/5,-1,1);
      const yawRate=clamp(finite(signals.lookYaw),-8,8),pitchRate=clamp(finite(signals.lookPitch),-6,6),time=finite(signals.time);
      const kick=damp('kick',0,25,dt),equip=damp('equip',0,17,dt),impact=damp('impact',0,23,dt);
      const intensity=enabled?1:.22,runPose=run*(signals.firing?.3:1);
      const breathing=Math.sin(time*1.45)*.002*(1-move);
      const x=damp('x',Math.sin(phase)*.018*move-strafe*.021-yawRate*.0045,18,dt);
      const y=damp('y',Math.cos(phase*2)*.012*move-runPose*.035-dash*.035+breathing,19,dt);
      const z=damp('z',runPose*.018+dash*.04-forward*.006,16,dt);
      const pitch=damp('pitch',runPose*-.12-pitchRate*.012-clamp(finite(loc.accelForward),-20,20)*.0016,18,dt);
      const yaw=damp('yaw',-yawRate*.014-strafe*.018,19,dt);
      const roll=damp('weaponRoll',-strafe*.065-Math.sin(phase)*.018*move-yawRate*.004,18,dt);
      view.weapon.offset[0]=x*intensity;
      view.weapon.offset[1]=(y+equip-impact*.24)*intensity;
      view.weapon.offset[2]=z*intensity+kick*(enabled?1:.55);
      view.weapon.rotation[0]=pitch*intensity+kick*.85;
      view.weapon.rotation[1]=yaw*intensity;
      view.weapon.rotation[2]=roll*intensity;
      view.weapon.slide=clamp(kick*1.1,0,.075);
      if(enabled){
        view.height=damp('height',Math.cos(phase*2)*.010*move-dash*.022,21,dt);
        view.roll=damp('cameraRoll',-strafe*.008+clamp(yawRate*.0007,-.004,.004),13,dt);
        view.fov=damp('fov',run*4.5+dash*5.5,12,dt);
      }else{
        view.height=view.roll=view.fov=0;
        for(const key of ['height','cameraRoll','fov']){const q=channel(key);q.x=q.v=0;}
      }
      return view;
    }
    return {view,reset,update,impulse};
  }
  G.FMotion={create,basis,mount,place};
})(typeof window!=='undefined'?window:globalThis);
