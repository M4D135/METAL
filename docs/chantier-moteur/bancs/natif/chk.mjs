import {readFileSync} from 'node:fs';
import {build,names} from './npatches.mjs';
const base=readFileSync(new URL('./ferro-renderer-248043a.js',import.meta.url),'utf8');
for(const n of [...names,'lossless','lossless2','all','skyinval','f2bsky','meas','odf2b','shskip+nofx+postcopy','lskip+spec4']){
  try{const c=build(base,n);new Function(c);console.log('ok',n,c.length-base.length);}catch(e){console.log('FAIL',n,e.message);}
}
