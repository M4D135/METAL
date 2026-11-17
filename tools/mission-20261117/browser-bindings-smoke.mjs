import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {withChrome} from '../render/chrome.mjs';
const output=resolve(process.argv[2]||'/tmp/metal-browser');mkdirSync(output,{recursive:true});
const report={kind:'Real headless Chrome, offline standalone game; no hardware FPS claim',checks:[]};
try {
  await withChrome({timeoutMs:120000,launchTimeoutMs:20000,window:[1280,800],angle:'swiftshader',extraArgs:['--no-sandbox']},async browser=>{
    report.browser=browser.version;
    const page=await browser.openPage(resolve('tools/render/pages/probe.html'));
    await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`
      localStorage.setItem('ferro-settings',JSON.stringify({demo:false,muted:true,quality:'low',shadows:false,bloom:false,reflections:'off',autoTune:false}));
      let api;
      Object.defineProperty(window,'FSimulation',{configurable:true,get(){return api;},set(value){
        api=value;const create=value.create;
        value.create=function(...args){const sim=create.apply(this,args),step=sim.step;
          sim.step=function(dt,input){window.__smokeInput={...input};return step.call(this,dt,input);};
          window.__smokeSim=sim;return sim;};
      }});
    `});
    await page.send('Page.navigate',{url:new URL('file://'+resolve('dist/index.html')+'?jobs=main').href});
    const wait=async(expression,label,ms=90000)=>{
      const end=Date.now()+ms;
      while(Date.now()<end){if(await page.evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}
      throw Error('Timed out: '+label+'; state='+await page.evaluate('document.body?.dataset.state'));
    };
    const check=(name,condition)=>{assert(condition,name);report.checks.push(name);};
    const key=async(code,type='keyDown',repeat=false)=>{
      const name=code==='Escape'?'Escape':code.replace('Key','');
      await page.send('Input.dispatchKeyEvent',{type,code,key:name,windowsVirtualKeyCode:code==='Escape'?27:name.charCodeAt(0),autoRepeat:repeat});
    };
    const tap=async code=>{await key(code);await key(code,'keyUp');};
    const saved=()=>page.evaluate("JSON.parse(localStorage.getItem('ferro-settings'))");
    await wait("document.body?.dataset.state==='menu' && !!window.__smokeSim",'menu initialized');
    let settings=await saved();check('R view / C dodge defaults',settings.bindings.view[0]==='KeyR'&&settings.bindings.dash[0]==='KeyC');
    check('versioned preferences',settings.bindingsVersion===3);
    await page.evaluate("document.getElementById('start').click()");
    await wait("document.body.dataset.state==='playing'",'new expedition');
    check('heavy starts active',await page.evaluate("__smokeSim.state.activeProfile==='heavy'"));
    await key('KeyR');await key('KeyR','keyDown',true);await key('KeyR','keyUp');
    check('R switches view once despite repeat',(await saved()).view==='third');
    await key('KeyC');await wait('__smokeSim.state.player.dash>0','C heavy dodge',10000);await key('KeyC','keyUp');
    check('C dodge does not switch view',(await saved()).view==='third');
    await tap('KeyT');await wait("__smokeSim.state.activeProfile==='light'",'drone selection',10000);
    await key('KeyC');await wait('!!window.__smokeInput?.descendHeld','C held drone descent',10000);
    check('drone descent is held',await page.evaluate('__smokeInput.descendHeld===true'));
    await key('KeyC','keyUp');await wait('window.__smokeInput?.descendHeld===false','descent released',10000);
    check('release clears drone descent',true);
    await page.evaluate("document.getElementById('intro-options').click();document.getElementById('tab-controls').click();document.getElementById('bind-view').click()");
    await tap('KeyH');settings=await saved();check('view rebind persists',settings.bindings.view[0]==='KeyH');
    check('rebind leaves dodge unchanged',settings.bindings.dash[0]==='KeyC');
    await page.evaluate("document.getElementById('bind-view').click()");await tap('KeyE');
    check('conflict is reported',await page.evaluate("document.getElementById('binding-status').textContent.includes('Déjà utilisée')"));
    check('conflict preserves prior key',(await saved()).bindings.view[0]==='KeyH');await tap('Escape');
    await page.evaluate("document.getElementById('reset-keys').click()");settings=await saved();
    check('keyboard reset restores R/C',settings.bindings.view[0]==='KeyR'&&settings.bindings.dash[0]==='KeyC');
    check('HUD key labels follow reset',await page.evaluate("document.getElementById('bind-view').textContent==='R' && document.getElementById('bind-dash').textContent==='C'"));
    report.renderer=await page.evaluate('document.body.dataset.renderer');
    report.pageErrors=page.errors;check('no uncaught page exception',page.errors.length===0);
    const shot=await page.send('Page.captureScreenshot',{format:'png'});writeFileSync(join(output,'bindings.png'),Buffer.from(shot.data,'base64'));
    report.ok=true;
  });
}catch(error){report.ok=false;report.error=error.stack;process.exitCode=1;}
writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
