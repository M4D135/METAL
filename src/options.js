/* FERRO — persistent preferences and conflict-free keyboard bindings. */
(function(){
  'use strict';
  const actions=[['forward','Avancer',['KeyW','KeyZ','ArrowUp']],['back','Reculer',['KeyS','ArrowDown']],['left','À gauche',['KeyA','KeyQ']],['right','À droite',['KeyD']],['turnLeft','Tourner à gauche',['ArrowLeft']],['turnRight','Tourner à droite',['ArrowRight']],['fire','Tirer · main droite',['Enter']],['fireLeft','Tirer · main gauche',['KeyC']],['leftHand','Changer la main gauche',['KeyX']],['sprint','Courir',['ShiftLeft','ShiftRight']],['jump','Sauter / jetpack',['Space']],['dash','Esquive',['KeyR']],['pulse','Onde défensive',['KeyE']],['melee','Coup de crosse',['KeyV']],['interact','Interagir',['KeyF']],['weapon1','Mitraillette',['Digit1']],['weapon2','Double pompe',['Digit2']],['weapon3','Lance-roquettes',['Digit3']],['weapon4','Lance-grenades',['Digit4']],['weapon5','Pistolet',['Digit5']],['map','Carte',['KeyM']],['pause','Pause',['KeyP']],['weaponNext','Arme suivante',['KeyN']],['switchProfile','Changer de profil',['KeyT']]];
  const padNames=['A','B','X','Y','LB','RB','LT','RT','Back','Start','L3','R3','Up','Down','Left','Right'];
  const padDefaults={fire:['RT'],fireLeft:['LT'],sprint:['L3'],jump:['A'],dash:['B'],pulse:['LB'],melee:['R3'],interact:['X'],weaponNext:['Y'],switchProfile:['RB'],weapon1:['Up'],weapon2:['Right'],weapon3:['Down'],weapon4:['Left'],map:['Back'],pause:['Start']};
  const allowed=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Space|Enter|Backspace|Tab)$/.test(code);
  function defaults(touch){return {muted:false,quality:'auto',difficulty:0,aiAcceleration:'auto',softMotion:true,fov:touch?79:74,brightness:1,sensitivity:1,invertY:false,systemPointerAcceleration:false,shadows:true,bloom:true,showFps:true,crt:false,vignette:true,crosshairScale:1,fpsLimit:-1,renderScale:1,masterVolume:1,musicVolume:.45,effectsVolume:1,ambienceVolume:1,bindingsVersion:2,bindings:Object.fromEntries(actions.map(([id,,codes])=>[id,codes.slice()])),padVersion:1,padBindings:Object.fromEntries(actions.map(([id])=>[id,(padDefaults[id]||[]).slice()])),padYaw:300,padPitch:190,padDead:.07,padCurve:1.3,padInvertY:false,padAssist:true,padVibration:1,padSwapSticks:false,touchAccel:1,touchAssist:true,portraitFov:true,gyroMode:'off',gyroSensitivity:1};}
  function normalize(raw,touch){
    const out=defaults(touch),v=raw&&typeof raw==='object'?raw:{};
    for(const id of ['muted','softMotion','invertY','systemPointerAcceleration','shadows','bloom','showFps','crt','vignette','padInvertY','padAssist','padSwapSticks','touchAssist','portraitFov'])if(typeof v[id]==='boolean')out[id]=v[id];
    if(['auto','low','high'].includes(v.quality))out.quality=v.quality;
    if(['auto','cpu'].includes(v.aiAcceleration))out.aiAcceleration=v.aiAcceleration;
    for(const [id,min,max] of [['fov',60,110],['brightness',.7,1.4],['sensitivity',.25,3],['crosshairScale',.75,1.5],['masterVolume',0,1],['musicVolume',0,1],['effectsVolume',0,1],['ambienceVolume',0,1],['padYaw',60,600],['padPitch',40,400],['padDead',0,.4],['padCurve',1,3],['padVibration',0,1],['touchAccel',0,1],['gyroSensitivity',.5,2]])if(typeof v[id]==='number'&&Number.isFinite(v[id]))out[id]=Math.max(min,Math.min(max,v[id]));
    if(['off','aim','on'].includes(v.gyroMode))out.gyroMode=v.gyroMode;
    if([-1,0,30,60,120,144].includes(v.fpsLimit))out.fpsLimit=v.fpsLimit;
    if([1,.85,.75,.66,.5].includes(v.renderScale))out.renderScale=v.renderScale;
    if([0,1,2].includes(v.difficulty))out.difficulty=v.difficulty;
    const bindings=v.bindings&&typeof v.bindings==='object'?{...v.bindings}:null;
    if(bindings&&v.bindingsVersion!==2&&!bindings.jump&&JSON.stringify(bindings.dash)===JSON.stringify(['Space'])){const used=new Set(Object.entries(bindings).filter(([k])=>k!=='dash').flatMap(([,a])=>Array.isArray(a)?a:[]));bindings.dash=[['KeyR','KeyG','KeyB',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(x=>'Key'+x)].find(k=>!used.has(k))||'KeyR'];}
    if(bindings){
      const candidate={},seen=new Set();let valid=true;
      const added=['melee','fireLeft','leftHand','weapon4','weapon5','jump','weaponNext','switchProfile'],used=new Set(actions.flatMap(([id])=>Array.isArray(bindings[id])?bindings[id]:added.includes(id)?[]:out.bindings[id]));
      for(const id of added)if(bindings[id]===undefined){const preferred=id==='melee'?['KeyV','KeyC','KeyB','KeyN','KeyH']:[...out.bindings[id],'KeyG','KeyT','KeyY'];const key=[...preferred,...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>'Key'+c),...'1234567890'.split('').map(c=>'Digit'+c)].find(key=>!used.has(key));if(key){out.bindings[id]=[key];used.add(key);}}
      for(const [id] of actions){
        const codes=bindings[id]??out.bindings[id];
        if(!Array.isArray(codes)||codes.length<1||codes.length>3){valid=false;break;}
        candidate[id]=codes.slice();
        for(const code of codes){if(!allowed(code)||seen.has(code))valid=false;seen.add(code);}
      }
      if(valid)out.bindings=candidate;
    }
    if(v.padBindings&&typeof v.padBindings==='object'){
      const used=new Set(),candidate={};let valid=true;
      for(const [id] of actions)if(Object.prototype.hasOwnProperty.call(v.padBindings,id)){const a=v.padBindings[id];if(!Array.isArray(a)||a.length>2){valid=false;break;}for(const n of a){if(!padNames.includes(n)||used.has(n))valid=false;used.add(n);}}
      if(valid){for(const [id] of actions)candidate[id]=Object.prototype.hasOwnProperty.call(v.padBindings,id)?v.padBindings[id].slice():out.padBindings[id].filter(n=>!used.has(n)&&used.add(n));out.padBindings=candidate;}
    }
    return out;
  }
  function assign(bindings,action,code){
    if(!actions.some(a=>a[0]===action)||!allowed(code))return {ok:false,reason:'Cette touche est réservée au navigateur.'};
    const conflict=actions.find(([id])=>id!==action&&bindings[id]?.includes(code));
    if(conflict)return {ok:false,reason:'Déjà utilisée : '+conflict[1]+'.',conflict:conflict[0]};
    return {ok:true,bindings:{...bindings,[action]:[code]}};
  }
  function assignPad(bindings,action,code){
    if(!actions.some(a=>a[0]===action)||code!==null&&!padNames.includes(code))return {ok:false,reason:'Bouton réservé ou inconnu.'};
    const conflict=code===null?null:actions.find(([id])=>id!==action&&bindings[id]?.includes(code));
    if(conflict)return {ok:false,reason:'Déjà utilisé : '+conflict[1]+'.',conflict:conflict[0]};
    return {ok:true,bindings:{...bindings,[action]:code===null?[]:[code]}};
  }
  function keyName(code){return ({Space:'Espace',Enter:'Entrée',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ShiftLeft:'Maj G',ShiftRight:'Maj D',ControlLeft:'Ctrl G',ControlRight:'Ctrl D',Backspace:'Retour',Tab:'Tab'})[code]||String(code).replace(/^(Key|Digit)/,'');}
  // LOOP-09: observe every rAF, including callbacks whose drawing is skipped.
  // The nearest whole-vsync cadence is deliberate; effectiveHz is exposed so
  // the host never labels 72 rendered frames/s as a strict 60 frames/s cap.
  function createFrameGate(){return {samples:new Float64Array(30).fill(Infinity),sorted:new Float64Array(30),count:0,at:0,last:NaN,period:0,refreshHz:0,effectiveHz:0,stride:1,strideHz:0,phase:0,limit:NaN,due:NaN};}
  function frameGate(g,now,limit=0){
    if(!Number.isFinite(now))return false;
    limit=Number.isFinite(limit)&&limit>0?limit:0;
    const gap=now-g.last;
    if(Number.isFinite(g.last)&&gap>0&&gap<=250){
      g.samples[g.at]=gap;g.at=(g.at+1)%30;g.count=Math.min(30,g.count+1);
      if(g.count>=6){
        g.sorted.set(g.samples);g.sorted.sort();const middle=g.count>>1;
        g.period=g.count%2?g.sorted[middle]:(g.sorted[middle-1]+g.sorted[middle])/2;
        g.refreshHz=1000/g.period;
      }
    }else if(Number.isFinite(g.last)&&gap===0)return false;
    else{
      g.samples.fill(Infinity);g.count=g.at=0;g.period=g.refreshHz=g.effectiveHz=g.strideHz=0;g.phase=0;g.due=NaN;
    }
    g.last=now;
    let stride=1;
    if(limit&&g.period&&limit<g.refreshHz*.95){
      const ratio=g.refreshHz/limit,nearest=Math.max(1,Math.round(ratio+1e-7));
      const fresh=limit!==g.limit||!g.strideHz||Math.abs(g.refreshHz/g.strideHz-1)>.02;
      if(fresh){
        // A measured half-integer tie favors the longer interval. Do not keep
        // the uncalibrated stride=1 merely because the first estimate jitters.
        const half=Math.floor(ratio)+.5;
        stride=Math.abs(ratio-half)<=.02?Math.ceil(half):nearest;g.strideHz=g.refreshHz;
      }else{
        // ±0.02 around the half-integer prevents timestamp noise from changing
        // the divider and restarting its phase. A >2% refresh shift reselects it.
        stride=g.stride;
        if(ratio<stride-.52||ratio>stride+.52){stride=nearest;g.strideHz=g.refreshHz;}
      }
    }else g.strideHz=g.refreshHz;
    if(limit!==g.limit||stride!==g.stride){g.phase=0;g.due=NaN;}
    g.limit=limit;g.stride=stride;g.effectiveHz=g.period?g.refreshHz/stride:0;
    if(!limit)return true;
    if(g.period){const show=g.phase===0;g.phase=(g.phase+1)%stride;return show;}
    // During the short calibration window, retain accumulated deadlines rather
    // than resetting to each rendered callback and losing fractional periods.
    const target=1000/limit,half=gap>0&&gap<=250?gap/2:0;
    if(!Number.isFinite(g.due))g.due=now;
    if(now<g.due-half)return false;
    g.due+=target;if(g.due<now-target)g.due=now+target;
    return true;
  }
  window.FOptions={cadenceChoice:(p95,previous=60)=>!Number.isFinite(p95)||p95>(previous===30?9:11.7)?30:60,defaults,normalize,assign,assignPad,padNames,keyName,createFrameGate,frameGate,fireBufferMs:150,actions:actions.map(([id,label])=>({id,label})),down:(bindings,keys,id)=>(bindings[id]||[]).some(code=>keys.has(code)),matches:(bindings,id,code)=>(bindings[id]||[]).includes(code)};
})();
