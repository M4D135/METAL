// Independent spectral check of FAudio.synthesize weapon buffers (read-only).
// usage: node audio-indep.mjs <ferro-root>
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const root=process.argv[2];const scope={};scope.window=scope;vm.createContext(scope);
vm.runInContext(readFileSync(root+'/src/audio.js','utf8'),scope,{filename:'audio.js'});
const synth=scope.FAudio.synthesize,rate=22050;
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
  for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){const a=i+k,b=a+len/2,tr=re[b]*cr-im[b]*ci,ti=re[b]*ci+im[b]*cr;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr;}}}}
function analyse(x){
  const N=1<<16,re=new Float64Array(N),im=new Float64Array(N);for(let i=0;i<x.length;i++)re[i]=x[i];fft(re,im);
  let tot=0,lo120=0,lo200=0,c1=0,cm=0,mt=0,b=[0,0,0,0,0];const edges=[60,120,250,1000,4000];
  for(let k=1;k<N/2;k++){const f=k*rate/N,pw=re[k]**2+im[k]**2,mag=Math.sqrt(pw);tot+=pw;if(f<120)lo120+=pw;if(f<200)lo200+=pw;c1+=f*pw;cm+=f*mag;mt+=mag;}
  let e=0,etot=0,peak=0;for(const v of x){etot+=v*v;peak=Math.max(peak,Math.abs(v));}
  let t90=0;for(let i=0;i<x.length;i++){e+=x[i]*x[i];if(e>=.9*etot){t90=i/rate;break;}}
  // rms over the 90% energy window (less length-dependent than whole buffer)
  const rmsAll=Math.sqrt(etot/x.length),rms90=Math.sqrt(.9*etot/Math.max(1,t90*rate));
  return {ms:+(x.length/rate*1000).toFixed(0),t90ms:+(t90*1000).toFixed(1),below120:+(lo120/tot*100).toFixed(2),below200:+(lo200/tot*100).toFixed(2),centroidPow:Math.round(c1/tot),centroidMag:Math.round(cm/mt),crestAll:+(20*Math.log10(peak/rmsAll)).toFixed(1),crest90:+(20*Math.log10(peak/rms90)).toFixed(1)};
}
const rows={};for(const name of ['smg','pistol','shotgun','rocket','grenade','explosion']){const a=[0,1].map(v=>analyse(synth(name,v,rate)));rows[name]=a[0];rows[name+'#v1']=a[1];}
console.table(rows);
let t0=performance.now();for(let i=0;i<20;i++)synth('shotgun',i&1,rate);console.log('synth shotgun ms/buffer',((performance.now()-t0)/20).toFixed(2));
