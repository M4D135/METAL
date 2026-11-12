// Chrome sans interface piloté par tube (--remote-debugging-pipe : descripteurs 3 et 4, AUCUN port, aucun serveur).
// Même méthode que verifications/apercu-interface.py de Point de rupture. Profil jetable dans bench/tact.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export async function launch(profile){
  const child=spawn(CHROME,['--headless=new','--use-angle=metal','--remote-debugging-pipe','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check',
    '--disable-extensions','--disable-background-networking','--disable-component-update','--disable-sync','--no-pings','--disable-domain-reliability',
    '--host-resolver-rules=MAP * ~NOTFOUND','--window-size=1200,900','--hide-scrollbars','--allow-file-access-from-files','--autoplay-policy=no-user-gesture-required','about:blank'],
    {stdio:['ignore','ignore','ignore','pipe','pipe']});
  const w=child.stdio[3],r=child.stdio[4];let buf=Buffer.alloc(0),id=0;const wait=new Map(),events=[];
  r.on('data',d=>{buf=Buffer.concat([buf,d]);let i;while((i=buf.indexOf(0))>=0){const m=JSON.parse(buf.subarray(0,i).toString('utf8'));buf=buf.subarray(i+1);
    if(m.id&&wait.has(m.id)){const {res,rej,method}=wait.get(m.id);wait.delete(m.id);m.error?rej(new Error(method+' : '+JSON.stringify(m.error))):res(m.result||{});}else if(m.method)events.push(m);}});
  let session=null;
  const send=(method,params={},useSession=true)=>new Promise((res,rej)=>{const msg={id:++id,method,params};if(useSession&&session)msg.sessionId=session;wait.set(id,{res,rej,method});w.write(JSON.stringify(msg)+'\0');
    setTimeout(()=>{if(wait.has(msg.id)){wait.delete(msg.id);rej(new Error('délai : '+method));}},60000);});
  const targets=(await send('Target.getTargets',{},false)).targetInfos,page=targets.find(t=>t.type==='page');
  session=(await send('Target.attachToTarget',{targetId:page.targetId,flatten:true},false)).sessionId;
  await send('Page.enable');await send('Runtime.enable');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const C={send,events,sleep,
    async evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,900));return r.result.value;},
    async waitFor(cond,ms=15000){const end=Date.now()+ms;while(Date.now()<end){if(await C.evaluate('!!('+cond+')'))return true;await sleep(60);}return false;},
    async size(width,height,dpr,mobile=true){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile,screenOrientation:width>height?{type:'landscapePrimary',angle:90}:{type:'portraitPrimary',angle:0}});
      await send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:5});await sleep(250);},
    async navigate(url){await send('Page.navigate',{url});await C.waitFor('document.readyState==="complete"',30000);},
    async shot(path){const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(path,Buffer.from(r.data,'base64'));},
    touch(type,points){return send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({x:p.x,y:p.y,id:p.id??0,radiusX:6,radiusY:6,force:.5}))});},
    async tap(x,y,holdMs=60,id=0){await C.touch('touchStart',[{x,y,id}]);await sleep(holdMs);await C.touch('touchEnd',[]);},
    async close(){try{await send('Browser.close',{},false);}catch{}child.kill();}};
  return C;
}
