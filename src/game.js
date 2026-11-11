/* FERRO — browser shell, controls and procedural characters. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('world'),clamp=FSimulation.clamp;
  const touch=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>1||new URLSearchParams(location.search).get('touch')==='1';
  document.body.classList.toggle('touch',touch);
  let muted=false,quality='auto',softMotion=true;
  try{const v=JSON.parse(localStorage.getItem('ferro-settings')||'{}');muted=!!v.muted;quality=['auto','low','high'].includes(v.quality)?v.quality:'auto';softMotion=v.softMotion!==false;}catch{}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)softMotion=false;
  const audio=FAudio.create();let renderer,world,sim,stage=0,seed=96,mode='menu',last=performance.now(),clock=0,hudWait=0,toastTime=0,wasLocked=false,perfStart=last,perfFrames=0;
  let runStats={time:0,kills:0,shots:0,hits:0};
  const keys=new Set(),input={moveX:0,moveY:0,lookX:0,lookY:0,fire:false,dash:false,sprint:false,assist:touch};
  let mouseFire=false,touchFire=false,dragLook=null,moveTouch=null,stick={x:0,y:0},lookDX=0,lookDY=0,dashQueued=false;
  function saveSettings(){try{localStorage.setItem('ferro-settings',JSON.stringify({muted,quality,softMotion}));}catch{}}
  function settings(){
    $('intro-sound').textContent=muted?'SON COUPÉ':'SON ACTIVÉ';
    $('sound-toggle').querySelector('strong').textContent=muted?'Coupé':'Activé';
    $('quality-toggle').querySelector('strong').textContent={auto:'Auto',low:'Économie',high:'Haute'}[quality];
    $('motion-toggle').querySelector('strong').textContent=softMotion?'Doux':'Désactivés';
    document.body.classList.toggle('low-motion',!softMotion);audio.setMuted(muted||mode!=='playing');saveSettings();
  }
  function toast(message,seconds=2.8){$('toast').textContent=message;$('toast').classList.add('visible');toastTime=seconds;}
  function clearInput(){keys.clear();mouseFire=touchFire=false;dragLook=moveTouch=null;stick.x=stick.y=lookDX=lookDY=0;dashQueued=false;$('move-stick').style.transform='';}
  function setMode(value){
    mode=value;document.body.dataset.state=value;$('intro').hidden=value!=='menu';$('hud').hidden=!['playing','paused'].includes(value);$('pause').hidden=value!=='paused';$('result').hidden=!['dead','cleared','complete'].includes(value);clearInput();audio.setMuted(muted||value==='menu'||value==='paused');
    if(value!=='playing'&&document.pointerLockElement)document.exitPointerLock();
  }
  function load(n,newSeed){
    stage=n;if(newSeed!==undefined)seed=newSeed;world=FWorld.create(seed,stage);sim=FSimulation.create(world);renderer.setWorld(world.meshes,world.lights);
    $('sector-number').textContent='ÉTAGE '+String(stage+1).padStart(2,'0')+' / 03';$('sector-title').textContent=world.title;
    document.body.dataset.stage=String(stage+1);$('radar-wrap').hidden=false;hudWait=0;renderHUD();
  }
  function lock(){
    if(touch)return;
    try{const result=canvas.requestPointerLock?.();if(result?.catch)result.catch(()=>toast('Maintenez et glissez pour regarder. Flèches : tourner.',4));}catch{toast('Glissez pour regarder. Flèches : tourner.',4);}
  }
  function start(){
    audio.start();audio.resume();setMode('playing');lock();canvas.focus({preventScroll:true});
    toast(stage===0?'Récupérez les trois relais lumineux, puis rejoignez la sortie.':'Les machines vous ont repéré. Trouvez les trois relais.',4.5);
  }
  function result(dead){
    const s=sim.state,finished=!dead&&stage===2;
    if(!dead){runStats.time+=s.elapsed;runStats.kills+=s.kills;runStats.shots+=s.shots;runStats.hits+=s.hits;}
    $('result-kicker').textContent=dead?'TRANSMISSION PERDUE':finished?'TRANSMISSION RÉTABLIE':'RELAIS SYNCHRONISÉS';
    $('result-title').textContent=dead?'Signal perdu.':finished?'Vous êtes sorti.':'Étage sécurisé.';
    $('result-copy').textContent=dead?'Les machines ont eu le dessus. Gardez vos distances et esquivez leurs projectiles.':finished?'Neuf relais rallumés. Trois étages traversés. Le complexe peut enfin se taire.':'Le passage inférieur est ouvert. Quelque chose vous attend plus bas.';
    const stats=finished?runStats:{time:s.elapsed,kills:s.kills,shots:s.shots,hits:s.hits};
    $('result-time').textContent=formatTime(stats.time);$('result-kills').textContent=String(stats.kills);$('result-accuracy').textContent=(stats.shots?Math.round(stats.hits/stats.shots*100):0)+'%';
    $('continue').innerHTML=(dead?'Reprendre cet étage':finished?'Nouvelle expédition':'Descendre à l’étage '+(stage+2))+' <span class="arrow-icon" aria-hidden="true"></span>';
    setMode(dead?'dead':finished?'complete':'cleared');
  }
  function formatTime(v){return Math.floor(v/60)+':'+String(Math.floor(v%60)).padStart(2,'0');}
  function events(){
    for(const e of sim.state.events){
      if(typeof audio[e.name]==='function')audio[e.name]();
      if(e.name==='core')toast(e.count===3?'Trois relais en ligne. Rejoignez la sortie.':'Relais '+e.count+' / 3 synchronisé · intégrité restaurée');
      if(e.name==='pickup')toast('Intégrité restaurée',1.8);
      if(e.name==='overheat')toast('Surchauffe · laissez refroidir',1.6);
      if(e.name==='win'){result(false);break;}
      if(e.name==='dead'){result(true);break;}
    }
    sim.state.events.length=0;
  }
  const m=(shape,p,s,mat,r=[0,0,0],emissive=0)=>({shape,p,s,mat,r,emissive});
  function models(t,playing){
    const out=[],s=sim.state,p=s.player;
    for(const c of s.cores){
      out.push(m('cylinder',[c.x,.13,c.z],[.95,.26,.95],0),m('ring',[c.x,.29,c.z],[1.15,.1,1.15],c.taken?0:5));
      if(!c.taken){const y=1.22+Math.sin(t*2+c.id)*.13;out.push(m('octa',[c.x,y,c.z],[.55,.85,.55],5,[0,t*.7,0],1.8),m('ring',[c.x,y,c.z],[1.2,1.2,1.2],4,[Math.PI/2,0,t*.35],1.2));}
    }
    for(const e of s.enemies){
      if(e.hp<=0)continue;const rot=Math.atan2(p.x-e.x,p.z-e.z),y=e.y+(e.type===1?0:Math.sin(t*2+e.id)*.1),mat=e.hurt>0?5:1;
      if(e.type===0){
        out.push(m('octa',[e.x,y,e.z],[1,.7,1],mat,[0,t*.3+e.id,0]),m('sphere',[e.x,y,e.z],[.42,.42,.42],6,[0,0,0],1.5),m('ring',[e.x,y-.1,e.z],[1.2,.1,1.2],0,[.15,0,0]));
        for(let j=0;j<3;j++){const a=t*.5+j*Math.PI*2/3+e.id;out.push(m('box',[e.x+Math.cos(a)*.57,y,e.z+Math.sin(a)*.57],[.16,.25,.45],0,[0,-a,0]),m('sphere',[e.x+Math.cos(a)*.66,y-.1,e.z+Math.sin(a)*.66],[.1,.1,.1],6,[0,0,0],1.4));}
      }else if(e.type===1){
        out.push(m('box',[e.x,1.05,e.z],[1.05,.85,.65],mat,[0,rot,0]),m('box',[e.x,1.67,e.z],[.6,.4,.5],0,[0,rot,0]));
        for(const side of [-1,1]){const x=e.x+Math.cos(rot)*side*.38,z=e.z-Math.sin(rot)*side*.38;out.push(m('box',[x,.4,z],[.29,.8,.4],0,[e.active?Math.sin(t*5)*side*.16:0,rot,0]),m('cylinder',[x,1.2,z],[.2,.7,.2],7,[0,0,Math.PI/2]));}
        out.push(m('box',[e.x+Math.sin(rot)*.28,1.69,e.z+Math.cos(rot)*.28],[.4,.08,.08],6,[0,rot,0],1.8));
      }else{
        out.push(m('sphere',[e.x,y,e.z],[.8,.8,.8],mat),m('octa',[e.x,y,e.z],[.4,1.35,.4],0,[0,t*.5,0]),m('ring',[e.x,y,e.z],[1.35,1.35,1.35],0,[Math.PI/2,rot,t*.4]));
        out.push(m('sphere',[e.x+Math.sin(rot)*.4,y,e.z+Math.cos(rot)*.4],[.3,.3,.3],6,[0,0,0],2));
      }
    }
    for(const c of s.pickups)if(!c.taken){const y=.5+Math.sin(t*2+c.x)*.06;out.push(m('box',[c.x,y,c.z],[.45,.4,.45],0,[0,t*.4,0]),m('box',[c.x,y+.22,c.z],[.3,.035,.09],4,[0,t*.4,0],1),m('box',[c.x,y+.22,c.z],[.09,.035,.3],4,[0,t*.4,0],1));}
    const ex=world.exit.x,ez=world.exit.z,ready=s.relays===3,exitMat=ready?4:5;
    out.push(m('cylinder',[ex,.08,ez],[2.5,.16,2.5],0),m('ring',[ex,.2,ez],[2.7,.1,2.7],exitMat,[0,0,0],1.4));
    for(const side of [-1,1]){out.push(m('box',[ex+side*1.4,1.65,ez],[.25,3.3,.5],0),m('box',[ex+side*1.24,1.65,ez],[.06,2.9,.2],exitMat,[0,0,0],1.4));}
    out.push(m('box',[ex,3.2,ez],[2.9,.25,.5],0));
    if(ready)for(let j=0;j<6;j++){const a=t*1.1+j*1.047;out.push(m('octa',[ex+Math.cos(a)*.7,.4+((t*.6+j*.4)%2.4),ez+Math.sin(a)*.7],[.1,.16,.1],4,[0,t,0],2));}
    for(const q of s.bullets)out.push(m('sphere',[q.x,q.y,q.z],[.2,.2,.2],6,[0,0,0],2.6));
    for(const q of s.particles){const v=Math.min(.11,q.life*.17);out.push(m('box',[q.x,q.y,q.z],[v,v,v],q.kind,[t,t,0],1.6));}
    if(playing){
      const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw),sp=Math.sin(p.pitch),cp=Math.cos(p.pitch),recoil=s.flash*.07;
      const bob=softMotion&&s.moving>.1?Math.sin(t*9)*.012:0;
      function gun(shape,x,y,z,siz,mat,rx=0,em=0){
        x+=.27*Math.min(1,Math.max(.45,(innerWidth/innerHeight)/1.2));y+=-.29+bob;z+=-.56+recoil;
        const pos=[p.x+cy*x-sy*sp*y-sy*cp*z,1.62+cp*y-sp*z,p.z+sy*x+cy*sp*y+cy*cp*z];
        const a=m(shape,pos,siz,mat,[p.pitch+rx,-p.yaw,0],em);a.overlay=true;out.push(a);
      }
      gun('box',0,-.09,.12,[.17,.25,.17],7,-.2);
      gun('box',0,0,-.03,[.2,.18,.52],0);
      gun('box',0,.105,.04,[.15,.045,.27],1);
      gun('box',-.106,.025,-.02,[.015,.055,.28],s.player.overheated?6:4,0,1.2);
      gun('box',.106,.025,-.02,[.015,.055,.28],1);
      gun('cylinder',0,.01,-.34,[.13,.24,.13],0,Math.PI/2);
      gun('cylinder',0,.01,-.47,[.16,.045,.16],1,Math.PI/2);
      gun('box',0,.14,-.13,[.035,.04,.035],4,0,.5);
      if(s.flash>.2)gun('octa',0,.01,-.53,[.12+s.flash*.12,.12+s.flash*.12,.15+s.flash*.25],5,0,2.5);
    }
    return out;
  }
  function renderHUD(){
    const s=sim.state,p=s.player;
    $('hp').textContent=String(Math.ceil(p.hp));$('hp-bar').style.width=p.hp+'%';$('hp-bar').style.background=p.hp<30?'#ff795e':'var(--acid)';
    $('heat-bar').style.width=p.heat*100+'%';$('heat-bar').style.background=p.overheated?'#ff795e':'#6ce5d2';$('weapon-label').textContent=p.overheated?'REFROIDISSEMENT':'IMPULSE / 01';
    $('dash-label').textContent=p.dash>0?'ESQUIVE · '+p.dash.toFixed(1)+' s':'ESPACE · ESQUIVE PRÊTE';$('dash-button').style.opacity=p.dash>0?'.35':'1';
    $('relay-count').textContent=s.relays+' / 3';$('relays').querySelectorAll('i').forEach((el,i)=>el.classList.toggle('on',i<s.relays));
    $('objective-label').textContent=s.relays===3?'REJOINDRE LA SORTIE':'RÉCUPÉRER LES RELAIS';
    document.body.dataset.relays=String(s.relays);document.body.dataset.health=String(Math.ceil(p.hp));
    const targets=s.relays===3?[world.exit]:s.cores.filter(c=>!c.taken),target=targets.reduce((a,c)=>!a||Math.hypot(c.x-p.x,c.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?c:a,null);
    if(target){$('target-label').textContent=s.relays===3?'SORTIE':'RELAIS';$('target-distance').textContent=Math.round(Math.hypot(target.x-p.x,target.z-p.z))+' m';const angle=Math.atan2(target.x-p.x,p.z-target.z)-p.yaw;$('target-arrow').style.transform='rotate('+angle+'rad)';}
    const room=world.rooms.find(r=>Math.abs(p.x-r.x)<r.w/2&&Math.abs(p.z-r.z)<r.d/2);$('room-name').textContent=room?room.name:'COULOIR DE LIAISON';
    drawRadar();
  }
  function drawRadar(){
    if($('radar-wrap').hidden)return;
    const ctx=$('radar').getContext('2d'),b=world.bounds,k=160/Math.max(b.maxX-b.minX,b.maxZ-b.minZ),X=x=>10+(x-b.minX)*k,Z=z=>10+(z-b.minZ)*k;
    ctx.clearRect(0,0,180,180);ctx.fillStyle='#8caf9320';ctx.strokeStyle='#779d7c77';ctx.lineWidth=.8;
    for(const r of [...(world.corridors||[]),...world.rooms]){ctx.fillRect(X(r.x-r.w/2),Z(r.z-r.d/2),r.w*k,r.d*k);ctx.strokeRect(X(r.x-r.w/2),Z(r.z-r.d/2),r.w*k,r.d*k);}
    for(const c of sim.state.cores){ctx.fillStyle=c.taken?'#567260':'#d7f36b';ctx.save();ctx.translate(X(c.x),Z(c.z));ctx.rotate(Math.PI/4);ctx.fillRect(-2.5,-2.5,5,5);ctx.restore();}
    ctx.strokeStyle=sim.state.relays===3?'#71e1cc':'#b08449';ctx.strokeRect(X(world.exit.x)-3,Z(world.exit.z)-3,6,6);
    const p=sim.state.player;ctx.save();ctx.translate(X(p.x),Z(p.z));ctx.rotate(p.yaw);ctx.fillStyle='#f2f5e5';ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(3.5,3.2);ctx.lineTo(0,1.5);ctx.lineTo(-3.5,3.2);ctx.closePath();ctx.fill();ctx.restore();
  }
  function frame(now){
    requestAnimationFrame(frame);let dt=clamp((now-last)/1000,0,.05);last=now;clock+=dt;
    perfFrames++;if(now-perfStart>1000){document.body.dataset.fps=String(Math.round(perfFrames*1000/(now-perfStart)));perfStart=now;perfFrames=0;}
    if(!renderer||!sim||document.hidden)return;
    if(mode==='playing'){
      input.moveX=(keys.has('KeyD')?1:0)-(keys.has('KeyA')||keys.has('KeyQ')?1:0)+stick.x;
      input.moveY=(keys.has('KeyW')||keys.has('KeyZ')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-stick.y;
      input.lookX=lookDX+((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*dt*1.9;input.lookY=lookDY;
      input.fire=mouseFire||touchFire||keys.has('Enter');input.dash=dashQueued;input.sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');
      lookDX=lookDY=0;dashQueued=false;sim.step(dt,input);audio.tick(dt);audio.setThreat(sim.state.threat||0);if(sim.state.moving>.5)audio.step(sim.state.moving);events();
      toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');
      hudWait-=dt;if(hudWait<=0){renderHUD();hudWait=.09;}
      $('crosshair').classList.toggle('hit',sim.state.hitMarker>0);$('damage').style.opacity=String(sim.state.damage*.45);
    }else{$('damage').style.opacity='0';}
    const p=sim.state.player,isPlay=mode==='playing'||mode==='paused';
    const camera={pos:[p.x,1.62+(isPlay&&softMotion&&sim.state.moving>.1?Math.sin(clock*9)*.012:0),p.z],yaw:p.yaw,pitch:p.pitch,fov:touch?79:74};
    if(mode==='menu'){camera.yaw=world.spawn.yaw+.38+Math.sin(clock*.13)*.11;camera.pitch=.02;camera.pos[1]=1.72;}
    renderer.draw(camera,models(clock,isPlay),{time:clock,flash:sim.state.flash,damage:sim.state.damage,shake:0});
  }
  function togglePause(){if(mode==='playing')setMode('paused');else if(mode==='paused'){audio.resume();setMode('playing');lock();canvas.focus({preventScroll:true});}}
  $('start').addEventListener('click',()=>{runStats={time:0,kills:0,shots:0,hits:0};load(0,seed);start();});
  $('pause-button').addEventListener('click',togglePause);$('resume').addEventListener('click',togglePause);
  $('restart').addEventListener('click',()=>{load(stage);start();});
  $('continue').addEventListener('click',()=>{if(mode==='dead')load(stage);else if(mode==='complete'){runStats={time:0,kills:0,shots:0,hits:0};load(0,(Date.now()>>>0)%1000000);}else load(stage+1);start();});
  $('back-menu').addEventListener('click',()=>{runStats={time:0,kills:0,shots:0,hits:0};load(0);setMode('menu');});
  for(const id of ['intro-sound','sound-toggle'])$(id).addEventListener('click',()=>{muted=!muted;settings();});
  $('quality-toggle').addEventListener('click',()=>{quality={auto:'low',low:'high',high:'auto'}[quality];renderer.resize(quality);settings();});
  $('motion-toggle').addEventListener('click',()=>{softMotion=!softMotion;settings();});
  $('map-button').addEventListener('click',()=>{$('radar-wrap').hidden=!$('radar-wrap').hidden;drawRadar();});
  $('reload').addEventListener('click',()=>location.reload());
  addEventListener('keydown',e=>{
    if(e.code==='Escape'){e.preventDefault();if(mode==='playing')setMode('paused');return;}
    if(e.code==='KeyP'){e.preventDefault();if(!e.repeat)togglePause();return;}
    if(mode!=='playing')return;
    if(['KeyW','KeyZ','KeyA','KeyQ','KeyS','KeyD','Space','ShiftLeft','ShiftRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter','KeyM'].includes(e.code))e.preventDefault();
    keys.add(e.code);if(e.code==='Space'&&!e.repeat)dashQueued=true;if(e.code==='KeyM'&&!e.repeat){$('radar-wrap').hidden=!$('radar-wrap').hidden;drawRadar();}
  });
  addEventListener('keyup',e=>keys.delete(e.code));
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
  $('fire-button').addEventListener('pointerdown',e=>{e.preventDefault();touchFire=true;$('fire-button').setPointerCapture(e.pointerId);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])$('fire-button').addEventListener(name,()=>{touchFire=false;});
  $('dash-button').addEventListener('pointerdown',e=>{e.preventDefault();dashQueued=true;});
  addEventListener('blur',()=>{if(mode==='playing')setMode('paused');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')setMode('paused');});
  addEventListener('resize',()=>renderer?.resize(quality));
  canvas.addEventListener('webglcontextlost',()=>{if(mode==='playing')setMode('paused');});
  if(touch){$('intro-controls').textContent='Déplacez-vous à gauche · Visez à droite';$('help-text').innerHTML='Joystick gauche : se déplacer<br>Glisser à droite : viser<br>Grand bouton : tirer · Éclair : esquiver<br>Les relais se récupèrent en s’approchant.';}
  try{renderer=FRender.create(canvas);renderer.resize(quality);document.body.dataset.renderer=renderer.stats.backend||'webgl2';load(0);settings();requestAnimationFrame(frame);}catch(error){$('intro').hidden=true;$('error').hidden=false;$('error-copy').textContent='Le moteur graphique n’a pas pu démarrer. Essayez de recharger la page ou d’utiliser un navigateur récent.';console.error('FERRO initialization:',error);}
})();
