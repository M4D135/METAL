// Summarise a .cpuprofile: self/inclusive time per function, optionally restricted to the subtree of a root function.
// usage: node profsum.mjs file.cpuprofile [topN] [rootName[,rootName2]] [filter]
import {readFileSync} from 'node:fs';
const [file,topN='30',roots='',filter='']=process.argv.slice(2);const p=JSON.parse(readFileSync(file,'utf8'));
const dt=p.timeDeltas,byId=new Map(p.nodes.map(n=>[n.id,n]));const self=new Map();let all=0;
for(let i=0;i<p.samples.length;i++){const d=dt[i]||0;all+=d;self.set(p.samples[i],(self.get(p.samples[i])||0)+d);}
const parent=new Map();for(const n of p.nodes)for(const c of n.children||[])parent.set(c,n.id);
const name=id=>{const c=byId.get(id).callFrame;return (c.url.split('/').pop()||'(native)')+':'+(c.lineNumber+1)+' '+(c.functionName||'(anon)');};
const rootSet=roots?roots.split(','):null;const agg=new Map(),incl=new Map();let total=0;
for(const [id,t] of self){
  const chain=[];for(let x=id;x!==undefined;x=parent.get(x))chain.push(x);
  let cut=chain.length;if(rootSet){cut=-1;for(let k=chain.length-1;k>=0;k--)if(rootSet.includes(byId.get(chain[k]).callFrame.functionName)){cut=k+1;break;}if(cut<0)continue;}
  total+=t;const key=name(id);agg.set(key,(agg.get(key)||0)+t);
  const seen=new Set();for(let k=0;k<cut;k++){const key2=name(chain[k]);if(!seen.has(key2)){seen.add(key2);incl.set(key2,(incl.get(key2)||0)+t);}}
}
const rows=[...agg].sort((a,b)=>b[1]-a[1]).filter(r=>!filter||r[0].includes(filter));
console.log('profile ms',(all/1e3).toFixed(0),'| subtree ms',(total/1e3).toFixed(0),'('+(100*total/all).toFixed(1)+'%)');
console.log('  self%   self ms   incl%  function');
for(const [k,t] of rows.slice(0,+topN))console.log((100*t/total).toFixed(2).padStart(7)+(t/1e3).toFixed(1).padStart(10)+(100*(incl.get(k)||0)/total).toFixed(1).padStart(8)+'  '+k);
