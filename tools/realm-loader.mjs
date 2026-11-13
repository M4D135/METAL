// SIM-11 / IA-06: main-realm execution with one lexical envelope per variant.
// This loader is for trusted local source code, not a security sandbox.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {instrumentSimulation} from './proof/instrument.mjs';
// Node 24.18 materializes some host globals lazily: the first read of the
// FormData descriptor loads undici, which adds Symbol(undici.globalDispatcher.1)
// and .2 to globalThis. Read every descriptor once, before any tool captures them.
Object.getOwnPropertyDescriptors(globalThis);

export const DEFAULT_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_MODULES = Object.freeze(['renderer','world','destruction','economy','brain','simulation']);
const hash = text => createHash('sha256').update(text).digest('hex');

export function applyPatches(name, source, patches = {}) {
  let text = source;
  for (const [from,to] of patches[name] || []) {
    if (typeof from === 'string') {
      const at = text.indexOf(from);
      if (!from || at < 0 || text.indexOf(from, at + from.length) >= 0) throw new Error(`Patch anchor missing or ambiguous in ${name}: ${from.slice(0,100)}`);
      text = text.slice(0,at) + to + text.slice(at+from.length);
    } else if (from instanceof RegExp) {
      const probe = new RegExp(from.source,from.flags); probe.lastIndex=0;
      if (!probe.test(text)) throw new Error(`Patch regexp did not match ${name}: ${from}`);
      text = text.replace(new RegExp(from.source,from.flags),to);
    } else throw new TypeError(`Unsupported patch anchor in ${name}`);
  }
  return text;
}

export function loadRealm({root=DEFAULT_ROOT, modules=DEFAULT_MODULES, patches={}, transform, instrument=false, realm='main', globals={}} = {}) {
  root = resolve(root);
  if (!['main','vm'].includes(realm)) throw new Error('realm must be main or vm');
  if (!Array.isArray(modules) || !modules.length || new Set(modules).size !== modules.length || !modules.every(name=>/^[a-z][a-z0-9-]*$/i.test(name))) throw new Error('Invalid module list');
  const bindings=Object.keys(globals);
  if (!bindings.every(name=>/^[A-Za-z_$][\w$]*$/.test(name)&&!['window','self','globalThis','arguments','eval'].includes(name))) throw new Error('Invalid or reserved supplied global name');
  const sources={},sourceSha256={},loadedSha256={},exports=new Set(),ranges={};
  for (const name of modules) {
    const original=readFileSync(join(root,'src',name+'.js'),'utf8'); sourceSha256[name]=hash(original);
    let text=applyPatches(name,original,patches);
    if (transform) { text=transform(name,text); if(typeof text!=='string')throw new TypeError('Source transform must return text'); }
    if (instrument && name==='simulation') text=instrumentSimulation(text);
    sources[name]=text;loadedSha256[name]=hash(text);
    for(const found of text.matchAll(/(?:window|globalThis|self|G)\.(F[A-Za-z0-9_$]+)\s*=/g))exports.add(found[1]);
  }
  const names=[...exports].filter(name=>!bindings.includes(name));
  let body=`(function(window,globalThis,self${bindings.map(name=>','+name).join('')}) {\n${names.length?'var '+names.join(',')+';\n':''}`;
  for(const name of modules){
    ranges[name]={startLine:body.split('\n').length+2,source:join(root,'src',name+'.js')};
    body+=`\n// Source module: ${name}\n${sources[name]}\n${names.map(key=>`${key}=window.${key};`).join('')}\n`;
  }
  body+='return window;\n})';
  const window=Object.assign(Object.create(null),globals);
  window.window=window;window.self=window;window.globalThis=window;
  const filename=join(root,`tools/.proof-${realm}-variant.js`);
  // In diagnostic vm mode the lexical globals remain contextified. Main mode
  // keeps ordinary V8 intrinsics; neither path assigns to the host globalThis.
  const factory=realm==='main'?vm.runInThisContext(body,{filename}):vm.runInContext(body,vm.createContext({}),{filename});
  factory(window,window,window,...bindings.map(name=>globals[name]));
  return {window,root,realm,instrument,modules:[...modules],sourceSha256,loadedSha256,sourceRanges:ranges};
}

export function assertHostGlobalsUnchanged(before) {
  const after=Object.getOwnPropertyDescriptors(globalThis);
  assert.deepEqual(Reflect.ownKeys(after),Reflect.ownKeys(before),'host global keys changed');
  for(const key of Reflect.ownKeys(before))assert.deepEqual(after[key],before[key],`host global descriptor changed: ${String(key)}`);
}

export function selfCheck(root=DEFAULT_ROOT) {
  const before=Object.getOwnPropertyDescriptors(globalThis),options={root,modules:['economy']};
  const a=loadRealm(options),b=loadRealm(options),sandbox=loadRealm({...options,realm:'vm'});
  assert.notEqual(a.window,b.window);assert.notEqual(a.window.FEconomy,b.window.FEconomy);
  a.window.FEconomy.proofMarker='A';assert.equal(b.window.FEconomy.proofMarker,undefined);
  assert(a.window.FEconomy.fresh({campaignVersion:2}).weaponUpgrades instanceof Array,'main realm arrays must use native intrinsics');
  assert(!(sandbox.window.FEconomy.fresh({campaignVersion:2}).weaponUpgrades instanceof Array),'diagnostic vm must really use a separate realm');
  assert.throws(()=>loadRealm({...options,transform:(_name,text)=>text+'\nthrow new Error("proof sentinel");'}),/proof sentinel/);
  assertHostGlobalsUnchanged(before);
  return {schema:'metal-realm-loader-check-v1',root:a.root,isolatedVariants:true,nativeIntrinsics:true,diagnosticVmDistinct:true,globalsPreservedAfterSuccessAndFailure:true,sourceSha256:a.sourceSha256};
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.includes('--help'))console.log('Usage: node tools/realm-loader.mjs [repository-root]\nRuns the isolation/native-intrinsic/global-preservation self-check.');
  else console.log(JSON.stringify(selfCheck(process.argv[2]||DEFAULT_ROOT),null,2));
}
