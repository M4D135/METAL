// Résume le dernier profil CPU du répertoire donné (tri par temps propre).
// Usage : node resumer-profil.mjs <dossier-de-profils>
import {readFileSync,readdirSync,statSync} from 'node:fs';

const dir=process.argv[2];
if(!dir)throw new Error('un dossier de profils est requis');
const name=readdirSync(dir).filter(q=>q.endsWith('.cpuprofile')).map(q=>[q,statSync(dir+'/'+q).mtimeMs]).sort((a,b)=>b[1]-a[1])[0][0];
const profile=JSON.parse(readFileSync(dir+'/'+name,'utf8'));
const byId=new Map(profile.nodes.map(n=>[n.id,n])),self=new Map();
for(let i=0;i<profile.samples.length;i++){const id=profile.samples[i];self.set(id,(self.get(id)||0)+(profile.timeDeltas[i]||0));}
const agg=new Map();
for(const [id,us] of self){const frame=byId.get(id)?.callFrame;if(!frame)continue;const key=(frame.functionName||'(anon)')+':'+(frame.lineNumber+1);agg.set(key,(agg.get(key)||0)+us);}
const total=[...agg.values()].reduce((a,b)=>a+b,0);
console.log('profil',name,'— temps CPU total',(total/1e6).toFixed(1),'s');
for(const [key,us] of [...agg.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12))console.log((us/1000).toFixed(0).padStart(6),'ms',(100*us/total).toFixed(1).padStart(5)+' %',key);
