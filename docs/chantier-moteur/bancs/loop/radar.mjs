// Part statique du radar (game.js:660-674) : salles + couloirs redessinés à chaque renderHUD (~11 Hz).
import {readFileSync} from 'node:fs';import vm from 'node:vm';import {performance} from 'node:perf_hooks';
const root=process.argv[2];const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);
for(const n of ['renderer','world'])vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});
const {FWorld}=ctx.window;
for(const [label,idx,opts] of [['classic-0',0],['classic-2',2],['campaign-0',0,{campaign:true,campaignVersion:2}],['campaign-9',9,{campaign:true,campaignVersion:2}],['campaign-17',17,{campaign:true,campaignVersion:2}]]){
  const w=FWorld.create(96,idx,opts);const stat=(w.corridors||[]).length+w.rooms.length;
  const dyn=(w.cores||[]).length*5+(w.mechanisms||[]).length*3+(w.lifts||[]).length*4+(w.jumpPads||[]).length+(w.shops||[]).length*6+(w.trophies||[]).length*4+2+8;
  console.log(label.padEnd(12),'salles+couloirs',stat,'=> appels statiques ~',stat*2,'+ réglages de style',stat*2,'| dynamiques ~',dyn);
}
