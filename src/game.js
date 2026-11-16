/* FERRO — browser shell, checkpoints and procedural characters. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('world'),clamp=FSimulation.clamp;
  const forceTouch=new URLSearchParams(location.search).get('touch')==='1';
  let touch=forceTouch||FInput.guessDevice(window)==='touch';
  document.body.classList.toggle('touch',touch);
  let prefs=FOptions.defaults(touch);
  try{prefs=FOptions.normalize(JSON.parse(localStorage.getItem('ferro-settings')||'{}'),touch);}catch{}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)prefs.softMotion=false;
  let {muted,quality,softMotion}=prefs,bindingAction=null,padBindingAction=null,optionsTab='game';
  const touchControls=FTouch.create(prefs),host=FHost.create(window);
  const preparationJobs=FJobs.create({environment:window,handlers:MetalTasks.jobs,bootstrap:'FJobs.serve(MetalTasks.jobs);',forceMain:new URLSearchParams(location.search).get('jobs')==='main'});
  addEventListener('pagehide',()=>preparationJobs.dispose());
  window.FMusic?.setPreparer?.((value,seed)=>preparationJobs.mode==='main'?null:preparationJobs.request('music',{stage:value,seed}).then(r=>r.prepared));
  const followCamera=MetalCamera.create(),avatarGait={legYaw:0,back:false};followCamera.reset(prefs.view==='third');
  // Distance to the first machine on the firing ray: the third-person camera
  // then centres the crosshair on what the shot will really hit.
  function aimRange(o,d,far){
    let best=far;
    for(const e of sim.state.enemies){
      if(e.hp<=0||e.deployed===false)continue;
      const scale=e.type===3?Math.max(1,Number(e.bossScale)||1):1,r=(e.type===3?1.15:.67)*scale,cx=e.x-o[0],cy=(e.y||0)-o[1],cz=e.z-o[2],along=cx*d[0]+cy*d[1]+cz*d[2];
      if(along<=0||along-r>best)continue;
      const miss=cx*cx+cy*cy+cz*cz-along*along;if(miss<r*r){const hit=along-Math.sqrt(r*r-miss);if(hit>0&&hit<best)best=hit;}
    }
    return best;
  }
  const controls=MetalControls.create(prefs,{device:touch?'touch':'keyboard'});let padLast=performance.now(),padState={},jumpQueued=false,switchProfileQueued=false,touchJump=null,loadoutOpen=false,boundaryFlash=0,weakFlash=0,killFlash=0,freezeUntil=0;const hurtDirections=[],impactMarks=[];let deflectUntil=0,deflectCount=0,deflectWindow=0,deflectHints=0;
  const recoil={shot:{omega:38,velocity:1.9*38/27,pitchDegrees:.35,rollDegrees:.6},pistol:{omega:30,velocity:1.45*30/27,pitchDegrees:.6},fracture:{omega:18,velocity:3.5*18/27,pitchDegrees:2,fovDegrees:-1.8},rocket:{omega:14,velocity:5.5*14/27,pitchDegrees:2.6,fovDegrees:-2.5},grenade:{omega:16,velocity:4.2*16/27,pitchDegrees:1.2}};
  const audio=FAudio.create({...window.MetalAudio?.options?.(),asyncPrepare:preparationJobs.mode!=='main',preparePCM:(name,variant)=>preparationJobs.mode==='main'?null:preparationJobs.request('fx',{name,variant}).then(r=>r.pcm)}),soundscape=FSoundscape.create(),motion=FMotion.create({recoil,cameraSteps:true}),leftMotion=FMotion.create({recoil,cameraSteps:true}),brain=window.FBrain?.create({mode:prefs.aiAcceleration}),SAVE_KEY='ferro-expedition-v2';
  // Procedural voices of the humanoid machines (kamikaze howl, blade ring).
  window.MetalVoices?.attach(audio);
  // MUS-04 : l'état de la simulation choisit la pièce, le mixeur la joue. Le
  // chef d'orchestre ne joue rien lui-même et reste muet sans le module.
  const musicDirector=window.FMusicDirector?window.FMusicDirector.create({host:{
    request:(cue,meta)=>typeof audio.requestMusic==='function'?audio.requestMusic(cue,meta):false,
    release:()=>typeof audio.releaseMusic==='function'?audio.releaseMusic():false
  }}):null;
  let sceneDirty=true,renderer,world,sim,stage=0,seed=96,campaignMode=true,campaignRevision=2,profileMode=true,combatMode=true,hordeMode=true,mode='menu',last=performance.now(),clock=0,hudWait=0,toastTime=0,encounterTime=0,wasLocked=false,perfStart=0,perfFrames=0,renderRevision=-1,renderToken=null;
  const emptyStats=()=>({time:0,kills:0,shots:0,hits:0,score:0});
  const frameTasks=FSchedule.create({now:()=>performance.now()});
  const fixedLoop=FLoop.create({hz:60,maxSteps:5}),poseView=FLoop.view({single:['player'],many:['enemies','bullets','projectiles']});let renderState=null,aimShownX=0,aimShownY=0;
  const framePacer=FOptions.createFrameGate();let cadenceHintAt=0,autoCadence=60,cadencePending=0,deferLaunch=false,pendingStart=null,renderLoadPending=false;
  const cadenceLimit=()=>prefs.fpsLimit===-1?autoCadence:prefs.fpsLimit;
  let runStats=emptyStats(),checkpoint=null,savedRun=null,refusedSave=null,selectedWeapon=0,stageEntryLoadout=null,currentShopId=null,saveAvailable=true,checkpointPending=false,checkpointWaitAt=-1,lastFootstep=0,outdoorMix=0;
  const weaponNames=['Mitraillette','Double pompe','Lance-roquettes','Lance-grenades','Pistolet'],ammoNames=['balles','cartouches','roquettes','grenades','balles'];
  const worldCache=new Map(),worldJobs=new Map();let preparationSerial=0;
  let titleGesture=false,titleReady=false,titlePending=null,titleSerial=0,titleWaiting=false,titleBlocked=false,windowFocused=document.hasFocus?.()!==false;
  const actorMotion=new Map(),systemMotion=new Map();
  const keys=new Set(),input={moveX:0,moveY:0,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:false,assist:touch};
  let mouseFire=false,mouseLeftFire=false,touchFire=false,touchLeftFire=false,dragLook=null,moveTouch=null,stick={x:0,y:0},lookDX=0,lookDY=0,dashQueued=false,pulseQueued=false,meleeQueued=false,interactQueued=false,touchDescend=null;
  const fireBufferMs=FOptions.fireBufferMs;
  let firePressed=false,fireLeftPressed=false,firePressAt=0,fireLeftPressAt=0,fireWeapon=null,fireLeftWeapon=null;
  let pointerRequestSerial=0,pointerLockWanted=false,captureMouseButton=null,wheelDistance=0,wheelDirection=0,wheelAt=-Infinity;
  function clearFireIntents(){firePressed=fireLeftPressed=false;}
  function pressFire(left=false){
    const weapon=left?sim?.state.equipment?.left:selectedWeapon;
    // Only firearms keep a pending press; a held left hand simply keeps firing.
    if(!Number.isInteger(weapon))return;
    if(left){fireLeftPressed=true;fireLeftPressAt=performance.now();fireLeftWeapon=weapon;}
    else{firePressed=true;firePressAt=performance.now();fireWeapon=weapon;}
  }
  function expireFireIntents(now){
    if(firePressed&&(now-firePressAt>=fireBufferMs||fireWeapon!==selectedWeapon))firePressed=false;
    if(fireLeftPressed&&(now-fireLeftPressAt>=fireBufferMs||fireLeftWeapon!==sim.state.equipment?.left))fireLeftPressed=false;
  }
  function copyLoadout(value){
    if(!value)return null;const inventory=value.inventory||value,economy=window.FEconomy?.copy(value.economy||window.FEconomy?.fresh());
    const profiles=value.profiles===undefined?null:MetalProfiles.copy(value.profiles);if(value.profiles!==undefined&&!profiles)return null;
    if(value.economy&&!economy)return null;const five=inventory?.weapons?.length===5,caps=profiles?MetalProfiles.ammoCaps(profiles.classes):economy?FEconomy.ammoCaps(economy,{campaign:five}):[180,36,12,16,1];
    if(!inventory||!Array.isArray(inventory.weapons)||![3,4,5].includes(inventory.weapons.length)||(five?!inventory.weapons.some(Boolean):!inventory.weapons[0])||!Array.isArray(inventory.ammo)||inventory.ammo.length!==inventory.weapons.length)return null;
    for(let i=0;i<inventory.weapons.length;i++)if(typeof inventory.weapons[i]!=='boolean'||!Number.isInteger(inventory.ammo[i])||inventory.ammo[i]<0||inventory.ammo[i]>(caps[i]??16))return null;
    const campaign=value.campaign===undefined?null:FSimulation.copyCampaign?.(value.campaign,inventory);if(value.campaign!==undefined&&!campaign)return null;
    let equipment;if(value.equipment){const q=value.equipment,left=q.left==='shield'?null:q.left??null;if(!Number.isInteger(q.right)||!inventory.weapons[q.right]||left!==null&&(!Number.isInteger(left)||!inventory.weapons[left]||left===q.right))return null;equipment={right:q.right,left};}
    const armor=value.armor===undefined?null:FSimulation.copyArmor?.(value.armor,100);if(value.armor!==undefined&&!armor)return null;
    if(profiles&&(!MetalProfiles.owns(profiles,inventory)||JSON.stringify(profiles.classes[profiles.active].economy)!==JSON.stringify(economy)))return null;
    return {...(profiles?{profiles}:{}),inventory:{weapons:inventory.weapons.slice(),ammo:inventory.ammo.slice()},...(economy?{economy}:{}),...(equipment?{equipment}:{}),...(campaign?{campaign}:{}),...(armor?{armor}:{})};
  }
  // Each world starts with the heavy hero (David, 16/11/2026); his drone waits above him.
  function heavyFirst(value){
    const q=copyLoadout(value);if(!q?.profiles||q.profiles.active!=='light')return q||value;
    const heavy=q.profiles.classes.heavy;q.profiles.active='heavy';q.economy=FEconomy.copy(heavy.economy);
    if(q.equipment)q.equipment={right:heavy.weapon,left:heavy.left};
    return copyLoadout(q)||value;
  }
  const skyEnvironments=new WeakMap();
  function skyEnvironment(w){
    if(!window.FSky||!w.campaign||!w.environment)return w.environment;
    let environment=skyEnvironments.get(w);if(!environment){
      const sky=window.FSky.resolve(window.FSky.presets[w.index],{seed:w.seed}),top=window.FSky.radianceAt(sky,[0,1,0]),night=sky.principal!=='sun';
      const disc=sky.uniforms[night?'uFskyMoonDisc':'uFskySunDisc'],peak=Math.max(disc[0],disc[1],disc[2],.001);
      const sunColor=sky.principal==='none'?[.24,.30,.42]:Array.from(disc).slice(0,3).map(v=>v/peak*(night?.38:1.05));
      const ambient=top.map((v,i)=>Math.max(night?.12:.16,Math.min(.42,v*.22+(night?.07:.12))));
      environment={...w.environment,sky,fog:sky.fog.slice(),sunDirection:sky.light.slice(),sunColor,ambient,skyTop:top,skyBottom:sky.fog.slice()};
      skyEnvironments.set(w,environment);
    }
    return environment;
  }
  function worldSpec(n,worldSeed,campaign=campaignMode,revision=campaignRevision,legacyTraps=false,profiles=profileMode,combat=combatMode,horde=hordeMode){
    // Hordes are an opt-in world revision recorded in the save (16/11/2026).
    horde=horde&&campaign&&revision===2&&profiles&&combat&&!legacyTraps;
    const key=(horde?'horde1:':'')+(combat?'combat1:':'')+(profiles?'profiles1:':'')+(legacyTraps?'pre-massive:':'')+(campaign?'campaign'+revision+':':'classic:')+worldSeed+':'+n;
    let options=campaign?{campaign:true,campaignVersion:revision,...(profiles?{profiles:true}:{}),...(combat?{combatVersion:1}:{}),...(horde?{hordeVersion:1}:{})}:undefined;
    if(legacyTraps)options={...options,legacyTraps:true};return {key,seed:worldSeed,index:n,options};
  }
  function cacheWorld(key,value){worldCache.set(key,value);while(worldCache.size>2)worldCache.delete(worldCache.keys().next().value);return value;}
  function cachedWorld(...args){const q=worldSpec(...args);return worldCache.get(q.key)||cacheWorld(q.key,FWorld.create(q.seed,q.index,q.options));}
  function prepareWorld(...args){
    const q=worldSpec(...args);if(worldCache.has(q.key))return Promise.resolve(worldCache.get(q.key));if(worldJobs.has(q.key))return worldJobs.get(q.key);
    const pending=preparationJobs.request('world',{...q,prepare:true}).then(value=>cacheWorld(q.key,value)).finally(()=>worldJobs.delete(q.key));worldJobs.set(q.key,pending);return pending;
  }
  const titleScreen=()=>mode==='menu'||mode==='options';
  const currentTrack=()=>titleScreen()?'title':world?.stage??stage%3;
  function trackLabel(){const t=window.FMusic?.getTrack?.(currentTrack());return t?t.title+' · '+t.bpm+' BPM':'METAL · MOD PROCÉDURAL';}
  const wantsTitle=()=>titleScreen()&&titleGesture&&windowFocused&&!document.hidden&&!muted&&prefs.masterVolume>0&&prefs.musicVolume>0;
  function titleControls(){
    const zero=prefs.masterVolume===0||prefs.musicVolume===0,active=!!audio.stats?.titlePlaying;
    $('intro-sound').textContent=zero&&!muted?'RÉGLER LE VOLUME':muted||!titleGesture||titleBlocked?'ÉCOUTER LE THRASH':'COUPER LE SON';
    $('intro-sound').setAttribute('aria-pressed',String(active&&!muted&&!zero));
    $('intro-sound').setAttribute('aria-label',zero&&!muted?'Régler le volume pour écouter Furie d’acier':muted||!titleGesture||titleBlocked?'Écouter Furie d’acier, musique thrash metal de l’accueil':'Couper le son');
    $('intro-music-status').textContent=muted?'Son coupé':zero?'Volume général ou musique à zéro':!windowFocused||document.hidden?'Musique en pause':titleWaiting?'Préparation du morceau…':titleBlocked?'Touchez ou cliquez pour réessayer':active?'Lecture · thrash metal original':'Cliquez ou touchez pour écouter';
    $('intro-audio').classList.toggle('is-playing',active&&!muted&&!zero&&windowFocused&&!document.hidden);
    $('music-title').textContent=trackLabel();
    $('export-mod').textContent=titleScreen()?'EXPORTER LE MOD DU TITRE ↓':'EXPORTER LE MOD DE CE SECTEUR ↓';
  }
  function audioGate(){
    const audibleScene=mode==='playing'||mode==='demo'||['dead','cleared','complete'].includes(mode)||titleScreen()&&audio.stats?.titlePlaying;
    const gated=muted||document.hidden||!windowFocused||!audibleScene;
    audio.setMuted(gated);
    // MIX-V4 : quand rien n'est audible — menu sans musique de titre, pause,
    // onglet cache, fenetre sans focus, son coupe — le contexte audio s'endort
    // apres 1,5 s et ne coute plus rien. Le reveil est la promesse de resume().
    audio.setIdle?.(gated);
  }
  function activateTitle(){
    if(!wantsTitle()||!titleReady||audio.stats?.preview||audio.stats?.titlePlaying)return;
    audio.setTitlePlaying?.(true);audioGate();titleControls();
  }
  function syncTitle(){
    if(!wantsTitle()){
      ++titleSerial;titleReady=false;titleWaiting=false;
      audio.setTitlePlaying?.(false);audioGate();titleControls();return;
    }
    if(audio.stats?.titlePlaying){audioGate();titleControls();return;}
    if(titleReady){activateTitle();titleControls();return;}
    if(titleBlocked){audioGate();titleControls();return;}
    const ticket=++titleSerial;
    // resume belongs to the original gesture. The asynchronous instrument
    // preparation is shared, but only the latest eligible scene may play it.
    const resumed=audio.resume();titleWaiting=true;titleControls();
    if(!titlePending){
      const pending=Promise.resolve(resumed).then(()=>audio.prepareTitle?.()||false).catch(()=>false);
      titlePending=pending;pending.then(()=>{if(titlePending===pending)titlePending=null;});
    }
    titlePending.then(ready=>{
      if(ticket!==titleSerial||!wantsTitle())return;
      titleWaiting=false;titleReady=!!ready;titleBlocked=!ready;
      activateTitle();audioGate();titleControls();
    });
  }
  function titleUserGesture(event){
    if(!titleScreen()||document.hidden||!windowFocused||event?.isTrusted===false||event?.button>0)return;
    // These controls own their intent: a mute tap must never start a note,
    // and the launch controls prepare the world track directly.
    if(['intro-sound','sound-toggle','start','resume-expedition','test-audio'].includes(event?.target?.closest?.('button')?.id||event?.target?.id))return;
    titleGesture=true;titleBlocked=false;
    if(wantsTitle())audio.resume();
    syncTitle();
  }
  function brainStatus(){const status=brain?.status;$('ai-setting').value=prefs.aiAcceleration;$('ai-status').textContent=status?.label||'Décisions tactiques locales · traitement CPU.';}
  function saveSettings(){try{localStorage.setItem('ferro-settings',JSON.stringify(prefs));}catch{}}
  function bindingLabel(id){return controls.label(id);}
  function activeDevice(device){const previousTouch=touch,previousDevice=controls.device;controls.use(device);touch=forceTouch||device==='touch';if(touch&&!previousTouch)$('radar-wrap').hidden=true;if(!touch&&previousTouch){touchControls.clear();paintStick();}document.body.classList.toggle('touch',touch);document.body.classList.toggle('pad',device==='gamepad');input.assist=touch&&prefs.touchAssist||device==='gamepad'&&prefs.padAssist;if(previousDevice!==controls.device||previousTouch!==touch)controlsLegend();}
  function controlHints(){
    if(touch){$('interact-key').textContent='';$('intro-controls').textContent='À gauche : déplacer · À droite : viser';$('help-text').textContent='Glissez à gauche pour déplacer ; poussez plus loin pour courir ou pour le boost du drone. Glissez à droite ou sur TIR pour viser. Le drone léger vole à plat : MONTER et DESCENDRE règlent l’altitude. Le bouton LOURD / LÉGER change de personnage, VUE passe en vue à la première ou à la troisième personne. ARMES ouvre l’arsenal ; la carte est accessible en haut.';return;}
    $('interact-key').textContent=bindingLabel('interact');
    $('intro-controls').textContent=controls.device==='gamepad'?'LS déplacer · RS viser · '+bindingLabel('fire')+' tirer · '+bindingLabel('jump')+' sauter':'Clavier, manette ou écran tactile';
    $('help-text').textContent=controls.device==='gamepad'?'LS : déplacement · RS : visée · '+['fire','fireLeft','sprint','jump','dash','pulse','interact','weaponNext','switchProfile','view','map','pause'].map(id=>bindingLabel(id)+' : '+FOptions.actions.find(a=>a.id===id).label).join(' · '):'ZQSD / WASD : déplacer · Souris : viser · '+['fire','sprint','jump','dash','melee','interact','switchProfile','view','map','pause'].map(id=>bindingLabel(id)+' : '+FOptions.actions.find(a=>a.id===id).label).join(' · ');
    if(sim?.state.activeProfile==='light')$('help-text').textContent+=' · DRONE : vol à plat · '+bindingLabel('jump')+' monter · '+bindingLabel('dash')+' descendre · '+bindingLabel('sprint')+' boost · tir des deux canons';
    controlsLegend();
  }
  // Discreet in-game legend (David, 16/11/2026): the actual bindings of the
  // device in use, for the character in control. Touch has labelled buttons.
  function controlsLegend(){
    const node=$('controls-hint'),pad=controls.device==='gamepad',drone=sim?.state.activeProfile==='light';
    node.hidden=touch||!prefs.controlsHint;if(node.hidden)return;
    const key=id=>pad?bindingLabel(id):FOptions.keyName(prefs.bindings[id]?.[0]||'').replace(/^(Maj|Ctrl) [GD]$/,'$1');
    const defaults=['forward','left','back','right'].every(id=>JSON.stringify(prefs.bindings[id])===JSON.stringify(FOptions.defaults().bindings[id]));
    const move=pad?'LS':defaults?'ZQSD/WASD':['forward','left','back','right'].map(key).join(''),aim=pad?'RS':'Souris';
    const fire=pad?key('fire'):'Clic',left=pad?key('fireLeft'):'Clic droit';
    const rows=drone?[[move+' · '+aim,'voler · viser'],[fire,'tirer · 2 canons'],[key('jump')+' · '+key('dash'),'monter · descendre'],[key('sprint'),'boost'],[key('interact'),'interagir'],[key('switchProfile'),'lourd'],[key('view'),'vue 1re / 3e']]
      :[[move+' · '+aim,'déplacer · viser'],[fire+' · '+left,'tirer · main gauche'],[key('jump')+' · '+key('dash'),'sauter · esquiver'],[key('sprint'),'courir'],[key('pulse'),'onde'],[key('interact'),'interagir'],...(pad?[[key('weaponNext'),'arme suivante']]:[]),[key('switchProfile'),'drone léger'],[key('view'),'vue 1re / 3e']];
    const text=rows.filter(([k])=>k&&k!=='—').map(([k,label])=>'<kbd>'+k+'</kbd><span>'+label+'</span>').join('');
    if(node.dataset.text!==text){node.innerHTML=text;node.dataset.text=text;}
  }
  function weaponHint(){const keys=Array.from({length:world?.campaign?5:4},(_,i)=>bindingLabel('weapon'+(i+1)));$('weapon-switch').title='Armes : '+keys.join(' / ')+' ou molette';}
  function renderBindings(){
    const focusId=document.activeElement?.id;
    $('key-bindings').innerHTML=FOptions.actions.map(a=>'<div class="binding-row"><span>'+a.label+'</span><button id="bind-'+a.id+'" class="'+(bindingAction===a.id?'listening':'')+'" aria-label="Modifier la touche : '+a.label+'">'+(bindingAction===a.id?'Touche…':(prefs.bindings[a.id]||[]).map(FOptions.keyName).join(' / '))+'</button><button id="pad-bind-'+a.id+'" aria-label="Modifier le bouton manette : '+a.label+'">'+(padBindingAction===a.id?'Bouton…':controls.padLabel(a.id))+'</button><button id="pad-clear-'+a.id+'" aria-label="Effacer le bouton manette : '+a.label+'">—</button></div>').join('');
    for(const a of FOptions.actions)$('bind-'+a.id).addEventListener('click',()=>{bindingAction=a.id;$('binding-status').textContent='Appuyez sur une touche pour « '+a.label+' ». Échap pour annuler.';renderBindings();$('bind-'+a.id).focus();});
    for(const a of FOptions.actions)$('pad-bind-'+a.id).addEventListener('click',()=>{bindingAction=null;padBindingAction=a.id;controls.capture('gamepad');$('binding-status').textContent='Appuyez sur un bouton pour « '+a.label+' ». Échap annule ; Retour arrière efface.';renderBindings();$('pad-bind-'+a.id).focus();});
    for(const a of FOptions.actions)$('pad-clear-'+a.id).addEventListener('click',()=>{prefs.padBindings=FOptions.assignPad(prefs.padBindings,a.id,null).bindings;padBindingAction=null;controls.capture(null);settings();$('binding-status').textContent='Bouton libéré : '+a.label+'.';});
    if(focusId&&/^(bind-|pad-bind-|pad-clear-)/.test(focusId))$(focusId)?.focus();
  }
  function selectTab(name,focus=false){
    if(optionsTab==='audio'&&name!=='audio')audio.cancelTestMix?.();
    if(name==='game')brainStatus();
    optionsTab=name;bindingAction=padBindingAction=null;controls.capture(null);
    for(const id of ['game','image','audio','controls']){const active=id===name;$('tab-'+id).setAttribute('aria-selected',String(active));$('tab-'+id).tabIndex=active?0:-1;$('pane-'+id).hidden=!active;}
    $('options-body').scrollTop=0;$('binding-status').textContent='Cliquez sur une touche pour la modifier. Échap annule. Le clic gauche et la molette restent disponibles.';
    renderBindings();if(focus)$('tab-'+name).focus();
  }
  function settings(){
    sceneDirty=true;
    Object.assign(prefs,{muted,quality,softMotion});controls.configure(prefs);touchControls.configure(prefs);
    $('sound-toggle').querySelector('strong').textContent=muted?'Coupé':'Activé';
    $('quality-toggle').querySelector('strong').textContent={auto:'Auto',low:'Économie',high:'Haute'}[quality];
    $('demo-toggle').setAttribute('aria-pressed',String(prefs.demo));$('demo-toggle').querySelector('strong').textContent=prefs.demo?'Activée':'Désactivée';$('demo-delay').value=String(prefs.demoDelay);
    $('difficulty-setting').value=String(prefs.difficulty);$('difficulty-hint').textContent=['Standard · apprenez à lire les attaques ; la pression monte avec les secteurs et les objectifs.','Brutal · des machines plus agressives, des tirs plus rapprochés et moins de répit.','Cauchemar · des attaques plus rapides, des impacts plus durs et une forte pression.'][prefs.difficulty];brainStatus();
    $('motion-toggle').querySelector('strong').textContent=softMotion?'Doux':'Désactivés';renderView();
    for(const [id,key,on,off] of [['shadows','shadows','Activées','Désactivées'],['bloom','bloom','Activé','Désactivé'],['autotune','autoTune','Activé','Désactivé'],['fps','showFps','Visible','Masqué'],['crt','crt','Activé','Désactivé'],['vignette','vignette','Activée','Désactivée'],['invert','invertY','Oui','Non'],['pointer-acceleration','systemPointerAcceleration','Activée','Désactivée']]){const el=$(id+'-toggle');el.querySelector('strong').textContent=prefs[key]?on:off;el.setAttribute('aria-pressed',String(prefs[key]));}
    for(const [id,key,multiplier,suffix] of [['fov','fov',1,'°'],['brightness','brightness',100,' %'],['sensitivity','sensitivity',100,' ×'],['crosshair','crosshairScale',100,' %'],['master','masterVolume',100,' %'],['music','musicVolume',100,' %'],['effects','effectsVolume',100,' %'],['ambience','ambienceVolume',100,' %']]){
      $(id+'-setting').value=String(Math.round(prefs[key]*multiplier));$(id+'-value').textContent=(id==='sensitivity'?prefs[key].toFixed(2).replace('.',','):Math.round(prefs[key]*multiplier))+suffix;
    }
    $('gyro-mode').value=prefs.gyroMode;$('gyro-hint').textContent=host.gyro?'Gyroscope actif.':'Facultatif · activation depuis ce menu, si le navigateur le permet.';
    $('reflections').value=prefs.reflections;
    $('render-scale').value=String(prefs.renderScale);renderer?.setRenderScale?.(prefs.renderScale);
    $('fps-limit').value=String(prefs.fpsLimit);cadenceHint();$('fps-counter').hidden=!prefs.showFps;$('scanlines').hidden=!prefs.crt;$('vignette').hidden=renderer?.stats.backend==='webgl2'||!prefs.vignette;$('damage').hidden=renderer?.stats.backend==='webgl2';
    $('crosshair').style.scale=String(prefs.crosshairScale);canvas.style.filter=renderer?.stats.backend==='webgl2'||prefs.brightness===1?'none':'brightness('+prefs.brightness+')';
    $('interact-key').textContent=bindingLabel('interact');
    for(const [id,key,mul] of [['pad-yaw','padYaw',1],['pad-pitch','padPitch',1],['pad-dead','padDead',100],['pad-curve','padCurve',100],['pad-vibration','padVibration',100],['touch-accel','touchAccel',100],['gyro-sensitivity','gyroSensitivity',100]]){$(id+'-setting').value=String(Math.round(prefs[key]*mul));$(id+'-value').textContent=String(Math.round(prefs[key]*mul));}
    for(const [id,key] of [['pad-invert','padInvertY'],['pad-assist','padAssist'],['pad-swap','padSwapSticks'],['touch-assist','touchAssist'],['portrait-fov','portraitFov']]){$(id+'-toggle').setAttribute('aria-pressed',String(prefs[key]));$(id+'-toggle').querySelector('strong').textContent=prefs[key]?'Oui':'Non';}
    $('map-button').title='Carte ('+bindingLabel('map')+')';weaponHint();
    controlHints();
    $('music-title').textContent=trackLabel();
    const software=renderer?.stats.backend==='canvas2d';
    $('bloom-toggle').disabled=software;$('reflections').disabled=software;$('graphics-hint').textContent=software?'Rendu logiciel de secours, avec une définition limitée. Les ombres restent réglables.':'Résolution native par défaut. Le détail règle la portée et les ombres ; seule l’échelle choisie ci-dessus change la définition. La cadence automatique est choisie au chargement puis conservée dans le secteur.';
    const silent=[['musicVolume','Musique coupée'],['effectsVolume','Effets coupés'],['ambienceVolume','Ambiances coupées']].filter(([key])=>prefs[key]===0).map(([,label])=>label);
    $('audio-status').textContent=muted||prefs.masterVolume===0?'Son coupé. Activez le son et le volume général pour écouter.':silent.length?silent.join(' · ')+'. Réglez les curseurs pour les entendre.':'Les tirs et impacts passent devant la musique. Les ambiances restent spatialisées.';
    document.body.classList.toggle('low-motion',!softMotion);audio.setMix?.({master:prefs.masterVolume,music:prefs.musicVolume,effects:prefs.effectsVolume,ambience:prefs.ambienceVolume});audioGate();syncTitle();saveSettings();renderBindings();
  }
  // First or third person, for both characters (David, 16/11/2026).
  function renderView(){
    const third=prefs.view==='third';followCamera.set(third);
    $('controls-hint-toggle').querySelector('strong').textContent=prefs.controlsHint?'Affichée':'Masquée';$('controls-hint-toggle').setAttribute('aria-pressed',String(prefs.controlsHint));
    $('view-toggle').querySelector('strong').textContent=third?'3e personne':'1re personne';$('view-toggle').setAttribute('aria-pressed',String(third));
    $('view-button').textContent=third?'3P':'1P';$('view-button').setAttribute('aria-label','Vue à la '+(third?'troisième':'première')+' personne. Changer de vue.');$('view-button').title='Vue 1re / 3e personne'+(touch?'':' ('+bindingLabel('view')+')');
  }
  function toggleView(){
    prefs.view=prefs.view==='third'?'first':'third';renderView();saveSettings();sceneDirty=true;
    if(mode==='playing')toast(prefs.view==='third'?'VUE À LA TROISIÈME PERSONNE':'VUE À LA PREMIÈRE PERSONNE',1.4);
  }
  function toast(message,seconds=2.8){$('toast').textContent=message;$('toast').classList.add('visible');toastTime=seconds;}
  function encounter(name,caption){$('encounter-name').textContent=name;$('encounter-caption').textContent=caption;$('encounter').classList.add('visible');encounterTime=4.2;}
  const savedIndex=v=>v?.version===3?v.index:v?.stage??0;
  function validSave(v){
    const identity=v&&(v.version===2&&Number.isInteger(v.stage)&&v.stage>=0&&v.stage<3&&v.campaign!==true||v.version===3&&v.campaign===true&&Number.isInteger(v.index)&&v.index>=0&&v.index<18&&v.stage===v.index%3);
    if(!identity||v.campaignRevision!==undefined&&(v.version!==3||v.campaignRevision!==2||v.checkpoint?.campaignVersion!==2)||v.version===3&&v.campaignRevision===undefined&&v.checkpoint?.campaignVersion===2)return false;
    // Reject mixed classic/campaign checkpoints before load constructs a new
    // simulation. Reading an incompatible envelope leaves its source untouched.
    const campaign=v.version===3,state=v.checkpoint?.state;
    if(v.profiles!==undefined&&v.profiles!==1||v.profiles===1&&(!campaign||v.campaignRevision!==2||v.checkpoint?.profileVersion!==1)||v.profiles===undefined&&v.checkpoint?.profileVersion!==undefined)return false;
    if(v.combatVersion!==undefined&&(v.combatVersion!==1||!campaign||v.checkpoint?.combatVersion!==1)||v.combatVersion===undefined&&v.checkpoint?.combatVersion!==undefined)return false;
    if(v.hordeVersion!==undefined&&(v.hordeVersion!==1||v.combatVersion!==1||v.checkpoint?.hordeVersion!==1)||v.hordeVersion===undefined&&v.checkpoint?.hordeVersion!==undefined)return false;
    const fits=inventory=>!Array.isArray(inventory?.weapons)||(campaign?inventory.weapons.length===5:[3,4].includes(inventory.weapons.length));
    if(!fits(state?.inventory)||!campaign&&(state?.campaign!==undefined||v.checkpoint?.campaignVersion!==undefined))return false;
    return Number.isInteger(v.seed)&&v.seed>=0&&v.seed<=0xffffffff&&v.checkpoint&&v.runStats&&Object.keys(emptyStats()).every(k=>Number.isFinite(v.runStats[k])&&v.runStats[k]>=0&&v.runStats[k]<1e9);
  }
  function readSave(){
    try{const raw=localStorage.getItem(SAVE_KEY);if(!raw||raw.length>2200000)return null;const v=JSON.parse(raw);return validSave(v)?v:null;}catch{return null;}
  }
  function refreshContinue(){
    $('resume-expedition').hidden=!savedRun;
    $('save-label').textContent=savedRun?(savedRun.version===3?'MONDE ':'SECTEUR ')+String(savedIndex(savedRun)+1).padStart(2,'0'):'';
    $('start').firstChild.textContent=savedRun?'Nouvelle expédition ':'Lancer l’assaut ';
  }
  function preserveRefusedSave(){
    if(refusedSave!==null){localStorage.setItem(SAVE_KEY+'-refuse',refusedSave);refusedSave=null;}
  }
  // LOAD-03: the snapshot stays in the frame that takes it; JSON and storage leave
  // that frame. One idle write carries the latest point. It is forced as the page
  // hides or unloads, and before the save slots are read or replaced.
  let pendingSave=null,saveQueued=false;
  function writeSave(){
    if(pendingSave===null)return;const run=pendingSave;pendingSave=null;
    try{preserveRefusedSave();localStorage.setItem(SAVE_KEY,JSON.stringify(run));saveAvailable=true;}catch{saveAvailable=false;}
    $('checkpoint-status').textContent='Reprise au dernier point enregistré.'+(saveAvailable?' Sauvegarde locale active.':' Reprise disponible pendant cette session.');
  }
  function queueSave(run){
    pendingSave=run;if(saveQueued)return;saveQueued=true;
    const later=()=>{saveQueued=false;writeSave();};
    if(typeof requestIdleCallback==='function')requestIdleCallback(later,{timeout:500});else setTimeout(later,0);
  }
  function flushCheckpoint(){if(checkpointPending&&!sim?.state.player.airborne)saveCheckpoint(true);writeSave();}
  addEventListener('pagehide',flushCheckpoint);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushCheckpoint();});
  function saveCheckpoint(force=false){
    if(mode==='demo'||!sim||sim.state.dead||sim.state.won)return;
    if(sim.state.player.airborne){checkpointPending=true;return;}
    if(!force&&sim.state.aiStats?.navPending>0){if(checkpointWaitAt<0)checkpointWaitAt=sim.state.time;if(sim.state.time-checkpointWaitAt<1.5){checkpointPending=true;return;}}
    checkpointPending=false;checkpointWaitAt=-1;
    checkpoint=sim.snapshot();
    savedRun={version:world.campaign?3:2,...(world.combatVersion?{combatVersion:1}:{}),...(world.hordeVersion?{hordeVersion:1}:{}),...(world.profileVersion?{profiles:world.profileVersion}:{}),...(world.campaign?{campaign:true,index:stage,...(world.campaignVersion===2?{campaignRevision:2}:{})}:{}),generation:world.generation||3,seed,stage:world.campaign?world.stage:stage,runStats:{...runStats},entryLoadout:copyLoadout(stageEntryLoadout),checkpoint};
    queueSave(savedRun);
    refreshContinue();
  }
  function clearSave(){checkpoint=null;savedRun=pendingSave=null;try{preserveRefusedSave();localStorage.removeItem(SAVE_KEY);}catch{}refreshContinue();}
  function acceptRestoredRun(v,point=v.checkpoint){
    sim.setDifficulty?.(prefs.difficulty);
    runStats={...v.runStats};checkpoint=point;savedRun={...v,checkpoint};selectedWeapon=sim.state.weapon;
    $('checkpoint-status').textContent='Reprise au dernier point enregistré.'+(saveAvailable?' Sauvegarde locale active.':' Reprise disponible pendant cette session.');
    renderHUD();return true;
  }
  function restoreRun(v){
    if(!validSave(v))return false;hordeMode=v.hordeVersion===1;
    if(sim?.state.dead&&world.seed===v.seed&&stage===savedIndex(v)&&sim.restore(v.checkpoint,{recover:true})){if(deferLaunch)renderLoadPending=true;else syncDestruction();return acceptRestoredRun(v);}
    load(savedIndex(v),v.seed,copyLoadout(v.entryLoadout||v.entryInventory),v.version===3,v.campaignRevision||1,false,v.profiles===1,v.combatVersion===1,null,{rigidBodies:!!v.checkpoint?.rigidBodies});
    if((v.generation||3)!==(world.generation||3))return false;
    if(sim.restore(v.checkpoint,{recover:true}))return acceptRestoredRun(v);
    // La génération 6 a eu deux implantations de machines. Essayer l'ancienne
    // seulement si l'identité diffère, puis laisser restore vérifier tout le point.
    // Aucun champ ni empreinte du point source n'est réécrit. Un point repris et
    // enregistré à nouveau garde son identité et suit le même chemin au prochain lancement.
    if(world.generation===6&&typeof v.checkpoint.fingerprint==='string'&&v.checkpoint.fingerprint!==sim.snapshot().fingerprint){
      load(savedIndex(v),v.seed,copyLoadout(v.entryLoadout||v.entryInventory),v.version===3,v.campaignRevision||1,true,v.profiles===1,v.combatVersion===1,null,{rigidBodies:!!v.checkpoint?.rigidBodies});
      if(sim.restore(v.checkpoint,{recover:true}))return acceptRestoredRun(v);
    }
    return false;
  }
  function resumeSaved(v){
    writeSave();hordeMode=v?.hordeVersion===1;
    if(restoreRun(v)){start('Signal retrouvé. Reprise au dernier point enregistré.');return;}
    if(validSave(v)){
      // Preserve each refused source before any replacement, even when storage fails temporarily.
      if(refusedSave===null)refusedSave=JSON.stringify(v);
      try{preserveRefusedSave();}catch{}
      try{if(!localStorage.getItem(SAVE_KEY+'-before-ascension'))localStorage.setItem(SAVE_KEY+'-before-ascension',JSON.stringify(v));}catch{}
      if((v.generation||3)===(world.generation||3)){
        const point=JSON.parse(JSON.stringify(v.checkpoint));
        delete point.rubbleVersion;if(point.state)delete point.state.rubble;if(point.timers)delete point.timers.rubbleSerial;
        if(sim.restore(point,{recover:true})){
          acceptRestoredRun(v,point);
          start('Signal retrouvé. Progression conservée ; débris visuels retirés du point de reprise.');saveCheckpoint();return;
        }
      }
      runStats={...v.runStats};selectedWeapon=[0,1,2,3,4].includes(v.checkpoint?.state?.weapon)?v.checkpoint.state.weapon:0;
      load(savedIndex(v),v.seed,copyLoadout(v.entryLoadout||v.entryInventory),v.version===3,v.campaignRevision||1,false,v.profiles===1,v.combatVersion===1,null,{rigidBodies:!!v.checkpoint?.rigidBodies});
      start(v.generation!==world.generation?'Les lieux ont changé. Reprise à l’entrée du même secteur ; progression précédente conservée.':'Point de reprise illisible. Reprise à l’entrée de ce secteur.');
      saveCheckpoint();
    }else{runStats=emptyStats();selectedWeapon=0;load(0,96,undefined,true,2,false,true,true);start(world.campaign?'Nouvelle expédition. Dix-huit mondes vous attendent.':'Nouvelle expédition. Trois secteurs vous attendent.');saveCheckpoint();}
  }
  function clearInput(){fixedLoop.reset();fixedLoop.observe(performance.now());aimShownX=aimShownY=0;poseView.clear();renderState=null;controls.clear();touchControls.clear();paintStick();padState={};jumpQueued=switchProfileQueued=false;touchJump=null;touchDescend=null;input.jump=input.jumpHeld=input.descendHeld=input.switchProfile=false;keys.clear();mouseFire=mouseLeftFire=touchFire=touchLeftFire=false;input.fire=input.fireLeft=false;input.leftWeapon=undefined;clearFireIntents();++pointerRequestSerial;pointerLockWanted=false;captureMouseButton=null;wheelDistance=wheelDirection=0;wheelAt=-Infinity;dragLook=moveTouch=null;stick.x=stick.y=lookDX=lookDY=0;dashQueued=pulseQueued=meleeQueued=interactQueued=false;$('move-stick').style.transform='';}
  function setMode(value){
    sceneDirty=true;
    audio.cancelTestMix?.();
    last=performance.now();perfStart=0;perfFrames=0;
    $('fps-counter').textContent='— FPS';document.body.dataset.fps='';
    mode=value;host.keepAwake(value==='playing'||value==='demo'&&prefs.demoWake);loadoutOpen=false;document.body.classList.remove('loadout-open');$('loadout-toggle').setAttribute('aria-expanded','false');bindingAction=padBindingAction=null;document.body.dataset.state=value;$('intro').hidden=value!=='menu';$('hud').hidden=!['playing','paused','demo'].includes(value);$('pause').hidden=!['paused','options'].includes(value);$('shop').hidden=value!=='shop';$('loading').hidden=value!=='loading';$('result').hidden=!['dead','cleared','complete'].includes(value);clearInput();if(!titleScreen())audio.setTitlePlaying?.(false);audio.setPlaying?.(value==='playing'||value==='demo');audioGate();syncTitle();
    if(value==='paused'||value==='options'){$('pause-kicker').textContent=value==='options'?'CONSOLE DE RÉGLAGE':'SIGNAL EN ATTENTE';$('resume').innerHTML=(value==='options'?'Retour':'Reprendre')+' <span class="arrow-icon" aria-hidden="true"></span>';$('restart').hidden=$('pause-main').hidden=value==='options';selectTab(value==='options'?'image':optionsTab);}
    if(value!=='playing'){audio.setMachinery?.(0);audio.setSteam?.(0);if(document.pointerLockElement)document.exitPointerLock();}
  }
  function load(n,newSeed,loadout,asCampaign=campaignMode,revision=campaignRevision,legacyTraps=false,profiles=profileMode,combat=combatMode,prepared=null,simulationOptions={}){
    checkpointPending=false;checkpointWaitAt=-1;impactMarks.length=0;hordeFlashes.length=0;bursts.length=0;deflectUntil=0;
    campaignMode=asCampaign;campaignRevision=revision;profileMode=profiles&&asCampaign&&revision===2;combatMode=combat&&asCampaign&&revision===2;stage=n;if(newSeed!==undefined)seed=newSeed;world=prepared||cachedWorld(stage,seed,campaignMode,campaignRevision,legacyTraps,profileMode,combatMode);
    const entry=copyLoadout(loadout),slots=world.progression?.version===1&&(world.progression.weaponSlots===4||world.campaign===true&&world.progression.weaponSlots===5)?world.progression.weaponSlots:3;
    // Optional entry metadata must fit the actual generated arsenal. A stale
    // 3/4/5-slot entry cannot block restoration of a healthy checkpoint.
    const carry=entry&&(entry.inventory.weapons.length===slots||slots===4&&entry.inventory.weapons.length===3)?entry:null;
    sim?.dispose?.();sim=FSimulation.create(world,{...(carry||{}),armorSystem:true,...(brain?{brain}:{}),...(demoQuery.get('record')==='1'?{brain:null}:{}),...simulationOptions});attachReplay({seed,index:n,options:{campaign:asCampaign,campaignVersion:revision,legacyTraps,profiles:profileMode,combatVersion:combatMode?1:undefined,hordeVersion:world.hordeVersion===1?1:undefined},loadout:carry,simulationOptions:{armorSystem:true,...simulationOptions}});sim.setDifficulty?.(prefs.difficulty);
    if(sim.selectWeapon)sim.selectWeapon(carry?.equipment?.right??selectedWeapon);else sim.state.weapon=selectedWeapon;
    selectedWeapon=sim.state.weapon;stageEntryLoadout=copyLoadout(sim.exportLoadout?.()||sim.exportInventory?.());
    renderLoadPending=true;if(!deferLaunch)loadRender();
    motion.reset();leftMotion.reset();followCamera.reset(prefs.view==='third');lastFootstep=0;actorMotion.clear();systemMotion.clear();encounterTime=0;$('encounter').classList.remove('visible');outdoorMix=isOutdoors(sim.state.player.x,sim.state.player.z)?1:0;
    soundscape.reset();audio.setStage?.(world.stage, seed);audio.setEnvironment?.(world.environment,outdoorMix);audio.setMachinery?.(0);audio.setSteam?.(0);musicDirector?.reset();
    $('music-title').textContent=trackLabel();
    $('sector-number').textContent=(world.campaign?'MONDE ':'SECTEUR ')+String(stage+1).padStart(2,'0')+(world.campaign?' / 18':' / 03');$('sector-title').textContent=(world.campaignVersion===2?(stage<6?'Équipement '+(stage+1)+' / 6':'Assaut '+(stage-5)+' / 12')+' · ':world.campaign?world.chapterTitle+' · ':'')+world.title;
    $('mission-summary').innerHTML=world.campaignVersion===2?'<span><b>6</b> ÉQUIPEMENT</span><span><b>12</b> ASSAUT</span><span><b>18</b> MONDES</span>':world.campaign?'<span><b>18</b> MONDES</span><span><b>6</b> CHAPITRES</span><span><b>100 %</b> PROCÉDURAL</span>':'<span><b>430</b> MACHINES</span><span><b>3</b> COLOSSES</span><span><b>6</b> ASCENSEURS</span>';
    if(world.profileVersion)$('mission-summary').innerHTML='<span><b>LOURD</b> BRÈCHES · EXPLOSIFS</span><span><b>LÉGER</b> DRONE · RELAIS AÉRIENS</span><span><b>2</b> PROGRESSIONS</span>';
    $('restart').textContent=world.campaign?'RECOMMENCER CE MONDE':'RECOMMENCER CE SECTEUR';
    document.body.dataset.stage=String(stage+1);document.body.dataset.campaign=String(!!world.campaign);$('radar-wrap').hidden=touch;hudWait=0;renderHUD();weaponHint();controlsLegend();
  }
  function loadRender(){renderer.setWorld(sim.destruction?.meshes||world.meshes,sim.destruction?.lights||world.lights,skyEnvironment(world));renderRevision=sim.state.destructionRevision??sim.destruction?.revision??-1;renderToken=sim.destruction?.delta?.().token;renderLoadPending=false;}
  function syncDestruction(){
    if(renderLoadPending)return;
    const d=sim?.destruction,revision=sim?.state.destructionRevision??d?.revision;if(!d)return;
    const delta=d.delta?.(renderToken);if(delta?delta.token===renderToken:revision===renderRevision)return;
    if(renderer.updateWorld)renderer.updateWorld(d.meshes,revision,d.lights,delta);else renderer.setWorld(d.meshes,d.lights||world.lights,skyEnvironment(world));
    renderRevision=revision;renderToken=delta?.token;
  }
  function freePointerHint(){if(mode==='playing'&&controls.device!=='gamepad'&&document.pointerLockElement!==canvas)toast('Glissez pour viser · '+bindingLabel('fire')+' : tirer. Cliquez pour capturer la souris.',4);}
  function lock(){
    if(touch||controls.device==='gamepad')return;
    pointerLockWanted=true;
    if(document.pointerLockElement===canvas)return;
    const ticket=++pointerRequestSerial,current=()=>ticket===pointerRequestSerial&&mode==='playing'&&!document.hidden&&windowFocused;
    const attempt=raw=>{
      if(!current())return;
      const failed=error=>{if(!current())return;if(raw&&error?.name==='NotSupportedError')attempt(false);else freePointerHint();};
      try{
        if(!canvas.requestPointerLock){freePointerHint();return;}
        const result=raw?canvas.requestPointerLock({unadjustedMovement:true}):canvas.requestPointerLock();
        // Older implementations return void and report through document events.
        if(result?.catch)result.catch(failed);
      }catch(error){failed(error);}
    };
    attempt(!prefs.systemPointerAcceleration);
  }
  function start(message){
    if(deferLaunch){pendingStart={message};return;}
    titleGesture=true;titleBlocked=false;audio.start();audio.resume();setMode(document.hidden||!windowFocused?'paused':'playing');if(mode==='playing'){lock();canvas.focus({preventScroll:true});}
    toast(message||(world.profileVersion?(sim.state.activeProfile==='light'?'Drone LÉGER · vol à plat, '+bindingLabel('jump')+' monter · '+bindingLabel('dash')+' descendre. '+bindingLabel('switchProfile')+' : revenir au LOURD.':(stage===0?'Vous êtes le LOURD · récupérez le lance-grenades près du départ. ':'LOURD · les explosifs ouvrent les brèches. ')+bindingLabel('switchProfile')+' : piloter le drone LÉGER, qui vole à plat ('+bindingLabel('jump')+' monter · '+bindingLabel('dash')+' descendre).'):world.campaignVersion===2&&stage===0?'Pistolet en main droite · clic pour tirer. Le premier boss laisse le double pompe.':world.campaign&&stage===0?'Pistolet équipé · munitions illimitées. Clic : tirer ; premier trophée au monde 7.':world.campaign?'CHAPITRE '+(world.chapter+1)+' · '+world.chapterTitle+' — monde '+(stage+1)+' / 18. Explorez, équipez-vous et neutralisez le colosse.':stage===0?'Mitraillette équipée. Ramassez munitions et armes ; les machines arrivent par vagues.':stage===1?'Votre arsenal vous suit. Cherchez les réserves avant de déclencher les renforts.':'Gardez des munitions pour le Veilleur. Les réserves de l’arène sont limitées.'),5.5);
  }
  function newRun(newSeed){runStats=emptyStats();selectedWeapon=0;hordeMode=true;load(0,newSeed,undefined,true,2,false,true,true);saveCheckpoint();start();}
  async function preparePlay(nextStage,action,asCampaign=campaignMode,plan={}){
    if(!window.FMusic?.warmup){action();return;}
    const ticket=++preparationSerial;titleGesture=true;titleBlocked=false;audio.start();audio.resume();setMode('loading');$('loading-stage').textContent=(asCampaign?'MONDE ':'SECTEUR ')+String(nextStage+1).padStart(2,'0');$('loading-detail').textContent='Préparation des instruments et des réserves…';$('loading-bar').style.width='18%';
    try{
      // Two animation frames show the preparation screen before any substantial work.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      await Promise.all([prepareWorld(nextStage,plan.seed??seed,asCampaign,plan.revision??campaignRevision,false,plan.profiles??profileMode,plan.combat??combatMode,plan.horde??hordeMode),FMusic.warmup(nextStage%3,plan.seed??seed),brain?.prepare()]);await audio.prepare?.(nextStage%3,plan.seed??seed);await audio.prepareCues?.(window.FMusic?.cueIds?.()||[]);brainStatus();if(ticket!==preparationSerial)return;
      $('loading-detail').textContent='Assemblage du territoire et de la simulation…';$('loading-bar').style.width='76%';
      await new Promise(resolve=>requestAnimationFrame(resolve));if(ticket!==preparationSerial)return;
      deferLaunch=true;pendingStart=null;try{action();}finally{deferLaunch=false;}
      $('loading-detail').textContent='Préparation de l’image et des effets…';$('loading-bar').style.width='82%';await new Promise(resolve=>requestAnimationFrame(resolve));if(ticket!==preparationSerial)return;if(renderLoadPending)loadRender();await new Promise(resolve=>requestAnimationFrame(resolve));if(ticket!==preparationSerial)return;
      if(pendingStart&&prefs.fpsLimit===-1&&renderer.calibrate&&!document.hidden&&windowFocused){
        $('loading-detail').textContent='Mesure de la cadence à résolution native…';$('loading-bar').style.width='88%';
        const p=sim.state.player,camera={pos:[p.x,(p.y||0)+1.62,p.z],yaw:p.yaw,pitch:p.pitch,fov:prefs.fov};
        renderState=null;const measured=await renderer.calibrate(camera,models(sim.state.time,true,camera),{time:sim.state.time,shadows:prefs.shadows,bloom:prefs.bloom,reflections:prefs.reflections},30);
        if(ticket!==preparationSerial)return;
        autoCadence=cadencePending||FOptions.cadenceChoice(measured?.p95,autoCadence);cadencePending=0;renderer.setBudgetTarget?.(autoCadence);cadenceHint();
      }
      if(pendingStart){const {message}=pendingStart;pendingStart=null;start(message);}
    }catch(error){if(ticket!==preparationSerial)return;deferLaunch=false;pendingStart=null;setMode('menu');toast('Préparation interrompue. Réessayez depuis le menu.',4);console.error('METAL preparation:',error);}
  }
  function result(dead,reason){
    const s=sim.state,finished=!dead&&stage===(world.campaign?17:2);
    if(!dead){runStats.time+=s.elapsed;runStats.kills+=s.kills;runStats.shots+=s.shots;runStats.hits+=s.hits;runStats.score+=s.score||0;}
    $('result-kicker').textContent=dead?'TRANSMISSION PERDUE':finished?'TRANSMISSION RÉTABLIE':'RELAIS SYNCHRONISÉS';
    $('result-title').textContent=dead?(reason==='fall'?'Chute fatale.':'Signal perdu.'):finished?'Vous êtes sorti.':'Secteur sécurisé.';
    $('result-copy').textContent=dead?(reason==='fall'?'La chute a rompu le signal. Reprenez au dernier point enregistré.':'Votre dernier point a gardé le signal. Les commandes et les arrivées en ascenseur enregistrent aussi votre progression.'):finished?(world.campaign?'Dix-huit mondes traversés. Six chapitres arrachés aux machines. Le dernier Veilleur s’est tu ; les forges respirent encore.':'Trois colosses abattus. Neuf relais rallumés. Le dernier Veilleur s’est tu ; les forges respirent encore.'):'Le colosse est tombé. Alimentation rétablie, relais synchronisés. Un nouveau territoire et une machine plus immense vous attendent.';
    const stats=finished?runStats:{time:s.elapsed,kills:s.kills,shots:s.shots,hits:s.hits};
    $('result-time').textContent=formatTime(stats.time);$('result-kills').textContent=String(stats.kills);$('result-accuracy').textContent=(stats.shots?Math.min(100,Math.round(stats.hits/stats.shots*100)):0)+'%';
    $('result-score').textContent=String(Math.round(dead?runStats.score+(s.score||0):runStats.score));
    $('continue').innerHTML=(dead?'Reprendre au point de reprise':finished?'Nouvelle expédition':(world.campaign?'Rejoindre le monde ':'Rejoindre le secteur ')+(stage+2))+' <span class="arrow-icon" aria-hidden="true"></span>';
    if(finished)clearSave();
    setMode(dead?'dead':finished?'complete':'cleared');
    if(!dead&&!finished&&window.FMusic?.warmup){const nextStage=stage+1,nextSeed=seed,nextCampaign=!!world.campaign;FMusic.warmup(nextStage%3).then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))).then(()=>{if(mode==='cleared'&&seed===nextSeed&&stage+1===nextStage)return prepareWorld(nextStage,nextSeed,nextCampaign);}).catch(error=>console.error('METAL preparation:',error));}
  }
  function formatTime(v){return Math.floor(v/60)+':'+String(Math.floor(v%60)).padStart(2,'0');}
  function events(){
    let checkpointDue=false;const trophyIds=new Set(sim.state.events.filter(e=>e.name==='trophy'||e.name==='bossReward').map(e=>e.id));
    for(const e of sim.state.events){
      if(mode==='playing')controls.event(e,sim.state.player);
      if(e.name==='materialImpact'&&e.deflected){const t=sim.state.time;deflectUntil=t+.14;if(e.normal){impactMarks.push({source:e.sourceId,until:t+20,p:[e.x,e.y,e.z].map((v,k)=>v+e.normal[k]*.012),size:e.normal.map(v=>v?.018:.07)});if(impactMarks.length>32)impactMarks.shift();}if(t-deflectWindow>2.5){deflectWindow=t;deflectCount=0;}if(++deflectCount===4&&deflectHints<2&&mode==='playing'){deflectHints++;toast(sim.state.activeProfile==='light'?'Structure blindée · passez au lourd pour ouvrir une brèche.':'Structure blindée · utilisez une grenade ou une roquette.',3);}}
      if(e.name==='materialBreak')for(let k=impactMarks.length-1;k>=0;k--)if(impactMarks[k].source===e.sourceId)impactMarks.splice(k,1);
      if(e.name==='hordeSpawn'){hordeFlashes.push({x:e.x,y:e.y||0,z:e.z,t:sim.state.time});if(hordeFlashes.length>24)hordeFlashes.shift();}
      if((e.name==='materialBreak'||e.name==='materialImpact'&&!e.deflected)&&[e.x,e.y,e.z].every(Number.isFinite)){bursts.push({x:e.x,y:e.y,z:e.z,t:sim.state.time,material:e.material||'stone',power:Math.min(60,Number(e.power)||8),big:e.name==='materialBreak',seed:(Number(e.seed)||bursts.length)%997});if(bursts.length>32)bursts.shift();}
      if(e.name==='boundaryContact')boundaryFlash=.15;if(e.name==='weakHit')weakFlash=.3;if(e.name==='hurt'&&Number.isFinite(e.x)&&Number.isFinite(e.z)){hurtDirections.push({angle:Math.atan2(e.x-sim.state.player.x,sim.state.player.z-e.z),life:.6});if(hurtDirections.length>4)hurtDirections.shift();}if(e.name==='kill'&&e.credited)killFlash=.3;
      // shots is shared by both hands: consume only the hand that really fired.
      if(e.name==='shot'||e.name==='fracture'||(e.name==='rocket'||e.name==='grenadeLaunch')&&e.owner==='player'){
        if(e.hand==='left')fireLeftPressed=false;else firePressed=false;
      }
      const handMotion=e.hand==='left'?leftMotion:motion;
      // The drone's twin cannons recoil together.
      if(e.twin)leftMotion.impulse(e.name==='shot'&&e.weapon===4?'pistol':e.name);
      if(e.name==='rocket'||e.name==='grenadeLaunch'){if(e.owner==='player')handMotion.impulse(e.name==='grenadeLaunch'?'grenade':'rocket');}
      else if(e.name==='land'){if(e.actor==='player'&&sim.state.activeProfile!=='light'){motion.impulse('land',e.impact);leftMotion.impulse('land',e.impact);}}
      else if(e.name==='bossStep'){const p=sim.state.player,amount=.25*clamp(1-Math.hypot((e.x??p.x)-p.x,(e.z??p.z)-p.z)/25,0,1);if(amount>0){motion.impulse('blast',amount);leftMotion.impulse('blast',amount);}}
      else if(e.name==='jointBreak'){motion.impulse('blast',.7);leftMotion.impulse('blast',.7);toast('ARTICULATION BRISÉE',1.8);}
      else if(e.name==='bossImpact'||e.name==='bossDeath'){const p=sim.state.player,d=Math.hypot((e.x??p.x)-p.x,(e.z??p.z)-p.z),amount=(e.name==='bossDeath'?1:e.kind==='ring'?.4:.8)*clamp(1-d/40,0,1);motion.impulse('blast',amount);leftMotion.impulse('blast',amount);if(e.name==='bossDeath')freezeUntil=performance.now()+120;}
      else if(e.name==='explosion'){const p=sim.state.player,d=Math.hypot((e.x??p.x)-p.x,(e.y??p.y)-p.y,(e.z??p.z)-p.z);motion.impulse('blast',clamp(1-d/14,0,1));leftMotion.impulse('blast',clamp(1-d/14,0,1));}
      else handMotion.impulse(e.name==='shot'&&e.weapon===4?'pistol':e.name);
      const sound=e.name==='bossStep'?'land':e.name==='bossReward'?'weaponPickup':e.name==='waveStart'?'wave':e.name==='armorPickup'?'ammoPickup':e.name==='lootPickup'?(e.boss?'weaponPickup':'ammoPickup'):e.name==='jointBreak'?'bossImpact':e.name;
      if(e.name!=='win'&&typeof audio[sound]==='function'&&!((e.name==='weaponPickup'||e.name==='lootPickup')&&trophyIds.has(e.id))){
        const mix=soundscape.event(sim,e);if(mix.level>.0001)audio[sound](mix);
      }
      if(mode==='demo'){if(e.name==='profileSwitch')poseView.clear();continue;}
      if(e.name==='core'){
        checkpointDue=true;
        toast(e.count===3?(!systemsReady()?'Trois relais en ligne. Activez les commandes restantes.':sim.state.bossAlive?'Trois relais en ligne. Neutralisez le gardien.':'Trois relais en ligne. Rejoignez la sortie.'):'Relais '+e.count+' / 3 · intégrité restaurée · point de reprise',3.2);
      }
      if(e.name==='profileSwitch'){poseView.clear();selectedWeapon=sim.state.weapon;clearFireIntents();motion.reset();leftMotion.reset();controlHints();motion.impulse('switch');leftMotion.impulse('switch');audio.switchWeapon?.();toast(e.to==='light'?'DRONE LÉGER · '+bindingLabel('jump')+' monter · '+bindingLabel('dash')+' descendre · '+bindingLabel('sprint')+' boost':'LOURD · explosifs pour ouvrir les passages',2.5);checkpointDue=true;}
      if(e.name==='profileLevel'){toast((e.profile==='light'?'LÉGER':'LOURD')+' · NIVEAU '+e.level+' · +75 CR',3);checkpointDue=true;}
      if(e.name==='profileBlocked')toast('GARDIEN · profil '+(e.required==='light'?'LÉGER':'LOURD')+' requis',2);
      if(e.name==='mechanism'){checkpointDue=true;const a=sim.state.mechanisms?.find(a=>a.id===e.id);toast((a?.name||'Commande')+' · alimentation rétablie · point de reprise',3.2);}
      if(e.name==='liftStop'&&e.carrying){checkpointDue=true;toast('Palier atteint · point de reprise',2.2);}
      if(e.name==='jumpPad'&&e.actor==='player')toast('PROPULSION · ajustez votre trajectoire en vol',1.6);
      if(e.name==='rocketDud'&&e.owner==='player')toast('Trop près : roquette non armée. Reculez pour tirer.',2.3);
      if(e.name==='pipeLeak'&&Math.hypot(e.x-sim.state.player.x,e.z-sim.state.player.z)<16)toast('CONDUITE PERCÉE · vapeur brûlante',2.1);
      if(e.name==='trap'&&Math.hypot(e.x-sim.state.player.x,e.z-sim.state.player.z)<10)toast('PIÈGE ACTIVÉ · quittez la dalle',1.5);
      if(e.name==='horror'&&e.kind==='alarm')toast('ALERTE LOCALE · des machines convergent',2.1);
      if(e.name==='pickup')toast('Intégrité restaurée',1.8);
      if(e.name==='armorPickup'){toast('+'+(Math.round(e.amount*10)/10)+' ARMURE · '+Math.ceil(e.points)+' / '+e.capacity,2.1);if(!sim.state.enemies.some(q=>q.hp>0&&q.bossAwake))checkpointDue=true;}
      if(e.name==='bossReward'){const parts=[];if(Number.isInteger(e.weapon))parts.push(weaponNames[e.weapon].toUpperCase());if(e.weaponUpgrade)parts.push(e.weaponUpgrade.label+' · RANG '+e.weaponUpgrade.rank);if(e.personalUpgrade)parts.push(e.personalUpgrade.label+' · RANG '+e.personalUpgrade.rank);encounter('BUTIN DU BOSS '+e.bossNumber,parts.join(' · '));encounterTime=6;checkpointDue=true;}
      if(e.name==='lootPickup'){const gains=[];if(e.credits)gains.push('+'+e.credits+' CR');if(e.cores)gains.push('+'+e.cores+' NOYAU');if(e.armor)gains.push('+'+(Math.round(e.armor*10)/10)+' ARMURE');for(let i=0;i<4;i++)if(e.ammo?.[i])gains.push('+'+e.ammo[i]+' '+ammoNames[i]);toast((e.boss?'BUTIN DU COLOSSE · ':'RÉCUPÉRATION · ')+gains.join(' · '),e.boss?4:2);if(e.boss||e.armor>0&&!sim.state.enemies.some(q=>q.hp>0&&q.bossAwake))checkpointDue=true;}
      if(e.name==='shopOpen'){currentShopId=e.id;setMode('shop');renderShop();}
      if(e.name==='ammoPickup')toast('+'+e.amount+' '+ammoNames[e.weapon]+' · '+weaponNames[e.weapon],1.8);
      if(e.name==='weaponPickup'){if(selectedWeapon!==sim.state.weapon)clearFireIntents();selectedWeapon=sim.state.weapon;motion.impulse('switch');if(!trophyIds.has(e.id))toast(weaponNames[e.weapon].toUpperCase()+' RÉCUPÉRÉE'+(e.amount?' · +'+e.amount+' '+ammoNames[e.weapon]:''),3);checkpointDue=true;}
      if(e.name==='trophy'){encounter(e.label||weaponNames[e.weapon],e.usage||'NOUVEL ÉQUIPEMENT · PRÉPAREZ-VOUS À L’ÉPREUVE');encounterTime=Math.max(3,e.grace||3);checkpointDue=true;}
      if(e.name==='trophyComplete'){toast('ÉPREUVE RÉUSSIE · équipement maîtrisé · point de reprise',3);checkpointDue=true;}
      if(e.name==='empty')toast('MUNITIONS ÉPUISÉES · cherchez des réserves'+(touch?' · bouton Crosse':(' · '+bindingLabel('melee')+' : crosse')),2.1);
      if(e.name==='waveStart'){const c=sim.state.encounters?.find(c=>c.id===e.id),wave=c?Math.max(c.wave,c.pendingWave)+1:e.wave;toast((e.label||'RENFORTS')+' · VAGUE '+wave+' / '+(c?.waves?.length||e.total),2.7);}
      if(e.name==='encounterClear'){if(!sim.state.encounters?.find(q=>q.id===e.id)?.requiresTrophy)toast((e.label||'ZONE')+' · SÉCURISÉE · point de reprise',2.4);checkpointDue=true;}
      if(e.name==='overheat')toast('Surchauffe · laissez refroidir',1.6);
      if(e.name==='bossRoar'){const boss=sim.state.enemies.find(a=>a.id===e.id||a.id===e.bossId);if(boss)encounter(boss.bossName||'Le Colosse',e.phase>0?'PHASE '+(e.phase+1)+' · SURCHARGE':'COLOSSE ÉVEILLÉ · '+Math.round(3.325*(boss.bossScale||1))+' M');}
      if(e.name==='bossPhase')toast('SURCHARGE · le colosse change de rythme. Surveillez les zones au sol.',3.5);
      if(e.name==='bossDeath'){const boss=sim.state.enemies.find(a=>a.id===e.id);encounter(boss?.bossName||'Le Colosse','COLOSSE ABATTU');checkpointDue=true;}
      if(e.name==='win'){result(false);audio.win?.();musicDirector?.victory();break;}
      if(e.name==='dead'){result(true,e.reason);break;}
    }
    sim.state.events.length=0;
    selectedWeapon=sim.state.weapon;
    if(checkpointDue||checkpointPending&&!sim.state.player.airborne)saveCheckpoint();
  }
  const m=(shape,p,s,mat,r=[0,0,0],emissive=0)=>FRender.mesh(shape,p,s,mat,r,emissive);
  function renderShop(message){
    const shop=(world.shops||[]).find(q=>q.id===currentShopId),offers=sim.shopOffers?.(currentShopId),profile=sim.state.economy,stats=sim.stats||{maxHp:100};
    $('shop-title').textContent=shop?.name||'Atelier';$('shop-credits').textContent=String(profile?.credits||0);$('shop-cores').textContent=String(profile?.cores||0);
    $('shop-health').textContent=Math.ceil(sim.state.player.hp)+' / '+stats.maxHp;$('shop-build').textContent='Blindage '+Math.round((1-(stats.incomingMultiplier??1))*100)+' % · Puissance +'+Math.round(((stats.damageMultiplier??1)-1)*100)+' % · Capacité '+(sim.ammoCaps||[180,36,12]).join(' / ');
    $('shop-status').textContent=message||(!offers?'Approchez-vous d’un atelier pour acheter.':'Les crédits et noyaux se récupèrent sur les machines. Les achats sont définitifs dans ce point de reprise.');
    $('shop-offers').innerHTML=(offers||[]).map(q=>{const item=q.item||q,label=item.label||item.id,cost=q.cost||{credits:0,cores:0},price=!q.ok&&!cost.credits&&!cost.cores?'—':cost.credits+' CR'+(cost.cores?' + '+cost.cores+' NOYAU'+(cost.cores>1?'X':''):''),rank=item.kind==='upgrade'?'RANG '+(q.rank||0)+' / '+(item.maxRank||3):item.kind==='repair'?'RÉPARATION':item.kind==='weapon'?'ÉQUIPEMENT':'RAVITAILLEMENT';return '<article class="shop-card '+(!q.ok?'unavailable':'')+'"><span class="shop-category">'+rank+'</span><h3>'+label+'</h3><p>'+item.description+'</p><div class="shop-purchase"><strong>'+price+'</strong><button id="buy-'+item.id+'" '+(!q.ok?'disabled':'')+' aria-label="Acheter '+label+'">'+(q.ok?'ACHETER':q.message||'INDISPONIBLE')+'</button></div></article>';}).join('');
    for(const q of offers||[]){const id=(q.item||q).id;$('buy-'+id).addEventListener('click',()=>{const result=sim.buy?.(currentShopId,id);if(result?.ok){events();saveCheckpoint();renderHUD();renderShop((q.item||q).label+' · achat enregistré.');}else renderShop(result?.message||result?.reason||'Achat indisponible.');});}
  }
  function systemsReady(){return (sim.state.mechanisms||[]).every(a=>!a.required||a.active);}
  function pendingBossReward(){return world.campaignVersion===2?(sim.state.loot||[]).find(q=>q.kind==='boss'&&q.rewardTaken===false):null;}
  function exitReady(){return sim.state.relays===3&&systemsReady()&&!sim.state.bossAlive&&!pendingBossReward();}
  function isOutdoors(x,z){return (world?.environment?.outdoorZones||[]).some(a=>Math.abs(x-a.x)<=a.w/2&&Math.abs(z-a.z)<=a.d/2);}
  function machinery(out,t){
    const player=sim.state.player,range=quality==='low'?25:43;
    for(const a of world.machinery||[]){
      if(a.destructibleId!==undefined&&sim.destruction&&!sim.destruction.isAlive(a.destructibleId))continue;
      if(Math.hypot(a.x-player.x,a.z-player.z)>range)continue;
      const size=a.size||2,turn=t*a.speed,axis=a.axis||'y';
      if(a.type==='fan'){
        const ringRot=axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:[0,0,0];
        out.push(m('ring',[a.x,a.y,a.z],[size,size,size],0,ringRot),m('sphere',[a.x,a.y,a.z],[size*.19,size*.19,size*.19],1));
        for(let j=0;j<4;j++){
          const angle=turn+j*Math.PI/2,c=Math.cos(angle)*size*.26,s=Math.sin(angle)*size*.26;
          const pos=axis==='x'?[a.x,a.y+c,a.z+s]:axis==='z'?[a.x+c,a.y+s,a.z]:[a.x+c,a.y,a.z+s];
          const scale=axis==='x'?[.07,size*.43,size*.12]:axis==='z'?[size*.43,size*.12,.07]:[size*.43,.07,size*.12];
          const rot=axis==='x'?[angle,0,0]:axis==='z'?[0,0,angle]:[0,-angle,0];
          out.push(m('box',pos,scale,1,rot));
        }
      }else if(a.type==='piston'){
        const travel=Math.sin(turn)*size*.22;
        out.push(m('cylinder',[a.x,a.y+travel,a.z],[size*.5,size*.35,size*.5],1),m('cylinder',[a.x,a.y+size*.5+travel*.5,a.z],[size*.12,size,size*.12],0),m('ring',[a.x,a.y+travel-size*.18,a.z],[size*.6,.08,size*.6],5,[0,0,0],.5));
      }else if(a.type==='reactor'){
        out.push(m('octa',[a.x,a.y,a.z],[size*.23,size*.65,size*.23],4,[0,turn,0],1.6),m('ring',[a.x,a.y,a.z],[size*.85,size*.85,size*.85],1,[.3,turn*.3,Math.sin(turn*.2)*.2]),m('ring',[a.x,a.y,a.z],[size*.6,size*.6,size*.6],4,[Math.PI/2,turn*.6,0],.8));
        for(let j=0;j<4;j++){const angle=turn+j*Math.PI/2;out.push(m('octa',[a.x+Math.cos(angle)*size*.3,a.y+Math.sin(angle*.8)*.3,a.z+Math.sin(angle)*size*.3],[.13,.23,.13],4,[0,turn,0],1.8));}
      }
    }
    for(const h of world.hazards||[]){
      if(Math.hypot(h.x-player.x,h.z-player.z)>range)continue;
      const cycle=(t+h.phase)%h.period,hot=cycle<h.active,warning=cycle>h.period-.85;
      if(!hot&&!warning)continue;
      out.push(m('ring',[h.x,(h.y||0)+.035,h.z],[h.r*2,.06,h.r*2],hot?6:5,[0,0,0],hot?1.8:.7+Math.sin(t*17)*.4));
      if(hot)for(let j=0;j<5;j++){
        const a=j*1.257+t*.3,y=.25+(t*2.3+j*.21)%1.45,r=h.r*.45;
        out.push(m('octa',[h.x+Math.cos(a)*r,(h.y||0)+y,h.z+Math.sin(a)*r],[.16,.7,.16],j%2?6:5,[0,t+j,0],1.6));
      }
    }
  }
  function ambience(out,t){
    const p=sim.state.player,range=quality==='low'?10:22;
    const near=(world.ambience||[]).filter(a=>(quality!=='low'||a.type==='screen'||a.type==='beacon')&&(a.destructibleId===undefined||!sim.destruction||sim.destruction.isAlive(a.destructibleId))).map(a=>({a,d:Math.hypot(a.x-p.x,a.z-p.z)})).filter(v=>v.d<range).sort((a,b)=>a.d-b.d).slice(0,quality==='low'?3:9);
    function piece(shape,pos,size,mat,em,color,r=[0,0,0]){const mesh=m(shape,pos,size,mat,r,em);if(color)mesh.color=color;out.push(mesh);}
    for(const {a} of near){
      const phase=a.phase||0,scale=a.scale||1;
      if(a.type==='screen'){
        const n=a.normal||[0,0,1],width=a.width||.6,height=a.height||.4;
        const scan=((t*.22+phase)%1-.5)*height;
        piece('box',[a.x+n[0]*.012,a.y+scan,a.z+n[2]*.012],n[0]?[.009,.012,width]:[width,.012,.009],4,.55,a.color);
      }else if(a.type==='beacon'){
        const beat=Math.pow(Math.max(0,Math.sin(t*2.2+phase)),6),s=scale*(.8+beat*.2);
        piece('sphere',[a.x,a.y,a.z],[s,s,s],4,.3+beat*1.5,a.color);
      }else if(quality!=='low'&&a.type==='steam'){
        for(let j=0;j<4;j++){
          const q=(t*.45+phase+j*.25)%1,r=.035+q*.065;
          piece('sphere',[a.x+Math.sin(q*8+phase)*r,a.y+q*.8*scale,a.z+Math.cos(q*7+phase)*r],[r,r*2.2,r],3,0,a.color);
        }
      }else if(quality!=='low'&&a.type==='drip'){
        const q=(t*.65+phase)%1;
        if(q<.8)piece('sphere',[a.x,a.y-q*.55,a.z],[.025,.065,.025],4,.2,a.color);
      }else if(quality!=='low'&&a.type==='sparks'){
        const burst=(t+phase)%2.7;
        if(burst<.28)for(let j=0;j<3;j++){
          const angle=phase+j*2.094;
          piece('box',[a.x+Math.cos(angle)*burst*.7,a.y-burst*burst*3,a.z+Math.sin(angle)*burst*.7],[.018,.04,.018],5,1.5,a.color,[0,angle,burst*4]);
        }
      }
    }
  }
  function systems(out,t){
    const s=sim.state,p=s.player,range=quality==='low'?32:55;
    const near=a=>(a.x-p.x)**2+(a.z-p.z)**2<range*range;
    for(const a of world.jumpPads||[]){
      if(!near(a))continue;
      const pulse=.55+.3*Math.sin(t*4+a.x);
      out.push(m('ring',[a.x,a.y+.08,a.z],[a.r*1.65,.055,a.r*1.65],4,[0,t*.35,0],pulse));
      if(quality!=='low')for(let j=0;j<3;j++){const q=(t*.7+j/3)%1;out.push(m('octa',[a.x,a.y+.15+q*.8,a.z],[.12*(1-q*.5),.17,.12*(1-q*.5)],4,[0,t,0],(1-q)*.9));}
    }
    for(const a of s.mechanisms||[]){
      if(!near(a)||a.destroyed)continue;
      const progress=systemMotion.get(a.id)??Number(a.active),y=(a.y||0),signal=a.active?4:5,glow=a.active?.9:.45+Math.sin(t*3+a.x*.3)*.2;
      out.push(m('box',[a.x,y+1.24,a.z],[.28,.09,.21],signal,[0,0,0],glow));
      if(a.kind==='valve'){
        const angle=progress*Math.PI*1.5;
        out.push(m('ring',[a.x,y+.82,a.z+.39],[.5,.5,.5],1,[Math.PI/2,0,angle]));
        for(let j=0;j<3;j++){const r=angle+j*Math.PI*2/3;out.push(m('box',[a.x+Math.cos(r)*.105,y+.82+Math.sin(r)*.105,a.z+.39],[.22,.035,.055],signal,[0,0,r],.25));}
        out.push(m('cylinder',[a.x,y+.82,a.z+.36],[.09,.19,.09],0,[Math.PI/2,0,0]));
      }else if(a.kind==='breaker'){
        const angle=(progress-.5)*1.15;
        out.push(m('box',[a.x,y+.83+Math.sin(angle)*.2,a.z+.43],[.3,.09,.12],1,[angle,0,0]),m('box',[a.x,y+.83,a.z+.36],[.08,.38,.07],0,[angle,0,0]));
      }else{
        for(let j=0;j<3;j++)out.push(m('box',[a.x-.19+j*.19,y+.8,a.z+.321],[.12,.05+.18*progress,.012],signal,[0,0,0],.8));
      }
      if(!a.active)out.push(m('octa',[a.x,y+1.8+Math.sin(t*2)*.06,a.z],[.15,.2,.15],5,[0,t,0],.8));
    }
    for(const a of s.doors||[]){
      if(!near(a)||a.destroyed)continue;
      const y=a.y+a.h/2+a.progress*(a.h+.25),across=a.w>a.d,signal=a.open?4:5;
      const leaf=m('box',[a.x,y,a.z],[a.w,a.h,a.d],0);leaf.surface='architecture';out.push(leaf);
      for(let j=0;j<3;j++){
        const offset=(j-1)*.62;
        out.push(m('box',[a.x+(across?0:a.w*.54),y+offset,a.z+(across?a.d*.54:0)],across?[a.w*.86,.07,.045]:[.045,.07,a.d*.86],1));
      }
      out.push(m('box',[a.x,y,a.z],across?[.12,a.h*.64,a.d+.025]:[a.w+.025,a.h*.64,.12],signal,[0,0,0],.7));
    }
    for(const a of s.lifts||[]){
      if(!near(a))continue;
      const signal=a.powered?4:5,travel=(a.y-a.minY)/Math.max(.1,a.maxY-a.minY),moving=a.moving;
      const platform=m('box',[a.x,a.y-.11,a.z],[a.w,.22,a.d],0);platform.ground=true;platform.surface='architecture';out.push(platform);
      for(const side of [-1,1]){
        const edge=a.axis==='x'?[a.x,a.y+.015,a.z+side*(a.d/2-.12)]:[a.x+side*(a.w/2-.12),a.y+.015,a.z];
        out.push(m('box',edge,a.axis==='x'?[a.w-.1,.03,.13]:[.13,.03,a.d-.1],1));
        const stripe=a.axis==='x'?[a.x+side*(a.w/2-.13),a.y+.025,a.z]:[a.x,a.y+.025,a.z+side*(a.d/2-.13)];
        out.push(m('box',stripe,a.axis==='x'?[.08,.03,a.d-.32]:[a.w-.32,.03,.08],signal,[0,0,0],moving?1.2:.45));
      }
      out.push(m('ring',[a.x,a.y+.027,a.z],[1.05,.03,1.05],signal,[0,0,0],.35));
      // The ram follows the physical deck; its top never remains at the old landing.
      const ramHeight=Math.max(.08,a.y-a.minY+.1);
      out.push(m('cylinder',[a.x,a.minY+ramHeight/2-.2,a.z],[.38,ramHeight,.38],7),m('ring',[a.x,a.y-.25,a.z],[.62,.15,.62],1));
      for(const call of [a.lowerCall,a.upperCall]){
        if(!call)continue;
        const arrived=Math.abs(a.y-call.y)<.15;
        out.push(m('box',[call.x,(call.y||0)+1.05,call.z],[.24,.08,.2],arrived&&a.powered?4:5,[0,0,0],arrived?.8:.2));
        const direction=call===a.upperCall?-1:1;
        out.push(m('octa',[call.x,(call.y||0)+1.35,call.z],[.13,.17,.13],signal,[0,t*.3,0],moving?.65+Math.sin(t*7)*.25:.35));
        if(quality!=='low')out.push(m('box',[call.x,(call.y||0)+.65+travel*.25,call.z+.14],[.12,.04,.02],4,[0,0,direction*.4],.5));
      }
    }
  }
  function supplyVisible(c){return !c.taken&&((c.kind||c.type)!=='armor'||!!sim.state.armor)&&(!world.campaign||(!(Number.isInteger(c.requiresWeapon)&&!sim.state.inventory.weapons[c.requiresWeapon])&&((c.kind||c.type)!=='ammo'||sim.state.inventory.weapons[c.weapon])));}
  function supplyModel(out,c,t){
    const kind=c.kind||c.type||'health',weapon=c.weapon||0,y=(c.y||0)+.4+Math.sin(t*1.8+c.x)*.035,mat=kind==='health'?4:weapon===0?4:weapon===1?5:6;
    const frame=FMotion.mount({pos:[c.x,y,c.z],yaw:t*.3+c.x*.1,pitch:0,roll:0}),part=(shape,p,s,material=0,rx=0,glow=0)=>{const pose=FMotion.place(frame,p,rx),a=m(shape,pose.p,s,material,pose.r,glow);a.surface='object';out.push(a);};
    if(!c.displayOnly)out.push(m('ring',[c.x,(c.y||0)+.055,c.z],[kind==='weapon'?1.2:.7,.045,kind==='weapon'?1.2:.7],mat,[0,0,0],.45));
    if(kind==='salvage'||kind==='boss'||kind==='resupply'){
      const boss=kind==='boss';part('box',[0,-.05,0],[boss?.75:.38,boss?.42:.23,boss?.55:.31],0);part('box',[0,boss?.18:.085,0],[boss?.62:.3,.045,boss?.45:.23],1);
      for(const side of [-1,1])part('box',[side*(boss?.26:.11),.01,0],[.035,boss?.39:.2,boss?.56:.32],5,0,.35);
      if(c.cores)part('octa',[0,.46,0],[.26,.42,.26],5,0,1.2);else if(c.credits)part('octa',[0,.25,0],[.18,.16,.18],5,0,.5);else if(c.armor>0)part('bevel',[0,.26,0],[.19,.22,.065],4,0,.65);
      if(boss){part('ring',[0,.4,0],[.56,.04,.56],4,0,.6);if(c.rewardTaken===false){if(Number.isInteger(c.weapon))supplyModel(out,{kind:'weapon',weapon:c.weapon,x:c.x,y:(c.y||0)+.76,z:c.z,displayOnly:true},t);part('ring',[.53,.3,0],[.24,.075,.24],5,0,.6);part('bevel',[-.53,.3,0],[.2,.25,.07],4,0,.65);part('box',[-.53,.3,-.045],[.13,.035,.025],1);part('box',[-.53,.3,-.045],[.035,.17,.025],1);}}return;
    }
    if(kind==='health'){
      part('box',[0,0,0],[.45,.32,.4]);part('box',[0,.17,0],[.28,.035,.085],4,0,.8);part('box',[0,.17,0],[.085,.035,.28],4,0,.8);return;
    }
    if(kind==='armor'){
      part('bevel',[0,.035,0],[.38,.38,.14],1);part('bevel',[0,-.18,.012],[.25,.12,.13],0);
      for(const side of [-1,1]){part('bevel',[side*.23,.17,0],[.16,.11,.18],1);part('box',[side*.13,.04,-.077],[.026,.25,.016],4,0,.65);}
      part('octa',[0,.06,-.085],[.075,.09,.035],4,0,.85);return;
    }
    if(kind==='weapon'){
      if(weapon===2){
        part('cylinder',[0,.08,0],[.22,.95,.22],1,Math.PI/2);part('ring',[0,.08,-.48],[.28,.055,.28],6,Math.PI/2,.4);part('box',[.11,.22,.07],[.045,.1,.22],5,0,.6);part('box',[0,-.12,.13],[.09,.2,.12]);
      }else if(weapon===3){
        part('bevel',[0,.04,.12],[.22,.16,.28],0);part('cylinder',[0,.02,-.1],[.3,.21,.3],1,Math.PI/2);part('ring',[0,.02,.02],[.32,.025,.32],5,Math.PI/2,.3);part('cylinder',[0,.04,-.38],[.12,.35,.12],0,Math.PI/2);part('box',[0,.19,-.1],[.06,.04,.42],1);part('box',[0,-.14,.16],[.085,.2,.11]);
      }else{
        part('box',[0,.03,.06],[weapon===1?.28:.19,.17,.44],1);part('box',[0,.14,.06],[.12,.05,.36],mat,0,.35);part('box',[0,-.13,.17],[.095,.2,.12]);
        for(const side of weapon===1?[-1,1]:[0])part('cylinder',[side*.073,.055,-.3],[.08,.42,.08],0,Math.PI/2);
        part('box',[0,.18,-.03],[.035,.055,.06],4,0,.7);part('box',[0,.03,.3],[.13,.13,.08]);
      }
      return;
    }
    part('box',[0,-.07,0],[.48,.22,.34]);part('box',[0,.05,.1],[.39,.035,.055],mat,0,.6);
    for(const side of [-1,0,1]){
      part('cylinder',[side*.13,.13,-.025],[weapon===2?.075:.085,weapon===2?.39:.22,weapon===2?.075:.085],1);
      part(weapon===2?'octa':'cylinder',[side*.13,weapon===2?.35:.255,-.025],[.085,weapon===2?.09:.045,.085],mat,0,.45);
    }
  }
  function models(t,playing,camera,thirdPerson=false){
    const out=[],s=renderState||sim.state,p=s.player;sim.rigid?.models(out,camera,fixedLoop.frame.alpha);machinery(out,t);ambience(out,t);systems(out,t);
    for(let i=impactMarks.length-1;i>=0;i--){const q=impactMarks[i];if(q.until<s.time){impactMarks.splice(i,1);continue;}out.push({...m('box',q.p,q.size,2),color:[.06,.07,.08]});}
    if(window.FEffects)out.push(...FEffects.build(s,world,camera,{quality,backend:renderer.stats.backend}));
    // All registered machines remain in the simulation; distance only reduces model detail.
    // Match the renderer's whole approach transition conservatively. The renderer
    // still chooses the actual range; this early filter must never shorten it.
    const longView=(world.environment?.longViewZones||[]).some(a=>Math.abs(p.x-a.x)<=a.w/2+35&&Math.abs(p.z-a.z)<=a.d/2+35);
    const range=drawRange(longView);
    const nearby=(x,z,r=3)=>(x-p.x)**2+(z-p.z)**2<(range+r)**2;
    const actorVisible=renderer.actorFilter?.(camera,{shadows:prefs.shadows,reflections:prefs.reflections})||(()=>true);
    for(const c of s.cores){
      if(!nearby(c.x,c.z))continue;
      out.push(m('cylinder',[c.x,(c.y||0)+.13,c.z],[.95,.26,.95],0),m('ring',[c.x,(c.y||0)+.29,c.z],[1.15,.1,1.15],c.taken?0:5));
      if(!c.taken){const y=(c.y||0)+1.22+Math.sin(t*2+c.id)*.13;out.push(m('octa',[c.x,y,c.z],[.55,.85,.55],5,[0,t*.7,0],1.8),m('ring',[c.x,y,c.z],[1.2,1.2,1.2],4,[Math.PI/2,0,t*.35],1.2));}
    }
    burstModels(out,s.time,nearby);
    // A horde arrival: a short column of light and a ring on the floor.
    for(const f of hordeFlashes){const age=s.time-f.t;if(age<0||age>.7||!nearby(f.x,f.z))continue;const k=1-age/.7;out.push(m('cylinder',[f.x,f.y+1.2,f.z],[.9*k+.2,2.4,.9*k+.2],5,[0,0,0],1.6*k),m('ring',[f.x,f.y+.06,f.z],[1+age*4,.06,1+age*4],5,[0,0,0],1.2*k));}
    for(const e of s.enemies){
      const scale=e.type===3?Math.max(1,Number(e.bossScale)||1):1,giant=scale>1;
      if(e.deployed===false||e.hp<=0||!nearby(e.x,e.z,e.type===3?4.5*scale:2))continue;
      if(!actorVisible(e.x,(e.baseY||0)+1.6*scale,e.z,e.type===3?4.5*scale:3.5))continue;
      const pose=actorMotion.get(e.id),distance=Math.hypot(e.x-p.x,e.z-p.z),base=e.baseY||0;
      out.push(...FActors.build(e,{time:t,phase:pose?.phase,blend:pose?.blend,yaw:giant?undefined:pose?.yaw,distance,quality,backend:renderer.stats.backend}));
      if(e.windup>0&&!giant){
        const charge=1-e.windup/(e.windupMax||1),heading=Number.isFinite(e.yaw)?e.yaw:0,r=(e.type===3?2.2:.8)*(1.3-charge*.3);
        out.push(m('ring',[e.x,base+.07,e.z],[r*2,.08,r*2],5,[0,0,0],.5+charge));
        if(distance<24){
          const dx=Math.sin(heading),dz=-Math.cos(heading);
          for(let j=1;j<=3;j++){
            const x=e.x+dx*(j*.65+.5),z=e.z+dz*(j*.65+.5),y=sim.ground?.(x,z)??base;
            if(Number.isFinite(y)&&Math.abs(y-base)<.6)out.push(m('box',[x,y+.065,z],[.11,.04,.3],5,[0,-heading,0],.4+charge));
          }
        }
      }
      if(e.stun>0)out.push(m('ring',[e.x,base+[2,2.25,2.35,3.35][e.type]*scale,e.z],[1.05*scale,.055*scale,1.05*scale],4,[.15,t*2,0],.6));
    }
    for(const c of [...s.pickups,...(s.loot||[])]){if(!supplyVisible(c)||!nearby(c.x,c.z))continue;
      // Le rayon couvre la plus haute récompense (0,76 m) et le socle le plus large (1,2 m).
      if(!actorVisible(c.x,(c.y||0)+.5,c.z,1.6))continue;
      supplyModel(out,c,t);
    }
    for(const trophy of world.trophies||[]){
      const state=s.campaign?.trophies.find(q=>q.id===trophy.id);if(!state||!nearby(trophy.x,trophy.z)||state.phase==='complete')continue;
      const acquiring=state.phase==='grace',r=acquiring?1.2+(1-state.timer/(trophy.grace||3))*.5:1.22;
      const halo=m('ring',[trophy.x,(trophy.y||0)+.17+(acquiring?.25:Math.sin(t*2)*.025),trophy.z],[r,.028,r],acquiring?5:4,[0,t*.3,0],acquiring?.95:.45);
      halo.fx=true;halo.alpha=acquiring?.55:.3;halo.surface='object';out.push(halo);
    }
    const ex=world.exit.x,ez=world.exit.z,ey=world.exit.y||0,ready=exitReady(),exitMat=ready?4:5;
    if(nearby(ex,ez,4)){
    out.push(m('cylinder',[ex,ey+.08,ez],[2.5,.16,2.5],0),m('ring',[ex,ey+.2,ez],[2.7,.1,2.7],exitMat,[0,0,0],1.4));
    for(const side of [-1,1])out.push(m('box',[ex+side*1.4,ey+1.65,ez],[.25,3.3,.5],0),m('box',[ex+side*1.24,ey+1.65,ez],[.06,2.9,.2],exitMat,[0,0,0],1.4));
    out.push(m('box',[ex,ey+3.2,ez],[2.9,.25,.5],0));
    if(ready)for(let j=0;j<6;j++){const a=t*1.1+j*1.047;out.push(m('octa',[ex+Math.cos(a)*.7,ey+.4+((t*.6+j*.4)%2.4),ez+Math.sin(a)*.7],[.1,.16,.1],4,[0,t,0],2));}
    }
    for(const q of s.bullets)if(nearby(q.x,q.z))out.push(m('sphere',[q.x,q.y,q.z],[.2,.2,.2],6,[0,0,0],2.6));
    for(const q of s.particles)if(nearby(q.x,q.z)){const v=Math.min(.11,q.life*.17);out.push(m('box',[q.x,q.y,q.z],[v,v,v],q.kind,[t,t,0],1.6));}
    if(s.pulseVisual>0){
      const progress=1-s.pulseVisual/.65,r=.3+progress*6.2;
      out.push(m('ring',[p.x,(p.y||0)+.16,p.z],[r*2,.13,r*2],4,[0,0,0],1.7*(1-progress)));
      if(progress<.65)out.push(m('ring',[p.x,(p.y||0)+.7,p.z],[r*1.7,.08,r*1.7],4,[0,0,0],.8));
    }
    // Both characters exist in the world: the active one is seen from outside
    // in third person, and the parked partner waits where it was left.
    if(playing&&s.profiles){
      const active=s.activeProfile==='light'?'light':'heavy',other=active==='light'?'heavy':'light',parked=s.profiles[other]?.position,loc=s.locomotion||{},backend=renderer.stats.backend;
      const character=(id,pose,live)=>{
        const distance=Math.hypot(pose.x-camera.pos[0],(pose.y||0)+1.4-camera.pos[1],pose.z-camera.pos[2]),weapon=live?s.weapon:s.profiles[id]?.weapon;
        if(id==='light')out.push(...MetalAvatars.drone(pose,{time:t,weapon,forward:live?loc.forward:0,strafe:live?loc.strafe:0,boosting:live&&!!s.jetpack?.active,flash:live?Math.max(s.flash||0,s.leftFlash||0):0,quality,backend,seed:live?0:2.1}));
        else out.push(...MetalAvatars.heavy(pose,{time:t,weapon,speed:live?loc.speed:0,phase:live?(avatarGait.back?-1:1)*(loc.stridePhase||0):0,blend:live?loc.moveBlend:0,legYaw:live?avatarGait.legYaw:0,distance,flash:live?s.flash:0,quality,backend}));
      };
      if(thirdPerson)character(active,p,true);
      if(parked&&nearby(parked.x,parked.z))character(other,parked,false);
    }else if(playing&&thirdPerson)out.push(...MetalAvatars.heavy(p,{time:t,weapon:s.weapon,speed:s.locomotion?.speed,phase:s.locomotion?.stridePhase,blend:s.locomotion?.moveBlend,distance:3,flash:s.flash,quality,backend:renderer.stats.backend}));
    if(playing&&!thirdPerson){
      // The drone carries the same weapon on two mounts and has no hands.
      const twin=s.activeProfile==='light',left=twin?null:s.equipment?.left??null,paired=twin||left!==null;
      function drawGun(weapon,hand){
      const fracture=weapon===1,rocket=weapon===2,grenade=weapon===3,pistol=weapon===4,pose=(hand<0?leftMotion:motion).view.weapon,slide=pose.slide,flash=hand<0?(s.leftFlash||0):s.flash;
      const grip=FMotion.mount(camera,[hand*.255*Math.min(1,Math.max(.45,(innerWidth/innerHeight)/1.2))+pose.offset[0]*hand,(paired?-.34:-.30)+pose.offset[1],(paired?-.70:-.62)+pose.offset[2]],[pose.rotation[0],pose.rotation[1]*hand,pose.rotation[2]*hand]);
      function gun(shape,x,y,z,siz,mat,rx=0,em=0,color){
        const part=FMotion.place(grip,[x*hand,y,z],rx),a=m(shape,part.p,siz,mat,part.r,em);a.overlay=true;a.surface='object';
        if(color)a.color=color;else if(mat===0)a.color=[.16,.19,.21];else if(mat===1)a.color=[.37,.35,.28];
        out.push(a);
      }
      if(twin){
        // Cannon pylon and cyan strip of the drone mount instead of a glove.
        gun('bevel',0,.17,.12,[.11,.11,.26],0,0,0,[.62,.67,.68]);gun('box',0,.235,.10,[.025,.015,.20],4,0,.8,[.44,.9,.8]);
      }else{
      gun('bevel',0,-.09,.12,[.15,.24,.16],7,-.2);
      // A gloved grip and its wrist remain attached to the complete, damped weapon assembly.
      gun('bevel',.013,-.2,.21,[.17,.11,.21],7,-.2);gun('box',.013,-.16,.2,[.18,.025,.18],0,-.2);
      gun('bevel',.018,-.27,.30,[.15,.17,.24],0,-.25,0,[.26,.28,.23]);
      for(let j=0;j<4;j++)gun('box',0,-.035-j*.031,.205,[.16,.023,.042],7,-.2);
      gun('box',-.087,-.07,.15,[.04,.09,.09],7,-.5);
      }
      if(pistol){
        // Compact slide, exposed barrel, serrations and sights share the hand frame.
        const bolt=slide*1.4;
        gun('bevel',0,.035,.015,[.145,.12,.40],0,0,0,[.23,.29,.32]);
        gun('bevel',0,.112,-.015+bolt,[.148,.075,.43],0,0,0,[.38,.43,.44]);
        gun('box',0,.157,-.02+bolt,[.095,.018,.34],7);
        gun('cylinder',0,.074,-.237,[.068,.075,.068],1,Math.PI/2);
        gun('cylinder',0,.074,-.279,[.044,.012,.044],7,Math.PI/2);
        gun('ring',0,.074,-.285,[.071,.014,.071],0,Math.PI/2);
        gun('bevel',0,-.10,.115,[.116,.25,.15],7,-.18);
        gun('box',-.076,.092,.047+bolt,[.006,.043,.089],7);
        gun('box',-.078,.105,.053+bolt,[.008,.014,.052],1);
        gun('box',.078,.014,.112,[.012,.029,.061],1);
        gun('box',0,.189,-.211,[.019,.048,.025],4,0,.28);
        for(const side of [-1,1]){
          for(let j=0;j<5;j++)gun('box',side*.076,.108,.085+j*.017+bolt,[.008,.056,.007],7);
          gun('box',side*.062,-.106,.136,[.009,.15,.085],0,-.18,0,[.25,.28,.24]);
          gun('sphere',side*.068,-.15,.127,[.009,.014,.014],1);
        }
        if(flash>.2){gun('octa',0,.074,-.32,[.075+flash*.055,.075+flash*.055,.12+flash*.16],5,0,2.2);gun('sphere',0,.074,-.307,[.045,.045,.065],4,0,2.8);}
      }else if(rocket){
        // A complete reusable launch tube; all collars, sights and the bore share its frame.
        gun('cylinder',0,.07,-.08,[.295,.96,.295],0,Math.PI/2,0,[.23,.28,.23]);
        gun('bevel',0,-.04,.08,[.25,.20,.36],0);gun('bevel',0,-.17,.01,[.12,.25,.14],7,-.14);
        gun('cylinder',0,.07,.40,[.35,.075,.35],1,Math.PI/2);
        gun('cylinder',0,.07,-.56,[.36,.09,.36],0,Math.PI/2);
        gun('cylinder',0,.07,-.608,[.25,.014,.25],7,Math.PI/2);
        gun('ring',0,.07,-.618,[.28,.026,.28],1,Math.PI/2);
        gun('box',0,.245,.06,[.11,.03,.40],0);gun('box',0,.29,.18,[.08,.10,.045],0);
        gun('box',0,.29,-.12,[.025,.085,.025],5,0,.18);
        if(!paired){gun('bevel',-.075,-.15,-.29,[.20,.10,.23],7,.12);gun('box',-.075,-.205,-.27,[.19,.06,.18],0,.12);}
        for(const side of [-1,1]){
          gun('box',side*.15,.06,-.05,[.022,.045,.33],1);gun('box',side*.157,.12,.12,[.018,.025,.11],5,0,.18);
          for(let j=0;j<4;j++)gun('box',side*.151,.025,-.20+j*.09,[.018,.04,.035],7);
        }
        for(let j=0;j<3;j++)gun('ring',0,.07,-.37+j*.28,[.31,.026,.31],0,Math.PI/2);
        if(flash>.2){gun('octa',0,.07,-.70,[.17+flash*.15,.17+flash*.15,.35+flash*.35],5,0,2.8);gun('octa',0,.07,.47,[.14,.14,.25],5,0,1.7);}
      }else if(grenade){
        gun('bevel',0,.01,.09,[.24,.21,.35],0);gun('box',0,.14,-.07,[.15,.045,.46],1);
        gun('cylinder',0,-.015,-.15,[.34,.23,.34],0,Math.PI/2,0,[.24,.26,.20]);
        for(let j=0;j<6;j++){const angle=j*Math.PI/3+slide*5;gun('cylinder',Math.cos(angle)*.125,-.015+Math.sin(angle)*.125,-.15,[.075,.25,.075],1,Math.PI/2);gun('sphere',Math.cos(angle)*.125,-.015+Math.sin(angle)*.125,-.014,[.055,.055,.025],5,0,.12);}
        for(const z of [-.28,-.015])gun('ring',0,-.015,z,[.36,.035,.36],1,Math.PI/2);
        gun('cylinder',0,.035,-.43+slide*.2,[.15,.34,.15],0,Math.PI/2);gun('ring',0,.035,-.61+slide*.2,[.19,.045,.19],1,Math.PI/2);gun('cylinder',0,.035,-.615+slide*.2,[.12,.018,.12],7,Math.PI/2);
        gun('box',0,.19,-.23,[.035,.055,.04],5,0,.3);gun('box',-.13,.04,.13,[.035,.055,.12],7);gun('box',.13,.035,.13,[.025,.07,.16],1);
        if(flash>.2)gun('octa',0,.035,-.67,[.17+flash*.1,.17+flash*.1,.23+flash*.2],5,0,2.2);
      }else if(fracture){
        gun('bevel',0,0,.01,[.255,.21,.53],0);gun('bevel',0,.124,.03+slide,[.24,.045,.3],1);
        gun('box',0,-.07,-.3,[.29,.09,.22],7);
        if(!paired){gun('bevel',-.06,-.13,-.26,[.2,.08,.2],7,.1);gun('box',-.06,-.17,-.24,[.19,.04,.18],0,.1);}
        for(const side of [-1,1]){
          gun('cylinder',side*.082,.01,-.33+slide*.35,[.135,.38,.135],0,Math.PI/2);
          gun('cylinder',side*.082,.01,-.52+slide*.35,[.16,.055,.16],1,Math.PI/2);
          gun('cylinder',side*.082,.01,-.552+slide*.35,[.095,.015,.095],7,Math.PI/2);
          gun('box',side*.135,.025,.04,[.014,.026,.18],p.overheated?6:5,0,.4);
          for(let j=0;j<3;j++)gun('box',side*.147,.08,-.1+j*.06,[.018,.018,.032],7);
          if(flash>.2)gun('octa',side*.082,.01,-.59,[.16+flash*.13,.16+flash*.13,.24+flash*.3],5,0,2.6);
        }
        gun('box',0,.17,-.13,[.04,.04,.04],5,0,.25);
      }else{
        gun('bevel',0,0,-.03,[.19,.175,.52],0);gun('bevel',0,.105,.04+slide,[.15,.04,.27],1);
        gun('box',-.098,.025,-.04,[.012,.021,.22],p.overheated?6:4,0,.4);gun('box',.098,.025,-.04,[.012,.025,.22],1);
        gun('cylinder',0,.01,-.34+slide*.3,[.112,.24,.112],0,Math.PI/2);gun('cylinder',0,.01,-.47+slide*.3,[.14,.045,.14],1,Math.PI/2);
        gun('cylinder',0,.01,-.497+slide*.3,[.085,.015,.085],7,Math.PI/2);gun('box',0,.14,-.13,[.035,.04,.035],4,0,.25);
        for(let j=0;j<5;j++)gun('box',0,.13,-.04+j*.037+slide,[.13,.012,.012],7);
        // Recessed bolt, ejection port and charging handle break up the receiver.
        gun('box',-.100,.04,.11,[.006,.047,.11],7);gun('box',-.104,.044,.09+slide,[.008,.024,.055],1);
        gun('box',-.125,.058,.14+slide,[.06,.025,.035],0);
        if(flash>.2)gun('octa',0,.01,-.53,[.12+flash*.12,.12+flash*.12,.15+flash*.25],5,0,2.5);
      }
      if(quality!=='low'){
        for(const side of [-1,1])for(const z of [.16,-.08])gun('sphere',side*(rocket?.151:fracture?.132:grenade?.125:pistol?.072:.098),-.043,z,[.012,.018,.018],3);
        if(!rocket&&!pistol){gun('bevel',0,-.17,.03,[.095,.22,.12],0,-.12);for(let j=0;j<4;j++)gun('box',0,-.1-j*.04,.093,[.10,.009,.009],1,-.12);}
      }
      // Open rear sight and paired fasteners remain geometry, with no image maps.
      if(!rocket)for(const side of [-1,1]){
        gun('box',side*.053,.173,.17,[.022,.072,.028],0);gun('sphere',side*(fracture?.13:pistol?.073:.097),-.036,.17,[.012,.024,.024],1);
      }
      if(!rocket)gun('box',0,.139,.17,[.125,.025,.036],0);
      gun('box',-.035,-.108,.1,[.09,.018,.13],0);gun('box',-.035,-.16,.08,[.09,.013,.05],0);
      for(let j=0;j<3;j++)gun('box',rocket?.165:fracture?.143:pistol?.078:.108,-.045,.1-j*.037,[.014,.016,.023],p.overheated?6:j/3<p.heat?5:0,0,j/3<p.heat?.6:0);
      }
      drawGun(s.weapon,1);
      if(twin)drawGun(s.weapon,-1);else if(Number.isInteger(left))drawGun(left,-1);
    }
    return out;
  }
  // Same model range as the renderer approach; shared with the partner marker.
  function drawRange(longView){return longView?100:renderer.stats.backend==='canvas2d'?(quality==='high'?55:quality==='low'?32:44):(quality==='high'?90:quality==='low'?54:70);}
  // Horde arrivals drawn by models() for a moment (see hordeSpawn).
  const hordeFlashes=[];
  // Breaks raise a cloud of dust coloured by the material, which hides the
  // material that became dust rather than pieces; bullets on metal throw
  // sparks (David, 16/11/2026). Display only, never simulated.
  const bursts=[],DUST={stone:[.56,.53,.48],wood:[.43,.34,.23],metal:[.30,.31,.33],glass:[.70,.76,.80],dirt:[.42,.35,.26]};
  function burstModels(out,now,near){
    let budget=quality==='low'?28:64;
    for(const b of bursts){
      const age=now-b.t;if(age<0||!near(b.x,b.z))continue;
      const color=DUST[b.material]||DUST.stone,hash=k=>{const v=Math.sin(b.seed*12.9898+k*78.233)*43758.5453;return v-Math.floor(v);};
      if(b.big&&age<2.4){
        const count=quality==='low'?3:5,k=age/2.4,size=(.9+Math.min(2.2,b.power/20))*(.55+k*1.1);
        for(let i=0;i<count&&budget>0;i++,budget--){const a=hash(i)*Math.PI*2,r=size*.45*(.4+hash(i+9)),m=FRender.mesh('sphere',[b.x+Math.cos(a)*r,b.y-.3+k*1.4+hash(i+3)*.4,b.z+Math.sin(a)*r],[size*(.7+hash(i+5)*.5),size*(.55+hash(i+7)*.3),size*(.7+hash(i+6)*.5)],7,[0,a,0],0);m.color=color;m.fx=true;m.fxSmoke=true;m.alpha=.34*(1-k)*(1-k);m.effectPart='break-dust';out.push(m);}
      }
      if(b.material==='metal'&&age<.32){
        const count=b.big?7:4,k=age/.32;
        for(let i=0;i<count&&budget>0;i++,budget--){const a=hash(i+11)*Math.PI*2,up=.4+hash(i+13)*1.2,speed=3+hash(i+17)*4,d=speed*age,m=FRender.mesh('box',[b.x+Math.cos(a)*d,b.y+up*d-4.5*age*age,b.z+Math.sin(a)*d],[.025,.025,.11],5,[up*.7,-a+Math.PI/2,0],2.2*(1-k));m.color=[1,.62,.2];m.fx=true;m.fxSpark=true;m.alpha=.95*(1-k);m.effectPart='impact-spark';out.push(m);}
      }
    }
  }
  function renderHUD(){
    const profile=sim.state.activeProfile,jet=sim.state.jetpack,profileButton=$('profile-button');profileButton.hidden=!profile;
    $('jump-button').textContent=profile==='light'?'MONTER':'SAUT';$('jump-button').setAttribute('aria-label',profile==='light'?'Monter en vol':'Sauter');
    if(profile){
      const target=profile==='light'?'lourd':'léger',shortcut=bindingLabel('switchProfile');profileButton.dataset.profile=profile;
      $('profile-active-label').textContent=profile==='light'?'LÉGER':'LOURD';
      $('profile-resource').textContent=profile==='light'?Math.round(100*jet.fuel/jet.capacity)+' % BOOST':'EXPLOSIFS';
      $('profile-action').textContent='Passer au '+target;$('profile-shortcut').textContent=shortcut;
      profileButton.setAttribute('aria-label','Personnage actif : '+(profile==='light'?'léger':'lourd')+'. Passer au '+target+(touch?'':'. Raccourci : '+shortcut));profileButton.title='Changer de personnage'+(touch?'':' · '+shortcut);
    }
    const s=sim.state,p=s.player;
    const stats=sim.stats||{maxHp:100},maxHp=s.maxHp||stats.maxHp||100,healthRatio=p.hp/maxHp;
    $('hp').textContent=String(Math.ceil(p.hp));$('health-max').textContent='/ '+maxHp;$('hp-bar').style.width=clamp(healthRatio*100,0,100)+'%';$('hp-bar').style.background=healthRatio<.3?'#ff795e':'var(--acid)';
    $('health-state').textContent=healthRatio<.25?'INTÉGRITÉ CRITIQUE':healthRatio<.55?'STRUCTURE ENDOMMAGÉE':'SYSTÈMES OPÉRATIONNELS';$('health-panel').classList.toggle('critical',healthRatio<.25);$('armor-rating').textContent='BLINDAGE '+Math.round((1-(stats.incomingMultiplier??1))*100)+' %';
    const armor=s.armor;
    $('armor-pool').hidden=!armor;$('health-state').hidden=!!armor;$('armor-rating').hidden=!!armor;
    if(armor){$('armor-points').textContent=String(Math.ceil(armor.points));$('armor-cap').textContent='/ '+armor.capacity;$('armor-bar').style.width=clamp(armor.points/armor.capacity*100,0,100)+'%';$('armor-pool').title='Plaques à ramasser · absorbe un tiers des dégâts · blindage passif '+Math.round((1-(stats.incomingMultiplier??1))*100)+' %';$('armor-pool').setAttribute('aria-label','Armure : '+Math.ceil(armor.points)+' sur '+armor.capacity);document.body.dataset.armor=String(Math.ceil(armor.points));}
    $('wallet-credits').textContent=String(s.economy?.credits||0);$('wallet-cores').textContent=String(s.economy?.cores||0);
    $('heat-bar').style.width='100%';$('heat-bar').style.transform='scaleX('+p.heat+')';$('heat-bar').style.background=p.overheated?'#ff795e':s.weapon===2?'#ee8d5d':s.weapon===1?'#e8ad66':'#6ce5d2';
    const weaponRank=s.economy?.weaponUpgrades?.[s.weapon]||0,weaponName=profile==='heavy'&&s.weapon===4?'Pistolet automatique':weaponNames[s.weapon];$('weapon-label').textContent=weaponName.toUpperCase()+(profile==='light'?' ×2':'')+(weaponRank?' · R'+weaponRank:'');$('weapon-switch').setAttribute('aria-label','Arme actuelle : '+weaponNames[s.weapon]+'. Changer d’arme.');
    const inventory=s.inventory,owned=(inventory?.weapons||[true,true,true]).map((has,i)=>has&&(!profile||MetalProfiles.allowed(profile,i))),ammo=inventory?.ammo?.[s.weapon],limited=!!world.progression,infinite=world.campaign&&s.weapon===4;
    $('ammo-count').textContent=infinite?'∞':limited?String(ammo??0).padStart(2,'0'):'—';$('ammo-unit').textContent=ammoNames[s.weapon].toUpperCase();$('ammo-cap').textContent=infinite?'ILLIMITÉES':limited?'/ '+sim.ammoCaps[s.weapon]:'RÉSERVE';
    $('weapon-readout').classList.toggle('empty',!infinite&&limited&&ammo===0);$('heat-status').textContent=p.overheated?'REFROIDISSEMENT':!infinite&&limited&&ammo===0?'RÉSERVE ÉPUISÉE':p.heat>=.75?'SURCHAUFFE PROCHE':'CHALEUR';
    $('arsenal-count').textContent=owned.filter(Boolean).length+' / '+owned.length+(profile?' · NV '+MetalProfiles.level(s.profiles[profile].xp)+' · '+s.profiles[profile].xp+' XP':'');
    const left=s.equipment?.left??null,leftHeat=Number.isInteger(left)?s.weaponHeat?.[left]??p.heat:0,leftHot=Number.isInteger(left)?s.weaponOverheated?.[left]??p.overheated:false;
    $('left-heat').hidden=left===null;$('left-heat').setAttribute('aria-valuenow',String(Math.round(leftHeat*100)));$('left-heat-bar').style.transform='scaleX('+leftHeat+')';$('left-heat-bar').style.background=leftHot?'#ff795e':'#71e1cc';
    $('left-fire-button').style.setProperty('--left-heat',leftHeat*100+'%');$('left-fire-button').classList.toggle('overheated',leftHot);
    $('weapon-slots').style.gridTemplateColumns='repeat('+(world.campaign?Math.max(1,owned.filter(Boolean).length):4)+',minmax(0,1fr))';
    for(let i=0;i<5;i++){
      const slot=$('weapon-slot-'+i),unlimited=world.campaign&&i===4;slot.hidden=i>=owned.length||!!world.campaign&&!owned[i];slot.disabled=!owned[i];slot.classList.toggle('locked',!owned[i]);slot.classList.toggle('selected',i===s.weapon);slot.classList.toggle('overheated',!!s.weaponOverheated?.[i]);slot.setAttribute('aria-pressed',String(i===s.weapon));
      slot.dataset.hand=i===s.weapon?'right':i===left?'left':'';$('slot-hand-'+i).textContent=i===s.weapon?(profile==='light'?'×2':'D'):i===left?'G':'';
      slot.setAttribute('aria-label',weaponNames[i]+(owned[i]?(unlimited?' · munitions illimitées':limited?' · '+inventory.ammo[i]+' '+ammoNames[i]:'')+(i===s.weapon?' · main droite':i===left?' · main gauche':''):' · à trouver'));
      $('slot-ammo-'+i).textContent=owned[i]?(unlimited?'∞':limited?String(inventory.ammo[i]):'PRÊTE'):'À TROUVER';$('slot-key-'+i).textContent=FOptions.keyName(prefs.bindings['weapon'+(i+1)]?.[0]||'Digit'+(i+1));
      $('left-option-'+i).disabled=!owned[i]||i===s.weapon;$('left-option-'+i).hidden=slot.hidden;
    }
    $('left-hand-setting').disabled=!sim.selectLeftWeapon||profile==='light';$('left-hand-setting').value=left===null?'none':String(left);
    $('left-hand-key').textContent=FOptions.keyName(prefs.bindings.leftHand[0]);$('left-hand-stock').textContent=profile==='light'?'CANONS JUMEAUX':world.campaign&&left===4?'∞ BALLES':Number.isInteger(left)?String(inventory.ammo[left])+' '+ammoNames[left]:'LIBRE';
    $('left-hand-status').textContent=profile==='light'?'LES DEUX CANONS TIRENT ENSEMBLE':leftHot?'REFROIDISSEMENT':leftHeat>=.75?'SURCHAUFFE PROCHE':left!==null?(touch?'TIR G · MAINTENIR':'CLIC DROIT · TIR'):(touch?'CHOISISSEZ UN ÉQUIPEMENT':'X · CHANGER');
    $('left-fire-button').disabled=left===null&&profile!=='light';$('left-fire-button').setAttribute('aria-label',profile==='light'?'Tirer avec les deux canons':'Tirer avec la main gauche'+(leftHot?' — refroidissement':''));$('left-fire-label').textContent='TIR G';
    $('dash-button').setAttribute('aria-label',profile==='light'?'Descendre en vol':'Esquiver');const dashIcon=$('dash-button').firstElementChild;if(dashIcon)dashIcon.textContent=profile==='light'?'↓':'';
    $('melee-label').textContent=FOptions.keyName(prefs.bindings.melee[0]).toUpperCase()+' · CROSSE';
    $('dash-label').textContent=profile==='light'?bindingLabel('jump')+' ↑ · '+bindingLabel('dash')+' ↓ · '+bindingLabel('sprint')+' BOOST':p.dash>0?'ESQUIVE · '+p.dash.toFixed(1)+' s':FOptions.keyName(prefs.bindings.dash[0]).toUpperCase()+' · ESQUIVE PRÊTE';$('dash-button').style.opacity=profile!=='light'&&p.dash>0?'.35':'1';
    const pulse=p.pulseCooldown||0;$('pulse-label').textContent=pulse>0?'ONDE · '+pulse.toFixed(1)+' s':FOptions.keyName(prefs.bindings.pulse[0]).toUpperCase()+' · ONDE PRÊTE';$('pulse-button').style.opacity=pulse>0?'.35':'1';
    $('relay-count').textContent=s.relays+' / 3';$('relays').querySelectorAll('i').forEach((el,i)=>el.classList.toggle('on',i<s.relays));
    const required=(s.mechanisms||[]).filter(a=>a.required),activated=required.filter(a=>a.active).length,operational=activated===required.length;
    $('mechanism-count').textContent=activated+' / '+required.length;$('enemy-count').textContent=s.kills+' / '+s.enemies.length;
    const bossReward=pendingBossReward();$('objective-label').textContent=bossReward?'RÉCUPÉRER LE BUTIN DU BOSS':!operational?'ACTIVER LES COMMANDES':s.relays===3?(s.bossAlive?'NEUTRALISER LE GARDIEN':'REJOINDRE LA SORTIE'):'RÉCUPÉRER LES RELAIS';
    const encounters=(s.encounters||[]).filter(c=>c.status!=='dormant'&&Math.hypot((c.trigger?.x??0)-p.x,(c.trigger?.z??0)-p.z)<(c.leashRadius||38)+10).sort((a,b)=>Number(a.status==='cleared')-Number(b.status==='cleared')||Math.hypot(a.trigger.x-p.x,a.trigger.z-p.z)-Math.hypot(b.trigger.x-p.x,b.trigger.z-p.z)),current=encounters[0];
    $('wave-status').hidden=!current;$('wave-status').dataset.state=current?.status||'';
    if(current){$('wave-label').textContent=current.label||'ZONE DE COMBAT';$('wave-count').textContent=current.status==='cleared'?'ZONE SÉCURISÉE':'VAGUE '+(Math.max(current.wave,current.pendingWave)+1)+' / '+current.waves.length;$('wave-detail').textContent=current.status==='cleared'?'RÉCUPÉREZ LES RÉSERVES':current.status==='warning'?'RENFORTS EN APPROCHE':current.status==='waiting'?'SURVEILLEZ LES ACCÈS':current.horde?current.remaining+' MACHINE'+(current.remaining===1?'':'S')+' RESTANTE'+(current.remaining===1?'':'S'):current.active+' CONTACT'+(current.active===1?'':'S')+' ACTIF'+(current.active===1?'':'S');}
    const trophyGrace=s.campaign?.trophies.find(q=>q.phase==='grace');
    if(trophyGrace){$('wave-status').hidden=false;$('wave-status').dataset.state='trophy';$('wave-label').textContent='TROPHÉE ACQUIS';$('wave-count').textContent='ÉPREUVE DANS '+Math.max(1,Math.ceil(trophyGrace.timer))+' S';$('wave-detail').textContent='PRÉPAREZ VOTRE NOUVEL ÉQUIPEMENT';}
    $('score').textContent=String(Math.round(runStats.score+(s.score||0))).padStart(5,'0');$('combo').textContent=s.combo>1?'SÉRIE × '+s.combo:'SIGNAL STABLE';$('combo').classList.toggle('active',s.combo>1);
    const boss=s.enemies.find(e=>e.type===3&&e.hp>0),bossVisible=!!boss&&(boss.bossScale>1?boss.bossAwake&&(Math.hypot(boss.x-p.x,boss.z-p.z)<120):boss.active||boss.hp<boss.maxHp||Math.hypot(boss.x-p.x,boss.z-p.z)<22);
    $('boss-status').hidden=!bossVisible;document.body.dataset.boss=String(bossVisible);
    if(bossVisible){
      const joints=Array.isArray(boss.joints)?boss.joints.filter(v=>v>0).length:-1;
      $('boss-bar').style.width=boss.hp/boss.maxHp*100+'%';$('boss-name').textContent=boss.bossName||'LE GARDIEN';$('boss-health').textContent=Math.ceil(boss.hp)+' / '+boss.maxHp+' PV'+(joints>=0?' · '+joints+'/4 ARTICULATIONS':'');
      $('boss-phase').textContent=boss.weakPointOpen?(joints>=0?'ARTICULATIONS EXPOSÉES · ':'CŒUR EXPOSÉ · ')+Math.max(0,boss.weakTimer||0).toFixed(1)+' S':'PHASE '+((boss.phase||0)+1)+(boss.bossScale>1?' / 3':'');
      $('boss-attack').textContent=boss.weakPointOpen?(joints<0?'VISEZ LE CŒUR LUMINEUX':joints?'VISEZ LES ARTICULATIONS LUMINEUSES':'ACHEVEZ LE CŒUR À NU'):boss.attackLabel||'DÉFENSE ACTIVE';$('boss-status').classList.toggle('vulnerable',!!boss.weakPointOpen);
    }
    const tell=(s.bossAttacks||[]).filter(a=>a.warning).sort((a,b)=>(a.tell-a.age)-(b.tell-b.age))[0];$('boss-cue').hidden=!bossVisible||!tell;
    if(tell){const remaining=Math.max(0,tell.tell-tell.age),jump=tell.kind==='ring'||tell.kind==='sweep';$('boss-cue-text').textContent=(jump?'↑ SAUT / ESQUIVE':'↗ SORTIR DE LA ZONE')+' · '+remaining.toFixed(1)+' s';$('boss-cue-progress').style.strokeDashoffset=String(81.682*(1-remaining/tell.tell));const angle=Math.atan2(tell.x-p.x,p.z-tell.z)-p.yaw;$('boss-cue-arrow').style.transform='rotate('+angle+'rad)';$('boss-cue').dataset.kind=tell.kind;}
    document.body.dataset.relays=String(s.relays);document.body.dataset.health=String(Math.ceil(p.hp));document.body.dataset.weapon=String(s.weapon);document.body.dataset.score=String(Math.round(s.score||0));
    $('crosshair').classList.toggle('fracture',s.weapon===1);
    $('crosshair').classList.toggle('rocket',s.weapon===2||s.weapon===3);
    document.body.dataset.ammo=String(ammo??0);
    const supply=[...s.pickups,...(s.loot||[])].filter(c=>supplyVisible(c)&&Math.abs((c.y||0)-p.y)<1.1&&Math.hypot(c.x-p.x,c.z-p.z)<3.7).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).find(c=>{const a=[p.x,p.y+1.3,p.z],b=[c.x,(c.y||0)+.4,c.z],d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d)||1;return sim.ray(a,d.map(v=>v/length),length)>=length-.2;});
    $('supply-hint').hidden=!supply;
    if(supply){const kind=supply.kind||supply.type||'health',weapon=supply.weapon||0,salvage=kind==='salvage'||kind==='boss'||kind==='resupply',full=kind==='health'?p.hp>=maxHp:kind==='armor'?!s.armor||s.armor.points>=s.armor.capacity:salvage?supply.rewardTaken!==false&&!supply.credits&&!supply.cores&&(!supply.armor||!s.armor||s.armor.points>=s.armor.capacity)&&supply.ammo.every((n,i)=>!n||(inventory?.ammo[i]??0)>=sim.ammoCaps[i]):kind==='weapon'&&!owned[weapon]?false:inventory?.ammo[weapon]>=sim.ammoCaps?.[weapon];$('supply-name').textContent=kind==='armor'?'PLAQUES D’ARMURE':kind==='weapon'?weaponNames[weapon].toUpperCase():kind==='ammo'?ammoNames[weapon].toUpperCase():kind==='boss'?'BUTIN DU COLOSSE':kind==='resupply'?'RAVITAILLEMENT':salvage?'FERRAILLE & RÉSERVES':'INTÉGRITÉ';$('supply-detail').textContent=supply.rewardTaken===false?[Number.isInteger(supply.weapon)?weaponNames[supply.weapon]:'',supply.weaponUpgradeLabel,supply.personalUpgradeLabel].filter(Boolean).join(' · '):full?'RÉSERVE AU MAXIMUM':kind==='weapon'&&!owned[weapon]?'ARME À RÉCUPÉRER':'AVANCEZ POUR RAMASSER';}
    const bossTarget=s.relays===3&&operational&&boss;
    const targets=s.relays===3&&operational?[bossReward||bossTarget||world.exit]:[...required.filter(a=>!a.active),...s.cores.filter(c=>!c.taken)],target=targets.reduce((a,c)=>!a||Math.hypot(c.x-p.x,c.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?c:a,null);
    if(target){
      const mechanism=required.includes(target),delta=(target.baseY??target.y??0)-(p.y||0);
      $('target-label').textContent=mechanism?'COMMANDE':s.relays===3&&operational?(bossReward?'BUTIN DU BOSS':bossTarget?'GARDIEN':'SORTIE'):'RELAIS';
      $('target-symbol').textContent=mechanism?'▣':'◇';$('target-distance').textContent=Math.round(Math.hypot(target.x-p.x,target.z-p.z))+' m'+(Math.abs(delta)>1?' · '+(delta>0?'+':'')+Math.round(delta)+' m':'');
      const angle=Math.atan2(target.x-p.x,p.z-target.z)-p.yaw;$('target-arrow').style.transform='rotate('+angle+'rad)';
    }
    const action=sim.nearestInteraction?.();
    if(action)$('supply-hint').hidden=true;
    $('interact-button').hidden=!action;$('interact-button').disabled=!!action?.disabled;
    $('interaction-label').textContent=action?.label||'INTERAGIR';$('interaction-reason').textContent=action?.reason||'';
    $('interact-button').setAttribute('aria-label',action?(action.label+(action.reason?' — '+action.reason:'')):'Interagir');
    $('altitude').textContent='ALT. '+(p.y||0).toFixed(1).replace('.',',')+' m';
    const room=world.rooms.find(r=>Math.abs(p.x-r.x)<r.w/2&&Math.abs(p.z-r.z)<r.d/2);$('room-name').textContent=room?room.name:isOutdoors(p.x,p.z)?'CHEMIN DE LIAISON':'COULOIR DE LIAISON';
    drawRadar();
  }
  function renderPartner(camera){
    const node=$('partner-marker'),s=sim.state,id=s.activeProfile==='light'?'heavy':'light',other=s.profiles?.[id]?.position;
    node.hidden=!other||mode!=='playing'||loadoutOpen;if(node.hidden)return;
    const q=MetalProfiles.marker({x:camera.pos[0],y:camera.pos[1]-1.62,z:camera.pos[2],yaw:camera.yaw,pitch:camera.pitch},other,{width:document.documentElement?.clientWidth||innerWidth,height:document.documentElement?.clientHeight||innerHeight,fov:camera.fov});
    // The parked heavy or drone is drawn whole where it was left (David,
    // 16/11/2026): the marker only helps to find it off screen, out of the
    // drawing range or behind a wall.
    const centre=[other.x,(other.y||0)+(id==='light'?1.42:1.1),other.z],toward=centre.map((v,k)=>v-camera.pos[k]),length=Math.hypot(...toward)||1;
    const seen=!q.offscreen&&Math.hypot(other.x-s.player.x,other.z-s.player.z)<drawRange(false)&&sim.ray(camera.pos,toward.map(v=>v/length),length)>=length-.6;
    node.hidden=seen||q.distance<1.5;if(node.hidden)return;
    node.style.left=q.x+'px';node.style.top=q.y+'px';node.dataset.profile=id;node.dataset.offscreen=String(q.offscreen);
    node.textContent=q.direction+' '+(id==='light'?'LÉGER':'LOURD')+' · '+Math.round(q.distance)+' m'+(Math.abs(q.height)>1.5?' · '+(q.height>0?'↑':'↓')+Math.round(Math.abs(q.height))+' m':'');
    node.setAttribute('aria-label',(id==='light'?'Personnage léger':'Personnage lourd')+' en attente à '+Math.round(q.distance)+' mètres');
  }
  function drawRadar(){
    if($('radar-wrap').hidden)return;
    const ctx=$('radar').getContext('2d'),b=world.bounds,k=160/Math.max(b.maxX-b.minX,b.maxZ-b.minZ),X=x=>10+(x-b.minX)*k,Z=z=>10+(z-b.minZ)*k;
    ctx.clearRect(0,0,180,180);ctx.fillStyle='#8caf9320';ctx.strokeStyle='#779d7c77';ctx.lineWidth=.8;
    for(const r of [...(world.corridors||[]),...world.rooms]){ctx.fillStyle=r.outdoor?'#829c4b22':'#8caf9320';ctx.strokeStyle=r.outdoor?'#90ae5e66':'#779d7c77';ctx.fillRect(X(r.x-r.w/2),Z(r.z-r.d/2),r.w*k,r.d*k);ctx.strokeRect(X(r.x-r.w/2),Z(r.z-r.d/2),r.w*k,r.d*k);}
    for(const c of sim.state.cores){ctx.fillStyle=c.taken?'#567260':'#d7f36b';ctx.save();ctx.translate(X(c.x),Z(c.z));ctx.rotate(Math.PI/4);ctx.fillRect(-2.5,-2.5,5,5);ctx.restore();}
    for(const a of sim.state.mechanisms||[]){ctx.strokeStyle=a.active?'#71e1cc':'#efb26d';ctx.lineWidth=1.1;ctx.strokeRect(X(a.x)-2.5,Z(a.z)-2.5,5,5);if(a.active){ctx.fillStyle='#71e1cc';ctx.fillRect(X(a.x)-1,Z(a.z)-1,2,2);}}
    for(const a of sim.state.lifts||[]){ctx.strokeStyle=a.powered?'#71e1cc':'#759284';ctx.beginPath();ctx.moveTo(X(a.x)-2.5,Z(a.z)+2);ctx.lineTo(X(a.x),Z(a.z)-2);ctx.lineTo(X(a.x)+2.5,Z(a.z)+2);ctx.stroke();}
    for(const a of world.jumpPads||[]){ctx.fillStyle='#71e1cc';ctx.fillRect(X(a.x)-1.5,Z(a.z)-1.5,3,3);}
    for(const a of world.shops||[]){ctx.strokeStyle='#b2daf2';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(X(a.x)-2.5,Z(a.z));ctx.lineTo(X(a.x)+2.5,Z(a.z));ctx.moveTo(X(a.x),Z(a.z)-2.5);ctx.lineTo(X(a.x),Z(a.z)+2.5);ctx.stroke();}
    for(const a of world.trophies||[]){const state=sim.state.campaign?.trophies.find(q=>q.id===a.id);ctx.strokeStyle=state?.phase==='sealed'?'#ffcf78':'#71e1cc';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(X(a.x),Z(a.z),3.5,0,Math.PI*2);ctx.stroke();if(state?.phase==='sealed'){ctx.fillStyle='#ffcf78';ctx.fillRect(X(a.x)-1,Z(a.z)-1,2,2);}}
    const boss=sim.state.enemies.find(e=>e.type===3&&e.hp>0&&e.active);if(boss){ctx.fillStyle='#e89963';ctx.fillRect(X(boss.x)-3,Z(boss.z)-3,6,6);}
    ctx.strokeStyle=exitReady()?'#71e1cc':'#b08449';ctx.strokeRect(X(world.exit.x)-3,Z(world.exit.z)-3,6,6);
    const otherId=sim.state.activeProfile==='light'?'heavy':'light',other=sim.state.profiles?.[otherId]?.position;if(other){ctx.strokeStyle=otherId==='light'?'#71e1cc':'#ffb66e';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(X(other.x),Z(other.z),4,0,Math.PI*2);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font='bold 8px Arial';ctx.fillText(otherId==='light'?'L':'H',X(other.x)+6,Z(other.z)+3);}
    const p=sim.state.player;ctx.save();ctx.translate(X(p.x),Z(p.z));ctx.rotate(p.yaw);ctx.fillStyle='#f2f5e5';ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(3.5,3.2);ctx.lineTo(0,1.5);ctx.lineTo(-3.5,3.2);ctx.closePath();ctx.fill();ctx.restore();
  }
  function cadenceHint(){
    const hz=framePacer.refreshHz,ready=hz>0&&framePacer.limit===cadenceLimit();
    const text=ready?(cadenceLimit()?(prefs.fpsLimit===-1?'Auto '+autoCadence+' · ':'')+'Cadence régulière : ≈ '+Math.round(framePacer.effectiveHz)+' i/s · écran ≈ '+Math.round(hz)+' Hz.':'Sans limite · écran mesuré à ≈ '+Math.round(hz)+' Hz.'):'Mesure de la cadence de l’écran…';
    if($('fps-effective').textContent!==text)$('fps-effective').textContent=text;
  }
  function pollControls(now){
    const dt=Math.max(0,Math.min(.12,(now-padLast)/1000));padLast=now;
    if(document.hidden||!windowFocused){controls.clear();return;}
    const f=controls.frame(dt);
    if(f.deviceChanged){activeDevice(f.device);controlHints();if(mode==='options'||mode==='paused')renderBindings();}
    if(f.connected.length){$('pad-status').textContent='Manette connectée · '+f.connected[0].id;if(mode==='playing')toast('Manette connectée',2);}
    if(f.disconnected.length){controls.clear();if(controls.device==='gamepad'&&mode==='playing')setMode('paused');$('pad-status').textContent=f.pads.length?'Manette disponible':'Manette débranchée · reconnectez-la ou utilisez le clavier';}
    if(f.device==='gamepad'&&(f.pressed.length||f.nav?.direction||f.nav?.adjust)){
      titleGesture=true;titleBlocked=false;audio.resume();if(titleScreen())syncTitle();
      if(titleBlocked)$('pad-status').textContent='A : activer le son · cliquez si le navigateur le demande';
    }
    if(padBindingAction){
      if(f.captured){const id=padBindingAction,result=FOptions.assignPad(prefs.padBindings,id,f.captured.code);if(result.ok){prefs.padBindings=result.bindings;padBindingAction=null;settings();$('binding-status').textContent='Bouton enregistré.';$('pad-bind-'+id).focus();}else{padBindingAction=null;controls.capture(null);renderBindings();$('binding-status').textContent=result.reason+' Libérez ce bouton avec —, puis réessayez.';}}
      controls.step();return;
    }
    if(f.pressed.includes('pause')){togglePause();return;}
    if(mode==='playing'){
      if(f.pressed.includes('jump'))jumpQueued=true;if(f.pressed.includes('switchProfile'))switchProfileQueued=true;
      if(f.pressed.includes('fire'))pressFire();if(f.pressed.includes('fireLeft'))pressFire(true);
      if(f.pressed.includes('weaponNext'))switchWeapon();if(f.pressed.includes('leftHand'))switchLeft();if(f.pressed.includes('view'))toggleView();
      for(let i=0;i<5;i++)if(f.pressed.includes('weapon'+(i+1)))switchWeapon(i);
      if(f.pressed.includes('map')){$('radar-wrap').hidden=!$('radar-wrap').hidden;drawRadar();}
    }else{
      controls.step();const root=$(mode==='menu'?'intro':mode==='shop'?'shop':['paused','options'].includes(mode)?'pause':'result'),nav=f.nav;
      if(!nav||mode==='loading')return;
      if(nav.back){if(mode==='paused'||mode==='options'||mode==='shop')togglePause();else if(['dead','cleared','complete'].includes(mode))$('back-menu').click();return;}
      const focused=document.activeElement,adjustable=focused?.type==='range'||focused?.tagName==='SELECT';
      if(nav.adjust&&adjustable)FInput.focusMove(root,nav.adjust,document);
      else if((nav.previous||nav.next)&&['paused','options'].includes(mode)){const names=['game','image','audio','controls'],n=names.indexOf(optionsTab);selectTab(names[(n+(nav.next?1:3))%4],true);}
      if(nav.direction)FInput.focusMove(root,nav.direction,document);
      if(nav.accept)FInput.focusMove(root,'accept',document);
    }
  }
  let demoRunner=null,demoPrevious=null,demoSerial=0,demoPilot=null,demoCamera=null,demoShot='eyes',demoCache=new Map(),demoElapsed=0,demoBench=null;
  const demoQuery=typeof URLSearchParams==='function'?new URLSearchParams(typeof location!=='undefined'?location.search||'':''):{get:()=>null};let demoRequested=demoQuery.get('demo')==='1',demoHold=false;const benchSeconds=Math.min(1800,Math.max(0,Number(demoQuery.get('bench'))||0));
  function demoMix(on){audio.setMix?.({master:prefs.masterVolume*(on?.35:1),music:prefs.musicVolume,effects:prefs.effectsVolume,ambience:prefs.ambienceVolume});}
  function demoStop(){
    ++demoSerial;demoRunner?.dispose();demoRunner=null;demoPilot=null;demoCamera=null;demoCache.clear();
    if(demoPrevious){const title=demoPrevious.title;if(title){$('sector-number').textContent=title.sector;$('sector-title').textContent=title.heading;$('mission-summary').innerHTML=title.summary;document.body.dataset.stage=title.stage;document.body.dataset.campaign=title.campaign;}({stage,seed,campaignMode,campaignRevision,profileMode,combatMode,hordeMode,runStats,checkpoint,selectedWeapon,stageEntryLoadout}=demoPrevious);demoPrevious=null;checkpointPending=false;checkpointWaitAt=-1;}
    $('demo-banner').hidden=true;document.body.classList.remove('demo-loading');demoMix(false);if(mode==='demo')setMode('menu');
  }
  async function demoStart(){
    if(mode!=='menu'||!window.MetalDemo||!window.FPilot)return false;
    demoRequested=false;flushCheckpoint();demoPrevious={stage,seed,campaignMode,campaignRevision,profileMode,combatMode,hordeMode,runStats,checkpoint,selectedWeapon,stageEntryLoadout,title:{sector:$('sector-number').textContent,heading:$('sector-title').textContent,summary:$('mission-summary').innerHTML,stage:document.body.dataset.stage,campaign:document.body.dataset.campaign}};checkpointPending=false;demoElapsed=0;const ticket=++demoSerial;
    sim?.dispose?.();setMode('demo');$('demo-banner').hidden=false;demoMix(true);
    demoBench=benchSeconds?{seconds:0,steps:0,frames:[],stepMs:[],drawMs:[],scenes:[],started:performance.now()}:null;
    const scenes=MetalDemo.scenes(96,!!benchSeconds);
    const prepare=scene=>{const key=scene.index+':'+scene.seed;if(!demoCache.has(key)){demoCache.set(key,preparationJobs.request('world',{seed:scene.seed,index:scene.index,prepare:!scene.boss,options:{campaign:true,campaignVersion:2,profiles:true,combatVersion:1,hordeVersion:1}}));while(demoCache.size>2)demoCache.delete(demoCache.keys().next().value);}return demoCache.get(key);};
    demoRunner=FDemo.runner({scenes,stallSeconds:50,onError:error=>console.error('METAL demo:',error),onStop:()=>demoAttract?.stop('error'),open:async scene=>{
      document.body.classList.add('demo-loading');const raw=await prepare(scene);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(ticket!==demoSerial)return null;
      const prepared=MetalDemo.world(raw,scene),carry=MetalDemo.loadout(scene.index,MetalDemo.active?.(scene)??(scene.boss&&scene.index%2?'heavy':'light'));
      load(scene.index,scene.seed,carry,true,2,false,true,true,prepared,{brain:null});sim.setDifficulty(0);demoPilot=FPilot.create(sim,world,{seed:scene.seed});demoCamera=MetalDemo.camera(sim,scene.seed);demoShot='eyes';const current=sim,pilot=demoPilot,point=current.snapshot();
      const benchScene=demoBench?{id:scene.id,step:demoBench.steps}:null;if(benchScene)demoBench.scenes.push(benchScene);$('demo-banner').textContent='DÉMO · MONDE '+(scene.index+1)+' · Touchez ou appuyez pour revenir';document.body.classList.remove('demo-loading');fixedLoop.reset();fixedLoop.observe(performance.now());
      const next=scenes[(scenes.indexOf(scene)+1)%scenes.length];prepare(next).catch(()=>{});
      return {step(dt){pilot.think(input,dt);const begin=demoBench?performance.now():0;poseView.capture(current.state);current.step(dt,input);if(demoBench){demoBench.steps++;demoBench.seconds+=dt;demoBench.stepMs.push(performance.now()-begin);}musicDirector?.update(current.state,dt);events();},progressKey:()=>MetalDemo.progress(current,pilot),done:()=>current.state.won||scene.boss&&!current.state.bossAlive,dead:()=>current.state.dead,reset:()=>pilot.reset(),recover(){if(!current.restore(point,{recover:true}))return false;pilot.reset();return true;},dispose(){if(benchScene)benchScene.digest=current.digest();current.dispose();}};
    }});demoRunner.next('start');return true;
  }
  const demoAttract=window.FDemo?.attract({idleMs:()=>demoRequested?0:prefs.demoDelay*1000,enabled:()=>prefs.demo&&!demoHold&&!document.body.classList.contains('low-battery'),canStart:()=>mode==='menu'&&!!sim&&!deferLaunch,window,document,start:demoStart,stop:demoStop,onCountdown:ms=>{$('demo-countdown').textContent=ms===null?'':ms<3500?'Démo dans '+Math.ceil(ms/1000)+' s':'';},onPause:()=>{fixedLoop.reset();audioGate();},onResume:elapsed=>{fixedLoop.reset();if(elapsed>60000&&mode==='demo')demoRunner?.next('visibility');audioGate();}});
  function demoFinishBench(){
    if(!demoBench)return;const q=list=>{const a=list.slice().sort((a,b)=>a-b),at=k=>a[Math.min(a.length-1,Math.floor(a.length*k))]||0;return {n:a.length,p50:at(.5),p95:at(.95),p99:at(.99),max:at(1),over25:a.filter(x=>x>25).length};};
    const result={schema:'metal-demo-bench-v1',seconds:demoBench.seconds,steps:demoBench.steps,frames:q(demoBench.frames),step:q(demoBench.stepMs),draw:q(demoBench.drawMs),scenes:demoBench.scenes,renderer:{...renderer.stats}};document.body.dataset.bench=JSON.stringify(result);console.log('METAL BENCH',result);demoBench=null;demoHold=true;demoAttract?.stop('bench');
  }

  let replaySession=null,replayStream=null;
  function attachReplay(scene){
    replaySession?.detach();replaySession=null;
    if(demoQuery.get('record')!=='1'||mode==='demo'||mode==='menu'||!window.MetalReplay)return;
    replaySession=MetalReplay.attach(sim,{recorder:replayStream,scene,header:{gameVersion:'__GAME_VERSION__',simHash:'__SIM_HASH__',simVersion:{format:1},engine:'cpu',checksumEvery:600}});replayStream=replaySession.recorder;$('export-replay').hidden=false;
  }
  $('export-replay').addEventListener('click',()=>{if(!replaySession)return;const data=replaySession.end();replaySession=replayStream=null;const url=URL.createObjectURL(new Blob([data],{type:'application/octet-stream'})),a=document.createElement('a');a.href=url;a.download='METAL-rejeu.fdm';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('export-replay').hidden=true;});
  function frame(now){
    const frameStart=performance.now();requestAnimationFrame(frame);demoAttract?.tick();if(mode!=='demo'&&!demoAttract?.swallowing)pollControls(now);const present=FOptions.frameGate(framePacer,now,cadenceLimit());
    if((mode==='options'||mode==='paused')&&optionsTab==='image'&&now-cadenceHintAt>=500){cadenceHintAt=now;cadenceHint();}
    if(!present)return;
    const frameMs=Math.max(0,now-last),dt=clamp(frameMs/1000,0,.12);last=now;clock+=dt;
    if(!renderer||!sim||document.hidden){perfStart=0;perfFrames=0;return;}
    if(mode==='loading')return;
    const signals={time:sim.state.time,lookYaw:0,lookPitch:0,firing:false};
    if(mode==='demo'){
      if(!demoRunner?.waiting)fixedLoop.advance(now,part=>{demoRunner?.step(part);demoElapsed+=part;return mode==='demo'&&!demoRunner?.waiting;});else fixedLoop.reset();
      animateActors(dt);audio.tick(dt);audio.setThreat(sim.state.threat||0);hudWait-=dt;if(hudWait<=0){renderHUD();hudWait=.1;}signals.firing=input.fire;
      if(demoBench){demoBench.frames.push(frameMs);if(demoBench.seconds>=benchSeconds)demoFinishBench();}
      if(touch&&demoElapsed>=600){demoHold=true;demoAttract?.stop('mobile-limit');}
    }else if(mode==='playing'&&!loadoutOpen){
      padState=controls.step();
      const held=id=>FOptions.down(prefs.bindings,keys,id);
      const touchState=touchControls.sample(dt),gyroState=host.sampleGyro(dt,touch&&(prefs.gyroMode==='on'||prefs.gyroMode==='aim'&&touchControls.aiming),prefs.gyroSensitivity);
      input.moveX=Number(held('right'))-Number(held('left'));
      input.moveY=Number(held('forward'))-Number(held('back'));
      lookDX+=(Number(held('turnRight'))-Number(held('turnLeft')))*dt*1.9+touchState.lookX+gyroState.lookX+(padState.lookX||0);
      lookDY+=touchState.lookY+gyroState.lookY*(prefs.invertY?-1:1)+(padState.lookY||0);
      touchState.lookX=touchState.lookY=padState.lookX=padState.lookY=0;
      input.lookX=lookDX;input.lookY=lookDY;
      dashQueued||=padState.dash;pulseQueued||=padState.pulse;meleeQueued||=padState.melee;interactQueued||=padState.interact;
      const fireHeld=mouseFire||touchState.fire||held('fire')||padState.fire,fireLeftHeld=mouseLeftFire||touchState.fireLeft||held('fireLeft')||padState.fireLeft;
      expireFireIntents(now);input.fire=fireHeld||firePressed;input.fireLeft=fireLeftHeld||fireLeftPressed;input.dash=dashQueued;input.pulse=pulseQueued;input.melee=meleeQueued;input.interact=interactQueued;input.weapon=undefined;input.sprint=held('sprint');input.jump=jumpQueued;input.jumpHeld=held('jump')||touchJump!==null;input.descendHeld=held('dash')||touchDescend!==null;input.switchProfile=switchProfileQueued;Object.assign(input,MetalControls.merge(MetalControls.merge(input,touchState),padState));input.assist=touch&&prefs.touchAssist||controls.device==='gamepad'&&prefs.padAssist;input.touchAssist=touch&&prefs.touchAssist;
      signals.lookYaw=dt>0?(lookDX-aimShownX)/dt:0;signals.lookPitch=dt>0?(lookDY-aimShownY)/dt:0;signals.firing=input.fire;
      fixedLoop.advance(now,part=>{
        poseView.capture(sim.state);sim.step(part,input);musicDirector?.update(sim.state,part);input.lookX=input.lookY=0;
        input.dash=input.pulse=input.melee=input.interact=input.jump=input.switchProfile=false;
        lookDX=lookDY=0;dashQueued=pulseQueued=meleeQueued=interactQueued=jumpQueued=switchProfileQueued=false;
        events();if(mode!=='playing'||loadoutOpen)return false;
        input.fire=fireHeld;input.fireLeft=fireLeftHeld;input.weapon=undefined;
      });
      aimShownX=lookDX;aimShownY=lookDY;
      const loc=sim.state.locomotion,footstep=Math.floor((loc?.stridePhase||0)/Math.PI),outside=isOutdoors(sim.state.player.x,sim.state.player.z);
      outdoorMix+=(Number(outside)-outdoorMix)*(1-Math.exp(-dt*3));audio.setEnvironment?.(world.environment,outdoorMix);
      const localSound=soundscape.sample(sim),motor=localSound.machinery,steam=localSound.steam;
      audio.setMachinery?.(motor.level,motor.pan,motor.kind,motor.occluded);
      audio.setSteam?.(Math.max(steam.level,sim.state.jetpack?.active ? .22 : 0),sim.state.jetpack?.active?0:steam.pan,sim.state.jetpack?.active?false:steam.occluded);
      audio.setThreat(sim.state.threat||0);audio.setPressure?.(sim.state.director?.pressure||0);audio.tick(dt);
      if(mode==='playing'&&sim.state.activeProfile!=='light'&&!sim.state.player.airborne&&footstep!==lastFootstep&&sim.state.moving>.5&&(loc?.dashBlend||0)<.3)audio.step(sim.state.moving,{outdoor:outside,biome:world.environment?.biome});
      lastFootstep=footstep;
      animateActors(dt);
      toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');
      encounterTime-=dt;if(encounterTime<=0)$('encounter').classList.remove('visible');
      hudWait-=dt;if(hudWait<=0){renderHUD();hudWait=.09;}
      $('crosshair').classList.toggle('hit',sim.state.hitMarker>0);$('damage').style.opacity=String(sim.state.damage*.45);
    }else{fixedLoop.reset();poseView.clear();$('damage').style.opacity='0';if(titleScreen()){activateTitle();audio.tick(dt);}}
    for(const hit of hurtDirections)hit.life-=dt;while(hurtDirections.length&&hurtDirections[0].life<=0)hurtDirections.shift();$('hurt-directions').querySelectorAll('i').forEach((node,i)=>{const hit=hurtDirections[i];node.style.opacity=hit?String(Math.max(0,hit.life/.6)):0;if(hit)node.style.transform='rotate('+(hit.angle-sim.state.player.yaw)+'rad)';});
    weakFlash=Math.max(0,weakFlash-dt);killFlash=Math.max(0,killFlash-dt);$('crosshair').classList.toggle('weak-hit',weakFlash>0);$('crosshair').classList.toggle('kill-hit',killFlash>0);
    $('crosshair').classList.toggle('deflect',sim.state.time<deflectUntil);boundaryFlash=Math.max(0,boundaryFlash-dt);$('crosshair').classList.toggle('boundary-contact',boundaryFlash>0);
    controls.flush(now,mode==='playing'&&!document.hidden&&windowFocused);
    syncDestruction();
    if((sceneDirty||titleScreen()||mode==='demo'||mode==='playing'&&!loadoutOpen)&&(mode!=='playing'||now>=freezeUntil)){
    renderState=poseView.render(sim.state,(mode==='demo'||mode==='playing'&&!loadoutOpen)?fixedLoop.frame.alpha:1);
    const p=renderState.player,isPlay=mode==='playing'||mode==='paused'||mode==='demo',t=mode==='menu'?clock:sim.state.time;
    if(mode==='playing'&&!loadoutOpen){const aim=FLoop.aim(sim.state.player.yaw,sim.state.player.pitch,lookDX,lookDY,-1.2,1.2);p.yaw=aim.yaw;p.pitch=aim.pitch;}
    signals.time=t;signals.flying=sim.state.activeProfile==='light';signals.groundY=p.y;signals.grounded=!signals.flying&&!sim.state.player.airborne;signals.heat=sim.state.weaponHeat?.[sim.state.weapon]??sim.state.player.heat;const twin=sim.state.activeProfile==='light',view=motion.update(mode==='playing'||mode==='demo'?dt:0,sim.state.locomotion||{},signals,softMotion),leftView=leftMotion.update(mode==='playing'||mode==='demo'?dt:0,sim.state.locomotion||{},twin?{...signals,firing:input.fire||input.fireLeft}:{...signals,firing:input.fireLeft,heat:sim.state.weaponHeat?.[sim.state.equipment?.left]||0},softMotion);
    const recoilPitch=isPlay?view.pitch+leftView.pitch:0;
    const camera={pos:[p.x,(p.y||0)+1.62+(isPlay?view.height:0),p.z],yaw:p.yaw,pitch:p.pitch+recoilPitch,roll:isPlay?view.roll+leftView.recoilRoll:0,fov:prefs.fov+(isPlay?view.fov+leftView.recoilFov:0)};
    if(mode==='menu'||mode==='options'){camera.yaw=world.spawn.yaw+.38+(softMotion?Math.sin(clock*.13)*.11:0);camera.pitch=.02;camera.pos[1]=(world.spawn.y||0)+1.72;}
    if(mode==='demo'&&demoCamera){const shot=demoCamera.update(dt,camera);demoShot=shot.shot;Object.assign(camera,shot.pose);}
    // Third person: the camera leaves the eye; the firing ray does not.
    const follow=mode==='playing'||mode==='paused'?followCamera.frame(p,(o,d,far)=>sim.ray(o,d,far),mode==='playing'?dt:0,{profile:twin?'light':'heavy',ground:(x,z)=>sim.ground?.(x,z),actorRange:aimRange}):null,third=!!follow?.thirdPerson;
    if(third){camera.pos=follow.pos;camera.yaw=follow.yaw;camera.pitch=follow.pitch;camera.roll=0;camera.fov=prefs.fov;}
    camera.overlayFov=camera.fov;if(touch&&prefs.portraitFov)camera.fov=FTouch.fovFor(innerWidth/innerHeight,camera.fov);
    const aimOffset=third?0:canvas.clientHeight*.5*Math.tan(recoilPitch)/Math.tan(clamp(camera.fov,40,110)*Math.PI/360);$('crosshair').style.marginTop=(aimOffset*Math.cos(camera.roll)).toFixed(2)+'px';$('crosshair').style.marginLeft=(-aimOffset*Math.sin(camera.roll)).toFixed(2)+'px';
    renderPartner(camera);
    const external=mode==='demo'&&demoShot!=='eyes',drawing=demoBench?performance.now():0,drawModels=models(t,isPlay,camera,third||external);document.body.dataset.shot=mode==='demo'?demoShot:'';
    renderer.draw(camera,drawModels,{time:t,flash:Math.max(sim.state.flash,sim.state.leftFlash||0),lights:window.FEffects?.lights(sim.state)||[],damage:sim.state.damage,pulse:clamp((sim.state.pulseVisual||0)/.65,0,1),shake:0,frameMs,brightness:prefs.brightness,vignette:prefs.vignette,shadows:prefs.shadows,bloom:prefs.bloom,reflections:prefs.reflections,horror:sim.state.director,adaptive:mode==='playing'&&(!cadenceLimit()||cadenceLimit()>=60)&&document.hasFocus()});
    if(demoBench)demoBench.drawMs.push(performance.now()-drawing);
    sceneDirty=false;
    }
    frameTasks.pump(FSchedule.budget(framePacer.period*framePacer.stride,performance.now()-frameStart));
    // Count completed frame intervals in real time, with a stable readout at most twice/s.
    if(!perfStart){perfStart=now;perfFrames=0;}else perfFrames++;
    if(now-perfStart>=750){
      const fps=Math.round(perfFrames*1000/(now-perfStart));
      document.body.dataset.fps=String(fps);$('fps-counter').textContent=fps+' FPS';
      const step=perfGovernor?.sample(fps,{cadence:cadenceLimit()||60,playing:mode==='playing'&&!document.hidden,prefs});if(step)lighten(step);
      perfStart=now;perfFrames=0;
    }
  }
  // Modest computers: one effect off at a time while the frame rate stays
  // low in play; the native resolution is never lowered (David, 14/11/2026).
  const perfGovernor=window.MetalPerf?.governor();
  function lighten(step){
    if(step.key==='quality'){quality='low';renderer.resize(quality);}else prefs[step.key]=step.value;
    settings();toast('Fluidité : '+step.label+' · Options › Image',3.2);
  }
  // Displayed motion only: eased machine headings, stepped turns, the
  // third-person legs of the heavy and mechanism levers. Shared by play and demo.
  function animateActors(dt){
    const loc=sim.state.locomotion;
    // Third-person legs follow the movement while the torso keeps the aim;
    // walking backwards reverses the stride instead of moonwalking.
    {const f=loc?.forward||0,st=loc?.strafe||0,theta=Math.atan2(st,f),moving=Math.hypot(f,st)>.4&&sim.state.activeProfile!=='light',back=moving&&Math.abs(theta)>Math.PI/2+.15,want=moving?clamp(back?theta-Math.sign(theta)*Math.PI:theta,-1.1,1.1):0;avatarGait.legYaw+=(want-avatarGait.legYaw)*(1-Math.exp(-dt*10));avatarGait.back=back;}
    for(const e of sim.state.enemies){
      const scale=e.type===3?Math.max(1,Number(e.bossScale)||1):1;
      if(e.deployed===false||e.hp<=0||(e.x-sim.state.player.x)**2+(e.z-sim.state.player.z)**2>(scale>1?140:40)**2){actorMotion.delete(e.id);continue;}
      const yaw=Number.isFinite(e.yaw)?e.yaw:0,giant=scale>1,pose=actorMotion.get(e.id)||{phase:e.id*.7,blend:0,yaw,last:yaw};
      // Machines turn fast but never snap. A giant keeps the simulation's own
      // rate-limited heading, which carries its real weak point.
      if(giant)pose.yaw=yaw;else{const delta=Math.atan2(Math.sin(yaw-pose.yaw),Math.cos(yaw-pose.yaw)),limit=[7,6,5,5][e.type]*dt;pose.yaw+=clamp(delta*(1-Math.exp(-dt*16)),-limit,limit);}
      const turn=dt>0?Math.abs(Math.atan2(Math.sin(pose.yaw-pose.last),Math.cos(pose.yaw-pose.last)))/dt:0,speed=e.moveSpeed||0;pose.last=pose.yaw;
      // A turn on the spot is stepped: the gait advances with the rotation.
      pose.phase=(pose.phase+(speed*4.8/scale+turn*(giant?1.6:.8))*dt)%(Math.PI*2);
      pose.blend+=(Math.max(Math.min(1,speed/.9),Math.min(1,turn*(giant?1.4:.35))*.55)-pose.blend)*(1-Math.exp(-dt*15));actorMotion.set(e.id,pose);
    }
    for(const a of sim.state.mechanisms||[]){const value=systemMotion.get(a.id)??0;systemMotion.set(a.id,value+(Number(a.active)-value)*(1-Math.exp(-dt*4)));}
  }
  function togglePause(){if(mode==='playing')setMode('paused');else if(mode==='options')setMode('menu');else if(mode==='paused'||mode==='shop'){audio.resume();setMode('playing');lock();canvas.focus({preventScroll:true});}}
  function switchWeapon(value,direction=1){
    if(mode!=='playing')return;
    const owned=(sim.state.inventory?.weapons||[true,true,true]).map((has,i)=>has&&(!sim.state.activeProfile||MetalProfiles.allowed(sim.state.activeProfile,i)));let next=value;
    if(next===undefined){next=selectedWeapon;for(let i=0;i<owned.length;i++){next=(next+direction+owned.length)%owned.length;if(owned[next])break;}}
    if(!owned[next]){toast(weaponNames[next]+' · arme à trouver dans le secteur',2);return;}
    if(next===selectedWeapon)return;
    if(sim.selectWeapon){if(!sim.selectWeapon(next))return;}else sim.state.weapon=next;
    selectedWeapon=sim.state.weapon;clearFireIntents();motion.impulse('switch');audio.switchWeapon?.();renderHUD();
  }
  function switchLeft(value){
    if(mode!=='playing'||!sim.selectLeftWeapon)return;
    const inventory=sim.state.inventory,current=sim.state.equipment?.left??null,choices=[null,...inventory.weapons.flatMap((owned,i)=>owned&&i!==sim.state.weapon&&(!sim.state.activeProfile||MetalProfiles.allowed(sim.state.activeProfile,i))?[i]:[])];
    const next=value===undefined?choices[(choices.indexOf(current)+1)%choices.length]:value;
    if(!sim.selectLeftWeapon(next)){toast('Équipement indisponible pour la main gauche',1.8);renderHUD();return;}
    selectedWeapon=sim.state.weapon;clearFireIntents();leftMotion.impulse('switch');audio.switchWeapon?.();renderHUD();
  }
  $('loading-cancel').addEventListener('click',()=>{preparationSerial++;deferLaunch=false;pendingStart=null;setMode('menu');});
  $('start').addEventListener('click',()=>{const nextSeed=savedRun?(Date.now()>>>0)%1000000:seed;preparePlay(0,()=>newRun(nextSeed),true,{seed:nextSeed,revision:2,profiles:true,combat:true,horde:true});});
  $('resume-expedition').addEventListener('click',()=>preparePlay(savedIndex(savedRun),()=>resumeSaved(savedRun),savedRun?.version===3,{seed:savedRun?.seed,revision:savedRun?.campaignRevision||1,profiles:savedRun?.profiles===1,combat:savedRun?.combatVersion===1,horde:savedRun?.hordeVersion===1}));
  $('intro-options').addEventListener('click',()=>setMode('options'));
  $('pause-button').addEventListener('click',togglePause);$('resume').addEventListener('click',togglePause);
  $('restart').addEventListener('click',()=>preparePlay(stage,()=>{load(stage,undefined,stageEntryLoadout);saveCheckpoint();start('Nouvelle tentative. Équipement et crédits de l’entrée du secteur restaurés.');}));
  $('continue').addEventListener('click',()=>{
    if(mode==='dead'){
      preparePlay(savedRun?savedIndex(savedRun):stage,()=>resumeSaved(savedRun),savedRun?.version===3,{seed:savedRun?.seed,revision:savedRun?.campaignRevision||1,profiles:savedRun?.profiles===1,combat:savedRun?.combatVersion===1,horde:savedRun?.hordeVersion===1});return;
    }
    if(mode==='complete'){const nextSeed=(Date.now()>>>0)%1000000;preparePlay(0,()=>newRun(nextSeed),true,{seed:nextSeed,revision:2,profiles:true,combat:true,horde:true});return;}
    if(campaignMode&&campaignRevision===2&&profileMode&&combatMode)hordeMode=true;
    const nextStage=stage+1,loadout=heavyFirst(sim.exportLoadout?.()||sim.exportInventory?.());preparePlay(nextStage,()=>{load(nextStage,undefined,loadout);saveCheckpoint();start();});
  });
  $('back-menu').addEventListener('click',()=>{load(0);setMode('menu');refreshContinue();});
  $('pause-main').addEventListener('click',()=>{load(0);setMode('menu');refreshContinue();});
  $('intro-sound').addEventListener('click',()=>{
    audio.cancelTestMix?.();
    if(prefs.masterVolume===0||prefs.musicVolume===0){titleGesture=true;titleBlocked=false;muted=false;settings();setMode('options');selectTab('audio');$(prefs.masterVolume===0?'master-setting':'music-setting').focus();return;}
    muted=titleGesture&&!titleBlocked&&!muted;titleGesture=true;titleBlocked=false;settings();
  });
  $('sound-toggle').addEventListener('click',()=>{audio.cancelTestMix?.();titleGesture=true;titleBlocked=false;muted=!muted;settings();});
  $('quality-toggle').addEventListener('click',()=>{quality={auto:'low',low:'high',high:'auto'}[quality];renderer.resize(quality);settings();});
  $('difficulty-setting').addEventListener('change',()=>{prefs.difficulty=clamp(Math.round(Number($('difficulty-setting').value)||0),0,2);sim?.setDifficulty?.(prefs.difficulty);settings();});
  $('ai-setting').addEventListener('change',async()=>{prefs.aiAcceleration=$('ai-setting').value==='cpu'?'cpu':'auto';settings();await brain?.setMode(prefs.aiAcceleration);brainStatus();});
  $('motion-toggle').addEventListener('click',()=>{softMotion=!softMotion;settings();});
  const tabs=['game','image','audio','controls'];
  for(const id of tabs){$('tab-'+id).addEventListener('click',()=>selectTab(id));$('tab-'+id).addEventListener('keydown',e=>{let next=tabs.indexOf(id);if(e.code==='ArrowRight')next=(next+1)%4;else if(e.code==='ArrowLeft')next=(next+3)%4;else if(e.code==='Home')next=0;else if(e.code==='End')next=3;else return;e.preventDefault();selectTab(tabs[next],true);});}
  for(const [id,key] of [['demo','demo'],['shadows','shadows'],['bloom','bloom'],['autotune','autoTune'],['fps','showFps'],['crt','crt'],['vignette','vignette'],['invert','invertY'],['pointer-acceleration','systemPointerAcceleration']])$(id+'-toggle').addEventListener('click',()=>{prefs[key]=!prefs[key];settings();});
  for(const [id,key,divisor] of [['fov','fov',1],['brightness','brightness',100],['sensitivity','sensitivity',100],['crosshair','crosshairScale',100],['master','masterVolume',100],['music','musicVolume',100],['effects','effectsVolume',100],['ambience','ambienceVolume',100]])$(id+'-setting').addEventListener('input',()=>{prefs[key]=Number($(id+'-setting').value)/divisor;settings();});
  for(const [id,key,mul] of [['pad-yaw','padYaw',1],['pad-pitch','padPitch',1],['pad-dead','padDead',100],['pad-curve','padCurve',100],['pad-vibration','padVibration',100],['touch-accel','touchAccel',100],['gyro-sensitivity','gyroSensitivity',100]])$(id+'-setting').addEventListener('input',()=>{prefs[key]=Number($(id+'-setting').value)/mul;settings();});
  for(const [id,key] of [['pad-invert','padInvertY'],['pad-assist','padAssist'],['pad-swap','padSwapSticks'],['touch-assist','touchAssist'],['portrait-fov','portraitFov']])$(id+'-toggle').addEventListener('click',()=>{prefs[key]=!prefs[key];settings();});
  $('demo-delay').addEventListener('change',()=>{prefs.demoDelay=Number($('demo-delay').value);settings();});
  $('render-scale').addEventListener('change',()=>{prefs.renderScale=Number($('render-scale').value);settings();renderer.resize(quality);});
  $('reflections').addEventListener('change',()=>{prefs.reflections=$('reflections').value;settings();});
  $('fps-limit').addEventListener('change',()=>{prefs.fpsLimit=Number($('fps-limit').value);settings();});
  $('reset-image').addEventListener('click',()=>{const d=FOptions.defaults(touch);for(const key of ['quality','softMotion','fov','brightness','shadows','bloom','reflections','showFps','crt','vignette','fpsLimit','renderScale'])prefs[key]=d[key];quality=prefs.quality;softMotion=prefs.softMotion;renderer.resize(quality);settings();});
  $('reset-controls').addEventListener('click',()=>{const d=FOptions.defaults(touch);for(const key of ['sensitivity','invertY','systemPointerAcceleration','crosshairScale','view','controlsHint','bindings','bindingsVersion','padBindings','padVersion','padYaw','padPitch','padDead','padCurve','padInvertY','padAssist','padVibration','padSwapSticks'])prefs[key]=d[key];bindingAction=null;settings();$('binding-status').textContent='Commandes par défaut rétablies.';});
  $('reset-audio').addEventListener('click',()=>{audio.cancelTestMix?.();const d=FOptions.defaults(touch);for(const key of ['masterVolume','musicVolume','effectsVolume','ambienceVolume'])prefs[key]=d[key];muted=false;settings();$('audio-status').textContent='Mix recommandé rétabli. Testez les tirs et les ambiances.';});
  $('test-audio').addEventListener('click',async()=>{
    if(audio.stats?.preview){audio.cancelTestMix?.();activateTitle();$('audio-status').textContent='Test audio arrêté.';return;}
    if(muted||prefs.masterVolume===0){$('audio-status').textContent='Son coupé. Activez le son et le volume général pour écouter.';return;}
    if(prefs.effectsVolume===0&&prefs.ambienceVolume===0){$('audio-status').textContent='Effets et ambiances sont à zéro. Montez ces deux curseurs pour les tester.';return;}
    titleGesture=true;titleBlocked=false;audio.start();audio.resume();$('audio-status').textContent='Test : tir, impact et souffle d’ambiance…';
    const played=await audio.testMix?.({muted:prefs.muted});
    if(titleScreen())syncTitle();
    if(['paused','options'].includes(mode)&&optionsTab==='audio')$('audio-status').textContent=played?'Test lancé : tir, impact et ambiance. Les quatre volumes restent indépendants.':'Le test audio a été interrompu ou le son est indisponible.';
  });
  $('export-mod').addEventListener('click',()=>{
    const track=currentTrack(),data=window.FMusic?.getModule(track);if(!data){$('audio-status').textContent='Le module audio est indisponible.';return;}
    const url=URL.createObjectURL(new Blob([data],{type:'audio/mod'})),link=document.createElement('a');link.href=url;link.download=track==='title'?'METAL-titre.mod':'METAL-'+String(stage+1).padStart(2,'0')+'.mod';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('audio-status').textContent='Module généré : '+Math.round(data.byteLength/1000)+' ko. Téléchargement lancé.';
  });
  $('loadout-toggle').addEventListener('click',()=>{if(mode!=='playing')return;loadoutOpen=!loadoutOpen;sceneDirty=true;clearInput();document.body.classList.toggle('loadout-open',loadoutOpen);$('loadout-toggle').setAttribute('aria-expanded',String(loadoutOpen));});
  $('map-button').addEventListener('click',()=>{$('radar-wrap').hidden=!$('radar-wrap').hidden;drawRadar();});
  $('view-button').addEventListener('click',()=>{toggleView();if(mode==='playing')canvas.focus({preventScroll:true});});
  $('view-toggle').addEventListener('click',toggleView);
  $('controls-hint-toggle').addEventListener('click',()=>{prefs.controlsHint=!prefs.controlsHint;settings();});
  $('weapon-switch').addEventListener('click',()=>switchWeapon());
  for(let i=0;i<5;i++)$('weapon-slot-'+i).addEventListener('click',()=>switchWeapon(i));
  $('left-hand-setting').addEventListener('change',()=>{const value=$('left-hand-setting').value;switchLeft(value==='none'?null:Number(value));canvas.focus({preventScroll:true});});
  $('shop-close').addEventListener('click',()=>{if(mode==='shop')togglePause();});
  $('reload').addEventListener('click',()=>location.reload());
  addEventListener('keydown',e=>{
    activeDevice('keyboard');
    if(padBindingAction){e.preventDefault();if(e.code==='Escape'){padBindingAction=null;controls.capture(null);renderBindings();}else if(e.code==='Backspace'){prefs.padBindings=FOptions.assignPad(prefs.padBindings,padBindingAction,null).bindings;padBindingAction=null;controls.capture(null);settings();}return;}
    if(!e.repeat&&!e.metaKey&&!e.altKey&&!e.ctrlKey&&!['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight','Escape'].includes(e.code))titleUserGesture(e);
    if(bindingAction){
      e.preventDefault();if(e.repeat)return;
      if(e.code==='Escape'){bindingAction=null;renderBindings();$('binding-status').textContent='Modification annulée.';return;}
      const result=FOptions.assign(prefs.bindings,bindingAction,e.code);if(!result.ok){$('binding-status').textContent=result.reason+' Choisissez une autre touche, ou Échap pour annuler.';return;}
      const id=bindingAction;prefs.bindings=result.bindings;bindingAction=null;settings();$('binding-status').textContent='Touche enregistrée : '+FOptions.keyName(e.code)+'.';$('bind-'+id).focus();return;
    }
    if(e.metaKey||e.altKey||(e.ctrlKey&&!e.code.startsWith('Control')))return;
    if(e.code==='Escape'){e.preventDefault();if(!e.repeat)togglePause();return;}
    if(FOptions.matches(prefs.bindings,'pause',e.code)){e.preventDefault();if(!e.repeat)togglePause();return;}
    if(mode!=='playing'||['INPUT','SELECT','TEXTAREA'].includes(e.target?.tagName))return;
    const match=id=>FOptions.matches(prefs.bindings,id,e.code);
    if(FOptions.actions.some(a=>match(a.id)))e.preventDefault();
    keys.add(e.code);if(match('jump')&&!e.repeat)jumpQueued=true;if(match('switchProfile')&&!e.repeat)switchProfileQueued=true;if(match('weaponNext')&&!e.repeat)switchWeapon();if(match('dash')&&!e.repeat)dashQueued=true;if(match('pulse')&&!e.repeat)pulseQueued=true;if(match('melee')&&!e.repeat)meleeQueued=true;if(match('interact')&&!e.repeat)interactQueued=true;
    if(!e.repeat){if(match('fire'))pressFire();if(match('fireLeft'))pressFire(true);}
    if(!e.repeat)for(let i=0;i<5;i++)if(match('weapon'+(i+1)))switchWeapon(i);
    if(match('leftHand')&&!e.repeat)switchLeft();
    if(match('view')&&!e.repeat)toggleView();
    if(match('map')&&!e.repeat){$('radar-wrap').hidden=!$('radar-wrap').hidden;drawRadar();}
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('click',titleUserGesture,{capture:true,passive:true});
  addEventListener('pointerup',titleUserGesture,{capture:true,passive:true});
  addEventListener('wheel',e=>{
    if(mode!=='playing'||!Number.isFinite(e.deltaY)||!e.deltaY)return;
    e.preventDefault();const direction=e.deltaY>0?1:-1,now=performance.now();
    if(direction!==wheelDirection){wheelDistance=0;wheelDirection=direction;}
    if(now-wheelAt<150)return;
    wheelDistance+=e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?innerHeight:1);
    if(Math.abs(wheelDistance)<100)return;
    wheelDistance=0;wheelAt=now;switchWeapon(undefined,direction);
  },{passive:false});
  document.addEventListener('pointerlockchange',()=>{
    const locked=document.pointerLockElement===canvas;
    // A cancelled request can still succeed through a promise or a legacy
    // document event. Only a fresh gesture may make that acquisition wanted.
    if(locked&&(mode!=='playing'||!pointerLockWanted)){wasLocked=false;document.exitPointerLock();return;}
    if(wasLocked&&!locked&&mode==='playing'&&controls.device!=='gamepad')setMode('paused');
    if(locked&&captureMouseButton!==null)toast('Souris capturée · relâchez puis cliquez pour tirer.',3);
    wasLocked=locked;
  });
  document.addEventListener('pointerlockerror',freePointerHint);
  document.addEventListener('mousemove',e=>{if(e.movementX||e.movementY)activeDevice('mouse');if(mode==='playing'&&document.pointerLockElement===canvas){lookDX+=e.movementX*.0022*prefs.sensitivity;lookDY-=e.movementY*.0022*prefs.sensitivity*(prefs.invertY?-1:1);}});
  // Mouse down/up report every button transition. Pointer down/up only report
  // the first pressed/last released mouse button, which would break dual fire.
  canvas.addEventListener('mousedown',e=>{if(mode!=='playing'||captureMouseButton!==null||document.pointerLockElement!==canvas)return;if(e.button===0){mouseFire=true;pressFire();}else if(e.button===2){mouseLeftFire=true;pressFire(true);}});
  function paintStick(){
    const zone=$('move-zone'),knob=$('move-stick'),p=touchControls.stick;
    zone.classList.toggle('running',!!p?.run);
    if(p){zone.style.left=(p.x-p.radius)+'px';zone.style.top=(p.y-p.radius)+'px';zone.style.bottom='auto';zone.style.width=zone.style.height=(p.radius*2)+'px';knob.style.transform='translate('+(p.dx*.62)+'px,'+(p.dy*.62)+'px)';}
    else{for(const k of ['left','top','bottom','width','height'])zone.style[k]='';knob.style.transform='';}
  }
  function beginTouch(role,e,target){
    if(mode!=='playing'||loadoutOpen||target.disabled)return false;
    activeDevice('touch');e.preventDefault();
    if(!touchControls.begin(role,e.pointerId,e.clientX,e.clientY,Math.max(48,Math.min(64,Math.min(innerWidth,innerHeight)*.144))))return false;
    target.setPointerCapture(e.pointerId);paintStick();return true;
  }
  function movePointer(e){if(mode==='playing'&&touchControls.move(e.pointerId,e.clientX,e.clientY)){e.preventDefault();paintStick();}}
  canvas.addEventListener('pointerdown',e=>{
    if(mode!=='playing'||loadoutOpen)return;
    if(e.pointerType==='mouse'){activeDevice('mouse');if(document.pointerLockElement!==canvas){captureMouseButton=e.button??0;mouseFire=mouseLeftFire=false;dragLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);toast('Capture de la souris · ce clic ne tire pas.',3);lock();}}
    else beginTouch(e.clientX<innerWidth*.4?'move':'look',e,canvas);
  });
  canvas.addEventListener('pointermove',e=>{movePointer(e);if(e.pointerType==='mouse'&&dragLook?.id===e.pointerId&&!document.pointerLockElement&&mode==='playing'){lookDX+=(e.clientX-dragLook.x)*.003*prefs.sensitivity;lookDY-=(e.clientY-dragLook.y)*.003*prefs.sensitivity*(prefs.invertY?-1:1);dragLook.x=e.clientX;dragLook.y=e.clientY;}});
  function endMouse(e){if(e.button===captureMouseButton)captureMouseButton=null;if(e.button===0)mouseFire=false;else if(e.button===2)mouseLeftFire=false;if(!mouseFire&&!mouseLeftFire)dragLook=null;}
  addEventListener('mouseup',endMouse);
  function endPointer(e){
    const role=touchControls.role(e.pointerId);
    if(role&&e.type!=='pointerup'){if(role==='fire')firePressed=false;if(role==='fireLeft')fireLeftPressed=false;}
    if(touchControls.end(e.pointerId))paintStick();if(e.pointerId===touchJump)touchJump=null;if(e.pointerId===touchDescend)touchDescend=null;
    if(e.pointerType==='mouse'&&(e.type==='pointercancel'||e.buttons===0)){mouseFire=mouseLeftFire=false;captureMouseButton=null;if(e.type==='pointercancel'){clearFireIntents();++pointerRequestSerial;if(document.pointerLockElement!==canvas)pointerLockWanted=false;}}
    if(dragLook?.id===e.pointerId&&!mouseFire&&!mouseLeftFire)dragLook=null;
  }
  for(const name of ['pointerup','pointercancel','lostpointercapture'])addEventListener(name,endPointer);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  $('move-zone').addEventListener('pointerdown',e=>beginTouch('move',e,$('move-zone')));
  for(const [id,role] of [['fire-button','fire'],['left-fire-button','fireLeft'],['jump-button','jump'],['dash-button','descend']])$(id).addEventListener('pointerdown',e=>{
    if(!beginTouch(role,e,$(id)))return;
    if(role==='jump'){touchJump=e.pointerId;jumpQueued=true;}else if(role==='descend'){touchDescend=e.pointerId;if(sim.state.activeProfile!=='light')dashQueued=true;}else pressFire(role==='fireLeft');
  });
  for(const id of ['move-zone','fire-button','left-fire-button','jump-button','dash-button'])$(id).addEventListener('pointermove',movePointer);
  function requestProfileSwitch(){if(mode!=='playing'||!sim.state.activeProfile)return;switchProfileQueued=true;}
  $('profile-button').addEventListener('pointerdown',e=>{if(mode!=='playing')return;activeDevice(e.pointerType==='mouse'?'keyboard':'touch');e.preventDefault();requestProfileSwitch();});
  $('profile-button').addEventListener('click',e=>{if(e.detail===0)requestProfileSwitch();});
  $('profile-button').addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();if(!e.repeat)requestProfileSwitch();}});
  $('pulse-button').addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();pulseQueued=true;});
  $('melee-button').addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();meleeQueued=true;});
  function interactPress(e){if(mode!=='playing'||$('interact-button').disabled)return;e.preventDefault();interactQueued=true;canvas.focus({preventScroll:true});}
  $('interact-button').addEventListener('pointerdown',interactPress);$('interact-button').addEventListener('click',e=>{if(e.detail===0)interactPress(e);});
  $('immersive-button').addEventListener('click',()=>host.immersive());
  $('gyro-mode').addEventListener('change',async()=>{prefs.gyroMode=$('gyro-mode').value;const on=await host.enableGyro(prefs.gyroMode!=='off');if(!on)prefs.gyroMode='off';settings();});
  addEventListener('blur',()=>{windowFocused=false;controls.clear();audio.cancelTestMix?.();if(mode==='playing')setMode('paused');else{audioGate();syncTitle();}});
  addEventListener('focus',()=>{sceneDirty=true;windowFocused=true;syncTitle();audioGate();});
  document.addEventListener('visibilitychange',()=>{sceneDirty=true;if(document.hidden){controls.clear();audio.cancelTestMix?.();if(mode==='playing')setMode('paused');}else windowFocused=document.hasFocus?.()!==false;syncTitle();audioGate();});
  addEventListener('resize',()=>{sceneDirty=true;renderer?.resize(quality);});
  canvas.addEventListener('webglcontextrestored',()=>{sceneDirty=true;});
  canvas.addEventListener('webglcontextlost',()=>{if(mode==='playing')setMode('paused');});
  try{
    renderer=FRender.create(canvas,{sceneReflections:true,advancedSky:true,composition:true,dither:true,resolution:'native',renderScale:prefs.renderScale,onBudget:()=>{if(prefs.fpsLimit===-1&&autoCadence===60)cadencePending=30;}});renderer.resize(quality);document.body.dataset.renderer=renderer.stats.backend||'webgl2';
    // First launch: lighter defaults on integrated or software graphics.
    {const info=window.MetalPerf?.probe(renderer.gl,navigator),applied=info&&MetalPerf.preset(prefs,info);if(info)document.body.dataset.gpuTier=info.tier;if(applied){if(prefs.quality!==quality){quality=prefs.quality;renderer.resize(quality);}settings();if(applied.changes.length)toast('Réglages adaptés à cet ordinateur : image allégée · Options › Image',4);}}
    savedRun=readSave();refreshContinue();
    if(preparationJobs.mode==='main')load(0);
    else prepareWorld(0,seed).then(()=>{if(!sim&&!preparationSerial&&titleScreen()){load(0);settings();}}).catch(error=>{console.error('METAL world preparation:',error);});
    settings();requestAnimationFrame(frame);
    window.FMusic?.warmup?.('title').catch(error=>console.error('METAL audio preparation:',error));
    // Les pièces que le chef d'orchestre peut demander en cours de partie sont
    // préparées en tâche de fond : la synthèse est déjà découpée en tâches
    // d'écran de chargement, aucune ne bloque une image de jeu.
    for(const cue of (window.FMusic?.cueIds?.()||[]))window.FMusic?.warmup?.(cue).catch(error=>console.error('METAL audio preparation:',error));
  }catch(error){$('intro').hidden=true;$('error').hidden=false;$('error-copy').textContent='Le moteur graphique n’a pas pu démarrer. Essayez de recharger la page ou d’utiliser un navigateur récent.';console.error('METAL initialization:',error);}
})();

