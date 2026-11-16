/* FERRO — DOM-independent pointer ownership, mobile aim and portrait projection. */
(function(G){'use strict';
const finite=(v,min,max,fallback)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
// Pointer ownership and per-frame touch aim, independent of the DOM.
function create(settings={}){
  const normalize=s=>({touchAccel:finite(s.touchAccel,0,1,1),sensitivity:finite(s.sensitivity,.25,3,1),invertY:s.invertY===true});let tune=normalize(settings),dx=0,dy=0,speed=0;
  const pointers=new Map(),roles=new Map();
  function clear(){pointers.clear();roles.clear();dx=dy=speed=0;}
  function begin(role,id,x,y,radius=56){
    if(!['move','look','fire','fireLeft','jump','descend'].includes(role)||!Number.isFinite(id)||roles.has(role)||pointers.has(id)||!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(radius))return false;
    const p={role,id,x,y,startX:x,startY:y,cx:x,cy:y,radius:Math.max(32,Math.min(96,radius)),aiming:role==='look',run:false,mx:0,my:0};
    pointers.set(id,p);roles.set(role,p);return true;
  }
  function move(id,x,y){
    const p=pointers.get(id);if(!p||!Number.isFinite(x)||!Number.isFinite(y))return false;
    if(p.role==='move'){
      let ox=x-p.cx,oy=y-p.cy,d=Math.hypot(ox,oy),r=p.radius;
      p.run=p.run?d>r*1.05:d>r*1.25;
      if(d>r*1.6){const follow=1-r*1.6/d;p.cx+=ox*follow;p.cy+=oy*follow;ox=x-p.cx;oy=y-p.cy;d=r*1.6;}
      const amount=Math.max(0,Math.min(1,(d/r-.12)/.88));p.mx=d?ox/d*amount:0;p.my=d?-oy/d*amount:0;
    }else if(['look','fire','fireLeft'].includes(p.role)){
      if(p.aiming){dx+=x-p.x;dy+=y-p.y;}
      else if(Math.hypot(x-p.startX,y-p.startY)>4){p.aiming=true;dx+=x-p.startX;dy+=y-p.startY;}
    }
    p.x=x;p.y=y;return true;
  }
  function end(id){const p=pointers.get(id);if(!p)return false;pointers.delete(id);roles.delete(p.role);return true;}
  function sample(dt){
    const seconds=Math.max(.008,Math.min(.05,Number.isFinite(dt)?dt:1/60));
    speed+=(Math.hypot(dx,dy)/seconds-speed)*.5;
    const t=Math.max(0,Math.min(1,(speed-400)/1800)),gain=1+2.2*t*t*(3-2*t)*(tune.touchAccel??1),scale=.004*(tune.sensitivity??1)*gain;
    const p=roles.get('move'),out={moveX:p?.mx||0,moveY:p?.my||0,sprint:!!p?.run,lookX:dx*scale,lookY:-dy*scale*(tune.invertY?-1:1),fire:roles.has('fire'),fireLeft:roles.has('fireLeft'),jumpHeld:roles.has('jump'),descendHeld:roles.has('descend')};
    dx=dy=0;return out;
  }
  return {begin,move,end,sample,clear,configure(value){tune=normalize(value);},has:id=>pointers.has(id),role:id=>pointers.get(id)?.role,get aiming(){return ['look','fire','fireLeft'].some(r=>roles.has(r));},get stick(){const p=roles.get('move');return p?{x:p.cx,y:p.cy,dx:p.mx*p.radius,dy:-p.my*p.radius,radius:p.radius,run:p.run}:null;}};
}

function gyroAim(rate,gravity,angle,dt,gain=1){
  const out={lookX:0,lookY:0};if(!rate||!gravity||!Number.isFinite(angle)||!Number.isFinite(dt)||dt<=0)return out;
  const r=[rate.beta,rate.gamma,rate.alpha],g=[gravity.x,gravity.y,gravity.z];
  if(!r.every(Number.isFinite)||!g.every(Number.isFinite))return out;
  const len=Math.hypot(...g);if(len<1)return out;
  const a=angle*Math.PI/180,dead=v=>Math.abs(v)<.6?0:Math.max(-400,Math.min(400,v));
  const scale=Math.PI/180*Math.min(.05,dt)*finite(gain,.5,2,1);
  out.lookX=-dead((r[0]*g[0]+r[1]*g[1]+r[2]*g[2])/len)*scale||0;
  out.lookY=dead(r[0]*Math.cos(a)+r[1]*Math.sin(a))*scale||0;return out;
}
function fovFor(aspect,vertical,minHorizontal=50){
  const v=finite(vertical,40,110,75);if(!Number.isFinite(aspect)||aspect<=0)return v;
  return Math.max(v,Math.min(104,2*Math.atan(Math.tan(finite(minHorizontal,30,80,50)*Math.PI/360)/aspect)*180/Math.PI));
}
G.FTouch={create,gyroAim,fovFor};
})(typeof window!=='undefined'?window:globalThis);
