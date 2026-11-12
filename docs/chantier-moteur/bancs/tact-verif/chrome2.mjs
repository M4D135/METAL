import {launch} from '../tact/cdp.mjs';
const root=process.argv[2],here=new URL('.',import.meta.url).pathname;
const C=await launch(here+'chrome-profile');const out={};
const TRAP=`(()=>{let v;Object.defineProperty(window,'FSimulation',{configurable:true,get(){return v;},set(x){const c=x.create;x.create=(...a)=>{const sim=c(...a);window.__sim=sim;return sim;};v=x;}});})()`;
const yaw=()=>C.evaluate('window.__sim.state.player.yaw*180/Math.PI');
try{
  await C.send('Page.addScriptToEvaluateOnNewDocument',{source:TRAP});
  try{await C.send('Emulation.setFocusEmulationEnabled',{enabled:true});}catch{}
  await C.size(390,844,3,true);
  await C.navigate('file://'+root+'/dist/index.html?touch=1');await C.evaluate('localStorage.clear()');await C.navigate('file://'+root+'/dist/index.html?touch=1');
  const b=await C.evaluate(`(()=>{const r=document.getElementById('start').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await C.tap(b.x,b.y,70);out.playing=await C.waitFor('document.body.dataset.state==="playing"',45000);await C.sleep(6500); // laisse partir le bandeau
  out.sousLesDoigts=await C.evaluate(`[[200,340],[300,380],[320,150],[300,220],[70,380],[100,700],[300,650]].map(([x,y])=>{const e=document.elementFromPoint(x,y);return x+','+y+' -> '+(e.id?'#'+e.id:e.tagName+'.'+e.className)+' pe='+getComputedStyle(e).pointerEvents;})`);
  await C.evaluate(`window.__ev=[];for(const t of ['pointerdown','pointerup','pointercancel'])document.getElementById('world').addEventListener(t,e=>window.__ev.push(t+'#'+e.pointerId),{capture:true});`);
  const y0=await yaw();
  await C.touch('touchStart',[{x:200,y:340,id:1}]);for(let k=1;k<=6;k++){await C.touch('touchMove',[{x:200+5*k,y:340,id:1}]);await C.sleep(16);}await C.sleep(60);const a=await yaw()-y0;
  await C.touch('touchStart',[{x:230,y:340,id:1},{x:300,y:380,id:2}]);await C.sleep(50);
  for(let k=1;k<=12;k++){await C.touch('touchMove',[{x:230+5*k,y:340,id:1},{x:300,y:380,id:2}]);await C.sleep(16);}await C.sleep(60);const b2=await yaw()-y0;
  // le 2e doigt se lève, le 1er continue
  await C.touch('touchEnd',[{x:290,y:340,id:1}]);await C.sleep(50);
  for(let k=1;k<=12;k++){await C.touch('touchMove',[{x:290+5*k,y:340,id:1}]);await C.sleep(16);}await C.sleep(60);const c=await yaw()-y0;
  await C.touch('touchEnd',[]);await C.sleep(100);
  out.deuxiemeDoigt={apres30px:a,apres2eDoigtPuis60px:b2,apresLeverPuis60px:c,attenduSansVol:150*.004*180/Math.PI,evenements:await C.evaluate('window.__ev.join(" ")')};
  // zones mortes dans la bande de visée : glisser de 100 px commencé sur le radar
  const y1=await yaw();await C.touch('touchStart',[{x:320,y:150,id:1}]);for(let k=1;k<=20;k++){await C.touch('touchMove',[{x:320-5*k,y:150,id:1}]);await C.sleep(16);}await C.touch('touchEnd',[]);await C.sleep(100);
  out.glisserCommenceSurLeRadar={lacet:await yaw()-y1,attendu:-100*.004*180/Math.PI};
}catch(e){out.erreur=String(e.stack||e).slice(0,600);}finally{await C.close();}
console.log(JSON.stringify(out,null,1));
