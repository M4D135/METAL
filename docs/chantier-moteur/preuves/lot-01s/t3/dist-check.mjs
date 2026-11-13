// Lot 01 suite / T3 — the built page itself: does dist/index.html, opened in
// Chrome headless from file://, generate the same worlds as Node? A copy of the
// page gets an error recorder at the top of <head> and, at the end of <body>, a
// probe that hashes the 42 worlds of seed 96 (classic seeds 1 and 96, V1 and V2
// of seed 96) with SHA-256 (tools/platform-math.mjs SHA256_JS, checked against
// node:crypto). The digests are compared with those of tools/platform-math.mjs
// worlds for the same root. Private --user-data-dir, --dump-dom, no port.
//   node docs/chantier-moteur/preuves/lot-01s/t3/dist-check.mjs --dir D [--chrome PATH] [--report F]
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..');
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const dir=resolve(flag('--dir')||'.'),chrome=flag('--chrome')||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',reportFile=flag('--report');
const {SHA256_JS,checkSha256Source,worldList}=await import(join(root,'tools/platform-math.mjs'));
const {loadRealm}=await import(join(root,'tools/realm-loader.mjs'));
checkSha256Source();
mkdirSync(dir,{recursive:true});
const page=readFileSync(join(root,'dist/index.html'),'utf8'),pageSha256=createHash('sha256').update(page).digest('hex');
const list=[...worldList([],[1,96]),...worldList([96],[])].map(w=>[w.kind,w.seed,w.index]);
const head='<script>window.__probeErrors=[];addEventListener("error",function(e){window.__probeErrors.push(String(e.message||e));});</script>';
const probe='<pre id="probe-out">pending</pre><script>'+SHA256_JS+'\n(function(){var out={ua:navigator.userAgent,errors:window.__probeErrors,worlds:[]};try{'+
  'var cases='+JSON.stringify(list)+';for(var i=0;i<cases.length;i++){var c=cases[i],o=c[0]==="legacy"?undefined:c[0]==="v1"?{campaign:true}:{campaign:true,campaignVersion:2};'+
  'out.worlds.push({kind:c[0],seed:c[1],index:c[2],sha256:sha256(JSON.stringify(FWorld.create(c[1],c[2],o)))});}}catch(e){out.error=String(e&&e.stack||e);}'+
  'document.getElementById("probe-out").textContent=JSON.stringify(out);})();</script>';
if(page.split('<head>').length!==2||page.split('</body>').length!==2)throw new Error('dist/index.html: expected one <head> and one </body>');
const html=page.replace('<head>','<head>'+head).replace('</body>',probe+'</body>');
writeFileSync(join(dir,'dist-probe.html'),html);
const profile=join(dir,'chrome-profile-dist');mkdirSync(profile,{recursive:true});
const dump=execFileSync(chrome,['--headless=new','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--no-pings','--mute-audio','--dump-dom',pathToFileURL(join(dir,'dist-probe.html')).href],{maxBuffer:1<<28,timeout:600000,stdio:['ignore','pipe','ignore']}).toString();
writeFileSync(join(dir,'dist-probe.dump.html'),dump);
const m=/<pre id="probe-out">([\s\S]*?)<\/pre>/.exec(dump);
if(!m)throw new Error('no probe output in the dump');
const result=JSON.parse(m[1].replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'));
// Node side: the same worlds from the sources of this root (fmath before world).
const W=loadRealm({root,modules:['fmath','world']}).window.FWorld,rows=[];
for(const r of result.worlds||[]){
  const o=r.kind==='legacy'?undefined:r.kind==='v1'?{campaign:true}:{campaign:true,campaignVersion:2};
  const node=createHash('sha256').update(JSON.stringify(W.create(r.seed,r.index,o))).digest('hex');
  rows.push({kind:r.kind,seed:r.seed,index:r.index,chrome:r.sha256,node,equal:r.sha256===node});
}
const report={schema:'metal-lot01s-t3-dist-check-v1',environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},chrome:{path:chrome,userAgent:result.ua},
  distSha256:pageSha256,distBytes:Buffer.byteLength(page),pageErrors:result.errors,probeError:result.error??null,worlds:rows.length,equalToNode:rows.filter(r=>r.equal).length,
  note:'dist/index.html as built, opened from file:// in Chrome headless; FWorld of the page, SHA-256 of JSON.stringify(world); Node: src/fmath.js and src/world.js of the same root in the main realm.',rows};
const text=JSON.stringify(report,null,1)+'\n';
if(reportFile){mkdirSync(dirname(resolve(reportFile)),{recursive:true});writeFileSync(reportFile,text);console.log(JSON.stringify({report:resolve(reportFile),worlds:report.worlds,equalToNode:report.equalToNode,pageErrors:report.pageErrors.length,probeError:report.probeError}));}
else process.stdout.write(text);
