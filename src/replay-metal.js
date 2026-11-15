/* METAL — exact input stream with dated out-of-band commands. Opt-in only. */
(function(G){'use strict';
  const fields=[{name:'moveX',type:'i8',scale:127},{name:'moveY',type:'i8',scale:127},{name:'lookX',type:'i16',scale:8192},{name:'lookY',type:'i16',scale:8192},{name:'buttons',type:'bits',names:['fire','fireLeft','dash','pulse','melee','interact','sprint','assist','jump','jumpHeld','switchProfile','touchAssist']},{name:'weapon',type:'u8'},{name:'leftChoice',type:'u8'}],commands=['selectWeapon','selectLeftWeapon','switchProfile','buy','setDifficulty','snapshot','restore'];
  function attach(sim,{header,scene,recorder}={}){
    const r=recorder||G.FDemo.recorder({...header,game:'METAL',hz:60,dtTicks:48000,fields}),original={step:sim.step};let inside=false,closed=false;r.scene(scene);r.checksum(sim.digest());
    for(const name of commands){original[name]=sim[name];sim[name]=(...args)=>{if(!closed&&!inside)r.command(name,args);return original[name](...args);};}
    sim.step=(dt,input={})=>{if(closed)return original.step(dt,input);const sample={...input,leftChoice:Number.isInteger(input.leftWeapon)?input.leftWeapon+1:undefined},quantized=r.step(sample,dt);quantized.leftWeapon=quantized.leftChoice===undefined?undefined:quantized.leftChoice-1;inside=true;try{original.step(r.dt,quantized);}finally{inside=false;}if(r.checksumDue())r.checksum(sim.digest());};
    function detach(){closed=true;for(const [k,v] of Object.entries(original))sim[k]=v;}
    return {recorder:r,detach,get steps(){return r.steps;},get size(){return r.size;},bytes:()=>r.bytes(),end(){if(closed)throw Error('Recording already closed');detach();return r.end();}};
  }
  function playback(bytes,open,expect){return G.FDemo.replay(bytes,{open(scene,index,header){const s=open(scene,index,header);return {step(input,dt){input.leftWeapon=input.leftChoice===undefined?undefined:input.leftChoice-1;s.step(dt,input);},checksum:()=>s.digest(),command(type,args){if(!commands.includes(type)||!Array.isArray(args))throw Error('Unknown replay command');s[type](...args);},dispose:()=>s.dispose()};}},{expect});}
  G.MetalReplay={fields,attach,playback};
})(typeof window!=='undefined'?window:globalThis);
