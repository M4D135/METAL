// Same loader, but runs the scripts in the MAIN realm (no node:vm). Global
// lookups (Math, Number, Infinity...) inside a vm context go through the
// contextify interceptor and are much slower than in a browser; this loader
// gives timings closer to a real JS engine page.
import {readFileSync} from 'node:fs';
export function loadMain(root,{patch=null,globals={}}={}){
  globalThis.window={};Object.assign(globalThis,globals);
  for(const n of ['renderer','world','destruction','economy','brain','simulation']){
    let src=readFileSync(root+'/src/'+n+'.js','utf8');
    if(n==='simulation'&&patch)src=patch(src);
    (0,eval)(src+'\n//# sourceURL='+n+'.js');
  }
  return globalThis;
}
