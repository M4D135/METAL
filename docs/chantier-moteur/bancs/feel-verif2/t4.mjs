// FEEL-06 independent analysis: own FFT, band shares, t90, centroid, RMS, loudness in first 100 ms.
import {load,ROOT} from './L.mjs';
import {synth} from '../feel/doomish.mjs';
const W=load(['audio']);const A=W.FAudio;const RATE=22050;
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
  for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){const ur=re[i+k],ui=im[i+k],vr=re[i+k+len/2]*cr-im[i+k+len/2]*ci,vi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;re[i+k]=ur+vr;im[i+k]=ui+vi;re[i+k+len/2]=ur-vr;im[i+k+len/2]=ui-vi;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t;}}}}
function an(x){const N=65536,re=new Float64Array(N),im=new Float64Array(N);re.set(x);fft(re,im);
  const bands=[0,0,0,0,0];let tot=0,cen=0;for(let k=1;k<N/2;k++){const f=k*RATE/N,e=re[k]*re[k]+im[k]*im[k];tot+=e;cen+=e*f;bands[f<60?0:f<120?1:f<500?2:f<4000?3:4]+=e;}
  let E=0;for(const v of x)E+=v*v;let c=0,t90=0;for(let i=0;i<x.length;i++){c+=x[i]*x[i];if(c>=.9*E){t90=i/RATE*1000;break;}}
  let pk=0;for(const v of x)pk=Math.max(pk,Math.abs(v));const rms=Math.sqrt(E/x.length);
  let e100=0;const n100=Math.min(x.length,Math.round(.1*RATE));for(let i=0;i<n100;i++)e100+=x[i]*x[i];
  return {ms:+(x.length/RATE*1000).toFixed(0),t90:+t90.toFixed(0),'<60%':+(bands[0]/tot*100).toFixed(1),'60-120%':+(bands[1]/tot*100).toFixed(1),'<120%':+((bands[0]+bands[1])/tot*100).toFixed(1),'120-500%':+(bands[2]/tot*100).toFixed(1),'500-4k%':+(bands[3]/tot*100).toFixed(1),'>4k%':+(bands[4]/tot*100).toFixed(1),centroid:+(cen/tot).toFixed(0),crestDb:+(20*Math.log10(pk/rms)).toFixed(1),rms:+rms.toFixed(3),'E100ms dB':+(10*Math.log10(e100)).toFixed(1),'E(120-500) dB':+(10*Math.log10(bands[2]/N*2)).toFixed(1),'E(<120) dB':+(10*Math.log10((bands[0]+bands[1])/N*2)).toFixed(1)};}
const rows={};
for(const n of ['smg','pistol','shotgun','rocket','grenade']){rows[n+' actuel']=an(A.synthesize(n,0,RATE));if(n!=='grenade')rows[n+' proto']=an(synth(n,0,RATE));}
console.table(rows);
// variant 1 check + DC
for(const n of ['smg','pistol','shotgun','rocket']){const x=synth(n,1,RATE);let dc=0;for(const v of x)dc+=v;console.log(n,'proto v1 dc',(dc/x.length).toFixed(5),'tail',Math.max(...Array.from(x.slice(-Math.round(.02*RATE))).map(Math.abs)).toFixed(4));}
