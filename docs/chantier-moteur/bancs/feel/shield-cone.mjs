// Guard coverage: real bullets fired at a player whose shield is raised.
// Measures the fraction of hits that the guard intercepts and the HP actually lost,
// as a function of incoming azimuth, shooter height, aim height and player pitch.
// Usage: node shield-cone.mjs <ferro-root>
import {load,flatWorld,hurtProbe} from './load.mjs';
const root=process.argv[2];
const W=load(root,{modules:['destruction','economy','simulation'],patch:hurtProbe});
const {FSimulation}=W;
function trial({az=0,shooterDy=0,aimY=1.45,pitch=0,speed=7.7,damage=8,dist=1.6}){
  W.__HURTS=[];
  const sim=FSimulation.create(flatWorld(),{equipment:{right:0,left:'shield',shieldEnergy:100}});
  const p=sim.state.player;p.yaw=0;p.pitch=pitch;
  // raise guard
  sim.step(1/60,{fireLeft:true});
  // forward is -Z for yaw 0. Shooter placed at azimuth az (deg) from forward, 8 m away, at height shooterDy.
  const a=az*Math.PI/180,sx=Math.sin(a)*8,sz=-Math.cos(a)*8,sy=shooterDy+1.45;
  const tx=0,ty=aimY,tz=0,d=Math.hypot(tx-sx,ty-sy,tz-sz),dir=[(tx-sx)/d,(ty-sy)/d,(tz-sz)/d];
  // start the bullet `dist` metres before the target point, along its real path
  const b={x:tx-dir[0]*dist,y:ty-dir[1]*dist,z:tz-dir[2]*dist,dx:dir[0]*speed,dy:dir[1]*speed,dz:dir[2]*speed,life:5,damage,kind:0,owner:99};
  sim.state.bullets.push(b);
  for(let i=0;i<60&&sim.state.bullets.length;i++)sim.step(1/60,{fireLeft:true});
  const h=W.__HURTS.find(q=>q.line);
  const blocked=sim.state.events.some(e=>e.name==='shieldBlock')||(h&&h.shield>0);
  return {hit:!!h,blocked:!!blocked,hpLost:+(100-p.hp).toFixed(2),raw:h?+h.raw.toFixed(2):0,energy:+sim.state.shield.energy.toFixed(1),armor:sim.state.armor?.points};
}
const rows=[];
for(const az of [0,20,35,45,55,65,80])rows.push({case:'azimut '+az+'°, tireur au même niveau, visée torse',...trial({az})});
for(const aimY of [.35,.7,1.0,1.45,1.75,1.9])rows.push({case:'face, visée y='+aimY+' m',...trial({aimY})});
for(const dy of [-3.2,-1.6,1.6,3.2])rows.push({case:'face, tireur '+(dy>0?'+':'')+dy+' m (pitch 0)',...trial({shooterDy:dy})});
for(const dy of [-3.2,3.2]){const pitch=Math.atan2(dy,8);rows.push({case:'face, tireur '+(dy>0?'+':'')+dy+' m, joueur le regarde (pitch '+pitch.toFixed(2)+')',...trial({shooterDy:dy,pitch})});}
for(const pitch of [-.6,-.3,.3,.6,.9])rows.push({case:'face même niveau, pitch joueur '+pitch,...trial({pitch})});
for(const speed of [5.5,7.7,20,40])rows.push({case:'face, vitesse balle '+speed+' m/s',...trial({speed})});
console.table(rows);
// sweep: blocked fraction over azimuth x aim height, pitch 0
let tot=0,blk=0;const grid=[];
for(const az of [0,10,20,30,40,50,60]){const row={az};for(const aimY of [.4,.8,1.2,1.45,1.7,1.9]){const r=trial({az,aimY});row['y'+aimY]=r.hit?(r.blocked?'B':'x'):'-';tot+=r.hit;blk+=r.blocked&&r.hit;}grid.push(row);}
console.log('Grille azimut x hauteur de visee (B = bloque, x = touche non bloque, - = rate)');console.table(grid);
console.log('fraction bloquee sur la grille',(blk/tot*100).toFixed(1)+'%','('+blk+'/'+tot+')');
