// RCPU: methodology check. Same code evaluated (a) in a node:vm context like checks/ and bench.mjs,
// (b) in the main realm. Measures world generation, sim init and 600 sim steps for each.
import {readFileSync} from 'node:fs'; import vm from 'node:vm';
const root=process.argv[2];const names=['renderer','world','destruction','economy','brain','simulation'];
function viaVm(){const ctx={window:{},performance,console,Math,Date};vm.createContext(ctx);for(const n of names)vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});return ctx.window;}
function viaVmNoMath(){const ctx={window:{},performance,console};vm.createContext(ctx);for(const n of names)vm.runInContext(readFileSync(root+'/src/'+n+'.js','utf8'),ctx,{filename:n+'.js'});return ctx.window;}
function viaMain(){const win={};for(const n of names)vm.runInThisContext('(function(window){'+readFileSync(root+'/src/'+n+'.js','utf8')+'\n})',{filename:n+'.js'})(win);return win;}
function run(label,W){
  const out=[];
  for(let rep=0;rep<3;rep++){
    let t=performance.now();const w=W.FWorld.create(96,0);const gen=performance.now()-t;
    t=performance.now();const sim=W.FSimulation.create(w,{brain:W.FBrain.create({mode:'cpu'})});const init=performance.now()-t;
    const input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};const s=sim.state;
    t=performance.now();for(let i=0;i<600;i++){input.moveX=Math.sin(i/90);input.fire=(i%20)<6;input.dash=(i%240)===0;s.player.yaw+=0.01;sim.step(1/60,input);}
    out.push({gen:+gen.toFixed(0),init:+init.toFixed(0),steps600:+(performance.now()-t).toFixed(0)});
  }
  console.log(label,JSON.stringify(out));
}
const order=process.argv[3]==='rev'?['main','vm','vmNoMath']:['vm','vmNoMath','main'];
for(const k of order)run(k,k==='vm'?viaVm():k==='vmNoMath'?viaVmNoMath():viaMain());
