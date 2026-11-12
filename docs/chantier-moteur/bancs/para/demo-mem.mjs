// PARA / demo qui dure : memoire d'un worker qui enchaine des mondes (creation, 600 pas pilotes, liberation), puis
// effet de worker.terminate(). Mesure heapUsed apres gc() force, dans le worker.
import {Worker,MessageChannel,receiveMessageOnPort} from 'node:worker_threads';
import {loadMain,build,drive} from './load.mjs';
if(process.argv[2]==='child'){
  const {parentPort}=await import('node:worker_threads');const win=loadMain();const names=['campaign2-w6','campaign2-w10','legacy-s0'];const rows=[];
  const mem=()=>{globalThis.gc();globalThis.gc();const u=process.memoryUsage();return +(u.heapUsed/1048576).toFixed(1);};
  rows.push({cycle:-1,heapMo:mem()});
  for(let c=0;c<+process.argv[3];c++){
    let {world,sim}=build(win,names[c%names.length]);const s=sim.state,input={};
    for(let i=0;i<600;i++){drive(i,input);sim.step(1/60,input);s.player.hp=Math.max(s.player.hp,60);s.events.length=0;}
    const live=mem();sim.dispose?.();sim=null;world=null;rows.push({cycle:c,monde:names[c%names.length],heapVivantMo:live,heapApresLiberationMo:mem()});
  }
  parentPort.postMessage(rows);
}else{
  const before=process.memoryUsage().rss;
  const w=new Worker(new URL(import.meta.url),{argv:['child',process.argv[2]||'6']});
  const rows=await new Promise(r=>w.once('message',r));const mid=process.memoryUsage().rss;await w.terminate();
  await new Promise(r=>setTimeout(r,300));if(globalThis.gc)globalThis.gc();const after=process.memoryUsage().rss;
  console.log(JSON.stringify({rows,rssMo:{avant:+(before/1048576).toFixed(0),workerVivant:+(mid/1048576).toFixed(0),apresTerminate:+(after/1048576).toFixed(0)}},null,1));
}
