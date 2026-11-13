// Lot 01 suite / T4 — the golden campaign digests in other engines.
// Chrome: dist/index.html as built, opened from file:// headless (private
// --user-data-dir, --dump-dom, no port, no server), with an error recorder at the
// top of <head> and a probe at the end of <body> that hashes the 114 worlds
// (6 classic, 54 V1, 54 V2) made by the FWorld of the page. JavaScriptCore (the
// engine of Safari): the jsc shell runs src/fmath.js and src/world.js of the root
// on the same worlds. SHA-256 in plain JavaScript (SHA256_JS of
// tools/platform-math.mjs, checked against node:crypto). Compared with
// checks/campaign-world-digests.json (108 campaign worlds) and with the golden
// legacyHashes of checks/campaign-world.test.mjs (6 classic worlds).
//   node docs/chantier-moteur/preuves/lot-01s/t4/engines-fixture.mjs --dir D [--chrome PATH|none] [--jsc PATH|none] [--report F]
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..');
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const dir=resolve(flag('--dir')||'.'),reportFile=flag('--report');
const chrome=flag('--chrome')||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',jsc=flag('--jsc')||'/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc';
const {SHA256_JS,checkSha256Source,worldList,legacyHashes,FIXTURE}=await import(join(root,'tools/platform-math.mjs'));
checkSha256Source();
mkdirSync(dir,{recursive:true});
const fixtureText=readFileSync(join(root,FIXTURE),'utf8'),fixture=JSON.parse(fixtureText),legacy=legacyHashes(root);
const cases=worldList(fixture.seeds,[1,96]).map(w=>[w.kind,w.seed,w.index]);
const expected=(kind,seed,index)=>kind==='legacy'?legacy.find(h=>h[0]===seed&&h[1]===index)?.[2]??null:fixture[kind]?.[seed]?.[index]??null;
const loop='var cases='+JSON.stringify(cases)+';function optionsOf(k){return k==="legacy"?undefined:k==="v1"?{campaign:true}:{campaign:true,campaignVersion:2};}\n'+
  'function hashAll(W,out){for(var i=0;i<cases.length;i++){var c=cases[i];out.push({kind:c[0],seed:c[1],index:c[2],sha256:sha256(JSON.stringify(W.create(c[1],c[2],optionsOf(c[0]))))});}}\n';
const unescape=text=>text.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function compare(worlds){
  const rows=worlds.map(r=>{const want=expected(r.kind,r.seed,r.index);return {kind:r.kind,seed:r.seed,index:r.index,sha256:r.sha256,equal:r.sha256===want};});
  const tally=kind=>{const k=rows.filter(r=>r.kind===kind);return {equal:k.filter(r=>r.equal).length,of:k.length};};
  return {worlds:rows.length,equal:rows.filter(r=>r.equal).length,legacy:tally('legacy'),v1:tally('v1'),v2:tally('v2'),campaignEqualToFixture:rows.filter(r=>r.kind!=='legacy'&&r.equal).length+'/'+rows.filter(r=>r.kind!=='legacy').length,
    differing:rows.filter(r=>!r.equal).map(r=>`${r.kind}:${r.seed}:${r.index+1}`),rows};
}
const found=path=>path!=='none'&&(path.includes('/')?existsSync(path):true);
const out={schema:'metal-lot01s-t4-engines-fixture-v1',environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},dir:'$W',
  fixture:{file:FIXTURE,sha256:createHash('sha256').update(fixtureText).digest('hex')},cases:cases.length};

if(found(chrome)){
  const page=readFileSync(join(root,'dist/index.html'),'utf8');
  if(page.split('<head>').length!==2||page.split('</body>').length!==2)throw new Error('dist/index.html: expected one <head> and one </body>');
  const head='<script>window.__probeErrors=[];addEventListener("error",function(e){window.__probeErrors.push(String(e.message||e));});</script>';
  const probe='<pre id="probe-out">pending</pre><script>'+SHA256_JS+'\n'+loop+'(function(){var out={ua:navigator.userAgent,errors:window.__probeErrors,worlds:[]},t=performance.now();try{hashAll(FWorld,out.worlds);}catch(e){out.error=String(e&&e.stack||e);}'+
    'out.seconds=Math.round((performance.now()-t)/100)/10;document.getElementById("probe-out").textContent=JSON.stringify(out);})();</script>';
  writeFileSync(join(dir,'fixture-probe.html'),page.replace('<head>','<head>'+head).replace('</body>',probe+'</body>'));
  const profile=join(dir,'chrome-profile-fixture');mkdirSync(profile,{recursive:true});
  const dump=execFileSync(chrome,['--headless=new','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--no-pings','--mute-audio','--dump-dom',pathToFileURL(join(dir,'fixture-probe.html')).href],{maxBuffer:1<<28,timeout:900000,stdio:['ignore','pipe','ignore']}).toString();
  writeFileSync(join(dir,'fixture-probe.dump.html'),dump);
  const m=/<pre id="probe-out">([\s\S]*?)<\/pre>/.exec(dump);
  if(!m||m[1]==='pending')throw new Error('Chrome: no probe output in the dump');
  const result=JSON.parse(unescape(m[1]));
  out.chrome={path:chrome,userAgent:result.ua,page:'dist/index.html',distSha256:createHash('sha256').update(page).digest('hex'),distBytes:Buffer.byteLength(page),pageErrors:result.errors,probeError:result.error??null,seconds:result.seconds,...compare(result.worlds||[])};
}else out.chrome={skipped:chrome==='none'?'--chrome none':'not found: '+chrome};

if(found(jsc)){
  const fmath=readFileSync(join(root,'src/fmath.js'),'utf8'),world=readFileSync(join(root,'src/world.js'),'utf8');
  const script=SHA256_JS+'\nvar window={};\n'+fmath+'\n'+world+'\n'+loop+'var worlds=[],error=null;try{hashAll(window.FWorld,worlds);}catch(e){error=String(e&&e.stack||e);}\nprint(JSON.stringify({error:error,worlds:worlds}));\n';
  writeFileSync(join(dir,'fixture-jsc.js'),script);
  const started=process.hrtime.bigint(),text=execFileSync(jsc,[join(dir,'fixture-jsc.js')],{maxBuffer:1<<26,timeout:1800000}).toString(),result=JSON.parse(text.trim().split('\n').pop());
  out.jsc={path:jsc,sources:{fmath:createHash('sha256').update(fmath).digest('hex'),world:createHash('sha256').update(world).digest('hex')},error:result.error,seconds:Math.round(Number(process.hrtime.bigint()-started)/1e8)/10,...compare(result.worlds||[])};
}else out.jsc={skipped:jsc==='none'?'--jsc none':'not found: '+jsc};

const text=JSON.stringify(out,null,1)+'\n',brief=k=>out[k].skipped?out[k].skipped:{campaign:out[k].campaignEqualToFixture,legacy:out[k].legacy.equal+'/'+out[k].legacy.of,errors:(out[k].pageErrors||[]).length+(out[k].probeError||out[k].error?1:0)};
if(reportFile){mkdirSync(dirname(resolve(reportFile)),{recursive:true});writeFileSync(reportFile,text);console.log(JSON.stringify({report:resolve(reportFile),chrome:brief('chrome'),jsc:brief('jsc')}));}
else process.stdout.write(text);
if([out.chrome,out.jsc].some(e=>!e.skipped&&(e.differing.length||e.probeError||e.error)))process.exitCode=1;
