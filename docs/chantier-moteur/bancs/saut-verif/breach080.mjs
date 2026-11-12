// 0.8.0 NON MODIFIEE (aucun patch) : pistolet de départ (munitions infinies), brèche dans le muret le plus proche du départ, sortie à pied,
// puis retour par une 2e brèche tirée depuis le substrat. sim.step uniquement.
import {loadFast,WORLDS} from '../saut/lib.mjs';
const W=loadFast();
for(const label of ['v2-00','v2-01','v2-02','v2-06']){
  const e=WORLDS.find(w=>w[0]===label);const world=W.FWorld.create(96,e[1],e[2]);
  const authored=(x,z)=>world.walkable.some(f=>!f.substrate&&!f.fallback&&Math.abs(x-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2);
  const probe=W.FSimulation.create(world,{}),sp=probe.state.player;
  const walls=world.outdoorBoundaries.map(b=>world.colliders.find(c=>c.mesh===b.mesh)).filter(c=>Math.abs(c.minY-sp.y)<.1).map(c=>({c,cx:(c.minX+c.maxX)/2,cz:(c.minZ+c.maxZ)/2,alongX:(c.maxX-c.minX)>(c.maxZ-c.minZ)})).map(w=>({...w,d:Math.hypot(w.cx-sp.x,w.cz-sp.z)})).sort((a,b)=>a.d-b.d);
  let done=false;
  for(const w of walls.slice(0,8)){if(done)break;
    for(const side of [1,-1]){
      const ix=w.alongX?w.cx:w.cx+side*2.5,iz=w.alongX?w.cz+side*2.5:w.cz,ox=w.alongX?w.cx:w.cx-side*2.5,oz=w.alongX?w.cz-side*2.5:w.cz;
      if(!authored(ix,iz)||authored(ox,oz)||probe.blocked(ix,iz,.28,sp.y))continue;
      const sim=W.FSimulation.create(world,{}),s=sim.state,p=s.player;p.x=ix;p.z=iz;p.yaw=Math.atan2(w.cx-ix,-(w.cz-iz));
      const pitchAt=y=>Math.atan2(y-(p.y+1.62),2.2);let shots=0,t=0,out=null;
      // tir en balayant la hauteur du muret, on essaie de passer toutes les 0,5 s sur une copie restaurée
      for(let i=0;i<360&&!out;i++){p.pitch=pitchAt(w.c.minY+(w.c.maxY-w.c.minY)*(.15+.8*((i%45)/45)));sim.step(1/60,{fire:true,weapon:s.weapon,moveX:0,moveY:0});t+=1/60;shots+=s.events.filter(e=>e.name==='shot').length;s.events.length=0;p.hp=sim.stats.maxHp;
        if(i%30===29){const snap=sim.snapshot();const c2=W.FSimulation.create(world,{});if(!c2.restore(JSON.parse(JSON.stringify(snap)))){continue;}const q=c2.state.player;q.pitch=0;
          for(let k=0;k<240&&!c2.state.dead;k++){c2.step(1/60,{moveX:0,moveY:1,sprint:true,weapon:c2.state.weapon});c2.state.events.length=0;if(!q.airborne&&!authored(q.x,q.z)&&Math.abs(q.y+.25)<.05){out={t:+t.toFixed(2),shots,walk:+(k/60).toFixed(2),pos:[+q.x.toFixed(1),q.y,+q.z.toFixed(1)]};break;}}}
      }
      if(out){console.log(label,'stage',world.stage,'muret h',(w.c.maxY-w.c.minY).toFixed(2),'à',w.d.toFixed(1),'m du départ | 0.8.0 : sortie à pied sur le substrat après',out.t,'s de tir ('+out.shots+' balles de pistolet, munitions',JSON.stringify(s.inventory.ammo)+') +',out.walk,'s de marche →',JSON.stringify(out.pos));done=true;break;}
      else console.log(label,'muret à',w.d.toFixed(1),'m côté',side,': pas de sortie en 6 s de tir (',shots,'balles), révisions',s.destructionRevision);
    }
  }
}
