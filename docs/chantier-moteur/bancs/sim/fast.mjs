// Loader that runs the modules in the MAIN realm (like a browser page), not in a contextified
// vm sandbox: in a node:vm context every global lookup (Math, Number, Infinity...) goes through
// an interceptor, which inflates helpers such as ground() several times.
import vm from 'node:vm';import {source,MODULES} from './lib.mjs';
export function loadFast({patches={}}={}){
  const win={};globalThis.window=win;
  for(const n of MODULES){
    let src=source(n);
    for(const [from,to] of (patches[n]||[])){
      if(typeof from==='string'){const at=src.indexOf(from);if(at<0)throw new Error('patch not found in '+n+': '+from.slice(0,90));if(src.indexOf(from,at+1)>=0)throw new Error('patch not unique in '+n+': '+from.slice(0,90));src=src.slice(0,at)+to+src.slice(at+from.length);}
      else{if(!from.test(src))throw new Error('regex patch not found in '+n+': '+from);src=src.replace(from,to);}
    }
    vm.runInThisContext(src,{filename:n+'.js'});
  }
  delete globalThis.window;return {window:win};
}
