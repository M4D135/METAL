import {loadAll,simSource,SCENARIOS,build,drive,makeInput} from './build.mjs';
const win=loadAll({sim:simSource({}),names:['renderer','world','destruction','economy','brain','simulation']});
for(const W of [undefined,2,3])for(const [label,idx,opts] of SCENARIOS){const {sim}=build(win,idx,opts),s=sim.state,input=makeInput();if(W!==undefined)input.weapon=W;let shots=0,maxDeb=0,deb=0;const names={};
 for(let i=0;i<900;i++){drive(i,input,s);if(s.player.hp<50)s.player.hp=100;sim.step(1/60,input);for(const e of s.events)names[e.name]=(names[e.name]||0)+1;s.events.length=0;deb+=s.debris.length;maxDeb=Math.max(maxDeb,s.debris.length);}
 console.log('W',W,label,'weapon now',s.weapon,'owned',JSON.stringify(s.inventory?.weapons),'ammo',JSON.stringify(s.inventory?.ammo),'shots',names.shot||0,'rocket/explosion',names.explosion||0,'avgDebris',(deb/900).toFixed(0),'max',maxDeb,'rev',sim.destruction.revision);}
