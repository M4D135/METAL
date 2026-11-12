// Exposition au défaut LOAD-01 (points de reprise refusés à cause de gravats au repos) : origine contre règle v2.
// Même pilote scripté (tourne et tire), un instantané toutes les 5 s, restauré dans une simulation neuve de la même version.
import {loadFast,loadRoot,loadoutV2} from './lib.mjs';
const O=loadFast(),R=loadRoot(new URL('./work',import.meta.url).pathname);
function run(W,index,weapon){
  const mk=()=>{const world=W.FWorld.create(96,index,{campaign:true,campaignVersion:2});return W.FSimulation.create(world,{...loadoutV2(W,index),armorSystem:true});};
  const sim=mk();sim.selectWeapon(weapon);const s=sim.state,p=s.player,input={moveX:0,moveY:1,sprint:true,fire:false,lookX:0,lookY:0};let ok=0,n=0,rubble=0;
  for(let i=1;i<=1800;i++){p.hp=Math.max(p.hp,70);input.moveX=Math.sin(i/90);input.fire=(i%20)<12;p.yaw+=.013;if(weapon!==4&&s.inventory.ammo[weapon]<8)s.inventory.ammo[weapon]=sim.ammoCaps[weapon];sim.step(1/60,input);s.events.length=0;
    if(i%300===0&&!p.airborne){n++;const snap=JSON.parse(JSON.stringify(sim.snapshot()));rubble=Math.max(rubble,snap.state.rubble.length);if(mk().restore(snap,{recover:true}))ok++;}}
  return {acceptés:ok+'/'+n,révisions:sim.destruction.revision,gravatsMax:rubble};
}
for(const [index,weapon,label] of [[2,0,'monde 3 mitraillette'],[2,1,'monde 3 pompe'],[9,0,'monde 10 mitraillette'],[9,1,'monde 10 pompe']])console.log(label.padEnd(24),'origine',JSON.stringify(run(O,index,weapon)),'| règle v2',JSON.stringify(run(R,index,weapon)));
