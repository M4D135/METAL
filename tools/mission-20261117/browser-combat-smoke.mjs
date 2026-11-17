import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';import {resolve,join} from 'node:path';
import {withChrome} from '../render/chrome.mjs';
const output=resolve(process.argv[2]||'/tmp/metal-combat-browser');mkdirSync(output,{recursive:true});
const report={kind:'Real headless Chrome; offline standalone, software WebGL2 at 480x320 with 960x640 captures. No hardware FPS claim.',checks:[]};
try{await withChrome({timeoutMs:360000,launchTimeoutMs:20000,window:[480,320],angle:'swiftshader',extraArgs:['--no-sandbox']},async browser=>{
 report.browser=browser.version;const page=await browser.openPage(resolve('tools/render/pages/probe.html'));
 await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`
 localStorage.setItem('ferro-settings',JSON.stringify({demo:true,demoDelay:5,muted:true,quality:'low',shadows:false,bloom:false,reflections:'off',autoTune:false}));
 window.__combatScenes=[];let api;
 Object.defineProperty(window,'FSimulation',{configurable:true,get(){return api},set(value){api=value;const create=value.create;value.create=function(...args){const sim=create.apply(this,args),step=sim.step,observation={world:args[0].index,profile:sim.state.activeProfile,shots:0,kills:0,bossKills:0,forcedObstacleActions:0,collisions:0};sim.step=function(dt,input){const result=step.call(this,dt,input),s=sim.state;observation.shots=s.shots;observation.kills=s.kills;observation.time=s.time;observation.bossKills+=s.events.filter(e=>e.name==='bossDeath').length;if(input?.melee&&!s.enemies.some(e=>e.hp>0&&Math.hypot(e.x-s.player.x,e.z-s.player.z)<2))observation.forcedObstacleActions++;if(sim.blocked(s.player.x,s.player.z,.275,s.player.y))observation.collisions++;return result;};window.__combatSim=sim;window.__combatScenes.push(observation);return sim;};}});
 `});
 await page.send('Page.navigate',{url:new URL('file://'+resolve('dist/index.html')+'?demo=1&jobs=main').href});
 const wait=async(expr,label,ms=220000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await page.evaluate(expr))return;await new Promise(r=>setTimeout(r,150));}throw Error('Timeout '+label+': '+await page.evaluate('JSON.stringify({mode:document.body?.dataset.state,observations:window.__combatScenes})'));};
 const check=(name,pass)=>{assert(pass,name);report.checks.push(name);};
 const capture=async(name)=>{await page.send('Emulation.setDeviceMetricsOverride',{width:960,height:640,deviceScaleFactor:1,mobile:false});await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(output,name),Buffer.from(shot.data,'base64'));await page.send('Emulation.setDeviceMetricsOverride',{width:480,height:320,deviceScaleFactor:1,mobile:false});};
 await wait("document.body?.dataset.state==='demo' && __combatSim?.state.shots>0",'live firefight');
 check('title demo is actual gameplay with shots',true);
 check('six current combat scenes without boss showcases',await page.evaluate('MetalDemo.scenes(96).length===6 && MetalDemo.scenes(96).every(s=>s.combatOnly&&!s.boss)'));
 check('current horde world and correct heavy profile',await page.evaluate('__combatSim.state.world.hordeVersion===1 && __combatSim.state.activeProfile==="heavy"'));
 await wait('__combatSim.state.kills>0','a normal enemy killed');
 check('normal combat produces a real kill',true);
 const pieces=await page.evaluate(`(()=>{const out=[],sim=__combatSim,p=sim.state.player;sim.rigid.models(out,{pos:[p.x,p.y+1.62,p.z]},1);const rows=sim.rigid.rows.filter(r=>r.kind==='wreck'),visuals=out.filter(q=>q.wreckActor!==undefined);return {rows:rows.length,visuals:visuals.length,original:rows.every(r=>r.visuals?.length),named:visuals.every(m=>typeof m.actorPart==='string'),shapes:[...new Set(visuals.map(m=>m.shape))]};})()`);
 report.fragments=pieces;check('wrecks render named original geometry, not collision boxes',pieces.rows>0&&pieces.visuals>pieces.rows&&pieces.original&&pieces.named);
 await capture('combat-first-person.png');
 await wait("document.body.dataset.shot==='chase'",'collision-aware over-shoulder view');check('game follow camera used instead of boss orbit shots',true);
 await capture('combat-follow-camera.png');
 report.scenes=await page.evaluate('__combatScenes');const active=report.scenes.at(-1);check('no boss killed or obstacle attacked',active.bossKills===0&&active.forcedObstacleActions===0);check('no static penetration in observed scene',active.collisions===0);
 await page.send('Input.dispatchKeyEvent',{type:'keyDown',code:'Escape',key:'Escape',windowsVirtualKeyCode:27});await page.send('Input.dispatchKeyEvent',{type:'keyUp',code:'Escape',key:'Escape',windowsVirtualKeyCode:27});
 await wait("document.body.dataset.state==='menu'",'normal title return',10000);check('Escape immediately returns to title',true);
 report.renderer=await page.evaluate('document.body.dataset.renderer');report.pageErrors=page.errors;check('no uncaught browser exception',page.errors.length===0);report.ok=true;
});}catch(e){report.ok=false;report.error=e.stack;process.exitCode=1;}
writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
