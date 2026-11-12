// Per-line self ticks (positionTicks) for a .cpuprofile, mapped to source text. usage: node proflines.mjs file.cpuprofile <urlSuffix> <sourceFile> [top] [root]
import {readFileSync} from 'node:fs';
const [file,suffix,srcFile,top='40',root='']=process.argv.slice(2);const p=JSON.parse(readFileSync(file,'utf8')),src=readFileSync(srcFile,'utf8').split('\n');
const byId=new Map(p.nodes.map(n=>[n.id,n])),parent=new Map();for(const n of p.nodes)for(const c of n.children||[])parent.set(c,n.id);
const under=id=>{if(!root)return true;for(let x=id;x!==undefined;x=parent.get(x))if(byId.get(x).callFrame.functionName===root)return true;return false;};
const lines=new Map();let total=0,ticksAll=0;const interval=(p.endTime-p.startTime)/p.samples.length;
for(const n of p.nodes){if(!under(n.id))continue;for(const t of n.positionTicks||[]){ticksAll+=t.ticks;if(!n.callFrame.url.endsWith(suffix))continue;const k=t.line;const e=lines.get(k)||{ticks:0,fn:new Set()};e.ticks+=t.ticks;e.fn.add(n.callFrame.functionName||'(anon)');lines.set(k,e);total+=t.ticks;}}
console.log('ticks in',suffix,total,'of',ticksAll,'under',root||'(all)','| ~us/tick',interval.toFixed(0));
for(const [line,e] of [...lines].sort((a,b)=>b[1].ticks-a[1].ticks).slice(0,+top))console.log((100*e.ticks/ticksAll).toFixed(2).padStart(6)+'% L'+String(line).padEnd(5)+[...e.fn].join('/').padEnd(18).slice(0,18)+' '+(src[line-1]||'').trim().slice(0,150));
