// TACT : fabrique une COPIE DE TRAVAIL de src/ (dans bench/tact/proto/src) avec un prototype de couche tactile
// dans game.js. Le dépôt METAL n'est jamais modifié. node mkproto.mjs <racine METAL>
// Prototype : (a) le bouton de tir (et GARDE/TIR G) pilote aussi la visée ; (b) manche flottant, rayon 56 px,
// zone morte radiale 0,12 remise à l'échelle, course automatique au-delà de 1,25 R (hystérésis 1,05 R) ;
// (c) courbe d'accélération de visée (gain 1 → 3,2 entre 400 et 2200 px/s) ; (d) verrou d'appui du tir (LOOP-06) ;
// (e) un 2e doigt ne vole plus la visée ; (f) toute la bande gauche (40 %) pilote le manche.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync} from 'node:fs';
const root=process.argv[2],dst=new URL('./proto/src/',import.meta.url).pathname;mkdirSync(dst,{recursive:true});
for(const f of readdirSync(root+'/src'))if(f.endsWith('.js'))copyFileSync(root+'/src/'+f,dst+f);
let s=readFileSync(root+'/src/game.js','utf8');
const rep=(a,b)=>{if(!s.includes(a))throw new Error('ancre absente : '+a.slice(0,80));s=s.replace(a,()=>b);};
// état
rep("let mouseFire=false,mouseLeftFire=false,","let firePressed=false,touchSprint=false,fireLook=null,leftLook=null;\n  const TOUCH={radius:56,dead:.12,sprintOn:1.25,sprintOff:1.05,follow:1.6,sens:.004,accel:2.2,v0:400,v1:2200,pitch:1};\n  function touchLook(state,e){const now=e.timeStamp||performance.now(),dx=e.clientX-state.x,dy=e.clientY-state.y,dtm=Math.max(4,Math.min(50,now-state.t)),v=Math.hypot(dx,dy)/dtm*1000;state.v=state.v===undefined?v:state.v+(v-state.v)*.5;const u=Math.max(0,Math.min(1,(state.v-TOUCH.v0)/(TOUCH.v1-TOUCH.v0))),gain=1+TOUCH.accel*u*u*(3-2*u);lookDX+=dx*TOUCH.sens*prefs.sensitivity*gain;lookDY-=dy*TOUCH.sens*TOUCH.pitch*prefs.sensitivity*gain*(prefs.invertY?-1:1);state.x=e.clientX;state.y=e.clientY;state.t=now;}\n  let mouseFire=false,mouseLeftFire=false,");
rep("dashQueued=pulseQueued=meleeQueued=interactQueued=false;$('move-stick').style.transform='';}","dashQueued=pulseQueued=meleeQueued=interactQueued=false;firePressed=touchSprint=false;fireLook=leftLook=null;$('move-stick').style.transform='';}");
// image : verrou d'appui et course tactile
rep("input.fire=mouseFire||touchFire||held('fire');","input.fire=mouseFire||touchFire||held('fire')||firePressed;");
rep("input.sprint=held('sprint');","input.sprint=held('sprint')||touchSprint;");
rep("sim.step(part,input);input.lookX=input.lookY=0;","sim.step(part,input);if(firePressed){firePressed=false;input.fire=mouseFire||touchFire||held('fire');}input.lookX=input.lookY=0;");
// canvas : visée à droite de 40 % (un seul pointeur de visée), manche flottant à gauche
rep("else if(e.clientX>innerWidth*.36){dragLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}",
    "else if(e.clientX>innerWidth*.4){if(!dragLook){dragLook={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp||performance.now()};canvas.setPointerCapture(e.pointerId);}}\n    else if(!moveTouch){moveTouch={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);joystick(e);}");
rep("canvas.addEventListener('pointermove',e=>{if(dragLook?.id===e.pointerId&&!document.pointerLockElement&&mode==='playing'){",
    "canvas.addEventListener('pointermove',e=>{joystick(e);if(e.pointerType==='touch'){if(dragLook?.id===e.pointerId&&mode==='playing')touchLook(dragLook,e);return;}if(dragLook?.id===e.pointerId&&!document.pointerLockElement&&mode==='playing'){");
rep("if(moveTouch?.id===e.pointerId){moveTouch=null;stick.x=stick.y=0;","if(moveTouch?.id===e.pointerId){moveTouch=null;touchSprint=false;stick.x=stick.y=0;");
// manche : centre au point de contact, rayon 56, zone morte 0,12, course auto
rep("const rect=$('move-zone').getBoundingClientRect();moveTouch={id:e.pointerId,x:rect.left+rect.width/2,y:rect.top+rect.height/2};","moveTouch={id:e.pointerId,x:e.clientX,y:e.clientY};");
rep("function joystick(e){if(moveTouch?.id!==e.pointerId)return;const dx=e.clientX-moveTouch.x,dy=e.clientY-moveTouch.y,n=Math.max(1,Math.hypot(dx,dy)/34);stick.x=dx/n/34;stick.y=dy/n/34;$('move-stick').style.transform='translate('+dx/n+'px,'+dy/n+'px)';}",
    "function joystick(e){if(moveTouch?.id!==e.pointerId)return;let dx=e.clientX-moveTouch.x,dy=e.clientY-moveTouch.y,m=Math.hypot(dx,dy),raw=m/TOUCH.radius;if(raw>TOUCH.follow){const k=1-TOUCH.follow/raw;moveTouch.x+=dx*k;moveTouch.y+=dy*k;dx-=dx*k;dy-=dy*k;m=Math.hypot(dx,dy);raw=TOUCH.follow;}const n=Math.max(0,Math.min(1,(raw-TOUCH.dead)/(1-TOUCH.dead)));stick.x=m?dx/m*n:0;stick.y=m?dy/m*n:0;touchSprint=touchSprint?raw>=TOUCH.sprintOff:raw>=TOUCH.sprintOn;$('move-stick').style.transform='translate('+stick.x*TOUCH.radius+'px,'+stick.y*TOUCH.radius+'px)';}");
// boutons de tir : verrou + visée
rep("touchFire=true;$('fire-button').setPointerCapture(e.pointerId);});","touchFire=true;firePressed=true;fireLook={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp||performance.now()};$('fire-button').setPointerCapture(e.pointerId);});\n  $('fire-button').addEventListener('pointermove',e=>{if(fireLook?.id===e.pointerId&&mode==='playing')touchLook(fireLook,e);});");
rep("$('fire-button').addEventListener(name,()=>{touchFire=false;});","$('fire-button').addEventListener(name,()=>{touchFire=false;fireLook=null;});");
rep("touchLeftFire=true;$('left-fire-button').setPointerCapture(e.pointerId);});","touchLeftFire=true;leftLook={id:e.pointerId,x:e.clientX,y:e.clientY,t:e.timeStamp||performance.now()};$('left-fire-button').setPointerCapture(e.pointerId);});\n  $('left-fire-button').addEventListener('pointermove',e=>{if(leftLook?.id===e.pointerId&&mode==='playing')touchLook(leftLook,e);});");
rep("$('left-fire-button').addEventListener(name,()=>{touchLeftFire=false;});","$('left-fire-button').addEventListener(name,()=>{touchLeftFire=false;leftLook=null;});");
writeFileSync(dst+'game.js',s);
console.log('copie prototype écrite :',dst,'(game.js',s.length,'octets, original',readFileSync(root+'/src/game.js','utf8').length,')');
