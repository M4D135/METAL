// Prototype of punchier procedural weapon reports (original recipe, no samples), measured with the
// same analyser as the current bank, plus WAV export of current vs prototype for listening.
// Usage: node doomish.mjs <ferro-root> [outdir]
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'; import vm from 'node:vm';
import {analyze} from './audio-analyze.mjs';
const root=process.argv[2],outdir=process.argv[3]||new URL('./wav/',import.meta.url).pathname,RATE=22050;
const ctx={window:{},performance,console,Math};vm.createContext(ctx);vm.runInContext(readFileSync(root+'/src/audio.js','utf8'),ctx);
const A=ctx.window.FAudio;
// ---- recipe: transient crack + pitched thump + saturated noise body + mechanism + short room ----
const RECIPES={
  pistol: {dur:.34, crack:[.55,1.6], thump:{f0:150,f1:55,tp:.020,ta:.060,g:.85}, body:{cut:2000,tb:.038,g:.75,drive:3.0}, mech:[[.055,.22,2600]], room:{tr:.085,g:.20}},
  smg:    {dur:.24, crack:[.60,1.2], thump:{f0:175,f1:62,tp:.016,ta:.040,g:.80}, body:{cut:2300,tb:.026,g:.70,drive:3.4}, mech:[[.030,.16,3000]], room:{tr:.070,g:.18}},
  shotgun:{dur:.92, crack:[.70,2.2], thump:{f0:120,f1:42,tp:.032,ta:.130,g:1.0}, body:{cut:1500,tb:.085,g:.95,drive:4.0}, mech:[[.47,.30,2200],[.56,.34,1700]], room:{tr:.160,g:.24}},
  rocket: {dur:.80, crack:[.45,2.5], thump:{f0:95,f1:38,tp:.060,ta:.200,g:.95}, body:{cut:1100,tb:.180,g:.90,drive:2.6}, mech:[[.020,.20,1900]], room:{tr:.220,g:.22}},
};
export function synth(name,variant=0,rate=RATE){
  const R=RECIPES[name];let seed=(0x5eed^Math.imul(variant+1,0x9e3779b9))>>>0;for(const c of name)seed=(Math.imul(seed,33)^c.charCodeAt(0))>>>0;
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
  const n=Math.ceil(R.dur*rate),out=new Float32Array(n),tune=1+(rnd()*.03);
  const one=f=>1-Math.exp(-2*Math.PI*f/rate);
  let lp1=0,lp2=0,hpL=0,phase=0,bandA=0,bandB=0,dcx=0,dcy=0;const dcR=Math.exp(-2*Math.PI*25/rate); // rate-aware 25 Hz DC blocker
  const er=[[.011,.34],[.017,.27],[.023,.21],[.031,.15],[.043,.10]].map(([t,g])=>[Math.round(t*rate),g]);const hist=new Float32Array(n);
  let roomLp=0;
  for(let i=0;i<n;i++){
    const t=i/rate,w=rnd();
    // crack: white minus its 2.5 kHz lowpass = bright band, very short
    hpL+=one(2500)*(w-hpL);const crack=(w-hpL)*R.crack[0]*Math.exp(-t/(R.crack[1]/1000));
    // thump: exponential pitch drop (kick-like), integrated phase
    const f=(R.thump.f1+(R.thump.f0-R.thump.f1)*Math.exp(-t/R.thump.tp))*tune;phase+=2*Math.PI*f/rate;
    const thump=Math.sin(phase)*R.thump.g*Math.min(1,t/.0006)*Math.exp(-t/R.thump.ta);
    // body: two-pole lowpassed noise, saturated
    lp1+=one(R.body.cut)*(w-lp1);lp2+=one(R.body.cut)*(lp1-lp2);
    const raw=lp2*3.2*R.body.g*Math.exp(-t/R.body.tb);const body=Math.tanh(raw*R.body.drive)/Math.tanh(R.body.drive);
    // mechanism: band-limited clicks with a short metallic ring
    let mech=0;for(const [at,g,fr] of R.mech){const u=t-at;if(u>=0&&u<.06){bandA+=one(fr*1.4)*(w-bandA);bandB+=one(fr*.7)*(bandA-bandB);mech+=((bandA-bandB)*2.2*Math.exp(-u/.004)+.35*Math.sin(2*Math.PI*fr*u)*Math.exp(-u/.011))*g;}}
    let x=crack+thump+body+mech;hist[i]=x;
    // early reflections + diffuse lowpassed tail (short room)
    for(const [d,g] of er)if(i>=d)x+=hist[i-d]*g*R.room.g*2.2;
    roomLp+=one(900)*(w-roomLp);x+=roomLp*R.room.g*1.6*Math.exp(-t/R.room.tr)*Math.min(1,t/.012);
    // DC block + gentle density saturation
    dcy=x-dcx+dcR*dcy;dcx=x;out[i]=Math.tanh(dcy*1.25)/Math.tanh(1.25);
  }
  const fade=Math.round(.012*rate);for(let i=0;i<fade;i++)out[n-1-i]*=i/fade;let peak=0;for(const v of out)peak=Math.max(peak,Math.abs(v));for(let i=0;i<n;i++)out[i]*=.84/peak;out[0]=0;out[n-1]=0;return out;
}
function wav(path,pcm,rate=RATE){const b=Buffer.alloc(44+pcm.length*2);b.write('RIFF',0);b.writeUInt32LE(36+pcm.length*2,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(pcm.length*2,40);for(let i=0;i<pcm.length;i++)b.writeInt16LE(Math.max(-32767,Math.min(32767,Math.round(pcm[i]*32767))),44+i*2);writeFileSync(path,b);}
if(import.meta.url===`file://${process.argv[1]}`){
  mkdirSync(outdir,{recursive:true});const rows={};
  for(const name of Object.keys(RECIPES)){
    const cur=A.synthesize(name,0,RATE);const t0=performance.now();const pro=synth(name,0,RATE);const ms=performance.now()-t0;
    const a=analyze(cur,RATE),b=analyze(pro,RATE);
    const fmt=v=>({ms:v.ms,'90%E ms':v.t90,'-20dB ms':v.t20dB,crestDb:v.crestDb,'<120 %':v.bandsPct[0],'120-500 %':v.bandsPct[1],'500-4k %':v.bandsPct[2],'>4k %':v.bandsPct[3],centroid:v.centroidHz});
    rows[name+' actuel']=fmt(a);rows[name+' prototype']={...fmt(b),synthMs:+ms.toFixed(2)};
    wav(outdir+name+'-actuel.wav',cur);wav(outdir+name+'-prototype.wav',pro);
    // automatic fire strings (8/s for smg, 3.1/s pistol): what the player hears holding the trigger
    if(name==='smg'||name==='pistol'){const gap=name==='smg'?.125:.32,count=name==='smg'?10:4;for(const [tag,gen] of [['actuel',v=>A.synthesize(name,v%2,RATE)],['prototype',v=>synth(name,v%2,RATE)]]){const buf=new Float32Array(Math.ceil((gap*count+.5)*RATE));for(let k=0;k<count;k++){const s=gen(k),o=Math.round(k*gap*RATE);for(let i=0;i<s.length&&o+i<buf.length;i++)buf[o+i]+=s[i]*.6;}let pk=0;for(const v of buf)pk=Math.max(pk,Math.abs(v));for(let i=0;i<buf.length;i++)buf[i]*=.9/pk;wav(outdir+name+'-rafale-'+tag+'.wav',buf);}}
  }
  console.table(rows);console.log('WAV ecrits dans',outdir);
}
