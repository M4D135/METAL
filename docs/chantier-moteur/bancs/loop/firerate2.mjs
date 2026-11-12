// Cadence mitraillette/pistolet au pas des tests (.025) et à d'autres pas constants.
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const root=process.argv[2];const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world','destruction','economy','brain','simulation'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld,FSimulation}=ctx.window;const classic=FWorld.create(96,0),camp=FWorld.create(96,0,{campaign:true,campaignVersion:2});
const rows=[];
for(const dt of [.025,1/60,1/120,1/144,.02,1/30]){
  const a=FSimulation.create(classic,{inventory:{weapons:[true,true,true],ammo:[180,36,12]}});a.state.player.pitch=-1.1;let t=0;const s0=a.state.shots;
  while(t<10-1e-9){a.state.inventory.ammo[0]=180;a.state.player.heat=0;a.state.player.overheated=false;a.step(dt,{fire:true,weapon:0});t+=dt;}
  const b=FSimulation.create(camp,{armorSystem:true});b.state.player.pitch=-1.1;t=0;const p0=b.state.shots;
  while(t<10-1e-9){b.state.player.heat=0;b.state.player.overheated=false;b.step(dt,{fire:true,weapon:4});t+=dt;}
  rows.push({'pas (ms)':+(dt*1000).toFixed(2),'mitraillette tirs/10 s (théorie 80)':a.state.shots-s0,'période réelle (ms)':+(10000/(a.state.shots-s0)).toFixed(1),'pistolet tirs/10 s (théorie 31,25)':b.state.shots-p0});
}
console.table(rows);
