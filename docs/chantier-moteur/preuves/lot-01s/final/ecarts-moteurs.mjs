// Lot 01 suite / T5 — what the lot changes for players, engine by engine (MURS-V1).
// Outside the game and outside npm test; nothing is written in src/, checks/ or dist/.
// For each of the 114 worlds (classic worlds of seeds 1 and 96, campaign V1 and V2
// of seeds 1, 96 and 2026), "before" is the src/world.js of --base (before T2: the
// Math of the engine) and "after" the src/world.js of the root (FMath, T2 and T3),
// generated in the same engine:
//   - Node: this process, main realm (tools/realm-loader.mjs, never node:vm);
//   - Chrome headless: a file:// page (--dump-dom, private --user-data-dir under
//     --dir, no port, no server);
//   - JavaScriptCore (the engine of Safari): a script run by the jsc shell.
// Per world: numbers that differ, largest absolute difference per field, structural
// differences (keys, types, non-numeric values), and the checkpoint fingerprint
// (FSimulation snapshot().fingerprint, src/simulation.js) before and after: when it
// changes, a checkpoint saved before the fix in that engine is refused by restore.
// The world after the fix is also compared with Node's (fingerprint and FNV-1a of
// its JSON). The same comparison source (CORE) runs in the three engines.
//
//   node --import='data:text/javascript,Object.getOwnPropertyDescriptors(globalThis)' \
//     docs/chantier-moteur/preuves/lot-01s/final/ecarts-moteurs.mjs --base B --dir D \
//     [--chrome PATH|none] [--jsc PATH|none] [--seeds 1,96,2026] [--report F]
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../../..');
const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
const base=flag('--base')&&resolve(flag('--base')),dir=resolve(flag('--dir')||'.'),reportFile=flag('--report');
const chrome=flag('--chrome')||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',jsc=flag('--jsc')||'/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc';
const seeds=(flag('--seeds')||'1,96,2026').split(',').map(Number);
if(!base)throw new Error('--base <root before the fix> is required');
const {loadRealm}=await import(join(root,'tools/realm-loader.mjs'));
const {worldList,worldUsesFMath}=await import(join(root,'tools/platform-math.mjs'));
if(worldUsesFMath(base))throw new Error(base+': src/world.js already takes its trigonometry from FMath; --base must be a root before T2');
if(!worldUsesFMath(root))throw new Error(root+': src/world.js does not take its trigonometry from FMath');
mkdirSync(dir,{recursive:true});

// Comparison source, evaluated as is in Node, Chrome and jsc. walk() is the one of
// tools/platform-math.mjs (checkpoints), with per-world field maxima.
const CORE=String.raw`
function walk(a,b,path,acc){
  if(typeof a==='number'&&typeof b==='number'){
    if(!Object.is(a,b)){
      acc.numeric++;var d=Math.abs(a-b);if(d>acc.maxAbs){acc.maxAbs=d;acc.maxPath=path;}
      var field=path.split('.').filter(function(p){return p!=='$'&&!/^\d+$/.test(p);}).join('.'),f=acc.byField[field]||(acc.byField[field]={count:0,maxAbs:0});f.count++;if(d>f.maxAbs)f.maxAbs=d;
    }
    return;
  }
  if(typeof a!==typeof b||(a===null)!==(b===null)){acc.structural.push(path+' type');return;}
  if(a&&typeof a==='object'){
    var ka=Object.keys(a),kb=Object.keys(b);
    if(ka.length!==kb.length||ka.some(function(k,i){return k!==kb[i];})){acc.structural.push(path+' keys');return;}
    for(var i=0;i<ka.length;i++)walk(a[ka[i]],b[ka[i]],path+'.'+ka[i],acc);
    return;
  }
  if(a!==b)acc.structural.push(path+' value');
}
function fnv(s){var h=2166136261;for(var i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16).padStart(8,'0');}
function optionsOf(kind){return kind==='legacy'?undefined:kind==='v1'?{campaign:true}:{campaign:true,campaignVersion:2};}
function fingerprintOf(FS,w){var s=FS.create(w),f=s.snapshot().fingerprint;if(s.dispose)s.dispose();return f;}
function compareWorlds(before,after,FS,cases){
  var rows=[];
  for(var n=0;n<cases.length;n++){
    var c=cases[n],a=before.create(c[1],c[2],optionsOf(c[0])),b=after.create(c[1],c[2],optionsOf(c[0]));
    var ja=JSON.stringify(a),jb=JSON.stringify(b),acc={numeric:0,maxAbs:0,maxPath:'',structural:[],byField:{}};
    if(ja!==jb)walk(a,b,'$',acc);
    rows.push({kind:c[0],seed:c[1],index:c[2],jsonChanged:ja!==jb,numeric:acc.numeric,maxAbs:acc.maxAbs,maxPath:acc.maxPath,structural:acc.structural.length,structuralFirst:acc.structural.slice(0,5),byField:acc.byField,
      fingerprintBefore:fingerprintOf(FS,a),fingerprintAfter:fingerprintOf(FS,b),fnvAfter:fnv(jb)});
  }
  return rows;
}`;
const cases=worldList(seeds,[1,96]).map(w=>[w.kind,w.seed,w.index]);
const SIM=['renderer','destruction','economy','brain','simulation'];
const sha=text=>createHash('sha256').update(text).digest('hex');
const sources={fmath:readFileSync(join(root,'src/fmath.js'),'utf8'),worldBefore:readFileSync(join(base,'src/world.js'),'utf8'),worldAfter:readFileSync(join(root,'src/world.js'),'utf8')};
for(const m of SIM){sources[m]=readFileSync(join(root,'src',m+'.js'),'utf8');if(sha(sources[m])!==sha(readFileSync(join(base,'src',m+'.js'),'utf8')))throw new Error('src/'+m+'.js differs between the base and the root: only world.js may change');}

// Node: before = the base world.js with the Math of this process; after = the root.
const compare=new Function(CORE+'\nreturn compareWorlds;')();
const before=loadRealm({root:base,modules:['world']}).window.FWorld,after=loadRealm({root,modules:['fmath','world']}).window.FWorld,FS=loadRealm({root}).window.FSimulation;
let t=performance.now();
const nodeRows=compare(before,after,FS,cases),nodeSeconds=(performance.now()-t)/1000;
const nodeAfter=new Map(nodeRows.map(r=>[r.kind+':'+r.seed+':'+r.index,r]));

const T42=r=>r.kind==='legacy'||r.seed===96; // the 42 worlds of T1 and T2 (checkpoints, seed 96)
const label=r=>r.kind==='legacy'?`legacy:${r.seed}:s${r.index}`:`${r.kind}:${r.seed}:w${r.index+1}`;
const GROUPS={positions:f=>f==='meshes.p',sizes:f=>f==='meshes.s',rotations:f=>f==='meshes.r',bounds:f=>f.startsWith('destructibles.bounds.')};
function summarize(rows,{withNode}){
  const s=list=>{
    const changed=list.filter(r=>r.jsonChanged),byField={};
    for(const r of list)for(const [f,v] of Object.entries(r.byField)){const o=byField[f]??={count:0,maxAbs:0};o.count+=v.count;if(v.maxAbs>o.maxAbs)o.maxAbs=v.maxAbs;}
    const groups=Object.fromEntries(Object.entries(GROUPS).map(([g,test])=>{const fs=Object.entries(byField).filter(([f])=>test(f));return [g,fs.length?Math.max(...fs.map(([,v])=>v.maxAbs)):0];}));
    const other=Object.entries(byField).filter(([f])=>!Object.values(GROUPS).some(test=>test(f)));
    const refused=list.filter(r=>r.fingerprintBefore!==r.fingerprintAfter),kinds=k=>{const l=list.filter(r=>r.kind===k);return l.filter(r=>r.fingerprintBefore!==r.fingerprintAfter).length+'/'+l.length;};
    const numeric=changed.map(r=>r.numeric);
    const out={worlds:list.length,worldJsonChanged:changed.length,numericDifferencesPerChangedWorld:numeric.length?{min:Math.min(...numeric),max:Math.max(...numeric)}:null,
      maxAbsDifference:list.length?Math.max(...list.map(r=>r.maxAbs)):0,maxAbsByGroup:groups,otherFields:Object.fromEntries(other),
      differingTopLevelFields:[...new Set(Object.keys(byField).map(f=>f.split('.')[0]))].sort(),structuralDifferences:list.reduce((n,r)=>n+r.structural,0),
      checkpointRefused:{legacy:kinds('legacy'),v1:kinds('v1'),v2:kinds('v2'),total:refused.length+'/'+list.length},refusedWorlds:refused.map(label)};
    if(withNode){const eq=key=>list.filter(r=>{const n=nodeAfter.get(r.kind+':'+r.seed+':'+r.index);return n&&r[key]===n[key];}).length+'/'+list.length;out.afterEqualsNode={fingerprint:eq('fingerprintAfter'),worldFnv:eq('fnvAfter')};}
    return out;
  };
  return {all:s(rows),t1t2Worlds42:s(rows.filter(T42))};
}
const compact=rows=>rows.map(r=>({world:label(r),jsonChanged:r.jsonChanged,numeric:r.numeric,maxAbs:r.maxAbs,maxPath:r.maxPath,structural:r.structural,...(r.structural?{structuralFirst:r.structuralFirst}:{}),fingerprintBefore:r.fingerprintBefore,fingerprintAfter:r.fingerprintAfter,fnvAfter:r.fnvAfter}));
const out={schema:'metal-lot01s-final-engines-v1',environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch},dir:'$W',
  sources:{base:{worldSha256:sha(sources.worldBefore)},root:{worldSha256:sha(sources.worldAfter),fmathSha256:sha(sources.fmath)},simulationModulesIdentical:SIM},
  cases:cases.length,seeds,note:'before: the world.js of the base (Math of the engine); after: the world.js of the root (FMath). checkpointRefused: fingerprint before !== after, so restore refuses a checkpoint saved before the fix in this engine. maxAbsByGroup: meshes.p positions (m), meshes.s sizes (m), meshes.r rotations (rad), destructibles.bounds.* bounds (m). afterEqualsNode: the world after the fix in this engine against the same world in Node.',
  node:{seconds:Math.round(nodeSeconds*10)/10,...summarize(nodeRows,{withNode:false}),rows:compact(nodeRows)}};

const unescape=text=>text.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const found=path=>path!=='none'&&(path.includes('/')?existsSync(path):true);
const run='var cases='+JSON.stringify(cases)+',out={rows:[],error:null},t0=Date.now();try{out.rows=compareWorlds(BEFORE,AFTER,FSIM,cases);}catch(e){out.error=String(e&&e.stack||e);}out.seconds=(Date.now()-t0)/1000;';

if(found(chrome)){
  const src=(r,name)=>pathToFileURL(join(r,'src',name+'.js')).href,tag=url=>`<script src="${url}"></script>`;
  const html='<!doctype html><meta charset=utf-8><title>ecarts</title><body><pre id=o>pending</pre>'+
    '<script>window.__errors=[];addEventListener("error",function(e){window.__errors.push(String(e.message||e));});</script>'+
    tag(src(root,'fmath'))+tag(src(base,'world'))+'<script>var BEFORE=window.FWorld;</script>'+tag(src(root,'world'))+'<script>var AFTER=window.FWorld;</script>'+
    SIM.map(m=>tag(src(root,m))).join('')+'<script>var FSIM=window.FSimulation;'+CORE+'\n'+run+'out.ua=navigator.userAgent;out.errors=window.__errors;document.getElementById("o").textContent=JSON.stringify(out);</script>';
  writeFileSync(join(dir,'ecarts.html'),html);
  const profile=join(dir,'chrome-profile-ecarts');mkdirSync(profile,{recursive:true});
  const dump=execFileSync(chrome,['--headless=new','--user-data-dir='+profile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--no-pings','--mute-audio','--dump-dom',pathToFileURL(join(dir,'ecarts.html')).href],{maxBuffer:1<<28,timeout:1800000,stdio:['ignore','pipe','ignore']}).toString();
  writeFileSync(join(dir,'ecarts.dump.html'),dump);
  const m=/<pre id="o">([\s\S]*?)<\/pre>/.exec(dump);
  if(!m||m[1]==='pending')throw new Error('Chrome: the page did not finish');
  const r=JSON.parse(unescape(m[1]));
  out.chrome={path:chrome,userAgent:r.ua,pageErrors:r.errors,error:r.error,seconds:r.seconds,...summarize(r.rows,{withNode:true}),rows:compact(r.rows)};
}else out.chrome={skipped:chrome==='none'?'--chrome none':'not found: '+chrome};

if(found(jsc)){
  const script='var window=globalThis;\n'+sources.fmath+'\n'+sources.worldBefore+'\nvar BEFORE=window.FWorld;\n'+sources.worldAfter+'\nvar AFTER=window.FWorld;\n'+
    SIM.map(m=>sources[m]).join('\n')+'\nvar FSIM=window.FSimulation;\n'+CORE+'\n'+run+'print(JSON.stringify(out));\n';
  writeFileSync(join(dir,'ecarts-jsc.js'),script);
  const text=execFileSync(jsc,[join(dir,'ecarts-jsc.js')],{maxBuffer:1<<26,timeout:1800000}).toString(),r=JSON.parse(text.trim().split('\n').pop());
  out.jsc={path:jsc,error:r.error,seconds:r.seconds,...summarize(r.rows,{withNode:true}),rows:compact(r.rows)};
}else out.jsc={skipped:jsc==='none'?'--jsc none':'not found: '+jsc};

const text=JSON.stringify(out,null,1)+'\n';
if(reportFile){mkdirSync(dirname(resolve(reportFile)),{recursive:true});writeFileSync(reportFile,text);}
const brief=e=>e.skipped?{skipped:e.skipped}:{error:e.error??null,all:{changed:e.all.worldJsonChanged,maxAbs:e.all.maxAbsByGroup,structural:e.all.structuralDifferences,refused:e.all.checkpointRefused,afterEqualsNode:e.all.afterEqualsNode},w42:e.t1t2Worlds42.checkpointRefused};
console.log(JSON.stringify({node:brief(out.node),chrome:brief(out.chrome),jsc:brief(out.jsc)},null,1));
