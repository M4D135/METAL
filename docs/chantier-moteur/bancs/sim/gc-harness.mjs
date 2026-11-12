// Runs a script under --trace-gc-nvp --expose-gc and sums V8's own "allocated=" counters (bytes allocated
// since the previous GC) between "##BEGIN name" / "##TAIL" / "##END" markers printed by the script.
// Scavenge pauses are counted between BEGIN and TAIL only (the forced gc() after TAIL just flushes the counter).
// usage: node gc-harness.mjs <script.mjs> [args...]   (extra node flags: GCFLAGS="--max-semi-space-size=8")
import {spawn} from 'node:child_process';
const flags=(process.env.GCFLAGS||'').split(' ').filter(Boolean);
const child=spawn(process.execPath,['--expose-gc','--trace-gc-nvp',...flags,...process.argv.slice(2)],{cwd:new URL('.',import.meta.url).pathname});
let buf='',seg=null,tail=false;const rows=[];
const field=(l,k)=>{const m=l.match(new RegExp('\\b'+k+'=([0-9.]+)'));return m?+m[1]:0;};
child.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){const l=buf.slice(0,i);buf=buf.slice(i+1);
  if(l.startsWith('##BEGIN ')){const [,name,steps]=l.split(' ');seg={name,steps:+steps||0,alloc:0,sc:0,scMs:0,scMax:0,mc:0,mcMs:0};tail=false;continue;}
  if(l.startsWith('##TAIL')){tail=true;continue;}
  if(l.startsWith('##END')){if(seg){const p=l.split(' ');if(p[1])seg.steps=+p[1];rows.push(seg);}seg=null;continue;}
  if(l.startsWith('##')){console.log(l.slice(2));continue;}
  if(seg&&l.includes(' gc=')){seg.alloc+=field(l,'allocated');if(!tail){const pause=field(l,'pause');if(/ gc=s /.test(l)){seg.sc++;seg.scMs+=pause;seg.scMax=Math.max(seg.scMax,pause);}else{seg.mc++;seg.mcMs+=pause;}}continue;}
  if(!l.includes(' gc=')&&!/^\[\d+:/.test(l))console.log(l);
}});
child.stderr.on('data',d=>process.stderr.write(d));
child.on('close',code=>{for(const r of rows)console.log(r.name.padEnd(28)+' alloc '+(r.alloc/1048576).toFixed(1).padStart(7)+' MB'+(r.steps?'  = '+(r.alloc/r.steps/1024).toFixed(1).padStart(6)+' KB/step':'')+'  scavenges '+String(r.sc).padStart(4)+' ('+r.scMs.toFixed(1)+' ms, max '+r.scMax.toFixed(2)+')  mark-compact '+r.mc+' ('+r.mcMs.toFixed(1)+' ms)');if(code)console.log('exit '+code);});
