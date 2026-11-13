/* FERRO — generic input layer: named actions, keyboard by event.code, standard gamepad, touch widgets, menu focus. */
(function(G){
  'use strict';
  const PAD_BUTTONS=Object.freeze(['A','B','X','Y','LB','RB','LT','RT','Back','Start','L3','R3','Up','Down','Left','Right','Home']);
  // [default, min, max] for numbers, [default] for booleans
  const TUNE={sensitivity:[1,.25,3],invertY:[false],padYaw:[300,60,600],padPitch:[190,40,400],padDead:[.12,0,.4],moveDead:[.15,0,.4],padCurve:[1.7,1,3],padBoost:[.8,0,1.5],padInvertY:[false],padVibration:[1,0,1],swapSticks:[false],touchAccel:[1,0,1],touchPitch:[1,.5,1.5],stickRadius:[56,32,96]};
  for(const k in TUNE)Object.freeze(TUNE[k]);
  Object.freeze(TUNE);
  const K={outer:.97,boostAt:.97,boostAfter:.18,boostRamp:.30,trigOn:.30,trigOff:.18,valueDead:.05,padRun:.92,activeAxis:.3,navAxis:.5,navDelay:.40,navRepeat:.12,touchDead:.12,follow:1.6,runOn:1.25,runOff:1.05,touchRad:.004,v0:400,v1:2200,accel:2.2,slop:4,compatMs:800,rumbleGap:40,dtMax:.25,tdtMin:.008,tdtMax:.05};
  const allowKey=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Space|Enter|Backspace|Tab)$/.test(code);
  const NAMES={Space:'Espace',Enter:'Entrée',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ShiftLeft:'Maj G',ShiftRight:'Maj D',ControlLeft:'Ctrl G',ControlRight:'Ctrl D',Backspace:'Retour',Tab:'Tab'};
  const DEVICES=['keyboard','mouse','touch','gamepad'];
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const isObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const need=(ok,what)=>{if(!ok)throw new Error('FInput : '+what+'.');};
  const padOk=name=>name!=='Home'&&PAD_BUTTONS.includes(name);
  function keyName(code){return own(NAMES,code)?NAMES[code]:String(code).replace(/^(Key|Digit)/,'');}
  // Checks a game declaration and returns a private copy; the config itself is never modified.
  function compile(config){
    need(isObj(config),'config invalide');
    const allow=config.allowKey===undefined?allowKey:config.allowKey,list=config.actions;
    need(typeof allow==='function','allowKey doit être une fonction');
    need(Array.isArray(list)&&list.length>0,'actions doit être un tableau non vide');
    const isKey=c=>typeof c==='string'&&!!allow(c),text=v=>v===undefined||typeof v==='string';
    const actions=[],index=new Map(),owner=new Map();
    // keys and pad: list length, accepted codes, no code twice (one owner per code and device)
    const codes=(id,v,max,ok,dev)=>{
      const r=v===undefined?[]:v;
      need(Array.isArray(r)&&r.length<=max&&r.every(ok),(dev==='k'?'touches':'boutons')+' invalides pour '+id);
      for(const c of r){need(!owner.has(dev+c),c+' déjà affecté à '+owner.get(dev+c));owner.set(dev+c,id);}
      return r.slice();
    };
    for(const a of list){
      const id=isObj(a)?a.id:undefined;
      need(typeof id==='string'&&/^[A-Za-z][A-Za-z0-9]*$/.test(id),'identifiant d’action invalide : '+String(id));
      need(!index.has(id),'identifiant en double : '+id);
      need(a.type==='hold'||a.type==='press'||a.type==='value','type inconnu pour '+id);
      const label=a.label===undefined?id:a.label;
      need(typeof label==='string'&&text(a.touch)&&text(a.mouse),'libellé invalide pour '+id);
      need(a.alt===undefined||Array.isArray(a.alt)&&a.alt.every(isKey),'repli invalide pour '+id);
      actions.push({id,label,type:a.type,keys:codes(id,a.keys,3,isKey,'k'),pad:codes(id,a.pad,2,padOk,'p'),touch:a.touch,mouse:a.mouse,alt:a.alt?a.alt.slice():[]});
      index.set(id,actions.length-1);
    }
    const held=id=>index.has(id)&&actions[index.get(id)].type==='hold';
    const decl=config.sticks===undefined?{}:config.sticks,sticks=[];
    need(isObj(decl),'sticks invalides');
    for(const name of Object.keys(decl)){
      const s=decl[name],w='stick '+name;
      need(/^[a-z][A-Za-z0-9]*$/.test(name)&&!index.has(name+'X')&&!index.has(name+'Y'),'nom de stick invalide : '+name);
      need(isObj(s)&&(s.type==='move'||s.type==='look')&&!sticks.some(t=>t.type===s.type),w+' : type invalide ou en double');
      // axis: [] or [negative, positive], hold actions only
      const axis=v=>{const r=v===undefined?[]:v;need(Array.isArray(r)&&(r.length===0||r.length===2)&&r.every(held),w+' : axe invalide');return r.slice();};
      const x=axis(s.x),y=axis(s.y);
      need(new Set(x.concat(y)).size===x.length+y.length,w+' : action en double');
      need(s.pad===undefined||(s.pad==='LS'||s.pad==='RS')&&!sticks.some(t=>t.pad===s.pad),w+' : pad invalide');
      need(s.run===undefined||s.type==='move'&&held(s.run),w+' : run invalide');
      need(s.rate===undefined||s.type==='look'&&Number.isFinite(s.rate)&&s.rate>0,w+' : rate invalide');
      sticks.push({name,type:s.type,x,y,pad:s.pad||null,run:s.run===undefined?null:s.run,rate:s.rate===undefined?2:s.rate});
    }
    const version=config.version===undefined?1:config.version,device=config.device===undefined?'keyboard':config.device,mouseScale=config.mouseScale===undefined?.0022:config.mouseScale;
    need(Number.isInteger(version)&&version>=1,'version invalide');
    need(DEVICES.includes(device),'appareil invalide : '+String(device));
    need(Number.isFinite(mouseScale),'mouseScale invalide');
    need(config.getGamepads===undefined||typeof config.getGamepads==='function','getGamepads doit être une fonction');
    return {actions,index,sticks,version,device,mouseScale,isKey,getGamepads:config.getGamepads||null,migrate:typeof config.migrate==='function'?config.migrate:null,settings:config.settings};
  }
  // Filled in by the next steps of docs/chantier-moteur/modules/entrees.md (§2, delivery table).
  function radial(x,y,inner,outer){/* step 4: radial dead zone → [x', y', n] */}
  function padStyle(id){/* step 5 */} function glyph(name,style){/* step 5 */}
  function defaults(config){/* step 3 */} function normalize(raw,config){/* step 3 */}
  function assign(config,settings,device,action,code){/* step 3 */} function unbind(config,settings,device,action){/* step 3 */}
  function guessDevice(win){/* step 5 */} function focusMove(root,cmd,doc){/* step 6 */}
  function create(config){
    compile(config);
    return {}; // instance: steps 2 to 7
  }
  G.FInput={version:1,PAD_BUTTONS,TUNE,create,defaults,normalize,assign,unbind,keyName,radial,padStyle,glyph,guessDevice,focusMove};
})(typeof window!=='undefined'?window:globalThis);
