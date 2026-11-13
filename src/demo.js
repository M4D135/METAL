/* FERRO — mode démo : outils déterministes, enregistrement et rejeu d'entrées, réalisateur, enchaînement de scènes. Sans DOM, sans horloge, sans aléa global. */
(function(G){
  'use strict';
  const TAU=Math.PI*2,FNV=2166136261,PRIME=16777619;
  const fail=(code,message,extra)=>{throw Object.assign(new Error('FDemo : '+message),{code},extra);};
  function utf8(text){
    const s=unescape(encodeURIComponent(text)),bytes=new Uint8Array(s.length);
    for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);
    return bytes;
  }
  function fromUtf8(bytes){
    let s='';
    for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
    try{return decodeURIComponent(escape(s));}catch{return fail('FDEMO_FORMAT','texte encodé hors UTF-8');}
  }
  // Les états 32 bits vivent dans des tableaux typés : gardés dans une fermeture, ils seraient
  // mis en boîte à chaque écriture, donc une allocation par tirage ou par octet haché.
  function rng(seed){
    const state=new Int32Array(1);state[0]=seed;
    function u32(){
      let a=state[0];
      a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;
      state[0]=a;return (t^(t>>>14))>>>0;
    }
    const next=()=>u32()/4294967296,weight=w=>Number.isFinite(w)&&w>0?w:0;
    // Toujours exactement un tirage, même quand aucun poids n'est positif.
    function pick(weights,n=weights.length){
      let sum=0,cum=0,last=-1;
      for(let i=0;i<n;i++)sum+=weight(weights[i]);
      const r=next()*sum;
      if(!(sum>0))return -1;
      for(let i=0;i<n;i++){const w=weight(weights[i]);if(w>0){cum+=w;last=i;if(r<cum)return i;}}
      return last;
    }
    return {u32,next,pick,int:n=>n>=1?Math.floor(next()*n):0,range:(lo,hi)=>lo+(hi-lo)*next(),
      get state(){return state[0]>>>0;},set state(v){state[0]=v;}};
  }
  // FNV-1a 32 bits ; byte, word et number donnent les mêmes octets que tools/proof/digest.mjs.
  function hasher(seed=FNV){
    const state=new Uint32Array(1),view=new DataView(new ArrayBuffer(8));
    const byte=v=>{state[0]=Math.imul(state[0]^(v&255),PRIME);return api;};
    const word=v=>{let h=state[0];for(let k=0;k<32;k+=8)h=Math.imul(h^(v>>>k&255),PRIME);state[0]=h;return api;};
    function number(v){view.setFloat64(0,v,true);let h=state[0];for(let i=0;i<8;i++)h=Math.imul(h^view.getUint8(i),PRIME);state[0]=h;return api;}
    function text(s){
      word(s.length);let h=state[0];
      for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h=Math.imul(Math.imul(h^(c&255),PRIME)^(c>>>8),PRIME);}
      state[0]=h;return api;
    }
    const api={byte,word,number,bool:v=>byte(v?1:0),text,result:()=>state[0],reset(s=FNV){state[0]=s;return api;}};
    state[0]=seed;
    return api;
  }
  const seedFor=(seed,a,b)=>hasher().word(seed).word(a).word(b).result();
  function smootherstep(t){
    if(!Number.isFinite(t))return 0;
    t=t<0?0:t>1?1:t;
    return t*t*t*(t*(t*6-15)+10);
  }
  function wrapAngle(a){
    if(!Number.isFinite(a))return 0;
    a%=TAU;
    return a<=-Math.PI?a+TAU:a>Math.PI?a-TAU:a;
  }
  // Repère : y vers le haut, yaw 0 regarde vers -z ; forward = [sin(yaw)·cos(pitch), sin(pitch), -cos(yaw)·cos(pitch)].
  function lookAt(from,to,out){
    const dx=to[0]-from[0],dy=to[1]-from[1],dz=to[2]-from[2],h=Math.hypot(dx,dz);
    if(h!==0||dy!==0){out.yaw=Math.atan2(dx,-dz);out.pitch=Math.atan2(dy,h);}
    return out;
  }
  G.FDemo={FORMAT:1,MAGIC:'FDM1',rng,hasher,seedFor,smootherstep,wrapAngle,lookAt};
})(typeof window!=='undefined'?window:globalThis);
