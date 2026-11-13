// Contre-vérification TACT dans Chrome réel (tube CDP, aucun port) : vrais touchers sur dist/index.html?touch=1,
// état de la vraie simulation lu par un piège posé sur window.FSimulation avant le chargement.
import {launch} from '../tact/cdp.mjs';
const root=process.argv[2],here=new URL('.',import.meta.url).pathname;
const C=await launch(here+'chrome-profile');const out={};
const TRAP=`(()=>{let v;Object.defineProperty(window,'FSimulation',{configurable:true,get(){return v;},set(x){const c=x.create;x.create=(...a)=>{const sim=c(...a),st=sim.step;window.__sim=sim;window.__rec=[];sim.step=(dt,i)=>{window.__rec.push([dt,i.lookX,i.lookY,+!!i.fire,+!!i.sprint,i.moveX,i.moveY]);return st(dt,i);};return sim;};v=x;}});})()`;
const yaw=()=>C.evaluate('window.__sim.state.player.yaw');
const st=()=>C.evaluate('({yaw:__sim.state.player.yaw,pitch:__sim.state.player.pitch,shots:__sim.state.shots||0,speed:__sim.state.locomotion.speed,n:__rec.length,hp:__sim.state.player.hp})');
const logOn=`(()=>{window.__ev=[];for(const id of ['world','fire-button','move-zone'])for(const t of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','mousedown','mouseup','click'])document.getElementById(id).addEventListener(t,e=>{if(e.target===e.currentTarget||id!=='world')window.__ev.push(id+':'+t+(e.pointerType?'/'+e.pointerType:''));},{capture:true});})()`;
const hist=async()=>{const e=await C.evaluate('window.__ev.splice(0)');const h={};for(const k of e)h[k]=(h[k]||0)+1;return h;};
try{
  await C.send('Page.addScriptToEvaluateOnNewDocument',{source:TRAP});
  try{await C.send('Emulation.setFocusEmulationEnabled',{enabled:true});}catch{}
  await C.size(390,844,3,true);
  await C.navigate('file://'+root+'/dist/index.html?touch=1');await C.evaluate('localStorage.clear()');await C.navigate('file://'+root+'/dist/index.html?touch=1');
  const b=await C.evaluate(`(()=>{const r=document.getElementById('start').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await C.tap(b.x,b.y,70);out.playing=await C.waitFor('document.body.dataset.state==="playing"',45000);await C.sleep(800);
  const rect=id=>C.evaluate(`(()=>{const r=document.getElementById('${id}').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};})()`);
  const fire=await rect('fire-button'),mz=await rect('move-zone');out.rects={fire,mz};
  await C.evaluate(logOn);
  // A. TACT-01 : pouce posé sur le tir, glisse de ±60 px pendant ~1,5 s
  {const s0=await st();await C.evaluate('__rec.length=0');await C.touch('touchStart',[{x:fire.x,y:fire.y,id:1}]);
   for(let k=1;k<=45;k++){await C.touch('touchMove',[{x:fire.x+60*Math.sin(k/45*Math.PI*2),y:fire.y+20*Math.sin(k/45*Math.PI),id:1}]);await C.sleep(30);}
   await C.touch('touchEnd',[]);await C.sleep(120);const s1=await st();
   const r=await C.evaluate('(()=>{const f=__rec.filter(r=>r[3]);return {pasDeTir:f.length,avecVisee:f.filter(r=>r[1]||r[2]).length};})()');
   out.A_tirEnGlissant={...r,lacetDeg:(s1.yaw-s0.yaw)*180/Math.PI,tirs:s1.shots-s0.shots,evenements:await hist()};}
  // B. référence : même glisser sur le canvas (zone de visée) -> lacet attendu 0 net mais visée active ; puis 100 px nets
  {const s0=await st();await C.touch('touchStart',[{x:250,y:300,id:1}]);for(let k=1;k<=20;k++){await C.touch('touchMove',[{x:250+5*k,y:300,id:1}]);await C.sleep(16);}await C.touch('touchEnd',[]);await C.sleep(120);const s1=await st();
   out.B_glisser100pxCanvas={lacetDeg:(s1.yaw-s0.yaw)*180/Math.PI,attenduDeg:100*.004*180/Math.PI,evenements:await hist()};}
  // C. TACT-03 : 2e doigt sur le canvas pendant la visée
  {const s0=await st();await C.touch('touchStart',[{x:200,y:300,id:1}]);for(let k=1;k<=6;k++){await C.touch('touchMove',[{x:200+5*k,y:300,id:1}]);await C.sleep(16);}await C.sleep(60);const a=await st();
   await C.touch('touchStart',[{x:230,y:300,id:1},{x:300,y:220,id:2}]);await C.sleep(50);
   for(let k=1;k<=12;k++){await C.touch('touchMove',[{x:230+5*k,y:300,id:1},{x:300,y:220,id:2}]);await C.sleep(16);}await C.sleep(60);const b2=await st();
   await C.touch('touchEnd',[]);await C.sleep(100);
   out.C_deuxiemeDoigt={apres30pxDeg:(a.yaw-s0.yaw)*180/Math.PI,apres60pxDePlusDeg:(b2.yaw-s0.yaw)*180/Math.PI,attenduSansVolDeg:90*.004*180/Math.PI,evenements:await hist()};}
  // D. TACT-02 : manche à fond (60 px puis 120 px) -> vitesse et sprint
  {await C.evaluate('__rec.length=0');await C.touch('touchStart',[{x:mz.x,y:mz.y,id:1}]);await C.touch('touchMove',[{x:mz.x,y:mz.y-60,id:1}]);let v=0;for(let k=0;k<25;k++){await C.sleep(60);v=Math.max(v,(await st()).speed);}
   await C.touch('touchMove',[{x:mz.x,y:mz.y-120,id:1}]);let v2=0;for(let k=0;k<15;k++){await C.sleep(60);v2=Math.max(v2,(await st()).speed);}await C.touch('touchEnd',[]);await C.sleep(100);
   out.D_manche={vmax60px:v,vmax120px:v2,sprintVu:await C.evaluate('__rec.some(r=>r[4])'),evenements:await hist()};
   // appui au bord de la zone (4 px à l'intérieur) : amplitude immédiate
   await C.evaluate('__rec.length=0');await C.touch('touchStart',[{x:mz.x-mz.w/2+4,y:mz.y,id:1}]);await C.sleep(120);const amp=await C.evaluate('Math.max(...__rec.map(r=>Math.hypot(r[5],r[6])))');await C.touch('touchEnd',[]);await C.sleep(100);out.D_manche.amplitudeAppuiAuBord=amp;
   // appui dans la bande gauche hors du manche
   await C.evaluate('__rec.length=0');const y0=await yaw();await C.touch('touchStart',[{x:70,y:380,id:1}]);for(let k=1;k<=10;k++){await C.touch('touchMove',[{x:70+5*k,y:380-5*k,id:1}]);await C.sleep(16);}await C.sleep(80);
   out.D_manche.bandeGaucheHorsManche={deplacement:await C.evaluate('__rec.some(r=>r[5]||r[6])'),lacetDeg:((await yaw())-y0)*180/Math.PI};await C.touch('touchEnd',[]);await C.sleep(100);await hist();}
  // E. TACT-04 : tap bref sur le canvas -> souris de compatibilité ; puis avec preventDefault au pointerdown tactile
  {const seq=async()=>{await C.evaluate('window.__ev.length=0');await C.tap(242,253,60);await C.sleep(450);return (await C.evaluate('window.__ev')).filter(e=>e.startsWith('world:')).map(e=>e.slice(6)).join(' ');};
   out.E_tapCanvas={actuel:await seq()};
   await C.evaluate(`document.getElementById('world').addEventListener('pointerdown',e=>{if(e.pointerType==='touch')e.preventDefault();})`);
   out.E_tapCanvas.avecPreventDefault=await seq();
   // la visée fonctionne-t-elle encore après preventDefault ?
   const s0=await st();await C.touch('touchStart',[{x:250,y:300,id:1}]);for(let k=1;k<=20;k++){await C.touch('touchMove',[{x:250+5*k,y:300,id:1}]);await C.sleep(16);}await C.touch('touchEnd',[]);await C.sleep(120);
   out.E_tapCanvas.viseeApresPreventDefaultDeg=((await st()).yaw-s0.yaw)*180/Math.PI;}
  out.etat=await C.evaluate('document.body.dataset.state');
}catch(e){out.erreur=String(e.stack||e).slice(0,600);}finally{await C.close();}
console.log(JSON.stringify(out,null,1));
