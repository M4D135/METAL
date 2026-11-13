/* FERRO — mode démo : outils déterministes, enregistrement et rejeu d'entrées, réalisateur, enchaînement de scènes. Sans DOM, sans horloge, sans aléa global. */
(function(G){
  'use strict';
  const TAU=Math.PI*2,FNV=2166136261,PRIME=16777619,FORMAT=1,MAGIC='FDM1';
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
  // FDM1, petit-boutiste : « FDM1 », u32 L, en-tête JSON de L octets, puis par scène : enregistrements (u16 de dt
  // en tête si dtTicks > 0), empreintes (u32 n, u32 valeur), commandes (JSON de [n, type, data]).
  const NONE=Object.freeze([]);
  const text=(v,what)=>{try{return JSON.stringify(v);}catch{return fail('FDEMO_ARG',what+' : valeur hors JSON');}},json=(v,what)=>text(v,what)??'null';
  // dt en ticks : nombres déjà en boîte, comme dans decode.
  function ticker(perSecond){
    const pages=new Array(256).fill(null);
    return t=>{const page=pages[t>>8]||(pages[t>>8]=new Array(256).fill(null));return page[t&255]??(page[t&255]=t/perSecond);};
  }
  // L'enregistreur complète l'en-tête (FDEMO_ARG), le lecteur l'exige complet (FDEMO_FORMAT).
  function settings(h,code,fill){
    if(!h||typeof h!=='object'||Array.isArray(h))fail(code,'en-tête : objet attendu');
    const s={gameVersion:'',engine:'',hz:60,dtTicks:0,checksumEvery:600},str=v=>typeof v==='string';
    for(const k of ['game','gameVersion','simHash','engine','hz','dtTicks','checksumEvery'])if(!fill||h[k]!==undefined)s[k]=h[k];
    const {game,simHash,hz,dtTicks:t,checksumEvery:c}=s,ok={game:str(game)&&game!=='',gameVersion:str(s.gameVersion),simHash:str(simHash)&&simHash!=='',
      engine:str(s.engine),hz:Number.isFinite(hz)&&hz>0&&1/hz<Infinity,dtTicks:Number.isInteger(t)&&t>=0&&t<=1e6,checksumEvery:Number.isSafeInteger(c)&&c>0};
    for(const k in ok)if(!ok[k])fail(code,'en-tête : '+k+' invalide',{field:k});
    try{s.sc=schema(h.fields);}catch(e){if(e&&e.code==='FDEMO_ARG')e.code=code;throw e;}
    return s;
  }
  function recorder(header,options={}){
    const {game,gameVersion,simHash,engine,hz,dtTicks,checksumEvery,sc}=settings(header,'FDEMO_ARG',true);
    const copy=(v,what)=>JSON.parse(json(v,what)),simVersion=copy(header.simVersion,'simVersion'),meta=copy(header.meta,'meta');
    const {maxBytes=4194304,initialSteps=3600}=options||fail('FDEMO_ARG','options : objet attendu');
    if(!(Number.isInteger(maxBytes)&&maxBytes>=0&&maxBytes<=2**30))fail('FDEMO_ARG','options : maxBytes invalide',{field:'maxBytes'});
    if(!(Number.isSafeInteger(initialSteps)&&initialSteps>=0))fail('FDEMO_ARG','options : initialSteps invalide',{field:'initialSteps'});
    const skip=dtTicks?2:0,R=sc.size+skip,tick=skip&&ticker(dtTicks),spare=new DataView(new ArrayBuffer(R)),out=sc.decode(spare,skip,{}),scenes=[];
    const grow=(bytes,n)=>{const next=new Uint8Array(Math.min(maxBytes,2*bytes.length+n));next.set(bytes);return next;};
    let records=new Uint8Array(Math.min(maxBytes,initialSteps*R)),view=new DataView(records.buffer),sums=new Uint8Array(512),sumView=new DataView(sums.buffer);
    let used=0,count=0,size=0,steps=0,taken=-1,dt=tick?0:1/hz,full=false,open=false,closed=false,now=null;
    const live=()=>{if(closed)fail('FDEMO_STATE','enregistreur fermé');},opened=what=>{live();if(!open)fail('FDEMO_STATE',what+' sans scène');};
    // Ce qui dépasserait maxBytes n'est pas stocké, ni rien après.
    function room(n){if(!full&&size+n>maxBytes)full=now.truncated=true;return !full;}
    function step(input,seconds){
      opened('pas');
      if(!input||typeof input!=='object')fail('FDEMO_ARG','pas : entrée attendue');
      const store=room(R);
      if(store&&used+R>records.length){records=grow(records,R);view=new DataView(records.buffer);}
      const v=store?view:spare,at=store?used:0,t=tick&&(Number.isFinite(seconds)?Math.min(65535,Math.max(0,Math.round(seconds*dtTicks))):0);
      if(tick)v.setUint16(at,t,true);
      sc.encode(input,v,at+skip);sc.decode(v,at+skip,out);
      if(tick)dt=tick(t);
      if(store){used+=R;size+=R;now.steps++;}
      steps++;
      return out;
    }
    function build(){
      const head=utf8(JSON.stringify({format:FORMAT,game,gameVersion,simHash,simVersion,engine,hz,dtTicks,checksumEvery,fields:sc.fields,meta,
        scenes:scenes.map(s=>({info:s.info,steps:s.steps,checksums:s.checksums,commandBytes:s.commandBytes,truncated:s.truncated}))}));
      const all=new Uint8Array(8+head.length+size);
      let p=8+head.length;
      for(let i=0;i<4;i++)all[i]=MAGIC.charCodeAt(i);
      new DataView(all.buffer).setUint32(4,head.length,true);all.set(head,8);
      for(const s of scenes){
        all.set(records.subarray(s.at,s.at+s.steps*R),p);p+=s.steps*R;
        all.set(sums.subarray(s.sums,s.sums+8*s.checksums),p);p+=8*s.checksums;
        if(s.commandBytes)all.set(utf8('['+s.commands.join(',')+']'),p);
        p+=s.commandBytes;
      }
      return all;
    }
    return {
      scene(info){
        live();
        const copied=copy(info,'info');
        open=true;steps=0;taken=-1;if(tick)dt=0;
        if(!full)scenes.push(now={info:copied,steps:0,checksums:0,commandBytes:0,truncated:false,at:used,sums:8*count,commands:[]});
      },
      step,
      checksumDue(){live();return !full&&open&&steps%checksumEvery===0&&taken!==steps;},
      checksum(value){
        opened('empreinte');
        if(taken===steps)fail('FDEMO_STATE','deux empreintes au pas '+steps);
        taken=steps;
        if(!room(8))return;
        if(8*count+8>sums.length){sums=grow(sums,8);sumView=new DataView(sums.buffer);}
        sumView.setUint32(8*count,steps,true);sumView.setUint32(8*count+4,value>>>0,true);
        count++;size+=8;now.checksums++;
      },
      command(type,data=null){
        opened('commande');
        if(typeof type!=='string'||!type)fail('FDEMO_ARG','commande : type invalide');
        const line=json([steps,type,data],'commande '+type),cost=utf8(line).length+(now.commands.length?1:2);
        if(room(cost)){now.commands.push(line);now.commandBytes+=cost;size+=cost;}
      },
      bytes(){live();return build();},
      end(){live();closed=true;return build();},
      get input(){return out;},get dt(){return dt;},get steps(){return steps;},get size(){return size;},get full(){return full;}};
  }
  function player(bytes,expect){
    const view=ArrayBuffer.isView(bytes)?new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
      :Object.prototype.toString.call(bytes)==='[object ArrayBuffer]'?new DataView(bytes):fail('FDEMO_ARG','lecteur : octets attendus');
    const u8=new Uint8Array(view.buffer,view.byteOffset,view.byteLength),n=u8.length,bad=why=>fail('FDEMO_FORMAT','lecture : '+why);
    const read=(at,length,what)=>{try{return JSON.parse(fromUtf8(u8.subarray(at,at+length)));}catch{return bad(what+' illisible');}};
    if(n<8||String.fromCharCode(u8[0],u8[1],u8[2],u8[3])!==MAGIC)bad('signature '+MAGIC+' absente');
    const L=view.getUint32(4,true),header=L>n-8?bad('en-tête tronqué'):read(8,L,'en-tête');
    if(!header||header.format!==FORMAT)bad('format '+FORMAT+' attendu');
    const {hz,dtTicks,sc}=settings(header,'FDEMO_FORMAT'),list=header.scenes,R=sc.size+(dtTicks?2:0),parts=[];
    if(header.simVersion===undefined||header.meta===undefined||!Array.isArray(list))bad('en-tête incomplet');
    function commandsOf(part,k){
      if(!part.commandBytes)return NONE;
      const all=read(part.commands,part.commandBytes,'commandes de la scène '+k);
      if(!Array.isArray(all)||!all.length)bad('commandes de la scène '+k+' vides');
      let last=0;
      for(const c of all){
        if(!Array.isArray(c)||c.length!==3||!Number.isSafeInteger(c[0])||c[0]<last||c[0]>part.steps||typeof c[1]!=='string'||!c[1])bad('commande invalide, scène '+k);
        last=c[0];
      }
      return all;
    }
    // Chaque longueur est comparée aux octets restants avant de lire : rien au-delà, pas de boucle démesurée.
    let p=8+L;
    for(let k=0;k<list.length;k++){
      const s=list[k]||{},{steps,checksums,commandBytes}=s,sums=p+steps*R,commands=sums+checksums*8;
      if(s.info===undefined||typeof s.truncated!=='boolean'||![steps,checksums,commandBytes].every(v=>Number.isSafeInteger(v)&&v>=0))bad('scène '+k+' invalide');
      if(steps*R>n-p||checksums*8>n-sums||commandBytes>n-commands)bad('scène '+k+' tronquée');
      for(let i=0,last=-1;i<checksums;i++){
        const at=view.getUint32(sums+8*i,true);
        if(at<=last||at>steps)bad('scène '+k+' : empreintes hors ordre');
        last=at;
      }
      const part={at:p,steps,sums,checksums,commands,commandBytes};
      commandsOf(part,k);parts.push(part);p=commands+commandBytes;
    }
    if(p!==n)bad(n+' octets au lieu de '+p);
    if(expect!==undefined&&expect!==null){
      if(typeof expect!=='object')fail('FDEMO_ARG','lecteur : expect invalide');
      for(const key of Object.keys(expect))if(text(header[key],'expect')!==text(expect[key],'expect'))fail('FDEMO_MISMATCH','enregistrement refusé : '+key,{field:key});
    }
    const fixed=dtTicks?0:1/hz,tick=dtTicks&&ticker(dtTicks);
    let scene=0,base=0,count=0,cursor=0,dt=fixed,commands=new Map(),sums=new Map(),divergence=null;
    const play={header,sceneCount:parts.length,
      select(k){
        const part=Number.isInteger(k)&&parts[k]||fail('FDEMO_ARG','lecteur : scène '+k+' inexistante'),byStep=new Map(),expected=new Map();
        for(const [at,type,data] of commandsOf(part,k))(byStep.get(at)||byStep.set(at,[]).get(at)).push({type,data});
        for(let i=0;i<part.checksums;i++)expected.set(view.getUint32(part.sums+8*i,true),view.getUint32(part.sums+8*i+4,true));
        scene=k;base=part.at;count=part.steps;cursor=0;dt=fixed;commands=byStep;sums=expected;
        return play;
      },
      next(out){
        if(cursor>=count)return false;
        let at=base+cursor*R;
        if(tick){dt=tick(view.getUint16(at,true));at+=2;}
        sc.decode(view,at,out);cursor++;
        return true;
      },
      commandsAt:at=>commands.get(at)||NONE,
      expected:at=>sums.get(at),
      verify(at,value){
        const want=sums.get(at);
        if(want===undefined||want===value>>>0)return true;
        divergence=divergence||{scene,step:at,expected:want,actual:value>>>0};
        return false;
      },
      get scene(){return scene;},get steps(){return count;},get step(){return cursor;},get dt(){return dt;},get divergence(){return divergence;}};
    if(parts.length)play.select(0);
    return play;
  }
  G.FDemo={FORMAT,MAGIC,rng,hasher,seedFor,smootherstep,wrapAngle,lookAt,schema,recorder,player};
})(typeof window!=='undefined'?window:globalThis);
