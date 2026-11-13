/* FERRO — persistent preferences and conflict-free keyboard bindings. */
(function(){
  'use strict';
  const actions=[['forward','Avancer',['KeyW','KeyZ','ArrowUp']],['back','Reculer',['KeyS','ArrowDown']],['left','À gauche',['KeyA','KeyQ']],['right','À droite',['KeyD']],['turnLeft','Tourner à gauche',['ArrowLeft']],['turnRight','Tourner à droite',['ArrowRight']],['fire','Tirer · main droite',['Enter']],['fireLeft','Tirer · main gauche',['KeyC']],['leftHand','Changer la main gauche',['KeyX']],['sprint','Courir',['ShiftLeft','ShiftRight']],['dash','Esquive',['Space']],['pulse','Onde défensive',['KeyE']],['melee','Coup de crosse',['KeyV']],['interact','Interagir',['KeyF']],['weapon1','Mitraillette',['Digit1']],['weapon2','Double pompe',['Digit2']],['weapon3','Lance-roquettes',['Digit3']],['weapon4','Lance-grenades',['Digit4']],['weapon5','Pistolet',['Digit5']],['map','Carte',['KeyM']],['pause','Pause',['KeyP']]];
  const allowed=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Space|Enter|Backspace|Tab)$/.test(code);
  function defaults(touch){return {muted:false,quality:'auto',difficulty:0,aiAcceleration:'auto',softMotion:true,fov:touch?79:74,brightness:1,sensitivity:1,invertY:false,systemPointerAcceleration:false,shadows:true,bloom:true,showFps:true,crt:false,vignette:true,crosshairScale:1,fpsLimit:0,masterVolume:1,musicVolume:.45,effectsVolume:1,ambienceVolume:1,bindings:Object.fromEntries(actions.map(([id,,codes])=>[id,codes.slice()]))};}
  function normalize(raw,touch){
    const out=defaults(touch),v=raw&&typeof raw==='object'?raw:{};
    for(const id of ['muted','softMotion','invertY','systemPointerAcceleration','shadows','bloom','showFps','crt','vignette'])if(typeof v[id]==='boolean')out[id]=v[id];
    if(['auto','low','high'].includes(v.quality))out.quality=v.quality;
    if(['auto','cpu'].includes(v.aiAcceleration))out.aiAcceleration=v.aiAcceleration;
    for(const [id,min,max] of [['fov',60,110],['brightness',.7,1.4],['sensitivity',.25,3],['crosshairScale',.75,1.5],['masterVolume',0,1],['musicVolume',0,1],['effectsVolume',0,1],['ambienceVolume',0,1]])if(typeof v[id]==='number'&&Number.isFinite(v[id]))out[id]=Math.max(min,Math.min(max,v[id]));
    if([0,30,60,120].includes(v.fpsLimit))out.fpsLimit=v.fpsLimit;
    if([0,1,2].includes(v.difficulty))out.difficulty=v.difficulty;
    if(v.bindings&&typeof v.bindings==='object'){
      const candidate={},seen=new Set();let valid=true;
      const added=['melee','fireLeft','leftHand','weapon4','weapon5'],used=new Set(actions.flatMap(([id])=>Array.isArray(v.bindings[id])?v.bindings[id]:added.includes(id)?[]:out.bindings[id]));
      for(const id of added)if(v.bindings[id]===undefined){const preferred=id==='melee'?['KeyV','KeyC','KeyB','KeyN','KeyH']:[...out.bindings[id],'KeyG','KeyT','KeyY'];const key=[...preferred,...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>'Key'+c),...'1234567890'.split('').map(c=>'Digit'+c)].find(key=>!used.has(key));if(key){out.bindings[id]=[key];used.add(key);}}
      for(const [id] of actions){
        const codes=v.bindings[id]??out.bindings[id];
        if(!Array.isArray(codes)||codes.length<1||codes.length>3){valid=false;break;}
        candidate[id]=codes.slice();
        for(const code of codes){if(!allowed(code)||seen.has(code))valid=false;seen.add(code);}
      }
      if(valid)out.bindings=candidate;
    }
    return out;
  }
  function assign(bindings,action,code){
    if(!actions.some(a=>a[0]===action)||!allowed(code))return {ok:false,reason:'Cette touche est réservée au navigateur.'};
    const conflict=actions.find(([id])=>id!==action&&bindings[id]?.includes(code));
    if(conflict)return {ok:false,reason:'Déjà utilisée : '+conflict[1]+'.',conflict:conflict[0]};
    return {ok:true,bindings:{...bindings,[action]:[code]}};
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
  window.FOptions={defaults,normalize,assign,keyName,createFrameGate,frameGate,fireBufferMs:150,actions:actions.map(([id,label])=>({id,label})),down:(bindings,keys,id)=>(bindings[id]||[]).some(code=>keys.has(code)),matches:(bindings,id,code)=>(bindings[id]||[]).includes(code)};
})();
