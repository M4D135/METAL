import {readFileSync} from 'node:fs';const t=readFileSync(0,'utf8');const at=t.indexOf('### STEADY');const lines=t.slice(at).split('\n');const agg=new Map();let n=0;
for(const l of lines){if(!l.includes('bailout'))continue;const f=/<JSFunction ([^ >]*)/.exec(l),r=/reason: ([^)]*)\)/.exec(l),k=/kind: ([^,)]*)/.exec(l);const key=(f?f[1]||'(anon)':'?')+' | '+(r?r[1]:'?')+' | '+(k?k[1]:'?');agg.set(key,(agg.get(key)||0)+1);n++;}
console.log('steady-state bailouts',n);for(const [k,v] of [...agg].sort((a,b)=>b[1]-a[1]).slice(0,16))console.log(String(v).padStart(4),k);
