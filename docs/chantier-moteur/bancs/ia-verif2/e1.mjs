import {loadSet,pickScen,makeDriver} from './lib.mjs';
const W=loadSet(process.argv[2]);const [label,idx,opts]=pickScen('v2-w01')[0];
const w=W.FWorld.create(96,idx,opts);const sim=W.FSimulation.create(w,{brain:W.FBrain.create({mode:'cpu'})});const s=sim.state;
const P=e=>[+e.x.toFixed(1),+(e.baseY??e.y??0).toFixed(1),+e.z.toFixed(1)];
console.log('home',JSON.stringify(w.enemies[1]).slice(0,200),'spawn',JSON.stringify(w.spawn));
console.log('enc of enemy1',s.encounters.filter(q=>q.waves.some(v=>v.enemyIds.includes(1))).map(q=>q.id+' wave '+q.waves.findIndex(v=>v.enemyIds.includes(1))+' entries '+JSON.stringify(q.spawnEntries.map(c=>[+c.x.toFixed(1),+(c.y??-9).toFixed(1),+c.z.toFixed(1)]))).join());
const drive=makeDriver('tourx',sim,w),input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};let prev='';
for(let i=0;i<700;i++){drive(i,input);sim.step(1/60,input);const e=s.enemies[1];const st=JSON.stringify([P(e),e.deployed,e.encounterReleased,e.returning,e.combatEnabled]);if(st!==prev&&(i<3||i%60===0||e.returning!==JSON.parse(prev||'[0,0,0,0]')[3]))console.log(i,st,'player',P({x:s.player.x,baseY:s.player.y,z:s.player.z}),'evs',s.events.map(q=>q.name).filter(n=>/wave|encounter/i.test(n)).join());prev=st;s.events.length=0;}
