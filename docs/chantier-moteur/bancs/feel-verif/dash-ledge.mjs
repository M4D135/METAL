// Dash toward a 1.6 m terrace edge: horizontal reach, airborne speed, i-frames, vs the same dash on flat ground.
import {vload,arena} from './vload.mjs';
const root=process.argv[2];const W=vload(root);
function run(world,label,start,moveFirst){
  const sim=W.FSimulation.create(world,{equipment:{right:0,left:null,shieldEnergy:100}});const s=sim.state,p=s.player;p.x=0;p.z=start;p.y=world.walkable[0].y||0;p.yaw=Math.PI; // forward = +z
  if(moveFirst)for(let i=0;i<30;i++)sim.step(1/60,{moveY:1,sprint:true});
  const z0=p.z;let inv=0,airAt=null,airV=null,landZ=null,t=0;sim.step(1/60,{dash:true,moveY:moveFirst?1:0,sprint:moveFirst});t+=1/60;
  for(let i=0;i<90;i++){if(p.dashing>0)inv+=1/60;const was=p.airborne;sim.step(1/60,{moveY:moveFirst?1:0,sprint:moveFirst});t+=1/60;if(!was&&p.airborne&&airAt===null){airAt=t;airV=Math.hypot(p.airVX,p.airVZ);}if(was&&!p.airborne&&landZ===null)landZ=p.z;}
  console.log(`${label}: depart z=${z0.toFixed(2)} ; i-frames ${Math.round(inv*1000)} ms ; en l'air a t=${airAt?.toFixed(3)} vitesse horizontale au decollage ${airV?.toFixed(2)} m/s ; atterrissage z=${landZ?.toFixed(2)} ; z final ${p.z.toFixed(2)} ; mort=${s.dead}`);
}
const ledge=arena({spawn:{x:0,y:1.6,z:-1,yaw:Math.PI},walkable:[{x:0,y:1.6,z:-25,w:100,d:50},{x:0,y:0,z:25,w:100,d:50}]});
run(ledge,'arret, esquive vers le bord (a 1,0 m)',-1.0,false);
run(ledge,'arret, esquive vers le bord (a 0,4 m)',-0.4,false);
run(ledge,'course 7,6 m/s puis esquive vers le bord',-5.0,true);
run(arena(),'sol plat, esquive depuis l arret',0,false);
