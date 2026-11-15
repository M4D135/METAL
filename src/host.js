/* FERRO — optional browser facilities; no world state, timers or storage. */
(function(G){'use strict';
function create(w=G){
  const d=w.document;let wanted=false,lease=null,pending=null,epoch=0,disposed=false,motion=null,motionAt=-Infinity,gyro=false,gyroEpoch=0;
  const now=()=>w.performance?.now?.()??0;
  function release(){const previous=lease;lease=null;try{previous?.release?.()?.catch?.(()=>{});}catch{}}
  function acquire(){
    if(disposed||!wanted||d?.hidden||lease||pending||!w.navigator?.wakeLock?.request)return;
    const serial=epoch;
    pending=Promise.resolve().then(()=>w.navigator.wakeLock.request('screen')).then(value=>{
      if(disposed||!wanted||d?.hidden||serial!==epoch){try{value.release()?.catch?.(()=>{});}catch{};return;}
      lease=value;value.addEventListener?.('release',()=>{if(lease===value)lease=null;});
    }).catch(()=>{}).finally(()=>{pending=null;if(serial!==epoch)acquire();});
  }
  function keepAwake(on){on=!!on;if(on!==wanted){wanted=on;epoch++;}if(wanted)acquire();else release();}
  function visibility(){epoch++;if(d?.hidden){release();motion=null;}else acquire();}
  function onMotion(e){const r=e.rotationRate,g=e.accelerationIncludingGravity;if(!gyro||!r||!g)return;motion={rate:{alpha:r.alpha,beta:r.beta,gamma:r.gamma},gravity:{x:g.x,y:g.y,z:g.z}};motionAt=now();}
  async function enableGyro(on){
    const serial=++gyroEpoch;gyro=false;motion=null;w.removeEventListener?.('devicemotion',onMotion);
    if(!on||disposed||w.isSecureContext===false||!w.DeviceMotionEvent)return false;
    try{if(w.DeviceMotionEvent.requestPermission&&await w.DeviceMotionEvent.requestPermission()!=='granted')return false;}catch{return false;}
    if(disposed||serial!==gyroEpoch)return false;gyro=true;w.addEventListener?.('devicemotion',onMotion);return true;
  }
  function sampleGyro(dt,active,gain){return gyro&&active&&motion&&now()-motionAt<=120?G.FTouch.gyroAim(motion.rate,motion.gravity,Number(w.screen?.orientation?.angle??w.orientation??0),dt,gain):{lookX:0,lookY:0};}
  async function immersive(){try{if(!d.fullscreenElement)await d.documentElement.requestFullscreen?.();try{await w.screen?.orientation?.lock?.('landscape');}catch{}return !!d.fullscreenElement;}catch{return false;}}
  function dispose(){disposed=true;epoch++;wanted=false;release();enableGyro(false);d?.removeEventListener?.('visibilitychange',visibility);w.removeEventListener?.('pagehide',dispose);}
  d?.addEventListener?.('visibilitychange',visibility);w.addEventListener?.('pagehide',dispose);
  return {keepAwake,enableGyro,sampleGyro,immersive,dispose,get awake(){return !!lease;},get gyro(){return gyro;}};
}
G.FHost={create};
})(typeof window!=='undefined'?window:globalThis);
