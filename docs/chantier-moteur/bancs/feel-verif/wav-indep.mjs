// Independent analysis of the A/B WAV files (16-bit or float PCM, mono).
import {readFileSync,readdirSync} from 'node:fs';
const dir=process.argv[2];
function readWav(f){const b=readFileSync(f);let o=12,fmt=null,data=null;while(o<b.length-8){const id=b.toString('ascii',o,o+4),sz=b.readUInt32LE(o+4);if(id==='fmt ')fmt={tag:b.readUInt16LE(o+8),ch:b.readUInt16LE(o+10),rate:b.readUInt32LE(o+12),bits:b.readUInt16LE(o+22)};if(id==='data')data=b.subarray(o+8,o+8+sz);o+=8+sz+(sz&1);}
  const n=data.length/(fmt.bits/8)/fmt.ch,x=new Float64Array(n);for(let i=0;i<n;i++){const k=i*fmt.ch*(fmt.bits/8);x[i]=fmt.bits===16?data.readInt16LE(k)/32768:fmt.bits===32&&fmt.tag===3?data.readFloatLE(k):data.readInt32LE(k)/2147483648;}return {x,rate:fmt.rate,fmt};}
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len/2;k++){const a=i+k,b=a+len/2,tr=re[b]*cr-im[b]*ci,ti=re[b]*ci+im[b]*cr;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const nr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nr;}}}}
const rows={};
for(const f of readdirSync(dir).filter(f=>f.endsWith('.wav')&&!f.includes('rafale')).sort()){
  const {x,rate,fmt}=readWav(dir+'/'+f);let N=1;while(N<x.length)N<<=1;N=Math.max(N,65536);const re=new Float64Array(N),im=new Float64Array(N);re.set(x);fft(re,im);
  let tot=0,l120=0,l200=0,c=0;for(let k=1;k<N/2;k++){const fr=k*rate/N,pw=re[k]**2+im[k]**2;tot+=pw;if(fr<120)l120+=pw;if(fr<200)l200+=pw;c+=fr*pw;}
  let e=0,et=0,pk=0;for(const v of x){et+=v*v;pk=Math.max(pk,Math.abs(v));}let t90=0;for(let i=0;i<x.length;i++){e+=x[i]*x[i];if(e>=.9*et){t90=i/rate;break;}}
  rows[f]={rate,bits:fmt.bits,ms:Math.round(x.length/rate*1000),t90ms:+(t90*1000).toFixed(0),'<120Hz%':+(l120/tot*100).toFixed(1),'<200Hz%':+(l200/tot*100).toFixed(1),centroid:Math.round(c/tot),peak:+pk.toFixed(2),crestDb:+(20*Math.log10(pk/Math.sqrt(et/x.length))).toFixed(1)};
}
console.table(rows);
