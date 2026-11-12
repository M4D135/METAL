/* FERRO — browser shell, checkpoints and procedural characters. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('world'),clamp=FSimulation.clamp;
  const touch=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>1||new URLSearchParams(location.search).get('touch')==='1';
  document.body.classList.toggle('touch',touch);
  let prefs=FOptions.defaults(touch);
  try{prefs=FOptions.normalize(JSON.parse(localStorage.getItem('ferro-settings')||'{}'),touch);}catch{}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)prefs.softMotion=false;
  let {muted,quality,softMotion}=prefs,bindingAction=null,optionsTab='game';
  const audio=FAudio.create(),motion=FMotion.create(),leftMotion=FMotion.create(),brain=window.FBrain?.create({mode:prefs.aiAcceleration}),SAVE_KEY='ferro-expedition-v2';
  let renderer,world,sim,stage=0,seed=96,campaignMode=true,mode='menu',last=performance.now(),clock=0,hudWait=0,toastTime=0,encounterTime=0,wasLocked=false,perfStart=0,perfFrames=0,renderRevision=-1;
  const emptyStats=()=>({time:0,kills:0,shots:0,hits:0,score:0});
  let runStats=emptyStats(),checkpoint=null,savedRun=null,selectedWeapon=0,stageEntryLoadout=null,currentShopId=null,saveAvailable=true,checkpointPending=false,lastFootstep=0,outdoorMix=0;
  const weaponNames=['Mitraillette','Double pompe','Lance-roquettes','Lance-grenades','Pistolet'],ammoNames=['balles','cartouches','roquettes','grenades','balles'];
  const worldCache=new Map();let preparationSerial=0,shieldLift=0;
  const actorMotion=new Map(),systemMotion=new Map();
  const keys=new Set(),input={moveX:0,moveY:0,lookX:0,lookY:0,fire:false,fireLeft:false,dash:false,pulse:false,melee:false,interact:false,weapon:0,sprint:false,assist:touch};
  let mouseFire=false,mouseLeftFire=false,touchFire=false,touchLeftFire=false,dragLook=null,moveTouch=null,stick={x:0,y:0},lookDX=0,lookDY=0,dashQueued=false,pulseQueued=false,meleeQueued=false,interactQueued=false;
  function copyLoadout(value){
    if(!value)return null;const inventory=value.inventory||value,economy=window.FEconomy?.copy(value.economy||window.FEconomy?.fresh());
    if(value.economy&&!economy)return null;const five=inventory?.weapons?.length===5,caps=economy?FEconomy.ammoCaps(economy,{campaign:five}):[180,36,12,16,1];
    if(!inventory||!Array.isArray(inventory.weapons)||![3,4,5].includes(inventory.weapons.length)||(five?!inventory.weapons.some(Boolean):!inventory.weapons[0])||!Array.isArray(inventory.ammo)||inventory.ammo.length!==inventory.weapons.length)return null;
    for(let i=0;i<inventory.weapons.length;i++)if(typeof inventory.weapons[i]!=='boolean'||!Number.isInteger(inventory.ammo[i])||inventory.ammo[i]<0||inventory.ammo[i]>(caps[i]??16))return null;
    if((inventory.weapons.length>=4||inventory.shield!==undefined)&&typeof inventory.shield!=='boolean')return null;
    const campaign=value.campaign===undefined?null:FSimulation.copyCampaign?.(value.campaign,inventory);if(value.campaign!==undefined&&!campaign)return null;
    let equipment;if(value.equipment){const q=value.equipment,left=q.left??null;if(!Number.isInteger(q.right)||!inventory.weapons[q.right]||left!==null&&left!=='shield'&&(!Number.isInteger(left)||!inventory.weapons[left]||left===q.right)||left==='shield'&&!inventory.shield||q.shieldEnergy!==undefined&&(!Number.isFinite(q.shieldEnergy)||q.shieldEnergy<0||q.shieldEnergy>100))return null;equipment={right:q.right,left,shieldEnergy:q.shieldEnergy??100};}
    const armor=value.armor===undefined?null:FSimulation.copyArmor?.(value.armor,inventory.shield&&equipment?.left==='shield'?200:100);if(value.armor!==undefined&&!armor)return null;
    return {inventory:{weapons:inventory.weapons.slice(),ammo:inventory.ammo.slice(),...(inventory.shield!==undefined?{shield:inventory.shield}:{})},...(economy?{economy}:{}),...(equipment?{equipment}:{}),...(campaign?{campaign}:{}),...(armor?{armor}:{})};
  }
  function cachedWorld(n,worldSeed,campaign=campaignMode){const key=(campaign?'campaign:':'classic:')+worldSeed+':'+n;if(!worldCache.has(key)){worldCache.set(key,FWorld.create(worldSeed,n,campaign?{campaign:true}:undefined));while(worldCache.size>2)worldCache.delete(worldCache.keys().next().value);}return worldCache.get(key);}
  function trackLabel(){const t=window.FMusic?.getTrack?.(world?.stage??stage%3);return t?t.title+' · '+t.bpm+' BPM':'METAL · MOD PROCÉDURAL';}
  function brainStatus(){const status=brain?.status;$('ai-setting').value=prefs.aiAcceleration;$('ai-status').textContent=status?.label||'Décisions tactiques locales · traitement CPU.';}
  function saveSettings(){try{localStorage.setItem('ferro-settings',JSON.stringify(prefs));}catch{}}
  function bindingLabel(id){return (prefs.bindings[id]||[]).map(FOptions.keyName).join(' / ');}
  function weaponHint(){const keys=Array.from({length:world?.campaign?5:4},(_,i)=>bindingLabel('weapon'+(i+1)));$('weapon-switch').title='Armes : '+keys.join(' / ')+' ou molette';}
  function renderBindings(){
    $('key-bindings').innerHTML=FOptions.actions.map(a=>'<div class="binding-row"><span>'+a.label+'</span><button id="bind-'+a.id+'" class="'+(bindingAction===a.id?'listening':'')+'" aria-label="Modifier la touche : '+a.label+'">'+(bindingAction===a.id?'Touche…':bindingLabel(a.id))+'</button></div>').join('');
    for(const a of FOptions.actions)$('bind-'+a.id).addEventListener('click',()=>{bindingAction=a.id;$('binding-status').textContent='Appuyez sur une touche pour « '+a.label+' ». Échap pour annuler.';renderBindings();$('bind-'+a.id).focus();});
  }
  function selectTab(name,focus=false){
    if(optionsTab==='audio'&&name!=='audio')audio.cancelTestMix?.();
    if(name==='game')brainStatus();
    optionsTab=name;bindingAction=null;
    for(const id of ['game','image','audio','controls']){const active=id===name;$('tab-'+id).setAttribute('aria-selected',String(active));$('tab-'+id).tabIndex=active?0:-1;$('pane-'+id).hidden=!active;}
    $('options-body').scrollTop=0;$('binding-status').textContent='Cliquez sur une touche pour la modifier. Échap annule. Le clic gauche et la molette restent disponibles.';
    renderBindings();if(focus)$('tab-'+name).focus();
  }
  function settings(){
    Object.assign(prefs,{muted,quality,softMotion});
    $('intro-sound').textContent=muted?'SON COUPÉ':'SON ACTIVÉ';
    $('sound-toggle').querySelector('strong').textContent=muted?'Coupé':'Activé';
    $('quality-toggle').querySelector('strong').textContent={auto:'Auto',low:'Économie',high:'Haute'}[quality];
    $('difficulty-setting').value=String(prefs.difficulty);$('difficulty-hint').textContent=['Standard · apprenez à lire les attaques ; la pression monte avec les secteurs et les objectifs.','Brutal · des machines plus agressives, des tirs plus rapprochés et moins de répit.','Cauchemar · des attaques plus rapides, des impacts plus durs et une forte pression.'][prefs.difficulty];brainStatus();
    $('motion-toggle').querySelector('strong').textContent=softMotion?'Doux':'Désactivés';
    for(const [id,key,on,off] of [['shadows','shadows','Activées','Désactivées'],['bloom','bloom','Activé','Désactivé'],['fps','showFps','Visible','Masqué'],['crt','crt','Activé','Désactivé'],['vignette','vignette','Activée','Désactivée'],['invert','invertY','Oui','Non']]){const el=$(id+'-toggle');el.querySelector('strong').textContent=prefs[key]?on:off;el.setAttribute('aria-pressed',String(prefs[key]));}
    for(const [id,key,multiplier,suffix] of [['fov','fov',1,'°'],['brightness','brightness',100,' %'],['sensitivity','sensitivity',100,' ×'],['crosshair','crosshairScale',100,' %'],['master','masterVolume',100,' %'],['music','musicVolume',100,' %'],['effects','effectsVolume',100,' %'],['ambience','ambienceVolume',100,' %']]){
      $(id+'-setting').value=String(Math.round(prefs[key]*multiplier));$(id+'-value').textContent=(id==='sensitivity'?prefs[key].toFixed(2).replace('.',','):Math.round(prefs[key]*multiplier))+suffix;
    }
    $('fps-limit').value=String(prefs.fpsLimit);$('fps-counter').hidden=!prefs.showFps;$('scanlines').hidden=!prefs.crt;$('vignette').hidden=!prefs.vignette;
    $('crosshair').style.scale=String(prefs.crosshairScale);canvas.style.filter=prefs.brightness===1?'none':'brightness('+prefs.brightness+')';
    $('interact-key').textContent=FOptions.keyName(prefs.bindings.interact[0]);
    $('map-button').title='Carte ('+bindingLabel('map')+')';weaponHint();
    if(!touch)$('intro-controls').textContent=JSON.stringify(prefs.bindings)===JSON.stringify(FOptions.defaults(false).bindings)?'ZQSD / WASD · Souris · Clic pour tirer':'Commandes personnalisées · Souris · Clic pour tirer';
    $('music-title').textContent=trackLabel();
    const software=renderer?.stats.backend==='canvas2d';
    $('bloom-toggle').disabled=software;$('graphics-hint').textContent=software?'Rendu CPU de secours : WebGL 2 est indisponible dans ce navigateur. Auto adapte la résolution ; les ombres restent réglables.':'Rendu GPU · WebGL 2. Auto adapte la résolution à la fluidité. Haute augmente la portée et la précision. Les réglages sont appliqués immédiatement.';
    if(!touch)$('help-text').innerHTML=bindingLabel('forward')+' / '+bindingLabel('left')+' / '+bindingLabel('back')+' / '+bindingLabel('right')+' : déplacer · Souris : viser<br>Clic / '+bindingLabel('fire')+' : tirer · '+bindingLabel('weapon1')+' / '+bindingLabel('weapon2')+' / '+bindingLabel('weapon3')+' / '+bindingLabel('weapon4')+' / '+bindingLabel('weapon5')+' : armes trouvées<br>Clic droit / '+bindingLabel('fireLeft')+' : main gauche · '+bindingLabel('leftHand')+' : équipement gauche<br>'+bindingLabel('interact')+' : commandes et ascenseurs · '+bindingLabel('pulse')+' : onde défensive<br>'+bindingLabel('melee')+' : coup de crosse · '+bindingLabel('dash')+' : esquive / coup de bouclier<br>'+bindingLabel('sprint')+' : courir · '+bindingLabel('map')+' : carte · Échap : pause';
    const silent=[['musicVolume','Musique coupée'],['effectsVolume','Effets coupés'],['ambienceVolume','Ambiances coupées']].filter(([key])=>prefs[key]===0).map(([,label])=>label);
    $('audio-status').textContent=muted||prefs.masterVolume===0?'Son coupé. Activez le son et le volume général pour écouter.':silent.length?silent.join(' · ')+'. Réglez les curseurs pour les entendre.':'Les tirs et impacts passent devant la musique. Les ambiances restent spatialisées.';
    document.body.classList.toggle('low-motion',!softMotion);audio.setMuted(muted||['menu','paused','options','shop','loading'].includes(mode));audio.setMix?.({master:prefs.masterVolume,music:prefs.musicVolume,effects:prefs.effectsVolume,ambience:prefs.ambienceVolume});saveSettings();renderBindings();
  }
  function toast(message,seconds=2.8){$('toast').textContent=message;$('toast').classList.add('visible');toastTime=seconds;}
  function encounter(name,caption){$('encounter-name').textContent=name;$('encounter-caption').textContent=caption;$('encounter').classList.add('visible');encounterTime=4.2;}
  const savedIndex=v=>v?.version===3?v.index:v?.stage??0;
  function validSave(v){
    const identity=v&&(v.version===2&&Number.isInteger(v.stage)&&v.stage>=0&&v.stage<3&&v.campaign!==true||v.version===3&&v.campaign===true&&Number.isInteger(v.index)&&v.index>=0&&v.index<18&&v.stage===v.index%3);
    if(!identity)return false;
    // Reject mixed classic/campaign checkpoints before load constructs a new
    // simulation. Reading an incompatible envelope leaves its source untouched.
    const campaign=v.version===3,state=v.checkpoint?.state;
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
  function saveCheckpoint(){
    if(!sim||sim.state.dead||sim.state.won)return;
    if(sim.state.player.airborne){checkpointPending=true;return;}
    checkpointPending=false;
    checkpoint=sim.snapshot();
    savedRun={version:world.campaign?3:2,...(world.campaign?{campaign:true,index:stage}:{}),generation:world.generation||3,seed,stage:world.campaign?world.stage:stage,runStats:{...runStats},entryLoadout:copyLoadout(stageEntryLoadout),checkpoint};
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(savedRun));saveAvailable=true;}catch{saveAvailable=false;}
    $('checkpoint-status').textContent='Reprise au dernier point enregistré.'+(saveAvailable?' Sauvegarde locale active.':' Reprise disponible pendant cette session.');
    refreshContinue();
  }
  function clearSave(){checkpoint=null;savedRun=null;try{localStorage.removeItem(SAVE_KEY);}catch{}refreshContinue();}
  function restoreRun(v){
    if(!validSave(v))return false;
    load(savedIndex(v),v.seed,copyLoadout(v.entryLoadout||v.entryInventory),v.version===3);
    if((v.generation||3)!==(world.generation||3)||!sim.restore(v.checkpoint,{recover:true}))return false;
    sim.setDifficulty?.(prefs.difficulty);
    runStats={...v.runStats};checkpoint=v.checkpoint;savedRun=v;selectedWeapon=sim.state.weapon;
    $('checkpoint-status').textContent='Reprise au dernier point enregistré.'+(saveAvailable?' Sauvegarde locale active.':' Reprise disponible pendant cette session.');
    renderHUD();return true;
  }
  function resumeSaved(v){
    if(restoreRun(v)){start('Signal retrouvé. Reprise au dernier point enregistré.');return;}
    if(validSave(v)){
      // Retain the old point separately when the new terrain makes its position invalid.
      try{if(!localStorage.getItem(SAVE_KEY+'-before-ascension'))localStorage.setItem(SAVE_KEY+'-before-ascension',JSON.stringify(v));}catch{}
      runStats={...v.runStats};selectedWeapon=[0,1,2,3,4].includes(v.checkpoint?.state?.weapon)?v.checkpoint.state.weapon:0;
      load(savedIndex(v),v.seed,undefined,v.version===3);saveCheckpoint();
      start(v.generation!==world.generation?'Les lieux ont changé. Reprise à l’entrée du même secteur ; progression précédente conservée.':'Point de reprise illisible. Reprise à l’entrée de ce secteur.');
    }else{runStats=emptyStats();selectedWeapon=0;load(0,96,undefined,true);saveCheckpoint();start(world.campaign?'Nouvelle expédition. Dix-huit mondes vous attendent.':'Nouvelle expédition. Trois secteurs vous attendent.');}
  }
  function clearInput(){keys.clear();mouseFire=mouseLeftFire=touchFire=touchLeftFire=false;dragLook=moveTouch=null;stick.x=stick.y=lookDX=lookDY=0;dashQueued=pulseQueued=meleeQueued=interactQueued=false;$('move-stick').style.transform='';}
  function setMode(value){
    audio.cancelTestMix?.();
    last=performance.now();perfStart=0;perfFrames=0;
    $('fps-counter').textContent='— FPS';document.body.dataset.fps='';
    mode=value;bindingAction=null;document.body.dataset.state=value;$('intro').hidden=value!=='menu';$('hud').hidden=!['playing','paused'].includes(value);$('pause').hidden=!['paused','options'].includes(value);$('shop').hidden=value!=='shop';$('loading').hidden=value!=='loading';$('result').hidden=!['dead','cleared','complete'].includes(value);clearInput();audio.setMuted(muted||['menu','paused','options','shop','loading'].includes(value));audio.setPlaying?.(value==='playing');
    if(value==='paused'||value==='options'){$('pause-kicker').textContent=value==='options'?'CONSOLE DE RÉGLAGE':'SIGNAL EN ATTENTE';$('resume').innerHTML=(value==='options'?'Retour':'Reprendre')+' <span class="arrow-icon" aria-hidden="true"></span>';$('restart').hidden=$('pause-main').hidden=value==='options';selectTab(value==='options'?'image':optionsTab);}
    if(value!=='playing'){audio.setSteam?.(0);if(document.pointerLockElement)document.exitPointerLock();}
  }
  function load(n,newSeed,loadout,asCampaign=campaignMode){
    checkpointPending=false;
    campaignMode=asCampaign;stage=n;if(newSeed!==undefined)seed=newSeed;world=cachedWorld(stage,seed,campaignMode);
    const entry=copyLoadout(loadout),slots=world.progression?.version===1&&(world.progression.weaponSlots===4||world.campaign===true&&world.progression.weaponSlots===5)?world.progression.weaponSlots:3;
    // Optional entry metadata must fit the actual generated arsenal. A stale
    // 3/4/5-slot entry cannot block restoration of a healthy checkpoint.
    const carry=entry&&(entry.inventory.weapons.length===slots||slots===4&&entry.inventory.weapons.length===3)?entry:null;
    sim?.dispose?.();sim=FSimulation.create(world,{...(carry||{}),armorSystem:true,...(brain?{brain}:{})});sim.setDifficulty?.(prefs.difficulty);
    if(sim.selectWeapon)sim.selectWeapon(carry?.equipment?.right??selectedWeapon);else sim.state.weapon=selectedWeapon;
    selectedWeapon=sim.state.weapon;stageEntryLoadout=copyLoadout(sim.exportLoadout?.()||sim.exportInventory?.());
    renderer.setWorld(sim.destruction?.meshes||world.meshes,sim.destruction?.lights||world.lights,world.environment);renderRevision=sim.state.destructionRevision??sim.destruction?.revision??-1;
    motion.reset();leftMotion.reset();shieldLift=0;lastFootstep=0;actorMotion.clear();systemMotion.clear();encounterTime=0;$('encounter').classList.remove('visible');outdoorMix=isOutdoors(sim.state.player.x,sim.state.player.z)?1:0;
    audio.setStage?.(world.stage);audio.setEnvironment?.(world.environment,outdoorMix);audio.setMachinery?.(0);audio.setSteam?.(0);
    $('music-title').textContent=trackLabel();
    $('sector-number').textContent=(world.campaign?'MONDE ':'SECTEUR ')+String(stage+1).padStart(2,'0')+(world.campaign?' / 18':' / 03');$('sector-title').textContent=(world.campaign?world.chapterTitle+' · ':'')+world.title;
    $('mission-summary').innerHTML=world.campaign?'<span><b>18</b> MONDES</span><span><b>6</b> CHAPITRES</span><span><b>100 %</b> PROCÉDURAL</span>':'<span><b>430</b> MACHINES</span><span><b>3</b> COLOSSES</span><span><b>6</b> ASCENSEURS</span>';
    $('restart').textContent=world.campaign?'RECOMMENCER CE MONDE':'RECOMMENCER CE SECTEUR';
    document.body.dataset.stage=String(stage+1);document.body.dataset.campaign=String(!!world.campaign);$('radar-wrap').hidden=false;hudWait=0;renderHUD();weaponHint();
  }
  function syncDestruction(){
    const d=sim?.destruction,revision=sim?.state.destructionRevision??d?.revision;if(!d||revision===renderRevision)return;
    if(renderer.updateWorld)renderer.updateWorld(d.meshes,revision,d.lights);else renderer.setWorld(d.meshes,d.lights||world.lights,world.environment);
    renderRevision=revision;
  }
  function lock(){
    if(touch)return;
    try{const result=canvas.requestPointerLock?.();if(result?.catch)result.catch(()=>{if(toastTime<=0)toast('Maintenez et glissez pour regarder. Flèches : tourner.',4);});}catch{if(toastTime<=0)toast('Glissez pour regarder. Flèches : tourner.',4);}
  }
  function start(message){
    audio.start();audio.resume();setMode('playing');lock();canvas.focus({preventScroll:true});
    toast(message||(world.campaign&&stage===0?'Pistolet équipé · munitions illimitées. Clic : tirer ; premier trophée au monde 4.':world.campaign?'CHAPITRE '+(world.chapter+1)+' · '+world.chapterTitle+' — monde '+(stage+1)+' / 18. Explorez, équipez-vous et neutralisez le colosse.':stage===0?'Mitraillette équipée. Ramassez munitions et armes ; les machines arrivent par vagues.':stage===1?'Votre arsenal vous suit. Cherchez les réserves avant de déclencher les renforts.':'Gardez des munitions pour le Veilleur. Les réserves de l’arène sont limitées.'),5.5);
  }
  function newRun(newSeed){runStats=emptyStats();selectedWeapon=0;load(0,newSeed,undefined,true);saveCheckpoint();start();}
  async function preparePlay(nextStage,action,asCampaign=campaignMode){
    if(!window.FMusic?.warmup){action();return;}
    const ticket=++preparationSerial;audio.start();audio.resume();setMode('loading');$('loading-stage').textContent=(asCampaign?'MONDE ':'SECTEUR ')+String(nextStage+1).padStart(2,'0');$('loading-detail').textContent='Préparation des instruments et des réserves…';$('loading-bar').style.width='18%';
    try{
      // Two animation frames show the preparation screen before any substantial work.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      await Promise.all([FMusic.warmup(nextStage%3),brain?.prepare()]);await audio.prepare?.(nextStage%3);brainStatus();if(ticket!==preparationSerial)return;
      $('loading-detail').textContent='Assemblage du territoire et de la simulation…';$('loading-bar').style.width='76%';
      await new Promise(resolve=>requestAnimationFrame(resolve));if(ticket!==preparationSerial)return;
      action();
    }catch(error){setMode('menu');toast('Préparation interrompue. Réessayez depuis le menu.',4);console.error('METAL preparation:',error);}
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
    if(!dead&&!finished&&window.FMusic?.warmup){const nextStage=stage+1,nextSeed=seed,nextCampaign=!!world.campaign;FMusic.warmup(nextStage%3).then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))).then(()=>{if(mode==='cleared'&&seed===nextSeed&&stage+1===nextStage)cachedWorld(nextStage,nextSeed,nextCampaign);}).catch(error=>console.error('METAL preparation:',error));}
  }
  function formatTime(v){return Math.floor(v/60)+':'+String(Math.floor(v%60)).padStart(2,'0');}
  function events(){
    let checkpointDue=false;const trophyIds=new Set(sim.state.events.filter(e=>e.name==='trophy').map(e=>e.id));
    for(const e of sim.state.events){
      const handMotion=e.hand==='left'?leftMotion:motion;
      if(e.name==='rocket'||e.name==='grenadeLaunch'){if(e.owner==='player')handMotion.impulse('rocket');}
      else if(e.name==='shieldBash')leftMotion.impulse('melee');
      else if(e.name==='explosion'){const p=sim.state.player,d=Math.hypot((e.x??p.x)-p.x,(e.y??p.y)-p.y,(e.z??p.z)-p.z);motion.impulse('blast',clamp(1-d/14,0,1));leftMotion.impulse('blast',clamp(1-d/14,0,1));}
      else handMotion.impulse(e.name==='shot'&&e.weapon===4?'pistol':e.name);
      const sound=e.name==='waveStart'?'wave':e.name==='armorPickup'?'ammoPickup':e.name==='lootPickup'?(e.boss?'weaponPickup':'ammoPickup'):e.name;
      if(typeof audio[sound]==='function'&&!((e.name==='weaponPickup'||e.name==='shieldPickup')&&trophyIds.has(e.id))){
        const p=sim.state.player,d=Number.isFinite(e.x)?Math.hypot(e.x-p.x,e.z-p.z):0;
        const pan=Number.isFinite(e.x)?clamp(((e.x-p.x)*Math.cos(p.yaw)+(e.z-p.z)*Math.sin(p.yaw))/Math.max(1,d),-1,1):0;
        audio[sound]({...e,pan,level:1/(1+d*.055)});
      }
      if(e.name==='core'){
        checkpointDue=true;
        toast(e.count===3?(!systemsReady()?'Trois relais en ligne. Activez les commandes restantes.':sim.state.bossAlive?'Trois relais en ligne. Neutralisez le gardien.':'Trois relais en ligne. Rejoignez la sortie.'):'Relais '+e.count+' / 3 · intégrité restaurée · point de reprise',3.2);
      }
      if(e.name==='mechanism'){checkpointDue=true;const a=sim.state.mechanisms?.find(a=>a.id===e.id);toast((a?.name||'Commande')+' · alimentation rétablie · point de reprise',3.2);}
      if(e.name==='liftStop'&&e.carrying){checkpointDue=true;toast('Palier atteint · point de reprise',2.2);}
      if(e.name==='jumpPad'&&e.actor==='player')toast('PROPULSION · ajustez votre trajectoire en vol',1.6);
      if(e.name==='rocketDud'&&e.owner==='player')toast('Trop près : roquette non armée. Reculez pour tirer.',2.3);
      if(e.name==='pipeLeak'&&Math.hypot(e.x-sim.state.player.x,e.z-sim.state.player.z)<16)toast('CONDUITE PERCÉE · vapeur brûlante',2.1);
      if(e.name==='trap'&&Math.hypot(e.x-sim.state.player.x,e.z-sim.state.player.z)<10)toast('PIÈGE ACTIVÉ · quittez la dalle',1.5);
      if(e.name==='horror'&&e.kind==='alarm')toast('ALERTE LOCALE · des machines convergent',2.1);
      if(e.name==='pickup')toast('Intégrité restaurée',1.8);
      if(e.name==='armorPickup'){toast('+'+(Math.round(e.amount*10)/10)+' ARMURE · '+Math.ceil(e.points)+' / '+e.capacity,2.1);checkpointDue=true;}
      if(e.name==='lootPickup'){const gains=[];if(e.credits)gains.push('+'+e.credits+' CR');if(e.cores)gains.push('+'+e.cores+' NOYAU');if(e.armor)gains.push('+'+(Math.round(e.armor*10)/10)+' ARMURE');for(let i=0;i<4;i++)if(e.ammo?.[i])gains.push('+'+e.ammo[i]+' '+ammoNames[i]);toast((e.boss?'BUTIN DU COLOSSE · ':'RÉCUPÉRATION · ')+gains.join(' · '),e.boss?4:2);if(e.boss||e.armor>0)checkpointDue=true;}
      if(e.name==='shopOpen'){currentShopId=e.id;setMode('shop');renderShop();}
      if(e.name==='ammoPickup')toast('+'+e.amount+' '+ammoNames[e.weapon]+' · '+weaponNames[e.weapon],1.8);
      if(e.name==='weaponPickup'){selectedWeapon=sim.state.weapon;motion.impulse('switch');if(!trophyIds.has(e.id))toast(weaponNames[e.weapon].toUpperCase()+' RÉCUPÉRÉE'+(e.amount?' · +'+e.amount+' '+ammoNames[e.weapon]:''),3);checkpointDue=true;}
      if(e.name==='shieldPickup'){if(!trophyIds.has(e.id))toast(touch?'BOUCLIER EN MAIN GAUCHE · GARDE : protéger · flèche : frapper':'BOUCLIER EN MAIN GAUCHE · clic droit : garde · Espace : frappe',4);checkpointDue=true;}
      if(e.name==='trophy'){encounter(e.label|| (e.shield?'Bouclier':weaponNames[e.weapon]),e.usage||'NOUVEL ÉQUIPEMENT · PRÉPAREZ-VOUS À L’ÉPREUVE');encounterTime=Math.max(3,e.grace||3);checkpointDue=true;}
      if(e.name==='trophyComplete'){toast('ÉPREUVE RÉUSSIE · équipement maîtrisé · point de reprise',3);checkpointDue=true;}
      if(e.name==='empty')toast('MUNITIONS ÉPUISÉES · cherchez des réserves'+(touch?' · bouton Crosse':(' · '+bindingLabel('melee')+' : crosse')),2.1);
      if(e.name==='waveStart'){const c=sim.state.encounters?.find(c=>c.id===e.id),wave=c?Math.max(c.wave,c.pendingWave)+1:e.wave;toast((e.label||'RENFORTS')+' · VAGUE '+wave+' / '+(c?.waves?.length||e.total),2.7);}
      if(e.name==='encounterClear'){if(!sim.state.encounters?.find(q=>q.id===e.id)?.requiresTrophy)toast((e.label||'ZONE')+' · SÉCURISÉE · point de reprise',2.4);checkpointDue=true;}
      if(e.name==='overheat')toast('Surchauffe · laissez refroidir',1.6);
      if(e.name==='bossRoar'){const boss=sim.state.enemies.find(a=>a.id===e.id||a.id===e.bossId);if(boss)encounter(boss.bossName||'Le Colosse',e.phase>0?'PHASE '+(e.phase+1)+' · SURCHARGE':'COLOSSE ÉVEILLÉ · '+Math.round(3.325*(boss.bossScale||1))+' M');}
      if(e.name==='bossPhase')toast('SURCHARGE · le colosse change de rythme. Surveillez les zones au sol.',3.5);
      if(e.name==='bossDeath'){const boss=sim.state.enemies.find(a=>a.id===e.id);encounter(boss?.bossName||'Le Colosse','COLOSSE ABATTU');checkpointDue=true;}
      if(e.name==='win'){result(false);break;}
      if(e.name==='dead'){result(true,e.reason);break;}
    }
    sim.state.events.length=0;
    selectedWeapon=sim.state.weapon;
    if(checkpointDue||checkpointPending&&!sim.state.player.airborne)saveCheckpoint();
  }
  const m=(shape,p,s,mat,r=[0,0,0],emissive=0)=>({shape,p,s,mat,r,emissive});
  function renderShop(message){
    const shop=(world.shops||[]).find(q=>q.id===currentShopId),offers=sim.shopOffers?.(currentShopId),profile=sim.state.economy,stats=sim.stats||{maxHp:100};
    $('shop-title').textContent=shop?.name||'Atelier';$('shop-credits').textContent=String(profile?.credits||0);$('shop-cores').textContent=String(profile?.cores||0);
    $('shop-health').textContent=Math.ceil(sim.state.player.hp)+' / '+stats.maxHp;$('shop-build').textContent='Blindage '+Math.round((1-(stats.incomingMultiplier??1))*100)+' % · Puissance +'+Math.round(((stats.damageMultiplier??1)-1)*100)+' % · Capacité '+(sim.ammoCaps||[180,36,12]).join(' / ');
    $('shop-status').textContent=message||(!offers?'Approchez-vous d’un atelier pour acheter.':'Les crédits et noyaux se récupèrent sur les machines. Les achats sont définitifs dans ce point de reprise.');
    $('shop-offers').innerHTML=(offers||[]).map(q=>{const item=q.item||q,label=item.label||item.id,cost=q.cost||{credits:0,cores:0},price=!q.ok&&!cost.credits&&!cost.cores?'—':cost.credits+' CR'+(cost.cores?' + '+cost.cores+' NOYAU'+(cost.cores>1?'X':''):''),rank=item.kind==='upgrade'?'RANG '+(q.rank||0)+' / '+(item.maxRank||3):item.kind==='repair'?'RÉPARATION':(item.kind==='weapon'||item.kind==='shield')?'ÉQUIPEMENT':'RAVITAILLEMENT';return '<article class="shop-card '+(!q.ok?'unavailable':'')+'"><span class="shop-category">'+rank+'</span><h3>'+label+'</h3><p>'+item.description+'</p><div class="shop-purchase"><strong>'+price+'</strong><button id="buy-'+item.id+'" '+(!q.ok?'disabled':'')+' aria-label="Acheter '+label+'">'+(q.ok?'ACHETER':q.message||'INDISPONIBLE')+'</button></div></article>';}).join('');
    for(const q of offers||[]){const id=(q.item||q).id;$('buy-'+id).addEventListener('click',()=>{const result=sim.buy?.(currentShopId,id);if(result?.ok){events();saveCheckpoint();renderHUD();renderShop((q.item||q).label+' · achat enregistré.');}else renderShop(result?.message||result?.reason||'Achat indisponible.');});}
  }
  function systemsReady(){return (sim.state.mechanisms||[]).every(a=>!a.required||a.active);}
  function exitReady(){return sim.state.relays===3&&systemsReady()&&!sim.state.bossAlive;}
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
    out.push(m('ring',[c.x,(c.y||0)+.055,c.z],[kind==='weapon'?1.2:.7,.045,kind==='weapon'?1.2:.7],mat,[0,0,0],.45));
    if(kind==='salvage'||kind==='boss'){
      const boss=kind==='boss';part('box',[0,-.05,0],[boss?.75:.38,boss?.42:.23,boss?.55:.31],0);part('box',[0,boss?.18:.085,0],[boss?.62:.3,.045,boss?.45:.23],1);
      for(const side of [-1,1])part('box',[side*(boss?.26:.11),.01,0],[.035,boss?.39:.2,boss?.56:.32],5,0,.35);
      if(c.cores)part('octa',[0,.46,0],[.26,.42,.26],5,0,1.2);else if(c.credits)part('octa',[0,.25,0],[.18,.16,.18],5,0,.5);else if(c.armor>0)part('bevel',[0,.26,0],[.19,.22,.065],4,0,.65);
      if(boss)part('ring',[0,.4,0],[.56,.04,.56],4,0,.6);return;
    }
    if(kind==='health'){
      part('box',[0,0,0],[.45,.32,.4]);part('box',[0,.17,0],[.28,.035,.085],4,0,.8);part('box',[0,.17,0],[.085,.035,.28],4,0,.8);return;
    }
    if(kind==='armor'){
      part('bevel',[0,.035,0],[.38,.38,.14],1);part('bevel',[0,-.18,.012],[.25,.12,.13],0);
      for(const side of [-1,1]){part('bevel',[side*.23,.17,0],[.16,.11,.18],1);part('box',[side*.13,.04,-.077],[.026,.25,.016],4,0,.65);}
      part('octa',[0,.06,-.085],[.075,.09,.035],4,0,.85);return;
    }
    if(kind==='shield'){
      part('bevel',[0,.05,0],[.43,.6,.06],4,0,.5);for(const side of [-1,1])part('bevel',[side*.215,.05,.02],[.04,.47,.06],0);part('ring',[0,.05,.05],[.18,.035,.18],1,Math.PI/2);part('box',[0,-.1,.09],[.08,.21,.06]);return;
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
  function models(t,playing,camera){
    const out=[],s=sim.state,p=s.player;machinery(out,t);ambience(out,t);systems(out,t);
    if(window.FEffects)out.push(...FEffects.build(s,world,camera,{quality,backend:renderer.stats.backend}));
    // All registered machines remain in the simulation; distance only reduces model detail.
    // Match the renderer's whole approach transition conservatively. The renderer
    // still chooses the actual range; this early filter must never shorten it.
    const longView=(world.environment?.longViewZones||[]).some(a=>Math.abs(p.x-a.x)<=a.w/2+35&&Math.abs(p.z-a.z)<=a.d/2+35);
    const range=longView?100:renderer.stats.backend==='canvas2d'?(quality==='high'?55:quality==='low'?32:44):(quality==='high'?90:quality==='low'?54:70);
    const nearby=(x,z,r=3)=>(x-p.x)**2+(z-p.z)**2<(range+r)**2;
    const actorVisible=renderer.actorFilter?.(camera,{shadows:prefs.shadows})||(()=>true);
    for(const c of s.cores){
      if(!nearby(c.x,c.z))continue;
      out.push(m('cylinder',[c.x,(c.y||0)+.13,c.z],[.95,.26,.95],0),m('ring',[c.x,(c.y||0)+.29,c.z],[1.15,.1,1.15],c.taken?0:5));
      if(!c.taken){const y=(c.y||0)+1.22+Math.sin(t*2+c.id)*.13;out.push(m('octa',[c.x,y,c.z],[.55,.85,.55],5,[0,t*.7,0],1.8),m('ring',[c.x,y,c.z],[1.2,1.2,1.2],4,[Math.PI/2,0,t*.35],1.2));}
    }
    for(const e of s.enemies){
      const scale=e.type===3?Math.max(1,Number(e.bossScale)||1):1,giant=scale>1;
      if(e.deployed===false||e.hp<=0||!nearby(e.x,e.z,e.type===3?4.5*scale:2))continue;
      if(!actorVisible(e.x,(e.baseY||0)+1.6*scale,e.z,e.type===3?4.5*scale:3.5))continue;
      const pose=actorMotion.get(e.id),distance=Math.hypot(e.x-p.x,e.z-p.z),base=e.baseY||0;
      out.push(...FActors.build(e,{time:t,phase:pose?.phase,blend:pose?.blend,distance,quality,backend:renderer.stats.backend}));
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
    for(const c of [...s.pickups,...(s.loot||[])])if(supplyVisible(c)&&nearby(c.x,c.z))supplyModel(out,c,t);
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
    if(playing){
      const left=s.equipment?.left??null,paired=left!==null;
      function drawGun(weapon,hand){
      const fracture=weapon===1,rocket=weapon===2,grenade=weapon===3,pistol=weapon===4,pose=(hand<0?leftMotion:motion).view.weapon,slide=pose.slide,flash=hand<0?(s.leftFlash||0):s.flash;
      const grip=FMotion.mount(camera,[hand*.255*Math.min(1,Math.max(.45,(innerWidth/innerHeight)/1.2))+pose.offset[0]*hand,(paired?-.34:-.30)+pose.offset[1],(paired?-.70:-.62)+pose.offset[2]],[pose.rotation[0],pose.rotation[1]*hand,pose.rotation[2]*hand]);
      function gun(shape,x,y,z,siz,mat,rx=0,em=0,color){
        const part=FMotion.place(grip,[x*hand,y,z],rx),a=m(shape,part.p,siz,mat,part.r,em);a.overlay=true;a.surface='object';
        if(color)a.color=color;else if(mat===0)a.color=[.16,.19,.21];else if(mat===1)a.color=[.37,.35,.28];
        out.push(a);
      }
      gun('bevel',0,-.09,.12,[.15,.24,.16],7,-.2);
      // A gloved grip and its wrist remain attached to the complete, damped weapon assembly.
      gun('bevel',.013,-.2,.21,[.17,.11,.21],7,-.2);gun('box',.013,-.16,.2,[.18,.025,.18],0,-.2);
      gun('bevel',.018,-.27,.30,[.15,.17,.24],0,-.25,0,[.26,.28,.23]);
      for(let j=0;j<4;j++)gun('box',0,-.035-j*.031,.205,[.16,.023,.042],7,-.2);
      gun('box',-.087,-.07,.15,[.04,.09,.09],7,-.5);
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
      if(Number.isInteger(left))drawGun(left,-1);
      else if(left==='shield'){
        const guard=shieldLift,energy=clamp((s.shield?.energy??100)/100,0,1),bash=clamp((s.shield?.bashVisual||0)/.35,0,1),pose=leftMotion.view.weapon;
        // Keep the guard beside the right-hand assembly. Its former tall frame
        // crossed both the sight line and the firearm when raised.
        const narrow=clamp((innerWidth/innerHeight)/1.2,.45,1),thrust=Math.sin(bash*Math.PI),right=motion.view.weapon;
        const clearance=Math.max(0,-right.offset[0])+.6*Math.abs(right.rotation[1])+.3*Math.abs(right.rotation[2]);
        const mount=FMotion.mount(camera,[-.48+guard*.09-(1-narrow)*.11-thrust*.08-clearance+pose.offset[0]*.18,-.43+guard*.45+pose.offset[1]*.35,-.82-guard*.16-thrust*.24],[pose.rotation[0]*.2,-.26*(1-guard),.10*(1-guard)]),color=energy<.25?[1,.42,.12]:[.12,.7,.85];
        function shieldPart(shape,point,size,mat,alpha,rotation=0){const q=FMotion.place(mount,point,rotation),part=m(shape,q.p,size,mat,q.r,alpha!==undefined?.22:.04);part.overlay=true;part.surface='object';if(alpha!==undefined){part.fx=true;part.alpha=alpha;part.color=color;}out.push(part);}
        shieldPart('bevel',[0,0,0],[.52,.66,.035],7,.08+energy*.07+guard*.035);
        for(const side of [-1,1]){shieldPart('bevel',[side*.25,0,.019],[.026,.64,.035],0);shieldPart('box',[side*.25,0,-.006],[.008,.45,.008],4,.4+energy*.3);shieldPart('bevel',[0,side*.315,.019],[.52,.026,.035],0);}
        shieldPart('ring',[0,-.09,.026],[.13,.018,.13],4,.2+energy*.2,Math.PI/2);shieldPart('bevel',[-.025,-.20,.11],[.14,.10,.18],7);shieldPart('bevel',[-.10,-.32,.16],[.13,.22,.16],0);
      }
    }
    return out;
  }
  function renderHUD(){
    const s=sim.state,p=s.player;
    const stats=sim.stats||{maxHp:100},maxHp=s.maxHp||stats.maxHp||100,healthRatio=p.hp/maxHp;
    $('hp').textContent=String(Math.ceil(p.hp));$('health-max').textContent='/ '+maxHp;$('hp-bar').style.width=clamp(healthRatio*100,0,100)+'%';$('hp-bar').style.background=healthRatio<.3?'#ff795e':'var(--acid)';
    $('health-state').textContent=healthRatio<.25?'INTÉGRITÉ CRITIQUE':healthRatio<.55?'STRUCTURE ENDOMMAGÉE':'SYSTÈMES OPÉRATIONNELS';$('health-panel').classList.toggle('critical',healthRatio<.25);$('armor-rating').textContent='BLINDAGE '+Math.round((1-(stats.incomingMultiplier??1))*100)+' %';
    const armor=s.armor;
    $('armor-pool').hidden=!armor;$('health-state').hidden=!!armor;$('armor-rating').hidden=!!armor;
    if(armor){$('armor-points').textContent=String(Math.ceil(armor.points));$('armor-cap').textContent='/ '+armor.capacity;$('armor-bar').style.width=clamp(armor.points/armor.capacity*100,0,100)+'%';$('armor-pool').title='Plaques à ramasser · absorbe un tiers des dégâts après la garde · blindage passif '+Math.round((1-(stats.incomingMultiplier??1))*100)+' %';$('armor-pool').setAttribute('aria-label','Armure : '+Math.ceil(armor.points)+' sur '+armor.capacity);document.body.dataset.armor=String(Math.ceil(armor.points));}
    $('wallet-credits').textContent=String(s.economy?.credits||0);$('wallet-cores').textContent=String(s.economy?.cores||0);
    $('heat-bar').style.width=p.heat*100+'%';$('heat-bar').style.background=p.overheated?'#ff795e':s.weapon===2?'#ee8d5d':s.weapon===1?'#e8ad66':'#6ce5d2';
    $('weapon-label').textContent=weaponNames[s.weapon].toUpperCase();$('weapon-switch').setAttribute('aria-label','Arme actuelle : '+weaponNames[s.weapon]+'. Changer d’arme.');
    const inventory=s.inventory,owned=inventory?.weapons||[true,true,true],ammo=inventory?.ammo?.[s.weapon],limited=!!world.progression,infinite=world.campaign&&s.weapon===4;
    $('ammo-count').textContent=infinite?'∞':limited?String(ammo??0).padStart(2,'0'):'—';$('ammo-unit').textContent=ammoNames[s.weapon].toUpperCase();$('ammo-cap').textContent=infinite?'ILLIMITÉES':limited?'/ '+sim.ammoCaps[s.weapon]:'RÉSERVE';
    $('weapon-readout').classList.toggle('empty',!infinite&&limited&&ammo===0);$('heat-status').textContent=p.overheated?'REFROIDISSEMENT':!infinite&&limited&&ammo===0?'RÉSERVE ÉPUISÉE':'CHALEUR';
    $('arsenal-count').textContent=owned.filter(Boolean).length+' / '+owned.length;
    const left=s.equipment?.left??null,shield=left==='shield';
    $('weapon-slots').style.gridTemplateColumns='repeat('+(world.campaign?Math.max(1,owned.filter(Boolean).length):4)+',minmax(0,1fr))';
    for(let i=0;i<5;i++){
      const slot=$('weapon-slot-'+i),unlimited=world.campaign&&i===4;slot.hidden=i>=owned.length||!!world.campaign&&!owned[i];slot.disabled=!owned[i];slot.classList.toggle('locked',!owned[i]);slot.classList.toggle('selected',i===s.weapon);slot.setAttribute('aria-pressed',String(i===s.weapon));
      slot.dataset.hand=i===s.weapon?'right':i===left?'left':'';$('slot-hand-'+i).textContent=i===s.weapon?'D':i===left?'G':'';
      slot.setAttribute('aria-label',weaponNames[i]+(owned[i]?(unlimited?' · munitions illimitées':limited?' · '+inventory.ammo[i]+' '+ammoNames[i]:'')+(i===s.weapon?' · main droite':i===left?' · main gauche':''):' · à trouver'));
      $('slot-ammo-'+i).textContent=owned[i]?(unlimited?'∞':limited?String(inventory.ammo[i]):'PRÊTE'):'À TROUVER';$('slot-key-'+i).textContent=FOptions.keyName(prefs.bindings['weapon'+(i+1)]?.[0]||'Digit'+(i+1));
      $('left-option-'+i).disabled=!owned[i]||i===s.weapon;$('left-option-'+i).hidden=slot.hidden;
    }
    $('left-option-shield').disabled=!inventory?.shield;$('left-hand-setting').disabled=!sim.selectLeftWeapon;$('left-hand-setting').value=left===null?'none':String(left);
    $('left-hand-key').textContent=FOptions.keyName(prefs.bindings.leftHand[0]);$('left-hand-stock').textContent=shield?'GARDE '+Math.ceil(s.shield?.energy??100)+' %':world.campaign&&left===4?'∞ BALLES':Number.isInteger(left)?String(inventory.ammo[left])+' '+ammoNames[left]:'LIBRE';
    $('left-hand-status').textContent=shield?(s.shield?.raised?'GARDE LEVÉE':(s.shield?.energy??100)<1?'BOUCLIER ÉPUISÉ':(touch?'GARDE · MAINTENIR':'CLIC DROIT · GARDE')):left!==null?(touch?'TIR G · MAINTENIR':'CLIC DROIT · TIR'):(touch?'CHOISISSEZ UN ÉQUIPEMENT':'X · CHANGER');
    $('shield-meter').hidden=!shield;$('shield-energy').style.width=(s.shield?.energy??100)+'%';$('left-fire-button').disabled=left===null;$('left-fire-button').setAttribute('aria-label',shield?'Maintenir le bouclier':'Tirer avec la main gauche');$('left-fire-label').textContent=shield?'GARDE':'TIR G';
    $('dash-button').setAttribute('aria-label',shield?'Coup de bouclier':'Esquiver');
    $('melee-label').textContent=FOptions.keyName(prefs.bindings.melee[0]).toUpperCase()+' · CROSSE';
    const bashWait=s.shield?.bashCooldown||0;$('dash-label').textContent=shield?(bashWait>0?'BOUCLIER · '+bashWait.toFixed(1)+' s':FOptions.keyName(prefs.bindings.dash[0]).toUpperCase()+' · COUP DE BOUCLIER'):p.dash>0?'ESQUIVE · '+p.dash.toFixed(1)+' s':FOptions.keyName(prefs.bindings.dash[0]).toUpperCase()+' · ESQUIVE PRÊTE';$('dash-button').style.opacity=(shield?bashWait>0:p.dash>0)?'.35':'1';
    const pulse=p.pulseCooldown||0;$('pulse-label').textContent=pulse>0?'ONDE · '+pulse.toFixed(1)+' s':FOptions.keyName(prefs.bindings.pulse[0]).toUpperCase()+' · ONDE PRÊTE';$('pulse-button').style.opacity=pulse>0?'.35':'1';
    $('relay-count').textContent=s.relays+' / 3';$('relays').querySelectorAll('i').forEach((el,i)=>el.classList.toggle('on',i<s.relays));
    const required=(s.mechanisms||[]).filter(a=>a.required),activated=required.filter(a=>a.active).length,operational=activated===required.length;
    $('mechanism-count').textContent=activated+' / '+required.length;$('enemy-count').textContent=s.kills+' / '+s.enemies.length;
    $('objective-label').textContent=!operational?'ACTIVER LES COMMANDES':s.relays===3?(s.bossAlive?'NEUTRALISER LE GARDIEN':'REJOINDRE LA SORTIE'):'RÉCUPÉRER LES RELAIS';
    const encounters=(s.encounters||[]).filter(c=>c.status!=='dormant'&&Math.hypot((c.trigger?.x??0)-p.x,(c.trigger?.z??0)-p.z)<(c.leashRadius||38)+10).sort((a,b)=>Number(a.status==='cleared')-Number(b.status==='cleared')||Math.hypot(a.trigger.x-p.x,a.trigger.z-p.z)-Math.hypot(b.trigger.x-p.x,b.trigger.z-p.z)),current=encounters[0];
    $('wave-status').hidden=!current;$('wave-status').dataset.state=current?.status||'';
    if(current){$('wave-label').textContent=current.label||'ZONE DE COMBAT';$('wave-count').textContent=current.status==='cleared'?'ZONE SÉCURISÉE':'VAGUE '+(Math.max(current.wave,current.pendingWave)+1)+' / '+current.waves.length;$('wave-detail').textContent=current.status==='cleared'?'RÉCUPÉREZ LES RÉSERVES':current.status==='warning'?'RENFORTS EN APPROCHE':current.status==='waiting'?'SURVEILLEZ LES ACCÈS':current.active+' CONTACT'+(current.active===1?'':'S')+' ACTIF'+(current.active===1?'':'S');}
    const trophyGrace=s.campaign?.trophies.find(q=>q.phase==='grace');
    if(trophyGrace){$('wave-status').hidden=false;$('wave-status').dataset.state='trophy';$('wave-label').textContent='TROPHÉE ACQUIS';$('wave-count').textContent='ÉPREUVE DANS '+Math.max(1,Math.ceil(trophyGrace.timer))+' S';$('wave-detail').textContent='PRÉPAREZ VOTRE NOUVEL ÉQUIPEMENT';}
    $('score').textContent=String(Math.round(runStats.score+(s.score||0))).padStart(5,'0');$('combo').textContent=s.combo>1?'SÉRIE × '+s.combo:'SIGNAL STABLE';$('combo').classList.toggle('active',s.combo>1);
    const boss=s.enemies.find(e=>e.type===3&&e.hp>0),bossVisible=!!boss&&(boss.bossScale>1?boss.bossAwake&&(Math.hypot(boss.x-p.x,boss.z-p.z)<120):boss.active||boss.hp<boss.maxHp||Math.hypot(boss.x-p.x,boss.z-p.z)<22);
    $('boss-status').hidden=!bossVisible;document.body.dataset.boss=String(bossVisible);
    if(bossVisible){
      $('boss-bar').style.width=boss.hp/boss.maxHp*100+'%';$('boss-name').textContent=boss.bossName||'LE GARDIEN';
      $('boss-phase').textContent=boss.weakPointOpen?'CŒUR EXPOSÉ · '+Math.max(0,boss.weakTimer||0).toFixed(1)+' S':'PHASE '+((boss.phase||0)+1)+(boss.bossScale>1?' / 3':'');
      $('boss-attack').textContent=boss.weakPointOpen?'VISEZ LE CŒUR LUMINEUX':boss.attackLabel||'DÉFENSE ACTIVE';$('boss-status').classList.toggle('vulnerable',!!boss.weakPointOpen);
    }
    document.body.dataset.relays=String(s.relays);document.body.dataset.health=String(Math.ceil(p.hp));document.body.dataset.weapon=String(s.weapon);document.body.dataset.score=String(Math.round(s.score||0));
    $('crosshair').classList.toggle('fracture',s.weapon===1);
    $('crosshair').classList.toggle('rocket',s.weapon===2||s.weapon===3);
    document.body.dataset.ammo=String(ammo??0);
    const supply=[...s.pickups,...(s.loot||[])].filter(c=>supplyVisible(c)&&Math.abs((c.y||0)-p.y)<1.1&&Math.hypot(c.x-p.x,c.z-p.z)<3.7).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).find(c=>{const a=[p.x,p.y+1.3,p.z],b=[c.x,(c.y||0)+.4,c.z],d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d)||1;return sim.ray(a,d.map(v=>v/length),length)>=length-.2;});
    $('supply-hint').hidden=!supply;
    if(supply){const kind=supply.kind||supply.type||'health',weapon=supply.weapon||0,salvage=kind==='salvage'||kind==='boss',full=kind==='shield'?!!inventory?.shield:kind==='health'?p.hp>=maxHp:kind==='armor'?!s.armor||s.armor.points>=s.armor.capacity:salvage?!supply.credits&&!supply.cores&&(!supply.armor||!s.armor||s.armor.points>=s.armor.capacity)&&supply.ammo.every((n,i)=>!n||(inventory?.ammo[i]??0)>=sim.ammoCaps[i]):kind==='weapon'&&!owned[weapon]?false:inventory?.ammo[weapon]>=sim.ammoCaps?.[weapon];$('supply-name').textContent=kind==='armor'?'PLAQUES D’ARMURE':kind==='shield'?'BOUCLIER':kind==='weapon'?weaponNames[weapon].toUpperCase():kind==='ammo'?ammoNames[weapon].toUpperCase():kind==='boss'?'BUTIN DU COLOSSE':salvage?'FERRAILLE & RÉSERVES':'INTÉGRITÉ';$('supply-detail').textContent=full?'RÉSERVE AU MAXIMUM':kind==='weapon'&&!owned[weapon]?'ARME À RÉCUPÉRER':'AVANCEZ POUR RAMASSER';}
    const bossTarget=s.relays===3&&operational&&boss;
    const targets=s.relays===3&&operational?[bossTarget||world.exit]:[...required.filter(a=>!a.active),...s.cores.filter(c=>!c.taken)],target=targets.reduce((a,c)=>!a||Math.hypot(c.x-p.x,c.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?c:a,null);
    if(target){
      const mechanism=required.includes(target),delta=(target.baseY??target.y??0)-(p.y||0);
      $('target-label').textContent=mechanism?'COMMANDE':s.relays===3&&operational?(bossTarget?'GARDIEN':'SORTIE'):'RELAIS';
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
    const p=sim.state.player;ctx.save();ctx.translate(X(p.x),Z(p.z));ctx.rotate(p.yaw);ctx.fillStyle='#f2f5e5';ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(3.5,3.2);ctx.lineTo(0,1.5);ctx.lineTo(-3.5,3.2);ctx.closePath();ctx.fill();ctx.restore();
  }
  function frame(now){
    requestAnimationFrame(frame);if(prefs.fpsLimit&&now-last<1000/prefs.fpsLimit-.5)return;
    const frameMs=Math.max(0,now-last),dt=clamp(frameMs/1000,0,.12);last=now;clock+=dt;
    if(!renderer||!sim||document.hidden){perfStart=0;perfFrames=0;return;}
    if(mode==='loading')return;
    const signals={time:sim.state.time,lookYaw:0,lookPitch:0,firing:false};
    if(mode==='playing'){
      const held=id=>FOptions.down(prefs.bindings,keys,id);
      input.moveX=Number(held('right'))-Number(held('left'))+stick.x;
      input.moveY=Number(held('forward'))-Number(held('back'))-stick.y;
      input.lookX=lookDX+(Number(held('turnRight'))-Number(held('turnLeft')))*dt*1.9;input.lookY=lookDY;
      input.fire=mouseFire||touchFire||held('fire');input.fireLeft=mouseLeftFire||touchLeftFire||held('fireLeft');input.dash=dashQueued;input.pulse=pulseQueued;input.melee=meleeQueued;input.interact=interactQueued;input.weapon=selectedWeapon;input.sprint=held('sprint');
      signals.lookYaw=dt>0?input.lookX/dt:0;signals.lookPitch=dt>0?input.lookY/dt:0;signals.firing=input.fire;
      lookDX=lookDY=0;dashQueued=pulseQueued=meleeQueued=interactQueued=false;
      // Bounded substeps preserve movement/combat timing when rendering is slower than 60 Hz.
      const steps=Math.max(1,Math.ceil(dt*60)),part=dt/steps;
      for(let i=0;i<steps;i++){
        sim.step(part,input);input.lookX=input.lookY=0;input.dash=input.pulse=input.melee=input.interact=false;
        events();
        input.weapon=selectedWeapon;
        if(mode!=='playing')break;
      }
      const loc=sim.state.locomotion,footstep=Math.floor((loc?.stridePhase||0)/Math.PI),outside=isOutdoors(sim.state.player.x,sim.state.player.z);
      outdoorMix+=(Number(outside)-outdoorMix)*(1-Math.exp(-dt*3));audio.setEnvironment?.(world.environment,outdoorMix);
      let motor=0;for(const a of sim.state.lifts||[])if(a.moving)motor=Math.max(motor,Math.max(0,1-Math.hypot(a.x-sim.state.player.x,a.z-sim.state.player.z)/18));
      audio.setMachinery?.(motor);
      let steam=0,steamPan=0;for(const a of sim.state.pipes||[])if(a.hot&&!a.broken){const p=sim.state.player,origin=a.nozzle||[a.x,a.y||0,a.z],d=Math.hypot(origin[0]-p.x,origin[1]-p.y,origin[2]-p.z),level=Math.max(0,1-d/12)**2;if(level>steam){steam=level;steamPan=clamp(((origin[0]-p.x)*Math.cos(p.yaw)+(origin[2]-p.z)*Math.sin(p.yaw))/Math.max(1,d),-1,1);}}audio.setSteam?.(steam,steamPan);
      audio.setThreat(sim.state.threat||0);audio.setPressure?.(sim.state.director?.pressure||0);audio.tick(dt);
      if(mode==='playing'&&!sim.state.player.airborne&&footstep!==lastFootstep&&sim.state.moving>.5&&(loc?.dashBlend||0)<.3)audio.step(sim.state.moving,{outdoor:outside,biome:world.environment?.biome});
      lastFootstep=footstep;
      for(const e of sim.state.enemies){
        const scale=e.type===3?Math.max(1,Number(e.bossScale)||1):1;
        if(e.deployed===false||e.hp<=0||(e.type!==1&&e.type!==2&&e.type!==3)||(e.x-sim.state.player.x)**2+(e.z-sim.state.player.z)**2>(scale>1?140:40)**2){actorMotion.delete(e.id);continue;}
        const pose=actorMotion.get(e.id)||{phase:e.id*.7,blend:0};pose.phase=(pose.phase+(e.moveSpeed||0)*dt*4.8/scale)%(Math.PI*2);pose.blend+=(Math.min(1,(e.moveSpeed||0)/.9)-pose.blend)*(1-Math.exp(-dt*15));actorMotion.set(e.id,pose);
      }
      for(const a of sim.state.mechanisms||[]){const value=systemMotion.get(a.id)??0;systemMotion.set(a.id,value+(Number(a.active)-value)*(1-Math.exp(-dt*4)));}
      toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');
      encounterTime-=dt;if(encounterTime<=0)$('encounter').classList.remove('visible');
      hudWait-=dt;if(hudWait<=0){renderHUD();hudWait=.09;}
      $('crosshair').classList.toggle('hit',sim.state.hitMarker>0);$('damage').style.opacity=String(sim.state.damage*.45);
    }else{$('damage').style.opacity='0';}
    syncDestruction();
    const p=sim.state.player,isPlay=mode==='playing'||mode==='paused',t=mode==='menu'?clock:sim.state.time;
    signals.time=t;const view=motion.update(mode==='playing'?dt:0,sim.state.locomotion||{},signals,softMotion);leftMotion.update(mode==='playing'?dt:0,sim.state.locomotion||{},{...signals,firing:input.fireLeft},softMotion);
    if(mode==='playing')shieldLift+=(Number(!!sim.state.shield?.raised)-shieldLift)*(1-Math.exp(-dt*18));
    const camera={pos:[p.x,(p.y||0)+1.62+(isPlay?view.height:0),p.z],yaw:p.yaw,pitch:p.pitch,roll:isPlay?view.roll:0,fov:prefs.fov+(isPlay?view.fov:0)};
    if(mode==='menu'||mode==='options'){camera.yaw=world.spawn.yaw+.38+(softMotion?Math.sin(clock*.13)*.11:0);camera.pitch=.02;camera.pos[1]=(world.spawn.y||0)+1.72;}
    renderer.draw(camera,models(t,isPlay,camera),{time:t,flash:Math.max(sim.state.flash,sim.state.leftFlash||0),lights:window.FEffects?.lights(sim.state)||[],damage:sim.state.damage,pulse:clamp((sim.state.pulseVisual||0)/.65,0,1),shake:0,frameMs,shadows:prefs.shadows,bloom:prefs.bloom,horror:sim.state.director,adaptive:mode==='playing'&&(!prefs.fpsLimit||prefs.fpsLimit>=60)&&document.hasFocus()});
    // Count completed frame intervals in real time, with a stable readout at most twice/s.
    if(!perfStart){perfStart=now;perfFrames=0;}else perfFrames++;
    if(now-perfStart>=750){
      const fps=Math.round(perfFrames*1000/(now-perfStart));
      document.body.dataset.fps=String(fps);$('fps-counter').textContent=fps+' FPS';
      perfStart=now;perfFrames=0;
    }
  }
  function togglePause(){if(mode==='playing')setMode('paused');else if(mode==='options')setMode('menu');else if(mode==='paused'||mode==='shop'){audio.resume();setMode('playing');lock();canvas.focus({preventScroll:true});}}
  function switchWeapon(value,direction=1){
    if(mode!=='playing')return;
    const owned=sim.state.inventory?.weapons||[true,true,true];let next=value;
    if(next===undefined){next=selectedWeapon;for(let i=0;i<owned.length;i++){next=(next+direction+owned.length)%owned.length;if(owned[next])break;}}
    if(!owned[next]){toast(weaponNames[next]+' · arme à trouver dans le secteur',2);return;}
    if(next===selectedWeapon)return;
    if(sim.selectWeapon){if(!sim.selectWeapon(next))return;}else sim.state.weapon=next;
    selectedWeapon=sim.state.weapon;motion.impulse('switch');audio.switchWeapon?.();renderHUD();
  }
  function switchLeft(value){
    if(mode!=='playing'||!sim.selectLeftWeapon)return;
    const inventory=sim.state.inventory,current=sim.state.equipment?.left??null,choices=[null,...inventory.weapons.flatMap((owned,i)=>owned&&i!==sim.state.weapon?[i]:[]),...(inventory.shield?['shield']:[])];
    const next=value===undefined?choices[(choices.indexOf(current)+1)%choices.length]:value;
    if(!sim.selectLeftWeapon(next)){toast('Équipement indisponible pour la main gauche',1.8);renderHUD();return;}
    selectedWeapon=sim.state.weapon;leftMotion.impulse('switch');audio.switchWeapon?.();renderHUD();
  }
  $('start').addEventListener('click',()=>preparePlay(0,()=>newRun(savedRun?(Date.now()>>>0)%1000000:seed)));
  $('resume-expedition').addEventListener('click',()=>preparePlay(savedIndex(savedRun),()=>resumeSaved(savedRun),savedRun?.version===3));
  $('intro-options').addEventListener('click',()=>setMode('options'));
  $('pause-button').addEventListener('click',togglePause);$('resume').addEventListener('click',togglePause);
  $('restart').addEventListener('click',()=>preparePlay(stage,()=>{load(stage,undefined,stageEntryLoadout);saveCheckpoint();start('Nouvelle tentative. Équipement et crédits de l’entrée du secteur restaurés.');}));
  $('continue').addEventListener('click',()=>{
    if(mode==='dead'){
      preparePlay(savedRun?savedIndex(savedRun):stage,()=>resumeSaved(savedRun),savedRun?.version===3);return;
    }
    if(mode==='complete'){preparePlay(0,()=>newRun((Date.now()>>>0)%1000000));return;}
    const nextStage=stage+1,loadout=sim.exportLoadout?.()||sim.exportInventory?.();preparePlay(nextStage,()=>{load(nextStage,undefined,loadout);saveCheckpoint();start();});
  });
  $('back-menu').addEventListener('click',()=>{load(0);setMode('menu');refreshContinue();});
  $('pause-main').addEventListener('click',()=>{load(0);setMode('menu');refreshContinue();});
  for(const id of ['intro-sound','sound-toggle'])$(id).addEventListener('click',()=>{audio.cancelTestMix?.();muted=!muted;settings();});
  $('quality-toggle').addEventListener('click',()=>{quality={auto:'low',low:'high',high:'auto'}[quality];renderer.resize(quality);settings();});
  $('difficulty-setting').addEventListener('change',()=>{prefs.difficulty=clamp(Math.round(Number($('difficulty-setting').value)||0),0,2);sim?.setDifficulty?.(prefs.difficulty);settings();});
  $('ai-setting').addEventListener('change',async()=>{prefs.aiAcceleration=$('ai-setting').value==='cpu'?'cpu':'auto';settings();await brain?.setMode(prefs.aiAcceleration);brainStatus();});
  $('motion-toggle').addEventListener('click',()=>{softMotion=!softMotion;settings();});
  const tabs=['game','image','audio','controls'];
  for(const id of tabs){$('tab-'+id).addEventListener('click',()=>selectTab(id));$('tab-'+id).addEventListener('keydown',e=>{let next=tabs.indexOf(id);if(e.code==='ArrowRight')next=(next+1)%4;else if(e.code==='ArrowLeft')next=(next+3)%4;else if(e.code==='Home')next=0;else if(e.code==='End')next=3;else return;e.preventDefault();selectTab(tabs[next],true);});}
  for(const [id,key] of [['shadows','shadows'],['bloom','bloom'],['fps','showFps'],['crt','crt'],['vignette','vignette'],['invert','invertY']])$(id+'-toggle').addEventListener('click',()=>{prefs[key]=!prefs[key];settings();});
  for(const [id,key,divisor] of [['fov','fov',1],['brightness','brightness',100],['sensitivity','sensitivity',100],['crosshair','crosshairScale',100],['master','masterVolume',100],['music','musicVolume',100],['effects','effectsVolume',100],['ambience','ambienceVolume',100]])$(id+'-setting').addEventListener('input',()=>{prefs[key]=Number($(id+'-setting').value)/divisor;settings();});
  $('fps-limit').addEventListener('change',()=>{prefs.fpsLimit=Number($('fps-limit').value);settings();});
  $('reset-image').addEventListener('click',()=>{const d=FOptions.defaults(touch);for(const key of ['quality','softMotion','fov','brightness','shadows','bloom','showFps','crt','vignette','fpsLimit'])prefs[key]=d[key];quality=prefs.quality;softMotion=prefs.softMotion;renderer.resize(quality);settings();});
  $('reset-controls').addEventListener('click',()=>{const d=FOptions.defaults(touch);for(const key of ['sensitivity','invertY','crosshairScale','bindings'])prefs[key]=d[key];bindingAction=null;settings();$('binding-status').textContent='Commandes par défaut rétablies.';});
  $('reset-audio').addEventListener('click',()=>{audio.cancelTestMix?.();const d=FOptions.defaults(touch);for(const key of ['masterVolume','musicVolume','effectsVolume','ambienceVolume'])prefs[key]=d[key];muted=false;settings();$('audio-status').textContent='Mix recommandé rétabli. Testez les tirs et les ambiances.';});
  $('test-audio').addEventListener('click',async()=>{
    if(muted||prefs.masterVolume===0){$('audio-status').textContent='Son coupé. Activez le son et le volume général pour écouter.';return;}
    if(prefs.effectsVolume===0&&prefs.ambienceVolume===0){$('audio-status').textContent='Effets et ambiances sont à zéro. Montez ces deux curseurs pour les tester.';return;}
    audio.start();audio.resume();$('audio-status').textContent='Test : tir, impact et souffle d’ambiance…';
    const played=await audio.testMix?.({muted:prefs.muted});
    if(['paused','options'].includes(mode)&&optionsTab==='audio')$('audio-status').textContent=played?'Test lancé : tir, impact et ambiance. Les quatre volumes restent indépendants.':'Le test audio a été interrompu ou le son est indisponible.';
  });
  $('export-mod').addEventListener('click',()=>{
    const data=window.FMusic?.getModule(world.stage);if(!data){$('audio-status').textContent='Le module audio est indisponible.';return;}
    const url=URL.createObjectURL(new Blob([data],{type:'audio/mod'})),link=document.createElement('a');link.href=url;link.download='METAL-'+String(stage+1).padStart(2,'0')+'.mod';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('audio-status').textContent='Module généré : '+Math.round(data.byteLength/1000)+' ko. Téléchargement lancé.';
  });
  $('map-button').addEventListener('click',()=>{$('radar-wrap').hidden=!$('radar-wrap').hidden;drawRadar();});
  $('weapon-switch').addEventListener('click',()=>switchWeapon());
  for(let i=0;i<5;i++)$('weapon-slot-'+i).addEventListener('click',()=>switchWeapon(i));
  $('left-hand-setting').addEventListener('change',()=>{const value=$('left-hand-setting').value;switchLeft(value==='none'?null:value==='shield'?'shield':Number(value));canvas.focus({preventScroll:true});});
  $('shop-close').addEventListener('click',()=>{if(mode==='shop')togglePause();});
  $('reload').addEventListener('click',()=>location.reload());
  addEventListener('keydown',e=>{
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
    keys.add(e.code);if(match('dash')&&!e.repeat)dashQueued=true;if(match('pulse')&&!e.repeat)pulseQueued=true;if(match('melee')&&!e.repeat)meleeQueued=true;if(match('interact')&&!e.repeat)interactQueued=true;
    if(!e.repeat)for(let i=0;i<5;i++)if(match('weapon'+(i+1)))switchWeapon(i);
    if(match('leftHand')&&!e.repeat)switchLeft();
    if(match('map')&&!e.repeat){$('radar-wrap').hidden=!$('radar-wrap').hidden;drawRadar();}
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('wheel',e=>{if(mode==='playing'&&e.deltaY){e.preventDefault();switchWeapon(undefined,e.deltaY>0?1:-1);}},{passive:false});
  document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;if(wasLocked&&!locked&&mode==='playing')setMode('paused');wasLocked=locked;});
  document.addEventListener('mousemove',e=>{if(mode==='playing'&&document.pointerLockElement===canvas){lookDX+=e.movementX*.0022*prefs.sensitivity;lookDY-=e.movementY*.0022*prefs.sensitivity*(prefs.invertY?-1:1);}});
  // Mouse down/up report every button transition. Pointer down/up only report
  // the first pressed/last released mouse button, which would break dual fire.
  canvas.addEventListener('mousedown',e=>{if(mode!=='playing')return;if(e.button===0)mouseFire=true;else if(e.button===2)mouseLeftFire=true;});
  canvas.addEventListener('pointerdown',e=>{
    if(mode!=='playing')return;
    if(e.pointerType==='mouse'){if(!document.pointerLockElement){dragLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}}
    else if(e.clientX>innerWidth*.36){dragLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}
  });
  canvas.addEventListener('pointermove',e=>{if(dragLook?.id===e.pointerId&&!document.pointerLockElement&&mode==='playing'){const sensitivity=(touch?.004:.003)*prefs.sensitivity;lookDX+=(e.clientX-dragLook.x)*sensitivity;lookDY-=(e.clientY-dragLook.y)*sensitivity*(prefs.invertY?-1:1);dragLook.x=e.clientX;dragLook.y=e.clientY;}});
  function endMouse(e){if(e.button===0)mouseFire=false;else if(e.button===2)mouseLeftFire=false;if(!mouseFire&&!mouseLeftFire)dragLook=null;}
  addEventListener('mouseup',endMouse);
  function endPointer(e){if(e.pointerType==='mouse'&&(e.type==='pointercancel'||e.buttons===0))mouseFire=mouseLeftFire=false;if(dragLook?.id===e.pointerId&&!mouseFire&&!mouseLeftFire)dragLook=null;if(moveTouch?.id===e.pointerId){moveTouch=null;stick.x=stick.y=0;$('move-stick').style.transform='';}}
  addEventListener('pointerup',endPointer);addEventListener('pointercancel',endPointer);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  $('move-zone').addEventListener('pointerdown',e=>{if(mode!=='playing'||moveTouch)return;e.preventDefault();const rect=$('move-zone').getBoundingClientRect();moveTouch={id:e.pointerId,x:rect.left+rect.width/2,y:rect.top+rect.height/2};$('move-zone').setPointerCapture(e.pointerId);joystick(e);});
  function joystick(e){if(moveTouch?.id!==e.pointerId)return;const dx=e.clientX-moveTouch.x,dy=e.clientY-moveTouch.y,n=Math.max(1,Math.hypot(dx,dy)/34);stick.x=dx/n/34;stick.y=dy/n/34;$('move-stick').style.transform='translate('+dx/n+'px,'+dy/n+'px)';}
  $('move-zone').addEventListener('pointermove',joystick);
  $('fire-button').addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();touchFire=true;$('fire-button').setPointerCapture(e.pointerId);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])$('fire-button').addEventListener(name,()=>{touchFire=false;});
  $('left-fire-button').addEventListener('pointerdown',e=>{if(mode!=='playing'||$('left-fire-button').disabled)return;e.preventDefault();touchLeftFire=true;$('left-fire-button').setPointerCapture(e.pointerId);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])$('left-fire-button').addEventListener(name,()=>{touchLeftFire=false;});
  $('dash-button').addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();dashQueued=true;});
  $('pulse-button').addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();pulseQueued=true;});
  $('melee-button').addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();meleeQueued=true;});
  $('interact-button').addEventListener('click',e=>{if(mode!=='playing'||$('interact-button').disabled)return;e.preventDefault();interactQueued=true;canvas.focus({preventScroll:true});});
  addEventListener('blur',()=>{if(mode==='playing')setMode('paused');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')setMode('paused');});
  addEventListener('resize',()=>renderer?.resize(quality));
  canvas.addEventListener('webglcontextlost',()=>{if(mode==='playing')setMode('paused');});
  if(touch){$('intro-controls').textContent='Déplacez-vous à gauche · Visez à droite';$('help-text').innerHTML='Joystick gauche : déplacer · Glisser à droite : viser<br>Grand cercle : main droite · TIR G / GARDE : main gauche<br>Flèche : esquive ou coup de bouclier<br>Anneaux : onde · Crosse : attaque au contact<br>Emplacement : main droite · Menu main gauche : arme ou bouclier<br>Bouton contextuel : commande ou ascenseur<br>Ramassez armes et munitions. Les réserves sont limitées.';}
  try{
    renderer=FRender.create(canvas);renderer.resize(quality);document.body.dataset.renderer=renderer.stats.backend||'webgl2';
    savedRun=readSave();refreshContinue();load(0);settings();requestAnimationFrame(frame);
    window.FMusic?.warmup?.(0).catch(error=>console.error('METAL audio preparation:',error));
  }catch(error){$('intro').hidden=true;$('error').hidden=false;$('error-copy').textContent='Le moteur graphique n’a pas pu démarrer. Essayez de recharger la page ou d’utiliser un navigateur récent.';console.error('METAL initialization:',error);}
})();

