// Contre-verification PARA-03 : le miroir depaquete est-il vraiment « identique » ? Comparaison STRICTE (type compris).
import {loadMain,build,drive} from '../para/load.mjs';
import {compilePack,compileUnpack,needed,dict,SCALARS,LISTS} from '../para/schema.mjs';
const win=loadMain();const pack=compilePack(),unpack=compileUnpack();
const get=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
for(const sc of (process.argv[2]||'campaign-w10,legacy-s0,campaign2-w6').split(',')){
  const {sim}=build(win,sc),s=sim.state,input={};const kinds={},ex={};let n=0,same=0;const mirror={};
  const note=(k,path,a,b)=>{kinds[k]=(kinds[k]||0)+1;(ex[k]??=new Set()).size<8&&ex[k].add(path+' '+JSON.stringify(a)+'→'+JSON.stringify(b));};
  for(let i=0;i<900;i++){drive(i,input);sim.step(1/60,input);s.player.hp=Math.max(s.player.hp,60);
    if(i%100===99||i===899){const f=new Float64Array(needed(s)+16);pack(s,f);unpack(f,mirror,dict);
      const cmp=(path,a,b,isStr)=>{n++;if(Object.is(a,b)){same++;return;}
        const ta=a===null?'null':typeof a;
        if(ta==='boolean')note('booleen→nombre',path,a,b);else if(ta==='undefined')note('undefined→NaN',path,a,b);else if(ta==='null')note('null→NaN',path,a,b);
        else if(ta==='string'&&!isStr)note('chaine non declaree→indice',path,a,b);else if(ta==='object')note('objet/tableau→NaN',path,a,b);
        else if(ta==='number')note(Object.is(a,-0)?'-0':'nombre different',path,a,b);else note('autre '+ta,path,a,b);};
      for(const p of SCALARS)cmp(p,get(s,p),get(mirror,p),false);
      for(const [root,fields] of Object.entries(LISTS)){const A=s[root]||[],B=mirror[root]||[];if(s[root]===undefined&&B.length===0){note('liste absente→[]',root,undefined,[]);}
        for(let k=0;k<A.length;k++)for(const fl of fields){const isStr=fl[0]==='$',p=fl.replace('$','');cmp(root+'[].'+p,get(A[k],p),get(B[k],p),isStr);}}
    }
    s.events.length=0;}
  console.log(JSON.stringify({scenario:sc,valeursComparees:n,strictementEgales:same,ecartsParNature:kinds,exemples:Object.fromEntries(Object.entries(ex).map(([k,v])=>[k,[...v].slice(0,6)]))},null,1));
}
