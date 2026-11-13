// Energy per shot (sum x^2 / rate) and short-window (50 ms / 400 ms) max RMS of current vs prototype WAVs, in dB.
import {readFileSync,readdirSync} from 'node:fs';
const dir=process.argv[2];
function read(f){const b=readFileSync(f);let o=12,data,bits=16,rate=22050;while(o<b.length-8){const id=b.toString('ascii',o,o+4),sz=b.readUInt32LE(o+4);if(id==='fmt ')rate=b.readUInt32LE(o+12),bits=b.readUInt16LE(o+22);if(id==='data')data=b.subarray(o+8,o+8+sz);o+=8+sz+(sz&1);}const n=data.length/2,x=new Float64Array(n);for(let i=0;i<n;i++)x[i]=data.readInt16LE(i*2)/32768;return {x,rate};}
const win=(x,rate,ms)=>{const w=Math.round(rate*ms/1000);let s=0,best=0;for(let i=0;i<x.length;i++){s+=x[i]*x[i];if(i>=w)s-=x[i-w]*x[i-w];best=Math.max(best,s/w);}return 10*Math.log10(best);};
const rows={};
for(const w of ['smg','pistol','shotgun','rocket','smg-rafale','pistol-rafale']){const a=read(dir+'/'+w+'-actuel.wav'),p=read(dir+'/'+w+'-prototype.wav');
  const E=v=>10*Math.log10(v.x.reduce((s,q)=>s+q*q,0)/v.rate);
  rows[w]={energie_dB:+(E(p)-E(a)).toFixed(1),rms50ms_dB:+(win(p.x,p.rate,50)-win(a.x,a.rate,50)).toFixed(1),rms400ms_dB:+(win(p.x,p.rate,400)-win(a.x,a.rate,400)).toFixed(1)};}
console.log('ecart prototype - actuel (dB), a crete egale');console.table(rows);
