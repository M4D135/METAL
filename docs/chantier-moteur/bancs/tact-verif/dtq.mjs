// Vérif TACT-09 : l'écart de hash entre processus vient-il uniquement de l'arrondi de dt ?
import {boot,stateHash,FNV} from '../tact/lib.mjs';
const root=process.argv[2];
const B=await boot(root,{touch:false});const startNow=B.H.now;B.record(true);
const ev=[{t:0,fn:()=>B.key('keydown','KeyW')},{t:2000,fn:()=>B.key('keydown','Enter')},{t:3000,fn:()=>B.key('keyup','Enter')},{t:3200,fn:()=>B.key('keyup','KeyW')}];
B.play(3500,ev,16.6);
const rec=B.rec.map(r=>({...r}));const h=FNV();for(const r of rec)h.num(r.dt);
const dts={};for(const r of rec){dts[r.dt]=(dts[r.dt]||0)+1;}
async function replay(map){const R=await boot(root,{touch:false});for(const r of rec)R.sim.step(map(r.dt),{...r});return stateHash(R.sim);}
console.log(JSON.stringify({startNow,pas:rec.length,hashSession:stateHash(B.sim),hashDt:h.value,dtDistincts:Object.keys(dts).length,
  rejeuDtBruts:await replay(d=>d),rejeuDtArrondis:await replay(d=>Math.round(d*1e7)/1e7),rejeuDtFixe:await replay(d=>d>0.012?0.0166:0.0083)}));
