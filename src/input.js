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
  const fin=v=>Number.isFinite(v)?v:0,copy=o=>JSON.parse(JSON.stringify(o));
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
  // Settings (JSON): {v, keys, pad, tune}; tables follow the declaration order.
  function initial(C){const s={v:C.version,keys:{},pad:{},tune:{}};for(const a of C.actions){s.keys[a.id]=a.keys.slice();s.pad[a.id]=a.pad.slice();}for(const k in TUNE)s.tune[k]=TUNE[k][0];return s;}
  // A stored table is kept whole or not at all. A missing action takes its default codes that no entry uses,
  // else its first free alt code (keys only), else none; each code given out is used for the next actions.
  function table(t,C,f,max,ok){
    if(!isObj(t))return null;
    const used=new Set(),out={},free=c=>!used.has(c);
    for(const a of C.actions)if(own(t,a.id)){const v=t[a.id];if(!Array.isArray(v)||v.length>max||!v.every(c=>ok(c)&&free(c)&&used.add(c)))return null;}
    for(const a of C.actions){
      let v=t[a.id];
      if(!own(t,a.id)){v=a[f].filter(free);if(!v.length&&f==='keys')v=a.alt.filter(free).slice(0,1);for(const c of v)used.add(c);}
      out[a.id]=v;
    }
    return out;
  }
  // Lenient and idempotent. An older format (v below the version, or not an integer) goes through the game's
  // migrate, called on its own copy: a migrate that throws or returns no object changes nothing.
  function settle(raw,C){
    let r={};if(isObj(raw))try{r=copy(raw);}catch(e){}if(!isObj(r))r={};
    const from=Number.isInteger(r.v)?r.v:0,{migrate}=C;
    if(from<C.version&&migrate)try{const m=copy(migrate(copy(r),from));if(isObj(m))r=m;}catch(e){}
    const s=initial(C),t=isObj(r.tune)?r.tune:{};
    s.keys=table(r.keys,C,'keys',3,C.isKey)||s.keys;s.pad=table(r.pad,C,'pad',2,padOk)||s.pad;
    for(const k in TUNE){const [d,lo,hi]=TUNE[k],v=own(t,k)?t[k]:d;s.tune[k]=lo===undefined?typeof v==='boolean'?v:d:Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d;}
    return s;
  }
  // Rebinding works on normalize(settings), a new object: the arguments are never modified.
  function rebind(C,settings,device,action,code,none){
    const kb=device==='keyboard',f=kb?'keys':'pad',no=reason=>({ok:false,reason});
    if(!kb&&device!=='gamepad')return no('Appareil inconnu.');
    if(!C.index.has(action))return no('Action inconnue.');
    if(!none&&!(kb?C.isKey(code):padOk(code)))return no(kb?'Cette touche est réservée au navigateur.':code==='Home'?'Ce bouton est réservé au système.':'Bouton inconnu.');
    const s=settle(settings,C),other=none?null:C.actions.find(a=>a.id!==action&&s[f][a.id].includes(code));
    if(other)return {ok:false,conflict:other.id,reason:'Déjà utilisé'+(kb?'e':'')+' : '+other.label+'.'};
    s[f][action]=none?[]:[code];
    return {ok:true,settings:s};
  }
  function defaults(config){return initial(compile(config));}
  function normalize(raw,config){return settle(raw,compile(config));}
  function assign(config,settings,device,action,code){return rebind(compile(config),settings,device,action,code);}
  function unbind(config,settings,device,action){return rebind(compile(config),settings,device,action,null,true);}
  function guessDevice(win){/* step 5 */} function focusMove(root,cmd,doc){/* step 6 */}
  function create(config){
    const C=compile(config),held=new Set(),pressed=[];
    // Per action: keys (k), mouse (m), fingers (t), pad button (g), stick ends (gr, tr), pad value (gv).
    const A=C.actions.map(a=>({a,k:0,m:false,t:0,g:false,gr:false,tr:false,gv:0,latch:false,edge:false})),at=id=>A[C.index.get(id)];
    const sticks=C.sticks.map(s=>({kx:s.name+'X',ky:s.name+'Y',move:s.type==='move',x:s.x.map(at),y:s.y.map(at),rate:s.rate})),look=sticks.find(s=>!s.move);
    // pm, tm: move vectors of the gamepad and of the touch stick (steps 4 and 7); cap: capture under way, got: its result.
    let S,codes,dev=C.device,shown=dev,touchT=-Infinity,px=0,py=0,pmx=0,pmy=0,tmx=0,tmy=0,cap=null,got=null;
    const on=s=>s.k>0||s.m||s.t>0||s.g||s.gr||s.tr,axis=v=>v.length?Number(on(v[1]))-Number(on(v[0])):0;
    // Edge: released → held latches the action and lists it once per frame.
    const rise=(s,was)=>{if(!was&&on(s)){s.latch=true;if(!s.edge){s.edge=true;pressed.push(s.a.id);}}};
    const mouse=t=>{if(!(t-touchT<K.compatMs))dev='mouse';};
    function configure(raw){S=settle(raw,C);codes=new Map();for(const s of A){s.k=0;for(const c of S.keys[s.a.id]){codes.set(c,s);if(held.has(c))s.k++;}}return copy(S);}
    configure(C.settings);
    return {
      // A capture hands the next new press to frame().captured, never to the game; its repeats are swallowed.
      // Otherwise a repeat restores a key held across clear(), without an edge.
      keyDown(code,t,repeat){
        dev='keyboard';
        if(cap==='keyboard'){if(!repeat&&typeof code==='string'){got={device:'keyboard',code};cap=null;}return true;}
        const s=codes.get(code);if(typeof code==='string'&&!held.has(code)){held.add(code);if(s){const was=on(s);s.k++;if(!repeat)rise(s,was);}}return !!s;
      },
      keyUp(code){const s=codes.get(code);if(held.delete(code)&&s)s.k--;return !!s;},
      // game.js order of operations: bit-identical angles
      mouseMove(dx,dy,t){const T=S.tune;px+=fin(dx)*C.mouseScale*T.sensitivity;py-=fin(dy)*C.mouseScale*T.sensitivity*(T.invertY?-1:1);mouse(t);},
      button(id,down,t,device){
        const s=at(id);if(!s||device!=='mouse'&&device!=='touch')return false;
        const was=on(s);if(device==='mouse'){s.m=!!down;mouse(t);}else{s.t=down?s.t+1:Math.max(0,s.t-1);dev='touch';touchT=t;}
        rise(s,was);return true;
      },
      addLook(x,y,device){px+=fin(x);py+=fin(y);if(DEVICES.includes(device))dev=device;},
      clear(){held.clear();for(const s of A){s.k=s.t=0;s.m=s.tr=s.latch=s.edge=false;}pressed.length=0;px=py=tmx=tmy=0;cap=got=null;},
      configure,get settings(){return copy(S);},get device(){return dev;},
      // Nothing is applied: the game calls configure(r.settings) when it accepts the result.
      assign:(device,action,code)=>rebind(C,S,device,action,code),
      unbind:(device,action)=>rebind(C,S,device,action,null,true),
      // A new capture, or null to cancel; either drops a result frame() has not handed out yet.
      capture(device){cap=device==='keyboard'||device==='gamepad'?device:null;got=null;},
      frame(dt){
        dt=Number.isFinite(dt)?Math.min(K.dtMax,Math.max(0,dt)):0;
        if(look){px+=axis(look.x)*dt*look.rate;py+=axis(look.y)*dt*look.rate;}
        const r={pressed:pressed.slice(),nav:null,device:dev,deviceChanged:dev!==shown,connected:[],disconnected:[],pads:[],captured:got};
        shown=dev;got=null;pressed.length=0;for(const s of A)s.edge=false;return r;
      },
      step(){
        const o={};
        for(const s of sticks){
          let x=px,y=py;
          // strongest move source; a later one (pad, touch) needs a strictly greater norm
          if(s.move){x=axis(s.x);y=axis(s.y);if(pmx*pmx+pmy*pmy>x*x+y*y){x=pmx;y=pmy;}if(tmx*tmx+tmy*tmy>x*x+y*y){x=tmx;y=tmy;}}
          o[s.kx]=x||0;o[s.ky]=y||0;
        }
        px=py=0;
        for(const s of A){const k=s.a.type;o[s.a.id]=k==='press'?s.latch:k==='hold'?on(s)||s.latch:Math.max(s.gv,s.k>0||s.m||s.t>0?1:0);s.latch=false;}
        return o;
      },
      pendingLook(){return {x:px||0,y:py||0};}
    };
  }
  G.FInput={version:1,PAD_BUTTONS,TUNE,create,defaults,normalize,assign,unbind,keyName,radial,padStyle,glyph,guessDevice,focusMove};
})(typeof window!=='undefined'?window:globalThis);
