// Preload for running the repo's own checks against the PATCHED simulation without touching the repo:
// fs.readFileSync returns the in-memory patched source for .../src/simulation.js.
// usage: NODE_OPTIONS="--import=<abs path>/test-preload.mjs" SIMPATCH=full|all|nonav|nav node --test <repo>/checks/x.test.mjs
import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import {source} from './lib.mjs';
import {fullPatch} from './full-v2.mjs';import {allPatch} from './all-v2.mjs';import {identityV2} from './identity-v2.mjs';import {rayV2} from './ray-v2.mjs';
const which=process.env.SIMPATCH||'full';let src=source('simulation');
const sets={full:()=>fullPatch(),all:()=>allPatch(),nonav:()=>({simulation:[...allPatch('ground','blocked','segment','debris').simulation,...identityV2.simulation,...rayV2.simulation]}),nav:()=>allPatch('nav')};
for(const [from,to] of sets[which]().simulation){const at=src.indexOf(from);if(at<0||src.indexOf(from,at+1)>=0)throw new Error('patch anchor problem: '+from.slice(0,80));src=src.slice(0,at)+to+src.slice(at+from.length);}
const orig=fs.readFileSync;
fs.readFileSync=function(p,...a){if(typeof p==='string'&&p.endsWith('/src/simulation.js')){const enc=typeof a[0]==='string'?a[0]:a[0]?.encoding;return enc?src:Buffer.from(src);}return orig.call(this,p,...a);};
syncBuiltinESMExports();
