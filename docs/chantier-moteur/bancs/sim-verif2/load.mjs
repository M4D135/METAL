// SIM counter-verification (round 2). Repo READ-ONLY: sources read and evaluated in memory only.
import {readFileSync} from 'node:fs';import vm from 'node:vm';
export const ROOT=(process.env.METAL_ROOT||process.cwd());
export const MODULES=['renderer','world','destruction','economy','brain','simulation'];
export const src=n=>readFileSync(ROOT+'/src/'+n+'.js','utf8');
export function applyPatches(name,text,patches){for(const [from,to] of (patches?.[name]||[])){if(typeof from!=='string'){if(!from.test(text))throw new Error('regex anchor '+from);text=text.replace(from,to);continue;}const at=text.indexOf(from);if(at<0||text.indexOf(from,at+1)>=0)throw new Error('anchor '+name+': '+from.slice(0,80));text=text.slice(0,at)+to+text.slice(at+from.length);}return text;}
export function loadMain(patches){const win={};globalThis.window=win;for(const n of MODULES)vm.runInThisContext(applyPatches(n,src(n),patches),{filename:n+'.js'});delete globalThis.window;return win;}
export function loadSandbox(patches){const ctx={window:{},performance,console};vm.createContext(ctx);for(const n of MODULES)vm.runInContext(applyPatches(n,src(n),patches),ctx,{filename:n+'.js'});return ctx.window;}
export function make(win,index,campaign){const world=win.FWorld.create(96,index,campaign?{campaign:true}:undefined);let brain=null;try{brain=win.FBrain.create({mode:'cpu'});}catch{}return {world,sim:win.FSimulation.create(world,{brain})};}
// Pilot different from round 1: strafes, turns both ways, cycles weapons, bursts, backs off.
export function pilot(i,inp,s,weapons){inp.moveY=i%600<420?1:-.4;inp.moveX=Math.sin(i/70)*.9;inp.lookX=Math.sin(i/130)*.025;inp.lookY=0;inp.fire=(i%30)<11;inp.dash=(i%200)===17;inp.sprint=(i%300)<200;if(weapons)inp.weapon=weapons[Math.floor(i/360)%weapons.length];}
export const quant=(a,p)=>{const b=Float64Array.from(a).sort();return b[Math.min(b.length-1,Math.floor(b.length*p))];};
const f64=new Float64Array(1),u32=new Uint32Array(f64.buffer);
export const mix=(h,v)=>{f64[0]=+v;h=Math.imul(h^u32[0],16777619);return Math.imul(h^u32[1],16777619);};
// Richer digest than round 1: adds yaw, velocities, goals, path length, combat flags, debris rotation/rest, projectiles, bullets.
export function digest(s,h){const p=s.player;for(const k of ['x','y','z','hp','yaw','pitch','vx','vy','vz'])h=mix(h,p[k]||0);h=mix(h,s.kills);h=mix(h,s.score||0);
  for(const e of s.enemies){h=mix(h,e.x);h=mix(h,e.z);h=mix(h,e.hp);h=mix(h,e.baseY);h=mix(h,e.yaw||0);h=mix(h,e.goalX||0);h=mix(h,e.goalZ||0);h=mix(h,e.path?e.path.length:-1);h=mix(h,e.pathAt||0);h=mix(h,e.combatEnabled?1:0);h=mix(h,e.moveSpeed||0);h=mix(h,e.cooldown||0);}
  for(const d of s.debris){h=mix(h,d.x);h=mix(h,d.y);h=mix(h,d.z);h=mix(h,d.rotation?d.rotation[0]:0);h=mix(h,d.rotation?d.rotation[1]:0);h=mix(h,d.rotation?d.rotation[2]:0);h=mix(h,d.resting?1:0);h=mix(h,d.age);}
  for(const q of s.projectiles||[]){h=mix(h,q.x);h=mix(h,q.y);h=mix(h,q.z);}
  for(const q of s.bullets||[]){h=mix(h,q.x);h=mix(h,q.z);}
  h=mix(h,s.events.length);for(const e of s.events)for(let i=0;i<e.name.length;i++)h=Math.imul(h^e.name.charCodeAt(i),16777619);return h>>>0;}
export const snapHash=sim=>{const t=JSON.stringify(sim.snapshot());let h=2166136261;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);return (h>>>0).toString(16)+':'+t.length;};
