// TACT (2) : rectangles des cibles tactiles et du HUD de dist/index.html?touch=1 (file://), aux formats téléphone.
// node layout.mjs <racine METAL> [css-a-injecter.css] [suffixe]
// Sorties : out/layout<suffixe>.json et captures out/shot-<format><suffixe>.png
import {launch} from './cdp.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root=process.argv[2],cssPath=process.argv[3]&&process.argv[3]!=='-'?process.argv[3]:null,suffix=process.argv[4]||'';
const here=new URL('.',import.meta.url).pathname;mkdirSync(here+'out',{recursive:true});
const measure=readFileSync(here+'measure.js','utf8');
const proposal=cssPath?JSON.parse(readFileSync(cssPath,'utf8')):null; // {css, html, targets}
const FORMATS=[{name:'390x844',w:390,h:844,dpr:3,safe:{top:47,bottom:34,left:0,right:0}},{name:'844x390',w:844,h:390,dpr:3,safe:{top:0,bottom:21,left:47,right:47}},{name:'360x640',w:360,h:640,dpr:2,safe:{top:0,bottom:0,left:0,right:0}}];
const C=await launch(here+'chrome-profile');const result={};
try{
  try{await C.send('Emulation.setFocusEmulationEnabled',{enabled:true});}catch{}
  for(const f of FORMATS){
    await C.size(f.w,f.h,f.dpr,true);
    let safeOk=true;try{await C.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:f.safe.top,topMax:f.safe.top,bottom:f.safe.bottom,bottomMax:f.safe.bottom,left:f.safe.left,leftMax:f.safe.left,right:f.safe.right,rightMax:f.safe.right}});}catch(e){safeOk=String(e.message).slice(0,160);}
    await C.navigate('file://'+root+'/dist/index.html?touch=1');
    await C.evaluate('localStorage.clear()');await C.navigate('file://'+root+'/dist/index.html?touch=1');
    const menu=await C.evaluate(`(()=>{const b=document.getElementById('start').getBoundingClientRect();const o=[...document.querySelectorAll('#intro button')].filter(e=>!e.hidden&&e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {id:e.id,w:+r.width.toFixed(1),h:+r.height.toFixed(1),font:getComputedStyle(e).fontSize};});return {start:{x:b.left+b.width/2,y:b.top+b.height/2},buttons:o,touch:document.body.classList.contains('touch'),coarse:matchMedia('(pointer: coarse)').matches,mtp:navigator.maxTouchPoints,inner:[innerWidth,innerHeight],dpr:devicePixelRatio};})()`);
    await C.shot(here+'out/shot-'+f.name+suffix+'-menu.png');
    const t0=Date.now();await C.tap(menu.start.x,menu.start.y,70);                       // vrai toucher sur « Lancer l'assaut »
    const ok=await C.waitFor('document.body.dataset.state==="playing"',45000);const startMs=Date.now()-t0;
    await C.sleep(900);
    if(proposal)await C.evaluate(`(()=>{const s=document.createElement('style');s.id='tact-proposal';s.textContent=${JSON.stringify(proposal.css)};document.head.appendChild(s);const t=document.getElementById('touch-controls');t.insertAdjacentHTML('beforeend',${JSON.stringify(proposal.html||'')});${proposal.js||''}})()`);
    await C.sleep(250);
    const m=await C.evaluate(measure+'('+JSON.stringify(proposal?.targets||[])+')');
    await C.shot(here+'out/shot-'+f.name+suffix+'.png');
    // Événements souris de compatibilité : un toucher bref sur la zone de visée du canvas déclenche-t-il mousedown (donc mouseFire) ?
    await C.evaluate(`(()=>{const c=document.getElementById('world');window.__ev=[];for(const t of ['pointerdown','pointerup','mousedown','mouseup','click','touchstart','touchend'])c.addEventListener(t,e=>window.__ev.push(t+':'+(e.pointerType||'')),{capture:true});})()`);
    await C.tap(Math.round(f.w*.62),Math.round(f.h*.30),60);await C.sleep(400);
    const compat=await C.evaluate('window.__ev.join(" ")');
    const st=await C.evaluate('document.body.dataset.state');
    result[f.name]={format:f,safeOverride:safeOk,menu,started:ok,startMs,stateAfter:st,compatAfterCanvasTap:compat,...m};
    console.error(f.name,'ok='+ok,'state='+m.state,'targets='+m.targets.length,'min='+m.minTarget,'overlaps='+m.overlaps.length,'compat='+compat);
  }
}finally{await C.close();}
writeFileSync(here+'out/layout'+suffix+'.json',JSON.stringify(result,null,1));
console.log('écrit',here+'out/layout'+suffix+'.json');
