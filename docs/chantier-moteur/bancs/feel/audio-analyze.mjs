// Offline analysis of METAL procedural PCM effects (FAudio.synthesize), no AudioContext.
// Usage: node audio-analyze.mjs <ferro-root> [rate]
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const root=process.argv[2], rate=+process.argv[3]||22050;
const ctx={window:{},performance,console,Math}; vm.createContext(ctx);
vm.runInContext(readFileSync(root+'/src/audio.js','utf8'),ctx,{filename:'audio.js'});
const A=ctx.window.FAudio;
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
  for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let j=0;j<len/2;j++){const ar=re[i+j],ai=im[i+j],br=re[i+j+len/2]*cr-im[i+j+len/2]*ci,bi=re[i+j+len/2]*ci+im[i+j+len/2]*cr;re[i+j]=ar+br;im[i+j]=ai+bi;re[i+j+len/2]=ar-br;im[i+j+len/2]=ai-bi;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t;}}}}
export function analyze(pcm,sr){
  let peak=0,peakAt=0,energy=0;for(let i=0;i<pcm.length;i++){const a=Math.abs(pcm[i]);if(a>peak){peak=a;peakAt=i;}energy+=pcm[i]*pcm[i];}
  const rms=Math.sqrt(energy/pcm.length);
  // short-time RMS envelope (2 ms windows) -> decay times relative to the loudest window
  const w=Math.max(1,Math.round(sr*.002)),env=[];for(let i=0;i<pcm.length;i+=w){let e=0;for(let k=i;k<Math.min(pcm.length,i+w);k++)e+=pcm[k]*pcm[k];env.push(Math.sqrt(e/w));}
  const top=Math.max(...env),topAt=env.indexOf(top);const fall=db=>{const lim=top*10**(db/20);let last=topAt;for(let i=topAt;i<env.length;i++)if(env[i]>=lim)last=i;return +((last+1)*w/sr*1000).toFixed(1);};
  // energy-weighted "perceived length": time containing 90% / 99% of energy
  let acc=0,t90=0,t99=0;for(let i=0;i<pcm.length;i++){acc+=pcm[i]*pcm[i];if(!t90&&acc>=.9*energy)t90=i;if(!t99&&acc>=.99*energy){t99=i;break;}}
  let n=1;while(n<pcm.length*2)n<<=1;n=Math.max(n,8192);const re=new Float64Array(n),im=new Float64Array(n);for(let i=0;i<pcm.length;i++)re[i]=pcm[i];fft(re,im);
  const bands=[[0,120],[120,500],[500,4000],[4000,sr/2]],be=bands.map(()=>0);let tot=0,cent=0;
  for(let k=1;k<n/2;k++){const f=k*sr/n,p=re[k]*re[k]+im[k]*im[k];tot+=p;cent+=f*p;for(let b=0;b<bands.length;b++)if(f>=bands[b][0]&&f<bands[b][1])be[b]+=p;}
  return {ms:+(pcm.length/sr*1000).toFixed(1),peakMs:+(peakAt/sr*1000).toFixed(2),crestDb:+(20*Math.log10(peak/rms)).toFixed(1),rms:+rms.toFixed(4),
    t20dB:fall(-20),t40dB:fall(-40),t90:+(t90/sr*1000).toFixed(1),t99:+(t99/sr*1000).toFixed(1),
    bandsPct:be.map(v=>+(v/tot*100).toFixed(1)),centroidHz:Math.round(cent/tot)};
}
if(import.meta.url===`file://${process.argv[1]}`){
  const names=['pistol','smg','shotgun','rocket','grenade','explosion','body','click','swish','impact:metal'];
  const rows={};
  for(const name of names){const t0=performance.now();const pcm=A.synthesize(name,0,rate);const ms=performance.now()-t0;rows[name]={...analyze(pcm,rate),synthMs:+ms.toFixed(2)};}
  console.log('rate',rate,'bands = % energie [<120 Hz, 120-500, 500-4000, >4000]');
  console.table(Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{ms:v.ms,peakMs:v.peakMs,'-20dB ms':v.t20dB,'-40dB ms':v.t40dB,'90%E ms':v.t90,'99%E ms':v.t99,crestDb:v.crestDb,'<120':v.bandsPct[0],'120-500':v.bandsPct[1],'500-4k':v.bandsPct[2],'>4k':v.bandsPct[3],centroid:v.centroidHz,synthMs:v.synthMs}])));
}
