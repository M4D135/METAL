/* FERRO — browser shell, checkpoints and procedural characters. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('world'),clamp=FSimulation.clamp;
  const touch=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>1||new URLSearchParams(location.search).get('touch')==='1';
  document.body.classList.toggle('touch',touch);
  let muted=false,quality='auto',softMotion=true;
  try{const v=JSON.parse(localStorage.getItem('ferro-settings')||'{}');muted=!!v.muted;quality=['auto','low','high'].includes(v.quality)?v.quality:'auto';softMotion=v.softMotion!==false;}catch{}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)softMotion=false;
  const audio=FAudio.create(),SAVE_KEY='ferro-expedition-v2';
  let renderer,world,sim,stage=0,seed=96,mode='menu',last=performance.now(),clock=0,hudWait=0,toastTime=0,wasLocked=false,perfStart=last,perfFrames=0;
  const emptyStats=()=>({time:0,kills:0,shots:0,hits:0,score:0});
  let runStats=emptyStats(),checkpoint=null,savedRun=null,selectedWeapon=0,saveAvailable=true;
  const keys=new Set(),input={moveX:0,moveY:0,lookX:0,lookY:0,fire:false,dash:false,pulse:false,weapon:0,sprint:false,assist:touch};
  let mouseFire=false,touchFire=false,dragLook=null,moveTouch=null,stick={x:0,y:0},lookDX=0,lookDY=0,dashQueued=false,pulseQueued=false;
  function saveSettings(){try{localStorage.setItem('ferro-settings',JSON.stringify({muted,quality,softMotion}));}catch{}}
  function settings(){
    $('intro-sound').textContent=muted?'SON COUPÉ':'SON ACTIVÉ';
    $('sound-toggle').querySelector('strong').textContent=muted?'Coupé':'Activé';
    $('quality-toggle').querySelector('strong').textContent={auto:'Auto',low:'Économie',high:'Haute'}[quality];
    $('motion-toggle').querySelector('strong').textContent=softMotion?'Doux':'Désactivés';
    document.body.classList.toggle('low-motion',!softMotion);audio.setMuted(muted||mode==='menu'||mode==='paused');saveSettings();
  }
  function toast(message,seconds=2.8){$('toast').textContent=message;$('toast').classList.add('visible');toastTime=seconds;}
  function validSave(v){
    return v&&v.version===2&&Number.isInteger(v.seed)&&v.seed>=0&&v.seed<=0xffffffff&&Number.isInteger(v.stage)&&v.stage>=0&&v.stage<3&&v.checkpoint&&v.runStats&&Object.keys(emptyStats()).every(k=>Number.isFinite(v.runStats[k])&&v.runStats[k]>=0&&v.runStats[k]<1e9);
  }
  function readSave(){
    try{const raw=localStorage.getItem(SAVE_KEY);if(!raw||raw.length>350000)return null;const v=JSON.parse(raw);return validSave(v)?v:null;}catch{return null;}
  }
  function refreshContinue(){
    $('resume-expedition').hidden=!savedRun;
    $('save-label').textContent=savedRun?'ÉTAGE '+String(savedRun.stage+1).padStart(2,'0'):'';
    $('start').firstChild.textContent=savedRun?'Nouvelle expédition ':'Entrer dans le complexe ';
  }
  function saveCheckpoint(){
    if(!sim||sim.state.dead||sim.state.won)return;
    checkpoint=sim.snapshot();
    savedRun={version:2,seed,stage,runStats:{...runStats},checkpoint};
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(savedRun));saveAvailable=true;}catch{saveAvailable=false;}
    $('checkpoint-status').textContent=(sim.state.relays?'Reprise au relais '+sim.state.relays+' / 3.':'Reprise à l’entrée de cet étage.')+(saveAvailable?' Sauvegarde locale active.':' Reprise disponible pendant cette session.');
    refreshContinue();
  }
  function clearSave(){checkpoint=null;savedRun=null;try{localStorage.removeItem(SAVE_KEY);}catch{}refreshContinue();}
  function restoreRun(v){
    if(!validSave(v))return false;
    load(v.stage,v.seed);
    if(!sim.restore(v.checkpoint,{recover:true}))return false;
    runStats={...v.runStats};checkpoint=v.checkpoint;savedRun=v;selectedWeapon=sim.state.weapon;
    $('checkpoint-status').textContent=(sim.state.relays?'Reprise au relais '+sim.state.relays+' / 3.':'Reprise à l’entrée de cet étage.')+(saveAvailable?' Sauvegarde locale active.':' Reprise disponible pendant cette session.');
    renderHUD();return true;
  }
  function clearInput(){keys.clear();mouseFire=touchFire=false;dragLook=moveTouch=null;stick.x=stick.y=lookDX=lookDY=0;dashQueued=pulseQueued=false;$('move-stick').style.transform='';}
  function setMode(value){
    mode=value;document.body.dataset.state=value;$('intro').hidden=value!=='menu';$('hud').hidden=!['playing','paused'].includes(value);$('pause').hidden=value!=='paused';$('result').hidden=!['dead','cleared','complete'].includes(value);clearInput();audio.setMuted(muted||value==='menu'||value==='paused');
    if(value!=='playing'&&document.pointerLockElement)document.exitPointerLock();
  }
  function load(n,newSeed){
    stage=n;if(newSeed!==undefined)seed=newSeed;world=FWorld.create(seed,stage);sim=FSimulation.create(world);sim.state.weapon=selectedWeapon;renderer.setWorld(world.meshes,world.lights);
    audio.setStage?.(stage);
    $('sector-number').textContent='ÉTAGE '+String(stage+1).padStart(2,'0')+' / 03';$('sector-title').textContent=world.title;
    document.body.dataset.stage=String(stage+1);$('radar-wrap').hidden=false;hudWait=0;renderHUD();
  }
  function lock(){
    if(touch)return;
    try{const result=canvas.requestPointerLock?.();if(result?.catch)result.catch(()=>toast('Maintenez et glissez pour regarder. Flèches : tourner.',4));}catch{toast('Glissez pour regarder. Flèches : tourner.',4);}
  }
  function start(message){
    audio.start();audio.resume();setMode('playing');lock();canvas.focus({preventScroll:true});
    toast(message||(stage===0?'Trois relais. Deux armes. E déclenche une onde de choc.':stage===1?'Attention aux évents : orange annonce la prochaine décharge.':'Le gardien protège la sortie. Observez ses attaques.'),4.5);
  }
  function newRun(newSeed){runStats=emptyStats();selectedWeapon=0;load(0,newSeed);saveCheckpoint();start();}
  function result(dead){
    const s=sim.state,finished=!dead&&stage===2;
    if(!dead){runStats.time+=s.elapsed;runStats.kills+=s.kills;runStats.shots+=s.shots;runStats.hits+=s.hits;runStats.score+=s.score||0;}
    $('result-kicker').textContent=dead?'TRANSMISSION PERDUE':finished?'TRANSMISSION RÉTABLIE':'RELAIS SYNCHRONISÉS';
    $('result-title').textContent=dead?'Signal perdu.':finished?'Vous êtes sorti.':'Étage sécurisé.';
    $('result-copy').textContent=dead?'Le dernier relais a gardé votre signal. Esquivez les attaques annoncées et utilisez l’onde de choc pour dégager le passage.':finished?'Neuf relais rallumés. Le gardien neutralisé. Au-dessus de vous, le silence a enfin changé.':'Votre signal descend encore. Un autre plan, d’autres machines, la même issue à trouver.';
    const stats=finished?runStats:{time:s.elapsed,kills:s.kills,shots:s.shots,hits:s.hits};
    $('result-time').textContent=formatTime(stats.time);$('result-kills').textContent=String(stats.kills);$('result-accuracy').textContent=(stats.shots?Math.min(100,Math.round(stats.hits/stats.shots*100)):0)+'%';
    $('result-score').textContent=String(Math.round(dead?runStats.score+(s.score||0):runStats.score));
    $('continue').innerHTML=(dead?'Reprendre au point de reprise':finished?'Nouvelle expédition':'Descendre à l’étage '+(stage+2))+' <span class="arrow-icon" aria-hidden="true"></span>';
    if(finished)clearSave();
    setMode(dead?'dead':finished?'complete':'cleared');
  }
  function formatTime(v){return Math.floor(v/60)+':'+String(Math.floor(v%60)).padStart(2,'0');}
  function events(){
    let checkpointDue=false;
    for(const e of sim.state.events){
      if(typeof audio[e.name]==='function'){
        const p=sim.state.player,d=Number.isFinite(e.x)?Math.hypot(e.x-p.x,e.z-p.z):0;
        const pan=Number.isFinite(e.x)?clamp(((e.x-p.x)*Math.cos(p.yaw)+(e.z-p.z)*Math.sin(p.yaw))/Math.max(1,d),-1,1):0;
        audio[e.name]({pan,level:1/(1+d*.055),kind:e.kind});
      }
      if(e.name==='core'){
        checkpointDue=true;
        toast(e.count===3?(sim.state.bossAlive?'Trois relais en ligne. Neutralisez le gardien.':'Trois relais en ligne. Rejoignez la sortie.'):'Relais '+e.count+' / 3 · intégrité restaurée · point de reprise',3.2);
      }
      if(e.name==='pickup')toast('Intégrité restaurée',1.8);
      if(e.name==='overheat')toast('Surchauffe · laissez refroidir',1.6);
      if(e.name==='bossPhase')toast('Le gardien accélère. Gardez une esquive en réserve.',3.5);
      if(e.name==='win'){result(false);break;}
      if(e.name==='dead'){result(true);break;}
    }
    sim.state.events.length=0;
    if(checkpointDue)saveCheckpoint();
  }
  const m=(shape,p,s,mat,r=[0,0,0],emissive=0)=>({shape,p,s,mat,r,emissive});
  function machinery(out,t){
    for(const a of world.machinery||[]){
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
      const cycle=(t+h.phase)%h.period,hot=cycle<h.active,warning=cycle>h.period-.85;
      if(!hot&&!warning)continue;
      out.push(m('ring',[h.x,.035,h.z],[h.r*2,.06,h.r*2],hot?6:5,[0,0,0],hot?1.8:.7+Math.sin(t*17)*.4));
      if(hot)for(let j=0;j<5;j++){
        const a=j*1.257+t*.3,y=.25+(t*2.3+j*.21)%1.45,r=h.r*.45;
        out.push(m('octa',[h.x+Math.cos(a)*r,y,h.z+Math.sin(a)*r],[.16,.7,.16],j%2?6:5,[0,t+j,0],1.6));
      }
    }
  }
  function models(t,playing){
    const out=[],s=sim.state,p=s.player;machinery(out,t);
    for(const c of s.cores){
      out.push(m('cylinder',[c.x,.13,c.z],[.95,.26,.95],0),m('ring',[c.x,.29,c.z],[1.15,.1,1.15],c.taken?0:5));
      if(!c.taken){const y=1.22+Math.sin(t*2+c.id)*.13;out.push(m('octa',[c.x,y,c.z],[.55,.85,.55],5,[0,t*.7,0],1.8),m('ring',[c.x,y,c.z],[1.2,1.2,1.2],4,[Math.PI/2,0,t*.35],1.2));}
    }
    for(const e of s.enemies){
      if(e.hp<=0)continue;
      const heading=Number.isFinite(e.yaw)?e.yaw:Math.atan2(p.x-e.x,e.z-p.z),rot=Math.PI-heading;
      const charge=e.windup>0?1-e.windup/(e.windupMax||1):0,stunned=e.stun>0;
      const y=e.y+(e.type===1?0:Math.sin(t*2+e.id)*.09),mat=e.hurt>0?5:stunned?0:1,eye=stunned?4:e.windup>0?5:6;
      const glow=1.4+charge*2;
      if(e.type===0){
        out.push(m('octa',[e.x,y,e.z],[1,.7,1],mat,[stunned?.3:0,t*.3+e.id,0]),m('sphere',[e.x,y,e.z],[.42,.42,.42],eye,[0,0,0],glow),m('ring',[e.x,y-.1,e.z],[1.2,.1,1.2],0,[.15,0,0]));
        for(let j=0;j<3;j++){const a=t*(stunned?.1:1.1)+j*Math.PI*2/3+e.id,r=.57+charge*.14;out.push(m('box',[e.x+Math.cos(a)*r,y,e.z+Math.sin(a)*r],[.16,.25,.45],0,[0,-a,0]),m('sphere',[e.x+Math.cos(a)*(r+.09),y-.1,e.z+Math.sin(a)*(r+.09)],[.1,.1,.1],eye,[0,0,0],glow));}
      }else if(e.type===1){
        const lean=e.attackState==='rush'?.16:0,bounce=e.active&&!stunned?Math.sin(t*8+e.id)*.04:0;
        out.push(m('box',[e.x,1.05+bounce,e.z],[1.05,.85,.65],mat,[lean,rot,0]),m('box',[e.x,1.67+bounce,e.z],[.6,.4,.5],0,[lean,rot,0]));
        for(const side of [-1,1]){const x=e.x+Math.cos(rot)*side*.38,z=e.z-Math.sin(rot)*side*.38;out.push(m('box',[x,.4,z],[.29,.8,.4],0,[e.active&&!stunned?Math.sin(t*7)*side*.23:0,rot,0]),m('cylinder',[x,1.2+bounce,z],[.2,.7,.2],7,[0,0,Math.PI/2]));}
        out.push(m('box',[e.x+Math.sin(rot)*.28,1.69+bounce,e.z+Math.cos(rot)*.28],[.4,.08,.08],eye,[0,rot,0],glow));
      }else if(e.type===2){
        out.push(m('sphere',[e.x,y,e.z],[.8,.8,.8],mat),m('octa',[e.x,y,e.z],[.4,1.35,.4],0,[0,t*.5,0]),m('ring',[e.x,y,e.z],[1.35,1.35,1.35],0,[Math.PI/2,rot,t*.4]));
        out.push(m('sphere',[e.x+Math.sin(rot)*.4,y,e.z+Math.cos(rot)*.4],[.3,.3,.3],eye,[0,0,0],glow));
        for(const side of [-1,1])out.push(m('box',[e.x+Math.cos(rot)*side*.5,y,e.z-Math.sin(rot)*side*.5],[.2,.22,.8],mat,[0,rot,0]));
      }else{
        const angry=e.phase>0,spin=t*(angry?1.6:.65);
        out.push(m('octa',[e.x,y,e.z],[2.25,2.2,1.6],mat,[0,rot,0]),m('box',[e.x,y+.56,e.z],[1.45,.65,.88],0,[0,rot,0]),m('ring',[e.x,y,e.z],[3.15,3.15,3.15],1,[Math.PI/2,rot,spin*.2]));
        out.push(m('sphere',[e.x+Math.sin(rot)*.82,y+.12,e.z+Math.cos(rot)*.82],[.72,.72,.36],eye,[0,rot,0],glow+1));
        for(let j=0;j<4;j++){
          const a=spin+j*Math.PI/2,r=1.35+charge*.35,x=e.x+Math.cos(a)*r,z=e.z+Math.sin(a)*r;
          out.push(m('box',[x,y-.2,z],[.42,.7,.6],0,[0,-a,0]),m('octa',[x,y+.25,z],[.32,.5,.32],angry?6:5,[0,spin,0],glow));
        }
        out.push(m('ring',[e.x,.11,e.z],[2.8,.1,2.8],angry?6:5,[0,spin,0],.7));
      }
      if(e.windup>0){
        const r=(e.type===3?2.2:.8)*(1.3-charge*.3);
        out.push(m('ring',[e.x,.07,e.z],[r*2,.08,r*2],5,[0,0,0],.7+charge));
        const dx=Math.sin(heading),dz=-Math.cos(heading);
        for(let j=1;j<=3;j++)out.push(m('box',[e.x+dx*(j*.65+.5),.065,e.z+dz*(j*.65+.5)],[.11,.04,.3],5,[0,-heading,0],.6+charge));
      }
      if(stunned)out.push(m('ring',[e.x,y+.65,e.z],[1.05,.08,1.05],4,[.15,t*2,0],1));
    }
    for(const c of s.pickups)if(!c.taken){const y=.5+Math.sin(t*2+c.x)*.06;out.push(m('box',[c.x,y,c.z],[.45,.4,.45],0,[0,t*.4,0]),m('box',[c.x,y+.22,c.z],[.3,.035,.09],4,[0,t*.4,0],1),m('box',[c.x,y+.22,c.z],[.09,.035,.3],4,[0,t*.4,0],1));}
    const ex=world.exit.x,ez=world.exit.z,ready=s.relays===3&&!s.bossAlive,exitMat=ready?4:5;
    out.push(m('cylinder',[ex,.08,ez],[2.5,.16,2.5],0),m('ring',[ex,.2,ez],[2.7,.1,2.7],exitMat,[0,0,0],1.4));
    for(const side of [-1,1])out.push(m('box',[ex+side*1.4,1.65,ez],[.25,3.3,.5],0),m('box',[ex+side*1.24,1.65,ez],[.06,2.9,.2],exitMat,[0,0,0],1.4));
    out.push(m('box',[ex,3.2,ez],[2.9,.25,.5],0));
    if(ready)for(let j=0;j<6;j++){const a=t*1.1+j*1.047;out.push(m('octa',[ex+Math.cos(a)*.7,.4+((t*.6+j*.4)%2.4),ez+Math.sin(a)*.7],[.1,.16,.1],4,[0,t,0],2));}
    for(const q of s.bullets)out.push(m('sphere',[q.x,q.y,q.z],[.2,.2,.2],6,[0,0,0],2.6));
    for(const q of s.particles){const v=Math.min(.11,q.life*.17);out.push(m('box',[q.x,q.y,q.z],[v,v,v],q.kind,[t,t,0],1.6));}
    if(s.pulseVisual>0){
      const progress=1-s.pulseVisual/.65,r=.3+progress*6.2;
      out.push(m('ring',[p.x,.16,p.z],[r*2,.13,r*2],4,[0,0,0],1.7*(1-progress)));
      if(progress<.65)out.push(m('ring',[p.x,.7,p.z],[r*1.7,.08,r*1.7],4,[0,0,0],.8));
    }
    if(playing){
      const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),sp=Math.sin(p.pitch),cp=Math.cos(p.pitch),fracture=s.weapon===1,recoil=s.flash*(fracture?.12:.07);
      const bob=softMotion&&s.moving>.1?Math.sin(t*9)*.012:0;
      function gun(shape,x,y,z,siz,mat,rx=0,em=0){
        x+=.27*Math.min(1,Math.max(.45,(innerWidth/innerHeight)/1.2));y+=-.29+bob;z+=-.56+recoil;
        const pos=[p.x+cy*x-sy*sp*y-sy*cp*z,1.62+cp*y-sp*z,p.z+sy*x+cy*sp*y+cy*cp*z];
        const a=m(shape,pos,siz,mat,[p.pitch+rx,-p.yaw,0],em);a.overlay=true;out.push(a);
      }
      gun('box',0,-.09,.12,[.17,.25,.17],7,-.2);
      if(fracture){
        gun('box',0,0,.01,[.27,.23,.53],0);gun('box',0,.135,.03,[.26,.045,.3],1);
        gun('box',0,-.07,-.3,[.29,.09,.22],7);
        for(const side of [-1,1]){
          gun('cylinder',side*.082,.01,-.33,[.135,.38,.135],0,Math.PI/2);
          gun('cylinder',side*.082,.01,-.52,[.16,.055,.16],1,Math.PI/2);
          gun('box',side*.143,.025,.04,[.014,.075,.24],p.overheated?6:5,0,.9);
          if(s.flash>.2)gun('octa',side*.082,.01,-.59,[.16+s.flash*.13,.16+s.flash*.13,.24+s.flash*.3],5,0,2.6);
        }
        gun('box',0,.17,-.13,[.04,.04,.04],5,0,.6);
      }else{
        gun('box',0,0,-.03,[.2,.18,.52],0);gun('box',0,.105,.04,[.15,.045,.27],1);
        gun('box',-.106,.025,-.02,[.015,.055,.28],p.overheated?6:4,0,1.2);gun('box',.106,.025,-.02,[.015,.055,.28],1);
        gun('cylinder',0,.01,-.34,[.13,.24,.13],0,Math.PI/2);gun('cylinder',0,.01,-.47,[.16,.045,.16],1,Math.PI/2);gun('box',0,.14,-.13,[.035,.04,.035],4,0,.5);
        if(s.flash>.2)gun('octa',0,.01,-.53,[.12+s.flash*.12,.12+s.flash*.12,.15+s.flash*.25],5,0,2.5);
      }
    }
    return out;
  }
  function renderHUD(){
    const s=sim.state,p=s.player;
    $('hp').textContent=String(Math.ceil(p.hp));$('hp-bar').style.width=p.hp+'%';$('hp-bar').style.background=p.hp<30?'#ff795e':'var(--acid)';
    $('heat-bar').style.width=p.heat*100+'%';$('heat-bar').style.background=p.overheated?'#ff795e':s.weapon===1?'#e8ad66':'#6ce5d2';
    $('weapon-label').textContent=p.overheated?'REFROIDISSEMENT':s.weapon===1?'FRACTURE / 02':'IMPULSE / 01';$('weapon-switch').setAttribute('aria-label','Arme actuelle : '+(s.weapon===1?'Fracture':'Impulse')+'. Changer d’arme.');
    $('dash-label').textContent=p.dash>0?'ESQUIVE · '+p.dash.toFixed(1)+' s':'ESPACE · ESQUIVE PRÊTE';$('dash-button').style.opacity=p.dash>0?'.35':'1';
    const pulse=p.pulseCooldown||0;$('pulse-label').textContent=pulse>0?'ONDE · '+pulse.toFixed(1)+' s':'E · ONDE PRÊTE';$('pulse-button').style.opacity=pulse>0?'.35':'1';
    $('relay-count').textContent=s.relays+' / 3';$('relays').querySelectorAll('i').forEach((el,i)=>el.classList.toggle('on',i<s.relays));
    $('objective-label').textContent=s.relays===3?(s.bossAlive?'NEUTRALISER LE GARDIEN':'REJOINDRE LA SORTIE'):'RÉCUPÉRER LES RELAIS';
    $('score').textContent=String(Math.round(runStats.score+(s.score||0))).padStart(5,'0');$('combo').textContent=s.combo>1?'SÉRIE × '+s.combo:'SIGNAL STABLE';$('combo').classList.toggle('active',s.combo>1);
    const boss=s.enemies.find(e=>e.type===3&&e.hp>0),bossVisible=!!boss&&(boss.active||boss.hp<boss.maxHp||Math.hypot(boss.x-p.x,boss.z-p.z)<22);
    $('boss-status').hidden=!bossVisible;document.body.dataset.boss=String(bossVisible);
    if(bossVisible){$('boss-bar').style.width=boss.hp/boss.maxHp*100+'%';$('boss-phase').textContent=boss.phase>0?'SURCHARGE':'DÉFENSE ACTIVE';}
    document.body.dataset.relays=String(s.relays);document.body.dataset.health=String(Math.ceil(p.hp));document.body.dataset.weapon=String(s.weapon);document.body.dataset.score=String(Math.round(s.score||0));
    $('crosshair').classList.toggle('fracture',s.weapon===1);
    const bossTarget=s.relays===3&&boss;
    const targets=s.relays===3?[bossTarget||world.exit]:s.cores.filter(c=>!c.taken),target=targets.reduce((a,c)=>!a||Math.hypot(c.x-p.x,c.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?c:a,null);
    if(target){$('target-label').textContent=s.relays===3?(bossTarget?'GARDIEN':'SORTIE'):'RELAIS';$('target-distance').textContent=Math.round(Math.hypot(target.x-p.x,target.z-p.z))+' m';const angle=Math.atan2(target.x-p.x,p.z-target.z)-p.yaw;$('target-arrow').style.transform='rotate('+angle+'rad)';}
    const room=world.rooms.find(r=>Math.abs(p.x-r.x)<r.w/2&&Math.abs(p.z-r.z)<r.d/2);$('room-name').textContent=room?room.name:'COULOIR DE LIAISON';
    drawRadar();
  }
  function drawRadar(){
    if($('radar-wrap').hidden)return;
    const ctx=$('radar').getContext('2d'),b=world.bounds,k=160/Math.max(b.maxX-b.minX,b.maxZ-b.minZ),X=x=>10+(x-b.minX)*k,Z=z=>10+(z-b.minZ)*k;
    ctx.clearRect(0,0,180,180);ctx.fillStyle='#8caf9320';ctx.strokeStyle='#779d7c77';ctx.lineWidth=.8;
    for(const r of [...(world.corridors||[]),...world.rooms]){ctx.fillRect(X(r.x-r.w/2),Z(r.z-r.d/2),r.w*k,r.d*k);ctx.strokeRect(X(r.x-r.w/2),Z(r.z-r.d/2),r.w*k,r.d*k);}
    for(const c of sim.state.cores){ctx.fillStyle=c.taken?'#567260':'#d7f36b';ctx.save();ctx.translate(X(c.x),Z(c.z));ctx.rotate(Math.PI/4);ctx.fillRect(-2.5,-2.5,5,5);ctx.restore();}
    const boss=sim.state.enemies.find(e=>e.type===3&&e.hp>0&&e.active);if(boss){ctx.fillStyle='#e89963';ctx.fillRect(X(boss.x)-3,Z(boss.z)-3,6,6);}
    ctx.strokeStyle=sim.state.relays===3&&!sim.state.bossAlive?'#71e1cc':'#b08449';ctx.strokeRect(X(world.exit.x)-3,Z(world.exit.z)-3,6,6);
    const p=sim.state.player;ctx.save();ctx.translate(X(p.x),Z(p.z));ctx.rotate(p.yaw);ctx.fillStyle='#f2f5e5';ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(3.5,3.2);ctx.lineTo(0,1.5);ctx.lineTo(-3.5,3.2);ctx.closePath();ctx.fill();ctx.restore();
  }
  function frame(now){
    requestAnimationFrame(frame);const dt=clamp((now-last)/1000,0,.12);last=now;clock+=dt;
    perfFrames++;if(now-perfStart>1000){document.body.dataset.fps=String(Math.round(perfFrames*1000/(now-perfStart)));perfStart=now;perfFrames=0;}
    if(!renderer||!sim||document.hidden)return;
    if(mode==='playing'){
      input.moveX=(keys.has('KeyD')?1:0)-(keys.has('KeyA')||keys.has('KeyQ')?1:0)+stick.x;
      input.moveY=(keys.has('KeyW')||keys.has('KeyZ')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-stick.y;
      input.lookX=lookDX+((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*dt*1.9;input.lookY=lookDY;
      input.fire=mouseFire||touchFire||keys.has('Enter');input.dash=dashQueued;input.pulse=pulseQueued;input.weapon=selectedWeapon;input.sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
      lookDX=lookDY=0;dashQueued=pulseQueued=false;
      // Bounded substeps preserve movement/combat timing when rendering is slower than 60 Hz.
      const steps=Math.max(1,Math.ceil(dt*60)),part=dt/steps;
      for(let i=0;i<steps;i++){
        sim.step(part,input);input.lookX=input.lookY=0;input.dash=input.pulse=false;
        events();
        if(mode!=='playing')break;
      }
      audio.setThreat(sim.state.threat||0);audio.tick(dt);if(mode==='playing'&&sim.state.moving>.5)audio.step(sim.state.moving);
      toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');
      hudWait-=dt;if(hudWait<=0){renderHUD();hudWait=.09;}
      $('crosshair').classList.toggle('hit',sim.state.hitMarker>0);$('damage').style.opacity=String(sim.state.damage*.45);
    }else{$('damage').style.opacity='0';}
    const p=sim.state.player,isPlay=mode==='playing'||mode==='paused',t=mode==='menu'?clock:sim.state.time;
    const camera={pos:[p.x,1.62+(isPlay&&softMotion&&sim.state.moving>.1?Math.sin(t*9)*.012:0),p.z],yaw:p.yaw,pitch:p.pitch,fov:(touch?79:74)+(softMotion&&p.dashing>0?4:0)};
    if(mode==='menu'){camera.yaw=world.spawn.yaw+.38+Math.sin(clock*.13)*.11;camera.pitch=.02;camera.pos[1]=1.72;}
    renderer.draw(camera,models(t,isPlay),{time:t,flash:sim.state.flash,damage:sim.state.damage,pulse:clamp((sim.state.pulseVisual||0)/.65,0,1),shake:0});
  }
  function togglePause(){if(mode==='playing')setMode('paused');else if(mode==='paused'){audio.resume();setMode('playing');lock();canvas.focus({preventScroll:true});}}
  function switchWeapon(value){const next=value===undefined?1-selectedWeapon:value;if(mode!=='playing'||next===selectedWeapon)return;selectedWeapon=next;sim.state.weapon=selectedWeapon;audio.switchWeapon?.();renderHUD();}
  $('start').addEventListener('click',()=>newRun(savedRun?(Date.now()>>>0)%1000000:seed));
  $('resume-expedition').addEventListener('click',()=>{
    if(restoreRun(savedRun))start('Signal retrouvé. Reprise au dernier point enregistré.');
    else{clearSave();runStats=emptyStats();load(0,96);$('start').firstChild.textContent='Recommencer l’expédition ';}
  });
  $('pause-button').addEventListener('click',togglePause);$('resume').addEventListener('click',togglePause);
  $('restart').addEventListener('click',()=>{load(stage);saveCheckpoint();start('Nouvelle tentative. Le point de reprise est à l’entrée.');});
  $('continue').addEventListener('click',()=>{
    if(mode==='dead'){
      const v=savedRun;if(!restoreRun(v)){load(stage);saveCheckpoint();}
      start('Point de reprise restauré. Le complexe vous attend.');return;
    }
    if(mode==='complete'){newRun((Date.now()>>>0)%1000000);return;}
    load(stage+1);saveCheckpoint();start();
  });
  $('back-menu').addEventListener('click',()=>{load(0);setMode('menu');refreshContinue();});
  for(const id of ['intro-sound','sound-toggle'])$(id).addEventListener('click',()=>{muted=!muted;settings();});
  $('quality-toggle').addEventListener('click',()=>{quality={auto:'low',low:'high',high:'auto'}[quality];renderer.resize(quality);settings();});
  $('motion-toggle').addEventListener('click',()=>{softMotion=!softMotion;settings();});
  $('map-button').addEventListener('click',()=>{$('radar-wrap').hidden=!$('radar-wrap').hidden;drawRadar();});
  $('weapon-switch').addEventListener('click',()=>switchWeapon());
  $('reload').addEventListener('click',()=>location.reload());
  addEventListener('keydown',e=>{
    if(e.code==='Escape'){e.preventDefault();if(mode==='playing')setMode('paused');return;}
    if(e.code==='KeyP'){e.preventDefault();if(!e.repeat)togglePause();return;}
    if(mode!=='playing')return;
    if(['KeyW','KeyZ','KeyA','KeyQ','KeyS','KeyD','Space','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','KeyM','KeyE','Digit1','Digit2'].includes(e.code))e.preventDefault();
    keys.add(e.code);if(e.code==='Space'&&!e.repeat)dashQueued=true;if(e.code==='KeyE'&&!e.repeat)pulseQueued=true;
    if(!e.repeat&&(e.code==='Digit1'||e.code==='Digit2'))switchWeapon(e.code==='Digit1'?0:1);
    if(e.code==='KeyM'&&!e.repeat){$('radar-wrap').hidden=!$('radar-wrap').hidden;drawRadar();}
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('wheel',e=>{if(mode==='playing'&&e.deltaY){e.preventDefault();switchWeapon();}},{passive:false});
  document.addEventListener('pointerlockchange',()=>{const locked=document.pointerLockElement===canvas;if(wasLocked&&!locked&&mode==='playing')setMode('paused');wasLocked=locked;});
  document.addEventListener('mousemove',e=>{if(mode==='playing'&&document.pointerLockElement===canvas){lookDX+=e.movementX*.0022;lookDY-=e.movementY*.0022;}});
  canvas.addEventListener('pointerdown',e=>{
    if(mode!=='playing')return;
    if(e.pointerType==='mouse'){if(e.button===0)mouseFire=true;if(!document.pointerLockElement){dragLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}}
    else if(e.clientX>innerWidth*.36){dragLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}
  });
  canvas.addEventListener('pointermove',e=>{if(dragLook?.id===e.pointerId&&!document.pointerLockElement&&mode==='playing'){const sensitivity=touch?.004:.003;lookDX+=(e.clientX-dragLook.x)*sensitivity;lookDY-=(e.clientY-dragLook.y)*sensitivity;dragLook.x=e.clientX;dragLook.y=e.clientY;}});
  function endPointer(e){if(e.pointerType==='mouse')mouseFire=false;if(dragLook?.id===e.pointerId)dragLook=null;if(moveTouch?.id===e.pointerId){moveTouch=null;stick.x=stick.y=0;$('move-stick').style.transform='';}}
  addEventListener('pointerup',endPointer);addEventListener('pointercancel',endPointer);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  $('move-zone').addEventListener('pointerdown',e=>{if(mode!=='playing'||moveTouch)return;e.preventDefault();const rect=$('move-zone').getBoundingClientRect();moveTouch={id:e.pointerId,x:rect.left+rect.width/2,y:rect.top+rect.height/2};$('move-zone').setPointerCapture(e.pointerId);joystick(e);});
  function joystick(e){if(moveTouch?.id!==e.pointerId)return;const dx=e.clientX-moveTouch.x,dy=e.clientY-moveTouch.y,n=Math.max(1,Math.hypot(dx,dy)/34);stick.x=dx/n/34;stick.y=dy/n/34;$('move-stick').style.transform='translate('+dx/n+'px,'+dy/n+'px)';}
  $('move-zone').addEventListener('pointermove',joystick);
  $('fire-button').addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();touchFire=true;$('fire-button').setPointerCapture(e.pointerId);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])$('fire-button').addEventListener(name,()=>{touchFire=false;});
  $('dash-button').addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();dashQueued=true;});
  $('pulse-button').addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();pulseQueued=true;});
  addEventListener('blur',()=>{if(mode==='playing')setMode('paused');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')setMode('paused');});
  addEventListener('resize',()=>renderer?.resize(quality));
  canvas.addEventListener('webglcontextlost',()=>{if(mode==='playing')setMode('paused');});
  if(touch){$('intro-controls').textContent='Déplacez-vous à gauche · Visez à droite';$('help-text').innerHTML='Joystick gauche : déplacer · Glisser à droite : viser<br>Grand cercle : tirer · Flèche : esquiver<br>Anneaux : onde · Nom de l’arme : changer<br>Chaque relais enregistre un point de reprise.';}
  try{
    renderer=FRender.create(canvas);renderer.resize(quality);document.body.dataset.renderer=renderer.stats.backend||'webgl2';
    savedRun=readSave();refreshContinue();load(0);settings();requestAnimationFrame(frame);
  }catch(error){$('intro').hidden=true;$('error').hidden=false;$('error-copy').textContent='Le moteur graphique n’a pas pu démarrer. Essayez de recharger la page ou d’utiliser un navigateur récent.';console.error('FERRO initialization:',error);}
})();

