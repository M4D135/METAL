import {withChrome} from '../../render/chrome.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),out=resolve(process.argv[2]);mkdirSync(out,{recursive:true});
const hook=`<script>
localStorage.clear();window.__demoClock=0;window.__renders=[];Object.defineProperty(window,'FDemo',{configurable:true,set(v){const f=v.attract;v.attract=o=>{o.now=()=>__demoClock;const a=f(o);window.__attract=a;return a;};Object.defineProperty(window,'FDemo',{value:v,writable:true,configurable:true});}});Object.defineProperty(window,'FRender',{configurable:true,set(value){const create=value.create;value.create=function(...args){const r=create.apply(this,args),draw=r.draw;r.__draws=0;r.draw=function(...xs){r.__draws++;const p=window.__sims?.at(-1)?.state.player;r.__camera=xs[0];if(p&&r.__capture){r.__capture.push({pitch:xs[0].pitch,aim:p.pitch,dy:parseFloat(document.getElementById("crosshair").style.marginTop)||0});}return draw.apply(r,xs);};__renders.push(r);return r;};Object.defineProperty(window,'FRender',{value,writable:true,configurable:true});}});window.__effects=[];window.__sims=[];window.__inputs=[];
window.__pad={index:0,id:'Xbox simulated',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false})),vibrationActuator:{playEffect(type,e){__effects.push({type,...e});return Promise.resolve();},reset(){return Promise.resolve();}}};window.__pads=[__pad];Object.defineProperty(navigator,'getGamepads',{value:()=>__pads});
HTMLCanvasElement.prototype.requestPointerLock=function(){return Promise.resolve();};
Object.defineProperty(window,'FSimulation',{configurable:true,set(value){const create=value.create;value.create=function(...args){const s=create.apply(this,args),step=s.step;s.step=function(dt,i){__inputs.push({...i});if(__inputs.length>1000)__inputs.shift();return step.call(s,dt,i);};__sims.push(s);return s;};Object.defineProperty(window,'FSimulation',{value,writable:true,configurable:true});}});
window.__frames=n=>new Promise(resolve=>{function next(){if(--n<=0)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);});
window.__hold=async(index,n=3)=>{__pad.buttons[index]={value:1,pressed:true};await __frames(n);__pad.buttons[index]={value:0,pressed:false};await __frames(3);};
window.__mode=target=>new Promise((resolve,reject)=>{const end=performance.now()+60000;function poll(){if(document.body.dataset.state===target)resolve();else if(performance.now()>end)reject(Error('mode '+document.body.dataset.state+' != '+target));else setTimeout(poll,25);}poll();});
</script>`;
const source=readFileSync(root+'/dist/index.html','utf8'),path=out+'/physics.html';writeFileSync(path,source.replace('<head>','<head>'+hook));
await withChrome({chromePath:process.env.METAL_CHROME||'/usr/bin/google-chrome',angle:process.env.METAL_ANGLE||'swiftshader',window:'960x640'},async browser=>{
 const page=await browser.openPage(path);await page.evaluate('__frames(3)');await page.evaluate("document.getElementById('start').click()");await page.evaluate("__mode('playing')");
 const before=await page.evaluate(`(()=>{const s=__sims.at(-1),r=s.rigid,q=r.rows.find(q=>q.kind==='prop'&&q.size[1]>.5),p=r.physics.body(q.handle).pos;Object.assign(s.state.player,{x:p[0],y:p[1]-q.size[1]/2,z:p[2]+3,yaw:0,pitch:0});window.__physical=q.handle;return {props:r.rows.length,joints:r.physics.joints.count,handle:q.handle,pos:p};})()`);await page.evaluate('__frames(15)');
 let shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(out+'/physics.png',Buffer.from(shot.data,'base64'));
 await page.evaluate(`(()=>{const s=__sims.at(-1),r=s.rigid,p=r.physics.body(__physical).pos;for(let i=0;i<3;i++)r.shoot([p[0],p[1],p[2]+.35],[0,0,-1],2,36);})()`);await page.evaluate('__frames(60)');
 const after=await page.evaluate(`(()=>{const s=__sims.at(-1),r=s.rigid,snap=s.snapshot(),hash=r.hash(),pos=r.physics.body(__physical).pos,okay=s.restore(snap);return {pos,save:okay,hash,restored:s.rigid.hash(),stats:s.rigid.physics.stats,render:__renders.at(-1).backend};})()`);assert(after.save);assert.equal(after.hash,after.restored);assert(Math.hypot(...after.pos.map((v,i)=>v-before.pos[i]))>.08);
 shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(out+'/physics-after.png',Buffer.from(shot.data,'base64'));assert.deepEqual(page.errors,[]);writeFileSync(out+'/receipt.json',JSON.stringify({before,after,errors:page.errors},null,2));await page.close();console.log(JSON.stringify({before,after}));
});
