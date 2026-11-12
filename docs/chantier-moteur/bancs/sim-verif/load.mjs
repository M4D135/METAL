// Independent loader (SIM counter-verification). Repo is READ-ONLY: sources are read and evaluated in memory.
import {readFileSync} from 'node:fs';import vm from 'node:vm';
export const ROOT=(process.env.METAL_ROOT||process.cwd());
export const MODULES=['renderer','world','destruction','economy','brain','simulation'];
export const src=n=>readFileSync(ROOT+'/src/'+n+'.js','utf8');
function applyPatches(name,text,patches){for(const [from,to] of (patches?.[name]||[])){const at=text.indexOf(from);if(at<0||text.indexOf(from,at+1)>=0)throw new Error('anchor '+name+': '+from.slice(0,80));text=text.slice(0,at)+to+text.slice(at+from.length);}return text;}
// main realm (like a browser page)
export function loadMain(patches){const win={};globalThis.window=win;for(const n of MODULES)vm.runInThisContext(applyPatches(n,src(n),patches),{filename:n+'.js'});delete globalThis.window;return win;}
// contextified sandbox (like checks/*.test.mjs)
export function loadSandbox(patches){const ctx={window:{},performance,console};vm.createContext(ctx);for(const n of MODULES)vm.runInContext(applyPatches(n,src(n),patches),ctx,{filename:n+'.js'});return ctx.window;}
export function make(win,index,campaign){const world=win.FWorld.create(96,index,campaign?{campaign:true}:undefined);let brain=null;try{brain=win.FBrain.create({mode:'cpu'});}catch{}return {world,sim:win.FSimulation.create(world,{brain})};}
// Scripted player: different from the SIM agent's (strafes, turns both ways, cycles weapons, fires in bursts).
export function pilot(i,inp,s,weapons){inp.moveY=i%600<420?1:-.4;inp.moveX=Math.sin(i/70)*.9;inp.lookX=Math.sin(i/130)*.025;inp.lookY=0;inp.fire=(i%30)<11;inp.dash=(i%200)===17;inp.sprint=(i%300)<200;if(weapons)inp.weapon=weapons[Math.floor(i/360)%weapons.length];}
export const quant=(a,p)=>{const b=Float64Array.from(a).sort();return b[Math.min(b.length-1,Math.floor(b.length*p))];};
