/* METAL — FPS mapping and feedback. FInput owns devices; simulation receives values only. */
(function(G){
  'use strict';
  const holds=new Set(['forward','back','left','right','turnLeft','turnRight','fire','fireLeft','sprint','jump']);
  function create(prefs,{device='keyboard',getGamepads}={}){
    const actions=G.FOptions.actions.map(a=>({...a,type:holds.has(a.id)?'hold':'press',keys:[],pad:[]}));
    const input=G.FInput.create({actions,sticks:{move:{type:'move',pad:'LS',run:'sprint'},look:{type:'look',pad:'RS'}},device,getGamepads,singlePad:true,menu:true,moveCurve:true,releaseAfterClear:true});
    let settings=prefs,pending=null,lastEffect=-Infinity,gesture=false;
    function configure(p){
      settings=p;input.configure({v:1,keys:Object.fromEntries(actions.map(a=>[a.id,[]])),pad:p.padBindings,tune:{padYaw:p.padYaw,padPitch:p.padPitch,padDead:p.padDead,moveDead:p.padDead,padCurve:p.padCurve,padInvertY:p.padInvertY,padVibration:p.padVibration,swapSticks:p.padSwapSticks}});
      if(!p.padVibration){pending=null;input.clear();}
    }
    configure(prefs);
    function queue(strong,weak,duration){
      if(!gesture||input.device!=='gamepad'||!settings.padVibration)return;
      pending={strong:Math.max(pending?.strong||0,strong),weak:Math.max(pending?.weak||0,weak),duration:Math.max(pending?.duration||0,duration)};
    }
    return {
      configure,get device(){return input.device;},
      use(device){input.addLook(0,0,device);},
      label(id){return input.device==='gamepad'?input.label(id,'gamepad'):(settings.bindings[id]||[]).map(G.FOptions.keyName).join(' / ');},
      padLabel(id){return input.label(id,'gamepad');},
      frame(dt){const f=input.frame(dt);if(f.device==='gamepad'&&(f.pressed.length||f.nav?.direction||f.nav?.adjust))gesture=true;return f;},
      step:()=>input.step(),capture:device=>input.capture(device),
      clear(){pending=null;input.clear();},
      flush(now,playing){
        if(!playing||input.device!=='gamepad'||!gesture){pending=null;return false;}
        if(!pending||now-lastEffect<40)return false;
        const q=pending;pending=null;const played=input.rumble(q.strong,q.weak,q.duration,now);if(played)lastEffect=now;return played;
      },
      event(e,player){
        const distance=()=>Math.hypot((e.x??player?.x??0)-(player?.x||0),(e.y??player?.y??0)-(player?.y||0),(e.z??player?.z??0)-(player?.z||0));
        if(e.name==='shot'||['rocket','grenadeLaunch','fracture'].includes(e.name)&&e.owner==='player'){if(e.name!=='shot')e={...e,weapon:e.name==='grenadeLaunch'?3:2};const q=[[.08,.12,45],[.55,.35,140],[.6,.3,180],[.5,.4,160],[.12,.15,65]][e.weapon]||[.12,.15,65];queue(...q);}
        else if(e.name==='hurt')queue(.45*Math.min(1,(e.damage??e.amount??10)/20),.15,160);
        else if(e.name==='explosion'){const v=.7*Math.max(0,1-distance()/12);if(v)queue(v,v*.6,250);}
        else if(e.name==='bossDeath')queue(.8,.6,300);
        else if(['pickup','ammoPickup','weaponPickup','armorPickup','lootPickup'].includes(e.name))queue(.12,.2,70);
        else if(e.name==='trap'&&distance()<10)queue(.65,.4,180);
        else if(e.name==='boundaryContact')queue(.04,.06,35);
        else if(e.name==='land'||e.name==='landing')queue(.25,.15,90);
        else if(e.name==='jetpack')queue(.06,.12,55);
        else if(e.name==='profileSwitch'||e.name==='profileChanged'||e.name==='switchProfile')queue(.28,.45,120);
      }
    };
  }
  // Preserve each source's magnitude. Adding two movement sources would let a
  // held keyboard direction amplify a stick; angles and buttons do combine.
  function merge(host,pad){
    const out={...host};
    if((pad.moveX||0)**2+(pad.moveY||0)**2>(host.moveX||0)**2+(host.moveY||0)**2){out.moveX=pad.moveX;out.moveY=pad.moveY;}
    out.lookX=(host.lookX||0)+(pad.lookX||0);out.lookY=(host.lookY||0)+(pad.lookY||0);
    for(const k of ['fire','fireLeft','sprint','dash','pulse','melee','interact','switchProfile'])out[k]=!!(host[k]||pad[k]);
    out.jumpHeld=!!(host.jumpHeld||pad.jumpHeld||pad.jump);return out;
  }
  G.MetalControls={create,merge};
})(typeof window!=='undefined'?window:globalThis);
