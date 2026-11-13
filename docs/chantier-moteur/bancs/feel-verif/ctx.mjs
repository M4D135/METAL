// usage: node ctx.mjs file pattern [before=150] [after=300] [max=10]
import {readFileSync} from 'node:fs';
const [file,pat,b='150',a='300',m='10']=process.argv.slice(2);
const src=readFileSync(file,'utf8');const lines=src.split('\n');const starts=[];let o=0;for(const l of lines){starts.push(o);o+=l.length+1;}
const lineOf=i=>{let lo=0,hi=starts.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(starts[mid]<=i)lo=mid;else hi=mid-1;}return lo+1;};
let idx=0,n=0;while(n<+m){const i=src.indexOf(pat,idx);if(i<0)break;console.log(`--- L${lineOf(i)} @${i}\n`+src.slice(Math.max(0,i-+b),i+pat.length+ +a).replace(/\n/g,'⏎'));idx=i+pat.length;n++;}
if(!n)console.log('no match');
