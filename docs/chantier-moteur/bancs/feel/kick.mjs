// Weapon kick of FMotion per impulse kind: peak recoil (m, deg), time to peak, settle time; camera channels.
import {readFileSync} from 'node:fs';import vm from 'node:vm';
const root=process.argv[2];const ctx={window:{},Math};vm.createContext(ctx);vm.runInContext(readFileSync(root+'/src/motion.js','utf8'),ctx);
const M=ctx.window.FMotion;const rows={};
for(const kind of ['pistol','shot','fracture','rocket','switch','hurt','melee']){
  const m=M.create();m.update(1/60,{},{time:0});m.impulse(kind);let peakZ=0,peakR=0,peakY=0,tPeak=0,settle=null,cam=0;
  for(let i=1;i<=60;i++){const v=m.update(1/60,{},{time:i/60});const z=Math.abs(v.weapon.offset[2]),r=Math.abs(v.weapon.rotation[0]),y=Math.abs(v.weapon.offset[1]);if(z>peakZ){peakZ=z;tPeak=i/60;}peakR=Math.max(peakR,r);peakY=Math.max(peakY,y);cam=Math.max(cam,Math.abs(v.height),Math.abs(v.roll),Math.abs(v.fov));if(settle===null&&i/60>tPeak&&z<peakZ*.1&&peakZ>0)settle=i/60;}
  rows[kind]={'recul arme (cm)':+(peakZ*100).toFixed(2),'bascule (deg)':+(peakR*180/Math.PI).toFixed(2),'abaissement (cm)':+(peakY*100).toFixed(2),'pic a (ms)':Math.round(tPeak*1000),'retour <10% (ms)':settle&&Math.round(settle*1000),'camera (max)':+cam.toFixed(4)};
}
console.table(rows);
