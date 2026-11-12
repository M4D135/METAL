/* FERRO — persistent preferences and conflict-free keyboard bindings. */
(function(){
  'use strict';
  const actions=[['forward','Avancer',['KeyW','KeyZ','ArrowUp']],['back','Reculer',['KeyS','ArrowDown']],['left','À gauche',['KeyA','KeyQ']],['right','À droite',['KeyD']],['turnLeft','Tourner à gauche',['ArrowLeft']],['turnRight','Tourner à droite',['ArrowRight']],['fire','Tirer · main droite',['Enter']],['fireLeft','Tirer / bouclier · main gauche',['KeyC']],['leftHand','Changer la main gauche',['KeyX']],['sprint','Courir',['ShiftLeft','ShiftRight']],['dash','Esquive / coup de bouclier',['Space']],['pulse','Onde défensive',['KeyE']],['melee','Coup de crosse',['KeyV']],['interact','Interagir',['KeyF']],['weapon1','Mitraillette',['Digit1']],['weapon2','Double pompe',['Digit2']],['weapon3','Lance-roquettes',['Digit3']],['weapon4','Lance-grenades',['Digit4']],['map','Carte',['KeyM']],['pause','Pause',['KeyP']]];
  const allowed=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Space|Enter|Backspace|Tab)$/.test(code);
  function defaults(touch){return {muted:false,quality:'auto',difficulty:0,aiAcceleration:'auto',softMotion:true,fov:touch?79:74,brightness:1,sensitivity:1,invertY:false,shadows:true,bloom:true,showFps:true,crt:false,vignette:true,crosshairScale:1,fpsLimit:0,masterVolume:1,musicVolume:.45,effectsVolume:1,ambienceVolume:1,bindings:Object.fromEntries(actions.map(([id,,codes])=>[id,codes.slice()]))};}
  function normalize(raw,touch){
    const out=defaults(touch),v=raw&&typeof raw==='object'?raw:{};
    for(const id of ['muted','softMotion','invertY','shadows','bloom','showFps','crt','vignette'])if(typeof v[id]==='boolean')out[id]=v[id];
    if(['auto','low','high'].includes(v.quality))out.quality=v.quality;
    if(['auto','cpu'].includes(v.aiAcceleration))out.aiAcceleration=v.aiAcceleration;
    for(const [id,min,max] of [['fov',60,110],['brightness',.7,1.4],['sensitivity',.25,3],['crosshairScale',.75,1.5],['masterVolume',0,1],['musicVolume',0,1],['effectsVolume',0,1],['ambienceVolume',0,1]])if(typeof v[id]==='number'&&Number.isFinite(v[id]))out[id]=Math.max(min,Math.min(max,v[id]));
    if([0,30,60,120].includes(v.fpsLimit))out.fpsLimit=v.fpsLimit;
    if([0,1,2].includes(v.difficulty))out.difficulty=v.difficulty;
    if(v.bindings&&typeof v.bindings==='object'){
      const candidate={},seen=new Set();let valid=true;
      const added=['melee','fireLeft','leftHand','weapon4'],used=new Set(actions.flatMap(([id])=>Array.isArray(v.bindings[id])?v.bindings[id]:added.includes(id)?[]:out.bindings[id]));
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
  window.FOptions={defaults,normalize,assign,keyName,actions:actions.map(([id,label])=>({id,label})),down:(bindings,keys,id)=>(bindings[id]||[]).some(code=>keys.has(code)),matches:(bindings,id,code)=>(bindings[id]||[]).includes(code)};
})();
