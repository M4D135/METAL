// Chargeur indépendant (contre-vérification LOOP) : exécute les modules du dépôt en mémoire,
// sans rien écrire dans le dépôt. Expose quelques internes utiles par injection en mémoire.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
export function load(root,{patch}={}){
  const ctx={window:{},performance,console,Math,Date,JSON};vm.createContext(ctx);
  for(const n of ['renderer','world','destruction','economy','brain','simulation']){
    let src=readFileSync(root+'/src/'+n+'.js','utf8');
    if(n==='simulation'){
      // debrisHalf est au niveau module : on l'expose pour recalculer les prédicats de restore.
      src=src.replace('G.FSimulation={create,','G.__debrisHalf=debrisHalf;G.FSimulation={create,');
      if(patch)src=patch(src);
    }
    vm.runInContext(src,ctx,{filename:n+'.js'});
  }
  return ctx.window;
}
