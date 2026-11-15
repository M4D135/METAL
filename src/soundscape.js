/* METAL — local acoustic sources, independent of Web Audio and the renderer. */
(function(G){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ranges={materialImpact:19,materialBreak:30,debrisLand:15,explosion:60,bossTell:90,bossImpact:65,bossRoar:100,bossPhase:80,bossDeath:90,pipeLeak:20,steamWarning:17,liftStart:22,liftStop:22,doorOpen:18};
  const personal=new Set(['shot','fracture','rocket','grenadeLaunch','melee','dash','pulse','land']);
  // MIX-05 : les telegraphes du boss sont des alertes de jeu, pas des sons du
  // decor. Dans l'enclos, leur niveau ne peut pas descendre sous 0,6 ; le
  // panoramique et l'occultation restent ceux de la localisation.
  const tells=new Set(['bossTell','bossRoar','bossImpact','bossPhase']);
  function inArena(sim){const a=sim.state.world&&sim.state.world.bossArena,p=sim.state.player;return !!a&&!!p&&Math.hypot(p.x-a.x,p.z-a.z)<a.r&&Math.abs((p.y||0)-a.y)<5;}
  function create(){
    const cache=new Map();let frameKey='',probes=0,revision='',currentSim=null;
    function reset(){cache.clear();frameKey=revision='';probes=0;currentSim=null;}
    function begin(sim){
      if(sim!==currentSim){reset();currentSim=sim;}
      const state=sim.state,key=Math.floor(state.time*8),next=(sim.destruction?.revision??state.destructionRevision??0)+'/'+(state.doors||[]).map(q=>Math.round(q.progress*4)).join(',');
      if(next!==revision){revision=next;cache.clear();}
      if(key!==frameKey){frameKey=key;probes=0;}
    }
    function locate(sim,source,range=30,padding=.16){
      const p=sim.state.player,eyeY=(p.y||0)+1.62,x=source.x,z=source.z,y=Number.isFinite(source.y)?source.y:eyeY;
      if(!Number.isFinite(x)||!Number.isFinite(z))return {level:1,pan:0,occluded:0,distance:0};
      const dx=x-p.x,dy=y-eyeY,dz=z-p.z,distance=Math.hypot(dx,dy,dz),fade=Math.max(0,1-distance/range);
      if(!fade)return {level:0,pan:0,occluded:0,distance};
      begin(sim);
      // The endpoint allowance keeps a struck wall or an embedded motor from
      // muffling its own sound. Other intact walls and closed doors still do.
      const key=[Math.round(x*3),Math.round(y*3),Math.round(z*3),Math.round(padding*5)].join(','),old=cache.get(key),time=sim.state.time;
      let occluded=old?.occluded||0;
      if(distance>padding+.1&&typeof sim.ray==='function'&&(!old||time-old.time>.22||Math.hypot(p.x-old.x,eyeY-old.y,p.z-old.z)>.7)&&probes<12){
        const far=Math.max(0,distance-padding),hit=sim.ray([p.x,eyeY,p.z],[dx/distance,dy/distance,dz/distance],far);
        occluded=hit<far-.025?1:0;probes++;
        if(cache.size>=128)cache.delete(cache.keys().next().value);
        cache.set(key,{occluded,time,x:p.x,y:eyeY,z:p.z});
      }
      const level=fade*fade/(1+distance*.018)*(occluded?.34:1);
      return {level,pan:clamp((dx*Math.cos(p.yaw)+dz*Math.sin(p.yaw))/Math.max(.5,Math.hypot(dx,dz)),-1,1),occluded,distance};
    }
    function event(sim,e){
      if(personal.has(e.name)&&(e.owner==='player'||e.actor==='player'||!Number.isFinite(e.x)))return {...e,level:1,pan:0,occluded:0};
      const located={...e,...locate(sim,e,ranges[e.name]||36)};
      if(tells.has(e.name)&&inArena(sim))located.level=Math.max(.6,located.level);
      return located;
    }
    function sample(sim){
      const state=sim.state,world=state.world,p=state.player,alive=q=>q.destructibleId===undefined||!sim.destruction||sim.destruction.isAlive(q.destructibleId);
      const motors=[],steam=[];
      function add(list,source,range,weight,padding,kind){
        const distance=Math.hypot(source.x-p.x,(source.y||0)-(p.y+1.62),source.z-p.z);
        if(distance<range)list.push({source,range,weight,padding,kind,rank:Math.max(0,1-distance/range)**2*weight});
      }
      for(const q of world.machinery||[])if(alive(q)&&Number(q.speed)>0)add(motors,q,14,q.type==='reactor'?.38:q.type==='piston'?.58:.46,Math.max(.3,(q.size||1)*.45),q.type);
      for(const q of state.lifts||[])if(q.moving)add(motors,{x:q.x,y:q.y+.15,z:q.z},19,1,.55,'lift');
      for(const q of state.pipes||[])if(q.hot&&!q.broken&&alive(q)){
        const v=q.nozzle||[q.x,q.y||0,q.z];add(steam,{x:v[0],y:v[1],z:v[2]},12,1,.25,'steam');
      }
      for(const q of world.ambience||[])if(q.type==='steam'&&alive(q))add(steam,q,7,.26,.3,'steam');
      function strongest(list){
        let best={level:0,pan:0,occluded:0,kind:'lift'};
        // Compare only three nearby candidates per bus, never every emitter's
        // ray every frame. Occlusion can make an unobstructed runner-up louder.
        for(const q of list.sort((a,b)=>b.rank-a.rank).slice(0,3)){
          const mix=locate(sim,q.source,q.range,q.padding),level=mix.level*q.weight;
          if(level>best.level)best={...mix,level,kind:q.kind};
        }
        return best;
      }
      return {machinery:strongest(motors),steam:strongest(steam)};
    }
    return {reset,event,sample,locate};
  }
  G.FSoundscape={create};
})(typeof window!=='undefined'?window:globalThis);
