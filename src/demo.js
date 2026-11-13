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
  // Schéma d'enregistrement : les champs dans l'ordre des octets, entiers en petit-boutiste.
  const usable=key=>typeof key==='string'&&key!==''&&key!=='__proto__';
  const quantize=(v,scale,max)=>{
    if(!Number.isFinite(v))return 0;
    const q=Math.round(v*scale);
    return q<-max?-max:q>max?max:q;
  };
  function schema(fields){
    if(!Array.isArray(fields)||!fields.length)fail('FDEMO_ARG','schéma : tableau de champs non vide attendu');
    const ops=[],copy=[],names=[],seen=new Map();let size=0;
    const claim=(key,index)=>{
      if(seen.has(key))fail('FDEMO_ARG','schéma : propriété '+key+' en double',{field:key,index});
      seen.set(key,index);names.push(key);
    };
    for(let i=0;i<fields.length;i++){
      const f=fields[i];
      if(!f||typeof f!=='object'||Array.isArray(f))fail('FDEMO_ARG','schéma : champ '+i+' : objet attendu',{index:i});
      const {name,type,scale,names:list}=f;
      if(!usable(name))fail('FDEMO_ARG','schéma : champ '+i+' : name attendu, chaîne non vide',{index:i});
      const bad=why=>fail('FDEMO_ARG','schéma : '+name+' : '+why,{field:name,index:i});
      const kind=type==='i8'?1:type==='i16'?2:type==='u8'?3:type==='u16'?4:type==='bits'?5:0,max=kind===1?127:kind===2?32767:0;
      if(!kind)bad('type inconnu');
      // Une échelle dont max/scale déborde décoderait l'infini : la quantification ne serait plus idempotente.
      if(max&&!(Number.isFinite(scale)&&scale>0&&Number.isFinite(max/scale)))bad('scale attendu, nombre fini > 0');
      if(!max&&scale!==undefined)bad('scale interdit pour '+type);
      if(kind!==5&&list!==undefined)bad('names réservé au type bits');
      const op={kind,name,at:size,scale:max?scale:0,bias:max+1,names:null,count:0,pages:max?new Array(max+1>>7).fill(null):null};
      if(kind===5){
        if(!Array.isArray(list)||list.length<1||list.length>32)bad('names attendu, de 1 à 32 chaînes');
        op.names=[];
        for(let k=0;k<list.length;k++){
          const key=list[k];
          if(!usable(key))bad('nom de bit '+k+' vide ou invalide');
          claim(key,i);op.names.push(key);
        }
        op.count=list.length;size+=list.length+7>>3;
        copy.push({name,type,names:op.names.slice()});
      }else{
        claim(name,i);size+=kind===2||kind===4?2:1;
        copy.push(max?{name,type,scale}:{name,type});
      }
      ops.push(op);
    }
    function encode(input,view,offset){
      for(let i=0;i<ops.length;i++){
        const o=ops[i],at=offset+o.at;
        if(o.kind===1)view.setInt8(at,quantize(input[o.name],o.scale,127));
        else if(o.kind===2)view.setInt16(at,quantize(input[o.name],o.scale,32767),true);
        else if(o.kind===3){const v=input[o.name];view.setUint8(at,Number.isInteger(v)&&v>=0&&v<=254?v:255);}
        else if(o.kind===4){const v=input[o.name];view.setUint16(at,Number.isInteger(v)&&v>=0&&v<=65534?v:65535,true);}
        else for(let b=0,k=0;k<o.count;b++){
          let bits=0;
          for(let j=0;j<8&&k<o.count;j++,k++)if(input[o.names[k]])bits|=1<<j;
          view.setUint8(at+b,bits);
        }
      }
    }
    // Sur V8, écrire sous un nom variable un nombre non entier crée une boîte : decode écrit des valeurs déjà
    // en boîte, gardées par niveau dans des pages de 256 créées au premier usage, et n'alloue plus ensuite.
    function decode(view,offset,out){
      for(let i=0;i<ops.length;i++){
        const o=ops[i],at=offset+o.at;
        if(o.kind<3){
          const q=o.kind===1?view.getInt8(at):view.getInt16(at,true),u=q+o.bias;
          const page=o.pages[u>>8]||(o.pages[u>>8]=new Array(256).fill(null));
          let v=page[u&255];
          if(v===null)v=page[u&255]=q/o.scale;
          out[o.name]=v;
        }else if(o.kind===3){const v=view.getUint8(at);out[o.name]=v===255?undefined:v;}
        else if(o.kind===4){const v=view.getUint16(at,true);out[o.name]=v===65535?undefined:v;}
        else for(let k=0;k<o.count;k++)out[o.names[k]]=(view.getUint8(at+(k>>3))>>(k&7)&1)===1;
      }
      return out;
    }
    return {fields:copy,size,names,encode,decode};
  }
  G.FDemo={FORMAT:1,MAGIC:'FDM1',rng,hasher,seedFor,smootherstep,wrapAngle,lookAt,schema};
})(typeof window!=='undefined'?window:globalThis);
