// Banc MURS — chargement dans le domaine principal de Node (pas de node:vm contextifié),
// correctifs appliqués EN MÉMOIRE seulement : le dépôt METAL 673d6b2 reste en lecture seule.
import {readFileSync} from 'node:fs';import vm from 'node:vm';
export const ROOT=(process.env.METAL_ROOT||process.cwd());
export const MODULES=['renderer','world','destruction','economy','brain','simulation'];
export const source=name=>readFileSync(ROOT+'/src/'+name+'.js','utf8');
export function applyPatches(name,src,list=[]){
  for(const [from,to] of list){
    if(typeof from==='string'){const at=src.indexOf(from);if(at<0)throw new Error('patch not found in '+name+': '+from.slice(0,110));if(src.indexOf(from,at+1)>=0)throw new Error('patch not unique in '+name+': '+from.slice(0,110));src=src.slice(0,at)+to+src.slice(at+from.length);}
    else{if(!from.test(src))throw new Error('regex patch not found in '+name+': '+from);src=src.replace(from,to);}
  }
  return src;
}
export function loadFast({patches={},modules=MODULES}={}){
  const win={};globalThis.window=win;
  for(const n of modules)vm.runInThisContext(applyPatches(n,source(n),patches[n]),{filename:n+'.js'});
  delete globalThis.window;return win;
}
// Les 39 mondes : campagne v2 (nouvelle partie 0.8), campagne v1 (anciennes sauvegardes), 3 secteurs historiques.
export function worldList(){
  const list=[];
  for(let i=0;i<18;i++)list.push({label:'v2-w'+String(i+1).padStart(2,'0'),index:i,opts:{campaign:true,campaignVersion:2}});
  for(let i=0;i<18;i++)list.push({label:'v1-w'+String(i+1).padStart(2,'0'),index:i,opts:{campaign:true}});
  for(let i=0;i<3;i++)list.push({label:'hist-s'+(i+1),index:i,opts:undefined});
  return list;
}
// Progression plausible de la campagne v2 au monde `index` (récompenses de boss précédentes encaissées).
export function loadoutV2(W,index,{ammoFraction=1}={}){
  const E=W.FEconomy;let profile=E.fresh({campaignVersion:2});const weapons=[false,false,false,false,true];
  for(let i=0;i<index;i++){profile=E.grantBossReward(profile,i);const r=E.bossReward(i);if(r.weapon!==null)weapons[r.weapon]=true;}
  const caps=E.ammoCaps(profile,{campaign:true}),ammo=caps.map((c,i)=>weapons[i]?(i===4?1:Math.floor(c*ammoFraction)):0);
  return {inventory:{weapons,ammo,shield:true},economy:profile,campaign:{version:2,discovered:['pistol','shield',...(weapons[0]?['smg']:[]),...(weapons[1]?['shotgun']:[]),...(weapons[3]?['grenade']:[]),...(weapons[2]?['rocket']:[])],claimedBossRewards:Array.from({length:index},(_,i)=>i)}};
}
export const q=(arr,p)=>{const a=arr.slice().sort((x,y)=>x-y);return a.length?a[Math.min(a.length-1,Math.floor(a.length*p))]:NaN;};
export const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
export const fnv=t=>{let h=2166136261;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);return (h>>>0).toString(16);};
// Charge les modules d'une autre racine (copie de travail) dans le domaine principal.
export function loadRoot(root,modules=MODULES){
  const win={};globalThis.window=win;
  for(const n of modules)vm.runInThisContext(readFileSync(root+'/src/'+n+'.js','utf8'),{filename:root.split('/').pop()+'/'+n+'.js'});
  delete globalThis.window;return win;
}
