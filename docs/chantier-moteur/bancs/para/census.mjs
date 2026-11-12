// PARA / E1 : recensement de ce que la PAGE (game.js, effects, actors, soundscape, motion...) lit et ecrit
// dans sim.state a chaque image, et des fonctions de sim qu'elle appelle. Le vrai game.js tourne dans le
// harnais LOOP (DOM/GL/audio factices) ; sim.state est remplace, cote page seulement, par un proxy profond
// enregistreur (la simulation elle-meme utilise sa fermeture `s`, elle n'est pas enregistree).
// usage : node census.mjs <racine METAL> [secondes=20] [monde campagne, defaut 9]
import {createHarness} from '../loop/harness.mjs';
const root=process.argv[2],seconds=+(process.argv[3]||20),worldIndex=process.argv[4]===undefined?9:+process.argv[4];
const REC={on:false,reads:new Map(),writes:new Map(),calls:new Map(),frameLeaves:new Set(),perFrame:[],byTop:new Map()};
const isPlain=v=>v!==null&&typeof v==='object'&&!ArrayBuffer.isView(v)&&!(v instanceof ArrayBuffer);
const ids=new WeakMap();let nextId=1;const idOf=o=>{let i=ids.get(o);if(!i){i=nextId++;ids.set(o,i);}return i;};
function deep(raw,path,cache){
  let p=cache.get(raw);if(p)return p;
  p=new Proxy(raw,{
    get(t,k,r){
      const v=Reflect.get(t,k,t);
      if(typeof k==='symbol')return v;
      const isIndex=Array.isArray(t)&&/^\d+$/.test(k);
      const child=isIndex?path+'[]':path+'.'+k;
      if(typeof v==='function'){ // methodes de tableau : s'executent sur le proxy (les lectures d'elements sont comptees)
        return v;
      }
      if(k==='length'&&Array.isArray(t)){REC.reads.set(path+'.length',(REC.reads.get(path+'.length')||0)+1);return v;}
      if(isPlain(v))return deep(v,child,cache);
      REC.reads.set(child,(REC.reads.get(child)||0)+1);
      if(ArrayBuffer.isView(v)){REC.frameLeaves.add('T'+child+':'+v.byteLength);return v;}
      const key=idOf(t)+':'+k;if(!REC.frameLeaves.has(key)){REC.frameLeaves.add(key);const top=child.split(/[.\[]/)[1];const kind=typeof v;const q=REC.byTop.get(top)||{num:0,str:0,bool:0,other:0,strBytes:0};if(kind==='number')q.num++;else if(kind==='string'){q.str++;q.strBytes+=v.length;}else if(kind==='boolean')q.bool++;else q.other++;REC.byTop.set(top,q);}
      return v;
    },
    set(t,k,v){const isIndex=Array.isArray(t)&&/^\d+$/.test(String(k));const child=isIndex?path+'[]':path+'.'+String(k);REC.writes.set(child,(REC.writes.get(child)||0)+1);return Reflect.set(t,k,v,t);},
    deleteProperty(t,k){REC.writes.set(path+'.(delete)',(REC.writes.get(path+'.(delete)')||0)+1);return Reflect.deleteProperty(t,k);}
  });
  cache.set(raw,p);return p;
}
const H=await createHarness(root,{beforeGame(ctx){
  const create=ctx.FSimulation.create;
  ctx.FSimulation.create=(...a)=>{
    const sim=create(...a),raw=sim.state,cache=new WeakMap();
    const out={};
    for(const k of Object.getOwnPropertyNames(sim)){
      const d=Object.getOwnPropertyDescriptor(sim,k);
      if(k==='state'){Object.defineProperty(out,'state',{get(){return REC.on?deep(raw,'state',cache):raw;},enumerable:true});continue;}
      if(d.get){Object.defineProperty(out,k,{get(){if(REC.on)REC.calls.set('get '+k,(REC.calls.get('get '+k)||0)+1);return sim[k];},enumerable:true});continue;}
      if(typeof d.value==='function'){const f=d.value;out[k]=function(...b){if(REC.on){REC.calls.set(k+'()',(REC.calls.get(k+'()')||0)+1);const was=REC.on;REC.on=false;try{return f.apply(sim,b);}finally{REC.on=was;}}return f.apply(sim,b);};continue;}
      out[k]=d.value;
    }
    out.__raw=sim;return out;
  };
}});
await H.startGame();
H.G.load(worldIndex,96,undefined,true,2);H.G.saveCheckpoint();H.G.start('bench');
let t=H.now,elapsed=0,frames=0;
H.key('keydown','KeyW');H.key('keydown','ShiftLeft');
const sizes=[];
while(elapsed<seconds*1000){
  const dt=1000/60;t+=dt;elapsed+=dt;frames++;
  const slot=k=>Math.floor(elapsed/k),prevSlot=k=>Math.floor((elapsed-dt)/k);
  if(slot(1500)!==prevSlot(1500)){const phase=slot(1500)%2;H.key('keyup',phase?'KeyA':'KeyD');H.key('keydown',phase?'KeyD':'KeyA');}
  const inBurst=v=>(v%333)<100;if(inBurst(elapsed)&&!inBurst(elapsed-dt))H.mouse.down(0);if(!inBurst(elapsed)&&inBurst(elapsed-dt))H.mouse.up(0);
  H.mouse.move(dt*.36,(elapsed%2000<1000)?-dt/16:dt/16);
  REC.frameLeaves.clear();REC.byTop.clear();REC.on=true;
  H.frame(t);
  REC.on=false;
  const tot={num:0,str:0,bool:0,other:0,strBytes:0};for(const q of REC.byTop.values())for(const k in tot)tot[k]+=q[k];
  sizes.push({...tot,byTop:Object.fromEntries([...REC.byTop].map(([k,v])=>[k,v.num+v.str+v.bool]))});
  const raw=H.G.sim.__raw.state;raw.player.hp=Math.max(raw.player.hp,80);
  if(H.G.mode!=='playing'){if(H.G.mode==='dead'||H.G.mode==='cleared')break;H.G.setMode('playing');}
}
const qv=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(s.length*p))];};
const nums=sizes.map(x=>x.num),strs=sizes.map(x=>x.str),bools=sizes.map(x=>x.bool),sb=sizes.map(x=>x.strBytes);
const tops={};for(const s of sizes)for(const [k,v] of Object.entries(s.byTop)){(tops[k]??=[]).push(v);}
const topSummary=Object.fromEntries(Object.entries(tops).map(([k,v])=>[k,{p50:qv(v,.5),max:Math.max(...v),frames:v.length}]).sort((a,b)=>b[1].max-a[1].max));
const collapse=m=>[...m].sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' x'+v);
console.log(JSON.stringify({monde:'campagne '+worldIndex,images:frames,
  feuillesLuesParImage:{nombres:{p50:qv(nums,.5),p95:qv(nums,.95),max:Math.max(...nums)},chaines:{p50:qv(strs,.5),max:Math.max(...strs)},octetsChaines:{p50:qv(sb,.5),max:Math.max(...sb)},booleens:{p50:qv(bools,.5),max:Math.max(...bools)}},
  octetsFloat32:{p50:qv(nums,.5)*4,max:Math.max(...nums)*4},octetsFloat64:{p50:qv(nums,.5)*8,max:Math.max(...nums)*8},
  parRacine:topSummary,
  appelsSimDepuisLaPage:collapse(REC.calls),
  ecrituresPageDansEtat:collapse(REC.writes),
  cheminsLus:REC.reads.size},null,1));
if(process.env.PATHS){console.log('--- chemins lus (cumul) ---');for(const l of collapse(REC.reads))console.log(l);}
process.exit(0);
